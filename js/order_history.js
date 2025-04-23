// js/order_history.js
// Updated Version: v1.5 - Removed incorrect setupStaticEventListeners call

const {
    db, collection, onSnapshot, query, orderBy, where,
    doc, getDoc, deleteDoc, updateDoc, Timestamp, serverTimestamp,
    arrayUnion, writeBatch, limit, addDoc, getDocs
} = window;

// --- START DEBUG LOGGING HELPER ---
function logElementFind(id) {
    const element = document.getElementById(id);
    // Keep this log active for debugging element issues
    // console.log(`Finding element with ID '${id}':`, element ? 'FOUND' : '!!! NOT FOUND !!!');
    if (!element && id) { // Only log error if ID was provided and element not found
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
let modalOpenedFromUrl = false; // Moved here for better scope visibility

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log("Order History DOM Loaded. Initializing...");
    const urlParams = new URLSearchParams(window.location.search);
    const orderIdToOpenFromUrl = urlParams.get('openModalForId'); // Read param
    let statusFromUrl = urlParams.get('status'); // Read param

    if (orderIdToOpenFromUrl) console.log(`Request to open modal for ID: ${orderIdToOpenFromUrl}`);
    if (statusFromUrl && filterStatusSelect) {
        filterStatusSelect.value = statusFromUrl;
        currentStatusFilter = statusFromUrl;
    }

    console.log("DEBUG: Calling waitForDbConnection...");
    waitForDbConnection(() => {
        console.log("DEBUG: DB Connection confirmed by callback. Running setup and listener...");
        setupEventListeners(); // Setup listeners first
        listenForOrders(orderIdToOpenFromUrl); // Pass the ID to listener
    });
    console.log("DEBUG: Call to waitForDbConnection finished (callback might run later).");
});

// Function to setup all event listeners
function setupEventListeners() {
    console.log("DEBUG: Starting setupEventListeners...");
    try {
        // Add event listeners safely with checks
        const addListener = (element, event, handler, name) => {
            if (element) {
                element.addEventListener(event, handler);
                // console.log(`DEBUG: Added ${event} listener to ${name || element.id}`);
            } else {
                console.warn(`${name || 'Element'} not found, cannot add ${event} listener.`);
            }
        };

        // Filter/Sort Listeners
        addListener(sortSelect, 'change', handleSortChange, 'sortSelect');
        addListener(filterDateInput, 'change', handleFilterChange, 'filterDateInput');
        addListener(filterSearchInput, 'input', handleSearchInput, 'filterSearchInput');
        addListener(filterStatusSelect, 'change', handleFilterChange, 'filterStatusSelect');
        addListener(clearFiltersBtn, 'click', clearFilters, 'clearFiltersBtn');
        addListener(exportCsvBtn, 'click', exportToCsv, 'exportCsvBtn');

        // Action Bar Buttons
        addListener(newCustomerBtn, 'click', () => {
            window.location.href = 'customer_management.html?action=add&returnTo=order_history';
        }, 'newCustomerBtn');
        addListener(paymentReceivedBtn, 'click', openPaymentReceivedModal, 'paymentReceivedBtn');

        // Bulk Actions Listeners
        addListener(selectAllCheckbox, 'change', handleSelectAllChange, 'selectAllCheckbox');
        addListener(bulkUpdateStatusBtn, 'click', handleBulkUpdateStatus, 'bulkUpdateStatusBtn');
        addListener(bulkDeleteBtn, 'click', handleBulkDelete, 'bulkDeleteBtn');
        addListener(bulkStatusSelect, 'change', updateBulkActionsBar, 'bulkStatusSelect');
        addListener(confirmDeleteCheckbox, 'change', () => { if(confirmBulkDeleteBtn) confirmBulkDeleteBtn.disabled = !confirmDeleteCheckbox.checked; }, 'confirmDeleteCheckbox');
        addListener(confirmBulkDeleteBtn, 'click', () => { if (confirmDeleteCheckbox && confirmDeleteCheckbox.checked) executeBulkDelete(Array.from(selectedOrderIds)); }, 'confirmBulkDeleteBtn');
        addListener(cancelBulkDeleteBtn, 'click', closeBulkDeleteModal, 'cancelBulkDeleteBtn');
        addListener(closeBulkDeleteModalBtn, 'click', closeBulkDeleteModal, 'closeBulkDeleteModalBtn');
        addListener(bulkDeleteConfirmModal, 'click', (event) => { if (event.target === bulkDeleteConfirmModal) closeBulkDeleteModal(); }, 'bulkDeleteConfirmModal');

        // Details Modal Listeners
        addListener(closeModalBtn, 'click', closeDetailsModal, 'closeDetailsModal');
        addListener(detailsModal, 'click', (event) => { if (event.target === detailsModal) closeDetailsModal(); }, 'detailsModal');
        addListener(modalUpdateStatusBtn, 'click', handleUpdateStatus, 'modalUpdateStatusBtn');
        addListener(modalDeleteBtn, 'click', handleDeleteFromModal, 'modalDeleteBtn');
        addListener(modalEditFullBtn, 'click', handleEditFullFromModal, 'modalEditFullBtn');
        addListener(addPaymentBtn, 'click', () => alert('Add Payment from Details - Needs implementation'), 'addPaymentBtn (Details Modal)');
        addListener(modalCreatePOBtn, 'click', handleCreatePOFromModal, 'modalCreatePOBtn');

        // WhatsApp Popup Listeners
        addListener(whatsappPopupCloseBtn, 'click', closeWhatsAppPopup, 'whatsappPopupCloseBtn');
        addListener(whatsappReminderPopup, 'click', (event) => { if (event.target === whatsappReminderPopup) closeWhatsAppPopup(); }, 'whatsappReminderPopup');

        // PO Item Selection Modal Listeners
        addListener(closePoItemSelectionModalBtn, 'click', closePoItemSelectionModal, 'closePoItemSelectionModalBtn');
        addListener(cancelPoItemSelectionBtn, 'click', closePoItemSelectionModal, 'cancelPoItemSelectionBtn');
        addListener(poItemSelectionModal, 'click', (event) => { if (event.target === poItemSelectionModal) closePoItemSelectionModal(); }, 'poItemSelectionModal');
        addListener(proceedToCreatePOBtn, 'click', handleProceedToCreatePO, 'proceedToCreatePOBtn');
        addListener(poSupplierSearchInput, 'input', handlePOSupplierSearchInput, 'poSupplierSearchInput');
        addListener(poItemSelectionList, 'change', handlePOItemCheckboxChange, 'poItemSelectionList');

        // PO Details Popup Listeners
        addListener(closePoDetailsPopupBtn, 'click', closePODetailsPopup, 'closePoDetailsPopupBtn');
        addListener(closePoDetailsPopupBottomBtn, 'click', closePODetailsPopup, 'closePoDetailsPopupBottomBtn');
        addListener(printPoDetailsPopupBtn, 'click', handlePrintPODetailsPopup, 'printPoDetailsPopupBtn');
        addListener(poDetailsPopup, 'click', (event) => { if (event.target === poDetailsPopup) closePODetailsPopup(); }, 'poDetailsPopup');

        // Read-Only Modal Listeners
        addListener(closeReadOnlyOrderModalBtn, 'click', closeReadOnlyOrderModal, 'closeReadOnlyOrderModalBtn');
        addListener(closeReadOnlyOrderModalBottomBtn, 'click', closeReadOnlyOrderModal, 'closeReadOnlyOrderModalBottomBtn');
        addListener(readOnlyOrderModal, 'click', (event) => { if (event.target === readOnlyOrderModal) closeReadOnlyOrderModal(); }, 'readOnlyOrderModal');

        // Items Only Modal Listeners
        addListener(closeItemsOnlyModalBtn, 'click', closeItemsOnlyPopup, 'closeItemsOnlyModalBtn');
        addListener(closeItemsOnlyModalBottomBtn, 'click', closeItemsOnlyPopup, 'closeItemsOnlyModalBottomBtn');
        addListener(itemsOnlyModal, 'click', (event) => { if (event.target === itemsOnlyModal) closeItemsOnlyPopup(); }, 'itemsOnlyModal');

        // Payment Received Modal Listeners
        addListener(closePaymentReceivedModalBtn, 'click', closePaymentReceivedModal, 'closePaymentReceivedModalBtn');
        addListener(cancelReceivedPaymentBtn, 'click', closePaymentReceivedModal, 'cancelReceivedPaymentBtn');
        addListener(paymentReceivedModal, 'click', (event) => { if(event.target === paymentReceivedModal) closePaymentReceivedModal(); }, 'paymentReceivedModal');
        addListener(paymentCustomerSearchInput, 'input', handlePaymentCustomerSearchInput, 'paymentCustomerSearchInput');
        addListener(paymentCustomerSuggestionsDiv, 'click', selectPaymentCustomer, 'paymentCustomerSuggestionsDiv'); // Use event delegation
        addListener(saveReceivedPaymentBtn, 'click', handleSavePaymentFromHistory, 'saveReceivedPaymentBtn');

        // Outside click listener for suggestions
         document.addEventListener('click', (e) => {
            if (poSupplierSuggestionsDiv && poSupplierSuggestionsDiv.style.display === 'block' && poSupplierSearchInput && !poSupplierSearchInput.contains(e.target) && !poSupplierSuggestionsDiv.contains(e.target)) {
                poSupplierSuggestionsDiv.style.display = 'none';
            }
            if (paymentCustomerSuggestionsDiv && paymentCustomerSuggestionsDiv.style.display === 'block' && paymentCustomerSearchInput && !paymentCustomerSearchInput.contains(e.target) && !paymentCustomerSuggestionsDiv.contains(e.target)) {
                 paymentCustomerSuggestionsDiv.style.display = 'none';
            }
        });

        // Table Event Delegation
        addListener(orderTableBody, 'click', handleTableClick, 'orderTableBody');

        console.log("DEBUG: All event listeners set up successfully.");

    } catch (error) {
        console.error("CRITICAL ERROR during setupEventListeners:", error); // Log the specific error
        alert("A critical error occurred while setting up page interactions. Some features might not work.");
    }
}

// Utility: Wait for Firestore connection
function waitForDbConnection(callback) { /* ... (same as v1.4) ... */ }

// --- Firestore Listener ---
function listenForOrders(orderIdToOpen) { // Accept ID to open
    console.log("DEBUG: Attempting to listen for orders...");
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; console.log("DEBUG: Unsubscribed previous listener."); }
    if (!db) { console.error("Firestore instance (db) not available for listener."); return; }
    if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="11" id="loadingMessage">Loading orders...</td></tr>`;

    try {
        const q = query(collection(db, "orders"));
        unsubscribeOrders = onSnapshot(q, (snapshot) => {
            console.log(`DEBUG: Order snapshot received, processing ${snapshot.docs.length} docs...`);
            allOrdersCache = snapshot.docs.map(doc => ({
                 id: doc.id, data: { id: doc.id, ...doc.data() }
             }));
            selectedOrderIds.clear();
            if(selectAllCheckbox) selectAllCheckbox.checked = false;
            updateBulkActionsBar();
            applyFiltersAndRender(); // Render the table

            // Attempt to open modal *after* initial render
            if(orderIdToOpen && !modalOpenedFromUrl){
                attemptOpenModalFromUrl(orderIdToOpen);
                modalOpenedFromUrl = true;
            }
             console.log("DEBUG: Order processing and rendering complete.");
        }, (error) => {
            console.error("Error fetching orders snapshot:", error);
            if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="11" style="color: red;">Error loading orders. Check console.</td></tr>`;
        });
         console.log("DEBUG: Firestore listener successfully attached.");
    } catch (error) {
        console.error("CRITICAL ERROR setting up Firestore listener:", error);
        if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="11" style="color: red;">Error setting up listener.</td></tr>`;
        alert("Error connecting to order data. Please refresh.");
    }
}

// --- Apply Filters & Render Table ---
function applyFiltersAndRender() { /* ... (same as v1.4) ... */ }
function updateSelectAllCheckboxState() { /* ... (same as v1.4) ... */ }
function updateOrderCountsAndReport(displayedOrders) { /* ... (same as v1.4) ... */ }
function escapeHtml(unsafe) { /* ... (same as v1.4) ... */ }
function highlightMatch(text, term) { /* ... (same as v1.4) ... */ }
function displayOrderRow(firestoreId, data, searchTerm = '') { /* ... (same as v1.4) ... */ }
function handleTableClick(event) { /* ... (same as v1.4) ... */ }

// --- All Modal Handling Functions ---
// Ensure ALL functions from v1.3/v1.4 are present and complete here
async function openDetailsModal(firestoreId, orderData) { /* ... */ }
function closeDetailsModal() { if (detailsModal) detailsModal.style.display = 'none'; activeOrderDataForModal = null; }
async function displayPOsInModal(orderFirestoreId, linkedPOs) { /* ... */ }
async function handleUpdateStatus() { /* ... */ }
function handleDeleteFromModal() { /* ... */ }
async function deleteSingleOrder(firestoreId) { /* ... */ }
function handleEditFullFromModal() { /* ... */ }
function handleCreatePOFromModal() { /* ... */ }
function showStatusUpdateWhatsAppReminder(customer, orderId, updatedStatus) { /* ... */ }
function closeWhatsAppPopup() { if (whatsappReminderPopup) whatsappReminderPopup.classList.remove('active'); }
function sendWhatsAppMessage(firestoreId, orderData) { /* ... */ }
function getWhatsAppMessageTemplate(status, customerName, orderId, deliveryDate) { /* ... */ }
function handleSelectAllChange(event) { /* ... */ }
function handleRowCheckboxChange(checkbox, firestoreId) { /* ... */ }
function updateBulkActionsBar() { /* ... */ }
async function handleBulkDelete() { /* ... */ }
async function executeBulkDelete(idsToDelete) { /* ... */ }
function closeBulkDeleteModal() { if (bulkDeleteConfirmModal) bulkDeleteConfirmModal.style.display = 'none'; }
async function handleBulkUpdateStatus() { /* ... */ }
function exportToCsv() { /* ... */ }
function attemptOpenModalFromUrl(orderIdToOpen) { // Pass ID here
    if (orderIdToOpen && allOrdersCache.length > 0) {
        const orderWrapper = allOrdersCache.find(o => o.id === orderIdToOpen);
        if (orderWrapper) {
            console.log(`Opening read-only modal for order ID from URL: ${orderIdToOpen}`);
            openReadOnlyOrderPopup(orderIdToOpen, orderWrapper.data);
             // Clean URL param *after* opening
            try { const url = new URL(window.location); url.searchParams.delete('openModalForId'); window.history.replaceState({}, '', url.toString()); } catch(e){}
        } else { console.warn(`Order ID ${orderIdToOpen} from URL not found in cache.`); }
    }
 }
function openPOItemSelectionModal(orderFirestoreId, orderData) { /* ... */ }
function closePoItemSelectionModal() { if (poItemSelectionModal) poItemSelectionModal.classList.remove('active'); showPOItemError(''); }
function showPOItemError(message) { if (poItemSelectionError) { poItemSelectionError.textContent = message; poItemSelectionError.style.display = message ? 'block' : 'none'; } }
function handlePOItemCheckboxChange() { /* ... */ }
function handlePOSupplierSearchInput() { /* ... */ }
async function fetchPOSupplierSuggestions(searchTerm) { /* ... */ }
function handleProceedToCreatePO() { /* ... */ }
async function openPODetailsPopup(poId) { /* ... */ }
function closePODetailsPopup() { if (poDetailsPopup) poDetailsPopup.classList.remove('active'); }
function handlePrintPODetailsPopup(event) { /* ... */ }
function openReadOnlyOrderPopup(firestoreId, orderData) { /* ... */ }
function closeReadOnlyOrderModal() { if (readOnlyOrderModal) readOnlyOrderModal.classList.remove('active'); }
function openItemsOnlyPopup(firestoreId) { /* ... */ }
function closeItemsOnlyPopup() { if (itemsOnlyModal) { itemsOnlyModal.classList.remove('active'); } }
function openPaymentReceivedModal() { /* ... (same as v1.3) ... */ }
function closePaymentReceivedModal() { if (paymentReceivedModal) paymentReceivedModal.classList.remove('active'); }
function handlePaymentCustomerSearchInput() { /* ... (same as v1.3) ... */ }
async function fetchPaymentCustomerSuggestions(searchTerm) { /* ... (same as v1.3) ... */ }
function selectPaymentCustomer(event) { /* ... (same as v1.3) ... */ }
async function fetchAndDisplayDueAmount(customerId) { /* ... (same as v1.3) ... */ }
async function handleSavePaymentFromHistory() { /* ... (same as v1.3) ... */ }
function showPaymentError(message) { /* ... (same as v1.3) ... */ }


// --- Final Log ---
console.log("order_history.js script loaded successfully (v1.5 - Error Fix).");