// js/supplier_account_detail.js
// Version updated by Gemini to fix Account Summary display, initializeSupplierDetailPage error, and correct HTML IDs

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
// (IDs should match your supplier_account_detail.html file)
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

// Account Summary Elements
const summaryTotalPoValue = document.getElementById('summaryTotalPoValue');
const summaryTotalPaymentsMade = document.getElementById('summaryTotalPaid'); // <<< ID CHANGE APPLIED >>> (Matches HTML ID)
const summaryOutstandingBalance = document.getElementById('summaryBalance');    // <<< ID CHANGE APPLIED >>> (Matches HTML ID)

// PO Table Elements
// Assuming IDs based on previous HTML snippet (verify if different)
const poTableBody = document.getElementById('supplierPoTableBody');
const poLoadingMessage = document.getElementById('supplierPoLoading');
const poListError = document.getElementById('supplierPoListError');

// Payments Table Elements
// Assuming IDs based on previous HTML snippet (verify if different)
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


// --- Helper Functions ---

// Function to display errors to the user
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
        } else {
            alert(message);
        }
    } else {
        alert(message);
    }
}

// Function to escape HTML
const escapeHtml = (unsafe) => typeof unsafe === 'string' ? unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : unsafe;

// --- Get Supplier ID from URL ---
function getSupplierIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// --- Load All Supplier Account Data ---
async function loadSupplierAccountData(dbInstance) {
    if (!currentSupplierId) {
        displayError("Cannot load data: Supplier ID is missing.");
        return;
    }
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
        } else {
            console.error("Supplier not found in database.");
            displayError("Supplier not found. Cannot load account details.", "supplierNameHeader");
            if (summaryTotalPoValue) summaryTotalPoValue.textContent = '₹0.00';
            if (summaryTotalPaymentsMade) summaryTotalPaymentsMade.textContent = '₹0.00';
            if (summaryOutstandingBalance) summaryOutstandingBalance.textContent = '₹0.00';
            return;
        }

        // 2. Fetch Purchase Orders (POs)
        const poTableBodyElem = poTableBody; // Use variable defined above
        const poLoadingElem = poLoadingMessage;
        const poErrorElem = poListError;

        if (poLoadingElem) poLoadingElem.style.display = 'table-row';
        if (poErrorElem) poErrorElem.style.display = 'none';
        if (poTableBodyElem) poTableBodyElem.innerHTML = '';

        const poQuery = query(
            collection(dbInstance, "purchaseOrders"), // Ensure correct collection name
            where("supplierId", "==", currentSupplierId),
            orderBy("orderDate", "desc")
        );
        const poSnapshot = await getDocs(poQuery);
        console.log(`Found ${poSnapshot.size} POs for this supplier.`);

        if (poSnapshot.empty) {
            if (poTableBodyElem) poTableBodyElem.innerHTML = '<tr><td colspan="5">No purchase orders found for this supplier.</td></tr>';
        } else {
            poSnapshot.forEach(doc => {
                const po = doc.data();
                const poId = doc.id;
                displayPurchaseOrder(po, poId, poTableBodyElem);
                const amount = Number(po.totalAmount) || 0;
                totalPoValueNum += amount;
            });
        }
        if (poLoadingElem) poLoadingElem.style.display = 'none';

        // 3. Fetch Payments Made
        const paymentsTableBodyElem = paymentsTableBody; // Use variable defined above
        const paymentsLoadingElem = paymentsLoadingMessage;
        const paymentsErrorElem = paymentsListError;

        if (paymentsLoadingElem) paymentsLoadingElem.style.display = 'table-row';
        if (paymentsErrorElem) paymentsErrorElem.style.display = 'none';
        if (paymentsTableBodyElem) paymentsTableBodyElem.innerHTML = '';

        const paymentQuery = query(
            collection(dbInstance, "supplier_payments"),
            where("supplierId", "==", currentSupplierId),
            orderBy("paymentDate", "desc")
        );
        const paymentSnapshot = await getDocs(paymentQuery);
        console.log(`Found ${paymentSnapshot.size} payments for this supplier.`);

        if (paymentSnapshot.empty) {
            if (paymentsTableBodyElem) paymentsTableBodyElem.innerHTML = '<tr><td colspan="5">No payments recorded for this supplier.</td></tr>';
        } else {
            paymentSnapshot.forEach(doc => {
                const payment = doc.data();
                const paymentId = doc.id;
                displayPaymentMade(payment, paymentId, paymentsTableBodyElem);
                 const amount = Number(payment.paymentAmount) || 0;
                 totalPaymentsNum += amount;
            });
        }
        if (paymentsLoadingElem) paymentsLoadingElem.style.display = 'none';

        // 4. Calculate and Display Account Summary
        const outstandingBalanceNum = totalPoValueNum - totalPaymentsNum;
        console.log("Calculated Summary:", { totalPO: totalPoValueNum, totalPaid: totalPaymentsNum, balance: outstandingBalanceNum });

        // --- Update Account Summary UI ---
        // Uses corrected element IDs defined at the top
        if (summaryTotalPoValue) {
            summaryTotalPoValue.textContent = `₹${totalPoValueNum.toFixed(2)}`;
        } else { console.warn("Element with ID 'summaryTotalPoValue' not found."); }

        if (summaryTotalPaymentsMade) { // Now points to getElementById('summaryTotalPaid')
            summaryTotalPaymentsMade.textContent = `₹${totalPaymentsNum.toFixed(2)}`;
        } else { console.warn("Element with ID 'summaryTotalPaid' not found."); } // Updated warning

        if (summaryOutstandingBalance) { // Now points to getElementById('summaryBalance')
            summaryOutstandingBalance.textContent = `₹${outstandingBalanceNum.toFixed(2)}`;
            summaryOutstandingBalance.style.color = outstandingBalanceNum > 0 ? 'var(--danger-color, #dc3545)' : 'var(--success-color, #28a745)';
            summaryOutstandingBalance.style.fontWeight = 'bold';
        } else { console.warn("Element with ID 'summaryBalance' not found."); } // Updated warning
        console.log('Final Account Summary Calculated and Displayed:', { totalPO: totalPoValueNum, totalPaid: totalPaymentsNum, balance: outstandingBalanceNum });


    } catch (error) {
        console.error("Error loading supplier account data:", error);
        const poErrorElem = poListError;
        const paymentsErrorElem = paymentsListError;

        if (error.code === 'failed-precondition') {
             const indexErrorMsg = "Error: Database index missing. Check Firestore console.";
             displayError(indexErrorMsg, poErrorElem ? poErrorElem.id : null);
             displayError(indexErrorMsg, paymentsErrorElem ? paymentsErrorElem.id : null);
             console.error("Firestore index missing. Please create the required composite indexes in your Firebase console.");
        } else {
             displayError(`Error loading POs: ${error.message}`, poErrorElem ? poErrorElem.id : null);
             displayError(`Error loading Payments: ${error.message}`, paymentsErrorElem ? paymentsErrorElem.id : null);
        }
        const poLoadingElem = poLoadingMessage;
        const paymentsLoadingElem = paymentsLoadingMessage;
        if (poLoadingElem) poLoadingElem.style.display = 'none';
        if (paymentsLoadingElem) paymentsLoadingElem.style.display = 'none';

        if (summaryTotalPoValue) summaryTotalPoValue.textContent = 'Error';
        if (summaryTotalPaymentsMade) summaryTotalPaymentsMade.textContent = 'Error';
        if (summaryOutstandingBalance) summaryOutstandingBalance.textContent = 'Error';
    }
}


// --- Reset UI before loading ---
function resetUI() {
    // Clear details
    if (supplierNameHeader) supplierNameHeader.textContent = 'Loading...';
    if (supplierNameBreadcrumb) supplierNameBreadcrumb.textContent = 'Loading...';
    if (detailSupplierId) detailSupplierId.textContent = 'Loading...';
    if (detailSupplierName) detailSupplierName.textContent = '-';
    if (detailSupplierCompany) detailSupplierCompany.textContent = '-';
    if (detailSupplierWhatsapp) detailSupplierWhatsapp.textContent = '-'; // Keep only text now
    if (detailSupplierEmail) detailSupplierEmail.textContent = '-';
    if (detailSupplierGst) detailSupplierGst.textContent = '-';
    if (detailSupplierAddress) detailSupplierAddress.textContent = '-';

    // Reset Summary
    if (summaryTotalPoValue) summaryTotalPoValue.textContent = 'Calculating...';
    if (summaryTotalPaymentsMade) summaryTotalPaymentsMade.textContent = 'Calculating...'; // Use correct variable
    if (summaryOutstandingBalance) summaryOutstandingBalance.textContent = 'Calculating...'; // Use correct variable

    // Clear tables
    if (poTableBody) poTableBody.innerHTML = '';
    if (paymentsTableBody) paymentsTableBody.innerHTML = '';
    if (poLoadingMessage) poLoadingMessage.style.display = 'table-row';
    if (paymentsLoadingMessage) paymentsLoadingMessage.style.display = 'table-row';
    if (poListError) poListError.style.display = 'none';
    if (paymentsListError) paymentsListError.style.display = 'none';
}

// --- Display Supplier Details ---
function displaySupplierDetails(data) {
    if (!data) return;
    const name = escapeHtml(data.name) || 'N/A';
    if (supplierNameHeader) supplierNameHeader.textContent = `Account: ${name}`;
    if (supplierNameBreadcrumb) supplierNameBreadcrumb.textContent = name;
    if (detailSupplierId) detailSupplierId.textContent = escapeHtml(currentSupplierId) || 'N/A';
    if (detailSupplierName) detailSupplierName.textContent = name;
    if (detailSupplierCompany) detailSupplierCompany.textContent = escapeHtml(data.companyName || data.company) || '-';
    // --- WhatsApp: Display only text, no logo/link ---
    if (detailSupplierWhatsapp) {
        const whatsappNum = escapeHtml(data.whatsappNo || data.whatsapp);
        detailSupplierWhatsapp.textContent = whatsappNum || '-'; // <<< Displays only text
    }
    // --- End WhatsApp change ---
    if (detailSupplierEmail) {
         const emailAddr = escapeHtml(data.email);
         detailSupplierEmail.innerHTML = emailAddr ? `<a href="mailto:${emailAddr}">${emailAddr}</a>` : '-'; // Keep email link
    }
    if (detailSupplierGst) detailSupplierGst.textContent = escapeHtml(data.gstNo) || '-';
    if (detailSupplierAddress) detailSupplierAddress.textContent = escapeHtml(data.address) || '-';
    if(paymentModalSupplierName) paymentModalSupplierName.textContent = name;
}

// --- Display Purchase Order Row ---
function displayPurchaseOrder(po, id, tableBodyElement) {
    const targetTableBody = tableBodyElement || poTableBody;
    if (!targetTableBody || !po) return;
    const row = targetTableBody.insertRow();
    row.setAttribute('data-id', id);

    let formattedDate = 'N/A';
    try {
        const orderDate = po.orderDate?.toDate ? po.orderDate.toDate() : (po.orderDate ? new Date(po.orderDate) : null);
        if (orderDate && !isNaN(orderDate)) {
             formattedDate = orderDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
    } catch(e) { console.warn("Could not format PO date:", po.orderDate, e); }

    const formattedAmount = `₹${(Number(po.totalAmount) || 0).toFixed(2)}`;
    const status = escapeHtml(po.status) || 'Unknown';
    const paymentStatus = escapeHtml(po.paymentStatus) || 'Pending';
    const poNumberDisplay = escapeHtml(po.poNumber) || `ID:${id.substring(0, 6)}...`;

    row.innerHTML = `
        <td>${poNumberDisplay}</td>
        <td>${formattedDate}</td>
        <td style="text-align: right;">${formattedAmount}</td>
        <td><span class="status-badge status-${status.toLowerCase().replace(/\s+/g, '-')}">${status}</span></td>
        <td><span class="status-badge payment-status-${paymentStatus.toLowerCase().replace(/\s+/g, '-')}">${paymentStatus}</span></td>
    `;
}

// --- Display Payment Made Row ---
function displayPaymentMade(payment, id, tableBodyElement) {
    const targetTableBody = tableBodyElement || paymentsTableBody;
    if (!targetTableBody || !payment) return;
    const row = targetTableBody.insertRow();
    row.setAttribute('data-id', id);

    let formattedDate = 'N/A';
     try {
         const paymentDate = payment.paymentDate?.toDate ? payment.paymentDate.toDate() : (payment.paymentDate ? new Date(payment.paymentDate) : null);
         if (paymentDate && !isNaN(paymentDate)) {
            formattedDate = paymentDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
    } catch (e) { console.warn("Could not format Payment date:", payment.paymentDate, e); }

    const formattedAmount = `₹${(Number(payment.paymentAmount) || 0).toFixed(2)}`;
    const method = escapeHtml(payment.paymentMethod) || 'N/A';
    const notes = escapeHtml(payment.notes) || '-';

    row.innerHTML = `
        <td>${formattedDate}</td>
        <td style="text-align: right;">${formattedAmount}</td>
        <td>${method}</td>
        <td>${notes}</td>
        <td></td>
    `;
}


// --- Setup Event Listeners ---
function setupEventListeners() {
    if (addPaymentMadeBtn) { addPaymentMadeBtn.addEventListener('click', openAddPaymentModal); }
    else { console.warn("Add Payment button not found."); }

    if (editSupplierDetailsBtn) {
        editSupplierDetailsBtn.addEventListener('click', () => {
            if (currentSupplierId) {
                 window.location.href = `supplier_management.html?edit=${currentSupplierId}`;
            } else { alert("Cannot edit: Supplier ID is missing."); }
        });
    } else { console.warn("Edit Supplier Details button not found."); }

    // Payment Modal Listeners
    if (closePaymentModal) { closePaymentModal.addEventListener('click', closeAddPaymentModal); }
    if (cancelPaymentBtn) { cancelPaymentBtn.addEventListener('click', closeAddPaymentModal); }
    if (addPaymentModal) {
        addPaymentModal.addEventListener('click', (event) => {
            if (event.target === addPaymentModal) { closeAddPaymentModal(); }
        });
    }
    if (addPaymentForm) { addPaymentForm.addEventListener('submit', handleSavePayment); }
    else { console.warn("Add Payment form not found."); }
}

// --- Add Payment Modal Logic ---
function openAddPaymentModal() {
    if (!addPaymentModal) { console.error("Payment modal element not found."); return; }
    if (currentSupplierData && paymentModalSupplierName) {
         paymentModalSupplierName.textContent = currentSupplierData.name || 'Selected Supplier';
    } else if (paymentModalSupplierName) {
        paymentModalSupplierName.textContent = 'Supplier';
    }
    if (addPaymentForm) addPaymentForm.reset();
    if (paymentDateInput) {
        try {
            const today = new Date();
            const year = today.getFullYear();
            const month = (today.getMonth() + 1).toString().padStart(2, '0');
            const day = today.getDate().toString().padStart(2, '0');
            paymentDateInput.value = `${year}-${month}-${day}`;
        } catch (e) { console.warn("Could not set default payment date:", e); }
    }
    if (paymentFormError) paymentFormError.style.display = 'none';
    if(savePaymentBtn) { savePaymentBtn.disabled = false; savePaymentBtn.innerHTML = '<i class="fas fa-save"></i> Save Payment'; }
    addPaymentModal.classList.add('active');
    if(paymentAmountInput) paymentAmountInput.focus();
}

function closeAddPaymentModal() {
    if (addPaymentModal) { addPaymentModal.classList.remove('active'); }
}

async function handleSavePayment(event) {
    event.preventDefault();
    console.log("Attempting to save payment...");

    if (!paymentAmountInput || !paymentDateInput || !paymentMethodSelect) {
         console.error("Payment form input elements missing.");
         showPaymentFormError("Internal error: Form elements not found.");
         return;
     }

    const amount = parseFloat(paymentAmountInput.value);
    const date = paymentDateInput.value;
    const method = paymentMethodSelect.value;
    const notes = paymentNotesInput ? paymentNotesInput.value.trim() : '';

    if (isNaN(amount) || amount <= 0) { showPaymentFormError("Please enter a valid payment amount."); paymentAmountInput.focus(); return; }
    if (!date) { showPaymentFormError("Please select a payment date."); paymentDateInput.focus(); return; }

    if(savePaymentBtn) {
        savePaymentBtn.disabled = true;
        savePaymentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }
    showPaymentFormError('');

    try {
        const dateParts = date.split('-');
        const paymentDateObject = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2], 12, 0, 0));
        const paymentDateTimestamp = Timestamp.fromDate(paymentDateObject);

        const paymentData = {
            supplierId: currentSupplierId,
            supplierName: currentSupplierData?.name || null,
            paymentAmount: amount,
            paymentDate: paymentDateTimestamp,
            paymentMethod: method,
            notes: notes || null,
            createdAt: serverTimestamp()
        };

        if (!db) throw new Error("Database connection is not available.");

        const docRef = await addDoc(collection(db, "supplier_payments"), paymentData);
        console.log("Payment recorded successfully: ID:", docRef.id);
        alert("Payment recorded successfully!");
        closeAddPaymentModal();
        await loadSupplierAccountData(db);

    } catch (error) {
        console.error("Error saving payment:", error);
        showPaymentFormError(`Error saving payment: ${error.message}`);
    } finally {
        if(savePaymentBtn) {
            savePaymentBtn.disabled = false;
            savePaymentBtn.innerHTML = '<i class="fas fa-save"></i> Save Payment';
        }
    }
}

// --- Show Payment Form Error ---
function showPaymentFormError(message) {
    if (paymentFormError) {
        paymentFormError.textContent = message;
        paymentFormError.style.display = message ? 'block' : 'none';
    } else {
        console.error("Payment Form Error Element not found! Message:", message);
        if(message) alert(message);
    }
}

// --- Global Initialization Function ---
/**
 * Initializes the Supplier Detail Page.
 */
window.initializeSupplierDetailPage = async () => {
    console.log("Initializing Supplier Detail Page (Global Function)...");
    currentSupplierId = getSupplierIdFromUrl();
    if (!currentSupplierId) {
        console.error("Supplier ID not found in URL.");
        alert("Error: Supplier ID is missing.");
        if (supplierNameHeader) supplierNameHeader.textContent = "Error: Invalid Supplier";
        displayError("Supplier ID missing. Cannot load details.");
        return;
    }
    console.log("Supplier ID:", currentSupplierId);

    if (typeof db === 'undefined' || !db) {
        console.error("Firestore database instance (db) is not available. Check firebase-init.js and imports.");
        alert("Error: Database connection failed. Check console.");
        displayError("Database connection failed.");
        return;
    }

    await loadSupplierAccountData(db);
    setupEventListeners();

    if (paymentDateInput) {
        try {
            const today = new Date();
            const year = today.getFullYear();
            const month = (today.getMonth() + 1).toString().padStart(2, '0');
            const day = today.getDate().toString().padStart(2, '0');
            paymentDateInput.value = `${year}-${month}-${day}`;
        } catch (e) { console.warn("Could not set default payment date:", e); }
    }
    console.log("Supplier Detail Page Initialized via global function.");
    window.supplierDetailPageInitialized = true;
};

// --- Auto-initialize ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
         if (!window.supplierDetailPageInitialized) {
            window.initializeSupplierDetailPage();
         }
    });
} else {
    if (!window.supplierDetailPageInitialized) {
        window.initializeSupplierDetailPage();
    }
}
// --- End Auto-initialize ---

console.log("supplier_account_detail.js loaded and running (with global init & ID fix).");