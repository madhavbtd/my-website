// js/new_order.js

// Firestore functions
const { db, collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, limit, orderBy } = window;

// --- Global Variables ---
let addedProducts = [];
let isEditMode = false;
let orderIdToEdit = null;
let selectedCustomerId = null;
let productCache = [];
let customerCache = [];
let productFetchPromise = null;
let customerFetchPromise = null;

// --- DOM Element References ---
// ... (सभी रेफरेंस पहले जैसे, कोई बदलाव नहीं)
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
    // Event Listeners (Same as before)
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
    if (window.db) { console.log("[DEBUG] DB connection confirmed immediately."); callback(); }
    else { let attempts = 0; const maxAttempts = 20; const intervalId = setInterval(() => { attempts++; if (window.db) { clearInterval(intervalId); console.log("[DEBUG] DB connection confirmed after check."); callback(); } else if (attempts >= maxAttempts) { clearInterval(intervalId); console.error("[DEBUG] DB connection timeout."); alert("Database connection failed."); } }, 250); }
}

// --- Initialize Form ---
function initializeForm() { /* (पहले जैसा कोड) */ }

// --- Load Order For Edit ---
async function loadOrderForEdit(docId) { /* (पहले जैसा कोड) */ }

// --- Product Handling ---
function handleAddProduct() { /* (पहले जैसा कोड) */ }
function renderProductList() { /* (पहले जैसा कोड) */ }
function handleDeleteProduct(event) { /* (पहले जैसा कोड) */ }

// --- Status Checkbox Handling ---
function handleStatusCheckboxes(isEditing) { /* (पहले जैसा कोड) */ }
function handleStatusChange(event) { /* (पहले जैसा कोड) */ }


// --- Autocomplete V2: Client-Side Filtering (with DEBUG LOGS) ---

// --- Customer Autocomplete ---
let customerSearchTimeout;
function handleCustomerInput(event, type) {
    const searchTerm = event.target.value.trim();
    console.log(`[DEBUG] Customer Input (${type}): "${searchTerm}"`); // Log input
    const suggestionBox = type === 'name' ? customerSuggestionsNameBox : customerSuggestionsWhatsAppBox;
    if (!suggestionBox) return;
    resetCustomerSelection(); suggestionBox.innerHTML = '';
    if (searchTerm.length < 2) { clearTimeout(customerSearchTimeout); return; }
    clearTimeout(customerSearchTimeout);
    customerSearchTimeout = setTimeout(() => {
        console.log(`[DEBUG] Triggering customer filter for (${type}): "${searchTerm}"`);
        getOrFetchCustomerCache().then(() => {
            filterAndRenderCustomerSuggestions(searchTerm, type, suggestionBox);
        }).catch(err => console.error("[DEBUG] Error during customer fetch/filter:", err));
    }, 300);
}

async function getOrFetchCustomerCache() {
    if (customerCache.length > 0) { console.log("[DEBUG] Using cached customer data."); return Promise.resolve(); }
    if (customerFetchPromise) { console.log("[DEBUG] Waiting for existing customer fetch promise."); return customerFetchPromise; }
    console.log("[DEBUG] Fetching initial customer data from Firestore...");
    try {
        // ... (Firestore query as before)
        if (!db || !collection || !query || !getDocs || !orderBy) { throw new Error("Firestore query functions unavailable."); }
        const customersRef = collection(db, "customers");
        const q = query(customersRef, orderBy("fullName")); // Requires index on fullName
        console.log("[DEBUG] Customer Fetch Query:", q); // Log query
        customerFetchPromise = getDocs(q).then(snapshot => {
            customerCache = [];
            snapshot.forEach(doc => { const d = doc.data(); if (d.fullName && d.whatsappNo) customerCache.push({ id: doc.id, ...d }); });
            console.log(`[DEBUG] Fetched and cached ${snapshot.size} documents -> ${customerCache.length} valid customers.`); // Log count
            customerFetchPromise = null;
        }).catch(err => { console.error("[DEBUG] Error fetching customers:", err); customerFetchPromise = null; throw err; });
        return customerFetchPromise;
    } catch (error) { console.error("[DEBUG] Error setting up customer fetch:", error); customerFetchPromise = null; return Promise.reject(error); }
}

function filterAndRenderCustomerSuggestions(term, type, box) {
    const lowerTerm = term.toLowerCase();
    const field = type === 'name' ? 'fullName' : 'whatsappNo';
    console.log(`[DEBUG] Filtering ${customerCache.length} cached customers for term "${term}" on field "${field}"`);
    const filtered = customerCache.filter(c => {
        const val = c[field] || '';
        return val.toLowerCase().includes(lowerTerm);
    }).slice(0, 7);
    console.log(`[DEBUG] Found ${filtered.length} customer suggestions.`);
    renderCustomerSuggestions(filtered, term, box);
}

function renderCustomerSuggestions(suggestions, term, box) { /* (पहले जैसा कोड) */ }
function fillCustomerData(customer) { /* (पहले जैसा कोड) */ }
function resetCustomerSelection() { /* (पहले जैसा कोड) */ }

// --- Product Autocomplete ---
let productSearchTimeout;
function handleProductInput(event) {
    const searchTerm = event.target.value.trim();
     console.log(`[DEBUG] Product Input: "${searchTerm}"`); // Log input
    if (!productSuggestionsBox) return;
    productNameInput.readOnly = false; productSuggestionsBox.innerHTML = '';
    if (searchTerm.length < 2) { clearTimeout(productSearchTimeout); return; }
    clearTimeout(productSearchTimeout);
    productSearchTimeout = setTimeout(() => {
        console.log(`[DEBUG] Triggering product filter for: "${searchTerm}"`);
        getOrFetchProductCache().then(() => {
            filterAndRenderProductSuggestions(searchTerm, productSuggestionsBox);
        }).catch(err => console.error("[DEBUG] Error during product fetch/filter:", err));
    }, 300);
}

async function getOrFetchProductCache() {
    if (productCache.length > 0) { console.log("[DEBUG] Using cached product data."); return Promise.resolve(); }
    if (productFetchPromise) { console.log("[DEBUG] Waiting for existing product fetch promise."); return productFetchPromise; }
    console.log("[DEBUG] Fetching initial product data from Firestore...");
    try {
        if (!db || !collection || !query || !getDocs || !orderBy) { throw new Error("Firestore query functions unavailable."); }
        const productsRef = collection(db, "products");
        // ** Index on 'printName' (Asc) REQUIRED **
        const q = query(productsRef, orderBy("printName"));
        console.log("[DEBUG] Product Fetch Query:", q); // Log query
        productFetchPromise = getDocs(q).then(snapshot => {
            productCache = [];
            snapshot.forEach(doc => { const d = doc.data(); if (d.printName) productCache.push({ id: doc.id, name: d.printName }); }); // Use printName
            console.log(`[DEBUG] Fetched and cached ${snapshot.size} documents -> ${productCache.length} valid products.`); // Log count
            productFetchPromise = null;
        }).catch(err => { console.error("[DEBUG] Error fetching products:", err); productFetchPromise = null; throw err; });
        return productFetchPromise;
    } catch (error) { console.error("[DEBUG] Error setting up product fetch:", error); productFetchPromise = null; return Promise.reject(error); }
}

function filterAndRenderProductSuggestions(term, box) {
    const lowerTerm = term.toLowerCase();
    console.log(`[DEBUG] Filtering ${productCache.length} cached products for term "${term}"`);
    // Filter productCache case-insensitively
    const filtered = productCache.filter(p => {
        const name = p.name || ''; // Name comes from printName
        return name.toLowerCase().includes(lowerTerm);
    }).slice(0, 10);
     console.log(`[DEBUG] Found ${filtered.length} product suggestions.`);
    renderProductSuggestions(filtered, term, box);
}

function renderProductSuggestions(suggestions, term, box) { /* (पहले जैसा कोड) */ }
// --- End Autocomplete ---

// --- Form Submit Handler --- (With direct input read fix from before)
async function handleFormSubmit(event) {
    event.preventDefault();
    console.log("[DEBUG] Form submission initiated...");
    // ... (Rest of the function is the same as the previous version with the direct input read fix)
    if (!db || !collection || !addDoc || !doc || !updateDoc || !getDoc ) { alert("Database functions unavailable."); return; }
    if (!saveButton) return;
    saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    try {
        const formData = new FormData(orderForm);
        // *** Read name directly from input ***
        const customerFullNameFromInput = customerNameInput.value.trim();
        console.log("[DEBUG] Reading Full Name directly from input:", customerFullNameFromInput);
        const customerData = { fullName: customerFullNameFromInput, address: formData.get('address')?.trim() || '', whatsappNo: formData.get('whatsapp_no')?.trim() || '', contactNo: formData.get('contact_no')?.trim() || '' };
        const orderDetails = { manualOrderId: formData.get('manual_order_id')?.trim() || '', orderDate: formData.get('order_date') || '', deliveryDate: formData.get('delivery_date') || '', urgent: formData.get('urgent') || 'No', remarks: formData.get('remarks')?.trim() || '' };
        const statusCheckbox = orderForm.querySelector('input[name="order_status"]:checked'); const selectedStatus = statusCheckbox ? statusCheckbox.value : (isEditMode ? null : 'Order Received');
        // *** Strict Validation ***
        if (!selectedCustomerId) throw new Error("Please select an existing customer from the suggestions.");
        if (!customerData.fullName) { console.error("[DEBUG] Validation failed: Full Name value is empty."); throw new Error("Full Name is required. Please select the customer again."); }
        if (!customerData.whatsappNo) throw new Error("WhatsApp No required.");
        if (addedProducts.length === 0) throw new Error("Add at least one product.");
        if (!orderDetails.orderDate) throw new Error("Order Date required.");
        if (!selectedStatus) throw new Error("Select order status.");
        // ... (Rest of submit logic: determine ID, build payload, save/update, post-save actions)
        const customerIdToUse = selectedCustomerId; let orderIdToUse;
        const existingSystemId = displayOrderIdInput.value;
        if (isEditMode) { orderIdToUse = existingSystemId; } else { orderIdToUse = orderDetails.manualOrderId || Date.now().toString(); }
        const orderDataPayload = { orderId: orderIdToUse, customerId: customerIdToUse, customerDetails: customerData, orderDate: orderDetails.orderDate, deliveryDate: orderDetails.deliveryDate, urgent: orderDetails.urgent, remarks: orderDetails.remarks, status: selectedStatus, products: addedProducts, updatedAt: new Date() };
        let orderDocRefPath;
        if (isEditMode) { if (!orderIdToEdit) throw new Error("Missing ID for update."); const orderRef = doc(db, "orders", orderIdToEdit); await updateDoc(orderRef, orderDataPayload); orderDocRefPath = orderRef.path; console.log("Order updated:", orderIdToEdit); alert('Order updated!'); }
        else { orderDataPayload.createdAt = new Date(); const newOrderRef = await addDoc(collection(db, "orders"), orderDataPayload); orderDocRefPath = newOrderRef.path; console.log("New order saved:", newOrderRef.id); alert('New order saved!'); displayOrderIdInput.value = orderIdToUse; }
        await saveToDailyReport(orderDataPayload, orderDocRefPath); showWhatsAppReminder(customerData, orderIdToUse, orderDetails.deliveryDate);
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

console.log("new_order.js script loaded (Client-Side Filtering + Save Fix + Debug Logs)."); // अपडेटेड लोड मैसेज