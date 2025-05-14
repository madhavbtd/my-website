// js/manage-online-products.js
// Updated Version: Layout changes + Diagram Upload + Checkbox Lock/Unlock Logic + Fixes + STOCK MANAGEMENT + BULK SELECT (Step 1 & 2 - Bulk Edit Modal UI & Frontend Data Prep)
// Includes all previous fixes and ensures helper functions are declared only once.

// --- Firebase Function Availability Check ---
// Expecting: window.db, window.auth, window.storage, window.collection, window.onSnapshot, etc.

// --- DOM Elements ---
const productTableBody = document.getElementById('productTableBody');
const loadingRow = document.getElementById('loadingMessage');
const sortSelect = document.getElementById('sort-products');
const filterSearchInput = document.getElementById('filterSearch');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const addNewProductBtn = document.getElementById('addNewProductBtn');
// NEW: Bulk Actions Elements (from Step 1)
const bulkActionsContainer = document.getElementById('bulkActionsContainer');
const selectedCountSpan = document.getElementById('selectedCount');
const bulkEditButton = document.getElementById('bulkEditButton'); // Button to open bulk edit modal


// --- Product Add/Edit Modal Elements ---
const productModal = document.getElementById('productModal');
const modalTitle = document.getElementById('modalTitle');
const productForm = document.getElementById('productForm');
const closeProductModalBtn = document.getElementById('closeProductModal');
const cancelProductBtn = document.getElementById('cancelProductBtn');
const saveProductBtn = document.getElementById('saveProductBtn');
const saveSpinner = saveProductBtn?.querySelector('.fa-spinner');
const saveIcon = saveProductBtn?.querySelector('.fa-save');
const saveText = saveProductBtn?.querySelector('span');
const editProductIdInput = document.getElementById('editProductId');
const deleteProductBtn = document.getElementById('deleteProductBtn');

// --- Modal Form Field References ---
// Column 1
const productNameInput = document.getElementById('productName');
const productCategoryInput = document.getElementById('productCategory');
const productUnitSelect = document.getElementById('productUnit');
const productDescInput = document.getElementById('productDescription');
const isEnabledCheckbox = document.getElementById('isEnabled');
// Images
const productImagesInput = document.getElementById('productImages');
const imagePreviewArea = document.getElementById('image-preview-area');
const uploadProgressInfo = document.getElementById('upload-progress-info');
const existingImageUrlsInput = document.getElementById('existingImageUrls');

// Column 2 (Pricing)
const productPurchasePriceInput = document.getElementById('productPurchasePrice');
const productGstRateInput = document.getElementById('productGstRate');
const priceTabsContainer = document.getElementById('priceTabsContainer');
const currentRateInput = document.getElementById('currentRateInput');
const currentRateLabel = document.getElementById('currentRateLabel');
const applyRateCheckboxesContainer = document.getElementById('applyRateCheckboxesContainer');
const productMinOrderValueInput = document.getElementById('productMinOrderValue');
const productMrpInput = document.getElementById('productMrp');
// Wedding Fields
const weddingFieldsContainer = document.getElementById('wedding-card-fields');
const designChargeInput = document.getElementById('designCharge');
const printingChargeInput = document.getElementById('printingCharge');
const transportChargeInput = document.getElementById('transportCharge');
const extraMarginPercentInput = document.getElementById('extraMarginPercent');

// Column 3 (Internal, Stock, Options, Diagram, Extra Charges)
const productBrandInput = document.getElementById('productBrand');
const productItemCodeInput = document.getElementById('productItemCode');
// FIX: Corrected ID from 'hsnSacCode' to 'productHsnSacCode'
const productHsnSacCodeInput = document.getElementById('productHsnSacCode');

// START: New Stock Management Fields References
const productCurrentStockInput = document.getElementById('productCurrentStock');
const productMinStockLevelInput = document.getElementById('productMinStockLevel');
// END: New Stock Management Fields References

const productOptionsInput = document.getElementById('productOptions');
// Diagram Elements
const productDiagramInput = document.getElementById('productDiagram');
const diagramLinkArea = document.getElementById('diagram-link-area');
const viewDiagramLink = document.getElementById('viewDiagramLink');
const removeDiagramBtn = document.getElementById('removeDiagramBtn');
const diagramUploadProgress = document.getElementById('diagram-upload-progress');
const existingDiagramUrlInput = document.getElementById('existingDiagramUrl');
// Extra Charges Elements
const hasExtraChargesCheckbox = document.getElementById('hasExtraCharges');
const extraChargesSection = document.getElementById('extra-charges-section');
const extraChargeNameInput = document.getElementById('extraChargeName');
const extraChargeAmountInput = document.getElementById('extraChargeAmount');

// --- Delete Confirmation Modal Elements ---
const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const closeDeleteConfirmModalBtn = document.getElementById('closeDeleteConfirmModal');
const cancelDeleteFinalBtn = document.getElementById('cancelDeleteFinalBtn');
const confirmDeleteFinalBtn = document.getElementById('confirmDeleteFinalBtn');
const deleteConfirmCheckbox = document.getElementById('deleteConfirmCheckbox');
const deleteWarningMessage = document.getElementById('deleteWarningMessage');

// --- NEW: Bulk Edit Modal Elements (from Step 2 HTML) ---
const bulkEditModal = document.getElementById('bulkEditModal');
const closeBulkEditModalBtn = document.getElementById('closeBulkEditModal');
const cancelBulkEditBtn = document.getElementById('cancelBulkEditBtn');
const saveBulkEditBtn = document.getElementById('saveBulkEditBtn');
const bulkEditForm = document.getElementById('bulkEditForm');

// NEW: Bulk Edit Form Field References (from Step 2 HTML)
const bulkIsEnabledCheckbox = document.getElementById('bulkIsEnabled');
const bulkCurrentStockInput = document.getElementById('bulkCurrentStock');
const bulkMinStockLevelInput = document.getElementById('bulkMinStockLevel');
const bulkOptionsInput = document.getElementById('bulkOptions');
const bulkPurchasePriceInput = document.getElementById('bulkPurchasePrice');
// FIX: Corrected ID from 'bulkGk_rate' to 'bulkGstRate'
const bulkGstRateInput = document.getElementById('bulkGstRate');
const bulkMrpInput = document.getElementById('bulkMrp');
const bulkMinOrderValueInput = document.getElementById('bulkMinOrderValue'); // Note: requires handling unit in JS
const bulkDesignChargeInput = document.getElementById('bulkDesignCharge'); // Note: requires handling category in JS
const bulkPrintingChargeInput = document.getElementById('bulkPrintingCharge'); // Note: requires handling category in JS
const bulkTransportChargeInput = document.getElementById('bulkTransportCharge'); // Note: requires handling category in JS
const bulkExtraMarginPercentInput = document.getElementById('bulkExtraMarginPercent'); // Note: requires handling category in JS
const bulkHasExtraChargesCheckbox = document.getElementById('bulkHasExtraCharges');
const bulkExtraChargeNameInput = document.getElementById('bulkExtraChargeName');
const bulkExtraChargeAmountInput = document.getElementById('bulkExtraChargeAmount');

// NEW: Bulk Edit Conditional Sections (from Step 2 HTML)
const bulkWeddingFieldsContainer = document.getElementById('bulk-wedding-card-fields');
const bulkExtraChargesSection = document.getElementById('bulk-extra-charges-section');
const bulkMinOrderValueGroup = document.getElementById('bulkMinOrderValueGroup');


// --- Global State ---
let currentSortField = 'createdAt';
let currentSortDirection = 'desc';
let unsubscribeProducts = null;
let allProductsCache = [];
let searchDebounceTimer;
let productToDeleteId = null;
let productToDeleteName = null;
let selectedFiles = []; // For product images
let imagesToDelete = [];
let existingImageUrls = [];
let productBeingEditedData = {}; // Store all pricing data when editing
let currentActiveRateType = 'online'; // Default active tab/rate type
const RATE_TYPES = { // Map types to Firestore field names and labels
    online: { field: 'rate', label: 'Online Customer Rate' },
    retail: { field: 'retailRate', label: 'Retail Shop Rate' },
    agent: { field: 'agentRate', label: 'Agent/Branch Rate' },
    reseller: { field: 'resellerRate', label: 'Reseller/Wholesale Rate' }
};
// Diagram state
let diagramFileToUpload = null;
let shouldRemoveDiagram = false;
let isRateLocked = false;
// NEW: Bulk Select State (from Step 1)
let selectedProductIds = new Set();


// --- Helper Functions ---
function formatCurrency(amount) { const num = Number(amount); return isNaN(num) || num === null || num === undefined ? '-' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { unsafe = String(unsafe || ''); } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;'); }
function parseNumericInput(value, allowZero = true, isInteger = false) { // Added isInteger for stock
    if (value === undefined || value === null) return null;
    const trimmedValue = String(value).trim();
    if (trimmedValue === '') return null;

    const num = isInteger ? parseInt(trimmedValue, 10) : parseFloat(trimmedValue);

    if (isNaN(num) || (!allowZero && num <= 0) || (allowZero && num < 0)) {
        return NaN;
    }
    if (isInteger && !Number.isInteger(num)) { // Check if it's a whole number after parsing
        return NaN;
    }
    return num;
}
function formatFirestoreTimestamp(timestamp) { if (!timestamp || typeof timestamp.toDate !== 'function') { return '-'; } try { const date = timestamp.toDate(); const options = { day: '2-digit', month: 'short', year: 'numeric' }; return date.toLocaleDateString('en-GB', options).replace(/ /g, ' '); } catch (e) { console.error("Error formatting timestamp:", e); return '-'; } }


// --- Toast Notification ---
function showToast(message, duration = 3500) { const existingToast = document.querySelector('.toast-notification'); if (existingToast) { existingToast.remove(); } const toast = document.createElement('div'); toast.className = 'toast-notification'; toast.textContent = message; document.body.appendChild(toast); setTimeout(() => toast.classList.add('show'), 10); setTimeout(() => { toast.classList.remove('show'); setTimeout(() => { if (toast.parentNode) { toast.parentNode.removeChild(toast); } }, 400); }, duration); console.log("Toast:", message); }

// --- Initialization ---
window.initializeOnlineProductManagement = () => {
    console.log("Online Product Management Initializing (v_Stock)...");
    if (!window.db || !window.auth || !window.storage) { console.error("Firebase services not available."); alert("Error initializing page."); return; }
    console.log("Firebase services confirmed.");
    listenForOnlineProducts();
    setupEventListeners();
    console.log("Online Product Management Initialized (v_Stock).");
};

// --- Setup Event Listeners ---
function setupEventListeners() {
    if (sortSelect) sortSelect.addEventListener('change', handleSortChange);
    if (filterSearchInput) filterSearchInput.addEventListener('input', handleSearchInput);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
    if (addNewProductBtn) addNewProductBtn.addEventListener('click', openAddModal);
    if (closeProductModalBtn) closeProductModalBtn.addEventListener('click', closeProductModal);
    if (cancelProductBtn) cancelProductBtn.addEventListener('click', closeProductModal);
    if (productModal) productModal.addEventListener('click', (event) => { if (event.target === productModal) closeProductModal(); });
    if (productForm) productForm.addEventListener('submit', handleSaveProduct);
    if (deleteProductBtn) deleteProductBtn.addEventListener('click', handleDeleteButtonClick);
    if (closeDeleteConfirmModalBtn) closeDeleteConfirmModalBtn.addEventListener('click', closeDeleteConfirmModal);
    if (cancelDeleteFinalBtn) cancelDeleteFinalBtn.addEventListener('click', closeDeleteConfirmModal);
    if (deleteConfirmModal) deleteConfirmModal.addEventListener('click', (event) => { if (event.target === deleteConfirmModal) closeDeleteConfirmModal(); });
    if (deleteConfirmCheckbox) deleteConfirmCheckbox.addEventListener('change', handleConfirmCheckboxChange);
    if (confirmDeleteFinalBtn) confirmDeleteFinalBtn.addEventListener('click', handleFinalDelete);
    if (productImagesInput) productImagesInput.addEventListener('change', handleFileSelection);
    if (hasExtraChargesCheckbox) hasExtraChargesCheckbox.addEventListener('change', toggleExtraCharges);
    if (productCategoryInput) productCategoryInput.addEventListener('input', toggleWeddingFields);
    if (productUnitSelect) productUnitSelect.addEventListener('input', toggleSqFtFields);

    if (priceTabsContainer) {
        priceTabsContainer.addEventListener('click', (event) => {
            const button = event.target.closest('.price-tab-btn');
            if (button && (!isRateLocked || button.classList.contains('active'))) {
                 const rateType = button.dataset.rateType;
                 if (rateType && rateType !== currentActiveRateType) {
                     setActiveRateTab(rateType);
                 }
            } else if (button && isRateLocked && !button.classList.contains('active')) {
                showToast("Uncheck 'Apply to all' checkboxes below to change rate type.", 3000);
            }
        });
    } else { console.error("Price tabs container (#priceTabsContainer) not found!"); }

    if (currentRateInput) {
        currentRateInput.addEventListener('input', handleRateInputChange);
    } else { console.error("Current rate input (#currentRateInput) not found!"); }

    if (productDiagramInput) { productDiagramInput.addEventListener('change', handleDiagramFileSelection); }
    if (removeDiagramBtn) { removeDiagramBtn.addEventListener('click', handleRemoveDiagram); }

    // NEW: Add event listeners for bulk action elements (if they exist) - from Step 1
    if(bulkEditButton) bulkEditButton.addEventListener('click', handleBulkEditClick); // This function will be implemented in Step 2

    // NEW: Add event listeners for Bulk Edit Modal (from Step 2)
    if(bulkEditModal) bulkEditModal.addEventListener('click', (event) => { if (event.target === bulkEditModal) closeBulkEditModal(); });
    if(closeBulkEditModalBtn) closeBulkEditModalBtn.addEventListener('click', closeBulkEditModal);
    if(cancelBulkEditBtn) cancelBulkEditBtn.addEventListener('click', closeBulkEditModal);
    if(saveBulkEditBtn) saveBulkEditBtn.addEventListener('click', handleSaveBulkEdit); // Note: Using button click, not form submit directly

    // NEW: Add event listener for bulk extra charges checkbox
    if(bulkHasExtraChargesCheckbox) bulkHasExtraChargesCheckbox.addEventListener('change', toggleBulkExtraCharges);


    console.log("Online Product Management event listeners set up (v_Stock).");
}

// NEW: Function to handle checkbox change (from Step 1)
function handleProductCheckboxChange(event) {
    const checkbox = event.target;
    const productId = checkbox.dataset.id;

    if (checkbox.checked) {
        selectedProductIds.add(productId);
    } else {
        selectedProductIds.delete(productId);
    }

    console.log("Selected Product IDs:", selectedProductIds); // Log for testing
    updateBulkActionsUI(); // Update the count and button state
}

// NEW: Function to update the bulk actions UI (from Step 1)
function updateBulkActionsUI() {
    const count = selectedProductIds.size;
    if (selectedCountSpan) {
        selectedCountSpan.textContent = `${count} selected`;
    }

    if (bulkActionsContainer) {
        bulkActionsContainer.style.display = count > 0 ? 'flex' : 'none';
    }

    // Enable/disable bulk edit button
    if (bulkEditButton) {
        bulkEditButton.disabled = count === 0;
        // Show the button only when items are selected
        bulkEditButton.style.display = count > 0 ? 'inline-flex' : 'none';
    }
}


// --- Show/Hide Conditional Fields (Single Edit Modal) ---
function toggleWeddingFields() { if (!weddingFieldsContainer || !productCategoryInput) return; const category = productCategoryInput.value.toLowerCase(); weddingFieldsContainer.style.display = category.includes('wedding card') ? 'block' : 'none'; }
function toggleSqFtFields() { if (!productUnitSelect) return; const unitType = productUnitSelect.value; if (productMinOrderValueInput) { const parentGroup = productMinOrderValueInput.closest('.sq-feet-only'); if (parentGroup) parentGroup.style.display = unitType === 'Sq Feet' ? 'block' : 'none'; } }
function toggleExtraCharges() { if (!extraChargesSection || !hasExtraChargesCheckbox) return; extraChargesSection.style.display = hasExtraChargesCheckbox.checked ? 'block' : 'none'; }

// NEW: Show/Hide Conditional Fields (Bulk Edit Modal)
function toggleBulkExtraCharges() {
    if (bulkExtraChargesSection && bulkHasExtraChargesCheckbox) {
        bulkExtraChargesSection.style.display = bulkHasExtraChargesCheckbox.checked ? 'block' : 'none';
    }
}

// NOTE: Toggling bulk wedding fields and bulk min order value group based on *selected* products is complex.
// For Step 2, we will keep them visible in the bulk edit modal and rely on the save logic to only apply relevant updates.


// --- Sorting & Filtering Handlers ---
function handleSortChange() { if (!sortSelect) return; const [field, direction] = sortSelect.value.split('_'); if (field && direction) { if (field === currentSortField && direction === currentSortDirection) return; currentSortField = field; currentSortDirection = direction; listenForOnlineProducts(); /* Re-fetch with new sort */ } }
function handleSearchInput() { clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(applyFiltersAndRender, 300); }
function clearFilters() {
    if (filterSearchInput) filterSearchInput.value = '';
    if (sortSelect) sortSelect.value = 'createdAt_desc';
    currentSortField = 'createdAt';
    currentSortDirection = 'desc';
    // NEW: Clear selected products when filters are cleared (from Step 1)
    selectedProductIds.clear();
    updateBulkActionsUI();
    // Reset table checkboxes visually by re-rendering or iterating (re-rendering is simpler)
    applyFiltersAndRender(); // This re-renders the table, clearing checkboxes
    if (unsubscribeProducts) listenForOnlineProducts(); /* Re-fetch if listener was active */
}

// --- Firestore Listener ---
function listenForOnlineProducts() {
    if (unsubscribeProducts) { unsubscribeProducts(); unsubscribeProducts = null; }
    if (!window.db || !window.collection || !window.query || !window.onSnapshot || !window.orderBy) {
        console.error("Firestore functions unavailable!");
        // Colspan updated from 9 to 10
        if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="10" style="color: red; text-align: center;">Error: DB Connection Failed.</td></tr>`;
        return;
    }
    // Colspan updated from 9 to 10
    if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="10" id="loadingMessage" style="text-align: center;">Loading online products...</td></tr>`;
    try {
        console.log(`Setting up Firestore listener for 'onlineProducts' with sort: ${currentSortField}_${currentSortDirection}`);
        const productsRef = window.collection(window.db, "onlineProducts");
        const q = window.query(productsRef, window.orderBy(currentSortField || 'createdAt', currentSortDirection || 'desc'));
        unsubscribeProducts = window.onSnapshot(q, (snapshot) => {
            console.log(`Received ${snapshot.docs.length} online products.`);
            allProductsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            applyFiltersAndRender();
        }, (error) => {
            console.error("Error fetching online products snapshot:", error);
            // Colspan updated from 9 to 10
            let colspan = 10;
            if (error.code === 'permission-denied') {
                if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="${colspan}" style="color: red; text-align: center;">Error loading products: Insufficient permissions. Check Firestore rules.</td></tr>`;
            } else {
                if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="${colspan}" style="color: red; text-align: center;">Error loading products. Check connection/console.</td></tr>`;
            }
        });
    } catch (error) {
        console.error("Error setting up online product listener:", error);
        if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="10" style="color: red; text-align: center;">Error setting up listener.</td></tr>`;
    }
}

// --- Filter, Sort, Render ---
function applyFiltersAndRender() {
    if (!allProductsCache) return;
    console.log("Applying filters...");
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';
    let filteredProducts = allProductsCache.filter(product => {
        if (!product || !product.productName) return false;
        if (filterSearchValue) {
            const name = (product.productName || '').toLowerCase();
            const category = (product.category || '').toLowerCase();
            const brand = (product.brand || '').toLowerCase();
            // Add itemCode and hsnSacCode to search criteria
            const itemCode = (product.itemCode || '').toLowerCase();
            const hsnSacCode = (product.hsnSacCode || '').toLowerCase();
            if (!(name.includes(filterSearchValue) || category.includes(filterSearchValue) || brand.includes(filterSearchValue) || itemCode.includes(filterSearchValue) || hsnSacCode.includes(filterSearchValue))) {
                return false;
            }
        }
        return true;
    });
    renderProductTable(filteredProducts);
    console.log("Online product rendering complete (filtered).");
}

// --- Table Rendering Function ---
function renderProductTable(products) {
    if (!productTableBody) return;
    productTableBody.innerHTML = '';
    // Colspan updated from 9 to 10
    const expectedColumns = 10;
    if (products.length === 0) {
        productTableBody.innerHTML = `<tr><td colspan="${expectedColumns}" id="noProductsMessage" style="text-align: center;">No online products found matching criteria.</td></tr>`;
    } else {
        products.forEach(product => {
            const firestoreId = product.id;
            const data = product;
            const tableRow = productTableBody.insertRow();
            tableRow.setAttribute('data-id', firestoreId);

            const name = data.productName || 'N/A';
            const category = data.category || '-';
            const brand = data.brand || '-';
            const rate = data.pricing?.rate !== undefined ? formatCurrency(data.pricing.rate) : '-';
            const unit = data.unit || '-';
            const enabled = data.isEnabled ? 'Yes' : 'No';
            const dateAdded = formatFirestoreTimestamp(data.createdAt);
            // START: Get Current Stock value
            const currentStock = (data.stock?.currentStock !== undefined && data.stock?.currentStock !== null) ? data.stock.currentStock : 'N/A';
            // END: Get Current Stock value

            // Check if the product is currently selected (from Step 1)
            const isSelected = selectedProductIds.has(firestoreId);

            tableRow.innerHTML = `
                <td style="text-align: center;"><input type="checkbox" class="product-select-checkbox" data-id="${firestoreId}" ${isSelected ? 'checked' : ''}></td>
                <td>${escapeHtml(name)}</td>
                <td>${escapeHtml(category)}</td>
                <td>${escapeHtml(brand)}</td>
                <td style="text-align: right;">${rate}</td>
                <td style="text-align: center;">${escapeHtml(unit)}</td>
                <td style="text-align: center;">${enabled}</td>
                <td style="text-align: center;">${dateAdded}</td>
                <td style="text-align: right;">${escapeHtml(currentStock)}</td>
                <td style="text-align: center;">
                    <button class="button edit-product-btn" style="background-color: var(--info-color); color: white; padding: 5px 8px; font-size: 0.8em; margin: 2px;" title="Edit Online Product"><i class="fas fa-edit"></i> Edit</button>
                    <button class="button delete-product-btn" style="background-color: var(--danger-color); color: white; padding: 5px 8px; font-size: 0.8em; margin: 2px;" title="Delete Online Product"><i class="fas fa-trash"></i> Delete</button>
                </td>`;

            // Add event listener to the checkbox in the newly created row (from Step 1)
            const checkbox = tableRow.querySelector('.product-select-checkbox');
            if (checkbox) {
                 checkbox.addEventListener('change', handleProductCheckboxChange);
            }

            const editBtn = tableRow.querySelector('.edit-product-btn');
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEditModal(firestoreId, data);
                });
            }
            const delBtn = tableRow.querySelector('.delete-product-btn');
            if (delBtn) {
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    productToDeleteId = firestoreId;
                    productToDeleteName = data.productName || 'this online product';
                    if(deleteWarningMessage) deleteWarningMessage.innerHTML = `Are you sure you want to delete the online product "<strong>${escapeHtml(productToDeleteName)}