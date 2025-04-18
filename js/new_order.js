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
    console.log("New Order DOM Loaded. Initializing...");
    waitForDbConnection(initializeForm);
    // Event Listeners
    if (orderForm) orderForm.addEventListener('submit', handleFormSubmit);
    if (addProductBtn) addProductBtn.addEventListener('click', handleAddProduct);
    if (productListContainer) productListContainer.addEventListener('click', handleDeleteProduct);
    if (customerNameInput) customerNameInput.addEventListener('input', (e) => handleCustomerInput(e, 'name'));
    if (customerWhatsAppInput) customerWhatsAppInput.addEventListener('input', (e) => handleCustomerInput(e, 'whatsapp'));
    if (productNameInput) productNameInput.addEventListener('input', handleProductInput);
    if (popupCloseBtn) popupCloseBtn.addEventListener('click', closeWhatsAppPopup);
    if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (event) => { if (event.target === whatsappReminderPopup) closeWhatsAppPopup(); });
});

// --- DB Connection Wait ---
function waitForDbConnection(callback) {
    if (window.db) { console.log("DB connection confirmed immediately."); callback(); }
    else { let attempts = 0; const maxAttempts = 20; const intervalId = setInterval(() => { attempts++; if (window.db) { clearInterval(intervalId); console.log("DB connection confirmed after check."); callback(); } else if (attempts >= maxAttempts) { clearInterval(intervalId); console.error("DB connection timeout."); alert("Database connection failed."); } }, 250); }
}

// --- Initialize Form ---
function initializeForm() {
    const urlParams = new URLSearchParams(window.location.search);
    orderIdToEdit = urlParams.get('editOrderId');
    if (orderIdToEdit) {
        isEditMode = true;
        console.log("Edit Mode Initializing. Order Firestore ID:", orderIdToEdit);
        if(headerText) headerText.textContent = "Edit Order"; else if(formHeader) formHeader.textContent = "Edit Order";
        if(saveButtonText) saveButtonText.textContent = "Update Order";
        if(hiddenEditOrderIdInput) hiddenEditOrderIdInput.value = orderIdToEdit;
        if(manualOrderIdInput) manualOrderIdInput.readOnly = true;
        loadOrderForEdit(orderIdToEdit);
        handleStatusCheckboxes(true);
    } else {
        isEditMode = false;
        console.log("Add Mode Initializing.");
        if(headerText) headerText.textContent = "New Order"; else if(formHeader) formHeader.textContent = "New Order";
        if(saveButtonText) saveButtonText.textContent = "Save Order";
        if(manualOrderIdInput) manualOrderIdInput.readOnly = false;
        const orderDateInput = document.getElementById('order_date');
        if (orderDateInput && !orderDateInput.value) { orderDateInput.value = new Date().toISOString().split('T')[0]; }
        handleStatusCheckboxes(false);
        renderProductList();
        resetCustomerSelection();
        // Pre-fetch caches in add mode? Optional.
        // getOrFetchCustomerCache();
        // getOrFetchProductCache();
    }
}

// --- Load Order For Edit ---
async function loadOrderForEdit(docId) {
    console.log(`Loading order data for edit from Firestore: ${docId}`);
    try {
        const orderRef = doc(db, "orders", docId);
        const docSnap = await getDoc(orderRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("Order data for edit:", data);
            // Fill form (customer, order details, urgent, status)
            customerNameInput.value = data.customerDetails?.fullName || '';
            customerAddressInput.value = data.customerDetails?.address || '';
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
            console.error("Order document not found for editing!"); alert("Error: Cannot find the order to edit."); window.location.href = 'order_history.html';
        }
    } catch (error) {
        console.error("Error loading order for edit:", error); alert("Error loading order data: " + error.message); window.location.href = 'order_history.html';
    }
}

// --- Product Handling ---
function handleAddProduct() {
     const name = productNameInput.value.trim();
    const quantity = quantityInput.value.trim();
    if (!name) { alert("Please select or enter a product name."); productNameInput.focus(); return; }
    if (!quantity || isNaN(quantity) || Number(quantity) <= 0) { alert("Please enter a valid quantity."); quantityInput.focus(); return; }
    addedProducts.push({ name: name, quantity: Number(quantity) });
    console.log("Product added:", addedProducts);
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
    if (deleteButton) { const indexToDelete = parseInt(deleteButton.dataset.index, 10); if (!isNaN(indexToDelete) && indexToDelete >= 0 && indexToDelete < addedProducts.length) { addedProducts.splice(indexToDelete, 1); console.log("Product deleted:", addedProducts); renderProductList(); } }
}

// --- Status Checkbox Handling ---
function handleStatusCheckboxes(isEditing) {
    const defaultStatus = "Order Received"; let defaultCheckbox = null;
    orderStatusCheckboxes.forEach(checkbox => { if (checkbox.value === defaultStatus) defaultCheckbox = checkbox; checkbox.disabled = !isEditing; checkbox.closest('label').classList.toggle('disabled', !isEditing); checkbox.removeEventListener('change', handleStatusChange); checkbox.addEventListener('change', handleStatusChange); });
    if (!isEditing && defaultCheckbox) { defaultCheckbox.checked = true; /* defaultCheckbox.closest('label').classList.remove('disabled'); */ }
}
function handleStatusChange(event) { const changedCheckbox = event.target; if (changedCheckbox.checked) { orderStatusCheckboxes.forEach(otherCb => { if (otherCb !== changedCheckbox) otherCb.checked = false; }); } }

// --- Autocomplete V2: Client-Side Filtering ---

// --- Customer Autocomplete ---
let customerSearchTimeout;
function handleCustomerInput(event, type) {
    const searchTerm = event.target.value.trim();
    const suggestionBox = type === 'name' ? customerSuggestionsNameBox : customerSuggestionsWhatsAppBox;
    if (!suggestionBox) return; resetCustomerSelection(); suggestionBox.innerHTML = '';
    if (searchTerm.length < 2) { clearTimeout(customerSearchTimeout); return; } // Start at 2 chars
    clearTimeout(customerSearchTimeout);
    customerSearchTimeout = setTimeout(() => {
        console.log(`Filtering customers (${type}): ${searchTerm}`);
        getOrFetchCustomerCache().then(() => { filterAndRenderCustomerSuggestions(searchTerm, type, suggestionBox); }).catch(err => console.error("Error during customer fetch/filter:", err));
    }, 300);
}
async function getOrFetchCustomerCache() {
    if (customerCache.length > 0) return Promise.resolve();
    if (customerFetchPromise) return customerFetchPromise;
    console.log("Fetching initial customer data from Firestore...");
    try {
        if (!db || !collection || !query || !getDocs || !orderBy) { throw new Error("Firestore query functions unavailable for customers."); }
        const customersRef = collection(db, "customers");
        // ** Index on 'fullName' (Asc) is needed for ordering **
        const q = query(customersRef, orderBy("fullName"));
        customerFetchPromise = getDocs(q).then(snapshot => {
            customerCache = [];
            snapshot.forEach(doc => { const d = doc.data(); if (d.fullName && d.whatsappNo) customerCache.push({ id: doc.id, ...d }); });
            console.log(`Workspaceed ${customerCache.length} customers.`);
            customerFetchPromise = null;
        }).catch(err => { console.error("Err fetching customers:", err); customerFetchPromise = null; throw err; });
        return customerFetchPromise;
    } catch (error) { console.error("Err setting up cust fetch:", error); customerFetchPromise = null; return Promise.reject(error); }
}
function filterAndRenderCustomerSuggestions(term, type, box) {
    const lowerTerm = term.toLowerCase();
    const field = type === 'name' ? 'fullName' : 'whatsappNo';
    const filtered = customerCache.filter(c => {
        const val = c[field] || '';
        return val.toLowerCase().includes(lowerTerm);
    }).slice(0, 7);
    renderCustomerSuggestions(filtered, term, box);
}
function renderCustomerSuggestions(suggestions, term, box) {
     if (suggestions.length === 0) { box.innerHTML = `<ul><li>No results matching '${term}'</li></ul>`; return; }
    const ul = document.createElement('ul');
    suggestions.forEach(cust => {
        const li = document.createElement('li'); const dName = `${cust.fullName} (${cust.whatsappNo})`;
        try { li.innerHTML = dName.replace(new RegExp(`(${term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'), '<strong>$1</strong>'); } catch { li.textContent = dName; }
        li.dataset.customer = JSON.stringify(cust);
        li.addEventListener('click', () => { fillCustomerData(cust); box.innerHTML = ''; });
        ul.appendChild(li);
    });
    box.innerHTML = ''; box.appendChild(ul);
}
function fillCustomerData(customer) {
    if (!customer) { resetCustomerSelection(); return; }
    console.log("Filling customer data:", customer);
    customerNameInput.value = customer.fullName || ''; customerWhatsAppInput.value = customer.whatsappNo || '';
    customerAddressInput.value = customer.billingAddress || customer.address || ''; customerContactInput.value = customer.contactNo || '';
    selectedCustomerId = customer.id; if(selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId;
    if (customerSuggestionsNameBox) customerSuggestionsNameBox.innerHTML = ''; if (customerSuggestionsWhatsAppBox) customerSuggestionsWhatsAppBox.innerHTML = '';
    customerAddressInput.readOnly = true; customerContactInput.readOnly = true;
}
function resetCustomerSelection() {
     selectedCustomerId = null; if(selectedCustomerIdInput) selectedCustomerIdInput.value = '';
     customerAddressInput.readOnly = false; customerContactInput.readOnly = false;
     console.log("Customer selection reset.");
}

// --- Product Autocomplete ---
let productSearchTimeout;
function handleProductInput(event) {
    const searchTerm = event.target.value.trim();
    if (!productSuggestionsBox) return; productNameInput.readOnly = false; productSuggestionsBox.innerHTML = '';
    if (searchTerm.length < 2) { clearTimeout(productSearchTimeout); return; }
    clearTimeout(productSearchTimeout);
    productSearchTimeout = setTimeout(() => {
        console.log(`Filtering products: ${searchTerm}`);
        getOrFetchProductCache().then(() => { filterAndRenderProductSuggestions(searchTerm, productSuggestionsBox); }).catch(err => console.error("Error during product fetch/filter:", err));
    }, 300);
}
async function getOrFetchProductCache() {
    if (productCache.length > 0) return Promise.resolve();
    if (productFetchPromise) return productFetchPromise;
    console.log("Fetching initial product data from Firestore...");
    try {
        if (!db || !collection || !query || !getDocs || !orderBy) { throw new Error("Firestore query functions unavailable for products."); }
        const productsRef = collection(db, "products");
        // ** Index on 'printName' (Asc) is REQUIRED for this query **
        const q = query(productsRef, orderBy("printName"));
        productFetchPromise = getDocs(q).then(snapshot => {
            productCache = [];
            snapshot.forEach(doc => { const d = doc.data(); if (d.printName) productCache.push({ id: doc.id, name: d.printName }); }); // Use printName
            console.log(`Workspaceed ${productCache.length} products.`);
            productFetchPromise = null;
        }).catch(err => { console.error("Err fetching products:", err); productFetchPromise = null; throw err; });
        return productFetchPromise;
    } catch (error) { console.error("Err setting up product fetch:", error); productFetchPromise = null; return Promise.reject(error); }
}
function filterAndRenderProductSuggestions(term, box) {
    const lowerTerm = term.toLowerCase();
    // Filter productCache case-insensitively
    const filtered = productCache.filter(p => {
        const name = p.name || ''; // Name comes from printName during fetch
        return name.toLowerCase().includes(lowerTerm);
    }).slice(0, 10); // Limit suggestions
    renderProductSuggestions(filtered, term, box); // Render using original term
}
function renderProductSuggestions(suggestions, term, box) {
     if (suggestions.length === 0) { box.innerHTML = `<ul><li>No products found matching '${term}'</li></ul>`; return; }
    const ul = document.createElement('ul');
    suggestions.forEach(prod => {
        const li = document.createElement('li');
        try { li.innerHTML = prod.name.replace(new RegExp(`(${term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'), '<strong>$1</strong>'); } catch { li.textContent = prod.name; }
        li.dataset.name = prod.name; // Store printName
        li.addEventListener('click', () => { productNameInput.value = prod.name; box.innerHTML = ''; quantityInput.focus(); });
        ul.appendChild(li);
    });
    box.innerHTML = ''; box.appendChild(ul);
}
// --- End Autocomplete ---

// --- Form Submit Handler ---
async function handleFormSubmit(event) {
    event.preventDefault(); console.log("Form submission initiated...");
    if (!db || !collection || !addDoc || !doc || !updateDoc || !getDoc ) { alert("Database functions unavailable."); return; }
    if (!saveButton) return;
    saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    try {
        // Get data and validate (including checking selectedCustomerId)
        const formData = new FormData(orderForm); /* ... */ const customerData = { /*...*/ }; const orderDetails = { /*...*/ };
        const statusCheckbox = orderForm.querySelector('input[name="order_status"]:checked'); const selectedStatus = statusCheckbox ? statusCheckbox.value : (isEditMode ? null : 'Order Received');
        if (!selectedCustomerId) throw new Error("Please select an existing customer.");
        if (!customerData.fullName) throw new Error("Full Name required."); if (!customerData.whatsappNo) throw new Error("WhatsApp No required.");
        if (addedProducts.length === 0) throw new Error("Add at least one product."); if (!orderDetails.orderDate) throw new Error("Order Date required.");
        if (!selectedStatus) throw new Error("Select order status.");

        const customerIdToUse = selectedCustomerId;
        let orderIdToUse; const existingSystemId = displayOrderIdInput.value;
        if (isEditMode) { orderIdToUse = existingSystemId; } else { orderIdToUse = orderDetails.manualOrderId || Date.now().toString(); }

        const orderDataPayload = { /* ... (Build payload with customerData, orderDetails, addedProducts etc...) ... */
            orderId: orderIdToUse, customerId: customerIdToUse, customerDetails: customerData,
            orderDate: orderDetails.orderDate, deliveryDate: orderDetails.deliveryDate, urgent: orderDetails.urgent,
            remarks: orderDetails.remarks, status: selectedStatus, products: addedProducts, updatedAt: new Date()
        };

        // Save/Update
        let orderDocRefPath;
        if (isEditMode) {
            if (!orderIdToEdit) throw new Error("Missing Firestore document ID for update.");
            const orderRef = doc(db, "orders", orderIdToEdit); await updateDoc(orderRef, orderDataPayload); orderDocRefPath = orderRef.path;
            console.log("Order updated:", orderIdToEdit); alert('Order updated successfully!');
        } else {
            orderDataPayload.createdAt = new Date(); const newOrderRef = await addDoc(collection(db, "orders"), orderDataPayload); orderDocRefPath = newOrderRef.path;
            console.log("New order saved:", newOrderRef.id); alert('New order saved successfully!'); displayOrderIdInput.value = orderIdToUse;
        }
        // Post-save actions
        await saveToDailyReport(orderDataPayload, orderDocRefPath);
        showWhatsAppReminder(customerData, orderIdToUse, orderDetails.deliveryDate);
        if (!isEditMode) { resetNewOrderForm(); }

    } catch (error) { console.error("Error saving/updating:", error); alert("Error: " + error.message);
    } finally { saveButton.disabled = false; const btnTxt = isEditMode ? "Update Order" : "Save Order"; saveButton.innerHTML = `<i class="fas fa-save"></i> <span>${btnTxt}</span>`; }
}

// --- Reset Form ---
function resetNewOrderForm() { /* (पहले जैसा कोड) */ }

// --- Post-Save Functions ---
async function saveToDailyReport(orderData, orderPath) { /* (पहले जैसा कोड - प्लेसहोल्डर) */ }
function showWhatsAppReminder(customer, orderId, deliveryDate) { /* (पहले जैसा कोड) */ }
function closeWhatsAppPopup() { /* (पहले जैसा कोड) */ }

console.log("new_order.js script loaded (Client-Side Filtering).");