// js/manage-online-products.js
  // Updated Version: Layout changes + Diagram Upload + Checkbox Lock/Unlock Logic + Fixes + STOCK MANAGEMENT
  
  // --- Firebase Function Availability Check ---
  // Expecting: window.db, window.auth, window.storage, window.collection, window.onSnapshot, आदि।
  
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
  const extraChargeAmountInput = documentgetElementById('extraChargeAmount');
  
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
      if (productTableBody) productTableBody.innerHTML =
          `<tr><td colspan="9" id="loadingMessage" style="text-align: center;">Loading online products...</td></tr>`; // Colspan updated to 9
      try {
          console.log(`Setting up Firestore listener for 'onlineProducts' with sort: ${currentSortField}_${currentSortDirection}`);
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
              let colspan = 9; // Colspan updated to 9
              if (error.code === 'permission-denied') {
                  if (productTableBody) productTableBody.innerHTML =
                      `<tr><td colspan="${colspan}" style="color: red; text-align: center;">Error loading products: Insufficient permissions. Check Firestore rules.</td></tr>`;
              } else {
                  if (productTableBody) productTableBody.innerHTML =
                      `<tr><td colspan="${colspan}" style="color: red; text-align: center;">Error loading products. Check connection/console.</td></tr>`;
              }
          });
      } catch (error) {
          console.error("Error setting up online product listener:", error);
          if (productTableBody) productTableBody.innerHTML =
              `<tr><td colspan="9" style="color: red; text-align: center;">Error setting up listener.</td></tr>`; // Colspan updated to 9
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
              if (!(name.includes(filterSearchValue) || category.includes(filterSearchValue) || brand.includes(filterSearchValue))) {
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
      const expectedColumns = 10; // START: Updated to 10 (including checkbox)
      if (products.length === 0) {
          productTableBody.innerHTML =
              `<tr><td colspan="${expectedColumns}" id="noProductsMessage" style="text-align: center;">No online products found matching criteria.</td></tr>`;
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
              const currentStock = (data.stock?.currentStock !== undefined && data.stock?.currentStock !== null) ?
                  data.stock.currentStock : 'N/A';
              // END: Get Current Stock value
  
              tableRow.innerHTML = `
                  <td><input type="checkbox" class="product-checkbox" value="${firestoreId}"></td>  <td>${escapeHtml(name)}</td>
                  <td>${escapeHtml(category)}</td>
                  <td>${escapeHtml(brand)}</td>
                  <td style="text-align: right;">${rate}</td>
                  <td style="text-align: center;">${escapeHtml(unit)}</td>
                  <td style="text-align: center;">${enabled}</td>
                  <td style="text-align: center;">${dateAdded}</td>
                  <td style="text-align: right;">${escapeHtml(currentStock)}</td>
                  <td style="text-align: center;">
                      <button class="button edit-product-btn"
                          style="background-color: var(--info-color); color: white; padding: 5px 8px; font-size: 0.8em; margin: 2px;"
                          title="Edit Online Product"><i class="fas fa-edit"></i> Edit</button>
                      <button class="button delete-product-btn"
                          style="background-color: var(--danger-color); color: white; padding: 5px 8px; font-size: 0.8em; margin: 2px;"
                          title="Delete Online Product"><i class="fas fa-trash"></i> Delete</button>
                  </td>`;
  
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
                      if (deleteWarningMessage) deleteWarningMessage.innerHTML =
                          `Are you sure you want to delete the online product "<strong>${escapeHtml(productToDeleteName)}</strong>"? <br>This will also delete its images and diagram. This action cannot be undone.`;
                      if (deleteConfirmCheckbox) deleteConfirmCheckbox.checked = false;
                      if (confirmDeleteFinalBtn) confirmDeleteFinalBtn.disabled = true;
                      if (deleteConfirmModal) deleteConfirmModal.classList.add('active');
                  });
              }
              const checkbox = tableRow.querySelector('.product-checkbox');
              if (checkbox) {
                  checkbox.addEventListener('change', handleProductCheckboxChange);
              }
          });
      }
  }
  
  // --- Checkbox Handling ---
  function handleSelectAllProducts() {
      const checkboxes = document.querySelectorAll('.product-checkbox');
      checkboxes.forEach(checkbox => {
          checkbox.checked = selectAllProductsCheckbox.checked;
      });
      updateSelectedProductIds();
  }
  
  function handleProductCheckboxChange() {
      updateSelectedProductIds();
  }
  
  function updateSelectedProductIds() {
      selectedProductIds = Array.from(document.querySelectorAll('.product-checkbox:checked'))
          .map(checkbox => checkbox.value);
      console.log("Selected Product IDs:", selectedProductIds);
  }
  
  // --- Batch Update Modal Functions ---
  function openBatchUpdateModal() {
      if (selectedProductIds.length === 0) {
          showToast("Please select at least one product to update.", 3000);
          return;
      }
  
      if (!batchUpdateModal) return;
      batchUpdateModal.classList.add('active');
  
      // Populate modal fields (optional - populate with data from the first selected product)
      if (selectedProductIds.length > 0) {
          const firstProductId = selectedProductIds[0];
          const firstProduct = allProductsCache.find(product => product.id === firstProductId);
          if (firstProduct) {
              // Assuming you have these input fields in your batchUpdateModal
              if (batchPurchasePrice) batchPurchasePrice.value = firstProduct?.pricing?.purchasePrice || '';
              if (batchGstRate) batchGstRate.value = firstProduct?.pricing?.gstRate || '';
              // ... populate other fields ...
              if (batchHasExtraChargesCheckbox) batchHasExtraChargesCheckbox.checked = firstProduct?.pricing?.hasExtraCharges || false;
              if (batchExtraChargesSection) batchExtraChargesSection.style.display = batchHasExtraChargesCheckbox?.checked ? 'block' : 'none';
              if (batchWeddingCardFields) batchWeddingCardFields.style.display = firstProduct?.category.toLowerCase().includes('wedding card') ? 'block' : 'none';
              if (batchDesignCharge) batchDesignCharge.value = firstProduct?.pricing?.designCharge || '';
              if (batchPrintingCharge) batchPrintingCharge.value = firstProduct?.pricing?.printingChargeBase || '';
              if (batchTransportCharge) batchTransportCharge.value = firstProduct?.pricing?.transportCharge || '';
              if (batchExtraMarginPercent) batchExtraMarginPercent.value = firstProduct?.pricing?.extraMarginPercent || '';
              if (batchExtraChargeName) batchExtraChargeName.value = firstProduct?.pricing?.extraCharge?.name || '';
              if (batchExtraChargeAmount) batchExtraChargeAmount.value = firstProduct?.pricing?.extraCharge?.amount || '';
          }
      }
  }
  
  function closeBatchUpdateModal() {
      if (batchUpdateModal) batchUpdateModal.classList.remove('active');
      if (batchUpdateForm) batchUpdateForm.reset();
  }
  
  // --- Batch Update Logic ---
  async function handleBatchUpdate() {
      if (!window.db || !window.doc || !window.updateDoc) {
          showToast("Firestore functions unavailable.", 5000);
          return;
      }
  
      if (selectedProductIds.length === 0) {
          showToast("No products selected for update.", 3000);
          return;
      }
  
      const purchasePrice = parseNumericInput(batchPurchasePrice?.value);
      const gstRate = parseNumericInput(batchGstRate?.value);
      // ... get other field values from the modal ...
      const hasExtraCharges = batchHasExtraChargesCheckbox?.checked || false;
      const extraChargeName = batchExtraChargeName?.value.trim() || 'Additional Charge';
      const extraChargeAmount = parseNumericInput(batchExtraChargeAmount?.value);
  
      const designCharge = parseNumericInput(batchDesignCharge?.value);
      const printingCharge = parseNumericInput(batchPrintingCharge?.value);
      const transportCharge = parseNumericInput(batchTransportCharge?.value);
      const extraMarginPercent = parseNumericInput(batchExtraMarginPercent?.value);
  
      if ([purchasePrice, gstRate, designCharge, printingCharge, transportCharge, extraMarginPercent, extraChargeAmount].some(isNaN)) {
          showToast("Please enter valid numbers.", 5000);
          return;
      }
  
      try {
          const updatePromises = selectedProductIds.map(async (productId) => {
              const productRef = window.doc(window.db, "onlineProducts", productId);
              const updateData = {};
  
              // Update only the fields you want to change in bulk
              if (!isNaN(purchasePrice)) updateData['pricing.purchasePrice'] = purchasePrice;
              if (!isNaN(gstRate)) updateData['pricing.gstRate'] = gstRate;
              // ... update other fields ...
              if (hasExtraCharges) {
                  updateData['pricing.hasExtraCharges'] = true;
                  updateData['pricing.extraCharge'] = {
                      name: extraChargeName,
                      amount: extraChargeAmount
                  };
              } else {
                  updateData['pricing.hasExtraCharges'] = false;
                  updateData['pricing.extraCharge'] = null;
              }
  
              if (!isNaN(designCharge)) updateData['pricing.designCharge'] = designCharge;
              if (!isNaN(printingCharge)) updateData['pricing.printingChargeBase'] = printingCharge;
              if (!isNaN(transportCharge)) updateData['pricing.transportCharge'] = transportCharge;
              if (!isNaN(extraMarginPercent)) updateData['pricing.extraMarginPercent'] = extraMarginPercent;
  
              return window.updateDoc(productRef, updateData);
          });
  
          await Promise.all(updatePromises);
          showToast("Selected products updated successfully.", 3000);
          closeBatchUpdateModal();
          // Optionally, you might want to refresh the product list here
          listenForOnlineProducts();
  
      } catch (error) {
          console.error("Error during batch update:", error);
          showToast("Error updating products. Check console.", 5000);
      }
  }
  
  // --- Pricing Tab Functions ---
  function setActiveRateTab(rateType) {
      unlockPricingFields();
      if (!RATE_TYPES[rateType] || !priceTabsContainer || !currentRateInput || !currentRateLabel || !
          applyRateCheckboxesContainer) {
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
      const checkedCheckboxes = applyRateCheckboxesContainer?.querySelectorAll('input[name="applyRateTo"]:checked') ??
          [];
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
      applyRateCheckboxesContainer.querySelectorAll('input[name="applyRateTo"]:checked').forEach(cb => cb.checked =
          false);
      unlockPricingFields();
  }
  
  function resetApplyCheckboxesAndUnlock() {
      if (!applyRateCheckboxesContainer) return;
      applyRateCheckboxesContainer.querySelectorAll('input[name="applyRateTo"]').forEach(cb => cb.checked = false);
      unlockPricingFields();
  }
  
  // --- Modal Functions ---
  function openAddModal() {
      if (!productModal || !modalTitle || !productForm || !saveProductBtn || !deleteProductBtn) return;
      productBeingEditedData = {};
      selectedFiles = [];
      imagesToDelete = [];
      existingImageUrls = [];
      diagramFileToUpload = null;
      shouldRemoveDiagram = false;
  
      modalTitle.textContent = 'Add New Online Product';
      productForm.reset();
      editProductIdInput.value = '';
      deleteProductBtn.style.display = 'none';
      saveProductBtn.textContent = 'Save Product';
      saveText.textContent = 'Save Product';
      if (saveIcon) saveIcon.style.display = 'inline-block';
      if (saveSpinner) saveSpinner.style.display = 'none';
      if (imagePreviewArea) imagePreviewArea.innerHTML = '';
      if (diagramLinkArea) diagramLinkArea.style.display = 'none';
      if (productDiagramInput) productDiagramInput.value = '';
      if (hasExtraChargesCheckbox) hasExtraChargesCheckbox.checked = false;
      if (extraChargesSection) extraChargesSection.style.display = 'none';
      setActiveRateTab('online'); // Reset to default tab
      unlockPricingFields();
      if (productModal) productModal.classList.add('active');
      if (productCategoryInput) toggleWeddingFields();
      if (productUnitSelect) toggleSqFtFields();
  }
  
  function openEditModal(id, data) {
      if (!productModal || !modalTitle || !productForm || !saveProductBtn || !deleteProductBtn) return;
      productBeingEditedData = data;
      selectedFiles = [];
      imagesToDelete = [];
      existingImageUrls = data.imageUrls || [];
      diagramFileToUpload = null;
      shouldRemoveDiagram = false;
  
      modalTitle.textContent = 'Edit Online Product';
      productForm.reset();
      editProductIdInput.value = id;
      deleteProductBtn.style.display = 'inline-block';
      saveProductBtn.textContent = 'Update Product';
      saveText.textContent = 'Update Product';
      if (saveIcon) saveIcon.style.display = 'inline-block';
      if (saveSpinner) saveSpinner.style.display = 'none';
  
      if (productNameInput) productNameInput.value = data.productName || '';
      if (productCategoryInput) productCategoryInput.value = data.category || '';
      if (productUnitSelect) productUnitSelect.value = data.unit || '';
      if (productDescInput) productDescInput.value = data.description || '';
      if (isEnabledCheckbox) isEnabledCheckbox.checked = data.isEnabled === true;
      if (productPurchasePriceInput) productPurchasePriceInput.value = data.pricing?.purchasePrice || '';
      if (productGstRateInput) productGstRateInput.value = data.pricing?.gstRate || '';
      if (productMinOrderValueInput) productMinOrderValueInput.value = data.pricing?.minOrderValue || '';
      if (productMrpInput) productMrpInput.value = data.pricing?.mrp || '';
      if (productBrandInput) productBrandInput.value = data.brand || '';
      if (productItemCodeInput) productItemCodeInput.value = data.itemCode || '';
      if (productHsnSacCodeInput) productHsnSacCodeInput.value = data.hsnSacCode || '';
      // START: Set Stock Management Fields
      if (productCurrentStockInput) productCurrentStockInput.value = data.stock?.currentStock || '';
      if (productMinStockLevelInput) productMinStockLevelInput.value = data.stock?.minStockLevel || '';
      // END: Set Stock Management Fields
      if (productOptionsInput) productOptionsInput.value = JSON.stringify(data.options || [], null, 2);
      if (hasExtraChargesCheckbox) hasExtraChargesCheckbox.checked = data.pricing?.hasExtraCharges || false;
      if (extraChargeNameInput) extraChargeNameInput.value = data.pricing?.extraCharge?.name || '';
      if (extraChargeAmountInput) extraChargeAmountInput.value = data.pricing?.extraCharge?.amount || '';
      if (existingDiagramUrlInput) existingDiagramUrlInput.value = data.diagramUrl || '';
      if (designChargeInput) designChargeInput.value = data.pricing?.designCharge || '';
      if (printingChargeInput) printingChargeInput.value = data.pricing?.printingChargeBase || '';
      if (transportChargeInput) transportChargeInput.value = data.pricing?.transportCharge || '';
      if (extraMarginPercentInput) extraMarginPercentInput.value = data.pricing?.extraMarginPercent || '';
  
      if (extraChargesSection) {
          extraChargesSection.style.display = hasExtraChargesCheckbox.checked ? 'block' : 'none';
      }
  
      // Render existing images
      if (imagePreviewArea) {
          imagePreviewArea.innerHTML = existingImageUrls.map((url, index) =>
              `<div class="image-preview-item">
                  <img src="${url}" alt="Product Image ${index + 1}">
                  <button type="button" class="remove-image-btn" data-index="${index}">&times;</button>
              </div>`
          ).join('');
  
          // Attach event listeners to remove buttons for existing images
          const removeExistingImageBtns = imagePreviewArea.querySelectorAll('.remove-image-btn');
          removeExistingImageBtns.forEach(button => {
              button.addEventListener('click', handleRemoveExistingImage);
          });
      }
  
      // Show diagram link if exists
      if (diagramLinkArea && viewDiagramLink && data.diagramUrl) {
          diagramLinkArea.style.display = 'block';
          viewDiagramLink.href = data.diagramUrl;
          viewDiagramLink.textContent = data.diagramUrl.split('/').pop() || 'View Diagram';
      } else if (diagramLinkArea) {
          diagramLinkArea.style.display = 'none';
      }
      setActiveRateTab('online');
      if (productModal) productModal.classList.add('active');
      if (productCategoryInput) toggleWeddingFields();
      if (productUnitSelect) toggleSqFtFields();
  }
  
  function closeProductModal() {
      if (productModal) productModal.classList.remove('active');
      selectedFiles = [];
      imagesToDelete = [];
      diagramFileToUpload = null;
      if (productForm) productForm.reset(); // Reset form fields
  }
  
  function handleConfirmCheckboxChange() {
      if (deleteConfirmCheckbox && confirmDeleteFinalBtn) {
          confirmDeleteFinalBtn.disabled = !deleteConfirmCheckbox.checked;
      }
  }
  
  async function handleFinalDelete() {
      if (!productToDeleteId || !window.db || !window.doc || !window.deleteDoc || !deleteConfirmModal) {
          showToast("Error: Missing required functions or product ID.", 5000);
          return;
      }
  
      if (!deleteConfirmCheckbox || !deleteConfirmCheckbox.checked) {
          showToast("Please confirm that you want to delete the product.", 3000);
          return;
      }
  
      try {
          showToast(`Deleting product...`, 20000); // Show a long-running toast
          const productRef = window.doc(window.db, "onlineProducts", productToDeleteId);
  
          // Delete associated images from storage
          if (existingImageUrls && existingImageUrls.length > 0 && window.storage && window.ref && window.deleteObject) {
              for (const imageUrl of existingImageUrls) {
                  try {
                      const imageRef = window.ref(window.storage, imageUrl);
                      await window.deleteObject(imageRef);
                      console.log(`Deleted image: ${imageUrl}`);
                  } catch (imageDeleteError) {
                      console.error(`Error deleting image ${imageUrl}:`, imageDeleteError);
                      // Optionally, continue deleting other images
                      // throw imageDeleteError; // Uncomment to stop on first error
                  }
              }
          }
  
          // Delete diagram file from storage
          const diagramUrl = existingDiagramUrlInput.value;
          if (diagramUrl && window.storage && window.ref && window.deleteObject) {
              try {
                  const diagramRef = window.ref(window.storage, diagramUrl);
                  await window.deleteObject(diagramRef);
                  console.log(`Deleted diagram: ${diagramUrl}`);
              } catch (diagramDeleteError) {
                  console.error("Error deleting diagram:", diagramDeleteError);
                  // Optionally, continue with product deletion
                  // throw diagramDeleteError;  // Uncomment to stop on error
              }
          }
  
          await window.deleteDoc(productRef);
          showToast(`Product "${productToDeleteName}" deleted successfully.`, 3000);
          closeDeleteConfirmModal();
          listenForOnlineProducts(); // Refresh the product list
      } catch (error) {
          console.error("Error deleting product:", error);
          showToast(`Error deleting product: ${error.message}`, 5000);
      } finally {
          // Hide the long-running toast
          const longToast = document.querySelector('.toast-notification');
          if (longToast && longToast.textContent === 'Deleting product...') {
              longToast.remove();
          }
      }
  }
  
  // --- Image Upload Handlers ---
  function handleFileSelection(event) {
      selectedFiles = Array.from(event.target.files).slice(0, 4); // Limit to 4 files
      if (imagePreviewArea) imagePreviewArea.innerHTML = ''; // Clear previous previews
      selectedFiles.forEach((file, index) => {
          const reader = new FileReader();
          reader.onload = (e) => {
              if (imagePreviewArea) {
                  const img = document.createElement('img');
                  img.src = e.target.result;
                  img.alt = `Selected Image ${index + 1}`;
                  const previewItem = document.createElement('div');
                  previewItem.className = 'image-preview-item';
                  previewItem.appendChild(img);
                  const removeButton = document.createElement('button');
                  removeButton.type = 'button';
                  removeButton.className = 'remove-image-btn';
                  removeButton.textContent = '&times;';
                  removeButton.dataset.index = index.toString(); // Store index
                  removeButton.addEventListener('click', handleRemoveSelectedImage); // Use a different handler
                  previewItem.appendChild(removeButton);
                  imagePreviewArea.appendChild(previewItem);
              }
          };
          reader.readAsDataURL(file);
      });
      if (productImagesInput && selectedFiles.length > 4) {
          productImagesInput.value = ''; // Clear the input
          showToast('You can only upload a maximum of 4 images.', 3000);
      }
  }
  
  function handleRemoveSelectedImage(event) { // New handler for selected images
      const index = parseInt(event.target.dataset.index, 10);
      selectedFiles.splice(index, 1);
      const previewItem = event.target.parentNode;
      if (previewItem && previewItem.parentNode) {
          previewItem.parentNode.removeChild(previewItem);
      }
      // Re-render previews
      if (imagePreviewArea) {
          imagePreviewArea.innerHTML = '';
           selectedFiles.forEach((file, i) => {
          const reader = new FileReader();
          reader.onload = (e) => {
              if (imagePreviewArea) {
                  const img = document.createElement('img');
                  img.src = e.target.result;
                  img.alt = `Selected Image ${i+ 1}`;
                  const previewItem = document.createElement('div');
                  previewItem.className = 'image-preview-item';
                  previewItem.appendChild(img);
                  const removeButton = document.createElement('button');
                  removeButton.type = 'button';
                  removeButton.className = 'remove-image-btn';
                  removeButton.textContent = '&times;';
                  removeButton.dataset.index = i.toString(); // Store index
                  removeButton.addEventListener('click', handleRemoveSelectedImage); // Use a different handler
                  previewItem.appendChild(removeButton);
                  imagePreviewArea.appendChild(previewItem);
              }
          };
          reader.readAsDataURL(file);
      });
      }
     
  
      if (productImagesInput) {
          // Create a new DataTransfer object to update the file list
          const dataTransfer = new DataTransfer();
          selectedFiles.forEach(file => dataTransfer.items.add(file));
          productImagesInput.files = dataTransfer.files;
      }
  }
  
  function handleRemoveExistingImage(event) {
      const index = parseInt(event.target.dataset.index, 10);
      const removedImageUrl = existingImageUrls[index];
      imagesToDelete.push(removedImageUrl); // Add to the deletion list
      existingImageUrls.splice(index, 1); // Remove from the current list
  
      const previewItem = event.target.parentNode;
      if (previewItem && previewItem.parentNode) {
          previewItem.parentNode.removeChild(previewItem); // Remove preview
      }
  
      // Update the hidden input field
      if (existingImageUrlsInput) {
          existingImageUrlsInput.value = JSON.stringify(existingImageUrls);
      }
  }
  
  // --- Diagram Upload Handlers ---
  function handleDiagramFileSelection(event) {
      diagramFileToUpload = event.target.files[0];
      if (diagramLinkArea) diagramLinkArea.style.display = 'none'; // Hide previous link
  }
  
  function handleRemoveDiagram() {
      diagramFileToUpload = null;
      shouldRemoveDiagram = true; // Set flag to delete on save
      if (productDiagramInput) productDiagramInput.value = ''; // Clear input
      if (diagramLinkArea) diagramLinkArea.style.display = 'none'; // Hide link
  }
  
  // --- Save/Update Product Handler ---
  async function handleSaveProduct(event) {
      event.preventDefault();
  
      if (!window.db || !window.collection || !window.addDoc || !window.updateDoc || !window.serverTimestamp) {
          showToast("Firebase functions unavailable.", 5000);
          return;
      }
  
      if (!productNameInput.value.trim() || !productCategoryInput.value.trim() || !productUnitSelect.value) {
          showToast("Please fill in all required fields.", 5000);
          return;
      }
  
      const name = productNameInput.value.trim();
      const category = productCategoryInput.value.trim();
      const unit = productUnitSelect.value;
      const description = productDescInput.value.trim();
      const isEnabled = isEnabledCheckbox.checked;
      const purchasePrice = parseNumericInput(productPurchasePriceInput.value);
      const gstRate = parseNumericInput(productGstRateInput.value);
      const minOrderValue = parseNumericInput(productMinOrderValueInput.value);
      const mrp = parseNumericInput(productMrpInput.value);
      const brand = productBrandInput.value.trim();
      const itemCode = productItemCodeInput.value.trim();
      const hsnSacCode = productHsnSacCodeInput.value.trim();
      // START: Get Stock Management Field Values
      const currentStock = parseNumericInput(productCurrentStockInput.value, true, true); // Allow zero, isInteger
      const minStockLevel = parseNumericInput(productMinStockLevelInput.value, true, true); // Allow zero, isInteger
      // END: Get Stock Management Field Values
      let options = [];
      try {
          options = JSON.parse(productOptionsInput.value || '[]');
          if (!Array.isArray(options)) {
              throw new Error("Options must be an array.");
          }
          for (const option of options) {
              if (!option.name || !Array.isArray(option.values)) {
                  throw new Error("Each option must have a name and an array of values.");
              }
          }
      } catch (e) {
          showToast("Invalid options format. Please use the specified JSON format.", 5000);
          return;
      }
      const hasExtraCharges = hasExtraChargesCheckbox.checked;
      const extraChargeName = extraChargeNameInput.value.trim() || 'Additional Charge';
      const extraChargeAmount = parseNumericInput(extraChargeAmountInput.value);
  
      const designCharge = parseNumericInput(designChargeInput.value);
      const printingCharge = parseNumericInput(printingChargeInput.value);
      const transportCharge = parseNumericInput(transportChargeInput.value);
      const extraMarginPercent = parseNumericInput(extraMarginPercentInput.value);
  
      if ([purchasePrice, gstRate, minOrderValue, mrp, extraChargeAmount, designCharge, printingCharge, transportCharge, extraMarginPercent].some(isNaN)) {
          showToast("Please enter valid numeric values for all price fields.", 5000);
          return;
      }
  
      if (saveSpinner) saveSpinner.style.display = 'inline-block';
      if (saveIcon) saveIcon.style.display = 'none';
      if (saveText) saveText.textContent = 'Saving...';
      saveProductBtn.disabled = true;
  
      const pricingData = {
          purchasePrice: purchasePrice ?? 0,
          gstRate: gstRate ?? 0,
          hasExtraCharges,
          extraCharge: hasExtraCharges ? { name: extraChargeName, amount: extraChargeAmount ?? 0 } : null,
          minOrderValue: minOrderValue ?? null,
          mrp: mrp ?? null,
          designCharge: designCharge ?? 0,
          printingChargeBase: printingCharge ?? 0,
          transportCharge: transportCharge ?? 0,
          extraMarginPercent: extraMarginPercent ?? 0,
      };
  
      // Include other rates
      Object.keys(RATE_TYPES).forEach(rateType => {
          const field = RATE_TYPES[rateType].field;
          pricingData[field] = productBeingEditedData?.pricing?.[field] ?? 0;
      });
      const rateValue = parseNumericInput(currentRateInput.value);
      if (rateValue !== null) {
          pricingData[RATE_TYPES[currentActiveRateType].field] = rateValue;
      }
  
      const stockData = { // START: Construct Stock Data object
          currentStock: currentStock ?? 0,
          minStockLevel: minStockLevel ?? null,
      }; // END: Construct Stock Data object
  
      let diagramUrl = existingDiagramUrlInput.value;
      try {
          if (diagramFileToUpload) {
              const diagramRef = window.ref(window.storage, `diagrams/${diagramFileToUpload.name}`);
              const uploadTask = window.uploadBytesResumable(diagramRef, diagramFileToUpload);
  
              await new Promise((resolve, reject) => {
                  uploadTask.on('state_changed',
                      (snapshot) => {
                          // Track the upload progress.
                          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                          if (diagramUploadProgress) {
                              diagramUploadProgress.textContent = `Uploaded ${progress.toFixed(2)}%`;
                          }
                      },
                      (error) => {
                          reject(error);
                      },
                      () => {
                          resolve(uploadTask.snapshot);
                      }
                  );
              });
              diagramUrl = await window.getDownloadURL(uploadTask.snapshot.ref);
          } else if (shouldRemoveDiagram) {
              diagramUrl = ''; // Set to empty to remove
          }
  
          const imageUrls = [...existingImageUrls];
          if (selectedFiles && selectedFiles.length > 0) {
              const uploadPromises = selectedFiles.map(async (file, index) => {
                  const imageRef = window.ref(window.storage, `product_images/${name.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}_${index + 1}`);
                  const uploadTask = window.uploadBytesResumable(imageRef, file);
  
                  await new Promise((resolve, reject) => {
                      uploadTask.on('state_changed',
                          (snapshot) => {
                              // Track the upload progress
                              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                              if (uploadProgressInfo) {
                                  uploadProgressInfo.textContent = `Uploaded ${progress.toFixed(2)}%`;
                              }
                          },
                          (error) => {
                              reject(error);
                          },
                          () => {
                              resolve(uploadTask.snapshot);
                          }
                      );
                  });
  
                  const downloadURL = await window.getDownloadURL(uploadTask.snapshot.ref);
                  return downloadURL;
              });
              const newImageUrls = await Promise.all(uploadPromises);
              imageUrls.push(...newImageUrls);
          }
  
           // Delete images marked for deletion
           if (imagesToDelete && imagesToDelete.length > 0 && window.storage && window.ref && window.deleteObject) {
              for (const urlToDelete of imagesToDelete) {
                  try {
                      const imageRefToDelete = window.ref(window.storage, urlToDelete);
                      await window.deleteObject(imageRefToDelete);
                      console.log(`Deleted image: ${urlToDelete}`);
                  } catch (deleteError) {
                      console.error(`Failed to delete image: ${urlToDelete}`, deleteError);
                      // Optionally, you can choose to stop the whole process or continue deleting other images.
                      //  throw deleteError; // Uncomment this line to stop the process.
                  }
              }
          }
  
          const productData = {
              productName: name,
              category,
              unit,
              description,
              isEnabled,
              pricing: pricingData,
              stock: stockData, // Include stock data
              brand,
              itemCode,
              hsnSacCode,
              options,
              imageUrls,
              diagramUrl,
              createdAt: productBeingEditedData?.createdAt || window.serverTimestamp() // Keep the original creation time
          };
  
          if (editProductIdInput.value) {
              // Update existing product
              const productId = editProductIdInput.value;
              const productRef = window.doc(window.db, "onlineProducts", productId);
              await window.updateDoc(productRef, productData);
              showToast(`Product "${name}" updated successfully.`, 3000);
          } else {
              // Add new product
              const docRef = await window.addDoc(window.collection(window.db, "onlineProducts"), productData);
              showToast(`Product "${name}" added successfully.`, 3000);
          }
  
          closeProductModal();
          listenForOnlineProducts(); // Refresh product list
  
      } catch (error) {
          console.error("Error saving product:", error);
          showToast(`Error saving product: ${error.message}`, 5000);
      } finally {
          if (saveSpinner) saveSpinner.style.display = 'none';
          if (saveIcon) saveIcon.style.display = 'inline-block';
          if (saveText) saveText.textContent = saveProductBtn.textContent || 'Save Product';
          saveProductBtn.disabled = false;
      }
  }
  
  // --- Delete Confirmation ---
  function handleDeleteButtonClick() {
      if (deleteConfirmModal) deleteConfirmModal.classList.add('active');
  }
  
  function closeDeleteConfirmModal() {
      if (deleteConfirmModal) deleteConfirmModal.classList.remove('active');
      if (deleteConfirmCheckbox) deleteConfirmCheckbox.checked = false;
      if (confirmDeleteFinalBtn) confirmDeleteFinalBtn.disabled = true;
  }
  
  // --- Diagram File Selection ---
  function handleDiagramFileSelection(event) {
      diagramFileToUpload = event.target.files[0];
      if (diagramLinkArea) diagramLinkArea.style.display = 'none'; // Hide previous link
  }
  
  function handleRemoveDiagram() {
      diagramFileToUpload = null;
      shouldRemoveDiagram = true;
      if (productDiagramInput) productDiagramInput.value = '';
      if (diagramLinkArea) diagramLinkArea.style.display = 'none';
  }
  
  // --- Price Tab Switching ---
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
      applyRateCheckboxesContainer.querySelectorAll('input[name="applyRateTo"]:checked').forEach(cb => cb.checked =
          false);
      resetApplyCheckboxesAndUnlock();
  }
  
  function resetApplyCheckboxesAndUnlock() {
      if (!applyRateCheckboxesContainer) return;
      applyRateCheckboxesContainer.querySelectorAll('input[name="applyRateTo"]').forEach(cb => cb.checked = false);
      unlockPricingFields();
  }
  
  // --- Modal Functions ---
  function openAddModal() {
      if (!productModal || !modalTitle || !productForm || !saveProductBtn || !deleteProductBtn) return;
      productBeingEditedData = {};
      selectedFiles = [];
      imagesToDelete = [];
      existingImageUrls = [];
      diagramFileToUpload = null;
      shouldRemoveDiagram = false;
  
      modalTitle.textContent = 'Add New Online Product';
      productForm.reset();
      editProductIdInput.value = '';
      deleteProductBtn.style.display = 'none';
      saveProductBtn.textContent = 'Save Product';
      saveText.textContent = 'Save Product';
      if (saveIcon) saveIcon.style.display = 'inline-block';
      if (saveSpinner) saveSpinner.style.display = 'none';
      if (imagePreviewArea) imagePreviewArea.innerHTML = '';
      if (diagramLinkArea) diagramLinkArea.style.display = 'none';
      if (productDiagramInput) productDiagramInput.value = '';
      if (hasExtraChargesCheckbox) hasExtraChargesCheckbox.checked = false;
      if (extraChargesSection) extraChargesSection.style.display = 'none';
      setActiveRateTab('online'); // Reset to default tab
      unlockPricingFields();
      if (productModal) productModal.classList.add('active');
      if (productCategoryInput) toggleWeddingFields();
      if (productUnitSelect) toggleSqFtFields();
  }
  
  function openEditModal(id, data) {
      if (!productModal || !modalTitle || !productForm || !saveProductBtn || !deleteProductBtn) return;
      productBeingEditedData = data;
      selectedFiles = [];
      imagesToDelete = [];
      existingImageUrls = data.imageUrls || [];
      diagramFileToUpload = null;
      shouldRemoveDiagram = false;
  
      modalTitle.textContent = 'Edit Online Product';
      productForm.reset();
      editProductIdInput.value = id;
      deleteProductBtn.style.display = 'inline-block';
      saveProductBtn.textContent = 'Update Product';
      saveText.textContent = 'Update Product';
      if (saveIcon) saveIcon.style.display = 'inline-block';
      if (saveSpinner) saveSpinner.style.display = 'none';
  
      if (productNameInput) productNameInput.value = data.productName || '';
      if (productCategoryInput) productCategoryInput.value = data.category || '';
      if (productUnitSelect) productUnitSelect.value = data.unit || '';
      if (productDescInput) productDescInput.value = data.description || '';
      if (isEnabledCheckbox) isEnabledCheckbox.checked = data.isEnabled === true;
      if (productPurchasePriceInput) productPurchasePriceInput.value = data.pricing?.purchasePrice || '';
      if (productGstRateInput) productGstRateInput.value = data.pricing?.gstRate || '';
      if (productMinOrderValueInput) productMinOrderValueInput.value = data.pricing?.minOrderValue || '';
      if (productMrpInput) productMrpInput.value = data.pricing?.mrp || '';
      if (productBrandInput) productBrandInput.value = data.brand || '';
      if (productItemCodeInput) productItemCodeInput.value = data.itemCode || '';
      if (productHsnSacCodeInput) productHsnSacCodeInput.value = data.hsnSacCode || '';
      // START: Set Stock Management Fields
      if (productCurrentStockInput) productCurrentStockInput.value = data.stock?.currentStock || '';
      if (productMinStockLevelInput) productMinStockLevelInput.value = data.stock?.minStockLevel || '';
      // END: Set Stock Management Fields
      if (productOptionsInput) productOptionsInput.value = JSON.stringify(data.options || [], null, 2);
      if (hasExtraChargesCheckbox) hasExtraChargesCheckbox.checked = data.pricing?.hasExtraCharges || false;
      if (extraChargeNameInput) extraChargeNameInput.value = data.pricing?.extraCharge?.name || '';
      if (extraChargeAmountInput) extraChargeAmountInput.value = data.pricing?.extraCharge?.amount || '';
      if (existingDiagramUrlInput) existingDiagramUrlInput.value = data.diagramUrl || '';
      if (designChargeInput) designChargeInput.value = data.pricing?.designCharge || '';
      if (printingChargeInput) printingChargeInput.value = data.pricing?.printingChargeBase || '';
      if (transportChargeInput) transportChargeInput.value = data.pricing?.transportCharge || '';
      if (extraMarginPercentInput) extraMarginPercentInput.value = data.pricing?.extraMarginPercent || '';
  
      if (extraChargesSection) {
          extraChargesSection.style.display =hasExtraChargesCheckbox.checked ? 'block' : 'none';
      }
  
      // Render existing images
      if (imagePreviewArea) {
          imagePreviewArea.innerHTML = existingImageUrls.map((url, index) =>
              `<div class="image-preview-item">
                  <img src="${url}" alt="Product Image ${index + 1}">
                  <button type="button" class="remove-image-btn" data-index="${index}">&times;</button>
              </div>`
          ).join('');
  
          // Attach event listeners to remove buttons for existing images
          const removeExistingImageBtns = imagePreviewArea.querySelectorAll('.remove-image-btn');
          removeExistingImageBtns.forEach(button => {
              button.addEventListener('click', handleRemoveExistingImage);
          });
      }
  
      // Show diagram link if exists
      if (diagramLinkArea && viewDiagramLink && data.diagramUrl) {
          diagramLinkArea.style.display = 'block';
          viewDiagramLink.href = data.diagramUrl;
          viewDiagramLink.textContent = data.diagramUrl.split('/').pop() || 'View Diagram';
      } else if (diagramLinkArea) {
          diagramLinkArea.style.display = 'none';
      }
      setActiveRateTab('online');
      if (productModal) productModal.classList.add('active');
      if (productCategoryInput) toggleWeddingFields();
      if (productUnitSelect) toggleSqFtFields();
  }
  
  function closeProductModal() {
      if (productModal) productModal.classList.remove('active');
      selectedFiles = [];
      imagesToDelete = [];
      diagramFileToUpload = null;
      if (productForm) productForm.reset(); // Reset form fields
  }
  
  function handleConfirmCheckboxChange() {
      if (deleteConfirmCheckbox && confirmDeleteFinalBtn) {
          confirmDeleteFinalBtn.disabled = !deleteConfirmCheckbox.checked;
      }
  }
  
  async function handleFinalDelete() {
      if (!productToDeleteId || !window.db || !window.doc || !window.deleteDoc || !deleteConfirmModal) {
          showToast("Error: Missing required functions or product ID.", 5000);
          return;
      }
  
      if (!deleteConfirmCheckbox || !deleteConfirmCheckbox.checked) {
          showToast("Please confirm that you want to delete the product.", 3000);
          return;
      }
  
      try {
          showToast(`Deleting product...`, 20000); // Show a long-running toast
          const productRef = window.doc(window.db, "onlineProducts", productToDeleteId);
  
          // Delete associated images from storage
          if (existingImageUrls && existingImageUrls.length > 0 && window.storage && window.ref && window.deleteObject) {
              for (const imageUrl of existingImageUrls) {
                  try {
                      const imageRef = window.ref(window.storage, imageUrl);
                      await window.deleteObject(imageRef);
                      console.log(`Deleted image: ${imageUrl}`);
                  } catch (imageDeleteError) {
                      console.error(`Error deleting image ${imageUrl}:`, imageDeleteError);
                      // Optionally, continue deleting other images
                      // throw imageDeleteError; // Uncomment to stop on first error
                  }
              }
          }
  
          // Delete diagram file from storage
          const diagramUrl = existingDiagramUrlInput.value;
          if (diagramUrl && window.storage && window.ref && window.deleteObject) {
              try {
                  const diagramRef = window.ref(window.storage, diagramUrl);
                  await window.deleteObject(diagramRef);
                  console.log(`Deleted diagram: ${diagramUrl}`);
              } catch (diagramDeleteError) {
                  console.error("Error deleting diagram:", diagramDeleteError);
                  // Optionally, continue with product deletion
                  // throw diagramDeleteError;  // Uncomment to stop on error
              }
          }
  
          await window.deleteDoc(productRef);
          showToast(`Product "${productToDeleteName}" deleted successfully.`, 3000);
          closeDeleteConfirmModal();
          listenForOnlineProducts(); // Refresh the product list
      } catch (error) {
          console.error("Error deleting product:", error);
          showToast(`Error deleting product: ${error.message}`, 5000);
      } finally {
          // Hide the long-running toast
          const longToast = document.querySelector('.toast-notification');
          if (longToast && longToast.textContent === 'Deleting product...') {
              longToast.remove();
          }
      }
  }
  
  // --- Image Upload Handlers ---
  function handleFileSelection(event) {
      selectedFiles = Array.from(event.target.files).slice(0, 4); // Limit to 4 files
      if (imagePreviewArea) imagePreviewArea.innerHTML = ''; // Clear previous previews
      selectedFiles.forEach((file, index) => {
          const reader = new FileReader();
          reader.onload = (e) => {
              if (imagePreviewArea) {
                  const img = document.createElement('img');
                  img.src = e.target.result;
                  img.alt = `Selected Image ${index + 1}`;
                  const previewItem = document.createElement('div');
                  previewItem.className = 'image-preview-item';
                  previewItem.appendChild(img);
                  const removeButton = document.createElement('button');
                  removeButton.type = 'button';
                  removeButton.className = 'remove-image-btn';
                  removeButton.textContent = '&times;';
                  removeButton.dataset.index = index.toString(); // Store index
                  removeButton.addEventListener('click', handleRemoveSelectedImage); // Use a different handler
                  previewItem.appendChild(removeButton);
                  imagePreviewArea.appendChild(previewItem);
              }
          };
          reader.readAsDataURL(file);
      });
      if (productImagesInput && selectedFiles.length > 4) {
          productImagesInput.value = ''; // Clear the input
          showToast('You can only upload a maximum of 4 images.', 3000);
      }
  }
  
  function handleRemoveSelectedImage(event) { // New handler for selected images
      const index = parseInt(event.target.dataset.index, 10);
      selectedFiles.splice(index, 1);
      const previewItem = event.target.parentNode;
      if (previewItem && previewItem.parentNode) {
          previewItem.parentNode.removeChild(previewItem);
      }
      // Re-render previews
      if (imagePreviewArea) {
          imagePreviewArea.innerHTML = '';
           selectedFiles.forEach((file, i) => {
          const reader = new FileReader();
          reader.onload = (e) => {
              if (imagePreviewArea) {
                  const img = document.createElement('img');
                  img.src = e.target.result;
                  img.alt = `Selected Image ${i+ 1}`;
                  const previewItem = document.createElement('div');
                  previewItem.className = 'image-preview-item';
                  previewItem.appendChild(img);
                  const removeButton = document.createElement('button');
                  removeButton.type = 'button';
                  removeButton.className = 'remove-image-btn';
                  removeButton.textContent = '&times;';
                  removeButton.dataset.index = i.toString(); // Store index
                  removeButton.addEventListener('click', handleRemoveSelectedImage); // Use a different handler
                  previewItem.appendChild(removeButton);
                  imagePreviewArea.appendChild(previewItem);
              }
          };
          reader.readAsDataURL(file);
      });
      }
     
  
      if (productImagesInput) {
          // Create a new DataTransfer object to update the file list
          const dataTransfer = new DataTransfer();
          selectedFiles.forEach(file => dataTransfer.items.add(file));
          productImagesInput.files = dataTransfer.files;
      }
  }
  
  function handleRemoveExistingImage(event) {
      const index = parseInt(event.target.dataset.index, 10);
      const removedImageUrl = existingImageUrls[index];
      imagesToDelete.push(removedImageUrl); // Add to the deletion list
      existingImageUrls.splice(index, 1); // Remove from the current list
  
      const previewItem = event.target.parentNode;
      if (previewItem && previewItem.parentNode) {
          previewItem.parentNode.removeChild(previewItem); // Remove preview
      }
  
      // Update the hidden input field
      if (existingImageUrlsInput) {
          existingImageUrlsInput.value = JSON.stringify(existingImageUrls);
      }
  }
  
  // --- Diagram File Selection ---
  function handleDiagramFileSelection(event) {
      diagramFileToUpload = event.target.files[0];
      if (diagramLinkArea) diagramLinkArea.style.display = 'none'; // Hide previous link
  }
  
  function handleRemoveDiagram() {
      diagramFileToUpload = null;
      shouldRemoveDiagram = true; // Set flag to delete on save
      if (productDiagramInput) productDiagramInput.value = ''; // Clear input
      if (diagramLinkArea) diagramLinkArea.style.display = 'none'; // Hide link
  }
  
  // --- Save/Update Product Handler ---
  async function handleSaveProduct(event) {
      event.preventDefault();
  
      if (!window.db || !window.collection || !window.addDoc || !window.updateDoc || !window.serverTimestamp) {
          showToast("Firebase functions unavailable.", 5000);
          return;
      }
  
      if (!productNameInput.value.trim() || !productCategoryInput.value.trim() || !productUnitSelect.value) {
          showToast("Please fill in all required fields.", 5000);
          return;
      }
  
      const name = productNameInput.value.trim();
      const category = productCategoryInput.value.trim();
      const unit = productUnitSelect.value;
      const description = productDescInput.value.trim();
      const isEnabled = isEnabledCheckbox.checked;
      const purchasePrice = parseNumericInput(productPurchasePriceInput.value);
      const gstRate = parseNumericInput(productGstRateInput.value);
      const minOrderValue = parseNumericInput(productMinOrderValueInput.value);
      const mrp = parseNumericInput(productMrpInput.value);
      const brand = productBrandInput.value.trim();
      const itemCode = productItemCodeInput.value.trim();
      const hsnSacCode = productHsnSacCodeInput.value.trim();
      // START: Get Stock Management Field Values
      const currentStock = parseNumericInput(productCurrentStockInput.value, true, true); // Allow zero, isInteger
      const minStockLevel = parseNumericInput(productMinStockLevelInput.value, true, true); // Allow zero, isInteger
      // END: Get Stock Management Field Values
      let options = [];
      try {
          options = JSON.parse(productOptionsInput.value || '[]');
          if (!Array.isArray(options)) {
              throw new Error("Options must be an array.");
          }
          for (const option of options) {
              if (!option.name || !Array.isArray(option.values)) {
                  throw new Error("Each option must have a name and an array of values.");
              }
          }
      } catch (e) {
          showToast("Invalid options format. Please use the specified JSON format.", 5000);
          return;
      }
      const hasExtraCharges = hasExtraChargesCheckbox.checked;
      const extraChargeName = extraChargeNameInput.value.trim() || 'Additional Charge';
      const extraChargeAmount = parseNumericInput(extraChargeAmountInput.value);
  
      const designCharge = parseNumericInput(designChargeInput.value);
      const printingCharge = parseNumericInput(printingChargeInput.value);
      const transportCharge = parseNumericInput(transportChargeInput.value);
      const extraMarginPercent = parseNumericInput(extraMarginPercentInput.value);
  
      if ([purchasePrice, gstRate, minOrderValue, mrp, extraChargeAmount, designCharge, printingCharge, transportCharge, extraMarginPercent].some(isNaN)) {
          showToast("Please enter valid numeric values for all price fields.", 5000);
          return;
      }
  
      if (saveSpinner) saveSpinner.style.display = 'inline-block';
      if (saveIcon) saveIcon.style.display = 'none';
      if (saveText) saveText.textContent = 'Saving...';
      saveProductBtn.disabled = true;
  
      const pricingData = {
          purchasePrice: purchasePrice ?? 0,
          gstRate: gstRate ?? 0,
          hasExtraCharges,
          extraCharge: hasExtraCharges ? { name: extraChargeName, amount: extraChargeAmount ?? 0 } : null,
          minOrderValue: minOrderValue ?? null,
          mrp: mrp ?? null,
          designCharge: designCharge ?? 0,
          printingChargeBase: printingCharge ?? 0,
          transportCharge: transportCharge ?? 0,
          extraMarginPercent: extraMarginPercent ?? 0,
      };
  
      // Include other rates
      Object.keys(RATE_TYPES).forEach(rateType => {
          const field = RATE_TYPES[rateType].field;
          pricingData[field] = productBeingEditedData?.pricing?.[field] ?? 0;
      });
      const rateValue = parseNumericInput(currentRateInput.value);
      if (rateValue !== null) {
          pricingData[RATE_TYPES[currentActiveRateType].field] = rateValue;
      }
  
      const stockData = { // START: Construct Stock Data object
          currentStock: currentStock ?? 0,
          minStockLevel: minStockLevel ?? null,
      }; // END: Construct Stock Data object
  
      let diagramUrl = existingDiagramUrlInput.value;
      try {
          if (diagramFileToUpload) {
              const diagramRef = window.ref(window.storage, `diagrams/${diagramFileToUpload.name}`);
              const uploadTask = window.uploadBytesResumable(diagramRef, diagramFileToUpload);
  
              await new Promise((resolve, reject) => {
                  uploadTask.on('state_changed',
                      (snapshot) => {
                          // Track the upload progress.
                          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                          if (diagramUploadProgress) {
                              diagramUploadProgress.textContent = `Uploaded ${progress.toFixed(2)}%`;
                          }
                      },
                      (error) => {
                          reject(error);
                      },
                      () => {
                          resolve(uploadTask.snapshot);
                      }
                  );
              });
              diagramUrl = await window.getDownloadURL(uploadTask.snapshot.ref);
          } else if (shouldRemoveDiagram) {
              diagramUrl = ''; // Set to empty to remove
          }
  
          const imageUrls = [...existingImageUrls];
          if (selectedFiles && selectedFiles.length > 0) {
              const uploadPromises = selectedFiles.map(async (file, index) => {
                  const imageRef = window.ref(window.storage, `product_images/${name.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}_${index + 1}`);
                  const uploadTask = window.uploadBytesResumable(imageRef, file);
  
                  await new Promise((resolve, reject) => {
                      uploadTask.on('state_changed',
                          (snapshot) => {
                              // Track the upload progress
                              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                              if (uploadProgressInfo) {
                                  uploadProgressInfo.textContent = `Uploaded ${progress.toFixed(2)}%`;
                              }
                          },
                          (error) => {
                              reject(error);
                          },
                          () => {
                              resolve(uploadTask.snapshot);
                          }
                      );
                  });
  
                  const downloadURL = await window.getDownloadURL(uploadTask.snapshot.ref);
                  return downloadURL;
              });
              const newImageUrls = await Promise.all(uploadPromises);
              imageUrls.push(...newImageUrls);
          }
  
           // Delete images marked for deletion
           if (imagesToDelete && imagesToDelete.length > 0 && window.storage && window.ref && window.deleteObject) {
              for (const urlToDelete of imagesToDelete) {
                  try {
                      const imageRefToDelete = window.ref(window.storage, urlToDelete);
                      await window.deleteObject(imageRefToDelete);
                      console.log(`Deleted image: ${urlToDelete}`);
                  } catch (deleteError) {
                      console.error(`Failed to delete image: ${urlToDelete}`, deleteError);
                      // Optionally, you can choose to stop the whole process or continue deleting other images.
                      //  throw deleteError; // Uncomment this line to stop the process.
                  }
              }
          }
  
          const productData = {
              productName: name,
              category,
              unit,
              description,
              isEnabled,
              pricing: pricingData,
              stock: stockData, // Include stock data
              brand,
              itemCode,
              hsnSacCode,
              options,
              imageUrls,
              diagramUrl,
              createdAt: productBeingEditedData?.createdAt || window.serverTimestamp() // Keep the original creation time
          };
  
          if (editProductIdInput.value) {
              // Update existing product
              const productId = editProductIdInput.value;
              const productRef = window.doc(window.db, "onlineProducts", productId);
              await window.updateDoc(productRef, productData);
              showToast(`Product "${name}" updated successfully.`, 3000);
          } else {
              // Add new product
              const docRef = await window.addDoc(window.collection(window.db, "onlineProducts"), productData);
              showToast(`Product "${name}" added successfully.`, 3000);
          }
  
          closeProductModal();
          listenForOnlineProducts(); // Refresh product list
  
      } catch (error) {
          console.error("Error saving product:", error);
          showToast(`Error saving product: ${error.message}`, 5000);
      } finally {
          if (saveSpinner) saveSpinner.style.display = 'none';
          if (saveIcon) saveIcon.style.display = 'inline-block';
          if (saveText) saveText.textContent = saveProductBtn.textContent || 'Save Product';
          saveProductBtn.disabled = false;
      }
  }
  
  // --- Delete Confirmation ---
  function handleDeleteButtonClick() {
      if (deleteConfirmModal) deleteConfirmModal.classList.add('active');
  }
  
  function closeDeleteConfirmModal() {
      if (deleteConfirmModal) deleteConfirmModal.classList.remove('active');
      if (deleteConfirmCheckbox) deleteConfirmCheckbox.checked = false;
      if (confirmDeleteFinalBtn) confirmDeleteFinalBtn.disabled = true;
  }
  
  // --- Diagram File Selection ---
  function handleDiagramFileSelection(event) {
      diagramFileToUpload = event.target.files[0];
      if (diagramLinkArea) diagramLinkArea.style.display = 'none'; // Hide previous link
  }
  
  function handleRemoveDiagram() {
      diagramFileToUpload = null;
      shouldRemoveDiagram = true; // Set flag to delete on save
      if (productDiagramInput) productDiagramInput.value = ''; // Clear input
      if (diagramLinkArea) diagramLinkArea.style.display = 'none'; // Hide link
  }
  
  // --- Price Tab Switching ---
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
      applyRateCheckboxesContainer.querySelectorAll('input[name="applyRateTo"]:checked').forEach(cb => cb.checked =
          false);
      resetApplyCheckboxesAndUnlock();
  }
  
  function resetApplyCheckboxesAndUnlock() {
      if (!applyRateCheckboxesContainer) return;
      applyRateCheckboxesContainer.querySelectorAll('input[name="applyRateTo"]').forEach(cb => cb.checked = false);
      unlockPricingFields();
  }
  
  // --- Modal Functions ---
  function openAddModal() {
      if (!productModal || !modalTitle || !productForm || !saveProductBtn || !deleteProductBtn) return;
      productBeingEditedData = {};
      selectedFiles = [];
      imagesToDelete = [];
      existingImageUrls = [];
      diagramFileToUpload = null;
      shouldRemoveDiagram = false;
  
      modalTitle.textContent = 'Add New Online Product';
      productForm.reset();
      editProductIdInput.value = '';
      deleteProductBtn.style.display = 'none';
      saveProductBtn.textContent = 'Save Product';
      saveText.textContent = 'Save Product';
      if (saveIcon) saveIcon.style.display = 'inline-block';
      if (saveSpinner) saveSpinner.style.display = 'none';
      if (imagePreviewArea) imagePreviewArea.innerHTML = '';
      if (diagramLinkArea) diagramLinkArea.style.display = 'none';
      if (productDiagramInput) productDiagramInput.value = '';
      if (hasExtraChargesCheckbox) hasExtraChargesCheckbox.checked = false;
      if (extraChargesSection) extraChargesSection.style.display = 'none';
      setActiveRateTab('online'); // Reset to default tab
      unlockPricingFields();
      if (productModal) productModal.classList.add('active');
      if (productCategoryInput) toggleWeddingFields();
      if (productUnitSelect) toggleSqFtFields();
  }
  
  function openEditModal(id, data) {
      if (!productModal || !modalTitle || !productForm || !saveProductBtn || !deleteProductBtn) return;
      productBeingEditedData = data;
      selectedFiles = [];
      imagesToDelete = [];
      existingImageUrls = data.imageUrls || [];
      diagramFileToUpload = null;
      shouldRemoveDiagram = false;
  
      modalTitle.textContent = 'Edit Online Product';
      productForm.reset();
      editProductIdInput.value = id;
      deleteProductBtn.style.display = 'inline-block';
      saveProductBtn.textContent = 'Update Product';
      saveText.textContent = 'Update Product';
      if (saveIcon) saveIcon.style.display = 'inline-block';
      if (saveSpinner) saveSpinner.style.display = 'none';
  
      if (productNameInput) productNameInput.value = data.productName || '';
      if (productCategoryInput) productCategoryInput.value = data.category || '';
      if (productUnitSelect) productUnitSelect.value = data.unit || '';
      if (productDescInput) productDescInput.value = data.description || '';
      if (isEnabledCheckbox) isEnabledCheckbox.checked = data.isEnabled === true;
      if (productPurchasePriceInput) productPurchasePriceInput.value = data.pricing?.purchasePrice || '';
      if (productGstRateInput) productGstRateInput.value = data.pricing?.gstRate || '';
      if (productMinOrderValueInput) productMinOrderValueInput.value = data.pricing?.minOrderValue || '';
      if (productMrpInput) productMrpInput.value = data.pricing?.mrp || '';
      if (productBrandInput) productBrandInput.value = data.brand || '';
      if (productItemCodeInput) productItemCodeInput.value = data.itemCode || '';
      if (productHsnSacCodeInput) productHsnSacCodeInput.value = data.hsnSacCode || '';
      // START: Set Stock Management Fields
      if (productCurrentStockInput) productCurrentStockInput.value = data.stock?.currentStock || '';
      if (productMinStockLevelInput) productMinStockLevelInput.value = data.stock?.minStockLevel || '';
      // END: Set Stock Management Fields
      if (productOptionsInput) productOptionsInput.value = JSON.stringify(data.options || [], null, 2);
      if (hasExtraChargesCheckbox) hasExtraChargesCheckbox.checked = data.pricing?.hasExtraCharges || false;
      if (extraChargeNameInput) extraChargeNameInput.value = data.pricing?.extraCharge?.name || '';
      if (extraChargeAmountInput) extraChargeAmountInput.value = data.pricing?.extraCharge?.amount || '';
      if (existingDiagramUrlInput) existingDiagramUrlInput.value = data.diagramUrl || '';
      if (designChargeInput) designChargeInput.value = data.pricing?.designCharge || '';
      if (printingChargeInput) printingChargeInput.value = data.pricing?.printingChargeBase || '';
      if (transportChargeInput) transportChargeInput.value = data.pricing?.transportCharge || '';
      if (extraMarginPercentInput) extraMarginPercentInput.value = data.pricing?.extraMarginPercent || '';
  
      if (extraChargesSection) {
          extraChargesSection.style.display = hasExtraChargesCheckbox.checked ? 'block' : 'none';
      }
  
      // Render existing images
      if (imagePreviewArea) {
          imagePreviewArea.innerHTML = existingImageUrls.map((url, index) =>
              `<div class="image-preview-item">
                  <img src="${url}" alt="Product Image ${index + 1}">
                  <button type="button" class="remove-image-btn" data-index="${index}">&times;</button>
              </div>`
          ).join('');
  
          // Attach event listeners to remove buttons for existing images
          const removeExistingImageBtns = imagePreviewArea.querySelectorAll('.remove-image-btn');
          removeExistingImageBtns.forEach(button => {
              button.addEventListener('click', handleRemoveExistingImage);
          });
      }
  
      // Show diagram link if exists
      if (diagramLinkArea && viewDiagramLink && data.diagramUrl) {
          diagramLinkArea.style.display = 'block';
          viewDiagramLink.href = data.diagramUrl;
          viewDiagramLink.textContent = data.diagramUrl.split('/').pop() || 'View Diagram';
      } else if (diagramLinkArea) {
          diagramLinkArea.style.display = 'none';
      }
      setActiveRateTab('online');
      if (productModal) productModal.classList.add('active');
      if (productCategoryInput) toggleWeddingFields();
      if (productUnitSelect) toggleSqFtFields();
  }
  
  function closeProductModal() {
      if (productModal) productModal.classList.remove('active');
      selectedFiles = [];
      imagesToDelete = [];
      diagramFileToUpload = null;
      if (productForm) productForm.reset(); // Reset form fields
  }
  
  function handleConfirmCheckboxChange() {
      if (deleteConfirmCheckbox && confirmDeleteFinalBtn) {
          confirmDeleteFinalBtn.disabled = !deleteConfirmCheckbox.checked;
      }
  }
  
  async function handleFinalDelete() {
      if (!productToDeleteId || !window.db || !window.doc || !window.deleteDoc || !deleteConfirmModal) {
          showToast("Error: Missing required functions or product ID.", 5000);
          return;
      }
  
      if (!deleteConfirmCheckbox || !deleteConfirmCheckbox.checked) {
          showToast("Please confirm that you want to delete the product.", 3000);
          return;
      }
  
      try {
          showToast(`Deleting product...`, 20000); // Show a long-running toast
          const productRef = window.doc(window.db, "onlineProducts", productToDeleteId);
  
          // Delete associated images from storage
          if (existingImageUrls && existingImageUrls.length > 0 && window.storage && window.ref && window.deleteObject) {
              for (const imageUrl of existingImageUrls) {
                  try {
                      const imageRef = window.ref(window.storage, imageUrl);
                      await window.deleteObject(imageRef);
                      console.log(`Deleted image: ${imageUrl}`);
                  } catch (imageDeleteError) {
                      console.error(`Error deleting image ${imageUrl}:`, imageDeleteError);
                      // Optionally, continue deleting other images
                      // throw imageDeleteError; // Uncomment to stop on first error
                  }
              }
          }
  
          // Delete diagram file from storage
          const diagramUrl = existingDiagramUrlInput.value;
          if (diagramUrl && window.storage && window.ref && window.deleteObject) {
              try {
                  const diagramRef = window.ref(window.storage, diagramUrl);
                  await window.deleteObject(diagramRef);
                  console.log(`Deleted diagram: ${diagramUrl}`);
              } catch (diagramDeleteError) {
                  console.error("Error deleting diagram:", diagramDeleteError);
                  // Optionally, continue with product deletion
                  // throw diagramDeleteError;  // Uncomment to stop on error
              }
          }
  
          await window.deleteDoc(productRef);
          showToast(`Product "${productToDeleteName}" deleted successfully.`, 3000);
          closeDeleteConfirmModal();
          listenForOnlineProducts(); // Refresh the product list
      } catch (error) {
          console.error("Error deleting product:", error);
          showToast(`Error deleting product: ${error.message}`, 5000);
      } finally {
          // Hide the long-running toast
          const longToast = document.querySelector('.toast-notification');
          if (longToast && longToast.textContent === 'Deleting product...') {
              longToast.remove();
          }
      }
  }
  
  // --- Image Upload Handlers ---
  function handleFileSelection(event) {
      selectedFiles = Array.from(event.target.files).slice(0, 4); // Limit to 4 files
      if (imagePreviewArea) imagePreviewArea.innerHTML = ''; // Clear previous previews
      selectedFiles.forEach((file, index) => {
          const reader = new FileReader();
          reader.onload = (e) => {
              if (imagePreviewArea) {
                  const img = document.createElement('img');
                  img.src = e.target.result;
                  img.alt = `Selected Image ${index + 1}`;
                  const previewItem = document.createElement('div');
                  previewItem.className = 'image-preview-item';
                  previewItem.appendChild(img);
                  const removeButton = document.createElement('button');
                  removeButton.type = 'button';
                  removeButton.className = 'remove-image-btn';
                  removeButton.textContent = '&times;';
                  removeButton