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
  online: {
  field: 'rate',
  label: 'Online Customer Rate'
  },
  retail: {
  field: 'retailRate',
  label: 'Retail Shop Rate'
  },
  agent: {
  field: 'agentRate',
  label: 'Agent/Branch Rate'
  },
  reseller: {
  field: 'resellerRate',
  label: 'Reseller/Wholesale Rate'
  }
 };
 // Diagram state
 let diagramFileToUpload = null;
 let shouldRemoveDiagram = false;
 let isRateLocked = false;
 

 

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
 

  console.log("Online Product Management event listeners set up (v_Stock).");
 }
 

 // --- Show/Hide Conditional Fields ---
 function toggleWeddingFields() {
  if (!weddingFieldsContainer || !productCategoryInput) return;
  const category = productCategoryInput.value.toLowerCase();
  weddingFieldsContainer.style.display = category.includes('wedding card') ? 'block' : 'none';
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
  if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Error: DB Connection Failed.</td></tr>`; // Colspan updated to 8
  return;
  }
  if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="8" id="loadingMessage" style="text-align: center;">Loading online products...</td></tr>`; // Colspan updated to 8
  try {
  console.log(`Setting up Firestore listener for 'onlineProducts' with sort: <span class="math-inline">\{currentSortField\}\_</span>{currentSortDirection}`);
  const productsRef = window.collection(window.db, "onlineProducts");
  const q = window.query(productsRef, window.orderBy(currentSortField || 'createdAt', currentSortDirection || 'desc'));
  unsubscribeProducts = window.onSnapshot(q, (snapshot) => {
  console.log(`Received ${snapshot.docs.length} online products.`);
  allProductsCache = snapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
  }));
  applyFiltersAndRender();
  }, (error) => {
  console.error("Error fetching online products snapshot:", error);
  let colspan = 8; // Colspan updated to 8
  if (error.code === 'permission-denied') {
  if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="${colspan}" style="color: red; text-align: center;">Error loading products: Insufficient permissions. Check Firestore rules.</td></tr>`;
  } else {
  if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="${colspan}" style="color: red; text-align: center;">Error loading products. Check connection/console.</td></tr>`;
  }
  });
  } catch (error) {
  console.error("Error setting up online product listener:", error);
  if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Error setting up listener.</td></tr>`; // Colspan updated to 8
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
  if (!(name.includes(filterSearchValue) || category.includes(filterSearchValue))) {
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
  const expectedColumns = 8; // START: Updated to 8
  if (products.length === 0) {
  productTableBody.innerHTML = `<tr><td colspan="${expectedColumns}" id="noProductsMessage" style="text-align: center;">No online products found matching criteria.</td></tr>`;
  } else {
  products.forEach(product => {
  const firestoreId = product.id;
  const data = product;
  const tableRow = productTableBody.insertRow();
  tableRow.setAttribute('data-id', firestoreId);
  tableRow.style.cursor = 'pointer'; // Make the entire row clickable
 

  const name = data.productName || 'N/A';
  const category = data.category || '-';
  const rate = data.pricing?.rate !== undefined ? formatCurrency(data.pricing.rate) : '-';
  const unit = data.unit || '-';
  const enabled = data.isEnabled ? 'Yes' : 'No';
  const dateAdded = formatFirestoreTimestamp(data.createdAt);
  // START: Get Current Stock value
  const currentStock = (data.stock?.currentStock !== undefined && data.stock?.currentStock !== null) ? data.stock.currentStock : 'N/A';
  // END: Get Current Stock value
 

  // Calculate Margin Percentage
  let marginPercentage = '-';
  if (data.pricing?.rate !== undefined && data.pricing?.purchasePrice !== undefined) {
  const sellingPrice = data.pricing.rate;
  const costPrice = data.pricing.purchasePrice;
  if (costPrice !== 0) {
  marginPercentage = ((sellingPrice - costPrice) / sellingPrice) * 100;
  marginPercentage = marginPercentage.toFixed(2) + '%';
  }
  }
 

  tableRow.innerHTML = `
  <td><span class="math-inline">\{escapeHtml\(name\)\}</td\>
<td\></span>{escapeHtml(category)}</td>
  <td style="text-align: right;"><span class="math-inline">\{rate\}</td\>
<td style\="text\-align\: center;"\></span>{escapeHtml(unit)}</td>
  <td style="text-align: center;"><span class="math-inline">\{enabled\}</td\>
<td style\="text\-align\: center;"\></span>{dateAdded}</td>
  <td style="text-align: right;"><span class="math-inline">\{escapeHtml\(currentStock\)\}</td\>
<td style\="text\-align\: right;"\></span>{marginPercentage}</td>
  <td style="text-align: center;">
  <button class="button edit-product-btn" style="background-color: var(--info-color); color: white; padding: 5px 8px; font-size: 0.8em; margin: 2px;" title="Edit Online Product"><i class="fas fa-edit"></i> Edit</button>
  <button class="button delete-product-btn" style="background-color: var(--danger-color); color: white; padding: 5px 8px; font-size: 0.8em; margin: 2px;" title="Delete Online Product"><i class="fas fa-trash"></i> Delete</button>
  </td>`;
 

  tableRow.addEventListener('click', () => openEditModal(firestoreId, data));
 

  const editBtn = tableRow.querySelector('.edit-product-btn');
  if (editBtn) {
  editBtn.addEventListener('click', (e) => {
  e.stopPropagation(); // Prevent row click when edit button is clicked
  openEditModal(firestoreId, data);
  });
  }
  const delBtn = tableRow.querySelector('.delete-product-btn');
  if (delBtn) {
  delBtn.addEventListener('click', (e) => {
  e.stopPropagation(); // Prevent row click when delete button is clicked
  productToDeleteId = firestoreId;
  productToDeleteName = data.productName || 'this online product';
  if (deleteWarningMessage) deleteWarningMessage.innerHTML = `Are you sure you want to delete the online product "<strong>${escapeHtml(productToDeleteName)}</strong>"? <br>This will also delete its images and diagram. This action cannot be undone.`;
  if (deleteConfirmCheckbox) deleteConfirmCheckbox.checked = false;
  if (confirmDeleteFinalBtn) confirmDeleteFinalBtn.disabled = true;
  if (deleteConfirmModal) deleteConfirmModal.classList.add('active');
  });
  }
  });
  }
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
  checkbox.type = 'checkbox';
  checkbox.id = checkboxId;
  checkbox.name = 'applyRateTo';
  checkbox.value = typeKey;
  checkbox.addEventListener('change', handleApplyRateCheckboxChange);
  const label = document.createElement('label');
  label.htmlFor = checkboxId;
  label.textContent = otherTypeInfo.label;
  wrapper.appendChild(checkbox);
  wrapper.appendChild(label);
  applyRateCheckboxesContainer.appendChild(wrapper);
  }
  });
  checkAndApplyLockState();
 }
 

 function handleApplyRateCheckboxChange() {
  checkAndApplyLockState();
 }
 

 function handleRateInputChange() {
  if (!currentRateInput.disabled) {
  resetApplyCheckboxesAndUnlock();
  }
 }
 

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
  isRateLocked = true;
  currentRateInput.disabled = true;
  applyRateCheckboxesContainer.querySelectorAll('input[name="applyRateTo"]').forEach(cb => cb.disabled = true);
  priceTabsContainer.querySelectorAll('.price-tab-btn').forEach(btn => {
  if (btn.dataset.rateType !== currentActiveRateType) {
  btn.disabled = true;
  }
  });
 }
 

 function unlockPricingFields() {
  if (!currentRateInput || !applyRateCheckboxesContainer || !priceTabsContainer) return;
  isRateLocked = false;
  currentRateInput.disabled = false;
  applyRateCheckboxesContainer.querySelectorAll('input[name="applyRateTo"]').forEach(cb => cb.disabled = false);
  priceTabsContainer.querySelectorAll('.price-tab-btn').forEach(btn => {
  btn.disabled = false;
  });
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
  if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-plus-circle success-icon"></i> Add New Online Product';
  if (editProductIdInput) editProductIdInput.value = '';
  productForm.reset();
  productBeingEditedData = {
  pricing: {},
  stock: {}
  }; // Initialize with stock object
 

  if (isEnabledCheckbox) isEnabledCheckbox.checked = true;
  if (hasExtraChargesCheckbox) hasExtraChargesCheckbox.checked = false;
  existingImageUrls = [];
  selectedFiles = [];
  imagesToDelete = [];
  if (imagePreviewArea) imagePreviewArea.innerHTML = '';
  if (uploadProgressInfo) uploadProgressInfo.textContent = '';
  if (existingImageUrlsInput) existingImageUrlsInput.value = '[]';
  if (saveProductBtn) saveProductBtn.disabled = false;
  if (saveSpinner) saveSpinner.style.display = 'none';
  if (saveIcon) saveIcon.style.display = '';
  if (saveText) saveText.textContent = 'Save Product';
  if (deleteProductBtn) deleteProductBtn.style.display = 'none';
 

  diagramFileToUpload = null;
  shouldRemoveDiagram = false;
  if (productDiagramInput) productDiagramInput.value = null;
  if (diagramLinkArea) diagramLinkArea.style.display = 'none';
  if (viewDiagramLink) viewDiagramLink.href = '#';
  if (diagramUploadProgress) diagramUploadProgress.textContent = '';
  if (existingDiagramUrlInput) existingDiagramUrlInput.value = '';
 

  // START: Reset Stock fields for Add Modal
  if (productCurrentStockInput) productCurrentStockInput.value = ''; // Or '0' if you prefer default
  if (productMinStockLevelInput) productMinStockLevelInput.value = '';
  // END: Reset Stock fields
 

  setActiveRateTab('online');
  unlockPricingFields();
 

  toggleWeddingFields();
  toggleSqFtFields();
  toggleExtraCharges();
  productModal.classList.add('active');
 }
 

 async function openEditModal(firestoreId, data) {
  if (!productModal || !productForm || !data) return;
  console.log("Opening modal to edit ONLINE product (v_Stock):", firestoreId);
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
 

  if (productOptionsInput) {
  try {
  productOptionsInput.value = (data.options && Array.isArray(data.options)) ? JSON.stringify(data.options, null, 2) : '';
  } catch {
  productOptionsInput.value = '';
  }
  }
  if (productBrandInput) productBrandInput.value = data.brand || '';
  if (productItemCodeInput) productItemCodeInput.value = data.itemCode || '';
  if (productHsnSacCodeInput) productHsnSacCodeInput.value = data.hsnSacCode || '';
 

  // START: Load Stock fields for Edit Modal
  const stock = data.stock || {};
  if (productCurrentStockInput) productCurrentStockInput.value = stock.currentStock ?? '';
  if (productMinStockLevelInput) productMinStockLevelInput.value = stock.minStockLevel ?? '';
  // END: Load Stock fields
 

  selectedFiles = [];
  imagesToDelete = [];
  if (imagePreviewArea) imagePreviewArea.innerHTML = '';
  existingImageUrls = data.imageUrls || [];
  if (existingImageUrlsInput) existingImageUrlsInput.value = JSON.stringify(existingImageUrls);
  existingImageUrls.forEach(url => displayImagePreview(null, url));
  if (uploadProgressInfo) uploadProgressInfo.textContent = '';
 

  diagramFileToUpload = null;
  shouldRemoveDiagram = false;
  const currentDiagramUrl = data.diagramUrl || '';
  if (productDiagramInput) productDiagramInput.value = null;
  if (existingDiagramUrlInput) existingDiagramUrlInput.value = currentDiagramUrl;
  if (diagramLinkArea && viewDiagramLink) {
  if (currentDiagramUrl) {
  viewDiagramLink.href = currentDiagramUrl;
  diagramLinkArea.style.display = 'block';
  } else {
  diagramLinkArea.style.display = 'none';
  }
  }
  if (diagramUploadProgress) diagramUploadProgress.textContent = '';
 

  if (saveProductBtn) saveProductBtn.disabled = false;
  if (saveSpinner) saveSpinner.style.display = 'none';
  if (saveIcon) saveIcon.style.display = '';
  if (saveText) saveText.textContent = 'Update Product';
  if (deleteProductBtn) deleteProductBtn.style.display = 'inline-flex';
 

  productToDeleteId = firestoreId;
  productToDeleteName = data.productName || 'this online product';
 

  setActiveRateTab('online');
  unlockPricingFields();
 

  toggleWeddingFields();
  toggleSqFtFields();
  toggleExtraCharges();
  productModal.classList.add('active');
 }
 

 function closeProductModal() {
  if (productModal) {
  productModal.classList.remove('active');
  productToDeleteId = null;
  productToDeleteName = null;
  if (productImagesInput) productImagesInput.value = null;
  selectedFiles = [];
  imagesToDelete = [];
  productBeingEditedData = {};
  currentActiveRateType = 'online';
  diagramFileToUpload = null;
  shouldRemoveDiagram = false;
  if (productDiagramInput) productDiagramInput.value = null;
  unlockPricingFields();
  }
 }
 

 // --- Image Handling ---
 function handleFileSelection(event) {
  if (!imagePreviewArea || !productImagesInput) return;
  const files = Array.from(event.target.files);
  let current