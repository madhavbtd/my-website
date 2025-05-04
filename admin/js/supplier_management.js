// js/supplier_management.js - v23 (Fix handleSupplierTableActions error, Refined PO Load)

// --- Imports ---
// import { generatePoPdf } from './utils.js'; // Ensure this utility exists if uncommented
import { db, auth } from './firebase-init.js';
import {
    collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc,
    query, orderBy, where, Timestamp, serverTimestamp, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- DOM Elements ---
// (Keep all DOM element variables exactly as defined in v22)
// PO Section
const poTableBody = document.getElementById('poTableBody');
const poSearchInput = document.getElementById('poSearchInput');
const poSupplierFilter = document.getElementById('poSupplierFilter');
const poStatusFilter = document.getElementById('poStatusFilter');
const poStartDateFilter = document.getElementById('poStartDateFilter');
const poEndDateFilter = document.getElementById('poEndDateFilter');
const poFilterBtn = document.getElementById('poFilterBtn');
const poClearFilterBtn = document.getElementById('poClearFilterBtn');
const poTotalsDisplay = document.getElementById('poTotalsDisplay');
const poLoadingMessage = document.getElementById('poLoadingMessage');
const poListError = document.getElementById('poListError');
const poPaginationControls = document.getElementById('poPaginationControls');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageInfo = document.getElementById('pageInfo');
const itemsPerPageSelect = document.getElementById('itemsPerPageSelect');
const selectAllPoCheckbox = document.getElementById('selectAllPoCheckbox');
const poBatchActionsBar = document.getElementById('poBatchActionsBar');
const poSelectedCount = document.getElementById('poSelectedCount');
const batchUpdateStatusSelect = document.getElementById('batchUpdateStatusSelect');
const batchApplyStatusBtn = document.getElementById('batchApplyStatusBtn');
const batchMarkReceivedBtn = document.getElementById('batchMarkReceivedBtn');
const batchDeletePoBtn = document.getElementById('batchDeletePoBtn');
const deselectAllPoBtn = document.getElementById('deselectAllPoBtn');
const poTableHeader = document.querySelector('#poTable thead');

// Supplier Section
const suppliersListSection = document.getElementById('suppliersListSection');
const supplierTableBody = document.getElementById('supplierTableBody');
const supplierLoadingMessage = document.getElementById('supplierLoadingMessage');
const supplierListError = document.getElementById('supplierListError');
const addNewSupplierBtn = document.getElementById('addNewSupplierBtn');

// Supplier Modal
const supplierModal = document.getElementById('supplierModal');
const supplierModalTitle = document.getElementById('supplierModalTitle');
const closeSupplierModalBtn = document.getElementById('closeSupplierModal');
const cancelSupplierBtn = document.getElementById('cancelSupplierBtn');
const saveSupplierBtn = document.getElementById('saveSupplierBtn');
const supplierForm = document.getElementById('supplierForm');
const editSupplierIdInput = document.getElementById('editSupplierId');
const supplierNameInput = document.getElementById('supplierNameInput');
const supplierCompanyInput = document.getElementById('supplierCompanyInput');
const supplierWhatsappInput = document.getElementById('supplierWhatsappInput');
const supplierEmailInput = document.getElementById('supplierEmailInput');
const supplierAddressInput = document.getElementById('supplierAddressInput');
const supplierGstInput = document.getElementById('supplierGstInput');
const supplierFormError = document.getElementById('supplierFormError');

// Status Update Modal
const statusUpdateModal = document.getElementById('statusUpdateModal');
const statusModalTitle = document.getElementById('statusModalTitle');
const closeStatusModalBtn = document.getElementById('closeStatusModal');
const cancelStatusBtn = document.getElementById('cancelStatusBtn');
const saveStatusBtn = document.getElementById('saveStatusBtn');
const statusUpdateForm = document.getElementById('statusUpdateForm');
const statusUpdatePOId = document.getElementById('statusUpdatePOId');
const currentPOStatusSpan = document.getElementById('currentPOStatus');
const statusSelect = document.getElementById('statusSelect');
const statusErrorMsg = document.getElementById('statusErrorMsg');

// PO Details Modal
const poDetailsModal = document.getElementById('poDetailsModal');
const poDetailsModalTitle = document.getElementById('poDetailsModalTitle');
const closePoDetailsModalBtn = document.getElementById('closePoDetailsModal');
const closePoDetailsBtn = document.getElementById('closePoDetailsModalBottomBtn');
const poDetailsContent = document.getElementById('poDetailsContent');
const printPoDetailsBtn = document.getElementById('printPoDetailsBtn');

// PO Share Modal
const poShareModal = document.getElementById('poShareModal');
const poShareModalTitle = document.getElementById('poShareModalTitle');
const closePoShareModal = document.getElementById('closePoShareModalTopBtn');
const closePoShareModalBtn = document.getElementById('closePoShareModalBtn');
const printPoShareModalBtn = document.getElementById('printPoShareModalBtn');
const emailPoShareModalBtn = document.getElementById('emailPoShareModalBtn');

// Export Button
const exportPoCsvBtn = document.getElementById('exportPoCsvBtn');


// --- Global State ---
// (Keep global state variables exactly as defined in v22)
let currentEditingSupplierId = null;
let suppliersDataCache = [];
let cachedPOs = {};
let currentPoQuery = null;
let poQueryUnsubscribe = null;
let poPagination = { currentPage: 1, itemsPerPage: 25, lastVisibleDoc: null, firstVisibleDoc: null, totalItems: 0, hasNextPage: false, hasPrevPage: false }; // Added default values
let selectedPoIds = new Set();
let currentPoSortField = 'createdAt';
let currentPoSortDirection = 'desc';


// --- Utility Functions ---
// (Keep escapeHtml, formatCurrency, formatDate as they were)
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { try { unsafe = String(unsafe ?? ''); } catch (e) { unsafe = ''; } } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function formatCurrency(amount) { const num = Number(amount); if (isNaN(num)) return 'N/A'; return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatDate(timestamp) { if (!timestamp || typeof timestamp.toDate !== 'function') return '-'; try { return timestamp.toDate().toLocaleDateString('en-GB'); } catch (e) { console.error("Error formatting date:", e); return '-'; } }


// --- Error Display Functions ---
// (Keep showSupplierListError, showPoListError, showSupplierFormError, showStatusError as they were)
function showSupplierListError(message) { if(supplierListError) { supplierListError.textContent = message; supplierListError.style.display = message ? 'block' : 'none'; } if(supplierLoadingMessage) supplierLoadingMessage.style.display = 'none'; if(supplierTableBody) supplierTableBody.innerHTML = ''; }
function showPoListError(message) { if(poListError) { poListError.textContent = message; poListError.style.display = message ? 'block' : 'none'; } if(poLoadingMessage) poLoadingMessage.style.display = 'none'; if(poTableBody) poTableBody.innerHTML = ''; }
function showSupplierFormError(message) { if(supplierFormError) { supplierFormError.textContent = message; supplierFormError.style.display = message ? 'block' : 'none'; } }
function showStatusError(message) { if(statusErrorMsg) { statusErrorMsg.textContent = message; statusErrorMsg.style.display = message ? 'block' : 'none'; } }


// --- Supplier List Functions ---
// (Keep displaySupplierTable and populateSupplierFilterDropdown as they were)
async function displaySupplierTable() {
    if (!supplierTableBody || !supplierLoadingMessage) { console.error("Supplier table body missing"); return; }
    if (!db || !collection || !getDocs || !query || !orderBy) { showSupplierListError("Error: DB functions missing."); return; }
    showSupplierListError('');
    supplierLoadingMessage.style.display = 'table-row';
    supplierTableBody.innerHTML = '';
    suppliersDataCache = [];
    try {
        const q = query(collection(db, "suppliers"), orderBy("name_lowercase"));
        const querySnapshot = await getDocs(q);
        supplierLoadingMessage.style.display = 'none';
        if (querySnapshot.empty) {
            supplierTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 15px;">No suppliers found.</td></tr>';
        } else {
            querySnapshot.forEach((docSnapshot) => {
                const supplier = docSnapshot.data();
                const supplierId = docSnapshot.id;
                suppliersDataCache.push({ id: supplierId, ...supplier });
                const tr = document.createElement('tr');
                tr.setAttribute('data-id', supplierId);
                const name = escapeHtml(supplier.name || 'N/A');
                const contact = escapeHtml(supplier.whatsappNo || supplier.contactNo || '-');
                const balancePlaceholder = `<span class="balance-loading" style="font-style: italic; color: #999;">Calculating...</span>`;
                // *** Ensure button HTML is correct here ***
                tr.innerHTML = `
                    <td>${name}</td>
                    <td>${contact}</td>
                    <td class="supplier-balance-cell">${balancePlaceholder}</td>
                    <td class="action-buttons">
                        <button class="button view-account-button small-button" data-id="${supplierId}" title="View Account Details"><i class="fas fa-eye"></i></button>
                        <button class="button edit-button small-button" data-id="${supplierId}" title="Edit Supplier"><i class="fas fa-edit"></i></button>
                        <button class="button delete-button small-button" data-id="${supplierId}" data-name="${escapeHtml(supplier.name || '')}" title="Delete Supplier"><i class="fas fa-trash-alt"></i></button>
                    </td>`;
                supplierTableBody.appendChild(tr);
            });
            populateSupplierFilterDropdown();
            // updateSupplierBalances(suppliersDataCache); // TODO later
        }
        console.log(`Displayed ${querySnapshot.size} suppliers.`);
    } catch (error) {
        console.error("Error fetching suppliers: ", error);
        showSupplierListError(`Error loading suppliers: ${error.message}`);
        populateSupplierFilterDropdown(); // Populate even on error
    }
}
function populateSupplierFilterDropdown() {
    // (Keep this function exactly as it was in v23)
     if (!poSupplierFilter) return;
    const selectedVal = poSupplierFilter.value;
    poSupplierFilter.innerHTML = '<option value="">All Suppliers</option>';
    const sortedSuppliers = [...suppliersDataCache].sort((a, b) => (a.name_lowercase || '').localeCompare(b.name_lowercase || ''));
    sortedSuppliers.forEach(supplier => {
        const option = document.createElement('option');
        option.value = supplier.id;
        option.textContent = escapeHtml(supplier.name || supplier.id);
        poSupplierFilter.appendChild(option);
    });
    if (poSupplierFilter.querySelector(`option[value="${selectedVal}"]`)) { poSupplierFilter.value = selectedVal; }
    else { poSupplierFilter.value = ""; }
    console.log("Supplier filter dropdown populated.");
}

// --- handleSupplierTableActions (Keep the updated version from last response) ---
function handleSupplierTableActions(event) {
    const targetButton = event.target.closest('button[data-id]'); // Target button with data-id
    if (!targetButton) return;

    const supplierId = targetButton.dataset.id;
    if (!supplierId) {
        console.error("Action button clicked, but Supplier ID missing from data-id attribute.");
        return;
    }
    console.log(`Action button clicked: Supplier ID = ${supplierId}, Classes = ${targetButton.className}`); // Debug Log

    if (targetButton.classList.contains('view-account-button')) {
        console.log(`Navigating to account details for supplier: ${supplierId}`);
        try {
            window.location.href = `supplier_account_detail.html?id=${supplierId}`; // Navigation line
        } catch (navError) { console.error("Navigation Error:", navError); alert("Could not navigate."); }
    } else if (targetButton.classList.contains('edit-button')) {
        console.log(`Opening edit modal for supplier: ${supplierId}`);
        const supplierData = suppliersDataCache.find(s => s.id === supplierId);
        if (supplierData) { openSupplierModal('edit', supplierData, supplierId); }
        else { /* Fetch fallback */ }
    } else if (targetButton.classList.contains('delete-button')) {
        console.log(`Initiating delete for supplier: ${supplierId}`);
        const supplierName = targetButton.dataset.name || supplierId;
        deleteSupplier(supplierId, supplierName);
    } else { console.log("Clicked on an unknown action button:", targetButton.className); }
}


// --- Supplier Modal/CRUD Functions ---
// (Keep openSupplierModal, closeSupplierModal, saveSupplier, deleteSupplier as they were)
function openSupplierModal(mode = 'add', supplierData = null, supplierId = null) { /* ... */ }
function closeSupplierModal() { /* ... */ }
async function saveSupplier(event) { /* ... */ }
async function deleteSupplier(supplierId, supplierName) { /* ... */ }


// --- PO List Functions ---
// (Keep displayPoList as it was in v23 - includes filter/sort query building)
async function displayPoList() {
    if (!poTableBody || !poLoadingMessage) return;
    if (!db || !collection || !getDocs || !query || !orderBy || !where || !doc || !getDoc || !Timestamp || !limit) { showPoListError("Error: DB functions missing."); return; }
    showPoListError('');
    poLoadingMessage.style.display = 'table-row';
    poTableBody.innerHTML = '';
    if (poTotalsDisplay) poTotalsDisplay.textContent = 'Loading totals...';
    if (poPaginationControls) poPaginationControls.style.display = 'none';
    selectedPoIds.clear();
    updateBatchActionBar();
    if (selectAllPoCheckbox) selectAllPoCheckbox.checked = false;

    try {
        let conditions = [];
        let baseQuery = collection(db, "purchaseOrders");
        const searchTerm = poSearchInput.value.trim().toLowerCase();
        const supplierFilterId = poSupplierFilter.value; // Reads the selected supplier
        const statusFilter = poStatusFilter.value;
        const startDateVal = poStartDateFilter.value;
        const endDateVal = poEndDateFilter.value;

        // Build Conditions
        if (supplierFilterId) { conditions.push(where("supplierId", "==", supplierFilterId)); }
        if (statusFilter) { conditions.push(where("status", "==", statusFilter)); }
        if (startDateVal) { try { conditions.push(where("orderDate", ">=", Timestamp.fromDate(new Date(startDateVal + 'T00:00:00')))); } catch (e) {} }
        if (endDateVal) { try { conditions.push(where("orderDate", "<=", Timestamp.fromDate(new Date(endDateVal + 'T23:59:59')))); } catch (e) {} }

        // Build Sorting
        const sortFieldMapping = { poNumber: 'poNumber', orderDate: 'orderDate', supplierName: 'supplierName', totalAmount: 'totalAmount', status: 'status', paymentStatus: 'paymentStatus' };
        const firestoreSortField = sortFieldMapping[currentPoSortField] || 'createdAt';
        const firestoreSortDirection = currentPoSortDirection || 'desc';
        let sortClauses = [orderBy(firestoreSortField, firestoreSortDirection)];
        if (firestoreSortField !== 'createdAt') { sortClauses.push(orderBy('createdAt', 'desc')); }

        // Build Query
        const queryLimit = 100; // Placeholder limit
        currentPoQuery = query(baseQuery, ...conditions, ...sortClauses, limit(queryLimit));

        // Fetch and Display
        const querySnapshot = await getDocs(currentPoQuery);
        poLoadingMessage.style.display = 'none';
        let filteredDocs = querySnapshot.docs;
        let grandTotalAmount = 0;
        cachedPOs = {};

        if (searchTerm) { // Basic client-side search
             filteredDocs = filteredDocs.filter(docRef_po => {
                const po = docRef_po.data();
                return po.poNumber?.toString().toLowerCase().includes(searchTerm);
            });
        }

        if (filteredDocs.length === 0) {
             poTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 15px;">No POs found.</td></tr>`; // colspan=8
             if (poTotalsDisplay) poTotalsDisplay.textContent = 'Total PO Value: ₹ 0.00';
             return;
        }

        // Loop and render rows (HTML structure as before)
        filteredDocs.forEach(docRef_po => {
            const po = docRef_po.data();
            const poId = docRef_po.id;
            cachedPOs[poId] = po;
            let supplierName = suppliersDataCache.find(s => s.id === po.supplierId)?.name || po.supplierName || 'Unknown';
            let orderDateStr = formatDate(po.orderDate || po.createdAt);
            let statusText = po.status || 'Unknown';
            let statusClass = statusText.toLowerCase().replace(/\s+/g, '-');
            let paymentStatusText = po.paymentStatus || 'Pending';
            let paymentStatusClass = paymentStatusText.toLowerCase().replace(/\s+/g, '-');
            let amount = po.totalAmount || 0;
            let amountStr = formatCurrency(amount);
            grandTotalAmount += amount;
            const tr = document.createElement('tr');
            tr.setAttribute('data-id', poId);
            // *** Ensure the row HTML matches the header (8 data cells + 1 checkbox cell) ***
            tr.innerHTML = `
                <td style="text-align: center;"><input type="checkbox" class="po-select-checkbox" value="${poId}"></td>
                <td class="po-number-link" title="View PO Details">${escapeHtml(po.poNumber || 'N/A')}</td>
                <td>${orderDateStr}</td>
                <td>${escapeHtml(supplierName)}</td>
                <td style="text-align: right;">${amountStr}</td>
                <td><span class="status-badge status-${statusClass}">${escapeHtml(statusText)}</span></td>
                <td><span class="payment-badge payment-${paymentStatusClass}">${escapeHtml(paymentStatusText)}</span></td>
                <td class="action-buttons">
                    ${statusText === 'Sent' || statusText === 'Printing' ? `<button class="button mark-received-btn small-button success-button" data-id="${poId}" title="Mark as Received"><i class="fas fa-check"></i></button>` : ''}
                    <a href="new_po.html?editPOId=${poId}" class="button edit-button small-button" title="Edit PO"><i class="fas fa-edit"></i></a>
                    <button class="button status-button small-button" data-id="${poId}" data-number="${escapeHtml(po.poNumber)}" data-status="${escapeHtml(statusText)}" title="Update Status"><i class="fas fa-sync-alt"></i></button>
                    <button class="button share-button small-button" data-id="${poId}" title="Share PO"><i class="fas fa-share-alt"></i></button>
                    <button class="button pdf-button small-button" data-id="${poId}" title="Generate PDF"><i class="fas fa-file-pdf"></i></button>
                    <button class="button delete-button small-button" data-id="${poId}" data-number="${escapeHtml(po.poNumber)}" title="Delete PO"><i class="fas fa-trash-alt"></i></button>
                </td>`;
            poTableBody.appendChild(tr);
        });


        if (poTotalsDisplay) poTotalsDisplay.textContent = `Total PO Value (Displayed): ${formatCurrency(grandTotalAmount)}`;
        // updatePaginationControls(querySnapshot); // TODO later
        console.log(`Displayed ${filteredDocs.length} POs.`);

    } catch (error) {
        console.error("Error fetching/displaying POs: ", error);
        if (error.code === 'failed-precondition') { showPoListError(`Error: Firestore index missing. Check console. Details: ${error.message}`); }
        else { showPoListError(`Error loading POs: ${error.message}`); }
        if (poTotalsDisplay) poTotalsDisplay.textContent = 'Error loading totals';
    }
}


// --- PO Table Sorting Logic (handlePoSort, updateSortIndicators) ---
// (Keep these functions exactly as they were in v23)
function handlePoSort(event) { const header = event.target.closest('th[data-sortable="true"]'); if (!header) return; const sortKey = header.dataset.sortKey; if (!sortKey) return; let newDirection; if (currentPoSortField === sortKey) { newDirection = currentPoSortDirection === 'asc' ? 'desc' : 'asc'; } else { newDirection = 'asc'; } currentPoSortField = sortKey; currentPoSortDirection = newDirection; console.log(`Sorting POs by: ${currentPoSortField}, Dir: ${currentPoSortDirection}`); updateSortIndicators(); displayPoList(); }
function updateSortIndicators() { if (!poTableHeader) return; poTableHeader.querySelectorAll('th[data-sortable="true"]').forEach(th => { th.classList.remove('sort-asc', 'sort-desc'); th.querySelector('.sort-indicator')?.remove(); if (th.dataset.sortKey === currentPoSortField) { const indicator = document.createElement('span'); indicator.classList.add('sort-indicator'); if (currentPoSortDirection === 'asc') { th.classList.add('sort-asc'); indicator.innerHTML = ' &uarr;'; } else { th.classList.add('sort-desc'); indicator.innerHTML = ' &darr;'; } th.appendChild(indicator); } }); }


// --- PO Table Action Handling (handlePOTableActions) ---
// (Keep this function as it was in v23)
async function handlePOTableActions(event) {
    const actionElement = event.target.closest('button[data-id], a.edit-button');
    const targetCell = event.target.closest('td');

    if (targetCell && targetCell.classList.contains('po-number-link')) {
        const row = targetCell.closest('tr'); const poId = row?.dataset.id; if (poId) { openPoShareModal(poId); } return;
    }
    if (!actionElement) return;
    const poId = actionElement.dataset.id; const poNumber = actionElement.dataset.number; if (!poId) { console.error("PO ID missing"); return; }

    if (actionElement.classList.contains('edit-button') && actionElement.tagName === 'A') { console.log(`Navigating to edit PO: ${poId}`); }
    else if (actionElement.classList.contains('status-button')) { const currentStatus = actionElement.dataset.status; openStatusModal(poId, currentStatus, poNumber); }
    else if (actionElement.classList.contains('share-button')) { openPoShareModal(poId); }
    else if (actionElement.classList.contains('pdf-button')) {
         actionElement.disabled = true; actionElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        try { /* Existing PDF logic... ensure generatePoPdf is available */
             let poData = cachedPOs[poId]; if (!poData) { const poSnap = await getDoc(doc(db, "purchaseOrders", poId)); if (poSnap.exists()) poData = poSnap.data(); } if (!poData) throw new Error(`PO data ${poId}`); let supplierData = suppliersDataCache.find(s => s.id === poData.supplierId); if (!supplierData && poData.supplierId) { const supSnap = await getDoc(doc(db, "suppliers", poData.supplierId)); if (supSnap.exists()) supplierData = supSnap.data(); } if (!supplierData) { supplierData = { name: poData.supplierName || 'Unknown' }; } if (typeof generatePoPdf === 'function') { await generatePoPdf(poData, supplierData); } else { alert("PDF function unavailable."); }
        } catch (error) { console.error("PDF Error:", error); alert("PDF Error: " + error.message); }
        finally { actionElement.disabled = false; actionElement.innerHTML = '<i class="fas fa-file-pdf"></i>'; }
     }
    else if (actionElement.classList.contains('delete-button')) { handleDeletePO(poId, poNumber); }
    else if (actionElement.classList.contains('mark-received-btn')) { markPOAsReceived(poId); }
}

// --- PO Receiving Logic Placeholder (markPOAsReceived) ---
// (Keep this function as it was in v23)
async function markPOAsReceived(poId) { if (!poId || !db || !doc || !updateDoc || !serverTimestamp) { alert("Error: Cannot mark PO as received."); return; } if (confirm(`Mark PO #${poId.substring(0, 6)}... as 'Product Received'?`)) { try { await updateDoc(doc(db, "purchaseOrders", poId), { status: "Product Received", receivedDate: serverTimestamp(), updatedAt: serverTimestamp() }); alert("PO status updated."); displayPoList(); } catch (error) { console.error(`Error marking PO ${poId} received:`, error); alert("Error: " + error.message); } } }


// --- Status Update Modal Functions (openStatusModal, closeStatusModal, handleStatusUpdate) ---
// (Keep these functions exactly as they were)
function openStatusModal(poId, currentStatus, poNumber) { /* ... */ }
function closeStatusModal() { /* ... */ }
async function handleStatusUpdate(event) { /* ... */ }


// --- Delete PO Function (handleDeletePO) ---
// (Keep this function exactly as it was)
async function handleDeletePO(poId, poNumber) { /* ... */ }


// --- PO Details & Share Modal Functions ---
// (Keep existing placeholders or actual functions)
async function openPoDetailsModal(poId) { console.log("openPoDetailsModal called for", poId); alert("PO Details Modal needs implementation."); }
function closePoDetailsModal() { /* ... */ }
async function openPoShareModal(poId) { console.log("openPoShareModal called for", poId); alert("PO Share Modal needs implementation."); }
function closePoShareModalFunction() { /* ... */ }
function handleEmailPoShare(event) { console.log("Email PO called"); alert("Email PO needs implementation."); }


// --- Batch Action Bar Update (Placeholder) ---
function updateBatchActionBar() { /* ... (same as v23) ... */ }


// --- Page Initialization & Event Listeners Setup ---
// (Keep initializeSupplierManagementPage and setupEventListeners as they were in v23)
async function initializeSupplierManagementPage(user) {
    console.log("Initializing Supplier Management Page v23...");
    setupEventListeners(); // Setup all event listeners first
    try {
        await displaySupplierTable(); // Load suppliers (populates filter)
        await displayPoList();      // Then load initial POs
    } catch (error) {
        console.error("Error during initial data load:", error);
        // Errors should be shown by individual display functions
    }
     console.log("Supplier Management Page Initialized v23.");
}

function setupEventListeners() {
    console.log("Setting up event listeners v23...");

    // --- Supplier List Actions ---
    if (supplierTableBody) {
        supplierTableBody.addEventListener('click', handleSupplierTableActions); // Use corrected handler
    } else { console.error("Supplier table body not found for event listener."); }

    // --- Supplier Modal ---
    if (addNewSupplierBtn) addNewSupplierBtn.addEventListener('click', () => openSupplierModal('add'));
    if (closeSupplierModalBtn) closeSupplierModalBtn.addEventListener('click', closeSupplierModal);
    if (cancelSupplierBtn) cancelSupplierBtn.addEventListener('click', closeSupplierModal);
    if (supplierForm) supplierForm.addEventListener('submit', saveSupplier);
    if (supplierModal) supplierModal.addEventListener('click', (event) => { if (event.target === supplierModal) closeSupplierModal(); });

    // --- PO Filters ---
    if (poFilterBtn) {
        poFilterBtn.addEventListener('click', () => {
            poPagination.currentPage = 1;
            poPagination.lastVisibleDoc = null;
            displayPoList();
        });
    }
    if (poClearFilterBtn) {
        poClearFilterBtn.addEventListener('click', () => {
            if(poSearchInput) poSearchInput.value = '';
            if(poSupplierFilter) poSupplierFilter.value = '';
            if(poStatusFilter) poStatusFilter.value = '';
            if(poStartDateFilter) poStartDateFilter.value = '';
            if(poEndDateFilter) poEndDateFilter.value = '';
            currentPoSortField = 'createdAt'; currentPoSortDirection = 'desc';
            updateSortIndicators();
            poPagination.currentPage = 1; poPagination.lastVisibleDoc = null;
            displayPoList();
        });
    }

    // --- PO Table Sorting ---
    if (poTableHeader) {
        poTableHeader.addEventListener('click', handlePoSort);
    } else { console.error("PO table header not found for sort listener."); }

    // --- PO Table Actions (Delegated) ---
    if (poTableBody) {
        poTableBody.addEventListener('click', handlePOTableActions);
    } else { console.error("PO table body not found for PO actions listener."); }

    // --- Batch Actions (Placeholders - Step 5) ---
    // TODO: Add listeners for selectAllPoCheckbox, po-select-checkbox, batch action buttons

    // --- Modals (Status, Details, Share) ---
    if (closeStatusModalBtn) closeStatusModalBtn.addEventListener('click', closeStatusModal);
    if (cancelStatusBtn) cancelStatusBtn.addEventListener('click', closeStatusModal);
    if (statusUpdateForm) statusUpdateForm.addEventListener('submit', handleStatusUpdate);
    if (statusUpdateModal) statusUpdateModal.addEventListener('click', (event) => { if (event.target === statusUpdateModal) closeStatusModal(); });

    if (closePoDetailsModalBtn) closePoDetailsModalBtn.addEventListener('click', closePoDetailsModal);
    if (closePoDetailsBtn) closePoDetailsBtn.addEventListener('click', closePoDetailsModal);
    if (poDetailsModal) poDetailsModal.addEventListener('click', (event) => { if (event.target === poDetailsModal) closePoDetailsModal(); });
    if (printPoDetailsBtn) printPoDetailsBtn.addEventListener('click', () => { alert("Print Details needs implementation."); });

    if (closePoShareModal) closePoShareModal.addEventListener('click', closePoShareModalFunction);
    if (closePoShareModalBtn) closePoShareModalBtn.addEventListener('click', closePoShareModalFunction);
    if (poShareModal) poShareModal.addEventListener('click', (event) => { if (event.target === poShareModal) closePoShareModalFunction(); });
    if (printPoShareModalBtn) printPoShareModalBtn.addEventListener('click', () => { alert("Print Share needs implementation."); });
    if (emailPoShareModalBtn) emailPoShareModalBtn.addEventListener('click', handleEmailPoShare);

    // --- CSV Export (Placeholder - Step 5) ---
    if (exportPoCsvBtn) exportPoCsvBtn.addEventListener('click', () => { alert("CSV Export needs implementation."); });

    // --- Pagination (Placeholder - Step 5) ---
    // TODO: Add listeners for prevPageBtn, nextPageBtn, itemsPerPageSelect

    console.log("Event listeners setup complete v23.");
}


// Make initialization function global
window.initializeSupplierManagementPage = initializeSupplierManagementPage;

console.log("supplier_management.js v23 (Fix handleSupplierTableActions) loaded.");