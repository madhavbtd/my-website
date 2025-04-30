// js/customer_management.js
// Version 1.5 (Added fullNameLower on save/update)

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
    console.log("Customer Management Initializing (V1.5 - fullNameLower added)..."); // Version updated

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
    console.log("Customer Management event listeners set up (V1.5).");
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
        // Check if sorting by name, might need fullNameLower if available
        if (field === 'fullName') {
             console.warn("Sorting by fullName. Consider using fullNameLower for consistency if available everywhere.");
             // For now, client-side sort uses fullName directly as before.
             // If you implement fullNameLower everywhere, you might adjust the sorting logic too.
        }
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
    if(sortSelect) sortSelect.value = 'createdAt_desc'; // Default sort
    currentSortField = 'createdAt';
    currentSortDirection = 'desc';
    applyFiltersAndRender();
}


// --- Firestore Listener Setup ---
function listenForCustomers() {
    if (unsubscribeCustomers) { unsubscribeCustomers(); unsubscribeCustomers = null; }
    if (!db || !collection || !query || !orderBy || !onSnapshot) {
         console.error("Firestore functions not available for listener!");
         if(customerTableBody) customerTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error: Listener functions not ready.</td></tr>`;
         return;
    }

    if(customerTableBody) customerTableBody.innerHTML = `<tr><td colspan="7" id="loadingMessage" style="text-align: center; color: #666;">Loading customers...</td></tr>`;

    try {
        console.log("Setting up Firestore listener for 'customers' (V1.5)...");
        const customersRef = collection(db, "customers");
        // Fetch all customers initially, sorting/filtering done client-side
        const q = query(customersRef);

        unsubscribeCustomers = onSnapshot(q, (snapshot) => {
            console.log(`Received ${snapshot.docs.length} total customers from Firestore.`);
            allCustomersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Apply client-side filtering and sorting after getting all data
            applyFiltersAndRender();

        }, (error) => {
            console.error("Error fetching customers snapshot:", error);
            if(customerTableBody) customerTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error loading customers: ${error.message}</td></tr>`;
         });
    } catch (error) {
         console.error("Error setting up customer listener:", error);
         if(customerTableBody) customerTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error setting up listener: ${error.message}</td></tr>`;
     }
}


// --- Filter, Sort, and Render Function ---
function applyFiltersAndRender() {
    if (!allCustomersCache || !customerTableBody) return;
    console.log("Applying customer filters and rendering...");

    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';

    // Client-side filtering
    let filteredCustomers = allCustomersCache.filter(customer => {
        if (filterSearchValue) {
            const customId = (customer.customCustomerId || '').toString().toLowerCase();
            const name = (customer.fullName || '').toLowerCase(); // Use actual name for filtering text match
            const whatsapp = (customer.whatsappNo || '').toLowerCase();
            const contact = (customer.contactNo || '').toLowerCase();
            const id = (customer.id || '').toLowerCase(); // Firestore document ID

            // Check if search term exists in any relevant field
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

    // Client-side sorting
    filteredCustomers.sort((a, b) => {
        let valA = a[currentSortField];
        let valB = b[currentSortField];

        // Handle specific field types for proper comparison
        if (valA && typeof valA.toDate === 'function') valA = valA.toDate(); // Timestamps
        if (valB && typeof valB.toDate === 'function') valB = valB.toDate(); // Timestamps
        if (currentSortField === 'customCustomerId') { // Numeric IDs
            valA = Number(valA) || 0;
            valB = Number(valB) || 0;
        }
        if (currentSortField === 'fullName') { // Names (case-insensitive)
            valA = (valA || '').toLowerCase();
            valB = (valB || '').toLowerCase();
        }

        // Perform comparison
        let comparison = 0;
        if (valA > valB) comparison = 1;
        else if (valA < valB) comparison = -1;

        // Apply direction
        return currentSortDirection === 'desc' ? (comparison * -1) : comparison;
    });
    console.log(`Sorted ${filteredCustomers.length} customers.`);

    // Render the table
    customerTableBody.innerHTML = ''; // Clear existing rows
    if (filteredCustomers.length === 0) {
        customerTableBody.innerHTML = `<tr><td colspan="7" id="noCustomersMessage" style="text-align: center; color: #666;">No customers found matching filters.</td></tr>`;
    } else {
        filteredCustomers.forEach(customer => {
             displayCustomerRow(customer.id, customer); // Render each row
        });
        // Update balances only for the customers currently displayed
        updateBalancesForDisplayedCustomers(filteredCustomers);
    }
     console.log("Customer rendering initiated.");
}

// --- Helper: Fetch and Update Balances for Visible Rows ---
async function updateBalancesForDisplayedCustomers(customers) {
     console.log(`Workspaceing balances for ${customers.length} displayed customers...`);
     // Use Promise.allSettled to handle potential errors for individual balances
    const balancePromises = customers.map(customer =>
        getCustomerBalance(customer.id)
            .then(balance => ({ status: 'fulfilled', value: balance, id: customer.id }))
            .catch(error => ({ status: 'rejected', reason: error, id: customer.id }))
    );

    const results = await Promise.allSettled(balancePromises);

    results.forEach(result => {
        const customerId = result.status === 'fulfilled' ? result.value.id : result.reason.id; // Get ID from result/reason
        const row = customerTableBody.querySelector(`tr[data-id="${customerId}"]`);
        if (row) {
            const balanceCell = row.cells[5]; // Assuming balance is the 6th cell (index 5)
            if (balanceCell) {
                if (result.status === 'fulfilled') {
                    updateBalanceCell(balanceCell, result.value.value); // Pass the calculated balance
                } else {
                    console.error(`Failed to get balance for ${customerId}:`, result.reason);
                    updateBalanceCell(balanceCell, null); // Show error state in cell
                }
            }
        }
    });
    console.log("Balances updated for displayed customers (with potential errors handled).");

}


// --- Helper: Get Balance for ONE Customer ---
async function getCustomerBalance(customerId) {
     if (!db || !collection || !query || !where || !getDocs) {
        console.error("DB functions missing for balance calculation.");
        // Throw an error or return a specific value to indicate failure
        throw new Error("DB functions missing");
    }
    try {
        let totalOrderValue = 0;
        let totalPaidAmount = 0;
        let totalDebitAdjustment = 0;
        let totalCreditAdjustment = 0;

        // --- Get Orders ---
        const ordersRef = collection(db, "orders");
        const orderQuery = query(ordersRef, where("customerId", "==", customerId));
        const orderSnapshot = await getDocs(orderQuery);
        orderSnapshot.forEach(doc => {
            totalOrderValue += Number(doc.data().totalAmount || 0);
        });

        // --- Get Payments ---
        const paymentsRef = collection(db, "payments");
        const paymentQuery = query(paymentsRef, where("customerId", "==", customerId));
        const paymentSnapshot = await getDocs(paymentQuery);
        paymentSnapshot.forEach(doc => {
            totalPaidAmount += Number(doc.data().amountPaid || 0);
        });

        // --- Get Adjustments (Optional but good for accuracy) ---
        try {
             const adjustmentsRef = collection(db, "accountAdjustments");
             const adjustmentQuery = query(adjustmentsRef, where("customerId", "==", customerId));
             const adjustmentSnapshot = await getDocs(adjustmentQuery);
             adjustmentSnapshot.forEach(doc => {
                 const adj = doc.data();
                 const amount = Number(adj.amount || 0);
                 if (adj.adjustmentType === 'debit') {
                     totalDebitAdjustment += amount;
                 } else if (adj.adjustmentType === 'credit') {
                     totalCreditAdjustment += amount;
                 }
             });
        } catch (adjError) {
            // Log adjustment error but continue calculation
             console.warn(`Could not fetch adjustments for customer ${customerId}: ${adjError.message}. Balance might be slightly off if adjustments exist.`);
             if(adjError.code === 'failed-precondition'){
                console.warn(`Firestore index potentially missing for 'accountAdjustments' collection by customerId.`);
             }
        }

        // Calculate final balance
        const totalDebits = totalOrderValue + totalDebitAdjustment;
        const totalCredits = totalPaidAmount + totalCreditAdjustment;
        return totalDebits - totalCredits; // Positive = Due, Negative = Credit

    } catch (error) {
        console.error(`Error calculating balance for customer ${customerId}:`, error);
         if(error.code === 'failed-precondition') {
            console.warn(`Firestore index potentially missing for balance calculation (orders/payments) for customer ${customerId}`);
         }
         // Throw error to be caught by Promise.allSettled
         throw error;
    }
}

// --- Helper: Format Currency ---
function formatCurrency(amount) {
    const num = Number(amount);
    if (isNaN(num)) return 'N/A';
    // Use INR currency formatting
    return num.toLocaleString('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// --- Helper: Update Balance Cell Appearance ---
function updateBalanceCell(cellElement, balance) {
     if (balance === null || typeof balance === 'undefined' || isNaN(balance)) {
        cellElement.innerHTML = `<span class="balance-value balance-loading" title="Error calculating balance">Error</span>`;
        cellElement.classList.remove('balance-due', 'balance-credit', 'balance-zero');
        cellElement.classList.add('balance-due'); // Show errors as 'due' color
        return;
    }

    let displayValue;
    let balanceClass = 'balance-zero';
    let titleText = 'Zero Balance';
    const tolerance = 0.005; // Use a small tolerance for floating point comparisons

    if (balance > tolerance) { // Customer owes money (Due)
        balanceClass = 'balance-due';
        // Display positive value, indicating amount due. Sign handled by class/convention.
        displayValue = formatCurrency(balance);
        titleText = `Due: ${formatCurrency(balance)}`;
    } else if (balance < -tolerance) { // Customer has credit
        balanceClass = 'balance-credit';
        // Display positive value of the credit amount.
        displayValue = formatCurrency(Math.abs(balance));
        titleText = `Credit: ${formatCurrency(Math.abs(balance))}`;
    } else { // Balance is zero or very close to it
        balanceClass = 'balance-zero';
        displayValue = formatCurrency(0);
        titleText = 'Zero Balance';
    }

    // Apply styles and text
    cellElement.classList.remove('balance-due', 'balance-credit', 'balance-zero');
    cellElement.classList.add(balanceClass);
    cellElement.innerHTML = `<span class="balance-value" title="${titleText}">${displayValue}</span>`;
}


// --- Display Single Customer Row ---
function displayCustomerRow(firestoreId, data) {
     if (!customerTableBody) return;
     const tableRow = document.createElement('tr');
    tableRow.setAttribute('data-id', firestoreId);

    // Sanitize data display
    const escapeHtml = (unsafe) => {
        if (typeof unsafe !== 'string') return unsafe; // Return non-strings as is
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
     };

    const customId = escapeHtml(data.customCustomerId) || '-';
    const name = escapeHtml(data.fullName) || 'N/A';
    const whatsapp = escapeHtml(data.whatsappNo) || '-';
    const contact = escapeHtml(data.contactNo) || '-';
    // Prefer billingAddress, fallback to address
    const address = escapeHtml(data.billingAddress || data.address) || '-';

    // Create cells safely
    tableRow.innerHTML = `
        <td>${customId}</td>
        <td>${name}</td>
        <td>${whatsapp}</td>
        <td>${contact}</td>
        <td title="${address}">${address.length > 30 ? address.substring(0, 30) + '...' : address}</td>
        <td><span class="balance-value balance-loading">...</span></td>
        <td>
            <div class="action-buttons-container">
                <button type="button" class="action-button edit-button" title="Edit Customer">
                    <i class="fas fa-edit"></i>
                </button>
                <button type="button" class="action-button delete-button" title="Delete Customer">
                    <i class="fas fa-trash-alt"></i>
                </button>
                <button type="button" class="action-button view-button" title="View Account Details">
                     <i class="fas fa-eye"></i>
                 </button>
             </div>
        </td>
    `;

    // Event listener for clicking the row (excluding buttons) to view details
    tableRow.addEventListener('click', (e) => {
        if (e.target.closest('button.action-button')) {
            return; // Ignore clicks on action buttons
        }
        // Navigate to customer detail page
        window.location.href = `customer_account_detail.html?id=${firestoreId}`;
    });

    // Event listeners for action buttons
    const editButton = tableRow.querySelector('.edit-button');
    if (editButton) {
        editButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent row click event
            openEditModal(firestoreId, data);
        });
    }
    const deleteButton = tableRow.querySelector('.delete-button');
    if (deleteButton) {
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent row click event
            handleDeleteCustomer(firestoreId, name);
        });
    }
     const viewButton = tableRow.querySelector('.view-button');
    if (viewButton) {
         viewButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent row click event
             window.location.href = `customer_account_detail.html?id=${firestoreId}`;
         });
     }


    // Append the row to the table body
    customerTableBody.appendChild(tableRow);
}


// --- Modal Handling (Add/Edit) ---
function openAddModal() {
     console.log("Opening modal to add new customer.");
    if (!customerModal || !customerForm || !modalTitle || !editCustomerIdInput || !saveCustomerBtnText || !saveCustomerBtn || !customIdDisplayArea) {
        console.error("Add Customer Modal or its elements not found.");
        return;
    }
    modalTitle.textContent = "Add New Customer";
    editCustomerIdInput.value = ''; // Clear edit ID
    customerForm.reset(); // Reset form fields
    customIdDisplayArea.style.display = 'none'; // Hide custom ID field for new customers
    saveCustomerBtnText.textContent = 'Save Customer';
    saveCustomerBtn.disabled = false; // Ensure button is enabled
    customerModal.classList.add('active'); // Show the modal
    customerFullNameInput.focus(); // Focus the first field
}

function openEditModal(firestoreId, data) {
     console.log("Opening modal to edit customer:", firestoreId);
     if (!customerModal || !customerForm || !modalTitle || !editCustomerIdInput || !saveCustomerBtnText || !saveCustomerBtn || !customIdDisplayArea || !generatedCustomIdInput) {
         console.error("Edit Customer Modal or its elements not found.");
         return;
     }
     modalTitle.textContent = "Edit Customer";
     editCustomerIdInput.value = firestoreId; // Set the ID for editing
     saveCustomerBtnText.textContent = 'Update Customer';
     saveCustomerBtn.disabled = false; // Ensure button is enabled

     // Populate form fields with existing data
     customerFullNameInput.value = data.fullName || '';
     customerWhatsAppInput.value = data.whatsappNo || '';
     customerContactInput.value = data.contactNo || '';
     // Prefer billingAddress, fallback to address
     customerAddressInput.value = data.billingAddress || data.address || '';

     // Display the existing Custom Customer ID (read-only)
     if (data.customCustomerId) {
         generatedCustomIdInput.value = data.customCustomerId;
         customIdDisplayArea.style.display = 'block';
     } else {
         customIdDisplayArea.style.display = 'none'; // Hide if no custom ID exists
     }

     customerModal.classList.add('active'); // Show the modal
     customerFullNameInput.focus(); // Focus the first field
}

function closeCustomerModal() {
     if (customerModal) { customerModal.classList.remove('active'); }
}

// --- Save/Update Customer Handler ---
// >>> UPDATED TO INCLUDE fullNameLower <<<
async function handleSaveCustomer(event) {
     event.preventDefault();
    // Check for required Firestore functions from module scope
    if (!db || !collection || !addDoc || !doc || !updateDoc || !serverTimestamp || !runTransaction || !getDoc || !query || !where || !limit || !getDocs) {
         console.error("Database functions unavailable for saving customer.");
         alert("Database functions unavailable. Cannot save.");
         return;
    }
    if (!saveCustomerBtn) { // Ensure button exists
        console.error("Save button not found.");
        return;
    }


    const customerId = editCustomerIdInput.value;
    const isEditing = !!customerId;

    const fullName = customerFullNameInput.value.trim();
    const whatsappNo = customerWhatsAppInput.value.trim();
    // Optional fields: use null if empty
    const contactNo = customerContactInput.value.trim() || null;
    const address = customerAddressInput.value.trim() || null; // Use billingAddress field

    if (!fullName || !whatsappNo) {
        alert("Full Name and WhatsApp Number are required.");
        return;
    }

    // Basic WhatsApp validation (optional, adjust regex as needed)
    // This is a simple check, consider a library for robust validation
    const whatsappRegex = /^\+?[1-9]\d{1,14}$/; // E.164 format basic check
    if (!whatsappRegex.test(whatsappNo.replace(/\s+/g, ''))) { // Remove spaces before testing
        alert("Please enter a valid WhatsApp number (e.g., +91XXXXXXXXXX or 91XXXXXXXXXX).");
        return;
    }


    saveCustomerBtn.disabled = true;
    const originalButtonHTML = saveCustomerBtn.innerHTML;
    saveCustomerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        // --- Common Payload Data ---
        const customerDataPayload = {
            fullName: fullName,
            fullNameLower: fullName.toLowerCase(), // <<< Always include fullNameLower
            whatsappNo: whatsappNo,
            contactNo: contactNo, // Will be null if empty
            billingAddress: address, // Save to billingAddress field
            // Ensure address field is also updated or handled if needed elsewhere
            // address: address, // Optional: if you still use the 'address' field too
            updatedAt: serverTimestamp() // Use server timestamp for update time
        };

        // --- Handle Editing Existing Customer ---
        if (isEditing) {
            console.log(`Updating customer ${customerId}...`);
            const customerRef = doc(db, "customers", customerId);
            // Remove fields that shouldn't be updated directly if they exist in payload
            // delete customerDataPayload.createdAt; // Example if accidentally added
            // delete customerDataPayload.customCustomerId; // Prevent changing custom ID

            await updateDoc(customerRef, customerDataPayload);
            console.log("Customer updated successfully.");
            alert("Customer updated successfully!");
            closeCustomerModal();

        // --- Handle Adding New Customer ---
        } else {
            // Check for duplicate WhatsApp number before adding
            console.log(`Checking for existing customer with WhatsApp: ${whatsappNo}`);
            const customersRef = collection(db, "customers");
            const q = query(customersRef, where("whatsappNo", "==", whatsappNo), limit(1));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                // Duplicate Found - Ask user how to proceed
                const existingDoc = querySnapshot.docs[0];
                const existingCustomer = existingDoc.data();
                const existingCustomerId = existingDoc.id;
                console.log(`Duplicate found: ${existingCustomer.fullName} (ID: ${existingCustomerId})`);

                // Use confirm dialog (or a custom modal for better UX)
                const updateExisting = confirm(
                    `A customer with this WhatsApp number (${whatsappNo}) already exists: ${existingCustomer.fullName}.\n\nDo you want to update the existing customer details?`
                );

                if (updateExisting) {
                    // Open the edit modal with the existing customer's data
                    closeCustomerModal(); // Close the add modal first
                    openEditModal(existingCustomerId, { id: existingCustomerId, ...existingCustomer }); // Pass full data
                } else {
                    // User chose not to update, keep the add modal open
                    alert("Please enter a different WhatsApp number or update the existing customer.");
                }
                // Re-enable button in either case of duplicate check interaction
                saveCustomerBtn.disabled = false;
                saveCustomerBtn.innerHTML = originalButtonHTML;
                return; // Stop further execution for adding
            }

            // No duplicate found - Proceed to add using a transaction
            console.log("No duplicate found. Proceeding to add new customer via transaction...");
            const counterRef = doc(db, "counters", "customerCounter");
            const newCustomerColRef = collection(db, "customers");

            // Run as transaction to ensure atomicity (get counter, save customer, update counter)
            await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                let nextId = 101; // Default starting ID
                if (counterDoc.exists() && counterDoc.data().lastId) {
                    nextId = counterDoc.data().lastId + 1;
                } else {
                     console.log("Counter document 'customerCounter' or field 'lastId' not found, starting ID at 101.");
                }

                // Add fields specific to new customers to the payload
                customerDataPayload.customCustomerId = nextId;
                customerDataPayload.createdAt = serverTimestamp(); // Add creation timestamp
                customerDataPayload.status = 'active'; // Default status

                // Create a new document reference within the transaction
                const newDocRef = doc(newCustomerColRef);
                // Set the data for the new customer
                transaction.set(newDocRef, customerDataPayload);
                // Update the counter document
                transaction.set(counterRef, { lastId: nextId }, { merge: true }); // Use merge to avoid overwriting other counter fields

                console.log(`Transaction prepared: Set customer ${newDocRef.id} with customId ${nextId}, update counter to ${nextId}.`);
            });

            console.log("Transaction successful. New customer added.");
            alert("New customer added successfully!");
            closeCustomerModal();
        }
    } catch (error) {
        console.error("Error saving customer:", error);
        alert(`Error saving customer: ${error.message}`);
        // Ensure button is re-enabled on error
        saveCustomerBtn.disabled = false;
        saveCustomerBtn.innerHTML = originalButtonHTML;
    }
    // 'finally' block removed as button re-enable logic is handled on error/duplicate scenarios
}


// --- Delete Customer Handler ---
async function handleDeleteCustomer(firestoreId, customerName) {
     console.log(`handleDeleteCustomer called for ID: ${firestoreId}, Name: ${customerName}`);
    // Check for required functions from module scope
    if (!db || !doc || !deleteDoc) {
        console.error("Delete function not available.");
        alert("Error: Delete function not available.");
        return;
    }
    // Use a more user-friendly confirmation message
    if (confirm(`Are you absolutely sure you want to delete customer "${customerName}" (ID: ${firestoreId})?\n\nThis action cannot be undone.`)) {
        console.log(`User confirmed deletion for ${firestoreId}. Proceeding...`);
        try {
            const customerRef = doc(db, "customers", firestoreId);
            await deleteDoc(customerRef);
            console.log(`Customer deleted successfully from Firestore: ${firestoreId}`);
            alert(`Customer "${customerName}" deleted.`);
            // Optionally, remove the row from the table immediately for better UX
            const rowToRemove = customerTableBody.querySelector(`tr[data-id="${firestoreId}"]`);
            if (rowToRemove) {
                rowToRemove.remove();
                 // Check if table is now empty
                 if (customerTableBody.rows.length === 0) {
                    customerTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #666;">No customers found.</td></tr>`;
                 }
            }
        } catch (error) {
            console.error(`Error deleting customer ${firestoreId}:`, error);
            alert(`Failed to delete customer: ${error.message}`);
        }
    } else {
        console.log("Deletion cancelled by user.");
    }
}

// --- Final Log ---
// console.log("customer_management.js (V1.5 - fullNameLower added) script fully loaded.");