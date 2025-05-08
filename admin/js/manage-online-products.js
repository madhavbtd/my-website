// js/manage-online-products.js
// Updated Version: Stock Management + DIAGNOSTIC CONSOLE LOGS for Upload

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
const productNameInput = document.getElementById('productName');
const productCategoryInput = document.getElementById('productCategory');
const productUnitSelect = document.getElementById('productUnit');
const productDescInput = document.getElementById('productDescription');
const isEnabledCheckbox = document.getElementById('isEnabled');
const productImagesInput = document.getElementById('productImages');
const imagePreviewArea = document.getElementById('image-preview-area');
const uploadProgressInfo = document.getElementById('upload-progress-info');
const existingImageUrlsInput = document.getElementById('existingImageUrls');
const productPurchasePriceInput = document.getElementById('productPurchasePrice');
const productGstRateInput = document.getElementById('productGstRate');
const priceTabsContainer = document.getElementById('priceTabsContainer');
const currentRateInput = document.getElementById('currentRateInput');
const currentRateLabel = document.getElementById('currentRateLabel');
const applyRateCheckboxesContainer = document.getElementById('applyRateCheckboxesContainer');
const productMinOrderValueInput = document.getElementById('productMinOrderValue');
const productMrpInput = document.getElementById('productMrp');
const weddingFieldsContainer = document.getElementById('wedding-card-fields');
const designChargeInput = document.getElementById('designCharge');
const printingChargeInput = document.getElementById('printingCharge');
const transportChargeInput = document.getElementById('transportCharge');
const extraMarginPercentInput = document.getElementById('extraMarginPercent');
const productBrandInput = document.getElementById('productBrand');
const productItemCodeInput = document.getElementById('productItemCode');
const productHsnSacCodeInput = document.getElementById('productHsnSacCode');
const productCurrentStockInput = document.getElementById('productCurrentStock');
const productMinStockLevelInput = document.getElementById('productMinStockLevel');
const productOptionsInput = document.getElementById('productOptions');
const productDiagramInput = document.getElementById('productDiagram');
const diagramLinkArea = document.getElementById('diagram-link-area');
const viewDiagramLink = document.getElementById('viewDiagramLink');
const removeDiagramBtn = document.getElementById('removeDiagramBtn');
const diagramUploadProgress = document.getElementById('diagram-upload-progress');
const existingDiagramUrlInput = document.getElementById('existingDiagramUrl');
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
let selectedFiles = [];
let imagesToDelete = [];
let existingImageUrls = [];
let productBeingEditedData = {};
let currentActiveRateType = 'online';
const RATE_TYPES = {
    online: { field: 'rate', label: 'Online Customer Rate' },
    retail: { field: 'retailRate', label: 'Retail Shop Rate' },
    agent: { field: 'agentRate', label: 'Agent/Branch Rate' },
    reseller: { field: 'resellerRate', label: 'Reseller/Wholesale Rate' }
};
let diagramFileToUpload = null;
let shouldRemoveDiagram = false;
let isRateLocked = false;


// --- Helper Functions ---
function formatCurrency(amount) { const num = Number(amount); return isNaN(num) || num === null || num === undefined ? '-' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { unsafe = String(unsafe || ''); } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function parseNumericInput(value, allowZero = true, isInteger = false) {
    if (value === undefined || value === null) return null;
    const trimmedValue = String(value).trim();
    if (trimmedValue === '') return null;
    const num = isInteger ? parseInt(trimmedValue, 10) : parseFloat(trimmedValue);
    if (isNaN(num) || (!allowZero && num <= 0) || (allowZero && num < 0)) { return NaN; }
    if (isInteger && !Number.isInteger(num)) { return NaN; }
    return num;
}
function formatFirestoreTimestamp(timestamp) { if (!timestamp || typeof timestamp.toDate !== 'function') { return '-'; } try { const date = timestamp.toDate(); const options = { day: '2-digit', month: 'short', year: 'numeric' }; return date.toLocaleDateString('en-GB', options).replace(/ /g, '-'); } catch (e) { console.error("Error formatting timestamp:", e); return '-'; } }

// --- Toast Notification ---
function showToast(message, duration = 3500) { const existingToast = document.querySelector('.toast-notification'); if (existingToast) { existingToast.remove(); } const toast = document.createElement('div'); toast.className = 'toast-notification'; toast.textContent = message; document.body.appendChild(toast); setTimeout(() => toast.classList.add('show'), 10); setTimeout(() => { toast.classList.remove('show'); setTimeout(() => { if (toast.parentNode) { toast.parentNode.removeChild(toast); } }, 400); }, duration); console.log("Toast:", message); }

// --- Initialization ---
window.initializeOnlineProductManagement = () => {
    console.log("DIAG: Online Product Management Initializing (v_Stock_DiagLogs)...");
    if (!window.db || !window.auth || !window.storage) { console.error("DIAG: Firebase services not available."); alert("Error initializing page."); return; }
    console.log("DIAG: Firebase services confirmed.");
    listenForOnlineProducts();
    setupEventListeners();
    console.log("DIAG: Online Product Management Initialized (v_Stock_DiagLogs).");
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
    if (priceTabsContainer) priceTabsContainer.addEventListener('click', (event) => { const button = event.target.closest('.price-tab-btn'); if (button && (!isRateLocked || button.classList.contains('active'))) { const rateType = button.dataset.rateType; if (rateType && rateType !== currentActiveRateType) { setActiveRateTab(rateType); } } else if (button && isRateLocked && !button.classList.contains('active')) { showToast("Uncheck 'Apply to all' checkboxes below to change rate type.", 3000); } });
    if (currentRateInput) currentRateInput.addEventListener('input', handleRateInputChange);
    if (productDiagramInput) productDiagramInput.addEventListener('change', handleDiagramFileSelection);
    if (removeDiagramBtn) removeDiagramBtn.addEventListener('click', handleRemoveDiagram);
    console.log("DIAG: Online Product Management event listeners set up.");
}

// --- Show/Hide Conditional Fields ---
function toggleWeddingFields() { if (!weddingFieldsContainer || !productCategoryInput) return; const category = productCategoryInput.value.toLowerCase(); weddingFieldsContainer.style.display = category.includes('wedding card') ? 'block' : 'none'; }
function toggleSqFtFields() { if (!productUnitSelect) return; const unitType = productUnitSelect.value; if (productMinOrderValueInput) { const parentGroup = productMinOrderValueInput.closest('.sq-feet-only'); if (parentGroup) parentGroup.style.display = unitType === 'Sq Feet' ? 'block' : 'none'; } }
function toggleExtraCharges() { if (!extraChargesSection || !hasExtraChargesCheckbox) return; extraChargesSection.style.display = hasExtraChargesCheckbox.checked ? 'block' : 'none'; }

// --- Sorting & Filtering Handlers ---
function handleSortChange() { if (!sortSelect) return; const [field, direction] = sortSelect.value.split('_'); if (field && direction) { if (field === currentSortField && direction === currentSortDirection) return; currentSortField = field; currentSortDirection = direction; listenForOnlineProducts(); } }
function handleSearchInput() { clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(applyFiltersAndRender, 300); }
function clearFilters() { if (filterSearchInput) filterSearchInput.value = ''; if (sortSelect) sortSelect.value = 'createdAt_desc'; currentSortField = 'createdAt'; currentSortDirection = 'desc'; applyFiltersAndRender(); if (unsubscribeProducts) listenForOnlineProducts(); }

// --- Firestore Listener ---
function listenForOnlineProducts() {
    if (unsubscribeProducts) { unsubscribeProducts(); unsubscribeProducts = null; }
    if (!window.db) { console.error("DIAG: Firestore (window.db) not available in listenForOnlineProducts!"); if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="9" style="color: red; text-align: center;">Error: DB Connection Failed.</td></tr>`; return; }
    console.log(`DIAG: Setting up Firestore listener for 'onlineProducts' with sort: ${currentSortField}_${currentSortDirection}`);
    const productsRef = window.collection(window.db, "onlineProducts");
    const q = window.query(productsRef, window.orderBy(currentSortField || 'createdAt', currentSortDirection || 'desc'));
    unsubscribeProducts = window.onSnapshot(q, (snapshot) => {
        console.log(`DIAG: Received ${snapshot.docs.length} online products.`);
        allProductsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        applyFiltersAndRender();
    }, (error) => {
        console.error("DIAG: Error fetching online products snapshot:", error);
        if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="9" style="color: red; text-align: center;">Error loading products. Code: ${error.code}</td></tr>`;
    });
}

// --- Filter, Sort, Render ---
function applyFiltersAndRender() {
    if (!allProductsCache) { console.warn("DIAG: allProductsCache is null in applyFiltersAndRender."); return; }
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';
    let filteredProducts = allProductsCache.filter(product => {
        if (!product || !product.productName) return false;
        if (filterSearchValue) {
            const name = (product.productName || '').toLowerCase();
            const category = (product.category || '').toLowerCase();
            const brand = (product.brand || '').toLowerCase();
            return name.includes(filterSearchValue) || category.includes(filterSearchValue) || brand.includes(filterSearchValue);
        }
        return true;
    });
    renderProductTable(filteredProducts);
}

// --- Table Rendering Function ---
function renderProductTable(products) {
    if (!productTableBody) { console.error("DIAG: productTableBody not found in renderProductTable."); return; }
    productTableBody.innerHTML = '';
    const expectedColumns = 9;
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
            tableRow.innerHTML = `<td>${escapeHtml(name)}</td><td>${escapeHtml(category)}</td><td>${escapeHtml(brand)}</td><td style="text-align: right;">${rate}</td><td style="text-align: center;">${escapeHtml(unit)}</td><td style="text-align: center;">${enabled}</td><td style="text-align: center;">${dateAdded}</td><td style="text-align: right;">${escapeHtml(currentStock)}</td><td style="text-align: center;"><button class="button edit-product-btn" title="Edit Online Product"><i class="fas fa-edit"></i> Edit</button><button class="button delete-product-btn" title="Delete Online Product"><i class="fas fa-trash"></i> Delete</button></td>`;
            tableRow.querySelector('.edit-product-btn').addEventListener('click', (e) => { e.stopPropagation(); openEditModal(firestoreId, data); });
            tableRow.querySelector('.delete-product-btn').addEventListener('click', (e) => { e.stopPropagation(); productToDeleteId = firestoreId; productToDeleteName = data.productName || 'this product'; if(deleteWarningMessage) deleteWarningMessage.innerHTML = `Are you sure you want to delete "<strong>${escapeHtml(productToDeleteName)}</strong>"? This action cannot be undone.`; if(deleteConfirmCheckbox) deleteConfirmCheckbox.checked = false; if(confirmDeleteFinalBtn) confirmDeleteFinalBtn.disabled = true; if(deleteConfirmModal) deleteConfirmModal.classList.add('active'); });
        });
    }
}

// --- Pricing Tab Functions ---
function setActiveRateTab(rateType) { unlockPricingFields(); if (!RATE_TYPES[rateType] || !priceTabsContainer || !currentRateInput || !currentRateLabel || !applyRateCheckboxesContainer) return; currentActiveRateType = rateType; priceTabsContainer.querySelectorAll('.price-tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.rateType === rateType)); currentRateLabel.textContent = `${RATE_TYPES[rateType].label}*:`; currentRateInput.value = productBeingEditedData?.pricing?.[RATE_TYPES[rateType].field] ?? ''; currentRateInput.dataset.currentRateType = rateType; updateApplyRateCheckboxes(rateType); }
function updateApplyRateCheckboxes(activeType) { if (!applyRateCheckboxesContainer) return; applyRateCheckboxesContainer.innerHTML = ''; const containerTitle = document.createElement('label'); containerTitle.className = 'checkbox-container-title'; containerTitle.textContent = `Apply ${RATE_TYPES[activeType]?.label || 'Current'} Rate to:`; applyRateCheckboxesContainer.appendChild(containerTitle); Object.keys(RATE_TYPES).forEach(typeKey => { if (typeKey !== activeType) { const otherTypeInfo = RATE_TYPES[typeKey]; const checkboxId = `applyRateTo_${typeKey}`; const wrapper = document.createElement('div'); wrapper.className = 'checkbox-wrapper apply-rate-checkbox'; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = checkboxId; checkbox.name = 'applyRateTo'; checkbox.value = typeKey; checkbox.addEventListener('change', handleApplyRateCheckboxChange); const label = document.createElement('label'); label.htmlFor = checkboxId; label.textContent = otherTypeInfo.label; wrapper.appendChild(checkbox); wrapper.appendChild(label); applyRateCheckboxesContainer.appendChild(wrapper); } }); checkAndApplyLockState(); }
function handleApplyRateCheckboxChange() { checkAndApplyLockState(); }
function handleRateInputChange() { if (!currentRateInput.disabled) { resetApplyCheckboxesAndUnlock(); } }
function checkAndApplyLockState() { const checkboxes = applyRateCheckboxesContainer?.querySelectorAll('input[name="applyRateTo"]') ?? []; const checkedCheckboxes = applyRateCheckboxesContainer?.querySelectorAll('input[name="applyRateTo"]:checked') ?? []; if (checkboxes.length > 0 && checkedCheckboxes.length === checkboxes.length) { applyRateToAllOthers(); lockPricingFields(); } else { unlockPricingFields(); } }
function applyRateToAllOthers() { if (!currentRateInput || !productBeingEditedData.pricing) return; const currentRateValue = parseNumericInput(currentRateInput.value); if (currentRateValue !== null && !isNaN(currentRateValue)) { Object.keys(RATE_TYPES).forEach(typeKey => { if (typeKey !== currentActiveRateType) { productBeingEditedData.pricing[RATE_TYPES[typeKey].field] = currentRateValue; } }); } }
function lockPricingFields() { if (!currentRateInput || !applyRateCheckboxesContainer || !priceTabsContainer) return; isRateLocked = true; currentRateInput.disabled = true; applyRateCheckboxesContainer.querySelectorAll('input[name="applyRateTo"]').forEach(cb => cb.disabled = true); priceTabsContainer.querySelectorAll('.price-tab-btn').forEach(btn => { if (btn.dataset.rateType !== currentActiveRateType) { btn.disabled = true; } }); }
function unlockPricingFields() { if (!currentRateInput || !applyRateCheckboxesContainer || !priceTabsContainer) return; isRateLocked = false; currentRateInput.disabled = false; applyRateCheckboxesContainer.querySelectorAll('input[name="applyRateTo"]').forEach(cb => cb.disabled = false); priceTabsContainer.querySelectorAll('.price-tab-btn').forEach(btn => { btn.disabled = false; }); }
function resetApplyCheckboxesAndUnlock() { if (!applyRateCheckboxesContainer) return; applyRateCheckboxesContainer.querySelectorAll('input[name="applyRateTo"]:checked').forEach(cb => cb.checked = false); unlockPricingFields(); }

// --- Modal Handling (Add/Edit) ---
function openAddModal() {
    if (!productModal || !productForm) return;
    console.log("DIAG: Opening ADD modal.");
    if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-plus-circle success-icon"></i> Add New Online Product';
    if (editProductIdInput) editProductIdInput.value = '';
    productForm.reset();
    productBeingEditedData = { pricing: {}, stock: {} };
    if (isEnabledCheckbox) isEnabledCheckbox.checked = true;
    existingImageUrls = []; selectedFiles = []; imagesToDelete = [];
    if (imagePreviewArea) imagePreviewArea.innerHTML = '';
    if (uploadProgressInfo) uploadProgressInfo.textContent = '';
    if (productCurrentStockInput) productCurrentStockInput.value = '';
    if (productMinStockLevelInput) productMinStockLevelInput.value = '';
    diagramFileToUpload = null; shouldRemoveDiagram = false;
    if(productDiagramInput) productDiagramInput.value = null;
    if(diagramLinkArea) diagramLinkArea.style.display = 'none';
    if(saveProductBtn) { saveProductBtn.disabled = false; saveText.textContent = 'Save Product'; saveSpinner.style.display = 'none'; saveIcon.style.display = '';}
    if (deleteProductBtn) deleteProductBtn.style.display = 'none';
    setActiveRateTab('online'); unlockPricingFields();
    toggleWeddingFields(); toggleSqFtFields(); toggleExtraCharges();
    productModal.classList.add('active');
}

async function openEditModal(firestoreId, data) {
    if (!productModal || !productForm || !data) return;
    console.log("DIAG: Opening EDIT modal for product ID:", firestoreId, "Data:", data);
    if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-edit info-icon"></i> Edit Online Product';
    productForm.reset();
    productBeingEditedData = JSON.parse(JSON.stringify(data));
    if (!productBeingEditedData.pricing) productBeingEditedData.pricing = {};
    if (!productBeingEditedData.stock) productBeingEditedData.stock = {};
    if (editProductIdInput) editProductIdInput.value = firestoreId;
    if (productNameInput) productNameInput.value = data.productName || '';
    if (productCategoryInput) productCategoryInput.value = data.category || '';
    if (productUnitSelect) productUnitSelect.value = data.unit || 'Qty';
    if (productDescInput) productDescInput.value = data.description || '';
    if (isEnabledCheckbox) isEnabledCheckbox.checked = data.isEnabled !== undefined ? data.isEnabled : true;
    const pricing = data.pricing || {};
    if (productPurchasePriceInput) productPurchasePriceInput.value = pricing.purchasePrice ?? '';
    if (productMrpInput) productMrpInput.value = pricing.mrp ?? '';
    if (productGstRateInput) productGstRateInput.value = pricing.gstRate ?? '';
    const stock = data.stock || {};
    if (productCurrentStockInput) productCurrentStockInput.value = stock.currentStock ?? '';
    if (productMinStockLevelInput) productMinStockLevelInput.value = stock.minStockLevel ?? '';
    selectedFiles = []; imagesToDelete = [];
    if (imagePreviewArea) imagePreviewArea.innerHTML = '';
    existingImageUrls = data.imageUrls || [];
    if (existingImageUrlsInput) existingImageUrlsInput.value = JSON.stringify(existingImageUrls);
    existingImageUrls.forEach(url => displayImagePreview(null, url));
    diagramFileToUpload = null; shouldRemoveDiagram = false;
    const currentDiagramUrl = data.diagramUrl || '';
    if(productDiagramInput) productDiagramInput.value = null;
    if(existingDiagramUrlInput) existingDiagramUrlInput.value = currentDiagramUrl;
    if (diagramLinkArea && viewDiagramLink) { if (currentDiagramUrl) { viewDiagramLink.href = currentDiagramUrl; diagramLinkArea.style.display = 'block'; } else { diagramLinkArea.style.display = 'none'; } }
    if(saveProductBtn) { saveProductBtn.disabled = false; saveText.textContent = 'Update Product'; saveSpinner.style.display = 'none'; saveIcon.style.display = '';}
    if (deleteProductBtn) deleteProductBtn.style.display = 'inline-flex';
    productToDeleteId = firestoreId; productToDeleteName = data.productName || 'this product';
    setActiveRateTab('online'); unlockPricingFields();
    toggleWeddingFields(); toggleSqFtFields(); toggleExtraCharges();
    productModal.classList.add('active');
}

function closeProductModal() { if (productModal) { productModal.classList.remove('active'); productToDeleteId = null; productToDeleteName = null; if (productImagesInput) productImagesInput.value = null; selectedFiles = []; imagesToDelete = []; productBeingEditedData = {}; currentActiveRateType = 'online'; diagramFileToUpload = null; shouldRemoveDiagram = false; if (productDiagramInput) productDiagramInput.value = null; unlockPricingFields(); } }

// --- Image Handling ---
function handleFileSelection(event) { console.log("DIAG: handleFileSelection triggered."); if (!imagePreviewArea || !productImagesInput) return; const files = Array.from(event.target.files); console.log("DIAG: Files selected for image upload:", files); let currentImageCount = existingImageUrls.filter(url => !imagesToDelete.includes(url)).length + selectedFiles.length; const availableSlots = 4 - currentImageCount; if (files.length > availableSlots) { alert(`Max 4 images allowed. You have ${currentImageCount}, tried to add ${files.length}.`); productImagesInput.value = null; return; } files.forEach(file => { if (file.type.startsWith('image/')) { if (selectedFiles.length + existingImageUrls.filter(url => !imagesToDelete.includes(url)).length < 4) { selectedFiles.push(file); displayImagePreview(file, null); } } }); productImagesInput.value = null; }
function displayImagePreview(fileObject, existingUrl = null) { if (!imagePreviewArea) return; const previewId = existingUrl || `new-${fileObject.name}-${Date.now()}`; const previewWrapper = document.createElement('div'); previewWrapper.className = 'image-preview-item'; previewWrapper.setAttribute('data-preview-id', previewId); const img = document.createElement('img'); const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.className = 'remove-image-btn'; removeBtn.innerHTML = '&times;'; removeBtn.title = 'Remove image'; if (existingUrl) { img.src = existingUrl; previewWrapper.imageUrl = existingUrl; removeBtn.onclick = () => { if (!imagesToDelete.includes(existingUrl)) imagesToDelete.push(existingUrl); previewWrapper.style.display = 'none'; console.log("DIAG: Marked existing image for deletion:", existingUrl); }; } else if (fileObject) { const reader = new FileReader(); reader.onload = (e) => { img.src = e.target.result; }; reader.readAsDataURL(fileObject); previewWrapper.fileData = fileObject; removeBtn.onclick = () => { selectedFiles = selectedFiles.filter(f => f !== fileObject); previewWrapper.remove(); console.log("DIAG: Removed new file from selection:", fileObject.name); }; } previewWrapper.appendChild(img); previewWrapper.appendChild(removeBtn); imagePreviewArea.appendChild(previewWrapper); }
async function uploadImage(file, productId, index) {
    console.log(`DIAG: uploadImage called for productId: ${productId}, file:`, file, `index: ${index}`);
    if (!window.storage || !window.storageRef || !window.uploadBytesResumable || !window.getDownloadURL) { console.error("DIAG: Firebase Storage functions missing in uploadImage."); throw new Error("Storage functions missing."); }
    if (!productId) { console.error("DIAG: productId is undefined in uploadImage."); throw new Error("Product ID is undefined for image upload.");}
    const timestamp = Date.now(); const uniqueFileName = `${timestamp}-image${index}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const filePath = `onlineProductImages/${productId}/${uniqueFileName}`;
    console.log("DIAG: Image filePath:", filePath);
    const fileRef = window.storageRef(window.storage, filePath);
    if (uploadProgressInfo) uploadProgressInfo.textContent = `Uploading ${file.name}: 0%`;
    const uploadTask = window.uploadBytesResumable(fileRef, file);
    return new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
            (snapshot) => { const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100; if (uploadProgressInfo) uploadProgressInfo.textContent = `Uploading ${file.name}: ${progress.toFixed(0)}%`;},
            (error) => { console.error(`DIAG: Upload failed for ${filePath}:`, error); if (uploadProgressInfo) uploadProgressInfo.textContent = `Upload failed: ${file.name}.`; reject(error); },
            async () => { if (uploadProgressInfo) uploadProgressInfo.textContent = `Getting URL for ${file.name}...`; try { const downloadURL = await window.getDownloadURL(uploadTask.snapshot.ref); console.log(`DIAG: Image ${filePath} uploaded successfully. URL: ${downloadURL}`); resolve(downloadURL); } catch (error) { console.error(`DIAG: Failed to get download URL for ${filePath}:`, error); if (uploadProgressInfo) uploadProgressInfo.textContent = `Failed to get URL for ${file.name}.`; reject(error); } }
        );
    });
}
async function deleteStoredImage(imageUrl) { console.log("DIAG: Attempting to delete stored image:", imageUrl); if (!window.storage || !window.storageRef || !window.deleteObject) return; if (!imageUrl || !(imageUrl.startsWith('https://firebasestorage.googleapis.com/') || imageUrl.startsWith('gs://'))) return; try { const imageRef = window.storageRef(window.storage, imageUrl); await window.deleteObject(imageRef); console.log("DIAG: Deleted image from Storage:", imageUrl); } catch (error) { if (error.code === 'storage/object-not-found') console.warn("DIAG: Image not found for deletion:", imageUrl); else console.error("DIAG: Error deleting image:", imageUrl, error); } }

// --- Diagram File Handling ---
function handleDiagramFileSelection(event) { console.log("DIAG: handleDiagramFileSelection triggered."); const file = event.target.files[0]; console.log("DIAG: File selected for diagram upload:", file); if (file) { const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']; if (!allowedTypes.includes(file.type)) { showToast("Invalid diagram file type. Please use PDF, PNG, JPG, or WEBP.", 4000); event.target.value = null; diagramFileToUpload = null; return; } diagramFileToUpload = file; shouldRemoveDiagram = false; if(diagramUploadProgress) diagramUploadProgress.textContent = `Selected: ${file.name}`; if(diagramLinkArea) diagramLinkArea.style.display = 'none'; } else { diagramFileToUpload = null; if(diagramUploadProgress) diagramUploadProgress.textContent = ''; } }
function handleRemoveDiagram() { console.log("DIAG: handleRemoveDiagram called."); if (!existingDiagramUrlInput?.value) { showToast("No diagram currently saved to remove.", 3000); return; } if (confirm("Are you sure you want to remove the current diagram? This will delete the file permanently when you save.")) { shouldRemoveDiagram = true; diagramFileToUpload = null; if(productDiagramInput) productDiagramInput.value = null; if(diagramLinkArea) diagramLinkArea.style.display = 'none'; if(diagramUploadProgress) diagramUploadProgress.textContent = 'Diagram marked for removal.'; showToast("Diagram marked for removal. Click Save Product to confirm.", 4000); } }
async function uploadFile(file, storagePath, progressElement) {
    console.log(`DIAG: uploadFile called for path: ${storagePath}, file:`, file);
    if (!window.storage || !window.storageRef || !window.uploadBytesResumable || !window.getDownloadURL) { console.error("DIAG: Firebase Storage functions missing in uploadFile."); throw new Error("Storage functions missing.");}
    if (!storagePath.includes('/undefined/')) { // Basic check if productId was undefined in path
         // No specific check for productID here as this is a generic uploader, but path construction should ensure it.
    } else {
        console.error("DIAG: storagePath for uploadFile seems to contain 'undefined'. Path:", storagePath);
        throw new Error("Storage path is invalid due to undefined Product ID.");
    }
    const fileRef = window.storageRef(window.storage, storagePath);
    progressElement.textContent = 'Starting upload...';
    const uploadTask = window.uploadBytesResumable(fileRef, file);
    return new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
            (snapshot) => { const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100; progressElement.textContent = `Uploading ${file.name}: ${progress.toFixed(0)}%`; },
            (error) => { console.error(`DIAG: Upload failed for ${storagePath}:`, error); progressElement.textContent = `Upload failed: ${file.name}. ${error.code || error.message}`; progressElement.style.color = 'var(--danger-color)'; reject(error); },
            async () => { progressElement.textContent = `Upload Complete. Getting URL for ${file.name}...`; try { const downloadURL = await window.getDownloadURL(uploadTask.snapshot.ref); console.log(`DIAG: File ${storagePath} uploaded successfully. URL: ${downloadURL}`); progressElement.textContent = `Diagram uploaded successfully.`; progressElement.style.color = 'var(--success-color)'; resolve(downloadURL); } catch (getUrlError) { console.error(`DIAG: Error getting download URL for ${storagePath}:`, getUrlError); progressElement.textContent = `Failed to get URL after upload.`; progressElement.style.color = 'var(--danger-color)'; reject(getUrlError); } }
        );
    });
}
async function deleteStoredFile(fileUrl) { console.log("DIAG: Attempting to delete stored file:", fileUrl); if (!window.storage || !window.storageRef || !window.deleteObject) return; if (!fileUrl || !(fileUrl.startsWith('https://firebasestorage.googleapis.com/') || fileUrl.startsWith('gs://'))) return; try { const fileRef = window.storageRef(window.storage, fileUrl); await window.deleteObject(fileRef); console.log("DIAG: Deleted file from Storage:", fileUrl); } catch (error) { if (error.code === 'storage/object-not-found') console.warn("DIAG: File not found for deletion:", fileUrl); else console.error("DIAG: Error deleting file:", fileUrl, error); } }

// --- handleSaveProduct Function ---
async function handleSaveProduct(event) {
    event.preventDefault();
    console.log("DIAG: handleSaveProduct triggered.");
    if (!window.db || !window.collection || !window.addDoc || !window.doc || !window.updateDoc || !window.serverTimestamp || !window.storage) { console.error("DIAG: Core Firebase functions unavailable in handleSaveProduct."); showToast("Core Firebase functions unavailable.", 5000); return; }
    if (saveProductBtn) saveProductBtn.disabled = true; if (saveSpinner) saveSpinner.style.display = 'inline-block'; if (saveIcon) saveIcon.style.display = 'none'; if (saveText) saveText.textContent = 'Saving...';

    const editingProductId = editProductIdInput?.value;
    const isEditing = !!editingProductId;
    let finalProductId = editingProductId; // Will be updated for new products
    console.log(`DIAG: isEditing: ${isEditing}, editingProductId: ${editingProductId}`);

    const productName = productNameInput?.value.trim();
    const category = productCategoryInput?.value.trim();
    const unit = productUnitSelect?.value || null;
    if (!productName || !category || !unit) {
        showToast("Product Name, Category, and Unit are required.", 5000);
        if (saveProductBtn) {saveProductBtn.disabled = false; saveSpinner.style.display = 'none'; saveIcon.style.display = ''; saveText.textContent = isEditing ? 'Update Product' : 'Save Product';}
        return;
    }

    const currentStock = parseNumericInput(productCurrentStockInput?.value, true, true);
    const minStockLevel = parseNumericInput(productMinStockLevelInput?.value, true, true);
    if (isNaN(currentStock) && productCurrentStockInput?.value.trim() !== '') { showToast("Please enter a valid whole number for Current Stock.", 5000); if (saveProductBtn) {saveProductBtn.disabled = false; saveSpinner.style.display = 'none'; saveIcon.style.display = ''; saveText.textContent = isEditing ? 'Update Product' : 'Save Product';} return; }
    if (isNaN(minStockLevel) && productMinStockLevelInput?.value.trim() !== '') { showToast("Please enter a valid whole number for Minimum Stock Level.", 5000); if (saveProductBtn) {saveProductBtn.disabled = false; saveSpinner.style.display = 'none'; saveIcon.style.display = ''; saveText.textContent = isEditing ? 'Update Product' : 'Save Product';} return; }

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
        stock: { ...(productBeingEditedData?.stock || {}) }
    };
    if (!isEditing) { productData.createdAt = window.serverTimestamp(); productData.imageUrls = []; productData.diagramUrl = null; }
    if (currentStock !== null && !isNaN(currentStock)) { productData.stock.currentStock = currentStock; } else if (isEditing && productBeingEditedData?.stock?.hasOwnProperty('currentStock')) { productData.stock.currentStock = null; }
    if (minStockLevel !== null && !isNaN(minStockLevel)) { productData.stock.minStockLevel = minStockLevel; } else if (isEditing && productBeingEditedData?.stock?.hasOwnProperty('minStockLevel')) { productData.stock.minStockLevel = null; }
    if (Object.keys(productData.stock).length === 0 && productData.stock.constructor === Object) { delete productData.stock; }

    // ... (pricing and options data setup remains same) ...
    const currentRateValue = parseNumericInput(currentRateInput?.value);
    // ... (rest of pricing and options validation and setup)

    productData.diagramUrl = isEditing ? (productBeingEditedData?.diagramUrl || null) : null;
    console.log("DIAG: Initial productData (before file ops):", JSON.parse(JSON.stringify(productData)));

    try {
        // === Step 0: Get Product ID ===
        if (!isEditing) {
            console.log("DIAG: Creating new product entry in Firestore (preliminary).");
            const preliminaryData = { ...productData };
            delete preliminaryData.imageUrls; delete preliminaryData.diagramUrl; // These are handled after ID
            if(preliminaryData.stock && Object.keys(preliminaryData.stock).length === 0) delete preliminaryData.stock;

            const docRef = await window.addDoc(window.collection(window.db, "onlineProducts"), preliminaryData);
            finalProductId = docRef.id;
            console.log("DIAG: New product Firestore entry CREATED. finalProductId:", finalProductId);
            productData.id = finalProductId; // For internal consistency if needed later
        } else {
            finalProductId = editingProductId; // Already set
            console.log("DIAG: Editing existing product. finalProductId:", finalProductId);
        }

        if (!finalProductId) {
            console.error("DIAG: CRITICAL - finalProductId is UNDEFINED or NULL before file operations. Aborting.");
            throw new Error("Could not establish Product ID for file operations.");
        }
        console.log("DIAG: finalProductId to be used for uploads:", finalProductId);


        // === Step 1: Handle Diagram File ===
        let newDiagramUrl = productData.diagramUrl; // Start with existing or null
        const existingDiagramUrlFromData = isEditing ? (productBeingEditedData?.diagramUrl || null) : null;
        console.log("DIAG: Diagram - shouldRemoveDiagram:", shouldRemoveDiagram, "diagramFileToUpload:", diagramFileToUpload, "existingDiagramUrlFromData:", existingDiagramUrlFromData);

        if (shouldRemoveDiagram && existingDiagramUrlFromData) {
            console.log("DIAG: Attempting to remove existing diagram from storage.");
            await deleteStoredFile(existingDiagramUrlFromData);
            newDiagramUrl = null;
        } else if (diagramFileToUpload) {
            console.log("DIAG: New diagram file selected for upload.");
            if (isEditing && existingDiagramUrlFromData) {
                console.log("DIAG: Deleting old diagram before uploading new one.");
                await deleteStoredFile(existingDiagramUrlFromData);
            }
            const diagramFileName = `diagram-${Date.now()}-${diagramFileToUpload.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const diagramPath = `productDiagrams/${finalProductId}/${diagramFileName}`;
            console.log("DIAG: Diagram upload path:", diagramPath);
            newDiagramUrl = await uploadFile(diagramFileToUpload, diagramPath, diagramUploadProgress);
            console.log("DIAG: Diagram upload complete. New URL:", newDiagramUrl);
        }
        productData.diagramUrl = newDiagramUrl; // Update productData with new/null URL

        // === Step 2: Handle Product Images ===
        let uploadedImageUrls = [];
        let currentExistingUrls = isEditing ? (productBeingEditedData?.imageUrls || []) : [];
        console.log("DIAG: Images - imagesToDelete:", imagesToDelete, "selectedFiles:", selectedFiles.length, "currentExistingUrls:", currentExistingUrls);

        if (isEditing && imagesToDelete.length > 0) {
            console.log("DIAG: Deleting marked images from storage.");
            const deletePromises = imagesToDelete.map(url => deleteStoredImage(url));
            await Promise.allSettled(deletePromises);
            currentExistingUrls = currentExistingUrls.filter(url => !imagesToDelete.includes(url));
        }
        if (selectedFiles.length > 0) {
            console.log("DIAG: Uploading new selected images.");
            const uploadPromises = selectedFiles.map((file, index) => {
                 console.log(`DIAG: Preparing to upload image ${index} for productId: ${finalProductId}`);
                 return uploadImage(file, finalProductId, index);
            });
            const uploadResults = await Promise.allSettled(uploadPromises);
            uploadResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    uploadedImageUrls.push(result.value);
                    console.log(`DIAG: Image ${index} uploaded successfully: ${result.value}`);
                } else {
                    console.error(`DIAG: Image ${index} upload FAILED:`, result.reason);
                }
            });
            if (uploadedImageUrls.length !== selectedFiles.length) {
                showToast("Some images failed to upload. Check console.", 5000);
            }
        }

        // === Step 3: Final Firestore Update ===
        const finalImageUrls = [...currentExistingUrls, ...uploadedImageUrls];
        const finalUpdatePayload = {
             ...productData,
             imageUrls: finalImageUrls,
             updatedAt: window.serverTimestamp() // Ensure updatedAt is always fresh
        };
        // For new products, createdAt was in preliminaryData. For edits, don't include it.
        if (isEditing) { delete finalUpdatePayload.createdAt; delete finalUpdatePayload.id; }
        else { delete finalUpdatePayload.id; /* ID is not part of doc content */ }


        console.log("DIAG: Finalizing product data in Firestore. Product ID:", finalProductId, "Payload:", JSON.parse(JSON.stringify(finalUpdatePayload)));
        const finalProductRef = window.doc(window.db, "onlineProducts", finalProductId);
        await window.updateDoc(finalProductRef, finalUpdatePayload); // Use updateDoc for both new (after preliminary add) and existing

        showToast(isEditing ? 'Product updated successfully!' : 'Product added successfully!', 3000);
        closeProductModal();

    } catch (error) {
        console.error("DIAG: CRITICAL ERROR in handleSaveProduct:", error);
        showToast(`Error saving product: ${error.message || 'Unknown error'}. Check console for DIAG logs.`, 6000);
         if (!isEditing && finalProductId && error.message !== "Could not establish Product ID for file operations.") {
             console.warn("DIAG: Attempting to cleanup partially created product entry:", finalProductId);
             try { await window.deleteDoc(window.doc(window.db, "onlineProducts", finalProductId)); console.log("DIAG: Partial product entry cleanup successful."); }
             catch (cleanupError) { console.error("DIAG: Failed to cleanup partial product entry:", cleanupError); }
         }
    } finally {
        console.log("DIAG: handleSaveProduct finally block. Re-enabling save button.");
        if (saveProductBtn) {saveProductBtn.disabled = false; saveSpinner.style.display = 'none'; saveIcon.style.display = ''; saveText.textContent = isEditing ? 'Update Product' : 'Save Product';}
        if (uploadProgressInfo) setTimeout(() => { if (uploadProgressInfo) uploadProgressInfo.textContent = ''; }, 3000);
        if (diagramUploadProgress) setTimeout(() => { if (diagramUploadProgress) diagramUploadProgress.textContent = ''; }, 3000);
    }
}

// --- Delete Handling ---
function handleDeleteButtonClick(event) { event.preventDefault(); if (!productToDeleteId || !productToDeleteName) return; if (deleteWarningMessage) deleteWarningMessage.innerHTML = `Are you sure you want to delete "<strong>${escapeHtml(productToDeleteName)}</strong>"? <br>This will also delete its images and diagram. This action cannot be undone.`; if(deleteConfirmCheckbox) deleteConfirmCheckbox.checked = false; if(confirmDeleteFinalBtn) confirmDeleteFinalBtn.disabled = true; if(deleteConfirmModal) deleteConfirmModal.classList.add('active'); }
function closeDeleteConfirmModal() { if (deleteConfirmModal) { deleteConfirmModal.classList.remove('active'); } }
function handleConfirmCheckboxChange() { if (deleteConfirmCheckbox && confirmDeleteFinalBtn) { confirmDeleteFinalBtn.disabled = !deleteConfirmCheckbox.checked; } }
async function handleFinalDelete() { if (!deleteConfirmCheckbox?.checked || !productToDeleteId) return; if (!window.db || !window.doc || !window.getDoc || !window.deleteDoc || !window.storage || !window.storageRef || !window.deleteObject) { showToast("Core Firebase functions unavailable.", 5000); return; } if(confirmDeleteFinalBtn) { confirmDeleteFinalBtn.disabled = true; confirmDeleteFinalBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...'; } const productRef = window.doc(window.db, "onlineProducts", productToDeleteId); try { const productSnap = await window.getDoc(productRef); let deletePromises = []; if (productSnap.exists()) { const productData = productSnap.data(); if (productData.imageUrls && Array.isArray(productData.imageUrls) && productData.imageUrls.length > 0) { productData.imageUrls.forEach(url => deletePromises.push(deleteStoredImage(url))); } if (productData.diagramUrl) { deletePromises.push(deleteStoredFile(productData.diagramUrl)); } if (deletePromises.length > 0) { await Promise.allSettled(deletePromises); } } await window.deleteDoc(productRef); showToast(`Product "${productToDeleteName || ''}" and associated files deleted!`); closeDeleteConfirmModal(); closeProductModal(); } catch (error) { console.error(`Error during deletion process for ${productToDeleteId}:`, error); showToast(`Failed to fully delete product: ${error.message}`, 5000); } finally { if(confirmDeleteFinalBtn) { confirmDeleteFinalBtn.disabled = !deleteConfirmCheckbox?.checked; confirmDeleteFinalBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Confirm Delete'; } } }

// --- END ---