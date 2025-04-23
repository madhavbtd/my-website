// js/order_history.js
// Updated Version: v1.1 - New Customer button redirects to customer management
// Includes PO Creation, Enhanced Details, Read-Only Popup, items field fix, WhatsApp fix, Single Item Display in Table, Items Only Popup, etc.
// Added Debug Logging for PO Item Selection Modal Elements

const {
    db, collection, onSnapshot, query, orderBy, where,
    doc, getDoc, deleteDoc, updateDoc, Timestamp, serverTimestamp,
    arrayUnion, writeBatch, limit, addDoc, getDocs // Added getDocs
} = window;

// --- START DEBUG LOGGING HELPER ---
function logElementFind(id) {
    const element = document.getElementById(id);
    // console.log(`Finding element with ID '${id}':`, element ? 'FOUND' : '!!! NOT FOUND !!!'); // Optional: Keep for debugging
    return element;
}
// --- END DEBUG LOGGING HELPER ---


// DOM Element References (ensure all IDs match your HTML)
// console.log("--- Defining DOM Element References ---"); // Optional: Keep for debugging
const orderTableBody = logElementFind('orderTableBody');
const loadingRow = logElementFind('loadingMessage');
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

// Details Modal Elements
// console.log("--- Defining Details Modal Elements ---"); // Optional: Keep for debugging
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

// WhatsApp Reminder Popup Elements
// console.log("--- Defining WhatsApp Popup Elements ---"); // Optional: Keep for debugging
const whatsappReminderPopup = logElementFind('whatsapp-reminder-popup');
const whatsappPopupCloseBtn = logElementFind('popup-close-btn');
const whatsappMsgPreview = logElementFind('whatsapp-message-preview');
const whatsappSendLink = logElementFind('whatsapp-send-link');

// Bulk Delete Modal Elements
// console.log("--- Defining Bulk Delete Modal Elements ---"); // Optional: Keep for debugging
const bulkDeleteConfirmModal = logElementFind('bulkDeleteConfirmModal');
const closeBulkDeleteModalBtn = logElementFind('closeBulkDeleteModal');
const cancelBulkDeleteBtn = logElementFind('cancelBulkDeleteBtn');
const confirmBulkDeleteBtn = logElementFind('confirmBulkDeleteBtn');
const confirmDeleteCheckbox = logElementFind('confirmDeleteCheckbox');
const bulkDeleteOrderList = logElementFind('bulkDeleteOrderList');
const bulkDeleteCountSpan = logElementFind('bulkDeleteCount');

// *** PO Item Selection Modal Elements (DEBUG LOGGING ADDED) ***
// console.log("--- Defining PO Item Selection Modal Elements (DEBUG) ---"); // Optional: Keep for debugging
const poItemSelectionModal = logElementFind('poItemSelectionModal');
const closePoItemSelectionModalBtn = logElementFind('closePoItemSelectionModalBtn');
const poItemSelectionOrderIdInput = logElementFind('poItemSelectionOrderIdInput');
const poItemSelectionDisplayOrderIdSpan = logElementFind('poItemSelectionDisplayOrderIdSpan');
const poItemSelectionListContainer = logElementFind('poItemSelectionListContainer'); // ID added in HTML
const poSupplierSearchInput = logElementFind('poSupplierSearchInput');
const poSelectedSupplierIdInput = logElementFind('poSelectedSupplierId'); // Corrected ID
const poSelectedSupplierNameInput = logElementFind('poSelectedSupplierName'); // Corrected ID
const poSupplierSuggestionsDiv = logElementFind('poSupplierSuggestions');
const cancelPoItemSelectionBtn = logElementFind('cancelPoItemSelectionBtn');
const proceedToCreatePOBtn = logElementFind('proceedToCreatePOBtn');
const poItemSelectionError = logElementFind('poItemSelectionError');
const poItemSelectionList = logElementFind('poItemSelectionList'); // Added check for the list itself

// PO Details Popup Elements
// console.log("--- Defining PO Details Popup Elements ---"); // Optional: Keep for debugging
const poDetailsPopup = logElementFind('poDetailsPopup');
const poDetailsPopupContent = logElementFind('poDetailsPopupContent');
const closePoDetailsPopupBtn = logElementFind('closePoDetailsPopupBtn');
const closePoDetailsPopupBottomBtn = logElementFind('closePoDetailsPopupBottomBtn');
const printPoDetailsPopupBtn = logElementFind('printPoDetailsPopupBtn');

// Read-Only Order Modal Elements
// console.log("--- Defining Read-Only Modal Elements ---"); // Optional: Keep for debugging
const readOnlyOrderModal = logElementFind('readOnlyOrderModal');
const closeReadOnlyOrderModalBtn = logElementFind('closeReadOnlyOrderModal');
const readOnlyOrderModalTitle = logElementFind('readOnlyOrderModalTitle');
const readOnlyOrderModalContent = logElementFind('readOnlyOrderModalContent');
const closeReadOnlyOrderModalBottomBtn = logElementFind('closeReadOnlyOrderModalBottomBtn');

// Items Only Modal Elements
// console.log("--- Defining Items Only Modal Elements ---"); // Optional: Keep for debugging
const itemsOnlyModal = logElementFind('itemsOnlyModal');
const closeItemsOnlyModalBtn = logElementFind('closeItemsOnlyModal');
const itemsOnlyModalTitle = logElementFind('itemsOnlyModalTitle');
const itemsOnlyModalContent = logElementFind('itemsOnlyModalContent');
const closeItemsOnlyModalBottomBtn = logElementFind('closeItemsOnlyModalBottomBtn');
// console.log("--- Finished Defining DOM Elements ---"); // Optional: Keep for debugging

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
    // Filter/Sort Listeners
    if (sortSelect) sortSelect.addEventListener('change', handleSortChange);
    if (filterDateInput) filterDateInput.addEventListener('change', handleFilterChange);
    if (filterSearchInput) filterSearchInput.addEventListener('input', handleSearchInput);
    if (filterStatusSelect) filterStatusSelect.addEventListener('change', handleFilterChange);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCsv);

    // --- >>> Action Bar Buttons (UPDATED newCustomerBtn) <<< ---
    if (newCustomerBtn) newCustomerBtn.addEventListener('click', () => {
        // Redirect to customer management, indicating 'add' action and return target
        window.location.href = 'customer_management.html?action=add&returnTo=order_history';
    });
    if (paymentReceivedBtn) paymentReceivedBtn.addEventListener('click', () => {
         // Keep placeholder for now - requires significant development
         alert('Payment Received button clicked - Needs modal, search, balance, save functionality.');
    });
    // --- >>> End Action Bar Button Update <<< ---

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
    if (addPaymentBtn) addPaymentBtn.addEventListener('click', () => alert('Add Payment clicked - Needs implementation')); // Placeholder in details modal
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
    if (poItemSelectionList) {
        poItemSelectionList.addEventListener('change', handlePOItemCheckboxChange);
    } else {
        console.warn("Element 'poItemSelectionList' not found, cannot add change listener for PO items.");
    }
    document.addEventListener('click', (e) => {
        if (poSupplierSuggestionsDiv && poSupplierSuggestionsDiv.style.display === 'block' && !poSupplierSearchInput.contains(e.target) && !poSupplierSuggestionsDiv.contains(e.target)) {
            poSupplierSuggestionsDiv.style.display = 'none';
        }
    });

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
    if (orderTableBody) {
        orderTableBody.addEventListener('click', handleTableClick);
    } else {
        console.error("Element with ID 'orderTableBody' not found!");
    }
}

// --- Utility: Find order data in cache ---
function findOrderInCache(firestoreId) {
    const orderWrapper = allOrdersCache.find(o => o.id === firestoreId);
    return orderWrapper ? orderWrapper.data : null;
}

// --- Utility: Wait for Firestore connection ---
function waitForDbConnection(callback) {
    if (window.db) { callback(); }
    else { let attempt = 0; const maxAttempts = 20; const interval = setInterval(() => { attempt++; if (window.db) { clearInterval(interval); callback(); } else if (attempt >= maxAttempts) { clearInterval(interval); console.error("DB connection timeout (order_history.js)"); alert("Database connection failed. Please refresh the page."); } }, 250); }
}

// --- Filter, Sort, Search Handlers ---
function handleSortChange() { if (!sortSelect) return; const [field, direction] = sortSelect.value.split('_'); if (field && direction) { currentSortField = field; currentSortDirection = direction; applyFiltersAndRender(); } }
function handleFilterChange() { applyFiltersAndRender(); }
function handleSearchInput() { clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(applyFiltersAndRender, 300); }
function clearFilters() {
    if (filterDateInput) filterDateInput.value = ''; if (filterSearchInput) filterSearchInput.value = ''; if (filterStatusSelect) filterStatusSelect.value = ''; if (sortSelect) sortSelect.value = 'createdAt_desc';
    currentSortField = 'createdAt'; currentSortDirection = 'desc'; currentStatusFilter = '';
    selectedOrderIds.clear(); updateBulkActionsBar(); if (selectAllCheckbox) selectAllCheckbox.checked = false;
    if (history.replaceState) { const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname; window.history.replaceState({ path: cleanUrl }, '', cleanUrl); }
    applyFiltersAndRender();
}

// --- Firestore Listener ---
function listenForOrders() {
    // ... (Rest of listenForOrders function remains the same) ...
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    if (!db) { console.error("Firestore instance (db) not available for listener."); return; }
    if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="11" id="loadingMessage">Loading orders...</td></tr>`;

    try {
        const q = query(collection(db, "orders"));
        unsubscribeOrders = onSnapshot(q, (snapshot) => {
            console.log(`Firestore snapshot received: ${snapshot.docs.length} docs`);
            allOrdersCache = snapshot.docs.map(doc => ({
                 id: doc.id,
                 data: {
                     id: doc.id, // Include Firestore ID within data object
                     orderId: doc.data().orderId || '',
                     customerDetails: doc.data().customerDetails || {},
                     items: doc.data().items || [], // Using 'items' field
                     orderDate: doc.data().orderDate || null,
                     deliveryDate: doc.data().deliveryDate || null,
                     urgent: doc.data().urgent || 'No', // Changed from priority
                     status: doc.data().status || 'Unknown',
                     statusHistory: doc.data().statusHistory || [],
                     createdAt: doc.data().createdAt || null,
                     updatedAt: doc.data().updatedAt || null,
                     remarks: doc.data().remarks || '',
                     totalAmount: doc.data().totalAmount ?? null, // Use nullish coalescing
                     amountPaid: doc.data().amountPaid ?? null,
                     paymentStatus: doc.data().paymentStatus || 'Pending', // Default to Pending
                     linkedPOs: doc.data().linkedPOs || [] // Assume field name is linkedPOs
                 }
             }));

            selectedOrderIds.clear(); updateBulkActionsBar(); if (selectAllCheckbox) selectAllCheckbox.checked = false;
            applyFiltersAndRender(); // Apply current sort/filter settings
            attemptOpenModalFromUrl(); // Try to open modal if needed

        }, (error) => {
            console.error("Error fetching orders snapshot:", error);
            if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="11" style="color: red;">Error loading orders. Check console and database connection.</td></tr>`;
        });
    } catch (error) {
        console.error("Error setting up Firestore listener:", error);
        if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="11" style="color: red;">Error setting up listener. Check Firestore configuration.</td></tr>`;
    }
}

// --- Apply Filters & Render Table ---
function applyFiltersAndRender() {
    // ... (Rest of applyFiltersAndRender function remains the same) ...
    if (!allOrdersCache) { console.warn("Order cache not ready for filtering."); return; }
    const filterDateValue = filterDateInput ? filterDateInput.value : '';
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';
    const filterStatusValue = filterStatusSelect ? filterStatusSelect.value : '';
    currentStatusFilter = filterStatusValue; // Update global filter state

    let filteredOrders = allOrdersCache.filter(orderWrapper => {
        const order = orderWrapper.data;
        if (!order) return false; // Skip if data is missing
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
            } else if (typeof order.orderDate === 'string' && order.orderDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                 orderDateStr = order.orderDate;
            }
            if(orderDateStr !== filterDateValue) return false;
        }
        if (filterSearchValue) {
            const itemsString = (order.items || []).map(p => String(p.productName || '').toLowerCase()).join(' ');
            const fieldsToSearch = [
                String(order.orderId || '').toLowerCase(),
                String(order.customerDetails?.fullName || '').toLowerCase(),
                String(order.id || '').toLowerCase(),
                String(order.customerDetails?.whatsappNo || ''),
                String(order.customerDetails?.contactNo || ''),
                itemsString
            ];
            if (!fieldsToSearch.some(field => field.includes(filterSearchValue))) return false;
        }
        return true; // Passed all filters
    });

    try {
        filteredOrders.sort((aWrapper, bWrapper) => {
            const a = aWrapper.data;
            const b = bWrapper.data;
            let valA = a[currentSortField];
            let valB = b[currentSortField];
            if (valA?.toDate) valA = valA.toDate().getTime();
            if (valB?.toDate) valB = valB.toDate().getTime();
            if (['orderDate', 'deliveryDate', 'createdAt', 'updatedAt'].includes(currentSortField)) {
                valA = Number(valA) || 0;
                valB = Number(valB) || 0;
            }
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            let sortComparison = 0;
            if (valA > valB) sortComparison = 1;
            else if (valA < valB) sortComparison = -1;
            return currentSortDirection === 'desc' ? sortComparison * -1 : sortComparison;
        });
    } catch (sortError) {
        console.error("Error during sorting:", sortError);
    }

    currentlyDisplayedOrders = filteredOrders.map(ow => ow.data);
    updateOrderCountsAndReport(currentlyDisplayedOrders);
    if (!orderTableBody) return;
    orderTableBody.innerHTML = '';
    if (currentlyDisplayedOrders.length === 0) {
        orderTableBody.innerHTML = `<tr><td colspan="11" id="noOrdersMessage">No orders found matching your criteria.</td></tr>`;
    } else {
        const searchTermForHighlight = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';
        currentlyDisplayedOrders.forEach(order => {
            displayOrderRow(order.id, order, searchTermForHighlight);
        });
    }
    updateSelectAllCheckboxState();
}

// --- Update Select All Checkbox State ---
function updateSelectAllCheckboxState() {
     // ... (Rest of updateSelectAllCheckboxState function remains the same) ...
     if (selectAllCheckbox) {
        const allVisibleCheckboxes = orderTableBody.querySelectorAll('.row-selector');
        const totalVisible = allVisibleCheckboxes.length;
        if (totalVisible === 0) { selectAllCheckbox.checked = false; selectAllCheckbox.indeterminate = false; return; }
        const numSelectedVisible = Array.from(allVisibleCheckboxes).filter(cb => selectedOrderIds.has(cb.dataset.id)).length;
        if (numSelectedVisible === totalVisible) { selectAllCheckbox.checked = true; selectAllCheckbox.indeterminate = false; }
        else if (numSelectedVisible > 0) { selectAllCheckbox.checked = false; selectAllCheckbox.indeterminate = true; }
        else { selectAllCheckbox.checked = false; selectAllCheckbox.indeterminate = false; }
    }
}

// --- Update Summary Counts and Report ---
function updateOrderCountsAndReport(displayedOrders) {
    // ... (Rest of updateOrderCountsAndReport function remains the same) ...
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
        if (total === 0) { statusCountsReportContainer.innerHTML = '<p>No orders to report.</p>'; }
        else { let reportHtml = '<ul>'; Object.keys(statusCounts).sort().forEach(status => { reportHtml += `<li>${escapeHtml(status)}: <strong>${statusCounts[status]}</strong></li>`; }); reportHtml += '</ul>'; statusCountsReportContainer.innerHTML = reportHtml; }
    }
}

// --- Utility Functions (escapeHtml, highlightMatch) ---
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { try { unsafe = String(unsafe ?? ''); } catch(e) { unsafe = '';} } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function highlightMatch(text, term) { const escapedText = escapeHtml(text); if (!term || !text) return escapedText; try { const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'); const regex = new RegExp(`(${escapedTerm})`, 'gi'); return escapedText.replace(regex, '<mark>$1</mark>'); } catch (e) { console.warn("Highlighting regex error:", e); return escapedText; } }

// --- Display Single Order Row ---
function displayOrderRow(firestoreId, data, searchTerm = '') {
    // ... (Rest of displayOrderRow function remains the same) ...
    if (!orderTableBody || !data) return;
    const tableRow = document.createElement('tr');
    tableRow.setAttribute('data-id', firestoreId);
    if (selectedOrderIds.has(firestoreId)) tableRow.classList.add('selected-row');
    const customerDetails = data.customerDetails || {};
    const customerName = customerDetails.fullName || 'N/A';
    const customerMobile = customerDetails.whatsappNo || '-';
    const formatDate = (dIn) => { if (!dIn) return '-'; try { const d = (dIn.toDate)?d.toDate():new Date(dIn); return isNaN(d.getTime())?'-':d.toLocaleDateString('en-GB'); } catch { return '-'; } };
    const orderDateStr = formatDate(data.orderDate);
    const deliveryDateStr = formatDate(data.deliveryDate);
    const displayId = data.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`;
    const orderIdHtml = `<a href="#" class="order-id-link" data-id="${firestoreId}">${highlightMatch(displayId, searchTerm)}</a>`;
    const customerNameHtml = `<a href="#" class="customer-name-link" data-id="${firestoreId}">${highlightMatch(customerName, searchTerm)}</a>`;
    const status = data.status || 'Unknown';
    const priority = data.urgent === 'Yes' ? 'Yes' : 'No';
    let itemsHtml = '-';
    const items = data.items || [];
    const MAX_ITEMS_DISPLAY = 1;
    if (Array.isArray(items) && items.length > 0) {
        itemsHtml = items.slice(0, MAX_ITEMS_DISPLAY).map(item => {
             if (!item) return '';
             const name = highlightMatch(item.productName || 'Unnamed Item', searchTerm);
             const quantity = highlightMatch(item.quantity || '?', searchTerm);
             return `${name} (${quantity})`;
         }).filter(html => html).join('<br>');
        if (items.length > MAX_ITEMS_DISPLAY) {
             itemsHtml += `<br><a href="#" class="see-more-link" data-id="${firestoreId}">... (${items.length - MAX_ITEMS_DISPLAY} more)</a>`;
         }
    }
    const statusClass = `status-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const priorityClass = priority === 'Yes' ? 'priority-yes' : 'priority-no';
    let poInfoHtml = '';
    const linkedPOs = data.linkedPOs || [];
    if (linkedPOs.length > 0) {
        poInfoHtml = linkedPOs.map(po => {
            if (!po?.poId) return '';
            const poDate = po.createdAt?.toDate ? po.createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'N/A';
            const poNum = escapeHtml(po.poNumber||'N/A');
            return `<a href="#" class="view-po-details-link" data-poid="${escapeHtml(po.poId)}" title="View PO #${poNum} Details">PO #${poNum}</a> (${poDate})`;
        }).filter(h=>h).join('<br>');
    } else {
        poInfoHtml = `<button type="button" class="button create-po-button icon-only" data-id="${firestoreId}" title="Create Purchase Order"><i class="fas fa-file-alt"></i></button>`;
    }
    try {
        tableRow.innerHTML = `
            <td class="col-checkbox"><input type="checkbox" class="row-selector" data-id="${firestoreId}" ${selectedOrderIds.has(firestoreId)?'checked':''}></td>
            <td>${orderIdHtml}</td>
            <td>
                <span class="customer-name-display">${customerNameHtml}</span>
                <span class="customer-mobile-inline">${highlightMatch(customerMobile, searchTerm)}</span>
            </td>
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
        const errorRow = document.createElement('tr');
        errorRow.innerHTML = `<td colspan="11" style="color: red; text-align: left;">Error displaying order: ${escapeHtml(firestoreId)}. Check console.</td>`;
        orderTableBody.appendChild(errorRow);
    }
}

// --- Handle Table Click ---
function handleTableClick(event) {
    // ... (Rest of handleTableClick function remains the same) ...
    const target = event.target;
    const row = target.closest('tr');
    if (!row || !row.dataset.id) return;
    const firestoreId = row.dataset.id;
    const orderData = findOrderInCache(firestoreId);
    if (!orderData) { console.warn(`Order data not found in cache for ID: ${firestoreId}. Cannot perform action.`); return; }
    if (target.matches('.row-selector')) { handleRowCheckboxChange(target, firestoreId);
    } else if (target.closest('.order-id-link')) { event.preventDefault(); openReadOnlyOrderPopup(firestoreId, orderData);
    } else if (target.closest('.customer-name-link')) { event.preventDefault(); const customerId = orderData.customerDetails?.customerId; if (customerId) { window.location.href = `customer_account_detail.html?id=${customerId}`; } else { alert('Customer details/ID not found for linking.'); }
    } else if (target.closest('.create-po-button')) { event.preventDefault(); openPOItemSelectionModal(firestoreId, orderData);
    } else if (target.closest('.view-po-details-link')) { event.preventDefault(); const poId = target.closest('.view-po-details-link').dataset.poid; if (poId) { openPODetailsPopup(poId); } else { console.error("PO ID missing on view link"); }
    } else if (target.closest('.see-more-link')) { event.preventDefault(); openItemsOnlyPopup(firestoreId);
    } else if (target.closest('.details-edit-button')) { openDetailsModal(firestoreId, orderData);
    } else if (target.closest('.whatsapp-button')) { sendWhatsAppMessage(firestoreId, orderData); }
}

// --- Open/Close/Populate Modals (Details, ReadOnly, ItemsOnly, WhatsApp, BulkDelete, POSelect, PODetails) ---
// --- Note: Only relevant functions included below for brevity, assume others exist ---

async function openDetailsModal(firestoreId, orderData) { /* ... */ }
function closeDetailsModal() { /* ... */ }
async function displayPOsInModal(orderFirestoreId, linkedPOs) { /* ... */ }
async function handleUpdateStatus() { /* ... */ }
function handleDeleteFromModal() { /* ... */ }
async function deleteSingleOrder(firestoreId) { /* ... */ }
function handleEditFullFromModal() { /* ... */ }
function handleCreatePOFromModal() { /* ... */ }
function showStatusUpdateWhatsAppReminder(customer, orderId, updatedStatus) { /* ... */ }
function closeWhatsAppPopup() { /* ... */ }
function sendWhatsAppMessage(firestoreId, orderData) { /* ... */ }
function getWhatsAppMessageTemplate(status, customerName, orderId, deliveryDate) { /* ... */ }
function handleSelectAllChange(event) { /* ... */ }
function handleRowCheckboxChange(checkbox, firestoreId) { /* ... */ }
function updateBulkActionsBar() { /* ... */ }
async function handleBulkDelete() { /* ... */ }
async function executeBulkDelete(idsToDelete) { /* ... */ }
function closeBulkDeleteModal() { /* ... */ }
async function handleBulkUpdateStatus() { /* ... */ }
function exportToCsv() { /* ... */ }
function attemptOpenModalFromUrl() { /* ... */ }
function openPOItemSelectionModal(orderFirestoreId, orderData) { /* ... */ }
function closePoItemSelectionModal() { /* ... */ }
function showPOItemError(message) { /* ... */ }
function handlePOItemCheckboxChange() { /* ... */ }
function handlePOSupplierSearchInput() { /* ... */ }
async function fetchPOSupplierSuggestions(searchTerm) { /* ... */ }
function handleProceedToCreatePO() { /* ... */ }
async function openPODetailsPopup(poId) { /* ... */ }
function closePODetailsPopup() { /* ... */ }
function handlePrintPODetailsPopup(event) { /* ... */ }
function openReadOnlyOrderPopup(firestoreId, orderData) { /* ... */ }
function closeReadOnlyOrderModal() { /* ... */ }
function openItemsOnlyPopup(firestoreId) { /* ... */ }
function closeItemsOnlyPopup() { /* ... */ }

// --- (Make sure all the functions above are fully defined as in the previous code) ---

console.log("order_history.js script loaded successfully (v1.1 - Customer Redirect).");