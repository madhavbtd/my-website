// js/order_history.js
// Updated Version: v1.3 - Added More Debugging

const {
    db, collection, onSnapshot, query, orderBy, where,
    doc, getDoc, deleteDoc, updateDoc, Timestamp, serverTimestamp,
    arrayUnion, writeBatch, limit, addDoc, getDocs
} = window;

// --- START DEBUG LOGGING HELPER ---
function logElementFind(id) {
    const element = document.getElementById(id);
    // Keep this log active for debugging element issues
    console.log(`Finding element with ID '${id}':`, element ? 'FOUND' : '!!! NOT FOUND !!!');
    if (!element) {
        console.error(`CRITICAL: Element with ID '${id}' was not found in the DOM!`);
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
// ... (same as before) ...
let currentSelectedPaymentCustomerId = null;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log("Order History DOM Loaded. Initializing...");
    const urlParams = new URLSearchParams(window.location.search);
    orderIdToOpenFromUrl = urlParams.get('openModalForId');
    currentStatusFilter = urlParams.get('status');
    if (orderIdToOpenFromUrl) console.log(`Request to open modal for ID: ${orderIdToOpenFromUrl}`);
    if (currentStatusFilter && filterStatusSelect) filterStatusSelect.value = currentStatusFilter;
    waitForDbConnection(() => {
        setupEventListeners(); // <<< Call setupEventListeners FIRST
        listenForOrders();    // <<< Then listen for orders
    });
});

// Function to setup all event listeners
function setupEventListeners() {
    console.log("DEBUG: Starting setupEventListeners..."); // <<< DEBUG LOG
    try {
        // Filter/Sort Listeners
        if (sortSelect) sortSelect.addEventListener('change', handleSortChange); else console.warn("sortSelect not found");
        if (filterDateInput) filterDateInput.addEventListener('change', handleFilterChange); else console.warn("filterDateInput not found");
        if (filterSearchInput) filterSearchInput.addEventListener('input', handleSearchInput); else console.warn("filterSearchInput not found");
        if (filterStatusSelect) filterStatusSelect.addEventListener('change', handleFilterChange); else console.warn("filterStatusSelect not found");
        if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters); else console.warn("clearFiltersBtn not found");
        if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCsv); else console.warn("exportCsvBtn not found");

        // Action Bar Buttons
        if (newCustomerBtn) {
             newCustomerBtn.addEventListener('click', () => {
                window.location.href = 'customer_management.html?action=add&returnTo=order_history';
             });
        } else { console.warn("newCustomerBtn not found"); }

        // Payment Received Button Listener
        if (paymentReceivedBtn) {
            paymentReceivedBtn.addEventListener('click', openPaymentReceivedModal);
             console.log("DEBUG: Added click listener to paymentReceivedBtn."); // <<< DEBUG LOG
        } else { console.warn("paymentReceivedBtn not found"); }

        // Bulk Actions Listeners
        if (selectAllCheckbox) selectAllCheckbox.addEventListener('change', handleSelectAllChange); else console.warn("selectAllCheckbox not found");
        // ... (Add null checks for other bulk action elements if needed) ...
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
        // ... (Add null checks for other detail modal elements if needed) ...
        if (modalUpdateStatusBtn) modalUpdateStatusBtn.addEventListener('click', handleUpdateStatus);
        if (modalDeleteBtn) modalDeleteBtn.addEventListener('click', handleDeleteFromModal);
        if (modalEditFullBtn) modalEditFullBtn.addEventListener('click', handleEditFullFromModal);
        if (addPaymentBtn) addPaymentBtn.addEventListener('click', () => alert('Add Payment from Details - Needs implementation'));
        if (modalCreatePOBtn) modalCreatePOBtn.addEventListener('click', handleCreatePOFromModal);


        // WhatsApp Popup Listeners
        if (whatsappPopupCloseBtn) whatsappPopupCloseBtn.addEventListener('click', closeWhatsAppPopup);
        if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (event) => { if (event.target === whatsappReminderPopup) closeWhatsAppPopup(); });

        // PO Item Selection Modal Listeners
        if (closePoItemSelectionModalBtn) closePoItemSelectionModalBtn.addEventListener('click', closePoItemSelectionModal);
        // ... (Add null checks for other PO selection elements) ...
         if (cancelPoItemSelectionBtn) cancelPoItemSelectionBtn.addEventListener('click', closePoItemSelectionModal);
        if (poItemSelectionModal) poItemSelectionModal.addEventListener('click', (event) => { if (event.target === poItemSelectionModal) closePoItemSelectionModal(); });
        if (proceedToCreatePOBtn) proceedToCreatePOBtn.addEventListener('click', handleProceedToCreatePO);
        if (poSupplierSearchInput) poSupplierSearchInput.addEventListener('input', handlePOSupplierSearchInput);
        if (poItemSelectionList) { poItemSelectionList.addEventListener('change', handlePOItemCheckboxChange); }
        else { console.warn("Element 'poItemSelectionList' not found."); }


        // PO Details Popup Listeners
        if (closePoDetailsPopupBtn) closePoDetailsPopupBtn.addEventListener('click', closePODetailsPopup);
        // ... (Add null checks for other PO details elements) ...
        if (closePoDetailsPopupBottomBtn) closePoDetailsPopupBottomBtn.addEventListener('click', closePODetailsPopup);
        if (printPoDetailsPopupBtn) printPoDetailsPopupBtn.addEventListener('click', handlePrintPODetailsPopup);
        if (poDetailsPopup) poDetailsPopup.addEventListener('click', (event) => { if (event.target === poDetailsPopup) closePODetailsPopup(); });

        // Read-Only Modal Listeners
        if (closeReadOnlyOrderModalBtn) closeReadOnlyOrderModalBtn.addEventListener('click', closeReadOnlyOrderModal);
        // ... (Add null checks) ...
         if (closeReadOnlyOrderModalBottomBtn) closeReadOnlyOrderModalBottomBtn.addEventListener('click', closeReadOnlyOrderModal);
        if (readOnlyOrderModal) readOnlyOrderModal.addEventListener('click', (event) => { if (event.target === readOnlyOrderModal) closeReadOnlyOrderModal(); });

        // Items Only Modal Listeners
        if (closeItemsOnlyModalBtn) closeItemsOnlyModalBtn.addEventListener('click', closeItemsOnlyPopup);
         // ... (Add null checks) ...
        if (closeItemsOnlyModalBottomBtn) closeItemsOnlyModalBottomBtn.addEventListener('click', closeItemsOnlyPopup);
        if (itemsOnlyModal) itemsOnlyModal.addEventListener('click', (event) => { if (event.target === itemsOnlyModal) closeItemsOnlyPopup(); });

        // Payment Received Modal Listeners
        if (closePaymentReceivedModalBtn) closePaymentReceivedModalBtn.addEventListener('click', closePaymentReceivedModal); else console.warn("closePaymentReceivedModalBtn not found");
        if (cancelReceivedPaymentBtn) cancelReceivedPaymentBtn.addEventListener('click', closePaymentReceivedModal); else console.warn("cancelReceivedPaymentBtn not found");
        if (paymentReceivedModal) paymentReceivedModal.addEventListener('click', (event) => { if(event.target === paymentReceivedModal) closePaymentReceivedModal(); }); else console.warn("paymentReceivedModal not found");
        if (paymentCustomerSearchInput) paymentCustomerSearchInput.addEventListener('input', handlePaymentCustomerSearchInput); else console.warn("paymentCustomerSearchInput not found");
        if (paymentCustomerSuggestionsDiv) paymentCustomerSuggestionsDiv.addEventListener('click', selectPaymentCustomer); else console.warn("paymentCustomerSuggestionsDiv not found");
        if (saveReceivedPaymentBtn) saveReceivedPaymentBtn.addEventListener('click', handleSavePaymentFromHistory); else console.warn("saveReceivedPaymentBtn not found");

        // Outside click listener (keep as is)
         document.addEventListener('click', (e) => {
            if (poSupplierSuggestionsDiv && poSupplierSuggestionsDiv.style.display === 'block' && poSupplierSearchInput && !poSupplierSearchInput.contains(e.target) && !poSupplierSuggestionsDiv.contains(e.target)) {
                poSupplierSuggestionsDiv.style.display = 'none';
            }
            if (paymentCustomerSuggestionsDiv && paymentCustomerSuggestionsDiv.style.display === 'block' && paymentCustomerSearchInput && !paymentCustomerSearchInput.contains(e.target) && !paymentCustomerSuggestionsDiv.contains(e.target)) {
                 paymentCustomerSuggestionsDiv.style.display = 'none';
            }
        });

        // Table Event Delegation
        if (orderTableBody) { orderTableBody.addEventListener('click', handleTableClick); }
        else { console.error("CRITICAL: 'orderTableBody' not found! Table clicks won't work."); }

        console.log("DEBUG: All event listeners set up successfully."); // <<< DEBUG LOG

    } catch (error) {
        console.error("CRITICAL ERROR during setupEventListeners:", error); // <<< DEBUG LOG
        alert("A critical error occurred while setting up page interactions. Some features might not work.");
    }
}

// --- Utility: Find order data in cache ---
// ... (keep existing function) ...
function findOrderInCache(firestoreId) { const orderWrapper = allOrdersCache.find(o => o.id === firestoreId); return orderWrapper ? orderWrapper.data : null; }


// --- Utility: Wait for Firestore connection ---
// ... (keep existing function) ...
function waitForDbConnection(callback) { if (window.db) { callback(); } else { let attempt = 0; const maxAttempts = 20; const interval = setInterval(() => { attempt++; if (window.db) { clearInterval(interval); callback(); } else if (attempt >= maxAttempts) { clearInterval(interval); console.error("DB connection timeout (order_history.js)"); alert("Database connection failed. Please refresh the page."); } }, 250); } }


// --- Filter, Sort, Search Handlers ---
// ... (keep existing functions) ...
function handleSortChange() { if (!sortSelect) return; const [field, direction] = sortSelect.value.split('_'); if (field && direction) { currentSortField = field; currentSortDirection = direction; applyFiltersAndRender(); } }
function handleFilterChange() { applyFiltersAndRender(); }
function handleSearchInput() { clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(applyFiltersAndRender, 300); }
function clearFilters() { if (filterDateInput) filterDateInput.value = ''; if (filterSearchInput) filterSearchInput.value = ''; if (filterStatusSelect) filterStatusSelect.value = ''; if (sortSelect) sortSelect.value = 'createdAt_desc'; currentSortField = 'createdAt'; currentSortDirection = 'desc'; currentStatusFilter = ''; selectedOrderIds.clear(); updateBulkActionsBar(); if (selectAllCheckbox) selectAllCheckbox.checked = false; if (history.replaceState) { const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname; window.history.replaceState({ path: cleanUrl }, '', cleanUrl); } applyFiltersAndRender(); }


// --- Firestore Listener ---
function listenForOrders() {
    console.log("DEBUG: Attempting to listen for orders..."); // <<< DEBUG LOG
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; console.log("DEBUG: Unsubscribed previous listener."); }
    if (!db) { console.error("Firestore instance (db) not available for listener."); return; }
    if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="11" id="loadingMessage">Loading orders...</td></tr>`;

    try {
        const q = query(collection(db, "orders"));
        unsubscribeOrders = onSnapshot(q, (snapshot) => {
            console.log(`DEBUG: Order snapshot received, processing ${snapshot.docs.length} docs...`); // <<< DEBUG LOG
            allOrdersCache = snapshot.docs.map(doc => ({
                 id: doc.id, data: { id: doc.id, ...doc.data() } // Simplified data structure
             }));
            selectedOrderIds.clear();
            if(selectAllCheckbox) selectAllCheckbox.checked = false; // Add null check
            updateBulkActionsBar();
            applyFiltersAndRender();
            attemptOpenModalFromUrl();
             console.log("DEBUG: Order processing and rendering complete."); // <<< DEBUG LOG
        }, (error) => {
            console.error("Error fetching orders snapshot:", error);
            if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="11" style="color: red;">Error loading orders. Check console.</td></tr>`;
        });
         console.log("DEBUG: Firestore listener successfully attached."); // <<< DEBUG LOG
    } catch (error) {
        console.error("CRITICAL ERROR setting up Firestore listener:", error);
        if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="11" style="color: red;">Error setting up listener.</td></tr>`;
        alert("Error connecting to order data. Please refresh.");
    }
}

// --- Apply Filters & Render Table ---
// ... (keep existing function) ...
function applyFiltersAndRender() { /* ... */ }


// --- Update Select All Checkbox State ---
// ... (keep existing function) ...
function updateSelectAllCheckboxState() { /* ... */ }


// --- Update Summary Counts and Report ---
// ... (keep existing function) ...
function updateOrderCountsAndReport(displayedOrders) { /* ... */ }


// --- Utility Functions (escapeHtml, highlightMatch) ---
// ... (keep existing functions) ...
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { try { unsafe = String(unsafe ?? ''); } catch(e) { unsafe = '';} } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function highlightMatch(text, term) { const escapedText = escapeHtml(text); if (!term || !text) return escapedText; try { const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'); const regex = new RegExp(`(${escapedTerm})`, 'gi'); return escapedText.replace(regex, '<mark>$1</mark>'); } catch (e) { console.warn("Highlighting regex error:", e); return escapedText; } }


// --- Display Single Order Row ---
// ... (keep existing function) ...
function displayOrderRow(firestoreId, data, searchTerm = '') { /* ... */ }


// --- Handle Table Click ---
// ... (keep existing function) ...
function handleTableClick(event) { /* ... */ }


// --- Open/Close/Populate Modals ---
// ... (keep existing functions, ensure they are complete) ...
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
function attemptOpenModalFromUrl() { /* ... */ }
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


// ==============================================
// === Payment Received Modal Functions ===
// ==============================================

function openPaymentReceivedModal() {
    console.log("DEBUG: Opening Payment Received Modal..."); // <<< DEBUG LOG
    if (!paymentReceivedModal) { alert("Error: Payment modal element not found."); return; }
    if(paymentReceivedForm) paymentReceivedForm.reset(); else console.warn("paymentReceivedForm not found");
    if(paymentCustomerSearchInput) paymentCustomerSearchInput.value = ''; else console.warn("paymentCustomerSearchInput not found");
    if(paymentSelectedCustomerIdInput) paymentSelectedCustomerIdInput.value = ''; else console.warn("paymentSelectedCustomerIdInput not found");
    if(paymentCustomerSuggestionsDiv) { paymentCustomerSuggestionsDiv.innerHTML = ''; paymentCustomerSuggestionsDiv.style.display = 'none'; } else console.warn("paymentCustomerSuggestionsDiv not found");
    if(paymentCustomerInfoDiv) paymentCustomerInfoDiv.style.display = 'none'; else console.warn("paymentCustomerInfoDiv not found");
    if(paymentSelectedCustomerNameSpan) paymentSelectedCustomerNameSpan.textContent = ''; else console.warn("paymentSelectedCustomerNameSpan not found");
    if(paymentDueAmountDisplaySpan) { paymentDueAmountDisplaySpan.textContent = 'N/A'; paymentDueAmountDisplaySpan.className = ''; } else console.warn("paymentDueAmountDisplaySpan not found");
    if(paymentReceivedErrorSpan) { paymentReceivedErrorSpan.textContent = ''; paymentReceivedErrorSpan.style.display = 'none'; } else console.warn("paymentReceivedErrorSpan not found");
    if(paymentReceivedDateInput) { try { paymentReceivedDateInput.valueAsDate = new Date(); } catch(e) { console.error("Error setting default payment date:", e); } } else console.warn("paymentReceivedDateInput not found");
    const fieldsToDisable = [ paymentReceivedAmountInput, paymentReceivedDateInput, paymentReceivedMethodSelect, paymentReceivedNotesInput, saveReceivedPaymentBtn ];
    fieldsToDisable.forEach(field => { if(field) field.disabled = true; });
    if(paymentCustomerSearchInput) paymentCustomerSearchInput.disabled = false;
    currentSelectedPaymentCustomerId = null;
    paymentReceivedModal.classList.add('active');
    if(paymentCustomerSearchInput) paymentCustomerSearchInput.focus();
     console.log("DEBUG: Payment Received Modal opened and reset."); // <<< DEBUG LOG
}

function closePaymentReceivedModal() { if (paymentReceivedModal) paymentReceivedModal.classList.remove('active'); }

function handlePaymentCustomerSearchInput() {
    if (!paymentCustomerSearchInput || !paymentCustomerSuggestionsDiv) return;
    clearTimeout(paymentCustomerSearchDebounceTimer);
    const searchTerm = paymentCustomerSearchInput.value.trim();
    if (searchTerm.length < 1) { paymentCustomerSuggestionsDiv.innerHTML = ''; paymentCustomerSuggestionsDiv.style.display = 'none'; return; }
    paymentCustomerSearchDebounceTimer = setTimeout(() => { fetchPaymentCustomerSuggestions(searchTerm); }, 350);
}

async function fetchPaymentCustomerSuggestions(searchTerm) {
    // ... (Keep existing implementation, ensure it uses indexed fields like fullName_lowercase) ...
    if (!paymentCustomerSuggestionsDiv || !db) { return; }
    paymentCustomerSuggestionsDiv.innerHTML = '<div><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    paymentCustomerSuggestionsDiv.style.display = 'block';
    const searchTermLower = searchTerm.toLowerCase();
    try {
        const nameQuery = query( collection(db, "customers"), orderBy("fullName_lowercase"), where("fullName_lowercase", ">=", searchTermLower), where("fullName_lowercase", "<=", searchTermLower + '\uf8ff'), limit(5) );
        const nameSnapshot = await getDocs(nameQuery);
        let combinedResults = []; let customerIds = new Set();
        nameSnapshot.forEach(doc => { if (!customerIds.has(doc.id)) { combinedResults.push({ id: doc.id, data: doc.data() }); customerIds.add(doc.id); } });
        // Optional WhatsApp search can be added here if needed
        paymentCustomerSuggestionsDiv.innerHTML = '';
        if (combinedResults.length === 0) { paymentCustomerSuggestionsDiv.innerHTML = '<div class="no-suggestions">No matching customers found.</div>'; }
        else { combinedResults.forEach(result => { const customer = result.data; const div = document.createElement('div'); div.textContent = `${customer.fullName || 'N/A'} (${customer.whatsappNo || 'No WhatsApp'})`; div.dataset.id = result.id; div.dataset.name = customer.fullName || 'N/A'; div.style.cursor = 'pointer'; paymentCustomerSuggestionsDiv.appendChild(div); }); }
    } catch (error) { console.error("Error fetching customer suggestions:", error); if (error.message.includes("indexes are required")) { paymentCustomerSuggestionsDiv.innerHTML = `<div class="no-suggestions" style="color:red;">Search Error: Index required.</div>`; } else { paymentCustomerSuggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Error fetching customers.</div>'; } }
}

function selectPaymentCustomer(event) {
    // ... (Keep existing implementation) ...
     const targetDiv = event.target.closest('div');
    if (!targetDiv || !targetDiv.dataset.id) return;
    const customerId = targetDiv.dataset.id;
    const customerName = targetDiv.dataset.name;
    console.log(`Selected customer: ${customerName} (ID: ${customerId})`);
    if (paymentSelectedCustomerIdInput) paymentSelectedCustomerIdInput.value = customerId;
    if (paymentCustomerSearchInput) paymentCustomerSearchInput.value = customerName;
    if (paymentCustomerSuggestionsDiv) { paymentCustomerSuggestionsDiv.innerHTML = ''; paymentCustomerSuggestionsDiv.style.display = 'none'; }
    if (paymentCustomerInfoDiv) paymentCustomerInfoDiv.style.display = 'block';
    if (paymentSelectedCustomerNameSpan) paymentSelectedCustomerNameSpan.textContent = customerName;
    currentSelectedPaymentCustomerId = customerId;
    fetchAndDisplayDueAmount(customerId);
}

async function fetchAndDisplayDueAmount(customerId) {
    // ... (Keep existing implementation) ...
    if (!customerId || !paymentDueAmountDisplaySpan || !db) return;
    if(paymentDueAmountDisplaySpan) { paymentDueAmountDisplaySpan.textContent = "Loading..."; paymentDueAmountDisplaySpan.className = 'loading'; }
    if(saveReceivedPaymentBtn) saveReceivedPaymentBtn.disabled = true;
    let totalOrderValue = 0; let totalPaid = 0;
    try {
        const ordersQuery = query(collection(db, "orders"), where("customerId", "==", customerId));
        const ordersSnapshot = await getDocs(ordersQuery);
        ordersSnapshot.forEach(doc => { totalOrderValue += Number(doc.data().totalAmount || 0); });
        const paymentsQuery = query(collection(db, "payments"), where("customerId", "==", customerId));
        const paymentsSnapshot = await getDocs(paymentsQuery);
        paymentsSnapshot.forEach(doc => { totalPaid += Number(doc.data().amountPaid || 0); });
        const balance = totalOrderValue - totalPaid;
        if(paymentDueAmountDisplaySpan) { paymentDueAmountDisplaySpan.textContent = `₹ ${balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; paymentDueAmountDisplaySpan.className = balance <= 0 ? 'paid' : 'due'; }
        const fieldsToEnable = [ paymentReceivedAmountInput, paymentReceivedDateInput, paymentReceivedMethodSelect, paymentReceivedNotesInput, saveReceivedPaymentBtn ];
        fieldsToEnable.forEach(field => { if(field) field.disabled = false; });
         if(paymentReceivedAmountInput) paymentReceivedAmountInput.focus();
    } catch (error) { console.error("Error fetching customer account details:", error); if(paymentDueAmountDisplaySpan) { paymentDueAmountDisplaySpan.textContent = "Error loading balance"; paymentDueAmountDisplaySpan.className = 'error'; } }
}

async function handleSavePaymentFromHistory() {
    // ... (Keep existing implementation) ...
    if (!addDoc || !collection || !Timestamp || !currentSelectedPaymentCustomerId) { showPaymentError("Error: Cannot save payment. Missing dependency or Customer ID."); return; }
    const amount = parseFloat(paymentReceivedAmountInput.value); const dateStr = paymentReceivedDateInput.value; const method = paymentReceivedMethodSelect.value; const notes = paymentReceivedNotesInput.value.trim();
    if (isNaN(amount) || amount <= 0) { showPaymentError("Please enter a valid positive amount."); paymentReceivedAmountInput.focus(); return; }
    if (!dateStr) { showPaymentError("Please select a payment date."); paymentReceivedDateInput.focus(); return; }
    if(saveReceivedPaymentBtn) { saveReceivedPaymentBtn.disabled = true; saveReceivedPaymentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }
    showPaymentError('');
    try {
        const paymentDateTimestamp = Timestamp.fromDate(new Date(dateStr + 'T00:00:00'));
        const paymentData = { customerId: currentSelectedPaymentCustomerId, amountPaid: amount, paymentDate: paymentDateTimestamp, paymentMethod: method || 'Other', notes: notes || null, createdAt: Timestamp.now(), source: 'Order History Page' };
        const docRef = await addDoc(collection(db, "payments"), paymentData);
        console.log("Payment added successfully via Order History:", docRef.id); alert("Payment recorded successfully!");
        closePaymentReceivedModal();
    } catch (error) { console.error("Error saving payment from history:", error); showPaymentError(`Error saving payment: ${error.message}`); if(saveReceivedPaymentBtn) { saveReceivedPaymentBtn.disabled = false; saveReceivedPaymentBtn.innerHTML = '<i class="fas fa-save"></i> Save Payment'; } }
}

function showPaymentError(message) {
    // ... (Keep existing implementation) ...
     if (paymentReceivedErrorSpan) { paymentReceivedErrorSpan.textContent = message; paymentReceivedErrorSpan.style.display = message ? 'block' : 'none'; } else if (message) { alert(message); }
}


// --- Final Log ---
console.log("order_history.js script loaded successfully (v1.3 - More Debugging).");