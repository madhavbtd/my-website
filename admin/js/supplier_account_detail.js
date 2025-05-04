// js/supplier_account_detail.js
// Version with Edit Supplier Modal Logic Added

// --- Import Firebase functions directly ---
import { db } from './firebase-init.js'; // Use relative path from within JS folder
import {
    doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp,
    addDoc, serverTimestamp, updateDoc // <<< updateDoc जोड़ा गया
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

// Account Summary Elements
const summaryTotalPoValue = document.getElementById('summaryTotalPoValue');
const summaryTotalPaymentsMade = document.getElementById('summaryTotalPaid'); // Corrected ID
const summaryOutstandingBalance = document.getElementById('summaryBalance');    // Corrected ID

// PO Table Elements
const poTableBody = document.getElementById('supplierPoTableBody');
const poLoadingMessage = document.getElementById('supplierPoLoading');
const poListError = document.getElementById('supplierPoListError');

// Payments Table Elements
const paymentsTableBody = document.getElementById('supplierPaymentsTableBody');
const paymentsLoadingMessage = document.getElementById('supplierPaymentLoading');
const paymentsListError = document.getElementById('supplierPaymentListError');

// Add Payment Modal Elements
const addPaymentModal = document.getElementById('addPaymentModal');
const closePaymentModal = document.getElementById('closePaymentModal'); // Corrected ID if needed
const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
const paymentModalSupplierName = document.getElementById('paymentModalSupplierName');
const addPaymentForm = document.getElementById('addPaymentForm');
const paymentAmountInput = document.getElementById('paymentAmount');
const paymentDateInput = document.getElementById('paymentDate');
const paymentMethodSelect = document.getElementById('paymentMethod');
const paymentNotesInput = document.getElementById('paymentNotes');
const savePaymentBtn = document.getElementById('savePaymentBtn');
const paymentFormError = document.getElementById('paymentFormError');

// --- EDIT SUPPLIER MODAL ELEMENTS START ---
const editSupplierModal = document.getElementById('editSupplierModal');
const closeEditSupplierModalBtn = document.getElementById('closeEditSupplierModal');
const cancelEditSupplierBtn = document.getElementById('cancelEditSupplierBtn');
const editSupplierForm = document.getElementById('editSupplierForm');
const editSupplierFormError = document.getElementById('editSupplierFormError'); // Ensure this exists in HTML modal
const editingSupplierIdInput = document.getElementById('editingSupplierId'); // Hidden input in edit modal
const editSupplierNameInput = document.getElementById('editSupplierNameInput');
const editSupplierCompanyInput = document.getElementById('editSupplierCompanyInput');
const editSupplierWhatsappInput = document.getElementById('editSupplierWhatsappInput');
const editSupplierContactInput = document.getElementById('editSupplierContactInput');
const editSupplierEmailInput = document.getElementById('editSupplierEmailInput');
const editSupplierGstInput = document.getElementById('editSupplierGstInput');
const editSupplierAddressInput = document.getElementById('editSupplierAddressInput');
const updateSupplierBtn = document.getElementById('updateSupplierBtn');
// --- EDIT SUPPLIER MODAL ELEMENTS END ---


// --- Helper Functions ---
function displayError(message, elementId = null) { /* ... (code as before) ... */ }
const escapeHtml = (unsafe) => typeof unsafe === 'string' ? unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : unsafe;
function getSupplierIdFromUrl() { /* ... (code as before) ... */ }

// --- Load All Supplier Account Data ---
async function loadSupplierAccountData(dbInstance) {
    // --- Start of function ---
    if (!currentSupplierId) { displayError("Cannot load data: Supplier ID is missing."); return; }
    console.log("Loading supplier data for ID:", currentSupplierId);
    resetUI();
    let totalPoValueNum = 0;
    let totalPaymentsNum = 0;

    try {
        // 1. Fetch Supplier Details
        const supplierRef = doc(dbInstance, "suppliers", currentSupplierId);
        const supplierSnap = await getDoc(supplierRef);
        if (supplierSnap.exists()) {
            currentSupplierData = supplierSnap.data(); // <<< Store fetched data globally
            console.log("Supplier Data:", currentSupplierData);
            displaySupplierDetails(currentSupplierData); // <<< Display fetched data
        } else { /* ... (error handling as before) ... */ return; }

        // 2. Fetch Purchase Orders (POs)
        const poTableBodyElem = poTableBody; // etc... (rest of PO fetch logic as before)
        // ... (PO fetch and summation logic) ...
        const poQuery = query( collection(dbInstance, "purchaseOrders"), where("supplierId", "==", currentSupplierId), orderBy("orderDate", "desc"));
        const poSnapshot = await getDocs(poQuery);
        if (!poSnapshot.empty) {
            poSnapshot.forEach(doc => { /* ... */ totalPoValueNum += (Number(doc.data().totalAmount) || 0); });
        }
        // ... (Update PO table UI) ...

        // 3. Fetch Payments Made
        const paymentsTableBodyElem = paymentsTableBody; // etc... (rest of Payment fetch logic as before)
         // ... (Payment fetch and summation logic) ...
        const paymentQuery = query( collection(dbInstance, "supplier_payments"), where("supplierId", "==", currentSupplierId), orderBy("paymentDate", "desc") );
        const paymentSnapshot = await getDocs(paymentQuery);
        totalPaymentsNum = 0; // Reset before summing
        if (!paymentSnapshot.empty) {
            paymentSnapshot.forEach(doc => { /* ... */ totalPaymentsNum += (Number(doc.data().paymentAmount) || 0); });
        }
         // ... (Update Payment table UI) ...

        // 4. Calculate and Display Account Summary
        const outstandingBalanceNum = totalPoValueNum - totalPaymentsNum;
        console.log("Calculated Summary:", { totalPO: totalPoValueNum, totalPaid: totalPaymentsNum, balance: outstandingBalanceNum });
        // --- Update Account Summary UI (using corrected IDs) ---
        if (summaryTotalPoValue) summaryTotalPoValue.textContent = `₹${totalPoValueNum.toFixed(2)}`;
        if (summaryTotalPaymentsMade) summaryTotalPaymentsMade.textContent = `₹${totalPaymentsNum.toFixed(2)}`;
        if (summaryOutstandingBalance) {
            summaryOutstandingBalance.textContent = `₹${outstandingBalanceNum.toFixed(2)}`;
            summaryOutstandingBalance.style.color = outstandingBalanceNum > 0 ? 'var(--danger-color, #dc3545)' : 'var(--success-color, #28a745)';
            summaryOutstandingBalance.style.fontWeight = 'bold';
        }
        console.log('Final Account Summary Calculated and Displayed:', { totalPO: totalPoValueNum, totalPaid: totalPaymentsNum, balance: outstandingBalanceNum });

    } catch (error) { /* ... (error handling as before) ... */ }
}


// --- Reset UI before loading ---
function resetUI() { /* ... (code as before) ... */ }

// --- Display Supplier Details ---
function displaySupplierDetails(data) { /* ... (code to display details, including WhatsApp text only) ... */ }

// --- Display Purchase Order Row ---
function displayPurchaseOrder(po, id, tableBodyElement) { /* ... (code as before) ... */ }

// --- Display Payment Made Row ---
function displayPaymentMade(payment, id, tableBodyElement) { /* ... (code as before) ... */ }


// --- Setup Event Listeners ---
function setupEventListeners() {
    // --- Existing Listeners ---
    if (addPaymentMadeBtn) { addPaymentMadeBtn.addEventListener('click', openAddPaymentModal); }
    else { console.warn("Add Payment button not found."); }

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

    // --- EDIT SUPPLIER EVENT LISTENER START ---
    if (editSupplierDetailsBtn) {
        editSupplierDetailsBtn.addEventListener('click', openEditSupplierModal); // <<< Changed from redirect
    } else { console.warn("Edit Supplier Details button not found."); }

    // Edit Supplier Modal Listeners
    if (closeEditSupplierModalBtn) { closeEditSupplierModalBtn.addEventListener('click', closeEditSupplierModal); }
    if (cancelEditSupplierBtn) { cancelEditSupplierBtn.addEventListener('click', closeEditSupplierModal); }
    if (editSupplierModal) {
        editSupplierModal.addEventListener('click', (event) => {
            if (event.target === editSupplierModal) { closeEditSupplierModal(); }
        });
    }
    if (editSupplierForm) { editSupplierForm.addEventListener('submit', handleUpdateSupplier); }
    else { console.warn("Edit Supplier form not found."); }
    // --- EDIT SUPPLIER EVENT LISTENER END ---

    console.log("Event Listeners Setup.");
}

// --- Add Payment Modal Logic ---
function openAddPaymentModal() { /* ... (code as before) ... */ }
function closeAddPaymentModal() { /* ... (code as before) ... */ }
async function handleSavePayment(event) { /* ... (code as before) ... */ }
function showPaymentFormError(message) { /* ... (code as before) ... */ }

// --- EDIT SUPPLIER MODAL LOGIC START ---

/** Opens the Edit Supplier modal and populates it with current data */
function openEditSupplierModal() {
    if (!editSupplierModal || !editSupplierForm || !currentSupplierData || !currentSupplierId) {
        alert("Cannot open edit modal. Required elements or data missing.");
        console.error("Edit Modal Prerequisites Check:", { editSupplierModal, editSupplierForm, currentSupplierData, currentSupplierId });
        return;
    }
    console.log("Opening Edit Supplier modal for ID:", currentSupplierId);

    // Populate form fields
    editingSupplierIdInput.value = currentSupplierId; // Store ID in hidden field
    editSupplierNameInput.value = currentSupplierData.name || '';
    editSupplierCompanyInput.value = currentSupplierData.companyName || currentSupplierData.company || '';
    editSupplierWhatsappInput.value = currentSupplierData.whatsappNo || currentSupplierData.whatsapp || '';
    editSupplierContactInput.value = currentSupplierData.contactNo || '';
    editSupplierEmailInput.value = currentSupplierData.email || '';
    editSupplierGstInput.value = currentSupplierData.gstNo || '';
    editSupplierAddressInput.value = currentSupplierData.address || '';

    // Clear any previous error messages
    if (editSupplierFormError) editSupplierFormError.style.display = 'none';
    // Reset button state
    if (updateSupplierBtn) {
         updateSupplierBtn.disabled = false;
         updateSupplierBtn.innerHTML = '<i class="fas fa-save"></i> अपडेट करें'; // Default text
    }

    // Show the modal
    editSupplierModal.classList.add('active');
    if (editSupplierNameInput) editSupplierNameInput.focus(); // Focus first field
}

/** Closes the Edit Supplier modal */
function closeEditSupplierModal() {
    if (editSupplierModal) {
        editSupplierModal.classList.remove('active');
    }
}

/** Handles the submission of the Edit Supplier form */
async function handleUpdateSupplier(event) {
    event.preventDefault();
    console.log("Attempting to update supplier...");

    const supplierIdToUpdate = editingSupplierIdInput.value;
    if (!supplierIdToUpdate) {
        showEditSupplierFormError("Cannot update: Supplier ID is missing.");
        return;
    }

    // Get updated values from form
    const name = editSupplierNameInput.value.trim();
    const company = editSupplierCompanyInput.value.trim();
    const whatsapp = editSupplierWhatsappInput.value.trim();
    const contact = editSupplierContactInput.value.trim() || null; // Store null if empty
    const email = editSupplierEmailInput.value.trim() || null;
    const gst = editSupplierGstInput.value.trim() || null;
    const address = editSupplierAddressInput.value.trim() || null;

    // Basic Validation
    if (!name) { showEditSupplierFormError("Supplier Name is required."); editSupplierNameInput.focus(); return; }
    if (!whatsapp) { showEditSupplierFormError("WhatsApp Number is required."); editSupplierWhatsappInput.focus(); return; }
    // Add more validation if needed (e.g., WhatsApp format)

    // Disable button, show loading
    if (updateSupplierBtn) {
        updateSupplierBtn.disabled = true;
        updateSupplierBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> अपडेट हो रहा है...';
    }
    showEditSupplierFormError(''); // Clear previous errors

    try {
        // Prepare data for Firestore update
        const updateData = {
            name: name,
            companyName: company, // Use consistent field name if possible
            company: company, // Include both if needed for compatibility
            whatsappNo: whatsapp,
            whatsapp: whatsapp,
            contactNo: contact,
            email: email,
            gstNo: gst,
            address: address,
            updatedAt: serverTimestamp() // Add timestamp
        };
        // Remove null fields if Firestore rules require it or for cleanliness
        Object.keys(updateData).forEach(key => updateData[key] === null && delete updateData[key]);


        // Update Firestore document
        const supplierRef = doc(db, "suppliers", supplierIdToUpdate);
        await updateDoc(supplierRef, updateData); // Use imported updateDoc

        console.log("Supplier details updated successfully in Firestore.");
        alert("Supplier details updated successfully!");

        closeEditSupplierModal(); // Close the modal on success

        // Refresh the data displayed on the page
        await loadSupplierAccountData(db); // Reload all data

    } catch (error) {
        console.error("Error updating supplier:", error);
        showEditSupplierFormError(`Error updating: ${error.message}`);
    } finally {
        // Re-enable button
        if (updateSupplierBtn) {
            updateSupplierBtn.disabled = false;
            updateSupplierBtn.innerHTML = '<i class="fas fa-save"></i> अपडेट करें';
        }
    }
}

/** Displays error message within the Edit Supplier modal */
function showEditSupplierFormError(message) {
    if (editSupplierFormError) {
        editSupplierFormError.textContent = message;
        editSupplierFormError.style.display = message ? 'block' : 'none';
    } else {
        console.error("Edit Supplier Form Error element not found! Message:", message);
        if (message) alert(message); // Fallback alert
    }
}

// --- EDIT SUPPLIER MODAL LOGIC END ---


// --- Global Initialization Function ---
/**
 * Initializes the Supplier Detail Page.
 */
window.initializeSupplierDetailPage = async () => {
    console.log("Initializing Supplier Detail Page (Global Function)...");
    currentSupplierId = getSupplierIdFromUrl();
    if (!currentSupplierId) { /* ... (error handling) ... */ return; }
    console.log("Supplier ID:", currentSupplierId);
    if (typeof db === 'undefined' || !db) { /* ... (error handling) ... */ return; }

    await loadSupplierAccountData(db);
    setupEventListeners(); // <<< Setup ALL listeners here

    if (paymentDateInput) { /* ... (set default date) ... */ }
    console.log("Supplier Detail Page Initialized via global function.");
    window.supplierDetailPageInitialized = true;
};

// --- Auto-initialize ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
         if (!window.supplierDetailPageInitialized) { window.initializeSupplierDetailPage(); }
    });
} else {
    if (!window.supplierDetailPageInitialized) { window.initializeSupplierDetailPage(); }
}
// --- End Auto-initialize ---

console.log("supplier_account_detail.js loaded and running (Edit Supplier Modal Added).");