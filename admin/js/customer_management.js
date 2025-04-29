// js/customer_management.js
// Version: 1.2 (Updated Balance Display Logic: Due = Red/-, Credit = Green/+)
// WARNING: Ensure corresponding CSS in customer_management.css defines
// .balance-due { color: red; } and .balance-credit { color: green; }
// PLEASE TEST THOROUGHLY AFTER IMPLEMENTING.

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
    console.log("Customer Management DOM Loaded (V1.2 - Inverted Balance Display).");
    // Wait for DB connection just in case
    waitForDbConnection(() => {
        console.log("DB connection confirmed. Initializing listener.");
        listenForCustomers(); // Start listening for customer data

        // Event Listeners (No changes needed here)
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

// --- DB Connection Wait (No changes needed here) ---
function waitForDbConnection(callback) {
    if (window.db && window.getDocs) {
        callback();
    } else {
        let attempts = 0; const maxAttempts = 20;
        const intervalId = setInterval(() => {
            attempts++;
            if (window.db && window.getDocs) {
                clearInterval(intervalId); callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(intervalId); console.error("DB timeout or function missing (getDocs)"); alert("DB Error");
            }
        }, 250);
    }
}

// --- Sorting & Filtering (No changes needed here) ---
function handleSortChange() {
    if (!sortSelect) return;
    const selectedValue = sortSelect.value;
    const [field, direction] = selectedValue.split('_');
    if (field && direction) {
        if (field === currentSortField && direction === currentSortDirection) return;
        currentSortField = field;
        currentSortDirection = direction;
        console.log(`Customer sort changed: ${currentSortField} ${currentSortDirection}`);
        applyFiltersAndRender(); // Re-render with new sort
    }
}

function handleSearchInput() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        console.log("Customer search processed.");
        applyFiltersAndRender(); // Re-render with search term
    }, 300);
}

function clearFilters() {
    console.log("Clearing customer filters.");
    if(filterSearchInput) filterSearchInput.value = '';
    if(sortSelect) sortSelect.value = 'createdAt_desc'; // Reset sort
    currentSortField = 'createdAt';
    currentSortDirection = 'desc';
    applyFiltersAndRender(); // Re-render
}

// --- Firestore Listener Setup (No changes needed here) ---
function listenForCustomers() {
    if (unsubscribeCustomers) { unsubscribeCustomers(); unsubscribeCustomers = null; }
    if (!db || !collection || !query || !orderBy || !onSnapshot) { console.error("Firestore functions not available!"); return; }

    // Colspan remains 7 (ID, Name, WA, Contact, Addr, Balance, Actions)
    customerTableBody.innerHTML = `<tr><td colspan="7" id="loadingMessage" style="text-align: center; color: #666;">Loading customers...</td></tr>`;

    try {
        console.log("Setting up Firestore listener for 'customers'...");
        const customersRef = collection(db, "customers");
        const q = query(customersRef); // Fetch all initially

        unsubscribeCustomers = onSnapshot(q, (snapshot) => {
            console.log(`Received ${snapshot.docs.length} total customers from Firestore.`);
            allCustomersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            applyFiltersAndRender(); // Apply filters/sort and render table

        }, (error) => {
             console.error("Error fetching customers snapshot:", error);
             customerTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error loading customers.</td></tr>`;
        });
    } catch (error) {
         console.error("Error setting up customer listener:", error);
         customerTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error setting up listener.</td></tr>`;
    }
}

// --- Filter, Sort, and Render Function (No changes needed here) ---
function applyFiltersAndRender() {
    if (!allCustomersCache) return;
    console.log("Applying customer filters and rendering...");

    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';

    // Filter logic (remains the same)
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

    // Sort logic (remains the same)
    filteredCustomers.sort((a, b) => {
        let valA = a[currentSortField];
        let valB = b[currentSortField];
        // Handle different data types for sorting
        if (valA && typeof valA.toDate === 'function') valA = valA.toDate();
        if (valB && typeof valB.toDate === 'function') valB = valB.toDate();
        if (currentSortField === 'customCustomerId') {
            valA = Number(valA) || 0; valB = Number(valB) || 0;
        }
        if (currentSortField === 'fullName') {
            valA = (valA || '').toLowerCase(); valB = (valB || '').toLowerCase();
        }
        let comparison = 0;
        if (valA > valB) comparison = 1;
        else if (valA < valB) comparison = -1;
        return currentSortDirection === 'desc' ? (comparison * -1) : comparison;
    });
    console.log(`Sorted ${filteredCustomers.length} customers.`);

    // Render Table
    customerTableBody.innerHTML = ''; // Clear previous rows
    if (filteredCustomers.length === 0) {
        customerTableBody.innerHTML = `<tr><td colspan="7" id="noCustomersMessage" style="text-align: center; color: #666;">No customers found matching filters.</td></tr>`; // Updated colspan
    } else {
        // Render rows first with placeholders for balance
        filteredCustomers.forEach(customer => {
             displayCustomerRow(customer.id, customer);
        });
        // Then fetch and update balances asynchronously
        updateBalancesForDisplayedCustomers(filteredCustomers);
    }
     console.log("Customer rendering initiated.");
}

// --- Helper: Fetch Balance for ONE Customer (No changes needed here) ---
async function getCustomerBalance(customerId) {
    // This function calculates the actual balance (Positive=Due, Negative=Credit)
    // The display logic is handled separately in updateBalanceCell
    if (!db || !collection || !query || !where || !getDocs) {
        console.error("DB functions missing for balance calculation.");
        return null; // Indicate error
    }
    try {
        let totalOrderValue = 0;
        let totalPaidAdjusted = 0; // Includes payments and adjustments

        // Fetch Orders Total
        const ordersRef = collection(db, "orders");
        const orderQuery = query(ordersRef, where("customerId", "==", customerId));
        const orderSnapshot = await getDocs(orderQuery);
        orderSnapshot.forEach(doc => {
            totalOrderValue += Number(doc.data().totalAmount || 0);
        });

        // Fetch Payments & Adjustments Total
        const paymentsRef = collection(db, "payments");
        const paymentQuery = query(paymentsRef, where("customerId", "==", customerId));
        const paymentSnapshot = await getDocs(paymentQuery);
        paymentSnapshot.forEach(doc => {
            // amountPaid is +ve for Payments/Credit Adj, -ve for Debit Adj
            totalPaidAdjusted += Number(doc.data().amountPaid || 0);
        });

        // Balance = Order Value - Net Paid/Adjusted
        return totalOrderValue - totalPaidAdjusted;

    } catch (error) {
        console.error(`Error calculating balance for customer ${customerId}:`, error);
        return null; // Indicate error
    }
}

// --- Helper: Fetch and Update Balances for Visible Rows (No changes needed here) ---
async function updateBalancesForDisplayedCustomers(customers) {
    console.log(`Fetching balances for ${customers.length} customers...`);
    const balancePromises = customers.map(customer => getCustomerBalance(customer.id));

    try {
        const balances = await Promise.all(balancePromises);
        customers.forEach((customer, index) => {
            const balance = balances[index]; // This is the actual calculated balance
            const row = customerTableBody.querySelector(`tr[data-id="${customer.id}"]`);
            if (row) {
                const balanceCell = row.querySelector('.balance-cell');
                if (balanceCell) {
                    // Pass the calculated balance to the updated display function
                    updateBalanceCell(balanceCell, balance);
                }
            }
        });
        console.log("Balances updated for displayed customers.");
    } catch (error) {
        console.error("Error fetching balances for multiple customers:", error);
        // Update cells to show error
        customers.forEach(customer => {
             const row = customerTableBody.querySelector(`tr[data-id="${customer.id}"]`);
            if (row) {
                const balanceCell = row.querySelector('.balance-cell');
                if (balanceCell) {
                    balanceCell.innerHTML = `<span class="balance-value balance-loading" style="color:red;">Error</span>`;
                }
            }
        });
    }
}

// <<< MODIFIED HELPER FUNCTION >>>
// Formats number only, sign and currency symbol handled separately
function formatNumber(amount) {
    const num = Number(amount);
    if (isNaN(num)) return 'N/A';
    return Math.abs(num).toLocaleString('en-IN', { // Use Math.abs here for simplicity
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
// <<< MODIFIED HELPER FUNCTION END >>>


// <<< MODIFIED HELPER FUNCTION >>>
// Update Balance Cell Appearance (Due = Red/-, Credit = Green/+)
function updateBalanceCell(cellElement, balance) {
    // balance parameter is the actual calculated balance (Positive=Due, Negative=Credit)
    if (balance === null || typeof balance === 'undefined') {
        cellElement.innerHTML = `<span class="balance-value balance-loading" style="color:red;">Error</span>`;
        return;
    }

    let displayBalance = balance;
    let balanceClass = 'balance-zero'; // Default CSS class for zero
    let prefix = '';

    // Apply NEW display logic based on user requirement
    if (balance > 0.001) { // Positive Balance = ग्राहक पर बकाया (Due)
        balanceClass = 'balance-due'; // Use 'due' class for RED color
        prefix = '-'; // Display with '-' sign
        // displayBalance = balance; // Keep positive value for formatting
    } else if (balance < -0.001) { // Negative Balance = ग्राहक का क्रेडिट/जमा (Credit)
        balanceClass = 'balance-credit'; // Use 'credit' class for GREEN color
        prefix = '+'; // Display with '+' sign (optional)
        displayBalance = Math.abs(balance); // Make positive for display
    } else {
         // Zero Balance
         prefix = '';
         displayBalance = 0;
    }

    // Format the number part first
    const formattedNumber = formatNumber(Math.abs(displayBalance)); // Format absolute value

    // Combine currency symbol, prefix, and formatted number
    // Assuming currency symbol is handled by CSS or added here manually
    let finalDisplay = `₹${prefix}${formattedNumber}`;

    // Handle zero case specifically (no prefix needed)
    if (balanceClass === 'balance-zero') {
         finalDisplay = `₹0.00`;
    }

    // Set the inner HTML of the cell
    cellElement.innerHTML = `<span class="balance-value ${balanceClass}">${finalDisplay}</span>`;
}
// <<< MODIFIED HELPER FUNCTION END >>>


// --- Display Single Customer Row (No changes needed here) ---
function displayCustomerRow(firestoreId, data) {
    const tableRow = document.createElement('tr');
    tableRow.setAttribute('data-id', firestoreId);

    const customId = data.customCustomerId || '-';
    const name = data.fullName || 'N/A';
    const whatsapp = data.whatsappNo || '-';
    const contact = data.contactNo || '-';
    const address = data.billingAddress || data.address || '-';

    // Balance cell starts with a loading placeholder
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

    // Row click listener (navigate to detail page)
    tableRow.style.cursor = 'pointer';
    tableRow.addEventListener('click', (e) => {
        if (e.target.closest('button.action-button')) {
            return; // Don't navigate if an action button was clicked
        }
        window.location.href = `customer_account_detail.html?id=${firestoreId}`;
    });

    // Attach button event listeners
    const editButton = tableRow.querySelector('.edit-button');
    if (editButton) {
        editButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent row click navigation
            openEditModal(firestoreId, data);
        });
    }
    const deleteButton = tableRow.querySelector('.delete-button');
    if (deleteButton) {
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent row click navigation
            handleDeleteCustomer(firestoreId, name);
        });
    }

    customerTableBody.appendChild(tableRow);
    // Balance is fetched and updated later by updateBalancesForDisplayedCustomers
}


// --- Modal Handling (Add/Edit) --- (No changes needed here)
function openAddModal() {
    console.log("Opening modal to add new customer.");
    if (!customerModal || !customerForm) return;
    modalTitle.textContent = "Add New Customer";
    editCustomerIdInput.value = ''; // Clear ID for add mode
    customerForm.reset(); // Reset form fields
    if(customIdDisplayArea) customIdDisplayArea.style.display = 'none'; // Hide ID display
    if(saveCustomerBtnText) saveCustomerBtnText.textContent = 'Save Customer';
    saveCustomerBtn.disabled = false;
    customerModal.classList.add('active');
}

function openEditModal(firestoreId, data) {
     console.log("Opening modal to edit customer:", firestoreId);
     if (!customerModal || !customerForm) return;
     modalTitle.textContent = "Edit Customer";
     editCustomerIdInput.value = firestoreId; // Set ID for edit mode
     if(saveCustomerBtnText) saveCustomerBtnText.textContent = 'Update Customer';
     saveCustomerBtn.disabled = false;

     // Populate form fields
     customerFullNameInput.value = data.fullName || '';
     customerWhatsAppInput.value = data.whatsappNo || '';
     customerContactInput.value = data.contactNo || '';
     customerAddressInput.value = data.billingAddress || data.address || ''; // Prefer billingAddress

     // Show existing Custom ID if available
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

// --- Save/Update Customer Handler (WITH TRANSACTION for Add) --- (No changes needed here)
async function handleSaveCustomer(event) {
    event.preventDefault();
    if (!db || !collection || !addDoc || !doc || !updateDoc || !serverTimestamp || !runTransaction || !getDoc) {
         console.error("Database functions unavailable.");
         alert("Database functions unavailable. Cannot save.");
         return;
    }

    const customerId = editCustomerIdInput.value; // Get Firestore ID if editing
    const isEditing = !!customerId;

    // Get form values
    const fullName = customerFullNameInput.value.trim();
    const whatsappNo = customerWhatsAppInput.value.trim();
    const contactNo = customerContactInput.value.trim() || null;
    const address = customerAddressInput.value.trim() || null; // Use billingAddress field

    // Basic validation
    if (!fullName || !whatsappNo) {
        alert("Full Name and WhatsApp Number are required.");
        return;
    }

    // Disable button, show spinner
    saveCustomerBtn.disabled = true;
    const originalButtonHTML = saveCustomerBtn.innerHTML;
    saveCustomerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    // Prepare data payload
    const customerDataPayload = {
        fullName: fullName,
        whatsappNo: whatsappNo,
        contactNo: contactNo,
        billingAddress: address, // Save address to billingAddress field
        updatedAt: serverTimestamp()
        // NOTE: Balance is NOT saved/updated directly here.
        // It's calculated dynamically or should be handled via Cloud Functions.
    };
     // Remove null fields if necessary (Firestore handles this mostly)
     // Object.keys(customerDataPayload).forEach(key => customerDataPayload[key] === null && delete customerDataPayload[key]);

    try {
        if (isEditing) {
             // --- Update Existing Customer ---
             console.log(`Updating customer ${customerId}...`);
             const customerRef = doc(db, "customers", customerId);
             await updateDoc(customerRef, customerDataPayload);
             console.log("Customer updated successfully.");
             alert("Customer updated successfully!");
             closeCustomerModal(); // Close modal on success
             // UI will update automatically via the listener

        } else {
            // --- Add New Customer (using Transaction for Counter) ---
            console.log("Adding new customer via transaction...");
            const counterRef = doc(db, "counters", "customerCounter");
            const newCustomerColRef = collection(db, "customers");

            // Run transaction to get next ID and save customer
            await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                let nextId = 101; // Default starting ID
                if (counterDoc.exists() && counterDoc.data().lastId) {
                    nextId = counterDoc.data().lastId + 1;
                } else {
                     console.log("Counter document 'customerCounter' or field 'lastId' not found, starting ID at 101.");
                }

                // Add transaction-specific data
                customerDataPayload.customCustomerId = nextId; // Assign the generated ID
                customerDataPayload.createdAt = serverTimestamp(); // Add creation timestamp
                customerDataPayload.status = 'active'; // Default status for new customer
                // Default Credit details (Optional - you might want these in the modal too)
                customerDataPayload.creditAllowed = false;
                customerDataPayload.creditLimit = 0;


                // Create a reference for the new customer document *within* the transaction
                const newDocRef = doc(newCustomerColRef); // Generate ID automatically
                // Set the customer data
                transaction.set(newDocRef, customerDataPayload);
                // Update the counter
                transaction.set(counterRef, { lastId: nextId }, { merge: true }); // Use merge:true to create/update counter

                console.log(`Transaction prepared: Set customer ${newDocRef.id} with customId ${nextId}, update counter to ${nextId}.`);
            });

            console.log("Transaction successful. New customer added.");
            alert("New customer added successfully!");
            closeCustomerModal(); // Close modal on success
             // UI will update automatically via the listener
        }
    } catch (error) {
        console.error("Error saving customer:", error);
        alert(`Error saving customer: ${error.message}`);
    } finally {
        // Re-enable button, restore text
        saveCustomerBtn.disabled = false;
        saveCustomerBtn.innerHTML = originalButtonHTML;
    }
}


// --- Delete Customer Handler --- (No changes needed here)
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
            // UI updates automatically via the listener removing the customer

        } catch (error) {
            console.error(`Error deleting customer ${firestoreId}:`, error);
            alert(`Failed to delete customer: ${error.message}`);
        }
    } else {
        console.log("Deletion cancelled by user.");
    }
}

// --- Final Log ---
console.log("customer_management.js (V1.2 - Inverted Balance Display) script fully loaded.");