// js/supplier_account_detail.js
// संस्करण: अकाउंट समरी फिक्स, PO हिस्ट्री टेबल जोड़ा गया, कैंसल बटन लिस्नर हटाया गया

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
function displayError(message, elementId = 'generalErrorDisplay') { // Use generalErrorDisplay from HTML
    console.error("Displaying Error:", message);
    try {
        let errorElement = document.getElementById(elementId) || document.getElementById('supplierPaymentListError') || document.getElementById('supplierPoListError') || document.getElementById('generalErrorDisplay');
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
        let errorElement = document.getElementById(elementId) || document.getElementById('supplierPaymentListError') || document.getElementById('supplierPoListError') || document.getElementById('generalErrorDisplay');
        if (errorElement) { errorElement.textContent = ''; errorElement.style.display = 'none'; }
        const paymentErr = document.getElementById('paymentMadeError');
        const editErr = document.getElementById('editSupplierError');
        if (paymentErr) paymentErr.style.display = 'none';
        if (editErr) editErr.style.display = 'none';
    } catch(e) { console.error("Error within clearError:", e); }
}

function getSupplierIdFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    } catch (e) { console.error("Error getting supplier ID from URL:", e); return null; }
}

function formatDate(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== 'function') { return 'Invalid Date'; }
    try {
        const date = timestamp.toDate();
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-IN', options);
    } catch (e) { console.error("Error formatting date:", timestamp, e); return 'Format Error'; }
}

function formatCurrency(amount) {
    if (typeof amount !== 'number') { amount = parseFloat(amount); }
    if (isNaN(amount)) { return '₹ N/A'; }
    return `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Status के लिए क्लास जेनरेट करने का फंक्शन
function getStatusClass(status) {
    if (!status) return 'status-unknown';
    return 'status-' + status.toLowerCase().replace(/\s+/g, '-');
}
function getPaymentStatusClass(status) {
     if (!status) return 'payment-status-pending'; // डिफ़ॉल्ट पेंडिंग मानें
     return 'payment-status-' + status.toLowerCase().replace(/\s+/g, '-');
}


// --- UI Population Functions ---
function populateSupplierDetails(data) {
    console.log("populateSupplierDetails called");
    const header = document.getElementById('supplierNameHeader');
    const breadcrumb = document.getElementById('supplierNameBreadcrumb');
    const idEl = document.getElementById('detailSupplierId');
    const nameEl = document.getElementById('detailSupplierName');
    const companyEl = document.getElementById('detailSupplierCompany');
    const whatsappEl = document.getElementById('detailSupplierWhatsapp');
    const emailEl = document.getElementById('detailSupplierEmail');
    const gstEl = document.getElementById('detailSupplierGst');
    const addressEl = document.getElementById('detailSupplierAddress');
    const addedOnEl = document.getElementById('detailAddedOn'); // <<< यह अब HTML में मौजूद होना चाहिए

    if (!data) { if(header) header.textContent = 'Error'; /*...*/ return; }

    if (header) header.textContent = data.name || 'Supplier Account';
    if (breadcrumb) breadcrumb.textContent = data.name || 'Details';
    if (idEl) idEl.textContent = data.id || 'N/A';
    if (nameEl) nameEl.textContent = data.name || 'N/A';
    if (companyEl) companyEl.textContent = data.company || 'N/A';
    if (whatsappEl) whatsappEl.textContent = data.contact || 'N/A';
    if (emailEl) emailEl.textContent = data.email || 'N/A';
    if (gstEl) gstEl.textContent = data.gstNo || 'N/A';
    if (addressEl) addressEl.textContent = data.address || 'N/A';
    if (addedOnEl) addedOnEl.textContent = data.addedOn ? formatDate(data.addedOn) : 'N/A'; // <<< अब यह चलेगा
}

function populatePaymentHistory(payments) {
    console.log(`Populating payment history with ${payments ? payments.length : 0} items...`);
    const tableBody = document.getElementById('transactionsTableBody');
    const loadingRow = document.getElementById('transactionsLoading');
    const noDataRow = document.getElementById('noTransactionsMessage');
    const errorDisplay = document.getElementById('supplierPaymentListError');

    if (!tableBody) { console.error("Payment table body not found!"); return; }
    tableBody.innerHTML = '';
    if (loadingRow) loadingRow.style.display = 'none';
    if (errorDisplay) errorDisplay.style.display = 'none';

    if (!payments || payments.length === 0) {
        if (noDataRow) noDataRow.style.display = 'table-row';
        else tableBody.innerHTML = '<tr><td colspan="6">No payment history found.</td></tr>';
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
        } catch(e) { console.error(`Error creating payment row ${index}:`, payment, e); /*...*/ }
    });
    console.log("Finished adding payment rows.");
}

// === PO History टेबल को पॉप्युलेट करने का नया फंक्शन ===
function populatePoHistoryTable(pos) {
    console.log(`Populating PO history with ${pos ? pos.length : 0} items...`);
    const tableBody = document.getElementById('supplierPoTableBody');
    const loadingRow = document.getElementById('supplierPoLoading');
    const noDataRow = document.getElementById('noSupplierPoMessage');
    const errorDisplay = document.getElementById('supplierPoListError');

    if (!tableBody) { console.error("PO table body not found!"); return; }
    tableBody.innerHTML = ''; // पुरानी रो हटाएं

    if (loadingRow) loadingRow.style.display = 'none';
    if (errorDisplay) errorDisplay.style.display = 'none';

    if (!pos || pos.length === 0) {
        if (noDataRow) {
            noDataRow.style.display = 'table-row'; // 'No POs found' दिखाएं
        } else {
            tableBody.innerHTML = '<tr><td colspan="6">No purchase orders found.</td></tr>'; // फॉलबैक
        }
        return;
    }

    if (noDataRow) noDataRow.style.display = 'none'; // 'No POs' छिपाएं

    // POs को तारीख के अनुसार सॉर्ट करें (नवीनतम पहले)
    pos.sort((a, b) => (b.orderDate?.toDate?.() || 0) - (a.orderDate?.toDate?.() || 0));

    pos.forEach((po, index) => {
        try {
            const row = tableBody.insertRow();
            row.insertCell(0).textContent = po.poNumber || `PO-${po.id.substring(0, 6)}`;
            row.insertCell(1).textContent = formatDate(po.orderDate);
            const amountCell = row.insertCell(2);
            amountCell.textContent = formatCurrency(po.totalAmount);
            amountCell.classList.add('amount-po');
            // Status Badge
            const statusCell = row.insertCell(3);
            const statusSpan = document.createElement('span');
            statusSpan.className = `status-badge ${getStatusClass(po.status)}`;
            statusSpan.textContent = po.status || 'Unknown';
            statusCell.appendChild(statusSpan);
            // Payment Status Badge
            const paymentStatusCell = row.insertCell(4);
            const paymentStatusSpan = document.createElement('span');
            paymentStatusSpan.className = `status-badge ${getPaymentStatusClass(po.paymentStatus)}`; // Payment status के लिए अलग क्लास
            paymentStatusSpan.textContent = po.paymentStatus || 'Pending';
            paymentStatusCell.appendChild(paymentStatusSpan);
             // Actions Cell (उदाहरण)
             const actionCell = row.insertCell(5);
             // actionCell.innerHTML = `<a href="edit_po.html?id=${po.id}" class="button small-button info-button">Edit</a>`;

        } catch (e) {
            console.error(`Error creating PO row ${index}:`, po, e);
            const errorRow = tableBody.insertRow();
            errorRow.innerHTML = `<td colspan="6" style="color:red;">Error displaying this PO.</td>`;
        }
    });
    console.log("Finished adding PO rows.");
}
// === PO History फंक्शन समाप्त ===


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
     const dropdown = document.getElementById('paymentLinkPOSelect');
     if (!dropdown) { console.error("PO Link dropdown element not found!"); return; }
     dropdown.innerHTML = '<option value="">None (Direct Payment)</option>';
     if (!pos || pos.length === 0) { /* ... */ return; }
     const relevantPOs = pos.filter(po => (parseFloat(po.totalAmount) || 0) > (parseFloat(po.amountPaid) || 0));
     if (relevantPOs.length === 0) { /* ... */ return; }
     relevantPOs.sort((a, b) => (b.orderDate?.toDate?.() || 0) - (a.orderDate?.toDate?.() || 0));
     relevantPOs.forEach(po => {
        const option = document.createElement('option');
        option.value = po.id;
        const total = parseFloat(po.totalAmount) || 0;
        const paid = parseFloat(po.amountPaid) || 0;
        const amountDue = total - paid;
        option.textContent = `${po.poNumber || po.id.substring(0,6)} (${formatDate(po.orderDate)}) - Due: ${formatCurrency(amountDue)}`;
        option.dataset.poNumber = po.poNumber || ''; // Store PO number in dataset
        dropdown.appendChild(option);
      });
     console.log("PO dropdown populated.");
}

// --- Core Data Loading ---
async function loadSupplierAccountData() {
    console.log("loadSupplierAccountData: Function started.");
    // ... (Auth check) ...
    if (!auth.currentUser) { return; }

    currentSupplierId = getSupplierIdFromUrl();
    if (!currentSupplierId) { return; }
    if (!db) { return; }

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
        console.log("[Load Step 1] Supplier Data found.");
        populateSupplierDetails(supplierData); // <<< UI अपडेट

        // <<< --- Event Listeners को यहां कॉल करें --- >>>
        setupEventListeners(); // <<< लिस्नर सेटअप अब यहाँ है

        // Step 2 & 3: Load Payments and POs Concurrently
        console.log("[Load Steps 2 & 3] Loading payments and POs concurrently...");
        const [paymentsSnapshot, poSnapshot] = await Promise.all([
             getDocs(query(collection(db, "supplier_payments"), where("supplierId", "==", currentSupplierId), orderBy("paymentDate", "desc"))),
             getDocs(query(collection(db, "purchaseOrders"), where("supplierId", "==", currentSupplierId))) // <<< POs के लिए क्वेरी
        ]);

        // Process Payments
        console.log(`[Load Step 2] Found ${paymentsSnapshot.docs.length} payments.`);
        payments = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        paymentSum = payments.reduce((sum, p) => sum + (parseFloat(p.paymentAmount) || 0), 0);
        populatePaymentHistory(payments); // <<< UI अपडेट

        // Process POs
        console.log(`[Load Step 3] Found ${poSnapshot.docs.length} POs.`);
        purchaseOrders = poSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        purchaseOrdersData = purchaseOrders; // ग्लोबल वेरिएबल अपडेट करें
        poSum = purchaseOrders.reduce((sum, po) => sum + (parseFloat(po.totalAmount) || 0), 0);
        populatePoHistoryTable(purchaseOrders); // <<< UI अपडेट (PO टेबल के लिए नया कॉल)

        // Step 4: Update Summary
        console.log("[Load Step 4] Calculating & Updating Summary...");
        updateAccountSummary(poSum, paymentSum); // <<< UI अपडेट

        // Step 5: Populate Dropdown
        console.log("[Load Step 5] Populating PO dropdown...");
        populatePoDropdown(purchaseOrders); // <<< UI अपडेट

    } catch (error) {
        console.error("Error during loadSupplierAccountData execution:", error);
        displayError(`Error loading data: ${error.message}. Check console.`);
        if (!supplierData) populateSupplierDetails(null);
        populatePaymentHistory([]);
        populatePoHistoryTable([]); // <<< एरर पर PO टेबल भी खाली करें
        updateAccountSummary(0, 0);
        populatePoDropdown([]);
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        console.log("loadSupplierAccountData finished.");
    }
}


// --- Event Handlers & Modal Functions ---
// ... (openPaymentModal, closePaymentModal, handleSavePayment पहले जैसे) ...
// ... (openEditSupplierModal, closeEditSupplierModal, handleEditSupplierSubmit पहले जैसे) ...
// सुनिश्चित करें कि ये फंक्शन्स परिभाषित हैं:
async function handleSavePayment(event) { /* ... आपका सेव पेमेंट लॉजिक ... */ }
function openPaymentModal() { /* ... आपका ओपन पेमेंट मोडाल लॉजिक ... */ }
// function closePaymentModal() { /* ... आपका क्लोज पेमेंट मोडाल लॉजिक ... */ } // कैंसल बटन के लिए हटाया गया
function openEditSupplierModal() { /* ... आपका ओपन एडिट मोडाल लॉजिक ... */ }
function closeEditSupplierModal() { /* ... आपका क्लोज एडिट मोडाल लॉजिक ... */ }
async function handleEditSupplierSubmit(event) { /* ... आपका अपडेट सप्लायर लॉजिक ... */ }


// --- Event Listeners Setup ---
function setupEventListeners() {
    if (listenersAttached) return;
    console.log("Setting up event listeners...");

    // Payment Modal Buttons & Form
    const addPayBtn = document.getElementById('addPaymentMadeBtn');
    if (addPayBtn) addPayBtn.addEventListener('click', openPaymentModal); else console.warn("Element 'addPaymentMadeBtn' not found.");
    const closeBtnPay = document.getElementById('closePaymentMadeModalBtn');
    if (closeBtnPay) closeBtnPay.addEventListener('click', closePaymentModal); else console.warn("Element 'closePaymentMadeModalBtn' not found.");
    // const cancelBtnPay = document.getElementById('cancelPaymentBtn'); // <<< कैंसल बटन लिस्नर हटाया गया
    // if (cancelBtnPay) { cancelBtnPay.addEventListener('click', closePaymentModal); } else { console.warn("Element 'cancelPaymentBtn' not found."); }
    const payModal = document.getElementById('paymentMadeModal');
    if (payModal) payModal.addEventListener('click', (event) => { if (event.target === payModal) closePaymentModal(); }); else console.warn("Element 'paymentMadeModal' not found.");
    const payForm = document.getElementById('paymentMadeForm');
    if (payForm) payForm.addEventListener('submit', handleSavePayment); else console.warn("Element 'paymentMadeForm' not found.");

    // Edit Supplier Modal Buttons & Form
    const editBtn = document.getElementById('editSupplierDetailsBtn');
    if (editBtn) editBtn.addEventListener('click', openEditSupplierModal); else console.warn("Element 'editSupplierDetailsBtn' not found.");
    const closeBtnEdit = document.getElementById('closeEditSupplierBtn');
    if (closeBtnEdit) closeBtnEdit.addEventListener('click', closeEditSupplierModal); else console.warn("Element 'closeEditSupplierBtn' not found.");
    const cancelBtnEdit = document.getElementById('cancelEditSupplierBtn');
    if (cancelBtnEdit) cancelBtnEdit.addEventListener('click', closeEditSupplierModal); else console.warn("Element 'cancelEditSupplierBtn' not found.");
    const editModal = document.getElementById('editSupplierModal');
    if (editModal) editModal.addEventListener('click', (event) => { if (event.target === editModal) closeEditSupplierModal(); }); else console.warn("Element 'editSupplierModal' not found.");
    const editForm = document.getElementById('editSupplierForm');
    if (editForm) editForm.addEventListener('submit', handleEditSupplierSubmit); else console.warn("Element 'editSupplierForm' not found.");


    listenersAttached = true;
    console.log("Supplier detail event listeners setup complete.");
}


// --- Global Initialization Function ---
// ... (initializeSupplierDetailPage वैसा ही रहेगा, यह loadSupplierAccountData को कॉल करेगा) ...
window.initializeSupplierDetailPage = async () => {
     console.log("Initializing Supplier Detail Page (Global Function)...");
     clearError();
     await new Promise(resolve => setTimeout(resolve, 0));
     const mainContent = document.getElementById('detailMainContent');
     if (mainContent) mainContent.style.visibility = 'visible';
     if (typeof db === 'undefined' || !db) { console.error("Firestore db instance not available!"); displayError("Database connection failed."); return; }
     await loadSupplierAccountData();
     console.log("Supplier Detail Page Initialized via global function.");
     window.supplierDetailPageInitialized = true;
};

// --- Auto-initialize ---
// ... (Auto-initialize कोड वैसा ही रहेगा) ...
let initializationAttempted = false;
function attemptInitialization() {
     if (!initializationAttempted && (document.readyState === 'interactive' || document.readyState === 'complete')) {
         console.log(`DOM ready state is: ${document.readyState}. Initializing page...`);
         initializationAttempted = true;
         if (!window.supplierDetailPageInitialized) { window.initializeSupplierDetailPage(); }
         else { console.log("Page already initialized."); }
     }
}
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', attemptInitialization); }
else { attemptInitialization(); }

console.log("supplier_account_detail.js loaded and running (v_po_table_added).");