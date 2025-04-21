// js/supplier_management.js - v8 (View Details Modal Added)

// Import PDF function
import { generatePoPdf } from './utils.js';

// Import from firebase-init.js
import {
    db, auth,
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

// Status Update Modal Elements
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

// **** नया PO विवरण Modal Elements ****
const poDetailsModal = document.getElementById('poDetailsModal');
const poDetailsModalTitle = document.getElementById('poDetailsModalTitle');
const closePoDetailsModalBtn = document.getElementById('closePoDetailsModal'); // Modal के कोने वाला X बटन
const closePoDetailsBtn = document.getElementById('closePoDetailsBtn');     // नीचे वाला Close बटन
const poDetailsContent = document.getElementById('poDetailsContent');
// ***************************************

let currentEditingSupplierId = null;
let cachedPOs = {}; // PO डेटा को कैश करने के लिए ऑब्जेक्ट

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

// --- **** Status Modal Handling **** ---
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

// --- **** नया PO विवरण Modal Handling **** ---
function openPoDetailsModal(poId) {
    if (!poDetailsModal || !poDetailsModalTitle || !poDetailsContent) {
        console.error("PO Details modal elements not found!");
        alert("Error: Cannot open PO details.");
        return;
    }

    poDetailsModalTitle.textContent = `Loading PO Details...`;
    poDetailsContent.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading items...</p>';
    poDetailsModal.classList.add('active');

    // Firestore से विशिष्ट PO का पूरा डेटा प्राप्त करें
    const poRef = doc(db, "purchaseOrders", poId);
    getDoc(poRef).then(docSnap => {
        if (docSnap.exists()) {
            const poData = docSnap.data();
            cachedPOs[poId] = poData; // कैश अपडेट करें या पॉप्युलेट करें
            poDetailsModalTitle.textContent = `Details for PO #${poData.poNumber || poId}`;

            if (poData.items && poData.items.length > 0) {
                let itemsHtml = '<table class="details-table">'; // विवरण दिखाने के लिए टेबल का उपयोग करें
                itemsHtml += `<thead>
                                <tr>
                                    <th>#</th>
                                    <th>Product</th>
                                    <th>Type</th>
                                    <th>Dimensions/Qty</th>
                                    <th>Unit/Rate</th>
                                    <th>Party</th>
                                    <th>Design</th>
                                    <th>Amount</th>
                                </tr>
                              </thead><tbody>`;

                poData.items.forEach((item, index) => {
                    let dimensionQty = '';
                    let unitRate = '';

                    if (item.type === 'Sq Feet') {
                        // प्रिंट साइज़ को पहले देखें, फिर वास्तविक साइज़ पर वापस जाएँ
                        const pWidth = item.printWidth || item.width || '?';
                        const pHeight = item.printHeight || item.height || '?';
                        const pUnit = item.inputUnit || item.unit || 'units';
                        const w = !isNaN(parseFloat(pWidth)) ? parseFloat(pWidth).toFixed(2) : pWidth;
                        const h = !isNaN(parseFloat(pHeight)) ? parseFloat(pHeight).toFixed(2) : pHeight;
                        dimensionQty = `${w} x ${h} ${pUnit}`;
                        unitRate = `₹ ${item.rate?.toFixed(2)} / sq ft`;
                        // वैकल्पिक: PrintSqFt भी दिखा सकते हैं
                        // dimensionQty += `<br><small>(Print Area: ${item.printSqFt} sq ft)</small>`;
                    } else { // Qty
                        dimensionQty = `${item.quantity || '?'}`;
                        unitRate = `₹ ${item.rate?.toFixed(2)} / unit`;
                    }

                    itemsHtml += `<tr>
                                    <td>${index + 1}</td>
                                    <td>${item.productName || 'N/A'}</td>
                                    <td>${item.type || 'N/A'}</td>
                                    <td>${dimensionQty}</td>
                                    <td>${unitRate}</td>
                                    <td>${item.partyName || '-'}</td>
                                    <td>${item.designDetails || '-'}</td>
                                    <td style="text-align:right;">₹ ${item.itemAmount?.toFixed(2) || '0.00'}</td>
                                  </tr>`;
                });

                itemsHtml += '</tbody></table>';
                 // नोट्स जोड़ें (यदि कोई हों)
                if (poData.notes) {
                    itemsHtml += `<div class="po-notes-details"><strong>Notes:</strong><p>${poData.notes.replace(/\n/g, '<br>')}</p></div>`;
                }
                poDetailsContent.innerHTML = itemsHtml;
            } else {
                poDetailsContent.innerHTML = '<p>No items found for this Purchase Order.</p>';
                 // नोट्स जोड़ें (यदि कोई हों)
                if (poData.notes) {
                    poDetailsContent.innerHTML += `<div class="po-notes-details"><strong>Notes:</strong><p>${poData.notes.replace(/\n/g, '<br>')}</p></div>`;
                }
            }
        } else {
            console.error(`PO document not found for ID: ${poId}`);
            poDetailsModalTitle.textContent = `Error`;
            poDetailsContent.innerHTML = `<p class="error-message">Could not load details for PO ID: ${poId}. The order might have been deleted.</p>`;
        }
    }).catch(error => {
        console.error("Error fetching PO details: ", error);
        poDetailsModalTitle.textContent = `Error`;
        poDetailsContent.innerHTML = `<p class="error-message">Error loading PO details: ${error.message}</p>`;
    });
}

function closePoDetailsModal() {
    if (poDetailsModal) {
        poDetailsModal.classList.remove('active');
        poDetailsContent.innerHTML = ''; // सामग्री साफ़ करें
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
            await displayPoList(); // Refresh PO list too, in case supplier name was displayed
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
    if (!db || !collection || !getDocs || !query || !orderBy || !doc || !getDoc || !deleteDoc || !updateDoc) {
        console.error("Firestore functions not available in displayPoList.");
        poTableBody.innerHTML = `<tr><td colspan="7" class="error-message">Error: Required functions missing. Cannot load POs.</td></tr>`; // Colspan अपडेट किया गया
        return;
    }

    poTableBody.innerHTML = `<tr><td colspan="7"><i class="fas fa-spinner fa-spin"></i> Loading purchase orders...</td></tr>`; // Colspan अपडेट किया गया
    cachedPOs = {}; // प्रत्येक रीफ़्रेश पर कैश साफ़ करें

    try {
        // Apply filtering based on poSearchInput and poStatusFilter values
        let poQuery;
        const statusFilter = poStatusFilter.value;

        if (statusFilter) {
             poQuery = query(collection(db, "purchaseOrders"), where("status", "==", statusFilter), orderBy("orderDate", "desc"));
        } else {
             poQuery = query(collection(db, "purchaseOrders"), orderBy("orderDate", "desc"));
        }

        const querySnapshot = await getDocs(poQuery);
        let filteredDocs = querySnapshot.docs;

        // Client-side search filtering (if search term exists)
        const searchTerm = poSearchInput.value.trim().toLowerCase();
         if (searchTerm) {
             console.log(`Filtering client-side for term: "${searchTerm}"`);
             // Fetch potential matching supplier IDs first for efficiency
             const suppliersRef = collection(db, "suppliers");
             // Basic search queries (may require multiple queries or different strategy for robust search)
             const nameQuery = query(suppliersRef, where("name", ">=", searchTerm), where("name", "<=", searchTerm + '\uf8ff'));
             const companyQuery = query(suppliersRef, where("companyName", ">=", searchTerm), where("companyName", "<=", searchTerm + '\uf8ff'));

             const [nameResults, companyResults] = await Promise.all([getDocs(nameQuery), getDocs(companyQuery)]);
             const matchingSupplierIds = new Set([...nameResults.docs.map(d => d.id), ...companyResults.docs.map(d => d.id)]);
             console.log("Matching supplier IDs found:", Array.from(matchingSupplierIds));

             filteredDocs = querySnapshot.docs.filter(docRef_po => {
                 const po = docRef_po.data();
                 const poNumberMatch = po.poNumber?.toLowerCase().includes(searchTerm);
                 const supplierIdMatch = po.supplierId && matchingSupplierIds.has(po.supplierId);
                 // Also check legacy supplierName if present
                 const supplierNameMatch = po.supplierName?.toLowerCase().includes(searchTerm);

                 return poNumberMatch || supplierIdMatch || supplierNameMatch;
             });
             console.log(`Docs after client-side filter: ${filteredDocs.length}`);
         }


        poTableBody.innerHTML = '';
        if (filteredDocs.length === 0) {
            poTableBody.innerHTML = `<tr><td colspan="7">No purchase orders found matching your criteria.</td></tr>`; // Colspan अपडेट किया गया
            return;
        }

        const poPromises = filteredDocs.map(async (docRef_po) => {
            const po = docRef_po.data();
            const poId = docRef_po.id;
            cachedPOs[poId] = po; // डेटा को कैश करें

            let supplierName = 'Unknown Supplier';
            if (po.supplierId) {
                try {
                    // Simple cache check for supplier name (basic, could be improved)
                    // let cachedSupplier = Object.values(suppliersCache || {}).find(s => s.id === po.supplierId);
                    // if (cachedSupplier) {
                    //      supplierName = cachedSupplier.name;
                    // } else {
                         const supplierSnap = await getDoc(doc(db, "suppliers", po.supplierId));
                         if (supplierSnap.exists()) {
                             supplierName = supplierSnap.data().name || 'N/A';
                             // Optionally cache supplier data here
                         } else { console.warn(`Supplier doc not found for ID: ${po.supplierId} in PO ${poId}`); }
                    // }
                } catch (err) { console.error(`Error fetching supplier ${po.supplierId}:`, err); supplierName = 'Error'; }
            } else { supplierName = po.supplierName || 'N/A (Legacy)'; }

            let orderDateStr = '-';
            if (po.orderDate?.toDate) { try { orderDateStr = po.orderDate.toDate().toLocaleDateString('en-GB'); } catch(e){} }

            let statusClass = (po.status || 'unknown').toLowerCase().replace(/\s+/g, '-');
            let statusText = po.status || 'Unknown';
            let amountStr = po.totalAmount !== undefined ? `₹ ${po.totalAmount.toFixed(2)}` : '-';

            // ---- नया: Print Sizes स्ट्रिंग बनाएं ----
            let printSizesStr = '';
            if (po.items && po.items.length > 0) {
                const sizeEntries = [];
                po.items.forEach(item => {
                    if (item.type === 'Sq Feet') {
                         // प्रिंट साइज़ को पहले देखें, फिर वास्तविक साइज़ पर वापस जाएँ
                         const pWidth = item.printWidth || item.width || '?';
                         const pHeight = item.printHeight || item.height || '?';
                         const pUnit = item.inputUnit || item.unit || 'units';
                         // यदि आवश्यक हो तो फ़्लोटिंग पॉइंट को ठीक करें
                         const w = !isNaN(parseFloat(pWidth)) ? parseFloat(pWidth).toFixed(2) : pWidth;
                         const h = !isNaN(parseFloat(pHeight)) ? parseFloat(pHeight).toFixed(2) : pHeight;

                         sizeEntries.push(`${w}x${h} ${pUnit}`);
                    }
                });
                printSizesStr = sizeEntries.join('<br>'); // एकाधिक आइटम के लिए लाइन ब्रेक का उपयोग करें
            }
            if (!printSizesStr) {
                printSizesStr = '-'; // यदि कोई Sq Feet आइटम नहीं है
            }
            // ---------------------------------------

            return {
                id: poId, poNumber: po.poNumber || 'N/A', supplierName: supplierName,
                orderDate: orderDateStr, status: statusText, statusClass: statusClass,
                amount: amountStr, poData: po, printSizes: printSizesStr // नया डेटा जोड़ें
            };
        });

        const posData = await Promise.all(poPromises);

        posData.forEach(poInfo => {
             const tr = document.createElement('tr');
             tr.setAttribute('data-id', poInfo.id);
             // **** tr.innerHTML को अपडेट करें ****
             tr.innerHTML = `
                 <td>${poInfo.poNumber}</td>
                 <td>${poInfo.supplierName}</td>
                 <td>${poInfo.orderDate}</td>
                 <td><span class="status-badge status-${poInfo.statusClass}">${poInfo.status}</span></td>
                 <td style="text-align: right;">${poInfo.amount}</td>
                 <td>${poInfo.printSizes}</td> <td class="action-buttons">
                     <button class="button view-details-button" data-poid="${poInfo.id}" title="View Details"><i class="fas fa-eye"></i></button> <a href="new_po.html?editPOId=${poInfo.id}" class="button edit-button" title="Edit PO"><i class="fas fa-edit"></i></a>
                     <button class="button status-button" data-poid="${poInfo.id}" data-ponumber="${poInfo.poNumber}" data-currentstatus="${poInfo.status}" title="Update Status"><i class="fas fa-sync-alt"></i></button>
                     <button class="button pdf-button" data-id="${poInfo.id}" title="Download PDF"><i class="fas fa-file-pdf"></i></button>
                     <button class="button delete-button" data-id="${poInfo.id}" data-ponumber="${poInfo.poNumber}" title="Delete PO"><i class="fas fa-trash-alt"></i></button>
                 </td>
             `;
             poTableBody.appendChild(tr);
        });

        console.log("Purchase Orders list displayed successfully.");

    } catch (error) {
        console.error("Error processing or displaying POs: ", error);
        poTableBody.innerHTML = `<tr><td colspan="7" class="error-message">Error loading POs: ${error.message}</td></tr>`; // Colspan अपडेट किया गया
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
        // alert(`PO status updated successfully to "${newStatus}"!`); // Optional alert
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
// Helper to show errors in status modal
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
        if(poTableBody) poTableBody.innerHTML = `<tr><td colspan="7" class="error-message"><strong>Init Error:</strong> DB connection failed.</td></tr>`; // Colspan अपडेट किया गया
        return;
    }
    console.log("Supplier Management: DB connection confirmed.");

    // Setup Event Listeners
    // Supplier listeners
    if (addSupplierBtn) { addSupplierBtn.addEventListener('click', () => openSupplierModal('add')); }
    if (closeSupplierModalBtn) { closeSupplierModalBtn.addEventListener('click', closeSupplierModal); }
    if (cancelSupplierBtn) { cancelSupplierBtn.addEventListener('click', closeSupplierModal); }
    if (supplierForm) { supplierForm.addEventListener('submit', saveSupplier); }
    if (supplierModal) { supplierModal.addEventListener('click', (event) => { if (event.target === supplierModal) closeSupplierModal(); }); }


    // Status Modal Listeners
    if (closeStatusModalBtn) { closeStatusModalBtn.addEventListener('click', closeStatusModal); }
    if (cancelStatusBtn) { cancelStatusBtn.addEventListener('click', closeStatusModal); }
    if (statusUpdateForm) { statusUpdateForm.addEventListener('submit', handleStatusUpdate); }
    if (statusUpdateModal) { statusUpdateModal.addEventListener('click', (event) => { if (event.target === statusUpdateModal) closeStatusModal(); }); }


    // **** NEW PO Details Modal Listeners ****
    if (closePoDetailsModalBtn) { closePoDetailsModalBtn.addEventListener('click', closePoDetailsModal); }
    if (closePoDetailsBtn) { closePoDetailsBtn.addEventListener('click', closePoDetailsModal); }
    if (poDetailsModal) { poDetailsModal.addEventListener('click', (event) => { if (event.target === poDetailsModal) closePoDetailsModal(); }); }
    // ***************************************

    // **** MODIFIED Event Listener for PO Table Actions (Using Delegation) ****
    if (poTableBody) {
        poTableBody.addEventListener('click', async (event) => {
            const targetElement = event.target;

            // Find closest button or link with a data-id or data-poid or href containing editPOId
            const actionElement = targetElement.closest('button[data-id], button[data-poid], a[href*="editPOId"]');

            if (!actionElement) return; // Click wasn't on a relevant action element

            // Prevent default only if it's NOT the edit link, as we want the link to work
            if (!actionElement.classList.contains('edit-button')) {
                event.preventDefault();
            }


            const poId = actionElement.dataset.id || actionElement.dataset.poid;
            const poNumber = actionElement.dataset.ponumber; // Needed for Delete/Status modals

            // Handle View Details click
            if (actionElement.classList.contains('view-details-button')) {
                if (poId) {
                    openPoDetailsModal(poId);
                } else { console.error("Missing PO ID for View Details"); }
            }
            // Handle Edit click (href handles navigation)
            else if (actionElement.classList.contains('edit-button')) {
                console.log(`Navigating to edit PO: ${poId || actionElement.href}`);
                // Allow default link behavior
            }
            // Handle Status Update click
            else if (actionElement.classList.contains('status-button')) {
                const currentStatus = actionElement.dataset.currentstatus;
                if (poId && currentStatus !== undefined) {
                    openStatusModal(poId, currentStatus, poNumber);
                } else { console.error("Missing data for Status Update", {poId, currentStatus, poNumber}); }
            }
            // Handle PDF click
            else if (actionElement.classList.contains('pdf-button')) {
                 if (typeof generatePoPdf !== 'function') { console.error("generatePoPdf function not imported/available."); alert("PDF Function not found."); return; }
                 if (!poId) { console.error("Missing PO ID for PDF"); return; }

                 actionElement.disabled = true; actionElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                 try {
                     // Attempt to use cached data first
                     let poDataForPdf = cachedPOs[poId];
                     if (!poDataForPdf) {
                          console.warn(`PDF: Cache miss for ${poId}, fetching PO data...`);
                          const poSnap = await getDoc(doc(db, "purchaseOrders", poId));
                          if (poSnap.exists()) {
                              poDataForPdf = poSnap.data();
                              cachedPOs[poId] = poDataForPdf; // Update cache
                          }
                     }

                     if (!poDataForPdf) throw new Error(`PO data not found after fetch: ${poId}`);
                     if (!poDataForPdf.supplierId) throw new Error("Supplier ID missing in PO data for PDF generation.");

                     // Fetch supplier data (consider caching suppliers too if needed)
                     const supplierSnap = await getDoc(doc(db, "suppliers", poDataForPdf.supplierId));
                     if (!supplierSnap.exists()) throw new Error(`Supplier data not found for ID: ${poDataForPdf.supplierId}`);

                     await generatePoPdf(poDataForPdf, supplierSnap.data());

                 } catch (error) {
                     console.error("Error during PDF generation process:", error);
                     alert("Failed to generate PDF: " + error.message);
                 } finally {
                      // Re-enable button using the original reference
                      actionElement.disabled = false;
                      actionElement.innerHTML = '<i class="fas fa-file-pdf"></i>';
                 }
            }
            // Handle Delete click
            else if (actionElement.classList.contains('delete-button')) {
                 if (poId) {
                    handleDeletePO(poId, poNumber);
                 } else { console.error("Missing PO ID for Delete"); }
            }
        });
    }
    // ********************************************************************

    // PO Filter Listener
    if (poFilterBtn && poSearchInput && poStatusFilter) {
         poFilterBtn.addEventListener('click', displayPoList); // Filter button triggers reload
         // Optional: Add listeners for live filtering
         // poSearchInput.addEventListener('input', displayPoList); // Filter as user types (can be slow)
         // poStatusFilter.addEventListener('change', displayPoList); // Filter on status change
    }


    // Initial data load
    (async () => {
        try { await displaySupplierList(); } catch (e) { console.error("Error during initial supplier load:", e); }
        try { await displayPoList(); } catch (e) { console.error("Error during initial PO load:", e); }
    })();

    // Check for #add hash (No changes)
    if(window.location.hash === '#add') {
         setTimeout(() => {
             if(supplierModal) openSupplierModal('add');
             else console.warn("Supplier modal not found for #add hash.");
             // Remove hash without reloading
             if (history.replaceState) {
                 history.replaceState(null, null, window.location.pathname + window.location.search);
             }
         }, 100); // Small delay to ensure modal is ready
    }

    console.log("Supplier Management Initialized via DOMContentLoaded.");
});

console.log("supplier_management.js module processed.");