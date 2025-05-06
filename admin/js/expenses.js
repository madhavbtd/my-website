// js/expenses.js - Expenses Management Logic with Filters (v6 - Final Listener Check)

// --- Firebase Imports ---
import { db, auth } from './js/firebase-init.js'; // Ensure path is correct
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
function formatDate(timestamp) { /* ... (same as before) ... */ if (!timestamp || typeof timestamp.toDate !== 'function') return '-'; try { return timestamp.toDate().toLocaleDateString('en-GB'); } catch (e) { console.error("Error formatting date:", timestamp, e); return 'Invalid Date'; } }
function formatCurrency(amount) { /* ... (same as before) ... */ const num = Number(amount); if (isNaN(num)) return 'N/A'; return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function escapeHtml(unsafe) { /* ... (same as before) ... */ if (typeof unsafe !== 'string') { try { unsafe = String(unsafe ?? ''); } catch (e) { unsafe = ''; } } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function displayExpenseError(message, elementId = 'expenseListError') { /* ... (same as before) ... */ const errorElement = document.getElementById(elementId); if (errorElement) { errorElement.textContent = message; errorElement.style.display = message ? 'block' : 'none'; console.log(`Error displayed in ${elementId}: ${message}`); } else { console.error(`Error element ID '${elementId}' not found. Msg:`, message); if(elementId !== 'expenseFormError') alert(message); } }
function clearExpenseError(elementId = 'expenseListError') { /* ... (same as before) ... */ const errorElement = document.getElementById(elementId); if (errorElement) { errorElement.textContent = ''; errorElement.style.display = 'none'; } if (elementId === 'expenseListError' && expenseFormError) { expenseFormError.textContent = ''; expenseFormError.style.display = 'none'; } }

// --- Core Functions ---

/** Loads expenses from Firestore based on current filters and displays them. */
async function loadExpenses() {
    // Ensure elements are cached before proceeding
    cacheDOMElements(); // Call here to ensure elements are ready

    if (!expensesTableBody || !expensesLoadingMessage || !noExpensesMessage || !expensesTotalDisplay) { console.error("Expense table elements not found. Cannot load expenses."); return; }
    if (!auth.currentUser) { displayExpenseError("Please login to view expenses."); return; }
    console.log("[LoadExpenses] Starting to load expenses...");

    expensesLoadingMessage.style.display = 'table-row';
    noExpensesMessage.style.display = 'none';
    expensesTableBody.innerHTML = '';
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
                return descMatch || catMatch;
             });
        }
        expensesCache = results;

        // --- Render Table ---
        if (expensesCache.length === 0) { noExpensesMessage.style.display = 'table-row'; }
        else {
            expensesCache.forEach(exp => {
                const tr = document.createElement('tr'); tr.setAttribute('data-id', exp.id);
                const amount = Number(exp.amount || 0); totalAmount += amount;
                tr.innerHTML = `<td>${formatDate(exp.expenseDate)}</td><td>${escapeHtml(exp.category || '-')}</td><td style="text-align: right;">${formatCurrency(amount)}</td><td>${escapeHtml(exp.description || '-')}</td><td class="action-buttons"><button class="button edit-button small-button" data-action="edit" data-id="${exp.id}" title="Edit Expense"><i class="fas fa-edit"></i></button><button class="button delete-button small-button" data-action="delete" data-id="${exp.id}" title="Delete Expense"><i class="fas fa-trash-alt"></i></button></td>`;
                expensesTableBody.appendChild(tr);
            });
        }
        expensesTotalDisplay.textContent = `Total Expenses (Displayed): ${formatCurrency(totalAmount)}`;
        console.log("[LoadExpenses] Finished loading and rendering expenses.");

    } catch (error) {
        console.error("[LoadExpenses] Error loading expenses: ", error);
        if (error.code === 'failed-precondition') { displayExpenseError(`Error: Database index missing. Check Firestore console.`); }
        else { displayExpenseError(`Error loading expenses: ${error.message}`); }
        expensesLoadingMessage.style.display = 'none';
        expensesTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Could not load expenses.</td></tr>`;
        expensesTotalDisplay.textContent = `Total Expenses: Error`;
    }
}

/** Opens the Add/Edit Expense Modal */
function openExpenseModal(mode = 'add', expenseData = null) { /* ... (same as before) ... */ cacheDOMElements(); if (!expenseModal || !expenseForm || !expenseDateInput || !expenseCategoryInput || !expenseAmountInput || !expenseDescriptionInput) { console.error("Expense modal or form elements missing!"); return; }; expenseForm.reset(); clearExpenseError('expenseFormError'); editingExpenseIdInput.value = ''; currentEditingExpenseId = null; if (mode === 'edit' && expenseData && expenseData.id) { expenseModalTitle.textContent = 'Edit Expense'; currentEditingExpenseId = expenseData.id; editingExpenseIdInput.value = expenseData.id; if (expenseData.expenseDate && expenseData.expenseDate.toDate) { const date = expenseData.expenseDate.toDate(); expenseDateInput.value = date.toISOString().split('T')[0]; } expenseCategoryInput.value = expenseData.category || ''; expenseAmountInput.value = expenseData.amount || ''; expenseDescriptionInput.value = expenseData.description || ''; if(expensePaymentMethodInput) expensePaymentMethodInput.value = expenseData.paymentMethod || ''; if(expenseNotesInput) expenseNotesInput.value = expenseData.notes || ''; } else { expenseModalTitle.textContent = 'Add New Expense'; try { expenseDateInput.valueAsDate = new Date(); } catch(e){ console.warn("Cannot set default date"); } } expenseModal.classList.add('active'); }

/** Closes the Add/Edit Expense Modal */
function closeExpenseModal() { /* ... (same as before) ... */ if (expenseModal) { expenseModal.classList.remove('active'); } }

/** Handles the submission of the expense form */
async function handleExpenseFormSubmit(event) { /* ... (same as before) ... */ event.preventDefault(); cacheDOMElements(); if (!auth.currentUser) { displayExpenseError("You must be logged in.", "expenseFormError"); return; } if (!expenseDateInput || !expenseCategoryInput || !expenseAmountInput || !expenseDescriptionInput || !saveExpenseBtn) { displayExpenseError("Form elements missing.", "expenseFormError"); return; } const expenseDateStr = expenseDateInput.value; const category = expenseCategoryInput.value.trim(); const amountStr = expenseAmountInput.value.trim(); const description = expenseDescriptionInput.value.trim(); const paymentMethod = expensePaymentMethodInput?.value || ''; const notes = expenseNotesInput?.value.trim() || ''; const editingId = editingExpenseIdInput.value; if (!expenseDateStr || !category || !amountStr || !description) { displayExpenseError("Please fill in all required fields (*).", "expenseFormError"); return; } const amount = parseFloat(amountStr); if (isNaN(amount) || amount <= 0) { displayExpenseError("Please enter a valid positive amount.", "expenseFormError"); expenseAmountInput.focus(); return; } let expenseDateTimestamp; try { const localDate = new Date(expenseDateStr + 'T00:00:00'); if (isNaN(localDate.getTime())) throw new Error("Invalid date value"); expenseDateTimestamp = Timestamp.fromDate(localDate); } catch (e) { displayExpenseError("Invalid date format or value.", "expenseFormError"); expenseDateInput.focus(); return; } clearExpenseError('expenseFormError'); saveExpenseBtn.disabled = true; saveExpenseBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; const expenseData = { userId: auth.currentUser.uid, expenseDate: expenseDateTimestamp, category: category, amount: amount, description: description, paymentMethod: paymentMethod, notes: notes, updatedAt: serverTimestamp() }; try { if (editingId) { const expenseRef = doc(db, "expenses", editingId); await updateDoc(expenseRef, expenseData); console.log("Expense updated:", editingId); } else { expenseData.createdAt = serverTimestamp(); const docRef = await addDoc(collection(db, "expenses"), expenseData); console.log("Expense added:", docRef.id); } closeExpenseModal(); await loadExpenses(); } catch (error) { console.error("Error saving expense: ", error); displayExpenseError(`Error saving expense: ${error.message}`, "expenseFormError"); } finally { saveExpenseBtn.disabled = false; saveExpenseBtn.innerHTML = '<i class="fas fa-save"></i> Save Expense'; } }

/** Handles delete expense confirmation and action */
async function handleDeleteExpenseClick(expenseId) { /* ... (same as before) ... */ cacheDOMElements(); if (!expenseId) return; const expense = expensesCache.find(exp => exp.id === expenseId); const confirmMessage = `Are you sure you want to delete this expense?\n-----------------------------\nDate: ${expense ? formatDate(expense.expenseDate) : 'N/A'}\nAmount: ${expense ? formatCurrency(expense.amount) : 'N/A'}\nCategory: ${expense ? escapeHtml(expense.category) : 'N/A'}\nDescription: ${expense ? escapeHtml(expense.description) : 'N/A'}\n-----------------------------\nThis action cannot be undone.`; if (window.confirm(confirmMessage)) { console.log("Attempting to delete expense:", expenseId); try { displayExpenseError("Deleting...", "expenseListError"); const expenseRef = doc(db, "expenses", expenseId); await deleteDoc(expenseRef); console.log("Expense deleted successfully from Firestore:", expenseId); clearExpenseError(); await loadExpenses(); } catch (error) { console.error("Error deleting expense:", error); displayExpenseError(`Error deleting expense: ${error.message}`); } } else { console.log("Expense deletion cancelled by user."); } }

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
    if(expenseModal) expenseModal.addEventListener('click', (event) => { if (event.target === expenseModal) closeExpenseModal(); });
    if(expenseForm) expenseForm.addEventListener('submit', handleExpenseFormSubmit);

    // Table Action Buttons (Event Delegation)
    if(expensesTableBody){
        expensesTableBody.addEventListener('click', (event) => {
            const targetButton = event.target.closest('button[data-action]');
            if (!targetButton) return;
            const action = targetButton.dataset.action;
            const expenseId = targetButton.dataset.id;
            console.log(`[Listener] Table Action button clicked: ${action}, ID: ${expenseId}`);
            if (action === 'edit') {
                const expenseData = expensesCache.find(exp => exp.id === expenseId);
                if (expenseData) { openExpenseModal('edit', expenseData); }
                else { console.error("Expense data not found in cache for edit:", expenseId); displayExpenseError("Could not load expense details for editing.");}
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
            loadExpenses();
        });
         console.log("[SetupListeners] Listener ADDED for Apply Filters button.");
    } else { console.error("[SetupListeners] Apply Filters button (applyExpenseFiltersBtn) NOT FOUND."); }

    if (clearExpenseFiltersBtn) {
        clearExpenseFiltersBtn.addEventListener('click', () => {
            console.log("[Listener] Clear Filters button clicked - Clearing inputs and calling loadExpenses()");
            if(filterSearchInput) filterSearchInput.value = '';
            if(filterCategoryInput) filterCategoryInput.value = '';
            if(filterStartDateInput) filterStartDateInput.value = '';
            if(filterEndDateInput) filterEndDateInput.value = '';
            loadExpenses();
        });
         console.log("[SetupListeners] Listener ADDED for Clear Filters button.");
    } else { console.error("[SetupListeners] Clear Filters button (clearExpenseFiltersBtn) NOT FOUND."); }

     // Optional: Trigger filter on Enter key
     filterSearchInput?.addEventListener('keypress', (e) => { if(e.key === 'Enter') { e.preventDefault(); console.log("[Listener] Enter pressed in Search input"); loadExpenses();} });
     filterCategoryInput?.addEventListener('keypress', (e) => { if(e.key === 'Enter') { e.preventDefault(); console.log("[Listener] Enter pressed in Category input"); loadExpenses();} });

    listenersAttached = true; // Set flag
    console.log("[SetupListeners] Expense page event listeners setup complete.");
}

// --- Initialization Function (Exported) ---
export function initializeExpensesPage(user) {
    console.log("Initializing Expenses Page for user:", user?.uid);
    if (!db) { console.error("Firestore DB is not initialized!"); displayExpenseError("Database connection error."); return; }

    // Use DOMContentLoaded to ensure elements are ready before setup
     if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
             console.log("DOMContentLoaded event fired. Setting up page.");
             // Check if already initialized to prevent double setup
             if (!listenersAttached) {
                 setupEventListeners();
                 loadExpenses(); // Initial data load
             }
         });
    } else {
        // DOM is already ready
        console.log("DOM Ready, setting up page.");
         if (!listenersAttached) {
             setupEventListeners();
             loadExpenses(); // Initial data load
         }
    }
}
