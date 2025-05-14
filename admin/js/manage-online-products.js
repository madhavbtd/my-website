// js/manage-online-products.js
// Updated Version: Layout changes + Diagram Upload + Checkbox Lock/Unlock Logic + Fixes + STOCK MANAGEMENT + BULK SELECT (Step 1 & 2 - Bulk Edit Modal UI & Frontend Data Prep)
// Includes all previous fixes.

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
// For Step 2, we will keep them visible in the bulk edit modal and rely on the update logic (Step 3)
// to apply changes only where relevant (e.g., wedding fields only to wedding cards).


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
                    if(deleteWarningMessage) deleteWarningMessage.innerHTML = `Are you sure you want to delete the online product "<strong>${escapeHtml(productToDeleteName)}</strong>"? <br>This will also delete its images and diagram. This action cannot be undone.`;
                    if(deleteConfirmCheckbox) deleteConfirmCheckbox.checked = false;
                    if(confirmDeleteFinalBtn) confirmDeleteFinalBtn.disabled = true;
                    if(deleteConfirmModal) deleteConfirmModal.classList.add('active');
                });
            }
        });
    }
    // Update UI after rendering (in case products were filtered/sorted) (from Step 1)
    updateBulkActionsUI();
}

// --- Pricing Tab Functions ---
function setActiveRateTab(rateType) {
    unlockPricingFields();
    if (!RATE_TYPES[rateType] || !priceTabsContainer || !currentRateInput || !currentRateLabel || !applyRateCheckboxesContainer) {
        console.error("Cannot set active rate tab - required elements missing.");
        return;
    }
    currentActiveRateType = rateType;
    priceTabsContainer.querySelectorAll('.price-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.rateType === rateType);
    });
    currentRateLabel.textContent = `${RATE_TYPES[rateType].label}*:`;
    const fieldName = RATE_TYPES[rateType].field;
    currentRateInput.value = productBeingEditedData?.pricing?.[fieldName] ?? '';
    currentRateInput.dataset.currentRateType = rateType;
    updateApplyRateCheckboxes(rateType);
}

function updateApplyRateCheckboxes(activeType) {
    if (!applyRateCheckboxesContainer) return;
    applyRateCheckboxesContainer.innerHTML = '';
    const containerTitle = document.createElement('label');
    containerTitle.className = 'checkbox-container-title';
    containerTitle.textContent = `Apply ${RATE_TYPES[activeType]?.label || 'Current'} Rate to:`;
    applyRateCheckboxesContainer.appendChild(containerTitle);
    Object.keys(RATE_TYPES).forEach(typeKey => {
        if (typeKey !== activeType) {
            const otherTypeInfo = RATE_TYPES[typeKey];
            const checkboxId = `applyRateTo_${typeKey}`;
            const wrapper = document.createElement('div');
            wrapper.className = 'checkbox-wrapper apply-rate-checkbox';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox'; checkbox.id = checkboxId; checkbox.name = 'applyRateTo'; checkbox.value = typeKey;
            checkbox.addEventListener('change', handleApplyRateCheckboxChange);
            const label = document.createElement('label');
            label.htmlFor = checkboxId; label.textContent = otherTypeInfo.label;
            wrapper.appendChild(checkbox); wrapper.appendChild(label);
            applyRateCheckboxesContainer.appendChild(wrapper);
        }
    });
    checkAndApplyLockState();
}

function handleApplyRateCheckboxChange() { checkAndApplyLockState(); }
function handleRateInputChange() { if (!currentRateInput.disabled) { resetApplyCheckboxesAndUnlock(); } }
function checkAndApplyLockState() {
    const checkboxes = applyRateCheckboxesContainer?.querySelectorAll('input[name="applyRateTo"]') ?? [];
    const checkedCheckboxes = applyRateCheckboxesContainer?.querySelectorAll('input[name="applyRateTo"]:checked') ?? [];
    if (checkboxes.length > 0 && checkedCheckboxes.length === checkboxes.length) {
        applyRateToAllOthers();
        lockPricingFields();
    } else {
        unlockPricingFields();
    }
}
function applyRateToAllOthers() {
    if (!currentRateInput || !productBeingEditedData.pricing) return;
    const currentRateValue = parseNumericInput(currentRateInput.value);
    if (currentRateValue !== null && !isNaN(currentRateValue)) {
        Object.keys(RATE_TYPES).forEach(typeKey => {
            if (typeKey !== currentActiveRateType) {
                const field = RATE_TYPES[typeKey].field;
                productBeingEditedData.pricing[field] = currentRateValue;
            }
        });
    }
}
function lockPricingFields() {
    if (!currentRateInput || !applyRateCheckboxesContainer || !priceTabsContainer) return;
    isRateLocked = true; currentRateInput.disabled = true;
    applyRateCheckboxesContainer.querySelectorAll('input[name="applyRateTo"]').forEach(cb => cb.disabled = true);
    priceTabsContainer.querySelectorAll('.price-tab-btn').forEach(btn => {
        if (btn.dataset.rateType !== currentActiveRateType) { btn.disabled = true; }
    });
}
function unlockPricingFields() {
    if (!currentRateInput || !applyRateCheckboxesContainer || !priceTabsContainer) return;
    isRateLocked = false; currentRateInput.disabled = false;
    applyRateCheckboxesContainer.querySelectorAll('input[name="applyRateTo"]').forEach(cb => cb.disabled = false);
    priceTabsContainer.querySelectorAll('.price-tab-btn').forEach(btn => { btn.disabled = false; });
}
function resetApplyCheckboxesAndUnlock() {
    if (!applyRateCheckboxesContainer) return;
    applyRateCheckboxesContainer.querySelectorAll('input[name="applyRateTo"]:checked').forEach(cb => cb.checked = false);
    unlockPricingFields();
}

// --- Modal Handling (Add/Edit) ---
function openAddModal() {
    if (!productModal || !productForm) return;
    console.log("Opening modal to add new ONLINE product (v_Stock).");
    // NEW: Clear any selected products when opening add/edit modal
    selectedProductIds.clear();
    updateBulkActionsUI();

    if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-plus-circle success-icon"></i> Add New Online Product';
    if (editProductIdInput) editProductIdInput.value = '';
    productForm.reset();
    productBeingEditedData = { pricing: {}, stock: {} }; // Initialize with stock object

    if (isEnabledCheckbox) isEnabledCheckbox.checked = true;
    if (hasExtraChargesCheckbox) hasExtraChargesCheckbox.checked = false;
    // Ensure extra charges section is correctly toggled on reset
    toggleExtraCharges();

    existingImageUrls = []; selectedFiles = []; imagesToDelete = [];
    if (imagePreviewArea) imagePreviewArea.innerHTML = '';
    if (uploadProgressInfo) uploadProgressInfo.textContent = '';
    if (existingImageUrlsInput) existingImageUrlsInput.value = '[]';
    if (saveProductBtn) saveProductBtn.disabled = false;
    if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = 'Save Product';
    if (deleteProductBtn) deleteProductBtn.style.display = 'none';

    diagramFileToUpload = null; shouldRemoveDiagram = false;
    if(productDiagramInput) productDiagramInput.value = null;
    if(diagramLinkArea) diagramLinkArea.style.display = 'none';
    if(viewDiagramLink) viewDiagramLink.href = '#';
    if(diagramUploadProgress) diagramUploadProgress.textContent = '';
    if(existingDiagramUrlInput) existingDiagramUrlInput.value = '';

    // START: Reset Stock fields for Add Modal
    if (productCurrentStockInput) productCurrentStockInput.value = ''; // Or '0' if you prefer default
    if (productMinStockLevelInput) productMinStockLevelInput.value = '';
    // END: Reset Stock fields

    setActiveRateTab('online');
    unlockPricingFields();

    toggleWeddingFields(); toggleSqFtFields();
    productModal.classList.add('active');
}

async function openEditModal(firestoreId, data) {
    if (!productModal || !productForm || !data) return;
    console.log("Opening modal to edit ONLINE product (v_Stock):", firestoreId);
    // NEW: Clear any selected products when opening add/edit modal
    selectedProductIds.clear();
    updateBulkActionsUI();

    if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-edit info-icon"></i> Edit Online Product';
    productForm.reset();
    productBeingEditedData = JSON.parse(JSON.stringify(data));
    if (!productBeingEditedData.pricing) productBeingEditedData.pricing = {};
    if (!productBeingEditedData.stock) productBeingEditedData.stock = {}; // Ensure stock object exists

    if (editProductIdInput) editProductIdInput.value = firestoreId;
    if (productNameInput) productNameInput.value = data.productName || '';
    if (productCategoryInput) productCategoryInput.value = data.category || '';
    if (productUnitSelect) productUnitSelect.value = data.unit || 'Qty';
    if (productDescInput) productDescInput.value = data.description || '';
    if (isEnabledCheckbox) isEnabledCheckbox.checked = data.isEnabled !== undefined ? data.isEnabled : true;

    const pricing = data.pricing || {};
    if (productMinOrderValueInput) productMinOrderValueInput.value = pricing.minimumOrderValue ?? '';
    if (productPurchasePriceInput) productPurchasePriceInput.value = pricing.purchasePrice ?? '';
    if (productMrpInput) productMrpInput.value = pricing.mrp ?? '';
    if (productGstRateInput) productGstRateInput.value = pricing.gstRate ?? '';
    if (designChargeInput) designChargeInput.value = pricing.designCharge ?? '';
    if (printingChargeInput) printingChargeInput.value = pricing.printingChargeBase ?? '';
    if (transportChargeInput) transportChargeInput.value = pricing.transportCharge ?? '';
    if (extraMarginPercentInput) extraMarginPercentInput.value = pricing.extraMarginPercent ?? '';
    if (hasExtraChargesCheckbox) hasExtraChargesCheckbox.checked = pricing.hasExtraCharges || false;
     // Ensure extra charges section is correctly toggled after loading data
    toggleExtraCharges();

    if (extraChargeNameInput) extraChargeNameInput.value = pricing.extraCharge?.name || '';
    if (extraChargeAmountInput) extraChargeAmountInput.value = pricing.extraCharge?.amount ?? '';


    if (productOptionsInput) { try { productOptionsInput.value = (data.options && Array.isArray(data.options)) ? JSON.stringify(data.options, null, 2) : ''; } catch { productOptionsInput.value = ''; } }
    if (productBrandInput) productBrandInput.value = data.brand || '';
    if (productItemCodeInput) productItemCodeInput.value = data.itemCode || '';
    if (productHsnSacCodeInput) productHsnSacCodeInput.value = data.hsnSacCode || '';

    // START: Load Stock fields for Edit Modal
    const stock = data.stock || {};
    if (productCurrentStockInput) productCurrentStockInput.value = stock.currentStock ?? '';
    if (productMinStockLevelInput) productMinStockLevelInput.value = stock.minStockLevel ?? '';
    // END: Load Stock fields

    selectedFiles = []; imagesToDelete = [];
    if (imagePreviewArea) imagePreviewArea.innerHTML = '';
    existingImageUrls = data.imageUrls || [];
    if (existingImageUrlsInput) existingImageUrlsInput.value = JSON.stringify(existingImageUrls);
    existingImageUrls.forEach(url => displayImagePreview(null, url));
    if (uploadProgressInfo) uploadProgressInfo.textContent = '';

    diagramFileToUpload = null; shouldRemoveDiagram = false;
    const currentDiagramUrl = data.diagramUrl || '';
    if(productDiagramInput) productDiagramInput.value = null;
    if(existingDiagramUrlInput) existingDiagramUrlInput.value = currentDiagramUrl;
    if (diagramLinkArea && viewDiagramLink) { if (currentDiagramUrl) { viewDiagramLink.href = currentDiagramUrl; diagramLinkArea.style.display = 'block'; } else { diagramLinkArea.style.display = 'none'; } }
    if(diagramUploadProgress) diagramUploadProgress.textContent = '';

    if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = 'Update Product'; if (deleteProductBtn) deleteProductBtn.style.display = 'inline-flex';

    productToDeleteId = firestoreId; productToDeleteName = data.productName || 'this online product';

    setActiveRateTab('online');
    unlockPricingFields();

    toggleWeddingFields(); toggleSqFtFields();
    productModal.classList.add('active');
}

function closeProductModal() {
    if (productModal) {
        productModal.classList.remove('active');
        productToDeleteId = null; productToDeleteName = null;
        if (productImagesInput) productImagesInput.value = null;
        selectedFiles = []; imagesToDelete = [];
        productBeingEditedData = {};
        currentActiveRateType = 'online';
        diagramFileToUpload = null; shouldRemoveDiagram = false;
        if (productDiagramInput) productDiagramInput.value = null;
        unlockPricingFields();
         // NEW: Clear selected products when closing add/edit modal
        selectedProductIds.clear();
        updateBulkActionsUI();
         // Re-render table to clear checkboxes
        applyFiltersAndRender();
    }
}

// --- Image Handling ---
function handleFileSelection(event) { if (!imagePreviewArea || !productImagesInput) return; const files = Array.from(event.target.files); let currentImageCount = existingImageUrls.filter(url => !imagesToDelete.includes(url)).length + selectedFiles.length; const availableSlots = 4 - currentImageCount; if (files.length > availableSlots) { alert(`Max 4 images allowed. You have ${currentImageCount}, tried to add ${files.length}.`); productImagesInput.value = null; return; } files.forEach(file => { if (file.type.startsWith('image/')) { if (selectedFiles.length + existingImageUrls.filter(url => !imagesToDelete.includes(url)).length < 4) { selectedFiles.push(file); displayImagePreview(file, null); } } }); productImagesInput.value = null; }
function displayImagePreview(fileObject, existingUrl = null) { if (!imagePreviewArea) return; const previewId = existingUrl || `new-${fileObject.name}-${Date.now()}`; const previewWrapper = document.createElement('div'); previewWrapper.className = 'image-preview-item'; previewWrapper.setAttribute('data-preview-id', previewId); const img = document.createElement('img'); const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.className = 'remove-image-btn'; removeBtn.innerHTML = '&times;'; removeBtn.title = 'Remove image'; const progressBar = document.createElement('div'); progressBar.className = 'upload-progress-bar'; const progressFill = document.createElement('div'); progressBar.appendChild(progressFill); progressBar.style.display = 'none'; if (existingUrl) { img.src = existingUrl; img.onerror = () => { img.src = 'images/placeholder.png'; }; previewWrapper.imageUrl = existingUrl; removeBtn.onclick = () => { if (!imagesToDelete.includes(existingUrl)) imagesToDelete.push(existingUrl); previewWrapper.style.display = 'none'; }; } else if (fileObject) { const reader = new FileReader(); reader.onload = (e) => { img.src = e.target.result; }; reader.readAsDataURL(fileObject); previewWrapper.fileData = fileObject; removeBtn.onclick = () => { selectedFiles = selectedFiles.filter(f => f !== fileObject); previewWrapper.remove(); }; } previewWrapper.appendChild(img); previewWrapper.appendChild(removeBtn); previewWrapper.appendChild(progressBar); imagePreviewArea.appendChild(previewWrapper); }
async function uploadImage(file, productId, index) { if (!window.storage || !window.storageRef || !window.uploadBytesResumable || !window.getDownloadURL) throw new Error("Storage functions missing."); const previewWrapper = [...imagePreviewArea.querySelectorAll('.image-preview-item')].find(el => el.fileData === file); const progressBar = previewWrapper?.querySelector('.upload-progress-bar'); const progressFill = progressBar?.querySelector('div'); const timestamp = Date.now(); const uniqueFileName = `${timestamp}-image${index}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`; const filePath = `onlineProductImages/${productId}/${uniqueFileName}`; const fileRef = window.storageRef(window.storage, filePath); if (progressBar) progressBar.style.display = 'block'; if (progressFill) progressFill.style.width = '0%'; const uploadTask = window.uploadBytesResumable(fileRef, file); return new Promise((resolve, reject) => { uploadTask.on('state_changed', (snapshot) => { const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100; if (progressFill) progressFill.style.width = `${progress}%`; if (uploadProgressInfo) uploadProgressInfo.textContent = `Uploading ${file.name}: ${progress.toFixed(0)}%`; }, (error) => { if (progressBar) progressBar.style.backgroundColor = 'red'; if (uploadProgressInfo) uploadProgressInfo.textContent = `Upload failed: ${file.name}.`; reject(error); }, async () => { if (progressBar) progressBar.style.backgroundColor = 'var(--success-color)'; if (uploadProgressInfo) uploadProgressInfo.textContent = `Getting URL...`; try { const downloadURL = await window.getDownloadURL(uploadTask.snapshot.ref); resolve(downloadURL); } catch (error) { if (progressBar) progressBar.style.backgroundColor = 'red'; if (uploadProgressInfo) uploadProgressInfo.textContent = `Failed to get URL.`; reject(error); } }); }); }
async function deleteStoredImage(imageUrl) { if (!window.storage || !window.storageRef || !window.deleteObject) return; if (!imageUrl || !(imageUrl.startsWith('https://firebasestorage.googleapis.com/') || imageUrl.startsWith('gs://'))) return; try { const imageRef = window.storageRef(window.storage, imageUrl); await window.deleteObject(imageRef); console.log("Deleted image from Storage:", imageUrl); } catch (error) { if (error.code === 'storage/object-not-found') console.warn("Image not found:", imageUrl); else console.error("Error deleting image:", imageUrl, error); } }

// --- Diagram File Handling ---
function handleDiagramFileSelection(event) { const file = event.target.files[0]; if (file) { const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']; if (!allowedTypes.includes(file.type)) { showToast("Invalid diagram file type. Please use PDF, PNG, JPG, or WEBP.", 4000); event.target.value = null; diagramFileToUpload = null; return; } diagramFileToUpload = file; shouldRemoveDiagram = false; if(diagramUploadProgress) diagramUploadProgress.textContent = `Selected: ${file.name}`; if(diagramLinkArea) diagramLinkArea.style.display = 'none'; } else { diagramFileToUpload = null; if(diagramUploadProgress) diagramUploadProgress.textContent = ''; } }
function handleRemoveDiagram() { if (!existingDiagramUrlInput?.value) { showToast("No diagram currently saved to remove.", 3000); return; } if (confirm("Are you sure you want to remove the current diagram? This will delete the file permanently when you save.")) { shouldRemoveDiagram = true; diagramFileToUpload = null; if(productDiagramInput) productDiagramInput.value = null; if(diagramLinkArea) diagramLinkArea.style.display = 'none'; if(diagramUploadProgress) diagramUploadProgress.textContent = 'Diagram marked for removal.'; showToast("Diagram marked for removal. Click Save Product to confirm.", 4000); } }
async function uploadFile(file, storagePath, progressElement) { if (!window.storage || !window.storageRef || !window.uploadBytesResumable || !window.getDownloadURL) throw new Error("Storage functions missing."); if (!file || !storagePath || !progressElement) throw new Error("Missing file, path, or progress element for upload."); const fileRef = window.storageRef(window.storage, storagePath); progressElement.textContent = 'Starting upload...'; progressElement.style.color = 'var(--text-color-medium)'; const uploadTask = window.uploadBytesResumable(fileRef, file); return new Promise((resolve, reject) => { uploadTask.on('state_changed', (snapshot) => { const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100; progressElement.textContent = `Uploading ${file.name}: ${progress.toFixed(0)}%`; }, (error) => { progressElement.textContent = `Upload failed: ${file.name}. ${error.code}`; progressElement.style.color = 'var(--danger-color)'; reject(error); }, async () => { progressElement.textContent = `Upload Complete. Getting URL...`; try { const downloadURL = await window.getDownloadURL(uploadTask.snapshot.ref); progressElement.textContent = `Diagram uploaded successfully.`; progressElement.style.color = 'var(--success-color)'; resolve(downloadURL); } catch (getUrlError) { progressElement.textContent = `Failed to get URL after upload.`; progressElement.style.color = 'var(--danger-color)'; reject(getUrlError); } }); }); }
async function deleteStoredFile(fileUrl) { if (!window.storage || !window.storageRef || !window.deleteObject) { return; } if (!fileUrl || !(fileUrl.startsWith('https://firebasestorage.googleapis.com/') || fileUrl.startsWith('gs://'))) { return; } try { const fileRef = window.storageRef(window.storage, fileUrl); await window.deleteObject(fileRef); console.log("Deleted file from Storage:", fileUrl); } catch (error) { if (error.code === 'storage/object-not-found') { console.warn("File not found in Storage, skipping delete:", fileUrl); } else { console.error("Error deleting file:", fileUrl, error); } } }

// --- handleSaveProduct Function (Single Edit) ---
async function handleSaveProduct(event) {
    event.preventDefault();
    if (!window.db || !window.collection || !window.addDoc || !window.doc || !window.updateDoc || !window.serverTimestamp || !window.storage) { showToast("Core Firebase functions unavailable.", 5000); return; }
    if (saveProductBtn) saveProductBtn.disabled = true; if (saveSpinner) saveSpinner.style.display = 'inline-block'; if (saveIcon) saveIcon.style.display = 'none'; if (saveText) saveText.textContent = 'Saving...'; if (uploadProgressInfo) uploadProgressInfo.textContent = 'Preparing data...'; if (diagramUploadProgress) diagramUploadProgress.textContent = '';

    const editingProductId = editProductIdInput?.value;
    const isEditing = !!editingProductId;
    let finalProductId = editingProductId;

    const productName = productNameInput?.value.trim(); const category = productCategoryInput?.value.trim(); const unit = productUnitSelect?.value || null;
    if (!productName || !category || !unit) { showToast("Product Name, Category, and Unit are required.", 5000); if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product'; return; }

    const currentRateValue = parseNumericInput(currentRateInput?.value);
    const purchasePrice = parseNumericInput(productPurchasePriceInput?.value); const mrp = parseNumericInput(productMrpInput?.value); const gstRate = parseNumericInput(productGstRateInput?.value); const minOrderValue = parseNumericInput(productMinOrderValueInput?.value); const designCharge = parseNumericInput(designChargeInput?.value); const printingCharge = parseNumericInput(printingChargeInput?.value); const transportCharge = parseNumericInput(transportChargeInput?.value); const extraMarginPercent = parseNumericInput(extraMarginPercentInput?.value); const extraChargeAmount = parseNumericInput(extraChargeAmountInput?.value);
    if (currentRateValue === null || isNaN(currentRateValue)) { const activeLabel = RATE_TYPES[currentActiveRateType]?.label || 'Current Price'; showToast(`Please enter a valid ${activeLabel}.`, 5000); if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product'; return; }
    if ([purchasePrice, mrp, gstRate, minOrderValue, designCharge, printingCharge, transportCharge, extraMarginPercent, extraChargeAmount].some(isNaN)) { showToast("Please enter valid numbers for optional prices/charges.", 5000); if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product'; return; }

    // START: Get Stock Data
    const currentStock = parseNumericInput(productCurrentStockInput?.value, true, true); // true for allowZero, true for isInteger
    const minStockLevel = parseNumericInput(productMinStockLevelInput?.value, true, true); // true for allowZero, true for isInteger

    if (isNaN(currentStock) && productCurrentStockInput?.value.trim() !== '') { // Check if NaN but not empty
        showToast("Please enter a valid whole number for Current Stock.", 5000);
        if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product';
        return;
    }
    if (isNaN(minStockLevel) && productMinStockLevelInput?.value.trim() !== '') { // Check if NaN but not empty
        showToast("Please enter a valid whole number for Minimum Stock Level.", 5000);
        if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) textSpan.textContent = isEditing ? 'Update Product' : 'Save Product';
        return;
    }
    // END: Get Stock Data

    const productData = {
        productName: productName, productName_lowercase: productName.toLowerCase(),
        category: category, category_lowercase: category.toLowerCase(),
        unit: unit, description: productDescInput?.value.trim() || '',
        isEnabled: isEnabledCheckbox?.checked ?? true,
        options: [], brand: productBrandInput?.value.trim() || null,
        itemCode: productItemCodeInput?.value.trim() || null,
        hsnSacCode: productHsnSacCodeInput?.value.trim() || null,
        updatedAt: window.serverTimestamp(),
        pricing: { ...(productBeingEditedData?.pricing || {}) },
        stock: { ...(productBeingEditedData?.stock || {}) } // START: Initialize stock object
    };
    if (!isEditing) { productData.createdAt = window.serverTimestamp(); productData.imageUrls = []; productData.diagramUrl = null; }

    // START: Add Stock data to productData
    if (currentStock !== null && !isNaN(currentStock)) {
        productData.stock.currentStock = currentStock;
    } else {
        // If editing and field was cleared, explicitly set to null or remove
        if (isEditing && productBeingEditedData?.stock?.hasOwnProperty('currentStock')) {
            productData.stock.currentStock = null; // Or delete productData.stock.currentStock;
        }
    }
    if (minStockLevel !== null && !isNaN(minStockLevel)) {
        productData.stock.minStockLevel = minStockLevel;
    } else {
        if (isEditing && productBeingEditedData?.stock?.hasOwnProperty('minStockLevel')) {
            productData.stock.minStockLevel = null; // Or delete productData.stock.minStockLevel;
        }
    }
    // If stock object is empty and you prefer not to save it, you can delete it.
    if (Object.keys(productData.stock).length === 0 && isEditing) { // Only delete if editing and it becomes empty
        delete productData.stock;
    } else if (Object.keys(productData.stock).length > 0 && !productData.stock.currentStock && !productData.stock.minStockLevel) {
         // If stock object exists but its fields are empty/null after updates, maybe clean it up
         if (isEditing) delete productData.stock; // Decide if you want to save empty stock {} or delete
         else delete productData.stock; // Decide if you want to save empty stock {} or delete
    }
    // END: Add Stock data to productData


    const activeField = RATE_TYPES[currentActiveRateType].field;
    productData.pricing[activeField] = currentRateValue;
    if (purchasePrice !== null) productData.pricing.purchasePrice = purchasePrice; else delete productData.pricing.purchasePrice;
    if (mrp !== null) productData.pricing.mrp = mrp; else delete productData.pricing.mrp;
    if (gstRate !== null) productData.pricing.gstRate = gstRate; else delete productData.pricing.gstRate;
    if (unit === 'Sq Feet' && minOrderValue !== null) productData.pricing.minimumOrderValue = minOrderValue; else delete productData.pricing.minimumOrderValue;
    if (category.toLowerCase().includes('wedding card')) { if (designCharge !== null) productData.pricing.designCharge = designCharge; else delete productData.pricing.designCharge; if (printingCharge !== null) productData.pricing.printingChargeBase = printingCharge; else delete productData.pricing.printingChargeBase; if (transportCharge !== null) productData.pricing.transportCharge = transportCharge; else delete productData.pricing.transportCharge; if (extraMarginPercent !== null) productData.pricing.extraMarginPercent = extraMarginPercent; else delete productData.pricing.extraMarginPercent; } else { delete productData.pricing.designCharge; delete productData.pricing.printingChargeBase; delete productData.pricing.transportCharge; delete productData.pricing.extraMarginPercent; }
    productData.pricing.hasExtraCharges = hasExtraChargesCheckbox?.checked ?? false; if (productData.pricing.hasExtraCharges) { productData.pricing.extraCharge = { name: extraChargeNameInput?.value.trim() || 'Additional Charge', amount: extraChargeAmount ?? 0 }; } else { delete productData.pricing.extraCharge; }

    const optionsString = productOptionsInput?.value.trim();
    if (optionsString) { try { const parsedOptions = JSON.parse(optionsString); if (!Array.isArray(parsedOptions)) throw new Error("Options must be an array."); productData.options = parsedOptions; } catch (err) { showToast(`Error: Invalid JSON in Options field. ${err.message}`, 5000); if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product'; return; } }
    else { productData.options = []; }

    productData.diagramUrl = isEditing ? (productBeingEditedData?.diagramUrl || null) : null;

    try {
        if (!isEditing) {
             if (uploadProgressInfo) uploadProgressInfo.textContent = 'Creating product entry...';
             const preliminaryData = { ...productData };
             // Remove fields that will be updated later or are specific to updateDoc
             delete preliminaryData.imageUrls; delete preliminaryData.diagramUrl;
             // Decide how to handle stock creation vs update
             if(preliminaryData.stock && Object.keys(preliminaryData.stock).length === 0) delete preliminaryData.stock;

             const docRef = await window.addDoc(window.collection(window.db, "onlineProducts"), preliminaryData);
             finalProductId = docRef.id;
             productData.id = finalProductId; // Add ID to productData for subsequent operations
        } else { finalProductId = editingProductId; }
        if (!finalProductId) throw new Error("Could not establish Product ID.");

        let newDiagramUrl = productData.diagramUrl;
        const existingDiagramUrl = isEditing ? (productBeingEditedData?.diagramUrl || null) : null;
        if (shouldRemoveDiagram && existingDiagramUrl) {
            if (diagramUploadProgress) diagramUploadProgress.textContent = 'Removing existing diagram...';
            await deleteStoredFile(existingDiagramUrl);
            newDiagramUrl = null;
        } else if (diagramFileToUpload) {
            if (uploadProgressInfo) uploadProgressInfo.textContent = 'Processing diagram...';
             if (isEditing && existingDiagramUrl) {
                 if (diagramUploadProgress) diagramUploadProgress.textContent = 'Replacing existing diagram...';
                 await deleteStoredFile(existingDiagramUrl);
             }
            const diagramFileName = `diagram-${Date.now()}-${diagramFileToUpload.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const diagramPath = `productDiagrams/${finalProductId}/${diagramFileName}`;
            newDiagramUrl = await uploadFile(diagramFileToUpload, diagramPath, diagramUploadProgress);
        }
        productData.diagramUrl = newDiagramUrl;

        let uploadedImageUrls = [];
        let currentExistingUrls = isEditing ? (productBeingEditedData?.imageUrls || []) : [];
        if (isEditing && imagesToDelete.length > 0) { if (uploadProgressInfo) uploadProgressInfo.textContent = 'Deleting images...'; const deletePromises = imagesToDelete.map(url => deleteStoredImage(url)); await Promise.allSettled(deletePromises); currentExistingUrls = currentExistingUrls.filter(url => !imagesToDelete.includes(url)); }
        if (selectedFiles.length > 0) { if (uploadProgressInfo) uploadProgressInfo.textContent = `Uploading ${selectedFiles.length} images...`; const uploadPromises = selectedFiles.map((file, index) => uploadImage(file, finalProductId, index)); const uploadResults = await Promise.allSettled(uploadPromises); uploadedImageUrls = []; let uploadErrorOccurred = false; uploadResults.forEach((result) => { if (result.status === 'fulfilled') { uploadedImageUrls.push(result.value); } else { uploadErrorOccurred = true; } }); if (uploadErrorOccurred) { showToast("Some images failed upload.", 5000); } else { if (uploadProgressInfo) uploadProgressInfo.textContent = 'Images uploaded!'; } }

        const finalImageUrls = [...currentExistingUrls, ...uploadedImageUrls];
        const finalUpdatePayload = {
             ...productData,
             imageUrls: finalImageUrls,
             updatedAt: window.serverTimestamp()
        };
        if (isEditing) { delete finalUpdatePayload.createdAt; delete finalUpdatePayload.id; /* ID is in doc ref */ }

        if (uploadProgressInfo) uploadProgressInfo.textContent = 'Finalizing product data...';
        const finalProductRef = window.doc(window.db, "onlineProducts", finalProductId);
        await window.updateDoc(finalProductRef, finalUpdatePayload);

        showToast(isEditing ? 'Product updated successfully!' : 'Product added successfully!', 3000);
        closeProductModal();

    } catch (error) {
        console.error("Save/upload error:", error);
        showToast(`Error saving product: ${error.message || 'Unknown error'}. Check console.`, 5000);
         if (!isEditing && finalProductId && error.message !== "Could not establish Product ID.") { try { await window.deleteDoc(window.doc(window.db, "onlineProducts", finalProductId)); console.log("Partial product entry cleaned up."); } catch (cleanupError) { console.error("Failed to cleanup partial product entry:", cleanupError); } }
    } finally {
        if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product'; if (uploadProgressInfo) setTimeout(() => { if (uploadProgressInfo) uploadProgressInfo.textContent = ''; }, 3000); if (diagramUploadProgress) setTimeout(() => { if (diagramUploadProgress) diagramUploadProgress.textContent = ''; }, 3000);
    }
}

// --- Delete Handling ---
function handleDeleteButtonClick(event) { event.preventDefault(); if (!productToDeleteId || !productToDeleteName) return; if (!deleteWarningMessage) { console.error("Delete warning message element not found."); return; } if (deleteWarningMessage) deleteWarningMessage.innerHTML = `Are you sure you want to delete "<strong>${escapeHtml(productToDeleteName)}</strong>"? <br>This will also delete its images and diagram. This action cannot be undone.`; if(deleteConfirmCheckbox) deleteConfirmCheckbox.checked = false; if(confirmDeleteFinalBtn) confirmDeleteFinalBtn.disabled = true; if(deleteConfirmModal) deleteConfirmModal.classList.add('active'); }
function closeDeleteConfirmModal() { if (deleteConfirmModal) { deleteConfirmModal.classList.remove('active'); } }
function handleConfirmCheckboxChange() { if (deleteConfirmCheckbox && confirmDeleteFinalBtn) { confirmDeleteFinalBtn.disabled = !deleteConfirmCheckbox.checked; } }
async function handleFinalDelete() { if (!deleteConfirmCheckbox?.checked || !productToDeleteId) return; if (!window.db || !window.doc || !window.getDoc || !window.deleteDoc || !window.storage || !window.storageRef || !window.deleteObject) { showToast("Core Firebase functions unavailable.", 5000); return; } if(confirmDeleteFinalBtn) { confirmDeleteFinalBtn.disabled = true; confirmDeleteFinalBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...'; } const productRef = window.doc(window.db, "onlineProducts", productToDeleteId); try { const productSnap = await window.getDoc(productRef); let deletePromises = []; if (productSnap.exists()) { const productData = productSnap.data(); if (productData.imageUrls && Array.isArray(productData.imageUrls) && productData.imageUrls.length > 0) { productData.imageUrls.forEach(url => deletePromises.push(deleteStoredImage(url))); } if (productData.diagramUrl) { deletePromises.push(deleteStoredFile(productData.diagramUrl)); } if (deletePromises.length > 0) { await Promise.allSettled(deletePromises); } } await window.deleteDoc(productRef); showToast(`Product "${productToDeleteName || ''}" and associated files deleted!`); closeDeleteConfirmModal(); closeProductModal(); } catch (error) { console.error(`Error during deletion process for ${productToDeleteId}:`, error); showToast(`Failed to fully delete product: ${error.message}`, 5000); } finally { if(confirmDeleteFinalBtn) { confirmDeleteFinalBtn.disabled = !deleteConfirmCheckbox?.checked; confirmDeleteFinalBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Confirm Delete'; } } }


// --- NEW: Bulk Edit Functions (Step 2) ---

// Function to open the bulk edit modal
function handleBulkEditClick() {
    if (selectedProductIds.size === 0) {
        showToast("Please select at least one product for bulk edit.", 3000);
        return;
    }
    console.log("Opening Bulk Edit modal for IDs:", selectedProductIds);

    if (bulkEditModal && bulkEditForm) {
        // Reset the form when opening
        bulkEditForm.reset();
        // Ensure conditional sections are hidden initially based on checkboxes state after reset
        toggleBulkExtraCharges();

        // TODO (Step 3): Add logic here to potentially show/hide wedding/sqft fields
        // based on the categories/units of the *selected* products.
        // For now, we rely on the save logic to only apply relevant updates.

        // Show the modal
        bulkEditModal.classList.add('active');
    } else {
        console.error("Bulk edit modal or form element not found.");
        showToast("Error: Bulk edit feature not fully loaded.", 4000);
    }
}

// Function to close the bulk edit modal
function closeBulkEditModal() {
    if (bulkEditModal) {
        bulkEditModal.classList.remove('active');
         // Optional: Clear selection when closing bulk edit modal
        selectedProductIds.clear();
        updateBulkActionsUI();
         // Re-render table to clear checkboxes
        applyFiltersAndRender();
    }
}

// Function to handle saving bulk edits (PREPARES data, does NOT save in Step 2)
async function handleSaveBulkEdit() {
    console.log("Attempting to save bulk edit...");
    if (selectedProductIds.size === 0) {
        showToast("No products selected for bulk update.", 3000);
        return;
    }

    if (!saveBulkEditBtn) return;

    // Disable save button and show spinner
    saveBulkEditBtn.disabled = true;
    const spinner = saveBulkEditBtn.querySelector('.fa-spinner');
    const icon = saveBulkEditBtn.querySelector('.fa-save');
    const textSpan = saveBulkEditBtn.querySelector('span');
    if (spinner) spinner.style.display = 'inline-block';
    if (icon) icon.style.display = 'none';
    if (textSpan) textSpan.textContent = 'Updating...';


    // Let's use a simpler payload creation for Step 2: include fields if they have a non-empty value, include checkboxes based on state.

    const simplifiedUpdatePayload = {};
    const simplifiedPricingPayload = {};
    const simplifiedStockPayload = {};
    const simplifiedExtraChargePayload = {};
    const simplifiedInternalPayload = {};
    const simplifiedWeddingPayload = {};


    // Basic Properties
    // If checked, set to true. If unchecked, set to false.
    if (bulkIsEnabledCheckbox) {
        // Check if the checkbox is checked or unchecked to determine if user wants to set the value
        // If checked, set to true. If unchecked, set to false.
        // With a single checkbox, the simplest logic is: if it's currently checked, set to true. If it's currently unchecked, set to false.
        // This assumes the user will interact with the checkbox if they want to change the 'isEnabled' state in bulk.
         simplifiedUpdatePayload.isEnabled = bulkIsEnabledCheckbox.checked;
    }


    // Stock Management
    const simplifiedCurrentStock = parseNumericInput(bulkCurrentStockInput?.value, true, true);
    if (bulkCurrentStockInput?.value.trim() !== '') { // Check if user typed anything
        if (!isNaN(simplifiedCurrentStock)) {
             simplifiedStockPayload.currentStock = simplifiedCurrentStock;
        } else {
             showToast("Please enter a valid whole number for Bulk Current Stock.", 5000);
             if (spinner) spinner.style.display = 'none'; if (icon) icon.style.display = ''; if (textSpan) textSpan.textContent = 'Update Selected Products'; if (saveBulkEditBtn) saveBulkEditBtn.disabled = false;
             return; // Stop if invalid
        }
    }
    const simplifiedMinStockLevel = parseNumericInput(bulkMinStockLevelInput?.value, true, true);
     if (bulkMinStockLevelInput?.value.trim() !== '') { // Check if user typed anything
        if (!isNaN(simplifiedMinStockLevel)) {
             simplifiedStockPayload.minStockLevel = simplifiedMinStockLevel;
        } else {
              showToast("Please enter a valid whole number for Bulk Minimum Stock Level.", 5000);
              if (spinner) spinner.style.display = 'none'; if (icon) icon.style.display = ''; if (textSpan) textSpan.textContent = 'Update Selected Products'; if (saveBulkEditBtn) saveBulkEditBtn.disabled = false;
              return; // Stop if invalid
        }
     }
     if (Object.keys(simplifiedStockPayload).length > 0) {
          simplifiedUpdatePayload.stock = simplifiedStockPayload;
     }


    // Other Options (JSON)
    const simplifiedOptionsString = bulkOptionsInput?.value.trim();
    if (simplifiedOptionsString !== '') {
        try {
             const parsedOptions = JSON.parse(simplifiedOptionsString);
             if (!Array.isArray(parsedOptions)) throw new Error("Options must be an array.");
             simplifiedUpdatePayload.options = parsedOptions;
         } catch (err) {
             showToast(`Error: Invalid JSON in Bulk Options field. ${err.message}`, 5000);
             if (spinner) spinner.style.display = 'none'; if (icon) icon.style.display = ''; if (textSpan) textSpan.textContent = 'Update Selected Products'; if (saveBulkEditBtn) saveBulkEditBtn.disabled = false;
             return; // Stop the process if JSON is invalid
         }
    }


    // Price Details Subset
    const simplifiedPurchasePrice = parseNumericInput(bulkPurchasePriceInput?.value);
    if (bulkPurchasePriceInput?.value.trim() !== '' && !isNaN(simplifiedPurchasePrice)) {
        simplifiedPricingPayload.purchasePrice = simplifiedPurchasePrice;
    }
    const simplifiedGstRate = parseNumericInput(bulkGstRateInput?.value);
    if (bulkGstRateInput?.value.trim() !== '' && !isNaN(simplifiedGstRate)) {
        simplifiedPricingPayload.gstRate = simplifiedGstRate;
    }
    const simplifiedMrp = parseNumericInput(bulkMrpInput?.value);
    if (bulkMrpInput?.value.trim() !== '' && !isNaN(simplifiedMrp)) {
        simplifiedPricingPayload.mrp = simplifiedMrp;
    }
    const simplifiedMinOrderValue = parseNumericInput(bulkMinOrderValueInput?.value);
     if (bulkMinOrderValueInput?.value.trim() !== '' && !isNaN(simplifiedMinOrderValue)) {
         simplifiedPricingPayload.minimumOrderValue = simplifiedMinOrderValue;
     }


    // Wedding Card Charges
    const simplifiedDesignCharge = parseNumericInput(bulkDesignChargeInput?.value);
     if (bulkDesignChargeInput?.value.trim() !== '' && !isNaN(simplifiedDesignCharge)) {
        simplifiedWeddingPayload.designCharge = simplifiedDesignCharge;
    }
    const simplifiedPrintingCharge = parseNumericInput(bulkPrintingChargeInput?.value);
    if (bulkPrintingChargeInput?.value.trim() !== '' && !isNaN(simplifiedPrintingCharge)) {
        simplifiedWeddingPayload.printingChargeBase = simplifiedPrintingCharge;
    }
    const simplifiedTransportCharge = parseNumericInput(bulkTransportChargeInput?.value);
    if (bulkTransportChargeInput?.value.trim() !== '' && !isNaN(simplifiedTransportCharge)) {
        simplifiedWeddingPayload.transportCharge = simplifiedTransportCharge;
    }
    const simplifiedExtraMarginPercent = parseNumericInput(bulkExtraMarginPercentInput?.value);
    if (bulkExtraMarginPercentInput?.value.trim() !== '' && !isNaN(simplifiedExtraMarginPercent)) {
        simplifiedWeddingPayload.extraMarginPercent = simplifiedExtraMarginPercent;
    }


    // Optional Extra Charges
     if (bulkHasExtraChargesCheckbox) {
          simplifiedPricingPayload.hasExtraCharges = bulkHasExtraChargesCheckbox.checked; // Always include the boolean state if checkbox exists

          if (bulkHasExtraChargesCheckbox.checked) {
              const simplifiedExtraChargeName = bulkExtraChargeNameInput?.value.trim();
              const simplifiedExtraChargeAmount = parseNumericInput(bulkExtraChargeAmountInput?.value.trim());

              // Include name/amount if user typed something OR if it should default
              // >>>>>>>> Please check syntax VERY CAREFULLY around this line in your editor <<<<<<<<<<
              if (simplifiedExtraChargeName !== '' || (bulkExtraChargeAmountInput?.value.trim() !== '' && !isNaN(simplifiedExtraChargeAmount))) { // Added NaN check here
                   simplifiedExtraChargePayload.name = simplifiedExtraChargeName || 'Additional Charge';
                   simplifiedExtraChargePayload.amount = (simplifiedExtraChargeAmount !== null && !isNaN(simplifiedExtraChargeAmount)) ? simplifiedExtraChargeAmount : 0;
                   simplifiedPricingPayload.extraCharge = simplifiedExtraChargePayload;
              } else if (bulkExtraChargesSection.style.display === 'block') {
                    // If section is visible and user didn't type, but checkbox is checked,
                    // save default name/amount. This handles cases where they just check the box.
                     simplifiedExtraChargePayload.name = simplifiedExtraChargeName || 'Additional Charge';
                     simplifiedExtraChargePayload.amount = (simplifiedExtraChargeAmount !== null && !isNaN(simplifiedExtraChargeAmount)) ? simplifiedExtraChargeAmount : 0;
                     simplifiedPricingPayload.extraCharge = simplifiedExtraChargePayload;
              } else {
                   // Checkbox is checked, section is visible, but fields are empty - do not add extraCharge object?
                   // Let's revisit this logic in Step 3 with clearer requirements if needed.
                   // For now, if checkbox is checked and fields are empty, don't include extraCharge object, just set hasExtraCharges: true.
              }

          } else {
               // If checkbox is UNCHECKED, explicitly set extraCharge to null to remove it
               simplifiedPricingPayload.extraCharge = null;
          }
     }


     // Internal Details
     const simplifiedBrand = bulkBrandInput?.value.trim();
     if (simplifiedBrand !== '') {
         simplifiedInternalPayload.brand = simplifiedBrand;
     }
     const simplifiedItemCode = bulkItemCodeInput?.value.trim();
      if (simplifiedItemCode !== '') {
         simplifiedInternalPayload.itemCode = simplifiedItemCode;
     }
     const simplifiedHsnSacCode = bulkHsnSacCodeInput?.value.trim();
      if (simplifiedHsnSacCode !== '') {
         simplifiedInternalPayload.hsnSacCode = simplifiedHsnSacCode;
     }
     if (Object.keys(simplifiedInternalPayload).length > 0) {
          Object.assign(simplifiedUpdatePayload, simplifiedInternalPayload);
      }


     // Merge pricing and wedding payloads
     if (Object.keys(simplifiedPricingPayload).length > 0 || Object.keys(simplifiedWeddingPayload).length > 0) {
          simplifiedUpdatePayload.pricing = simplifiedUpdatePayload.pricing || {};
          Object.assign(simplifiedUpdatePayload.pricing, simplifiedPricingPayload, simplifiedWeddingPayload);
     }

    // Add updatedAt timestamp if there are any updates
    if (Object.keys(simplifiedUpdatePayload).length > 0 || (simplifiedUpdatePayload.pricing && Object.keys(simplifiedUpdatePayload.pricing).length > 0) || (simplifiedUpdatePayload.stock && Object.keys(simplifiedUpdatePayload.stock).length > 0)) {
        // Refined check: include timestamp if any top-level, pricing, or stock fields are being updated.
         simplifiedUpdatePayload.updatedAt = window.serverTimestamp();
    }


    // Check if the final payload has any updates after considering nested objects
    let hasMeaningfulUpdates = false;
     if (Object.keys(simplifiedUpdatePayload).length > 0) {
          hasMeaningfulUpdates = true;
     }
     // Further check nested objects if they exist but are empty in the first check
     if (!hasMeaningfulUpdates && simplifiedUpdatePayload.pricing && Object.keys(simplifiedUpdatePayload.pricing).length > 0) hasMeaningfulUpdates = true;
     if (!hasMeaningfulUpdates && simplifiedUpdatePayload.stock && Object.keys(simplifiedUpdatePayload.stock).length > 0) hasMeaningfulUpdates = true;
     // Check if options array is present and not empty
     if (!hasMeaningfulUpdates && simplifiedUpdatePayload.options && Array.isArray(simplifiedUpdatePayload.options) && simplifiedUpdatePayload.options.length > 0) hasMeaningfulUpdates = true;
      // Check if isEnabled or hasExtraCharges were explicitly set
     if (!hasMeaningfulUpdates && simplifiedUpdatePayload.hasOwnProperty('isEnabled')) hasMeaningfulUpdates = true; // Checkbox state is always included
     if (!hasMeaningfulUpdates && simplifiedUpdatePayload.pricing && simplifiedUpdatePayload.pricing.hasOwnProperty('hasExtraCharges')) hasMeaningfulUpdates = true; // Checkbox state is always included
     if (!hasMeaningfulUpdates && simplifiedUpdatePayload.pricing && simplifiedUpdatePayload.pricing.hasOwnProperty('extraCharge') && simplifiedUpdatePayload.pricing.extraCharge === null) hasMeaningfulUpdates = true; // Explicitly removing extra charge


    if (!hasMeaningfulUpdates) {
         showToast("No fields were entered for bulk update. Nothing to save.", 4000);
         // Re-enable save button and hide spinner
         if (spinner) spinner.style.display = 'none';
         if (icon) icon.style.display = '';
         if (textSpan) textSpan.textContent = 'Update Selected Products';
         if (saveBulkEditBtn) saveBulkEditBtn.disabled = false;
         return; // Exit the function as nothing needs updating
    }


    console.log("Selected IDs for bulk update:", Array.from(selectedProductIds));
    console.log("Prepared Bulk Update Payload:", simplifiedUpdatePayload);

    // TODO (Step 3): Implement the actual Firebase WriteBatch logic here
    // This will involve getting document references for each ID in selectedProductIds
    // and applying the simplifiedUpdatePayload to each document using batch.update()

    // For Step 2, we just log and show a message
    showToast(`Prepared update for ${selectedProductIds.size} products. (Saving feature coming in Step 3)`, 5000);

    // Close the modal after preparing data (simulating completion for Step 2)
    closeBulkEditModal();


    // Re-enable save button and hide spinner in the finally block
    if (spinner) spinner.style.display = 'none';
    if (icon) icon.style.display = '';
    if (textSpan) textSpan.textContent = 'Update Selected Products';
    if (saveBulkEditBtn) saveBulkEditBtn.disabled = false;

    // TODO (Step 3): Add proper error handling and UI feedback during the actual save process.
}

// --- END ---