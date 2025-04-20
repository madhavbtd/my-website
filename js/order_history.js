// js/order_history.js

// Import Timestamp and arrayUnion from Firestore SDK
// Assume these are globally available via order_history.html's script block
const { db, collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, Timestamp, arrayUnion } = window;

// --- DOM Elements ---
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
const modalOrderIdInput = document.getElementById('modalOrderId'); // Hidden input stores Firestore ID
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

// --- Global State ---
let currentSortField = 'createdAt';
let currentSortDirection = 'desc';
let unsubscribeOrders = null;
let allOrdersCache = []; // Stores ALL raw order data fetched by listener
let searchDebounceTimer;
let currentStatusFilter = '';
let orderIdToOpenFromUrl = null; // *** NEW: Store ID from URL ***
let modalOpenedFromUrl = false; // *** NEW: Flag to prevent multiple opens ***

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DEBUG] Order History DOM Loaded.");

    // *** NEW: Check for URL parameter immediately ***
    const urlParams = new URLSearchParams(window.location.search);
    orderIdToOpenFromUrl = urlParams.get('openModalForId');
    if (orderIdToOpenFromUrl) {
        console.log(`[DEBUG] Received request to open modal for Firestore ID: ${orderIdToOpenFromUrl}`);
        // Clear the parameter from URL immediately to prevent re-trigger on refresh
        // Use replaceState to avoid adding to browser history
         const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.search.replace(`openModalForId=${orderIdToOpenFromUrl}`, '').replace(/&$/, '').replace(/\?$/, '');
        // window.history.replaceState({ path: cleanUrl }, '', cleanUrl); // Keep other params if any
         window.history.replaceState(null, '', window.location.pathname); // Or remove all params


    }
    currentStatusFilter = urlParams.get('status'); // Keep status filter check
    if (currentStatusFilter && filterStatusSelect) {
        filterStatusSelect.value = currentStatusFilter;
    }
    // --- End URL Param Check ---

    waitForDbConnection(() => {
        listenForOrders(); // Start listener

        // Event Listeners (remain the same)
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

        // Event Delegation for table buttons (remains the same)
        orderTableBody.addEventListener('click', function(event) {
            // ... (rest of the delegation logic is unchanged) ...
            const target = event.target;
            const row = target.closest('tr');
            if (!row || !row.dataset.id) return;
            const firestoreId = row.dataset.id;
            const orderData = allOrdersCache.find(o => o.id === firestoreId);
            if (!orderData) { console.warn(`[DEBUG] Order data not found in cache for ID: ${firestoreId}`); return; }
            if (target.closest('.details-edit-button')) { openDetailsModal(firestoreId, orderData); }
            else if (target.closest('.whatsapp-button')) { sendWhatsAppMessage(firestoreId, orderData); }
        });
    });
});

// --- DB Connection Wait --- (remains the same)
function waitForDbConnection(callback) { if(window.db){callback();}else{let a=0,m=20,i=setInterval(()=>{a++;if(window.db){clearInterval(i);callback();}else if(a>=m){clearInterval(i);console.error("DB timeout");alert("DB Error");}},250);} }

// --- Sorting & Filtering Handlers --- (remain the same)
function handleSortChange() { /*...*/ currentSortField = field; currentSortDirection = direction; applyFiltersAndRender(); }
function handleFilterChange() { applyFiltersAndRender(); }
function handleSearchInput() { clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(applyFiltersAndRender, 300); }
function clearFilters() { /*...*/ currentSortFilter = ''; applyFiltersAndRender(); }

// --- Firestore Listener ---
function listenForOrders() {
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    if (!db || !collection || !query || !orderBy || !onSnapshot) return;
    orderTableBody.innerHTML = `<tr><td colspan="9" id="loadingMessage">Loading...</td></tr>`; // Colspan=9
    try {
        const q = query(collection(db, "orders")); // Fetch all initially
        unsubscribeOrders = onSnapshot(q, (snapshot) => {
            allOrdersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            applyFiltersAndRender(); // Apply filters/sort to the new list
            // *** NEW: Attempt to open modal AFTER data is loaded ***
            attemptOpenModalFromUrl();
            // *** END NEW ***
        }, (error) => { console.error("Error fetching orders:", error); /*...*/ });
    } catch (error) { console.error("Error setting up listener:", error); /*...*/ }
}

// --- Filter, Sort, Render --- (remains the same)
function applyFiltersAndRender() {
    if (!allOrdersCache) return;
    const filterDateValue = filterDateInput ? filterDateInput.value : '';
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';
    const filterStatusValue = filterStatusSelect ? filterStatusSelect.value : '';
    currentStatusFilter = filterStatusValue;

    // Filter logic (remains the same)
    let filteredOrders = allOrdersCache.filter(order => { /* ... */ return true; });

    // Sort logic (remains the same)
    filteredOrders.sort((a, b) => { /* ... */ return comparison; });

    // Update Counts based on FILTERED list (remains the same)
    updateOrderCounts(filteredOrders);

    // Render table (remains the same)
    orderTableBody.innerHTML = '';
    if (filteredOrders.length === 0) { /*...*/ }
    else { filteredOrders.forEach(order => { displayOrderRow(order.id, order); }); }
}

// --- Update Order Counts Function --- (remains the same)
function updateOrderCounts(filteredOrders) { /* ... */ }

// --- Display Single Order Row --- (remains the same)
function displayOrderRow(firestoreId, data) { /* ... */ }


// --- *** NEW: Function to attempt opening modal based on URL param *** ---
function attemptOpenModalFromUrl() {
    // Check if we have an ID from URL, if data is loaded, and if modal wasn't already opened
    if (orderIdToOpenFromUrl && allOrdersCache.length > 0 && !modalOpenedFromUrl) {
        console.log(`[DEBUG] Attempting to find and open modal for ID: ${orderIdToOpenFromUrl}`);
        const orderToOpenData = allOrdersCache.find(o => o.id === orderIdToOpenFromUrl);

        if (orderToOpenData) {
            console.log("[DEBUG] Order found in cache, opening modal.");
            openDetailsModal(orderIdToOpenFromUrl, orderToOpenData);
            modalOpenedFromUrl = true; // Set flag to prevent re-opening
            orderIdToOpenFromUrl = null; // Clear the ID after successful open
        } else {
            console.warn(`[DEBUG] Order with ID ${orderIdToOpenFromUrl} not found in cache yet. Will retry on next data load if necessary.`);
            // Note: This might happen if the specific order data arrives slightly later.
            // The check in listenForOrders ensures it tries again.
        }
    } else if(orderIdToOpenFromUrl && allOrdersCache.length === 0) {
         console.log("[DEBUG] Have ID from URL, but order cache is still empty. Waiting for data...");
    }
}
// --- *** END NEW FUNCTION *** ---


// --- Modal 1 Handling ---
function openDetailsModal(firestoreId, orderData) {
    // This function remains largely the same, ensure it populates correctly
    if (!orderData || !detailsModal) { console.error("Missing order data or modal element:", firestoreId); return; }
    console.log("[DEBUG] Opening details modal for:", firestoreId);
    modalOrderIdInput.value = firestoreId; // Store Firestore ID in hidden input
    modalDisplayOrderIdSpan.textContent = orderData.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`;
    modalCustomerNameSpan.textContent = orderData.customerDetails?.fullName || 'N/A';
    modalCustomerWhatsAppSpan.textContent = orderData.customerDetails?.whatsappNo || 'N/A';
    modalOrderStatusSelect.value = orderData.status || '';

    // Populate Product List (remains the same)
    if (modalProductListContainer) { /* ... product list logic ... */ }

    // Populate Status History (remains the same)
    if (modalStatusHistoryListContainer) { /* ... status history logic ... */ }

    detailsModal.style.display = 'flex';
}

function closeDetailsModal() { if (detailsModal) { detailsModal.style.display = 'none'; } }

// --- Modal 1 Action Handlers --- (remain the same)
async function handleUpdateStatus() { /* ... */ }
function handleDeleteFromModal() { /* ... */ }
function handleEditFullFromModal() { /* ... */ }

// --- Main Delete Order Function --- (remains the same)
async function handleDeleteOrder(firestoreId, orderDisplayId) { /* ... */ }

// --- Modal 2 (WhatsApp Reminder) Handling --- (remains the same)
function showStatusUpdateWhatsAppReminder(customer, orderId, updatedStatus) { /* ... */ }
function closeWhatsAppPopup() { /* ... */ }

// --- Table Row WhatsApp Button Handler --- (remains the same)
function sendWhatsAppMessage(firestoreId, orderData) { /* ... */ }

// --- Helper Function for WhatsApp Templates --- (remains the same)
function getWhatsAppMessageTemplate(status, customerName, orderId, deliveryDate) { /* ... */ }

// --- Final Log --- (remains the same)
console.log("order_history.js script fully loaded and initialized.");