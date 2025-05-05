// js/supplier_account_detail.js - v8 (Theming & Layout Updates Integrated)

// --- Firebase Imports ---
// Ensure ALL necessary functions are imported or globally available via firebase-init.js
import { db, auth } from './firebase-init.js';
import {
    doc, getDoc, collection, query, where, getDocs, orderBy as firestoreOrderBy, // Renamed orderBy
    Timestamp, addDoc, serverTimestamp, updateDoc, deleteDoc, runTransaction, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Global State ---
let currentSupplierId = null;
let currentSupplierData = null;
let purchaseOrdersData = [];
let supplierPaymentsData = [];
let supplierAdjustmentsData = []; // Store adjustments
let listenersAttached = false;
let supplierDetailPageInitialized = false;
let isRefreshingData = false; // Flag to prevent concurrent refreshes

// --- Helper Function: Set Modal Theme ---
/**
 * Sets the theme class for a modal element.
 * @param {HTMLElement} modalElement The modal element.
 * @param {string|null} themeSuffix The suffix for the theme class (e.g., 'warning', 'info') or null to remove themes.
 */
function setModalTheme(modalElement, themeSuffix) {
    if (!modalElement) return;
    // Remove existing theme classes
    modalElement.className = modalElement.className.replace(/modal-theme-\w+/g, '').trim();
    // Add the new theme class if provided
    if (themeSuffix) {
        modalElement.classList.add(`modal-theme-${themeSuffix}`);
    }
}

// --- Helper Functions ---
function displayError(message, elementId = 'generalErrorDisplay') {
    console.error("Displaying Error:", message, "Target Element ID:", elementId);
    try {
        let errorElement = document.getElementById(elementId);
        if (!errorElement && elementId === 'generalErrorDisplay') {
            // Fallback if generalErrorDisplay isn't found (might be early error)
            errorElement = document.body.insertBefore(document.createElement('div'), document.body.firstChild);
            errorElement.id = 'generalErrorDisplay';
            errorElement.className = 'error-message-area'; // Apply styling
            errorElement.style.margin = '15px'; // Ensure visibility
        }

        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
             // Scroll into view if it's a specific modal error area
            if (elementId !== 'generalErrorDisplay' && elementId !== 'ledgerErrorDisplay') {
                 errorElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } else {
            console.error(`Error display element with ID '${elementId}' not found.`);
            alert("An error occurred: " + message); // Fallback alert
        }
    } catch (e) {
        console.error("Error displaying error:", e);
        alert("A critical error occurred displaying an error message: " + message);
    }
}


function clearError(elementId = 'generalErrorDisplay') {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
}

function formatDate(date) {
    if (!date) return 'N/A';
    // Assuming date is a Firestore Timestamp or JS Date object
    const jsDate = (date instanceof Timestamp) ? date.toDate() : date;
    if (!(jsDate instanceof Date) || isNaN(jsDate)) {
       return 'Invalid Date';
    }
    return jsDate.toLocaleDateString('en-GB'); // dd/mm/yyyy format
}

function formatCurrency(amount) {
    if (amount == null || isNaN(amount)) {
        return '₹ 0.00';
    }
    // Format as Indian Rupees (₹)
    return `₹ ${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTimestampToInput(timestamp) {
    if (timestamp && timestamp.toDate) {
        const date = timestamp.toDate();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    // Return today's date if no timestamp provided
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function sanitizeInput(value) {
    // Basic sanitization: trim whitespace
    return value ? value.trim() : '';
}

function validateMobileNumber(mobile) {
    // Simple validation: Checks if it's 10 digits
    const mobileRegex = /^\d{10}$/;
    return mobileRegex.test(mobile);
}

function validateEmail(email) {
    // Simple validation: Checks for a basic email pattern
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// --- Data Loading Functions ---

async function fetchSupplierDetails(supplierId) {
    console.log("Fetching supplier details for ID:", supplierId);
    const docRef = doc(db, "suppliers", supplierId);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            console.log("Supplier data found:", docSnap.data());
            currentSupplierData = { id: docSnap.id, ...docSnap.data() };
            return currentSupplierData;
        } else {
            console.error("No such supplier found!");
            throw new Error("Supplier not found.");
        }
    } catch (error) {
        console.error("Error fetching supplier details:", error);
        throw error; // Re-throw to be caught by caller
    }
}

async function fetchPurchaseOrders(supplierId) {
    console.log("Fetching purchase orders for supplier ID:", supplierId);
    const q = query(collection(db, "purchase_orders"), where("supplierId", "==", supplierId), firestoreOrderBy("poDate", "desc"));
    try {
        const querySnapshot = await getDocs(q);
        purchaseOrdersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Fetched POs:", purchaseOrdersData);
        return purchaseOrdersData;
    } catch (error) {
        console.error("Error fetching purchase orders:", error);
        throw error;
    }
}

async function fetchSupplierPayments(supplierId) {
    console.log("Fetching payments for supplier ID:", supplierId);
     const q = query(collection(db, "supplier_payments"), where("supplierId", "==", supplierId), firestoreOrderBy("paymentDate", "desc"));
    try {
        const querySnapshot = await getDocs(q);
        supplierPaymentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Fetched Payments:", supplierPaymentsData);
        return supplierPaymentsData;
    } catch (error) {
        console.error("Error fetching supplier payments:", error);
        throw error;
    }
}

async function fetchSupplierAdjustments(supplierId) {
    console.log("Fetching adjustments for supplier ID:", supplierId);
    const q = query(collection(db, "supplier_adjustments"), where("supplierId", "==", supplierId), firestoreOrderBy("adjustmentDate", "desc"));
    try {
        const querySnapshot = await getDocs(q);
        supplierAdjustmentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Fetched Adjustments:", supplierAdjustmentsData);
        return supplierAdjustmentsData;
    } catch (error) {
        console.error("Error fetching supplier adjustments:", error);
        throw error;
    }
}


// --- UI Update Functions ---

function displaySupplierDetails(supplierData) {
    console.log("Displaying supplier details:", supplierData);
    if (!supplierData) {
        console.warn("No supplier data to display.");
        return;
    }

    // Header and Breadcrumb
    document.getElementById('supplierNameHeader').textContent = supplierData.name || 'N/A';
    document.getElementById('breadcrumbSupplierName').textContent = supplierData.name || 'Details';

    // Supplier Details Box
    document.getElementById('supplierContactPerson').textContent = supplierData.contactPerson || '-';
    document.getElementById('supplierMobile').textContent = supplierData.mobileNumber || 'N/A';
    document.getElementById('supplierEmail').textContent = supplierData.email || '-';
    document.getElementById('supplierAddress').textContent = supplierData.address || '-';
    document.getElementById('supplierGst').textContent = supplierData.gstNumber || '-';
    document.getElementById('supplierPan').textContent = supplierData.panNumber || '-';
    document.getElementById('supplierCreationDate').textContent = formatDate(supplierData.createdAt) || 'N/A';

    // Status Badge
    const statusBadge = document.getElementById('supplierStatusBadge');
    statusBadge.textContent = supplierData.status === 'active' ? 'Active' : 'Inactive';
    statusBadge.className = `status-badge status-${supplierData.status}`; // Add status-specific class

     // Remarks/Notes Box
    document.getElementById('supplierRemarksNotes').textContent = supplierData.remarks || 'No remarks added.';

    // Update Toggle Button text and class based on status
    updateToggleButton(supplierData.status);
}

function updateToggleButton(status) {
    const toggleBtn = document.getElementById('toggleStatusBtn');
    if (toggleBtn) {
        if (status === 'active') {
            toggleBtn.innerHTML = '<i class="fas fa-power-off"></i> Disable Account';
            toggleBtn.classList.remove('enable');
            toggleBtn.classList.add('disable');
            toggleBtn.title = 'Disable this supplier account';
        } else {
            toggleBtn.innerHTML = '<i class="fas fa-check-circle"></i> Enable Account';
            toggleBtn.classList.remove('disable');
            toggleBtn.classList.add('enable');
            toggleBtn.title = 'Enable this supplier account';
        }
    }
}

function calculateAndDisplaySummary(pos, payments, adjustments) {
    console.log("Calculating summary with:", { pos, payments, adjustments });
    let totalPoValue = 0;
    let totalPaid = 0;
    let totalAdjustments = 0;
    let lastPaymentDate = null;
    let lastPoDate = null;

    // Calculate total PO value and find last PO date
    pos.forEach(po => {
        totalPoValue += parseFloat(po.totalAmount || 0);
        const poDate = po.poDate; // Assuming poDate is Firestore Timestamp or JS Date
        if (poDate && (!lastPoDate || poDate > lastPoDate)) {
            lastPoDate = poDate;
        }
    });

    // Calculate total paid and find last payment date
    payments.forEach(payment => {
        totalPaid += parseFloat(payment.amountPaid || 0);
        const paymentDate = payment.paymentDate; // Assuming paymentDate is Firestore Timestamp or JS Date
        if (paymentDate && (!lastPaymentDate || paymentDate > lastPaymentDate)) {
            lastPaymentDate = paymentDate;
        }
    });

    // Calculate total adjustments (Credit increases balance, Debit decreases balance from SUPPLIER perspective)
    // So, from OUR perspective (how much we owe):
    // Credit Adjustment (e.g., discount) REDUCES what we owe.
    // Debit Adjustment (e.g., return) INCREASES what we owe.
    adjustments.forEach(adj => {
         const amount = parseFloat(adj.amount || 0);
         if (adj.type === 'credit') { // Credit reduces what we owe
             totalAdjustments -= amount;
         } else if (adj.type === 'debit') { // Debit increases what we owe
             totalAdjustments += amount;
         }
     });

    // Calculate balance due (Amount we owe = Total PO Value - Total Paid + Total Adjustments)
    // NOTE: This logic assumes POs increase the amount we owe. Adjustments are handled above.
    const balanceDue = totalPoValue - totalPaid + totalAdjustments;

    // Display Summaries
    document.getElementById('summaryTotalPoValue').textContent = formatCurrency(totalPoValue);
    document.getElementById('summaryTotalPaid').textContent = formatCurrency(totalPaid);
     document.getElementById('summaryTotalAdjustments').textContent = formatCurrency(totalAdjustments); // Display net adjustments
    document.getElementById('summaryLastPaymentDate').textContent = formatDate(lastPaymentDate);
    document.getElementById('summaryLastPoDate').textContent = formatDate(lastPoDate);

    // Display Balance Due
    const balanceElement = document.getElementById('summaryBalance');
    balanceElement.textContent = formatCurrency(balanceDue);

    // Style Balance Due based on value
     balanceElement.classList.remove('balance-positive', 'balance-negative', 'balance-zero');
    if (balanceDue > 0) {
        balanceElement.classList.add('balance-negative'); // We owe money (negative for our cashflow)
        balanceElement.title = "Amount payable to supplier";
    } else if (balanceDue < 0) {
        balanceElement.classList.add('balance-positive'); // Supplier owes us / Advance paid (positive for our cashflow)
        balanceElement.title = "Amount receivable from supplier / Advance";
    } else {
        balanceElement.classList.add('balance-zero'); // Settled
        balanceElement.title = "Account settled";
    }
}

function buildLedgerEntries(pos, payments, adjustments) {
    console.log("Building ledger entries from:", { pos, payments, adjustments });
    let ledger = [];

    // Add POs (Increase amount we owe - Credit Balance)
    pos.forEach(po => {
        ledger.push({
            date: po.poDate instanceof Timestamp ? po.poDate : Timestamp.fromDate(new Date(po.poDate || Date.now())), // Ensure Timestamp for sorting
            type: 'PO',
            details: `PO #${po.poNumber || 'N/A'}`,
            debit: 0,
            credit: parseFloat(po.totalAmount || 0),
            refId: po.id, // Add refId
            sortKey: (po.poDate instanceof Timestamp ? po.poDate : Timestamp.fromDate(new Date(po.poDate || Date.now()))).toMillis() + '_po_' + po.id // Unique sort key
        });
    });

    // Add Payments (Decrease amount we owe - Debit Balance)
    payments.forEach(payment => {
        ledger.push({
            date: payment.paymentDate instanceof Timestamp ? payment.paymentDate : Timestamp.fromDate(new Date(payment.paymentDate || Date.now())),
            type: 'Payment',
            details: `${payment.paymentMethod || 'Payment'} ${payment.reference ? '- ' + payment.reference : ''}`,
            debit: parseFloat(payment.amountPaid || 0),
            credit: 0,
            refId: payment.id,
             sortKey: (payment.paymentDate instanceof Timestamp ? payment.paymentDate : Timestamp.fromDate(new Date(payment.paymentDate || Date.now()))).toMillis() + '_pay_' + payment.id
        });
    });

    // Add Adjustments
    adjustments.forEach(adj => {
         const amount = parseFloat(adj.amount || 0);
         let debit = 0;
         let credit = 0;
         // From OUR perspective (amount we owe):
         // Credit Adj (discount): Reduces what we owe (Debit balance)
         // Debit Adj (return): Increases what we owe (Credit balance)
         if (adj.type === 'credit') {
             debit = amount; // Reduces balance we owe
         } else { // debit type adjustment
             credit = amount; // Increases balance we owe
         }
        ledger.push({
            date: adj.adjustmentDate instanceof Timestamp ? adj.adjustmentDate : Timestamp.fromDate(new Date(adj.adjustmentDate || Date.now())),
            type: 'Adjustment',
            details: `${adj.type.charAt(0).toUpperCase() + adj.type.slice(1)}: ${adj.reason || ''}`,
            debit: debit,
            credit: credit,
            refId: adj.id,
            sortKey: (adj.adjustmentDate instanceof Timestamp ? adj.adjustmentDate : Timestamp.fromDate(new Date(adj.adjustmentDate || Date.now()))).toMillis() + '_adj_' + adj.id
        });
    });

    // Sort ledger entries chronologically by date, then by type (PO -> Adj -> Pay), then ID for stability
    // Using the precomputed sortKey for efficiency and accuracy
    ledger.sort((a, b) => {
        if (a.date.seconds !== b.date.seconds) {
            return a.date.seconds - b.date.seconds;
        }
         // If dates are the same, potentially sort by milliseconds if available
         if (a.date.nanoseconds !== b.date.nanoseconds) {
             return a.date.nanoseconds - b.date.nanoseconds;
         }
         // If timestamps are identical, sort by type: PO (Credit > 0), Adjustment (Debit or Credit), Payment (Debit > 0)
         // This order ensures balance calculation starts correctly if timestamps are same.
         const typeOrder = { 'PO': 1, 'Adjustment': 2, 'Payment': 3 };
         const orderA = typeOrder[a.type] || 99;
         const orderB = typeOrder[b.type] || 99;
         if (orderA !== orderB) {
             return orderA - orderB;
         }
         // Final fallback sort by refId for stability
         return a.refId.localeCompare(b.refId);

    });


    // Calculate running balance
    let runningBalance = 0;
    ledger.forEach(entry => {
        runningBalance += entry.credit;
        runningBalance -= entry.debit;
        entry.balance = runningBalance;
    });

    console.log("Built and sorted ledger:", ledger);
    return ledger;
}


function displayLedger(ledger) {
    console.log("Displaying ledger:", ledger);
    const tableBody = document.getElementById('accountLedgerTableBody');
    const emptyMsg = document.getElementById('ledgerEmptyMessage');
    const loadingIndicator = document.getElementById('ledgerLoadingIndicator');
    const errorDisplay = document.getElementById('ledgerErrorDisplay');

    if (loadingIndicator) loadingIndicator.style.display = 'none'; // Hide loading indicator
    clearError('ledgerErrorDisplay'); // Clear previous errors
    tableBody.innerHTML = ''; // Clear previous entries

    if (!ledger || ledger.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
        return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';

    ledger.forEach(entry => {
        const row = tableBody.insertRow();
        row.insertCell(0).textContent = formatDate(entry.date);
        row.insertCell(1).textContent = entry.type;
        row.insertCell(2).textContent = entry.details;
        row.insertCell(3).textContent = entry.debit > 0 ? formatCurrency(entry.debit) : '-';
        row.insertCell(4).textContent = entry.credit > 0 ? formatCurrency(entry.credit) : '-';
        row.insertCell(5).textContent = formatCurrency(entry.balance);

         // Add classes for styling cells
        row.cells[3].classList.add('number-cell');
        row.cells[4].classList.add('number-cell');
        row.cells[5].classList.add('number-cell', 'balance-cell'); // Add balance-cell class

        // Style balance cell based on value (optional, can be done via CSS too)
        row.cells[5].classList.remove('balance-positive', 'balance-negative', 'balance-zero');
        if (entry.balance < 0) {
            row.cells[5].classList.add('balance-positive'); // Supplier owes us
        } else if (entry.balance > 0) {
             row.cells[5].classList.add('balance-negative'); // We owe supplier
        } else {
            row.cells[5].classList.add('balance-zero');
        }
    });
}

// --- Modal Handling ---

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        console.log(`Opening modal: ${modalId}`);
        modal.style.display = 'flex'; // Use flex to center content
    } else {
        console.error(`Modal with ID ${modalId} not found.`);
    }
}

function closeModalById(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        console.log(`Closing modal: ${modalId}`);
        modal.style.display = 'none';
        setModalTheme(modal, null); // Remove theme class on close

        // Clear any error messages within this modal
        const errorElement = modal.querySelector('.error-message');
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
        // Reset specific forms if needed (e.g., payment, adjustment)
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
            // Special handling for checkboxes or other elements if needed
            if (modalId === 'confirmToggleModal' || modalId === 'confirmDeleteSupplierModal') {
                const checkbox = modal.querySelector('input[type="checkbox"]');
                const confirmBtn = modal.querySelector('.confirm-button, .danger-button');
                if (checkbox) checkbox.checked = false;
                if (confirmBtn) confirmBtn.disabled = true;
            }
             // Set date fields back to today after reset if they exist
             const dateInputs = form.querySelectorAll('input[type="date"]');
             dateInputs.forEach(input => {
                 input.value = formatTimestampToInput(null); // Sets to today
             });
        }
    } else {
         console.warn(`Modal with ID ${modalId} not found for closing.`);
    }
}

// Specific Modal Open Functions (Integrate Theming)

function openEditModal() {
    if (!currentSupplierData) {
        displayError("Supplier data not loaded. Cannot open edit modal.");
        return;
    }
    clearError('editSupplierError');
    // Populate form fields
    document.getElementById('editSupplierName').value = currentSupplierData.name || '';
    document.getElementById('editSupplierContactPerson').value = currentSupplierData.contactPerson || '';
    document.getElementById('editSupplierMobile').value = currentSupplierData.mobileNumber || '';
    document.getElementById('editSupplierEmail').value = currentSupplierData.email || '';
    document.getElementById('editSupplierAddress').value = currentSupplierData.address || '';
    document.getElementById('editSupplierGst').value = currentSupplierData.gstNumber || '';
    document.getElementById('editSupplierPan').value = currentSupplierData.panNumber || '';
    document.getElementById('editSupplierRemarks').value = currentSupplierData.remarks || '';

    const modalElement = document.getElementById('editSupplierModal');
    setModalTheme(modalElement, 'info'); // Set info theme
    openModal('editSupplierModal');
}

function openRecordPaymentModal() {
    if (!currentSupplierData) {
        displayError("Supplier data not loaded. Cannot open payment modal.");
        return;
    }
    clearError('paymentMadeError');
    document.getElementById('paymentSupplierName').textContent = currentSupplierData.name || 'Supplier';
    // Reset form (handled by closeModalById on close, but good practice here too)
    const form = document.getElementById('recordPaymentForm');
     if (form) {
         form.reset();
         // Set date to today
         document.getElementById('paymentDate').value = formatTimestampToInput(null);
     }

    const modalElement = document.getElementById('recordPaymentModal');
    setModalTheme(modalElement, 'success'); // Set success theme
    openModal('recordPaymentModal');
}

function openAddAdjustmentModal() {
    if (!currentSupplierData) {
        displayError("Supplier data not loaded. Cannot open adjustment modal.");
        return;
    }
    clearError('adjustmentError');
    document.getElementById('adjustmentSupplierName').textContent = currentSupplierData.name || 'Supplier';
    // Reset form
    const form = document.getElementById('addSupplierAdjustmentForm');
     if (form) {
         form.reset();
         // Set date to today and default radio
         document.getElementById('adjustmentDate').value = formatTimestampToInput(null);
         document.getElementById('adjustmentTypeDebit').checked = true; // Default to debit
     }

    const modalElement = document.getElementById('addAdjustmentModal');
    setModalTheme(modalElement, 'warning'); // Set warning theme
    openModal('addAdjustmentModal');
}

function openToggleModal() {
    if (!currentSupplierData) {
        displayError("Supplier data not loaded. Cannot open toggle status modal.");
        return;
    }
     clearError('toggleError');
    const isCurrentlyActive = currentSupplierData.status === 'active';
    const actionText = isCurrentlyActive ? 'Disable' : 'Enable';
    const targetStatus = isCurrentlyActive ? 'inactive' : 'active';
    const theme = isCurrentlyActive ? 'secondary' : 'success'; // Theme based on action

    document.getElementById('toggleActionText').textContent = actionText.toLowerCase();
    document.getElementById('toggleSupplierName').textContent = currentSupplierData.name || 'Supplier';
    document.getElementById('toggleModalTitle').innerHTML = `<i class="fas ${isCurrentlyActive ? 'fa-power-off' : 'fa-check-circle'}"></i> Confirm ${actionText}`;

    // Show warning if disabling
    const warningMsg = document.getElementById('toggleStatusWarning');
     if (isCurrentlyActive) {
         warningMsg.textContent = 'Disabling the supplier will prevent adding new POs for them.';
         warningMsg.style.display = 'block';
     } else {
         warningMsg.style.display = 'none';
     }

    // Reset checkbox and button state
    const checkbox = document.getElementById('confirmToggleCheckbox');
    const confirmBtn = document.getElementById('confirmToggleBtn');
    if (checkbox) checkbox.checked = false;
    if (confirmBtn) {
         confirmBtn.disabled = true;
         // Store target status in button's dataset for the handler
         confirmBtn.dataset.targetStatus = targetStatus;
         // Update button text/icon (optional, CSS theme handles color)
         confirmBtn.innerHTML = `<i class="fas fa-check"></i> Confirm ${actionText}`;
     }

    const modalElement = document.getElementById('confirmToggleModal');
    setModalTheme(modalElement, theme); // Set theme based on action
    openModal('confirmToggleModal');
}

function openConfirmDeleteSupplierModal() {
     if (!currentSupplierData) {
         displayError("Supplier data not loaded. Cannot open delete confirmation.");
         return;
     }
     clearError('deleteError');
     document.getElementById('deleteSupplierName').textContent = currentSupplierData.name || 'Supplier';

     // Reset checkbox and button state
    const checkbox = document.getElementById('confirmDeleteSupplierCheckbox');
    const confirmBtn = document.getElementById('confirmSupplierDeleteBtn');
    if (checkbox) checkbox.checked = false;
    if (confirmBtn) confirmBtn.disabled = true;

    const modalElement = document.getElementById('confirmDeleteSupplierModal');
    setModalTheme(modalElement, 'danger'); // Set danger theme
    openModal('confirmDeleteSupplierModal');
}

// --- Form Submit Handlers ---

async function handleEditSupplierSubmit(event) {
    event.preventDefault();
    clearError('editSupplierError');
    const form = event.target;
    const saveButton = form.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    // Get updated data, sanitize, and validate
    const name = sanitizeInput(document.getElementById('editSupplierName').value);
    const contactPerson = sanitizeInput(document.getElementById('editSupplierContactPerson').value);
    const mobile = sanitizeInput(document.getElementById('editSupplierMobile').value);
    const email = sanitizeInput(document.getElementById('editSupplierEmail').value);
    const address = sanitizeInput(document.getElementById('editSupplierAddress').value);
    const gst = sanitizeInput(document.getElementById('editSupplierGst').value);
    const pan = sanitizeInput(document.getElementById('editSupplierPan').value);
    const remarks = sanitizeInput(document.getElementById('editSupplierRemarks').value);

    // Basic Validation
    if (!name || !mobile) {
        displayError("Supplier Name and Mobile Number are required.", 'editSupplierError');
        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        return;
    }
     if (!validateMobileNumber(mobile)) {
        displayError("Please enter a valid 10-digit Mobile Number.", 'editSupplierError');
        saveButton.disabled = false;
         saveButton.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        return;
    }
    if (email && !validateEmail(email)) {
        displayError("Please enter a valid Email address.", 'editSupplierError');
        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        return;
    }
    // Add more validation as needed (GST format, PAN format etc.)

    const updatedData = {
        name: name,
        contactPerson: contactPerson,
        mobileNumber: mobile,
        email: email,
        address: address,
        gstNumber: gst,
        panNumber: pan,
        remarks: remarks,
        updatedAt: serverTimestamp() // Track last update
    };

    try {
        const supplierRef = doc(db, "suppliers", currentSupplierId);
        await updateDoc(supplierRef, updatedData);
        console.log("Supplier details updated successfully.");
        closeModalById('editSupplierModal');
        await refreshSupplierData(); // Refresh data on page
         // Show success feedback (optional)
        displaySuccessMessage("Supplier details updated successfully.");
    } catch (error) {
        console.error("Error updating supplier:", error);
        displayError(`Failed to update supplier: ${error.message}`, 'editSupplierError');
         saveButton.disabled = false;
         saveButton.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }
}

async function handleRecordPaymentSubmit(event) {
    event.preventDefault();
    clearError('paymentMadeError');
    const form = event.target;
    const saveButton = form.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Recording...';

    const amountPaid = parseFloat(document.getElementById('paymentAmountPaid').value);
    const paymentDateStr = document.getElementById('paymentDate').value;
    const paymentMethod = document.getElementById('paymentMethod').value;
    const reference = sanitizeInput(document.getElementById('paymentReference').value);

    // Validation
    if (isNaN(amountPaid) || amountPaid <= 0) {
        displayError("Please enter a valid positive Amount Paid.", 'paymentMadeError');
        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="fas fa-check-circle"></i> Record Payment';
        return;
    }
     if (!paymentDateStr) {
        displayError("Please select a Payment Date.", 'paymentMadeError');
        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="fas fa-check-circle"></i> Record Payment';
        return;
    }
    const paymentDate = Timestamp.fromDate(new Date(paymentDateStr)); // Convert string to Timestamp

    const paymentData = {
        supplierId: currentSupplierId,
        supplierName: currentSupplierData?.name || 'Unknown', // Store name for easier querying if needed
        amountPaid: amountPaid,
        paymentDate: paymentDate,
        paymentMethod: paymentMethod,
        reference: reference,
        recordedAt: serverTimestamp()
    };

    try {
        const docRef = await addDoc(collection(db, "supplier_payments"), paymentData);
        console.log("Payment recorded successfully with ID: ", docRef.id);
        closeModalById('recordPaymentModal');
        await refreshSupplierData(); // Refresh data on page
         // Show success feedback (optional)
         displaySuccessMessage("Payment recorded successfully.");
    } catch (error) {
        console.error("Error recording payment:", error);
        displayError(`Failed to record payment: ${error.message}`, 'paymentMadeError');
        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="fas fa-check-circle"></i> Record Payment';
    }
}

async function handleAddAdjustmentSubmit(event) {
    event.preventDefault();
    clearError('adjustmentError');
    const form = event.target;
    const saveButton = form.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

    const adjustmentType = form.querySelector('input[name="adjustmentType"]:checked').value;
    const amount = parseFloat(document.getElementById('adjustmentAmount').value);
    const adjustmentDateStr = document.getElementById('adjustmentDate').value;
    const reason = sanitizeInput(document.getElementById('adjustmentReason').value);

    // Validation
    if (!adjustmentType) {
         displayError("Please select an Adjustment Type.", 'adjustmentError');
         saveButton.disabled = false;
         saveButton.innerHTML = '<i class="fas fa-plus-circle"></i> Add Adjustment';
         return;
    }
    if (isNaN(amount) || amount <= 0) {
        displayError("Please enter a valid positive Adjustment Amount.", 'adjustmentError');
        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="fas fa-plus-circle"></i> Add Adjustment';
        return;
    }
     if (!adjustmentDateStr) {
        displayError("Please select an Adjustment Date.", 'adjustmentError');
        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="fas fa-plus-circle"></i> Add Adjustment';
        return;
    }
     if (!reason) {
        displayError("Please enter a Reason/Description for the adjustment.", 'adjustmentError');
        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="fas fa-plus-circle"></i> Add Adjustment';
        return;
    }
     const adjustmentDate = Timestamp.fromDate(new Date(adjustmentDateStr)); // Convert string to Timestamp

    const adjustmentData = {
        supplierId: currentSupplierId,
        supplierName: currentSupplierData?.name || 'Unknown',
        type: adjustmentType, // 'debit' or 'credit'
        amount: amount,
        adjustmentDate: adjustmentDate,
        reason: reason,
        recordedAt: serverTimestamp()
    };

    try {
        const docRef = await addDoc(collection(db, "supplier_adjustments"), adjustmentData);
        console.log("Adjustment added successfully with ID: ", docRef.id);
        closeModalById('addAdjustmentModal');
        await refreshSupplierData(); // Refresh data on page
         // Show success feedback (optional)
         displaySuccessMessage("Account adjustment added successfully.");
    } catch (error) {
        console.error("Error adding adjustment:", error);
        displayError(`Failed to add adjustment: ${error.message}`, 'adjustmentError');
        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="fas fa-plus-circle"></i> Add Adjustment';
    }
}

// --- Action Handlers (Toggle, Delete) ---

async function handleToggleStatus() {
    const confirmBtn = document.getElementById('confirmToggleBtn');
    const targetStatus = confirmBtn.dataset.targetStatus; // Get target status stored earlier

     if (!targetStatus || (targetStatus !== 'active' && targetStatus !== 'inactive')) {
         displayError("Invalid target status.", 'toggleError');
         return;
     }

    clearError('toggleError');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

    try {
        const supplierRef = doc(db, "suppliers", currentSupplierId);
        await updateDoc(supplierRef, {
            status: targetStatus,
            updatedAt: serverTimestamp()
        });
        console.log(`Supplier status updated to ${targetStatus}.`);
        closeModalById('confirmToggleModal');
        await refreshSupplierData(); // Refresh data and button text/style
        displaySuccessMessage(`Supplier account successfully ${targetStatus === 'active' ? 'enabled' : 'disabled'}.`);
    } catch (error) {
        console.error("Error updating supplier status:", error);
        displayError(`Failed to update status: ${error.message}`, 'toggleError');
        // Re-enable button with original text/icon based on ACTUAL current status before failed attempt
         const actionText = targetStatus === 'active' ? 'Enable' : 'Disable'; // Action user was trying to do
         confirmBtn.innerHTML = `<i class="fas fa-check"></i> Confirm ${actionText}`;
        confirmBtn.disabled = false; // Re-enable on error for retry
        // We need to re-enable the checkbox listener indirectly by resetting the button state.
         const checkbox = document.getElementById('confirmToggleCheckbox');
         if (checkbox) checkbox.checked = false; // Ensure checkbox needs re-checking
         confirmBtn.disabled = true; // Keep disabled until checkbox checked again

    }
}

async function handleDeleteSupplier() {
    const confirmBtn = document.getElementById('confirmSupplierDeleteBtn');
    clearError('deleteError');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

     // Add a small delay to prevent accidental double-clicks and show progress
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
        const supplierRef = doc(db, "suppliers", currentSupplierId);
        await deleteDoc(supplierRef);
        console.log("Supplier deleted successfully.");
        // Redirect back to supplier list page after deletion
        displaySuccessMessage("Supplier deleted successfully. Redirecting...", 'generalErrorDisplay'); // Display message on main page
        setTimeout(() => {
            window.location.href = 'supplier_management.html';
        }, 2000); // Redirect after 2 seconds
        // Note: Associated data (POs, payments, adjustments) is NOT deleted here. Handle cleanup separately if needed.

    } catch (error) {
        console.error("Error deleting supplier:", error);
        displayError(`Failed to delete supplier: ${error.message}`, 'deleteError');
        // Re-enable button
        confirmBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Permanently';
         // Re-enable checkbox listener indirectly
         const checkbox = document.getElementById('confirmDeleteSupplierCheckbox');
         if (checkbox) checkbox.checked = false;
         confirmBtn.disabled = true; // Keep disabled until checkbox checked again
    }
}

// --- Data Refresh Logic ---
async function refreshSupplierData() {
     if (isRefreshingData) {
         console.log("Data refresh already in progress. Skipping.");
         return;
     }
     console.log("Refreshing all supplier page data...");
     isRefreshingData = true;
     const loadingIndicator = document.getElementById('pageLoadingIndicator'); // Assuming a page-level indicator exists
     if (loadingIndicator) loadingIndicator.style.display = 'flex';
     clearError('generalErrorDisplay');
     clearError('ledgerErrorDisplay'); // Clear specific error areas too

    try {
        if (!currentSupplierId) throw new Error("Supplier ID is missing.");

        // Fetch all data concurrently
        const [supplierData, pos, payments, adjustments] = await Promise.all([
            fetchSupplierDetails(currentSupplierId),
            fetchPurchaseOrders(currentSupplierId),
            fetchSupplierPayments(currentSupplierId),
            fetchSupplierAdjustments(currentSupplierId)
        ]);

        // Update UI
        displaySupplierDetails(supplierData);
        calculateAndDisplaySummary(pos, payments, adjustments);
        const ledger = buildLedgerEntries(pos, payments, adjustments);
        displayLedger(ledger);

        console.log("Data refresh complete.");

    } catch (error) {
        console.error("Error refreshing supplier data:", error);
        displayError(`Failed to load supplier details: ${error.message}`, 'generalErrorDisplay');
        // Optionally clear parts of the UI or show specific error messages
        document.getElementById('supplierAccountDetailContent').style.visibility = 'visible'; // Ensure content area is visible to show error
        document.getElementById('supplierNameHeader').textContent = 'Error Loading';

    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        isRefreshingData = false; // Release lock
    }
}

// --- Success Message ---
let successTimeout;
function displaySuccessMessage(message, elementId = 'generalErrorDisplay') {
    const successElement = document.getElementById(elementId);
    if (successElement) {
        successElement.textContent = message;
        successElement.style.display = 'block';
        successElement.classList.remove('error-message'); // Ensure it's not styled as error
        successElement.classList.add('success-message'); // Add success styling class (define in CSS)

        // Clear previous timeout if exists
        if (successTimeout) clearTimeout(successTimeout);

        // Automatically hide after 5 seconds
        successTimeout = setTimeout(() => {
            successElement.textContent = '';
            successElement.style.display = 'none';
             successElement.classList.remove('success-message');
        }, 5000);
    } else {
        console.log("Success:", message); // Fallback log
    }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    console.log("Setting up event listeners...");

    // Action Buttons
    document.getElementById('editSupplierBtn')?.addEventListener('click', openEditModal);
    document.getElementById('recordPaymentBtn')?.addEventListener('click', openRecordPaymentModal);
    document.getElementById('addAdjustmentBtn')?.addEventListener('click', openAddAdjustmentModal);
    document.getElementById('toggleStatusBtn')?.addEventListener('click', openToggleModal);
    document.getElementById('deleteSupplierBtn')?.addEventListener('click', openConfirmDeleteSupplierModal);

    // Modal Close Buttons
    document.getElementById('closeEditSupplierModal')?.addEventListener('click', () => closeModalById('editSupplierModal'));
    document.getElementById('cancelEditSupplier')?.addEventListener('click', () => closeModalById('editSupplierModal'));
    document.getElementById('closeRecordPaymentModal')?.addEventListener('click', () => closeModalById('recordPaymentModal'));
    document.getElementById('cancelPaymentBtn')?.addEventListener('click', () => closeModalById('recordPaymentModal'));
    document.getElementById('closeAdjustmentModal')?.addEventListener('click', () => closeModalById('addAdjustmentModal'));
    document.getElementById('cancelAdjustmentBtn')?.addEventListener('click', () => closeModalById('addAdjustmentModal'));
    document.getElementById('closeConfirmToggleModal')?.addEventListener('click', () => closeModalById('confirmToggleModal'));
    document.getElementById('cancelToggleBtn')?.addEventListener('click', () => closeModalById('confirmToggleModal'));
    document.getElementById('closeConfirmDeleteSupplierModal')?.addEventListener('click', () => closeModalById('confirmDeleteSupplierModal'));
    document.getElementById('cancelSupplierDeleteBtn')?.addEventListener('click', () => closeModalById('confirmDeleteSupplierModal'));

    // Modal Forms
    document.getElementById('editSupplierForm')?.addEventListener('submit', handleEditSupplierSubmit);
    document.getElementById('recordPaymentForm')?.addEventListener('submit', handleRecordPaymentSubmit);
    document.getElementById('addSupplierAdjustmentForm')?.addEventListener('submit', handleAddAdjustmentSubmit);

    // Confirmation Modal Buttons & Checkboxes
    const confirmToggleCheckbox = document.getElementById('confirmToggleCheckbox');
    const confirmToggleBtn = document.getElementById('confirmToggleBtn');
    confirmToggleCheckbox?.addEventListener('change', () => {
        if (confirmToggleBtn) confirmToggleBtn.disabled = !confirmToggleCheckbox.checked;
    });
    confirmToggleBtn?.addEventListener('click', handleToggleStatus);

    const confirmDeleteCheckbox = document.getElementById('confirmDeleteSupplierCheckbox');
    const confirmDeleteBtn = document.getElementById('confirmSupplierDeleteBtn');
    confirmDeleteCheckbox?.addEventListener('change', () => {
        if (confirmDeleteBtn) confirmDeleteBtn.disabled = !confirmDeleteCheckbox.checked;
    });
    confirmDeleteBtn?.addEventListener('click', handleDeleteSupplier);

     // Close modal if clicking outside the content area
     const modals = document.querySelectorAll('.modal');
     modals.forEach(modal => {
         modal.addEventListener('click', (event) => {
             // Check if the click is directly on the modal backdrop (the .modal element)
             if (event.target === modal) {
                 closeModalById(modal.id);
             }
         });
     });

    listenersAttached = true;
    console.log("Event listeners attached.");
}


// --- Initialization ---
function getSupplierIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

async function loadSupplierPageData() {
     // Called by initializeSupplierDetailPage after listeners are set
     console.log("loadSupplierPageData called.");
     const pageLoadingIndicator = document.getElementById('pageLoadingIndicator');
     const ledgerLoadingIndicator = document.getElementById('ledgerLoadingIndicator');

     // Show loading indicators
     if (pageLoadingIndicator) pageLoadingIndicator.style.display = 'flex';
     if (ledgerLoadingIndicator) ledgerLoadingIndicator.style.display = 'block'; // Use block for table message
     document.getElementById('accountLedgerTableBody').innerHTML = ''; // Clear ledger while loading
     if (document.getElementById('ledgerEmptyMessage')) document.getElementById('ledgerEmptyMessage').style.display = 'none';


     await refreshSupplierData(); // Use the main refresh function

     // Hide loading indicators (handled within refreshSupplierData's finally block)
}


// --- Main Exported Function ---
// This function is called by the inline script in supplier_account_detail.html AFTER auth is confirmed
export function initializeSupplierDetailPage() {
    console.log("initializeSupplierDetailPage called.");

    if (supplierDetailPageInitialized) {
        console.log("Supplier detail page already initialized. Skipping.");
        // Optionally trigger a data refresh if needed on re-visit?
        // refreshSupplierData();
        return;
    }

     currentSupplierId = getSupplierIdFromUrl();
    if (!currentSupplierId) {
        displayError("No supplier ID found in URL. Cannot load details.");
        document.getElementById('pageLoadingIndicator').style.display = 'none'; // Hide loading
        // Consider redirecting or showing a more permanent error message
        document.getElementById('supplierAccountDetailContent').innerHTML = `<div class="error-message-area" style="display:block; text-align: center; padding: 20px;">Invalid Request: Supplier ID is missing. <a href="supplier_management.html">Go back to list</a>.</div>`;
        document.getElementById('supplierAccountDetailContent').style.visibility = 'visible';
        return;
    }
    console.log("Initializing page for supplier ID:", currentSupplierId);

     const mainContent = document.getElementById('supplierAccountDetailContent');
     if (mainContent) { mainContent.style.visibility = 'visible'; }
     else { console.error("Critical: Main content container missing!"); displayError("Page layout structure is broken."); return; }

     supplierDetailPageInitialized = true;
     clearError();

     // Setup listeners ONCE upon initialization
     if (!listenersAttached) {
         setupEventListeners();
     }

     // Load data (assuming auth is already confirmed by the time this runs)
     // The inline script in HTML <head> should handle Auth check and call this
     console.log("Triggering initial data load (assuming user is authenticated)...");
     loadSupplierPageData(); // Load all data including ledger, summary etc.

};

// Trigger initialization based on DOM readiness (Auth check in HTML will call the function)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log("DOMContentLoaded fired. Initialization will be triggered by Auth script in <head>.");
        // attemptInitialization(); // Let Auth script call initializeSupplierDetailPage
    });
} else {
    console.log("DOM already loaded. Initialization will be triggered by Auth script in <head>.");
    // attemptInitialization(); // Let Auth script call initializeSupplierDetailPage
}

console.log("supplier_account_detail.js (v8 - Theming) script loaded.");