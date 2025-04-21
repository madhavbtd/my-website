// js/supplier_management.js - v7 (Status Update Feature Added)

// Import PDF function
import { generatePoPdf } from './utils.js';

// Import from firebase-init.js
import {
    db, auth, // Ensure auth is imported if needed elsewhere, though not directly used here
    collection, onSnapshot, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc,
    query, orderBy, where, Timestamp, serverTimestamp
} from './firebase-init.js';

// --- DOM Elements ---
const addSupplierBtn = document.getElementById('addSupplierBtn');
const supplierTableBody = document.getElementById('supplierTableBody');
const poTableBody = document.getElementById('poTableBody');

// Supplier Modal Elements
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

// PO Filter Elements
const poSearchInput = document.getElementById('poSearchInput');
const poStatusFilter = document.getElementById('poStatusFilter');
const poFilterBtn = document.getElementById('poFilterBtn');

// **** NEW Status Update Modal Elements ****
const statusUpdateModal = document.getElementById('statusUpdateModal');
const statusModalTitle = document.getElementById('statusModalTitle');
const closeStatusModalBtn = document.getElementById('closeStatusModal');
const cancelStatusBtn = document.getElementById('cancelStatusBtn');
const saveStatusBtn = document.getElementById('saveStatusBtn');
const statusUpdateForm = document.getElementById('statusUpdateForm');
const statusUpdatePOId = document.getElementById('statusUpdatePOId');
const currentPOStatusSpan = document.getElementById('currentPOStatus'); // Span to show current status
const statusSelect = document.getElementById('statusSelect');
const statusErrorMsg = document.getElementById('statusErrorMsg');
// ***************************************

let currentEditingSupplierId = null;

// --- Supplier Modal Handling (Keep existing functions openSupplierModal, closeSupplierModal) ---
function openSupplierModal(mode = 'add', supplierData = null, supplierId = null) {
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

// --- **** NEW Status Modal Handling **** ---
function openStatusModal(poId, currentStatus, poNumber) {
     if (!statusUpdateModal || !statusUpdateForm || !statusModalTitle || !statusUpdatePOId || !statusSelect || !currentPOStatusSpan) {
        console.error("Status update modal elements not found!"); alert("Error: Cannot open status update form."); return;
     }
     statusUpdateForm.reset();
     statusErrorMsg.textContent = '';
     statusErrorMsg.style.display = 'none';

     statusModalTitle.textContent = `Update Status for PO #${poNumber || poId}`;
     statusUpdatePOId.value = poId;
     currentPOStatusSpan.textContent = currentStatus || 'N/A';
     statusSelect.value = ""; // Reset selection

     // Pre-select the current status in the dropdown if it exists
     const options = statusSelect.options;
     for (let i = 0; i < options.length; i++) {
         if (options[i].value === currentStatus) {
             // statusSelect.value = currentStatus; // Optionally pre-select
             break;
         }
     }

     statusUpdateModal.classList.add('active');
}

function closeStatusModal() {
    if (statusUpdateModal) {
        statusUpdateModal.classList.remove('active');
    }
}
// ****************************************

// --- Firestore Operations ---

// Function to display suppliers (Keep existing function displaySupplierList)
async function displaySupplierList() {
    if (!supplierTableBody) { console.error("Supplier table body not found!"); return; }
    if (!db || !collection || !getDocs || !query || !orderBy) {
        console.error("Firestore functions not available in displaySupplierList.");
        supplierTableBody.innerHTML = '<tr><td colspan="5" class="error-message">Error: Cannot load suppliers.</td></tr>'; return;
    }
    supplierTableBody.innerHTML = '<tr><td colspan="5"><i class="fas fa-spinner fa-spin"></i> Loading suppliers...</td></tr>';
    try {
        const q = query(collection(db, "suppliers"), orderBy("name"));
        const querySnapshot = await getDocs(q);
        supplierTableBody.innerHTML = '';
        if (querySnapshot.empty) {
            supplierTableBody.innerHTML = '<tr><td colspan="5">No suppliers found. Add one using the button above!</td></tr>'; return;
        }
        querySnapshot.forEach((docSnapshot) => {
            const supplier = docSnapshot.data(); const supplierId = docSnapshot.id;
            const tr = document.createElement('tr'); tr.setAttribute('data-id', supplierId);
            tr.innerHTML = `
                <td>${supplier.name || 'N/A'}</td>
                <td>${supplier.companyName || '-'}</td>
                <td>${supplier.whatsappNo || '-'}</td>
                <td>${supplier.email || '-'}</td>
                <td class="action-buttons">
                    <button class="button edit-button" data-id="${supplierId}" title="Edit Supplier"><i class="fas fa-edit"></i></button>
                    <button class="button delete-button" data-name="${supplier.name || ''}" data-id="${supplierId}" title="Delete Supplier"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
            const editBtn = tr.querySelector('.edit-button');
            if (editBtn) { editBtn.addEventListener('click', () => openSupplierModal('edit', supplier, supplierId)); }
            const deleteBtn = tr.querySelector('.delete-button');
            if (deleteBtn) { deleteBtn.addEventListener('click', () => deleteSupplier(supplierId, deleteBtn.dataset.name)); }
            supplierTableBody.appendChild(tr);
        });
        console.log("Suppliers list displayed successfully.");
    } catch (error) {
        console.error("Error fetching suppliers: ", error);
        supplierTableBody.innerHTML = `<tr><td colspan="5" class="error-message">Error loading suppliers: ${error.message}</td></tr>`;
    }
}

// Function to save/update supplier (Keep existing function saveSupplier)
async function saveSupplier(event) {
    event.preventDefault();
    if (!db || !collection || !addDoc || !doc || !updateDoc || !Timestamp) { showSupplierError("Error: Required functions missing."); return; }
    if (!saveSupplierBtn || !supplierNameInput || !supplierErrorMsg || !supplierIdInput || !supplierCompanyInput || !supplierWhatsappInput || !supplierEmailInput || !supplierAddressInput || !supplierGstInput) {
         console.error("Save Supplier prerequisites missing (DOM Elements)."); alert("Error: Cannot save supplier."); return;
    }
    const supplierData = {
        name: supplierNameInput.value.trim(), companyName: supplierCompanyInput.value.trim(),
        whatsappNo: supplierWhatsappInput.value.trim(), email: supplierEmailInput.value.trim(),
        address: supplierAddressInput.value.trim(), gstNo: supplierGstInput.value.trim(),
    };
    if (!supplierData.name) { showSupplierError("Supplier Name is required."); supplierNameInput.focus(); return; }
    saveSupplierBtn.disabled = true; saveSupplierBtn.textContent = 'Saving...';
    supplierErrorMsg.style.display = 'none'; supplierErrorMsg.textContent = '';
    try {
        const supplierIdToUse = supplierIdInput.value;
        if (supplierIdToUse) {
            supplierData.updatedAt = Timestamp.now();
            const supplierRef = doc(db, "suppliers", supplierIdToUse);
            await updateDoc(supplierRef, supplierData);
            console.log("Supplier updated with ID: ", supplierIdToUse);
        } else {
            supplierData.createdAt = Timestamp.now(); supplierData.updatedAt = Timestamp.now();
            const docRef = await addDoc(collection(db, "suppliers"), supplierData);
            console.log("Supplier added with ID: ", docRef.id);
        }
        closeSupplierModal(); await displaySupplierList();
    } catch (error) {
        console.error("Error saving supplier: ", error); showSupplierError("Error saving supplier: " + error.message);
    } finally {
        if(saveSupplierBtn) { saveSupplierBtn.disabled = false; saveSupplierBtn.textContent = 'Save Supplier'; }
    }
}

// Function to delete supplier (Keep existing function deleteSupplier)
async function deleteSupplier(supplierId, supplierName) {
    if (!db || !doc || !deleteDoc) { alert("Error: Required functions missing for deleting supplier."); return; }
    if (confirm(`Are you sure you want to delete supplier "${supplierName || supplierId}"? This cannot be undone.`)) {
        console.log(`Attempting to delete supplier: ${supplierId}`);
        try {
            await deleteDoc(doc(db, "suppliers", supplierId));
            console.log("Supplier deleted: ", supplierId); alert(`Supplier "${supplierName || supplierId}" deleted successfully.`);
            await displaySupplierList();
        } catch (error) { console.error("Error deleting supplier: ", error); alert("Error deleting supplier: " + error.message); }
    } else { console.log("Supplier delete cancelled."); }
}

// Function to delete PO (Keep existing function handleDeletePO)
async function handleDeletePO(poId, poNumber) {
     if (!db || !doc || !deleteDoc) { alert("Error: Required functions missing for deleting PO."); return; }
     if (confirm(`Are you sure you want to delete Purchase Order "${poNumber || poId}"? This cannot be undone.`)) {
         console.log(`Attempting to delete PO: ${poId}`);
         try {
             await deleteDoc(doc(db, "purchaseOrders", poId));
             console.log("Purchase Order deleted successfully:", poId); alert(`Purchase Order ${poNumber || poId} deleted successfully.`);
             await displayPoList(); // Refresh PO list
         } catch (error) { console.error("Error deleting Purchase Order:", error); alert("Error deleting Purchase Order: " + error.message); }
     } else { console.log("PO deletion cancelled."); }
}

// **** MODIFIED Function to display POs ****
async function displayPoList() {
    if (!poTableBody) { console.error("PO table body (poTableBody) not found!"); return; }
    if (!db || !collection || !getDocs || !query || !orderBy || !doc || !getDoc || !deleteDoc || !updateDoc) { // Added updateDoc check
        console.error("Firestore functions not available in displayPoList.");
        poTableBody.innerHTML = '<tr><td colspan="6" class="error-message">Error: Required functions missing. Cannot load POs.</td></tr>'; return; // Adjusted colspan
    }

    poTableBody.innerHTML = '<tr><td colspan="6"><i class="fas fa-spinner fa-spin"></i> Loading purchase orders...</td></tr>'; // Adjusted colspan
    try {
        // TODO: Apply filtering based on poSearchInput and poStatusFilter values
        // For now, fetch all, ordered by date
        const q = query(collection(db, "purchaseOrders"), orderBy("orderDate", "desc"));
        const querySnapshot = await getDocs(q);
        poTableBody.innerHTML = '';
        if (querySnapshot.empty) {
            poTableBody.innerHTML = '<tr><td colspan="6">No purchase orders found. Create one first!</td></tr>'; return; // Adjusted colspan
        }

        const poPromises = querySnapshot.docs.map(async (docRef_po) => {
            const po = docRef_po.data(); const poId = docRef_po.id;
            let supplierName = 'Unknown Supplier';
            if (po.supplierId) {
                try {
                    const supplierSnap = await getDoc(doc(db, "suppliers", po.supplierId));
                    if (supplierSnap.exists()) { supplierName = supplierSnap.data().name || 'N/A'; }
                    else { console.warn(`Supplier doc not found for ID: ${po.supplierId} in PO ${poId}`); }
                } catch (err) { console.error(`Error fetching supplier ${po.supplierId}:`, err); supplierName = 'Error'; }
            } else { supplierName = po.supplierName || 'N/A (Legacy)'; }

            let orderDateStr = '-';
            if (po.orderDate?.toDate) { try { orderDateStr = po.orderDate.toDate().toLocaleDateString('en-GB'); } catch(e){} }

            // Normalize status for CSS class (lowercase, replace space with dash)
            let statusClass = (po.status || 'unknown').toLowerCase().replace(/\s+/g, '-');
            let statusText = po.status || 'Unknown';
            let amountStr = po.totalAmount !== undefined ? `₹ ${po.totalAmount.toFixed(2)}` : '-';

            return {
                id: poId, poNumber: po.poNumber || 'N/A', supplierName: supplierName,
                orderDate: orderDateStr, status: statusText, statusClass: statusClass,
                amount: amountStr, poData: po
            };
        });

        const posData = await Promise.all(poPromises);

        posData.forEach(poInfo => {
             const tr = document.createElement('tr'); tr.setAttribute('data-id', poInfo.id);
             tr.innerHTML = `
                 <td>${poInfo.poNumber}</td>
                 <td>${poInfo.supplierName}</td>
                 <td>${poInfo.orderDate}</td>
                 <td><span class="status-badge status-${poInfo.statusClass}">${poInfo.status}</span></td>
                 <td style="text-align: right;">${poInfo.amount}</td>
                 <td class="action-buttons">
                     <a href="new_po.html?editPOId=${poInfo.id}" class="button edit-button" title="Edit PO"><i class="fas fa-edit"></i></a>
                     <button class="button status-button" data-poid="${poInfo.id}" data-ponumber="${poInfo.poNumber}" data-currentstatus="${poInfo.status}" title="Update Status"><i class="fas fa-sync-alt"></i></button>
                     <button class="button pdf-button" data-id="${poInfo.id}" title="Download PDF"><i class="fas fa-file-pdf"></i></button>
                     <button class="button delete-button" data-id="${poInfo.id}" data-ponumber="${poInfo.poNumber}" title="Delete PO"><i class="fas fa-trash-alt"></i></button>
                 </td>
             `;

             // PO Delete Button Listener
             const deletePoBtn = tr.querySelector('.delete-button[title="Delete PO"]');
             if (deletePoBtn) { deletePoBtn.addEventListener('click', () => handleDeletePO(poInfo.id, poInfo.poNumber)); }

             // PDF Button Listener
             const pdfBtn = tr.querySelector('.pdf-button');
             if (pdfBtn) {
                 pdfBtn.addEventListener('click', async () => { /* Keep existing PDF logic */
                    if (typeof generatePoPdf !== 'function') { console.error("generatePoPdf function not imported."); alert("PDF Function not found."); return; }
                    pdfBtn.disabled = true; pdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    try {
                         const poDataForPdf = poInfo.poData;
                         if (!poDataForPdf?.supplierId) throw new Error("Supplier ID missing for PDF.");
                         const supplierSnap = await getDoc(doc(db, "suppliers", poDataForPdf.supplierId));
                         if (!supplierSnap.exists()) throw new Error(`Supplier data not found: ${poDataForPdf.supplierId}`);
                         await generatePoPdf(poDataForPdf, supplierSnap.data());
                    } catch (error) { console.error("Error generating PDF:", error); alert("Failed to generate PDF: " + error.message);
                    } finally {
                         const latestPdfBtn = poTableBody.querySelector(`tr[data-id="${poInfo.id}"] .pdf-button`);
                         if(latestPdfBtn) { latestPdfBtn.disabled = false; latestPdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i>'; }
                    }
                 });
             } // End PDF Button Listener

             // **** NEW Status Button Listener ****
             const statusBtn = tr.querySelector('.status-button');
             if (statusBtn) {
                 statusBtn.addEventListener('click', () => {
                     openStatusModal(statusBtn.dataset.poid, statusBtn.dataset.currentstatus, statusBtn.dataset.ponumber);
                 });
             }
             // ********************************

             poTableBody.appendChild(tr);
        }); // End forEach posData

        console.log("Purchase Orders list displayed successfully.");

    } catch (error) {
        console.error("Error processing or displaying POs: ", error);
        poTableBody.innerHTML = `<tr><td colspan="6" class="error-message">Error loading POs: ${error.message}</td></tr>`; // Adjusted colspan
    }
}

// **** NEW Function to Handle Status Update Submission ****
async function handleStatusUpdate(event) {
    event.preventDefault();
    if (!statusUpdatePOId || !statusSelect || !saveStatusBtn) return; // Basic check

    const poId = statusUpdatePOId.value;
    const newStatus = statusSelect.value;

    if (!poId || !newStatus) {
        showStatusError("Invalid PO ID or Status selected.");
        return;
    }

    saveStatusBtn.disabled = true;
    saveStatusBtn.textContent = 'Updating...';
    showStatusError(''); // Clear previous errors

    try {
        const poRef = doc(db, "purchaseOrders", poId);
        await updateDoc(poRef, {
            status: newStatus,
            updatedAt: serverTimestamp() // Also update the timestamp
        });

        console.log(`PO ${poId} status updated to ${newStatus}`);
        alert(`PO status updated successfully to "${newStatus}"!`);
        closeStatusModal();
        await displayPoList(); // Refresh the list to show the change

    } catch (error) {
        console.error("Error updating PO status:", error);
        showStatusError("Error updating status: " + error.message);
    } finally {
        // Ensure button is re-enabled
        if(saveStatusBtn) {
             saveStatusBtn.disabled = false;
             saveStatusBtn.textContent = 'Update Status';
        }
    }
}

// Helper to show errors in supplier modal
function showSupplierError(message) {
    if(supplierErrorMsg) { supplierErrorMsg.textContent = message; supplierErrorMsg.style.display = 'block'; }
    else { console.error("Supplier error msg element not found:", message); alert(message); }
}
// **** NEW Helper to show errors in status modal ****
function showStatusError(message) {
    if(statusErrorMsg) { statusErrorMsg.textContent = message; statusErrorMsg.style.display = message ? 'block' : 'none'; }
    else { if(message) alert(message); } // Fallback
}

// --- Initialization on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Supplier Management: DOM loaded. Initializing.");

    if (!db) {
        console.error("Supplier Management Init: DB not available! Check firebase-init.js.");
        if(supplierTableBody) supplierTableBody.innerHTML = '<tr><td colspan="5" class="error-message"><strong>Init Error:</strong> DB connection failed.</td></tr>';
        if(poTableBody) poTableBody.innerHTML = '<tr><td colspan="6" class="error-message"><strong>Init Error:</strong> DB connection failed.</td></tr>'; // Adjusted colspan
        return;
    }
    console.log("Supplier Management: DB connection confirmed.");

    // Setup Event Listeners
    if (addSupplierBtn) { addSupplierBtn.addEventListener('click', () => openSupplierModal('add')); }
    else { console.warn("Add Supplier button not found."); }
    if (closeSupplierModalBtn) { closeSupplierModalBtn.addEventListener('click', closeSupplierModal); }
    else { console.warn("Close Supplier Modal button not found."); }
    if (cancelSupplierBtn) { cancelSupplierBtn.addEventListener('click', closeSupplierModal); }
    else { console.warn("Cancel Supplier button not found."); }
    if (supplierForm) { supplierForm.addEventListener('submit', saveSupplier); }
    else { console.warn("Supplier form not found."); }
    if (supplierModal) { supplierModal.addEventListener('click', (event) => { if (event.target === supplierModal) closeSupplierModal(); }); }
    else { console.warn("Supplier modal not found."); }

    // **** NEW Status Modal Listeners ****
    if (closeStatusModalBtn) { closeStatusModalBtn.addEventListener('click', closeStatusModal); }
    else { console.warn("Close Status Modal button not found."); }
    if (cancelStatusBtn) { cancelStatusBtn.addEventListener('click', closeStatusModal); }
    else { console.warn("Cancel Status button not found."); }
    if (statusUpdateForm) { statusUpdateForm.addEventListener('submit', handleStatusUpdate); }
    else { console.warn("Status update form not found."); }
    if (statusUpdateModal) { statusUpdateModal.addEventListener('click', (event) => { if (event.target === statusUpdateModal) closeStatusModal(); }); }
    else { console.warn("Status update modal not found."); }
    // *********************************

    // PO Filter Listener (Example - adapt if needed)
    if (poFilterBtn) {
         poFilterBtn.addEventListener('click', displayPoList); // Re-run display on filter click
         // Add listeners to input/select for real-time filtering if desired
    }


    // Initial data load
    (async () => {
        try { await displaySupplierList(); } catch (e) { console.error("Error initial supplier load:", e); }
        try { await displayPoList(); } catch (e) { console.error("Error initial PO load:", e); }
    })();

    // Check for #add hash
    if(window.location.hash === '#add') {
        setTimeout(() => { if(supplierModal) openSupplierModal('add'); else console.warn("Modal not found for #add hash.");
                           if (history.replaceState) history.replaceState(null, null, window.location.pathname + window.location.search);
        }, 100);
    }

    console.log("Supplier Management Initialized via DOMContentLoaded.");
});

console.log("supplier_management.js module processed.");