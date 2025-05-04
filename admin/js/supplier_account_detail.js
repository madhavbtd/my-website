// js/supplier_account_detail.js
// Version updated by Gemini to fix Account Summary display and initializeSupplierDetailPage error

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
// Corrected ID based on previous discussion (assuming it's summaryTotalPaymentsMade in HTML)
const summaryTotalPaymentsMade = document.getElementById('summaryTotalPaymentsMade'); // <<< Check if this ID is correct in your HTML
const summaryOutstandingBalance = document.getElementById('summaryOutstandingBalance');

// PO Table Elements
const poTableBody = document.getElementById('poTableBody'); // <<< Check if this ID is correct in your HTML ('supplierPoTableBody'?)
const poLoadingMessage = document.getElementById('poLoadingMessage'); // <<< Check if this ID is correct in your HTML ('supplierPoLoading'?)
const poListError = document.getElementById('poListError'); // <<< Check if this ID is correct in your HTML ('supplierPoListError'?)

// Payments Table Elements
const paymentsTableBody = document.getElementById('paymentsTableBody'); // <<< Check if this ID is correct in your HTML ('supplierPaymentsTableBody'?)
const paymentsLoadingMessage = document.getElementById('paymentsLoadingMessage'); // <<< Check if this ID is correct in your HTML ('supplierPaymentLoading'?)
const paymentsListError = document.getElementById('paymentsListError'); // <<< Check if this ID is correct in your HTML ('supplierPaymentListError'?)

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

// Function to display errors to the user (you might want to improve this)
function displayError(message, elementId = null) {
    console.error("Error:", message);
    if (elementId) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            // Hide associated loading message if applicable
            const loadingId = elementId.replace('Error', 'Loading'); // Guess loading ID
            const loadingElement = document.getElementById(loadingId);
            if(loadingElement) loadingElement.style.display = 'none';
        } else {
            alert(message); // Fallback
        }
    } else {
        alert(message); // Fallback alert
    }
}

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

    // Reset UI elements
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
            // Clear summary if supplier not found
            if (summaryTotalPoValue) summaryTotalPoValue.textContent = '₹0.00';
            if (summaryTotalPaymentsMade) summaryTotalPaymentsMade.textContent = '₹0.00';
            if (summaryOutstandingBalance) summaryOutstandingBalance.textContent = '₹0.00';
            return; // Stop if supplier doesn't exist
        }

        // 2. Fetch Purchase Orders (POs) for this supplier
        // Use specific PO table IDs if they differ from the generic ones above
        const poTableBodyElem = poTableBody || document.getElementById('supplierPoTableBody');
        const poLoadingElem = poLoadingMessage || document.getElementById('supplierPoLoading');
        const poErrorElem = poListError || document.getElementById('supplierPoListError');

        if (poLoadingElem) poLoadingElem.style.display = 'table-row'; // Show loading in table
        if (poErrorElem) poErrorElem.style.display = 'none';
        if (poTableBodyElem) poTableBodyElem.innerHTML = ''; // Clear previous POs

        const poQuery = query(
            collection(dbInstance, "purchaseOrders"), // Correct collection name? Should it be 'purchaseOrders'?
            where("supplierId", "==", currentSupplierId),
            orderBy("orderDate", "desc") // Show newest first
        );
        const poSnapshot = await getDocs(poQuery);
        console.log(`Found ${poSnapshot.size} POs for this supplier.`);

        if (poSnapshot.empty) {
            if (poTableBodyElem) poTableBodyElem.innerHTML = '<tr><td colspan="5">No purchase orders found for this supplier.</td></tr>';
        } else {
            poSnapshot.forEach(doc => {
                const po = doc.data();
                const poId = doc.id;
                displayPurchaseOrder(po, poId, poTableBodyElem); // Pass table body element
                const amount = Number(po.totalAmount) || 0;
                totalPoValueNum += amount;
            });
        }
        if (poLoadingElem) poLoadingElem.style.display = 'none';


        // 3. Fetch Payments Made to this supplier
        // Use specific Payment table IDs if they differ
        const paymentsTableBodyElem = paymentsTableBody || document.getElementById('supplierPaymentsTableBody');
        const paymentsLoadingElem = paymentsLoadingMessage || document.getElementById('supplierPaymentLoading');
        const paymentsErrorElem = paymentsListError || document.getElementById('supplierPaymentListError');

        if (paymentsLoadingElem) paymentsLoadingElem.style.display = 'table-row'; // Show loading
        if (paymentsErrorElem) paymentsErrorElem.style.display = 'none';
        if (paymentsTableBodyElem) paymentsTableBodyElem.innerHTML = ''; // Clear previous payments

        const paymentQuery = query(
            collection(dbInstance, "supplier_payments"),
            where("supplierId", "==", currentSupplierId),
            orderBy("paymentDate", "desc") // Show newest first
        );
        const paymentSnapshot = await getDocs(paymentQuery);
        console.log(`Found ${paymentSnapshot.size} payments for this supplier.`);

        if (paymentSnapshot.empty) {
            if (paymentsTableBodyElem) paymentsTableBodyElem.innerHTML = '<tr><td colspan="5">No payments recorded for this supplier.</td></tr>';
        } else {
            paymentSnapshot.forEach(doc => {
                const payment = doc.data();
                const paymentId = doc.id;
                displayPaymentMade(payment, paymentId, paymentsTableBodyElem); // Pass table body element
                 const amount = Number(payment.paymentAmount) || 0;
                 totalPaymentsNum += amount;
            });
        }
        if (paymentsLoadingElem) paymentsLoadingElem.style.display = 'none';

        // 4. Calculate and Display Account Summary
        const outstandingBalanceNum = totalPoValueNum - totalPaymentsNum;
        console.log("Calculated Summary:", { totalPO: totalPoValueNum, totalPaid: totalPaymentsNum, balance: outstandingBalanceNum });

        // --- Update Account Summary UI ---
        // (This is the block that fixes the summary display)
        if (summaryTotalPoValue) {
            summaryTotalPoValue.textContent = `₹${totalPoValueNum.toFixed(2)}`;
        } else {
            console.warn("Element with ID 'summaryTotalPoValue' not found.");
        }

        if (summaryTotalPaymentsMade) {
            summaryTotalPaymentsMade.textContent = `₹${totalPaymentsNum.toFixed(2)}`;
        } else {
            console.warn("Element with ID 'summaryTotalPaymentsMade' not found.");
        }

        if (summaryOutstandingBalance) {
            summaryOutstandingBalance.textContent = `₹${outstandingBalanceNum.toFixed(2)}`;
            // Optional: Add color coding for the balance
            summaryOutstandingBalance.style.color = outstandingBalanceNum > 0 ? 'var(--danger-color, #dc3545)' : 'var(--success-color, #28a745)';
            summaryOutstandingBalance.style.fontWeight = 'bold'; // Make it stand out
        } else {
            console.warn("Element with ID 'summaryOutstandingBalance' not found.");
        }
        console.log('Final Account Summary Calculated and Displayed:', { totalPO: totalPoValueNum, totalPaid: totalPaymentsNum, balance: outstandingBalanceNum });


    } catch (error) {
        console.error("Error loading supplier account data:", error);
        // Use specific error elements if available
        const poErrorElem = poListError || document.getElementById('supplierPoListError');
        const paymentsErrorElem = paymentsListError || document.getElementById('supplierPaymentListError');

        if (error.code === 'failed-precondition') {
             const indexErrorMsg = "Error: Database index missing. Check Firestore console.";
             displayError(indexErrorMsg, poErrorElem ? poErrorElem.id : null);
             displayError(indexErrorMsg, paymentsErrorElem ? paymentsErrorElem.id : null);
             console.error("Firestore index missing. Please create the required composite indexes in your Firebase console.");
        } else {
             displayError(`Error loading POs: ${error.message}`, poErrorElem ? poErrorElem.id : null);
             displayError(`Error loading Payments: ${error.message}`, paymentsErrorElem ? paymentsErrorElem.id : null);
        }
        // Hide loading messages on error
        const poLoadingElem = poLoadingMessage || document.getElementById('supplierPoLoading');
        const paymentsLoadingElem = paymentsLoadingMessage || document.getElementById('supplierPaymentLoading');
        if (poLoadingElem) poLoadingElem.style.display = 'none';
        if (paymentsLoadingElem) paymentsLoadingElem.style.display = 'none';

        // Also clear summary on error
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
    if (detailSupplierWhatsapp) detailSupplierWhatsapp.textContent = '-';
    if (detailSupplierEmail) detailSupplierEmail.textContent = '-';
    if (detailSupplierGst) detailSupplierGst.textContent = '-';
    if (detailSupplierAddress) detailSupplierAddress.textContent = '-';

    // Reset Summary - Set to loading or initial zero
    if (summaryTotalPoValue) summaryTotalPoValue.textContent = 'Calculating...'; // Show calculation in progress
    if (summaryTotalPaymentsMade) summaryTotalPaymentsMade.textContent = 'Calculating...';
    if (summaryOutstandingBalance) summaryOutstandingBalance.textContent = 'Calculating...';

    // Clear tables and ensure loading messages are handled by loadSupplierAccountData
    const poTableBodyElem = poTableBody || document.getElementById('supplierPoTableBody');
    const paymentsTableBodyElem = paymentsTableBody || document.getElementById('supplierPaymentsTableBody');
    if (poTableBodyElem) poTableBodyElem.innerHTML = '';
    if (paymentsTableBodyElem) paymentsTableBodyElem.innerHTML = '';
    // Loading/Error display is handled within loadSupplierAccountData
}

// --- Display Supplier Details ---
function displaySupplierDetails(data) {
    if (!data) return;
    // Use escapeHtml for safety, though less critical for data you trust
    const escapeHtml = (unsafe) => typeof unsafe === 'string' ? unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : unsafe;

    const name = escapeHtml(data.name) || 'N/A';
    if (supplierNameHeader) supplierNameHeader.textContent = `Account: ${name}`;
    if (supplierNameBreadcrumb) supplierNameBreadcrumb.textContent = name;
    if (detailSupplierId) detailSupplierId.textContent = escapeHtml(currentSupplierId) || 'N/A'; // Display the actual ID
    if (detailSupplierName) detailSupplierName.textContent = name;
    if (detailSupplierCompany) detailSupplierCompany.textContent = escapeHtml(data.companyName || data.company) || '-'; // Check for companyName too
    if (detailSupplierWhatsapp) {
        const whatsappNum = escapeHtml(data.whatsappNo || data.whatsapp); // Check for whatsappNo too
        detailSupplierWhatsapp.innerHTML = whatsappNum ? `<a href="https://wa.me/${whatsappNum.replace(/\D/g, '')}" target="_blank">${whatsappNum} <i class="fab fa-whatsapp" style="color: green;"></i></a>` : '-';
    }
    if (detailSupplierEmail) {
         const emailAddr = escapeHtml(data.email);
         detailSupplierEmail.innerHTML = emailAddr ? `<a href="mailto:${emailAddr}">${emailAddr}</a>` : '-';
    }
    if (detailSupplierGst) detailSupplierGst.textContent = escapeHtml(data.gstNo) || '-';
    if (detailSupplierAddress) detailSupplierAddress.textContent = escapeHtml(data.address) || '-';

    // Update payment modal name as well
    if(paymentModalSupplierName) paymentModalSupplierName.textContent = name;
}

// --- Display Purchase Order Row ---
function displayPurchaseOrder(po, id, tableBodyElement) {
    // Use the passed tableBodyElement or fallback to the global variable
    const targetTableBody = tableBodyElement || poTableBody || document.getElementById('supplierPoTableBody');
    if (!targetTableBody || !po) return;

    const row = targetTableBody.insertRow();
    row.setAttribute('data-id', id); // Add ID for potential future actions

    // Robust date handling
    let formattedDate = 'N/A';
    try {
        const orderDate = po.orderDate?.toDate ? po.orderDate.toDate() : (po.orderDate ? new Date(po.orderDate) : null);
        if (orderDate && !isNaN(orderDate)) {
             formattedDate = orderDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
    } catch(e) { console.warn("Could not format PO date:", po.orderDate, e); }

    const formattedAmount = `₹${(Number(po.totalAmount) || 0).toFixed(2)}`;
    const status = po.status || 'Unknown';
    const paymentStatus = po.paymentStatus || 'Pending';

     // Use escapeHtml for potentially user-entered data like poNumber
     const escapeHtml = (unsafe) => typeof unsafe === 'string' ? unsafe.replace(/</g, "&lt;").replace(/>/g, "&gt;") : unsafe;
     const poNumberDisplay = escapeHtml(po.poNumber) || `ID:${id.substring(0, 6)}...`;

    row.innerHTML = `
        <td>${poNumberDisplay}</td>
        <td>${formattedDate}</td>
        <td style="text-align: right;">${formattedAmount}</td>
        <td><span class="status-badge status-${status.toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(status)}</span></td>
        <td><span class="status-badge payment-status-${paymentStatus.toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(paymentStatus)}</span></td>
    `;
}

// --- Display Payment Made Row ---
function displayPaymentMade(payment, id, tableBodyElement) {
     // Use the passed tableBodyElement or fallback to the global variable
    const targetTableBody = tableBodyElement || paymentsTableBody || document.getElementById('supplierPaymentsTableBody');
    if (!targetTableBody || !payment) return;

    const row = targetTableBody.insertRow();
    row.setAttribute('data-id', id); // Add ID for potential future actions

    // Robust date handling
    let formattedDate = 'N/A';
     try {
         const paymentDate = payment.paymentDate?.toDate ? payment.paymentDate.toDate() : (payment.paymentDate ? new Date(payment.paymentDate) : null);
         if (paymentDate && !isNaN(paymentDate)) {
            formattedDate = paymentDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
    } catch (e) { console.warn("Could not format Payment date:", payment.paymentDate, e); }


    const formattedAmount = `₹${(Number(payment.paymentAmount) || 0).toFixed(2)}`;
    // Use escapeHtml for potentially user-entered data
     const escapeHtml = (unsafe) => typeof unsafe === 'string' ? unsafe.replace(/</g, "&lt;").replace(/>/g, "&gt;") : unsafe;
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
    // Ensure elements exist before adding listeners
    if (addPaymentMadeBtn) {
        addPaymentMadeBtn.addEventListener('click', openAddPaymentModal);
    } else { console.warn("Add Payment button not found."); }

    if (editSupplierDetailsBtn) {
        editSupplierDetailsBtn.addEventListener('click', () => {
            if (currentSupplierId) {
                 window.location.href = `supplier_management.html?edit=${currentSupplierId}`;
            } else {
                alert("Cannot edit: Supplier ID is missing.");
            }
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
        paymentModalSupplierName.textContent = 'Supplier'; // Default
    }
    if (addPaymentForm) addPaymentForm.reset();

    // Set today's date correctly for input type="date"
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

    addPaymentModal.classList.add('active'); // Use class to show/hide modal if CSS is set up for it
    // addPaymentModal.style.display = 'block'; // Fallback display style
    if(paymentAmountInput) paymentAmountInput.focus();
}

function closeAddPaymentModal() {
    if (addPaymentModal) {
        addPaymentModal.classList.remove('active'); // Use class to show/hide modal
        // addPaymentModal.style.display = 'none'; // Fallback display style
    }
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
    const date = paymentDateInput.value; // YYYY-MM-DD string
    const method = paymentMethodSelect.value;
    const notes = paymentNotesInput ? paymentNotesInput.value.trim() : '';

    // Basic Validation
    if (isNaN(amount) || amount <= 0) { showPaymentFormError("Please enter a valid payment amount."); paymentAmountInput.focus(); return; }
    if (!date) { showPaymentFormError("Please select a payment date."); paymentDateInput.focus(); return; }

    if(savePaymentBtn) {
        savePaymentBtn.disabled = true;
        savePaymentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }
    showPaymentFormError('');

    try {
        // Convert date string to Firestore Timestamp
        // Create date object carefully to avoid timezone issues if possible
        // Setting time to noon avoids most timezone day-shift issues
        const dateParts = date.split('-'); // [YYYY, MM, DD]
        const paymentDateObject = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2], 12, 0, 0)); // Noon UTC
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

        // Ensure db instance is valid
        if (!db) throw new Error("Database connection is not available.");

        const docRef = await addDoc(collection(db, "supplier_payments"), paymentData);
        console.log("Payment recorded successfully: ID:", docRef.id);
        alert("Payment recorded successfully!");

        closeAddPaymentModal();
        // Reload only necessary data - avoid full page reload if possible
        await loadSupplierAccountData(db); // Reload all data for simplicity now

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
        if(message) alert(message); // Fallback
    }
}

// --- GEMINI ADDED CODE: Global Initialization Function ---
/**
 * Initializes the Supplier Detail Page.
 * This function should be called when the page is ready (e.g., by HTML script tag).
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

    // Check if Firestore db object is available
    if (typeof db === 'undefined' || !db) {
        console.error("Firestore database instance (db) is not available. Check firebase-init.js and imports.");
        alert("Error: Database connection failed. Check console.");
        displayError("Database connection failed.");
        return;
    }

    // Load main data first
    await loadSupplierAccountData(db);
    // Setup listeners after trying to load initial data
    setupEventListeners();

    // Set today's date as default for payment date input
    if (paymentDateInput) {
        try {
            const today = new Date();
            const year = today.getFullYear();
            const month = (today.getMonth() + 1).toString().padStart(2, '0');
            const day = today.getDate().toString().padStart(2, '0');
            paymentDateInput.value = `${year}-${month}-${day}`;
        } catch (e) {
            console.warn("Could not set default payment date:", e);
        }
    }
    console.log("Supplier Detail Page Initialized via global function.");
    window.supplierDetailPageInitialized = true; // Mark as initialized
};

// --- GEMINI ADDED CODE: Auto-initialize ---
// This ensures the function runs even if not explicitly called by HTML,
// assuming the script is loaded type=module and defer.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
         // Prevent double initialization if called by HTML AND this listener
         if (!window.supplierDetailPageInitialized) {
            window.initializeSupplierDetailPage();
         }
    });
} else {
    // DOMContentLoaded has already fired
    if (!window.supplierDetailPageInitialized) {
        window.initializeSupplierDetailPage();
    }
}
// --- End GEMINI ADDED CODE ---

console.log("supplier_account_detail.js loaded and running (with global init).");