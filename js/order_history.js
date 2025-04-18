// js/order_history.js

// --- Ensure Firestore functions are available globally ---
const { db, collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc } = window;

// --- DOM Elements ---
const orderTableBody = document.getElementById('orderTableBody');
const loadingRow = document.getElementById('loadingMessage');
const sortSelect = document.getElementById('sort-orders');
const filterDateInput = document.getElementById('filterDate');
const filterSearchInput = document.getElementById('filterSearch');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');

// Modal 1 Elements
const detailsModal = document.getElementById('detailsModal');
const closeModalBtn = document.getElementById('closeDetailsModal');
const modalOrderIdInput = document.getElementById('modalOrderId');
const modalDisplayOrderIdSpan = document.getElementById('modalDisplayOrderId');
const modalCustomerNameSpan = document.getElementById('modalCustomerName');
const modalOrderStatusSelect = document.getElementById('modalOrderStatus');
const modalUpdateStatusBtn = document.getElementById('modalUpdateStatusBtn');
const modalDeleteBtn = document.getElementById('modalDeleteBtn');
const modalEditFullBtn = document.getElementById('modalEditFullBtn');
const modalProductListContainer = document.getElementById('modalProductList');

// Modal 2 Elements
const whatsappReminderPopup = document.getElementById('whatsapp-reminder-popup');
const whatsappPopupCloseBtn = document.getElementById('popup-close-btn');
const whatsappMsgPreview = document.getElementById('whatsapp-message-preview');
const whatsappSendLink = document.getElementById('whatsapp-send-link');

// --- Global State ---
let currentSortField = 'createdAt';
let currentSortDirection = 'desc';
let unsubscribeOrders = null;
let allOrdersCache = [];
let currentOrderDataCache = {};
let searchDebounceTimer;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DEBUG] Order History DOM Loaded (v8 - Inline Products).");
    waitForDbConnection(() => {
        console.log("[DEBUG] DB connection confirmed. Initializing listener.");
        listenForOrders();

        // Event Listeners
        if (sortSelect) sortSelect.addEventListener('change', handleSortChange);
        if (filterDateInput) filterDateInput.addEventListener('change', handleFilterChange);
        if (filterSearchInput) filterSearchInput.addEventListener('input', handleSearchInput);
        if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeDetailsModal);
        if (detailsModal) detailsModal.addEventListener('click', (event) => { if (event.target === detailsModal) closeDetailsModal(); });
        if (modalUpdateStatusBtn) modalUpdateStatusBtn.addEventListener('click', handleUpdateStatus);
        if (modalDeleteBtn) modalDeleteBtn.addEventListener('click', handleDeleteFromModal);
        if (modalEditFullBtn) modalEditFullBtn.addEventListener('click', handleEditFullFromModal);
        if (whatsappPopupCloseBtn) whatsappPopupCloseBtn.addEventListener('click', closeWhatsAppPopup);
        if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (event) => { if (event.target === whatsappReminderPopup) closeWhatsAppPopup(); });
        console.log("[DEBUG] All event listeners set up.");
    });
});

// --- DB Connection Wait ---
function waitForDbConnection(callback) { /* ... (same as before) ... */
    if (window.db) { callback(); } else {
        let attempts = 0; const maxAttempts = 20;
        const intervalId = setInterval(() => {
            attempts++;
            if (window.db) { clearInterval(intervalId); callback(); }
            else if (attempts >= maxAttempts) { clearInterval(intervalId); console.error("DB timeout"); alert("DB Error"); }
        }, 250);
    }
 }

// --- Sorting & Filtering Handlers ---
function handleSortChange() { /* ... (same as before) ... */
    if (!sortSelect) return;
    const selectedValue = sortSelect.value;
    const [field, direction] = selectedValue.split('_');
    if (field && direction) {
        if (field === currentSortField && direction === currentSortDirection) return;
        currentSortField = field;
        currentSortDirection = direction;
        applyFiltersAndRender();
    }
}
function handleFilterChange() { applyFiltersAndRender(); }
function handleSearchInput() { clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(applyFiltersAndRender, 300); }
function clearFilters() { /* ... (same as before) ... */
    if(filterDateInput) filterDateInput.value = '';
    if(filterSearchInput) filterSearchInput.value = '';
    if(sortSelect) sortSelect.value = 'createdAt_desc';
    currentSortField = 'createdAt';
    currentSortDirection = 'desc';
    applyFiltersAndRender();
}

// --- Firestore Listener ---
function listenForOrders() {
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    if (!db || !collection || !query || !orderBy || !onSnapshot) { /* Error */ return; }
    // Update colspan to 8
    orderTableBody.innerHTML = `<tr><td colspan="8" id="loadingMessage" style="text-align: center; color: #666;">Loading orders...</td></tr>`;
    try {
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef);
        unsubscribeOrders = onSnapshot(q, (snapshot) => {
            allOrdersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            applyFiltersAndRender();
        }, (error) => { /* Error handling */ });
    } catch (error) { /* Error handling */ }
}

// --- Filter, Sort, Render ---
function applyFiltersAndRender() {
    if (!allOrdersCache) return;
    const filterDateValue = filterDateInput ? filterDateInput.value : '';
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';

    // Filter
    let filteredOrders = allOrdersCache.filter(order => {
        if (filterDateValue && (!order.orderDate || order.orderDate !== filterDateValue)) return false;
        if (filterSearchValue) {
            const orderIdString = order.orderId || '';
            const customerNameString = order.customerDetails?.fullName || '';
            const firestoreIdString = order.id || '';
            const productsString = (order.products || []).map(p => p.name || '').join(' ').toLowerCase();
             if (!(orderIdString.toLowerCase().includes(filterSearchValue) ||
                   customerNameString.toLowerCase().includes(filterSearchValue) ||
                   firestoreIdString.toLowerCase().includes(filterSearchValue) ||
                   productsString.includes(filterSearchValue) )) return false;
        }
        return true;
    });

    // Sort
    filteredOrders.sort((a, b) => { /* ... (same sorting logic as before) ... */
        let valA = a[currentSortField]; let valB = b[currentSortField];
        if (valA && typeof valA.toDate === 'function') valA = valA.toDate();
        if (valB && typeof valB.toDate === 'function') valB = valB.toDate();
        if (currentSortField === 'orderDate' || currentSortField === 'deliveryDate') {
             valA = valA ? new Date(valA) : null; valB = valB ? new Date(valB) : null;
             if (!valA && !valB) return 0; if (!valA) return currentSortDirection === 'asc' ? 1 : -1; if (!valB) return currentSortDirection === 'asc' ? -1 : 1;
        }
        let comparison = 0;
        if (valA > valB) comparison = 1; else if (valA < valB) comparison = -1;
        return currentSortDirection === 'desc' ? comparison * -1 : comparison;
     });

    // Render
    orderTableBody.innerHTML = '';
    currentOrderDataCache = {};
    if (filteredOrders.length === 0) {
        orderTableBody.innerHTML = `<tr><td colspan="8" id="noOrdersMessage" style="text-align: center; color: #666;">No orders found matching filters.</td></tr>`; // Colspan = 8
    } else {
        filteredOrders.forEach(order => {
            currentOrderDataCache[order.id] = order;
            displayOrderRow(order.id, order);
        });
    }
}

// --- <<< Display Row Function Updated >>> ---
function displayOrderRow(firestoreId, data) {
    const tableRow = document.createElement('tr');
    tableRow.setAttribute('data-id', firestoreId);

    // Extract data
    const customerName = data.customerDetails?.fullName || 'N/A';
    const orderDate = data.orderDate ? new Date(data.orderDate).toLocaleDateString() : '-';
    const deliveryDate = data.deliveryDate ? new Date(data.deliveryDate).toLocaleDateString() : '-';
    const displayId = data.orderId || `(Sys: ${firestoreId.substring(0,6)}...)`;
    const status = data.status || 'Unknown';
    const priority = data.urgent || 'No';

    // Generate product list HTML for the table cell
    let productsHtml = '-';
    if (Array.isArray(data.products) && data.products.length > 0) {
        productsHtml = data.products.map(p => {
            const name = p.name || 'Unnamed';
            const qty = p.quantity || '?';
            // Escape HTML characters in product name just in case
            const safeName = name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return `${safeName} (${qty})`;
        }).join('<br>'); // Use line breaks between products
    }

    // CSS classes
    const statusClass = `status-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const priorityClass = priority === 'Yes' ? 'priority-yes' : 'priority-no';

    // Create table cells (8 columns now)
    tableRow.innerHTML = `
        <td>${displayId}</td>
        <td>
            <span class="customer-name-display">${customerName}</span>
            <div class="product-list-inline">${productsHtml}</div>
        </td>
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

    // Add event listeners
    const detailsButton = tableRow.querySelector('.details-edit-button');
    if (detailsButton) detailsButton.addEventListener('click', (e) => { e.stopPropagation(); openDetailsModal(firestoreId); });
    const whatsappButton = tableRow.querySelector('.whatsapp-button');
    if (whatsappButton) whatsappButton.addEventListener('click', (e) => { e.stopPropagation(); sendWhatsAppMessage(firestoreId); });

    orderTableBody.appendChild(tableRow);
}


// --- Modal 1 Handling (Product display inside remains the same) ---
function openDetailsModal(firestoreId) {
    const orderData = currentOrderDataCache[firestoreId];
    if (!orderData || !detailsModal) { /* Error handling */ return; }
    console.log("[DEBUG] Opening details modal for Firestore ID:", firestoreId);

    modalOrderIdInput.value = firestoreId;
    modalDisplayOrderIdSpan.textContent = orderData.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`;
    modalCustomerNameSpan.textContent = orderData.customerDetails?.fullName || 'N/A';
    modalOrderStatusSelect.value = orderData.status || '';

    // Populate Product List in Modal (Code is unchanged, still works)
    if (modalProductListContainer) {
        modalProductListContainer.innerHTML = '';
        const products = orderData.products;
        if (Array.isArray(products) && products.length > 0) {
            const ul = document.createElement('ul');
            products.forEach(product => {
                const li = document.createElement('li');
                const nameSpan = document.createElement('span'); nameSpan.classList.add('product-name'); nameSpan.textContent = product.name || 'Unnamed Product';
                const qtySpan = document.createElement('span'); qtySpan.classList.add('product-qty-details'); qtySpan.textContent = `Qty: ${product.quantity || 'N/A'}`;
                li.appendChild(nameSpan); li.appendChild(qtySpan); ul.appendChild(li);
            });
            modalProductListContainer.appendChild(ul);
        } else { /* Show 'No products' message */ }
    } else { console.error("[DEBUG] Product list container #modalProductList not found."); }

    detailsModal.style.display = 'flex';
}


// --- Other Functions (closeDetailsModal, handleUpdateStatus, etc.) ---
// No changes needed in the logic of these functions from the previous version
function closeDetailsModal() { /* ... */ if (detailsModal) { detailsModal.style.display = 'none'; } }
async function handleUpdateStatus() { /* ... (same as before, triggers WhatsApp popup) ... */
    const firestoreId = modalOrderIdInput.value; const newStatus = modalOrderStatusSelect.value;
    if (!firestoreId || !newStatus || !db || !doc || !updateDoc) return;
    modalUpdateStatusBtn.disabled = true; modalUpdateStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    try {
        await updateDoc(doc(db, "orders", firestoreId), { status: newStatus, updatedAt: new Date() });
        const orderData = currentOrderDataCache[firestoreId];
        if (orderData && orderData.customerDetails) { showStatusUpdateWhatsAppReminder(orderData.customerDetails, orderData.orderId || `(Sys: ${firestoreId.substring(0,6)}...)`, newStatus); }
        else { alert("Status updated, but couldn't prepare WhatsApp message."); closeDetailsModal(); }
    } catch (error) { alert(`Failed to update status: ${error.message}`); }
    finally { modalUpdateStatusBtn.disabled = false; modalUpdateStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Status'; }
}
function handleDeleteFromModal() { /* ... */ const firestoreId = modalOrderIdInput.value; const displayId = modalDisplayOrderIdSpan.textContent; if (!firestoreId) return; closeDetailsModal(); handleDeleteOrder(firestoreId, displayId); }
function handleEditFullFromModal() { /* ... */ const firestoreId = modalOrderIdInput.value; if (!firestoreId) return; window.location.href = `new_order.html?editOrderId=${firestoreId}`; }
async function handleDeleteOrder(firestoreId, orderDisplayId) { /* ... */ if (!db || !doc || !deleteDoc) return; if (confirm(`Delete Order ID: ${orderDisplayId}?`)) { try { await deleteDoc(doc(db, "orders", firestoreId)); } catch (error) { /* Error */ } } }
function showStatusUpdateWhatsAppReminder(customer, orderId, updatedStatus) { /* ... */ if (!whatsappReminderPopup) return; const customerName = customer.fullName || 'Customer'; const customerNumber = customer.whatsappNo?.replace(/[^0-9]/g, ''); if (!customerNumber) return; let message = `Hello ${customerName},\n\nUpdate for your order (ID: ${orderId}):\nThe status has been updated to: *${updatedStatus}*.\n\nThank you!`; whatsappMsgPreview.innerText = message; const encodedMessage = encodeURIComponent(message); const whatsappUrl = `https://wa.me/${customerNumber}?text=${encodedMessage}`; whatsappSendLink.href = whatsappUrl; whatsappReminderPopup.classList.add('active'); }
function closeWhatsAppPopup() { /* ... */ if (whatsappReminderPopup) { whatsappReminderPopup.classList.remove('active'); } }
function sendWhatsAppMessage(firestoreId) { /* ... */ const orderData = currentOrderDataCache[firestoreId]; if (!orderData || !orderData.customerDetails || !orderData.customerDetails.whatsappNo) return; const customer = orderData.customerDetails; const orderId = orderData.orderId || `(Sys: ${firestoreId.substring(0,6)}...)`; const status = orderData.status; const customerName = customer.fullName || 'Customer'; const customerNumber = customer.whatsappNo.replace(/[^0-9]/g, ''); let message = `Hello ${customerName},\nRegarding your order (ID: ${orderId}).\nCurrent Status: *${status}*.\n\nThank you!`; const encodedMessage = encodeURIComponent(message); const whatsappUrl = `https://wa.me/${customerNumber}?text=${encodedMessage}`; window.open(whatsappUrl, '_blank'); }

// --- Final Log ---
console.log("order_history.js script fully loaded and initialized (v8 - Inline Products).");