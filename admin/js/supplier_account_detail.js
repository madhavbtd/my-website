// js/supplier_account_detail.js - v7 (Merged Customer Features + Supplier Logic)
// Updated to use classList.add/remove('active') for modals

// --- Firebase Imports ---\
// Ensure ALL necessary functions are imported or globally available via firebase-init.js
import { db, auth } from './firebase-init.js';
import {
    doc, getDoc, collection, query, where, getDocs, orderBy as firestoreOrderBy, // Renamed orderBy
    Timestamp, addDoc, serverTimestamp, updateDoc, deleteDoc, runTransaction, writeBatch
    // arrayUnion might be needed if status history is implemented for suppliers
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Global State ---\
let currentSupplierId = null;
let currentSupplierData = null;
let purchaseOrdersData = [];
let supplierPaymentsData = [];
let supplierAdjustmentsData = []; // Store adjustments
let listenersAttached = false;
let supplierDetailPageInitialized = false;
let isRefreshingData = false; // Flag to prevent concurrent refreshes

// --- DOM Elements --- (Get elements once)
const supplierNameHeader = document.getElementById('supp-detail-name-header');
const supplierNameBreadcrumb = document.getElementById('supp-detail-name-breadcrumb');
const editSupplierBtn = document.getElementById('editSupplierBtn');
const addPaymentBtn = document.getElementById('addPaymentBtn');
const addAdjustmentBtn = document.getElementById('addAdjustmentBtn');
const addNewPOBtn = document.getElementById('addNewPOBtn');
const toggleStatusBtn = document.getElementById('toggleStatusBtn');
const toggleStatusBtnText = toggleStatusBtn ? toggleStatusBtn.querySelector('span') : null;
const deleteSupplierBtn = document.getElementById('deleteSupplierBtn');

// Info Box Elements
const detailId = document.getElementById('supp-detail-id');
const detailName = document.getElementById('supp-detail-name'); // Assuming there's an element for name in details
const detailGstin = document.getElementById('supp-detail-gstin');
const detailWhatsapp = document.getElementById('supp-detail-whatsapp');
const detailContact = document.getElementById('supp-detail-contact');
const detailEmail = document.getElementById('supp-detail-email');
const detailAddress = document.getElementById('supp-detail-address');
const detailCity = document.getElementById('supp-detail-city');
const detailState = document.getElementById('supp-detail-state');
const detailStatus = document.getElementById('supp-detail-status');
const detailNotes = document.getElementById('supp-detail-notes');

// Account Summary Elements
const summaryTotalPOs = document.getElementById('summary-total-pos');
const summaryTotalPaid = document.getElementById('summary-total-paid');
const summaryBalance = document.getElementById('summary-balance');

// Table Bodies
const purchaseOrderTableBody = document.getElementById('supplierPOTableBody'); // Corrected ID based on HTML snippet? Check your HTML
const accountLedgerTableBody = document.getElementById('supplierAccountLedgerTableBody');

// Modal Elements
const editSupplierModal = document.getElementById('editSupplierModal');
const addPaymentModal = document.getElementById('addPaymentModal');
const addAdjustmentModal = document.getElementById('addAdjustmentModal');
const confirmToggleStatusModal = document.getElementById('confirmToggleStatusModal');
const confirmDeleteSupplierModal = document.getElementById('confirmDeleteSupplierModal');

// Edit Supplier Modal Form Elements
const editSupplierForm = document.getElementById('editSupplierForm');
const editSupplierIdInput = document.getElementById('editSupplierId'); // Assuming hidden input for ID
const editSupplierNameInput = document.getElementById('supplierEditName');
const editSupplierGstinInput = document.getElementById('supplierEditGstin');
const editSupplierWhatsappInput = document.getElementById('supplierEditWhatsApp');
const editSupplierContactInput = document.getElementById('supplierEditContact');
const editSupplierEmailInput = document.getElementById('supplierEditEmail');
const editSupplierAddressInput = document.getElementById('supplierEditAddress');
const editSupplierCityInput = document.getElementById('supplierEditCity');
const editSupplierStateInput = document.getElementById('supplierEditState');
const editSupplierNotesInput = document.getElementById('supplierEditNotes');
const updateSupplierBtn = document.getElementById('updateSupplierBtn');
const cancelSupplierEditBtn = document.getElementById('cancelSupplierEditBtn');
const closeSupplierEditModalBtn = document.getElementById('closeSupplierEditModal');

// Add Payment Modal Form Elements
const addPaymentForm = document.getElementById('addPaymentForm');
const paymentModalSuppName = document.getElementById('payment-modal-supp-name');
const paymentAmountInput = document.getElementById('paymentAmount');
const paymentDateInput = document.getElementById('paymentDate');
const paymentMethodInput = document.getElementById('paymentMethod');
const paymentNotesInput = document.getElementById('paymentNotes');
const savePaymentBtn = document.getElementById('savePaymentBtn');
const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
const closePaymentModalBtn = document.getElementById('closePaymentModal');
const paymentErrorDisplay = document.getElementById('paymentErrorDisplay'); // Specific error display

// Add Adjustment Modal Form Elements
const addAdjustmentForm = document.getElementById('addAdjustmentForm');
const adjustmentModalSuppName = document.getElementById('adjustment-modal-supp-name');
const adjustmentTypeDebitRadio = document.getElementById('adjustmentTypeDebit');
const adjustmentTypeCreditRadio = document.getElementById('adjustmentTypeCredit');
const adjustmentAmountInput = document.getElementById('adjustmentAmount');
const adjustmentDateInput = document.getElementById('adjustmentDate');
const adjustmentRemarksInput = document.getElementById('adjustmentRemarks');
const saveAdjustmentBtn = document.getElementById('saveAdjustmentBtn');
const cancelAdjustmentBtn = document.getElementById('cancelAdjustmentBtn');
const closeAdjustmentModalBtn = document.getElementById('closeAdjustmentModal');
const adjustmentErrorDisplay = document.getElementById('adjustmentErrorDisplay');

// Confirm Toggle Status Modal Elements
const toggleActionText = document.getElementById('toggleActionText');
const toggleSupplierName = document.getElementById('toggleSupplierName');
const toggleWarningMessage = document.getElementById('toggleWarningMessage'); // Assuming exists
const confirmToggleCheckbox = document.getElementById('confirmToggleCheckbox');
const toggleCheckboxLabel = document.getElementById('toggleCheckboxLabel'); // Assuming exists
const cancelToggleBtn = document.getElementById('cancelToggleBtn');
const confirmToggleBtn = document.getElementById('confirmToggleBtn');
const confirmToggleBtnText = document.getElementById('confirmToggleBtnText');
const closeConfirmToggleModalBtn = document.getElementById('closeConfirmToggleModal');

// Confirm Delete Modal Elements
const deleteSupplierName = document.getElementById('deleteSupplierName');
const confirmDeleteSupplierCheckbox = document.getElementById('confirmDeleteSupplierCheckbox');
const cancelSupplierDeleteBtn = document.getElementById('cancelSupplierDeleteBtn');
const confirmSupplierDeleteBtn = document.getElementById('confirmSupplierDeleteBtn');
const closeConfirmDeleteSupplierModalBtn = document.getElementById('closeConfirmDeleteSupplierModal');

// Error Display
const generalErrorDisplay = document.getElementById('generalErrorDisplay');


// --- Helper Functions ---\
function displayError(message, elementId = 'generalErrorDisplay') {
    console.error("Displaying Error:", message, "Target Element ID:", elementId);
    try {
        let errorElement = document.getElementById(elementId);
        if (!errorElement && elementId !== 'generalErrorDisplay') {
             // Fallback to general display if specific one not found (except for itself)
            errorElement = document.getElementById('generalErrorDisplay');
        }

        if (errorElement) {
            errorElement.innerHTML = ''; // Clear previous errors in this container
            if (message) {
                 const p = document.createElement('p');
                 p.textContent = message;
                 errorElement.appendChild(p);
                 errorElement.style.display = 'block'; // Show the error container
                 console.log("Error displayed in:", elementId);
            } else {
                errorElement.style.display = 'none'; // Hide if message is empty/null
                console.log("Hiding error display:", elementId);
            }
        } else {
            console.error(`Error display element with ID '${elementId}' not found.`);
            // Fallback to alert if even generalErrorDisplay is missing
            if (message && elementId !== 'generalErrorDisplay') { // Avoid alert loops
                 alert("Error: " + message + "\n(Error display area missing)");
            }
        }
    } catch (e) {
        console.error("Error in displayError function itself:", e);
        // Ultimate fallback
        if (message) {
            alert("Critical Error: " + message);
        }
    }
}


function clearError(elementId = 'generalErrorDisplay') {
    displayError(null, elementId); // Call displayError with null message to hide it
    // Also clear specific modal errors when clearing general
    if (elementId === 'generalErrorDisplay') {
        displayError(null, 'paymentErrorDisplay');
        displayError(null, 'adjustmentErrorDisplay');
        // Add others if needed
    }
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    // Check if it's a Firebase Timestamp object
    if (timestamp.toDate) {
        return timestamp.toDate().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    // Check if it's a date string or number (milliseconds)
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) { // Invalid date
             return 'Invalid Date';
        }
        return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
        return 'Invalid Date';
    }
}

function formatCurrency(amount) {
     if (amount === null || amount === undefined || isNaN(amount)) {
        return '₹ 0.00';
     }
     // Use Intl.NumberFormat for proper formatting
     return new Intl.NumberFormat('en-IN', {
         style: 'currency',
         currency: 'INR',
         minimumFractionDigits: 2,
         maximumFractionDigits: 2
     }).format(amount);
}

function showLoading(element, message = "Loading...", colspan = 5) {
    if (element) {
        element.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center; padding: 20px; color: #6c757d;"><i class="fas fa-spinner fa-spin"></i> ${message}</td></tr>`;
    }
}

function disableActions(disabled = true) {
    const buttons = [editSupplierBtn, addPaymentBtn, addAdjustmentBtn, addNewPOBtn, toggleStatusBtn, deleteSupplierBtn];
    buttons.forEach(btn => {
        if (btn) btn.disabled = disabled;
    });
    if (addNewPOBtn) { // Handle link styled as button
        if(disabled) addNewPOBtn.classList.add('disabled');
        else addNewPOBtn.classList.remove('disabled');
    }
}

function resetForm(formElement) {
    if (formElement) {
        formElement.reset();
        // Clear any specific error messages within the form's modal
        const errorDisplayId = formElement.id + 'ErrorDisplay'; // Convention like 'addPaymentFormErrorDisplay'
        const errorElement = formElement.querySelector(`#${errorDisplayId}, .modal-error-display`); // Find error display by ID or class
        if (errorElement) {
             displayError(null, errorElement.id); // Clear using helper function
        } else {
            // Try clearing common error IDs if specific one not found
            if (formElement.id === 'addPaymentForm') displayError(null, 'paymentErrorDisplay');
            if (formElement.id === 'addAdjustmentForm') displayError(null, 'adjustmentErrorDisplay');
            // Add others if needed
        }
    }
}

// --- Data Loading Functions ---
async function loadSupplierDetails(supplierId) {
    if (!supplierId) return null;
    console.log(`Loading details for supplier ID: ${supplierId}`);
    const supplierDocRef = doc(db, "suppliers", supplierId);
    try {
        const docSnap = await getDoc(supplierDocRef);
        if (docSnap.exists()) {
            currentSupplierData = { id: docSnap.id, ...docSnap.data() };
            console.log("Supplier data loaded:", currentSupplierData);
            return currentSupplierData;
        } else {
            console.error("No supplier found with ID:", supplierId);
            displayError(`Supplier not found (ID: ${supplierId}). Please go back to the supplier list.`);
            disableActions(true); // Disable all actions if supplier not found
            return null;
        }
    } catch (error) {
        console.error("Error loading supplier details:", error);
        displayError("Failed to load supplier details. Please check your connection and try again.");
        disableActions(true);
        return null;
    }
}

async function loadPurchaseOrders(supplierId) {
    if (!supplierId) return [];
    console.log(`Loading POs for supplier ID: ${supplierId}`);
    const ordersColRef = collection(db, "purchaseOrders");
    // Query orders where supplierRef matches the document reference
    const supplierDocRef = doc(db, "suppliers", supplierId);
    const q = query(ordersColRef, where("supplierRef", "==", supplierDocRef), firestoreOrderBy("poDate", "desc")); // Order by date descending

    purchaseOrdersData = []; // Reset
    try {
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            purchaseOrdersData.push({ id: doc.id, ...doc.data() });
        });
        console.log("Purchase Orders loaded:", purchaseOrdersData);
        return purchaseOrdersData;
    } catch (error) {
        console.error("Error loading purchase orders:", error);
        displayError("Failed to load purchase order history.");
        return []; // Return empty array on error
    }
}

async function loadSupplierPayments(supplierId) {
    if (!supplierId) return [];
    console.log(`Loading Payments for supplier ID: ${supplierId}`);
    const paymentsColRef = collection(db, "supplierPayments");
    const supplierDocRef = doc(db, "suppliers", supplierId);
    const q = query(paymentsColRef, where("supplierRef", "==", supplierDocRef), firestoreOrderBy("paymentDate", "desc")); // Order by date descending

    supplierPaymentsData = []; // Reset
    try {
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            supplierPaymentsData.push({ id: doc.id, ...doc.data(), type: 'Payment' }); // Add type for ledger
        });
        console.log("Supplier Payments loaded:", supplierPaymentsData);
        return supplierPaymentsData;
    } catch (error) {
        console.error("Error loading supplier payments:", error);
        displayError("Failed to load payment history.");
        return [];
    }
}

async function loadSupplierAdjustments(supplierId) {
    if (!supplierId) return [];
    console.log(`Loading Adjustments for supplier ID: ${supplierId}`);
    const adjustmentsColRef = collection(db, "supplierAdjustments"); // Separate collection
    const supplierDocRef = doc(db, "suppliers", supplierId);
    const q = query(adjustmentsColRef, where("supplierRef", "==", supplierDocRef), firestoreOrderBy("adjustmentDate", "desc"));

    supplierAdjustmentsData = []; // Reset
    try {
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            supplierAdjustmentsData.push({ id: doc.id, ...doc.data(), type: 'Adjustment' }); // Add type for ledger
        });
        console.log("Supplier Adjustments loaded:", supplierAdjustmentsData);
        return supplierAdjustmentsData;
    } catch (error) {
        console.error("Error loading supplier adjustments:", error);
        displayError("Failed to load adjustment history.");
        return [];
    }
}


// --- UI Rendering Functions ---
function populateSupplierDetails(data) {
    if (!data) {
        console.error("Cannot populate details: No data provided.");
        return;
    }
    if (supplierNameHeader) supplierNameHeader.textContent = data.name || 'N/A';
    if (supplierNameBreadcrumb) supplierNameBreadcrumb.textContent = data.name || 'Details';

    if (detailId) detailId.textContent = data.id || 'N/A';
    if (detailName) detailName.textContent = data.name || 'N/A'; // Populate name in details section too
    if (detailGstin) detailGstin.textContent = data.gstin || 'N/A';
    if (detailWhatsapp) detailWhatsapp.textContent = data.whatsapp || 'N/A';
    if (detailContact) detailContact.textContent = data.contact || 'N/A';
    if (detailEmail) detailEmail.textContent = data.email || 'N/A';
    if (detailAddress) detailAddress.textContent = data.address || 'N/A';
    if (detailCity) detailCity.textContent = data.city || 'N/A';
    if (detailState) detailState.textContent = data.state || 'N/A';
    if (detailNotes) detailNotes.textContent = data.notes || 'No remarks entered.';

    // Status Badge
    if (detailStatus) {
        const isActive = data.status === 'active';
        detailStatus.textContent = isActive ? 'Active' : 'Inactive';
        detailStatus.className = 'status-badge'; // Reset classes
        detailStatus.classList.add(isActive ? 'status-active' : 'status-inactive');
    }

    // Toggle Button Update
    if (toggleStatusBtn && toggleStatusBtnText) {
         const isActive = data.status === 'active';
         toggleStatusBtnText.textContent = isActive ? 'Disable Account' : 'Enable Account';
         // Add appropriate icon class if needed (e.g., using font awesome)
         const icon = toggleStatusBtn.querySelector('i');
         if (icon) {
             icon.className = isActive ? 'fas fa-toggle-off' : 'fas fa-toggle-on';
         }
          // Set button appearance based on action (Disable = warning, Enable = success)
         toggleStatusBtn.classList.remove('success-button', 'secondary-button'); // Use secondary for inactive state matching customer pg
         toggleStatusBtn.classList.add(isActive ? 'secondary-button' : 'success-button'); // Use secondary-button class for 'Disable' action
    }

    // Enable/Disable Add New PO Button based on status
    if (addNewPOBtn) {
        if (data.status === 'active') {
            addNewPOBtn.classList.remove('disabled');
            addNewPOBtn.href = `add_purchase_order.html?supplierId=${data.id}`; // Update link dynamically
        } else {
            addNewPOBtn.classList.add('disabled');
            addNewPOBtn.href = '#'; // Disable link
        }
    }
}

function populatePurchaseOrders(orders) {
     if (!purchaseOrderTableBody) return; // Check if table body exists
    showLoading(purchaseOrderTableBody, "Loading Purchase Orders...", 5); // Show loading initially

    if (!orders || orders.length === 0) {
        purchaseOrderTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 15px;">No purchase orders found for this supplier.</td></tr>';
        return;
    }

    let tableHTML = '';
    orders.forEach(order => {
        const poDate = order.poDate ? formatDate(order.poDate) : 'N/A';
        const itemsSummary = order.items && order.items.length > 0
            ? order.items.map(item => `${item.itemName} (Qty: ${item.quantity || 'N/A'})`).join(', ')
            : 'No items listed';
        const totalAmount = formatCurrency(order.totalAmount);
        const status = order.status || 'Unknown'; // Add status if available in your PO data

        tableHTML += `
            <tr class="po-row-clickable" data-po-id="${order.id}" title="Click to view/edit PO">
                <td>${order.poNumber || order.id}</td>
                <td>${poDate}</td>
                <td>${itemsSummary}</td>
                <td>${totalAmount}</td>
                <td><span class="status-badge status-${status.toLowerCase().replace(/\s+/g, '-')}">${status}</span></td>
            </tr>
        `;
    });
    purchaseOrderTableBody.innerHTML = tableHTML;

    // Add event listeners for clickable rows
    purchaseOrderTableBody.querySelectorAll('.po-row-clickable').forEach(row => {
        row.addEventListener('click', () => {
            const poId = row.dataset.poId;
            if (poId) {
                // Redirect to the PO edit page (adjust URL as needed)
                window.location.href = `edit_purchase_order.html?poId=${poId}`;
            }
        });
    });
}


function calculateAccountSummary(orders, payments, adjustments) {
    let totalPOValue = 0;
    let totalPaid = 0;
    let totalAdjustmentDebit = 0; // Amount to increase payable
    let totalAdjustmentCredit = 0; // Amount to decrease payable (or increase advance)

    orders.forEach(order => {
        totalPOValue += (order.totalAmount || 0);
    });

    payments.forEach(payment => {
        totalPaid += (payment.amount || 0);
    });

     adjustments.forEach(adj => {
        if (adj.type === 'debit') { // Debit adjustment increases amount payable
             totalAdjustmentDebit += (adj.amount || 0);
        } else if (adj.type === 'credit') { // Credit adjustment decreases amount payable
             totalAdjustmentCredit += (adj.amount || 0);
        }
    });


    // Balance Calculation:
    // Positive balance means Advance Paid (Credit)
    // Negative balance means Amount Payable (Debit)
    // Balance = Total Paid + Credit Adjustments - Total PO Value - Debit Adjustments
    const balance = (totalPaid + totalAdjustmentCredit) - (totalPOValue + totalAdjustmentDebit);

    return {
        totalPOValue,
        totalPaid,
        totalAdjustments: totalAdjustmentDebit - totalAdjustmentCredit, // Net adjustment effect on balance
        balance
    };
}


function populateAccountSummary(summary) {
    if (!summary) return;

    if (summaryTotalPOs) summaryTotalPOs.textContent = formatCurrency(summary.totalPOValue);
    if (summaryTotalPaid) summaryTotalPaid.textContent = formatCurrency(summary.totalPaid);

    if (summaryBalance) {
        const balanceValue = summary.balance;
        summaryBalance.textContent = formatCurrency(Math.abs(balanceValue)); // Show absolute value
        summaryBalance.className = ''; // Reset class

        if (balanceValue > 0) {
            summaryBalance.classList.add('balance-advance'); // Positive balance = Advance
            summaryBalance.title = "Advance Paid to Supplier";
        } else if (balanceValue < 0) {
            summaryBalance.classList.add('balance-payable'); // Negative balance = Payable
             summaryBalance.title = "Amount Payable to Supplier";
        } else {
            summaryBalance.classList.add('balance-info'); // Zero balance
            summaryBalance.title = "Settled";
        }
    }
}

function populateAccountLedger(orders, payments, adjustments) {
    if (!accountLedgerTableBody) return;
    showLoading(accountLedgerTableBody, "Loading Ledger...", 5);

    // Combine all transactions
    let ledgerEntries = [];

    orders.forEach(order => {
        ledgerEntries.push({
            date: order.poDate,
            description: `Purchase Order #${order.poNumber || order.id}`,
            debit: order.totalAmount || 0,
            credit: 0,
            type: 'PO'
        });
    });

    payments.forEach(payment => {
        ledgerEntries.push({
            date: payment.paymentDate,
            description: `Payment Received (${payment.paymentMethod || 'N/A'})${payment.notes ? ' - ' + payment.notes : ''}`,
            debit: 0,
            credit: payment.amount || 0,
            type: 'Payment'
        });
    });

    adjustments.forEach(adj => {
         let description = `Adjustment (${adj.remarks || 'No Remarks'})`;
         let debit = 0;
         let credit = 0;
         if (adj.type === 'debit') {
             debit = adj.amount || 0;
             description = `Debit Adj: ${adj.remarks || 'Increase Payable'}`;
         } else { // Credit adjustment
             credit = adj.amount || 0;
              description = `Credit Adj: ${adj.remarks || 'Decrease Payable / Advance'}`;
         }
         ledgerEntries.push({
            date: adj.adjustmentDate,
            description: description,
            debit: debit,
            credit: credit,
            type: 'Adjustment'
        });
    });


    // Sort combined entries by date (ascending for running balance calculation)
    ledgerEntries.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
         // Handle invalid dates if necessary
         if (isNaN(dateA.getTime())) return 1; // Push invalid dates to the end
         if (isNaN(dateB.getTime())) return -1;
        return dateA - dateB;
    });

    // Calculate running balance and build table HTML
    let runningBalance = 0;
    let tableHTML = '';

    if (ledgerEntries.length === 0) {
         accountLedgerTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 15px;">No transactions found for ledger.</td></tr>';
         return;
    }


    ledgerEntries.forEach(entry => {
        // Balance = Previous Balance + Credit - Debit
        runningBalance += (entry.credit - entry.debit);

        let balanceClass = 'ledger-balance-zero';
        if (runningBalance < 0) { // Payable (Debit balance from supplier perspective)
            balanceClass = 'ledger-balance-negative'; // Use negative class for payable
        } else if (runningBalance > 0) { // Advance (Credit balance)
            balanceClass = 'ledger-balance-positive'; // Use positive class for advance
        }

        tableHTML += `
            <tr>
                <td>${formatDate(entry.date)}</td>
                <td>${entry.description}</td>
                <td style="text-align: right;">${formatCurrency(entry.debit)}</td>
                <td style="text-align: right;">${formatCurrency(entry.credit)}</td>
                <td style="text-align: right;" class="${balanceClass}">${formatCurrency(Math.abs(runningBalance))}${runningBalance < 0 ? ' Dr' : (runningBalance > 0 ? ' Cr' : '')}</td>
            </tr>
        `;
    });

    accountLedgerTableBody.innerHTML = tableHTML;
}


// --- Modal Handling ---
function openModal(modalElement) {
    if (modalElement) {
        clearError(); // Clear general errors when opening any modal
        // Changed: Use classList.add instead of style.display
        modalElement.classList.add('active');
        console.log(`Modal opened: ${modalElement.id}`);
    } else {
         console.error("Attempted to open a non-existent modal element.");
    }
}

function closeModal(modalElement) {
    if (modalElement) {
         // Changed: Use classList.remove instead of style.display
         modalElement.classList.remove('active');
         console.log(`Modal closed: ${modalElement.id}`);
         // Optionally reset form inside the modal when closing
         const form = modalElement.querySelector('form');
         if (form) {
             resetForm(form);
         }
         // Clear specific modal errors on close
         if (modalElement.id === 'addPaymentModal') clearError('paymentErrorDisplay');
         if (modalElement.id === 'addAdjustmentModal') clearError('adjustmentErrorDisplay');
         // Reset confirmation checkboxes etc.
         if (modalElement.id === 'confirmToggleStatusModal' && confirmToggleCheckbox) confirmToggleCheckbox.checked = false;
         if (modalElement.id === 'confirmDeleteSupplierModal' && confirmDeleteSupplierCheckbox) confirmDeleteSupplierCheckbox.checked = false;
         // Re-enable confirmation buttons that might have been disabled
         if (confirmToggleBtn) confirmToggleBtn.disabled = true; // Should be disabled until checkbox checked
         if (confirmSupplierDeleteBtn) confirmSupplierDeleteBtn.disabled = true; // Should be disabled until checkbox checked

    } else {
        console.error("Attempted to close a non-existent modal element.");
    }
}

// Edit Supplier Modal
function openEditModal() {
    if (!currentSupplierData) {
        displayError("Supplier data not loaded. Cannot open edit modal.");
        return;
    }
    // Populate form
    if (editSupplierIdInput) editSupplierIdInput.value = currentSupplierData.id; // Populate hidden ID field if exists
    if (editSupplierNameInput) editSupplierNameInput.value = currentSupplierData.name || '';
    if (editSupplierGstinInput) editSupplierGstinInput.value = currentSupplierData.gstin || '';
    if (editSupplierWhatsappInput) editSupplierWhatsappInput.value = currentSupplierData.whatsapp || '';
    if (editSupplierContactInput) editSupplierContactInput.value = currentSupplierData.contact || '';
    if (editSupplierEmailInput) editSupplierEmailInput.value = currentSupplierData.email || '';
    if (editSupplierAddressInput) editSupplierAddressInput.value = currentSupplierData.address || '';
    if (editSupplierCityInput) editSupplierCityInput.value = currentSupplierData.city || '';
    if (editSupplierStateInput) editSupplierStateInput.value = currentSupplierData.state || '';
    if (editSupplierNotesInput) editSupplierNotesInput.value = currentSupplierData.notes || '';

    openModal(editSupplierModal);
}

// Add Payment Modal
function openAddPaymentModal() {
     if (!currentSupplierData) {
        displayError("Supplier data not loaded. Cannot open payment modal.");
        return;
    }
    if(paymentModalSuppName) paymentModalSuppName.textContent = currentSupplierData.name || 'Supplier';
    // Set default date to today
    if (paymentDateInput) {
        paymentDateInput.valueAsDate = new Date();
    }
    // Clear previous amount/notes and errors
    if(paymentAmountInput) paymentAmountInput.value = '';
    if(paymentNotesInput) paymentNotesInput.value = '';
    displayError(null, 'paymentErrorDisplay'); // Clear specific payment errors

    openModal(addPaymentModal);
}

// Add Adjustment Modal
function openAddAdjustmentModal() {
     if (!currentSupplierData) {
        displayError("Supplier data not loaded. Cannot open adjustment modal.");
        return;
    }
     if(adjustmentModalSuppName) adjustmentModalSuppName.textContent = currentSupplierData.name || 'Supplier';
     // Set default date to today
     if (adjustmentDateInput) {
        adjustmentDateInput.valueAsDate = new Date();
    }
     // Clear previous amount/remarks and errors
     if(adjustmentAmountInput) adjustmentAmountInput.value = '';
     if(adjustmentRemarksInput) adjustmentRemarksInput.value = '';
     if(adjustmentTypeDebitRadio) adjustmentTypeDebitRadio.checked = true; // Default to Debit
     displayError(null, 'adjustmentErrorDisplay'); // Clear specific adjustment errors

    openModal(addAdjustmentModal);
}

// Confirm Toggle Status Modal
function openToggleConfirmModal() {
    if (!currentSupplierData) {
        displayError("Supplier data not loaded. Cannot open toggle confirmation.");
        return;
    }
    const isActive = currentSupplierData.status === 'active';
    const action = isActive ? 'Disable' : 'Enable';
    const buttonClass = isActive ? 'warning-button' : 'success-button'; // Use warning for Disable action

    if(toggleActionText) toggleActionText.textContent = action.toLowerCase();
    if(toggleSupplierName) toggleSupplierName.textContent = currentSupplierData.name || 'this supplier';
    if(toggleCheckboxLabel) toggleCheckboxLabel.textContent = `I understand and want to ${action.toLowerCase()} this supplier's account.`;

     // Show warning only when disabling
     if (toggleWarningMessage) {
        toggleWarningMessage.textContent = isActive ? "Disabling the account might restrict creating new Purchase Orders." : "";
        toggleWarningMessage.style.display = isActive ? 'block' : 'none';
    }

     // Reset checkbox and button state
     if (confirmToggleCheckbox) confirmToggleCheckbox.checked = false;
     if (confirmToggleBtn) {
        confirmToggleBtn.disabled = true;
        confirmToggleBtn.className = `button ${buttonClass}`; // Apply class for color
        confirmToggleBtn.querySelector('i').className = isActive ? 'fas fa-user-slash' : 'fas fa-user-check'; // Example icons
     }
     if(confirmToggleBtnText) confirmToggleBtnText.textContent = `Confirm ${action}`;


    openModal(confirmToggleStatusModal);
}

// Confirm Delete Modal
function openDeleteConfirmModal() {
    if (!currentSupplierData) {
        displayError("Supplier data not loaded. Cannot open delete confirmation.");
        return;
    }
    if(deleteSupplierName) deleteSupplierName.textContent = currentSupplierData.name || 'this supplier';
     // Reset checkbox and button state
     if (confirmDeleteSupplierCheckbox) confirmDeleteSupplierCheckbox.checked = false;
     if (confirmSupplierDeleteBtn) confirmSupplierDeleteBtn.disabled = true;

    openModal(confirmDeleteSupplierModal);
}

// --- Event Handlers ---

// Edit Supplier Form Submission
async function handleUpdateSupplier(event) {
    event.preventDefault();
    clearError();
    if (!currentSupplierData) {
        displayError("Cannot update: Supplier data is missing.");
        return;
    }
    if (!editSupplierForm) return;

    const supplierId = currentSupplierData.id; // Get ID from current data
    const supplierDocRef = doc(db, "suppliers", supplierId);

    // Get updated data from form
    const updatedData = {
        name: editSupplierNameInput.value.trim(),
        gstin: editSupplierGstinInput.value.trim(),
        whatsapp: editSupplierWhatsappInput.value.trim(),
        contact: editSupplierContactInput.value.trim(),
        email: editSupplierEmailInput.value.trim(),
        address: editSupplierAddressInput.value.trim(),
        city: editSupplierCityInput.value.trim(),
        state: editSupplierStateInput.value.trim(),
        notes: editSupplierNotesInput.value.trim(),
        // status is handled by toggle action
        lastModified: serverTimestamp() // Update timestamp
    };

    // Basic Validation
    if (!updatedData.name || !updatedData.whatsapp) {
        displayError("Supplier Name and WhatsApp number are required.", 'editSupplierErrorDisplay'); // Assuming an error display element exists in edit modal
        return;
    }

    if (updateSupplierBtn) updateSupplierBtn.disabled = true;
    try {
        await updateDoc(supplierDocRef, updatedData);
        console.log("Supplier updated successfully.");
        closeModal(editSupplierModal);
        await loadSupplierPageData(); // Refresh page data
        // Optional: Show success message briefly
    } catch (error) {
        console.error("Error updating supplier:", error);
        displayError(`Failed to update supplier: ${error.message}`, 'editSupplierErrorDisplay');
    } finally {
        if (updateSupplierBtn) updateSupplierBtn.disabled = false;
    }
}

// Add Payment Form Submission
async function handleAddPayment(event) {
    event.preventDefault();
    clearError('paymentErrorDisplay'); // Clear specific error area
    if (!currentSupplierData) {
        displayError("Supplier data missing.", 'paymentErrorDisplay');
        return;
    }
    if (!addPaymentForm) return;

    const amount = parseFloat(paymentAmountInput.value);
    const paymentDateStr = paymentDateInput.value; // Get date as string "YYYY-MM-DD"

    // Validation
    if (isNaN(amount) || amount <= 0) {
        displayError("Please enter a valid positive payment amount.", 'paymentErrorDisplay');
        return;
    }
    if (!paymentDateStr) {
        displayError("Please select a payment date.", 'paymentErrorDisplay');
        return;
    }

    // Convert date string to Firebase Timestamp
    let paymentTimestamp;
    try {
         // Important: Create date object carefully to avoid timezone issues if possible
         // Assuming the input YYYY-MM-DD represents the start of that day in local time
        const dateParts = paymentDateStr.split('-');
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
        const day = parseInt(dateParts[2], 10);
        const localDate = new Date(year, month, day);
        paymentTimestamp = Timestamp.fromDate(localDate);
        if (isNaN(paymentTimestamp.seconds)) throw new Error("Invalid date created"); // Validate
    } catch (e) {
        console.error("Date conversion error:", e);
        displayError("Invalid payment date selected.", 'paymentErrorDisplay');
        return;
    }


    const paymentData = {
        supplierId: currentSupplierData.id,
        supplierRef: doc(db, "suppliers", currentSupplierData.id), // Add reference
        supplierName: currentSupplierData.name,
        amount: amount,
        paymentDate: paymentTimestamp, // Use Timestamp
        paymentMethod: paymentMethodInput.value,
        notes: paymentNotesInput.value.trim(),
        recordedAt: serverTimestamp()
    };

    if (savePaymentBtn) savePaymentBtn.disabled = true;
    try {
        // --- Transaction to add payment and update supplier balance ---
        await runTransaction(db, async (transaction) => {
            // 1. Add the payment document
            const paymentsColRef = collection(db, "supplierPayments");
            transaction.set(doc(paymentsColRef), paymentData); // Let Firestore generate ID

             // 2. Update supplier's summary (if you store summary fields directly)
             //    OR rely on recalculation from ledger entries (preferred)
             //    Example if storing summary:
             /*
             const supplierDocRef = doc(db, "suppliers", currentSupplierData.id);
             const supplierDoc = await transaction.get(supplierDocRef);
             if (!supplierDoc.exists()) { throw new Error("Supplier not found during transaction."); }
             const currentSummary = supplierDoc.data().accountSummary || { totalPaid: 0, balance: 0 }; // Example structure
             const newTotalPaid = (currentSummary.totalPaid || 0) + amount;
             // Recalculate balance based on ALL data or update incrementally
             // This part is complex and prone to race conditions, recalculating is safer.
             transaction.update(supplierDocRef, {
                 'accountSummary.totalPaid': newTotalPaid,
                 // 'accountSummary.balance': newBalance, // Need full recalculation logic here
                 'lastTransactionDate': serverTimestamp()
             });
             */
             console.log("Payment added within transaction.");
        });


        console.log("Payment added successfully (via transaction).");
        closeModal(addPaymentModal);
        await loadSupplierPageData(); // Refresh ledger and summary
        // Optional: Success message
    } catch (error) {
        console.error("Error adding payment:", error);
        displayError(`Failed to save payment: ${error.message}`, 'paymentErrorDisplay');
    } finally {
        if (savePaymentBtn) savePaymentBtn.disabled = false;
    }
}

// Add Adjustment Form Submission
async function handleAddAdjustment(event) {
     event.preventDefault();
     clearError('adjustmentErrorDisplay');
     if (!currentSupplierData) {
         displayError("Supplier data missing.", 'adjustmentErrorDisplay');
         return;
     }
     if (!addAdjustmentForm) return;

     const amount = parseFloat(adjustmentAmountInput.value);
     const adjustmentDateStr = adjustmentDateInput.value;
     const adjustmentType = adjustmentTypeDebitRadio.checked ? 'debit' : 'credit';
     const remarks = adjustmentRemarksInput.value.trim();

     // Validation
     if (isNaN(amount) || amount <= 0) {
         displayError("Please enter a valid positive adjustment amount.", 'adjustmentErrorDisplay');
         return;
     }
     if (!adjustmentDateStr) {
         displayError("Please select an adjustment date.", 'adjustmentErrorDisplay');
         return;
     }

     // Convert date string to Firebase Timestamp
     let adjustmentTimestamp;
     try {
        const dateParts = adjustmentDateStr.split('-');
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
        const day = parseInt(dateParts[2], 10);
        const localDate = new Date(year, month, day);
        adjustmentTimestamp = Timestamp.fromDate(localDate);
         if (isNaN(adjustmentTimestamp.seconds)) throw new Error("Invalid date created"); // Validate
     } catch (e) {
         console.error("Date conversion error:", e);
         displayError("Invalid adjustment date selected.", 'adjustmentErrorDisplay');
         return;
     }

     const adjustmentData = {
         supplierId: currentSupplierData.id,
         supplierRef: doc(db, "suppliers", currentSupplierData.id),
         supplierName: currentSupplierData.name,
         type: adjustmentType, // 'debit' or 'credit'
         amount: amount,
         adjustmentDate: adjustmentTimestamp,
         remarks: remarks,
         recordedAt: serverTimestamp()
     };

     if (saveAdjustmentBtn) saveAdjustmentBtn.disabled = true;
     try {
         // Add adjustment document (Transaction might be overkill unless updating summary directly)
         const adjustmentsColRef = collection(db, "supplierAdjustments");
         await addDoc(adjustmentsColRef, adjustmentData);

         console.log("Adjustment added successfully.");
         closeModal(addAdjustmentModal);
         await loadSupplierPageData(); // Refresh ledger and summary
         // Optional: Success message
     } catch (error) {
         console.error("Error adding adjustment:", error);
         displayError(`Failed to save adjustment: ${error.message}`, 'adjustmentErrorDisplay');
     } finally {
         if (saveAdjustmentBtn) saveAdjustmentBtn.disabled = false;
     }
}


// Toggle Status Confirmation
async function handleToggleStatus() {
    if (!currentSupplierData || !confirmToggleCheckbox || !confirmToggleCheckbox.checked) {
        displayError("Please confirm by checking the box.", 'toggleStatusErrorDisplay'); // Need error display in toggle modal
        return;
    }

    const supplierId = currentSupplierData.id;
    const supplierDocRef = doc(db, "suppliers", supplierId);
    const currentStatus = currentSupplierData.status;
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

    if (confirmToggleBtn) confirmToggleBtn.disabled = true; // Disable confirm button during operation

    try {
        await updateDoc(supplierDocRef, {
            status: newStatus,
            lastModified: serverTimestamp()
        });
        console.log(`Supplier status changed to ${newStatus}`);
        closeModal(confirmToggleStatusModal);
        await loadSupplierPageData(); // Refresh data to reflect change
        // Optional: Success message
    } catch (error) {
        console.error("Error toggling supplier status:", error);
        displayError(`Failed to change status: ${error.message}`, 'toggleStatusErrorDisplay');
        if (confirmToggleBtn) confirmToggleBtn.disabled = false; // Re-enable button on error
    }
    // No finally needed as button stays disabled on success due to modal close
}


// Delete Supplier Confirmation
async function handleDeleteSupplier() {
     if (!currentSupplierData || !confirmDeleteSupplierCheckbox || !confirmDeleteSupplierCheckbox.checked) {
        displayError("Please confirm by checking the box.", 'deleteSupplierErrorDisplay'); // Need error display in delete modal
        return;
    }

    const supplierId = currentSupplierData.id;
    const supplierDocRef = doc(db, "suppliers", supplierId);

    if (confirmSupplierDeleteBtn) confirmSupplierDeleteBtn.disabled = true;

    try {
        // Ideally, you might want a "soft delete" (setting a 'deleted' flag)
        // instead of a hard delete. Hard delete is irreversible.
        await deleteDoc(supplierDocRef);

        console.log(`Supplier ${supplierId} deleted successfully.`);
        // Redirect back to supplier list after deletion
        alert(`Supplier "${currentSupplierData.name}" has been permanently deleted.`);
        window.location.href = 'supplier_management.html'; // Adjust redirect URL if needed

    } catch (error) {
        console.error("Error deleting supplier:", error);
        displayError(`Failed to delete supplier: ${error.message}`, 'deleteSupplierErrorDisplay');
        if (confirmSupplierDeleteBtn) confirmSupplierDeleteBtn.disabled = false; // Re-enable on error
    }
}

// --- Initial Data Load and Setup ---
async function loadSupplierPageData() {
    if (isRefreshingData) {
        console.log("Data refresh already in progress. Skipping.");
        return;
    }
    isRefreshingData = true;
    console.log("Starting data refresh...");
    disableActions(true); // Disable buttons while loading
    clearError(); // Clear previous errors

    if (!currentSupplierId) {
        displayError("Supplier ID is missing. Cannot load data.");
        isRefreshingData = false;
        return;
    }

    try {
        // Load data in parallel
        const [supplierData, poData, paymentData, adjustmentData] = await Promise.all([
            loadSupplierDetails(currentSupplierId),
            loadPurchaseOrders(currentSupplierId),
            loadSupplierPayments(currentSupplierId),
            loadSupplierAdjustments(currentSupplierId)
        ]);

        if (supplierData) {
            // Populate UI elements
            populateSupplierDetails(supplierData);
            populatePurchaseOrders(poData);

            // Calculate and Populate Summary & Ledger
            const summary = calculateAccountSummary(poData, paymentData, adjustmentData);
            populateAccountSummary(summary);
            populateAccountLedger(poData, paymentData, adjustmentData);

            disableActions(false); // Re-enable actions after successful load
        } else {
             // Error handled within loadSupplierDetails, actions remain disabled
            console.log("Supplier data was null, actions remain disabled.");
        }

    } catch (error) {
        // Catch any unexpected errors from Promise.all or subsequent processing
        console.error("Error during parallel data loading or UI population:", error);
        displayError("An unexpected error occurred while loading supplier data. Please try refreshing the page.");
        disableActions(true); // Ensure actions are disabled on error
    } finally {
        isRefreshingData = false;
        console.log("Data refresh finished.");
    }
}

function setupEventListeners() {
     if (listenersAttached) return; // Prevent attaching multiple times
     console.log("Setting up event listeners...");

    // --- Action Bar Buttons ---
    if (editSupplierBtn) editSupplierBtn.addEventListener('click', openEditModal);
    if (addPaymentBtn) addPaymentBtn.addEventListener('click', openAddPaymentModal);
    if (addAdjustmentBtn) addAdjustmentBtn.addEventListener('click', openAddAdjustmentModal);
    // Add New PO button is handled via href update in populateSupplierDetails
    if (toggleStatusBtn) toggleStatusBtn.addEventListener('click', openToggleConfirmModal);
    if (deleteSupplierBtn) deleteSupplierBtn.addEventListener('click', openDeleteConfirmModal);

    // --- Modal Close Buttons (using ID selectors) ---
    if (closeSupplierEditModalBtn) closeSupplierEditModalBtn.addEventListener('click', () => closeModal(editSupplierModal));
    if (closePaymentModalBtn) closePaymentModalBtn.addEventListener('click', () => closeModal(addPaymentModal));
    if (closeAdjustmentModalBtn) closeAdjustmentModalBtn.addEventListener('click', () => closeModal(addAdjustmentModal));
    if (closeConfirmToggleModalBtn) closeConfirmToggleModalBtn.addEventListener('click', () => closeModal(confirmToggleStatusModal));
    if (closeConfirmDeleteSupplierModalBtn) closeConfirmDeleteSupplierModalBtn.addEventListener('click', () => closeModal(confirmDeleteSupplierModal));

     // --- Modal Cancel Buttons ---
     if (cancelSupplierEditBtn) cancelSupplierEditBtn.addEventListener('click', () => closeModal(editSupplierModal));
     if (cancelPaymentBtn) cancelPaymentBtn.addEventListener('click', () => closeModal(addPaymentModal));
     if (cancelAdjustmentBtn) cancelAdjustmentBtn.addEventListener('click', () => closeModal(addAdjustmentModal));
     if (cancelToggleBtn) cancelToggleBtn.addEventListener('click', () => closeModal(confirmToggleStatusModal));
     if (cancelSupplierDeleteBtn) cancelSupplierDeleteBtn.addEventListener('click', () => closeModal(confirmDeleteSupplierModal));

    // --- Modal Form Submissions ---
    if (editSupplierForm) editSupplierForm.addEventListener('submit', handleUpdateSupplier);
    if (addPaymentForm) addPaymentForm.addEventListener('submit', handleAddPayment);
    if (addAdjustmentForm) addAdjustmentForm.addEventListener('submit', handleAddAdjustment);

     // --- Confirmation Modal Actions ---
     if (confirmToggleCheckbox) confirmToggleCheckbox.addEventListener('change', () => { if (confirmToggleBtn) confirmToggleBtn.disabled = !confirmToggleCheckbox.checked; });
     if (confirmToggleBtn) confirmToggleBtn.addEventListener('click', handleToggleStatus);

     if (confirmDeleteSupplierCheckbox) confirmDeleteSupplierCheckbox.addEventListener('change', () => { if (confirmSupplierDeleteBtn) confirmSupplierDeleteBtn.disabled = !confirmDeleteSupplierCheckbox.checked; });
     if (confirmSupplierDeleteBtn) confirmSupplierDeleteBtn.addEventListener('click', handleDeleteSupplier);


     // Close modal if clicking outside the content area
     window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal') && event.target.classList.contains('active')) {
            // Check which modal is active and close it
            if (editSupplierModal && editSupplierModal.classList.contains('active')) closeModal(editSupplierModal);
            if (addPaymentModal && addPaymentModal.classList.contains('active')) closeModal(addPaymentModal);
            if (addAdjustmentModal && addAdjustmentModal.classList.contains('active')) closeModal(addAdjustmentModal);
            if (confirmToggleStatusModal && confirmToggleStatusModal.classList.contains('active')) closeModal(confirmToggleStatusModal);
            if (confirmDeleteSupplierModal && confirmDeleteSupplierModal.classList.contains('active')) closeModal(confirmDeleteSupplierModal);
        }
     });

    listenersAttached = true;
    console.log("Event listeners attached.");
}


// --- Initialization Function (Called from HTML Script) ---
window.initializeSupplierDetailPage = function(user) {
    console.log("Attempting to initialize Supplier Detail Page...");
    if (supplierDetailPageInitialized) {
        console.log("Page already initialized.");
        return;
    }

    // Get Supplier ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentSupplierId = urlParams.get('id');

    if (!currentSupplierId) {
        console.error("Supplier ID not found in URL.");
        displayError("Could not determine which supplier to display. Please return to the supplier list and try again.");
        disableActions(true);
        return;
    }
    console.log("Supplier ID from URL:", currentSupplierId);

    // Ensure main content container exists (optional check)
    const mainContent = document.getElementById('supplierAccountDetailContent'); // Check your main container ID
    if (!mainContent) {
        console.warn("Main content container not found, proceeding anyway...");
        // displayError("Page layout structure might be broken."); // Optional error
    }

    supplierDetailPageInitialized = true;
    clearError();

    // Setup listeners ONCE upon initialization
    if (!listenersAttached) {
        setupEventListeners();
    }

    // Load data (assuming auth is already confirmed by the time this runs)
    console.log("Triggering initial data load...");
    loadSupplierPageData(); // Load all data including ledger, summary etc.

};

// --- Authentication Guard (Simplified - Primary check in HTML script) ---
// This script relies on the inline script in supplier_account_detail.html
// to perform the auth check and call initializeSupplierDetailPage.

console.log("supplier_account_detail.js (v8 - Modal Class Toggle) script loaded.");