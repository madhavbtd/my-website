// js/manage-online-products.js
// Updated Version: Layout changes + Diagram Upload + Checkbox Lock/Unlock Logic + Fixes + STOCK MANAGEMENT + BULK SELECT (Step 1)
// Added: BULK UPDATE MODAL UI CONTROL (Step 2 Frontend Logic - Part 1)
// FIX: Resolved Syntax Error & Moved onAuthStateChanged listener from HTML
// FIX: Corrected TypeError by importing Auth functions directly

// --- Firebase Function Availability Check ---
// Expecting: window.db, window.storage, window.collection, window.onSnapshot, etc. from HTML setup script
// Importing Auth functions directly here:
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"; // Import getApp


// --- DOM Elements ---
const productTableBody = document.getElementById('productTableBody');
const loadingRow = document.getElementById('loadingMessage');
const sortSelect = document.getElementById('sort-products');
const filterSearchInput = document.getElementById('filterSearch');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const addNewProductBtn = document.getElementById('addNewProductBtn');
// Bulk Actions Elements
const bulkActionsContainer = document.getElementById('bulkActionsContainer');
const selectedCountSpan = document.getElementById('selectedCount');
const bulkEditButton = document.getElementById('bulkEditButton');


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

// --- Modal Form Field References (Single Product) ---
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
const priceTabsContainer = document.getElementById('priceTabsContainer'); // Single edit modal price tabs
const currentRateInput = document.getElementById('currentRateInput'); // Single edit modal current rate input
const currentRateLabel = document.getElementById('currentRateLabel'); // Single edit modal current rate label
const applyRateCheckboxesContainer = document.getElementById('applyRateCheckboxesContainer'); // Single edit modal apply to others
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
const productHsnSacCodeInput = document.getElementById('productHsnSacCode');

// Stock Management Fields References
const productCurrentStockInput = document.getElementById('productCurrentStock');
const productMinStockLevelInput = document.getElementById('productMinStockLevel');

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

// --- START: NEW Bulk Update Modal Elements ---
const bulkUpdateModal = document.getElementById('bulkUpdateModal');
const closeBulkUpdateModalBtn = document.getElementById('closeBulkUpdateModal');
const cancelBulkUpdateBtn = document.getElementById('cancelBulkUpdateBtn');
const applyBulkUpdateBtn = document.getElementById('applyBulkUpdateBtn');
const bulkUpdateForm = document.getElementById('bulkUpdateForm');

// Bulk Form Fields (Section Checkboxes)
const bulkUpdateEnabledCheckbox = document.getElementById('bulkUpdateEnabledCheckbox');
const bulkUpdatePricingCheckbox = document.getElementById('bulkUpdatePricingCheckbox');
const bulkUpdateWeddingCheckbox = document.getElementById('bulkUpdateWeddingCheckbox');
const bulkUpdateInternalCheckbox = document.getElementById('bulkUpdateInternalCheckbox');
const bulkUpdateStockCheckbox = document.getElementById('bulkUpdateStockCheckbox');
const bulkUpdateOptionsCheckbox = document.getElementById('bulkUpdateOptionsCheckbox');
const bulkUpdateExtraChargesCheckbox = document.getElementById('bulkUpdateExtraChargesCheckbox');

// Bulk Form Fields (Controlled Containers)
const bulkBasicFields = document.getElementById('bulk-basic-fields');
const bulkPricingFields = document.getElementById('bulk-pricing-fields');
const bulkWeddingChargeFields = document.getElementById('bulk-wedding-charge-fields');
const bulkInternalFields = document.getElementById('bulk-internal-fields');
const bulkStockFields = document.getElementById('bulk-stock-fields');
const bulkOptionsFields = document.getElementById('bulk-options-fields');
const bulkExtraChargesFields = document.getElementById('bulk-extra-charges-fields');

// Bulk Form Fields (Individual Inputs and their Checkboxes)
const bulkIsEnabledSelect = document.getElementById('bulkIsEnabled'); // No individual checkbox, controlled by section checkbox
const bulkPriceTabsContainer = document.getElementById('bulkPriceTabsContainer'); // Bulk edit modal price tabs
const bulkCurrentRateInput = document.getElementById('bulkCurrentRateInput'); // Bulk edit modal current rate input
const bulkCurrentRateLabel = document.getElementById('bulkCurrentRateLabel'); // Bulk edit modal current rate label

const bulkPurchasePriceCheckbox = document.getElementById('bulkPurchasePriceCheckbox');
const bulkPurchasePriceInput = document.getElementById('bulkPurchasePrice');
const bulkMrpCheckbox = document.getElementById('bulkMrpCheckbox');
const bulkMrpInput = document.getElementById('bulkMrp');
const bulkGstRateCheckbox = document.getElementById('bulkGstRateCheckbox');
const bulkGstRateInput = document.getElementById('bulkGstRate');
const bulkMinOrderValueCheckbox = document.getElementById('bulkMinOrderValueCheckbox');
const bulkMinOrderValueInput = document.getElementById('bulkMinOrderValue');

const bulkDesignChargeCheckbox = document.getElementById('bulkDesignChargeCheckbox');
const bulkDesignChargeInput = document.getElementById('bulkDesignCharge');
const bulkPrintingChargeCheckbox = document.getElementById('bulkPrintingChargeCheckbox');
const bulkPrintingChargeInput = document.getElementById('bulkPrintingCharge');
const bulkTransportChargeCheckbox = document.getElementById('bulkTransportChargeCheckbox');
const bulkTransportChargeInput = document.getElementById('bulkTransportCharge');
const bulkExtraMarginPercentCheckbox = document.getElementById('bulkExtraMarginPercentCheckbox');
const bulkExtraMarginPercentInput = document.getElementById('bulkExtraMarginPercent');

const bulkBrandCheckbox = document.getElementById('bulkBrandCheckbox');
const bulkBrandInput = document.getElementById('bulkBrand');
const bulkItemCodeCheckbox = document.getElementById('bulkItemCodeCheckbox');
const bulkItemCodeInput = document.getElementById('bulkItemCode');
const bulkHsnSacCodeCheckbox = document.getElementById('bulkHsnSacCodeCheckbox');
const bulkHsnSacCodeInput = document.getElementById('bulkHsnSacCode');

const bulkCurrentStockCheckbox = document.getElementById('bulkCurrentStockCheckbox');
const bulkCurrentStockInput = document.getElementById('bulkCurrentStock');
const bulkMinStockLevelCheckbox = document.getElementById('bulkMinStockLevelCheckbox');
const bulkMinStockLevelInput = document.getElementById('bulkMinStockLevel');

const bulkOptionsInput = document.getElementById('bulkOptions'); // No individual checkbox, controlled by section checkbox

const bulkHasExtraChargesCheckbox = document.getElementById('bulkHasExtraChargesCheckbox');
const bulkHasExtraChargesSelect = document.getElementById('bulkHasExtraCharges');
const bulkExtraChargeNameCheckbox = document.getElementById('bulkExtraChargeNameCheckbox');
const bulkExtraChargeNameInput = document.getElementById('bulkExtraChargeName');
const bulkExtraChargeAmountCheckbox = document.getElementById('bulkExtraChargeAmountCheckbox');
const bulkExtraChargeAmountInput = document.getElementById('bulkExtraChargeAmount');

// Map individual field checkboxes to their corresponding input/select elements
const bulkFieldMap = {
    bulkPurchasePriceCheckbox: bulkPurchasePriceInput,
    bulkMrpCheckbox: bulkMrpInput,
    bulkGstRateCheckbox: bulkGstRateInput,
    bulkMinOrderValueCheckbox: bulkMinOrderValueInput,
    bulkDesignChargeCheckbox: bulkDesignChargeInput,
    bulkPrintingChargeCheckbox: bulkPrintingChargeInput,
    bulkTransportChargeCheckbox: bulkTransportChargeInput,
    bulkExtraMarginPercentCheckbox: bulkExtraMarginPercentInput,
    bulkBrandCheckbox: bulkBrandInput,
    bulkItemCodeCheckbox: bulkItemCodeInput,
    bulkHsnSacCodeCheckbox: bulkHsnSacCodeInput,
    bulkCurrentStockCheckbox: bulkCurrentStockInput,
    bulkMinStockLevelCheckbox: bulkMinStockLevelInput,
    bulkHasExtraChargesCheckbox: bulkHasExtraChargesSelect,
    bulkExtraChargeNameCheckbox: bulkExtraChargeNameInput,
    bulkExtraChargeAmountCheckbox: bulkExtraChargeAmountInput,
};

// Map section checkboxes to the div containing their fields
const bulkSectionFieldContainers = {
     bulkUpdateEnabledCheckbox: bulkBasicFields,
     bulkUpdatePricingCheckbox: bulkPricingFields,
     bulkUpdateWeddingCheckbox: bulkWeddingChargeFields,
     bulkUpdateInternalCheckbox: bulkInternalFields,
     bulkUpdateStockCheckbox: bulkStockFields,
     bulkUpdateOptionsCheckbox: bulkOptionsFields,
     bulkUpdateExtraChargesCheckbox: bulkExtraChargesFields,
};


// --- END: NEW Bulk Update Modal Elements ---


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
let currentActiveRateType = 'online'; // Default active tab/rate type for SINGLE edit modal
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
// Bulk Select State
let selectedProductIds = new Set();
// Bulk Update State
let currentBulkRateType = 'online'; // Default active tab/rate type for BULK edit modal


// --- Helper Functions ---
function formatCurrency(amount) { const num = Number(amount); return isNaN(num) || num === null || num === undefined ? '-' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { unsafe = String(unsafe || ''); } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
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
function formatFirestoreTimestamp(timestamp) { if (!timestamp || typeof timestamp.toDate !== 'function') { return '-'; } try { const date = timestamp.toDate(); const options = { day: '2-digit', month: 'short', year: 'numeric' }; return date.toLocaleDateString('en-GB', options).replace(/ /g, '-'); } catch (e) { console.error("Error formatting timestamp:", e); return '-'; } }

// --- Toast Notification ---
function showToast(message, duration = 3500) { const existingToast = document.querySelector('.toast-notification'); if (existingToast) { existingToast.remove(); } const toast = document.createElement('div'); toast.className = 'toast-notification'; toast.textContent = message; document.body.appendChild(toast); setTimeout(() => toast.classList.add('show'), 10); setTimeout(() => { toast.classList.remove('show'); setTimeout(() => { if (toast.parentNode) { toast.parentNode.removeChild(toast); } }, 400); }, duration); console.log("Toast:", message); }

// --- Initialization ---
// This function is now called from the onAuthStateChanged listener within this file
const initializeOnlineProductManagement = () => { // Made const
    console.log("Online Product Management Initializing (v_Bulk_Edit_UI_Logic_Fix2)..."); // Updated version log
    // Firebase services are assumed to be available globally from the HTML setup script
    if (!window.db || !window.storage || !window.collection || !window.onSnapshot || !window.orderBy || !getAuth || !onAuthStateChanged) { // Check for imported auth functions too
         console.error("Required Firebase functions not available.");
         alert("Error initializing page: Firebase services not fully available.");
         // Display a message in the table
         const colspan = productTableBody?.querySelector('tr th')?.parentElement?.children?.length || 10;
         if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="${colspan}" style="color: red; text-align: center;">Initialization Error: Firebase services not fully loaded.</td></tr>`;
         return;
     }
    console.log("Firebase services and Auth functions confirmed.");
    listenForOnlineProducts();
    setupEventListeners();
    console.log("Online Product Management Initialized (v_Bulk_Edit_UI_Logic_Fix2)."); // Updated version log
};

// --- START: Firebase Authentication State Listener (Handled within this file) ---
// Get the Firebase App instance from the globally exposed variable
const app = window.firebaseApp;
if (app) {
     const auth = getAuth(app); // Get Auth instance using the app
     onAuthStateChanged(auth, (user) => { // Use the imported onAuthStateChanged
         const page = window.location.pathname.split('/').pop() || 'index.html';
          if (!user && !page.toLowerCase().includes('login.html')) {
             window.location.replace('login.html');
         } else if (user) {
             console.log(`User logged in on ${page}. Triggering Online Product Management initialization.`);
             initializeOnlineProductManagement(); // Call initialization
         }
     });
} else {
     console.error("Firebase App instance not available on window. Cannot set up auth state listener.");
      // Display an error message if Firebase App is not available
      const colspan = productTableBody?.querySelector('tr th')?.parentElement?.children?.length || 10;
      if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="${colspan}" style="color: red; text-align: center;">Initialization Error: Firebase App not available.</td></tr>`;
}
// --- END: Firebase Authentication State Listener ---


// --- Setup Event Listeners ---
function setupEventListeners() {
    if (sortSelect) sortSelect.addEventListener('change', handleSortChange);
    if (filterSearchInput) filterSearchInput.addEventListener('input', handleSearchInput);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
    if (addNewProductBtn) addNewProductBtn.addEventListener('click', openAddModal);

    // Single Product Modal Listeners
    if (closeProductModalBtn) closeProductModalBtn.addEventListener('click', closeProductModal);
    if (cancelProductBtn) cancelProductBtn.addEventListener('click', closeProductModal);
    if (productModal) productModal.addEventListener('click', (event) => { if (event.target === productModal) closeProductModal(); });
    if (productForm) productForm.addEventListener('submit', handleSaveProduct);
    if (deleteProductBtn) deleteProductBtn.addEventListener('click', handleDeleteButtonClick);
    if (productImagesInput) productImagesInput.addEventListener('change', handleFileSelection);
    if (hasExtraChargesCheckbox) hasExtraChargesCheckbox.addEventListener('change', toggleExtraCharges); // Single edit
    if (productCategoryInput) productCategoryInput.addEventListener('input', toggleWeddingFields); // Single edit
    if (productUnitSelect) productUnitSelect.addEventListener('input', toggleSqFtFields); // Single edit
    if (priceTabsContainer) { // Single edit price tabs
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
    } else { console.error("Price tabs container (#priceTabsContainer) not found!"); } // Single edit
    if (currentRateInput) { currentRateInput.addEventListener('input', handleRateInputChange); } else { console.error("Current rate input (#currentRateInput) not found!"); } // Single edit
    if (productDiagramInput) { productDiagramInput.addEventListener('change', handleDiagramFileSelection); }
    if (removeDiagramBtn) { removeDiagramBtn.addEventListener('click', handleRemoveDiagram); }

    // Delete Confirmation Modal Listeners
    if (closeDeleteConfirmModalBtn) closeDeleteConfirmModalBtn.addEventListener('click', closeDeleteConfirmModal);
    if (cancelDeleteFinalBtn) cancelDeleteFinalBtn.addEventListener('click', closeDeleteConfirmModal);
    if (deleteConfirmModal) deleteConfirmModal.addEventListener('click', (event) => { if (event.target === deleteConfirmModal) closeDeleteConfirmModal(); });
    if (deleteConfirmCheckbox) deleteConfirmCheckbox.addEventListener('change', handleConfirmCheckboxChange);
    if (confirmDeleteFinalBtn) confirmDeleteFinalBtn.addEventListener('click', handleFinalDelete);


    // --- START: NEW Bulk Update Modal Event Listeners ---
    if(bulkEditButton) bulkEditButton.addEventListener('click', handleBulkEditClick); // Bulk edit button click

    // Close bulk update modal listeners
    if(closeBulkUpdateModalBtn) closeBulkUpdateModalBtn.addEventListener('click', closeBulkUpdateModal);
    if(cancelBulkUpdateBtn) cancelBulkUpdateBtn.addEventListener('click', closeBulkUpdateModal);
    if(bulkUpdateModal) bulkUpdateModal.addEventListener('click', (event) => { if (event.target === bulkUpdateModal) closeBulkUpdateModal(); });

    // Section checkbox listeners to show/hide fields
    for (const checkboxId in bulkSectionFieldContainers) {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
            checkbox.addEventListener('change', (event) => handleBulkSectionCheckboxChange(event.target));
        }
    }

    // Individual field checkbox listeners to enable/disable inputs
    for (const checkboxId in bulkFieldMap) {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
            checkbox.addEventListener('change', (event) => handleBulkFieldCheckboxChange(event.target));
        }
    }

    // Bulk Price Tabs listener
    if (bulkPriceTabsContainer) {
         bulkPriceTabsContainer.addEventListener('click', (event) => {
             const button = event.target.closest('.price-tab-btn');
             if (button) {
                 const rateType = button.dataset.rateType;
                 if (rateType) {
                     setBulkActiveRateTab(rateType);
                 }
             }
         });
     } else { console.error("Bulk Price tabs container (#bulkPriceTabsContainer) not found!"); }

    // Bulk Update Form Submission Listener (Placeholder)
    if(bulkUpdateForm) bulkUpdateForm.addEventListener('submit', handleBulkUpdate); // This function will be implemented later

    // --- END: NEW Bulk Update Modal Event Listeners ---


    console.log("Online Product Management event listeners set up (v_Bulk_Edit_UI_Logic_Fix2)."); // Updated version log
}

// NEW: Function to handle product checkbox change (already existed, but adding comment)
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

// NEW: Function to update the bulk actions UI (already existed, but adding comment)
function updateBulkActionsUI() {
    const count = selectedProductIds.size;
    if (selectedCountSpan) {
        selectedCountSpan.textContent = `${count} selected`;
    }

    if (bulkActionsContainer) {
        // Show bulk actions container if at least one item is selected
        bulkActionsContainer.style.display = count > 0 ? 'flex' : 'none';
    }

    // Enable/disable bulk edit button
    if (bulkEditButton) {
        bulkEditButton.disabled = count === 0;
         // If button is enabled, show it (it's initially hidden by default CSS)
         if (count > 0) {
              bulkEditButton.style.display = '';
         } else {
              bulkEditButton.style.display = 'none';
         }
    }
}


// --- Show/Hide Conditional Fields (Single Edit Modal) ---
function toggleWeddingFields() { if (!weddingFieldsContainer || !productCategoryInput) return; const category = productCategoryInput.value.toLowerCase(); weddingFieldsContainer.style.display = category.includes('wedding card') ? 'block' : 'none'; }
function toggleSqFtFields() { if (!productUnitSelect) return; const unitType = productUnitSelect.value; if (productMinOrderValueInput) { const parentGroup = productMinOrderValueInput.closest('.sq-feet-only'); if (parentGroup) parentGroup.style.display = unitType === 'Sq Feet' ? 'block' : 'none'; } }
function toggleExtraCharges() { if (!extraChargesSection || !hasExtraChargesCheckbox) return; extraChargesSection.style.display = hasExtraChargesCheckbox.checked ? 'block' : 'none'; }

// --- Sorting & Filtering Handlers ---
function handleSortChange() { if (!sortSelect) return; const [field, direction] = sortSelect.value.split('_'); if (field && direction) { if (field === currentSortField && direction === currentSortDirection) return; currentSortField = field; currentSortDirection = direction; listenForOnlineProducts(); /* Re-fetch with new sort */ } }
function handleSearchInput() { clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(applyFiltersAndRender, 300); }
function clearFilters() {
    if (filterSearchInput) filterSearchInput.value = '';
    if (sortSelect) sortSelect.value = 'createdAt_desc';
    currentSortField = 'createdAt';
    currentSortDirection = 'desc';
    // Clear selected products when filters are cleared
    selectedProductIds.clear();
    updateBulkActionsUI(); // Update UI after clearing selection
    applyFiltersAndRender();
    if (unsubscribeProducts) listenForOnlineProducts(); /* Re-fetch if listener was active */
}

// --- Firestore Listener ---
function listenForOnlineProducts() {
    if (unsubscribeProducts) { unsubscribeProducts(); unsubscribeProducts = null; }
    if (!window.db || !window.collection || !window.query || !window.onSnapshot || !window.orderBy) {
        console.error("Firestore functions unavailable!");
        let colspan = productTableBody?.querySelector('tr th')?.parentElement?.children?.length || 10;
        if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="${colspan}" style="color: red; text-align: center;">Error: DB Connection Failed.</td></tr>`;
        return;
    }
    let colspan = productTableBody?.querySelector('tr th')?.parentElement?.children?.length || 10;
    if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="${colspan}" id="loadingMessage" style="text-align: center;">Loading online products...</td></tr>`;
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
            let colspan = productTableBody?.querySelector('tr th')?.parentElement?.children?.length || 10;
            if (error.code === 'permission-denied') {
                if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="${colspan}" style="color: red; text-align: center;">Error loading products: Insufficient permissions. Check Firestore rules.</td></tr>`;
            } else {
                if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="${colspan}" style="color: red; text-align: center;">Error loading products. Check connection/console.</td></tr>`;
            }
        });
    } catch (error) {
        console.error("Error setting up online product listener:", error);
        let colspan = productTableBody?.querySelector('tr th')?.parentElement?.children?.length || 10;
        if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="${colspan}" style="color: red; text-align: center;">Error setting up listener.</td></tr>`;
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
             const itemCode = (product.itemCode || '').toLowerCase(); // Added itemCode for search
             const hsnSacCode = (product.hsnSacCode || '').toLowerCase(); // Added hsnSacCode for search
            if (!(name.includes(filterSearchValue) || category.includes(filterSearchValue) || brand.includes(filterSearchValue) || itemCode.includes(filterSearchValue) || hsnSacCode.includes(filterSearchValue))) { // Updated search filter
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
            const currentStock = (data.stock?.currentStock !== undefined && data.stock?.currentStock !== null) ? data.stock.currentStock : 'N/A';


            // Check if the product is currently selected for bulk edit
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

            // Add event listener to the checkbox in the newly created row
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
    // Update UI after rendering (in case products were filtered/sorted)
    updateBulkActionsUI();
}

// --- Pricing Tab Functions (Single Edit Modal) ---
function setActiveRateTab(rateType) {
    unlockPricingFields();
    if (!RATE_TYPES[rateType] || !priceTabsContainer || !currentRateInput || !currentRateLabel || !applyRateCheckboxesContainer) {
        console.error("Cannot set active rate tab - required elements missing for single edit.");
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


// --- Modal Handling (Add/Edit Single Product) ---
function openAddModal() {
    if (!productModal || !productForm) return;
    console.log("Opening modal to add new ONLINE product (v_Bulk_Edit_UI_Logic_Fix2)."); // Updated version log
    // Clear any selected products when opening add/edit modal
    selectedProductIds.clear();
    updateBulkActionsUI();

    if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-plus-circle success-icon"></i> Add New Online Product';
    if (editProductIdInput) editProductIdInput.value = '';
    productForm.reset();
    productBeingEditedData = { pricing: {}, stock: {} }; // Initialize with stock object

    if (isEnabledCheckbox) isEnabledCheckbox.checked = true;
    if (hasExtraChargesCheckbox) hasExtraChargesCheckbox.checked = false;
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

    // Reset Stock fields for Add Modal
    if (productCurrentStockInput) productCurrentStockInput.value = ''; // Or '0' if you prefer default
    if (productMinStockLevelInput) productMinStockLevelInput.value = '';

    setActiveRateTab('online'); // Ensure online tab is active for new product
    unlockPricingFields(); // Ensure pricing fields are unlocked for new product

    toggleWeddingFields(); toggleSqFtFields(); toggleExtraCharges();
    productModal.classList.add('active');
}

async function openEditModal(firestoreId, data) {
    if (!productModal || !productForm || !data) return;
    console.log("Opening modal to edit ONLINE product (v_Bulk_Edit_UI_Logic_Fix2):", firestoreId); // Updated version log
    // Clear any selected products when opening add/edit modal
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
    if (extraChargeNameInput) extraChargeNameInput.value = pricing.extraCharge?.name || '';
    if (extraChargeAmountInput) extraChargeAmountInput.value = pricing.extraCharge?.amount ?? '';

    if (productOptionsInput) { try { productOptionsInput.value = (data.options && Array.isArray(data.options)) ? JSON.stringify(data.options, null, 2) : ''; } catch { productOptionsInput.value = ''; } }
    if (productBrandInput) productBrandInput.value = data.brand || '';
    if (productItemCodeInput) productItemCodeInput.value = data.itemCode || '';
    if (productHsnSacCodeInput) productHsnSacCodeInput.value = data.hsnSacCode || '';

    // Load Stock fields for Edit Modal
    const stock = data.stock || {};
    if (productCurrentStockInput) productCurrentStockInput.value = stock.currentStock ?? '';
    if (productMinStockLevelInput) productMinStockLevelInput.value = stock.minStockLevel ?? '';

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

    // Determine which price tab should be active based on available data, default to online
    let initialRateType = 'online';
     if (pricing.rate !== undefined) initialRateType = 'online';
     else if (pricing.retailRate !== undefined) initialRateType = 'retail';
     else if (pricing.agentRate !== undefined) initialRateType = 'agent';
     else if (pricing.resellerRate !== undefined) initialRateType = 'reseller';
    setActiveRateTab(initialRateType); // Set active tab and load rate
    unlockPricingFields(); // Ensure pricing fields are unlocked for editing

    toggleWeddingFields(); toggleSqFtFields(); toggleExtraCharges();
    productModal.classList.add('active');
}

function closeProductModal() {
    if (productModal) {
        productModal.classList.remove('active');
        productToDeleteId = null; productToDeleteName = null;
        if (productImagesInput) productImagesInput.value = null;
        selectedFiles = []; imagesToDelete = [];
        productBeingEditedData = {};
        currentActiveRateType = 'online'; // Reset active rate type for single modal
        diagramFileToUpload = null; shouldRemoveDiagram = false;
        if (productDiagramInput) productDiagramInput.value = null;
        unlockPricingFields();
         // Clear selected products when closing add/edit modal
        selectedProductIds.clear();
        updateBulkActionsUI(); // Update UI after clearing selection
    }
}

// --- START: NEW Bulk Update Modal Handling ---

// Placeholder function for bulk edit button click
function handleBulkEditClick() {
    if (selectedProductIds.size === 0) {
        showToast("Please select at least one product for bulk edit.", 3000);
        return;
    }
    console.log("Bulk Edit clicked for IDs:", selectedProductIds);
    openBulkUpdateModal(); // Call the function to open the bulk edit modal
}

// Function to open the bulk update modal
function openBulkUpdateModal() {
    if (!bulkUpdateModal || !bulkUpdateForm) return;
    console.log(`Opening Bulk Update Modal for ${selectedProductIds.size} products.`);

    // Reset the form state
    bulkUpdateForm.reset();
    resetBulkFormState(); // Reset checkboxes and disabled fields

    // Set the default active price tab in bulk modal visually
    setBulkActiveRateTab('online');

    bulkUpdateModal.classList.add('active'); // Show the modal
}

// Function to close the bulk update modal
function closeBulkUpdateModal() {
    if (bulkUpdateModal) {
        bulkUpdateModal.classList.remove('active'); // Hide the modal
        // Optionally reset form state here as well, or let open handle it
         resetBulkFormState();
         // Keep selectedProductIds as is, the user might want to do another bulk action
         // If you want to clear selection on modal close, uncomment the next two lines:
         // selectedProductIds.clear();
         // updateBulkActionsUI();
    }
}

// Function to reset the state of the bulk update form (uncheck checkboxes, disable fields)
function resetBulkFormState() {
     // Reset section checkboxes and hide fields
     for (const checkboxId in bulkSectionFieldContainers) {
         const checkbox = document.getElementById(checkboxId);
         const fieldsContainer = bulkSectionFieldContainers[checkboxId];
         if (checkbox) checkbox.checked = false;
         if (fieldsContainer) fieldsContainer.style.display = 'none';
     }

     // Reset individual field checkboxes and disable fields
     for (const checkboxId in bulkFieldMap) {
         const checkbox = document.getElementById(checkboxId);
         const fieldInput = bulkFieldMap[checkboxId];
         if (checkbox) checkbox.checked = false;
         if (fieldInput) {
             fieldInput.disabled = true;
             // Also clear input values when resetting form
             if (fieldInput.type === 'checkbox' || fieldInput.tagName === 'SELECT') {
                  fieldInput.value = ''; // Reset select/checkbox state
             } else {
                  fieldInput.value = ''; // Clear text/number input
             }
         }
     }

     // Reset specific inputs that don't follow the checkbox pattern directly
     if (bulkIsEnabledSelect) {
          bulkIsEnabledSelect.disabled = true; // Controlled by bulkUpdateEnabledCheckbox
          bulkIsEnabledSelect.value = ''; // Clear value
     }
     if (bulkOptionsInput) {
          bulkOptionsInput.disabled = true; // Controlled by bulkUpdateOptionsCheckbox
          bulkOptionsInput.value = ''; // Clear value
     }
     if (bulkCurrentRateInput) {
          bulkCurrentRateInput.disabled = true; // Controlled by bulkUpdatePricingCheckbox
          bulkCurrentRateInput.value = ''; // Clear value
     }


     // Reset price tabs state in bulk modal - visually set active, input is controlled by checkbox
      setBulkActiveRateTab('online');

      // Hide spinner and reset button text
      const spinner = applyBulkUpdateBtn?.querySelector('.fa-spinner');
      const icon = applyBulkUpdateBtn?.querySelector('.fa-save');
      const text = applyBulkUpdateBtn?.querySelector('span');
      if (applyBulkUpdateBtn) applyBulkUpdateBtn.disabled = false;
      if (spinner) spinner.style.display = 'none';
      if (icon) icon.style.display = '';
      if (text) text.textContent = 'Apply Updates';
}


// Handle change on section checkboxes (show/hide fields, enable/disable inputs within section)
function handleBulkSectionCheckboxChange(checkbox) {
    // Get the container of fields controlled by this checkbox
    const fieldsContainer = bulkSectionFieldContainers[checkbox.id];

    if (!fieldsContainer) {
        console.error("Bulk fields container not found for section checkbox:", checkbox.id);
        return;
    }

    const inputs = fieldsContainer.querySelectorAll('input, select, textarea');

    if (checkbox.checked) {
        fieldsContainer.style.display = 'block'; // Show the fields

        // Enable inputs within this section that have an individual checkbox, or are directly controlled
        inputs.forEach(input => {
             // Find the corresponding individual checkbox if it exists for this input
             let individualCheckbox = null;
             // Iterate through bulkFieldMap to find the checkbox that points to this input
             for (const cbId in bulkFieldMap) {
                 if (bulkFieldMap[cbId] === input) {
                      individualCheckbox = document.getElementById(cbId);
                      break; // Found the checkbox, no need to continue loop
                 }
             }

            // Enable the input ONLY if there is NO individual checkbox controlling it (like bulkIsEnabledSelect, bulkOptionsInput, bulkCurrentRateInput), OR if there IS an individual checkbox AND it IS checked.
            if (!individualCheckbox) {
                 // This input is directly controlled by the section checkbox
                 input.disabled = false;
            } else {
                 // This input is controlled by its own checkbox
                 // Its disabled state depends only on its OWN checkbox,
                 // but the section checkbox controls its *visibility* via the container.
                 // We don't change the individual input's disabled state here,
                 // the handleBulkFieldCheckboxChange handles that when its own checkbox is clicked.
                 // However, if the section is checked, inputs with checked individual checkboxes should *now* become enabled.
                 if(individualCheckbox.checked) {
                     input.disabled = false;
                 } else {
                     input.disabled = true; // Keep disabled if individual checkbox is not checked
                 }
            }
        });

         // Special handling for specific inputs controlled directly by section checkbox
         if (checkbox.id === 'bulkUpdatePricingCheckbox' && bulkCurrentRateInput) { bulkCurrentRateInput.disabled = false; }
         if (checkbox.id === 'bulkUpdateOptionsCheckbox' && bulkOptionsInput) { bulkOptionsInput.disabled = false; }
         if (checkbox.id === 'bulkUpdateEnabledCheckbox' && bulkIsEnabledSelect) { bulkIsEnabledSelect.disabled = false; }


    } else { // Section checkbox is UNCHECKED
        fieldsContainer.style.display = 'none'; // Hide the fields

        // Disable all inputs within this section, regardless of individual checkbox state
        inputs.forEach(input => {
             input.disabled = true;
             // Clear the input value when it becomes disabled due to section being unchecked
             if (input.type === 'checkbox' || input.tagName === 'SELECT') {
                  input.value = ''; // Reset select/checkbox state
             } else {
                  input.value = ''; // Clear text/number input
             }
        });
    }
}

// Handle change on individual field checkboxes (enable/disable corresponding input)
function handleBulkFieldCheckboxChange(checkbox) {
    const fieldInput = bulkFieldMap[checkbox.id];

    if (!fieldInput) {
        console.error("Corresponding input field not found for checkbox:", checkbox.id);
        return;
    }

    // Find the parent section checkbox
    const sectionCheckbox = checkbox.closest('fieldset')?.querySelector('input[type="checkbox"][data-section]');
    const isSectionChecked = sectionCheckbox ? sectionCheckbox.checked : true; // Assume true if not in a section with a data-section checkbox

    // The input should be enabled ONLY if its individual checkbox IS checked AND its parent section (if applicable) IS checked
    if (checkbox.checked && isSectionChecked) {
        fieldInput.disabled = false;
    } else {
        fieldInput.disabled = true;
         // Clear the input value when it becomes disabled
         if (fieldInput.type === 'checkbox' || fieldInput.tagName === 'SELECT') {
              fieldInput.value = ''; // Reset select/checkbox state
         } else {
              fieldInput.value = ''; // Clear text/number input
         }
    }
}

// Function to set the active rate tab in the bulk update modal
function setBulkActiveRateTab(rateType) {
    if (!RATE_TYPES[rateType] || !bulkPriceTabsContainer || !bulkCurrentRateInput || !bulkCurrentRateLabel) {
        console.error("Cannot set active rate tab - required elements missing for bulk edit.");
        return;
    }
    currentBulkRateType = rateType; // Update the state variable for bulk modal
    bulkPriceTabsContainer.querySelectorAll('.price-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.rateType === rateType);
    });
    bulkCurrentRateLabel.textContent = `${RATE_TYPES[rateType].label}*:`;
    // Note: The input field value is NOT loaded from existing product data in bulk edit.
    // The input field (bulkCurrentRateInput) state (enabled/disabled) is controlled by the bulkUpdatePricingCheckbox.
}


// Placeholder function to handle bulk update form submission (Will be implemented in a later step)
async function handleBulkUpdate(event) {
    event.preventDefault();
    console.log("Bulk Update form submitted.");

    // Show loading spinner and disable button
    const spinner = applyBulkUpdateBtn?.querySelector('.fa-spinner');
    const icon = applyBulkUpdateBtn?.querySelector('.fa-save');
    const text = applyBulkUpdateBtn?.querySelector('span');
    if (applyBulkUpdateBtn) applyBulkUpdateBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
    if (icon) icon.style.display = 'none';
    if (text) text.textContent = 'Applying...';


    // TODO: Implement logic to collect data from the bulk update form
    // TODO: Validate the collected data
    // TODO: Prepare the update payload using selectedProductIds and the collected data
    // TODO: Call a new backend function to perform the WriteBatch update

    showToast("Bulk Update feature is not fully implemented yet. (Logic coming soon!)", 4000);

     // Simulating success/failure for now
     const success = Math.random() > 0.5; // Simulate success 50% of the time

     // --- Placeholder for actual update logic ---
     // try {
     //     // Example: await window.performBulkUpdate(Array.from(selectedProductIds), updatePayload);
     //     // Replace with actual call to your backend function
     //      success = true; // Set success based on actual operation result
     // } catch (error) {
     //      console.error("Bulk update failed:", error);
     //      showToast(`Bulk Update failed: ${error.message || 'Unknown error'}. Check console.`, 5000);
     //      success = false; // Indicate failure
     // }
     // --- End Placeholder ---


     setTimeout(() => { // Simulate network delay for placeholder
         if (success) {
             showToast("Simulated: Bulk Update successful!", 3000);
             closeBulkUpdateModal();
         } else {
              // Error message already shown in catch block above if using actual logic
              // If using simulation, show generic error
              if (text && text.textContent === 'Applying...') { // Avoid showing multiple errors
                   showToast("Simulated: Bulk Update failed. Check console.", 5000);
              }
         }

          // Re-enable the button and hide spinner
          if (applyBulkUpdateBtn) applyBulkUpdateBtn.disabled = false;
          if (spinner) spinner.style.display = 'none';
          if (icon) icon.style.display = '';
          if (text) text.textContent = 'Apply Updates';

     }, 1500); // Simulate delay


}

// --- END: NEW Bulk Update Modal Handling ---


// --- Image Handling (Single Edit Modal) ---
function handleFileSelection(event) { if (!imagePreviewArea || !productImagesInput) return; const files = Array.from(event.target.files); let currentImageCount = existingImageUrls.filter(url => !imagesToDelete.includes(url)).length + selectedFiles.length; const availableSlots = 4 - currentImageCount; if (files.length > availableSlots) { alert(`Max 4 images allowed. You have ${currentImageCount}, tried to add ${files.length}.`); productImagesInput.value = null; return; } files.forEach(file => { if (file.type.startsWith('image/')) { if (selectedFiles.length + existingImageUrls.filter(url => !imagesToDelete.includes(url)).length < 4) { selectedFiles.push(file); displayImagePreview(file, null); } } }); productImagesInput.value = null; }
function displayImagePreview(fileObject, existingUrl = null) { if (!imagePreviewArea) return; const previewId = existingUrl || `new-${fileObject.name}-${Date.now()}`; const previewWrapper = document.createElement('div'); previewWrapper.className = 'image-preview-item'; previewWrapper.setAttribute('data-preview-id', previewId); const img = document.createElement('img'); const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.className = 'remove-image-btn'; removeBtn.innerHTML = '&times;'; removeBtn.title = 'Remove image'; const progressBar = document.createElement('div'); progressBar.className = 'upload-progress-bar'; const progressFill = progressBar?.querySelector('div'); // Safely access querySelector
    if (progressBar) progressBar.style.display = 'none'; // Initially hidden
    if (existingUrl) { img.src = existingUrl; img.onerror = () => { img.src = 'images/placeholder.png'; }; previewWrapper.imageUrl = existingUrl; removeBtn.onclick = () => { if (!imagesToDelete.includes(existingUrl)) imagesToDelete.push(existingUrl); previewWrapper.style.display = 'none'; }; }
    else if (fileObject) { const reader = new FileReader(); reader.onload = (e) => { img.src = e.target.result; }; reader.readAsDataURL(fileObject); previewWrapper.fileData = fileObject; removeBtn.onclick = () => { selectedFiles = selectedFiles.filter(f => f !== fileObject); previewWrapper.remove(); }; }
    previewWrapper.appendChild(img); previewWrapper.appendChild(removeBtn); previewWrapper.appendChild(progressBar); imagePreviewArea.appendChild(previewWrapper);
}
async function uploadImage(file, productId, index) { if (!window.storage || !window.storageRef || !window.uploadBytesResumable || !window.getDownloadURL) throw new Error("Storage functions missing."); const previewWrapper = [...imagePreviewArea.querySelectorAll('.image-preview-item')].find(el => el.fileData === file); const progressBar = previewWrapper?.querySelector('.upload-progress-bar'); const progressFill = progressBar?.querySelector('div'); const timestamp = Date.now(); const uniqueFileName = `${timestamp}-image${index}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`; const filePath = `onlineProductImages/${productId}/${uniqueFileName}`; const fileRef = window.storageRef(window.storage, filePath); if (progressBar) progressBar.style.display = 'block'; if (progressFill) progressFill.style.width = '0%'; const uploadTask = window.uploadBytesResumable(fileRef, file); return new Promise((resolve, reject) => { uploadTask.on('state_changed', (snapshot) => { const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100; if (progressFill) progressFill.style.width = `${progress}%`; if (uploadProgressInfo) uploadProgressInfo.textContent = `Uploading ${file.name}: ${progress.toFixed(0)}%`; }, (error) => { if (progressBar) progressBar.style.backgroundColor = 'red'; if (uploadProgressInfo) uploadProgressInfo.textContent = `Upload failed: ${file.name}.`; reject(error); }, async () => { if (progressBar) progressBar.style.backgroundColor = 'var(--success-color)'; if (uploadProgressInfo) uploadProgressInfo.textContent = `Getting URL...`; try { const downloadURL = await window.getDownloadURL(uploadTask.snapshot.ref); resolve(downloadURL); } catch (error) { if (progressBar) progressBar.style.backgroundColor = 'red'; if (uploadProgressInfo) uploadProgressInfo.textContent = `Failed to get URL.`; reject(error); } }); }); }
async function deleteStoredImage(imageUrl) { if (!window.storage || !window.storageRef || !window.deleteObject) return; if (!imageUrl || !(imageUrl.startsWith('https://firebasestorage.googleapis.com/') || imageUrl.startsWith('gs://'))) return; try { const imageRef = window.storageRef(window.storage, imageUrl); await window.deleteObject(imageRef); console.log("Deleted image from Storage:", imageUrl); } catch (error) { if (error.code === 'storage/object-not-found') console.warn("Image not found:", imageUrl); else console.error("Error deleting image:", imageUrl, error); } }

// --- Diagram File Handling (Single Edit Modal) ---
function handleDiagramFileSelection(event) { const file = event.target.files[0]; if (file) { const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']; if (!allowedTypes.includes(file.type)) { showToast("Invalid diagram file type. Please use PDF, PNG, JPG, or WEBP.", 4000); event.target.value = null; diagramFileToUpload = null; return; } diagramFileToUpload = file; shouldRemoveDiagram = false; if(diagramUploadProgress) diagramUploadProgress.textContent = `Selected: ${file.name}`; if(diagramLinkArea) diagramLinkArea.style.display = 'none'; } else { diagramFileToUpload = null; if(diagramUploadProgress) diagramUploadProgress.textContent = ''; } }
function handleRemoveDiagram() { if (!existingDiagramUrlInput?.value) { showToast("No diagram currently saved to remove.", 3000); return; } if (confirm("Are you sure you want to remove the current diagram? This will delete the file permanently when you save.")) { shouldRemoveDiagram = true; diagramFileToUpload = null; if(productDiagramInput) productDiagramInput.value = null; if(diagramLinkArea) diagramLinkArea.style.display = 'none'; if(diagramUploadProgress) diagramUploadProgress.textContent = 'Diagram marked for removal.'; showToast("Diagram marked for removal. Click Save Product to confirm.", 4000); } }
async function uploadFile(file, storagePath, progressElement) { if (!window.storage || !window.storageRef || !window.uploadBytesResumable || !window.getDownloadURL) throw new Error("Storage functions missing."); if (!file || !storagePath || !progressElement) throw new Error("Missing file, path, or progress element for upload."); const fileRef = window.storageRef(window.storage, storagePath); progressElement.textContent = 'Starting upload...'; progressElement.style.color = 'var(--text-color-medium)'; const uploadTask = window.uploadBytesResumable(fileRef, file); return new Promise((resolve, reject) => { uploadTask.on('state_changed', (snapshot) => { const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100; progressElement.textContent = `Uploading ${file.name}: ${progress.toFixed(0)}%`; }, (error) => { progressElement.textContent = `Upload failed: ${file.name}. ${error.code}`; progressElement.style.color = 'var(--danger-color)'; reject(error); }, async () => { progressElement.textContent = `Upload Complete. Getting URL...`; try { const downloadURL = await window.getDownloadURL(uploadTask.snapshot.ref); progressElement.textContent = `Diagram uploaded successfully.`; progressElement.style.color = 'var(--success-color)'; resolve(downloadURL); } catch (getUrlError) { progressElement.textContent = `Failed to get URL after upload.`; progressElement.style.color = 'var(--danger-color)'; reject(getUrlError); } }); }); }
async function deleteStoredFile(fileUrl) { if (!window.storage || !window.storageRef || !window.deleteObject) { return; } if (!fileUrl || !(fileUrl.startsWith('https://firebasestorage.googleapis.com/') || fileUrl.startsWith('gs://'))) { return; } try { const fileRef = window.storageRef(window.storage, fileUrl); await window.deleteObject(fileRef); console.log("Deleted file from Storage:", fileUrl); } catch (error) { if (error.code === 'storage/object-not-found') { console.warn("File not found in Storage, skipping delete:", fileUrl); } else { console.error("Error deleting file:", fileUrl, error); } } }


// --- handleSaveProduct Function (Single Product) ---
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

    // Get Stock Data
    const currentStock = parseNumericInput(productCurrentStockInput?.value, true, true); // true for allowZero, true for isInteger
    const minStockLevel = parseNumericInput(productMinStockLevelInput?.value, true, true); // true for allowZero, true for isInteger

    if (isNaN(currentStock) && productCurrentStockInput?.value.trim() !== '') { // Check if NaN but not empty
        showToast("Please enter a valid whole number for Current Stock.", 5000);
        if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product';
        return;
    }
    if (isNaN(minStockLevel) && productMinStockLevelInput?.value.trim() !== '') { // Check if NaN but not empty
        showToast("Please enter a valid whole number for Minimum Stock Level.", 5000);
        if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product';
        return;
    }

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
        stock: { ...(productBeingEditedData?.stock || {}) } // Initialize with stock object
    };
    if (!isEditing) { productData.createdAt = window.serverTimestamp(); productData.imageUrls = []; productData.diagramUrl = null; }

    // Add Stock data to productData
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
    if (productData.stock && Object.keys(productData.stock).length === 0) {
        delete productData.stock;
    }


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
        await window.updateDoc(finalProductRef, finalUpdatePayload); // Changed from setDoc to updateDoc for new products to avoid overwriting if ID existed

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
function handleDeleteButtonClick(event) { event.preventDefault(); if (!productToDeleteId || !productToDeleteName) return; if (deleteWarningMessage) deleteWarningMessage.innerHTML = `Are you sure you want to delete "<strong>${escapeHtml(productToDeleteName)}</strong>"? <br>This will also delete its images and diagram. This action cannot be undone.`; if(deleteConfirmCheckbox) deleteConfirmCheckbox.checked = false; if(confirmDeleteFinalBtn) confirmDeleteFinalBtn.disabled = true; if(deleteConfirmModal) deleteConfirmModal.classList.add('active'); }
function closeDeleteConfirmModal() { if (deleteConfirmModal) { deleteConfirmModal.classList.remove('active'); } }
function handleConfirmCheckboxChange() { if (deleteConfirmCheckbox && confirmDeleteFinalBtn) { confirmDeleteFinalBtn.disabled = !deleteConfirmCheckbox.checked; } }
async function handleFinalDelete() { if (!deleteConfirmCheckbox?.checked || !productToDeleteId) return; if (!window.db || !window.doc || !window.getDoc || !window.deleteDoc || !window.storage || !window.storageRef || !window.deleteObject) { showToast("Core Firebase functions unavailable.", 5000); return; } if(confirmDeleteFinalBtn) { confirmDeleteFinalBtn.disabled = true; confirmDeleteFinalBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...'; } const productRef = window.doc(window.db, "onlineProducts", productToDeleteId); try { const productSnap = await window.getDoc(productRef); let deletePromises = []; if (productSnap.exists()) { const productData = productSnap.data(); if (productData.imageUrls && Array.isArray(productData.imageUrls) && productData.imageUrls.length > 0) { productData.imageUrls.forEach(url => deleteStoredImage(url)); } if (productData.diagramUrl) { deletePromises.push(deleteStoredFile(productData.diagramUrl)); } if (deletePromises.length > 0) { await Promise.allSettled(deletePromises); } } await window.deleteDoc(productRef); showToast(`Product "${productToDeleteName || ''}" and associated files deleted!`); closeDeleteConfirmModal(); closeProductModal(); } catch (error) { console.error(`Error during deletion process for ${productToDeleteId}:`, error); showToast(`Failed to fully delete product: ${error.message}`, 5000); } finally { if(confirmDeleteFinalBtn) { confirmDeleteFinalBtn.disabled = !deleteConfirmCheckbox?.checked; confirmDeleteFinalBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Confirm Delete'; } } }


// --- END ---