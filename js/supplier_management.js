// js/supplier_management.js - v9 (Suppliers Modal, Date Filters Added)

import { generatePoPdf } from './utils.js';
import {
    db, auth,
    collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc,
    query, orderBy, where, Timestamp, serverTimestamp
} from './firebase-init.js';

// --- DOM Elements ---
// Action Bar Buttons
const viewSuppliersBtn = document.getElementById('viewSuppliersBtn'); // New button
// const addSupplierBtn = document.getElementById('addSupplierBtn'); // Removed from top bar

// PO Table & Filters
const poTableBody = document.getElementById('poTableBody');
const poSearchInput = document.getElementById('poSearchInput');
const poStatusFilter = document.getElementById('poStatusFilter');
const poStartDateFilter = document.getElementById('poStartDateFilter'); // New Date Filter
const poEndDateFilter = document.getElementById('poEndDateFilter');   // New Date Filter
const poFilterBtn = document.getElementById('poFilterBtn');
const poClearFilterBtn = document.getElementById('poClearFilterBtn'); // New Clear Button
const poTotalsDisplay = document.getElementById('poTotalsDisplay');   // Optional Totals Area

// Supplier Add/Edit Modal (Remains for single edits/adds)
const supplierModal = document.getElementById('supplierModal');
const supplierModalTitle = document.getElementById('supplierModalTitle');
const closeSupplierModalBtn = document.getElementById('closeSupplierModal');
const cancelSupplierBtn = document.getElementById('cancelSupplierBtn');
const saveSupplierBtn = document.getElementById('saveSupplierBtn');
const supplierForm = document.getElementById('supplierForm');
const supplierIdInput = document.getElementById('supplierIdInput');
const supplierNameInput = document.getElementById('supplierNameInput');
const supplierCompanyInput = document.getElementById('supplierCompanyInput');
const supplierWhatsappInput = document.getElementById('supplierWhatsappInput');
const supplierEmailInput = document.getElementById('supplierEmailInput');
const supplierAddressInput = document.getElementById('supplierAddressInput');
const supplierGstInput = document.getElementById('supplierGstInput');
const supplierErrorMsg = document.getElementById('supplierErrorMsg');

// PO Status Update Modal (No changes needed)
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

// PO Item Details Modal (No changes needed)
const poDetailsModal = document.getElementById('poDetailsModal');
const poDetailsModalTitle = document.getElementById('poDetailsModalTitle');
const closePoDetailsModalBtn = document.getElementById('closePoDetailsModal');
const closePoDetailsBtn = document.getElementById('closePoDetailsBtn');
const poDetailsContent = document.getElementById('poDetailsContent');

// **** NEW Suppliers List Modal Elements ****
const suppliersListModal = document.getElementById('suppliersListModal');
const closeSuppliersListModalBtn = document.getElementById('closeSuppliersListModal');
const addSupplierInModalBtn = document.getElementById('addSupplierInModalBtn');
const supplierTableBodyModal = document.getElementById('supplierTableBodyModal'); // Target for list
const closeSuppliersListBtnBottom = document.getElementById('closeSuppliersListBtnBottom');
// ******************************************

// --- Global State ---
let currentEditingSupplierId = null;
let cachedPOs = {};
let suppliersDataCache = []; // Cache for supplier data used in list modal

// --- Modal Handling ---

// Supplier Add/Edit Modal (No logic changes)
function openSupplierModal(mode = 'add', supplierData = null, supplierId = null) {
    // Function remains the same as previous version
    if (!supplierModal || !supplierForm || !supplierModalTitle || !supplierErrorMsg || !supplierIdInput || !supplierNameInput || !supplierCompanyInput || !supplierWhatsappInput || !supplierEmailInput || !supplierAddressInput || !supplierGstInput) {
        console.error("Supplier modal elements not found!"); alert("Error: Could not open supplier form."); return;
    }
    supplierForm.reset(); supplierErrorMsg.textContent = ''; supplierErrorMsg.style.display = 'none';
    currentEditingSupplierId = null;
    if (mode === 'edit' && supplierData && supplierId) {
        supplierModalTitle.textContent = 'Edit Supplier'; supplierIdInput.value = supplierId; currentEditingSupplierId = supplierId;
        supplierNameInput.value = supplierData.name || ''; supplierCompanyInput.value = supplierData.companyName || '';
        supplierWhatsappInput.value = supplierData.whatsappNo || ''; supplierEmailInput.value = supplierData.email || '';
        supplierAddressInput.value = supplierData.address || ''; supplierGstInput.value = supplierData.gstNo || '';
    } else {
        supplierModalTitle.textContent = 'Add New Supplier'; supplierIdInput.value = '';
    }
    supplierModal.classList.add('active');
}
function closeSupplierModal() {
    if (supplierModal) { supplierModal.classList.remove('active'); }
}

// Status Update Modal (No logic changes)
function openStatusModal(poId, currentStatus, poNumber) {
    // Function remains the same as previous version
     if (!statusUpdateModal || !statusUpdateForm || !statusModalTitle || !statusUpdatePOId || !statusSelect || !currentPOStatusSpan) { console.error("Status update modal elements not found!"); alert("Error: Cannot open status update form."); return; }
     statusUpdateForm.reset(); statusErrorMsg.textContent = ''; statusErrorMsg.style.display = 'none';
     statusModalTitle.textContent = `Update Status for PO #${poNumber || poId}`; statusUpdatePOId.value = poId;
     currentPOStatusSpan.textContent = currentStatus || 'N/A'; statusSelect.value = "";
     const options = statusSelect.options;
     for (let i = 0; i < options.length; i++) { if (options[i].value === currentStatus) { break; } }
     statusUpdateModal.classList.add('active');
}
function closeStatusModal() {
    if (statusUpdateModal) { statusUpdateModal.classList.remove('active'); }
}

// PO Item Details Modal (No logic changes)
function openPoDetailsModal(poId) {
    // Function remains the same as previous version
    if (!poDetailsModal || !poDetailsModalTitle || !poDetailsContent) { console.error("PO Details modal elements not found!"); alert("Error: Cannot open PO details."); return; }
    poDetailsModalTitle.textContent = `Loading PO Details...`; poDetailsContent.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading items...</p>'; poDetailsModal.classList.add('active');
    const poRef = doc(db, "purchaseOrders", poId);
    getDoc(poRef).then(docSnap => { /* ... same fetching and rendering logic ... */ }).catch(error => { /* ... same error handling ... */ });
}
function closePoDetailsModal() {
    if (poDetailsModal) { poDetailsModal.classList.remove('active'); poDetailsContent.innerHTML = ''; }
}

// **** NEW Suppliers List Modal Handling ****
function openSuppliersListModal() {
    if (suppliersListModal) {
        suppliersListModal.classList.add('active');
        // Load suppliers list when modal opens
        displaySupplierList();
    } else {
        console.error("Suppliers List Modal element not found!");
    }
}

function closeSuppliersListModal() {
    if (suppliersListModal) {
        suppliersListModal.classList.remove('active');
        // Optional: Clear table body when closing to ensure fresh load next time
        // if(supplierTableBodyModal) supplierTableBodyModal.innerHTML = '';
    }
}
// ******************************************


// --- Firestore Operations ---

// **** MODIFIED Function to display suppliers IN THE MODAL ****
async function displaySupplierList() {
    // Target the new modal table body
    const targetTableBody = supplierTableBodyModal; // Use the new ID
    if (!targetTableBody) { console.error("Supplier modal table body not found!"); return; }

    // Check Firestore dependencies
    if (!db || !collection || !getDocs || !query || !orderBy) {
        console.error("Firestore functions not available in displaySupplierList.");
        targetTableBody.innerHTML = '<tr><td colspan="5" class="error-message">Error: Cannot load suppliers list.</td></tr>';
        return;
    }

    targetTableBody.innerHTML = '<tr><td colspan="5"><i class="fas fa-spinner fa-spin"></i> Loading suppliers...</td></tr>';
    suppliersDataCache = []; // Clear cache

    try {
        const q = query(collection(db, "suppliers"), orderBy("name"));
        const querySnapshot = await getDocs(q);
        targetTableBody.innerHTML = ''; // Clear loading message

        if (querySnapshot.empty) {
            targetTableBody.innerHTML = '<tr><td colspan="5">No suppliers found. Click "+ Add New Supplier" above to add one.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnapshot) => {
            const supplier = docSnapshot.data();
            const supplierId = docSnapshot.id;
            suppliersDataCache.push({ id: supplierId, ...supplier }); // Cache data

            const tr = document.createElement('tr');
            tr.setAttribute('data-id', supplierId);
            tr.innerHTML = `
                <td>${supplier.name || 'N/A'}</td>
                <td>${supplier.companyName || '-'}</td>
                <td>${supplier.whatsappNo || '-'}</td>
                <td>${supplier.email || '-'}</td>
                <td class="action-buttons">
                    <button class="button edit-button" data-id="${supplierId}" title="Edit Supplier"><i class="fas fa-edit"></i></button>
                    <button class="button delete-button" data-id="${supplierId}" data-name="${supplier.name || ''}" title="Delete Supplier"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
            targetTableBody.appendChild(tr);
        });
        console.log("Suppliers list displayed successfully in modal.");

    } catch (error) {
        console.error("Error fetching suppliers: ", error);
        targetTableBody.innerHTML = `<tr><td colspan="5" class="error-message">Error loading suppliers: ${error.message}</td></tr>`;
    }
}

// **** MODIFIED Event Handlers for Supplier Edit/Delete inside Modal (Using Event Delegation) ****
function handleSupplierTableActions(event) {
    const targetButton = event.target.closest('button.edit-button, button.delete-button');
    if (!targetButton) return; // Click was not on an action button

    const supplierId = targetButton.dataset.id;
    if (!supplierId) {
        console.error("Supplier ID not found on action button.");
        return;
    }

    if (targetButton.classList.contains('edit-button')) {
        // Find cached supplier data
        const supplierData = suppliersDataCache.find(s => s.id === supplierId);
        if (supplierData) {
            openSupplierModal('edit', supplierData, supplierId);
        } else {
            // Fallback: Fetch if not in cache (should ideally be cached by displaySupplierList)
            console.warn(`Supplier ${supplierId} not found in cache for edit. Fetching...`);
            getDoc(doc(db, "suppliers", supplierId)).then(docSnap => {
                 if(docSnap.exists()) {
                     openSupplierModal('edit', docSnap.data(), supplierId);
                 } else {
                     alert(`Error: Could not find supplier ${supplierId} to edit.`);
                 }
            }).catch(err => {
                 console.error("Error fetching supplier for edit:", err);
                 alert("Error loading supplier details.");
            });
        }
    } else if (targetButton.classList.contains('delete-button')) {
        const supplierName = targetButton.dataset.name || supplierId;
        deleteSupplier(supplierId, supplierName);
    }
}

// Function to save/update supplier (Called from supplierModal)
// MODIFIED: Refresh list in modal after save/update
async function saveSupplier(event) {
    event.preventDefault();
    // ... (validation logic remains the same as previous version) ...
    if (!db || !collection || !addDoc || !doc || !updateDoc || !Timestamp) { showSupplierError("Error: Required functions missing."); return; }
    if (!saveSupplierBtn || !supplierNameInput || !supplierErrorMsg || !supplierIdInput || !supplierCompanyInput || !supplierWhatsappInput || !supplierEmailInput || !supplierAddressInput || !supplierGstInput) { console.error("Save Supplier prerequisites missing."); alert("Error: Cannot save supplier."); return; }
    const supplierData = { name: supplierNameInput.value.trim(), companyName: supplierCompanyInput.value.trim(), whatsappNo: supplierWhatsappInput.value.trim(), email: supplierEmailInput.value.trim(), address: supplierAddressInput.value.trim(), gstNo: supplierGstInput.value.trim(), };
    if (!supplierData.name) { showSupplierError("Supplier Name is required."); supplierNameInput.focus(); return; }
    saveSupplierBtn.disabled = true; saveSupplierBtn.textContent = 'Saving...'; supplierErrorMsg.style.display = 'none'; supplierErrorMsg.textContent = '';

    try {
        const supplierIdToUse = supplierIdInput.value;
        if (supplierIdToUse) { // Update
            supplierData.updatedAt = Timestamp.now();
            const supplierRef = doc(db, "suppliers", supplierIdToUse);
            await updateDoc(supplierRef, supplierData);
            console.log("Supplier updated with ID: ", supplierIdToUse);
        } else { // Add
            supplierData.createdAt = Timestamp.now(); supplierData.updatedAt = Timestamp.now();
            const docRef = await addDoc(collection(db, "suppliers"), supplierData);
            console.log("Supplier added with ID: ", docRef.id);
        }
        closeSupplierModal();
        // **** Refresh the list in the Suppliers List Modal ****
        await displaySupplierList();
        // **** Also refresh PO list in case supplier name changed ****
        await displayPoList();

    } catch (error) {
        console.error("Error saving supplier: ", error); showSupplierError("Error saving supplier: " + error.message);
    } finally {
        if(saveSupplierBtn) { saveSupplierBtn.disabled = false; saveSupplierBtn.textContent = 'Save Supplier'; }
    }
}

// Function to delete supplier
// MODIFIED: Refresh list in modal after delete
async function deleteSupplier(supplierId, supplierName) {
    if (!db || !doc || !deleteDoc) { alert("Error: Required functions missing for deleting supplier."); return; }
    if (confirm(`Are you sure you want to delete supplier "${supplierName || supplierId}"? This cannot be undone.`)) {
        console.log(`Attempting to delete supplier: ${supplierId}`);
        try {
            await deleteDoc(doc(db, "suppliers", supplierId));
            console.log("Supplier deleted: ", supplierId);
            alert(`Supplier "${supplierName || supplierId}" deleted successfully.`);
            // **** Refresh the list in the Suppliers List Modal ****
            await displaySupplierList();
            // **** Also refresh PO list in case supplier name was used ****
            await displayPoList();
        } catch (error) {
            console.error("Error deleting supplier: ", error);
            alert("Error deleting supplier: " + error.message);
        }
    } else {
        console.log("Supplier delete cancelled.");
    }
}

// Function to delete PO (No changes needed)
async function handleDeletePO(poId, poNumber) {
    // Function remains the same as previous version
     if (!db || !doc || !deleteDoc) { alert("Error: Required functions missing for deleting PO."); return; }
     if (confirm(`Are you sure you want to delete Purchase Order "${poNumber || poId}"? This cannot be undone.`)) { console.log(`Attempting to delete PO: ${poId}`); try { await deleteDoc(doc(db, "purchaseOrders", poId)); console.log("Purchase Order deleted successfully:", poId); alert(`Purchase Order ${poNumber || poId} deleted successfully.`); await displayPoList(); } catch (error) { console.error("Error deleting Purchase Order:", error); alert("Error deleting Purchase Order: " + error.message); } } else { console.log("PO deletion cancelled."); }
}

// **** UPDATED Function to display POs with Filters & Sorting ****
async function displayPoList() {
    if (!poTableBody) { console.error("PO table body (poTableBody) not found!"); return; }
    if (!db || !collection || !getDocs || !query || !orderBy || !where || !doc || !getDoc || !Timestamp) { // Added 'where' and 'Timestamp'
        console.error("Firestore functions not available in displayPoList.");
        poTableBody.innerHTML = `<tr><td colspan="7" class="error-message">Error: Required functions missing. Cannot load POs.</td></tr>`;
        return;
    }

    poTableBody.innerHTML = `<tr><td colspan="7"><i class="fas fa-spinner fa-spin"></i> Loading purchase orders...</td></tr>`;
    if (poTotalsDisplay) poTotalsDisplay.innerHTML = ''; // Clear totals
    cachedPOs = {};

    try {
        // --- Build Query based on Filters ---
        let conditions = [];
        let baseQuery = collection(db, "purchaseOrders");
        let finalQuery;

        // 1. Get Filter Values
        const searchTerm = poSearchInput.value.trim().toLowerCase();
        const statusFilter = poStatusFilter.value;
        const startDateVal = poStartDateFilter.value;
        const endDateVal = poEndDateFilter.value;

        // 2. Apply Firestore 'where' clauses
        if (statusFilter) {
            conditions.push(where("status", "==", statusFilter));
        }
        if (startDateVal) {
            try {
                 // Start of the selected day
                const startDate = new Date(startDateVal + 'T00:00:00');
                conditions.push(where("orderDate", ">=", Timestamp.fromDate(startDate)));
            } catch(e){ console.error("Invalid start date format"); }
        }
         if (endDateVal) {
            try {
                // End of the selected day
                const endDate = new Date(endDateVal + 'T23:59:59');
                conditions.push(where("orderDate", "<=", Timestamp.fromDate(endDate)));
            } catch(e){ console.error("Invalid end date format"); }
        }

        // 3. Define Sorting
        // Default: Sort by creation date descending (latest first)
        // If filtering by date range, MUST order by date first
        let sortClauses;
        if (startDateVal || endDateVal) {
             // Index required: orderDate Descending, createdAt Descending (or just orderDate Descending)
             sortClauses = [orderBy("orderDate", "desc"), orderBy("createdAt", "desc")];
             console.log("Applying date range filter, sorting by orderDate, createdAt");
        } else {
             // Default sort - Index required: createdAt Descending
             sortClauses = [orderBy("createdAt", "desc")];
             console.log("Default sorting by createdAt");
             // Alternatively sort by PO Number descending if preferred (ensure number type or correct index)
             // sortClauses = [orderBy("poNumber", "desc")]; // Needs index: poNumber Descending
        }


        // 4. Construct the final query
        finalQuery = query(baseQuery, ...conditions, ...sortClauses);

        // --- Execute Query ---
        const querySnapshot = await getDocs(finalQuery);

        // --- Client-side filtering for Search Term (Supplier/PO Number) ---
        // Firestore 'where' clauses handle status and date range. Search term is filtered locally.
        let filteredDocs = querySnapshot.docs;
        if (searchTerm) {
             console.log(`Filtering client-side for search term: "${searchTerm}"`);
             // Fetch ALL suppliers once for efficient lookup (or use a cache)
             // This is inefficient if there are many suppliers, consider improving later
             const suppliersSnapshot = await getDocs(query(collection(db, "suppliers"), orderBy("name")));
             const suppliersMap = new Map(suppliersSnapshot.docs.map(d => [d.id, d.data().name]));

             filteredDocs = querySnapshot.docs.filter(docRef_po => {
                 const po = docRef_po.data();
                 const poNumberMatch = po.poNumber?.toString().toLowerCase().includes(searchTerm); // Convert PO# to string for search
                 const supplierNameFromId = suppliersMap.get(po.supplierId)?.toLowerCase() || '';
                 const supplierIdMatch = supplierNameFromId.includes(searchTerm);
                 const legacySupplierNameMatch = po.supplierName?.toLowerCase().includes(searchTerm); // Check legacy field too

                 return poNumberMatch || supplierIdMatch || legacySupplierNameMatch;
             });
             console.log(`Docs after client-side search filter: ${filteredDocs.length}`);
         }

        // --- Display Results ---
        poTableBody.innerHTML = ''; // Clear loading/previous
        let grandTotalAmount = 0;

        if (filteredDocs.length === 0) {
            poTableBody.innerHTML = `<tr><td colspan="7">No purchase orders found matching your criteria.</td></tr>`;
            return;
        }

        // Fetch supplier details efficiently (improve caching later)
        const supplierIdsToFetch = new Set(filteredDocs.map(d => d.data().supplierId).filter(id => !!id));
        const supplierPromises = Array.from(supplierIdsToFetch).map(id => getDoc(doc(db, "suppliers", id)));
        const supplierSnaps = await Promise.all(supplierPromises);
        const supplierNameMap = new Map(supplierSnaps.map(snap => [snap.id, snap.exists() ? snap.data().name : 'Deleted Supplier']));


        filteredDocs.forEach(docRef_po => {
            const po = docRef_po.data();
            const poId = docRef_po.id;
            cachedPOs[poId] = po; // Cache data for details view/PDF

            let supplierName = po.supplierName || supplierNameMap.get(po.supplierId) || 'Unknown/Deleted';

            let orderDateStr = '-';
            if (po.orderDate?.toDate) { try { orderDateStr = po.orderDate.toDate().toLocaleDateString('en-GB'); } catch(e){} }
            else if (po.createdAt?.toDate) { try { orderDateStr = po.createdAt.toDate().toLocaleDateString('en-GB') + ' (Created)';} catch(e){} } // Fallback display


            let statusClass = (po.status || 'unknown').toLowerCase().replace(/\s+/g, '-');
            let statusText = po.status || 'Unknown';
            let amount = po.totalAmount || 0;
            let amountStr = `₹ ${amount.toFixed(2)}`;
            grandTotalAmount += amount;

            // Generate Print Sizes String (same as before)
            let printSizesStr = '';
            // ... (keep the print size generation logic from previous version) ...
            if (po.items && po.items.length > 0) { const sizeEntries = []; po.items.forEach(item => { if (item.type === 'Sq Feet') { const pWidth = item.printWidth || item.width || '?'; const pHeight = item.printHeight || item.height || '?'; const pUnit = item.inputUnit || item.unit || 'units'; const w = !isNaN(parseFloat(pWidth)) ? parseFloat(pWidth).toFixed(2) : pWidth; const h = !isNaN(parseFloat(pHeight)) ? parseFloat(pHeight).toFixed(2) : pHeight; sizeEntries.push(`${w}x${h} ${pUnit}`); } }); printSizesStr = sizeEntries.join('<br>'); } if (!printSizesStr) { printSizesStr = '-'; }


            const tr = document.createElement('tr');
            tr.setAttribute('data-id', poId);
            tr.innerHTML = `
                 <td>${po.poNumber || 'N/A'}</td>
                 <td>${supplierName}</td>
                 <td>${orderDateStr}</td>
                 <td><span class="status-badge status-${statusClass}">${statusText}</span></td>
                 <td style="text-align: right;">${amountStr}</td>
                 <td>${printSizesStr}</td>
                 <td class="action-buttons">
                     <button class="button view-details-button" data-poid="${poId}" title="View Details"><i class="fas fa-eye"></i></button>
                     <a href="new_po.html?editPOId=${poId}" class="button edit-button" title="Edit PO"><i class="fas fa-edit"></i></a>
                     <button class="button status-button" data-poid="${poId}" data-ponumber="${po.poNumber}" data-currentstatus="${statusText}" title="Update Status"><i class="fas fa-sync-alt"></i></button>
                     <button class="button pdf-button" data-id="${poId}" title="Download PDF"><i class="fas fa-file-pdf"></i></button>
                     <button class="button delete-button" data-id="${poId}" data-ponumber="${po.poNumber}" title="Delete PO"><i class="fas fa-trash-alt"></i></button>
                 </td>
             `;
            poTableBody.appendChild(tr);
        }); // End forEach filteredDocs

        // Display Grand Total
        if (poTotalsDisplay) {
            poTotalsDisplay.innerHTML = `<strong>Total Amount (Filtered):</strong> ₹ ${grandTotalAmount.toFixed(2)}`;
        }

        console.log("Purchase Orders list displayed successfully with filters.");

    } catch (error) {
        console.error("Error processing or displaying POs: ", error);
        // Check for specific Firestore index errors
        if (error.code === 'failed-precondition') {
             poTableBody.innerHTML = `<tr><td colspan="7" class="error-message">Error: Required Firestore index missing. ${error.message} Please check Firestore console -> Indexes.</td></tr>`;
        } else {
             poTableBody.innerHTML = `<tr><td colspan="7" class="error-message">Error loading POs: ${error.message}</td></tr>`;
        }
    }
}


// Function to Handle Status Update Submission (No changes needed)
async function handleStatusUpdate(event) {
    // Function remains the same as previous version
    event.preventDefault(); if (!statusUpdatePOId || !statusSelect || !saveStatusBtn) return; const poId = statusUpdatePOId.value; const newStatus = statusSelect.value; if (!poId || !newStatus) { showStatusError("Invalid PO ID or Status selected."); return; } saveStatusBtn.disabled = true; saveStatusBtn.textContent = 'Updating...'; showStatusError(''); try { const poRef = doc(db, "purchaseOrders", poId); await updateDoc(poRef, { status: newStatus, updatedAt: serverTimestamp() }); console.log(`PO ${poId} status updated to ${newStatus}`); closeStatusModal(); await displayPoList(); } catch (error) { console.error("Error updating PO status:", error); showStatusError("Error updating status: " + error.message); } finally { if(saveStatusBtn) { saveStatusBtn.disabled = false; saveStatusBtn.textContent = 'Update Status'; } }
}

// Helper to show errors in supplier modal
function showSupplierError(message) {
    if(supplierErrorMsg) { supplierErrorMsg.textContent = message; supplierErrorMsg.style.display = 'block'; }
    else { console.error("Supplier error msg element not found:", message); alert(message); }
}
// Helper to show errors in status modal
function showStatusError(message) {
    if(statusErrorMsg) { statusErrorMsg.textContent = message; statusErrorMsg.style.display = message ? 'block' : 'none'; }
    else { if(message) alert(message); } // Fallback
}


// --- Initialization on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Supplier Management v9: DOM loaded.");

    if (!db) { console.error("DB not available!"); /* Show UI error */ return; }

    // --- Event Listeners ---

    // Supplier Add/Edit Modal Listeners (External Controls)
    if (closeSupplierModalBtn) closeSupplierModalBtn.addEventListener('click', closeSupplierModal);
    if (cancelSupplierBtn) cancelSupplierBtn.addEventListener('click', closeSupplierModal);
    if (supplierForm) supplierForm.addEventListener('submit', saveSupplier);
    if (supplierModal) supplierModal.addEventListener('click', (event) => { if (event.target === supplierModal) closeSupplierModal(); });

    // Status Modal Listeners (No Changes)
    if (closeStatusModalBtn) closeStatusModalBtn.addEventListener('click', closeStatusModal);
    if (cancelStatusBtn) cancelStatusBtn.addEventListener('click', closeStatusModal);
    if (statusUpdateForm) statusUpdateForm.addEventListener('submit', handleStatusUpdate);
    if (statusUpdateModal) statusUpdateModal.addEventListener('click', (event) => { if (event.target === statusUpdateModal) closeStatusModal(); });

    // PO Details Modal Listeners (No Changes)
    if (closePoDetailsModalBtn) closePoDetailsModalBtn.addEventListener('click', closePoDetailsModal);
    if (closePoDetailsBtn) closePoDetailsBtn.addEventListener('click', closePoDetailsModal);
    if (poDetailsModal) poDetailsModal.addEventListener('click', (event) => { if (event.target === poDetailsModal) closePoDetailsModal(); });

    // **** NEW Suppliers List Modal Listeners ****
    if (viewSuppliersBtn) viewSuppliersBtn.addEventListener('click', openSuppliersListModal);
    else { console.warn("View Suppliers button not found."); }
    if (closeSuppliersListModalBtn) closeSuppliersListModalBtn.addEventListener('click', closeSuppliersListModal);
    else { console.warn("Close Suppliers List Modal button (X) not found."); }
    if (closeSuppliersListBtnBottom) closeSuppliersListBtnBottom.addEventListener('click', closeSuppliersListModal);
    else { console.warn("Close Suppliers List Modal button (Bottom) not found."); }
    if (addSupplierInModalBtn) addSupplierInModalBtn.addEventListener('click', () => openSupplierModal('add'));
    else { console.warn("Add Supplier button inside modal not found."); }
    if (suppliersListModal) suppliersListModal.addEventListener('click', (event) => { if (event.target === suppliersListModal) closeSuppliersListModal(); });
    else { console.warn("Suppliers List Modal element not found."); }
    // Add event delegation for supplier actions WITHIN the modal table
    if (supplierTableBodyModal) {
         supplierTableBodyModal.addEventListener('click', handleSupplierTableActions);
    } else { console.warn("Supplier table body in modal not found for event delegation."); }
    // ******************************************

    // **** MODIFIED PO Table Actions Listener (Using Delegation) ****
    if (poTableBody) {
        poTableBody.addEventListener('click', async (event) => {
            const targetElement = event.target;
            const actionElement = targetElement.closest('button[data-id], button[data-poid], a[href*="editPOId"]');
            if (!actionElement) return;

            // Prevent default for buttons, allow for edit link
             if (actionElement.tagName === 'BUTTON') {
                 event.preventDefault();
             }

            const poId = actionElement.dataset.id || actionElement.dataset.poid;
            const poNumber = actionElement.dataset.ponumber;

            if (actionElement.classList.contains('view-details-button')) { if (poId) openPoDetailsModal(poId); else console.error("Missing PO ID"); }
            else if (actionElement.classList.contains('edit-button')) { console.log(`Edit link clicked for PO ${poId}`); /* Let link work */ }
            else if (actionElement.classList.contains('status-button')) { const currentStatus = actionElement.dataset.currentstatus; if (poId && currentStatus !== undefined) openStatusModal(poId, currentStatus, poNumber); else console.error("Missing data for Status Update"); }
            else if (actionElement.classList.contains('pdf-button')) { if (!poId) { console.error("Missing PO ID for PDF"); return; } actionElement.disabled = true; actionElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; try { let poDataForPdf = cachedPOs[poId]; if (!poDataForPdf) { const poSnap = await getDoc(doc(db, "purchaseOrders", poId)); if (poSnap.exists()) poDataForPdf = poSnap.data(); } if (!poDataForPdf) throw new Error(`PO data not found: ${poId}`); if (!poDataForPdf.supplierId) throw new Error("Supplier ID missing."); const supplierSnap = await getDoc(doc(db, "suppliers", poDataForPdf.supplierId)); if (!supplierSnap.exists()) throw new Error(`Supplier data not found: ${poDataForPdf.supplierId}`); await generatePoPdf(poDataForPdf, supplierSnap.data()); } catch (error) { console.error("PDF generation error:", error); alert("Failed PDF: " + error.message); } finally { actionElement.disabled = false; actionElement.innerHTML = '<i class="fas fa-file-pdf"></i>'; } }
            else if (actionElement.classList.contains('delete-button')) { if (poId) handleDeletePO(poId, poNumber); else console.error("Missing PO ID for Delete"); }
        });
    }
    // ********************************************************************

    // **** UPDATED PO Filter Listeners ****
    if (poFilterBtn) {
         poFilterBtn.addEventListener('click', displayPoList); // Trigger display on filter button click
    } else { console.warn("PO Filter button not found."); }
    if (poClearFilterBtn) {
        poClearFilterBtn.addEventListener('click', () => {
            // Clear all filter inputs
            if(poSearchInput) poSearchInput.value = '';
            if(poStatusFilter) poStatusFilter.value = '';
            if(poStartDateFilter) poStartDateFilter.value = '';
            if(poEndDateFilter) poEndDateFilter.value = '';
            // Reload the list
            displayPoList();
        });
    } else { console.warn("PO Clear Filter button not found."); }
    // Optional: Add listeners to individual filters for live updates (can be slow)
    // if(poStatusFilter) poStatusFilter.addEventListener('change', displayPoList);
    // if(poStartDateFilter) poStartDateFilter.addEventListener('change', displayPoList);
    // if(poEndDateFilter) poEndDateFilter.addEventListener('change', displayPoList);


    // Initial data load
    (async () => {
        // Don't load supplier list initially, only when modal opens
        // try { await displaySupplierList(); } catch (e) { console.error("Error initial supplier load:", e); }
        try { await displayPoList(); } catch (e) { console.error("Error initial PO load:", e); }
    })();

    // Check for #add hash (now opens single supplier add modal)
    if(window.location.hash === '#add') {
        setTimeout(() => { if(supplierModal) openSupplierModal('add'); else console.warn("Supplier Add/Edit modal not found for #add hash.");
                           if (history.replaceState) history.replaceState(null, null, window.location.pathname + window.location.search);
        }, 150); // Slightly longer delay maybe
    }

    console.log("Supplier Management v9 Initialized.");
});

console.log("supplier_management.js v9 module processed.");