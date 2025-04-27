// js/customer_management.js
// Version 1.1 (Added Balance Calculation and Display)

// --- Ensure Firestore functions are available globally ---
const { db, collection, onSnapshot, query, orderBy, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, runTransaction, getDoc, where, getDocs } = window;

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
    console.log("Customer Management DOM Loaded (V1.1 - Balance Display).");
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
    if (window.db && window.getDocs) { // Ensure getDocs is available
        callback();
    } else {
        let attempts = 0; const maxAttempts = 20;
        const intervalId = setInterval(() => {
            attempts++;
            if (window.db && window.getDocs) { // Check again
                clearInterval(intervalId); callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(intervalId); console.error("DB timeout or function missing (getDocs)"); alert("DB Error");
            }
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
    if(sortSelect) sortSelect.value = 'createdAt_desc';
    currentSortField = 'createdAt';
    currentSortDirection = 'desc';
    applyFiltersAndRender();
}


// --- Firestore Listener Setup ---
function listenForCustomers() {
    if (unsubscribeCustomers) { unsubscribeCustomers(); unsubscribeCustomers = null; }
    if (!db || !collection || !query || !orderBy || !onSnapshot) { console.error("Firestore functions not available!"); return; }

    // colspan is now 7 including balance and actions
    customerTableBody.innerHTML = `<tr><td colspan="7" id="loadingMessage" style="text-align: center; color: #666;">Loading customers...</td></tr>`;

    try {
        console.log("Setting up Firestore listener for 'customers'...");
        const customersRef = collection(db, "customers");
        const q = query(customersRef);

        unsubscribeCustomers = onSnapshot(q, (snapshot) => {
            console.log(`Received ${snapshot.docs.length} total customers from Firestore.`);
            allCustomersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            applyFiltersAndRender();

        }, (error) => { console.error("Error fetching customers snapshot:", error); /* Error handling */ });
    } catch (error) { console.error("Error setting up customer listener:", error); /* Error handling */ }
}


// --- Filter, Sort, and Render Function ---
function applyFiltersAndRender() {
    if (!allCustomersCache) return;
    console.log("Applying customer filters and rendering...");

    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';

    let filteredCustomers = allCustomersCache.filter(customer => {
        if (filterSearchValue) {
            const customId = (customer.customCustomerId || '').toString().toLowerCase();
            const name = (customer.fullName || '').toLowerCase();
            const whatsapp = (customer.whatsappNo || '').toLowerCase();
            const contact = (customer.contactNo || '').toLowerCase();
            const id = (customer.id || '').toLowerCase();

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

    filteredCustomers.sort((a, b) => {
        let valA = a[currentSortField];
        let valB = b[currentSortField];

        if (valA && typeof valA.toDate === 'function') valA = valA.toDate();
        if (valB && typeof valB.toDate === 'function') valB = valB.toDate();
        if (currentSortField === 'customCustomerId') {
            valA = Number(valA) || 0;
            valB = Number(valB) || 0;
        }
        if (currentSortField === 'fullName') {
            valA = (valA || '').toLowerCase();
            valB = (valB || '').toLowerCase();
        }

        let comparison = 0;
        if (valA > valB) comparison = 1;
        else if (valA < valB) comparison = -1;
        return currentSortDirection === 'desc' ? (comparison * -1) : comparison;
    });
    console.log(`Sorted ${filteredCustomers.length} customers.`);

    customerTableBody.innerHTML = '';
    if (filteredCustomers.length === 0) {
        customerTableBody.innerHTML = `<tr><td colspan="7" id="noCustomersMessage" style="text-align: center; color: #666;">No customers found matching filters.</td></tr>`; // Updated colspan
    } else {
        // Render rows without balance first
        filteredCustomers.forEach(customer => {
             displayCustomerRow(customer.id, customer); // This now adds placeholders
        });
        // Then fetch and update balances asynchronously
        updateBalancesForDisplayedCustomers(filteredCustomers);
    }
     console.log("Customer rendering initiated.");
}

// --- Helper: Fetch and Update Balances for Visible Rows ---
async function updateBalancesForDisplayedCustomers(customers) {
    console.log(`Fetching balances for ${customers.length} customers...`);
    const balancePromises = customers.map(customer => getCustomerBalance(customer.id));

    try {
        const balances = await Promise.all(balancePromises);
        customers.forEach((customer, index) => {
            const balance = balances[index];
            const row = customerTableBody.querySelector(`tr[data-id="${customer.id}"]`);
            if (row) {
                const balanceCell = row.querySelector('.balance-cell'); // Find the specific cell
                if (balanceCell) {
                    updateBalanceCell(balanceCell, balance);
                }
            }
        });
        console.log("Balances updated for displayed customers.");
    } catch (error) {
        console.error("Error fetching balances for multiple customers:", error);
        // Optionally update cells to show error
        customers.forEach(customer => {
             const row = customerTableBody.querySelector(`tr[data-id="${customer.id}"]`);
            if (row) {
                const balanceCell = row.querySelector('.balance-cell');
                if (balanceCell) { balanceCell.textContent = 'Error'; balanceCell.classList.add('balance-due'); }
            }
        });
    }
}


// --- Helper: Get Balance for ONE Customer ---
async function getCustomerBalance(customerId) {
    if (!db || !collection || !query || !where || !getDocs) {
        console.error("DB functions missing for balance calculation.");
        return null; // Indicate error or inability to calculate
    }
    try {
        let totalOrderValue = 0;
        let totalPaidAmount = 0;

        // Fetch Orders Total
        const ordersRef = collection(db, "orders");
        const orderQuery = query(ordersRef, where("customerId", "==", customerId));
        const orderSnapshot = await getDocs(orderQuery);
        orderSnapshot.forEach(doc => {
            totalOrderValue += Number(doc.data().totalAmount || 0);
        });

        // Fetch Payments Total
        const paymentsRef = collection(db, "payments");
        const paymentQuery = query(paymentsRef, where("customerId", "==", customerId));
        const paymentSnapshot = await getDocs(paymentQuery);
        paymentSnapshot.forEach(doc => {
            totalPaidAmount += Number(doc.data().amountPaid || 0);
        });

        return totalOrderValue - totalPaidAmount;

    } catch (error) {
        console.error(`Error calculating balance for customer ${customerId}:`, error);
        return null; // Indicate error
    }
}

// --- Helper: Format Currency ---
function formatCurrency(amount) {
    const num = Number(amount);
    if (isNaN(num)) return 'N/A';
    // Use Indian numbering system format
    return num.toLocaleString('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// --- Helper: Update Balance Cell Appearance ---
function updateBalanceCell(cellElement, balance) {
    if (balance === null || typeof balance === 'undefined') {
        cellElement.innerHTML = `<span class="balance-value balance-loading">Error</span>`; // Show error if balance is null/undefined
        return;
    }

    const formattedBalance = formatCurrency(balance);
    let balanceClass = 'balance-zero';
    if (balance > 0) {
        balanceClass = 'balance-due'; // Customer owes (Due) - Shown in Red
    } else if (balance < 0) {
        balanceClass = 'balance-credit'; // Customer has credit - Shown in Green
        // Optionally show negative balance as positive with (Cr.) notation
        // formattedBalance = formatCurrency(Math.abs(balance)) + ' (Cr.)';
    }

    cellElement.innerHTML = `<span class="balance-value ${balanceClass}">${formattedBalance}</span>`;
}


// --- Display Single Customer Row (Modified) ---
function displayCustomerRow(firestoreId, data) {
    const tableRow = document.createElement('tr');
    tableRow.setAttribute('data-id', firestoreId);

    const customId = data.customCustomerId || '-';
    const name = data.fullName || 'N/A';
    const whatsapp = data.whatsappNo || '-';
    const contact = data.contactNo || '-';
    const address = data.billingAddress || data.address || '-';

    // Added balance cell with a specific class and initial loading state
    tableRow.innerHTML = `
        <td>${customId}</td>
        <td>${name}</td>
        <td>${whatsapp}</td>
        <td>${contact}</td>
        <td>${address}</td>
        <td class="balance-cell"><span class="balance-value balance-loading">...</span></td>
        <td>
            <button type="button" class="action-button edit-button" title="Edit Customer">
                <i class="fas fa-edit"></i>
            </button>
            <button type="button" class="action-button delete-button" title="Delete Customer">
                <i class="fas fa-trash-alt"></i>
            </button>
        </td>
    `;

    // Row click listener (no change needed here)
    tableRow.style.cursor = 'pointer';
    tableRow.addEventListener('click', (e) => {
        // Prevent row navigation if a button inside was clicked
        if (e.target.closest('button.action-button')) {
            return;
        }
        window.location.href = `customer_account_detail.html?id=${firestoreId}`;
    });

    // Attach button event listeners AFTER setting innerHTML
    const editButton = tableRow.querySelector('.edit-button');
    if (editButton) {
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(firestoreId, data);
        });
    }
    const deleteButton = tableRow.querySelector('.delete-button');
    if (deleteButton) {
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDeleteCustomer(firestoreId, name);
        });
    }

    customerTableBody.appendChild(tableRow);
    // Balance is now fetched and updated later by updateBalancesForDisplayedCustomers
}


// --- Modal Handling (Add/Edit) --- (No changes needed here)
function openAddModal() {
    console.log("Opening modal to add new customer.");
    if (!customerModal || !customerForm) return;
    modalTitle.textContent = "Add New Customer";
    editCustomerIdInput.value = '';
    customerForm.reset();
    if(customIdDisplayArea) customIdDisplayArea.style.display = 'none';
    if(saveCustomerBtnText) saveCustomerBtnText.textContent = 'Save Customer';
    saveCustomerBtn.disabled = false;
    customerModal.classList.add('active');
}

function openEditModal(firestoreId, data) {
     console.log("Opening modal to edit customer:", firestoreId);
     if (!customerModal || !customerForm) return;
     modalTitle.textContent = "Edit Customer";
     editCustomerIdInput.value = firestoreId;
     if(saveCustomerBtnText) saveCustomerBtnText.textContent = 'Update Customer';
     saveCustomerBtn.disabled = false;

     customerFullNameInput.value = data.fullName || '';
     customerWhatsAppInput.value = data.whatsappNo || '';
     customerContactInput.value = data.contactNo || '';
     customerAddressInput.value = data.billingAddress || data.address || '';

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

// --- Save/Update Customer Handler (WITH TRANSACTION for Add) --- (No change needed here)
async function handleSaveCustomer(event) {
    event.preventDefault();
    if (!db || !collection || !addDoc || !doc || !updateDoc || !serverTimestamp || !runTransaction || !getDoc) {
         console.error("Database functions unavailable.");
         alert("Database functions unavailable. Cannot save.");
         return;
    }

    const customerId = editCustomerIdInput.value;
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
        // NOTE: Balance is NOT saved here. It should ideally be updated
        // via Cloud Functions or when orders/payments are made.
    };

    try {
        if (isEditing) {
             console.log(`Updating customer ${customerId}...`);
             const customerRef = doc(db, "customers", customerId);
             await updateDoc(customerRef, customerDataPayload);
             console.log("Customer updated successfully.");
             alert("Customer updated successfully!");
             closeCustomerModal();
        } else {
            console.log("Adding new customer via transaction...");
            const counterRef = doc(db, "counters", "customerCounter");
            const newCustomerColRef = collection(db, "customers");

            await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                let nextId = 101;
                if (counterDoc.exists() && counterDoc.data().lastId) {
                    nextId = counterDoc.data().lastId + 1;
                } else {
                     console.log("Counter document 'customerCounter' or field 'lastId' not found, starting ID at 101.");
                }

                customerDataPayload.customCustomerId = nextId;
                customerDataPayload.createdAt = serverTimestamp();
                customerDataPayload.status = 'active';

                const newDocRef = doc(newCustomerColRef);
                transaction.set(newDocRef, customerDataPayload);
                transaction.set(counterRef, { lastId: nextId }, { merge: true });
                console.log(`Transaction prepared: Set customer ${newDocRef.id} with customId ${nextId}, update counter to ${nextId}.`);
            });

            console.log("Transaction successful. New customer added.");
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


// --- Delete Customer Handler --- (No change needed here)
async function handleDeleteCustomer(firestoreId, customerName) {
    console.log(`handleDeleteCustomer called for ID: ${firestoreId}, Name: ${customerName}`);
    if (!db || !doc || !deleteDoc) {
        console.error("Delete function not available.");
        alert("Error: Delete function not available.");
        return;
    }
    if (confirm(`Are you sure you want to delete customer "${customerName}"? This action cannot be undone.`)) {
        console.log(`User confirmed deletion for ${firestoreId}. Proceeding...`);
        try {
            const customerRef = doc(db, "customers", firestoreId);
            await deleteDoc(customerRef);
            console.log(`Customer deleted successfully from Firestore: ${firestoreId}`);
            alert(`Customer "${customerName}" deleted.`);
            // UI updates via listener
        } catch (error) {
            console.error(`Error deleting customer ${firestoreId}:`, error);
            alert(`Failed to delete customer: ${error.message}`);
        }
    } else {
        console.log("Deletion cancelled by user.");
    }
}

// --- Final Log ---
console.log("customer_management.js (V1.1 - Balance Display) script fully loaded.");