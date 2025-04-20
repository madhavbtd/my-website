// js/order_history.js

// Import Timestamp and arrayUnion from Firestore SDK
const { db, collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, Timestamp, arrayUnion } = window;

// --- DOM Elements ---
const orderTableBody = document.getElementById('orderTableBody');
const loadingRow = document.getElementById('loadingMessage');
// Filters & Sort
const sortSelect = document.getElementById('sort-orders');
const filterDateInput = document.getElementById('filterDate');
const filterSearchInput = document.getElementById('filterSearch');
const filterStatusSelect = document.getElementById('filterStatus');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
// Counts Display
const totalOrdersSpan = document.getElementById('total-orders');
const completedOrdersSpan = document.getElementById('completed-delivered-orders');
const pendingOrdersSpan = document.getElementById('pending-orders');

// Modal 1 Elements
const detailsModal = document.getElementById('detailsModal');
const closeModalBtn = document.getElementById('closeDetailsModal');
const modalOrderIdInput = document.getElementById('modalOrderId');
const modalDisplayOrderIdSpan = document.getElementById('modalDisplayOrderId');
const modalCustomerNameSpan = document.getElementById('modalCustomerName');
const modalCustomerWhatsAppSpan = document.getElementById('modalCustomerWhatsApp'); // WhatsApp Span
const modalOrderStatusSelect = document.getElementById('modalOrderStatus');
const modalUpdateStatusBtn = document.getElementById('modalUpdateStatusBtn');
const modalDeleteBtn = document.getElementById('modalDeleteBtn');
const modalEditFullBtn = document.getElementById('modalEditFullBtn');
const modalProductListContainer = document.getElementById('modalProductList'); // <<< Target for Product List
const modalStatusHistoryListContainer = document.getElementById('modalStatusHistoryList'); // History List

// Modal 2 Elements
const whatsappReminderPopup = document.getElementById('whatsapp-reminder-popup');
const whatsappPopupCloseBtn = document.getElementById('popup-close-btn');
const whatsappMsgPreview = document.getElementById('whatsapp-message-preview');
const whatsappSendLink = document.getElementById('whatsapp-send-link');

// --- Global State ---
let currentSortField = 'createdAt';
let currentSortDirection = 'desc';
let unsubscribeOrders = null;
let allOrdersCache = []; // Stores ALL raw order data
let searchDebounceTimer;
let currentStatusFilter = '';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DEBUG] Order History DOM Loaded (v12 - Final + BugFix + Design).");
    waitForDbConnection(() => {
        // Check for Status Filter from URL
        const urlParams = new URLSearchParams(window.location.search);
        currentStatusFilter = urlParams.get('status');
        if (currentStatusFilter && filterStatusSelect) {
            filterStatusSelect.value = currentStatusFilter;
        }
        listenForOrders(); // Start listener

        // Event Listeners
        if (sortSelect) sortSelect.addEventListener('change', handleSortChange);
        if (filterDateInput) filterDateInput.addEventListener('change', handleFilterChange);
        if (filterSearchInput) filterSearchInput.addEventListener('input', handleSearchInput);
        if (filterStatusSelect) filterStatusSelect.addEventListener('change', handleFilterChange);
        if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
        // Modal Listeners...
         if (closeModalBtn) closeModalBtn.addEventListener('click', closeDetailsModal);
         if (detailsModal) detailsModal.addEventListener('click', (event) => { if (event.target === detailsModal) closeDetailsModal(); });
         if (modalUpdateStatusBtn) modalUpdateStatusBtn.addEventListener('click', handleUpdateStatus);
         if (modalDeleteBtn) modalDeleteBtn.addEventListener('click', handleDeleteFromModal);
         if (modalEditFullBtn) modalEditFullBtn.addEventListener('click', handleEditFullFromModal);
         if (whatsappPopupCloseBtn) whatsappPopupCloseBtn.addEventListener('click', closeWhatsAppPopup);
         if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (event) => { if (event.target === whatsappReminderPopup) closeWhatsAppPopup(); });

        // Event Delegation for table buttons
        orderTableBody.addEventListener('click', function(event) {
            const target = event.target;
            const row = target.closest('tr');
            if (!row || !row.dataset.id) return;
            const firestoreId = row.dataset.id;
            const orderData = allOrdersCache.find(o => o.id === firestoreId); // Find data from cache
            if (!orderData) { console.warn(`[DEBUG] Order data not found in cache for ID: ${firestoreId}`); return; } // Exit if data not found
            if (target.closest('.details-edit-button')) { openDetailsModal(firestoreId, orderData); }
            else if (target.closest('.whatsapp-button')) { sendWhatsAppMessage(firestoreId, orderData); }
        });
    });
});

// --- DB Connection Wait ---
function waitForDbConnection(callback) { if(window.db){callback();}else{let a=0,m=20,i=setInterval(()=>{a++;if(window.db){clearInterval(i);callback();}else if(a>=m){clearInterval(i);console.error("DB timeout");alert("DB Error");}},250);} }

// --- Sorting & Filtering Handlers ---
function handleSortChange() { if (!sortSelect) return; const [field, direction] = sortSelect.value.split('_'); if (field && direction) { if (field === currentSortField && direction === currentSortDirection) return; currentSortField = field; currentSortDirection = direction; applyFiltersAndRender(); } }
function handleFilterChange() { applyFiltersAndRender(); }
function handleSearchInput() { clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(applyFiltersAndRender, 300); }
function clearFilters() { if(filterDateInput) filterDateInput.value = ''; if(filterSearchInput) filterSearchInput.value = ''; if(filterStatusSelect) filterStatusSelect.value = ''; if(sortSelect) sortSelect.value = 'createdAt_desc'; currentSortField = 'createdAt'; currentSortDirection = 'desc'; currentStatusFilter = ''; if (history.pushState){ const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname; window.history.pushState({path:cleanUrl},'',cleanUrl); } applyFiltersAndRender(); }

// --- Firestore Listener ---
function listenForOrders() {
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    if (!db || !collection || !query || !orderBy || !onSnapshot) return;
    orderTableBody.innerHTML = `<tr><td colspan="9" id="loadingMessage">Loading...</td></tr>`; // Colspan=9
    try {
        const q = query(collection(db, "orders")); // Fetch all initially
        unsubscribeOrders = onSnapshot(q, (snapshot) => {
            allOrdersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            applyFiltersAndRender(); // Apply filters/sort to the new list
        }, (error) => { console.error("Error fetching orders:", error); /*...*/ });
    } catch (error) { console.error("Error setting up listener:", error); /*...*/ }
}

// --- Filter, Sort, Render ---
function applyFiltersAndRender() {
    if (!allOrdersCache) return;
    const filterDateValue = filterDateInput ? filterDateInput.value : '';
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';
    const filterStatusValue = filterStatusSelect ? filterStatusSelect.value : '';
    currentStatusFilter = filterStatusValue; // Keep track of selected status

    // Filter
    let filteredOrders = allOrdersCache.filter(order => {
        if (filterStatusValue && order.status !== filterStatusValue) return false;
        if (filterDateValue && (!order.orderDate || order.orderDate !== filterDateValue)) return false;
        if (filterSearchValue) {
            const orderIdString = order.orderId || ''; const customerNameString = order.customerDetails?.fullName || ''; const firestoreIdString = order.id || '';
            const productsString = (order.products || []).map(p => p.name || '').join(' ').toLowerCase();
             if (!(orderIdString.toLowerCase().includes(filterSearchValue) || customerNameString.toLowerCase().includes(filterSearchValue) || firestoreIdString.toLowerCase().includes(filterSearchValue) || productsString.includes(filterSearchValue) )) return false;
        }
        return true;
    });

    // Sort
    filteredOrders.sort((a, b) => {
        let valA = a[currentSortField]; let valB = b[currentSortField];
        if (valA && typeof valA.toDate === 'function') valA = valA.toDate(); if (valB && typeof valB.toDate === 'function') valB = valB.toDate();
        if (currentSortField === 'orderDate' || currentSortField === 'deliveryDate') { valA = valA ? new Date(valA) : null; valB = valB ? new Date(valB) : null; if (!valA && !valB) return 0; if (!valA) return currentSortDirection === 'asc' ? 1 : -1; if (!valB) return currentSortDirection === 'asc' ? -1 : 1; }
        let comparison = 0; if (valA > valB) comparison = 1; else if (valA < valB) comparison = -1;
        return currentSortDirection === 'desc' ? comparison * -1 : comparison;
     });

    // Update Counts based on FILTERED list
    updateOrderCounts(filteredOrders);

    // Render table
    orderTableBody.innerHTML = '';
    if (filteredOrders.length === 0) {
        orderTableBody.innerHTML = `<tr><td colspan="9" id="noOrdersMessage">No orders found.</td></tr>`; // Colspan=9
    } else {
        filteredOrders.forEach(order => { displayOrderRow(order.id, order); });
    }
}

// --- Update Order Counts Function ---
function updateOrderCounts(filteredOrders) {
    const total = filteredOrders.length;
    let completedDelivered = 0;
    filteredOrders.forEach(order => { if (order.status === 'Completed' || order.status === 'Delivered') completedDelivered++; });
    const pending = total - completedDelivered;
    if (totalOrdersSpan) totalOrdersSpan.textContent = total;
    if (completedOrdersSpan) completedOrdersSpan.textContent = completedDelivered;
    if (pendingOrdersSpan) pendingOrdersSpan.textContent = pending;
}

// --- Display Single Order Row ---
function displayOrderRow(firestoreId, data) {
    const tableRow = document.createElement('tr');
    tableRow.setAttribute('data-id', firestoreId);

    // Extract data
    const customerName = data.customerDetails?.fullName || 'N/A';
    const customerMobile = data.customerDetails?.whatsappNo || '-';
    const orderDate = data.orderDate ? new Date(data.orderDate).toLocaleDateString() : '-';
    const deliveryDate = data.deliveryDate ? new Date(data.deliveryDate).toLocaleDateString() : '-';
    const displayId = data.orderId || `(Sys: ${firestoreId.substring(0,6)}...)`;
    const status = data.status || 'Unknown';
    const priority = data.urgent || 'No';

    // Format products
    let productsHtml = '-';
    if (Array.isArray(data.products) && data.products.length > 0) {
        productsHtml = data.products.map(p => `${(p.name||'').replace(/</g,"&lt;")} (${p.quantity||'?'})`).join('<br>');
    }

    // CSS classes
    const statusClass = `status-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const priorityClass = priority === 'Yes' ? 'priority-yes' : 'priority-no';

    // Create table cells (9 columns)
    tableRow.innerHTML = `
        <td>${displayId}</td>
        <td>
            <span class="customer-name-display">${customerName}</span>
            <span class="customer-mobile-inline">${customerMobile}</span>
        </td>
        <td>${productsHtml}</td>
        <td>${orderDate}</td>
        <td>${deliveryDate}</td>
        <td class="${priorityClass}">${priority}</td>
        <td><span class="status-badge ${statusClass}">${status}</span></td>
        <td><button type="button" class="button details-edit-button"><i class="fas fa-info-circle"></i> Details/Edit</button></td>
        <td><button type="button" class="button whatsapp-button" title="Send Status on WhatsApp"><i class="fab fa-whatsapp"></i></button></td>
    `;
    orderTableBody.appendChild(tableRow);
}


// --- Modal 1 Handling ---
function openDetailsModal(firestoreId, orderData) {
    if (!orderData || !detailsModal) {
        console.error("Missing order data or modal element for ID:", firestoreId);
        return;
    }
    console.log("[DEBUG] Opening details modal for:", firestoreId, orderData);
    modalOrderIdInput.value = firestoreId;
    modalDisplayOrderIdSpan.textContent = orderData.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`;
    modalCustomerNameSpan.textContent = orderData.customerDetails?.fullName || 'N/A';
    modalCustomerWhatsAppSpan.textContent = orderData.customerDetails?.whatsappNo || 'N/A'; // Show WhatsApp
    modalOrderStatusSelect.value = orderData.status || '';

    // --- <<< BUG FIX START >>> ---
    // Populate Product List in Modal
    if (modalProductListContainer) {
        modalProductListContainer.innerHTML = ''; // Clear previous list
        const products = orderData.products; // Get products array from order data
        console.log("[DEBUG] Products for modal:", products);

        if (Array.isArray(products) && products.length > 0) {
            const ul = document.createElement('ul');
            ul.style.listStyle = 'none'; // Basic styling if needed
            ul.style.padding = '0';
            ul.style.margin = '0';
            products.forEach(product => {
                const li = document.createElement('li');
                li.style.marginBottom = '5px'; // Add some space between items
                li.style.paddingBottom = '5px';
                li.style.borderBottom = '1px dotted #eee';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'product-name'; // Use existing class from CSS if needed
                nameSpan.textContent = product.name || 'Unnamed Product';
                nameSpan.style.fontWeight = '600'; // Make name slightly bolder

                const qtySpan = document.createElement('span');
                qtySpan.className = 'product-qty-details'; // Use existing class from CSS if needed
                qtySpan.textContent = ` - Qty: ${product.quantity || '?'}`;
                qtySpan.style.fontSize = '0.9em';
                qtySpan.style.color = '#555';

                li.appendChild(nameSpan);
                li.appendChild(qtySpan);
                ul.appendChild(li);
            });
             // Remove border from last item
            if(ul.lastChild) ul.lastChild.style.borderBottom = 'none';
            modalProductListContainer.appendChild(ul);
        } else {
            // Use existing class from CSS for styling 'no products' message
            modalProductListContainer.innerHTML = '<p class="no-products">No products listed for this order.</p>';
            console.log("[DEBUG] No products found for this order.");
        }
    } else {
        console.error("[DEBUG] modalProductListContainer not found!");
    }
    // --- <<< BUG FIX END >>> ---


    // Populate Status History
    if (modalStatusHistoryListContainer) {
        modalStatusHistoryListContainer.innerHTML = '';
        const history = orderData.statusHistory;
        if (Array.isArray(history) && history.length > 0) {
             const sortedHistory = [...history].sort((a, b) => (b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0) - (a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0));
             const ul = document.createElement('ul');
             sortedHistory.forEach(entry => {
                const li = document.createElement('li');
                const statusSpan = document.createElement('span'); statusSpan.className='history-status'; statusSpan.textContent = entry.status || '?';
                const timeSpan = document.createElement('span'); timeSpan.className = 'history-time';
                if (entry.timestamp && entry.timestamp.toDate) { const d=entry.timestamp.toDate(); timeSpan.textContent = d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) + ', ' + d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}); } else { timeSpan.textContent = '?'; }
                li.append(statusSpan, timeSpan); ul.appendChild(li);
            });
            modalStatusHistoryListContainer.appendChild(ul);
        } else { modalStatusHistoryListContainer.innerHTML = '<p class="no-history">No status history.</p>'; }
    }
    detailsModal.style.display = 'flex';
}

function closeDetailsModal() { if (detailsModal) { detailsModal.style.display = 'none'; } }

// --- Modal 1 Action Handlers ---
async function handleUpdateStatus() {
    const firestoreId = modalOrderIdInput.value;
    const newStatus = modalOrderStatusSelect.value;
    if (!firestoreId || !newStatus || !db || !doc || !updateDoc || !arrayUnion || !Timestamp) { console.error("Update Status prerequisites failed."); return; }
    const orderData = allOrdersCache.find(o => o.id === firestoreId); if (!orderData) { console.error("Order data not found in cache for update."); return; }
    if(orderData.status === newStatus) { alert("Status is already set to '" + newStatus + "'."); return; }

    modalUpdateStatusBtn.disabled = true; modalUpdateStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    const historyEntry = { status: newStatus, timestamp: Timestamp.now() };

    try {
        const orderRef = doc(db, "orders", firestoreId);
        await updateDoc(orderRef, {
            status: newStatus,
            updatedAt: historyEntry.timestamp,
            statusHistory: arrayUnion(historyEntry) // Add history
        });
        console.log("[DEBUG] Status updated successfully for:", firestoreId);
        closeDetailsModal(); // Close modal immediately after successful update
        // Show WhatsApp reminder only if customer details are present
        if (orderData.customerDetails && orderData.customerDetails.whatsappNo) {
             showStatusUpdateWhatsAppReminder(orderData.customerDetails, orderData.orderId || `(Sys: ${firestoreId.substring(0,6)}...)`, newStatus);
        } else {
             alert("Status updated successfully!"); // Alert if no WhatsApp details
        }
    } catch (error) { console.error("Error updating status:", error); alert("Error updating status: " + error.message); }
    finally { modalUpdateStatusBtn.disabled = false; modalUpdateStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Status'; }
}

function handleDeleteFromModal() { const firestoreId = modalOrderIdInput.value; const displayId = modalDisplayOrderIdSpan.textContent; if (!firestoreId) return; closeDetailsModal(); handleDeleteOrder(firestoreId, displayId); }
function handleEditFullFromModal() { const firestoreId = modalOrderIdInput.value; if (!firestoreId) return; window.location.href = `new_order.html?editOrderId=${firestoreId}`; }

// --- Main Delete Order Function ---
async function handleDeleteOrder(firestoreId, orderDisplayId) { if (!db || !doc || !deleteDoc) { alert("Delete function unavailable."); return; } if (confirm(`Are you sure you want to delete Order ID: ${orderDisplayId}? This cannot be undone.`)) { try { console.log("[DEBUG] Deleting order:", firestoreId); await deleteDoc(doc(db, "orders", firestoreId)); console.log("[DEBUG] Order deleted."); alert("Order deleted successfully."); } catch (error) { console.error("Error deleting order:", error); alert("Error deleting order: " + error.message); } } else { console.log("[DEBUG] Deletion cancelled by user."); } }

// --- Modal 2 (WhatsApp Reminder) Handling ---
function showStatusUpdateWhatsAppReminder(customer, orderId, updatedStatus) { if (!whatsappReminderPopup) { console.error("WhatsApp Popup element missing."); return; } const customerName = customer.fullName || 'Customer'; const customerNumber = customer.whatsappNo?.replace(/[^0-9]/g, ''); if (!customerNumber) { console.warn("WhatsApp number missing for reminder."); return; } let message = getWhatsAppMessageTemplate(updatedStatus, customerName, orderId, null); whatsappMsgPreview.innerText = message; const encodedMessage = encodeURIComponent(message); const whatsappUrl = `https://wa.me/${customerNumber}?text=${encodedMessage}`; whatsappSendLink.href = whatsappUrl; whatsappReminderPopup.classList.add('active'); }
function closeWhatsAppPopup() { if (whatsappReminderPopup) { whatsappReminderPopup.classList.remove('active'); } }

// --- Table Row WhatsApp Button Handler ---
function sendWhatsAppMessage(firestoreId, orderData) { if (!orderData || !orderData.customerDetails || !orderData.customerDetails.whatsappNo) { alert("Customer WhatsApp number not found for this order."); return; } const customer = orderData.customerDetails; const orderId = orderData.orderId || `(Sys: ${firestoreId.substring(0,6)}...)`; const status = orderData.status; const deliveryDate = orderData.deliveryDate; const customerName = customer.fullName || 'Customer'; const customerNumber = customer.whatsappNo.replace(/[^0-9]/g, ''); let message = getWhatsAppMessageTemplate(status, customerName, orderId, deliveryDate); const encodedMessage = encodeURIComponent(message); const whatsappUrl = `https://wa.me/${customerNumber}?text=${encodedMessage}`; window.open(whatsappUrl, '_blank'); }

// --- Helper Function for WhatsApp Templates ---
function getWhatsAppMessageTemplate(status, customerName, orderId, deliveryDate) {
     const namePlaceholder = "[Customer Name]"; const orderNoPlaceholder = "[ORDER_NO]"; const deliveryDatePlaceholder = "[DELIVERY_DATE]";
     const companyName = "Madhav Offset"; const companyAddress = "Head Office: Moodh Market, Batadu"; const companyMobile = "9549116541";
     const signature = `धन्यवाद,\n${companyName}\n${companyAddress}\nMobile: ${companyMobile}`;
     let template = "";
     // Use provided deliveryDate if available, otherwise use a placeholder text
     let deliveryDateText = deliveryDate ? new Date(deliveryDate).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : "जल्द से जल्द (as soon as possible)";

     switch (status) {
        case "Order Received": template = `प्रिय ${namePlaceholder},\nनमस्कार,\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) हमें सफलतापूर्वक प्राप्त हो गया है।\nहम इस ऑर्डर को ${deliveryDatePlaceholder} तक पूर्ण करने का प्रयास करेंगे।\n\nDear ${namePlaceholder},\nWe have successfully received your order (Order No: ${orderNoPlaceholder}).\nWe aim to complete it by ${deliveryDatePlaceholder}.`; break;
        case "Designing": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) का डिज़ाइन तैयार किया जा रहा है।\nजैसे ही डिज़ाइन तैयार होगा, हम आपसे पुष्टि के लिए संपर्क करेंगे।\n\nDear ${namePlaceholder},\nThe design for your order (Order No: ${orderNoPlaceholder}) is in progress.\nWe’ll contact you for confirmation once it’s ready.`; break;
        case "Verification": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की डिज़ाइन आपके साथ साझा कर दी गई है।\nकृपया डिज़ाइन को ध्यानपूर्वक जाँचे और हमें अपनी अनुमति प्रदान करें।\nएक बार ‘OK’ कर देने के बाद किसी भी प्रकार का संशोधन संभव नहीं होगा।\n\nDear ${namePlaceholder},\nWe have shared the design for your order (Order No: ${orderNoPlaceholder}) with you.\nPlease review it carefully and provide your approval.\nOnce you confirm with ‘OK’, no further changes will be possible.`; break;
        case "Design Approved": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की डिज़ाइन स्वीकृत कर दी गई है।\nअब यह प्रिंटिंग प्रक्रिया के लिए आगे बढ़ाया जा रहा है।\n\nDear ${namePlaceholder},\nYour design for Order No: ${orderNoPlaceholder} has been approved.\nIt is now moving forward to the printing stage.`; break;
        case "Ready for Working": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) प्रिंटिंग के लिए पूरी तरह तैयार है।\nजल्द ही प्रिंटिंग प्रक्रिया शुरू की जाएगी।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) is ready for printing.\nWe’ll begin the printing process shortly.`; break;
        case "Printing": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) प्रिंट हो रहा है।\nपूरा होते ही आपको सूचित किया जाएगा।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) is currently being printed.\nWe will notify you once it’s done.`; break;
        case "Delivered": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) सफलतापूर्वक डिलीवर कर दिया गया है।\nकृपया पुष्टि करें कि आपने ऑर्डर प्राप्त कर लिया है।\nआपके सहयोग के लिए धन्यवाद।\nहमें आशा है कि आप हमें शीघ्र ही फिर से सेवा का अवसर देंगे।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) has been successfully delivered.\nPlease confirm the receipt.\nThank you for your support.\nWe hope to have the opportunity to serve you again soon.`; break;
        case "Completed": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) सफलतापूर्वक पूर्ण हो चुका है।\nआपके सहयोग के लिए धन्यवाद।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) has been successfully completed.\nThank you for your support.`; break;
        default: template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) का वर्तमान स्टेटस है: ${status}.\n\nDear ${namePlaceholder},\nThe current status for your order (Order No: ${orderNoPlaceholder}) is: ${status}.`;
     }
     // Replace placeholders sensitively
     let message = template.replace(new RegExp(namePlaceholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), customerName);
     message = message.replace(new RegExp(orderNoPlaceholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), orderId);
     message = message.replace(new RegExp(deliveryDatePlaceholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), deliveryDateText);
     message += `\n\n${signature}`;
     return message;
}

// --- Final Log ---
console.log("order_history.js script fully loaded and initialized (v12 - Final + BugFix + Design)."); // Updated log message