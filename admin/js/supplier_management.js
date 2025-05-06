// js/supplier_management.js - v30 (Fix Balance Calc, Fix PO Filter)

import { db, auth } from './firebase-init.js';
import {
    collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc, writeBatch,
    query, orderBy, where, Timestamp, serverTimestamp, limit, onSnapshot // Ensure all needed functions are imported
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- DOM Elements ---
const poTableBody = document.getElementById('poTableBody');
const poSearchInput = document.getElementById('poSearchInput');
const poSupplierFilter = document.getElementById('poSupplierFilter');
const poStatusFilter = document.getElementById('poStatusFilter'); // Filter for POs
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
const supplierContactInput = document.getElementById('supplierContactInput'); // Added for consistency
const supplierEmailInput = document.getElementById('supplierEmailInput');
const supplierAddressInput = document.getElementById('supplierAddressInput');
const supplierGstInput = document.getElementById('supplierGstInput');
const supplierFormError = document.getElementById('supplierFormError');
const statusUpdateModal = document.getElementById('statusUpdateModal');
const statusModalTitle = document.getElementById('statusModalTitle');
const closeStatusModalBtn = document.getElementById('closeStatusModal');
const cancelStatusBtn = document.getElementById('cancelStatusBtn');
const saveStatusBtn = document.getElementById('saveStatusBtn');
const statusUpdateForm = document.getElementById('statusUpdateForm');
const statusUpdatePOId = document.getElementById('statusUpdatePOId');
const currentPOStatusSpan = document.getElementById('currentPOStatus');
const statusSelect = document.getElementById('statusSelect'); // This seems to be for individual PO status update modal
const statusErrorMsg = document.getElementById('statusErrorMsg');
const poItemsModal = document.getElementById('poItemsModal');
const poItemsModalTitle = document.getElementById('poItemsModalTitle');
const poItemsModalContent = document.getElementById('poItemsModalContent');
const closePoItemsModalBtn = document.getElementById('closePoItemsModalBtn');
const closePoItemsModalBottomBtn = document.getElementById('closePoItemsModalBottomBtn');
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
const exportPoCsvBtn = document.getElementById('exportPoCsvBtn');

// --- Global State ---
let currentEditingSupplierId = null;
let suppliersDataCache = []; // Cache for supplier names and IDs
let cachedPOs = {}; // Cache PO data briefly if needed
// Removed unused PO state vars like currentPoQuery, poQueryUnsubscribe, poPagination
let selectedPoIds = new Set();
let currentPoSortField = 'createdAt'; // Default sort field for POs
let currentPoSortDirection = 'desc'; // Default sort direction

// --- Utility Functions ---
function escapeHtml(unsafe) { /* ... (same as before) ... */ if (typeof unsafe !== 'string') { try { unsafe = String(unsafe ?? ''); } catch (e) { unsafe = ''; } } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function formatCurrency(amount) { /* ... (same as before) ... */ const num = Number(amount); if (isNaN(num)) return 'N/A'; return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatDate(timestamp) { /* ... (same as before) ... */ if (!timestamp || typeof timestamp.toDate !== 'function') return '-'; try { return timestamp.toDate().toLocaleDateString('en-GB'); } catch (e) { console.error("Error formatting date:", e); return '-'; } }
function getStatusClass(status) { /* ... (same as before, from detail page) ... */ if (!status) return 'status-unknown'; const normalizedStatus = status.toLowerCase().replace(/\s+/g, '-'); switch (normalizedStatus) { case 'new': return 'status-new'; case 'sent': return 'status-sent'; case 'printing': return 'status-printing'; case 'product-received': return 'status-product-received'; case 'po-paid': return 'status-po-paid'; case 'cancel': return 'status-cancel'; default: return 'status-unknown'; } }
function getPaymentStatusClass(status) { /* ... (same as before, from detail page) ... */ if (!status) return 'payment-status-pending'; const normalizedStatus = status.toLowerCase().replace(/\s+/g, '-'); switch (normalizedStatus) { case 'pending': return 'payment-status-pending'; case 'partially-paid': return 'payment-status-partially-paid'; case 'paid': return 'payment-status-paid'; default: return 'payment-status-pending'; } }


// --- Error Display Functions ---
function displayError(message, elementId = 'poListError') { /* ... (same as before) ... */ const errorElement = document.getElementById(elementId); if (errorElement) { errorElement.textContent = message; errorElement.style.display = message ? 'block' : 'none'; if(message) errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); } else { console.error(`Error element ID '${elementId}' not found. Msg:`, message); alert(message); } }
function clearError(elementId = 'poListError') { /* ... (same as before) ... */ const errorElement = document.getElementById(elementId); if (errorElement) { errorElement.textContent = ''; errorElement.style.display = 'none'; } }
function showSupplierFormError(message) { displayError(message, 'supplierFormError'); }
function showStatusError(message) { displayError(message, 'statusErrorMsg'); }
function showPoListError(message) { displayError(message, 'poListError'); if (poLoadingMessage) poLoadingMessage.style.display = 'none'; if (poTableBody) poTableBody.innerHTML = '<tr><td colspan="9" class="error-message">' + escapeHtml(message) + '</td></tr>'; }
function showSupplierListError(message) { displayError(message, 'supplierListError'); if (supplierLoadingMessage) supplierLoadingMessage.style.display = 'none'; if (supplierTableBody) supplierTableBody.innerHTML = '<tr><td colspan="4" class="error-message">' + escapeHtml(message) + '</td></tr>'; }


// --- Supplier Balance Calculation Helpers (Copied/adapted from supplier_account_detail.js) ---
async function getSupplierTotalPoValue(supplierId) {
    if (!supplierId) return 0;
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
        // Don't display error here, let the calling function handle it
        return 0; // Return 0 on error
    }
}

async function getSupplierTotalPaymentAmount(supplierId) {
     if (!supplierId) return 0;
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
        return 0; // Return 0 on error
    }
}

async function getSupplierAdjustmentTotals(supplierId) {
     if (!supplierId) return { totalDebit: 0, totalCredit: 0 };
    let totalDebit = 0;
    let totalCredit = 0;
    try {
        // Ensure Firestore index exists: supplierAccountAdjustments collection, supplierId field
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
        // Handle index error specifically?
        if (error.code === 'failed-precondition') {
            console.warn(`Firestore index missing for supplierAccountAdjustments by supplierId (${supplierId}).`);
        }
        return { totalDebit: 0, totalCredit: 0 }; // Return 0 on error
    }
}


// --- Supplier List Functions ---
async function displaySupplierTable() {
    if (!supplierTableBody || !supplierLoadingMessage) { console.error("Supplier table elements missing."); return; }
    if (!db || !collection || !getDocs || !query || !orderBy) { showSupplierListError("Error: DB functions missing."); return; }

    showSupplierListError(''); // Clear previous errors
    supplierLoadingMessage.style.display = 'table-row';
    supplierTableBody.innerHTML = ''; // Clear previous rows
    suppliersDataCache = []; // Reset cache

    try {
        const q = query(collection(db, "suppliers"), orderBy("name_lowercase")); // Order by lowercase name
        const querySnapshot = await getDocs(q);
        supplierLoadingMessage.style.display = 'none';

        if (querySnapshot.empty) {
            supplierTableBody.innerHTML = '<tr><td colspan="4" class="no-results">No suppliers found. Add one using the button above.</td></tr>';
        } else {
            const balancePromises = []; // To calculate balances concurrently
            querySnapshot.forEach((docSnapshot) => {
                const supplier = docSnapshot.data();
                const supplierId = docSnapshot.id;
                // Add to cache immediately
                suppliersDataCache.push({ id: supplierId, ...supplier });

                const tr = document.createElement('tr');
                tr.setAttribute('data-id', supplierId);
                tr.setAttribute('title', 'Click to view account details');
                tr.classList.add('clickable-row');

                const name = escapeHtml(supplier.name || 'N/A');
                const contact = escapeHtml(supplier.whatsappNo || supplier.contact || '-'); // Use 'contact' field

                tr.innerHTML = `
                    <td>${name}</td>
                    <td>${contact}</td>
                    <td class="supplier-balance" style="text-align: right;">Calculating...</td> {/* Placeholder */}
                    <td class="action-buttons">
                        <button class="button edit-supplier-btn small-button" data-id="${supplierId}" title="Edit Supplier"><i class="fas fa-edit"></i></button>
                    </td>`;
                supplierTableBody.appendChild(tr);

                // Add promise to calculate balance for this row
                balancePromises.push(calculateAndDisplaySupplierBalance(supplierId, tr.querySelector('.supplier-balance')));
            });
            await Promise.all(balancePromises); // Wait for all balances to be calculated and displayed
        }
        populateSupplierFilterDropdown(); // Populate filter after cache is built
    } catch (error) {
        console.error("Error fetching suppliers: ", error);
        showSupplierListError(`Error loading suppliers: ${error.message}`);
        populateSupplierFilterDropdown(); // Populate even on error
    }
}

// *** IMPLEMENTED Balance Calculation ***
async function calculateAndDisplaySupplierBalance(supplierId, balanceCellElement) {
    if (!balanceCellElement || !supplierId) return;
    balanceCellElement.textContent = 'Calculating...'; // Show calculating state

    try {
        // Fetch data concurrently
        const [poTotal, paymentTotal, adjustmentTotals] = await Promise.all([
            getSupplierTotalPoValue(supplierId),
            getSupplierTotalPaymentAmount(supplierId),
            getSupplierAdjustmentTotals(supplierId)
        ]);

        // Balance Logic (same as detail page)
        const totalDebits = poTotal + adjustmentTotals.totalDebit;
        const totalCredits = paymentTotal + adjustmentTotals.totalCredit;
        const finalBalance = totalDebits - totalCredits;

        // Display formatted balance
        balanceCellElement.classList.remove('balance-due', 'balance-credit', 'balance-zero');
        if (finalBalance > 0.005) { // Payable by you
            balanceCellElement.textContent = formatCurrency(finalBalance);
            balanceCellElement.classList.add('balance-due'); // Add class for potential styling (red)
        } else if (finalBalance < -0.005) { // Credit (Supplier owes you)
            balanceCellElement.textContent = formatCurrency(Math.abs(finalBalance)) + " Cr";
            balanceCellElement.classList.add('balance-credit'); // Add class for potential styling (green)
        } else { // Zero balance
            balanceCellElement.textContent = formatCurrency(0);
             balanceCellElement.classList.add('balance-zero'); // Add class for potential styling (gray)
        }

    } catch (error) {
        console.error(`Error calculating balance for supplier ${supplierId}:`, error);
        balanceCellElement.textContent = 'Error';
        balanceCellElement.classList.add('balance-due'); // Indicate error state
    }
}

function populateSupplierFilterDropdown() {
    /* ... (same as before) ... */
    if (!poSupplierFilter) return; const selectedVal = poSupplierFilter.value;
    poSupplierFilter.innerHTML = '<option value="">All Suppliers</option>';
    const sortedSuppliers = [...suppliersDataCache].sort((a, b) => (a.name_lowercase || '').localeCompare(b.name_lowercase || ''));
    sortedSuppliers.forEach(supplier => { const option = document.createElement('option'); option.value = supplier.id; option.textContent = escapeHtml(supplier.name || supplier.id); poSupplierFilter.appendChild(option); });
    if (poSupplierFilter.querySelector(`option[value="${selectedVal}"]`)) { poSupplierFilter.value = selectedVal; } else { poSupplierFilter.value = ""; } // Reset if previous selection gone
}

function handleSupplierTableActions(event) {
    /* ... (same as before) ... */
    const targetButton = event.target.closest('button.edit-supplier-btn'); if (!targetButton) return;
    event.stopPropagation(); const supplierId = targetButton.dataset.id; if (!supplierId) return;
    const supplierData = suppliersDataCache.find(s => s.id === supplierId);
    if (supplierData) { openSupplierModal('edit', supplierData, supplierId); } else { console.warn(`Supplier ${supplierId} not found in cache for edit.`); /* Optionally try fetching */ }
}

function handleSupplierRowClick(event) {
    /* ... (same as before) ... */
    const row = event.target.closest('tr'); if (event.target.closest('button')) { return; } // Ignore clicks on buttons within the row
    const supplierId = row?.dataset.id; if (supplierId) { window.location.href = `supplier_account_detail.html?id=${supplierId}`; }
}

// --- Supplier Modal/CRUD Functions ---
function openSupplierModal(mode = 'add', supplierData = null, supplierId = null) {
    /* ... (same as before, ensure all fields like supplierContactInput exist) ... */
     if (!supplierModal || !supplierForm || !supplierModalTitle || !supplierFormError || !editSupplierIdInput || !supplierNameInput || !deleteSupplierFromModalBtn || !supplierContactInput) { console.error("Supplier modal elements missing!"); alert("Cannot open supplier form."); return; }
     supplierForm.reset(); showSupplierFormError(''); currentEditingSupplierId = null; deleteSupplierFromModalBtn.style.display = 'none';
     if (mode === 'edit' && supplierData && supplierId) {
         supplierModalTitle.textContent = 'Edit Supplier'; editSupplierIdInput.value = supplierId; currentEditingSupplierId = supplierId;
         supplierNameInput.value = supplierData.name || '';
         supplierCompanyInput.value = supplierData.companyName || '';
         supplierWhatsappInput.value = supplierData.whatsappNo || '';
         supplierContactInput.value = supplierData.contact || ''; // Populate contact field
         supplierEmailInput.value = supplierData.email || '';
         supplierAddressInput.value = supplierData.address || '';
         supplierGstInput.value = supplierData.gstNo || '';
         deleteSupplierFromModalBtn.style.display = 'inline-flex';
         deleteSupplierFromModalBtn.dataset.name = supplierData.name || supplierId;
     } else { supplierModalTitle.textContent = 'Add New Supplier'; editSupplierIdInput.value = ''; }
     supplierModal.style.display = 'block'; // Use block instead of active class? Check CSS
}

function closeSupplierModal() { /* ... (same as before) ... */ if (supplierModal) { supplierModal.style.display = 'none'; } }

async function handleAddSupplierSubmit(event) {
    /* ... (ensure supplierContactInput.value is included in supplierData) ... */
    event.preventDefault();
    if (!db || !collection || !addDoc || !doc || !updateDoc || !serverTimestamp || !Timestamp) { showSupplierFormError("Error: Database functions missing."); return; }
    if (!saveSupplierBtn || !supplierNameInput || !supplierFormError || !supplierContactInput) { alert("Error: Cannot save supplier due to missing form elements."); return; }
    const supplierName = supplierNameInput.value.trim(); if (!supplierName) { showSupplierFormError("Supplier Name is required."); supplierNameInput.focus(); return; }

    // Include contact field
    const supplierData = {
        name: supplierName,
        name_lowercase: supplierName.toLowerCase(),
        companyName: supplierCompanyInput.value.trim(),
        whatsappNo: supplierWhatsappInput.value.trim(),
        contact: supplierContactInput.value.trim(), // Added contact
        email: supplierEmailInput.value.trim(),
        address: supplierAddressInput.value.trim(),
        gstNo: supplierGstInput.value.trim(),
        updatedAt: serverTimestamp(),
        // Maintain existing status if editing, default to 'active' if adding
        status: currentEditingSupplierId ? suppliersDataCache.find(s=>s.id === currentEditingSupplierId)?.status || 'active' : 'active'
    };

    saveSupplierBtn.disabled = true; saveSupplierBtn.textContent = 'Saving...'; showSupplierFormError('');
    try {
        const supplierIdToUse = editSupplierIdInput.value;
        if (supplierIdToUse) { // Update existing
            const supplierRef = doc(db, "suppliers", supplierIdToUse);
            await updateDoc(supplierRef, supplierData);
            // Update cache
            const index = suppliersDataCache.findIndex(s => s.id === supplierIdToUse);
            if (index > -1) {
                // Merge existing data with updated data, preserving original createdAt and status if not changed
                suppliersDataCache[index] = { ...suppliersDataCache[index], ...supplierData };
            }
        } else { // Add new
            supplierData.createdAt = serverTimestamp();
            const docRef = await addDoc(collection(db, "suppliers"), supplierData);
            // Add to cache (fetch actual created time later if needed or assume current time)
            suppliersDataCache.push({ id: docRef.id, ...supplierData, createdAt: Timestamp.now() }); // Add basic new entry to cache
        }
        closeSupplierModal();
        await displaySupplierTable(); // Refresh the table
        populateSupplierFilterDropdown(); // Refresh dropdown
    } catch (error) {
        console.error("Error saving supplier: ", error);
        showSupplierFormError("Error saving supplier: " + error.message);
    } finally {
        if(saveSupplierBtn) { saveSupplierBtn.disabled = false; saveSupplierBtn.textContent = 'Save Supplier'; }
    }
}

async function deleteSupplier(supplierId, supplierName) { /* ... (same as before) ... */ if (!db || !doc || !deleteDoc) { alert("Error: Functions missing for deleting supplier."); return; } try { console.log(`Attempting to delete ONLY supplier document: ${supplierId}`); await deleteDoc(doc(db, "suppliers", supplierId)); alert(`Supplier "${escapeHtml(supplierName || supplierId)}" deleted successfully. Associated POs and Payments are NOT deleted.`); suppliersDataCache = suppliersDataCache.filter(s => s.id !== supplierId); await displaySupplierTable(); populateSupplierFilterDropdown(); await displayPoList(); } catch (error) { console.error("Error deleting supplier: ", error); alert("Error deleting supplier: " + error.message); } }
function handleDeleteSupplierFromModal() { /* ... (same as before) ... */ const supplierId = editSupplierIdInput.value; const supplierName = deleteSupplierFromModalBtn.dataset.name || supplierId; if (!supplierId) { alert("Cannot delete: Supplier ID not found."); return; } if (confirm(`WARNING!\nAre you absolutely sure you want to delete supplier "${escapeHtml(supplierName)}"?\n\nAssociated Purchase Orders and Payments WILL NOT be deleted.\nThis action cannot be undone.`)) { closeSupplierModal(); deleteSupplier(supplierId, supplierName); } }


// --- PO List Functions ---
async function displayPoList() {
    if (!poTableBody || !poLoadingMessage || !poStatusFilter) {
        console.error("Required PO list elements missing.");
        return;
    }
    if (!db || !collection || !getDocs || !query || !orderBy || !where || !doc || !getDoc || !Timestamp || !limit) {
        showPoListError("Error: DB functions missing.");
        return;
    }

    showPoListError(''); // Clear previous errors
    poLoadingMessage.style.display = 'table-row';
    poTableBody.innerHTML = ''; // Clear table body
    if (poTotalsDisplay) poTotalsDisplay.textContent = 'Loading totals...';
    // Removed pagination controls handling as pagination logic isn't fully implemented here
    // if (poPaginationControls) poPaginationControls.style.display = 'none';

    selectedPoIds.clear();
    updateBatchActionBar();
    if (selectAllPoCheckbox) selectAllPoCheckbox.checked = false;

    try {
        let conditions = [];
        let baseQuery = collection(db, "purchaseOrders");

        // --- Filtering Logic ---
        const searchTerm = poSearchInput.value.trim().toLowerCase();
        const supplierFilterId = poSupplierFilter.value;
        const statusFilter = poStatusFilter.value; // Value from the dropdown
        const startDateVal = poStartDateFilter.value;
        const endDateVal = poEndDateFilter.value;

        if (supplierFilterId) { conditions.push(where("supplierId", "==", supplierFilterId)); }

        // *** FIXED Filter Logic ***
        if (statusFilter) {
            // Define which filter values correspond to payment statuses
            // **IMPORTANT**: Ensure these values EXACTLY match the 'value' attributes in your HTML select options
            const paymentStatuses = ["Paid", "Partially Paid", "Pending"];
            // Define values for main PO statuses
            const poStatuses = ["New", "Sent", "Printing", "Product Received", "Cancelled", "Cancel"]; // Add any other main statuses used

            if (paymentStatuses.includes(statusFilter)) {
                // If the selected value is a payment status, filter by the paymentStatus field
                console.log(`Filtering by paymentStatus == ${statusFilter}`);
                conditions.push(where("paymentStatus", "==", statusFilter));
            } else if (poStatuses.includes(statusFilter)) {
                // If the selected value is a main PO status, filter by the status field
                console.log(`Filtering by status == ${statusFilter}`);
                conditions.push(where("status", "==", statusFilter));
            } else {
                 console.warn(`Unknown status filter value: ${statusFilter}. Ignoring status filter.`);
                 // Optionally filter by main status if it matches exactly
                 // conditions.push(where("status", "==", statusFilter));
            }
        }

        if (startDateVal) { try { conditions.push(where("orderDate", ">=", Timestamp.fromDate(new Date(startDateVal + 'T00:00:00')))); } catch (e) { console.error("Invalid start date", e); } }
        if (endDateVal) { try { conditions.push(where("orderDate", "<=", Timestamp.fromDate(new Date(endDateVal + 'T23:59:59')))); } catch (e) { console.error("Invalid end date", e); } }

        // --- Sorting Logic ---
        // Map display names/keys to actual Firestore field names
        const sortFieldMapping = {
            poNumber: 'poNumber',
            orderDate: 'orderDate',
            supplierName: 'supplierName', // Note: Firestore might not efficiently sort by a denormalized name
            totalAmount: 'totalAmount',
            status: 'status',
            paymentStatus: 'paymentStatus',
            createdAt: 'createdAt' // Default fallback
        };
        const firestoreSortField = sortFieldMapping[currentPoSortField] || 'createdAt';
        const firestoreSortDirection = currentPoSortDirection || 'desc';
        let sortClauses = [orderBy(firestoreSortField, firestoreSortDirection)];
        // Add secondary sort for consistency if not sorting by createdAt primarily
        if (firestoreSortField !== 'createdAt') {
            sortClauses.push(orderBy('createdAt', 'desc'));
        }

        // --- Build Query ---
        // Note: Complex queries with multiple inequality filters or orderBy on different fields than filters might require composite indexes.
        const finalQuery = query(baseQuery, ...conditions, ...sortClauses); // Removed limit for now

        // --- Execute Query ---
        const querySnapshot = await getDocs(finalQuery);
        poLoadingMessage.style.display = 'none';
        let filteredDocs = querySnapshot.docs; // Docs after Firestore filtering/sorting
        let grandTotalAmount = 0;
        cachedPOs = {}; // Clear cache

        // --- Client-Side Search (Apply after fetching) ---
        if (searchTerm) {
            filteredDocs = filteredDocs.filter(docRef_po => {
                const po = docRef_po.data();
                const supplierName = suppliersDataCache.find(s => s.id === po.supplierId)?.name?.toLowerCase() || '';
                const itemNames = (po.items || []).map(item => item.productName?.toLowerCase() || '').join(' ');
                // Check PO Number, Supplier Name, Item Names
                return (
                    po.poNumber?.toString().toLowerCase().includes(searchTerm) ||
                    supplierName.includes(searchTerm) ||
                    itemNames.includes(searchTerm)
                );
            });
        }

        // --- Render Results ---
        if (filteredDocs.length === 0) {
            poTableBody.innerHTML = `<tr><td colspan="9" class="no-results">No POs found matching your criteria.</td></tr>`;
            if (poTotalsDisplay) poTotalsDisplay.textContent = 'Total PO Value: ₹ 0.00';
            return;
        }

        filteredDocs.forEach(docRef_po => {
            const po = docRef_po.data();
            const poId = docRef_po.id;
            cachedPOs[poId] = po; // Cache data

            let supplierName = suppliersDataCache.find(s => s.id === po.supplierId)?.name || po.supplierName || 'Unknown';
            let orderDateStr = formatDate(po.orderDate || po.createdAt);
            let statusText = po.status || 'Unknown';
            let statusClass = getStatusClass(statusText); // Use helper function
            let paymentStatusText = po.paymentStatus || 'Pending';
            let paymentStatusClass = getPaymentStatusClass(paymentStatusText); // Use helper function
            let amount = po.totalAmount || 0;
            let amountStr = formatCurrency(amount);
            grandTotalAmount += amount;

            let supplierLink = po.supplierId
                ? `<a href="supplier_account_detail.html?id=${po.supplierId}" class="supplier-link" title="View Supplier: ${escapeHtml(supplierName)}">${escapeHtml(supplierName)}</a>`
                : escapeHtml(supplierName);

            let itemsHtml = 'N/A';
            if (po.items && po.items.length > 0) {
                 const firstItem = po.items[0];
                 const firstItemName = escapeHtml(firstItem.productName || 'Item');
                 if (po.items.length === 1) {
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
                     itemsHtml = `<span class="product-name-display">${firstItemName}</span> <button class="button see-more-items-btn small-button text-button" data-action="see-more-items" data-id="${poId}">${po.items.length - 1} more</button>`;
                 }
            }

            const tr = document.createElement('tr');
            tr.setAttribute('data-id', poId);
            // Ensure all columns match the table headers
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
                     ${statusText === 'Sent' || statusText === 'Printing' ? `<button class="button mark-received-btn small-button success-button" data-action="mark-received" data-id="${poId}" title="Mark as Received"><i class="fas fa-check"></i></button>` : ''}
                    <button class="button edit-button small-button" data-action="edit-po" data-id="${poId}" title="Edit PO"><i class="fas fa-edit"></i></button>
                    <button class="button status-button small-button" data-action="change-status-modal" data-id="${poId}" data-number="${escapeHtml(po.poNumber)}" data-status="${escapeHtml(statusText)}" title="Update Status"><i class="fas fa-sync-alt"></i></button>
                    <button class="button delete-button small-button" data-action="delete-po" data-id="${poId}" data-number="${escapeHtml(po.poNumber)}" title="Delete PO"><i class="fas fa-trash-alt"></i></button>
                </td>`;
            poTableBody.appendChild(tr);
        });

        if (poTotalsDisplay) poTotalsDisplay.textContent = `Total PO Value (Displayed): ${formatCurrency(grandTotalAmount)}`;
        // Add pagination logic here if needed

    } catch (error) {
        console.error("Error fetching/displaying POs: ", error);
        if (error.code === 'failed-precondition') {
            showPoListError(`Error: Firestore index missing for the current filter/sort combination. Please check the Firestore console for index recommendations.`);
        } else {
            showPoListError(`Error loading POs: ${error.message}`);
        }
        if (poTotalsDisplay) poTotalsDisplay.textContent = 'Error loading totals';
    }
}


// --- PO Table Sorting Logic ---
function handlePoSort(event) { /* ... (same as before) ... */ const header = event.target.closest('th[data-sortable="true"]'); if (!header) return; const sortKey = header.dataset.sortKey; if (!sortKey) return; let newDirection; if (currentPoSortField === sortKey) { newDirection = currentPoSortDirection === 'asc' ? 'desc' : 'asc'; } else { newDirection = 'asc'; } currentPoSortField = sortKey; currentPoSortDirection = newDirection; updateSortIndicators(); displayPoList(); }
function updateSortIndicators() { /* ... (same as before) ... */ if (!poTableHeader) return; poTableHeader.querySelectorAll('th[data-sortable="true"]').forEach(th => { th.classList.remove('sort-asc', 'sort-desc'); th.querySelector('.sort-indicator')?.remove(); if (th.dataset.sortKey === currentPoSortField) { const indicator = document.createElement('span'); indicator.classList.add('sort-indicator'); if (currentPoSortDirection === 'asc') { th.classList.add('sort-asc'); indicator.innerHTML = ' &uarr;'; } else { th.classList.add('sort-desc'); indicator.innerHTML = ' &darr;'; } th.appendChild(indicator); } }); }

// --- PO Table Action Handling ---
async function handlePOTableActions(event) { /* ... (same as before) ... */ const actionElement = event.target.closest('button[data-action]'); const targetCell = event.target.closest('td'); if (targetCell && targetCell.classList.contains('po-number-link')) { const row = targetCell.closest('tr'); const poId = row?.dataset.id; if (poId) { openPoShareModal(poId); } return; } if (!actionElement) return; const action = actionElement.dataset.action; const poId = actionElement.dataset.id; const poNumber = actionElement.dataset.number; if (!action || !poId) { console.error("Action button missing action or PO ID.", { action, poId }); return; } switch (action) { case 'mark-received': markPOAsReceived(poId); break; case 'edit-po': window.location.href = `new_po.html?editPOId=${poId}`; break; case 'change-status-modal': const currentStatus = actionElement.dataset.status; openStatusModal(poId, currentStatus, poNumber); break; case 'see-more-items': openSeeMoreItemsModal(poId); break; case 'delete-po': const confirmMessage = `क्या आप वाकई PO (${poNumber || poId.substring(0,6)}) को डिलीट करना चाहते हैं?`; if (confirm(confirmMessage)) { try { const poRef = doc(db, "purchaseOrders", poId); await deleteDoc(poRef); const rowToRemove = poTableBody.querySelector(`tr[data-id="${poId}"]`); if (rowToRemove) { rowToRemove.remove(); } else { await displayPoList(); } delete cachedPOs[poId]; alert(`PO (${poNumber || poId.substring(0,6)}) सफलतापूर्वक डिलीट हो गया है।`); } catch (error) { console.error(`Error deleting PO ${poId}:`, error); displayError(`PO डिलीट करने में विफल: ${error.message}`); } } break; default: console.warn(`Unknown action encountered: '${action}' for PO ID: ${poId}`); } }

// --- PO Receiving Logic ---
async function markPOAsReceived(poId) { /* ... (same as before) ... */ if (!poId || !db || !doc || !updateDoc || !serverTimestamp) { alert("Error: Cannot mark PO as received."); return; } if (confirm(`Mark PO #${poId.substring(0, 6)}... as 'Product Received'?`)) { try { await updateDoc(doc(db, "purchaseOrders", poId), { status: "Product Received", receivedDate: serverTimestamp(), updatedAt: serverTimestamp() }); alert("PO status updated to 'Product Received'."); const row = poTableBody.querySelector(`tr[data-id="${poId}"]`); if(row) { const statusBadge = row.querySelector('.status-badge'); if(statusBadge) { statusBadge.textContent = 'Product Received'; statusBadge.className = 'status-badge status-product-received'; } const markBtn = row.querySelector('.mark-received-btn'); if(markBtn) markBtn.remove(); } else { await displayPoList(); } } catch (error) { console.error(`Error marking PO ${poId} received:`, error); alert("Error updating PO status: " + error.message); } } }

// --- Status Update Modal Functions ---
function openStatusModal(poId, currentStatus, poNumber) { /* ... (same as before) ... */ if (!statusUpdateModal || !statusUpdatePOId || !currentPOStatusSpan || !statusSelect || !statusModalTitle) { console.error("Status update modal elements missing!"); return; } statusUpdatePOId.value = poId; currentPOStatusSpan.textContent = currentStatus || 'N/A'; statusModalTitle.textContent = `Update Status for PO #${poNumber || poId.substring(0,6)}`; statusSelect.value = currentStatus || ''; showStatusError(''); statusUpdateModal.style.display = 'block'; }
function closeStatusModal() { /* ... (same as before) ... */ if (statusUpdateModal) { statusUpdateModal.style.display = 'none'; } }
async function handleStatusUpdate(event) { /* ... (same as before) ... */ event.preventDefault(); if (!statusUpdatePOId || !statusSelect || !db || !doc || !updateDoc || !serverTimestamp) { showStatusError("Internal error occurred."); return; } const poId = statusUpdatePOId.value; const newStatus = statusSelect.value; if (!poId || !newStatus) { showStatusError("Please select a new status."); return; } showStatusError(''); saveStatusBtn.disabled = true; saveStatusBtn.textContent = 'Saving...'; try { await updateDoc(doc(db, "purchaseOrders", poId), { status: newStatus, updatedAt: serverTimestamp() }); closeStatusModal(); const row = poTableBody.querySelector(`tr[data-id="${poId}"]`); if (row) { const statusBadge = row.querySelector('.status-badge'); const statusBtn = row.querySelector('.status-button'); const markReceivedBtn = row.querySelector('.mark-received-btn'); if (statusBadge) { statusBadge.textContent = newStatus; statusBadge.className = `status-badge status-${getStatusClass(newStatus)}`; } if (statusBtn) { statusBtn.dataset.status = newStatus; } if (newStatus === 'Sent' || newStatus === 'Printing') { if (!markReceivedBtn && row.querySelector('.action-buttons')) { const button = document.createElement('button'); button.className = 'button mark-received-btn small-button success-button'; button.dataset.action = 'mark-received'; button.dataset.id = poId; button.title = 'Mark as Received'; button.innerHTML = '<i class="fas fa-check"></i>'; row.querySelector('.action-buttons').prepend(button); } } else { if (markReceivedBtn) markReceivedBtn.remove(); } } else { await displayPoList(); } alert("PO Status updated successfully."); } catch (error) { console.error(`Error updating status for PO ${poId}:`, error); showStatusError(`Failed to update status: ${error.message}`); } finally { saveStatusBtn.disabled = false; saveStatusBtn.textContent = 'Update Status'; } }

// --- PO Share Modal Functions ---
// Assume these are correct as per previous version, no changes needed for current issue
async function openPoShareModal(poId) { /* ... (same as before) ... */ if (!poShareModal || !poShareModalTitle || !poShareInfo || !poShareGreeting || !poShareItemsContainer || !poShareTermList || !copyPoShareModalBtn) { console.error("PO Share modal elements missing!"); alert("Error: Cannot open PO Share view."); return; } poShareModalTitle.textContent = "Purchase Order"; poShareInfo.innerHTML = 'Loading PO info...'; poShareGreeting.innerHTML = 'Loading greeting...'; poShareItemsContainer.innerHTML = '<h3>Items</h3><p><i class="fas fa-spinner fa-spin"></i> Loading items...</p>'; poShareTermList.innerHTML = '<li>Loading T&C...</li>'; copyPoShareModalBtn.dataset.poid = ''; copyPoShareModalBtn.disabled = true; copyPoShareModalBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Content'; copyPoShareModalBtn.classList.remove('copied', 'copying'); poShareModal.classList.add('active'); try { const poRef = doc(db, "purchaseOrders", poId); const poDocSnap = await getDoc(poRef); if (!poDocSnap.exists()) { throw new Error(`Could not find Purchase Order with ID: ${escapeHtml(poId)}`); } const poData = poDocSnap.data(); cachedPOs[poId] = poData; let supplierName = "Supplier"; if (poData.supplierId) { try { const supplierRef = doc(db, "suppliers", poData.supplierId); const supplierDocSnap = await getDoc(supplierRef); if (supplierDocSnap.exists()) { supplierName = supplierDocSnap.data().name || supplierName; } else { supplierName = poData.supplierName || supplierName; } } catch (supplierError) { supplierName = poData.supplierName || supplierName; } } else { supplierName = poData.supplierName || supplierName; } const poNumberDisplay = poData.poNumber ? `<span class="po-number-large">#${escapeHtml(poData.poNumber)}</span>` : 'N/A'; let orderDateStr = 'N/A'; if (poData.orderDate?.toDate) { try { orderDateStr = poData.orderDate.toDate().toLocaleDateString('en-GB'); } catch (e) {} } poShareInfo.innerHTML = `<span class="po-info-left">PO Number: ${poNumberDisplay}</span><span class="po-info-right"><span>Order Date: ${orderDateStr}</span></span>`; poShareGreeting.innerHTML = `Dear ${escapeHtml(supplierName)},<br>This Purchase Order is being shared with you. Please review the details below.`; let itemsHTML = '<p>No items found.</p>'; if (poData.items && poData.items.length > 0) { itemsHTML = `<table class="details-table"><thead><tr><th>#</th><th>Product Name</th><th>Type</th><th>Details (Qty/Size/Calc)</th><th>Rate</th><th>Party</th><th>Design</th><th style="text-align: right;">Amount</th></tr></thead><tbody>`; poData.items.forEach((item, index) => { let detailStr = ''; const qty = item.quantity || '?'; const itemUnitType = item.unitType || 'Qty'; if (itemUnitType === 'Sq Feet') { const w = item.width || '?'; const h = item.height || '?'; const u = item.dimensionUnit || 'units'; const printSqFt = item.printSqFt ? parseFloat(item.printSqFt).toFixed(2) : '?'; const printW = item.printWidthFt ? parseFloat(item.printWidthFt).toFixed(2) + 'ft' : '?'; const printH = item.printHeightFt ? parseFloat(item.printHeightFt).toFixed(2) + 'ft' : '?'; detailStr = `Qty: ${escapeHtml(qty)} (${escapeHtml(w)}x${escapeHtml(h)} ${escapeHtml(u)})<br>Print Area: ${escapeHtml(printSqFt)} sqft (on ${escapeHtml(printW)}x${escapeHtml(printH)} media)`; } else { detailStr = `Qty: ${escapeHtml(qty)}`; } itemsHTML += `<tr><td>${index + 1}</td><td>${escapeHtml(item.productName || 'N/A')}</td><td>${escapeHtml(itemUnitType)}</td><td>${detailStr}</td><td>${item.rate?.toFixed(2) ?? 'N/A'}</td><td>${escapeHtml(item.partyName || '-')}</td><td>${escapeHtml(item.designDetails || '-')}</td><td style="text-align: right;">${item.itemAmount?.toFixed(2) ?? 'N/A'}</td></tr>`; }); itemsHTML += `</tbody></table>`; poShareItemsContainer.innerHTML = `<h3>Items</h3>${itemsHTML}`; } else { poShareItemsContainer.innerHTML = `<h3>Items</h3><p>No items found for this PO.</p>`; } poShareTermList.innerHTML = `<li>Ensure prompt delivery of the order.</li><li>The supplied material must match the approved sample and specifications.</li><li>Maintain the specified quality standards.</li><li>Payment may be withheld or rejected for defective/substandard goods.</li>`; copyPoShareModalBtn.dataset.poid = poId; copyPoShareModalBtn.disabled = false; } catch (error) { console.error("Error opening or populating PO Share modal:", error); poShareModalTitle.textContent = "Error"; poShareInfo.innerHTML = ''; poShareGreeting.innerHTML = ''; poShareItemsContainer.innerHTML = `<p class="error-message">Error loading PO details: ${escapeHtml(error.message)}</p>`; poShareTermList.innerHTML = ''; copyPoShareModalBtn.disabled = true; } }
function closePoShareModalFunction() { /* ... (same as before) ... */ if (poShareModal) { poShareModal.classList.remove('active'); } }
async function handleCopyPoShareContent(event) { /* ... (same as before) ... */ const button = event.currentTarget; const poId = button.dataset.poid; if (!poId) { alert("Error: Could not find PO ID to copy."); return; } if (!navigator.clipboard || !navigator.clipboard.write) { alert("Error: Clipboard API not supported or not available."); return; } button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Copying...'; button.classList.add('copying'); button.classList.remove('copied'); try { const poRef = doc(db, "purchaseOrders", poId); const poDocSnap = await getDoc(poRef); if (!poDocSnap.exists()) { throw new Error("PO data not found."); } const poData = poDocSnap.data(); let supplierName = "Supplier"; if (poData.supplierId) { try { const supplierRef = doc(db, "suppliers", poData.supplierId); const supplierDocSnap = await getDoc(supplierRef); if (supplierDocSnap.exists()) { supplierName = supplierDocSnap.data().name || supplierName; } else { supplierName = poData.supplierName || supplierName; } } catch (supplierError) { supplierName = poData.supplierName || supplierName; } } else { supplierName = poData.supplierName || supplierName; } let orderDateStr = 'N/A'; if (poData.orderDate?.toDate) { try { orderDateStr = poData.orderDate.toDate().toLocaleDateString('en-GB'); } catch(e){} } const termListElement = document.getElementById('poShareTermList'); let termsHTML = termListElement ? termListElement.innerHTML : '<ol><li>Default T&C...</li></ol>'; let termsText = ''; if (termListElement) { termsText = Array.from(termListElement.querySelectorAll('li')).map((li, index) => `${index + 1}. ${li.textContent.trim()}`).join('\n'); } else { termsText = '1. Default T&C...'; } let htmlContent = `<p><strong>Purchase Order #${escapeHtml(poData.poNumber || 'N/A')}</strong></p><p><strong>Order Date:</strong> ${orderDateStr}</p><hr><p>Dear ${escapeHtml(supplierName)},<br>This Purchase Order is being shared with you. Please review the details below.</p><hr><h3>Items</h3>`; if (poData.items && poData.items.length > 0) { htmlContent += `<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 10pt;"><thead><tr style="background-color: #f2f2f2;"><th>#</th><th>Product</th><th>Type</th><th>Details</th><th>Rate</th><th>Party</th><th>Design</th><th>Amount</th></tr></thead><tbody>`; poData.items.forEach((item, index) => { let detailStr = ''; const qty = item.quantity || '?'; const itemUnitType = item.unitType || 'Qty'; if (itemUnitType === 'Sq Feet') { const w = item.width || '?'; const h = item.height || '?'; const u = item.dimensionUnit || 'units'; const printSqFt = item.printSqFt ? parseFloat(item.printSqFt).toFixed(2) : '?'; detailStr = `Qty: ${escapeHtml(qty)} (${escapeHtml(w)}x${escapeHtml(h)} ${escapeHtml(u)})<br>Print Area: ${escapeHtml(printSqFt)} sqft`; } else { detailStr = `Qty: ${escapeHtml(qty)}`; } htmlContent += `<tr><td>${index + 1}</td><td>${escapeHtml(item.productName || 'N/A')}</td><td>${escapeHtml(itemUnitType)}</td><td>${detailStr}</td><td>${item.rate?.toFixed(2) ?? 'N/A'}</td><td>${escapeHtml(item.partyName || '-')}</td><td>${escapeHtml(item.designDetails || '-')}</td><td align="right">${item.itemAmount?.toFixed(2) ?? 'N/A'}</td></tr>`; }); htmlContent += `</tbody></table>`; } else { htmlContent += `<p>No items found.</p>`; } htmlContent += `<hr><h3>Terms & Conditions</h3><ol>${termsHTML}</ol>`; let textContent = `Purchase Order #${poData.poNumber || 'N/A'}\nOrder Date: ${orderDateStr}\n\nDear ${supplierName},\nThis Purchase Order is being shared with you...\n\nItems:\n`; if (poData.items && poData.items.length > 0) { textContent += poData.items.map((item, index) => { let detailText = ''; const itemUnitType = item.unitType || 'Qty'; if(itemUnitType === 'Sq Feet') { const w = item.width || '?'; const h = item.height || '?'; const u = item.dimensionUnit || 'units'; detailText = ` (${w}x${h} ${u})`; } return `${index + 1}. ${item.productName || 'N/A'} - Qty: ${item.quantity || '?'}${detailText}`; }).join('\n'); } else { textContent += 'No items.'; } textContent += `\n\nTerms & Conditions:\n${termsText}`; const htmlBlob = new Blob([htmlContent], { type: 'text/html' }); const textBlob = new Blob([textContent], { type: 'text/plain' }); const clipboardItem = new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob }); await navigator.clipboard.write([clipboardItem]); button.innerHTML = '<i class="fas fa-check"></i> Copied!'; button.classList.add('copied'); } catch (error) { console.error("Copy failed: ", error); alert("Error: Could not copy. " + error.message); button.innerHTML = '<i class="fas fa-copy"></i> Copy Content'; } finally { button.classList.remove('copying'); setTimeout(() => { if (button.classList.contains('copied')) { button.innerHTML = '<i class="fas fa-copy"></i> Copy Content'; button.classList.remove('copied'); button.disabled = false; } else { button.innerHTML = '<i class="fas fa-copy"></i> Copy Content'; button.disabled = false; } }, 2000); } }
function handlePrintPoShare() { /* ... (same as before) ... */ const modalContentElement = document.getElementById('poShareScrollableContent'); if (!poShareModal || !modalContentElement || !poShareModal.classList.contains('active')) { alert("Please open the PO Share view first or wait for content to load."); return; } try { const poIdForTitle = copyPoShareModalBtn?.dataset?.poid || ''; const poNumber = cachedPOs[poIdForTitle]?.poNumber || 'PO'; const printWindow = window.open('', '_blank', 'height=800,width=800'); printWindow.document.write('<html><head><title>Print Purchase Order - ' + escapeHtml(poNumber) + '</title>'); printWindow.document.write(`<style> body { margin: 20px; font-family: 'Poppins', sans-serif; line-height: 1.5; color: #333; } h2, h3 { color: #0056b3; margin-bottom: 10px; } hr { border: none; border-top: 1px dashed #ccc; margin: 15px 0; } table.details-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 15px; } table.details-table th, table.details-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; } table.details-table thead th { background-color: #eee; font-weight: bold; } #poShareInfo { font-size: 11pt; font-weight: 600; margin-bottom: 15px; padding: 10px; background-color: #f8f8f8; border: 1px solid #ccc; border-radius: 4px; display: flex; justify-content: space-between; flex-wrap: wrap; } #poShareInfo .po-number-large { font-size: 1.2em; color: #0056b3; } #poShareGreeting { font-size: 10pt; margin-bottom: 15px; } #poShareTerms { margin-top: 15px; } #poShareTermList { list-style-type: decimal; padding-left: 20px; margin: 0; font-size: 9pt; } #poShareTermList li { margin-bottom: 4px; } @media print { body { margin: 0; } .no-print { display: none !important; } } </style>`); printWindow.document.write('</head><body>'); printWindow.document.write(document.getElementById('poShareHeader').innerHTML); printWindow.document.write(document.getElementById('poShareGreeting').innerHTML); printWindow.document.write('<hr class="po-share-divider">'); printWindow.document.write(document.getElementById('poShareItemsContainer').innerHTML); printWindow.document.write('<hr class="po-share-divider">'); printWindow.document.write(document.getElementById('poShareTerms').innerHTML); printWindow.document.write('</body></html>'); printWindow.document.close(); printWindow.focus(); setTimeout(() => { try { printWindow.print(); } catch (e) { console.error("Print command failed:", e); alert("Printing failed. Please try again or use browser's print option."); } setTimeout(() => { try { printWindow.close(); } catch (e) {} }, 200); }, 1000); } catch (error) { console.error("Error preparing print window:", error); alert("Could not prepare the print view. Please check the console."); } }

// --- See More Items Modal Functions ---
async function openSeeMoreItemsModal(poId) { /* ... (same as before) ... */ if (!poItemsModal || !poItemsModalContent || !poItemsModalTitle) { console.error("PO Items Modal elements missing!"); alert("Could not display items."); return; } poItemsModalTitle.textContent = `Items for PO #${poId.substring(0, 6)}...`; poItemsModalContent.innerHTML = '<p>Loading items...</p>'; poItemsModal.style.display = 'block'; try { let poData = cachedPOs[poId]; if (!poData) { const poSnap = await getDoc(doc(db, "purchaseOrders", poId)); if (poSnap.exists()) poData = poSnap.data(); } if (!poData || !poData.items || poData.items.length === 0) { throw new Error("No items found for this PO."); } let itemsTableHtml = `<table class="details-table"><thead><tr><th>#</th><th>Item Name</th><th>Quantity</th><th>Size</th><th>Rate</th><th>Amount</th></tr></thead><tbody>`; poData.items.forEach((item, index) => { const itemTotal = (item.quantity || 0) * (item.rate || 0); let sizeText = '-'; if (item.unitType === 'Sq Feet' && item.width && item.height) { const width = escapeHtml(item.width); const height = escapeHtml(item.height); const unit = escapeHtml(item.dimensionUnit || 'units'); sizeText = `${width} x ${height} ${unit}`; } itemsTableHtml += `<tr><td>${index + 1}</td><td>${escapeHtml(item.productName || 'N/A')}</td><td style="text-align: right;">${escapeHtml(item.quantity || 0)}</td><td>${sizeText}</td><td style="text-align: right;">${formatCurrency(item.rate || 0)}</td><td style="text-align: right;">${formatCurrency(itemTotal)}</td></tr>`; }); itemsTableHtml += `</tbody></table>`; poItemsModalContent.innerHTML = itemsTableHtml; } catch (error) { console.error(`Error loading items for PO ${poId}:`, error); poItemsModalContent.innerHTML = `<p style="color: red;">Error loading items: ${error.message}</p>`; } }
function closePoItemsModal() { /* ... (same as before) ... */ if (poItemsModal) { poItemsModal.style.display = 'none'; } }

// --- Batch Action Bar Update ---
function updateBatchActionBar() { /* ... (same as before) ... */ if (!poBatchActionsBar || !poSelectedCount || !selectAllPoCheckbox || !batchApplyStatusBtn || !batchDeletePoBtn || !batchUpdateStatusSelect) return; const count = selectedPoIds.size; const MAX_STATUS_UPDATE = 10; const MAX_DELETE = 5; if (count > 0) { poSelectedCount.textContent = `${count} PO${count > 1 ? 's' : ''} selected`; poBatchActionsBar.style.display = 'flex'; const statusSelected = batchUpdateStatusSelect.value !== ""; batchApplyStatusBtn.disabled = !(statusSelected && count > 0 && count <= MAX_STATUS_UPDATE); if (count > MAX_STATUS_UPDATE) { batchApplyStatusBtn.title = `Select up to ${MAX_STATUS_UPDATE} POs to update status.`; } else if (!statusSelected) { batchApplyStatusBtn.title = `Select a status to apply.`; } else { batchApplyStatusBtn.title = `Apply status to ${count} PO(s).`; } batchDeletePoBtn.disabled = !(count > 0 && count <= MAX_DELETE); if (count > MAX_DELETE) { batchDeletePoBtn.title = `Select up to ${MAX_DELETE} POs to delete.`; } else { batchDeletePoBtn.title = `Delete ${count} selected PO(s).`; } if(batchMarkReceivedBtn) batchMarkReceivedBtn.disabled = (count === 0); const displayedCheckboxes = poTableBody.querySelectorAll('.po-select-checkbox'); selectAllPoCheckbox.checked = displayedCheckboxes.length > 0 && count === displayedCheckboxes.length; } else { poBatchActionsBar.style.display = 'none'; selectAllPoCheckbox.checked = false; batchUpdateStatusSelect.value = ""; batchApplyStatusBtn.disabled = true; batchDeletePoBtn.disabled = true; if(batchMarkReceivedBtn) batchMarkReceivedBtn.disabled = true; } }

// --- Batch Action Event Listeners ---
if (selectAllPoCheckbox && poTableBody) { /* ... (same as before) ... */ selectAllPoCheckbox.addEventListener('change', (event) => { const isChecked = event.target.checked; poTableBody.querySelectorAll('.po-select-checkbox').forEach(checkbox => { checkbox.checked = isChecked; const poId = checkbox.value; const row = checkbox.closest('tr'); if (isChecked) { selectedPoIds.add(poId); if(row) row.classList.add('selected-row'); } else { selectedPoIds.delete(poId); if(row) row.classList.remove('selected-row'); } }); updateBatchActionBar(); }); }
if (poTableBody) { /* ... (same as before) ... */ poTableBody.addEventListener('change', (event) => { if (event.target.classList.contains('po-select-checkbox')) { const checkbox = event.target; const poId = checkbox.value; const row = checkbox.closest('tr'); if (checkbox.checked) { selectedPoIds.add(poId); if(row) row.classList.add('selected-row'); } else { selectedPoIds.delete(poId); if(row) row.classList.remove('selected-row'); } updateBatchActionBar(); } }); }
if (deselectAllPoBtn) { /* ... (same as before) ... */ deselectAllPoBtn.addEventListener('click', () => { selectedPoIds.clear(); poTableBody.querySelectorAll('.po-select-checkbox').forEach(checkbox => checkbox.checked = false); poTableBody.querySelectorAll('tr.selected-row').forEach(row => row.classList.remove('selected-row')); if (selectAllPoCheckbox) selectAllPoCheckbox.checked = false; updateBatchActionBar(); }); }
if(batchApplyStatusBtn && batchUpdateStatusSelect) { /* ... (same as before) ... */ batchApplyStatusBtn.addEventListener('click', async () => { const newStatus = batchUpdateStatusSelect.value; const idsToUpdate = Array.from(selectedPoIds); const MAX_LIMIT = 10; if (!newStatus) { alert("Please select a status to apply."); return; } if (idsToUpdate.length === 0) { alert("Please select at least one PO."); return; } if (idsToUpdate.length > MAX_LIMIT) { alert(`You can update status for a maximum of ${MAX_LIMIT} POs at a time.`); return; } if (confirm(`Apply status '${escapeHtml(newStatus)}' to ${idsToUpdate.length} selected PO(s)?`)) { batchApplyStatusBtn.disabled = true; batchApplyStatusBtn.textContent = 'Applying...'; let successCount = 0; let errorCount = 0; const batch = writeBatch(db); idsToUpdate.forEach(poId => { const poRef = doc(db, "purchaseOrders", poId); batch.update(poRef, { status: newStatus, updatedAt: serverTimestamp() }); }); try { await batch.commit(); successCount = idsToUpdate.length; } catch (error) { console.error(`Error committing batch status update:`, error); errorCount = idsToUpdate.length; successCount = 0; alert(`Error applying batch status update: ${error.message}`); } batchApplyStatusBtn.disabled = false; batchApplyStatusBtn.textContent = 'Apply Status'; if(successCount > 0) alert(`Batch update complete. Status updated for ${successCount} PO(s).`); selectedPoIds.clear(); poTableBody.querySelectorAll('.po-select-checkbox').forEach(cb => cb.checked = false); poTableBody.querySelectorAll('tr.selected-row').forEach(row => row.classList.remove('selected-row')); updateBatchActionBar(); displayPoList(); } }); }
if(batchMarkReceivedBtn) { /* ... (same as before) ... */ batchMarkReceivedBtn.addEventListener('click', async () => { const idsToUpdate = Array.from(selectedPoIds); if (idsToUpdate.length === 0) { alert("Please select at least one PO."); return; } if (confirm(`Mark ${idsToUpdate.length} selected PO(s) as 'Product Received'?`)) { batchMarkReceivedBtn.disabled = true; batchMarkReceivedBtn.textContent = 'Marking...'; let successCount = 0; let errorCount = 0; const batch = writeBatch(db); idsToUpdate.forEach(poId => { const poRef = doc(db, "purchaseOrders", poId); batch.update(poRef, { status: 'Product Received', receivedDate: serverTimestamp(), updatedAt: serverTimestamp() }); }); try { await batch.commit(); successCount = idsToUpdate.length; } catch (error) { console.error("Error batch marking received:", error); errorCount = idsToUpdate.length; alert(`Error: ${error.message}`); } batchMarkReceivedBtn.disabled = false; batchMarkReceivedBtn.textContent = 'Mark as Received'; if(successCount > 0) alert(`Mark Received complete. Updated ${successCount} PO(s).`); selectedPoIds.clear(); updateBatchActionBar(); displayPoList(); } }); }
if(batchDeletePoBtn) { /* ... (same as before) ... */ batchDeletePoBtn.addEventListener('click', async () => { const idsToDelete = Array.from(selectedPoIds); const MAX_LIMIT = 5; if (idsToDelete.length === 0) { alert("Please select at least one PO to delete."); return; } if (idsToDelete.length > MAX_LIMIT) { alert(`You can delete a maximum of ${MAX_LIMIT} POs at a time.`); return; } if (confirm(`Permanently delete ${idsToDelete.length} selected PO(s)? This cannot be undone.`)) { batchDeletePoBtn.disabled = true; batchDeletePoBtn.textContent = 'Deleting...'; let successCount = 0; let errorCount = 0; const batch = writeBatch(db); idsToDelete.forEach(poId => { batch.delete(doc(db, "purchaseOrders", poId)); }); try { await batch.commit(); successCount = idsToDelete.length; } catch (error) { console.error(`Error committing batch delete:`, error); errorCount = idsToDelete.length; alert(`Error deleting POs: ${error.message}`); } batchDeletePoBtn.disabled = false; batchDeletePoBtn.textContent = 'Delete Selected'; if(successCount > 0) alert(`Batch delete complete. Deleted ${successCount} PO(s).`); selectedPoIds.clear(); poTableBody.querySelectorAll('.po-select-checkbox').forEach(cb => cb.checked = false); poTableBody.querySelectorAll('tr.selected-row').forEach(row => row.classList.remove('selected-row')); updateBatchActionBar(); displayPoList(); } }); }


// --- Page Initialization & Event Listeners Setup ---
async function initializeSupplierManagementPage(user) {
    console.log("Initializing Supplier Management Page...");
    setupEventListeners(); // Setup listeners once
    try {
        // Load suppliers first to populate cache and dropdown
        await displaySupplierTable();
        // Then load POs (which might use the supplier filter)
        await displayPoList();
        // Initialize sort indicators
        updateSortIndicators();
        console.log("Supplier Management Page Initialized.");
    } catch (error) {
        console.error("Error during initial data load:", error);
        showSupplierListError("Error loading initial page data.");
        showPoListError("Error loading initial page data.");
    }
}

function setupEventListeners() {
    // --- Supplier List Related ---
    if (supplierTableBody) {
        supplierTableBody.addEventListener('click', handleSupplierTableActions);
        supplierTableBody.addEventListener('click', handleSupplierRowClick);
    }
    if (addNewSupplierBtn) addNewSupplierBtn.addEventListener('click', () => openSupplierModal('add'));
    if (closeSupplierModalBtn) closeSupplierModalBtn.addEventListener('click', closeSupplierModal);
    if (cancelSupplierBtn) cancelSupplierBtn.addEventListener('click', closeSupplierModal);
    if (supplierForm) supplierForm.addEventListener('submit', handleAddSupplierSubmit);
    if (supplierModal) supplierModal.addEventListener('click', (event) => { if (event.target === supplierModal) closeSupplierModal(); });
    if (deleteSupplierFromModalBtn) deleteSupplierFromModalBtn.addEventListener('click', handleDeleteSupplierFromModal);

    // --- PO List Related ---
    if (poFilterBtn) {
        poFilterBtn.addEventListener('click', () => {
            // Reset pagination if implemented displayPoList(true); // Pass true to indicate filter change
             displayPoList();
        });
    }
    if (poClearFilterBtn) {
        poClearFilterBtn.addEventListener('click', () => {
            if(poSearchInput) poSearchInput.value = '';
            if(poSupplierFilter) poSupplierFilter.value = '';
            if(poStatusFilter) poStatusFilter.value = ''; // Reset status filter dropdown
            if(poStartDateFilter) poStartDateFilter.value = '';
            if(poEndDateFilter) poEndDateFilter.value = '';
            currentPoSortField = 'createdAt'; // Reset sort
            currentPoSortDirection = 'desc';
            updateSortIndicators();
            displayPoList(); // Refresh list
        });
    }
    if (poSearchInput) {
        poSearchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevent form submission
                if (poFilterBtn) {
                    poFilterBtn.click(); // Trigger filter apply
                } else {
                    displayPoList(); // Refresh list directly if no button
                }
            }
        });
    }
    if (poTableHeader) { poTableHeader.addEventListener('click', handlePoSort); }
    if (poTableBody) { poTableBody.addEventListener('click', handlePOTableActions); }

    // --- Batch Actions ---
    if(selectAllPoCheckbox && poTableBody) { /* Listener setup moved to Batch Action section */ }
    if(poTableBody) { /* Listener setup moved to Batch Action section */ }
    if(deselectAllPoBtn) { /* Listener setup moved to Batch Action section */ }
    if(batchApplyStatusBtn && batchUpdateStatusSelect) { /* Listener setup moved to Batch Action section */ }
    if(batchMarkReceivedBtn) { /* Listener setup moved to Batch Action section */ }
    if(batchDeletePoBtn) { /* Listener setup moved to Batch Action section */ }
    if(batchUpdateStatusSelect) { batchUpdateStatusSelect.addEventListener('change', updateBatchActionBar); } // Ensure action bar updates on status select change

    // --- Status Update Modal ---
    if (closeStatusModalBtn) closeStatusModalBtn.addEventListener('click', closeStatusModal);
    if (cancelStatusBtn) cancelStatusBtn.addEventListener('click', closeStatusModal);
    if (statusUpdateForm) statusUpdateForm.addEventListener('submit', handleStatusUpdate);
    if (statusUpdateModal) statusUpdateModal.addEventListener('click', (event) => { if (event.target === statusUpdateModal) closeStatusModal(); });

    // --- PO Share Modal ---
    if (closePoShareModalTopBtn) closePoShareModalTopBtn.addEventListener('click', closePoShareModalFunction);
    if (closePoShareModalBtn) closePoShareModalBtn.addEventListener('click', closePoShareModalFunction);
    if (poShareModal) poShareModal.addEventListener('click', (event) => { if (event.target === poShareModal) closePoShareModalFunction(); });
    if (printPoShareModalBtn) printPoShareModalBtn.addEventListener('click', handlePrintPoShare);
    if (copyPoShareModalBtn) copyPoShareModalBtn.addEventListener('click', handleCopyPoShareContent);

    // --- PO Items Modal ---
    if (closePoItemsModalBtn) closePoItemsModalBtn.addEventListener('click', closePoItemsModal);
    if (closePoItemsModalBottomBtn) closePoItemsModalBottomBtn.addEventListener('click', closePoItemsModal);
    if (poItemsModal) poItemsModal.addEventListener('click', (event) => { if (event.target === poItemsModal) closePoItemsModal(); });

    // --- Other Actions ---
    if (exportPoCsvBtn) exportPoCsvBtn.addEventListener('click', () => { alert("CSV Export needs implementation."); });

     console.log("Event listeners setup complete for supplier management page.");
}

// Make init function globally available
window.initializeSupplierManagementPage = initializeSupplierManagementPage;