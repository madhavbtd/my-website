// js/order_history.js
// Updated Version: v1.2 - Added Payment Received Modal Logic

const {
    db, collection, onSnapshot, query, orderBy, where,
    doc, getDoc, deleteDoc, updateDoc, Timestamp, serverTimestamp,
    arrayUnion, writeBatch, limit, addDoc, getDocs
} = window;

// --- START DEBUG LOGGING HELPER ---
function logElementFind(id) {
    const element = document.getElementById(id);
    // console.log(`Finding element with ID '${id}':`, element ? 'FOUND' : '!!! NOT FOUND !!!'); // Optional: Keep for debugging
    return element;
}
// --- END DEBUG LOGGING HELPER ---


// DOM Element References
// console.log("--- Defining DOM Element References ---");
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
const paymentReceivedBtn = logElementFind('paymentReceivedBtn'); // Payment Received Button

// Details Modal Elements
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
const addPaymentBtn = logElementFind('addPaymentBtn'); // Add Payment button inside details modal
const modalPOListContainer = logElementFind('modalPOList');
const modalCreatePOBtn = logElementFind('modalCreatePOBtn');
const modalDeleteBtn = logElementFind('modalDeleteBtn');
const modalEditFullBtn = logElementFind('modalEditFullBtn');

// WhatsApp Reminder Popup Elements
const whatsappReminderPopup = logElementFind('whatsapp-reminder-popup');
const whatsappPopupCloseBtn = logElementFind('popup-close-btn');
const whatsappMsgPreview = logElementFind('whatsapp-message-preview');
const whatsappSendLink = logElementFind('whatsapp-send-link');

// Bulk Delete Modal Elements
const bulkDeleteConfirmModal = logElementFind('bulkDeleteConfirmModal');
const closeBulkDeleteModalBtn = logElementFind('closeBulkDeleteModal');
const cancelBulkDeleteBtn = logElementFind('cancelBulkDeleteBtn');
const confirmBulkDeleteBtn = logElementFind('confirmBulkDeleteBtn');
const confirmDeleteCheckbox = logElementFind('confirmDeleteCheckbox');
const bulkDeleteOrderList = logElementFind('bulkDeleteOrderList');
const bulkDeleteCountSpan = logElementFind('bulkDeleteCount');

// PO Item Selection Modal Elements
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

// PO Details Popup Elements
const poDetailsPopup = logElementFind('poDetailsPopup');
const poDetailsPopupContent = logElementFind('poDetailsPopupContent');
const closePoDetailsPopupBtn = logElementFind('closePoDetailsPopupBtn');
const closePoDetailsPopupBottomBtn = logElementFind('closePoDetailsPopupBottomBtn');
const printPoDetailsPopupBtn = logElementFind('printPoDetailsPopupBtn');

// Read-Only Order Modal Elements
const readOnlyOrderModal = logElementFind('readOnlyOrderModal');
const closeReadOnlyOrderModalBtn = logElementFind('closeReadOnlyOrderModal');
const readOnlyOrderModalTitle = logElementFind('readOnlyOrderModalTitle');
const readOnlyOrderModalContent = logElementFind('readOnlyOrderModalContent');
const closeReadOnlyOrderModalBottomBtn = logElementFind('closeReadOnlyOrderModalBottomBtn');

// Items Only Modal Elements
const itemsOnlyModal = logElementFind('itemsOnlyModal');
const closeItemsOnlyModalBtn = logElementFind('closeItemsOnlyModal');
const itemsOnlyModalTitle = logElementFind('itemsOnlyModalTitle');
const itemsOnlyModalContent = logElementFind('itemsOnlyModalContent');
const closeItemsOnlyModalBottomBtn = logElementFind('closeItemsOnlyModalBottomBtn');

// --- >>> NEW: Payment Received Modal Elements <<< ---
const paymentReceivedModal = logElementFind('paymentReceivedModal');
const closePaymentReceivedModalBtn = logElementFind('closePaymentReceivedModal');
const paymentCustomerSearchInput = logElementFind('paymentCustomerSearch');
const paymentCustomerSuggestionsDiv = logElementFind('paymentCustomerSuggestions');
const paymentSelectedCustomerIdInput = logElementFind('paymentSelectedCustomerId');
const paymentCustomerInfoDiv = logElementFind('paymentCustomerInfo');
const paymentSelectedCustomerNameSpan = logElementFind('paymentSelectedCustomerName');
const paymentDueAmountDisplaySpan = logElementFind('paymentDueAmountDisplay');
const paymentReceivedForm = logElementFind('paymentReceivedForm'); // The form element
const paymentReceivedAmountInput = logElementFind('paymentReceivedAmount');
const paymentReceivedDateInput = logElementFind('paymentReceivedDate');
const paymentReceivedMethodSelect = logElementFind('paymentReceivedMethod');
const paymentReceivedNotesInput = logElementFind('paymentReceivedNotes');
const paymentReceivedErrorSpan = logElementFind('paymentReceivedError');
const cancelReceivedPaymentBtn = logElementFind('cancelReceivedPaymentBtn');
const saveReceivedPaymentBtn = logElementFind('saveReceivedPaymentBtn');
// --- >>> End New Elements <<< ---

// console.log("--- Finished Defining DOM Elements ---");

// Global State Variables
let currentSortField = 'createdAt';
let currentSortDirection = 'desc';
let unsubscribeOrders = null;
let allOrdersCache = [];
let currentlyDisplayedOrders = [];
let searchDebounceTimer;
let supplierSearchDebounceTimerPO;
let paymentCustomerSearchDebounceTimer; // <<< NEW
let currentStatusFilter = '';
let orderIdToOpenFromUrl = null;
let modalOpenedFromUrl = false;
let selectedOrderIds = new Set();
let activeOrderDataForModal = null;
let cachedSuppliers = {};
let cachedPOsForOrder = {};
let currentSelectedPaymentCustomerId = null; // <<< NEW


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

    // Action Bar Buttons
    if (newCustomerBtn) newCustomerBtn.addEventListener('click', () => {
        window.location.href = 'customer_management.html?action=add&returnTo=order_history';
    });
    // --- >>> UPDATED: Payment Received Button Listener <<< ---
    if (paymentReceivedBtn) paymentReceivedBtn.addEventListener('click', openPaymentReceivedModal);
    // --- >>> End Update <<< ---

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
    if (addPaymentBtn) addPaymentBtn.addEventListener('click', () => alert('Add Payment clicked - Needs implementation for details modal'));
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
    document.addEventListener('click', (e) => {
        if (poSupplierSuggestionsDiv && poSupplierSuggestionsDiv.style.display === 'block' && !poSupplierSearchInput.contains(e.target) && !poSupplierSuggestionsDiv.contains(e.target)) {
            poSupplierSuggestionsDiv.style.display = 'none';
        }
        // --- >>> NEW: Close Payment Customer Suggestions on outside click <<< ---
        if (paymentCustomerSuggestionsDiv && paymentCustomerSuggestionsDiv.style.display === 'block' && paymentCustomerSearchInput && !paymentCustomerSearchInput.contains(e.target) && !paymentCustomerSuggestionsDiv.contains(e.target)) {
             paymentCustomerSuggestionsDiv.style.display = 'none';
        }
        // --- >>> End New <<< ---
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

    // --- >>> NEW: Payment Received Modal Listeners <<< ---
    if (closePaymentReceivedModalBtn) closePaymentReceivedModalBtn.addEventListener('click', closePaymentReceivedModal);
    if (cancelReceivedPaymentBtn) cancelReceivedPaymentBtn.addEventListener('click', closePaymentReceivedModal);
    if (paymentReceivedModal) paymentReceivedModal.addEventListener('click', (event) => { if(event.target === paymentReceivedModal) closePaymentReceivedModal(); });
    if (paymentCustomerSearchInput) paymentCustomerSearchInput.addEventListener('input', handlePaymentCustomerSearchInput);
    if (paymentCustomerSuggestionsDiv) paymentCustomerSuggestionsDiv.addEventListener('click', selectPaymentCustomer); // Use event delegation
    if (saveReceivedPaymentBtn) saveReceivedPaymentBtn.addEventListener('click', handleSavePaymentFromHistory);
    // --- >>> End New Listeners <<< ---

    // Table Event Delegation
    if (orderTableBody) { orderTableBody.addEventListener('click', handleTableClick); }
    else { console.error("Element with ID 'orderTableBody' not found!"); }
}

// --- Utility: Find order data in cache ---
function findOrderInCache(firestoreId) { /* ... */ }

// --- Utility: Wait for Firestore connection ---
function waitForDbConnection(callback) { /* ... */ }

// --- Filter, Sort, Search Handlers ---
function handleSortChange() { /* ... */ }
function handleFilterChange() { /* ... */ }
function handleSearchInput() { /* ... */ }
function clearFilters() { /* ... */ }

// --- Firestore Listener ---
function listenForOrders() { /* ... */ }

// --- Apply Filters & Render Table ---
function applyFiltersAndRender() { /* ... */ }

// --- Update Select All Checkbox State ---
function updateSelectAllCheckboxState() { /* ... */ }

// --- Update Summary Counts and Report ---
function updateOrderCountsAndReport(displayedOrders) { /* ... */ }

// --- Utility Functions (escapeHtml, highlightMatch) ---
function escapeHtml(unsafe) { /* ... */ }
function highlightMatch(text, term) { /* ... */ }

// --- Display Single Order Row ---
function displayOrderRow(firestoreId, data, searchTerm = '') { /* ... */ }

// --- Handle Table Click ---
function handleTableClick(event) { /* ... */ }

// --- Open/Close/Populate Modals (Details, ReadOnly, ItemsOnly, WhatsApp, BulkDelete, POSelect, PODetails) ---
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

// ==============================================
// === NEW: Payment Received Modal Functions ===
// ==============================================

/** Opens and resets the Payment Received modal */
function openPaymentReceivedModal() {
    console.log("Opening Payment Received Modal...");
    if (!paymentReceivedModal) {
        alert("Error: Payment modal element not found.");
        return;
    }

    // Reset form fields
    if(paymentReceivedForm) paymentReceivedForm.reset();
    if(paymentCustomerSearchInput) paymentCustomerSearchInput.value = '';
    if(paymentSelectedCustomerIdInput) paymentSelectedCustomerIdInput.value = '';
    if(paymentCustomerSuggestionsDiv) {
        paymentCustomerSuggestionsDiv.innerHTML = '';
        paymentCustomerSuggestionsDiv.style.display = 'none';
    }
    if(paymentCustomerInfoDiv) paymentCustomerInfoDiv.style.display = 'none';
    if(paymentSelectedCustomerNameSpan) paymentSelectedCustomerNameSpan.textContent = '';
    if(paymentDueAmountDisplaySpan) {
        paymentDueAmountDisplaySpan.textContent = 'N/A';
        paymentDueAmountDisplaySpan.className = ''; // Reset color class
    }
    if(paymentReceivedErrorSpan) {
        paymentReceivedErrorSpan.textContent = '';
        paymentReceivedErrorSpan.style.display = 'none';
    }

    // Set default payment date to today
    if(paymentReceivedDateInput) {
        try {
            paymentReceivedDateInput.valueAsDate = new Date();
        } catch(e) { console.error("Error setting default payment date:", e); }
    }

    // Disable payment fields initially
    const fieldsToDisable = [
        paymentReceivedAmountInput,
        paymentReceivedDateInput,
        paymentReceivedMethodSelect,
        paymentReceivedNotesInput,
        saveReceivedPaymentBtn
    ];
    fieldsToDisable.forEach(field => { if(field) field.disabled = true; });
    if(paymentCustomerSearchInput) paymentCustomerSearchInput.disabled = false; // Ensure search is enabled

    currentSelectedPaymentCustomerId = null; // Reset selected customer
    paymentReceivedModal.classList.add('active'); // Show the modal
    if(paymentCustomerSearchInput) paymentCustomerSearchInput.focus(); // Focus search input
}

/** Closes the Payment Received modal */
function closePaymentReceivedModal() {
    if (paymentReceivedModal) {
        paymentReceivedModal.classList.remove('active');
    }
}

/** Handles input in the customer search field */
function handlePaymentCustomerSearchInput() {
    if (!paymentCustomerSearchInput || !paymentCustomerSuggestionsDiv) return;
    clearTimeout(paymentCustomerSearchDebounceTimer);

    const searchTerm = paymentCustomerSearchInput.value.trim();
    if (searchTerm.length < 1) { // Minimum characters to search (adjust if needed)
        paymentCustomerSuggestionsDiv.innerHTML = '';
        paymentCustomerSuggestionsDiv.style.display = 'none';
        return;
    }

    // Debounce the search fetch
    paymentCustomerSearchDebounceTimer = setTimeout(() => {
        fetchPaymentCustomerSuggestions(searchTerm);
    }, 350); // 350ms delay
}

/** Fetches customer suggestions based on search term */
async function fetchPaymentCustomerSuggestions(searchTerm) {
    if (!paymentCustomerSuggestionsDiv || !db || !collection || !query || !where || !orderBy || !limit || !getDocs) {
        console.error("Missing dependencies for fetching customer suggestions.");
        return;
    }

    paymentCustomerSuggestionsDiv.innerHTML = '<div><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    paymentCustomerSuggestionsDiv.style.display = 'block';
    const searchTermLower = searchTerm.toLowerCase();

    try {
        // Query by name first
        const nameQuery = query(
            collection(db, "customers"),
            orderBy("fullName_lowercase"), // Assuming you have this field
            where("fullName_lowercase", ">=", searchTermLower),
            where("fullName_lowercase", "<=", searchTermLower + '\uf8ff'),
            limit(5) // Limit results
        );
        const nameSnapshot = await getDocs(nameQuery);

        // Query by WhatsApp number if name query yields few results (optional refinement)
        let combinedResults = [];
        let customerIds = new Set(); // To avoid duplicates

        nameSnapshot.forEach(doc => {
            if (!customerIds.has(doc.id)) {
                combinedResults.push({ id: doc.id, data: doc.data() });
                customerIds.add(doc.id);
            }
        });

        // Optional: Add WhatsApp search if needed
        if (combinedResults.length < 5 && /^\d+$/.test(searchTerm)) { // Search WhatsApp only if input looks like numbers
            const whatsappQuery = query(
                collection(db, "customers"),
                orderBy("whatsappNo"), // Assuming you index whatsappNo
                where("whatsappNo", ">=", searchTerm),
                where("whatsappNo", "<=", searchTerm + '\uf8ff'),
                limit(5 - combinedResults.length) // Fetch remaining needed
            );
            const whatsappSnapshot = await getDocs(whatsappQuery);
            whatsappSnapshot.forEach(doc => {
                if (!customerIds.has(doc.id)) { // Avoid duplicates
                    combinedResults.push({ id: doc.id, data: doc.data() });
                    customerIds.add(doc.id);
                }
            });
        }


        // Display results
        paymentCustomerSuggestionsDiv.innerHTML = ''; // Clear loading
        if (combinedResults.length === 0) {
            paymentCustomerSuggestionsDiv.innerHTML = '<div class="no-suggestions">No matching customers found.</div>';
        } else {
            combinedResults.forEach(result => {
                const customer = result.data;
                const div = document.createElement('div');
                div.textContent = `${customer.fullName || 'N/A'} (${customer.whatsappNo || 'No WhatsApp'})`;
                div.dataset.id = result.id; // Store Firestore ID
                div.dataset.name = customer.fullName || 'N/A'; // Store name
                div.style.cursor = 'pointer';
                // Event listener handled by delegation in setupEventListeners
                paymentCustomerSuggestionsDiv.appendChild(div);
            });
        }

    } catch (error) {
        console.error("Error fetching customer suggestions:", error);
         if (error.message.includes("indexes are required")) {
            paymentCustomerSuggestionsDiv.innerHTML = `<div class="no-suggestions" style="color:red;">Search Error: Index required for 'fullName_lowercase' or 'whatsappNo'. Check Firestore console.</div>`;
        } else {
            paymentCustomerSuggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Error fetching customers.</div>';
        }
    }
}

/** Handles selection of a customer from the suggestions list */
function selectPaymentCustomer(event) {
    const targetDiv = event.target.closest('div'); // Ensure we get the div even if clicking text inside
    if (!targetDiv || !targetDiv.dataset.id) return; // Clicked outside a valid suggestion

    const customerId = targetDiv.dataset.id;
    const customerName = targetDiv.dataset.name;

    console.log(`Selected customer: ${customerName} (ID: ${customerId})`);

    if (paymentSelectedCustomerIdInput) paymentSelectedCustomerIdInput.value = customerId;
    if (paymentCustomerSearchInput) paymentCustomerSearchInput.value = customerName; // Show selected name in input
    if (paymentCustomerSuggestionsDiv) { // Hide suggestions
        paymentCustomerSuggestionsDiv.innerHTML = '';
        paymentCustomerSuggestionsDiv.style.display = 'none';
    }
    if (paymentCustomerInfoDiv) paymentCustomerInfoDiv.style.display = 'block'; // Show info section
    if (paymentSelectedCustomerNameSpan) paymentSelectedCustomerNameSpan.textContent = customerName;

    currentSelectedPaymentCustomerId = customerId; // Store globally for saving payment

    // Fetch and display due amount
    fetchAndDisplayDueAmount(customerId);

    // Disable search input while loading/after selection (optional)
    // if(paymentCustomerSearchInput) paymentCustomerSearchInput.disabled = true;
}

/** Fetches orders and payments to calculate and display the customer's due amount */
async function fetchAndDisplayDueAmount(customerId) {
    if (!customerId || !paymentDueAmountDisplaySpan) return;
    if (!db || !collection || !query || !where || !getDocs) {
        console.error("Firestore functions missing for calculating due amount.");
        if(paymentDueAmountDisplaySpan) paymentDueAmountDisplaySpan.textContent = "Error";
        return;
    }

    if(paymentDueAmountDisplaySpan) {
        paymentDueAmountDisplaySpan.textContent = "Loading...";
        paymentDueAmountDisplaySpan.className = 'loading';
    }
    // Disable save button while loading due amount
    if(saveReceivedPaymentBtn) saveReceivedPaymentBtn.disabled = true;


    let totalOrderValue = 0;
    let totalPaid = 0;

    try {
        // 1. Fetch all orders for the customer
        const ordersQuery = query(collection(db, "orders"), where("customerId", "==", customerId));
        const ordersSnapshot = await getDocs(ordersQuery);
        ordersSnapshot.forEach(doc => {
            totalOrderValue += Number(doc.data().totalAmount || 0);
        });

        // 2. Fetch all payments for the customer
        const paymentsQuery = query(collection(db, "payments"), where("customerId", "==", customerId));
        const paymentsSnapshot = await getDocs(paymentsQuery);
        paymentsSnapshot.forEach(doc => {
            totalPaid += Number(doc.data().amountPaid || 0);
        });

        // 3. Calculate balance
        const balance = totalOrderValue - totalPaid;

        // 4. Display balance
        if(paymentDueAmountDisplaySpan) {
            paymentDueAmountDisplaySpan.textContent = `₹ ${balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            paymentDueAmountDisplaySpan.className = balance <= 0 ? 'paid' : 'due'; // Add class for styling (optional)
        }

        // 5. Enable payment form fields
        const fieldsToEnable = [
            paymentReceivedAmountInput,
            paymentReceivedDateInput,
            paymentReceivedMethodSelect,
            paymentReceivedNotesInput,
            saveReceivedPaymentBtn
        ];
        fieldsToEnable.forEach(field => { if(field) field.disabled = false; });
         if(paymentReceivedAmountInput) paymentReceivedAmountInput.focus(); // Focus amount input

    } catch (error) {
        console.error("Error fetching customer account details:", error);
        if(paymentDueAmountDisplaySpan) {
            paymentDueAmountDisplaySpan.textContent = "Error loading balance";
            paymentDueAmountDisplaySpan.className = 'error';
        }
        // Keep form fields disabled on error
         const fieldsToDisable = [
            paymentReceivedAmountInput,
            paymentReceivedDateInput,
            paymentReceivedMethodSelect,
            paymentReceivedNotesInput,
            saveReceivedPaymentBtn
        ];
        fieldsToDisable.forEach(field => { if(field) field.disabled = true; });
    } finally {
        // Re-enable search input if it was disabled
        // if(paymentCustomerSearchInput) paymentCustomerSearchInput.disabled = false;
    }
}

/** Handles saving the payment received */
async function handleSavePaymentFromHistory() {
    if (!addDoc || !collection || !Timestamp || !currentSelectedPaymentCustomerId) {
        showPaymentError("Error: Cannot save payment. Missing dependency or Customer ID.");
        return;
    }

    const amount = parseFloat(paymentReceivedAmountInput.value);
    const dateStr = paymentReceivedDateInput.value;
    const method = paymentReceivedMethodSelect.value;
    const notes = paymentReceivedNotesInput.value.trim();

    // Validation
    if (isNaN(amount) || amount <= 0) {
        showPaymentError("Please enter a valid positive amount.");
        paymentReceivedAmountInput.focus();
        return;
    }
    if (!dateStr) {
        showPaymentError("Please select a payment date.");
        paymentReceivedDateInput.focus();
        return;
    }

    // Disable button, show loading
    if(saveReceivedPaymentBtn) {
        saveReceivedPaymentBtn.disabled = true;
        saveReceivedPaymentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }
    showPaymentError(''); // Clear previous errors

    try {
        const paymentDateTimestamp = Timestamp.fromDate(new Date(dateStr + 'T00:00:00')); // Assume start of day

        const paymentData = {
            customerId: currentSelectedPaymentCustomerId,
            amountPaid: amount,
            paymentDate: paymentDateTimestamp,
            paymentMethod: method || 'Other',
            notes: notes || null,
            createdAt: Timestamp.now(),
            source: 'Order History Page' // Optional: Track where payment was added from
        };

        const docRef = await addDoc(collection(db, "payments"), paymentData);
        console.log("Payment added successfully via Order History:", docRef.id);
        alert("Payment recorded successfully!");

        closePaymentReceivedModal(); // Close modal on success

        // Optional: Refresh underlying order data if payment affects order status/amountPaid directly
        // This might involve re-fetching orders or updating the specific order shown in the table
        // For now, we just close the modal. The payment will reflect in customer account detail page.

    } catch (error) {
        console.error("Error saving payment from history:", error);
        showPaymentError(`Error saving payment: ${error.message}`);
        // Re-enable button on error
        if(saveReceivedPaymentBtn) {
            saveReceivedPaymentBtn.disabled = false;
            saveReceivedPaymentBtn.innerHTML = '<i class="fas fa-save"></i> Save Payment';
        }
    }
}

/** Shows an error message in the payment received modal */
function showPaymentError(message) {
    if (paymentReceivedErrorSpan) {
        paymentReceivedErrorSpan.textContent = message;
        paymentReceivedErrorSpan.style.display = message ? 'block' : 'none';
    } else if (message) {
        alert(message); // Fallback
    }
}

// --- Final Log ---
console.log("order_history.js script loaded successfully (v1.2 - Payment Received Modal Logic Added).");