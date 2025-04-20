// js/supplier_management.js - v3 (Delete PO Added)

// Assume Firebase functions are globally available via HTML script block
const {
    db, collection, onSnapshot, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc,
    query, orderBy, where, Timestamp
} = window;

// --- DOM Elements ---
// Ensure these elements exist in your supplier_management.html
const addSupplierBtn = document.getElementById('addSupplierBtn');
const createPoBtn = document.getElementById('createPoBtn'); // Assuming you have this button
const supplierTableBody = document.getElementById('supplierTableBody');
const poTableBody = document.getElementById('poTableBody');

// Supplier Modal Elements
const supplierModal = document.getElementById('supplierModal');
const supplierModalTitle = document.getElementById('supplierModalTitle');
const closeSupplierModalBtn = document.getElementById('closeSupplierModal');
const cancelSupplierBtn = document.getElementById('cancelSupplierBtn');
const saveSupplierBtn = document.getElementById('saveSupplierBtn');
const supplierForm = document.getElementById('supplierForm');
const supplierIdInput = document.getElementById('supplierIdInput'); // Hidden input for ID
const supplierNameInput = document.getElementById('supplierNameInput');
const supplierCompanyInput = document.getElementById('supplierCompanyInput');
const supplierWhatsappInput = document.getElementById('supplierWhatsappInput');
const supplierEmailInput = document.getElementById('supplierEmailInput');
const supplierAddressInput = document.getElementById('supplierAddressInput');
const supplierGstInput = document.getElementById('supplierGstInput');
const supplierErrorMsg = document.getElementById('supplierErrorMsg');

// PO Filter Elements (Get references later when implementing filters)
const poSearchInput = document.getElementById('poSearchInput');
const poStatusFilter = document.getElementById('poStatusFilter');
const poFilterBtn = document.getElementById('poFilterBtn');

let currentEditingSupplierId = null; // To track if editing

// --- Modal Handling ---
function openSupplierModal(mode = 'add', supplierData = null, supplierId = null) {
    // Ensure modal elements exist before proceeding
    if (!supplierModal || !supplierForm || !supplierModalTitle || !supplierErrorMsg || !supplierIdInput || !supplierNameInput || !supplierCompanyInput || !supplierWhatsappInput || !supplierEmailInput || !supplierAddressInput || !supplierGstInput) {
        console.error("Supplier modal elements not found!");
        alert("Error: Could not open supplier form.");
        return;
    }
    supplierForm.reset(); // Clear form
    supplierErrorMsg.style.display = 'none';
    supplierErrorMsg.textContent = '';
    currentEditingSupplierId = null; // Reset editing ID

    if (mode === 'edit' && supplierData && supplierId) {
        supplierModalTitle.textContent = 'Edit Supplier';
        supplierIdInput.value = supplierId; // Store ID in hidden input (optional)
        currentEditingSupplierId = supplierId; // Store ID in variable
        // Populate form
        supplierNameInput.value = supplierData.name || '';
        supplierCompanyInput.value = supplierData.companyName || '';
        supplierWhatsappInput.value = supplierData.whatsappNo || '';
        supplierEmailInput.value = supplierData.email || '';
        supplierAddressInput.value = supplierData.address || '';
        supplierGstInput.value = supplierData.gstNo || '';
    } else {
        supplierModalTitle.textContent = 'Add New Supplier';
        supplierIdInput.value = ''; // Clear hidden ID input
    }
    supplierModal.classList.add('active'); // Show modal
}

function closeSupplierModal() {
    if (supplierModal) {
        supplierModal.classList.remove('active'); // Hide modal
    }
}

// --- Firestore Operations ---

// Function to display suppliers
async function displaySupplierList() {
    if (!supplierTableBody) { console.error("Supplier table body not found!"); return; }
    if (!db || !collection || !getDocs || !query || !orderBy) {
        console.error("Firestore functions not ready for displaySupplierList.");
        supplierTableBody.innerHTML = '<tr><td colspan="5" style="color:red;">Error loading Firestore functions.</td></tr>';
        return;
    }

    supplierTableBody.innerHTML = '<tr><td colspan="5">Loading suppliers...</td></tr>';
    try {
        const q = query(collection(db, "suppliers"), orderBy("name"));
        const querySnapshot = await getDocs(q);
        supplierTableBody.innerHTML = '';

        if (querySnapshot.empty) {
            supplierTableBody.innerHTML = '<tr><td colspan="5">No suppliers found. Add one!</td></tr>';
            return;
        }

        querySnapshot.forEach((docRef) => {
            const supplier = docRef.data();
            const supplierId = docRef.id;
            const tr = document.createElement('tr');
            tr.setAttribute('data-id', supplierId);
            tr.innerHTML = `
                <td>${supplier.name || 'N/A'}</td>
                <td>${supplier.companyName || '-'}</td>
                <td>${supplier.whatsappNo || '-'}</td>
                <td>${supplier.email || '-'}</td>
                <td class="action-buttons">
                    <button class="button edit-button" data-id="${supplierId}" title="Edit Supplier"><i class="fas fa-edit"></i></button>
                    <button class="button delete-button" data-id="${supplierId}" title="Delete Supplier"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
            const editBtn = tr.querySelector('.edit-button');
            if(editBtn) {
                editBtn.addEventListener('click', () => {
                    openSupplierModal('edit', supplier, supplierId);
                });
            }
            const deleteBtn = tr.querySelector('.delete-button');
            if(deleteBtn) {
                // *** Use correct function name 'deleteSupplier' ***
                deleteBtn.addEventListener('click', () => {
                    deleteSupplier(supplierId, supplier.name); // Corrected function call
                });
            }
            supplierTableBody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error fetching suppliers: ", error);
        supplierTableBody.innerHTML = `<tr><td colspan="5" style="color:red;">Error loading suppliers: ${error.message}</td></tr>`;
    }
}

// Function to save/update supplier
async function saveSupplier(event) {
    event.preventDefault();
    if (!saveSupplierBtn || !supplierNameInput || !supplierErrorMsg || !db || !collection || !addDoc || !doc || !updateDoc || !Timestamp) {
         console.error("Save Supplier prerequisites missing.");
         alert("Error: Cannot save supplier.");
         return;
     }

    const supplierData = {
        name: supplierNameInput.value.trim(),
        companyName: supplierCompanyInput.value.trim(),
        whatsappNo: supplierWhatsappInput.value.trim(),
        email: supplierEmailInput.value.trim(),
        address: supplierAddressInput.value.trim(),
        gstNo: supplierGstInput.value.trim(),
    };

    if (!supplierData.name) {
        showSupplierError("Supplier Name is required.");
        return;
    }

    saveSupplierBtn.disabled = true;
    saveSupplierBtn.textContent = 'Saving...';
    supplierErrorMsg.style.display = 'none';

    try {
        if (currentEditingSupplierId) {
            supplierData.updatedAt = Timestamp.now();
            const supplierRef = doc(db, "suppliers", currentEditingSupplierId);
            await updateDoc(supplierRef, supplierData);
            console.log("Supplier updated with ID: ", currentEditingSupplierId);
        } else {
            supplierData.createdAt = Timestamp.now();
            supplierData.updatedAt = Timestamp.now();
            const docRef = await addDoc(collection(db, "suppliers"), supplierData);
            console.log("Supplier added with ID: ", docRef.id);
        }
        closeSupplierModal();
        displaySupplierList();
    } catch (error) {
        console.error("Error saving supplier: ", error);
        showSupplierError("Error saving supplier: " + error.message);
    } finally {
         if(saveSupplierBtn) {
            saveSupplierBtn.disabled = false;
            saveSupplierBtn.textContent = 'Save Supplier';
         }
    }
}

// Function to delete supplier
async function deleteSupplier(supplierId, supplierName) {
     if (!db || !doc || !deleteDoc) {
          alert("Firestore not ready. Cannot delete supplier.");
          return;
      }
    if (confirm(`Are you sure you want to delete supplier "${supplierName || 'this supplier'}"? This cannot be undone.`)) {
        try {
            await deleteDoc(doc(db, "suppliers", supplierId));
            console.log("Supplier deleted: ", supplierId);
            displaySupplierList(); // Refresh the list
        } catch (error) {
            console.error("Error deleting supplier: ", error);
            alert("Error deleting supplier: " + error.message);
        }
    } else {
         console.log("Supplier delete cancelled.");
     }
}


// +++++ FUNCTION TO DELETE PURCHASE ORDER +++++
async function handleDeletePO(poId, poNumber) {
    // Ensure Firestore delete function is available
    if (!db || !doc || !deleteDoc) {
         alert("Firestore delete function not available. Cannot delete PO.");
         return;
     }

    // Ask for confirmation
    if (confirm(`Are you sure you want to delete Purchase Order "${poNumber || poId}"? This cannot be undone.`)) {
        console.log(`Attempting to delete PO: ${poId}`);
        try {
            // Create a reference to the specific PO document
            const poRef = doc(db, "purchaseOrders", poId);
            // Delete the document
            await deleteDoc(poRef);
            console.log("Purchase Order deleted successfully:", poId);
            alert(`Purchase Order ${poNumber || poId} deleted successfully.`);
            // Refresh the PO list to show the change
            displayPoList();
        } catch (error) {
            console.error("Error deleting Purchase Order:", error);
            alert("Error deleting Purchase Order: " + error.message);
        }
    } else {
        console.log("PO deletion cancelled by user.");
    }
}
// +++++ END FUNCTION TO DELETE PURCHASE ORDER +++++


// Function to display POs
async function displayPoList() {
     if (!poTableBody) { console.error("PO table body not found!"); return; }
     if (!db || !collection || !getDocs || !query || !orderBy) {
          console.error("Firestore functions not ready for displayPoList.");
          poTableBody.innerHTML = '<tr><td colspan="6" style="color:red;">Error loading Firestore functions.</td></tr>';
          return;
      }

    poTableBody.innerHTML = '<tr><td colspan="6">Loading purchase orders...</td></tr>';
     try {
         const q = query(collection(db, "purchaseOrders"), orderBy("orderDate", "desc"));
         const querySnapshot = await getDocs(q);
         poTableBody.innerHTML = '';

         if (querySnapshot.empty) {
             poTableBody.innerHTML = '<tr><td colspan="6">No purchase orders found yet.</td></tr>';
             return;
         }

         querySnapshot.forEach((docRef) => {
             const po = docRef.data();
             const poId = docRef.id;
             const tr = document.createElement('tr');
             tr.setAttribute('data-id', poId);
             let orderDateStr = '-';
             if (po.orderDate && po.orderDate.toDate) {
                  try {
                     orderDateStr = po.orderDate.toDate().toLocaleDateString('en-GB');
                  } catch(e) { console.warn("Error formatting PO date", e); }
             }
             let statusClass = 'unknown';
             if (po.status) {
                statusClass = po.status.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'unknown';
             }

             tr.innerHTML = `
                 <td>${po.poNumber || 'N/A'}</td>
                 <td>${po.supplierName || 'N/A'}</td>
                 <td>${orderDateStr}</td>
                 <td><span class="status-badge status-${statusClass}">${po.status || 'Unknown'}</span></td>
                 <td>${po.totalAmount !== undefined ? po.totalAmount.toFixed(2) : '-'}</td>
                 <td class="action-buttons">
                     <a href="new_po.html?editPOId=${poId}" class="button edit-button" title="Edit PO"><i class="fas fa-edit"></i></a>
                     <button class="button delete-button" data-id="${poId}" data-ponumber="${po.poNumber || ''}" title="Delete PO"><i class="fas fa-trash-alt"></i></button>
                     <button class="button pdf-button" data-id="${poId}" title="Download PDF"><i class="fas fa-file-pdf"></i></button>
                 </td>
             `;

             // +++++ ADD/CORRECT EVENT LISTENER FOR PO DELETE BUTTON +++++
             const deletePoBtn = tr.querySelector('.delete-button');
             if (deletePoBtn) {
                 // Make sure it calls handleDeletePO (the function we just added/verified)
                 deletePoBtn.addEventListener('click', () => handleDeletePO(poId, po.poNumber || ''));
             }
             // +++++ END EVENT LISTENER +++++

             // PDF Button Listener (Placeholder)
             const pdfBtn = tr.querySelector('.pdf-button');
             if (pdfBtn) {
                 pdfBtn.addEventListener('click', () => {
                     alert('Generate PO PDF functionality not implemented yet.');
                 });
             }

             poTableBody.appendChild(tr);
         });

     } catch (error) {
         console.error("Error fetching POs: ", error);
         poTableBody.innerHTML = `<tr><td colspan="6" style="color:red;">Error loading POs: ${error.message}</td></tr>`;
     }
}

// Helper to show errors in modal
function showSupplierError(message) {
    if(supplierErrorMsg) {
        supplierErrorMsg.textContent = message;
        supplierErrorMsg.style.display = 'block';
    } else {
        console.error("Supplier error message element not found:", message);
        alert(message); // Fallback
    }
}

// --- DB Connection Wait ---
function waitForDbConnection(callback) {
    if (window.db) {
        callback();
    } else {
        let attempts = 0; const maxAttempts = 20;
        const intervalId = setInterval(() => {
            attempts++;
            if (window.db) {
                clearInterval(intervalId);
                callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(intervalId);
                console.error("Supplier Management: DB connection timeout.");
                alert("Database connection failed. Please refresh.");
            }
        }, 250);
    }
}

// --- Initialization on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    waitForDbConnection(() => {
        console.log("Supplier Management: DOM loaded and DB connected. Initializing.");

        // --- Event Listeners ---
        if (addSupplierBtn) {
            addSupplierBtn.addEventListener('click', () => openSupplierModal('add'));
        } else { console.warn("Add Supplier button not found."); }

        if (closeSupplierModalBtn) {
            closeSupplierModalBtn.addEventListener('click', closeSupplierModal);
        } else { console.warn("Close Supplier Modal button not found."); }

         if (cancelSupplierBtn) {
             cancelSupplierBtn.addEventListener('click', closeSupplierModal);
         } else { console.warn("Cancel Supplier button not found."); }

        if (supplierForm) {
            supplierForm.addEventListener('submit', saveSupplier);
        } else { console.warn("Supplier form not found."); }

        if (supplierModal) {
             supplierModal.addEventListener('click', (event) => {
                 if (event.target === supplierModal) {
                     closeSupplierModal();
                 }
             });
         } else { console.warn("Supplier modal not found."); }

         // Initial data load
         displaySupplierList();
         displayPoList();

         if(window.location.hash === '#add') {
             if(supplierModal) {
                openSupplierModal('add');
             } else {
                 console.warn("Modal not found, cannot open from hash.");
             }
             if (history.replaceState) {
                 history.replaceState(null, null, window.location.pathname + window.location.search);
             }
         }
         console.log("Supplier Management Initialized via DOMContentLoaded.");
    });
});

// Log to confirm script loaded
console.log("supplier_management.js loaded.");