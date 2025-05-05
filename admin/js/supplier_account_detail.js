// js/supplier_account_detail.js - v8 (Corrected Collection Names)

// --- Firebase Imports ---\
// Ensure ALL necessary functions are imported or globally available via firebase-init.js
import { db, auth } from './firebase-init.js';
import {
    doc, getDoc, collection, query, where, getDocs, orderBy as firestoreOrderBy, // Renamed orderBy
    Timestamp, addDoc, serverTimestamp, updateDoc, deleteDoc, runTransaction, writeBatch
    // arrayUnion might be needed if status history is implemented for suppliers
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Global State ---\
let initializationAttempted = false;
let currentSupplierId = null;
let currentSupplierData = null;
let purchaseOrdersData = [];
let supplierPaymentsData = [];
let supplierAdjustmentsData = []; // Store adjustments
let listenersAttached = false;
let supplierDetailPageInitialized = false;
let isRefreshingData = false; // Flag to prevent concurrent refreshes

// --- Helper Functions ---\
function displayError(message, elementId = 'generalErrorDisplay') {
    console.error("Displaying Error:", message, "Target Element ID:", elementId);
    try {
        let errorElement = document.getElementById(elementId);
        // Fallback to general error display if specific ID not found (unless it *is* the general one)
        if (!errorElement && elementId !== 'generalErrorDisplay') {
            console.warn(`Element with ID '${elementId}' not found, falling back to 'generalErrorDisplay'.`);
            errorElement = document.getElementById('generalErrorDisplay');
        }

        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            // Ensure containing section is visible if error occurs during load
            if (elementId === 'generalErrorDisplay') {
                const mainContent = document.getElementById('supplierAccountDetailContent');
                if (mainContent) mainContent.style.visibility = 'visible';
                const loadingIndicator = document.getElementById('pageLoadingIndicator');
                 if (loadingIndicator) loadingIndicator.style.display = 'none';
            }
        } else {
            console.error("Fallback Error: Could not find any error display element.");
            alert("An error occurred: " + message); // Ultimate fallback
        }
    } catch (e) {
        console.error("Error displaying error message:", e);
        alert("An critical error occurred displaying an error: " + message); // Prevent infinite loops
    }
}

function clearError(elementId = 'generalErrorDisplay') {
    try {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
         // Clear specific modal errors as well
        const paymentErrorElement = document.getElementById('paymentMadeError');
        if (paymentErrorElement) paymentErrorElement.style.display = 'none';
        const adjustmentErrorElement = document.getElementById('adjustmentError');
        if (adjustmentErrorElement) adjustmentErrorElement.style.display = 'none';
        const editErrorElement = document.getElementById('editSupplierError');
        if (editErrorElement) editErrorElement.style.display = 'none';

    } catch (e) {
        console.error("Error clearing error message:", e);
    }
}

function showLoadingIndicator(elementId = 'pageLoadingIndicator', show = true) {
    try {
        const indicator = document.getElementById(elementId);
        if (indicator) {
            indicator.style.display = show ? 'flex' : 'none';
        }
        // Hide main content when page loading indicator is shown
        if (elementId === 'pageLoadingIndicator' && show) {
             const mainContent = document.getElementById('supplierAccountDetailContent');
             if (mainContent) mainContent.style.visibility = 'hidden';
        }
         // Re-show main content when page loading indicator is hidden AFTER data load
         if (elementId === 'pageLoadingIndicator' && !show) {
             const mainContent = document.getElementById('supplierAccountDetailContent');
             if (mainContent) mainContent.style.visibility = 'visible';
         }
    } catch (e) {
        console.error("Error toggling loading indicator:", e);
    }
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    try {
        // Handle both Firestore Timestamps and JS Date objects (e.g., from input[type=date])
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        if (isNaN(date.getTime())) { // Check if date is valid
             console.warn("Invalid date encountered:", timestamp);
             return 'Invalid Date';
        }

         // Use Indian locale for formatting
         const options = { day: '2-digit', month: 'short', year: 'numeric' }; // e.g., 05 May 2025
         return date.toLocaleDateString('en-IN', options);

    } catch (error) {
        console.error("Error formatting date:", timestamp, error);
        return 'Error';
    }
}

// Format numbers with Indian currency style
function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) {
        // console.warn("Invalid amount for currency formatting:", amount);
        // Return 0 or empty based on context? Returning 0.00 for consistency.
        amount = 0;
    }
     const formatter = new Intl.NumberFormat('en-IN', {
         style: 'currency',
         currency: 'INR',
         minimumFractionDigits: 2,
         maximumFractionDigits: 2
     });
     return formatter.format(amount);
 }

// Parse currency string back to number
function parseCurrency(value) {
    if (typeof value === 'number') return value;
    if (!value || typeof value !== 'string') return 0;
    // Remove currency symbols, commas, and whitespace
    const cleanedValue = value.replace(/₹|INR|,|\s/g, '');
    const number = parseFloat(cleanedValue);
    return isNaN(number) ? 0 : number;
}


// --- Modal Handling ---
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        clearError('paymentMadeError'); // Clear errors specific to modals
        clearError('adjustmentError');
        clearError('editSupplierError');
        modal.style.display = 'flex'; // Use flex for centering
        // Add specific theme classes if needed
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
             modalContent.classList.remove('modal-theme-success', 'modal-theme-warning', 'modal-theme-danger', 'modal-theme-info', 'modal-theme-secondary'); // Clear old themes
             switch (modalId) {
                 case 'addPaymentModal':
                     modal.classList.add('modal-theme-success');
                     break;
                 case 'addAdjustmentModal':
                     modal.classList.add('modal-theme-warning');
                     break;
                 case 'editSupplierModal':
                     modal.classList.add('modal-theme-info');
                     break;
                 case 'confirmDeleteSupplierModal':
                     modal.classList.add('modal-theme-danger');
                     break;
                 case 'confirmToggleStatusModal':
                      // Theme based on action (set dynamically)
                      break; // Default theme (no specific color header)
             }
         }
    } else {
        console.error(`Modal with ID ${modalId} not found.`);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        // Reset forms within the modal when closed
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
        }
         // Reset specific elements if needed (e.g., delete confirmation)
         if (modalId === 'confirmDeleteSupplierModal') {
             document.getElementById('confirmDeleteSupplierCheckbox').checked = false;
             document.getElementById('confirmSupplierDeleteBtn').disabled = true;
             document.getElementById('deleteSupplierName').textContent = '';
         }
         if (modalId === 'confirmToggleStatusModal') {
            document.getElementById('toggleActionText').textContent = '';
            document.getElementById('toggleSupplierName').textContent = '';
         }
         clearError('paymentMadeError'); // Also clear errors on close
         clearError('adjustmentError');
         clearError('editSupplierError');
    }
}

// --- Data Fetching Functions ---
async function fetchSupplierDetails(supplierId) {
    console.log("Fetching supplier details for ID:", supplierId);
    const docRef = doc(db, "suppliers", supplierId);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            currentSupplierData = { id: docSnap.id, ...docSnap.data() };
            console.log("Supplier data found:", currentSupplierData);
            return currentSupplierData;
        } else {
            console.error("No supplier found with ID:", supplierId);
            throw new Error(`Supplier not found (ID: ${supplierId}).`);
        }
    } catch (error) {
        console.error("Error fetching supplier details:", error);
        throw error; // Re-throw to be caught by the caller
    }
}

// Fetch Purchase Orders
async function fetchPurchaseOrders(supplierId) {
    console.log("Fetching purchase orders for supplier ID:", supplierId);
    const q = query(
        collection(db, "purchaseOrders"), // <<<--- CORRECTED NAME
        where("supplierId", "==", supplierId),
        firestoreOrderBy("poDate", "desc")
    );
    try {
        const querySnapshot = await getDocs(q);
        purchaseOrdersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Fetched POs:", purchaseOrdersData);
        return purchaseOrdersData;
    } catch (error) {
        console.error("Error fetching purchase orders:", error);
        // Permissions error check
        if (error.code === 'permission-denied') {
            console.error("Firestore permission error likely due to rules or incorrect collection path ('purchaseOrders').");
        }
        throw error;
    }
}

// Fetch Supplier Payments
async function fetchSupplierPayments(supplierId) {
    console.log("Fetching payments for supplier ID:", supplierId);
    const q = query(
        collection(db, "supplier_payments"), // Assuming this name is correct
        where("supplierId", "==", supplierId),
        firestoreOrderBy("paymentDate", "desc")
    );
    try {
        const querySnapshot = await getDocs(q);
        supplierPaymentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Fetched Payments:", supplierPaymentsData);
        return supplierPaymentsData;
    } catch (error) {
        console.error("Error fetching supplier payments:", error);
         if (error.code === 'permission-denied') {
             console.error("Firestore permission error likely due to rules or incorrect collection path ('supplier_payments').");
         }
        throw error;
    }
}

// Fetch Supplier Adjustments
async function fetchSupplierAdjustments(supplierId) {
    console.log("Fetching adjustments for supplier ID:", supplierId);
    const q = query(
        collection(db, "accountAdjustments"), // <<<--- CORRECTED NAME
        where("supplierId", "==", supplierId), // Assuming 'supplierId' field exists in accountAdjustments
        firestoreOrderBy("adjustmentDate", "desc") // Assuming 'adjustmentDate' field exists
    );
    try {
        const querySnapshot = await getDocs(q);
        supplierAdjustmentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Fetched Adjustments:", supplierAdjustmentsData);
        return supplierAdjustmentsData;
    } catch (error) {
        console.error("Error fetching supplier adjustments:", error);
        // Permissions error check
        if (error.code === 'permission-denied') {
            console.error("Firestore permission error likely due to rules or incorrect collection path ('accountAdjustments').");
        }
        throw error;
    }
}


// --- UI Update Functions ---

function populateSupplierDetails(data) {
    console.log("Populating supplier details into UI...");
    if (!data) {
        console.error("No supplier data provided to populate details.");
        displayError("Failed to load supplier information.");
        return;
    }
    try {
        document.getElementById('supplierNameHeading').textContent = data.name || 'N/A';
        document.getElementById('supplierIdDisplay').textContent = data.id || 'N/A';
        document.getElementById('supplierName').textContent = data.name || 'N/A';
        document.getElementById('supplierContactPerson').textContent = data.contactPerson || 'N/A';
        document.getElementById('supplierMobile').textContent = data.mobile || 'N/A';
        document.getElementById('supplierLandline').textContent = data.landline || 'N/A';
        document.getElementById('supplierEmail').textContent = data.email || 'N/A';
        document.getElementById('supplierGstin').textContent = data.gstin || 'N/A';
        document.getElementById('supplierAddress').textContent = data.address || 'N/A';
        document.getElementById('supplierRemarksNotes').textContent = data.remarks || 'N/A';
        document.getElementById('supplierStatus').textContent = data.status === 'active' ? 'Active' : 'Inactive';

        // Update status badge class
        const statusBadge = document.getElementById('supplierStatus');
        statusBadge.className = 'status-badge'; // Reset classes
        if (data.status === 'active') {
            statusBadge.classList.add('status-active');
        } else {
            statusBadge.classList.add('status-inactive');
        }

        // Update Toggle Button Text & Style
        const toggleBtn = document.getElementById('toggleStatusBtn');
        if (toggleBtn) {
            if (data.status === 'active') {
                toggleBtn.textContent = 'Mark as Inactive';
                 toggleBtn.classList.remove('enable'); // Should reflect the *action* it will perform
                 toggleBtn.classList.add('disable');
            } else {
                toggleBtn.textContent = 'Mark as Active';
                 toggleBtn.classList.remove('disable');
                 toggleBtn.classList.add('enable');
            }
        }

        console.log("Supplier details populated.");
    } catch (error) {
        console.error("Error populating supplier details UI:", error);
        displayError("An error occurred while displaying supplier information.");
    }
}

// Combine all data sources to build ledger entries
function buildLedgerEntries(supplierData, pos, payments, adjustments) {
    console.log("Building ledger entries...");
    let ledgerEntries = [];
    let balance = 0; // Start with zero balance

    // 1. Add Purchase Orders (Debit Supplier Account / Credit Our Payable) -> Increases amount WE OWE
    pos.forEach(po => {
        if (po.poDate && po.poTotalAmount !== undefined && !isNaN(po.poTotalAmount)) {
            ledgerEntries.push({
                date: po.poDate,
                type: 'Purchase Order',
                description: `PO #${po.poNumber || po.id}`,
                debit: 0, // We don't debit the supplier directly here in traditional sense
                credit: po.poTotalAmount, // We credit payable (Supplier is owed)
                balance: 0 // Will be calculated sequentially
            });
        } else {
            console.warn("Skipping invalid PO entry:", po);
        }
    });

    // 2. Add Payments Made (Debit Payable / Credit Cash) -> Decreases amount WE OWE
    payments.forEach(p => {
         if (p.paymentDate && p.amount !== undefined && !isNaN(p.amount)) {
             ledgerEntries.push({
                 date: p.paymentDate,
                 type: 'Payment Made',
                 description: `Payment Ref: ${p.referenceNumber || p.id}`,
                 debit: p.amount, // We debit the payable (supplier is paid)
                 credit: 0,
                 balance: 0
             });
         } else {
             console.warn("Skipping invalid Payment entry:", p);
         }
    });

     // 3. Add Adjustments
     adjustments.forEach(adj => {
         if (adj.adjustmentDate && adj.amount !== undefined && !isNaN(adj.amount)) {
             const isCreditAdjustment = adj.adjustmentType === 'credit'; // Credit note from supplier (reduces what we owe)
             ledgerEntries.push({
                 date: adj.adjustmentDate,
                 type: 'Adjustment',
                 description: `${isCreditAdjustment ? 'Credit Note' : 'Debit Note'}: ${adj.remarks || adj.id}`,
                 debit: isCreditAdjustment ? adj.amount : 0, // Credit Note reduces what we owe (Debit Payable)
                 credit: !isCreditAdjustment ? adj.amount : 0, // Debit Note increases what we owe (Credit Payable)
                 balance: 0
             });
         } else {
            console.warn("Skipping invalid Adjustment entry:", adj);
         }
     });

    // Sort entries by date (ascending)
    ledgerEntries.sort((a, b) => {
        const dateA = a.date.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date.toDate ? b.date.toDate() : new Date(b.date);
         if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
              console.warn("Sorting invalid dates encountered:", a.date, b.date);
              return 0; // Maintain relative order if dates are invalid
          }
        return dateA - dateB;
    });


    // Calculate running balance
    // Balance = Total Credits (What Supplier is Owed/POs/Debit Notes) - Total Debits (Payments/Credit Notes)
    // Positive balance means WE OWE the supplier (Payable)
    // Negative balance means SUPPLIER OWES US (Receivable/Advance)
    balance = 0;
    ledgerEntries.forEach(entry => {
         balance += entry.credit;
         balance -= entry.debit;
         entry.balance = balance;
    });

    console.log("Ledger entries built, final balance:", balance);
    return { ledgerEntries, finalBalance: balance };
}

// Populate Ledger Table
function populateLedgerTable(entries) {
    console.log("Populating ledger table...");
    const tableBody = document.getElementById('ledgerTableBody');
    const emptyMessage = document.getElementById('ledgerEmptyMessage');
    const loadingIndicator = document.getElementById('ledgerLoadingIndicator');

    if (!tableBody || !emptyMessage || !loadingIndicator) {
        console.error("Ledger table elements not found!");
        return;
    }

    tableBody.innerHTML = ''; // Clear existing rows
    loadingIndicator.style.display = 'none'; // Hide loading indicator

    if (entries.length === 0) {
        emptyMessage.style.display = 'table-row'; // Show 'No entries' message
        tableBody.innerHTML = ''; // Ensure it's empty
    } else {
        emptyMessage.style.display = 'none'; // Hide 'No entries' message
        entries.forEach(entry => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = formatDate(entry.date);
            row.insertCell().textContent = entry.type;
            row.insertCell().textContent = entry.description;
            const debitCell = row.insertCell();
            debitCell.textContent = formatCurrency(entry.debit);
            debitCell.classList.add('number-cell');
            const creditCell = row.insertCell();
            creditCell.textContent = formatCurrency(entry.credit);
            creditCell.classList.add('number-cell');
            const balanceCell = row.insertCell();
            balanceCell.textContent = formatCurrency(entry.balance);
            balanceCell.classList.add('number-cell', 'balance-cell'); // Add balance-cell class

             // Add balance styling based on sign (Payable vs Receivable)
            if (entry.balance > 0) {
                balanceCell.classList.add('balance-negative'); // We owe (Payable) - often shown as negative/red for supplier
            } else if (entry.balance < 0) {
                balanceCell.classList.add('balance-positive'); // Supplier owes us (Receivable) - shown as positive/green
            } else {
                 balanceCell.classList.add('balance-zero');
            }
        });
    }
     console.log("Ledger table populated.");
}

// Update Summary Section
function updateSummary(balance) {
    console.log("Updating summary section with balance:", balance);
    const balanceElement = document.getElementById('summaryBalance');
    if (balanceElement) {
        balanceElement.textContent = formatCurrency(balance);
        balanceElement.className = 'balance-cell'; // Reset classes
         if (balance > 0) {
             balanceElement.classList.add('balance-negative'); // We owe
         } else if (balance < 0) {
             balanceElement.classList.add('balance-positive'); // Supplier owes us
         } else {
              balanceElement.classList.add('balance-zero');
         }
    }
}


// --- Data Loading Orchestration ---

async function refreshSupplierData() {
    if (!currentSupplierId) {
        console.error("Cannot refresh data, supplier ID is missing.");
        return;
    }
     if (isRefreshingData) {
         console.log("Data refresh already in progress. Skipping.");
         return;
     }
    console.log("Refreshing all supplier data...");
    isRefreshingData = true;
    showLoadingIndicator('ledgerLoadingIndicator', true); // Show ledger-specific loader
    clearError(); // Clear general errors before refresh

    try {
        // Fetch all data concurrently
        const [supplierData, pos, payments, adjustments] = await Promise.all([
            fetchSupplierDetails(currentSupplierId),
            fetchPurchaseOrders(currentSupplierId),
            fetchSupplierPayments(currentSupplierId),
            fetchSupplierAdjustments(currentSupplierId)
        ]);

        // Update UI
        populateSupplierDetails(supplierData);
        const { ledgerEntries, finalBalance } = buildLedgerEntries(supplierData, pos, payments, adjustments);
        populateLedgerTable(ledgerEntries);
        updateSummary(finalBalance);
         console.log("Supplier data refresh complete.");

    } catch (error) {
        console.error("Error refreshing supplier data:", error);
        // Display specific error message based on the actual error
        if (error.message.includes("Supplier not found")) {
             displayError("The requested supplier could not be found. It might have been deleted.");
             // Optionally disable actions or redirect
             document.getElementById('actionsBar').style.display = 'none'; // Hide actions
         } else if (error.code === 'permission-denied') {
             displayError("You do not have permission to view some of this supplier's data. Please check Firestore rules.");
             // Populate what we can, but show error for ledger
             populateSupplierDetails(currentSupplierData); // Populate details if fetched
             document.getElementById('ledgerTableBody').innerHTML = '';
             document.getElementById('ledgerEmptyMessage').style.display = 'none';
             document.getElementById('ledgerLoadingIndicator').style.display = 'none'; // Hide loading
              displayError("Could not load ledger due to permission issues.", 'ledgerLoadingIndicator'); // Show error near ledger

         } else {
             displayError(`Failed to load supplier details: ${error.message}`);
         }

    } finally {
        showLoadingIndicator('ledgerLoadingIndicator', false); // Hide ledger loader
        isRefreshingData = false; // Allow next refresh
         console.log("Refresh process finished (success or fail).");
    }
}

async function loadSupplierPageData() {
     console.log("loadSupplierPageData called.");
     if (!currentSupplierId) {
         console.error("Supplier ID not set. Cannot load data.");
         displayError("No supplier specified in the URL.");
         showLoadingIndicator(true); // Keep loading indicator if ID is missing initially
         return;
     }
    showLoadingIndicator('pageLoadingIndicator', true); // Show main page loader
    showLoadingIndicator('ledgerLoadingIndicator', true); // Show ledger loader initially

    await refreshSupplierData(); // Perform the initial data load and UI population

    showLoadingIndicator('pageLoadingIndicator', false); // Hide main page loader *after* first load attempt
 }


// --- Event Handlers ---

// Add Payment
async function handleAddPayment(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('.submit-button'); // Or specific ID
    clearError('paymentMadeError');

    if (!currentSupplierId || !currentSupplierData) {
        displayError("Supplier data not loaded. Cannot add payment.", 'paymentMadeError');
        return;
    }

    const paymentDateStr = form.elements['paymentDate'].value;
    const amountStr = form.elements['paymentAmount'].value;
    const referenceNumber = form.elements['paymentReference'].value.trim();
    const remarks = form.elements['paymentRemarks'].value.trim();

    // Basic Validation
    if (!paymentDateStr || !amountStr) {
        displayError("Payment Date and Amount are required.", 'paymentMadeError');
        return;
    }

    const amount = parseCurrency(amountStr);
    if (isNaN(amount) || amount <= 0) {
        displayError("Invalid payment amount.", 'paymentMadeError');
        return;
    }
     // Convert date string to Firestore Timestamp
     let paymentDate;
     try {
         // Assuming the date input gives YYYY-MM-DD. We need to ensure it's stored correctly.
         // Firestore Timestamp expects a JS Date object.
         const dateParts = paymentDateStr.split('-'); // YYYY, MM, DD
          // Create date ensuring correct timezone interpretation (often safer to use UTC for storage if time isn't critical)
          // Using local time: new Date(year, monthIndex, day)
          paymentDate = Timestamp.fromDate(new Date(dateParts[0], dateParts[1] - 1, dateParts[2]));
     } catch (e) {
          console.error("Invalid date format from input:", paymentDateStr, e);
          displayError("Invalid Payment Date format.", 'paymentMadeError');
          return;
     }

    // Disable button to prevent double submission
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const paymentData = {
            supplierId: currentSupplierId,
            supplierName: currentSupplierData.name, // Store name for easier querying/display later
            paymentDate: paymentDate,
            amount: amount,
            referenceNumber: referenceNumber || null,
            remarks: remarks || null,
            createdAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, "supplier_payments"), paymentData);
        console.log("Payment added with ID: ", docRef.id);

        closeModal('addPaymentModal');
        form.reset();
        await refreshSupplierData(); // Refresh ledger and summary

    } catch (error) {
        console.error("Error adding payment:", error);
        displayError(`Failed to save payment: ${error.message}`, 'paymentMadeError');
    } finally {
        // Re-enable button
        submitButton.disabled = false;
         submitButton.innerHTML = '<i class="fas fa-save"></i> Save Payment';
    }
}

// Add Adjustment
async function handleAddAdjustment(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('.submit-button');
    clearError('adjustmentError');

    if (!currentSupplierId || !currentSupplierData) {
        displayError("Supplier data not loaded. Cannot add adjustment.", 'adjustmentError');
        return;
    }

    const adjustmentDateStr = form.elements['adjustmentDate'].value;
    const amountStr = form.elements['adjustmentAmount'].value;
    const adjustmentType = form.elements['adjustmentType'].value; // 'credit' or 'debit'
    const remarks = form.elements['adjustmentRemarks'].value.trim();

    // Basic Validation
    if (!adjustmentDateStr || !amountStr || !adjustmentType) {
        displayError("Date, Amount, and Adjustment Type are required.", 'adjustmentError');
        return;
    }
    if (!remarks) {
         displayError("Remarks are required for adjustments.", 'adjustmentError');
         return;
     }

    const amount = parseCurrency(amountStr);
    if (isNaN(amount) || amount <= 0) {
        displayError("Invalid adjustment amount.", 'adjustmentError');
        return;
    }
     // Convert date string to Firestore Timestamp
     let adjustmentDate;
      try {
          const dateParts = adjustmentDateStr.split('-'); // YYYY, MM, DD
          adjustmentDate = Timestamp.fromDate(new Date(dateParts[0], dateParts[1] - 1, dateParts[2]));
      } catch (e) {
           console.error("Invalid date format from input:", adjustmentDateStr, e);
           displayError("Invalid Adjustment Date format.", 'adjustmentError');
           return;
      }

    // Disable button
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const adjustmentData = {
            supplierId: currentSupplierId,
            supplierName: currentSupplierData.name,
            adjustmentDate: adjustmentDate,
            amount: amount,
            adjustmentType: adjustmentType, // 'credit' (Credit Note) or 'debit' (Debit Note)
            remarks: remarks,
            createdAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, "accountAdjustments"), adjustmentData); // <<<--- CORRECTED NAME
        console.log("Adjustment added with ID: ", docRef.id);

        closeModal('addAdjustmentModal');
        form.reset();
        await refreshSupplierData(); // Refresh ledger

    } catch (error) {
        console.error("Error adding adjustment:", error);
        displayError(`Failed to save adjustment: ${error.message}`, 'adjustmentError');
    } finally {
        // Re-enable button
        submitButton.disabled = false;
         submitButton.innerHTML = '<i class="fas fa-save"></i> Save Adjustment';
    }
}

// Edit Supplier
function openEditSupplierModal() {
    if (!currentSupplierData) {
        displayError("Cannot edit supplier, data not loaded.");
        return;
    }
    clearError('editSupplierError');
    console.log("Populating edit form with data:", currentSupplierData);

    // Populate the form
    document.getElementById('editSupplierId').value = currentSupplierId; // Hidden field
    document.getElementById('editSupplierName').value = currentSupplierData.name || '';
    document.getElementById('editContactPerson').value = currentSupplierData.contactPerson || '';
    document.getElementById('editMobile').value = currentSupplierData.mobile || '';
    document.getElementById('editLandline').value = currentSupplierData.landline || '';
    document.getElementById('editEmail').value = currentSupplierData.email || '';
    document.getElementById('editGstin').value = currentSupplierData.gstin || '';
    document.getElementById('editAddress').value = currentSupplierData.address || '';
    document.getElementById('editRemarks').value = currentSupplierData.remarks || '';

    openModal('editSupplierModal');
}

async function handleEditSupplier(event) {
     event.preventDefault();
     const form = event.target;
     const submitButton = form.querySelector('.save-button'); // Or specific ID
     clearError('editSupplierError');

     const supplierId = form.elements['editSupplierId'].value;
     if (!supplierId) {
         displayError("Supplier ID is missing. Cannot save changes.", 'editSupplierError');
         return;
     }

     // Basic validation (e.g., name is required)
     const name = form.elements['editSupplierName'].value.trim();
     if (!name) {
         displayError("Supplier Name cannot be empty.", 'editSupplierError');
         return;
     }

     const updatedData = {
         name: name,
         contactPerson: form.elements['editContactPerson'].value.trim() || null,
         mobile: form.elements['editMobile'].value.trim() || null,
         landline: form.elements['editLandline'].value.trim() || null,
         email: form.elements['editEmail'].value.trim() || null,
         gstin: form.elements['editGstin'].value.trim() || null,
         address: form.elements['editAddress'].value.trim() || null,
         remarks: form.elements['editRemarks'].value.trim() || null,
         // Do NOT update status here
         // Add lastUpdated timestamp?
         lastUpdatedAt: serverTimestamp()
     };

     submitButton.disabled = true;
     submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

     try {
         const supplierRef = doc(db, "suppliers", supplierId);
         await updateDoc(supplierRef, updatedData);
         console.log("Supplier details updated successfully.");
         closeModal('editSupplierModal');
         await refreshSupplierData(); // Refresh details on the page

     } catch (error) {
         console.error("Error updating supplier:", error);
         displayError(`Failed to update supplier: ${error.message}`, 'editSupplierError');
     } finally {
         submitButton.disabled = false;
         submitButton.innerHTML = '<i class="fas fa-save"></i> Save Changes';
     }
}

// Toggle Supplier Status
function openToggleStatusModal() {
     if (!currentSupplierData) {
         displayError("Cannot change status, supplier data not loaded.");
         return;
     }
     const modal = document.getElementById('confirmToggleStatusModal');
     const modalContent = modal.querySelector('.modal-content');
     const actionText = document.getElementById('toggleActionText');
     const supplierName = document.getElementById('toggleSupplierName');
     const confirmBtn = document.getElementById('confirmToggleBtn');

     const currentStatus = currentSupplierData.status;
     const action = currentStatus === 'active' ? 'deactivate' : 'activate';
     const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

     // Update modal text and theme
     actionText.textContent = action.toUpperCase();
     supplierName.textContent = currentSupplierData.name;

     modalContent.classList.remove('modal-theme-success', 'modal-theme-warning', 'modal-theme-danger', 'modal-theme-info', 'modal-theme-secondary'); // Clear themes
     if (action === 'activate') {
         modal.classList.add('modal-theme-success'); // Green for activation
         confirmBtn.innerHTML = '<i class="fas fa-check"></i> Activate';
         confirmBtn.classList.remove('danger-button', 'secondary-button'); // Ensure correct classes
         confirmBtn.classList.add('success-button');
     } else {
         modal.classList.add('modal-theme-secondary'); // Secondary/Gray for deactivation
         confirmBtn.innerHTML = '<i class="fas fa-ban"></i> Deactivate';
         confirmBtn.classList.remove('success-button', 'danger-button');
         confirmBtn.classList.add('secondary-button'); // Or use danger-button if preferred
     }

     // Store action and new status on the button for the handler
     confirmBtn.dataset.action = action;
     confirmBtn.dataset.newStatus = newStatus;


     openModal('confirmToggleStatusModal');
}

async function handleToggleStatus() {
     const confirmBtn = document.getElementById('confirmToggleBtn');
     const newStatus = confirmBtn.dataset.newStatus;

     if (!currentSupplierId || !newStatus || (newStatus !== 'active' && newStatus !== 'inactive')) {
         displayError("Cannot update status. Invalid data.", 'generalErrorDisplay'); // Show general error
         closeModal('confirmToggleStatusModal');
         return;
     }

     confirmBtn.disabled = true;
     confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

     try {
         const supplierRef = doc(db, "suppliers", currentSupplierId);
         await updateDoc(supplierRef, {
             status: newStatus,
             lastStatusChangeAt: serverTimestamp()
             // Optionally add to a status history array field if needed
             // statusHistory: arrayUnion({ status: newStatus, changedAt: serverTimestamp(), changedBy: auth.currentUser?.uid || 'unknown' })
         });

         console.log(`Supplier status changed to ${newStatus}`);
         closeModal('confirmToggleStatusModal');
         await refreshSupplierData(); // Refresh UI to show new status and button text

     } catch (error) {
         console.error("Error updating supplier status:", error);
         displayError(`Failed to update status: ${error.message}`, 'generalErrorDisplay');
          // Keep modal open on error? Or close? Closing for now.
          closeModal('confirmToggleStatusModal');
     } finally {
          confirmBtn.disabled = false;
         // Restore button text based on original action (or it will be updated by refresh)
          // No need to manually set text here, refresh handles it.
          console.log("Toggle status handler finished.");
     }
}

// Delete Supplier
function openDeleteSupplierModal() {
     if (!currentSupplierData) {
         displayError("Cannot delete supplier, data not loaded.");
         return;
     }
     document.getElementById('deleteSupplierName').textContent = currentSupplierData.name;
     document.getElementById('confirmDeleteSupplierCheckbox').checked = false; // Ensure checkbox is unchecked
     document.getElementById('confirmSupplierDeleteBtn').disabled = true; // Disable button initially
     openModal('confirmDeleteSupplierModal');
}

function enableDisableDeleteButton() {
    const checkbox = document.getElementById('confirmDeleteSupplierCheckbox');
    const deleteBtn = document.getElementById('confirmSupplierDeleteBtn');
    deleteBtn.disabled = !checkbox.checked;
}

async function handleDeleteSupplier() {
    const deleteBtn = document.getElementById('confirmSupplierDeleteBtn');
     if (!currentSupplierId) {
         displayError("Cannot delete. Supplier ID is missing.", 'generalErrorDisplay');
         closeModal('confirmDeleteSupplierModal');
         return;
     }

     deleteBtn.disabled = true;
     deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

     try {
         const supplierRef = doc(db, "suppliers", currentSupplierId);
         await deleteDoc(supplierRef);

         console.log("Supplier deleted successfully:", currentSupplierId);
         alert(`Supplier "${currentSupplierData.name}" has been permanently deleted.`);
         // Redirect back to the supplier list page
         window.location.href = 'supplier_management.html'; // Or the correct path to your list page

     } catch (error) {
         console.error("Error deleting supplier:", error);
         displayError(`Failed to delete supplier: ${error.message}`, 'generalErrorDisplay');
         closeModal('confirmDeleteSupplierModal'); // Keep modal open? Or close? Closing.
          // Re-enable button on error if modal stays open
          deleteBtn.disabled = false; // Re-enable if checkbox allows it
          enableDisableDeleteButton(); // Check checkbox status
          deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Permanently';
     }
     // No finally needed here as we redirect on success
}


// --- Event Listeners Setup ---
function setupEventListeners() {
    if (listenersAttached) return;
    console.log("Setting up event listeners...");

    // Action Buttons
    const addPaymentBtn = document.getElementById('addPaymentBtn');
    const addAdjustmentBtn = document.getElementById('addAdjustmentBtn');
    const editSupplierBtn = document.getElementById('editSupplierBtn');
    const toggleStatusBtn = document.getElementById('toggleStatusBtn');
    const deleteSupplierBtn = document.getElementById('deleteSupplierBtn');
    const backBtn = document.getElementById('backBtn');


    if (addPaymentBtn) addPaymentBtn.addEventListener('click', () => openModal('addPaymentModal'));
    if (addAdjustmentBtn) addAdjustmentBtn.addEventListener('click', () => openModal('addAdjustmentModal'));
    if (editSupplierBtn) editSupplierBtn.addEventListener('click', openEditSupplierModal);
    if (toggleStatusBtn) toggleStatusBtn.addEventListener('click', openToggleStatusModal);
    if (deleteSupplierBtn) deleteSupplierBtn.addEventListener('click', openDeleteSupplierModal);
    if (backBtn) backBtn.addEventListener('click', () => window.history.back()); // Or link to supplier_management.html

    // Modal Close Buttons (using IDs)
    const closeAddPaymentModal = document.getElementById('closeAddPaymentModal');
    const closeAddAdjustmentModal = document.getElementById('closeAddAdjustmentModal');
    const closeEditSupplierModal = document.getElementById('closeEditSupplierModal');
    const closeConfirmToggleStatusModal = document.getElementById('closeConfirmToggleStatusModal');
    const closeConfirmDeleteSupplierModal = document.getElementById('closeConfirmDeleteSupplierModal');


    if (closeAddPaymentModal) closeAddPaymentModal.addEventListener('click', () => closeModal('addPaymentModal'));
    if (closeAddAdjustmentModal) closeAddAdjustmentModal.addEventListener('click', () => closeModal('addAdjustmentModal'));
    if (closeEditSupplierModal) closeEditSupplierModal.addEventListener('click', () => closeModal('editSupplierModal'));
    if (closeConfirmToggleStatusModal) closeConfirmToggleStatusModal.addEventListener('click', () => closeModal('confirmToggleStatusModal'));
    if (closeConfirmDeleteSupplierModal) closeConfirmDeleteSupplierModal.addEventListener('click', () => closeModal('confirmDeleteSupplierModal'));


    // Modal Form Submissions
    const addPaymentForm = document.getElementById('addPaymentForm');
    const addAdjustmentForm = document.getElementById('addAdjustmentForm');
    const editSupplierForm = document.getElementById('editSupplierForm');

    if (addPaymentForm) addPaymentForm.addEventListener('submit', handleAddPayment);
    if (addAdjustmentForm) addAdjustmentForm.addEventListener('submit', handleAddAdjustment);
    if (editSupplierForm) editSupplierForm.addEventListener('submit', handleEditSupplier);

    // Modal Cancel Buttons (using IDs)
     const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
     const cancelAdjustmentBtn = document.getElementById('cancelAdjustmentBtn');
     const cancelEditBtn = document.getElementById('cancelEditBtn');
     const cancelToggleBtn = document.getElementById('cancelToggleBtn');
     const cancelSupplierDeleteBtn = document.getElementById('cancelSupplierDeleteBtn');

     if (cancelPaymentBtn) cancelPaymentBtn.addEventListener('click', () => closeModal('addPaymentModal'));
     if (cancelAdjustmentBtn) cancelAdjustmentBtn.addEventListener('click', () => closeModal('addAdjustmentModal'));
     if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => closeModal('editSupplierModal'));
     if (cancelToggleBtn) cancelToggleBtn.addEventListener('click', () => closeModal('confirmToggleStatusModal'));
     if (cancelSupplierDeleteBtn) cancelSupplierDeleteBtn.addEventListener('click', () => closeModal('confirmDeleteSupplierModal'));


    // Modal Confirmation/Action Buttons (using IDs)
     const confirmToggleBtn = document.getElementById('confirmToggleBtn');
     const confirmSupplierDeleteBtn = document.getElementById('confirmSupplierDeleteBtn');
     const confirmDeleteSupplierCheckbox = document.getElementById('confirmDeleteSupplierCheckbox');


     if (confirmToggleBtn) confirmToggleBtn.addEventListener('click', handleToggleStatus);
     if (confirmSupplierDeleteBtn) confirmSupplierDeleteBtn.addEventListener('click', handleDeleteSupplier);
     if (confirmDeleteSupplierCheckbox) confirmDeleteSupplierCheckbox.addEventListener('change', enableDisableDeleteButton);


    // Close modal if clicking outside the content area
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) { // Check if the click is on the modal backdrop itself
                closeModal(modal.id);
            }
        });
    });

    listenersAttached = true;
    console.log("Event listeners attached.");
}

// --- Initialization ---

// This function will be called by the inline script in the HTML <head>
// AFTER Firebase Auth state has been checked.
window.initializeSupplierDetailPage = function(user) {
    console.log("initializeSupplierDetailPage called.");

     if (supplierDetailPageInitialized) {
         console.log("Supplier Detail Page already initialized. Skipping.");
         return;
     }
     if (!user) {
          console.error("User not authenticated. Redirecting or showing error.");
          displayError("You must be logged in to view this page.");
          // Potentially redirect to login page: window.location.href = '/login.html';
          showLoadingIndicator(false); // Hide loading indicator
          // Hide content or show a login prompt
          const mainContent = document.getElementById('supplierAccountDetailContent');
          if (mainContent) mainContent.style.visibility = 'hidden';
          return; // Stop initialization
      }

     console.log("User is authenticated:", user.uid);

    // Get supplier ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentSupplierId = urlParams.get('id');
    console.log("Supplier ID from URL:", currentSupplierId);

    if (!currentSupplierId) {
        displayError("No supplier ID provided in the URL.");
        showLoadingIndicator('pageLoadingIndicator', false); // Hide loading
        const mainContent = document.getElementById('supplierAccountDetailContent');
        if (mainContent) mainContent.style.visibility = 'visible'; // Show content to display error
        return;
    }
     document.getElementById('supplierIdDisplay').textContent = currentSupplierId; // Show ID even before load

     const mainContent = document.getElementById('supplierAccountDetailContent');
     if (mainContent) { mainContent.style.visibility = 'visible'; }
     else { console.error("Critical: Main content container missing!"); displayError("Page layout structure is broken."); return; }

     supplierDetailPageInitialized = true;
     clearError();

     // Setup listeners ONCE upon initialization
     if (!listenersAttached) {
         setupEventListeners();
     }

     // Load data (assuming auth is already confirmed by the time this runs)
     // The inline script in HTML <head> should handle Auth check and call this
     console.log("Triggering initial data load (assuming user is authenticated)...\");
     loadSupplierPageData(); // Load all data including ledger, summary etc.

};

// Trigger initialization based on DOM readiness (Auth check in HTML will call the function)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log("DOMContentLoaded fired. Initialization will be triggered by Auth script in <head>.");
        // attemptInitialization(); // Let Auth script call initializeSupplierDetailPage
    });
} else {
    console.log("DOM already loaded. Initialization will be triggered by Auth script in <head>.");
    // attemptInitialization(); // Let Auth script call initializeSupplierDetailPage
}

console.log("supplier_account_detail.js (v8 - Corrected Collection Names) script loaded.");