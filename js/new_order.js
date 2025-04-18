[Filename: new_order.js]
// js/new_order.js

// Firestore functions (Keep same as your original)
const { db, collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, limit, orderBy } = window;

// --- Global Variables (Keep same as your original) ---
let addedProducts = [];
let isEditMode = false;
let orderIdToEdit = null; // Firestore document ID for editing
let selectedCustomerId = null;
let productCache = [];
let customerCache = [];
let productFetchPromise = null;
let customerFetchPromise = null;

// --- DOM Element References (Add orderStatusSelect, remove checkboxes) ---
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
const orderStatusSelect = document.getElementById('order_status'); // *** Reference to the status SELECT element ***
// const orderStatusCheckboxes = document.querySelectorAll('input[name="order_status"]'); // *** REMOVED Checkbox ref ***
// const orderStatusGroup = document.getElementById('order-status-group'); // *** REMOVED Checkbox group ref ***
const whatsappReminderPopup = document.getElementById('whatsapp-reminder-popup');
const whatsappMsgPreview = document.getElementById('whatsapp-message-preview');
const whatsappSendLink = document.getElementById('whatsapp-send-link');
const popupCloseBtn = document.getElementById('popup-close-btn');


// --- Initialization (Keep same structure, call updated initializeForm) ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DEBUG] New Order DOM Loaded. Initializing...");
    waitForDbConnection(initializeForm); // Call initializeForm after DB ready
    // Event Listeners (Keep same as your original, ensure IDs match)
    if (orderForm) orderForm.addEventListener('submit', handleFormSubmit);
    if (addProductBtn) addProductBtn.addEventListener('click', handleAddProduct);
    if (productListContainer) productListContainer.addEventListener('click', handleDeleteProduct);
    if (customerNameInput) customerNameInput.addEventListener('input', (e) => handleCustomerInput(e, 'name'));
    if (customerWhatsAppInput) customerWhatsAppInput.addEventListener('input', (e) => handleCustomerInput(e, 'whatsapp'));
    if (productNameInput) productNameInput.addEventListener('input', handleProductInput);
    if (popupCloseBtn) popupCloseBtn.addEventListener('click', closeWhatsAppPopup);
    if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (event) => { if (event.target === whatsappReminderPopup) closeWhatsAppPopup(); });
});

// --- DB Connection Wait (Keep same as your original) ---
function waitForDbConnection(callback) {
    // Check if db is already available
    if (window.db) {
        console.log("[DEBUG] DB connection confirmed immediately.");
        callback();
    } else {
        // Wait for db to become available
        let attempts = 0;
        const maxAttempts = 20; // Wait for max 5 seconds (20 * 250ms)
        const intervalId = setInterval(() => {
            attempts++;
            if (window.db) {
                clearInterval(intervalId);
                console.log("[DEBUG] DB connection confirmed after check.");
                callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(intervalId);
                console.error("[DEBUG] DB connection timeout.");
                alert("Database connection failed. Please refresh the page.");
            }
        }, 250);
    }
}

// --- Initialize Form (UPDATED for Dropdown) ---
function initializeForm() {
    const urlParams = new URLSearchParams(window.location.search);
    orderIdToEdit = urlParams.get('editOrderId'); // Get Firestore Doc ID from URL

    if (orderIdToEdit) {
        // --- EDIT MODE ---
        isEditMode = true;
        console.log("[DEBUG] Edit Mode Initializing. Order Firestore ID:", orderIdToEdit);
        if(headerText) headerText.textContent = "Edit Order";
        if(saveButtonText) saveButtonText.textContent = "Update Order";
        if(hiddenEditOrderIdInput) hiddenEditOrderIdInput.value = orderIdToEdit;
        if(manualOrderIdInput) manualOrderIdInput.readOnly = true; // Usually lock manual ID in edit

        loadOrderForEdit(orderIdToEdit); // Load existing data

        // Enable status dropdown in edit mode
        if(orderStatusSelect) {
             orderStatusSelect.disabled = false;
        } else {
             console.warn("Status select element not found during init!");
        }

    } else {
        // --- ADD MODE ---
        isEditMode = false;
        console.log("[DEBUG] Add Mode Initializing.");
        if(headerText) headerText.textContent = "New Order";
        if(saveButtonText) saveButtonText.textContent = "Save Order";
        if(manualOrderIdInput) manualOrderIdInput.readOnly = false;

        // Set default order date
        const orderDateInput = document.getElementById('order_date');
        if (orderDateInput && !orderDateInput.value) {
            orderDateInput.value = new Date().toISOString().split('T')[0];
        }

        // Set default status and disable dropdown for new orders
        if(orderStatusSelect) {
            orderStatusSelect.value = "Order Received";
            orderStatusSelect.disabled = true; // Status defaults to 'Order Received' on save
        } else {
             console.warn("Status select element not found during init!");
        }

        renderProductList(); // Render empty list initially
        resetCustomerSelection(); // Reset customer fields
    }
}

// --- Load Order For Edit (UPDATED for Dropdown) ---
async function loadOrderForEdit(docId) {
    console.log(`[DEBUG] Loading order data for edit from Firestore: ${docId}`);
    if (!orderStatusSelect) {
        console.error("Status select dropdown not found!");
        // Handle error appropriately, maybe alert user or disable form
    }
    try {
        const orderRef = doc(db, "orders", docId);
        const docSnap = await getDoc(orderRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("[DEBUG] Order data for edit:", data);

            // Fill customer details (Same as original)
            customerNameInput.value = data.customerDetails?.fullName || '';
            customerAddressInput.value = data.customerDetails?.address || '';
            customerWhatsAppInput.value = data.customerDetails?.whatsappNo || '';
            customerContactInput.value = data.customerDetails?.contactNo || '';
            selectedCustomerId = data.customerId || null;
            if (selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId;
            customerAddressInput.readOnly = true; customerContactInput.readOnly = true;

            // Fill order details (Same as original)
            displayOrderIdInput.value = data.orderId || docId;
            manualOrderIdInput.value = data.orderId || '';
            orderForm.order_date.value = data.orderDate || '';
            orderForm.delivery_date.value = data.deliveryDate || '';
            orderForm.remarks.value = data.remarks || '';
            const urgentVal = data.urgent || 'No';
            const urgentRadio = orderForm.querySelector(`input[name="urgent"][value="${urgentVal}"]`);
            if (urgentRadio) urgentRadio.checked = true;

            // *** Set Status Dropdown Value ***
            if (orderStatusSelect) {
                orderStatusSelect.value = data.status || 'Order Received'; // Set to stored status or default
                orderStatusSelect.disabled = false; // Ensure enabled
            }

            // Fill product list (Same as original)
            addedProducts = data.products || [];
            renderProductList();
        } else {
            console.error("[DEBUG] Order document not found for editing!");
            alert("Error: Cannot find the order to edit."); window.location.href = 'order_history.html';
        }
    } catch (error) {
        console.error("[DEBUG] Error loading order for edit:", error);
        alert("Error loading order data: " + error.message); window.location.href = 'order_history.html';
    }
}

// --- Product Handling (Keep SAME as your original) ---
function handleAddProduct() {
     const name = productNameInput.value.trim();
    const quantity = quantityInput.value.trim();
    if (!name) { alert("Please select or enter a product name."); productNameInput.focus(); return; }
    if (!quantity || isNaN(quantity) || Number(quantity) <= 0) { alert("Please enter a valid quantity."); quantityInput.focus(); return; }
    addedProducts.push({ name: name, quantity: Number(quantity) });
    console.log("[DEBUG] Product added:", addedProducts);
    renderProductList();
    productNameInput.value = ''; quantityInput.value = ''; productNameInput.focus();
    if (productSuggestionsBox) productSuggestionsBox.innerHTML = '';
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


// --- Autocomplete Functions (Keep EXACTLY SAME as your original) ---
// --- Customer Autocomplete ---
let customerSearchTimeout;
function handleCustomerInput(event, type) {
    const searchTerm = event.target.value.trim();
    const suggestionBox = type === 'name' ? customerSuggestionsNameBox : customerSuggestionsWhatsAppBox;
    if (!suggestionBox) return;
    // Reset linked fields ONLY IF the input causing the change is now empty or if a selection wasn't made previously
    // Important: Only reset if ID is missing or input cleared. Don't reset if user is just typing more.
    if (!selectedCustomerId || searchTerm === '') {
        resetCustomerSelection();
    }
    suggestionBox.innerHTML = '';
    if (searchTerm.length < 2) { clearTimeout(customerSearchTimeout); return; }
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
    const filtered = customerCache.filter(c => { const val = c[field] || ''; return val.toLowerCase().includes(lowerTerm); }).slice(0, 7); // Limit suggestions
    console.log(`[DEBUG] Found ${filtered.length} customer suggestions.`);
    renderCustomerSuggestions(filtered, term, box);
}
function renderCustomerSuggestions(suggestions, term, box) {
     if (!box) return; // Ensure box exists
     if (suggestions.length === 0) { box.innerHTML = `<ul><li>No results matching '${term}'</li></ul>`; return; }
    const ul = document.createElement('ul');
    suggestions.forEach(cust => {
        const li = document.createElement('li');
        const displayName = `${cust.fullName} (${cust.whatsappNo})`;
        try { // Highlight term
            li.innerHTML = displayName.replace(new RegExp(`(${term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'), '<strong>$1</strong>');
        } catch { li.textContent = displayName; } // Fallback
        li.dataset.customer = JSON.stringify(cust); // Store data
        li.addEventListener('click', () => {
             fillCustomerData(cust); // Fill form on click
             box.innerHTML = ''; // Clear suggestions
        });
        ul.appendChild(li);
    });
    box.innerHTML = ''; // Clear previous suggestions
    box.appendChild(ul); // Add new list
}
function fillCustomerData(customer) {
    if (!customer) { resetCustomerSelection(); return; }
    console.log("[DEBUG] Filling customer data:", customer);
    customerNameInput.value = customer.fullName || '';
    customerWhatsAppInput.value = customer.whatsappNo || '';
    customerAddressInput.value = customer.billingAddress || customer.address || ''; // Prefer billing address if available
    customerContactInput.value = customer.contactNo || '';
    selectedCustomerId = customer.id; // Store the selected customer's Firestore ID
    if(selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId; // Store ID in hidden input

    // Clear suggestion boxes after selection
    if (customerSuggestionsNameBox) customerSuggestionsNameBox.innerHTML = '';
    if (customerSuggestionsWhatsAppBox) customerSuggestionsWhatsAppBox.innerHTML = '';

    // Make address/contact read-only *after* selection
    customerAddressInput.readOnly = true;
    customerContactInput.readOnly = true;
}
function resetCustomerSelection() {
     selectedCustomerId = null;
     if(selectedCustomerIdInput) selectedCustomerIdInput.value = '';
     // Make address/contact editable again when selection is reset
     customerAddressInput.readOnly = false;
     customerContactInput.readOnly = false;
     // Clear the fields potentially filled by previous selection *if needed*
     customerAddressInput.value = '';
     customerContactInput.value = '';
     // IMPORTANT: Do NOT clear customerNameInput or customerWhatsAppInput here
     // as the user might be typing a new name/number after deselecting.
     console.log("[DEBUG] Customer selection reset (ID cleared, fields unlocked).");
}

// --- Product Autocomplete (Keep EXACTLY SAME as your original) ---
let productSearchTimeout;
function handleProductInput(event) {
    const searchTerm = event.target.value.trim();
    if (!productSuggestionsBox) return;
    productNameInput.readOnly = false; // Ensure it's editable
    productSuggestionsBox.innerHTML = '';
    if (searchTerm.length < 2) { clearTimeout(productSearchTimeout); return; }
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
        // ** Fetching based on printName, Index on printName (Asc) REQUIRED **
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
    const filtered = productCache.filter(p => (p.name || '').toLowerCase().includes(lowerTerm)).slice(0, 10); // Limit suggestions
    console.log(`[DEBUG] Found ${filtered.length} product suggestions.`);
    renderProductSuggestions(filtered, term, box);
}
function renderProductSuggestions(suggestions, term, box) {
     if (!box) return; // Ensure box exists
     if (suggestions.length === 0) { box.innerHTML = `<ul><li>No products found matching '${term}'</li></ul>`; return; }
    const ul = document.createElement('ul');
    suggestions.forEach(prod => {
        const li = document.createElement('li');
        try { // Highlight term
             li.innerHTML = prod.name.replace(new RegExp(`(${term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'), '<strong>$1</strong>');
         } catch { li.textContent = prod.name; } // Fallback
        li.dataset.name = prod.name; // Store printName in dataset if needed later
        li.addEventListener('click', () => {
            productNameInput.value = prod.name; // Set input value
            box.innerHTML = ''; // Clear suggestions
            quantityInput.focus(); // Move focus to quantity
        });
        ul.appendChild(li);
    });
    box.innerHTML = ''; // Clear previous suggestions
    box.appendChild(ul); // Add new list
}
// --- End Autocomplete ---


// --- Form Submit Handler (UPDATED for Dropdown & Conditional WhatsApp) ---
async function handleFormSubmit(event) {
    event.preventDefault();
    console.log("[DEBUG] Form submission initiated...");
    if (!db || !collection || !addDoc || !doc || !updateDoc || !getDoc ) { alert("Database functions unavailable."); return; }
    if (!saveButton || !orderStatusSelect) {
        console.error("Save button or Status select not found!");
        return;
    }
    saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        // Get data (Keep same as original)
        const formData = new FormData(orderForm);
        const customerFullNameFromInput = customerNameInput.value.trim();
        console.log("[DEBUG] Reading Full Name directly from input:", customerFullNameFromInput);

        const customerData = {
            fullName: customerFullNameFromInput,
            address: customerAddressInput.value.trim() || '',
            whatsappNo: customerWhatsAppInput.value.trim() || '',
            contactNo: customerContactInput.value.trim() || ''
        };

        const orderDetails = {
            manualOrderId: formData.get('manual_order_id')?.trim() || '',
            orderDate: formData.get('order_date') || '',
            deliveryDate: formData.get('delivery_date') || '',
            urgent: formData.get('urgent') || 'No',
            remarks: formData.get('remarks')?.trim() || ''
        };

        // *** Get Status from Dropdown ***
        let selectedStatus = orderStatusSelect.value;
        // For new orders, status is fixed initially unless logic changes
        if (!isEditMode) {
             selectedStatus = 'Order Received'; // Force status for new orders on save
        }


        // ** Validation (Keep same as original, ensure status check works) **
        if (!selectedCustomerId) {
            throw new Error("Please select an existing customer from the suggestions.");
        }
        if (!customerData.fullName) {
            console.error("[DEBUG] Validation failed: Full Name value is empty.");
            throw new Error("Full Name is required. Please select the customer again.");
        }
        if (!customerData.whatsappNo) throw new Error("WhatsApp No required.");
        if (addedProducts.length === 0) throw new Error("Add at least one product.");
        if (!orderDetails.orderDate) throw new Error("Order Date required.");
        if (!selectedStatus) throw new Error("Select order status."); // Should always have a value now

        // Use selected Customer ID (Keep same as original)
        const customerIdToUse = selectedCustomerId;

        // Determine Order ID (Keep same logic as original)
        let orderIdToUse;
        if (isEditMode && orderIdToEdit) {
             orderIdToUse = manualOrderIdInput.value.trim() || displayOrderIdInput.value || orderIdToEdit;
             console.log("[DEBUG] Using Order ID for update:", orderIdToUse, " (Firestore Doc ID:", orderIdToEdit, ")");
        } else {
             orderIdToUse = orderDetails.manualOrderId || Date.now().toString();
             console.log("[DEBUG] Using Order ID for new order:", orderIdToUse, " (Manual:", orderDetails.manualOrderId, ")");
        }


        // Prepare Payload (Use selectedStatus from dropdown)
        const orderDataPayload = {
            orderId: orderIdToUse,
            customerId: customerIdToUse,
            customerDetails: customerData,
            orderDate: orderDetails.orderDate,
            deliveryDate: orderDetails.deliveryDate,
            urgent: orderDetails.urgent,
            remarks: orderDetails.remarks,
            status: selectedStatus, // *** Get status from dropdown value ***
            products: addedProducts,
            updatedAt: new Date()
        };

        // Save/Update (Keep same logic as original)
        let orderDocRefPath;
        if (isEditMode && orderIdToEdit) {
            if (!orderIdToEdit) throw new Error("Missing Firestore document ID for update.");
            const orderRef = doc(db, "orders", orderIdToEdit);
            await updateDoc(orderRef, orderDataPayload);
            orderDocRefPath = orderRef.path;
            console.log("[DEBUG] Order updated:", orderIdToEdit);
            alert('Order updated successfully!');
        }
        else { // New order
            orderDataPayload.createdAt = new Date(); // Add createdAt timestamp
            orderDataPayload.status = "Order Received"; // Explicitly set status for new save
            const newOrderRef = await addDoc(collection(db, "orders"), orderDataPayload);
            orderDocRefPath = newOrderRef.path;
            displayOrderIdInput.value = orderIdToUse; // Update display fields after save
            manualOrderIdInput.value = orderIdToUse;
            // orderIdToEdit = newOrderRef.id; // Store Firestore ID if needed immediately
            console.log("[DEBUG] New order saved:", newOrderRef.id, "Assigned Order ID:", orderIdToUse);
            alert('New order saved successfully!');
        }

        // --- Post-save actions ---
        // await saveToDailyReport(orderDataPayload, orderDocRefPath); // Your optional function

        // *** MODIFIED: Show WhatsApp popup only for specific statuses ***
        const statusesForPopup = ['Order Received', 'Verification', 'Delivered'];
        const finalStatus = orderDataPayload.status; // Use status from payload

        if (finalStatus && statusesForPopup.includes(finalStatus)) {
            console.log(`[DEBUG] Status '${finalStatus}' triggers WhatsApp popup.`);
            // Pass the final status to the reminder function
            showWhatsAppReminder(customerData, orderIdToUse, orderDetails.deliveryDate, finalStatus);
        } else {
             console.log(`[DEBUG] Status '${finalStatus}' does not trigger WhatsApp popup.`);
             // If not showing popup, reset form immediately for new orders
             if (!isEditMode) {
                  resetNewOrderForm(); // Call reset function
             } else {
                  // Optional: Redirect after edit if no popup shown?
                  // window.location.href = 'order_history.html';
             }
        }
        // Reset form for new orders is handled within closeWhatsAppPopup or above if no popup shown.

    } catch (error) {
        console.error("Error saving/updating order:", error);
        alert("Error: " + error.message);
    } finally {
        saveButton.disabled = false;
        const btnTxt = isEditMode ? "Update Order" : "Save Order";
        if (saveButtonText) saveButtonText.textContent = btnTxt;
        else if (saveButton) saveButton.innerHTML = `<i class="fas fa-save"></i> <span>${btnTxt}</span>`;
    }
}

// --- Reset Form (UPDATED for Dropdown) ---
function resetNewOrderForm() {
    console.log("[DEBUG] Resetting form for new order entry.");
    orderForm.reset(); // Reset all standard form fields (like text inputs, radio buttons, textareas)

    // Explicitly reset parts not handled by form.reset() or needing specific values
    resetCustomerSelection(); // Clear customer ID, unlock fields, clear address/contact
    addedProducts = []; // Clear product array
    renderProductList(); // Update product list display (show empty message)

    // *** Reset Status Dropdown ***
    if(orderStatusSelect) {
        orderStatusSelect.value = "Order Received"; // Set default value
        orderStatusSelect.disabled = true; // Disable for new orders
    } else {
        console.warn("Status select element not found during reset!");
    }

    // Explicitly set date to today after reset
    const orderDateInput = document.getElementById('order_date');
    if (orderDateInput) orderDateInput.value = new Date().toISOString().split('T')[0];

    // Clear any generated/displayed IDs
    displayOrderIdInput.value = '';
    manualOrderIdInput.value = ''; // Ensure manual ID is clear
    if(hiddenEditOrderIdInput) hiddenEditOrderIdInput.value = ''; // Clear hidden Firestore ID
    if(selectedCustomerIdInput) selectedCustomerIdInput.value = ''; // Clear hidden Customer ID

    // Reset edit mode flag
    isEditMode = false;
    orderIdToEdit = null;

    // Reset header and button text
    if(headerText) headerText.textContent = "New Order";
    if(saveButtonText) saveButtonText.textContent = "Save Order";
    manualOrderIdInput.readOnly = false; // Ensure manual ID is editable

    // Optional: Focus on the first input field
    if (customerNameInput) customerNameInput.focus();

    console.log("[DEBUG] Form reset complete.");
}

// --- Post-Save Functions ---
// async function saveToDailyReport(orderData, orderPath) { ... } // Keep your original if you have one

// --- WhatsApp Reminder Function (UPDATED to accept status) ---
function showWhatsAppReminder(customer, orderId, deliveryDate, status) {
    if (!whatsappReminderPopup || !whatsappMsgPreview || !whatsappSendLink) {
        console.error("[DEBUG] WhatsApp popup elements missing.");
        return;
    }

    const customerName = customer.fullName ? customer.fullName.trim() : 'Customer';
    const customerNumber = customer.whatsappNo?.replace(/[^0-9]/g, '');

    if (!customerNumber) {
        console.warn("[DEBUG] WhatsApp No missing or invalid for customer:", customerName);
        return; // Don't show popup if no number
    }

    let message = '';
    const signature = "\n\n*Madhav Multy Print*\nMob. 9549116541";

    switch (status) {
        case 'Order Received':
            message = `नमस्ते *${customerName}*,\n\nआपका ऑर्डर (ID: *${orderId}*) हमें सफलतापूर्वक मिल गया है।`;
            if (deliveryDate) {
                try {
                     const dateObj = new Date(deliveryDate + 'T00:00:00'); // Treat date as local
                     const formattedDate = dateObj.toLocaleDateString('en-GB'); // Format dd/mm/yyyy
                     message += `\nअनुमानित डिलीवरी दिनांक *${formattedDate}* तक है।`;
                } catch (e) { message += `\nअनुमानित डिलीवरी दिनांक *${deliveryDate}* तक है।`; } // Fallback
            }
            message += `\n\nसेवा का मौका देने के लिए धन्यवाद!`;
            break;
        case 'Verification':
            message = `नमस्ते *${customerName}*,\n\nआपके ऑर्डर (ID: *${orderId}*) का डिज़ाइन वेरिफिकेशन के लिए तैयार है।`;
            message += `\nकृपया डिज़ाइन को ध्यानपूर्वक चेक करें। *OK* का जवाब देने के बाद कोई बदलाव संभव नहीं होगा।`;
            message += `\n\nधन्यवाद!`;
            break;
        case 'Delivered':
            message = `नमस्ते *${customerName}*,\n\nआपका ऑर्डर (ID: *${orderId}*) सफलतापूर्वक डिलीवर कर दिया गया है।`;
            message += `\n\nहमें सेवा का अवसर देने के लिए धन्यवाद!`;
            break;
        default:
            console.log(`[DEBUG] WhatsApp reminder called for status not needing popup: ${status}`);
            return; // Don't show popup for other statuses
    }
    message += signature;

    whatsappMsgPreview.innerText = message;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customerNumber}?text=${encodedMessage}`;
    whatsappSendLink.href = whatsappUrl;
    whatsappReminderPopup.classList.add('active');
    console.log("[DEBUG] WhatsApp reminder shown for status:", status);
}

// --- Close WhatsApp Popup (UPDATED to reset form on close for NEW orders) ---
function closeWhatsAppPopup() {
    if (whatsappReminderPopup) {
        whatsappReminderPopup.classList.remove('active');
    }
    // Reset the form after closing the popup ONLY if it was a new order save
    // Check isEditMode flag which should be false after a successful new save
    if (!isEditMode) {
        console.log("[DEBUG] Resetting form after closing WhatsApp popup for new order.");
        resetNewOrderForm(); // Call the updated reset function
    }
    // Optionally redirect after closing popup for edit mode
    // if (isEditMode) {
    //    window.location.href = 'order_history.html';
    // }
}

// Final log message (optional)
console.log("new_order.js script loaded (Dropdown Status + Conditional WhatsApp + Original Autocomplete).");