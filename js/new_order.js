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

// --- Utility to Hide Suggestion Box ---
function hideSuggestionBox(box) {
    // Delay hiding slightly to allow click events on suggestions to register
    setTimeout(() => {
        if (box) {
            // Check if the input associated with the box still has focus
            let associatedInput;
            if (box === customerSuggestionsNameBox) associatedInput = customerNameInput;
            else if (box === customerSuggestionsWhatsAppBox) associatedInput = customerWhatsAppInput;
            else if (box === productSuggestionsBox) associatedInput = productNameInput;

            if (document.activeElement !== associatedInput) {
                 box.classList.remove('active');
                 box.style.display = 'none';
            }
        }
    }, 150); // 150ms delay
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
        if(manualOrderIdInput) manualOrderIdInput.readOnly = true;
        loadOrderForEdit(orderIdToEdit);
        handleStatusCheckboxes(true);
    } else {
        isEditMode = false;
        console.log("[DEBUG] Add Mode Initializing.");
        if(headerText) headerText.textContent = "New Order"; else if(formHeader) formHeader.textContent = "New Order";
        if(saveButtonText) saveButtonText.textContent = "Save Order";
        if(manualOrderIdInput) manualOrderIdInput.readOnly = false;
        const orderDateInput = document.getElementById('order_date');
        if (orderDateInput && !orderDateInput.value) { orderDateInput.value = new Date().toISOString().split('T')[0]; }
        handleStatusCheckboxes(false);
        renderProductList();
        resetCustomerSelection();
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
            customerAddressInput.readOnly = true; customerContactInput.readOnly = true; // Lock after load

            displayOrderIdInput.value = data.orderId || docId;
            manualOrderIdInput.value = data.orderId || '';
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
    orderStatusCheckboxes.forEach(checkbox => { if (checkbox.value === defaultStatus) defaultCheckbox = checkbox; checkbox.disabled = !isEditing; checkbox.closest('label').classList.toggle('disabled', !isEditing); checkbox.removeEventListener('change', handleStatusChange); checkbox.addEventListener('change', handleStatusChange); });
    if (!isEditing && defaultCheckbox) { defaultCheckbox.checked = true; }
    // No need to remove 'disabled' class from label here, CSS handles :has(:disabled)
}
function handleStatusChange(event) { const changedCheckbox = event.target; if (changedCheckbox.checked) { orderStatusCheckboxes.forEach(otherCb => { if (otherCb !== changedCheckbox) otherCb.checked = false; }); } }

// --- Autocomplete V2: Client-Side Filtering ---

// --- Customer Autocomplete ---
let customerSearchTimeout;
function handleCustomerInput(event, type) {
    const searchTerm = event.target.value.trim();
    const suggestionBox = type === 'name' ? customerSuggestionsNameBox : customerSuggestionsWhatsAppBox;
    if (!suggestionBox) return;
    // Don't reset selection immediately on input, only if user types something new after selection
    // resetCustomerSelection(); // Maybe remove this automatic reset

    // Hide suggestion box if search term is too short
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
     // --- JS Change: Show/Hide Container ---
     if (!box) return;
     if (suggestions.length === 0) {
         // box.innerHTML = `<ul><li>No results matching '${term}'</li></ul>`; // Don't show 'no results' like this
         box.classList.remove('active'); // Hide container
         box.style.display = 'none';
         return;
     }
     // --- End JS Change ---
    const ul = document.createElement('ul');
    suggestions.forEach(cust => {
        const li = document.createElement('li'); const dName = `${cust.fullName} (${cust.whatsappNo})`;
        try { li.innerHTML = dName.replace(new RegExp(`(${term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'), '<strong>$1</strong>'); } catch { li.textContent = dName; }
        li.dataset.customer = JSON.stringify(cust);
        li.addEventListener('mousedown', (e) => { // Use mousedown to register before blur
            e.preventDefault(); // Prevent input blur
            fillCustomerData(cust);
            // --- JS Change: Hide box after selection ---
            hideSuggestionBox(box);
            // --- End JS Change ---
        });
        ul.appendChild(li);
    });
    box.innerHTML = ''; // Clear first
    box.appendChild(ul);
    // --- JS Change: Show container ---
    box.classList.add('active');
    box.style.display = 'block';
    // --- End JS Change ---
}
function fillCustomerData(customer) {
    if (!customer) { resetCustomerSelection(); return; }
    console.log("[DEBUG] Filling customer data:", customer);
    customerNameInput.value = customer.fullName || ''; customerWhatsAppInput.value = customer.whatsappNo || '';
    customerAddressInput.value = customer.billingAddress || customer.address || ''; customerContactInput.value = customer.contactNo || '';
    selectedCustomerId = customer.id; if(selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId; // Store ID
    // --- JS Change: Explicitly Hide Boxes ---
    hideSuggestionBox(customerSuggestionsNameBox);
    hideSuggestionBox(customerSuggestionsWhatsAppBox);
    // --- End JS Change ---
    customerAddressInput.readOnly = true; customerContactInput.readOnly = true; // Make readonly
}
function resetCustomerSelection() {
     selectedCustomerId = null; if(selectedCustomerIdInput) selectedCustomerIdInput.value = '';
     // Don't clear inputs here automatically, user might just be typing
     // customerAddressInput.value = ''; customerContactInput.value = '';
     customerAddressInput.readOnly = false; customerContactInput.readOnly = false; // Make editable again
     console.log("[DEBUG] Customer selection reset (fields editable).");
}

// --- Product Autocomplete ---
let productSearchTimeout;
function handleProductInput(event) {
    const searchTerm = event.target.value.trim();
    if (!productSuggestionsBox) return;
    productNameInput.readOnly = false; // Ensure editable

    // --- JS Change: Hide if term too short ---
    if (searchTerm.length < 2) {
        clearTimeout(productSearchTimeout);
        hideSuggestionBox(productSuggestionsBox); // Use function to hide
        return;
    }
    // --- End JS Change ---

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
     // --- JS Change: Show/Hide Container ---
     if (!box) return;
     if (suggestions.length === 0) {
         box.classList.remove('active'); // Hide container
         box.style.display = 'none';
         return;
     }
     // --- End JS Change ---
    const ul = document.createElement('ul');
    suggestions.forEach(prod => {
        const li = document.createElement('li');
        try { li.innerHTML = prod.name.replace(new RegExp(`(${term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'), '<strong>$1</strong>'); } catch { li.textContent = prod.name; }
        li.dataset.name = prod.name; // Store printName
        // --- JS Change: Update click listener ---
        li.addEventListener('mousedown', (e) => { // Use mousedown to register before blur
            e.preventDefault(); // Prevent input blur
            productNameInput.value = prod.name;
            hideSuggestionBox(box); // Hide box on click
            quantityInput.focus();
        });
        // --- End JS Change ---
        ul.appendChild(li);
    });
    box.innerHTML = ''; // Clear first
    box.appendChild(ul);
    // --- JS Change: Show container ---
    box.classList.add('active');
    box.style.display = 'block';
    // --- End JS Change ---
}
// --- End Autocomplete ---

// --- Form Submit Handler ---
async function handleFormSubmit(event) {
    event.preventDefault(); console.log("[DEBUG] Form submission initiated...");
    if (!db || !collection || !addDoc || !doc || !updateDoc || !getDoc ) { alert("Database functions unavailable."); return; }
    if (!saveButton) return; saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    try {
        // Get data
        const formData = new FormData(orderForm);
        // --- Read customer details DIRECTLY from input fields ---
        const customerFullNameFromInput = customerNameInput.value.trim();
        const customerWhatsAppFromInput = customerWhatsAppInput.value.trim();
        const customerAddressFromInput = customerAddressInput.value.trim();
        const customerContactFromInput = customerContactInput.value.trim();
        // --- Use stored selectedCustomerId if available, otherwise maybe check cache? ---
        const customerIdToUse = selectedCustomerId; // Use the ID stored when suggestion was clicked

        // Validate if customer ID was selected
        if (!customerIdToUse && !isEditMode) { // Require selection for new orders
             throw new Error("Please select an existing customer from the suggestions. If the customer is new, add them via Customer Management first.");
        }
        // Construct customerData using input values (or maybe re-fetch using ID for safety?)
        // For now, trust the input values if an ID was selected.
         const customerData = {
             fullName: customerFullNameFromInput,
             whatsappNo: customerWhatsAppFromInput,
             address: customerAddressFromInput, // Use address from input
             contactNo: customerContactFromInput // Use contact from input
         };

        const orderDetails = { manualOrderId: formData.get('manual_order_id')?.trim() || '', orderDate: formData.get('order_date') || '', deliveryDate: formData.get('delivery_date') || '', urgent: formData.get('urgent') || 'No', remarks: formData.get('remarks')?.trim() || '' };
        const statusCheckbox = orderForm.querySelector('input[name="order_status"]:checked'); const selectedStatus = statusCheckbox ? statusCheckbox.value : (isEditMode ? null : 'Order Received');

        // ** Validation ** (Keep existing validations)
        if (!customerData.fullName) { throw new Error("Full Name is required."); }
        if (!customerData.whatsappNo) throw new Error("WhatsApp No required.");
        if (addedProducts.length === 0) throw new Error("Add at least one product.");
        if (!orderDetails.orderDate) throw new Error("Order Date required.");
        if (!selectedStatus && isEditMode) throw new Error("Select order status for update."); // Status needed for update too


        // Determine Order ID
        let orderIdToUse; const existingSystemId = displayOrderIdInput.value;
        if (isEditMode) { orderIdToUse = existingSystemId || orderIdToEdit; } // Use displayed ID or the edit ID
        else { orderIdToUse = orderDetails.manualOrderId || Date.now().toString(); } // Use manual or generate

        // Prepare Payload
        const orderDataPayload = {
            orderId: orderIdToUse,
            customerId: customerIdToUse || null, // Store ID if selected
            customerDetails: customerData, // Store details captured from input
            orderDate: orderDetails.orderDate,
            deliveryDate: orderDetails.deliveryDate,
            urgent: orderDetails.urgent,
            remarks: orderDetails.remarks,
            status: selectedStatus || 'Order Received', // Default status if somehow null
            products: addedProducts,
            updatedAt: new Date() // Use JS Date for consistency or Firestore serverTimestamp
            // createdAt: isEditMode ? undefined : new Date() // Add createdAt only for new orders
        };

        // Save/Update
        let orderDocRefPath;
        if (isEditMode) {
            if (!orderIdToEdit) throw new Error("Missing Firestore Document ID for update.");
            const orderRef = doc(db, "orders", orderIdToEdit);
            // Remove createdAt if it exists in payload for updates
            delete orderDataPayload.createdAt;
            await updateDoc(orderRef, orderDataPayload);
            orderDocRefPath = orderRef.path;
            console.log("[DEBUG] Order updated:", orderIdToEdit);
            alert('Order updated successfully!');
        } else {
            orderDataPayload.createdAt = new Date(); // Add createdAt for new orders
            const newOrderRef = await addDoc(collection(db, "orders"), orderDataPayload);
            orderDocRefPath = newOrderRef.path;
            console.log("[DEBUG] New order saved:", newOrderRef.id);
            alert('New order saved successfully!');
            displayOrderIdInput.value = orderIdToUse; // Show the used ID
        }

        // Post-save actions (Consider error handling for daily report)
        // await saveToDailyReport(orderDataPayload, orderDocRefPath);

        // Show WhatsApp reminder (only if WhatsApp number exists)
        if (customerData.whatsappNo) {
            showWhatsAppReminder(customerData, orderIdToUse, orderDetails.deliveryDate);
        } else {
            console.warn("[DEBUG] WhatsApp number missing, skipping reminder.");
            // Optionally reset form only if no reminder shown
             if (!isEditMode) { resetNewOrderForm(); }
        }

        // Reset form only for NEW orders AFTER showing reminder (or skipping it)
        // if (!isEditMode) { resetNewOrderForm(); } // Moved this logic inside whatsapp check

    } catch (error) {
        console.error("Error saving/updating order:", error);
        alert("Error: " + error.message);
    } finally {
        saveButton.disabled = false;
        const btnTxt = isEditMode ? "Update Order" : "Save Order";
        // Ensure span exists before setting textContent
        if (saveButtonText) {
             saveButtonText.textContent = btnTxt;
        } else {
            saveButton.innerHTML = `<i class="fas fa-save"></i> ${btnTxt}`; // Fallback if span is missing
        }
    }
}


// --- Reset Form ---
function resetNewOrderForm() {
     console.log("[DEBUG] Resetting form.");
     resetCustomerSelection(); // Make fields editable
     customerNameInput.value = '';
     customerWhatsAppInput.value = '';
     customerAddressInput.value = '';
     customerContactInput.value = '';
     manualOrderIdInput.value = '';
     displayOrderIdInput.value = '';
     orderForm.delivery_date.value = '';
     orderForm.remarks.value = '';
     addedProducts = [];
     renderProductList();
     handleStatusCheckboxes(false); // Reset status to default for new order
     const urgentNoRadio = orderForm.querySelector('input[name="urgent"][value="No"]');
     if (urgentNoRadio) urgentNoRadio.checked = true;
     const orderDateInput = document.getElementById('order_date');
     if (orderDateInput) orderDateInput.value = new Date().toISOString().split('T')[0];
     // Hide suggestion boxes
     hideSuggestionBox(customerSuggestionsNameBox);
     hideSuggestionBox(customerSuggestionsWhatsAppBox);
     hideSuggestionBox(productSuggestionsBox);
}


// --- Post-Save Functions ---
async function saveToDailyReport(orderData, orderPath) { console.log(`[DEBUG] Placeholder: Saving to daily_reports (Path: ${orderPath})`, orderData); try { /* ... */ console.log("[DEBUG] Placeholder: Called saveToDailyReport."); } catch (error) { console.error("[DEBUG] Placeholder: Error saving to daily_reports:", error); } }

// --- UPDATED WhatsApp Reminder Function ---
function showWhatsAppReminder(customer, orderId, deliveryDate) {
    // Added checks for elements
    if (!whatsappReminderPopup || !whatsappMsgPreview || !whatsappSendLink) {
        console.error("[DEBUG] WhatsApp popup elements missing.");
        if (!isEditMode) { resetNewOrderForm(); } // Reset form even if popup fails
        return;
    }
    const customerName = customer.fullName || 'Customer';
    const customerNumber = customer.whatsappNo?.replace(/[^0-9]/g, '');
    // Check moved inside, reset form if number missing
    if (!customerNumber) {
        console.warn("[DEBUG] WhatsApp No missing, skipping reminder.");
        if (!isEditMode) { resetNewOrderForm(); } // Reset form if no reminder shown
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

console.log("new_order.js script loaded (Client-Side Filtering + Save Fix + Debug Logs + Updated WhatsApp Template + Suggestion Box Fix)."); // Updated log