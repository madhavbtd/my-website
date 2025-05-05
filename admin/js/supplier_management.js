// js/supplier_management.js - v29.2 (Robust Element Querying)

import { db, auth } from './firebase-init.js';
import {
    collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc, writeBatch,
    query, orderBy, where, Timestamp, serverTimestamp, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- DOM Elements Holder ---
let pageElements = {}; // Object to hold references after DOM load

// --- Global State ---
let currentEditingSupplierId = null;
let suppliersDataCache = [];
let cachedPOs = {};
let currentPoQuery = null;
let poQueryUnsubscribe = null;
let poPagination = { currentPage: 1, itemsPerPage: 25, lastVisibleDoc: null, firstVisibleDoc: null, totalItems: 0, hasNextPage: false, hasPrevPage: false };
let selectedPoIds = new Set();
let currentPoSortField = 'createdAt';
let currentPoSortDirection = 'desc';
let pageInitialized = false; // Flag to prevent multiple initializations
let listenersAttached = false; // Flag for listeners

// --- Utility Functions ---
// (Keep existing: escapeHtml, formatCurrency, formatDate)
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { try { unsafe = String(unsafe ?? ''); } catch (e) { unsafe = ''; } } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function formatCurrency(amount) { const num = Number(amount); if (isNaN(num)) return 'N/A'; return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatDate(timestamp) { if (!timestamp || typeof timestamp.toDate !== 'function') return '-'; try { return timestamp.toDate().toLocaleDateString('en-GB'); } catch (e) { console.error("Error formatting date:", e); return '-'; } }

// --- Error Display Functions ---
// (Keep existing error functions, ensure they use pageElements if available)
function displayError(message, elementId = 'poListError') {
    const errorElement = pageElements[elementId] || document.getElementById(elementId);
    if (errorElement) { errorElement.textContent = message; errorElement.style.display = message ? 'block' : 'none'; /* errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); */ } // Scrolling might be annoying
    else { console.error(`Error element ID '${elementId}' not found. Msg:`, message); alert(message); }
}
function clearError(elementId = 'poListError') {
     const idsToClear = elementId ? [elementId] : ['poListError', 'supplierListError', 'supplierFormError', 'statusErrorMsg'];
     idsToClear.forEach(id => {
          const errorElement = pageElements[id] || document.getElementById(id);
          if (errorElement) { errorElement.textContent = ''; errorElement.style.display = 'none'; }
      });
}
function showSupplierFormError(message) { displayError(message, 'supplierFormError'); }
function showStatusError(message) { displayError(message, 'statusErrorMsg'); }
function showPoListError(message) { displayError(message, 'poListError'); if (pageElements.poLoadingMessage) pageElements.poLoadingMessage.style.display = 'none'; if (pageElements.poTableBody) pageElements.poTableBody.innerHTML = ''; }
function showSupplierListError(message) { displayError(message, 'supplierListError'); if (pageElements.supplierLoadingMessage) pageElements.supplierLoadingMessage.style.display = 'none'; if (pageElements.supplierTableBody) pageElements.supplierTableBody.innerHTML = ''; }

// --- DOM Element Querying Function ---
function queryPageElements() {
     console.log("Querying DOM elements...");
     pageElements = {
          poTableBody: document.getElementById('poTableBody'),
          poSearchInput: document.getElementById('poSearchInput'),
          poSupplierFilter: document.getElementById('poSupplierFilter'),
          poStatusFilter: document.getElementById('poStatusFilter'),
          poStartDateFilter: document.getElementById('poStartDateFilter'),
          poEndDateFilter: document.getElementById('poEndDateFilter'),
          poFilterBtn: document.getElementById('poFilterBtn'),
          poClearFilterBtn: document.getElementById('poClearFilterBtn'),
          poTotalsDisplay: document.getElementById('poTotalsDisplay'),
          poLoadingMessage: document.getElementById('poLoadingMessage'),
          poListError: document.getElementById('poListError'),
          poPaginationControls: document.getElementById('poPaginationControls'),
          prevPageBtn: document.getElementById('prevPageBtn'),
          nextPageBtn: document.getElementById('nextPageBtn'),
          pageInfo: document.getElementById('pageInfo'),
          itemsPerPageSelect: document.getElementById('itemsPerPageSelect'),
          selectAllPoCheckbox: document.getElementById('selectAllPoCheckbox'),
          poBatchActionsBar: document.getElementById('poBatchActionsBar'),
          poSelectedCount: document.getElementById('poSelectedCount'),
          batchUpdateStatusSelect: document.getElementById('batchUpdateStatusSelect'),
          batchApplyStatusBtn: document.getElementById('batchApplyStatusBtn'),
          batchMarkReceivedBtn: document.getElementById('batchMarkReceivedBtn'),
          batchDeletePoBtn: document.getElementById('batchDeletePoBtn'),
          deselectAllPoBtn: document.getElementById('deselectAllPoBtn'),
          poTableHeader: document.querySelector('#poTable thead'),
          suppliersListSection: document.getElementById('suppliersListSection'),
          supplierTableBody: document.getElementById('supplierTableBody'),
          supplierLoadingMessage: document.getElementById('supplierLoadingMessage'),
          supplierListError: document.getElementById('supplierListError'),
          addNewSupplierBtn: document.getElementById('addNewSupplierBtn'),
          supplierModal: document.getElementById('supplierModal'),
          supplierModalTitle: document.getElementById('supplierModalTitle'),
          closeSupplierModalBtn: document.getElementById('closeSupplierModal'), // This ID caused the error
          cancelSupplierBtn: document.getElementById('cancelSupplierBtn'),
          saveSupplierBtn: document.getElementById('saveSupplierBtn'),
          deleteSupplierFromModalBtn: document.getElementById('deleteSupplierFromModalBtn'),
          supplierForm: document.getElementById('supplierForm'),
          editSupplierIdInput: document.getElementById('editSupplierId'),
          supplierNameInput: document.getElementById('supplierNameInput'),
          supplierCompanyInput: document.getElementById('supplierCompanyInput'),
          supplierWhatsappInput: document.getElementById('supplierWhatsappInput'),
          supplierEmailInput: document.getElementById('supplierEmailInput'),
          supplierAddressInput: document.getElementById('supplierAddressInput'),
          supplierGstInput: document.getElementById('supplierGstInput'),
          supplierFormError: document.getElementById('supplierFormError'),
          statusUpdateModal: document.getElementById('statusUpdateModal'),
          statusModalTitle: document.getElementById('statusModalTitle'),
          closeStatusModalBtn: document.getElementById('closeStatusModal'), // Renamed in HTML? Check ID
          cancelStatusBtn: document.getElementById('cancelStatusBtn'),
          saveStatusBtn: document.getElementById('saveStatusBtn'),
          statusUpdateForm: document.getElementById('statusUpdateForm'),
          statusUpdatePOId: document.getElementById('statusUpdatePOId'),
          currentPOStatusSpan: document.getElementById('currentPOStatus'),
          statusSelect: document.getElementById('statusSelect'),
          statusErrorMsg: document.getElementById('statusErrorMsg'),
          poItemsModal: document.getElementById('poItemsModal'),
          poItemsModalTitle: document.getElementById('poItemsModalTitle'),
          poItemsModalContent: document.getElementById('poItemsModalContent'),
          closePoItemsModalBtn: document.getElementById('closePoItemsModalBtn'),
          closePoItemsModalBottomBtn: document.getElementById('closePoItemsModalBottomBtn'),
          poShareModal: document.getElementById('poShareModal'),
          poShareModalTitle: document.getElementById('poShareModalTitle'),
          poShareInfo: document.getElementById('poShareInfo'),
          poShareGreeting: document.getElementById('poShareGreeting'),
          poShareItemsContainer: document.getElementById('poShareItemsContainer'),
          poShareTermList: document.getElementById('poShareTermList'),
          poShareScrollableContent: document.getElementById('poShareScrollableContent'),
          closePoShareModalTopBtn: document.getElementById('closePoShareModalTopBtn'),
          closePoShareModalBtn: document.getElementById('closePoShareModalBtn'),
          printPoShareModalBtn: document.getElementById('printPoShareModalBtn'),
          copyPoShareModalBtn: document.getElementById('copyPoShareModalBtn'),
          exportPoCsvBtn: document.getElementById('exportPoCsvBtn')
     };

     // Check if critical elements were found
     const criticalIds = ['poTableBody', 'supplierTableBody', 'supplierModal', 'statusUpdateModal', 'poItemsModal', 'poShareModal'];
     let allFound = true;
     criticalIds.forEach(id => {
          if (!pageElements[id]) {
               console.error(`CRITICAL ERROR: Element with ID '${id}' not found! Page may not function correctly.`);
               allFound = false;
          }
     });
     console.log("DOM querying finished.", allFound ? "All critical elements found." : "Some critical elements MISSING!");
     return allFound;
}


// --- Supplier List Functions ---
// (Modify to use pageElements)
async function displaySupplierTable() {
    // Use pageElements.supplierTableBody, pageElements.supplierLoadingMessage etc.
    if (!pageElements.supplierTableBody || !pageElements.supplierLoadingMessage) { console.warn("Supplier table elements not queried"); return; }
    if (!db || !collection || !getDocs || !query || !orderBy) { showSupplierListError("Error: DB functions missing."); return; }
    showSupplierListError(''); pageElements.supplierLoadingMessage.style.display = 'table-row'; pageElements.supplierTableBody.innerHTML = ''; suppliersDataCache = [];
    try {
        const q = query(collection(db, "suppliers"), orderBy("name_lowercase")); const querySnapshot = await getDocs(q);
        pageElements.supplierLoadingMessage.style.display = 'none';
        if (querySnapshot.empty) { pageElements.supplierTableBody.innerHTML = '<tr><td colspan="4" class="no-results">No suppliers found.</td></tr>'; }
        else {
            querySnapshot.forEach((docSnapshot) => {
                const supplier = docSnapshot.data(); const supplierId = docSnapshot.id; suppliersDataCache.push({ id: supplierId, ...supplier });
                const tr = document.createElement('tr'); tr.setAttribute('data-id', supplierId); tr.setAttribute('title', 'Click to view account details'); tr.classList.add('clickable-row');
                const name = escapeHtml(supplier.name || 'N/A'); const contact = escapeHtml(supplier.whatsappNo || supplier.contactNo || '-');
                tr.innerHTML = `
                    <td>${name}</td>
                    <td>${contact}</td>
                    <td class="supplier-balance">Loading...</td>
                    <td class="action-buttons">
                        <button class="button edit-supplier-btn small-button" data-id="${supplierId}" title="Edit Supplier"><i class="fas fa-edit"></i></button>
                        <a href="supplier_account_detail.html?id=${supplierId}" class="button view-account-button small-button" title="View Account Details"><i class="fas fa-eye"></i></a>
                    </td>`;
                pageElements.supplierTableBody.appendChild(tr);
                calculateAndDisplaySupplierBalance(supplierId, tr.querySelector('.supplier-balance'));
            });
            populateSupplierFilterDropdown();
        }
    } catch (error) { console.error("Error fetching suppliers: ", error); showSupplierListError(`Error loading suppliers: ${error.message}`); populateSupplierFilterDropdown(); }
}
async function calculateAndDisplaySupplierBalance(supplierId, balanceCellElement) { if (!balanceCellElement) return; balanceCellElement.textContent = '₹ --.--'; balanceCellElement.style.textAlign = 'right'; /* Placeholder */ }
function populateSupplierFilterDropdown() {
    // Use pageElements.poSupplierFilter
    if (!pageElements.poSupplierFilter) return; const selectedVal = pageElements.poSupplierFilter.value;
    pageElements.poSupplierFilter.innerHTML = '<option value="">All Suppliers</option>';
    const sortedSuppliers = [...suppliersDataCache].sort((a, b) => (a.name_lowercase || '').localeCompare(b.name_lowercase || ''));
    sortedSuppliers.forEach(supplier => { const option = document.createElement('option'); option.value = supplier.id; option.textContent = escapeHtml(supplier.name || supplier.id); pageElements.poSupplierFilter.appendChild(option); });
    if (pageElements.poSupplierFilter.querySelector(`option[value="${selectedVal}"]`)) { pageElements.poSupplierFilter.value = selectedVal; } else { pageElements.poSupplierFilter.value = ""; }
}
// Keep handleSupplierTableActions, handleSupplierRowClick (they use event.target)

// --- Supplier Modal/CRUD Functions ---
// (Modify to use pageElements)
function openSupplierModal(mode = 'add', supplierData = null, supplierId = null) {
     // Use pageElements.supplierModal, .supplierForm etc.
     if (!pageElements.supplierModal || !pageElements.supplierForm || !pageElements.supplierModalTitle || !pageElements.supplierFormError || !pageElements.editSupplierIdInput || !pageElements.supplierNameInput || !pageElements.deleteSupplierFromModalBtn) { console.error("Supplier modal elements missing!"); alert("Cannot open supplier form."); return; }
     pageElements.supplierForm.reset(); showSupplierFormError(''); currentEditingSupplierId = null; pageElements.deleteSupplierFromModalBtn.style.display = 'none';
     if (mode === 'edit' && supplierData && supplierId) {
         pageElements.supplierModalTitle.textContent = 'Edit Supplier'; pageElements.editSupplierIdInput.value = supplierId; currentEditingSupplierId = supplierId;
         pageElements.supplierNameInput.value = supplierData.name || '';
         if(pageElements.supplierCompanyInput) pageElements.supplierCompanyInput.value = supplierData.companyName || '';
         if(pageElements.supplierWhatsappInput) pageElements.supplierWhatsappInput.value = supplierData.whatsappNo || '';
         if(pageElements.supplierEmailInput) pageElements.supplierEmailInput.value = supplierData.email || '';
         if(pageElements.supplierAddressInput) pageElements.supplierAddressInput.value = supplierData.address || '';
         if(pageElements.supplierGstInput) pageElements.supplierGstInput.value = supplierData.gstNo || '';
         pageElements.deleteSupplierFromModalBtn.style.display = 'inline-flex'; pageElements.deleteSupplierFromModalBtn.dataset.name = supplierData.name || supplierId;
     } else { pageElements.supplierModalTitle.textContent = 'Add New Supplier'; pageElements.editSupplierIdInput.value = ''; }
     pageElements.supplierModal.classList.add('active');
}
function closeSupplierModal() { if (pageElements.supplierModal) { pageElements.supplierModal.classList.remove('active'); } }
// Keep handleAddSupplierSubmit, deleteSupplier, handleDeleteSupplierFromModal (they use event.target or local vars)


// --- PO List Functions ---
// (Modify to use pageElements)
async function displayPoList() {
    // Use pageElements.poTableBody, .poLoadingMessage etc.
    if (!pageElements.poTableBody || !pageElements.poLoadingMessage) { console.warn("PO table body missing"); return; }
    if (!db || !collection || !getDocs || !query || !orderBy || !where || !doc || !getDoc || !Timestamp || !limit) { showPoListError("Error: DB functions missing."); return; }
    showPoListError(''); pageElements.poLoadingMessage.style.display = 'table-row'; pageElements.poTableBody.innerHTML = '';
    if (pageElements.poTotalsDisplay) pageElements.poTotalsDisplay.textContent = 'Loading totals...'; if (pageElements.poPaginationControls) pageElements.poPaginationControls.style.display = 'none';
    selectedPoIds.clear(); updateBatchActionBar(); if (pageElements.selectAllPoCheckbox) pageElements.selectAllPoCheckbox.checked = false;
    try {
        let conditions = []; let baseQuery = collection(db, "purchaseOrders");
        const searchTerm = pageElements.poSearchInput?.value.trim().toLowerCase() || '';
        const supplierFilterId = pageElements.poSupplierFilter?.value || '';
        const statusFilter = pageElements.poStatusFilter?.value || '';
        const startDateVal = pageElements.poStartDateFilter?.value || '';
        const endDateVal = pageElements.poEndDateFilter?.value || '';

        if (supplierFilterId) { conditions.push(where("supplierId", "==", supplierFilterId)); } if (statusFilter) { conditions.push(where("status", "==", statusFilter)); }
        if (startDateVal) { try { conditions.push(where("orderDate", ">=", Timestamp.fromDate(new Date(startDateVal + 'T00:00:00')))); } catch (e) {console.warn("Invalid start date")} }
        if (endDateVal) { try { conditions.push(where("orderDate", "<=", Timestamp.fromDate(new Date(endDateVal + 'T23:59:59')))); } catch (e) {console.warn("Invalid end date")} }
        const sortFieldMapping = { poNumber: 'poNumber', orderDate: 'orderDate', supplierName: 'supplierName_lowercase', totalAmount: 'totalAmount', status: 'status', paymentStatus: 'paymentStatus' };
        const firestoreSortField = sortFieldMapping[currentPoSortField] || 'createdAt'; const firestoreSortDirection = currentPoSortDirection || 'desc';
        let sortClauses = [orderBy(firestoreSortField, firestoreSortDirection)]; if (firestoreSortField !== 'createdAt') { sortClauses.push(orderBy('createdAt', 'desc')); }
        currentPoQuery = query(baseQuery, ...conditions, ...sortClauses);
        const querySnapshot = await getDocs(currentPoQuery);
        pageElements.poLoadingMessage.style.display = 'none'; let filteredDocs = querySnapshot.docs; let grandTotalAmount = 0; cachedPOs = {};
        if (searchTerm) { /* Keep client-side filter */
             filteredDocs = filteredDocs.filter(docRef_po => {
                 const po = docRef_po.data();
                 const supplierName = suppliersDataCache.find(s => s.id === po.supplierId)?.name?.toLowerCase() || po.supplierName?.toLowerCase() || '';
                 const itemNames = (po.items || []).map(item => item.productName?.toLowerCase() || '').join(' ');
                 const poNumString = po.poNumber ? String(po.poNumber).toLowerCase() : '';
                 return (poNumString.includes(searchTerm) || supplierName.includes(searchTerm) || itemNames.includes(searchTerm));
             });
        }
        if (filteredDocs.length === 0) { pageElements.poTableBody.innerHTML = `<tr><td colspan="9" class="no-results">No POs found matching your criteria.</td></tr>`; if (pageElements.poTotalsDisplay) pageElements.poTotalsDisplay.textContent = 'Total PO Value: ₹ 0.00'; return; }
        filteredDocs.forEach(docRef_po => { /* Render rows... */
            const po = docRef_po.data(); const poId = docRef_po.id; cachedPOs[poId] = po;
            let supplierName = suppliersDataCache.find(s => s.id === po.supplierId)?.name || po.supplierName || 'Unknown';
            let orderDateStr = formatDate(po.orderDate || po.createdAt);
            let statusText = po.status || 'Unknown'; let statusClass = statusText.toLowerCase().replace(/\s+/g, '-');
            let paymentStatusText = po.paymentStatus || 'Pending'; let paymentStatusClass = paymentStatusText.toLowerCase().replace(/\s+/g, '-');
            let amount = po.totalAmount || 0; let amountStr = formatCurrency(amount); grandTotalAmount += amount;
            let supplierLink = po.supplierId ? `<a href="supplier_account_detail.html?id=${po.supplierId}" class="supplier-link" title="View Supplier: ${escapeHtml(supplierName)}">${escapeHtml(supplierName)}</a>` : escapeHtml(supplierName);
            let itemsHtml = 'N/A';
            if (po.items && po.items.length > 0) { /* ... items logic ... */
                const firstItem = po.items[0]; const firstItemName = escapeHtml(firstItem.productName || 'Item');
                if (po.items.length === 1) {
                    const qty = escapeHtml(firstItem.quantity || '?'); let sizeText = '';
                    if (firstItem.unitType === 'Sq Feet' && firstItem.width && firstItem.height) { const width = escapeHtml(firstItem.width); const height = escapeHtml(firstItem.height); const unit = escapeHtml(firstItem.dimensionUnit || 'units'); sizeText = ` [${width} x ${height} ${unit}]`; }
                    itemsHtml = `<span class="product-name-display">${firstItemName}</span> (Qty: ${qty})${sizeText}`;
                } else { itemsHtml = `<span class="product-name-display">${firstItemName}</span> <button class="button see-more-items-btn small-button text-button" data-action="see-more-items" data-id="${poId}">${po.items.length - 1} more</button>`; }
            }
            const tr = document.createElement('tr'); tr.setAttribute('data-id', poId);
             tr.innerHTML = `
                <td style="text-align: center;"><input type="checkbox" class="po-select-checkbox" value="${poId}"></td>
                <td class="po-number-link" title="View Details / Share PO">${escapeHtml(po.poNumber || 'N/A')}</td>
                <td>${orderDateStr}</td>
                <td>${supplierLink}</td>
                <td style="text-align: right;">${amountStr}</td>
                <td>${itemsHtml}</td>
                <td><span class="status-badge status-${statusClass}">${escapeHtml(statusText)}</span></td>
                <td><span class="payment-badge payment-${paymentStatusClass}">${escapeHtml(paymentStatusText)}</span></td>
                <td class="action-buttons">
                     ${statusText === 'Sent' || statusText === 'Printing' ? `<button class="button mark-received-btn small-button success-button" data-action="mark-received" data-id="${poId}" title="Mark as Received"><i class="fas fa-check"></i></button>` : ''}
                    <button class="button edit-button small-button" data-action="edit-po" data-id="${poId}" title="Edit PO"><i class="fas fa-edit"></i></button>
                    <button class="button status-button small-button" data-action="change-status-modal" data-id="${poId}" data-number="${escapeHtml(po.poNumber)}" data-status="${escapeHtml(statusText)}" title="Update Status"><i class="fas fa-sync-alt"></i></button>
                    <button class="button delete-button small-button" data-action="delete-po" data-id="${poId}" data-number="${escapeHtml(po.poNumber)}" title="Delete PO"><i class="fas fa-trash-alt"></i></button>
                </td>`;
            pageElements.poTableBody.appendChild(tr); // Append to queried body
        });
        if (pageElements.poTotalsDisplay) pageElements.poTotalsDisplay.textContent = `Total PO Value (Displayed): ${formatCurrency(grandTotalAmount)}`;
    } catch (error) { console.error("Error fetching/displaying POs: ", error); if (error.code === 'failed-precondition') { showPoListError(`Error: Firestore index missing. Check console for details needed.`); } else { showPoListError(`Error loading POs: ${error.message}`); } if (pageElements.poTotalsDisplay) pageElements.poTotalsDisplay.textContent = 'Error loading totals'; }
}
// Keep handlePoSort, updateSortIndicators, handlePOTableActions, markPOAsReceived

// --- Status Update Modal Functions ---
// (Modify to use pageElements)
function openStatusModal(poId, currentStatus, poNumber) {
     // Use pageElements.statusUpdateModal etc.
    if (!pageElements.statusUpdateModal || !pageElements.statusUpdatePOId || !pageElements.currentPOStatusSpan || !pageElements.statusSelect || !pageElements.statusModalTitle) { console.error("Status update modal elements missing!"); return; }
    pageElements.statusUpdatePOId.value = poId; pageElements.currentPOStatusSpan.textContent = currentStatus || 'N/A'; pageElements.statusModalTitle.textContent = `Update Status for PO #${poNumber || poId.substring(0,6)}`;
    pageElements.statusSelect.value = currentStatus || ''; showStatusError(''); pageElements.statusUpdateModal.classList.add('active');
}
function closeStatusModal() { if (pageElements.statusUpdateModal) { pageElements.statusUpdateModal.classList.remove('active'); } }
// Keep handleStatusUpdate

// --- PO Share Modal Functions ---
// (Modify to use pageElements)
async function openPoShareModal(poId) {
    // Use pageElements.poShareModal etc.
    if (!pageElements.poShareModal || !pageElements.poShareModalTitle || !pageElements.poShareInfo || !pageElements.poShareGreeting || !pageElements.poShareItemsContainer || !pageElements.poShareTermList || !pageElements.copyPoShareModalBtn) { console.error("PO Share modal elements missing!"); alert("Error: Cannot open PO Share view."); return; }
    pageElements.poShareModalTitle.textContent = "Purchase Order"; pageElements.poShareInfo.innerHTML = 'Loading PO info...'; pageElements.poShareGreeting.innerHTML = 'Loading greeting...';
    pageElements.poShareItemsContainer.innerHTML = '<h3>Items</h3><p><i class="fas fa-spinner fa-spin"></i> Loading items...</p>'; pageElements.poShareTermList.innerHTML = '<li>Loading T&C...</li>';
    pageElements.copyPoShareModalBtn.dataset.poid = ''; pageElements.copyPoShareModalBtn.disabled = true; pageElements.copyPoShareModalBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Content'; pageElements.copyPoShareModalBtn.classList.remove('copied', 'copying');
    pageElements.poShareModal.classList.add('active');
    try { /* ... rest of the logic ... */ } catch (error) { /* ... error handling ... */ }
}
function closePoShareModalFunction() { if (pageElements.poShareModal) { pageElements.poShareModal.classList.remove('active'); } }
// Keep handleCopyPoShareContent, handlePrintPoShare

// --- See More Items Modal Functions ---
// (Modify to use pageElements)
async function openSeeMoreItemsModal(poId) {
     // Use pageElements.poItemsModal etc.
    if (!pageElements.poItemsModal || !pageElements.poItemsModalContent || !pageElements.poItemsModalTitle) { console.error("PO Items Modal elements missing!"); alert("Could not display items."); return; }
    pageElements.poItemsModalTitle.textContent = `Items for PO #${poId.substring(0, 6)}...`; pageElements.poItemsModalContent.innerHTML = '<p>Loading items...</p>'; pageElements.poItemsModal.classList.add('active');
    try { /* ... rest of the logic ... */ } catch (error) { /* ... error handling ... */ }
}
function closePoItemsModal() { if (pageElements.poItemsModal) { pageElements.poItemsModal.classList.remove('active'); } }

// --- Batch Action Bar Update & Handlers ---
// (Modify to use pageElements)
function updateBatchActionBar() {
    // Use pageElements.poBatchActionsBar etc.
    if (!pageElements.poBatchActionsBar || !pageElements.poSelectedCount || !pageElements.selectAllPoCheckbox || !pageElements.batchApplyStatusBtn || !pageElements.batchDeletePoBtn || !pageElements.batchUpdateStatusSelect || !pageElements.batchMarkReceivedBtn) {
        console.warn("Batch action bar elements missing"); return;
    }
    const count = selectedPoIds.size; const MAX_STATUS_UPDATE = 10; const MAX_DELETE = 5;
    if (count > 0) {
        pageElements.poSelectedCount.textContent = `${count} PO${count > 1 ? 's' : ''} selected`; pageElements.poBatchActionsBar.style.display = 'flex';
        const statusSelected = pageElements.batchUpdateStatusSelect.value !== ""; pageElements.batchApplyStatusBtn.disabled = !(statusSelected && count > 0 && count <= MAX_STATUS_UPDATE);
        if (count > MAX_STATUS_UPDATE) { pageElements.batchApplyStatusBtn.title = `Select up to ${MAX_STATUS_UPDATE} POs to update status.`; } else if (!statusSelected) { pageElements.batchApplyStatusBtn.title = `Select a status to apply.`; } else { pageElements.batchApplyStatusBtn.title = `Apply status to ${count} PO(s).`; }
        pageElements.batchDeletePoBtn.disabled = !(count > 0 && count <= MAX_DELETE);
         if (count > MAX_DELETE) { pageElements.batchDeletePoBtn.title = `Select up to ${MAX_DELETE} POs to delete.`; } else { pageElements.batchDeletePoBtn.title = `Delete ${count} selected PO(s).`; }
        pageElements.batchMarkReceivedBtn.disabled = (count === 0);
        const displayedCheckboxes = pageElements.poTableBody.querySelectorAll('.po-select-checkbox'); pageElements.selectAllPoCheckbox.checked = displayedCheckboxes.length > 0 && count === displayedCheckboxes.length;
    } else {
        pageElements.poBatchActionsBar.style.display = 'none'; pageElements.selectAllPoCheckbox.checked = false; pageElements.batchUpdateStatusSelect.value = ""; pageElements.batchApplyStatusBtn.disabled = true; pageElements.batchDeletePoBtn.disabled = true; pageElements.batchMarkReceivedBtn.disabled = true;
    }
}
// Keep listeners (SelectAll, Individual Checkbox, DeselectAll, Batch Buttons) - Modify to use pageElements where applicable


// --- Event Listeners Setup ---
function setupEventListeners() {
    if (listenersAttached) { console.log("Listeners already attached."); return; }
    if (Object.keys(pageElements).length === 0) { console.error("DOM elements not queried before attaching listeners. Aborting."); return; }
    console.log("Setting up event listeners using pageElements...");

    // Use pageElements.elementName?.addEventListener(...) for safety
    pageElements.supplierTableBody?.addEventListener('click', handleSupplierTableActions);
    pageElements.supplierTableBody?.addEventListener('click', handleSupplierRowClick);
    pageElements.addNewSupplierBtn?.addEventListener('click', () => openSupplierModal('add'));
    pageElements.closeSupplierModalBtn?.addEventListener('click', closeSupplierModal);
    pageElements.cancelSupplierBtn?.addEventListener('click', closeSupplierModal);
    pageElements.supplierForm?.addEventListener('submit', handleAddSupplierSubmit);
    pageElements.supplierModal?.addEventListener('click', (event) => { if (event.target === pageElements.supplierModal) closeSupplierModal(); });
    pageElements.deleteSupplierFromModalBtn?.addEventListener('click', handleDeleteSupplierFromModal);
    pageElements.poFilterBtn?.addEventListener('click', () => { poPagination.currentPage = 1; poPagination.lastVisibleDoc = null; displayPoList(); });
    pageElements.poClearFilterBtn?.addEventListener('click', () => { if(pageElements.poSearchInput) pageElements.poSearchInput.value = ''; if(pageElements.poSupplierFilter) pageElements.poSupplierFilter.value = ''; if(pageElements.poStatusFilter) pageElements.poStatusFilter.value = ''; if(pageElements.poStartDateFilter) pageElements.poStartDateFilter.value = ''; if(pageElements.poEndDateFilter) pageElements.poEndDateFilter.value = ''; currentPoSortField = 'createdAt'; currentPoSortDirection = 'desc'; updateSortIndicators(); poPagination.currentPage = 1; poPagination.lastVisibleDoc = null; displayPoList(); });
    pageElements.poSearchInput?.addEventListener('keypress', (event) => { if (event.key === 'Enter') { event.preventDefault(); if (pageElements.poFilterBtn) { pageElements.poFilterBtn.click(); } else { poPagination.currentPage = 1; poPagination.lastVisibleDoc = null; displayPoList(); } } });
    pageElements.poTableHeader?.addEventListener('click', handlePoSort);
    pageElements.poTableBody?.addEventListener('click', handlePOTableActions);
    pageElements.batchUpdateStatusSelect?.addEventListener('change', updateBatchActionBar);
    pageElements.closeStatusModalBtn?.addEventListener('click', closeStatusModal);
    pageElements.cancelStatusBtn?.addEventListener('click', closeStatusModal);
    pageElements.statusUpdateForm?.addEventListener('submit', handleStatusUpdate);
    pageElements.statusUpdateModal?.addEventListener('click', (event) => { if (event.target === pageElements.statusUpdateModal) closeStatusModal(); });
    // PO Share Modal Listeners
    pageElements.closePoShareModalTopBtn?.addEventListener('click', closePoShareModalFunction);
    pageElements.closePoShareModalBtn?.addEventListener('click', closePoShareModalFunction);
    pageElements.poShareModal?.addEventListener('click', (event) => { if (event.target === pageElements.poShareModal) closePoShareModalFunction(); });
    pageElements.printPoShareModalBtn?.addEventListener('click', handlePrintPoShare);
    pageElements.copyPoShareModalBtn?.addEventListener('click', handleCopyPoShareContent);
    // PO Items Modal (See More) Listeners
    pageElements.closePoItemsModalBtn?.addEventListener('click', closePoItemsModal);
    pageElements.closePoItemsModalBottomBtn?.addEventListener('click', closePoItemsModal);
    pageElements.poItemsModal?.addEventListener('click', (event) => { if (event.target === pageElements.poItemsModal) closePoItemsModal(); });
    pageElements.exportPoCsvBtn?.addEventListener('click', () => { alert("CSV Export needs implementation."); });

    // Batch Action Listeners (Ensure these exist in HTML)
    pageElements.selectAllPoCheckbox?.addEventListener('change', (event) => { /* ... existing logic ... */ updateBatchActionBar(); });
    pageElements.poTableBody?.addEventListener('change', (event) => { if (event.target.classList.contains('po-select-checkbox')) { /* ... existing logic ... */ updateBatchActionBar(); } });
    pageElements.deselectAllPoBtn?.addEventListener('click', () => { /* ... existing logic ... */ updateBatchActionBar(); });
    pageElements.batchApplyStatusBtn?.addEventListener('click', async () => { /* ... existing logic ... */ });
    pageElements.batchMarkReceivedBtn?.addEventListener('click', async () => { /* ... existing logic ... */ });
    pageElements.batchDeletePoBtn?.addEventListener('click', async () => { /* ... existing logic ... */ });


    listenersAttached = true;
    console.log("Event listeners attached successfully.");
}


// --- MAIN INITIALIZATION FUNCTION ---
async function initializeSupplierManagementPage(user) {
    if (pageInitialized) { console.log("Supplier Management Page already initialized."); return; }
    pageInitialized = true;
    console.log("Initializing Supplier Management Page for user:", user.uid);

    // Ensure DOM elements are queried before setup
    if (Object.keys(pageElements).length === 0) {
        console.error("DOM elements not queried before initialization!");
        if (!queryPageElements()) { // Attempt query again
             displayError("Page elements missing. Cannot initialize.", "poListError");
             return;
        }
    }

    // Setup listeners only once
    if (!listenersAttached) {
        setupEventListeners();
    }

    try {
         console.log("Performing initial data load...");
         await displaySupplierTable();
         await displayPoList();
         console.log("Initial data load complete.");
    } catch (error) {
         console.error("Error during initial data load:", error);
         displayError("Failed to load initial page data.", 'poListError');
    } finally {
        // Hide any main loading indicator if you have one
        console.log("Initialization sequence finished.");
    }
}


// --- Auth State Listener & Initialization Trigger ---
function initPageOnLoad() {
     console.log("DOM loaded. Setting up Auth listener for supplier_management.js");

     // Query DOM elements immediately after DOM is loaded
     if (!queryPageElements()) {
          displayError("Page structure is broken. Cannot initialize fully.", "poListError");
          return; // Stop if critical elements are missing
     }

     // Now setup Auth listener
     onAuthStateChanged(auth, (user) => {
         if (user) {
             // User is signed in, initialize the page functionality
             initializeSupplierManagementPage(user);
         } else {
             // User is signed out - redirect is handled by inline script
             console.log("User is signed out on supplier_management.js");
         }
     });
}

// --- RUN INITIALIZATION ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPageOnLoad);
} else {
    initPageOnLoad(); // DOM already loaded
}

// Removed: window.initializeSupplierManagementPage definition