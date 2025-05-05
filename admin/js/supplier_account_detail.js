// js/supplier_account_detail.js - v5 (Listener Fixes, Robustness Checks, Init Refinement)

import { db, auth } from './firebase-init.js';
import {
    doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp,
    addDoc, serverTimestamp, updateDoc, runTransaction, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Global Variables ---
let initializationAttempted = false;
let currentSupplierId = null;
let currentSupplierData = null;
let purchaseOrdersData = [];
let supplierPaymentsData = [];
let listenersAttached = false;
let supplierDetailPageInitialized = false;


// --- Helper Functions ---
function displayError(message, elementId = 'generalErrorDisplay') {
    console.error("Displaying Error:", message, "Target Element ID:", elementId);
    try {
        // Use a consistent error display area if possible
        let errorElement = document.getElementById('generalErrorDisplay'); // Default general error area
        if (!errorElement) { // Fallback to specific areas if general not found
             if (elementId === 'paymentMadeError') errorElement = document.getElementById('paymentMadeError');
             else if (elementId === 'editSupplierError') errorElement = document.getElementById('editSupplierError');
             else if (elementId === 'supplierPaymentListError') errorElement = document.getElementById('supplierPaymentListError');
             else if (elementId === 'supplierPoListError') errorElement = document.getElementById('supplierPoListError');
             else if (elementId === 'accountSummaryError') errorElement = document.getElementById('accountSummaryError');
        }

        if (errorElement) {
            // Use textContent for security, ensure it's visible
            errorElement.textContent = `Error: ${message}`;
            errorElement.style.display = 'block'; // Make sure it's visible
            errorElement.style.color = 'red'; // Keep red color or use CSS class
            console.log("Error displayed in element:", errorElement.id);
        } else {
            console.warn(`Error element '${elementId}' or fallback 'generalErrorDisplay' not found. Using alert.`);
            alert(`Error: ${message}`);
        }
    } catch(e) {
        console.error("Error within displayError function itself:", e);
        alert(`Critical Error: ${message}`); // Alert as last resort
    }
}

function clearError(elementId = 'generalErrorDisplay') {
    try {
        let errorElement = document.getElementById(elementId);
         // Clear specific errors as well if a general clear is called
         if (elementId === 'generalErrorDisplay') {
             const specificErrors = ['paymentMadeError', 'editSupplierError', 'supplierPaymentListError', 'supplierPoListError', 'accountSummaryError'];
             specificErrors.forEach(id => {
                 const el = document.getElementById(id);
                 if (el) { el.textContent = ''; el.style.display = 'none'; }
             });
         }
         // Clear the target element
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
    } catch(e) { console.error("Error within clearError:", e); }
}

function getSupplierIdFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    } catch (e) {
        console.error("Error getting supplier ID from URL:", e);
        displayError("Could not read supplier ID from page address.");
        return null;
    }
}

function formatDate(timestamp, includeTime = false) {
    if (!timestamp || typeof timestamp.toDate !== 'function') { return '-'; }
    try {
        const date = timestamp.toDate();
        // Consistent formatting options
        const optionsDate = { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' }; // IST Timezone
        const optionsTime = { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' };
        const formattedDate = date.toLocaleDateString('en-IN', optionsDate); // Use Indian English format
        if (includeTime) {
            return `${formattedDate}, ${date.toLocaleTimeString('en-IN', optionsTime)}`;
        }
        return formattedDate;
    } catch (e) { console.error("Error formatting date:", timestamp, e); return 'Format Error'; }
}

function formatCurrency(amount) {
    try {
        let numAmount = typeof amount === 'number' ? amount : parseFloat(amount);
        if (isNaN(numAmount)) { return '₹ --.--'; }
        // Use Indian formatting
        return `₹ ${numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } catch (e) {
        console.error("Error formatting currency:", amount, e);
        return '₹ Format Error';
    }
}

// Using badge classes from the latest CSS
function getStatusClass(status) {
    if (!status) return 'status-unknown';
    const normalizedStatus = status.toLowerCase().replace(/\s+/g, '-');
    // Return the exact class names used in CSS
    switch (normalizedStatus) {
        case 'new': return 'status-new';
        case 'sent': return 'status-sent';
        case 'printing': return 'status-printing';
        case 'product-received': return 'status-product-received';
        case 'po-paid': return 'status-po-paid'; // Or use 'status-paid' if defined
        case 'cancel': return 'status-cancel';
        default: return 'status-unknown';
    }
}

function getPaymentStatusClass(status) {
    if (!status) return 'payment-status-pending'; // Default
    const normalizedStatus = status.toLowerCase().replace(/\s+/g, '-');
     // Return the exact class names used in CSS
    switch (normalizedStatus) {
        case 'pending': return 'payment-status-pending';
        case 'partially-paid': return 'payment-status-partially-paid';
        case 'paid': return 'payment-status-paid';
        default: return 'payment-status-pending'; // Fallback
    }
}

// --- UI Population Functions ---
function populateSupplierDetails(data) {
    console.log("Populating supplier details with data:", data);
    // IDs from the latest HTML provided
    const elements = {
        supplierNameHeader: document.getElementById('supplierNameHeader'),
        supplierNameBreadcrumb: document.getElementById('supplierNameBreadcrumb'),
        detailSupplierId: document.getElementById('detailSupplierId'),
        detailSupplierName: document.getElementById('detailSupplierName'),
        detailSupplierCompany: document.getElementById('detailSupplierCompany'),
        detailSupplierWhatsapp: document.getElementById('detailSupplierWhatsapp'),
        detailSupplierContact: document.getElementById('detailSupplierContact'), // Added this assuming it exists
        detailSupplierEmail: document.getElementById('detailSupplierEmail'),
        detailSupplierGst: document.getElementById('detailSupplierGst'),
        detailSupplierAddress: document.getElementById('detailSupplierAddress'),
        detailAddedOn: document.getElementById('detailAddedOn')
    };

    // Check if all required elements exist
    for (const key in elements) {
        if (!elements[key]) {
            console.error(`Supplier Detail element missing: ${key}`);
            // Maybe display a general error, but avoid stopping execution
        }
    }

    // Populate elements safely
    if (elements.supplierNameHeader) elements.supplierNameHeader.textContent = data?.name || 'Details';
    if (elements.supplierNameBreadcrumb) elements.supplierNameBreadcrumb.textContent = data?.name || 'Details';
    if (elements.detailSupplierId) elements.detailSupplierId.textContent = currentSupplierId || 'N/A'; // Display the ID from URL
    if (elements.detailSupplierName) elements.detailSupplierName.textContent = data?.name || 'N/A';
    if (elements.detailSupplierCompany) elements.detailSupplierCompany.textContent = data?.companyName || 'N/A';
    if (elements.detailSupplierWhatsapp) elements.detailSupplierWhatsapp.textContent = data?.whatsappNo || 'N/A';
    if (elements.detailSupplierContact) elements.detailSupplierContact.textContent = data?.contact || 'N/A';
    if (elements.detailSupplierEmail) elements.detailSupplierEmail.textContent = data?.email || 'N/A';
    if (elements.detailSupplierGst) elements.detailSupplierGst.textContent = data?.gstNo || 'N/A';
    if (elements.detailSupplierAddress) elements.detailSupplierAddress.textContent = data?.address || 'N/A';
    if (elements.detailAddedOn) elements.detailAddedOn.textContent = data?.createdAt ? formatDate(data.createdAt) : 'N/A';
}

function populatePaymentHistory(payments) {
    console.log("Populating payment history");
    const tableBody = document.getElementById('transactionsTableBody');
    const loadingRow = document.getElementById('transactionsLoading');
    const noDataRow = document.getElementById('noTransactionsMessage');
    const errorDisplay = document.getElementById('supplierPaymentListError');

    // Robustness Check: Ensure table body exists
    if (!tableBody) {
        console.error("Critical: Payment history table body ('transactionsTableBody') not found!");
        if(errorDisplay) displayError("Could not display payment history (UI element missing).", 'supplierPaymentListError');
        return;
    }

    tableBody.innerHTML = ''; // Clear previous entries
    if (errorDisplay) errorDisplay.style.display = 'none'; // Hide error message
    if (loadingRow) loadingRow.style.display = 'none'; // Hide loading row

    if (!payments || payments.length === 0) {
        if (noDataRow) {
            noDataRow.style.display = 'table-row'; // Show 'no data' message
        } else {
            // Fallback if no special row exists
            tableBody.innerHTML = '<tr><td colspan="6">No payment history found.</td></tr>';
        }
        return;
    }

    if (noDataRow) noDataRow.style.display = 'none'; // Hide 'no data' message

    payments.sort((a, b) => (b.paymentDate?.toDate?.() || 0) - (a.paymentDate?.toDate?.() || 0)); // Sort descending

    payments.forEach((payment) => {
        try {
            const row = tableBody.insertRow();
            row.insertCell(0).textContent = formatDate(payment.paymentDate, true); // Payment Date + Time
            // Check for different possible field names for notes/reference
            row.insertCell(1).textContent = payment.notes || payment.description || payment.reference || '-'; // Description / Notes
            row.insertCell(2).textContent = payment.paymentMethod || payment.mode || 'N/A'; // Method
            // Linked POs
            let linkedPoDisplay = '-';
            if (Array.isArray(payment.linkedPoNumbers) && payment.linkedPoNumbers.length > 0) {
                linkedPoDisplay = payment.linkedPoNumbers.join(', ');
            } else if (payment.linkedPoNumber) { // Fallback for older single link
                linkedPoDisplay = payment.linkedPoNumber;
            }
            row.insertCell(3).textContent = linkedPoDisplay; // Linked PO
            const amountCell = row.insertCell(4); // Amount Paid
            amountCell.textContent = formatCurrency(payment.paymentAmount);
            amountCell.classList.add('amount-paid');
            // Actions Cell - Add buttons/links here if needed
            row.insertCell(5); // Actions (empty for now)
       } catch(e) { console.error(`Error creating payment row:`, payment, e); }
    });
}


function populatePoHistoryTable(pos) {
    console.log("Populating PO history");
    const tableBody = document.getElementById('supplierPoTableBody');
    const loadingRow = document.getElementById('supplierPoLoading');
    const noDataRow = document.getElementById('noSupplierPoMessage');
    const errorDisplay = document.getElementById('supplierPoListError');

     // Robustness Check: Ensure table body exists
    if (!tableBody) {
        console.error("Critical: PO history table body ('supplierPoTableBody') not found!");
        if (errorDisplay) displayError("Could not display PO history (UI element missing).", 'supplierPoListError');
        return;
    }

    tableBody.innerHTML = ''; // Clear previous entries
    if (errorDisplay) errorDisplay.style.display = 'none';
    if (loadingRow) loadingRow.style.display = 'none';

    if (!pos || pos.length === 0) {
        if (noDataRow) {
            noDataRow.style.display = 'table-row';
        } else {
            tableBody.innerHTML = '<tr><td colspan="6">No purchase orders found.</td></tr>'; // Adjust colspan if needed
        }
        return;
    }

    if (noDataRow) noDataRow.style.display = 'none';

    pos.sort((a, b) => (b.orderDate?.toDate?.() || 0) - (a.orderDate?.toDate?.() || 0)); // Sort descending

    pos.forEach((po) => {
        try {
            const row = tableBody.insertRow();
            row.insertCell(0).textContent = po.poNumber || `PO-${po.id.substring(0, 6)}`; // PO #
            row.insertCell(1).textContent = formatDate(po.orderDate); // Order Date
            const amountCell = row.insertCell(2); // Total Amount
            amountCell.textContent = formatCurrency(po.totalAmount);
            amountCell.classList.add('amount-po');

            // Status
            const statusCell = row.insertCell(3);
            const statusSpan = document.createElement('span');
            statusSpan.className = `status-badge ${getStatusClass(po.status)}`; // Use appropriate status field
            statusSpan.textContent = po.status || 'Unknown';
            statusCell.appendChild(statusSpan);

            // Payment Status
            const paymentStatusCell = row.insertCell(4);
            const paymentStatusSpan = document.createElement('span');
            paymentStatusSpan.className = `status-badge ${getPaymentStatusClass(po.paymentStatus)}`;
            paymentStatusSpan.textContent = po.paymentStatus || 'Pending';
            paymentStatusCell.appendChild(paymentStatusSpan);

            // Actions Cell - Add buttons/links here if needed
            row.insertCell(5); // Actions
        } catch (e) { console.error(`Error creating PO row:`, po, e); }
    });
}


function updateAccountSummary(poTotal, paymentTotal) {
    console.log("Updating account summary");
    const poDisplay = document.getElementById('summaryTotalPoValue');
    const paidDisplay = document.getElementById('summaryTotalPaid');
    const balanceDisplay = document.getElementById('summaryBalance');
    const errorDisplay = document.getElementById('accountSummaryError');

    // Robustness Check: Ensure all elements exist
    if (!poDisplay || !paidDisplay || !balanceDisplay) {
        console.error("Critical: Account summary elements missing!");
        if (errorDisplay) displayError("Could not display account summary (UI elements missing).", 'accountSummaryError');
        // Clear any potentially stuck 'Calculating...' text
        if(poDisplay) poDisplay.textContent = '-';
        if(paidDisplay) paidDisplay.textContent = '-';
        if(balanceDisplay) balanceDisplay.textContent = '-';
        return;
    }

    if (errorDisplay) errorDisplay.style.display = 'none'; // Hide error

    const numPoTotal = parseFloat(poTotal) || 0;
    const numPaymentTotal = parseFloat(paymentTotal) || 0;
    const outstanding = numPoTotal - numPaymentTotal;

    poDisplay.textContent = formatCurrency(numPoTotal);
    paidDisplay.textContent = formatCurrency(numPaymentTotal);
    balanceDisplay.textContent = formatCurrency(outstanding);

    // Remove loading state class if it exists
    poDisplay.classList.remove('loading-state');
    paidDisplay.classList.remove('loading-state');
    balanceDisplay.classList.remove('loading-state');

    // Apply balance class for styling
    balanceDisplay.className = 'balance-info'; // Reset classes first
    if (outstanding > 0.01) balanceDisplay.classList.add('balance-due');
    else if (outstanding < -0.01) balanceDisplay.classList.add('balance-credit');
    else balanceDisplay.classList.add('balance-zero');
}

// <<< New Function: Populate Checkbox List for Payment Modal >>>
function populatePoCheckboxListForPayment(pos) {
    const listContainer = document.getElementById('paymentLinkPOList');
    if (!listContainer) { console.error("PO Checkbox list container for payment ('paymentLinkPOList') not found!"); return; }
    listContainer.innerHTML = ''; // Clear previous items

    if (!pos || pos.length === 0) {
        listContainer.innerHTML = '<p>No POs found for this supplier.</p>';
        return;
    }

    // Filter for POs that are not fully paid
    const openPOs = pos.filter(po => {
        const total = parseFloat(po.totalAmount) || 0;
        const paid = parseFloat(po.amountPaid) || 0; // Check if 'amountPaid' field exists
        // Consider a PO open if not explicitly 'Paid' or if balance > 0.01
        return po.paymentStatus !== 'Paid' && (isNaN(paid) || total - paid > 0.01);
    });


    if (openPOs.length === 0) {
        listContainer.innerHTML = '<p>No open POs found (all seem paid).</p>';
        return;
    }

    openPOs.sort((a, b) => (a.orderDate?.toDate?.() || 0) - (b.orderDate?.toDate?.() || 0)); // Sort oldest first

    openPOs.forEach((po) => { // Removed index as ID is better
        const total = parseFloat(po.totalAmount) || 0;
        const paid = parseFloat(po.amountPaid) || 0;
        const balance = total - paid;

        const div = document.createElement('div');
        div.className = 'po-checkbox-item'; // Use this class for styling

        const checkboxId = `po_link_${po.id}`; // Use unique PO ID in checkbox ID
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = checkboxId;
        checkbox.name = 'linkedPOs'; // Group checkboxes
        checkbox.value = po.id; // Value is the PO document ID
        checkbox.dataset.poNumber = po.poNumber || `PO-${po.id.substring(0, 6)}`; // Store PO number
        checkbox.dataset.poBalance = balance.toFixed(2); // Store balance

        const label = document.createElement('label');
        label.htmlFor = checkboxId;
        // Structure label content using spans for better styling
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
     console.log("loadSupplierAccountData called");
     // ID check moved to initialization phase
     if (!currentSupplierId) {
         console.error("Supplier ID is null in loadSupplierAccountData");
         displayError("Cannot load data: Supplier ID is missing.");
         return;
     }
     if (!db) { displayError("Database connection failed."); return; }

     const loadingIndicator = document.getElementById('loadingIndicator');
     if (loadingIndicator) loadingIndicator.style.display = 'block';
     clearError(); // Clear general errors and specific list errors

     let supplierData = null;
     let payments = [];
     let purchaseOrders = [];
     let paymentSum = 0;
     let poSum = 0;

     try {
         console.log("Fetching data for supplier ID:", currentSupplierId);
         const supplierRef = doc(db, "suppliers", currentSupplierId);
         const supplierSnap = await getDoc(supplierRef);

         if (!supplierSnap.exists()) {
             console.error("Supplier document not found for ID:", currentSupplierId);
             throw new Error("Supplier not found in database.");
         }

         supplierData = { id: supplierSnap.id, ...supplierSnap.data() };
         currentSupplierData = supplierData; // Store globally
         populateSupplierDetails(supplierData); // Populate supplier details section

         // Fetch payments and POs in parallel
         console.log("Fetching payments and POs...");
         const [paymentsSnapshot, poSnapshot] = await Promise.all([
              getDocs(query(collection(db, "supplier_payments"), where("supplierId", "==", currentSupplierId))),
              getDocs(query(collection(db, "purchaseOrders"), where("supplierId", "==", currentSupplierId)))
         ]);
         console.log(`Found ${paymentsSnapshot.docs.length} payments and ${poSnapshot.docs.length} POs.`);

         // Process Payments
         payments = paymentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
         supplierPaymentsData = payments; // Store globally
         paymentSum = payments.reduce((sum, p) => sum + (parseFloat(p.paymentAmount) || 0), 0);
         populatePaymentHistory(payments);

         // Process Purchase Orders
         purchaseOrders = poSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
         purchaseOrdersData = purchaseOrders; // Store globally
         poSum = purchaseOrders.reduce((sum, po) => sum + (parseFloat(po.totalAmount) || 0), 0);
         populatePoHistoryTable(purchaseOrders);

         // Update Account Summary
         updateAccountSummary(poSum, paymentSum);

         // Setup listeners only after initial data load is successful
         // If called here, it might run multiple times if load is triggered again.
         // Consider calling setupEventListeners once during initialization. Moved there.
         // setupEventListeners();

     } catch (error) {
         console.error("Error loading supplier account data:", error);
         displayError(`Error loading data: ${error.message}. Please check connection or Supplier ID.`);
         // Clear UI or show error states
         if (!supplierData) populateSupplierDetails(null); // Clear details if supplier wasn't found
         populatePaymentHistory([]);
         populatePoHistoryTable([]);
         updateAccountSummary(0, 0);
         // Disable buttons if data load failed
         const addPaymentBtn = document.getElementById('addPaymentMadeBtn');
         const editSupplierBtn = document.getElementById('editSupplierDetailsBtn');
         if(addPaymentBtn) addPaymentBtn.disabled = true;
         if(editSupplierBtn) editSupplierBtn.disabled = true;

     } finally {
         if (loadingIndicator) loadingIndicator.style.display = 'none';
         console.log("loadSupplierAccountData finished.");
     }
}

// --- Modal Functions & Handlers ---

// Add Payment Modal
function openPaymentModal(){
    if (!currentSupplierData) { alert("Supplier data not loaded yet. Cannot record payment."); return; }

    // Using IDs from the HTML provided
    const modal = document.getElementById('paymentMadeModal');
    const form = document.getElementById('paymentMadeForm');
    const supplierNameSpan = document.getElementById('paymentSupplierName');
    const dateInput = document.getElementById('paymentDate');
    const poListContainer = document.getElementById('paymentLinkPOList'); // Checkbox list container

    // Robustness: Check all elements exist
    if (!modal || !form || !supplierNameSpan || !dateInput || !poListContainer) {
        console.error("Payment modal elements missing. Cannot open.");
        displayError("Could not open payment form (UI elements missing).");
        return;
    }

    clearError('paymentMadeError');
    form.reset();
    supplierNameSpan.textContent = currentSupplierData.name || 'Supplier';

    // Set default date to today
    try { dateInput.valueAsDate = new Date(); }
    catch(e) { dateInput.value = new Date().toISOString().slice(0,10); }

    // Populate Checkbox list with open POs
    populatePoCheckboxListForPayment(purchaseOrdersData);

    modal.classList.add('active'); // Use class to show modal
}
function closePaymentModal(){
    const modal = document.getElementById('paymentMadeModal');
    if(modal) modal.classList.remove('active'); // Use class to hide
}

// Save Payment Handler - Handles checkboxes
async function handleSavePayment(event) {
    event.preventDefault();
    if (!currentSupplierId || !db) {
        displayError("Cannot save payment. DB connection or Supplier ID missing.", "paymentMadeError"); return;
    }

    // Get elements using IDs from HTML
    const amountInput = document.getElementById('paymentAmount');
    const dateInput = document.getElementById('paymentDate');
    const methodInput = document.getElementById('paymentMethod'); // Select dropdown
    const notesInput = document.getElementById('paymentNotes'); // Textarea for notes
    const poListContainer = document.getElementById('paymentLinkPOList');
    const saveBtn = document.getElementById('savePaymentBtn');

    // Robustness: Check elements exist
    if (!amountInput || !dateInput || !methodInput || !notesInput || !poListContainer || !saveBtn) {
         displayError("Payment form elements missing. Cannot save.", "paymentMadeError"); return;
    }

    const amount = parseFloat(amountInput.value);
    const paymentDateStr = dateInput.value;
    const method = methodInput.value;
    const notes = notesInput.value.trim();

    // Validation
    if (isNaN(amount) || amount <= 0) { displayError("Please enter a valid positive payment amount.", "paymentMadeError"); amountInput.focus(); return; }
    if (!paymentDateStr) { displayError("Please select a payment date.", "paymentMadeError"); dateInput.focus(); return; }
    if (!method) { displayError("Please select a payment method.", "paymentMadeError"); methodInput.focus(); return; }

    // Get selected POs from checkboxes
    const selectedCheckboxes = poListContainer.querySelectorAll('input[name="linkedPOs"]:checked');
    const linkedPoIds = Array.from(selectedCheckboxes).map(cb => cb.value);
    const linkedPoNumbers = Array.from(selectedCheckboxes).map(cb => cb.dataset.poNumber);

    saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; clearError('paymentMadeError');

    try {
        // Convert date string to Firestore Timestamp (using local time 00:00:00)
        const localDate = new Date(paymentDateStr + 'T00:00:00');
        const paymentDate = Timestamp.fromDate(localDate);

        const paymentData = {
            supplierId: currentSupplierId,
            supplierName: currentSupplierData?.name || 'N/A',
            paymentAmount: amount,
            paymentDate: paymentDate,
            paymentMethod: method, // Field name consistent with select ID
            notes: notes,          // Field name consistent with textarea ID
            createdAt: serverTimestamp(),
            linkedPoIds: linkedPoIds || [],
            linkedPoNumbers: linkedPoNumbers || []
        };

        const paymentDocRef = await addDoc(collection(db, "supplier_payments"), paymentData);
        console.log("Payment recorded successfully with ID:", paymentDocRef.id);

        // --- TODO: Implement PO Status/Amount Update Logic using WriteBatch ---
        // This part is crucial for accurate PO payment status tracking
        if (linkedPoIds.length > 0) {
            console.log(`Updating status for ${linkedPoIds.length} POs is needed.`);
            // Use writeBatch to update amountPaid and paymentStatus on linked PO documents.
            // Requires fetching each PO, calculating new status/paid amount, adding updates to batch.
        }
        // --- End TODO ---

        // --- UI Refresh ---
        // 1. Add new payment to local array
        const newPayment = { id: paymentDocRef.id, ...paymentData, createdAt: Timestamp.now() }; // Use local timestamp approximation
        supplierPaymentsData.push(newPayment);
        // 2. Re-render payment table
        populatePaymentHistory(supplierPaymentsData);
        // 3. Recalculate and update summary
        const currentPoSum = purchaseOrdersData.reduce((sum, po) => sum + (parseFloat(po.totalAmount) || 0), 0);
        const newPaymentSum = supplierPaymentsData.reduce((sum, p) => sum + (parseFloat(p.paymentAmount) || 0), 0);
        updateAccountSummary(currentPoSum, newPaymentSum);
        // 4. Optionally refresh PO list if statuses were updated
        // populatePoHistoryTable(purchaseOrdersData); // Requires updated PO data after batch write

        closePaymentModal();
        // Optional: Show a success message/toast notification instead of alert
        alert("Payment recorded successfully!");

    } catch (error) {
        console.error("Error saving payment:", error);
        displayError(`Failed to save payment: ${error.message}`, "paymentMadeError");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Payment';
    }
}


// Edit Supplier Modal
function openEditSupplierModal(){
    // IDs from HTML
    const modal = document.getElementById('editSupplierModal');
    const form = document.getElementById('editSupplierForm');
    const nameInput = document.getElementById('editSupplierNameInput');
    const companyInput = document.getElementById('editSupplierCompanyInput');
    const whatsappInput = document.getElementById('editSupplierWhatsappInput');
    const contactInput = document.getElementById('editSupplierContactInput');
    const emailInput = document.getElementById('editSupplierEmailInput');
    const gstInput = document.getElementById('editSupplierGstInput');
    const addressInput = document.getElementById('editSupplierAddressInput');
    const hiddenIdInput = document.getElementById('editingSupplierId');

    // Robustness Check
    if(!modal || !form || !nameInput || !companyInput || !whatsappInput || !contactInput || !emailInput || !gstInput || !addressInput || !hiddenIdInput || !currentSupplierData) {
        console.error("Edit supplier modal elements or supplier data missing.");
        displayError("Could not open edit form (UI elements missing)."); return;
    }

    clearError('editSupplierError');
    form.reset();

    hiddenIdInput.value = currentSupplierId;
    nameInput.value = currentSupplierData.name || '';
    companyInput.value = currentSupplierData.companyName || '';
    whatsappInput.value = currentSupplierData.whatsappNo || '';
    contactInput.value = currentSupplierData.contact || ''; // Assuming contact field exists
    emailInput.value = currentSupplierData.email || '';
    gstInput.value = currentSupplierData.gstNo || '';
    addressInput.value = currentSupplierData.address || '';

    modal.classList.add('active'); // Show modal using class
}

function closeEditSupplierModal(){
    const modal = document.getElementById('editSupplierModal');
    if(modal) modal.classList.remove('active'); // Hide modal using class
}

async function handleEditSupplierSubmit(event){
    event.preventDefault();
    if (!currentSupplierId || !db) {
        displayError("Cannot update supplier. DB connection or Supplier ID missing.", "editSupplierError"); return;
    }

    const form = event.target;
    const saveBtn = document.getElementById('updateSupplierBtn');

    if(!form || !saveBtn) { displayError("Edit form or save button not found.", "editSupplierError"); return; }

    // Gather updated data from form
    const updatedData = {
         name: form.querySelector('#editSupplierNameInput')?.value.trim(),
         name_lowercase: form.querySelector('#editSupplierNameInput')?.value.trim().toLowerCase(),
         companyName: form.querySelector('#editSupplierCompanyInput')?.value.trim(),
         whatsappNo: form.querySelector('#editSupplierWhatsappInput')?.value.trim(),
         contact: form.querySelector('#editSupplierContactInput')?.value.trim(), // Ensure field exists
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

        // Update local cache
        // Remove null/undefined fields before merging to avoid overwriting existing data with null
        const cleanUpdatedData = Object.entries(updatedData)
                                    .filter(([key, value]) => value !== undefined && value !== null)
                                    .reduce((obj, [key, value]) => { obj[key] = value; return obj; }, {});

        currentSupplierData = { ...currentSupplierData, ...cleanUpdatedData, updatedAt: Timestamp.now() };

        populateSupplierDetails(currentSupplierData); // Update UI
        closeEditSupplierModal();
        alert("Supplier details updated successfully!");

    } catch(error) {
        console.error("Error updating supplier details:", error);
        displayError(`Failed to update details: ${error.message}`, "editSupplierError");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Update Supplier';
    }
}

// --- Event Listeners Setup (Corrected IDs) ---
function setupEventListeners() {
    if (listenersAttached) {
        console.log("Listeners already attached.");
        return; // Prevent attaching multiple times
    }
    console.log("Setting up event listeners...");

    // Buttons outside modals
    const addPayBtn = document.getElementById('addPaymentMadeBtn');
    const editSupplierBtn = document.getElementById('editSupplierDetailsBtn'); // Corrected ID from HTML
    const backBtn = document.querySelector('a.back-button'); // Use class selector

    if (addPayBtn) addPayBtn.addEventListener('click', openPaymentModal);
    else console.warn("Add Payment Btn (addPaymentMadeBtn) not found");

    if (editSupplierBtn) editSupplierBtn.addEventListener('click', openEditSupplierModal);
    else console.warn("Edit Supplier Details Btn (editSupplierDetailsBtn) not found");

    if (backBtn) backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'supplier_management.html';
    }); else console.warn("Back to List Btn (<a class='back-button'>) not found");


    // Payment Modal elements
    const closeBtnPay = document.getElementById('closePaymentMadeModalBtn');
    const cancelBtnPay = document.getElementById('cancelPaymentBtn');
    const payModal = document.getElementById('paymentMadeModal');
    const payForm = document.getElementById('paymentMadeForm');

    if (closeBtnPay) closeBtnPay.addEventListener('click', closePaymentModal); else console.warn("Close Payment Modal Btn (closePaymentMadeModalBtn) not found");
    if (cancelBtnPay) cancelBtnPay.addEventListener('click', closePaymentModal); else console.warn("Cancel Payment Btn (cancelPaymentBtn) not found");
    if (payModal) payModal.addEventListener('click', (event) => { if (event.target === payModal) closePaymentModal(); }); else console.warn("Payment Modal (paymentMadeModal) not found");
    if (payForm) payForm.addEventListener('submit', handleSavePayment); else console.warn("Payment Form (paymentMadeForm) not found");

    // Edit Supplier Modal elements
    const closeEditBtn = document.getElementById('closeEditSupplierBtn');
    const cancelEditBtn = document.getElementById('cancelEditSupplierBtn');
    const editModal = document.getElementById('editSupplierModal');
    const editForm = document.getElementById('editSupplierForm');

    if (closeEditBtn) closeEditBtn.addEventListener('click', closeEditSupplierModal); else console.warn("Close Edit Supplier Btn (closeEditSupplierBtn) not found");
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditSupplierModal); else console.warn("Cancel Edit Supplier Btn (cancelEditSupplierBtn) not found");
    if (editModal) editModal.addEventListener('click', (event) => { if (event.target === editModal) closeEditSupplierModal(); }); else console.warn("Edit Supplier Modal (editSupplierModal) not found");
    if (editForm) editForm.addEventListener('submit', handleEditSupplierSubmit); else console.warn("Edit Supplier Form (editSupplierForm) not found");

    listenersAttached = true; // Mark listeners as attached
    console.log("Event listeners setup complete.");
}

// --- Global Initialization & Auto-run ---
// Ensure this runs only once after DOM is ready and auth state is known
function attemptInitialization() {
    console.log("Attempting initialization...");
    if (initializationAttempted) {
        console.log("Initialization already attempted.");
        return;
    }
    initializationAttempted = true; // Set flag immediately

    // Check if the main initialization function exists and run it
    if (typeof window.initializeSupplierDetailPage === 'function') {
        console.log("Calling initializeSupplierDetailPage...");
        window.initializeSupplierDetailPage();
    } else {
        console.error("Initialization function (window.initializeSupplierDetailPage) not found!");
        displayError("Page initialization function failed to load.");
    }
}

// Main initialization function for this page
// This function now includes the auth check
window.initializeSupplierDetailPage = () => {
     console.log("initializeSupplierDetailPage called");
     if (supplierDetailPageInitialized) {
         console.log("Supplier detail page already initialized. Exiting.");
         return; // Prevent re-initialization
     }
     supplierDetailPageInitialized = true; // Mark as initialized immediately
     clearError(); // Clear any previous general errors

     const mainContent = document.getElementById('detailMainContent');
     if (mainContent) {
         mainContent.style.visibility = 'visible'; // Make content visible only now
     } else {
         console.error("Critical: Main content container ('detailMainContent') missing!");
         displayError("Page layout structure is broken.");
         return; // Stop if layout is broken
     }

     // Get Supplier ID early
     currentSupplierId = getSupplierIdFromUrl();
     if (!currentSupplierId) {
         displayError("Supplier ID missing from URL. Cannot load details.");
         return; // Stop if no ID
     }
     console.log("Supplier ID found:", currentSupplierId);

     // Check Firebase Auth State - Load data only if user is logged in
     onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("User is authenticated. Proceeding to load supplier data...");
             // Check if Firestore DB instance is ready
             if (typeof db === 'undefined' || !db) {
                 console.error("Firestore db instance not available!");
                 displayError("Database connection failed. Please refresh.");
                 return;
             }
             // Load the supplier data now
             await loadSupplierAccountData();
             // Setup event listeners ONCE after the first successful data load attempt for an authenticated user
             if (!listenersAttached) {
                 setupEventListeners();
             }

        } else {
            console.warn("User is not authenticated. Cannot load supplier details.");
             displayError("You must be logged in to view supplier details.");
             // Optional: Redirect to login page
             // window.location.href = '/login.html';

             // Ensure buttons are disabled if user logs out while on page
             const addPaymentBtn = document.getElementById('addPaymentMadeBtn');
             const editSupplierBtn = document.getElementById('editSupplierDetailsBtn');
             if(addPaymentBtn) addPaymentBtn.disabled = true;
             if(editSupplierBtn) editSupplierBtn.disabled = true;
        }
    });
     console.log("Auth state listener attached.");
};

// Trigger initialization when the DOM is ready
if (document.readyState === 'loading') {
    console.log("DOM is loading, adding DOMContentLoaded listener...");
    document.addEventListener('DOMContentLoaded', attemptInitialization);
} else {
    console.log("DOM already loaded, attempting initialization directly...");
    attemptInitialization();
}

console.log("supplier_account_detail.js script loaded.");