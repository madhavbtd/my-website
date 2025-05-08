// js/manage-online-products.js
// Updated Version: Price layout changes + Diagram Upload + Tabbed Rates + Fixes

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
const productPurchasePriceInput = document.getElementById('productPurchasePrice'); // Moved to top
const productGstRateInput = document.getElementById('productGstRate');       // Moved to top
const priceTabsContainer = document.getElementById('priceTabsContainer');
const currentRateInput = document.getElementById('currentRateInput');
const currentRateLabel = document.getElementById('currentRateLabel');
const applyRateCheckboxesContainer = document.getElementById('applyRateCheckboxesContainer'); // Below currentRateInput
const productMinOrderValueInput = document.getElementById('productMinOrderValue');
const productMrpInput = document.getElementById('productMrp');
// Wedding Fields
const weddingFieldsContainer = document.getElementById('wedding-card-fields');
const designChargeInput = document.getElementById('designCharge');
const printingChargeInput = document.getElementById('printingCharge');
const transportChargeInput = document.getElementById('transportCharge');
const extraMarginPercentInput = document.getElementById('extraMarginPercent');
// Extra Charges
const hasExtraChargesCheckbox = document.getElementById('hasExtraCharges');
const extraChargesSection = document.getElementById('extra-charges-section');
const extraChargeNameInput = document.getElementById('extraChargeName');
const extraChargeAmountInput = document.getElementById('extraChargeAmount');

// Column 3 (Internal, Options, Diagram)
const productBrandInput = document.getElementById('productBrand');
const productItemCodeInput = document.getElementById('productItemCode');
const productHsnSacCodeInput = document.getElementById('productHsnSacCode');
const productOptionsInput = document.getElementById('productOptions'); // Moved below Internal
// NEW Diagram Elements
const productDiagramInput = document.getElementById('productDiagram');
const diagramLinkArea = document.getElementById('diagram-link-area');
const viewDiagramLink = document.getElementById('viewDiagramLink');
const removeDiagramBtn = document.getElementById('removeDiagramBtn');
const diagramUploadProgress = document.getElementById('diagram-upload-progress');
const existingDiagramUrlInput = document.getElementById('existingDiagramUrl');


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


// --- Helper Functions ---
function formatCurrency(amount) { const num = Number(amount); return isNaN(num) || num === null || num === undefined ? '-' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { unsafe = String(unsafe || ''); } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function parseNumericInput(value, allowZero = true) { if (value === undefined || value === null) return null; const trimmedValue = String(value).trim(); if (trimmedValue === '') return null; const num = parseFloat(trimmedValue); if (isNaN(num) || (!allowZero && num <= 0) || (allowZero && num < 0)) { return NaN; } return num; }
function formatFirestoreTimestamp(timestamp) { if (!timestamp || typeof timestamp.toDate !== 'function') { return '-'; } try { const date = timestamp.toDate(); const options = { day: '2-digit', month: 'short', year: 'numeric' }; return date.toLocaleDateString('en-GB', options).replace(/ /g, '-'); } catch (e) { console.error("Error formatting timestamp:", e); return '-'; } }

// --- Toast Notification ---
function showToast(message, duration = 3500) { const existingToast = document.querySelector('.toast-notification'); if (existingToast) { existingToast.remove(); } const toast = document.createElement('div'); toast.className = 'toast-notification'; toast.textContent = message; document.body.appendChild(toast); setTimeout(() => toast.classList.add('show'), 10); setTimeout(() => { toast.classList.remove('show'); setTimeout(() => { if (toast.parentNode) { toast.parentNode.removeChild(toast); } }, 400); }, duration); console.log("Toast:", message); }

// --- Initialization ---
window.initializeOnlineProductManagement = () => {
    console.log("Online Product Management Initializing (v_Layout_Diagram)...");
    if (!window.db || !window.auth || !window.storage) { console.error("Firebase services not available."); alert("Error initializing page."); return; }
    console.log("Firebase services confirmed.");
    listenForOnlineProducts();
    setupEventListeners();
    console.log("Online Product Management Initialized (v_Layout_Diagram).");
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

    // Image & Conditional Fields
    if (productImagesInput) productImagesInput.addEventListener('change', handleFileSelection);
    if (hasExtraChargesCheckbox) hasExtraChargesCheckbox.addEventListener('change', toggleExtraCharges);
    if (productCategoryInput) productCategoryInput.addEventListener('input', toggleWeddingFields);
    if (productUnitSelect) productUnitSelect.addEventListener('input', toggleSqFtFields);

    // --- Price Tabs Listener ---
    if (priceTabsContainer) {
        priceTabsContainer.addEventListener('click', (event) => {
            const button = event.target.closest('.price-tab-btn');
            if (button && !button.classList.contains('active')) {
                const rateType = button.dataset.rateType;
                if (rateType) setActiveRateTab(rateType);
            }
        });
        console.log("Price tab click listener attached.");
    } else { console.error("Price tabs container (#priceTabsContainer) not found!"); }

    // --- NEW: Diagram Upload/Remove Listeners ---
    if (productDiagramInput) {
        productDiagramInput.addEventListener('change', handleDiagramFileSelection);
    } else { console.error("Diagram input (#productDiagram) not found!"); }

    if (removeDiagramBtn) {
        removeDiagramBtn.addEventListener('click', handleRemoveDiagram);
    } else { console.error("Remove diagram button (#removeDiagramBtn) not found!"); }
    // --- END Diagram Listeners ---

    console.log("Online Product Management event listeners set up (v_Layout_Diagram).");
}

// --- Show/Hide Conditional Fields ---
function toggleWeddingFields() { if (!weddingFieldsContainer || !productCategoryInput) return; const category = productCategoryInput.value.toLowerCase(); weddingFieldsContainer.style.display = category.includes('wedding card') ? 'block' : 'none'; }
function toggleSqFtFields() { if (!productUnitSelect) return; const unitType = productUnitSelect.value; if (productMinOrderValueInput) { const parentGroup = productMinOrderValueInput.closest('.sq-feet-only'); if (parentGroup) parentGroup.style.display = unitType === 'Sq Feet' ? 'block' : 'none'; } else { console.warn("Min Order Value input not found for toggleSqFtFields."); } }
function toggleExtraCharges() { if (!extraChargesSection || !hasExtraChargesCheckbox) return; extraChargesSection.style.display = hasExtraChargesCheckbox.checked ? 'block' : 'none'; }

// --- Sorting & Filtering Handlers ---
function handleSortChange() { if (!sortSelect) return; const [field, direction] = sortSelect.value.split('_'); if (field && direction) { if (field === currentSortField && direction === currentSortDirection) return; currentSortField = field; currentSortDirection = direction; applyFiltersAndRender(); } }
function handleSearchInput() { clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(applyFiltersAndRender, 300); }
function clearFilters() { if (filterSearchInput) filterSearchInput.value = ''; if (sortSelect) sortSelect.value = 'createdAt_desc'; currentSortField = 'createdAt'; currentSortDirection = 'desc'; applyFiltersAndRender(); }

// --- Firestore Listener ---
function listenForOnlineProducts() { /* ... (unchanged) ... */ if (unsubscribeProducts) { unsubscribeProducts(); unsubscribeProducts = null; } if (!window.db || !window.collection || !window.query || !window.onSnapshot || !window.orderBy) { console.error("Firestore functions unavailable!"); if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Error: DB Connection Failed.</td></tr>`; return; } if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="8" id="loadingMessage" style="text-align: center;">Loading online products...</td></tr>`; try { console.log(`Setting up Firestore listener for 'onlineProducts' with sort: ${currentSortField}_${currentSortDirection}`); const productsRef = window.collection(window.db, "onlineProducts"); const q = window.query(productsRef, window.orderBy(currentSortField || 'createdAt', currentSortDirection || 'desc')); unsubscribeProducts = window.onSnapshot(q, (snapshot) => { console.log(`Received ${snapshot.docs.length} online products.`); allProductsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); applyFiltersAndRender(); }, (error) => { console.error("Error fetching online products snapshot:", error); if (error.code === 'permission-denied') { if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Error loading products: Insufficient permissions. Check Firestore rules.</td></tr>`; } else { if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Error loading products. Check connection/console.</td></tr>`; } }); } catch (error) { console.error("Error setting up online product listener:", error); if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Error setting up listener.</td></tr>`; } }

// --- Filter, Sort, Render ---
function applyFiltersAndRender() { /* ... (unchanged) ... */ if (!allProductsCache) return; console.log("Applying filters..."); const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : ''; let filteredProducts = allProductsCache.filter(product => { if (!product || !product.productName) return false; if (filterSearchValue) { const name = (product.productName || '').toLowerCase(); const category = (product.category || '').toLowerCase(); const brand = (product.brand || '').toLowerCase(); if (!(name.includes(filterSearchValue) || category.includes(filterSearchValue) || brand.includes(filterSearchValue))) { return false; } } return true; }); renderProductTable(filteredProducts); console.log("Online product rendering complete (filtered)."); }

// --- Table Rendering Function ---
function renderProductTable(products) { /* ... (unchanged) ... */ if (!productTableBody) return; productTableBody.innerHTML = ''; const expectedColumns = 8; if (products.length === 0) { productTableBody.innerHTML = `<tr><td colspan="${expectedColumns}" id="noProductsMessage" style="text-align: center;">No online products found matching criteria.</td></tr>`; } else { products.forEach(product => { const firestoreId = product.id; const data = product; const tableRow = productTableBody.insertRow(); tableRow.setAttribute('data-id', firestoreId); const name = data.productName || 'N/A'; const category = data.category || '-'; const brand = data.brand || '-'; const rate = data.pricing?.rate !== undefined ? formatCurrency(data.pricing.rate) : '-'; const unit = data.unit || '-'; const enabled = data.isEnabled ? 'Yes' : 'No'; const dateAdded = formatFirestoreTimestamp(data.createdAt); tableRow.innerHTML = `<td>${escapeHtml(name)}</td><td>${escapeHtml(category)}</td><td>${escapeHtml(brand)}</td><td style="text-align: right;">${rate}</td><td style="text-align: center;">${escapeHtml(unit)}</td><td style="text-align: center;">${enabled}</td><td style="text-align: center;">${dateAdded}</td><td style="text-align: center;"><button class="button edit-product-btn" style="background-color: var(--info-color); color: white; padding: 5px 8px; font-size: 0.8em; margin: 2px;" title="Edit Online Product"><i class="fas fa-edit"></i> Edit</button><button class="button delete-product-btn" style="background-color: var(--danger-color); color: white; padding: 5px 8px; font-size: 0.8em; margin: 2px;" title="Delete Online Product"><i class="fas fa-trash"></i> Delete</button></td>`; const editBtn = tableRow.querySelector('.edit-product-btn'); if (editBtn) { editBtn.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(firestoreId, data); }); } const delBtn = tableRow.querySelector('.delete-product-btn'); if (delBtn) { delBtn.addEventListener('click', (e) => { e.stopPropagation(); productToDeleteId = firestoreId; productToDeleteName = data.productName || 'this online product'; if(deleteWarningMessage) deleteWarningMessage.innerHTML = `Are you sure you want to delete the online product "<strong>${escapeHtml(productToDeleteName)}</strong>"? <br>This will also delete its images from storage. This action cannot be undone.`; if(deleteConfirmCheckbox) deleteConfirmCheckbox.checked = false; if(confirmDeleteFinalBtn) confirmDeleteFinalBtn.disabled = true; if(deleteConfirmModal) deleteConfirmModal.classList.add('active'); }); } }); } }

// --- Pricing Tab Functions ---
function setActiveRateTab(rateType) { /* ... (unchanged) ... */ if (!RATE_TYPES[rateType] || !priceTabsContainer || !currentRateInput || !currentRateLabel || !applyRateCheckboxesContainer) { console.error("Cannot set active rate tab - required elements missing."); return; } currentActiveRateType = rateType; console.log("Active rate type set to:", currentActiveRateType); priceTabsContainer.querySelectorAll('.price-tab-btn').forEach(btn => { btn.classList.toggle('active', btn.dataset.rateType === rateType); }); currentRateLabel.textContent = `${RATE_TYPES[rateType].label}*:`; const fieldName = RATE_TYPES[rateType].field; currentRateInput.value = productBeingEditedData?.pricing?.[fieldName] ?? ''; currentRateInput.dataset.currentRateType = rateType; updateApplyRateCheckboxes(rateType); }
function updateApplyRateCheckboxes(activeType) { /* ... (unchanged) ... */ if (!applyRateCheckboxesContainer) { console.error("Apply Rate Checkboxes container not found!"); return; } applyRateCheckboxesContainer.innerHTML = ''; const containerTitle = document.createElement('label'); containerTitle.className = 'checkbox-container-title'; containerTitle.textContent = `Apply ${RATE_TYPES[activeType]?.label || 'Current'} Rate to:`; applyRateCheckboxesContainer.appendChild(containerTitle); Object.keys(RATE_TYPES).forEach(typeKey => { if (typeKey !== activeType) { const otherTypeInfo = RATE_TYPES[typeKey]; const checkboxId = `applyRateTo_${typeKey}`; const wrapper = document.createElement('div'); wrapper.className = 'checkbox-wrapper apply-rate-checkbox'; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = checkboxId; checkbox.name = 'applyRateTo'; checkbox.value = typeKey; const label = document.createElement('label'); label.htmlFor = checkboxId; label.textContent = otherTypeInfo.label; wrapper.appendChild(checkbox); wrapper.appendChild(label); applyRateCheckboxesContainer.appendChild(wrapper); } }); }

// --- Modal Handling (Add/Edit - Updated for Diagram) ---
function openAddModal() {
    if (!productModal || !productForm) return;
    console.log("Opening modal to add new ONLINE product (v_Layout_Diagram).");
    if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-plus-circle success-icon"></i> Add New Online Product';
    if (editProductIdInput) editProductIdInput.value = '';
    productForm.reset();
    productBeingEditedData = { pricing: {} }; // Clear stored data

    if (isEnabledCheckbox) isEnabledCheckbox.checked = true;
    if (hasExtraChargesCheckbox) hasExtraChargesCheckbox.checked = false;
    existingImageUrls = []; selectedFiles = []; imagesToDelete = [];
    if (imagePreviewArea) imagePreviewArea.innerHTML = '';
    if (uploadProgressInfo) uploadProgressInfo.textContent = '';
    if (existingImageUrlsInput) existingImageUrlsInput.value = '[]';
    if (saveProductBtn) saveProductBtn.disabled = false;
    if (saveSpinner) saveSpinner.style.display = 'none';
    if (saveIcon) saveIcon.style.display = '';
    if (saveText) saveText.textContent = 'Save Product';
    if (deleteProductBtn) deleteProductBtn.style.display = 'none';

    // --- Diagram Reset ---
    diagramFileToUpload = null;
    shouldRemoveDiagram = false;
    if(productDiagramInput) productDiagramInput.value = null; // Clear file input
    if(diagramLinkArea) diagramLinkArea.style.display = 'none';
    if(viewDiagramLink) viewDiagramLink.href = '#';
    if(diagramUploadProgress) diagramUploadProgress.textContent = '';
    if(existingDiagramUrlInput) existingDiagramUrlInput.value = '';
    // --- End Diagram Reset ---

    setActiveRateTab('online'); // Default to 'online' tab

    toggleWeddingFields(); toggleSqFtFields(); toggleExtraCharges();
    productModal.classList.add('active');
}

async function openEditModal(firestoreId, data) {
    if (!productModal || !productForm || !data) return;
    console.log("Opening modal to edit ONLINE product (v_Layout_Diagram):", firestoreId);
    if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-edit info-icon"></i> Edit Online Product';
    productForm.reset();
    productBeingEditedData = JSON.parse(JSON.stringify(data)); // Store deep copy
    if (!productBeingEditedData.pricing) productBeingEditedData.pricing = {};

    if (editProductIdInput) editProductIdInput.value = firestoreId;
    if (productNameInput) productNameInput.value = data.productName || '';
    // ... (Populate other non-pricing, non-image, non-diagram fields) ...
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

    // --- Image Handling ---
    selectedFiles = []; imagesToDelete = [];
    if (imagePreviewArea) imagePreviewArea.innerHTML = '';
    existingImageUrls = data.imageUrls || [];
    if (existingImageUrlsInput) existingImageUrlsInput.value = JSON.stringify(existingImageUrls);
    existingImageUrls.forEach(url => displayImagePreview(null, url));
    if (uploadProgressInfo) uploadProgressInfo.textContent = '';

    // --- NEW: Diagram Handling ---
    diagramFileToUpload = null;
    shouldRemoveDiagram = false;
    const currentDiagramUrl = data.diagramUrl || '';
    if(productDiagramInput) productDiagramInput.value = null; // Clear file input on open
    if(existingDiagramUrlInput) existingDiagramUrlInput.value = currentDiagramUrl;
    if (diagramLinkArea && viewDiagramLink) {
        if (currentDiagramUrl) {
            viewDiagramLink.href = currentDiagramUrl;
            diagramLinkArea.style.display = 'block';
        } else {
            diagramLinkArea.style.display = 'none';
        }
    }
     if(diagramUploadProgress) diagramUploadProgress.textContent = '';
    // --- END Diagram Handling ---

    if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = 'Update Product'; if (deleteProductBtn) deleteProductBtn.style.display = 'inline-flex';

    productToDeleteId = firestoreId; productToDeleteName = data.productName || 'this online product';

    setActiveRateTab('online'); // Default to 'online' tab

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
        currentActiveRateType = 'online';
        // --- NEW: Reset Diagram State on Close ---
        diagramFileToUpload = null;
        shouldRemoveDiagram = false;
        if (productDiagramInput) productDiagramInput.value = null;
        // --- END Diagram Reset ---
    }
}

// --- Image Handling ---
function handleFileSelection(event) { /* ... (unchanged) ... */ if (!imagePreviewArea || !productImagesInput) return; const files = Array.from(event.target.files); let currentImageCount = existingImageUrls.filter(url => !imagesToDelete.includes(url)).length + selectedFiles.length; const availableSlots = 4 - currentImageCount; if (files.length > availableSlots) { alert(`Max 4 images allowed. You have ${currentImageCount}, tried to add ${files.length}.`); productImagesInput.value = null; return; } files.forEach(file => { if (file.type.startsWith('image/')) { if (selectedFiles.length + existingImageUrls.filter(url => !imagesToDelete.includes(url)).length < 4) { selectedFiles.push(file); displayImagePreview(file, null); } } }); productImagesInput.value = null; }
function displayImagePreview(fileObject, existingUrl = null) { /* ... (unchanged) ... */ if (!imagePreviewArea) return; const previewId = existingUrl || `new-${fileObject.name}-${Date.now()}`; const previewWrapper = document.createElement('div'); previewWrapper.className = 'image-preview-item'; previewWrapper.setAttribute('data-preview-id', previewId); const img = document.createElement('img'); const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.className = 'remove-image-btn'; removeBtn.innerHTML = '&times;'; removeBtn.title = 'Remove image'; const progressBar = document.createElement('div'); progressBar.className = 'upload-progress-bar'; const progressFill = document.createElement('div'); progressBar.appendChild(progressFill); progressBar.style.display = 'none'; if (existingUrl) { img.src = existingUrl; img.onerror = () => { img.src = 'images/placeholder.png'; }; previewWrapper.imageUrl = existingUrl; removeBtn.onclick = () => { if (!imagesToDelete.includes(existingUrl)) imagesToDelete.push(existingUrl); previewWrapper.style.display = 'none'; console.log("Marked for deletion:", existingUrl); }; } else if (fileObject) { const reader = new FileReader(); reader.onload = (e) => { img.src = e.target.result; }; reader.readAsDataURL(fileObject); previewWrapper.fileData = fileObject; removeBtn.onclick = () => { selectedFiles = selectedFiles.filter(f => f !== fileObject); previewWrapper.remove(); console.log("Removed new file:", fileObject.name); }; } previewWrapper.appendChild(img); previewWrapper.appendChild(removeBtn); previewWrapper.appendChild(progressBar); imagePreviewArea.appendChild(previewWrapper); }
async function uploadImage(file, productId, index) { /* ... (unchanged) ... */ if (!window.storage || !window.storageRef || !window.uploadBytesResumable || !window.getDownloadURL) throw new Error("Storage functions missing."); const previewWrapper = [...imagePreviewArea.querySelectorAll('.image-preview-item')].find(el => el.fileData === file); const progressBar = previewWrapper?.querySelector('.upload-progress-bar'); const progressFill = progressBar?.querySelector('div'); const timestamp = Date.now(); const uniqueFileName = `${timestamp}-image${index}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`; const filePath = `onlineProductImages/${productId}/${uniqueFileName}`; const fileRef = window.storageRef(window.storage, filePath); if (progressBar) progressBar.style.display = 'block'; if (progressFill) progressFill.style.width = '0%'; const uploadTask = window.uploadBytesResumable(fileRef, file); return new Promise((resolve, reject) => { uploadTask.on('state_changed', (snapshot) => { const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100; if (progressFill) progressFill.style.width = `${progress}%`; if (uploadProgressInfo) uploadProgressInfo.textContent = `Uploading ${file.name}: ${progress.toFixed(0)}%`; }, (error) => { console.error(`Upload failed:`, error); if (progressBar) progressBar.style.backgroundColor = 'red'; if (uploadProgressInfo) uploadProgressInfo.textContent = `Upload failed: ${file.name}.`; reject(error); }, async () => { if (progressBar) progressBar.style.backgroundColor = 'var(--success-color)'; if (uploadProgressInfo) uploadProgressInfo.textContent = `Getting URL...`; try { const downloadURL = await window.getDownloadURL(uploadTask.snapshot.ref); resolve(downloadURL); } catch (error) { if (progressBar) progressBar.style.backgroundColor = 'red'; if (uploadProgressInfo) uploadProgressInfo.textContent = `Failed to get URL.`; reject(error); } }); }); }
async function deleteStoredImage(imageUrl) { /* ... (unchanged) ... */ if (!window.storage || !window.storageRef || !window.deleteObject) return; if (!imageUrl || !(imageUrl.startsWith('https://firebasestorage.googleapis.com/') || imageUrl.startsWith('gs://'))) return; try { const imageRef = window.storageRef(window.storage, imageUrl); await window.deleteObject(imageRef); console.log("Deleted image from Storage:", imageUrl); } catch (error) { if (error.code === 'storage/object-not-found') console.warn("Image not found:", imageUrl); else console.error("Error deleting image:", imageUrl, error); } }


// --- <<< NEW: Diagram File Handling >>> ---
function handleDiagramFileSelection(event) {
    const file = event.target.files[0];
    if (file) {
        // Basic validation (optional: add size limit)
        const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            showToast("Invalid diagram file type. Please use PDF, PNG, JPG, or WEBP.", 4000);
            event.target.value = null; // Clear selection
            diagramFileToUpload = null;
            return;
        }
        diagramFileToUpload = file;
        shouldRemoveDiagram = false; // Selecting a new file overrides removal intention
        if(diagramUploadProgress) diagramUploadProgress.textContent = `Selected: ${file.name}`;
        if(diagramLinkArea) diagramLinkArea.style.display = 'none'; // Hide old link preview
        console.log("Diagram file selected:", file.name);
    } else {
        diagramFileToUpload = null; // No file selected
         if(diagramUploadProgress) diagramUploadProgress.textContent = '';
    }
}

function handleRemoveDiagram() {
    if (!existingDiagramUrlInput?.value) {
        showToast("No diagram currently saved to remove.", 3000);
        return;
    }
    if (confirm("Are you sure you want to remove the current diagram? This will delete the file permanently when you save.")) {
        shouldRemoveDiagram = true;
        diagramFileToUpload = null; // Clear any newly selected file
        if(productDiagramInput) productDiagramInput.value = null; // Clear the file input
        if(diagramLinkArea) diagramLinkArea.style.display = 'none'; // Hide the link area
        if(diagramUploadProgress) diagramUploadProgress.textContent = 'Diagram marked for removal.';
        showToast("Diagram marked for removal. Click Save Product to confirm.", 4000);
    }
}

async function uploadFile(file, storagePath, progressElement) {
    if (!window.storage || !window.storageRef || !window.uploadBytesResumable || !window.getDownloadURL) throw new Error("Storage functions missing.");
    if (!file || !storagePath || !progressElement) throw new Error("Missing file, path, or progress element for upload.");

    const fileRef = window.storageRef(window.storage, storagePath);
    progressElement.textContent = 'Starting upload...';
    progressElement.style.color = 'var(--text-color-medium)'; // Reset color

    const uploadTask = window.uploadBytesResumable(fileRef, file);

    return new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                progressElement.textContent = `Uploading ${file.name}: ${progress.toFixed(0)}%`;
            },
            (error) => {
                console.error(`File Upload Error (${storagePath}):`, error);
                progressElement.textContent = `Upload failed: ${file.name}. ${error.code}`;
                progressElement.style.color = 'var(--danger-color)';
                reject(error);
            },
            async () => {
                progressElement.textContent = `Upload Complete. Getting URL...`;
                try {
                    const downloadURL = await window.getDownloadURL(uploadTask.snapshot.ref);
                    progressElement.textContent = `Diagram uploaded successfully.`;
                     progressElement.style.color = 'var(--success-color)';
                    console.log("File available at", downloadURL);
                    resolve(downloadURL);
                } catch (getUrlError) {
                    console.error(`Error getting download URL (${storagePath}):`, getUrlError);
                    progressElement.textContent = `Failed to get URL after upload.`;
                    progressElement.style.color = 'var(--danger-color)';
                    reject(getUrlError);
                }
            }
        );
    });
}

async function deleteStoredFile(fileUrl) {
    if (!window.storage || !window.storageRef || !window.deleteObject) { console.warn("Storage delete functions unavailable."); return; }
    if (!fileUrl || !(fileUrl.startsWith('https://firebasestorage.googleapis.com/') || fileUrl.startsWith('gs://'))) { console.warn("Invalid or missing file URL for deletion:", fileUrl); return; }
    console.log("Attempting to delete file from Storage:", fileUrl);
    try {
        const fileRef = window.storageRef(window.storage, fileUrl);
        await window.deleteObject(fileRef);
        console.log("Deleted file from Storage:", fileUrl);
    } catch (error) {
        if (error.code === 'storage/object-not-found') { console.warn("File not found in Storage, skipping delete:", fileUrl); }
        else { console.error("Error deleting file:", fileUrl, error); /* Optionally re-throw or showToast */ }
    }
}
// --- <<< END: Diagram File Handling >>> ---


// --- <<< UPDATED: handleSaveProduct Function (v_Layout_Diagram) >>> ---
async function handleSaveProduct(event) {
    event.preventDefault();
    if (!window.db || !window.collection || !window.addDoc || !window.doc || !window.updateDoc || !window.serverTimestamp || !window.storage) { showToast("Core Firebase functions unavailable.", 5000); return; }
    if (saveProductBtn) saveProductBtn.disabled = true; if (saveSpinner) saveSpinner.style.display = 'inline-block'; if (saveIcon) saveIcon.style.display = 'none'; if (saveText) saveText.textContent = 'Saving...'; if (uploadProgressInfo) uploadProgressInfo.textContent = 'Preparing data...'; if (diagramUploadProgress) diagramUploadProgress.textContent = ''; // Clear diagram progress

    const editingProductId = editProductIdInput?.value;
    const isEditing = !!editingProductId;
    let finalProductId = editingProductId;

    // --- Validation (Basic Fields) ---
    const productName = productNameInput?.value.trim();
    const category = productCategoryInput?.value.trim();
    const unit = productUnitSelect?.value || null;
    if (!productName || !category || !unit) { showToast("Product Name, Category, and Unit are required.", 5000); /* Restore button */ if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product'; return; }

    // --- Validation (Pricing Fields) ---
    const currentRateValue = parseNumericInput(currentRateInput?.value);
    const purchasePrice = parseNumericInput(productPurchasePriceInput?.value);
    const mrp = parseNumericInput(productMrpInput?.value);
    const gstRate = parseNumericInput(productGstRateInput?.value);
    const minOrderValue = parseNumericInput(productMinOrderValueInput?.value);
    const designCharge = parseNumericInput(designChargeInput?.value);
    const printingCharge = parseNumericInput(printingChargeInput?.value);
    const transportCharge = parseNumericInput(transportChargeInput?.value);
    const extraMarginPercent = parseNumericInput(extraMarginPercentInput?.value);
    const extraChargeAmount = parseNumericInput(extraChargeAmountInput?.value);

    if (currentRateValue === null || isNaN(currentRateValue)) { const activeLabel = RATE_TYPES[currentActiveRateType]?.label || 'Current Price'; showToast(`Please enter a valid ${activeLabel}. It cannot be empty or invalid.`, 5000); /* Restore button */ if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product'; return; }
    if ([purchasePrice, mrp, gstRate, minOrderValue, designCharge, printingCharge, transportCharge, extraMarginPercent, extraChargeAmount].some(isNaN)) { showToast("Please enter valid numbers (or leave blank) for optional prices/charges.", 5000); /* Restore button */ if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product'; return; }

    // --- Prepare Base Product Data ---
    const productData = {
        productName: productName, productName_lowercase: productName.toLowerCase(),
        category: category, category_lowercase: category.toLowerCase(),
        unit: unit, description: productDescInput?.value.trim() || '',
        isEnabled: isEnabledCheckbox?.checked ?? true,
        options: [], brand: productBrandInput?.value.trim() || null,
        itemCode: productItemCodeInput?.value.trim() || null,
        hsnSacCode: productHsnSacCodeInput?.value.trim() || null,
        updatedAt: window.serverTimestamp(),
        pricing: isEditing ? { ...(productBeingEditedData?.pricing || {}) } : {}
    };
    if (!isEditing) { productData.createdAt = window.serverTimestamp(); productData.imageUrls = []; productData.diagramUrl = null; } // Initialize for new product

    // --- Update Pricing based on Active Tab and Checkboxes ---
    const activeField = RATE_TYPES[currentActiveRateType].field;
    productData.pricing[activeField] = currentRateValue;
    const applyCheckboxes = applyRateCheckboxesContainer?.querySelectorAll('input[name="applyRateTo"]:checked') ?? [];
    applyCheckboxes.forEach(checkbox => { const targetRateType = checkbox.value; if (RATE_TYPES[targetRateType]) { const targetField = RATE_TYPES[targetRateType].field; productData.pricing[targetField] = currentRateValue; } });

    // --- Add/Update OTHER pricing fields ---
    if (purchasePrice !== null) productData.pricing.purchasePrice = purchasePrice; else delete productData.pricing.purchasePrice;
    if (mrp !== null) productData.pricing.mrp = mrp; else delete productData.pricing.mrp;
    if (gstRate !== null) productData.pricing.gstRate = gstRate; else delete productData.pricing.gstRate;
    if (unit === 'Sq Feet' && minOrderValue !== null) productData.pricing.minimumOrderValue = minOrderValue; else delete productData.pricing.minimumOrderValue;
    if (category.toLowerCase().includes('wedding card')) { if (designCharge !== null) productData.pricing.designCharge = designCharge; else delete productData.pricing.designCharge; if (printingCharge !== null) productData.pricing.printingChargeBase = printingCharge; else delete productData.pricing.printingChargeBase; if (transportCharge !== null) productData.pricing.transportCharge = transportCharge; else delete productData.pricing.transportCharge; if (extraMarginPercent !== null) productData.pricing.extraMarginPercent = extraMarginPercent; else delete productData.pricing.extraMarginPercent; } else { delete productData.pricing.designCharge; delete productData.pricing.printingChargeBase; delete productData.pricing.transportCharge; delete productData.pricing.extraMarginPercent; }
    productData.pricing.hasExtraCharges = hasExtraChargesCheckbox?.checked ?? false; if (productData.pricing.hasExtraCharges) { productData.pricing.extraCharge = { name: extraChargeNameInput?.value.trim() || 'Additional Charge', amount: extraChargeAmount ?? 0 }; } else { delete productData.pricing.extraCharge; }

    // --- Options JSON ---
    const optionsString = productOptionsInput?.value.trim();
    if (optionsString) { try { const parsedOptions = JSON.parse(optionsString); if (!Array.isArray(parsedOptions)) throw new Error("Options must be an array."); productData.options = parsedOptions; } catch (err) { showToast(`Error: Invalid JSON in Options field. ${err.message}`, 5000); /* Restore button */ if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product'; return; } }
    else { productData.options = []; }

    // --- Diagram URL (will be updated after potential upload) ---
    // Start with the existing URL (if editing) or null (if adding)
    productData.diagramUrl = isEditing ? (productBeingEditedData?.diagramUrl || null) : null;


    console.log("Prepared product data (before file ops):", JSON.parse(JSON.stringify(productData)));

    // --- START Save/Upload Process ---
    try {
        // === Step 0: Get Product ID (Create entry if new to get ID for storage paths) ===
        if (!isEditing) {
             if (uploadProgressInfo) uploadProgressInfo.textContent = 'Creating product entry...';
             // Save preliminary data without file URLs first to get an ID
             const preliminaryData = { ...productData };
             delete preliminaryData.imageUrls; // Will be added later
             delete preliminaryData.diagramUrl; // Will be added later
             const docRef = await window.addDoc(window.collection(window.db, "onlineProducts"), preliminaryData);
             finalProductId = docRef.id; // Get the newly created ID
             console.log("New product entry created, ID:", finalProductId);
             productData.id = finalProductId; // Add ID to data object for reference
        } else {
            finalProductId = editingProductId; // Use existing ID
        }
        if (!finalProductId) throw new Error("Could not establish Product ID.");


        // === Step 1: Handle Diagram File Operation ===
        let newDiagramUrl = productData.diagramUrl; // Start with current/initial URL
        const existingDiagramUrl = isEditing ? (productBeingEditedData?.diagramUrl || null) : null;

        if (shouldRemoveDiagram && existingDiagramUrl) {
            if (diagramUploadProgress) diagramUploadProgress.textContent = 'Removing existing diagram...';
            await deleteStoredFile(existingDiagramUrl); // Delete from storage
            newDiagramUrl = null; // Remove URL from data
            console.log("Existing diagram removed.");
        } else if (diagramFileToUpload) {
            if (uploadProgressInfo) uploadProgressInfo.textContent = 'Processing diagram...'; // General progress update
             // Delete old diagram *before* uploading new one if editing and one exists
             if (isEditing && existingDiagramUrl) {
                 if (diagramUploadProgress) diagramUploadProgress.textContent = 'Replacing existing diagram...';
                 await deleteStoredFile(existingDiagramUrl);
                 console.log("Replaced existing diagram.");
             }
            // Upload new diagram
            const diagramFileName = `diagram-${Date.now()}-${diagramFileToUpload.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const diagramPath = `productDiagrams/${finalProductId}/${diagramFileName}`;
            newDiagramUrl = await uploadFile(diagramFileToUpload, diagramPath, diagramUploadProgress); // Upload and get URL
        }
        productData.diagramUrl = newDiagramUrl; // Update data object with final diagram URL

        // === Step 2: Handle Product Image Operations ===
        let uploadedImageUrls = [];
        let currentExistingUrls = isEditing ? (productBeingEditedData?.imageUrls || []) : [];

        if (isEditing && imagesToDelete.length > 0) { /* ... (delete images as before) ... */ if (uploadProgressInfo) uploadProgressInfo.textContent = 'Deleting images...'; const deletePromises = imagesToDelete.map(url => deleteStoredImage(url)); await Promise.allSettled(deletePromises); currentExistingUrls = currentExistingUrls.filter(url => !imagesToDelete.includes(url)); }
        if (selectedFiles.length > 0) { /* ... (upload images as before) ... */ if (uploadProgressInfo) uploadProgressInfo.textContent = `Uploading ${selectedFiles.length} images...`; const uploadPromises = selectedFiles.map((file, index) => uploadImage(file, finalProductId, index)); const uploadResults = await Promise.allSettled(uploadPromises); uploadedImageUrls = []; let uploadErrorOccurred = false; uploadResults.forEach((result) => { if (result.status === 'fulfilled') { uploadedImageUrls.push(result.value); } else { console.error(`Upload failed:`, result.reason); uploadErrorOccurred = true; } }); if (uploadErrorOccurred) { showToast("Some images failed upload.", 5000); } else { if (uploadProgressInfo) uploadProgressInfo.textContent = 'Images uploaded!'; } }
        else { console.log("No new images selected."); }

        // === Step 3: Final Firestore Update (with all URLs) ===
        const finalImageUrls = [...currentExistingUrls, ...uploadedImageUrls];
        // Create final payload with updated URLs and correct timestamps
        const finalUpdatePayload = {
             ...productData, // Includes updated pricing, details, options, diagramUrl
             imageUrls: finalImageUrls,
             updatedAt: window.serverTimestamp() // Ensure latest timestamp
        };
        if (isEditing) { delete finalUpdatePayload.createdAt; } // Don't overwrite createdAt

        if (uploadProgressInfo) uploadProgressInfo.textContent = 'Finalizing product data...';
        const finalProductRef = window.doc(window.db, "onlineProducts", finalProductId);
        await window.updateDoc(finalProductRef, finalUpdatePayload); // Use updateDoc for both add (post-creation) and edit

        console.log(`Product ${isEditing ? 'updated' : 'added'} successfully in Firestore: ${finalProductId}`);
        showToast(isEditing ? 'Product updated successfully!' : 'Product added successfully!', 3000);
        closeProductModal();

    } catch (error) {
        console.error("Save/upload error:", error);
        showToast(`Error saving product: ${error.message || 'Unknown error'}. Check console.`, 5000);
        // Attempt to clean up partially created product if add failed after entry creation
         if (!isEditing && finalProductId && error.message !== "Could not establish Product ID.") {
            console.warn("Attempting to cleanup partial product entry:", finalProductId);
             try { await window.deleteDoc(window.doc(window.db, "onlineProducts", finalProductId)); console.log("Partial product entry cleaned up."); }
             catch (cleanupError) { console.error("Failed to cleanup partial product entry:", cleanupError); }
         }
    } finally {
        // Restore button state
        if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product'; if (uploadProgressInfo) setTimeout(() => { if (uploadProgressInfo) uploadProgressInfo.textContent = ''; }, 3000); if (diagramUploadProgress) setTimeout(() => { if (diagramUploadProgress) diagramUploadProgress.textContent = ''; }, 3000);
    }
}
// --- <<< END: UPDATED handleSaveProduct >>> ---


// --- Delete Handling (Updated for Diagram) ---
function handleDeleteButtonClick(event) { /* ... (unchanged) ... */ event.preventDefault(); if (!productToDeleteId || !productToDeleteName) return; if (deleteWarningMessage) deleteWarningMessage.innerHTML = `Are you sure you want to delete "<strong>${escapeHtml(productToDeleteName)}</strong>"? <br>This will also delete its images and diagram. This action cannot be undone.`; if(deleteConfirmCheckbox) deleteConfirmCheckbox.checked = false; if(confirmDeleteFinalBtn) confirmDeleteFinalBtn.disabled = true; if(deleteConfirmModal) deleteConfirmModal.classList.add('active'); }
function closeDeleteConfirmModal() { /* ... (unchanged) ... */ if (deleteConfirmModal) { deleteConfirmModal.classList.remove('active'); } }
function handleConfirmCheckboxChange() { /* ... (unchanged) ... */ if (deleteConfirmCheckbox && confirmDeleteFinalBtn) { confirmDeleteFinalBtn.disabled = !deleteConfirmCheckbox.checked; } }
async function handleFinalDelete() {
    if (!deleteConfirmCheckbox?.checked || !productToDeleteId) return;
    if (!window.db || !window.doc || !window.getDoc || !window.deleteDoc || !window.storage || !window.storageRef || !window.deleteObject) { showToast("Core Firebase functions unavailable.", 5000); return; }

    if(confirmDeleteFinalBtn) { confirmDeleteFinalBtn.disabled = true; confirmDeleteFinalBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...'; }
    const productRef = window.doc(window.db, "onlineProducts", productToDeleteId);

    try {
        // 1. Get product data to find file URLs
        const productSnap = await window.getDoc(productRef);
        let deletePromises = [];

        if (productSnap.exists()) {
            const productData = productSnap.data();

            // 2. Delete Images from Storage
            if (productData.imageUrls && Array.isArray(productData.imageUrls) && productData.imageUrls.length > 0) {
                console.log(`Marking ${productData.imageUrls.length} images for deletion...`);
                productData.imageUrls.forEach(url => deletePromises.push(deleteStoredImage(url)));
            }

            // 3. <<< NEW: Delete Diagram from Storage >>>
            if (productData.diagramUrl) {
                console.log("Marking diagram for deletion...");
                deletePromises.push(deleteStoredFile(productData.diagramUrl));
            }
            // <<< END NEW >>>

            // Wait for all file deletions to attempt
            if (deletePromises.length > 0) {
                console.log(`Waiting for ${deletePromises.length} file deletion(s) to settle...`);
                await Promise.allSettled(deletePromises);
                console.log("File deletion attempts finished.");
            } else {
                 console.log("No images or diagram found to delete from storage.");
            }
        } else {
            console.warn(`Product document ${productToDeleteId} not found, cannot delete associated files.`);
        }

        // 4. Delete Firestore Document
        console.log(`Deleting Firestore document ${productToDeleteId}...`);
        await window.deleteDoc(productRef);
        showToast(`Product "${productToDeleteName || ''}" and associated files deleted!`);
        closeDeleteConfirmModal();
        closeProductModal(); // Also close the edit modal if it was open

    } catch (error) {
        console.error(`Error during deletion process for ${productToDeleteId}:`, error);
        showToast(`Failed to fully delete product: ${error.message}`, 5000);
    } finally {
        if(confirmDeleteFinalBtn) { confirmDeleteFinalBtn.disabled = !deleteConfirmCheckbox?.checked; confirmDeleteFinalBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Confirm Delete'; }
    }
}

// --- END ---