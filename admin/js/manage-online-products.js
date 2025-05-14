// js/manage-online-products.js
 // Updated Version: Layout changes + Diagram Upload + Checkbox Lock/Unlock Logic + Fixes + STOCK MANAGEMENT
 
 // --- Firebase Function Availability Check ---
 // Expecting: window.db, window.auth, window.storage, window.collection, window.onSnapshot, etc.
 
 // --- DOM Elements ---
 const productTableBody = document.getElementById('productTableBody');
 const loadingRow = document.getElementById('loadingMessage');
 const sortSelect = document.getElementById('sort-products');
 const filterSearchInput = document.getElementById('filterSearch');
 const clearFiltersBtn = document.getElementById('clearFiltersBtn');
 const addNewProductBtn = document.getElementById('addNewProductBtn');
 
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
 
 // --- Batch Update State ---
 let selectedProductIds = [];
 const selectAllProductsCheckbox = document.getElementById('selectAllProducts');
 const openBatchUpdateModalBtn = document.getElementById('openBatchUpdateModalBtn');
 const batchUpdateModal = document.getElementById('batchUpdateModal');
 const closeBatchUpdateModalBtn = document.getElementById('closeBatchUpdateModal');
 const cancelBatchUpdateBtn = document.getElementById('cancelBatchUpdateBtn');
 const saveBatchUpdateBtn = document.getElementById('saveBatchUpdateBtn');
 const batchUpdateForm = document.getElementById('batchUpdateForm');
 const batchWeddingCardFields = document.getElementById('batch-wedding-card-fields');
 const batchHasExtraChargesCheckbox = document.getElementById('batchHasExtraCharges');
 const batchExtraChargesSection = document.getElementById('batch-extra-charges-section');
 const batchPurchasePrice = document.getElementById('batchPurchasePrice');
 const batchGstRate = document.getElementById('batchGstRate');
 const batchDesignCharge = document.getElementById('batchDesignCharge');
 const batchPrintingCharge = document.getElementById('batchPrintingCharge');
 const batchTransportCharge = document.getElementById('batchTransportCharge');
 const batchExtraMarginPercent = document.getElementById('batchExtraMarginPercent');
 const batchExtraChargeName = document.getElementById('batchExtraChargeName');
 const batchExtraChargeAmount = document.getElementById('batchExtraChargeAmount');
 
 
 // --- Helper Functions ---
 function formatCurrency(amount) {
     const num = Number(amount);
     return isNaN(num) || num === null || num === undefined ? '-' : `₹ ${num.toLocaleString('en-IN', {
         minimumFractionDigits: 2,
         maximumFractionDigits: 2
     })}`;
 }
 
 function escapeHtml(unsafe) {
     if (typeof unsafe !== 'string') {
         unsafe = String(unsafe || '');
     }
     return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
 }
 
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
 
 function formatFirestoreTimestamp(timestamp) {
     if (!timestamp || typeof timestamp.toDate !== 'function') {
         return '-';
     }
     try {
         const date = timestamp.toDate();
         const options = {
             day: '2-digit',
             month: 'short',
             year: 'numeric'
         };
         return date.toLocaleDateString('en-GB', options).replace(/ /g, '-');
     } catch (e) {
         console.error("Error formatting timestamp:", e);
         return '-';
     }
 }
 
 // --- Toast Notification ---
 function showToast(message, duration = 3500) {
     const existingToast = document.querySelector('.toast-notification');
     if (existingToast) {
         existingToast.remove();
     }
     const toast = document.createElement('div');
     toast.className = 'toast-notification';
     toast.textContent = message;
     document.body.appendChild(toast);
     setTimeout(() => toast.classList.add('show'), 10);
     setTimeout(() => {
         toast.classList.remove('show');
         setTimeout(() => {
             if (toast.parentNode) {
                 toast.parentNode.removeChild(toast);
             }
         }, 400);
     }, duration);
     console.log("Toast:", message);
 }
 
 // --- Initialization ---
 window.initializeOnlineProductManagement = () => {
     console.log("Online Product Management Initializing (v_Stock)...");
     if (!window.db || !window.auth || !window.storage) {
         console.error("Firebase services not available.");
         alert("Error initializing page.");
         return;
     }
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
     if (productModal) productModal.addEventListener('click', (event) => {
         if (event.target === productModal) closeProductModal();
     });
     if (productForm) productForm.addEventListener('submit', handleSaveProduct);
     if (deleteProductBtn) deleteProductBtn.addEventListener('click', handleDeleteButtonClick);
     if (closeDeleteConfirmModalBtn) closeDeleteConfirmModalBtn.addEventListener('click', closeDeleteConfirmModal);
     if (cancelDeleteFinalBtn) cancelDeleteFinalBtn.addEventListener('click', closeDeleteConfirmModal);
     if (deleteConfirmModal) deleteConfirmModal.addEventListener('click', (event) => {
         if (event.target === deleteConfirmModal) closeDeleteConfirmModal();
     });
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
     } else {
         console.error("Price tabs container (#priceTabsContainer) not found!");
     }
 
     if (currentRateInput) {
         currentRateInput.addEventListener('input', handleRateInputChange);
     } else {
         console.error("Current rate input (#currentRateInput) not found!");
     }
 
     if (productDiagramInput) {
         productDiagramInput.addEventListener('change', handleDiagramFileSelection);
     }
     if (removeDiagramBtn) {
         removeDiagramBtn.addEventListener('click', handleRemoveDiagram);
     }
 
     // Batch Update Listeners
     if (selectAllProductsCheckbox) selectAllProductsCheckbox.addEventListener('change', handleSelectAllProducts);
     if (openBatchUpdateModalBtn) openBatchUpdateModalBtn.addEventListener('click', openBatchUpdateModal);
     if (closeBatchUpdateModalBtn) closeBatchUpdateModalBtn.addEventListener('click', closeBatchUpdateModal);
     if (cancelBatchUpdateBtn) cancelBatchUpdateBtn.addEventListener('click', closeBatchUpdateModal);
     if (saveBatchUpdateBtn) saveBatchUpdateBtn.addEventListener('click', handleBatchUpdate);
     if (batchHasExtraChargesCheckbox) batchHasExtraChargesCheckbox.addEventListener('change', toggleBatchExtraCharges);
     if (productCategoryInput) productCategoryInput.addEventListener('input', toggleWeddingFields);
 
     console.log("Online Product Management event listeners set up (v_Stock).");
 }
 
 // --- Show/Hide Conditional Fields ---
 function toggleWeddingFields() {
     if (!weddingFieldsContainer || !productCategoryInput) return;
     const category = productCategoryInput.value.toLowerCase();
     weddingFieldsContainer.style.display = category.includes('wedding card') ? 'block' : 'none';
     if (batchWeddingCardFields) {
         batchWeddingCardFields.style.display = category.includes('wedding card') ? 'block' : 'none';
     }
 }
 
 function toggleSqFtFields() {
     if (!productUnitSelect) return;
     const unitType = productUnitSelect.value;
     if (productMinOrderValueInput) {
         const parentGroup = productMinOrderValueInput.closest('.sq-feet-only');
         if (parentGroup) parentGroup.style.display = unitType === 'Sq Feet' ? 'block' : 'none';
     }
 }
 
 function toggleExtraCharges() {
     if (!extraChargesSection || !hasExtraChargesCheckbox) return;
     extraChargesSection.style.display = hasExtraChargesCheckbox.checked ? 'block' : 'none';
 }
 
 function toggleBatchExtraCharges() {
     if (!batchExtraChargesSection || !batchHasExtraChargesCheckbox) return;
     batchExtraChargesSection.style.display = batchHasExtraChargesCheckbox.checked ? 'block' : 'none';
 }
 
 // --- Sorting & Filtering Handlers ---
 function handleSortChange() {
     if (!sortSelect) return;
     const [field, direction] = sortSelect.value.split('_');
     if (field && direction) {
         if (field === currentSortField && direction === currentSortDirection) return;
         currentSortField = field;
         currentSortDirection = direction;
         listenForOnlineProducts();
         /* Re-fetch with new sort */
     }
 }
 
 function handleSearchInput() {
     clearTimeout(searchDebounceTimer);
     searchDebounceTimer = setTimeout(applyFiltersAndRender, 300);
 }
 
 function clearFilters() {
     if (filterSearchInput) filterSearchInput.value = '';
     if (sortSelect) sortSelect.value = 'createdAt_desc';
     currentSortField = 'createdAt';
     currentSortDirection = 'desc';
     applyFiltersAndRender();
     if (unsubscribeProducts) listenForOnlineProducts();
     /* Re-fetch if listener was active */
 }
 
 // --- Firestore Listener ---
 function listenForOnlineProducts() {
     if (unsubscribeProducts) {
         unsubscribeProducts();
         unsubscribeProducts = null;
     }
     if (!window.db || !window.collection || !window.query || !window.onSnapshot || !window.orderBy) {
         console.error("Firestore functions unavailable!");
         if (productTableBody) productTableBody.innerHTML =
             `<tr><td colspan="9" style="color: red; text-align: center;">Error: DB Connection Failed.</td></tr>`; // Colspan updated to 9
         return;
     }
     if (productTable