// js/supplier_management.js - v23+Fixes (आपकी मूल v23 फाइल + डिलीट रिफ्रेश और एडिट एरर हैंडलिंग)

// --- Imports ---
// import { generatePoPdf } from './utils.js'; // यदि आवश्यक हो तो उपयोग करें
import { db, auth } from './firebase-init.js';
import {
    collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc,
    query, orderBy, where, Timestamp, serverTimestamp, limit, onSnapshot, // limit, onSnapshot आवश्यक हो सकता है
    startAfter, endBefore, limitToLast // pagination के लिए
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// आपके utils.js से आवश्यक फंक्शन्स आयात करें, यदि हों
// import { formatTimestamp, displayPopup, showLoadingIndicator, hideLoadingIndicator } from './utils.js';

// --- DOM Elements ---
// (आपके द्वारा अपलोड की गई v23 फ़ाइल के अनुसार सभी DOM एलिमेंट्स)
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
const supplierModal = document.getElementById('supplierModal');
const supplierModalTitle = document.getElementById('supplierModalTitle');
const closeSupplierModalBtn = document.getElementById('closeSupplierModal');
const cancelSupplierBtn = document.getElementById('cancelSupplierBtn');
const saveSupplierBtn = document.getElementById('saveSupplierBtn');
const supplierForm = document.getElementById('supplierForm');
const editSupplierIdInput = document.getElementById('editSupplierId');
const supplierNameInput = document.getElementById('supplierNameInput');
const supplierCompanyInput = document.getElementById('supplierCompanyInput');
const supplierWhatsappInput = document.getElementById('supplierWhatsappInput');
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
const statusSelect = document.getElementById('statusSelect');
const statusErrorMsg = document.getElementById('statusErrorMsg');
const poDetailsModal = document.getElementById('poDetailsModal');
const poDetailsModalTitle = document.getElementById('poDetailsModalTitle');
const closePoDetailsModalBtn = document.getElementById('closePoDetailsModal');
const closePoDetailsBtn = document.getElementById('closePoDetailsModalBottomBtn'); // Assuming this ID exists
const poDetailsContent = document.getElementById('poDetailsContent');
const printPoDetailsBtn = document.getElementById('printPoDetailsBtn');
const poShareModal = document.getElementById('poShareModal');
const poShareModalTitle = document.getElementById('poShareModalTitle');
const closePoShareModal = document.getElementById('closePoShareModalTopBtn'); // Assuming this ID exists
const closePoShareModalBtn = document.getElementById('closePoShareModalBtn');
const printPoShareModalBtn = document.getElementById('printPoShareModalBtn');
const emailPoShareModalBtn = document.getElementById('emailPoShareModalBtn');
const exportPoCsvBtn = document.getElementById('exportPoCsvBtn');
// Add any missing DOM elements if needed from your HTML

// --- Global State ---
// (v23 के अनुसार ग्लोबल वेरिएबल्स)
let currentEditingSupplierId = null;
let suppliersDataCache = []; // सप्लायर डेटा को कैश करें
let cachedPOs = {}; // लोड किए गए PO को कैश करें
let currentPoQuery = null;
let poQueryUnsubscribe = null;
let poPagination = { currentPage: 1, itemsPerPage: 25, lastVisibleDoc: null, firstVisibleDoc: null, totalItems: 0, hasNextPage: false, hasPrevPage: false };
let selectedPoIds = new Set();
let currentPoSortField = 'createdAt'; // Default sort field
let currentPoSortDirection = 'desc'; // Default sort direction

// --- Utility Functions ---
// (v23 के अनुसार Helper फंक्शन्स)
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { try { unsafe = String(unsafe ?? ''); } catch (e) { unsafe = ''; } } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function formatCurrency(amount) { const num = Number(amount); if (isNaN(num)) return 'N/A'; return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatDate(timestamp) { if (!timestamp || typeof timestamp.toDate !== 'function') return '-'; try { return timestamp.toDate().toLocaleDateString('en-GB'); } catch (e) { console.error("Error formatting date:", e); return '-'; } }

// --- Error Display Functions ---
// (v23 के अनुसार एरर दिखाने वाले फंक्शन्स)
function showSupplierListError(message) { if(supplierListError) { supplierListError.textContent = message; supplierListError.style.display = message ? 'block' : 'none'; } if(supplierLoadingMessage) supplierLoadingMessage.style.display = 'none'; if(supplierTableBody) supplierTableBody.innerHTML = ''; }
function showPoListError(message) { if(poListError) { poListError.textContent = message; poListError.style.display = message ? 'block' : 'none'; } if(poLoadingMessage) poLoadingMessage.style.display = 'none'; if(poTableBody) poTableBody.innerHTML = ''; }
function showSupplierFormError(message) { if(supplierFormError) { supplierFormError.textContent = message; supplierFormError.style.display = message ? 'block' : 'none'; } }
function showStatusError(message) { if(statusErrorMsg) { statusErrorMsg.textContent = message; statusErrorMsg.style.display = message ? 'block' : 'none'; } }
function displayGlobalError(message) { console.error("Global Error:", message); const errorDiv = document.getElementById('globalErrorDisplay'); if (errorDiv) { errorDiv.textContent = message; errorDiv.style.display = 'block'; } else { alert(`Error: ${message}`); } }
function displaySuccessMessage(message) { console.log("Success:", message); const successDiv = document.getElementById('globalSuccessDisplay'); if (successDiv) { successDiv.textContent = message; successDiv.style.display = 'block'; setTimeout(() => { successDiv.style.display = 'none'; }, 3000); } }

// --- Supplier List Functions ---
// (v23 के अनुसार सप्लायर लिस्ट फंक्शन्स)
async function loadSuppliers() { // Renamed from displaySupplierTable for clarity
    if (!supplierTableBody || !supplierLoadingMessage) { console.error("Supplier table elements missing"); return; }
    if (!db) { showSupplierListError("Error: Database connection failed."); return; }
    showSupplierListError('');
    supplierLoadingMessage.style.display = 'table-row';
    supplierTableBody.innerHTML = ''; // Clear previous rows
    suppliersDataCache = []; // Clear cache

    try {
        const q = query(collection(db, "suppliers"), orderBy("name")); // Order by name
        const querySnapshot = await getDocs(q);
        supplierLoadingMessage.style.display = 'none';

        if (querySnapshot.empty) {
            supplierTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 15px;">No suppliers found.</td></tr>';
        } else {
            querySnapshot.forEach((docSnapshot) => {
                const supplier = { id: docSnapshot.id, ...docSnapshot.data() };
                suppliersDataCache.push(supplier); // Populate cache
                const tr = document.createElement('tr');
                tr.setAttribute('data-id', supplier.id);
                const name = escapeHtml(supplier.name || 'N/A');
                // Use contactNo from your form if whatsappNo is not primary
                const contact = escapeHtml(supplier.contactNo || supplier.whatsappNo || '-');
                const balancePlaceholder = `<span class="balance-loading" style="font-style: italic; color: #999;">Calculating...</span>`; // Placeholder for balance

                // Action Buttons - ensure class names match CSS/HTML and event handler
                tr.innerHTML = `
                    <td>${name}</td>
                    <td>${contact}</td>
                    <td class="supplier-balance-cell">${balancePlaceholder}</td>
                    <td class="action-buttons">
                        <button class="button view-account-button small-button" data-id="${supplier.id}" title="View Account Details"><i class="fas fa-eye"></i></button>
                        <button class="button edit-button small-button" data-id="${supplier.id}" title="Edit Supplier"><i class="fas fa-edit"></i></button>
                        <button class="button delete-button small-button" data-id="${supplier.id}" data-name="${escapeHtml(supplier.name || '')}" title="Delete Supplier"><i class="fas fa-trash-alt"></i></button>
                    </td>`;
                supplierTableBody.appendChild(tr);
            });
            populateSupplierFilterDropdown(); // Update PO filter dropdown
        }
        console.log(`Displayed ${querySnapshot.size} suppliers.`);
    } catch (error) {
        console.error("Error fetching suppliers: ", error);
        showSupplierListError(`Error loading suppliers: ${error.message}`);
        populateSupplierFilterDropdown(); // Populate even on error
    }
}

function populateSupplierFilterDropdown() {
    if (!poSupplierFilter) return;
    const selectedVal = poSupplierFilter.value;
    poSupplierFilter.innerHTML = '<option value="">All Suppliers</option>';
    // Sort suppliers from cache for dropdown
    const sortedSuppliers = [...suppliersDataCache].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    sortedSuppliers.forEach(supplier => {
        const option = document.createElement('option');
        option.value = supplier.id;
        option.textContent = escapeHtml(supplier.name || supplier.id);
        poSupplierFilter.appendChild(option);
    });
    // Restore previous selection if possible
    if (poSupplierFilter.querySelector(`option[value="${selectedVal}"]`)) {
        poSupplierFilter.value = selectedVal;
    } else {
        poSupplierFilter.value = ""; // Default to "All" if previous selection not found
    }
    console.log("Supplier filter dropdown populated.");
}

// --- Supplier Modal/CRUD Functions ---
function openSupplierModal(mode = 'add', supplierData = null, supplierId = null) {
    if (!supplierModal) { console.error("Supplier modal not found"); return; }
    showSupplierFormError(''); // Clear previous errors
    currentEditingSupplierId = null; // Reset editing ID

    if (mode === 'edit' && supplierData && supplierId) {
        supplierModalTitle.textContent = 'Edit Supplier';
        editSupplierIdInput.value = supplierId; // Set hidden input value
        supplierNameInput.value = supplierData.name || '';
        supplierCompanyInput.value = supplierData.company || ''; // Use 'company' if that's the field name
        supplierWhatsappInput.value = supplierData.whatsappNo || '';
        supplierContactInput.value = supplierData.contactNo || ''; // Populate Contact No
        supplierEmailInput.value = supplierData.email || '';
        supplierAddressInput.value = supplierData.address || '';
        supplierGstInput.value = supplierData.gstNo || '';
        currentEditingSupplierId = supplierId; // Set current editing ID
    } else {
        supplierModalTitle.textContent = 'Add New Supplier';
        supplierForm.reset(); // Clear the form for adding
        editSupplierIdInput.value = ''; // Ensure hidden ID is empty
    }
    supplierModal.style.display = 'flex'; // Show the modal
    supplierModal.classList.add('active'); // Use class for visibility if preferred
}

function closeSupplierModal() {
    if (supplierModal) {
        supplierModal.style.display = 'none';
        supplierModal.classList.remove('active');
        supplierForm.reset(); // Clear form on close
        showSupplierFormError(''); // Clear errors on close
        currentEditingSupplierId = null; // Reset editing ID
    }
}

async function saveSupplier(event) {
    event.preventDefault();
    if (!db || !addDoc || !updateDoc || !doc || !serverTimestamp || !collection) {
        showSupplierFormError("Database functions not available.");
        return;
    }
    showSupplierFormError(''); // Clear previous errors
    saveSupplierBtn.disabled = true;
    saveSupplierBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    // Collect data from form, use correct IDs from your HTML
    const supplierPayload = {
        name: supplierNameInput.value.trim(),
        company: supplierCompanyInput.value.trim(), // Assuming 'company' field
        whatsappNo: supplierWhatsappInput.value.trim(),
        contactNo: supplierContactInput.value.trim(), // Get Contact No
        email: supplierEmailInput.value.trim().toLowerCase(),
        address: supplierAddressInput.value.trim(),
        gstNo: supplierGstInput.value.trim().toUpperCase(),
        // Add name_lowercase for case-insensitive sorting/searching if needed
        name_lowercase: supplierNameInput.value.trim().toLowerCase()
    };

    // Basic Validation
    if (!supplierPayload.name) {
        showSupplierFormError("Supplier Name is required.");
        saveSupplierBtn.disabled = false;
        saveSupplierBtn.innerHTML = 'Save Supplier';
        return;
    }

    try {
        if (currentEditingSupplierId) {
            // Update existing supplier
            supplierPayload.updatedAt = serverTimestamp();
            const supplierRef = doc(db, "suppliers", currentEditingSupplierId);
            await updateDoc(supplierRef, supplierPayload);
            console.log("Supplier updated:", currentEditingSupplierId);
            displaySuccessMessage(`Supplier "${supplierPayload.name}" updated successfully.`);
        } else {
            // Add new supplier
            supplierPayload.createdAt = serverTimestamp();
            const docRef = await addDoc(collection(db, "suppliers"), supplierPayload);
            console.log("Supplier added with ID:", docRef.id);
            displaySuccessMessage(`Supplier "${supplierPayload.name}" added successfully.`);
        }
        closeSupplierModal();
        await loadSuppliers(); // Refresh the supplier list
    } catch (error) {
        console.error("Error saving supplier:", error);
        showSupplierFormError(`Error: ${error.message}`);
    } finally {
        saveSupplierBtn.disabled = false;
        saveSupplierBtn.innerHTML = currentEditingSupplierId ? 'Update Supplier' : 'Save Supplier';
    }
}

async function deleteSupplier(supplierId, supplierName) {
    if (!supplierId) { console.error("Missing supplier ID for deletion."); return; }
    if (!db || !doc || !deleteDoc) { displayGlobalError("Database functions unavailable."); return; }

    if (window.confirm(`Are you sure you want to delete supplier "${escapeHtml(supplierName)}"? This cannot be undone.`)) {
        try {
            // TODO: Check for associated POs or Payments before deleting if needed
            // Example: const poCheckQuery = query(collection(db, "purchaseOrders"), where("supplierId", "==", supplierId), limit(1));
            // const poCheckSnap = await getDocs(poCheckQuery);
            // if (!poCheckSnap.empty) { throw new Error("Cannot delete supplier with existing Purchase Orders."); }

            await deleteDoc(doc(db, "suppliers", supplierId));
            console.log(`Supplier ${supplierId} deleted successfully.`);
            displaySuccessMessage(`Supplier "${escapeHtml(supplierName)}" deleted.`);
            await loadSuppliers(); // *** पहले यहाँ रिफ्रेश कॉल नहीं था, अब जोड़ दिया गया है ***
        } catch (error) {
            console.error("Error deleting supplier:", error);
            displayGlobalError(`Failed to delete supplier: ${error.message}`);
        }
    }
}

// --- handleSupplierTableActions ---
// Uses event delegation on the supplier table body
function handleSupplierTableActions(event) {
    const targetButton = event.target.closest('button.small-button[data-id]'); // Target specific buttons
    if (!targetButton) return; // Exit if click wasn't on a relevant button

    const supplierId = targetButton.dataset.id;
    if (!supplierId) {
        console.error("Action button clicked, but Supplier ID missing.");
        return;
    }

    console.log(`Supplier Action: ${targetButton.title}, ID: ${supplierId}`);

    if (targetButton.classList.contains('view-account-button')) {
        // Navigate to detail page - ensure the URL parameter matches what detail page expects ('id' vs 'supplierId')
        window.location.href = `supplier_account_detail.html?id=${supplierId}`;
    } else if (targetButton.classList.contains('edit-button')) {
        // Fetch data and open modal for editing
        handleEditSupplierClick(supplierId); // Call dedicated handler
    } else if (targetButton.classList.contains('delete-button')) {
        const supplierName = targetButton.dataset.name || `ID: ${supplierId}`;
        deleteSupplier(supplierId, supplierName); // Call the delete function
    }
}

// --- handleEditSupplierClick ---
// Fetches supplier data before opening the modal
async function handleEditSupplierClick(supplierId) {
    console.log(`Attempting to fetch supplier ${supplierId} for edit.`);
    if (!db || !doc || !getDoc) { displayGlobalError("Database functions unavailable."); return; }

    const supplierRef = doc(db, "suppliers", supplierId);
    try { // *** एरर हैंडलिंग के लिए try...catch जोड़ा गया ***
        const docSnap = await getDoc(supplierRef);
        if (docSnap.exists()) {
            const supplierData = { id: docSnap.id, ...docSnap.data() };
            openSupplierModal('edit', supplierData, supplierId); // Pass fetched data to modal
        } else {
            console.error(`Supplier document not found for ID: ${supplierId}`);
            displayGlobalError("Supplier details not found. It might have been deleted.");
        }
    } catch (error) { // *** एरर को पकड़ें और लॉग करें ***
        console.error(`Error fetching supplier ${supplierId} for edit:`, error);
        displayGlobalError(`Failed to load supplier details for editing. Error: ${error.message}`);
    }
}


// --- PO List Functions ---
// (v23 के अनुसार PO लिस्ट फंक्शन)
async function displayPoList() {
     if (!poTableBody || !poLoadingMessage) { console.error("PO table elements missing."); return; }
     if (!db) { showPoListError("Database connection error."); return; }
     showPoListError('');
     poLoadingMessage.style.display = 'table-row';
     poTableBody.innerHTML = ''; // Clear table
     if (poTotalsDisplay) poTotalsDisplay.textContent = 'Calculating totals...';
     if (poPaginationControls) poPaginationControls.style.display = 'none';
     selectedPoIds.clear(); // Clear selections
     updateBatchActionBar();
     if (selectAllPoCheckbox) selectAllPoCheckbox.checked = false;

     try {
         let conditions = [];
         const searchTerm = poSearchInput.value.trim().toLowerCase();
         const supplierId = poSupplierFilter.value;
         const status = poStatusFilter.value;
         const startDateStr = poStartDateFilter.value;
         const endDateStr = poEndDateFilter.value;

         // Build Firestore query conditions
         if (supplierId) conditions.push(where("supplierId", "==", supplierId));
         if (status) conditions.push(where("status", "==", status));
         if (startDateStr) {
             try { conditions.push(where("orderDate", ">=", Timestamp.fromDate(new Date(startDateStr + 'T00:00:00')))); }
             catch(e) { console.warn("Invalid start date format"); }
         }
         if (endDateStr) {
             try { conditions.push(where("orderDate", "<=", Timestamp.fromDate(new Date(endDateStr + 'T23:59:59')))); }
             catch(e) { console.warn("Invalid end date format"); }
         }

         // Define sorting - use mapping for flexibility
         const sortFieldMapping = {
             poNumber: 'poNumber', orderDate: 'orderDate', supplierName: 'supplierName',
             totalAmount: 'totalAmount', status: 'status', paymentStatus: 'paymentStatus',
             createdAt: 'createdAt' // Default/fallback
         };
         const firestoreSortField = sortFieldMapping[currentPoSortField] || 'createdAt';
         const firestoreSortDirection = currentPoSortDirection || 'desc';

         let sortClauses = [orderBy(firestoreSortField, firestoreSortDirection)];
         // Add secondary sort for consistency if not sorting by a unique field like createdAt
         if (firestoreSortField !== 'createdAt') {
             sortClauses.push(orderBy('createdAt', 'desc'));
         }

         // Construct the final query
         const baseQuery = collection(db, "purchaseOrders");
         // Apply conditions and sorting (add pagination later)
         // For now, limit the results initially
         const queryLimit = 50; // Increase limit slightly
         currentPoQuery = query(baseQuery, ...conditions, ...sortClauses, limit(queryLimit));


         // --- Fetch and Render ---
         const querySnapshot = await getDocs(currentPoQuery);
         poLoadingMessage.style.display = 'none';
         let filteredDocs = querySnapshot.docs; // Start with fetched docs
         let grandTotalAmount = 0;
         cachedPOs = {}; // Clear PO cache

         // Apply client-side search if necessary (Firestore doesn't support partial text search well)
         if (searchTerm) {
             filteredDocs = filteredDocs.filter(docRef => {
                 const po = docRef.data();
                 // Search in PO number and potentially item names (if available)
                 const poNumMatch = po.poNumber?.toString().toLowerCase().includes(searchTerm);
                 // Add item search logic here if po.items exists and is searchable
                 // const itemMatch = po.items?.some(item => item.name?.toLowerCase().includes(searchTerm));
                 return poNumMatch; // || itemMatch;
             });
         }

         if (filteredDocs.length === 0) {
             poTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 15px;">No purchase orders found matching filters.</td></tr>`;
             if (poTotalsDisplay) poTotalsDisplay.textContent = 'Total PO Value: ₹ 0.00';
             return;
         }

         // --- Render Rows ---
         filteredDocs.forEach(docRef => {
             const po = docRef.data();
             const poId = docRef.id;
             cachedPOs[poId] = po; // Cache the PO data

             // Get supplier name from cache or use stored name
             let supplierName = suppliersDataCache.find(s => s.id === po.supplierId)?.name || po.supplierName || 'Unknown Supplier';
             let orderDateStr = formatDate(po.orderDate || po.createdAt);
             let statusText = po.status || 'Unknown';
             let statusClass = statusText.toLowerCase().replace(/\s+/g, '-').replace('.', ''); // Sanitize class
             let paymentStatusText = po.paymentStatus || 'Pending';
             let paymentStatusClass = paymentStatusText.toLowerCase().replace(/\s+/g, '-').replace('.', ''); // Sanitize class
             let amount = po.totalAmount || 0;
             let amountStr = formatCurrency(amount);
             grandTotalAmount += amount; // Add to total

             const tr = document.createElement('tr');
             tr.setAttribute('data-id', poId);

             // Ensure this HTML structure matches your thead columns exactly
             tr.innerHTML = `
                 <td style="text-align: center;"><input type="checkbox" class="po-select-checkbox" value="${poId}"></td>
                 <td class="po-number-link" title="View PO Details">${escapeHtml(po.poNumber || 'N/A')}</td>
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
                 </td>`;
             poTableBody.appendChild(tr);
         });

         // Update totals display
         if (poTotalsDisplay) poTotalsDisplay.textContent = `Total PO Value (Displayed): ${formatCurrency(grandTotalAmount)}`;

         // Update pagination (Simplified for now, full implementation later)
         // updatePaginationControls(querySnapshot); // Call pagination logic here

         console.log(`Displayed ${filteredDocs.length} POs.`);

     } catch (error) {
         console.error("Error fetching/displaying POs: ", error);
         // Handle specific errors like missing indexes
         if (error.code === 'failed-precondition') {
             showPoListError(`Error: Database index missing. Please check Firestore console for index creation recommendations. Details: ${error.message}`);
         } else {
             showPoListError(`Error loading POs: ${error.message}`);
         }
         if (poTotalsDisplay) poTotalsDisplay.textContent = 'Error loading totals';
     }
 }

// --- PO Table Sorting Logic ---
// (v23 के अनुसार सॉर्टिंग लॉजिक)
function handlePoSort(event) { const header = event.target.closest('th[data-sortable="true"]'); if (!header) return; const sortKey = header.dataset.sortKey; if (!sortKey) return; let newDirection; if (currentPoSortField === sortKey) { newDirection = currentPoSortDirection === 'asc' ? 'desc' : 'asc'; } else { newDirection = 'asc'; } currentPoSortField = sortKey; currentPoSortDirection = newDirection; console.log(`Sorting POs by: ${currentPoSortField}, Dir: ${currentPoSortDirection}`); updateSortIndicators(); displayPoList(); }
function updateSortIndicators() { if (!poTableHeader) return; poTableHeader.querySelectorAll('th[data-sortable="true"]').forEach(th => { th.classList.remove('sort-asc', 'sort-desc'); th.querySelector('.sort-indicator')?.remove(); if (th.dataset.sortKey === currentPoSortField) { const indicator = document.createElement('span'); indicator.classList.add('sort-indicator'); if (currentPoSortDirection === 'asc') { th.classList.add('sort-asc'); indicator.innerHTML = ' &uarr;'; } else { th.classList.add('sort-desc'); indicator.innerHTML = ' &darr;'; } th.appendChild(indicator); } }); }

// --- PO Table Action Handling ---
// (v23 के अनुसार एक्शन हैंडलिंग)
async function handlePOTableActions(event) {
    const actionElement = event.target.closest('button[data-id], a.edit-button');
    const targetCell = event.target.closest('td');

    if (targetCell && targetCell.classList.contains('po-number-link')) {
        const row = targetCell.closest('tr'); const poId = row?.dataset.id; if (poId) { openPoShareModal(poId); } return;
    }
    if (!actionElement) return;
    const poId = actionElement.dataset.id; const poNumber = actionElement.dataset.number; if (!poId) { console.error("PO ID missing"); return; }

    if (actionElement.classList.contains('edit-button') && actionElement.tagName === 'A') { console.log(`Navigating to edit PO: ${poId}`); /* No action needed here, link handles it */ }
    else if (actionElement.classList.contains('status-button')) { const currentStatus = actionElement.dataset.status; openStatusModal(poId, currentStatus, poNumber); }
    else if (actionElement.classList.contains('share-button')) { openPoShareModal(poId); }
    else if (actionElement.classList.contains('pdf-button')) {
         actionElement.disabled = true; actionElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        try {
             let poData = cachedPOs[poId]; if (!poData) { const poSnap = await getDoc(doc(db, "purchaseOrders", poId)); if (poSnap.exists()) poData = poSnap.data(); } if (!poData) throw new Error(`PO data not found for ${poId}`);
             let supplierData = suppliersDataCache.find(s => s.id === poData.supplierId); if (!supplierData && poData.supplierId) { const supSnap = await getDoc(doc(db, "suppliers", poData.supplierId)); if (supSnap.exists()) supplierData = {id: supSnap.id, ...supSnap.data()}; } if (!supplierData) { supplierData = { name: poData.supplierName || 'Unknown' }; }
             // Ensure generatePoPdf is defined and imported/available
             if (typeof generatePoPdf === 'function') {
                 await generatePoPdf(poData, supplierData);
             } else {
                 console.error("generatePoPdf function is not defined.");
                 alert("PDF generation function is currently unavailable.");
             }
        } catch (error) { console.error("Error generating PDF:", error); alert("Error generating PDF: " + error.message); }
        finally { actionElement.disabled = false; actionElement.innerHTML = '<i class="fas fa-file-pdf"></i>'; }
     }
    else if (actionElement.classList.contains('delete-button')) { handleDeletePO(poId, poNumber); }
    else if (actionElement.classList.contains('mark-received-btn')) { markPOAsReceived(poId); }
}

// --- PO Receiving Logic ---
// (v23 के अनुसार फंक्शन)
async function markPOAsReceived(poId) { if (!poId || !db) { alert("Error: Cannot mark PO as received."); return; } if (confirm(`Mark PO #${poId.substring(0, 6)}... as 'Product Received'?`)) { try { await updateDoc(doc(db, "purchaseOrders", poId), { status: "Product Received", receivedDate: serverTimestamp(), updatedAt: serverTimestamp() }); alert("PO status updated to Product Received."); displayPoList(); } catch (error) { console.error(`Error marking PO ${poId} received:`, error); alert("Error updating PO status: " + error.message); } } }

// --- Status Update Modal Functions ---
// (v23 के अनुसार फंक्शन्स)
function openStatusModal(poId, currentStatus, poNumber) { if (!statusUpdateModal) return; statusUpdatePOId.value = poId; statusModalTitle.textContent = `Update Status for PO #${escapeHtml(poNumber || poId.substring(0,6))}`; currentPOStatusSpan.textContent = escapeHtml(currentStatus || 'N/A'); statusSelect.value = currentStatus || ''; showStatusError(''); statusUpdateModal.style.display = 'flex'; statusUpdateModal.classList.add('active'); }
function closeStatusModal() { if (statusUpdateModal) { statusUpdateModal.style.display = 'none'; statusUpdateModal.classList.remove('active'); } }
async function handleStatusUpdate(event) { event.preventDefault(); if (!db) { showStatusError("Database not connected."); return; } const poId = statusUpdatePOId.value; const newStatus = statusSelect.value; if (!poId || !newStatus) { showStatusError("Missing PO ID or new status."); return; } saveStatusBtn.disabled = true; saveStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; showStatusError(''); try { await updateDoc(doc(db, "purchaseOrders", poId), { status: newStatus, updatedAt: serverTimestamp() }); console.log(`PO ${poId} status updated to ${newStatus}`); displaySuccessMessage(`PO status updated to ${newStatus}.`); closeStatusModal(); await displayPoList(); // Refresh list } catch (error) { console.error(`Error updating status for PO ${poId}:`, error); showStatusError(`Error: ${error.message}`); } finally { saveStatusBtn.disabled = false; saveStatusBtn.innerHTML = 'Update Status'; } }

// --- Delete PO Function ---
// (v23 के अनुसार फंक्शन)
async function handleDeletePO(poId, poNumber) { if (!poId || !db) { displayGlobalError("Cannot delete PO. Error."); return; } if (window.confirm(`Are you sure you want to delete PO #${escapeHtml(poNumber || poId.substring(0,6))}? This cannot be undone.`)) { try { await deleteDoc(doc(db, "purchaseOrders", poId)); console.log(`PO ${poId} deleted.`); displaySuccessMessage(`PO #${escapeHtml(poNumber || poId.substring(0,6))} deleted.`); await displayPoList(); // Refresh list } catch (error) { console.error(`Error deleting PO ${poId}:`, error); displayGlobalError(`Failed to delete PO: ${error.message}`); } } }


// --- PO Details & Share Modal Functions ---
// (प्लेसहोल्डर या आपके मूल फंक्शन)
async function openPoDetailsModal(poId) { console.log("openPoDetailsModal called for", poId); alert("PO Details Modal - Implementation needed."); }
function closePoDetailsModal() { if(poDetailsModal) poDetailsModal.style.display = 'none'; }
async function openPoShareModal(poId) { console.log("openPoShareModal called for", poId); alert("PO Share Modal - Implementation needed."); }
function closePoShareModalFunction() { if(poShareModal) poShareModal.style.display = 'none'; }
function handleEmailPoShare(event) { console.log("Email PO called"); alert("Email PO - Implementation needed."); }

// --- Batch Action Bar Update ---
// (v23 के अनुसार फंक्शन)
function updateBatchActionBar() { const count = selectedPoIds.size; if (count > 0) { poSelectedCount.textContent = `${count} PO${count > 1 ? 's' : ''} selected`; poBatchActionsBar.style.display = 'flex'; batchApplyStatusBtn.disabled = !batchUpdateStatusSelect.value; } else { poBatchActionsBar.style.display = 'none'; } }


// --- Page Initialization & Event Listeners Setup ---
async function initializeSupplierManagementPage(user) {
    console.log("Initializing Supplier Management Page v23+Fixes...");
    if (window.supplierManagementPageInitialized) { console.log("Already initialized."); return; }
    setupEventListeners(); // Setup listeners
    updateSortIndicators(); // Set initial sort indicators
    try {
        await loadSuppliers(); // Load suppliers first (needed for dropdowns)
        await displayPoList(); // Load initial POs
    } catch (error) { console.error("Initialization error:", error); displayGlobalError("Failed to load initial page data."); }
    window.supplierManagementPageInitialized = true;
    console.log("Supplier Management Page Initialized v23+Fixes.");
}

function setupEventListeners() {
    if (window.supplierManagementPageListenersAttached) return;
    console.log("Setting up event listeners v23+Fixes...");

    // Supplier List Actions (Delegated)
    if (supplierTableBody) supplierTableBody.addEventListener('click', handleSupplierTableActions);
    else console.error("Supplier table body not found for listener.");

    // Supplier Modal Buttons
    if (addNewSupplierBtn) addNewSupplierBtn.addEventListener('click', () => openSupplierModal('add'));
    if (closeSupplierModalBtn) closeSupplierModalBtn.addEventListener('click', closeSupplierModal);
    if (cancelSupplierBtn) cancelSupplierBtn.addEventListener('click', closeSupplierModal);
    if (supplierForm) supplierForm.addEventListener('submit', saveSupplier);
    // Close modal on backdrop click
    if (supplierModal) supplierModal.addEventListener('click', (event) => { if (event.target === supplierModal) closeSupplierModal(); });

    // PO Filters
    if (poFilterBtn) poFilterBtn.addEventListener('click', () => { displayPoList(); /* Pagination reset needed here too */ });
    if (poClearFilterBtn) poClearFilterBtn.addEventListener('click', () => {
        if(poSearchInput) poSearchInput.value = '';
        if(poSupplierFilter) poSupplierFilter.value = '';
        if(poStatusFilter) poStatusFilter.value = '';
        if(poStartDateFilter) poStartDateFilter.value = '';
        if(poEndDateFilter) poEndDateFilter.value = '';
        currentPoSortField = 'createdAt'; currentPoSortDirection = 'desc'; // Reset sort
        updateSortIndicators();
        displayPoList(); // Refresh list with default settings
    });

    // PO Table Sorting
    if (poTableHeader) poTableHeader.addEventListener('click', handlePoSort);
    else console.error("PO table header not found for sort listener.");

    // PO Table Actions (Delegated)
    if (poTableBody) poTableBody.addEventListener('click', handlePOTableActions);
    else console.error("PO table body not found for PO actions listener.");

    // Status Update Modal Buttons
    if (closeStatusModalBtn) closeStatusModalBtn.addEventListener('click', closeStatusModal);
    if (cancelStatusBtn) cancelStatusBtn.addEventListener('click', closeStatusModal);
    if (statusUpdateForm) statusUpdateForm.addEventListener('submit', handleStatusUpdate);
    if (statusUpdateModal) statusUpdateModal.addEventListener('click', (event) => { if (event.target === statusUpdateModal) closeStatusModal(); });

    // PO Details Modal Buttons
    if (closePoDetailsModalBtn) closePoDetailsModalBtn.addEventListener('click', closePoDetailsModal);
    if (closePoDetailsBtn) closePoDetailsBtn.addEventListener('click', closePoDetailsModal); // Bottom close button
    if (poDetailsModal) poDetailsModal.addEventListener('click', (event) => { if (event.target === poDetailsModal) closePoDetailsModal(); });
    if (printPoDetailsBtn) printPoDetailsBtn.addEventListener('click', () => { /* Implement Print Details */ alert("Print Details needs implementation."); });

    // PO Share Modal Buttons
    if (closePoShareModal) closePoShareModal.addEventListener('click', closePoShareModalFunction); // Top close button
    if (closePoShareModalBtn) closePoShareModalBtn.addEventListener('click', closePoShareModalFunction); // Bottom close button
    if (poShareModal) poShareModal.addEventListener('click', (event) => { if (event.target === poShareModal) closePoShareModalFunction(); });
    if (printPoShareModalBtn) printPoShareModalBtn.addEventListener('click', () => { /* Implement Print Share */ alert("Print Share needs implementation."); });
    if (emailPoShareModalBtn) emailPoShareModalBtn.addEventListener('click', handleEmailPoShare);

    // CSV Export Button
    if (exportPoCsvBtn) exportPoCsvBtn.addEventListener('click', () => { /* Implement CSV Export */ alert("CSV Export needs implementation."); });

    // Pagination Controls (Add listeners later when implemented)
    // if (prevPageBtn) prevPageBtn.addEventListener('click', ...);
    // if (nextPageBtn) nextPageBtn.addEventListener('click', ...);
    // if (itemsPerPageSelect) itemsPerPageSelect.addEventListener('change', ...);

    // Batch Actions (Add listeners later when implemented)
    // if (selectAllPoCheckbox) selectAllPoCheckbox.addEventListener('change', ...);
    // if (poTableBody) poTableBody.addEventListener('change', (event) => { if (event.target.classList.contains('po-select-checkbox')) { ... } });
    // if (batchApplyStatusBtn) batchApplyStatusBtn.addEventListener('click', ...);
    // etc...

    window.supplierManagementPageListenersAttached = true; // Mark as attached
    console.log("Event listeners setup complete v23+Fixes.");
}

// --- Initialization Trigger ---
window.initializeSupplierManagementPage = initializeSupplierManagementPage; // Make available globally
console.log("supplier_management.js v23+Fixes loaded.");

// Auth check in HTML head now triggers initialization via window.initializeSupplierManagementPage(user);