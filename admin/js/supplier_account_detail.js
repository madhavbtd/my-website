// js/supplier_account_detail.js
// संस्करण: DOM एलिमेंट प्राप्त करने में सुधार

// --- Firebase फ़ंक्शन आयात करें ---
import { db, auth } from './firebase-init.js';
import {
    doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp,
    addDoc, serverTimestamp, updateDoc, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- ग्लोबल वेरिएबल्स ---
let currentSupplierId = null;
let currentSupplierData = null;
let purchaseOrdersData = []; // PO डेटा स्टोर करने के लिए

// --- Helper Functions ---
function displayError(message, elementId = 'generalError') {
    console.error("Displaying Error:", message);
    try {
        let errorElement = document.getElementById(elementId) || document.getElementById('supplierPaymentListError') || document.getElementById('generalErrorDisplay');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            errorElement.style.color = 'red';
        } else {
            console.warn(`Error element '${elementId}' or fallbacks not found. Using alert.`);
            alert(`Error: ${message}`);
        }
    } catch(e) {
        console.error("Error within displayError:", e);
        alert(`Error: ${message}`); // Fallback
    }
}

function clearError(elementId = 'generalError') {
    try {
        let errorElement = document.getElementById(elementId) || document.getElementById('supplierPaymentListError') || document.getElementById('generalErrorDisplay');
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
        // अन्य संभावित एरर divs को भी साफ करें
        const paymentErr = document.getElementById('paymentMadeError');
        const editErr = document.getElementById('editSupplierError');
        if (paymentErr) paymentErr.style.display = 'none';
        if (editErr) editErr.style.display = 'none';
    } catch(e) {
        console.error("Error within clearError:", e);
    }
}


function getSupplierIdFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    } catch (e) {
        console.error("Error getting supplier ID from URL:", e);
        return null;
    }
}

function formatDate(timestamp) {
    // ... (formatDate फंक्शन वैसा ही) ...
    if (!timestamp || typeof timestamp.toDate !== 'function') { return 'Invalid Date'; }
    try {
        const date = timestamp.toDate();
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-IN', options);
    } catch (e) { console.error("Error formatting date:", timestamp, e); return 'Format Error'; }
}

function formatCurrency(amount) {
    // ... (formatCurrency फंक्शन वैसा ही) ...
    if (typeof amount !== 'number') { amount = parseFloat(amount); }
    if (isNaN(amount)) { return '₹ N/A'; }
    return `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// --- UI Population Functions ---
function populateSupplierDetails(data) {
    console.log("populateSupplierDetails called with data:", data ? data.id : 'null');
    // <<< एलिमेंट्स को फंक्शन के अंदर प्राप्त करें >>>
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

    if (!data) { /* ... Error handling ... */ return; }

    if (header) header.textContent = data.name || 'Supplier Account';
    if (breadcrumb) breadcrumb.textContent = data.name || 'Details';
    if (idEl) idEl.textContent = data.id || 'N/A';
    if (nameEl) nameEl.textContent = data.name || 'N/A';
    if (companyEl) companyEl.textContent = data.company || 'N/A';
    if (whatsappEl) whatsappEl.textContent = data.contact || 'N/A';
    if (emailEl) emailEl.textContent = data.email || 'N/A';
    if (gstEl) gstEl.textContent = data.gstNo || 'N/A';
    if (addressEl) addressEl.textContent = data.address || 'N/A';
    if (addedOnEl) addedOnEl.textContent = data.addedOn ? formatDate(data.addedOn) : 'N/A';
}

function populatePaymentHistory(payments) {
    console.log(`Populating payment history with ${payments ? payments.length : 0} items...`);
    // <<< एलिमेंट्स को फंक्शन के अंदर प्राप्त करें >>>
    const tableBody = document.getElementById('transactionsTableBody');
    const loadingRow = document.getElementById('transactionsLoading');
    const noDataRow = document.getElementById('noTransactionsMessage');
    const errorDisplay = document.getElementById('supplierPaymentListError');

    console.log("Payment Table Elements:", { tableBody, loadingRow, noDataRow });

    if (!tableBody) { console.error("Payment table body element not found!"); return; }
    tableBody.innerHTML = ''; // साफ करें

    if (loadingRow) loadingRow.style.display = 'none';
    if (errorDisplay) errorDisplay.style.display = 'none'; // एरर छिपाएं

    if (!payments || payments.length === 0) {
        console.log("No payments found, displaying 'no data' row.");
        if (noDataRow) {
            noDataRow.style.display = 'table-row';
        } else { tableBody.innerHTML = `<tr><td colspan="6">No payment history found.</td></tr>`; }
        return;
    }

    if (noDataRow) noDataRow.style.display = 'none';

    console.log("Adding payment rows...");
    payments.forEach((payment, index) => {
        // ... (row insertion code वैसा ही) ...
         try {
             const row = tableBody.insertRow();
             row.insertCell(0).textContent = formatDate(payment.paymentDate);
             row.insertCell(1).textContent = payment.notes || '-';
             row.insertCell(2).textContent = payment.paymentMethod || 'N/A';
             const poCell = row.insertCell(3);
             poCell.textContent = payment.linkedPoNumber || '-';
             const amountCell = row.insertCell(4);
             amountCell.textContent = formatCurrency(payment.paymentAmount);
             amountCell.classList.add('amount-paid');
             row.insertCell(5).textContent = ''; // Actions
        } catch(e) { console.error(`Error creating payment row ${index}:`, payment, e); /* ... Error row ... */ }
    });
    console.log("Finished adding payment rows.");
}

function updateAccountSummary(poTotal, paymentTotal) {
    console.log(`updateAccountSummary called with poTotal=${poTotal}, paymentTotal=${paymentTotal}`);
    // <<< एलिमेंट्स को फंक्शन के अंदर प्राप्त करें >>>
    const poDisplay = document.getElementById('summaryTotalPoValue');
    const paidDisplay = document.getElementById('summaryTotalPaid');
    const balanceDisplay = document.getElementById('summaryBalance');

    console.log("Summary Elements found:", { poDisplay, paidDisplay, balanceDisplay });

    const numPoTotal = parseFloat(poTotal) || 0;
    const numPaymentTotal = parseFloat(paymentTotal) || 0;
    const outstanding = numPoTotal - numPaymentTotal;

    if (poDisplay) {
         poDisplay.textContent = formatCurrency(numPoTotal);
         poDisplay.classList.remove('loading-state');
     } else { console.warn("Element 'summaryTotalPoValue' not found."); }

    if (paidDisplay) {
        paidDisplay.textContent = formatCurrency(numPaymentTotal);
        paidDisplay.classList.remove('loading-state');
    } else { console.warn("Element 'summaryTotalPaid' not found."); }

    if (balanceDisplay) {
        balanceDisplay.textContent = formatCurrency(outstanding);
        balanceDisplay.classList.remove('loading-state');
        balanceDisplay.classList.remove('balance-due', 'balance-credit', 'balance-zero', 'balance-info');
        if (outstanding > 0.01) balanceDisplay.classList.add('balance-due');
        else if (outstanding < -0.01) balanceDisplay.classList.add('balance-credit');
        else balanceDisplay.classList.add('balance-zero');
    } else { console.warn("Element 'summaryBalance' not found."); }
    console.log("Account summary UI update finished.");
}


function populatePoDropdown(pos) {
     console.log(`Populating PO dropdown with ${pos ? pos.length : 0} total POs...`);
     const dropdown = document.getElementById('paymentLinkPOSelect'); // <<< फंक्शन के अंदर प्राप्त करें
     if (!dropdown) { console.error("PO Link dropdown element not found!"); return; }
     // ... (बाकी ड्रॉपडाउन लॉजिक वैसा ही रहेगा) ...
      dropdown.innerHTML = '<option value="">None (Direct Payment)</option>';
      if (!pos || pos.length === 0) { /* ... */ return; }
      const relevantPOs = pos.filter(po => (parseFloat(po.totalAmount) || 0) > (parseFloat(po.amountPaid) || 0));
      if (relevantPOs.length === 0) { /* ... */ return; }
      relevantPOs.sort((a, b) => (b.orderDate?.toDate?.() || 0) - (a.orderDate?.toDate?.() || 0));
      relevantPOs.forEach(po => { /* ... option बनाएं और जोड़ें ... */ });
      console.log("PO dropdown populated.");
}

// --- Core Data Loading ---
async function loadSupplierAccountData() {
    console.log("loadSupplierAccountData: Function started.");
    // प्रमाणीकरण जांच
    console.log("loadSupplierAccountData: Checking Auth Status...");
    // ... (Auth check code वैसा ही) ...
     if (!auth.currentUser) { /* ... */ return; }

    currentSupplierId = getSupplierIdFromUrl();
    if (!currentSupplierId) { /* ... */ return; }
    if (!db) { /* ... */ return; }

    console.log(`Loading account data for ID: ${currentSupplierId}`);
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    clearError();

    let supplierData = null, payments = [], purchaseOrders = [], paymentSum = 0, poSum = 0;

    try {
        // Step 1: Supplier Details
        console.log("[Load Step 1] Loading supplier details...");
        const supplierRef = doc(db, "suppliers", currentSupplierId);
        const supplierSnap = await getDoc(supplierRef);
        if (!supplierSnap.exists()) throw new Error("Supplier not found");
        supplierData = { id: supplierSnap.id, ...supplierSnap.data() };
        currentSupplierData = supplierData;
        console.log("[Load Step 1] Supplier Data found:", supplierData);
        populateSupplierDetails(supplierData); // UI Update

        // Step 2 & 3: Load Payments and POs Concurrently
        console.log("[Load Steps 2 & 3] Loading payments and POs concurrently...");
        const [paymentsSnapshot, poSnapshot] = await Promise.all([
             getDocs(query(collection(db, "supplier_payments"), where("supplierId", "==", currentSupplierId), orderBy("paymentDate", "desc"))),
             getDocs(query(collection(db, "purchaseOrders"), where("supplierId", "==", currentSupplierId)))
        ]);

        // Process Payments
        console.log(`[Load Step 2] Found ${paymentsSnapshot.docs.length} payments.`);
        payments = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Load Step 2] Payments Data Array:", payments);
        paymentSum = payments.reduce((sum, p) => sum + (parseFloat(p.paymentAmount) || 0), 0);
        populatePaymentHistory(payments); // UI Update

        // Process POs
        console.log(`[Load Step 3] Found ${poSnapshot.docs.length} POs.`);
        purchaseOrders = poSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        purchaseOrdersData = purchaseOrders;
        console.log("[Load Step 3] POs Data Array:", purchaseOrders);
        poSum = purchaseOrders.reduce((sum, po) => sum + (parseFloat(po.totalAmount) || 0), 0);

        // Step 4: Update Summary
        console.log("[Load Step 4] Calculating & Updating Summary...");
        updateAccountSummary(poSum, paymentSum); // UI Update

        // Step 5: Populate Dropdown
        console.log("[Load Step 5] Populating PO dropdown...");
        populatePoDropdown(purchaseOrders); // UI Update

    } catch (error) {
        console.error("Error during loadSupplierAccountData execution:", error);
        // ... (विस्तृत एरर हैंडलिंग) ...
        displayError(`Error loading data: ${error.message}. Check console.`);
        // UI रीसेट करें
        if (!supplierData) populateSupplierDetails(null); // Clear details if supplier load failed
        populatePaymentHistory([]);
        updateAccountSummary(0, 0);
        populatePoDropdown([]);
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        console.log("loadSupplierAccountData finished.");
    }
}


// --- Event Handlers & Modal Functions ---
// ... (openPaymentModal, closePaymentModal, handleSavePayment पहले जैसे, सुनिश्चित करें कि वे सही IDs का उपयोग करते हैं) ...
function closePaymentModal() {
    console.log('closePaymentModal called!'); // <<< Log जोड़ा गया था
    const modal = document.getElementById('paymentMadeModal');
    if (!modal) { console.error("Payment modal element not found for closing"); return; }
    modal.style.display = 'none';
    modal.classList.remove('active');
    clearError('paymentMadeError'); // <<< सही ID का उपयोग करें
}

// ... (Edit Supplier functions वैसे ही) ...

// --- Event Listeners Setup ---
function setupEventListeners() {
    console.log("Setting up event listeners...");

    // Payment Modal
    const addPayBtn = document.getElementById('addPaymentMadeBtn');
    if (addPayBtn) addPayBtn.addEventListener('click', openPaymentModal);
    const closeBtnPay = document.getElementById('closePaymentMadeModalBtn');
    if (closeBtnPay) closeBtnPay.addEventListener('click', closePaymentModal);
    const cancelBtnPay = document.getElementById('cancelPaymentBtn');
    if (cancelBtnPay) {
         console.log("Found Cancel button (payment modal). Attaching listener...");
         cancelBtnPay.addEventListener('click', closePaymentModal); // <<< Listener यहां जोड़ा गया
    } else { console.warn("Could not find Cancel button for payment modal (ID: cancelPaymentBtn)"); }
    const payModal = document.getElementById('paymentMadeModal');
    if (payModal) payModal.addEventListener('click', (event) => { if (event.target === payModal) closePaymentModal(); });
    const payForm = document.getElementById('paymentMadeForm');
    if (payForm) payForm.addEventListener('submit', handleSavePayment);

    // Edit Modal
    const editBtn = document.getElementById('editSupplierDetailsBtn');
    if (editBtn) editBtn.addEventListener('click', openEditSupplierModal);
    const closeBtnEdit = document.getElementById('closeEditSupplierBtn');
    if (closeBtnEdit) closeBtnEdit.addEventListener('click', closeEditSupplierModal);
    const cancelBtnEdit = document.getElementById('cancelEditSupplierBtn');
    if (cancelBtnEdit) cancelBtnEdit.addEventListener('click', closeEditSupplierModal);
    const editModal = document.getElementById('editSupplierModal');
    if (editModal) editModal.addEventListener('click', (event) => { if (event.target === editModal) closeEditSupplierModal(); });
    const editForm = document.getElementById('editSupplierForm');
    // if (editForm) editForm.addEventListener('submit', handleEditSupplierSubmit); // <<< हैंडलर नाम सुनिश्चित करें

    console.log("Supplier detail event listeners setup complete.");
}

// --- Global Initialization & Auto-run ---
// ... (Initialization कोड वैसा ही) ...
window.initializeSupplierDetailPage = async () => { /* ... */ };
let initializationAttempted = false;
function attemptInitialization() { /* ... */ }
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', attemptInitialization); } else { attemptInitialization(); }


console.log("supplier_account_detail.js loaded and running (v_dom_fix).");

// --- स्टब्स जोड़ें अगर फंक्शन्स परिभाषित नहीं हैं ---
if (typeof handleSavePayment === 'undefined') { window.handleSavePayment = async function(e) { e.preventDefault(); alert("Save Payment logic not fully implemented."); } }
if (typeof openEditSupplierModal === 'undefined') { window.openEditSupplierModal = function() { alert("Cannot open edit modal."); } }
if (typeof closeEditSupplierModal === 'undefined') { window.closeEditSupplierModal = function() { alert("Cannot close edit modal."); } }
// if (typeof handleEditSupplierSubmit === 'undefined') { window.handleEditSupplierSubmit = async function(e) { e.preventDefault(); alert("Update Supplier logic not fully implemented."); } }