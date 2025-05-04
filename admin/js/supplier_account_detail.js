// js/supplier_account_detail.js
// Version with Edit Supplier Modal Logic and PO Link Logic Added

// --- Import Firebase functions directly ---
import { db } from './firebase-init.js'; // Use relative path from within JS folder
import {
    doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp,
    addDoc, serverTimestamp, updateDoc // <<< updateDoc शामिल है
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Global Variables ---
let currentSupplierId = null;
let currentSupplierData = null;

// --- DOM References ---
// (IDs should match your supplier_account_detail.html file)
const supplierNameHeader = document.getElementById('supplierNameHeader');
const supplierNameBreadcrumb = document.getElementById('supplierNameBreadcrumb');
const addPaymentMadeBtn = document.getElementById('addPaymentMadeBtn');
const editSupplierDetailsBtn = document.getElementById('editSupplierDetailsBtn'); // Button to open edit modal

// Supplier Details Display Elements
const detailSupplierId = document.getElementById('detailSupplierId');
const detailSupplierName = document.getElementById('detailSupplierName');
const detailSupplierCompany = document.getElementById('detailSupplierCompany');
const detailSupplierWhatsapp = document.getElementById('detailSupplierWhatsapp');
const detailSupplierEmail = document.getElementById('detailSupplierEmail');
const detailSupplierGst = document.getElementById('detailSupplierGst');
const detailSupplierAddress = document.getElementById('detailSupplierAddress');
const detailCreatedAt = document.getElementById('detailCreatedAt');
const detailTotalAmount = document.getElementById('detailTotalAmount');
const detailPaidAmount = document.getElementById('detailPaidAmount');
const detailPendingAmount = document.getElementById('detailPendingAmount');

// Transactions Table
const transactionsTableBody = document.getElementById('transactionsTableBody');
const transactionsLoading = document.getElementById('transactionsLoading');
const noTransactionsMessage = document.getElementById('noTransactionsMessage');

// Payment Made Modal Elements
const paymentMadeModal = document.getElementById('paymentMadeModal');
const closePaymentMadeModalBtn = document.getElementById('closePaymentMadeModalBtn');
const paymentMadeForm = document.getElementById('paymentMadeForm');
const paymentAmountInput = document.getElementById('paymentAmount');
const paymentDateInput = document.getElementById('paymentDate');
const paymentModeInput = document.getElementById('paymentMode');
const paymentNotesInput = document.getElementById('paymentNotes');
const paymentLinkPOSelect = document.getElementById('paymentLinkPOSelect'); // Dropdown for PO link
const paymentMadeError = document.getElementById('paymentMadeError'); // Error display for payment modal
const paymentSupplierName = document.getElementById('paymentSupplierName');

// Edit Supplier Modal Elements
const editSupplierModal = document.getElementById('editSupplierModal');
const closeEditSupplierBtn = document.getElementById('closeEditSupplierBtn'); // Top 'x' button
const cancelEditSupplierBtn = document.getElementById('cancelEditSupplierBtn'); // Bottom 'Cancel' button
const editSupplierForm = document.getElementById('editSupplierForm');
const editingSupplierIdInput = document.getElementById('editingSupplierId');
const editSupplierNameInput = document.getElementById('editSupplierNameInput');
const editSupplierCompanyInput = document.getElementById('editSupplierCompanyInput');
const editSupplierContactInput = document.getElementById('editSupplierContactInput');
const editSupplierEmailInput = document.getElementById('editSupplierEmailInput');
const editSupplierGstInput = document.getElementById('editSupplierGstInput');
const editSupplierAddressInput = document.getElementById('editSupplierAddressInput');
const editSupplierError = document.getElementById('editSupplierError');

// --- Utility Functions ---
function getSupplierIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('supplierId');
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    try {
        // Assuming timestamp is a Firebase Timestamp object
        const date = timestamp.toDate();
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        console.error("Error formatting date:", e, timestamp);
        // Fallback for potential string or number timestamps (adjust if needed)
        if (typeof timestamp === 'string' || typeof timestamp === 'number') {
            try {
                const date = new Date(timestamp);
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${day}/${month}/${year}`;
            } catch (innerE) {
                 return 'Invalid Date';
            }
        }
        return 'Invalid Date';
    }
}

function formatCurrency(amount) {
    if (typeof amount !== 'number') {
        amount = parseFloat(amount);
    }
    return isNaN(amount) ? '₹0.00' : `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function displayError(message, elementId = 'generalErrorDisplay') {
    // TODO: Implement a more robust error display mechanism if needed
    console.error("Display Error:", message);
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        errorElement.style.color = 'red'; // Basic styling
        errorElement.style.marginBottom = '15px';
    } else {
        alert(`Error: ${message}`); // Fallback
    }
}

function clearError(elementId = 'generalErrorDisplay') {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
}


// --- Core Data Loading Functions ---

// Load Supplier Details
async function loadSupplierDetails(supplierId) {
    if (!db) { displayError("Firestore not initialized."); return null; }
    if (!supplierId) { displayError("Supplier ID not provided."); return null; }

    try {
        const supplierRef = doc(db, "suppliers", supplierId);
        const docSnap = await getDoc(supplierRef);

        if (docSnap.exists()) {
            console.log("Supplier Data:", docSnap.data());
            return { id: docSnap.id, ...docSnap.data() };
        } else {
            displayError(`Supplier with ID ${supplierId} not found.`);
            // Optionally redirect or display a more prominent error
            if(supplierNameHeader) supplierNameHeader.textContent = "Supplier Not Found";
            if(supplierNameBreadcrumb) supplierNameBreadcrumb.textContent = "Not Found";
            return null;
        }
    } catch (error) {
        console.error("Error getting supplier document:", error);
        displayError("Failed to load supplier details. Please try again.");
        return null;
    }
}

// Load Supplier Transactions (PO Payments)
async function loadSupplierTransactions(supplierId) {
     if (!db) { displayError("Firestore not initialized."); return []; } // Return empty array on error
     if (!supplierId) { displayError("Supplier ID not provided for transactions."); return []; }

    transactionsLoading.style.display = 'block';
    noTransactionsMessage.style.display = 'none';
    transactionsTableBody.innerHTML = ''; // Clear previous transactions

    try {
        const paymentsRef = collection(db, "supplierPayments");
        // Query payments made TO this specific supplier
        const q = query(paymentsRef, where("supplierId", "==", supplierId), orderBy("paymentDate", "desc"));
        const querySnapshot = await getDocs(q);

        const transactions = [];
        querySnapshot.forEach((doc) => {
            transactions.push({ id: doc.id, ...doc.data() });
        });

        console.log("Supplier Transactions:", transactions);
        return transactions;

    } catch (error) {
        console.error("Error getting supplier transactions:", error);
        displayError("Failed to load transaction history.");
        return []; // Return empty array on error
    } finally {
         transactionsLoading.style.display = 'none';
    }
}

// Load Supplier Purchase Orders (for summary calculation)
async function loadSupplierPOs(supplierId) {
    if (!db) { displayError("Firestore not initialized."); return []; }
    if (!supplierId) { displayError("Supplier ID not provided for POs."); return []; }

    try {
        const posRef = collection(db, "purchaseOrders");
        // Query POs created FOR this supplier
        const q = query(posRef, where("supplierId", "==", supplierId));
        const querySnapshot = await getDocs(q);

        const pos = [];
        querySnapshot.forEach((doc) => {
            pos.push({ id: doc.id, ...doc.data() });
        });

        console.log("Supplier POs:", pos);
        return pos;

    } catch (error) {
        console.error("Error getting supplier POs:", error);
        displayError("Failed to load purchase order history.");
        return []; // Return empty array on error
    }
}


// --- UI Update Functions ---

function updateSupplierDetailsUI(supplierData) {
    if (!supplierData) {
        // Handle case where supplier data couldn't be loaded
        if (supplierNameHeader) supplierNameHeader.textContent = "Supplier Details";
        if (supplierNameBreadcrumb) supplierNameBreadcrumb.textContent = "Error Loading";
        // Clear or hide detail fields
        if (detailSupplierId) detailSupplierId.textContent = 'N/A';
        if (detailSupplierName) detailSupplierName.textContent = 'N/A';
        if (detailSupplierCompany) detailSupplierCompany.textContent = 'N/A';
        if (detailSupplierWhatsapp) detailSupplierWhatsapp.textContent = 'N/A';
        if (detailSupplierEmail) detailSupplierEmail.textContent = 'N/A';
        if (detailSupplierGst) detailSupplierGst.textContent = 'N/A';
        if (detailSupplierAddress) detailSupplierAddress.textContent = 'N/A';
        if (detailCreatedAt) detailCreatedAt.textContent = 'N/A';
        return;
    }

     // Update header and breadcrumb
    if(supplierNameHeader) supplierNameHeader.textContent = `Supplier Account: ${supplierData.name || 'N/A'}`;
    if(supplierNameBreadcrumb) supplierNameBreadcrumb.textContent = supplierData.name || 'N/A';

    // Update detail fields
    if (detailSupplierId) detailSupplierId.textContent = supplierData.id || 'N/A';
    if (detailSupplierName) detailSupplierName.textContent = supplierData.name || 'N/A';
    if (detailSupplierCompany) detailSupplierCompany.textContent = supplierData.companyName || 'N/A';

    // Format WhatsApp link (basic example)
    if (detailSupplierWhatsapp) {
        if (supplierData.contactNo) {
             // Basic formatting check, can be improved
            const whatsappNumber = supplierData.contactNo.replace(/[^0-9]/g, '');
            detailSupplierWhatsapp.innerHTML = `<a href="https://wa.me/${whatsappNumber}" target="_blank">${supplierData.contactNo} <i class="fab fa-whatsapp"></i></a>`;
        } else {
            detailSupplierWhatsapp.textContent = 'N/A';
        }
    }

    if (detailSupplierEmail) {
        if (supplierData.email) {
            detailSupplierEmail.innerHTML = `<a href="mailto:${supplierData.email}">${supplierData.email}</a>`;
        } else {
            detailSupplierEmail.textContent = 'N/A';
        }
    }

    if (detailSupplierGst) detailSupplierGst.textContent = supplierData.gstNo || 'N/A';
    if (detailSupplierAddress) detailSupplierAddress.textContent = supplierData.address || 'N/A';
    if (detailCreatedAt) detailCreatedAt.textContent = formatDate(supplierData.createdAt);
}

function updateTransactionsTable(transactions) {
    transactionsTableBody.innerHTML = ''; // Clear existing rows

    if (!transactions || transactions.length === 0) {
        noTransactionsMessage.style.display = 'table-row';
        return;
    }

    noTransactionsMessage.style.display = 'none';

    transactions.forEach(tx => {
        const row = transactionsTableBody.insertRow();
        // Ensure consistent data access (e.g., tx.paymentDate or tx.date)
        const paymentDate = tx.paymentDate || tx.createdAt; // Use paymentDate if available, else createdAt
        const description = tx.notes || tx.description || 'Payment Received'; // Adjust description logic as needed
        const amount = tx.amountPaid || tx.amount || 0; // Ensure amount field is consistent
        const mode = tx.paymentMode || 'N/A';
        const linkedPO = tx.linkedPoId ? `PO-${tx.linkedPoId.substring(0, 6)}...` : 'N/A'; // Display linked PO ID concisely

        row.insertCell().textContent = formatDate(paymentDate);
        row.insertCell().textContent = description;
        row.insertCell().textContent = mode;
        row.insertCell().textContent = linkedPO; // Add cell for Linked PO
        const amountCell = row.insertCell();
        amountCell.textContent = formatCurrency(amount);
        amountCell.classList.add('amount-paid'); // Add class for styling
         // Add action cell if needed (e.g., view details, delete - implement logic separately)
        // row.insertCell().innerHTML = `<button class="button small-button" onclick="viewTransaction('${tx.id}')">View</button>`;
         row.insertCell().textContent = ''; // Placeholder for actions
    });
}


function calculateAndDisplaySummary(pos, transactions) {
    console.log("Calculating Summary - POs:", pos, "Transactions:", transactions);
    let totalAmountFromPOs = 0;
    let totalPaidAmount = 0;

    // Calculate total amount from all POs for this supplier
    if (Array.isArray(pos)) {
        pos.forEach(po => {
            totalAmountFromPOs += parseFloat(po.totalAmount || 0);
        });
    }

    // Calculate total amount paid from transactions
    if (Array.isArray(transactions)) {
        transactions.forEach(tx => {
            totalPaidAmount += parseFloat(tx.amountPaid || tx.amount || 0);
        });
    }

    const pendingAmount = totalAmountFromPOs - totalPaidAmount;

    console.log("Summary Calculation - Total PO Amount:", totalAmountFromPOs, "Total Paid:", totalPaidAmount, "Pending:", pendingAmount);

    if (detailTotalAmount) detailTotalAmount.textContent = formatCurrency(totalAmountFromPOs);
    if (detailPaidAmount) detailPaidAmount.textContent = formatCurrency(totalPaidAmount);
    if (detailPendingAmount) {
        detailPendingAmount.textContent = formatCurrency(pendingAmount);
        // Optionally add styling based on pending amount
        detailPendingAmount.style.color = pendingAmount > 0 ? 'var(--danger-color)' : 'var(--success-color)';
    }

     return { totalAmountFromPOs, totalPaidAmount, pendingAmount };
}

// --- Main Data Loading Orchestration ---
async function loadSupplierAccountData() {
    if (!currentSupplierId || !db) {
        console.error("Cannot load data: Supplier ID or DB missing.");
        displayError("Initialization failed. Cannot load supplier data.");
        return;
    }
    console.log("Loading data for ID:", currentSupplierId);

    try {
        // Load data concurrently
        const [supplierData, transactions, pos] = await Promise.all([
            loadSupplierDetails(currentSupplierId),
            loadSupplierTransactions(currentSupplierId),
            loadSupplierPOs(currentSupplierId) // Load POs for summary
        ]);

        console.log("Data fetched:", { supplierData, transactions, pos });

        currentSupplierData = supplierData; // Store for later use (e.g., modals)

        // Update UI sections
        updateSupplierDetailsUI(supplierData);
        updateTransactionsTable(transactions);

        // Calculate and display summary using fetched POs and Transactions
        const summary = calculateAndDisplaySummary(pos, transactions);
        console.log("Final Account Summary Calculated and Displayed:", summary);


    } catch (error) {
        console.error("Error loading supplier account data:", error);
        displayError("An error occurred while loading the supplier account details. Please check the console and try again.");
        // Optionally clear UI fields on major error
        updateSupplierDetailsUI(null);
        updateTransactionsTable([]);
        calculateAndDisplaySummary([], []);
    }
}


// --- Event Listeners Setup ---
function setupEventListeners() {
    // Button to open "Record Payment Made" modal
    if (addPaymentMadeBtn) {
        addPaymentMadeBtn.addEventListener('click', openPaymentMadeModal);
    }

    // Close "Record Payment Made" modal
    if (closePaymentMadeModalBtn) {
        closePaymentMadeModalBtn.addEventListener('click', closePaymentMadeModal);
    }
     if (paymentMadeModal) {
        paymentMadeModal.addEventListener('click', (event) => {
            if (event.target === paymentMadeModal) { // Click outside the content
                closePaymentMadeModal();
            }
        });
    }

    // Handle "Record Payment Made" form submission
    if (paymentMadeForm) {
        paymentMadeForm.addEventListener('submit', handlePaymentMadeSubmit);
    }

    // Button to open "Edit Supplier" modal
    if (editSupplierDetailsBtn) {
        editSupplierDetailsBtn.addEventListener('click', openEditSupplierModal);
    }

    // Close "Edit Supplier" modal (using 'x' and 'Cancel' buttons)
    if (closeEditSupplierBtn) {
        closeEditSupplierBtn.addEventListener('click', closeEditSupplierModal);
    }
    if (cancelEditSupplierBtn) {
        cancelEditSupplierBtn.addEventListener('click', closeEditSupplierModal);
    }
     if (editSupplierModal) {
        editSupplierModal.addEventListener('click', (event) => {
            if (event.target === editSupplierModal) { // Click outside the content
                closeEditSupplierModal();
            }
        });
    }

     // Handle "Edit Supplier" form submission
     if (editSupplierForm) {
        editSupplierForm.addEventListener('submit', handleEditSupplierSubmit);
     }

    console.log("Event Listeners Setup.");
}


// --- PAYMENT MADE MODAL LOGIC ---

// Function to load POs for the payment link dropdown
async function loadPOsForPaymentLink(supplierId) {
    console.log("Loading supplier POs data for PaymentLink dropdown...", supplierId); // Line 496
    paymentLinkPOSelect.innerHTML = '<option value="">-- Loading POs --</option>';
    paymentLinkPOSelect.disabled = true;
    let poList = [];
    try {
        if (!db) throw new Error("Firestore db instance is not available."); // Line 500
        if (!supplierId) throw new Error("Supplier ID is missing for PO query."); // Line 501

        const q = query(collection(db, "purchaseOrders"), // Line 503 - QUERYING FIRESTORE
                      where("supplierId", "==", supplierId),
                      where("paymentStatus", "!=", "Paid")
                      // orderBy("orderDate", "desc") // <-- STEP 2: इस लाइन को कमेंट कर दिया गया है
                     );

        console.log("Executing Simplified Query:", q); // Log the simplified query

        const querySnapshot = await getDocs(q); // Line 508 - GETTING DOCS
        querySnapshot.forEach((doc) => {
             // Include only relevant info for the dropdown
             const poData = doc.data();
             poList.push({
                 id: doc.id,
                 poNumber: poData.poNumber || `PO-${doc.id.substring(0,4)}`, // Use poNumber field if exists
                 totalAmount: poData.totalAmount || 0,
                 orderDate: poData.orderDate
             });
        }); // Line 511

        console.log("Supplier POs Data (for PaymentLink):", poList); // Line 513

        if (poList.length > 0) {
            // Sort POs by date if needed (since orderBy is removed from query)
            poList.sort((a, b) => (b.orderDate?.toDate?.() || 0) - (a.orderDate?.toDate?.() || 0));

            paymentLinkPOSelect.innerHTML = '<option value="">-- Select PO (Optional) --</option>'; // Default option
             poList.forEach(po => {
                const option = document.createElement('option');
                option.value = po.id;
                // Display PO number, date, and amount
                option.textContent = `${po.poNumber} (${formatDate(po.orderDate)}) - ${formatCurrency(po.totalAmount)}`;
                paymentLinkPOSelect.appendChild(option);
            });
             paymentLinkPOSelect.disabled = false; // Enable dropdown
        } else {
           paymentLinkPOSelect.innerHTML = '<option value="">-- No open POs found --</option>'; // Line 523
           paymentLinkPOSelect.disabled = true;
        }
    } catch (error) {
        console.error("Error loading POs for payment link:", error); // Line 526
        paymentLinkPOSelect.innerHTML = '<option value="">-- Error loading POs --</option>';
         paymentLinkPOSelect.disabled = true; // Keep disabled on error
    }
    // finally {
       // This check might be causing issues if options are technically present but represent "no POs" or "error"
       // paymentLinkPOSelect.disabled = (paymentLinkPOSelect.options.length <= 1 || paymentLinkPOSelect.firstElementChild?.value === "");
    // }
}


async function openPaymentMadeModal() {
    if (!currentSupplierData) {
        displayError("Cannot record payment: Supplier data not loaded.");
        return;
    }
    clearError('paymentMadeError'); // Clear previous errors
    paymentMadeForm.reset(); // Reset form fields
     // Set default date to today if needed
     if (paymentDateInput && !paymentDateInput.value) {
        try {
             const today = new Date();
             const year = today.getFullYear();
             const month = (today.getMonth() + 1).toString().padStart(2, '0');
             const day = today.getDate().toString().padStart(2, '0');
             paymentDateInput.value = `${year}-${month}-${day}`;
         } catch(e) { console.error("Error setting default date:", e); }
     }
    if (paymentSupplierName) {
        paymentSupplierName.textContent = currentSupplierData.name || 'Supplier';
    }
    // Load POs for the dropdown *before* showing the modal
    await loadPOsForPaymentLink(currentSupplierId); // Pass current supplier ID
    if (paymentMadeModal) paymentMadeModal.style.display = 'flex';
}

function closePaymentMadeModal() {
    if (paymentMadeModal) paymentMadeModal.style.display = 'none';
    clearError('paymentMadeError');
}

// Function to update PO status after payment is linked
async function updatePOPaymentStatus(poId, paymentId, amountJustPaid) {
     if (!db || !poId || !paymentId || typeof amountJustPaid !== 'number') {
        console.error("Missing data for PO status update:", { poId, paymentId, amountJustPaid });
        return false; // Indicate failure
    }
     console.log(`Updating PO ${poId} after payment ${paymentId} of amount ${amountJustPaid}`);
    try {
        const poRef = doc(db, "purchaseOrders", poId);
        const poSnap = await getDoc(poRef);

        if (!poSnap.exists()) {
            console.error(`PO ${poId} not found for updating payment status.`);
            return false;
        }

        const poData = poSnap.data();
        const currentPaidAmount = parseFloat(poData.paidAmount || 0);
        const totalAmount = parseFloat(poData.totalAmount || 0);

        const newPaidAmount = currentPaidAmount + amountJustPaid;
        let newPaymentStatus = 'Partially Paid';
        if (newPaidAmount >= totalAmount) {
            newPaymentStatus = 'Paid';
        }

        // Prepare update data
        const updateData = {
            paidAmount: newPaidAmount,
            paymentStatus: newPaymentStatus,
            // Optionally, store references to payments linked to this PO
            // linkedPaymentIds: arrayUnion(paymentId) // Use arrayUnion to add paymentId to an array
        };

        await updateDoc(poRef, updateData);
        console.log(`PO ${poId} status updated successfully. New status: ${newPaymentStatus}, Paid Amount: ${newPaidAmount}`);
        return true; // Indicate success

    } catch (error) {
        console.error(`Error updating PO ${poId} payment status:`, error);
        // Maybe display a specific error to the user?
        return false; // Indicate failure
    }
}


async function handlePaymentMadeSubmit(event) {
    event.preventDefault();
    clearError('paymentMadeError');
    if (!db || !currentSupplierId) {
        displayError("Database connection or Supplier ID missing.", 'paymentMadeError');
        return;
    }

    const amountPaid = parseFloat(paymentAmountInput.value);
    const paymentDateStr = paymentDateInput.value; // YYYY-MM-DD format
    const paymentMode = paymentModeInput.value;
    const notes = paymentNotesInput.value.trim();
    const linkedPoId = paymentLinkPOSelect.value; // Get selected PO ID

    // Basic Validation
    if (isNaN(amountPaid) || amountPaid <= 0) {
        displayError("Please enter a valid positive payment amount.", 'paymentMadeError');
        return;
    }
    if (!paymentDateStr) {
        displayError("Please select a payment date.", 'paymentMadeError');
        return;
    }
     if (!paymentMode) {
        displayError("Please select a payment mode.", 'paymentMadeError');
        return;
    }


    // Convert date string to Firebase Timestamp
    let paymentDateTimestamp;
    try {
        // Important: Create date in UTC to avoid timezone issues if possible,
        // or ensure consistent handling based on your needs.
        // new Date(YYYY, MM-1, DD) - Month is 0-indexed
        const dateParts = paymentDateStr.split('-');
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1; // Adjust month index
        const day = parseInt(dateParts[2], 10);
        const localDate = new Date(year, month, day);
        paymentDateTimestamp = Timestamp.fromDate(localDate);

    } catch (e) {
         console.error("Error parsing payment date:", e);
         displayError("Invalid payment date format.", 'paymentMadeError');
         return;
    }

    console.log("Payment Data:", { amountPaid, paymentDateTimestamp, paymentMode, notes, linkedPoId });

    // TODO: Add loading indicator / disable submit button
    const submitButton = paymentMadeForm.querySelector('button[type="submit"]');
    if(submitButton) submitButton.disabled = true;


    try {
        // 1. Add payment document to supplierPayments collection
        const paymentData = {
            supplierId: currentSupplierId,
            supplierName: currentSupplierData?.name || 'Unknown', // Store supplier name for easier display
            amountPaid: amountPaid,
            paymentDate: paymentDateTimestamp,
            paymentMode: paymentMode,
            notes: notes,
            linkedPoId: linkedPoId || null, // Store linked PO ID, or null if none
            createdAt: serverTimestamp() // Record when the payment was logged
        };
        const newPaymentRef = await addDoc(collection(db, "supplierPayments"), paymentData);
        console.log("Payment recorded successfully with ID:", newPaymentRef.id);

         // 2. If a PO was linked, update the PO's payment status
         let poUpdateSuccess = true; // Assume success if no PO linked
         if (linkedPoId) {
             poUpdateSuccess = await updatePOPaymentStatus(linkedPoId, newPaymentRef.id, amountPaid);
              if (!poUpdateSuccess) {
                 // Log error, maybe inform user? Payment is saved, but PO link failed.
                 console.warn(`Payment ${newPaymentRef.id} saved, but failed to update linked PO ${linkedPoId}. Manual update might be needed.`);
                 // Optionally display a non-blocking warning to the user
             }
         }

        // 3. Reload data and close modal on success
        closePaymentMadeModal();
        await loadSupplierAccountData(); // Reload all data to reflect changes

    } catch (error) {
        console.error("Error saving payment:", error);
        displayError(`Failed to save payment: ${error.message}`, 'paymentMadeError');
    } finally {
         // Re-enable submit button
         if(submitButton) submitButton.disabled = false;
    }
}

// --- EDIT SUPPLIER MODAL LOGIC ---

function openEditSupplierModal() {
    if (!currentSupplierData) {
        alert("Supplier data not loaded yet. Please wait and try again.");
        return;
    }
    clearError('editSupplierError'); // Clear previous errors

    // Populate the form with current supplier data
    editingSupplierIdInput.value = currentSupplierId; // Store ID in hidden field
    editSupplierNameInput.value = currentSupplierData.name || '';
    editSupplierCompanyInput.value = currentSupplierData.companyName || '';
    editSupplierContactInput.value = currentSupplierData.contactNo || '';
    editSupplierEmailInput.value = currentSupplierData.email || '';
    editSupplierGstInput.value = currentSupplierData.gstNo || '';
    editSupplierAddressInput.value = currentSupplierData.address || '';

    if (editSupplierModal) editSupplierModal.style.display = 'flex';
}

function closeEditSupplierModal() {
    if (editSupplierModal) editSupplierModal.style.display = 'none';
    clearError('editSupplierError');
}

async function handleEditSupplierSubmit(event) {
    event.preventDefault();
    clearError('editSupplierError');
    if (!db) { displayError("Database not initialized.", 'editSupplierError'); return; }

    const supplierIdToUpdate = editingSupplierIdInput.value;
    if (!supplierIdToUpdate) {
        displayError("Cannot update: Supplier ID is missing.", 'editSupplierError');
        return;
    }

    // Get updated data from form
    const updatedData = {
        name: editSupplierNameInput.value.trim(),
        companyName: editSupplierCompanyInput.value.trim(),
        contactNo: editSupplierContactInput.value.trim(),
        email: editSupplierEmailInput.value.trim().toLowerCase(),
        gstNo: editSupplierGstInput.value.trim().toUpperCase(),
        address: editSupplierAddressInput.value.trim(),
         // Keep track of the last update time
         // updatedAt: serverTimestamp() // Use serverTimestamp for accuracy
    };

     // Basic Validation (Example)
    if (!updatedData.name) { displayError("Supplier Name cannot be empty.", 'editSupplierError'); return; }
    if (updatedData.email && !/\S+@\S+\.\S+/.test(updatedData.email)) { // Basic email format check
         displayError("Please enter a valid email address.", 'editSupplierError');
         return;
     }
      // Add more validation as needed (e.g., GST format, phone number format)


     // TODO: Add loading indicator / disable submit button
     const submitButton = editSupplierForm.querySelector('#updateSupplierBtn');
     if(submitButton) submitButton.disabled = true;

    try {
        const supplierRef = doc(db, "suppliers", supplierIdToUpdate);
        await updateDoc(supplierRef, updatedData); // Use updateDoc to update fields

        console.log("Supplier updated successfully:", supplierIdToUpdate);
        closeEditSupplierModal(); // Close modal on success
        await loadSupplierAccountData(); // Reload data to show changes

    } catch (error) {
        console.error("Error updating supplier:", error);
        displayError(`Failed to update supplier: ${error.message}`, 'editSupplierError');
    } finally {
         // Re-enable submit button
         if(submitButton) submitButton.disabled = false;
    }
}
// --- EDIT SUPPLIER MODAL LOGIC END ---


// --- Global Initialization Function ---
window.initializeSupplierDetailPage = async () => {
    console.log("Initializing Supplier Detail Page (Global Function)...");
    currentSupplierId = getSupplierIdFromUrl();
    if (!currentSupplierId) { displayError("Supplier ID missing. Cannot load details."); return; }
    console.log("Supplier ID:", currentSupplierId);
    if (typeof db === 'undefined' || !db) { displayError("Database connection failed."); return; }
    await loadSupplierAccountData(db);
    setupEventListeners();
    if (paymentDateInput) { try { const today=new Date(); const y=today.getFullYear(); const m=(today.getMonth()+1).toString().padStart(2,'0'); const d=today.getDate().toString().padStart(2,'0'); paymentDateInput.value=`${y}-${m}-${d}`; } catch(e){} }
    console.log("Supplier Detail Page Initialized via global function.");
    window.supplierDetailPageInitialized = true;
};

// --- Auto-initialize ---
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', () => { if (!window.supplierDetailPageInitialized) { window.initializeSupplierDetailPage(); } }); }
else { if (!window.supplierDetailPageInitialized) { window.initializeSupplierDetailPage(); } }
// --- End Auto-initialize ---

console.log("supplier_account_detail.js loaded and running (Edit + PO Link Logic).");