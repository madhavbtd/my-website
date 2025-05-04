// js/supplier_account_detail.js
// संस्करण: Event Listener सेटअप को डेटा लोड होने के बाद ले जाया गया

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
let listenersAttached = false; // <<< लिस्नर दोबारा अटैच होने से रोकने के लिए फ्लैग

// --- Helper Functions ---
// ... (displayError, clearError, getSupplierIdFromUrl, formatDate, formatCurrency पहले जैसे ही) ...
function displayError(message, elementId = 'generalError') { /* ... */ }
function clearError(elementId = 'generalError') { /* ... */ }
function getSupplierIdFromUrl() { /* ... */ }
function formatDate(timestamp) { /* ... */ }
function formatCurrency(amount) { /* ... */ }


// --- UI Population Functions ---
function populateSupplierDetails(data) {
    // <<< --- एलिमेंट्स को फंक्शन के अंदर प्राप्त करें --- >>>
    const header = document.getElementById('supplierNameHeader');
    // ... (बाकी एलिमेंट्स वैसे ही प्राप्त करें) ...
    console.log("populateSupplierDetails called");
    if (!data) return;
    // ... (UI अपडेट कोड वैसा ही) ...
}

function populatePaymentHistory(payments) {
    console.log(`Populating payment history with ${payments ? payments.length : 0} items...`);
    const tableBody = document.getElementById('transactionsTableBody');
    const loadingRow = document.getElementById('transactionsLoading');
    const noDataRow = document.getElementById('noTransactionsMessage');
    // ... (बाकी कोड वैसा ही) ...
}

function updateAccountSummary(poTotal, paymentTotal) {
    console.log(`updateAccountSummary called with poTotal=${poTotal}, paymentTotal=${paymentTotal}`);
    const poDisplay = document.getElementById('summaryTotalPoValue');
    const paidDisplay = document.getElementById('summaryTotalPaid');
    const balanceDisplay = document.getElementById('summaryBalance');
    // ... (बाकी कोड वैसा ही) ...
     console.log("Account summary UI update finished.");
}


function populatePoDropdown(pos) {
     console.log(`Populating PO dropdown with ${pos ? pos.length : 0} total POs...`);
     const dropdown = document.getElementById('paymentLinkPOSelect');
     if (!dropdown) { console.error("PO Link dropdown element not found!"); return; }
     // ... (बाकी कोड वैसा ही) ...
     console.log("PO dropdown populated.");
}

// --- Event Handlers & Modal Functions ---
// ... (openPaymentModal, closePaymentModal, handleSavePayment पहले जैसे) ...
// ... (openEditSupplierModal, closeEditSupplierModal, handleEditSupplierSubmit पहले जैसे) ...
function closePaymentModal() {
    console.log('closePaymentModal called!');
    const modal = document.getElementById('paymentMadeModal');
    if (!modal) { console.error("Payment modal element not found for closing"); return; }
    modal.style.display = 'none';
    modal.classList.remove('active');
    clearError('paymentMadeError'); // Corrected ID
}
// --- बाकी Modal/Handler Functions यहां डालें ---
// सुनिश्चित करें कि handleSavePayment, openEditSupplierModal, closeEditSupplierModal, handleEditSupplierSubmit परिभाषित हैं।
// स्टब्स को हटाया गया, आपको इन्हें पूरी तरह से परिभाषित करना होगा अगर ये फंक्शन्स इस्तेमाल हो रहे हैं।


// --- Event Listeners Setup ---
function setupEventListeners() {
    // अगर लिस्नर पहले से अटैच हैं तो दोबारा न करें
    if (listenersAttached) {
        console.log("Event listeners already attached. Skipping setup.");
        return;
    }
    console.log("Setting up event listeners...");

    // Payment Modal Buttons & Form
    const addPayBtn = document.getElementById('addPaymentMadeBtn');
    if (addPayBtn) {
        addPayBtn.addEventListener('click', openPaymentModal);
        console.log("Listener attached to addPaymentMadeBtn");
    } else { console.warn("Element 'addPaymentMadeBtn' not found."); }

    const closeBtnPay = document.getElementById('closePaymentMadeModalBtn');
    if (closeBtnPay) {
        closeBtnPay.addEventListener('click', closePaymentModal);
        console.log("Listener attached to closePaymentMadeModalBtn");
    } else { console.warn("Element 'closePaymentMadeModalBtn' not found."); }

    const cancelBtnPay = document.getElementById('cancelPaymentBtn');
    if (cancelBtnPay) {
         cancelBtnPay.addEventListener('click', closePaymentModal);
         console.log("Listener attached to cancelPaymentBtn");
    } else { console.warn("Element 'cancelPaymentBtn' not found."); }

    const payModal = document.getElementById('paymentMadeModal');
    if (payModal) {
        payModal.addEventListener('click', (event) => { if (event.target === payModal) closePaymentModal(); });
        console.log("Listener attached to paymentMadeModal background");
    } else { console.warn("Element 'paymentMadeModal' not found."); }

    const payForm = document.getElementById('paymentMadeForm');
    if (payForm) {
        payForm.addEventListener('submit', handleSavePayment);
        console.log("Listener attached to paymentMadeForm");
    } else { console.warn("Element 'paymentMadeForm' not found."); }


    // Edit Supplier Modal Buttons & Form
    const editBtn = document.getElementById('editSupplierDetailsBtn');
    if (editBtn) {
        editBtn.addEventListener('click', openEditSupplierModal);
        console.log("Listener attached to editSupplierDetailsBtn");
    } else { console.warn("Element 'editSupplierDetailsBtn' not found."); }

    const closeBtnEdit = document.getElementById('closeEditSupplierBtn');
    if (closeBtnEdit) {
        closeBtnEdit.addEventListener('click', closeEditSupplierModal);
         console.log("Listener attached to closeEditSupplierBtn");
    } else { console.warn("Element 'closeEditSupplierBtn' not found."); }

    const cancelBtnEdit = document.getElementById('cancelEditSupplierBtn');
    if (cancelBtnEdit) {
        cancelBtnEdit.addEventListener('click', closeEditSupplierModal);
         console.log("Listener attached to cancelEditSupplierBtn");
    } else { console.warn("Element 'cancelEditSupplierBtn' not found."); }

    const editModal = document.getElementById('editSupplierModal');
    if (editModal) {
        editModal.addEventListener('click', (event) => { if (event.target === editModal) closeEditSupplierModal(); });
         console.log("Listener attached to editSupplierModal background");
    } else { console.warn("Element 'editSupplierModal' not found."); }

    const editForm = document.getElementById('editSupplierForm');
    // if (editForm) { editForm.addEventListener('submit', handleEditSupplierSubmit); } // Use correct handler

    listenersAttached = true; // फ्लैग सेट करें कि लिस्नर अटैच हो गए हैं
    console.log("Supplier detail event listeners setup complete.");
}


// --- Core Data Loading Function ---
async function loadSupplierAccountData() {
    console.log("loadSupplierAccountData: Function started.");
    // ... (Auth check वैसा ही) ...
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

        // <<< --- Event Listeners को यहां कॉल करें, डेटा लोड होने के बाद --- >>>
        setupEventListeners();
        // <<< --- Event Listeners को यहां कॉल करें --- >>>


        // Step 2 & 3: Load Payments and POs Concurrently
        console.log("[Load Steps 2 & 3] Loading payments and POs concurrently...");
        const [paymentsSnapshot, poSnapshot] = await Promise.all([
             getDocs(query(collection(db, "supplier_payments"), where("supplierId", "==", currentSupplierId), orderBy("paymentDate", "desc"))),
             getDocs(query(collection(db, "purchaseOrders"), where("supplierId", "==", currentSupplierId)))
        ]);

        // Process Payments
        console.log(`[Load Step 2] Found ${paymentsSnapshot.docs.length} payments.`);
        payments = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        paymentSum = payments.reduce((sum, p) => sum + (parseFloat(p.paymentAmount) || 0), 0);
        populatePaymentHistory(payments); // UI Update

        // Process POs
        console.log(`[Load Step 3] Found ${poSnapshot.docs.length} POs.`);
        purchaseOrders = poSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        purchaseOrdersData = purchaseOrders;
        poSum = purchaseOrders.reduce((sum, po) => sum + (parseFloat(po.totalAmount) || 0), 0);

        // Step 4: Update Summary
        console.log("[Load Step 4] Calculating & Updating Summary...");
        updateAccountSummary(poSum, paymentSum); // UI Update

        // Step 5: Populate Dropdown
        console.log("[Load Step 5] Populating PO dropdown...");
        populatePoDropdown(purchaseOrders); // UI Update

    } catch (error) {
        console.error("Error during loadSupplierAccountData execution:", error);
        displayError(`Error loading data: ${error.message}. Check console.`);
        if (!supplierData) populateSupplierDetails(null);
        populatePaymentHistory([]); updateAccountSummary(0, 0); populatePoDropdown([]);
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        console.log("loadSupplierAccountData finished.");
    }
}


// --- Global Initialization Function ---
window.initializeSupplierDetailPage = async () => {
    console.log("Initializing Supplier Detail Page (Global Function)...");
    clearError();

    await new Promise(resolve => setTimeout(resolve, 0)); // DOM के लिए थोड़ा रुकें

    // currentSupplierId = getSupplierIdFromUrl(); // इसे loadSupplierAccountData में ले जाया गया

    // Ensure sections are visible if previously hidden
    const mainContent = document.getElementById('detailMainContent');
    if (mainContent) mainContent.style.visibility = 'visible';

    if (typeof db === 'undefined' || !db) {
        console.error("Firestore db instance is not available during initialization!");
        displayError("Database connection failed. Please refresh.");
        return;
    }

    await loadSupplierAccountData(); // <<< केवल इसे कॉल करें
    // setupEventListeners(); // <<< इसे loadSupplierAccountData के अंदर ले जाया गया

    console.log("Supplier Detail Page Initialized via global function.");
    window.supplierDetailPageInitialized = true;
};

// --- Auto-initialize ---
// ... (यह कोड ब्लॉक वैसा ही रहेगा) ...
let initializationAttempted = false;
function attemptInitialization() { /* ... */ }
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', attemptInitialization); } else { attemptInitialization(); }

console.log("supplier_account_detail.js loaded and running (v_listener_fix).");

// --- सुनिश्चित करें कि सभी आवश्यक फंक्शन्स मौजूद हैं ---
// स्टब्स की जगह वास्तविक फंक्शन्स होने चाहिए
async function handleSavePayment(event) { event.preventDefault(); console.error("handleSavePayment not fully defined!"); displayError("Save action failed.", "paymentMadeError"); }
function openEditSupplierModal(){ console.error("openEditSupplierModal not defined!"); alert("Cannot open edit modal."); }
function closeEditSupplierModal(){ console.error("closeEditSupplierModal not defined!"); }
async function handleEditSupplierSubmit(event){ event.preventDefault(); console.error("handleEditSupplierSubmit not defined!"); displayError("Update failed.", "editSupplierError"); }