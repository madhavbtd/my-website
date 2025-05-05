// js/supplier_account_detail.js - v4.1 (Step 2+3 Added: Buttons + Placeholders)

import { db, auth } from './firebase-init.js';
import {
    doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp,
    addDoc, serverTimestamp, updateDoc, runTransaction, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"; // Added signOut

// --- Global Variables ---
let currentSupplierId = null;
let currentSupplierData = null; // Store full supplier data object
let purchaseOrdersData = [];
let supplierPaymentsData = [];
let listenersAttached = false;
let supplierDetailPageInitialized = false;
let unpaidPOs = []; // Store unpaid POs for payment modal

// --- Helper Functions ---
function displayError(message, elementId = 'generalErrorDisplay') {
    console.error("Displaying Error:", message, "on element:", elementId);
    try {
        let errorElement = document.getElementById(elementId);
        // Fallback search logic (keep or simplify based on final HTML IDs)
        if (!errorElement) errorElement = document.getElementById('paymentMadeError');
        if (!errorElement) errorElement = document.getElementById('editSupplierError');
        if (!errorElement) errorElement = document.getElementById('supplierPaymentListError');
        if (!errorElement) errorElement = document.getElementById('supplierPoListError');
        if (!errorElement) errorElement = document.getElementById('generalErrorDisplay'); // Ensure general is checked last

        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            console.log(`Error displayed on #${elementId}: ${message}`);
        } else {
            console.warn(`Element with ID '${elementId}' not found for error display.`);
            // Fallback to general error display if specific one not found
            const generalError = document.getElementById('generalErrorDisplay');
            if(generalError){
                 generalError.textContent = `Error (${elementId}): ${message}`;
                 generalError.style.display = 'block';
            } else {
                 alert(`Error: ${message}`); // Ultimate fallback
            }
        }
    } catch (e) {
        console.error("Exception in displayError:", e);
        alert(`Critical Error: ${message}`);
    }
     // Optionally hide loading indicators on error
    // hideLoading('poListLoading');
    // hideLoading('paymentListLoading');
}

function clearError(elementId = null) {
    const idsToClear = elementId ? [elementId] : ['generalErrorDisplay', 'paymentMadeError', 'editSupplierError', 'supplierPoListError', 'supplierPaymentListError'];
    idsToClear.forEach(id => {
        const errorElement = document.getElementById(id);
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
    });
}

function showLoading(elementId) {
    const loadingElement = document.getElementById(elementId);
    if (loadingElement) {
        loadingElement.style.display = 'block';
    } else {
        console.warn(`Loading element '${elementId}' not found.`);
    }
}

function hideLoading(elementId) {
    const loadingElement = document.getElementById(elementId);
    if (loadingElement) {
        loadingElement.style.display = 'none';
    } else {
        console.warn(`Loading element '${elementId}' not found.`);
    }
}

function formatCurrency(amount) {
    const numAmount = Number(amount);
    if (isNaN(numAmount)) return '₹ 0.00';
    return `₹ ${numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(timestamp) {
    if (timestamp && timestamp.toDate) {
        try { return timestamp.toDate().toLocaleDateString('en-CA'); } // yyyy-MM-dd
        catch(e){ console.warn("Invalid Firestore Timestamp:", timestamp); return "Invalid Date"; }
    } else if (timestamp && typeof timestamp === 'string') {
         try { return new Date(timestamp).toLocaleDateString('en-CA'); }
         catch (e) { console.warn("Invalid Date String:", timestamp); return 'Invalid Date'; }
    } else if (timestamp && typeof timestamp === 'number') { // Handle milliseconds epoch
         try { return new Date(timestamp).toLocaleDateString('en-CA'); }
         catch (e) { console.warn("Invalid Number Timestamp:", timestamp); return 'Invalid Date'; }
    }
    return 'N/A';
}


function getSupplierIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// --- Modal Handling Functions ---
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'flex';
    else console.error(`Modal with ID ${modalId} not found.`);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
    else console.error(`Modal with ID ${modalId} not found.`);
}

// Edit Supplier Modal Specifics
function openEditSupplierModal() {
    if (!currentSupplierData) { displayError("Supplier data not loaded.", 'editSupplierError'); return; }
    clearError('editSupplierError');
    document.getElementById('editSupplierNameInput').value = currentSupplierData.name || '';
    document.getElementById('editSupplierWhatsappInput').value = currentSupplierData.whatsappNo || '';
    document.getElementById('editSupplierContactInput').value = currentSupplierData.contactNo || '';
    document.getElementById('editSupplierEmailInput').value = currentSupplierData.email || '';
    document.getElementById('editSupplierGstInput').value = currentSupplierData.gstNo || '';
    document.getElementById('editSupplierAddressInput').value = currentSupplierData.address || '';
    document.getElementById('editingSupplierId').value = currentSupplierId;
    openModal('editSupplierModal');
}
function closeEditSupplierModal() { closeModal('editSupplierModal'); }

// Payment Modal Specifics
function openPaymentModal() {
    clearError('paymentMadeError');
    document.getElementById('paymentForm').reset();
    document.getElementById('paymentDateInput').value = new Date().toLocaleDateString('en-CA');
    populatePaymentPoCheckboxes(); // Populate checkboxes when modal opens
    openModal('paymentModal');
}
function closePaymentModal() { closeModal('paymentModal'); }

// --- Data Loading and Display ---
async function loadSupplierAccountData() {
    currentSupplierId = getSupplierIdFromUrl();
    if (!currentSupplierId) { displayError("No supplier ID provided in URL."); hideLoading('loadingIndicator'); return; }
    console.log("Loading data for supplier:", currentSupplierId);
    showLoading('loadingIndicator');
    clearError(); // Clear all general errors

    try {
        const supplierRef = doc(db, "suppliers", currentSupplierId);
        const supplierSnap = await getDoc(supplierRef);

        if (supplierSnap.exists()) {
            // currentSupplierData = { id: supplierSnap.id, ...supplierSnap.data() }; // Set globally in display function
            displaySupplierDetails({ id: supplierSnap.id, ...supplierSnap.data() }); // Display details

            // Load related data AFTER supplier details are confirmed
            await loadPurchaseOrders();
            await loadSupplierPayments();
            calculateAndDisplayBalance();
            if (!listenersAttached) attachEventListeners(); // Attach listeners after first load if needed

        } else {
            displayError("Supplier not found.");
            currentSupplierData = null;
        }
    } catch (error) {
        console.error("Error loading supplier account data: ", error);
        displayError(`Failed to load supplier details: ${error.message || error}`);
        currentSupplierData = null; // Reset data on error
    } finally {
         hideLoading('loadingIndicator');
         const mainContent = document.getElementById('detailMainContent');
         if (mainContent) mainContent.style.visibility = 'visible'; // Ensure content is visible even on error
    }
}

function displaySupplierDetails(supplierData) {
    if (!supplierData) return;
    // Update global variable
    currentSupplierData = supplierData;

    document.getElementById('supplierNameDisplay').textContent = supplierData.name || 'N/A';
    document.getElementById('supplierContactDisplay').textContent = supplierData.contactNo || 'N/A';
    document.getElementById('supplierWhatsappDisplay').textContent = supplierData.whatsappNo || 'N/A';
    document.getElementById('supplierEmailDisplay').textContent = supplierData.email || 'N/A';
    document.getElementById('supplierGstDisplay').textContent = supplierData.gstNo || 'N/A';
    document.getElementById('supplierAddressDisplay').textContent = supplierData.address || 'N/A';

    // Update Status Indicator and Toggle Button Text (Step 3 Integration)
    const statusIndicator = document.getElementById('supplierStatusIndicator');
    const toggleBtnTextSpan = document.getElementById('toggleStatusBtnText');

    if (statusIndicator) {
        if (supplierData.status === 'disabled') {
            statusIndicator.textContent = '(Disabled)';
            statusIndicator.className = 'supplier-status-indicator status-disabled';
        } else {
            statusIndicator.textContent = ''; // Clear text if active
            statusIndicator.className = 'supplier-status-indicator status-active'; // Use class for potential styling if needed
        }
    } else { console.warn("Supplier Status Indicator element not found."); }

    if (toggleBtnTextSpan) {
        toggleBtnTextSpan.textContent = (supplierData.status === 'disabled') ? 'Enable' : 'Disable';
    } else { console.warn("Toggle Status Button Text Span (#toggleStatusBtnText) not found."); }

    // Update page title if needed
    const pageTitle = document.getElementById('pageTitle');
    if(pageTitle) pageTitle.textContent = `${supplierData.name || 'Supplier'} Account Details`;

}

async function loadPurchaseOrders() {
    if (!currentSupplierId) return;
    showLoading('poListLoading');
    clearError('supplierPoListError');
    const poTableBody = document.getElementById('supplierPoTableBody');
    poTableBody.innerHTML = ''; // Clear existing rows

    try {
        const q = query(collection(db, "purchaseOrders"),
                        where("supplierId", "==", currentSupplierId),
                        orderBy("poDate", "desc"));
        const querySnapshot = await getDocs(q);
        purchaseOrdersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        document.getElementById('poCount').textContent = purchaseOrdersData.length; // Update count

        if (purchaseOrdersData.length === 0) {
            poTableBody.innerHTML = '<tr><td colspan="6">No purchase orders found for this supplier.</td></tr>';
            unpaidPOs = []; // Reset unpaid POs if none found
        } else {
            renderPurchaseOrdersTable(purchaseOrdersData);
            // Filter for unpaid POs for the payment modal
             unpaidPOs = purchaseOrdersData.filter(po => po.paymentStatus !== 'paid');
        }

    } catch (error) {
        console.error("Error loading purchase orders: ", error);
        displayError(`Failed to load POs: ${error.message}`, 'supplierPoListError');
        unpaidPOs = []; // Reset on error
    } finally {
        hideLoading('poListLoading');
    }
}

async function loadSupplierPayments() {
    if (!currentSupplierId) return;
    showLoading('paymentListLoading');
    clearError('supplierPaymentListError');
    const paymentTableBody = document.getElementById('supplierPaymentTableBody');
    paymentTableBody.innerHTML = '';

    try {
        // Fetch both payments and adjustments
        const q = query(collection(db, "payments"),
                        where("supplierId", "==", currentSupplierId),
                        orderBy("paymentDate", "desc")); // Assuming adjustments also use 'paymentDate' or a consistent field

        const querySnapshot = await getDocs(q);
        supplierPaymentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

         document.getElementById('paymentCount').textContent = supplierPaymentsData.length; // Update count

        if (supplierPaymentsData.length === 0) {
            paymentTableBody.innerHTML = '<tr><td colspan="6">No payments or adjustments found.</td></tr>';
        } else {
            renderPaymentsTable(supplierPaymentsData);
        }
    } catch (error) {
        console.error("Error loading payments/adjustments: ", error);
        displayError(`Failed to load payments: ${error.message}`, 'supplierPaymentListError');
    } finally {
        hideLoading('paymentListLoading');
    }
}

function renderPurchaseOrdersTable(pos) {
    const poTableBody = document.getElementById('supplierPoTableBody');
    poTableBody.innerHTML = ''; // Clear just in case
    if (!pos || pos.length === 0) {
         poTableBody.innerHTML = '<tr><td colspan="6">No purchase orders found.</td></tr>'; // Redundant check, but safe
        return;
    }
    pos.forEach(po => {
        const row = poTableBody.insertRow();
        row.setAttribute('data-po-id', po.id); // Add data attribute for potential future use
        row.insertCell().textContent = po.poNumber || 'N/A';
        row.insertCell().textContent = formatDate(po.poDate);
        row.insertCell().textContent = formatCurrency(po.totalAmount);
        row.insertCell().innerHTML = `<span class="status status-${(po.status || 'unknown').toLowerCase()}">${po.status || 'Unknown'}</span>`;
        row.insertCell().innerHTML = `<span class="status status-${(po.paymentStatus || 'unpaid').toLowerCase()}">${po.paymentStatus || 'Unpaid'}</span>`;
        const actionCell = row.insertCell();
        // Add edit button (placeholder for Step 7)
         actionCell.innerHTML = `<button class="button small-button edit-po-button" onclick="alert('PO Edit functionality not implemented yet (PO ID: ${po.id})')" title="Edit PO"><i class="fas fa-edit"></i></button>`;
    });
}

function renderPaymentsTable(payments) {
    const paymentTableBody = document.getElementById('supplierPaymentTableBody');
    paymentTableBody.innerHTML = ''; // Clear just in case
    if (!payments || payments.length === 0) {
        paymentTableBody.innerHTML = '<tr><td colspan="6">No payments or adjustments found.</td></tr>';
        return;
    }
    payments.forEach(p => {
        const row = paymentTableBody.insertRow();
        const paymentType = p.type || 'payment'; // Distinguish payment vs adjustment
        const dateField = p.paymentDate || p.adjustmentDate; // Use appropriate date field
        const amountField = p.amount || p.adjustmentAmount;
        const modeField = p.paymentMode || (paymentType === 'adjustment' ? p.adjustmentType || 'N/A' : 'N/A'); // Show adjustment type if available
        const notesField = p.notes || p.reason || 'N/A';

        row.insertCell().textContent = formatDate(dateField);
        row.insertCell().textContent = formatCurrency(amountField);
        row.insertCell().textContent = modeField;

        let linkedPoText = 'N/A';
        if (paymentType === 'payment' && p.linkedPoIds && Array.isArray(p.linkedPoIds) && p.linkedPoIds.length > 0) {
             // Fetch PO Numbers if needed (complex) or just show IDs
            linkedPoText = p.linkedPoIds.join(', '); //.map(id => purchaseOrdersData.find(po => po.id === id)?.poNumber || id).join(', ');
        }
        row.insertCell().textContent = linkedPoText;
        row.insertCell().textContent = notesField;

        const actionCell = row.insertCell();
        // Add delete/edit buttons later if needed
        actionCell.innerHTML = `<button class="button small-button danger-button delete-payment-button" onclick="alert('Delete payment functionality not implemented yet (Payment ID: ${p.id})')" title="Delete Payment/Adjustment"><i class="fas fa-trash"></i></button>`;
    });
}


function calculateAndDisplayBalance() {
    let totalPO = purchaseOrdersData.reduce((sum, po) => sum + (Number(po.totalAmount) || 0), 0);
    let totalPaid = 0;
    let totalAdjustments = 0;

    supplierPaymentsData.forEach(p => {
        const amount = Number(p.amount || p.adjustmentAmount) || 0;
        const type = p.type || 'payment';
        // Assuming negative adjustments are stored as negative numbers,
        // or positive numbers if adjustmentType indicates credit/debit
        if (type === 'payment') {
            totalPaid += amount;
        } else if (type === 'adjustment') {
            // Simple sum for now, refine in Stage 9 based on how adjustments are saved
            totalAdjustments += amount;
        }
    });

    // Balance: How much is owed TO the supplier (Negative) or Overpaid BY us (Positive)
    // Standard accounting: Credits (Payments/Adj+) - Debits (POs/Adj-)
    // Simplified: totalPaid + totalAdjustments - totalPO
    const balance = totalPaid + totalAdjustments - totalPO;


    document.getElementById('totalPoAmount').textContent = formatCurrency(totalPO);
    document.getElementById('totalPaidAmount').textContent = formatCurrency(totalPaid);
    document.getElementById('totalAdjustmentAmount').textContent = formatCurrency(totalAdjustments);

    const balanceElement = document.getElementById('currentBalance');
    balanceElement.textContent = formatCurrency(balance);
    balanceElement.classList.remove('balance-positive', 'balance-negative', 'balance-zero');
    if (balance > 0) {
        balanceElement.classList.add('balance-positive'); // We have paid more
    } else if (balance < 0) {
        balanceElement.classList.add('balance-negative'); // We owe money
    } else {
        balanceElement.classList.add('balance-zero');
    }
}

function populatePaymentPoCheckboxes() {
    const listDiv = document.getElementById('paymentPoCheckboxList');
    listDiv.innerHTML = ''; // Clear previous list

    if (unpaidPOs.length === 0) {
        listDiv.innerHTML = '<p>No unpaid purchase orders found.</p>';
        return;
    }

    unpaidPOs.forEach(po => {
        const div = document.createElement('div');
        div.classList.add('checkbox-item');
        const checkboxId = `po_check_${po.id}`;
        const remainingBalance = (Number(po.totalAmount) || 0) - (Number(po.amountPaid) || 0); // Assuming amountPaid exists

        div.innerHTML = `
            <input type="checkbox" id="${checkboxId}" name="linkedPoIds" value="${po.id}" data-amount="${remainingBalance}">
            <label for="${checkboxId}"> ${po.poNumber || 'N/A'} (${formatDate(po.poDate)}) - ${formatCurrency(po.totalAmount)} (Due: ${formatCurrency(remainingBalance)})</label>
        `;
        listDiv.appendChild(div);
    });
}


// --- Event Handlers ---
async function handleEditSupplierSubmit(event) {
    event.preventDefault();
    const supplierId = document.getElementById('editingSupplierId').value;
    if (!supplierId) { displayError("No supplier ID found for update.", 'editSupplierError'); return; }

    const updatedData = {
        name: document.getElementById('editSupplierNameInput').value.trim(),
        whatsappNo: document.getElementById('editSupplierWhatsappInput').value.trim(),
        contactNo: document.getElementById('editSupplierContactInput').value.trim(),
        email: document.getElementById('editSupplierEmailInput').value.trim(),
        gstNo: document.getElementById('editSupplierGstInput').value.trim(),
        address: document.getElementById('editSupplierAddressInput').value.trim(),
        // Do not update 'status' here, use the dedicated toggle function
    };

    // Add simple validation if needed
    if (!updatedData.name) { displayError("Supplier Name is required.", 'editSupplierError'); return; }


    console.log("Attempting to update supplier:", supplierId, "with data:", updatedData);
    try {
        const supplierRef = doc(db, "suppliers", supplierId);
        await updateDoc(supplierRef, updatedData);
        console.log("Supplier updated successfully.");
        closeEditSupplierModal();
        await loadSupplierAccountData(); // Reload all data
    } catch (error) {
        console.error("Error updating supplier: ", error);
        displayError(`Failed to update supplier: ${error.message}`, 'editSupplierError');
    }
}

async function handlePaymentSubmit(event) {
    event.preventDefault();
    clearError('paymentMadeError');

    const amount = parseFloat(document.getElementById('paymentAmountInput').value);
    const paymentDate = document.getElementById('paymentDateInput').value;
    const paymentMode = document.getElementById('paymentModeInput').value;
    const notes = document.getElementById('paymentNotesInput').value.trim();

    const linkedPoIds = [];
    const checkedBoxes = document.querySelectorAll('#paymentPoCheckboxList input[type="checkbox"]:checked');
    checkedBoxes.forEach(box => linkedPoIds.push(box.value));

    // Basic Validation
    if (isNaN(amount) || amount <= 0) { displayError("Please enter a valid positive amount.", 'paymentMadeError'); return; }
    if (!paymentDate) { displayError("Please select a payment date.", 'paymentMadeError'); return; }
    if (!currentSupplierId) { displayError("Supplier ID is missing. Cannot save payment.", 'paymentMadeError'); return; }
    if (linkedPoIds.length === 0) {
        if (!confirm("You haven't linked this payment to any PO. Are you sure you want to save it as an unlinked payment?")) {
            return; // Stop if user cancels
        }
        console.log("Saving unlinked payment.");
    }


    const paymentData = {
        supplierId: currentSupplierId,
        amount: amount,
        paymentDate: Timestamp.fromDate(new Date(paymentDate)),
        paymentMode: paymentMode,
        notes: notes,
        linkedPoIds: linkedPoIds, // Array of PO IDs
        type: 'payment', // Mark as payment type
        createdAt: serverTimestamp()
    };

    console.log("Saving Payment Data:", paymentData);

    try {
         // **Important:** Use a transaction or batch write to update PO paymentStatus
         const batch = writeBatch(db);

         // 1. Add the payment document
         const paymentRef = doc(collection(db, "payments")); // Create ref first
         batch.set(paymentRef, paymentData); // Add payment to batch

         // 2. Update paymentStatus and amountPaid for linked POs (Requires POs to have amountPaid field)
         let poUpdatePromises = linkedPoIds.map(async (poId) => {
             const poRef = doc(db, "purchaseOrders", poId);
             try {
                 const poDoc = await getDoc(poRef); // Get current PO data
                 if (poDoc.exists()) {
                     const poData = poDoc.data();
                     const currentAmountPaid = Number(poData.amountPaid) || 0;
                     const totalAmount = Number(poData.totalAmount) || 0;
                     const newAmountPaid = currentAmountPaid + amount; // Simple addition for now
                     let newPaymentStatus = poData.paymentStatus;

                     // Basic status update logic (Refine as needed)
                     if (newAmountPaid >= totalAmount) {
                         newPaymentStatus = 'paid';
                     } else if (newAmountPaid > 0) {
                         newPaymentStatus = 'partial';
                     } else {
                         newPaymentStatus = 'unpaid';
                     }

                     batch.update(poRef, {
                         amountPaid: newAmountPaid, // Make sure this field exists in your PO documents
                         paymentStatus: newPaymentStatus
                     });
                     console.log(`PO ${poId} added to batch update: amountPaid=${newAmountPaid}, paymentStatus=${newPaymentStatus}`);

                 } else {
                      console.warn(`PO with ID ${poId} not found for updating payment status.`);
                 }
             } catch(poError){
                  console.error(`Error processing PO ${poId} for payment linking:`, poError);
                  // Decide how to handle: continue batch? abort? log?
                  // For now, we log and continue with other updates
             }
         });

         // Wait for all PO data fetches/checks before committing batch
         await Promise.all(poUpdatePromises);

         // 3. Commit the batch
         await batch.commit();
         console.log("Payment added and POs updated successfully via batch write.");

        closePaymentModal();
        // Reload both payments and POs as PO status might have changed
        await loadSupplierPayments();
        await loadPurchaseOrders(); // Reload POs to reflect new status/amountPaid
        calculateAndDisplayBalance(); // Recalculate balance

    } catch (error) {
        console.error("Error saving payment or updating POs: ", error);
        displayError(`Failed to save payment: ${error.message}`, 'paymentMadeError');
    }
}

// --- Placeholder Functions for New Actions (Step 3) ---
function handleAddNewPo() {
    console.log("Add New PO button clicked - Placeholder");
    alert("Add New PO functionality not implemented yet. (Step 11)");
    // Later: window.location.href = `supplier_management.html?action=addPO&supplierId=${currentSupplierId}`;
}

function handleToggleSupplierStatus() {
    console.log("Toggle Supplier Status button clicked - Placeholder");
    if (!currentSupplierData) {
         alert("Cannot toggle status: Supplier data not loaded.");
         return;
    }
    const currentStatus = currentSupplierData.status === 'disabled' ? 'disabled' : 'active';
    const action = currentStatus === 'active' ? 'Disable' : 'Enable';
    alert(`${action} Supplier functionality not implemented yet. (Step 10)`);
    // Later: Add confirmation and Firebase update logic.
}

function handleDeleteSupplier() {
    console.log("Delete Supplier button clicked - Placeholder");
     if (!currentSupplierData) {
         alert("Cannot delete: Supplier data not loaded.");
         return;
    }
    alert("Delete Supplier functionality not implemented yet. Be careful! (Step 14)");
    // Later: Add strong confirmation and Firebase delete logic.
}

// Placeholder for Add Adjustment (will be used to open modal later in Step 5)
function handleAddAdjustmentClick() {
     console.log("Add Adjustment button clicked - Placeholder (will open modal later)");
     alert("Add Adjustment modal not implemented yet. (Step 4/5)");
     // Later: openModal('adjustmentModal');
}

// --- Event Listener Setup ---
function attachEventListeners() {
    if (listenersAttached) { console.log("Listeners already attached."); return; }
    console.log("Attaching event listeners...");

    // Existing Buttons
    const editBtn = document.getElementById('editSupplierBtn'); if (editBtn) editBtn.addEventListener('click', openEditSupplierModal); else console.warn("Edit Supplier Btn not found");
    const paymentBtn = document.getElementById('addPaymentBtn'); if (paymentBtn) paymentBtn.addEventListener('click', openPaymentModal); else console.warn("Add Payment Btn not found");
    const logoutBtn = document.getElementById('logoutBtn'); if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = 'index.html')); else console.warn("Logout Btn not found");

    // Existing Modal Close/Cancel/Submit
    const closePaymentBtn = document.getElementById('closePaymentModalBtn'); if (closePaymentBtn) closePaymentBtn.addEventListener('click', closePaymentModal); else console.warn("Close Payment Modal Btn not found");
    const cancelPaymentBtn = document.getElementById('cancelPaymentBtn'); if (cancelPaymentBtn) cancelPaymentBtn.addEventListener('click', closePaymentModal); else console.warn("Cancel Payment Btn not found");
    const paymentForm = document.getElementById('paymentForm'); if (paymentForm) paymentForm.addEventListener('submit', handlePaymentSubmit); else console.warn("Payment Form not found");
    const paymentModalEl = document.getElementById('paymentModal'); if (paymentModalEl) paymentModalEl.addEventListener('click', (event) => { if (event.target === paymentModalEl) closePaymentModal(); }); else console.warn("Payment Modal element not found");

    const closeEditSupplierBtn = document.getElementById('closeEditSupplierModalBtn'); if (closeEditSupplierBtn) closeEditSupplierBtn.addEventListener('click', closeEditSupplierModal); else console.warn("Close Edit Supplier Modal Btn not found");
    const cancelEditSupplierBtn = document.getElementById('cancelEditSupplierBtn'); if (cancelEditSupplierBtn) cancelEditSupplierBtn.addEventListener('click', closeEditSupplierModal); else console.warn("Cancel Edit Supplier Btn not found");
    const editSupplierForm = document.getElementById('editSupplierForm'); if (editSupplierForm) editSupplierForm.addEventListener('submit', handleEditSupplierSubmit); else console.warn("Edit Supplier Form not found");
    const editSupplierModalEl = document.getElementById('editSupplierModal'); if (editSupplierModalEl) editSupplierModalEl.addEventListener('click', (event) => { if (event.target === editSupplierModalEl) closeEditSupplierModal(); }); else console.warn("Edit Supplier Modal element not found");

    // --- Add listeners for new buttons (Step 3) ---
    const addNewPoBtn = document.getElementById('addNewPoBtn');
    if (addNewPoBtn) {
        addNewPoBtn.addEventListener('click', handleAddNewPo);
    } else {
        console.warn("Add New PO button not found in DOM");
    }

    const addAdjustmentBtn = document.getElementById('addAdjustmentBtn');
    if (addAdjustmentBtn) {
        addAdjustmentBtn.addEventListener('click', handleAddAdjustmentClick); // Connects to the placeholder
    } else {
        console.warn("Add Adjustment button not found in DOM");
    }

    const toggleSupplierStatusBtn = document.getElementById('toggleSupplierStatusBtn');
    if (toggleSupplierStatusBtn) {
        toggleSupplierStatusBtn.addEventListener('click', handleToggleSupplierStatus);
    } else {
        console.warn("Toggle Supplier Status button not found in DOM");
    }

    const deleteSupplierBtn = document.getElementById('deleteSupplierBtn');
    if (deleteSupplierBtn) {
        deleteSupplierBtn.addEventListener('click', handleDeleteSupplier);
    } else {
        console.warn("Delete Supplier button not found in DOM");
    }
    // --- End new button listeners ---


    listenersAttached = true;
    console.log("Event listeners attached successfully.");
}

// --- Global Initialization & Auth Handling ---
async function initializeSupplierDetailPage() {
     if (supplierDetailPageInitialized) { console.log("Supplier Detail Page already initialized."); return; }
     supplierDetailPageInitialized = true;
     console.log("Initializing Supplier Detail Page...");
     clearError(); // Clear any previous errors

     // Show main content area immediately, loading indicator will cover it
     const mainContent = document.getElementById('detailMainContent');
     if (mainContent) { mainContent.style.visibility = 'visible'; }
     else { console.error("CRITICAL: Main content container (#detailMainContent) missing!"); return; } // Stop if layout broken

    // Show loading indicator while checking auth and loading data
    showLoading('loadingIndicator');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("User authenticated:", user.email);
            const userEmailDisplay = document.getElementById('userEmailDisplay');
            if(userEmailDisplay) userEmailDisplay.textContent = user.email;
             const logoutBtn = document.getElementById('logoutBtn'); if (logoutBtn) logoutBtn.style.display = 'inline-block'; // Show logout

            // Now load the supplier data
            await loadSupplierAccountData();

        } else {
            console.log("User not authenticated. Redirecting to login.");
            // Hide loading before redirect
            hideLoading('loadingIndicator');
            window.location.href = 'index.html';
        }
    });
}

// --- Auto-run Initialization ---
// Use DOMContentLoaded to ensure HTML is parsed, then initialize.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSupplierDetailPage);
} else {
    // DOM already loaded
    initializeSupplierDetailPage();
}