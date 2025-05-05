// js/supplier_management.js - v29.1 (Auth Check Moved Inside)

import { db, auth } from './firebase-init.js';
import {
    collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc, writeBatch,
    query, orderBy, where, Timestamp, serverTimestamp, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// Import onAuthStateChanged here
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- DOM Elements ---
// (Keep all your existing const declarations for DOM elements)
const poTableBody = document.getElementById('poTableBody');
const poSearchInput = document.getElementById('poSearchInput');
const poSupplierFilter = document.getElementById('poSupplierFilter');
// ... (and all other DOM element constants) ...
const exportPoCsvBtn = document.getElementById('exportPoCsvBtn');


// --- Global State ---
// (Keep all your existing global state variables)
let currentEditingSupplierId = null;
let suppliersDataCache = [];
let cachedPOs = {};
// ... (and all other state variables) ...
let pageInitialized = false; // Flag to prevent multiple initializations

// --- Utility Functions ---
// (Keep all your existing utility functions: escapeHtml, formatCurrency, formatDate)
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { try { unsafe = String(unsafe ?? ''); } catch (e) { unsafe = ''; } } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function formatCurrency(amount) { const num = Number(amount); if (isNaN(num)) return 'N/A'; return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatDate(timestamp) { if (!timestamp || typeof timestamp.toDate !== 'function') return '-'; try { return timestamp.toDate().toLocaleDateString('en-GB'); } catch (e) { console.error("Error formatting date:", e); return '-'; } }


// --- Error Display Functions ---
// (Keep all your existing error display functions: displayError, clearError, show...)
function displayError(message, elementId = 'poListError') {
    const errorElement = document.getElementById(elementId);
    if (errorElement) { errorElement.textContent = message; errorElement.style.display = message ? 'block' : 'none'; errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    else { console.error(`Error element ID '${elementId}' not found. Msg:`, message); alert(message); }
}
function clearError(elementId = 'poListError') { const errorElement = document.getElementById(elementId); if (errorElement) { errorElement.textContent = ''; errorElement.style.display = 'none'; } }
function showSupplierFormError(message) { displayError(message, 'supplierFormError'); }
function showStatusError(message) { displayError(message, 'statusErrorMsg'); }
function showPoListError(message) { displayError(message, 'poListError'); if (poLoadingMessage) poLoadingMessage.style.display = 'none'; if (poTableBody) poTableBody.innerHTML = ''; }
function showSupplierListError(message) { displayError(message, 'supplierListError'); if (supplierLoadingMessage) supplierLoadingMessage.style.display = 'none'; if (supplierTableBody) supplierTableBody.innerHTML = ''; }


// --- Supplier List Functions ---
// (Keep existing: displaySupplierTable, calculateAndDisplaySupplierBalance, populateSupplierFilterDropdown, handleSupplierTableActions, handleSupplierRowClick)
async function displaySupplierTable() {
    if (!supplierTableBody || !supplierLoadingMessage) { console.warn("Supplier table elements missing"); return; }
    if (!db || !collection || !getDocs || !query || !orderBy) { showSupplierListError("Error: DB functions missing."); return; }
    showSupplierListError(''); supplierLoadingMessage.style.display = 'table-row'; supplierTableBody.innerHTML = ''; suppliersDataCache = [];
    try {
        const q = query(collection(db, "suppliers"), orderBy("name_lowercase")); const querySnapshot = await getDocs(q);
        supplierLoadingMessage.style.display = 'none';
        if (querySnapshot.empty) { supplierTableBody.innerHTML = '<tr><td colspan="4" class="no-results">No suppliers found.</td></tr>'; }
        else {
            querySnapshot.forEach((docSnapshot) => {
                const supplier = docSnapshot.data(); const supplierId = docSnapshot.id; suppliersDataCache.push({ id: supplierId, ...supplier });
                const tr = document.createElement('tr'); tr.setAttribute('data-id', supplierId); tr.setAttribute('title', 'Click to view account details'); tr.classList.add('clickable-row');
                const name = escapeHtml(supplier.name || 'N/A'); const contact = escapeHtml(supplier.whatsappNo || supplier.contactNo || '-');
                // Added view account button
                tr.innerHTML = `
                    <td>${name}</td>
                    <td>${contact}</td>
                    <td class="supplier-balance">Loading...</td>
                    <td class="action-buttons">
                        <button class="button edit-supplier-btn small-button" data-id="${supplierId}" title="Edit Supplier"><i class="fas fa-edit"></i></button>
                        <a href="supplier_account_detail.html?id=${supplierId}" class="button view-account-button small-button" title="View Account Details"><i class="fas fa-eye"></i></a>
                    </td>`;
                supplierTableBody.appendChild(tr);
                calculateAndDisplaySupplierBalance(supplierId, tr.querySelector('.supplier-balance'));
            });
            populateSupplierFilterDropdown();
        }
    } catch (error) { console.error("Error fetching suppliers: ", error); showSupplierListError(`Error loading suppliers: ${error.message}`); populateSupplierFilterDropdown(); }
}
async function calculateAndDisplaySupplierBalance(supplierId, balanceCellElement) { if (!balanceCellElement) return; balanceCellElement.textContent = '₹ --.--'; balanceCellElement.style.textAlign = 'right'; /* Placeholder: Add actual calc later */ }
function populateSupplierFilterDropdown() {
    if (!poSupplierFilter) return; const selectedVal = poSupplierFilter.value;
    poSupplierFilter.innerHTML = '<option value="">All Suppliers</option>';
    const sortedSuppliers = [...suppliersDataCache].sort((a, b) => (a.name_lowercase || '').localeCompare(b.name_lowercase || ''));
    sortedSuppliers.forEach(supplier => { const option = document.createElement('option'); option.value = supplier.id; option.textContent = escapeHtml(supplier.name || supplier.id); poSupplierFilter.appendChild(option); });
    if (poSupplierFilter.querySelector(`option[value="${selectedVal}"]`)) { poSupplierFilter.value = selectedVal; } else { poSupplierFilter.value = ""; }
}
function handleSupplierTableActions(event) {
    const targetButton = event.target.closest('button.edit-supplier-btn'); if (!targetButton) return;
    event.stopPropagation(); const supplierId = targetButton.dataset.id; if (!supplierId) return;
    const supplierData = suppliersDataCache.find(s => s.id === supplierId);
    if (supplierData) { openSupplierModal('edit', supplierData, supplierId); } else { console.warn(`Supplier ${supplierId} not found in cache for edit.`); }
}
function handleSupplierRowClick(event) {
    const row = event.target.closest('tr');
    // Prevent navigation if a button inside the row was clicked
    if (event.target.closest('button') || event.target.closest('a.button')) {
        return;
    }
    const supplierId = row?.dataset.id;
    if (supplierId) {
        console.log("Navigating to detail for supplier:", supplierId);
        window.location.href = `supplier_account_detail.html?id=${supplierId}`;
    }
}


// --- Supplier Modal/CRUD Functions ---
// (Keep existing: openSupplierModal, closeSupplierModal, handleAddSupplierSubmit, deleteSupplier, handleDeleteSupplierFromModal)
function openSupplierModal(mode = 'add', supplierData = null, supplierId = null) {
     if (!supplierModal || !supplierForm || !supplierModalTitle || !supplierFormError || !editSupplierIdInput || !supplierNameInput || !deleteSupplierFromModalBtn) { console.error("Supplier modal elements missing!"); alert("Cannot open supplier form."); return; }
     supplierForm.reset(); showSupplierFormError(''); currentEditingSupplierId = null; deleteSupplierFromModalBtn.style.display = 'none';
     if (mode === 'edit' && supplierData && supplierId) {
         supplierModalTitle.textContent = 'Edit Supplier'; editSupplierIdInput.value = supplierId; currentEditingSupplierId = supplierId;
         supplierNameInput.value = supplierData.name || ''; supplierCompanyInput.value = supplierData.companyName || ''; supplierWhatsappInput.value = supplierData.whatsappNo || ''; supplierEmailInput.value = supplierData.email || ''; supplierAddressInput.value = supplierData.address || ''; supplierGstInput.value = supplierData.gstNo || '';
         deleteSupplierFromModalBtn.style.display = 'inline-flex'; deleteSupplierFromModalBtn.dataset.name = supplierData.name || supplierId;
     } else { supplierModalTitle.textContent = 'Add New Supplier'; editSupplierIdInput.value = ''; }
     supplierModal.classList.add('active'); // Use class to show modal
}
function closeSupplierModal() { if (supplierModal) { supplierModal.classList.remove('active'); } } // Use class to hide
async function handleAddSupplierSubmit(event) {
    event.preventDefault();
    if (!db || !collection || !addDoc || !doc || !updateDoc || !serverTimestamp || !Timestamp) { showSupplierFormError("Error: Database functions missing."); return; }
    if (!saveSupplierBtn || !supplierNameInput || !supplierFormError) { alert("Error: Cannot save supplier due to missing form elements."); return; }
    const supplierName = supplierNameInput.value.trim(); if (!supplierName) { showSupplierFormError("Supplier Name is required."); supplierNameInput.focus(); return; }
    const supplierData = { name: supplierName, name_lowercase: supplierName.toLowerCase(), companyName: supplierCompanyInput.value.trim(), whatsappNo: supplierWhatsappInput.value.trim(), email: supplierEmailInput.value.trim(), address: supplierAddressInput.value.trim(), gstNo: supplierGstInput.value.trim(), updatedAt: serverTimestamp() };
    saveSupplierBtn.disabled = true; saveSupplierBtn.textContent = 'Saving...'; showSupplierFormError('');
    try {
        const supplierIdToUse = editSupplierIdInput.value;
        if (supplierIdToUse) {
            const supplierRef = doc(db, "suppliers", supplierIdToUse); await updateDoc(supplierRef, supplierData);
            const index = suppliersDataCache.findIndex(s => s.id === supplierIdToUse); if (index > -1) suppliersDataCache[index] = { ...suppliersDataCache[index], ...supplierData };
        } else {
            supplierData.createdAt = serverTimestamp(); const docRef = await addDoc(collection(db, "suppliers"), supplierData);
            suppliersDataCache.push({ id: docRef.id, ...supplierData, createdAt: Timestamp.now() });
        }
        closeSupplierModal(); await displaySupplierTable(); populateSupplierFilterDropdown();
    } catch (error) { console.error("Error saving supplier: ", error); showSupplierFormError("Error saving supplier: " + error.message); }
    finally { if(saveSupplierBtn) { saveSupplierBtn.disabled = false; saveSupplierBtn.textContent = 'Save Supplier'; } }
}
async function deleteSupplier(supplierId, supplierName) {
     if (!db || !doc || !deleteDoc) { alert("Error: Functions missing for deleting supplier."); return; }
     try {
         console.log(`Attempting to delete ONLY supplier document: ${supplierId}`);
         await deleteDoc(doc(db, "suppliers", supplierId));
         alert(`Supplier "${escapeHtml(supplierName || supplierId)}" deleted successfully. Associated POs and Payments are NOT deleted.`);
         suppliersDataCache = suppliersDataCache.filter(s => s.id !== supplierId);
         await displaySupplierTable(); populateSupplierFilterDropdown(); await displayPoList();
     } catch (error) { console.error("Error deleting supplier: ", error); alert("Error deleting supplier: " + error.message); }
}
function handleDeleteSupplierFromModal() {
     const supplierId = editSupplierIdInput.value; const supplierName = deleteSupplierFromModalBtn.dataset.name || supplierId;
     if (!supplierId) { alert("Cannot delete: Supplier ID not found."); return; }
     if (confirm(`WARNING!\nAre you absolutely sure you want to delete supplier "${escapeHtml(supplierName)}"?\n\nAssociated Purchase Orders and Payments WILL NOT be deleted.\nThis action cannot be undone.`)) {
         closeSupplierModal(); deleteSupplier(supplierId, supplierName);
     }
}


// --- PO List Functions ---
// (Keep existing: displayPoList, handlePoSort, updateSortIndicators, handlePOTableActions, markPOAsReceived)
async function displayPoList() {
    if (!poTableBody || !poLoadingMessage) { console.warn("PO table body elements missing"); return; }
    if (!db || !collection || !getDocs || !query || !orderBy || !where || !doc || !getDoc || !Timestamp || !limit) { showPoListError("Error: DB functions missing."); return; }
    showPoListError(''); poLoadingMessage.style.display = 'table-row'; poTableBody.innerHTML = '';
    if (poTotalsDisplay) poTotalsDisplay.textContent = 'Loading totals...'; if (poPaginationControls) poPaginationControls.style.display = 'none';
    selectedPoIds.clear(); updateBatchActionBar(); if (selectAllPoCheckbox) selectAllPoCheckbox.checked = false;
    try {
        let conditions = []; let baseQuery = collection(db, "purchaseOrders");
        const searchTerm = poSearchInput.value.trim().toLowerCase(); const supplierFilterId = poSupplierFilter.value; const statusFilter = poStatusFilter.value; const startDateVal = poStartDateFilter.value; const endDateVal = poEndDateFilter.value;
        if (supplierFilterId) { conditions.push(where("supplierId", "==", supplierFilterId)); } if (statusFilter) { conditions.push(where("status", "==", statusFilter)); }
        if (startDateVal) { try { conditions.push(where("orderDate", ">=", Timestamp.fromDate(new Date(startDateVal + 'T00:00:00')))); } catch (e) {console.warn("Invalid start date")} }
        if (endDateVal) { try { conditions.push(where("orderDate", "<=", Timestamp.fromDate(new Date(endDateVal + 'T23:59:59')))); } catch (e) {console.warn("Invalid end date")} }
        const sortFieldMapping = { poNumber: 'poNumber', orderDate: 'orderDate', supplierName: 'supplierName_lowercase', totalAmount: 'totalAmount', status: 'status', paymentStatus: 'paymentStatus' }; // Sort by lowercase name
        const firestoreSortField = sortFieldMapping[currentPoSortField] || 'createdAt'; const firestoreSortDirection = currentPoSortDirection || 'desc';
        let sortClauses = [orderBy(firestoreSortField, firestoreSortDirection)]; if (firestoreSortField !== 'createdAt') { sortClauses.push(orderBy('createdAt', 'desc')); } // Add secondary sort
        currentPoQuery = query(baseQuery, ...conditions, ...sortClauses);
        const querySnapshot = await getDocs(currentPoQuery);
        poLoadingMessage.style.display = 'none'; let filteredDocs = querySnapshot.docs; let grandTotalAmount = 0; cachedPOs = {};
        // Apply client-side search if needed (Firestore doesn't support complex text search easily)
        if (searchTerm) {
            filteredDocs = filteredDocs.filter(docRef_po => {
                const po = docRef_po.data();
                const supplierName = suppliersDataCache.find(s => s.id === po.supplierId)?.name?.toLowerCase() || po.supplierName?.toLowerCase() || '';
                const itemNames = (po.items || []).map(item => item.productName?.toLowerCase() || '').join(' ');
                const poNumString = po.poNumber ? String(po.poNumber).toLowerCase() : '';
                return (poNumString.includes(searchTerm) || supplierName.includes(searchTerm) || itemNames.includes(searchTerm));
            });
        }
        if (filteredDocs.length === 0) { poTableBody.innerHTML = `<tr><td colspan="9" class="no-results">No POs found matching your criteria.</td></tr>`; if (poTotalsDisplay) poTotalsDisplay.textContent = 'Total PO Value: ₹ 0.00'; return; }
        filteredDocs.forEach(docRef_po => {
            const po = docRef_po.data(); const poId = docRef_po.id; cachedPOs[poId] = po;
            let supplierName = suppliersDataCache.find(s => s.id === po.supplierId)?.name || po.supplierName || 'Unknown';
            let orderDateStr = formatDate(po.orderDate || po.createdAt);
            let statusText = po.status || 'Unknown'; let statusClass = statusText.toLowerCase().replace(/\s+/g, '-');
            let paymentStatusText = po.paymentStatus || 'Pending'; let paymentStatusClass = paymentStatusText.toLowerCase().replace(/\s+/g, '-');
            let amount = po.totalAmount || 0; let amountStr = formatCurrency(amount); grandTotalAmount += amount;
            let supplierLink = po.supplierId ? `<a href="supplier_account_detail.html?id=${po.supplierId}" class="supplier-link" title="View Supplier: ${escapeHtml(supplierName)}">${escapeHtml(supplierName)}</a>` : escapeHtml(supplierName);
            let itemsHtml = 'N/A';
            if (po.items && po.items.length > 0) {
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
             poTableBody.appendChild(tr);
        });
        if (poTotalsDisplay) poTotalsDisplay.textContent = `Total PO Value (Displayed): ${formatCurrency(grandTotalAmount)}`;
    } catch (error) { console.error("Error fetching/displaying POs: ", error); if (error.code === 'failed-precondition') { showPoListError(`Error: Firestore index missing. Check console for details needed.`); } else { showPoListError(`Error loading POs: ${error.message}`); } if (poTotalsDisplay) poTotalsDisplay.textContent = 'Error loading totals'; }
}
function handlePoSort(event) {
    const header = event.target.closest('th[data-sortable="true"]'); if (!header) return;
    const sortKey = header.dataset.sortKey; if (!sortKey) return;
    let newDirection; if (currentPoSortField === sortKey) { newDirection = currentPoSortDirection === 'asc' ? 'desc' : 'asc'; } else { newDirection = 'asc'; } // Default to asc for new column
    currentPoSortField = sortKey; currentPoSortDirection = newDirection; updateSortIndicators(); displayPoList();
}
function updateSortIndicators() {
    if (!poTableHeader) return;
    poTableHeader.querySelectorAll('th[data-sortable="true"]').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc'); th.querySelector('.sort-indicator')?.remove();
        if (th.dataset.sortKey === currentPoSortField) {
            const indicator = document.createElement('span'); indicator.classList.add('sort-indicator');
            if (currentPoSortDirection === 'asc') { th.classList.add('sort-asc'); indicator.innerHTML = ' <i class="fas fa-arrow-up fa-xs"></i>'; } // Using FontAwesome icons
            else { th.classList.add('sort-desc'); indicator.innerHTML = ' <i class="fas fa-arrow-down fa-xs"></i>'; }
            th.appendChild(indicator);
        }
    });
}
async function handlePOTableActions(event) {
    const actionElement = event.target.closest('button[data-action]');
    const targetCell = event.target.closest('td');

    // Handle click on PO Number cell for sharing
    if (targetCell && targetCell.classList.contains('po-number-link')) {
        const row = targetCell.closest('tr');
        const poId = row?.dataset.id;
        if (poId) {
            openPoShareModal(poId);
        }
        return; // Prevent other actions if PO number link is clicked
    }

    // Handle action buttons
    if (!actionElement) return;
    event.stopPropagation(); // Prevent row click when button is clicked

    const action = actionElement.dataset.action;
    const poId = actionElement.dataset.id;
    const poNumber = actionElement.dataset.number;

    if (!action || !poId) { console.error("Action button missing action or PO ID.", { action, poId }); return; }

    switch (action) {
        case 'mark-received': markPOAsReceived(poId); break;
        case 'edit-po': window.location.href = `new_po.html?editPOId=${poId}`; break;
        case 'change-status-modal': const currentStatus = actionElement.dataset.status; openStatusModal(poId, currentStatus, poNumber); break;
        case 'see-more-items': openSeeMoreItemsModal(poId); break;
        case 'delete-po':
            const confirmMessage = `Are you sure you want to delete PO (${poNumber || poId.substring(0,6)})? This cannot be undone.`;
            if (confirm(confirmMessage)) {
                try {
                    const poRef = doc(db, "purchaseOrders", poId); await deleteDoc(poRef);
                    const rowToRemove = poTableBody.querySelector(`tr[data-id="${poId}"]`); if (rowToRemove) { rowToRemove.remove(); } else { await displayPoList(); }
                    delete cachedPOs[poId]; alert(`PO (${poNumber || poId.substring(0,6)}) deleted successfully.`);
                } catch (error) { console.error(`Error deleting PO ${poId}:`, error); displayError(`Failed to delete PO: ${error.message}`); }
            }
            break;
        default: console.warn(`Unknown action encountered: '${action}' for PO ID: ${poId}`);
    }
}
async function markPOAsReceived(poId) {
    if (!poId || !db || !doc || !updateDoc || !serverTimestamp) { alert("Error: Cannot mark PO as received."); return; }
    if (confirm(`Mark PO #${poId.substring(0, 6)}... as 'Product Received'?`)) {
        try {
            await updateDoc(doc(db, "purchaseOrders", poId), { status: "Product Received", receivedDate: serverTimestamp(), updatedAt: serverTimestamp() });
            alert("PO status updated to 'Product Received'.");
            const row = poTableBody.querySelector(`tr[data-id="${poId}"]`);
            if(row) {
                const statusBadge = row.querySelector('.status-badge'); if(statusBadge) { statusBadge.textContent = 'Product Received'; statusBadge.className = 'status-badge status-product-received'; }
                const statusBtn = row.querySelector('.status-button'); if(statusBtn) { statusBtn.dataset.status = 'Product Received'; }
                const markBtn = row.querySelector('.mark-received-btn'); if(markBtn) markBtn.remove(); // Remove the button after marking
            } else { await displayPoList(); } // Fallback refresh
        } catch (error) { console.error(`Error marking PO ${poId} received:`, error); alert("Error updating PO status: " + error.message); }
    }
}


// --- Status Update Modal Functions ---
// (Keep existing: openStatusModal, closeStatusModal, handleStatusUpdate)
function openStatusModal(poId, currentStatus, poNumber) {
    if (!statusUpdateModal || !statusUpdatePOId || !currentPOStatusSpan || !statusSelect || !statusModalTitle) { console.error("Status update modal elements missing!"); return; }
    statusUpdatePOId.value = poId; currentPOStatusSpan.textContent = currentStatus || 'N/A'; statusModalTitle.textContent = `Update Status for PO #${poNumber || poId.substring(0,6)}`;
    statusSelect.value = currentStatus || ''; showStatusError(''); statusUpdateModal.classList.add('active'); // Use class
}
function closeStatusModal() { if (statusUpdateModal) { statusUpdateModal.classList.remove('active'); } } // Use class
async function handleStatusUpdate(event) {
    event.preventDefault();
    if (!statusUpdatePOId || !statusSelect || !db || !doc || !updateDoc || !serverTimestamp) { showStatusError("Internal error occurred."); return; }
    const poId = statusUpdatePOId.value; const newStatus = statusSelect.value;
    if (!poId || !newStatus) { showStatusError("Please select a new status."); return; }
    showStatusError(''); saveStatusBtn.disabled = true; saveStatusBtn.textContent = 'Saving...';
    try {
        await updateDoc(doc(db, "purchaseOrders", poId), { status: newStatus, updatedAt: serverTimestamp() });
        closeStatusModal();
        const row = poTableBody.querySelector(`tr[data-id="${poId}"]`);
        if (row) {
            const statusBadge = row.querySelector('.status-badge'); const statusBtn = row.querySelector('.status-button'); const markReceivedBtn = row.querySelector('.mark-received-btn');
            if (statusBadge) { statusBadge.textContent = newStatus; statusBadge.className = `status-badge status-${newStatus.toLowerCase().replace(/\s+/g, '-')}`; }
            if (statusBtn) { statusBtn.dataset.status = newStatus; }
            // Add/remove mark received button based on new status
             if (newStatus === 'Sent' || newStatus === 'Printing') {
                 if (!markReceivedBtn && row.querySelector('.action-buttons')) { const button = document.createElement('button'); button.className = 'button mark-received-btn small-button success-button'; button.dataset.action = 'mark-received'; button.dataset.id = poId; button.title = 'Mark as Received'; button.innerHTML = '<i class="fas fa-check"></i>'; row.querySelector('.action-buttons').prepend(button); }
             } else { if (markReceivedBtn) markReceivedBtn.remove(); }
        } else { await displayPoList(); } // Fallback refresh
        alert("PO Status updated successfully.");
    } catch (error) { console.error(`Error updating status for PO ${poId}:`, error); showStatusError(`Failed to update status: ${error.message}`); }
    finally { saveStatusBtn.disabled = false; saveStatusBtn.textContent = 'Update Status'; }
}


// --- PO Share Modal Functions ---
// (Keep existing: openPoShareModal, closePoShareModalFunction, handleCopyPoShareContent, handlePrintPoShare)
async function openPoShareModal(poId) {
    if (!poShareModal || !poShareModalTitle || !poShareInfo || !poShareGreeting || !poShareItemsContainer || !poShareTermList || !copyPoShareModalBtn) { console.error("PO Share modal elements missing!"); alert("Error: Cannot open PO Share view."); return; }
    poShareModalTitle.textContent = "Purchase Order"; poShareInfo.innerHTML = 'Loading PO info...'; poShareGreeting.innerHTML = 'Loading greeting...';
    poShareItemsContainer.innerHTML = '<h3>Items</h3><p><i class="fas fa-spinner fa-spin"></i> Loading items...</p>'; poShareTermList.innerHTML = '<li>Loading T&C...</li>';
    copyPoShareModalBtn.dataset.poid = ''; copyPoShareModalBtn.disabled = true; copyPoShareModalBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Content'; copyPoShareModalBtn.classList.remove('copied', 'copying');
    poShareModal.classList.add('active');
    try {
        const poRef = doc(db, "purchaseOrders", poId); const poDocSnap = await getDoc(poRef);
        if (!poDocSnap.exists()) { throw new Error(`Could not find Purchase Order with ID: ${escapeHtml(poId)}`); }
        const poData = poDocSnap.data(); cachedPOs[poId] = poData;
        let supplierName = "Supplier"; if (poData.supplierId) { try { const supplierRef = doc(db, "suppliers", poData.supplierId); const supplierDocSnap = await getDoc(supplierRef); if (supplierDocSnap.exists()) { supplierName = supplierDocSnap.data().name || supplierName; } else { supplierName = poData.supplierName || supplierName; } } catch (supplierError) { supplierName = poData.supplierName || supplierName; } } else { supplierName = poData.supplierName || supplierName; }
        const poNumberDisplay = poData.poNumber ? `<span class="po-number-large">#${escapeHtml(poData.poNumber)}</span>` : 'N/A'; let orderDateStr = 'N/A'; if (poData.orderDate?.toDate) { try { orderDateStr = poData.orderDate.toDate().toLocaleDateString('en-GB'); } catch (e) {} }
        poShareInfo.innerHTML = `<span class="po-info-left">PO Number: ${poNumberDisplay}</span><span class="po-info-right"><span>Order Date: ${orderDateStr}</span></span>`;
        poShareGreeting.innerHTML = `Dear ${escapeHtml(supplierName)},<br>This Purchase Order is being shared with you. Please review the details below.`;
        let itemsHTML = '<p>No items found.</p>';
        if (poData.items && poData.items.length > 0) {
            itemsHTML = `<table class="details-table"><thead><tr><th>#</th><th>Product Name</th><th>Type</th><th>Details (Qty/Size/Calc)</th><th>Rate</th><th>Party</th><th>Design</th><th style="text-align: right;">Amount</th></tr></thead><tbody>`;
            poData.items.forEach((item, index) => {
                let detailStr = ''; const qty = item.quantity || '?'; const itemUnitType = item.unitType || 'Qty';
                if (itemUnitType === 'Sq Feet') { const w = item.width || '?'; const h = item.height || '?'; const u = item.dimensionUnit || 'units'; const printSqFt = item.printSqFt ? parseFloat(item.printSqFt).toFixed(2) : '?'; const printW = item.printWidthFt ? parseFloat(item.printWidthFt).toFixed(2) + 'ft' : '?'; const printH = item.printHeightFt ? parseFloat(item.printHeightFt).toFixed(2) + 'ft' : '?'; detailStr = `Qty: ${escapeHtml(qty)} (${escapeHtml(w)}x${escapeHtml(h)} ${escapeHtml(u)})<br>Print Area: ${escapeHtml(printSqFt)} sqft (on ${escapeHtml(printW)}x${escapeHtml(printH)} media)`; } else { detailStr = `Qty: ${escapeHtml(qty)}`; }
                itemsHTML += `<tr><td>${index + 1}</td><td>${escapeHtml(item.productName || 'N/A')}</td><td>${escapeHtml(itemUnitType)}</td><td>${detailStr}</td><td>${item.rate?.toFixed(2) ?? 'N/A'}</td><td>${escapeHtml(item.partyName || '-')}</td><td>${escapeHtml(item.designDetails || '-')}</td><td style="text-align: right;">${item.itemAmount?.toFixed(2) ?? 'N/A'}</td></tr>`;
            }); itemsHTML += `</tbody></table>`; poShareItemsContainer.innerHTML = `<h3>Items</h3>${itemsHTML}`;
        } else { poShareItemsContainer.innerHTML = `<h3>Items</h3><p>No items found for this PO.</p>`; }
        poShareTermList.innerHTML = `<li>Ensure prompt delivery of the order.</li><li>The supplied material must match the approved sample and specifications.</li><li>Maintain the specified quality standards.</li><li>Payment may be withheld or rejected for defective/substandard goods.</li>`;
        copyPoShareModalBtn.dataset.poid = poId; copyPoShareModalBtn.disabled = false;
    } catch (error) { console.error("Error opening or populating PO Share modal:", error); poShareModalTitle.textContent = "Error"; poShareInfo.innerHTML = ''; poShareGreeting.innerHTML = ''; poShareItemsContainer.innerHTML = `<p class="error-message">Error loading PO details: ${escapeHtml(error.message)}</p>`; poShareTermList.innerHTML = ''; copyPoShareModalBtn.disabled = true; }
}
function closePoShareModalFunction() { if (poShareModal) { poShareModal.classList.remove('active'); } }
async function handleCopyPoShareContent(event) {
    const button = event.currentTarget; const poId = button.dataset.poid; if (!poId) { alert("Error: Could not find PO ID to copy."); return; } if (!navigator.clipboard || !navigator.clipboard.write) { alert("Error: Clipboard API not supported or not available."); return; }
    button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Copying...'; button.classList.add('copying'); button.classList.remove('copied');
    try {
        const poRef = doc(db, "purchaseOrders", poId); const poDocSnap = await getDoc(poRef); if (!poDocSnap.exists()) { throw new Error("PO data not found."); } const poData = poDocSnap.data();
        let supplierName = "Supplier"; if (poData.supplierId) { try { const supplierRef = doc(db, "suppliers", poData.supplierId); const supplierDocSnap = await getDoc(supplierRef); if (supplierDocSnap.exists()) { supplierName = supplierDocSnap.data().name || supplierName; } else { supplierName = poData.supplierName || supplierName; } } catch (supplierError) { supplierName = poData.supplierName || supplierName; } } else { supplierName = poData.supplierName || supplierName; }
        let orderDateStr = 'N/A'; if (poData.orderDate?.toDate) { try { orderDateStr = poData.orderDate.toDate().toLocaleDateString('en-GB'); } catch(e){} }
        // Get dynamic T&C content
        const termListElement = document.getElementById('poShareTermList');
        let termsHTML = termListElement ? termListElement.innerHTML : '<ol><li>Default T&C...</li></ol>'; // Fallback
        let termsText = '';
        if (termListElement) {
            termsText = Array.from(termListElement.querySelectorAll('li')).map((li, index) => `${index + 1}. ${li.textContent.trim()}`).join('\n');
        } else { termsText = '1. Default T&C...'; }

        // Generate HTML & Text Content... (keeping existing logic)
        let htmlContent = `<p><strong>Purchase Order #${escapeHtml(poData.poNumber || 'N/A')}</strong></p><p><strong>Order Date:</strong> ${orderDateStr}</p><hr><p>Dear ${escapeHtml(supplierName)},<br>This Purchase Order is being shared with you. Please review the details below.</p><hr><h3>Items</h3>`;
        if (poData.items && poData.items.length > 0) {
            htmlContent += `<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 10pt;"><thead><tr style="background-color: #f2f2f2;"><th>#</th><th>Product</th><th>Type</th><th>Details</th><th>Rate</th><th>Party</th><th>Design</th><th>Amount</th></tr></thead><tbody>`;
            poData.items.forEach((item, index) => { let detailStr = ''; const qty = item.quantity || '?'; const itemUnitType = item.unitType || 'Qty'; if (itemUnitType === 'Sq Feet') { const w = item.width || '?'; const h = item.height || '?'; const u = item.dimensionUnit || 'units'; const printSqFt = item.printSqFt ? parseFloat(item.printSqFt).toFixed(2) : '?'; detailStr = `Qty: ${escapeHtml(qty)} (${escapeHtml(w)}x${escapeHtml(h)} ${escapeHtml(u)})<br>Print Area: ${escapeHtml(printSqFt)} sqft`; } else { detailStr = `Qty: ${escapeHtml(qty)}`; } htmlContent += `<tr><td>${index + 1}</td><td>${escapeHtml(item.productName || 'N/A')}</td><td>${escapeHtml(itemUnitType)}</td><td>${detailStr}</td><td>${item.rate?.toFixed(2) ?? 'N/A'}</td><td>${escapeHtml(item.partyName || '-')}</td><td>${escapeHtml(item.designDetails || '-')}</td><td align="right">${item.itemAmount?.toFixed(2) ?? 'N/A'}</td></tr>`; });
            htmlContent += `</tbody></table>`;
        } else { htmlContent += `<p>No items found.</p>`; }
        htmlContent += `<hr><h3>Terms & Conditions</h3><ol>${termsHTML}</ol>`; // Append dynamic T&C HTML
        let textContent = `Purchase Order #${poData.poNumber || 'N/A'}\nOrder Date: ${orderDateStr}\n\nDear ${supplierName},\nThis Purchase Order is being shared with you...\n\nItems:\n`;
        if (poData.items && poData.items.length > 0) { textContent += poData.items.map((item, index) => { let detailText = ''; const itemUnitType = item.unitType || 'Qty'; if(itemUnitType === 'Sq Feet') { const w = item.width || '?'; const h = item.height || '?'; const u = item.dimensionUnit || 'units'; detailText = ` (${w}x${h} ${u})`; } return `${index + 1}. ${item.productName || 'N/A'} - Qty: ${item.quantity || '?'}${detailText}`; }).join('\n'); } else { textContent += 'No items.'; }
        textContent += `\n\nTerms & Conditions:\n${termsText}`; // Append dynamic T&C Text

        const htmlBlob = new Blob([htmlContent], { type: 'text/html' }); const textBlob = new Blob([textContent], { type: 'text/plain' }); const clipboardItem = new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob });
        await navigator.clipboard.write([clipboardItem]); button.innerHTML = '<i class="fas fa-check"></i> Copied!'; button.classList.add('copied');
    } catch (error) { console.error("Copy failed: ", error); alert("Error: Could not copy. " + error.message); button.innerHTML = '<i class="fas fa-copy"></i> Copy Content'; }
    finally { button.classList.remove('copying'); setTimeout(() => { if (button.classList.contains('copied')) { button.innerHTML = '<i class="fas fa-copy"></i> Copy Content'; button.classList.remove('copied'); button.disabled = false; } else { button.innerHTML = '<i class="fas fa-copy"></i> Copy Content'; button.disabled = false; } }, 2000); }
}
function handlePrintPoShare() {
    const modalContentElement = document.getElementById('poShareScrollableContent');
    if (!poShareModal || !modalContentElement || !poShareModal.classList.contains('active')) { alert("Please open the PO Share view first or wait for content to load."); return; }
    try {
         const poIdForTitle = copyPoShareModalBtn?.dataset?.poid || ''; const poNumber = cachedPOs[poIdForTitle]?.poNumber || 'PO'; const printWindow = window.open('', '_blank', 'height=800,width=800');
         printWindow.document.write('<html><head><title>Print Purchase Order - ' + escapeHtml(poNumber) + '</title>');
         printWindow.document.write('<link rel="stylesheet" href="css/supplier_management.css">'); // Link external CSS
         printWindow.document.write('<link rel="stylesheet" href="css/index.css">'); // Link external CSS
         printWindow.document.write('<style> @media print { body { margin: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact;} table { page-break-inside: auto; } tr { page-break-inside: avoid; page-break-after: auto; } thead { display: table-header-group; } .no-print { display: none; } } </style>'); // Basic print styles
         printWindow.document.write('</head><body>');
         // Add a wrapper with a class to target for printing
         printWindow.document.write('<div class="printing-po-share">');
         printWindow.document.write(document.getElementById('poShareModal').innerHTML); // Write the whole modal content for styling
         printWindow.document.write('</div>');
         printWindow.document.write('</body></html>');
         printWindow.document.close();
         printWindow.focus();
         setTimeout(() => { try { printWindow.print(); } catch (e) { console.error("Print failed:", e); alert("Printing failed."); } }, 1000);
     } catch (error) { console.error("Error printing:", error); alert("Could not print."); }
}

// --- See More Items Modal Functions ---
// (Keep existing: openSeeMoreItemsModal, closePoItemsModal)
async function openSeeMoreItemsModal(poId) {
    if (!poItemsModal || !poItemsModalContent || !poItemsModalTitle) { console.error("PO Items Modal elements missing!"); alert("Could not display items."); return; }
    poItemsModalTitle.textContent = `Items for PO #${poId.substring(0, 6)}...`; poItemsModalContent.innerHTML = '<p>Loading items...</p>'; poItemsModal.classList.add('active'); // Use class
    try {
        let poData = cachedPOs[poId]; if (!poData) { const poSnap = await getDoc(doc(db, "purchaseOrders", poId)); if (poSnap.exists()) poData = poSnap.data(); } if (!poData || !poData.items || poData.items.length === 0) { throw new Error("No items found for this PO."); }
        let itemsTableHtml = `<table class="details-table"><thead><tr><th>#</th><th>Item Name</th><th>Quantity</th><th>Size</th><th>Rate</th><th>Amount</th></tr></thead><tbody>`;
        poData.items.forEach((item, index) => {
            const itemTotal = (item.quantity || 0) * (item.rate || 0); let sizeText = '-';
             if (item.unitType === 'Sq Feet' && item.width && item.height) { const width = escapeHtml(item.width); const height = escapeHtml(item.height); const unit = escapeHtml(item.dimensionUnit || 'units'); sizeText = `${width} x ${height} ${unit}`; }
            itemsTableHtml += `<tr><td>${index + 1}</td><td>${escapeHtml(item.productName || 'N/A')}</td><td style="text-align: right;">${escapeHtml(item.quantity || 0)}</td><td>${sizeText}</td><td style="text-align: right;">${formatCurrency(item.rate || 0)}</td><td style="text-align: right;">${formatCurrency(itemTotal)}</td></tr>`;
        });
        itemsTableHtml += `</tbody></table>`;
        poItemsModalContent.innerHTML = itemsTableHtml;
    } catch (error) { console.error(`Error loading items for PO ${poId}:`, error); poItemsModalContent.innerHTML = `<p style="color: red;">Error loading items: ${error.message}</p>`; }
}
function closePoItemsModal() { if (poItemsModal) { poItemsModal.classList.remove('active'); } } // Use class


// --- Batch Action Bar Update & Handlers ---
// (Keep existing: updateBatchActionBar, SelectAll listener, Individual PO listener, DeselectAll listener, Batch buttons listeners)
function updateBatchActionBar() {
    if (!poBatchActionsBar || !poSelectedCount || !selectAllPoCheckbox || !batchApplyStatusBtn || !batchDeletePoBtn || !batchUpdateStatusSelect) return;
    const count = selectedPoIds.size; const MAX_STATUS_UPDATE = 10; const MAX_DELETE = 5;
    if (count > 0) {
        poSelectedCount.textContent = `${count} PO${count > 1 ? 's' : ''} selected`; poBatchActionsBar.style.display = 'flex';
        const statusSelected = batchUpdateStatusSelect.value !== ""; batchApplyStatusBtn.disabled = !(statusSelected && count > 0 && count <= MAX_STATUS_UPDATE);
        if (count > MAX_STATUS_UPDATE) { batchApplyStatusBtn.title = `Select up to ${MAX_STATUS_UPDATE} POs to update status.`; } else if (!statusSelected) { batchApplyStatusBtn.title = `Select a status to apply.`; } else { batchApplyStatusBtn.title = `Apply status to ${count} PO(s).`; }
        batchDeletePoBtn.disabled = !(count > 0 && count <= MAX_DELETE);
         if (count > MAX_DELETE) { batchDeletePoBtn.title = `Select up to ${MAX_DELETE} POs to delete.`; } else { batchDeletePoBtn.title = `Delete ${count} selected PO(s).`; }
        if(batchMarkReceivedBtn) batchMarkReceivedBtn.disabled = (count === 0);
        const displayedCheckboxes = poTableBody.querySelectorAll('.po-select-checkbox'); selectAllPoCheckbox.checked = displayedCheckboxes.length > 0 && count === displayedCheckboxes.length;
    } else {
        poBatchActionsBar.style.display = 'none'; selectAllPoCheckbox.checked = false; batchUpdateStatusSelect.value = ""; batchApplyStatusBtn.disabled = true; batchDeletePoBtn.disabled = true; if(batchMarkReceivedBtn) batchMarkReceivedBtn.disabled = true;
    }
}
if (selectAllPoCheckbox && poTableBody) {
    selectAllPoCheckbox.addEventListener('change', (event) => {
        const isChecked = event.target.checked;
        poTableBody.querySelectorAll('.po-select-checkbox').forEach(checkbox => { checkbox.checked = isChecked; const poId = checkbox.value; const row = checkbox.closest('tr'); if (isChecked) { selectedPoIds.add(poId); if(row) row.classList.add('selected-row'); } else { selectedPoIds.delete(poId); if(row) row.classList.remove('selected-row'); } });
        updateBatchActionBar();
    });
}
if (poTableBody) {
    poTableBody.addEventListener('change', (event) => {
        if (event.target.classList.contains('po-select-checkbox')) {
            const checkbox = event.target; const poId = checkbox.value; const row = checkbox.closest('tr');
            if (checkbox.checked) { selectedPoIds.add(poId); if(row) row.classList.add('selected-row'); } else { selectedPoIds.delete(poId); if(row) row.classList.remove('selected-row'); }
            updateBatchActionBar();
        }
    });
}
if (deselectAllPoBtn) {
    deselectAllPoBtn.addEventListener('click', () => {
        selectedPoIds.clear(); poTableBody.querySelectorAll('.po-select-checkbox').forEach(checkbox => checkbox.checked = false); poTableBody.querySelectorAll('tr.selected-row').forEach(row => row.classList.remove('selected-row'));
        if (selectAllPoCheckbox) selectAllPoCheckbox.checked = false; updateBatchActionBar();
    });
}
if(batchApplyStatusBtn && batchUpdateStatusSelect) {
    batchApplyStatusBtn.addEventListener('click', async () => {
        const newStatus = batchUpdateStatusSelect.value; const idsToUpdate = Array.from(selectedPoIds); const MAX_LIMIT = 10;
        if (!newStatus) { alert("Please select a status to apply."); return; } if (idsToUpdate.length === 0) { alert("Please select at least one PO."); return; } if (idsToUpdate.length > MAX_LIMIT) { alert(`You can update status for a maximum of ${MAX_LIMIT} POs at a time.`); return; }
        if (confirm(`Apply status '${escapeHtml(newStatus)}' to ${idsToUpdate.length} selected PO(s)?`)) {
             batchApplyStatusBtn.disabled = true; batchApplyStatusBtn.textContent = 'Applying...'; let successCount = 0; let errorCount = 0; const batch = writeBatch(db);
             idsToUpdate.forEach(poId => { const poRef = doc(db, "purchaseOrders", poId); batch.update(poRef, { status: newStatus, updatedAt: serverTimestamp() }); });
            try { await batch.commit(); successCount = idsToUpdate.length; }
            catch (error) { console.error(`Error committing batch status update:`, error); errorCount = idsToUpdate.length; successCount = 0; alert(`Error applying batch status update: ${error.message}`); }
             batchApplyStatusBtn.disabled = false; batchApplyStatusBtn.textContent = 'Apply Status'; if(successCount > 0) alert(`Batch update complete. Status updated for ${successCount} PO(s).`);
             selectedPoIds.clear(); poTableBody.querySelectorAll('.po-select-checkbox').forEach(cb => cb.checked = false); poTableBody.querySelectorAll('tr.selected-row').forEach(row => row.classList.remove('selected-row'));
             updateBatchActionBar(); displayPoList();
         }
    });
}
if(batchMarkReceivedBtn) {
     batchMarkReceivedBtn.addEventListener('click', async () => {
         const idsToUpdate = Array.from(selectedPoIds); if (idsToUpdate.length === 0) { alert("Please select at least one PO."); return; }
         if (confirm(`Mark ${idsToUpdate.length} selected PO(s) as 'Product Received'?`)) {
             batchMarkReceivedBtn.disabled = true; batchMarkReceivedBtn.textContent = 'Marking...'; let successCount = 0; let errorCount = 0; const batch = writeBatch(db);
             idsToUpdate.forEach(poId => { const poRef = doc(db, "purchaseOrders", poId); batch.update(poRef, { status: 'Product Received', receivedDate: serverTimestamp(), updatedAt: serverTimestamp() }); });
             try { await batch.commit(); successCount = idsToUpdate.length; } catch (error) { console.error("Error batch marking received:", error); errorCount = idsToUpdate.length; alert(`Error: ${error.message}`); }
             batchMarkReceivedBtn.disabled = false; batchMarkReceivedBtn.textContent = 'Mark as Received'; if(successCount > 0) alert(`Mark Received complete. Updated ${successCount} PO(s).`);
             selectedPoIds.clear(); updateBatchActionBar(); displayPoList();
         }
     });
}
 if(batchDeletePoBtn) {
     batchDeletePoBtn.addEventListener('click', async () => {
         const idsToDelete = Array.from(selectedPoIds); const MAX_LIMIT = 5;
         if (idsToDelete.length === 0) { alert("Please select at least one PO to delete."); return; } if (idsToDelete.length > MAX_LIMIT) { alert(`You can delete a maximum of ${MAX_LIMIT} POs at a time.`); return; }
         if (confirm(`Permanently delete ${idsToDelete.length} selected PO(s)? This cannot be undone.`)) {
             batchDeletePoBtn.disabled = true; batchDeletePoBtn.textContent = 'Deleting...'; let successCount = 0; let errorCount = 0; const batch = writeBatch(db);
             idsToDelete.forEach(poId => { batch.delete(doc(db, "purchaseOrders", poId)); });
             try { await batch.commit(); successCount = idsToDelete.length; } catch (error) { console.error(`Error committing batch delete:`, error); errorCount = idsToDelete.length; alert(`Error deleting POs: ${error.message}`); }
             batchDeletePoBtn.disabled = false; batchDeletePoBtn.textContent = 'Delete Selected'; if(successCount > 0) alert(`Batch delete complete. Deleted ${successCount} PO(s).`);
             selectedPoIds.clear(); poTableBody.querySelectorAll('.po-select-checkbox').forEach(cb => cb.checked = false); poTableBody.querySelectorAll('tr.selected-row').forEach(row => row.classList.remove('selected-row'));
             updateBatchActionBar(); displayPoList();
         }
     });
 }

// --- Event Listeners Setup ---
function setupEventListeners() {
    // (Keep all existing event listener attachments for suppliers, POs, modals, filters, batch actions)
     if (supplierTableBody) {
        supplierTableBody.addEventListener('click', handleSupplierTableActions);
        supplierTableBody.addEventListener('click', handleSupplierRowClick);
    }
    if (addNewSupplierBtn) addNewSupplierBtn.addEventListener('click', () => openSupplierModal('add'));
    if (closeSupplierModalBtn) closeSupplierModalBtn.addEventListener('click', closeSupplierModal);
    if (cancelSupplierBtn) cancelSupplierBtn.addEventListener('click', closeSupplierModal);
    if (supplierForm) supplierForm.addEventListener('submit', handleAddSupplierSubmit);
    if (supplierModal) supplierModal.addEventListener('click', (event) => { if (event.target === supplierModal) closeSupplierModal(); });
    if (deleteSupplierFromModalBtn) deleteSupplierFromModalBtn.addEventListener('click', handleDeleteSupplierFromModal);
    if (poFilterBtn) { poFilterBtn.addEventListener('click', () => { poPagination.currentPage = 1; poPagination.lastVisibleDoc = null; displayPoList(); }); }
    if (poClearFilterBtn) { poClearFilterBtn.addEventListener('click', () => { if(poSearchInput) poSearchInput.value = ''; if(poSupplierFilter) poSupplierFilter.value = ''; if(poStatusFilter) poStatusFilter.value = ''; if(poStartDateFilter) poStartDateFilter.value = ''; if(poEndDateFilter) poEndDateFilter.value = ''; currentPoSortField = 'createdAt'; currentPoSortDirection = 'desc'; updateSortIndicators(); poPagination.currentPage = 1; poPagination.lastVisibleDoc = null; displayPoList(); }); }
    if (poSearchInput) { poSearchInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') { event.preventDefault(); if (poFilterBtn) { poFilterBtn.click(); } else { poPagination.currentPage = 1; poPagination.lastVisibleDoc = null; displayPoList(); } } }); }
    if (poTableHeader) { poTableHeader.addEventListener('click', handlePoSort); }
    if (poTableBody) { poTableBody.addEventListener('click', handlePOTableActions); }
    if(batchUpdateStatusSelect) { batchUpdateStatusSelect.addEventListener('change', updateBatchActionBar); }
    if (closeStatusModalBtn) closeStatusModalBtn.addEventListener('click', closeStatusModal);
    if (cancelStatusBtn) cancelStatusBtn.addEventListener('click', closeStatusModal);
    if (statusUpdateForm) statusUpdateForm.addEventListener('submit', handleStatusUpdate);
    if (statusUpdateModal) statusUpdateModal.addEventListener('click', (event) => { if (event.target === statusUpdateModal) closeStatusModal(); });
    // PO Share Modal Listeners
    if (closePoShareModalTopBtn) closePoShareModalTopBtn.addEventListener('click', closePoShareModalFunction);
    if (closePoShareModalBtn) closePoShareModalBtn.addEventListener('click', closePoShareModalFunction);
    if (poShareModal) poShareModal.addEventListener('click', (event) => { if (event.target === poShareModal) closePoShareModalFunction(); });
    if (printPoShareModalBtn) printPoShareModalBtn.addEventListener('click', handlePrintPoShare);
    if (copyPoShareModalBtn) copyPoShareModalBtn.addEventListener('click', handleCopyPoShareContent);
    // PO Items Modal (See More) Listeners
    if (closePoItemsModalBtn) closePoItemsModalBtn.addEventListener('click', closePoItemsModal);
    if (closePoItemsModalBottomBtn) closePoItemsModalBottomBtn.addEventListener('click', closePoItemsModal);
    if (poItemsModal) poItemsModal.addEventListener('click', (event) => { if (event.target === poItemsModal) closePoItemsModal(); });
    if (exportPoCsvBtn) exportPoCsvBtn.addEventListener('click', () => { alert("CSV Export needs implementation."); }); // Keep existing
}

// --- MAIN INITIALIZATION FUNCTION ---
// (Keep existing initializeSupplierManagementPage function)
async function initializeSupplierManagementPage(user) {
    if (pageInitialized) {
         console.log("Supplier Management Page already initialized.");
         return;
    }
    pageInitialized = true;
    console.log("Initializing Supplier Management Page for user:", user.uid);

    // Call setupEventListeners only ONCE
    setupEventListeners();

    try {
         console.log("Performing initial data load...");
         // Start loading data
         await displaySupplierTable(); // Load suppliers first to populate filter
         await displayPoList(); // Load initial POs
         console.log("Initial data load complete.");
    } catch (error) {
         console.error("Error during initial data load:", error);
         displayError("Failed to load initial page data.", 'poListError'); // Show error
    } finally {
        // Hide any main loading indicator if you have one
        console.log("Initialization sequence finished.");
    }
}


// --- Auth State Listener & Initialization Trigger ---
function initPageOnLoad() {
     console.log("DOM loaded. Setting up Auth listener for supplier_management.js");
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

// Removed: window.initializeSupplierManagementPage = initializeSupplierManagementPage;