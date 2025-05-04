// js/supplier_account_detail.js
// संस्करण: रिस्टोर किए गए कोड पर आधारित न्यूनतम बदलाव + समरी फिक्स + PO टेबल

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
let purchaseOrdersData = [];
let listenersAttached = false; // लिस्नर दोबारा अटैच होने से रोकने के लिए

// --- DOM रेफरेंसेस (आपके रिस्टोर किए गए कोड से, आवश्यक सुधारों के साथ) ---
const supplierNameHeader = document.getElementById('supplierNameHeader');
const supplierNameBreadcrumb = document.getElementById('supplierNameBreadcrumb');
const addPaymentMadeBtn = document.getElementById('addPaymentMadeBtn');
const editSupplierDetailsBtn = document.getElementById('editSupplierDetailsBtn');

// Supplier Details Elements
const detailSupplierId = document.getElementById('detailSupplierId');
const detailSupplierName = document.getElementById('detailSupplierName');
const detailSupplierCompany = document.getElementById('detailSupplierCompany');
const detailSupplierWhatsapp = document.getElementById('detailSupplierWhatsapp');
const detailSupplierEmail = document.getElementById('detailSupplierEmail');
const detailSupplierGst = document.getElementById('detailSupplierGst');
const detailSupplierAddress = document.getElementById('detailSupplierAddress');
const detailAddedOn = document.getElementById('detailAddedOn'); // +++ जोड़ा गया +++

// Account Summary Elements (IDs HTML से मेल खाने के लिए ठीक की गईं)
const summaryTotalPoValue = document.getElementById('summaryTotalPoValue'); // <<< ID ठीक की गई
const summaryTotalPaymentsMade = document.getElementById('summaryTotalPaid');  // <<< ID ठीक की गई
const summaryOutstandingBalance = document.getElementById('summaryBalance');     // <<< ID ठीक की गई

// PO Table Elements (IDs HTML से मेल खाने के लिए ठीक की गईं)
const poTableBody = document.getElementById('supplierPoTableBody'); // <<< यह ठीक था
const poLoadingMessage = document.getElementById('supplierPoLoading'); // <<< यह ठीक था
const poListError = document.getElementById('supplierPoListError');
const noSupplierPoMessageRow = document.getElementById('noSupplierPoMessage'); // +++ जोड़ा गया +++

// Payments Table Elements (IDs HTML से मेल खाने के लिए ठीक की गईं)
const paymentsTableBody = document.getElementById('transactionsTableBody'); // <<< ID ठीक की गई
const paymentsLoadingMessage = document.getElementById('transactionsLoading'); // <<< ID ठीक की गई
const paymentsListError = document.getElementById('supplierPaymentListError');
const noTransactionsMessageRow = document.getElementById('noTransactionsMessage'); // +++ जोड़ा गया +++

// Add Payment Modal Elements (IDs HTML से मेल खाने के लिए जांची गईं)
const addPaymentModal = document.getElementById('paymentMadeModal');
const closePaymentModal = document.getElementById('closePaymentMadeModalBtn'); // <<< ID ठीक की गई
const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
const paymentModalSupplierName = document.getElementById('paymentSupplierName'); // <<< ID ठीक की गई
const addPaymentForm = document.getElementById('paymentMadeForm'); // <<< ID ठीक की गई
const paymentAmountInput = document.getElementById('paymentAmount');
const paymentDateInput = document.getElementById('paymentDate');
const paymentMethodSelect = document.getElementById('paymentMethod'); // <<< ID ठीक की गई
const paymentNotesInput = document.getElementById('paymentNotes');
const savePaymentBtn = document.getElementById('savePaymentBtn');
const paymentFormError = document.getElementById('paymentMadeError'); // <<< ID ठीक की गई
const paymentPoSelect = document.getElementById('paymentLinkPOSelect'); // <<< ID ठीक की गई

// Edit Supplier Modal Elements (IDs HTML से मेल खाने के लिए जांची गईं)
const editSupplierModal = document.getElementById('editSupplierModal');
const closeEditSupplierModalBtn = document.getElementById('closeEditSupplierBtn'); // <<< ID ठीक की गई
const cancelEditSupplierBtn = document.getElementById('cancelEditSupplierBtn');
const editSupplierForm = document.getElementById('editSupplierForm');
const editSupplierFormError = document.getElementById('editSupplierError'); // <<< ID ठीक की गई
const editingSupplierIdInput = document.getElementById('editingSupplierId');
const editSupplierNameInput = document.getElementById('editSupplierNameInput');
const editSupplierCompanyInput = document.getElementById('editSupplierCompanyInput');
const editSupplierWhatsappInput = document.getElementById('editSupplierWhatsappInput'); // <<< ID ठीक की गई
const editSupplierContactInput = document.getElementById('editSupplierContactInput');
const editSupplierEmailInput = document.getElementById('editSupplierEmailInput');
const editSupplierGstInput = document.getElementById('editSupplierGstInput');
const editSupplierAddressInput = document.getElementById('editSupplierAddressInput');
const updateSupplierBtn = document.getElementById('updateSupplierBtn');

// Loading Indicator
const loadingIndicator = document.getElementById('loadingIndicator');

// --- Helper Functions ---
function displayError(message, elementId = 'generalErrorDisplay') { /* ... */ }
function clearError(elementId = 'generalErrorDisplay') { /* ... */ }
function getSupplierIdFromUrl() { /* ... */ }
function formatDate(timestamp) { /* ... */ }
function formatCurrency(amount) { /* ... */ }
function getStatusClass(status) { /* ... */ }
function getPaymentStatusClass(status) { /* ... */ }


// --- UI Population Functions ---
function populateSupplierDetails(data) {
    console.log("populateSupplierDetails called");
    if (!data) return;

    if (supplierNameHeader) supplierNameHeader.textContent = data.name || 'Supplier Account';
    if (supplierNameBreadcrumb) supplierNameBreadcrumb.textContent = data.name || 'Details';
    if (detailSupplierId) detailSupplierId.textContent = data.id || 'N/A';
    if (detailSupplierName) detailSupplierName.textContent = data.name || 'N/A';
    if (detailSupplierCompany) detailSupplierCompany.textContent = data.company || 'N/A';
    if (detailSupplierWhatsapp) detailSupplierWhatsapp.textContent = data.whatsappNo || data.contact || 'N/A';
    if (detailSupplierEmail) detailSupplierEmail.textContent = data.email || 'N/A';
    if (detailSupplierGst) detailSupplierGst.textContent = data.gstNo || 'N/A';
    if (detailSupplierAddress) detailSupplierAddress.textContent = data.address || 'N/A';
    // +++ detailAddedOn एलिमेंट अब मौजूद है, इसे अपडेट करें +++
    if (detailAddedOn) detailAddedOn.textContent = data.addedOn ? formatDate(data.addedOn) : 'N/A';
}

function populatePaymentHistory(payments) {
    console.log(`Populating payment history with ${payments ? payments.length : 0} items...`);
    const tableBody = paymentsTableBody; // <<< सही ग्लोबल वेरिएबल का उपयोग करें
    const loadingRow = paymentsLoadingMessage; // <<< सही ग्लोबल वेरिएबल का उपयोग करें
    const noDataRow = noTransactionsMessageRow; // <<< सही ग्लोबल वेरिएबल का उपयोग करें
    const errorDisplay = paymentsListError; // <<< सही ग्लोबल वेरिएबल का उपयोग करें

    if (!tableBody) { console.error("Payment table body not found!"); return; }
    tableBody.innerHTML = '';
    if (loadingRow) loadingRow.style.display = 'none';
    if (errorDisplay) errorDisplay.style.display = 'none';

    if (!payments || payments.length === 0) {
        if (noDataRow) noDataRow.style.display = 'table-row';
        else tableBody.innerHTML = `<tr><td colspan="6">No payment history found.</td></tr>`; // Colspan 6 है
        return;
    }

    if (noDataRow) noDataRow.style.display = 'none';

    payments.forEach((payment, index) => {
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
        } catch(e) { console.error(`Error creating payment row ${index}:`, payment, e); }
    });
    console.log("Finished adding payment rows.");
}

function populatePoHistoryTable(pos) {
    console.log(`Populating PO history with ${pos ? pos.length : 0} items...`);
    const tableBody = poTableBody; // <<< सही ग्लोबल वेरिएबल का उपयोग करें
    const loadingRow = poLoadingMessage; // <<< सही ग्लोबल वेरिएबल का उपयोग करें
    const noDataRow = noSupplierPoMessageRow; // <<< सही ग्लोबल वेरिएबल का उपयोग करें
    const errorDisplay = poListError; // <<< सही ग्लोबल वेरिएबल का उपयोग करें

    if (!tableBody) { console.error("PO table body not found!"); return; }
    tableBody.innerHTML = '';
    if (loadingRow) loadingRow.style.display = 'none';
    if (errorDisplay) errorDisplay.style.display = 'none';

    if (!pos || pos.length === 0) {
        if (noDataRow) noDataRow.style.display = 'table-row';
        else tableBody.innerHTML = `<tr><td colspan="6">No purchase orders found.</td></tr>`; // Colspan 6 है
        return;
    }

    if (noDataRow) noDataRow.style.display = 'none';

    pos.sort((a, b) => (b.orderDate?.toDate?.() || 0) - (a.orderDate?.toDate?.() || 0));

    pos.forEach((po, index) => {
        try {
            const row = tableBody.insertRow();
            row.insertCell(0).textContent = po.poNumber || `PO-${po.id.substring(0, 6)}`;
            row.insertCell(1).textContent = formatDate(po.orderDate);
            const amountCell = row.insertCell(2);
            amountCell.textContent = formatCurrency(po.totalAmount);
            amountCell.classList.add('amount-po');
            const statusCell = row.insertCell(3);
            const statusSpan = document.createElement('span');
            statusSpan.className = `status-badge ${getStatusClass(po.status)}`;
            statusSpan.textContent = po.status || 'Unknown';
            statusCell.appendChild(statusSpan);
            const paymentStatusCell = row.insertCell(4);
            const paymentStatusSpan = document.createElement('span');
            paymentStatusSpan.className = `status-badge ${getPaymentStatusClass(po.paymentStatus)}`;
            paymentStatusSpan.textContent = po.paymentStatus || 'Pending';
            paymentStatusCell.appendChild(paymentStatusSpan);
            const actionCell = row.insertCell(5); // Actions कॉलम
        } catch (e) { console.error(`Error creating PO row ${index}:`, po, e); }
    });
    console.log("Finished adding PO rows.");
}

// *** अकाउंट समरी अपडेट फंक्शन (सही IDs के साथ) ***
function updateAccountSummary(poTotal, paymentTotal) {
    console.log(`updateAccountSummary called with poTotal=${poTotal}, paymentTotal=${paymentTotal}`);
    // <<< --- सही ग्लोबल वेरिएबल्स का उपयोग करें --- >>>
    const poDisplay = summaryTotalPoValue;
    const paidDisplay = summaryTotalPaymentsMade;
    const balanceDisplay = summaryOutstandingBalance;
    // <<< --- सही ग्लोबल वेरिएबल्स का उपयोग करें --- >>>

    console.log("Attempting to update summary. Elements found:", { poDisplay, paidDisplay, balanceDisplay });

    const numPoTotal = parseFloat(poTotal) || 0;
    const numPaymentTotal = parseFloat(paymentTotal) || 0;
    const outstanding = numPoTotal - numPaymentTotal;

    if (poDisplay) {
         poDisplay.textContent = formatCurrency(numPoTotal);
         poDisplay.classList.remove('loading-state');
     } else { console.warn("Element 'summaryTotalPoValue' not found (check HTML ID and JS const)."); }

    if (paidDisplay) {
        paidDisplay.textContent = formatCurrency(numPaymentTotal);
        paidDisplay.classList.remove('loading-state');
    } else { console.warn("Element 'summaryTotalPaid' not found (check HTML ID and JS const)."); }

    if (balanceDisplay) {
        balanceDisplay.textContent = formatCurrency(outstanding);
        balanceDisplay.classList.remove('loading-state');
        balanceDisplay.classList.remove('balance-due', 'balance-credit', 'balance-zero', 'balance-info');
        if (outstanding > 0.01) balanceDisplay.classList.add('balance-due');
        else if (outstanding < -0.01) balanceDisplay.classList.add('balance-credit');
        else balanceDisplay.classList.add('balance-zero');
    } else { console.warn("Element 'summaryBalance' not found (check HTML ID and JS const)."); }
    console.log("Account summary UI update finished.");
}


function populatePoDropdown(pos) {
     const dropdown = paymentPoSelect; // <<< सही ग्लोबल वेरिएबल का उपयोग करें
     if (!dropdown) { console.error("PO Link dropdown element not found!"); return; }
     // ... (बाकी कोड वैसा ही) ...
     console.log("PO dropdown populated.");
}

// --- Core Data Loading ---
async function loadSupplierAccountData(dbInstance) { // <<< dbInstance पैरामीटर फिर से जोड़ा
    // Check if dbInstance was passed, otherwise use global db
    const dbToUse = dbInstance || db;
    if (!dbToUse) { displayError("Database connection failed."); return; }

    console.log("loadSupplierAccountData: Function started.");
    // ... (Auth check वैसा ही) ...
     if (!auth.currentUser) { return; }

    currentSupplierId = getSupplierIdFromUrl();
    if (!currentSupplierId) { displayError("Supplier ID missing."); return; }

    console.log(`Loading account data for ID: ${currentSupplierId}`);
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    clearError();

    let supplierData = null, payments = [], purchaseOrders = [], paymentSum = 0, poSum = 0;

    try {
        // Step 1: Supplier Details
        const supplierRef = doc(dbToUse, "suppliers", currentSupplierId);
        const supplierSnap = await getDoc(supplierRef);
        if (!supplierSnap.exists()) throw new Error("Supplier not found");
        supplierData = { id: supplierSnap.id, ...supplierSnap.data() };
        currentSupplierData = supplierData;
        populateSupplierDetails(supplierData);

        // Step 2 & 3: Load Payments and POs Concurrently
        const [paymentsSnapshot, poSnapshot] = await Promise.all([
             getDocs(query(collection(dbToUse, "supplier_payments"), where("supplierId", "==", currentSupplierId), orderBy("paymentDate", "desc"))),
             getDocs(query(collection(dbToUse, "purchaseOrders"), where("supplierId", "==", currentSupplierId)))
        ]);

        // Process Payments
        payments = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        paymentSum = payments.reduce((sum, p) => sum + (parseFloat(p.paymentAmount) || 0), 0);
        populatePaymentHistory(payments);

        // Process POs
        purchaseOrders = poSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        purchaseOrdersData = purchaseOrders;
        poSum = purchaseOrders.reduce((sum, po) => sum + (parseFloat(po.totalAmount) || 0), 0);
        populatePoHistoryTable(purchaseOrders); // <<< PO टेबल पॉप्युलेट करें

        // Step 4: Update Summary
        updateAccountSummary(poSum, paymentSum);

        // Step 5: Populate Dropdown
        populatePoDropdown(purchaseOrders);

    } catch (error) {
        console.error("Error during loadSupplierAccountData execution:", error);
        displayError(`Error loading data: ${error.message}. Check console.`);
        if (!supplierData) populateSupplierDetails(null);
        populatePaymentHistory([]); populatePoHistoryTable([]); updateAccountSummary(0, 0); populatePoDropdown([]);
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        console.log("loadSupplierAccountData finished.");
    }
}


// --- Event Handlers & Modal Functions ---
// ... (सभी हैंडलर और मोडाल फंक्शन आपके रिस्टोर किए गए कोड से होने चाहिए) ...
// सुनिश्चित करें कि handleSavePayment, updatePurchaseOrderStatus, open/closePaymentModal, open/closeEditSupplierModal, handleUpdateSupplier परिभाषित हैं।

// --- Event Listeners Setup ---
function setupEventListeners() {
    // इस फंक्शन को अब initializeSupplierDetailPage से कॉल नहीं किया जाएगा, बल्कि DOM रेडी होने पर कॉल करें
    if (listenersAttached) return;
    console.log("Setting up event listeners...");

    // Use querySelector for robustness? Or ensure IDs are correct globally.
    const addPayBtn = document.getElementById('addPaymentMadeBtn');
    const editBtn = document.getElementById('editSupplierDetailsBtn');
    const closePayModalBtn = document.getElementById('closePaymentMadeModalBtn');
    // const cancelPayBtn = document.getElementById('cancelPaymentBtn'); // <<< अभी कमेंटेड है
    const payModal = document.getElementById('paymentMadeModal');
    const payForm = document.getElementById('paymentMadeForm');
    const closeEditModalBtn = document.getElementById('closeEditSupplierBtn');
    const cancelEditBtn = document.getElementById('cancelEditSupplierBtn');
    const editModal = document.getElementById('editSupplierModal');
    const editForm = document.getElementById('editSupplierForm');


    if (addPayBtn) addPayBtn.addEventListener('click', openPaymentModal); else console.warn("Add Payment Btn not found");
    if (editBtn) editBtn.addEventListener('click', openEditSupplierModal); else console.warn("Edit Supplier Btn not found");

    // Payment Modal Listeners
    if (closePayModalBtn) closePayModalBtn.addEventListener('click', closePaymentModal); else console.warn("Close Payment Modal Btn not found");
    // if (cancelPayBtn) { cancelPayBtn.addEventListener('click', closePaymentModal); } else { console.warn("Cancel Payment Btn not found"); }
    if (payModal) payModal.addEventListener('click', (event) => { if (event.target === payModal) closePaymentModal(); }); else console.warn("Payment Modal not found");
    if (payForm) payForm.addEventListener('submit', handleSavePayment); else console.warn("Payment Form not found");

    // Edit Modal Listeners
    if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', closeEditSupplierModal); else console.warn("Close Edit Modal Btn not found");
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditSupplierModal); else console.warn("Cancel Edit Modal Btn not found");
    if (editModal) editModal.addEventListener('click', (event) => { if (event.target === editModal) closeEditSupplierModal(); }); else console.warn("Edit Modal not found");
    if (editForm) editForm.addEventListener('submit', handleEditSupplierSubmit); // <<< सही हैंडलर नाम का उपयोग करें
    else { console.warn("Edit Supplier Form not found."); }


    listenersAttached = true;
    console.log("Event listeners setup complete.");
}


// --- Global Initialization Function ---
window.initializeSupplierDetailPage = async () => {
     console.log("Initializing Supplier Detail Page (Global Function)...");
     clearError();
     await new Promise(resolve => setTimeout(resolve, 0));
     const mainContent = document.getElementById('detailMainContent');
     if (mainContent) mainContent.style.visibility = 'visible';
     if (typeof db === 'undefined' || !db) { console.error("Firestore db instance not available!"); displayError("Database connection failed."); return; }
     await loadSupplierAccountData(); // <<< डेटा लोड करें
     setupEventListeners(); // <<< डेटा लोड होने के बाद लिस्नर सेटअप करें
     console.log("Supplier Detail Page Initialized via global function.");
     window.supplierDetailPageInitialized = true;
};

// --- Auto-initialize ---
// ... (Auto-initialize कोड वैसा ही रहेगा) ...
let initializationAttempted = false;
function attemptInitialization() { /* ... */ }
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', attemptInitialization); } else { attemptInitialization(); }

console.log("supplier_account_detail.js loaded and running (Restored + Summary/PO Fix).");

// --- प्लेसहोल्डर्स/डमी फंक्शन्स (सुनिश्चित करें कि ये आपके वास्तविक लॉजिक से बदल दिए गए हैं) ---
async function handleSavePayment(event) { event.preventDefault(); console.error("handleSavePayment not defined!"); displayError("Save Failed", "paymentMadeError"); }
function openPaymentModal(){ console.error("openPaymentModal not defined!"); /* ... */ }
function closePaymentModal(){ console.error("closePaymentModal not defined!"); const modal = document.getElementById('paymentMadeModal'); if(modal) modal.style.display = 'none'; }
function openEditSupplierModal(){ console.error("openEditSupplierModal not defined!"); /* ... */ }
function closeEditSupplierModal(){ console.error("closeEditSupplierModal not defined!"); const modal = document.getElementById('editSupplierModal'); if(modal) modal.style.display = 'none'; }
async function handleEditSupplierSubmit(event){ event.preventDefault(); console.error("handleEditSupplierSubmit not defined!"); displayError("Update Failed", "editSupplierError"); }
async function updatePurchaseOrderStatus(db, poId, amount) { console.warn("updatePurchaseOrderStatus not defined"); } // यह आवश्यक है handleSavePayment के लिए