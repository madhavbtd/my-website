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
const whatsappReminderPopup = document.getElementById('whatsapp-reminder-popup');
const whatsappMsgPreview = document.getElementById('whatsapp-message-preview');
const whatsappSendLink = document.getElementById('whatsapp-send-link');
const popupCloseBtn = document.getElementById('popup-close-btn');


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("New Order DOM Loaded. Initializing...");
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

    // === Close Button Listener ===
     if (closeFormButton) {
         closeFormButton.addEventListener('click', () => {
             window.location.href = 'order_history.html'; // Redirect
         });
         console.log("Attached listener to closeFormButton click.");
     } else {
         console.warn("Close Form Button not found.");
     }
     // ==========================

    console.log("Event listeners attached.");

}); // End DOMContentLoaded

// --- DB Connection Wait ---
function waitForDbConnection(callback) {
    if (window.db) { console.log("DB connection confirmed immediately."); callback(); }
    else { let attempts = 0; const maxAttempts = 20; const intervalId = setInterval(() => { attempts++; if (window.db) { clearInterval(intervalId); console.log("DB connection confirmed after check."); callback(); } else if (attempts >= maxAttempts) { clearInterval(intervalId); console.error("DB connection timeout."); alert("Database connection failed."); } }, 250); }
}

// --- Initialize Form ---
function initializeForm() {
    console.log("initializeForm() called.");
    const urlParams = new URLSearchParams(window.location.search);
    orderIdToEdit = urlParams.get('editOrderId'); // Firestore Document ID

    if (orderIdToEdit) {
        isEditMode = true;
        console.log("Edit Mode Initializing. Order Firestore ID:", orderIdToEdit);
        if(headerText) headerText.textContent = "Edit Order"; else if(formHeader) formHeader.textContent = "Edit Order";
        if(saveButtonText) saveButtonText.textContent = "Update Order";
        if(hiddenEditOrderIdInput) hiddenEditOrderIdInput.value = orderIdToEdit;
        if(manualOrderIdInput) manualOrderIdInput.readOnly = true;
        loadOrderForEdit(orderIdToEdit); // Load existing data
        // Status handled within loadOrderForEdit

    } else {
        isEditMode = false;
        console.log("Add Mode Initializing.");
        if(headerText) headerText.textContent = "New Order"; else if(formHeader) formHeader.textContent = "New Order";
        if(saveButtonText) saveButtonText.textContent = "Save Order";
        if(manualOrderIdInput) manualOrderIdInput.readOnly = false;
        const orderDateInput = document.getElementById('order_date');
        if (orderDateInput && !orderDateInput.value) { orderDateInput.value = new Date().toISOString().split('T')[0]; }
        handleStatusDropdown(false, "Order Received"); // <<< Use dropdown handler for new order
        renderProductList();
        resetCustomerSelection();
    }
}

// --- Load Order Data for Editing ---
async function loadOrderForEdit(docId) {
    console.log(`Loading order data for edit from Firestore: ${docId}`);
    try {
        if (!db || !doc || !getDoc) throw new Error("Firestore getDoc unavailable.");
        const orderRef = doc(db, "orders", docId);
        const docSnap = await getDoc(orderRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("Order data for edit:", data);
            // Fill customer & order details
            customerNameInput.value = data.customerDetails?.fullName || '';
            customerAddressInput.value = data.customerDetails?.address || '';
            customerWhatsAppInput.value = data.customerDetails?.whatsappNo || '';
            customerContactInput.value = data.customerDetails?.contactNo || '';
            selectedCustomerId = data.customerId || null;
            if (selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId;
            customerAddressInput.readOnly = true; customerContactInput.readOnly = true;

            displayOrderIdInput.value = data.orderId || docId;
            manualOrderIdInput.value = data.orderId || '';
            orderForm.order_date.value = data.orderDate || '';
            orderForm.delivery_date.value = data.deliveryDate || '';
            orderForm.remarks.value = data.remarks || '';
            const urgentVal = data.urgent || 'No';
            const urgentRadio = orderForm.querySelector(`input[name="urgent"][value="${urgentVal}"]`);
            if (urgentRadio) urgentRadio.checked = true;

            // === Set Status Dropdown ===
            handleStatusDropdown(true, data.status || "Order Received"); // Enable and set loaded status

            // Fill product list
            addedProducts = data.products || [];
            renderProductList();
        } else {
            console.error("Order document not found for editing!"); alert("Error: Order not found."); window.location.href='order_history.html';
        }
    } catch (error) {
        console.error("Error loading order for edit:", error); alert("Error loading order data: " + error.message); window.location.href = 'order_history.html';
    }
}

// --- Product Handling ---
function handleAddProduct() { /* (Same as before) */ }
function renderProductList() { /* (Same as before) */ }
function handleDeleteProduct(event) { /* (Same as before) */ }

// --- Status Dropdown Handling ---
function handleStatusDropdown(isEditing, currentStatus) {
    if (!orderStatusSelect) {
        console.error("Status Select Dropdown (#order_status_select) not found!");
        return;
    }
    if (isEditing) {
        orderStatusSelect.disabled = false; // Enable dropdown in edit mode
        orderStatusSelect.value = currentStatus || "Order Received"; // Set current status
    } else {
        orderStatusSelect.value = "Order Received"; // Set default for new order
        orderStatusSelect.disabled = true; // Disable dropdown for new order
    }
    console.log(`Status dropdown state - Disabled: ${orderStatusSelect.disabled}, Value: ${orderStatusSelect.value}`);
}

// --- Autocomplete V2: Client-Side Filtering ---
// (All autocomplete functions remain the same as the previous working version)
// ... handleCustomerInput, getOrFetchCustomerCache, filterAndRenderCustomerSuggestions, ...
// ... renderCustomerSuggestions, fillCustomerData, resetCustomerSelection, ...
// ... handleProductInput, getOrFetchProductCache, filterAndRenderProductSuggestions, ...
// ... renderProductSuggestions ...
// --- End Autocomplete ---


// --- Form Submit Handler (UPDATED for dropdown and conditional popup) ---
async function handleFormSubmit(event) {
    event.preventDefault(); console.log("Form submission initiated...");
    if (!db || !collection || !addDoc || !doc || !updateDoc || !getDoc ) { alert("Database functions unavailable."); return; }
    // Ensure dropdown exists
    if (!saveButton || !orderStatusSelect) { console.error("Save button or Status dropdown missing!"); return; }

    saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        // 1. Get Form Data
        const formData = new FormData(orderForm);
        const customerFullNameFromInput = customerNameInput.value.trim();
        const customerData = { fullName: customerFullNameFromInput, address: formData.get('address')?.trim() || '', whatsappNo: formData.get('whatsapp_no')?.trim() || '', contactNo: formData.get('contact_no')?.trim() || '' };
        const orderDetails = { manualOrderId: formData.get('manual_order_id')?.trim() || '', orderDate: formData.get('order_date') || '', deliveryDate: formData.get('delivery_date') || '', urgent: formData.get('urgent') || 'No', remarks: formData.get('remarks')?.trim() || '' };

        // === Read status from Dropdown ===
        const selectedStatus = orderStatusSelect.value;

        // 2. Validation
        if (!selectedCustomerId) throw new Error("Please select an existing customer.");
        if (!customerData.fullName) { throw new Error("Full Name is required."); }
        if (!customerData.whatsappNo) throw new Error("WhatsApp No required.");
        if (addedProducts.length === 0) throw new Error("Add at least one product.");
        if (!orderDetails.orderDate) throw new Error("Order Date required.");
        if (!selectedStatus) throw new Error("Please select an order status.");


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
            console.log("Order updated:", orderIdToEdit); alert('Order updated successfully!');
        } else {
            orderDataPayload.createdAt = new Date(); const newOrderRef = await addDoc(collection(db, "orders"), orderDataPayload); orderDocRefPath = newOrderRef.path;
            console.log("New order saved:", newOrderRef.id); alert('New order saved successfully!'); displayOrderIdInput.value = orderIdToUse;
        }

        // 7. Save to Daily Report (Placeholder)
        await saveToDailyReport(orderDataPayload, orderDocRefPath);

        // === 8. Conditional WhatsApp Reminder ===
        const showReminderStatuses = ["Order Received", "Verification", "Delivered"];
        if (showReminderStatuses.includes(selectedStatus)) {
             console.log(`Status (${selectedStatus}) matches criteria, showing WhatsApp reminder.`);
             showWhatsAppReminder(customerData, orderIdToUse, orderDetails.deliveryDate, selectedStatus); // Pass status
        } else {
             console.log(`Status (${selectedStatus}) does not match criteria, skipping WhatsApp reminder.`);
        }
        // ======================================

        // 9. Reset form if new order
        if (!isEditMode) { resetNewOrderForm(); }

    } catch (error) { console.error("Error saving/updating order:", error); alert("Error: " + error.message);
    } finally { saveButton.disabled = false; const btnTxt = isEditMode ? "Update Order" : "Save Order"; saveButton.innerHTML = `<i class="fas fa-save"></i> <span>${btnTxt}</span>`; }
}

// --- Reset Form ---
function resetNewOrderForm() {
    console.log("Resetting form.");
    resetCustomerSelection();
    customerNameInput.value = ''; customerWhatsAppInput.value = ''; customerAddressInput.value = ''; customerContactInput.value = '';
    manualOrderIdInput.value = ''; displayOrderIdInput.value = '';
    orderForm.delivery_date.value = ''; orderForm.remarks.value = '';
    addedProducts = []; renderProductList();
    handleStatusDropdown(false, "Order Received"); // <<< Reset status dropdown
    const urgentNoRadio = orderForm.querySelector('input[name="urgent"][value="No"]'); if (urgentNoRadio) urgentNoRadio.checked = true;
    const orderDateInput = document.getElementById('order_date'); if (orderDateInput) orderDateInput.value = new Date().toISOString().split('T')[0];
}

// --- Post-Save Functions ---

// (Placeholder) Save to Daily Report
async function saveToDailyReport(orderData, orderPath) { /* (Same as before) */ }

// Show WhatsApp Reminder Popup (UPDATED for custom messages)
function showWhatsAppReminder(customer, orderId, deliveryDate, status) {
    if (!whatsappReminderPopup || !whatsappMsgPreview || !whatsappSendLink) { console.error("WhatsApp popup elements missing."); return; }
    const customerName = customer.fullName || 'Customer';
    const customerNumber = customer.whatsappNo?.replace(/[^0-9]/g, '');
    if (!customerNumber) { console.warn("WhatsApp No missing."); alert("Customer WhatsApp number is missing."); return; }

    let message = "";
    // Signature can be defined once
    const signature = "\n*Madhav Multy Print*\nMob. 9549116541";

    console.log(`Generating WhatsApp message for status: ${status}`);

    switch (status) {
        case "Order Received":
            let formattedDate = deliveryDate;
            if(deliveryDate) {
                try { // Format date nicely
                   formattedDate = new Date(deliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                } catch(e){ console.warn("Could not format delivery date", e)}
            }
            message = `Dear Customer ${customerName},\n`;
            message += `आपका ऑर्डर नंबर (*${orderId}*) हमें सफलतापूर्वक मिल गया है।\n`; // Using * for bold
            if (deliveryDate) {
                message += `हम approx date *${formattedDate}* तक डिलीवर कर देंगे।\n`; // Using * for bold
            }
            message += `धन्यवाद!`;
            break;
        case "Verification":
            message = `Dear Customer ${customerName},\n`;
            message += `आपकी डिजाईन ऑर्डर नंबर (*${orderId}*) आपको वेरिफिकेशन के लिए भेज दी गयी है।\n`; // Using * for bold
            message += `कृपया अच्छे से चेक करें और *OK* रिप्लाई करें।\n`; // Using * for bold
            message += `*OK करने के बाद कोई संशोधन नहीं किया जा सकता।*\n`; // Using * for bold
            message += `धन्यवाद!`;
            break;
        case "Delivered":
            message = `Dear Customer ${customerName},\n`;
            message += `आपका ऑर्डर नंबर (*${orderId}*) सफलतापूर्वक डिलीवर कर दिया गया है।\n`; // Using * for bold
            message += `सेवा का मौका देने के लिए धन्यवाद!`;
            break;
        default:
            console.warn(`WhatsApp reminder called for unhandled status: ${status}`);
            return; // Don't show popup for other statuses
    }

    message += signature; // Add signature

    // Show preview and set link
    whatsappMsgPreview.innerText = message; // Use innerText to preserve line breaks
    const encodedMessage = encodeURIComponent(message); // Encode for URL
    const whatsappUrl = `https://wa.me/${customerNumber}?text=${encodedMessage}`;
    whatsappSendLink.href = whatsappUrl;

    // Show popup
    whatsappReminderPopup.classList.add('active');
    console.log("WhatsApp reminder shown.");
}

// Close WhatsApp Popup
function closeWhatsAppPopup() {
      if (whatsappReminderPopup) whatsappReminderPopup.classList.remove('active');
}

// --- Include Autocomplete functions ---
// Make sure all functions from the previous working JS are here:
// getOrFetchCustomerCache, filterAndRenderCustomerSuggestions, renderCustomerSuggestions,
// fillCustomerData, resetCustomerSelection, getOrFetchProductCache,
// filterAndRenderProductSuggestions, renderProductSuggestions

// ... (Autocomplete functions - paste the full set from the previous working version here) ...
// Example placeholder:
async function getOrFetchCustomerCache() { /* ... Full function from previous code ... */ }
function filterAndRenderCustomerSuggestions(term, type, box) { /* ... Full function from previous code ... */ }
// ... etc. for all autocomplete related functions ...
async function getOrFetchProductCache() { /* ... Full function from previous code ... */ }
function filterAndRenderProductSuggestions(term, box) { /* ... Full function from previous code ... */ }


console.log("new_order.js script loaded (Client-Side Filtering + Dropdown + Conditional Msg + Close Btn).");