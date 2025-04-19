// js/new_order.js

// Ensure necessary functions are available globally
// ** Need to import/ensure these are available from inline script: **
// db, collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where,
// limit, orderBy, runTransaction, serverTimestamp, Timestamp, arrayUnion
const { db, collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, limit, orderBy, runTransaction, serverTimestamp, Timestamp, arrayUnion } = window;

// --- Global Variables, DOM References, Initialization, Helper Functions ---
// ... (Assume existing code for these is here and correct) ...
let addedProducts = [];
let isEditMode = false;
let orderIdToEdit = null;
let selectedCustomerId = null;
// ... (Other variables, DOM refs, event listeners setup) ...

// --- Load Order For Edit (No changes needed to logic) ---
async function loadOrderForEdit(docId) { /* ... */ }

// --- Product Handling (No changes needed) ---
function handleAddProduct() { /* ... */ }
function renderProductList() { /* ... */ }
function handleDeleteProduct(event) { /* ... */ }

// --- Status Checkbox Handling (No changes needed) ---
function handleStatusCheckboxes(isEditing) { /* ... */ }
function handleStatusChange(event) { /* ... */ }

// --- Autocomplete Functions (No changes needed) ---
// handleCustomerInput, getOrFetchCustomerCache, filterAndRenderCustomerSuggestions, renderCustomerSuggestions, fillCustomerData, resetCustomerSelection
// handleProductInput, getOrFetchProductCache, filterAndRenderProductSuggestions, renderProductSuggestions
// ... (Assume these functions exist here) ...


// --- <<< Updated Form Submit Handler >>> ---
async function handleFormSubmit(event) {
    event.preventDefault();
    if (!db || !collection || !addDoc || !doc || !updateDoc || !getDoc || !runTransaction || !serverTimestamp || !Timestamp || !arrayUnion) {
        alert("Database functions unavailable. Please refresh."); return;
    }
    const saveButton = document.getElementById('saveOrderBtn'); // Ensure button reference is correct
    if (!saveButton) return;
    saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        // Get form data
        const formData = new FormData(orderForm);
        const customerFullNameFromInput = customerNameInput.value.trim();
        const customerData = { fullName: customerFullNameFromInput, address: formData.get('address')?.trim() || '', whatsappNo: formData.get('whatsapp_no')?.trim() || '', contactNo: formData.get('contact_no')?.trim() || '' };
        const orderDetails = { manualOrderId: formData.get('manual_order_id')?.trim() || null, orderDate: formData.get('order_date') || '', deliveryDate: formData.get('delivery_date') || '', urgent: formData.get('urgent') || 'No', remarks: formData.get('remarks')?.trim() || '' };
        const statusCheckbox = orderForm.querySelector('input[name="order_status"]:checked');
        const selectedStatus = statusCheckbox ? statusCheckbox.value : 'Order Received';

        // Validation
        if (!selectedCustomerId) throw new Error("Please select an existing customer.");
        if (!customerData.fullName || !customerData.whatsappNo) throw new Error("Full Name and WhatsApp No required.");
        if (addedProducts.length === 0) throw new Error("Add at least one product.");
        if (!orderDetails.orderDate) throw new Error("Order Date required.");

        const customerIdToUse = selectedCustomerId;
        const currentTimestamp = Timestamp.now(); // Use Firestore Timestamp

        // Base Payload
        const orderDataPayload = {
            customerId: customerIdToUse,
            customerDetails: customerData,
            orderDate: orderDetails.orderDate,
            deliveryDate: orderDetails.deliveryDate,
            urgent: orderDetails.urgent,
            remarks: orderDetails.remarks,
            status: selectedStatus,
            products: addedProducts,
            updatedAt: currentTimestamp
        };

        // Initial History Entry
        const initialHistoryEntry = { status: selectedStatus, timestamp: currentTimestamp };
        orderDataPayload.statusHistory = [initialHistoryEntry]; // Initialize history array

        let orderDocRefPath;
        let finalOrderId;

        if (isEditMode) {
            // --- UPDATE ---
            if (!orderIdToEdit) throw new Error("Missing ID for update.");
            finalOrderId = displayOrderIdInput.value;
            orderDataPayload.orderId = finalOrderId; // Use existing orderId
            // Note: Only updating 'updatedAt'. History is only added on status change from history page.
            const orderRef = doc(db, "orders", orderIdToEdit);
            await updateDoc(orderRef, orderDataPayload);
            orderDocRefPath = orderRef.path; alert('Order updated successfully!');
        } else {
            // --- ADD ---
            const counterRef = doc(db, "counters", "orderCounter");
            const newOrderColRef = collection(db, "orders");

            // Transaction to get next Order ID (starting from 1001)
            finalOrderId = await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                let nextId = 1001; // Default start
                if (counterDoc.exists() && typeof counterDoc.data().lastId === 'number') {
                    nextId = counterDoc.data().lastId + 1;
                } else { console.log("Order counter invalid/missing, starting at 1001."); }
                transaction.set(counterRef, { lastId: nextId }, { merge: true });
                return nextId.toString(); // Return as string
            });

            orderDataPayload.orderId = finalOrderId; // Assign generated ID
            orderDataPayload.createdAt = currentTimestamp; // Set createdAt

            // Add the order document
            const newOrderRef = await addDoc(newOrderColRef, orderDataPayload);
            orderDocRefPath = newOrderRef.path; alert('New order saved successfully!');
            if(displayOrderIdInput) displayOrderIdInput.value = finalOrderId; // Show generated ID
        }

        // Post-save actions
        showWhatsAppReminder(customerData, finalOrderId, orderDetails.deliveryDate); // Use updated function
        if (!isEditMode) { resetNewOrderForm(); }

    } catch (error) {
        console.error("Error saving/updating order:", error);
        alert("Error: " + error.message);
    } finally {
        saveButton.disabled = false;
        const btnTxt = isEditMode ? "Update Order" : "Save Order";
        // Ensure span exists or update innerHTML directly
        const saveButtonSpan = saveButton.querySelector('span');
        if (saveButtonSpan) { saveButtonSpan.textContent = btnTxt; }
        else { saveButton.innerHTML = `<i class="fas fa-save"></i> ${btnTxt}`; }
    }
}
// --- <<< End Form Submit Handler >>> ---

// --- Reset Form (No changes needed) ---
function resetNewOrderForm() { /* ... */ }

// --- Post-Save Functions ---
// Placeholder for Daily Report save
async function saveToDailyReport(orderData, orderPath) { /* ... */ }

// --- <<< Updated WhatsApp Reminder Function (Uses Helper) >>> ---
function showWhatsAppReminder(customer, orderId, deliveryDate) {
    const whatsappReminderPopup = document.getElementById('whatsapp-reminder-popup'); // Get refs locally
    const whatsappMsgPreview = document.getElementById('whatsapp-message-preview');
    const whatsappSendLink = document.getElementById('whatsapp-send-link');
    if (!whatsappReminderPopup || !whatsappMsgPreview || !whatsappSendLink) { return; }
    const customerName = customer.fullName || 'Customer';
    const customerNumber = customer.whatsappNo?.replace(/[^0-9]/g, '');
    if (!customerNumber) { alert("Cust WhatsApp No missing."); return; }

    // Use helper for "Order Received" status
    let message = getWhatsAppMessageTemplate("Order Received", customerName, orderId, deliveryDate);

    whatsappMsgPreview.innerText = message;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customerNumber}?text=${encodedMessage}`;
    whatsappSendLink.href = whatsappUrl;
    whatsappReminderPopup.classList.add('active');
}
// --- <<< Helper Function for WhatsApp Templates (Copy from order_history.js) >>> ---
function getWhatsAppMessageTemplate(status, customerName, orderId, deliveryDate) {
     const namePlaceholder = "[Customer Name]"; const orderNoPlaceholder = "[ORDER_NO]"; const deliveryDatePlaceholder = "[DELIVERY_DATE]";
     const companyName = "Madhav Offset"; const companyAddress = "Head Office: Moodh Market, Batadu"; const companyMobile = "9549116541";
     const signature = `धन्यवाद,\n${companyName}\n${companyAddress}\nMobile: ${companyMobile}`;
     let template = ""; let deliveryDateText = deliveryDate || "N/A";
     switch (status) {
        case "Order Received": template = `प्रिय ${namePlaceholder},\nनमस्कार,\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) हमें सफलतापूर्वक प्राप्त हो गया है।\nहम इस ऑर्डर को ${deliveryDatePlaceholder} तक पूर्ण करने का प्रयास करेंगे।\n\nDear ${namePlaceholder},\nWe have successfully received your order (Order No: ${orderNoPlaceholder}).\nWe aim to complete it by ${deliveryDatePlaceholder}.`; break;
        case "Designing": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) का डिज़ाइन तैयार किया जा रहा है।\nजैसे ही डिज़ाइन तैयार होगा, हम आपसे पुष्टि के लिए संपर्क करेंगे।\n\nDear ${namePlaceholder},\nThe design for your order (Order No: ${orderNoPlaceholder}) is in progress.\nWe’ll contact you for confirmation once it’s ready.`; break;
        case "Verification": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की डिज़ाइन आपके साथ साझा कर दी गई है।\nकृपया डिज़ाइन को ध्यानपूर्वक जाँचे और हमें अपनी अनुमति प्रदान करें।\nएक बार ‘OK’ कर देने के बाद किसी भी प्रकार का संशोधन संभव नहीं होगा।\n\nDear ${namePlaceholder},\nWe have shared the design for your order (Order No: ${orderNoPlaceholder}) with you.\nPlease review it carefully and provide your approval.\nOnce you confirm with ‘OK’, no further changes will be possible.`; break;
        case "Design Approved": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की डिज़ाइन स्वीकृत कर दी गई है।\nअब यह प्रिंटिंग प्रक्रिया के लिए आगे बढ़ाया जा रहा है।\n\nDear ${namePlaceholder},\nYour design for Order No: ${orderNoPlaceholder} has been approved.\nIt is now moving forward to the printing stage.`; break;
        case "Ready for Working": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) प्रिंटिंग के लिए पूरी तरह तैयार है।\nजल्द ही प्रिंटिंग प्रक्रिया शुरू की जाएगी।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) is ready for printing.\nWe’ll begin the printing process shortly.`; break;
        case "Printing": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) प्रिंट हो रहा है।\nपूरा होते ही आपको सूचित किया जाएगा।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) is currently being printed.\nWe will notify you once it’s done.`; break;
        case "Delivered": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) सफलतापूर्वक डिलीवर कर दिया गया है।\nकृपया पुष्टि करें कि आपने ऑर्डर प्राप्त कर लिया है।\nआपके सहयोग के लिए धन्यवाद।\nहमें आशा है कि आप हमें शीघ्र ही फिर से सेवा का अवसर देंगे।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) has been successfully delivered.\nPlease confirm the receipt.\nThank you for your support.\nWe hope to have the opportunity to serve you again soon.`; break;
        case "Completed": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) सफलतापूर्वक पूर्ण हो चुका है।\nआपके सहयोग के लिए धन्यवाद。\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) has been successfully completed.\nThank you for your support.`; break;
        default: template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) का वर्तमान स्टेटस है: ${status}.\n\nDear ${namePlaceholder},\nThe current status for your order (Order No: ${orderNoPlaceholder}) is: ${status}.`;
     }
     let message = template.replace(new RegExp(namePlaceholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), customerName);
     message = message.replace(new RegExp(orderNoPlaceholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), orderId);
     message = message.replace(new RegExp(deliveryDatePlaceholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), deliveryDateText);
     message += `\n\n${signature}`;
     return message;
}
function closeWhatsAppPopup() { /* ... (Assume this exists) ... */ }

// ... (Other existing functions) ...

console.log("new_order.js loaded (with updates).");