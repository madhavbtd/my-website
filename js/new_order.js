// js/new_order.js

// Firestore functions
const { db, collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, limit, orderBy } = window;

// --- Global Variables ---
let addedProducts = [];
let isEditMode = false;
let orderIdToEdit = null;
let selectedCustomerId = null;
let productCache = []; // Cache for product names
let customerCache = []; // Cache for customer names/numbers
let productFetchPromise = null; // To avoid multiple fetches
let customerFetchPromise = null; // To avoid multiple fetches

// --- DOM Element References ---
const orderForm = document.getElementById('newOrderForm');
const saveButton = document.getElementById('saveOrderBtn');
const saveButtonText = saveButton ? saveButton.querySelector('span') : null;
const formHeader = document.getElementById('formHeader');
const headerText = document.getElementById('headerText');
const hiddenEditOrderIdInput = document.getElementById('editOrderId');
const selectedCustomerIdInput = document.getElementById('selectedCustomerId');
const displayOrderIdInput = document.getElementById('display_order_id');
const manualOrderIdInput = document.getElementById('manual_order_id');
const customerNameInput = document.getElementById('full_name');
const customerWhatsAppInput = document.getElementById('whatsapp_no');
const customerAddressInput = document.getElementById('address');
const customerContactInput = document.getElementById('contact_no');
const customerSuggestionsNameBox = document.getElementById('customer-suggestions-name');
const customerSuggestionsWhatsAppBox = document.getElementById('customer-suggestions-whatsapp');
const productNameInput = document.getElementById('product_name_input');
const quantityInput = document.getElementById('quantity_input');
const addProductBtn = document.getElementById('add-product-btn');
const productListContainer = document.getElementById('product-list');
const productSuggestionsBox = document.getElementById('product-suggestions');
const orderStatusCheckboxes = document.querySelectorAll('input[name="order_status"]');
const orderStatusGroup = document.getElementById('order-status-group');
const whatsappReminderPopup = document.getElementById('whatsapp-reminder-popup');
const whatsappMsgPreview = document.getElementById('whatsapp-message-preview');
const whatsappSendLink = document.getElementById('whatsapp-send-link');
const popupCloseBtn = document.getElementById('popup-close-btn');


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DEBUG] New Order DOM Loaded. Initializing...");
    waitForDbConnection(initializeForm);
    // Event Listeners
    if (orderForm) orderForm.addEventListener('submit', handleFormSubmit);
    if (addProductBtn) addProductBtn.addEventListener('click', handleAddProduct);
    if (productListContainer) productListContainer.addEventListener('click', handleDeleteProduct);
    // Blur listeners to hide suggestions
    if (customerNameInput) customerNameInput.addEventListener('blur', () => hideSuggestionBox(customerSuggestionsNameBox));
    if (customerWhatsAppInput) customerWhatsAppInput.addEventListener('blur', () => hideSuggestionBox(customerSuggestionsWhatsAppBox));
    if (productNameInput) productNameInput.addEventListener('blur', () => hideSuggestionBox(productSuggestionsBox));
    // Input listeners for searching
    if (customerNameInput) customerNameInput.addEventListener('input', (e) => handleCustomerInput(e, 'name'));
    if (customerWhatsAppInput) customerWhatsAppInput.addEventListener('input', (e) => handleCustomerInput(e, 'whatsapp'));
    if (productNameInput) productNameInput.addEventListener('input', handleProductInput);
    if (popupCloseBtn) popupCloseBtn.addEventListener('click', closeWhatsAppPopup);
    if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (event) => { if (event.target === whatsappReminderPopup) closeWhatsAppPopup(); });

    // Global click listener to hide suggestion boxes when clicking outside
    document.addEventListener('click', (event) => {
        if (customerSuggestionsNameBox && !customerSuggestionsNameBox.contains(event.target) && event.target !== customerNameInput) {
            hideSuggestionBox(customerSuggestionsNameBox);
        }
        if (customerSuggestionsWhatsAppBox && !customerSuggestionsWhatsAppBox.contains(event.target) && event.target !== customerWhatsAppInput) {
            hideSuggestionBox(customerSuggestionsWhatsAppBox);
        }
        if (productSuggestionsBox && !productSuggestionsBox.contains(event.target) && event.target !== productNameInput) {
            hideSuggestionBox(productSuggestionsBox);
        }
    });
});

// --- DB Connection Wait ---
function waitForDbConnection(callback) {
    if (window.db) { console.log("[DEBUG] DB connection confirmed immediately."); callback(); }
    else { let attempts = 0; const maxAttempts = 20; const intervalId = setInterval(() => { attempts++; if (window.db) { clearInterval(intervalId); console.log("[DEBUG] DB connection confirmed after check."); callback(); } else if (attempts >= maxAttempts) { clearInterval(intervalId); console.error("[DEBUG] DB connection timeout."); alert("Database connection failed."); } }, 250); }
}

// --- Utility to Hide Suggestion Box (Removed Timeout) ---
function hideSuggestionBox(box) {
    // Hide immediately on blur or click outside
    if (box) {
         box.classList.remove('active');
         box.style.display = 'none';
    }
    // No need for setTimeout or activeElement check here, rely on mousedown for selection clicks
}


// --- Initialize Form ---
function initializeForm() {
    const urlParams = new URLSearchParams(window.location.search);
    orderIdToEdit = urlParams.get('editOrderId');
    if (orderIdToEdit) {
        isEditMode = true;
        console.log("[DEBUG] Edit Mode Initializing. Order Firestore ID:", orderIdToEdit);
        if(headerText) headerText.textContent = "Edit Order"; else if(formHeader) formHeader.textContent = "Edit Order";
        if(saveButtonText) saveButtonText.textContent = "Update Order";
        if(hiddenEditOrderIdInput) hiddenEditOrderIdInput.value = orderIdToEdit;
        if(manualOrderIdInput) manualOrderIdInput.readOnly = true; // Cannot change manual ID in edit mode
        loadOrderForEdit(orderIdToEdit);
        handleStatusCheckboxes(true);
    } else {
        isEditMode = false;
        console.log("[DEBUG] Add Mode Initializing.");
        if(headerText) headerText.textContent = "New Order"; else if(formHeader) formHeader.textContent = "New Order";
        if(saveButtonText) saveButtonText.textContent = "Save Order";
        if(manualOrderIdInput) manualOrderIdInput.readOnly = false; // Can set manual ID for new orders
        const orderDateInput = document.getElementById('order_date');
        if (orderDateInput && !orderDateInput.value) { orderDateInput.value = new Date().toISOString().split('T')[0]; }
        handleStatusCheckboxes(false);
        renderProductList();
        resetCustomerSelection();
        displayOrderIdInput.value = ''; // Clear system ID field for new orders
    }
}

// --- Load Order For Edit ---
async function loadOrderForEdit(docId) {
    console.log(`[DEBUG] Loading order data for edit from Firestore: ${docId}`);
    try {
        const orderRef = doc(db, "orders", docId);
        const docSnap = await getDoc(orderRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("[DEBUG] Order data for edit:", data);
            // Fill form (customer, order details, urgent, status)
            customerNameInput.value = data.customerDetails?.fullName || '';
            customerAddressInput.value = data.customerDetails?.address || ''; // Changed from billingAddress for consistency if needed
            customerWhatsAppInput.value = data.customerDetails?.whatsappNo || '';
            customerContactInput.value = data.customerDetails?.contactNo || '';
            selectedCustomerId = data.customerId || null;
            if (selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId;
            // Don't lock customer fields in edit mode - allow changes
            customerAddressInput.readOnly = false; customerContactInput.readOnly = false;

            displayOrderIdInput.value = data.orderId || docId; // Show the existing system/saved Order ID
            manualOrderIdInput.value = data.orderId || ''; // Display same ID in manual field, but keep it readOnly
            orderForm.order_date.value = data.orderDate || '';
            orderForm.delivery_date.value = data.deliveryDate || '';
            orderForm.remarks.value = data.remarks || '';
            const urgentVal = data.urgent || 'No';
            const urgentRadio = orderForm.querySelector(`input[name="urgent"][value="${urgentVal}"]`);
            if (urgentRadio) urgentRadio.checked = true;
            orderStatusCheckboxes.forEach(cb => cb.checked = false);
            if (data.status) {
                const statusCheckbox = orderForm.querySelector(`input[name="order_status"][value="${data.status}"]`);
                if (statusCheckbox) statusCheckbox.checked = true;
            }
            // Fill product list
            addedProducts = data.products || [];
            renderProductList();
        } else {
            console.error("[DEBUG] Order document not found for editing!"); alert("Error: Cannot find the order to edit."); window.location.href = 'order_history.html';
        }
    } catch (error) {
        console.error("[DEBUG] Error loading order for edit:", error); alert("Error loading order data: " + error.message); window.location.href = 'order_history.html';
    }
}

// --- Product Handling ---
function handleAddProduct() {
     const name = productNameInput.value.trim();
    const quantity = quantityInput.value.trim();
    if (!name) { alert("Please select or enter a product name."); productNameInput.focus(); return; }
    if (!quantity || isNaN(quantity) || Number(quantity) <= 0) { alert("Please enter a valid quantity."); quantityInput.focus(); return; }
    addedProducts.push({ name: name, quantity: Number(quantity) });
    console.log("[DEBUG] Product added:", addedProducts);
    renderProductList();
    productNameInput.value = ''; quantityInput.value = ''; productNameInput.focus();
    // Hide suggestion box after adding
    hideSuggestionBox(productSuggestionsBox);
    productNameInput.readOnly = false;
 }
function renderProductList() {
     if (!productListContainer) return; productListContainer.innerHTML = '';
    if (addedProducts.length === 0) { productListContainer.innerHTML = '<p class="empty-list-message">No products added yet.</p>'; return; }
    addedProducts.forEach((product, index) => {
        const listItem = document.createElement('div'); listItem.classList.add('product-list-item');
        listItem.innerHTML = `<span>${index + 1}. ${product.name} - Qty: ${product.quantity}</span><button type="button" class="delete-product-btn" data-index="${index}" title="Delete Product"><i class="fas fa-trash-alt"></i></button>`;
        productListContainer.appendChild(listItem);
    });
}
function handleDeleteProduct(event) {
     const deleteButton = event.target.closest('.delete-product-btn');
    if (deleteButton) { const indexToDelete = parseInt(deleteButton.dataset.index, 10); if (!isNaN(indexToDelete) && indexToDelete >= 0 && indexToDelete < addedProducts.length) { addedProducts.splice(indexToDelete, 1); console.log("[DEBUG] Product deleted:", addedProducts); renderProductList(); } }
}

// --- Status Checkbox Handling ---
function handleStatusCheckboxes(isEditing) {
    const defaultStatus = "Order Received"; let defaultCheckbox = null;
    orderStatusCheckboxes.forEach(checkbox => {
         if (checkbox.value === defaultStatus) defaultCheckbox = checkbox;
         // Status can always be changed, even for new orders that start default
         checkbox.disabled = false; // Always enable status change
         checkbox.closest('label').classList.remove('disabled'); // Remove disabled visual style
         checkbox.removeEventListener('change', handleStatusChange);
         checkbox.addEventListener('change', handleStatusChange);
     });
    // Only default check 'Order Received' if it's a truly new order and no status is loaded yet
    if (!isEditing && !orderForm.querySelector('input[name="order_status"]:checked') && defaultCheckbox) {
        defaultCheckbox.checked = true;
    }
}
function handleStatusChange(event) { const changedCheckbox = event.target; if (changedCheckbox.checked) { orderStatusCheckboxes.forEach(otherCb => { if (otherCb !== changedCheckbox) otherCb.checked = false; }); } }

// --- Autocomplete V2: Client-Side Filtering ---

// --- Customer Autocomplete ---
let customerSearchTimeout;
function handleCustomerInput(event, type) {
    const searchTerm = event.target.value.trim();
    const suggestionBox = type === 'name' ? customerSuggestionsNameBox : customerSuggestionsWhatsAppBox;
    if (!suggestionBox) return;

    // Allow editing customer details even if selected
    resetCustomerSelection(); // Make fields editable on input

    if (searchTerm.length < 2) {
        clearTimeout(customerSearchTimeout);
        hideSuggestionBox(suggestionBox); // Use the function to hide
        return;
     }

    clearTimeout(customerSearchTimeout);
    customerSearchTimeout = setTimeout(() => {
        console.log(`[DEBUG] Triggering customer filter for (${type}): "${searchTerm}"`);
        getOrFetchCustomerCache().then(() => { filterAndRenderCustomerSuggestions(searchTerm, type, suggestionBox); }).catch(err => console.error("[DEBUG] Error during customer fetch/filter:", err));
    }, 300);
}
async function getOrFetchCustomerCache() {
    if (customerCache.length > 0) { console.log("[DEBUG] Using cached customer data."); return Promise.resolve(); }
    if (customerFetchPromise) { console.log("[DEBUG] Waiting for existing customer fetch promise."); return customerFetchPromise; }
    console.log("[DEBUG] Fetching initial customer data from Firestore...");
    try {
        if (!db || !collection || !query || !getDocs || !orderBy) { throw new Error("Firestore query functions unavailable for customers."); }
        const customersRef = collection(db, "customers");
        const q = query(customersRef, orderBy("fullName")); // Requires index on fullName
        console.log("[DEBUG] Customer Fetch Query:", q);
        customerFetchPromise = getDocs(q).then(snapshot => {
            customerCache = [];
            snapshot.forEach(doc => { const d = doc.data(); if (d.fullName && d.whatsappNo) customerCache.push({ id: doc.id, ...d }); });
            console.log(`[DEBUG] Fetched and cached ${snapshot.size} documents -> ${customerCache.length} valid customers.`);
            customerFetchPromise = null;
        }).catch(err => { console.error("[DEBUG] Error fetching customers:", err); customerFetchPromise = null; throw err; });
        return customerFetchPromise;
    } catch (error) { console.error("[DEBUG] Error setting up customer fetch:", error); customerFetchPromise = null; return Promise.reject(error); }
}
function filterAndRenderCustomerSuggestions(term, type, box) {
    const lowerTerm = term.toLowerCase();
    const field = type === 'name' ? 'fullName' : 'whatsappNo';
    console.log(`[DEBUG] Filtering ${customerCache.length} cached customers for term "${term}" on field "${field}"`);
    const filtered = customerCache.filter(c => { const val = c[field] || ''; return val.toLowerCase().includes(lowerTerm); }).slice(0, 7);
    console.log(`[DEBUG] Found ${filtered.length} customer suggestions.`);
    renderCustomerSuggestions(filtered, term, box);
}
function renderCustomerSuggestions(suggestions, term, box) {
     if (!box) return;
     if (suggestions.length === 0) {
         box.classList.remove('active'); // Hide container
         box.style.display = 'none';
         return;
     }
    const ul = document.createElement('ul');
    suggestions.forEach(cust => {
        const li = document.createElement('li'); const dName = `${cust.fullName} (${cust.whatsappNo})`;
        try { li.innerHTML = dName.replace(new RegExp(`(${term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'), '<strong>$1</strong>'); } catch { li.textContent = dName; }
        li.dataset.customer = JSON.stringify(cust);
        li.addEventListener('mousedown', (e) => { // Use mousedown to register before blur
            e.preventDefault(); // Prevent input blur
            fillCustomerData(cust);
            hideSuggestionBox(box); // Hide box after selection
        });
        ul.appendChild(li);
    });
    box.innerHTML = '';
    box.appendChild(ul);
    box.classList.add('active'); // Show container
    box.style.display = 'block'; // Explicitly show
}
function fillCustomerData(customer) {
    if (!customer) { resetCustomerSelection(); return; }
    console.log("[DEBUG] Filling customer data:", customer);
    customerNameInput.value = customer.fullName || ''; customerWhatsAppInput.value = customer.whatsappNo || '';
    customerAddressInput.value = customer.billingAddress || customer.address || ''; customerContactInput.value = customer.contactNo || '';
    selectedCustomerId = customer.id; if(selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId; // Store ID
    // Explicitly Hide Boxes after filling
    hideSuggestionBox(customerSuggestionsNameBox);
    hideSuggestionBox(customerSuggestionsWhatsAppBox);
    // Keep fields editable after filling
    customerAddressInput.readOnly = false; customerContactInput.readOnly = false;
}
function resetCustomerSelection() {
     selectedCustomerId = null; if(selectedCustomerIdInput) selectedCustomerIdInput.value = '';
     // Keep input values, just make fields editable
     customerAddressInput.readOnly = false; customerContactInput.readOnly = false;
     console.log("[DEBUG] Customer selection reset (fields editable).");
}

// --- Product Autocomplete ---
let productSearchTimeout;
function handleProductInput(event) {
    const searchTerm = event.target.value.trim();
    if (!productSuggestionsBox) return;
    productNameInput.readOnly = false;

    if (searchTerm.length < 2) {
        clearTimeout(productSearchTimeout);
        hideSuggestionBox(productSuggestionsBox); // Use function to hide
        return;
    }

    clearTimeout(productSearchTimeout);
    productSearchTimeout = setTimeout(() => {
        console.log(`[DEBUG] Triggering product filter for: "${searchTerm}"`);
        getOrFetchProductCache().then(() => { filterAndRenderProductSuggestions(searchTerm, productSuggestionsBox); }).catch(err => console.error("[DEBUG] Error during product fetch/filter:", err));
    }, 300);
}
async function getOrFetchProductCache() {
    if (productCache.length > 0) { console.log("[DEBUG] Using cached product data."); return Promise.resolve(); }
    if (productFetchPromise) { console.log("[DEBUG] Waiting for existing product fetch promise."); return productFetchPromise; }
    console.log("[DEBUG] Fetching initial product data from Firestore...");
    try {
        if (!db || !collection || !query || !getDocs || !orderBy) { throw new Error("Firestore query functions unavailable for products."); }
        const productsRef = collection(db, "products");
        const q = query(productsRef, orderBy("printName"));
        console.log("[DEBUG] Product Fetch Query:", q);
        productFetchPromise = getDocs(q).then(snapshot => {
            productCache = [];
            snapshot.forEach(doc => { const d = doc.data(); if (d.printName) productCache.push({ id: doc.id, name: d.printName }); else console.warn("[DEBUG] Product doc missing 'printName':", doc.id);});
            console.log(`[DEBUG] Fetched and cached ${snapshot.size} documents -> ${productCache.length} valid products.`);
            productFetchPromise = null;
        }).catch(err => { console.error("[DEBUG] Error fetching products:", err); productFetchPromise = null; throw err; });
        return productFetchPromise;
    } catch (error) { console.error("[DEBUG] Error setting up product fetch:", error); productFetchPromise = null; return Promise.reject(error); }
}
function filterAndRenderProductSuggestions(term, box) {
    const lowerTerm = term.toLowerCase();
    console.log(`[DEBUG] Filtering ${productCache.length} cached products for term "${term}"`);
    const filtered = productCache.filter(p => (p.name || '').toLowerCase().includes(lowerTerm)).slice(0, 10);
    console.log(`[DEBUG] Found ${filtered.length} product suggestions.`);
    renderProductSuggestions(filtered, term, box);
}
function renderProductSuggestions(suggestions, term, box) {
     if (!box) return;
     if (suggestions.length === 0) {
         box.classList.remove('active'); // Hide container
         box.style.display = 'none';
         return;
     }
    const ul = document.createElement('ul');
    suggestions.forEach(prod => {
        const li = document.createElement('li');
        try { li.innerHTML = prod.name.replace(new RegExp(`(${term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'), '<strong>$1</strong>'); } catch { li.textContent = prod.name; }
        li.dataset.name = prod.name; // Store printName
        li.addEventListener('mousedown', (e) => { // Use mousedown
            e.preventDefault(); // Prevent blur
            productNameInput.value = prod.name;
            hideSuggestionBox(box); // Hide box on click
            quantityInput.focus();
        });
        ul.appendChild(li);
    });
    box.innerHTML = '';
    box.appendChild(ul);
    box.classList.add('active'); // Show container
    box.style.display = 'block'; // Explicitly show
}
// --- End Autocomplete ---

// --- Form Submit Handler ---
async function handleFormSubmit(event) {
    event.preventDefault(); console.log("[DEBUG] Form submission initiated...");
    if (!db || !collection || !addDoc || !doc || !updateDoc || !getDoc || !getDocs || !query || !orderBy || !limit ) { // Added missing functions for ID generation
        alert("Database functions unavailable."); return;
    }
    if (!saveButton) return; saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    try {
        // Get data
        const formData = new FormData(orderForm);
        // --- Read customer details DIRECTLY from input fields ---
        const customerFullNameFromInput = customerNameInput.value.trim();
        const customerWhatsAppFromInput = customerWhatsAppInput.value.trim();
        const customerAddressFromInput = customerAddressInput.value.trim();
        const customerContactFromInput = customerContactInput.value.trim();
        // --- Use stored selectedCustomerId if available ---
        const customerIdToUse = selectedCustomerId;

        // REMOVED: Validation forcing selection for NEW orders
        // if (!customerIdToUse && !isEditMode) {
        //      throw new Error("Please select an existing customer from the suggestions. If the customer is new, add them via Customer Management first.");
        // }

         // Construct customerData using input values
         const customerData = {
             fullName: customerFullNameFromInput,
             whatsappNo: customerWhatsAppFromInput,
             address: customerAddressFromInput, // Use address from input
             contactNo: customerContactFromInput // Use contact from input
         };

        const orderDetails = { manualOrderId: formData.get('manual_order_id')?.trim() || '', orderDate: formData.get('order_date') || '', deliveryDate: formData.get('delivery_date') || '', urgent: formData.get('urgent') || 'No', remarks: formData.get('remarks')?.trim() || '' };
        const statusCheckbox = orderForm.querySelector('input[name="order_status"]:checked');
        // Default status to 'Order Received' if nothing is checked (can happen in new mode if user unchecks it)
        const selectedStatus = statusCheckbox ? statusCheckbox.value : 'Order Received';


        // Determine Order ID
        let orderIdToUse;
        const existingSystemId = displayOrderIdInput.value; // Get ID potentially loaded in edit mode

        // >> NEW LOGIC for Order ID Generation (if not editing and no manual ID) <<
        if (!isEditMode && !orderDetails.manualOrderId) {
            console.log("[DEBUG] Generating new Order ID. Checking Firestore for highest existing ID...");
            try {
                // Query Firestore for the highest numeric orderId
                const ordersRef = collection(db, "orders");

                // Query to find the highest numeric orderId (assuming stored as string)
                // Fetch a larger batch and filter/sort client-side due to Firestore query limitations on mixed types/formats
                const q = query(ordersRef, orderBy("createdAt", "desc"), limit(1000)); // Fetch recent orders
                const querySnapshot = await getDocs(q);
                let maxNumericId = 0;

                querySnapshot.forEach(doc => {
                    const idString = doc.data().orderId;
                    if (idString && /^\d+$/.test(idString)) { // Check if it's a string containing only digits
                        const numericId = parseInt(idString, 10);
                        if (!isNaN(numericId) && numericId > maxNumericId) {
                            maxNumericId = numericId;
                        }
                    }
                });

                if (maxNumericId >= 1001) {
                    orderIdToUse = (maxNumericId + 1).toString();
                    console.log(`[DEBUG] Found max numeric ID: ${maxNumericId}. New ID generated: ${orderIdToUse}`);
                } else {
                    orderIdToUse = "1001"; // Start from 1001 if no valid numeric ID >= 1001 found
                    console.log(`[DEBUG] No existing numeric ID >= 1001 found. Starting with ${orderIdToUse}`);
                }

            } catch (err) {
                console.error("[DEBUG] Error fetching highest order ID:", err);
                // Fallback to timestamp if Firestore query fails
                orderIdToUse = Date.now().toString();
                alert("Warning: Could not generate sequential Order ID. Using fallback ID.");
            }

        } else if (isEditMode) {
            // In edit mode, use the ID that was loaded (either manual or system generated previously)
            orderIdToUse = existingSystemId || orderIdToEdit; // Use displayed ID or the Firestore doc ID
            console.log(`[DEBUG] Edit mode. Using existing Order ID: ${orderIdToUse}`);
        } else {
             // Use manual ID if provided by user for a new order
            orderIdToUse = orderDetails.manualOrderId;
            console.log(`[DEBUG] Manual Order ID provided for new order: ${orderIdToUse}`);
        }
        // >> END NEW LOGIC for Order ID <<


        // ** Validation **
        if (!customerData.fullName) { throw new Error("Full Name is required."); }
        if (!customerData.whatsappNo) throw new Error("WhatsApp No required.");
        if (addedProducts.length === 0) throw new Error("Add at least one product.");
        if (!orderDetails.orderDate) throw new Error("Order Date required.");
        // Removed status check validation - defaulting to 'Order Received'


        // Prepare Payload
        const orderDataPayload = {
            orderId: orderIdToUse, // Use the determined ID
            customerId: customerIdToUse || null, // Store ID if selected
            customerDetails: customerData, // Store details captured from input
            orderDate: orderDetails.orderDate,
            deliveryDate: orderDetails.deliveryDate,
            urgent: orderDetails.urgent,
            remarks: orderDetails.remarks,
            status: selectedStatus, // Use the determined status
            products: addedProducts,
            updatedAt: new Date() // Always update 'updatedAt'
        };

        // Save/Update
        let orderDocRefPath;
        if (isEditMode) {
            if (!orderIdToEdit) throw new Error("Missing Firestore Document ID for update.");
            const orderRef = doc(db, "orders", orderIdToEdit);
            delete orderDataPayload.createdAt; // Don't update createdAt on edit
            await updateDoc(orderRef, orderDataPayload);
            orderDocRefPath = orderRef.path;
            console.log("[DEBUG] Order updated:", orderIdToEdit);
            alert('Order updated successfully!');
        } else {
            orderDataPayload.createdAt = new Date(); // Add createdAt only for new orders
            const newOrderRef = await addDoc(collection(db, "orders"), orderDataPayload);
            orderDocRefPath = newOrderRef.path;
            console.log("[DEBUG] New order saved:", newOrderRef.id);
            alert('New order saved successfully!');
            displayOrderIdInput.value = orderIdToUse; // Display the newly generated/used ID
        }

        // Post-save actions
        // await saveToDailyReport(orderDataPayload, orderDocRefPath);

        // Show WhatsApp reminder only if WhatsApp number exists
        if (customerData.whatsappNo) {
            showWhatsAppReminder(customerData, orderIdToUse, orderDetails.deliveryDate);
             // Reset ONLY IF reminder is shown OR for new orders where number is missing
             // Reset handled within showWhatsAppReminder or its skip path
        } else {
            console.warn("[DEBUG] WhatsApp number missing, skipping reminder.");
             if (!isEditMode) { resetNewOrderForm(); } // Reset form if no reminder shown for new order
        }

    } catch (error) {
        console.error("Error saving/updating order:", error);
        alert("Error: " + error.message);
    } finally {
        saveButton.disabled = false;
        const btnTxt = isEditMode ? "Update Order" : "Save Order";
        if (saveButtonText) {
             saveButtonText.textContent = btnTxt;
        } else {
            saveButton.innerHTML = `<i class="fas fa-save"></i> ${btnTxt}`;
        }
    }
}


// --- Reset Form ---
function resetNewOrderForm() {
     console.log("[DEBUG] Resetting form for New Order.");
     isEditMode = false; // Ensure mode is reset
     orderIdToEdit = null;
     resetCustomerSelection();
     customerNameInput.value = '';
     customerWhatsAppInput.value = '';
     customerAddressInput.value = '';
     customerContactInput.value = '';
     manualOrderIdInput.value = ''; // Clear manual ID
     displayOrderIdInput.value = ''; // Clear system ID
     orderForm.delivery_date.value = '';
     orderForm.remarks.value = '';
     addedProducts = [];
     renderProductList();
     orderStatusCheckboxes.forEach(cb => cb.checked = false); // Uncheck all status
     handleStatusCheckboxes(false); // Re-apply default state for new order
     const urgentNoRadio = orderForm.querySelector('input[name="urgent"][value="No"]');
     if (urgentNoRadio) urgentNoRadio.checked = true;
     const orderDateInput = document.getElementById('order_date');
     if (orderDateInput) orderDateInput.value = new Date().toISOString().split('T')[0]; // Reset date
     // Ensure header and button text are correct for 'New Order'
     if(headerText) headerText.textContent = "New Order"; else if(formHeader) formHeader.textContent = "New Order";
     if(saveButtonText) saveButtonText.textContent = "Save Order"; else if(saveButton) saveButton.innerHTML = '<i class="fas fa-save"></i> Save Order';
     if(manualOrderIdInput) manualOrderIdInput.readOnly = false; // Make manual ID editable again
     // Hide suggestion boxes
     hideSuggestionBox(customerSuggestionsNameBox);
     hideSuggestionBox(customerSuggestionsWhatsAppBox);
     hideSuggestionBox(productSuggestionsBox);
}


// --- Post-Save Functions ---
async function saveToDailyReport(orderData, orderPath) { console.log(`[DEBUG] Placeholder: Saving to daily_reports (Path: ${orderPath})`, orderData); try { /* ... */ console.log("[DEBUG] Placeholder: Called saveToDailyReport."); } catch (error) { console.error("[DEBUG] Placeholder: Error saving to daily_reports:", error); } }

// --- UPDATED WhatsApp Reminder Function ---
function showWhatsAppReminder(customer, orderId, deliveryDate) {
    if (!whatsappReminderPopup || !whatsappMsgPreview || !whatsappSendLink) {
        console.error("[DEBUG] WhatsApp popup elements missing.");
         if (!isEditMode) { resetNewOrderForm(); } // Reset form even if popup fails for new order
        return;
    }
    const customerName = customer.fullName || 'Customer';
    const customerNumber = customer.whatsappNo?.replace(/[^0-9]/g, '');
    // Check moved inside, reset form if number missing for NEW order
    if (!customerNumber) {
        console.warn("[DEBUG] WhatsApp No missing, skipping reminder.");
        if (!isEditMode) { resetNewOrderForm(); } // Reset form if no reminder shown for new order
        return;
    }

    const formattedDeliveryDate = deliveryDate ? new Date(deliveryDate).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : ' जल्द से जल्द';

    // Using Order Received template specifically after saving NEW order
    let message = `प्रिय ${customerName},
नमस्कार,
आपका ऑर्डर (Order No: ${orderId}) हमें सफलतापूर्वक प्राप्त हो गया है।
हम इस ऑर्डर को ${formattedDeliveryDate} तक पूर्ण करने का प्रयास करेंगे।

Dear ${customerName},
We have successfully received your order (Order No: ${orderId}).
We aim to complete it by ${formattedDeliveryDate}.

धन्यवाद,
Madhav Offset
Head Office: Moodh Market, Batadu
Mobile: 9549116541`;

    whatsappMsgPreview.innerText = message;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customerNumber}?text=${encodedMessage}`;
    whatsappSendLink.href = whatsappUrl;
    whatsappReminderPopup.classList.add('active');
    console.log("[DEBUG] WhatsApp reminder shown.");
    // Reset form for NEW orders AFTER showing reminder
    if (!isEditMode) { resetNewOrderForm(); }
}
// --- End of Updated Function ---

function closeWhatsAppPopup() { if (whatsappReminderPopup) whatsappReminderPopup.classList.remove('active'); }

console.log("new_order.js script loaded (Client-Side Filtering + Save Fix + Debug Logs + Updated WhatsApp Template + Suggestion Box Fix v2 + ID Generation Logic)."); // Updated log