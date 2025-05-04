// js/supplier_account_detail.js - v2 (Use Direct Imports to fix errors)

// --- Import Firebase functions directly ---
import { db } from './firebase-init.js'; // Use relative path from within JS folder
import {
    doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp,
    addDoc, serverTimestamp // Ensure all needed functions are imported
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Global Variables ---
let currentSupplierId = null;
let currentSupplierData = null;

// --- DOM References ---
const supplierNameHeader = document.getElementById('supplierNameHeader');
const supplierNameBreadcrumb = document.getElementById('supplierNameBreadcrumb');
const addPaymentMadeBtn = document.getElementById('addPaymentMadeBtn');
const editSupplierDetailsBtn = document.getElementById('editSupplierDetailsBtn');
const detailSupplierId = document.getElementById('detailSupplierId');
const detailSupplierName = document.getElementById('detailSupplierName');
const detailSupplierCompany = document.getElementById('detailSupplierCompany');
const detailSupplierWhatsapp = document.getElementById('detailSupplierWhatsapp');
const detailSupplierEmail = document.getElementById('detailSupplierEmail');
const detailSupplierGst = document.getElementById('detailSupplierGst');
const detailSupplierAddress = document.getElementById('detailSupplierAddress');
const summaryTotalPoValue = document.getElementById('summaryTotalPoValue');
const summaryTotalPaid = document.getElementById('summaryTotalPaid');
const summaryBalance = document.getElementById('summaryBalance');
const supplierPoTableBody = document.getElementById('supplierPoTableBody');
const supplierPoLoading = document.getElementById('supplierPoLoading');
const supplierPoListError = document.getElementById('supplierPoListError');
const supplierPaymentsTableBody = document.getElementById('supplierPaymentsTableBody');
const supplierPaymentLoading = document.getElementById('supplierPaymentLoading');
const supplierPaymentListError = document.getElementById('supplierPaymentListError');
const addPaymentModal = document.getElementById('addPaymentModal');
const closePaymentModalBtn = document.getElementById('closePaymentModal');
const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
const addPaymentForm = document.getElementById('addPaymentForm');
const paymentModalSupplierName = document.getElementById('paymentModalSupplierName');
const paymentAmountInput = document.getElementById('paymentAmount');
const paymentDateInput = document.getElementById('paymentDate');
const paymentMethodSelect = document.getElementById('paymentMethod');
const paymentNotesInput = document.getElementById('paymentNotes');
const savePaymentBtn = document.getElementById('savePaymentBtn');
const paymentFormError = document.getElementById('paymentFormError');


// --- Utility Functions ---
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { try { unsafe = String(unsafe ?? ''); } catch (e) { unsafe = ''; } } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function formatCurrency(amount) { const num = Number(amount); if (isNaN(num)) return 'N/A'; return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatDate(timestamp) { if (!timestamp || typeof timestamp.toDate !== 'function') return '-'; try { return timestamp.toDate().toLocaleDateString('en-GB'); } catch (e) { console.error("Error formatting date:", e); return '-'; } }

// --- Show/Hide Loading/Error ---
function setLoadingState(tableBody, loadingRow, errorDiv, isLoading, message = 'Loading...') {
    if (!tableBody || !loadingRow || !errorDiv) { console.error("setLoadingState: Missing required element for", tableBody?.id || loadingRow?.id || errorDiv?.id); return; }
    try {
        if (isLoading) {
            tableBody.innerHTML = ''; // Clear previous data
            loadingRow.style.display = 'table-row';
            const loadingCell = loadingRow.querySelector('td');
            if (loadingCell) { loadingCell.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${escapeHtml(message)}`; }
            errorDiv.style.display = 'none';
        } else {
            loadingRow.style.display = 'none';
        }
    } catch(e) { console.error("Error in setLoadingState", e); }
}
function setSummaryLoadingState(isLoading){
     const loadingText = '<span class="loading-state">Calculating...</span>';
     const zeroCurrency = formatCurrency(0);
     try {
         if(summaryTotalPoValue) summaryTotalPoValue.innerHTML = isLoading ? loadingText : zeroCurrency;
         if(summaryTotalPaid) summaryTotalPaid.innerHTML = isLoading ? loadingText : zeroCurrency;
         if(summaryBalance) {
            summaryBalance.innerHTML = isLoading ? loadingText : zeroCurrency;
            summaryBalance.className = 'balance-info loading-state';
         }
     } catch(e) { console.error("Error in setSummaryLoadingState", e); }
}
function showError(errorDiv, message) {
    if (errorDiv) {
        try {
            errorDiv.textContent = message;
            errorDiv.style.display = message ? 'block' : 'none';
        } catch(e) { console.error("Error showing error message", e); }
    } else {
        console.error("Error display element not found:", message);
    }
}


// --- Main Initialization Function ---
// Needs to be on window scope to be called by HTML's script block
async function initializeSupplierDetailPage(user, database) { // Accept db instance
    console.log("Initializing Supplier Detail Page v2...");
    const urlParams = new URLSearchParams(window.location.search);
    currentSupplierId = urlParams.get('id');

    if (!currentSupplierId) {
        console.error("Supplier ID missing from URL.");
        const mainContent = document.getElementById('detailMainContent');
        if(mainContent) mainContent.innerHTML = "<p class='error-message' style='padding:20px;'>Error: Supplier ID not found.</p>";
        return;
    }
    if (!database) {
        console.error("Database instance not passed during initialization.");
        const mainContent = document.getElementById('detailMainContent');
        if(mainContent) mainContent.innerHTML = "<p class='error-message' style='padding:20px;'>Error: Database connection failed.</p>";
        return;
    }

    console.log("Supplier ID:", currentSupplierId);
    setupDetailEventListeners();
    await loadSupplierAccountData(database); // Pass db instance
}
// Assign to window so HTML can call it
window.initializeSupplierDetailPage = initializeSupplierDetailPage;


// --- Data Loading ---
async function loadSupplierAccountData(dbInstance) {
    if (!currentSupplierId || !dbInstance) {
         console.error("loadSupplierAccountData: Missing Supplier ID or DB instance.");
         showError(supplierPoListError, "Init error.");
         showError(supplierPaymentListError, "Init error.");
         setSummaryLoadingState(false);
         return;
    }

    setLoadingState(supplierPoTableBody, supplierPoLoading, supplierPoListError, true, 'Loading POs...');
    setLoadingState(supplierPaymentsTableBody, supplierPaymentLoading, supplierPaymentListError, true, 'Loading payments...');
    setSummaryLoadingState(true);
    displaySupplierDetails({}); // Clear details

    try {
        // 1. Fetch Supplier Details (Using imported functions)
        console.log(`Workspaceing details for supplier ID: ${currentSupplierId}`);
        const supplierRef = doc(dbInstance, "suppliers", currentSupplierId); // Use imported doc
        const supplierSnap = await getDoc(supplierRef); // Use imported getDoc

        if (!supplierSnap.exists()) {
            throw new Error(`Supplier with ID ${currentSupplierId} not found.`);
        }
        currentSupplierData = { id: supplierSnap.id, ...supplierSnap.data() };
        console.log("Supplier Data:", currentSupplierData);
        displaySupplierDetails(currentSupplierData);

        // 2. Fetch POs and Payments concurrently
        console.log("Fetching POs and Payments concurrently...");
        const [poResult, paymentResult] = await Promise.allSettled([
            loadSupplierPOs(dbInstance),
            loadSupplierPayments(dbInstance)
        ]);

        let poTotal = 0;
        if (poResult.status === 'fulfilled') { poTotal = poResult.value; console.log("PO Total:", poTotal); showError(supplierPoListError, ''); }
        else { console.error("POs Error:", poResult.reason); showError(supplierPoListError, `Error: ${poResult.reason?.message || 'Unknown'}`); }

        let paidTotal = 0;
        if (paymentResult.status === 'fulfilled') { paidTotal = paymentResult.value; console.log("Paid Total:", paidTotal); showError(supplierPaymentListError, ''); }
        else { console.error("Payments Error:", paymentResult.reason); if (paymentResult.reason?.code === 'failed-precondition') { showError(supplierPaymentListError, `Error: Index missing for payments.`); } else { showError(supplierPaymentListError, `Error: ${paymentResult.reason?.message || 'Unknown'}`); } }

        // 3. Calculate and Display Balance
        calculateAndDisplayBalance(poTotal, paidTotal);
        setSummaryLoadingState(false);

    } catch (error) {
        console.error("Error loading supplier account data:", error);
        const mainContentArea = document.getElementById('detailMainContent');
        if(mainContentArea){ mainContentArea.innerHTML = `<p class='error-message' style='padding:20px;'>Error loading supplier data: ${escapeHtml(error.message)}</p>`; }
        setLoadingState(supplierPoTableBody, supplierPoLoading, supplierPoListError, false);
        setLoadingState(supplierPaymentsTableBody, supplierPaymentLoading, supplierPaymentListError, false);
        setSummaryLoadingState(false);
    }
}

function displaySupplierDetails(supplierData) {
    const name = escapeHtml(supplierData.name || 'N/A');
    if(supplierNameHeader) supplierNameHeader.textContent = name;
    if(supplierNameBreadcrumb) supplierNameBreadcrumb.textContent = name;
    document.title = `Account - ${name}`;
    [detailSupplierId, detailSupplierName, detailSupplierCompany, detailSupplierWhatsapp, detailSupplierEmail, detailSupplierGst, detailSupplierAddress].forEach(el => { if (el) el.classList.remove('loading-state'); });
    if(detailSupplierId) detailSupplierId.textContent = escapeHtml(supplierData.id || 'N/A');
    if(detailSupplierName) detailSupplierName.textContent = name;
    if(detailSupplierCompany) detailSupplierCompany.textContent = escapeHtml(supplierData.companyName || '-');
    if(detailSupplierWhatsapp) detailSupplierWhatsapp.textContent = escapeHtml(supplierData.whatsappNo || '-');
    if(detailSupplierEmail) detailSupplierEmail.textContent = escapeHtml(supplierData.email || '-');
    if(detailSupplierGst) detailSupplierGst.textContent = escapeHtml(supplierData.gstNo || '-');
    if(detailSupplierAddress) detailSupplierAddress.textContent = escapeHtml(supplierData.address || '-');
    if(paymentModalSupplierName) paymentModalSupplierName.textContent = name;
}

async function loadSupplierPOs(dbInstance) {
    if (!currentSupplierId || !dbInstance || !collection || !query || !where || !orderBy || !getDocs || !supplierPoTableBody || !supplierPoLoading || !supplierPoListError) { console.error("loadPOs prerequisites missing."); showError(supplierPoListError, "Init error."); return 0; }
    let totalValue = 0;
    setLoadingState(supplierPoTableBody, supplierPoLoading, supplierPoListError, true, 'Loading POs...');
    try {
        const q = query(collection(dbInstance, "purchaseOrders"), where("supplierId", "==", currentSupplierId), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        setLoadingState(supplierPoTableBody, supplierPoLoading, supplierPoListError, false);
        if (querySnapshot.empty) {
            supplierPoTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 15px;">No POs found.</td></tr>';
        } else {
             supplierPoTableBody.innerHTML = ''; // Clear loading
            querySnapshot.forEach(docSnap => {
                const po = docSnap.data(); const poId = docSnap.id; totalValue += Number(po.totalAmount || 0);
                const tr = supplierPoTableBody.insertRow(); tr.setAttribute('data-id', poId);
                let paymentStatusText = po.paymentStatus || 'Pending'; let paymentStatusClass = paymentStatusText.toLowerCase().replace(/\s+/g, '-');
                let statusText = po.status || 'Unknown'; let statusClass = statusText.toLowerCase().replace(/\s+/g, '-');
                tr.innerHTML = `<td>${escapeHtml(po.poNumber || 'N/A')}</td><td>${formatDate(po.orderDate || po.createdAt)}</td><td style="text-align: right;">${formatCurrency(po.totalAmount || 0)}</td><td><span class="status-badge status-${statusClass}">${escapeHtml(statusText)}</span></td><td><span class="payment-badge payment-${paymentStatusClass}">${escapeHtml(paymentStatusText)}</span></td>`;
            });
        }
        console.log(`Loaded ${querySnapshot.size} POs for ${currentSupplierId}`); return totalValue;
    } catch (error) { console.error("Error loading POs:", error); setLoadingState(supplierPoTableBody, supplierPoLoading, supplierPoListError, false); showError(supplierPoListError, `Error: ${error.message}`); return 0; }
}

async function loadSupplierPayments(dbInstance) {
     if (!currentSupplierId || !dbInstance || !collection || !query || !where || !orderBy || !getDocs || !supplierPaymentsTableBody || !supplierPaymentLoading || !supplierPaymentListError) { console.error("loadPayments prerequisites missing."); showError(supplierPaymentListError, "Init error."); return 0; }
    let totalPaid = 0;
    setLoadingState(supplierPaymentsTableBody, supplierPaymentLoading, supplierPaymentListError, true, 'Loading payments...');
    try {
        const q = query(collection(dbInstance, "supplier_payments"), where("supplierId", "==", currentSupplierId), orderBy("paymentDate", "desc"));
        const querySnapshot = await getDocs(q);
        setLoadingState(supplierPaymentsTableBody, supplierPaymentLoading, supplierPaymentListError, false);
        if (querySnapshot.empty) {
            supplierPaymentsTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 15px;">No payments recorded.</td></tr>';
        } else {
             supplierPaymentsTableBody.innerHTML = ''; // Clear loading
            querySnapshot.forEach(docSnap => {
                const payment = docSnap.data(); const paymentId = docSnap.id; totalPaid += Number(payment.paymentAmount || 0);
                const tr = supplierPaymentsTableBody.insertRow(); tr.setAttribute('data-id', paymentId);
                tr.innerHTML = `<td>${formatDate(payment.paymentDate)}</td><td style="text-align: right;">${formatCurrency(payment.paymentAmount || 0)}</td><td>${escapeHtml(payment.paymentMethod || '-')}</td><td>${escapeHtml(payment.notes || '-')}</td>`;
            });
        }
        console.log(`Loaded ${querySnapshot.size} payments for ${currentSupplierId}`); return totalPaid;
    } catch (error) { console.error("Error loading payments:", error); if (error.code === 'failed-precondition') { showError(supplierPaymentListError, `Error: Index missing for payments.`); } else { showError(supplierPaymentListError, `Error: ${error.message}`); } setLoadingState(supplierPaymentsTableBody, supplierPaymentLoading, supplierPaymentListError, false); return 0; }
}

function calculateAndDisplayBalance(poTotal, paidTotal) {
    const balance = poTotal - paidTotal;
    if(summaryTotalPoValue) summaryTotalPoValue.textContent = formatCurrency(poTotal);
    if(summaryTotalPaid) summaryTotalPaid.textContent = formatCurrency(paidTotal);
    if (summaryBalance) {
        summaryBalance.classList.remove('loading-state', 'balance-due', 'balance-credit', 'balance-info');
        const tolerance = 0.01;
        if (balance > tolerance) { summaryBalance.textContent = formatCurrency(balance) + " Payable"; summaryBalance.classList.add('balance-due'); }
        else if (balance < -tolerance) { summaryBalance.textContent = formatCurrency(Math.abs(balance)) + " Advance"; summaryBalance.classList.add('balance-credit'); }
        else { summaryBalance.textContent = formatCurrency(0); summaryBalance.classList.add('balance-info'); }
    }
     console.log(`Balance Calculated: PO Total=${poTotal}, Paid Total=${paidTotal}, Balance=${balance}`);
}

// --- Event Listeners ---
function setupDetailEventListeners() {
    if (addPaymentMadeBtn) addPaymentMadeBtn.addEventListener('click', openAddPaymentModal);
    if (closePaymentModalBtn) closePaymentModalBtn.addEventListener('click', closeAddPaymentModal);
    if (cancelPaymentBtn) cancelPaymentBtn.addEventListener('click', closeAddPaymentModal);
    if (addPaymentModal) addPaymentModal.addEventListener('click', (event) => { if (event.target === addPaymentModal) closeAddPaymentModal(); });
    if (addPaymentForm) addPaymentForm.addEventListener('submit', handleSavePayment);
    if (editSupplierDetailsBtn) editSupplierDetailsBtn.addEventListener('click', () => { alert("Edit Supplier needs implementation."); });
    console.log("Detail Page Event Listeners Setup v2.");
}

// --- Add Payment Modal Functions ---
function openAddPaymentModal() {
    if (!addPaymentModal || !currentSupplierData) { alert("Cannot open payment modal."); return; }
    addPaymentForm.reset(); if(paymentFormError) paymentFormError.style.display = 'none';
    if(paymentModalSupplierName) paymentModalSupplierName.textContent = currentSupplierData.name || '';
    if(paymentDateInput) { try { paymentDateInput.valueAsDate = new Date(); } catch(e){} }
    if(savePaymentBtn) { savePaymentBtn.disabled = false; savePaymentBtn.innerHTML = '<i class="fas fa-save"></i> Save Payment'; }
    addPaymentModal.classList.add('active');
    if (paymentAmountInput) paymentAmountInput.focus();
}
function closeAddPaymentModal() { if (addPaymentModal) { addPaymentModal.classList.remove('active'); } }

// --- Save Payment Function ---
async function handleSavePayment(event) {
    event.preventDefault();
    // Use directly imported functions
    if (!currentSupplierId || !db || !collection || !addDoc || !Timestamp || !serverTimestamp) {
         showPaymentFormError("Error: DB functions missing or Supplier ID invalid.");
         console.error("DB Check Failed:", { currentSupplierId, db, collection, addDoc, Timestamp, serverTimestamp });
         return;
    }
    if (!paymentAmountInput || !paymentDateInput || !paymentMethodSelect || !paymentNotesInput) { showPaymentFormError("Error: Form elements missing."); return; }
    const amount = parseFloat(paymentAmountInput.value); const date = paymentDateInput.value; const method = paymentMethodSelect.value; const notes = paymentNotesInput.value.trim();
    if (isNaN(amount) || amount <= 0) { showPaymentFormError("Enter valid positive amount."); paymentAmountInput.focus(); return; }
    if (!date) { showPaymentFormError("Select payment date."); paymentDateInput.focus(); return; }
    if(savePaymentBtn) { savePaymentBtn.disabled = true; savePaymentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }
    showPaymentFormError('');
    try {
        const paymentDateTimestamp = Timestamp.fromDate(new Date(date + 'T00:00:00'));
        const paymentData = {
            supplierId: currentSupplierId, supplierName: currentSupplierData?.name || null,
            paymentAmount: amount, paymentDate: paymentDateTimestamp, paymentMethod: method,
            notes: notes || null, createdAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, "supplier_payments"), paymentData);
        console.log("Payment recorded: ID:", docRef.id); alert("Payment recorded successfully!");
        closeAddPaymentModal();
        await loadSupplierAccountData(db); // Reload all data
    } catch (error) { console.error("Error saving payment:", error); showPaymentFormError(`Error: ${error.message}`); }
    finally { if(savePaymentBtn) { savePaymentBtn.disabled = false; savePaymentBtn.innerHTML = '<i class="fas fa-save"></i> Save Payment'; } }
}

// --- Show Payment Form Error ---
function showPaymentFormError(message) { if (paymentFormError) { paymentFormError.textContent = message; paymentFormError.style.display = message ? 'block' : 'none'; } else { if(message) alert(message); } }

// --- Script Load Confirmation ---
console.log("supplier_account_detail.js v2 (Direct Imports) loaded.");