// js/order_history.js
// Updated Version: v1.11 - Final Complete Code with All Functions

const {
    db, collection, onSnapshot, query, orderBy, where,
    doc, getDoc, deleteDoc, updateDoc, Timestamp, serverTimestamp,
    arrayUnion, writeBatch, limit, addDoc, getDocs
} = window;

// --- START DEBUG LOGGING HELPER ---
function logElementFind(id) {
    const element = document.getElementById(id);
    // console.log(`Finding element with ID '${id}':`, element ? 'FOUND' : '!!! NOT FOUND !!!');
    if (!element && id) {
        console.error(`CRITICAL: Element with ID '${id}' was not found in the DOM! Check HTML.`);
    }
    return element;
}
// --- END DEBUG LOGGING HELPER ---


// DOM Element References
console.log("--- Defining DOM Element References ---");
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
const paymentReceivedModal = logElementFind('paymentReceivedModal');
const closePaymentReceivedModalBtn = logElementFind('closePaymentReceivedModal');
const paymentCustomerSearchInput = logElementFind('paymentCustomerSearch');
const paymentCustomerSuggestionsDiv = logElementFind('paymentCustomerSuggestions');
const paymentSelectedCustomerIdInput = logElementFind('paymentSelectedCustomerId');
const paymentCustomerInfoDiv = logElementFind('paymentCustomerInfo');
const paymentSelectedCustomerNameSpan = logElementFind('paymentSelectedCustomerName');
const paymentDueAmountDisplaySpan = logElementFind('paymentDueAmountDisplay');
const paymentReceivedForm = logElementFind('paymentReceivedForm');
const paymentReceivedAmountInput = logElementFind('paymentReceivedAmount');
const paymentReceivedDateInput = logElementFind('paymentReceivedDate');
const paymentReceivedMethodSelect = logElementFind('paymentReceivedMethod');
const paymentReceivedNotesInput = logElementFind('paymentReceivedNotes');
const paymentReceivedErrorSpan = logElementFind('paymentReceivedError');
const cancelReceivedPaymentBtn = logElementFind('cancelReceivedPaymentBtn');
const saveReceivedPaymentBtn = logElementFind('saveReceivedPaymentBtn');
console.log("--- Finished Defining DOM Elements ---");

// Global State Variables
let currentSortField = 'createdAt';
let currentSortDirection = 'desc';
let unsubscribeOrders = null;
let allOrdersCache = [];
let currentlyDisplayedOrders = [];
let searchDebounceTimer;
let supplierSearchDebounceTimerPO;
let paymentCustomerSearchDebounceTimer;
let currentStatusFilter = '';
let activeOrderDataForModal = null;
let selectedOrderIds = new Set();
let cachedSuppliers = {};
let cachedPOsForOrder = {};
let currentSelectedPaymentCustomerId = null;
let modalOpenedFromUrl = false;

// Initialization
document.addEventListener('DOMContentLoaded', () => { /* ... (same as v1.9) ... */ });

// Function to setup all event listeners
function setupEventListeners() { /* ... (same as v1.9) ... */ }

// Utility: Wait for Firestore connection
function waitForDbConnection(callback) { /* ... (same as v1.9) ... */ }

// --- Firestore Listener ---
function listenForOrders(orderIdToOpen) { /* ... (same as v1.9, including logs) ... */ }

// --- Filter, Sort, Search Handlers ---
// <<< --- FUNCTION DEFINITIONS ARE NOW INCLUDED --- >>>
function handleSortChange() {
    if (!sortSelect) return;
    const [field, direction] = sortSelect.value.split('_');
    if (field && direction) { currentSortField = field; currentSortDirection = direction; applyFiltersAndRender(); }
}
function handleFilterChange() { applyFiltersAndRender(); }
function handleSearchInput() { clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(applyFiltersAndRender, 300); }
function clearFilters() {
    if (filterDateInput) filterDateInput.value = ''; if (filterSearchInput) filterSearchInput.value = ''; if (filterStatusSelect) filterStatusSelect.value = ''; if (sortSelect) sortSelect.value = 'createdAt_desc';
    currentSortField = 'createdAt'; currentSortDirection = 'desc'; currentStatusFilter = '';
    selectedOrderIds.clear(); updateBulkActionsBar(); if (selectAllCheckbox) selectAllCheckbox.checked = false;
    if (history.replaceState) { const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname; window.history.replaceState({ path: cleanUrl }, '', cleanUrl); }
    applyFiltersAndRender();
}
// --- <<< END MISSING FUNCTIONS >>> ---

// --- Apply Filters & Render Table ---
function applyFiltersAndRender() {
    if (!allOrdersCache) { console.warn("Order cache not ready for filtering."); return; }
    // console.log("DEBUG v1.11: Applying filters and rendering...");
    const filterDateValue = filterDateInput ? filterDateInput.value : '';
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';
    const filterStatusValue = filterStatusSelect ? filterStatusSelect.value : '';
    currentStatusFilter = filterStatusValue;
    let filteredOrders = allOrdersCache.filter(orderWrapper => { const order = orderWrapper.data; if (!order) return false; if (filterStatusValue && order.status !== filterStatusValue) return false; if (filterDateValue) { let orderDateStr = ''; if (order.orderDate?.toDate) { try { const d = order.orderDate.toDate(); const month = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); orderDateStr = `${d.getFullYear()}-${month}-${day}`; } catch(e){} } else if (typeof order.orderDate === 'string' && order.orderDate.match(/^\d{4}-\d{2}-\d{2}$/)) { orderDateStr = order.orderDate; } if(orderDateStr !== filterDateValue) return false; } if (filterSearchValue) { const itemsString = (order.items || []).map(p => String(p.productName || '').toLowerCase()).join(' '); const fieldsToSearch = [ String(order.orderId || '').toLowerCase(), String(order.customerDetails?.fullName || '').toLowerCase(), String(order.id || '').toLowerCase(), String(order.customerDetails?.whatsappNo || ''), String(order.customerDetails?.contactNo || ''), itemsString ]; if (!fieldsToSearch.some(field => field.includes(filterSearchValue))) return false; } return true; });
    try { filteredOrders.sort((aWrapper, bWrapper) => { const a = aWrapper.data; const b = bWrapper.data; let valA = a[currentSortField]; let valB = b[currentSortField]; if (valA?.toDate) valA = valA.toDate().getTime(); if (valB?.toDate) valB = valB.toDate().getTime(); if (['orderDate', 'deliveryDate', 'createdAt', 'updatedAt'].includes(currentSortField)) { valA = Number(valA) || 0; valB = Number(valB) || 0; } if (typeof valA === 'string') valA = valA.toLowerCase(); if (typeof valB === 'string') valB = valB.toLowerCase(); let sortComparison = 0; if (valA > valB) sortComparison = 1; else if (valA < valB) sortComparison = -1; return currentSortDirection === 'desc' ? sortComparison * -1 : sortComparison; }); } catch (sortError) { console.error("Error during sorting:", sortError); }
    currentlyDisplayedOrders = filteredOrders.map(ow => ow.data);
    updateOrderCountsAndReport(currentlyDisplayedOrders);
    if (!orderTableBody) { console.error("CRITICAL: orderTableBody is null in applyFiltersAndRender!"); return; }
    orderTableBody.innerHTML = '';
    if (currentlyDisplayedOrders.length === 0) { orderTableBody.innerHTML = `<tr><td colspan="11" id="noOrdersMessage">No orders found matching criteria.</td></tr>`; }
    else { console.log(`DEBUG v1.11: Rendering ${currentlyDisplayedOrders.length} rows.`); const searchTermForHighlight = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : ''; currentlyDisplayedOrders.forEach((order, index) => { displayOrderRow(order.id, order, searchTermForHighlight); }); }
    updateSelectAllCheckboxState();
    // console.log("DEBUG v1.11: applyFiltersAndRender finished.");
}

// --- Update Select All Checkbox State ---
function updateSelectAllCheckboxState() { /* ... (same as v1.9) ... */ }

// --- Update Summary Counts and Report ---
function updateOrderCountsAndReport(displayedOrders) { /* ... (same as v1.9) ... */ }

// --- Utility Functions ---
function escapeHtml(unsafe) { /* ... (same as v1.9) ... */ }
function highlightMatch(text, term) { /* ... (same as v1.9) ... */ }

// --- <<< FUNCTION DEFINITION INCLUDED >>> ---
function findOrderInCache(firestoreId) {
    const orderWrapper = allOrdersCache.find(o => o.id === firestoreId);
    return orderWrapper ? orderWrapper.data : null;
}
// --- <<< END FUNCTION >>> ---

// --- Display Single Order Row (WITH DEBUGGING) ---
function displayOrderRow(firestoreId, data, searchTerm = '') { /* ... (same as v1.10) ... */ }

// --- Handle Table Click ---
function handleTableClick(event) {
    const target = event.target;
    const row = target.closest('tr');
    if (!row || !row.dataset.id) return;
    const firestoreId = row.dataset.id;
    // <<< USE THE DEFINED FUNCTION >>>
    const orderData = findOrderInCache(firestoreId);
    // <<< END CHANGE >>>
    if (!orderData) { console.warn(`Order data not found in cache for ID: ${firestoreId}.`); return; }
    if (target.matches('.row-selector')) { handleRowCheckboxChange(target, firestoreId); }
    else if (target.closest('.order-id-link')) { event.preventDefault(); openReadOnlyOrderPopup(firestoreId, orderData); }
    else if (target.closest('.customer-name-link')) { event.preventDefault(); const customerId = orderData.customerDetails?.customerId; if (customerId) { window.location.href = `customer_account_detail.html?id=${customerId}`; } else { alert('Customer details/ID not found for linking.'); } }
    else if (target.closest('.create-po-button')) { event.preventDefault(); openPOItemSelectionModal(firestoreId, orderData); }
    else if (target.closest('.view-po-details-link')) { event.preventDefault(); const poId = target.closest('.view-po-details-link').dataset.poid; if (poId) { openPODetailsPopup(poId); } else { console.error("PO ID missing on view link"); } }
    else if (target.closest('.see-more-link')) { event.preventDefault(); openItemsOnlyPopup(firestoreId); }
    else if (target.closest('.details-edit-button')) { openDetailsModal(firestoreId, orderData); }
    else if (target.closest('.whatsapp-button')) { sendWhatsAppMessage(firestoreId, orderData); }
}

// --- All Modal Handling Functions ---
// <<< --- ENSURE ALL FUNCTION DEFINITIONS ARE PRESENT HERE --- >>>
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
function attemptOpenModalFromUrl(orderIdToOpen) { /* ... */ }
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
function openPaymentReceivedModal() { /* ... */ }
function closePaymentReceivedModal() { /* ... */ }
function handlePaymentCustomerSearchInput() { /* ... */ }
async function fetchPaymentCustomerSuggestions(searchTerm) { /* ... */ }
function selectPaymentCustomer(event) { /* ... */ }
async function fetchAndDisplayDueAmount(customerId) { /* ... */ }
async function handleSavePaymentFromHistory() { /* ... */ }
function showPaymentError(message) { /* ... */ }
// <<< --- END OF FUNCTION DEFINITIONS --- >>>

// --- Final Log ---
console.log("order_history.js script loaded successfully (v1.11 - Complete).");