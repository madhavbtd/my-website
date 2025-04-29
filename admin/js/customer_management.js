// js/customer_management.js
// Version 1.3 (Duplicate WhatsApp Check Added)

// --- Ensure Firestore functions are available globally ---
const { db, collection, onSnapshot, query, orderBy, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, runTransaction, getDoc, where, getDocs, limit } = window; // Added limit

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
    console.log("Customer Management DOM Loaded (V1.3 - Duplicate Check)."); // Version Updated
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
    // Added limit to the check
    if (window.db && window.getDocs && window.query && window.where && window.limit) {
        callback();
    } else {
        let attempts = 0; const maxAttempts = 20;
        const intervalId = setInterval(() => {
            attempts++;
            if (window.db && window.getDocs && window.query && window.where && window.limit) { // Check again
                clearInterval(intervalId); callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(intervalId); console.error("DB timeout or function missing (getDocs, query, where, limit)"); alert("DB Error");
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

    customerTableBody.innerHTML = `<tr><td colspan="7" id="loadingMessage" style="text-align: center; color: #666;">Loading customers...</td></tr>`;

    try {
        console.log("Setting up Firestore listener for 'customers'...");
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
    // ... (existing code - no changes needed here) ...
     if (!allCustomersCache) return;
    console.log("Applying customer filters and rendering...");

    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';

    // Client-side Filtering
    let filteredCustomers = allCustomersCache.filter(customer => {
        if (filterSearchValue) {
            const customId = (customer.customCustomerId || '').toString().toLowerCase();
            const name = (customer.fullName || '').toLowerCase();
            const whatsapp = (customer.whatsappNo || '').toLowerCase();
            const contact = (customer.contactNo || '').toLowerCase();
            const id = (customer.id || '').toLowerCase(); // Firestore ID

            // Check if any field includes the search term
            if (!(customId.includes(filterSearchValue) ||
                  name.includes(filterSearchValue) ||
                  whatsapp.includes(filterSearchValue) ||
                  contact.includes(filterSearchValue) ||
                  id.includes(filterSearchValue) )) {
                 return false; // Exclude if no match
            }
        }
        return true; // Include if no search term or if matched
    });
    console.log(`Filtered down to ${filteredCustomers.length} customers.`);

    // Client-side Sorting
    filteredCustomers.sort((a, b) => {
        let valA = a[currentSortField];
        let valB = b[currentSortField];

        // Handle different data types for sorting
        if (valA && typeof valA.toDate === 'function') valA = valA.toDate(); // Firestore Timestamps
        if (valB && typeof valB.toDate === 'function') valB = valB.toDate();
        if (currentSortField === 'customCustomerId') { // Sort as numbers
            valA = Number(valA) || 0;
            valB = Number(valB) || 0;
        }
        if (currentSortField === 'fullName') { // Case-insensitive string sort
            valA = (valA || '').toLowerCase();
            valB = (valB || '').toLowerCase();
        }

        let comparison = 0;
        if (valA > valB) comparison = 1;
        else if (valA < valB) comparison = -1;

        // Apply sort direction
        return currentSortDirection === 'desc' ? (comparison * -1) : comparison;
    });
    console.log(`Sorted ${filteredCustomers.length} customers.`);

    // Render Table
    customerTableBody.innerHTML = ''; // Clear previous content
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
    // ... (existing code - no changes needed here) ...
     console.log(`Fetching balances for ${customers.length} customers...`);
    // Create an array of promises, one for each customer's balance calculation
    const balancePromises = customers.map(customer => getCustomerBalance(customer.id));

    try {
        // Wait for all balance calculations to complete
        const balances = await Promise.all(balancePromises);

        // Iterate through customers and update their corresponding row
        customers.forEach((customer, index) => {
            const balance = balances[index];
            const row = customerTableBody.querySelector(`tr[data-id="${customer.id}"]`);
            if (row) {
                const balanceCell = row.cells[5]; // Balance is the 6th column (index 5)
                if (balanceCell) {
                    updateBalanceCell(balanceCell, balance); // Update the cell content and style
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
                const balanceCell = row.cells[5];
                if (balanceCell) {
                     balanceCell.innerHTML = `<span class="balance-value balance-loading" title="Error loading balance">Error</span>`;
                     balanceCell.classList.add('balance-due'); // Indicate error with red color potentially
                 }
            }
        });
    }
}


// --- Helper: Get Balance for ONE Customer ---
async function getCustomerBalance(customerId) {
    // ... (existing code - no changes needed here) ...
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

        // Simple Balance Calculation (Orders - Payments)
        return totalOrderValue - totalPaidAmount;

    } catch (error) {
        console.error(`Error calculating balance for customer ${customerId}:`, error);
         // Handle index errors specifically if they occur
         if(error.code === 'failed-precondition') {
            console.warn(`Firestore index potentially missing for balance calculation (orders/payments) for customer ${customerId}`);
         }
        return null; // Indicate error
    }
}

// --- Helper: Format Currency ---
function formatCurrency(amount) {
    // ... (existing code - no changes needed here) ...
    const num = Number(amount);
    if (isNaN(num)) return 'N/A';
    // Use Indian numbering system format, force currency symbol
    return num.toLocaleString('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// --- Helper: Update Balance Cell Appearance (MODIFIED for sign display) ---
function updateBalanceCell(cellElement, balance) {
    // ... (existing code from previous update - no changes needed here) ...
    // Handle cases where balance couldn't be calculated
    if (balance === null || typeof balance === 'undefined' || isNaN(balance)) {
        cellElement.innerHTML = `<span class="balance-value balance-loading" title="Error calculating balance">Error</span>`;
        cellElement.classList.remove('balance-due', 'balance-credit', 'balance-zero'); // Clear classes
        return;
    }

    let displayValue;
    let balanceClass = 'balance-zero'; // Default Grey class for the TD cell
    let titleText = 'Zero Balance';

    // Use a small tolerance for floating point comparisons
    const tolerance = 0.005;

    if (balance > tolerance) { // Customer owes (Due) - User wants Red, Negative Sign
        balanceClass = 'balance-due'; // Red class for TD
        displayValue = "-" + formatCurrency(balance); // Prepend "-" sign
        titleText = `Due: ${formatCurrency(balance)}`;
    } else if (balance < -tolerance) { // Customer has credit (Advance) - User wants Green, Positive Sign
        balanceClass = 'balance-credit'; // Green class for TD
        // Display positive value (absolute value)
        displayValue = formatCurrency(Math.abs(balance));
        // Optional: Prepend "+" sign if desired
        // displayValue = "+" + formatCurrency(Math.abs(balance));
        titleText = `Credit: ${formatCurrency(Math.abs(balance))}`;
    } else { // Zero balance
        balanceClass = 'balance-zero'; // Grey class for TD
        displayValue = formatCurrency(0);
        titleText = 'Zero Balance';
    }

    // Clear existing classes before adding the new one TO THE CELL (TD)
    cellElement.classList.remove('balance-due', 'balance-credit', 'balance-zero');
    cellElement.classList.add(balanceClass);

    // Update the cell content with a span inside (span itself doesn't need color class)
    cellElement.innerHTML = `<span class="balance-value" title="${titleText}">${displayValue}</span>`;
}


// --- Display Single Customer Row ---
function displayCustomerRow(firestoreId, data) {
    // ... (existing code - no changes needed here) ...
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


// --- Modal Handling (Add/Edit) --- (No changes needed here)
function openAddModal() {
    // ... (existing code) ...
     console.log("Opening modal to add new customer.");
    if (!customerModal || !customerForm) return;
    modalTitle.textContent = "Add New Customer";
    editCustomerIdInput.value = ''; // Clear ID for add mode
    customerForm.reset(); // Reset form fields
    if(customIdDisplayArea) customIdDisplayArea.style.display = 'none'; // Hide generated ID
    if(saveCustomerBtnText) saveCustomerBtnText.textContent = 'Save Customer'; // Set button text
    saveCustomerBtn.disabled = false; // Enable button
    customerModal.classList.add('active'); // Show modal
}

function openEditModal(firestoreId, data) {
    // ... (existing code) ...
     console.log("Opening modal to edit customer:", firestoreId);
     if (!customerModal || !customerForm) return;
     modalTitle.textContent = "Edit Customer";
     editCustomerIdInput.value = firestoreId; // Set Firestore ID for update
     if(saveCustomerBtnText) saveCustomerBtnText.textContent = 'Update Customer'; // Set button text
     saveCustomerBtn.disabled = false; // Enable button

     // Populate form fields with existing data
     customerFullNameInput.value = data.fullName || '';
     customerWhatsAppInput.value = data.whatsappNo || '';
     customerContactInput.value = data.contactNo || '';
     customerAddressInput.value = data.billingAddress || data.address || ''; // Prefer billingAddress

     // Show existing custom ID if available
     if (data.customCustomerId && generatedCustomIdInput && customIdDisplayArea) {
         generatedCustomIdInput.value = data.customCustomerId;
         customIdDisplayArea.style.display = 'block';
     } else if(customIdDisplayArea) {
         customIdDisplayArea.style.display = 'none';
     }
     customerModal.classList.add('active'); // Show modal
}

function closeCustomerModal() {
     if (customerModal) { customerModal.classList.remove('active'); }
}

// --- Save/Update Customer Handler (MODIFIED with Duplicate Check) ---
async function handleSaveCustomer(event) {
    event.preventDefault();
    // Check for required Firestore functions, including query, where, limit, getDocs
    if (!db || !collection || !addDoc || !doc || !updateDoc || !serverTimestamp || !runTransaction || !getDoc || !query || !where || !limit || !getDocs) {
         console.error("Database functions unavailable for saving customer.");
         alert("Database functions unavailable. Cannot save.");
         return;
    }

    const customerId = editCustomerIdInput.value; // Get Firestore ID from hidden input
    const isEditing = !!customerId; // Check if we are editing

    // Get form values
    const fullName = customerFullNameInput.value.trim();
    const whatsappNo = customerWhatsAppInput.value.trim(); // << Get WhatsApp number
    const contactNo = customerContactInput.value.trim() || null;
    const address = customerAddressInput.value.trim() || null;

    // Basic validation
    if (!fullName || !whatsappNo) {
        alert("Full Name and WhatsApp Number are required.");
        return;
    }

    // Disable button and show loading state
    saveCustomerBtn.disabled = true;
    const originalButtonHTML = saveCustomerBtn.innerHTML;
    saveCustomerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        // --- Prepare data payload ---
        const customerDataPayload = {
            fullName: fullName,
            whatsappNo: whatsappNo,
            contactNo: contactNo,
            billingAddress: address, // Using billingAddress field
            updatedAt: serverTimestamp() // Always update timestamp
        };

        if (isEditing) {
            // --- Update Existing Customer ---
            // (Optional: Add check here if WhatsApp number changed and now duplicates another existing one)
            console.log(`Updating customer ${customerId}...`);
            const customerRef = doc(db, "customers", customerId);
            await updateDoc(customerRef, customerDataPayload);
            console.log("Customer updated successfully.");
            alert("Customer updated successfully!");
            closeCustomerModal();
            // Listener updates UI
        } else {
            // --- Add New Customer ---

            // <<<--- START: Duplicate WhatsApp Check --->>>
            console.log(`Checking for existing customer with WhatsApp: ${whatsappNo}`);
            const customersRef = collection(db, "customers");
            const q = query(customersRef, where("whatsappNo", "==", whatsappNo), limit(1));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                // Customer with this WhatsApp number already exists
                const existingDoc = querySnapshot.docs[0];
                const existingCustomer = existingDoc.data();
                const existingCustomerId = existingDoc.id;
                console.log(`Duplicate found: ${existingCustomer.fullName} (ID: ${existingCustomerId})`);

                // Ask user if they want to update the existing customer
                const updateExisting = confirm(
                    `ग्राहक इस व्हाट्सएप नंबर (${whatsappNo}) के साथ पहले से मौजूद है: ${existingCustomer.fullName}.\n\nक्या आप मौजूदा ग्राहक विवरण को अपडेट करना चाहते हैं?`
                );

                if (updateExisting) {
                    // User wants to update
                    closeCustomerModal(); // Close the 'Add' modal
                    // Open the 'Edit' modal with the existing customer's data
                    openEditModal(existingCustomerId, existingCustomer);
                    // Stop the save process here
                    saveCustomerBtn.disabled = false; // Re-enable button
                    saveCustomerBtn.innerHTML = originalButtonHTML;
                    return;
                } else {
                    // User does not want to update, keep the 'Add' modal open
                    alert("कृपया एक अलग व्हाट्सएप नंबर दर्ज करें या मौजूदा ग्राहक को अपडेट करें।");
                    saveCustomerBtn.disabled = false; // Re-enable button
                    saveCustomerBtn.innerHTML = originalButtonHTML;
                    return; // Stop the save process
                }
            }
            // <<<--- END: Duplicate WhatsApp Check --->>>

            // --- If no duplicate found, proceed with adding new customer ---
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
            // Listener updates UI
        }
    } catch (error) {
        console.error("Error saving customer:", error);
        alert(`Error saving customer: ${error.message}`);
    } finally {
        // Ensure button is re-enabled in case of early return or error
        saveCustomerBtn.disabled = false;
        saveCustomerBtn.innerHTML = originalButtonHTML;
    }
}


// --- Delete Customer Handler ---
async function handleDeleteCustomer(firestoreId, customerName) {
    // ... (existing code - no changes needed here) ...
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
            // UI updates happen automatically via the Firestore listener (onSnapshot)
        } catch (error) {
            console.error(`Error deleting customer ${firestoreId}:`, error);
            alert(`Failed to delete customer: ${error.message}`);
        }
    } else {
        console.log("Deletion cancelled by user.");
    }
}

// --- Final Log ---
console.log("customer_management.js (V1.3 - Duplicate WhatsApp Check Added) script fully loaded.");