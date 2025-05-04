// js/supplier_management.js - v24 (Fix Delete Refresh, Add/Edit Modal Debugging, Edit Fetch Error Handling)

// --- Imports ---
import { db, auth } from './firebase-init.js';
import {
    collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc,
    query, orderBy, where, Timestamp, serverTimestamp, limit, onSnapshot, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Global Variables ---
let currentSuppliers = []; // To hold the fetched supplier data locally
let currentPOs = []; // To hold the fetched PO data locally
let supplierNameMap = {}; // Map supplier IDs to names for PO table

// --- DOM Elements ---
// Supplier Section
const addSupplierBtn = document.getElementById('addSupplierBtn');
const supplierTableBody = document.getElementById('supplierTableBody');
const supplierLoadingMessage = document.getElementById('supplierLoadingMessage');
const supplierListError = document.getElementById('supplierListError');
const supplierFilterInput = document.getElementById('supplierFilterInput');
const supplierFilterDropdown = document.getElementById('supplierFilterDropdown'); // Assuming you might add a dropdown filter

// Add Supplier Modal
const addSupplierModal = document.getElementById('addSupplierModal');
const addSupplierForm = document.getElementById('addSupplierForm');
const saveSupplierBtn = document.getElementById('saveSupplierBtn');
const cancelAddSupplierBtn = document.getElementById('cancelAddSupplierBtn');
const addSupplierError = document.getElementById('addSupplierError');

// Edit Supplier Modal
const editSupplierModal = document.getElementById('editSupplierModal');
const editSupplierForm = document.getElementById('editSupplierForm');
const updateSupplierBtn = document.getElementById('updateSupplierBtn');
const cancelEditSupplierBtn = document.getElementById('cancelEditSupplierBtn');
const editSupplierError = document.getElementById('editSupplierError');
const editingSupplierId = document.getElementById('editingSupplierId'); // Hidden input to store ID

// PO Section Elements (Keep relevant ones from v23 if needed)
const poTableBody = document.getElementById('poTableBody');
const poLoadingMessage = document.getElementById('poLoadingMessage');
const poListError = document.getElementById('poListError');
// Add other PO elements if necessary...


// --- Utility Functions ---
function displayGlobalError(message) {
    console.error("Global Error:", message);
    const errorDiv = document.getElementById('globalErrorDisplay'); // Ensure you have this div in HTML
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        // Optionally hide after some time
        // setTimeout(() => { errorDiv.style.display = 'none'; }, 5000);
    } else {
        alert(`Error: ${message}`); // Fallback
    }
}

function displaySuccessMessage(message) {
    console.log("Success:", message);
    const successDiv = document.getElementById('globalSuccessDisplay'); // Ensure you have this div in HTML
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        setTimeout(() => { successDiv.style.display = 'none'; }, 3000); // Hide after 3 seconds
    } else {
        // Simple fallback notification if needed
    }
}

function hideError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.style.display = 'none';
        errorElement.textContent = '';
    }
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    } else {
        console.error(`Error element #${elementId} not found. Message: ${message}`);
    }
}

// --- Supplier Management Functions ---

// Load Suppliers
async function loadSuppliers() {
    console.log("Loading suppliers...");
    if (!db) { console.error("Firestore DB not available."); displayGlobalError("Database connection failed."); return; }
    if (supplierLoadingMessage) supplierLoadingMessage.style.display = 'block';
    if (supplierTableBody) supplierTableBody.innerHTML = ''; // Clear existing table
    hideError('supplierListError'); // Hide previous errors

    const suppliersRef = collection(db, "suppliers");
    // Add query constraints like orderBy if needed: query(suppliersRef, orderBy("name"))
    try {
        const q = query(suppliersRef, orderBy("name")); // Order by name
        const querySnapshot = await getDocs(q);
        currentSuppliers = []; // Reset local cache
        supplierNameMap = {}; // Reset name map
        querySnapshot.forEach((doc) => {
            const supplier = { id: doc.id, ...doc.data() };
            currentSuppliers.push(supplier);
            supplierNameMap[supplier.id] = supplier.name; // Populate map
        });
        console.log(`Workspaceed ${currentSuppliers.length} suppliers.`);
        renderSupplierTable(currentSuppliers); // Render the fetched suppliers
        populateSupplierFilterDropdown(currentSuppliers); // Update filter dropdown
        if (supplierLoadingMessage) supplierLoadingMessage.style.display = 'none';
        if (currentSuppliers.length === 0) {
            if (supplierTableBody) supplierTableBody.innerHTML = '<tr><td colspan="4">No suppliers found.</td></tr>';
        }
    } catch (error) {
        console.error("Error loading suppliers: ", error);
        showError('supplierListError', `Failed to load suppliers. Error: ${error.message}`);
        if (supplierLoadingMessage) supplierLoadingMessage.style.display = 'none';
    }
}

// Render Supplier Table
function renderSupplierTable(suppliersToRender) {
     if (!supplierTableBody) { console.error("Supplier table body not found!"); return; }
     supplierTableBody.innerHTML = ''; // Clear table

     if (suppliersToRender.length === 0) {
         supplierTableBody.innerHTML = '<tr><td colspan="5">No suppliers match the current filter.</td></tr>'; // Updated colspan
         return;
     }

     suppliersToRender.forEach(supplier => {
         const row = supplierTableBody.insertRow();
         row.dataset.id = supplier.id; // Add ID to row for potential future use

         // Calculate outstanding balance (placeholder - needs PO/Payment data)
         // For now, display "Calculating..." or a static value
         const outstandingBalance = "Calculating..."; // Replace with actual calculation later if needed here

         row.innerHTML = `
             <td>${supplier.name || 'N/A'}</td>
             <td>${supplier.contactNo || 'N/A'}</td>
             <td class="outstanding-balance-cell">${outstandingBalance}</td>
             <td class="actions-cell">
                 <button class="button icon-button edit-button" data-id="${supplier.id}" title="Edit Supplier"><i class="fas fa-edit"></i></button>
                 <button class="button icon-button delete-button" data-id="${supplier.id}" title="Delete Supplier"><i class="fas fa-trash-alt"></i></button>
                 <button class="button icon-button view-button" data-id="${supplier.id}" title="View Details"><i class="fas fa-eye"></i></button>
             </td>
         `;
     });
     console.log(`Displayed ${suppliersToRender.length} suppliers.`);
 }


// Populate Filter Dropdown (Example)
function populateSupplierFilterDropdown(suppliers) {
    if (supplierFilterDropdown) {
        supplierFilterDropdown.innerHTML = '<option value="">All Suppliers</option>'; // Default option
        suppliers.forEach(supplier => {
            const option = document.createElement('option');
            option.value = supplier.id;
            option.textContent = supplier.name;
            supplierFilterDropdown.appendChild(option);
        });
        console.log("Supplier filter dropdown populated.");
    }
     // Also populate PO filter dropdown if it exists
     const poSupplierFilter = document.getElementById('poSupplierFilter');
     if (poSupplierFilter) {
         poSupplierFilter.innerHTML = '<option value="">All Suppliers</option>'; // Default option
         suppliers.forEach(supplier => {
             const option = document.createElement('option');
             option.value = supplier.id; // Use ID as value
             option.textContent = supplier.name;
             poSupplierFilter.appendChild(option);
         });
         console.log("PO Supplier filter dropdown populated.");
     }
}

// --- Add Supplier ---
function openAddSupplierModal() {
    console.log("Attempting to open Add Supplier Modal...");
    if (!addSupplierModal) {
        console.error("Add Supplier Modal element (#addSupplierModal) not found in DOM!");
        displayGlobalError("Could not open the add supplier form.");
        return;
    }
    console.log("Add Supplier Modal element found. Setting display to block.");
    clearAddSupplierForm(); // Clear previous entries
    hideError('addSupplierError'); // Hide previous errors
    addSupplierModal.style.display = 'block';
    // Verify if display is set correctly (for debugging)
    setTimeout(() => {
        if (window.getComputedStyle(addSupplierModal).display !== 'block') {
            console.warn("Add Supplier Modal display style was set to 'block', but computed style is not 'block'. Check CSS conflicts.");
        } else {
            console.log("Add Supplier Modal should be visible now.");
        }
    }, 0);
}


function closeAddSupplierModal() {
    if (addSupplierModal) addSupplierModal.style.display = 'none';
}

function clearAddSupplierForm() {
    if (addSupplierForm) addSupplierForm.reset();
    hideError('addSupplierError');
}

async function handleAddSupplierSubmit(event) {
    event.preventDefault();
    if (!db) { console.error("Firestore DB not available."); showError('addSupplierError', 'Database connection failed.'); return; }
    if (!saveSupplierBtn) { return; } // Avoid multiple submits

    saveSupplierBtn.disabled = true;
    saveSupplierBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    hideError('addSupplierError');

    // Get data from form
    const supplierData = {
        name: document.getElementById('addSupplierNameInput').value.trim(),
        contactPerson: document.getElementById('addSupplierContactPersonInput')?.value.trim() || "", // Optional field
        contactNo: document.getElementById('addSupplierContactInput').value.trim(),
        whatsappNo: document.getElementById('addSupplierWhatsappInput')?.value.trim() || "", // Optional
        email: document.getElementById('addSupplierEmailInput').value.trim().toLowerCase(),
        gstNo: document.getElementById('addSupplierGstInput').value.trim().toUpperCase(),
        address: document.getElementById('addSupplierAddressInput').value.trim(),
        createdAt: serverTimestamp() // Record creation time
    };

    // Basic Validation
    if (!supplierData.name || !supplierData.contactNo) {
        showError('addSupplierError', 'Supplier Name and Contact Number are required.');
        saveSupplierBtn.disabled = false;
        saveSupplierBtn.innerHTML = '<i class="fas fa-save"></i> Save Supplier';
        return;
    }

    try {
        const docRef = await addDoc(collection(db, "suppliers"), supplierData);
        console.log("Supplier added with ID: ", docRef.id);
        displaySuccessMessage(`Supplier "${supplierData.name}" added successfully.`);
        closeAddSupplierModal();
        await loadSuppliers(); // Refresh the list
    } catch (error) {
        console.error("Error adding supplier: ", error);
        showError('addSupplierError', `Failed to add supplier. Error: ${error.message}`);
    } finally {
        saveSupplierBtn.disabled = false;
        saveSupplierBtn.innerHTML = '<i class="fas fa-save"></i> Save Supplier';
    }
}


// --- Edit Supplier ---
function openEditSupplierModal(supplierData) {
    console.log("Attempting to open Edit Supplier Modal...");
     if (!editSupplierModal) {
         console.error("Edit Supplier Modal element (#editSupplierModal) not found in DOM!");
         displayGlobalError("Could not open the edit supplier form.");
         return;
     }
     console.log("Edit Supplier Modal element found. Setting display to block.");
     populateEditSupplierForm(supplierData);
     hideError('editSupplierError');
     editSupplierModal.style.display = 'block';
      // Verify if display is set correctly (for debugging)
      setTimeout(() => {
        if (window.getComputedStyle(editSupplierModal).display !== 'block') {
            console.warn("Edit Supplier Modal display style was set to 'block', but computed style is not 'block'. Check CSS conflicts.");
        } else {
             console.log("Edit Supplier Modal should be visible now.");
         }
     }, 0);
}

function closeEditSupplierModal() {
    if (editSupplierModal) editSupplierModal.style.display = 'none';
}

function populateEditSupplierForm(supplier) {
    if (!editSupplierForm) return;
    document.getElementById('editSupplierNameInput').value = supplier.name || '';
    document.getElementById('editSupplierContactPersonInput').value = supplier.contactPerson || '';
    document.getElementById('editSupplierContactInput').value = supplier.contactNo || '';
    document.getElementById('editSupplierWhatsappInput').value = supplier.whatsappNo || '';
    document.getElementById('editSupplierEmailInput').value = supplier.email || '';
    document.getElementById('editSupplierGstInput').value = supplier.gstNo || '';
    document.getElementById('editSupplierAddressInput').value = supplier.address || '';
    editingSupplierId.value = supplier.id; // Store the ID
}

async function handleEditSupplierClick(supplierId) {
    console.log(`Attempting to fetch supplier ${supplierId} for edit.`);
    if (!db || !editSupplierModal) {
        console.error("Firestore DB or Edit Modal not available.");
        displayGlobalError("Cannot initiate edit. Required resources missing.");
        return;
    }

    const supplierRef = doc(db, "suppliers", supplierId);
    try { // <<< Added try block
        const docSnap = await getDoc(supplierRef);

        if (docSnap.exists()) {
            const supplierData = { id: docSnap.id, ...docSnap.data() };
            console.log("Supplier data fetched for edit:", supplierData);
            openEditSupplierModal(supplierData); // Open modal with fetched data
        } else {
            console.error(`Supplier document not found for ID: ${supplierId}`);
            displayGlobalError("Supplier details not found. It might have been deleted.");
        }
    } catch (error) { // <<< Added catch block
        console.error(`Error fetching supplier ${supplierId} for edit:`, error);
        displayGlobalError(`Failed to load supplier details for editing. Please check console. Error: ${error.message}`);
    }
}


async function handleUpdateSupplierSubmit(event) {
    event.preventDefault();
    if (!db) { console.error("Firestore DB not available."); showError('editSupplierError', 'Database connection failed.'); return; }
    if (!updateSupplierBtn) { return; }

    const supplierId = editingSupplierId.value;
    if (!supplierId) {
        showError('editSupplierError', 'Supplier ID is missing. Cannot update.');
        return;
    }

    updateSupplierBtn.disabled = true;
    updateSupplierBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    hideError('editSupplierError');

    const supplierData = {
        name: document.getElementById('editSupplierNameInput').value.trim(),
        contactPerson: document.getElementById('editSupplierContactPersonInput')?.value.trim() || "",
        contactNo: document.getElementById('editSupplierContactInput').value.trim(),
        whatsappNo: document.getElementById('editSupplierWhatsappInput')?.value.trim() || "",
        email: document.getElementById('editSupplierEmailInput').value.trim().toLowerCase(),
        gstNo: document.getElementById('editSupplierGstInput').value.trim().toUpperCase(),
        address: document.getElementById('editSupplierAddressInput').value.trim(),
        updatedAt: serverTimestamp() // Record update time
    };

    // Basic Validation
    if (!supplierData.name || !supplierData.contactNo) {
        showError('editSupplierError', 'Supplier Name and Contact Number are required.');
        updateSupplierBtn.disabled = false;
        updateSupplierBtn.innerHTML = '<i class="fas fa-save"></i> Update Supplier';
        return;
    }

    try {
        const supplierRef = doc(db, "suppliers", supplierId);
        await updateDoc(supplierRef, supplierData);
        console.log(`Supplier ${supplierId} updated successfully.`);
        displaySuccessMessage(`Supplier "${supplierData.name}" updated successfully.`);
        closeEditSupplierModal();
        await loadSuppliers(); // Refresh the list
    } catch (error) {
        console.error(`Error updating supplier ${supplierId}:`, error);
        showError('editSupplierError', `Failed to update supplier. Error: ${error.message}`);
    } finally {
        updateSupplierBtn.disabled = false;
        updateSupplierBtn.innerHTML = '<i class="fas fa-save"></i> Update Supplier';
    }
}

// --- Delete Supplier ---
async function handleDeleteSupplierClick(supplierId) {
    console.log(`Attempting to delete supplier: ${supplierId}`);
    if (!db) { console.error("Firestore DB not available for delete."); displayGlobalError("Database connection failed."); return; }

    const supplier = currentSuppliers.find(s => s.id === supplierId);
    const supplierName = supplier ? supplier.name : `ID: ${supplierId}`;

    if (window.confirm(`Are you sure you want to delete supplier "${supplierName}"? This action cannot be undone.`)) {
        const supplierRef = doc(db, "suppliers", supplierId);
        // Optional: Add a loading indicator here if deletion takes time
        try {
            await deleteDoc(supplierRef);
            console.log(`Supplier ${supplierId} successfully deleted from Firestore.`);
            displaySuccessMessage(`Supplier "${supplierName}" deleted successfully.`); // Display success message

            // Refresh the supplier list on the UI <<<< THIS IS THE FIX
            await loadSuppliers();

        } catch (error) {
            console.error(`Error deleting supplier ${supplierId}:`, error);
            displayGlobalError(`Failed to delete supplier "${supplierName}". Please try again. Error: ${error.message}`);
        } finally {
            // Optional: Remove loading indicator here
        }
    } else {
        console.log(`Deletion cancelled for supplier ${supplierId}.`);
    }
}

// --- Supplier Filtering (Example) ---
function filterSuppliers() {
    if (!supplierFilterInput) return; // Only filter if input exists
    const filterText = supplierFilterInput.value.toLowerCase();
    const filteredSuppliers = currentSuppliers.filter(supplier => {
        return (supplier.name?.toLowerCase().includes(filterText) ||
                supplier.contactNo?.toLowerCase().includes(filterText) ||
                supplier.email?.toLowerCase().includes(filterText));
    });
    renderSupplierTable(filteredSuppliers);
}

// --- Handle Supplier Table Actions (Edit/Delete/View) ---
// This function uses event delegation on the table body
function handleSupplierTableActions(event) {
    const targetButton = event.target.closest('button.icon-button'); // Find the closest button with the icon-button class

    if (!targetButton) {
        // console.log("Clicked inside table body, but not on an action button.");
        return; // Exit if the click wasn't on or inside an icon button
    }

    const supplierId = targetButton.dataset.id;
    if (!supplierId) {
        console.warn("Action button clicked, but it's missing the data-id attribute:", targetButton);
        return; // Exit if the button doesn't have a data-id
    }

    console.log(`Action button clicked: Supplier ID = ${supplierId}, Target =`, targetButton); // Log the action

    if (targetButton.classList.contains('edit-button')) {
        console.log(`Edit action triggered for supplier ID: ${supplierId}`);
        handleEditSupplierClick(supplierId); // Call the specific edit handler
    } else if (targetButton.classList.contains('delete-button')) {
        console.log(`Delete action triggered for supplier ID: ${supplierId}`);
        handleDeleteSupplierClick(supplierId); // Call the specific delete handler
    } else if (targetButton.classList.contains('view-button')) {
        console.log(`View action triggered for supplier ID: ${supplierId}`);
        // Redirect to the detail page
        window.location.href = `supplier_account_detail.html?supplierId=${supplierId}`;
    } else {
        console.log("Clicked on an unknown icon button within the table:", targetButton);
    }
}


// --- PO Management Functions --- (Placeholders/Basic Structure) ---
async function loadPOs() {
     console.log("Loading Purchase Orders...");
     if (!db) { console.error("Firestore DB not available."); displayGlobalError("Database connection failed."); return; }
     if (poLoadingMessage) poLoadingMessage.style.display = 'block';
     if (poTableBody) poTableBody.innerHTML = '';
     hideError('poListError');

     // Basic query - adjust as needed (e.g., add filters, pagination)
     const poRef = collection(db, "purchaseOrders");
     try {
         // Example: Order by creation date descending
         const q = query(poRef, orderBy("createdAt", "desc"), limit(25)); // Limit for initial load
         const querySnapshot = await getDocs(q);
         currentPOs = []; // Reset local cache
         querySnapshot.forEach((doc) => {
             currentPOs.push({ id: doc.id, ...doc.data() });
         });
         console.log(`Workspaceed ${currentPOs.length} POs.`);
         renderPOTable(currentPOs);
         if (poLoadingMessage) poLoadingMessage.style.display = 'none';
         if (currentPOs.length === 0) {
             if (poTableBody) poTableBody.innerHTML = '<tr><td colspan="7">No purchase orders found.</td></tr>'; // Adjust colspan
         }
     } catch (error) {
         console.error("Error loading POs: ", error);
         showError('poListError', `Failed to load purchase orders. Error: ${error.message}`);
         if (poLoadingMessage) poLoadingMessage.style.display = 'none';
     }
 }

 function renderPOTable(posToRender) {
     if (!poTableBody) return;
     poTableBody.innerHTML = '';

     if (posToRender.length === 0) {
         poTableBody.innerHTML = '<tr><td colspan="7">No purchase orders match the current filters.</td></tr>'; // Adjust colspan
         return;
     }

     posToRender.forEach(po => {
         const row = poTableBody.insertRow();
         const supplierName = supplierNameMap[po.supplierId] || 'Unknown Supplier'; // Use the map
         const poDate = po.poDate?.toDate ? po.poDate.toDate().toLocaleDateString() : 'N/A';
         const totalAmount = typeof po.totalAmount === 'number' ? `₹${po.totalAmount.toFixed(2)}` : 'N/A';

         row.innerHTML = `
             <td>${po.poNumber || 'N/A'}</td>
             <td>${supplierName}</td>
             <td>${poDate}</td>
             <td>${totalAmount}</td>
             <td>${po.status || 'Pending'}</td>
             <td>${po.paymentStatus || 'Unpaid'}</td>
             <td class="actions-cell">
                 <button class="button icon-button view-po-button" data-id="${po.id}" title="View PO Details"><i class="fas fa-eye"></i></button>
                  <button class="button icon-button share-po-button" data-id="${po.id}" title="Share PO"><i class="fas fa-share-alt"></i></button>
                 <%-- Add Edit/Delete PO buttons if needed --%>
             </td>
         `;
     });
 }

// --- Event Listeners Setup ---
function setupEventListeners() {
    console.log("Setting up event listeners v24...");

    // Supplier Listeners
    if (addSupplierBtn) addSupplierBtn.addEventListener('click', openAddSupplierModal);
    if (addSupplierForm) addSupplierForm.addEventListener('submit', handleAddSupplierSubmit);
    if (cancelAddSupplierBtn) cancelAddSupplierBtn.addEventListener('click', closeAddSupplierModal);
    if (addSupplierModal) addSupplierModal.addEventListener('click', (event) => { if (event.target === addSupplierModal) closeAddSupplierModal(); }); // Close on backdrop click

    if (editSupplierForm) editSupplierForm.addEventListener('submit', handleUpdateSupplierSubmit);
    if (cancelEditSupplierBtn) cancelEditSupplierBtn.addEventListener('click', closeEditSupplierModal);
    if (editSupplierModal) editSupplierModal.addEventListener('click', (event) => { if (event.target === editSupplierModal) closeEditSupplierModal(); }); // Close on backdrop click

    // Use event delegation for dynamically added Edit/Delete/View buttons in the supplier table
    if (supplierTableBody) supplierTableBody.addEventListener('click', handleSupplierTableActions);

    // Supplier Filtering Listener (Example)
    if (supplierFilterInput) supplierFilterInput.addEventListener('input', filterSuppliers);

    // PO Listeners (Add as needed, e.g., for filters, view PO button)
    // Example: Event delegation for PO actions
     if (poTableBody) {
         poTableBody.addEventListener('click', (event) => {
             const targetButton = event.target.closest('button.icon-button');
             if (!targetButton) return;
             const poId = targetButton.dataset.id;
             if (!poId) return;

             if (targetButton.classList.contains('view-po-button')) {
                 console.log(`View PO clicked: ${poId}`);
                 // Add function to handle viewing PO details, maybe open a modal
                 // openPoDetailsModal(poId);
                 alert(`View PO ${poId} - Needs Implementation`);
             } else if (targetButton.classList.contains('share-po-button')) {
                  console.log(`Share PO clicked: ${poId}`);
                  // openPoShareModal(poId); // Ensure this function exists and works
                  alert(`Share PO ${poId} - Needs Implementation`);
             }
             // Add other PO action handlers (edit, delete) if needed
         });
     }

    console.log("Event listeners setup complete v24.");
}


// --- Initialization ---
async function initializeSupplierManagementPage() {
     console.log("Initializing Supplier Management Page v24...");
     if (window.supplierManagementPageInitialized) {
         console.log("Page already initialized. Skipping.");
         return;
     }
     if (!db || !auth) { console.error("Firebase db or auth instance not available!"); displayGlobalError("Core Firebase services failed to load."); return; }

     setupEventListeners(); // Setup listeners first

     // Use onAuthStateChanged to ensure user is logged in before loading data
     onAuthStateChanged(auth, async (user) => {
         if (user) {
             console.log("User is authenticated. Loading data...");
             // Load initial data
             await loadSuppliers(); // Load suppliers first to populate map
             await loadPOs(); // Then load POs
             // Any other initial setup after data load
         } else {
             console.log("User is not authenticated. Redirecting or showing login.");
             // Optionally redirect to login page
             // window.location.href = 'login.html';
             displayGlobalError("Please log in to view supplier and PO information.");
             if (supplierLoadingMessage) supplierLoadingMessage.style.display = 'none';
             if (poLoadingMessage) poLoadingMessage.style.display = 'none';
         }
     });

     window.supplierManagementPageInitialized = true; // Mark as initialized
     console.log("Supplier Management Page Initialized v24.");
 }


// Make initialization function global if needed by other scripts or inline calls
window.initializeSupplierManagementPage = initializeSupplierManagementPage;

console.log("supplier_management.js v24 loaded.");

// Attempt immediate initialization if possible, otherwise wait for DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
      console.log("DOMContentLoaded fired. Calling initializeSupplierManagementPage.");
      if (typeof initializeSupplierManagementPage === 'function') {
          initializeSupplierManagementPage();
      } else {
          console.error("initializeSupplierManagementPage not defined at DOMContentLoaded.");
          displayGlobalError("Initialization function failed to load.");
      }
  });
} else {
  console.log("DOM already loaded. Calling initializeSupplierManagementPage immediately.");
   if (typeof initializeSupplierManagementPage === 'function') {
       initializeSupplierManagementPage();
   } else {
       console.error("initializeSupplierManagementPage not defined when DOM already loaded.");
       displayGlobalError("Initialization function failed to load.");
   }
}