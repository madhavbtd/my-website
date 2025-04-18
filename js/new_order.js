// js/new_order.js

// Get Firestore functions (from firebase init script)
const { db, collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, limit } = window;

// --- Global Variables ---
let addedProducts = [];
let isEditMode = false;
let orderIdToEdit = null;
let selectedCustomerId = null;

// --- DOM Element References ---
// (सभी रेफरेंस पहले जैसे ही रहेंगे, कोई बदलाव नहीं)
const orderForm = document.getElementById('newOrderForm');
const saveButton = document.getElementById('saveOrderBtn');
const saveButtonText = saveButton ? saveButton.querySelector('span') : null;
const formHeader = document.getElementById('formHeader');
const headerText = document.getElementById('headerText'); // Header text span
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
    // --- Event Listeners --- (पहले जैसे)
     if (orderForm) orderForm.addEventListener('submit', handleFormSubmit);
     else console.error("FATAL: Order form (#newOrderForm) not found!");
     if (addProductBtn) addProductBtn.addEventListener('click', handleAddProduct);
     else console.error("Add product button (#add-product-btn) not found!");
     if (productListContainer) productListContainer.addEventListener('click', handleDeleteProduct);
     else console.error("Product list container (#product-list) not found!");
     if (customerNameInput) customerNameInput.addEventListener('input', (e) => handleCustomerInput(e, 'name'));
     if (customerWhatsAppInput) customerWhatsAppInput.addEventListener('input', (e) => handleCustomerInput(e, 'whatsapp'));
     if (productNameInput) productNameInput.addEventListener('input', handleProductInput);
     if (popupCloseBtn) popupCloseBtn.addEventListener('click', closeWhatsAppPopup);
     if (whatsappReminderPopup) {
         whatsappReminderPopup.addEventListener('click', (event) => {
             if (event.target === whatsappReminderPopup) closeWhatsAppPopup();
         });
     }
});

// --- DB Connection Wait ---
function waitForDbConnection(callback) {
    // (पहले जैसा कोड)
    if (window.db) { console.log("DB connection confirmed immediately."); callback(); }
    else { let attempts = 0; const maxAttempts = 20; const intervalId = setInterval(() => { attempts++; if (window.db) { clearInterval(intervalId); console.log("DB connection confirmed after check."); callback(); } else if (attempts >= maxAttempts) { clearInterval(intervalId); console.error("DB connection timeout."); alert("Database connection failed."); } }, 250); }
}

// --- Initialize Form ---
function initializeForm() {
    // (पहले जैसा कोड, बस हैडर टेक्स्ट के लिए अपडेट)
    const urlParams = new URLSearchParams(window.location.search);
    orderIdToEdit = urlParams.get('editOrderId');
    if (orderIdToEdit) {
        isEditMode = true;
        console.log("Edit Mode Initializing. Order Firestore ID:", orderIdToEdit);
        if(headerText) headerText.textContent = "Edit Order"; // Update header text
        else if(formHeader) formHeader.textContent = "Edit Order"; // Fallback
        if(saveButtonText) saveButtonText.textContent = "Update Order";
        if(hiddenEditOrderIdInput) hiddenEditOrderIdInput.value = orderIdToEdit;
        if(manualOrderIdInput) manualOrderIdInput.readOnly = true;
        loadOrderForEdit(orderIdToEdit);
        handleStatusCheckboxes(true);
    } else {
        isEditMode = false;
        console.log("Add Mode Initializing.");
        if(headerText) headerText.textContent = "New Order"; // Update header text
        else if(formHeader) formHeader.textContent = "New Order"; // Fallback
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
    // (पहले जैसा कोड, कोई बदलाव नहीं)
    console.log(`Loading order data for edit from Firestore: ${docId}`);
    try { /* ... Firestore fetch logic ... */ }
    catch (error) { /* ... Error handling ... */ }
    // Ensure this function correctly sets 'selectedCustomerId' and calls 'renderProductList()'
}

// --- Product Handling ---
function handleAddProduct() { /* (पहले जैसा कोड) */ }
function renderProductList() { /* (पहले जैसा कोड) */ }
function handleDeleteProduct(event) { /* (पहले जैसा कोड) */ }

// --- Status Checkbox Handling ---
function handleStatusCheckboxes(isEditing) { /* (पहले जैसा कोड) */ }
function handleStatusChange(event) { /* (पहले जैसा कोड) */ }

// --- Autocomplete Functions ---

// Customer Input Handler
let customerSearchTimeout;
function handleCustomerInput(event, type) { /* (पहले जैसा कोड) */ }

// Fetch Customer Suggestions (पहले जैसा, fullName_lowercase और whatsappNo पर आधारित)
async function fetchCustomerSuggestions(termLowercase, type, box, originalTerm) {
    // (पहले जैसा कोड - यह काम कर रहा है)
    box.innerHTML = '<ul><li>Searching...</li></ul>';
    try {
        // ... (Firestore क्वेरी fullName_lowercase या whatsappNo पर) ...
    } catch (error) {
        console.error(`Error fetching customer suggestions (${type}):`, error);
        box.innerHTML = `<ul><li style="color:red;">Error: ${error.message}. Check Console (F12).</li></ul>`;
    }
}
// Render Customer Suggestions (पहले जैसा)
function renderCustomerSuggestions(suggestions, term, box) { /* (पहले जैसा कोड) */ }
// Fill Customer Data (पहले जैसा)
function fillCustomerData(customer) { /* (पहले जैसा कोड) */ }
// Reset Customer Selection (पहले जैसा)
function resetCustomerSelection() { /* (पहले जैसा कोड) */ }


// Product Input Handler
let productSearchTimeout;
function handleProductInput(event) {
    // (पहले जैसा कोड)
    const searchTerm = event.target.value.trim();
    if (!productSuggestionsBox) return;
    productSuggestionsBox.innerHTML = '';
    productNameInput.readOnly = false;
    if (searchTerm.length < 2) { clearTimeout(productSearchTimeout); return; }
    clearTimeout(productSearchTimeout);
    productSearchTimeout = setTimeout(() => {
        console.log("Searching products:", searchTerm);
        // ** अब हम केस-सेंसिटिव खोज करेंगे 'printName' पर **
        fetchProductSuggestions(searchTerm, productSuggestionsBox); // मूल केस वाला टर्म भेजें
    }, 400);
}

// ** महत्वपूर्ण बदलाव: Firestore से उत्पाद सुझाव प्राप्त करें ('printName' फील्ड पर केस-सेंसिटिव खोज) **
async function fetchProductSuggestions(term, box) { // अब term लोअरकेस नहीं है
    box.innerHTML = '<ul><li>Searching...</li></ul>';
    try {
        if(!db || !collection || !query || !where || !getDocs || typeof limit !== 'function') {
             throw new Error("Firestore query functions not available.");
        }
        const productsRef = collection(db, "products");
        // ** फील्ड का नाम: 'printName' **
        // ** इंडेक्स: Firestore में 'printName' पर सिंगल-फील्ड एसेंडिंग इंडेक्स आवश्यक है **
        const fieldToQuery = "printName";
        const queryLower = term; // केस-सेंसिटिव खोज
        const queryUpper = term + '\uf8ff';

        const q = query(
            productsRef,
            where(fieldToQuery, ">=", queryLower),
            where(fieldToQuery, "<=", queryUpper),
            limit(7)
        );
        console.log("Executing Firestore product query using 'printName' for:", term);
        const querySnapshot = await getDocs(q);
        console.log("Product query snapshot size:", querySnapshot.size);

        const suggestions = [];
        querySnapshot.forEach((doc) => {
             const data = doc.data();
             // ** सुनिश्चित करें कि डॉक्यूमेंट में 'printName' फील्ड है **
             if(data.printName) {
                // हम यूजर को दिखाने के लिए 'printName' का ही उपयोग करेंगे
                suggestions.push({ id: doc.id, name: data.printName }); // यहाँ 'name' प्रॉपर्टी में printName डालें
             } else {
                 console.warn("Product document missing 'printName' field:", doc.id);
             }
        });
        // ** महत्वपूर्ण: रेंडर फंक्शन को अब असली केस वाला टर्म चाहिए **
        renderProductSuggestions(suggestions, term, box); // मूल केस वाला टर्म भेजें
    } catch (error) {
        console.error("Error fetching product suggestions:", error);
        // विस्तृत एरर दिखाएं
        box.innerHTML = `<ul><li style="color:red;">Error: ${error.message}. Check Console (F12).</li></ul>`;
    }
}

// उत्पाद सुझाव दिखाएं (पहले जैसा, हाइलाइटिंग के लिए टर्म का उपयोग)
function renderProductSuggestions(suggestions, term, box) {
    // (पहले जैसा कोड)
     if (suggestions.length === 0) { box.innerHTML = `<ul><li>No products found matching '${term}'</li></ul>`; return; }
    const ul = document.createElement('ul');
    suggestions.forEach(prod => {
        const li = document.createElement('li');
         try { li.innerHTML = prod.name.replace(new RegExp(`(${term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'), '<strong>$1</strong>'); }
         catch { li.textContent = prod.name; }
        li.dataset.name = prod.name; // असली नाम (printName से आया) स्टोर करें
        li.addEventListener('click', () => {
            productNameInput.value = prod.name; // इनपुट में भरें
            box.innerHTML = '';
            quantityInput.focus();
        });
        ul.appendChild(li);
    });
    box.innerHTML = '';
    box.appendChild(ul);
}
// --- एंड ऑटो-कम्प्लीट ---


// --- फॉर्म सबमिट हैंडलर ---
async function handleFormSubmit(event) {
    // (पहले जैसा कोड, कोई बदलाव नहीं)
     event.preventDefault();
     /* ... बाकी लॉजिक ... */
}

// --- फॉर्म रीसेट ---
function resetNewOrderForm() {
    // (पहले जैसा कोड)
     console.log("Resetting form for new order entry.");
     /* ... बाकी लॉजिक ... */
}

// --- पोस्ट-सेव फंक्शन्स ---
async function saveToDailyReport(orderData, orderPath) { /* (पहले जैसा कोड - प्लेसहोल्डर) */ }
function showWhatsAppReminder(customer, orderId, deliveryDate) { /* (पहले जैसा कोड) */ }
function closeWhatsAppPopup() { /* (पहले जैसा कोड) */ }

console.log("new_order.js script loaded."); // अंत में कन्फर्मेशन