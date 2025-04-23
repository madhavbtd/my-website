// js/order_history.js
// Updated Version: Includes PO Creation, Enhanced Details, Read-Only Popup, items field fix, WhatsApp fix, etc.

const {
    db, collection, onSnapshot, query, orderBy, where,
    doc, getDoc, deleteDoc, updateDoc, Timestamp, serverTimestamp,
    arrayUnion, writeBatch, limit, addDoc, getDocs // Added getDocs
} = window;

// DOM Element References (ensure all IDs match your HTML)
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
const exportCsvBtn = document.getElementById('exportCsvBtn');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const bulkActionsBar = document.getElementById('bulkActionsBar');
const selectedCountSpan = document.getElementById('selectedCount');
const bulkStatusSelect = document.getElementById('bulkStatusSelect');
const bulkUpdateStatusBtn = document.getElementById('bulkUpdateStatusBtn');
const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
const reportingSection = document.getElementById('reportingSection');
const statusCountsReportContainer = document.getElementById('statusCountsReport');

const newCustomerBtn = document.getElementById('newCustomerBtn');
const paymentReceivedBtn = document.getElementById('paymentReceivedBtn');

// Details Modal Elements
const detailsModal = document.getElementById('detailsModal');
const closeModalBtn = document.getElementById('closeDetailsModal');
const modalOrderIdInput = document.getElementById('modalOrderId');
const modalDisplayOrderIdSpan = document.getElementById('modalDisplayOrderId');
const modalCustomerNameSpan = document.getElementById('modalCustomerName');
const modalCustomerWhatsAppSpan = document.getElementById('modalCustomerWhatsApp');
const modalCustomerContactSpan = document.getElementById('modalCustomerContact');
const modalCustomerAddressSpan = document.getElementById('modalCustomerAddress');
const modalOrderDateSpan = document.getElementById('modalOrderDate');
const modalDeliveryDateSpan = document.getElementById('modalDeliveryDate');
const modalPrioritySpan = document.getElementById('modalPriority');
const modalRemarksSpan = document.getElementById('modalRemarks');
const modalOrderStatusSelect = document.getElementById('modalOrderStatus');
const modalUpdateStatusBtn = document.getElementById('modalUpdateStatusBtn');
const modalStatusHistoryListContainer = document.getElementById('modalStatusHistoryList');
const modalProductListContainer = document.getElementById('modalProductList'); // Use this ID for products/items list
const modalTotalAmountSpan = document.getElementById('modalTotalAmount');
const modalAmountPaidSpan = document.getElementById('modalAmountPaid');
const modalBalanceDueSpan = document.getElementById('modalBalanceDue');
const modalPaymentStatusSpan = document.getElementById('modalPaymentStatus');
const addPaymentBtn = document.getElementById('addPaymentBtn');
const modalPOListContainer = document.getElementById('modalPOList');
const modalCreatePOBtn = document.getElementById('modalCreatePOBtn');
const modalDeleteBtn = document.getElementById('modalDeleteBtn');
const modalEditFullBtn = document.getElementById('modalEditFullBtn');

// WhatsApp Reminder Popup Elements
const whatsappReminderPopup = document.getElementById('whatsapp-reminder-popup');
const whatsappPopupCloseBtn = document.getElementById('popup-close-btn');
const whatsappMsgPreview = document.getElementById('whatsapp-message-preview');
const whatsappSendLink = document.getElementById('whatsapp-send-link');

// Bulk Delete Modal Elements
const bulkDeleteConfirmModal = document.getElementById('bulkDeleteConfirmModal');
const closeBulkDeleteModalBtn = document.getElementById('closeBulkDeleteModal');
const cancelBulkDeleteBtn = document.getElementById('cancelBulkDeleteBtn');
const confirmBulkDeleteBtn = document.getElementById('confirmBulkDeleteBtn');
const confirmDeleteCheckbox = document.getElementById('confirmDeleteCheckbox');
const bulkDeleteOrderList = document.getElementById('bulkDeleteOrderList');
const bulkDeleteCountSpan = document.getElementById('bulkDeleteCount');

// PO Item Selection Modal Elements
const poItemSelectionModal = document.getElementById('poItemSelectionModal');
const closePoItemSelectionModalBtn = document.getElementById('closePoItemSelectionModal');
const poItemSelectionOrderIdInput = document.getElementById('poItemSelectionOrderId');
const poItemSelectionDisplayOrderIdSpan = document.getElementById('poItemSelectionDisplayOrderId');
const poItemSelectionListContainer = document.getElementById('poItemSelectionList');
const poSupplierSearchInput = document.getElementById('poSupplierSearchInput');
const poSelectedSupplierIdInput = document.getElementById('poSelectedSupplierId');
const poSelectedSupplierNameInput = document.getElementById('poSelectedSupplierName');
const poSupplierSuggestionsDiv = document.getElementById('poSupplierSuggestions');
const cancelPoItemSelectionBtn = document.getElementById('cancelPoItemSelectionBtn');
const proceedToCreatePOBtn = document.getElementById('proceedToCreatePOBtn');
const poItemSelectionError = document.getElementById('poItemSelectionError');

// PO Details Popup Elements
const poDetailsPopup = document.getElementById('poDetailsPopup');
const poDetailsPopupContent = document.getElementById('poDetailsPopupContent');
const closePoDetailsPopupBtn = document.getElementById('closePoDetailsPopupBtn');
const closePoDetailsPopupBottomBtn = document.getElementById('closePoDetailsPopupBottomBtn');
const printPoDetailsPopupBtn = document.getElementById('printPoDetailsPopupBtn');

// Read-Only Order Modal Elements
const readOnlyOrderModal = document.getElementById('readOnlyOrderModal');
const closeReadOnlyOrderModalBtn = document.getElementById('closeReadOnlyOrderModal');
const readOnlyOrderModalTitle = document.getElementById('readOnlyOrderModalTitle');
const readOnlyOrderModalContent = document.getElementById('readOnlyOrderModalContent');
const closeReadOnlyOrderModalBottomBtn = document.getElementById('closeReadOnlyOrderModalBottomBtn');

// Global State Variables
let currentSortField = 'createdAt'; // Default sort field
let currentSortDirection = 'desc'; // Default sort direction
let unsubscribeOrders = null; // Firestore listener unsubscribe function
let allOrdersCache = []; // Cache for all fetched orders {id, data}
let currentlyDisplayedOrders = []; // Filtered/sorted orders currently shown
let searchDebounceTimer; // Timer for debouncing search input
let supplierSearchDebounceTimerPO; // Timer for supplier search in PO modal
let currentStatusFilter = ''; // Current status filter value
let orderIdToOpenFromUrl = null; // Order ID from URL parameter
let modalOpenedFromUrl = false; // Flag to prevent repeated modal opening from URL
let selectedOrderIds = new Set(); // Set to store selected Firestore IDs for bulk actions
let activeOrderDataForModal = null; // Holds data for the currently open editable modal
let cachedSuppliers = {}; // Cache for supplier data (optional)
let cachedPOsForOrder = {}; // Cache for PO data (optional)

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

        // Event Listeners Setup
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
        // TODO: Implement New Customer Modal Opening & Saving Logic
        alert('New Customer button clicked - Needs modal and save functionality.');
    });
    if (paymentReceivedBtn) paymentReceivedBtn.addEventListener('click', () => {
        // TODO: Implement Payment Received Modal (Search, Balance, Save)
         alert('Payment Received button clicked - Needs modal, search, balance, save functionality.');
    });

    // Bulk Actions Listeners
    if (selectAllCheckbox) selectAllCheckbox.addEventListener('change', handleSelectAllChange);
    if (bulkUpdateStatusBtn) bulkUpdateStatusBtn.addEventListener('click', handleBulkUpdateStatus);
    if (bulkDeleteBtn) bulkDeleteBtn.addEventListener('click', handleBulkDelete);
    if (bulkStatusSelect) bulkStatusSelect.addEventListener('change', updateBulkActionsBar); // Update button state when status changes
    if (confirmDeleteCheckbox) confirmDeleteCheckbox.addEventListener('change', () => { if(confirmBulkDeleteBtn) confirmBulkDeleteBtn.disabled = !confirmDeleteCheckbox.checked; });
    if (confirmBulkDeleteBtn) confirmBulkDeleteBtn.addEventListener('click', () => { if (confirmDeleteCheckbox.checked) executeBulkDelete(Array.from(selectedOrderIds)); });
    if (cancelBulkDeleteBtn) cancelBulkDeleteBtn.addEventListener('click', closeBulkDeleteModal);
    if (closeBulkDeleteModalBtn) closeBulkDeleteModalBtn.addEventListener('click', closeBulkDeleteModal);
    if (bulkDeleteConfirmModal) bulkDeleteConfirmModal.addEventListener('click', (event) => { if (event.target === bulkDeleteConfirmModal) closeBulkDeleteModal(); }); // Close on overlay click

    // Details Modal Listeners
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeDetailsModal);
    if (detailsModal) detailsModal.addEventListener('click', (event) => { if (event.target === detailsModal) closeDetailsModal(); }); // Close on overlay click
    if (modalUpdateStatusBtn) modalUpdateStatusBtn.addEventListener('click', handleUpdateStatus);
    if (modalDeleteBtn) modalDeleteBtn.addEventListener('click', handleDeleteFromModal);
    if (modalEditFullBtn) modalEditFullBtn.addEventListener('click', handleEditFullFromModal);
    if (addPaymentBtn) addPaymentBtn.addEventListener('click', () => alert('Add Payment clicked - Needs implementation'));
    if (modalCreatePOBtn) modalCreatePOBtn.addEventListener('click', handleCreatePOFromModal);

    // WhatsApp Popup Listeners
    if (whatsappPopupCloseBtn) whatsappPopupCloseBtn.addEventListener('click', closeWhatsAppPopup);
    if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (event) => { if (event.target === whatsappReminderPopup) closeWhatsAppPopup(); }); // Close on overlay click

    // PO Item Selection Modal Listeners
    if (closePoItemSelectionModalBtn) closePoItemSelectionModalBtn.addEventListener('click', closePoItemSelectionModal);
    if (cancelPoItemSelectionBtn) cancelPoItemSelectionBtn.addEventListener('click', closePoItemSelectionModal);
    if (poItemSelectionModal) poItemSelectionModal.addEventListener('click', (event) => { if (event.target === poItemSelectionModal) closePoItemSelectionModal(); }); // Close on overlay click
    if (proceedToCreatePOBtn) proceedToCreatePOBtn.addEventListener('click', handleProceedToCreatePO);
    if (poSupplierSearchInput) poSupplierSearchInput.addEventListener('input', handlePOSupplierSearchInput);
    if (poItemSelectionListContainer) poItemSelectionListContainer.addEventListener('change', handlePOItemCheckboxChange); // Listen for checkbox changes
    // Close supplier suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (poSupplierSuggestionsDiv && poSupplierSuggestionsDiv.style.display === 'block' && !poSupplierSearchInput.contains(e.target) && !poSupplierSuggestionsDiv.contains(e.target)) {
            poSupplierSuggestionsDiv.style.display = 'none';
        }
    });

    // PO Details Popup Listeners
     if (closePoDetailsPopupBtn) closePoDetailsPopupBtn.addEventListener('click', closePODetailsPopup);
     if (closePoDetailsPopupBottomBtn) closePoDetailsPopupBottomBtn.addEventListener('click', closePODetailsPopup);
     if (printPoDetailsPopupBtn) printPoDetailsPopupBtn.addEventListener('click', handlePrintPODetailsPopup);
     if (poDetailsPopup) poDetailsPopup.addEventListener('click', (event) => { if (event.target === poDetailsPopup) closePODetailsPopup(); }); // Close on overlay click

    // Read-Only Modal Listeners
     if (closeReadOnlyOrderModalBtn) closeReadOnlyOrderModalBtn.addEventListener('click', closeReadOnlyOrderModal);
     if (closeReadOnlyOrderModalBottomBtn) closeReadOnlyOrderModalBottomBtn.addEventListener('click', closeReadOnlyOrderModal);
     if (readOnlyOrderModal) readOnlyOrderModal.addEventListener('click', (event) => { if (event.target === readOnlyOrderModal) closeReadOnlyOrderModal(); }); // Close on overlay click

    // Table Event Delegation (Main handler for row clicks)
    if (orderTableBody) {
        orderTableBody.addEventListener('click', handleTableClick);
    } else {
        console.error("Element with ID 'orderTableBody' not found!");
    }
}

// Handles clicks within the order table body
function handleTableClick(event) {
    const target = event.target;
    const row = target.closest('tr');
    if (!row || !row.dataset.id) return; // Ignore clicks outside rows with IDs

    const firestoreId = row.dataset.id;
    // Find order data SYNCHRONOUSLY from the cache
    const orderWrapper = allOrdersCache.find(o => o.id === firestoreId);
    const orderData = orderWrapper ? orderWrapper.data : null;

    if (!orderData) {
        console.warn(`Order data not found in cache for ID: ${firestoreId}. Cannot perform action.`);
        // Optionally fetch data here as a fallback if needed, but cache should ideally be up-to-date
        // getDoc(doc(db, "orders", firestoreId)).then(docSnap => { if (docSnap.exists()) { /* retry action? */ } });
        return;
    }

    // Determine action based on clicked element
    if (target.matches('.row-selector')) {
        handleRowCheckboxChange(target, firestoreId);
    } else if (target.closest('.order-id-link')) {
        event.preventDefault();
        openReadOnlyOrderPopup(firestoreId, orderData); // Open read-only modal
    } else if (target.closest('.customer-name-link')) {
        event.preventDefault();
        const customerId = orderData.customerDetails?.customerId; // Use customerId stored within order
        if (customerId) {
            window.location.href = `customer_account_detail.html?id=${customerId}`;
        } else {
            alert('Customer details/ID not found for linking.');
        }
    } else if (target.closest('.create-po-button')) {
         event.preventDefault();
        openPOItemSelectionModal(firestoreId, orderData);
    } else if (target.closest('.view-po-details-link')) {
        event.preventDefault();
        const poId = target.closest('.view-po-details-link').dataset.poid;
        if (poId) {
            openPODetailsPopup(poId);
        } else {
            console.error("PO ID missing on view link");
        }
    } else if (target.closest('.see-more-link')) {
        event.preventDefault();
        openReadOnlyOrderPopup(firestoreId, orderData); // Open read-only modal for seeing more items
    } else if (target.closest('.details-edit-button')) {
        openDetailsModal(firestoreId, orderData); // Open editable modal
    } else if (target.closest('.whatsapp-button')) {
        sendWhatsAppMessage(firestoreId, orderData); // Send status message
    }
    // Add more conditions here for other clickable elements if needed
}


// Utility: Find order data in the cache
function findOrderInCache(firestoreId) {
    const orderWrapper = allOrdersCache.find(o => o.id === firestoreId);
    return orderWrapper ? orderWrapper.data : null;
}

// Utility: Wait for Firestore connection
function waitForDbConnection(callback) {
    if (window.db) {
        callback();
    } else {
        let attempt = 0;
        const maxAttempts = 20; // ~5 seconds
        const interval = setInterval(() => {
            attempt++;
            if (window.db) {
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

// --- Filter, Sort, Search Handlers ---
function handleSortChange() {
    if (!sortSelect) return;
    const [field, direction] = sortSelect.value.split('_');
    if (field && direction) {
        currentSortField = field;
        currentSortDirection = direction;
        applyFiltersAndRender(); // Re-apply filters and sort
    }
}
function handleFilterChange() { applyFiltersAndRender(); } // Re-apply filters on date/status change
function handleSearchInput() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(applyFiltersAndRender, 300); // Debounce search
}
function clearFilters() {
    if (filterDateInput) filterDateInput.value = '';
    if (filterSearchInput) filterSearchInput.value = '';
    if (filterStatusSelect) filterStatusSelect.value = '';
    if (sortSelect) sortSelect.value = 'createdAt_desc'; // Reset sort
    currentSortField = 'createdAt'; currentSortDirection = 'desc'; currentStatusFilter = '';
    selectedOrderIds.clear(); updateBulkActionsBar(); // Clear selections
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    // Clear URL parameters if they were set
    if (history.replaceState) {
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
    }
    applyFiltersAndRender(); // Re-render
}

// --- Firestore Listener ---
function listenForOrders() {
    if (unsubscribeOrders) { // Unsubscribe from previous listener if exists
        unsubscribeOrders();
        unsubscribeOrders = null;
    }
    if (!db) { console.error("Firestore instance (db) not available for listener."); return; }
    if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="11" id="loadingMessage">Loading orders...</td></tr>`; // Show loading state

    try {
        // Query the 'orders' collection
        // Consider adding initial orderBy and limit for performance if needed
        const q = query(collection(db, "orders") /*, orderBy('createdAt', 'desc'), limit(100) */ );

        unsubscribeOrders = onSnapshot(q, (snapshot) => {
            console.log(`Firestore snapshot received: ${snapshot.docs.length} docs`);
            // Process snapshot into the cache
            allOrdersCache = snapshot.docs.map(doc => ({
                 id: doc.id, // Firestore document ID
                 data: {
                     id: doc.id, // Include ID also within data object
                     orderId: doc.data().orderId || '', // User-defined order ID
                     customerDetails: doc.data().customerDetails || {},
                     items: doc.data().items || [], // <<< CHANGED from products
                     orderDate: doc.data().orderDate || null, // Firestore Timestamp preferred
                     deliveryDate: doc.data().deliveryDate || null, // Firestore Timestamp preferred
                     urgent: doc.data().urgent || 'No',
                     status: doc.data().status || 'Unknown',
                     statusHistory: doc.data().statusHistory || [],
                     createdAt: doc.data().createdAt || null, // Firestore Timestamp preferred
                     updatedAt: doc.data().updatedAt || null, // Firestore Timestamp preferred
                     remarks: doc.data().remarks || '',
                     totalAmount: doc.data().totalAmount ?? null, // Use nullish coalescing for potentially missing numbers
                     amountPaid: doc.data().amountPaid ?? null,
                     paymentStatus: doc.data().paymentStatus || 'Pending', // Default if missing
                     linkedPOs: doc.data().linkedPOs || []
                 }
             }));

            selectedOrderIds.clear(); // Clear selection on data refresh
            updateBulkActionsBar();
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
            applyFiltersAndRender(); // Filter, sort, and render the new data
            attemptOpenModalFromUrl(); // Check if URL requests a modal open

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
    if (!allOrdersCache) {
        console.warn("Order cache not ready for filtering.");
        return;
    }

    const filterDateValue = filterDateInput ? filterDateInput.value : ''; // YYYY-MM-DD string
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';
    const filterStatusValue = filterStatusSelect ? filterStatusSelect.value : '';
    currentStatusFilter = filterStatusValue; // Update global filter state

    // --- Filtering Logic ---
    let filteredOrders = allOrdersCache.filter(orderWrapper => {
        const order = orderWrapper.data;
        if (!order) return false;

        // Status Filter
        if (filterStatusValue && order.status !== filterStatusValue) return false;

        // Date Filter (Compare YYYY-MM-DD strings)
        if (filterDateValue) {
            let orderDateStr = '';
            if (order.orderDate && typeof order.orderDate.toDate === 'function') {
                try {
                    const d = order.orderDate.toDate();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    orderDateStr = `${d.getFullYear()}-${month}-${day}`;
                } catch(e){ console.warn("Error formatting order date for filter", e); }
            } else if (typeof order.orderDate === 'string' && order.orderDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                 orderDateStr = order.orderDate; // Handle string dates if necessary
            }
            if(orderDateStr !== filterDateValue) return false;
        }

        // Search Filter (check multiple fields)
        if (filterSearchValue) {
            const searchTerm = filterSearchValue;
            // <<< CHANGED order.products to order.items and p.name to p.productName >>>
            const itemsString = (order.items || []).map(p => String(p.productName || '').toLowerCase()).join(' ');
            const fieldsToSearch = [
                String(order.orderId || '').toLowerCase(),
                String(order.customerDetails?.fullName || '').toLowerCase(),
                String(order.id || '').toLowerCase(), // Firestore ID
                String(order.customerDetails?.whatsappNo || ''), // Phone numbers
                String(order.customerDetails?.contactNo || ''),
                itemsString // Search item names <<< CHANGED
            ];
            if (!fieldsToSearch.some(field => field.includes(searchTerm))) {
                return false;
            }
        }
        return true; // Include if all filters pass
    });

    // --- Sorting Logic ---
    try {
        filteredOrders.sort((aWrapper, bWrapper) => {
            const a = aWrapper.data; const b = bWrapper.data;
            let valA = a[currentSortField]; let valB = b[currentSortField];

            // Convert Timestamps to numbers for comparison
            if (valA?.toDate) valA = valA.toDate().getTime();
            if (valB?.toDate) valB = valB.toDate().getTime();

            // Handle date fields that might be null or invalid
            if (currentSortField === 'orderDate' || currentSortField === 'deliveryDate' || currentSortField === 'createdAt' || currentSortField === 'updatedAt') {
                 valA = Number(valA) || 0; // Treat null/invalid dates as 0
                 valB = Number(valB) || 0;
            }

            // Basic case-insensitive string comparison for other fields
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            // Comparison logic
            let sortComparison = 0;
            if (valA > valB) sortComparison = 1;
            else if (valA < valB) sortComparison = -1;

            return currentSortDirection === 'desc' ? sortComparison * -1 : sortComparison;
        });
    } catch (sortError) { console.error("Error during sorting:", sortError); }

    // --- Rendering Logic ---
    currentlyDisplayedOrders = filteredOrders.map(ow => ow.data); // Store data for export etc.
    updateOrderCountsAndReport(currentlyDisplayedOrders); // Update summary counts

    if (!orderTableBody) return;
    orderTableBody.innerHTML = ''; // Clear table

    if (currentlyDisplayedOrders.length === 0) {
        orderTableBody.innerHTML = `<tr><td colspan="11" id="noOrdersMessage">No orders found matching your criteria.</td></tr>`;
    } else {
        const searchTermForHighlight = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';
        currentlyDisplayedOrders.forEach(order => {
            displayOrderRow(order.id, order, searchTermForHighlight); // Display each row
        });
    }

    // Update "Select All" checkbox state
    updateSelectAllCheckboxState();
}

// Updates the state of the master "Select All" checkbox
function updateSelectAllCheckboxState() {
     if (selectAllCheckbox) {
        const allVisibleCheckboxes = orderTableBody.querySelectorAll('.row-selector');
        const totalVisible = allVisibleCheckboxes.length;
        if (totalVisible === 0) {
             selectAllCheckbox.checked = false;
             selectAllCheckbox.indeterminate = false;
             return;
        }
        // Count how many *visible* rows are selected
        const numSelectedVisible = Array.from(allVisibleCheckboxes).filter(cb => selectedOrderIds.has(cb.dataset.id)).length;

        if (numSelectedVisible === totalVisible) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else if (numSelectedVisible > 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }
    }
}


// Updates summary counts and reporting section
function updateOrderCountsAndReport(displayedOrders) {
    const total = displayedOrders.length;
    let completedDelivered = 0;
    const statusCounts = {};

    displayedOrders.forEach(order => {
        const status = order.status || 'Unknown';
        if (status === 'Completed' || status === 'Delivered') {
            completedDelivered++;
        }
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    const pending = total - completedDelivered;

    if (totalOrdersSpan) totalOrdersSpan.textContent = total;
    if (completedOrdersSpan) completedOrdersSpan.textContent = completedDelivered;
    if (pendingOrdersSpan) pendingOrdersSpan.textContent = pending;

    if (statusCountsReportContainer) {
        if (total === 0) {
            statusCountsReportContainer.innerHTML = '<p>No orders to report.</p>';
        } else {
            let reportHtml = '<ul>';
            Object.keys(statusCounts).sort().forEach(status => {
                reportHtml += `<li>${escapeHtml(status)}: <strong>${statusCounts[status]}</strong></li>`;
            });
            reportHtml += '</ul>';
            statusCountsReportContainer.innerHTML = reportHtml;
        }
    }
}

// Utility: Escape HTML
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        try { unsafe = String(unsafe ?? ''); } catch(e) { unsafe = '';} // Handle null/undefined safely
    }
    return unsafe.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#039;");
}

// Utility: Highlight search term
function highlightMatch(text, term) {
    const escapedText = escapeHtml(text); // Always escape first
    if (!term || !text) return escapedText;
    try {
        const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(${escapedTerm})`, 'gi');
        return escapedText.replace(regex, '<mark>$1</mark>');
    } catch (e) {
        console.warn("Highlighting regex error:", e);
        return escapedText;
    }
}


// --- Display Single Order Row ---
function displayOrderRow(firestoreId, data, searchTerm = '') {
    if (!orderTableBody || !data) return;

    const tableRow = document.createElement('tr');
    tableRow.setAttribute('data-id', firestoreId);
    if (selectedOrderIds.has(firestoreId)) tableRow.classList.add('selected-row');

    const customerDetails = data.customerDetails || {};
    const customerName = customerDetails.fullName || 'N/A';
    const customerMobile = customerDetails.whatsappNo || '-';

    const formatDate = (dateInput) => {
        if (!dateInput) return '-';
        try {
            const date = (typeof dateInput.toDate === 'function') ? dateInput.toDate() : new Date(dateInput);
            return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-GB');
        } catch { return '-'; }
    };
    const orderDateStr = formatDate(data.orderDate);
    const deliveryDateStr = formatDate(data.deliveryDate);

    const displayId = data.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`;
    const orderIdHtml = `<a href="#" class="order-id-link" data-id="${firestoreId}">${highlightMatch(displayId, searchTerm)}</a>`;
    const customerNameHtml = `<a href="#" class="customer-name-link" data-id="${firestoreId}">${highlightMatch(customerName, searchTerm)}</a>`;

    const status = data.status || 'Unknown';
    const priority = data.urgent === 'Yes' ? 'Yes' : 'No';

    // --- Display Items (Changed from Products) ---
    let itemsHtml = '-';
    const items = data.items || []; // <<< CHANGED from data.products
    const MAX_ITEMS_DISPLAY = 2;
    if (Array.isArray(items) && items.length > 0) {
        itemsHtml = items.slice(0, MAX_ITEMS_DISPLAY).map(item => { // <<< CHANGED from product/p to item
             if (!item) return ''; // Skip null/undefined items in array
             // <<< CHANGED p.name to item.productName >>>
             const name = highlightMatch(item.productName || 'Unnamed Item', searchTerm);
             const quantity = highlightMatch(item.quantity || '?', searchTerm);
             return `${name} (${quantity})`;
         }).filter(html => html).join('<br>'); // Filter out empty strings

        if (items.length > MAX_ITEMS_DISPLAY) {
             itemsHtml += `<br><a href="#" class="see-more-link" data-id="${firestoreId}">... (${items.length - MAX_ITEMS_DISPLAY} more)</a>`;
         }
    }
    // --- End Item Display ---

    const statusClass = `status-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const priorityClass = priority === 'Yes' ? 'priority-yes' : 'priority-no';

    // Display PO Info
     let poInfoHtml = '';
     const linkedPOs = data.linkedPOs || [];
     if (linkedPOs.length > 0) {
         poInfoHtml = linkedPOs.map(po => {
             if (!po || !po.poId) return '';
             const poDate = po.createdAt?.toDate ? po.createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'N/A';
             const poNumberDisplay = escapeHtml(po.poNumber || 'N/A');
             return `<a href="#" class="view-po-details-link" data-poid="${escapeHtml(po.poId)}" title="View PO #${poNumberDisplay} Details">PO #${poNumberDisplay}</a> (${poDate})`;
         }).filter(html => html).join('<br>');
     } else {
         poInfoHtml = `<button type="button" class="button create-po-button icon-only" data-id="${firestoreId}" title="Create Purchase Order"><i class="fas fa-file-alt"></i></button>`;
     }

    // Construct Row HTML
    try {
        tableRow.innerHTML = `
            <td class="col-checkbox"><input type="checkbox" class="row-selector" data-id="${firestoreId}" ${selectedOrderIds.has(firestoreId) ? 'checked' : ''}></td>
            <td>${orderIdHtml}</td>
            <td> <span class="customer-name-display">${customerNameHtml}</span> <span class="customer-mobile-inline">${highlightMatch(customerMobile, searchTerm)}</span> </td>
            <td>${itemsHtml}</td> <td>${orderDateStr}</td>
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


// --- Open Details Modal ---
async function openDetailsModal(firestoreId, orderData) {
    if (!orderData || !detailsModal) return;
    activeOrderDataForModal = orderData; // Store for actions

    // Populate basic info
    if(modalOrderIdInput) modalOrderIdInput.value = firestoreId;
    if(modalDisplayOrderIdSpan) modalDisplayOrderIdSpan.textContent = orderData.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`;
    if(modalCustomerNameSpan) modalCustomerNameSpan.textContent = orderData.customerDetails?.fullName || 'N/A';
    if(modalCustomerWhatsAppSpan) modalCustomerWhatsAppSpan.textContent = orderData.customerDetails?.whatsappNo || 'N/A';
    if(modalCustomerContactSpan) modalCustomerContactSpan.textContent = orderData.customerDetails?.contactNo || 'N/A';
    if(modalCustomerAddressSpan) modalCustomerAddressSpan.textContent = orderData.customerDetails?.address || 'N/A';

    const formatDateForDisplay = (dateInput) => {
        if (!dateInput) return 'N/A';
        try {
            const date = (typeof dateInput.toDate === 'function') ? dateInput.toDate() : new Date(dateInput);
            return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('en-GB');
        } catch { return 'N/A'; }
    };
    if(modalOrderDateSpan) modalOrderDateSpan.textContent = formatDateForDisplay(orderData.orderDate);
    if(modalDeliveryDateSpan) modalDeliveryDateSpan.textContent = formatDateForDisplay(orderData.deliveryDate);
    if(modalPrioritySpan) modalPrioritySpan.textContent = orderData.urgent || 'No';
    if(modalRemarksSpan) modalRemarksSpan.textContent = escapeHtml(orderData.remarks || 'None');

    // --- Display Item List (Changed from Product List) ---
    if (modalProductListContainer) { // Assuming the container ID remains 'modalProductList'
        modalProductListContainer.innerHTML = ''; // Clear previous
        const items = orderData.items || []; // <<< CHANGED from orderData.products
        if (Array.isArray(items) && items.length > 0) {
            const ul = document.createElement('ul');
            ul.className = 'modal-product-list-ul'; // Keep class name for consistency? Or change to modal-item-list-ul?
            items.forEach(item => { // <<< CHANGED from product/p to item
                if (!item) return; // Skip if item is null/undefined in array
                const li = document.createElement('li');
                const nameSpan = document.createElement('span'); nameSpan.className = 'product-name'; // Keep class name?
                // <<< CHANGED p.name to item.productName >>>
                nameSpan.textContent = escapeHtml(item.productName || 'Unnamed Item');
                const detailsSpan = document.createElement('span'); detailsSpan.className = 'product-qty-details'; // Keep class name?
                detailsSpan.textContent = ` - Qty: ${escapeHtml(item.quantity || '?')}`;
                li.append(nameSpan, detailsSpan);
                ul.appendChild(li);
            });
            modalProductListContainer.appendChild(ul);
        } else {
            modalProductListContainer.innerHTML = '<p class="no-products">No items listed.</p>'; // Keep class name?
        }
    }
    // --- End Item List Display ---


    // Set status dropdown and history
    if(modalOrderStatusSelect) modalOrderStatusSelect.value = orderData.status || '';
    if (modalStatusHistoryListContainer) {
        modalStatusHistoryListContainer.innerHTML = '';
        const history = orderData.statusHistory || [];
        if (history.length > 0) {
            const sortedHistory = [...history].sort((a, b) => (b.timestamp?.toDate?.()?.getTime() ?? 0) - (a.timestamp?.toDate?.()?.getTime() ?? 0)); // Desc
            const ul = document.createElement('ul'); ul.className = 'modal-status-history-ul';
            sortedHistory.forEach(entry => {
                const li = document.createElement('li');
                const statusSpan = document.createElement('span'); statusSpan.className = 'history-status'; statusSpan.textContent = escapeHtml(entry.status || '?');
                const timeSpan = document.createElement('span'); timeSpan.className = 'history-time';
                 try {
                    timeSpan.textContent = entry.timestamp?.toDate ? entry.timestamp.toDate().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : '?';
                 } catch { timeSpan.textContent = '?'; }
                li.append(statusSpan, timeSpan); ul.appendChild(li);
            });
            modalStatusHistoryListContainer.appendChild(ul);
        } else {
            modalStatusHistoryListContainer.innerHTML = '<p class="no-history">No status history.</p>';
        }
    }

    // Display Account Data
    const totalAmount = orderData.totalAmount ?? null;
    const amountPaid = orderData.amountPaid ?? null;
    let balanceDueText = 'N/A';
    let paymentStatus = orderData.paymentStatus ?? null;

    if (totalAmount !== null && amountPaid !== null) {
        const balanceDue = totalAmount - amountPaid;
        balanceDueText = `₹ ${balanceDue.toFixed(2)}`;
        if (paymentStatus === null) paymentStatus = balanceDue <= 0 ? 'Paid' : 'Pending';
    } else if (paymentStatus === null) {
         paymentStatus = 'N/A';
    }

    if(modalTotalAmountSpan) modalTotalAmountSpan.textContent = totalAmount !== null ? `₹ ${totalAmount.toFixed(2)}` : 'N/A';
    if(modalAmountPaidSpan) modalAmountPaidSpan.textContent = amountPaid !== null ? `₹ ${amountPaid.toFixed(2)}` : 'N/A';
    if(modalBalanceDueSpan) modalBalanceDueSpan.textContent = balanceDueText;
    if(modalPaymentStatusSpan) modalPaymentStatusSpan.textContent = escapeHtml(paymentStatus);

    // Display Linked POs
    await displayPOsInModal(firestoreId, orderData.linkedPOs || []);

    // Show modal
    if(detailsModal) detailsModal.style.display = 'flex';
}


// --- Display POs in Modal ---
async function displayPOsInModal(orderFirestoreId, linkedPOs) {
    if (!modalPOListContainer) return;
    modalPOListContainer.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading POs...</p>';

    if (!Array.isArray(linkedPOs) || linkedPOs.length === 0) {
        modalPOListContainer.innerHTML = '<p class="no-pos">No Purchase Orders linked to this order.</p>';
        return;
    }

    const validLinks = linkedPOs.filter(poLink => poLink?.poId); // Filter only valid links
    if (validLinks.length === 0) {
         modalPOListContainer.innerHTML = '<p class="no-pos">No valid Purchase Orders linked.</p>';
         return;
     }

    try {
        const poDetailsPromises = validLinks.map(poLink =>
            getDoc(doc(db, "purchaseOrders", poLink.poId)).catch(err => {
                console.warn(`Failed to fetch PO ${poLink.poId}:`, err); return null;
            })
        );
        const poSnapshots = await Promise.all(poDetailsPromises);

        const ul = document.createElement('ul'); ul.className = 'modal-po-list-ul';
        let validPOsFound = false;

        poSnapshots.forEach((poDoc, index) => {
            const poLink = validLinks[index]; // Use filtered links index
            if (!poDoc && !poLink) return; // Skip if both are missing somehow

            const li = document.createElement('li');
            if (poDoc?.exists()) {
                validPOsFound = true;
                const poData = poDoc.data();
                const poDate = poData.orderDate?.toDate ? poData.orderDate.toDate().toLocaleDateString('en-GB') : 'N/A';
                const supplierName = escapeHtml(poData.supplierName || 'Unknown');
                const poNumber = escapeHtml(poData.poNumber || 'N/A');
                const status = escapeHtml(poData.status || 'N/A');
                const total = (poData.totalAmount || 0).toFixed(2);

                li.innerHTML = `
                    <a href="#" class="view-po-details-link" data-poid="${poDoc.id}">PO #${poNumber}</a>
                    <span> - ${supplierName} (${poDate})</span>
                    <span> - Status: ${status}</span>
                    <span> - Amount: ₹ ${total}</span>`;
                const link = li.querySelector('.view-po-details-link');
                if (link) {
                    link.addEventListener('click', (event) => {
                         event.preventDefault();
                         const poId = event.target.closest('a').dataset.poid;
                         if (poId) openPODetailsPopup(poId);
                     });
                }
            } else if (poLink?.poId) {
                li.innerHTML = `<span>PO (ID: ${escapeHtml(poLink.poId)}) not found or error fetching</span>`;
                li.style.color = 'grey'; li.style.fontStyle = 'italic';
            }
            ul.appendChild(li);
        });

        modalPOListContainer.innerHTML = ''; // Clear loading
        if (validPOsFound) {
            modalPOListContainer.appendChild(ul);
        } else {
             modalPOListContainer.innerHTML = '<p class="no-pos">No valid Purchase Orders could be loaded.</p>';
        }

    } catch (error) {
        console.error("Error fetching PO details for modal:", error);
        modalPOListContainer.innerHTML = '<p class="error-message">Error loading POs.</p>';
    }
}

// --- Close Details Modal ---
function closeDetailsModal() {
    if (detailsModal) detailsModal.style.display = 'none';
    activeOrderDataForModal = null; // Clear the global state
}

// --- Handle Status Update ---
// *** THIS FUNCTION IS UPDATED for WhatsApp fix ***
async function handleUpdateStatus() {
    const firestoreId = modalOrderIdInput.value;
    const newStatus = modalOrderStatusSelect.value;
    // Use a temporary variable to hold the data needed AFTER the update succeeds
    // Make a shallow copy to avoid potential direct mutation issues if needed, though likely not necessary here
    const orderDataForWhatsApp = activeOrderDataForModal ? { ...activeOrderDataForModal } : null;

    // Basic validation
    if (!firestoreId || !newStatus || !orderDataForWhatsApp) {
        alert("Cannot update status. Order data not loaded correctly or missing ID/Status.");
        return;
    }
    if (orderDataForWhatsApp.status === newStatus) {
        alert("Status is already set to '" + escapeHtml(newStatus) + "'.");
        return;
    }

    // Disable button
    if (modalUpdateStatusBtn) {
        modalUpdateStatusBtn.disabled = true;
        modalUpdateStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    }

    // Prepare history entry
    const historyEntry = { status: newStatus, timestamp: Timestamp.now() };

    try {
        // Perform the Firestore update
        await updateDoc(doc(db, "orders", firestoreId), {
            status: newStatus,
            updatedAt: serverTimestamp(),
            statusHistory: arrayUnion(historyEntry)
        });
        console.log(`Order ${firestoreId} status updated to ${newStatus}`);

        // ---- WhatsApp Check AFTER successful update ----
        // Use the temporary variable 'orderDataForWhatsApp' which holds data from before modal close
        if (orderDataForWhatsApp.customerDetails?.whatsappNo) {
            console.log(`WhatsApp number found (${orderDataForWhatsApp.customerDetails.whatsappNo}), showing reminder.`);
            showStatusUpdateWhatsAppReminder(
                orderDataForWhatsApp.customerDetails,
                orderDataForWhatsApp.orderId || `Sys:${firestoreId.substring(0,6)}`,
                newStatus
            );
            // Close modal AFTER showing WhatsApp reminder
            closeDetailsModal();
        } else {
            console.log("No WhatsApp number found or customer details missing.");
            alert("Status updated successfully!");
            // Close modal AFTER showing standard success alert
            closeDetailsModal();
        }
        // ---- End WhatsApp Check ----

    } catch (e) {
        console.error("Error updating status:", firestoreId, e);
        alert("Error updating status: " + e.message);
        // Optional: Decide whether to close modal on error or leave open
        // closeDetailsModal();
    } finally {
        // Always re-enable the button regardless of success/error
        if (modalUpdateStatusBtn) {
            modalUpdateStatusBtn.disabled = false;
            modalUpdateStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Status';
        }
    }
}
// --- End Handle Status Update ---

// --- Handle Delete from Modal ---
function handleDeleteFromModal() {
    const firestoreId = modalOrderIdInput.value;
    const displayId = modalDisplayOrderIdSpan.textContent;
    if (!firestoreId) {
        alert("Cannot delete. Order ID not found.");
        return;
    }

    if (confirm(`Are you sure you want to permanently delete Order ID: ${displayId}? This cannot be undone.`)) {
        closeDetailsModal(); // Close modal first
        deleteSingleOrder(firestoreId);
    } else {
        console.log("Deletion cancelled by user.");
    }
}

// --- Delete Single Order ---
async function deleteSingleOrder(firestoreId) {
    if (!db || !firestoreId) {
        alert("Delete function unavailable or Order ID missing."); return;
    }
    console.log(`Attempting to delete order: ${firestoreId}`);
    try {
        await deleteDoc(doc(db, "orders", firestoreId));
        console.log(`Order ${firestoreId} deleted successfully.`);
        alert("Order deleted successfully.");
        // Listener will handle table update
    } catch (e) {
        console.error("Error deleting order:", firestoreId, e);
        alert("Error deleting order: " + e.message);
    }
}

// --- Handle Edit Full Order from Modal ---
function handleEditFullFromModal() {
    const firestoreId = modalOrderIdInput.value;
    if (firestoreId) {
        window.location.href = `new_order.html?editOrderId=${firestoreId}`;
    } else {
        alert("Cannot edit. Order ID not found.");
    }
}

// --- Handle Create PO from Modal ---
function handleCreatePOFromModal() {
    const orderFirestoreId = modalOrderIdInput.value;
    // Ensure data is available before proceeding
    if (orderFirestoreId && activeOrderDataForModal) {
        // Pass the currently loaded data to avoid race conditions
        const orderData = activeOrderDataForModal;
        closeDetailsModal(); // Close current modal first
        openPOItemSelectionModal(orderFirestoreId, orderData);
    } else {
        alert("Cannot create PO. Order details not loaded correctly.");
    }
}


// --- WhatsApp Functions ---
function showStatusUpdateWhatsAppReminder(customer, orderId, updatedStatus) {
    if (!whatsappReminderPopup || !whatsappMsgPreview || !whatsappSendLink || !customer) {
        console.warn("WhatsApp reminder elements or customer data missing."); return;
    }
    const name = customer.fullName || 'Customer';
    const rawNum = customer.whatsappNo || '';
    const num = rawNum.replace(/[^0-9]/g, '');
    if (!num) { console.warn("WhatsApp number missing or invalid."); return; }

    let msg = getWhatsAppMessageTemplate(updatedStatus, name, orderId, null); // Delivery date not needed here
    whatsappMsgPreview.innerText = msg;
    const url = `https://wa.me/91${num}?text=${encodeURIComponent(msg)}`;
    whatsappSendLink.href = url;

    const title = document.getElementById('whatsapp-popup-title');
    if(title) title.textContent = "Status Updated!";
    whatsappReminderPopup.classList.add('active');
}

function closeWhatsAppPopup() { if (whatsappReminderPopup) whatsappReminderPopup.classList.remove('active'); }

function sendWhatsAppMessage(firestoreId, orderData) {
    if (!orderData?.customerDetails?.whatsappNo) { alert("WhatsApp number not found for this order."); return; }
    const cust = orderData.customerDetails;
    const orderIdForMsg = orderData.orderId || `Sys:${firestoreId.substring(0,6)}`;
    const status = orderData.status;
    const deliveryDate = orderData.deliveryDate;
    const name = cust.fullName || 'Customer';
    const rawNum = cust.whatsappNo;
    const num = rawNum.replace(/[^0-9]/g, '');
    if (!num) { alert("Invalid WhatsApp number format."); return; }

    let msg = getWhatsAppMessageTemplate(status, name, orderIdForMsg, deliveryDate);
    const url = `https://wa.me/91${num}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

function getWhatsAppMessageTemplate(status, customerName, orderId, deliveryDate) {
    const namePlaceholder = "[Customer Name]";
    const orderNoPlaceholder = "[ORDER_NO]";
    const deliveryDatePlaceholder = "[DELIVERY_DATE]";
    const companyName = "Madhav Offset";
    const companyAddress = "Head Office: Moodh Market, Batadu";
    const companyMobile = "9549116541";
    const signature = `धन्यवाद,\n${companyName}\n${companyAddress}\nMobile: ${companyMobile}`;
    let template = "";
    let deliveryDateText = "जल्द से जल्द";

    try {
        if(deliveryDate) {
            const dDate = (typeof deliveryDate.toDate === 'function') ? deliveryDate.toDate() : new Date(deliveryDate);
            if (!isNaN(dDate.getTime())) {
                 deliveryDateText = dDate.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
             }
        }
    } catch(e) { console.warn("Could not format delivery date for WhatsApp", e); }

    function replaceAll(str, find, replace) {
        try { return str.split(find).join(replace); } catch { return str; }
    }

    switch (status) {
        case "Order Received": template = `प्रिय ${namePlaceholder},\nनमस्कार,\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) हमें सफलतापूर्वक प्राप्त हो गया है।\nहम इस ऑर्डर को ${deliveryDatePlaceholder} तक पूर्ण करने का प्रयास करेंगे।\n\nDear ${namePlaceholder},\nWe have successfully received your order (Order No: ${orderNoPlaceholder}).\nWe aim to complete it by ${deliveryDatePlaceholder}.`; break;
        case "Designing": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) का डिज़ाइन तैयार किया जा रहा है।\nजैसे ही डिज़ाइन तैयार होगा, हम आपसे पुष्टि के लिए संपर्क करेंगे।\n\nDear ${namePlaceholder},\nThe design for your order (Order No: ${orderNoPlaceholder}) is in progress.\nWe’ll contact you for confirmation once it’s ready.`; break;
        case "Verification": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की डिज़ाइन आपके साथ साझा कर दी गई है।\nकृपया डिज़ाइन को ध्यानपूर्वक जाँचे और हमें अपनी अनुमति प्रदान करें।\nएक बार ‘OK’ कर देने के बाद किसी भी प्रकार का संशोधन संभव नहीं होगा।\n\nDear ${namePlaceholder},\nWe have shared the design for your order (Order No: ${orderNoPlaceholder}) with you.\nPlease review it carefully and provide your approval.\nOnce you confirm with ‘OK’, no further changes will be possible.`; break;
        case "Design Approved": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की डिज़ाइन स्वीकृत कर दी गई है।\nअब यह प्रिंटिंग प्रक्रिया के लिए आगे बढ़ाया जा रहा है।\n\nDear ${namePlaceholder},\nYour design for Order No: ${orderNoPlaceholder} has been approved.\nIt is now moving forward to the printing stage.`; break;
        case "Ready for Working": template = `प्रिय ${namePlaceholder},\nनमस्कार,\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की प्रिंटिंग पूरी हो गई है।\nआप ऑफिस/कार्यालय आकर अपना प्रोडक्ट ले जा सकते हैं।\n\nDear ${namePlaceholder},\nThe printing for your order (Order No: ${orderNoPlaceholder}) is complete.\nYou can now collect your product from our office.`; break;
        case "Printing": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) प्रिंट हो रहा है।\nपूरा होते ही आपको सूचित किया जाएगा।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) is currently being printed.\nWe will notify you once it’s done.`; break;
        case "Delivered": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) सफलतापूर्वक डिलीवर कर दिया गया है।\nकृपया पुष्टि करें कि आपने ऑर्डर प्राप्त कर लिया है।\nआपके सहयोग के लिए धन्यवाद।\nहमें आशा है कि आप हमें शीघ्र ही फिर से सेवा का अवसर देंगे।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) has been successfully delivered.\nPlease confirm the receipt.\nThank you for your support.\nWe hope to have the opportunity to serve you again soon.`; break;
        case "Completed": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) सफलतापूर्वक पूर्ण हो चुका है।\nआपके सहयोग के लिए धन्यवाद।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) has been successfully completed.\nThank you for your support.`; break;
        default: template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) का वर्तमान स्टेटस है: ${status}.\n\nDear ${namePlaceholder},\nThe current status for your order (Order No: ${orderNoPlaceholder}) is: ${status}.`;
    }
    let message = replaceAll(template, namePlaceholder, customerName);
    message = replaceAll(message, orderNoPlaceholder, orderId);
    message = replaceAll(message, deliveryDatePlaceholder, deliveryDateText);
    message += `\n\n${signature}`;
    return message;
}


// --- Bulk Actions ---
function handleSelectAllChange(event) {
    const isChecked = event.target.checked;
    const rowsCheckboxes = orderTableBody.querySelectorAll('.row-selector');
    rowsCheckboxes.forEach(cb => {
        const id = cb.dataset.id;
        if (id) {
             cb.checked = isChecked;
             const row = cb.closest('tr');
             if (isChecked) { selectedOrderIds.add(id); if (row) row.classList.add('selected-row'); }
             else { selectedOrderIds.delete(id); if (row) row.classList.remove('selected-row'); }
        }
    });
    updateBulkActionsBar();
}

function handleRowCheckboxChange(checkbox, firestoreId) {
    const row = checkbox.closest('tr');
    if (checkbox.checked) { selectedOrderIds.add(firestoreId); if(row) row.classList.add('selected-row'); }
    else { selectedOrderIds.delete(firestoreId); if(row) row.classList.remove('selected-row'); }
    updateBulkActionsBar();
    updateSelectAllCheckboxState(); // Update master checkbox state
}

function updateBulkActionsBar() {
    const count = selectedOrderIds.size;
    if (!bulkActionsBar || !selectedCountSpan || !bulkUpdateStatusBtn || !bulkDeleteBtn) return; // Elements check
    if (count > 0) {
        selectedCountSpan.textContent = `${count} item${count > 1 ? 's' : ''} selected`;
        bulkActionsBar.style.display = 'flex';
        bulkUpdateStatusBtn.disabled = !(bulkStatusSelect && bulkStatusSelect.value);
        bulkDeleteBtn.disabled = false;
    } else {
        bulkActionsBar.style.display = 'none';
        if (bulkStatusSelect) bulkStatusSelect.value = '';
        bulkUpdateStatusBtn.disabled = true;
        bulkDeleteBtn.disabled = true;
    }
}

async function handleBulkDelete() {
    const idsToDelete = Array.from(selectedOrderIds);
    const MAX_DELETE_LIMIT = 5;
    if (idsToDelete.length === 0) { alert("Please select orders to delete."); return; }
    if (idsToDelete.length > MAX_DELETE_LIMIT) { alert(`You can delete a maximum of ${MAX_DELETE_LIMIT} orders at once.`); return; }
    if (!bulkDeleteConfirmModal || !bulkDeleteOrderList || !confirmDeleteCheckbox || !confirmBulkDeleteBtn || !bulkDeleteCountSpan) return;

    bulkDeleteOrderList.innerHTML = '';
    const maxItemsToShow = 100;
    idsToDelete.forEach((id, index) => {
        if (index < maxItemsToShow) {
            const order = findOrderInCache(id);
            const displayId = order?.orderId || `Sys:${id.substring(0,6)}`;
            const customerName = order?.customerDetails?.fullName || 'N/A';
            const li = document.createElement('li');
            li.innerHTML = `<strong>${escapeHtml(displayId)}</strong> - ${escapeHtml(customerName)}`;
            bulkDeleteOrderList.appendChild(li);
        }
    });
    if (idsToDelete.length > maxItemsToShow) {
         const li = document.createElement('li'); li.textContent = `... and ${idsToDelete.length - maxItemsToShow} more orders.`; bulkDeleteOrderList.appendChild(li);
    }
    bulkDeleteCountSpan.textContent = idsToDelete.length;
    confirmDeleteCheckbox.checked = false; confirmBulkDeleteBtn.disabled = true;
    bulkDeleteConfirmModal.style.display = 'flex';
}

async function executeBulkDelete(idsToDelete) {
    if (!db || idsToDelete.length === 0) return;
    if(bulkDeleteBtn) bulkDeleteBtn.disabled = true;
    if(confirmBulkDeleteBtn) { confirmBulkDeleteBtn.disabled = true; confirmBulkDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...'; }
    const batch = writeBatch(db);
    idsToDelete.forEach(id => { batch.delete(doc(db, "orders", id)); });
    try {
        await batch.commit();
        alert(`${idsToDelete.length} order(s) deleted successfully.`);
        selectedOrderIds.clear(); updateBulkActionsBar(); closeBulkDeleteModal();
    } catch (e) {
        console.error("Bulk delete error:", e); alert(`Error deleting orders: ${e.message}`);
        if(bulkDeleteBtn) bulkDeleteBtn.disabled = false; // Re-enable on error
    } finally {
        if(confirmBulkDeleteBtn) { confirmBulkDeleteBtn.disabled = true; confirmBulkDeleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Orders'; } // Reset confirm button state
         updateBulkActionsBar();
    }
}

function closeBulkDeleteModal() { if (bulkDeleteConfirmModal) bulkDeleteConfirmModal.style.display = 'none'; }

async function handleBulkUpdateStatus() {
    const idsToUpdate = Array.from(selectedOrderIds);
    const newStatus = bulkStatusSelect.value;
    const MAX_STATUS_UPDATE_LIMIT = 10;
    if (idsToUpdate.length === 0) { alert("Please select orders to update."); return; }
    if (idsToUpdate.length > MAX_STATUS_UPDATE_LIMIT) { alert(`You can update the status of a maximum of ${MAX_STATUS_UPDATE_LIMIT} orders at once.`); return; }
    if (!newStatus) { alert("Please select a status to update to."); return; }
    if (!confirm(`Are you sure you want to change the status of ${idsToUpdate.length} selected order(s) to "${escapeHtml(newStatus)}"?`)) return;

    if (bulkUpdateStatusBtn) { bulkUpdateStatusBtn.disabled = true; bulkUpdateStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; }
    const batch = writeBatch(db);
    const historyEntry = { status: newStatus, timestamp: Timestamp.now() };
    idsToUpdate.forEach(id => {
        const docRef = doc(db, "orders", id);
        batch.update(docRef, { status: newStatus, updatedAt: serverTimestamp(), statusHistory: arrayUnion(historyEntry) });
    });
    try {
        await batch.commit();
        alert(`${idsToUpdate.length} order(s) status updated to "${escapeHtml(newStatus)}".`);
        selectedOrderIds.clear(); if (bulkStatusSelect) bulkStatusSelect.value = ''; updateBulkActionsBar();
    } catch (e) {
        console.error("Bulk status update error:", e); alert(`Error updating status: ${e.message}`);
    } finally {
        if (bulkUpdateStatusBtn) { bulkUpdateStatusBtn.disabled = true; bulkUpdateStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Selected (Max 10)'; }
         updateBulkActionsBar(); // Ensure bar state is correct
    }
}


// --- CSV Export ---
function exportToCsv() {
    if (currentlyDisplayedOrders.length === 0) { alert("No data currently displayed to export."); return; }

    const headers = [ "Firestore ID", "Order ID", "Customer Name", "WhatsApp No", "Contact No", "Address", "Order Date", "Delivery Date", "Status", "Urgent", "Remarks", "Total Amount", "Amount Paid", "Payment Status", "Items (Name | Qty)" ]; // <<< CHANGED header "Products" to "Items"

    const rows = currentlyDisplayedOrders.map(order => {
        const formatCsvDate = (dateInput) => {
             if (!dateInput) return '';
             try {
                 const date = (typeof dateInput.toDate === 'function') ? dateInput.toDate() : new Date(dateInput);
                 if (isNaN(date.getTime())) return '';
                 const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${date.getFullYear()}-${month}-${day}`;
             } catch { return ''; }
         };
        // <<< CHANGED order.products to order.items and p.name to p.productName >>>
        const itemsString = (order.items || []).map(p => `${String(p.productName || '').replace(/\|/g, '')}|${String(p.quantity || '')}`).join('; ');

        return [ order.id, order.orderId || '', order.customerDetails?.fullName || '', order.customerDetails?.whatsappNo || '', order.customerDetails?.contactNo || '', order.customerDetails?.address || '', formatCsvDate(order.orderDate), formatCsvDate(order.deliveryDate), order.status || '', order.urgent || 'No', order.remarks || '', order.totalAmount ?? '', order.amountPaid ?? '', order.paymentStatus || 'Pending', itemsString ]; // <<< CHANGED productsString to itemsString
    });

    const escapeCsvField = (field) => {
        const stringField = String(field ?? '');
        return (stringField.includes(',') || stringField.includes('\n') || stringField.includes('"')) ? `"${stringField.replace(/"/g, '""')}"` : stringField;
    };

    const csvHeader = headers.map(escapeCsvField).join(",") + "\n";
    const csvRows = rows.map(row => row.map(escapeCsvField).join(",")).join("\n");
    const csvContent = csvHeader + csvRows;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const timestamp = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `orders_export_${timestamp}.csv`);
    link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
}


// --- Attempt Open Modal from URL ---
function attemptOpenModalFromUrl() {
    if (orderIdToOpenFromUrl && allOrdersCache.length > 0 && !modalOpenedFromUrl) {
        const orderWrapper = allOrdersCache.find(o => o.id === orderIdToOpenFromUrl);
        if (orderWrapper) {
            console.log(`Opening read-only modal for order ID from URL: ${orderIdToOpenFromUrl}`);
            openReadOnlyOrderPopup(orderIdToOpenFromUrl, orderWrapper.data);
            modalOpenedFromUrl = true;
            try {
                const url = new URL(window.location); url.searchParams.delete('openModalForId');
                window.history.replaceState({}, '', url.toString());
            } catch(e) { window.history.replaceState(null, '', window.location.pathname + window.location.hash); }
            orderIdToOpenFromUrl = null;
        } else {
             console.warn(`Order ID ${orderIdToOpenFromUrl} from URL not found in cache.`);
             orderIdToOpenFromUrl = null; modalOpenedFromUrl = true; // Prevent repeated attempts
         }
    }
}


// --- PO Creation Functions ---
function openPOItemSelectionModal(orderFirestoreId, orderData) {
    if (!poItemSelectionModal || !poItemSelectionOrderIdInput || !poItemSelectionDisplayOrderIdSpan || !poItemSelectionListContainer || !proceedToCreatePOBtn || !poSupplierSearchInput) {
        console.error("PO Item Selection Modal elements missing."); alert("Cannot open PO item selection popup."); return;
    }
    // <<< CHANGED from orderData.products to orderData.items >>>
    if (!orderData || !orderData.items || orderData.items.length === 0) {
        alert("No items found in this order to create a PO for."); return;
    }

    poItemSelectionOrderIdInput.value = orderFirestoreId;
    poItemSelectionDisplayOrderIdSpan.textContent = orderData.orderId || `Sys:${orderFirestoreId.substring(0,6)}`;
    poItemSelectionListContainer.innerHTML = ''; // Clear previous items
    poSupplierSearchInput.value = ''; poSelectedSupplierIdInput.value = ''; poSelectedSupplierNameInput.value = '';
    if(poSupplierSuggestionsDiv) poSupplierSuggestionsDiv.style.display = 'none';
    showPOItemError('');

    // <<< CHANGED from orderData.products to orderData.items >>>
    // TODO: Enhance `isAlreadyInPO` check
    let availableItems = 0;
    orderData.items.forEach((item, index) => { // <<< CHANGED variable name product -> item
        if (!item) return; // Skip null/undefined items in array
        const isAlreadyInPO = false;
        const div = document.createElement('div'); div.className = 'item-selection-entry';
        // <<< CHANGED item.name to item.productName >>>
        div.innerHTML = `<input type="checkbox" id="poItem_${index}" name="poItems" value="${index}" data-product-index="${index}" ${isAlreadyInPO ? 'disabled' : ''}> <label for="poItem_${index}"> <strong>${escapeHtml(item.productName || 'Unnamed Item')}</strong> (Qty: ${escapeHtml(item.quantity || '?')}) ${isAlreadyInPO ? '<span class="in-po-label">(In PO)</span>' : ''} </label>`;
        poItemSelectionListContainer.appendChild(div);
        if (!isAlreadyInPO) availableItems++;
    });

    if (availableItems === 0) {
        poItemSelectionListContainer.innerHTML = '<p>All items are already included in existing Purchase Orders or no items available.</p>';
        proceedToCreatePOBtn.disabled = true;
    } else {
        proceedToCreatePOBtn.disabled = true; // Enable on selection + supplier
    }
    poItemSelectionModal.classList.add('active');
}

function closePoItemSelectionModal() { if (poItemSelectionModal) poItemSelectionModal.classList.remove('active'); showPOItemError(''); }
function showPOItemError(message) { if (poItemSelectionError) { poItemSelectionError.textContent = message; poItemSelectionError.style.display = message ? 'block' : 'none'; } }
function handlePOItemCheckboxChange() {
    if (!poItemSelectionListContainer || !proceedToCreatePOBtn || !poSelectedSupplierIdInput) return;
    const selectedCheckboxes = poItemSelectionListContainer.querySelectorAll('input[name="poItems"]:checked:not(:disabled)');
    const supplierSelected = !!poSelectedSupplierIdInput.value;
    proceedToCreatePOBtn.disabled = !(selectedCheckboxes.length > 0 && supplierSelected);
}
function handlePOSupplierSearchInput() {
    if (!poSupplierSearchInput || !poSupplierSuggestionsDiv || !poSelectedSupplierIdInput || !poSelectedSupplierNameInput) return;
    clearTimeout(supplierSearchDebounceTimerPO);
    const searchTerm = poSupplierSearchInput.value.trim();
    poSelectedSupplierIdInput.value = ''; poSelectedSupplierNameInput.value = '';
    handlePOItemCheckboxChange();
    if (searchTerm.length < 1) { if(poSupplierSuggestionsDiv){ poSupplierSuggestionsDiv.innerHTML = ''; poSupplierSuggestionsDiv.style.display = 'none';} return; }
    supplierSearchDebounceTimerPO = setTimeout(() => { fetchPOSupplierSuggestions(searchTerm); }, 350);
}
async function fetchPOSupplierSuggestions(searchTerm) {
    if (!poSupplierSuggestionsDiv || !db) return;
    poSupplierSuggestionsDiv.innerHTML = '<div>Loading...</div>'; poSupplierSuggestionsDiv.style.display = 'block';
    const searchTermLower = searchTerm.toLowerCase();
    try {
        // Assumes 'name_lowercase' field exists for case-insensitive search
        const q = query( collection(db, "suppliers"), orderBy("name_lowercase"), where("name_lowercase", ">=", searchTermLower), where("name_lowercase", "<=", searchTermLower + '\uf8ff'), limit(10) );
        const querySnapshot = await getDocs(q); // Use getDocs
        poSupplierSuggestionsDiv.innerHTML = '';
        if (querySnapshot.empty) {
            poSupplierSuggestionsDiv.innerHTML = '<div class="no-suggestions">No matching suppliers found.</div>';
        } else {
            querySnapshot.forEach((docSnapshot) => {
                const supplier = docSnapshot.data(); const supplierId = docSnapshot.id;
                const div = document.createElement('div'); div.textContent = `${supplier.name}${supplier.companyName ? ' (' + supplier.companyName + ')' : ''}`;
                div.dataset.id = supplierId; div.dataset.name = supplier.name;
                div.style.cursor = 'pointer';
                div.addEventListener('mousedown', (e) => { // Use mousedown to prevent blur issues
                    e.preventDefault();
                    if(poSupplierSearchInput) poSupplierSearchInput.value = supplier.name;
                    if(poSelectedSupplierIdInput) poSelectedSupplierIdInput.value = supplierId;
                    if(poSelectedSupplierNameInput) poSelectedSupplierNameInput.value = supplier.name;
                    if(poSupplierSuggestionsDiv) poSupplierSuggestionsDiv.style.display = 'none';
                    handlePOItemCheckboxChange(); // Update button state after selection
                });
                poSupplierSuggestionsDiv.appendChild(div);
            });
        }
    } catch (error) {
        console.error("Error fetching PO supplier suggestions:", error);
        poSupplierSuggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Error fetching suppliers.</div>';
    }
}
function handleProceedToCreatePO() {
    const orderFirestoreId = poItemSelectionOrderIdInput.value;
    const selectedSupplierId = poSelectedSupplierIdInput.value;
    const selectedSupplierName = poSelectedSupplierNameInput.value;
    if (!orderFirestoreId || !selectedSupplierId || !selectedSupplierName) { showPOItemError("Missing Order ID or Supplier Selection."); return; }
    const selectedItemsIndices = Array.from(poItemSelectionListContainer.querySelectorAll('input[name="poItems"]:checked:not(:disabled)')).map(cb => parseInt(cb.value));
    if (selectedItemsIndices.length === 0) { showPOItemError("Please select at least one item for the PO."); return; }
    const params = new URLSearchParams();
    params.append('sourceOrderId', orderFirestoreId); params.append('supplierId', selectedSupplierId); params.append('supplierName', selectedSupplierName); params.append('itemIndices', selectedItemsIndices.join(','));
    window.location.href = `new_po.html?${params.toString()}`;
    closePoItemSelectionModal();
}


// --- PO Details Popup Functions ---
async function openPODetailsPopup(poId) {
    if (!poDetailsPopup || !poDetailsPopupContent || !db || !poId) return;
    poDetailsPopupContent.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading PO details...</p>';
    poDetailsPopup.classList.add('active');
    try {
        const poRef = doc(db, "purchaseOrders", poId); const poDocSnap = await getDoc(poRef);
        if (!poDocSnap.exists()) throw new Error(`Purchase Order with ID ${poId} not found.`);
        const poData = poDocSnap.data();
        const supplierName = poData.supplierName || 'Unknown Supplier'; const poNumberDisplay = poData.poNumber ? `#${poData.poNumber}` : 'N/A';
        let orderDateStr = poData.orderDate?.toDate ? poData.orderDate.toDate().toLocaleDateString('en-GB') : 'N/A';
        let popupHTML = `<div class="po-details-popup-header"><h3>Purchase Order ${escapeHtml(poNumberDisplay)}</h3><p><strong>Supplier:</strong> ${escapeHtml(supplierName)}</p><p><strong>Order Date:</strong> ${orderDateStr}</p><p><strong>Status:</strong> ${escapeHtml(poData.status || 'N/A')}</p><p><strong>Total Amount:</strong> ₹ ${(poData.totalAmount || 0).toFixed(2)}</p></div><hr><h4>Items</h4>`;
        if (poData.items && poData.items.length > 0) {
            popupHTML += `<table class="details-table-popup"><thead><tr><th>#</th><th>Product</th><th>Details</th><th>Rate</th><th>Amount</th></tr></thead><tbody>`;
            poData.items.forEach((item, index) => {
                if (!item) return; // Skip null items
                let detailStr = ''; const qty = item.quantity || '?';
                if (item.type === 'Sq Feet') { const w = item.realWidth || item.width || '?'; const h = item.realHeight || item.height || '?'; const u = item.unit || item.inputUnit || 'units'; detailStr = `Qty: ${escapeHtml(qty)} (${escapeHtml(w)}x${escapeHtml(h)} ${escapeHtml(u)})`; }
                else { detailStr = `Qty: ${escapeHtml(qty)}`; }
                popupHTML += `<tr><td>${index + 1}</td><td>${escapeHtml(item.productName || 'N/A')}</td><td>${detailStr}</td><td>${item.rate?.toFixed(2) ?? 'N/A'}</td><td align="right">${item.itemAmount?.toFixed(2) ?? 'N/A'}</td></tr>`;
            });
            popupHTML += `</tbody></table>`;
        } else { popupHTML += `<p>No items found for this PO.</p>`; }
        if (poData.notes) { popupHTML += `<div class="po-notes-popup"><strong>Notes:</strong><p>${escapeHtml(poData.notes).replace(/\n/g, '<br>')}</p></div>`; }
        poDetailsPopupContent.innerHTML = popupHTML;
        if(printPoDetailsPopupBtn) printPoDetailsPopupBtn.dataset.poid = poId;
    } catch (error) {
        console.error("Error loading PO details into popup:", error);
        poDetailsPopupContent.innerHTML = `<p class="error-message">Error loading PO details: ${escapeHtml(error.message)}</p>`;
    }
}
function closePODetailsPopup() { if (poDetailsPopup) poDetailsPopup.classList.remove('active'); }
function handlePrintPODetailsPopup(event) {
    const contentElement = document.getElementById('poDetailsPopupContent'); if (!contentElement) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<html><head><title>Print PO Details</title><style>body{font-family:sans-serif;margin:20px;} h3,h4{margin-bottom:10px;} table{width:100%; border-collapse:collapse; margin-bottom:15px;} th, td{border:1px solid #ccc; padding:5px; text-align:left; font-size:0.9em;} th{background-color:#f2f2f2;} .po-notes-popup{margin-top:15px; border:1px solid #eee; padding:10px; font-size:0.9em; white-space: pre-wrap;} p{margin:5px 0;} strong{font-weight:bold;} </style></head><body>${contentElement.innerHTML}</body></html>`);
    printWindow.document.close(); printWindow.focus();
    setTimeout(() => { try { printWindow.print(); } catch (e) { console.error("Print error:", e); alert("Could not print."); } finally { setTimeout(() => { printWindow.close(); }, 200); } }, 500);
}


// --- Read-Only Order Details Popup Functions ---
function openReadOnlyOrderPopup(firestoreId, orderData) {
    if (!readOnlyOrderModal || !readOnlyOrderModalContent || !readOnlyOrderModalTitle || !orderData) return;

    readOnlyOrderModalTitle.textContent = `Order Details: #${escapeHtml(orderData.orderId || firestoreId.substring(0,6))}`;
    readOnlyOrderModalContent.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading...</p>';
    readOnlyOrderModal.classList.add('active');

    let contentHTML = '<div class="read-only-grid">';

    // Customer Section
    contentHTML += '<div class="read-only-section"><h4>Customer</h4>';
    contentHTML += `<p><strong>Name:</strong> ${escapeHtml(orderData.customerDetails?.fullName || 'N/A')}</p>`;
    contentHTML += `<p><strong>WhatsApp:</strong> ${escapeHtml(orderData.customerDetails?.whatsappNo || 'N/A')}</p>`;
    contentHTML += `<p><strong>Contact:</strong> ${escapeHtml(orderData.customerDetails?.contactNo || 'N/A')}</p>`;
    contentHTML += `<p><strong>Address:</strong> ${escapeHtml(orderData.customerDetails?.address || 'N/A')}</p></div>`;

    // Order Info Section
    const formatDateRO = (dateInput) => {
        if (!dateInput) return 'N/A';
        try { const d = (typeof dateInput.toDate === 'function') ? dateInput.toDate() : new Date(dateInput); return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('en-GB'); } catch { return 'N/A'; }
    };
    contentHTML += '<div class="read-only-section"><h4>Order Info</h4>';
    contentHTML += `<p><strong>Order Date:</strong> ${formatDateRO(orderData.orderDate)}</p>`;
    contentHTML += `<p><strong>Delivery Date:</strong> ${formatDateRO(orderData.deliveryDate)}</p>`;
    contentHTML += `<p><strong>Priority:</strong> ${escapeHtml(orderData.urgent || 'No')}</p>`;
    contentHTML += `<p><strong>Status:</strong> ${escapeHtml(orderData.status || 'N/A')}</p>`;
    contentHTML += `<p><strong>Remarks:</strong> ${escapeHtml(orderData.remarks || 'None')}</p></div>`;

    // --- Items Section (Changed from Products) ---
    contentHTML += '<div class="read-only-section read-only-products"><h4>Items</h4>'; // Keep class name?
    const items = orderData.items || []; // <<< CHANGED from orderData.products
    if (items.length > 0) {
        contentHTML += '<ul class="read-only-product-list">'; // Keep class name?
        items.forEach(item => { // <<< CHANGED variable name
             if (!item) return;
             // <<< CHANGED item.name to item.productName >>>
             contentHTML += `<li><strong>${escapeHtml(item.productName || 'Unnamed Item')}</strong> - Qty: ${escapeHtml(item.quantity || '?')}</li>`;
        });
        contentHTML += '</ul>';
    } else {
        contentHTML += '<p>No items listed.</p>';
    }
    contentHTML += '</div>';
    // --- End Items Section ---


    // Account Data Section
    contentHTML += '<div class="read-only-section"><h4>Account Data</h4>';
    const totalAmountRO = orderData.totalAmount ?? null; const amountPaidRO = orderData.amountPaid ?? null;
    let balanceDueROText = 'N/A'; let paymentStatusRO = orderData.paymentStatus ?? null;
    if (totalAmountRO !== null && amountPaidRO !== null) { const balanceDueRO = totalAmountRO - amountPaidRO; balanceDueROText = `₹ ${balanceDueRO.toFixed(2)}`; if (paymentStatusRO === null) paymentStatusRO = balanceDueRO <= 0 ? 'Paid' : 'Pending'; }
    else if (paymentStatusRO === null) { paymentStatusRO = 'N/A'; }
    contentHTML += `<p><strong>Total Amount:</strong> ${totalAmountRO !== null ? `₹ ${totalAmountRO.toFixed(2)}` : 'N/A'}</p>`;
    contentHTML += `<p><strong>Amount Paid:</strong> ${amountPaidRO !== null ? `₹ ${amountPaidRO.toFixed(2)}` : 'N/A'}</p>`;
    contentHTML += `<p><strong>Balance Due:</strong> ${balanceDueROText}</p>`;
    contentHTML += `<p><strong>Payment Status:</strong> ${escapeHtml(paymentStatusRO)}</p></div>`;


    // Status History Section
    contentHTML += '<div class="read-only-section"><h4>Status History</h4>';
    const historyRO = orderData.statusHistory || [];
    if (historyRO.length > 0) {
        const sortedHistoryRO = [...historyRO].sort((a, b) => (b.timestamp?.toDate?.()?.getTime() ?? 0) - (a.timestamp?.toDate?.()?.getTime() ?? 0));
        contentHTML += '<ul class="read-only-history-list">';
        sortedHistoryRO.forEach(entry => {
            let timeStr = '?'; try { timeStr = entry.timestamp?.toDate ? entry.timestamp.toDate().toLocaleString('en-GB') : '?'; } catch {}
            contentHTML += `<li><strong>${escapeHtml(entry.status || '?')}</strong> at ${timeStr}</li>`;
        });
        contentHTML += '</ul>';
    } else { contentHTML += '<p>No status history available.</p>'; }
    contentHTML += '</div>';

    contentHTML += '</div>'; // Close read-only-grid
    readOnlyOrderModalContent.innerHTML = contentHTML;
}
function closeReadOnlyOrderModal() { if (readOnlyOrderModal) readOnlyOrderModal.classList.remove('active'); }


console.log("order_history.js script loaded successfully (with fixes).");