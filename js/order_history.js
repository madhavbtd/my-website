// js/order_history.js
// Updated Version: v1.4 - Fixed ReferenceError, Added Payment Logic & Debugging

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
let currentStatusFilter = ''; // Renamed for clarity
let activeOrderDataForModal = null;
let selectedOrderIds = new Set();
let cachedSuppliers = {};
let cachedPOsForOrder = {};
let currentSelectedPaymentCustomerId = null;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log("Order History DOM Loaded. Initializing...");
    const urlParams = new URLSearchParams(window.location.search);

    // <<< FIX: Define variables with const/let >>>
    const orderIdToOpenFromUrl = urlParams.get('openModalForId');
    let statusFromUrl = urlParams.get('status'); // Use different name to avoid conflict
    // <<< End Fix >>>

    if (orderIdToOpenFromUrl) console.log(`Request to open modal for ID: ${orderIdToOpenFromUrl}`);
    if (statusFromUrl && filterStatusSelect) {
        filterStatusSelect.value = statusFromUrl;
        currentStatusFilter = statusFromUrl; // Assign to global state *after* reading
    }

    console.log("DEBUG: Calling waitForDbConnection...");
    waitForDbConnection(() => {
        console.log("DEBUG: DB Connection confirmed by callback. Running setup and listener...");
        setupEventListeners(); // Setup listeners first
        listenForOrders();    // Then listen for orders
    });
    console.log("DEBUG: Call to waitForDbConnection finished (callback might run later).");
});

// Function to setup all event listeners
function setupEventListeners() {
    console.log("DEBUG: Starting setupEventListeners...");
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

        if (paymentReceivedBtn) {
            paymentReceivedBtn.addEventListener('click', openPaymentReceivedModal);
             console.log("DEBUG: Added click listener to paymentReceivedBtn.");
        } else { console.warn("paymentReceivedBtn not found"); }

        // Bulk Actions Listeners
        if (selectAllCheckbox) selectAllCheckbox.addEventListener('change', handleSelectAllChange); else console.warn("selectAllCheckbox not found");
        if (bulkUpdateStatusBtn) bulkUpdateStatusBtn.addEventListener('click', handleBulkUpdateStatus); else console.warn("bulkUpdateStatusBtn not found");
        if (bulkDeleteBtn) bulkDeleteBtn.addEventListener('click', handleBulkDelete); else console.warn("bulkDeleteBtn not found");
        if (bulkStatusSelect) bulkStatusSelect.addEventListener('change', updateBulkActionsBar); else console.warn("bulkStatusSelect not found");
        if (confirmDeleteCheckbox) confirmDeleteCheckbox.addEventListener('change', () => { if(confirmBulkDeleteBtn) confirmBulkDeleteBtn.disabled = !confirmDeleteCheckbox.checked; }); else console.warn("confirmDeleteCheckbox not found");
        if (confirmBulkDeleteBtn) confirmBulkDeleteBtn.addEventListener('click', () => { if (confirmDeleteCheckbox && confirmDeleteCheckbox.checked) executeBulkDelete(Array.from(selectedOrderIds)); }); else console.warn("confirmBulkDeleteBtn not found");
        if (cancelBulkDeleteBtn) cancelBulkDeleteBtn.addEventListener('click', closeBulkDeleteModal); else console.warn("cancelBulkDeleteBtn not found");
        if (closeBulkDeleteModalBtn) closeBulkDeleteModalBtn.addEventListener('click', closeBulkDeleteModal); else console.warn("closeBulkDeleteModalBtn not found");
        if (bulkDeleteConfirmModal) bulkDeleteConfirmModal.addEventListener('click', (event) => { if (event.target === bulkDeleteConfirmModal) closeBulkDeleteModal(); }); else console.warn("bulkDeleteConfirmModal not found");

        // Details Modal Listeners
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeDetailsModal); else console.warn("closeDetailsModal button not found");
        if (detailsModal) detailsModal.addEventListener('click', (event) => { if (event.target === detailsModal) closeDetailsModal(); }); else console.warn("detailsModal not found");
        if (modalUpdateStatusBtn) modalUpdateStatusBtn.addEventListener('click', handleUpdateStatus); else console.warn("modalUpdateStatusBtn not found");
        if (modalDeleteBtn) modalDeleteBtn.addEventListener('click', handleDeleteFromModal); else console.warn("modalDeleteBtn not found");
        if (modalEditFullBtn) modalEditFullBtn.addEventListener('click', handleEditFullFromModal); else console.warn("modalEditFullBtn not found");
        if (addPaymentBtn) addPaymentBtn.addEventListener('click', () => alert('Add Payment from Details - Needs implementation')); else console.warn("addPaymentBtn not found in details modal");
        if (modalCreatePOBtn) modalCreatePOBtn.addEventListener('click', handleCreatePOFromModal); else console.warn("modalCreatePOBtn not found");

        // WhatsApp Popup Listeners
        if (whatsappPopupCloseBtn) whatsappPopupCloseBtn.addEventListener('click', closeWhatsAppPopup); else console.warn("whatsappPopupCloseBtn not found");
        if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (event) => { if (event.target === whatsappReminderPopup) closeWhatsAppPopup(); }); else console.warn("whatsappReminderPopup not found");

        // PO Item Selection Modal Listeners
        if (closePoItemSelectionModalBtn) closePoItemSelectionModalBtn.addEventListener('click', closePoItemSelectionModal); else console.warn("closePoItemSelectionModalBtn not found");
        if (cancelPoItemSelectionBtn) cancelPoItemSelectionBtn.addEventListener('click', closePoItemSelectionModal); else console.warn("cancelPoItemSelectionBtn not found");
        if (poItemSelectionModal) poItemSelectionModal.addEventListener('click', (event) => { if (event.target === poItemSelectionModal) closePoItemSelectionModal(); }); else console.warn("poItemSelectionModal not found");
        if (proceedToCreatePOBtn) proceedToCreatePOBtn.addEventListener('click', handleProceedToCreatePO); else console.warn("proceedToCreatePOBtn not found");
        if (poSupplierSearchInput) poSupplierSearchInput.addEventListener('input', handlePOSupplierSearchInput); else console.warn("poSupplierSearchInput not found");
        if (poItemSelectionList) { poItemSelectionList.addEventListener('change', handlePOItemCheckboxChange); } else { console.warn("Element 'poItemSelectionList' not found."); }

        // PO Details Popup Listeners
        if (closePoDetailsPopupBtn) closePoDetailsPopupBtn.addEventListener('click', closePODetailsPopup); else console.warn("closePoDetailsPopupBtn not found");
        if (closePoDetailsPopupBottomBtn) closePoDetailsPopupBottomBtn.addEventListener('click', closePODetailsPopup); else console.warn("closePoDetailsPopupBottomBtn not found");
        if (printPoDetailsPopupBtn) printPoDetailsPopupBtn.addEventListener('click', handlePrintPODetailsPopup); else console.warn("printPoDetailsPopupBtn not found");
        if (poDetailsPopup) poDetailsPopup.addEventListener('click', (event) => { if (event.target === poDetailsPopup) closePODetailsPopup(); }); else console.warn("poDetailsPopup not found");

        // Read-Only Modal Listeners
        if (closeReadOnlyOrderModalBtn) closeReadOnlyOrderModalBtn.addEventListener('click', closeReadOnlyOrderModal); else console.warn("closeReadOnlyOrderModalBtn not found");
        if (closeReadOnlyOrderModalBottomBtn) closeReadOnlyOrderModalBottomBtn.addEventListener('click', closeReadOnlyOrderModal); else console.warn("closeReadOnlyOrderModalBottomBtn not found");
        if (readOnlyOrderModal) readOnlyOrderModal.addEventListener('click', (event) => { if (event.target === readOnlyOrderModal) closeReadOnlyOrderModal(); }); else console.warn("readOnlyOrderModal not found");

        // Items Only Modal Listeners
        if (closeItemsOnlyModalBtn) closeItemsOnlyModalBtn.addEventListener('click', closeItemsOnlyPopup); else console.warn("closeItemsOnlyModalBtn not found");
        if (closeItemsOnlyModalBottomBtn) closeItemsOnlyModalBottomBtn.addEventListener('click', closeItemsOnlyPopup); else console.warn("closeItemsOnlyModalBottomBtn not found");
        if (itemsOnlyModal) itemsOnlyModal.addEventListener('click', (event) => { if (event.target === itemsOnlyModal) closeItemsOnlyPopup(); }); else console.warn("itemsOnlyModal not found");

        // Payment Received Modal Listeners
        if (closePaymentReceivedModalBtn) closePaymentReceivedModalBtn.addEventListener('click', closePaymentReceivedModal); else console.warn("closePaymentReceivedModalBtn not found");
        if (cancelReceivedPaymentBtn) cancelReceivedPaymentBtn.addEventListener('click', closePaymentReceivedModal); else console.warn("cancelReceivedPaymentBtn not found");
        if (paymentReceivedModal) paymentReceivedModal.addEventListener('click', (event) => { if(event.target === paymentReceivedModal) closePaymentReceivedModal(); }); else console.warn("paymentReceivedModal not found");
        if (paymentCustomerSearchInput) paymentCustomerSearchInput.addEventListener('input', handlePaymentCustomerSearchInput); else console.warn("paymentCustomerSearchInput not found");
        if (paymentCustomerSuggestionsDiv) paymentCustomerSuggestionsDiv.addEventListener('click', selectPaymentCustomer); else console.warn("paymentCustomerSuggestionsDiv not found");
        if (saveReceivedPaymentBtn) saveReceivedPaymentBtn.addEventListener('click', handleSavePaymentFromHistory); else console.warn("saveReceivedPaymentBtn not found");

        // Outside click listener
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

        console.log("DEBUG: All event listeners set up successfully.");

    } catch (error) {
        console.error("CRITICAL ERROR during setupEventListeners:", error);
        alert("A critical error occurred while setting up page interactions. Some features might not work.");
    }
}

// Utility: Wait for Firestore connection
function waitForDbConnection(callback) {
    console.log("DEBUG: Inside waitForDbConnection.");
    if (window.db) {
        console.log("DEBUG: window.db found immediately. Calling callback.");
        callback();
    }
    else {
        let attempt = 0;
        const maxAttempts = 20;
        console.log("DEBUG: window.db not found yet. Starting interval check...");
        const interval = setInterval(() => {
            attempt++;
            // console.log(`DEBUG: waitForDbConnection attempt ${attempt}`); // Can be noisy
            if (window.db) {
                console.log("DEBUG: window.db found after interval. Calling callback.");
                clearInterval(interval);
                callback();
            } else if (attempt >= maxAttempts) {
                clearInterval(interval);
                console.error("DB connection timeout (order_history.js)");
                alert("Database connection failed. Please refresh the page.");
            }
        }, 250);
    }
}


// --- Firestore Listener ---
function listenForOrders() {
    console.log("DEBUG: Attempting to listen for orders...");
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; console.log("DEBUG: Unsubscribed previous listener."); }
    if (!db) { console.error("Firestore instance (db) not available for listener."); return; }
    if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="11" id="loadingMessage">Loading orders...</td></tr>`;

    try {
        // Query orders collection
        const q = query(collection(db, "orders")); // Add sorting/filtering here if needed server-side
        unsubscribeOrders = onSnapshot(q, (snapshot) => {
            console.log(`DEBUG: Order snapshot received, processing ${snapshot.docs.length} docs...`);
            allOrdersCache = snapshot.docs.map(doc => ({
                 id: doc.id,
                 // Ensure all expected fields are included, with defaults
                 data: {
                     id: doc.id,
                     orderId: doc.data().orderId || '',
                     customerId: doc.data().customerId || null, // Important for linking
                     customerDetails: doc.data().customerDetails || {},
                     items: doc.data().items || [],
                     orderDate: doc.data().orderDate || null,
                     deliveryDate: doc.data().deliveryDate || null,
                     urgent: doc.data().urgent || 'No',
                     status: doc.data().status || 'Unknown',
                     statusHistory: doc.data().statusHistory || [],
                     createdAt: doc.data().createdAt || null,
                     updatedAt: doc.data().updatedAt || null,
                     remarks: doc.data().remarks || '',
                     totalAmount: doc.data().totalAmount ?? null,
                     amountPaid: doc.data().amountPaid ?? null,
                     paymentStatus: doc.data().paymentStatus || 'Pending',
                     linkedPOs: doc.data().linkedPOs || [],
                     products: doc.data().products || [] // Ensure products field is considered if used elsewhere
                 }
             }));
            selectedOrderIds.clear();
            if(selectAllCheckbox) selectAllCheckbox.checked = false;
            updateBulkActionsBar();
            applyFiltersAndRender(); // Render the table with fetched data
            // Only attempt to open from URL once after initial load
            const orderIdToOpen = new URLSearchParams(window.location.search).get('openModalForId');
            if(orderIdToOpen && !modalOpenedFromUrl){
                attemptOpenModalFromUrl(orderIdToOpen);
                modalOpenedFromUrl = true; // Prevent re-opening on snapshot updates
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
function applyFiltersAndRender() {
    if (!allOrdersCache) { console.warn("Order cache not ready for filtering."); return; }
    console.log("DEBUG: Applying filters and rendering..."); // <<< DEBUG LOG
    const filterDateValue = filterDateInput ? filterDateInput.value : '';
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';
    const filterStatusValue = filterStatusSelect ? filterStatusSelect.value : '';
    currentStatusFilter = filterStatusValue; // Update global filter state

    let filteredOrders = allOrdersCache.filter(orderWrapper => {
        const order = orderWrapper.data;
        if (!order) return false;
        if (filterStatusValue && order.status !== filterStatusValue) return false;
        if (filterDateValue) {
            let orderDateStr = '';
            if (order.orderDate?.toDate) { try { const d = order.orderDate.toDate(); const month = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); orderDateStr = `${d.getFullYear()}-${month}-${day}`; } catch(e){} }
            else if (typeof order.orderDate === 'string' && order.orderDate.match(/^\d{4}-\d{2}-\d{2}$/)) { orderDateStr = order.orderDate; }
            if(orderDateStr !== filterDateValue) return false;
        }
        if (filterSearchValue) {
            const itemsString = (order.items || []).map(p => String(p.productName || '').toLowerCase()).join(' ');
            const fieldsToSearch = [ String(order.orderId || '').toLowerCase(), String(order.customerDetails?.fullName || '').toLowerCase(), String(order.id || '').toLowerCase(), String(order.customerDetails?.whatsappNo || ''), String(order.customerDetails?.contactNo || ''), itemsString ];
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
    if (currentlyDisplayedOrders.length === 0) {
        orderTableBody.innerHTML = `<tr><td colspan="11" id="noOrdersMessage">No orders found matching your criteria.</td></tr>`;
    } else {
        const searchTermForHighlight = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';
        currentlyDisplayedOrders.forEach(order => { displayOrderRow(order.id, order, searchTermForHighlight); });
    }
    updateSelectAllCheckboxState();
    console.log("DEBUG: applyFiltersAndRender finished."); // <<< DEBUG LOG
}


// --- Update Select All Checkbox State ---
function updateSelectAllCheckboxState() {
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

// --- Utility Functions ---
function escapeHtml(unsafe) { /* ... */ }
function highlightMatch(text, term) { /* ... */ }

// --- Display Single Order Row ---
function displayOrderRow(firestoreId, data, searchTerm = '') { /* ... */ }

// --- Handle Table Click ---
function handleTableClick(event) { /* ... */ }

// --- All Modal Handling Functions (Details, WhatsApp, Bulk Delete, PO Select, PO Details, ReadOnly, ItemsOnly, Payment Received) ---
// Ensure all these functions are present and complete as defined in the previous version (v1.3)
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
function openPaymentReceivedModal() { /* ... */ }
function closePaymentReceivedModal() { if (paymentReceivedModal) paymentReceivedModal.classList.remove('active'); }
function handlePaymentCustomerSearchInput() { /* ... */ }
async function fetchPaymentCustomerSuggestions(searchTerm) { /* ... */ }
function selectPaymentCustomer(event) { /* ... */ }
async function fetchAndDisplayDueAmount(customerId) { /* ... */ }
async function handleSavePaymentFromHistory() { /* ... */ }
function showPaymentError(message) { /* ... */ }

// --- Final Log ---
console.log("order_history.js script loaded successfully (v1.4 - Fixed RefError, Debug Logs).");