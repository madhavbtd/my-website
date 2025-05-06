// js/expenses.js - Expenses Management Logic

// --- Firebase Imports ---
import { db, auth } from './firebase-init.js'; // Ensure path is correct
import {
    collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc,
    query, orderBy, where, Timestamp, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Global Variables ---
let expensesCache = [];
let currentEditingExpenseId = null;

// --- DOM Elements Cache ---
let addExpenseBtn, expenseModal, expenseModalTitle, closeExpenseModalBtn, cancelExpenseBtn,
    saveExpenseBtn, expenseForm, editingExpenseIdInput, expenseDateInput,
    expenseCategoryInput, expenseAmountInput, expenseDescriptionInput,
    expensePaymentMethodInput, expenseNotesInput, expenseFormError,
    expensesTableBody, expensesLoadingMessage, noExpensesMessage,
    expenseListError, expensesTotalDisplay;

function cacheDOMElements() {
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
}


// --- Utility Functions ---
function formatDate(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== 'function') return '-';
    try { return timestamp.toDate().toLocaleDateString('en-GB'); }
    catch (e) { console.error("Error formatting date:", e); return '-'; }
}

function formatCurrency(amount) {
    const num = Number(amount);
    if (isNaN(num)) return 'N/A';
    return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function escapeHtml(unsafe) {
     if (typeof unsafe !== 'string') { try { unsafe = String(unsafe ?? ''); } catch (e) { unsafe = ''; } }
     return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function displayExpenseError(message, elementId = 'expenseListError') {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = message ? 'block' : 'none';
    } else { console.error(`Error element ID '${elementId}' not found. Msg:`, message); if(elementId !== 'expenseFormError') alert(message); }
}

function clearExpenseError(elementId = 'expenseListError') {
    const errorElement = document.getElementById(elementId);
    if (errorElement) { errorElement.textContent = ''; errorElement.style.display = 'none'; }
    if (elementId === 'expenseListError' && expenseFormError) { expenseFormError.textContent = ''; expenseFormError.style.display = 'none'; }
}

// --- Core Functions ---

/** Loads expenses from Firestore and displays them */
async function loadExpenses() {
    if (!expensesTableBody || !expensesLoadingMessage || !noExpensesMessage || !expensesTotalDisplay) {
        console.error("Expense table elements not found."); return;
    }
    if (!auth.currentUser) { displayExpenseError("Please login to view expenses."); return; }

    expensesLoadingMessage.style.display = 'table-row';
    noExpensesMessage.style.display = 'none';
    expensesTableBody.innerHTML = ''; // Clear previous entries
    clearExpenseError();
    let totalAmount = 0;
    expensesTotalDisplay.textContent = 'Calculating total...';


    try {
        const expensesRef = collection(db, "expenses");
        const q = query(expensesRef,
                      where("userId", "==", auth.currentUser.uid),
                      orderBy("expenseDate", "desc")); // Most recent first

        const querySnapshot = await getDocs(q);
        expensesLoadingMessage.style.display = 'none';

        if (querySnapshot.empty) {
            noExpensesMessage.style.display = 'table-row';
            expensesCache = [];
        } else {
            expensesCache = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            expensesCache.forEach(exp => {
                const tr = document.createElement('tr');
                tr.setAttribute('data-id', exp.id);
                const amount = Number(exp.amount || 0);
                totalAmount += amount;

                tr.innerHTML = `
                    <td>${formatDate(exp.expenseDate)}</td>
                    <td>${escapeHtml(exp.category || '-')}</td>
                    <td style="text-align: right;">${formatCurrency(amount)}</td>
                    <td>${escapeHtml(exp.description || '-')}</td>
                    <td class="action-buttons">
                        <button class="button edit-button small-button" data-action="edit" data-id="${exp.id}" title="Edit Expense"><i class="fas fa-edit"></i></button>
                        <button class="button delete-button small-button" data-action="delete" data-id="${exp.id}" title="Delete Expense"><i class="fas fa-trash-alt"></i></button>
                    </td>
                `;
                expensesTableBody.appendChild(tr);
            });
        }
        expensesTotalDisplay.textContent = `Total Expenses (Displayed): ${formatCurrency(totalAmount)}`;

    } catch (error) {
        console.error("Error loading expenses: ", error);
        displayExpenseError(`Error loading expenses: ${error.message}`);
        expensesLoadingMessage.style.display = 'none';
        expensesTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Could not load expenses.</td></tr>`;
        expensesTotalDisplay.textContent = `Total Expenses: Error`;
    }
}

/** Opens the Add/Edit Expense Modal */
function openExpenseModal(mode = 'add', expenseData = null) {
    if (!expenseModal || !expenseForm || !expenseDateInput || !expenseCategoryInput || !expenseAmountInput || !expenseDescriptionInput) {
         console.error("Expense modal or form elements missing!"); return;
    };

    expenseForm.reset();
    clearExpenseError('expenseFormError');
    editingExpenseIdInput.value = '';
    currentEditingExpenseId = null;

    if (mode === 'edit' && expenseData && expenseData.id) {
        expenseModalTitle.textContent = 'Edit Expense';
        currentEditingExpenseId = expenseData.id;
        editingExpenseIdInput.value = expenseData.id;

        if (expenseData.expenseDate && expenseData.expenseDate.toDate) {
             const date = expenseData.expenseDate.toDate();
             expenseDateInput.value = date.toISOString().split('T')[0]; // Format YYYY-MM-DD
        }
        expenseCategoryInput.value = expenseData.category || '';
        expenseAmountInput.value = expenseData.amount || '';
        expenseDescriptionInput.value = expenseData.description || '';
        if(expensePaymentMethodInput) expensePaymentMethodInput.value = expenseData.paymentMethod || '';
        if(expenseNotesInput) expenseNotesInput.value = expenseData.notes || '';

    } else {
        expenseModalTitle.textContent = 'Add New Expense';
        // Default date to today for new expenses
        try { expenseDateInput.valueAsDate = new Date(); } catch(e){ console.warn("Cannot set default date"); }
    }

    expenseModal.classList.add('active');
}

/** Closes the Add/Edit Expense Modal */
function closeExpenseModal() {
    if (expenseModal) { expenseModal.classList.remove('active'); }
}

/** Handles the submission of the expense form */
async function handleExpenseFormSubmit(event) {
    event.preventDefault();
    if (!auth.currentUser) { displayExpenseError("You must be logged in.", "expenseFormError"); return; }
    if (!expenseDateInput || !expenseCategoryInput || !expenseAmountInput || !expenseDescriptionInput || !saveExpenseBtn) {
        displayExpenseError("Form elements missing.", "expenseFormError"); return;
    }

    const expenseDateStr = expenseDateInput.value;
    const category = expenseCategoryInput.value.trim();
    const amountStr = expenseAmountInput.value.trim();
    const description = expenseDescriptionInput.value.trim();
    const paymentMethod = expensePaymentMethodInput?.value || '';
    const notes = expenseNotesInput?.value.trim() || '';
    const editingId = editingExpenseIdInput.value;

    // Validation
    if (!expenseDateStr || !category || !amountStr || !description) { displayExpenseError("Please fill in all required fields (*).", "expenseFormError"); return; }
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) { displayExpenseError("Please enter a valid positive amount.", "expenseFormError"); return; }
     let expenseDateTimestamp;
     try {
        const localDate = new Date(expenseDateStr + 'T00:00:00'); // Interpret as local time YYYY-MM-DD
        if (isNaN(localDate.getTime())) throw new Error("Invalid date value");
        expenseDateTimestamp = Timestamp.fromDate(localDate);
     } catch (e) { displayExpenseError("Invalid date format or value.", "expenseFormError"); return; }

    clearExpenseError('expenseFormError');
    saveExpenseBtn.disabled = true;
    saveExpenseBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const expenseData = {
        userId: auth.currentUser.uid,
        expenseDate: expenseDateTimestamp,
        category: category,
        amount: amount,
        description: description,
        paymentMethod: paymentMethod,
        notes: notes,
        updatedAt: serverTimestamp()
    };

    try {
        if (editingId) {
            const expenseRef = doc(db, "expenses", editingId);
            await updateDoc(expenseRef, expenseData);
            console.log("Expense updated:", editingId);
        } else {
            expenseData.createdAt = serverTimestamp();
            const docRef = await addDoc(collection(db, "expenses"), expenseData);
            console.log("Expense added:", docRef.id);
        }
        closeExpenseModal();
        await loadExpenses(); // Refresh list

    } catch (error) {
        console.error("Error saving expense: ", error);
        displayExpenseError(`Error saving expense: ${error.message}`, "expenseFormError");
    } finally {
        saveExpenseBtn.disabled = false;
        saveExpenseBtn.innerHTML = '<i class="fas fa-save"></i> Save Expense';
    }
}

/** Handles delete expense confirmation and action */
async function handleDeleteExpenseClick(expenseId) {
     if (!expenseId) return;

     const expense = expensesCache.find(exp => exp.id === expenseId);
     const confirmMessage = `Are you sure you want to delete this expense?
-----------------------------
Date: ${expense ? formatDate(expense.expenseDate) : 'N/A'}
Amount: ${expense ? formatCurrency(expense.amount) : 'N/A'}
Category: ${expense ? escapeHtml(expense.category) : 'N/A'}
Description: ${expense ? escapeHtml(expense.description) : 'N/A'}
-----------------------------
This action cannot be undone.`;

     if (confirm(confirmMessage)) {
         try {
             displayExpenseError("Deleting...", "expenseListError") // Show temp message
             const expenseRef = doc(db, "expenses", expenseId);
             await deleteDoc(expenseRef);
             console.log("Expense deleted:", expenseId);
             clearExpenseError(); // Clear deleting message
             await loadExpenses(); // Reload list to reflect deletion and update total

         } catch (error) {
             console.error("Error deleting expense:", error);
             displayExpenseError(`Error deleting expense: ${error.message}`);
         }
     }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    cacheDOMElements(); // Cache elements after DOM is ready

    addExpenseBtn?.addEventListener('click', () => openExpenseModal('add'));
    closeExpenseModalBtn?.addEventListener('click', closeExpenseModal);
    cancelExpenseBtn?.addEventListener('click', closeExpenseModal);
    expenseModal?.addEventListener('click', (event) => { if (event.target === expenseModal) closeExpenseModal(); });
    expenseForm?.addEventListener('submit', handleExpenseFormSubmit);

    // Use event delegation for table actions
    expensesTableBody?.addEventListener('click', (event) => {
        const targetButton = event.target.closest('button[data-action]');
        if (!targetButton) return;

        const action = targetButton.dataset.action;
        const expenseId = targetButton.dataset.id;

        if (action === 'edit') {
            const expenseData = expensesCache.find(exp => exp.id === expenseId);
            if (expenseData) { openExpenseModal('edit', expenseData); }
            else { console.error("Expense data not found in cache for edit:", expenseId); displayExpenseError("Could not load expense details for editing.");}
        } else if (action === 'delete') {
            handleDeleteExpenseClick(expenseId);
        }
    });

    console.log("Expense page event listeners set up.");
}

// --- Initialization Function (Exported) ---
// Called by the auth check script in expenses.html head
export function initializeExpensesPage(user) {
    console.log("Initializing Expenses Page for user:", user?.uid);
    if (!db) { console.error("Firestore DB is not initialized!"); displayExpenseError("Database connection error."); return; }
    // Ensure DOM is ready before setting up listeners and loading data
     if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
             setupEventListeners();
             loadExpenses();
         });
    } else {
        setupEventListeners();
        loadExpenses();
    }
}