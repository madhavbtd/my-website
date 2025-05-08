// js/manage-online-products.js
// Updated Version: Tabbed interface for rates + Apply rate to others checkbox logic

// --- Firebase Function Availability Check (Assume global via HTML script) ---
// window.db, window.auth, window.storage, window.collection, window.onSnapshot, etc.

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
// Images
const productImagesInput = document.getElementById('productImages');
const imagePreviewArea = document.getElementById('image-preview-area');
const uploadProgressInfo = document.getElementById('upload-progress-info');
const existingImageUrlsInput = document.getElementById('existingImageUrls');

// --- <<< NEW: Pricing Tab UI Elements >>> ---
const priceTabsContainer = document.getElementById('priceTabsContainer'); // Container for price tabs/buttons
const currentRateInput = document.getElementById('currentRateInput');     // The single input for the active rate
const currentRateLabel = document.getElementById('currentRateLabel');     // Label for the single input
const applyRateCheckboxesContainer = document.getElementById('applyRateCheckboxesContainer'); // Container for the 3 checkboxes

// --- Other Pricing Fields (Internal/Base) ---
const productPurchasePriceInput = document.getElementById('productPurchasePrice');
const productMrpInput = document.getElementById('productMrp');
const productGstRateInput = document.getElementById('productGstRate');
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
// Other Options
const productOptionsInput = document.getElementById('productOptions');
// Optional Offline/Internal Fields
const productBrandInput = document.getElementById('productBrand');
const productItemCodeInput = document.getElementById('productItemCode');
const productHsnSacCodeInput = document.getElementById('productHsnSacCode');

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
let productBeingEditedData = {}; // Store all pricing data when editing
let currentActiveRateType = 'online'; // Default active tab/rate type ('online', 'retail', 'agent', 'reseller')
const RATE_TYPES = { // Map types to Firestore field names and labels
    online: { field: 'rate', label: 'Online Customer Rate' },
    retail: { field: 'retailRate', label: 'Retail Shop Rate' },
    agent: { field: 'agentRate', label: 'Agent/Branch Rate' },
    reseller: { field: 'resellerRate', label: 'Reseller/Wholesale Rate' }
};


// --- Helper Functions ---
function formatCurrency(amount) { const num = Number(amount); return isNaN(num) || num === null || num === undefined ? '-' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { unsafe = String(unsafe || ''); } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function parseNumericInput(value, allowZero = true) { if (value === undefined || value === null) return null; const trimmedValue = String(value).trim(); if (trimmedValue === '') return null; const num = parseFloat(trimmedValue); if (isNaN(num) || (!allowZero && num <= 0) || (allowZero && num < 0)) { return NaN; } return num; }
function formatFirestoreTimestamp(timestamp) { /* ... (unchanged) ... */ if (!timestamp || typeof timestamp.toDate !== 'function') { return '-'; } try { const date = timestamp.toDate(); const options = { day: '2-digit', month: 'short', year: 'numeric' }; return date.toLocaleDateString('en-GB', options).replace(/ /g, '-'); } catch (e) { console.error("Error formatting timestamp:", e); return '-'; } }

// --- Toast Notification ---
function showToast(message, duration = 3500) { /* ... (unchanged) ... */ const existingToast = document.querySelector('.toast-notification'); if (existingToast) { existingToast.remove(); } const toast = document.createElement('div'); toast.className = 'toast-notification'; toast.textContent = message; document.body.appendChild(toast); setTimeout(() => toast.classList.add('show'), 10); setTimeout(() => { toast.classList.remove('show'); setTimeout(() => { if (toast.parentNode) { toast.parentNode.removeChild(toast); } }, 400); }, duration); console.log("Toast:", message); }

// --- Initialization ---
window.initializeOnlineProductManagement = () => {
    console.log("Online Product Management Initializing (v_TabbedPricing)...");
    if (!window.db || !window.auth || !window.storage) { console.error("Firebase services not available on window object."); alert("Error initializing page. Firebase services missing."); return; }
    console.log("Firebase services confirmed. Setting up listeners.");
    listenForOnlineProducts();
    setupEventListeners();
    console.log("Online Product Management Initialized (v_TabbedPricing).");
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

    // <<< NEW: Event listener for Price Tabs using delegation >>>
    if (priceTabsContainer) {
        priceTabsContainer.addEventListener('click', (event) => {
            const button = event.target.closest('.price-tab-btn');
            if (button && !button.classList.contains('active')) {
                const rateType = button.dataset.rateType; // e.g., 'online', 'retail'
                if (rateType) {
                    setActiveRateTab(rateType);
                }
            }
        });
    }

    console.log("Online Product Management event listeners set up (v_TabbedPricing).");
}

// --- Show/Hide Conditional Fields ---
function toggleWeddingFields() { /* ... (unchanged) ... */ if (!weddingFieldsContainer || !productCategoryInput) return; const category = productCategoryInput.value.toLowerCase(); weddingFieldsContainer.style.display = category.includes('wedding card') ? 'block' : 'none'; }
function toggleSqFtFields() { /* ... (unchanged) ... */ if (!productUnitSelect) return; const unitType = productUnitSelect.value; if (productMinOrderValueInput) { const parentGroup = productMinOrderValueInput.closest('.sq-feet-only'); if (parentGroup) { parentGroup.style.display = unitType === 'Sq Feet' ? 'block' : 'none'; } } }
function toggleExtraCharges() { /* ... (unchanged) ... */ if (!extraChargesSection || !hasExtraChargesCheckbox) return; extraChargesSection.style.display = hasExtraChargesCheckbox.checked ? 'block' : 'none'; }

// --- Sorting & Filtering Handlers ---
function handleSortChange() { /* ... (unchanged) ... */ if (!sortSelect) return; const [field, direction] = sortSelect.value.split('_'); if (field && direction) { if (field === currentSortField && direction === currentSortDirection) return; currentSortField = field; currentSortDirection = direction; applyFiltersAndRender(); } }
function handleSearchInput() { /* ... (unchanged) ... */ clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(applyFiltersAndRender, 300); }
function clearFilters() { /* ... (unchanged) ... */ if (filterSearchInput) filterSearchInput.value = ''; if (sortSelect) sortSelect.value = 'createdAt_desc'; currentSortField = 'createdAt'; currentSortDirection = 'desc'; applyFiltersAndRender(); }

// --- Firestore Listener ---
function listenForOnlineProducts() { /* ... (unchanged) ... */ if (unsubscribeProducts) { unsubscribeProducts(); unsubscribeProducts = null; } if (!window.db || !window.collection || !window.query || !window.onSnapshot || !window.orderBy) { console.error("Firestore functions unavailable!"); if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Error: DB Connection Failed.</td></tr>`; return; } if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="8" id="loadingMessage" style="text-align: center;">Loading online products...</td></tr>`; try { console.log(`Setting up Firestore listener for 'onlineProducts' with sort: ${currentSortField}_${currentSortDirection}`); const productsRef = window.collection(window.db, "onlineProducts"); const q = window.query(productsRef, window.orderBy(currentSortField || 'createdAt', currentSortDirection || 'desc')); unsubscribeProducts = window.onSnapshot(q, (snapshot) => { console.log(`Received ${snapshot.docs.length} online products.`); allProductsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); applyFiltersAndRender(); }, (error) => { console.error("Error fetching online products snapshot:", error); if (error.code === 'permission-denied') { if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Error loading products: Insufficient permissions. Check Firestore rules.</td></tr>`; } else { if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Error loading products. Check connection/console.</td></tr>`; } }); } catch (error) { console.error("Error setting up online product listener:", error); if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Error setting up listener.</td></tr>`; } }

// --- Filter, Sort, Render ---
function applyFiltersAndRender() { /* ... (unchanged) ... */ if (!allProductsCache) return; console.log("Applying filters (sorting done by Firestore listener)..."); const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : ''; let filteredProducts = allProductsCache.filter(product => { if (!product || !product.productName) return false; if (filterSearchValue) { const name = (product.productName || '').toLowerCase(); const category = (product.category || '').toLowerCase(); const brand = (product.brand || '').toLowerCase(); if (!(name.includes(filterSearchValue) || category.includes(filterSearchValue) || brand.includes(filterSearchValue))) { return false; } } return true; }); renderProductTable(filteredProducts); console.log("Online product rendering complete (filtered)."); }

// --- Table Rendering Function (Unchanged) ---
function renderProductTable(products) { /* ... (unchanged - still shows pricing.rate in the table) ... */ if (!productTableBody) return; productTableBody.innerHTML = ''; const expectedColumns = 8; if (products.length === 0) { productTableBody.innerHTML = `<tr><td colspan="${expectedColumns}" id="noProductsMessage" style="text-align: center;">No online products found matching criteria.</td></tr>`; } else { products.forEach(product => { const firestoreId = product.id; const data = product; const tableRow = productTableBody.insertRow(); tableRow.setAttribute('data-id', firestoreId); const name = data.productName || 'N/A'; const category = data.category || '-'; const brand = data.brand || '-'; const rate = data.pricing?.rate !== undefined ? formatCurrency(data.pricing.rate) : '-'; // Display 'rate' (online rate) in table
            const unit = data.unit || '-'; const enabled = data.isEnabled ? 'Yes' : 'No'; const dateAdded = formatFirestoreTimestamp(data.createdAt); tableRow.innerHTML = `<td>${escapeHtml(name)}</td><td>${escapeHtml(category)}</td><td>${escapeHtml(brand)}</td><td style="text-align: right;">${rate}</td><td style="text-align: center;">${escapeHtml(unit)}</td><td style="text-align: center;">${enabled}</td><td style="text-align: center;">${dateAdded}</td><td style="text-align: center;"><button class="button edit-product-btn" style="background-color: var(--info-color); color: white; padding: 5px 8px; font-size: 0.8em; margin: 2px;" title="Edit Online Product"><i class="fas fa-edit"></i> Edit</button><button class="button delete-product-btn" style="background-color: var(--danger-color); color: white; padding: 5px 8px; font-size: 0.8em; margin: 2px;" title="Delete Online Product"><i class="fas fa-trash"></i> Delete</button></td>`; const editBtn = tableRow.querySelector('.edit-product-btn'); if (editBtn) { editBtn.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(firestoreId, data); }); } const delBtn = tableRow.querySelector('.delete-product-btn'); if (delBtn) { delBtn.addEventListener('click', (e) => { e.stopPropagation(); productToDeleteId = firestoreId; productToDeleteName = data.productName || 'this online product'; if(deleteWarningMessage) deleteWarningMessage.innerHTML = `Are you sure you want to delete the online product "<strong>${escapeHtml(productToDeleteName)}</strong>"? <br>This will also delete its images from storage. This action cannot be undone.`; if(deleteConfirmCheckbox) deleteConfirmCheckbox.checked = false; if(confirmDeleteFinalBtn) confirmDeleteFinalBtn.disabled = true; if(deleteConfirmModal) deleteConfirmModal.classList.add('active'); }); } }); } }


// --- <<< NEW: Pricing Tab Functions >>> ---

/** Sets the active pricing tab and updates the UI */
function setActiveRateTab(rateType) {
    if (!RATE_TYPES[rateType] || !priceTabsContainer || !currentRateInput || !currentRateLabel || !applyRateCheckboxesContainer) return;

    currentActiveRateType = rateType; // Update global state
    console.log("Active rate type set to:", currentActiveRateType);

    // Update Tab Buttons visual state
    priceTabsContainer.querySelectorAll('.price-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.rateType === rateType);
    });

    // Update the single rate input label and value
    currentRateLabel.textContent = `${RATE_TYPES[rateType].label}*:`;
    // Load the rate from the stored data for the product being edited
    const fieldName = RATE_TYPES[rateType].field;
    currentRateInput.value = productBeingEditedData.pricing?.[fieldName] ?? '';
    currentRateInput.dataset.currentRateType = rateType; // Store type on input for reference if needed

    // Update "Apply to others" checkboxes
    updateApplyRateCheckboxes(rateType);
}

/** Updates the "Apply to others" checkboxes based on the active tab */
function updateApplyRateCheckboxes(activeType) {
    if (!applyRateCheckboxesContainer) return;
    applyRateCheckboxesContainer.innerHTML = ''; // Clear existing checkboxes

    const containerTitle = document.createElement('label');
    containerTitle.className = 'checkbox-container-title';
    containerTitle.textContent = `Apply ${RATE_TYPES[activeType].label} to:`;
    applyRateCheckboxesContainer.appendChild(containerTitle);

    Object.keys(RATE_TYPES).forEach(typeKey => {
        if (typeKey !== activeType) { // Don't show checkbox for the active type itself
            const otherTypeInfo = RATE_TYPES[typeKey];
            const checkboxId = `applyRateTo_${typeKey}`;

            const wrapper = document.createElement('div');
            wrapper.className = 'checkbox-wrapper';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = checkboxId;
            checkbox.name = 'applyRateTo';
            checkbox.value = typeKey; // Store the target rate type ('online', 'retail', etc.)

            const label = document.createElement('label');
            label.htmlFor = checkboxId;
            label.textContent = otherTypeInfo.label; // Display the full label

            wrapper.appendChild(checkbox);
            wrapper.appendChild(label);
            applyRateCheckboxesContainer.appendChild(wrapper);
        }
    });
}

// --- <<< END: Pricing Tab Functions >>> ---


// --- Modal Handling (Add/Edit) ---
function openAddModal() {
    if (!productModal || !productForm) return;
    console.log("Opening modal to add new ONLINE product (v_TabbedPricing).");
    if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-plus-circle success-icon"></i> Add New Online Product';
    if (editProductIdInput) editProductIdInput.value = '';
    productForm.reset(); // Reset all form fields
    productBeingEditedData = { pricing: {} }; // Clear stored data for add mode
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

    // <<< NEW: Set default active tab and checkboxes for Add mode >>>
    setActiveRateTab('online'); // Default to 'online' tab

    toggleWeddingFields(); toggleSqFtFields(); toggleExtraCharges();
    productModal.classList.add('active');
}

async function openEditModal(firestoreId, data) {
    if (!productModal || !productForm || !data) return;
    console.log("Opening modal to edit ONLINE product (v_TabbedPricing):", firestoreId);
    if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-edit info-icon"></i> Edit Online Product';
    productForm.reset(); // Reset form first
    productBeingEditedData = JSON.parse(JSON.stringify(data)); // Store a deep copy of the data being edited
    if (!productBeingEditedData.pricing) productBeingEditedData.pricing = {}; // Ensure pricing object exists

    if (editProductIdInput) editProductIdInput.value = firestoreId;
    if (productNameInput) productNameInput.value = data.productName || '';
    if (productCategoryInput) productCategoryInput.value = data.category || '';
    if (productUnitSelect) productUnitSelect.value = data.unit || 'Qty';
    if (productDescInput) productDescInput.value = data.description || '';
    if (isEnabledCheckbox) isEnabledCheckbox.checked = data.isEnabled !== undefined ? data.isEnabled : true;

    // --- Populate NON-RATE pricing fields ---
    const pricing = data.pricing || {};
    // Note: Rate fields (rate, retailRate, agentRate, resellerRate) are handled by setActiveRateTab
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
    // --- End NON-RATE pricing fields ---

    if (productOptionsInput) { try { productOptionsInput.value = (data.options && Array.isArray(data.options)) ? JSON.stringify(data.options, null, 2) : ''; } catch { productOptionsInput.value = ''; } }
    if (productBrandInput) productBrandInput.value = data.brand || '';
    if (productItemCodeInput) productItemCodeInput.value = data.itemCode || '';
    if (productHsnSacCodeInput) productHsnSacCodeInput.value = data.hsnSacCode || '';

    selectedFiles = []; imagesToDelete = [];
    if (imagePreviewArea) imagePreviewArea.innerHTML = '';
    existingImageUrls = data.imageUrls || [];
    if (existingImageUrlsInput) existingImageUrlsInput.value = JSON.stringify(existingImageUrls);
    existingImageUrls.forEach(url => displayImagePreview(null, url));
    if (uploadProgressInfo) uploadProgressInfo.textContent = '';
    if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = 'Update Product'; if (deleteProductBtn) deleteProductBtn.style.display = 'inline-flex';

    productToDeleteId = firestoreId; productToDeleteName = data.productName || 'this online product';

    // <<< NEW: Set active tab and load its rate for Edit mode >>>
    setActiveRateTab('online'); // Default to 'online' tab when opening edit

    toggleWeddingFields(); toggleSqFtFields(); toggleExtraCharges();
    productModal.classList.add('active');
}


function closeProductModal() {
    if (productModal) {
        productModal.classList.remove('active');
        productToDeleteId = null;
        productToDeleteName = null;
        if (productImagesInput) productImagesInput.value = null; // Clear file input
        selectedFiles = [];
        imagesToDelete = [];
        productBeingEditedData = {}; // Clear stored data
        currentActiveRateType = 'online'; // Reset active tab
    }
}

// --- Image Handling ---
// (handleFileSelection, displayImagePreview, uploadImage, deleteStoredImage functions remain the same)
function handleFileSelection(event) { /* ... (unchanged) ... */ if (!imagePreviewArea || !productImagesInput) return; const files = Array.from(event.target.files); let currentImageCount = existingImageUrls.filter(url => !imagesToDelete.includes(url)).length + selectedFiles.length; const availableSlots = 4 - currentImageCount; if (files.length > availableSlots) { alert(`Max 4 images allowed. You have ${currentImageCount}, tried to add ${files.length}.`); productImagesInput.value = null; return; } files.forEach(file => { if (file.type.startsWith('image/')) { if (selectedFiles.length + existingImageUrls.filter(url => !imagesToDelete.includes(url)).length < 4) { selectedFiles.push(file); displayImagePreview(file, null); } } }); productImagesInput.value = null; }
function displayImagePreview(fileObject, existingUrl = null) { /* ... (unchanged) ... */ if (!imagePreviewArea) return; const previewId = existingUrl || `new-${fileObject.name}-${Date.now()}`; const previewWrapper = document.createElement('div'); previewWrapper.className = 'image-preview-item'; previewWrapper.setAttribute('data-preview-id', previewId); const img = document.createElement('img'); const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.className = 'remove-image-btn'; removeBtn.innerHTML = '&times;'; removeBtn.title = 'Remove image'; const progressBar = document.createElement('div'); progressBar.className = 'upload-progress-bar'; const progressFill = document.createElement('div'); progressBar.appendChild(progressFill); progressBar.style.display = 'none'; if (existingUrl) { img.src = existingUrl; img.onerror = () => { img.src = 'images/placeholder.png'; }; previewWrapper.imageUrl = existingUrl; removeBtn.onclick = () => { if (!imagesToDelete.includes(existingUrl)) imagesToDelete.push(existingUrl); previewWrapper.style.display = 'none'; console.log("Marked for deletion:", existingUrl); }; } else if (fileObject) { const reader = new FileReader(); reader.onload = (e) => { img.src = e.target.result; }; reader.readAsDataURL(fileObject); previewWrapper.fileData = fileObject; removeBtn.onclick = () => { selectedFiles = selectedFiles.filter(f => f !== fileObject); previewWrapper.remove(); console.log("Removed new file:", fileObject.name); }; } previewWrapper.appendChild(img); previewWrapper.appendChild(removeBtn); previewWrapper.appendChild(progressBar); imagePreviewArea.appendChild(previewWrapper); }
async function uploadImage(file, productId, index) { /* ... (unchanged) ... */ if (!window.storage || !window.storageRef || !window.uploadBytesResumable || !window.getDownloadURL) throw new Error("Storage functions missing."); const previewWrapper = [...imagePreviewArea.querySelectorAll('.image-preview-item')].find(el => el.fileData === file); const progressBar = previewWrapper?.querySelector('.upload-progress-bar'); const progressFill = progressBar?.querySelector('div'); const timestamp = Date.now(); const uniqueFileName = `${timestamp}-image${index}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`; const filePath = `onlineProductImages/${productId}/${uniqueFileName}`; const fileRef = window.storageRef(window.storage, filePath); if (progressBar) progressBar.style.display = 'block'; if (progressFill) progressFill.style.width = '0%'; const uploadTask = window.uploadBytesResumable(fileRef, file); return new Promise((resolve, reject) => { uploadTask.on('state_changed', (snapshot) => { const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100; if (progressFill) progressFill.style.width = `${progress}%`; if (uploadProgressInfo) uploadProgressInfo.textContent = `Uploading ${file.name}: ${progress.toFixed(0)}%`; }, (error) => { console.error(`Upload failed:`, error); if (progressBar) progressBar.style.backgroundColor = 'red'; if (uploadProgressInfo) uploadProgressInfo.textContent = `Upload failed: ${file.name}.`; reject(error); }, async () => { if (progressBar) progressBar.style.backgroundColor = 'var(--success-color)'; if (uploadProgressInfo) uploadProgressInfo.textContent = `Getting URL...`; try { const downloadURL = await window.getDownloadURL(uploadTask.snapshot.ref); resolve(downloadURL); } catch (error) { if (progressBar) progressBar.style.backgroundColor = 'red'; if (uploadProgressInfo) uploadProgressInfo.textContent = `Failed to get URL.`; reject(error); } }); }); }
async function deleteStoredImage(imageUrl) { /* ... (unchanged) ... */ if (!window.storage || !window.storageRef || !window.deleteObject) return; if (!imageUrl || !(imageUrl.startsWith('https://firebasestorage.googleapis.com/') || imageUrl.startsWith('gs://'))) return; try { const imageRef = window.storageRef(window.storage, imageUrl); await window.deleteObject(imageRef); console.log("Deleted image from Storage:", imageUrl); } catch (error) { if (error.code === 'storage/object-not-found') console.warn("Image not found:", imageUrl); else console.error("Error deleting image:", imageUrl, error); } }


// --- <<< UPDATED: handleSaveProduct Function (v_TabbedPricing) >>> ---
async function handleSaveProduct(event) {
    event.preventDefault();
    if (!window.db || !window.collection || !window.addDoc || !window.doc || !window.updateDoc || !window.serverTimestamp || !window.storage) { showToast("Core Firebase functions unavailable.", 5000); return; }
    if (saveProductBtn) saveProductBtn.disabled = true; if (saveSpinner) saveSpinner.style.display = 'inline-block'; if (saveIcon) saveIcon.style.display = 'none'; if (saveText) saveText.textContent = 'Saving...'; if (uploadProgressInfo) uploadProgressInfo.textContent = 'Preparing data...';

    const editingProductId = editProductIdInput?.value;
    const isEditing = !!editingProductId;
    let finalProductId = editingProductId;

    // --- Validation (Basic Fields) ---
    const productName = productNameInput?.value.trim();
    const category = productCategoryInput?.value.trim();
    const unit = productUnitSelect?.value || null;
    if (!productName || !category || !unit) {
        showToast("Product Name, Category, and Unit are required.", 5000);
        // Restore button state
        if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product'; if (uploadProgressInfo) uploadProgressInfo.textContent = '';
        return;
    }

    // --- Validation (Pricing Fields) ---
    const currentRateValue = parseNumericInput(currentRateInput?.value); // Get value from single input
    const purchasePrice = parseNumericInput(productPurchasePriceInput?.value);
    const mrp = parseNumericInput(productMrpInput?.value);
    const gstRate = parseNumericInput(productGstRateInput?.value);
    const minOrderValue = parseNumericInput(productMinOrderValueInput?.value);
    const designCharge = parseNumericInput(designChargeInput?.value);
    const printingCharge = parseNumericInput(printingChargeInput?.value);
    const transportCharge = parseNumericInput(transportChargeInput?.value);
    const extraMarginPercent = parseNumericInput(extraMarginPercentInput?.value);
    const extraChargeAmount = parseNumericInput(extraChargeAmountInput?.value);

    // Validate the CURRENTLY EDITED rate field specifically
    if (currentRateValue === null || isNaN(currentRateValue)) {
        showToast(`Please enter a valid ${RATE_TYPES[currentActiveRateType].label}.`, 5000);
        if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product'; if (uploadProgressInfo) uploadProgressInfo.textContent = '';
        return;
    }

    // Validate other optional numeric fields
    if ([purchasePrice, mrp, gstRate, minOrderValue, designCharge, printingCharge, transportCharge, extraMarginPercent, extraChargeAmount].some(isNaN)) {
        showToast("Please enter valid numbers for optional prices/charges.", 5000);
        if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product'; if (uploadProgressInfo) uploadProgressInfo.textContent = '';
        return;
    }

    // --- Prepare Base Product Data ---
    const productData = {
        productName: productName, productName_lowercase: productName.toLowerCase(),
        category: category, category_lowercase: category.toLowerCase(),
        unit: unit, description: productDescInput?.value.trim() || '',
        isEnabled: isEnabledCheckbox?.checked ?? true,
        options: [], // Handled later
        brand: productBrandInput?.value.trim() || null,
        itemCode: productItemCodeInput?.value.trim() || null,
        hsnSacCode: productHsnSacCodeInput?.value.trim() || null,
        updatedAt: window.serverTimestamp(),
        // Initialize pricing - start with existing data if editing, or empty if adding
        pricing: isEditing ? (productBeingEditedData.pricing || {}) : {}
    };
    if (!isEditing) {
        productData.createdAt = window.serverTimestamp();
        productData.imageUrls = [];
    }

    // --- Update Pricing based on Active Tab and Checkboxes ---
    const activeField = RATE_TYPES[currentActiveRateType].field;
    productData.pricing[activeField] = currentRateValue; // Set the rate for the active tab

    // Apply to other rates based on checkboxes
    const applyCheckboxes = applyRateCheckboxesContainer?.querySelectorAll('input[name="applyRateTo"]:checked') ?? [];
    applyCheckboxes.forEach(checkbox => {
        const targetRateType = checkbox.value; // e.g., 'retail'
        if (RATE_TYPES[targetRateType]) {
            const targetField = RATE_TYPES[targetRateType].field;
            productData.pricing[targetField] = currentRateValue;
            console.log(`Applied ${currentActiveRateType} rate to ${targetRateType}.`);
        }
    });

    // --- Add/Update OTHER pricing fields ---
    if (purchasePrice !== null) productData.pricing.purchasePrice = purchasePrice;
    if (mrp !== null) productData.pricing.mrp = mrp;
    if (gstRate !== null) productData.pricing.gstRate = gstRate;
    if (unit === 'Sq Feet' && minOrderValue !== null) productData.pricing.minimumOrderValue = minOrderValue;
    // Wedding card specific
    if (category.toLowerCase().includes('wedding card')) {
        if (designCharge !== null) productData.pricing.designCharge = designCharge;
        if (printingCharge !== null) productData.pricing.printingChargeBase = printingCharge;
        if (transportCharge !== null) productData.pricing.transportCharge = transportCharge;
        if (extraMarginPercent !== null) productData.pricing.extraMarginPercent = extraMarginPercent;
    }
    // Extra charges
    productData.pricing.hasExtraCharges = hasExtraChargesCheckbox?.checked ?? false;
    if (productData.pricing.hasExtraCharges) {
        productData.pricing.extraCharge = {
            name: extraChargeNameInput?.value.trim() || 'Additional Charge',
            amount: extraChargeAmount ?? 0
        };
    } else {
         // Ensure extraCharge field is removed or nulled if checkbox is unchecked
         delete productData.pricing.extraCharge;
    }
    // --- End OTHER pricing fields ---

    // Parse and validate Options JSON
    const optionsString = productOptionsInput?.value.trim();
    if (optionsString) {
        try {
            productData.options = JSON.parse(optionsString);
            if (!Array.isArray(productData.options)) throw new Error("Options must be an array.");
        } catch (err) {
            showToast('Error: Invalid JSON in Options field.', 5000);
            if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product'; if (uploadProgressInfo) uploadProgressInfo.textContent = '';
            return;
        }
    }

    console.log("Final product data to save:", JSON.parse(JSON.stringify(productData))); // Log data before save


    // Start Save/Upload Process
    try {
        // === Step 1: Create/Update Firestore Doc (Get ID if new) ===
        if (isEditing) {
            if (uploadProgressInfo) uploadProgressInfo.textContent = 'Updating product info...';
            const productRef = window.doc(window.db, "onlineProducts", finalProductId);
            // Create final update payload excluding timestamps that shouldn't be overwritten
            const updatePayload = { ...productData };
            delete updatePayload.createdAt; // Don't overwrite createdAt on update
            await window.updateDoc(productRef, updatePayload);
            console.log("Product info updated:", finalProductId);
        } else {
            if (uploadProgressInfo) uploadProgressInfo.textContent = 'Creating product entry...';
            const docRef = await window.addDoc(window.collection(window.db, "onlineProducts"), productData);
            finalProductId = docRef.id;
            console.log("New product created:", finalProductId);
        }

        // === Step 2: Handle Image Operations ===
        let uploadedImageUrls = [];
        let currentExistingUrls = isEditing ? (productBeingEditedData.imageUrls || []) : [];

        // Delete marked images
        if (isEditing && imagesToDelete.length > 0) {
            if (uploadProgressInfo) uploadProgressInfo.textContent = 'Deleting images...';
            const deletePromises = imagesToDelete.map(url => deleteStoredImage(url));
            await Promise.allSettled(deletePromises);
            currentExistingUrls = currentExistingUrls.filter(url => !imagesToDelete.includes(url));
        }

        // Upload new images
        if (selectedFiles.length > 0) {
            if (uploadProgressInfo) uploadProgressInfo.textContent = `Uploading ${selectedFiles.length} images...`;
            if (!finalProductId) throw new Error("Product ID missing for upload.");
            const uploadPromises = selectedFiles.map((file, index) => uploadImage(file, finalProductId, index));
            const uploadResults = await Promise.allSettled(uploadPromises);
            uploadedImageUrls = [];
            let uploadErrorOccurred = false;
            uploadResults.forEach((result, index) => {
                if (result.status === 'fulfilled') { uploadedImageUrls.push(result.value); }
                else { console.error(`Upload failed:`, result.reason); uploadErrorOccurred = true; }
            });
            if (uploadErrorOccurred) { showToast("Some images failed upload.", 5000); }
            else { if (uploadProgressInfo) uploadProgressInfo.textContent = 'Images uploaded!'; }
        } else {
            console.log("No new images selected.");
            if (uploadProgressInfo) uploadProgressInfo.textContent = 'Processing...';
        }

        // === Step 3: Final Firestore Update with Image URLs ===
        const finalImageUrls = [...currentExistingUrls, ...uploadedImageUrls];
        let needsUrlUpdate = true;
         // Check if image URLs actually changed compared to the initial state
         if (isEditing) {
              const originalUrls = JSON.parse(existingImageUrlsInput?.value || '[]');
              // Sort both arrays before comparing to handle order differences
              if (JSON.stringify(originalUrls.slice().sort()) === JSON.stringify(finalImageUrls.slice().sort())) {
                   needsUrlUpdate = false;
              }
         } else {
             // Always update if it's a new product and there are images
             needsUrlUpdate = finalImageUrls.length > 0;
         }

        if (needsUrlUpdate) {
            if (uploadProgressInfo) uploadProgressInfo.textContent = 'Finalizing image URLs...';
            const finalProductRef = window.doc(window.db, "onlineProducts", finalProductId);
            await window.updateDoc(finalProductRef, {
                imageUrls: finalImageUrls,
                updatedAt: window.serverTimestamp() // Update timestamp again after image ops
            });
             console.log(`Image URLs updated for product ${finalProductId}`);
        } else {
             console.log(`Image URLs unchanged for product ${finalProductId}, skipping final URL update.`);
            if (uploadProgressInfo) uploadProgressInfo.textContent = 'Finishing...';
        }

        showToast(isEditing ? 'Product updated successfully!' : 'Product added successfully!', 3000);
        closeProductModal();

    } catch (error) {
        console.error("Save/upload error:", error);
        showToast(`Error saving product: ${error.message || 'Unknown error'}. Check console.`, 5000);
    } finally {
        // Restore button state
        if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product'; if (uploadProgressInfo) setTimeout(() => { if (uploadProgressInfo) uploadProgressInfo.textContent = ''; }, 3000);
    }
}
// --- <<< END: UPDATED handleSaveProduct >>> ---


// --- Delete Handling ---
// (handleDeleteButtonClick, closeDeleteConfirmModal, handleConfirmCheckboxChange, handleFinalDelete functions remain the same)
function handleDeleteButtonClick(event) { /* ... (unchanged) ... */ event.preventDefault(); if (!productToDeleteId || !productToDeleteName) return; if (deleteWarningMessage) deleteWarningMessage.innerHTML = `Are you sure you want to delete "<strong>${escapeHtml(productToDeleteName)}</strong>"? <br>This will also delete its images. This action cannot be undone.`; if(deleteConfirmCheckbox) deleteConfirmCheckbox.checked = false; if(confirmDeleteFinalBtn) confirmDeleteFinalBtn.disabled = true; if(deleteConfirmModal) deleteConfirmModal.classList.add('active'); }
function closeDeleteConfirmModal() { /* ... (unchanged) ... */ if (deleteConfirmModal) { deleteConfirmModal.classList.remove('active'); } }
function handleConfirmCheckboxChange() { /* ... (unchanged) ... */ if (deleteConfirmCheckbox && confirmDeleteFinalBtn) { confirmDeleteFinalBtn.disabled = !deleteConfirmCheckbox.checked; } }
async function handleFinalDelete() { /* ... (unchanged) ... */ if (!deleteConfirmCheckbox?.checked || !productToDeleteId) return; if (!window.db || !window.doc || !window.getDoc || !window.deleteDoc || !window.storage || !window.storageRef || !window.deleteObject) { showToast("Core Firebase functions unavailable.", 5000); return; } if(confirmDeleteFinalBtn) { confirmDeleteFinalBtn.disabled = true; confirmDeleteFinalBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...'; } const productRef = window.doc(window.db, "onlineProducts", productToDeleteId); try { const productSnap = await window.getDoc(productRef); if (productSnap.exists()) { const productData = productSnap.data(); if (productData.imageUrls && Array.isArray(productData.imageUrls) && productData.imageUrls.length > 0) { const deletePromises = productData.imageUrls.map(url => deleteStoredImage(url)); await Promise.allSettled(deletePromises); } } await window.deleteDoc(productRef); showToast(`Product "${productToDeleteName || ''}" deleted!`); closeDeleteConfirmModal(); closeProductModal(); } catch (error) { console.error(`Error deleting ${productToDeleteId}:`, error); showToast(`Failed to delete: ${error.message}`, 5000); } finally { if(confirmDeleteFinalBtn) { confirmDeleteFinalBtn.disabled = !deleteConfirmCheckbox?.checked; confirmDeleteFinalBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Confirm Delete'; } } }

// --- END ---