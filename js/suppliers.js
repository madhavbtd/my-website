// js/suppliers.js
// Handles Supplier Management Page Logic

// Ensure Firebase functions are globally available (set in suppliers.html)
// These variables are expected to be on the window object
const {
    db, collection, onSnapshot, query, orderBy, doc, addDoc, setDoc, deleteDoc, Timestamp, serverTimestamp
} = window;

// --- DOM Elements ---
// We fetch elements inside initializeSuppliersPage AFTER the DOM is ready and auth is confirmed.
let supplierTableBody, loadingRow, searchInput, clearFiltersBtn, totalSuppliersSpan,
    addNewSupplierBtn, supplierModal, closeModalBtn, cancelBtn, supplierForm, modalTitle,
    supplierIdInput, supplierNameInput, contactPersonInput, phoneInput, emailInput,
    addressInput, saveSupplierBtn, modalError;

// --- Global State ---
let unsubscribeSuppliers = null;
let allSuppliersCache = []; // Stores ALL raw supplier data
let searchDebounceTimer;
let currentEditId = null; // Track if editing

// --- Initialization Function ---
// This function is called by suppliers.html AFTER auth is confirmed and main content is shown
function initializeSuppliersPage() {
    console.log("DEBUG: suppliers.js - initializeSuppliersPage function started.");

    // Get DOM elements now that the page content is definitely visible
    supplierTableBody = document.getElementById('supplierTableBody');
    loadingRow = document.getElementById('loadingMessage');
    searchInput = document.getElementById('filterSearch');
    clearFiltersBtn = document.getElementById('clearFiltersBtn');
    totalSuppliersSpan = document.getElementById('total-suppliers');
    addNewSupplierBtn = document.getElementById('addNewSupplierBtn');
    supplierModal = document.getElementById('supplierModal');
    closeModalBtn = document.getElementById('closeSupplierModal');
    cancelBtn = document.getElementById('cancelBtn');
    supplierForm = document.getElementById('supplierForm');
    modalTitle = document.getElementById('modalTitle');
    supplierIdInput = document.getElementById('supplierId'); // Hidden input
    supplierNameInput = document.getElementById('supplierName');
    contactPersonInput = document.getElementById('contactPerson');
    phoneInput = document.getElementById('phone');
    emailInput = document.getElementById('email');
    addressInput = document.getElementById('address');
    saveSupplierBtn = document.getElementById('saveSupplierBtn');
    modalError = document.getElementById('modalError');

    // Check if core elements exist before proceeding
    if (!supplierTableBody || !supplierModal || !supplierForm) {
         console.error("CRITICAL: Core elements (supplierTableBody, supplierModal, supplierForm) not found in suppliers.js! Cannot initialize fully.");
         // Optionally display an error to the user on the page
         if(loadingRow) loadingRow.innerHTML = '<td colspan="5" style="color: red;">Error initializing page elements.</td>';
         return; // Stop initialization
    }

    // Clear loading message explicitly now
     if (loadingRow) loadingRow.parentElement.removeChild(loadingRow); // Remove the loading row itself

    console.log("[DEBUG] Initializing Suppliers Page Listeners and Logic...");

    // Start Firestore listener
    listenForSuppliers();

    // Attach Event Listeners
    if (searchInput) searchInput.addEventListener('input', handleSearchInput);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearSearch);
    if (addNewSupplierBtn) addNewSupplierBtn.addEventListener('click', openAddModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeSupplierModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeSupplierModal);
    if (supplierModal) supplierModal.addEventListener('click', (event) => { if (event.target === supplierModal) closeSupplierModal(); });
    if (supplierForm) supplierForm.addEventListener('submit', handleSaveSupplier);

    // Event Delegation for table buttons (Edit/Delete)
    supplierTableBody.addEventListener('click', function(event) {
        const target = event.target;
        // Find the closest button first, then the row
        const actionButton = target.closest('.edit-button, .delete-button');
        if (!actionButton) return; // Exit if the click wasn't on an action button

        const row = actionButton.closest('tr');
        if (!row || !row.dataset.id) return; // Exit if row or data-id is missing

        const firestoreId = row.dataset.id;
        const supplierData = allSuppliersCache.find(s => s.id === firestoreId);
        if (!supplierData) {
            console.warn(`[DEBUG] Supplier data not found in cache for ID: ${firestoreId}`);
            alert("Could not find supplier data for this action.");
            return;
        }

        if (actionButton.classList.contains('edit-button')) {
             console.log(`Edit button clicked for ID: ${firestoreId}`);
            openEditModal(firestoreId, supplierData);
        } else if (actionButton.classList.contains('delete-button')) {
             console.log(`Delete button clicked for ID: ${firestoreId}`);
            handleDeleteSupplier(firestoreId, supplierData.name);
        }
    });

    console.log("[DEBUG] Suppliers Page Initialization Complete (suppliers.js).");
}
// Make initialize function global so suppliers.html can call it
window.initializeSuppliersPage = initializeSuppliersPage;


// --- Firestore Listener ---
function listenForSuppliers() {
    console.log("DEBUG: Setting up Firestore listener for suppliers...");
    if (unsubscribeSuppliers) { unsubscribeSuppliers(); unsubscribeSuppliers = null; console.log("DEBUG: Unsubscribed from previous supplier listener.");}
    if (!db || !collection || !query || !orderBy || !onSnapshot) {
         console.error("Firestore listener functions missing in suppliers.js.");
         if (supplierTableBody) supplierTableBody.innerHTML = `<tr><td colspan="5" style="color: red;">Error: DB functions not ready.</td></tr>`;
         return;
    }

    // Initial display before listener fires
    if (supplierTableBody) supplierTableBody.innerHTML = `<tr><td colspan="5">Loading supplier list...</td></tr>`;

    try {
        const q = query(collection(db, "suppliers"), orderBy("supplierName", "asc")); // Order by name
        unsubscribeSuppliers = onSnapshot(q, (snapshot) => {
            console.log(`[DEBUG] Supplier snapshot received. ${snapshot.size} total documents.`);
            allSuppliersCache = snapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().supplierName || '',
                contact: doc.data().contactPerson || '',
                phone: doc.data().phone || '',
                email: doc.data().email || '',
                address: doc.data().address || ''
            }));
            console.log(`[DEBUG] allSuppliersCache populated with ${allSuppliersCache.length} suppliers.`);
            applyFilterAndRender(); // Apply search filter (if any) and render
        }, (error) => {
            console.error("[DEBUG] Error fetching suppliers snapshot:", error);
            if (supplierTableBody) { supplierTableBody.innerHTML = `<tr><td colspan="5" style="color: red;">Error loading suppliers. Please check console and try again.</td></tr>`; }
        });
    } catch (error) {
        console.error("[DEBUG] Error setting up Firestore listener:", error);
        if (supplierTableBody) { supplierTableBody.innerHTML = `<tr><td colspan="5" style="color: red;">Critical error setting up listener.</td></tr>`; }
    }
}

// --- Filtering and Rendering ---
function handleSearchInput() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(applyFilterAndRender, 300); // Debounce search
}

function clearSearch() {
    if (searchInput) searchInput.value = '';
    applyFilterAndRender();
}

function applyFilterAndRender() {
    if (!allSuppliersCache) { console.warn("[DEBUG] applyFilterAndRender called but cache is empty."); return; }
    if (!supplierTableBody) { console.error("[DEBUG] applyFilterAndRender called but supplierTableBody is missing."); return;} // Added check

    const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : '';

    // Filter
    let filteredSuppliers = allSuppliersCache.filter(supplier => {
        if (!searchValue) return true; // No search term, show all
        const nameMatch = supplier.name.toLowerCase().includes(searchValue);
        const contactMatch = supplier.contact.toLowerCase().includes(searchValue);
        const phoneMatch = supplier.phone.toLowerCase().includes(searchValue);
        const emailMatch = supplier.email.toLowerCase().includes(searchValue);
        // Add address search if needed: const addressMatch = supplier.address.toLowerCase().includes(searchValue);
        return nameMatch || contactMatch || phoneMatch || emailMatch; // || addressMatch;
    });

    // Update Counts
    updateSupplierCount(filteredSuppliers.length);

    // Render table
    renderTable(filteredSuppliers);
}

function updateSupplierCount(count) {
     if (totalSuppliersSpan) totalSuppliersSpan.textContent = count;
}

function renderTable(suppliersToRender) {
     if (!supplierTableBody) { console.error("renderTable called but supplierTableBody is not available!"); return; }
    supplierTableBody.innerHTML = ''; // Clear previous content

    if (suppliersToRender.length === 0) {
        const message = searchInput?.value ? "No suppliers found matching your search." : "No suppliers added yet. Click 'Add New Supplier'.";
        supplierTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 15px; color: #555;">${message}</td></tr>`;
    } else {
        suppliersToRender.forEach(supplier => {
            const tableRow = document.createElement('tr');
            tableRow.setAttribute('data-id', supplier.id); // Use Firestore ID

            // Escape HTML characters for safety
            const escape = (str) => String(str).replace(/[&<>"']/g, (match) => ({'&': '&amp;','<': '&lt;','>': '&gt;','"': '&quot;',"'": '&#39;'})[match]);

            tableRow.innerHTML = `
                <td>${escape(supplier.name)}</td>
                <td>${escape(supplier.contact)}</td>
                <td>${escape(supplier.phone)}</td>
                <td>${escape(supplier.email)}</td>
                <td style="text-align: center; white-space: nowrap;">
                    <button type="button" class="button edit-button" style="background-color:#ffc107; color:#333; padding: 4px 8px; font-size: 0.8em; margin-right: 5px;" title="Edit Supplier">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button type="button" class="button delete-button" style="background-color:#dc3545; color:white; padding: 4px 8px; font-size: 0.8em;" title="Delete Supplier">
                        <i class="fas fa-trash-alt"></i> Delete
                    </button>
                </td>
            `;
            supplierTableBody.appendChild(tableRow);
        });
    }
}

// --- Modal Handling (Add/Edit) ---
function openAddModal() {
    console.log("DEBUG: Opening Add Supplier Modal");
    currentEditId = null; // Ensure not in edit mode
    if (supplierForm) supplierForm.reset(); // Clear form fields
    if (modalTitle) modalTitle.textContent = 'Add New Supplier';
    if (supplierIdInput) supplierIdInput.value = ''; // Clear hidden ID field
    clearModalError(); // Clear previous errors
    if (supplierModal) supplierModal.style.display = 'flex';
     if (supplierNameInput) supplierNameInput.focus(); // Focus on first field
}

function openEditModal(firestoreId, supplierData) {
     console.log(`DEBUG: Opening Edit Supplier Modal for ID: ${firestoreId}`);
    currentEditId = firestoreId; // Set edit mode
    if (supplierForm) supplierForm.reset(); // Clear first
    if (modalTitle) modalTitle.textContent = 'Edit Supplier';
    clearModalError();

    // Populate form
    if (supplierIdInput) supplierIdInput.value = firestoreId;
    if (supplierNameInput) supplierNameInput.value = supplierData.name || '';
    if (contactPersonInput) contactPersonInput.value = supplierData.contact || '';
    if (phoneInput) phoneInput.value = supplierData.phone || '';
    if (emailInput) emailInput.value = supplierData.email || '';
    if (addressInput) addressInput.value = supplierData.address || '';

    if (supplierModal) supplierModal.style.display = 'flex';
    if (supplierNameInput) supplierNameInput.focus();
}

function closeSupplierModal() {
    console.log("DEBUG: Closing Supplier Modal");
    if (supplierModal) supplierModal.style.display = 'none';
    if (supplierForm) supplierForm.reset();
    currentEditId = null; // Reset edit mode state
    clearModalError();
}

// --- Form Submission (Save/Update) ---
async function handleSaveSupplier(event) {
    event.preventDefault(); // Prevent default form submission
    console.log("DEBUG: handleSaveSupplier called. Edit Mode:", currentEditId ? `Yes (${currentEditId})` : "No");

    // Re-check for necessary functions, although they should be available
    if (!db || !collection || !addDoc || !doc || !setDoc || !serverTimestamp) {
        console.error("Database functions not available in handleSaveSupplier.");
        showModalError("Error: Database function not available. Cannot save.");
        return;
    }

    // Get form data
    const supplierData = {
        supplierName: supplierNameInput.value.trim(),
        contactPerson: contactPersonInput.value.trim(),
        phone: phoneInput.value.trim(),
        email: emailInput.value.trim(),
        address: addressInput.value.trim(),
        // updatedAt will be added below
    };

    // Basic validation
    if (!supplierData.supplierName) {
        showModalError("Supplier Name is required.");
        return;
    }

    // Disable button and clear error
    if (saveSupplierBtn) {
         saveSupplierBtn.disabled = true;
         saveSupplierBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
         clearModalError();
    }

    try {
        if (currentEditId) {
            // --- Update Existing Supplier ---
            console.log(`[DEBUG] Attempting to update supplier with ID: ${currentEditId}`);
            supplierData.updatedAt = serverTimestamp(); // Set update timestamp
            const supplierRef = doc(db, "suppliers", currentEditId);
            // Using setDoc with merge: true ensures we only update the fields provided
            // and don't overwrite fields not included in supplierData (like createdAt)
            await setDoc(supplierRef, supplierData, { merge: true });
            console.log("[DEBUG] Supplier update successful.");
            alert("Supplier updated successfully!");
        } else {
            // --- Add New Supplier ---
             console.log("[DEBUG] Attempting to add new supplier...");
             supplierData.createdAt = serverTimestamp(); // Add createdAt timestamp
             supplierData.updatedAt = serverTimestamp(); // Also add updatedAt on creation
             const docRef = await addDoc(collection(db, "suppliers"), supplierData);
             console.log("[DEBUG] New supplier added successfully with ID:", docRef.id);
             alert("Supplier added successfully!");
        }
        closeSupplierModal(); // Close modal on success

    } catch (error) {
        console.error("Error saving supplier to Firestore:", error);
        showModalError("Error saving supplier: " + error.message);
         alert("Error saving supplier. Check console for details.");
    } finally {
        // Re-enable button regardless of success or failure
         if (saveSupplierBtn) {
             saveSupplierBtn.disabled = false;
             saveSupplierBtn.innerHTML = '<i class="fas fa-save"></i> Save Supplier';
        }
    }
}

// --- Delete Supplier ---
async function handleDeleteSupplier(firestoreId, supplierName) {
    console.log(`DEBUG: handleDeleteSupplier called for ID: ${firestoreId}, Name: ${supplierName}`);
    if (!db || !doc || !deleteDoc) {
        console.error("Delete function unavailable.");
        alert("Delete function unavailable.");
        return;
    }
    // Confirmation dialog
    if (!confirm(`Are you absolutely sure you want to delete supplier: "${supplierName}"?\nThis action cannot be undone.`)) {
        console.log("[DEBUG] Deletion cancelled by user.");
        return;
    }

    console.log("[DEBUG] Proceeding with deletion for:", firestoreId);
    try {
        await deleteDoc(doc(db, "suppliers", firestoreId));
        console.log("[DEBUG] Supplier deleted successfully from Firestore.");
        alert(`Supplier "${supplierName}" deleted successfully.`);
        // Table will update automatically via the onSnapshot listener
    } catch (error) {
        console.error("Error deleting supplier from Firestore:", error);
        alert("Error deleting supplier: " + error.message);
    }
}

// --- Modal Error Helper ---
function showModalError(message) {
     if (modalError) {
         modalError.textContent = message;
         console.log("DEBUG: Modal Error Displayed - ", message); // Log modal errors too
     }
}
function clearModalError() {
    if (modalError) modalError.textContent = '';
}


// --- Final Log ---
console.log("suppliers.js script fully loaded and parsed. Waiting for initializeSuppliersPage call from HTML.");