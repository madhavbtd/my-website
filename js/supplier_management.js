// js/supplier_management.js

// Assume Firebase functions are globally available via HTML script block
const {
    db, collection, onSnapshot, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc,
    query, orderBy, where, Timestamp
} = window;

// --- DOM Elements ---
const addSupplierBtn = document.getElementById('addSupplierBtn');
const createPoBtn = document.getElementById('createPoBtn');
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
    supplierModal.classList.remove('active'); // Hide modal
}

// --- Firestore Operations ---

// Function to display suppliers
async function displaySupplierList() {
    if (!db || !collection || !getDocs || !query) {
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

        querySnapshot.forEach((doc) => {
            const supplier = doc.data();
            const supplierId = doc.id;
            const tr = document.createElement('tr');
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
            tr.querySelector('.edit-button').addEventListener('click', () => {
                 openSupplierModal('edit', supplier, supplierId);
            });
            tr.querySelector('.delete-button').addEventListener('click', () => {
                 deleteSupplier(supplierId, supplier.name);
            });

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
    if (!db || !collection || !addDoc || !doc || !updateDoc || !Timestamp) {
         showSupplierError("Firestore not ready. Cannot save.");
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
         saveSupplierBtn.disabled = false; // Re-enable button
         saveSupplierBtn.textContent = 'Save Supplier';
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
     if (!db || !collection || !getDocs || !query) {
          console.error("Firestore not ready for displayPoList.");
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

         querySnapshot.forEach((doc) => {
             const po = doc.data();
             const poId = doc.id;
             const tr = document.createElement('tr');
             // Format date if available
             let orderDateStr = '-';
             if (po.orderDate && po.orderDate.toDate) {
                  try {
                     orderDateStr = po.orderDate.toDate().toLocaleDateString('en-GB'); // dd/mm/yyyy format
                  } catch(e) { console.warn("Error formatting PO date", e); }
             }

             tr.innerHTML = `
                 <td>${po.poNumber || 'N/A'}</td>
                 <td>${po.supplierName || 'N/A'}</td>
                 <td>${orderDateStr}</td>
                 <td><span class="status-badge status-${(po.status || 'unknown').toLowerCase().replace(/\s+/g, '-')}">${po.status || 'Unknown'}</span></td>
                 <td>${po.totalAmount !== undefined ? po.totalAmount.toFixed(2) : '-'}</td>
                 <td class="action-buttons">
                     <a href="new_po.html?editPOId=${poId}" class="button edit-button"><i class="fas fa-edit"></i></a>
                     <button class="button delete-button" data-id="${poId}" data-ponumber="${po.poNumber || ''}"><i class="fas fa-trash-alt"></i></button>
                     <button class="button pdf-button" data-id="${poId}"><i class="fas fa-file-pdf"></i></button>
                 </td>
             `;
             // Add event listeners for PO delete/PDF buttons later
             poTableBody.appendChild(tr);
         });

     } catch (error) {
         console.error("Error fetching POs: ", error);
         poTableBody.innerHTML = '<tr><td colspan="6" style="color:red;">Error loading purchase orders.</td></tr>';
     }
}

// Helper to show errors in modal
function showSupplierError(message) {
    supplierErrorMsg.textContent = message;
    supplierErrorMsg.style.display = 'block';
}

// --- Global Initialization ---
// We wrap the main logic in a function that can be called after Firebase auth is confirmed
window.initializeSupplierManagement = () => {
    console.log("Initializing Supplier Management...");

    // --- Event Listeners ---
    if (addSupplierBtn) {
        addSupplierBtn.addEventListener('click', () => openSupplierModal('add'));
    }
    if (closeSupplierModalBtn) {
        closeSupplierModalBtn.addEventListener('click', closeSupplierModal);
    }
     if (cancelSupplierBtn) {
         cancelSupplierBtn.addEventListener('click', closeSupplierModal);
     }
    if (supplierForm) {
        supplierForm.addEventListener('submit', saveSupplier);
    }

    // Close modal if clicked outside content
    if (supplierModal) {
         supplierModal.addEventListener('click', (event) => {
             if (event.target === supplierModal) {
                 closeSupplierModal();
             }
         });
     }

     // Initial data load
     displaySupplierList();
     displayPoList();

     // Check for #add in URL to open modal automatically
     if(window.location.hash === '#add') {
         openSupplierModal('add');
     }

};

// The actual initialization is triggered by the auth check in the HTML head script block

console.log("supplier_management.js loaded.");