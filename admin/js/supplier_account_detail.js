// js/supplier_account_detail.js - v3 (Fix Add Payment, Implement Edit Supplier)

import { db, auth } from './firebase-init.js';
import {
    doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp,
    addDoc, serverTimestamp, updateDoc, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Global Variables ---
let currentSupplierId = null;
let currentSupplierData = null;
let purchaseOrdersData = [];
let supplierPaymentsData = [];
let listenersAttached = false;
let supplierDetailPageInitialized = false;


// --- Helper Functions ---
function displayError(message, elementId = 'generalErrorDisplay') {
    console.error("Displaying Error:", message, "on element:", elementId);
    try {
        let errorElement = document.getElementById(elementId);
        if (!errorElement && elementId === 'paymentMadeError') errorElement = document.getElementById('paymentMadeError');
        if (!errorElement && elementId === 'editSupplierError') errorElement = document.getElementById('editSupplierError');
        if (!errorElement) errorElement = document.getElementById('supplierPaymentListError');
        if (!errorElement) errorElement = document.getElementById('supplierPoListError');
        if (!errorElement) errorElement = document.getElementById('generalErrorDisplay');

        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            errorElement.style.color = 'red';
        } else {
            console.warn(`Error element '${elementId}' or fallbacks not found. Using alert.`);
            alert(`Error: ${message}`);
        }
    } catch(e) { console.error("Error within displayError:", e); alert(`Error: ${message}`); }
}
function clearError(elementId = 'generalErrorDisplay') {
    try {
        let errorElement = document.getElementById(elementId);
         if (!errorElement && elementId === 'paymentMadeError') errorElement = document.getElementById('paymentMadeError');
         if (!errorElement && elementId === 'editSupplierError') errorElement = document.getElementById('editSupplierError');
        if (!errorElement) errorElement = document.getElementById('supplierPaymentListError');
        if (!errorElement) errorElement = document.getElementById('supplierPoListError');
        if (!errorElement) errorElement = document.getElementById('generalErrorDisplay');
        if (errorElement) { errorElement.textContent = ''; errorElement.style.display = 'none'; }
    } catch(e) { console.error("Error within clearError:", e); }
}
function getSupplierIdFromUrl() {
    try { const params = new URLSearchParams(window.location.search); return params.get('id'); }
    catch (e) { console.error("Error getting supplier ID from URL:", e); return null; }
}
function formatDate(timestamp, includeTime = false) {
    if (!timestamp || typeof timestamp.toDate !== 'function') { return '-'; }
    try {
        const date = timestamp.toDate();
        const optionsDate = { year: 'numeric', month: 'short', day: 'numeric' };
        const optionsTime = { hour: 'numeric', minute: '2-digit', hour12: true };
        const formattedDate = date.toLocaleDateString('en-IN', optionsDate);
        if (includeTime) {
            return `${formattedDate}, ${date.toLocaleTimeString('en-IN', optionsTime)}`;
        }
        return formattedDate;
    } catch (e) { console.error("Error formatting date:", timestamp, e); return 'Format Error'; }
}
function formatCurrency(amount) {
    if (typeof amount !== 'number') { amount = parseFloat(amount); }
    if (isNaN(amount)) { return '₹ --.--'; }
    return `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function getStatusClass(status) { if (!status) return 'status-unknown'; return 'status-' + status.toLowerCase().replace(/\s+/g, '-'); }
function getPaymentStatusClass(status) { if (!status) return 'payment-status-pending'; return 'payment-status-' + status.toLowerCase().replace(/\s+/g, '-'); }

// --- UI Population Functions ---
function populateSupplierDetails(data) {
    const header = document.getElementById('supplierNameHeader');
    const breadcrumb = document.getElementById('supplierNameBreadcrumb');
    const idEl = document.getElementById('detailSupplierId');
    const nameEl = document.getElementById('detailSupplierName');
    const companyEl = document.getElementById('detailSupplierCompany');
    const whatsappEl = document.getElementById('detailSupplierWhatsapp');
    const emailEl = document.getElementById('detailSupplierEmail');
    const gstEl = document.getElementById('detailSupplierGst');
    const addressEl = document.getElementById('detailSupplierAddress');
    const addedOnEl = document.getElementById('detailAddedOn');

    if (!data) {
        if(header) header.textContent = 'Error'; if(breadcrumb) breadcrumb.textContent = 'Error';
        if(idEl) idEl.textContent = '-'; if(nameEl) nameEl.textContent = '-'; if(companyEl) companyEl.textContent = '-';
        if(whatsappEl) whatsappEl.textContent = '-'; if(emailEl) emailEl.textContent = '-'; if(gstEl) gstEl.textContent = '-';
        if(addressEl) addressEl.textContent = '-'; if(addedOnEl) addedOnEl.textContent = '-';
        return;
    }
    if (header) header.textContent = data.name || 'Supplier Account';
    if (breadcrumb) breadcrumb.textContent = data.name || 'Details';
    if (idEl) idEl.textContent = data.id || 'N/A';
    if (nameEl) nameEl.textContent = data.name || 'N/A';
    if (companyEl) companyEl.textContent = data.companyName || 'N/A';
    if (whatsappEl) whatsappEl.textContent = data.whatsappNo || data.contact || 'N/A';
    if (emailEl) emailEl.textContent = data.email || 'N/A';
    if (gstEl) gstEl.textContent = data.gstNo || 'N/A';
    if (addressEl) addressEl.textContent = data.address || 'N/A';
    if (addedOnEl) addedOnEl.textContent = data.createdAt ? formatDate(data.createdAt) : 'N/A';
}

function populatePaymentHistory(payments) {
    const tableBody = document.getElementById('transactionsTableBody');
    const loadingRow = document.getElementById('transactionsLoading');
    const noDataRow = document.getElementById('noTransactionsMessage');
    if (!tableBody) { console.error("Payment table body not found!"); return; }
    tableBody.innerHTML = ''; if (loadingRow) loadingRow.style.display = 'none';
    if (!payments || payments.length === 0) { if (noDataRow) noDataRow.style.display = 'table-row'; else tableBody.innerHTML = '<tr><td colspan="6">No payment history found.</td></tr>'; return; }
    if (noDataRow) noDataRow.style.display = 'none';
    payments.sort((a, b) => (b.paymentDate?.toDate?.() || 0) - (a.paymentDate?.toDate?.() || 0));
    payments.forEach((payment) => {
         try {
             const row = tableBody.insertRow();
             row.insertCell(0).textContent = formatDate(payment.paymentDate, true);
             row.insertCell(1).textContent = payment.notes || '-';
             row.insertCell(2).textContent = payment.paymentMethod || 'N/A';
             row.insertCell(3).textContent = payment.linkedPoNumber || '-';
             const amountCell = row.insertCell(4); amountCell.textContent = formatCurrency(payment.paymentAmount); amountCell.classList.add('amount-paid');
             row.insertCell(5); // Actions cell (empty for now)
        } catch(e) { console.error(`Error creating payment row:`, payment, e); }
    });
}

function populatePoHistoryTable(pos) {
    const tableBody = document.getElementById('supplierPoTableBody');
    const loadingRow = document.getElementById('supplierPoLoading');
    const noDataRow = document.getElementById('noSupplierPoMessage');
    if (!tableBody) { console.error("PO table body not found!"); return; }
    tableBody.innerHTML = ''; if (loadingRow) loadingRow.style.display = 'none';
    if (!pos || pos.length === 0) { if (noDataRow) noDataRow.style.display = 'table-row'; else tableBody.innerHTML = '<tr><td colspan="6">No purchase orders found.</td></tr>'; return; }
    if (noDataRow) noDataRow.style.display = 'none';
    pos.sort((a, b) => (b.orderDate?.toDate?.() || 0) - (a.orderDate?.toDate?.() || 0));
    pos.forEach((po) => {
        try {
            const row = tableBody.insertRow();
            row.insertCell(0).textContent = po.poNumber || `PO-${po.id.substring(0, 6)}`;
            row.insertCell(1).textContent = formatDate(po.orderDate);
            const amountCell = row.insertCell(2); amountCell.textContent = formatCurrency(po.totalAmount); amountCell.classList.add('amount-po');
            const statusCell = row.insertCell(3); const statusSpan = document.createElement('span'); statusSpan.className = `status-badge ${getStatusClass(po.status)}`; statusSpan.textContent = po.status || 'Unknown'; statusCell.appendChild(statusSpan);
            const paymentStatusCell = row.insertCell(4); const paymentStatusSpan = document.createElement('span'); paymentStatusSpan.className = `status-badge ${getPaymentStatusClass(po.paymentStatus)}`; paymentStatusSpan.textContent = po.paymentStatus || 'Pending'; paymentStatusCell.appendChild(paymentStatusSpan);
            row.insertCell(5); // Actions cell (empty for now)
        } catch (e) { console.error(`Error creating PO row:`, po, e); }
    });
}

function updateAccountSummary(poTotal, paymentTotal) {
    const poDisplay = document.getElementById('summaryTotalPoValue');
    const paidDisplay = document.getElementById('summaryTotalPaid');
    const balanceDisplay = document.getElementById('summaryBalance');
    if (!poDisplay || !paidDisplay || !balanceDisplay) { console.error("Summary elements missing"); return;}
    const numPoTotal = parseFloat(poTotal) || 0; const numPaymentTotal = parseFloat(paymentTotal) || 0; const outstanding = numPoTotal - numPaymentTotal;
    poDisplay.textContent = formatCurrency(numPoTotal); poDisplay.classList.remove('loading-state');
    paidDisplay.textContent = formatCurrency(numPaymentTotal); paidDisplay.classList.remove('loading-state');
    balanceDisplay.textContent = formatCurrency(outstanding); balanceDisplay.classList.remove('loading-state');
    balanceDisplay.className = 'balance-info';
    if (outstanding > 0.01) balanceDisplay.classList.add('balance-due');
    else if (outstanding < -0.01) balanceDisplay.classList.add('balance-credit');
    else balanceDisplay.classList.add('balance-zero');
}

function populatePoDropdownForPayment(pos) {
     const dropdown = document.getElementById('paymentLinkPOSelect');
     if (!dropdown) { console.error("PO Link dropdown element for payment not found!"); return; }
     dropdown.innerHTML = '<option value="">None (Direct Payment)</option>';
     if (!pos || pos.length === 0) { dropdown.innerHTML += '<option value="" disabled>No POs found for this supplier</option>'; return; }
     const openPOs = pos.filter(po => po.paymentStatus !== 'Paid');
     if (openPOs.length === 0) { dropdown.innerHTML += '<option value="" disabled>No open POs found</option>'; return; }
     openPOs.sort((a, b) => (b.orderDate?.toDate?.() || 0) - (a.orderDate?.toDate?.() || 0));
     openPOs.forEach(po => {
        const option = document.createElement('option'); option.value = po.id;
        const total = parseFloat(po.totalAmount) || 0;
        option.textContent = `${po.poNumber || po.id.substring(0,6)} (${formatDate(po.orderDate)}) - Total: ${formatCurrency(total)}`;
        option.dataset.poNumber = po.poNumber || '';
        dropdown.appendChild(option);
      });
}

// --- Core Data Loading ---
async function loadSupplierAccountData() {
     currentSupplierId = getSupplierIdFromUrl();
     if (!currentSupplierId) { displayError("Supplier ID missing from URL."); return; }
     if (!db) { displayError("Database connection failed."); return; }
     const loadingIndicator = document.getElementById('loadingIndicator');
     if (loadingIndicator) loadingIndicator.style.display = 'block'; clearError();
     let supplierData = null, payments = [], purchaseOrders = [], paymentSum = 0, poSum = 0;
     try {
         const supplierRef = doc(db, "suppliers", currentSupplierId);
         const supplierSnap = await getDoc(supplierRef);
         if (!supplierSnap.exists()) throw new Error("Supplier not found");
         supplierData = { id: supplierSnap.id, ...supplierSnap.data() };
         currentSupplierData = supplierData;
         populateSupplierDetails(supplierData);
         const [paymentsSnapshot, poSnapshot] = await Promise.all([
              getDocs(query(collection(db, "supplier_payments"), where("supplierId", "==", currentSupplierId))),
              getDocs(query(collection(db, "purchaseOrders"), where("supplierId", "==", currentSupplierId)))
         ]);
         payments = paymentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
         supplierPaymentsData = payments;
         paymentSum = payments.reduce((sum, p) => sum + (parseFloat(p.paymentAmount) || 0), 0);
         populatePaymentHistory(payments);
         purchaseOrders = poSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
         purchaseOrdersData = purchaseOrders;
         poSum = purchaseOrders.reduce((sum, po) => sum + (parseFloat(po.totalAmount) || 0), 0);
         populatePoHistoryTable(purchaseOrders);
         updateAccountSummary(poSum, paymentSum);
         populatePoDropdownForPayment(purchaseOrders);
         setupEventListeners();
     } catch (error) {
         console.error("Error loading supplier account data:", error);
         displayError(`Error loading data: ${error.message}.`);
         if (!supplierData) populateSupplierDetails(null);
         populatePaymentHistory([]); populatePoHistoryTable([]); updateAccountSummary(0, 0); populatePoDropdownForPayment([]);
     } finally { if (loadingIndicator) loadingIndicator.style.display = 'none'; }
}

// --- Modal Functions & Handlers ---

// Add Payment Modal
function openPaymentModal(){
    if (!currentSupplierData) { alert("Supplier data not loaded yet."); return; }
    const modal = document.getElementById('paymentMadeModal');
    const form = document.getElementById('paymentMadeForm');
    const supplierNameSpan = document.getElementById('paymentSupplierName');
    const dateInput = document.getElementById('paymentDate');
    if (!modal || !form || !supplierNameSpan || !dateInput) { console.error("Payment modal elements missing."); return; }
    clearError('paymentMadeError'); form.reset();
    supplierNameSpan.textContent = currentSupplierData.name || 'Supplier';
    try { dateInput.valueAsDate = new Date(); } catch(e) { dateInput.value = new Date().toISOString().slice(0,10); }
    populatePoDropdownForPayment(purchaseOrdersData);
    modal.style.display = 'flex';
}
function closePaymentModal(){ const modal = document.getElementById('paymentMadeModal'); if(modal) modal.style.display = 'none'; }
async function handleSavePayment(event) {
    event.preventDefault();
    if (!currentSupplierId || !db || !addDoc || !collection || !serverTimestamp) { displayError("Cannot save payment. DB connection or Supplier ID missing.", "paymentMadeError"); return; }
    const amountInput = document.getElementById('paymentAmount');
    const dateInput = document.getElementById('paymentDate');
    const methodInput = document.getElementById('paymentMethod');
    const notesInput = document.getElementById('paymentNotes');
    const linkedPoSelect = document.getElementById('paymentLinkPOSelect');
    const saveBtn = document.getElementById('savePaymentBtn');
    if (!amountInput || !dateInput || !methodInput || !notesInput || !linkedPoSelect || !saveBtn) { displayError("Payment form elements missing.", "paymentMadeError"); return; }
    const amount = parseFloat(amountInput.value); const paymentDateStr = dateInput.value; const method = methodInput.value; const notes = notesInput.value.trim();
    const linkedPoId = linkedPoSelect.value; const linkedPoNumber = linkedPoId ? linkedPoSelect.options[linkedPoSelect.selectedIndex]?.dataset?.poNumber : null;
    if (isNaN(amount) || amount <= 0) { displayError("Please enter a valid payment amount.", "paymentMadeError"); amountInput.focus(); return; }
    if (!paymentDateStr) { displayError("Please select a payment date.", "paymentMadeError"); dateInput.focus(); return; }
    saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; clearError('paymentMadeError');
    try {
        const paymentDate = Timestamp.fromDate(new Date(paymentDateStr + 'T00:00:00'));
        const paymentData = {
            supplierId: currentSupplierId, supplierName: currentSupplierData?.name || 'N/A', paymentAmount: amount, paymentDate: paymentDate,
            paymentMethod: method, notes: notes, createdAt: serverTimestamp(), linkedPoId: linkedPoId || null, linkedPoNumber: linkedPoNumber || null
        };
        const docRef = await addDoc(collection(db, "supplier_payments"), paymentData);
        const newPayment = { id: docRef.id, ...paymentData, createdAt: Timestamp.now() };
        supplierPaymentsData.push(newPayment);
        populatePaymentHistory(supplierPaymentsData);
        const currentPoSum = purchaseOrdersData.reduce((sum, po) => sum + (parseFloat(po.totalAmount) || 0), 0);
        const newPaymentSum = supplierPaymentsData.reduce((sum, p) => sum + (parseFloat(p.paymentAmount) || 0), 0);
        updateAccountSummary(currentPoSum, newPaymentSum);
        // TODO later: Update linked PO status if linkedPoId exists
        closePaymentModal(); alert("Payment recorded successfully!");
    } catch (error) { console.error("Error saving payment:", error); displayError(`Failed to save payment: ${error.message}`, "paymentMadeError"); }
    finally { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Payment'; }
}

// Edit Supplier Modal - <<< IMPLEMENTED >>>
function openEditSupplierModal(){
    const modal = document.getElementById('editSupplierModal');
    const form = document.getElementById('editSupplierForm');
    const nameInput = document.getElementById('editSupplierNameInput');
    const companyInput = document.getElementById('editSupplierCompanyInput');
    const whatsappInput = document.getElementById('editSupplierWhatsappInput');
    const contactInput = document.getElementById('editSupplierContactInput');
    const emailInput = document.getElementById('editSupplierEmailInput');
    const gstInput = document.getElementById('editSupplierGstInput');
    const addressInput = document.getElementById('editSupplierAddressInput');
    const hiddenIdInput = document.getElementById('editingSupplierId');

    if(!modal || !form || !nameInput || !companyInput || !whatsappInput || !contactInput || !emailInput || !gstInput || !addressInput || !hiddenIdInput || !currentSupplierData) {
        console.error("Edit supplier modal elements or supplier data missing.");
        alert("Could not open edit form."); return;
    }
    clearError('editSupplierError'); form.reset();

    // Populate form with currentSupplierData
    hiddenIdInput.value = currentSupplierId;
    nameInput.value = currentSupplierData.name || '';
    companyInput.value = currentSupplierData.companyName || '';
    whatsappInput.value = currentSupplierData.whatsappNo || '';
    contactInput.value = currentSupplierData.contact || ''; // Use contact if available
    emailInput.value = currentSupplierData.email || '';
    gstInput.value = currentSupplierData.gstNo || '';
    addressInput.value = currentSupplierData.address || '';

    modal.style.display = 'flex'; // Use flex for centering CSS
}
function closeEditSupplierModal(){ const modal = document.getElementById('editSupplierModal'); if(modal) modal.style.display = 'none'; }
async function handleEditSupplierSubmit(event){
    event.preventDefault();
    if (!currentSupplierId || !db || !doc || !updateDoc || !serverTimestamp) { displayError("Cannot update supplier. DB connection or Supplier ID missing.", "editSupplierError"); return; }
    const form = event.target; const saveBtn = document.getElementById('updateSupplierBtn');
    if(!form || !saveBtn) { displayError("Edit form or save button not found.", "editSupplierError"); return; }

    // Get data from form elements
    const updatedData = {
         name: form.querySelector('#editSupplierNameInput')?.value.trim(),
         name_lowercase: form.querySelector('#editSupplierNameInput')?.value.trim().toLowerCase(),
         companyName: form.querySelector('#editSupplierCompanyInput')?.value.trim(),
         whatsappNo: form.querySelector('#editSupplierWhatsappInput')?.value.trim(),
         contact: form.querySelector('#editSupplierContactInput')?.value.trim(), // Get contact number
         email: form.querySelector('#editSupplierEmailInput')?.value.trim(),
         gstNo: form.querySelector('#editSupplierGstInput')?.value.trim(),
         address: form.querySelector('#editSupplierAddressInput')?.value.trim(),
         updatedAt: serverTimestamp() // Update timestamp
    };

    if (!updatedData.name) { displayError("Supplier Name is required.", "editSupplierError"); return; }

    saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; clearError('editSupplierError');

    try {
        const supplierRef = doc(db, "suppliers", currentSupplierId);
        await updateDoc(supplierRef, updatedData);
        console.log("Supplier details updated successfully.");

        // Update local data and UI immediately
        currentSupplierData = { ...currentSupplierData, ...updatedData }; // Update global cache
        populateSupplierDetails(currentSupplierData); // Refresh details section on page

        closeEditSupplierModal();
        alert("Supplier details updated!");

    } catch(error) {
        console.error("Error updating supplier details:", error);
        displayError(`Failed to update details: ${error.message}`, "editSupplierError");
    } finally {
         saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Update Supplier';
    }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    if (listenersAttached) return;
    const addPayBtn = document.getElementById('addPaymentMadeBtn'); if (addPayBtn) addPayBtn.addEventListener('click', openPaymentModal); else console.warn("Add Payment Btn not found");
    const closeBtnPay = document.getElementById('closePaymentMadeModalBtn'); if (closeBtnPay) closeBtnPay.addEventListener('click', closePaymentModal); else console.warn("Close Payment Modal Btn not found");
    const cancelBtnPay = document.getElementById('cancelPaymentBtn'); if (cancelBtnPay) cancelBtnPay.addEventListener('click', closePaymentModal); else console.warn("Cancel Payment Btn not found");
    const payModal = document.getElementById('paymentMadeModal'); if (payModal) payModal.addEventListener('click', (event) => { if (event.target === payModal) closePaymentModal(); }); else console.warn("Payment Modal not found");
    const payForm = document.getElementById('paymentMadeForm'); if (payForm) payForm.addEventListener('submit', handleSavePayment); else console.warn("Payment Form not found");
    const editBtn = document.getElementById('editSupplierDetailsBtn'); if (editBtn) editBtn.addEventListener('click', openEditSupplierModal); else console.warn("Edit Supplier Btn not found");
    const closeEditBtn = document.getElementById('closeEditSupplierBtn'); if (closeEditBtn) closeEditBtn.addEventListener('click', closeEditSupplierModal); else console.warn("Close Edit Supplier Btn not found");
    const cancelEditBtn = document.getElementById('cancelEditSupplierBtn'); if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditSupplierModal); else console.warn("Cancel Edit Supplier Btn not found");
    const editModal = document.getElementById('editSupplierModal'); if (editModal) editModal.addEventListener('click', (event) => { if (event.target === editModal) closeEditSupplierModal(); }); else console.warn("Edit Supplier Modal not found");
    const editForm = document.getElementById('editSupplierForm'); if (editForm) editForm.addEventListener('submit', handleEditSupplierSubmit); else console.warn("Edit Supplier Form not found");
    listenersAttached = true;
}

// --- Global Initialization & Auto-run ---
function attemptInitialization() {
    if (initializationAttempted) return; initializationAttempted = true;
    if (typeof window.initializeSupplierDetailPage === 'function') { window.initializeSupplierDetailPage(); } else { console.error("Initialization function not found."); }
}
window.initializeSupplierDetailPage = async () => {
     if (supplierDetailPageInitialized) { return; } supplierDetailPageInitialized = true;
     clearError(); const mainContent = document.getElementById('detailMainContent'); if (mainContent) mainContent.style.visibility = 'visible'; else console.error("Main content missing!");
     if (typeof db === 'undefined' || !db) { console.error("Firestore db instance not available!"); displayError("Database connection failed."); return; }
     await loadSupplierAccountData(); // This now calls setupEventListeners inside it after data loads
};
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', attemptInitialization); } else { attemptInitialization(); }