// js/order_history.js
// Updated Version: Includes PO Creation, Enhanced Details, Read-Only Popup, etc.

const {
    db, collection, onSnapshot, query, orderBy, where,
    doc, getDoc, deleteDoc, updateDoc, Timestamp, serverTimestamp,
    arrayUnion, writeBatch, limit, addDoc // Added addDoc and limit
} = window;

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
// Removed customerPanelBtn reference as it's being removed from HTML

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
const modalProductListContainer = document.getElementById('modalProductList');
const modalTotalAmountSpan = document.getElementById('modalTotalAmount');
const modalAmountPaidSpan = document.getElementById('modalAmountPaid');
const modalBalanceDueSpan = document.getElementById('modalBalanceDue');
const modalPaymentStatusSpan = document.getElementById('modalPaymentStatus');
const addPaymentBtn = document.getElementById('addPaymentBtn');
const modalPOListContainer = document.getElementById('modalPOList');
const modalCreatePOBtn = document.getElementById('modalCreatePOBtn');
const modalDeleteBtn = document.getElementById('modalDeleteBtn');
const modalEditFullBtn = document.getElementById('modalEditFullBtn');

const whatsappReminderPopup = document.getElementById('whatsapp-reminder-popup');
const whatsappPopupCloseBtn = document.getElementById('popup-close-btn');
const whatsappMsgPreview = document.getElementById('whatsapp-message-preview');
const whatsappSendLink = document.getElementById('whatsapp-send-link');

const bulkDeleteConfirmModal = document.getElementById('bulkDeleteConfirmModal');
const closeBulkDeleteModalBtn = document.getElementById('closeBulkDeleteModal');
const cancelBulkDeleteBtn = document.getElementById('cancelBulkDeleteBtn');
const confirmBulkDeleteBtn = document.getElementById('confirmBulkDeleteBtn');
const confirmDeleteCheckbox = document.getElementById('confirmDeleteCheckbox');
const bulkDeleteOrderList = document.getElementById('bulkDeleteOrderList');
const bulkDeleteCountSpan = document.getElementById('bulkDeleteCount');

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

const poDetailsPopup = document.getElementById('poDetailsPopup');
const poDetailsPopupContent = document.getElementById('poDetailsPopupContent');
const closePoDetailsPopupBtn = document.getElementById('closePoDetailsPopupBtn');
const closePoDetailsPopupBottomBtn = document.getElementById('closePoDetailsPopupBottomBtn');
const printPoDetailsPopupBtn = document.getElementById('printPoDetailsPopupBtn');

const readOnlyOrderModal = document.getElementById('readOnlyOrderModal');
const closeReadOnlyOrderModalBtn = document.getElementById('closeReadOnlyOrderModal');
const readOnlyOrderModalTitle = document.getElementById('readOnlyOrderModalTitle');
const readOnlyOrderModalContent = document.getElementById('readOnlyOrderModalContent');
const closeReadOnlyOrderModalBottomBtn = document.getElementById('closeReadOnlyOrderModalBottomBtn');

// Global State
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
let activeOrderDataForModal = null; // Holds data for the currently open modal
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

        // Event Listeners
        if (sortSelect) sortSelect.addEventListener('change', handleSortChange);
        if (filterDateInput) filterDateInput.addEventListener('change', handleFilterChange);
        if (filterSearchInput) filterSearchInput.addEventListener('input', handleSearchInput);
        if (filterStatusSelect) filterStatusSelect.addEventListener('change', handleFilterChange);
        if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
        if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCsv);

        if (newCustomerBtn) newCustomerBtn.addEventListener('click', () => {
            // TODO: Implement New Customer Modal Opening & Saving Logic
            alert('New Customer button clicked - Needs modal and save functionality.');
        });
        if (paymentReceivedBtn) paymentReceivedBtn.addEventListener('click', () => {
            // TODO: Implement Payment Received Modal (Search, Balance, Save)
             alert('Payment Received button clicked - Needs modal, search, balance, save functionality.');
        });
        // Removed listener for customerPanelBtn

        if (selectAllCheckbox) selectAllCheckbox.addEventListener('change', handleSelectAllChange);
        if (bulkUpdateStatusBtn) bulkUpdateStatusBtn.addEventListener('click', handleBulkUpdateStatus);
        if (bulkDeleteBtn) bulkDeleteBtn.addEventListener('click', handleBulkDelete);
        if (bulkStatusSelect) bulkStatusSelect.addEventListener('change', updateBulkActionsBar);
        if (confirmDeleteCheckbox) confirmDeleteCheckbox.addEventListener('change', () => { if(confirmBulkDeleteBtn) confirmBulkDeleteBtn.disabled = !confirmDeleteCheckbox.checked; });
        if (confirmBulkDeleteBtn) confirmBulkDeleteBtn.addEventListener('click', () => { if (confirmDeleteCheckbox.checked) executeBulkDelete(Array.from(selectedOrderIds)); });
        if (cancelBulkDeleteBtn) cancelBulkDeleteBtn.addEventListener('click', closeBulkDeleteModal);
        if (closeBulkDeleteModalBtn) closeBulkDeleteModalBtn.addEventListener('click', closeBulkDeleteModal);
        if (bulkDeleteConfirmModal) bulkDeleteConfirmModal.addEventListener('click', (event) => { if (event.target === bulkDeleteConfirmModal) closeBulkDeleteModal(); });

        if (closeModalBtn) closeModalBtn.addEventListener('click', closeDetailsModal);
        if (detailsModal) detailsModal.addEventListener('click', (event) => { if (event.target === detailsModal) closeDetailsModal(); });
        if (modalUpdateStatusBtn) modalUpdateStatusBtn.addEventListener('click', handleUpdateStatus); // Corrected this function name if it was typoed elsewhere
        if (modalDeleteBtn) modalDeleteBtn.addEventListener('click', handleDeleteFromModal);
        if (modalEditFullBtn) modalEditFullBtn.addEventListener('click', handleEditFullFromModal);
        if (addPaymentBtn) addPaymentBtn.addEventListener('click', () => alert('Add Payment clicked - Needs implementation'));
        if (modalCreatePOBtn) modalCreatePOBtn.addEventListener('click', handleCreatePOFromModal);

        if (whatsappPopupCloseBtn) whatsappPopupCloseBtn.addEventListener('click', closeWhatsAppPopup);
        if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (event) => { if (event.target === whatsappReminderPopup) closeWhatsAppPopup(); });

        if (closePoItemSelectionModalBtn) closePoItemSelectionModalBtn.addEventListener('click', closePoItemSelectionModal);
        if (cancelPoItemSelectionBtn) cancelPoItemSelectionBtn.addEventListener('click', closePoItemSelectionModal);
        if (poItemSelectionModal) poItemSelectionModal.addEventListener('click', (event) => { if (event.target === poItemSelectionModal) closePoItemSelectionModal(); });
        if (proceedToCreatePOBtn) proceedToCreatePOBtn.addEventListener('click', handleProceedToCreatePO);
        if (poSupplierSearchInput) poSupplierSearchInput.addEventListener('input', handlePOSupplierSearchInput);
        if (poItemSelectionListContainer) poItemSelectionListContainer.addEventListener('change', handlePOItemCheckboxChange);
        document.addEventListener('click', (e) => {
            if (poSupplierSuggestionsDiv && poSupplierSuggestionsDiv.style.display === 'block' && !poSupplierSearchInput.contains(e.target) && !poSupplierSuggestionsDiv.contains(e.target)) {
                poSupplierSuggestionsDiv.style.display = 'none';
            }
        });

         if (closePoDetailsPopupBtn) closePoDetailsPopupBtn.addEventListener('click', closePODetailsPopup);
         if (closePoDetailsPopupBottomBtn) closePoDetailsPopupBottomBtn.addEventListener('click', closePODetailsPopup);
         if (printPoDetailsPopupBtn) printPoDetailsPopupBtn.addEventListener('click', handlePrintPODetailsPopup);
         if (poDetailsPopup) poDetailsPopup.addEventListener('click', (event) => { if (event.target === poDetailsPopup) closePODetailsPopup(); });

         if (closeReadOnlyOrderModalBtn) closeReadOnlyOrderModalBtn.addEventListener('click', closeReadOnlyOrderModal);
         if (closeReadOnlyOrderModalBottomBtn) closeReadOnlyOrderModalBottomBtn.addEventListener('click', closeReadOnlyOrderModal);
         if (readOnlyOrderModal) readOnlyOrderModal.addEventListener('click', (event) => { if (event.target === readOnlyOrderModal) closeReadOnlyOrderModal(); });


        // Table Event Delegation
        if (orderTableBody) {
            orderTableBody.addEventListener('click', function(event) {
                const target = event.target;
                const row = target.closest('tr');
                if (!row || !row.dataset.id) return;

                const firestoreId = row.dataset.id;
                // Find order data SYNCHRONOUSLY from the cache to avoid async issues here
                const orderWrapper = allOrdersCache.find(o => o.id === firestoreId);
                const orderData = orderWrapper ? orderWrapper.data : null; // Use cached data

                if (!orderData) {
                    console.warn(`Order data not found in cache for ID: ${firestoreId}`);
                    // Maybe fetch it here as a fallback? getDoc(doc(db, "orders", firestoreId)).then(...)
                    return;
                }

                if (target.matches('.row-selector')) {
                    handleRowCheckboxChange(target, firestoreId);
                } else if (target.closest('.order-id-link')) {
                    event.preventDefault();
                    openReadOnlyOrderPopup(firestoreId, orderData); // Open read-only modal
                } else if (target.closest('.customer-name-link')) {
                    event.preventDefault();
                    const customerId = orderData.customerDetails?.customerId; // Use ID from customerDetails
                    if (customerId) {
                        // Navigate using Firestore Document ID stored in customerDetails.customerId
                        window.location.href = `customer_account_detail.html?id=${customerId}`;
                    } else {
                        alert('Customer details/ID not found for linking.');
                    }
                } else if (target.closest('.create-po-button')) {
                     event.preventDefault(); // Prevent default if it's a button inside a link/cell
                    openPOItemSelectionModal(firestoreId, orderData);
                } else if (target.closest('.view-po-details-link')) {
                    event.preventDefault();
                    const poId = target.closest('.view-po-details-link').dataset.poid; // Get poid from the link itself
                    if (poId) {
                        openPODetailsPopup(poId);
                    } else {
                        console.error("PO ID missing on view link");
                    }
                } else if (target.closest('.see-more-link')) {
                    event.preventDefault();
                    openReadOnlyOrderPopup(firestoreId, orderData); // Open read-only modal
                } else if (target.closest('.details-edit-button')) {
                    openDetailsModal(firestoreId, orderData); // Open editable modal
                } else if (target.closest('.whatsapp-button')) {
                    sendWhatsAppMessage(firestoreId, orderData);
                }
            });
        } else {
            console.error("Element with ID 'orderTableBody' not found!");
        }
    });
});

function findOrderInCache(firestoreId) {
    const order = allOrdersCache.find(o => o.id === firestoreId);
    return order ? order.data : null;
}

function waitForDbConnection(callback) {
    if (window.db) { callback(); } else { let a = 0, m = 20, i = setInterval(() => { a++; if (window.db) { clearInterval(i); callback(); } else if (a >= m) { clearInterval(i); console.error("DB connection timeout (order_history.js)"); alert("Database connection failed."); } }, 250); }
}

function handleSortChange() {
    if (!sortSelect) return;
    const [field, direction] = sortSelect.value.split('_');
    if (field && direction) { currentSortField = field; currentSortDirection = direction; applyFiltersAndRender(); }
}
function handleFilterChange() { applyFiltersAndRender(); }
function handleSearchInput() { clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(applyFiltersAndRender, 300); }
function clearFilters() {
    if (filterDateInput) filterDateInput.value = '';
    if (filterSearchInput) filterSearchInput.value = '';
    if (filterStatusSelect) filterStatusSelect.value = '';
    if (sortSelect) sortSelect.value = 'createdAt_desc';
    currentSortField = 'createdAt'; currentSortDirection = 'desc'; currentStatusFilter = '';
    selectedOrderIds.clear(); updateBulkActionsBar();
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    if (history.replaceState) { const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname; window.history.replaceState({ path: cleanUrl }, '', cleanUrl); }
    applyFiltersAndRender();
}

function listenForOrders() {
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    if (!db) { console.error("Firestore instance (db) not available."); return; }
    if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="11" id="loadingMessage">Loading orders...</td></tr>`;

    try {
        // Consider adding orderBy('createdAt', 'desc') here initially if needed
        // Also consider adding limit() if the number of orders is very large
        const q = query(collection(db, "orders"));
        unsubscribeOrders = onSnapshot(q, (snapshot) => {
            allOrdersCache = snapshot.docs.map(doc => ({
                 id: doc.id,
                 data: {
                     id: doc.id, // Include firestore ID also within data for easier access
                     orderId: doc.data().orderId || '',
                     customerDetails: doc.data().customerDetails || {}, // Contains customerId, name, whatsapp etc.
                     products: doc.data().products || [],
                     orderDate: doc.data().orderDate || null, // Should be Firestore Timestamp
                     deliveryDate: doc.data().deliveryDate || null, // Should be Firestore Timestamp
                     urgent: doc.data().urgent || 'No',
                     status: doc.data().status || 'Unknown',
                     statusHistory: doc.data().statusHistory || [], // Array of {status, timestamp}
                     createdAt: doc.data().createdAt || null, // Should be Firestore Timestamp
                     updatedAt: doc.data().updatedAt || null, // Should be Firestore Timestamp
                     remarks: doc.data().remarks || '',
                     totalAmount: doc.data().totalAmount || 0, // Needed for Account Data
                     amountPaid: doc.data().amountPaid || 0,   // Needed for Account Data
                     paymentStatus: doc.data().paymentStatus || 'Pending', // Needed for Account Data
                     linkedPOs: doc.data().linkedPOs || [] // Array of {poId, poNumber, createdAt}
                 }
             }));

            selectedOrderIds.clear(); // Clear selection on data refresh
            updateBulkActionsBar();
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
            applyFiltersAndRender(); // Re-render with new data
            attemptOpenModalFromUrl(); // Check if modal needs opening based on URL

        }, (error) => {
            console.error("Error fetching orders snapshot:", error);
            if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="11" style="color: red;">Error loading orders. Please try again.</td></tr>`;
        });
    } catch (error) {
        console.error("Error setting up Firestore listener:", error);
        if (orderTableBody) orderTableBody.innerHTML = `<tr><td colspan="11" style="color: red;">Error setting up listener.</td></tr>`;
    }
}

function applyFiltersAndRender() {
    if (!allOrdersCache) return;

    const filterDateValue = filterDateInput ? filterDateInput.value : '';
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';
    const filterStatusValue = filterStatusSelect ? filterStatusSelect.value : '';
    currentStatusFilter = filterStatusValue; // Update global filter state

    // --- Filtering ---
    let filteredOrders = allOrdersCache.filter(orderWrapper => {
        const order = orderWrapper.data;
        if (!order) return false; // Skip if data is somehow missing

        // Status Filter
        if (filterStatusValue && order.status !== filterStatusValue) return false;

        // Date Filter (Compare YYYY-MM-DD strings)
        if (filterDateValue) {
            let orderDateStr = '';
            // Convert Firestore Timestamp to YYYY-MM-DD
            if (order.orderDate && typeof order.orderDate.toDate === 'function') {
                try {
                    const d = order.orderDate.toDate();
                    // Pad month and day with leading zeros if needed
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    orderDateStr = `${d.getFullYear()}-${month}-${day}`;
                } catch(e){ console.warn("Error formatting order date", e); }
            }
            // Also handle if date is stored as string (though timestamp is preferred)
            else if (typeof order.orderDate === 'string' && order.orderDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                 orderDateStr = order.orderDate;
            }
            if(orderDateStr !== filterDateValue) return false;
        }

        // Search Filter (check multiple fields)
        if (filterSearchValue) {
            const searchTerm = filterSearchValue;
            const fieldsToSearch = [
                String(order.orderId || '').toLowerCase(),
                String(order.customerDetails?.fullName || '').toLowerCase(),
                String(order.id || '').toLowerCase(), // Search by Firestore ID too
                String(order.customerDetails?.whatsappNo || ''), // Search plain numbers
                String(order.customerDetails?.contactNo || ''),
                (order.products || []).map(p => String(p.name || '').toLowerCase()).join(' ') // Search product names
            ];
            // Check if any field contains the search term
            if (!fieldsToSearch.some(field => field.includes(searchTerm))) {
                return false;
            }
        }
        return true; // Include order if all filters pass
    });

    // --- Sorting ---
    try {
        filteredOrders.sort((aWrapper, bWrapper) => {
            const a = aWrapper.data;
            const b = bWrapper.data;
            let valA = a[currentSortField];
            let valB = b[currentSortField];

            // Convert Timestamps to milliseconds for comparison
            if (valA && typeof valA.toDate === 'function') valA = valA.toDate().getTime();
            if (valB && typeof valB.toDate === 'function') valB = valB.toDate().getTime();

            // Handle potential string dates (less reliable than Timestamps)
             if ((currentSortField === 'orderDate' || currentSortField === 'deliveryDate') && typeof valA === 'string' && typeof valB === 'string') {
                 // Basic string comparison, might not be accurate for all date formats
                 // Timestamps are strongly recommended for date fields
             } else if (currentSortField === 'orderDate' || currentSortField === 'deliveryDate'){
                 // Handle cases where one date might be null or not a timestamp/string
                 const timeA = !isNaN(valA) ? valA : 0; // Treat invalid dates as 0 for sorting
                 const timeB = !isNaN(valB) ? valB : 0;
                 valA = timeA;
                 valB = timeB;
             }

            // Handle non-date fields that might be numbers or strings
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();


            let sortComparison = 0;
            if (valA > valB) sortComparison = 1;
            else if (valA < valB) sortComparison = -1;

            // Apply direction (desc or asc)
            return currentSortDirection === 'desc' ? sortComparison * -1 : sortComparison;
        });
    } catch (sortError) { console.error("Error during sorting:", sortError); }

    // Update global state and render
    currentlyDisplayedOrders = filteredOrders.map(ow => ow.data); // Store just the data part
    updateOrderCountsAndReport(currentlyDisplayedOrders); // Update summary counts/report

    if (!orderTableBody) return;
    orderTableBody.innerHTML = ''; // Clear existing table rows

    if (currentlyDisplayedOrders.length === 0) {
        orderTableBody.innerHTML = `<tr><td colspan="11" id="noOrdersMessage">No orders found matching your criteria.</td></tr>`;
    } else {
        const searchTermForHighlight = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';
        currentlyDisplayedOrders.forEach(order => {
            // Pass Firestore ID and order data to display function
            displayOrderRow(order.id, order, searchTermForHighlight);
        });
    }

    // Update Select All checkbox state based on displayed rows
    if (selectAllCheckbox) {
        const allRowCheckboxes = orderTableBody.querySelectorAll('.row-selector');
        const allVisibleSelected = allRowCheckboxes.length > 0 && Array.from(allRowCheckboxes).every(cb => selectedOrderIds.has(cb.dataset.id)); // Check against global set
        const someVisibleSelected = Array.from(allRowCheckboxes).some(cb => selectedOrderIds.has(cb.dataset.id));
        selectAllCheckbox.checked = allVisibleSelected;
        selectAllCheckbox.indeterminate = !allVisibleSelected && someVisibleSelected;
    }
}


function updateOrderCountsAndReport(displayedOrders) {
    const total = displayedOrders.length;
    let completedDelivered = 0;
    const statusCounts = {}; // Object to store counts for each status

    displayedOrders.forEach(order => {
        const status = order.status || 'Unknown';
        if (status === 'Completed' || status === 'Delivered') {
            completedDelivered++;
        }
        // Increment count for the status
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const pending = total - completedDelivered;

    // Update summary spans
    if (totalOrdersSpan) totalOrdersSpan.textContent = total;
    if (completedOrdersSpan) completedOrdersSpan.textContent = completedDelivered;
    if (pendingOrdersSpan) pendingOrdersSpan.textContent = pending;

    // Update reporting section
    if (statusCountsReportContainer) {
        if (total === 0) {
            statusCountsReportContainer.innerHTML = '<p>No orders to report.</p>';
        } else {
            let reportHtml = '<ul>';
            // Sort statuses alphabetically for consistent report order
            Object.keys(statusCounts).sort().forEach(status => {
                reportHtml += `<li>${escapeHtml(status)}: <strong>${statusCounts[status]}</strong></li>`;
            });
            reportHtml += '</ul>';
            statusCountsReportContainer.innerHTML = reportHtml;
        }
    }
}

// Utility to escape HTML special characters
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        // Attempt to convert non-strings safely
        try { unsafe = String(unsafe || ''); } catch(e) { unsafe = '';}
    }
    return unsafe.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#039;");
}

// Utility to highlight search term matches in text
function highlightMatch(text, term) {
    if (!term || !text) return escapeHtml(text); // Always escape
    const stringText = typeof text === 'string' ? text : String(text);
    const escapedText = escapeHtml(stringText); // Escape the original text first
    try {
        // Escape regex special characters in the search term
        const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(${escapedTerm})`, 'gi');
        // Replace matches in the *already escaped* text
        return escapedText.replace(regex, '<mark>$1</mark>');
    } catch (e) {
        console.warn("Highlighting regex error:", e);
        return escapedText; // Return escaped text if regex fails
    }
}


function displayOrderRow(firestoreId, data, searchTerm = '') {
    if (!orderTableBody || !data) return;

    const tableRow = document.createElement('tr');
    tableRow.setAttribute('data-id', firestoreId); // Set Firestore ID on the row
    if (selectedOrderIds.has(firestoreId)) {
        tableRow.classList.add('selected-row'); // Mark as selected if in the set
    }

    // Safely access nested customer details
    const customerDetails = data.customerDetails || {};
    const customerName = customerDetails.fullName || 'N/A';
    const customerMobile = customerDetails.whatsappNo || '-';

    // Format dates safely from Timestamp or string
    const formatDate = (dateInput) => {
        if (!dateInput) return '-';
        try {
            const date = (typeof dateInput.toDate === 'function') ? dateInput.toDate() : new Date(dateInput);
            if (isNaN(date.getTime())) return '-'; // Check if date is valid
            return date.toLocaleDateString('en-GB'); // Format as DD/MM/YYYY
        } catch (e) {
            console.warn("Error parsing date for display:", dateInput, e);
            return '-';
        }
    };
    const orderDateStr = formatDate(data.orderDate);
    const deliveryDateStr = formatDate(data.deliveryDate);

    // Prepare display ID and links
    const displayId = data.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`;
    const orderIdHtml = `<a href="#" class="order-id-link" data-id="${firestoreId}">${highlightMatch(displayId, searchTerm)}</a>`;
    // Note: customerName is already escaped by highlightMatch -> escapeHtml
    const customerNameHtml = `<a href="#" class="customer-name-link" data-id="${firestoreId}">${highlightMatch(customerName, searchTerm)}</a>`;

    const status = data.status || 'Unknown';
    const priority = data.urgent === 'Yes' ? 'Yes' : 'No';

    // Prepare products display (limited number)
    let productsHtml = '-';
    const products = data.products || [];
    const MAX_PRODUCTS_DISPLAY = 2; // Show max 2 products initially
    if (Array.isArray(products) && products.length > 0) {
        productsHtml = products.slice(0, MAX_PRODUCTS_DISPLAY).map(p => {
             const product = p || {};
             // Use highlightMatch which includes escapeHtml
             const name = highlightMatch(product.name || 'Unnamed', searchTerm);
             const quantity = highlightMatch(product.quantity || '?', searchTerm);
             return `${name} (${quantity})`;
         }).join('<br>');

        if (products.length > MAX_PRODUCTS_DISPLAY) {
             // Use firestoreId for the link
             productsHtml += `<br><a href="#" class="see-more-link" data-id="${firestoreId}">... (${products.length - MAX_PRODUCTS_DISPLAY} more)</a>`;
         }
    }

    // CSS classes for status and priority
    const statusClass = `status-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const priorityClass = priority === 'Yes' ? 'priority-yes' : 'priority-no';

    // Prepare PO Info display
     let poInfoHtml = '';
     const linkedPOs = data.linkedPOs || [];
     if (linkedPOs.length > 0) {
         poInfoHtml = linkedPOs.map(po => {
             if (!po || !po.poId) return ''; // Skip invalid PO links
             // Safely format PO date
             const poDate = po.createdAt && typeof po.createdAt.toDate === 'function'
                            ? po.createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                            : 'N/A';
             // Ensure poNumber is escaped
             const poNumberDisplay = escapeHtml(po.poNumber || 'N/A');
             return `<a href="#" class="view-po-details-link" data-poid="${escapeHtml(po.poId)}" title="View PO #${poNumberDisplay} Details">PO #${poNumberDisplay}</a> (${poDate})`;
         }).filter(html => html).join('<br>'); // Filter out empty strings
     } else {
         // Use icon only for create PO button, ensure firestoreId is passed
         poInfoHtml = `<button type="button" class="button create-po-button icon-only" data-id="${firestoreId}" title="Create Purchase Order"><i class="fas fa-file-alt"></i></button>`;
     }

    // --- Construct Table Row HTML ---
    try {
        tableRow.innerHTML = `
            <td class="col-checkbox"><input type="checkbox" class="row-selector" data-id="${firestoreId}" ${selectedOrderIds.has(firestoreId) ? 'checked' : ''}></td>
            <td>${orderIdHtml}</td>
            <td> <span class="customer-name-display">${customerNameHtml}</span> <span class="customer-mobile-inline">${highlightMatch(customerMobile, searchTerm)}</span> </td>
            <td>${productsHtml}</td>
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
        // Display an error row in the table
        const errorRow = document.createElement('tr');
        errorRow.innerHTML = `<td colspan="11" style="color: red; text-align: left;">Error displaying order: ${escapeHtml(firestoreId)}. Check console.</td>`;
        orderTableBody.appendChild(errorRow);
    }
}

// Open EDITABLE details modal
async function openDetailsModal(firestoreId, orderData) {
    if (!orderData || !detailsModal) return;
    activeOrderDataForModal = orderData; // Store data globally for modal actions

    // Populate basic info
    if(modalOrderIdInput) modalOrderIdInput.value = firestoreId;
    if(modalDisplayOrderIdSpan) modalDisplayOrderIdSpan.textContent = orderData.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`;
    if(modalCustomerNameSpan) modalCustomerNameSpan.textContent = orderData.customerDetails?.fullName || 'N/A';
    if(modalCustomerWhatsAppSpan) modalCustomerWhatsAppSpan.textContent = orderData.customerDetails?.whatsappNo || 'N/A';
    if(modalCustomerContactSpan) modalCustomerContactSpan.textContent = orderData.customerDetails?.contactNo || 'N/A';
    if(modalCustomerAddressSpan) modalCustomerAddressSpan.textContent = orderData.customerDetails?.address || 'N/A';

    // Format dates for display
    const formatDateForDisplay = (dateInput) => {
        if (!dateInput) return 'N/A';
        try {
            const date = (typeof dateInput.toDate === 'function') ? dateInput.toDate() : new Date(dateInput);
            if (isNaN(date.getTime())) return 'N/A';
            return date.toLocaleDateString('en-GB');
        } catch (e) { return 'N/A'; }
    };
    if(modalOrderDateSpan) modalOrderDateSpan.textContent = formatDateForDisplay(orderData.orderDate);
    if(modalDeliveryDateSpan) modalDeliveryDateSpan.textContent = formatDateForDisplay(orderData.deliveryDate);
    if(modalPrioritySpan) modalPrioritySpan.textContent = orderData.urgent || 'No';
    if(modalRemarksSpan) modalRemarksSpan.textContent = escapeHtml(orderData.remarks || 'None'); // Escape remarks

    // Display Product List
    if (modalProductListContainer) {
        modalProductListContainer.innerHTML = ''; // Clear previous
        const products = orderData.products;
        if (Array.isArray(products) && products.length > 0) {
            const ul = document.createElement('ul');
            ul.className = 'modal-product-list-ul';
            products.forEach(product => {
                const li = document.createElement('li');
                const nameSpan = document.createElement('span'); nameSpan.className = 'product-name'; nameSpan.textContent = escapeHtml(product.name || 'Unnamed Product');
                const detailsSpan = document.createElement('span'); detailsSpan.className = 'product-qty-details'; detailsSpan.textContent = ` - Qty: ${escapeHtml(product.quantity || '?')}`;
                li.append(nameSpan, detailsSpan);
                ul.appendChild(li);
            });
            modalProductListContainer.appendChild(ul);
        } else {
            modalProductListContainer.innerHTML = '<p class="no-products">No products listed.</p>';
        }
    }

    // Set current status in dropdown
    if(modalOrderStatusSelect) modalOrderStatusSelect.value = orderData.status || '';

    // Display Status History
    if (modalStatusHistoryListContainer) {
        modalStatusHistoryListContainer.innerHTML = ''; // Clear previous
        const history = orderData.statusHistory;
        if (Array.isArray(history) && history.length > 0) {
            // Sort history newest first
            const sortedHistory = [...history].sort((a, b) => {
                const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
                const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
                return timeB - timeA; // Descending order
            });

            const ul = document.createElement('ul'); ul.className = 'modal-status-history-ul';
            sortedHistory.forEach(entry => {
                const li = document.createElement('li');
                const statusSpan = document.createElement('span'); statusSpan.className = 'history-status'; statusSpan.textContent = escapeHtml(entry.status || '?');
                const timeSpan = document.createElement('span'); timeSpan.className = 'history-time';
                 if (entry.timestamp && entry.timestamp.toDate) {
                     try {
                         const d = entry.timestamp.toDate();
                         // Format: DD Mon HH:MM AM/PM
                         const timeFormat = { hour: 'numeric', minute: '2-digit', hour12: true };
                         const dateFormat = { day: 'numeric', month: 'short' };
                         timeSpan.textContent = `${d.toLocaleDateString('en-GB', dateFormat)} ${d.toLocaleTimeString('en-US', timeFormat)}`;
                     } catch (e) { timeSpan.textContent = '?'; }
                 } else { timeSpan.textContent = '?'; }
                li.append(statusSpan, timeSpan); ul.appendChild(li);
            });
            modalStatusHistoryListContainer.appendChild(ul);
        } else {
            modalStatusHistoryListContainer.innerHTML = '<p class="no-history">No status history.</p>';
        }
    }

    // Display Account Data (requires fields in Firestore)
    const totalAmount = orderData.totalAmount || 0;
    const amountPaid = orderData.amountPaid || 0;
    const balanceDue = totalAmount - amountPaid;
    const paymentStatus = orderData.paymentStatus || (balanceDue <= 0 && totalAmount > 0 ? 'Paid' : (totalAmount === 0 ? 'N/A' : 'Pending')); // Improved logic
    if(modalTotalAmountSpan) modalTotalAmountSpan.textContent = `₹ ${totalAmount.toFixed(2)}`;
    if(modalAmountPaidSpan) modalAmountPaidSpan.textContent = `₹ ${amountPaid.toFixed(2)}`;
    if(modalBalanceDueSpan) modalBalanceDueSpan.textContent = `₹ ${balanceDue.toFixed(2)}`;
    if(modalPaymentStatusSpan) modalPaymentStatusSpan.textContent = escapeHtml(paymentStatus);

    // Display POs linked to this order
    await displayPOsInModal(firestoreId, orderData.linkedPOs || []); // Reuse PO display logic

    // Show the modal
    if(detailsModal) detailsModal.style.display = 'flex';
}


async function displayPOsInModal(orderFirestoreId, linkedPOs) {
    if (!modalPOListContainer) return;
    modalPOListContainer.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading POs...</p>';

    if (!linkedPOs || linkedPOs.length === 0) {
        modalPOListContainer.innerHTML = '<p class="no-pos">No Purchase Orders linked to this order.</p>';
        return;
    }

    try {
        // Fetch details for each linked PO
        const poDetailsPromises = linkedPOs
            .filter(poLink => poLink && poLink.poId) // Filter out invalid links
            .map(poLink => getDoc(doc(db, "purchaseOrders", poLink.poId)).catch(err => {
                console.warn(`Failed to fetch PO ${poLink.poId}:`, err);
                return null; // Return null on error to avoid breaking Promise.all
            }));

        const poSnapshots = await Promise.all(poDetailsPromises);

        const ul = document.createElement('ul');
        ul.className = 'modal-po-list-ul';

        poSnapshots.forEach((poDoc, index) => {
            const poLink = linkedPOs[index]; // Assumes order is maintained
            if (!poLink || !poLink.poId) return; // Skip if original link was invalid

            const li = document.createElement('li');
            if (poDoc && poDoc.exists()) {
                const poData = poDoc.data();
                const poDate = poData.orderDate?.toDate ? poData.orderDate.toDate().toLocaleDateString('en-GB') : 'N/A';
                const supplierName = poData.supplierName || 'Unknown Supplier';
                const poNumber = poData.poNumber || 'N/A';
                const status = poData.status || 'N/A';
                const total = (poData.totalAmount || 0).toFixed(2);

                li.innerHTML = `
                    <a href="#" class="view-po-details-link" data-poid="${poDoc.id}">PO #${escapeHtml(poNumber)}</a>
                    <span> - ${escapeHtml(supplierName)} (${poDate})</span>
                    <span> - Status: ${escapeHtml(status)}</span>
                    <span> - Amount: ₹ ${total}</span>
                `;
                 // Add listener to the link within this specific li
                 const link = li.querySelector('.view-po-details-link');
                 if (link) {
                     link.addEventListener('click', (event) => {
                         event.preventDefault();
                         const poId = event.target.closest('a').dataset.poid;
                         if (poId) { openPODetailsPopup(poId); }
                     });
                 }
            } else {
                li.innerHTML = `<span>PO (ID: ${escapeHtml(poLink.poId)}) not found or error fetching</span>`;
                li.style.color = 'grey'; li.style.fontStyle = 'italic';
            }
            ul.appendChild(li);
        });

        modalPOListContainer.innerHTML = ''; // Clear loading message
        if (ul.children.length > 0) {
            modalPOListContainer.appendChild(ul);
        } else {
             modalPOListContainer.innerHTML = '<p class="no-pos">No valid Purchase Orders found.</p>'; // Handle case where all POs failed to load
        }

    } catch (error) {
        console.error("Error fetching PO details for modal:", error);
        modalPOListContainer.innerHTML = '<p class="error-message">Error loading POs.</p>';
    }
}

function closeDetailsModal() {
    if (detailsModal) detailsModal.style.display = 'none';
    activeOrderDataForModal = null; // Clear the global state when modal closes
}

// *** UPDATED FUNCTION ***
async function handleUpdateStatus() {
    const firestoreId = modalOrderIdInput.value;
    const newStatus = modalOrderStatusSelect.value;
    // Use a temporary variable to hold the data needed AFTER the update
    const orderDataForWhatsApp = activeOrderDataForModal;

    if (!firestoreId || !newStatus || !orderDataForWhatsApp) {
        alert("Cannot update status. Order data not loaded correctly.");
        return;
    }
    if (orderDataForWhatsApp.status === newStatus) {
        alert("Status is already set to '" + escapeHtml(newStatus) + "'.");
        return;
    }

    if (modalUpdateStatusBtn) {
        modalUpdateStatusBtn.disabled = true;
        modalUpdateStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    }

    // Use Timestamp.now() for the history entry timestamp for accuracy
    const historyEntry = { status: newStatus, timestamp: Timestamp.now() };

    try {
        // Perform the update
        await updateDoc(doc(db, "orders", firestoreId), {
            status: newStatus,
            updatedAt: serverTimestamp(), // Use server timestamp for document update time
            statusHistory: arrayUnion(historyEntry) // Add new history entry
        });

        // Check for WhatsApp AFTER successful update, using the temporary variable
        if (orderDataForWhatsApp.customerDetails?.whatsappNo) {
            showStatusUpdateWhatsAppReminder(
                orderDataForWhatsApp.customerDetails,
                orderDataForWhatsApp.orderId || `Sys:${firestoreId.substring(0,6)}`,
                newStatus
            );
            // Don't show the success alert if WhatsApp reminder is shown
        } else {
            alert("Status updated successfully!");
        }

        // *** MOVED THIS LINE ***
        // Close the modal AFTER potentially showing the WhatsApp reminder or alert
        closeDetailsModal();

    } catch (e) {
        console.error("Error updating status:", e);
        alert("Error updating status: " + e.message);
        // Ensure modal doesn't get stuck if error happens before close
        // Close it here too, maybe? Or leave it open for user to see state?
        // For now, we rely on the finally block to reset the button.
    } finally {
        // Always re-enable the button
        if (modalUpdateStatusBtn) {
            modalUpdateStatusBtn.disabled = false;
            modalUpdateStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Status';
        }
    }
}


function handleDeleteFromModal() {
    const firestoreId = modalOrderIdInput.value;
    const displayId = modalDisplayOrderIdSpan.textContent;
    if (!firestoreId) return;

    // Get confirmation
    if (confirm(`Are you sure you want to permanently delete Order ID: ${displayId}? This cannot be undone.`)) {
        // Close modal BEFORE deleting to avoid UI issues if delete fails
        closeDetailsModal();
        deleteSingleOrder(firestoreId); // Call the delete function
    } else {
        console.log("Deletion cancelled by user.");
    }
}

// Function to delete a single order
async function deleteSingleOrder(firestoreId) {
    if (!db || !firestoreId) {
        alert("Delete function is unavailable or Order ID is missing.");
        return;
    }
    console.log(`Attempting to delete order: ${firestoreId}`);
    try {
        await deleteDoc(doc(db, "orders", firestoreId));
        console.log(`Order ${firestoreId} deleted successfully.`);
        alert("Order deleted successfully.");
        // Data listener will automatically remove it from the table
    } catch (e) {
        console.error("Error deleting order:", firestoreId, e);
        alert("Error deleting order: " + e.message);
    }
}

function handleEditFullFromModal() {
    const firestoreId = modalOrderIdInput.value;
    if (firestoreId) {
        window.location.href = `new_order.html?editOrderId=${firestoreId}`;
    } else {
        alert("Cannot edit. Order ID not found.");
    }
}

function handleCreatePOFromModal() {
    const orderFirestoreId = modalOrderIdInput.value;
    if (orderFirestoreId && activeOrderDataForModal) {
        // Close the details modal BEFORE opening the PO selection modal
        closeDetailsModal();
        openPOItemSelectionModal(orderFirestoreId, activeOrderDataForModal);
    } else {
        alert("Cannot create PO. Order details not loaded correctly.");
    }
}

// WhatsApp Functions
function showStatusUpdateWhatsAppReminder(customer, orderId, updatedStatus) {
    if (!whatsappReminderPopup || !whatsappMsgPreview || !whatsappSendLink || !customer) {
        console.warn("WhatsApp reminder elements or customer data missing.");
        return; // Exit if elements aren't found
    }
    const name = customer.fullName || 'Customer';
    const rawNum = customer.whatsappNo || '';
    const num = rawNum.replace(/[^0-9]/g, ''); // Clean the number

    if (!num) {
        console.warn("WhatsApp number missing or invalid for reminder.");
        return; // Exit if no valid number
    }

    let msg = getWhatsAppMessageTemplate(updatedStatus, name, orderId, null); // Delivery date not needed here
    whatsappMsgPreview.innerText = msg; // Show preview

    // Construct WhatsApp URL (assuming Indian numbers if no country code)
    const url = `https://wa.me/91${num}?text=${encodeURIComponent(msg)}`;
    whatsappSendLink.href = url;

    // Update popup title and show it
    const title = document.getElementById('whatsapp-popup-title');
    if(title) title.textContent = "Status Updated!"; // Set appropriate title
    whatsappReminderPopup.classList.add('active'); // Display the popup
}

function closeWhatsAppPopup() {
    if (whatsappReminderPopup) {
        whatsappReminderPopup.classList.remove('active'); // Hide the popup
    }
}

function sendWhatsAppMessage(firestoreId, orderData) {
    if (!orderData?.customerDetails?.whatsappNo) {
        alert("WhatsApp number not found for this order.");
        return;
    }
    const cust = orderData.customerDetails;
    const orderIdForMsg = orderData.orderId || `Sys:${firestoreId.substring(0,6)}`;
    const status = orderData.status;
    const deliveryDate = orderData.deliveryDate; // Pass delivery date if available
    const name = cust.fullName || 'Customer';
    const rawNum = cust.whatsappNo;
    const num = rawNum.replace(/[^0-9]/g, ''); // Clean number

    if (!num) {
         alert("Invalid WhatsApp number format.");
         return;
    }

    let msg = getWhatsAppMessageTemplate(status, name, orderIdForMsg, deliveryDate); // Generate message
    const url = `https://wa.me/91${num}?text=${encodeURIComponent(msg)}`; // Create URL
    window.open(url, '_blank'); // Open in new tab
}

// Generates WhatsApp message based on status
function getWhatsAppMessageTemplate(status, customerName, orderId, deliveryDate) {
    const namePlaceholder = "[Customer Name]";
    const orderNoPlaceholder = "[ORDER_NO]";
    const deliveryDatePlaceholder = "[DELIVERY_DATE]";
    const companyName = "Madhav Offset";
    const companyAddress = "Head Office: Moodh Market, Batadu";
    const companyMobile = "9549116541";
    const signature = `धन्यवाद,\n${companyName}\n${companyAddress}\nMobile: ${companyMobile}`;

    let template = "";
    let deliveryDateText = "जल्द से जल्द"; // Default delivery text

    // Format delivery date if available
    try {
        if(deliveryDate) {
            const dDate = (typeof deliveryDate.toDate === 'function') ? deliveryDate.toDate() : new Date(deliveryDate);
             if (!isNaN(dDate.getTime())) { // Check if date is valid
                deliveryDateText = dDate.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
             }
        }
    } catch(e) { console.warn("Could not format delivery date for WhatsApp", e); }

    // Utility to replace placeholders
    function replaceAll(str, find, replace) {
        // Basic replaceAll simulation
        try {
             return str.split(find).join(replace);
        } catch { return str; } // Return original string on error
    }

    // Templates for different statuses
    switch (status) {
        case "Order Received":
            template = `प्रिय ${namePlaceholder},\nनमस्कार,\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) हमें सफलतापूर्वक प्राप्त हो गया है।\nहम इस ऑर्डर को ${deliveryDatePlaceholder} तक पूर्ण करने का प्रयास करेंगे।\n\nDear ${namePlaceholder},\nWe have successfully received your order (Order No: ${orderNoPlaceholder}).\nWe aim to complete it by ${deliveryDatePlaceholder}.`;
            break;
        case "Designing":
            template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) का डिज़ाइन तैयार किया जा रहा है।\nजैसे ही डिज़ाइन तैयार होगा, हम आपसे पुष्टि के लिए संपर्क करेंगे।\n\nDear ${namePlaceholder},\nThe design for your order (Order No: ${orderNoPlaceholder}) is in progress.\nWe’ll contact you for confirmation once it’s ready.`;
            break;
        case "Verification":
            template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की डिज़ाइन आपके साथ साझा कर दी गई है।\nकृपया डिज़ाइन को ध्यानपूर्वक जाँचे और हमें अपनी अनुमति प्रदान करें।\nएक बार ‘OK’ कर देने के बाद किसी भी प्रकार का संशोधन संभव नहीं होगा।\n\nDear ${namePlaceholder},\nWe have shared the design for your order (Order No: ${orderNoPlaceholder}) with you.\nPlease review it carefully and provide your approval.\nOnce you confirm with ‘OK’, no further changes will be possible.`;
            break;
        case "Design Approved":
            template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की डिज़ाइन स्वीकृत कर दी गई है।\nअब यह प्रिंटिंग प्रक्रिया के लिए आगे बढ़ाया जा रहा है।\n\nDear ${namePlaceholder},\nYour design for Order No: ${orderNoPlaceholder} has been approved.\nIt is now moving forward to the printing stage.`;
            break;
        case "Ready for Working": // Changed from "Ready for Pickup" based on user's status list
             template = `प्रिय ${namePlaceholder},\nनमस्कार,\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की प्रिंटिंग पूरी हो गई है।\nआप ऑफिस/कार्यालय आकर अपना प्रोडक्ट ले जा सकते हैं।\n\nDear ${namePlaceholder},\nThe printing for your order (Order No: ${orderNoPlaceholder}) is complete.\nYou can now collect your product from our office.`;
            break;
        case "Printing":
            template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) प्रिंट हो रहा है।\nपूरा होते ही आपको सूचित किया जाएगा।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) is currently being printed.\nWe will notify you once it’s done.`;
            break;
        case "Delivered":
            template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) सफलतापूर्वक डिलीवर कर दिया गया है।\nकृपया पुष्टि करें कि आपने ऑर्डर प्राप्त कर लिया है।\nआपके सहयोग के लिए धन्यवाद।\nहमें आशा है कि आप हमें शीघ्र ही फिर से सेवा का अवसर देंगे।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) has been successfully delivered.\nPlease confirm the receipt.\nThank you for your support.\nWe hope to have the opportunity to serve you again soon.`;
            break;
        case "Completed":
             template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) सफलतापूर्वक पूर्ण हो चुका है।\nआपके सहयोग के लिए धन्यवाद।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) has been successfully completed.\nThank you for your support.`;
            break;
        default: // Fallback for any other status
            template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) का वर्तमान स्टेटस है: ${status}.\n\nDear ${namePlaceholder},\nThe current status for your order (Order No: ${orderNoPlaceholder}) is: ${status}.`;
    }

    // Replace placeholders in the chosen template
    let message = replaceAll(template, namePlaceholder, customerName);
    message = replaceAll(message, orderNoPlaceholder, orderId);
    message = replaceAll(message, deliveryDatePlaceholder, deliveryDateText);
    message += `\n\n${signature}`; // Add signature
    return message;
}


// Bulk Actions
function handleSelectAllChange(event) {
    const isChecked = event.target.checked;
    const rowsCheckboxes = orderTableBody.querySelectorAll('.row-selector'); // Get only visible checkboxes

    rowsCheckboxes.forEach(cb => {
        const id = cb.dataset.id;
        if (id) {
             cb.checked = isChecked; // Update checkbox state
             const row = cb.closest('tr');
             if (isChecked) {
                 selectedOrderIds.add(id); // Add to global set
                 if (row) row.classList.add('selected-row');
             } else {
                 selectedOrderIds.delete(id); // Remove from global set
                 if (row) row.classList.remove('selected-row');
             }
        }
    });
    updateBulkActionsBar(); // Update the UI
}

function handleRowCheckboxChange(checkbox, firestoreId) {
    const row = checkbox.closest('tr');
    if (checkbox.checked) {
        selectedOrderIds.add(firestoreId);
        if(row) row.classList.add('selected-row');
    } else {
        selectedOrderIds.delete(firestoreId);
        if(row) row.classList.remove('selected-row');
    }
    updateBulkActionsBar(); // Update counts and button states

    // Update "Select All" checkbox state (checked, indeterminate, or unchecked)
    if (selectAllCheckbox) {
        const allVisibleCheckboxes = orderTableBody.querySelectorAll('.row-selector');
        const totalVisible = allVisibleCheckboxes.length;
        const numSelectedVisible = Array.from(allVisibleCheckboxes).filter(cb => selectedOrderIds.has(cb.dataset.id)).length;

        if (totalVisible === 0) {
             selectAllCheckbox.checked = false;
             selectAllCheckbox.indeterminate = false;
        } else if (numSelectedVisible === totalVisible) {
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

function updateBulkActionsBar() {
    const count = selectedOrderIds.size;
    if (bulkActionsBar && selectedCountSpan && bulkUpdateStatusBtn && bulkDeleteBtn) {
        if (count > 0) {
            selectedCountSpan.textContent = `${count} item${count > 1 ? 's' : ''} selected`;
            bulkActionsBar.style.display = 'flex'; // Show bar
            // Enable update button only if a status is selected
            bulkUpdateStatusBtn.disabled = !(bulkStatusSelect && bulkStatusSelect.value);
            bulkDeleteBtn.disabled = false; // Enable delete button
        } else {
            bulkActionsBar.style.display = 'none'; // Hide bar
            if (bulkStatusSelect) bulkStatusSelect.value = ''; // Reset status dropdown
            bulkUpdateStatusBtn.disabled = true;
            bulkDeleteBtn.disabled = true;
        }
    }
}

// Open bulk delete confirmation modal
async function handleBulkDelete() {
    const idsToDelete = Array.from(selectedOrderIds);
    const MAX_DELETE_LIMIT = 5; // Keep limit reasonable

    if (idsToDelete.length === 0) {
        alert("Please select orders to delete.");
        return;
    }
     if (idsToDelete.length > MAX_DELETE_LIMIT) {
        alert(`You can delete a maximum of ${MAX_DELETE_LIMIT} orders at once.`);
        return;
    }

    // Check if modal elements exist
    if (!bulkDeleteConfirmModal || !bulkDeleteOrderList || !confirmDeleteCheckbox || !confirmBulkDeleteBtn || !bulkDeleteCountSpan) {
         console.error("Bulk delete modal elements not found.");
         return;
     }

    // Populate the list of orders to be deleted in the modal
    bulkDeleteOrderList.innerHTML = ''; // Clear previous list
    const maxItemsToShow = 100; // Limit displayed items for performance
    idsToDelete.forEach((id, index) => {
        if (index < maxItemsToShow) {
            const order = findOrderInCache(id); // Get data from cache
            const displayId = order?.orderId || `Sys:${id.substring(0,6)}`;
            const customerName = order?.customerDetails?.fullName || 'N/A';
            const li = document.createElement('li');
            li.innerHTML = `<strong>${escapeHtml(displayId)}</strong> - ${escapeHtml(customerName)}`;
            bulkDeleteOrderList.appendChild(li);
        }
    });
    if (idsToDelete.length > maxItemsToShow) {
         const li = document.createElement('li');
         li.textContent = `... and ${idsToDelete.length - maxItemsToShow} more orders.`;
         bulkDeleteOrderList.appendChild(li);
     }

    // Show modal and reset confirmation state
    bulkDeleteCountSpan.textContent = idsToDelete.length;
    confirmDeleteCheckbox.checked = false;
    confirmBulkDeleteBtn.disabled = true; // Disable confirm button initially
    bulkDeleteConfirmModal.style.display = 'flex'; // Show the modal
}

// Perform the actual bulk delete after confirmation
async function executeBulkDelete(idsToDelete) {
    if (!db || idsToDelete.length === 0) return;

    // Disable buttons during operation
    if(bulkDeleteBtn) bulkDeleteBtn.disabled = true;
    if(confirmBulkDeleteBtn) {
        confirmBulkDeleteBtn.disabled = true;
        confirmBulkDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    }

    // Use Firestore batch write for atomic delete
    const batch = writeBatch(db);
    idsToDelete.forEach(id => {
        const docRef = doc(db, "orders", id);
        batch.delete(docRef);
    });

    try {
        await batch.commit(); // Execute the batch delete
        alert(`${idsToDelete.length} order(s) deleted successfully.`);
        selectedOrderIds.clear(); // Clear selection set
        updateBulkActionsBar(); // Update UI
        closeBulkDeleteModal(); // Close confirmation modal
    } catch (e) {
        console.error("Bulk delete error:", e);
        alert(`Error deleting orders: ${e.message}`);
        // Re-enable buttons on error so user can retry if needed
        if(bulkDeleteBtn) bulkDeleteBtn.disabled = false; // Re-enable main delete button
    } finally {
        // Always reset the confirmation button state
        if(confirmBulkDeleteBtn) {
            confirmBulkDeleteBtn.disabled = false; // Should be re-enabled based on checkbox state
            confirmBulkDeleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Orders';
        }
         updateBulkActionsBar(); // Ensure bar state is correct
    }
}

function closeBulkDeleteModal() {
    if (bulkDeleteConfirmModal) {
        bulkDeleteConfirmModal.style.display = 'none';
    }
}

// Perform bulk status update
async function handleBulkUpdateStatus() {
    const idsToUpdate = Array.from(selectedOrderIds);
    const newStatus = bulkStatusSelect.value;
    const MAX_STATUS_UPDATE_LIMIT = 10; // Keep limit reasonable

    if (idsToUpdate.length === 0) { alert("Please select orders to update."); return; }
    if (idsToUpdate.length > MAX_STATUS_UPDATE_LIMIT) { alert(`You can update the status of a maximum of ${MAX_STATUS_UPDATE_LIMIT} orders at once.`); return; }
    if (!newStatus) { alert("Please select a status to update to."); return; }

    // Get confirmation
    if (!confirm(`Are you sure you want to change the status of ${idsToUpdate.length} selected order(s) to "${escapeHtml(newStatus)}"?`)) {
        return; // Cancel if user clicks No
    }

    // Disable button during operation
    if (bulkUpdateStatusBtn) {
        bulkUpdateStatusBtn.disabled = true;
        bulkUpdateStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    }

    const batch = writeBatch(db);
    // Create a single history entry object to add to all orders
    const historyEntry = { status: newStatus, timestamp: Timestamp.now() }; // Use Timestamp.now()

    // Prepare updates for the batch
    idsToUpdate.forEach(id => {
        const docRef = doc(db, "orders", id);
        batch.update(docRef, {
            status: newStatus,
            updatedAt: serverTimestamp(), // Update modification time
            statusHistory: arrayUnion(historyEntry) // Add history entry
        });
    });

    try {
        await batch.commit(); // Execute the batch update
        alert(`${idsToUpdate.length} order(s) status updated to "${escapeHtml(newStatus)}".`);
        selectedOrderIds.clear(); // Clear selection
        if (bulkStatusSelect) bulkStatusSelect.value = ''; // Reset dropdown
        updateBulkActionsBar(); // Update UI
    } catch (e) {
        console.error("Bulk status update error:", e);
        alert(`Error updating status: ${e.message}`);
    } finally {
        // Always re-enable the button
        if (bulkUpdateStatusBtn) {
            bulkUpdateStatusBtn.disabled = true; // Keep disabled until a status is selected again
            bulkUpdateStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Selected (Max 10)';
        }
         updateBulkActionsBar(); // Ensure bar state is correct
    }
}


// CSV Export
function exportToCsv() {
    if (currentlyDisplayedOrders.length === 0) {
        alert("No data currently displayed to export.");
        return;
    }

    // Define headers
    const headers = [
        "Firestore ID", "Order ID", "Customer Name", "WhatsApp No", "Contact No", "Address",
        "Order Date", "Delivery Date", "Status", "Urgent", "Remarks",
        "Total Amount", "Amount Paid", "Payment Status", "Products (Name | Qty)"
    ];

    // Map displayed order data to rows
    const rows = currentlyDisplayedOrders.map(order => {
        // Safely format dates
        const formatCsvDate = (dateInput) => {
             if (!dateInput) return '';
             try {
                 const date = (typeof dateInput.toDate === 'function') ? dateInput.toDate() : new Date(dateInput);
                 if (isNaN(date.getTime())) return '';
                 // Format as YYYY-MM-DD for better CSV compatibility
                 const month = String(date.getMonth() + 1).padStart(2, '0');
                 const day = String(date.getDate()).padStart(2, '0');
                 return `${date.getFullYear()}-${month}-${day}`;
             } catch { return ''; }
         };

        // Format products string
        const productsString = (order.products || [])
            .map(p => `${String(p.name || '').replace(/\|/g, '')}|${String(p.quantity || '')}`) // Avoid pipes in product name
            .join('; '); // Separate products with semicolon

        // Return array of values for the row
        return [
            order.id,
            order.orderId || '',
            order.customerDetails?.fullName || '',
            order.customerDetails?.whatsappNo || '', // Keep numbers as strings
            order.customerDetails?.contactNo || '',
            order.customerDetails?.address || '',
            formatCsvDate(order.orderDate),
            formatCsvDate(order.deliveryDate),
            order.status || '',
            order.urgent || 'No',
            order.remarks || '',
            order.totalAmount || 0,
            order.amountPaid || 0,
            order.paymentStatus || 'Pending',
            productsString
        ];
    });

    // Function to escape CSV fields containing commas, quotes, or newlines
    const escapeCsvField = (field) => {
        const stringField = String(field ?? ''); // Handle null/undefined
        // If field contains comma, newline, or quote, enclose in double quotes and escape internal quotes
        if (stringField.includes(',') || stringField.includes('\n') || stringField.includes('"')) {
            return `"${stringField.replace(/"/g, '""')}"`;
        }
        return stringField;
    };

    // Combine headers and rows into CSV string
    const csvHeader = headers.map(escapeCsvField).join(",") + "\n";
    const csvRows = rows.map(row => row.map(escapeCsvField).join(",")).join("\n");
    const csvContent = csvHeader + csvRows;

    // Create Blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    link.setAttribute("download", `orders_export_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click(); // Trigger download
    document.body.removeChild(link); // Clean up
    URL.revokeObjectURL(url); // Release object URL
}


// Attempt Open Modal from URL parameter
function attemptOpenModalFromUrl() {
    // Only attempt if an ID is present, data is loaded, and modal hasn't been opened from URL yet
    if (orderIdToOpenFromUrl && allOrdersCache.length > 0 && !modalOpenedFromUrl) {
        const orderWrapper = allOrdersCache.find(o => o.id === orderIdToOpenFromUrl);
        if (orderWrapper) {
            console.log(`Opening read-only modal for order ID from URL: ${orderIdToOpenFromUrl}`);
            openReadOnlyOrderPopup(orderIdToOpenFromUrl, orderWrapper.data); // Open read-only modal
            modalOpenedFromUrl = true; // Mark as opened

            // Clean up URL parameter
            try {
                const url = new URL(window.location);
                url.searchParams.delete('openModalForId');
                // Also optionally remove status filter if desired
                // url.searchParams.delete('status');
                window.history.replaceState({}, '', url.toString());
            } catch(e) {
                // Fallback if URL manipulation fails
                window.history.replaceState(null, '', window.location.pathname + window.location.hash); // Keep hash if present
            }
            orderIdToOpenFromUrl = null; // Clear the ID state
        } else {
             console.warn(`Order ID ${orderIdToOpenFromUrl} from URL not found in cache.`);
             orderIdToOpenFromUrl = null; // Clear ID if not found
             modalOpenedFromUrl = true; // Prevent repeated attempts for non-existent ID
         }
    }
}


// PO Creation Functions
function openPOItemSelectionModal(orderFirestoreId, orderData) {
    // Ensure modal elements are present
    if (!poItemSelectionModal || !poItemSelectionOrderIdInput || !poItemSelectionDisplayOrderIdSpan || !poItemSelectionListContainer || !proceedToCreatePOBtn || !poSupplierSearchInput) {
        console.error("PO Item Selection Modal elements missing.");
        alert("Cannot open PO item selection popup.");
        return;
    }
    // Ensure order data and products exist
    if (!orderData || !orderData.products || orderData.products.length === 0) {
        alert("No products found in this order to create a PO for.");
        return;
    }

    // Reset modal state
    poItemSelectionOrderIdInput.value = orderFirestoreId;
    poItemSelectionDisplayOrderIdSpan.textContent = orderData.orderId || `Sys:${orderFirestoreId.substring(0,6)}`;
    poItemSelectionListContainer.innerHTML = ''; // Clear previous items
    poSupplierSearchInput.value = ''; // Clear supplier search
    poSelectedSupplierIdInput.value = ''; // Clear hidden fields
    poSelectedSupplierNameInput.value = '';
    if(poSupplierSuggestionsDiv) poSupplierSuggestionsDiv.style.display = 'none'; // Hide suggestions
    showPOItemError(''); // Clear previous errors

    // Populate item list (check if item is already in a PO - basic check needed)
    // TODO: Enhance `isAlreadyInPO` check based on actual PO data structure
    let availableItems = 0;
    orderData.products.forEach((product, index) => {
        const isAlreadyInPO = false; // Placeholder for future check
        const div = document.createElement('div');
        div.className = 'item-selection-entry';
        div.innerHTML = `
            <input type="checkbox" id="poItem_${index}" name="poItems" value="${index}" data-product-index="${index}" ${isAlreadyInPO ? 'disabled' : ''}>
            <label for="poItem_${index}">
                <strong>${escapeHtml(product.name || 'Unnamed Product')}</strong> (Qty: ${escapeHtml(product.quantity || '?')})
                ${isAlreadyInPO ? '<span class="in-po-label">(In PO)</span>' : ''}
            </label>`;
        poItemSelectionListContainer.appendChild(div);
        if (!isAlreadyInPO) availableItems++;
    });

    // Handle case where no items are available
    if (availableItems === 0) {
        poItemSelectionListContainer.innerHTML = '<p>All items are already included in existing Purchase Orders or no items available.</p>';
        proceedToCreatePOBtn.disabled = true; // Disable proceed button
    } else {
        proceedToCreatePOBtn.disabled = true; // Disable initially, enable on selection + supplier
    }

    poItemSelectionModal.classList.add('active'); // Show the modal
}

function closePoItemSelectionModal() {
    if (poItemSelectionModal) {
        poItemSelectionModal.classList.remove('active');
    }
    showPOItemError(''); // Clear any errors when closing
}

function showPOItemError(message) {
    if (poItemSelectionError) {
        poItemSelectionError.textContent = message;
        poItemSelectionError.style.display = message ? 'block' : 'none';
    }
}

// Update proceed button state based on item selection and supplier selection
function handlePOItemCheckboxChange() {
    if (!poItemSelectionListContainer || !proceedToCreatePOBtn || !poSelectedSupplierIdInput) return;
    const selectedCheckboxes = poItemSelectionListContainer.querySelectorAll('input[name="poItems"]:checked:not(:disabled)');
    const supplierSelected = !!poSelectedSupplierIdInput.value; // Check if supplier ID is set
    // Enable button only if at least one item is checked AND a supplier is selected
    proceedToCreatePOBtn.disabled = !(selectedCheckboxes.length > 0 && supplierSelected);
}

// Handle supplier search input
function handlePOSupplierSearchInput() {
    if (!poSupplierSearchInput || !poSupplierSuggestionsDiv || !poSelectedSupplierIdInput || !poSelectedSupplierNameInput) return;
    clearTimeout(supplierSearchDebounceTimerPO); // Debounce input
    const searchTerm = poSupplierSearchInput.value.trim();

    // Clear selected supplier if user modifies search input
    poSelectedSupplierIdInput.value = '';
    poSelectedSupplierNameInput.value = '';
    handlePOItemCheckboxChange(); // Update button state as supplier is cleared

    if (searchTerm.length < 1) { // Min length to trigger search (adjust if needed)
        if(poSupplierSuggestionsDiv){
             poSupplierSuggestionsDiv.innerHTML = '';
             poSupplierSuggestionsDiv.style.display = 'none'; // Hide suggestions
         }
        return;
    }
    // Fetch suggestions after a short delay
    supplierSearchDebounceTimerPO = setTimeout(() => {
        fetchPOSupplierSuggestions(searchTerm);
    }, 350);
}

// Fetch supplier suggestions from Firestore
async function fetchPOSupplierSuggestions(searchTerm) {
    if (!poSupplierSuggestionsDiv || !db) return;
    poSupplierSuggestionsDiv.innerHTML = '<div>Loading...</div>'; // Show loading state
    poSupplierSuggestionsDiv.style.display = 'block';
    const searchTermLower = searchTerm.toLowerCase();

    try {
        // Query suppliers matching the search term (case-insensitive)
        // Using name_lowercase requires having this field in your Firestore documents
        // Alternatively, use client-side filtering if name_lowercase isn't available
        const q = query(
            collection(db, "suppliers"),
            orderBy("name_lowercase"), // Assumes you have a lowercase name field
            where("name_lowercase", ">=", searchTermLower),
            where("name_lowercase", "<=", searchTermLower + '\uf8ff'), // Firestore trick for prefix search
            limit(10) // Limit results
        );
        const querySnapshot = await getDocs(q);
        poSupplierSuggestionsDiv.innerHTML = ''; // Clear loading/previous suggestions

        if (querySnapshot.empty) {
            poSupplierSuggestionsDiv.innerHTML = '<div class="no-suggestions">No matching suppliers found.</div>';
        } else {
            querySnapshot.forEach((docSnapshot) => {
                const supplier = docSnapshot.data();
                const supplierId = docSnapshot.id;
                const div = document.createElement('div');
                // Display name and optional company name
                div.textContent = `${supplier.name}${supplier.companyName ? ` (${supplier.companyName})` : ''}`;
                div.dataset.id = supplierId;
                div.dataset.name = supplier.name; // Store name for setting input value
                div.style.cursor = 'pointer';

                // Use 'mousedown' to select before 'blur' hides the list
                div.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // Prevent input blur
                    if(poSupplierSearchInput) poSupplierSearchInput.value = supplier.name; // Set display name
                    if(poSelectedSupplierIdInput) poSelectedSupplierIdInput.value = supplierId; // Set hidden ID
                    if(poSelectedSupplierNameInput) poSelectedSupplierNameInput.value = supplier.name; // Set hidden name
                    if(poSupplierSuggestionsDiv) poSupplierSuggestionsDiv.style.display = 'none'; // Hide suggestions
                    handlePOItemCheckboxChange(); // Update proceed button state
                });
                poSupplierSuggestionsDiv.appendChild(div);
            });
        }
    } catch (error) {
        console.error("Error fetching PO supplier suggestions:", error);
        poSupplierSuggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Error fetching suppliers.</div>';
    }
}

// Proceed to create PO page with selected data
function handleProceedToCreatePO() {
    const orderFirestoreId = poItemSelectionOrderIdInput.value;
    const selectedSupplierId = poSelectedSupplierIdInput.value;
    const selectedSupplierName = poSelectedSupplierNameInput.value; // Get supplier name

    if (!orderFirestoreId || !selectedSupplierId || !selectedSupplierName) {
        showPOItemError("Missing Order ID or Supplier Selection.");
        return;
    }

    // Get indices of selected items
    const selectedItemsIndices = Array.from(poItemSelectionListContainer.querySelectorAll('input[name="poItems"]:checked:not(:disabled)'))
                                      .map(cb => parseInt(cb.value));

    if (selectedItemsIndices.length === 0) {
        showPOItemError("Please select at least one item for the PO.");
        return;
    }

    // Construct URL parameters for new_po.html
    const params = new URLSearchParams();
    params.append('sourceOrderId', orderFirestoreId);
    params.append('supplierId', selectedSupplierId);
    params.append('supplierName', selectedSupplierName); // Pass supplier name
    params.append('itemIndices', selectedItemsIndices.join(',')); // Pass selected item indices

    // Redirect to new PO page
    window.location.href = `new_po.html?${params.toString()}`;
    closePoItemSelectionModal(); // Close the modal after redirecting
}


// PO Details Popup Functions
async function openPODetailsPopup(poId) {
    if (!poDetailsPopup || !poDetailsPopupContent || !db || !poId) return;

    poDetailsPopupContent.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading PO details...</p>';
    poDetailsPopup.classList.add('active'); // Show popup

    try {
        const poRef = doc(db, "purchaseOrders", poId);
        const poDocSnap = await getDoc(poRef);

        if (!poDocSnap.exists()) {
            throw new Error(`Purchase Order with ID ${poId} not found.`);
        }
        const poData = poDocSnap.data();

        // Prepare data for display
        const supplierName = poData.supplierName || 'Unknown Supplier';
        const poNumberDisplay = poData.poNumber ? `#${poData.poNumber}` : 'N/A';
        let orderDateStr = poData.orderDate?.toDate ? poData.orderDate.toDate().toLocaleDateString('en-GB') : 'N/A';
        const status = poData.status || 'N/A';
        const totalAmount = (poData.totalAmount || 0).toFixed(2);

        // Construct HTML for the popup content
        let popupHTML = `
            <div class="po-details-popup-header">
                <h3>Purchase Order ${escapeHtml(poNumberDisplay)}</h3>
                <p><strong>Supplier:</strong> ${escapeHtml(supplierName)}</p>
                <p><strong>Order Date:</strong> ${orderDateStr}</p>
                <p><strong>Status:</strong> ${escapeHtml(status)}</p>
                <p><strong>Total Amount:</strong> ₹ ${totalAmount}</p>
            </div>
            <hr>
            <h4>Items</h4>`;

        // Add items table if items exist
        if (poData.items && poData.items.length > 0) {
            popupHTML += `<table class="details-table-popup">
                            <thead>
                                <tr><th>#</th><th>Product</th><th>Details</th><th>Rate</th><th>Amount</th></tr>
                            </thead>
                            <tbody>`;
            poData.items.forEach((item, index) => {
                let detailStr = '';
                const qty = item.quantity || '?';
                // Handle different item types if necessary (e.g., Sq Feet)
                if (item.type === 'Sq Feet') {
                     const w = item.realWidth || item.width || '?';
                     const h = item.realHeight || item.height || '?';
                     const u = item.unit || item.inputUnit || 'units';
                     detailStr = `Qty: ${escapeHtml(qty)} (${escapeHtml(w)}x${escapeHtml(h)} ${escapeHtml(u)})`;
                } else {
                     detailStr = `Qty: ${escapeHtml(qty)}`;
                 }
                const rate = item.rate?.toFixed(2) ?? 'N/A';
                const itemAmount = item.itemAmount?.toFixed(2) ?? 'N/A';
                const productName = escapeHtml(item.productName || 'N/A');

                popupHTML += `<tr>
                                <td>${index + 1}</td>
                                <td>${productName}</td>
                                <td>${detailStr}</td>
                                <td>${rate}</td>
                                <td align="right">${itemAmount}</td>
                              </tr>`;
            });
            popupHTML += `</tbody></table>`;
        } else {
            popupHTML += `<p>No items found for this PO.</p>`;
        }

        // Add notes if they exist
        if (poData.notes) {
            popupHTML += `<div class="po-notes-popup">
                            <strong>Notes:</strong>
                            <p>${escapeHtml(poData.notes).replace(/\n/g, '<br>')}</p>
                          </div>`;
        }

        poDetailsPopupContent.innerHTML = popupHTML; // Set the generated HTML
        // Store PO ID for printing if needed
        if(printPoDetailsPopupBtn) printPoDetailsPopupBtn.dataset.poid = poId;

    } catch (error) {
        console.error("Error loading PO details into popup:", error);
        poDetailsPopupContent.innerHTML = `<p class="error-message">Error loading PO details: ${escapeHtml(error.message)}</p>`;
    }
}

function closePODetailsPopup() {
    if (poDetailsPopup) {
        poDetailsPopup.classList.remove('active');
    }
}

// Handle printing the PO details popup content
function handlePrintPODetailsPopup(event) {
    const contentElement = document.getElementById('poDetailsPopupContent');
    if (!contentElement) return;

    // Create a temporary iframe or window for printing
    const printWindow = window.open('', '_blank');
    // Write HTML structure with basic styles for printing
    printWindow.document.write(`
        <html>
        <head>
            <title>Print PO Details</title>
            <style>
                body { font-family: sans-serif; margin: 20px; }
                h3, h4 { margin-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                th, td { border: 1px solid #ccc; padding: 5px; text-align: left; font-size: 0.9em;}
                th { background-color: #f2f2f2; }
                .po-notes-popup { margin-top: 15px; border: 1px solid #eee; padding: 10px; font-size: 0.9em; white-space: pre-wrap;}
                p { margin: 5px 0; }
                strong { font-weight: bold; }
            </style>
        </head>
        <body>
            ${contentElement.innerHTML}
        </body>
        </html>`);
    printWindow.document.close(); // Necessary for some browsers
    printWindow.focus(); // Focus the new window/tab

    // Use timeout to allow content to render before printing
    setTimeout(() => {
        try {
            printWindow.print();
        } catch (e) {
             console.error("Print error:", e);
             alert("Could not initiate print.");
        } finally {
            // Close print window automatically after print dialog appears/closes
             // Add slight delay before closing
             setTimeout(() => { printWindow.close(); }, 200);
        }
    }, 500); // Delay might need adjustment
}


// Read-Only Order Details Popup Functions
function openReadOnlyOrderPopup(firestoreId, orderData) {
    // Ensure modal elements and data exist
    if (!readOnlyOrderModal || !readOnlyOrderModalContent || !readOnlyOrderModalTitle || !orderData) {
        console.error("Read-only modal elements or order data missing.");
        return;
    }

    // Set title and show loading state
    readOnlyOrderModalTitle.textContent = `Order Details: #${escapeHtml(orderData.orderId || firestoreId.substring(0,6))}`;
    readOnlyOrderModalContent.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading...</p>';
    readOnlyOrderModal.classList.add('active'); // Show the modal

    // --- Build HTML Content ---
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
         try {
             const d = (typeof dateInput.toDate === 'function') ? dateInput.toDate() : new Date(dateInput);
             if (isNaN(d.getTime())) return 'N/A';
             return d.toLocaleDateString('en-GB');
         } catch { return 'N/A'; }
     };
    contentHTML += '<div class="read-only-section"><h4>Order Info</h4>';
    contentHTML += `<p><strong>Order Date:</strong> ${formatDateRO(orderData.orderDate)}</p>`;
    contentHTML += `<p><strong>Delivery Date:</strong> ${formatDateRO(orderData.deliveryDate)}</p>`;
    contentHTML += `<p><strong>Priority:</strong> ${escapeHtml(orderData.urgent || 'No')}</p>`;
    contentHTML += `<p><strong>Status:</strong> ${escapeHtml(orderData.status || 'N/A')}</p>`;
    contentHTML += `<p><strong>Remarks:</strong> ${escapeHtml(orderData.remarks || 'None')}</p></div>`;

    // Products Section
    contentHTML += '<div class="read-only-section read-only-products"><h4>Products</h4>';
    if (orderData.products && orderData.products.length > 0) {
        contentHTML += '<ul class="read-only-product-list">';
        orderData.products.forEach(p => {
            contentHTML += `<li><strong>${escapeHtml(p.name || 'Unnamed')}</strong> - Qty: ${escapeHtml(p.quantity || '?')}</li>`;
        });
        contentHTML += '</ul>';
    } else {
        contentHTML += '<p>No products listed.</p>';
    }
    contentHTML += '</div>';

    // Account Data Section (Check if fields exist)
    contentHTML += '<div class="read-only-section"><h4>Account Data</h4>';
    const totalAmountRO = orderData.totalAmount ?? null; // Use nullish coalescing
    const amountPaidRO = orderData.amountPaid ?? null;
    let balanceDueROText = 'N/A';
    let paymentStatusRO = orderData.paymentStatus ?? null;

    if (totalAmountRO !== null && amountPaidRO !== null) {
        const balanceDueRO = totalAmountRO - amountPaidRO;
        balanceDueROText = `₹ ${balanceDueRO.toFixed(2)}`;
        // Determine payment status if not explicitly set
        if (paymentStatusRO === null) {
             paymentStatusRO = balanceDueRO <= 0 ? 'Paid' : 'Pending';
        }
    } else if (paymentStatusRO === null) {
        paymentStatusRO = 'N/A'; // If totals are missing and status isn't set
    }

    contentHTML += `<p><strong>Total Amount:</strong> ${totalAmountRO !== null ? `₹ ${totalAmountRO.toFixed(2)}` : 'N/A'}</p>`;
    contentHTML += `<p><strong>Amount Paid:</strong> ${amountPaidRO !== null ? `₹ ${amountPaidRO.toFixed(2)}` : 'N/A'}</p>`;
    contentHTML += `<p><strong>Balance Due:</strong> ${balanceDueROText}</p>`;
    contentHTML += `<p><strong>Payment Status:</strong> ${escapeHtml(paymentStatusRO)}</p></div>`;


    // Status History Section
    contentHTML += '<div class="read-only-section"><h4>Status History</h4>';
    if (orderData.statusHistory && orderData.statusHistory.length > 0) {
         const sortedHistoryRO = [...orderData.statusHistory].sort((a, b) => {
             const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
             const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
             return timeB - timeA; // Newest first
         });
        contentHTML += '<ul class="read-only-history-list">';
        sortedHistoryRO.forEach(entry => {
             let timeStr = '?';
             if (entry.timestamp?.toDate) {
                 try { timeStr = entry.timestamp.toDate().toLocaleString('en-GB'); } catch {}
             }
            contentHTML += `<li><strong>${escapeHtml(entry.status || '?')}</strong> at ${timeStr}</li>`;
        });
        contentHTML += '</ul>';
    } else { contentHTML += '<p>No status history available.</p>'; }
    contentHTML += '</div>';

    // Close the main grid div
    contentHTML += '</div>';

    // Set the final HTML content
    readOnlyOrderModalContent.innerHTML = contentHTML;
}

function closeReadOnlyOrderModal() {
    if (readOnlyOrderModal) {
        readOnlyOrderModal.classList.remove('active');
    }
}


console.log("order_history.js script (with new features) loaded.");