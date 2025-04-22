// js/customer_management.js
// Version 1.0 (Customer Detail Page Linking Added)

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
    console.log("Customer Management DOM Loaded (V1.0 - Detail Linking).");
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

        console.log("Customer Management event listeners set up.");
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
        console.log(`Customer sort changed: ${currentSortField} ${currentSortDirection}`);
        applyFiltersAndRender();
    }
}

// --- Filter Change Handlers ---
function handleSearchInput() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        console.log("Customer search processed.");
        applyFiltersAndRender();
    }, 300);
}

function clearFilters() {
    console.log("Clearing customer filters.");
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
    if (!db || !collection || !query || !orderBy || !onSnapshot) { console.error("Firestore functions not available!"); return; }

    customerTableBody.innerHTML = `<tr><td colspan="6" id="loadingMessage" style="text-align: center; color: #666;">Loading customers...</td></tr>`; // Updated colspan

    try {
        console.log("Setting up Firestore listener for 'customers'...");
        const customersRef = collection(db, "customers");
        // Use a default query for the listener; sorting/filtering is client-side
        const q = query(customersRef); // Fetch all

        unsubscribeCustomers = onSnapshot(q, (snapshot) => {
            console.log(`Received ${snapshot.docs.length} total customers from Firestore.`);
            allCustomersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            applyFiltersAndRender(); // Apply filters/sort to the new full list

        }, (error) => { console.error("Error fetching customers snapshot:", error); /* Error handling */ });
    } catch (error) { console.error("Error setting up customer listener:", error); /* Error handling */ }
}


// --- Filter, Sort, and Render Function ---
function applyFiltersAndRender() {
    if (!allCustomersCache) return;
    console.log("Applying customer filters and rendering...");

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
    console.log(`Filtered down to ${filteredCustomers.length} customers.`);

    // 3. Sort filtered data
    filteredCustomers.sort((a, b) => {
        let valA = a[currentSortField];
        let valB = b[currentSortField];

        // Handle different data types for sorting
        if (valA && typeof valA.toDate === 'function') valA = valA.toDate(); // Firestore Timestamps
        if (valB && typeof valB.toDate === 'function') valB = valB.toDate();
        if (currentSortField === 'customCustomerId') { // Numeric sort for ID
            valA = Number(valA) || 0;
            valB = Number(valB) || 0;
        }
        if (currentSortField === 'fullName') { // Case-insensitive string sort for name
            valA = (valA || '').toLowerCase();
            valB = (valB || '').toLowerCase();
        }

        // Perform comparison
        let comparison = 0;
        if (valA > valB) {
            comparison = 1;
        } else if (valA < valB) {
            comparison = -1;
        }
        return currentSortDirection === 'desc' ? (comparison * -1) : comparison;
    });
    console.log(`Sorted ${filteredCustomers.length} customers.`);

    // 4. Render table
    customerTableBody.innerHTML = ''; // Clear previous rows
    if (filteredCustomers.length === 0) {
        customerTableBody.innerHTML = `<tr><td colspan="6" id="noCustomersMessage" style="text-align: center; color: #666;">No customers found matching filters.</td></tr>`; // Updated colspan
    } else {
        filteredCustomers.forEach(customer => {
            // Pass the Firestore ID (customer.id) along with the data
            displayCustomerRow(customer.id, customer);
        });
    }
     console.log("Customer rendering complete.");
}


// --- Display Single Customer Row ---
function displayCustomerRow(firestoreId, data) {
    const tableRow = document.createElement('tr');
    tableRow.setAttribute('data-id', firestoreId); // Store Firestore ID on the row

    const customId = data.customCustomerId || '-';
    const name = data.fullName || 'N/A';
    const whatsapp = data.whatsappNo || '-';
    const contact = data.contactNo || '-';
    const address = data.billingAddress || data.address || '-'; // Prefer billingAddress

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

    // --- >>> यहाँ बदलाव किया गया है (लिंकिंग के लिए) <<< ---
    tableRow.style.cursor = 'pointer'; // माउस ले जाने पर हाथ का निशान दिखाता है
    tableRow.addEventListener('click', () => {
        // customer_account_detail.html पर रीडायरेक्ट करें और Firestore ID पास करें
        window.location.href = `customer_account_detail.html?id=${firestoreId}`;
    });
    // --- >>> बदलाव समाप्त <<< ---


    // Attach event listeners AFTER setting innerHTML and AFTER adding the main row listener
    const editButton = tableRow.querySelector('.edit-button');
    if (editButton) {
        editButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent row click when clicking button
            openEditModal(firestoreId, data);
        });
    }
    const deleteButton = tableRow.querySelector('.delete-button');
    if (deleteButton) {
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent row click when clicking button
            handleDeleteCustomer(firestoreId, name);
        });
    }

    customerTableBody.appendChild(tableRow); // Add the row to the table body
}


// --- Modal Handling (Add/Edit) ---
function openAddModal() {
    console.log("Opening modal to add new customer.");
    if (!customerModal || !customerForm) return;
    modalTitle.textContent = "Add New Customer";
    editCustomerIdInput.value = ''; // Clear Firestore ID for Add mode
    customerForm.reset(); // Clear form fields
    if(customIdDisplayArea) customIdDisplayArea.style.display = 'none'; // Hide custom ID field
    if(saveCustomerBtnText) saveCustomerBtnText.textContent = 'Save Customer'; // Reset button text
    saveCustomerBtn.disabled = false; // Ensure button is enabled
    customerModal.classList.add('active');
}

function openEditModal(firestoreId, data) {
     console.log("Opening modal to edit customer:", firestoreId);
     if (!customerModal || !customerForm) return;
     modalTitle.textContent = "Edit Customer";
     editCustomerIdInput.value = firestoreId; // Set Firestore ID for Edit mode
     if(saveCustomerBtnText) saveCustomerBtnText.textContent = 'Update Customer'; // Change button text
     saveCustomerBtn.disabled = false; // Ensure button is enabled

     // Fill form with existing data
     customerFullNameInput.value = data.fullName || '';
     customerWhatsAppInput.value = data.whatsappNo || '';
     customerContactInput.value = data.contactNo || '';
     customerAddressInput.value = data.billingAddress || data.address || ''; // Prefer billingAddress

     // Display existing custom ID (read-only)
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

// --- Save/Update Customer Handler (WITH TRANSACTION for Add) ---
async function handleSaveCustomer(event) {
    event.preventDefault();
    // Ensure necessary Firestore functions are available
    if (!db || !collection || !addDoc || !doc || !updateDoc || !serverTimestamp || !runTransaction || !getDoc) {
         console.error("Database functions unavailable.");
         alert("Database functions unavailable. Cannot save.");
         return;
    }

    const customerId = editCustomerIdInput.value; // Firestore document ID (empty if adding)
    const isEditing = !!customerId;

    // Get form values
    const fullName = customerFullNameInput.value.trim();
    const whatsappNo = customerWhatsAppInput.value.trim();
    const contactNo = customerContactInput.value.trim() || null; // Store as null if empty
    const address = customerAddressInput.value.trim() || null; // Store as null if empty

    // Basic validation
    if (!fullName || !whatsappNo) {
        alert("Full Name and WhatsApp Number are required.");
        return;
    }

    // Disable button and show loading state
    saveCustomerBtn.disabled = true;
    const originalButtonHTML = saveCustomerBtn.innerHTML; // Store original HTML
    saveCustomerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    // Prepare data payload
    const customerDataPayload = {
        fullName: fullName,
        whatsappNo: whatsappNo,
        contactNo: contactNo,
        billingAddress: address, // Using billingAddress field now
        // 'address' field can potentially be removed if only billingAddress is needed
        updatedAt: serverTimestamp()
    };

    try {
        if (isEditing) {
            // --- UPDATE existing customer ---
             console.log(`Updating customer ${customerId}...`);
             const customerRef = doc(db, "customers", customerId);
             // Don't update createdAt or customCustomerId on edit
             await updateDoc(customerRef, customerDataPayload);
             console.log("Customer updated successfully.");
             alert("Customer updated successfully!");
             closeCustomerModal();
        } else {
            // --- ADD new customer using Transaction to generate custom ID ---
            console.log("Adding new customer via transaction...");
            const counterRef = doc(db, "counters", "customerCounter"); // Reference to the counter document
            const newCustomerColRef = collection(db, "customers"); // Reference to the customers collection

            await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                let nextId = 101; // Default starting ID if counter doesn't exist
                if (counterDoc.exists() && counterDoc.data().lastId) {
                    nextId = counterDoc.data().lastId + 1; // Increment the last ID
                } else {
                     console.log("Counter document 'customerCounter' or field 'lastId' not found, starting ID at 101.");
                     // The transaction will create/set it later.
                }

                // Add custom ID and createdAt timestamp to the payload for the new customer
                customerDataPayload.customCustomerId = nextId; // Assign the calculated ID
                customerDataPayload.createdAt = serverTimestamp(); // Add creation timestamp
                customerDataPayload.status = 'active'; // Default status for new customer

                // Create a reference *for the new document* within the collection
                const newDocRef = doc(newCustomerColRef);
                // Set the data for the new customer document using the transaction
                transaction.set(newDocRef, customerDataPayload);

                // Update (or create if it doesn't exist) the counter document
                transaction.set(counterRef, { lastId: nextId }, { merge: true }); // Use merge:true to avoid overwriting other fields if they exist

                console.log(`Transaction prepared: Set customer ${newDocRef.id} with customId ${nextId}, update counter to ${nextId}.`);
            }); // Transaction automatically commits here if no errors occurred

            console.log("Transaction successful. New customer added.");
            alert("New customer added successfully!");
            closeCustomerModal();
        }
    } catch (error) {
        console.error("Error saving customer:", error);
        alert(`Error saving customer: ${error.message}`);
    } finally {
        // Re-enable button and restore original text/icon
        saveCustomerBtn.disabled = false;
        saveCustomerBtn.innerHTML = originalButtonHTML;
    }
}


// --- Delete Customer Handler ---
async function handleDeleteCustomer(firestoreId, customerName) {
    console.log(`handleDeleteCustomer called for ID: ${firestoreId}, Name: ${customerName}`);
    if (!db || !doc || !deleteDoc) {
        console.error("Delete function not available.");
        alert("Error: Delete function not available.");
        return;
    }

    // Confirmation dialog
    if (confirm(`Are you sure you want to delete customer "${customerName}"? This action cannot be undone.`)) {
        console.log(`User confirmed deletion for ${firestoreId}. Proceeding...`);
        try {
            const customerRef = doc(db, "customers", firestoreId);
            await deleteDoc(customerRef);
            console.log(`Customer deleted successfully from Firestore: ${firestoreId}`);
            alert(`Customer "${customerName}" deleted.`);
            // The UI should update automatically because of the onSnapshot listener.
        } catch (error) {
            console.error(`Error deleting customer ${firestoreId}:`, error);
            alert(`Failed to delete customer: ${error.message}`);
        }
    } else {
        console.log("Deletion cancelled by user.");
    }
}

// --- Final Log ---
console.log("customer_management.js (V1.0 - Detail Linking) script fully loaded.");