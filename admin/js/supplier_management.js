// js/supplier_management.js - v30 (Fix for missing contact input)

import { db, auth } from './firebase-init.js';
import {
    collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc, writeBatch,
    query, orderBy, where, Timestamp, serverTimestamp, limit
    // Firestore से आवश्यक सभी फंक्शन्स इम्पोर्ट करें
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- DOM Elements ---
const poTableBody = document.getElementById('poTableBody');
const poSearchInput = document.getElementById('poSearchInput');
const poSupplierFilter = document.getElementById('poSupplierFilter');
const poStatusFilter = document.getElementById('poStatusFilter');
const poStartDateFilter = document.getElementById('poStartDateFilter');
const poEndDateFilter = document.getElementById('poEndDateFilter');
const poFilterBtn = document.getElementById('poFilterBtn');
const poClearFilterBtn = document.getElementById('poClearFilterBtn');
const poTotalsDisplay = document.getElementById('poTotalsDisplay');
const poLoadingMessage = document.getElementById('poLoadingMessage');
const poListError = document.getElementById('poListError');
const poPaginationControls = document.getElementById('poPaginationControls');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageInfo = document.getElementById('pageInfo');
const itemsPerPageSelect = document.getElementById('itemsPerPageSelect');
const selectAllPoCheckbox = document.getElementById('selectAllPoCheckbox');
const poBatchActionsBar = document.getElementById('poBatchActionsBar');
const poSelectedCount = document.getElementById('poSelectedCount');
const batchUpdateStatusSelect = document.getElementById('batchUpdateStatusSelect');
const batchApplyStatusBtn = document.getElementById('batchApplyStatusBtn');
const batchMarkReceivedBtn = document.getElementById('batchMarkReceivedBtn');
const batchDeletePoBtn = document.getElementById('batchDeletePoBtn');
const deselectAllPoBtn = document.getElementById('deselectAllPoBtn');
const poTableHeader = document.querySelector('#poTable thead');
const suppliersListSection = document.getElementById('suppliersListSection');
const supplierTableBody = document.getElementById('supplierTableBody');
const supplierLoadingMessage = document.getElementById('supplierLoadingMessage');
const supplierListError = document.getElementById('supplierListError');
const addNewSupplierBtn = document.getElementById('addNewSupplierBtn');
// Supplier Modal Elements
const supplierModal = document.getElementById('supplierModal');
const supplierModalTitle = document.getElementById('supplierModalTitle');
const closeSupplierModalBtn = document.getElementById('closeSupplierModal');
const cancelSupplierBtn = document.getElementById('cancelSupplierBtn');
const saveSupplierBtn = document.getElementById('saveSupplierBtn');
const deleteSupplierFromModalBtn = document.getElementById('deleteSupplierFromModalBtn');
const supplierForm = document.getElementById('supplierForm');
const editSupplierIdInput = document.getElementById('editSupplierId');
const supplierNameInput = document.getElementById('supplierNameInput');
const supplierCompanyInput = document.getElementById('supplierCompanyInput');
const supplierWhatsappInput = document.getElementById('supplierWhatsappInput');
const supplierContactInput = document.getElementById('supplierContactInput'); // <<< सुनिश्चित करें कि यह आईडी HTML में है
const supplierEmailInput = document.getElementById('supplierEmailInput');
const supplierAddressInput = document.getElementById('supplierAddressInput');
const supplierGstInput = document.getElementById('supplierGstInput');
const supplierFormError = document.getElementById('supplierFormError');
// Status Update Modal Elements
const statusUpdateModal = document.getElementById('statusUpdateModal');
const statusModalTitle = document.getElementById('statusModalTitle');
const closeStatusModalBtn = document.getElementById('closeStatusModal');
const cancelStatusBtn = document.getElementById('cancelStatusBtn');
const saveStatusBtn = document.getElementById('saveStatusBtn');
const statusUpdateForm = document.getElementById('statusUpdateForm');
const statusUpdatePOId = document.getElementById('statusUpdatePOId');
const currentPOStatusSpan = document.getElementById('currentPOStatus');
const statusSelect = document.getElementById('statusSelect');
const statusErrorMsg = document.getElementById('statusErrorMsg');
// PO Items Modal Elements
const poItemsModal = document.getElementById('poItemsModal');
const poItemsModalTitle = document.getElementById('poItemsModalTitle');
const poItemsModalContent = document.getElementById('poItemsModalContent');
const closePoItemsModalBtn = document.getElementById('closePoItemsModalBtn');
const closePoItemsModalBottomBtn = document.getElementById('closePoItemsModalBottomBtn');
// PO Share Modal Elements
const poShareModal = document.getElementById('poShareModal');
const poShareModalTitle = document.getElementById('poShareModalTitle');
const poShareInfo = document.getElementById('poShareInfo');
const poShareGreeting = document.getElementById('poShareGreeting');
const poShareItemsContainer = document.getElementById('poShareItemsContainer');
const poShareTermList = document.getElementById('poShareTermList');
const poShareScrollableContent = document.getElementById('poShareScrollableContent');
const closePoShareModalTopBtn = document.getElementById('closePoShareModalTopBtn');
const closePoShareModalBtn = document.getElementById('closePoShareModalBtn');
const printPoShareModalBtn = document.getElementById('printPoShareModalBtn');
const copyPoShareModalBtn = document.getElementById('copyPoShareModalBtn');
// Other Elements
const exportPoCsvBtn = document.getElementById('exportPoCsvBtn');

// --- Global State ---
let currentEditingSupplierId = null;
let suppliersDataCache = [];
let cachedPOs = {}; // Cache for PO data used in modals
let selectedPoIds = new Set();
let currentPoSortField = 'createdAt'; // Default sort field
let currentPoSortDirection = 'desc'; // Default sort direction
let eventListenersInitialized = false; // Flag to prevent multiple listener setups

// --- Utility Functions ---
function escapeHtml(unsafe) {
     if (typeof unsafe !== 'string') {
         try { unsafe = String(unsafe ?? ''); } catch (e) { unsafe = ''; }
     }
     return unsafe
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
}

function formatCurrency(amount) {
    const num = Number(amount);
    if (isNaN(num)) return 'N/A';
    // Format as Indian Rupees
    return num.toLocaleString('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== 'function') return '-';
    try {
        // Format as DD/MM/YYYY
        return timestamp.toDate().toLocaleDateString('en-GB');
    } catch (e) {
        console.error("Error formatting date:", timestamp, e);
        return '-';
    }
}

function getStatusClass(status) {
    if (!status) return 'status-unknown';
    const normalizedStatus = status.toLowerCase().replace(/\s+/g, '-');
    switch (normalizedStatus) {
        case 'new': return 'status-new';
        case 'sent': return 'status-sent';
        case 'printing': return 'status-printing';
        case 'product-received': return 'status-product-received'; // Use a distinct class
        case 'po-paid': return 'status-po-paid'; // Use a distinct class
        case 'cancel': return 'status-cancel';
        default: return 'status-unknown';
    }
}

function getPaymentStatusClass(status) {
    if (!status) return 'payment-status-pending'; // Default if missing
    const normalizedStatus = status.toLowerCase().replace(/\s+/g, '-');
    switch (normalizedStatus) {
        case 'pending': return 'payment-status-pending';
        case 'partially-paid': return 'payment-status-partially-paid';
        case 'paid': return 'payment-status-paid';
        default: return 'payment-status-pending'; // Fallback
    }
}

// --- Error Display Functions ---
function displayError(message, elementId = 'poListError') {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = message ? 'block' : 'none';
        if(message) {
             // Scroll into view only if it's a list error, not a modal error
             if(elementId === 'poListError' || elementId === 'supplierListError') {
                 errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
             }
        }
    } else {
        console.error(`Error element ID '${elementId}' not found. Msg:`, message);
        // Avoid alert for modal errors as it blocks UI, rely on console/inline display
        // if(elementId === 'poListError' || elementId === 'supplierListError') {
        //     alert(message); // Alert only for major list errors
        // }
    }
}
function clearError(elementId = 'poListError') {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
}
function showSupplierFormError(message) { displayError(message, 'supplierFormError'); }
function showStatusError(message) { displayError(message, 'statusErrorMsg'); }
function showPoListError(message) {
     displayError(message, 'poListError');
     if (poLoadingMessage) poLoadingMessage.style.display = 'none';
     if (poTableBody) poTableBody.innerHTML = `<tr><td colspan="9" class="error-message">${escapeHtml(message)}</td></tr>`;
}
function showSupplierListError(message) {
     displayError(message, 'supplierListError');
     if (supplierLoadingMessage) supplierLoadingMessage.style.display = 'none';
     if (supplierTableBody) supplierTableBody.innerHTML = `<tr><td colspan="4" class="error-message">${escapeHtml(message)}</td></tr>`;
}


// --- Supplier Balance Calculation Helpers ---
async function getSupplierTotalPoValue(supplierId) {
    if (!supplierId || !db) return 0;
    let total = 0;
    try {
        const q = query(collection(db, "purchaseOrders"), where("supplierId", "==", supplierId));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            total += Number(doc.data().totalAmount || 0);
        });
        return total;
    } catch (error) {
        console.error(`Error fetching PO total for supplier ${supplierId}:`, error);
        // Avoid showing error directly on the balance cell, log it instead
        return 0; // Return 0 on error
    }
}

async function getSupplierTotalPaymentAmount(supplierId) {
     if (!supplierId || !db) return 0;
    let total = 0;
    try {
        const q = query(collection(db, "supplier_payments"), where("supplierId", "==", supplierId));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            total += Number(doc.data().paymentAmount || 0);
        });
        return total;
    } catch (error) {
        console.error(`Error fetching payment total for supplier ${supplierId}:`, error);
        return 0;
    }
}

async function getSupplierAdjustmentTotals(supplierId) {
     if (!supplierId || !db) return { totalDebit: 0, totalCredit: 0 };
    let totalDebit = 0;
    let totalCredit = 0;
    try {
        // Index needed: supplierAccountAdjustments collection, supplierId field
        const q = query(collection(db, "supplierAccountAdjustments"), where("supplierId", "==", supplierId));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            const adj = doc.data();
            const amount = Number(adj.amount || 0);
            if (adj.adjustmentType === 'debit') {
                totalDebit += amount;
            } else if (adj.adjustmentType === 'credit') {
                totalCredit += amount;
            }
        });
        return { totalDebit, totalCredit };
    } catch (error) {
        console.error(`Error fetching adjustment totals for supplier ${supplierId}:`, error);
        if (error.code === 'failed-precondition') {
            console.warn(`Firestore index potentially missing for supplierAccountAdjustments by supplierId (${supplierId}). Balance might be inaccurate.`);
            // Optionally display a general warning elsewhere, not in the balance cell
        }
        return { totalDebit: 0, totalCredit: 0 }; // Return 0 on error
    }
}

// Calculate and Display Supplier Balance in the table row
async function calculateAndDisplaySupplierBalance(supplierId, balanceCellElement) {
    if (!balanceCellElement || !supplierId) return;

    balanceCellElement.textContent = 'Calculating...';
    balanceCellElement.style.textAlign = 'right';
    balanceCellElement.classList.remove('balance-due', 'balance-credit', 'balance-zero', 'balance-error'); // Clear previous states

    try {
        const [poTotal, paymentTotal, adjustmentTotals] = await Promise.all([
            getSupplierTotalPoValue(supplierId),
            getSupplierTotalPaymentAmount(supplierId),
            getSupplierAdjustmentTotals(supplierId)
        ]);

        // Balance Logic: Payable = PO Total + Adjustments(Debit) - Payments - Adjustments(Credit)
        const totalDebits = poTotal + adjustmentTotals.totalDebit;
        const totalCredits = paymentTotal + adjustmentTotals.totalCredit;
        const finalBalance = totalDebits - totalCredits;

        // Apply styles based on balance
        if (finalBalance > 0.005) { // You owe (Payable/Due) - Positive Balance
            balanceCellElement.textContent = formatCurrency(finalBalance);
            balanceCellElement.classList.add('balance-due'); // Typically Red
        } else if (finalBalance < -0.005) { // You have Credit - Negative Balance
            balanceCellElement.textContent = formatCurrency(Math.abs(finalBalance)) + " Cr";
            balanceCellElement.classList.add('balance-credit'); // Typically Green
        } else { // Zero balance
            balanceCellElement.textContent = formatCurrency(0);
             balanceCellElement.classList.add('balance-zero'); // Typically Grey/Normal
        }

    } catch (error) {
        // This catch block might not be reached if sub-functions handle errors gracefully
        console.error(`Error calculating balance for supplier ${supplierId}:`, error);
        balanceCellElement.textContent = 'Error';
        balanceCellElement.classList.add('balance-error'); // Add specific error class
    }
}

// --- Supplier List Functions ---
async function displaySupplierTable() {
    if (!supplierTableBody || !supplierLoadingMessage) {
         console.error("Supplier table elements missing.");
         showSupplierListError("UI Error: Could not load supplier list.");
         return;
    }
    if (!db || !collection || !getDocs || !query || !orderBy) {
        showSupplierListError("Error: DB functions missing.");
        return;
    }

    showSupplierListError(''); // Clear previous errors
    supplierLoadingMessage.style.display = 'table-row';
    supplierTableBody.innerHTML = ''; // Clear previous rows
    suppliersDataCache = []; // Clear cache

    try {
        const q = query(collection(db, "suppliers"), orderBy("name_lowercase"));
        const querySnapshot = await getDocs(q);
        supplierLoadingMessage.style.display = 'none';

        if (querySnapshot.empty) {
            supplierTableBody.innerHTML = '<tr><td colspan="4" class="no-results">No suppliers found. Add one using the button above.</td></tr>';
        } else {
            const balancePromises = []; // Array to hold promises for balance calculations
            querySnapshot.forEach((docSnapshot) => {
                const supplier = docSnapshot.data();
                const supplierId = docSnapshot.id;
                suppliersDataCache.push({ id: supplierId, ...supplier }); // Add to cache

                const tr = document.createElement('tr');
                tr.setAttribute('data-id', supplierId);
                tr.setAttribute('title', 'Click to view account details');
                tr.classList.add('clickable-row'); // Add class for click handling

                const name = escapeHtml(supplier.name || 'N/A');
                // Display WhatsApp number if available, otherwise contact number
                const contact = escapeHtml(supplier.whatsappNo || supplier.contact || '-');

                // Create cells
                const nameCell = tr.insertCell();
                nameCell.textContent = name;

                const contactCell = tr.insertCell();
                contactCell.textContent = contact;

                const balanceCell = tr.insertCell();
                balanceCell.classList.add('supplier-balance'); // Add class for styling/selection
                balanceCell.style.textAlign = 'right';
                balanceCell.textContent = 'Loading...'; // Initial text

                const actionCell = tr.insertCell();
                actionCell.classList.add('action-buttons');
                actionCell.innerHTML = `
                    <button class="button edit-supplier-btn small-button" data-id="${supplierId}" title="Edit Supplier"><i class="fas fa-edit"></i></button>
                     `;

                supplierTableBody.appendChild(tr);

                // Start balance calculation for this supplier and add promise to array
                balancePromises.push(calculateAndDisplaySupplierBalance(supplierId, balanceCell));
            });

            // Wait for all balance calculations to attempt to settle
            await Promise.allSettled(balancePromises);
            console.log("Finished attempting balance calculations for supplier list.");
        }
        populateSupplierFilterDropdown(); // Populate PO filter dropdown after loading suppliers

    } catch (error) {
        console.error("Error fetching suppliers: ", error);
        showSupplierListError(`Error loading suppliers: ${error.message}`);
        populateSupplierFilterDropdown(); // Still try to populate dropdown
    }
}

// Populate the supplier dropdown in the PO filters
function populateSupplierFilterDropdown() {
    if (!poSupplierFilter) return;
    const selectedVal = poSupplierFilter.value; // Preserve selected value if possible
    poSupplierFilter.innerHTML = '<option value="">All Suppliers</option>'; // Reset

    // Sort suppliers alphabetically for dropdown
    const sortedSuppliers = [...suppliersDataCache].sort((a, b) =>
        (a.name_lowercase || a.name || '').localeCompare(b.name_lowercase || b.name || '')
    );

    sortedSuppliers.forEach(supplier => {
        const option = document.createElement('option');
        option.value = supplier.id;
        option.textContent = escapeHtml(supplier.name || supplier.id); // Display name or ID
        poSupplierFilter.appendChild(option);
    });

    // Restore previous selection if it still exists
    if (poSupplierFilter.querySelector(`option[value="${selectedVal}"]`)) {
        poSupplierFilter.value = selectedVal;
    } else {
         poSupplierFilter.value = ""; // Default to "All Suppliers" if previous selection is gone
    }
}

// Handle clicks on buttons within the supplier table (like edit)
function handleSupplierTableActions(event) {
    const targetButton = event.target.closest('button.edit-supplier-btn');
    if (!targetButton) return; // Exit if click wasn't on an edit button

    event.stopPropagation(); // Prevent row click handler when button is clicked
    const supplierId = targetButton.dataset.id;
    if (!supplierId) return;

    // Find supplier data in cache
    const supplierData = suppliersDataCache.find(s => s.id === supplierId);
    if (supplierData) {
        openSupplierModal('edit', supplierData, supplierId); // Open modal in edit mode
    } else {
        console.warn(`Supplier ${supplierId} not found in cache for edit.`);
        alert("Could not find supplier details to edit.");
    }
}

// Handle clicks on the supplier table row itself (to navigate to detail page)
function handleSupplierRowClick(event) {
    // Ignore clicks on buttons within the row
    if (event.target.closest('button')) {
        return;
    }
    const row = event.target.closest('tr');
    const supplierId = row?.dataset.id;
    if (supplierId) {
        // Navigate to the supplier detail page
        window.location.href = `supplier_account_detail.html?id=${supplierId}`;
    }
}


// --- Supplier Modal & CRUD Functions ---
// Opens the Add/Edit Supplier Modal
function openSupplierModal(mode = 'add', supplierData = null, supplierId = null) {
    // Check if all required modal elements exist
    if (!supplierModal || !supplierForm || !supplierModalTitle || !supplierFormError || !editSupplierIdInput || !supplierNameInput || !supplierCompanyInput || !supplierWhatsappInput || !supplierContactInput || !supplierEmailInput || !supplierAddressInput || !supplierGstInput || !deleteSupplierFromModalBtn) {
        console.error("Supplier modal elements missing!");
        alert("Cannot open supplier form. UI elements are missing.");
        return;
    }

    supplierForm.reset(); // Clear form fields
    showSupplierFormError(''); // Clear any previous error messages
    currentEditingSupplierId = null; // Reset editing ID
    deleteSupplierFromModalBtn.style.display = 'none'; // Hide delete button by default

    if (mode === 'edit' && supplierData && supplierId) {
        // --- Edit Mode ---
        supplierModalTitle.textContent = 'Edit Supplier';
        editSupplierIdInput.value = supplierId; // Set the hidden ID field
        currentEditingSupplierId = supplierId; // Store the ID for submission logic

        // Populate form fields with existing data
        supplierNameInput.value = supplierData.name || '';
        supplierCompanyInput.value = supplierData.companyName || '';
        supplierWhatsappInput.value = supplierData.whatsappNo || '';
        supplierContactInput.value = supplierData.contact || ''; // <<< Populate contact
        supplierEmailInput.value = supplierData.email || '';
        supplierAddressInput.value = supplierData.address || '';
        supplierGstInput.value = supplierData.gstNo || '';

        // Show and prepare the delete button
        deleteSupplierFromModalBtn.style.display = 'inline-flex'; // Use inline-flex for button alignment
        deleteSupplierFromModalBtn.dataset.name = supplierData.name || supplierId; // Store name for confirmation message

    } else {
        // --- Add Mode ---
        supplierModalTitle.textContent = 'Add New Supplier';
        editSupplierIdInput.value = ''; // Ensure hidden ID field is empty
    }

    supplierModal.style.display = 'block'; // Show the modal
     requestAnimationFrame(() => { // Ensure focus works after display
        supplierNameInput.focus();
    });
}

// Closes the Supplier Modal
function closeSupplierModal() {
    if (supplierModal) {
        supplierModal.style.display = 'none';
    }
}

// Handles the submission of the Add/Edit Supplier form
async function handleAddSupplierSubmit(event) {
    event.preventDefault(); // Prevent default form submission

    // Check for Firestore functions and required elements
    if (!db || !collection || !addDoc || !doc || !updateDoc || !serverTimestamp || !Timestamp || !supplierContactInput) {
        showSupplierFormError("Error: Database functions missing.");
        return;
    }
    if (!saveSupplierBtn || !supplierNameInput || !supplierFormError) {
        alert("Error: Cannot save supplier due to missing form elements.");
        return;
    }

    // Validate required fields
    const supplierName = supplierNameInput.value.trim();
    if (!supplierName) {
        showSupplierFormError("Supplier Name is required.");
        supplierNameInput.focus();
        return;
    }

    // Prepare supplier data object
    const supplierData = {
        name: supplierName,
        name_lowercase: supplierName.toLowerCase(), // For case-insensitive sorting/searching
        companyName: supplierCompanyInput.value.trim(),
        whatsappNo: supplierWhatsappInput.value.trim(),
        contact: supplierContactInput.value.trim(), // <<< Get contact value
        email: supplierEmailInput.value.trim(),
        address: supplierAddressInput.value.trim(),
        gstNo: supplierGstInput.value.trim(),
        updatedAt: serverTimestamp(), // Always update the timestamp
        // Preserve status if editing, default to 'active' if adding
        status: currentEditingSupplierId
                 ? (suppliersDataCache.find(s => s.id === currentEditingSupplierId)?.status || 'active')
                 : 'active'
    };

    // Disable button and show loading state
    saveSupplierBtn.disabled = true;
    saveSupplierBtn.textContent = 'Saving...';
    showSupplierFormError(''); // Clear previous errors

    try {
        const supplierIdToUse = editSupplierIdInput.value; // Get ID from hidden input

        if (supplierIdToUse) {
            // --- Edit Existing Supplier ---
            const supplierRef = doc(db, "suppliers", supplierIdToUse);
            await updateDoc(supplierRef, supplierData);
            console.log("Supplier updated:", supplierIdToUse);
            // Update local cache (optional but good for immediate UI update)
            const index = suppliersDataCache.findIndex(s => s.id === supplierIdToUse);
            if (index > -1) {
                // Merge updated data, preserving fields not in the form (like createdAt)
                suppliersDataCache[index] = { ...suppliersDataCache[index], ...supplierData };
            }
        } else {
            // --- Add New Supplier ---
            supplierData.createdAt = serverTimestamp(); // Set createdAt only for new suppliers
            const docRef = await addDoc(collection(db, "suppliers"), supplierData);
            console.log("Supplier added:", docRef.id);
            // Add to local cache (optional)
            suppliersDataCache.push({ id: docRef.id, ...supplierData, createdAt: Timestamp.now() }); // Simulate timestamp for cache
        }

        closeSupplierModal(); // Close the modal on success
        await displaySupplierTable(); // Refresh the supplier list in the UI
        populateSupplierFilterDropdown(); // Refresh the PO filter dropdown

    } catch (error) {
        console.error("Error saving supplier: ", error);
        showSupplierFormError(`Error saving supplier: ${error.message}`);
    } finally {
        // Re-enable button and restore text regardless of success/failure
         if(saveSupplierBtn) {
            saveSupplierBtn.disabled = false;
            saveSupplierBtn.textContent = 'Save Supplier';
         }
    }
}

// Deletes a supplier document (but not associated POs/Payments)
async function deleteSupplier(supplierId, supplierName) {
    if (!db || !doc || !deleteDoc) {
        alert("Error: Functions missing for deleting supplier.");
        return;
    }

    try {
        console.log(`Attempting to delete ONLY supplier document: ${supplierId}`);
        await deleteDoc(doc(db, "suppliers", supplierId));
        alert(`Supplier "${escapeHtml(supplierName || supplierId)}" deleted successfully. Associated POs and Payments are NOT deleted.`);

        // Update local state and UI
        suppliersDataCache = suppliersDataCache.filter(s => s.id !== supplierId); // Remove from cache
        await displaySupplierTable(); // Refresh supplier list
        populateSupplierFilterDropdown(); // Refresh PO filter dropdown
        await displayPoList(); // Refresh PO list (as supplier name might be gone)

    } catch (error) {
        console.error("Error deleting supplier: ", error);
        alert(`Error deleting supplier: ${error.message}`);
    }
}

// Handles the click on the delete button within the supplier modal
function handleDeleteSupplierFromModal() {
    const supplierId = editSupplierIdInput.value;
    const supplierName = deleteSupplierFromModalBtn?.dataset?.name || supplierId;

    if (!supplierId) {
        alert("Cannot delete: Supplier ID not found.");
        return;
    }

    // Confirmation dialog
    const confirmationMessage = `WARNING!\nAre you absolutely sure you want to delete supplier "${escapeHtml(supplierName)}"?\n\nAssociated Purchase Orders and Payments WILL NOT be deleted.\nThis action cannot be undone.`;

    if (window.confirm(confirmationMessage)) {
        closeSupplierModal(); // Close the modal first
        deleteSupplier(supplierId, supplierName); // Proceed with deletion
    }
}


// --- PO List Functions ---
async function displayPoList() {
    if (!poTableBody || !poLoadingMessage) {
         console.error("PO table body or loading message element not found.");
         showPoListError("UI Error: Could not display PO list.");
         return;
    }
     if (!db || !collection || !getDocs || !query || !orderBy || !where || !doc || !getDoc || !Timestamp || !limit) {
          showPoListError("Error: DB functions missing.");
          return;
     }

    showPoListError(''); // Clear previous errors
    poLoadingMessage.style.display = 'table-row'; // Show loading indicator
    poTableBody.innerHTML = ''; // Clear existing PO rows
    if (poTotalsDisplay) poTotalsDisplay.textContent = 'Loading totals...';
    // if (poPaginationControls) poPaginationControls.style.display = 'none'; // Hide pagination initially

    // Clear selection states
    selectedPoIds.clear();
    updateBatchActionBar();
    if (selectAllPoCheckbox) selectAllPoCheckbox.checked = false;

    try {
        // --- Build Firestore Query ---
        let conditions = [];
        let baseQuery = collection(db, "purchaseOrders");

        // Filter values
        const searchTerm = poSearchInput.value.trim().toLowerCase();
        const supplierFilterId = poSupplierFilter.value;
        const statusFilter = poStatusFilter.value;
        const startDateVal = poStartDateFilter.value;
        const endDateVal = poEndDateFilter.value;

        // Apply filters to query conditions
        if (supplierFilterId) {
            conditions.push(where("supplierId", "==", supplierFilterId));
        }
        if (statusFilter) {
            conditions.push(where("status", "==", statusFilter));
        }
        if (startDateVal) {
            try {
                // Ensure date includes the whole day start
                conditions.push(where("orderDate", ">=", Timestamp.fromDate(new Date(startDateVal + 'T00:00:00'))));
            } catch (e) { console.warn("Invalid start date:", startDateVal); }
        }
        if (endDateVal) {
            try {
                // Ensure date includes the whole day end
                conditions.push(where("orderDate", "<=", Timestamp.fromDate(new Date(endDateVal + 'T23:59:59'))));
            } catch (e) { console.warn("Invalid end date:", endDateVal); }
        }

        // Sorting logic
        const sortFieldMapping = {
             poNumber: 'poNumber', orderDate: 'orderDate', supplierName: 'supplierName',
             totalAmount: 'totalAmount', status: 'status', paymentStatus: 'paymentStatus',
             createdAt: 'createdAt' // Default/fallback sort
        };
        const firestoreSortField = sortFieldMapping[currentPoSortField] || 'createdAt';
        const firestoreSortDirection = currentPoSortDirection || 'desc';

        // Add sorting clauses - always include a secondary sort for consistency if not sorting by createdAt
        let sortClauses = [orderBy(firestoreSortField, firestoreSortDirection)];
        if (firestoreSortField !== 'createdAt') {
            sortClauses.push(orderBy('createdAt', 'desc')); // Secondary sort
        }

        // Combine conditions and sorting for the final query
        // Note: Firestore requires the first orderBy field to match an inequality field if present.
        // If you add inequalities on fields other than 'orderDate', adjust the first orderBy accordingly.
        const finalQuery = query(baseQuery, ...conditions, ...sortClauses); // Apply conditions and sorting

        // Execute query
        const querySnapshot = await getDocs(finalQuery);

        poLoadingMessage.style.display = 'none'; // Hide loading indicator

        // Process results
        let filteredDocs = querySnapshot.docs;
        let grandTotalAmount = 0;
        cachedPOs = {}; // Clear PO cache for this view

        // --- Client-side filtering (for search term) ---
        // Firestore doesn't support partial text search efficiently across multiple fields.
        // Filter results further based on the search term after fetching.
        if (searchTerm) {
            filteredDocs = filteredDocs.filter(docRef_po => {
                const po = docRef_po.data();
                const supplierName = suppliersDataCache.find(s => s.id === po.supplierId)?.name?.toLowerCase() || '';
                const itemNames = (po.items || []).map(item => item.productName?.toLowerCase() || '').join(' ');
                const poNumberStr = po.poNumber?.toString().toLowerCase() || '';

                return (
                    poNumberStr.includes(searchTerm) ||
                    supplierName.includes(searchTerm) ||
                    itemNames.includes(searchTerm)
                );
            });
        }

        // --- Display Results ---
        if (filteredDocs.length === 0) {
            poTableBody.innerHTML = `<tr><td colspan="9" class="no-results">No POs found matching your criteria.</td></tr>`;
            if (poTotalsDisplay) poTotalsDisplay.textContent = 'Total PO Value: ₹ 0.00';
            return; // Exit if no results
        }

        // Loop through filtered documents and render rows
        filteredDocs.forEach(docRef_po => {
            const po = docRef_po.data();
            const poId = docRef_po.id;
            cachedPOs[poId] = po; // Cache PO data for modals

            // Prepare data for display
            let supplierName = suppliersDataCache.find(s => s.id === po.supplierId)?.name || po.supplierName || 'Unknown';
            let orderDateStr = formatDate(po.orderDate || po.createdAt);
            let statusText = po.status || 'Unknown';
            let statusClass = getStatusClass(statusText); // Helper for CSS class
            let paymentStatusText = po.paymentStatus || 'Pending';
            let paymentStatusClass = getPaymentStatusClass(paymentStatusText); // Helper for CSS class
            let amount = po.totalAmount || 0;
            let amountStr = formatCurrency(amount);
            grandTotalAmount += amount; // Accumulate total

            // Create supplier link if ID exists
            let supplierLink = po.supplierId
                ? `<a href="supplier_account_detail.html?id=${po.supplierId}" class="supplier-link" title="View Supplier: ${escapeHtml(supplierName)}">${escapeHtml(supplierName)}</a>`
                : escapeHtml(supplierName);

            // Generate HTML for product items (show first, link for more)
            let itemsHtml = 'N/A';
            if (po.items && po.items.length > 0) {
                const firstItem = po.items[0];
                const firstItemName = escapeHtml(firstItem.productName || 'Item');
                if (po.items.length === 1) {
                    // Display single item details
                    const qty = escapeHtml(firstItem.quantity || '?');
                    let sizeText = '';
                    if (firstItem.unitType === 'Sq Feet' && firstItem.width && firstItem.height) {
                        const width = escapeHtml(firstItem.width);
                        const height = escapeHtml(firstItem.height);
                        const unit = escapeHtml(firstItem.dimensionUnit || 'units');
                        sizeText = ` [${width} x ${height} ${unit}]`;
                    }
                    itemsHtml = `<span class="product-name-display">${firstItemName}</span> (Qty: ${qty})${sizeText}`;
                } else {
                    // Display first item and "X more" button
                    itemsHtml = `<span class="product-name-display">${firstItemName}</span> <button class="button see-more-items-btn small-button text-button" data-action="see-more-items" data-id="${poId}">${po.items.length - 1} more</button>`;
                }
            }

            // Create table row
            const tr = document.createElement('tr');
            tr.setAttribute('data-id', poId);

            // Populate row cells
             tr.innerHTML = `
                <td style="text-align: center;"><input type="checkbox" class="po-select-checkbox" value="${poId}"></td>
                <td class="po-number-link" title="View Details / Share PO">${escapeHtml(po.poNumber || 'N/A')}</td>
                <td>${orderDateStr}</td>
                <td>${supplierLink}</td>
                <td style="text-align: right;">${amountStr}</td>
                <td>${itemsHtml}</td>
                <td><span class="status-badge ${statusClass}">${escapeHtml(statusText)}</span></td>
                <td><span class="payment-badge ${paymentStatusClass}">${escapeHtml(paymentStatusText)}</span></td>
                <td class="action-buttons">
                    ${(statusText === 'Sent' || statusText === 'Printing') // Show Mark Received only for Sent/Printing
                        ? `<button class="button mark-received-btn small-button success-button" data-action="mark-received" data-id="${poId}" title="Mark as Received"><i class="fas fa-check"></i></button>`
                        : ''}
                    <button class="button edit-button small-button" data-action="edit-po" data-id="${poId}" title="Edit PO"><i class="fas fa-edit"></i></button>
                    <button class="button status-button small-button" data-action="change-status-modal" data-id="${poId}" data-number="${escapeHtml(po.poNumber)}" data-status="${escapeHtml(statusText)}" title="Update Status"><i class="fas fa-sync-alt"></i></button>
                    <button class="button delete-button small-button" data-action="delete-po" data-id="${poId}" data-number="${escapeHtml(po.poNumber)}" title="Delete PO"><i class="fas fa-trash-alt"></i></button>
                </td>`;
             poTableBody.appendChild(tr);
        });

        // Display grand total
        if (poTotalsDisplay) poTotalsDisplay.textContent = `Total PO Value (Displayed): ${formatCurrency(grandTotalAmount)}`;

    } catch (error) {
        console.error("Error fetching/displaying POs: ", error);
        // Check for specific Firestore index errors
        if (error.code === 'failed-precondition') {
             showPoListError(`Error: A required database index is missing. Please check Firestore indexes based on your filters and sorting (e.g., fields like 'supplierId', 'status', 'orderDate', '${currentPoSortField}').`);
        } else {
             showPoListError(`Error loading POs: ${error.message}`);
        }
        if (poTotalsDisplay) poTotalsDisplay.textContent = 'Error loading totals';
    }
}


// --- PO Table Sorting ---
function handlePoSort(event) {
    const header = event.target.closest('th[data-sortable="true"]');
    if (!header) return;

    const sortKey = header.dataset.sortKey;
    if (!sortKey) return;

    let newDirection;
    if (currentPoSortField === sortKey) {
        // Toggle direction if clicking the same field
        newDirection = currentPoSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // Default to ascending if clicking a new field
        newDirection = 'asc';
    }

    // Update global state
    currentPoSortField = sortKey;
    currentPoSortDirection = newDirection;

    updateSortIndicators(); // Update visual indicators in header
    displayPoList(); // Re-fetch and display sorted list
}

function updateSortIndicators() {
    if (!poTableHeader) return;
    poTableHeader.querySelectorAll('th[data-sortable="true"]').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc'); // Remove previous classes
        th.querySelector('.sort-indicator')?.remove(); // Remove previous indicator span

        if (th.dataset.sortKey === currentPoSortField) {
            const indicator = document.createElement('span');
            indicator.classList.add('sort-indicator');
            if (currentPoSortDirection === 'asc') {
                th.classList.add('sort-asc');
                indicator.innerHTML = ' &uarr;'; // Up arrow
            } else {
                th.classList.add('sort-desc');
                indicator.innerHTML = ' &darr;'; // Down arrow
            }
            th.appendChild(indicator); // Add indicator span to header
        }
    });
}


// --- PO Table Action Handling (Delegated) ---
async function handlePOTableActions(event) {
     const actionElement = event.target.closest('button[data-action], td.po-number-link'); // Include PO number cell

     if (!actionElement) return; // Exit if click wasn't on an actionable element

     const poId = actionElement.closest('tr')?.dataset?.id;
     if (!poId) {
          console.error("Could not determine PO ID for action.");
          return;
     }

     // Handle clicks on the PO Number link (treated as an action)
     if (actionElement.classList.contains('po-number-link')) {
          openPoShareModal(poId);
          return; // Stop further processing for this click
     }

     // Handle clicks on buttons
     const action = actionElement.dataset.action;
     const poNumber = actionElement.dataset.number; // Used for confirmations/titles

     if (!action) {
          console.error("Action button missing data-action attribute.");
          return;
     }

     switch (action) {
          case 'mark-received':
               markPOAsReceived(poId);
               break;
          case 'edit-po':
               window.location.href = `new_po.html?editPOId=${poId}`;
               break;
          case 'change-status-modal':
               const currentStatus = actionElement.dataset.status;
               openStatusModal(poId, currentStatus, poNumber);
               break;
          case 'see-more-items':
               openSeeMoreItemsModal(poId);
               break;
          case 'delete-po':
               const confirmMessage = `क्या आप वाकई PO (${escapeHtml(poNumber) || poId.substring(0, 6)}) को डिलीट करना चाहते हैं? यह क्रिया वापस नहीं ली जा सकती है।`;
               if (window.confirm(confirmMessage)) {
                    try {
                         const poRef = doc(db, "purchaseOrders", poId);
                         await deleteDoc(poRef);
                         // Remove row from UI or refresh list
                         const rowToRemove = poTableBody?.querySelector(`tr[data-id="${poId}"]`);
                         if (rowToRemove) {
                              rowToRemove.remove();
                         } else {
                              await displayPoList(); // Fallback refresh if row not found
                         }
                         delete cachedPOs[poId]; // Remove from cache
                         alert(`PO (${escapeHtml(poNumber) || poId.substring(0, 6)}) सफलतापूर्वक डिलीट हो गया है।`);
                         // Consider recalculating totals if needed
                    } catch (error) {
                         console.error(`Error deleting PO ${poId}:`, error);
                         displayError(`PO डिलीट करने में विफल: ${error.message}`);
                    }
               }
               break;
          default:
               console.warn(`Unknown action encountered: '${action}' for PO ID: ${poId}`);
     }
}


// --- PO Status Logic ---
// Mark a single PO as 'Product Received'
async function markPOAsReceived(poId) {
    if (!poId || !db || !doc || !updateDoc || !serverTimestamp) {
        alert("Error: Cannot mark PO as received. Required functions missing.");
        return;
    }

    if (confirm(`Mark PO #${poId.substring(0, 6)}... as 'Product Received'?`)) {
        try {
            await updateDoc(doc(db, "purchaseOrders", poId), {
                status: "Product Received",
                receivedDate: serverTimestamp(), // Record when it was marked received
                updatedAt: serverTimestamp()
            });
            alert("PO status updated to 'Product Received'.");

            // Update the UI directly if possible
            const row = poTableBody?.querySelector(`tr[data-id="${poId}"]`);
            if(row) {
                const statusBadge = row.querySelector('.status-badge');
                if(statusBadge) {
                    statusBadge.textContent = 'Product Received';
                    statusBadge.className = 'status-badge status-product-received'; // Update class
                }
                // Remove the "Mark Received" button as it's no longer needed
                const markBtn = row.querySelector('.mark-received-btn');
                if(markBtn) markBtn.remove();
            } else {
                 // Fallback to refreshing the list if direct row update fails
                 await displayPoList();
            }
             // Update cache if needed
             if(cachedPOs[poId]) { cachedPOs[poId].status = "Product Received"; }

        } catch (error) {
            console.error(`Error marking PO ${poId} received:`, error);
            alert(`Error updating PO status: ${error.message}`);
        }
    }
}

// Open the modal to change a PO's status
function openStatusModal(poId, currentStatus, poNumber) {
    if (!statusUpdateModal || !statusUpdatePOId || !currentPOStatusSpan || !statusSelect || !statusModalTitle) {
        console.error("Status update modal elements missing!");
        return;
    }

    statusUpdatePOId.value = poId; // Set hidden input with PO ID
    currentPOStatusSpan.textContent = currentStatus || 'N/A'; // Display current status
    statusModalTitle.textContent = `Update Status for PO #${escapeHtml(poNumber) || poId.substring(0,6)}`;
    statusSelect.value = currentStatus || ''; // Pre-select current status in dropdown
    showStatusError(''); // Clear previous errors
    statusUpdateModal.style.display = 'block'; // Show modal
    statusSelect.focus();
}

// Close the status update modal
function closeStatusModal() {
    if (statusUpdateModal) {
        statusUpdateModal.style.display = 'none';
    }
}

// Handle the submission of the status update form
async function handleStatusUpdate(event) {
    event.preventDefault(); // Prevent default form submission

    if (!statusUpdatePOId || !statusSelect || !db || !doc || !updateDoc || !serverTimestamp || !saveStatusBtn) {
        showStatusError("Internal error occurred. Cannot save status.");
        return;
    }

    const poId = statusUpdatePOId.value;
    const newStatus = statusSelect.value;

    if (!poId || !newStatus) {
        showStatusError("Please select a new status.");
        statusSelect.focus();
        return;
    }

    showStatusError(''); // Clear errors
    saveStatusBtn.disabled = true; // Disable button
    saveStatusBtn.textContent = 'Saving...';

    try {
        await updateDoc(doc(db, "purchaseOrders", poId), {
            status: newStatus,
            updatedAt: serverTimestamp() // Update timestamp
        });

        closeStatusModal(); // Close modal on success

        // --- Update UI Directly ---
        const row = poTableBody?.querySelector(`tr[data-id="${poId}"]`);
        if (row) {
            // Update status badge
            const statusBadge = row.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.textContent = newStatus;
                statusBadge.className = `status-badge ${getStatusClass(newStatus)}`; // Update class
            }
            // Update status button data attribute for future clicks
            const statusBtn = row.querySelector('.status-button');
            if (statusBtn) {
                statusBtn.dataset.status = newStatus;
            }
            // Add or remove "Mark Received" button based on new status
            const markReceivedBtn = row.querySelector('.mark-received-btn');
            const actionCell = row.querySelector('.action-buttons');
            if (newStatus === 'Sent' || newStatus === 'Printing') {
                 // Add button if it doesn't exist
                 if (!markReceivedBtn && actionCell) {
                     const button = document.createElement('button');
                     button.className = 'button mark-received-btn small-button success-button';
                     button.dataset.action = 'mark-received';
                     button.dataset.id = poId;
                     button.title = 'Mark as Received';
                     button.innerHTML = '<i class="fas fa-check"></i>';
                     actionCell.prepend(button); // Add it to the beginning of actions
                 }
            } else {
                 // Remove button if it exists and status is not Sent/Printing
                 if (markReceivedBtn) {
                     markReceivedBtn.remove();
                 }
            }
        } else {
             // Fallback: Refresh the whole list if direct update fails
             await displayPoList();
        }
         // Update cache
         if(cachedPOs[poId]) { cachedPOs[poId].status = newStatus; }

        alert("PO Status updated successfully.");

    } catch (error) {
        console.error(`Error updating status for PO ${poId}:`, error);
        showStatusError(`Failed to update status: ${error.message}`);
    } finally {
        // Re-enable button
        saveStatusBtn.disabled = false;
        saveStatusBtn.textContent = 'Update Status';
    }
}


// --- PO Share Modal Functions ---
async function openPoShareModal(poId) {
    if (!poShareModal || !poShareModalTitle || !poShareInfo || !poShareGreeting || !poShareItemsContainer || !poShareTermList || !copyPoShareModalBtn) {
        console.error("PO Share modal elements missing!");
        alert("Error: Cannot open PO Share view.");
        return;
    }

    // Reset modal content to loading state
    poShareModalTitle.textContent = "Purchase Order";
    poShareInfo.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading PO info...';
    poShareGreeting.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading greeting...';
    poShareItemsContainer.innerHTML = '<h3>Items</h3><p><i class="fas fa-spinner fa-spin"></i> Loading items...</p>';
    poShareTermList.innerHTML = '<li><i class="fas fa-spinner fa-spin"></i> Loading T&C...</li>';
    copyPoShareModalBtn.dataset.poid = ''; // Clear PO ID from button
    copyPoShareModalBtn.disabled = true;
    copyPoShareModalBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Content';
    copyPoShareModalBtn.classList.remove('copied', 'copying');

    poShareModal.classList.add('active'); // Show the modal

    try {
        // Fetch PO data
        const poRef = doc(db, "purchaseOrders", poId);
        const poDocSnap = await getDoc(poRef);

        if (!poDocSnap.exists()) {
            throw new Error(`Could not find Purchase Order with ID: ${escapeHtml(poId)}`);
        }
        const poData = poDocSnap.data();
        cachedPOs[poId] = poData; // Update cache

        // Fetch Supplier Name (handle potential errors)
        let supplierName = "Supplier"; // Default
        if (poData.supplierId) {
            try {
                const supplierRef = doc(db, "suppliers", poData.supplierId);
                const supplierDocSnap = await getDoc(supplierRef);
                if (supplierDocSnap.exists()) {
                    supplierName = supplierDocSnap.data().name || supplierName;
                } else {
                    supplierName = poData.supplierName || supplierName; // Fallback to stored name
                }
            } catch (supplierError) {
                console.warn(`Could not fetch supplier name for ${poData.supplierId}:`, supplierError);
                supplierName = poData.supplierName || supplierName; // Fallback
            }
        } else {
            supplierName = poData.supplierName || supplierName; // Use stored name if no ID
        }

        // Format PO Number and Date
        const poNumberDisplay = poData.poNumber ? `<span class="po-number-large">#${escapeHtml(poData.poNumber)}</span>` : 'N/A';
        let orderDateStr = 'N/A';
        if (poData.orderDate?.toDate) {
            try {
                orderDateStr = poData.orderDate.toDate().toLocaleDateString('en-GB'); // DD/MM/YYYY
            } catch (e) { console.error("Error formatting PO date:", e); }
        }

        // Populate Header and Greeting
        poShareInfo.innerHTML = `<span class="po-info-left">PO Number: ${poNumberDisplay}</span><span class="po-info-right"><span>Order Date: ${orderDateStr}</span></span>`;
        poShareGreeting.innerHTML = `Dear ${escapeHtml(supplierName)},<br>This Purchase Order is being shared with you. Please review the details below.`;

        // Populate Items Table
        let itemsHTML = '<p>No items found.</p>';
        if (poData.items && poData.items.length > 0) {
            itemsHTML = `<table class="details-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Product Name</th>
                                    <th>Type</th>
                                    <th>Details (Qty/Size/Calc)</th>
                                    <th>Rate</th>
                                    <th>Party</th>
                                    <th>Design</th>
                                    <th style="text-align: right;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>`;
            poData.items.forEach((item, index) => {
                let detailStr = '';
                const qty = item.quantity || '?';
                const itemUnitType = item.unitType || 'Qty';
                const rate = item.rate ?? 0;
                const itemAmount = item.itemAmount ?? (Number(qty) * rate); // Calculate if missing

                if (itemUnitType === 'Sq Feet') {
                    const w = item.width || '?';
                    const h = item.height || '?';
                    const u = item.dimensionUnit || 'units';
                    const printSqFt = item.printSqFt ? parseFloat(item.printSqFt).toFixed(2) : '?';
                    // Include print dimensions if available
                    const printW = item.printWidthFt ? parseFloat(item.printWidthFt).toFixed(2) + 'ft' : '?';
                    const printH = item.printHeightFt ? parseFloat(item.printHeightFt).toFixed(2) + 'ft' : '?';
                    detailStr = `Qty: ${escapeHtml(qty)} (${escapeHtml(w)}x${escapeHtml(h)} ${escapeHtml(u)})`;
                    if (printSqFt !== '?') {
                         detailStr += `<br>Print Area: ${escapeHtml(printSqFt)} sqft (on ${escapeHtml(printW)}x${escapeHtml(printH)} media)`;
                    }
                } else {
                    detailStr = `Qty: ${escapeHtml(qty)}`;
                }
                itemsHTML += `<tr>
                                <td>${index + 1}</td>
                                <td>${escapeHtml(item.productName || 'N/A')}</td>
                                <td>${escapeHtml(itemUnitType)}</td>
                                <td>${detailStr}</td>
                                <td>${formatCurrency(rate)}</td>
                                <td>${escapeHtml(item.partyName || '-')}</td>
                                <td>${escapeHtml(item.designDetails || '-')}</td>
                                <td style="text-align: right;">${formatCurrency(itemAmount)}</td>
                              </tr>`;
            });
            itemsHTML += `</tbody></table>`;
            // Add Grand Total Row if applicable
             if (poData.totalAmount) {
                itemsHTML += `<div style="text-align: right; font-weight: bold; margin-top: 10px; padding-top: 10px; border-top: 1px solid #ccc;">Grand Total: ${formatCurrency(poData.totalAmount)}</div>`;
             }

            poShareItemsContainer.innerHTML = `<h3>Items</h3>${itemsHTML}`;
        } else {
            poShareItemsContainer.innerHTML = `<h3>Items</h3><p>No items found for this PO.</p>`;
        }

        // Populate Terms & Conditions (Use defaults or fetch from settings if applicable)
        poShareTermList.innerHTML = `
            <li>Ensure prompt delivery of the order.</li>
            <li>The supplied material must match the approved sample and specifications.</li>
            <li>Maintain the specified quality standards.</li>
            <li>Payment may be withheld or rejected for defective/substandard goods.</li>
            `;

        // Enable Copy Button
        copyPoShareModalBtn.dataset.poid = poId;
        copyPoShareModalBtn.disabled = false;

    } catch (error) {
        console.error("Error opening or populating PO Share modal:", error);
        poShareModalTitle.textContent = "Error";
        poShareInfo.innerHTML = '';
        poShareGreeting.innerHTML = '';
        poShareItemsContainer.innerHTML = `<p class="error-message" style="color: red; background: #fee; border: 1px solid red; padding: 10px; border-radius: 4px;">Error loading PO details: ${escapeHtml(error.message)}</p>`;
        poShareTermList.innerHTML = '';
        copyPoShareModalBtn.disabled = true; // Disable copy on error
    }
}

// Closes the PO Share modal
function closePoShareModalFunction() {
    if (poShareModal) {
        poShareModal.classList.remove('active');
    }
}

// Copies PO content (HTML and Plain Text) to clipboard
async function handleCopyPoShareContent(event) {
    const button = event.currentTarget;
    const poId = button.dataset.poid;

    if (!poId || !cachedPOs[poId]) { // Check cache first
        alert("Error: Could not find PO data to copy.");
        return;
    }
    if (!navigator.clipboard || !navigator.clipboard.write) {
         // Fallback for older browsers (less reliable formatting)
         try {
             const textToCopy = generatePoPlainText(cachedPOs[poId]); // Generate text version
             await navigator.clipboard.writeText(textToCopy);
             button.innerHTML = '<i class="fas fa-check"></i> Copied (Text)!';
             button.classList.add('copied');
             console.log("Clipboard API write not supported, copied as plain text.");
         } catch (err) {
             console.error("Clipboard fallback failed: ", err);
             alert("Error: Could not copy automatically. Clipboard access might be blocked or not supported.");
         } finally {
              button.disabled = true; // Disable temporarily after attempt
              setTimeout(() => {
                  button.innerHTML = '<i class="fas fa-copy"></i> Copy Content';
                  button.classList.remove('copied');
                  button.disabled = false;
              }, 2000);
         }
        return;
    }


    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Copying...';
    button.classList.add('copying');
    button.classList.remove('copied');

    try {
        const poData = cachedPOs[poId]; // Use cached data

        // Fetch Supplier Name (use cached supplier data if available)
        let supplierName = "Supplier";
        const cachedSupplier = suppliersDataCache.find(s => s.id === poData.supplierId);
        if (cachedSupplier) {
             supplierName = cachedSupplier.name || supplierName;
        } else if (poData.supplierId) { // Fallback to fetching if not in cache
            try {
                const supplierRef = doc(db, "suppliers", poData.supplierId);
                const supplierDocSnap = await getDoc(supplierRef);
                if (supplierDocSnap.exists()) supplierName = supplierDocSnap.data().name || supplierName;
                else supplierName = poData.supplierName || supplierName;
            } catch { supplierName = poData.supplierName || supplierName; }
        } else { supplierName = poData.supplierName || supplierName; }

        // Format Date
        let orderDateStr = 'N/A';
        if (poData.orderDate?.toDate) { try { orderDateStr = poData.orderDate.toDate().toLocaleDateString('en-GB'); } catch(e){} }

        // Get Terms HTML from the modal
        const termListElement = document.getElementById('poShareTermList');
        let termsHTML = termListElement ? termListElement.innerHTML : '<ol><li>Default T&C...</li></ol>'; // Get inner HTML of the list

        // Generate Plain Text Version
        const termsText = termListElement
            ? Array.from(termListElement.querySelectorAll('li')).map((li, index) => `${index + 1}. ${li.textContent.trim()}`).join('\n')
            : '1. Default T&C...';

        // Generate HTML Content for Clipboard
        let htmlContent = `
            <p><strong>Purchase Order #${escapeHtml(poData.poNumber || 'N/A')}</strong></p>
            <p><strong>Order Date:</strong> ${orderDateStr}</p>
            <hr>
            <p>Dear ${escapeHtml(supplierName)},<br>This Purchase Order is being shared with you. Please review the details below.</p>
            <hr>
            <h3>Items</h3>`;

        if (poData.items && poData.items.length > 0) {
            htmlContent += `<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 10pt;">
                                <thead><tr style="background-color: #f2f2f2;"><th>#</th><th>Product</th><th>Type</th><th>Details</th><th>Rate</th><th>Party</th><th>Design</th><th>Amount</th></tr></thead>
                                <tbody>`;
            poData.items.forEach((item, index) => {
                let detailStr = ''; const qty = item.quantity || '?'; const itemUnitType = item.unitType || 'Qty';
                const rate = item.rate ?? 0; const itemAmount = item.itemAmount ?? (Number(qty) * rate);
                if (itemUnitType === 'Sq Feet') { const w = item.width || '?'; const h = item.height || '?'; const u = item.dimensionUnit || 'units'; detailStr = `Qty: ${escapeHtml(qty)} (${escapeHtml(w)}x${escapeHtml(h)} ${escapeHtml(u)})`; }
                else { detailStr = `Qty: ${escapeHtml(qty)}`; }
                htmlContent += `<tr><td>${index + 1}</td><td>${escapeHtml(item.productName || 'N/A')}</td><td>${escapeHtml(itemUnitType)}</td><td>${detailStr}</td><td>${formatCurrency(rate)}</td><td>${escapeHtml(item.partyName || '-')}</td><td>${escapeHtml(item.designDetails || '-')}</td><td align="right">${formatCurrency(itemAmount)}</td></tr>`;
            });
             if (poData.totalAmount) {
                 htmlContent += `<tr style="font-weight: bold;"><td colspan="7" align="right">Grand Total:</td><td align="right">${formatCurrency(poData.totalAmount)}</td></tr>`;
             }
            htmlContent += `</tbody></table>`;
        } else { htmlContent += `<p>No items found.</p>`; }

        htmlContent += `<hr><h3>Terms & Conditions</h3><ol>${termsHTML}</ol>`; // Include the OL wrapper

        // Generate Plain Text Content
        let textContent = `Purchase Order #${poData.poNumber || 'N/A'}\nOrder Date: ${orderDateStr}\n\nDear ${supplierName},\nThis Purchase Order is being shared with you...\n\nItems:\n`;
        if (poData.items && poData.items.length > 0) {
             textContent += "--------------------------------------------------\n";
             textContent += poData.items.map((item, index) => {
                 let detailText = ''; const itemUnitType = item.unitType || 'Qty';
                 const rate = item.rate ?? 0; const itemAmount = item.itemAmount ?? (Number(item.quantity || 0) * rate);
                 if(itemUnitType === 'Sq Feet') { const w = item.width || '?'; const h = item.height || '?'; const u = item.dimensionUnit || 'units'; detailText = ` (${w}x${h} ${u})`; }
                 return `${index + 1}. ${item.productName || 'N/A'} - Qty: ${item.quantity || '?'}${detailText} | Rate: ${formatCurrency(rate)} | Amt: ${formatCurrency(itemAmount)}`;
             }).join('\n');
             textContent += "\n--------------------------------------------------";
             if(poData.totalAmount) {
                textContent += `\nGrand Total: ${formatCurrency(poData.totalAmount)}`;
             }
        } else { textContent += 'No items.'; }
        textContent += `\n\nTerms & Conditions:\n${termsText}`;

        // Create ClipboardItem with both formats
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        const textBlob = new Blob([textContent], { type: 'text/plain' });
        const clipboardItem = new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob
        });

        // Write to clipboard
        await navigator.clipboard.write([clipboardItem]);

        button.innerHTML = '<i class="fas fa-check"></i> Copied!';
        button.classList.add('copied');

    } catch (error) {
        console.error("Copy failed: ", error);
        alert("Error: Could not copy. " + error.message);
        button.innerHTML = '<i class="fas fa-copy"></i> Copy Content'; // Reset button text on error
    } finally {
        // Re-enable button after a delay, reset text
        button.classList.remove('copying');
        setTimeout(() => {
             if (button.classList.contains('copied')) { // Check if it was successful before resetting
                  button.innerHTML = '<i class="fas fa-copy"></i> Copy Content';
                  button.classList.remove('copied');
             }
             button.disabled = false;
        }, 2000); // Reset after 2 seconds
    }
}


// --- Print PO Function ---
function handlePrintPoShare() {
    const modalContentElement = document.getElementById('poShareScrollableContent');
    if (!poShareModal || !modalContentElement || !poShareModal.classList.contains('active')) {
        alert("Please open the PO Share view first or wait for content to load.");
        return;
    }

    try {
        const poIdForTitle = copyPoShareModalBtn?.dataset?.poid || '';
        const poNumber = cachedPOs[poIdForTitle]?.poNumber || 'PO';

        // Create an iframe for printing
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const printDoc = iframe.contentWindow.document;

        // Get base styles and modal-specific styles
        let styles = '';
        // Include necessary styles from supplier_management.css
        const stylesheets = Array.from(document.styleSheets);
        stylesheets.forEach(sheet => {
             // Be selective about which stylesheets to include, avoid full bootstrap if possible
             if (sheet.href && (sheet.href.includes('supplier_management.css') || sheet.href.includes('font-awesome') || sheet.href.includes('fonts.googleapis'))) {
                 try {
                      // Basic styles needed for layout and tables
                      styles += `@import url('${sheet.href}');\n`;
                 } catch (e) { console.warn("Could not import stylesheet rules:", sheet.href, e); }
             }
         });


         // Add specific print styles inline
         styles += `
             @media print {
                 body { margin: 20px !important; font-family: 'Poppins', sans-serif !important; color: #000 !important; background-color: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                 h2, h3 { color: #000 !important; }
                 hr { border-top: 1px dashed #ccc !important; margin: 15px 0 !important; }
                 table.details-table { width: 100% !important; border-collapse: collapse !important; font-size: 9pt !important; margin-bottom: 15px !important; }
                 table.details-table th, table.details-table td { border: 1px solid #ccc !important; padding: 6px 8px !important; text-align: left !important; color: #000 !important; background: #fff !important; }
                 table.details-table thead th { background-color: #eee !important; font-weight: bold !important; }
                 #poShareHeader, #poShareGreeting, #poShareItemsContainer, #poShareTerms { padding: 0 !important; }
                 #poShareInfo { font-size: 11pt !important; font-weight: 600 !important; margin-bottom: 15px !important; padding: 10px !important; background-color: #f8f8f8 !important; border: 1px solid #ccc !important; border-radius: 4px !important; display: flex !important; justify-content: space-between !important; flex-wrap: wrap !important; gap: 10px !important; }
                 #poShareInfo .po-number-large { font-size: 1.2em !important; color: #000 !important; }
                 #poShareGreeting { font-size: 10pt !important; margin-bottom: 15px !important; }
                 #poShareItemsContainer h3, #poShareTerms h3 { font-size: 12pt !important; margin-bottom: 10px !important; font-weight: 600 !important; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                 #poShareTermList { list-style-type: decimal !important; padding-left: 20px !important; margin: 0 !important; font-size: 9pt !important; color: #000 !important; }
                 #poShareTermList li { margin-bottom: 5px !important; }
                 a[href]:after { content: none !important; } /* Prevent URL printing */
                 .modal-header, .modal-actions, .close-button, .copy-button, .print-button, .cancel-button { display: none !important; } /* Hide modal controls */
             }
         `;

         // Construct printable HTML
         printDoc.open();
         printDoc.write(`
             <html>
             <head>
                 <title>Print Purchase Order - ${escapeHtml(poNumber)}</title>
                 <style>${styles}</style>
             </head>
             <body>
                 ${document.getElementById('poShareHeader')?.innerHTML || ''}
                 ${document.getElementById('poShareGreeting')?.innerHTML || ''}
                 <hr class="po-share-divider">
                 ${document.getElementById('poShareItemsContainer')?.innerHTML || ''}
                 <hr class="po-share-divider">
                 ${document.getElementById('poShareTerms')?.innerHTML || ''}
             </body>
             </html>
         `);
         printDoc.close();


        // Print the iframe content
        iframe.contentWindow.focus(); // Required for some browsers
         // Use timeout to ensure styles are applied
         setTimeout(() => {
             try {
                 iframe.contentWindow.print();
             } catch (e) {
                 console.error("Print command failed:", e);
                 alert("Printing failed. Please try again or use the browser's print option.");
             } finally {
                  // Clean up the iframe after printing (or attempting to)
                  setTimeout(() => {
                      document.body.removeChild(iframe);
                  }, 500); // Delay removal slightly
             }
         }, 500); // Adjust delay if needed

    } catch (error) {
        console.error("Error preparing print view:", error);
        alert("Could not prepare the print view. Please check the console.");
         // Clean up iframe if created before error
         const iframe = document.querySelector('iframe[style*="absolute"]');
         if(iframe) document.body.removeChild(iframe);
    }
}


// --- See More Items Modal ---
async function openSeeMoreItemsModal(poId) {
    if (!poItemsModal || !poItemsModalContent || !poItemsModalTitle) {
        console.error("PO Items Modal elements missing!");
        alert("Could not display items.");
        return;
    }

    poItemsModalTitle.textContent = `Items for PO #${poId.substring(0, 6)}...`;
    poItemsModalContent.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading items...</p>'; // Loading state
    poItemsModal.style.display = 'block'; // Show modal

    try {
        let poData = cachedPOs[poId]; // Try cache first

        // Fetch if not in cache
        if (!poData) {
            const poSnap = await getDoc(doc(db, "purchaseOrders", poId));
            if (poSnap.exists()) {
                poData = poSnap.data();
                cachedPOs[poId] = poData; // Update cache
            }
        }

        if (!poData || !poData.items || poData.items.length === 0) {
            throw new Error("No items found for this PO.");
        }

        // Build items table HTML
        let itemsTableHtml = `<table class="details-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Item Name</th>
                                        <th>Qty</th>
                                        <th>Type</th>
                                        <th>Size/Details</th>
                                        <th>Rate</th>
                                        <th>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>`;
        poData.items.forEach((item, index) => {
            const qty = item.quantity || 0;
            const rate = item.rate || 0;
            const itemAmount = item.itemAmount || (qty * rate); // Calculate if missing
            let sizeText = '-';
            if (item.unitType === 'Sq Feet' && item.width && item.height) {
                const width = escapeHtml(item.width);
                const height = escapeHtml(item.height);
                const unit = escapeHtml(item.dimensionUnit || 'units');
                sizeText = `${width} x ${height} ${unit}`;
                 // Add print details if available
                 if (item.printSqFt) sizeText += `<br><small>Print: ${parseFloat(item.printSqFt).toFixed(2)} sqft</small>`;
            } else if (item.unitType !== 'Qty') {
                sizeText = item.unitType || '-'; // Show unit type if not Qty/SqFt
            }

            itemsTableHtml += `<tr>
                                <td style="text-align: center;">${index + 1}</td>
                                <td>${escapeHtml(item.productName || 'N/A')}</td>
                                <td style="text-align: right;">${escapeHtml(qty)}</td>
                                <td>${escapeHtml(item.unitType || 'N/A')}</td>
                                <td>${sizeText}</td>
                                <td style="text-align: right;">${formatCurrency(rate)}</td>
                                <td style="text-align: right;">${formatCurrency(itemAmount)}</td>
                              </tr>`;
        });
        itemsTableHtml += `</tbody></table>`;
         // Add Total Amount if available in PO data
         if (poData.totalAmount) {
            itemsTableHtml += `<div style="text-align: right; font-weight: bold; margin-top: 10px; padding-top: 10px; border-top: 1px solid #ccc;">Total PO Amount: ${formatCurrency(poData.totalAmount)}</div>`;
         }

        poItemsModalContent.innerHTML = itemsTableHtml; // Display the table

    } catch (error) {
        console.error(`Error loading items for PO ${poId}:`, error);
        poItemsModalContent.innerHTML = `<p style="color: red;">Error loading items: ${error.message}</p>`;
    }
}

function closePoItemsModal() {
    if (poItemsModal) {
        poItemsModal.style.display = 'none';
    }
}


// --- Batch Action Bar Update & Handling ---
function updateBatchActionBar() {
    if (!poBatchActionsBar || !poSelectedCount || !selectAllPoCheckbox || !batchApplyStatusBtn || !batchDeletePoBtn || !batchUpdateStatusSelect || !batchMarkReceivedBtn) {
         console.warn("Batch action bar elements not fully available.");
         return;
    }

    const count = selectedPoIds.size;
    const MAX_STATUS_UPDATE = 20; // Adjust limits as needed
    const MAX_DELETE = 10;
    const MAX_MARK_RECEIVED = 20;

    if (count > 0) {
        poSelectedCount.textContent = `${count} PO${count > 1 ? 's' : ''} selected`;
        poBatchActionsBar.style.display = 'flex'; // Show the bar

        // Enable/disable Apply Status button
        const statusSelected = batchUpdateStatusSelect.value !== "";
        batchApplyStatusBtn.disabled = !(statusSelected && count > 0 && count <= MAX_STATUS_UPDATE);
        if (count > MAX_STATUS_UPDATE) { batchApplyStatusBtn.title = `Select up to ${MAX_STATUS_UPDATE} POs to update status.`; }
        else if (!statusSelected) { batchApplyStatusBtn.title = `Select a status to apply.`; }
        else { batchApplyStatusBtn.title = `Apply status '${escapeHtml(batchUpdateStatusSelect.value)}' to ${count} PO(s).`; }

        // Enable/disable Mark Received button
        batchMarkReceivedBtn.disabled = !(count > 0 && count <= MAX_MARK_RECEIVED);
         if (count > MAX_MARK_RECEIVED) { batchMarkReceivedBtn.title = `Select up to ${MAX_MARK_RECEIVED} POs to mark received.`; }
         else { batchMarkReceivedBtn.title = `Mark ${count} selected PO(s) as Received.`; }

        // Enable/disable Delete button
        batchDeletePoBtn.disabled = !(count > 0 && count <= MAX_DELETE);
        if (count > MAX_DELETE) { batchDeletePoBtn.title = `Select up to ${MAX_DELETE} POs to delete.`; }
        else { batchDeletePoBtn.title = `Delete ${count} selected PO(s).`; }

        // Update Select All checkbox state
        const displayedCheckboxes = poTableBody?.querySelectorAll('.po-select-checkbox');
        selectAllPoCheckbox.checked = displayedCheckboxes && displayedCheckboxes.length > 0 && count === displayedCheckboxes.length;

    } else {
        // Hide bar and reset buttons if no selection
        poBatchActionsBar.style.display = 'none';
        selectAllPoCheckbox.checked = false;
        batchUpdateStatusSelect.value = ""; // Reset dropdown
        batchApplyStatusBtn.disabled = true;
        batchMarkReceivedBtn.disabled = true;
        batchDeletePoBtn.disabled = true;
    }
}

// --- Batch Action Event Listeners (Setup later in setupEventListeners) ---
async function handleBatchApplyStatus() {
     const newStatus = batchUpdateStatusSelect?.value;
     const idsToUpdate = Array.from(selectedPoIds);
     const MAX_LIMIT = 20; // Match limit in updateBatchActionBar

     if (!newStatus) { alert("Please select a status to apply."); return; }
     if (idsToUpdate.length === 0) { alert("Please select at least one PO."); return; }
     if (idsToUpdate.length > MAX_LIMIT) { alert(`You can update status for a maximum of ${MAX_LIMIT} POs at a time.`); return; }

     if (confirm(`Apply status '${escapeHtml(newStatus)}' to ${idsToUpdate.length} selected PO(s)?`)) {
          if (!batchApplyStatusBtn) return;
          batchApplyStatusBtn.disabled = true;
          batchApplyStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying...';
          let successCount = 0;

          try {
               const batch = writeBatch(db);
               idsToUpdate.forEach(poId => {
                    const poRef = doc(db, "purchaseOrders", poId);
                    batch.update(poRef, { status: newStatus, updatedAt: serverTimestamp() });
               });
               await batch.commit();
               successCount = idsToUpdate.length;
               alert(`Batch update complete. Status updated for ${successCount} PO(s).`);
          } catch (error) {
               console.error(`Error committing batch status update:`, error);
               alert(`Error applying batch status update: ${error.message}`);
          } finally {
               batchApplyStatusBtn.disabled = false;
               batchApplyStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Apply Status';
               selectedPoIds.clear(); // Clear selection after operation
               updateBatchActionBar(); // Update UI
               if(successCount > 0) await displayPoList(); // Refresh list on success
          }
     }
}

async function handleBatchMarkReceived() {
     const idsToUpdate = Array.from(selectedPoIds);
     const MAX_LIMIT = 20; // Match limit

     if (idsToUpdate.length === 0) { alert("Please select at least one PO."); return; }
      if (idsToUpdate.length > MAX_LIMIT) { alert(`You can mark received for a maximum of ${MAX_LIMIT} POs at a time.`); return; }

     if (confirm(`Mark ${idsToUpdate.length} selected PO(s) as 'Product Received'?`)) {
          if (!batchMarkReceivedBtn) return;
          batchMarkReceivedBtn.disabled = true;
          batchMarkReceivedBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Marking...';
          let successCount = 0;

          try {
               const batch = writeBatch(db);
               idsToUpdate.forEach(poId => {
                    const poRef = doc(db, "purchaseOrders", poId);
                    batch.update(poRef, { status: 'Product Received', receivedDate: serverTimestamp(), updatedAt: serverTimestamp() });
               });
               await batch.commit();
               successCount = idsToUpdate.length;
               alert(`Mark Received complete. Updated ${successCount} PO(s).`);
          } catch (error) {
               console.error("Error batch marking received:", error);
               alert(`Error marking POs received: ${error.message}`);
          } finally {
               batchMarkReceivedBtn.disabled = false;
               batchMarkReceivedBtn.innerHTML = '<i class="fas fa-check-circle"></i> Mark Received';
               selectedPoIds.clear();
               updateBatchActionBar();
                if(successCount > 0) await displayPoList();
          }
     }
}

async function handleBatchDelete() {
     const idsToDelete = Array.from(selectedPoIds);
     const MAX_LIMIT = 10; // Match limit

     if (idsToDelete.length === 0) { alert("Please select at least one PO to delete."); return; }
     if (idsToDelete.length > MAX_LIMIT) { alert(`You can delete a maximum of ${MAX_LIMIT} POs at a time.`); return; }

     if (confirm(`Permanently delete ${idsToDelete.length} selected PO(s)? This cannot be undone.`)) {
          if (!batchDeletePoBtn) return;
          batchDeletePoBtn.disabled = true;
          batchDeletePoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
          let successCount = 0;

          try {
               const batch = writeBatch(db);
               idsToDelete.forEach(poId => {
                    batch.delete(doc(db, "purchaseOrders", poId));
               });
               await batch.commit();
               successCount = idsToDelete.length;
               alert(`Batch delete complete. Deleted ${successCount} PO(s).`);
          } catch (error) {
               console.error(`Error committing batch delete:`, error);
               alert(`Error deleting POs: ${error.message}`);
          } finally {
               batchDeletePoBtn.disabled = false;
               batchDeletePoBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Selected';
               selectedPoIds.clear();
               updateBatchActionBar();
               if(successCount > 0) await displayPoList();
          }
     }
}

// --- CSV Export Functionality ---
function exportPoDataToCsv(poDocs) {
    if (!poDocs || poDocs.length === 0) {
        alert("No PO data available to export.");
        return;
    }
    console.log(`Exporting ${poDocs.length} POs to CSV...`);

    // Define CSV Headers
    const headers = [
        "PO_ID", "PO_Number", "Order_Date", "Supplier_ID", "Supplier_Name",
        "Total_Amount", "Amount_Paid", "Payment_Status", "PO_Status",
        "Item_Index", "Product_Name", "Quantity", "Unit_Type", "Width", "Height", "Dimension_Unit", "Rate", "Item_Amount", "Party_Name", "Design_Details"
    ];

    let csvContent = headers.join(",") + "\n"; // Header row

    // Process each PO document
    poDocs.forEach(docSnap => {
        const poId = docSnap.id;
        const po = docSnap.data();

        const poBaseData = [
            `"${poId}"`,
            `"${escapeCsvField(po.poNumber || '')}"`,
            `"${po.orderDate ? formatDate(po.orderDate) : ''}"`,
            `"${escapeCsvField(po.supplierId || '')}"`,
            `"${escapeCsvField(suppliersDataCache.find(s => s.id === po.supplierId)?.name || po.supplierName || '')}"`,
            po.totalAmount ?? 0,
            po.amountPaid ?? 0,
            `"${escapeCsvField(po.paymentStatus || 'Pending')}"`,
            `"${escapeCsvField(po.status || 'Unknown')}"`
        ];

        if (po.items && po.items.length > 0) {
            // Add a row for each item within the PO
            po.items.forEach((item, index) => {
                const itemData = [
                    index + 1, // Item index (1-based)
                    `"${escapeCsvField(item.productName || '')}"`,
                    item.quantity ?? 0,
                    `"${escapeCsvField(item.unitType || '')}"`,
                    item.width ?? '',
                    item.height ?? '',
                     `"${escapeCsvField(item.dimensionUnit || '')}"`,
                    item.rate ?? 0,
                    item.itemAmount ?? 0,
                    `"${escapeCsvField(item.partyName || '')}"`,
                    `"${escapeCsvField(item.designDetails || '')}"`
                ];
                csvContent += poBaseData.join(",") + "," + itemData.join(",") + "\n";
            });
        } else {
            // If PO has no items, add a row with empty item details
            const emptyItemData = Array(headers.length - poBaseData.length).fill('""').join(',');
            csvContent += poBaseData.join(",") + "," + emptyItemData + "\n";
        }
    });

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    link.setAttribute("href", url);
    link.setAttribute("download", `purchase_orders_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log("CSV export triggered.");
}

// Helper to escape characters for CSV
function escapeCsvField(field) {
    if (field === null || field === undefined) {
        return '';
    }
    const stringField = String(field);
    // Escape double quotes by doubling them and enclose in double quotes if it contains comma, double quote, or newline
    if (stringField.includes('"') || stringField.includes(',') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
}

// Function to fetch all POs matching current filters for export
async function fetchAllFilteredPOsForExport() {
     if (!db || !collection || !getDocs || !query || !orderBy || !where) {
          alert("Error: Database functions missing for export.");
          return null;
     }
     console.log("Fetching all POs for export based on current filters...");

     try {
          // Rebuild the query based on current filter settings (same logic as displayPoList)
          let conditions = [];
          let baseQuery = collection(db, "purchaseOrders");
          const supplierFilterId = poSupplierFilter?.value;
          const statusFilter = poStatusFilter?.value;
          const startDateVal = poStartDateFilter?.value;
          const endDateVal = poEndDateFilter?.value;

          if (supplierFilterId) conditions.push(where("supplierId", "==", supplierFilterId));
          if (statusFilter) conditions.push(where("status", "==", statusFilter));
          if (startDateVal) try { conditions.push(where("orderDate", ">=", Timestamp.fromDate(new Date(startDateVal + 'T00:00:00')))); } catch {}
          if (endDateVal) try { conditions.push(where("orderDate", "<=", Timestamp.fromDate(new Date(endDateVal + 'T23:59:59')))); } catch {}

          // Sorting for export (optional, createdAt default might be fine)
           const exportQuery = query(baseQuery, ...conditions, orderBy('createdAt', 'desc'));

          const querySnapshot = await getDocs(exportQuery);

          // Apply client-side search term filtering if needed
          const searchTerm = poSearchInput?.value.trim().toLowerCase();
          let filteredDocs = querySnapshot.docs;

          if (searchTerm) {
               filteredDocs = filteredDocs.filter(docRef_po => {
                    const po = docRef_po.data();
                    const supplierName = suppliersDataCache.find(s => s.id === po.supplierId)?.name?.toLowerCase() || '';
                    const itemNames = (po.items || []).map(item => item.productName?.toLowerCase() || '').join(' ');
                    const poNumberStr = po.poNumber?.toString().toLowerCase() || '';
                    return poNumberStr.includes(searchTerm) || supplierName.includes(searchTerm) || itemNames.includes(searchTerm);
               });
          }

          console.log(`Workspaceed ${filteredDocs.length} POs for export.`);
          return filteredDocs;

     } catch (error) {
          console.error("Error fetching POs for export:", error);
           if (error.code === 'failed-precondition') {
                alert(`Export failed: Required database index is missing. Check Firestore indexes.`);
           } else {
                alert(`Error fetching data for export: ${error.message}`);
           }
          return null;
     }
}


// --- Page Initialization ---
async function initializeSupplierManagementPage(user) {
    console.log("Initializing Supplier Management Page...");
    if (!eventListenersInitialized) {
         setupEventListeners(); // Setup listeners only once
         eventListenersInitialized = true;
         console.log("Event listeners setup complete for supplier management page.");
    }

    try {
        // Load suppliers first as PO list might depend on supplier names from cache
        await displaySupplierTable();
        // Then load POs using the supplier cache
        await displayPoList();
        updateSortIndicators(); // Initialize sort indicators for PO table
        console.log("Supplier Management Page Initialized.");
    } catch (error) {
        console.error("Error during initial data load:", error);
        showSupplierListError("Error loading initial supplier data.");
        showPoListError("Error loading initial PO data.");
    }
}


// --- Event Listeners Setup ---
function setupEventListeners() {
    // --- Supplier List Related ---
    supplierTableBody?.addEventListener('click', handleSupplierTableActions); // Handles edit button clicks
    supplierTableBody?.addEventListener('click', handleSupplierRowClick); // Handles row clicks for navigation
    addNewSupplierBtn?.addEventListener('click', () => openSupplierModal('add'));
    closeSupplierModalBtn?.addEventListener('click', closeSupplierModal);
    cancelSupplierBtn?.addEventListener('click', closeSupplierModal);
    supplierForm?.addEventListener('submit', handleAddSupplierSubmit);
    supplierModal?.addEventListener('click', (event) => { if (event.target === supplierModal) closeSupplierModal(); }); // Close on backdrop click
    deleteSupplierFromModalBtn?.addEventListener('click', handleDeleteSupplierFromModal);

    // --- PO List Related ---
    poFilterBtn?.addEventListener('click', () => { displayPoList(); }); // Apply filters button
    poClearFilterBtn?.addEventListener('click', () => { // Clear filters button
        poSearchInput && (poSearchInput.value = '');
        poSupplierFilter && (poSupplierFilter.value = '');
        poStatusFilter && (poStatusFilter.value = '');
        poStartDateFilter && (poStartDateFilter.value = '');
        poEndDateFilter && (poEndDateFilter.value = '');
        currentPoSortField = 'createdAt'; // Reset sort
        currentPoSortDirection = 'desc';
        updateSortIndicators();
        displayPoList(); // Refresh list with defaults
    });
    poSearchInput?.addEventListener('keypress', (event) => { // Allow Enter key to trigger filter
        if (event.key === 'Enter') {
            event.preventDefault();
            poFilterBtn ? poFilterBtn.click() : displayPoList();
        }
    });
    poTableHeader?.addEventListener('click', handlePoSort); // PO Table Sorting
    poTableBody?.addEventListener('click', handlePOTableActions); // PO Table Action Buttons/Links

    // --- Batch Actions ---
    selectAllPoCheckbox?.addEventListener('change', (event) => { // Select/Deselect All Checkbox
        const isChecked = event.target.checked;
        poTableBody?.querySelectorAll('.po-select-checkbox').forEach(checkbox => {
            checkbox.checked = isChecked;
            const poId = checkbox.value;
            const row = checkbox.closest('tr');
            if (isChecked) {
                selectedPoIds.add(poId);
                row?.classList.add('selected-row');
            } else {
                selectedPoIds.delete(poId);
                row?.classList.remove('selected-row');
            }
        });
        updateBatchActionBar();
    });
    poTableBody?.addEventListener('change', (event) => { // Individual PO Checkbox
        if (event.target.classList.contains('po-select-checkbox')) {
            const checkbox = event.target;
            const poId = checkbox.value;
            const row = checkbox.closest('tr');
            if (checkbox.checked) {
                selectedPoIds.add(poId);
                 row?.classList.add('selected-row');
            } else {
                selectedPoIds.delete(poId);
                 row?.classList.remove('selected-row');
            }
            updateBatchActionBar();
        }
    });
    deselectAllPoBtn?.addEventListener('click', () => { // Deselect All Button
        selectedPoIds.clear();
        poTableBody?.querySelectorAll('.po-select-checkbox').forEach(checkbox => checkbox.checked = false);
        poTableBody?.querySelectorAll('tr.selected-row').forEach(row => row.classList.remove('selected-row'));
        if (selectAllPoCheckbox) selectAllPoCheckbox.checked = false;
        updateBatchActionBar();
    });
    batchApplyStatusBtn?.addEventListener('click', handleBatchApplyStatus);
    batchMarkReceivedBtn?.addEventListener('click', handleBatchMarkReceived);
    batchDeletePoBtn?.addEventListener('click', handleBatchDelete);
    batchUpdateStatusSelect?.addEventListener('change', updateBatchActionBar); // Update bar when status dropdown changes

    // --- Status Update Modal ---
    closeStatusModalBtn?.addEventListener('click', closeStatusModal);
    cancelStatusBtn?.addEventListener('click', closeStatusModal);
    statusUpdateForm?.addEventListener('submit', handleStatusUpdate);
    statusUpdateModal?.addEventListener('click', (event) => { if (event.target === statusUpdateModal) closeStatusModal(); });

    // --- PO Share Modal ---
    closePoShareModalTopBtn?.addEventListener('click', closePoShareModalFunction);
    closePoShareModalBtn?.addEventListener('click', closePoShareModalFunction);
    poShareModal?.addEventListener('click', (event) => { if (event.target === poShareModal) closePoShareModalFunction(); });
    printPoShareModalBtn?.addEventListener('click', handlePrintPoShare);
    copyPoShareModalBtn?.addEventListener('click', handleCopyPoShareContent);

    // --- PO Items Modal ---
    closePoItemsModalBtn?.addEventListener('click', closePoItemsModal);
    closePoItemsModalBottomBtn?.addEventListener('click', closePoItemsModal);
    poItemsModal?.addEventListener('click', (event) => { if (event.target === poItemsModal) closePoItemsModal(); });

    // --- CSV Export ---
    exportPoCsvBtn?.addEventListener('click', async () => {
         exportPoCsvBtn.disabled = true;
         exportPoCsvBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
         const poDocsToExport = await fetchAllFilteredPOsForExport();
         if (poDocsToExport) {
             exportPoDataToCsv(poDocsToExport);
         } else {
             // Error message handled in fetch function
         }
         exportPoCsvBtn.disabled = false;
         exportPoCsvBtn.innerHTML = '<i class="fas fa-file-csv"></i> Export POs (CSV)';
    });

    // Note: Listeners for dynamically added buttons inside tables are handled by delegation (e.g., handlePOTableActions)
}

// Make init function globally available for the auth script in HTML head
window.initializeSupplierManagementPage = initializeSupplierManagementPage;

// Auth listener in HTML head script should call initializeSupplierManagementPage when user is authenticated.
console.log("supplier_management.js script loaded. Waiting for initialization call.");