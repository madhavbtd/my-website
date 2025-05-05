// js/supplier_account_detail.js - v8 (Stabilized & Logging Enhanced)

// --- Firebase Imports ---
import { db, auth } from './firebase-init.js';
import {
    doc, getDoc, collection, query, where, getDocs, orderBy as firestoreOrderBy,
    Timestamp, addDoc, serverTimestamp, updateDoc, deleteDoc, runTransaction, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// Auth import not strictly needed here if auth checks happen in HTML head script
// import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Global State ---
let currentSupplierId = null;
let currentSupplierData = null;
let purchaseOrdersData = []; // Consider clearing or managing this if page isn't fully reloaded
let supplierLedgerData = []; // Combined ledger entries
let listenersAttached = false;
let supplierDetailPageInitialized = false;
let isRefreshingData = false; // Flag to prevent concurrent refreshes
let dataLoadSuccess = false; // Track if initial data load was successful

// --- Helper Functions ---

// Format Currency (Indian Rupees)
function formatCurrency(value) {
    const number = Number(value);
    if (isNaN(number)) {
        return '₹ 0.00';
    }
    return `₹ ${number.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Format Firestore Timestamp to Date (DD Mon YYYY)
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    let date;
    if (timestamp instanceof Timestamp) {
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else if (typeof timestamp === 'string') {
        date = new Date(timestamp); // Attempt to parse string
    } else if (typeof timestamp === 'number') {
        date = new Date(timestamp); // Attempt to parse milliseconds
    }
     else {
        console.warn("Invalid date format received:", timestamp);
        return 'Invalid Date';
    }

    if (isNaN(date.getTime())) {
         console.warn("Could not parse date:", timestamp);
         return 'Invalid Date';
     }

    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Format Firestore Timestamp to YYYY-MM-DD for date inputs
function formatDateForInput(timestamp) {
    if (!timestamp) return '';
    let date;
    if (timestamp instanceof Timestamp) {
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        date = timestamp; // Already a Date object
    } else {
        return ''; // Or try parsing if other formats are expected
    }
    // Adjust for timezone offset to get correct YYYY-MM-DD
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Add 1 for month, pad
    const day = date.getDate().toString().padStart(2, '0'); // Pad day
    return `${year}-${month}-${day}`;
}

// Display Error Messages
function displayError(message, elementId = 'generalErrorDisplay') {
    console.error("Displaying Error:", message, "Target Element ID:", elementId);
    try {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        } else {
            console.error(`Error element with ID "${elementId}" not found.`);
            // Fallback to general error display if specific one fails
            const generalError = document.getElementById('generalErrorDisplay');
            if (generalError && elementId !== 'generalErrorDisplay') {
                 generalError.textContent = `Error (${elementId}): ${message}`;
                 generalError.classList.remove('hidden');
            } else if (!generalError) {
                 alert(`ERROR: ${message}`); // Last resort
            }
        }
    } catch (e) {
        console.error("Exception in displayError:", e);
        alert(`SYSTEM ERROR displaying message: ${message}`);
    }
}

// Clear Error Messages
function clearError(elementId = null) {
    if (elementId) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.classList.add('hidden');
        }
    } else {
        // Clear all common error fields if no specific ID is given
        const errorElements = document.querySelectorAll('.error-message');
        errorElements.forEach(el => {
            el.textContent = '';
            el.classList.add('hidden');
        });
    }
}

// --- Action Button State Management ---
function toggleActionButtons(enable) {
    console.log(`>>> toggleActionButtons called with: ${enable}`); // Enhanced Log
    const buttons = [
        'editSupplierBtn', 'recordPaymentBtn', 'addAdjustmentBtn',
        'toggleStatusBtn', 'deleteSupplierBtn'
        // Add other action button IDs here if any
    ];
    buttons.forEach(id => {
        const button = document.getElementById(id);
        if (button) {
            const wasDisabled = button.disabled;
            button.disabled = !enable;
            // Log the change for easier debugging
            console.log(`   Button #${id}: disabled set from ${wasDisabled} to ${button.disabled}`);
        } else {
            // This warning is important - check HTML if it appears
            console.warn(`   Button #${id} not found for toggling.`);
        }
    });
    console.log(`<<< toggleActionButtons finished. State: ${enable ? 'ENABLED' : 'DISABLED'}`); // Enhanced Log
}


// --- Data Fetching and Rendering ---

// Fetch Core Supplier Details
async function fetchSupplierDetails(supplierId) {
    console.log(`Workspaceing details for supplier ID: ${supplierId}`);
    const docRef = doc(db, "suppliers", supplierId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        console.log("Supplier document data:", docSnap.data());
        currentSupplierData = { id: docSnap.id, ...docSnap.data() };
        return currentSupplierData;
    } else {
        console.error(`No supplier found with ID: ${supplierId}`);
        throw new Error("Supplier not found."); // Throw error to be caught by caller
    }
}

// Fetch Related Data (POs, Payments, Adjustments)
async function fetchRelatedData(supplierId) {
    console.log("Fetching related POs, Payments, Adjustments...");
    const poQuery = query(collection(db, "purchaseOrders"), where("supplierId", "==", supplierId), firestoreOrderBy("poDate", "desc"));
    const paymentQuery = query(collection(db, "supplierPayments"), where("supplierId", "==", supplierId), firestoreOrderBy("paymentDate", "desc"));
    const adjustmentQuery = query(collection(db, "supplierAdjustments"), where("supplierId", "==", supplierId), firestoreOrderBy("adjustmentDate", "desc")); // Fetch adjustments

    try {
        const [poSnapshot, paymentSnapshot, adjustmentSnapshot] = await Promise.all([
            getDocs(poQuery),
            getDocs(paymentQuery),
            getDocs(adjustmentQuery)
        ]);

        purchaseOrdersData = poSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const supplierPaymentsData = paymentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const supplierAdjustmentsData = adjustmentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); // Store adjustments

        console.log(`Workspaceed ${purchaseOrdersData.length} POs, ${supplierPaymentsData.length} Payments, ${supplierAdjustmentsData.length} Adjustments.`);

        return { purchaseOrdersData, supplierPaymentsData, supplierAdjustmentsData };

    } catch (error) {
        console.error("Error fetching related data:", error);
        throw new Error("Failed to fetch related financial data."); // Propagate error
    }
}

// Populate Supplier Details on the Page
function populateSupplierDetails(supplier) {
    console.log("Populating supplier details into DOM...");
    if (!supplier) {
        console.error("Cannot populate details: supplier data is null.");
        return;
    }
    document.getElementById('supplierNameHeader').textContent = supplier.name || 'N/A';
    document.getElementById('details-supplierId').textContent = supplier.id || 'N/A';
    document.getElementById('details-name').textContent = supplier.name || 'N/A';
    document.getElementById('details-company').textContent = supplier.companyName || 'N/A';
    document.getElementById('details-whatsapp').textContent = supplier.whatsappNumber || 'N/A';
    document.getElementById('details-contact').textContent = supplier.contactNumber || 'N/A';
    document.getElementById('details-email').textContent = supplier.email || 'N/A';
    document.getElementById('details-gst').textContent = supplier.gstNumber || 'N/A';
    document.getElementById('details-address').textContent = supplier.address || 'N/A';
    document.getElementById('details-addedOn').textContent = supplier.addedOn ? formatDate(supplier.addedOn) : 'N/A';
    document.getElementById('details-remarks').textContent = supplier.remarks || 'No remarks.';

    // Status Badge
    const statusBadge = document.getElementById('details-status');
    statusBadge.textContent = supplier.status || 'N/A';
    statusBadge.className = 'status-badge'; // Reset classes
    if (supplier.status === 'active') {
        statusBadge.classList.add('status-active');
    } else if (supplier.status === 'inactive') {
        statusBadge.classList.add('status-inactive');
    }

    // Update Toggle Button Text/Class
    const toggleBtn = document.getElementById('toggleStatusBtn');
    if (toggleBtn) {
        if (supplier.status === 'active') {
            toggleBtn.innerHTML = '<i class="fas fa-power-off"></i> Deactivate Supplier';
            toggleBtn.classList.remove('enable-button', 'success-button');
            toggleBtn.classList.add('disable-button', 'warning-button'); // Use standard button color classes
        } else {
            toggleBtn.innerHTML = '<i class="fas fa-power-off"></i> Activate Supplier';
            toggleBtn.classList.remove('disable-button', 'warning-button');
            toggleBtn.classList.add('enable-button', 'success-button'); // Use standard button color classes
        }
    }
    console.log("Supplier details populated.");
}

// Calculate and Populate Account Summary
function updateAccountSummary(supplierId, pos, payments, adjustments) {
     console.log("Calculating account summary...");
    let totalPOValue = 0;
    let totalPaymentsMade = 0;
    let totalAdjustmentsDebit = 0; // Amount owed by you increases (like returns)
    let totalAdjustmentsCredit = 0; // Amount owed by you decreases (like discounts)

    pos.forEach(po => {
        totalPOValue += Number(po.poAmount) || 0;
    });

    payments.forEach(payment => {
        totalPaymentsMade += Number(payment.paymentAmount) || 0;
    });

    adjustments.forEach(adj => {
        const amount = Number(adj.adjustmentAmount) || 0;
        if (adj.adjustmentType === 'debit') {
            totalAdjustmentsDebit += amount;
        } else if (adj.adjustmentType === 'credit') {
            totalAdjustmentsCredit += amount;
        }
    });

    // Balance Calculation:
    // Start with total value of goods purchased (POs)
    // Subtract payments made by you
    // Subtract credits received (discounts, etc.)
    // Add debits (refunds received for returns etc. - reduces what you owe)
    // Balance = POs - Payments - Credits + Debits (if Debit means refund TO you)
    // OR: Balance = POs - Payments - Credits - Debits (if Debit means additional charge TO you) -> Let's assume Debit means Refund to you.
    let outstandingBalance = totalPOValue - totalPaymentsMade - totalAdjustmentsCredit + totalAdjustmentsDebit;

    console.log(`Summary: POs=${totalPOValue}, Payments=${totalPaymentsMade}, AdjDebit=${totalAdjustmentsDebit}, AdjCredit=${totalAdjustmentsCredit}, Balance=${outstandingBalance}`);

    document.getElementById('summary-poValue').textContent = formatCurrency(totalPOValue);
    document.getElementById('summary-paymentsMade').textContent = formatCurrency(totalPaymentsMade);
    document.getElementById('summary-adjustmentsDebit').textContent = formatCurrency(totalAdjustmentsDebit);
    document.getElementById('summary-adjustmentsCredit').textContent = formatCurrency(totalAdjustmentsCredit);

    const balanceElement = document.getElementById('summary-balance');
    balanceElement.textContent = formatCurrency(Math.abs(outstandingBalance)); // Show absolute value
    balanceElement.className = 'balance-info'; // Reset class
    if (outstandingBalance > 0.01) { // Amount you still owe the supplier
        balanceElement.textContent += ' Due';
        balanceElement.classList.add('balance-due'); // You owe (Danger style)
    } else if (outstandingBalance < -0.01) { // Supplier owes you / Credit balance
        balanceElement.textContent += ' Credit';
        balanceElement.classList.add('balance-credit'); // You have credit (Success style)
    } else { // Zero balance
        balanceElement.textContent += ' Settled';
        balanceElement.classList.add('balance-info'); // Settled (Muted style)
    }
     console.log("Account summary updated.");
}

// Populate PO History Table
function populatePOTable(pos) {
    console.log("Populating PO table...");
    const tbody = document.getElementById('purchaseOrdersTable').querySelector('tbody');
    if (!tbody) { console.error("PO table body not found!"); return; }
    tbody.innerHTML = ''; // Clear existing rows

    if (pos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No purchase orders found for this supplier.</td></tr>';
        return;
    }

    pos.forEach(po => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${po.poDate ? formatDate(po.poDate) : 'N/A'}</td>
            <td>${po.poNumber || 'N/A'}</td>
            <td>${po.status || 'N/A'}</td>
            <td class="text-right">${formatCurrency(po.poAmount)}</td>
            <td>${po.description || ''}</td>
        `;
    });
    console.log("PO table populated.");
}

// Generate and Populate Supplier Ledger
function populateLedgerTable(supplierId, pos, payments, adjustments) {
    console.log("Generating and populating ledger...");
    const tbody = document.getElementById('supplierLedgerTable').querySelector('tbody');
     if (!tbody) { console.error("Ledger table body not found!"); return; }
    tbody.innerHTML = ''; // Clear existing rows

    supplierLedgerData = []; // Reset combined data

    // Add POs (Debit - increases amount owed by you)
    pos.forEach(po => {
        supplierLedgerData.push({
            date: po.poDate?.toDate() || new Date(0), // Ensure Date object for sorting
            type: 'PO',
            description: `PO #${po.poNumber || 'N/A'} (${po.description || ''})`,
            debit: Number(po.poAmount) || 0,
            credit: 0,
            refId: po.id
        });
    });

    // Add Payments (Credit - decreases amount owed by you)
    payments.forEach(p => {
        supplierLedgerData.push({
            date: p.paymentDate?.toDate() || new Date(0),
            type: 'Payment',
            description: `Payment Received (${p.paymentReference || 'No Ref'})`,
            debit: 0,
            credit: Number(p.paymentAmount) || 0,
            refId: p.id
        });
    });

    // Add Adjustments
    adjustments.forEach(adj => {
        supplierLedgerData.push({
            date: adj.adjustmentDate?.toDate() || new Date(0),
            type: 'Adjustment',
            description: `${adj.adjustmentType.charAt(0).toUpperCase() + adj.adjustmentType.slice(1)}: ${adj.adjustmentDescription || 'N/A'}`,
            debit: adj.adjustmentType === 'debit' ? (Number(adj.adjustmentAmount) || 0) : 0,
            credit: adj.adjustmentType === 'credit' ? (Number(adj.adjustmentAmount) || 0) : 0,
            refId: adj.id
        });
    });

    // Sort ledger entries by date (ascending)
    supplierLedgerData.sort((a, b) => a.date - b.date);

    if (supplierLedgerData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No transactions found for this supplier.</td></tr>';
        return;
    }

    // Calculate running balance and populate table
    let runningBalance = 0;
    supplierLedgerData.forEach(entry => {
        // Balance increases with Debits (you owe more), decreases with Credits (you owe less)
        runningBalance += entry.debit - entry.credit;
        entry.runningBalance = runningBalance; // Store balance for potential future use

        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${formatDate(entry.date)}</td>
            <td>${entry.type}</td>
            <td>${entry.description}</td>
            <td class="text-right">${entry.debit !== 0 ? formatCurrency(entry.debit) : '-'}</td>
            <td class="text-right">${entry.credit !== 0 ? formatCurrency(entry.credit) : '-'}</td>
            <td class="text-right ${runningBalance > 0.01 ? 'ledger-balance-negative' : (runningBalance < -0.01 ? 'ledger-balance-positive' : 'ledger-balance-zero')}">
                ${formatCurrency(Math.abs(runningBalance))} ${runningBalance > 0.01 ? 'Due' : (runningBalance < -0.01 ? 'Credit' : '')}
            </td>
        `;
    });
     console.log("Ledger table populated.");
}


// --- Main Data Loading Orchestrator ---
async function loadSupplierPageData() {
    if (isRefreshingData) {
        console.log("Data refresh already in progress, skipping.");
        return;
    }
    if (!currentSupplierId) {
        displayError("Supplier ID is missing. Cannot load data.");
        console.error("loadSupplierPageData called without currentSupplierId.");
        return;
    }

    console.log(`--- Starting data load for supplier: ${currentSupplierId} ---`);
    isRefreshingData = true;
    dataLoadSuccess = false; // Reset success flag
    toggleActionButtons(false); // Disable buttons during load
    const loadingIndicator = document.getElementById('loadingIndicator');
    if(loadingIndicator) loadingIndicator.style.display = 'flex'; // Show spinner
    clearError(); // Clear previous errors

    try {
        // Fetch all data in parallel where possible
        const supplier = await fetchSupplierDetails(currentSupplierId); // Fetch core details first
        populateSupplierDetails(supplier); // Populate basic info immediately

        const { purchaseOrdersData: pos, supplierPaymentsData: payments, supplierAdjustmentsData: adjustments } = await fetchRelatedData(currentSupplierId);

        // Populate tables and summary
        populatePOTable(pos);
        updateAccountSummary(currentSupplierId, pos, payments, adjustments);
        populateLedgerTable(currentSupplierId, pos, payments, adjustments); // Generate ledger last

        console.log("--- All supplier page data fetched and displayed successfully ---");
        dataLoadSuccess = true; // Mark load as successful

    } catch (error) {
        console.error("--- Error during supplier page data load:", error.message, error);
        displayError(`Failed to load supplier details: ${error.message}. Please try refreshing.`);
        dataLoadSuccess = false; // Mark load as failed
        // Optionally clear tables or show specific error messages in table areas
        document.getElementById('purchaseOrdersTable').querySelector('tbody').innerHTML = `<tr><td colspan="5" class="text-center error-message">Failed to load POs</td></tr>`;
        document.getElementById('supplierLedgerTable').querySelector('tbody').innerHTML = `<tr><td colspan="6" class="text-center error-message">Failed to load ledger</td></tr>`;

    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none'; // Hide spinner
        // Enable buttons ONLY if the entire process was successful
        if (dataLoadSuccess) {
             toggleActionButtons(true);
             console.log("Data loaded successfully, action buttons enabled.");
        } else {
             console.error("Data load failed or incomplete, action buttons remain disabled.");
             // Optionally keep certain buttons disabled even on partial success
             // toggleActionButtons(false); // Ensure they stay disabled
        }
        isRefreshingData = false;
        console.log("--- loadSupplierPageData finished ---");
    }
}


// --- Modal Handling ---
function openModal(modalId) {
    clearError(); // Clear errors when opening any modal
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        console.log(`Modal opened: ${modalId}`);
    } else {
        console.error(`Modal with ID ${modalId} not found.`);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
         console.log(`Modal closed: ${modalId}`);
        // Optional: Reset form fields within the modal when closed
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
             clearError(`${modalId.replace('Modal','')}Error`); // Clear errors specific to this modal's form
        }
    }
}

// --- Event Listener Setup ---
function setupEventListeners() {
    if (listenersAttached) return; // Prevent attaching multiple times
    console.log("Setting up event listeners...");

    // Modal Open Buttons
    document.getElementById('editSupplierBtn')?.addEventListener('click', () => {
        if (!currentSupplierData) { displayError("Supplier data not loaded."); return; }
        // Pre-fill edit form
        document.getElementById('editSupplierName').value = currentSupplierData.name || '';
        document.getElementById('editSupplierCompany').value = currentSupplierData.companyName || '';
        document.getElementById('editSupplierWhatsapp').value = currentSupplierData.whatsappNumber || '';
        document.getElementById('editSupplierContact').value = currentSupplierData.contactNumber || '';
        document.getElementById('editSupplierEmail').value = currentSupplierData.email || '';
        document.getElementById('editSupplierGst').value = currentSupplierData.gstNumber || '';
        document.getElementById('editSupplierAddress').value = currentSupplierData.address || '';
        document.getElementById('editSupplierRemarks').value = currentSupplierData.remarks || '';
        openModal('editSupplierModal');
    });

    document.getElementById('recordPaymentBtn')?.addEventListener('click', () => {
         if (!currentSupplierData) { displayError("Supplier data not loaded."); return; }
        // Set default payment date to today
        document.getElementById('paymentDate').value = formatDateForInput(new Date());
        openModal('recordPaymentModal');
    });

     document.getElementById('addAdjustmentBtn')?.addEventListener('click', () => {
         if (!currentSupplierData) { displayError("Supplier data not loaded."); return; }
         // Set default adjustment date to today
        document.getElementById('adjustmentDate').value = formatDateForInput(new Date());
        document.getElementById('adjustmentTypeDebit').checked = true; // Default to Debit
        openModal('addAdjustmentModal');
    });

     document.getElementById('toggleStatusBtn')?.addEventListener('click', () => {
        if (!currentSupplierData) { displayError("Supplier data not loaded."); return; }
        const currentStatus = currentSupplierData.status;
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        document.getElementById('toggleSupplierName').textContent = currentSupplierData.name || 'this supplier';
        document.getElementById('toggleSupplierNewStatus').textContent = newStatus;
        // Show specific warning if deactivating
        const warningMsg = document.getElementById('toggleStatusWarning');
        if (newStatus === 'inactive') {
            warningMsg.textContent = "Deactivating will prevent adding new POs for this supplier.";
            warningMsg.classList.remove('hidden');
        } else {
            warningMsg.classList.add('hidden');
        }
        document.getElementById('confirmToggleStatusCheckbox').checked = false; // Reset checkbox
        document.getElementById('confirmToggleStatusBtn').disabled = true; // Disable confirm btn initially
        document.getElementById('confirmToggleStatusBtn').className = `button ${newStatus === 'active' ? 'success' : 'warning'}-button`; // Set button color based on action
         document.getElementById('confirmToggleStatusBtn').innerHTML = `<i class="fas fa-check"></i> Confirm ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`; // Update button text

        openModal('confirmToggleStatusModal');
     });

    document.getElementById('deleteSupplierBtn')?.addEventListener('click', () => {
         if (!currentSupplierData) { displayError("Supplier data not loaded."); return; }
        document.getElementById('deleteSupplierName').textContent = currentSupplierData.name || 'this supplier';
        document.getElementById('confirmDeleteSupplierCheckbox').checked = false; // Reset checkbox
        document.getElementById('confirmSupplierDeleteBtn').disabled = true; // Disable confirm btn initially
        openModal('confirmDeleteSupplierModal');
    });

    // Modal Close Buttons
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) closeModal(modal.id);
        });
    });
    document.querySelectorAll('.cancel-button').forEach(btn => {
         btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) closeModal(modal.id);
        });
    });
     // Close modal if clicking outside the modal content
     document.querySelectorAll('.modal').forEach(modal => {
         modal.addEventListener('click', (event) => {
             if (event.target === modal) { // Check if click is on the background overlay
                 closeModal(modal.id);
             }
         });
     });


    // Modal Form Submissions
    document.getElementById('editSupplierForm')?.addEventListener('submit', handleEditSupplierSubmit);
    document.getElementById('recordPaymentForm')?.addEventListener('submit', handleRecordPaymentSubmit);
    document.getElementById('addAdjustmentForm')?.addEventListener('submit', handleAddAdjustmentSubmit);

    // Confirmation Modal Logic
     const toggleCheckbox = document.getElementById('confirmToggleStatusCheckbox');
     const toggleConfirmBtn = document.getElementById('confirmToggleStatusBtn');
     if (toggleCheckbox && toggleConfirmBtn) {
        toggleCheckbox.addEventListener('change', () => {
            toggleConfirmBtn.disabled = !toggleCheckbox.checked;
        });
        toggleConfirmBtn.addEventListener('click', handleToggleStatus);
     } else { console.warn("Toggle confirmation elements not found."); }


     const deleteCheckbox = document.getElementById('confirmDeleteSupplierCheckbox');
     const deleteConfirmBtn = document.getElementById('confirmSupplierDeleteBtn');
      if (deleteCheckbox && deleteConfirmBtn) {
        deleteCheckbox.addEventListener('change', () => {
            deleteConfirmBtn.disabled = !deleteCheckbox.checked;
        });
        deleteConfirmBtn.addEventListener('click', handleDeleteSupplier);
      } else { console.warn("Delete confirmation elements not found."); }


    listenersAttached = true;
    console.log("Event listeners attached.");
}

// --- Form Submission Handlers ---

// Handle Edit Supplier Form
async function handleEditSupplierSubmit(event) {
    event.preventDefault();
    console.log("Handling edit supplier submit...");
    const saveButton = document.getElementById('saveSupplierChangesBtn');
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    clearError('editSupplierError');

    try {
        const updatedData = {
            name: document.getElementById('editSupplierName').value.trim(),
            companyName: document.getElementById('editSupplierCompany').value.trim(),
            whatsappNumber: document.getElementById('editSupplierWhatsapp').value.trim(),
            contactNumber: document.getElementById('editSupplierContact').value.trim(),
            email: document.getElementById('editSupplierEmail').value.trim(),
            gstNumber: document.getElementById('editSupplierGst').value.trim().toUpperCase(),
            address: document.getElementById('editSupplierAddress').value.trim(),
            remarks: document.getElementById('editSupplierRemarks').value.trim(),
            // Ensure required fields are present
            // status and addedOn should not be updated here
        };

        if (!updatedData.name) {
            throw new Error("Supplier Name is required.");
        }

        const docRef = doc(db, "suppliers", currentSupplierId);
        await updateDoc(docRef, updatedData);

        console.log("Supplier details updated successfully.");
        closeModal('editSupplierModal');
        await loadSupplierPageData(); // Refresh page data

    } catch (error) {
        console.error("Error updating supplier:", error);
        displayError(`Failed to update supplier: ${error.message}`, 'editSupplierError');
    } finally {
        saveButton.disabled = false;
         saveButton.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }
}

// Handle Record Payment Form
async function handleRecordPaymentSubmit(event) {
    event.preventDefault();
    console.log("Handling record payment submit...");
    const submitButton = document.getElementById('submitPaymentBtn');
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Recording...';
    clearError('recordPaymentError');

    try {
        const paymentAmount = parseFloat(document.getElementById('paymentAmount').value);
        const paymentDateStr = document.getElementById('paymentDate').value;
        const paymentReference = document.getElementById('paymentReference').value.trim();

        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            throw new Error("Invalid Payment Amount.");
        }
        if (!paymentDateStr) {
            throw new Error("Payment Date is required.");
        }

        // Convert date string to Firestore Timestamp
        // Important: Create date as UTC midnight to avoid timezone issues if only date matters
        const dateParts = paymentDateStr.split('-'); // YYYY-MM-DD
        const paymentDate = Timestamp.fromDate(new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2])));


        const paymentData = {
            supplierId: currentSupplierId,
            supplierName: currentSupplierData?.name || 'N/A', // Include name for easier querying later
            paymentAmount: paymentAmount,
            paymentDate: paymentDate,
            paymentReference: paymentReference,
            recordedAt: serverTimestamp() // Timestamp when recorded
        };

        await addDoc(collection(db, "supplierPayments"), paymentData);

        console.log("Payment recorded successfully.");
        closeModal('recordPaymentModal');
        await loadSupplierPageData(); // Refresh page data

    } catch (error) {
        console.error("Error recording payment:", error);
        displayError(`Failed to record payment: ${error.message}`, 'recordPaymentError');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-check"></i> Record Payment';
    }
}

// Handle Add Adjustment Form
async function handleAddAdjustmentSubmit(event) {
    event.preventDefault();
    console.log("Handling add adjustment submit...");
    const submitButton = document.getElementById('submitAdjustmentBtn');
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    clearError('addAdjustmentError');

     try {
        const adjustmentType = document.querySelector('input[name="adjustmentType"]:checked')?.value;
        const adjustmentAmount = parseFloat(document.getElementById('adjustmentAmount').value);
        const adjustmentDateStr = document.getElementById('adjustmentDate').value;
        const adjustmentDescription = document.getElementById('adjustmentDescription').value.trim();

        if (!adjustmentType) throw new Error("Adjustment Type is required.");
        if (isNaN(adjustmentAmount) || adjustmentAmount <= 0) throw new Error("Invalid Adjustment Amount.");
        if (!adjustmentDateStr) throw new Error("Adjustment Date is required.");
        if (!adjustmentDescription) throw new Error("Description is required.");

        // Convert date string to Firestore Timestamp (UTC midnight)
        const dateParts = adjustmentDateStr.split('-');
        const adjustmentDate = Timestamp.fromDate(new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2])));

        const adjustmentData = {
            supplierId: currentSupplierId,
            supplierName: currentSupplierData?.name || 'N/A',
            adjustmentType: adjustmentType, // 'debit' or 'credit'
            adjustmentAmount: adjustmentAmount,
            adjustmentDate: adjustmentDate,
            adjustmentDescription: adjustmentDescription,
            recordedAt: serverTimestamp()
        };

        await addDoc(collection(db, "supplierAdjustments"), adjustmentData);

        console.log("Adjustment added successfully.");
        closeModal('addAdjustmentModal');
        await loadSupplierPageData(); // Refresh page data

    } catch (error) {
        console.error("Error adding adjustment:", error);
        displayError(`Failed to add adjustment: ${error.message}`, 'addAdjustmentError');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-check"></i> Add Adjustment';
    }
}

// Handle Toggle Supplier Status
async function handleToggleStatus() {
    if (!currentSupplierData) return;
    console.log("Handling toggle status confirm...");
    const confirmButton = document.getElementById('confirmToggleStatusBtn');
    confirmButton.disabled = true; // Disable while processing
    confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

    try {
        const currentStatus = currentSupplierData.status;
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

        const docRef = doc(db, "suppliers", currentSupplierId);
        await updateDoc(docRef, { status: newStatus });

        console.log(`Supplier status changed to ${newStatus}`);
        closeModal('confirmToggleStatusModal');
        await loadSupplierPageData(); // Refresh page data

    } catch (error) {
        console.error("Error toggling supplier status:", error);
        displayError(`Failed to update status: ${error.message}`, 'generalErrorDisplay'); // Show error on main page
        closeModal('confirmToggleStatusModal'); // Close modal even on error
    } finally {
       // Reset button state (handled by disabling action buttons during load)
       // Confirm button is inside modal which gets closed/reset
    }
}

// Handle Delete Supplier
async function handleDeleteSupplier() {
    if (!currentSupplierData) return;
    console.log("Handling delete supplier confirm...");
     const confirmButton = document.getElementById('confirmSupplierDeleteBtn');
    confirmButton.disabled = true;
    confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    try {
        const docRef = doc(db, "suppliers", currentSupplierId);
        await deleteDoc(docRef);

        console.log("Supplier deleted successfully.");
        alert("Supplier deleted successfully."); // Notify user
        window.location.href = 'supplier_management.html'; // Redirect back to list

    } catch (error) {
        console.error("Error deleting supplier:", error);
        displayError(`Failed to delete supplier: ${error.message}. Please try again.`, 'generalErrorDisplay');
        closeModal('confirmDeleteSupplierModal');
         confirmButton.disabled = false; // Re-enable button on error
         confirmButton.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Permanently';
    }
}

// --- Initialization ---
// Exported function to be called by the script in HTML head AFTER auth check
export function initializeSupplierDetailPage() {
    if (supplierDetailPageInitialized) {
        console.log("Supplier detail page already initialized.");
        return;
    }
     console.log("Initializing Supplier Detail Page...");

     const urlParams = new URLSearchParams(window.location.search);
     currentSupplierId = urlParams.get('id');

     if (!currentSupplierId) {
         console.error("No supplier ID found in URL.");
         displayError("Supplier ID not provided in the URL.", 'generalErrorDisplay');
         document.body.style.visibility = 'visible'; // Show body to display error
         const loadingIndicator = document.getElementById('loadingIndicator');
         if(loadingIndicator) loadingIndicator.style.display = 'none';
         return; // Stop initialization
     }
     console.log("Obtained Supplier ID:", currentSupplierId);

     const mainContent = document.getElementById('supplierAccountDetailContent');
     const body = document.body;

     if (mainContent) {
        mainContent.style.visibility = 'visible'; // Make content area visible
        body.style.visibility = 'visible'; // Make body visible
     }
     else {
        console.error("Critical: Main content container 'supplierAccountDetailContent' missing!");
        body.style.visibility = 'visible'; // Make body visible to show potential errors
        displayError("Page layout structure is broken.");
        return;
     }

     supplierDetailPageInitialized = true;
     clearError(); // Clear any initial errors

     // Setup listeners ONCE upon initialization
     if (!listenersAttached) {
         setupEventListeners();
     }

     // Load data now that auth is confirmed and page structure is ready
     console.log("Triggering initial data load...");
     loadSupplierPageData(); // Load all data

};

// Initial setup check (useful for debugging script load order)
console.log("supplier_account_detail.js (v8 - Stabilized) script processing finished.");
// The actual initialization call (initializeSupplierDetailPage) is now triggered
// by the inline script in the HTML head after successful authentication.