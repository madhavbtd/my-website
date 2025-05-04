// js/supplier_account_detail.js
// संस्करण: विस्तृत लॉगिंग शामिल है

// --- Firebase फ़ंक्शन सीधे आयात करें ---
import { db, auth } from './firebase-init.js'; // <<< auth को यहां आयात करना सुनिश्चित करें
import {
    doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp,
    addDoc, serverTimestamp, updateDoc, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"; // <<< Auth स्थिति परिवर्तन सुनने के लिए

// --- ग्लोबल वेरिएबल्स ---
let currentSupplierId = null;
let currentSupplierData = null; // सप्लायर का पूरा डेटा स्टोर करने के लिए
let purchaseOrdersData = []; // लोड किए गए POs को स्टोर करने के लिए

// --- DOM रेफरेंसेस ---
// (IDs आपकी supplier_account_detail.html फ़ाइल से मेल खानी चाहिए)
// <<< --- सुनिश्चित करें कि ये सभी IDs आपके HTML में मौजूद हैं --- >>>
const supplierNameHeader = document.getElementById('supplierNameHeader');
const supplierNameBreadcrumb = document.getElementById('supplierNameBreadcrumb'); // अगर ब्रेडक्रम्ब है
const addPaymentMadeBtn = document.getElementById('addPaymentMadeBtn');
const editSupplierDetailsBtn = document.getElementById('editSupplierDetailsBtn');

// Supplier Details Display Elements
const detailSupplierId = document.getElementById('detailSupplierId');
const detailSupplierName = document.getElementById('detailSupplierName');
const detailSupplierCompany = document.getElementById('detailSupplierCompany');
const detailSupplierWhatsapp = document.getElementById('detailSupplierWhatsapp');
const detailSupplierEmail = document.getElementById('detailSupplierEmail');
const detailSupplierGst = document.getElementById('detailSupplierGst');
const detailSupplierAddress = document.getElementById('detailSupplierAddress');
const detailAddedOn = document.getElementById('detailAddedOn');

// Account Summary Display Elements
const totalPoValueDisplay = document.getElementById('totalPoValue'); // <<< HTML में ID चेक करें
const totalPaymentsMadeDisplay = document.getElementById('totalPaymentsMade'); // <<< HTML में ID चेक करें
const outstandingBalanceDisplay = document.getElementById('outstandingBalance'); // <<< HTML में ID चेक करें

// Payment Modal Elements
const paymentMadeModal = document.getElementById('paymentMadeModal');
const paymentMadeForm = document.getElementById('paymentMadeForm');
const paymentDateInput = document.getElementById('paymentDate');
const paymentAmountInput = document.getElementById('paymentAmount');
const paymentMethodInput = document.getElementById('paymentMethod');
const paymentNotesInput = document.getElementById('paymentNotes');
const poLinkDropdown = document.getElementById('paymentLinkPOSelect'); // <<< ID बदली गई थी, सुनिश्चित करें HTML में 'paymentLinkPOSelect' है
const closePaymentModalBtn = document.getElementById('closePaymentMadeModalBtn'); // <<< ID सुनिश्चित करें
const paymentErrorDiv = document.getElementById('paymentMadeError'); // <<< ID सुनिश्चित करें
const paymentSupplierName = document.getElementById('paymentSupplierName'); // <<< ID सुनिश्चित करें

// Transaction History Elements
const supplierPaymentList = document.getElementById('transactionsTableBody'); // <<< ID ठीक की गई थी
const transactionsLoadingRow = document.getElementById('transactionsLoading'); // <<< ID ठीक की गई थी
const noTransactionsMessageRow = document.getElementById('noTransactionsMessage'); // <<< ID ठीक की गई थी
const supplierPaymentListError = document.getElementById('supplierPaymentListError');

// Edit Supplier Modal Elements
// ... (Edit modal के IDs वैसे ही रहेंगे, सुनिश्चित करें वे HTML में हैं) ...
const editSupplierModal = document.getElementById('editSupplierModal');
const editSupplierForm = document.getElementById('editSupplierForm');
const editSupplierNameInput = document.getElementById('editSupplierNameInput');
// ... (बाकी एडिट मोड के एलिमेंट्स) ...
const updateSupplierBtn = document.getElementById('updateSupplierBtn');
const cancelEditSupplierBtn = document.getElementById('cancelEditSupplierBtn');
const editSupplierErrorDiv = document.getElementById('editSupplierError'); // <<< ID सुनिश्चित करें
const editingSupplierIdInput = document.getElementById('editingSupplierId');


// Loading Indicator
const loadingIndicator = document.getElementById('loadingIndicator'); // <<< अगर लोडिंग इंडिकेटर है

// --- Helper Functions ---
// ... (Helper Functions जैसे displayError, clearError, getSupplierIdFromUrl, formatDate, formatCurrency वैसे ही रहेंगे) ...
function displayError(message, elementId = 'generalError') { // Error display ID अपडेट करें अगर HTML में अलग है
    console.error("Displaying Error:", message);
    const errorElement = document.getElementById(elementId) || document.getElementById('supplierPaymentListError'); // Fallback
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        errorElement.style.color = 'red'; // बेहतर स्टाइल
    } else {
        alert(`Error: ${message}`);
    }
}

function clearError(elementId = 'generalError') {
    const errorElement = document.getElementById(elementId) || document.getElementById('supplierPaymentListError');
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
    if (supplierPaymentListError) supplierPaymentListError.style.display = 'none';
    if (paymentErrorDiv) paymentErrorDiv.style.display = 'none';
    if (editSupplierErrorDiv) editSupplierErrorDiv.style.display = 'none';
}

function getSupplierIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id'); // यह सही है
}

function formatDate(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== 'function') {
         console.warn("Invalid timestamp for formatting:", timestamp);
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
        console.warn("Invalid amount for currency formatting:", amount);
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
        // यह सुनिश्चित करने के लिए कि auth तैयार है, प्रतीक्षा करें
        await new Promise((resolve, reject) => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                unsubscribe(); resolve(user);
            }, (error) => { unsubscribe(); reject(error); });
            setTimeout(() => reject(new Error("Auth state check timed out")), 7000); // थोड़ा लंबा टाइमआउट
        });
        console.log("Current Auth User (after check):", auth.currentUser ? auth.currentUser.uid : 'null');
        if (!auth.currentUser) {
            console.error("USER NOT LOGGED IN!");
            displayError("User not authenticated. Please log in.");
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            return;
        }
    } catch (authError) {
        console.error("Error checking auth status:", authError);
        displayError(`Authentication check failed: ${authError.message}`);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        return;
    }
    // <<< --- प्रमाणीकरण स्थिति जांच समाप्त --- >>>

    currentSupplierId = getSupplierIdFromUrl(); // ID दोबारा प्राप्त करें (सुरक्षा के लिए)
    if (!currentSupplierId) {
         console.error("Supplier ID is missing when loadSupplierAccountData is called.");
         displayError("Supplier ID missing.");
         if (loadingIndicator) loadingIndicator.style.display = 'none';
         return;
    }
    if (!db) { // db सीधे इस्तेमाल करें
         console.error("Firestore db instance is not available!");
         displayError("Database connection failed.");
          if (loadingIndicator) loadingIndicator.style.display = 'none';
         return;
    }

    console.log(`Loading account data for ID: ${currentSupplierId}`);
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    clearError();

    let supplierData = null;
    let payments = [];
    let purchaseOrders = [];
    let paymentSum = 0;
    let poSum = 0;

    try {
        // 1. सप्लायर डिटेल्स लोड करें
        console.log(`[Load Step 1] Attempting to load supplier details for ID: ${currentSupplierId}`);
        const supplierRef = doc(db, "suppliers", currentSupplierId);
        const supplierSnap = await getDoc(supplierRef);

        if (supplierSnap.exists()) {
            supplierData = { id: supplierSnap.id, ...supplierSnap.data() };
            currentSupplierData = supplierData;
            console.log("[Load Step 1] Supplier Data found:", supplierData);
            populateSupplierDetails(supplierData); // <<< UI अपडेट करें
        } else {
            console.error("[Load Step 1] Supplier not found with ID:", currentSupplierId);
            displayError("Supplier not found.");
             if (loadingIndicator) loadingIndicator.style.display = 'none';
            return;
        }

        // 2. सप्लायर पेमेंट्स लोड करें
        console.log("[Load Step 2] Attempting to load supplier payments...");
        const paymentsQuery = query(
            collection(db, "supplier_payments"), // <<< सही कलेक्शन
            where("supplierId", "==", currentSupplierId),
            orderBy("paymentDate", "desc")
        );
        const paymentsSnapshot = await getDocs(paymentsQuery);
        console.log(`[Load Step 2] Successfully queried supplier payments. Found ${paymentsSnapshot.docs.length} documents.`); // <<< देखें कि कितने मिले

        payments = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Load Step 2] Payments Data Array:", payments); // <<< वास्तविक डेटा देखें
        paymentSum = payments.reduce((sum, payment) => sum + (parseFloat(payment.paymentAmount) || 0), 0);
        populatePaymentHistory(payments); // <<< UI अपडेट करें

        // 3. सप्लायर Purchase Orders (POs) लोड करें
        console.log("[Load Step 3] Attempting to load supplier POs...");
        const poQuery = query(
            collection(db, "purchaseOrders"), // <<< सही कलेक्शन 'purchaseOrders'
            where("supplierId", "==", currentSupplierId)
        );
        const poSnapshot = await getDocs(poQuery);
        console.log(`[Load Step 3] Successfully queried purchase orders. Found ${poSnapshot.docs.length} documents.`); // <<< देखें कि कितने मिले

        purchaseOrders = poSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        purchaseOrdersData = purchaseOrders; // ग्लोबल वेरिएबल अपडेट करें
        console.log("[Load Step 3] Purchase Orders Data Array:", purchaseOrders); // <<< वास्तविक डेटा देखें
        poSum = purchaseOrders.reduce((sum, po) => sum + (parseFloat(po.totalAmount) || 0), 0);

        // 4. खाता सारांश अपडेट करें
        console.log("[Load Step 4] Calculating Summary...");
        updateAccountSummary(poSum, paymentSum); // <<< UI अपडेट करें

        // 5. PO ड्रॉपडाउन पॉप्युलेट करें (पेमेंट मोड के लिए)
        console.log("[Load Step 5] Populating PO dropdown...");
        populatePoDropdown(purchaseOrders); // <<< UI अपडेट करें


    } catch (error) {
        // विस्तृत एरर लॉगिंग
        console.error("Error during loadSupplierAccountData execution:", error);
        console.error("Error Name:", error.name);
        console.error("Error Message:", error.message);
        console.error("Error Code:", error.code); // Firestore एरर कोड
        console.error("Error Stack:", error.stack); // एरर का स्टैक ट्रेस

        if (error.code === 'permission-denied') {
             displayError("Permission denied while loading data. Check Firestore rules and authentication.");
        } else if (error.message && error.message.toLowerCase().includes("index")) {
             displayError("Missing Firestore index. Check console for details or contact admin.");
        } else {
            displayError(`An unexpected error occurred: ${error.message}. Check console.`);
        }
        // एरर होने पर UI को रीसेट करें
        populateSupplierDetails(supplierData); // पहले लोड हुआ डेटा दिखाएं
        populatePaymentHistory([]); // पेमेंट लिस्ट खाली करें
        updateAccountSummary(0, 0); // समरी रीसेट करें
        populatePoDropdown([]); // ड्रॉपडाउन रीसेट करें

    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        console.log("loadSupplierAccountData finished.");
    }
}

// --- UI Population Functions ---
function populateSupplierDetails(data) {
    console.log("populateSupplierDetails called with data:", data);
    if (!data) {
        console.warn("populateSupplierDetails: No data provided.");
        // आप चाहें तो यहां UI फ़ील्ड्स को 'N/A' सेट कर सकते हैं
        return;
    }
    // ... (बाकी का कोड वैसा ही) ...
    if (supplierNameHeader) supplierNameHeader.textContent = data.name || 'Supplier Account';
    if (supplierNameBreadcrumb) supplierNameBreadcrumb.textContent = data.name || 'Details';
    if (detailSupplierId) detailSupplierId.textContent = data.id || 'N/A';
    if (detailSupplierName) detailSupplierName.textContent = data.name || 'N/A';
    if (detailSupplierCompany) detailSupplierCompany.textContent = data.company || 'N/A';
    if (detailSupplierWhatsapp) detailSupplierWhatsapp.textContent = data.contact || 'N/A';
    if (detailSupplierEmail) detailSupplierEmail.textContent = data.email || 'N/A';
    if (detailSupplierGst) detailSupplierGst.textContent = data.gstNo || 'N/A';
    if (detailSupplierAddress) detailSupplierAddress.textContent = data.address || 'N/A';
    if (detailAddedOn) detailAddedOn.textContent = data.addedOn ? formatDate(data.addedOn) : 'N/A';
}

function populatePaymentHistory(payments) {
    console.log(`Populating payment history with ${payments ? payments.length : 0} items...`, payments); // <<< विस्तृत लॉग
    const tableBody = supplierPaymentList || document.getElementById('transactionsTableBody'); // <<< सुनिश्चित करें कि सही वेरिएबल इस्तेमाल हो
    const loadingRow = transactionsLoadingRow || document.getElementById('transactionsLoading');
    const noDataRow = noTransactionsMessageRow || document.getElementById('noTransactionsMessage');

    console.log("Table Body Element:", tableBody); // <<< जांचें कि एलिमेंट मिला या नहीं
    console.log("Loading Row Element:", loadingRow);
    console.log("No Data Row Element:", noDataRow);


    if (!tableBody) {
        console.error("Transaction table body element not found!");
        return;
    }
    tableBody.innerHTML = ''; // पुरानी लिस्ट साफ करें

    if (loadingRow) loadingRow.style.display = 'none'; // लोडिंग छिपाएं

    if (!payments || payments.length === 0) {
        console.log("No payments found, showing 'no data' message.");
        if (noDataRow) {
            noDataRow.style.display = 'table-row'; // "No transactions" रो दिखाएं
        } else {
            // फॉलबैक अगर रो नहीं है
            tableBody.innerHTML = `<tr><td colspan="6">No payment history found.</td></tr>`;
            console.warn("Element with ID 'noTransactionsMessage' not found.");
        }
        if (supplierPaymentListError) supplierPaymentListError.style.display = 'none';
        return;
    }

    // अगर पेमेंट्स हैं, तो "No transactions" छिपाएं
    if (noDataRow) noDataRow.style.display = 'none';
    if (supplierPaymentListError) supplierPaymentListError.style.display = 'none';

    console.log("Adding payment rows to table...");
    payments.forEach((payment, index) => {
        console.log(`Processing payment item ${index}:`, payment);
        try {
             const row = tableBody.insertRow();
             row.insertCell(0).textContent = formatDate(payment.paymentDate);
             row.insertCell(1).textContent = payment.notes || '-';
             row.insertCell(2).textContent = payment.paymentMethod || 'N/A';
             const poCell = row.insertCell(3);
             poCell.textContent = payment.linkedPoNumber || '-'; // अभी केवल नंबर दिखाएं
             const amountCell = row.insertCell(4);
             amountCell.textContent = formatCurrency(payment.paymentAmount);
             amountCell.classList.add('amount-paid');
             row.insertCell(5).textContent = ''; // Actions
        } catch(e) {
             console.error(`Error creating row for payment ${index}:`, payment, e);
             // Optionally add an error row to the table
             const errorRow = tableBody.insertRow();
             const cell = errorRow.insertCell(0);
             cell.colSpan = 6; // Adjust colspan
             cell.textContent = `Error displaying payment ${payment.id || index}.`;
             cell.style.color = 'red';
        }
    });
    console.log("Finished adding payment rows.");
}

function updateAccountSummary(poTotal, paymentTotal, pendingFromSupplierDoc = null) {
    console.log(`Updating account summary UI with poTotal=${poTotal}, paymentTotal=${paymentTotal}`); // <<< विस्तृत लॉग
    const poDisplay = totalPoValueDisplay || document.getElementById('totalPoValue'); // ID 'totalPoValue' होना चाहिए
    const paidDisplay = totalPaymentsMadeDisplay || document.getElementById('totalPaymentsMade'); // ID 'totalPaymentsMade' होना चाहिए
    const balanceDisplay = outstandingBalanceDisplay || document.getElementById('outstandingBalance'); // ID 'outstandingBalance' होना चाहिए

    console.log("Summary Elements:", { poDisplay, paidDisplay, balanceDisplay }); // <<< जांचें कि एलिमेंट मिले या नहीं

    if (poDisplay) {
         poDisplay.textContent = formatCurrency(poTotal);
         poDisplay.classList.remove('loading-state');
     } else { console.warn("Element for total PO value not found."); }

    if (paidDisplay) {
        paidDisplay.textContent = formatCurrency(paymentTotal);
        paidDisplay.classList.remove('loading-state');
    } else { console.warn("Element for total payments made not found."); }

    let outstanding = 0;
    // केवल तभी गणना करें जब poTotal और paymentTotal संख्याएँ हों
    if (typeof poTotal === 'number' && typeof paymentTotal === 'number') {
         outstanding = poTotal - paymentTotal;
         console.log("Calculated outstanding amount:", outstanding);
    } else {
         console.warn("Cannot calculate outstanding balance due to invalid inputs:", {poTotal, paymentTotal});
         outstanding = NaN; // या कोई डिफ़ॉल्ट मान
    }


    if (balanceDisplay) {
        balanceDisplay.textContent = formatCurrency(outstanding); // NaN होने पर '₹ N/A' दिखाएगा
        balanceDisplay.classList.remove('loading-state');
        balanceDisplay.classList.remove('balance-due', 'balance-credit', 'balance-zero');
        if (outstanding > 0.01) {
            balanceDisplay.classList.add('balance-due');
        } else if (outstanding < -0.01) {
             balanceDisplay.classList.add('balance-credit');
        } else {
            balanceDisplay.classList.add('balance-zero'); // शून्य या N/A के लिए
        }
    } else { console.warn("Element for outstanding balance not found."); }
    console.log("Account summary UI update finished.");
}

function populatePoDropdown(pos) {
     console.log(`Populating PO dropdown with ${pos ? pos.length : 0} total POs...`);
     const dropdown = poLinkDropdown || document.getElementById('paymentLinkPOSelect'); // <<< सही ID जांचें
     if (!dropdown) {
        console.error("PO Link dropdown element not found!");
        return;
     }
    dropdown.innerHTML = '<option value="">None (Direct Payment)</option>';

    if (!pos || pos.length === 0) {
        dropdown.innerHTML += '<option value="" disabled>No POs found for this supplier</option>';
        return;
    }

    // केवल वे POs दिखाएं जिनका भुगतान बकाया है
    const relevantPOs = pos.filter(po => {
        const total = parseFloat(po.totalAmount) || 0;
        const paid = parseFloat(po.amountPaid) || 0;
        return total > paid; // केवल अगर कुल राशि भुगतान की गई राशि से अधिक है
    });
     console.log(`Found ${relevantPOs.length} relevant POs (payment not fully paid).`);

    if (relevantPOs.length === 0) {
         dropdown.innerHTML += '<option value="" disabled>No open POs found for payment</option>';
         return;
    }

    // तारीख के अनुसार सॉर्ट करें (नवीनतम पहले)
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


// --- Event Handlers ---
// ... (openPaymentModal, closePaymentModal, handleSavePayment वैसे ही रहेंगे, यह सुनिश्चित करें कि वे सही db और auth ऑब्जेक्ट्स का उपयोग करें) ...
// ... (openEditSupplierModal, closeEditSupplierModal, handleUpdateSupplier वैसे ही रहेंगे) ...

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Payment Modal Buttons
    if (addPaymentMadeBtn) addPaymentMadeBtn.addEventListener('click', openPaymentModal);
    if (closePaymentModalBtn) closePaymentModalBtn.addEventListener('click', closePaymentModal);
    if (paymentMadeModal) paymentMadeModal.addEventListener('click', (event) => { if (event.target === paymentMadeModal) closePaymentModal(); }); // पृष्ठभूमि क्लिक
    if (paymentMadeForm) paymentMadeForm.addEventListener('submit', handleSavePayment); // सुनिश्चित करें handleSavePayment परिभाषित है

    // Edit Supplier Modal Buttons
    if (editSupplierDetailsBtn) editSupplierDetailsBtn.addEventListener('click', openEditSupplierModal);
    if (cancelEditSupplierBtn) cancelEditSupplierBtn.addEventListener('click', closeEditSupplierModal);
    if (editSupplierModal) editSupplierModal.addEventListener('click', (event) => { if (event.target === editSupplierModal) closeEditSupplierModal(); }); // पृष्ठभूमि क्लिक
    // if (editSupplierForm) editSupplierForm.addEventListener('submit', handleUpdateSupplier); // सुनिश्चित करें handleUpdateSupplier परिभाषित है
     if (editSupplierForm) { // handleUpdateSupplier को handleEditSupplierSubmit से बदलें अगर यह नाम इस्तेमाल हो रहा है
         editSupplierForm.addEventListener('submit', handleEditSupplierSubmit); // Use handleEditSupplierSubmit if that's the function name
     }


    console.log("Supplier detail event listeners setup.");
}

// --- Global Initialization Function ---
window.initializeSupplierDetailPage = async () => {
    console.log("Initializing Supplier Detail Page (Global Function)...");
    clearError(); // किसी भी पिछले पेज लोड एरर को साफ करें

    // सुनिश्चित करें कि DOM तैयार है (हालांकि DOMContentLoaded इसे हैंडल करता है)
    await new Promise(resolve => setTimeout(resolve, 0)); // मैक्रोटास्क कतार में जाने के लिए

    currentSupplierId = getSupplierIdFromUrl();
    if (!currentSupplierId) {
         console.error("Supplier ID missing from URL.");
         displayError("Supplier ID missing. Cannot load details.");
         // Optional: Hide content areas
         const mainContent = document.getElementById('detailMainContent');
         if (mainContent) mainContent.style.visibility = 'hidden';
         return;
    }
    console.log("Supplier ID from URL:", currentSupplierId);

    // Ensure sections are visible if previously hidden
    const mainContent = document.getElementById('detailMainContent');
    if (mainContent) mainContent.style.visibility = 'visible';

    if (typeof db === 'undefined' || !db) {
        console.error("Firestore db instance is not available during initialization!");
        displayError("Database connection failed. Please refresh.");
        return;
    }

    await loadSupplierAccountData(); // <<< db पास करने की आवश्यकता नहीं क्योंकि यह ग्लोबल है
    setupEventListeners();

    console.log("Supplier Detail Page Initialized via global function.");
    window.supplierDetailPageInitialized = true;
};

// --- Auto-initialize ---
let initializationAttempted = false;
function attemptInitialization() {
    if (!initializationAttempted && (document.readyState === 'interactive' || document.readyState === 'complete')) {
         console.log(`DOM ready state is: ${document.readyState}. Initializing page...`);
         initializationAttempted = true;
         if (!window.supplierDetailPageInitialized) {
            window.initializeSupplierDetailPage();
         } else {
             console.log("Page already initialized.");
         }
    }
}
// इवेंट लिस्नर को एक बार ही जोड़ें
if (document.readyState === 'loading') {
    document.removeEventListener('DOMContentLoaded', attemptInitialization); // पुराना लिस्नर हटाएं (यदि हो)
    document.addEventListener('DOMContentLoaded', attemptInitialization);
} else {
    // पहले से लोड हो चुका है
    attemptInitialization();
}
// --- End Auto-initialize ---

console.log("supplier_account_detail.js loaded and running (Detailed Logging Added).");


// ------------- Modal Functions (Ensure these exist if called) ----------

async function openPaymentModal() {
    console.log("openPaymentModal called");
    const modal = paymentMadeModal || document.getElementById('paymentMadeModal');
    if (!modal) { console.error("Payment modal element not found"); return; }

    if (!currentSupplierData) {
        displayError("Cannot record payment: Supplier data not available.", 'paymentErrorDiv');
        return;
    }
    clearError('paymentErrorDiv');
    const form = paymentMadeForm || document.getElementById('paymentMadeForm');
    if (form) form.reset();

    // Populate supplier name in modal title
     const modalTitleSpan = paymentSupplierName || document.getElementById('paymentSupplierName');
     if (modalTitleSpan) modalTitleSpan.textContent = currentSupplierData.name || 'Supplier';

     // Set default date
     const dateInput = paymentDateInput || document.getElementById('paymentDate');
     if (dateInput && !dateInput.value) {
        try {
             const today = new Date();
             const year = today.getFullYear();
             const month = (today.getMonth() + 1).toString().padStart(2, '0');
             const day = today.getDate().toString().padStart(2, '0');
             dateInput.value = `${year}-${month}-${day}`;
         } catch(e) { console.error("Error setting default payment date", e); }
     }

    // Load/Repopulate PO dropdown (using already fetched data)
    console.log("Repopulating PO dropdown within openPaymentModal...");
    const dropdown = poLinkDropdown || document.getElementById('paymentLinkPOSelect'); // Ensure correct ID
    populatePoDropdown(purchaseOrdersData); // Use globally stored PO data


    modal.style.display = 'flex'; // या 'block', आपकी CSS पर निर्भर करता है
    modal.classList.add('active'); // 'active' क्लास जोड़ें यदि CSS इसका उपयोग करता है
}

function closePaymentModal() {
    console.log("closePaymentModal called");
    const modal = paymentMadeModal || document.getElementById('paymentMadeModal');
     if (!modal) { console.error("Payment modal element not found for closing"); return; }
    modal.style.display = 'none';
    modal.classList.remove('active');
    clearError('paymentErrorDiv');
}

// --- Handle Save Payment (Ensure this exists) ---
async function handleSavePayment(event) {
    event.preventDefault();
    const formErrorElement = paymentErrorDiv || document.getElementById('paymentErrorDiv'); // <<< सही ID का उपयोग करें
    clearError(formErrorElement?.id || 'paymentErrorDiv');

    if (!currentSupplierId || !currentSupplierData) {
        displayError("Supplier information is missing.", formErrorElement?.id);
        return;
    }

    const amountInput = paymentAmountInput || document.getElementById('paymentAmount');
    const dateInput = paymentDateInput || document.getElementById('paymentDate');
    const methodInput = paymentMethodInput || document.getElementById('paymentMethod');
    const notesInput = paymentNotesInput || document.getElementById('paymentNotes');
    const poSelect = poLinkDropdown || document.getElementById('paymentLinkPOSelect'); // <<< सही ID का उपयोग करें

    const paymentData = {
        supplierId: currentSupplierId,
        supplierName: currentSupplierData.name || 'N/A',
        paymentAmount: parseFloat(amountInput.value),
        paymentDate: null, // Timestamp नीचे सेट होगा
        paymentMethod: methodInput.value,
        notes: notesInput.value.trim() || '',
        linkedPoId: poSelect.value || null,
        linkedPoNumber: poSelect.selectedOptions[0]?.dataset?.poNumber || null, // dataset से PO नंबर प्राप्त करें
        createdAt: serverTimestamp()
    };

    // Validation
    if (isNaN(paymentData.paymentAmount) || paymentData.paymentAmount <= 0) {
        displayError("Please enter a valid positive payment amount.", formErrorElement?.id); return;
    }
    if (!dateInput.value) {
        displayError("Please select a payment date.", formErrorElement?.id); return;
    }
    try {
         paymentData.paymentDate = Timestamp.fromDate(new Date(dateInput.value + "T00:00:00")); // लोकल टाइम मानकर
         if (isNaN(paymentData.paymentDate.toDate())) throw new Error("Invalid Date Object");
    } catch(e) {
         console.error("Invalid Date Input:", dateInput.value, e);
         displayError("Please select a valid payment date.", formErrorElement?.id); return;
    }
     if (!paymentData.paymentMethod) {
        displayError("Please select a payment method.", formErrorElement?.id); return;
    }


    console.log("Attempting to save payment with data:", paymentData);
    const saveBtn = event.submitter; // सबमिट बटन प्राप्त करें
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }


    try {
        await runTransaction(db, async (transaction) => {
            const paymentRef = doc(collection(db, "supplier_payments"));
            transaction.set(paymentRef, paymentData);
            console.log("Payment document created in transaction:", paymentRef.id);

            if (paymentData.linkedPoId) {
                console.log(`Attempting to update linked PO: ${paymentData.linkedPoId}`);
                const poRef = doc(db, "purchaseOrders", paymentData.linkedPoId);
                const poDoc = await transaction.get(poRef);

                if (!poDoc.exists()) {
                    console.warn(`Linked PO ${paymentData.linkedPoId} not found during transaction.`);
                    // Decide how to handle this: throw error to stop, or just log and continue?
                    // throw new Error(`Linked PO ${paymentData.linkedPoId} not found.`); // Transaction रोक देगा
                } else {
                    const poData = poDoc.data();
                    const currentPaid = parseFloat(poData.amountPaid) || 0;
                    const totalAmount = parseFloat(poData.totalAmount) || 0;
                    const newPaidAmount = currentPaid + paymentData.paymentAmount;
                    let newStatus = poData.status; // मौजूदा स्टेटस रखें

                    // Status को केवल तभी अपडेट करें जब आवश्यक हो
                    if (newPaidAmount >= totalAmount - 0.001) { // फ्लोटिंग पॉइंट एरर के लिए टॉलरेंस
                        newStatus = 'Paid';
                    } else if (newPaidAmount > 0) {
                        newStatus = 'Partially Paid';
                    }
                     console.log(`Updating PO status to ${newStatus} and paid amount to ${newPaidAmount}`);
                     transaction.update(poRef, {
                         amountPaid: newPaidAmount,
                         status: newStatus, // स्टेटस अपडेट करें
                         lastPaymentDate: paymentData.paymentDate
                     });
                 }
            }
             // Update supplier pending amount (optional, complex)
             // const supplierRef = doc(db, "suppliers", currentSupplierId);
             // ... (transaction.get and transaction.update for supplier pendingAmount) ...
        });

        console.log("Payment transaction successful.");
        closePaymentModal();
        await loadSupplierAccountData(); // डेटा रीलोड करें

    } catch (error) {
        console.error("Error saving payment transaction:", error);
        displayError(`Failed to save payment: ${error.message}`, formErrorElement?.id);
    } finally {
         if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Payment'; }
    }
}

// --- Edit Supplier Functions (Ensure these exist) ---
function openEditSupplierModal() {
     console.log("openEditSupplierModal called");
     const modal = editSupplierModal || document.getElementById('editSupplierModal');
     if (!modal || !currentSupplierData) {
         console.error("Edit modal element or supplier data missing.");
         alert("Cannot open edit form. Supplier data not loaded.");
         return;
     }
     clearError('editSupplierErrorDiv'); // <<< सही ID का उपयोग करें

     // Populate form
     const nameInput = editSupplierNameInput || document.getElementById('editSupplierNameInput');
     const companyInput = editSupplierCompanyInput || document.getElementById('editSupplierCompanyInput');
     const contactInput = editSupplierContactInput || document.getElementById('editSupplierContactInput');
     const emailInput = editSupplierEmailInput || document.getElementById('editSupplierEmailInput');
     const gstInput = editSupplierGstInput || document.getElementById('editSupplierGstInput');
     const addressInput = editSupplierAddressInput || document.getElementById('editSupplierAddressInput');
     const hiddenIdInput = editingSupplierIdInput || document.getElementById('editingSupplierId');

     if (nameInput) nameInput.value = currentSupplierData.name || '';
     if (companyInput) companyInput.value = currentSupplierData.company || '';
     if (contactInput) contactInput.value = currentSupplierData.contact || '';
     if (emailInput) emailInput.value = currentSupplierData.email || '';
     if (gstInput) gstInput.value = currentSupplierData.gstNo || '';
     if (addressInput) addressInput.value = currentSupplierData.address || '';
     if (hiddenIdInput) hiddenIdInput.value = currentSupplierId;

    modal.style.display = 'flex'; // या 'block'
    modal.classList.add('active');
}

function closeEditSupplierModal() {
     console.log("closeEditSupplierModal called");
     const modal = editSupplierModal || document.getElementById('editSupplierModal');
      if (!modal) { console.error("Edit modal element not found for closing"); return; }
    modal.style.display = 'none';
    modal.classList.remove('active');
    clearError('editSupplierErrorDiv');
}

async function handleEditSupplierSubmit(event) {
     event.preventDefault();
     const formErrorElement = editSupplierErrorDiv || document.getElementById('editSupplierErrorDiv'); // <<< सही ID का उपयोग करें
     clearError(formErrorElement?.id || 'editSupplierErrorDiv');

     const supplierId = (editingSupplierIdInput || document.getElementById('editingSupplierId'))?.value;
     if (!supplierId) {
         displayError("Supplier ID missing. Cannot update.", formErrorElement?.id);
         return;
     }

     const nameInput = editSupplierNameInput || document.getElementById('editSupplierNameInput');
     const companyInput = editSupplierCompanyInput || document.getElementById('editSupplierCompanyInput');
     const contactInput = editSupplierContactInput || document.getElementById('editSupplierContactInput');
     const emailInput = editSupplierEmailInput || document.getElementById('editSupplierEmailInput');
     const gstInput = editSupplierGstInput || document.getElementById('editSupplierGstInput');
     const addressInput = editSupplierAddressInput || document.getElementById('editSupplierAddressInput');

     const updatedData = {
        name: nameInput.value.trim(),
        company: companyInput.value.trim(),
        contact: contactInput.value.trim(),
        email: emailInput.value.trim(),
        gstNo: gstInput.value.trim(),
        address: addressInput.value.trim(),
        lastUpdated: serverTimestamp() // अपडेट समय जोड़ें
    };

     if (!updatedData.name) {
         displayError("Supplier name is required.", formErrorElement?.id); return;
     }
     // Add more validation if needed

     console.log(`Updating supplier ${supplierId} with data:`, updatedData);
     const submitBtn = updateSupplierBtn || document.getElementById('updateSupplierBtn');
     if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; }

     try {
         const supplierRef = doc(db, "suppliers", supplierId);
         await updateDoc(supplierRef, updatedData);
         console.log("Supplier update successful.");
         closeEditSupplierModal();
         await loadSupplierAccountData(); // डेटा रीलोड करें

     } catch (error) {
         console.error("Error updating supplier:", error);
         displayError(`Failed to update supplier: ${error.message}`, formErrorElement?.id);
     } finally {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Supplier'; }
     }
}