// js/order_history.js
// Version includes:
// - Phase 1 Visual Improvements assumed done.
// - Phase 2 Functionality: Bulk Actions, CSV Export, Search Highlighting, Basic Reporting.

// Assume Firebase functions are globally available via order_history.html's script block
const {
    db, collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, Timestamp, arrayUnion, writeBatch
} = window;

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
const modalOrderIdInput = document.getElementById('modalOrderId');
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

// --- NEW DOM Elements for Phase 2 ---
const exportCsvBtn = document.getElementById('exportCsvBtn');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const bulkActionsBar = document.getElementById('bulkActionsBar');
const selectedCountSpan = document.getElementById('selectedCount');
const bulkStatusSelect = document.getElementById('bulkStatusSelect');
const bulkUpdateStatusBtn = document.getElementById('bulkUpdateStatusBtn');
const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
const reportingSection = document.getElementById('reportingSection');
const statusCountsReportContainer = document.getElementById('statusCountsReport');


// --- Global State ---
let currentSortField = 'createdAt';
let currentSortDirection = 'desc';
let unsubscribeOrders = null;
let allOrdersCache = []; // Stores ALL raw order data fetched by listener
let currentlyDisplayedOrders = []; // Stores orders currently rendered in the table (filtered/sorted)
let searchDebounceTimer;
let currentStatusFilter = '';
let orderIdToOpenFromUrl = null;
let modalOpenedFromUrl = false;
let selectedOrderIds = new Set(); // ** Store selected Firestore IDs for bulk actions **

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DEBUG] Order History DOM Loaded. Initializing Phase 2 features.");

    const urlParams = new URLSearchParams(window.location.search);
    orderIdToOpenFromUrl = urlParams.get('openModalForId');
    currentStatusFilter = urlParams.get('status');

    if (orderIdToOpenFromUrl) {
        console.log(`[DEBUG] Received request to open modal for Firestore ID: ${orderIdToOpenFromUrl}`);
    }

    if (currentStatusFilter && filterStatusSelect) {
        filterStatusSelect.value = currentStatusFilter;
    }

    waitForDbConnection(() => {
        listenForOrders(); // Start listener

        // --- Event Listeners (Existing) ---
        if (sortSelect) sortSelect.addEventListener('change', handleSortChange);
        if (filterDateInput) filterDateInput.addEventListener('change', handleFilterChange);
        if (filterSearchInput) filterSearchInput.addEventListener('input', handleSearchInput);
        if (filterStatusSelect) filterStatusSelect.addEventListener('change', handleFilterChange);
        if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeDetailsModal);
        if (detailsModal) detailsModal.addEventListener('click', (event) => { if (event.target === detailsModal) closeDetailsModal(); });
        if (modalUpdateStatusBtn) modalUpdateStatusBtn.addEventListener('click', handleUpdateStatus); // Single update
        if (modalDeleteBtn) modalDeleteBtn.addEventListener('click', handleDeleteFromModal); // Single delete
        if (modalEditFullBtn) modalEditFullBtn.addEventListener('click', handleEditFullFromModal);
        if (whatsappPopupCloseBtn) whatsappPopupCloseBtn.addEventListener('click', closeWhatsAppPopup);
        if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (event) => { if (event.target === whatsappReminderPopup) closeWhatsAppPopup(); });

        // --- Event Listeners (Phase 2 - NEW) ---
        if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCsv);
        if (selectAllCheckbox) selectAllCheckbox.addEventListener('change', handleSelectAllChange);
        if (bulkUpdateStatusBtn) bulkUpdateStatusBtn.addEventListener('click', handleBulkUpdateStatus);
        if (bulkDeleteBtn) bulkDeleteBtn.addEventListener('click', handleBulkDelete);

        // Event Delegation for table (UPDATED for row checkboxes)
        if (orderTableBody) {
            orderTableBody.addEventListener('click', function(event) {
                const target = event.target;
                const row = target.closest('tr');
                if (!row || !row.dataset.id) return;
                const firestoreId = row.dataset.id;
                const orderData = allOrdersCache.find(o => o.id === firestoreId);
                if (!orderData) { console.warn(`[DEBUG] Order data not found in cache for ID: ${firestoreId}`); return; }

                if (target.matches('.row-selector')) {
                    // Handle row checkbox click
                    handleRowCheckboxChange(target, firestoreId);
                } else if (target.closest('.details-edit-button')) {
                    openDetailsModal(firestoreId, orderData);
                } else if (target.closest('.whatsapp-button')) {
                    sendWhatsAppMessage(firestoreId, orderData);
                }
            });
        } else {
            console.error("Element with ID 'orderTableBody' not found!");
        }
    });
});

// --- DB Connection Wait (Keep as is) ---
function waitForDbConnection(callback) {
    if (window.db) { callback(); }
    else {
        let a = 0, m = 20, i = setInterval(() => { a++; if (window.db) { clearInterval(i); callback(); } else if (a >= m) { clearInterval(i); console.error("DB connection timeout for order_history.js"); alert("Database connection failed. Please try again."); } }, 250);
    }
}

// --- Sorting & Filtering Handlers (Keep as is) ---
function handleSortChange() {
    if (!sortSelect) return;
    const [field, direction] = sortSelect.value.split('_');
    if (field && direction) {
        currentSortField = field;
        currentSortDirection = direction;
        applyFiltersAndRender();
    }
}
function handleFilterChange() { applyFiltersAndRender(); }
function handleSearchInput() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(applyFiltersAndRender, 300);
}
function clearFilters() {
    if (filterDateInput) filterDateInput.value = '';
    if (filterSearchInput) filterSearchInput.value = '';
    if (filterStatusSelect) filterStatusSelect.value = '';
    if (sortSelect) sortSelect.value = 'createdAt_desc';
    currentSortField = 'createdAt';
    currentSortDirection = 'desc';
    currentStatusFilter = '';
    selectedOrderIds.clear(); // Clear selections on filter clear
    updateBulkActionsBar(); // Hide bulk actions bar
    if (selectAllCheckbox) selectAllCheckbox.checked = false; // Uncheck select all

    if (history.replaceState) {
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
    }
    applyFiltersAndRender();
}

// --- Firestore Listener (Keep mostly as is, update rendering call) ---
function listenForOrders() {
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; console.log("[DEBUG] Unsubscribed from previous listener."); }
    if (!db || !collection || !query || !orderBy || !onSnapshot) { console.error("Firestore listener functions missing."); return; }

    if (orderTableBody) { orderTableBody.innerHTML = `<tr><td colspan="10" id="loadingMessage">Loading orders...</td></tr>`; } // ** Colspan is 10 **

    try {
        const q = query(collection(db, "orders"));
        console.log("[DEBUG] Setting up Firestore listener for orders...");
        unsubscribeOrders = onSnapshot(q, (snapshot) => {
            console.log(`[DEBUG] Order snapshot received. ${snapshot.size} total documents.`);
            allOrdersCache = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    orderId: data.orderId || '',
                    customerDetails: data.customerDetails || {},
                    products: data.products || [],
                    orderDate: data.orderDate || null,
                    deliveryDate: data.deliveryDate || null,
                    urgent: data.urgent || 'No',
                    status: data.status || 'Unknown',
                    statusHistory: data.statusHistory || [],
                    createdAt: data.createdAt || null,
                    updatedAt: data.updatedAt || null
                };
            });
            console.log(`[DEBUG] allOrdersCache populated with ${allOrdersCache.length} orders.`);
            // ** Clear selections when data refreshes from Firestore **
            selectedOrderIds.clear();
            updateBulkActionsBar();
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
            // ** Render **
            applyFiltersAndRender();
            attemptOpenModalFromUrl();
        }, (error) => {
            console.error("[DEBUG] Error fetching orders snapshot:", error);
            if (orderTableBody) { orderTableBody.innerHTML = `<tr><td colspan="10" style="color: red;">Error loading orders. Please try again.</td></tr>`; } // ** Colspan 10 **
        });
    } catch (error) {
        console.error("[DEBUG] Error setting up Firestore listener:", error);
        if (orderTableBody) { orderTableBody.innerHTML = `<tr><td colspan="10" style="color: red;">Error setting up listener.</td></tr>`; } // ** Colspan 10 **
    }
}

// --- Filter, Sort, Render Function (UPDATED) ---
function applyFiltersAndRender() {
    if (!allOrdersCache) { console.warn("[DEBUG] applyFiltersAndRender called but cache is empty."); return; }

    const filterDateValue = filterDateInput ? filterDateInput.value : '';
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';
    const filterStatusValue = filterStatusSelect ? filterStatusSelect.value : '';
    currentStatusFilter = filterStatusValue;

    // Filter
    let filteredOrders = allOrdersCache.filter(order => {
        if (filterStatusValue && order.status !== filterStatusValue) return false;
        if (filterDateValue && order.orderDate !== filterDateValue) return false;
        // ** Search logic remains the same **
        if (filterSearchValue) {
            const orderIdString = String(order.orderId || '');
            const customerNameString = order.customerDetails?.fullName || '';
            const firestoreIdString = order.id || '';
            const productsString = (order.products || []).map(p => String(p.name || '')).join(' ').toLowerCase();
            const mobileString = String(order.customerDetails?.whatsappNo || '');
            if (!(orderIdString.toLowerCase().includes(filterSearchValue) ||
                  customerNameString.toLowerCase().includes(filterSearchValue) ||
                  firestoreIdString.toLowerCase().includes(filterSearchValue) ||
                  productsString.includes(filterSearchValue) ||
                  mobileString.includes(filterSearchValue))) {
                return false;
            }
        }
        return true;
    });

    // Sort (Keep existing sort logic)
    try {
        filteredOrders.sort((a, b) => {
            let valA = a[currentSortField];
            let valB = b[currentSortField];

            if (valA && typeof valA.toDate === 'function') valA = valA.toDate().getTime();
            if (valB && typeof valB.toDate === 'function') valB = valB.toDate().getTime();

            if (currentSortField === 'orderDate' || currentSortField === 'deliveryDate') {
                valA = valA ? new Date(valA).getTime() : (currentSortDirection === 'asc' ? Infinity : -Infinity); // Handle nulls correctly
                valB = valB ? new Date(valB).getTime() : (currentSortDirection === 'asc' ? Infinity : -Infinity);
            }

            let sortComparison = 0;
            if (valA > valB) sortComparison = 1;
            else if (valA < valB) sortComparison = -1;

            return currentSortDirection === 'desc' ? sortComparison * -1 : sortComparison;
        });
    } catch (sortError) {
        console.error("[DEBUG] Error during sorting:", sortError);
    }

    // ** Store currently displayed orders for other functions (like export) **
    currentlyDisplayedOrders = filteredOrders;

    // Update Counts & Reporting
    updateOrderCountsAndReport(currentlyDisplayedOrders); // ** Use combined function **

    // Render table
    if (!orderTableBody) { console.error("orderTableBody not found during render!"); return; }
    orderTableBody.innerHTML = ''; // Clear previous content
    if (currentlyDisplayedOrders.length === 0) {
        orderTableBody.innerHTML = `<tr><td colspan="10" id="noOrdersMessage">No orders found matching your criteria.</td></tr>`; // ** Colspan 10 **
    } else {
        const searchTerm = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : ''; // Get search term for highlighting
        currentlyDisplayedOrders.forEach(order => {
            displayOrderRow(order.id, order, searchTerm); // ** Pass search term **
        });
    }

    // ** Update Select All Checkbox State **
    if (selectAllCheckbox) {
        const allVisibleSelected = currentlyDisplayedOrders.length > 0 && currentlyDisplayedOrders.every(order => selectedOrderIds.has(order.id));
        selectAllCheckbox.checked = allVisibleSelected;
        selectAllCheckbox.indeterminate = !allVisibleSelected && currentlyDisplayedOrders.some(order => selectedOrderIds.has(order.id));
    }
}


// --- Update Order Counts & Reporting Function (NEW Combined) ---
function updateOrderCountsAndReport(displayedOrders) {
    const total = displayedOrders.length;
    let completedDelivered = 0;
    const statusCounts = {}; // Object to store counts per status

    displayedOrders.forEach(order => {
        const status = order.status || 'Unknown';
        if (status === 'Completed' || status === 'Delivered') {
            completedDelivered++;
        }
        // Count statuses
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
            // Sort statuses alphabetically for consistent display
            Object.keys(statusCounts).sort().forEach(status => {
                reportHtml += `<li>${status}: <strong>${statusCounts[status]}</strong></li>`;
            });
            reportHtml += '</ul>';
            statusCountsReportContainer.innerHTML = reportHtml;
        }
    }
}


// --- Display Single Order Row (UPDATED for Checkbox and Highlighting) ---
function displayOrderRow(firestoreId, data, searchTerm = '') {
    if (!orderTableBody) return;
    const tableRow = document.createElement('tr');
    tableRow.setAttribute('data-id', firestoreId);
    // Highlight row if selected
    if (selectedOrderIds.has(firestoreId)) {
        tableRow.classList.add('selected-row');
    }

    const customerName = data.customerDetails?.fullName || 'N/A';
    const customerMobile = data.customerDetails?.whatsappNo || '-';
    const orderDateStr = data.orderDate ? new Date(data.orderDate).toLocaleDateString('en-GB') : '-';
    const deliveryDateStr = data.deliveryDate ? new Date(data.deliveryDate).toLocaleDateString('en-GB') : '-';
    const displayId = data.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`;
    const status = data.status || 'Unknown';
    const priority = data.urgent === 'Yes' ? 'Yes' : 'No';

    let productsHtml = '-';
    let productsTextForSearch = ''; // Plain text for searching
    if (Array.isArray(data.products) && data.products.length > 0) {
        productsTextForSearch = data.products.map(p => `${String(p.name || 'Unnamed')} (${p.quantity || '?'})`).join(', ');
        // Use text content for highlighting, build HTML separately
        productsHtml = data.products.map(p => {
             const name = escapeHtml(String(p.name || 'Unnamed'));
             const quantity = escapeHtml(String(p.quantity || '?'));
             return `${highlightMatch(name, searchTerm)} (${highlightMatch(quantity, searchTerm)})`;
         }).join('<br>');
    }

    const statusClass = `status-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const priorityClass = priority === 'Yes' ? 'priority-yes' : 'priority-no';

    // ** Function to apply highlighting **
    function highlightMatch(text, term) {
        if (!term || !text) return text;
        try {
             // Use RegExp for case-insensitive global replacement
            // Escape special regex characters in the search term
             const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
             const regex = new RegExp(`(${escapedTerm})`, 'gi');
             return text.replace(regex, '<mark>$1</mark>');
        } catch (e) {
             console.warn("Highlighting regex error:", e);
             return text; // Fallback to original text on error
        }
    }

    // ** Function to escape HTML ** (Simple version)
    function escapeHtml(unsafe) {
        if (!unsafe) return "";
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }


    // Create table cells (10 columns)
    tableRow.innerHTML = `
        <td class="col-checkbox"><input type="checkbox" class="row-selector" data-id="${firestoreId}" ${selectedOrderIds.has(firestoreId) ? 'checked' : ''}></td>
        <td>${highlightMatch(escapeHtml(displayId), searchTerm)}</td>
        <td>
            <span class="customer-name-display">${highlightMatch(escapeHtml(customerName), searchTerm)}</span>
            <span class="customer-mobile-inline">${highlightMatch(escapeHtml(customerMobile), searchTerm)}</span>
        </td>
        <td>${productsHtml}</td> {/* Already highlighted */}
        <td>${orderDateStr}</td>
        <td>${deliveryDateStr}</td>
        <td class="${priorityClass}">${priority}</td>
        <td><span class="status-badge ${statusClass}">${highlightMatch(escapeHtml(status), searchTerm)}</span></td>
        <td><button type="button" class="button details-edit-button"><i class="fas fa-info-circle"></i> Details/Edit</button></td>
        <td><button type="button" class="button whatsapp-button" title="Send Status on WhatsApp"><i class="fab fa-whatsapp"></i></button></td>
    `;
    orderTableBody.appendChild(tableRow);
}

// --- Modal 1 Handling (Details/Edit Popup - Mostly Unchanged) ---
// ... (openDetailsModal, closeDetailsModal functions remain the same) ...
function openDetailsModal(firestoreId, orderData) {
    // ... (Existing code inside openDetailsModal remains the same) ...
     if (!orderData || !detailsModal) { console.error("Missing order data or modal element:", firestoreId); return; }
    if (!modalOrderIdInput || !modalDisplayOrderIdSpan || !modalCustomerNameSpan || !modalCustomerWhatsAppSpan || !modalOrderStatusSelect || !modalProductListContainer || !modalStatusHistoryListContainer) {
        console.error("One or more modal elements not found!"); return;
    }
    console.log("[DEBUG] Opening details modal for:", firestoreId);
    modalOrderIdInput.value = firestoreId; // Store Firestore ID
    modalDisplayOrderIdSpan.textContent = orderData.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`;
    modalCustomerNameSpan.textContent = orderData.customerDetails?.fullName || 'N/A';
    modalCustomerWhatsAppSpan.textContent = orderData.customerDetails?.whatsappNo || 'N/A';
    modalOrderStatusSelect.value = orderData.status || '';

    // Populate Product List
    modalProductListContainer.innerHTML = ''; // Clear previous
    const products = orderData.products;
    if (Array.isArray(products) && products.length > 0) {
        const ul = document.createElement('ul');
        ul.style.listStyle = 'none'; ul.style.padding = '0'; ul.style.margin = '0';
        products.forEach(product => {
            const li = document.createElement('li');
            li.style.marginBottom = '5px'; li.style.paddingBottom = '5px'; li.style.borderBottom = '1px dotted #eee';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = product.name || 'Unnamed Product';
            nameSpan.style.fontWeight = '600';
            const qtySpan = document.createElement('span');
            qtySpan.textContent = ` - Qty: ${product.quantity || '?'}`;
            qtySpan.style.fontSize = '0.9em'; qtySpan.style.color = '#555';
            li.append(nameSpan, qtySpan); ul.appendChild(li);
        });
        if(ul.lastChild) ul.lastChild.style.borderBottom = 'none';
        modalProductListContainer.appendChild(ul);
    } else {
        modalProductListContainer.innerHTML = '<p class="no-products">No products listed.</p>';
    }

    // Populate Status History
    modalStatusHistoryListContainer.innerHTML = ''; // Clear previous
    const history = orderData.statusHistory;
    if (Array.isArray(history) && history.length > 0) {
         const sortedHistory = [...history].sort((a, b) => (b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0) - (a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0));
         const ul = document.createElement('ul');
         ul.style.listStyle = 'none'; ul.style.padding = '0'; ul.style.margin = '0'; ul.style.maxHeight = '150px'; ul.style.overflowY = 'auto';
         sortedHistory.forEach(entry => {
            const li = document.createElement('li');
            li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.fontSize = '0.9em'; li.style.padding = '3px 0'; li.style.borderBottom = '1px dotted #eee';
            const statusSpan = document.createElement('span'); statusSpan.textContent = entry.status || '?'; statusSpan.style.fontWeight = '500';
            const timeSpan = document.createElement('span'); timeSpan.style.color = '#777';
            if (entry.timestamp && entry.timestamp.toDate) { const d=entry.timestamp.toDate(); timeSpan.textContent = d.toLocaleDateString('en-GB',{day:'numeric',month:'short'}) + ' ' + d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}); } else { timeSpan.textContent = '?'; }
            li.append(statusSpan, timeSpan); ul.appendChild(li);
        });
         if(ul.lastChild) ul.lastChild.style.borderBottom = 'none';
        modalStatusHistoryListContainer.appendChild(ul);
    } else { modalStatusHistoryListContainer.innerHTML = '<p class="no-history">No status history.</p>'; }

    detailsModal.style.display = 'flex';
}
function closeDetailsModal() { if (detailsModal) { detailsModal.style.display = 'none'; } }


// --- Modal 1 Action Handlers (Single Update/Delete - Mostly Unchanged) ---
async function handleUpdateStatus() { // Single item update from modal
    const firestoreId = modalOrderIdInput.value;
    const newStatus = modalOrderStatusSelect.value;
    if (!firestoreId || !newStatus || !db || !doc || !updateDoc || !arrayUnion || !Timestamp) { console.error("Update Status prerequisites failed."); return; }
    const orderData = allOrdersCache.find(o => o.id === firestoreId); if (!orderData) { console.error("Order data not found in cache for update."); return; }
    if (orderData.status === newStatus) { alert("Status is already set to '" + newStatus + "'."); return; }

    if (modalUpdateStatusBtn) { modalUpdateStatusBtn.disabled = true; modalUpdateStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; }

    const historyEntry = { status: newStatus, timestamp: Timestamp.now() };

    try {
        const orderRef = doc(db, "orders", firestoreId);
        await updateDoc(orderRef, {
            status: newStatus,
            updatedAt: historyEntry.timestamp,
            statusHistory: arrayUnion(historyEntry)
        });
        console.log("[DEBUG] Status updated successfully for:", firestoreId);
        closeDetailsModal();
        if (orderData.customerDetails && orderData.customerDetails.whatsappNo) {
            showStatusUpdateWhatsAppReminder(orderData.customerDetails, orderData.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`, newStatus);
        } else {
            alert("Status updated successfully!");
        }
        // Note: Listener will automatically refresh the table row
    } catch (error) { console.error("Error updating status:", error); alert("Error updating status: " + error.message); }
    finally { if (modalUpdateStatusBtn) { modalUpdateStatusBtn.disabled = false; modalUpdateStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Status'; } }
}

function handleDeleteFromModal() { // Single item delete from modal
    const firestoreId = modalOrderIdInput.value;
    const displayId = modalDisplayOrderIdSpan.textContent;
    if (!firestoreId) return;
    closeDetailsModal();
    // Confirm before deleting single item
    if (confirm(`Are you sure you want to delete Order ID: ${displayId}? This cannot be undone.`)) {
        deleteSingleOrder(firestoreId); // Use a dedicated function
    } else {
        console.log("[DEBUG] Deletion cancelled by user.");
    }
}

async function deleteSingleOrder(firestoreId) {
     if (!db || !doc || !deleteDoc) { alert("Delete function unavailable."); return; }
     try {
         console.log("[DEBUG] Deleting single order:", firestoreId);
         await deleteDoc(doc(db, "orders", firestoreId));
         console.log("[DEBUG] Single order deleted.");
         alert("Order deleted successfully.");
         // Listener will refresh data
     } catch (error) {
         console.error("Error deleting single order:", error);
         alert("Error deleting order: " + error.message);
     }
}


function handleEditFullFromModal() { const firestoreId = modalOrderIdInput.value; if (!firestoreId) return; window.location.href = `new_order.html?editOrderId=${firestoreId}`; }

// --- WhatsApp Functions (Keep as is) ---
function showStatusUpdateWhatsAppReminder(customer, orderId, updatedStatus) { /* ... Keep existing ... */
    if (!whatsappReminderPopup || !whatsappMsgPreview || !whatsappSendLink) { console.error("WhatsApp Popup elements missing."); return; }
    const customerName = customer.fullName || 'Customer';
    const customerNumber = customer.whatsappNo?.replace(/[^0-9]/g, '');
    if (!customerNumber) { console.warn("WhatsApp number missing for reminder."); return; }
    let message = getWhatsAppMessageTemplate(updatedStatus, customerName, orderId, null); // Pass null for delivery date here
    whatsappMsgPreview.innerText = message;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customerNumber}?text=${encodedMessage}`;
    whatsappSendLink.href = whatsappUrl;

    // Set popup title based on status
    const whatsappPopupTitle = document.getElementById('whatsapp-popup-title');
    if(whatsappPopupTitle) whatsappPopupTitle.textContent = "Status Updated!";

    whatsappReminderPopup.classList.add('active'); // Show popup
}
function closeWhatsAppPopup() { if (whatsappReminderPopup) { whatsappReminderPopup.classList.remove('active'); } }
function sendWhatsAppMessage(firestoreId, orderData) { /* ... Keep existing ... */
     if (!orderData || !orderData.customerDetails || !orderData.customerDetails.whatsappNo) { alert("Customer WhatsApp number not found for this order."); return; }
    const customer = orderData.customerDetails;
    const orderId = orderData.orderId || `(Sys: ${firestoreId.substring(0,6)}...)`;
    const status = orderData.status;
    const deliveryDate = orderData.deliveryDate; // Pass delivery date if available
    const customerName = customer.fullName || 'Customer';
    const customerNumber = customer.whatsappNo.replace(/[^0-9]/g, '');
    let message = getWhatsAppMessageTemplate(status, customerName, orderId, deliveryDate);
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customerNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank'); // Open in new tab
}
function getWhatsAppMessageTemplate(status, customerName, orderId, deliveryDate) { /* ... Keep existing ... */
     const namePlaceholder = "[Customer Name]"; const orderNoPlaceholder = "[ORDER_NO]"; const deliveryDatePlaceholder = "[DELIVERY_DATE]";
     const companyName = "Madhav Offset"; const companyAddress = "Head Office: Moodh Market, Batadu"; const companyMobile = "9549116541";
     const signature = `धन्यवाद,\n${companyName}\n${companyAddress}\nMobile: ${companyMobile}`;
     let template = "";
     let deliveryDateText = deliveryDate ? new Date(deliveryDate).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : "जल्द से जल्द";

     switch (status) {
        case "Order Received": template = `प्रिय ${namePlaceholder},\nनमस्कार,\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) हमें सफलतापूर्वक प्राप्त हो गया है।\nहम इस ऑर्डर को ${deliveryDatePlaceholder} तक पूर्ण करने का प्रयास करेंगे।\n\nDear ${namePlaceholder},\nWe have successfully received your order (Order No: ${orderNoPlaceholder}).\nWe aim to complete it by ${deliveryDatePlaceholder}.`; break;
        case "Designing": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) का डिज़ाइन तैयार किया जा रहा है।\nजैसे ही डिज़ाइन तैयार होगा, हम आपसे पुष्टि के लिए संपर्क करेंगे।\n\nDear ${namePlaceholder},\nThe design for your order (Order No: ${orderNoPlaceholder}) is in progress.\nWe’ll contact you for confirmation once it’s ready.`; break;
        case "Verification": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की डिज़ाइन आपके साथ साझा कर दी गई है।\nकृपया डिज़ाइन को ध्यानपूर्वक जाँचे और हमें अपनी अनुमति प्रदान करें।\nएक बार ‘OK’ कर देने के बाद किसी भी प्रकार का संशोधन संभव नहीं होगा।\n\nDear ${namePlaceholder},\nWe have shared the design for your order (Order No: ${orderNoPlaceholder}) with you.\nPlease review it carefully and provide your approval.\nOnce you confirm with ‘OK’, no further changes will be possible.`; break;
        case "Design Approved": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की डिज़ाइन स्वीकृत कर दी गई है।\nअब यह प्रिंटिंग प्रक्रिया के लिए आगे बढ़ाया जा रहा है।\n\nDear ${namePlaceholder},\nYour design for Order No: ${orderNoPlaceholder} has been approved.\nIt is now moving forward to the printing stage.`; break;
        case "Ready for Working":
            template = `प्रिय ${namePlaceholder},\nनमस्कार,\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की प्रिंटिंग पूरी हो गई है।\nआप ऑफिस/कार्यालय आकर अपना प्रोडक्ट ले जा सकते हैं।\n\nDear ${namePlaceholder},\nThe printing for your order (Order No: ${orderNoPlaceholder}) is complete.\nYou can now collect your product from our office.`;
            break;
        case "Printing": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) प्रिंट हो रहा है।\nपूरा होते ही आपको सूचित किया जाएगा।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) is currently being printed.\nWe will notify you once it’s done.`; break;
        case "Delivered": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) सफलतापूर्वक डिलीवर कर दिया गया है।\nकृपया पुष्टि करें कि आपने ऑर्डर प्राप्त कर लिया है।\nआपके सहयोग के लिए धन्यवाद।\nहमें आशा है कि आप हमें शीघ्र ही फिर से सेवा का अवसर देंगे।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) has been successfully delivered.\nPlease confirm the receipt.\nThank you for your support.\nWe hope to have the opportunity to serve you again soon.`; break;
        case "Completed": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) सफलतापूर्वक पूर्ण हो चुका है।\nआपके सहयोग के लिए धन्यवाद।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) has been successfully completed.\nThank you for your support.`; break;
        default: template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) का वर्तमान स्टेटस है: ${status}.\n\nDear ${namePlaceholder},\nThe current status for your order (Order No: ${orderNoPlaceholder}) is: ${status}.`;
     }
     let message = template.replace(new RegExp(namePlaceholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), customerName);
     message = message.replace(new RegExp(orderNoPlaceholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), orderId);
     message = message.replace(new RegExp(deliveryDatePlaceholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), deliveryDateText);
     message += `\n\n${signature}`;
     return message;
}


// ========================================
// --- PHASE 2: New Functionality START ---
// ========================================

// --- Bulk Action Functions ---

function handleSelectAllChange(event) {
    const isChecked = event.target.checked;
    const rowCheckboxes = orderTableBody.querySelectorAll('.row-selector');
    selectedOrderIds.clear(); // Clear previous selections first

    rowCheckboxes.forEach(checkbox => {
        const firestoreId = checkbox.dataset.id;
        checkbox.checked = isChecked;
        const row = checkbox.closest('tr');
        if (isChecked) {
            selectedOrderIds.add(firestoreId);
            if (row) row.classList.add('selected-row');
        } else {
            // We already cleared the set above
            if (row) row.classList.remove('selected-row');
        }
    });
    updateBulkActionsBar();
}

function handleRowCheckboxChange(checkbox, firestoreId) {
    const row = checkbox.closest('tr');
    if (checkbox.checked) {
        selectedOrderIds.add(firestoreId);
        if (row) row.classList.add('selected-row');
    } else {
        selectedOrderIds.delete(firestoreId);
        if (row) row.classList.remove('selected-row');
    }
    updateBulkActionsBar();

     // Update Select All checkbox state
     if (selectAllCheckbox) {
        const allVisibleCheckboxes = orderTableBody.querySelectorAll('.row-selector');
        const allVisibleChecked = Array.from(allVisibleCheckboxes).every(cb => cb.checked);
        const someVisibleChecked = Array.from(allVisibleCheckboxes).some(cb => cb.checked);

        selectAllCheckbox.checked = allVisibleChecked && allVisibleCheckboxes.length > 0;
        selectAllCheckbox.indeterminate = !allVisibleChecked && someVisibleChecked;
     }
}

function updateBulkActionsBar() {
    const count = selectedOrderIds.size;
    if (count > 0) {
        selectedCountSpan.textContent = `${count} item${count > 1 ? 's' : ''} selected`;
        bulkActionsBar.style.display = 'flex'; // Show the bar
    } else {
        bulkActionsBar.style.display = 'none'; // Hide the bar
        if (bulkStatusSelect) bulkStatusSelect.value = ''; // Reset status dropdown
    }
     // Disable/enable buttons based on selection and status choice
     if (bulkUpdateStatusBtn) bulkUpdateStatusBtn.disabled = !(count > 0 && bulkStatusSelect && bulkStatusSelect.value);
     if (bulkDeleteBtn) bulkDeleteBtn.disabled = !(count > 0);
}

// Add listener for the bulk status dropdown to enable/disable update button
if (bulkStatusSelect) {
    bulkStatusSelect.addEventListener('change', () => {
        if (bulkUpdateStatusBtn) {
            bulkUpdateStatusBtn.disabled = !(selectedOrderIds.size > 0 && bulkStatusSelect.value);
        }
    });
}


async function handleBulkDelete() {
    const idsToDelete = Array.from(selectedOrderIds);
    if (idsToDelete.length === 0) {
        alert("Please select orders to delete.");
        return;
    }

    if (!confirm(`Are you sure you want to delete ${idsToDelete.length} selected order(s)? This cannot be undone.`)) {
        return;
    }

    console.log("[DEBUG] Starting bulk delete for IDs:", idsToDelete);
    bulkDeleteBtn.disabled = true;
    bulkDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    // Use Firestore Batch Write for atomic delete (up to 500 docs)
    const batch = writeBatch(db);
    idsToDelete.forEach(id => {
        const docRef = doc(db, "orders", id);
        batch.delete(docRef);
    });

    try {
        await batch.commit();
        console.log(`[DEBUG] Bulk delete successful for ${idsToDelete.length} orders.`);
        alert(`${idsToDelete.length} order(s) deleted successfully.`);
        selectedOrderIds.clear(); // Clear selection after successful delete
        updateBulkActionsBar(); // Hide bar
        // The listener will automatically remove the rows from the UI
    } catch (error) {
        console.error("Error during bulk delete:", error);
        alert(`Error deleting orders: ${error.message}\nSome orders might not have been deleted.`);
    } finally {
        bulkDeleteBtn.disabled = false; // Re-enable button (even on failure)
        bulkDeleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Selected';
        updateBulkActionsBar(); // Update bar state based on remaining selection (if any)
    }
}


async function handleBulkUpdateStatus() {
    const idsToUpdate = Array.from(selectedOrderIds);
    const newStatus = bulkStatusSelect.value;

    if (idsToUpdate.length === 0) {
        alert("Please select orders to update.");
        return;
    }
    if (!newStatus) {
        alert("Please select a status to update to.");
        return;
    }

    if (!confirm(`Are you sure you want to change the status to "${newStatus}" for ${idsToUpdate.length} selected order(s)?`)) {
        return;
    }

    console.log(`[DEBUG] Starting bulk status update to "${newStatus}" for IDs:`, idsToUpdate);
    bulkUpdateStatusBtn.disabled = true;
    bulkUpdateStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

    // Use Firestore Batch Write
    const batch = writeBatch(db);
    const now = Timestamp.now(); // Use the same timestamp for all updates in this batch
    const historyEntry = { status: newStatus, timestamp: now };

    idsToUpdate.forEach(id => {
        const docRef = doc(db, "orders", id);
        batch.update(docRef, {
            status: newStatus,
            updatedAt: now,
            statusHistory: arrayUnion(historyEntry) // Add to history
        });
    });

    try {
        await batch.commit();
        console.log(`[DEBUG] Bulk status update successful for ${idsToUpdate.length} orders.`);
        alert(`${idsToUpdate.length} order(s) status updated to "${newStatus}".`);
        selectedOrderIds.clear(); // Clear selection after successful update
        updateBulkActionsBar(); // Hide bar
        // The listener will automatically update the rows in the UI
    } catch (error) {
        console.error("Error during bulk status update:", error);
        alert(`Error updating statuses: ${error.message}\nSome statuses might not have been updated.`);
    } finally {
        bulkUpdateStatusBtn.disabled = false; // Re-enable button
        bulkUpdateStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Selected';
        bulkStatusSelect.value = ''; // Reset dropdown
        updateBulkActionsBar(); // Update bar state
    }
}


// --- CSV Export Function ---

function exportToCsv() {
    console.log("[DEBUG] Export to CSV requested.");
    if (currentlyDisplayedOrders.length === 0) {
        alert("No data available to export.");
        return;
    }

    // Define CSV Headers (adjust as needed)
    const headers = [
        "Firestore ID", "Order ID", "Customer Name", "WhatsApp No", "Contact No", "Address",
        "Order Date", "Delivery Date", "Status", "Urgent", "Remarks",
        "Products (Name | Qty)" // Combined products column
    ];

    // Prepare data rows
    const rows = currentlyDisplayedOrders.map(order => {
        const productsString = (order.products || [])
            .map(p => `${String(p.name || '').replace(/\|/g, '')}|${String(p.quantity || '')}`) // Use pipe as separator within cell
            .join('; '); // Use semicolon to separate multiple products

        return [
            order.id,
            order.orderId || '',
            order.customerDetails?.fullName || '',
            order.customerDetails?.whatsappNo || '',
            order.customerDetails?.contactNo || '',
            order.customerDetails?.address || '', // Assuming address is stored here now
            order.orderDate || '',
            order.deliveryDate || '',
            order.status || '',
            order.urgent || 'No',
            order.remarks || '',
            productsString
        ];
    });

    // Combine headers and rows
    let csvContent = "data:text/csv;charset=utf-8,"
        + headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n" // Header row
        + rows.map(row => row.map(field => `"${String(field || '').replace(/"/g, '""')}"`).join(",")).join("\n"); // Data rows

    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    link.setAttribute("download", `orders_export_${timestamp}.csv`);
    document.body.appendChild(link); // Required for Firefox

    console.log("[DEBUG] Triggering CSV download.");
    link.click(); // Trigger download

    document.body.removeChild(link); // Clean up
}


// --- Attempt Open Modal From URL (Keep as is) ---
function attemptOpenModalFromUrl() {
    if (orderIdToOpenFromUrl && allOrdersCache.length > 0 && !modalOpenedFromUrl) {
        console.log(`[DEBUG] Attempting to find and open modal for ID: ${orderIdToOpenFromUrl}`);
        const orderToOpenData = allOrdersCache.find(o => o.id === orderIdToOpenFromUrl);

        if (orderToOpenData) {
            console.log("[DEBUG] Order found in cache, opening modal.");
            openDetailsModal(orderIdToOpenFromUrl, orderToOpenData);
            modalOpenedFromUrl = true;
             // Clean URL parameter now
             try {
                 const currentUrl = new URL(window.location);
                 currentUrl.searchParams.delete('openModalForId');
                 window.history.replaceState({}, '', currentUrl.toString());
             } catch(e) { // Fallback if URL API not supported or error
                 window.history.replaceState(null, '', window.location.pathname);
             }
             orderIdToOpenFromUrl = null;
        } else {
            console.warn(`[DEBUG] Order with ID ${orderIdToOpenFromUrl} not found in current cache.`);
        }
    }
}


// ========================================
// --- PHASE 2: New Functionality END ---
// ========================================


// --- Final Log ---
console.log("order_history.js script (Phase 2) fully loaded and initialized.");