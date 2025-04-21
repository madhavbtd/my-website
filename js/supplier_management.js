// js/supplier_management.js - v10 (Fixed View PO Details Modal)

import { generatePoPdf } from './utils.js';
import {
    db, auth,
    collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc,
    query, orderBy, where, Timestamp, serverTimestamp
} from './firebase-init.js';

// --- DOM Elements ---
// Action Bar Buttons
const viewSuppliersBtn = document.getElementById('viewSuppliersBtn');
// PO Table & Filters
const poTableBody = document.getElementById('poTableBody');
const poSearchInput = document.getElementById('poSearchInput');
const poStatusFilter = document.getElementById('poStatusFilter');
const poStartDateFilter = document.getElementById('poStartDateFilter');
const poEndDateFilter = document.getElementById('poEndDateFilter');
const poFilterBtn = document.getElementById('poFilterBtn');
const poClearFilterBtn = document.getElementById('poClearFilterBtn');
const poTotalsDisplay = document.getElementById('poTotalsDisplay');

// Supplier Add/Edit Modal
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

// PO Status Update Modal
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

// PO Item Details Modal --- <<<--- Elements for the View Modal
const poDetailsModal = document.getElementById('poDetailsModal');
const poDetailsModalTitle = document.getElementById('poDetailsModalTitle');
const closePoDetailsModalBtn = document.getElementById('closePoDetailsModal');
const closePoDetailsBtn = document.getElementById('closePoDetailsBtn');
const poDetailsContent = document.getElementById('poDetailsContent');
// --- >>> ---

// Suppliers List Modal Elements
const suppliersListModal = document.getElementById('suppliersListModal');
const closeSuppliersListModalBtn = document.getElementById('closeSuppliersListModal');
const addSupplierInModalBtn = document.getElementById('addSupplierInModalBtn');
const supplierTableBodyModal = document.getElementById('supplierTableBodyModal');
const closeSuppliersListBtnBottom = document.getElementById('closeSuppliersListBtnBottom');

// --- Global State ---
let currentEditingSupplierId = null;
let cachedPOs = {};
let suppliersDataCache = [];

// --- Modal Handling ---

// Supplier Add/Edit Modal
function openSupplierModal(mode = 'add', supplierData = null, supplierId = null) {
    // ... (Function remains the same) ...
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
    // ... (Function remains the same) ...
    if (supplierModal) { supplierModal.classList.remove('active'); }
}

// Status Update Modal
function openStatusModal(poId, currentStatus, poNumber) {
    // ... (Function remains the same) ...
     if (!statusUpdateModal || !statusUpdateForm || !statusModalTitle || !statusUpdatePOId || !statusSelect || !currentPOStatusSpan) { console.error("Status update modal elements not found!"); alert("Error: Cannot open status update form."); return; }
     statusUpdateForm.reset(); statusErrorMsg.textContent = ''; statusErrorMsg.style.display = 'none';
     statusModalTitle.textContent = `Update Status for PO #${poNumber || poId}`; statusUpdatePOId.value = poId;
     currentPOStatusSpan.textContent = currentStatus || 'N/A'; statusSelect.value = "";
     const options = statusSelect.options;
     for (let i = 0; i < options.length; i++) { if (options[i].value === currentStatus) { break; } }
     statusUpdateModal.classList.add('active');
}
function closeStatusModal() {
    // ... (Function remains the same) ...
    if (statusUpdateModal) { statusUpdateModal.classList.remove('active'); }
}

// --- <<< NEW/RESTORED FUNCTION FOR VIEW PO DETAILS >>> ---
async function openPoDetailsModal(poId) {
    if (!poDetailsModal || !poDetailsModalTitle || !poDetailsContent) {
        console.error("PO Details modal elements not found!");
        alert("Error: Cannot open PO details.");
        return;
    }
    console.log("Opening PO Details Modal for PO ID:", poId);

    // Show loading state
    poDetailsModalTitle.textContent = `Loading PO Details...`;
    poDetailsContent.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading items...</p>';
    poDetailsModal.classList.add('active');

    try {
        const poRef = doc(db, "purchaseOrders", poId);
        const docSnap = await getDoc(poRef);

        if (docSnap.exists()) {
            const poData = docSnap.data();
            cachedPOs[poId] = poData; // Cache data if needed elsewhere
            console.log("PO Data fetched:", poData);

            poDetailsModalTitle.textContent = `Details for PO #${poData.poNumber || poId}`;

            let itemsHTML = '<p>No items found for this PO.</p>'; // Default if no items
            if (poData.items && poData.items.length > 0) {
                itemsHTML = `
                    <table class="details-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Product Name</th>
                                <th>Type</th>
                                <th>Details (Qty/Size)</th>
                                <th>Rate</th>
                                <th>Party</th>
                                <th>Design</th>
                                <th>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                poData.items.forEach((item, index) => {
                    let detailStr = '';
                    if (item.type === 'Sq Feet') {
                        const w = item.realWidth || item.width || '?';
                        const h = item.realHeight || item.height || '?';
                        const u = item.unit || item.inputUnit || 'units';
                        const pw = item.printWidth || '?';
                        const ph = item.printHeight || '?';
                        const psf = item.printSqFt || '?';
                        detailStr = `W:${w} x H:${h} ${u} (Print: ${pw}x${ph} = ${psf} sqft)`;
                    } else { // Qty
                        detailStr = `Qty: ${item.quantity || '?'}`;
                    }
                    itemsHTML += `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${item.productName || 'N/A'}</td>
                            <td>${item.type || 'N/A'}</td>
                            <td>${detailStr}</td>
                            <td>${item.rate?.toFixed(2) ?? 'N/A'}</td>
                            <td>${item.partyName || '-'}</td>
                            <td>${item.designDetails || '-'}</td>
                            <td>${item.itemAmount?.toFixed(2) ?? 'N/A'}</td>
                        </tr>
                    `;
                });
                itemsHTML += `</tbody></table>`;
            }

            // Add Notes section
            let notesHTML = '';
            if (poData.notes) {
                notesHTML = `
                    <div class="po-notes-details">
                        <strong>Notes:</strong>
                        <p>${poData.notes.replace(/\n/g, '<br>')}</p> 
                    </div>`;
            } else {
                 notesHTML = `
                    <div class="po-notes-details">
                        <strong>Notes:</strong>
                        <p>-</p>
                    </div>`;
            }


            // Update modal content
            poDetailsContent.innerHTML = itemsHTML + notesHTML;

        } else {
            console.error("No such PO document!");
            poDetailsModalTitle.textContent = `Error Loading PO Details`;
            poDetailsContent.innerHTML = `<p class="error-message">Error: Could not find PO with ID: ${poId}</p>`;
        }
    } catch (error) {
        console.error("Error fetching PO details:", error);
        poDetailsModalTitle.textContent = `Error Loading PO Details`;
        poDetailsContent.innerHTML = `<p class="error-message">Error loading details: ${error.message}</p>`;
    }
}
// --- <<< END OF FUNCTION DEFINITION >>> ---

function closePoDetailsModal() {
    // ... (Function remains the same) ...
    if (poDetailsModal) { poDetailsModal.classList.remove('active'); poDetailsContent.innerHTML = ''; }
}

// Suppliers List Modal Handling
function openSuppliersListModal() {
    // ... (Function remains the same) ...
    if (suppliersListModal) {
        suppliersListModal.classList.add('active');
        displaySupplierList();
    } else {
        console.error("Suppliers List Modal element not found!");
    }
}
function closeSuppliersListModal() {
    // ... (Function remains the same) ...
    if (suppliersListModal) { suppliersListModal.classList.remove('active'); }
}

// --- Firestore Operations ---

// Display suppliers IN THE MODAL
async function displaySupplierList() {
    // ... (Function remains the same) ...
    const targetTableBody = supplierTableBodyModal;
    if (!targetTableBody) { console.error("Supplier modal table body not found!"); return; }
    if (!db || !collection || !getDocs || !query || !orderBy) {
        console.error("Firestore functions not available in displaySupplierList.");
        targetTableBody.innerHTML = '<tr><td colspan="5" class="error-message">Error: Cannot load suppliers list.</td></tr>';
        return;
    }
    targetTableBody.innerHTML = '<tr><td colspan="5"><i class="fas fa-spinner fa-spin"></i> Loading suppliers...</td></tr>';
    suppliersDataCache = [];

    try {
        const q = query(collection(db, "suppliers"), orderBy("name"));
        const querySnapshot = await getDocs(q);
        targetTableBody.innerHTML = '';

        if (querySnapshot.empty) {
            targetTableBody.innerHTML = '<tr><td colspan="5">No suppliers found. Click "+ Add New Supplier" above to add one.</td></tr>';
            return;
        }
        querySnapshot.forEach((docSnapshot) => {
            const supplier = docSnapshot.data(); const supplierId = docSnapshot.id;
            suppliersDataCache.push({ id: supplierId, ...supplier });
            const tr = document.createElement('tr'); tr.setAttribute('data-id', supplierId);
            tr.innerHTML = `<td>${supplier.name || 'N/A'}</td><td>${supplier.companyName || '-'}</td><td>${supplier.whatsappNo || '-'}</td><td>${supplier.email || '-'}</td><td class="action-buttons"><button class="button edit-button" data-id="${supplierId}" title="Edit Supplier"><i class="fas fa-edit"></i></button><button class="button delete-button" data-id="${supplierId}" data-name="${supplier.name || ''}" title="Delete Supplier"><i class="fas fa-trash-alt"></i></button></td>`;
            targetTableBody.appendChild(tr);
        });
        console.log("Suppliers list displayed successfully in modal.");
    } catch (error) {
        console.error("Error fetching suppliers: ", error);
        targetTableBody.innerHTML = `<tr><td colspan="5" class="error-message">Error loading suppliers: ${error.message}</td></tr>`;
    }
}

// Handle Supplier Table Actions (Edit/Delete in Modal)
function handleSupplierTableActions(event) {
    // ... (Function remains the same) ...
    const targetButton = event.target.closest('button.edit-button, button.delete-button');
    if (!targetButton) return;
    const supplierId = targetButton.dataset.id; if (!supplierId) { console.error("Supplier ID not found on action button."); return; }
    if (targetButton.classList.contains('edit-button')) {
        const supplierData = suppliersDataCache.find(s => s.id === supplierId);
        if (supplierData) { openSupplierModal('edit', supplierData, supplierId); }
        else { console.warn(`Supplier ${supplierId} not found in cache for edit. Fetching...`); getDoc(doc(db, "suppliers", supplierId)).then(docSnap => { if(docSnap.exists()) { openSupplierModal('edit', docSnap.data(), supplierId); } else { alert(`Error: Could not find supplier ${supplierId} to edit.`); } }).catch(err => { console.error("Error fetching supplier for edit:", err); alert("Error loading supplier details."); }); }
    } else if (targetButton.classList.contains('delete-button')) {
        const supplierName = targetButton.dataset.name || supplierId; deleteSupplier(supplierId, supplierName);
    }
}

// Save/Update Supplier
async function saveSupplier(event) {
    // ... (Function remains the same) ...
    event.preventDefault();
    if (!db || !collection || !addDoc || !doc || !updateDoc || !Timestamp) { showSupplierError("Error: Required functions missing."); return; }
    if (!saveSupplierBtn || !supplierNameInput || !supplierErrorMsg || !supplierIdInput || !supplierCompanyInput || !supplierWhatsappInput || !supplierEmailInput || !supplierAddressInput || !supplierGstInput) { console.error("Save Supplier prerequisites missing."); alert("Error: Cannot save supplier."); return; }
    const supplierData = { name: supplierNameInput.value.trim(), companyName: supplierCompanyInput.value.trim(), whatsappNo: supplierWhatsappInput.value.trim(), email: supplierEmailInput.value.trim(), address: supplierAddressInput.value.trim(), gstNo: supplierGstInput.value.trim(), };
    if (!supplierData.name) { showSupplierError("Supplier Name is required."); supplierNameInput.focus(); return; }
    saveSupplierBtn.disabled = true; saveSupplierBtn.textContent = 'Saving...'; supplierErrorMsg.style.display = 'none'; supplierErrorMsg.textContent = '';
    try { const supplierIdToUse = supplierIdInput.value; if (supplierIdToUse) { supplierData.updatedAt = Timestamp.now(); const supplierRef = doc(db, "suppliers", supplierIdToUse); await updateDoc(supplierRef, supplierData); console.log("Supplier updated with ID: ", supplierIdToUse); } else { supplierData.createdAt = Timestamp.now(); supplierData.updatedAt = Timestamp.now(); const docRef = await addDoc(collection(db, "suppliers"), supplierData); console.log("Supplier added with ID: ", docRef.id); } closeSupplierModal(); await displaySupplierList(); await displayPoList(); } catch (error) { console.error("Error saving supplier: ", error); showSupplierError("Error saving supplier: " + error.message); } finally { if(saveSupplierBtn) { saveSupplierBtn.disabled = false; saveSupplierBtn.textContent = 'Save Supplier'; } }
}

// Delete Supplier
async function deleteSupplier(supplierId, supplierName) {
    // ... (Function remains the same) ...
    if (!db || !doc || !deleteDoc) { alert("Error: Required functions missing for deleting supplier."); return; }
    if (confirm(`Are you sure you want to delete supplier "${supplierName || supplierId}"? This cannot be undone.`)) { console.log(`Attempting to delete supplier: ${supplierId}`); try { await deleteDoc(doc(db, "suppliers", supplierId)); console.log("Supplier deleted: ", supplierId); alert(`Supplier "${supplierName || supplierId}" deleted successfully.`); await displaySupplierList(); await displayPoList(); } catch (error) { console.error("Error deleting supplier: ", error); alert("Error deleting supplier: " + error.message); } } else { console.log("Supplier delete cancelled."); }
}

// Delete PO
async function handleDeletePO(poId, poNumber) {
    // ... (Function remains the same) ...
     if (!db || !doc || !deleteDoc) { alert("Error: Required functions missing for deleting PO."); return; }
     if (confirm(`Are you sure you want to delete Purchase Order "${poNumber || poId}"? This cannot be undone.`)) { console.log(`Attempting to delete PO: ${poId}`); try { await deleteDoc(doc(db, "purchaseOrders", poId)); console.log("Purchase Order deleted successfully:", poId); alert(`Purchase Order ${poNumber || poId} deleted successfully.`); await displayPoList(); } catch (error) { console.error("Error deleting Purchase Order:", error); alert("Error deleting Purchase Order: " + error.message); } } else { console.log("PO deletion cancelled."); }
}

// Display PO List with Filters
async function displayPoList() {
    // ... (Function remains the same) ...
    if (!poTableBody) { console.error("PO table body (poTableBody) not found!"); return; }
    if (!db || !collection || !getDocs || !query || !orderBy || !where || !doc || !getDoc || !Timestamp) { console.error("Firestore functions not available in displayPoList."); poTableBody.innerHTML = `<tr><td colspan="7" class="error-message">Error: Required functions missing. Cannot load POs.</td></tr>`; return; }
    poTableBody.innerHTML = `<tr><td colspan="7"><i class="fas fa-spinner fa-spin"></i> Loading purchase orders...</td></tr>`;
    if (poTotalsDisplay) poTotalsDisplay.innerHTML = ''; cachedPOs = {};
    try { let conditions = []; let baseQuery = collection(db, "purchaseOrders"); let finalQuery; const searchTerm = poSearchInput.value.trim().toLowerCase(); const statusFilter = poStatusFilter.value; const startDateVal = poStartDateFilter.value; const endDateVal = poEndDateFilter.value;
        if (statusFilter) { conditions.push(where("status", "==", statusFilter)); }
        if (startDateVal) { try { const startDate = new Date(startDateVal + 'T00:00:00'); conditions.push(where("orderDate", ">=", Timestamp.fromDate(startDate))); } catch(e){ console.error("Invalid start date format"); } }
        if (endDateVal) { try { const endDate = new Date(endDateVal + 'T23:59:59'); conditions.push(where("orderDate", "<=", Timestamp.fromDate(endDate))); } catch(e){ console.error("Invalid end date format"); } }
        let sortClauses; if (startDateVal || endDateVal) { sortClauses = [orderBy("orderDate", "desc"), orderBy("createdAt", "desc")]; console.log("Applying date range filter, sorting by orderDate, createdAt"); } else { sortClauses = [orderBy("createdAt", "desc")]; console.log("Default sorting by createdAt"); }
        finalQuery = query(baseQuery, ...conditions, ...sortClauses); const querySnapshot = await getDocs(finalQuery); let filteredDocs = querySnapshot.docs;
        if (searchTerm) { console.log(`Filtering client-side for search term: "${searchTerm}"`); const suppliersSnapshot = await getDocs(query(collection(db, "suppliers"), orderBy("name"))); const suppliersMap = new Map(suppliersSnapshot.docs.map(d => [d.id, d.data().name]));
             filteredDocs = querySnapshot.docs.filter(docRef_po => { const po = docRef_po.data(); const poNumberMatch = po.poNumber?.toString().toLowerCase().includes(searchTerm); const supplierNameFromId = suppliersMap.get(po.supplierId)?.toLowerCase() || ''; const supplierIdMatch = supplierNameFromId.includes(searchTerm); const legacySupplierNameMatch = po.supplierName?.toLowerCase().includes(searchTerm); return poNumberMatch || supplierIdMatch || legacySupplierNameMatch; }); console.log(`Docs after client-side search filter: ${filteredDocs.length}`); }
        poTableBody.innerHTML = ''; let grandTotalAmount = 0;
        if (filteredDocs.length === 0) { poTableBody.innerHTML = `<tr><td colspan="7">No purchase orders found matching your criteria.</td></tr>`; return; }
        const supplierIdsToFetch = new Set(filteredDocs.map(d => d.data().supplierId).filter(id => !!id)); const supplierPromises = Array.from(supplierIdsToFetch).map(id => getDoc(doc(db, "suppliers", id))); const supplierSnaps = await Promise.all(supplierPromises); const supplierNameMap = new Map(supplierSnaps.map(snap => [snap.id, snap.exists() ? snap.data().name : 'Deleted Supplier']));
        filteredDocs.forEach(docRef_po => { const po = docRef_po.data(); const poId = docRef_po.id; cachedPOs[poId] = po; let supplierName = po.supplierName || supplierNameMap.get(po.supplierId) || 'Unknown/Deleted'; let orderDateStr = '-'; if (po.orderDate?.toDate) { try { orderDateStr = po.orderDate.toDate().toLocaleDateString('en-GB'); } catch(e){} } else if (po.createdAt?.toDate) { try { orderDateStr = po.createdAt.toDate().toLocaleDateString('en-GB') + ' (Created)';} catch(e){} }
            let statusClass = (po.status || 'unknown').toLowerCase().replace(/\s+/g, '-'); let statusText = po.status || 'Unknown'; let amount = po.totalAmount || 0; let amountStr = `₹ ${amount.toFixed(2)}`; grandTotalAmount += amount;
            let printSizesStr = ''; if (po.items && po.items.length > 0) { const sizeEntries = []; po.items.forEach(item => { if (item.type === 'Sq Feet') { const pWidth = item.printWidth || item.width || '?'; const pHeight = item.printHeight || item.height || '?'; const pUnit = item.inputUnit || item.unit || 'units'; const w = !isNaN(parseFloat(pWidth)) ? parseFloat(pWidth).toFixed(2) : pWidth; const h = !isNaN(parseFloat(pHeight)) ? parseFloat(pHeight).toFixed(2) : pHeight; sizeEntries.push(`${w}x${h} ${pUnit}`); } }); printSizesStr = sizeEntries.join('<br>'); } if (!printSizesStr) { printSizesStr = '-'; }
            const tr = document.createElement('tr'); tr.setAttribute('data-id', poId);
            tr.innerHTML = `<td>${po.poNumber || 'N/A'}</td><td>${supplierName}</td><td>${orderDateStr}</td><td><span class="status-badge status-${statusClass}">${statusText}</span></td><td style="text-align: right;">${amountStr}</td><td>${printSizesStr}</td><td class="action-buttons"><button class="button view-details-button" data-poid="${poId}" title="View Details"><i class="fas fa-eye"></i></button><a href="new_po.html?editPOId=${poId}" class="button edit-button" title="Edit PO"><i class="fas fa-edit"></i></a><button class="button status-button" data-poid="${poId}" data-ponumber="${po.poNumber}" data-currentstatus="${statusText}" title="Update Status"><i class="fas fa-sync-alt"></i></button><button class="button pdf-button" data-id="${poId}" title="Download PDF"><i class="fas fa-file-pdf"></i></button><button class="button delete-button" data-id="${poId}" data-ponumber="${po.poNumber}" title="Delete PO"><i class="fas fa-trash-alt"></i></button></td>`;
            poTableBody.appendChild(tr); });
        if (poTotalsDisplay) { poTotalsDisplay.innerHTML = `<strong>Total Amount (Filtered):</strong> ₹ ${grandTotalAmount.toFixed(2)}`; }
        console.log("Purchase Orders list displayed successfully with filters.");
    } catch (error) { console.error("Error processing or displaying POs: ", error); if (error.code === 'failed-precondition') { poTableBody.innerHTML = `<tr><td colspan="7" class="error-message">Error: Required Firestore index missing. ${error.message} Please check Firestore console -> Indexes.</td></tr>`; } else { poTableBody.innerHTML = `<tr><td colspan="7" class="error-message">Error loading POs: ${error.message}</td></tr>`; } }
}

// Handle Status Update Submission
async function handleStatusUpdate(event) {
    // ... (Function remains the same) ...
    event.preventDefault(); if (!statusUpdatePOId || !statusSelect || !saveStatusBtn) return; const poId = statusUpdatePOId.value; const newStatus = statusSelect.value; if (!poId || !newStatus) { showStatusError("Invalid PO ID or Status selected."); return; } saveStatusBtn.disabled = true; saveStatusBtn.textContent = 'Updating...'; showStatusError(''); try { const poRef = doc(db, "purchaseOrders", poId); await updateDoc(poRef, { status: newStatus, updatedAt: serverTimestamp() }); console.log(`PO ${poId} status updated to ${newStatus}`); closeStatusModal(); await displayPoList(); } catch (error) { console.error("Error updating PO status:", error); showStatusError("Error updating status: " + error.message); } finally { if(saveStatusBtn) { saveStatusBtn.disabled = false; saveStatusBtn.textContent = 'Update Status'; } }
}

// Helper to show errors in supplier modal
function showSupplierError(message) {
    // ... (Function remains the same) ...
    if(supplierErrorMsg) { supplierErrorMsg.textContent = message; supplierErrorMsg.style.display = 'block'; } else { console.error("Supplier error msg element not found:", message); alert(message); }
}
// Helper to show errors in status modal
function showStatusError(message) {
    // ... (Function remains the same) ...
    if(statusErrorMsg) { statusErrorMsg.textContent = message; statusErrorMsg.style.display = message ? 'block' : 'none'; } else { if(message) alert(message); }
}

// --- Initialization on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Supplier Management v10: DOM loaded.");
    if (!db) { console.error("DB not available!"); return; }

    // Supplier Add/Edit Modal Listeners
    if (closeSupplierModalBtn) closeSupplierModalBtn.addEventListener('click', closeSupplierModal);
    if (cancelSupplierBtn) cancelSupplierBtn.addEventListener('click', closeSupplierModal);
    if (supplierForm) supplierForm.addEventListener('submit', saveSupplier);
    if (supplierModal) supplierModal.addEventListener('click', (event) => { if (event.target === supplierModal) closeSupplierModal(); });

    // Status Modal Listeners
    if (closeStatusModalBtn) closeStatusModalBtn.addEventListener('click', closeStatusModal);
    if (cancelStatusBtn) cancelStatusBtn.addEventListener('click', closeStatusModal);
    if (statusUpdateForm) statusUpdateForm.addEventListener('submit', handleStatusUpdate);
    if (statusUpdateModal) statusUpdateModal.addEventListener('click', (event) => { if (event.target === statusUpdateModal) closeStatusModal(); });

    // PO Details Modal Listeners --- <<< --- Added close listeners
    if (closePoDetailsModalBtn) closePoDetailsModalBtn.addEventListener('click', closePoDetailsModal);
    if (closePoDetailsBtn) closePoDetailsBtn.addEventListener('click', closePoDetailsModal);
    if (poDetailsModal) poDetailsModal.addEventListener('click', (event) => { if (event.target === poDetailsModal) closePoDetailsModal(); });
    // --- >>> ---

    // Suppliers List Modal Listeners
    if (viewSuppliersBtn) viewSuppliersBtn.addEventListener('click', openSuppliersListModal); else { console.warn("View Suppliers button not found."); }
    if (closeSuppliersListModalBtn) closeSuppliersListModalBtn.addEventListener('click', closeSuppliersListModal); else { console.warn("Close Suppliers List Modal button (X) not found."); }
    if (closeSuppliersListBtnBottom) closeSuppliersListBtnBottom.addEventListener('click', closeSuppliersListModal); else { console.warn("Close Suppliers List Modal button (Bottom) not found."); }
    if (addSupplierInModalBtn) addSupplierInModalBtn.addEventListener('click', () => openSupplierModal('add')); else { console.warn("Add Supplier button inside modal not found."); }
    if (suppliersListModal) suppliersListModal.addEventListener('click', (event) => { if (event.target === suppliersListModal) closeSuppliersListModal(); }); else { console.warn("Suppliers List Modal element not found."); }
    if (supplierTableBodyModal) { supplierTableBodyModal.addEventListener('click', handleSupplierTableActions); } else { console.warn("Supplier table body in modal not found for event delegation."); }

    // PO Table Actions Listener (Delegation) --- <<< --- Corrected to include View button call
    if (poTableBody) {
        poTableBody.addEventListener('click', async (event) => {
            const targetElement = event.target;
            const actionElement = targetElement.closest('button[data-id], button[data-poid], a[href*="editPOId"]'); // Check for data-poid specifically for view
            if (!actionElement) return;

            if (actionElement.tagName === 'BUTTON') { event.preventDefault(); }

            const poId = actionElement.dataset.id || actionElement.dataset.poid; // Get PO ID from either data-id or data-poid
            const poNumber = actionElement.dataset.ponumber;

            // --- Check which button was clicked ---
            if (actionElement.classList.contains('view-details-button')) {
                if (poId) {
                    openPoDetailsModal(poId); // Call the function
                } else {
                    console.error("Missing PO ID for View Details");
                }
            }
            else if (actionElement.classList.contains('edit-button')) {
                // This is an anchor tag, let default behavior work
                console.log(`Edit link clicked for PO ${poId || actionElement.href}`);
            }
            else if (actionElement.classList.contains('status-button')) {
                const currentStatus = actionElement.dataset.currentstatus;
                if (poId && currentStatus !== undefined) {
                    openStatusModal(poId, currentStatus, poNumber);
                } else {
                    console.error("Missing data for Status Update");
                }
            }
            else if (actionElement.classList.contains('pdf-button')) {
                if (!poId) { console.error("Missing PO ID for PDF"); return; }
                actionElement.disabled = true; actionElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                try { /* ... PDF generation logic ... */
                    let poDataForPdf = cachedPOs[poId];
                    if (!poDataForPdf) { const poSnap = await getDoc(doc(db, "purchaseOrders", poId)); if (poSnap.exists()) poDataForPdf = poSnap.data(); }
                    if (!poDataForPdf) throw new Error(`PO data not found: ${poId}`);
                    if (!poDataForPdf.supplierId) throw new Error("Supplier ID missing.");
                    const supplierSnap = await getDoc(doc(db, "suppliers", poDataForPdf.supplierId));
                    if (!supplierSnap.exists()) throw new Error(`Supplier data not found: ${poDataForPdf.supplierId}`);
                    await generatePoPdf(poDataForPdf, supplierSnap.data());
                } catch (error) { console.error("PDF generation error:", error); alert("Failed PDF: " + error.message); }
                finally { actionElement.disabled = false; actionElement.innerHTML = '<i class="fas fa-file-pdf"></i>'; }
            }
            else if (actionElement.classList.contains('delete-button')) {
                if (poId) {
                    handleDeletePO(poId, poNumber);
                } else {
                    console.error("Missing PO ID for Delete");
                }
            }
        });
    }
    // --- >>> ---

    // PO Filter Listeners
    if (poFilterBtn) { poFilterBtn.addEventListener('click', displayPoList); } else { console.warn("PO Filter button not found."); }
    if (poClearFilterBtn) {
        poClearFilterBtn.addEventListener('click', () => {
            if(poSearchInput) poSearchInput.value = ''; if(poStatusFilter) poStatusFilter.value = ''; if(poStartDateFilter) poStartDateFilter.value = ''; if(poEndDateFilter) poEndDateFilter.value = '';
            displayPoList();
        });
    } else { console.warn("PO Clear Filter button not found."); }

    // Initial data load
    (async () => { try { await displayPoList(); } catch (e) { console.error("Error initial PO load:", e); } })();

    // Check for #add hash
    if(window.location.hash === '#add') { setTimeout(() => { if(supplierModal) openSupplierModal('add'); else console.warn("Supplier Add/Edit modal not found for #add hash."); if (history.replaceState) history.replaceState(null, null, window.location.pathname + window.location.search); }, 150); }

    console.log("Supplier Management v10 Initialized.");
});

console.log("supplier_management.js v10 module processed.");