// js/supplier_account_detail.js - v2 (Use Direct Imports to fix errors)
// Version updated by Gemini to fix Account Summary display

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
const summaryTotalPaymentsMade = document.getElementById('summaryTotalPaymentsMade');
const summaryOutstandingBalance = document.getElementById('summaryOutstandingBalance');

// PO Table Elements
const poTableBody = document.getElementById('poTableBody');
const poLoadingMessage = document.getElementById('poLoadingMessage');
const poListError = document.getElementById('poListError');

// Payments Table Elements
const paymentsTableBody = document.getElementById('paymentsTableBody');
const paymentsLoadingMessage = document.getElementById('paymentsLoadingMessage');
const paymentsListError = document.getElementById('paymentsListError');

// Add Payment Modal Elements
const addPaymentModal = document.getElementById('addPaymentModal');
const closePaymentModal = document.getElementById('closePaymentModal');
const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
const paymentModalSupplierName = document.getElementById('paymentModalSupplierName');
const addPaymentForm = document.getElementById('addPaymentForm');
const paymentAmountInput = document.getElementById('paymentAmount');
const paymentDateInput = document.getElementById('paymentDate');
const paymentMethodSelect = document.getElementById('paymentMethod'); // Corrected ID from paymentMethod
const paymentNotesInput = document.getElementById('paymentNotes'); // Corrected ID from paymentNotes
const savePaymentBtn = document.getElementById('savePaymentBtn');
const paymentFormError = document.getElementById('paymentFormError');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Supplier Account Detail Page Loaded.");
    currentSupplierId = getSupplierIdFromUrl();
    if (!currentSupplierId) {
        console.error("Supplier ID not found in URL.");
        alert("Error: Supplier ID is missing.");
        // Optionally redirect or show a permanent error message
        if (supplierNameHeader) supplierNameHeader.textContent = "Error: Invalid Supplier";
        return;
    }
    console.log("Supplier ID:", currentSupplierId);

    // Get Firestore instance (assuming db is exported correctly from firebase-init.js)
    if (!db) {
        console.error("Firestore database instance is not available.");
        alert("Error: Database connection failed.");
        return;
    }

    await loadSupplierAccountData(db);
    setupEventListeners();

    // Set today's date as default for payment date input
    if (paymentDateInput) {
       paymentDateInput.valueAsDate = new Date();
    }
});

// --- Get Supplier ID from URL ---
function getSupplierIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// --- Load All Supplier Account Data ---
async function loadSupplierAccountData(db) {
    if (!currentSupplierId) return;
    console.log("Loading supplier data for ID:", currentSupplierId);

    // Reset UI elements
    resetUI();

    try {
        // 1. Fetch Supplier Details
        const supplierRef = doc(db, "suppliers", currentSupplierId);
        const supplierSnap = await getDoc(supplierRef);

        if (supplierSnap.exists()) {
            currentSupplierData = supplierSnap.data();
            console.log("Supplier Data:", currentSupplierData);
            displaySupplierDetails(currentSupplierData);
        } else {
            console.error("Supplier not found in database.");
            alert("Error: Supplier data could not be loaded.");
            if (supplierNameHeader) supplierNameHeader.textContent = "Supplier Not Found";
             // Clear summary if supplier not found
             if (summaryTotalPoValue) summaryTotalPoValue.textContent = '₹0.00';
             if (summaryTotalPaymentsMade) summaryTotalPaymentsMade.textContent = '₹0.00';
             if (summaryOutstandingBalance) summaryOutstandingBalance.textContent = '₹0.00';
            return; // Stop if supplier doesn't exist
        }

        // 2. Fetch Purchase Orders (POs) for this supplier
        let totalPoValueNum = 0;
        if (poLoadingMessage) poLoadingMessage.style.display = 'block';
        if (poListError) poListError.style.display = 'none';
        if (poTableBody) poTableBody.innerHTML = ''; // Clear previous POs

        const poQuery = query(
            collection(db, "purchase_orders"),
            where("supplierId", "==", currentSupplierId),
            orderBy("orderDate", "desc") // Show newest first
        );
        const poSnapshot = await getDocs(poQuery);
        console.log(`Found ${poSnapshot.size} POs for this supplier.`);

        if (poSnapshot.empty) {
            if (poTableBody) poTableBody.innerHTML = '<tr><td colspan="5">No purchase orders found for this supplier.</td></tr>';
        } else {
            poSnapshot.forEach(doc => {
                const po = doc.data();
                const poId = doc.id;
                displayPurchaseOrder(po, poId);
                // Ensure totalAmount is a number before adding
                const amount = Number(po.totalAmount) || 0;
                 totalPoValueNum += amount;
            });
        }
         if (poLoadingMessage) poLoadingMessage.style.display = 'none';


        // 3. Fetch Payments Made to this supplier
        let totalPaymentsNum = 0;
        if (paymentsLoadingMessage) paymentsLoadingMessage.style.display = 'block';
        if (paymentsListError) paymentsListError.style.display = 'none';
        if (paymentsTableBody) paymentsTableBody.innerHTML = ''; // Clear previous payments

        const paymentQuery = query(
            collection(db, "supplier_payments"),
            where("supplierId", "==", currentSupplierId),
            orderBy("paymentDate", "desc") // Show newest first
        );
        const paymentSnapshot = await getDocs(paymentQuery);
        console.log(`Found ${paymentSnapshot.size} payments for this supplier.`);

        if (paymentSnapshot.empty) {
            if (paymentsTableBody) paymentsTableBody.innerHTML = '<tr><td colspan="5">No payments recorded for this supplier.</td></tr>';
        } else {
            paymentSnapshot.forEach(doc => {
                const payment = doc.data();
                const paymentId = doc.id;
                displayPaymentMade(payment, paymentId);
                // Ensure paymentAmount is a number before adding
                 const amount = Number(payment.paymentAmount) || 0;
                 totalPaymentsNum += amount;
            });
        }
         if (paymentsLoadingMessage) paymentsLoadingMessage.style.display = 'none';

        // 4. Calculate and Display Account Summary
        const outstandingBalanceNum = totalPoValueNum - totalPaymentsNum;
        console.log("Calculated Summary:", { totalPO: totalPoValueNum, totalPaid: totalPaymentsNum, balance: outstandingBalanceNum });


        // --- GEMINI ADDED CODE START ---
        // Update the Account Summary UI elements with calculated values

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
        // --- GEMINI ADDED CODE END ---


    } catch (error) {
        console.error("Error loading supplier account data:", error);
        if (poListError) { poListError.textContent = `Error loading POs: ${error.message}`; poListError.style.display = 'block'; }
        if (paymentsListError) { paymentsListError.textContent = `Error loading Payments: ${error.message}`; paymentsListError.style.display = 'block'; }
        if (poLoadingMessage) poLoadingMessage.style.display = 'none';
        if (paymentsLoadingMessage) paymentsLoadingMessage.style.display = 'none';
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
    if (summaryTotalPoValue) summaryTotalPoValue.textContent = '₹0.00';
    if (summaryTotalPaymentsMade) summaryTotalPaymentsMade.textContent = '₹0.00';
    if (summaryOutstandingBalance) summaryOutstandingBalance.textContent = '₹0.00';

    // Clear tables and show loading
    if (poTableBody) poTableBody.innerHTML = '';
    if (paymentsTableBody) paymentsTableBody.innerHTML = '';
    if (poLoadingMessage) poLoadingMessage.style.display = 'block';
    if (paymentsLoadingMessage) paymentsLoadingMessage.style.display = 'block';
    if (poListError) poListError.style.display = 'none';
    if (paymentsListError) paymentsListError.style.display = 'none';
}

// --- Display Supplier Details ---
function displaySupplierDetails(data) {
    if (!data) return;
    const name = data.name || 'N/A';
    if (supplierNameHeader) supplierNameHeader.textContent = `Account: ${name}`;
    if (supplierNameBreadcrumb) supplierNameBreadcrumb.textContent = name;
    if (detailSupplierId) detailSupplierId.textContent = currentSupplierId || 'N/A'; // Display the actual ID
    if (detailSupplierName) detailSupplierName.textContent = name;
    if (detailSupplierCompany) detailSupplierCompany.textContent = data.company || '-';
    if (detailSupplierWhatsapp) {
        detailSupplierWhatsapp.innerHTML = data.whatsapp ? `<a href="https://wa.me/${data.whatsapp.replace(/\D/g, '')}" target="_blank">${data.whatsapp} <i class="fab fa-whatsapp"></i></a>` : '-';
    }
    if (detailSupplierEmail) {
         detailSupplierEmail.innerHTML = data.email ? `<a href="mailto:${data.email}">${data.email}</a>` : '-';
    }
    if (detailSupplierGst) detailSupplierGst.textContent = data.gstNo || '-';
    if (detailSupplierAddress) detailSupplierAddress.textContent = data.address || '-';

    // Update payment modal name as well
    if(paymentModalSupplierName) paymentModalSupplierName.textContent = name;
}

// --- Display Purchase Order Row ---
function displayPurchaseOrder(po, id) {
    if (!poTableBody || !po) return;

    const row = poTableBody.insertRow();
    row.setAttribute('data-id', id); // Add ID for potential future actions

    const orderDate = po.orderDate instanceof Timestamp ? po.orderDate.toDate() : (po.orderDate ? new Date(po.orderDate) : null);
    const formattedDate = orderDate ? orderDate.toLocaleDateString('en-IN') : 'Invalid Date';
    const formattedAmount = `₹${(Number(po.totalAmount) || 0).toFixed(2)}`;
    const status = po.status || 'Unknown';
    const paymentStatus = po.paymentStatus || 'Pending'; // Assume default if missing

    row.innerHTML = `
        <td>${po.poNumber || id.substring(0, 6)}</td>
        <td>${formattedDate}</td>
        <td style="text-align: right;">${formattedAmount}</td>
        <td><span class="status-badge status-${status.toLowerCase().replace(/\s+/g, '-')}">${status}</span></td>
        <td><span class="status-badge payment-status-${paymentStatus.toLowerCase()}">${paymentStatus}</span></td>
    `;
}

// --- Display Payment Made Row ---
function displayPaymentMade(payment, id) {
    if (!paymentsTableBody || !payment) return;

    const row = paymentsTableBody.insertRow();
    row.setAttribute('data-id', id); // Add ID for potential future actions

    const paymentDate = payment.paymentDate instanceof Timestamp ? payment.paymentDate.toDate() : (payment.paymentDate ? new Date(payment.paymentDate) : null);
    const formattedDate = paymentDate ? paymentDate.toLocaleDateString('en-IN') : 'Invalid Date';
    const formattedAmount = `₹${(Number(payment.paymentAmount) || 0).toFixed(2)}`;
    const method = payment.paymentMethod || 'N/A';
    const notes = payment.notes || '-';

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
    if (addPaymentMadeBtn) {
        addPaymentMadeBtn.addEventListener('click', openAddPaymentModal);
    } else {
        console.warn("Add Payment button not found.");
    }

    if (editSupplierDetailsBtn) {
        editSupplierDetailsBtn.addEventListener('click', () => {
            // Redirect to the main supplier management page for editing
             // Pass the ID to prefill the edit form there
             window.location.href = `supplier_management.html?edit=${currentSupplierId}`;
             // alert("Edit Supplier functionality needs implementation.");
        });
    } else {
        console.warn("Edit Supplier Details button not found.");
    }

    // Payment Modal Listeners
    if (closePaymentModal) {
        closePaymentModal.addEventListener('click', closeAddPaymentModal);
    }
    if (cancelPaymentBtn) {
        cancelPaymentBtn.addEventListener('click', closeAddPaymentModal);
    }
    if (addPaymentModal) {
        // Close if clicked outside the modal content
        addPaymentModal.addEventListener('click', (event) => {
            if (event.target === addPaymentModal) {
                closeAddPaymentModal();
            }
        });
    }
     if (addPaymentForm) {
        addPaymentForm.addEventListener('submit', handleSavePayment);
    } else {
         console.warn("Add Payment form not found.");
     }
}

// --- Add Payment Modal Logic ---
function openAddPaymentModal() {
    if (!addPaymentModal) { console.error("Payment modal element not found."); return; }
    if (currentSupplierData && paymentModalSupplierName) {
         paymentModalSupplierName.textContent = currentSupplierData.name || 'Selected Supplier';
    } else if (paymentModalSupplierName) {
        paymentModalSupplierName.textContent = 'Supplier'; // Default if data not loaded yet
    }
    // Reset form fields
    if (addPaymentForm) addPaymentForm.reset();
    if (paymentDateInput) paymentDateInput.valueAsDate = new Date(); // Set to today
     if (paymentFormError) paymentFormError.style.display = 'none'; // Hide error message
    if(savePaymentBtn) { savePaymentBtn.disabled = false; savePaymentBtn.innerHTML = '<i class=\"fas fa-save\"></i> Save Payment'; } // Reset button state

    addPaymentModal.style.display = 'block';
    if(paymentAmountInput) paymentAmountInput.focus(); // Focus on amount field
}

function closeAddPaymentModal() {
    if (addPaymentModal) {
        addPaymentModal.style.display = 'none';
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
    const date = paymentDateInput.value;
    const method = paymentMethodSelect.value;
    const notes = paymentNotesInput ? paymentNotesInput.value.trim() : ''; // Get notes safely

    // Basic Validation
    if (isNaN(amount) || amount <= 0) { showPaymentFormError("Please enter a valid payment amount."); paymentAmountInput.focus(); return; }
    if (!date) { showPaymentFormError("Please select a payment date."); paymentDateInput.focus(); return; }

    if(savePaymentBtn) {
        savePaymentBtn.disabled = true;
        savePaymentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }
    showPaymentFormError(''); // Clear previous errors

    try {
        // Convert date string to Firestore Timestamp (ensure time part is handled, e.g., start of day)
        // Important: Creating date like this uses local timezone. Consider UTC if needed.
        const paymentDateTimestamp = Timestamp.fromDate(new Date(date + 'T00:00:00'));

        const paymentData = {
            supplierId: currentSupplierId,
            supplierName: currentSupplierData?.name || null, // Include name if available
            paymentAmount: amount,
            paymentDate: paymentDateTimestamp,
            paymentMethod: method,
            notes: notes || null, // Store null if notes are empty
            createdAt: serverTimestamp() // Record when the payment was added
        };

        const docRef = await addDoc(collection(db, "supplier_payments"), paymentData);
        console.log("Payment recorded successfully: ID:", docRef.id);
        alert("Payment recorded successfully!");

        closeAddPaymentModal();
        await loadSupplierAccountData(db); // Reload all data including summary and lists

    } catch (error) {
        console.error("Error saving payment:", error);
        showPaymentFormError(`Error saving payment: ${error.message}`);
    } finally {
        if(savePaymentBtn) {
            savePaymentBtn.disabled = false;
            savePaymentBtn.innerHTML = '<i class=\"fas fa-save\"></i> Save Payment';
        }
    }
}

// --- Show Payment Form Error ---
function showPaymentFormError(message) {
    if (paymentFormError) {
        paymentFormError.textContent = message;
        paymentFormError.style.display = message ? 'block' : 'none';
    } else {
        // Fallback if error element doesn't exist
        if(message) alert(message);
    }
}


// --- Script Load Confirmation ---
console.log("supplier_account_detail.js loaded and running.");