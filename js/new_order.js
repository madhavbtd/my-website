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
const orderForm = document.getElementById('newOrderForm');
const saveButton = document.getElementById('saveOrderBtn');
const saveButtonText = saveButton ? saveButton.querySelector('span') : null;
const formHeader = document.getElementById('formHeader');
const headerText = document.getElementById('headerText');
const closeFormButton = document.getElementById('closeFormBtn'); // <<< Close Button
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
const orderStatusSelect = document.getElementById('order_status_select'); // <<< Status Dropdown
// const orderStatusCheckboxes = document.querySelectorAll('input[name="order_status"]'); // <<< Removed
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
    if (addProductBtn) addProductBtn.addEventListener('click', handleAddProduct);
    if (productListContainer) productListContainer.addEventListener('click', handleDeleteProduct);
    if (customerNameInput) customerNameInput.addEventListener('input', (e) => handleCustomerInput(e, 'name'));
    if (customerWhatsAppInput) customerWhatsAppInput.addEventListener('input', (e) => handleCustomerInput(e, 'whatsapp'));
    if (productNameInput) productNameInput.addEventListener('input', handleProductInput);
    if (popupCloseBtn) popupCloseBtn.addEventListener('click', closeWhatsAppPopup);
    if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (event) => { if (event.target === whatsappReminderPopup) closeWhatsAppPopup(); });
    if (closeFormButton) {
        closeFormButton.addEventListener('click', () => { window.location.href = 'order_history.html'; });
        console.log("[DEBUG] Attached listener to closeFormButton click.");
     }
});

// --- DB Connection Wait ---
function waitForDbConnection(callback) { /* (पहले जैसा) */ }

// --- Initialize Form ---
function initializeForm() {
    console.log("[DEBUG] initializeForm() called.");
    const urlParams = new URLSearchParams(window.location.search);
    orderIdToEdit = urlParams.get('editOrderId');

    if (orderIdToEdit) {
        isEditMode = true;
        console.log("[DEBUG] Edit Mode Initializing. Order Firestore ID:", orderIdToEdit);
        if(headerText) headerText.textContent = "Edit Order"; else if(formHeader) formHeader.textContent = "Edit Order";
        if(saveButtonText) saveButtonText.textContent = "Update Order";
        if(hiddenEditOrderIdInput) hiddenEditOrderIdInput.value = orderIdToEdit;
        if(manualOrderIdInput) manualOrderIdInput.readOnly = true;
        loadOrderForEdit(orderIdToEdit); // Load existing data
        handleStatusDropdown(true, null); // Enable dropdown, status set in loadOrderForEdit

    } else {
        isEditMode = false;
        console.log("[DEBUG] Add Mode Initializing.");
        if(headerText) headerText.textContent = "New Order"; else if(formHeader) formHeader.textContent = "New Order";
        if(saveButtonText) saveButtonText.textContent = "Save Order";
        if(manualOrderIdInput) manualOrderIdInput.readOnly = false;
        const orderDateInput = document.getElementById('order_date');
        if (orderDateInput && !orderDateInput.value) { orderDateInput.value = new Date().toISOString().split('T')[0]; }
        handleStatusDropdown(false, "Order Received"); // Disable dropdown, set default status
        renderProductList();
        resetCustomerSelection();
    }
}

// --- Load Order Data for Editing ---
async function loadOrderForEdit(docId) {
    console.log(`[DEBUG] Loading order data for edit from Firestore: ${docId}`);
    try {
        if (!db || !doc || !getDoc) throw new Error("Firestore getDoc unavailable.");
        const orderRef = doc(db, "orders", docId);
        const docSnap = await getDoc(orderRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("[DEBUG] Order data for edit:", data);
            // Fill customer details
            customerNameInput.value = data.customerDetails?.fullName || '';
            customerAddressInput.value = data.customerDetails?.address || '';
            customerWhatsAppInput.value = data.customerDetails?.whatsappNo || '';
            customerContactInput.value = data.customerDetails?.contactNo || '';
            selectedCustomerId = data.customerId || null;
            if (selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId;
            customerAddressInput.readOnly = true; customerContactInput.readOnly = true;

            // Fill order details
            displayOrderIdInput.value = data.orderId || docId;
            manualOrderIdInput.value = data.orderId || '';
            orderForm.order_date.value = data.orderDate || '';
            orderForm.delivery_date.value = data.deliveryDate || '';
            orderForm.remarks.value = data.remarks || '';
            const urgentVal = data.urgent || 'No';
            const urgentRadio = orderForm.querySelector(`input[name="urgent"][value="${urgentVal}"]`);
            if (urgentRadio) urgentRadio.checked = true;

            // === Set Status Dropdown ===
            handleStatusDropdown(true, data.status || "Order Received"); // Enable and set value

            // Fill product list
            addedProducts = data.products || [];
            renderProductList();
        } else {
            console.error("[DEBUG] Order document not found for editing!"); alert("Error: Order not found."); window.location.href='order_history.html';
        }
    } catch (error) {
        console.error("[DEBUG] Error loading order for edit:", error); alert("Error loading order data: " + error.message); window.location.href = 'order_history.html';
    }
}

// --- Product Handling ---
function handleAddProduct() { /* (पहले जैसा) */ }
function renderProductList() { /* (पहले जैसा) */ }
function handleDeleteProduct(event) { /* (पहले जैसा) */ }

// --- Status Dropdown Handling ---
function handleStatusDropdown(isEditing, currentStatus) {
    if (!orderStatusSelect) {
        console.error("[DEBUG] Status Select Dropdown not found!");
        return;
    }
    if (isEditing) {
        orderStatusSelect.disabled = false; // Enable dropdown
        orderStatusSelect.value = currentStatus || "Order Received"; // Set current status
    } else {
        orderStatusSelect.value = "Order Received"; // Set default
        orderStatusSelect.disabled = true; // Disable dropdown
    }
    console.log(`[DEBUG] Status dropdown state - Disabled: ${orderStatusSelect.disabled}, Value: ${orderStatusSelect.value}`);
}

// --- Autocomplete V2: Client-Side Filtering ---
// --- Customer Autocomplete ---
let customerSearchTimeout;
function handleCustomerInput(event, type) { /* (पहले जैसा) */ }
async function getOrFetchCustomerCache() { /* (पहले जैसा) */ }
function filterAndRenderCustomerSuggestions(term, type, box) { /* (पहले जैसा) */ }
function renderCustomerSuggestions(suggestions, term, box) { /* (पहले जैसा) */ }
function fillCustomerData(customer) { /* (पहले जैसा) */ }
function resetCustomerSelection() { /* (पहले जैसा) */ }
// --- Product Autocomplete ---
let productSearchTimeout;
function handleProductInput(event) { /* (पहले जैसा) */ }
async function getOrFetchProductCache() { /* (पहले जैसा) */ }
function filterAndRenderProductSuggestions(term, box) { /* (पहले जैसा) */ }
function renderProductSuggestions(suggestions, term, box) { /* (पहले जैसा) */ }
// --- End Autocomplete ---


// --- Form Submit Handler (UPDATED for dropdown and conditional popup) ---
async function handleFormSubmit(event) {
    event.preventDefault(); console.log("[DEBUG] Form submission initiated...");
    if (!db || !collection || !addDoc || !doc || !updateDoc || !getDoc ) { alert("Database functions unavailable."); return; }
    if (!saveButton || !orderStatusSelect) return; // Check for dropdown too

    saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        // 1. Get Form Data
        const formData = new FormData(orderForm);
        const customerFullNameFromInput = customerNameInput.value.trim();
        const customerData = { fullName: customerFullNameFromInput, address: formData.get('address')?.trim() || '', whatsappNo: formData.get('whatsapp_no')?.trim() || '', contactNo: formData.get('contact_no')?.trim() || '' };
        const orderDetails = { manualOrderId: formData.get('manual_order_id')?.trim() || '', orderDate: formData.get('order_date') || '', deliveryDate: formData.get('delivery_date') || '', urgent: formData.get('urgent') || 'No', remarks: formData.get('remarks')?.trim() || '' };

        // === Read status from Dropdown ===
        const selectedStatus = orderStatusSelect.value;

        // 2. **Validation**
        if (!selectedCustomerId) throw new Error("Please select an existing customer from the suggestions.");
        if (!customerData.fullName) { console.error("[DEBUG] Validation failed: Full Name value is empty."); throw new Error("Full Name is required. Please select the customer again."); }
        if (!customerData.whatsappNo) throw new Error("WhatsApp No required.");
        if (addedProducts.length === 0) throw new Error("Add at least one product.");
        if (!orderDetails.orderDate) throw new Error("Order Date required.");
        if (!selectedStatus) throw new Error("Please select an order status."); // Should always have a value now

        // 3. Use selected Customer ID
        const customerIdToUse = selectedCustomerId;

        // 4. Determine Order ID
        let orderIdToUse; const existingSystemId = displayOrderIdInput.value;
        if (isEditMode) { orderIdToUse = existingSystemId; } else { orderIdToUse = orderDetails.manualOrderId || Date.now().toString(); }

        // 5. Prepare Order Payload
        const orderDataPayload = {
            orderId: orderIdToUse, customerId: customerIdToUse, customerDetails: customerData,
            orderDate: orderDetails.orderDate, deliveryDate: orderDetails.deliveryDate,
            urgent: orderDetails.urgent, remarks: orderDetails.remarks,
            status: selectedStatus, // <<< Use status from dropdown
            products: addedProducts, updatedAt: new Date()
        };

        // 6. Save/Update in Firestore
        let orderDocRefPath;
        if (isEditMode) {
            if (!orderIdToEdit) throw new Error("Missing ID for update.");
            const orderRef = doc(db, "orders", orderIdToEdit); await updateDoc(orderRef, orderDataPayload); orderDocRefPath = orderRef.path;
            console.log("[DEBUG] Order updated:", orderIdToEdit); alert('Order updated successfully!');
        } else {
            orderDataPayload.createdAt = new Date(); const newOrderRef = await addDoc(collection(db, "orders"), orderDataPayload); orderDocRefPath = newOrderRef.path;
            console.log("[DEBUG] New order saved:", newOrderRef.id); alert('New order saved successfully!'); displayOrderIdInput.value = orderIdToUse;
        }

        // 7. Save to Daily Report (Placeholder)
        await saveToDailyReport(orderDataPayload, orderDocRefPath);

        // === 8. Conditional WhatsApp Reminder ===
        const showReminderStatuses = ["Order Received", "Verification", "Delivered"];
        if (showReminderStatuses.includes(selectedStatus)) {
             console.log(`[DEBUG] Status (${selectedStatus}) matches criteria, showing WhatsApp reminder.`);
             showWhatsAppReminder(customerData, orderIdToUse, orderDetails.deliveryDate, selectedStatus); // Pass status
        } else {
             console.log(`[DEBUG] Status (${selectedStatus}) does not match criteria, skipping WhatsApp reminder.`);
        }
        // ======================================

        // 9. Reset form if new order
        if (!isEditMode) { resetNewOrderForm(); }

    } catch (error) { console.error("Error saving/updating order:", error); alert("Error: " + error.message);
    } finally { saveButton.disabled = false; const btnTxt = isEditMode ? "Update Order" : "Save Order"; saveButton.innerHTML = `<i class="fas fa-save"></i> <span>${btnTxt}</span>`; }
}

// --- Reset Form ---
function resetNewOrderForm() {
    console.log("[DEBUG] Resetting form.");
    resetCustomerSelection();
    // Clear specific fields instead of orderForm.reset() to keep date?
    customerNameInput.value = ''; customerWhatsAppInput.value = '';
    customerAddressInput.value = ''; customerContactInput.value = '';
    manualOrderIdInput.value = ''; displayOrderIdInput.value = '';
    orderForm.delivery_date.value = ''; orderForm.remarks.value = '';
    addedProducts = []; renderProductList();
    handleStatusDropdown(false, "Order Received"); // Reset status dropdown
    const urgentNoRadio = orderForm.querySelector('input[name="urgent"][value="No"]'); if (urgentNoRadio) urgentNoRadio.checked = true;
    // Optionally reset order date too
    // const orderDateInput = document.getElementById('order_date');
    // if (orderDateInput) orderDateInput.value = new Date().toISOString().split('T')[0];
}

// --- Post-Save Functions ---

// (Placeholder) Save to Daily Report
async function saveToDailyReport(orderData, orderPath) { /* (पहले जैसा) */ }

// Show WhatsApp Reminder Popup (UPDATED for custom messages)
function showWhatsAppReminder(customer, orderId, deliveryDate, status) {
    if (!whatsappReminderPopup || !whatsappMsgPreview || !whatsappSendLink) { console.error("[DEBUG] WhatsApp popup elements missing."); return; }
    const customerName = customer.fullName || 'Customer';
    const customerNumber = customer.whatsappNo?.replace(/[^0-9]/g, '');
    if (!customerNumber) { console.warn("[DEBUG] WhatsApp No missing."); alert("Customer WhatsApp number is missing."); return; }

    let message = "";
    const signature = "\n*Madhav Multy Print*\nMob. 9549116541"; // Signature

    switch (status) {
        case "Order Received":
            message = `Dear Customer ${customerName},\n`;
            message += `आपका ऑर्डर नंबर (*${orderId}*) हमें सफलतापूर्वक मिल गया है।\n`;
            if (deliveryDate) {
                // Format date if needed, e.g., using localeString
                let formattedDate = deliveryDate;
                try {
                   formattedDate = new Date(deliveryDate).toLocaleDateString('en-IN'); // Example format dd/mm/yyyy
                } catch(e){ console.warn("Could not format delivery date", e)}
                message += `हम approx date *${formattedDate}* तक डिलीवर कर देंगे।\n`;
            }
            message += `धन्यवाद!`;
            break;
        case "Verification":
            message = `Dear Customer ${customerName},\n`;
            message += `आपकी डिजाईन ऑर्डर नंबर (*${orderId}*) आपको वेरिफिकेशन के लिए भेज दी गयी है।\n`;
            message += `कृपया अच्छे से चेक करें और *OK* रिप्लाई करें।\n`;
            message += `*OK करने के बाद कोई संशोधन नहीं किया जा सकता।*\n`;
            message += `धन्यवाद!`;
            break;
        case "Delivered":
            message = `Dear Customer ${customerName},\n`;
            message += `आपका ऑर्डर नंबर (*${orderId}*) सफलतापूर्वक डिलीवर कर दिया गया है।\n`;
            message += `सेवा का मौका देने के लिए धन्यवाद!`;
            break;
        default:
            // Should not happen based on the check before calling, but good to handle
            console.warn(`[DEBUG] WhatsApp reminder called for unhandled status: ${status}`);
            return; // Don't show popup for other statuses
    }

    message += signature; // Add signature

    // Show preview and set link
    whatsappMsgPreview.innerText = message; // Use innerText to preserve line breaks
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customerNumber}?text=${encodedMessage}`;
    whatsappSendLink.href = whatsappUrl;

    // Show popup
    whatsappReminderPopup.classList.add('active');
    console.log(`[DEBUG] WhatsApp reminder shown for status: ${status}`);
}

// Close WhatsApp Popup
function closeWhatsAppPopup() {
      if (whatsappReminderPopup) whatsappReminderPopup.classList.remove('active');
}

console.log("new_order.js script loaded (Client-Side Filtering + Save Fix + Dropdown + Conditional Msg).");\