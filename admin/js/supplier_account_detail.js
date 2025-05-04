// js/supplier_account_detail.js
// संस्करण: विस्तृत लॉगिंग, कैंसल बटन डीबगिंग और समरी DOM प्राप्त करने में सुधार

// --- Firebase फ़ंक्शन सीधे आयात करें ---
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

// --- DOM रेफरेंसेस (टॉप लेवल - जहां संभव हो फंक्शन के अंदर प्राप्त करें) ---
// ये केवल तभी काम करेंगे जब स्क्रिप्ट DOM रेडी होने के बाद चले और एलिमेंट्स मौजूद हों
const addPaymentMadeBtn = document.getElementById('addPaymentMadeBtn');
const editSupplierDetailsBtn = document.getElementById('editSupplierDetailsBtn');
const paymentMadeModal = document.getElementById('paymentMadeModal');
const editSupplierModal = document.getElementById('editSupplierModal');
// बाकी रेफरेंसेस फंक्शन के अंदर प्राप्त किए जाएंगे ताकि यह सुनिश्चित हो सके कि DOM तैयार है

// --- Helper Functions ---
function displayError(message, elementId = 'generalError') {
    console.error("Displaying Error:", message);
    // प्रयास करें विशिष्ट एरर तत्व ढूंढें, फिर सामान्य पर वापस जाएं
    let errorElement = document.getElementById(elementId);
    if (!errorElement && elementId !== 'generalError') {
        errorElement = document.getElementById('generalError'); // Fallback to general error div if specific not found
    }
     if (!errorElement) { // Still not found? Try payment list error
         errorElement = document.getElementById('supplierPaymentListError');
     }

    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        errorElement.style.color = 'red'; // या आपकी CSS क्लास
    } else {
        console.warn(`Error element with ID '${elementId}' or fallback 'generalError'/'supplierPaymentListError' not found. Using alert.`);
        alert(`Error: ${message}`); // अंतिम उपाय
    }
}

function clearError(elementId = 'generalError') {
     let errorElement = document.getElementById(elementId);
     if (!errorElement && elementId !== 'generalError') {
         errorElement = document.getElementById('generalError');
     }
      if (!errorElement) {
          errorElement = document.getElementById('supplierPaymentListError');
      }
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
    // Payment/Edit modal errors को भी साफ़ करें
    const paymentErr = document.getElementById('paymentMadeError'); // Corrected ID
    const editErr = document.getElementById('editSupplierError'); // Corrected ID
    if (paymentErr) paymentErr.style.display = 'none';
    if (editErr) editErr.style.display = 'none';
}

function getSupplierIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id'); // यह सही है
}

function formatDate(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== 'function') {
         // console.warn("Invalid timestamp for formatting:", timestamp); // Log spammy हो सकता है
         return 'Invalid Date';
    }
    try {
        const date = timestamp.toDate();
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-IN', options);
    } catch (e) {
        console.error("Error formatting date:", timestamp, e);
        return 'Format Error';
    }
}

function formatCurrency(amount) {
    if (typeof amount !== 'number') {
        amount = parseFloat(amount);
    }
    if (isNaN(amount)) {
        // console.warn("Invalid amount for currency formatting:", amount);
        return '₹ N/A';
    }
    return `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// --- Core Data Loading Function ---
async function loadSupplierAccountData() {
    console.log("loadSupplierAccountData: Function started.");
    // <<< --- प्रमाणीकरण स्थिति जांच --- >>>
    console.log("loadSupplierAccountData: Checking Auth Status...");
    try {
        await new Promise((resolve, reject) => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                unsubscribe(); resolve(user);
            }, (error) => { unsubscribe(); reject(error); });
            setTimeout(() => reject(new Error("Auth state check timed out")), 7000);
        });
        console.log("Current Auth User (after check):", auth.currentUser ? auth.currentUser.uid : 'null');
        if (!auth.currentUser) {
            console.error("USER NOT LOGGED IN!"); displayError("User not authenticated."); return;
        }
    } catch (authError) {
        console.error("Error checking auth status:", authError); displayError(`Authentication check failed: ${authError.message}`); return;
    }
    // <<< --- प्रमाणीकरण स्थिति जांच समाप्त --- >>>

    currentSupplierId = getSupplierIdFromUrl();
    if (!currentSupplierId) { console.error("Supplier ID missing."); displayError("Supplier ID missing."); return; }
    if (!db) { console.error("Firestore db not available."); displayError("Database connection failed."); return; }

    console.log(`Loading account data for ID: ${currentSupplierId}`);
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    clearError();

    let supplierData = null;
    let payments = [];
    let purchaseOrders = [];
    let paymentSum = 0;
    let poSum = 0;

    try {
        // 1. सप्लायर डिटेल्स
        console.log(`[Load Step 1] Loading supplier details...`);
        const supplierRef = doc(db, "suppliers", currentSupplierId);
        const supplierSnap = await getDoc(supplierRef);
        if (supplierSnap.exists()) {
            supplierData = { id: supplierSnap.id, ...supplierSnap.data() };
            currentSupplierData = supplierData;
            console.log("[Load Step 1] Supplier Data found:", supplierData);
            populateSupplierDetails(supplierData); // <<< UI अपडेट
        } else { throw new Error("Supplier not found"); }

        // 2. सप्लायर पेमेंट्स
        console.log("[Load Step 2] Loading supplier payments...");
        const paymentsQuery = query(collection(db, "supplier_payments"), where("supplierId", "==", currentSupplierId), orderBy("paymentDate", "desc"));
        const paymentsSnapshot = await getDocs(paymentsQuery);
        console.log(`[Load Step 2] Found ${paymentsSnapshot.docs.length} payments.`);
        payments = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Load Step 2] Payments Data Array:", payments);
        paymentSum = payments.reduce((sum, p) => sum + (parseFloat(p.paymentAmount) || 0), 0);
        populatePaymentHistory(payments); // <<< UI अपडेट

        // 3. Purchase Orders
        console.log("[Load Step 3] Loading supplier POs...");
        const poQuery = query(collection(db, "purchaseOrders"), where("supplierId", "==", currentSupplierId));
        const poSnapshot = await getDocs(poQuery);
        console.log(`[Load Step 3] Found ${poSnapshot.docs.length} POs.`);
        purchaseOrders = poSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        purchaseOrdersData = purchaseOrders;
        console.log("[Load Step 3] POs Data Array:", purchaseOrders);
        poSum = purchaseOrders.reduce((sum, po) => sum + (parseFloat(po.totalAmount) || 0), 0);

        // 4. खाता सारांश
        console.log("[Load Step 4] Calculating Summary...");
        updateAccountSummary(poSum, paymentSum); // <<< UI अपडेट

        // 5. PO ड्रॉपडाउन
        console.log("[Load Step 5] Populating PO dropdown...");
        populatePoDropdown(purchaseOrders); // <<< UI अपडेट

    } catch (error) {
        console.error("Error during loadSupplierAccountData execution:", error);
        console.error("Error Details:", { name: error.name, message: error.message, code: error.code });
        if (error.code === 'permission-denied') {
             displayError("Permission denied. Check Firestore rules & login status.");
        } else if (error.message && error.message.toLowerCase().includes("index")) {
             displayError("Missing Firestore index. Check console/contact admin.");
        } else if (error.message === "Supplier not found") {
            displayError("Supplier record could not be found.");
        } else {
            displayError(`Error loading data: ${error.message}.`);
        }
        // रीसेट UI एरर पर
        populatePaymentHistory([]);
        updateAccountSummary(0, 0);
        populatePoDropdown([]);
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        console.log("loadSupplierAccountData finished.");
    }
}


// --- UI Population Functions ---
function populateSupplierDetails(data) {
    console.log("populateSupplierDetails called with data:", data ? data.id : 'null');
    // DOM एलिमेंट्स को यहीं प्राप्त करें ताकि यह सुनिश्चित हो सके कि वे मौजूद हैं
    const header = document.getElementById('supplierNameHeader');
    const breadcrumb = document.getElementById('supplierNameBreadcrumb');
    const idEl = document.getElementById('detailSupplierId');
    const nameEl = document.getElementById('detailSupplierName');
    const companyEl = document.getElementById('detailSupplierCompany');
    const whatsappEl = document.getElementById('detailSupplierWhatsapp');
    const emailEl = document.getElementById('detailSupplierEmail');
    const gstEl = document.getElementById('detailSupplierGst');
    const addressEl = document.getElementById('detailSupplierAddress');
    const addedOnEl = document.getElementById('detailAddedOn'); // <<<< Added On ID को यहां प्राप्त करें

    if (!data) { // डेटा न होने पर हैंडल करें
        if (header) header.textContent = 'Error Loading';
        if (breadcrumb) breadcrumb.textContent = 'Error';
        if (idEl) idEl.textContent = 'N/A';
        // ... बाकी फ़ील्ड्स भी ...
        return;
    }

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
    const tableBody = document.getElementById('transactionsTableBody'); // <<< फंक्शन के अंदर प्राप्त करें
    const loadingRow = document.getElementById('transactionsLoading');
    const noDataRow = document.getElementById('noTransactionsMessage');

    console.log("Payment Table Elements:", { tableBody, loadingRow, noDataRow }); // <<< जांचें

    if (!tableBody) { console.error("Payment table body element not found!"); return; }
    tableBody.innerHTML = ''; // साफ करें

    if (loadingRow) loadingRow.style.display = 'none'; // लोडिंग छिपाएं

    if (!payments || payments.length === 0) {
        console.log("No payments found, displaying 'no data' row.");
        if (noDataRow) {
            noDataRow.style.display = 'table-row';
        } else { tableBody.innerHTML = '<tr><td colspan="6">No payment history found.</td></tr>'; }
        if (supplierPaymentListError) supplierPaymentListError.style.display = 'none';
        return;
    }

    if (noDataRow) noDataRow.style.display = 'none';
    if (supplierPaymentListError) supplierPaymentListError.style.display = 'none';

    console.log("Adding payment rows...");
    payments.forEach((payment, index) => {
        // ... (पिछला row insertion code वैसा ही) ...
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
        } catch(e) {
             console.error(`Error creating payment row ${index}:`, payment, e);
             // Error row जोड़ें
             const errorRow = tableBody.insertRow();
             errorRow.innerHTML = `<td colspan="6" style="color:red;">Error displaying this payment.</td>`;
        }
    });
    console.log("Finished adding payment rows.");
}

function updateAccountSummary(poTotal, paymentTotal) {
    console.log(`updateAccountSummary called with poTotal=${poTotal}, paymentTotal=${paymentTotal}`);

    // <<< --- एलिमेंट्स को फंक्शन के अंदर प्राप्त करें --- >>>
    const poDisplay = document.getElementById('summaryTotalPoValue');
    const paidDisplay = document.getElementById('summaryTotalPaid');
    const balanceDisplay = document.getElementById('summaryBalance');
    // <<< --- एलिमेंट्स को फंक्शन के अंदर प्राप्त करें --- >>>

    console.log("Attempting to update summary. Elements found:", { poDisplay, paidDisplay, balanceDisplay }); // <<< अब यहां जांचें

    let outstanding = NaN; // Default

    // सुनिश्चित करें कि मान संख्याएँ हैं
    const numPoTotal = parseFloat(poTotal) || 0;
    const numPaymentTotal = parseFloat(paymentTotal) || 0;
    outstanding = numPoTotal - numPaymentTotal;
    console.log(`Calculated outstanding: ${numPoTotal} - ${numPaymentTotal} = ${outstanding}`);

    if (poDisplay) {
         console.log("Updating PO display...");
         poDisplay.textContent = formatCurrency(numPoTotal);
         poDisplay.classList.remove('loading-state');
         console.log("PO display updated.");
     } else { console.warn("Element 'summaryTotalPoValue' not found."); }

    if (paidDisplay) {
        console.log("Updating Paid display...");
        paidDisplay.textContent = formatCurrency(numPaymentTotal);
        paidDisplay.classList.remove('loading-state');
        console.log("Paid display updated.");
    } else { console.warn("Element 'summaryTotalPaid' not found."); }

    if (balanceDisplay) {
        console.log("Updating Balance display...");
        balanceDisplay.textContent = formatCurrency(outstanding);
        balanceDisplay.classList.remove('loading-state');
        balanceDisplay.classList.remove('balance-due', 'balance-credit', 'balance-zero', 'balance-info');
        if (outstanding > 0.01) {
            balanceDisplay.classList.add('balance-due');
        } else if (outstanding < -0.01) {
             balanceDisplay.classList.add('balance-credit');
        } else {
            balanceDisplay.classList.add('balance-zero');
        }
        console.log("Balance display updated.");
    } else { console.warn("Element 'summaryBalance' not found."); }
    console.log("Account summary UI update finished.");
}


function populatePoDropdown(pos) {
     console.log(`Populating PO dropdown with ${pos ? pos.length : 0} total POs...`);
     const dropdown = document.getElementById('paymentLinkPOSelect'); // <<< फंक्शन के अंदर प्राप्त करें
     if (!dropdown) { console.error("PO Link dropdown element not found!"); return; }
     // ... (बाकी ड्रॉपडाउन लॉजिक वैसा ही) ...
      dropdown.innerHTML = '<option value="">None (Direct Payment)</option>';

     if (!pos || pos.length === 0) {
         dropdown.innerHTML += '<option value="" disabled>No POs found</option>';
         return;
     }
     const relevantPOs = pos.filter(po => (parseFloat(po.totalAmount) || 0) > (parseFloat(po.amountPaid) || 0));
     console.log(`Found ${relevantPOs.length} relevant POs for dropdown.`);

     if (relevantPOs.length === 0) {
          dropdown.innerHTML += '<option value="" disabled>No open POs found</option>';
          return;
     }
     relevantPOs.sort((a, b) => (b.orderDate?.toDate?.() || 0) - (a.orderDate?.toDate?.() || 0));
     relevantPOs.forEach(po => {
         const option = document.createElement('option');
         option.value = po.id;
         const total = parseFloat(po.totalAmount) || 0;
         const paid = parseFloat(po.amountPaid) || 0;
         const amountDue = total - paid;
         option.textContent = `${po.poNumber || po.id.substring(0,6)} (${formatDate(po.orderDate)}) - Due: ${formatCurrency(amountDue)}`;
         option.dataset.poNumber = po.poNumber || '';
         dropdown.appendChild(option);
     });
     console.log("PO dropdown populated.");
}

// --- Event Handlers & Modal Functions ---
function openPaymentModal() {
    console.log("openPaymentModal called");
    const modal = document.getElementById('paymentMadeModal'); // <<< अंदर प्राप्त करें
    const form = document.getElementById('paymentMadeForm');
    const errorDiv = document.getElementById('paymentMadeError'); // <<< अंदर प्राप्त करें
    const dateInput = document.getElementById('paymentDate');
    const titleSpan = document.getElementById('paymentSupplierName');

    if (!modal) { console.error("Payment modal element not found"); return; }

    if (!currentSupplierData) { displayError("Supplier data missing.", errorDiv ? errorDiv.id : 'generalError'); return; }

    clearError(errorDiv ? errorDiv.id : 'generalError');
    if (form) form.reset();
    if (titleSpan) titleSpan.textContent = currentSupplierData.name || 'Supplier';
    if (dateInput) { /* आज की तारीख सेट करें */ try { const today=new Date(); const y=today.getFullYear(); const m=(today.getMonth()+1).toString().padStart(2,'0'); const d=today.getDate().toString().padStart(2,'0'); dateInput.value=`${y}-${m}-${d}`; } catch(e){} }

    console.log("Repopulating PO dropdown within openPaymentModal...");
    populatePoDropdown(purchaseOrdersData); // Use globally stored PO data

    modal.style.display = 'flex';
    modal.classList.add('active');
}

function closePaymentModal() {
    console.log('closePaymentModal called!'); // <<< Log जोड़ा गया
    const modal = document.getElementById('paymentMadeModal');
    const errorDiv = document.getElementById('paymentMadeError'); // <<< सही ID
     if (!modal) { console.error("Payment modal element not found for closing"); return; }
    modal.style.display = 'none';
    modal.classList.remove('active');
    clearError(errorDiv ? errorDiv.id : 'generalError'); // एरर साफ करें
}

// ... (handleSavePayment वैसा ही रहेगा, यह सुनिश्चित करें कि वह सही IDs का उपयोग करे) ...
async function handleSavePayment(event) {
    event.preventDefault();
    const errorDiv = document.getElementById('paymentMadeError'); // <<< सही ID
    clearError(errorDiv ? errorDiv.id : 'generalError');

    if (!currentSupplierId || !currentSupplierData) { displayError("Supplier info missing.", errorDiv ? errorDiv.id : 'generalError'); return; }

    const amountInput = document.getElementById('paymentAmount');
    const dateInput = document.getElementById('paymentDate');
    const methodInput = document.getElementById('paymentMethod');
    const notesInput = document.getElementById('paymentNotes');
    const poSelect = document.getElementById('paymentLinkPOSelect'); // <<< सही ID

    const paymentData = { /* ... (डेटा पहले जैसा) ... */ };
    // ... (validation) ...
    // ... (try/catch block वैसा ही) ...
}


// ... (Edit Supplier Modal Functions वैसे ही रहेंगे, सुनिश्चित करें कि वे सही IDs का उपयोग करें) ...


// --- Event Listeners Setup ---
function setupEventListeners() {
    console.log("Setting up event listeners...");

    // Payment Modal
    if (addPaymentMadeBtn) addPaymentMadeBtn.addEventListener('click', openPaymentModal);
    const closeBtnPay = document.getElementById('closePaymentMadeModalBtn'); // <<< पेमेंट मोड में ID चेक करें
    if (closeBtnPay) closeBtnPay.addEventListener('click', closePaymentModal);
    const cancelBtnPay = document.getElementById('cancelPaymentBtn'); // <<< यह वह बटन है जो काम नहीं कर रहा
    if (cancelBtnPay) {
         console.log("Found Cancel button (payment modal). Attaching listener..."); // <<< Log जोड़ा गया
         cancelBtnPay.addEventListener('click', closePaymentModal);
    } else { console.warn("Could not find Cancel button for payment modal (ID: cancelPaymentBtn)"); }
    if (paymentMadeModal) paymentMadeModal.addEventListener('click', (event) => { if (event.target === paymentMadeModal) closePaymentModal(); });
    if (paymentMadeForm) paymentMadeForm.addEventListener('submit', handleSavePayment);

    // Edit Modal
    if (editSupplierDetailsBtn) editSupplierDetailsBtn.addEventListener('click', openEditSupplierModal);
    const closeBtnEdit = document.getElementById('closeEditSupplierBtn');
    if (closeBtnEdit) closeBtnEdit.addEventListener('click', closeEditSupplierModal);
    const cancelBtnEdit = document.getElementById('cancelEditSupplierBtn');
    if (cancelBtnEdit) cancelBtnEdit.addEventListener('click', closeEditSupplierModal);
    if (editSupplierModal) editSupplierModal.addEventListener('click', (event) => { if (event.target === editSupplierModal) closeEditSupplierModal(); });
    // const editForm = document.getElementById('editSupplierForm'); // जरूरत पड़ने पर प्राप्त करें
    // if (editForm) editForm.addEventListener('submit', handleEditSupplierSubmit); // Use correct handler name

    console.log("Supplier detail event listeners setup complete.");
}


// --- Global Initialization & Auto-run ---
// ... (यह कोड ब्लॉक वैसा ही रहेगा) ...
window.initializeSupplierDetailPage = async () => { /* ... */ };
let initializationAttempted = false;
function attemptInitialization() { /* ... */ }
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', attemptInitialization); } else { attemptInitialization(); }

console.log("supplier_account_detail.js loaded and running (v_debug_1).");

// Add dummy handleEditSupplierSubmit if it doesn't exist to prevent errors
if (typeof handleEditSupplierSubmit === 'undefined') {
    window.handleEditSupplierSubmit = function(event) {
        event.preventDefault();
        console.warn("handleEditSupplierSubmit function not fully defined/found.");
        alert("Update functionality not implemented yet.");
    }
}
if (typeof openEditSupplierModal === 'undefined') {
     window.openEditSupplierModal = function() { console.warn("openEditSupplierModal not defined/found."); alert("Cannot open edit modal."); }
}
if (typeof closeEditSupplierModal === 'undefined') {
     window.closeEditSupplierModal = function() { console.warn("closeEditSupplierModal not defined/found."); alert("Cannot close edit modal."); }
}