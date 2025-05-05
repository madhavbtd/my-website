// js/supplier_account_detail.js

// --- Firebase Imports ---
import { db, auth } from './firebase-init.js';
import {
    doc, getDoc, collection, query, where, getDocs, orderBy,
    Timestamp, addDoc, serverTimestamp, updateDoc, deleteDoc, runTransaction, writeBatch, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// onAuthStateChanged is handled in the HTML's inline script now

// --- Global State ---
let currentSupplierId = null;
let currentSupplierData = null; // To store fetched supplier details
let purchaseOrdersData = [];
let supplierPaymentsData = [];
let supplierAdjustmentsData = [];
let listenersAttached = false;
let isRefreshingData = false; // Prevent concurrent refreshes
const loadingIndicator = document.getElementById('loadingIndicator');
const mainContent = document.getElementById('supplierAccountDetailContent');
const generalErrorDisplay = document.getElementById('generalErrorDisplay');

// --- DOM Elements (Modals & Forms) ---
const addPaymentModal = document.getElementById('addPaymentModal');
const addAdjustmentModal = document.getElementById('addAdjustmentModal');
const confirmDeleteSupplierModal = document.getElementById('confirmDeleteSupplierModal');
const paymentModalError = document.getElementById('paymentModalError');
const adjustmentModalError = document.getElementById('adjustmentModalError');
const deleteModalError = document.getElementById('deleteModalError');

const addPaymentForm = document.getElementById('addPaymentForm');
const addAdjustmentForm = document.getElementById('addAdjustmentForm');
const paymentDateInput = document.getElementById('paymentDate');
const paymentAmountInput = document.getElementById('paymentAmount');
const paymentReferenceInput = document.getElementById('paymentReference');
const paymentNotesInput = document.getElementById('paymentNotes');
const adjustmentDateInput = document.getElementById('adjustmentDate');
const adjustmentAmountInput = document.getElementById('adjustmentAmount');
const adjustmentReasonInput = document.getElementById('adjustmentReason');
const adjustmentNotesInput = document.getElementById('adjustmentNotes');
const deleteSupplierNameSpan = document.getElementById('deleteSupplierName');
const confirmDeleteCheckbox = document.getElementById('confirmDeleteSupplierCheckbox');
const confirmDeleteButton = document.getElementById('confirmSupplierDeleteBtn');

// --- Helper Functions ---

function showLoading(message = "Loading...") {
    if (loadingIndicator) {
        loadingIndicator.querySelector('p').textContent = message;
        loadingIndicator.style.display = 'flex';
    }
     if(mainContent) mainContent.style.visibility = 'hidden';
}

function hideLoading() {
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
     if(mainContent) mainContent.style.visibility = 'visible';
}

function displayError(message, elementId = 'generalErrorDisplay') {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        // Scroll to the error message if it's the general one
        if (elementId === 'generalErrorDisplay') {
            errorElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
    console.error("Displaying Error:", message, "Target Element ID:", elementId);
}

function clearError(elementId = 'generalErrorDisplay') {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
}

function formatDate(timestamp) {
    if (!timestamp || !timestamp.toDate) return 'N/A';
    try {
        const date = timestamp.toDate();
        // Format as DD-Mon-YYYY (e.g., 05-May-2025)
        const options = { day: '2-digit', month: 'short', year: 'numeric' };
        return date.toLocaleDateString('en-GB', options).replace(/ /g, '-');
    } catch (error) {
        console.error("Error formatting date:", timestamp, error);
        return 'Invalid Date';
    }
}

function formatCurrency(amount) {
    const num = Number(amount);
    if (isNaN(num)) {
        return '₹ N/A';
    }
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getCurrentDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}


// --- Modal Handling Functions ---

function openModal(modalElement) {
    clearAllModalErrors(); // Clear errors in all modals when opening a new one
    if (modalElement) {
        modalElement.style.display = 'flex'; // Use flex to potentially center content better if needed
        // Reset forms within the specific modal if applicable
        if(modalElement === addPaymentModal) {
            addPaymentForm.reset();
            paymentDateInput.value = getCurrentDateString(); // Default to today
        } else if (modalElement === addAdjustmentModal) {
            addAdjustmentForm.reset();
             adjustmentDateInput.value = getCurrentDateString(); // Default to today
        } else if (modalElement === confirmDeleteSupplierModal) {
             confirmDeleteCheckbox.checked = false;
             confirmDeleteButton.disabled = true;
        }
    }
}

function closeModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'none';
    }
}

function clearAllModalErrors() {
    clearError('paymentModalError');
    clearError('adjustmentModalError');
    clearError('deleteModalError');
}

// --- Data Fetching Functions ---

async function loadSupplierDetails() {
    if (!currentSupplierId) {
        throw new Error("Supplier ID is not set.");
    }
    console.log("Loading details for supplier:", currentSupplierId);
    const supplierRef = doc(db, "suppliers", currentSupplierId);
    const supplierSnap = await getDoc(supplierRef);

    if (supplierSnap.exists()) {
        currentSupplierData = { id: supplierSnap.id, ...supplierSnap.data() };
        console.log("Supplier data found:", currentSupplierData);
        renderSupplierDetails();
        // Set link for edit button
        const editLink = document.getElementById('editSupplierLink');
         if (editLink) {
             editLink.href = `add_supplier.html?id=${currentSupplierId}`;
             editLink.style.display = 'inline-flex'; // Show the button
         }
    } else {
        console.error("Supplier document not found!");
        currentSupplierData = null;
        throw new Error(`Supplier with ID ${currentSupplierId} not found.`);
    }
}

async function loadPurchaseOrders() {
    if (!currentSupplierId) return;
    console.log("Loading POs for supplier:", currentSupplierId);
    const posQuery = query(
        collection(db, "purchaseOrders"),
        where("supplierId", "==", currentSupplierId),
        orderBy("poDate", "desc") // Show newest first
    );
    const querySnapshot = await getDocs(posQuery);
    purchaseOrdersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log("POs loaded:", purchaseOrdersData.length);
    renderPurchaseOrders();
}

async function loadSupplierPayments() {
    if (!currentSupplierId) return;
    console.log("Loading payments for supplier:", currentSupplierId);
    const paymentsQuery = query(
        collection(db, "supplierPayments"),
        where("supplierId", "==", currentSupplierId),
        orderBy("paymentDate", "desc") // Show newest first
    );
    const querySnapshot = await getDocs(paymentsQuery);
    supplierPaymentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log("Payments loaded:", supplierPaymentsData.length);
    // Rendering happens in loadLedgerData
}

async function loadSupplierAdjustments() {
     if (!currentSupplierId) return;
    console.log("Loading adjustments for supplier:", currentSupplierId);
    const adjustmentsQuery = query(
        collection(db, "supplierAdjustments"),
        where("supplierId", "==", currentSupplierId),
        orderBy("adjustmentDate", "desc") // Show newest first
    );
    const querySnapshot = await getDocs(adjustmentsQuery);
    supplierAdjustmentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log("Adjustments loaded:", supplierAdjustmentsData.length);
    // Rendering happens in loadLedgerData
}

async function loadLedgerData() {
    // Fetch both payments and adjustments
    await Promise.all([loadSupplierPayments(), loadSupplierAdjustments()]);
    renderLedger(); // Render the combined ledger
}


// --- Rendering Functions ---

function renderSupplierDetails() {
    if (!currentSupplierData) return;
    document.getElementById('supplierNameHeader').textContent = currentSupplierData.supplierName || 'Supplier Details';
    document.getElementById('infoSupplierName').textContent = currentSupplierData.supplierName || 'N/A';
    document.getElementById('infoSupplierCompany').textContent = currentSupplierData.companyName || 'N/A';
    document.getElementById('infoSupplierMobile').textContent = currentSupplierData.mobileNumber || 'N/A';
    document.getElementById('infoSupplierEmail').textContent = currentSupplierData.email || 'N/A';
    document.getElementById('infoSupplierAddress').textContent = currentSupplierData.address || 'N/A';
    document.getElementById('infoSupplierGstin').textContent = currentSupplierData.gstin || 'N/A';
    document.getElementById('infoSupplierOpeningBalance').textContent = formatCurrency(currentSupplierData.openingBalance || 0);
    document.getElementById('infoSupplierDateAdded').textContent = formatDate(currentSupplierData.createdAt); // Assuming createdAt exists

    // For delete modal
    deleteSupplierNameSpan.textContent = currentSupplierData.supplierName || 'this supplier';
}

function renderPurchaseOrders() {
    const tableBody = document.getElementById('purchaseOrdersTableBody');
    tableBody.innerHTML = ''; // Clear existing rows
    if (purchaseOrdersData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">No purchase orders found for this supplier.</td></tr>';
        return;
    }
    purchaseOrdersData.forEach(po => {
        const row = tableBody.insertRow();
        // PO Date, PO Number, Amount, Status, Notes
        row.innerHTML = `
            <td>${formatDate(po.poDate)}</td>
            <td>${po.poNumber || 'N/A'}</td>
            <td>${formatCurrency(po.totalAmount)}</td>
            <td><span class="status-badge status-${(po.status || 'unknown').toLowerCase()}">${po.status || 'Unknown'}</span></td>
            <td>${po.notes || ''}</td>
        `;
    });
}

function renderLedger() {
    const tableBody = document.getElementById('ledgerTableBody');
    tableBody.innerHTML = ''; // Clear existing rows

    // Combine payments and adjustments, adding a type indicator
    const ledgerEntries = [
        ...supplierPaymentsData.map(p => ({ ...p, type: 'Payment', date: p.paymentDate, amount: p.amount, description: p.referenceNumber, notes: p.notes })),
        ...supplierAdjustmentsData.map(a => ({ ...a, type: 'Adjustment', date: a.adjustmentDate, amount: a.adjustmentAmount, description: a.reason, notes: a.notes }))
    ];

    // Sort combined entries by date, descending (newest first)
    ledgerEntries.sort((a, b) => b.date.toMillis() - a.date.toMillis());


    if (ledgerEntries.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">No payments or adjustments recorded yet.</td></tr>';
        return;
    }

    ledgerEntries.forEach(entry => {
        const row = tableBody.insertRow();
        let amountDisplay = formatCurrency(entry.amount);
        let typeClass = '';
        let typeText = entry.type;

        if (entry.type === 'Payment') {
            typeClass = 'ledger-type-payment';
             // Payments decrease balance, often shown as credit from supplier perspective
             amountDisplay = `${formatCurrency(entry.amount)}`; // Show positive payment amount
        } else if (entry.type === 'Adjustment') {
            if (entry.amount > 0) {
                // Positive adjustment increases balance due (like a debit note)
                typeClass = 'ledger-type-adjustment-debit';
                typeText = `Adjustment (+)`;
                amountDisplay = `${formatCurrency(entry.amount)}`;
            } else {
                 // Negative adjustment decreases balance due (like a credit note)
                 typeClass = 'ledger-type-adjustment-credit';
                 typeText = `Adjustment (-)`;
                 // Show the absolute value for clarity, type indicates direction
                 amountDisplay = `${formatCurrency(Math.abs(entry.amount))}`;
            }
        }


        row.innerHTML = `
            <td>${formatDate(entry.date)}</td>
            <td class="${typeClass}">${typeText}</td>
            <td>${entry.description || 'N/A'}</td>
            <td>${amountDisplay}</td>
            <td>${entry.notes || ''}</td>
        `;
        // Potentially add edit/delete buttons per entry here later
    });
}


function calculateSummary() {
    if (!currentSupplierData) return;

    const openingBalance = Number(currentSupplierData.openingBalance) || 0;

    const totalPOAmount = purchaseOrdersData.reduce((sum, po) => {
        // Only include non-cancelled/non-draft POs in balance? Or all? Assuming all for now.
        // Add condition here if needed: if (po.status !== 'Cancelled' && po.status !== 'Draft')
        return sum + (Number(po.totalAmount) || 0);
    }, 0);

    const totalPayments = supplierPaymentsData.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

    const totalAdjustments = supplierAdjustmentsData.reduce((sum, adjustment) => sum + (Number(adjustment.adjustmentAmount) || 0), 0);

     // Balance = Opening + POs - Payments + Adjustments
    // Note: Adjustments can be positive (increase due) or negative (decrease due)
    const currentBalance = openingBalance + totalPOAmount - totalPayments + totalAdjustments;

    // Render Summary
    document.getElementById('summaryTotalPOs').textContent = formatCurrency(totalPOAmount);
    document.getElementById('summaryTotalPayments').textContent = formatCurrency(totalPayments);
    document.getElementById('summaryTotalAdjustments').textContent = formatCurrency(totalAdjustments);
    document.getElementById('summaryCurrentBalance').textContent = formatCurrency(currentBalance);

     // Update balance color based on positive/negative/zero
     const balanceElement = document.getElementById('summaryCurrentBalance');
     balanceElement.style.color = currentBalance > 0 ? 'var(--danger-color)' : (currentBalance < 0 ? 'var(--success-color)' : 'var(--text-color)');
     if (currentBalance < 0) {
         // Optional: Indicate credit balance clearly
         balanceElement.textContent += " (Credit)";
     }

    console.log("Summary Calculated:", { openingBalance, totalPOAmount, totalPayments, totalAdjustments, currentBalance });
}

// --- Data Loading Orchestration ---

async function loadSupplierPageData() {
    if (isRefreshingData) {
        console.log("Already refreshing data, skipping new request.");
        return;
    }
    isRefreshingData = true;
    showLoading("Loading supplier data...");
    clearError(); // Clear general errors before loading

    try {
        // Load details first, as other loads depend on it
        await loadSupplierDetails();

        // Load POs, Payments, Adjustments in parallel
        await Promise.all([
            loadPurchaseOrders(),
            loadLedgerData() // Loads payments and adjustments internally
        ]);

        // Calculate summary after all data is loaded
        calculateSummary();

    } catch (error) {
        console.error("Error loading supplier page data:", error);
        displayError(`Failed to load supplier details: ${error.message}`);
        // Hide content or show specific error state?
        if (mainContent) mainContent.style.visibility = 'hidden'; // Hide main content on critical error
    } finally {
        hideLoading();
        isRefreshingData = false;
        console.log("Data loading complete.");
    }
}

// --- Event Handlers ---

async function handleAddPaymentSubmit(event) {
    event.preventDefault(); // Prevent default form submission
    clearError('paymentModalError');
    const submitButton = document.getElementById('submitPaymentBtn');
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const paymentData = {
        supplierId: currentSupplierId,
        supplierName: currentSupplierData?.supplierName || 'N/A', // Include name for easier querying/display if needed
        paymentDate: Timestamp.fromDate(new Date(paymentDateInput.value)),
        amount: parseFloat(paymentAmountInput.value),
        referenceNumber: paymentReferenceInput.value.trim(),
        notes: paymentNotesInput.value.trim(),
        createdAt: serverTimestamp()
    };

    // Basic validation
    if (!paymentDateInput.value || isNaN(paymentData.amount) || paymentData.amount <= 0) {
        displayError("Please enter a valid date and a positive payment amount.", 'paymentModalError');
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-save"></i> Save Payment';
        return;
    }

    try {
         // Add payment doc
        const paymentRef = await addDoc(collection(db, "supplierPayments"), paymentData);
        console.log("Payment added with ID: ", paymentRef.id);

        // Update summary and ledger display
        await loadLedgerData(); // Reload payments & adjustments
        calculateSummary();

        closeModal(addPaymentModal);

    } catch (error) {
        console.error("Error adding payment: ", error);
        displayError(`Failed to save payment: ${error.message}`, 'paymentModalError');
    } finally {
        submitButton.disabled = false;
         submitButton.innerHTML = '<i class="fas fa-save"></i> Save Payment';
    }
}

async function handleAddAdjustmentSubmit(event) {
    event.preventDefault();
    clearError('adjustmentModalError');
    const submitButton = document.getElementById('submitAdjustmentBtn');
    submitButton.disabled = true;
     submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';


    const adjustmentData = {
        supplierId: currentSupplierId,
        supplierName: currentSupplierData?.supplierName || 'N/A',
        adjustmentDate: Timestamp.fromDate(new Date(adjustmentDateInput.value)),
        adjustmentAmount: parseFloat(adjustmentAmountInput.value),
        reason: adjustmentReasonInput.value.trim(),
        notes: adjustmentNotesInput.value.trim(),
        createdAt: serverTimestamp()
    };

     // Basic validation
    if (!adjustmentDateInput.value || isNaN(adjustmentData.adjustmentAmount) || adjustmentData.adjustmentAmount === 0 || !adjustmentData.reason) {
        displayError("Please enter a valid date, a non-zero amount, and a reason.", 'adjustmentModalError');
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-save"></i> Save Adjustment';
        return;
    }

    try {
        const adjustmentRef = await addDoc(collection(db, "supplierAdjustments"), adjustmentData);
        console.log("Adjustment added with ID: ", adjustmentRef.id);

        // Update summary and ledger
         await loadLedgerData(); // Reload payments & adjustments
        calculateSummary();

        closeModal(addAdjustmentModal);

    } catch (error) {
        console.error("Error adding adjustment: ", error);
        displayError(`Failed to save adjustment: ${error.message}`, 'adjustmentModalError');
    } finally {
        submitButton.disabled = false;
         submitButton.innerHTML = '<i class="fas fa-save"></i> Save Adjustment';
    }
}


async function handleDeleteSupplierConfirm() {
    if (!confirmDeleteCheckbox.checked || !currentSupplierId) {
         displayError("Checkbox must be checked to confirm deletion.", 'deleteModalError');
        return;
    }

    clearError('deleteModalError');
    confirmDeleteButton.disabled = true;
    confirmDeleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    const cancelButton = document.getElementById('cancelSupplierDeleteBtn');
    cancelButton.disabled = true;


    try {
        const supplierRef = doc(db, "suppliers", currentSupplierId);
        await deleteDoc(supplierRef);
        console.log("Supplier document successfully deleted!");

        // Redirect back to the supplier list page
        alert(`Supplier "${currentSupplierData?.supplierName || currentSupplierId}" deleted successfully.`);
        window.location.href = 'supplier_accounts.html';

    } catch (error) {
        console.error("Error deleting supplier: ", error);
        displayError(`Failed to delete supplier: ${error.message}`, 'deleteModalError');
        confirmDeleteButton.disabled = false; // Re-enable button on error
        confirmDeleteButton.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Permanently';
        cancelButton.disabled = false;
         confirmDeleteCheckbox.checked = false; // Uncheck checkbox on error
    }
    // No finally block needed for button reset if redirecting on success
}


// --- Event Listener Setup ---

function setupEventListeners() {
    if (listenersAttached) return; // Prevent attaching multiple times

    console.log("Setting up event listeners...");

    // Modal Trigger Buttons
    document.getElementById('addPaymentBtn').addEventListener('click', () => openModal(addPaymentModal));
    document.getElementById('addAdjustmentBtn').addEventListener('click', () => openModal(addAdjustmentModal));
    document.getElementById('deleteSupplierBtn').addEventListener('click', () => openModal(confirmDeleteSupplierModal));

    // Modal Close/Cancel Buttons
    document.getElementById('closePaymentModal').addEventListener('click', () => closeModal(addPaymentModal));
    document.getElementById('cancelPaymentBtn').addEventListener('click', () => closeModal(addPaymentModal));
    document.getElementById('closeAdjustmentModal').addEventListener('click', () => closeModal(addAdjustmentModal));
    document.getElementById('cancelAdjustmentBtn').addEventListener('click', () => closeModal(addAdjustmentModal));
    document.getElementById('closeConfirmDeleteSupplierModal').addEventListener('click', () => closeModal(confirmDeleteSupplierModal));
    document.getElementById('cancelSupplierDeleteBtn').addEventListener('click', () => closeModal(confirmDeleteSupplierModal));

     // Modal Submission Forms
     if (addPaymentForm) addPaymentForm.addEventListener('submit', handleAddPaymentSubmit);
     if (addAdjustmentForm) addAdjustmentForm.addEventListener('submit', handleAddAdjustmentSubmit);

    // Delete Confirmation Logic
     if (confirmDeleteCheckbox) confirmDeleteCheckbox.addEventListener('change', () => {
        confirmDeleteButton.disabled = !confirmDeleteCheckbox.checked;
         if(confirmDeleteCheckbox.checked) clearError('deleteModalError'); // Clear error when checked
    });
     if (confirmDeleteButton) confirmDeleteButton.addEventListener('click', handleDeleteSupplierConfirm);

     // Refresh Button
     document.getElementById('refreshDataBtn').addEventListener('click', loadSupplierPageData);

    // Close modal if clicking outside the content area
    window.addEventListener('click', (event) => {
        if (event.target === addPaymentModal) closeModal(addPaymentModal);
        if (event.target === addAdjustmentModal) closeModal(addAdjustmentModal);
        if (event.target === confirmDeleteSupplierModal) closeModal(confirmDeleteSupplierModal);
    });


    listenersAttached = true;
    console.log("Event listeners attached.");
}

// --- Initialization Function (Exported) ---
export function initializeSupplierDetailPage(supplierId) {
     console.log(`Initializing supplier detail page for ID: ${supplierId}`);
     currentSupplierId = supplierId;

    // Ensure main content area is visible once JS takes over
     if (mainContent) { mainContent.style.visibility = 'visible'; }
     else { console.error("Critical: Main content container missing!"); displayError("Page layout structure is broken."); return; }

    // Setup listeners ONCE
     if (!listenersAttached) {
         setupEventListeners();
     }

     // Load initial data
     loadSupplierPageData();
};


// --- Script Load Confirmation ---
console.log("supplier_account_detail.js script loaded.");
// Initialization is now triggered by the inline script in HTML after auth check.