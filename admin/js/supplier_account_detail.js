// js/supplier_account_detail.js
// Version with Edit Supplier Modal Logic Added

// --- Import Firebase functions directly ---
import { db } from './firebase-init.js'; // Use relative path from within JS folder
import {
    doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp,
    addDoc, serverTimestamp, updateDoc // <<< updateDoc जोड़ा गया
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Global Variables ---
let currentSupplierId = null;
let currentSupplierData = null;

// --- DOM References ---
// (IDs should match your supplier_account_detail.html file)
const supplierNameHeader = document.getElementById('supplierNameHeader');
const supplierNameBreadcrumb = document.getElementById('supplierNameBreadcrumb');
const addPaymentMadeBtn = document.getElementById('addPaymentMadeBtn');
const editSupplierDetailsBtn = document.getElementById('editSupplierDetailsBtn'); // Button to open edit modal

// Supplier Details Display Elements
const detailSupplierId = document.getElementById('detailSupplierId');
const detailSupplierName = document.getElementById('detailSupplierName');
const detailSupplierCompany = document.getElementById('detailSupplierCompany');
const detailSupplierWhatsapp = document.getElementById('detailSupplierWhatsapp');
const detailSupplierEmail = document.getElementById('detailSupplierEmail');
const detailSupplierGst = document.getElementById('detailSupplierGst');
const detailSupplierAddress = document.getElementById('detailSupplierAddress');

// Account Summary Elements
const summaryTotalPoValue = document.getElementById('summaryTotalPoValue');
const summaryTotalPaymentsMade = document.getElementById('summaryTotalPaid'); // Corrected ID
const summaryOutstandingBalance = document.getElementById('summaryBalance');    // Corrected ID

// PO Table Elements (Verify these IDs in your HTML)
const poTableBody = document.getElementById('supplierPoTableBody');
const poLoadingMessage = document.getElementById('supplierPoLoading');
const poListError = document.getElementById('supplierPoListError');

// Payments Table Elements (Verify these IDs in your HTML)
const paymentsTableBody = document.getElementById('supplierPaymentsTableBody');
const paymentsLoadingMessage = document.getElementById('supplierPaymentLoading');
const paymentsListError = document.getElementById('supplierPaymentListError');

// Add Payment Modal Elements
const addPaymentModal = document.getElementById('addPaymentModal');
const closePaymentModal = document.getElementById('closePaymentModal');
const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
const paymentModalSupplierName = document.getElementById('paymentModalSupplierName');
const addPaymentForm = document.getElementById('addPaymentForm');
const paymentAmountInput = document.getElementById('paymentAmount');
const paymentDateInput = document.getElementById('paymentDate');
const paymentMethodSelect = document.getElementById('paymentMethod');
const paymentNotesInput = document.getElementById('paymentNotes');
const savePaymentBtn = document.getElementById('savePaymentBtn');
const paymentFormError = document.getElementById('paymentFormError');
const paymentPoSelect = document.getElementById('paymentPoSelect'); // <<< PO Select Dropdown

// --- EDIT SUPPLIER MODAL ELEMENTS START ---
const editSupplierModal = document.getElementById('editSupplierModal');
const closeEditSupplierModalBtn = document.getElementById('closeEditSupplierModal');
const cancelEditSupplierBtn = document.getElementById('cancelEditSupplierBtn');
const editSupplierForm = document.getElementById('editSupplierForm');
const editSupplierFormError = document.getElementById('editSupplierFormError'); // Ensure this exists in HTML modal
const editingSupplierIdInput = document.getElementById('editingSupplierId'); // Hidden input in edit modal
const editSupplierNameInput = document.getElementById('editSupplierNameInput');
const editSupplierCompanyInput = document.getElementById('editSupplierCompanyInput');
const editSupplierWhatsappInput = document.getElementById('editSupplierWhatsappInput');
const editSupplierContactInput = document.getElementById('editSupplierContactInput');
const editSupplierEmailInput = document.getElementById('editSupplierEmailInput');
const editSupplierGstInput = document.getElementById('editSupplierGstInput');
const editSupplierAddressInput = document.getElementById('editSupplierAddressInput');
const updateSupplierBtn = document.getElementById('updateSupplierBtn');
// --- EDIT SUPPLIER MODAL ELEMENTS END ---


// --- Helper Functions ---
function displayError(message, elementId = null) {
     console.error("Error:", message);
     if (elementId) {
         const errorElement = document.getElementById(elementId);
         if (errorElement) {
             errorElement.textContent = message;
             errorElement.style.display = 'block';
             const loadingId = elementId.replace('Error', 'Loading');
             const loadingElement = document.getElementById(loadingId);
             if(loadingElement) loadingElement.style.display = 'none';
         } else { alert(message); }
     } else { alert(message); }
 }
const escapeHtml = (unsafe) => typeof unsafe === 'string' ? unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : unsafe;
function formatCurrency(amount) { const num = Number(amount); if (isNaN(num)) return 'N/A'; return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatDate(timestamp) { if (!timestamp || typeof timestamp.toDate !== 'function') return '-'; try { return timestamp.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (e) { console.error("Error formatting date:", e); return '-'; } }


// --- Get Supplier ID from URL ---
function getSupplierIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// --- Load All Supplier Account Data ---
async function loadSupplierAccountData(dbInstance) {
    if (!currentSupplierId) { displayError("Cannot load data: Supplier ID is missing."); return; }
    console.log("Loading supplier data for ID:", currentSupplierId);
    resetUI();
    let totalPoValueNum = 0;
    let totalPaymentsNum = 0;

    try {
        // 1. Fetch Supplier Details
        const supplierRef = doc(dbInstance, "suppliers", currentSupplierId);
        const supplierSnap = await getDoc(supplierRef);
        if (supplierSnap.exists()) {
            currentSupplierData = supplierSnap.data();
            console.log("Supplier Data:", currentSupplierData);
            displaySupplierDetails(currentSupplierData);
        } else { throw new Error(`Supplier with ID ${currentSupplierId} not found.`); }

        // 2. Fetch Purchase Orders (POs)
        const poTableBodyElem = poTableBody;
        const poLoadingElem = poLoadingMessage;
        const poErrorElem = poListError;
        if (poLoadingElem) poLoadingElem.style.display = 'table-row';
        if (poErrorElem) poErrorElem.style.display = 'none';
        if (poTableBodyElem) poTableBodyElem.innerHTML = '';
        const poQuery = query( collection(dbInstance, "purchaseOrders"), where("supplierId", "==", currentSupplierId), orderBy("orderDate", "desc"));
        const poSnapshot = await getDocs(poQuery);
        console.log(`Found ${poSnapshot.size} POs.`);
        if (poSnapshot.empty) { if (poTableBodyElem) poTableBodyElem.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 15px;">No purchase orders found.</td></tr>'; }
        else { poSnapshot.forEach(doc => { const po = doc.data(); displayPurchaseOrder(po, doc.id, poTableBodyElem); totalPoValueNum += (Number(po.totalAmount) || 0); }); }
        if (poLoadingElem) poLoadingElem.style.display = 'none';

        // 3. Fetch Payments Made
        const paymentsTableBodyElem = paymentsTableBody;
        const paymentsLoadingElem = paymentsLoadingMessage;
        const paymentsErrorElem = paymentsListError;
        if (paymentsLoadingElem) paymentsLoadingElem.style.display = 'table-row';
        if (paymentsErrorElem) paymentsErrorElem.style.display = 'none';
        if (paymentsTableBodyElem) paymentsTableBodyElem.innerHTML = '';
        const paymentQuery = query( collection(dbInstance, "supplier_payments"), where("supplierId", "==", currentSupplierId), orderBy("paymentDate", "desc") );
        const paymentSnapshot = await getDocs(paymentQuery);
        console.log(`Found ${paymentSnapshot.size} payments.`);
        totalPaymentsNum = 0; // Reset before summing
        if (paymentSnapshot.empty) { if (paymentsTableBodyElem) paymentsTableBodyElem.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 15px;">No payments recorded.</td></tr>'; }
        else { paymentSnapshot.forEach(doc => { const payment = doc.data(); displayPaymentMade(payment, doc.id, paymentsTableBodyElem); totalPaymentsNum += (Number(payment.paymentAmount) || 0); }); }
        if (paymentsLoadingElem) paymentsLoadingElem.style.display = 'none';

        // 4. Calculate and Display Account Summary
        const outstandingBalanceNum = totalPoValueNum - totalPaymentsNum;
        console.log("Calculated Summary:", { totalPO: totalPoValueNum, totalPaid: totalPaymentsNum, balance: outstandingBalanceNum });
        if (summaryTotalPoValue) summaryTotalPoValue.textContent = formatCurrency(totalPoValueNum);
        if (summaryTotalPaymentsMade) summaryTotalPaymentsMade.textContent = formatCurrency(totalPaymentsNum);
        if (summaryOutstandingBalance) {
            summaryOutstandingBalance.textContent = formatCurrency(outstandingBalanceNum);
            summaryOutstandingBalance.className = 'balance-info'; // Reset class
            if (outstandingBalanceNum > 0.01) summaryOutstandingBalance.classList.add('balance-due'); // Payable
            else if (outstandingBalanceNum < -0.01) summaryOutstandingBalance.classList.add('balance-credit'); // Advance
            else summaryOutstandingBalance.classList.add('balance-info'); // Zero
        }
        console.log('Final Account Summary Displayed');

    } catch (error) {
         console.error("Error loading supplier account data:", error);
         displayError(`Error loading data: ${error.message}`);
         // Ensure loading states are hidden and summary shows error
         if (poLoadingMessage) poLoadingMessage.style.display = 'none';
         if (paymentsLoadingMessage) paymentsLoadingMessage.style.display = 'none';
         if (summaryTotalPoValue) summaryTotalPoValue.textContent = 'Error';
         if (summaryTotalPaymentsMade) summaryTotalPaymentsMade.textContent = 'Error';
         if (summaryOutstandingBalance) summaryOutstandingBalance.textContent = 'Error';
    }
}


// --- Reset UI before loading ---
function resetUI() { /* ... (code as before) ... */ }

// --- Display Supplier Details ---
function displaySupplierDetails(data) { /* ... (code to display details, including WhatsApp text only) ... */ }

// --- Display Purchase Order Row ---
function displayPurchaseOrder(po, id, tableBodyElement) { /* ... (code as before) ... */ }

// --- Display Payment Made Row ---
function displayPaymentMade(payment, id, tableBodyElement) { /* ... (code as before) ... */ }


// --- Setup Event Listeners ---
function setupEventListeners() {
    // Add Payment Button
    if (addPaymentMadeBtn) { addPaymentMadeBtn.addEventListener('click', openAddPaymentModal); }
    else { console.warn("Add Payment button not found."); }

    // Payment Modal Buttons & Form
    if (closePaymentModal) { closePaymentModal.addEventListener('click', closeAddPaymentModal); }
    if (cancelPaymentBtn) { cancelPaymentBtn.addEventListener('click', closeAddPaymentModal); }
    if (addPaymentModal) { addPaymentModal.addEventListener('click', (event) => { if (event.target === addPaymentModal) { closeAddPaymentModal(); } }); }
    if (addPaymentForm) { addPaymentForm.addEventListener('submit', handleSavePayment); }
    else { console.warn("Add Payment form not found."); }

    // --- EDIT SUPPLIER EVENT LISTENER START ---
    if (editSupplierDetailsBtn) {
        editSupplierDetailsBtn.addEventListener('click', openEditSupplierModal); // <<< Calls new function
    } else { console.warn("Edit Supplier Details button not found."); }

    // Edit Supplier Modal Buttons & Form
    if (closeEditSupplierModalBtn) { closeEditSupplierModalBtn.addEventListener('click', closeEditSupplierModal); }
    if (cancelEditSupplierBtn) { cancelEditSupplierBtn.addEventListener('click', closeEditSupplierModal); }
    if (editSupplierModal) {
        editSupplierModal.addEventListener('click', (event) => {
            if (event.target === editSupplierModal) { closeEditSupplierModal(); }
        });
    }
    if (editSupplierForm) { editSupplierForm.addEventListener('submit', handleUpdateSupplier); } // <<< Calls new handler
    else { console.warn("Edit Supplier form not found."); }
    // --- EDIT SUPPLIER EVENT LISTENER END ---

    console.log("Event Listeners Setup.");
}

// --- Add Payment Modal Logic ---
function openAddPaymentModal() {
     if (!addPaymentModal || !currentSupplierData) { alert("Cannot open payment modal."); return; }
     addPaymentForm.reset(); if(paymentFormError) paymentFormError.style.display = 'none';
     if(paymentModalSupplierName) paymentModalSupplierName.textContent = currentSupplierData.name || '';
     if(paymentDateInput) { try { /* set default date */ const today = new Date(); const y = today.getFullYear(); const m = (today.getMonth() + 1).toString().padStart(2, '0'); const d = today.getDate().toString().padStart(2, '0'); paymentDateInput.value = `${y}-${m}-${d}`; } catch(e){} }
     if(savePaymentBtn) { savePaymentBtn.disabled = false; savePaymentBtn.innerHTML = '<i class="fas fa-save"></i> Save Payment'; }

     // --- Load POs for Dropdown ---
     populatePoDropdown(); // Call function to fill the dropdown

     addPaymentModal.classList.add('active');
     if (paymentAmountInput) paymentAmountInput.focus();
}

async function populatePoDropdown() {
    if (!paymentPoSelect || !currentSupplierId || !db) {
        console.log("PO Select dropdown or Supplier ID/DB missing.");
        if(paymentPoSelect) paymentPoSelect.innerHTML = '<option value="">Could not load POs</option>';
        return;
    }

    paymentPoSelect.innerHTML = '<option value="">Loading POs...</option>'; // Show loading state
    paymentPoSelect.disabled = true;

    let optionsHtml = '<option value="">-- Do not link to PO --</option>';
    let poCount = 0;

    try {
        // Query for POs that are likely unpaid or partially paid
        // Adjust statuses as needed for your workflow
        const q = query(
            collection(db, "purchaseOrders"),
            where("supplierId", "==", currentSupplierId),
            where("paymentStatus", "in", ["Pending", "Partially Paid"]), // Filter by payment status
             // You might also want to filter by PO status (e.g., 'Product Received')
             // where("status", "==", "Product Received"),
            orderBy("orderDate", "desc")
        );
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            const po = doc.data();
            const poId = doc.id;
            const poNumber = escapeHtml(po.poNumber || `ID: ${poId.substring(0,4)}..`);
            const poAmount = formatCurrency(po.totalAmount || 0);
            // Include remaining balance if available, otherwise show total amount
            const remaining = (po.totalAmount && po.amountPaid) ? (po.totalAmount - po.amountPaid) : po.totalAmount;
            const displayAmount = (remaining > 0 && remaining < po.totalAmount) ? `${formatCurrency(remaining)} left` : poAmount;

            optionsHtml += `<option value="${poId}">PO #${poNumber} (${displayAmount})</option>`;
            poCount++;
        });

        if (poCount === 0) {
             optionsHtml = '<option value="">-- No unpaid POs found --</option>';
        }

    } catch (error) {
        console.error("Error fetching POs for dropdown:", error);
        optionsHtml = '<option value="">Error loading POs</option>';
         if (error.code === 'failed-precondition') {
             console.error("Firestore index missing for PO dropdown query (supplierId + paymentStatus + orderDate).");
             alert("Error loading POs: Database index required. Please check console.");
         }
    } finally {
        paymentPoSelect.innerHTML = optionsHtml;
        paymentPoSelect.disabled = (poCount === 0); // Disable if no POs load or error
    }
}


function closeAddPaymentModal() { if (addPaymentModal) { addPaymentModal.classList.remove('active'); } }

async function handleSavePayment(event) {
    event.preventDefault();
    // --- Get selected PO ID ---
    const selectedPoId = paymentPoSelect ? paymentPoSelect.value : null; // Get ID from dropdown
    // --- Rest of the validation as before ---
    if (!paymentAmountInput || !paymentDateInput || !paymentMethodSelect) { /* ... */ return; }
    const amount = parseFloat(paymentAmountInput.value); const date = paymentDateInput.value; const method = paymentMethodSelect.value; const notes = paymentNotesInput ? paymentNotesInput.value.trim() : '';
    if (isNaN(amount) || amount <= 0) { /* ... */ return; } if (!date) { /* ... */ return; }
    if(savePaymentBtn) { /* ... disable button ... */ } showPaymentFormError('');

    try {
        const dateParts = date.split('-'); const paymentDateObject = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2], 12, 0, 0)); const paymentDateTimestamp = Timestamp.fromDate(paymentDateObject);

        const paymentData = {
            supplierId: currentSupplierId, supplierName: currentSupplierData?.name || null,
            paymentAmount: amount, paymentDate: paymentDateTimestamp, paymentMethod: method,
            notes: notes || null,
            purchaseOrderId: selectedPoId || null, // <<< Save linked PO ID
            createdAt: serverTimestamp()
        };

        if (!db) throw new Error("Database connection is not available.");
        const docRef = await addDoc(collection(db, "supplier_payments"), paymentData);
        console.log("Payment recorded successfully: ID:", docRef.id);

        // --- Update PO Status if linked ---
        if (selectedPoId) {
            console.log(`Payment linked to PO ID: ${selectedPoId}. Updating PO status...`);
            await updatePurchaseOrderStatus(db, selectedPoId, amount); // Call helper function
        }
        // --- End PO Status Update ---

        alert("Payment recorded successfully!");
        closeAddPaymentModal();
        await loadSupplierAccountData(db); // Reload page data

    } catch (error) { console.error("Error saving payment:", error); showPaymentFormError(`Error: ${error.message}`); }
    finally { if(savePaymentBtn) { /* ... re-enable button ... */ } }
}

// --- Helper Function to Update PO Status ---
async function updatePurchaseOrderStatus(dbInstance, poId, paymentAmountJustMade) {
     if (!poId || !dbInstance) return;
     console.log(`Updating status for PO ${poId} after payment of ${paymentAmountJustMade}`);
     const poRef = doc(dbInstance, "purchaseOrders", poId); // Ensure correct collection name

     try {
         const poSnap = await getDoc(poRef);
         if (poSnap.exists()) {
             const poData = poSnap.data();
             const totalPoAmount = Number(poData.totalAmount) || 0;
             const currentPaidOnPo = Number(poData.amountPaid || 0); // Check for existing paid amount on PO
             const newTotalPaidOnPo = currentPaidOnPo + paymentAmountJustMade;

             let newPaymentStatus = "Partially Paid";
             // Use a small tolerance for floating point comparisons
             if (newTotalPaidOnPo >= totalPoAmount - 0.01) {
                 newPaymentStatus = "Paid";
             }

             const poUpdateData = {
                 amountPaid: newTotalPaidOnPo, // Update total paid on this PO
                 paymentStatus: newPaymentStatus,
                 // Optionally add last payment date?
                 // lastPaymentDate: serverTimestamp()
             };

             await updateDoc(poRef, poUpdateData);
             console.log(`PO ${poId} updated successfully: Status=${newPaymentStatus}, AmountPaid=${newTotalPaidOnPo}`);

         } else {
             console.warn(`Could not find PO ${poId} to update status after payment.`);
         }
     } catch (error) {
         console.error(`Error updating PO ${poId} status:`, error);
         // Should we alert the user? Maybe just log it.
         // alert(`Failed to update linked PO status: ${error.message}`);
     }
}


function showPaymentFormError(message) { /* ... (code as before) ... */ }

// --- EDIT SUPPLIER MODAL LOGIC START ---
function openEditSupplierModal() { /* ... (code as before) ... */ }
function closeEditSupplierModal() { /* ... (code as before) ... */ }
async function handleUpdateSupplier(event) { /* ... (code as before, ensure updateDoc import exists) ... */ }
function showEditSupplierFormError(message) { /* ... (code as before) ... */ }
// --- EDIT SUPPLIER MODAL LOGIC END ---


// --- Global Initialization Function ---
window.initializeSupplierDetailPage = async () => { /* ... (code as before) ... */ };

// --- Auto-initialize ---
if (document.readyState === 'loading') { /* ... (code as before) ... */ }
else { /* ... (code as before) ... */ }
// --- End Auto-initialize ---

console.log("supplier_account_detail.js loaded and running (Edit Supplier Modal + PO Link Logic Added).");