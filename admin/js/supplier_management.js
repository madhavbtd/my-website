// js/supplier_management.js - v22 (Step 2: PO Filter by Supplier & Sorting)

// --- Imports ---
// import { generatePoPdf } from './utils.js'; // Uncomment if utils.js and function exist
import { db, auth } from './firebase-init.js';
import {
    collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc,
    query, orderBy, where, Timestamp, serverTimestamp, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- DOM Elements ---
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
const poTableHeader = document.querySelector('#poTable thead'); // For Sort Listener

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
let currentEditingSupplierId = null;
let suppliersDataCache = [];
let cachedPOs = {};
let currentPoQuery = null;
let poQueryUnsubscribe = null;
let poPagination = { /* ... (same as before) ... */ };
let selectedPoIds = new Set();
let currentPoSortField = 'createdAt'; // Default sort field
let currentPoSortDirection = 'desc';  // Default sort direction

// --- Utility Functions (escapeHtml, formatCurrency, formatDate) ---
// ... (Keep these functions exactly as they were in the previous version) ...
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { try { unsafe = String(unsafe ?? ''); } catch (e) { unsafe = ''; } } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function formatCurrency(amount) { const num = Number(amount); if (isNaN(num)) return 'N/A'; return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatDate(timestamp) { if (!timestamp || typeof timestamp.toDate !== 'function') return '-'; try { return timestamp.toDate().toLocaleDateString('en-GB'); } catch (e) { console.error("Error formatting date:", e); return '-'; } }


// --- Error Display Functions (showSupplierListError, showPoListError, etc.) ---
// ... (Keep these functions exactly as they were) ...
function showSupplierListError(message) { if(supplierListError) { supplierListError.textContent = message; supplierListError.style.display = message ? 'block' : 'none'; } if(supplierLoadingMessage) supplierLoadingMessage.style.display = 'none'; if(supplierTableBody) supplierTableBody.innerHTML = ''; }
function showPoListError(message) { if(poListError) { poListError.textContent = message; poListError.style.display = message ? 'block' : 'none'; } if(poLoadingMessage) poLoadingMessage.style.display = 'none'; if(poTableBody) poTableBody.innerHTML = ''; }
function showSupplierFormError(message) { if(supplierFormError) { supplierFormError.textContent = message; supplierFormError.style.display = message ? 'block' : 'none'; } }
function showStatusError(message) { if(statusErrorMsg) { statusErrorMsg.textContent = message; statusErrorMsg.style.display = message ? 'block' : 'none'; } }


// --- Supplier List Functions (displaySupplierTable, populateSupplierFilterDropdown) ---
// ... (Keep these functions exactly as they were from the previous version) ...
async function displaySupplierTable() {
    if (!supplierTableBody || !supplierLoadingMessage) return;
    if (!db || !collection || !getDocs || !query || !orderBy) {
        showSupplierListError("Error: Required Firestore functions are missing."); return;
    }
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
            // updateSupplierBalances(suppliersDataCache); // Call balance update later
        }
        console.log(`Displayed ${querySnapshot.size} suppliers.`);
    } catch (error) {
        console.error("Error fetching suppliers: ", error);
        showSupplierListError(`Error loading suppliers: ${error.message}`);
        populateSupplierFilterDropdown();
    }
}
function populateSupplierFilterDropdown() {
    if (!poSupplierFilter) return;
    const selectedVal = poSupplierFilter.value; // Preserve selection if possible
    poSupplierFilter.innerHTML = '<option value="">All Suppliers</option>';
    const sortedSuppliers = [...suppliersDataCache].sort((a, b) =>
        (a.name_lowercase || '').localeCompare(b.name_lowercase || '')
    );
    sortedSuppliers.forEach(supplier => {
        const option = document.createElement('option');
        option.value = supplier.id;
        option.textContent = escapeHtml(supplier.name || supplier.id);
        poSupplierFilter.appendChild(option);
    });
    poSupplierFilter.value = selectedVal; // Restore selection
    console.log("Supplier filter dropdown populated.");
}


// --- Supplier Modal/CRUD Functions (openSupplierModal, closeSupplierModal, saveSupplier, deleteSupplier) ---
// ... (Keep these functions exactly as they were) ...
function openSupplierModal(mode = 'add', supplierData = null, supplierId = null) { if (!supplierModal || !supplierForm || !supplierModalTitle || !supplierFormError || !editSupplierIdInput || !supplierNameInput ) { console.error("Supplier modal elements not found!"); alert("Error: Could not open supplier form."); return; } supplierForm.reset(); showSupplierFormError(''); currentEditingSupplierId = null; if (mode === 'edit' && supplierData && supplierId) { supplierModalTitle.textContent = 'Edit Supplier'; editSupplierIdInput.value = supplierId; currentEditingSupplierId = supplierId; supplierNameInput.value = supplierData.name || ''; supplierCompanyInput.value = supplierData.companyName || ''; supplierWhatsappInput.value = supplierData.whatsappNo || ''; supplierEmailInput.value = supplierData.email || ''; supplierAddressInput.value = supplierData.address || ''; supplierGstInput.value = supplierData.gstNo || ''; } else { supplierModalTitle.textContent = 'Add New Supplier'; editSupplierIdInput.value = ''; } supplierModal.classList.add('active'); supplierNameInput.focus(); }
function closeSupplierModal() { if (supplierModal) { supplierModal.classList.remove('active'); } }
async function saveSupplier(event) { event.preventDefault(); if (!db || !collection || !addDoc || !doc || !updateDoc || !Timestamp || !serverTimestamp) { showSupplierFormError("Error: Required database functions missing."); return; } if (!saveSupplierBtn || !supplierNameInput ) { console.error("Save Supplier prerequisites missing."); alert("Error: Cannot save supplier due to missing form elements."); return; } const supplierName = supplierNameInput.value.trim(); if (!supplierName) { showSupplierFormError("Supplier Name is required."); supplierNameInput.focus(); return; } const supplierData = { name: supplierName, name_lowercase: supplierName.toLowerCase(), companyName: supplierCompanyInput.value.trim() || null, whatsappNo: supplierWhatsappInput.value.trim() || null, email: supplierEmailInput.value.trim() || null, address: supplierAddressInput.value.trim() || null, gstNo: supplierGstInput.value.trim() || null, }; saveSupplierBtn.disabled = true; saveSupplierBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; showSupplierFormError(''); try { const supplierIdToUse = editSupplierIdInput.value; if (supplierIdToUse) { supplierData.updatedAt = serverTimestamp(); const supplierRef = doc(db, "suppliers", supplierIdToUse); await updateDoc(supplierRef, supplierData); console.log("Supplier updated with ID: ", supplierIdToUse); alert("Supplier updated successfully!"); } else { supplierData.createdAt = serverTimestamp(); supplierData.updatedAt = serverTimestamp(); const docRef = await addDoc(collection(db, "suppliers"), supplierData); console.log("Supplier added with ID: ", docRef.id); alert("Supplier added successfully!"); } closeSupplierModal(); await displaySupplierTable(); } catch (error) { console.error("Error saving supplier: ", error); showSupplierFormError("Error saving supplier: " + error.message); } finally { if(saveSupplierBtn) { saveSupplierBtn.disabled = false; saveSupplierBtn.innerHTML = '<i class="fas fa-save"></i> Save Supplier'; } } }
async function deleteSupplier(supplierId, supplierName) { if (!db || !doc || !deleteDoc) { alert("Error: Required functions missing for deleting supplier."); return; } if (confirm(`Are you sure you want to delete supplier "${escapeHtml(supplierName || supplierId)}"? This action cannot be undone.`)) { console.log(`Attempting to delete supplier: ${supplierId}`); try { await deleteDoc(doc(db, "suppliers", supplierId)); console.log("Supplier deleted: ", supplierId); alert(`Supplier "${escapeHtml(supplierName || supplierId)}" deleted successfully.`); await displaySupplierTable(); await displayPoList(); } catch (error) { console.error("Error deleting supplier: ", error); alert("Error deleting supplier: " + error.message); } } else { console.log("Supplier delete cancelled."); } }


// --- PO List Functions ---

/**
 * Fetches and displays Purchase Orders based on current filters, sorting, and pagination.
 * NOW INCLUDES Supplier Filter and Sorting Logic.
 * TODO: Implement pagination fully.
 */
async function displayPoList() {
    if (!poTableBody || !poLoadingMessage) {
        console.error("PO table body or loading message element not found!");
        return;
    }
    if (!db || !collection || !getDocs || !query || !orderBy || !where || !doc || !getDoc || !Timestamp || !limit) {
        showPoListError("Error: Required Firestore functions are missing for PO list.");
        return;
    }

    showPoListError('');
    poLoadingMessage.style.display = 'table-row';
    poTableBody.innerHTML = ''; // Clear existing PO rows
    if (poTotalsDisplay) poTotalsDisplay.textContent = 'Loading totals...';
    if (poPaginationControls) poPaginationControls.style.display = 'none';

    selectedPoIds.clear();
    updateBatchActionBar();
    if (selectAllPoCheckbox) selectAllPoCheckbox.checked = false;

    try {
        // --- Build Firestore Query ---
        let conditions = [];
        let baseQuery = collection(db, "purchaseOrders");

        // Get filter values
        const searchTerm = poSearchInput.value.trim().toLowerCase();
        const supplierFilterId = poSupplierFilter.value; // *** NEW: Get selected supplier ***
        const statusFilter = poStatusFilter.value;
        const startDateVal = poStartDateFilter.value;
        const endDateVal = poEndDateFilter.value;

        // Apply server-side filters
        if (supplierFilterId) { // *** NEW: Add supplier condition ***
            conditions.push(where("supplierId", "==", supplierFilterId));
        }
        if (statusFilter) {
            conditions.push(where("status", "==", statusFilter));
        }
        if (startDateVal) {
            try {
                const startDate = Timestamp.fromDate(new Date(startDateVal + 'T00:00:00'));
                conditions.push(where("orderDate", ">=", startDate));
            } catch (e) { /* Handle error */ }
        }
        if (endDateVal) {
             try {
                const endDate = Timestamp.fromDate(new Date(endDateVal + 'T23:59:59'));
                conditions.push(where("orderDate", "<=", endDate));
            } catch (e) { /* Handle error */ }
        }

        // *** NEW: Apply Sorting based on global state ***
        // Map UI keys to Firestore fields if necessary
        const sortFieldMapping = {
            poNumber: 'poNumber', // Assuming poNumber is stored numerically or string sort is okay
            orderDate: 'orderDate',
            supplierName: 'supplierName', // Firestore might need index on this or supplierId
            totalAmount: 'totalAmount',
            status: 'status',
            paymentStatus: 'paymentStatus' // Assuming this field will exist
        };
        const firestoreSortField = sortFieldMapping[currentPoSortField] || 'createdAt'; // Default to createdAt if map fails
        const firestoreSortDirection = currentPoSortDirection || 'desc';

        let sortClauses = [orderBy(firestoreSortField, firestoreSortDirection)];
        // Add secondary sort for consistency, especially if sorting by non-unique fields
        if (firestoreSortField !== 'createdAt') {
            sortClauses.push(orderBy('createdAt', 'desc'));
        }
        // --- END NEW Sorting ---

        // TODO: Apply Pagination (limit, startAfter)
        const queryLimit = 100; // Still using a basic limit for now
        currentPoQuery = query(baseQuery, ...conditions, ...sortClauses, limit(queryLimit));

        // --- Fetch Data ---
        const querySnapshot = await getDocs(currentPoQuery);
        poLoadingMessage.style.display = 'none';

        let filteredDocs = querySnapshot.docs;
        let grandTotalAmount = 0;
        cachedPOs = {};

        // --- Client-side Search (If needed - might conflict with pagination/sorting) ---
        if (searchTerm) {
             // Simple PO Number search
             filteredDocs = filteredDocs.filter(docRef_po => {
                 const po = docRef_po.data();
                 return po.poNumber?.toString().toLowerCase().includes(searchTerm);
             });
         }
        // --- End Client-side Search ---

        if (filteredDocs.length === 0) {
            poTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 15px;">No purchase orders found matching your criteria.</td></tr>`;
            if (poTotalsDisplay) poTotalsDisplay.textContent = 'Total PO Value: ₹ 0.00';
            return;
        }

        // --- Process and display rows ---
        filteredDocs.forEach(docRef_po => {
            const po = docRef_po.data();
            const poId = docRef_po.id;
            cachedPOs[poId] = po;

            // Get supplier name from cache or use stored name
            let supplierName = suppliersDataCache.find(s => s.id === po.supplierId)?.name || po.supplierName || 'Unknown';
            let orderDateStr = formatDate(po.orderDate || po.createdAt);
            let statusText = po.status || 'Unknown';
            let statusClass = statusText.toLowerCase().replace(/\s+/g, '-');
            let paymentStatusText = po.paymentStatus || 'Pending'; // Placeholder
            let paymentStatusClass = paymentStatusText.toLowerCase().replace(/\s+/g, '-');
            let amount = po.totalAmount || 0;
            let amountStr = formatCurrency(amount);
            grandTotalAmount += amount;

            const tr = document.createElement('tr');
            tr.setAttribute('data-id', poId);

            // Use innerHTML as before, ensuring colspan matches the new header count (8)
            tr.innerHTML = `
                <td style="text-align: center;"><input type="checkbox" class="po-select-checkbox" value="${poId}"></td>
                <td class="po-number-link" title="View PO Details">${escapeHtml(po.poNumber || 'N/A')}</td>
                <td>${orderDateStr}</td>
                <td>${escapeHtml(supplierName)}</td>
                <td style="text-align: right;">${amountStr}</td>
                <td><span class="status-badge status-${statusClass}">${escapeHtml(statusText)}</span></td>
                 <td><span class="payment-badge payment-${paymentStatusClass}">${escapeHtml(paymentStatusText)}</span></td> <td class="action-buttons">
                    ${statusText === 'Sent' || statusText === 'Printing' ? `<button class="button mark-received-btn small-button success-button" data-id="${poId}" title="Mark as Received"><i class="fas fa-check"></i></button>` : ''}
                    <a href="new_po.html?editPOId=${poId}" class="button edit-button small-button" title="Edit PO"><i class="fas fa-edit"></i></a>
                    <button class="button status-button small-button" data-id="${poId}" data-number="${escapeHtml(po.poNumber)}" data-status="${escapeHtml(statusText)}" title="Update Status"><i class="fas fa-sync-alt"></i></button>
                    <button class="button share-button small-button" data-id="${poId}" title="Share PO"><i class="fas fa-share-alt"></i></button>
                    <button class="button pdf-button small-button" data-id="${poId}" title="Generate PDF"><i class="fas fa-file-pdf"></i></button>
                    <button class="button delete-button small-button" data-id="${poId}" data-number="${escapeHtml(po.poNumber)}" title="Delete PO"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
            poTableBody.appendChild(tr);
        });

        if (poTotalsDisplay) {
            poTotalsDisplay.textContent = `Total PO Value (Displayed): ${formatCurrency(grandTotalAmount)}`;
        }

        // TODO: Update Pagination state and controls based on querySnapshot results
        // updatePaginationControls(querySnapshot);

        console.log(`Displayed ${filteredDocs.length} POs.`);

    } catch (error) {
        console.error("Error fetching or displaying POs: ", error);
        if (error.code === 'failed-precondition') {
             showPoListError(`Error: Firestore index missing for the current query/filter/sort combination. Please check Firestore console -> Indexes. Details: ${error.message}`);
        } else {
            showPoListError(`Error loading POs: ${error.message}`);
        }
        if (poTotalsDisplay) poTotalsDisplay.textContent = 'Error loading totals';
    }
}

// --- NEW: PO Table Sorting Logic ---
function handlePoSort(event) {
    const header = event.target.closest('th[data-sortable="true"]');
    if (!header) return; // Clicked on non-sortable header or padding

    const sortKey = header.dataset.sortKey;
    if (!sortKey) return;

    let newDirection;
    if (currentPoSortField === sortKey) {
        // Toggle direction if clicking the same header
        newDirection = currentPoSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // Default to ascending when clicking a new header
        newDirection = 'asc';
    }

    // Update global state
    currentPoSortField = sortKey;
    currentPoSortDirection = newDirection;

    console.log(`Sorting POs by: ${currentPoSortField}, Direction: ${currentPoSortDirection}`);

    // Update visual indicators on headers
    updateSortIndicators();

    // Refresh the PO list with new sorting
    displayPoList();
}

function updateSortIndicators() {
    if (!poTableHeader) return;
    poTableHeader.querySelectorAll('th[data-sortable="true"]').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        th.querySelector('.sort-indicator')?.remove(); // Remove existing indicator

        if (th.dataset.sortKey === currentPoSortField) {
            const indicator = document.createElement('span');
            indicator.classList.add('sort-indicator');
            if (currentPoSortDirection === 'asc') {
                th.classList.add('sort-asc');
                indicator.innerHTML = ' &uarr;'; // Up arrow
            } else {
                th.classList.add('sort-desc');
                indicator.innerHTML = ' &darr;'; // Down arrow
            }
             th.appendChild(indicator);
        }
    });
}


// --- PO Table Action Handling (Existing Function - Kept as is) ---
async function handlePOTableActions(event) {
    const actionElement = event.target.closest('button[data-id], a.edit-button');
    const targetCell = event.target.closest('td');

    if (targetCell && targetCell.classList.contains('po-number-link')) {
        const row = targetCell.closest('tr');
        const poId = row?.dataset.id;
        if (poId) { openPoShareModal(poId); } return;
    }
    if (!actionElement) return;
    const poId = actionElement.dataset.id;
    const poNumber = actionElement.dataset.number;
    if (!poId) { console.error("PO ID missing"); return; }

    if (actionElement.classList.contains('edit-button') && actionElement.tagName === 'A') {
        console.log(`Navigating to edit PO: ${poId}`);
    } else if (actionElement.classList.contains('status-button')) {
        const currentStatus = actionElement.dataset.status;
        openStatusModal(poId, currentStatus, poNumber);
    } else if (actionElement.classList.contains('share-button')) {
        openPoShareModal(poId);
    } else if (actionElement.classList.contains('pdf-button')) {
        actionElement.disabled = true; actionElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        try { /* Existing PDF logic... ensure generatePoPdf is available */ } catch (error) { /* Error handling */ } finally { /* Restore button */ }
    } else if (actionElement.classList.contains('delete-button')) {
        handleDeletePO(poId, poNumber);
    } else if (actionElement.classList.contains('mark-received-btn')) {
        markPOAsReceived(poId); // Call the function (logic is placeholder for now)
    }
}

// --- PO Receiving Logic Placeholder ---
async function markPOAsReceived(poId) { /* ... (same as previous version - Step 5) ... */ if (!poId || !db || !doc || !updateDoc || !serverTimestamp) { alert("Error: Cannot mark PO as received."); return; } if (confirm(`Mark PO #${poId.substring(0, 6)}... as 'Product Received'?`)) { try { await updateDoc(doc(db, "purchaseOrders", poId), { status: "Product Received", receivedDate: serverTimestamp(), updatedAt: serverTimestamp() }); alert("PO status updated to 'Product Received'."); displayPoList(); } catch (error) { console.error(`Error marking PO ${poId} as received:`, error); alert("Error: " + error.message); } } }

// --- Status Update Modal Functions (openStatusModal, closeStatusModal, handleStatusUpdate) ---
// ... (Keep these functions exactly as they were) ...
function openStatusModal(poId, currentStatus, poNumber) { if (!statusUpdateModal || !statusUpdateForm || !statusModalTitle || !statusUpdatePOId || !statusSelect || !currentPOStatusSpan) { console.error("Status modal elements missing!"); return; } statusUpdateForm.reset(); showStatusError(''); statusModalTitle.textContent = `Update Status for PO #${escapeHtml(poNumber || poId.substring(0, 6))}`; statusUpdatePOId.value = poId; currentPOStatusSpan.textContent = escapeHtml(currentStatus || 'N/A'); statusSelect.value = ""; statusUpdateModal.classList.add('active'); }
function closeStatusModal() { if (statusUpdateModal) { statusUpdateModal.classList.remove('active'); } }
async function handleStatusUpdate(event) { event.preventDefault(); if (!statusUpdatePOId || !statusSelect || !saveStatusBtn || !db || !doc || !updateDoc || !serverTimestamp) { alert("Error: Required elements or DB missing."); return; } const poId = statusUpdatePOId.value; const newStatus = statusSelect.value; if (!poId || !newStatus) { showStatusError("Invalid PO ID or Status."); return; } saveStatusBtn.disabled = true; saveStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; showStatusError(''); try { const poRef = doc(db, "purchaseOrders", poId); await updateDoc(poRef, { status: newStatus, updatedAt: serverTimestamp() }); console.log(`PO ${poId} status updated to ${newStatus}`); alert(`PO status updated to '${newStatus}'.`); closeStatusModal(); await displayPoList(); } catch (error) { console.error("Error updating PO status:", error); showStatusError("Error: " + error.message); } finally { if(saveStatusBtn) { saveStatusBtn.disabled = false; saveStatusBtn.innerHTML = 'Update Status'; } } }

// --- Delete PO Function (handleDeletePO) ---
// ... (Keep this function exactly as it was) ...
async function handleDeletePO(poId, poNumber) { if (!db || !doc || !deleteDoc) { alert("Error: Delete functions missing."); return; } if (confirm(`Delete PO "${escapeHtml(poNumber || poId)}"?`)) { try { await deleteDoc(doc(db, "purchaseOrders", poId)); alert(`PO ${escapeHtml(poNumber || poId)} deleted.`); await displayPoList(); } catch (error) { console.error("Error deleting PO:", error); alert("Error: " + error.message); } } }

// --- PO Details & Share Modal Functions ---
// ... (Keep existing placeholders or actual functions) ...
async function openPoDetailsModal(poId) { console.log("openPoDetailsModal called for", poId); alert("PO Details Modal functionality needs implementation/verification."); }
function closePoDetailsModal() { if (poDetailsModal) { poDetailsModal.classList.remove('active'); } }
async function openPoShareModal(poId) { console.log("openPoShareModal called for", poId); alert("PO Share Modal functionality needs implementation/verification."); }
function closePoShareModalFunction() { if (poShareModal) { poShareModal.classList.remove('active'); } }
// async function handleCopyPoShareContent(event) { /* ... */ } // Removed Copy button listener
function handleEmailPoShare(event) { /* ... */ console.log("Email PO called"); alert("Email PO functionality needs implementation."); }

// --- Batch Action Bar Update (Placeholder - Step 5) ---
function updateBatchActionBar() {
    // TODO: Implement logic to show/hide bar and update count based on selectedPoIds.size
    if (poBatchActionsBar && poSelectedCount) {
        const count = selectedPoIds.size;
        if (count > 0) {
            poSelectedCount.textContent = `${count} PO${count > 1 ? 's' : ''} selected`;
            poBatchActionsBar.style.display = 'flex'; // Or your desired display style
        } else {
            poBatchActionsBar.style.display = 'none';
        }
        // Enable/disable batch buttons based on count (optional)
        if (batchApplyStatusBtn) batchApplyStatusBtn.disabled = (count === 0);
        if (batchMarkReceivedBtn) batchMarkReceivedBtn.disabled = (count === 0);
        if (batchDeletePoBtn) batchDeletePoBtn.disabled = (count === 0);
    }
}


// --- Page Initialization & Event Listeners Setup ---
async function initializeSupplierManagementPage(user) { /* ... (same as previous version) ... */ console.log("Initializing Supplier Management Page v22..."); setupEventListeners(); try { await displaySupplierTable(); await displayPoList(); } catch (error) { console.error("Error during initial data load:", error); } console.log("Supplier Management Page Initialized v22."); }
function setupEventListeners() {
    console.log("Setting up event listeners v22...");

    // Supplier List Actions
    if (supplierTableBody) supplierTableBody.addEventListener('click', handleSupplierTableActions);

    // Supplier Modal
    if (addNewSupplierBtn) addNewSupplierBtn.addEventListener('click', () => openSupplierModal('add'));
    if (closeSupplierModalBtn) closeSupplierModalBtn.addEventListener('click', closeSupplierModal);
    if (cancelSupplierBtn) cancelSupplierBtn.addEventListener('click', closeSupplierModal);
    if (supplierForm) supplierForm.addEventListener('submit', saveSupplier);
    if (supplierModal) supplierModal.addEventListener('click', (event) => { if (event.target === supplierModal) closeSupplierModal(); });

    // PO Filters - *** Apply button now triggers displayPoList ***
    if (poFilterBtn) poFilterBtn.addEventListener('click', () => {
        poPagination.currentPage = 1; // Reset to page 1 when applying filters
        poPagination.lastVisibleDoc = null;
        displayPoList();
    });
    if (poClearFilterBtn) {
        poClearFilterBtn.addEventListener('click', () => {
            // Reset all filters
            if(poSearchInput) poSearchInput.value = '';
            if(poSupplierFilter) poSupplierFilter.value = '';
            if(poStatusFilter) poStatusFilter.value = '';
            if(poStartDateFilter) poStartDateFilter.value = '';
            if(poEndDateFilter) poEndDateFilter.value = '';
            // Reset sorting state
            currentPoSortField = 'createdAt';
            currentPoSortDirection = 'desc';
            updateSortIndicators(); // Clear visual indicators
            // Reset pagination
            poPagination.currentPage = 1;
            poPagination.lastVisibleDoc = null;
            // Reload list
            displayPoList();
        });
    }
    // No need for separate listener on poSupplierFilter if Apply button is used

    // *** NEW: PO Table Sorting Listener ***
    if (poTableHeader) {
        poTableHeader.addEventListener('click', handlePoSort);
    } else { console.error("PO table header not found for sort listener."); }

    // PO Table Actions (Delegated)
    if (poTableBody) poTableBody.addEventListener('click', handlePOTableActions);

    // PO Batch Actions (Placeholder - Step 5)
    // TODO: Add listeners for selectAllPoCheckbox, po-select-checkbox, batch action buttons

    // Status Update Modal
    if (closeStatusModalBtn) closeStatusModalBtn.addEventListener('click', closeStatusModal);
    if (cancelStatusBtn) cancelStatusBtn.addEventListener('click', closeStatusModal);
    if (statusUpdateForm) statusUpdateForm.addEventListener('submit', handleStatusUpdate);
    if (statusUpdateModal) statusUpdateModal.addEventListener('click', (event) => { if (event.target === statusUpdateModal) closeStatusModal(); });

    // PO Details Modal
    if (closePoDetailsModalBtn) closePoDetailsModalBtn.addEventListener('click', closePoDetailsModal);
    if (closePoDetailsBtn) closePoDetailsBtn.addEventListener('click', closePoDetailsModal);
    if (poDetailsModal) poDetailsModal.addEventListener('click', (event) => { if (event.target === poDetailsModal) closePoDetailsModal(); });
    if (printPoDetailsBtn) printPoDetailsBtn.addEventListener('click', () => { /* Print logic */ });

    // PO Share Modal
    if (closePoShareModal) closePoShareModal.addEventListener('click', closePoShareModalFunction);
    if (closePoShareModalBtn) closePoShareModalBtn.addEventListener('click', closePoShareModalFunction);
    if (poShareModal) poShareModal.addEventListener('click', (event) => { if (event.target === poShareModal) closePoShareModalFunction(); });
    if (printPoShareModalBtn) printPoShareModalBtn.addEventListener('click', () => { /* Print logic */ });
    if (emailPoShareModalBtn) emailPoShareModalBtn.addEventListener('click', handleEmailPoShare); // Listener for new button

    // CSV Export Button (Placeholder - Step 5)
    if (exportPoCsvBtn) exportPoCsvBtn.addEventListener('click', () => { alert("CSV Export needs implementation."); });

    // Pagination Listeners (Placeholder - Step 2/5)
    // TODO: Add listeners for prevPageBtn, nextPageBtn, itemsPerPageSelect

    console.log("Event listeners setup complete v22.");
}

// Make initialization function global
window.initializeSupplierManagementPage = initializeSupplierManagementPage;

console.log("supplier_management.js v22 (Step 2: PO Filter & Sort) loaded.");