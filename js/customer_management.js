// js/customer_management.js

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
const saveCustomerBtnText = saveCustomerBtn.querySelector('span'); // Get span inside button
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
    console.log("[DEBUG] Customer Management DOM Loaded (v5 - Custom ID).");
    waitForDbConnection(() => {
        console.log("[DEBUG] DB connection confirmed. Initializing listener.");
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

        console.log("[DEBUG] Customer Management event listeners set up.");
    });
});

// --- DB Connection Wait ---
function waitForDbConnection(callback) {
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
    if (!sortSelect) return;
    const selectedValue = sortSelect.value;
    const [field, direction] = selectedValue.split('_');
    if (field && direction) {
        if (field === currentSortField && direction === currentSortDirection) return;
        currentSortField = field;
        currentSortDirection = direction;
        console.log(`[DEBUG] Customer sort changed: ${currentSortField} ${currentSortDirection}`);
        applyFiltersAndRender();
    }
}

// --- Filter Change Handlers ---
function handleSearchInput() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        console.log("[DEBUG] Customer search processed.");
        applyFiltersAndRender();
    }, 300);
}

function clearFilters() {
    console.log("[DEBUG] Clearing customer filters.");
    if(filterSearchInput) filterSearchInput.value = '';
    // Reset sort to default when clearing filters?
    if(sortSelect) sortSelect.value = 'createdAt_desc';
    currentSortField = 'createdAt';
    currentSortDirection = 'desc';
    applyFiltersAndRender();
}


// --- Firestore Listener Setup ---
function listenForCustomers() {
    if (unsubscribeCustomers) { unsubscribeCustomers(); unsubscribeCustomers = null; }
    if (!db || !collection || !query || !orderBy || !onSnapshot) { console.error("Firestore functions not available!"); /* Error handling */ return; }

    customerTableBody.innerHTML = `<tr><td colspan="6" id="loadingMessage" style="text-align: center; color: #666;">Loading customers...</td></tr>`; // Updated colspan

    try {
        console.log(`[DEBUG] Setting up Firestore listener for 'customers'...`);
        const customersRef = collection(db, "customers");
        // Use a default query for the listener; sorting/filtering is client-side
        const q = query(customersRef); // Fetch all

        unsubscribeCustomers = onSnapshot(q, (snapshot) => {
            console.log(`[DEBUG] Received ${snapshot.docs.length} total customers from Firestore.`);
            allCustomersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            applyFiltersAndRender(); // Apply filters/sort to the new full list

        }, (error) => { console.error("Error fetching customers snapshot:", error); /* Error handling */ });
    } catch (error) { console.error("Error setting up customer listener:", error); /* Error handling */ }
}


// --- Filter, Sort, and Render Function ---
function applyFiltersAndRender() {
    if (!allCustomersCache) return;
    console.log("[DEBUG] Applying customer filters and rendering...");

    // 1. Get filter values
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';

    // 2. Filter cached data
    let filteredCustomers = allCustomersCache.filter(customer => {
        if (filterSearchValue) {
            const customId = (customer.customCustomerId || '').toString().toLowerCase();
            const name = (customer.fullName || '').toLowerCase();
            const whatsapp = (customer.whatsappNo || '').toLowerCase();
            const contact = (customer.contactNo || '').toLowerCase();
            const id = (customer.id || '').toLowerCase(); // Firestore ID

            if (!(customId.includes(filterSearchValue) ||
                  name.includes(filterSearchValue) ||
                  whatsapp.includes(filterSearchValue) ||
                  contact.includes(filterSearchValue) ||
                  id.includes(filterSearchValue) )) {
                 return false;
            }
        }
        return true;
    });
    console.log(`[DEBUG] Filtered down to ${filteredCustomers.length} customers.`);

    // 3. Sort filtered data
    filteredCustomers.sort((a, b) => {
        let valA = a[currentSortField];
        let valB = b[currentSortField];

        if (valA && typeof valA.toDate === 'function') valA = valA.toDate();
        if (valB && typeof valB.toDate === 'function') valB = valB.toDate();
        if (currentSortField === 'customCustomerId') { valA = Number(valA) || 0; valB = Number(valB) || 0; }
        if (currentSortField === 'fullName') { valA = (valA || '').toLowerCase(); valB = (valB || '').toLowerCase(); }

        let comparison = 0;
        if (valA > valB) comparison = 1;
        else if (valA < valB) comparison = -1;
        return currentSortDirection === 'desc' ? comparison * -1 : comparison;
    });
    console.log(`[DEBUG] Sorted ${filteredCustomers.length} customers.`);

    // 4. Render table
    customerTableBody.innerHTML = '';
    if (filteredCustomers.length === 0) {
        customerTableBody.innerHTML = `<tr><td colspan="6" id="noCustomersMessage" style="text-align: center; color: #666;">No customers found matching filters.</td></tr>`; // Updated colspan
    } else {
        filteredCustomers.forEach(customer => {
            displayCustomerRow(customer.id, customer);
        });
    }
     console.log("[DEBUG] Customer rendering complete.");
}


// --- Display Single Customer Row ---
function displayCustomerRow(firestoreId, data) {
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
            <button type="button" class="action-button edit-button" title="Edit Customer">
                <i class="fas fa-edit"></i>
            </button>
            <button type="button" class="action-button delete-button" title="Delete Customer">
                <i class="fas fa-trash-alt"></i>
            </button>
        </td>
    `;

    const editButton = tableRow.querySelector('.edit-button');
    if (editButton) editButton.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(firestoreId, data); });
    const deleteButton = tableRow.querySelector('.delete-button');
    if (deleteButton) deleteButton.addEventListener('click', (e) => { e.stopPropagation(); handleDeleteCustomer(firestoreId, name); });

    customerTableBody.appendChild(tableRow);
}


// --- Modal Handling (Add/Edit) ---
function openAddModal() {
    console.log("[DEBUG] Opening modal to add new customer.");
    if (!customerModal || !customerForm) return;
    modalTitle.textContent = "Add New Customer";
    editCustomerIdInput.value = '';
    customerForm.reset();
    if(customIdDisplayArea) customIdDisplayArea.style.display = 'none';
    if(saveCustomerBtnText) saveCustomerBtnText.textContent = 'Save Customer'; // Use span if exists
    saveCustomerBtn.disabled = false; // Ensure button is enabled
    customerModal.classList.add('active');
}

function openEditModal(firestoreId, data) {
     console.log("[DEBUG] Opening modal to edit customer:", firestoreId);
     if (!customerModal || !customerForm) return;
     modalTitle.textContent = "Edit Customer";
     editCustomerIdInput.value = firestoreId;
     if(saveCustomerBtnText) saveCustomerBtnText.textContent = 'Update Customer'; // Change button text
     saveCustomerBtn.disabled = false; // Ensure button is enabled

     // Fill form
     customerFullNameInput.value = data.fullName || '';
     customerWhatsAppInput.value = data.whatsappNo || '';
     customerContactInput.value = data.contactNo || '';
     customerAddressInput.value = data.billingAddress || data.address || '';

     // Display existing custom ID
     if (data.customCustomerId && generatedCustomIdInput && customIdDisplayArea) {
         generatedCustomIdInput.value = data.customCustomerId;
         customIdDisplayArea.style.display = 'block';
     } else if(customIdDisplayArea) {
         customIdDisplayArea.style.display = 'none';
     }
     customerModal.classList.add('active');
}

function closeCustomerModal() {
     if (customerModal) { customerModal.classList.remove('active'); }
}

// --- Save/Update Customer Handler (WITH TRANSACTION) ---
async function handleSaveCustomer(event) {
    event.preventDefault();
    if (!db || !collection || !addDoc || !doc || !updateDoc || !serverTimestamp || !runTransaction || !getDoc) {
         alert("Database functions unavailable."); return;
    }

    const customerId = editCustomerIdInput.value; // Firestore document ID
    const isEditing = !!customerId;

    const fullName = customerFullNameInput.value.trim();
    const whatsappNo = customerWhatsAppInput.value.trim();
    const contactNo = customerContactInput.value.trim() || null;
    const address = customerAddressInput.value.trim() || null;

    if (!fullName || !whatsappNo) {
        alert("Full Name and WhatsApp Number are required.");
        return;
    }

    saveCustomerBtn.disabled = true;
    const originalButtonHTML = saveCustomerBtn.innerHTML;
    saveCustomerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const customerDataPayload = {
        fullName: fullName,
        whatsappNo: whatsappNo,
        contactNo: contactNo,
        billingAddress: address,
        updatedAt: serverTimestamp()
    };

    try {
        if (isEditing) {
            // UPDATE
             console.log(`[DEBUG] Updating customer ${customerId}...`);
             const customerRef = doc(db, "customers", customerId);
             await updateDoc(customerRef, customerDataPayload);
             console.log("[DEBUG] Customer updated successfully.");
             alert("Customer updated successfully!");
             closeCustomerModal();
        } else {
            // ADD using Transaction
            console.log("[DEBUG] Adding new customer via transaction...");
            const counterRef = doc(db, "counters", "customerCounter");
            const newCustomerColRef = collection(db, "customers"); // Ref to collection

            await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                let nextId = 101; // Start from 101
                if (counterDoc.exists() && counterDoc.data().lastId) {
                    nextId = counterDoc.data().lastId + 1;
                } else {
                     console.log("[DEBUG] Counter document 'customerCounter' or field 'lastId' not found, starting ID at 101.");
                     // If counter doesn't exist, we'll create it in the transaction
                }

                // Add custom ID and createdAt to payload
                customerDataPayload.customCustomerId = nextId; // The new field
                customerDataPayload.createdAt = serverTimestamp();

                // Generate a new document reference *within* the transaction logic if needed,
                // or use one created outside if you need the ID beforehand (less common here).
                // Using addDoc equivalent inside transaction:
                const newDocRef = doc(newCustomerColRef); // Create a reference for the new doc
                transaction.set(newDocRef, customerDataPayload); // Set data for the new doc

                // Update (or set) the counter
                transaction.set(counterRef, { lastId: nextId }, { merge: true });

                console.log(`[DEBUG] Transaction prepared: Set customer ${newDocRef.id} with customId ${nextId}, update counter to ${nextId}.`);
            }); // Transaction automatically commits here if no errors

            console.log("[DEBUG] Transaction successful. New customer added.");
            alert("New customer added successfully!");
            closeCustomerModal();
        }
    } catch (error) {
        console.error("Error saving customer:", error);
        alert(`Error saving customer: ${error.message}`);
    } finally {
        saveCustomerBtn.disabled = false;
        saveCustomerBtn.innerHTML = originalButtonHTML;
    }
}


// --- Delete Customer Handler ---
async function handleDeleteCustomer(firestoreId, customerName) {
    console.log(`[DEBUG] handleDeleteCustomer called for ID: ${firestoreId}, Name: ${customerName}`);
    if (!db || !doc || !deleteDoc) { alert("Error: Delete function not available."); return; }

    if (confirm(`Are you sure you want to delete customer "${customerName}"? This action cannot be undone.`)) {
        console.log(`[DEBUG] User confirmed deletion for ${firestoreId}.`);
        try {
            const customerRef = doc(db, "customers", firestoreId);
            await deleteDoc(customerRef);
            console.log(`[DEBUG] Customer deleted successfully from Firestore: ${firestoreId}`);
            // UI updates via onSnapshot listener
        } catch (error) {
            console.error(`[DEBUG] Error deleting customer ${firestoreId}:`, error);
            alert(`Failed to delete customer: ${error.message}`);
        }
    } else {
        console.log("[DEBUG] Deletion cancelled by user.");
    }
}

// --- Final Log ---
console.log("customer_management.js script fully loaded and initialized (v5 - Custom ID).");