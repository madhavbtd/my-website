// js/supplier_management.js

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
    // Ensure table body exists
    if (!supplierTableBody) {
        console.error("Supplier table body not found!");
        return;
    }
    // Ensure Firestore functions are ready
    if (!db || !collection || !getDocs || !query || !orderBy) {
        console.error("Firestore functions not ready for displaySupplierList.");
        supplierTableBody.innerHTML = '<tr><td colspan="5" style="color:red;">Error loading Firestore.</td></tr>';
        return;
    }

    supplierTableBody.innerHTML = '<tr><td colspan="5">Loading suppliers...</td></tr>'; // Show loading state
    try {
        const q = query(collection(db, "suppliers"), orderBy("name")); // Order by name
        const querySnapshot = await getDocs(q);
        supplierTableBody.innerHTML = ''; // Clear loading/previous state

        if (querySnapshot.empty) {
            supplierTableBody.innerHTML = '<tr><td colspan="5">No suppliers found. Add one!</td></tr>';
            return;
        }

        querySnapshot.forEach((docRef) => { // Use docRef to avoid confusion with doc function
            const supplier = docRef.data();
            const supplierId = docRef.id;
            const tr = document.createElement('tr');
            tr.setAttribute('data-id', supplierId); // Add data-id attribute
            tr.innerHTML = `
                <td>${supplier.name || 'N/A'}</td>
                <td>${supplier.companyName || '-'}</td>
                <td>${supplier.whatsappNo || '-'}</td>
                <td>${supplier.email || '-'}</td>
                <td class="action-buttons">
                    <button class="button edit-button" data-id="${supplierId}"><i class="fas fa-edit"></i></button>
                    <button class="button delete-button" data-id="${supplierId}"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
            // Add event listeners for edit/delete buttons
            const editBtn = tr.querySelector('.edit-button');
            if(editBtn) {
                editBtn.addEventListener('click', () => {
                    // Fetch data again for edit to ensure it's the latest, or use cached data carefully
                    // For simplicity, using potentially cached data passed to modal
                    openSupplierModal('edit', supplier, supplierId);
                });
            }
            const deleteBtn = tr.querySelector('.delete-button');
            if(deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    deleteSupplier(supplierId, supplier.name);
                });
            }

            supplierTableBody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error fetching suppliers: ", error);
        supplierTableBody.innerHTML = '<tr><td colspan="5" style="color:red;">Error loading suppliers.</td></tr>';
    }
}

// Function to save/update supplier
async function saveSupplier(event) {
    event.preventDefault(); // Prevent default form submission
    // Ensure elements and functions are available
    if (!saveSupplierBtn || !supplierNameInput || !supplierErrorMsg || !db || !collection || !addDoc || !doc || !updateDoc || !Timestamp) {
         console.error("Save Supplier prerequisites missing.");
         alert("Error: Cannot save supplier.");
         return;
     }

    // Get form data
    const supplierData = {
        name: supplierNameInput.value.trim(),
        companyName: supplierCompanyInput.value.trim(),
        whatsappNo: supplierWhatsappInput.value.trim(),
        email: supplierEmailInput.value.trim(),
        address: supplierAddressInput.value.trim(),
        gstNo: supplierGstInput.value.trim(),
        // Add or update timestamp based on mode
    };

    // Basic Validation
    if (!supplierData.name) {
        showSupplierError("Supplier Name is required.");
        return;
    }

    saveSupplierBtn.disabled = true; // Disable button while saving
    saveSupplierBtn.textContent = 'Saving...';
    supplierErrorMsg.style.display = 'none';

    try {
        if (currentEditingSupplierId) {
            // Update existing supplier
            supplierData.updatedAt = Timestamp.now();
            const supplierRef = doc(db, "suppliers", currentEditingSupplierId);
            await updateDoc(supplierRef, supplierData);
            console.log("Supplier updated with ID: ", currentEditingSupplierId);
        } else {
            // Add new supplier
            supplierData.createdAt = Timestamp.now();
            supplierData.updatedAt = Timestamp.now(); // Set updatedAt on creation too
            const docRef = await addDoc(collection(db, "suppliers"), supplierData);
            console.log("Supplier added with ID: ", docRef.id);
        }
        closeSupplierModal();
        displaySupplierList(); // Refresh the list
    } catch (error) {
        console.error("Error saving supplier: ", error);
        showSupplierError("Error saving supplier: " + error.message);
    } finally {
         // Check if button still exists before re-enabling
         if(saveSupplierBtn) {
            saveSupplierBtn.disabled = false;
            saveSupplierBtn.textContent = 'Save Supplier';
         }
    }
}

// Function to delete supplier
async function deleteSupplier(supplierId, supplierName) {
     if (!db || !doc || !deleteDoc) {
          alert("Firestore not ready. Cannot delete.");
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
    }
}

// Function to display POs (Basic - will be expanded later)
async function displayPoList() {
     // Ensure table body exists
     if (!poTableBody) {
         console.error("PO table body not found!");
         return;
     }
     // Ensure Firestore functions are ready
     if (!db || !collection || !getDocs || !query || !orderBy) {
          console.error("Firestore functions not ready for displayPoList.");
          poTableBody.innerHTML = '<tr><td colspan="6" style="color:red;">Error loading Firestore.</td></tr>';
          return;
      }

    poTableBody.innerHTML = '<tr><td colspan="6">Loading purchase orders...</td></tr>';
     try {
         const q = query(collection(db, "purchaseOrders"), orderBy("orderDate", "desc")); // Example sort
         const querySnapshot = await getDocs(q);
         poTableBody.innerHTML = ''; // Clear

         if (querySnapshot.empty) {
             poTableBody.innerHTML = '<tr><td colspan="6">No purchase orders found yet.</td></tr>';
             return;
         }

         querySnapshot.forEach((docRef) => { // Use docRef
             const po = docRef.data();
             const poId = docRef.id;
             const tr = document.createElement('tr');
             tr.setAttribute('data-id', poId); // Add data-id attribute
             // Format date if available
             let orderDateStr = '-';
             if (po.orderDate && po.orderDate.toDate) {
                  try {
                     orderDateStr = po.orderDate.toDate().toLocaleDateString('en-GB'); // dd/mm/yyyy format
                  } catch(e) { console.warn("Error formatting PO date", e); }
             }

             // --- Determine Status Badge Class ---
             let statusClass = 'unknown'; // Default class
             if (po.status) {
                statusClass = po.status.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'unknown';
             }
             // --- ---

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
             // Add event listeners for PO delete/PDF buttons later
             // Example for delete:
             const deletePoBtn = tr.querySelector('.delete-button');
             if (deletePoBtn) {
                 deletePoBtn.addEventListener('click', () => {
                     // Call a function like handleDeletePO(poId, po.poNumber);
                     alert('Delete PO functionality not implemented yet.');
                 });
             }
             // Example for PDF:
             const pdfBtn = tr.querySelector('.pdf-button');
             if (pdfBtn) {
                 pdfBtn.addEventListener('click', () => {
                     // Call a function like generatePoPdfById(poId);
                     alert('Generate PO PDF functionality not implemented yet.');
                 });
             }

             poTableBody.appendChild(tr);
         });

     } catch (error) {
         console.error("Error fetching POs: ", error);
         poTableBody.innerHTML = '<tr><td colspan="6" style="color:red;">Error loading purchase orders.</td></tr>';
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
        let attempts = 0; const maxAttempts = 20; // 5 सेकंड तक प्रतीक्षा करें
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
    // सुनिश्चित करें कि DB कनेक्शन तैयार है
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

        // Close modal if clicked outside content
        if (supplierModal) {
             supplierModal.addEventListener('click', (event) => {
                 if (event.target === supplierModal) {
                     closeSupplierModal();
                 }
             });
         } else { console.warn("Supplier modal not found."); }

         // PO Filter Listeners (Add later if needed)
         // Example:
         // if(poFilterBtn) poFilterBtn.addEventListener('click', displayPoList);


         // Initial data load
         displaySupplierList();
         displayPoList();

         // Check for #add in URL to open modal automatically
         if(window.location.hash === '#add') {
             if(supplierModal) {
                openSupplierModal('add');
             } else {
                 console.warn("Modal not found, cannot open from hash.");
             }
             // Clean the hash using history API if available
             if (history.replaceState) {
                 history.replaceState(null, null, window.location.pathname + window.location.search);
             }
         }
         console.log("Supplier Management Initialized via DOMContentLoaded.");
    });
});

// Log to confirm script loaded
console.log("supplier_management.js loaded.");