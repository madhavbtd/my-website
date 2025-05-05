// js/supplier_management.js - v24 (User Requests Implemented + Debug Logs Refined)

// --- Imports ---
// import { generatePoPdf } from './utils.js'; // PDF हटाया गया
import { db, auth } from './firebase-init.js';
import {
    collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc, writeBatch,
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
const batchMarkReceivedBtn = document.getElementById('batchMarkReceivedBtn'); // Keep if needed or remove if combined with status update
const batchDeletePoBtn = document.getElementById('batchDeletePoBtn');
const deselectAllPoBtn = document.getElementById('deselectAllPoBtn');
const poTableHeader = document.querySelector('#poTable thead');

// Supplier Section
const suppliersListSection = document.getElementById('suppliersListSection'); // Assume exists for suppliers table
const supplierTableBody = document.getElementById('supplierTableBody'); // Assume exists for suppliers table
const supplierLoadingMessage = document.getElementById('supplierLoadingMessage'); // Assume exists for suppliers table
const supplierListError = document.getElementById('supplierListError'); // Assume exists for suppliers table
const addNewSupplierBtn = document.getElementById('addNewSupplierBtn'); // Keep this button

// Supplier Modal
const supplierModal = document.getElementById('supplierModal');
const supplierModalTitle = document.getElementById('supplierModalTitle');
const closeSupplierModalBtn = document.getElementById('closeSupplierModal');
const cancelSupplierBtn = document.getElementById('cancelSupplierBtn');
const saveSupplierBtn = document.getElementById('saveSupplierBtn');
const supplierForm = document.getElementById('supplierForm');
const editSupplierIdInput = document.getElementById('editSupplierId'); // Changed from 'supplierIdInput'
const supplierNameInput = document.getElementById('supplierNameInput');
const supplierCompanyInput = document.getElementById('supplierCompanyInput');
const supplierWhatsappInput = document.getElementById('supplierWhatsappInput');
const supplierEmailInput = document.getElementById('supplierEmailInput');
const supplierAddressInput = document.getElementById('supplierAddressInput');
const supplierGstInput = document.getElementById('supplierGstInput');
const supplierFormError = document.getElementById('supplierFormError'); // Changed from 'supplierErrorMsg'

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
const closePoDetailsBtn = document.getElementById('closePoDetailsBtn'); // Bottom button
const poDetailsContent = document.getElementById('poDetailsContent');
const printPoDetailsBtn = document.getElementById('printPoDetailsBtn');

// PO Items Modal (See More) - Get elements
const poItemsModal = document.getElementById('poItemsModal');
const poItemsModalTitle = document.getElementById('poItemsModalTitle');
const poItemsModalContent = document.getElementById('poItemsModalContent');
const closePoItemsModalBtn = document.getElementById('closePoItemsModalBtn'); // Top close button
const closePoItemsModalBottomBtn = document.getElementById('closePoItemsModalBottomBtn'); // Bottom close button

// Export Button
const exportPoCsvBtn = document.getElementById('exportPoCsvBtn');


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


// --- Utility Functions ---
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { try { unsafe = String(unsafe ?? ''); } catch (e) { unsafe = ''; } } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function formatCurrency(amount) { const num = Number(amount); if (isNaN(num)) return 'N/A'; return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatDate(timestamp) { if (!timestamp || typeof timestamp.toDate !== 'function') return '-'; try { return timestamp.toDate().toLocaleDateString('en-GB'); } catch (e) { console.error("Error formatting date:", e); return '-'; } }

// --- Error Display Functions ---
function displayError(message, elementId = 'poListError') {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = message ? 'block' : 'none';
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        console.error(`Error element with ID '${elementId}' not found. Message:`, message);
        alert(message); // Fallback alert
    }
}
function clearError(elementId = 'poListError') { const errorElement = document.getElementById(elementId); if (errorElement) { errorElement.textContent = ''; errorElement.style.display = 'none'; } }
function showSupplierFormError(message) { displayError(message, 'supplierFormError'); }
function showStatusError(message) { displayError(message, 'statusErrorMsg'); }
function showPoListError(message) { displayError(message, 'poListError'); if (poLoadingMessage) poLoadingMessage.style.display = 'none'; if (poTableBody) poTableBody.innerHTML = ''; }


// --- Supplier List Functions (If Supplier Table exists) ---
async function displaySupplierTable() {
    // Keep this function to load suppliers, used for PO filter and supplier links
    if (!db || !collection || !getDocs || !query || !orderBy) {
        console.error("Error: DB functions missing for supplier list."); return;
    }
    console.log("Loading suppliers for cache and filter...");
    suppliersDataCache = []; // Clear cache before reload
    try {
        const q = query(collection(db, "suppliers"), orderBy("name_lowercase"));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((docSnapshot) => {
            suppliersDataCache.push({ id: docSnapshot.id, ...docSnapshot.data() });
        });
        populateSupplierFilterDropdown(); // Populate filter dropdown
        console.log(`Loaded ${suppliersDataCache.length} suppliers into cache.`);

        // If there's a dedicated supplier table to display:
        if (supplierTableBody && supplierLoadingMessage) {
             supplierLoadingMessage.style.display = 'none';
             supplierTableBody.innerHTML = ''; // Clear loading/previous
            if (suppliersDataCache.length === 0) {
                 supplierTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 15px;">No suppliers found.</td></tr>';
            } else {
                 suppliersDataCache.forEach(supplier => {
                     // ... Code to render supplier row in supplierTableBody ...
                     // Example:
                     const tr = document.createElement('tr');
                     tr.setAttribute('data-id', supplier.id);
                     tr.innerHTML = `
                         <td><a href="supplier_account_detail.html?id=${supplier.id}" class="supplier-link">${escapeHtml(supplier.name || 'N/A')}</a></td>
                         <td>${escapeHtml(supplier.whatsappNo || supplier.contactNo || '-')}</td>
                         <td>Calculating...</td>
                         <td class="action-buttons">
                             <a href="supplier_account_detail.html?id=${supplier.id}" class="button view-account-button small-button" title="View Account Details"><i class="fas fa-eye"></i></a>
                             <button class="button edit-supplier-btn small-button" data-id="${supplier.id}" title="Edit Supplier"><i class="fas fa-edit"></i></button>
                             <button class="button delete-supplier-btn small-button" data-id="${supplier.id}" data-name="${escapeHtml(supplier.name || '')}" title="Delete Supplier"><i class="fas fa-trash-alt"></i></button>
                         </td>`;
                      supplierTableBody.appendChild(tr);
                 });
            }
        }

    } catch (error) {
        console.error("Error fetching suppliers for cache: ", error);
        showPoListError(`Error loading suppliers: ${error.message}`); // Show error in PO section as it affects filter
        populateSupplierFilterDropdown(); // Populate even on error (with empty list)
    }
}
function populateSupplierFilterDropdown() {
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
    // Restore previous selection if possible
    if (poSupplierFilter.querySelector(`option[value="${selectedVal}"]`)) { poSupplierFilter.value = selectedVal; }
    else { poSupplierFilter.value = ""; }
    console.log("Supplier filter dropdown populated.");
}
// Handler for supplier table actions (Edit/Delete supplier buttons)
function handleSupplierTableActions(event) {
    const targetButton = event.target.closest('button[data-id]');
    if (!targetButton) return;

    const supplierId = targetButton.dataset.id;
    if (!supplierId) return;

    if (targetButton.classList.contains('edit-supplier-btn')) {
        console.log(`Opening edit modal for supplier: ${supplierId}`);
        const supplierData = suppliersDataCache.find(s => s.id === supplierId);
        if (supplierData) { openSupplierModal('edit', supplierData, supplierId); }
        else { console.warn(`Supplier ${supplierId} not found in cache`); /* Fetch fallback? */ }
    } else if (targetButton.classList.contains('delete-supplier-btn')) {
        console.log(`Initiating delete for supplier: ${supplierId}`);
        const supplierName = targetButton.dataset.name || supplierId;
        deleteSupplier(supplierId, supplierName);
    }
}


// --- Supplier Modal/CRUD Functions ---
function openSupplierModal(mode = 'add', supplierData = null, supplierId = null) {
     if (!supplierModal || !supplierForm || !supplierModalTitle || !supplierFormError || !editSupplierIdInput || !supplierNameInput /*... etc */) {
        console.error("Supplier modal elements missing!"); alert("Cannot open supplier form."); return;
     }
     supplierForm.reset();
     showSupplierFormError(''); // Clear previous errors
     currentEditingSupplierId = null;

     if (mode === 'edit' && supplierData && supplierId) {
         supplierModalTitle.textContent = 'Edit Supplier';
         editSupplierIdInput.value = supplierId; // Use the hidden input
         currentEditingSupplierId = supplierId;
         supplierNameInput.value = supplierData.name || '';
         supplierCompanyInput.value = supplierData.companyName || ''; // Match HTML ID if different
         supplierWhatsappInput.value = supplierData.whatsappNo || ''; // Match HTML ID
         supplierEmailInput.value = supplierData.email || ''; // Match HTML ID
         supplierAddressInput.value = supplierData.address || ''; // Match HTML ID
         supplierGstInput.value = supplierData.gstNo || ''; // Match HTML ID
     } else {
         supplierModalTitle.textContent = 'Add New Supplier';
         editSupplierIdInput.value = ''; // Clear hidden input for add mode
     }
     supplierModal.style.display = 'block'; // Show the modal
}
function closeSupplierModal() { if (supplierModal) { supplierModal.style.display = 'none'; } }
async function handleAddSupplierSubmit(event) {
    event.preventDefault();
    if (!db || !collection || !addDoc || !doc || !updateDoc || !serverTimestamp || !Timestamp) { // Added Timestamp
        showSupplierFormError("Error: Database functions missing."); return;
    }
    if (!saveSupplierBtn || !supplierNameInput || !supplierFormError /* Add other inputs */) {
        alert("Error: Cannot save supplier due to missing form elements."); return;
    }

    const supplierName = supplierNameInput.value.trim();
    if (!supplierName) {
        showSupplierFormError("Supplier Name is required."); supplierNameInput.focus(); return;
    }

    const supplierData = {
        name: supplierName,
        name_lowercase: supplierName.toLowerCase(), // For case-insensitive sorting/searching
        companyName: supplierCompanyInput.value.trim(),
        whatsappNo: supplierWhatsappInput.value.trim(),
        email: supplierEmailInput.value.trim(),
        address: supplierAddressInput.value.trim(),
        gstNo: supplierGstInput.value.trim(),
        updatedAt: serverTimestamp() // Update timestamp on save
    };

    saveSupplierBtn.disabled = true; saveSupplierBtn.textContent = 'Saving...';
    showSupplierFormError('');

    try {
        const supplierIdToUse = editSupplierIdInput.value; // Get ID from hidden input

        if (supplierIdToUse) { // Editing existing supplier
            const supplierRef = doc(db, "suppliers", supplierIdToUse);
            await updateDoc(supplierRef, supplierData);
            console.log("Supplier updated with ID: ", supplierIdToUse);
            // Update cache if needed
            const index = suppliersDataCache.findIndex(s => s.id === supplierIdToUse);
            if (index > -1) suppliersDataCache[index] = { ...suppliersDataCache[index], ...supplierData };

        } else { // Adding new supplier
            supplierData.createdAt = serverTimestamp(); // Add created timestamp only for new
            const docRef = await addDoc(collection(db, "suppliers"), supplierData);
            console.log("Supplier added with ID: ", docRef.id);
            // Add to cache
             suppliersDataCache.push({ id: docRef.id, ...supplierData, createdAt: Timestamp.now() }); // Approximate createdAt
        }

        closeSupplierModal();
        await displaySupplierTable(); // Refresh supplier list table if it exists
        populateSupplierFilterDropdown(); // Refresh filter dropdown

    } catch (error) {
        console.error("Error saving supplier: ", error);
        showSupplierFormError("Error saving supplier: " + error.message);
    } finally {
        if(saveSupplierBtn) { saveSupplierBtn.disabled = false; saveSupplierBtn.textContent = 'Save Supplier'; }
    }
}
async function deleteSupplier(supplierId, supplierName) {
     if (!db || !doc || !deleteDoc) { alert("Error: Functions missing for deleting supplier."); return; }
     if (confirm(`Are you sure you want to delete supplier "${escapeHtml(supplierName || supplierId)}"? This cannot be undone.`)) {
         console.log(`Attempting to delete supplier: ${supplierId}`);
         try {
             await deleteDoc(doc(db, "suppliers", supplierId));
             console.log("Supplier deleted: ", supplierId);
             alert(`Supplier "${escapeHtml(supplierName || supplierId)}" deleted successfully.`);
             // Remove from cache and refresh UI
             suppliersDataCache = suppliersDataCache.filter(s => s.id !== supplierId);
             await displaySupplierTable(); // Refresh supplier table if exists
             populateSupplierFilterDropdown(); // Refresh filter dropdown
             await displayPoList(); // Refresh PO list as supplier names might change to 'Unknown'

         } catch (error) {
             console.error("Error deleting supplier: ", error);
             alert("Error deleting supplier: " + error.message);
         }
     } else { console.log("Supplier delete cancelled."); }
}


// --- PO List Functions ---
async function displayPoList() {
    if (!poTableBody || !poLoadingMessage) return;
    if (!db || !collection || !getDocs || !query || !orderBy || !where || !doc || !getDoc || !Timestamp || !limit) { showPoListError("Error: DB functions missing."); return; }
    showPoListError(''); // Clear previous errors
    poLoadingMessage.style.display = 'table-row';
    poTableBody.innerHTML = '';
    if (poTotalsDisplay) poTotalsDisplay.textContent = 'Loading totals...';
    if (poPaginationControls) poPaginationControls.style.display = 'none'; // Hide pagination initially
    selectedPoIds.clear();
    updateBatchActionBar();
    if (selectAllPoCheckbox) selectAllPoCheckbox.checked = false;

    try {
        // Build Firestore query (conditions, sorting)
        let conditions = [];
        let baseQuery = collection(db, "purchaseOrders");
        const searchTerm = poSearchInput.value.trim().toLowerCase();
        const supplierFilterId = poSupplierFilter.value;
        const statusFilter = poStatusFilter.value;
        const startDateVal = poStartDateFilter.value;
        const endDateVal = poEndDateFilter.value;

        if (supplierFilterId) { conditions.push(where("supplierId", "==", supplierFilterId)); }
        if (statusFilter) { conditions.push(where("status", "==", statusFilter)); }
        if (startDateVal) { try { conditions.push(where("orderDate", ">=", Timestamp.fromDate(new Date(startDateVal + 'T00:00:00')))); } catch (e) { console.warn("Invalid start date"); } }
        if (endDateVal) { try { conditions.push(where("orderDate", "<=", Timestamp.fromDate(new Date(endDateVal + 'T23:59:59')))); } catch (e) { console.warn("Invalid end date"); } }

        const sortFieldMapping = { poNumber: 'poNumber', orderDate: 'orderDate', supplierName: 'supplierName', totalAmount: 'totalAmount', status: 'status', paymentStatus: 'paymentStatus' };
        const firestoreSortField = sortFieldMapping[currentPoSortField] || 'createdAt';
        const firestoreSortDirection = currentPoSortDirection || 'desc';
        let sortClauses = [orderBy(firestoreSortField, firestoreSortDirection)];
        if (firestoreSortField !== 'createdAt') { sortClauses.push(orderBy('createdAt', 'desc')); } // Secondary sort

        // --- Query Building ---
        // For now, load all matching documents. Pagination can be added later.
        currentPoQuery = query(baseQuery, ...conditions, ...sortClauses); // Removed limit for now

        const querySnapshot = await getDocs(currentPoQuery);
        poLoadingMessage.style.display = 'none';
        let filteredDocs = querySnapshot.docs;
        let grandTotalAmount = 0;
        cachedPOs = {}; // Clear cache

        // Apply client-side search (basic example)
        if (searchTerm) {
            filteredDocs = filteredDocs.filter(docRef_po => {
                const po = docRef_po.data();
                const supplierName = suppliersDataCache.find(s => s.id === po.supplierId)?.name?.toLowerCase() || '';
                const itemNames = (po.items || []).map(item => item.productName?.toLowerCase() || '').join(' ');
                return (
                    po.poNumber?.toString().toLowerCase().includes(searchTerm) ||
                    supplierName.includes(searchTerm) ||
                    itemNames.includes(searchTerm)
                );
            });
        }

        if (filteredDocs.length === 0) {
            // Adjusted colspan based on new HTML structure (9 columns including checkbox and new Products)
            poTableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 15px;">No POs found matching your criteria.</td></tr>`;
            if (poTotalsDisplay) poTotalsDisplay.textContent = 'Total PO Value: ₹ 0.00';
            return;
        }

        // Render rows
        filteredDocs.forEach(docRef_po => {
            const po = docRef_po.data();
            const poId = docRef_po.id;
            cachedPOs[poId] = po; // Update cache

            let supplierName = suppliersDataCache.find(s => s.id === po.supplierId)?.name || po.supplierName || 'Unknown';
            let orderDateStr = formatDate(po.orderDate || po.createdAt);
            let statusText = po.status || 'Unknown';
            let statusClass = statusText.toLowerCase().replace(/\s+/g, '-');
            let paymentStatusText = po.paymentStatus || 'Pending';
            let paymentStatusClass = paymentStatusText.toLowerCase().replace(/\s+/g, '-');
            let amount = po.totalAmount || 0;
            let amountStr = formatCurrency(amount);
            grandTotalAmount += amount;

            // Supplier Link (Request #7)
            let supplierLink = po.supplierId ?
               `<a href="supplier_account_detail.html?id=${po.supplierId}" class="supplier-link" title="View Supplier: ${escapeHtml(supplierName)}">${escapeHtml(supplierName)}</a>` :
               escapeHtml(supplierName);

            // Products Column Logic (Request #4)
            let itemsHtml = 'N/A';
            if (po.items && po.items.length > 0) {
                const firstItemName = escapeHtml(po.items[0].productName || 'Item'); // Use productName
                if (po.items.length === 1) {
                    itemsHtml = firstItemName;
                } else {
                    itemsHtml = `${firstItemName} <button class="button see-more-items-btn small-button text-button" data-action="see-more-items" data-id="${poId}">See More (${po.items.length})</button>`;
                }
            }

            const tr = document.createElement('tr');
            tr.setAttribute('data-id', poId);
             // Row HTML including new 'Products' column, removed Share/PDF, added supplier link
             tr.innerHTML = `
                <td style="text-align: center;"><input type="checkbox" class="po-select-checkbox" value="${poId}"></td>
                <td class="po-number-link" title="View PO Details">${escapeHtml(po.poNumber || 'N/A')}</td>
                <td>${orderDateStr}</td>
                <td>${supplierLink}</td> {/* <<< Supplier Link */}
                <td style="text-align: right;">${amountStr}</td>
                <td>${itemsHtml}</td> {/* <<< Products Column */}
                <td><span class="status-badge status-${statusClass}">${escapeHtml(statusText)}</span></td>
                <td><span class="payment-badge payment-${paymentStatusClass}">${escapeHtml(paymentStatusText)}</span></td>
                <td class="action-buttons">
                     ${statusText === 'Sent' || statusText === 'Printing' ? `<button class="button mark-received-btn small-button success-button" data-action="mark-received" data-id="${poId}" title="Mark as Received"><i class="fas fa-check"></i></button>` : ''}
                    <button class="button edit-button small-button" data-action="edit-po" data-id="${poId}" title="Edit PO"><i class="fas fa-edit"></i></button>
                    <button class="button status-button small-button" data-action="change-status-modal" data-id="${poId}" data-number="${escapeHtml(po.poNumber)}" data-status="${escapeHtml(statusText)}" title="Update Status"><i class="fas fa-sync-alt"></i></button>
                    {/* Share/PDF Buttons Removed */}
                    <button class="button delete-button small-button" data-action="delete-po" data-id="${poId}" data-number="${escapeHtml(po.poNumber)}" title="Delete PO"><i class="fas fa-trash-alt"></i></button>
                </td>`;
             poTableBody.appendChild(tr);
        });

        if (poTotalsDisplay) poTotalsDisplay.textContent = `Total PO Value (Displayed): ${formatCurrency(grandTotalAmount)}`;
        console.log(`Displayed ${filteredDocs.length} POs.`);

    } catch (error) {
        console.error("Error fetching/displaying POs: ", error);
        if (error.code === 'failed-precondition') { showPoListError(`Error: Firestore index missing. Check console. Details: ${error.message}`); }
        else { showPoListError(`Error loading POs: ${error.message}`); }
        if (poTotalsDisplay) poTotalsDisplay.textContent = 'Error loading totals';
    }
}


// --- PO Table Sorting Logic ---
function handlePoSort(event) {
    const header = event.target.closest('th[data-sortable="true"]');
    if (!header) return;
    const sortKey = header.dataset.sortKey;
    if (!sortKey) return;
    let newDirection;
    if (currentPoSortField === sortKey) { newDirection = currentPoSortDirection === 'asc' ? 'desc' : 'asc'; }
    else { newDirection = 'asc'; } // Default to ascending for new column
    currentPoSortField = sortKey;
    currentPoSortDirection = newDirection;
    console.log(`Sorting POs by: ${currentPoSortField}, Dir: ${currentPoSortDirection}`);
    updateSortIndicators();
    displayPoList(); // Re-fetch and display sorted list
}
function updateSortIndicators() {
    if (!poTableHeader) return;
    poTableHeader.querySelectorAll('th[data-sortable="true"]').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        th.querySelector('.sort-indicator')?.remove(); // Remove existing indicator
        if (th.dataset.sortKey === currentPoSortField) {
            const indicator = document.createElement('span');
            indicator.classList.add('sort-indicator');
            if (currentPoSortDirection === 'asc') { th.classList.add('sort-asc'); indicator.innerHTML = ' &uarr;'; }
            else { th.classList.add('sort-desc'); indicator.innerHTML = ' &darr;'; }
            th.appendChild(indicator);
        }
    });
}


// --- PO Table Action Handling ---
async function handlePOTableActions(event) {
    const actionElement = event.target.closest('button[data-action]'); // Target buttons with data-action
    const targetCell = event.target.closest('td');

    // Handle click on PO Number for details (using existing details modal)
    if (targetCell && targetCell.classList.contains('po-number-link')) {
        const row = targetCell.closest('tr');
        const poId = row?.dataset.id;
        if (poId) {
            console.log(`PO Number clicked, opening details for PO: ${poId}`);
            openPoDetailsModal(poId); // Open the existing details modal
        }
        return;
    }

    if (!actionElement) return; // Exit if not an action button

    const action = actionElement.dataset.action;
    const poId = actionElement.dataset.id;
    const poNumber = actionElement.dataset.number; // Used for confirmation messages

    if (!action || !poId) { console.error("Action button missing action or PO ID.", { action, poId }); return; }

    console.log(`Action detected: '${action}', PO ID: ${poId}`);

    // Handle different actions based on 'data-action'
    switch (action) {
        case 'mark-received':
            console.log(`Initiating 'Mark Received' for PO: ${poId}`);
            markPOAsReceived(poId); // Function defined below
            break;

        case 'edit-po':
            console.log(`Initiating 'Edit PO' for PO: ${poId}`);
            // Open the "New PO" page in edit mode
            window.location.href = `new_po.html?editPOId=${poId}`;
            break;

        case 'change-status-modal':
            console.log(`Opening status update modal for PO: ${poId}`);
            const currentStatus = actionElement.dataset.status;
            openStatusModal(poId, currentStatus, poNumber); // Function defined below
            break;

        case 'see-more-items': // Action for the new "See More" button
            console.log(`Opening 'See More Items' modal for PO: ${poId}`);
            openSeeMoreItemsModal(poId); // Function defined below
            break;

        case 'delete-po':
            console.log(`Initiating delete for PO: ${poId}`);
            console.log("About to show confirmation dialog...");
            const confirmMessage = `क्या आप वाकई PO (${poNumber || poId.substring(0,6)}) को डिलीट करना चाहते हैं?`;
            if (confirm(confirmMessage)) {
                console.log("Confirmation received. Attempting deletion...");
                try {
                    console.log(`Creating reference to delete PO: ${poId}`);
                    const poRef = doc(db, "purchaseOrders", poId);
                    console.log(`Calling deleteDoc for PO: ${poId}`);
                    await deleteDoc(poRef);
                    console.log(`PO ${poId} deleted successfully from Firestore.`);
                    // Remove row visually or reload list
                    const rowToRemove = poTableBody.querySelector(`tr[data-id="${poId}"]`);
                    if (rowToRemove) { rowToRemove.remove(); }
                    else { await displayPoList(); } // Fallback to reload if row not found
                    // Update cache and totals if necessary (optional)
                    delete cachedPOs[poId];
                    // Recalculate totals or just show a message
                    alert(`PO (${poNumber || poId.substring(0,6)}) सफलतापूर्वक डिलीट हो गया है।`);
                    // Optionally re-calculate totals here if needed

                } catch (error) {
                    console.error(`Error deleting PO ${poId}:`, error);
                    displayError(`PO डिलीट करने में विफल: ${error.message}`);
                }
            } else {
                console.log("Delete cancelled by user.");
            }
            break;

        default:
            console.warn(`Unknown action encountered: '${action}' for PO ID: ${poId}`);
    }
}


// --- PO Receiving Logic ---
async function markPOAsReceived(poId) {
    if (!poId || !db || !doc || !updateDoc || !serverTimestamp) {
        alert("Error: Cannot mark PO as received."); return;
    }
    if (confirm(`Mark PO #${poId.substring(0, 6)}... as 'Product Received'?`)) {
        console.log(`Attempting to update status for PO ${poId}...`);
        try {
            await updateDoc(doc(db, "purchaseOrders", poId), {
                status: "Product Received",
                receivedDate: serverTimestamp(), // Add received date
                updatedAt: serverTimestamp()
            });
            console.log(`Status updated successfully for PO ${poId}. Reloading list...`);
            alert("PO status updated to 'Product Received'.");
            // Update visually or reload
            const row = poTableBody.querySelector(`tr[data-id="${poId}"]`);
            if(row) {
                const statusBadge = row.querySelector('.status-badge');
                if(statusBadge) {
                    statusBadge.textContent = 'Product Received';
                    statusBadge.className = 'status-badge status-product-received'; // Update class
                }
                // Remove the mark received button if it exists
                const markBtn = row.querySelector('.mark-received-btn');
                if(markBtn) markBtn.remove();
            } else {
                 await displayPoList(); // Fallback reload
            }
        } catch (error) {
            console.error(`Error marking PO ${poId} received:`, error);
            alert("Error updating PO status: " + error.message);
        }
    } else {
       console.log(`Mark as received cancelled by user for PO ${poId}.`);
    }
}


// --- Status Update Modal Functions ---
function openStatusModal(poId, currentStatus, poNumber) {
    console.log(`Opening status modal for PO ${poId} (Current: ${currentStatus})`);
    if (!statusUpdateModal || !statusUpdatePOId || !currentPOStatusSpan || !statusSelect || !statusModalTitle) {
        console.error("Status update modal elements missing!"); return;
    }
    statusUpdatePOId.value = poId;
    currentPOStatusSpan.textContent = currentStatus || 'N/A';
    statusModalTitle.textContent = `Update Status for PO #${poNumber || poId.substring(0,6)}`;
    statusSelect.value = currentStatus || ''; // Set dropdown to current status
    showStatusError('');
    statusUpdateModal.style.display = 'block'; // Use block or flex based on CSS
}
function closeStatusModal() { if (statusUpdateModal) { statusUpdateModal.style.display = 'none'; } }
async function handleStatusUpdate(event) {
    event.preventDefault();
    if (!statusUpdatePOId || !statusSelect || !db || !doc || !updateDoc || !serverTimestamp) {
        showStatusError("Internal error occurred."); return;
    }
    const poId = statusUpdatePOId.value;
    const newStatus = statusSelect.value;
    if (!poId || !newStatus) { showStatusError("Please select a new status."); return; }

    console.log(`Attempting status update to '${newStatus}' for PO: ${poId}`);
    showStatusError('');
    saveStatusBtn.disabled = true; saveStatusBtn.textContent = 'Saving...';

    try {
        await updateDoc(doc(db, "purchaseOrders", poId), {
            status: newStatus,
            updatedAt: serverTimestamp()
        });
        console.log(`Status updated successfully for PO ${poId}. Closing modal and updating row.`);
        closeStatusModal();

        // Update the row visually instead of full reload
        const row = poTableBody.querySelector(`tr[data-id="${poId}"]`);
        if (row) {
            const statusBadge = row.querySelector('.status-badge');
            const statusBtn = row.querySelector('.status-button');
             const markReceivedBtn = row.querySelector('.mark-received-btn');
            if (statusBadge) {
                statusBadge.textContent = newStatus;
                statusBadge.className = `status-badge status-${newStatus.toLowerCase().replace(/\s+/g, '-')}`;
            }
             if (statusBtn) { statusBtn.dataset.status = newStatus; } // Update button data
             // Show/hide Mark Received button based on new status
             if (newStatus === 'Sent' || newStatus === 'Printing') {
                 if (!markReceivedBtn && row.querySelector('.action-buttons')) {
                     // Add the button if it doesn't exist
                     const button = document.createElement('button');
                     button.className = 'button mark-received-btn small-button success-button';
                     button.dataset.action = 'mark-received';
                     button.dataset.id = poId;
                     button.title = 'Mark as Received';
                     button.innerHTML = '<i class="fas fa-check"></i>';
                     row.querySelector('.action-buttons').prepend(button); // Add at the beginning
                 }
             } else {
                 if (markReceivedBtn) markReceivedBtn.remove(); // Remove if status no longer applicable
             }
        } else {
            await displayPoList(); // Fallback reload if row not found
        }

        alert("PO Status updated successfully.");
    } catch (error) {
        console.error(`Error updating status for PO ${poId}:`, error);
        showStatusError(`Failed to update status: ${error.message}`);
    } finally {
        saveStatusBtn.disabled = false; saveStatusBtn.textContent = 'Update Status';
    }
}


// --- PO Details Modal Functions ---
async function openPoDetailsModal(poId) {
    // Uses existing modal from HTML
    if (!poDetailsModal || !poDetailsContent || !poDetailsModalTitle) {
        console.error("PO Details modal elements missing."); return;
    }
    poDetailsModalTitle.textContent = `Details for PO #${poId.substring(0, 6)}...`;
    poDetailsContent.innerHTML = '<p>Loading details...</p>';
    poDetailsModal.style.display = 'block'; // Use block or flex

    try {
        let poData = cachedPOs[poId];
        if (!poData) { // Fetch if not in cache
            const poSnap = await getDoc(doc(db, "purchaseOrders", poId));
            if (poSnap.exists()) poData = poSnap.data();
        }
        if (!poData) throw new Error("PO data not found.");

        let supplierName = suppliersDataCache.find(s => s.id === poData.supplierId)?.name || poData.supplierName || 'Unknown';

        let detailsHtml = `
             <p><strong>PO Number:</strong> ${escapeHtml(poData.poNumber || 'N/A')}</p>
             <p><strong>Order Date:</strong> ${formatDate(poData.orderDate || poData.createdAt)}</p>
             <p><strong>Supplier:</strong> ${escapeHtml(supplierName)}</p>
             <p><strong>Total Amount:</strong> ${formatCurrency(poData.totalAmount)}</p>
             <p><strong>Status:</strong> ${escapeHtml(poData.status)}</p>
             <p><strong>Payment Status:</strong> ${escapeHtml(poData.paymentStatus || 'Pending')}</p>
             <h4>Items:</h4>`;

        if (poData.items && poData.items.length > 0) {
             detailsHtml += `<table class="details-table">
                               <thead>
                                   <tr>
                                       <th>#</th><th>Product Name</th><th>Qty</th><th>Rate</th><th>Amount</th>
                                   </tr>
                               </thead>
                               <tbody>`;
            poData.items.forEach((item, index) => {
                 const itemTotal = (item.quantity || 0) * (item.rate || 0);
                 detailsHtml += `<tr>
                                   <td>${index + 1}</td>
                                   <td>${escapeHtml(item.productName || 'N/A')}</td>
                                   <td style="text-align: right;">${escapeHtml(item.quantity || 0)}</td>
                                   <td style="text-align: right;">${formatCurrency(item.rate || 0)}</td>
                                   <td style="text-align: right;">${formatCurrency(itemTotal)}</td>
                               </tr>`;
             });
            detailsHtml += `</tbody></table>`;
        } else { detailsHtml += '<p>No items listed.</p>'; }
        detailsHtml += `<div class="po-notes-details"><strong>Notes:</strong><p>${escapeHtml(poData.notes || '-')}</p></div>`;
        poDetailsContent.innerHTML = detailsHtml;
        console.log(`PO Details displayed for ${poId}.`);

    } catch (error) {
        console.error(`Error loading PO details for ${poId}:`, error);
        poDetailsContent.innerHTML = `<p style="color: red;">Error loading details: ${error.message}</p>`;
    }
}
function closePoDetailsModal() { if (poDetailsModal) { poDetailsModal.style.display = 'none'; } }
function handlePrintPoDetails() { // Placeholder - needs implementation if print button is kept
    alert("Print PO Details function needs implementation.");
    // Use window.print() or a library like jsPDF based on `#poDetailsContent`
}


// --- See More Items Modal Functions (Request #4) ---
async function openSeeMoreItemsModal(poId) {
    if (!poItemsModal || !poItemsModalContent || !poItemsModalTitle) {
        console.error("PO Items Modal elements missing!"); alert("Could not display items."); return;
    }

    poItemsModalTitle.textContent = `Items for PO #${poId.substring(0, 6)}...`;
    poItemsModalContent.innerHTML = '<p>Loading items...</p>';
    poItemsModal.style.display = 'block'; // or 'flex'

    try {
        let poData = cachedPOs[poId];
        if (!poData) {
            const poSnap = await getDoc(doc(db, "purchaseOrders", poId));
            if (poSnap.exists()) poData = poSnap.data();
        }
        if (!poData || !poData.items || poData.items.length === 0) {
             throw new Error("No items found for this PO.");
        }

        // Using a more detailed table like in the details modal
        let itemsTableHtml = `<table class="details-table">
                               <thead>
                                   <tr><th>#</th><th>Item Name</th><th>Quantity</th><th>Rate</th><th>Amount</th></tr>
                               </thead>
                               <tbody>`;
        poData.items.forEach((item, index) => {
            const itemTotal = (item.quantity || 0) * (item.rate || 0);
            itemsTableHtml += `<tr>
                                 <td>${index + 1}</td>
                                 <td>${escapeHtml(item.productName || 'N/A')}</td>
                                 <td style="text-align: right;">${escapeHtml(item.quantity || 0)}</td>
                                 <td style="text-align: right;">${formatCurrency(item.rate || 0)}</td>
                                 <td style="text-align: right;">${formatCurrency(itemTotal)}</td>
                             </tr>`;
        });
        itemsTableHtml += `</tbody></table>`;
        poItemsModalContent.innerHTML = itemsTableHtml;

    } catch (error) {
        console.error(`Error loading items for PO ${poId}:`, error);
        poItemsModalContent.innerHTML = `<p style="color: red;">Error loading items: ${error.message}</p>`;
    }
}
function closePoItemsModal() { if (poItemsModal) { poItemsModal.style.display = 'none'; } }


// --- Batch Action Bar Update (Request #5 - Limits & Button State) ---
function updateBatchActionBar() {
    if (!poBatchActionsBar || !poSelectedCount || !selectAllPoCheckbox || !batchApplyStatusBtn || !batchDeletePoBtn || !batchUpdateStatusSelect) return;

    const count = selectedPoIds.size;
    const MAX_STATUS_UPDATE = 10;
    const MAX_DELETE = 5;

    if (count > 0) {
        poSelectedCount.textContent = `${count} PO${count > 1 ? 's' : ''} selected`;
        poBatchActionsBar.style.display = 'flex';

        // Enable/Disable Apply Status button
        const statusSelected = batchUpdateStatusSelect.value !== "";
        batchApplyStatusBtn.disabled = !(statusSelected && count > 0 && count <= MAX_STATUS_UPDATE);
        if (count > MAX_STATUS_UPDATE) {
            batchApplyStatusBtn.title = `Select up to ${MAX_STATUS_UPDATE} POs to update status.`;
        } else if (!statusSelected) {
            batchApplyStatusBtn.title = `Select a status to apply.`;
        } else {
            batchApplyStatusBtn.title = `Apply status to ${count} PO(s).`;
        }

        // Enable/Disable Delete button
        batchDeletePoBtn.disabled = !(count > 0 && count <= MAX_DELETE);
         if (count > MAX_DELETE) {
            batchDeletePoBtn.title = `Select up to ${MAX_DELETE} POs to delete.`;
        } else {
            batchDeletePoBtn.title = `Delete ${count} selected PO(s).`;
        }

        // Mark Received button (if kept) - enable if selection > 0
        if(batchMarkReceivedBtn) batchMarkReceivedBtn.disabled = (count === 0);

        // Check if all currently displayed POs are selected
        const displayedCheckboxes = poTableBody.querySelectorAll('.po-select-checkbox');
        selectAllPoCheckbox.checked = displayedCheckboxes.length > 0 && count === displayedCheckboxes.length;

    } else {
        poBatchActionsBar.style.display = 'none';
        selectAllPoCheckbox.checked = false;
        batchUpdateStatusSelect.value = ""; // Reset status dropdown
        batchApplyStatusBtn.disabled = true;
        batchDeletePoBtn.disabled = true;
         if(batchMarkReceivedBtn) batchMarkReceivedBtn.disabled = true;
    }
}

// --- Event Listener: Select All Checkbox ---
if (selectAllPoCheckbox && poTableBody) {
    selectAllPoCheckbox.addEventListener('change', (event) => {
        const isChecked = event.target.checked;
        console.log(`Select All checkbox changed: ${isChecked}`);
        poTableBody.querySelectorAll('.po-select-checkbox').forEach(checkbox => {
            checkbox.checked = isChecked;
            const poId = checkbox.value;
            const row = checkbox.closest('tr');
            if (isChecked) {
                selectedPoIds.add(poId);
                if(row) row.classList.add('selected-row');
            } else {
                selectedPoIds.delete(poId);
                 if(row) row.classList.remove('selected-row');
            }
        });
        updateBatchActionBar();
    });
}

// --- Event Listener: Individual PO Checkbox (Delegated) ---
if (poTableBody) {
    poTableBody.addEventListener('change', (event) => {
        if (event.target.classList.contains('po-select-checkbox')) {
            const checkbox = event.target;
            const poId = checkbox.value;
            const row = checkbox.closest('tr');
            if (checkbox.checked) {
                selectedPoIds.add(poId);
                if(row) row.classList.add('selected-row');
                console.log(`PO ${poId} selected.`);
            } else {
                selectedPoIds.delete(poId);
                 if(row) row.classList.remove('selected-row');
                console.log(`PO ${poId} deselected.`);
            }
            updateBatchActionBar();
        }
    });
}

// --- Event Listener: Deselect All Button ---
if (deselectAllPoBtn) {
    deselectAllPoBtn.addEventListener('click', () => {
        console.log("Deselect All clicked.");
        selectedPoIds.clear();
        poTableBody.querySelectorAll('.po-select-checkbox').forEach(checkbox => checkbox.checked = false);
         poTableBody.querySelectorAll('tr.selected-row').forEach(row => row.classList.remove('selected-row'));
        if (selectAllPoCheckbox) selectAllPoCheckbox.checked = false;
        updateBatchActionBar();
    });
}

// --- Batch Action Button Listeners (With Limits - Request #5) ---
if(batchApplyStatusBtn && batchUpdateStatusSelect) {
    batchApplyStatusBtn.addEventListener('click', async () => {
        const newStatus = batchUpdateStatusSelect.value;
        const idsToUpdate = Array.from(selectedPoIds);
        const MAX_LIMIT = 10;

        if (!newStatus) { alert("Please select a status to apply."); return; }
        if (idsToUpdate.length === 0) { alert("Please select at least one PO."); return; }
        if (idsToUpdate.length > MAX_LIMIT) { alert(`You can update status for a maximum of ${MAX_LIMIT} POs at a time.`); return; }

        console.log(`Applying batch status '${newStatus}' to ${idsToUpdate.length} POs.`);
        if (confirm(`Apply status '${newStatus}' to ${idsToUpdate.length} selected PO(s)?`)) {
             batchApplyStatusBtn.disabled = true; batchApplyStatusBtn.textContent = 'Applying...';
             let successCount = 0; let errorCount = 0;
             const batch = writeBatch(db);
             idsToUpdate.forEach(poId => {
                 const poRef = doc(db, "purchaseOrders", poId);
                 batch.update(poRef, { status: newStatus, updatedAt: serverTimestamp() });
             });

            try {
                await batch.commit();
                successCount = idsToUpdate.length; // Assume all succeeded if commit doesn't throw
                 console.log(`Batch status update committed successfully for ${successCount} POs.`);
            } catch (error) {
                 console.error(`Error committing batch status update:`, error);
                 // Hard to know which ones failed without individual checks
                 errorCount = idsToUpdate.length; // Assume all failed on commit error
                 successCount = 0;
                 alert(`Error applying batch status update: ${error.message}`);
             }

             batchApplyStatusBtn.disabled = false; batchApplyStatusBtn.textContent = 'Apply Status';
             if(successCount > 0) alert(`Batch update complete. Status updated for ${successCount} PO(s).`);
             selectedPoIds.clear(); // Clear selection after attempt
              poTableBody.querySelectorAll('.po-select-checkbox').forEach(cb => cb.checked = false);
              poTableBody.querySelectorAll('tr.selected-row').forEach(row => row.classList.remove('selected-row'));
             updateBatchActionBar();
             displayPoList(); // Refresh list to show changes
         }
    });
}

// Batch Mark Received (Keep or remove based on user need)
if(batchMarkReceivedBtn) {
     batchMarkReceivedBtn.addEventListener('click', async () => {
         // Add limits if needed, similar to status update
         const idsToUpdate = Array.from(selectedPoIds);
         if (idsToUpdate.length === 0) { alert("Please select at least one PO."); return; }
         console.log(`Applying batch 'Mark Received' to ${idsToUpdate.length} POs.`);
         if (confirm(`Mark ${idsToUpdate.length} selected PO(s) as 'Product Received'?`)) {
             batchMarkReceivedBtn.disabled = true; batchMarkReceivedBtn.textContent = 'Marking...';
             let successCount = 0; let errorCount = 0;
             const batch = writeBatch(db);
             idsToUpdate.forEach(poId => {
                 const poRef = doc(db, "purchaseOrders", poId);
                 batch.update(poRef, { status: 'Product Received', receivedDate: serverTimestamp(), updatedAt: serverTimestamp() });
             });
             try { await batch.commit(); successCount = idsToUpdate.length; }
             catch (error) { console.error("Error batch marking received:", error); errorCount = idsToUpdate.length; alert(`Error: ${error.message}`); }
             batchMarkReceivedBtn.disabled = false; batchMarkReceivedBtn.textContent = 'Mark as Received';
             if(successCount > 0) alert(`Mark Received complete. Updated ${successCount} PO(s).`);
             selectedPoIds.clear(); updateBatchActionBar(); displayPoList();
         }
     });
}

 // Batch Delete PO (With Limit - Request #5)
 if(batchDeletePoBtn) {
     batchDeletePoBtn.addEventListener('click', async () => {
         const idsToDelete = Array.from(selectedPoIds);
         const MAX_LIMIT = 5;

         if (idsToDelete.length === 0) { alert("Please select at least one PO to delete."); return; }
         if (idsToDelete.length > MAX_LIMIT) { alert(`You can delete a maximum of ${MAX_LIMIT} POs at a time.`); return; }

         console.log(`Applying batch delete to ${idsToDelete.length} POs.`);
         if (confirm(`Permanently delete ${idsToDelete.length} selected PO(s)? This cannot be undone.`)) {
             batchDeletePoBtn.disabled = true; batchDeletePoBtn.textContent = 'Deleting...';
             let successCount = 0; let errorCount = 0;
             const batch = writeBatch(db);
             idsToDelete.forEach(poId => {
                 batch.delete(doc(db, "purchaseOrders", poId));
             });

             try { await batch.commit(); successCount = idsToDelete.length; }
             catch (error) { console.error(`Error committing batch delete:`, error); errorCount = idsToDelete.length; alert(`Error deleting POs: ${error.message}`); }

             batchDeletePoBtn.disabled = false; batchDeletePoBtn.textContent = 'Delete Selected';
              if(successCount > 0) alert(`Batch delete complete. Deleted ${successCount} PO(s).`);
              selectedPoIds.clear();
              poTableBody.querySelectorAll('.po-select-checkbox').forEach(cb => cb.checked = false);
              poTableBody.querySelectorAll('tr.selected-row').forEach(row => row.classList.remove('selected-row'));
             updateBatchActionBar();
             displayPoList(); // Refresh the list
         }
     });
 }


// --- Page Initialization & Event Listeners Setup ---
async function initializeSupplierManagementPage(user) {
    console.log("Initializing Supplier Management Page v24...");
    setupEventListeners(); // Setup all event listeners
    try {
        await displaySupplierTable(); // Load suppliers FIRST (populates filter and cache)
        await displayPoList();      // Then load initial POs
    } catch (error) {
        console.error("Error during initial data load:", error);
        // Errors should be shown by individual display functions
    }
     console.log("Supplier Management Page Initialized v24.");
}

function setupEventListeners() {
    console.log("Setting up event listeners v24...");

    // --- Supplier List Actions ---
    if (supplierTableBody) {
        supplierTableBody.addEventListener('click', handleSupplierTableActions);
    } // else { console.warn("Supplier table body not found for event listener."); } // Optional warning

    // --- Supplier Modal ---
    if (addNewSupplierBtn) addNewSupplierBtn.addEventListener('click', () => openSupplierModal('add'));
    if (closeSupplierModalBtn) closeSupplierModalBtn.addEventListener('click', closeSupplierModal);
    if (cancelSupplierBtn) cancelSupplierBtn.addEventListener('click', closeSupplierModal);
    if (supplierForm) supplierForm.addEventListener('submit', handleAddSupplierSubmit); // Use specific handler
    if (supplierModal) supplierModal.addEventListener('click', (event) => { if (event.target === supplierModal) closeSupplierModal(); });

    // --- PO Filters ---
    if (poFilterBtn) {
        poFilterBtn.addEventListener('click', () => {
            poPagination.currentPage = 1; // Reset pagination on filter
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
            currentPoSortField = 'createdAt'; currentPoSortDirection = 'desc'; // Reset sort
            updateSortIndicators(); // Update visual indicator
            poPagination.currentPage = 1; poPagination.lastVisibleDoc = null; // Reset pagination
            displayPoList();
        });
    }
    // Search on Enter Key (Request #6)
    if (poSearchInput) {
         poSearchInput.addEventListener('keypress', (event) => {
             if (event.key === 'Enter') {
                 event.preventDefault(); // Prevent default if inside a form
                 console.log("Enter key pressed in search input, triggering filter.");
                 if (poFilterBtn) {
                    poFilterBtn.click(); // Trigger filter button click
                 } else { // Fallback if button not found
                    poPagination.currentPage = 1; poPagination.lastVisibleDoc = null;
                    displayPoList();
                 }
             }
         });
     }

    // --- PO Table Sorting ---
    if (poTableHeader) {
        poTableHeader.addEventListener('click', handlePoSort);
    } else { console.error("PO table header not found for sort listener."); }

    // --- PO Table Actions (Delegated) ---
    if (poTableBody) {
        poTableBody.addEventListener('click', handlePOTableActions); // Single listener handles all actions
    } else { console.error("PO table body not found for PO actions listener."); }

    // --- Batch Action Bar ---
    // Event listeners for buttons are added above
    if(batchUpdateStatusSelect) { // Add listener for status dropdown change to enable/disable Apply button
        batchUpdateStatusSelect.addEventListener('change', updateBatchActionBar);
    }

    // --- Modals (Status, Details, See More Items) ---
    if (closeStatusModalBtn) closeStatusModalBtn.addEventListener('click', closeStatusModal);
    if (cancelStatusBtn) cancelStatusBtn.addEventListener('click', closeStatusModal);
    if (statusUpdateForm) statusUpdateForm.addEventListener('submit', handleStatusUpdate);
    if (statusUpdateModal) statusUpdateModal.addEventListener('click', (event) => { if (event.target === statusUpdateModal) closeStatusModal(); });

    if (closePoDetailsModalBtn) closePoDetailsModalBtn.addEventListener('click', closePoDetailsModal);
    if (closePoDetailsBtn) closePoDetailsBtn.addEventListener('click', closePoDetailsModal);
    if (poDetailsModal) poDetailsModal.addEventListener('click', (event) => { if (event.target === poDetailsModal) closePoDetailsModal(); });
    if (printPoDetailsBtn) printPoDetailsBtn.addEventListener('click', handlePrintPoDetails); // Add handler if keeping print

    // Close listeners for the new PO Items modal
    if (closePoItemsModalBtn) closePoItemsModalBtn.addEventListener('click', closePoItemsModal);
    if (closePoItemsModalBottomBtn) closePoItemsModalBottomBtn.addEventListener('click', closePoItemsModal);
    if (poItemsModal) poItemsModal.addEventListener('click', (event) => { if (event.target === poItemsModal) closePoItemsModal(); });


    // --- CSV Export ---
    if (exportPoCsvBtn) exportPoCsvBtn.addEventListener('click', () => { alert("CSV Export needs implementation."); }); // Needs implementation

    // --- Pagination ---
    // TODO: Add listeners for prevPageBtn, nextPageBtn, itemsPerPageSelect

    console.log("Event listeners setup complete v24.");
}


// Make initialization function global if called from HTML
window.initializeSupplierManagementPage = initializeSupplierManagementPage;

console.log("supplier_management.js v24 (User Requests) loaded.");