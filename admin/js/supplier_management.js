// js/supplier_management.js - v21 (Step 2: Display Supplier List & Populate Filter)

// --- Imports ---
// Assuming generatePoPdf is in utils.js (make sure utils.js is present and correct)
// import { generatePoPdf } from './utils.js';
// Assuming db and auth are initialized in firebase-init.js and available globally or imported
import { db, auth } from './firebase-init.js';

// Import necessary Firestore functions
import {
    collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc,
    query, orderBy, where, Timestamp, serverTimestamp, limit, onSnapshot // Added onSnapshot if needed later
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- DOM Elements ---
// PO Section Elements
const poTableBody = document.getElementById('poTableBody');
const poSearchInput = document.getElementById('poSearchInput');
const poSupplierFilter = document.getElementById('poSupplierFilter'); // New supplier filter
const poStatusFilter = document.getElementById('poStatusFilter');
const poStartDateFilter = document.getElementById('poStartDateFilter');
const poEndDateFilter = document.getElementById('poEndDateFilter');
const poFilterBtn = document.getElementById('poFilterBtn');
const poClearFilterBtn = document.getElementById('poClearFilterBtn');
const poTotalsDisplay = document.getElementById('poTotalsDisplay');
const poLoadingMessage = document.getElementById('poLoadingMessage');
const poListError = document.getElementById('poListError'); // Error display for PO list
const poPaginationControls = document.getElementById('poPaginationControls'); // Pagination
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


// Supplier Section Elements
const suppliersListSection = document.getElementById('suppliersListSection');
const supplierTableBody = document.getElementById('supplierTableBody');
const supplierLoadingMessage = document.getElementById('supplierLoadingMessage');
const supplierListError = document.getElementById('supplierListError'); // Error display for supplier list
const addNewSupplierBtn = document.getElementById('addNewSupplierBtn');

// Supplier Modal Elements
const supplierModal = document.getElementById('supplierModal');
const supplierModalTitle = document.getElementById('supplierModalTitle');
const closeSupplierModalBtn = document.getElementById('closeSupplierModal');
const cancelSupplierBtn = document.getElementById('cancelSupplierBtn');
const saveSupplierBtn = document.getElementById('saveSupplierBtn');
const supplierForm = document.getElementById('supplierForm');
const editSupplierIdInput = document.getElementById('editSupplierId'); // Updated ID
const supplierNameInput = document.getElementById('supplierNameInput');
const supplierCompanyInput = document.getElementById('supplierCompanyInput');
const supplierWhatsappInput = document.getElementById('supplierWhatsappInput');
const supplierEmailInput = document.getElementById('supplierEmailInput');
const supplierAddressInput = document.getElementById('supplierAddressInput');
const supplierGstInput = document.getElementById('supplierGstInput');
const supplierFormError = document.getElementById('supplierFormError'); // Updated ID

// Status Update Modal Elements
const statusUpdateModal = document.getElementById('statusUpdateModal');
const statusModalTitle = document.getElementById('statusModalTitle');
const closeStatusModalBtn = document.getElementById('closeStatusModal');
const cancelStatusBtn = document.getElementById('cancelStatusBtn'); // Renamed from cancelStatusUpdateBtn for consistency
const saveStatusBtn = document.getElementById('saveStatusBtn');     // Renamed from confirmStatusUpdateBtn
const statusUpdateForm = document.getElementById('statusUpdateForm');
const statusUpdatePOId = document.getElementById('statusUpdatePOId'); // Renamed from statusUpdatePoId
const currentPOStatusSpan = document.getElementById('currentPOStatus');
const statusSelect = document.getElementById('statusSelect');       // Renamed from newStatusSelect
const statusErrorMsg = document.getElementById('statusErrorMsg');   // Error display

// PO Details Modal Elements
const poDetailsModal = document.getElementById('poDetailsModal');
const poDetailsModalTitle = document.getElementById('poDetailsModalTitle');
const closePoDetailsModalBtn = document.getElementById('closePoDetailsModal'); // Top close button
const closePoDetailsBtn = document.getElementById('closePoDetailsModalBottomBtn'); // Bottom close button
const poDetailsContent = document.getElementById('poDetailsContent');
const printPoDetailsBtn = document.getElementById('printPoDetailsBtn');

// PO Share Modal Elements
const poShareModal = document.getElementById('poShareModal');
const poShareModalTitle = document.getElementById('poShareModalTitle');
const closePoShareModal = document.getElementById('closePoShareModalTopBtn'); // Top close button
const closePoShareModalBtn = document.getElementById('closePoShareModalBtn');  // Bottom close button
const printPoShareModalBtn = document.getElementById('printPoShareModalBtn');
const emailPoShareModalBtn = document.getElementById('emailPoShareModalBtn'); // New Email button
// Assuming other elements like poShareInfo, poShareGreeting etc. exist as per HTML

// Export Button
const exportPoCsvBtn = document.getElementById('exportPoCsvBtn');

// --- Global State ---
let currentEditingSupplierId = null;
let suppliersDataCache = []; // Cache for supplier names, used for display and filter dropdown
let cachedPOs = {}; // Cache for PO data, maybe useful for details modal
let currentPoQuery = null; // To store the current query for pagination/filtering
let poQueryUnsubscribe = null; // For potential real-time updates (optional)
let poPagination = {
    currentPage: 1,
    itemsPerPage: 25,
    lastVisibleDoc: null,
    firstVisibleDoc: null,
    totalItems: 0, // We might not calculate total efficiently without extra reads/functions
    hasNextPage: false,
    hasPrevPage: false
};
let selectedPoIds = new Set(); // For batch actions

// --- Utility Functions ---
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        try { unsafe = String(unsafe ?? ''); } catch (e) { unsafe = ''; }
    }
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatCurrency(amount) {
    const num = Number(amount);
    if (isNaN(num)) return 'N/A';
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
        return timestamp.toDate().toLocaleDateString('en-GB'); // dd/mm/yyyy format
    } catch (e) {
        console.error("Error formatting date:", e);
        return '-';
    }
}

// --- Error Display ---
function showSupplierListError(message) {
    if(supplierListError) {
        supplierListError.textContent = message;
        supplierListError.style.display = message ? 'block' : 'none';
    }
     if(supplierLoadingMessage) supplierLoadingMessage.style.display = 'none';
     if(supplierTableBody) supplierTableBody.innerHTML = ''; // Clear table on error
}

function showPoListError(message) {
    if(poListError) {
        poListError.textContent = message;
        poListError.style.display = message ? 'block' : 'none';
    }
    if(poLoadingMessage) poLoadingMessage.style.display = 'none';
     if(poTableBody) poTableBody.innerHTML = ''; // Clear table on error
}

function showSupplierFormError(message) {
    if(supplierFormError) {
        supplierFormError.textContent = message;
        supplierFormError.style.display = message ? 'block' : 'none';
    }
}

function showStatusError(message) {
    if(statusErrorMsg) {
        statusErrorMsg.textContent = message;
        statusErrorMsg.style.display = message ? 'block' : 'none';
    }
}

// --- NEW: Supplier List Functions ---

/**
 * Fetches suppliers from Firestore and displays them in the supplier table.
 * Also populates the PO filter dropdown.
 */
async function displaySupplierTable() {
    if (!supplierTableBody || !supplierLoadingMessage) {
        console.error("Supplier table body or loading message element not found!");
        return;
    }
    if (!db || !collection || !getDocs || !query || !orderBy) {
        showSupplierListError("Error: Required Firestore functions are missing.");
        return;
    }

    showSupplierListError(''); // Clear previous errors
    supplierLoadingMessage.style.display = 'table-row';
    supplierTableBody.innerHTML = ''; // Clear existing rows (except loading message)

    suppliersDataCache = []; // Reset cache

    try {
        const q = query(collection(db, "suppliers"), orderBy("name_lowercase")); // Order by lowercase name
        const querySnapshot = await getDocs(q);

        supplierLoadingMessage.style.display = 'none'; // Hide loading message

        if (querySnapshot.empty) {
            supplierTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 15px;">No suppliers found. Use "Add New Supplier" button.</td></tr>';
        } else {
            querySnapshot.forEach((docSnapshot) => {
                const supplier = docSnapshot.data();
                const supplierId = docSnapshot.id;
                // Add to cache for filter dropdown and potential edits
                suppliersDataCache.push({ id: supplierId, ...supplier });

                const tr = document.createElement('tr');
                tr.setAttribute('data-id', supplierId);

                const name = escapeHtml(supplier.name || 'N/A');
                const contact = escapeHtml(supplier.whatsappNo || supplier.contactNo || '-');
                const balancePlaceholder = `<span class="balance-loading" style="font-style: italic; color: #999;">Calculating...</span>`; // Placeholder for balance

                tr.innerHTML = `
                    <td>${name}</td>
                    <td>${contact}</td>
                    <td class="supplier-balance-cell">${balancePlaceholder}</td> <td class="action-buttons">
                        <button class="button view-account-button small-button" data-id="${supplierId}" title="View Account Details"><i class="fas fa-eye"></i></button>
                        <button class="button edit-button small-button" data-id="${supplierId}" title="Edit Supplier"><i class="fas fa-edit"></i></button>
                        <button class="button delete-button small-button" data-id="${supplierId}" data-name="${escapeHtml(supplier.name || '')}" title="Delete Supplier"><i class="fas fa-trash-alt"></i></button>
                    </td>
                `;
                supplierTableBody.appendChild(tr);
            });

            // Populate the PO filter dropdown after loading suppliers
            populateSupplierFilterDropdown();

            // TODO (Future Step): Call a function to calculate and update balances for displayed suppliers
             // updateSupplierBalances(suppliersDataCache);
        }
        console.log(`Displayed ${querySnapshot.size} suppliers.`);

    } catch (error) {
        console.error("Error fetching suppliers: ", error);
        showSupplierListError(`Error loading suppliers: ${error.message}`);
        populateSupplierFilterDropdown(); // Populate even if error fetching list details
    }
}

/**
 * Populates the Supplier dropdown in the PO filters section.
 */
function populateSupplierFilterDropdown() {
    if (!poSupplierFilter) return;

    // Keep the first option ("All Suppliers")
    poSupplierFilter.innerHTML = '<option value="">All Suppliers</option>';

    // Sort suppliers alphabetically for the dropdown
    const sortedSuppliers = [...suppliersDataCache].sort((a, b) =>
        (a.name_lowercase || '').localeCompare(b.name_lowercase || '')
    );

    sortedSuppliers.forEach(supplier => {
        const option = document.createElement('option');
        option.value = supplier.id;
        option.textContent = escapeHtml(supplier.name || supplier.id);
        poSupplierFilter.appendChild(option);
    });
    console.log("Supplier filter dropdown populated.");
}

// --- Event Handlers for Supplier Table Actions ---
function handleSupplierTableActions(event) {
    const targetButton = event.target.closest('button.action-button');
    if (!targetButton) return;

    const supplierId = targetButton.dataset.id;
    if (!supplierId) {
        console.error("Supplier ID not found on action button.");
        return;
    }

    if (targetButton.classList.contains('view-account-button')) {
        // Navigate to the new supplier detail page
        window.location.href = `supplier_account_detail.html?id=${supplierId}`;
    } else if (targetButton.classList.contains('edit-button')) {
        const supplierData = suppliersDataCache.find(s => s.id === supplierId);
        if (supplierData) {
            openSupplierModal('edit', supplierData, supplierId);
        } else {
            // Fallback: Fetch from DB if not in cache (should ideally be in cache)
            console.warn(`Supplier ${supplierId} not found in cache for edit. Fetching...`);
            getDoc(doc(db, "suppliers", supplierId)).then(docSnap => {
                if (docSnap.exists()) {
                    openSupplierModal('edit', docSnap.data(), supplierId);
                } else {
                    alert(`Error: Could not find supplier ${supplierId} to edit.`);
                }
            }).catch(err => {
                console.error("Error fetching supplier for edit:", err);
                alert("Error loading supplier details.");
            });
        }
    } else if (targetButton.classList.contains('delete-button')) {
        const supplierName = targetButton.dataset.name || supplierId;
        deleteSupplier(supplierId, supplierName); // Reuse existing delete function
    }
}


// --- Supplier Modal Functions (Existing - Adapted for new element IDs) ---
function openSupplierModal(mode = 'add', supplierData = null, supplierId = null) {
    if (!supplierModal || !supplierForm || !supplierModalTitle || !supplierFormError || !editSupplierIdInput || !supplierNameInput /* add other inputs */) {
        console.error("Supplier modal elements not found!");
        alert("Error: Could not open supplier form.");
        return;
    }
    supplierForm.reset();
    showSupplierFormError(''); // Clear errors
    currentEditingSupplierId = null; // Reset editing ID

    if (mode === 'edit' && supplierData && supplierId) {
        supplierModalTitle.textContent = 'Edit Supplier';
        editSupplierIdInput.value = supplierId;
        currentEditingSupplierId = supplierId;

        // Populate fields
        supplierNameInput.value = supplierData.name || '';
        supplierCompanyInput.value = supplierData.companyName || '';
        supplierWhatsappInput.value = supplierData.whatsappNo || '';
        supplierEmailInput.value = supplierData.email || '';
        supplierAddressInput.value = supplierData.address || '';
        supplierGstInput.value = supplierData.gstNo || '';
        // Populate other fields if added...

    } else {
        supplierModalTitle.textContent = 'Add New Supplier';
        editSupplierIdInput.value = '';
    }
    supplierModal.classList.add('active');
    supplierNameInput.focus(); // Focus first field
}

function closeSupplierModal() {
    if (supplierModal) {
        supplierModal.classList.remove('active');
    }
}

async function saveSupplier(event) {
    event.preventDefault();
    if (!db || !collection || !addDoc || !doc || !updateDoc || !Timestamp || !serverTimestamp) {
        showSupplierFormError("Error: Required database functions missing.");
        return;
    }
    if (!saveSupplierBtn || !supplierNameInput /* other inputs */) {
        console.error("Save Supplier prerequisites missing.");
        alert("Error: Cannot save supplier due to missing form elements.");
        return;
    }

    const supplierName = supplierNameInput.value.trim();
    if (!supplierName) {
        showSupplierFormError("Supplier Name is required.");
        supplierNameInput.focus();
        return;
    }

    // Prepare data
    const supplierData = {
        name: supplierName,
        name_lowercase: supplierName.toLowerCase(), // For case-insensitive searching/sorting
        companyName: supplierCompanyInput.value.trim() || null,
        whatsappNo: supplierWhatsappInput.value.trim() || null,
        email: supplierEmailInput.value.trim() || null,
        address: supplierAddressInput.value.trim() || null,
        gstNo: supplierGstInput.value.trim() || null,
        // Add other fields if needed
    };

    saveSupplierBtn.disabled = true;
    saveSupplierBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    showSupplierFormError('');

    try {
        const supplierIdToUse = editSupplierIdInput.value; // Use the hidden input ID

        if (supplierIdToUse) { // Editing existing supplier
            supplierData.updatedAt = serverTimestamp();
            const supplierRef = doc(db, "suppliers", supplierIdToUse);
            await updateDoc(supplierRef, supplierData);
            console.log("Supplier updated with ID: ", supplierIdToUse);
            alert("Supplier updated successfully!");
        } else { // Adding new supplier
            supplierData.createdAt = serverTimestamp();
            supplierData.updatedAt = serverTimestamp();
            // Optionally check for duplicates before adding
            const docRef = await addDoc(collection(db, "suppliers"), supplierData);
            console.log("Supplier added with ID: ", docRef.id);
            alert("Supplier added successfully!");
        }
        closeSupplierModal();
        await displaySupplierTable(); // Refresh the supplier list

    } catch (error) {
        console.error("Error saving supplier: ", error);
        showSupplierFormError("Error saving supplier: " + error.message);
    } finally {
        if(saveSupplierBtn) {
            saveSupplierBtn.disabled = false;
            // Restore original button text (might need to store it)
            saveSupplierBtn.innerHTML = '<i class="fas fa-save"></i> Save Supplier';
        }
    }
}

async function deleteSupplier(supplierId, supplierName) {
     if (!db || !doc || !deleteDoc) {
         alert("Error: Required functions missing for deleting supplier.");
         return;
     }
     // TODO: Add check if supplier has associated POs or payments before deleting?
     if (confirm(`Are you sure you want to delete supplier "${escapeHtml(supplierName || supplierId)}"? This action cannot be undone.`)) {
         console.log(`Attempting to delete supplier: ${supplierId}`);
         try {
             await deleteDoc(doc(db, "suppliers", supplierId));
             console.log("Supplier deleted: ", supplierId);
             alert(`Supplier "${escapeHtml(supplierName || supplierId)}" deleted successfully.`);
             await displaySupplierTable(); // Refresh supplier list
             await displayPoList(); // Refresh PO list as supplier name might change to "Unknown"
         } catch (error) {
             console.error("Error deleting supplier: ", error);
             alert("Error deleting supplier: " + error.message);
         }
     } else {
         console.log("Supplier delete cancelled.");
     }
 }

// --- PO List Functions (Existing - Needs Update for New Filters/Pagination/Sorting) ---

/**
 * Fetches and displays Purchase Orders based on current filters and pagination.
 * TODO: Implement pagination, sorting, batch selection logic.
 */
async function displayPoList() {
    if (!poTableBody || !poLoadingMessage) {
        console.error("PO table body or loading message element not found!");
        return;
    }
     if (!db || !collection || !getDocs || !query || !orderBy || !where || !doc || !getDoc || !Timestamp || !limit) {
        showPoListError("Error: Required Firestore functions are missing for PO list.");
        return;
    }

    showPoListError('');
    poLoadingMessage.style.display = 'table-row';
    poTableBody.innerHTML = ''; // Clear existing PO rows
    if (poTotalsDisplay) poTotalsDisplay.textContent = 'Loading totals...';
    if (poPaginationControls) poPaginationControls.style.display = 'none'; // Hide pagination initially

    // Clear selection when list reloads
    selectedPoIds.clear();
    updateBatchActionBar();
    if (selectAllPoCheckbox) selectAllPoCheckbox.checked = false;


    try {
        // Build Firestore Query based on filters
        let conditions = [];
        let baseQuery = collection(db, "purchaseOrders");

        // Get filter values
        const searchTerm = poSearchInput.value.trim().toLowerCase(); // Search handled client-side for now
        const supplierFilterId = poSupplierFilter.value; // NEW Supplier Filter
        const statusFilter = poStatusFilter.value;
        const startDateVal = poStartDateFilter.value;
        const endDateVal = poEndDateFilter.value;

        // Apply server-side filters
        if (supplierFilterId) {
            conditions.push(where("supplierId", "==", supplierFilterId));
        }
        if (statusFilter) {
            conditions.push(where("status", "==", statusFilter));
        }
        if (startDateVal) {
            try {
                const startDate = Timestamp.fromDate(new Date(startDateVal + 'T00:00:00'));
                conditions.push(where("orderDate", ">=", startDate));
            } catch(e){ console.error("Invalid start date format", e); showPoListError("Invalid Start Date format."); return; }
        }
        if (endDateVal) {
             try {
                const endDate = Timestamp.fromDate(new Date(endDateVal + 'T23:59:59'));
                conditions.push(where("orderDate", "<=", endDate));
            } catch(e){ console.error("Invalid end date format", e); showPoListError("Invalid End Date format."); return; }
        }

        // TODO: Apply Sorting (Needs UI state for current sort column/direction)
        // For now, default sort by creation date descending
        let sortClauses = [orderBy("createdAt", "desc")];

        // TODO: Apply Pagination (Needs state for current page, last visible doc)
        // For now, fetch all matching (or limit to a large number initially)
        // Add limit for initial testing without pagination
        const queryLimit = 100; // Limit initially
        currentPoQuery = query(baseQuery, ...conditions, ...sortClauses, limit(queryLimit));

        // --- Fetch Data ---
        const querySnapshot = await getDocs(currentPoQuery);
        poLoadingMessage.style.display = 'none'; // Hide loading

        let filteredDocs = querySnapshot.docs;
        let grandTotalAmount = 0;
        cachedPOs = {}; // Clear PO cache

        // --- Client-side Search (Simple version on PO Number only for now) ---
        if (searchTerm) {
             console.log(`Filtering client-side for search term: "${searchTerm}"`);
             filteredDocs = filteredDocs.filter(docRef_po => {
                 const po = docRef_po.data();
                 const poNumberMatch = po.poNumber?.toString().toLowerCase().includes(searchTerm);
                 // Add item name search later if needed
                 return poNumberMatch;
             });
             console.log(`Docs after client-side search filter: ${filteredDocs.length}`);
         }
        // --- End Client-side Search ---

        if (filteredDocs.length === 0) {
            poTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 15px;">No purchase orders found matching your criteria.</td></tr>`; // Updated colspan
            if (poTotalsDisplay) poTotalsDisplay.textContent = 'Total PO Value: ₹ 0.00';
            return; // Exit if no documents
        }

        // Process and display rows
        filteredDocs.forEach(docRef_po => {
            const po = docRef_po.data();
            const poId = docRef_po.id;
            cachedPOs[poId] = po; // Cache data

            let supplierName = po.supplierName || suppliersDataCache.find(s => s.id === po.supplierId)?.name || 'Unknown';
            let orderDateStr = formatDate(po.orderDate || po.createdAt);
            let statusText = po.status || 'Unknown';
            let statusClass = statusText.toLowerCase().replace(/\s+/g, '-');
            let paymentStatusText = po.paymentStatus || 'Pending'; // Assuming paymentStatus field exists later
            let paymentStatusClass = paymentStatusText.toLowerCase().replace(/\s+/g, '-');
            let amount = po.totalAmount || 0;
            let amountStr = formatCurrency(amount);
            grandTotalAmount += amount;

            const tr = document.createElement('tr');
            tr.setAttribute('data-id', poId);

            tr.innerHTML = `
                <td style="text-align: center;"><input type="checkbox" class="po-select-checkbox" value="${poId}"></td>
                <td class="po-number-link" title="View PO Details (Not Implemented Yet)">${escapeHtml(po.poNumber || 'N/A')}</td>
                <td>${orderDateStr}</td>
                <td>${escapeHtml(supplierName)}</td>
                <td style="text-align: right;">${amountStr}</td>
                <td><span class="status-badge status-${statusClass}">${escapeHtml(statusText)}</span></td>
                <td><span class="payment-badge payment-${paymentStatusClass}">${escapeHtml(paymentStatusText)}</span></td>
                <td class="action-buttons">
                    ${statusText === 'Sent' || statusText === 'Printing' ? `<button class="button mark-received-btn small-button success-button" data-id="${poId}" title="Mark as Received"><i class="fas fa-check"></i></button>` : ''}
                    <a href="new_po.html?editPOId=${poId}" class="button edit-button small-button" title="Edit PO"><i class="fas fa-edit"></i></a>
                    <button class="button status-button small-button" data-id="${poId}" data-number="${escapeHtml(po.poNumber)}" data-status="${escapeHtml(statusText)}" title="Update Status"><i class="fas fa-sync-alt"></i></button>
                    <button class="button share-button small-button" data-id="${poId}" title="Share PO"><i class="fas fa-share-alt"></i></button>
                    <button class="button pdf-button small-button" data-id="${poId}" title="Generate PDF"><i class="fas fa-file-pdf"></i></button>
                    <button class="button delete-button small-button" data-id="${poId}" data-number="${escapeHtml(po.poNumber)}" title="Delete PO"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
            poTableBody.appendChild(tr);
        });

        if (poTotalsDisplay) {
            poTotalsDisplay.textContent = `Total PO Value (Displayed): ${formatCurrency(grandTotalAmount)}`;
        }

        // TODO: Update Pagination state and controls based on querySnapshot results
        // updatePaginationControls(querySnapshot);


        console.log(`Displayed ${filteredDocs.length} POs.`);

    } catch (error) {
        console.error("Error fetching or displaying POs: ", error);
        showPoListError(`Error loading POs: ${error.message}`);
        if (poTotalsDisplay) poTotalsDisplay.textContent = 'Error loading totals';
    }
}


// --- PO Table Action Handling (Existing + New Buttons) ---
async function handlePOTableActions(event) {
    const actionElement = event.target.closest('button[data-id], a.edit-button');
    const targetCell = event.target.closest('td');

    // Handle click on PO Number (example: open share modal)
    if (targetCell && targetCell.classList.contains('po-number-link')) {
        const row = targetCell.closest('tr');
        const poId = row?.dataset.id;
        if (poId) {
            openPoShareModal(poId); // Reuse existing share modal function
        }
        return; // Stop processing further
    }

    if (!actionElement) return;

    const poId = actionElement.dataset.id;
    const poNumber = actionElement.dataset.number; // Use data-number for PO#

    if (!poId) {
        console.error("PO ID missing from action element");
        return;
    }

    // Handle different action buttons
    if (actionElement.classList.contains('edit-button') && actionElement.tagName === 'A') {
        // Navigation is handled by the href, no JS needed here unless tracking
        console.log(`Navigating to edit PO: ${poId}`);
    } else if (actionElement.classList.contains('status-button')) {
        const currentStatus = actionElement.dataset.status; // Use data-status
        openStatusModal(poId, currentStatus, poNumber); // Reuse existing status modal function
    } else if (actionElement.classList.contains('share-button')) {
        openPoShareModal(poId); // Reuse existing share modal function
    } else if (actionElement.classList.contains('pdf-button')) {
        // Existing PDF generation logic (make sure generatePoPdf is available)
        actionElement.disabled = true;
        actionElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        try {
             let poData = cachedPOs[poId];
             if (!poData) {
                 const poSnap = await getDoc(doc(db, "purchaseOrders", poId));
                 if (poSnap.exists()) poData = poSnap.data();
             }
             if (!poData) throw new Error(`PO data for ${poId} not found`);

             let supplierData = suppliersDataCache.find(s => s.id === poData.supplierId);
              if (!supplierData && poData.supplierId) {
                 const supSnap = await getDoc(doc(db, "suppliers", poData.supplierId));
                 if (supSnap.exists()) supplierData = supSnap.data();
             }
              if (!supplierData) {
                supplierData = { name: poData.supplierName || 'Unknown Supplier' }; // Basic fallback
             }
             // Assuming generatePoPdf exists and works
             if (typeof generatePoPdf === 'function') {
                 await generatePoPdf(poData, supplierData);
             } else {
                 console.error("generatePoPdf function is not defined or imported.");
                 alert("Error: PDF generation function is unavailable.");
             }
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Error generating PDF: " + error.message);
        } finally {
            actionElement.disabled = false;
            actionElement.innerHTML = '<i class="fas fa-file-pdf"></i>';
        }
    } else if (actionElement.classList.contains('delete-button')) {
        handleDeletePO(poId, poNumber); // Reuse existing delete function
    } else if (actionElement.classList.contains('mark-received-btn')) {
        // TODO: Implement markAsReceived function (Step 5)
        markPOAsReceived(poId);
    }
}

// --- Placeholder for PO Receiving Logic (Step 5) ---
async function markPOAsReceived(poId) {
    if (!poId || !db || !doc || !updateDoc || !serverTimestamp) {
        alert("Error: Cannot mark PO as received. Required functions missing.");
        return;
    }
    if (confirm(`Mark PO #${poId.substring(0, 6)}... as 'Product Received'?`)) {
        console.log(`Marking PO ${poId} as received...`);
        // Consider adding loading indicator on the button
        try {
            await updateDoc(doc(db, "purchaseOrders", poId), {
                status: "Product Received",
                receivedDate: serverTimestamp(), // Optionally track received date
                updatedAt: serverTimestamp()
            });
            alert("PO status updated to 'Product Received'.");
            displayPoList(); // Refresh the list
        } catch (error) {
            console.error(`Error marking PO ${poId} as received:`, error);
            alert("Error updating PO status: " + error.message);
        } finally {
            // Remove loading indicator
        }
    }
}


// --- Status Update Modal Functions (Existing - Adapted) ---
function openStatusModal(poId, currentStatus, poNumber) {
    if (!statusUpdateModal || !statusUpdateForm || !statusModalTitle || !statusUpdatePOId || !statusSelect || !currentPOStatusSpan) {
        console.error("Status update modal elements not found!");
        alert("Error: Cannot open status update form.");
        return;
    }
    statusUpdateForm.reset();
    showStatusError('');
    statusModalTitle.textContent = `Update Status for PO #${escapeHtml(poNumber || poId.substring(0, 6))}`;
    statusUpdatePOId.value = poId;
    currentPOStatusSpan.textContent = escapeHtml(currentStatus || 'N/A');
    statusSelect.value = ""; // Reset selection
    // Optionally pre-select the current status if needed, though usually user selects a *new* one
    // statusSelect.value = currentStatus || "";
    statusUpdateModal.classList.add('active');
}

function closeStatusModal() {
    if (statusUpdateModal) {
        statusUpdateModal.classList.remove('active');
    }
}

async function handleStatusUpdate(event) {
    event.preventDefault();
    if (!statusUpdatePOId || !statusSelect || !saveStatusBtn || !db || !doc || !updateDoc || !serverTimestamp) {
        alert("Error: Cannot update status. Required elements or DB functions missing.");
        return;
    }
    const poId = statusUpdatePOId.value;
    const newStatus = statusSelect.value;
    if (!poId || !newStatus) {
        showStatusError("Invalid PO ID or no New Status selected.");
        return;
    }

    saveStatusBtn.disabled = true;
    saveStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    showStatusError('');

    try {
        const poRef = doc(db, "purchaseOrders", poId);
        await updateDoc(poRef, {
            status: newStatus,
            updatedAt: serverTimestamp()
            // Optionally add status change to a history array if needed
        });
        console.log(`PO ${poId} status updated to ${newStatus}`);
        alert(`PO status successfully updated to '${newStatus}'.`);
        closeStatusModal();
        await displayPoList(); // Refresh the PO list

    } catch (error) {
        console.error("Error updating PO status:", error);
        showStatusError("Error updating status: " + error.message);
    } finally {
        if(saveStatusBtn) {
            saveStatusBtn.disabled = false;
            saveStatusBtn.innerHTML = 'Update Status'; // Restore original text
        }
    }
}

// --- Delete PO Function (Existing) ---
async function handleDeletePO(poId, poNumber) {
    if (!db || !doc || !deleteDoc) {
        alert("Error: Required functions missing for deleting PO.");
        return;
    }
    if (confirm(`Are you sure you want to delete Purchase Order "${escapeHtml(poNumber || poId)}"? This cannot be undone.`)) {
        console.log(`Attempting to delete PO: ${poId}`);
        try {
            await deleteDoc(doc(db, "purchaseOrders", poId));
            console.log("Purchase Order deleted successfully:", poId);
            alert(`Purchase Order ${escapeHtml(poNumber || poId)} deleted successfully.`);
            await displayPoList(); // Refresh list after delete
        } catch (error) {
            console.error("Error deleting Purchase Order:", error);
            alert("Error deleting Purchase Order: " + error.message);
        }
    } else {
        console.log("PO deletion cancelled.");
    }
}


// --- PO Details & Share Modal Functions (Existing - Minor adaptations might be needed) ---
// Assuming openPoDetailsModal, closePoDetailsModal, openPoShareModal, closePoShareModalFunction, handleCopyPoShareContent
// are defined largely as they were in the original v20 file.
// Minor update: Ensure they use the correct modal element IDs from the updated HTML if changed.
// We will also add the email functionality to openPoShareModal/handleEmailPoShare later.

// Placeholder - Ensure these exist or copy from original v20 file
async function openPoDetailsModal(poId) { /* ... Existing logic ... */ console.log("openPoDetailsModal called for", poId); alert("PO Details Modal functionality needs implementation/verification."); }
function closePoDetailsModal() { if (poDetailsModal) { poDetailsModal.classList.remove('active'); } }
async function openPoShareModal(poId) { /* ... Existing logic ... */ console.log("openPoShareModal called for", poId); alert("PO Share Modal functionality needs implementation/verification."); }
function closePoShareModalFunction() { if (poShareModal) { poShareModal.classList.remove('active'); } }
async function handleCopyPoShareContent(event) { /* ... Existing logic ... */ alert("Copy PO Content functionality needs implementation/verification."); }
// --- NEW: Email PO Share Logic Placeholder ---
function handleEmailPoShare(event) {
    const poId = event.currentTarget.dataset.poid; // Assuming button has data-poid
     if (!poId) {
         alert("Error: PO ID not found for emailing.");
         return;
     }
     console.log(`Emailing PO ${poId}... (Needs implementation)`);
     alert(`Email functionality for PO ${poId} needs to be implemented (e.g., using mailto:).`);
     // TODO: Implement mailto link generation
     // 1. Fetch PO data (poData) and supplier data (supplierData) if not cached
     // 2. Construct subject line (e.g., "Purchase Order #123 from YourCompany")
     // 3. Construct email body (Greeting, link to PO or summary, terms)
     // 4. Encode subject and body using encodeURIComponent()
     // 5. Construct mailto link: `mailto:${supplierEmail}?subject=${encodedSubject}&body=${encodedBody}`
     // 6. Set window.location.href = mailtoLink;
}

// --- Page Initialization ---

/**
 * Main initialization function called after Firebase Auth is confirmed.
 */
async function initializeSupplierManagementPage(user) {
    console.log("Initializing Supplier Management Page...");
    setupEventListeners(); // Setup all event listeners

    // Load initial data
    try {
        await displaySupplierTable(); // Load suppliers first (populates filter)
        await displayPoList();      // Then load POs (can use populated filter)
    } catch (error) {
        console.error("Error during initial data load:", error);
        // Errors shown by individual display functions
    }
     console.log("Supplier Management Page Initialized.");
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    console.log("Setting up event listeners...");

    // Supplier List Actions
    if (supplierTableBody) {
        supplierTableBody.addEventListener('click', handleSupplierTableActions);
    } else { console.error("Supplier table body not found for event listener."); }

    // Supplier Modal
    if (addNewSupplierBtn) addNewSupplierBtn.addEventListener('click', () => openSupplierModal('add'));
    if (closeSupplierModalBtn) closeSupplierModalBtn.addEventListener('click', closeSupplierModal);
    if (cancelSupplierBtn) cancelSupplierBtn.addEventListener('click', closeSupplierModal);
    if (supplierForm) supplierForm.addEventListener('submit', saveSupplier);
    if (supplierModal) supplierModal.addEventListener('click', (event) => { if (event.target === supplierModal) closeSupplierModal(); });

    // PO Filters
    if (poFilterBtn) poFilterBtn.addEventListener('click', displayPoList);
    if (poClearFilterBtn) {
        poClearFilterBtn.addEventListener('click', () => {
            if(poSearchInput) poSearchInput.value = '';
            if(poSupplierFilter) poSupplierFilter.value = ''; // Reset new filter
            if(poStatusFilter) poStatusFilter.value = '';
            if(poStartDateFilter) poStartDateFilter.value = '';
            if(poEndDateFilter) poEndDateFilter.value = '';
            // Reset pagination and sorting if implemented
            poPagination.currentPage = 1;
            poPagination.lastVisibleDoc = null;
            // TODO: Reset sorting state variables
            displayPoList();
        });
    }
     // Add listener for new supplier filter to trigger reload
    if (poSupplierFilter) {
        poSupplierFilter.addEventListener('change', displayPoList);
    }

    // PO Table Actions (using event delegation)
    if (poTableBody) {
        poTableBody.addEventListener('click', handlePOTableActions);
    } else { console.error("PO table body not found for event listener."); }


    // PO Batch Actions (Placeholder - Step 5)
    // TODO: Add listeners for selectAllPoCheckbox, po-select-checkbox, batch action buttons


    // Status Update Modal
    if (closeStatusModalBtn) closeStatusModalBtn.addEventListener('click', closeStatusModal);
    if (cancelStatusBtn) cancelStatusBtn.addEventListener('click', closeStatusModal); // Use renamed ID
    if (statusUpdateForm) statusUpdateForm.addEventListener('submit', handleStatusUpdate);
    if (statusUpdateModal) statusUpdateModal.addEventListener('click', (event) => { if (event.target === statusUpdateModal) closeStatusModal(); });

    // PO Details Modal
    if (closePoDetailsModalBtn) closePoDetailsModalBtn.addEventListener('click', closePoDetailsModal);
    if (closePoDetailsBtn) closePoDetailsBtn.addEventListener('click', closePoDetailsModal); // Ensure this ID is correct in HTML
    if (poDetailsModal) poDetailsModal.addEventListener('click', (event) => { if (event.target === poDetailsModal) closePoDetailsModal(); });
    if (printPoDetailsBtn) {
        printPoDetailsBtn.addEventListener('click', () => { /* Print logic from original file */ });
    }

    // PO Share Modal
    if (closePoShareModal) closePoShareModal.addEventListener('click', closePoShareModalFunction);
    if (closePoShareModalBtn) closePoShareModalBtn.addEventListener('click', closePoShareModalFunction);
    if (poShareModal) poShareModal.addEventListener('click', (event) => { if (event.target === poShareModal) closePoShareModalFunction(); });
    if (printPoShareModalBtn) {
        printPoShareModalBtn.addEventListener('click', () => { /* Print logic from original file */ });
    }
     if (emailPoShareModalBtn) { // Listener for new Email button
         emailPoShareModalBtn.addEventListener('click', handleEmailPoShare);
     }
    // Note: Removed copy button listener, add back if needed

    // CSV Export Button (Placeholder - Step 5)
    if (exportPoCsvBtn) {
        exportPoCsvBtn.addEventListener('click', () => {
            // TODO: Implement exportPoListToCsv function
            alert("CSV Export functionality needs implementation.");
        });
    }

    // Pagination Listeners (Placeholder - Step 2/5)
    // TODO: Add listeners for prevPageBtn, nextPageBtn, itemsPerPageSelect

    console.log("Event listeners setup complete.");
}


// Make the initialization function globally accessible to be called from the HTML auth check
window.initializeSupplierManagementPage = initializeSupplierManagementPage;

console.log("supplier_management.js v21 (Step 2: Display Supplier List) loaded.");