// js/order_history.js
// अंतिम सही किया गया संस्करण - RegExp और Row Generation फिक्स शामिल है

// Firebase फ़ंक्शंस को ग्लोबल माना गया है
const {
    db, collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, Timestamp, arrayUnion, writeBatch
} = window;

// --- DOM एलिमेंट्स ---
// (ये सभी पहले जैसे ही रहेंगे, सुनिश्चित करें कि सभी IDs मौजूद हैं)
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
    console.log("[DEBUG] Order History DOM Loaded. Initializing final CORRECTED version (RegExp & RowGen fix).");

    const urlParams = new URLSearchParams(window.location.search);
    orderIdToOpenFromUrl = urlParams.get('openModalForId');
    currentStatusFilter = urlParams.get('status');

    if (orderIdToOpenFromUrl) console.log(`[DEBUG] Request to open modal for ID: ${orderIdToOpenFromUrl}`);
    if (currentStatusFilter && filterStatusSelect) filterStatusSelect.value = currentStatusFilter;

    waitForDbConnection(() => {
        listenForOrders();

        // --- इवेंट लिस्टनर्स ---
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
        if (bulkDeleteBtn) bulkDeleteBtn.addEventListener('click', handleBulkDelete);
        if (bulkStatusSelect) bulkStatusSelect.addEventListener('change', updateBulkActionsBar);

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
    if (window.db) { callback(); } else { let a = 0, m = 20, i = setInterval(() => { a++; if (window.db) { clearInterval(i); callback(); } else if (a >= m) { clearInterval(i); console.error("DB connection timeout (order_history.js)"); alert("Database connection failed."); } }, 250); }
}

// --- सॉर्टिंग और फ़िल्टरिंग हैंडलर्स ---
function handleSortChange() { if (!sortSelect) return; const [field, direction] = sortSelect.value.split('_'); if (field && direction) { currentSortField = field; currentSortDirection = direction; applyFiltersAndRender(); } }
function handleFilterChange() { applyFiltersAndRender(); }
function handleSearchInput() { clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(applyFiltersAndRender, 300); }
function clearFilters() { if (filterDateInput) filterDateInput.value = ''; if (filterSearchInput) filterSearchInput.value = ''; if (filterStatusSelect) filterStatusSelect.value = ''; if (sortSelect) sortSelect.value = 'createdAt_desc'; currentSortField = 'createdAt'; currentSortDirection = 'desc'; currentStatusFilter = ''; selectedOrderIds.clear(); updateBulkActionsBar(); if (selectAllCheckbox) selectAllCheckbox.checked = false; if (history.replaceState) { const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname; window.history.replaceState({ path: cleanUrl }, '', cleanUrl); } applyFiltersAndRender(); }

// --- Firestore लिस्टनर ---
function listenForOrders() {
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; console.log("[DEBUG] पिछला लिस्टनर अनसब्सक्राइब किया गया।"); }
    if (!db || !collection || !query || !orderBy || !onSnapshot) { console.error("Firestore लिस्टनर फ़ंक्शन मौजूद नहीं हैं।"); return; }
    if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="10" id="loadingMessage">ऑर्डर लोड हो रहे हैं...</td></tr>`;
    try {
        const q = query(collection(db, "orders"));
        console.log("[DEBUG] ऑर्डर्स के लिए Firestore लिस्टनर सेट किया जा रहा है...");
        unsubscribeOrders = onSnapshot(q, (snapshot) => {
            console.log(`[DEBUG] ऑर्डर स्नैपशॉट मिला। कुल ${snapshot.size} डॉक्यूमेंट्स।`);
             allOrdersCache = snapshot.docs.map(doc => { const data = doc.data(); return { id: doc.id, orderId: data.orderId || '', customerDetails: data.customerDetails || {}, products: data.products || [], orderDate: data.orderDate || null, deliveryDate: data.deliveryDate || null, urgent: data.urgent || 'No', status: data.status || 'Unknown', statusHistory: data.statusHistory || [], createdAt: data.createdAt || null, updatedAt: data.updatedAt || null }; });
            console.log(`[DEBUG] allOrdersCache ${allOrdersCache.length} ऑर्डर्स के साथ पॉप्युलेट हुआ।`);
            selectedOrderIds.clear(); updateBulkActionsBar(); if (selectAllCheckbox) selectAllCheckbox.checked = false;
            applyFiltersAndRender(); attemptOpenModalFromUrl();
        }, (error) => { console.error("[DEBUG] ऑर्डर्स स्नैपशॉट लाने में त्रुटि:", error); if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="10" style="color: red;">ऑर्डर लोड करने में त्रुटि। कृपया पुनः प्रयास करें।</td></tr>`; });
    } catch (error) { console.error("[DEBUG] Firestore लिस्टनर सेट करने में त्रुटि:", error); if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="10" style="color: red;">लिस्टनर सेट करने में त्रुटि।</td></tr>`; }
}

// --- फ़िल्टर, सॉर्ट, रेंडर फ़ंक्शन ---
function applyFiltersAndRender() {
    if (!allOrdersCache) { console.warn("[DEBUG] applyFiltersAndRender कॉल हुआ लेकिन कैश खाली है।"); return; }
    const filterDateValue = filterDateInput ? filterDateInput.value : ''; const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : ''; const filterStatusValue = filterStatusSelect ? filterStatusSelect.value : ''; currentStatusFilter = filterStatusValue;
    let filteredOrders = allOrdersCache.filter(order => { if (filterStatusValue && order.status !== filterStatusValue) return false; if (filterDateValue && order.orderDate !== filterDateValue) return false; if (filterSearchValue) { const orderIdString = String(order.orderId || ''); const customerNameString = order.customerDetails?.fullName || ''; const firestoreIdString = order.id || ''; const productsString = (order.products || []).map(p => String(p.name || '')).join(' ').toLowerCase(); const mobileString = String(order.customerDetails?.whatsappNo || ''); if (!(orderIdString.toLowerCase().includes(filterSearchValue) || customerNameString.toLowerCase().includes(filterSearchValue) || firestoreIdString.toLowerCase().includes(filterSearchValue) || productsString.includes(filterSearchValue) || mobileString.includes(filterSearchValue))) return false; } return true; });
    try { filteredOrders.sort((a, b) => { let valA = a[currentSortField]; let valB = b[currentSortField]; if (valA && typeof valA.toDate === 'function') valA = valA.toDate().getTime(); if (valB && typeof valB.toDate === 'function') valB = valB.toDate().getTime(); if (currentSortField === 'orderDate' || currentSortField === 'deliveryDate') { const dateA = valA ? new Date(valA).getTime() : null; const dateB = valB ? new Date(valB).getTime() : null; if (dateA === null && dateB === null) return 0; if (dateA === null) return currentSortDirection === 'asc' ? 1 : -1; if (dateB === null) return currentSortDirection === 'asc' ? -1 : 1; valA = dateA; valB = dateB; } let sortComparison = 0; if (valA > valB) sortComparison = 1; else if (valA < valB) sortComparison = -1; return currentSortDirection === 'desc' ? sortComparison * -1 : sortComparison; }); } catch (sortError) { console.error("[DEBUG] सॉर्टिंग के दौरान त्रुटि:", sortError); }
    currentlyDisplayedOrders = filteredOrders; updateOrderCountsAndReport(currentlyDisplayedOrders);
    if (!orderTableBody) { console.error("रेंडर के दौरान orderTableBody नहीं मिला!"); return; } orderTableBody.innerHTML = '';
    if (currentlyDisplayedOrders.length === 0) { orderTableBody.innerHTML = `<tr><td colspan="10" id="noOrdersMessage">आपकी खोज से मेल खाता कोई ऑर्डर नहीं मिला।</td></tr>`; }
    else { const searchTerm = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : ''; currentlyDisplayedOrders.forEach(order => { displayOrderRow(order.id, order, searchTerm); }); }
    if (selectAllCheckbox) { const allCb = orderTableBody.querySelectorAll('.row-selector'); const allSelected = allCb.length > 0 && Array.from(allCb).every(cb => cb.checked); const someSelected = Array.from(allCb).some(cb => cb.checked); selectAllCheckbox.checked = allSelected; selectAllCheckbox.indeterminate = !allSelected && someSelected; }
}

// --- ऑर्डर काउंट और रिपोर्ट अपडेट करें ---
function updateOrderCountsAndReport(displayedOrders) {
    const total = displayedOrders.length; let completedDelivered = 0; const statusCounts = {}; displayedOrders.forEach(order => { const status = order.status || 'Unknown'; if (status === 'Completed' || status === 'Delivered') completedDelivered++; statusCounts[status] = (statusCounts[status] || 0) + 1; }); const pending = total - completedDelivered; if (totalOrdersSpan) totalOrdersSpan.textContent = total; if (completedOrdersSpan) completedOrdersSpan.textContent = completedDelivered; if (pendingOrdersSpan) pendingOrdersSpan.textContent = pending; if (statusCountsReportContainer) { if (total === 0) { statusCountsReportContainer.innerHTML = '<p>रिपोर्ट के लिए कोई ऑर्डर नहीं।</p>'; } else { let reportHtml = '<ul>'; Object.keys(statusCounts).sort().forEach(status => { reportHtml += `<li>${escapeHtml(status)}: <strong>${statusCounts[status]}</strong></li>`; }); reportHtml += '</ul>'; statusCountsReportContainer.innerHTML = reportHtml; } }
}

// --- HTML एस्केप हेल्पर ---
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { unsafe = String(unsafe || ''); } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }

// --- हाईलाइटिंग फ़ंक्शन ---
function highlightMatch(text, term) { if (!term || !text) return text; const stringText = typeof text === 'string' ? text : String(text); try { const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'); const regex = new RegExp(`(${escapedTerm})`, 'gi'); return stringText.replace(regex, '<mark>$1</mark>'); } catch (e) { console.warn("Highlighting regex error:", e); return stringText; } }


// --- सिंगल ऑर्डर रो डिस्प्ले करें (अंतिम सही किया गया संस्करण) ---
function displayOrderRow(firestoreId, data, searchTerm = '') {
    if (!orderTableBody || !data) return;
    const tableRow = document.createElement('tr');
    tableRow.setAttribute('data-id', firestoreId);
    if (selectedOrderIds.has(firestoreId)) tableRow.classList.add('selected-row');

    const customerDetails = data.customerDetails || {};
    const customerName = customerDetails.fullName || 'N/A';
    const customerMobile = customerDetails.whatsappNo || '-';
    let orderDateStr = '-';
    try { if (data.orderDate) orderDateStr = new Date(data.orderDate).toLocaleDateString('en-GB'); } catch(e) { console.warn(`Invalid orderDate format for ${firestoreId}: ${data.orderDate}`); }
    let deliveryDateStr = '-';
    try { if (data.deliveryDate) deliveryDateStr = new Date(data.deliveryDate).toLocaleDateString('en-GB'); } catch(e) { console.warn(`Invalid deliveryDate format for ${firestoreId}: ${data.deliveryDate}`); }
    const displayId = data.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`;
    const status = data.status || 'Unknown';
    const priority = data.urgent === 'Yes' ? 'Yes' : 'No';
    let productsHtml = '-';
    const products = data.products || [];
    if (Array.isArray(products) && products.length > 0) {
        productsHtml = products.map(p => { const product = p || {}; const name = escapeHtml(String(product.name || 'Unnamed')); const quantity = escapeHtml(String(product.quantity || '?')); return `${highlightMatch(name, searchTerm)} (${highlightMatch(quantity, searchTerm)})`; }).join('<br>');
    }
    const statusClass = `status-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const priorityClass = priority === 'Yes' ? 'priority-yes' : 'priority-no';

    try {
        // ** बिल्कुल साफ innerHTML, कोई कमेंट नहीं **
        tableRow.innerHTML = `
            <td class="col-checkbox"><input type="checkbox" class="row-selector" data-id="${firestoreId}" ${selectedOrderIds.has(firestoreId) ? 'checked' : ''}></td>
            <td>${highlightMatch(escapeHtml(displayId), searchTerm)}</td>
            <td>
                <span class="customer-name-display">${highlightMatch(escapeHtml(customerName), searchTerm)}</span>
                <span class="customer-mobile-inline">${highlightMatch(escapeHtml(customerMobile), searchTerm)}</span>
            </td>
            <td>${productsHtml}</td>
            <td>${orderDateStr}</td>
            <td>${deliveryDateStr}</td>
            <td class="${priorityClass}">${priority}</td>
            <td><span class="status-badge ${statusClass}">${highlightMatch(escapeHtml(status), searchTerm)}</span></td>
            <td><button type="button" class="button details-edit-button"><i class="fas fa-info-circle"></i> Details/Edit</button></td>
            <td><button type="button" class="button whatsapp-button" title="Send Status on WhatsApp"><i class="fab fa-whatsapp"></i></button></td>
        `;
        orderTableBody.appendChild(tableRow);
    } catch (error) {
        console.error(`Error creating table row HTML for order ${firestoreId}:`, error, data);
        const errorRow = document.createElement('tr'); errorRow.innerHTML = `<td colspan="10" style="color: red; text-align: left;">Error displaying order: ${firestoreId}. Check console.</td>`; orderTableBody.appendChild(errorRow);
    }
}


// --- मोडल 1 हैंडलिंग ---
function openDetailsModal(firestoreId, orderData) { /* ... पहले जैसा ही ... */
    if (!orderData || !detailsModal) { console.error("Order data or modal element missing:", firestoreId); return; } if (!modalOrderIdInput || !modalDisplayOrderIdSpan || !modalCustomerNameSpan || !modalCustomerWhatsAppSpan || !modalOrderStatusSelect || !modalProductListContainer || !modalStatusHistoryListContainer) { console.error("One or more modal elements not found!"); return; } console.log("[DEBUG] Opening details modal for:", firestoreId); modalOrderIdInput.value = firestoreId; modalDisplayOrderIdSpan.textContent = orderData.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`; modalCustomerNameSpan.textContent = orderData.customerDetails?.fullName || 'N/A'; modalCustomerWhatsAppSpan.textContent = orderData.customerDetails?.whatsappNo || 'N/A'; modalOrderStatusSelect.value = orderData.status || '';
    modalProductListContainer.innerHTML = ''; const products = orderData.products; if (Array.isArray(products) && products.length > 0) { const ul = document.createElement('ul'); ul.style.listStyle = 'none'; ul.style.padding = '0'; ul.style.margin = '0'; products.forEach(product => { const li = document.createElement('li'); li.style.marginBottom = '5px'; li.style.paddingBottom = '5px'; li.style.borderBottom = '1px dotted #eee'; const nameSpan = document.createElement('span'); nameSpan.textContent = product.name || 'Unnamed Product'; nameSpan.style.fontWeight = '600'; const qtySpan = document.createElement('span'); qtySpan.textContent = ` - Qty: ${product.quantity || '?'}`; qtySpan.style.fontSize = '0.9em'; qtySpan.style.color = '#555'; li.append(nameSpan, qtySpan); ul.appendChild(li); }); if(ul.lastChild) ul.lastChild.style.borderBottom = 'none'; modalProductListContainer.appendChild(ul); } else { modalProductListContainer.innerHTML = '<p class="no-products">No products listed.</p>'; }
    modalStatusHistoryListContainer.innerHTML = ''; const history = orderData.statusHistory; if (Array.isArray(history) && history.length > 0) { const sortedHistory = [...history].sort((a, b) => (b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0) - (a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0)); const ul = document.createElement('ul'); ul.style.listStyle = 'none'; ul.style.padding = '0'; ul.style.margin = '0'; ul.style.maxHeight = '150px'; ul.style.overflowY = 'auto'; sortedHistory.forEach(entry => { const li = document.createElement('li'); li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.fontSize = '0.9em'; li.style.padding = '3px 0'; li.style.borderBottom = '1px dotted #eee'; const statusSpan = document.createElement('span'); statusSpan.className = 'history-status'; statusSpan.textContent = entry.status || '?'; statusSpan.style.fontWeight = '500'; const timeSpan = document.createElement('span'); timeSpan.className = 'history-time'; timeSpan.style.color = '#777'; if (entry.timestamp && entry.timestamp.toDate) { const d=entry.timestamp.toDate(); timeSpan.textContent = d.toLocaleDateString('en-GB',{day:'numeric',month:'short'}) + ' ' + d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}); } else { timeSpan.textContent = '?'; } li.append(statusSpan, timeSpan); ul.appendChild(li); }); if(ul.lastChild) ul.lastChild.style.borderBottom = 'none'; modalStatusHistoryListContainer.appendChild(ul); } else { modalStatusHistoryListContainer.innerHTML = '<p class="no-history">No status history.</p>'; } detailsModal.style.display = 'flex';
}
function closeDetailsModal() { if (detailsModal) detailsModal.style.display = 'none'; }

// --- मोडल 1 एक्शन हैंडलर्स ---
async function handleUpdateStatus() { /* ... पहले जैसा ही ... */
    const firestoreId = modalOrderIdInput.value; const newStatus = modalOrderStatusSelect.value; if (!firestoreId || !newStatus) return; const orderData = allOrdersCache.find(o => o.id === firestoreId); if (!orderData) return; if (orderData.status === newStatus) { alert("Status already set."); return; } if (modalUpdateStatusBtn) { modalUpdateStatusBtn.disabled = true; modalUpdateStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; } const historyEntry = { status: newStatus, timestamp: Timestamp.now() }; try { await updateDoc(doc(db, "orders", firestoreId), { status: newStatus, updatedAt: historyEntry.timestamp, statusHistory: arrayUnion(historyEntry) }); console.log("Status updated:", firestoreId); closeDetailsModal(); if (orderData.customerDetails?.whatsappNo) showStatusUpdateWhatsAppReminder(orderData.customerDetails, orderData.orderId || `Sys:${firestoreId.substring(0,6)}`, newStatus); else alert("Status updated!"); } catch (e) { console.error("Error updating status:", e); alert("Error: " + e.message); } finally { if (modalUpdateStatusBtn) { modalUpdateStatusBtn.disabled = false; modalUpdateStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Status'; } }
}
function handleDeleteFromModal() { /* ... पहले जैसा ही ... */
    const firestoreId = modalOrderIdInput.value; const displayId = modalDisplayOrderIdSpan.textContent; if (!firestoreId) return; closeDetailsModal(); if (confirm(`Delete Order ID: ${displayId}?`)) deleteSingleOrder(firestoreId); else console.log("Deletion cancelled.");
}
async function deleteSingleOrder(firestoreId) { /* ... पहले जैसा ही ... */
    if (!db || !doc || !deleteDoc) { alert("Delete unavailable."); return; } try { await deleteDoc(doc(db, "orders", firestoreId)); console.log("Order deleted:", firestoreId); alert("Order deleted."); } catch (e) { console.error("Error deleting order:", e); alert("Error: " + e.message); }
}
function handleEditFullFromModal() { const firestoreId = modalOrderIdInput.value; if (firestoreId) window.location.href = `new_order.html?editOrderId=${firestoreId}`; }

// --- WhatsApp फ़ंक्शंस ---
function showStatusUpdateWhatsAppReminder(customer, orderId, updatedStatus) { /* ... पहले जैसा ही ... */
    if (!whatsappReminderPopup || !whatsappMsgPreview || !whatsappSendLink) { console.error("WhatsApp Popup missing."); return; } const name = customer.fullName || 'Customer'; const num = customer.whatsappNo?.replace(/[^0-9]/g, ''); if (!num) { console.warn("WhatsApp number missing."); return; } let msg = getWhatsAppMessageTemplate(updatedStatus, name, orderId, null); whatsappMsgPreview.innerText = msg; const url = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`; whatsappSendLink.href = url; const title = document.getElementById('whatsapp-popup-title'); if(title) title.textContent = "Status Updated!"; whatsappReminderPopup.classList.add('active');
}
function closeWhatsAppPopup() { if (whatsappReminderPopup) whatsappReminderPopup.classList.remove('active'); }
function sendWhatsAppMessage(firestoreId, orderData) { /* ... पहले जैसा ही ... */
    if (!orderData?.customerDetails?.whatsappNo) { alert("WhatsApp number not found."); return; } const cust = orderData.customerDetails; const orderId = orderData.orderId || `Sys:${firestoreId.substring(0,6)}`; const status = orderData.status; const deliveryDate = orderData.deliveryDate; const name = cust.fullName || 'Customer'; const num = cust.whatsappNo.replace(/[^0-9]/g, ''); let msg = getWhatsAppMessageTemplate(status, name, orderId, deliveryDate); const url = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`; window.open(url, '_blank');
}

// --- WhatsApp मैसेज टेम्पलेट (RegExp फिक्स के साथ) ---
function getWhatsAppMessageTemplate(status, customerName, orderId, deliveryDate) {
    const namePlaceholder = "[Customer Name]";
    const orderNoPlaceholder = "[ORDER_NO]";
    const deliveryDatePlaceholder = "[DELIVERY_DATE]";
    const companyName = "Madhav Offset";
    const companyAddress = "Head Office: Moodh Market, Batadu";
    const companyMobile = "9549116541";
    const signature = `धन्यवाद,\n${companyName}\n${companyAddress}\nMobile: ${companyMobile}`;
    let template = "";
    let deliveryDateText = "जल्द से जल्द"; // Default
     try { if(deliveryDate) deliveryDateText = new Date(deliveryDate).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); } catch(e) { console.warn("Could not format delivery date:", deliveryDate); }

    // Helper function to replace all occurrences without complex regex
    function replaceAll(str, find, replace) { return str.split(find).join(replace); }

    // Status Templates (पहले जैसे ही)
    switch (status) { case "Order Received": template = `प्रिय ${namePlaceholder},\nनमस्कार,\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) हमें सफलतापूर्वक प्राप्त हो गया है।\nहम इस ऑर्डर को ${deliveryDatePlaceholder} तक पूर्ण करने का प्रयास करेंगे।\n\nDear ${namePlaceholder},\nWe have successfully received your order (Order No: ${orderNoPlaceholder}).\nWe aim to complete it by ${deliveryDatePlaceholder}.`; break; case "Designing": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) का डिज़ाइन तैयार किया जा रहा है।\nजैसे ही डिज़ाइन तैयार होगा, हम आपसे पुष्टि के लिए संपर्क करेंगे।\n\nDear ${namePlaceholder},\nThe design for your order (Order No: ${orderNoPlaceholder}) is in progress.\nWe’ll contact you for confirmation once it’s ready.`; break; case "Verification": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की डिज़ाइन आपके साथ साझा कर दी गई है।\nकृपया डिज़ाइन को ध्यानपूर्वक जाँचे और हमें अपनी अनुमति प्रदान करें।\nएक बार ‘OK’ कर देने के बाद किसी भी प्रकार का संशोधन संभव नहीं होगा।\n\nDear ${namePlaceholder},\nWe have shared the design for your order (Order No: ${orderNoPlaceholder}) with you.\nPlease review it carefully and provide your approval.\nOnce you confirm with ‘OK’, no further changes will be possible.`; break; case "Design Approved": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की डिज़ाइन स्वीकृत कर दी गई है।\nअब यह प्रिंटिंग प्रक्रिया के लिए आगे बढ़ाया जा रहा है।\n\nDear ${namePlaceholder},\nYour design for Order No: ${orderNoPlaceholder} has been approved.\nIt is now moving forward to the printing stage.`; break; case "Ready for Working": template = `प्रिय ${namePlaceholder},\nनमस्कार,\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की प्रिंटिंग पूरी हो गई है।\nआप ऑफिस/कार्यालय आकर अपना प्रोडक्ट ले जा सकते हैं।\n\nDear ${namePlaceholder},\nThe printing for your order (Order No: ${orderNoPlaceholder}) is complete.\nYou can now collect your product from our office.`; break; case "Printing": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) प्रिंट हो रहा है।\nपूरा होते ही आपको सूचित किया जाएगा।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) is currently being printed.\nWe will notify you once it’s done.`; break; case "Delivered": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) सफलतापूर्वक डिलीवर कर दिया गया है।\nकृपया पुष्टि करें कि आपने ऑर्डर प्राप्त कर लिया है।\nआपके सहयोग के लिए धन्यवाद।\nहमें आशा है कि आप हमें शीघ्र ही फिर से सेवा का अवसर देंगे।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) has been successfully delivered.\nPlease confirm the receipt.\nThank you for your support.\nWe hope to have the opportunity to serve you again soon.`; break; case "Completed": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) सफलतापूर्वक पूर्ण हो चुका है।\nआपके सहयोग के लिए धन्यवाद।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) has been successfully completed.\nThank you for your support.`; break; default: template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) का वर्तमान स्टेटस है: ${status}.\n\nDear ${namePlaceholder},\nThe current status for your order (Order No: ${orderNoPlaceholder}) is: ${status}.`; }

    // प्लेसहोल्डर बदलें (सुरक्षित तरीके से)
    let message = replaceAll(template, namePlaceholder, customerName);
    message = replaceAll(message, orderNoPlaceholder, orderId);
    message = replaceAll(message, deliveryDatePlaceholder, deliveryDateText);
    message += `\n\n${signature}`; return message;
}


// --- बल्क एक्शन फ़ंक्शंस ---
function handleSelectAllChange(event) { /* ... पहले जैसा ही ... */
    const isChecked = event.target.checked; const rows = orderTableBody.querySelectorAll('.row-selector'); selectedOrderIds.clear(); rows.forEach(cb => { const id = cb.dataset.id; cb.checked = isChecked; const row = cb.closest('tr'); if(isChecked){ selectedOrderIds.add(id); if(row) row.classList.add('selected-row'); } else { if(row) row.classList.remove('selected-row'); } }); updateBulkActionsBar();
}
function handleRowCheckboxChange(checkbox, firestoreId) { /* ... पहले जैसा ही ... */
    const row = checkbox.closest('tr'); if (checkbox.checked) { selectedOrderIds.add(firestoreId); if(row) row.classList.add('selected-row'); } else { selectedOrderIds.delete(firestoreId); if(row) row.classList.remove('selected-row'); } updateBulkActionsBar(); if (selectAllCheckbox) { const allCb = orderTableBody.querySelectorAll('.row-selector'); const allChecked = allCb.length > 0 && Array.from(allCb).every(cb => cb.checked); const someChecked = Array.from(allCb).some(cb => cb.checked); selectAllCheckbox.checked = allChecked; selectAllCheckbox.indeterminate = !allChecked && someChecked; }
}
function updateBulkActionsBar() { /* ... पहले जैसा ही ... */
    const count = selectedOrderIds.size; if (bulkActionsBar && selectedCountSpan && bulkUpdateStatusBtn && bulkDeleteBtn) { if (count > 0) { selectedCountSpan.textContent = `${count} item${count > 1 ? 's' : ''} selected`; bulkActionsBar.style.display = 'flex'; bulkUpdateStatusBtn.disabled = !(bulkStatusSelect && bulkStatusSelect.value); bulkDeleteBtn.disabled = false; } else { bulkActionsBar.style.display = 'none'; if (bulkStatusSelect) bulkStatusSelect.value = ''; bulkUpdateStatusBtn.disabled = true; bulkDeleteBtn.disabled = true; } }
}

// --- बल्क डिलीट (लिमिट और मोडल के साथ) ---
async function handleBulkDelete() { /* ... सीमा जांच शामिल ... */
    const idsToDelete = Array.from(selectedOrderIds); const MAX_DELETE_LIMIT = 5; if (idsToDelete.length > MAX_DELETE_LIMIT) { alert(`आप एक बार में अधिकतम ${MAX_DELETE_LIMIT} ऑर्डर डिलीट कर सकते हैं।`); return; } if (idsToDelete.length === 0) { alert("डिलीट करने के लिए कृपया ऑर्डर चुनें।"); return; } if (!bulkDeleteConfirmModal || !bulkDeleteOrderList || !confirmDeleteCheckbox || !confirmBulkDeleteBtn || !bulkDeleteCountSpan) { console.error("Bulk delete modal elements missing!"); return; } bulkDeleteOrderList.innerHTML = ''; const maxItemsToShow = 100; idsToDelete.forEach((id, index) => { if (index < maxItemsToShow) { const order = allOrdersCache.find(o => o.id === id); const displayId = order?.orderId || `Sys:${id.substring(0,6)}`; const customerName = order?.customerDetails?.fullName || 'N/A'; const li = document.createElement('li'); li.innerHTML = `<strong>${displayId}</strong> - ${escapeHtml(customerName)}`; bulkDeleteOrderList.appendChild(li); } }); if (idsToDelete.length > maxItemsToShow) { const li = document.createElement('li'); li.textContent = `... और ${idsToDelete.length - maxItemsToShow} अन्य ऑर्डर।`; bulkDeleteOrderList.appendChild(li); } bulkDeleteCountSpan.textContent = idsToDelete.length; confirmDeleteCheckbox.checked = false; confirmBulkDeleteBtn.disabled = true; bulkDeleteConfirmModal.style.display = 'flex';
}

// --- वास्तविक बल्क डिलीट लॉजिक ---
async function executeBulkDelete(idsToDelete) { /* ... पहले जैसा ही ... */
     if (idsToDelete.length === 0) return; console.log("Executing bulk delete:", idsToDelete); if(bulkDeleteBtn) bulkDeleteBtn.disabled = true; if(confirmBulkDeleteBtn) confirmBulkDeleteBtn.disabled = true; if(confirmBulkDeleteBtn) confirmBulkDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...'; const batch = writeBatch(db); idsToDelete.forEach(id => { const docRef = doc(db, "orders", id); batch.delete(docRef); }); try { await batch.commit(); console.log("Bulk delete successful."); alert(`${idsToDelete.length} order(s) deleted.`); selectedOrderIds.clear(); updateBulkActionsBar(); closeBulkDeleteModal(); } catch (e) { console.error("Bulk delete error:", e); alert(`Error deleting: ${e.message}`); } finally { if(bulkDeleteBtn) bulkDeleteBtn.disabled = false; if(confirmBulkDeleteBtn) confirmBulkDeleteBtn.disabled = false; if(confirmBulkDeleteBtn) confirmBulkDeleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Orders'; updateBulkActionsBar(); }
}

// --- बल्क स्टेटस अपडेट (लिमिट के साथ) ---
async function handleBulkUpdateStatus() { /* ... सीमा जांच शामिल ... */
    const idsToUpdate = Array.from(selectedOrderIds); const newStatus = bulkStatusSelect.value; const MAX_STATUS_UPDATE_LIMIT = 10; if (idsToUpdate.length > MAX_STATUS_UPDATE_LIMIT) { alert(`आप एक बार में अधिकतम ${MAX_STATUS_UPDATE_LIMIT} ऑर्डर का स्टेटस अपडेट कर सकते हैं।`); return; } if (idsToUpdate.length === 0) { alert("अपडेट करने के लिए कृपया ऑर्डर चुनें।"); return; } if (!newStatus) { alert("अपडेट करने के लिए कृपया स्टेटस चुनें।"); return; } if (!confirm(`क्या आप वाकई ${idsToUpdate.length} चयनित ऑर्डर का स्टेटस "${newStatus}" में बदलना चाहते हैं?`)) { return; } console.log(`Bulk status update to "${newStatus}" for:`, idsToUpdate); if (bulkUpdateStatusBtn) { bulkUpdateStatusBtn.disabled = true; bulkUpdateStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; } const batch = writeBatch(db); const now = Timestamp.now(); const historyEntry = { status: newStatus, timestamp: now }; idsToUpdate.forEach(id => { const docRef = doc(db, "orders", id); batch.update(docRef, { status: newStatus, updatedAt: now, statusHistory: arrayUnion(historyEntry) }); }); try { await batch.commit(); console.log("Bulk status update successful."); alert(`${idsToUpdate.length} order(s) status updated.`); selectedOrderIds.clear(); updateBulkActionsBar(); } catch (e) { console.error("Bulk status update error:", e); alert(`Error updating: ${e.message}`); } finally { if (bulkUpdateStatusBtn) { bulkUpdateStatusBtn.disabled = false; bulkUpdateStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Selected (Max 10)'; } if (bulkStatusSelect) bulkStatusSelect.value = ''; updateBulkActionsBar(); }
}

// --- CSV एक्सपोर्ट फ़ंक्शन ---
function exportToCsv() { /* ... पहले जैसा ही ... */
    console.log("Export CSV requested."); if (currentlyDisplayedOrders.length === 0) { alert("No data to export."); return; } const headers = [ "Firestore ID", "Order ID", "Customer Name", "WhatsApp No", "Contact No", "Address", "Order Date", "Delivery Date", "Status", "Urgent", "Remarks", "Products (Name | Qty)" ]; const rows = currentlyDisplayedOrders.map(order => { const productsString = (order.products || []).map(p => `${String(p.name || '').replace(/\|/g, '')}|${String(p.quantity || '')}`).join('; '); return [ order.id, order.orderId || '', order.customerDetails?.fullName || '', order.customerDetails?.whatsappNo || '', order.customerDetails?.contactNo || '', order.customerDetails?.address || '', order.orderDate || '', order.deliveryDate || '', order.status || '', order.urgent || 'No', order.remarks || '', productsString ]; }); let csvContent = "data:text/csv;charset=utf-8," + headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n" + rows.map(row => row.map(field => `"${String(field || '').replace(/"/g, '""')}"`).join(",")).join("\n"); const encodedUri = encodeURI(csvContent); const link = document.createElement("a"); link.setAttribute("href", encodedUri); const timestamp = new Date().toISOString().slice(0, 10); link.setAttribute("download", `orders_export_${timestamp}.csv`); document.body.appendChild(link); console.log("Triggering CSV download."); link.click(); document.body.removeChild(link);
}

// --- URL से मोडल खोलने का प्रयास ---
function attemptOpenModalFromUrl() { /* ... पहले जैसा ही ... */
    if (orderIdToOpenFromUrl && allOrdersCache.length > 0 && !modalOpenedFromUrl) { console.log(`Attempting modal open for ID: ${orderIdToOpenFromUrl}`); const orderData = allOrdersCache.find(o => o.id === orderIdToOpenFromUrl); if (orderData) { console.log("Order found, opening modal."); openDetailsModal(orderIdToOpenFromUrl, orderData); modalOpenedFromUrl = true; try { const url = new URL(window.location); url.searchParams.delete('openModalForId'); window.history.replaceState({}, '', url.toString()); } catch(e) { window.history.replaceState(null, '', window.location.pathname); } orderIdToOpenFromUrl = null; } else { console.warn(`Order ID ${orderIdToOpenFromUrl} not in cache.`); } }
}

// --- बल्क डिलीट मोडल बंद करने का फ़ंक्शन ---
function closeBulkDeleteModal() { if (bulkDeleteConfirmModal) bulkDeleteConfirmModal.style.display = 'none'; }

// --- अंतिम लॉग ---
console.log("order_history.js script (Final Corrected Version - RegExp & RowGen fix) loaded.");