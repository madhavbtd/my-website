// js/supplier_account_detail.js - STAGE 1 UPDATE (v1.1 - Robust Initialization)

import { db, auth } from './firebase-init.js';
import {
    doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp,
    addDoc, serverTimestamp, updateDoc, runTransaction, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Global Variables ---
let currentSupplierId = null;
let currentSupplierData = null;
let purchaseOrdersData = [];
let supplierPaymentsData = [];
let listenersAttached = false;

// Object to hold references to DOM elements
let pageElements = {};

// --- Helper Functions ---
function displayError(message, elementId = 'generalErrorDisplay') {
    console.error("Error:", message);
    // Use pageElements if available, otherwise fallback to getElementById
    const errorElement = pageElements[elementId] || document.getElementById(elementId);
    const generalErrorElement = pageElements.generalErrorDisplay || document.getElementById('generalErrorDisplay');

    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    } else if (generalErrorElement) {
        generalErrorElement.textContent = `Error (${elementId}): ${message}`;
        generalErrorElement.style.display = 'block';
    } else {
        alert(`Error: ${message}`); // Ultimate fallback
    }
    // Hide loading indicators on error
    hideLoading('poListLoading');
    hideLoading('paymentListLoading');
    hideLoading('loadingIndicator');
}

function clearError(elementId = 'generalErrorDisplay') {
    const errorElement = pageElements[elementId] || document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
    // Clear all common error fields
    const idsToClear = ['generalErrorDisplay', 'paymentMadeError', 'editSupplierError', 'adjustmentError', 'editPoError', 'poListError', 'paymentListError'];
    idsToClear.forEach(id => {
        const el = pageElements[id] || document.getElementById(id);
        if(el) {
            el.textContent = '';
            el.style.display = 'none';
        }
    });
}

function showLoading(elementId) {
    const loadingElement = pageElements[elementId] || document.getElementById(elementId);
    if (loadingElement) {
        loadingElement.style.display = 'block';
    }
}

function hideLoading(elementId) {
    const loadingElement = pageElements[elementId] || document.getElementById(elementId);
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

function formatCurrency(amount) {
    const numAmount = Number(amount);
    if (isNaN(numAmount)) return '₹ 0.00';
    return `₹ ${numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(timestamp) {
    if (timestamp && timestamp.toDate) {
        return timestamp.toDate().toLocaleDateString('en-CA'); // yyyy-MM-dd
    } else if (timestamp) {
        try { return new Date(timestamp).toLocaleDateString('en-CA'); }
        catch (e) { return 'Invalid Date'; }
    }
    return 'N/A';
}

function getSupplierIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// --- Modal Handling Functions ---
function openModal(modalElement) {
    if (modalElement) modalElement.style.display = 'flex';
    else console.warn("Attempted to open a non-existent modal");
}

function closeModal(modalElement) {
    if (modalElement) modalElement.style.display = 'none';
    else console.warn("Attempted to close a non-existent modal");
}

// Edit Supplier Modal
function openEditSupplierModal() {
    if (!currentSupplierData) { displayError("Supplier data not loaded.", 'editSupplierError'); return; }
    if (!pageElements.editSupplierModal) { console.error("Edit supplier modal element not found"); return;}
    clearError('editSupplierError');
    // Use pageElements for form inputs
    if(pageElements.editSupplierNameInput) pageElements.editSupplierNameInput.value = currentSupplierData.name || '';
    if(pageElements.editSupplierWhatsappInput) pageElements.editSupplierWhatsappInput.value = currentSupplierData.whatsappNo || '';
    if(pageElements.editSupplierContactInput) pageElements.editSupplierContactInput.value = currentSupplierData.contactNo || '';
    if(pageElements.editSupplierEmailInput) pageElements.editSupplierEmailInput.value = currentSupplierData.email || '';
    if(pageElements.editSupplierGstInput) pageElements.editSupplierGstInput.value = currentSupplierData.gstNo || '';
    if(pageElements.editSupplierAddressInput) pageElements.editSupplierAddressInput.value = currentSupplierData.address || '';
    if(pageElements.editingSupplierIdInput) pageElements.editingSupplierIdInput.value = currentSupplierId;
    openModal(pageElements.editSupplierModal);
}
function closeEditSupplierModal() { if(pageElements.editSupplierModal) closeModal(pageElements.editSupplierModal); }

// Payment Modal
function openPaymentModal() {
    if (!pageElements.paymentModal || !pageElements.paymentForm) { console.error("Payment modal or form element not found"); return;}
    clearError('paymentMadeError');
    pageElements.paymentForm.reset();
    if(pageElements.paymentDateInput) pageElements.paymentDateInput.value = new Date().toLocaleDateString('en-CA');
    if(pageElements.paymentPoCheckboxList) {
        pageElements.paymentPoCheckboxList.innerHTML = '<p><em>Unpaid POs will load here in Stage 2...</em></p>';
    } else { console.warn("Payment PO Checkbox List element not found"); }
    openModal(pageElements.paymentModal);
}
function closePaymentModal() { if(pageElements.paymentModal) closeModal(pageElements.paymentModal); }

// --- STAGE 1: New Modal Handlers ---
// Adjustment Modal
function openAdjustmentModal() {
     if (!pageElements.adjustmentModal || !pageElements.adjustmentForm) { console.error("Adjustment modal or form element not found"); return;}
    clearError('adjustmentError');
    pageElements.adjustmentForm.reset();
    if(pageElements.adjustmentDateInput) pageElements.adjustmentDateInput.value = new Date().toLocaleDateString('en-CA');
    openModal(pageElements.adjustmentModal);
}
function closeAdjustmentModal() { if(pageElements.adjustmentModal) closeModal(pageElements.adjustmentModal); }

// PO Edit Modal
function openEditPoModal(poId = null) {
    if (!pageElements.editPoModal || !pageElements.editPoForm) { console.error("PO Edit modal or form element not found"); return;}
    clearError('editPoError');
    pageElements.editPoForm.reset();
    console.log("Attempting to open PO Edit Modal for PO ID:", poId);
    if (!poId) console.warn("No PO ID provided for editing.");

    // Placeholder data loading (Stage 2/3)
    if(pageElements.editingPoIdInput) pageElements.editingPoIdInput.value = poId || '';
    if(pageElements.editPoNumberInput) pageElements.editPoNumberInput.value = poId ? `Loading for ${poId}...` : 'N/A';
    openModal(pageElements.editPoModal);
}
function closeEditPoModal() { if(pageElements.editPoModal) closeModal(pageElements.editPoModal); }

// --- Data Loading and Display ---
async function loadSupplierAccountData() {
    currentSupplierId = getSupplierIdFromUrl();
    if (!currentSupplierId) { displayError("No supplier ID provided in URL."); hideLoading('loadingIndicator'); return; }
    console.log("Loading data for supplier:", currentSupplierId);
    showLoading('loadingIndicator');
    clearError();

    try {
        const supplierRef = doc(db, "suppliers", currentSupplierId);
        const supplierSnap = await getDoc(supplierRef);

        if (supplierSnap.exists()) {
            currentSupplierData = { id: supplierSnap.id, ...supplierSnap.data() };
            displaySupplierDetails(currentSupplierData); // This function now uses pageElements
            await loadPurchaseOrders();
            await loadSupplierPaymentsAndAdjustments();
            calculateAndDisplayBalance(); // This function now uses pageElements
        } else {
            displayError("Supplier not found.");
            currentSupplierData = null;
        }
    } catch (error) {
        console.error("Error loading supplier data: ", error);
        displayError(`Failed to load supplier details: ${error.message || error}`); // Display the actual error
        currentSupplierData = null;
        // Re-throw the error if needed for initializePage's catch block
        throw error;
    } finally {
         // Loading indicator is hidden in initializePage's finally block now
    }
}

function displaySupplierDetails(supplierData) {
    if (!supplierData || !pageElements) return; // Ensure elements are queried
    if(pageElements.supplierNameDisplay) pageElements.supplierNameDisplay.textContent = supplierData.name || 'N/A';
    if(pageElements.supplierContactDisplay) pageElements.supplierContactDisplay.textContent = supplierData.contactNo || 'N/A';
    if(pageElements.supplierWhatsappDisplay) pageElements.supplierWhatsappDisplay.textContent = supplierData.whatsappNo || 'N/A';
    if(pageElements.supplierEmailDisplay) pageElements.supplierEmailDisplay.textContent = supplierData.email || 'N/A';
    if(pageElements.supplierGstDisplay) pageElements.supplierGstDisplay.textContent = supplierData.gstNo || 'N/A';
    if(pageElements.supplierAddressDisplay) pageElements.supplierAddressDisplay.textContent = supplierData.address || 'N/A';

    // Update Status Indicator
    if (pageElements.supplierStatusIndicator && pageElements.toggleStatusBtnText) {
        if (supplierData.status === 'disabled') {
            pageElements.supplierStatusIndicator.textContent = '(Disabled)';
            pageElements.supplierStatusIndicator.className = 'supplier-disabled-indicator';
            pageElements.toggleStatusBtnText.textContent = 'Enable';
        } else {
            pageElements.supplierStatusIndicator.textContent = '';
            pageElements.supplierStatusIndicator.className = '';
            pageElements.toggleStatusBtnText.textContent = 'Disable';
        }
    }
}

async function loadPurchaseOrders() {
    if (!currentSupplierId || !pageElements.poTableBody) return;
    showLoading('poListLoading');
    clearError('poListError');
    pageElements.poTableBody.innerHTML = ''; // Clear existing rows

    try {
        const q = query(collection(db, "purchaseOrders"),
                        where("supplierId", "==", currentSupplierId),
                        orderBy("poDate", "desc"));
        const querySnapshot = await getDocs(q);
        purchaseOrdersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if(pageElements.poCountSpan) pageElements.poCountSpan.textContent = purchaseOrdersData.length;

        if (purchaseOrdersData.length === 0) {
            pageElements.poTableBody.innerHTML = '<tr><td colspan="6">No purchase orders found for this supplier.</td></tr>';
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
    if (!currentSupplierId || !pageElements.paymentTableBody) return;
    showLoading('paymentListLoading');
    clearError('paymentListError');
    pageElements.paymentTableBody.innerHTML = '';

    try {
        const qPayments = query(collection(db, "payments"),
                                where("supplierId", "==", currentSupplierId),
                                orderBy("paymentDate", "desc"));
        const querySnapshot = await getDocs(qPayments);
        supplierPaymentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if(pageElements.paymentCountSpan) pageElements.paymentCountSpan.textContent = supplierPaymentsData.length;

        if (supplierPaymentsData.length === 0) {
            pageElements.paymentTableBody.innerHTML = '<tr><td colspan="7">No payments or adjustments found.</td></tr>';
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

function renderPurchaseOrdersTable(pos) {
    if (!pageElements.poTableBody) return;
    pageElements.poTableBody.innerHTML = '';
    if (!pos || pos.length === 0) {
        pageElements.poTableBody.innerHTML = '<tr><td colspan="6">No purchase orders found.</td></tr>';
        return;
    }
    pos.forEach(po => {
        const row = pageElements.poTableBody.insertRow();
        row.setAttribute('data-po-id', po.id);
        row.insertCell().textContent = po.poNumber || 'N/A';
        row.insertCell().textContent = formatDate(po.poDate);
        row.insertCell().textContent = formatCurrency(po.totalAmount);
        row.insertCell().innerHTML = `<span class="status status-${(po.status || 'unknown').toLowerCase()}">${po.status || 'Unknown'}</span>`;
        row.insertCell().innerHTML = `<span class="status status-${(po.paymentStatus || 'unpaid').toLowerCase()}">${po.paymentStatus || 'Unpaid'}</span>`;
        const actionCell = row.insertCell();
        const editButton = document.createElement('button');
        editButton.innerHTML = '<i class="fas fa-edit"></i> Edit';
        editButton.className = 'button small-button edit-po-button';
        editButton.onclick = (event) => { event.stopPropagation(); openEditPoModal(po.id); };
        actionCell.appendChild(editButton);
    });
}

function renderPaymentsTable(payments) {
     if (!pageElements.paymentTableBody) return;
    pageElements.paymentTableBody.innerHTML = '';
    if (!payments || payments.length === 0) {
        pageElements.paymentTableBody.innerHTML = '<tr><td colspan="7">No payments or adjustments found.</td></tr>';
        return;
    }
    payments.forEach(p => {
        const row = pageElements.paymentTableBody.insertRow();
        const paymentType = p.type || 'payment';
        row.insertCell().textContent = formatDate(p.paymentDate || p.adjustmentDate);
        row.insertCell().textContent = formatCurrency(p.amount || p.adjustmentAmount);
        row.insertCell().textContent = p.paymentMode || (paymentType === 'adjustment' ? 'N/A' : 'N/A');
        row.insertCell().textContent = paymentType.charAt(0).toUpperCase() + paymentType.slice(1);
        let linkedPoText = 'N/A';
        if (paymentType === 'payment' && p.linkedPoIds && Array.isArray(p.linkedPoIds) && p.linkedPoIds.length > 0) {
            linkedPoText = p.linkedPoIds.join(', ');
        }
        row.insertCell().textContent = linkedPoText;
        row.insertCell().textContent = p.notes || p.reason || 'N/A';
        const actionCell = row.insertCell();
        actionCell.innerHTML = `<button class="button small-button danger-button delete-payment-button" data-id="${p.id}" data-type="${paymentType}" style="display: none;"><i class="fas fa-trash"></i></button>`; // Hidden until Stage 3
    });
}

function calculateAndDisplayBalance() {
     if (!pageElements) return; // Ensure elements are queried

    let totalPO = purchaseOrdersData.reduce((sum, po) => sum + (Number(po.totalAmount) || 0), 0);
    let totalPaid = 0;
    let totalAdjustments = 0;

    supplierPaymentsData.forEach(p => {
        const amount = Number(p.amount || p.adjustmentAmount) || 0;
        const type = p.type || 'payment';
        if (type === 'payment') totalPaid += amount;
        else if (type === 'adjustment') totalAdjustments += amount; // Assuming sign handled in save logic (Stage 2)
    });

    const balance = totalPaid + totalAdjustments - totalPO;

    if(pageElements.totalPoAmountDisplay) pageElements.totalPoAmountDisplay.textContent = formatCurrency(totalPO);
    if(pageElements.totalPaidAmountDisplay) pageElements.totalPaidAmountDisplay.textContent = formatCurrency(totalPaid);
    if(pageElements.totalAdjustmentAmountDisplay) pageElements.totalAdjustmentAmountDisplay.textContent = formatCurrency(totalAdjustments);
    if(pageElements.currentBalanceDisplay) {
        pageElements.currentBalanceDisplay.textContent = formatCurrency(balance);
        pageElements.currentBalanceDisplay.classList.remove('balance-positive', 'balance-negative', 'balance-zero');
        if (balance > 0) pageElements.currentBalanceDisplay.classList.add('balance-positive');
        else if (balance < 0) pageElements.currentBalanceDisplay.classList.add('balance-negative');
        else pageElements.currentBalanceDisplay.classList.add('balance-zero');
    }
}

// --- Event Handlers ---
async function handleEditSupplierSubmit(event) {
    event.preventDefault();
    if (!pageElements.editingSupplierIdInput) return;
    const supplierId = pageElements.editingSupplierIdInput.value;
    if (!supplierId) { displayError("No supplier ID found for update.", 'editSupplierError'); return; }

    const updatedData = {
        name: pageElements.editSupplierNameInput?.value.trim() || '',
        whatsappNo: pageElements.editSupplierWhatsappInput?.value.trim() || '',
        contactNo: pageElements.editSupplierContactInput?.value.trim() || '',
        email: pageElements.editSupplierEmailInput?.value.trim() || '',
        gstNo: pageElements.editSupplierGstInput?.value.trim() || '',
        address: pageElements.editSupplierAddressInput?.value.trim() || '',
    };

    try {
        const supplierRef = doc(db, "suppliers", supplierId);
        await updateDoc(supplierRef, updatedData);
        closeEditSupplierModal();
        await loadSupplierAccountData(); // Reload all data
    } catch (error) {
        console.error("Error updating supplier: ", error);
        displayError(`Failed to update supplier: ${error.message}`, 'editSupplierError');
    }
}

async function handlePaymentSubmit(event) {
    event.preventDefault();
    if (!pageElements.paymentAmountInput || !pageElements.paymentDateInput || !pageElements.paymentModeInput || !pageElements.paymentNotesInput || !pageElements.paymentPoCheckboxList) {
        displayError("Payment form elements missing.", 'paymentMadeError');
        return;
    }
    const amount = parseFloat(pageElements.paymentAmountInput.value);
    const paymentDate = pageElements.paymentDateInput.value;
    const paymentMode = pageElements.paymentModeInput.value.trim();
    const notes = pageElements.paymentNotesInput.value.trim();

    const linkedPoIds = [];
    const checkedBoxes = pageElements.paymentPoCheckboxList.querySelectorAll('input[type="checkbox"]:checked');
    checkedBoxes.forEach(box => linkedPoIds.push(box.value));
    console.log("Selected PO IDs (Stage 2 Placeholder):", linkedPoIds);

    if (isNaN(amount) || amount <= 0) { displayError("Please enter a valid positive amount.", 'paymentMadeError'); return; }
    if (!paymentDate) { displayError("Please select a payment date.", 'paymentMadeError'); return; }
    if (!currentSupplierId) { displayError("Supplier ID is missing.", 'paymentMadeError'); return; }

    const paymentData = {
        supplierId: currentSupplierId, amount: amount, paymentDate: Timestamp.fromDate(new Date(paymentDate)),
        paymentMode: paymentMode, notes: notes, linkedPoIds: linkedPoIds, type: 'payment', createdAt: serverTimestamp()
    };

    console.log("Saving Payment Data (Stage 1 - Basic):", paymentData);
    try {
        const docRef = await addDoc(collection(db, "payments"), paymentData);
        console.log("Payment added with ID: ", docRef.id);
        closePaymentModal();
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
    if (!currentSupplierId) { alert("Supplier ID not found."); return; }
    alert(`Action: Add PO for supplier ${currentSupplierId} (Implement redirect/modal in Stage 2)`);
}

async function handleAdjustmentSubmit(event) {
    event.preventDefault();
    console.log("Save Adjustment button clicked - Stage 1 Placeholder");
    alert("Saving adjustment is not implemented in Stage 1. See Stage 2.");
    // Close modal for now in Stage 1 testing
    closeAdjustmentModal();
}

async function handleToggleSupplierStatus() {
    console.log("Toggle Supplier Status button clicked - Stage 1 Placeholder");
    if (!currentSupplierData) { alert("Supplier data not loaded."); return; }
    const currentStatus = currentSupplierData.status || 'active';
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    alert(`Action: Change status to ${newStatus} (Implement in Stage 2 with confirmation)`);
}

async function handleDeleteSupplier() {
    console.log("Delete Supplier button clicked - Stage 1 Placeholder");
    if (!currentSupplierData) { alert("Supplier data not loaded."); return; }
    alert("Action: Delete Supplier (Implement in Stage 2/3 with STRONG confirmation!)");
}

async function handleEditPoSubmit(event) {
    event.preventDefault();
    console.log("Update PO button clicked - Stage 1 Placeholder");
    if (!pageElements.editingPoIdInput) return;
    const poId = pageElements.editingPoIdInput.value;
    if (!poId) { displayError("No PO ID found for updating.", 'editPoError'); return; }
    alert(`Action: Update PO ${poId} (Implement in Stage 2)`);
     // Close modal for now in Stage 1 testing
     closeEditPoModal();
}

// --- DOM Element Querying ---
function queryPageElements() {
    console.log("Querying DOM elements...");
    pageElements = {
        // Supplier Details
        supplierNameDisplay: document.getElementById('supplierNameDisplay'),
        supplierContactDisplay: document.getElementById('supplierContactDisplay'),
        supplierWhatsappDisplay: document.getElementById('supplierWhatsappDisplay'),
        supplierEmailDisplay: document.getElementById('supplierEmailDisplay'),
        supplierGstDisplay: document.getElementById('supplierGstDisplay'),
        supplierAddressDisplay: document.getElementById('supplierAddressDisplay'),
        supplierStatusIndicator: document.getElementById('supplierStatusIndicator'),
        // Balance Info
        totalPoAmountDisplay: document.getElementById('totalPoAmount'),
        totalPaidAmountDisplay: document.getElementById('totalPaidAmount'),
        totalAdjustmentAmountDisplay: document.getElementById('totalAdjustmentAmount'),
        currentBalanceDisplay: document.getElementById('currentBalance'),
        // Lists & Sections
        poTableBody: document.getElementById('supplierPoTableBody'),
        paymentTableBody: document.getElementById('supplierPaymentTableBody'),
        poListError: document.getElementById('poListError'),
        paymentListError: document.getElementById('paymentListError'),
        poListLoading: document.getElementById('poListLoading'),
        paymentListLoading: document.getElementById('paymentListLoading'),
        poSection: document.getElementById('poSection'),
        paymentSection: document.getElementById('paymentSection'),
        poCountSpan: document.getElementById('poCount'), // Added ID in HTML assumed
        paymentCountSpan: document.getElementById('paymentCount'), // Added ID in HTML assumed
        // Action Buttons
        editSupplierBtn: document.getElementById('editSupplierBtn'),
        addPaymentBtn: document.getElementById('addPaymentBtn'),
        addNewPoBtn: document.getElementById('addNewPoBtn'),
        addAdjustmentBtn: document.getElementById('addAdjustmentBtn'),
        toggleSupplierStatusBtn: document.getElementById('toggleSupplierStatusBtn'),
        deleteSupplierBtn: document.getElementById('deleteSupplierBtn'),
        toggleStatusBtnText: document.getElementById('toggleStatusBtnText'), // Span inside toggle btn
        // Modals
        paymentModal: document.getElementById('paymentModal'),
        editSupplierModal: document.getElementById('editSupplierModal'),
        adjustmentModal: document.getElementById('adjustmentModal'),
        editPoModal: document.getElementById('editPoModal'),
        // Modal Close Buttons
        closePaymentModalBtn: document.getElementById('closePaymentModalBtn'),
        closeEditSupplierModalBtn: document.getElementById('closeEditSupplierModalBtn'),
        closeAdjustmentModalBtn: document.getElementById('closeAdjustmentModalBtn'),
        closeEditPoModalBtn: document.getElementById('closeEditPoModalBtn'),
        // Modal Forms
        paymentForm: document.getElementById('paymentForm'),
        editSupplierForm: document.getElementById('editSupplierForm'),
        adjustmentForm: document.getElementById('adjustmentForm'),
        editPoForm: document.getElementById('editPoForm'),
        // Modal Form Inputs (Examples - Add all needed)
        paymentAmountInput: document.getElementById('paymentAmountInput'),
        paymentDateInput: document.getElementById('paymentDateInput'),
        paymentModeInput: document.getElementById('paymentModeInput'),
        paymentNotesInput: document.getElementById('paymentNotesInput'),
        paymentPoCheckboxList: document.getElementById('paymentPoCheckboxList'),
        editSupplierNameInput: document.getElementById('editSupplierNameInput'),
        editSupplierWhatsappInput: document.getElementById('editSupplierWhatsappInput'),
        editSupplierContactInput: document.getElementById('editSupplierContactInput'),
        editSupplierEmailInput: document.getElementById('editSupplierEmailInput'),
        editSupplierGstInput: document.getElementById('editSupplierGstInput'),
        editSupplierAddressInput: document.getElementById('editSupplierAddressInput'),
        editingSupplierIdInput: document.getElementById('editingSupplierId'), // Corrected ID name if needed
        adjustmentDateInput: document.getElementById('adjustmentDateInput'),
        editingPoIdInput: document.getElementById('editingPoId'), // Corrected ID name if needed
        editPoNumberInput: document.getElementById('editPoNumberInput'),
        // Modal Action Buttons
        savePaymentBtn: document.getElementById('savePaymentBtn'),
        updateSupplierBtn: document.getElementById('updateSupplierBtn'),
        saveAdjustmentBtn: document.getElementById('saveAdjustmentBtn'),
        updatePoBtn: document.getElementById('updatePoBtn'),
        cancelPaymentBtn: document.getElementById('cancelPaymentBtn'),
        cancelEditSupplierBtn: document.getElementById('cancelEditSupplierBtn'),
        cancelAdjustmentBtn: document.getElementById('cancelAdjustmentBtn'),
        cancelEditPoBtn: document.getElementById('cancelEditPoBtn'),
        // Core Page Elements
        detailMainContent: document.getElementById('detailMainContent'),
        loadingIndicator: document.getElementById('loadingIndicator'),
        generalErrorDisplay: document.getElementById('generalErrorDisplay'),
        userEmailDisplay: document.getElementById('userEmailDisplay'),
        logoutBtn: document.getElementById('logoutBtn')
    };
     // Check if critical elements were found
     const criticalElements = ['detailMainContent', 'loadingIndicator', 'supplierNameDisplay', 'poTableBody', 'paymentTableBody'];
     let missingCritical = false;
     criticalElements.forEach(id => {
         if (!pageElements[id]) {
             console.error(`Critical element with ID '${id}' not found!`);
             missingCritical = true;
         }
     });
     console.log("DOM element querying complete.");
     return !missingCritical; // Return true if all critical elements are found
}

// --- Event Listener Attachment ---
function attachEventListeners() {
    if (listenersAttached) return;
    if (Object.keys(pageElements).length === 0) {
        console.error("DOM elements not queried before attaching listeners.");
        return;
    }
    console.log("Attaching event listeners...");

    // Use pageElements object for attaching listeners
    if (pageElements.editSupplierBtn) pageElements.editSupplierBtn.addEventListener('click', openEditSupplierModal); else console.warn("Edit Supplier Btn not found");
    if (pageElements.addPaymentBtn) pageElements.addPaymentBtn.addEventListener('click', openPaymentModal); else console.warn("Add Payment Btn not found");
    // Stage 1 New Buttons
    if (pageElements.addAdjustmentBtn) pageElements.addAdjustmentBtn.addEventListener('click', openAdjustmentModal); else console.warn("Add Adjustment Btn not found");
    if (pageElements.addNewPoBtn) pageElements.addNewPoBtn.addEventListener('click', handleAddNewPo); else console.warn("Add New PO Btn not found");
    if (pageElements.toggleSupplierStatusBtn) pageElements.toggleSupplierStatusBtn.addEventListener('click', handleToggleSupplierStatus); else console.warn("Toggle Status Btn not found");
    if (pageElements.deleteSupplierBtn) pageElements.deleteSupplierBtn.addEventListener('click', handleDeleteSupplier); else console.warn("Delete Supplier Btn not found");

     // Listener for clicking on PO table (delegated) - Handles Edit Button click
    if (pageElements.poTableBody) {
         pageElements.poTableBody.addEventListener('click', (event) => {
             const editButton = event.target.closest('.edit-po-button');
             const row = event.target.closest('tr[data-po-id]');
             if (editButton && row) {
                 const poId = row.getAttribute('data-po-id');
                 console.log(`Edit button clicked for PO ID: ${poId}`);
                 // openEditPoModal(poId); // Already handled by button's direct onclick
             } else if (row) {
                 const poId = row.getAttribute('data-po-id');
                 console.log(`PO Row clicked, ID: ${poId}`);
             }
         });
    } else { console.warn("PO Table Body not found for event delegation"); }

    // Modal Close/Cancel Buttons
    if (pageElements.closePaymentModalBtn) pageElements.closePaymentModalBtn.addEventListener('click', closePaymentModal); else console.warn("Close Payment Modal Btn not found");
    if (pageElements.cancelPaymentBtn) pageElements.cancelPaymentBtn.addEventListener('click', closePaymentModal); else console.warn("Cancel Payment Btn not found");
    if (pageElements.closeEditSupplierModalBtn) pageElements.closeEditSupplierModalBtn.addEventListener('click', closeEditSupplierModal); else console.warn("Close Edit Supplier Modal Btn not found");
    if (pageElements.cancelEditSupplierBtn) pageElements.cancelEditSupplierBtn.addEventListener('click', closeEditSupplierModal); else console.warn("Cancel Edit Supplier Btn not found");
    if (pageElements.closeAdjustmentModalBtn) pageElements.closeAdjustmentModalBtn.addEventListener('click', closeAdjustmentModal); else console.warn("Close Adjustment Modal Btn not found");
    if (pageElements.cancelAdjustmentBtn) pageElements.cancelAdjustmentBtn.addEventListener('click', closeAdjustmentModal); else console.warn("Cancel Adjustment Btn not found");
    if (pageElements.closeEditPoModalBtn) pageElements.closeEditPoModalBtn.addEventListener('click', closeEditPoModal); else console.warn("Close Edit PO Modal Btn not found");
    if (pageElements.cancelEditPoBtn) pageElements.cancelEditPoBtn.addEventListener('click', closeEditPoModal); else console.warn("Cancel Edit PO Btn not found");

    // Modal Forms
    if (pageElements.paymentForm) pageElements.paymentForm.addEventListener('submit', handlePaymentSubmit); else console.warn("Payment Form not found");
    if (pageElements.editSupplierForm) pageElements.editSupplierForm.addEventListener('submit', handleEditSupplierSubmit); else console.warn("Edit Supplier Form not found");
    if (pageElements.adjustmentForm) pageElements.adjustmentForm.addEventListener('submit', handleAdjustmentSubmit); else console.warn("Adjustment Form not found");
    if (pageElements.editPoForm) pageElements.editPoForm.addEventListener('submit', handleEditPoSubmit); else console.warn("Edit PO Form not found");

    // Logout Button
     if (pageElements.logoutBtn) {
         pageElements.logoutBtn.style.display = 'inline-block'; // Ensure visible
         pageElements.logoutBtn.onclick = () => signOut(auth).then(() => window.location.href = 'index.html');
     } else console.warn("Logout button not found");


    // Modal background click to close (Optional but good practice)
    [pageElements.paymentModal, pageElements.editSupplierModal, pageElements.adjustmentModal, pageElements.editPoModal].forEach(modal => {
         if (modal) {
             modal.addEventListener('click', (event) => {
                 if (event.target === modal) closeModal(modal);
             });
         }
    });

    listenersAttached = true;
    console.log("Event listeners attached successfully.");
}

// --- Global Initialization & Auth Handling ---
async function initializePage() {
    console.log("DOM Loaded. Initializing Supplier Detail Page...");

    // 1. Query elements as soon as DOM is ready
    if (!queryPageElements()) {
        displayError("Page structure is broken. Some critical elements are missing. Cannot initialize fully.");
        // Attempt to show main content to display the error
        if (pageElements.detailMainContent) pageElements.detailMainContent.style.visibility = 'visible';
        hideLoading('loadingIndicator'); // Hide loading indicator if structure is broken
        return; // Stop initialization if critical elements are missing
    }

    // 2. Check Authentication
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("User is authenticated:", user.email);
            if (pageElements.userEmailDisplay) pageElements.userEmailDisplay.textContent = user.email;

            // 3. Get Supplier ID
            currentSupplierId = getSupplierIdFromUrl();
            if (!currentSupplierId) {
                displayError("No Supplier ID specified in the URL.");
                hideLoading('loadingIndicator');
                if(pageElements.detailMainContent) pageElements.detailMainContent.style.visibility = 'visible';
                return;
            }

            // 4. Load Data and Attach Listeners
            try {
                showLoading('loadingIndicator'); // Show loading before async operations
                await loadSupplierAccountData(); // Load data (which calls display functions)
                attachEventListeners();          // Attach listeners AFTER data is loaded and potentially displayed
                console.log("Initialization sequence complete.");
            } catch (err) {
                // Error during data load is already logged by loadSupplierAccountData
                // Display a general failure message if needed
                console.error("Caught error during initialization data load:", err);
                 displayError("Failed to load supplier data completely.");
            } finally {
                 hideLoading('loadingIndicator'); // Hide loading indicator regardless of success/failure
                 if(pageElements.detailMainContent) pageElements.detailMainContent.style.visibility = 'visible'; // Ensure content area is visible
            }

        } else {
            console.log("User is not authenticated. Redirecting to login.");
            window.location.href = 'index.html';
        }
    });
}

// --- Run Initialization ---
// Use DOMContentLoaded to ensure HTML is parsed before querying elements.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    // DOM already loaded, safe to initialize
    initializePage();
}