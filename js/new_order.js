// js/new_order.js

// Firestore functions
const { db, collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, limit, orderBy } = window;

// --- Global Variables ---
let addedProducts = [];
let isEditMode = false;
let orderIdToEdit = null;
let selectedCustomerId = null; // Stores the selected customer's Firestore ID
let productCache = []; // Cache for product names
let customerCache = []; // Cache for customer names/numbers
let productFetchPromise = null;
let customerFetchPromise = null;

// --- DOM Element References ---
const orderForm = document.getElementById('newOrderForm');
const saveButton = document.getElementById('saveOrderBtn');
const saveButtonText = saveButton ? saveButton.querySelector('span') : null;
const formHeader = document.getElementById('formHeader');
const headerText = document.getElementById('headerText');
const closeFormButton = document.getElementById('closeFormBtn'); // <<< क्लोज बटन
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

    // --- Event Listeners ---
    if (orderForm) orderForm.addEventListener('submit', handleFormSubmit);
    else console.error("FATAL: Order form (#newOrderForm) not found!");

    if (addProductBtn) addProductBtn.addEventListener('click', handleAddProduct);
    else console.error("Add product button (#add-product-btn) not found!");

    if (productListContainer) productListContainer.addEventListener('click', handleDeleteProduct);
    else console.error("Product list container (#product-list) not found!");

    // Autocomplete Listeners
    if (customerNameInput) customerNameInput.addEventListener('input', (e) => handleCustomerInput(e, 'name'));
    if (customerWhatsAppInput) customerWhatsAppInput.addEventListener('input', (e) => handleCustomerInput(e, 'whatsapp'));
    if (productNameInput) productNameInput.addEventListener('input', handleProductInput);

     // Popup Listeners
     if (popupCloseBtn) popupCloseBtn.addEventListener('click', closeWhatsAppPopup);
     if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (event) => { if (event.target === whatsappReminderPopup) closeWhatsAppPopup(); });

     // === क्लोज बटन लिस्नर ===
     if (closeFormButton) {
         closeFormButton.addEventListener('click', () => {
             // Optionally ask for confirmation if form has data?
             // if (confirm("Are you sure you want to close without saving?")) {
                 window.location.href = 'order_history.html'; // Redirect
             // }
         });
     }
     // =======================
});

// --- DB Connection Wait ---
function waitForDbConnection(callback) {
    if (window.db) { console.log("[DEBUG] DB connection confirmed immediately."); callback(); }
    else { let attempts = 0; const maxAttempts = 20; const intervalId = setInterval(() => { attempts++; if (window.db) { clearInterval(intervalId); console.log("[DEBUG] DB connection confirmed after check."); callback(); } else if (attempts >= maxAttempts) { clearInterval(intervalId); console.error("[DEBUG] DB connection timeout."); alert("Database connection failed."); } }, 250); }
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
async function loadOrderForEdit(docId) { /* (पहले जैसा कोड) */ }

// --- Product Handling ---
function handleAddProduct() { /* (पहले जैसा कोड) */ }
function renderProductList() { /* (पहले जैसा कोड) */ }
function handleDeleteProduct(event) { /* (पहले जैसा कोड) */ }

// --- Status Checkbox Handling ---
function handleStatusCheckboxes(isEditing) { /* (पहले जैसा कोड) */ }
function handleStatusChange(event) { /* (पहले जैसा कोड) */ }


// --- Autocomplete V2: Client-Side Filtering (Using printName/fullName/whatsappNo) ---

// --- Customer Autocomplete ---
let customerSearchTimeout;
function handleCustomerInput(event, type) { /* (पहले जैसा कोड) */ }
async function getOrFetchCustomerCache() {
    // Fetches all customers ordered by fullName, requires index on fullName
    /* (पहले जैसा कोड) */
     if (customerCache.length > 0) { console.log("[DEBUG] Using cached customer data."); return Promise.resolve(); }
    if (customerFetchPromise) { console.log("[DEBUG] Waiting for existing customer fetch promise."); return customerFetchPromise; }
    console.log("[DEBUG] Fetching initial customer data from Firestore...");
    try {
        if (!db || !collection || !query || !getDocs || !orderBy) { throw new Error("Firestore query functions unavailable."); }
        const customersRef = collection(db, "customers");
        const q = query(customersRef, orderBy("fullName")); // *** INDEX REQUIRED on fullName (Asc) ***
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
function filterAndRenderCustomerSuggestions(term, type, box) { /* (पहले जैसा कोड) */ }
function renderCustomerSuggestions(suggestions, term, box) { /* (पहले जैसा कोड) */ }
function fillCustomerData(customer) { /* (पहले जैसा कोड) */ }
function resetCustomerSelection() { /* (पहले जैसा कोड) */ }


// --- Product Autocomplete ---
let productSearchTimeout;
function handleProductInput(event) { /* (पहले जैसा कोड) */ }
async function getOrFetchProductCache() {
    // Fetches all products ordered by printName, requires index on printName
    /* (पहले जैसा कोड) */
     if (productCache.length > 0) { console.log("[DEBUG] Using cached product data."); return Promise.resolve(); }
    if (productFetchPromise) { console.log("[DEBUG] Waiting for existing product fetch promise."); return productFetchPromise; }
    console.log("[DEBUG] Fetching initial