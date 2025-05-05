// js/supplier_account_detail.js - STAGE 1 UPDATE

import { db, auth } from './firebase-init.js';
import {
    doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp,
    addDoc, serverTimestamp, updateDoc, runTransaction, writeBatch // Keep imports needed later
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Global Variables ---
let currentSupplierId = null;
let currentSupplierData = null;
let purchaseOrdersData = []; // Will be used in Stage 2/3
let supplierPaymentsData = []; // Will be used in Stage 2/3
let listenersAttached = false;
let supplierDetailPageInitialized = false;
let initializationAttempted = false; // Prevent multiple initialization attempts

// --- DOM Elements (Existing & New) ---
let supplierNameDisplay, supplierContactDisplay, supplierWhatsappDisplay, supplierEmailDisplay, supplierGstDisplay, supplierAddressDisplay, supplierStatusIndicator;
let totalPoAmountDisplay, totalPaidAmountDisplay, totalAdjustmentAmountDisplay, currentBalanceDisplay;
let poTableBody, paymentTableBody;
let poListError, paymentListError, poListLoading, paymentListLoading;
let editSupplierBtn, addPaymentBtn; // Existing buttons
let addNewPoBtn, addAdjustmentBtn, toggleSupplierStatusBtn, deleteSupplierBtn; // New Stage 1 buttons
let paymentModal, editSupplierModal; // Existing Modals
let adjustmentModal, editPoModal; // New Stage 1 Modals
let closePaymentModalBtn, closeEditSupplierModalBtn, closeAdjustmentModalBtn, closeEditPoModalBtn;
let paymentForm, editSupplierForm, adjustmentForm, editPoForm;
let savePaymentBtn, updateSupplierBtn, saveAdjustmentBtn, updatePoBtn;
let cancelPaymentBtn, cancelEditSupplierBtn, cancelAdjustmentBtn, cancelEditPoBtn;
let paymentPoCheckboxList; // New area in Payment Modal
let toggleStatusBtnText; // Span inside the toggle button
let poSection, paymentSection; // Details elements for lists
let detailMainContent, loadingIndicator, generalErrorDisplay; // Core elements

// --- Helper Functions ---
function displayError(message, elementId = 'generalErrorDisplay') {
    console.error("Error:", message);
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    } else {
        // Fallback if specific error element not found
        const generalError = document.getElementById('generalErrorDisplay');
        if (generalError) {
            generalError.textContent = `Error (${elementId}): ${message}`;
            generalError.style.display = 'block';
        } else {
            alert(`Error: ${message}`); // Ultimate fallback
        }
    }
    // Hide loading indicators on error
    hideLoading('poListLoading');
    hideLoading('paymentListLoading');
    hideLoading('loadingIndicator');
}

function clearError(elementId = 'generalErrorDisplay') {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
     // Clear all common error fields
     const idsToClear = ['generalErrorDisplay', 'paymentMadeError', 'editSupplierError', 'adjustmentError', 'editPoError', 'poListError', 'paymentListError'];
     idsToClear.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.textContent = '';
            el.style.display = 'none';
        }
     });
}

function showLoading(elementId) {
    const loadingElement = document.getElementById(elementId);
    if (loadingElement) {
        loadingElement.style.display = 'block';
    }
}

function hideLoading(elementId) {
    const loadingElement = document.getElementById(elementId);
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

function formatCurrency(amount) {
    // Ensure amount is a number, default to 0 if not
    const numAmount = Number(amount);
    if (isNaN(numAmount)) {
        return '₹ 0.00';
    }
    return `₹ ${numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(timestamp) {
    if (timestamp && timestamp.toDate) {
        return timestamp.toDate().toLocaleDateString('en-CA'); // YYYY-MM-DD format
    } else if (timestamp) {
         // Assuming it might be a string already or needs conversion
         try {
             return new Date(timestamp).toLocaleDateString('en-CA');
         } catch (e) {
             return 'Invalid Date';
         }
    }
    return 'N/A';
}

function getSupplierIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// --- Modal Handling Functions (Existing & New) ---

function openModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'flex';
    } else {
        console.warn("Attempted to open a non-existent modal");
    }
}

function closeModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'none';
    } else {
        console.warn("Attempted to close a non-existent modal");
    }
}

// Edit Supplier Modal
function openEditSupplierModal() {
    if (!currentSupplierData) {
        displayError("Supplier data not loaded.", 'editSupplierError');
        return;
    }
    clearError('editSupplierError');
    // Populate the edit form
    document.getElementById('editSupplierNameInput').value = currentSupplierData.name || '';
    document.getElementById('editSupplierWhatsappInput').value = currentSupplierData.whatsappNo || '';
    document.getElementById('editSupplierContactInput').value = currentSupplierData.contactNo || '';
    document.getElementById('editSupplierEmailInput').value = currentSupplierData.email || '';
    document.getElementById('editSupplierGstInput').value = currentSupplierData.gstNo || '';
    document.getElementById('editSupplierAddressInput').value = currentSupplierData.address || '';
    document.getElementById('editingSupplierId').value = currentSupplierId;
    openModal(editSupplierModal);
}
function closeEditSupplierModal() { closeModal(editSupplierModal); }

// Payment Modal
function openPaymentModal() {
    clearError('paymentMadeError');
    paymentForm.reset(); // Reset form fields
    document.getElementById('paymentDateInput').value = new Date().toLocaleDateString('en-CA'); // Set default date
    // STAGE 1: Clear the placeholder text in the checkbox list area
    if(paymentPoCheckboxList) {
        paymentPoCheckboxList.innerHTML = '<p><em>Unpaid POs will load here in Stage 2...</em></p>';
    } else {
        console.warn("Payment PO Checkbox List element not found");
    }
    openModal(paymentModal);
}
function closePaymentModal() { closeModal(paymentModal); }

// --- STAGE 1: New Modal Handlers ---

// Adjustment Modal
function openAdjustmentModal() {
    clearError('adjustmentError');
    adjustmentForm.reset();
    document.getElementById('adjustmentDateInput').value = new Date().toLocaleDateString('en-CA'); // Set default date
    openModal(adjustmentModal);
}
function closeAdjustmentModal() { closeModal(adjustmentModal); }

// PO Edit Modal
function openEditPoModal(poId = null) {
    clearError('editPoError');
    editPoForm.reset();
    console.log("Attempting to open PO Edit Modal for PO ID:", poId); // Placeholder
    if (!poId) {
         console.warn("No PO ID provided for editing.");
         // displayError("Cannot edit PO without ID.", 'editPoError'); // Optionally show error
         // return;
         // For Stage 1, maybe allow opening empty? Or just log.
    }
    // --- Placeholder ---
    // In Stage 2/3, we would fetch PO data using poId and populate the form here.
    document.getElementById('editingPoId').value = poId || '';
    document.getElementById('editPoNumberInput').value = `Loading for ${poId}...`; // Placeholder
    // --- End Placeholder ---
    openModal(editPoModal);
}
function closeEditPoModal() { closeModal(editPoModal); }

// --- Data Loading and Display ---

async function loadSupplierAccountData() {
    currentSupplierId = getSupplierIdFromUrl();
    if (!currentSupplierId) {
        displayError("No supplier ID provided in URL.");
        hideLoading('loadingIndicator');
        return;
    }
    console.log("Loading data for supplier:", currentSupplierId);
    showLoading('loadingIndicator');
    clearError();

    try {
        const supplierRef = doc(db, "suppliers", currentSupplierId);
        const supplierSnap = await getDoc(supplierRef);

        if (supplierSnap.exists()) {
            currentSupplierData = { id: supplierSnap.id, ...supplierSnap.data() };
            displaySupplierDetails(currentSupplierData);
            // Load related data (POs, Payments) - Placeholder for now, more detailed loading in Stage 2/3
            await loadPurchaseOrders();
            await loadSupplierPaymentsAndAdjustments(); // Renamed for clarity
            calculateAndDisplayBalance(); // Calculate initial balance
            if (!listenersAttached) {
                attachEventListeners(); // Attach listeners after initial data load attempt
            }
        } else {
            displayError("Supplier not found.");
            currentSupplierData = null;
        }
    } catch (error) {
        console.error("Error loading supplier data: ", error);
        displayError(`Failed to load supplier details: ${error.message}`);
        currentSupplierData = null;
    } finally {
        hideLoading('loadingIndicator');
         // Ensure main content is visible after loading attempt
        if (detailMainContent) detailMainContent.style.visibility = 'visible';
    }
}

function displaySupplierDetails(supplierData) {
    if (!supplierData) return;
    supplierNameDisplay.textContent = supplierData.name || 'N/A';
    supplierContactDisplay.textContent = supplierData.contactNo || 'N/A';
    supplierWhatsappDisplay.textContent = supplierData.whatsappNo || 'N/A';
    supplierEmailDisplay.textContent = supplierData.email || 'N/A';
    supplierGstDisplay.textContent = supplierData.gstNo || 'N/A';
    supplierAddressDisplay.textContent = supplierData.address || 'N/A';

    // Update Status Indicator (Basic Stage 1)
    if (supplierData.status === 'disabled') {
        supplierStatusIndicator.textContent = '(Disabled)';
        supplierStatusIndicator.className = 'supplier-disabled-indicator'; // Add class for styling
        toggleStatusBtnText.textContent = 'Enable'; // Set button text
    } else {
        supplierStatusIndicator.textContent = ''; // Clear indicator if active
        supplierStatusIndicator.className = '';
        toggleStatusBtnText.textContent = 'Disable'; // Set button text
    }
}

// --- Placeholder Load Functions (To be detailed in Stage 2/3) ---
async function loadPurchaseOrders() {
    if (!currentSupplierId) return;
    showLoading('poListLoading');
    clearError('poListError');
    poTableBody.innerHTML = ''; // Clear existing rows

    try {
        // Basic Query for Stage 1/2 - More complex pagination/filtering in Stage 3
        const q = query(collection(db, "purchaseOrders"),
                        where("supplierId", "==", currentSupplierId),
                        orderBy("poDate", "desc")); // Example ordering
        const querySnapshot = await getDocs(q);
        purchaseOrdersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        document.getElementById('poCount').textContent = purchaseOrdersData.length; // Update count

        if (purchaseOrdersData.length === 0) {
            poTableBody.innerHTML = '<tr><td colspan="6">No purchase orders found for this supplier.</td></tr>';
        } else {
            renderPurchaseOrdersTable(purchaseOrdersData);
        }
    } catch (error) {
        console.error("Error loading purchase orders: ", error);
        displayError(`Failed to load POs: ${error.message}`, 'poListError');
    } finally {
        hideLoading('poListLoading');
    }
}

async function loadSupplierPaymentsAndAdjustments() {
    if (!currentSupplierId) return;
    showLoading('paymentListLoading');
    clearError('paymentListError');
    paymentTableBody.innerHTML = ''; // Clear existing rows

    try {
        // Query for both payments and adjustments, ordered by date
        // In a real app, you might query two collections or use a 'type' field
        // For now, let's assume they are in one collection 'payments' with a 'type' field

        const qPayments = query(collection(db, "payments"), // Assuming 'payments' collection
                                where("supplierId", "==", currentSupplierId),
                                orderBy("paymentDate", "desc"));

        // We might need another query for adjustments if stored separately
        // const qAdjustments = query(collection(db, "adjustments"), ... );
        // For simplicity now, assume all are in 'payments'

        const querySnapshot = await getDocs(qPayments);
        supplierPaymentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        document.getElementById('paymentCount').textContent = supplierPaymentsData.length; // Update count

        if (supplierPaymentsData.length === 0) {
            paymentTableBody.innerHTML = '<tr><td colspan="7">No payments or adjustments found.</td></tr>';
        } else {
            renderPaymentsTable(supplierPaymentsData);
        }
    } catch (error) {
        console.error("Error loading payments/adjustments: ", error);
        displayError(`Failed to load payments: ${error.message}`, 'paymentListError');
    } finally {
        hideLoading('paymentListLoading');
    }
}

// --- Placeholder Render Functions (To be detailed in Stage 2/3) ---
function renderPurchaseOrdersTable(pos) {
    poTableBody.innerHTML = ''; // Clear previous content
    if (!pos || pos.length === 0) {
        poTableBody.innerHTML = '<tr><td colspan="6">No purchase orders found.</td></tr>';
        return;
    }

    pos.forEach(po => {
        const row = poTableBody.insertRow();
        row.setAttribute('data-po-id', po.id); // Add PO ID to row for click handling

        // Basic data - expand as needed
        row.insertCell().textContent = po.poNumber || 'N/A';
        row.insertCell().textContent = formatDate(po.poDate);
        row.insertCell().textContent = formatCurrency(po.totalAmount);
        row.insertCell().innerHTML = `<span class="status status-${(po.status || 'unknown').toLowerCase()}">${po.status || 'Unknown'}</span>`;
        row.insertCell().innerHTML = `<span class="status status-${(po.paymentStatus || 'unpaid').toLowerCase()}">${po.paymentStatus || 'Unpaid'}</span>`; // Example Payment Status

        // Actions Cell - Stage 1: Add an Edit button/icon trigger
        const actionCell = row.insertCell();
        const editButton = document.createElement('button');
        editButton.innerHTML = '<i class="fas fa-edit"></i> Edit';
        editButton.className = 'button small-button edit-po-button'; // Add class for styling & event delegation
        editButton.onclick = (event) => {
             event.stopPropagation(); // Prevent row click if button is clicked
             openEditPoModal(po.id);
        };
        actionCell.appendChild(editButton);
        // Add delete button placeholder in Stage 3
    });
}

function renderPaymentsTable(payments) {
    paymentTableBody.innerHTML = ''; // Clear previous content
     if (!payments || payments.length === 0) {
        paymentTableBody.innerHTML = '<tr><td colspan="7">No payments or adjustments found.</td></tr>';
        return;
    }

    payments.forEach(p => {
        const row = paymentTableBody.insertRow();
        const paymentType = p.type || 'payment'; // Assume 'payment' if type is missing

        row.insertCell().textContent = formatDate(p.paymentDate || p.adjustmentDate); // Use appropriate date field
        row.insertCell().textContent = formatCurrency(p.amount || p.adjustmentAmount); // Use appropriate amount field
        row.insertCell().textContent = p.paymentMode || (paymentType === 'adjustment' ? 'N/A' : 'N/A');
        row.insertCell().textContent = paymentType.charAt(0).toUpperCase() + paymentType.slice(1); // Capitalize type

        // Linked POs - Placeholder for Stage 2/3 logic
        let linkedPoText = 'N/A';
        if (paymentType === 'payment' && p.linkedPoIds && Array.isArray(p.linkedPoIds) && p.linkedPoIds.length > 0) {
            // In a real app, you might fetch PO Numbers for these IDs
            linkedPoText = p.linkedPoIds.join(', '); // Simple display for now
        }
        row.insertCell().textContent = linkedPoText;

        row.insertCell().textContent = p.notes || p.reason || 'N/A'; // Use notes or reason

        // Actions Cell - Placeholder for Stage 3 delete button
        const actionCell = row.insertCell();
        actionCell.innerHTML = `<button class="button small-button danger-button delete-payment-button" data-id="${p.id}" data-type="${paymentType}" style="display: none;"><i class="fas fa-trash"></i></button>`; // Hidden until Stage 3
         // Attach delete listener in Stage 3
    });
}


// --- Balance Calculation ---
function calculateAndDisplayBalance() {
    // This is a basic calculation. Stage 2/3 will refine with loaded data.
    let totalPO = 0;
    let totalPaid = 0;
    let totalAdjustments = 0; // Added for adjustments

    // Use loaded data if available, otherwise use displayed values as fallback (less accurate)
    if (purchaseOrdersData && purchaseOrdersData.length > 0) {
        totalPO = purchaseOrdersData.reduce((sum, po) => sum + (Number(po.totalAmount) || 0), 0);
    } else {
         // Fallback - less reliable
         totalPO = parseFloat(totalPoAmountDisplay.textContent.replace(/[^0-9.-]+/g,"")) || 0;
    }

    if (supplierPaymentsData && supplierPaymentsData.length > 0) {
         supplierPaymentsData.forEach(p => {
             const amount = Number(p.amount || p.adjustmentAmount) || 0;
             const type = p.type || 'payment';
             if (type === 'payment') {
                 totalPaid += amount;
             } else if (type === 'adjustment') {
                 // Assuming debit adjustment reduces payable (acts like payment), credit increases payable
                 // Let's refine: Store debit as positive, credit as negative in DB? Or handle here.
                 // Assuming current structure: debit is positive, credit is negative adjustment amount field? Check Stage 2 save logic.
                 // Simple assumption for now: Add all adjustments. Stage 2 needs to clarify debit/credit effect.
                 // Let's assume: Debit Note = positive amount (reduces due), Credit Note = negative amount (increases due)
                 totalAdjustments += amount; // Add amount directly (sign handled in save logic - Stage 2)
             }
         });
    } else {
         // Fallback - less reliable
         totalPaid = parseFloat(totalPaidAmountDisplay.textContent.replace(/[^0-9.-]+/g,"")) || 0;
         totalAdjustments = parseFloat(totalAdjustmentAmountDisplay.textContent.replace(/[^0-9.-]+/g,"")) || 0;
    }

    // Balance = Paid + Adjustments - PO Total
    const balance = totalPaid + totalAdjustments - totalPO;

    totalPoAmountDisplay.textContent = formatCurrency(totalPO);
    totalPaidAmountDisplay.textContent = formatCurrency(totalPaid);
    totalAdjustmentAmountDisplay.textContent = formatCurrency(totalAdjustments); // Display total adjustments
    currentBalanceDisplay.textContent = formatCurrency(balance);

    // Set balance class for color coding
    currentBalanceDisplay.classList.remove('balance-positive', 'balance-negative', 'balance-zero');
    if (balance > 0) {
        currentBalanceDisplay.classList.add('balance-positive');
    } else if (balance < 0) {
        currentBalanceDisplay.classList.add('balance-negative');
    } else {
        currentBalanceDisplay.classList.add('balance-zero');
    }
}

// --- Event Handlers ---

async function handleEditSupplierSubmit(event) {
    event.preventDefault();
    const supplierId = document.getElementById('editingSupplierId').value;
    if (!supplierId) {
        displayError("No supplier ID found for update.", 'editSupplierError');
        return;
    }

    const updatedData = {
        name: document.getElementById('editSupplierNameInput').value.trim(),
        whatsappNo: document.getElementById('editSupplierWhatsappInput').value.trim(),
        contactNo: document.getElementById('editSupplierContactInput').value.trim(),
        email: document.getElementById('editSupplierEmailInput').value.trim(),
        gstNo: document.getElementById('editSupplierGstInput').value.trim(),
        address: document.getElementById('editSupplierAddressInput').value.trim(),
        // Add updatedAt timestamp if needed
        // updatedAt: serverTimestamp()
    };

    try {
        const supplierRef = doc(db, "suppliers", supplierId);
        await updateDoc(supplierRef, updatedData);
        closeEditSupplierModal();
        // Reload or update displayed data
        await loadSupplierAccountData(); // Reload all data for consistency
    } catch (error) {
        console.error("Error updating supplier: ", error);
        displayError(`Failed to update supplier: ${error.message}`, 'editSupplierError');
    }
}

async function handlePaymentSubmit(event) {
    event.preventDefault();
    const amount = parseFloat(document.getElementById('paymentAmountInput').value);
    const paymentDate = document.getElementById('paymentDateInput').value;
    const paymentMode = document.getElementById('paymentModeInput').value.trim();
    const notes = document.getElementById('paymentNotesInput').value.trim();

    // --- STAGE 2 Logic Placeholder ---
    // In Stage 2, we will get selected PO IDs from checkboxes here
    const linkedPoIds = []; // Placeholder - get from checkboxes in Stage 2
    const checkedBoxes = paymentPoCheckboxList.querySelectorAll('input[type="checkbox"]:checked');
    checkedBoxes.forEach(box => {
        linkedPoIds.push(box.value);
    });
    console.log("Selected PO IDs (Stage 2):", linkedPoIds);
    // --- End Stage 2 Placeholder ---


    if (isNaN(amount) || amount <= 0) {
        displayError("Please enter a valid positive amount.", 'paymentMadeError');
        return;
    }
    if (!paymentDate) {
        displayError("Please select a payment date.", 'paymentMadeError');
        return;
    }
    if (!currentSupplierId) {
         displayError("Supplier ID is missing.", 'paymentMadeError');
         return;
    }

    const paymentData = {
        supplierId: currentSupplierId,
        amount: amount,
        paymentDate: Timestamp.fromDate(new Date(paymentDate)),
        paymentMode: paymentMode,
        notes: notes,
        linkedPoIds: linkedPoIds, // Will be populated in Stage 2
        type: 'payment', // Explicitly set type
        createdAt: serverTimestamp()
    };

    console.log("Saving Payment Data (Stage 1 - Basic):", paymentData);

    // --- STAGE 2: Use writeBatch here ---
    // For Stage 1, we'll do a simple addDoc, PO status update comes later.
    try {
        const docRef = await addDoc(collection(db, "payments"), paymentData);
        console.log("Payment added with ID: ", docRef.id);
        closePaymentModal();
        // Reload payments and recalculate balance
        await loadSupplierPaymentsAndAdjustments();
        calculateAndDisplayBalance();
    } catch (error) {
        console.error("Error adding payment: ", error);
        displayError(`Failed to save payment: ${error.message}`, 'paymentMadeError');
    }
}

// --- STAGE 1: New Event Handlers (Placeholders) ---

function handleAddNewPo() {
    console.log("Add New PO button clicked - Stage 1 Placeholder");
    if (!currentSupplierId) {
        alert("Supplier ID not found.");
        return;
    }
    // Option 1: Redirect to PO creation page with supplier pre-filled
    // window.location.href = `supplier_management.html?action=addPO&supplierId=${currentSupplierId}`;
    // Option 2: Open a PO creation modal (if one exists on this page or globally)
    alert(`Redirecting to add PO for supplier ${currentSupplierId} (Not implemented in Stage 1)`);
}

async function handleAdjustmentSubmit(event) {
    event.preventDefault();
    console.log("Save Adjustment button clicked - Stage 1 Placeholder");
    alert("Saving adjustment is not implemented in Stage 1. See Stage 2.");
    // --- Stage 2 Logic ---
    // Get data: type, amount, date, reason
    // Validate data
    // Determine sign of amount based on type (e.g., debit +, credit -) or handle in balance calc
    // Prepare adjustmentData object (similar to paymentData, but with 'type: adjustment', reason field etc.)
    // Use addDoc to save to 'payments' or 'adjustments' collection
    // Reload payments/adjustments, recalculate balance
    // Close modal on success
    // --- End Stage 2 Logic ---
    // closeAdjustmentModal(); // Close for now
}

async function handleToggleSupplierStatus() {
    console.log("Toggle Supplier Status button clicked - Stage 1 Placeholder");
    if (!currentSupplierData) {
        alert("Supplier data not loaded.");
        return;
    }
    const currentStatus = currentSupplierData.status || 'active'; // Assume active if no status
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    alert(`Action: Change supplier status to ${newStatus} (Not implemented in Stage 1 - See Stage 2)`);

    // --- Stage 2 Logic ---
    // Show confirmation: `window.confirm(...)`
    // If confirmed:
    //   const supplierRef = doc(db, "suppliers", currentSupplierId);
    //   await updateDoc(supplierRef, { status: newStatus });
    //   Reload supplier data or update UI directly
    // --- End Stage 2 Logic ---
}

async function handleDeleteSupplier() {
    console.log("Delete Supplier button clicked - Stage 1 Placeholder");
     if (!currentSupplierData) {
        alert("Supplier data not loaded.");
        return;
    }
    alert("Action: Delete Supplier (Not implemented in Stage 1 - See Stage 2/3 - Be Careful!)");

    // --- Stage 2/3 Logic ---
    // Show STRONG confirmation: `window.confirm("WARNING: This will permanently delete the supplier... Are you SURE?")`
    // If confirmed:
    //   Consider deleting related POs/Payments (COMPLEX - maybe just delete supplier doc)
    //   const supplierRef = doc(db, "suppliers", currentSupplierId);
    //   await deleteDoc(supplierRef);
    //   Redirect user back to supplier list: window.location.href = 'supplier_management.html';
    // --- End Stage 2/3 Logic ---
}

async function handleEditPoSubmit(event) {
    event.preventDefault();
    console.log("Update PO button clicked - Stage 1 Placeholder");
    const poId = document.getElementById('editingPoId').value;
     if (!poId) {
         displayError("No PO ID found for updating.", 'editPoError');
         return;
     }
    alert(`Action: Update PO ${poId} (Not implemented in Stage 1 - See Stage 2)`);
    // --- Stage 2 Logic ---
    // Get data from edit PO form fields
    // Validate data
    // Prepare updatedPoData object
    // const poRef = doc(db, "purchaseOrders", poId);
    // await updateDoc(poRef, updatedPoData);
    // Close modal
    // Reload PO list or update specific row
    // Recalculate balance
    // --- End Stage 2 Logic ---
     // closeEditPoModal(); // Close for now
}


// --- Event Listener Attachment ---
function attachEventListeners() {
    if (listenersAttached) return; // Prevent attaching multiple times

     console.log("Attaching event listeners...");

    // Get DOM elements
    supplierNameDisplay = document.getElementById('supplierNameDisplay');
    supplierContactDisplay = document.getElementById('supplierContactDisplay');
    supplierWhatsappDisplay = document.getElementById('supplierWhatsappDisplay');
    supplierEmailDisplay = document.getElementById('supplierEmailDisplay');
    supplierGstDisplay = document.getElementById('supplierGstDisplay');
    supplierAddressDisplay = document.getElementById('supplierAddressDisplay');
    supplierStatusIndicator = document.getElementById('supplierStatusIndicator'); // New
    totalPoAmountDisplay = document.getElementById('totalPoAmount');
    totalPaidAmountDisplay = document.getElementById('totalPaidAmount');
    totalAdjustmentAmountDisplay = document.getElementById('totalAdjustmentAmount'); // New
    currentBalanceDisplay = document.getElementById('currentBalance');
    poTableBody = document.getElementById('supplierPoTableBody');
    paymentTableBody = document.getElementById('supplierPaymentTableBody');
    poListError = document.getElementById('poListError');
    paymentListError = document.getElementById('paymentListError');
    poListLoading = document.getElementById('poListLoading');
    paymentListLoading = document.getElementById('paymentListLoading');
    editSupplierBtn = document.getElementById('editSupplierBtn');
    addPaymentBtn = document.getElementById('addPaymentBtn');
    addNewPoBtn = document.getElementById('addNewPoBtn'); // New
    addAdjustmentBtn = document.getElementById('addAdjustmentBtn'); // New
    toggleSupplierStatusBtn = document.getElementById('toggleSupplierStatusBtn'); // New
    deleteSupplierBtn = document.getElementById('deleteSupplierBtn'); // New
    paymentModal = document.getElementById('paymentModal');
    editSupplierModal = document.getElementById('editSupplierModal');
    adjustmentModal = document.getElementById('adjustmentModal'); // New
    editPoModal = document.getElementById('editPoModal'); // New
    closePaymentModalBtn = document.getElementById('closePaymentModalBtn');
    closeEditSupplierModalBtn = document.getElementById('closeEditSupplierModalBtn');
    closeAdjustmentModalBtn = document.getElementById('closeAdjustmentModalBtn'); // New
    closeEditPoModalBtn = document.getElementById('closeEditPoModalBtn'); // New
    paymentForm = document.getElementById('paymentForm');
    editSupplierForm = document.getElementById('editSupplierForm');
    adjustmentForm = document.getElementById('adjustmentForm'); // New
    editPoForm = document.getElementById('editPoForm'); // New
    savePaymentBtn = document.getElementById('savePaymentBtn');
    updateSupplierBtn = document.getElementById('updateSupplierBtn');
    saveAdjustmentBtn = document.getElementById('saveAdjustmentBtn'); // New
    updatePoBtn = document.getElementById('updatePoBtn'); // New
    cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
    cancelEditSupplierBtn = document.getElementById('cancelEditSupplierBtn');
    cancelAdjustmentBtn = document.getElementById('cancelAdjustmentBtn'); // New
    cancelEditPoBtn = document.getElementById('cancelEditPoBtn'); // New
    paymentPoCheckboxList = document.getElementById('paymentPoCheckboxList'); // New
    toggleStatusBtnText = document.getElementById('toggleStatusBtnText'); // New
    poSection = document.getElementById('poSection'); // New
    paymentSection = document.getElementById('paymentSection'); // New
    detailMainContent = document.getElementById('detailMainContent');
    loadingIndicator = document.getElementById('loadingIndicator');
    generalErrorDisplay = document.getElementById('generalErrorDisplay');

    // Check if elements exist before adding listeners
    if (editSupplierBtn) editSupplierBtn.addEventListener('click', openEditSupplierModal); else console.warn("Edit Supplier Btn not found");
    if (addPaymentBtn) addPaymentBtn.addEventListener('click', openPaymentModal); else console.warn("Add Payment Btn not found");

    // --- STAGE 1: Attach Listeners for New Buttons ---
    if (addAdjustmentBtn) addAdjustmentBtn.addEventListener('click', openAdjustmentModal); else console.warn("Add Adjustment Btn not found");
    if (addNewPoBtn) addNewPoBtn.addEventListener('click', handleAddNewPo); else console.warn("Add New PO Btn not found");
    if (toggleSupplierStatusBtn) toggleSupplierStatusBtn.addEventListener('click', handleToggleSupplierStatus); else console.warn("Toggle Status Btn not found");
    if (deleteSupplierBtn) deleteSupplierBtn.addEventListener('click', handleDeleteSupplier); else console.warn("Delete Supplier Btn not found");
     // Listener for clicking on PO table rows/buttons (delegated) - For opening PO Edit Modal
    if (poTableBody) {
         poTableBody.addEventListener('click', (event) => {
            // Find the closest row element with a data-po-id attribute
             const row = event.target.closest('tr[data-po-id]');
             // Check if the click was specifically on an edit button within the row
             const editButton = event.target.closest('.edit-po-button');

             if (editButton && row) {
                 const poId = row.getAttribute('data-po-id');
                 console.log(`Edit button clicked for PO ID: ${poId}`);
                 // openEditPoModal(poId); // Already handled by button's direct onclick for simplicity now
             } else if (row) {
                 // Handle click on the row itself (if needed, maybe for selection?)
                 const poId = row.getAttribute('data-po-id');
                 console.log(`PO Row clicked, ID: ${poId}`);
                 // Optionally open read-only view or edit modal on row click too
                 // openEditPoModal(poId);
             }
         });
    } else { console.warn("PO Table Body not found for event delegation"); }


    // Modal Close/Cancel Buttons
    if (closePaymentModalBtn) closePaymentModalBtn.addEventListener('click', closePaymentModal); else console.warn("Close Payment Modal Btn not found");
    if (cancelPaymentBtn) cancelPaymentBtn.addEventListener('click', closePaymentModal); else console.warn("Cancel Payment Btn not found");
    if (closeEditSupplierModalBtn) closeEditSupplierModalBtn.addEventListener('click', closeEditSupplierModal); else console.warn("Close Edit Supplier Modal Btn not found");
    if (cancelEditSupplierBtn) cancelEditSupplierBtn.addEventListener('click', closeEditSupplierModal); else console.warn("Cancel Edit Supplier Btn not found");
    // -- Stage 1 New Modals --
    if (closeAdjustmentModalBtn) closeAdjustmentModalBtn.addEventListener('click', closeAdjustmentModal); else console.warn("Close Adjustment Modal Btn not found");
    if (cancelAdjustmentBtn) cancelAdjustmentBtn.addEventListener('click', closeAdjustmentModal); else console.warn("Cancel Adjustment Btn not found");
    if (closeEditPoModalBtn) closeEditPoModalBtn.addEventListener('click', closeEditPoModal); else console.warn("Close Edit PO Modal Btn not found");
    if (cancelEditPoBtn) cancelEditPoBtn.addEventListener('click', closeEditPoModal); else console.warn("Cancel Edit PO Btn not found");

    // Modal Forms
    if (paymentForm) paymentForm.addEventListener('submit', handlePaymentSubmit); else console.warn("Payment Form not found");
    if (editSupplierForm) editSupplierForm.addEventListener('submit', handleEditSupplierSubmit); else console.warn("Edit Supplier Form not found");
    // -- Stage 1 New Forms --
    if (adjustmentForm) adjustmentForm.addEventListener('submit', handleAdjustmentSubmit); else console.warn("Adjustment Form not found");
    if (editPoForm) editPoForm.addEventListener('submit', handleEditPoSubmit); else console.warn("Edit PO Form not found");

    // Modal background click to close (Optional)
    [paymentModal, editSupplierModal, adjustmentModal, editPoModal].forEach(modal => {
         if (modal) {
             modal.addEventListener('click', (event) => {
                 if (event.target === modal) {
                     closeModal(modal);
                 }
             });
         }
    });

    listenersAttached = true;
    console.log("Event listeners attached successfully.");
}

// --- Global Initialization & Auth Handling ---
function initializePage() {
    console.log("Initializing Supplier Detail Page...");
     if (supplierDetailPageInitialized) {
         console.log("Initialization already done.");
         return; // Prevent re-initialization
     }

     // Basic check for Firestore
     if (typeof db === 'undefined' || !db) {
         console.error("Firestore db instance is not available. Aborting initialization.");
         displayError("Database connection failed. Please refresh.");
         hideLoading('loadingIndicator');
         if(detailMainContent) detailMainContent.style.visibility = 'visible'; // Show content even if DB fails to show error
         return;
     }

     // Get supplier ID early to avoid issues
     currentSupplierId = getSupplierIdFromUrl();
     if (!currentSupplierId) {
         displayError("No Supplier ID specified in the URL.");
          hideLoading('loadingIndicator');
         if(detailMainContent) detailMainContent.style.visibility = 'visible';
         return;
     }

     // Authentication check
     onAuthStateChanged(auth, (user) => {
         if (user) {
             console.log("User is authenticated:", user.email);
              // Display user email somewhere if needed
              const userEmailDisplay = document.getElementById('userEmailDisplay');
              if (userEmailDisplay) userEmailDisplay.textContent = user.email;
              const logoutBtn = document.getElementById('logoutBtn');
              if(logoutBtn) logoutBtn.style.display = 'inline-block';
              if(logoutBtn) logoutBtn.onclick = () => auth.signOut().then(() => window.location.href = 'index.html');


             if (!supplierDetailPageInitialized) { // Check again inside auth state change
                  supplierDetailPageInitialized = true; // Set flag *before* async calls
                  loadSupplierAccountData().then(() => {
                      console.log("Initial data load sequence complete.");
                      // Attach listeners here maybe? Or after first load success in loadSupplierAccountData
                      if (!listenersAttached) {
                          attachEventListeners();
                      }
                  }).catch(err => {
                       console.error("Error during initial data load:", err);
                       displayError("Failed to load initial data.");
                  });
             }

         } else {
             console.log("User is not authenticated. Redirecting to login.");
             window.location.href = 'index.html'; // Redirect to login page
         }
     });
}


// --- Run Initialization ---
// Use DOMContentLoaded to ensure HTML is parsed, then initialize.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    // DOM already loaded
    initializePage();
}