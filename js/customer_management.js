// js/customer_management.js
// Version 1.2 (Added Debugging for Return Redirect)

// --- Ensure Firestore functions are available globally ---
const { db, collection, onSnapshot, query, orderBy, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, runTransaction, getDoc } = window;

// --- DOM Elements ---
const customerTableBody = document.getElementById('customerTableBody');
const loadingRow = document.getElementById('loadingMessage');
const sortSelect = document.getElementById('sort-customers');
const filterSearchInput = document.getElementById('filterSearch');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const addNewCustomerBtn = document.getElementById('addNewCustomerBtn');

// Modal Elements
const customerModal = document.getElementById('customerModal');
const modalTitle = document.getElementById('modalTitle');
const customerForm = document.getElementById('customerForm');
const closeCustomerModalBtn = document.getElementById('closeCustomerModal');
const cancelCustomerBtn = document.getElementById('cancelCustomerBtn');
const saveCustomerBtn = document.getElementById('saveCustomerBtn');
const saveCustomerBtnText = saveCustomerBtn ? saveCustomerBtn.querySelector('span') : null; // Added check
const editCustomerIdInput = document.getElementById('editCustomerId'); // Hidden input for Firestore ID

// Modal Form Fields
const customerFullNameInput = document.getElementById('customerFullName');
const customerWhatsAppInput = document.getElementById('customerWhatsApp');
const customerContactInput = document.getElementById('customerContact');
const customerAddressInput = document.getElementById('customerAddress');
const customIdDisplayArea = document.getElementById('customIdDisplayArea');
const generatedCustomIdInput = document.getElementById('generatedCustomId');


// --- Global State ---
let currentSortField = 'createdAt';
let currentSortDirection = 'desc';
let unsubscribeCustomers = null;
let allCustomersCache = []; // Stores ALL raw customer data from Firestore
let searchDebounceTimer;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Customer Management DOM Loaded (V1.2 - Debug Return).");
    waitForDbConnection(() => {
        console.log("DB connection confirmed. Initializing listener.");
        listenForCustomers();

        // Event Listeners
        if (sortSelect) sortSelect.addEventListener('change', handleSortChange);
        if (filterSearchInput) filterSearchInput.addEventListener('input', handleSearchInput);
        if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
        if (addNewCustomerBtn) addNewCustomerBtn.addEventListener('click', openAddModal);
        if (closeCustomerModalBtn) closeCustomerModalBtn.addEventListener('click', closeCustomerModal);
        if (cancelCustomerBtn) cancelCustomerBtn.addEventListener('click', closeCustomerModal);
        if (customerModal) customerModal.addEventListener('click', (event) => {
            if (event.target === customerModal) closeCustomerModal();
        });
        if (customerForm) customerForm.addEventListener('submit', handleSaveCustomer);

        // Check URL params on load
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const action = urlParams.get('action');
            // Store returnTo globally or pass it differently if needed after cleaning URL
            const returnTo = urlParams.get('returnTo');

            if (action === 'add') {
                console.log("Action 'add' detected in URL, opening add modal.");
                openAddModal(); // Automatically open the add modal

                // Clean URL (remove action) - Keep returnTo for now
                let currentSearch = window.location.search;
                currentSearch = currentSearch.replace(/[\?&]action=add/, '');
                let cleanUrl = window.location.pathname;
                 // Reconstruct search string, keeping returnTo if present
                 const paramsOnly = new URLSearchParams(currentSearch);
                 const returnParam = paramsOnly.get('returnTo'); // Check if returnTo still exists
                 const otherParams = Array.from(paramsOnly.entries()).filter(([key]) => key !== 'returnTo');

                 let finalSearchParams = '';
                 if(returnParam) {
                    finalSearchParams += (finalSearchParams ? '&' : '?') + `returnTo=${returnParam}`;
                 }
                 otherParams.forEach(([key, value]) => {
                    finalSearchParams += (finalSearchParams ? '&' : '?') + `${key}=${value}`;
                 });


                window.history.replaceState({}, '', window.location.pathname + finalSearchParams);
                console.log("Cleaned URL parameters, kept returnTo if present:", window.location.search);
            }
        } catch (e) {
            console.error("Error processing URL parameters:", e);
        }

        console.log("Customer Management event listeners set up.");
    });
});

// --- DB Connection Wait ---
function waitForDbConnection(callback) {
    // ... (same as before) ...
    if (window.db) { callback(); } else {
        let attempts = 0; const maxAttempts = 20;
        const intervalId = setInterval(() => {
            attempts++;
            if (window.db) { clearInterval(intervalId); callback(); }
            else if (attempts >= maxAttempts) { clearInterval(intervalId); console.error("DB timeout"); alert("DB Error"); }
        }, 250);
    }
}


// --- Sorting Change Handler ---
function handleSortChange() {
    // ... (same as before) ...
    if (!sortSelect) return;
    const selectedValue = sortSelect.value;
    const [field, direction] = selectedValue.split('_');
    if (field && direction) {
        if (field === currentSortField && direction === currentSortDirection) return;
        currentSortField = field;
        currentSortDirection = direction;
        applyFiltersAndRender();
    }
}

// --- Filter Change Handlers ---
function handleSearchInput() {
    // ... (same as before) ...
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        applyFiltersAndRender();
    }, 300);
}

function clearFilters() {
    // ... (same as before) ...
    if(filterSearchInput) filterSearchInput.value = '';
    if(sortSelect) sortSelect.value = 'createdAt_desc';
    currentSortField = 'createdAt';
    currentSortDirection = 'desc';
    applyFiltersAndRender();
}


// --- Firestore Listener Setup ---
function listenForCustomers() {
    // ... (same as before) ...
    if (unsubscribeCustomers) { unsubscribeCustomers(); unsubscribeCustomers = null; }
    if (!db || !collection || !query || !orderBy || !onSnapshot) { console.error("Firestore functions not available!"); return; }
    if(customerTableBody) customerTableBody.innerHTML = `<tr><td colspan="6" id="loadingMessage" style="text-align: center; color: #666;">Loading customers...</td></tr>`;
    try {
        const customersRef = collection(db, "customers");
        const q = query(customersRef);
        unsubscribeCustomers = onSnapshot(q, (snapshot) => {
            allCustomersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            applyFiltersAndRender();
        }, (error) => { console.error("Error fetching customers snapshot:", error); });
    } catch (error) { console.error("Error setting up customer listener:", error); }
}


// --- Filter, Sort, and Render Function ---
function applyFiltersAndRender() {
    // ... (same as before) ...
     if (!allCustomersCache) return;
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';
    let filteredCustomers = allCustomersCache.filter(customer => {
        if (filterSearchValue) {
            const customId = (customer.customCustomerId || '').toString().toLowerCase();
            const name = (customer.fullName || '').toLowerCase();
            const whatsapp = (customer.whatsappNo || '').toLowerCase();
            const contact = (customer.contactNo || '').toLowerCase();
            const id = (customer.id || '').toLowerCase();
            if (!(customId.includes(filterSearchValue) || name.includes(filterSearchValue) || whatsapp.includes(filterSearchValue) || contact.includes(filterSearchValue) || id.includes(filterSearchValue) )) { return false; }
        }
        return true;
    });
    filteredCustomers.sort((a, b) => {
        let valA = a[currentSortField]; let valB = b[currentSortField];
        if (valA && typeof valA.toDate === 'function') valA = valA.toDate();
        if (valB && typeof valB.toDate === 'function') valB = valB.toDate();
        if (currentSortField === 'customCustomerId') { valA = Number(valA) || 0; valB = Number(valB) || 0; }
        if (currentSortField === 'fullName') { valA = (valA || '').toLowerCase(); valB = (valB || '').toLowerCase(); }
        let comparison = 0;
        if (valA > valB) { comparison = 1; } else if (valA < valB) { comparison = -1; }
        return currentSortDirection === 'desc' ? (comparison * -1) : comparison;
    });
    if (!customerTableBody) return;
    customerTableBody.innerHTML = '';
    if (filteredCustomers.length === 0) {
        customerTableBody.innerHTML = `<tr><td colspan="6" id="noCustomersMessage" style="text-align: center; color: #666;">No customers found matching filters.</td></tr>`;
    } else {
        filteredCustomers.forEach(customer => { displayCustomerRow(customer.id, customer); });
    }
}


// --- Display Single Customer Row ---
function displayCustomerRow(firestoreId, data) {
    // ... (same as before) ...
    if (!customerTableBody) return;
    const tableRow = document.createElement('tr');
    tableRow.setAttribute('data-id', firestoreId);
    const customId = data.customCustomerId || '-';
    const name = data.fullName || 'N/A';
    const whatsapp = data.whatsappNo || '-';
    const contact = data.contactNo || '-';
    const address = data.billingAddress || data.address || '-';
    tableRow.innerHTML = `
        <td>${customId}</td>
        <td>${name}</td>
        <td>${whatsapp}</td>
        <td>${contact}</td>
        <td>${address}</td>
        <td>
            <button type="button" class="action-button edit-button" title="Edit Customer"><i class="fas fa-edit"></i></button>
            <button type="button" class="action-button delete-button" title="Delete Customer"><i class="fas fa-trash-alt"></i></button>
        </td>
    `;
    tableRow.style.cursor = 'pointer';
    tableRow.addEventListener('click', () => { window.location.href = `customer_account_detail.html?id=${firestoreId}`; });
    const editButton = tableRow.querySelector('.edit-button');
    if (editButton) { editButton.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(firestoreId, data); }); }
    const deleteButton = tableRow.querySelector('.delete-button');
    if (deleteButton) { deleteButton.addEventListener('click', (e) => { e.stopPropagation(); handleDeleteCustomer(firestoreId, name); }); }
    customerTableBody.appendChild(tableRow);
}


// --- Modal Handling (Add/Edit) ---
function openAddModal() {
    // ... (same as before) ...
    console.log("Opening modal to add new customer.");
    if (!customerModal || !customerForm) return;
    modalTitle.textContent = "Add New Customer";
    editCustomerIdInput.value = '';
    customerForm.reset();
    if(customIdDisplayArea) customIdDisplayArea.style.display = 'none';
    if(saveCustomerBtnText) saveCustomerBtnText.textContent = 'Save Customer';
    if(saveCustomerBtn) saveCustomerBtn.disabled = false;
    customerModal.classList.add('active');
}

function openEditModal(firestoreId, data) {
     // ... (same as before) ...
     console.log("Opening modal to edit customer:", firestoreId);
     if (!customerModal || !customerForm) return;
     modalTitle.textContent = "Edit Customer";
     editCustomerIdInput.value = firestoreId;
     if(saveCustomerBtnText) saveCustomerBtnText.textContent = 'Update Customer';
     if(saveCustomerBtn) saveCustomerBtn.disabled = false;
     if(customerFullNameInput) customerFullNameInput.value = data.fullName || '';
     if(customerWhatsAppInput) customerWhatsAppInput.value = data.whatsappNo || '';
     if(customerContactInput) customerContactInput.value = data.contactNo || '';
     if(customerAddressInput) customerAddressInput.value = data.billingAddress || data.address || '';
     if (data.customCustomerId && generatedCustomIdInput && customIdDisplayArea) {
         generatedCustomIdInput.value = data.customCustomerId;
         customIdDisplayArea.style.display = 'block';
     } else if(customIdDisplayArea) {
         customIdDisplayArea.style.display = 'none';
     }
     customerModal.classList.add('active');
}

function closeCustomerModal() {
     // ... (same as before) ...
     if (customerModal) { customerModal.classList.remove('active'); }
}

// --- Save/Update Customer Handler (WITH TRANSACTION for Add & REDIRECT DEBUGGING) ---
async function handleSaveCustomer(event) {
    event.preventDefault();
    if (!db || !collection || !addDoc || !doc || !updateDoc || !serverTimestamp || !runTransaction || !getDoc) {
         console.error("Database functions unavailable."); alert("Database functions unavailable. Cannot save."); return;
    }
    const customerId = editCustomerIdInput.value;
    const isEditing = !!customerId;
    const fullName = customerFullNameInput.value.trim();
    const whatsappNo = customerWhatsAppInput.value.trim();
    const contactNo = customerContactInput.value.trim() || null;
    const address = customerAddressInput.value.trim() || null;
    if (!fullName || !whatsappNo) { alert("Full Name and WhatsApp Number are required."); return; }

    if(saveCustomerBtn) saveCustomerBtn.disabled = true;
    const originalButtonHTML = saveCustomerBtn ? saveCustomerBtn.innerHTML : '';
    if(saveCustomerBtn) saveCustomerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const customerDataPayload = { fullName, whatsappNo, contactNo, billingAddress: address, updatedAt: serverTimestamp() };

    // --- >>> Get return URL parameter <<< ---
    let returnUrl = null;
    let returnToValue = null; // For logging
    try {
        // Read the CURRENT URL search parameters at the time of saving
        const currentUrlParams = new URLSearchParams(window.location.search);
        returnToValue = currentUrlParams.get('returnTo');
        console.log("DEBUG: Checking for returnTo parameter. Value found:", returnToValue); // <<< DEBUG LOG

        if (returnToValue === 'order_history') {
            returnUrl = 'order_history.html';
            console.log("DEBUG: returnUrl set to:", returnUrl); // <<< DEBUG LOG
        } else {
            console.log("DEBUG: returnTo parameter is not 'order_history' or is missing."); // <<< DEBUG LOG
        }
    } catch (e) { console.error("DEBUG: Error reading URL params for return:", e);}
    // --- >>> End return URL check <<< ---

    try {
        if (isEditing) {
             console.log(`Updating customer ${customerId}...`);
             const customerRef = doc(db, "customers", customerId);
             await updateDoc(customerRef, customerDataPayload);
             console.log("Customer updated successfully.");
             alert("Customer updated successfully!");

             // --- >>> Redirect if needed, otherwise close <<< ---
             console.log(`DEBUG: Post-Update - Should redirect? ${!!returnUrl}`); // <<< DEBUG LOG
             if (returnUrl) {
                 console.log("DEBUG: Redirecting to:", returnUrl); // <<< DEBUG LOG
                 window.location.href = returnUrl;
             } else {
                 console.log("DEBUG: Closing modal instead of redirecting."); // <<< DEBUG LOG
                 closeCustomerModal();
             }
             // --- >>> End Redirect Check <<< ---

        } else {
            // --- Add new customer via Transaction ---
            console.log("Adding new customer via transaction...");
            const counterRef = doc(db, "counters", "customerCounter");
            const newCustomerColRef = collection(db, "customers");
            await runTransaction(db, async (transaction) => { /* ... transaction logic ... */
                const counterDoc = await transaction.get(counterRef);
                let nextId = 101;
                if (counterDoc.exists() && counterDoc.data().lastId) { nextId = counterDoc.data().lastId + 1; }
                else { console.log("Counter doc/field missing, starting ID at 101."); }
                customerDataPayload.customCustomerId = nextId;
                customerDataPayload.createdAt = serverTimestamp();
                customerDataPayload.status = 'active';
                const newDocRef = doc(newCustomerColRef);
                transaction.set(newDocRef, customerDataPayload);
                transaction.set(counterRef, { lastId: nextId }, { merge: true });
            });
            console.log("Transaction successful. New customer added.");
            alert("New customer added successfully!");

            // --- >>> Redirect if needed, otherwise close <<< ---
             console.log(`DEBUG: Post-Add - Should redirect? ${!!returnUrl}`); // <<< DEBUG LOG
             if (returnUrl) {
                 console.log("DEBUG: Redirecting to:", returnUrl); // <<< DEBUG LOG
                 window.location.href = returnUrl;
             } else {
                 console.log("DEBUG: Closing modal instead of redirecting."); // <<< DEBUG LOG
                 closeCustomerModal();
             }
             // --- >>> End Redirect Check <<< ---
        }
    } catch (error) {
        console.error("Error saving customer:", error);
        alert(`Error saving customer: ${error.message}`);
        if(saveCustomerBtn) saveCustomerBtn.disabled = false;
        if(saveCustomerBtn) saveCustomerBtn.innerHTML = originalButtonHTML;
    }
    // No finally block needed as redirect/close happens within try
}


// --- Delete Customer Handler ---
async function handleDeleteCustomer(firestoreId, customerName) {
    // ... (same as before) ...
    console.log(`handleDeleteCustomer called for ID: ${firestoreId}, Name: ${customerName}`);
    if (!db || !doc || !deleteDoc) { console.error("Delete function not available."); alert("Error: Delete function not available."); return; }
    if (confirm(`Are you sure you want to delete customer "${customerName}"? This action cannot be undone.`)) {
        console.log(`User confirmed deletion for ${firestoreId}. Proceeding...`);
        try {
            const customerRef = doc(db, "customers", firestoreId);
            await deleteDoc(customerRef);
            console.log(`Customer deleted successfully from Firestore: ${firestoreId}`);
            alert(`Customer "${customerName}" deleted.`);
        } catch (error) {
            console.error(`Error deleting customer ${firestoreId}:`, error);
            alert(`Failed to delete customer: ${error.message}`);
        }
    } else {
        console.log("Deletion cancelled by user.");
    }
}

// --- Final Log ---
console.log("customer_management.js (V1.2 - Debug Return) script fully loaded.");