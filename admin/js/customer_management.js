// js/customer_management.js
// Version 1.4 (Refactored Initialization, No Globals/Timer)

// --- Define module-level variables to hold Firestore functions ---
let db, collection, onSnapshot, query, orderBy, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, runTransaction, getDoc, where, getDocs, limit;

// --- DOM Elements ---
// (Keep these references as they were)
const customerTableBody = document.getElementById('customerTableBody');
const loadingRow = document.getElementById('loadingMessage');
const sortSelect = document.getElementById('sort-customers');
const filterSearchInput = document.getElementById('filterSearch');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const addNewCustomerBtn = document.getElementById('addNewCustomerBtn');
const customerModal = document.getElementById('customerModal');
const modalTitle = document.getElementById('modalTitle');
const customerForm = document.getElementById('customerForm');
const closeCustomerModalBtn = document.getElementById('closeCustomerModal');
const cancelCustomerBtn = document.getElementById('cancelCustomerBtn');
const saveCustomerBtn = document.getElementById('saveCustomerBtn');
const saveCustomerBtnText = saveCustomerBtn.querySelector('span');
const editCustomerIdInput = document.getElementById('editCustomerId');
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
let allCustomersCache = [];
let searchDebounceTimer;

// --- Initialization Function (Exported) ---
// This function is called from the HTML file
export function initializeCustomerManagement(firestoreFunctions) {
    console.log("Customer Management Initializing (V1.4)...");

    // Assign passed functions to module-level variables
    ({ db, collection, onSnapshot, query, orderBy, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, runTransaction, getDoc, where, getDocs, limit } = firestoreFunctions);

    // Check if functions were passed correctly
    if (!db || !collection || !getDocs || !query || !where || !limit || !onSnapshot) {
        console.error("Firestore functions not received during initialization!");
        alert("Initialization Error: Required functions missing.");
        if(customerTableBody) customerTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Initialization Error!</td></tr>`;
        return;
    }
    console.log("Firestore functions received successfully.");

    // Setup event listeners (now inside the init function)
    setupEventListeners();

    // Start listening for customer data
    listenForCustomers();
}

// --- Setup Event Listeners ---
function setupEventListeners() {
    // Ensure DOM is ready before adding listeners (DOMContentLoaded ensures this)
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
    console.log("Customer Management event listeners set up (V1.4).");
}


// --- Sorting Change Handler ---
function handleSortChange() {
    // ... (Code remains the same as V1.3) ...
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
    // ... (Code remains the same as V1.3) ...
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        console.log("Customer search processed.");
        applyFiltersAndRender();
    }, 300);
}

function clearFilters() {
    // ... (Code remains the same as V1.3) ...
    console.log("Clearing customer filters.");
    if(filterSearchInput) filterSearchInput.value = '';
    if(sortSelect) sortSelect.value = 'createdAt_desc';
    currentSortField = 'createdAt';
    currentSortDirection = 'desc';
    applyFiltersAndRender();
}


// --- Firestore Listener Setup ---
function listenForCustomers() {
    // ... (Code remains the same, but uses module-level variables now) ...
    if (unsubscribeCustomers) { unsubscribeCustomers(); unsubscribeCustomers = null; }
    // Check if functions are available (assigned during init)
    if (!db || !collection || !query || !orderBy || !onSnapshot) {
         console.error("Firestore functions not available for listener!");
         customerTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error: Listener functions not ready.</td></tr>`;
         return;
    }

    customerTableBody.innerHTML = `<tr><td colspan="7" id="loadingMessage" style="text-align: center; color: #666;">Loading customers...</td></tr>`;

    try {
        console.log("Setting up Firestore listener for 'customers' (V1.4)...");
        const customersRef = collection(db, "customers");
        const q = query(customersRef); // Fetch all customers initially

        unsubscribeCustomers = onSnapshot(q, (snapshot) => {
            console.log(`Received ${snapshot.docs.length} total customers from Firestore.`);
            allCustomersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            applyFiltersAndRender(); // Apply client-side filtering and sorting

        }, (error) => {
            console.error("Error fetching customers snapshot:", error);
            customerTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error loading customers: ${error.message}</td></tr>`;
         });
    } catch (error) {
         console.error("Error setting up customer listener:", error);
         customerTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error setting up listener: ${error.message}</td></tr>`;
     }
}


// --- Filter, Sort, and Render Function ---
function applyFiltersAndRender() {
    // ... (Code remains the same as V1.3) ...
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
        customerTableBody.innerHTML = `<tr><td colspan="7" id="noCustomersMessage" style="text-align: center; color: #666;">No customers found matching filters.</td></tr>`;
    } else {
        filteredCustomers.forEach(customer => {
             displayCustomerRow(customer.id, customer);
        });
        updateBalancesForDisplayedCustomers(filteredCustomers);
    }
     console.log("Customer rendering initiated.");
}

// --- Helper: Fetch and Update Balances for Visible Rows ---
async function updateBalancesForDisplayedCustomers(customers) {
    // ... (Code remains the same as V1.3) ...
     console.log(`Workspaceing balances for ${customers.length} customers...`);
    const balancePromises = customers.map(customer => getCustomerBalance(customer.id));

    try {
        const balances = await Promise.all(balancePromises);

        customers.forEach((customer, index) => {
            const balance = balances[index];
            const row = customerTableBody.querySelector(`tr[data-id="${customer.id}"]`);
            if (row) {
                const balanceCell = row.cells[5];
                if (balanceCell) {
                    updateBalanceCell(balanceCell, balance);
                }
            }
        });
        console.log("Balances updated for displayed customers.");
    } catch (error) {
        console.error("Error fetching balances for multiple customers:", error);
        customers.forEach(customer => {
             const row = customerTableBody.querySelector(`tr[data-id="${customer.id}"]`);
            if (row) {
                const balanceCell = row.cells[5];
                if (balanceCell) {
                     balanceCell.innerHTML = `<span class="balance-value balance-loading" title="Error loading balance">Error</span>`;
                     balanceCell.classList.add('balance-due');
                 }
            }
        });
    }
}


// --- Helper: Get Balance for ONE Customer ---
async function getCustomerBalance(customerId) {
    // ... (Code remains the same as V1.3) ...
     if (!db || !collection || !query || !where || !getDocs) { // Uses module-level variables
        console.error("DB functions missing for balance calculation.");
        return null;
    }
    try {
        let totalOrderValue = 0;
        let totalPaidAmount = 0;

        const ordersRef = collection(db, "orders");
        const orderQuery = query(ordersRef, where("customerId", "==", customerId));
        const orderSnapshot = await getDocs(orderQuery);
        orderSnapshot.forEach(doc => {
            totalOrderValue += Number(doc.data().totalAmount || 0);
        });

        const paymentsRef = collection(db, "payments");
        const paymentQuery = query(paymentsRef, where("customerId", "==", customerId));
        const paymentSnapshot = await getDocs(paymentQuery);
        paymentSnapshot.forEach(doc => {
            totalPaidAmount += Number(doc.data().amountPaid || 0);
        });

        return totalOrderValue - totalPaidAmount;

    } catch (error) {
        console.error(`Error calculating balance for customer ${customerId}:`, error);
         if(error.code === 'failed-precondition') {
            console.warn(`Firestore index potentially missing for balance calculation (orders/payments) for customer ${customerId}`);
         }
        return null;
    }
}

// --- Helper: Format Currency ---
function formatCurrency(amount) {
    // ... (Code remains the same as V1.3) ...
    const num = Number(amount);
    if (isNaN(num)) return 'N/A';
    return num.toLocaleString('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// --- Helper: Update Balance Cell Appearance ---
function updateBalanceCell(cellElement, balance) {
    // ... (Code remains the same as V1.3) ...
     if (balance === null || typeof balance === 'undefined' || isNaN(balance)) {
        cellElement.innerHTML = `<span class="balance-value balance-loading" title="Error calculating balance">Error</span>`;
        cellElement.classList.remove('balance-due', 'balance-credit', 'balance-zero');
        return;
    }

    let displayValue;
    let balanceClass = 'balance-zero';
    let titleText = 'Zero Balance';
    const tolerance = 0.005;

    if (balance > tolerance) {
        balanceClass = 'balance-due';
        displayValue = "-" + formatCurrency(balance);
        titleText = `Due: ${formatCurrency(balance)}`;
    } else if (balance < -tolerance) {
        balanceClass = 'balance-credit';
        displayValue = formatCurrency(Math.abs(balance));
        // displayValue = "+" + formatCurrency(Math.abs(balance)); // Optional + sign
        titleText = `Credit: ${formatCurrency(Math.abs(balance))}`;
    } else {
        balanceClass = 'balance-zero';
        displayValue = formatCurrency(0);
        titleText = 'Zero Balance';
    }

    cellElement.classList.remove('balance-due', 'balance-credit', 'balance-zero');
    cellElement.classList.add(balanceClass);
    cellElement.innerHTML = `<span class="balance-value" title="${titleText}">${displayValue}</span>`;
}


// --- Display Single Customer Row ---
function displayCustomerRow(firestoreId, data) {
    // ... (Code remains the same as V1.3) ...
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
        <td><span class="balance-value balance-loading">...</span></td>
        <td>
            <button type="button" class="action-button edit-button" title="Edit Customer">
                <i class="fas fa-edit"></i>
            </button>
            <button type="button" class="action-button delete-button" title="Delete Customer">
                <i class="fas fa-trash-alt"></i>
            </button>
        </td>
    `;

    tableRow.style.cursor = 'pointer';
    tableRow.addEventListener('click', (e) => {
        if (e.target.closest('button.action-button')) {
            return;
        }
        window.location.href = `customer_account_detail.html?id=${firestoreId}`;
    });

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
}


// --- Modal Handling (Add/Edit) ---
function openAddModal() {
    // ... (Code remains the same as V1.3) ...
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
    // ... (Code remains the same as V1.3) ...
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
    // ... (Code remains the same as V1.3) ...
     if (customerModal) { customerModal.classList.remove('active'); }
}

// --- Save/Update Customer Handler ---
async function handleSaveCustomer(event) {
    // ... (Code remains the same as V1.3, uses module-level variables) ...
     event.preventDefault();
    // Check for required Firestore functions from module scope
    if (!db || !collection || !addDoc || !doc || !updateDoc || !serverTimestamp || !runTransaction || !getDoc || !query || !where || !limit || !getDocs) {
         console.error("Database functions unavailable for saving customer.");
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

    try {
        const customerDataPayload = {
            fullName: fullName,
            whatsappNo: whatsappNo,
            contactNo: contactNo,
            billingAddress: address,
            updatedAt: serverTimestamp()
        };

        if (isEditing) {
            console.log(`Updating customer ${customerId}...`);
            const customerRef = doc(db, "customers", customerId);
            await updateDoc(customerRef, customerDataPayload);
            console.log("Customer updated successfully.");
            alert("Customer updated successfully!");
            closeCustomerModal();
        } else {
            // Duplicate Check
            console.log(`Checking for existing customer with WhatsApp: ${whatsappNo}`);
            const customersRef = collection(db, "customers");
            const q = query(customersRef, where("whatsappNo", "==", whatsappNo), limit(1));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const existingDoc = querySnapshot.docs[0];
                const existingCustomer = existingDoc.data();
                const existingCustomerId = existingDoc.id;
                console.log(`Duplicate found: ${existingCustomer.fullName} (ID: ${existingCustomerId})`);

                const updateExisting = confirm(
                    `ग्राहक इस व्हाट्सएप नंबर (${whatsappNo}) के साथ पहले से मौजूद है: ${existingCustomer.fullName}.\n\nक्या आप मौजूदा ग्राहक विवरण को अपडेट करना चाहते हैं?`
                );

                if (updateExisting) {
                    closeCustomerModal();
                    openEditModal(existingCustomerId, existingCustomer);
                    saveCustomerBtn.disabled = false;
                    saveCustomerBtn.innerHTML = originalButtonHTML;
                    return;
                } else {
                    alert("कृपया एक अलग व्हाट्सएप नंबर दर्ज करें या मौजूदा ग्राहक को अपडेट करें।");
                    saveCustomerBtn.disabled = false;
                    saveCustomerBtn.innerHTML = originalButtonHTML;
                    return;
                }
            }

            // Add New Customer Transaction
            console.log("No duplicate found. Proceeding to add new customer via transaction...");
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


// --- Delete Customer Handler ---
async function handleDeleteCustomer(firestoreId, customerName) {
    // ... (Code remains the same as V1.3, uses module-level variables) ...
     console.log(`handleDeleteCustomer called for ID: ${firestoreId}, Name: ${customerName}`);
    // Check for required functions from module scope
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
        } catch (error) {
            console.error(`Error deleting customer ${firestoreId}:`, error);
            alert(`Failed to delete customer: ${error.message}`);
        }
    } else {
        console.log("Deletion cancelled by user.");
    }
}

// --- Final Log ---
// Removed initial console log, initialization is now controlled by the exported function
// console.log("customer_management.js (V1.3 - Duplicate WhatsApp Check Added) script fully loaded.");