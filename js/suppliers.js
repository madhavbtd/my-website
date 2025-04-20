// js/suppliers.js
// Handles Supplier Management Page Logic

// Ensure Firebase functions are globally available (set in suppliers.html)
const {
    db, collection, onSnapshot, query, orderBy, doc, addDoc, setDoc, deleteDoc, Timestamp, serverTimestamp
} = window;

// --- DOM Elements ---
// Declared globally, assigned in initializeSuppliersPage
let supplierTableBody, loadingRow, searchInput, clearFiltersBtn, totalSuppliersSpan,
    addNewSupplierBtn, supplierModal, closeModalBtn, cancelBtn, supplierForm, modalTitle,
    supplierIdInput, supplierNameInput, contactPersonInput, phoneInput, emailInput,
    addressInput, saveSupplierBtn, modalError;

// --- Global State ---
let unsubscribeSuppliers = null;
let allSuppliersCache = [];
let searchDebounceTimer;
let currentEditId = null;

// --- Initialization Function ---
// Called by suppliers.html AFTER auth is confirmed
function initializeSuppliersPage() {
    console.log("DEBUG: suppliers.js - initializeSuppliersPage function started.");

    // Assign DOM elements now
    supplierTableBody = document.getElementById('supplierTableBody');
    // loadingRow = document.getElementById('loadingMessage'); // No longer needed as initial state is handled by HTML/Auth check
    searchInput = document.getElementById('filterSearch');
    clearFiltersBtn = document.getElementById('clearFiltersBtn');
    totalSuppliersSpan = document.getElementById('total-suppliers');
    addNewSupplierBtn = document.getElementById('addNewSupplierBtn');
    supplierModal = document.getElementById('supplierModal');
    closeModalBtn = document.getElementById('closeSupplierModal');
    cancelBtn = document.getElementById('cancelBtn');
    supplierForm = document.getElementById('supplierForm');
    modalTitle = document.getElementById('modalTitle');
    supplierIdInput = document.getElementById('supplierId');
    supplierNameInput = document.getElementById('supplierName');
    contactPersonInput = document.getElementById('contactPerson');
    phoneInput = document.getElementById('phone');
    emailInput = document.getElementById('email');
    addressInput = document.getElementById('address');
    saveSupplierBtn = document.getElementById('saveSupplierBtn');
    modalError = document.getElementById('modalError');

    // Check if core elements exist
    if (!supplierTableBody || !supplierModal || !supplierForm || !addNewSupplierBtn || !closeModalBtn || !cancelBtn || !supplierForm || !saveSupplierBtn) {
         console.error("CRITICAL: One or more essential page elements not found in suppliers.js! Functionality might be broken.");
         alert("Error: Page elements missing. Cannot initialize supplier management.");
         return;
    }

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
        const actionButton = target.closest('.edit-button, .delete-button');
        if (!actionButton) return;
        const row = actionButton.closest('tr');
        if (!row || !row.dataset.id) return;

        const firestoreId = row.dataset.id;
        const supplierData = allSuppliersCache.find(s => s.id === firestoreId);
        if (!supplierData) {
            console.warn(`[DEBUG] Supplier data not found in cache for ID: ${firestoreId}`);
            alert("Could not find supplier data.");
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
    if (unsubscribeSuppliers) { unsubscribeSuppliers(); unsubscribeSuppliers = null; }
    if (!db || !collection || !query || !orderBy || !onSnapshot) {
         console.error("Firestore listener functions missing in suppliers.js.");
         if (supplierTableBody) supplierTableBody.innerHTML = `<tr><td colspan="5" style="color: red;">Error: DB functions not ready.</td></tr>`;
         return;
    }

    // Initial display before listener fires
    if (supplierTableBody) supplierTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 15px;"><i class="fas fa-spinner fa-spin"></i> Loading supplier list...</td></tr>`;

    try {
        const q = query(collection(db, "suppliers"), orderBy("supplierName", "asc"));
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
            applyFilterAndRender();
        }, (error) => {
            console.error("[DEBUG] Error fetching suppliers snapshot:", error);
            if (supplierTableBody) { supplierTableBody.innerHTML = `<tr><td colspan="5" style="color: red; text-align: center;">Error loading suppliers. Check console.</td></tr>`; }
        });
    } catch (error) {
        console.error("[DEBUG] Error setting up Firestore listener:", error);
        if (supplierTableBody) { supplierTableBody.innerHTML = `<tr><td colspan="5" style="color: red; text-align: center;">Critical error setting up listener.</td></tr>`; }
    }
}

// --- Filtering and Rendering ---
function handleSearchInput() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(applyFilterAndRender, 300);
}

function clearSearch() {
    if (searchInput) searchInput.value = '';
    applyFilterAndRender();
}

function applyFilterAndRender() {
    if (!allSuppliersCache) return;
    if (!supplierTableBody) return;

    const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : '';
    let filteredSuppliers = allSuppliersCache.filter(supplier => {
        if (!searchValue) return true;
        return (supplier.name.toLowerCase().includes(searchValue) ||
                supplier.contact.toLowerCase().includes(searchValue) ||
                supplier.phone.toLowerCase().includes(searchValue) ||
                supplier.email.toLowerCase().includes(searchValue));
    });

    updateSupplierCount(filteredSuppliers.length);
    renderTable(filteredSuppliers);
}

function updateSupplierCount(count) {
     if (totalSuppliersSpan) totalSuppliersSpan.textContent = count;
}

function renderTable(suppliersToRender) {
     if (!supplierTableBody) return;
    supplierTableBody.innerHTML = '';

    if (suppliersToRender.length === 0) {
        const message = searchInput?.value ? "No suppliers found matching search." : "No suppliers added yet.";
        supplierTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 15px; color: #555;">${message}</td></tr>`;
    } else {
        suppliersToRender.forEach(supplier => {
            const tableRow = document.createElement('tr');
            tableRow.setAttribute('data-id', supplier.id);
            const escape = (str) => String(str).replace(/[&<>"']/g, (match) => ({'&': '&amp;','<': '&lt;','>': '&gt;','"': '&quot;',"'": '&#39;'})[match]);
            tableRow.innerHTML = `
                <td>${escape(supplier.name)}</td>
                <td>${escape(supplier.contact)}</td>
                <td>${escape(supplier.phone)}</td>
                <td>${escape(supplier.email)}</td>
                <td style="text-align: center; white-space: nowrap;">
                    <button type="button" class="button edit-button" style="background-color:#ffc107; color:#333; padding: 4px 8px; font-size: 0.8em; margin-right: 5px;" title="Edit Supplier"><i class="fas fa-edit"></i> Edit</button>
                    <button type="button" class="button delete-button" style="background-color:#dc3545; color:white; padding: 4px 8px; font-size: 0.8em;" title="Delete Supplier"><i class="fas fa-trash-alt"></i> Delete</button>
                </td>
            `;
            supplierTableBody.appendChild(tableRow);
        });
    }
}

// --- Modal Handling ---
function openAddModal() {
    console.log("DEBUG: Opening Add Supplier Modal");
    currentEditId = null;
    if(supplierForm) supplierForm.reset();
    if(modalTitle) modalTitle.textContent = 'Add New Supplier';
    if(supplierIdInput) supplierIdInput.value = '';
    clearModalError();
    if(supplierModal) supplierModal.style.display = 'flex';
    if(supplierNameInput) supplierNameInput.focus();
}

function openEditModal(firestoreId, supplierData) {
     console.log(`DEBUG: Opening Edit Supplier Modal for ID: ${firestoreId}`);
    currentEditId = firestoreId;
    if(supplierForm) supplierForm.reset();
    if(modalTitle) modalTitle.textContent = 'Edit Supplier';
    clearModalError();
    if(supplierIdInput) supplierIdInput.value = firestoreId;
    if(supplierNameInput) supplierNameInput.value = supplierData.name || '';
    if(contactPersonInput) contactPersonInput.value = supplierData.contact || '';
    if(phoneInput) phoneInput.value = supplierData.phone || '';
    if(emailInput) emailInput.value = supplierData.email || '';
    if(addressInput) addressInput.value = supplierData.address || '';
    if(supplierModal) supplierModal.style.display = 'flex';
    if(supplierNameInput) supplierNameInput.focus();
}

function closeSupplierModal() {
    console.log("DEBUG: Closing Supplier Modal");
    if(supplierModal) supplierModal.style.display = 'none';
    if(supplierForm) supplierForm.reset();
    currentEditId = null;
    clearModalError();
}

// --- Form Submission (Save/Update) ---
async function handleSaveSupplier(event) {
    event.preventDefault();
    console.log("DEBUG: handleSaveSupplier called. Edit Mode:", currentEditId ? `Yes (${currentEditId})` : "No");
    if (!db || !collection || !addDoc || !doc || !setDoc || !serverTimestamp || !saveSupplierBtn) {
        showModalError("Error: DB functions not ready or button missing."); return;
    }
    const supplierData = {
        supplierName: supplierNameInput.value.trim(),
        contactPerson: contactPersonInput.value.trim(),
        phone: phoneInput.value.trim(),
        email: emailInput.value.trim(),
        address: addressInput.value.trim(),
    };
    if (!supplierData.supplierName) { showModalError("Supplier Name is required."); return; }

    saveSupplierBtn.disabled = true;
    saveSupplierBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    clearModalError();

    try {
        supplierData.updatedAt = serverTimestamp(); // Add/update timestamp
        if (currentEditId) {
            console.log(`[DEBUG] Attempting to update supplier ID: ${currentEditId}`);
            await setDoc(doc(db, "suppliers", currentEditId), supplierData, { merge: true });
            alert("Supplier updated successfully!");
        } else {
            console.log("[DEBUG] Attempting to add new supplier...");
            supplierData.createdAt = serverTimestamp(); // Add createdAt only for new doc
            const docRef = await addDoc(collection(db, "suppliers"), supplierData);
            console.log("[DEBUG] New supplier added ID:", docRef.id);
            alert("Supplier added successfully!");
        }
        closeSupplierModal();
    } catch (error) {
        console.error("Error saving supplier:", error);
        showModalError("Error saving: " + error.message);
        alert("Error saving supplier.");
    } finally {
        saveSupplierBtn.disabled = false;
        saveSupplierBtn.innerHTML = '<i class="fas fa-save"></i> Save Supplier';
    }
}

// --- Delete Supplier ---
async function handleDeleteSupplier(firestoreId, supplierName) {
    console.log(`DEBUG: handleDeleteSupplier called for ID: ${firestoreId}`);
    if (!db || !doc || !deleteDoc) { alert("Delete function unavailable."); return; }
    if (!confirm(`Confirm deletion of supplier: "${supplierName}"?`)) return;

    console.log("[DEBUG] Proceeding with deletion:", firestoreId);
    try {
        await deleteDoc(doc(db, "suppliers", firestoreId));
        alert(`Supplier "${supplierName}" deleted.`);
    } catch (error) {
        console.error("Error deleting supplier:", error);
        alert("Error deleting supplier: " + error.message);
    }
}

// --- Modal Error Helper ---
function showModalError(message) { if (modalError) modalError.textContent = message; }
function clearModalError() { if (modalError) modalError.textContent = ''; }

// --- Final Log ---
console.log("suppliers.js script fully loaded and parsed. Waiting for initializeSuppliersPage call.");