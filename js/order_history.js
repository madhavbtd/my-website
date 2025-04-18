// js/order_history.js

// --- Ensure Firestore functions are available globally ---
const { db, collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc } = window;

// --- DOM Elements ---
const orderTableBody = document.getElementById('orderTableBody');
const loadingRow = document.getElementById('loadingMessage'); // Cell inside the loading row
const sortSelect = document.getElementById('sort-orders');
const filterDateInput = document.getElementById('filterDate');
const filterSearchInput = document.getElementById('filterSearch');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');

// Modal 1: Details/Edit Elements
const detailsModal = document.getElementById('detailsModal');
const closeModalBtn = document.getElementById('closeDetailsModal');
const modalOrderIdInput = document.getElementById('modalOrderId');
const modalDisplayOrderIdSpan = document.getElementById('modalDisplayOrderId');
const modalCustomerNameSpan = document.getElementById('modalCustomerName');
const modalOrderStatusSelect = document.getElementById('modalOrderStatus');
const modalUpdateStatusBtn = document.getElementById('modalUpdateStatusBtn');
const modalDeleteBtn = document.getElementById('modalDeleteBtn');
const modalEditFullBtn = document.getElementById('modalEditFullBtn');

// Modal 2: WhatsApp Reminder Elements
const whatsappReminderPopup = document.getElementById('whatsapp-reminder-popup');
const whatsappPopupCloseBtn = document.getElementById('popup-close-btn');
const whatsappMsgPreview = document.getElementById('whatsapp-message-preview');
const whatsappSendLink = document.getElementById('whatsapp-send-link');

// --- Global State ---
let currentSortField = 'createdAt'; // Default sort field
let currentSortDirection = 'desc'; // Default sort direction
let unsubscribeOrders = null; // Firestore listener cleanup function
let allOrdersCache = []; // Stores ALL orders fetched from Firestore
let currentOrderDataCache = {}; // Stores data for orders currently displayed {firestoreId: data}

// Debounce timer for search input
let searchDebounceTimer;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DEBUG] Order History DOM Loaded (v4 - Filters Added).");

    waitForDbConnection(() => {
        console.log("[DEBUG] DB connection confirmed. Initializing listener.");
        listenForOrders(); // Start listening with default sort

        // --- Event Listeners ---
        // Sorting Dropdown
        if (sortSelect) sortSelect.addEventListener('change', handleSortChange);

        // Filter Inputs
        if (filterDateInput) filterDateInput.addEventListener('change', handleFilterChange);
        if (filterSearchInput) filterSearchInput.addEventListener('input', handleSearchInput); // Use input for instant feedback
        if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);

        // Modal 1 (Details/Edit) Listeners
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeDetailsModal);
        if (detailsModal) detailsModal.addEventListener('click', (event) => {
            if (event.target === detailsModal) closeDetailsModal();
        });
        if (modalUpdateStatusBtn) modalUpdateStatusBtn.addEventListener('click', handleUpdateStatus);
        if (modalDeleteBtn) modalDeleteBtn.addEventListener('click', handleDeleteFromModal);
        if (modalEditFullBtn) modalEditFullBtn.addEventListener('click', handleEditFullFromModal);

        // Modal 2 (WhatsApp Reminder) Listeners
        if (whatsappPopupCloseBtn) whatsappPopupCloseBtn.addEventListener('click', closeWhatsAppPopup);
        if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (event) => {
            if (event.target === whatsappReminderPopup) closeWhatsAppPopup();
        });
        console.log("[DEBUG] All event listeners set up.");
    });
});

// --- DB Connection Wait (No changes needed) ---
function waitForDbConnection(callback) { /* ... (same as before) ... */
    if (window.db) {
        console.log("[DEBUG] DB connection confirmed immediately.");
        callback();
    } else {
        let attempts = 0;
        const maxAttempts = 20; // Try for 5 seconds
        const intervalId = setInterval(() => {
            attempts++;
            if (window.db) {
                clearInterval(intervalId);
                console.log("[DEBUG] DB connection confirmed after check.");
                callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(intervalId);
                console.error("[DEBUG] DB connection timeout.");
                const loadingCell = document.getElementById('loadingMessage');
                if(loadingCell) loadingCell.textContent = 'Database connection failed.';
                alert("Database connection failed. Please refresh the page.");
            }
        }, 250);
    }
}


// --- Sorting Change Handler ---
function handleSortChange() {
    if (!sortSelect) return;
    const selectedValue = sortSelect.value;
    const [field, direction] = selectedValue.split('_');

    if (field && direction) {
        if (field === currentSortField && direction === currentSortDirection) return; // No change
        currentSortField = field;
        currentSortDirection = direction;
        console.log(`[DEBUG] Sort changed to: Field=${currentSortField}, Direction=${currentSortDirection}`);
        // Re-apply filters and render, which now includes sorting
        applyFiltersAndRender();
        // Note: We don't re-attach the Firestore listener just for sorting changes anymore
    }
}

// --- Filter Change Handlers ---
function handleFilterChange() {
    console.log("[DEBUG] Filter input changed.");
    applyFiltersAndRender();
}

function handleSearchInput() {
    // Debounce the search input to avoid filtering on every keystroke
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        console.log("[DEBUG] Search input processed (debounced).");
        applyFiltersAndRender();
    }, 300); // Wait 300ms after last keystroke
}

function clearFilters() {
    console.log("[DEBUG] Clearing filters.");
    if(filterDateInput) filterDateInput.value = '';
    if(filterSearchInput) filterSearchInput.value = '';
    // Optionally reset sort dropdown? Decide based on desired UX.
    // if(sortSelect) sortSelect.value = 'createdAt_desc';
    // currentSortField = 'createdAt';
    // currentSortDirection = 'desc';
    applyFiltersAndRender(); // Re-render with cleared filters
}


// --- Firestore Listener Setup ---
// This function now ONLY fetches the initial data and stores it.
// Filtering and rendering happen separately.
function listenForOrders() {
    if (unsubscribeOrders) {
        console.log("[DEBUG] Unsubscribing previous order listener.");
        unsubscribeOrders();
        unsubscribeOrders = null;
    }
    if (!db || !collection || !query || !orderBy || !onSnapshot) {
        console.error("[DEBUG] Firestore functions not available!");
        orderTableBody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Error: Cannot connect to database functions.</td></tr>`;
        return;
    }

    // Show loading state in table
    orderTableBody.innerHTML = `<tr><td colspan="8" id="loadingMessage" style="text-align: center; color: #666;">Loading orders...</td></tr>`;

    try {
        console.log(`[DEBUG] Setting up Firestore listener for ALL orders (initial fetch)...`);
        const ordersRef = collection(db, "orders");
        // Fetch initial data sorted by default (e.g., createdAt desc)
        // Note: This initial sort only affects the first display if no filters are set.
        // The actual display sort is handled client-side in applyFiltersAndRender.
        const initialQuery = query(ordersRef, orderBy(currentSortField, currentSortDirection));

        unsubscribeOrders = onSnapshot(initialQuery, (snapshot) => {
            console.log(`[DEBUG] Received ${snapshot.docs.length} total orders from Firestore snapshot.`);
            // Store ALL orders in the global cache
            allOrdersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`[DEBUG] Stored ${allOrdersCache.length} orders in allOrdersCache.`);

            // Apply current filters (if any) and render the table
            applyFiltersAndRender();

        }, (error) => {
            console.error("[DEBUG] Error fetching orders snapshot:", error);
            orderTableBody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Error loading orders: ${error.message}. Please check console.</td></tr>`;
            unsubscribeOrders = null;
        });

    } catch (error) {
        console.error("[DEBUG] Error setting up Firestore listener:", error);
         orderTableBody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Error setting up listener: ${error.message}.</td></tr>`;
         unsubscribeOrders = null;
    }
}


// --- Filter, Sort, and Render Function ---
function applyFiltersAndRender() {
    if (!allOrdersCache) {
        console.warn("[DEBUG] applyFiltersAndRender called before allOrdersCache is populated.");
        return;
    }
    console.log("[DEBUG] Applying filters and rendering...");

    // 1. Get current filter values
    const filterDateValue = filterDateInput ? filterDateInput.value : ''; // YYYY-MM-DD
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';

    // 2. Filter the cached data
    let filteredOrders = allOrdersCache.filter(order => {
        // Date Filter
        if (filterDateValue) {
            // Ensure order.orderDate exists and matches the filter date
            // Note: Firestore date might be string or Timestamp. Handle accordingly.
            // Assuming order.orderDate is stored as "YYYY-MM-DD" string matching the input.
             if (!order.orderDate || order.orderDate !== filterDateValue) {
                 return false; // Doesn't match date filter
             }
        }

        // Search Filter (Order ID or Customer Name)
        if (filterSearchValue) {
            const orderIdString = order.orderId || ''; // Use saved orderId field
            const customerNameString = order.customerDetails?.fullName || '';
            const firestoreIdString = order.id || ''; // Include Firestore ID in search

             if (!(orderIdString.toLowerCase().includes(filterSearchValue) ||
                   customerNameString.toLowerCase().includes(filterSearchValue) ||
                   firestoreIdString.toLowerCase().includes(filterSearchValue) // Search Firestore ID too
                 )) {
                 return false; // Doesn't match search filter
             }
        }

        return true; // Passes all filters
    });
    console.log(`[DEBUG] Filtered down to ${filteredOrders.length} orders.`);


    // 3. Sort the filtered data
    // Sorting logic needs careful handling of data types (dates, numbers, strings)
    filteredOrders.sort((a, b) => {
        let valA = a[currentSortField];
        let valB = b[currentSortField];

        // Handle nested properties like customerDetails.fullName if needed
        // if (currentSortField === 'customerName') { // Example
        //     valA = a.customerDetails?.fullName || '';
        //     valB = b.customerDetails?.fullName || '';
        // }

        // Handle Timestamps (createdAt, updatedAt)
        if (valA && typeof valA.toDate === 'function') valA = valA.toDate();
        if (valB && typeof valB.toDate === 'function') valB = valB.toDate();

        // Handle Dates (orderDate, deliveryDate - assuming YYYY-MM-DD strings)
        if (currentSortField === 'orderDate' || currentSortField === 'deliveryDate') {
            // Convert valid date strings to Date objects for comparison
             valA = valA ? new Date(valA) : null;
             valB = valB ? new Date(valB) : null;
             // Handle cases where one date is null/invalid
             if (!valA && !valB) return 0;
             if (!valA) return currentSortDirection === 'asc' ? 1 : -1; // Nulls last in asc, first in desc? Adjust as needed.
             if (!valB) return currentSortDirection === 'asc' ? -1 : 1;
        }


        let comparison = 0;
        if (valA > valB) {
            comparison = 1;
        } else if (valA < valB) {
            comparison = -1;
        }

        return currentSortDirection === 'desc' ? comparison * -1 : comparison;
    });
     console.log(`[DEBUG] Sorted ${filteredOrders.length} orders.`);


    // 4. Render the filtered and sorted data
    orderTableBody.innerHTML = ''; // Clear the table body
    currentOrderDataCache = {}; // Reset display cache

    if (filteredOrders.length === 0) {
        orderTableBody.innerHTML = `<tr><td colspan="8" id="noOrdersMessage" style="text-align: center; color: #666;">No orders found matching filters.</td></tr>`;
    } else {
        filteredOrders.forEach(order => {
            currentOrderDataCache[order.id] = order; // Add to display cache
            displayOrderRow(order.id, order); // Render row
        });
    }
    console.log("[DEBUG] Rendering complete.");
}


// --- Display Single Order Row in Table (No changes needed from previous version) ---
function displayOrderRow(firestoreId, data) { /* ... (same as before) ... */
    const tableRow = document.createElement('tr');
    tableRow.setAttribute('data-id', firestoreId);

    const customerName = data.customerDetails?.fullName || 'N/A';
    const orderDate = data.orderDate ? new Date(data.orderDate).toLocaleDateString() : '-';
    const deliveryDate = data.deliveryDate ? new Date(data.deliveryDate).toLocaleDateString() : '-';
    const displayId = data.orderId || `(Sys: ${firestoreId.substring(0,6)}...)`;
    const status = data.status || 'Unknown';
    const priority = data.urgent || 'No';

    const statusClass = `status-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const priorityClass = priority === 'Yes' ? 'priority-yes' : 'priority-no';

    tableRow.innerHTML = `
        <td>${displayId}</td>
        <td>${customerName}</td>
        <td>${orderDate}</td>
        <td>${deliveryDate}</td>
        <td class="${priorityClass}">${priority}</td>
        <td><span class="status-badge ${statusClass}">${status}</span></td>
        <td>
            <button type="button" class="button details-edit-button" title="View Details / Edit Status">
                <i class="fas fa-info-circle"></i> Details/Edit
            </button>
        </td>
        <td>
             <button type="button" class="whatsapp-button" title="Send WhatsApp Update">
                <i class="fab fa-whatsapp"></i>
            </button>
        </td>
    `;

    const detailsButton = tableRow.querySelector('.details-edit-button');
    if (detailsButton) {
        detailsButton.addEventListener('click', (e) => {
             e.stopPropagation();
            openDetailsModal(firestoreId);
        });
    }

    const whatsappButton = tableRow.querySelector('.whatsapp-button');
    if (whatsappButton) {
        whatsappButton.addEventListener('click', (e) => {
             e.stopPropagation();
            sendWhatsAppMessage(firestoreId);
        });
    }

    orderTableBody.appendChild(tableRow);
}

// --- Modal 1 (Details/Edit) Handling (No changes needed) ---
function openDetailsModal(firestoreId) { /* ... (same as before) ... */
    const orderData = currentOrderDataCache[firestoreId];
    if (!orderData || !detailsModal) {
        console.error("[DEBUG] Cannot open modal, order data not found in cache for ID:", firestoreId);
        alert("Could not load order details. Please refresh the page.");
        return;
    }
    console.log("[DEBUG] Opening details modal for Firestore ID:", firestoreId);
    modalOrderIdInput.value = firestoreId;
    modalDisplayOrderIdSpan.textContent = orderData.orderId || `(Sys: ${firestoreId.substring(0,6)}...)`;
    modalCustomerNameSpan.textContent = orderData.customerDetails?.fullName || 'N/A';
    modalOrderStatusSelect.value = orderData.status || '';
    detailsModal.style.display = 'flex';
}
function closeDetailsModal() { /* ... (same as before) ... */
    if (detailsModal) {
        detailsModal.style.display = 'none';
         console.log("[DEBUG] Details modal closed.");
    }
}

// --- Modal 1 Action Handlers (No changes needed) ---
async function handleUpdateStatus() { /* ... (same as before, triggers WhatsApp popup) ... */
    const firestoreId = modalOrderIdInput.value;
    const newStatus = modalOrderStatusSelect.value;
    if (!firestoreId || !newStatus) { alert("Error: Missing order ID or status for update."); return; }
    if (!db || !doc || !updateDoc) { alert("Error: Database update function not available."); return; }
    console.log(`[DEBUG] Attempting to update status for ${firestoreId} to ${newStatus}`);
    modalUpdateStatusBtn.disabled = true;
    modalUpdateStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    try {
        const orderRef = doc(db, "orders", firestoreId);
        await updateDoc(orderRef, { status: newStatus, updatedAt: new Date() });
        console.log(`[DEBUG] Status updated successfully in Firestore for ${firestoreId}`);
        const orderData = currentOrderDataCache[firestoreId];
        if (orderData && orderData.customerDetails) {
             const displayId = orderData.orderId || `(Sys: ${firestoreId.substring(0,6)}...)`;
             showStatusUpdateWhatsAppReminder(orderData.customerDetails, displayId, newStatus);
        } else {
            console.warn("[DEBUG] Could not show WhatsApp reminder post-update: Customer details missing.");
            alert("Status updated, but couldn't prepare WhatsApp message.");
            closeDetailsModal();
        }
    } catch (error) {
        console.error(`[DEBUG] Error updating status for ${firestoreId}:`, error);
        alert(`Failed to update status: ${error.message}`);
    } finally {
        modalUpdateStatusBtn.disabled = false;
        modalUpdateStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Status';
    }
}
function handleDeleteFromModal() { /* ... (same as before) ... */
    const firestoreId = modalOrderIdInput.value;
    const displayId = modalDisplayOrderIdSpan.textContent;
    if (!firestoreId) { alert("Error: Could not find Order ID to delete."); return; }
    console.log(`[DEBUG] Delete initiated from modal for Firestore ID: ${firestoreId}`);
    closeDetailsModal();
    handleDeleteOrder(firestoreId, displayId);
}
function handleEditFullFromModal() { /* ... (same as before) ... */
    const firestoreId = modalOrderIdInput.value;
    if (!firestoreId) { alert("Error: Could not find Order ID to edit."); return; }
    console.log(`[DEBUG] Redirecting to full edit page for Firestore ID: ${firestoreId}`);
    window.location.href = `new_order.html?editOrderId=${firestoreId}`;
}

// --- Main Delete Order Function (No changes needed) ---
async function handleDeleteOrder(firestoreId, orderDisplayId) { /* ... (same as before) ... */
    console.log(`[DEBUG] handleDeleteOrder called for Firestore ID: ${firestoreId}`);
    if (!db || !doc || !deleteDoc) { alert("Error: Delete function not available."); return; }
    if (confirm(`Are you sure you want to permanently delete Order ID: ${orderDisplayId}? This action cannot be undone.`)) {
        console.log(`[DEBUG] User confirmed deletion for ${firestoreId}.`);
        try {
            const orderRef = doc(db, "orders", firestoreId);
            await deleteDoc(orderRef);
            console.log(`[DEBUG] Order deleted successfully from Firestore: ${firestoreId}`);
        } catch (error) {
            console.error(`[DEBUG] Error deleting order ${firestoreId}:`, error);
            alert(`Failed to delete order: ${error.message}`);
        }
    } else {
        console.log("[DEBUG] Deletion cancelled by user.");
    }
}

// --- Modal 2 (WhatsApp Reminder) Handling (No changes needed) ---
function showStatusUpdateWhatsAppReminder(customer, orderId, updatedStatus) { /* ... (same as before) ... */
    if (!whatsappReminderPopup || !whatsappMsgPreview || !whatsappSendLink) { console.error("[DEBUG] WhatsApp popup elements missing."); closeDetailsModal(); alert("Status Updated, but failed to show WhatsApp prompt."); return; }
    const customerName = customer.fullName || 'Customer';
    const customerNumber = customer.whatsappNo?.replace(/[^0-9]/g, '');
    if (!customerNumber) { console.warn("[DEBUG] WhatsApp No missing for status update reminder. Skipping popup."); closeDetailsModal(); alert("Status Updated! (Customer WhatsApp number missing for sending update)."); return; }
    let message = `Hello ${customerName},\n\nUpdate for your order (ID: ${orderId}):\nThe status has been updated to: *${updatedStatus}*.\n\nThank you!`;
    whatsappMsgPreview.innerText = message;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customerNumber}?text=${encodedMessage}`;
    whatsappSendLink.href = whatsappUrl;
    whatsappReminderPopup.classList.add('active');
    console.log("[DEBUG] Status update WhatsApp reminder shown.");
}
function closeWhatsAppPopup() { /* ... (same as before) ... */
     if (whatsappReminderPopup) {
        whatsappReminderPopup.classList.remove('active');
        console.log("[DEBUG] WhatsApp reminder popup closed.");
        // Decide whether to close the details modal too
        // closeDetailsModal(); // Uncomment if desired
    }
}

// --- Table Row WhatsApp Button Handler (No changes needed) ---
function sendWhatsAppMessage(firestoreId) { /* ... (same as before) ... */
     const orderData = currentOrderDataCache[firestoreId];
    if (!orderData) { console.error("[DEBUG] Cannot send WhatsApp from table, order data missing for ID:", firestoreId); alert("Could not load order details for WhatsApp. Please refresh."); return; }
     const customer = orderData.customerDetails;
     const orderId = orderData.orderId || `(Sys: ${firestoreId.substring(0,6)}...)`;
     const status = orderData.status;
    if (!customer || !customer.whatsappNo) { alert("Customer WhatsApp number is missing for this order."); return; }
    const customerName = customer.fullName || 'Customer';
    const customerNumber = customer.whatsappNo.replace(/[^0-9]/g, '');
    let message = `Hello ${customerName},\nRegarding your order (ID: ${orderId}).\nCurrent Status: *${status}*.\n\nThank you!`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customerNumber}?text=${encodedMessage}`;
    console.log(`[DEBUG] Opening WhatsApp URL from table button: ${whatsappUrl}`);
    window.open(whatsappUrl, '_blank');
}


// --- Final Log ---
console.log("order_history.js script fully loaded and initialized (v4 - Filters Added).");