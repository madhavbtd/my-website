// js/order_history.js
// अंतिम संस्करण - सभी सुधारों और नई फंक्शनलिटी के साथ

// Firebase फ़ंक्शंस को ग्लोबल माना गया है
const {
    db, collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, Timestamp, arrayUnion, writeBatch
} = window;

// --- DOM एलिमेंट्स ---
const orderTableBody = document.getElementById('orderTableBody');
const loadingRow = document.getElementById('loadingMessage');
const sortSelect = document.getElementById('sort-orders');
const filterDateInput = document.getElementById('filterDate');
const filterSearchInput = document.getElementById('filterSearch');
const filterStatusSelect = document.getElementById('filterStatus');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const totalOrdersSpan = document.getElementById('total-orders');
const completedOrdersSpan = document.getElementById('completed-delivered-orders');
const pendingOrdersSpan = document.getElementById('pending-orders');
const detailsModal = document.getElementById('detailsModal');
const closeModalBtn = document.getElementById('closeDetailsModal');
const modalOrderIdInput = document.getElementById('modalOrderId');
const modalDisplayOrderIdSpan = document.getElementById('modalDisplayOrderId');
const modalCustomerNameSpan = document.getElementById('modalCustomerName');
const modalCustomerWhatsAppSpan = document.getElementById('modalCustomerWhatsApp');
const modalOrderStatusSelect = document.getElementById('modalOrderStatus');
const modalUpdateStatusBtn = document.getElementById('modalUpdateStatusBtn');
const modalDeleteBtn = document.getElementById('modalDeleteBtn');
const modalEditFullBtn = document.getElementById('modalEditFullBtn');
const modalProductListContainer = document.getElementById('modalProductList');
const modalStatusHistoryListContainer = document.getElementById('modalStatusHistoryList');
const whatsappReminderPopup = document.getElementById('whatsapp-reminder-popup');
const whatsappPopupCloseBtn = document.getElementById('popup-close-btn');
const whatsappMsgPreview = document.getElementById('whatsapp-message-preview');
const whatsappSendLink = document.getElementById('whatsapp-send-link');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const bulkActionsBar = document.getElementById('bulkActionsBar');
const selectedCountSpan = document.getElementById('selectedCount');
const bulkStatusSelect = document.getElementById('bulkStatusSelect');
const bulkUpdateStatusBtn = document.getElementById('bulkUpdateStatusBtn');
const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
const reportingSection = document.getElementById('reportingSection');
const statusCountsReportContainer = document.getElementById('statusCountsReport');
// Bulk Delete Modal Elements
const bulkDeleteConfirmModal = document.getElementById('bulkDeleteConfirmModal');
const closeBulkDeleteModalBtn = document.getElementById('closeBulkDeleteModal');
const cancelBulkDeleteBtn = document.getElementById('cancelBulkDeleteBtn');
const confirmBulkDeleteBtn = document.getElementById('confirmBulkDeleteBtn');
const confirmDeleteCheckbox = document.getElementById('confirmDeleteCheckbox');
const bulkDeleteOrderList = document.getElementById('bulkDeleteOrderList');
const bulkDeleteCountSpan = document.getElementById('bulkDeleteCount');

// --- ग्लोबल स्टेट ---
let currentSortField = 'createdAt';
let currentSortDirection = 'desc';
let unsubscribeOrders = null;
let allOrdersCache = [];
let currentlyDisplayedOrders = [];
let searchDebounceTimer;
let currentStatusFilter = '';
let orderIdToOpenFromUrl = null;
let modalOpenedFromUrl = false;
let selectedOrderIds = new Set();

// --- इनिशियलाइज़ेशन ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DEBUG] Order History DOM Loaded. Initializing final version.");

    const urlParams = new URLSearchParams(window.location.search);
    orderIdToOpenFromUrl = urlParams.get('openModalForId');
    currentStatusFilter = urlParams.get('status');

    if (orderIdToOpenFromUrl) console.log(`[DEBUG] Request to open modal for ID: ${orderIdToOpenFromUrl}`);
    if (currentStatusFilter && filterStatusSelect) filterStatusSelect.value = currentStatusFilter;

    waitForDbConnection(() => {
        listenForOrders();

        // --- इवेंट लिस्टनर्स (मौजूदा और नए) ---
        if (sortSelect) sortSelect.addEventListener('change', handleSortChange);
        if (filterDateInput) filterDateInput.addEventListener('change', handleFilterChange);
        if (filterSearchInput) filterSearchInput.addEventListener('input', handleSearchInput);
        if (filterStatusSelect) filterStatusSelect.addEventListener('change', handleFilterChange);
        if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeDetailsModal);
        if (detailsModal) detailsModal.addEventListener('click', (event) => { if (event.target === detailsModal) closeDetailsModal(); });
        if (modalUpdateStatusBtn) modalUpdateStatusBtn.addEventListener('click', handleUpdateStatus);
        if (modalDeleteBtn) modalDeleteBtn.addEventListener('click', handleDeleteFromModal);
        if (modalEditFullBtn) modalEditFullBtn.addEventListener('click', handleEditFullFromModal);
        if (whatsappPopupCloseBtn) whatsappPopupCloseBtn.addEventListener('click', closeWhatsAppPopup);
        if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (event) => { if (event.target === whatsappReminderPopup) closeWhatsAppPopup(); });
        if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCsv);
        if (selectAllCheckbox) selectAllCheckbox.addEventListener('change', handleSelectAllChange);
        if (bulkUpdateStatusBtn) bulkUpdateStatusBtn.addEventListener('click', handleBulkUpdateStatus);
        if (bulkDeleteBtn) bulkDeleteBtn.addEventListener('click', handleBulkDelete); // यह अब मोडल खोलेगा
        if (bulkStatusSelect) bulkStatusSelect.addEventListener('change', updateBulkActionsBar); // Enable/disable update button

        // --- Bulk Delete Modal Listeners ---
        if (confirmDeleteCheckbox && confirmBulkDeleteBtn) {
            confirmDeleteCheckbox.addEventListener('change', () => {
                confirmBulkDeleteBtn.disabled = !confirmDeleteCheckbox.checked;
            });
        }
        if (confirmBulkDeleteBtn) {
            confirmBulkDeleteBtn.addEventListener('click', () => {
                if (confirmDeleteCheckbox.checked) {
                     const idsToDelete = Array.from(selectedOrderIds);
                     executeBulkDelete(idsToDelete);
                }
            });
        }
        if (cancelBulkDeleteBtn) cancelBulkDeleteBtn.addEventListener('click', closeBulkDeleteModal);
        if (closeBulkDeleteModalBtn) closeBulkDeleteModalBtn.addEventListener('click', closeBulkDeleteModal);
        if (bulkDeleteConfirmModal) bulkDeleteConfirmModal.addEventListener('click', (event) => { if (event.target === bulkDeleteConfirmModal) closeBulkDeleteModal(); });


        // --- टेबल के लिए इवेंट डेलिगेशन ---
        if (orderTableBody) {
            orderTableBody.addEventListener('click', function(event) {
                const target = event.target;
                const row = target.closest('tr');
                if (!row || !row.dataset.id) return;
                const firestoreId = row.dataset.id;
                const orderData = allOrdersCache.find(o => o.id === firestoreId);
                if (!orderData) { console.warn(`[DEBUG] Order data not found for ID: ${firestoreId}`); return; }

                if (target.matches('.row-selector')) {
                    handleRowCheckboxChange(target, firestoreId);
                } else if (target.closest('.details-edit-button')) {
                    openDetailsModal(firestoreId, orderData);
                } else if (target.closest('.whatsapp-button')) {
                    sendWhatsAppMessage(firestoreId, orderData);
                }
            });
        } else {
            console.error("ID 'orderTableBody' वाला एलिमेंट नहीं मिला!");
        }
    });
});

// --- DB कनेक्शन प्रतीक्षा ---
function waitForDbConnection(callback) {
    if (window.db) { callback(); }
    else {
        let a = 0, m = 20, i = setInterval(() => { a++; if (window.db) { clearInterval(i); callback(); } else if (a >= m) { clearInterval(i); console.error("DB connection timeout (order_history.js)"); alert("Database connection failed."); } }, 250);
    }
}

// --- सॉर्टिंग और फ़िल्टरिंग हैंडलर्स ---
function handleSortChange() {
    if (!sortSelect) return;
    const [field, direction] = sortSelect.value.split('_');
    if (field && direction) { currentSortField = field; currentSortDirection = direction; applyFiltersAndRender(); }
}
function handleFilterChange() { applyFiltersAndRender(); }
function handleSearchInput() { clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(applyFiltersAndRender, 300); }
function clearFilters() {
    if (filterDateInput) filterDateInput.value = '';
    if (filterSearchInput) filterSearchInput.value = '';
    if (filterStatusSelect) filterStatusSelect.value = '';
    if (sortSelect) sortSelect.value = 'createdAt_desc';
    currentSortField = 'createdAt'; currentSortDirection = 'desc'; currentStatusFilter = '';
    selectedOrderIds.clear(); updateBulkActionsBar();
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    if (history.replaceState) { const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname; window.history.replaceState({ path: cleanUrl }, '', cleanUrl); }
    applyFiltersAndRender();
}

// --- Firestore लिस्टनर ---
function listenForOrders() {
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; console.log("[DEBUG] पिछला लिस्टनर अनसब्सक्राइब किया गया।"); }
    if (!db || !collection || !query || !orderBy || !onSnapshot) { console.error("Firestore लिस्टनर फ़ंक्शन मौजूद नहीं हैं।"); return; }
    if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="10" id="loadingMessage">ऑर्डर लोड हो रहे हैं...</td></tr>`;

    try {
        const q = query(collection(db, "orders")); // शुरुआत में सभी ऑर्डर लाएं
        console.log("[DEBUG] ऑर्डर्स के लिए Firestore लिस्टनर सेट किया जा रहा है...");
        unsubscribeOrders = onSnapshot(q, (snapshot) => {
            console.log(`[DEBUG] ऑर्डर स्नैपशॉट मिला। कुल ${snapshot.size} डॉक्यूमेंट्स।`);
            allOrdersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); // सरलीकृत मैपिंग
            console.log(`[DEBUG] allOrdersCache ${allOrdersCache.length} ऑर्डर्स के साथ पॉप्युलेट हुआ।`);
            selectedOrderIds.clear(); updateBulkActionsBar(); if (selectAllCheckbox) selectAllCheckbox.checked = false;
            applyFiltersAndRender(); attemptOpenModalFromUrl();
        }, (error) => {
            console.error("[DEBUG] ऑर्डर्स स्नैपशॉट लाने में त्रुटि:", error);
            if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="10" style="color: red;">ऑर्डर लोड करने में त्रुटि। कृपया पुनः प्रयास करें।</td></tr>`;
        });
    } catch (error) {
        console.error("[DEBUG] Firestore लिस्टनर सेट करने में त्रुटि:", error);
        if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="10" style="color: red;">लिस्टनर सेट करने में त्रुटि।</td></tr>`;
    }
}

// --- फ़िल्टर, सॉर्ट, रेंडर फ़ंक्शन ---
function applyFiltersAndRender() {
    if (!allOrdersCache) { console.warn("[DEBUG] applyFiltersAndRender कॉल हुआ लेकिन कैश खाली है।"); return; }

    const filterDateValue = filterDateInput ? filterDateInput.value : '';
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';
    const filterStatusValue = filterStatusSelect ? filterStatusSelect.value : '';
    currentStatusFilter = filterStatusValue;

    // फ़िल्टर
    let filteredOrders = allOrdersCache.filter(order => {
        if (filterStatusValue && order.status !== filterStatusValue) return false;
        if (filterDateValue && order.orderDate !== filterDateValue) return false;
        if (filterSearchValue) {
            const orderIdString = String(order.orderId || '');
            const customerNameString = order.customerDetails?.fullName || '';
            const firestoreIdString = order.id || '';
            const productsString = (order.products || []).map(p => String(p.name || '')).join(' ').toLowerCase();
            const mobileString = String(order.customerDetails?.whatsappNo || '');
            if (!(orderIdString.toLowerCase().includes(filterSearchValue) ||
                  customerNameString.toLowerCase().includes(filterSearchValue) ||
                  firestoreIdString.toLowerCase().includes(filterSearchValue) ||
                  productsString.includes(filterSearchValue) ||
                  mobileString.includes(filterSearchValue))) {
                return false;
            }
        }
        return true;
    });

    // सॉर्ट
    try {
        filteredOrders.sort((a, b) => {
            let valA = a[currentSortField];
            let valB = b[currentSortField];
            if (valA && typeof valA.toDate === 'function') valA = valA.toDate().getTime();
            if (valB && typeof valB.toDate === 'function') valB = valB.toDate().getTime();
            if (currentSortField === 'orderDate' || currentSortField === 'deliveryDate') {
                valA = valA ? new Date(valA).getTime() : (currentSortDirection === 'asc' ? Infinity : -Infinity);
                valB = valB ? new Date(valB).getTime() : (currentSortDirection === 'asc' ? Infinity : -Infinity);
            }
            let sortComparison = 0;
            if (valA > valB) sortComparison = 1;
            else if (valA < valB) sortComparison = -1;
            return currentSortDirection === 'desc' ? sortComparison * -1 : sortComparison;
        });
    } catch (sortError) { console.error("[DEBUG] सॉर्टिंग के दौरान त्रुटि:", sortError); }

    currentlyDisplayedOrders = filteredOrders;
    updateOrderCountsAndReport(currentlyDisplayedOrders);

    // टेबल रेंडर करें
    if (!orderTableBody) { console.error("रेंडर के दौरान orderTableBody नहीं मिला!"); return; }
    orderTableBody.innerHTML = '';
    if (currentlyDisplayedOrders.length === 0) {
        orderTableBody.innerHTML = `<tr><td colspan="10" id="noOrdersMessage">आपकी खोज से मेल खाता कोई ऑर्डर नहीं मिला।</td></tr>`;
    } else {
        const searchTerm = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';
        currentlyDisplayedOrders.forEach(order => {
            displayOrderRow(order.id, order, searchTerm);
        });
    }

    // Select All चेकबॉक्स स्टेट अपडेट करें
    if (selectAllCheckbox) {
        const allVisibleCheckboxes = orderTableBody.querySelectorAll('.row-selector');
        const allVisibleSelected = allVisibleCheckboxes.length > 0 && Array.from(allVisibleCheckboxes).every(cb => cb.checked);
        const someVisibleChecked = Array.from(allVisibleCheckboxes).some(cb => cb.checked);
        selectAllCheckbox.checked = allVisibleSelected;
        selectAllCheckbox.indeterminate = !allVisibleSelected && someVisibleChecked;
     }
}

// --- ऑर्डर काउंट और रिपोर्ट अपडेट करें ---
function updateOrderCountsAndReport(displayedOrders) {
    const total = displayedOrders.length;
    let completedDelivered = 0;
    const statusCounts = {};
    displayedOrders.forEach(order => {
        const status = order.status || 'Unknown';
        if (status === 'Completed' || status === 'Delivered') completedDelivered++;
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    const pending = total - completedDelivered;
    if (totalOrdersSpan) totalOrdersSpan.textContent = total;
    if (completedOrdersSpan) completedOrdersSpan.textContent = completedDelivered;
    if (pendingOrdersSpan) pendingOrdersSpan.textContent = pending;
    if (statusCountsReportContainer) {
        if (total === 0) { statusCountsReportContainer.innerHTML = '<p>रिपोर्ट के लिए कोई ऑर्डर नहीं।</p>'; }
        else {
            let reportHtml = '<ul>';
            Object.keys(statusCounts).sort().forEach(status => { reportHtml += `<li>${status}: <strong>${statusCounts[status]}</strong></li>`; });
            reportHtml += '</ul>';
            statusCountsReportContainer.innerHTML = reportHtml;
        }
    }
}

// --- सिंगल ऑर्डर रो डिस्प्ले करें (अपडेटेड) ---
function displayOrderRow(firestoreId, data, searchTerm = '') {
    if (!orderTableBody) return;
    const tableRow = document.createElement('tr');
    tableRow.setAttribute('data-id', firestoreId);
    if (selectedOrderIds.has(firestoreId)) tableRow.classList.add('selected-row');

    const customerName = data.customerDetails?.fullName || 'N/A';
    const customerMobile = data.customerDetails?.whatsappNo || '-';
    const orderDateStr = data.orderDate ? new Date(data.orderDate).toLocaleDateString('en-GB') : '-'; // ** सही फ़ॉर्मेटिंग सुनिश्चित करें **
    const deliveryDateStr = data.deliveryDate ? new Date(data.deliveryDate).toLocaleDateString('en-GB') : '-'; // ** सही फ़ॉर्मेटिंग सुनिश्चित करें **
    const displayId = data.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`;
    const status = data.status || 'Unknown';
    const priority = data.urgent === 'Yes' ? 'Yes' : 'No';

    let productsHtml = '-';
    if (Array.isArray(data.products) && data.products.length > 0) {
        productsHtml = data.products.map(p => {
            const name = escapeHtml(String(p.name || 'Unnamed'));
            const quantity = escapeHtml(String(p.quantity || '?'));
            return `${highlightMatch(name, searchTerm)} (${highlightMatch(quantity, searchTerm)})`;
        }).join('<br>');
    }

    const statusClass = `status-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const priorityClass = priority === 'Yes' ? 'priority-yes' : 'priority-no';

    function highlightMatch(text, term) {
        if (!term || !text) return text;
        try {
            const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`(${escapedTerm})`, 'gi');
            return text.replace(regex, '<mark>$1</mark>');
        } catch (e) { console.warn("Highlighting regex error:", e); return text; }
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return "";
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // ** सही किया गया इनर HTML **
    tableRow.innerHTML = `
        <td class="col-checkbox"><input type="checkbox" class="row-selector" data-id="${firestoreId}" ${selectedOrderIds.has(firestoreId) ? 'checked' : ''}></td>
        <td>${highlightMatch(escapeHtml(displayId), searchTerm)}</td>
        <td>
            <span class="customer-name-display">${highlightMatch(escapeHtml(customerName), searchTerm)}</span>
            <span class="customer-mobile-inline">${highlightMatch(escapeHtml(customerMobile), searchTerm)}</span>
        </td>
        <td>${productsHtml}</td>
        <td>${orderDateStr}</td> {/* <<<--- यहाँ कोई अतिरिक्त कमेंट नहीं */}
        <td>${deliveryDateStr}</td>
        <td class="${priorityClass}">${priority}</td>
        <td><span class="status-badge ${statusClass}">${highlightMatch(escapeHtml(status), searchTerm)}</span></td>
        <td><button type="button" class="button details-edit-button"><i class="fas fa-info-circle"></i> Details/Edit</button></td>
        <td><button type="button" class="button whatsapp-button" title="Send Status on WhatsApp"><i class="fab fa-whatsapp"></i></button></td>
    `;
    orderTableBody.appendChild(tableRow);
}


// --- मोडल 1 हैंडलिंग (विवरण/संपादन पॉपअप) ---
function openDetailsModal(firestoreId, orderData) {
    if (!orderData || !detailsModal) { console.error("ऑर्डर डेटा या मोडल एलिमेंट मौजूद नहीं:", firestoreId); return; }
    if (!modalOrderIdInput || !modalDisplayOrderIdSpan || !modalCustomerNameSpan || !modalCustomerWhatsAppSpan || !modalOrderStatusSelect || !modalProductListContainer || !modalStatusHistoryListContainer) { console.error("एक या अधिक मोडल एलिमेंट नहीं मिले!"); return; }
    console.log("[DEBUG] विवरण मोडल खोला जा रहा है:", firestoreId);
    modalOrderIdInput.value = firestoreId;
    modalDisplayOrderIdSpan.textContent = orderData.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`;
    modalCustomerNameSpan.textContent = orderData.customerDetails?.fullName || 'N/A';
    modalCustomerWhatsAppSpan.textContent = orderData.customerDetails?.whatsappNo || 'N/A';
    modalOrderStatusSelect.value = orderData.status || '';

    // उत्पाद सूची पॉप्युलेट करें
    modalProductListContainer.innerHTML = '';
    const products = orderData.products;
    if (Array.isArray(products) && products.length > 0) {
        const ul = document.createElement('ul');
        products.forEach(product => {
            const li = document.createElement('li');
            const nameSpan = document.createElement('span'); nameSpan.className = 'product-name'; nameSpan.textContent = product.name || 'Unnamed';
            const qtySpan = document.createElement('span'); qtySpan.className = 'product-qty-details'; qtySpan.textContent = ` - Qty: ${product.quantity || '?'}`;
            li.append(nameSpan, qtySpan); ul.appendChild(li);
        });
        modalProductListContainer.appendChild(ul);
    } else { modalProductListContainer.innerHTML = '<p class="no-products">कोई उत्पाद सूचीबद्ध नहीं है।</p>'; }

    // स्थिति इतिहास पॉप्युलेट करें
    modalStatusHistoryListContainer.innerHTML = '';
    const history = orderData.statusHistory;
    if (Array.isArray(history) && history.length > 0) {
         const sortedHistory = [...history].sort((a, b) => (b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0) - (a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0));
         const ul = document.createElement('ul');
         sortedHistory.forEach(entry => {
            const li = document.createElement('li');
            const statusSpan = document.createElement('span'); statusSpan.className = 'history-status'; statusSpan.textContent = entry.status || '?';
            const timeSpan = document.createElement('span'); timeSpan.className = 'history-time';
            if (entry.timestamp && entry.timestamp.toDate) { const d=entry.timestamp.toDate(); timeSpan.textContent = d.toLocaleDateString('en-GB',{day:'numeric',month:'short'}) + ' ' + d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}); } else { timeSpan.textContent = '?'; }
            li.append(statusSpan, timeSpan); ul.appendChild(li);
        });
        modalStatusHistoryListContainer.appendChild(ul);
    } else { modalStatusHistoryListContainer.innerHTML = '<p class="no-history">कोई स्थिति इतिहास नहीं।</p>'; }

    detailsModal.style.display = 'flex';
}
function closeDetailsModal() { if (detailsModal) detailsModal.style.display = 'none'; }

// --- मोडल 1 एक्शन हैंडलर्स (सिंगल अपडेट/डिलीट) ---
async function handleUpdateStatus() { /* ... पहले जैसा ही ... */
    const firestoreId = modalOrderIdInput.value;
    const newStatus = modalOrderStatusSelect.value;
    if (!firestoreId || !newStatus || !db || !doc || !updateDoc || !arrayUnion || !Timestamp) { console.error("Update Status prerequisites failed."); return; }
    const orderData = allOrdersCache.find(o => o.id === firestoreId); if (!orderData) { console.error("Order data not found in cache for update."); return; }
    if (orderData.status === newStatus) { alert("Status is already set to '" + newStatus + "'."); return; }
    if (modalUpdateStatusBtn) { modalUpdateStatusBtn.disabled = true; modalUpdateStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; }
    const historyEntry = { status: newStatus, timestamp: Timestamp.now() };
    try {
        const orderRef = doc(db, "orders", firestoreId);
        await updateDoc(orderRef, { status: newStatus, updatedAt: historyEntry.timestamp, statusHistory: arrayUnion(historyEntry) });
        console.log("[DEBUG] Status updated successfully for:", firestoreId);
        closeDetailsModal();
        if (orderData.customerDetails && orderData.customerDetails.whatsappNo) {
            showStatusUpdateWhatsAppReminder(orderData.customerDetails, orderData.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`, newStatus);
        } else { alert("Status updated successfully!"); }
    } catch (error) { console.error("Error updating status:", error); alert("Error updating status: " + error.message); }
    finally { if (modalUpdateStatusBtn) { modalUpdateStatusBtn.disabled = false; modalUpdateStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Status'; } }
}

function handleDeleteFromModal() { /* ... पहले जैसा ही ... */
    const firestoreId = modalOrderIdInput.value;
    const displayId = modalDisplayOrderIdSpan.textContent;
    if (!firestoreId) return;
    closeDetailsModal();
    if (confirm(`Are you sure you want to delete Order ID: ${displayId}? This cannot be undone.`)) {
        deleteSingleOrder(firestoreId);
    } else { console.log("[DEBUG] Deletion cancelled by user."); }
}

async function deleteSingleOrder(firestoreId) { /* ... पहले जैसा ही ... */
     if (!db || !doc || !deleteDoc) { alert("Delete function unavailable."); return; }
     try {
         console.log("[DEBUG] Deleting single order:", firestoreId);
         await deleteDoc(doc(db, "orders", firestoreId));
         console.log("[DEBUG] Single order deleted.");
         alert("Order deleted successfully.");
     } catch (error) { console.error("Error deleting single order:", error); alert("Error deleting order: " + error.message); }
}

function handleEditFullFromModal() { const firestoreId = modalOrderIdInput.value; if (!firestoreId) return; window.location.href = `new_order.html?editOrderId=${firestoreId}`; }

// --- WhatsApp फ़ंक्शंस ---
function showStatusUpdateWhatsAppReminder(customer, orderId, updatedStatus) { /* ... पहले जैसा ही ... */
    if (!whatsappReminderPopup || !whatsappMsgPreview || !whatsappSendLink) { console.error("WhatsApp Popup elements missing."); return; }
    const customerName = customer.fullName || 'Customer';
    const customerNumber = customer.whatsappNo?.replace(/[^0-9]/g, '');
    if (!customerNumber) { console.warn("WhatsApp number missing for reminder."); return; }
    let message = getWhatsAppMessageTemplate(updatedStatus, customerName, orderId, null);
    whatsappMsgPreview.innerText = message;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customerNumber}?text=${encodedMessage}`;
    whatsappSendLink.href = whatsappUrl;
    const whatsappPopupTitle = document.getElementById('whatsapp-popup-title');
    if(whatsappPopupTitle) whatsappPopupTitle.textContent = "Status Updated!";
    whatsappReminderPopup.classList.add('active');
}
function closeWhatsAppPopup() { if (whatsappReminderPopup) whatsappReminderPopup.classList.remove('active'); }
function sendWhatsAppMessage(firestoreId, orderData) { /* ... पहले जैसा ही ... */
     if (!orderData || !orderData.customerDetails || !orderData.customerDetails.whatsappNo) { alert("Customer WhatsApp number not found for this order."); return; }
    const customer = orderData.customerDetails;
    const orderId = orderData.orderId || `(Sys: ${firestoreId.substring(0,6)}...)`;
    const status = orderData.status;
    const deliveryDate = orderData.deliveryDate;
    const customerName = customer.fullName || 'Customer';
    const customerNumber = customer.whatsappNo.replace(/[^0-9]/g, '');
    let message = getWhatsAppMessageTemplate(status, customerName, orderId, deliveryDate);
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customerNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
}
function getWhatsAppMessageTemplate(status, customerName, orderId, deliveryDate) { /* ... पहले जैसा ही ... */
     const namePlaceholder = "[Customer Name]"; const orderNoPlaceholder = "[ORDER_NO]"; const deliveryDatePlaceholder = "[DELIVERY_DATE]";
     const companyName = "Madhav Offset"; const companyAddress = "Head Office: Moodh Market, Batadu"; const companyMobile = "9549116541";
     const signature = `धन्यवाद,\n${companyName}\n${companyAddress}\nMobile: ${companyMobile}`;
     let template = "";
     let deliveryDateText = deliveryDate ? new Date(deliveryDate).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : "जल्द से जल्द";
     switch (status) { /* ... सभी केस पहले जैसे ही ... */
        case "Order Received": template = `प्रिय ${namePlaceholder},\nनमस्कार,\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) हमें सफलतापूर्वक प्राप्त हो गया है।\nहम इस ऑर्डर को ${deliveryDatePlaceholder} तक पूर्ण करने का प्रयास करेंगे।\n\nDear ${namePlaceholder},\nWe have successfully received your order (Order No: ${orderNoPlaceholder}).\nWe aim to complete it by ${deliveryDatePlaceholder}.`; break;
        case "Designing": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) का डिज़ाइन तैयार किया जा रहा है।\nजैसे ही डिज़ाइन तैयार होगा, हम आपसे पुष्टि के लिए संपर्क करेंगे।\n\nDear ${namePlaceholder},\nThe design for your order (Order No: ${orderNoPlaceholder}) is in progress.\nWe’ll contact you for confirmation once it’s ready.`; break;
        case "Verification": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की डिज़ाइन आपके साथ साझा कर दी गई है।\nकृपया डिज़ाइन को ध्यानपूर्वक जाँचे और हमें अपनी अनुमति प्रदान करें।\nएक बार ‘OK’ कर देने के बाद किसी भी प्रकार का संशोधन संभव नहीं होगा।\n\nDear ${namePlaceholder},\nWe have shared the design for your order (Order No: ${orderNoPlaceholder}) with you.\nPlease review it carefully and provide your approval.\nOnce you confirm with ‘OK’, no further changes will be possible.`; break;
        case "Design Approved": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की डिज़ाइन स्वीकृत कर दी गई है।\nअब यह प्रिंटिंग प्रक्रिया के लिए आगे बढ़ाया जा रहा है।\n\nDear ${namePlaceholder},\nYour design for Order No: ${orderNoPlaceholder} has been approved.\nIt is now moving forward to the printing stage.`; break;
        case "Ready for Working": template = `प्रिय ${namePlaceholder},\nनमस्कार,\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की प्रिंटिंग पूरी हो गई है।\nआप ऑफिस/कार्यालय आकर अपना प्रोडक्ट ले जा सकते हैं।\n\nDear ${namePlaceholder},\nThe printing for your order (Order No: ${orderNoPlaceholder}) is complete.\nYou can now collect your product from our office.`; break;
        case "Printing": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) प्रिंट हो रहा है।\nपूरा होते ही आपको सूचित किया जाएगा।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) is currently being printed.\nWe will notify you once it’s done.`; break;
        case "Delivered": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) सफलतापूर्वक डिलीवर कर दिया गया है।\nकृपया पुष्टि करें कि आपने ऑर्डर प्राप्त कर लिया है।\nआपके सहयोग के लिए धन्यवाद।\nहमें आशा है कि आप हमें शीघ्र ही फिर से सेवा का अवसर देंगे।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) has been successfully delivered.\nPlease confirm the receipt.\nThank you for your support.\nWe hope to have the opportunity to serve you again soon.`; break;
        case "Completed": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) सफलतापूर्वक पूर्ण हो चुका है।\nआपके सहयोग के लिए धन्यवाद।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) has been successfully completed.\nThank you for your support.`; break;
        default: template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) का वर्तमान स्टेटस है: ${status}.\n\nDear ${namePlaceholder},\nThe current status for your order (Order No: ${orderNoPlaceholder}) is: ${status}.`;
     }
     let message = template.replace(new RegExp(namePlaceholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), customerName);
     message = message.replace(new RegExp(orderNoPlaceholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), orderId);
     message = message.replace(new RegExp(deliveryDatePlaceholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), deliveryDateText);
     message += `\n\n${signature}`; return message;
}

// --- बल्क एक्शन फ़ंक्शंस ---
function handleSelectAllChange(event) {
    const isChecked = event.target.checked;
    const rowCheckboxes = orderTableBody.querySelectorAll('.row-selector');
    selectedOrderIds.clear();
    rowCheckboxes.forEach(checkbox => {
        const firestoreId = checkbox.dataset.id;
        checkbox.checked = isChecked;
        const row = checkbox.closest('tr');
        if (isChecked) { selectedOrderIds.add(firestoreId); if (row) row.classList.add('selected-row'); }
        else { if (row) row.classList.remove('selected-row'); }
    });
    updateBulkActionsBar();
}
function handleRowCheckboxChange(checkbox, firestoreId) {
    const row = checkbox.closest('tr');
    if (checkbox.checked) { selectedOrderIds.add(firestoreId); if (row) row.classList.add('selected-row'); }
    else { selectedOrderIds.delete(firestoreId); if (row) row.classList.remove('selected-row'); }
    updateBulkActionsBar();
    if (selectAllCheckbox) {
        const allVisibleCheckboxes = orderTableBody.querySelectorAll('.row-selector');
        const allVisibleChecked = allVisibleCheckboxes.length > 0 && Array.from(allVisibleCheckboxes).every(cb => cb.checked);
        const someVisibleChecked = Array.from(allVisibleCheckboxes).some(cb => cb.checked);
        selectAllCheckbox.checked = allVisibleSelected;
        selectAllCheckbox.indeterminate = !allVisibleSelected && someVisibleChecked;
    }
}
function updateBulkActionsBar() {
    const count = selectedOrderIds.size;
    if (bulkActionsBar && selectedCountSpan && bulkUpdateStatusBtn && bulkDeleteBtn) {
        if (count > 0) {
            selectedCountSpan.textContent = `${count} item${count > 1 ? 's' : ''} selected`;
            bulkActionsBar.style.display = 'flex';
            bulkUpdateStatusBtn.disabled = !(bulkStatusSelect && bulkStatusSelect.value);
            bulkDeleteBtn.disabled = false;
        } else {
            bulkActionsBar.style.display = 'none';
            if (bulkStatusSelect) bulkStatusSelect.value = '';
            bulkUpdateStatusBtn.disabled = true;
            bulkDeleteBtn.disabled = true;
        }
    }
}

// --- बल्क डिलीट (अब मोडल खोलता है) ---
async function handleBulkDelete() {
    const idsToDelete = Array.from(selectedOrderIds);
    if (idsToDelete.length === 0) { alert("डिलीट करने के लिए कृपया ऑर्डर चुनें।"); return; }
    if (!bulkDeleteConfirmModal || !bulkDeleteOrderList || !confirmDeleteCheckbox || !confirmBulkDeleteBtn || !bulkDeleteCountSpan) {
        console.error("बल्क डिलीट कन्फर्मेशन मोडल एलिमेंट नहीं मिले!");
        if (confirm(`MODAL MISSING! Fallback: क्या आप वाकई ${idsToDelete.length} चयनित ऑर्डर डिलीट करना चाहते हैं?`)) {
            await executeBulkDelete(idsToDelete);
        } return;
    }

    // मोडल लिस्ट पॉप्युलेट करें
    bulkDeleteOrderList.innerHTML = '';
    const maxItemsToShow = 100;
    idsToDelete.forEach((id, index) => {
        if (index < maxItemsToShow) {
            const order = allOrdersCache.find(o => o.id === id);
            const displayId = order?.orderId || `(Sys: ${id.substring(0, 6)}...)`;
            const customerName = order?.customerDetails?.fullName || 'N/A';
            const li = document.createElement('li');
            li.innerHTML = `<strong>${displayId}</strong> - ${customerName}`;
            bulkDeleteOrderList.appendChild(li);
        }
    });
    if (idsToDelete.length > maxItemsToShow) {
        const li = document.createElement('li'); li.textContent = `... और ${idsToDelete.length - maxItemsToShow} अन्य ऑर्डर।`; bulkDeleteOrderList.appendChild(li);
    }
    bulkDeleteCountSpan.textContent = idsToDelete.length;
    confirmDeleteCheckbox.checked = false; confirmBulkDeleteBtn.disabled = true;
    bulkDeleteConfirmModal.style.display = 'flex'; // मोडल दिखाएं
}

// --- वास्तविक बल्क डिलीट लॉजिक ---
async function executeBulkDelete(idsToDelete) {
     if (idsToDelete.length === 0) return;
     console.log("[DEBUG] बल्क डिलीट निष्पादित किया जा रहा है:", idsToDelete);
     if(bulkDeleteBtn) bulkDeleteBtn.disabled = true;
     if(confirmBulkDeleteBtn) confirmBulkDeleteBtn.disabled = true;
     if(confirmBulkDeleteBtn) confirmBulkDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
     const batch = writeBatch(db);
     idsToDelete.forEach(id => { const docRef = doc(db, "orders", id); batch.delete(docRef); });
     try {
         await batch.commit();
         console.log(`[DEBUG] ${idsToDelete.length} ऑर्डर्स का बल्क डिलीट सफल।`);
         alert(`${idsToDelete.length} ऑर्डर सफलतापूर्वक डिलीट किए गए।`);
         selectedOrderIds.clear(); updateBulkActionsBar(); closeBulkDeleteModal();
     } catch (error) {
         console.error("बल्क डिलीट निष्पादन के दौरान त्रुटि:", error);
         alert(`ऑर्डर डिलीट करने में त्रुटि: ${error.message}\nकुछ ऑर्डर डिलीट नहीं हुए होंगे।`);
     } finally {
         if(bulkDeleteBtn) bulkDeleteBtn.disabled = false;
         if(confirmBulkDeleteBtn) confirmBulkDeleteBtn.disabled = false;
         if(confirmBulkDeleteBtn) confirmBulkDeleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Orders';
         updateBulkActionsBar();
     }
}

// --- बल्क स्टेटस अपडेट ---
async function handleBulkUpdateStatus() { /* ... पहले जैसा ही ... */
    const idsToUpdate = Array.from(selectedOrderIds);
    const newStatus = bulkStatusSelect.value;
    if (idsToUpdate.length === 0) { alert("अपडेट करने के लिए कृपया ऑर्डर चुनें।"); return; }
    if (!newStatus) { alert("अपडेट करने के लिए कृपया स्टेटस चुनें।"); return; }
    if (!confirm(`क्या आप वाकई ${idsToUpdate.length} चयनित ऑर्डर का स्टेटस "${newStatus}" में बदलना चाहते हैं?`)) { return; }

    console.log(`[DEBUG] IDs के लिए "${newStatus}" पर बल्क स्टेटस अपडेट शुरू हो रहा है:`, idsToUpdate);
    if (bulkUpdateStatusBtn) { bulkUpdateStatusBtn.disabled = true; bulkUpdateStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; }

    const batch = writeBatch(db);
    const now = Timestamp.now(); const historyEntry = { status: newStatus, timestamp: now };
    idsToUpdate.forEach(id => {
        const docRef = doc(db, "orders", id);
        batch.update(docRef, { status: newStatus, updatedAt: now, statusHistory: arrayUnion(historyEntry) });
    });
    try {
        await batch.commit();
        console.log(`[DEBUG] ${idsToUpdate.length} ऑर्डर्स का बल्क स्टेटस अपडेट सफल।`);
        alert(`${idsToUpdate.length} ऑर्डर का स्टेटस "${newStatus}" पर अपडेट किया गया।`);
        selectedOrderIds.clear(); updateBulkActionsBar();
    } catch (error) {
        console.error("बल्क स्टेटस अपडेट के दौरान त्रुटि:", error);
        alert(`स्टेटस अपडेट करने में त्रुटि: ${error.message}\nकुछ स्टेटस अपडेट नहीं हुए होंगे।`);
    } finally {
        if (bulkUpdateStatusBtn) { bulkUpdateStatusBtn.disabled = false; bulkUpdateStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Selected'; }
        if (bulkStatusSelect) bulkStatusSelect.value = '';
        updateBulkActionsBar();
    }
}

// --- CSV एक्सपोर्ट फ़ंक्शन ---
function exportToCsv() { /* ... पहले जैसा ही ... */
    console.log("[DEBUG] CSV एक्सपोर्ट का अनुरोध किया गया।");
    if (currentlyDisplayedOrders.length === 0) { alert("एक्सपोर्ट के लिए कोई डेटा उपलब्ध नहीं है।"); return; }
    const headers = [ "Firestore ID", "Order ID", "Customer Name", "WhatsApp No", "Contact No", "Address", "Order Date", "Delivery Date", "Status", "Urgent", "Remarks", "Products (Name | Qty)" ];
    const rows = currentlyDisplayedOrders.map(order => {
        const productsString = (order.products || []).map(p => `${String(p.name || '').replace(/\|/g, '')}|${String(p.quantity || '')}`).join('; ');
        return [ order.id, order.orderId || '', order.customerDetails?.fullName || '', order.customerDetails?.whatsappNo || '', order.customerDetails?.contactNo || '', order.customerDetails?.address || '', order.orderDate || '', order.deliveryDate || '', order.status || '', order.urgent || 'No', order.remarks || '', productsString ];
    });
    let csvContent = "data:text/csv;charset=utf-8," + headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n" + rows.map(row => row.map(field => `"${String(field || '').replace(/"/g, '""')}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a"); link.setAttribute("href", encodedUri);
    const timestamp = new Date().toISOString().slice(0, 10); link.setAttribute("download", `orders_export_${timestamp}.csv`);
    document.body.appendChild(link); console.log("[DEBUG] CSV डाउनलोड ट्रिगर किया जा रहा है।"); link.click(); document.body.removeChild(link);
}

// --- URL से मोडल खोलने का प्रयास ---
function attemptOpenModalFromUrl() { /* ... पहले जैसा ही ... */
    if (orderIdToOpenFromUrl && allOrdersCache.length > 0 && !modalOpenedFromUrl) {
        console.log(`[DEBUG] ID के लिए मोडल खोजने और खोलने का प्रयास: ${orderIdToOpenFromUrl}`);
        const orderToOpenData = allOrdersCache.find(o => o.id === orderIdToOpenFromUrl);
        if (orderToOpenData) {
            console.log("[DEBUG] ऑर्डर कैश में मिला, मोडल खोला जा रहा है।");
            openDetailsModal(orderIdToOpenFromUrl, orderToOpenData); modalOpenedFromUrl = true;
            try { const currentUrl = new URL(window.location); currentUrl.searchParams.delete('openModalForId'); window.history.replaceState({}, '', currentUrl.toString()); }
            catch(e) { window.history.replaceState(null, '', window.location.pathname); }
             orderIdToOpenFromUrl = null;
        } else { console.warn(`[DEBUG] ID ${orderIdToOpenFromUrl} वाला ऑर्डर वर्तमान कैश में नहीं मिला।`); }
    }
}

// --- बल्क डिलीट मोडल बंद करने का फ़ंक्शन ---
function closeBulkDeleteModal() {
    if (bulkDeleteConfirmModal) bulkDeleteConfirmModal.style.display = 'none';
}

// --- अंतिम लॉग ---
console.log("order_history.js स्क्रिप्ट (अंतिम संस्करण) पूरी तरह से लोड और इनिशियलाइज़ हो गया है।");