// js/supplier_account_detail.js - v4 (Payment Modal Checkboxes, Basic Multi-Link Save)

import { db, auth } from './firebase-init.js';
import {
    doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp,
    addDoc, serverTimestamp, updateDoc, runTransaction, writeBatch // Added writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Global Variables ---
let initializationAttempted = false; // <<<--- यह लाइन यहाँ जोड़ दी गई है
let currentSupplierId = null;
let currentSupplierData = null;
let purchaseOrdersData = [];
let supplierPaymentsData = [];
let listenersAttached = false;
let supplierDetailPageInitialized = false;


// --- Helper Functions ---
function displayError(message, elementId = 'generalErrorDisplay') {
    console.error("Displaying Error:", message, "on element:", elementId);
    try {
        let errorElement = document.getElementById(elementId);
        if (!errorElement && elementId === 'paymentMadeError') errorElement = document.getElementById('paymentMadeError');
        if (!errorElement && elementId === 'editSupplierError') errorElement = document.getElementById('editSupplierError');
        if (!errorElement) errorElement = document.getElementById('supplierPaymentListError');
        if (!errorElement) errorElement = document.getElementById('supplierPoListError');
        if (!errorElement) errorElement = document.getElementById('generalErrorDisplay');

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
        let errorElement = document.getElementById(elementId);
         if (!errorElement && elementId === 'paymentMadeError') errorElement = document.getElementById('paymentMadeError');
         if (!errorElement && elementId === 'editSupplierError') errorElement = document.getElementById('editSupplierError');
        if (!errorElement) errorElement = document.getElementById('supplierPaymentListError');
        if (!errorElement) errorElement = document.getElementById('supplierPoListError');
        if (!errorElement) errorElement = document.getElementById('generalErrorDisplay');
        if (errorElement) { errorElement.textContent = ''; errorElement.style.display = 'none'; }
    } catch(e) { console.error("Error within clearError:", e); }
}
function getSupplierIdFromUrl() {
    try { const params = new URLSearchParams(window.location.search); return params.get('id'); }
    catch (e) { console.error("Error getting supplier ID from URL:", e); return null; }
}
function formatDate(timestamp, includeTime = false) {
    if (!timestamp || typeof timestamp.toDate !== 'function') { return '-'; }
    try {
        const date = timestamp.toDate();
        const optionsDate = { year: 'numeric', month: 'short', day: 'numeric' };
        const optionsTime = { hour: 'numeric', minute: '2-digit', hour12: true };
        const formattedDate = date.toLocaleDateString('en-IN', optionsDate);
        if (includeTime) {
            return `${formattedDate}, ${date.toLocaleTimeString('en-IN', optionsTime)}`;
        }
        return formattedDate;
    } catch (e) { console.error("Error formatting date:", timestamp, e); return 'Format Error'; }
}
function formatCurrency(amount) {
    if (typeof amount !== 'number') { amount = parseFloat(amount); }
    if (isNaN(amount)) { return '₹ --.--'; }
    return `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function getStatusClass(status) { if (!status) return 'status-unknown'; return 'status-' + status.toLowerCase().replace(/\s+/g, '-'); }
function getPaymentStatusClass(status) { if (!status) return 'payment-status-pending'; return 'payment-status-' + status.toLowerCase().replace(/\s+/g, '-'); }

// --- UI Population Functions ---
function populateSupplierDetails(data) {
    // Using IDs from the HTML provided
    const pageTitleSpan = document.getElementById('supplierNameTitle');
    const breadcrumbSpan = document.getElementById('supplierNameBreadcrumb');
    const supplierIdSpan = document.getElementById('supplierId');
    const supplierNameSpan = document.getElementById('supplierName');
    const companySpan = document.getElementById('supplierCompany');
    const whatsappSpan = document.getElementById('supplierWhatsapp');
    const contactSpan = document.getElementById('supplierContact'); // Added assuming it exists
    const emailSpan = document.getElementById('supplierEmail');
    const gstSpan = document.getElementById('supplierGst');
    const addressSpan = document.getElementById('supplierAddress');
    const addedOnSpan = document.getElementById('supplierDateAdded'); // Corrected ID based on HTML

    if (!data) {
        if (pageTitleSpan) pageTitleSpan.textContent = '-';
        if (breadcrumbSpan) breadcrumbSpan.textContent = 'Account Details';
        if (supplierIdSpan) supplierIdSpan.textContent = '-';
        if (supplierNameSpan) supplierNameSpan.textContent = '-';
        // ... clear other fields ...
        return;
    }

    if (pageTitleSpan) pageTitleSpan.textContent = data.name || '-';
    if (breadcrumbSpan) breadcrumbSpan.textContent = data.name || 'Account Details';
    if (supplierIdSpan) supplierIdSpan.textContent = data.id || '-';
    if (supplierNameSpan) supplierNameSpan.textContent = data.name || '-';
    if (companySpan) companySpan.textContent = data.companyName || '-';
    if (whatsappSpan) whatsappSpan.textContent = data.whatsappNo || '-';
    if (contactSpan) contactSpan.textContent = data.contact || '-'; // Added assuming ID `supplierContact`
    if (emailSpan) emailSpan.textContent = data.email || '-';
    if (gstSpan) gstSpan.textContent = data.gstNo || '-';
    if (addressSpan) addressSpan.textContent = data.address || '-';
    if (addedOnSpan) addedOnSpan.textContent = data.createdAt ? formatDate(data.createdAt) : '-';
}


function populatePaymentHistory(payments) {
    // Using IDs from the HTML provided
    const tableBody = document.getElementById('paymentHistoryTable')?.querySelector('tbody'); // Correct table ID
    const errorDisplay = document.getElementById('supplierPaymentListError'); // Error display for this table

    if (!tableBody) { console.error("Payment history table body not found!"); return; }

    tableBody.innerHTML = ''; // Clear previous entries
    if (errorDisplay) errorDisplay.style.display = 'none'; // Hide error message

    if (!payments || payments.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">No payment history found.</td></tr>'; // Adjust colspan
        return;
    }

    // Sort by payment date, most recent first
    payments.sort((a, b) => (b.paymentDate?.toDate?.() || 0) - (a.paymentDate?.toDate?.() || 0));

    payments.forEach((payment) => {
         try {
             const row = tableBody.insertRow();
             row.insertCell(0).textContent = formatDate(payment.paymentDate); // Date
             const amountCell = row.insertCell(1); // Amount
             amountCell.textContent = formatCurrency(payment.paymentAmount);
             amountCell.classList.add('number-cell'); // Apply right-align style
             row.insertCell(2).textContent = payment.paymentMethod || payment.mode || '-'; // Mode (check both possible field names)
             row.insertCell(3).textContent = payment.paymentReference || payment.reference || payment.notes || '-'; // Reference/Notes

             // Linked POs
             let linkedPoDisplay = '-';
             if (Array.isArray(payment.linkedPoNumbers) && payment.linkedPoNumbers.length > 0) {
                 linkedPoDisplay = payment.linkedPoNumbers.join(', ');
             } else if (payment.linkedPoNumber) { // Fallback for older single link
                 linkedPoDisplay = payment.linkedPoNumber;
             }
              const linkedPoCell = row.insertCell(4); // Linked POs Cell
              const ul = document.createElement('ul');
              ul.className = 'payment-link-list';
              if (Array.isArray(payment.linkedPoNumbers) && payment.linkedPoNumbers.length > 0) {
                   payment.linkedPoNumbers.forEach(poNum => {
                       const li = document.createElement('li');
                       li.textContent = poNum;
                       ul.appendChild(li);
                   });
                   linkedPoCell.appendChild(ul);
              } else {
                   linkedPoCell.textContent = '-';
              }

        } catch(e) { console.error(`Error creating payment row:`, payment, e); }
    });
}

function populatePoHistoryTable(pos) {
    // Using IDs from the HTML provided
    const tableBody = document.getElementById('poHistoryTable')?.querySelector('tbody'); // Correct table ID
    const errorDisplay = document.getElementById('supplierPoListError'); // Error display for this table

    if (!tableBody) { console.error("PO history table body not found!"); return; }

    tableBody.innerHTML = ''; // Clear previous entries
    if (errorDisplay) errorDisplay.style.display = 'none'; // Hide error

    if (!pos || pos.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">No purchase orders found.</td></tr>'; // Ensure colspan matches headers
        return;
    }

    // Sort by order date, most recent first
    pos.sort((a, b) => (b.orderDate?.toDate?.() || 0) - (a.orderDate?.toDate?.() || 0));

    pos.forEach((po) => {
        try {
            const row = tableBody.insertRow();
            row.insertCell(0).textContent = formatDate(po.orderDate); // PO Date
            row.insertCell(1).textContent = po.poNumber || `PO-${po.id.substring(0, 6)}`; // PO Number
            row.insertCell(2).textContent = po.description || '-'; // Description (assuming it exists)
            const amountCell = row.insertCell(3); // Amount
            amountCell.textContent = formatCurrency(po.totalAmount);
            amountCell.classList.add('number-cell'); // Apply right-align style

            // Status (ensure this matches HTML structure, might need adjustment)
            const statusCell = row.insertCell(4);
            const statusSpan = document.createElement('span');
            // Assuming status field exists and getStatusClass works. Need to define status classes in CSS.
            statusSpan.className = `status-badge ${getStatusClass(po.status || po.paymentStatus)}`; // Use relevant status
            statusSpan.textContent = po.status || po.paymentStatus || 'Unknown'; // Display relevant status
            statusCell.appendChild(statusSpan);

        } catch (e) { console.error(`Error creating PO row:`, po, e); }
    });
}


function updateAccountSummary(poTotal, paymentTotal) {
    // Using IDs from the HTML provided
    const poDisplay = document.getElementById('totalPoValue');
    const paidDisplay = document.getElementById('totalPaymentsMade');
    const balanceDisplay = document.getElementById('outstandingBalance');
    const errorDisplay = document.getElementById('accountSummaryError'); // Error display for summary

    if (!poDisplay || !paidDisplay || !balanceDisplay) {
        console.error("Account summary elements missing");
        if (errorDisplay) { errorDisplay.textContent = 'UI elements missing for summary.'; errorDisplay.style.display = 'block'; }
        return;
    }
     if (errorDisplay) errorDisplay.style.display = 'none'; // Hide error

    const numPoTotal = parseFloat(poTotal) || 0;
    const numPaymentTotal = parseFloat(paymentTotal) || 0;
    const outstanding = numPoTotal - numPaymentTotal;

    poDisplay.textContent = formatCurrency(numPoTotal);
    paidDisplay.textContent = formatCurrency(numPaymentTotal);
    balanceDisplay.textContent = formatCurrency(outstanding);

    // Optional: Add classes for styling based on balance
    balanceDisplay.classList.remove('balance-due', 'balance-credit', 'balance-zero'); // Reset classes
    if (outstanding > 0.01) balanceDisplay.classList.add('balance-due'); // Needs CSS rule for .balance-due
    else if (outstanding < -0.01) balanceDisplay.classList.add('balance-credit'); // Needs CSS rule for .balance-credit
    else balanceDisplay.classList.add('balance-zero'); // Needs CSS rule for .balance-zero
}

function populatePoCheckboxListForPayment(pos) {
    // Using ID from the HTML provided
    const listContainer = document.getElementById('paymentLinkPOList');
    if (!listContainer) { console.error("PO Checkbox list container for payment not found!"); return; }
    listContainer.innerHTML = ''; // Clear previous items

    if (!pos || pos.length === 0) {
        listContainer.innerHTML = '<p>No POs found for this supplier.</p>'; // Simpler message
        return;
    }

    // Filter for POs that are not fully paid (or where paymentStatus isn't 'Paid')
    // Assumes POs have 'paymentStatus' and/or 'amountPaid' fields. Adjust logic if needed.
    const openPOs = pos.filter(po => {
        const total = parseFloat(po.totalAmount) || 0;
        const paid = parseFloat(po.amountPaid) || 0; // Check if amountPaid exists
        return po.paymentStatus !== 'Paid' && (total - paid > 0.01); // Only unpaid or partially paid
    });


    if (openPOs.length === 0) {
        listContainer.innerHTML = '<p>No open POs found (all seem paid).</p>';
        return;
    }

    openPOs.sort((a, b) => (b.orderDate?.toDate?.() || 0) - (a.orderDate?.toDate?.() || 0));

    openPOs.forEach((po, index) => {
        const total = parseFloat(po.totalAmount) || 0;
        const paid = parseFloat(po.amountPaid) || 0; // Assuming 'amountPaid' field exists on PO
        const balance = total - paid;

        const div = document.createElement('div');
        // div.className = 'po-checkbox-item'; // Add styling for this class if needed

        const checkboxId = `po_link_${po.id}`; // Use PO ID for uniqueness
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = checkboxId;
        checkbox.name = 'linkedPOs';
        checkbox.value = po.id;
        checkbox.dataset.poNumber = po.poNumber || `PO-${po.id.substring(0,6)}`; // Store PO number
        checkbox.dataset.poBalance = balance.toFixed(2); // Store balance

        const label = document.createElement('label');
        label.htmlFor = checkboxId;
        // Added space before amount
        label.textContent = ` ${po.poNumber || po.id.substring(0, 6)} (${formatDate(po.orderDate)}) - Balance: ${formatCurrency(balance)}`;

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

     // Show loading states immediately (optional)
     // document.getElementById('loadingIndicator').style.display = 'block'; // Assuming a loading indicator exists
     clearError(); // Clear general errors

     let supplierData = null;
     let payments = [];
     let purchaseOrders = [];
     let paymentSum = 0;
     let poSum = 0;

     try {
         const supplierRef = doc(db, "suppliers", currentSupplierId);
         const supplierSnap = await getDoc(supplierRef);
         if (!supplierSnap.exists()) throw new Error("Supplier not found");

         supplierData = { id: supplierSnap.id, ...supplierSnap.data() };
         currentSupplierData = supplierData; // Store globally
         populateSupplierDetails(supplierData); // Populate supplier details section

         // Fetch payments and POs in parallel
         const [paymentsSnapshot, poSnapshot] = await Promise.all([
              getDocs(query(collection(db, "supplier_payments"), where("supplierId", "==", currentSupplierId))),
              getDocs(query(collection(db, "purchaseOrders"), where("supplierId", "==", currentSupplierId)))
         ]);

         // Process Payments
         payments = paymentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
         supplierPaymentsData = payments; // Store globally
         paymentSum = payments.reduce((sum, p) => sum + (parseFloat(p.paymentAmount) || 0), 0);
         populatePaymentHistory(payments); // Populate payment history table

         // Process Purchase Orders
         purchaseOrders = poSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
         purchaseOrdersData = purchaseOrders; // Store globally
         poSum = purchaseOrders.reduce((sum, po) => sum + (parseFloat(po.totalAmount) || 0), 0);
         populatePoHistoryTable(purchaseOrders); // Populate PO history table

         // Update Account Summary
         updateAccountSummary(poSum, paymentSum);

         setupEventListeners(); // Setup listeners only after initial data load is successful

     } catch (error) {
         console.error("Error loading supplier account data:", error);
         displayError(`Error loading data: ${error.message}. Please check connection or Supplier ID.`);
         // Clear UI or show error states
         if (!supplierData) populateSupplierDetails(null); // Clear details if supplier wasn't found
         populatePaymentHistory([]);
         populatePoHistoryTable([]);
         updateAccountSummary(0, 0);
         // Maybe disable buttons if data load failed
         const addPaymentBtn = document.getElementById('addPaymentMadeBtn');
         const editSupplierBtn = document.getElementById('editSupplierBtn'); // Corrected ID from HTML
         if(addPaymentBtn) addPaymentBtn.disabled = true;
         if(editSupplierBtn) editSupplierBtn.disabled = true;

     } finally {
         // Hide loading indicator
         // document.getElementById('loadingIndicator').style.display = 'none';
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
    const poListContainer = document.getElementById('paymentLinkPOList');

    if (!modal || !form || !supplierNameSpan || !dateInput || !poListContainer) {
        console.error("Payment modal elements missing.");
        alert("Could not open payment form. Required elements are missing.");
        return;
    }

    clearError('paymentMadeError'); // Clear errors specific to this modal
    form.reset(); // Reset form fields

    supplierNameSpan.textContent = currentSupplierData.name || 'Supplier';

    // Set default date to today
    try { dateInput.valueAsDate = new Date(); }
    catch(e) { dateInput.value = new Date().toISOString().slice(0,10); } // Fallback for older browsers

    // Populate Checkbox list with open POs
    populatePoCheckboxListForPayment(purchaseOrdersData);

    modal.style.display = 'flex'; // Show the modal
}
function closePaymentModal(){
    const modal = document.getElementById('paymentMadeModal');
    if(modal) modal.style.display = 'none';
}

async function handleSavePayment(event) {
    event.preventDefault();
    if (!currentSupplierId || !db) {
        displayError("Cannot save payment. DB connection or Supplier ID missing.", "paymentMadeError"); return;
    }

    // Using IDs from HTML
    const amountInput = document.getElementById('paymentAmount');
    const dateInput = document.getElementById('paymentDate');
    const methodInput = document.getElementById('paymentMode'); // Correct ID from HTML
    const referenceInput = document.getElementById('paymentReference'); // Correct ID from HTML
    const poListContainer = document.getElementById('paymentLinkPOList');
    const saveBtn = document.getElementById('savePaymentBtn');

    if (!amountInput || !dateInput || !methodInput || !referenceInput || !poListContainer || !saveBtn) {
         displayError("Payment form elements missing.", "paymentMadeError"); return;
    }

    const amount = parseFloat(amountInput.value);
    const paymentDateStr = dateInput.value;
    const method = methodInput.value;
    const reference = referenceInput.value.trim();

    if (isNaN(amount) || amount <= 0) { displayError("Please enter a valid payment amount.", "paymentMadeError"); amountInput.focus(); return; }
    if (!paymentDateStr) { displayError("Please select a payment date.", "paymentMadeError"); dateInput.focus(); return; }
    if (!method) { displayError("Please select a payment mode.", "paymentMadeError"); methodInput.focus(); return; }

    // Get selected POs from checkboxes
    const selectedCheckboxes = poListContainer.querySelectorAll('input[name="linkedPOs"]:checked');
    const linkedPoIds = Array.from(selectedCheckboxes).map(cb => cb.value);
    const linkedPoNumbers = Array.from(selectedCheckboxes).map(cb => cb.dataset.poNumber);

    saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; clearError('paymentMadeError');

    try {
        // Convert date string to Firestore Timestamp
        // Ensure time is considered start of day in local timezone if only date is picked
        const localDate = new Date(paymentDateStr + 'T00:00:00');
        const paymentDate = Timestamp.fromDate(localDate);

        const paymentData = {
            supplierId: currentSupplierId,
            supplierName: currentSupplierData?.name || 'N/A',
            paymentAmount: amount,
            paymentDate: paymentDate,
            mode: method, // Use 'mode' as field name based on HTML ID
            reference: reference, // Use 'reference' as field name
            createdAt: serverTimestamp(),
            linkedPoIds: linkedPoIds || [], // Store array of IDs
            linkedPoNumbers: linkedPoNumbers || [] // Store array of Numbers
        };

        // Save the payment document
        const paymentDocRef = await addDoc(collection(db, "supplier_payments"), paymentData);
        console.log("Payment recorded successfully with ID:", paymentDocRef.id);

        // --- TODO: Implement PO Status/Amount Update Logic using WriteBatch ---
        if (linkedPoIds.length > 0) {
             console.warn(`TODO: Need to implement logic to update payment status/amount for ${linkedPoIds.length} linked POs: ${linkedPoIds.join(', ')}`);
             // Outline: Use writeBatch to update amountPaid and paymentStatus on linked PO documents.
             // You'll need to fetch each PO doc within a transaction or carefully manage updates.
             // After batch commit, refresh local PO data and UI.
        }
        // --- End TODO ---

        // Refresh UI Optimistically
        const newPayment = { id: paymentDocRef.id, ...paymentData, createdAt: Timestamp.now() }; // Simulate serverTimestamp locally
        supplierPaymentsData.push(newPayment); // Add to local cache
        populatePaymentHistory(supplierPaymentsData); // Re-render payment table

        // Recalculate and update summary
        const currentPoSum = purchaseOrdersData.reduce((sum, po) => sum + (parseFloat(po.totalAmount) || 0), 0);
        const newPaymentSum = supplierPaymentsData.reduce((sum, p) => sum + (parseFloat(p.paymentAmount) || 0), 0);
        updateAccountSummary(currentPoSum, newPaymentSum);

        // Optionally refresh PO list if statuses were potentially updated by the TODO logic
        // populatePoHistoryTable(purchaseOrdersData);

        closePaymentModal();
        alert("Payment recorded successfully!"); // Provide user feedback

    } catch (error) {
        console.error("Error saving payment:", error);
        displayError(`Failed to save payment: ${error.message}`, "paymentMadeError");
    } finally {
        saveBtn.disabled = false; // Re-enable button
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Payment';
    }
}


// Edit Supplier Modal
function openEditSupplierModal(){
    // Using IDs from HTML
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

    if(!modal || !form || !nameInput || !companyInput || !whatsappInput || !contactInput || !emailInput || !gstInput || !addressInput || !hiddenIdInput || !currentSupplierData) {
        console.error("Edit supplier modal elements or supplier data missing.");
        alert("Could not open edit form."); return;
    }

    clearError('editSupplierError'); // Clear errors specific to this modal
    form.reset();

    // Populate form with current data
    hiddenIdInput.value = currentSupplierId;
    nameInput.value = currentSupplierData.name || '';
    companyInput.value = currentSupplierData.companyName || '';
    whatsappInput.value = currentSupplierData.whatsappNo || '';
    contactInput.value = currentSupplierData.contact || '';
    emailInput.value = currentSupplierData.email || '';
    gstInput.value = currentSupplierData.gstNo || '';
    addressInput.value = currentSupplierData.address || '';

    modal.style.display = 'flex'; // Show modal
}
function closeEditSupplierModal(){
    const modal = document.getElementById('editSupplierModal');
    if(modal) modal.style.display = 'none';
}

async function handleEditSupplierSubmit(event){
    event.preventDefault();
    if (!currentSupplierId || !db) {
        displayError("Cannot update supplier. DB connection or Supplier ID missing.", "editSupplierError"); return;
    }

    const form = event.target;
    const saveBtn = document.getElementById('updateSupplierBtn'); // Correct button ID from HTML

    if(!form || !saveBtn) { displayError("Edit form or save button not found.", "editSupplierError"); return; }

    // Gather updated data from form (using IDs from HTML)
    const updatedData = {
         name: form.querySelector('#editSupplierNameInput')?.value.trim(),
         name_lowercase: form.querySelector('#editSupplierNameInput')?.value.trim().toLowerCase(), // Keep lowercase for searching/sorting
         companyName: form.querySelector('#editSupplierCompanyInput')?.value.trim(),
         whatsappNo: form.querySelector('#editSupplierWhatsappInput')?.value.trim(),
         contact: form.querySelector('#editSupplierContactInput')?.value.trim(),
         email: form.querySelector('#editSupplierEmailInput')?.value.trim(),
         gstNo: form.querySelector('#editSupplierGstInput')?.value.trim(),
         address: form.querySelector('#editSupplierAddressInput')?.value.trim(),
         updatedAt: serverTimestamp() // Record update time
    };

    if (!updatedData.name) { displayError("Supplier Name is required.", "editSupplierError"); return; }

    saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; clearError('editSupplierError');

    try {
        const supplierRef = doc(db, "suppliers", currentSupplierId);
        await updateDoc(supplierRef, updatedData); // Update Firestore document

        // Update local cache immediately for faster UI response
        currentSupplierData = { ...currentSupplierData, ...updatedData, updatedAt: Timestamp.now() }; // Use local timestamp as approximation

        populateSupplierDetails(currentSupplierData); // Re-render supplier details section
        closeEditSupplierModal(); // Close modal on success
        alert("Supplier details updated successfully!"); // Feedback to user

    } catch(error) {
        console.error("Error updating supplier details:", error);
        displayError(`Failed to update details: ${error.message}`, "editSupplierError");
    } finally {
        saveBtn.disabled = false; // Re-enable button
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Update Supplier';
    }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    if (listenersAttached) {
        console.log("Listeners already attached.");
        return; // Prevent attaching multiple times
    }
    console.log("Setting up event listeners...");

    // Buttons outside modals
    const addPayBtn = document.getElementById('addPaymentMadeBtn');
    const editSupplierBtn = document.getElementById('editSupplierBtn'); // Correct ID from HTML
    const backBtn = document.getElementById('backToListBtn'); // Correct ID from HTML

    if (addPayBtn) addPayBtn.addEventListener('click', openPaymentModal); else console.warn("Add Payment Btn not found");
    if (editSupplierBtn) editSupplierBtn.addEventListener('click', openEditSupplierModal); else console.warn("Edit Supplier Btn not found");
    if (backBtn) backBtn.addEventListener('click', () => { window.location.href = 'supplier_management.html'; }); else console.warn("Back to List Btn not found");


    // Payment Modal elements
    const closeBtnPay = document.getElementById('closePaymentMadeModalBtn');
    const cancelBtnPay = document.getElementById('cancelPaymentBtn'); // Correct ID from HTML
    const payModal = document.getElementById('paymentMadeModal');
    const payForm = document.getElementById('paymentMadeForm');

    if (closeBtnPay) closeBtnPay.addEventListener('click', closePaymentModal); else console.warn("Close Payment Modal Btn not found");
    if (cancelBtnPay) cancelBtnPay.addEventListener('click', closePaymentModal); else console.warn("Cancel Payment Btn not found");
    if (payModal) payModal.addEventListener('click', (event) => { if (event.target === payModal) closePaymentModal(); }); else console.warn("Payment Modal not found");
    if (payForm) payForm.addEventListener('submit', handleSavePayment); else console.warn("Payment Form not found");

    // Edit Supplier Modal elements
    const closeEditBtn = document.getElementById('closeEditSupplierModalBtn'); // Correct ID from HTML
    const cancelEditBtn = document.getElementById('cancelEditSupplierBtn'); // Correct ID from HTML
    const editModal = document.getElementById('editSupplierModal');
    const editForm = document.getElementById('editSupplierForm');

    if (closeEditBtn) closeEditBtn.addEventListener('click', closeEditSupplierModal); else console.warn("Close Edit Supplier Btn not found");
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditSupplierModal); else console.warn("Cancel Edit Supplier Btn not found");
    if (editModal) editModal.addEventListener('click', (event) => { if (event.target === editModal) closeEditSupplierModal(); }); else console.warn("Edit Supplier Modal not found");
    if (editForm) editForm.addEventListener('submit', handleEditSupplierSubmit); else console.warn("Edit Supplier Form not found");

    listenersAttached = true; // Mark listeners as attached
    console.log("Event listeners setup complete.");
}

// --- Global Initialization & Auto-run ---
// This function ensures initialization runs only once, even if DOMContentLoaded fires multiple times or script is re-evaluated
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
window.initializeSupplierDetailPage = async () => {
     console.log("initializeSupplierDetailPage started.");
     if (supplierDetailPageInitialized) {
         console.log("Supplier detail page already initialized.");
         return; // Prevent re-initialization
     }
     supplierDetailPageInitialized = true; // Mark as initialized
     clearError(); // Clear any previous general errors

     const mainContent = document.getElementById('detailMainContent');
     if (mainContent) {
         mainContent.style.visibility = 'visible'; // Make content visible
     } else {
         console.error("Main content container ('detailMainContent') missing!");
     }

     // Check Firebase Auth State - Crucial: Load data only if user is logged in
     onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("User is authenticated. Loading supplier data...");
             // Check if Firestore DB instance is ready
             if (typeof db === 'undefined' || !db) {
                 console.error("Firestore db instance not available!");
                 displayError("Database connection failed. Please try again.");
                 return;
             }
             // Load the supplier data now that user is confirmed logged in
             await loadSupplierAccountData();
        } else {
            console.warn("User is not authenticated. Redirecting or showing login message.");
             displayError("You must be logged in to view supplier details.");
             // Optional: Redirect to login page
             // window.location.href = '/login.html';
             // Or disable interactive elements
             const addPaymentBtn = document.getElementById('addPaymentMadeBtn');
             const editSupplierBtn = document.getElementById('editSupplierBtn');
             if(addPaymentBtn) addPaymentBtn.disabled = true;
             if(editSupplierBtn) editSupplierBtn.disabled = true;
        }
    });


};

// Trigger initialization when the DOM is ready
if (document.readyState === 'loading') {
    console.log("DOM is loading, attaching listener...");
    document.addEventListener('DOMContentLoaded', attemptInitialization);
} else {
    console.log("DOM already loaded, attempting initialization directly...");
    attemptInitialization(); // If DOM is already loaded, run initialization attempt now
}