// js/order_history.js
// Updated Version: Includes date format fix inside displayOrderRow

const {
    db, collection, onSnapshot, query, orderBy, where,
    doc, getDoc, deleteDoc, updateDoc, Timestamp, serverTimestamp,
    arrayUnion, writeBatch, limit, addDoc, getDocs // Added getDocs
} = window;

// --- START DEBUG LOGGING HELPER ---
function logElementFind(id) {
    const element = document.getElementById(id);
    // console.log(`Finding element with ID '${id}':`, element ? 'FOUND' : '!!! NOT FOUND !!!'); // Optional: Keep or remove logging
    return element;
}
// --- END DEBUG LOGGING HELPER ---


// DOM Element References (ensure all IDs match your HTML)
// console.log("--- Defining DOM Element References ---"); // Optional logging
const orderTableBody = logElementFind('orderTableBody');
const loadingRow = logElementFind('loadingMessage'); // Note: HTML might use loading-message-row ID
const sortSelect = logElementFind('sort-orders');
const filterDateInput = logElementFind('filterDate');
const filterSearchInput = logElementFind('filterSearch');
const filterStatusSelect = logElementFind('filterStatus');
const clearFiltersBtn = logElementFind('clearFiltersBtn');
const totalOrdersSpan = logElementFind('total-orders');
const completedOrdersSpan = logElementFind('completed-delivered-orders');
const pendingOrdersSpan = logElementFind('pending-orders');
const exportCsvBtn = logElementFind('exportCsvBtn');
const selectAllCheckbox = logElementFind('selectAllCheckbox');
const bulkActionsBar = logElementFind('bulkActionsBar');
const selectedCountSpan = logElementFind('selectedCount');
const bulkStatusSelect = logElementFind('bulkStatusSelect');
const bulkUpdateStatusBtn = logElementFind('bulkUpdateStatusBtn');
const bulkDeleteBtn = logElementFind('bulkDeleteBtn');
const reportingSection = logElementFind('reportingSection');
const statusCountsReportContainer = logElementFind('statusCountsReport');
const newCustomerBtn = logElementFind('newCustomerBtn');
const paymentReceivedBtn = logElementFind('paymentReceivedBtn');
const detailsModal = logElementFind('detailsModal');
const closeModalBtn = logElementFind('closeDetailsModal');
const modalOrderIdInput = logElementFind('modalOrderId');
const modalDisplayOrderIdSpan = logElementFind('modalDisplayOrderId');
const modalCustomerNameSpan = logElementFind('modalCustomerName');
const modalCustomerWhatsAppSpan = logElementFind('modalCustomerWhatsApp');
const modalCustomerContactSpan = logElementFind('modalCustomerContact');
const modalCustomerAddressSpan = logElementFind('modalCustomerAddress');
const modalOrderDateSpan = logElementFind('modalOrderDate');
const modalDeliveryDateSpan = logElementFind('modalDeliveryDate');
const modalPrioritySpan = logElementFind('modalPriority');
const modalRemarksSpan = logElementFind('modalRemarks');
const modalOrderStatusSelect = logElementFind('modalOrderStatus');
const modalUpdateStatusBtn = logElementFind('modalUpdateStatusBtn');
const modalStatusHistoryListContainer = logElementFind('modalStatusHistoryList');
const modalProductListContainer = logElementFind('modalProductList');
const modalTotalAmountSpan = logElementFind('modalTotalAmount');
const modalAmountPaidSpan = logElementFind('modalAmountPaid');
const modalBalanceDueSpan = logElementFind('modalBalanceDue');
const modalPaymentStatusSpan = logElementFind('modalPaymentStatus');
const addPaymentBtn = logElementFind('addPaymentBtn');
const modalPOListContainer = logElementFind('modalPOList');
const modalCreatePOBtn = logElementFind('modalCreatePOBtn');
const modalDeleteBtn = logElementFind('modalDeleteBtn');
const modalEditFullBtn = logElementFind('modalEditFullBtn');
const whatsappReminderPopup = logElementFind('whatsapp-reminder-popup');
const whatsappPopupCloseBtn = logElementFind('popup-close-btn');
const whatsappMsgPreview = logElementFind('whatsapp-message-preview');
const whatsappSendLink = logElementFind('whatsapp-send-link');
const bulkDeleteConfirmModal = logElementFind('bulkDeleteConfirmModal');
const closeBulkDeleteModalBtn = logElementFind('closeBulkDeleteModal');
const cancelBulkDeleteBtn = logElementFind('cancelBulkDeleteBtn');
const confirmBulkDeleteBtn = logElementFind('confirmBulkDeleteBtn');
const confirmDeleteCheckbox = logElementFind('confirmDeleteCheckbox');
const bulkDeleteOrderList = logElementFind('bulkDeleteOrderList');
const bulkDeleteCountSpan = logElementFind('bulkDeleteCount');
const poItemSelectionModal = logElementFind('poItemSelectionModal');
const closePoItemSelectionModalBtn = logElementFind('closePoItemSelectionModalBtn');
const poItemSelectionOrderIdInput = logElementFind('poItemSelectionOrderIdInput');
const poItemSelectionDisplayOrderIdSpan = logElementFind('poItemSelectionDisplayOrderIdSpan');
const poItemSelectionListContainer = logElementFind('poItemSelectionListContainer');
const poSupplierSearchInput = logElementFind('poSupplierSearchInput');
const poSelectedSupplierIdInput = logElementFind('poSelectedSupplierId');
const poSelectedSupplierNameInput = logElementFind('poSelectedSupplierName');
const poSupplierSuggestionsDiv = logElementFind('poSupplierSuggestions');
const cancelPoItemSelectionBtn = logElementFind('cancelPoItemSelectionBtn');
const proceedToCreatePOBtn = logElementFind('proceedToCreatePOBtn');
const poItemSelectionError = logElementFind('poItemSelectionError');
const poItemSelectionList = logElementFind('poItemSelectionList');
const poDetailsPopup = logElementFind('poDetailsPopup');
const poDetailsPopupContent = logElementFind('poDetailsPopupContent');
const closePoDetailsPopupBtn = logElementFind('closePoDetailsPopupBtn');
const closePoDetailsPopupBottomBtn = logElementFind('closePoDetailsPopupBottomBtn');
const printPoDetailsPopupBtn = logElementFind('printPoDetailsPopupBtn');
const readOnlyOrderModal = logElementFind('readOnlyOrderModal');
const closeReadOnlyOrderModalBtn = logElementFind('closeReadOnlyOrderModal');
const readOnlyOrderModalTitle = logElementFind('readOnlyOrderModalTitle');
const readOnlyOrderModalContent = logElementFind('readOnlyOrderModalContent');
const closeReadOnlyOrderModalBottomBtn = logElementFind('closeReadOnlyOrderModalBottomBtn');
const itemsOnlyModal = logElementFind('itemsOnlyModal');
const closeItemsOnlyModalBtn = logElementFind('closeItemsOnlyModal');
const itemsOnlyModalTitle = logElementFind('itemsOnlyModalTitle');
const itemsOnlyModalContent = logElementFind('itemsOnlyModalContent');
const closeItemsOnlyModalBottomBtn = logElementFind('closeItemsOnlyModalBottomBtn');
// console.log("--- Finished Defining DOM Elements ---"); // Optional logging

// Global State Variables
let currentSortField = 'createdAt';
let currentSortDirection = 'desc';
let unsubscribeOrders = null;
let allOrdersCache = [];
let currentlyDisplayedOrders = [];
let searchDebounceTimer;
let supplierSearchDebounceTimerPO;
let currentStatusFilter = '';
let orderIdToOpenFromUrl = null;
let modalOpenedFromUrl = false;
let selectedOrderIds = new Set();
let activeOrderDataForModal = null;
let cachedSuppliers = {};
let cachedPOsForOrder = {};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log("Order History DOM Loaded. Initializing...");

    const urlParams = new URLSearchParams(window.location.search);
    orderIdToOpenFromUrl = urlParams.get('openModalForId');
    currentStatusFilter = urlParams.get('status');
    if (orderIdToOpenFromUrl) console.log(`Request to open modal for ID: ${orderIdToOpenFromUrl}`);
    if (currentStatusFilter && filterStatusSelect) filterStatusSelect.value = currentStatusFilter;

    waitForDbConnection(() => {
        listenForOrders();
        setupEventListeners();
    });
});

// Function to setup all event listeners
function setupEventListeners() {
    // ... (All event listener assignments remain the same as your provided file) ...
    // Filter/Sort Listeners
   if (sortSelect) sortSelect.addEventListener('change', handleSortChange);
   if (filterDateInput) filterDateInput.addEventListener('change', handleFilterChange);
   if (filterSearchInput) filterSearchInput.addEventListener('input', handleSearchInput);
   if (filterStatusSelect) filterStatusSelect.addEventListener('change', handleFilterChange);
   if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
   if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCsv);

   // Action Bar Buttons
   if (newCustomerBtn) newCustomerBtn.addEventListener('click', () => {
       alert('New Customer button clicked - Needs modal and save functionality.');
   });
   if (paymentReceivedBtn) paymentReceivedBtn.addEventListener('click', () => {
        alert('Payment Received button clicked - Needs modal, search, balance, save functionality.');
   });

   // Bulk Actions Listeners
   if (selectAllCheckbox) selectAllCheckbox.addEventListener('change', handleSelectAllChange);
   if (bulkUpdateStatusBtn) bulkUpdateStatusBtn.addEventListener('click', handleBulkUpdateStatus);
   if (bulkDeleteBtn) bulkDeleteBtn.addEventListener('click', handleBulkDelete);
   if (bulkStatusSelect) bulkStatusSelect.addEventListener('change', updateBulkActionsBar);
   if (confirmDeleteCheckbox) confirmDeleteCheckbox.addEventListener('change', () => { if(confirmBulkDeleteBtn) confirmBulkDeleteBtn.disabled = !confirmDeleteCheckbox.checked; });
   if (confirmBulkDeleteBtn) confirmBulkDeleteBtn.addEventListener('click', () => { if (confirmDeleteCheckbox.checked) executeBulkDelete(Array.from(selectedOrderIds)); });
   if (cancelBulkDeleteBtn) cancelBulkDeleteBtn.addEventListener('click', closeBulkDeleteModal);
   if (closeBulkDeleteModalBtn) closeBulkDeleteModalBtn.addEventListener('click', closeBulkDeleteModal);
   if (bulkDeleteConfirmModal) bulkDeleteConfirmModal.addEventListener('click', (event) => { if (event.target === bulkDeleteConfirmModal) closeBulkDeleteModal(); });

   // Details Modal Listeners
   if (closeModalBtn) closeModalBtn.addEventListener('click', closeDetailsModal);
   if (detailsModal) detailsModal.addEventListener('click', (event) => { if (event.target === detailsModal) closeDetailsModal(); });
   if (modalUpdateStatusBtn) modalUpdateStatusBtn.addEventListener('click', handleUpdateStatus);
   if (modalDeleteBtn) modalDeleteBtn.addEventListener('click', handleDeleteFromModal);
   if (modalEditFullBtn) modalEditFullBtn.addEventListener('click', handleEditFullFromModal);
   if (addPaymentBtn) addPaymentBtn.addEventListener('click', () => alert('Add Payment clicked - Needs implementation'));
   if (modalCreatePOBtn) modalCreatePOBtn.addEventListener('click', handleCreatePOFromModal);

   // WhatsApp Popup Listeners
   if (whatsappPopupCloseBtn) whatsappPopupCloseBtn.addEventListener('click', closeWhatsAppPopup);
   if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (event) => { if (event.target === whatsappReminderPopup) closeWhatsAppPopup(); });

   // PO Item Selection Modal Listeners
   if (closePoItemSelectionModalBtn) closePoItemSelectionModalBtn.addEventListener('click', closePoItemSelectionModal);
   if (cancelPoItemSelectionBtn) cancelPoItemSelectionBtn.addEventListener('click', closePoItemSelectionModal);
   if (poItemSelectionModal) poItemSelectionModal.addEventListener('click', (event) => { if (event.target === poItemSelectionModal) closePoItemSelectionModal(); });
   if (proceedToCreatePOBtn) proceedToCreatePOBtn.addEventListener('click', handleProceedToCreatePO);
   if (poSupplierSearchInput) poSupplierSearchInput.addEventListener('input', handlePOSupplierSearchInput);
   if (poItemSelectionList) { poItemSelectionList.addEventListener('change', handlePOItemCheckboxChange); }
   else { console.warn("Element 'poItemSelectionList' not found, cannot add change listener for PO items."); }
   document.addEventListener('click', (e) => { if (poSupplierSuggestionsDiv && poSupplierSuggestionsDiv.style.display === 'block' && !poSupplierSearchInput.contains(e.target) && !poSupplierSuggestionsDiv.contains(e.target)) { poSupplierSuggestionsDiv.style.display = 'none'; } });

    // PO Details Popup Listeners
    if (closePoDetailsPopupBtn) closePoDetailsPopupBtn.addEventListener('click', closePODetailsPopup);
    if (closePoDetailsPopupBottomBtn) closePoDetailsPopupBottomBtn.addEventListener('click', closePODetailsPopup);
    if (printPoDetailsPopupBtn) printPoDetailsPopupBtn.addEventListener('click', handlePrintPODetailsPopup);
    if (poDetailsPopup) poDetailsPopup.addEventListener('click', (event) => { if (event.target === poDetailsPopup) closePODetailsPopup(); });

    // Read-Only Modal Listeners
    if (closeReadOnlyOrderModalBtn) closeReadOnlyOrderModalBtn.addEventListener('click', closeReadOnlyOrderModal);
    if (closeReadOnlyOrderModalBottomBtn) closeReadOnlyOrderModalBottomBtn.addEventListener('click', closeReadOnlyOrderModal);
    if (readOnlyOrderModal) readOnlyOrderModal.addEventListener('click', (event) => { if (event.target === readOnlyOrderModal) closeReadOnlyOrderModal(); });

    // Items Only Modal Listeners
    if (closeItemsOnlyModalBtn) closeItemsOnlyModalBtn.addEventListener('click', closeItemsOnlyPopup);
    if (closeItemsOnlyModalBottomBtn) closeItemsOnlyModalBottomBtn.addEventListener('click', closeItemsOnlyPopup);
    if (itemsOnlyModal) itemsOnlyModal.addEventListener('click', (event) => { if (event.target === itemsOnlyModal) closeItemsOnlyPopup(); });

   // Table Event Delegation
   if (orderTableBody) { orderTableBody.addEventListener('click', handleTableClick); }
   else { console.error("Element with ID 'orderTableBody' not found!"); }
}

// Utility: Find order data in the cache
function findOrderInCache(firestoreId) {
    const orderWrapper = allOrdersCache.find(o => o.id === firestoreId);
    return orderWrapper ? orderWrapper.data : null;
}

// Utility: Wait for Firestore connection
function waitForDbConnection(callback) {
    if (window.db) { callback(); }
    else { let attempt = 0; const maxAttempts = 20; const interval = setInterval(() => { attempt++; if (window.db) { clearInterval(interval); callback(); } else if (attempt >= maxAttempts) { clearInterval(interval); console.error("DB connection timeout (order_history.js)"); alert("Database connection failed. Please refresh the page."); } }, 250); }
}

// --- Filter, Sort, Search Handlers ---
function handleSortChange() { if (!sortSelect) return; const [field, direction] = sortSelect.value.split('_'); if (field && direction) { currentSortField = field; currentSortDirection = direction; applyFiltersAndRender(); } }
function handleFilterChange() { applyFiltersAndRender(); }
function handleSearchInput() { clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(applyFiltersAndRender, 300); }
function clearFilters() { if (filterDateInput) filterDateInput.value = ''; if (filterSearchInput) filterSearchInput.value = ''; if (filterStatusSelect) filterStatusSelect.value = ''; if (sortSelect) sortSelect.value = 'createdAt_desc'; currentSortField = 'createdAt'; currentSortDirection = 'desc'; currentStatusFilter = ''; selectedOrderIds.clear(); updateBulkActionsBar(); if (selectAllCheckbox) selectAllCheckbox.checked = false; if (history.replaceState) { const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname; window.history.replaceState({ path: cleanUrl }, '', cleanUrl); } applyFiltersAndRender(); }

// --- Firestore Listener ---
function listenForOrders() {
    // ... (Function remains the same as your provided file) ...
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    if (!db) { console.error("Firestore instance (db) not available for listener."); return; }
    if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="11" id="loadingMessage">Loading orders...</td></tr>`;

    try {
        const q = query(collection(db, "orders")); // Consider adding orderBy('createdAt', 'desc') here if always needed initially
        unsubscribeOrders = onSnapshot(q, (snapshot) => {
            console.log(`Firestore snapshot received: ${snapshot.docs.length} docs`);
            allOrdersCache = snapshot.docs.map(doc => ({
                 id: doc.id,
                 data: {
                     id: doc.id, orderId: doc.data().orderId || '', customerId: doc.data().customerId || null,
                     customerDetails: doc.data().customerDetails || {}, items: doc.data().items || [],
                     orderDate: doc.data().orderDate || null, deliveryDate: doc.data().deliveryDate || null,
                     urgent: doc.data().urgent || 'No', status: doc.data().status || 'Unknown',
                     statusHistory: doc.data().statusHistory || [], createdAt: doc.data().createdAt || null,
                     updatedAt: doc.data().updatedAt || null, remarks: doc.data().remarks || '',
                     totalAmount: doc.data().totalAmount ?? null, amountPaid: doc.data().amountPaid ?? null,
                     paymentStatus: doc.data().paymentStatus || 'Pending', linkedPOs: doc.data().linkedPOs || []
                 }
             }));
            selectedOrderIds.clear(); updateBulkActionsBar(); if (selectAllCheckbox) selectAllCheckbox.checked = false;
            applyFiltersAndRender();
            attemptOpenModalFromUrl();
        }, (error) => {
            console.error("Error fetching orders snapshot:", error);
            if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="11" style="color: red;">Error loading orders. Check console.</td></tr>`;
        });
    } catch (error) {
        console.error("Error setting up Firestore listener:", error);
        if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="11" style="color: red;">Error setting up listener.</td></tr>`;
    }
}

// --- Apply Filters & Render Table ---
function applyFiltersAndRender() {
    // ... (Function remains the same as your provided file) ...
    if (!allOrdersCache) { console.warn("Order cache not ready for filtering."); return; }
    const filterDateValue = filterDateInput ? filterDateInput.value : '';
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';
    const filterStatusValue = filterStatusSelect ? filterStatusSelect.value : '';
    currentStatusFilter = filterStatusValue;

    let filteredOrders = allOrdersCache.filter(orderWrapper => {
        const order = orderWrapper.data;
        if (!order) return false;
        if (filterStatusValue && order.status !== filterStatusValue) return false;
        if (filterDateValue) {
            let orderDateStr = '';
            if (order.orderDate?.toDate) {
                 try {
                    const d = order.orderDate.toDate();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    orderDateStr = `${d.getFullYear()}-${month}-${day}`;
                 } catch(e){}
            } else if (typeof order.orderDate === 'string' && order.orderDate.match(/^\d{4}-\d{2}-\d{2}$/)) { orderDateStr = order.orderDate; }
            if(orderDateStr !== filterDateValue) return false;
        }
        if (filterSearchValue) {
            const itemsString = (order.items || []).map(p => String(p.productName || '').toLowerCase()).join(' ');
            const fieldsToSearch = [
                String(order.orderId || '').toLowerCase(), String(order.customerDetails?.fullName || '').toLowerCase(),
                String(order.id || '').toLowerCase(), String(order.customerDetails?.whatsappNo || ''),
                String(order.customerDetails?.contactNo || ''), itemsString
            ];
            if (!fieldsToSearch.some(field => field.includes(filterSearchValue))) return false;
        }
        return true;
    });

    try {
        filteredOrders.sort((aWrapper, bWrapper) => {
            const a = aWrapper.data; const b = bWrapper.data;
            let valA = a[currentSortField]; let valB = b[currentSortField];
            if (valA?.toDate) valA = valA.toDate().getTime(); if (valB?.toDate) valB = valB.toDate().getTime();
            if (['orderDate', 'deliveryDate', 'createdAt', 'updatedAt'].includes(currentSortField)) { valA = Number(valA) || 0; valB = Number(valB) || 0; }
            if (typeof valA === 'string') valA = valA.toLowerCase(); if (typeof valB === 'string') valB = valB.toLowerCase();
            let sortComparison = 0; if (valA > valB) sortComparison = 1; else if (valA < valB) sortComparison = -1;
            return currentSortDirection === 'desc' ? sortComparison * -1 : sortComparison;
        });
    } catch (sortError) { console.error("Error during sorting:", sortError); }

    currentlyDisplayedOrders = filteredOrders.map(ow => ow.data);
    updateOrderCountsAndReport(currentlyDisplayedOrders);

    if (!orderTableBody) return;
    orderTableBody.innerHTML = '';

    if (currentlyDisplayedOrders.length === 0) { orderTableBody.innerHTML = `<tr><td colspan="11" id="noOrdersMessage">No orders found matching your criteria.</td></tr>`; }
    else { const searchTermForHighlight = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : ''; currentlyDisplayedOrders.forEach(order => { displayOrderRow(order.id, order, searchTermForHighlight); }); }
    updateSelectAllCheckboxState();
}

// Updates the state of the master "Select All" checkbox
function updateSelectAllCheckboxState() {
    // ... (Function remains the same as your provided file) ...
    if (selectAllCheckbox) { const allVisibleCheckboxes = orderTableBody.querySelectorAll('.row-selector'); const totalVisible = allVisibleCheckboxes.length; if (totalVisible === 0) { selectAllCheckbox.checked = false; selectAllCheckbox.indeterminate = false; return; } const numSelectedVisible = Array.from(allVisibleCheckboxes).filter(cb => selectedOrderIds.has(cb.dataset.id)).length; if (numSelectedVisible === totalVisible) { selectAllCheckbox.checked = true; selectAllCheckbox.indeterminate = false; } else if (numSelectedVisible > 0) { selectAllCheckbox.checked = false; selectAllCheckbox.indeterminate = true; } else { selectAllCheckbox.checked = false; selectAllCheckbox.indeterminate = false; } }
}

// Updates summary counts and reporting section
function updateOrderCountsAndReport(displayedOrders) {
    // ... (Function remains the same as your provided file) ...
    const total = displayedOrders.length; let completedDelivered = 0; const statusCounts = {};
    displayedOrders.forEach(order => { const status = order.status || 'Unknown'; if (status === 'Completed' || status === 'Delivered') completedDelivered++; statusCounts[status] = (statusCounts[status] || 0) + 1; });
    const pending = total - completedDelivered;
    if (totalOrdersSpan) totalOrdersSpan.textContent = total; if (completedOrdersSpan) completedOrdersSpan.textContent = completedDelivered; if (pendingOrdersSpan) pendingOrdersSpan.textContent = pending;
    if (statusCountsReportContainer) { if (total === 0) { statusCountsReportContainer.innerHTML = '<p>No orders to report.</p>'; } else { let reportHtml = '<ul>'; Object.keys(statusCounts).sort().forEach(status => { reportHtml += `<li>${escapeHtml(status)}: <strong>${statusCounts[status]}</strong></li>`; }); reportHtml += '</ul>'; statusCountsReportContainer.innerHTML = reportHtml; } }
}

// Utility: Escape HTML & Highlight Match
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { try { unsafe = String(unsafe ?? ''); } catch(e) { unsafe = '';} } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function highlightMatch(text, term) { const escapedText = escapeHtml(text); if (!term || !text) return escapedText; try { const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'); const regex = new RegExp(`(${escapedTerm})`, 'gi'); return escapedText.replace(regex, '<mark>$1</mark>'); } catch (e) { console.warn("Highlighting regex error:", e); return escapedText; } }

// --- Display Single Order Row ---
function displayOrderRow(firestoreId, data, searchTerm = '') {
    if (!orderTableBody || !data) return;

    const tableRow = document.createElement('tr');
    tableRow.setAttribute('data-id', firestoreId);
    if (selectedOrderIds.has(firestoreId)) tableRow.classList.add('selected-row');

    const customerDetails = data.customerDetails || {};
    const customerName = customerDetails.fullName || 'N/A';
    const customerMobile = customerDetails.whatsappNo || '-';

    // --- *** CORRECTED formatDate FUNCTION INSIDE displayOrderRow *** ---
    const formatDate = (dIn) => {
        if (!dIn) return '-'; // Handle null/undefined input
        try {
            // Use dIn.toDate() if it's a Firestore Timestamp
            const d = (dIn.toDate) ? dIn.toDate() : new Date(dIn);
            // Check if the date object is valid
            return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-GB'); // Format dd/mm/yyyy
        } catch (e) { // Catch potential errors during conversion
            console.error("Error formatting date in displayOrderRow:", dIn, e); // Log error
            return '-';
        }
    };
    // --- *** END OF CORRECTION *** ---

    const orderDateStr = formatDate(data.orderDate);
    const deliveryDateStr = formatDate(data.deliveryDate);
    const displayId = data.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`;
    const orderIdHtml = `<a href="#" class="order-id-link" data-id="${firestoreId}">${highlightMatch(displayId, searchTerm)}</a>`;
    const customerNameHtml = `<a href="#" class="customer-name-link" data-id="${firestoreId}">${highlightMatch(customerName, searchTerm)}</a>`;
    const status = data.status || 'Unknown';
    const priority = data.urgent === 'Yes' ? 'Yes' : 'No';

    let itemsHtml = '-'; const items = data.items || []; const MAX_ITEMS_DISPLAY = 1;
    if (Array.isArray(items) && items.length > 0) {
        itemsHtml = items.slice(0, MAX_ITEMS_DISPLAY).map(item => { if (!item) return ''; const name = highlightMatch(item.productName || 'Unnamed Item', searchTerm); const quantity = highlightMatch(item.quantity || '?', searchTerm); return `${name} (${quantity})`; }).filter(html => html).join('<br>');
        if (items.length > MAX_ITEMS_DISPLAY) { itemsHtml += `<br><a href="#" class="see-more-link" data-id="${firestoreId}">... (${items.length - MAX_ITEMS_DISPLAY} more)</a>`; }
    }

    const statusClass = `status-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const priorityClass = priority === 'Yes' ? 'priority-yes' : 'priority-no';

    let poInfoHtml = ''; const linkedPOs = data.linkedPOs || [];
    if (linkedPOs.length > 0) { poInfoHtml = linkedPOs.map(po => { if (!po?.poId) return ''; const poDate = po.createdAt?.toDate ? po.createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'N/A'; const poNum = escapeHtml(po.poNumber||'N/A'); return `<a href="#" class="view-po-details-link" data-poid="${escapeHtml(po.poId)}" title="View PO #${poNum} Details">PO #${poNum}</a> (${poDate})`; }).filter(h=>h).join('<br>'); }
    else { poInfoHtml = `<button type="button" class="button create-po-button icon-only" data-id="${firestoreId}" title="Create Purchase Order"><i class="fas fa-file-alt"></i></button>`; }

    try {
        tableRow.innerHTML = `
            <td class="col-checkbox"><input type="checkbox" class="row-selector" data-id="${firestoreId}" ${selectedOrderIds.has(firestoreId)?'checked':''}></td>
            <td>${orderIdHtml}</td>
            <td><span class="customer-name-display">${customerNameHtml}</span><span class="customer-mobile-inline">${highlightMatch(customerMobile, searchTerm)}</span></td>
            <td>${itemsHtml}</td>
            <td>${orderDateStr}</td>
            <td>${deliveryDateStr}</td>
            <td class="${priorityClass}">${priority}</td>
            <td><span class="status-badge ${statusClass}">${highlightMatch(status, searchTerm)}</span></td>
            <td class="po-info-cell">${poInfoHtml}</td>
            <td><button type="button" class="button details-edit-button" data-id="${firestoreId}"><i class="fas fa-info-circle"></i> Details</button></td>
            <td><button type="button" class="button whatsapp-button" data-id="${firestoreId}" title="Send Status on WhatsApp"><i class="fab fa-whatsapp"></i></button></td>
        `;
        orderTableBody.appendChild(tableRow);
    } catch (error) {
        console.error(`Error creating table row HTML for order ${firestoreId}:`, error, data);
        const errorRow = document.createElement('tr'); errorRow.innerHTML = `<td colspan="11" style="color: red;">Error displaying order: ${escapeHtml(firestoreId)}. Check console.</td>`; orderTableBody.appendChild(errorRow);
    }
}

// Handles clicks within the order table body
function handleTableClick(event) {
    // ... (Function remains the same as your provided file) ...
    const target = event.target; const row = target.closest('tr'); if (!row || !row.dataset.id) return;
    const firestoreId = row.dataset.id; const orderData = findOrderInCache(firestoreId); if (!orderData) { console.warn(`Order data not found in cache for ID: ${firestoreId}.`); return; }
    if (target.matches('.row-selector')) { handleRowCheckboxChange(target, firestoreId); }
    else if (target.closest('.order-id-link')) { event.preventDefault(); openReadOnlyOrderPopup(firestoreId, orderData); }
    else if (target.closest('.customer-name-link')) { event.preventDefault(); const customerId = orderData.customerId; if (customerId) { window.location.href = `customer_account_detail.html?id=${customerId}`; } else { console.error(`Customer ID missing for order Firestore ID: ${firestoreId}`, orderData); alert('Customer linking ID not found for this order.'); } }
    else if (target.closest('.create-po-button')) { event.preventDefault(); openPOItemSelectionModal(firestoreId, orderData); }
    else if (target.closest('.view-po-details-link')) { event.preventDefault(); const poId = target.closest('.view-po-details-link').dataset.poid; if (poId) { openPODetailsPopup(poId); } else { console.error("PO ID missing on view link"); } }
    else if (target.closest('.see-more-link')) { event.preventDefault(); openItemsOnlyPopup(firestoreId); }
    else if (target.closest('.details-edit-button')) { openDetailsModal(firestoreId, orderData); }
    else if (target.closest('.whatsapp-button')) { sendWhatsAppMessage(firestoreId, orderData); }
}

// --- Open Details Modal ---
async function openDetailsModal(firestoreId, orderData) {
    // ... (Function remains the same as your provided file) ...
    if (!orderData || !detailsModal) return; activeOrderDataForModal = orderData;
    if(modalOrderIdInput) modalOrderIdInput.value = firestoreId; if(modalDisplayOrderIdSpan) modalDisplayOrderIdSpan.textContent = orderData.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`; if(modalCustomerNameSpan) modalCustomerNameSpan.textContent = orderData.customerDetails?.fullName || 'N/A'; if(modalCustomerWhatsAppSpan) modalCustomerWhatsAppSpan.textContent = orderData.customerDetails?.whatsappNo || 'N/A'; if(modalCustomerContactSpan) modalCustomerContactSpan.textContent = orderData.customerDetails?.contactNo || 'N/A'; if(modalCustomerAddressSpan) modalCustomerAddressSpan.textContent = orderData.customerDetails?.address || 'N/A';
    const formatDate = (dIn) => { if (!dIn) return 'N/A'; try { const d = (dIn.toDate)?d.toDate():new Date(dIn); return isNaN(d.getTime())?'N/A':d.toLocaleDateString('en-GB'); } catch { return 'N/A'; } };
    if(modalOrderDateSpan) modalOrderDateSpan.textContent = formatDate(orderData.orderDate); if(modalDeliveryDateSpan) modalDeliveryDateSpan.textContent = formatDate(orderData.deliveryDate); if(modalPrioritySpan) modalPrioritySpan.textContent = orderData.urgent || 'No'; if(modalRemarksSpan) modalRemarksSpan.textContent = escapeHtml(orderData.remarks || 'None');
    if (modalProductListContainer) { modalProductListContainer.innerHTML = ''; const items = orderData.items || []; if (items.length > 0) { const ul = document.createElement('ul'); ul.className = 'modal-product-list-ul'; items.forEach(item => { if (!item) return; const li = document.createElement('li'); const nameSpan = document.createElement('span'); nameSpan.className = 'product-name'; nameSpan.textContent = escapeHtml(item.productName || 'Unnamed Item'); const detailsSpan = document.createElement('span'); detailsSpan.className = 'product-qty-details'; detailsSpan.textContent = ` - Qty: ${escapeHtml(item.quantity || '?')}`; li.append(nameSpan, detailsSpan); ul.appendChild(li); }); modalProductListContainer.appendChild(ul); } else { modalProductListContainer.innerHTML = '<p class="no-products">No items listed.</p>'; } }
    if(modalOrderStatusSelect) modalOrderStatusSelect.value = orderData.status || '';
    if (modalStatusHistoryListContainer) { modalStatusHistoryListContainer.innerHTML = ''; const history = orderData.statusHistory || []; if (history.length > 0) { const sortedHistory = [...history].sort((a, b) => (b.timestamp?.toDate?.()?.getTime() ?? 0) - (a.timestamp?.toDate?.()?.getTime() ?? 0)); const ul = document.createElement('ul'); ul.className = 'modal-status-history-ul'; sortedHistory.forEach(entry => { const li = document.createElement('li'); const statusSpan = document.createElement('span'); statusSpan.className = 'history-status'; statusSpan.textContent = escapeHtml(entry.status || '?'); const timeSpan = document.createElement('span'); timeSpan.className = 'history-time'; try { timeSpan.textContent = entry.timestamp?.toDate ? entry.timestamp.toDate().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : '?'; } catch { timeSpan.textContent = '?'; } li.append(statusSpan, timeSpan); ul.appendChild(li); }); modalStatusHistoryListContainer.appendChild(ul); } else { modalStatusHistoryListContainer.innerHTML = '<p class="no-history">No status history.</p>'; } }
    const totalAmount = orderData.totalAmount ?? null; const amountPaid = orderData.amountPaid ?? null; let balanceDueText = 'N/A'; let paymentStatus = orderData.paymentStatus ?? null;
    if (totalAmount !== null && amountPaid !== null) { const balanceDue = totalAmount - amountPaid; balanceDueText = `₹ ${balanceDue.toFixed(2)}`; if (paymentStatus === null) paymentStatus = balanceDue <= 0 ? 'Paid' : 'Pending'; } else if (paymentStatus === null) { paymentStatus = 'N/A'; }
    if(modalTotalAmountSpan) modalTotalAmountSpan.textContent = totalAmount !== null ? `₹ ${totalAmount.toFixed(2)}` : 'N/A'; if(modalAmountPaidSpan) modalAmountPaidSpan.textContent = amountPaid !== null ? `₹ ${amountPaid.toFixed(2)}` : 'N/A'; if(modalBalanceDueSpan) modalBalanceDueSpan.textContent = balanceDueText; if(modalPaymentStatusSpan) modalPaymentStatusSpan.textContent = escapeHtml(paymentStatus);
    await displayPOsInModal(firestoreId, orderData.linkedPOs || []);
    if(detailsModal) detailsModal.style.display = 'flex';
}

// --- Display POs in Modal ---
async function displayPOsInModal(orderFirestoreId, linkedPOs) {
    // ... (Function remains the same as your provided file) ...
     if (!modalPOListContainer) return; modalPOListContainer.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading POs...</p>';
    if (!Array.isArray(linkedPOs) || linkedPOs.length === 0) { modalPOListContainer.innerHTML = '<p class="no-pos">No Purchase Orders linked.</p>'; return; }
    const validLinks = linkedPOs.filter(poLink => poLink?.poId); if (validLinks.length === 0) { modalPOListContainer.innerHTML = '<p class="no-pos">No valid POs linked.</p>'; return; }
    try { const poDetailsPromises = validLinks.map(poLink => getDoc(doc(db, "purchaseOrders", poLink.poId)).catch(err => { console.warn(`Failed to fetch PO ${poLink.poId}:`, err); return null; })); const poSnapshots = await Promise.all(poDetailsPromises); const ul = document.createElement('ul'); ul.className = 'modal-po-list-ul'; let validPOsFound = false;
        poSnapshots.forEach((poDoc, index) => { const poLink = validLinks[index]; if (!poDoc && !poLink) return; const li = document.createElement('li'); if (poDoc?.exists()) { validPOsFound = true; const poData = poDoc.data(); const poDate = poData.orderDate?.toDate ? poData.orderDate.toDate().toLocaleDateString('en-GB') : 'N/A'; const supplierName = escapeHtml(poData.supplierName || 'Unknown'); const poNumber = escapeHtml(poData.poNumber || 'N/A'); const status = escapeHtml(poData.status || 'N/A'); const total = (poData.totalAmount || 0).toFixed(2); li.innerHTML = `<a href="#" class="view-po-details-link" data-poid="${poDoc.id}">PO #${poNumber}</a><span> - ${supplierName} (${poDate})</span><span> - Status: ${status}</span><span> - Amount: ₹ ${total}</span>`; const link = li.querySelector('.view-po-details-link'); if (link) { link.addEventListener('click', (event) => { event.preventDefault(); const poId = event.target.closest('a').dataset.poid; if (poId) openPODetailsPopup(poId); }); } } else if (poLink?.poId) { li.innerHTML = `<span>PO (ID: ${escapeHtml(poLink.poId)}) not found.</span>`; li.style.color = 'grey'; li.style.fontStyle = 'italic'; } ul.appendChild(li); });
        modalPOListContainer.innerHTML = ''; if (validPOsFound) { modalPOListContainer.appendChild(ul); } else { modalPOListContainer.innerHTML = '<p class="no-pos">No valid POs loaded.</p>'; }
    } catch (error) { console.error("Error fetching PO details for modal:", error); modalPOListContainer.innerHTML = '<p class="error-message">Error loading POs.</p>'; }
}

// --- Close Details Modal ---
function closeDetailsModal() { if (detailsModal) detailsModal.style.display = 'none'; activeOrderDataForModal = null; }

// --- Handle Status Update ---
async function handleUpdateStatus() {
    // ... (Function remains the same as your provided file) ...
    const firestoreId = modalOrderIdInput.value; const newStatus = modalOrderStatusSelect.value; const orderDataForWhatsApp = activeOrderDataForModal ? { ...activeOrderDataForModal } : null;
    if (!firestoreId || !newStatus || !orderDataForWhatsApp) { alert("Cannot update status."); return; } if (orderDataForWhatsApp.status === newStatus) { alert("Status is already set."); return; }
    if (modalUpdateStatusBtn) { modalUpdateStatusBtn.disabled = true; modalUpdateStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; }
    const historyEntry = { status: newStatus, timestamp: Timestamp.now() };
    try { await updateDoc(doc(db, "orders", firestoreId), { status: newStatus, updatedAt: serverTimestamp(), statusHistory: arrayUnion(historyEntry) }); console.log(`Order ${firestoreId} status updated to ${newStatus}`); closeDetailsModal();
        if (orderDataForWhatsApp.customerDetails?.whatsappNo) { showStatusUpdateWhatsAppReminder( orderDataForWhatsApp.customerDetails, orderDataForWhatsApp.orderId || `Sys:${firestoreId.substring(0,6)}`, newStatus ); }
        else { console.log("No WhatsApp number found."); alert("Status updated successfully!"); }
    } catch (e) { console.error("Error updating status:", firestoreId, e); alert("Error updating status: " + e.message); if (modalUpdateStatusBtn) { modalUpdateStatusBtn.disabled = false; modalUpdateStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Status'; } }
    finally { if (modalUpdateStatusBtn && detailsModal.style.display !== 'none') { modalUpdateStatusBtn.disabled = false; modalUpdateStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Status'; } }
}

// --- Handle Delete from Modal ---
function handleDeleteFromModal() {
    // ... (Function remains the same as your provided file) ...
    const firestoreId = modalOrderIdInput.value; const displayId = modalDisplayOrderIdSpan.textContent; if (!firestoreId) { alert("Cannot delete. Order ID not found."); return; } if (confirm(`Delete Order ID: ${displayId}?`)) { closeDetailsModal(); deleteSingleOrder(firestoreId); } else { console.log("Deletion cancelled."); }
}
// --- Delete Single Order ---
async function deleteSingleOrder(firestoreId) {
    // ... (Function remains the same as your provided file) ...
    if (!db || !firestoreId) { alert("Delete unavailable or Order ID missing."); return; } console.log(`Attempting to delete order: ${firestoreId}`);
    try { await deleteDoc(doc(db, "orders", firestoreId)); console.log(`Order ${firestoreId} deleted.`); alert("Order deleted."); } catch (e) { console.error("Error deleting order:", firestoreId, e); alert("Error deleting order: " + e.message); }
}
// --- Handle Edit Full Order from Modal ---
function handleEditFullFromModal() {
    // ... (Function remains the same as your provided file) ...
    const firestoreId = modalOrderIdInput.value; if (firestoreId) { window.location.href = `new_order.html?editOrderId=${firestoreId}`; } else { alert("Cannot edit. Order ID not found."); }
}
// --- Handle Create PO from Modal ---
function handleCreatePOFromModal() {
    // ... (Function remains the same as your provided file) ...
    const orderFirestoreId = modalOrderIdInput.value; if (orderFirestoreId && activeOrderDataForModal) { const orderData = activeOrderDataForModal; closeDetailsModal(); openPOItemSelectionModal(orderFirestoreId, orderData); } else { alert("Cannot create PO. Order details not loaded."); }
}

// --- WhatsApp Functions ---
function showStatusUpdateWhatsAppReminder(customer, orderId, updatedStatus) {
    // ... (Function remains the same as your provided file) ...
    if (!whatsappReminderPopup || !whatsappMsgPreview || !whatsappSendLink || !customer) { console.warn("WhatsApp reminder elements or customer data missing."); return; }
    const name = customer.fullName || 'Customer'; const rawNum = customer.whatsappNo || ''; const num = rawNum.replace(/[^0-9]/g, ''); if (!num) { console.warn("WhatsApp number missing or invalid."); return; }
    let msg = getWhatsAppMessageTemplate(updatedStatus, name, orderId, null); whatsappMsgPreview.innerText = msg;
    const url = `https://wa.me/91${num}?text=${encodeURIComponent(msg)}`; whatsappSendLink.href = url;
    const title = document.getElementById('whatsapp-popup-title'); if(title) title.textContent = "Status Updated!"; whatsappReminderPopup.classList.add('active');
}
function closeWhatsAppPopup() { if (whatsappReminderPopup) whatsappReminderPopup.classList.remove('active'); }
function sendWhatsAppMessage(firestoreId, orderData) {
    // ... (Function remains the same as your provided file) ...
    if (!orderData?.customerDetails?.whatsappNo) { alert("WhatsApp number not found."); return; }
    const cust = orderData.customerDetails; const orderIdForMsg = orderData.orderId || `Sys:${firestoreId.substring(0,6)}`; const status = orderData.status; const deliveryDate = orderData.deliveryDate; const name = cust.fullName || 'Customer'; const rawNum = cust.whatsappNo; const num = rawNum.replace(/[^0-9]/g, ''); if (!num) { alert("Invalid WhatsApp number."); return; }
    let msg = getWhatsAppMessageTemplate(status, name, orderIdForMsg, deliveryDate); const url = `https://wa.me/91${num}?text=${encodeURIComponent(msg)}`; window.open(url, '_blank');
}
function getWhatsAppMessageTemplate(status, customerName, orderId, deliveryDate) {
    // ... (Function remains the same as your provided file) ...
    const namePlaceholder = "[Customer Name]"; const orderNoPlaceholder = "[ORDER_NO]"; const deliveryDatePlaceholder = "[DELIVERY_DATE]"; const companyName = "Madhav Offset"; const companyAddress = "Head Office: Moodh Market, Batadu"; const companyMobile = "9549116541"; const signature = `धन्यवाद,\n${companyName}\n${companyAddress}\nMobile: ${companyMobile}`; let template = ""; let deliveryDateText = "जल्द से जल्द";
    try { if(deliveryDate) { const dDate = (deliveryDate.toDate)?deliveryDate.toDate():new Date(deliveryDate); if (!isNaN(dDate.getTime())) { deliveryDateText = dDate.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); } } } catch(e) { console.warn("Could not format delivery date", e); }
    function replaceAll(str, find, replace) { try { return str.split(find).join(replace); } catch { return str; } }
    switch (status) { case "Order Received": template = `प्रिय ${namePlaceholder},\nनमस्कार,\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) हमें सफलतापूर्वक प्राप्त हो गया है।\nहम इस ऑर्डर को ${deliveryDatePlaceholder} तक पूर्ण करने का प्रयास करेंगे।\n\nDear ${namePlaceholder},\nWe have successfully received your order (Order No: ${orderNoPlaceholder}).\nWe aim to complete it by ${deliveryDatePlaceholder}.`; break; case "Designing": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) का डिज़ाइन तैयार किया जा रहा है।\nजैसे ही डिज़ाइन तैयार होगा, हम आपसे पुष्टि के लिए संपर्क करेंगे।\n\nDear ${namePlaceholder},\nThe design for your order (Order No: ${orderNoPlaceholder}) is in progress.\nWe’ll contact you for confirmation once it’s ready.`; break; case "Verification": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की डिज़ाइन आपके साथ साझा कर दी गई है।\nकृपया डिज़ाइन को ध्यानपूर्वक जाँचे और हमें अपनी अनुमति प्रदान करें।\nएक बार ‘OK’ कर देने के बाद किसी भी प्रकार का संशोधन संभव नहीं होगा।\n\nDear ${namePlaceholder},\nWe have shared the design for your order (Order No: ${orderNoPlaceholder}) with you.\nPlease review it carefully and provide your approval.\nOnce you confirm with ‘OK’, no further changes will be possible.`; break; case "Design Approved": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की डिज़ाइन स्वीकृत कर दी गई है।\nअब यह प्रिंटिंग प्रक्रिया के लिए आगे बढ़ाया जा रहा है।\n\nDear ${namePlaceholder},\nYour design for Order No: ${orderNoPlaceholder} has been approved.\nIt is now moving forward to the printing stage.`; break; case "Ready for Working": template = `प्रिय ${namePlaceholder},\nनमस्कार,\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की प्रिंटिंग पूरी हो गई है।\nआप ऑफिस/कार्यालय आकर अपना प्रोडक्ट ले जा सकते हैं।\n\nDear ${namePlaceholder},\nThe printing for your order (Order No: ${orderNoPlaceholder}) is complete.\nYou can now collect your product from our office.`; break; case "Printing": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) प्रिंट हो रहा है।\nपूरा होते ही आपको सूचित किया जाएगा।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) is currently being printed.\nWe will notify you once it’s done.`; break; case "Delivered": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) सफलतापूर्वक डिलीवर कर दिया गया है।\nकृपया पुष्टि करें कि आपने ऑर्डर प्राप्त कर लिया है।\nआपके सहयोग के लिए धन्यवाद।\nहमें आशा है कि आप हमें शीघ्र ही फिर से सेवा का अवसर देंगे।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) has been successfully delivered.\nPlease confirm the receipt.\nThank you for your support.\nWe hope to have the opportunity to serve you again soon.`; break; case "Completed": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) सफलतापूर्वक पूर्ण हो चुका है।\nआपके सहयोग के लिए धन्यवाद।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) has been successfully completed.\nThank you for your support.`; break; default: template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) का वर्तमान स्टेटस है: ${status}.\n\nDear ${namePlaceholder},\nThe current status for your order (Order No: ${orderNoPlaceholder}) is: ${status}.`; }
    let message = replaceAll(template, namePlaceholder, customerName); message = replaceAll(message, orderNoPlaceholder, orderId); message = replaceAll(message, deliveryDatePlaceholder, deliveryDateText); message += `\n\n${signature}`; return message;
}

// --- Bulk Actions ---
function handleSelectAllChange(event) {
    // ... (Function remains the same as your provided file) ...
    const isChecked = event.target.checked; const rowsCheckboxes = orderTableBody.querySelectorAll('.row-selector'); rowsCheckboxes.forEach(cb => { const id = cb.dataset.id; if (id) { cb.checked = isChecked; const row = cb.closest('tr'); if (isChecked) { selectedOrderIds.add(id); if (row) row.classList.add('selected-row'); } else { selectedOrderIds.delete(id); if (row) row.classList.remove('selected-row'); } } }); updateBulkActionsBar();
}
function handleRowCheckboxChange(checkbox, firestoreId) {
    // ... (Function remains the same as your provided file) ...
    const row = checkbox.closest('tr'); if (checkbox.checked) { selectedOrderIds.add(firestoreId); if(row) row.classList.add('selected-row'); } else { selectedOrderIds.delete(firestoreId); if(row) row.classList.remove('selected-row'); } updateBulkActionsBar(); updateSelectAllCheckboxState();
}
function updateBulkActionsBar() {
    // ... (Function remains the same as your provided file) ...
    const count = selectedOrderIds.size; if (!bulkActionsBar || !selectedCountSpan || !bulkUpdateStatusBtn || !bulkDeleteBtn) return; if (count > 0) { selectedCountSpan.textContent = `${count} item${count > 1 ? 's' : ''} selected`; bulkActionsBar.style.display = 'flex'; bulkUpdateStatusBtn.disabled = !(bulkStatusSelect && bulkStatusSelect.value); bulkDeleteBtn.disabled = false; } else { bulkActionsBar.style.display = 'none'; if (bulkStatusSelect) bulkStatusSelect.value = ''; bulkUpdateStatusBtn.disabled = true; bulkDeleteBtn.disabled = true; }
}
async function handleBulkDelete() {
    // ... (Function remains the same as your provided file) ...
    const idsToDelete = Array.from(selectedOrderIds); const MAX_DELETE_LIMIT = 5; if (idsToDelete.length === 0) { alert("Please select orders to delete."); return; } if (idsToDelete.length > MAX_DELETE_LIMIT) { alert(`Max ${MAX_DELETE_LIMIT} orders at once.`); return; } if (!bulkDeleteConfirmModal || !bulkDeleteOrderList || !confirmDeleteCheckbox || !confirmBulkDeleteBtn || !bulkDeleteCountSpan) return; bulkDeleteOrderList.innerHTML = ''; const maxItemsToShow = 100; idsToDelete.forEach((id, index) => { if (index < maxItemsToShow) { const order = findOrderInCache(id); const displayId = order?.orderId || `Sys:${id.substring(0,6)}`; const customerName = order?.customerDetails?.fullName || 'N/A'; const li = document.createElement('li'); li.innerHTML = `<strong>${escapeHtml(displayId)}</strong> - ${escapeHtml(customerName)}`; bulkDeleteOrderList.appendChild(li); } }); if (idsToDelete.length > maxItemsToShow) { const li = document.createElement('li'); li.textContent = `... and ${idsToDelete.length - maxItemsToShow} more.`; bulkDeleteOrderList.appendChild(li); } bulkDeleteCountSpan.textContent = idsToDelete.length; confirmDeleteCheckbox.checked = false; confirmBulkDeleteBtn.disabled = true; bulkDeleteConfirmModal.style.display = 'flex';
}
async function executeBulkDelete(idsToDelete) {
    // ... (Function remains the same as your provided file) ...
    if (!db || idsToDelete.length === 0) return; if(bulkDeleteBtn) bulkDeleteBtn.disabled = true; if(confirmBulkDeleteBtn) { confirmBulkDeleteBtn.disabled = true; confirmBulkDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...'; } const batch = writeBatch(db); idsToDelete.forEach(id => { batch.delete(doc(db, "orders", id)); }); try { await batch.commit(); alert(`${idsToDelete.length} order(s) deleted.`); selectedOrderIds.clear(); updateBulkActionsBar(); closeBulkDeleteModal(); } catch (e) { console.error("Bulk delete error:", e); alert(`Error deleting: ${e.message}`); if(bulkDeleteBtn) bulkDeleteBtn.disabled = false; } finally { if(confirmBulkDeleteBtn) { confirmBulkDeleteBtn.disabled = true; confirmBulkDeleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Orders'; } updateBulkActionsBar(); }
}
function closeBulkDeleteModal() { if (bulkDeleteConfirmModal) bulkDeleteConfirmModal.style.display = 'none'; }
async function handleBulkUpdateStatus() {
    // ... (Function remains the same as your provided file) ...
    const idsToUpdate = Array.from(selectedOrderIds); const newStatus = bulkStatusSelect.value; const MAX_STATUS_UPDATE_LIMIT = 10; if (idsToUpdate.length === 0) { alert("Select orders."); return; } if (idsToUpdate.length > MAX_STATUS_UPDATE_LIMIT) { alert(`Max ${MAX_STATUS_UPDATE_LIMIT} orders.`); return; } if (!newStatus) { alert("Select status."); return; } if (!confirm(`Update ${idsToUpdate.length} order(s) to "${escapeHtml(newStatus)}"?`)) return; if (bulkUpdateStatusBtn) { bulkUpdateStatusBtn.disabled = true; bulkUpdateStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; } const batch = writeBatch(db); const historyEntry = { status: newStatus, timestamp: Timestamp.now() }; idsToUpdate.forEach(id => { const docRef = doc(db, "orders", id); batch.update(docRef, { status: newStatus, updatedAt: serverTimestamp(), statusHistory: arrayUnion(historyEntry) }); }); try { await batch.commit(); alert(`${idsToUpdate.length} order(s) updated to "${escapeHtml(newStatus)}".`); selectedOrderIds.clear(); if (bulkStatusSelect) bulkStatusSelect.value = ''; updateBulkActionsBar(); } catch (e) { console.error("Bulk status update error:", e); alert(`Error updating: ${e.message}`); } finally { if (bulkUpdateStatusBtn) { bulkUpdateStatusBtn.disabled = true; bulkUpdateStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Selected (Max 10)'; } updateBulkActionsBar(); }
}

// --- CSV Export ---
function exportToCsv() {
    // ... (Function remains the same as your provided file) ...
    if (currentlyDisplayedOrders.length === 0) { alert("No data to export."); return; } const headers = [ "Firestore ID", "Order ID", "Customer Name", "WhatsApp No", "Contact No", "Address", "Order Date", "Delivery Date", "Status", "Urgent", "Remarks", "Total Amount", "Amount Paid", "Payment Status", "Items (Name | Qty)" ]; const rows = currentlyDisplayedOrders.map(order => { const formatCsvDate = (dIn) => { if (!dIn) return ''; try { const d = (dIn.toDate)?d.toDate():new Date(dIn); if (isNaN(d.getTime())) return ''; const month = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${d.getFullYear()}-${month}-${day}`; } catch { return ''; } }; const itemsString = (order.items || []).map(p => `${String(p.productName || '').replace(/\|/g, '')}|${String(p.quantity || '')}`).join('; '); return [ order.id, order.orderId || '', order.customerDetails?.fullName || '', order.customerDetails?.whatsappNo || '', order.customerDetails?.contactNo || '', order.customerDetails?.address || '', formatCsvDate(order.orderDate), formatCsvDate(order.deliveryDate), order.status || '', order.urgent || 'No', order.remarks || '', order.totalAmount ?? '', order.amountPaid ?? '', order.paymentStatus || 'Pending', itemsString ]; }); const escapeCsvField = (field) => { const stringField = String(field ?? ''); return (stringField.includes(',') || stringField.includes('\n') || stringField.includes('"')) ? `"${stringField.replace(/"/g, '""')}"` : stringField; }; const csvHeader = headers.map(escapeCsvField).join(",") + "\n"; const csvRows = rows.map(row => row.map(escapeCsvField).join(",")).join("\n"); const csvContent = csvHeader + csvRows; const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); const url = URL.createObjectURL(blob); link.setAttribute("href", url); const timestamp = new Date().toISOString().slice(0, 10); link.setAttribute("download", `orders_export_${timestamp}.csv`); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
}

// --- Attempt Open Modal from URL ---
function attemptOpenModalFromUrl() {
    // ... (Function remains the same as your provided file) ...
    if (orderIdToOpenFromUrl && allOrdersCache.length > 0 && !modalOpenedFromUrl) { const orderWrapper = allOrdersCache.find(o => o.id === orderIdToOpenFromUrl); if (orderWrapper) { console.log(`Opening read-only modal for ID from URL: ${orderIdToOpenFromUrl}`); openReadOnlyOrderPopup(orderIdToOpenFromUrl, orderWrapper.data); modalOpenedFromUrl = true; try { const url = new URL(window.location); url.searchParams.delete('openModalForId'); window.history.replaceState({}, '', url.toString()); } catch(e) { window.history.replaceState(null, '', window.location.pathname + window.location.hash); } orderIdToOpenFromUrl = null; } else { console.warn(`Order ID ${orderIdToOpenFromUrl} from URL not found.`); modalOpenedFromUrl = true; orderIdToOpenFromUrl = null; } }
}

// --- PO Creation Functions ---
function openPOItemSelectionModal(orderFirestoreId, orderData) {
    // ... (Function remains the same as your provided file) ...
    const elementsToCheck = { poItemSelectionModal, poItemSelectionOrderIdInput, poItemSelectionDisplayOrderIdSpan, poItemSelectionListContainer, poItemSelectionList, proceedToCreatePOBtn, poSupplierSearchInput, poSelectedSupplierIdInput, poSelectedSupplierNameInput }; let missingElement = null; for (const key in elementsToCheck) { if (!elementsToCheck[key]) { missingElement = key; break; } } if (missingElement) { console.error(`PO Item Selection Modal elements missing: '${missingElement}'.`); alert(`Cannot open PO item selection. (Error finding: ${missingElement})`); return; }
    if (!orderData || !orderData.items || orderData.items.length === 0) { alert("No items to create PO for."); return; }
    poItemSelectionOrderIdInput.value = orderFirestoreId; poItemSelectionDisplayOrderIdSpan.textContent = orderData.orderId || `Sys:${orderFirestoreId.substring(0,6)}`;
    poItemSelectionList.innerHTML = ''; poSupplierSearchInput.value = ''; poSelectedSupplierIdInput.value = ''; poSelectedSupplierNameInput.value = ''; if(poSupplierSuggestionsDiv) poSupplierSuggestionsDiv.style.display = 'none'; showPOItemError('');
    let availableItems = 0; orderData.items.forEach((item, index) => { if (!item) return; const isAlreadyInPO = false; const div = document.createElement('div'); div.className = 'item-selection-entry'; div.innerHTML = `<input type="checkbox" id="poItem_${index}" name="poItems" value="${index}" data-product-index="${index}" ${isAlreadyInPO ? 'disabled' : ''}><label for="poItem_${index}"><strong>${escapeHtml(item.productName || 'Unnamed Item')}</strong> (Qty: ${escapeHtml(item.quantity || '?')}) ${isAlreadyInPO ? '<span class="in-po-label">(In PO)</span>' : ''}</label>`; poItemSelectionList.appendChild(div); if (!isAlreadyInPO) availableItems++; });
    if (availableItems === 0) { poItemSelectionList.innerHTML = '<p>All items already in POs.</p>'; proceedToCreatePOBtn.disabled = true; } else { proceedToCreatePOBtn.disabled = true; } poItemSelectionModal.classList.add('active');
}
function closePoItemSelectionModal() { if (poItemSelectionModal) poItemSelectionModal.classList.remove('active'); showPOItemError(''); }
function showPOItemError(message) { if (poItemSelectionError) { poItemSelectionError.textContent = message; poItemSelectionError.style.display = message ? 'block' : 'none'; } }
function handlePOItemCheckboxChange() { if (!poItemSelectionList || !proceedToCreatePOBtn || !poSelectedSupplierIdInput) return; const selectedCheckboxes = poItemSelectionList.querySelectorAll('input[name="poItems"]:checked:not(:disabled)'); const supplierSelected = !!poSelectedSupplierIdInput.value; proceedToCreatePOBtn.disabled = !(selectedCheckboxes.length > 0 && supplierSelected); }
function handlePOSupplierSearchInput() { if (!poSupplierSearchInput || !poSupplierSuggestionsDiv || !poSelectedSupplierIdInput || !poSelectedSupplierNameInput) return; clearTimeout(supplierSearchDebounceTimerPO); const searchTerm = poSupplierSearchInput.value.trim(); poSelectedSupplierIdInput.value = ''; poSelectedSupplierNameInput.value = ''; handlePOItemCheckboxChange(); if (searchTerm.length < 1) { if(poSupplierSuggestionsDiv){ poSupplierSuggestionsDiv.innerHTML = ''; poSupplierSuggestionsDiv.style.display = 'none';} return; } supplierSearchDebounceTimerPO = setTimeout(() => { fetchPOSupplierSuggestions(searchTerm); }, 350); }
async function fetchPOSupplierSuggestions(searchTerm) {
    // ... (Function remains the same as your provided file) ...
    if (!poSupplierSuggestionsDiv || !db) return; poSupplierSuggestionsDiv.innerHTML = '<div>Loading...</div>'; poSupplierSuggestionsDiv.style.display = 'block'; const searchTermLower = searchTerm.toLowerCase(); try { const q = query( collection(db, "suppliers"), orderBy("name_lowercase"), where("name_lowercase", ">=", searchTermLower), where("name_lowercase", "<=", searchTermLower + '\uf8ff'), limit(10) ); const querySnapshot = await getDocs(q); poSupplierSuggestionsDiv.innerHTML = ''; if (querySnapshot.empty) { poSupplierSuggestionsDiv.innerHTML = '<div class="no-suggestions">No matching suppliers.</div>'; } else { querySnapshot.forEach((docSnapshot) => { const supplier = docSnapshot.data(); const supplierId = docSnapshot.id; const div = document.createElement('div'); div.textContent = `${supplier.name}${supplier.companyName ? ' (' + supplier.companyName + ')' : ''}`; div.dataset.id = supplierId; div.dataset.name = supplier.name; div.style.cursor = 'pointer'; div.addEventListener('mousedown', (e) => { e.preventDefault(); if(poSupplierSearchInput) poSupplierSearchInput.value = supplier.name; if(poSelectedSupplierIdInput) poSelectedSupplierIdInput.value = supplierId; if(poSelectedSupplierNameInput) poSelectedSupplierNameInput.value = supplier.name; if(poSupplierSuggestionsDiv) poSupplierSuggestionsDiv.style.display = 'none'; handlePOItemCheckboxChange(); }); poSupplierSuggestionsDiv.appendChild(div); }); } } catch (error) { console.error("Error fetching PO suppliers:", error); if (error.message.includes("indexes are required")) { poSupplierSuggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Search Error (Index Missing).</div>'; } else { poSupplierSuggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Error fetching.</div>'; } }
}
function handleProceedToCreatePO() { const orderFirestoreId = poItemSelectionOrderIdInput.value; const selectedSupplierId = poSelectedSupplierIdInput.value; const selectedSupplierName = poSelectedSupplierNameInput.value; if (!orderFirestoreId || !selectedSupplierId || !selectedSupplierName) { showPOItemError("Missing Order ID or Supplier."); return; } if (!poItemSelectionList) { showPOItemError("Item list missing."); return; } const selectedItemsIndices = Array.from(poItemSelectionList.querySelectorAll('input[name="poItems"]:checked:not(:disabled)')).map(cb => parseInt(cb.value)); if (selectedItemsIndices.length === 0) { showPOItemError("Select items for PO."); return; } const params = new URLSearchParams(); params.append('sourceOrderId', orderFirestoreId); params.append('supplierId', selectedSupplierId); params.append('supplierName', selectedSupplierName); params.append('itemIndices', selectedItemsIndices.join(',')); window.location.href = `new_po.html?${params.toString()}`; closePoItemSelectionModal(); }

// --- PO Details Popup Functions ---
async function openPODetailsPopup(poId) {
    // ... (Function remains the same as your provided file) ...
    if (!poDetailsPopup || !poDetailsPopupContent || !db || !poId) return; poDetailsPopupContent.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading...</p>'; poDetailsPopup.classList.add('active'); try { const poRef = doc(db, "purchaseOrders", poId); const poDocSnap = await getDoc(poRef); if (!poDocSnap.exists()) throw new Error(`PO ${poId} not found.`); const poData = poDocSnap.data(); const supplierName = poData.supplierName || 'Unknown'; const poNumberDisplay = poData.poNumber ? `#${poData.poNumber}` : 'N/A'; let orderDateStr = poData.orderDate?.toDate ? poData.orderDate.toDate().toLocaleDateString('en-GB') : 'N/A'; let popupHTML = `<div class="po-details-popup-header"><h3>PO ${escapeHtml(poNumberDisplay)}</h3><p><strong>Supplier:</strong> ${escapeHtml(supplierName)}</p><p><strong>Date:</strong> ${orderDateStr}</p><p><strong>Status:</strong> ${escapeHtml(poData.status || 'N/A')}</p><p><strong>Total:</strong> ₹ ${(poData.totalAmount || 0).toFixed(2)}</p></div><hr><h4>Items</h4>`; if (poData.items && poData.items.length > 0) { popupHTML += `<table class="details-table-popup"><thead><tr><th>#</th><th>Product</th><th>Details</th><th>Rate</th><th>Amount</th></tr></thead><tbody>`; poData.items.forEach((item, index) => { if (!item) return; let detailStr = ''; const qty = item.quantity || '?'; if (item.type === 'Sq Feet') { const w = item.realWidth || item.width || '?'; const h = item.realHeight || item.height || '?'; const u = item.unit || item.inputUnit || 'units'; detailStr = `Qty: ${escapeHtml(qty)} (${escapeHtml(w)}x${escapeHtml(h)} ${escapeHtml(u)})`; } else { detailStr = `Qty: ${escapeHtml(qty)}`; } popupHTML += `<tr><td>${index + 1}</td><td>${escapeHtml(item.productName || 'N/A')}</td><td>${detailStr}</td><td>${item.rate?.toFixed(2) ?? 'N/A'}</td><td align="right">${item.itemAmount?.toFixed(2) ?? 'N/A'}</td></tr>`; }); popupHTML += `</tbody></table>`; } else { popupHTML += `<p>No items.</p>`; } if (poData.notes) { popupHTML += `<div class="po-notes-popup"><strong>Notes:</strong><p>${escapeHtml(poData.notes).replace(/\n/g, '<br>')}</p></div>`; } poDetailsPopupContent.innerHTML = popupHTML; if(printPoDetailsPopupBtn) printPoDetailsPopupBtn.dataset.poid = poId; } catch (error) { console.error("Error loading PO popup:", error); poDetailsPopupContent.innerHTML = `<p class="error-message">Error: ${escapeHtml(error.message)}</p>`; }
}
function closePODetailsPopup() { if (poDetailsPopup) poDetailsPopup.classList.remove('active'); }
function handlePrintPODetailsPopup(event) {
    // ... (Function remains the same as your provided file) ...
    const contentElement = document.getElementById('poDetailsPopupContent'); if (!contentElement) return; const printWindow = window.open('', '_blank'); printWindow.document.write(`<html><head><title>Print PO</title><style>body{font-family:sans-serif;margin:20px;} h3,h4{margin-bottom:10px;} table{width:100%; border-collapse:collapse; margin-bottom:15px;} th, td{border:1px solid #ccc; padding:5px; text-align:left; font-size:0.9em;} th{background-color:#f2f2f2;} .po-notes-popup{margin-top:15px; border:1px solid #eee; padding:10px; font-size:0.9em; white-space: pre-wrap;} p{margin:5px 0;} strong{font-weight:bold;} </style></head><body>${contentElement.innerHTML}</body></html>`); printWindow.document.close(); printWindow.focus(); setTimeout(() => { try { printWindow.print(); } catch (e) { console.error("Print error:", e); alert("Print failed."); } finally { setTimeout(() => { printWindow.close(); }, 200); } }, 500);
}

// --- Read-Only Order Details Popup Functions ---
function openReadOnlyOrderPopup(firestoreId, orderData) {
    // ... (Function remains the same as your provided file) ...
    if (!readOnlyOrderModal || !readOnlyOrderModalContent || !readOnlyOrderModalTitle || !orderData) return; readOnlyOrderModalTitle.textContent = `Order Details: #${escapeHtml(orderData.orderId || firestoreId.substring(0,6))}`; readOnlyOrderModalContent.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading...</p>'; readOnlyOrderModal.classList.add('active'); let contentHTML = '<div class="read-only-grid">'; contentHTML += '<div class="read-only-section"><h4>Customer</h4>'; contentHTML += `<p><strong>Name:</strong> ${escapeHtml(orderData.customerDetails?.fullName || 'N/A')}</p>`; contentHTML += `<p><strong>WhatsApp:</strong> ${escapeHtml(orderData.customerDetails?.whatsappNo || 'N/A')}</p>`; contentHTML += `<p><strong>Contact:</strong> ${escapeHtml(orderData.customerDetails?.contactNo || 'N/A')}</p>`; contentHTML += `<p><strong>Address:</strong> ${escapeHtml(orderData.customerDetails?.address || 'N/A')}</p></div>`; const formatDateRO = (dIn) => { if (!dIn) return 'N/A'; try { const d = (dIn.toDate)?d.toDate():new Date(dIn); return isNaN(d.getTime())?'N/A':d.toLocaleDateString('en-GB'); } catch { return 'N/A'; } }; contentHTML += '<div class="read-only-section"><h4>Order Info</h4>'; contentHTML += `<p><strong>Order Date:</strong> ${formatDateRO(orderData.orderDate)}</p>`; contentHTML += `<p><strong>Delivery Date:</strong> ${formatDateRO(orderData.deliveryDate)}</p>`; contentHTML += `<p><strong>Priority:</strong> ${escapeHtml(orderData.urgent || 'No')}</p>`; contentHTML += `<p><strong>Status:</strong> ${escapeHtml(orderData.status || 'N/A')}</p>`; contentHTML += `<p><strong>Remarks:</strong> ${escapeHtml(orderData.remarks || 'None')}</p></div>`; contentHTML += '<div class="read-only-section read-only-products"><h4>Items</h4>'; const itemsRO = orderData.items || []; if (itemsRO.length > 0) { contentHTML += '<ul class="read-only-product-list">'; itemsRO.forEach(item => { if (!item) return; contentHTML += `<li><strong>${escapeHtml(item.productName || 'Unnamed Item')}</strong> - Qty: ${escapeHtml(item.quantity || '?')}</li>`; }); contentHTML += '</ul>'; } else { contentHTML += '<p>No items listed.</p>'; } contentHTML += '</div>'; contentHTML += '<div class="read-only-section"><h4>Account Data</h4>'; const totalAmountRO = orderData.totalAmount ?? null; const amountPaidRO = orderData.amountPaid ?? null; let balanceDueROText = 'N/A'; let paymentStatusRO = orderData.paymentStatus ?? null; if (totalAmountRO !== null && amountPaidRO !== null) { const balanceDueRO = totalAmountRO - amountPaidRO; balanceDueROText = `₹ ${balanceDueRO.toFixed(2)}`; if (paymentStatusRO === null) paymentStatusRO = balanceDueRO <= 0 ? 'Paid' : 'Pending'; } else if (paymentStatusRO === null) { paymentStatusRO = 'N/A'; } contentHTML += `<p><strong>Total Amount:</strong> ${totalAmountRO !== null ? `₹ ${totalAmountRO.toFixed(2)}` : 'N/A'}</p>`; contentHTML += `<p><strong>Amount Paid:</strong> ${amountPaidRO !== null ? `₹ ${amountPaidRO.toFixed(2)}` : 'N/A'}</p>`; contentHTML += `<p><strong>Balance Due:</strong> ${balanceDueROText}</p>`; contentHTML += `<p><strong>Payment Status:</strong> ${escapeHtml(paymentStatusRO)}</p></div>`; contentHTML += '<div class="read-only-section"><h4>Status History</h4>'; const historyRO = orderData.statusHistory || []; if (historyRO.length > 0) { const sortedHistoryRO = [...historyRO].sort((a, b) => (b.timestamp?.toDate?.()?.getTime() ?? 0) - (a.timestamp?.toDate?.()?.getTime() ?? 0)); contentHTML += '<ul class="read-only-history-list">'; sortedHistoryRO.forEach(entry => { let timeStr = '?'; try { timeStr = entry.timestamp?.toDate ? entry.timestamp.toDate().toLocaleString('en-GB') : '?'; } catch {} contentHTML += `<li><strong>${escapeHtml(entry.status || '?')}</strong> at ${timeStr}</li>`; }); contentHTML += '</ul>'; } else { contentHTML += '<p>No status history.</p>'; } contentHTML += '</div>'; contentHTML += '</div>'; readOnlyOrderModalContent.innerHTML = contentHTML;
}
function closeReadOnlyOrderModal() { if (readOnlyOrderModal) readOnlyOrderModal.classList.remove('active'); }

// --- Items Only Popup Functions ---
function openItemsOnlyPopup(firestoreId) {
    // ... (Function remains the same as your provided file) ...
    if (!itemsOnlyModal || !itemsOnlyModalContent || !itemsOnlyModalTitle) { console.error("Items Only Modal missing."); return; } const orderData = findOrderInCache(firestoreId); if (!orderData) { itemsOnlyModalTitle.textContent = "Error"; itemsOnlyModalContent.innerHTML = '<p class="error-message">No order data.</p>'; itemsOnlyModal.classList.add('active'); return; } itemsOnlyModalTitle.textContent = `Items for Order #${escapeHtml(orderData.orderId || firestoreId.substring(0, 6))}`; itemsOnlyModalContent.innerHTML = ''; const items = orderData.items || []; if (items.length > 0) { const ul = document.createElement('ul'); ul.className = 'items-only-list'; items.forEach((item, index) => { if (!item) return; const li = document.createElement('li'); const name = escapeHtml(item.productName || 'Unnamed Item'); const quantity = escapeHtml(item.quantity || '?'); li.innerHTML = `<strong>${index + 1}. ${name}</strong> - Qty: ${quantity}`; ul.appendChild(li); }); itemsOnlyModalContent.appendChild(ul); } else { itemsOnlyModalContent.innerHTML = '<p class="no-items">No items listed.</p>'; } itemsOnlyModal.classList.add('active');
}
function closeItemsOnlyPopup() { if (itemsOnlyModal) { itemsOnlyModal.classList.remove('active'); } }

console.log("order_history.js loaded (v. Date Fix Applied).");