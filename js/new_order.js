// js/new_order.js

// Firestore functions
const { db, collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, limit, orderBy } = window;

// --- Global Variables ---
let addedProducts = [];
let isEditMode = false;
let orderIdToEdit = null;
let selectedCustomerId = null; // <<< Important for validation
let productCache = [];
let customerCache = [];
let productFetchPromise = null;
let customerFetchPromise = null;

// --- DOM Element References ---
// ... (सभी रेफरेंस पहले जैसे)
const orderForm = document.getElementById('newOrderForm');
const saveButton = document.getElementById('saveOrderBtn');
const saveButtonText = saveButton ? saveButton.querySelector('span') : null;
const formHeader = document.getElementById('formHeader');
const headerText = document.getElementById('headerText');
const hiddenEditOrderIdInput = document.getElementById('editOrderId');
const selectedCustomerIdInput = document.getElementById('selectedCustomerId');
const displayOrderIdInput = document.getElementById('display_order_id');
const manualOrderIdInput = document.getElementById('manual_order_id');
const customerNameInput = document.getElementById('full_name'); // <<< Reference needed for direct value reading
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
document.addEventListener('DOMContentLoaded', () => { /* (पहले जैसा कोड) */ });
function waitForDbConnection(callback) { /* (पहले जैसा कोड) */ }
function initializeForm() { /* (पहले जैसा कोड) */ }
async function loadOrderForEdit(docId) { /* (पहले जैसा कोड) */ }

// --- Product Handling ---
function handleAddProduct() { /* (पहले जैसा कोड) */ }
function renderProductList() { /* (पहले जैसा कोड) */ }
function handleDeleteProduct(event) { /* (पहले जैसा कोड) */ }

// --- Status Checkbox Handling ---
function handleStatusCheckboxes(isEditing) { /* (पहले जैसा कोड) */ }
function handleStatusChange(event) { /* (पहले जैसा कोड) */ }

// --- Autocomplete Functions ---
let customerSearchTimeout;
function handleCustomerInput(event, type) { /* (पहले जैसा कोड) */ }
async function getOrFetchCustomerCache() { /* (पहले जैसा कोड) */ }
async function fetchCustomerSuggestions(termLowercase, type, box, originalTerm) { /* (पहले जैसा कोड) */ }
function filterAndRenderCustomerSuggestions(term, type, box) { /* (पहले जैसा कोड) */ }
function renderCustomerSuggestions(suggestions, term, box) { /* (पहले जैसा कोड) */ }
function fillCustomerData(customer) { /* (पहले जैसा कोड) */ }
function resetCustomerSelection() { /* (पहले जैसा कोड) */ }

let productSearchTimeout;
function handleProductInput(event) { /* (पहले जैसा कोड) */ }
async function getOrFetchProductCache() { /* (पहले जैसा कोड) */ }
async function fetchProductSuggestions(term, box) { /* (पहले जैसा कोड - printName उपयोग करता है) */ }
function filterAndRenderProductSuggestions(term, box) { /* (पहले जैसा कोड) */ }
function renderProductSuggestions(suggestions, term, box) { /* (पहले जैसा कोड) */ }
// --- End Autocomplete ---


// --- Form Submit Handler (UPDATED VALIDATION) ---
async function handleFormSubmit(event) {
    event.preventDefault();
    console.log("Form submission initiated...");
    if (!db || !collection || !addDoc || !doc || !updateDoc || !getDoc ) { alert("Database functions unavailable."); return; }
    if (!saveButton) return;

    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        // 1. Get Form Data
        const formData = new FormData(orderForm);

        // ** महत्वपूर्ण बदलाव: ग्राहक का नाम सीधे इनपुट से पढ़ें **
        const customerFullNameFromInput = customerNameInput.value.trim();
        console.log("Reading Full Name directly from input:", customerFullNameFromInput);

        const customerData = {
            fullName: customerFullNameFromInput, // <<< सीधा मान उपयोग करें
            address: formData.get('address')?.trim() || '', // यह ठीक हो सकता है क्योंकि यह readonly है
            whatsappNo: formData.get('whatsapp_no')?.trim() || '',
            contactNo: formData.get('contact_no')?.trim() || '' // यह भी readonly है
        };
        const orderDetails = {
            manualOrderId: formData.get('manual_order_id')?.trim() || '',
            orderDate: formData.get('order_date') || '',
            deliveryDate: formData.get('delivery_date') || '',
            urgent: formData.get('urgent') || 'No',
            remarks: formData.get('remarks')?.trim() || ''
        };
        const statusCheckbox = orderForm.querySelector('input[name="order_status"]:checked');
        const selectedStatus = statusCheckbox ? statusCheckbox.value : (isEditMode ? null : 'Order Received');

        // 2. **Validation**
        // ** सुनिश्चित करें कि selectedCustomerId सेट है (ऑटो-कम्प्लीट से) **
        if (!selectedCustomerId) {
             throw new Error("Please select an existing customer from the suggestions.");
        }
        // ** अब सीधे पढ़े गए नाम को जांचें **
        if (!customerData.fullName) {
             console.error("Validation failed: Full Name value is empty despite selection potentially occurring.");
             throw new Error("Full Name is required. Please select the customer again."); // बेहतर एरर संदेश
        }
        if (!customerData.whatsappNo) throw new Error("WhatsApp No is required.");
        if (addedProducts.length === 0) throw new Error("At least one product must be added.");
        if (!orderDetails.orderDate) throw new Error("Order Date is required.");
        if (!selectedStatus) throw new Error("Please select an order status.");

        // 3. Use selected Customer ID
        const customerIdToUse = selectedCustomerId;

        // 4. Determine Order ID
        let orderIdToUse;
        const existingSystemId = displayOrderIdInput.value;
        if (isEditMode) { orderIdToUse = existingSystemId; }
        else { orderIdToUse = orderDetails.manualOrderId || Date.now().toString(); }

        // 5. Prepare Order Payload
        const orderDataPayload = {
            orderId: orderIdToUse,
            customerId: customerIdToUse,
            customerDetails: customerData,
            orderDate: orderDetails.orderDate,
            deliveryDate: orderDetails.deliveryDate,
            urgent: orderDetails.urgent,
            remarks: orderDetails.remarks,
            status: selectedStatus,
            products: addedProducts,
            updatedAt: new Date()
        };

        // 6. Save/Update in Firestore
        let orderDocRefPath;
        if (isEditMode) {
            if (!orderIdToEdit) throw new Error("Missing Firestore document ID for update.");
            const orderRef = doc(db, "orders", orderIdToEdit); await updateDoc(orderRef, orderDataPayload); orderDocRefPath = orderRef.path;
            console.log("Order updated:", orderIdToEdit); alert('Order updated successfully!');
        } else {
            orderDataPayload.createdAt = new Date(); const newOrderRef = await addDoc(collection(db, "orders"), orderDataPayload); orderDocRefPath = newOrderRef.path;
            console.log("New order saved:", newOrderRef.id); alert('New order saved successfully!'); displayOrderIdInput.value = orderIdToUse;
        }

        // 7. Post-save actions
        await saveToDailyReport(orderDataPayload, orderDocRefPath);
        showWhatsAppReminder(customerData, orderIdToUse, orderDetails.deliveryDate);
        if (!isEditMode) { resetNewOrderForm(); }

    } catch (error) {
        console.error("Error saving/updating order:", error);
        alert("Error: " + error.message);
    } finally {
        saveButton.disabled = false;
        const buttonText = isEditMode ? "Update Order" : "Save Order";
        saveButton.innerHTML = `<i class="fas fa-save"></i> <span>${buttonText}</span>`;
    }
}

// --- Reset Form ---
function resetNewOrderForm() { /* (पहले जैसा कोड) */ }

// --- Post-Save Functions ---
async function saveToDailyReport(orderData, orderPath) { /* (पहले जैसा कोड - प्लेसहोल्डर) */ }
function showWhatsAppReminder(customer, orderId, deliveryDate) { /* (पहले जैसा कोड) */ }
function closeWhatsAppPopup() { /* (पहले जैसा कोड) */ }

console.log("new_order.js script loaded (Client-Side Filtering + Save Fix).");