// js/expenses.js - Expenses Management Logic with Filters (v7 - Corrected Paths & Payment Method Column)

// --- Firebase Imports ---
// पाथ सही किया गया: firebase-init.js और expenses.js दोनों 'js' फोल्डर में हैं
import { db, auth } from './firebase-init.js';
import {
    collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc,
    query, orderBy, where, Timestamp, serverTimestamp,
    startAt, endAt
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Global Variables ---
let expensesCache = [];
let currentEditingExpenseId = null;
let listenersAttached = false; // Flag to prevent adding listeners multiple times

// --- DOM Elements Cache ---
// Variables declared globally, will be assigned in cacheDOMElements
let addExpenseBtn, expenseModal, expenseModalTitle, closeExpenseModalBtn, cancelExpenseBtn,
    saveExpenseBtn, expenseForm, editingExpenseIdInput, expenseDateInput,
    expenseCategoryInput, expenseAmountInput, expenseDescriptionInput,
    expensePaymentMethodInput, expenseNotesInput, expenseFormError,
    expensesTableBody, expensesLoadingMessage, noExpensesMessage,
    expenseListError, expensesTotalDisplay,
    // Filter elements
    filterSearchInput, filterCategoryInput, filterStartDateInput, filterEndDateInput,
    applyExpenseFiltersBtn, clearExpenseFiltersBtn;

// Function to cache DOM elements
function cacheDOMElements() {
    // Only cache if not already cached (might be called multiple times inadvertently)
    if (addExpenseBtn) return; // Assume if one is cached, all are

    console.log("[CacheDOM] Caching elements...");
    addExpenseBtn = document.getElementById('addExpenseBtn');
    expenseModal = document.getElementById('expenseModal');
    expenseModalTitle = document.getElementById('expenseModalTitle');
    closeExpenseModalBtn = document.getElementById('closeExpenseModalBtn');
    cancelExpenseBtn = document.getElementById('cancelExpenseBtn');
    saveExpenseBtn = document.getElementById('saveExpenseBtn');
    expenseForm = document.getElementById('expenseForm');
    editingExpenseIdInput = document.getElementById('editingExpenseId');
    expenseDateInput = document.getElementById('expenseDate');
    expenseCategoryInput = document.getElementById('expenseCategory');
    expenseAmountInput = document.getElementById('expenseAmount');
    expenseDescriptionInput = document.getElementById('expenseDescription');
    expensePaymentMethodInput = document.getElementById('expensePaymentMethod');
    expenseNotesInput = document.getElementById('expenseNotes');
    expenseFormError = document.getElementById('expenseFormError');
    expensesTableBody = document.getElementById('expensesTableBody');
    expensesLoadingMessage = document.getElementById('expensesLoadingMessage');
    noExpensesMessage = document.getElementById('noExpensesMessage');
    expenseListError = document.getElementById('expenseListError');
    expensesTotalDisplay = document.getElementById('expensesTotalDisplay');
    // Filter elements
    filterSearchInput = document.getElementById('filterSearch');
    filterCategoryInput = document.getElementById('filterCategory');
    filterStartDateInput = document.getElementById('filterStartDate');
    filterEndDateInput = document.getElementById('filterEndDate');
    applyExpenseFiltersBtn = document.getElementById('applyExpenseFiltersBtn');
    clearExpenseFiltersBtn = document.getElementById('clearExpenseFiltersBtn');

    // Check if filter buttons were found after caching
    if (!applyExpenseFiltersBtn) console.error("[CacheDOM] Apply Filters button (applyExpenseFiltersBtn) NOT FOUND!");
    if (!clearExpenseFiltersBtn) console.error("[CacheDOM] Clear Filters button (clearExpenseFiltersBtn) NOT FOUND!");

    console.log("[CacheDOM] Caching attempt complete.");
}


// --- Utility Functions ---
function formatDate(timestamp) { if (!timestamp || typeof timestamp.toDate !== 'function') return '-'; try { return timestamp.toDate().toLocaleDateString('en-GB'); /* dd/mm/yyyy format */ } catch (e) { console.error("Error formatting date:", timestamp, e); return 'Invalid Date'; } }
function formatCurrency(amount) { const num = Number(amount); if (isNaN(num)) return 'N/A'; return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { try { unsafe = String(unsafe ?? ''); } catch (e) { unsafe = ''; } } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function displayExpenseError(message, elementId = 'expenseListError') { const errorElement = document.getElementById(elementId); if (errorElement) { errorElement.textContent = message; errorElement.style.display = message ? 'block' : 'none'; console.log(`Error displayed in ${elementId}: ${message}`); } else { console.error(`Error element ID '${elementId}' not found. Msg:`, message); if(elementId !== 'expenseFormError') alert(message); /* Show alert only for list errors if element not found */ } }
function clearExpenseError(elementId = 'expenseListError') { const errorElement = document.getElementById(elementId); if (errorElement) { errorElement.textContent = ''; errorElement.style.display = 'none'; } /* Also clear form error when clearing list error */ if (elementId === 'expenseListError' && expenseFormError) { expenseFormError.textContent = ''; expenseFormError.style.display = 'none'; } }

// --- Core Functions ---

/** Loads expenses from Firestore based on current filters and displays them. */
async function loadExpenses() {
    // Ensure elements are cached before proceeding
    cacheDOMElements();

    if (!expensesTableBody || !expensesLoadingMessage || !noExpensesMessage || !expensesTotalDisplay) { console.error("Expense table elements not found. Cannot load expenses."); return; }
    if (!auth.currentUser) { displayExpenseError("Please login to view expenses."); return; }
    console.log("[LoadExpenses] Starting to load expenses...");

    expensesLoadingMessage.style.display = 'table-row';
    noExpensesMessage.style.display = 'none';
    // Clear only specific expense rows, not the loading/no-message rows
    const rowsToRemove = expensesTableBody.querySelectorAll('tr:not(#expensesLoadingMessage):not(#noExpensesMessage)');
    rowsToRemove.forEach(row => row.remove());
    clearExpenseError();
    let totalAmount = 0;
    expensesTotalDisplay.textContent = 'Calculating total...';

    try {
        const expensesRef = collection(db, "expenses");
        let conditions = [where("userId", "==", auth.currentUser.uid)];

        // --- Apply Firestore Filters ---
        const categoryFilter = filterCategoryInput?.value.trim();
        const startDateVal = filterStartDateInput?.value;
        const endDateVal = filterEndDateInput?.value;

        if (categoryFilter) { console.log("[LoadExpenses] Applying Firestore category filter:", categoryFilter); conditions.push(where("category", "==", categoryFilter)); }
        if (startDateVal) { try { const startDate = new Date(startDateVal + 'T00:00:00'); if(isNaN(startDate.getTime())) throw new Error("Invalid start date"); conditions.push(where("expenseDate", ">=", Timestamp.fromDate(startDate))); console.log("[LoadExpenses] Applying start date filter:", startDateVal); } catch (e) { console.error("Invalid start date format:", e); displayExpenseError("Invalid 'From Date'. Please use YYYY-MM-DD.");} }
        if (endDateVal) { try { const endDate = new Date(endDateVal + 'T23:59:59'); if(isNaN(endDate.getTime())) throw new Error("Invalid end date"); conditions.push(where("expenseDate", "<=", Timestamp.fromDate(endDate))); console.log("[LoadExpenses] Applying end date filter:", endDateVal); } catch (e) { console.error("Invalid end date format:", e); displayExpenseError("Invalid 'To Date'. Please use YYYY-MM-DD.");} }

        const q = query(expensesRef, ...conditions, orderBy("expenseDate", "desc"));
        const querySnapshot = await getDocs(q);
        expensesLoadingMessage.style.display = 'none';
        let results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // --- Apply Client-Side Search Filter ---
        const searchTerm = filterSearchInput?.value.trim().toLowerCase();
        if (searchTerm) {
             console.log("[LoadExpenses] Applying client-side search filter:", searchTerm);
             results = results.filter(exp => {
                const descMatch = exp.description?.toLowerCase().includes(searchTerm);
                const catMatch = exp.category?.toLowerCase().includes(searchTerm);
                // Include payment method in client-side search if needed
                // const paymentMatch = exp.paymentMethod?.toLowerCase().includes(searchTerm);
                // return descMatch || catMatch || paymentMatch;
                return descMatch || catMatch;
             });
        }
        expensesCache = results; // Update cache with potentially filtered results

        // --- Render Table ---
        if (expensesCache.length === 0) {
            noExpensesMessage.style.display = 'table-row';
             // Ensure loading message is hidden if no results
            expensesLoadingMessage.style.display = 'none';
        } else {
            noExpensesMessage.style.display = 'none'; // Hide no results message
            expensesCache.forEach(exp => {
                const tr = document.createElement('tr');
                tr.setAttribute('data-id', exp.id);
                const amount = Number(exp.amount || 0);
                totalAmount += amount;

                // Payment Method को सुरक्षित रूप से प्राप्त करें, यदि मौजूद नहीं है तो '-' दिखाएं
                const paymentMethodDisplay = escapeHtml(exp.paymentMethod || '-');

                // tr.innerHTML अपडेट किया गया - नया <td> जोड़ा गया
                tr.innerHTML = `
                    <td>${formatDate(exp.expenseDate)}</td>
                    <td>${escapeHtml(exp.category || '-')}</td>
                    <td style="text-align: right;">${formatCurrency(amount)}</td>
                    <td>${escapeHtml(exp.description || '-')}</td>
                    <td>${paymentMethodDisplay}</td>  <td class="action-buttons">
                        <button class="button edit-button small-button" data-action="edit" data-id="${exp.id}" title="Edit Expense"><i class="fas fa-edit"></i></button>
                        <button class="button delete-button small-button" data-action="delete" data-id="${exp.id}" title="Delete Expense"><i class="fas fa-trash-alt"></i></button>
                    </td>
                `;
                // Insert new row before the loading/no-message rows if they exist
                if (noExpensesMessage) {
                     expensesTableBody.insertBefore(tr, noExpensesMessage);
                } else if (expensesLoadingMessage) {
                     expensesTableBody.insertBefore(tr, expensesLoadingMessage);
                } else {
                     expensesTableBody.appendChild(tr); // Fallback if structure is unexpected
                }
            });
        }
        expensesTotalDisplay.textContent = `Total Expenses (Displayed): ${formatCurrency(totalAmount)}`;
        console.log("[LoadExpenses] Finished loading and rendering expenses.");

    } catch (error) {
        console.error("[LoadExpenses] Error loading expenses: ", error);
        if (error.code === 'failed-precondition') {
            displayExpenseError(`Error: Database index missing. Please check Firestore console for required indexes.`);
        } else if (error.message.includes("Invalid 'where' filter")) {
             displayExpenseError(`Error: Invalid filter combination. ${error.message}`);
        }
        else {
            displayExpenseError(`Error loading expenses: ${error.message}`);
        }
        expensesLoadingMessage.style.display = 'none';
        // Ensure no-results message isn't shown on error
        noExpensesMessage.style.display = 'none';
        // Display error message within the table body itself
        if (expensesTableBody.querySelector('tr:not(#expensesLoadingMessage):not(#noExpensesMessage)') === null) {
             const errorRow = document.createElement('tr');
             errorRow.innerHTML = `<td colspan="6" style="text-align: center; color: var(--danger-color); padding: 15px;">Could not load expenses. Check console or error message above.</td>`;
             expensesTableBody.appendChild(errorRow); // Append error row
        }
        expensesTotalDisplay.textContent = `Total Expenses: Error`;
    }
}

/** Opens the Add/Edit Expense Modal */
function openExpenseModal(mode = 'add', expenseData = null) {
    cacheDOMElements();
    if (!expenseModal || !expenseForm || !expenseDateInput || !expenseCategoryInput || !expenseAmountInput || !expenseDescriptionInput || !expensePaymentMethodInput || !expenseNotesInput) {
        console.error("Expense modal or form elements missing!");
        alert("Error opening form. Required elements missing.");
        return;
    };
    expenseForm.reset(); // Clear form fields
    clearExpenseError('expenseFormError'); // Clear previous form errors
    editingExpenseIdInput.value = ''; // Clear hidden ID field
    currentEditingExpenseId = null; // Reset global editing ID

    if (mode === 'edit' && expenseData && expenseData.id) {
        expenseModalTitle.textContent = 'Edit Expense';
        currentEditingExpenseId = expenseData.id;
        editingExpenseIdInput.value = expenseData.id; // Set hidden ID field

        // Populate form fields from expenseData
        if (expenseData.expenseDate && expenseData.expenseDate.toDate) {
            try {
                const date = expenseData.expenseDate.toDate();
                // Format date as YYYY-MM-DD for the input type="date"
                expenseDateInput.value = date.toISOString().split('T')[0];
            } catch(e) {
                console.error("Error setting date for edit:", e);
                expenseDateInput.value = ''; // Clear if error
            }
        } else {
            expenseDateInput.value = ''; // Clear if no valid date
        }
        expenseCategoryInput.value = expenseData.category || '';
        expenseAmountInput.value = expenseData.amount || '';
        expenseDescriptionInput.value = expenseData.description || '';
        expensePaymentMethodInput.value = expenseData.paymentMethod || ''; // Populate payment method
        expenseNotesInput.value = expenseData.notes || ''; // Populate notes

    } else {
        // Add mode
        expenseModalTitle.textContent = 'Add New Expense';
        // Set default date to today
        try {
            // Create a new Date object for today
            const today = new Date();
            // Adjust for timezone offset to get local date in YYYY-MM-DD format
            today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
            expenseDateInput.value = today.toISOString().split('T')[0];
        } catch(e){
            console.warn("Cannot set default date:", e);
            expenseDateInput.value = ''; // Clear on error
        }
    }
    expenseModal.classList.add('active'); // Show the modal
}

/** Closes the Add/Edit Expense Modal */
function closeExpenseModal() {
    if (expenseModal) {
        expenseModal.classList.remove('active');
    }
}

/** Handles the submission of the expense form */
async function handleExpenseFormSubmit(event) {
    event.preventDefault(); // Prevent default form submission
    cacheDOMElements(); // Ensure elements are cached

    // Basic checks
    if (!auth.currentUser) { displayExpenseError("You must be logged in.", "expenseFormError"); return; }
    if (!expenseDateInput || !expenseCategoryInput || !expenseAmountInput || !expenseDescriptionInput || !saveExpenseBtn) { displayExpenseError("Form elements missing.", "expenseFormError"); return; }

    // Get form values
    const expenseDateStr = expenseDateInput.value;
    const category = expenseCategoryInput.value.trim();
    const amountStr = expenseAmountInput.value.trim();
    const description = expenseDescriptionInput.value.trim();
    const paymentMethod = expensePaymentMethodInput?.value || ''; // Get payment method
    const notes = expenseNotesInput?.value.trim() || ''; // Get notes
    const editingId = editingExpenseIdInput.value; // Get ID if editing

    // Validation
    if (!expenseDateStr || !category || !amountStr || !description) { displayExpenseError("Please fill in all required fields (*).", "expenseFormError"); return; }
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) { displayExpenseError("Please enter a valid positive amount.", "expenseFormError"); expenseAmountInput.focus(); return; }
    let expenseDateTimestamp;
    try {
        // Ensure date string is treated as local date, not UTC
        const localDate = new Date(expenseDateStr + 'T00:00:00'); // Use T00:00:00 for consistency
        if (isNaN(localDate.getTime())) throw new Error("Invalid date value");
        expenseDateTimestamp = Timestamp.fromDate(localDate);
    } catch (e) { displayExpenseError("Invalid date format or value. Use YYYY-MM-DD.", "expenseFormError"); expenseDateInput.focus(); return; }

    // Clear errors and disable button
    clearExpenseError('expenseFormError');
    saveExpenseBtn.disabled = true;
    saveExpenseBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    // Prepare data for Firestore
    const expenseData = {
        userId: auth.currentUser.uid,
        expenseDate: expenseDateTimestamp,
        category: category,
        amount: amount,
        description: description,
        paymentMethod: paymentMethod, // Include payment method
        notes: notes,                 // Include notes
        updatedAt: serverTimestamp() // Always set update timestamp
    };

    try {
        if (editingId) {
            // Update existing expense
            const expenseRef = doc(db, "expenses", editingId);
            await updateDoc(expenseRef, expenseData);
            console.log("Expense updated:", editingId);
        } else {
            // Add new expense
            expenseData.createdAt = serverTimestamp(); // Set create timestamp only for new docs
            const docRef = await addDoc(collection(db, "expenses"), expenseData);
            console.log("Expense added:", docRef.id);
        }
        closeExpenseModal(); // Close modal on success
        await loadExpenses(); // Reload the expense list
    } catch (error) {
        console.error("Error saving expense: ", error);
        displayExpenseError(`Error saving expense: ${error.message}`, "expenseFormError");
    } finally {
        // Re-enable button regardless of success/failure
        saveExpenseBtn.disabled = false;
        saveExpenseBtn.innerHTML = '<i class="fas fa-save"></i> Save Expense';
    }
}

/** Handles delete expense confirmation and action */
async function handleDeleteExpenseClick(expenseId) {
    cacheDOMElements(); // Ensure elements are ready
    if (!expenseId) return;

    // Find the expense in the cache for confirmation details
    const expense = expensesCache.find(exp => exp.id === expenseId);
    const confirmMessage = `Are you sure you want to delete this expense?\n-----------------------------\nDate: ${expense ? formatDate(expense.expenseDate) : 'N/A'}\nAmount: ${expense ? formatCurrency(expense.amount) : 'N/A'}\nCategory: ${expense ? escapeHtml(expense.category) : 'N/A'}\nDescription: ${expense ? escapeHtml(expense.description) : 'N/A'}\nPayment Method: ${expense ? escapeHtml(expense.paymentMethod) : 'N/A'}\n-----------------------------\nThis action cannot be undone.`;

    if (window.confirm(confirmMessage)) {
        console.log("Attempting to delete expense:", expenseId);
        try {
            displayExpenseError("Deleting...", "expenseListError"); // Show temporary status
            const expenseRef = doc(db, "expenses", expenseId);
            await deleteDoc(expenseRef);
            console.log("Expense deleted successfully from Firestore:", expenseId);
            clearExpenseError(); // Clear the "Deleting..." message
            // Remove from cache immediately for faster UI update (optional)
            // expensesCache = expensesCache.filter(exp => exp.id !== expenseId);
            await loadExpenses(); // Reload the list from Firestore to be sure
        } catch (error) {
            console.error("Error deleting expense:", error);
            displayExpenseError(`Error deleting expense: ${error.message}`);
        }
    } else {
        console.log("Expense deletion cancelled by user.");
    }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Prevent adding listeners multiple times
    if (listenersAttached) {
        console.log("[SetupListeners] Listeners already attached. Skipping.");
        return;
    }
    console.log("[SetupListeners] Setting up event listeners...");

    // Cache elements ensuring they are available
    cacheDOMElements();

    // Add New Expense Button
    if (addExpenseBtn) {
        addExpenseBtn.addEventListener('click', () => {
            console.log("[Listener] Add New Expense button clicked");
            openExpenseModal('add');
        });
        console.log("[SetupListeners] Listener ADDED for Add Expense button.");
    } else { console.error("[SetupListeners] Add Expense button (addExpenseBtn) NOT FOUND."); }

    // Modal Buttons & Form
    if(closeExpenseModalBtn) closeExpenseModalBtn.addEventListener('click', closeExpenseModal);
    if(cancelExpenseBtn) cancelExpenseBtn.addEventListener('click', closeExpenseModal);
    // Close modal if clicking outside the content
    if(expenseModal) expenseModal.addEventListener('click', (event) => { if (event.target === expenseModal) closeExpenseModal(); });
    if(expenseForm) expenseForm.addEventListener('submit', handleExpenseFormSubmit);

    // Table Action Buttons (Event Delegation on Table Body)
    if(expensesTableBody){
        expensesTableBody.addEventListener('click', (event) => {
            const targetButton = event.target.closest('button[data-action]');
            if (!targetButton) return; // Exit if click wasn't on an action button

            const action = targetButton.dataset.action;
            const expenseId = targetButton.dataset.id;
            console.log(`[Listener] Table Action button clicked: ${action}, ID: ${expenseId}`);

            if (action === 'edit') {
                // Find the expense data in the current cache
                const expenseData = expensesCache.find(exp => exp.id === expenseId);
                if (expenseData) {
                    openExpenseModal('edit', expenseData);
                } else {
                    console.error("Expense data not found in cache for edit:", expenseId);
                    displayExpenseError("Could not load expense details for editing.");
                     // Optional: Try fetching the single doc directly as a fallback
                     // getDoc(doc(db, "expenses", expenseId)).then(docSnap => { ... });
                }
            } else if (action === 'delete') {
                handleDeleteExpenseClick(expenseId);
            }
        });
        console.log("[SetupListeners] Listener ADDED for table actions.");
    } else { console.error("[SetupListeners] expensesTableBody NOT FOUND."); }

    // --- Filter Buttons Event Listeners ---
    if (applyExpenseFiltersBtn) {
        applyExpenseFiltersBtn.addEventListener('click', () => {
            console.log("[Listener] Apply Filters button clicked - Calling loadExpenses()");
            loadExpenses(); // Reload expenses with current filter values
        });
         console.log("[SetupListeners] Listener ADDED for Apply Filters button.");
    } else { console.error("[SetupListeners] Apply Filters button (applyExpenseFiltersBtn) NOT FOUND."); }

    if (clearExpenseFiltersBtn) {
        clearExpenseFiltersBtn.addEventListener('click', () => {
            console.log("[Listener] Clear Filters button clicked - Clearing inputs and calling loadExpenses()");
            // Clear filter input fields
            if(filterSearchInput) filterSearchInput.value = '';
            if(filterCategoryInput) filterCategoryInput.value = '';
            if(filterStartDateInput) filterStartDateInput.value = '';
            if(filterEndDateInput) filterEndDateInput.value = '';
            // Reload expenses with cleared filters
            loadExpenses();
        });
         console.log("[SetupListeners] Listener ADDED for Clear Filters button.");
    } else { console.error("[SetupListeners] Clear Filters button (clearExpenseFiltersBtn) NOT FOUND."); }

     // Optional: Trigger filter on Enter key in filter inputs
     filterSearchInput?.addEventListener('keypress', (e) => { if(e.key === 'Enter') { e.preventDefault(); console.log("[Listener] Enter pressed in Search input"); loadExpenses();} });
     filterCategoryInput?.addEventListener('keypress', (e) => { if(e.key === 'Enter') { e.preventDefault(); console.log("[Listener] Enter pressed in Category input"); loadExpenses();} });
     filterStartDateInput?.addEventListener('keypress', (e) => { if(e.key === 'Enter') { e.preventDefault(); console.log("[Listener] Enter pressed in Start Date input"); loadExpenses();} });
     filterEndDateInput?.addEventListener('keypress', (e) => { if(e.key === 'Enter') { e.preventDefault(); console.log("[Listener] Enter pressed in End Date input"); loadExpenses();} });


    listenersAttached = true; // Set flag to indicate listeners are set up
    console.log("[SetupListeners] Expense page event listeners setup complete.");
}

// --- Initialization Function (Exported) ---
// This function is called from expenses.html after auth state is confirmed
export function initializeExpensesPage(user) {
    console.log("Initializing Expenses Page for user:", user?.uid);
    if (!db || !auth) {
        console.error("Firestore DB or Auth is not initialized properly in firebase-init.js!");
        displayExpenseError("Database connection error. Check console.");
        return;
    }

    // Defer setup until DOM is fully loaded
     if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
             console.log("DOMContentLoaded event fired. Setting up page.");
             // Check if already initialized (e.g., if script runs twice)
             if (!listenersAttached) {
                 setupEventListeners();
                 loadExpenses(); // Initial data load after setting up listeners
             }
         });
    } else {
        // DOM is already ready (e.g., script loaded async/defer or after DOM load)
        console.log("DOM Ready, setting up page.");
         if (!listenersAttached) {
             setupEventListeners();
             loadExpenses(); // Initial data load after setting up listeners
         }
    }
}