// js/order_history.js
// Updated Version: v1.7 - Added More listenForOrders Debugging

const {
    db, collection, onSnapshot, query, orderBy, where,
    doc, getDoc, deleteDoc, updateDoc, Timestamp, serverTimestamp,
    arrayUnion, writeBatch, limit, addDoc, getDocs
} = window;

// --- START DEBUG LOGGING HELPER ---
function logElementFind(id) { /* ... (same as v1.6) ... */ }
// --- END DEBUG LOGGING HELPER ---


// DOM Element References
console.log("--- Defining DOM Element References ---");
// ... (all logElementFind calls remain the same as v1.6) ...
console.log("--- Finished Defining DOM Elements ---");

// Global State Variables
// ... (all global variables remain the same as v1.6) ...
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
document.addEventListener('DOMContentLoaded', () => {
    console.log("Order History DOM Loaded. Initializing...");
    const urlParams = new URLSearchParams(window.location.search);
    const orderIdToOpenFromUrl = urlParams.get('openModalForId');
    let statusFromUrl = urlParams.get('status');

    if (orderIdToOpenFromUrl) console.log(`Request to open modal for ID: ${orderIdToOpenFromUrl}`);
    if (statusFromUrl && filterStatusSelect) {
        filterStatusSelect.value = statusFromUrl;
        currentStatusFilter = statusFromUrl;
    }

    console.log("DEBUG: Calling waitForDbConnection...");
    waitForDbConnection(() => {
        console.log("DEBUG: DB Connection confirmed by callback. Running setup and listener...");
        setupEventListeners(); // Setup listeners first
        listenForOrders(orderIdToOpenFromUrl); // Then listen for orders, pass ID
    });
    console.log("DEBUG: Call to waitForDbConnection finished (callback might run later).");
});

// Function to setup all event listeners
function setupEventListeners() {
    console.log("DEBUG: Starting setupEventListeners...");
    const addListener = (element, event, handler, name) => { /* ... (same as v1.6) ... */ };
    try {
        // Add all event listeners safely using addListener helper
        // ... (all addListener calls remain the same as v1.6) ...
        console.log("DEBUG: All event listeners set up successfully.");
    } catch (error) {
        console.error("CRITICAL ERROR during setupEventListeners:", error);
        alert("A critical error occurred while setting up page interactions. Some features might not work.");
    }
}

// Utility: Wait for Firestore connection
function waitForDbConnection(callback) { /* ... (same as v1.6) ... */ }

// --- Firestore Listener ---
function listenForOrders(orderIdToOpen) {
    // <<< --- NEW DEBUG LOGS --- >>>
    console.log("DEBUG: Entered listenForOrders function.");
    if (unsubscribeOrders) {
        try {
             unsubscribeOrders();
             console.log("DEBUG: Unsubscribed previous listener.");
        } catch (unsubError) {
            console.error("DEBUG: Error unsubscribing previous listener:", unsubError)
        }
        unsubscribeOrders = null;
    }
    if (!db) { console.error("Firestore instance (db) not available for listener."); return; }
    if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="11" id="loadingMessage">Loading orders...</td></tr>`;
    else { console.error("CRITICAL: orderTableBody not found in listenForOrders!"); return; }

    try {
        console.log("DEBUG: Preparing Firestore query for 'orders' collection..."); // <<< NEW DEBUG LOG
        const ordersCollectionRef = collection(db, "orders");
        if (!ordersCollectionRef) { console.error("CRITICAL: Failed to get collection reference for 'orders'."); return; }
        const q = query(ordersCollectionRef); // Simple query for all orders
        console.log("DEBUG: Firestore query prepared:", q); // <<< NEW DEBUG LOG

        console.log("DEBUG: Attaching onSnapshot listener..."); // <<< NEW DEBUG LOG
        unsubscribeOrders = onSnapshot(q, (snapshot) => {
            console.log(`DEBUG: Order snapshot received, processing ${snapshot.docs.length} docs...`);
            allOrdersCache = snapshot.docs.map(doc => ({
                 id: doc.id, data: { id: doc.id, ...doc.data() }
             }));
            selectedOrderIds.clear();
            if(selectAllCheckbox) selectAllCheckbox.checked = false;
            updateBulkActionsBar();
            applyFiltersAndRender();

            if(orderIdToOpen && !modalOpenedFromUrl){
                attemptOpenModalFromUrl(orderIdToOpen);
                modalOpenedFromUrl = true;
            }
             console.log("DEBUG: Order processing and rendering complete after snapshot.");
        }, (error) => {
            // <<< --- IMPROVED ERROR LOGGING --- >>>
            console.error("ERROR during onSnapshot:", error);
            console.error("Error Code:", error.code);
            console.error("Error Message:", error.message);
            // <<< --- END IMPROVEMENT --- >>>
            if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="11" style="color: red;">Error loading orders. Check console. Details: ${error.code}</td></tr>`;
        });
         console.log("DEBUG: Firestore onSnapshot listener successfully attached.");
    } catch (error) {
        console.error("CRITICAL ERROR setting up Firestore listener:", error);
        if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="11" style="color: red;">Error setting up listener.</td></tr>`;
        alert("Error connecting to order data. Please refresh.");
    }
}

// --- Apply Filters & Render Table ---
function applyFiltersAndRender() { /* ... (same as v1.6) ... */ }
function updateSelectAllCheckboxState() { /* ... (same as v1.6) ... */ }
function updateOrderCountsAndReport(displayedOrders) { /* ... (same as v1.6) ... */ }
function escapeHtml(unsafe) { /* ... (same as v1.6) ... */ }
function highlightMatch(text, term) { /* ... (same as v1.6) ... */ }
function displayOrderRow(firestoreId, data, searchTerm = '') { /* ... (same as v1.6) ... */ }
function handleTableClick(event) { /* ... (same as v1.6) ... */ }

// --- All Modal Handling Functions ---
// Ensure ALL functions from v1.6 are present and complete here
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
function attemptOpenModalFromUrl(orderIdToOpen) { /* ... (same as v1.6) ... */ }
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
function openPaymentReceivedModal() { /* ... (same as v1.6) ... */ }
function closePaymentReceivedModal() { if (paymentReceivedModal) paymentReceivedModal.classList.remove('active'); }
function handlePaymentCustomerSearchInput() { /* ... (same as v1.6) ... */ }
async function fetchPaymentCustomerSuggestions(searchTerm) { /* ... (same as v1.6) ... */ }
function selectPaymentCustomer(event) { /* ... (same as v1.6) ... */ }
async function fetchAndDisplayDueAmount(customerId) { /* ... (same as v1.6) ... */ }
async function handleSavePaymentFromHistory() { /* ... (same as v1.6) ... */ }
function showPaymentError(message) { /* ... (same as v1.6) ... */ }


// --- Final Log ---
console.log("order_history.js script loaded successfully (v1.7 - More Listener Debugging).");