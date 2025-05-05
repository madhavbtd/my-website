// js/supplier_account_detail.js - v4.1 (Step 2+3 Added: Buttons + Placeholders to Original File)

import { db, auth } from './firebase-init.js';
import {
    doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp,
    addDoc, serverTimestamp, updateDoc, runTransaction, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"; // Added signOut

// --- Global Variables ---
let currentSupplierId = null;
let currentSupplierData = null;
let purchaseOrdersData = [];
let supplierPaymentsData = [];
let listenersAttached = false;
let supplierDetailPageInitialized = false;
let initializationAttempted = false; // Original flag name
let unpaidPOs = []; // Store unpaid POs for payment modal

// --- Helper Functions (Using original formatting) ---
function displayError(message, elementId = 'generalErrorDisplay') {
    console.error("Displaying Error:", message, "on element:", elementId);
    try {
        // Try to find the specific element first
        let errorElement = document.getElementById(elementId);
        // Fallback to general if specific not found or ID is general
        if (!errorElement || elementId === 'generalErrorDisplay') {
             errorElement = document.getElementById('generalErrorDisplay');
        }

        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            // Ensure consistent error styling (can be refined in CSS)
            errorElement.style.color = 'red';
            errorElement.style.backgroundColor = '#f8d7da';
            errorElement.style.borderColor = '#f5c6cb';
            errorElement.style.padding = '10px';
            errorElement.style.borderRadius = '4px';
            errorElement.style.marginBottom = '15px';
            console.log(`Error displayed on #${errorElement.id}: ${message}`);
        } else {
            console.warn(`Error element ID '${elementId}' or fallback '#generalErrorDisplay' not found. Using alert.`);
            alert(`Error: ${message}`);
        }
    } catch (e) { console.error("Error within displayError:", e); alert(`Error: ${message}`); }
}
function clearError(elementId = 'generalErrorDisplay') {
    try {
         const idsToClear = elementId ? [elementId] : ['generalErrorDisplay', 'paymentMadeError', 'editSupplierError', 'supplierPoListError', 'supplierPaymentListError'];
         idsToClear.forEach(id => {
             const errorElement = document.getElementById(id);
             if (errorElement) { errorElement.textContent = ''; errorElement.style.display = 'none'; }
         });
    } catch(e) { console.error("Error within clearError:", e); }
}
function getSupplierIdFromUrl() {
    try { const params = new URLSearchParams(window.location.search); return params.get('id'); }
    catch (e) { console.error("Error getting supplier ID from URL:", e); return null; }
}
function formatDate(timestamp, includeTime = false) {
    // Checking if it's a Firestore timestamp object
    if (timestamp && typeof timestamp.toDate === 'function') {
        try {
            const date = timestamp.toDate();
            const optionsDate = { year: 'numeric', month: 'short', day: 'numeric' }; // e.g., 5 May 2025
            const optionsTime = { hour: 'numeric', minute: '2-digit', hour12: true };
            const formattedDate = date.toLocaleDateString('en-IN', optionsDate);
            if (includeTime) {
                return `${formattedDate}, ${date.toLocaleTimeString('en-IN', optionsTime)}`;
            }
            return formattedDate;
        } catch (e) { console.error("Error formatting Firestore Timestamp:", timestamp, e); return 'Invalid Date'; }
    }
    // Handling potential date strings or numbers (less common for Firestore dates)
    else if (timestamp) {
         try {
             // Attempt to create a Date object, works for ISO strings, milliseconds
             const date = new Date(timestamp);
             // Check if the date is valid after parsing
             if (isNaN(date.getTime())) {
                 console.warn("Input is not a valid date format:", timestamp);
                 return 'Invalid Input';
             }
             const optionsDate = { year: 'numeric', month: 'short', day: 'numeric' };
             const optionsTime = { hour: 'numeric', minute: '2-digit', hour12: true };
             const formattedDate = date.toLocaleDateString('en-IN', optionsDate);
             if (includeTime) {
                 return `${formattedDate}, ${date.toLocaleTimeString('en-IN', optionsTime)}`;
             }
             return formattedDate;
         } catch (e) { console.error("Error formatting date string/number:", timestamp, e); return 'Format Error'; }
    }
    return 'N/A'; // Return N/A if timestamp is null, undefined, or invalid
}

function formatCurrency(amount) {
    if (typeof amount !== 'number') { amount = parseFloat(amount); }
    if (isNaN(amount)) { return '₹ --.--'; } // Consistent placeholder for invalid numbers
    return `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function getStatusClass(status) { if (!status) return 'status-unknown'; return 'status-' + status.toLowerCase().replace(/\s+/g, '-'); }
function getPaymentStatusClass(status) { if (!status) return 'payment-status-pending'; return 'payment-status-' + status.toLowerCase().replace(/\s+/g, '-'); }

// --- UI Population Functions ---
function populateSupplierDetails(data) {
    // Using original element IDs from provided HTML
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
    const statusIndicator = document.getElementById('supplierStatusIndicator'); // For disabled status
    const toggleBtnTextSpan = document.getElementById('toggleStatusBtnText'); // For button text

    if (!data) { /* Maybe clear fields or show error */ return; }

    // Set global data
    currentSupplierData = data;

    if (header) header.textContent = data.name || 'Supplier Account';
    if (breadcrumb) breadcrumb.textContent = data.name || 'Details';
    if (idEl) idEl.textContent = data.id || 'N/A';
    if (nameEl) nameEl.textContent = data.name || 'N/A';
    if (companyEl) companyEl.textContent = data.companyName || 'N/A';
    if (whatsappEl) whatsappEl.textContent = data.whatsappNo || data.contact || 'N/A'; // Use contact if whatsapp missing
    if (emailEl) emailEl.textContent = data.email || 'N/A';
    if (gstEl) gstEl.textContent = data.gstNo || 'N/A';
    if (addressEl) addressEl.textContent = data.address || 'N/A';
    if (addedOnEl) addedOnEl.textContent = data.createdAt ? formatDate(data.createdAt) : 'N/A';

    // Update Status Indicator and Toggle Button Text (Step 3 Integration)
    if (statusIndicator) {
        if (data.status === 'disabled') {
            statusIndicator.textContent = '(Disabled)';
            statusIndicator.className = 'supplier-status-indicator status-disabled';
        } else {
            statusIndicator.textContent = ''; // Clear text if active
            statusIndicator.className = 'supplier-status-indicator status-active';
        }
    } else { console.warn("Supplier Status Indicator element (#supplierStatusIndicator) not found."); }

    if (toggleBtnTextSpan) {
        toggleBtnTextSpan.textContent = (data.status === 'disabled') ? 'Enable' : 'Disable';
    } else { console.warn("Toggle Status Button Text Span (#toggleStatusBtnText) not found."); }

}

function populatePaymentHistory(payments) {
    const tableBody = document.getElementById('transactionsTableBody'); // Original ID
    const loadingRow = document.getElementById('transactionsLoading'); // Original ID
    const noDataRow = document.getElementById('noTransactionsMessage'); // Original ID
    const countSpan = document.getElementById('paymentCount'); // Assumed ID for count

    if (!tableBody) { console.error("Payment table body (#transactionsTableBody) not found!"); return; }

    tableBody.innerHTML = ''; // Clear previous rows
    if (loadingRow) loadingRow.style.display = 'none';
    if (noDataRow) noDataRow.style.display = 'none'; // Hide no data message initially

    if (!payments || payments.length === 0) {
        if (noDataRow) noDataRow.style.display = 'table-row';
        else tableBody.innerHTML = '<tr><td colspan="6">No payment history found.</td></tr>'; // Fallback if no data row element exists
        if(countSpan) countSpan.textContent = '0'; // Update count
        return;
    }

    if(countSpan) countSpan.textContent = payments.length; // Update count

    // Sort by date descending (most recent first)
    payments.sort((a, b) => (b.paymentDate?.toDate?.() || 0) - (a.paymentDate?.toDate?.() || 0));

    payments.forEach((payment) => {
        try {
            const row = tableBody.insertRow();
            const paymentType = payment.type || 'payment'; // Handle adjustments later
            const dateField = payment.paymentDate || payment.adjustmentDate || payment.createdAt; // Find best date
            const amountField = payment.paymentAmount || payment.amount || payment.adjustmentAmount; // Find best amount
            const modeField = payment.paymentMethod || (paymentType === 'adjustment' ? payment.adjustmentType || 'N/A' : 'N/A');
            const notesField = payment.notes || payment.reason || '-';

            row.insertCell().textContent = formatDate(dateField); // Keep only date for history table
            row.insertCell().textContent = formatCurrency(amountField);
            row.insertCell().textContent = modeField;

            // Linked POs - Keep original logic for now
            let linkedPoDisplay = '-';
            if (Array.isArray(payment.linkedPoNumbers) && payment.linkedPoNumbers.length > 0) {
                linkedPoDisplay = payment.linkedPoNumbers.join(', ');
            } else if (payment.linkedPoNumber) { // Fallback for older single link
                linkedPoDisplay = payment.linkedPoNumber;
            }
            row.insertCell().textContent = linkedPoDisplay;
            row.insertCell().textContent = notesField;

             // Actions Cell (placeholder)
            const actionCell = row.insertCell();
            actionCell.innerHTML = `<button class="button small-button danger-button delete-payment-button" onclick="alert('Delete functionality not implemented yet (ID: ${payment.id})')" title="Delete"><i class="fas fa-trash"></i></button>`;

        } catch(e) {
            console.error(`Error creating payment row:`, payment, e);
            // Optionally insert an error row
            const errorRow = tableBody.insertRow();
            const errorCell = errorRow.insertCell();
            errorCell.colSpan = 6;
            errorCell.textContent = "Error displaying this entry.";
            errorCell.style.color = "red";
        }
    });
}


function populatePoHistoryTable(pos) {
    const tableBody = document.getElementById('supplierPoTableBody'); // Original ID
    const loadingRow = document.getElementById('supplierPoLoading'); // Original ID
    const noDataRow = document.getElementById('noSupplierPoMessage'); // Original ID
    const countSpan = document.getElementById('poCount'); // Assumed ID for count

    if (!tableBody) { console.error("PO table body (#supplierPoTableBody) not found!"); return; }

    tableBody.innerHTML = ''; // Clear previous rows
    if (loadingRow) loadingRow.style.display = 'none';
    if (noDataRow) noDataRow.style.display = 'none'; // Hide no data message initially

    if (!pos || pos.length === 0) {
        if (noDataRow) noDataRow.style.display = 'table-row';
        else tableBody.innerHTML = '<tr><td colspan="6">No purchase orders found.</td></tr>'; // Fallback
        if(countSpan) countSpan.textContent = '0'; // Update count
        unpaidPOs = []; // Reset unpaid POs
        return;
    }

    if(countSpan) countSpan.textContent = pos.length; // Update count

    // Sort by date descending (most recent first)
    pos.sort((a, b) => (b.orderDate?.toDate?.() || b.createdAt?.toDate?.() || 0) - (a.orderDate?.toDate?.() || a.createdAt?.toDate?.() || 0));

    pos.forEach((po) => {
        try {
            const row = tableBody.insertRow();
            row.insertCell().textContent = po.poNumber || `PO-${po.id.substring(0, 6)}`;
            row.insertCell().textContent = formatDate(po.orderDate || po.createdAt); // Use createdAt as fallback
            const amountCell = row.insertCell();
            amountCell.textContent = formatCurrency(po.totalAmount);
            amountCell.classList.add('amount-po');

            const statusCell = row.insertCell();
            const statusSpan = document.createElement('span');
            statusSpan.className = `status-badge ${getStatusClass(po.status)}`;
            statusSpan.textContent = po.status || 'Unknown';
            statusCell.appendChild(statusSpan);

            const paymentStatusCell = row.insertCell();
            const paymentStatusSpan = document.createElement('span');
            paymentStatusSpan.className = `status-badge ${getPaymentStatusClass(po.paymentStatus)}`; // Use payment status specific class
            paymentStatusSpan.textContent = po.paymentStatus || 'Pending';
            paymentStatusCell.appendChild(paymentStatusSpan);

            // Actions cell (Placeholder for Edit button)
            const actionCell = row.insertCell();
             actionCell.innerHTML = `<button class="button small-button edit-po-button" onclick="alert('PO Edit functionality not implemented yet (PO ID: ${po.id})')" title="Edit PO"><i class="fas fa-edit"></i></button>`;

        } catch (e) {
            console.error(`Error creating PO row:`, po, e);
             const errorRow = tableBody.insertRow();
             const errorCell = errorRow.insertCell();
             errorCell.colSpan = 6;
             errorCell.textContent = "Error displaying this PO.";
             errorCell.style.color = "red";
        }
    });

     // Update unpaid POs cache after rendering
     unpaidPOs = pos.filter(po => po.paymentStatus !== 'paid' && po.paymentStatus !== 'Paid'); // Ensure case-insensitivity if needed
     console.log("Unpaid POs updated:", unpaidPOs.length);
}


function updateAccountSummary(poTotal, paymentTotal, adjustmentTotal = 0) { // Added adjustmentTotal
    const poDisplay = document.getElementById('summaryTotalPoValue');
    const paidDisplay = document.getElementById('summaryTotalPaid');
    const adjustmentDisplay = document.getElementById('summaryTotalAdjustmentAmount'); // New element ID needed in HTML
    const balanceDisplay = document.getElementById('summaryBalance');

    if (!poDisplay || !paidDisplay || !balanceDisplay || !adjustmentDisplay) {
        console.error("Summary elements missing (ensure #summaryTotalAdjustmentAmount exists)"); return;
    }

    const numPoTotal = parseFloat(poTotal) || 0;
    const numPaymentTotal = parseFloat(paymentTotal) || 0;
    const numAdjustmentTotal = parseFloat(adjustmentTotal) || 0; // Get adjustment total

    // Balance Calculation: PO Value (Liability) - Payments (Asset) - Adjustments (Debit+, Credit-)
    // Assuming Debit Adjustment reduces amount we owe (like a payment, positive value in calculation)
    // Assuming Credit Adjustment increases amount we owe (like negative payment, negative value in calculation)
    // Simplified: Balance = numPoTotal - numPaymentTotal - numAdjustmentTotal
    const outstanding = numPoTotal - numPaymentTotal - numAdjustmentTotal;

    poDisplay.textContent = formatCurrency(numPoTotal);
    paidDisplay.textContent = formatCurrency(numPaymentTotal);
    adjustmentDisplay.textContent = formatCurrency(numAdjustmentTotal); // Display adjustments
    balanceDisplay.textContent = formatCurrency(outstanding);

    // Remove loading state (assuming class 'loading-state' exists)
    poDisplay.classList.remove('loading-state');
    paidDisplay.classList.remove('loading-state');
    adjustmentDisplay.classList.remove('loading-state');
    balanceDisplay.classList.remove('loading-state');


    balanceDisplay.className = 'balance-info'; // Reset classes
    if (outstanding > 0.01) {
        balanceDisplay.classList.add('balance-due'); // Supplier owes us, or we paid extra? Check definition. Assuming DUE means WE OWE. So should be negative?
        // Let's redefine: Balance = Paid + Adjustments - PO Amount (Our perspective: how much we paid vs value received)
         const perspectiveBalance = numPaymentTotal + numAdjustmentTotal - numPoTotal;
         balanceDisplay.textContent = formatCurrency(perspectiveBalance);
         if (perspectiveBalance > 0.01) balanceDisplay.classList.add('balance-credit'); // We paid more / Advance
         else if (perspectiveBalance < -0.01) balanceDisplay.classList.add('balance-due'); // We owe
         else balanceDisplay.classList.add('balance-zero');

    } else if (outstanding < -0.01) {
        balanceDisplay.classList.add('balance-credit'); // We owe supplier, or they gave credit? Check definition.
    } else {
        balanceDisplay.classList.add('balance-zero');
    }

     // Corrected logic for balance display:
     const finalBalance = numPaymentTotal + numAdjustmentTotal - numPoTotal; // Positive = Advance/Credit, Negative = Due
     balanceDisplay.textContent = formatCurrency(finalBalance);
     balanceDisplay.className = 'balance-info'; // Reset classes
     if (finalBalance > 0.01) balanceDisplay.classList.add('balance-credit');
     else if (finalBalance < -0.01) balanceDisplay.classList.add('balance-due');
     else balanceDisplay.classList.add('balance-zero');
}


// Populate Checkbox List for Payment Modal (From original v4 JS)
function populatePoCheckboxListForPayment(pos) {
    const listContainer = document.getElementById('paymentLinkPOList'); // Check if ID exists in original HTML
    if (!listContainer) {
        console.warn("PO Checkbox list container (#paymentLinkPOList) not found in HTML! Check ID.");
        // Attempt to find the original dropdown and replace? Or just log error.
        const dropdown = document.getElementById('paymentLinkPOSelect'); // Original dropdown ID?
        if (dropdown) {
            dropdown.innerHTML = '<option value="">Error: Checkbox area missing</option>';
        }
        return;
    }
    listContainer.innerHTML = ''; // Clear previous items

    if (!pos || pos.length === 0) {
        listContainer.innerHTML = '<p class="no-items-message">No POs found for this supplier.</p>';
        return;
    }

    // Filter for POs that are not fully paid (or where paymentStatus isn't 'Paid')
    const openPOs = pos.filter(po => po.paymentStatus !== 'Paid'); // Case-sensitive

    if (openPOs.length === 0) {
        listContainer.innerHTML = '<p class="no-items-message">No open POs found (all seem paid).</p>';
        return;
    }

    openPOs.sort((a, b) => (b.orderDate?.toDate?.() || 0) - (a.orderDate?.toDate?.() || 0));

    openPOs.forEach((po, index) => {
        const total = parseFloat(po.totalAmount) || 0;
        const paid = parseFloat(po.amountPaid) || 0; // Assuming 'amountPaid' field exists on PO
        const balance = total - paid;

        const div = document.createElement('div');
        div.className = 'po-checkbox-item'; // Use this class for styling

        const checkboxId = `po_link_${po.id}`; // Use PO ID for unique checkbox ID
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = checkboxId;
        checkbox.name = 'linkedPOs'; // Group checkboxes
        checkbox.value = po.id;
        checkbox.dataset.poNumber = po.poNumber || ''; // Store PO number
        checkbox.dataset.poBalance = balance.toFixed(2); // Store balance

        const label = document.createElement('label');
        label.htmlFor = checkboxId;
        label.innerHTML = `
            <span class="po-number">${po.poNumber || po.id.substring(0, 6)}</span>
            <span class="po-date">(${formatDate(po.orderDate)})</span>
            <span class="po-balance">Balance: ${formatCurrency(balance)}</span>
        `;

        div.appendChild(checkbox);
        div.appendChild(label);
        listContainer.appendChild(div);
    });
}


// --- Core Data Loading ---
async function loadSupplierAccountData() {
     currentSupplierId = getSupplierIdFromUrl();
     if (!currentSupplierId) { displayError("Supplier ID missing from URL."); return; }
     if (!db) { displayError("Database connection failed."); return; }

     const loadingIndicator = document.getElementById('loadingIndicator');
     if (loadingIndicator) loadingIndicator.style.display = 'block';
     clearError(); // Clear previous errors

     let supplierData = null;
     let payments = [];
     let purchaseOrders = [];
     let paymentSum = 0;
     let poSum = 0;
     let adjustmentSum = 0; // Initialize adjustment sum

     try {
         // Fetch supplier details
         const supplierRef = doc(db, "suppliers", currentSupplierId);
         const supplierSnap = await getDoc(supplierRef);
         if (!supplierSnap.exists()) throw new Error("Supplier not found");
         supplierData = { id: supplierSnap.id, ...supplierSnap.data() };
         populateSupplierDetails(supplierData); // Populate UI

         // Fetch payments/adjustments and POs in parallel
         const [paymentsSnapshot, poSnapshot] = await Promise.all([
             getDocs(query(collection(db, "payments"), where("supplierId", "==", currentSupplierId))), // Using 'payments' collection for both now
             getDocs(query(collection(db, "purchaseOrders"), where("supplierId", "==", currentSupplierId)))
         ]);

         // Process Payments and Adjustments
         payments = paymentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
         supplierPaymentsData = payments; // Store globally
         paymentSum = payments.filter(p => p.type === 'payment').reduce((sum, p) => sum + (parseFloat(p.amount || p.paymentAmount) || 0), 0);
         adjustmentSum = payments.filter(p => p.type === 'adjustment').reduce((sum, p) => sum + (parseFloat(p.amount || p.adjustmentAmount) || 0), 0); // Sum adjustments (sign might be handled later)
         populatePaymentHistory(payments); // Populate combined history table

         // Process Purchase Orders
         purchaseOrders = poSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
         purchaseOrdersData = purchaseOrders; // Store globally
         poSum = purchaseOrders.reduce((sum, po) => sum + (parseFloat(po.totalAmount) || 0), 0);
         populatePoHistoryTable(purchaseOrders); // Populate PO table

         // Update Account Summary including adjustments
         updateAccountSummary(poSum, paymentSum, adjustmentSum);

         // Attach event listeners ONLY after the first successful load
         if (!listenersAttached) {
             setupEventListeners(); // Use original setup function name
         }

     } catch (error) {
         console.error("Error loading supplier account data:", error);
         displayError(`Error loading data: ${error.message}.`);
         // Clear UI or show error states
         if (!supplierData) populateSupplierDetails(null); // Clear supplier details if fetch failed
         populatePaymentHistory([]);
         populatePoHistoryTable([]);
         updateAccountSummary(0, 0, 0);
     } finally {
         if (loadingIndicator) loadingIndicator.style.display = 'none';
     }
}

// --- Modal Functions & Handlers (Using original function names/structure) ---

// Add Payment Modal
function openPaymentModal(){
    if (!currentSupplierData) { alert("Supplier data not loaded yet."); return; }
    const modal = document.getElementById('paymentMadeModal'); // Original ID
    const form = document.getElementById('paymentMadeForm'); // Original ID
    const supplierNameSpan = document.getElementById('paymentSupplierName'); // Original ID
    const dateInput = document.getElementById('paymentDate'); // Original ID
    const poListContainer = document.getElementById('paymentLinkPOList'); // Needs this div in HTML now

    if (!modal || !form || !supplierNameSpan || !dateInput || !poListContainer) {
        console.error("Payment modal elements missing (check IDs: paymentMadeModal, paymentMadeForm, paymentSupplierName, paymentDate, paymentLinkPOList).");
        alert("Cannot open payment form.");
        return;
    }
    clearError('paymentMadeError');
    form.reset();
    supplierNameSpan.textContent = currentSupplierData.name || 'Supplier';
    try { dateInput.valueAsDate = new Date(); } catch(e) { dateInput.value = new Date().toISOString().slice(0,10); } // Set default date

    // Populate Checkbox list instead of dropdown
    populatePoCheckboxListForPayment(purchaseOrdersData); // Uses global PO data

    modal.style.display = 'flex';
}
function closePaymentModal(){
    const modal = document.getElementById('paymentMadeModal'); // Original ID
    if(modal) modal.style.display = 'none';
}

// Save Payment Handler (Using original function name/structure, adapted for checkboxes)
async function handleSavePayment(event) {
    event.preventDefault();
    if (!currentSupplierId || !db || !addDoc || !collection || !serverTimestamp || !writeBatch || !doc || !updateDoc) {
        displayError("Cannot save payment. DB connection or Supplier ID missing.", "paymentMadeError"); return;
    }

    // Using original IDs from the payment modal
    const amountInput = document.getElementById('paymentAmount');
    const dateInput = document.getElementById('paymentDate');
    const methodInput = document.getElementById('paymentMethod');
    const notesInput = document.getElementById('paymentNotes');
    const poListContainer = document.getElementById('paymentLinkPOList'); // Container for checkboxes
    const saveBtn = document.getElementById('savePaymentBtn'); // Save button ID

    if (!amountInput || !dateInput || !methodInput || !notesInput || !poListContainer || !saveBtn) {
        displayError("Payment form elements missing (check IDs like paymentAmount, paymentDate etc.).", "paymentMadeError"); return;
    }

    const amount = parseFloat(amountInput.value);
    const paymentDateStr = dateInput.value;
    const method = methodInput.value;
    const notes = notesInput.value.trim();

    if (isNaN(amount) || amount <= 0) { displayError("Please enter a valid payment amount.", "paymentMadeError"); amountInput.focus(); return; }
    if (!paymentDateStr) { displayError("Please select a payment date.", "paymentMadeError"); dateInput.focus(); return; }

    // Get selected POs from checkboxes
    const selectedCheckboxes = poListContainer.querySelectorAll('input[type="checkbox"]:checked'); // Changed selector
    const linkedPoIds = Array.from(selectedCheckboxes).map(cb => cb.value);
    const linkedPoNumbers = Array.from(selectedCheckboxes).map(cb => cb.dataset.poNumber || cb.value.substring(0,6)); // Get numbers

    saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; clearError('paymentMadeError');

    try {
        const paymentDate = Timestamp.fromDate(new Date(paymentDateStr + 'T00:00:00')); // Ensure consistent time
        const paymentData = {
            supplierId: currentSupplierId,
            supplierName: currentSupplierData?.name || 'N/A', // Add supplier name for easier querying/display
            amount: amount, // Changed field name to 'amount' for consistency with adjustments? Or use paymentAmount? Using 'amount'.
            paymentDate: paymentDate,
            paymentMethod: method, // Keeping original field name
            notes: notes,
            linkedPoIds: linkedPoIds || [], // Store array of IDs
            linkedPoNumbers: linkedPoNumbers || [], // Store array of Numbers for display convenience
            type: 'payment', // Explicitly mark as payment
            createdAt: serverTimestamp()
        };

        // **Important:** Use a transaction or batch write to update PO paymentStatus
        const batch = writeBatch(db);

        // 1. Add the payment document
        const paymentRef = doc(collection(db, "payments")); // Changed collection to 'payments'
        batch.set(paymentRef, paymentData); // Add payment to batch

        // 2. Update paymentStatus and amountPaid for linked POs
        // This part requires POs to have 'amountPaid' field. Add if missing.
        const poUpdatePromises = linkedPoIds.map(async (poId) => {
            const poRef = doc(db, "purchaseOrders", poId);
            try {
                const poDoc = await getDoc(poRef); // Get current PO data
                if (poDoc.exists()) {
                    const poData = poDoc.data();
                    const currentAmountPaid = Number(poData.amountPaid) || 0;
                    const totalAmount = Number(poData.totalAmount) || 0;
                    // Distribute payment amount? For now, assume full payment applied to status check
                    // More complex logic needed for partial payments across multiple POs
                    const newAmountPaid = currentAmountPaid + amount; // Overly simple - Needs refinement
                    let newPaymentStatus = poData.paymentStatus;

                    // Basic status update logic (Needs significant refinement for multi-PO links)
                    if (newAmountPaid >= totalAmount) newPaymentStatus = 'Paid'; // Changed to 'Paid'
                    else if (newAmountPaid > 0) newPaymentStatus = 'Partially Paid'; // Changed to 'Partially Paid'
                    else newPaymentStatus = 'Pending'; // Original status? Or 'Unpaid'? Using 'Pending' as per original CSS

                    batch.update(poRef, {
                        // amountPaid: newAmountPaid, // Update amount paid on PO (Needs field)
                        paymentStatus: newPaymentStatus
                    });
                    console.log(`PO ${poId} added to batch update: paymentStatus=${newPaymentStatus}`);
                } else { console.warn(`PO with ID ${poId} not found for updating payment status.`); }
            } catch(poError){ console.error(`Error processing PO ${poId} for payment linking:`, poError); }
        });

        await Promise.all(poUpdatePromises); // Wait for checks before commit

        // 3. Commit the batch
        await batch.commit();
        console.log("Payment added and POs updated (basic status) via batch write.");

        closePaymentModal(); // Use original function name
        await loadSupplierPayments(); // Reload payments
        await loadPurchaseOrders(); // Reload POs
        calculateAndDisplayBalance(); // Recalculate
        alert("Payment recorded successfully!");

    } catch (error) { console.error("Error saving payment:", error); displayError(`Failed to save payment: ${error.message}`, "paymentMadeError"); }
    finally { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Payment'; }
}


// Edit Supplier Modal (Using original function names/structure)
function openEditSupplierModal(){
    const modal = document.getElementById('editSupplierModal'); // Original ID
    const form = document.getElementById('editSupplierForm'); // Original ID
    const nameInput = document.getElementById('editSupplierNameInput');
    const companyInput = document.getElementById('editSupplierCompanyInput');
    const whatsappInput = document.getElementById('editSupplierWhatsappInput');
    const contactInput = document.getElementById('editSupplierContactInput'); // Assumed ID
    const emailInput = document.getElementById('editSupplierEmailInput');
    const gstInput = document.getElementById('editSupplierGstInput');
    const addressInput = document.getElementById('editSupplierAddressInput');
    const hiddenIdInput = document.getElementById('editingSupplierId'); // Original ID

    if(!modal || !form || !nameInput || !hiddenIdInput || !currentSupplierData) {
        console.error("Edit supplier modal elements or supplier data missing.");
        alert("Could not open edit form."); return;
    }
    clearError('editSupplierError');
    form.reset();
    hiddenIdInput.value = currentSupplierId;
    nameInput.value = currentSupplierData.name || '';
    if(companyInput) companyInput.value = currentSupplierData.companyName || '';
    if(whatsappInput) whatsappInput.value = currentSupplierData.whatsappNo || '';
    if(contactInput) contactInput.value = currentSupplierData.contact || currentSupplierData.contactNo || ''; // Check both field names
    if(emailInput) emailInput.value = currentSupplierData.email || '';
    if(gstInput) gstInput.value = currentSupplierData.gstNo || '';
    if(addressInput) addressInput.value = currentSupplierData.address || '';
    modal.style.display = 'flex';
}
function closeEditSupplierModal(){
    const modal = document.getElementById('editSupplierModal'); // Original ID
    if(modal) modal.style.display = 'none';
}
async function handleEditSupplierSubmit(event){
    event.preventDefault();
    if (!currentSupplierId || !db || !doc || !updateDoc || !serverTimestamp) { displayError("Cannot update supplier. DB connection or Supplier ID missing.", "editSupplierError"); return; }
    const form = event.target;
    const saveBtn = document.getElementById('updateSupplierBtn'); // Original ID
    if(!form || !saveBtn) { displayError("Edit form or save button not found.", "editSupplierError"); return; }

    const updatedData = {
         name: form.querySelector('#editSupplierNameInput')?.value.trim(),
         name_lowercase: form.querySelector('#editSupplierNameInput')?.value.trim().toLowerCase(), // Add lowercase for sorting/searching
         companyName: form.querySelector('#editSupplierCompanyInput')?.value.trim(),
         whatsappNo: form.querySelector('#editSupplierWhatsappInput')?.value.trim(),
         contactNo: form.querySelector('#editSupplierContactInput')?.value.trim(), // Match ID used
         email: form.querySelector('#editSupplierEmailInput')?.value.trim(),
         gstNo: form.querySelector('#editSupplierGstInput')?.value.trim(),
         address: form.querySelector('#editSupplierAddressInput')?.value.trim(),
         updatedAt: serverTimestamp()
    };
    if (!updatedData.name) { displayError("Supplier Name is required.", "editSupplierError"); return; }

    saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; clearError('editSupplierError');
    try {
        const supplierRef = doc(db, "suppliers", currentSupplierId);
        await updateDoc(supplierRef, updatedData);
        // Update local data immediately for UI responsiveness
        currentSupplierData = { ...currentSupplierData, ...updatedData, updatedAt: Timestamp.now() }; // Use approximate timestamp
        populateSupplierDetails(currentSupplierData); // Update displayed details
        closeEditSupplierModal(); // Use original function name
        alert("Supplier details updated!");
    } catch(error) {
        console.error("Error updating supplier details:", error);
        displayError(`Failed to update details: ${error.message}`, "editSupplierError");
    }
    finally { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Update Supplier'; }
}


// --- Placeholder Functions for New Actions (Step 3) ---
function handleAddNewPo() {
    console.log("Add New PO button clicked - Placeholder");
    alert("Add New PO functionality not implemented yet. (Step 11)");
    // Later: window.location.href = `supplier_management.html?action=addPO&supplierId=${currentSupplierId}`;
}

function handleToggleSupplierStatus() {
    console.log("Toggle Supplier Status button clicked - Placeholder");
    if (!currentSupplierData) {
         alert("Cannot toggle status: Supplier data not loaded.");
         return;
    }
    const currentStatus = currentSupplierData.status === 'disabled' ? 'disabled' : 'active';
    const action = currentStatus === 'active' ? 'Disable' : 'Enable';
    alert(`${action} Supplier functionality not implemented yet. (Step 10)`);
    // Later: Add confirmation and Firebase update logic.
}

function handleDeleteSupplier() {
    console.log("Delete Supplier button clicked - Placeholder");
     if (!currentSupplierData) {
         alert("Cannot delete: Supplier data not loaded.");
         return;
    }
    alert("Delete Supplier functionality not implemented yet. Be careful! (Step 14)");
    // Later: Add strong confirmation and Firebase delete logic.
}

// Placeholder for Add Adjustment (will be used to open modal later in Step 5)
function handleAddAdjustmentClick() {
     console.log("Add Adjustment button clicked - Placeholder (will open modal later)");
     alert("Add Adjustment modal not implemented yet. (Step 4/5)");
     // Later: openModal('adjustmentModal'); // Need adjustmentModal first
}

// --- Event Listeners Setup (Using original function name) ---
function setupEventListeners() {
    if (listenersAttached) { console.log("Listeners already attached."); return; }
    console.log("Attaching event listeners...");

    // --- Existing Listeners (Using Original IDs) ---
    const addPayBtn = document.getElementById('addPaymentMadeBtn'); // Original ID
    if (addPayBtn) addPayBtn.addEventListener('click', openPaymentModal); else console.warn("Add Payment Btn (#addPaymentMadeBtn) not found");

    const closeBtnPay = document.getElementById('closePaymentMadeModalBtn'); // Original ID
    if (closeBtnPay) closeBtnPay.addEventListener('click', closePaymentModal); else console.warn("Close Payment Modal Btn (#closePaymentMadeModalBtn) not found");

    const cancelBtnPay = document.getElementById('cancelPaymentBtn'); // Original ID
    if (cancelBtnPay) cancelBtnPay.addEventListener('click', closePaymentModal); else console.warn("Cancel Payment Btn (#cancelPaymentBtn) not found");

    const payModal = document.getElementById('paymentMadeModal'); // Original ID
    if (payModal) payModal.addEventListener('click', (event) => { if (event.target === payModal) closePaymentModal(); }); else console.warn("Payment Modal (#paymentMadeModal) not found");

    const payForm = document.getElementById('paymentMadeForm'); // Original ID
    if (payForm) payForm.addEventListener('submit', handleSavePayment); else console.warn("Payment Form (#paymentMadeForm) not found");

    const editBtn = document.getElementById('editSupplierDetailsBtn'); // Original ID
    if (editBtn) editBtn.addEventListener('click', openEditSupplierModal); else console.warn("Edit Supplier Btn (#editSupplierDetailsBtn) not found");

    const closeEditBtn = document.getElementById('closeEditSupplierBtn'); // Original ID
    if (closeEditBtn) closeEditBtn.addEventListener('click', closeEditSupplierModal); else console.warn("Close Edit Supplier Btn (#closeEditSupplierBtn) not found");

    const cancelEditBtn = document.getElementById('cancelEditSupplierBtn'); // Original ID
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditSupplierModal); else console.warn("Cancel Edit Supplier Btn (#cancelEditSupplierBtn) not found");

    const editModal = document.getElementById('editSupplierModal'); // Original ID
    if (editModal) editModal.addEventListener('click', (event) => { if (event.target === editModal) closeEditSupplierModal(); }); else console.warn("Edit Supplier Modal (#editSupplierModal) not found");

    const editForm = document.getElementById('editSupplierForm'); // Original ID
    if (editForm) editForm.addEventListener('submit', handleEditSupplierSubmit); else console.warn("Edit Supplier Form (#editSupplierForm) not found");

    // Logout Button (Assuming ID 'logoutBtn' exists in header)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
         logoutBtn.style.display = 'inline-block'; // Make sure it's visible
         logoutBtn.addEventListener('click', () => {
             signOut(auth).then(() => {
                 console.log("User signed out");
                 window.location.href = 'index.html'; // Redirect to login/index
             }).catch((error) => {
                 console.error("Sign out error:", error);
                 alert("Error signing out.");
             });
         });
    } else {
        console.warn("Logout button (#logoutBtn) not found.");
    }


    // --- Add listeners for new buttons (Step 3) ---
    const addNewPoBtn = document.getElementById('addNewPoBtn');
    if (addNewPoBtn) {
        addNewPoBtn.addEventListener('click', handleAddNewPo);
    } else {
        console.warn("Add New PO button (#addNewPoBtn) not found in DOM");
    }

    const addAdjustmentBtn = document.getElementById('addAdjustmentBtn');
    if (addAdjustmentBtn) {
        addAdjustmentBtn.addEventListener('click', handleAddAdjustmentClick); // Connects to the placeholder
    } else {
        console.warn("Add Adjustment button (#addAdjustmentBtn) not found in DOM");
    }

    const toggleSupplierStatusBtn = document.getElementById('toggleSupplierStatusBtn');
    if (toggleSupplierStatusBtn) {
        toggleSupplierStatusBtn.addEventListener('click', handleToggleSupplierStatus);
    } else {
        console.warn("Toggle Supplier Status button (#toggleSupplierStatusBtn) not found in DOM");
    }

    const deleteSupplierBtn = document.getElementById('deleteSupplierBtn');
    if (deleteSupplierBtn) {
        deleteSupplierBtn.addEventListener('click', handleDeleteSupplier);
    } else {
        console.warn("Delete Supplier button (#deleteSupplierBtn) not found in DOM");
    }
    // --- End new button listeners ---


    listenersAttached = true;
    console.log("Event listeners attached.");
}

// --- Global Initialization & Auto-run (Using original structure) ---
function attemptInitialization() {
    // Removed initializationAttempted flag logic if it causes issues, rely on supplierDetailPageInitialized
    if (supplierDetailPageInitialized) return;
    console.log("DOM Loaded, attempting initialization...");
    if (typeof window.initializeSupplierDetailPage === 'function') {
        window.initializeSupplierDetailPage();
    } else {
        console.error("Initialization function 'initializeSupplierDetailPage' not found on window.");
         // Fallback or error display if function never gets defined
         displayError("Page failed to initialize correctly.");
         const loadingIndicator = document.getElementById('loadingIndicator');
         if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

window.initializeSupplierDetailPage = async () => {
     if (supplierDetailPageInitialized) {
          console.log("Supplier Detail Page already initialized.");
          return;
     }
     supplierDetailPageInitialized = true; // Set flag early
     console.log("Running initializeSupplierDetailPage...");
     clearError(); // Clear errors on init

     const mainContent = document.getElementById('detailMainContent');
     if (!mainContent) {
          console.error("CRITICAL: Main content area (#detailMainContent) missing! Cannot proceed.");
          return; // Stop if layout is fundamentally broken
     }
     // Content visibility managed in loadSupplierAccountData finally block

     if (typeof db === 'undefined' || !db || typeof auth === 'undefined' || !auth) {
         console.error("Firestore db or Auth instance is not available!");
         displayError("Database or Auth connection failed. Please refresh.");
         const loadingIndicator = document.getElementById('loadingIndicator');
         if (loadingIndicator) loadingIndicator.style.display = 'none'; // Hide loading on critical error
         if (mainContent) mainContent.style.visibility = 'visible'; // Show content to display error
         return;
     }

     // Authentication Check within initialize
     onAuthStateChanged(auth, async (user) => {
         if (user) {
             console.log("User authenticated:", user.email);
             const userEmailDisplay = document.getElementById('userEmailDisplay');
             if(userEmailDisplay) userEmailDisplay.textContent = user.email;
             const logoutBtn = document.getElementById('logoutBtn'); if (logoutBtn) logoutBtn.style.display = 'inline-block'; // Show logout

             // Load data only after auth confirmed
             await loadSupplierAccountData();

         } else {
             console.log("User not authenticated on init. Redirecting...");
             window.location.href = 'index.html';
         }
     }, (error) => {
         // Handle auth state change errors
         console.error("Auth state listener error:", error);
         displayError("Authentication error. Please refresh or log in again.");
         const loadingIndicator = document.getElementById('loadingIndicator');
         if (loadingIndicator) loadingIndicator.style.display = 'none';
         if (mainContent) mainContent.style.visibility = 'visible';
     });
};

// Use DOMContentLoaded for safety
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attemptInitialization);
} else {
    // DOM already loaded, attempt initialization if needed
    attemptInitialization();
}