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
let activeOrderDataForModal = null;
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
        if (modalUpdateStatusBtn) modalUpdateStatusBtn.addEventListener('click', handleUpdateStatus);
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
                const orderData = findOrderInCache(firestoreId);

                if (!orderData) {
                    console.warn(`Order data not found in cache for ID: ${firestoreId}`);
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
                    const poId = target.dataset.poid;
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
        const q = query(collection(db, "orders"));
        unsubscribeOrders = onSnapshot(q, (snapshot) => {
            allOrdersCache = snapshot.docs.map(doc => ({
                 id: doc.id,
                 data: {
                     id: doc.id,
                     orderId: doc.data().orderId || '',
                     customerDetails: doc.data().customerDetails || {}, // Contains customerId
                     products: doc.data().products || [],
                     orderDate: doc.data().orderDate || null,
                     deliveryDate: doc.data().deliveryDate || null,
                     urgent: doc.data().urgent || 'No',
                     status: doc.data().status || 'Unknown',
                     statusHistory: doc.data().statusHistory || [],
                     createdAt: doc.data().createdAt || null,
                     updatedAt: doc.data().updatedAt || null,
                     remarks: doc.data().remarks || '',
                     totalAmount: doc.data().totalAmount || 0, // Needed for Account Data
                     amountPaid: doc.data().amountPaid || 0,   // Needed for Account Data
                     paymentStatus: doc.data().paymentStatus || 'Pending', // Needed for Account Data
                     linkedPOs: doc.data().linkedPOs || [] // Needed for PO Info
                 }
             }));

            selectedOrderIds.clear(); updateBulkActionsBar();
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
            applyFiltersAndRender();
            attemptOpenModalFromUrl();

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
    currentStatusFilter = filterStatusValue;

    let filteredOrders = allOrdersCache.filter(orderWrapper => {
        const order = orderWrapper.data;
        if (!order) return false;
        if (filterStatusValue && order.status !== filterStatusValue) return false;
        if (filterDateValue) {
            let orderDateStr = '';
            if (order.orderDate && typeof order.orderDate.toDate === 'function') { try { orderDateStr = order.orderDate.toDate().toISOString().split('T')[0]; } catch(e){} }
            else if (typeof order.orderDate === 'string') { orderDateStr = order.orderDate; }
            if(orderDateStr !== filterDateValue) return false;
        }
        if (filterSearchValue) {
            const fieldsToSearch = [
                String(order.orderId || '').toLowerCase(),
                String(order.customerDetails?.fullName || '').toLowerCase(),
                String(order.id || '').toLowerCase(),
                String(order.customerDetails?.whatsappNo || ''),
                String(order.customerDetails?.contactNo || ''),
                (order.products || []).map(p => String(p.name || '')).join(' ').toLowerCase()
            ];
            if (!fieldsToSearch.some(field => field.includes(filterSearchValue))) {
                return false;
            }
        }
        return true;
    });

    try {
        filteredOrders.sort((aWrapper, bWrapper) => {
            const a = aWrapper.data; const b = bWrapper.data;
            let valA = a[currentSortField]; let valB = b[currentSortField];
            if (valA && typeof valA.toDate === 'function') valA = valA.toDate().getTime();
            if (valB && typeof valB.toDate === 'function') valB = valB.toDate().getTime();
            if (currentSortField === 'orderDate' || currentSortField === 'deliveryDate') {
                 const dateA = valA ? new Date(valA).getTime() : null; const dateB = valB ? new Date(valB).getTime() : null;
                 if (isNaN(dateA) && isNaN(dateB)) return 0; if (isNaN(dateA)) return currentSortDirection === 'asc' ? 1 : -1;
                 if (isNaN(dateB)) return currentSortDirection === 'asc' ? -1 : 1;
                 valA = dateA; valB = dateB;
            }
            let sortComparison = 0;
            if (valA > valB) sortComparison = 1; else if (valA < valB) sortComparison = -1;
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
        const searchTerm = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';
        currentlyDisplayedOrders.forEach(order => { displayOrderRow(order.id, order, searchTerm); });
    }

    if (selectAllCheckbox) {
        const allRowCheckboxes = orderTableBody.querySelectorAll('.row-selector');
        const allVisibleSelected = allRowCheckboxes.length > 0 && Array.from(allRowCheckboxes).every(cb => cb.checked);
        const someVisibleSelected = Array.from(allRowCheckboxes).some(cb => cb.checked);
        selectAllCheckbox.checked = allVisibleSelected;
        selectAllCheckbox.indeterminate = !allVisibleSelected && someVisibleSelected;
    }
}

function updateOrderCountsAndReport(displayedOrders) {
    const total = displayedOrders.length; let completedDelivered = 0; const statusCounts = {};
    displayedOrders.forEach(order => { const status = order.status || 'Unknown'; if (status === 'Completed' || status === 'Delivered') completedDelivered++; statusCounts[status] = (statusCounts[status] || 0) + 1; });
    const pending = total - completedDelivered;
    if (totalOrdersSpan) totalOrdersSpan.textContent = total;
    if (completedOrdersSpan) completedOrdersSpan.textContent = completedDelivered;
    if (pendingOrdersSpan) pendingOrdersSpan.textContent = pending;
    if (statusCountsReportContainer) {
        if (total === 0) { statusCountsReportContainer.innerHTML = '<p>No orders to report.</p>'; }
        else { let reportHtml = '<ul>'; Object.keys(statusCounts).sort().forEach(status => { reportHtml += `<li>${escapeHtml(status)}: <strong>${statusCounts[status]}</strong></li>`; }); reportHtml += '</ul>'; statusCountsReportContainer.innerHTML = reportHtml; }
    }
}

function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { unsafe = String(unsafe || ''); } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function highlightMatch(text, term) { if (!term || !text) return text; const stringText = typeof text === 'string' ? text : String(text); try { const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'); const regex = new RegExp(`(${escapedTerm})`, 'gi'); return stringText.replace(regex, '<mark>$1</mark>'); } catch (e) { console.warn("Highlighting regex error:", e); return stringText; } }

function displayOrderRow(firestoreId, data, searchTerm = '') {
    if (!orderTableBody || !data) return;

    const tableRow = document.createElement('tr');
    tableRow.setAttribute('data-id', firestoreId);
    if (selectedOrderIds.has(firestoreId)) tableRow.classList.add('selected-row');

    const customerDetails = data.customerDetails || {};
    const customerName = customerDetails.fullName || 'N/A';
    const customerMobile = customerDetails.whatsappNo || '-';
    const orderDate = data.orderDate ? (typeof data.orderDate.toDate === 'function' ? data.orderDate.toDate() : new Date(data.orderDate)) : null;
    const deliveryDate = data.deliveryDate ? (typeof data.deliveryDate.toDate === 'function' ? data.deliveryDate.toDate() : new Date(data.deliveryDate)) : null;
    const orderDateStr = orderDate ? orderDate.toLocaleDateString('en-GB') : '-';
    const deliveryDateStr = deliveryDate ? deliveryDate.toLocaleDateString('en-GB') : '-';

    const displayId = data.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`;
    const orderIdHtml = `<a href="#" class="order-id-link" data-id="${firestoreId}">${highlightMatch(escapeHtml(displayId), searchTerm)}</a>`;
    const customerNameHtml = `<a href="#" class="customer-name-link" data-id="${firestoreId}">${highlightMatch(escapeHtml(customerName), searchTerm)}</a>`;

    const status = data.status || 'Unknown';
    const priority = data.urgent === 'Yes' ? 'Yes' : 'No';

    let productsHtml = '-';
    const products = data.products || [];
    const MAX_PRODUCTS_DISPLAY = 2; // Show max 2 products
    if (Array.isArray(products) && products.length > 0) {
        productsHtml = products.slice(0, MAX_PRODUCTS_DISPLAY).map(p => {
             const product = p || {}; const name = escapeHtml(String(product.name || 'Unnamed')); const quantity = escapeHtml(String(product.quantity || '?'));
             return `${highlightMatch(name, searchTerm)} (${highlightMatch(quantity, searchTerm)})`;
         }).join('<br>');
        if (products.length > MAX_PRODUCTS_DISPLAY) {
             productsHtml += `<br><a href="#" class="see-more-link" data-id="${firestoreId}">... (${products.length - MAX_PRODUCTS_DISPLAY} more)</a>`;
         }
    }

    const statusClass = `status-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const priorityClass = priority === 'Yes' ? 'priority-yes' : 'priority-no';

     let poInfoHtml = '';
     const linkedPOs = data.linkedPOs || [];
     if (linkedPOs.length > 0) {
         poInfoHtml = linkedPOs.map(po => {
             const poDate = po.createdAt && typeof po.createdAt.toDate === 'function' ? po.createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'N/A';
             return `<a href="#" class="view-po-details-link" data-poid="${po.poId}" title="View PO #${po.poNumber} Details">PO #${po.poNumber || 'N/A'}</a> (${poDate})`;
         }).join('<br>');
     } else {
         // Use icon only for create PO button
         poInfoHtml = `<button type="button" class="button create-po-button icon-only" data-id="${firestoreId}" title="Create Purchase Order"><i class="fas fa-file-alt"></i></button>`;
     }

    try {
        tableRow.innerHTML = `
            <td class="col-checkbox"><input type="checkbox" class="row-selector" data-id="${firestoreId}" ${selectedOrderIds.has(firestoreId) ? 'checked' : ''}></td>
            <td>${orderIdHtml}</td>
            <td> <span class="customer-name-display">${customerNameHtml}</span> <span class="customer-mobile-inline">${highlightMatch(escapeHtml(customerMobile), searchTerm)}</span> </td>
            <td>${productsHtml}</td>
            <td>${orderDateStr}</td>
            <td>${deliveryDateStr}</td>
            <td class="${priorityClass}">${priority}</td>
            <td><span class="status-badge ${statusClass}">${highlightMatch(escapeHtml(status), searchTerm)}</span></td>
            <td class="po-info-cell">${poInfoHtml}</td>
            <td><button type="button" class="button details-edit-button"><i class="fas fa-info-circle"></i> Details</button></td>
            <td><button type="button" class="button whatsapp-button" title="Send Status on WhatsApp"><i class="fab fa-whatsapp"></i></button></td>
        `;
        orderTableBody.appendChild(tableRow);
    } catch (error) {
        console.error(`Error creating table row HTML for order ${firestoreId}:`, error, data);
        const errorRow = document.createElement('tr');
        errorRow.innerHTML = `<td colspan="11" style="color: red; text-align: left;">Error displaying order: ${firestoreId}. Check console.</td>`;
        orderTableBody.appendChild(errorRow);
    }
}

// Open EDITABLE details modal
async function openDetailsModal(firestoreId, orderData) {
    if (!orderData || !detailsModal) return;
    activeOrderDataForModal = orderData;

    if(modalOrderIdInput) modalOrderIdInput.value = firestoreId;
    if(modalDisplayOrderIdSpan) modalDisplayOrderIdSpan.textContent = orderData.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`;
    if(modalCustomerNameSpan) modalCustomerNameSpan.textContent = orderData.customerDetails?.fullName || 'N/A';
    if(modalCustomerWhatsAppSpan) modalCustomerWhatsAppSpan.textContent = orderData.customerDetails?.whatsappNo || 'N/A';
    if(modalCustomerContactSpan) modalCustomerContactSpan.textContent = orderData.customerDetails?.contactNo || 'N/A';
    if(modalCustomerAddressSpan) modalCustomerAddressSpan.textContent = orderData.customerDetails?.address || 'N/A';

    const orderDate = orderData.orderDate ? (typeof orderData.orderDate.toDate === 'function' ? orderData.orderDate.toDate() : new Date(orderData.orderDate)) : null;
    const deliveryDate = orderData.deliveryDate ? (typeof orderData.deliveryDate.toDate === 'function' ? orderData.deliveryDate.toDate() : new Date(orderData.deliveryDate)) : null;
    if(modalOrderDateSpan) modalOrderDateSpan.textContent = orderDate ? orderDate.toLocaleDateString('en-GB') : 'N/A';
    if(modalDeliveryDateSpan) modalDeliveryDateSpan.textContent = deliveryDate ? deliveryDate.toLocaleDateString('en-GB') : 'N/A';
    if(modalPrioritySpan) modalPrioritySpan.textContent = orderData.urgent || 'No';
    if(modalRemarksSpan) modalRemarksSpan.textContent = orderData.remarks || 'None';

    if (modalProductListContainer) {
        modalProductListContainer.innerHTML = ''; // Clear previous
        const products = orderData.products;
        if (Array.isArray(products) && products.length > 0) {
            const ul = document.createElement('ul');
            ul.className = 'modal-product-list-ul';
            products.forEach(product => {
                const li = document.createElement('li');
                const nameSpan = document.createElement('span'); nameSpan.className = 'product-name'; nameSpan.textContent = product.name || 'Unnamed Product';
                const detailsSpan = document.createElement('span'); detailsSpan.className = 'product-qty-details'; detailsSpan.textContent = ` - Qty: ${product.quantity || '?'}`;
                li.append(nameSpan, detailsSpan);
                ul.appendChild(li);
            });
            modalProductListContainer.appendChild(ul);
        } else {
            modalProductListContainer.innerHTML = '<p class="no-products">No products listed.</p>';
        }
    }

    if(modalOrderStatusSelect) modalOrderStatusSelect.value = orderData.status || '';
    if (modalStatusHistoryListContainer) {
        modalStatusHistoryListContainer.innerHTML = '';
        const history = orderData.statusHistory;
        if (Array.isArray(history) && history.length > 0) {
            const sortedHistory = [...history].sort((a, b) => (b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0) - (a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0));
            const ul = document.createElement('ul'); ul.className = 'modal-status-history-ul';
            sortedHistory.forEach(entry => {
                const li = document.createElement('li');
                const statusSpan = document.createElement('span'); statusSpan.className = 'history-status'; statusSpan.textContent = entry.status || '?';
                const timeSpan = document.createElement('span'); timeSpan.className = 'history-time';
                 if (entry.timestamp && entry.timestamp.toDate) { const d = entry.timestamp.toDate(); timeSpan.textContent = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); }
                 else { timeSpan.textContent = '?'; }
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
    const paymentStatus = orderData.paymentStatus || (balanceDue <= 0 ? 'Paid' : 'Pending');
    if(modalTotalAmountSpan) modalTotalAmountSpan.textContent = `₹ ${totalAmount.toFixed(2)}`;
    if(modalAmountPaidSpan) modalAmountPaidSpan.textContent = `₹ ${amountPaid.toFixed(2)}`;
    if(modalBalanceDueSpan) modalBalanceDueSpan.textContent = `₹ ${balanceDue.toFixed(2)}`;
    if(modalPaymentStatusSpan) modalPaymentStatusSpan.textContent = paymentStatus;

    // Display POs
    await displayPOsInModal(firestoreId, orderData.linkedPOs || []); // Reuses the PO display logic

    detailsModal.style.display = 'flex';
}

async function displayPOsInModal(orderFirestoreId, linkedPOs) {
    if (!modalPOListContainer) return;
    modalPOListContainer.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading POs...</p>';

    if (!linkedPOs || linkedPOs.length === 0) {
        modalPOListContainer.innerHTML = '<p class="no-pos">No Purchase Orders linked to this order.</p>';
        return;
    }

    try {
        const poDetailsPromises = linkedPOs.map(poLink => getDoc(doc(db, "purchaseOrders", poLink.poId)).catch(err => null));
        const poSnapshots = await Promise.all(poDetailsPromises);

        const ul = document.createElement('ul');
        ul.className = 'modal-po-list-ul';

        poSnapshots.forEach((poDoc, index) => {
            const poLink = linkedPOs[index];
            const li = document.createElement('li');
            if (poDoc && poDoc.exists()) {
                const poData = poDoc.data();
                const poDate = poData.orderDate?.toDate ? poData.orderDate.toDate().toLocaleDateString('en-GB') : 'N/A';
                const supplierName = poData.supplierName || 'Unknown Supplier';
                li.innerHTML = `
                    <a href="#" class="view-po-details-link" data-poid="${poDoc.id}">PO #${poData.poNumber || 'N/A'}</a>
                    <span> - ${escapeHtml(supplierName)} (${poDate})</span>
                    <span> - Status: ${escapeHtml(poData.status || 'N/A')}</span>
                    <span> - Amount: ₹ ${(poData.totalAmount || 0).toFixed(2)}</span>
                `;
            } else {
                li.innerHTML = `<span>PO (ID: ${poLink.poId}) not found or error fetching</span>`;
                li.style.color = 'grey'; li.style.fontStyle = 'italic';
            }
            ul.appendChild(li);
        });
        modalPOListContainer.innerHTML = '';
        modalPOListContainer.appendChild(ul);

        ul.querySelectorAll('.view-po-details-link').forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const poId = event.target.closest('a').dataset.poid;
                if (poId) { openPODetailsPopup(poId); }
            });
        });

    } catch (error) {
        console.error("Error fetching PO details for modal:", error);
        modalPOListContainer.innerHTML = '<p class="error-message">Error loading POs.</p>';
    }
}

function closeDetailsModal() { if (detailsModal) detailsModal.style.display = 'none'; activeOrderDataForModal = null; }

async function handleUpdateStatus() {
    const firestoreId = modalOrderIdInput.value;
    const newStatus = modalOrderStatusSelect.value;
    if (!firestoreId || !newStatus || !activeOrderDataForModal) return;
    if (activeOrderDataForModal.status === newStatus) { alert("Status is already set to '" + newStatus + "'."); return; }

    if (modalUpdateStatusBtn) { modalUpdateStatusBtn.disabled = true; modalUpdateStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; }

    // Use Timestamp.now() for the history entry timestamp
    const historyEntry = { status: newStatus, timestamp: Timestamp.now() };

    try {
        await updateDoc(doc(db, "orders", firestoreId), {
            status: newStatus,
            updatedAt: serverTimestamp(), // Use server timestamp for the main document update time
            statusHistory: arrayUnion(historyEntry)
        });
        closeDetailsModal();
        if (activeOrderDataForModal.customerDetails?.whatsappNo) { showStatusUpdateWhatsAppReminder(activeOrderDataForModal.customerDetails, activeOrderDataForModal.orderId || `Sys:${firestoreId.substring(0,6)}`, newStatus); }
        else { alert("Status updated successfully!"); }
    } catch (e) {
        console.error("Error updating status:", e);
        alert("Error updating status: " + e.message);
    } finally {
        if (modalUpdateStatusBtn) { modalUpdateStatusBtn.disabled = false; modalUpdateStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Status'; }
    }
}

function handleDeleteFromModal() {
    const firestoreId = modalOrderIdInput.value; const displayId = modalDisplayOrderIdSpan.textContent;
    if (!firestoreId) return; closeDetailsModal();
    if (confirm(`Are you sure you want to permanently delete Order ID: ${displayId}? This cannot be undone.`)) { deleteSingleOrder(firestoreId); }
    else { console.log("Deletion cancelled by user."); }
}
async function deleteSingleOrder(firestoreId) { if (!db) { alert("Delete function is unavailable."); return; } try { await deleteDoc(doc(db, "orders", firestoreId)); alert("Order deleted successfully."); } catch (e) { console.error("Error deleting order:", e); alert("Error deleting order: " + e.message); } }
function handleEditFullFromModal() { const firestoreId = modalOrderIdInput.value; if (firestoreId) { window.location.href = `new_order.html?editOrderId=${firestoreId}`; } }
function handleCreatePOFromModal() { const orderFirestoreId = modalOrderIdInput.value; if (orderFirestoreId && activeOrderDataForModal) { closeDetailsModal(); openPOItemSelectionModal(orderFirestoreId, activeOrderDataForModal); } else { alert("Cannot create PO. Order details not loaded correctly."); } }

// WhatsApp Functions
function showStatusUpdateWhatsAppReminder(customer, orderId, updatedStatus) { if (!whatsappReminderPopup || !whatsappMsgPreview || !whatsappSendLink) return; const name = customer.fullName || 'Customer'; const num = customer.whatsappNo?.replace(/[^0-9]/g, ''); if (!num) return; let msg = getWhatsAppMessageTemplate(updatedStatus, name, orderId, null); whatsappMsgPreview.innerText = msg; const url = `https://wa.me/91${num}?text=${encodeURIComponent(msg)}`; whatsappSendLink.href = url; const title = document.getElementById('whatsapp-popup-title'); if(title) title.textContent = "Status Updated!"; whatsappReminderPopup.classList.add('active'); }
function closeWhatsAppPopup() { if (whatsappReminderPopup) whatsappReminderPopup.classList.remove('active'); }
function sendWhatsAppMessage(firestoreId, orderData) { if (!orderData?.customerDetails?.whatsappNo) { alert("WhatsApp number not found."); return; } const cust = orderData.customerDetails; const orderId = orderData.orderId || `Sys:${firestoreId.substring(0,6)}`; const status = orderData.status; const deliveryDate = orderData.deliveryDate; const name = cust.fullName || 'Customer'; const num = cust.whatsappNo.replace(/[^0-9]/g, ''); let msg = getWhatsAppMessageTemplate(status, name, orderId, deliveryDate); const url = `https://wa.me/91${num}?text=${encodeURIComponent(msg)}`; window.open(url, '_blank'); }
function getWhatsAppMessageTemplate(status, customerName, orderId, deliveryDate) { const namePlaceholder = "[Customer Name]"; const orderNoPlaceholder = "[ORDER_NO]"; const deliveryDatePlaceholder = "[DELIVERY_DATE]"; const companyName = "Madhav Offset"; const companyAddress = "Head Office: Moodh Market, Batadu"; const companyMobile = "9549116541"; const signature = `धन्यवाद,\n${companyName}\n${companyAddress}\nMobile: ${companyMobile}`; let template = ""; let deliveryDateText = "जल्द से जल्द"; try { if(deliveryDate) { const dDate = (typeof deliveryDate.toDate === 'function') ? deliveryDate.toDate() : new Date(deliveryDate); deliveryDateText = dDate.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); } } catch(e) {} function replaceAll(str, find, replace) { return str.split(find).join(replace); }
    switch (status) { case "Order Received": template = `प्रिय ${namePlaceholder},\nनमस्कार,\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) हमें सफलतापूर्वक प्राप्त हो गया है।\nहम इस ऑर्डर को ${deliveryDatePlaceholder} तक पूर्ण करने का प्रयास करेंगे।\n\nDear ${namePlaceholder},\nWe have successfully received your order (Order No: ${orderNoPlaceholder}).\nWe aim to complete it by ${deliveryDatePlaceholder}.`; break; case "Designing": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) का डिज़ाइन तैयार किया जा रहा है।\nजैसे ही डिज़ाइन तैयार होगा, हम आपसे पुष्टि के लिए संपर्क करेंगे।\n\nDear ${namePlaceholder},\nThe design for your order (Order No: ${orderNoPlaceholder}) is in progress.\nWe’ll contact you for confirmation once it’s ready.`; break; case "Verification": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की डिज़ाइन आपके साथ साझा कर दी गई है।\nकृपया डिज़ाइन को ध्यानपूर्वक जाँचे और हमें अपनी अनुमति प्रदान करें।\nएक बार ‘OK’ कर देने के बाद किसी भी प्रकार का संशोधन संभव नहीं होगा।\n\nDear ${namePlaceholder},\nWe have shared the design for your order (Order No: ${orderNoPlaceholder}) with you.\nPlease review it carefully and provide your approval.\nOnce you confirm with ‘OK’, no further changes will be possible.`; break; case "Design Approved": template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की डिज़ाइन स्वीकृत कर दी गई है।\nअब यह प्रिंटिंग प्रक्रिया के लिए आगे बढ़ाया जा रहा है।\n\nDear ${namePlaceholder},\nYour design for Order No: ${orderNoPlaceholder} has been approved.\nIt is now moving forward to the printing stage.`; break; case "Ready for Working": template = `प्रिय ${namePlaceholder},\nनमस्कार,\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) की प्रिंटिंग पूरी हो गई है।\nआप ऑफिस/कार्यालय आकर अपना प्रोडक्ट ले जा सकते हैं।\n\nDear ${namePlaceholder},\nThe printing for your order (Order No: ${orderNoPlaceholder}) is complete.\nYou can now collect your product from our office.`; break; case "Printing": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) प्रिंट हो रहा है।\nपूरा होते ही आपको सूचित किया जाएगा।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) is currently being printed.\nWe will notify you once it’s done.`; break; case "Delivered": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) सफलतापूर्वक डिलीवर कर दिया गया है।\nकृपया पुष्टि करें कि आपने ऑर्डर प्राप्त कर लिया है।\nआपके सहयोग के लिए धन्यवाद।\nहमें आशा है कि आप हमें शीघ्र ही फिर से सेवा का अवसर देंगे।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) has been successfully delivered.\nPlease confirm the receipt.\nThank you for your support.\nWe hope to have the opportunity to serve you again soon.`; break; case "Completed": template = `प्रिय ${namePlaceholder},\nआपका ऑर्डर (Order No: ${orderNoPlaceholder}) सफलतापूर्वक पूर्ण हो चुका है।\nआपके सहयोग के लिए धन्यवाद।\n\nDear ${namePlaceholder},\nYour order (Order No: ${orderNoPlaceholder}) has been successfully completed.\nThank you for your support.`; break; default: template = `प्रिय ${namePlaceholder},\nआपके ऑर्डर (Order No: ${orderNoPlaceholder}) का वर्तमान स्टेटस है: ${status}.\n\nDear ${namePlaceholder},\nThe current status for your order (Order No: ${orderNoPlaceholder}) is: ${status}.`; }
    let message = replaceAll(template, namePlaceholder, customerName); message = replaceAll(message, orderNoPlaceholder, orderId); message = replaceAll(message, deliveryDatePlaceholder, deliveryDateText); message += `\n\n${signature}`; return message;
}

// Bulk Actions
function handleSelectAllChange(event) { const isChecked = event.target.checked; const rows = orderTableBody.querySelectorAll('.row-selector'); selectedOrderIds.clear(); rows.forEach(cb => { const id = cb.dataset.id; cb.checked = isChecked; const row = cb.closest('tr'); if(isChecked){ selectedOrderIds.add(id); if(row) row.classList.add('selected-row'); } else { if(row) row.classList.remove('selected-row'); } }); updateBulkActionsBar(); }
function handleRowCheckboxChange(checkbox, firestoreId) { const row = checkbox.closest('tr'); if (checkbox.checked) { selectedOrderIds.add(firestoreId); if(row) row.classList.add('selected-row'); } else { selectedOrderIds.delete(firestoreId); if(row) row.classList.remove('selected-row'); } updateBulkActionsBar(); if (selectAllCheckbox) { const allCb = orderTableBody.querySelectorAll('.row-selector'); const allChecked = allCb.length > 0 && Array.from(allCb).every(cb => cb.checked); const someChecked = Array.from(allCb).some(cb => cb.checked); selectAllCheckbox.checked = allChecked; selectAllCheckbox.indeterminate = !allChecked && someChecked; } }
function updateBulkActionsBar() { const count = selectedOrderIds.size; if (bulkActionsBar && selectedCountSpan && bulkUpdateStatusBtn && bulkDeleteBtn) { if (count > 0) { selectedCountSpan.textContent = `${count} item${count > 1 ? 's' : ''} selected`; bulkActionsBar.style.display = 'flex'; bulkUpdateStatusBtn.disabled = !(bulkStatusSelect && bulkStatusSelect.value); bulkDeleteBtn.disabled = false; } else { bulkActionsBar.style.display = 'none'; if (bulkStatusSelect) bulkStatusSelect.value = ''; bulkUpdateStatusBtn.disabled = true; bulkDeleteBtn.disabled = true; } } }
async function handleBulkDelete() { const idsToDelete = Array.from(selectedOrderIds); const MAX_DELETE_LIMIT = 5; if (idsToDelete.length > MAX_DELETE_LIMIT) { alert(`You can delete a maximum of ${MAX_DELETE_LIMIT} orders at once.`); return; } if (idsToDelete.length === 0) { alert("Please select orders to delete."); return; } if (!bulkDeleteConfirmModal || !bulkDeleteOrderList || !confirmDeleteCheckbox || !confirmBulkDeleteBtn || !bulkDeleteCountSpan) return; bulkDeleteOrderList.innerHTML = ''; const maxItemsToShow = 100; idsToDelete.forEach((id, index) => { if (index < maxItemsToShow) { const order = findOrderInCache(id); const displayId = order?.orderId || `Sys:${id.substring(0,6)}`; const customerName = order?.customerDetails?.fullName || 'N/A'; const li = document.createElement('li'); li.innerHTML = `<strong>${displayId}</strong> - ${escapeHtml(customerName)}`; bulkDeleteOrderList.appendChild(li); } }); if (idsToDelete.length > maxItemsToShow) { const li = document.createElement('li'); li.textContent = `... and ${idsToDelete.length - maxItemsToShow} more orders.`; bulkDeleteOrderList.appendChild(li); } bulkDeleteCountSpan.textContent = idsToDelete.length; confirmDeleteCheckbox.checked = false; confirmBulkDeleteBtn.disabled = true; bulkDeleteConfirmModal.style.display = 'flex'; }
async function executeBulkDelete(idsToDelete) { if (idsToDelete.length === 0 || !db) return; if(bulkDeleteBtn) bulkDeleteBtn.disabled = true; if(confirmBulkDeleteBtn) { confirmBulkDeleteBtn.disabled = true; confirmBulkDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...'; } const batch = writeBatch(db); idsToDelete.forEach(id => { const docRef = doc(db, "orders", id); batch.delete(docRef); }); try { await batch.commit(); alert(`${idsToDelete.length} order(s) deleted.`); selectedOrderIds.clear(); updateBulkActionsBar(); closeBulkDeleteModal(); } catch (e) { console.error("Bulk delete error:", e); alert(`Error deleting: ${e.message}`); } finally { if(bulkDeleteBtn) bulkDeleteBtn.disabled = false; if(confirmBulkDeleteBtn) { confirmBulkDeleteBtn.disabled = false; confirmBulkDeleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Orders'; } updateBulkActionsBar(); } }
function closeBulkDeleteModal() { if (bulkDeleteConfirmModal) bulkDeleteConfirmModal.style.display = 'none'; }
async function handleBulkUpdateStatus() { const idsToUpdate = Array.from(selectedOrderIds); const newStatus = bulkStatusSelect.value; const MAX_STATUS_UPDATE_LIMIT = 10; if (idsToUpdate.length > MAX_STATUS_UPDATE_LIMIT) { alert(`You can update the status of a maximum of ${MAX_STATUS_UPDATE_LIMIT} orders at once.`); return; } if (idsToUpdate.length === 0) { alert("Please select orders to update."); return; } if (!newStatus) { alert("Please select a status to update to."); return; } if (!confirm(`Are you sure you want to change the status of ${idsToUpdate.length} selected order(s) to "${newStatus}"?`)) return; if (bulkUpdateStatusBtn) { bulkUpdateStatusBtn.disabled = true; bulkUpdateStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; } const batch = writeBatch(db); const historyEntry = { status: newStatus, timestamp: Timestamp.now() }; // Use Timestamp.now() here too
    idsToUpdate.forEach(id => { const docRef = doc(db, "orders", id); batch.update(docRef, { status: newStatus, updatedAt: serverTimestamp(), statusHistory: arrayUnion(historyEntry) }); }); try { await batch.commit(); alert(`${idsToUpdate.length} order(s) status updated.`); selectedOrderIds.clear(); updateBulkActionsBar(); } catch (e) { console.error("Bulk status update error:", e); alert(`Error updating status: ${e.message}`); } finally { if (bulkUpdateStatusBtn) { bulkUpdateStatusBtn.disabled = false; bulkUpdateStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Selected (Max 10)'; } if (bulkStatusSelect) bulkStatusSelect.value = ''; updateBulkActionsBar(); } }

// CSV Export
function exportToCsv() { if (currentlyDisplayedOrders.length === 0) { alert("No data to export."); return; } const headers = ["Firestore ID", "Order ID", "Customer Name", "WhatsApp No", "Contact No", "Address", "Order Date", "Delivery Date", "Status", "Urgent", "Remarks", "Total Amount", "Amount Paid", "Payment Status", "Products (Name | Qty)"]; const rows = currentlyDisplayedOrders.map(order => { const productsString = (order.products || []).map(p => `${String(p.name || '').replace(/\|/g, '')}|${String(p.quantity || '')}`).join('; '); return [ order.id, order.orderId || '', order.customerDetails?.fullName || '', order.customerDetails?.whatsappNo || '', order.customerDetails?.contactNo || '', order.customerDetails?.address || '', order.orderDate || '', order.deliveryDate || '', order.status || '', order.urgent || 'No', order.remarks || '', order.totalAmount || 0, order.amountPaid || 0, order.paymentStatus || 'Pending', productsString ]; }); let csvContent = "data:text/csv;charset=utf-8," + headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n" + rows.map(row => row.map(field => `"${String(field || '').replace(/"/g, '""')}"`).join(",")).join("\n"); const encodedUri = encodeURI(csvContent); const link = document.createElement("a"); link.setAttribute("href", encodedUri); const timestamp = new Date().toISOString().slice(0, 10); link.setAttribute("download", `orders_export_${timestamp}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); }

// Attempt Open Modal from URL
function attemptOpenModalFromUrl() { if (orderIdToOpenFromUrl && allOrdersCache.length > 0 && !modalOpenedFromUrl) { const orderWrapper = allOrdersCache.find(o => o.id === orderIdToOpenFromUrl); if (orderWrapper) { openReadOnlyOrderPopup(orderIdToOpenFromUrl, orderWrapper.data); // Open read-only modal now
            modalOpenedFromUrl = true; try { const url = new URL(window.location); url.searchParams.delete('openModalForId'); window.history.replaceState({}, '', url.toString()); } catch(e) { window.history.replaceState(null, '', window.location.pathname); } orderIdToOpenFromUrl = null; } } }

// PO Creation Functions
function openPOItemSelectionModal(orderFirestoreId, orderData) {
    if (!poItemSelectionModal || !orderData) { alert("Cannot open PO item selection."); return; }
    // Check products *after* ensuring modal elements exist
    if (!orderData.products || orderData.products.length === 0) { alert("No products found in this order to create a PO."); return; }
    if (!poItemSelectionOrderIdInput || !poItemSelectionDisplayOrderIdSpan || !poItemSelectionListContainer || !proceedToCreatePOBtn || !poSupplierSearchInput) return;

    poItemSelectionOrderIdInput.value = orderFirestoreId;
    poItemSelectionDisplayOrderIdSpan.textContent = orderData.orderId || `Sys:${orderFirestoreId.substring(0,6)}`;
    poItemSelectionListContainer.innerHTML = '';
    poSupplierSearchInput.value = ''; poSelectedSupplierIdInput.value = ''; poSelectedSupplierNameInput.value = '';
    if(poSupplierSuggestionsDiv) poSupplierSuggestionsDiv.style.display = 'none';
    showPOItemError('');

    orderData.products.forEach((product, index) => {
        const isAlreadyInPO = false; // TODO: Implement check based on orderData.linkedPOs and product details
        const div = document.createElement('div'); div.className = 'item-selection-entry';
        div.innerHTML = `<input type="checkbox" id="poItem_${index}" name="poItems" value="${index}" data-product-index="${index}" ${isAlreadyInPO ? 'disabled' : ''}> <label for="poItem_${index}"> <strong>${escapeHtml(product.name || 'Unnamed Product')}</strong> (Qty: ${product.quantity || '?'}) ${isAlreadyInPO ? '<span class="in-po-label">(In PO)</span>' : ''} </label>`;
        poItemSelectionListContainer.appendChild(div);
    });

    if (poItemSelectionListContainer.children.length === 0) { poItemSelectionListContainer.innerHTML = '<p>No items available for PO creation.</p>'; }
    proceedToCreatePOBtn.disabled = true;
    poItemSelectionModal.classList.add('active');
}
function closePoItemSelectionModal() { if (poItemSelectionModal) poItemSelectionModal.classList.remove('active'); showPOItemError(''); }
function showPOItemError(message) { if (poItemSelectionError) { poItemSelectionError.textContent = message; poItemSelectionError.style.display = message ? 'block' : 'none'; } }
function handlePOItemCheckboxChange() { if (!poItemSelectionListContainer || !proceedToCreatePOBtn || !poSelectedSupplierIdInput) return; const selectedCheckboxes = poItemSelectionListContainer.querySelectorAll('input[name="poItems"]:checked'); const supplierSelected = !!poSelectedSupplierIdInput.value; proceedToCreatePOBtn.disabled = !(selectedCheckboxes.length > 0 && supplierSelected); }
function handlePOSupplierSearchInput() { if (!poSupplierSearchInput || !poSupplierSuggestionsDiv || !poSelectedSupplierIdInput || !poSelectedSupplierNameInput) return; clearTimeout(supplierSearchDebounceTimerPO); const searchTerm = poSupplierSearchInput.value.trim(); poSelectedSupplierIdInput.value = ''; poSelectedSupplierNameInput.value = ''; handlePOItemCheckboxChange(); if (searchTerm.length < 1) { if(poSupplierSuggestionsDiv){ poSupplierSuggestionsDiv.innerHTML = ''; poSupplierSuggestionsDiv.style.display = 'none';} return; } supplierSearchDebounceTimerPO = setTimeout(() => { fetchPOSupplierSuggestions(searchTerm); }, 350); }
async function fetchPOSupplierSuggestions(searchTerm) { if (!poSupplierSuggestionsDiv || !db) return; poSupplierSuggestionsDiv.innerHTML = '<div>Loading...</div>'; poSupplierSuggestionsDiv.style.display = 'block'; const searchTermLower = searchTerm.toLowerCase(); try { const q = query( collection(db, "suppliers"), orderBy("name_lowercase"), where("name_lowercase", ">=", searchTermLower), where("name_lowercase", "<=", searchTermLower + '\uf8ff'), limit(10) ); const querySnapshot = await getDocs(q); poSupplierSuggestionsDiv.innerHTML = ''; if (querySnapshot.empty) { poSupplierSuggestionsDiv.innerHTML = '<div class="no-suggestions">No matching suppliers found.</div>'; } else { querySnapshot.forEach((docSnapshot) => { const supplier = docSnapshot.data(); const supplierId = docSnapshot.id; const div = document.createElement('div'); div.textContent = `${supplier.name}${supplier.companyName ? ' (' + supplier.companyName + ')' : ''}`; div.dataset.id = supplierId; div.dataset.name = supplier.name; div.style.cursor = 'pointer'; div.addEventListener('mousedown', (e) => { e.preventDefault(); if(poSupplierSearchInput) poSupplierSearchInput.value = supplier.name; if(poSelectedSupplierIdInput) poSelectedSupplierIdInput.value = supplierId; if(poSelectedSupplierNameInput) poSelectedSupplierNameInput.value = supplier.name; if(poSupplierSuggestionsDiv) poSupplierSuggestionsDiv.style.display = 'none'; handlePOItemCheckboxChange(); }); poSupplierSuggestionsDiv.appendChild(div); }); } } catch (error) { console.error("Error fetching PO supplier suggestions:", error); poSupplierSuggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Error fetching suppliers.</div>'; } }
function handleProceedToCreatePO() { const orderFirestoreId = poItemSelectionOrderIdInput.value; const selectedSupplierId = poSelectedSupplierIdInput.value; const selectedSupplierName = poSelectedSupplierNameInput.value; if (!orderFirestoreId || !selectedSupplierId || !selectedSupplierName) { showPOItemError("Missing Order ID or Supplier Selection."); return; } const selectedItemsIndices = Array.from(poItemSelectionListContainer.querySelectorAll('input[name="poItems"]:checked')).map(cb => parseInt(cb.value)); if (selectedItemsIndices.length === 0) { showPOItemError("Please select at least one item for the PO."); return; } const params = new URLSearchParams(); params.append('sourceOrderId', orderFirestoreId); params.append('supplierId', selectedSupplierId); params.append('supplierName', selectedSupplierName); params.append('itemIndices', selectedItemsIndices.join(',')); window.location.href = `new_po.html?${params.toString()}`; closePoItemSelectionModal(); }

// PO Details Popup Functions
async function openPODetailsPopup(poId) { if (!poDetailsPopup || !poDetailsPopupContent || !db) return; poDetailsPopupContent.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading PO details...</p>'; poDetailsPopup.classList.add('active'); try { const poRef = doc(db, "purchaseOrders", poId); const poDocSnap = await getDoc(poRef); if (!poDocSnap.exists()) throw new Error(`Purchase Order with ID ${poId} not found.`); const poData = poDocSnap.data(); const supplierName = poData.supplierName || 'Unknown Supplier'; const poNumberDisplay = poData.poNumber ? `#${poData.poNumber}` : 'N/A'; let orderDateStr = poData.orderDate?.toDate ? poData.orderDate.toDate().toLocaleDateString('en-GB') : 'N/A'; let popupHTML = `<div class="po-details-popup-header"><h3>Purchase Order ${poNumberDisplay}</h3><p><strong>Supplier:</strong> ${escapeHtml(supplierName)}</p><p><strong>Order Date:</strong> ${orderDateStr}</p><p><strong>Status:</strong> ${escapeHtml(poData.status || 'N/A')}</p><p><strong>Total Amount:</strong> ₹ ${(poData.totalAmount || 0).toFixed(2)}</p></div><hr><h4>Items</h4>`; if (poData.items && poData.items.length > 0) { popupHTML += `<table class="details-table-popup"><thead><tr><th>#</th><th>Product</th><th>Details</th><th>Rate</th><th>Amount</th></tr></thead><tbody>`; poData.items.forEach((item, index) => { let detailStr = ''; const qty = item.quantity || '?'; if (item.type === 'Sq Feet') { const w = item.realWidth || item.width || '?'; const h = item.realHeight || item.height || '?'; const u = item.unit || item.inputUnit || 'units'; detailStr = `Qty: ${qty} (${w}x${h} ${u})`; } else { detailStr = `Qty: ${qty}`; } popupHTML += `<tr><td>${index + 1}</td><td>${escapeHtml(item.productName || 'N/A')}</td><td>${escapeHtml(detailStr)}</td><td>${item.rate?.toFixed(2) ?? 'N/A'}</td><td align="right">${item.itemAmount?.toFixed(2) ?? 'N/A'}</td></tr>`; }); popupHTML += `</tbody></table>`; } else { popupHTML += `<p>No items found for this PO.</p>`; } if (poData.notes) { popupHTML += `<div class="po-notes-popup"><strong>Notes:</strong><p>${escapeHtml(poData.notes).replace(/\n/g, '<br>')}</p></div>`; } poDetailsPopupContent.innerHTML = popupHTML; if(printPoDetailsPopupBtn) printPoDetailsPopupBtn.dataset.poid = poId; } catch (error) { console.error("Error loading PO details into popup:", error); poDetailsPopupContent.innerHTML = `<p class="error-message">Error loading PO details: ${error.message}</p>`; } }
function closePODetailsPopup() { if (poDetailsPopup) poDetailsPopup.classList.remove('active'); }
function handlePrintPODetailsPopup(event) { const contentElement = document.getElementById('poDetailsPopupContent'); if (!contentElement) return; const printWindow = window.open('', '_blank'); printWindow.document.write(`<html><head><title>Print PO Details</title><style>body{font-family:sans-serif;margin:20px;} h3,h4{margin-bottom:10px;} table{width:100%; border-collapse:collapse; margin-bottom:15px;} th, td{border:1px solid #ccc; padding:5px; text-align:left;} th{background-color:#f2f2f2;} .po-notes-popup{margin-top:15px; border:1px solid #eee; padding:10px;} </style></head><body>${contentElement.innerHTML}</body></html>`); printWindow.document.close(); printWindow.focus(); setTimeout(() => { printWindow.print(); printWindow.close(); }, 500); }

// Read-Only Order Details Popup Functions
function openReadOnlyOrderPopup(firestoreId, orderData) {
    if (!readOnlyOrderModal || !readOnlyOrderModalContent || !readOnlyOrderModalTitle || !orderData) return;

    readOnlyOrderModalTitle.textContent = `Order Details: #${orderData.orderId || firestoreId.substring(0,6)}`;
    readOnlyOrderModalContent.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading...</p>';
    readOnlyOrderModal.classList.add('active');

    let contentHTML = '<div class="read-only-grid">';

    contentHTML += '<div class="read-only-section"><h4>Customer</h4>';
    contentHTML += `<p><strong>Name:</strong> ${escapeHtml(orderData.customerDetails?.fullName || 'N/A')}</p>`;
    contentHTML += `<p><strong>WhatsApp:</strong> ${escapeHtml(orderData.customerDetails?.whatsappNo || 'N/A')}</p>`;
    contentHTML += `<p><strong>Contact:</strong> ${escapeHtml(orderData.customerDetails?.contactNo || 'N/A')}</p>`;
    contentHTML += `<p><strong>Address:</strong> ${escapeHtml(orderData.customerDetails?.address || 'N/A')}</p></div>`;

    const orderDateRO = orderData.orderDate ? (typeof orderData.orderDate.toDate === 'function' ? orderData.orderDate.toDate().toLocaleDateString('en-GB') : new Date(orderData.orderDate).toLocaleDateString('en-GB')) : 'N/A';
    const deliveryDateRO = orderData.deliveryDate ? (typeof orderData.deliveryDate.toDate === 'function' ? orderData.deliveryDate.toDate().toLocaleDateString('en-GB') : new Date(orderData.deliveryDate).toLocaleDateString('en-GB')) : 'N/A';
    contentHTML += '<div class="read-only-section"><h4>Order Info</h4>';
    contentHTML += `<p><strong>Order Date:</strong> ${orderDateRO}</p>`;
    contentHTML += `<p><strong>Delivery Date:</strong> ${deliveryDateRO}</p>`;
    contentHTML += `<p><strong>Priority:</strong> ${escapeHtml(orderData.urgent || 'No')}</p>`;
    contentHTML += `<p><strong>Status:</strong> ${escapeHtml(orderData.status || 'N/A')}</p>`;
    contentHTML += `<p><strong>Remarks:</strong> ${escapeHtml(orderData.remarks || 'None')}</p></div>`;

    // Products Section (Corrected)
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

    // Account Data Section (Corrected - Check if fields exist)
    contentHTML += '<div class="read-only-section"><h4>Account Data</h4>';
    const totalAmountRO = orderData.totalAmount || 0;
    const amountPaidRO = orderData.amountPaid || 0;
    const balanceDueRO = totalAmountRO - amountPaidRO;
    const paymentStatusRO = orderData.paymentStatus || (balanceDueRO <= 0 ? 'Paid' : 'Pending');
    contentHTML += `<p><strong>Total Amount:</strong> ${'totalAmount' in orderData ? `₹ ${totalAmountRO.toFixed(2)}` : 'N/A (Field Missing)'}</p>`;
    contentHTML += `<p><strong>Amount Paid:</strong> ${'amountPaid' in orderData ? `₹ ${amountPaidRO.toFixed(2)}` : 'N/A (Field Missing)'}</p>`;
    contentHTML += `<p><strong>Balance Due:</strong> ${('totalAmount' in orderData && 'amountPaid' in orderData) ? `₹ ${balanceDueRO.toFixed(2)}` : 'N/A'}</p>`;
    contentHTML += `<p><strong>Payment Status:</strong> ${'paymentStatus' in orderData ? escapeHtml(paymentStatusRO) : 'N/A (Field Missing)'}</p></div>`;


    // Status History Section
    contentHTML += '<div class="read-only-section"><h4>Status History</h4>';
    if (orderData.statusHistory && orderData.statusHistory.length > 0) {
        const sortedHistoryRO = [...orderData.statusHistory].sort((a, b) => (b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0) - (a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0));
        contentHTML += '<ul class="read-only-history-list">';
        sortedHistoryRO.forEach(entry => {
            const timeStr = entry.timestamp?.toDate ? entry.timestamp.toDate().toLocaleString('en-GB') : '?';
            contentHTML += `<li><strong>${escapeHtml(entry.status || '?')}</strong> at ${timeStr}</li>`;
        });
        contentHTML += '</ul>';
    } else { contentHTML += '<p>No status history available.</p>'; }
    contentHTML += '</div>';

    contentHTML += '</div>';
    readOnlyOrderModalContent.innerHTML = contentHTML;
}
function closeReadOnlyOrderModal() { if (readOnlyOrderModal) readOnlyOrderModal.classList.remove('active'); }

console.log("order_history.js script (with new features) loaded.");