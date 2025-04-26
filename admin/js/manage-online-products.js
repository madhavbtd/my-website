// js/manage-online-products.js (Online Version - Final Update)

// --- Ensure Firebase Functions are available globally via HTML script block ---
// We expect db, auth, storage, collection, onSnapshot, query, orderBy, doc,
// addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp,
// storageRef, uploadBytesResumable, getDownloadURL, deleteObject
// to be available on the window object.

// --- DOM Elements ---
const productTableBody = document.getElementById('productTableBody');
const loadingRow = document.getElementById('loadingMessage');
const sortSelect = document.getElementById('sort-products');
const filterSearchInput = document.getElementById('filterSearch');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const addNewProductBtn = document.getElementById('addNewProductBtn');

// Product Add/Edit Modal Elements
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

// Modal Form Field References
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
// Pricing
const productSalePriceInput = document.getElementById('productSalePrice');
const productMinOrderValueInput = document.getElementById('productMinOrderValue');
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

// Delete Confirmation Modal Elements
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
let existingImageUrls = []; // <<< UPDATED: Variable declared >>>

// --- Helper Functions ---
function formatCurrency(amount) { const num = Number(amount); return isNaN(num) || num === null || num === undefined ? '-' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { unsafe = String(unsafe || ''); } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function parseNumericInput(value, allowZero = true) { if (value === undefined || value === null) return null; const trimmedValue = String(value).trim(); if (trimmedValue === '') return null; const num = parseFloat(trimmedValue); if (isNaN(num) || (!allowZero && num <= 0) || (allowZero && num < 0)) { return NaN; } return num; }

// <<< UPDATED: Added Timestamp Formatter >>>
// --- Helper function to format Firestore Timestamp ---
function formatFirestoreTimestamp(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== 'function') {
        return '-';
    }
    try {
        const date = timestamp.toDate();
        // Format as DD-Mon-YYYY (e.g., 26-Apr-2025)
        const options = { day: '2-digit', month: 'short', year: 'numeric' };
        return date.toLocaleDateString('en-GB', options).replace(/ /g, '-');
    } catch (e) {
        console.error("Error formatting timestamp:", e);
        return '-';
    }
}

// --- Toast Notification ---
function showToast(message, duration = 3500) {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) { existingToast.remove(); }
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
    console.log("Online Product Management Initializing...");
    if (!window.db || !window.auth || !window.storage) {
        console.error("Firebase services not available on window object.");
        alert("Error initializing page. Firebase services missing.");
        return;
    }
    console.log("Firebase services confirmed. Setting up listeners.");
    listenForOnlineProducts();
    setupEventListeners();
    console.log("Online Product Management Initialized.");
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
    console.log("Online Product Management event listeners set up.");
}

// --- Show/Hide Conditional Fields ---
function toggleWeddingFields() {
     if (!weddingFieldsContainer || !productCategoryInput) return;
     const category = productCategoryInput.value.toLowerCase();
     weddingFieldsContainer.style.display = category.includes('wedding card') ? 'block' : 'none';
}
function toggleSqFtFields() {
     if(!productUnitSelect) return;
     const unitType = productUnitSelect.value;
     if(productMinOrderValueInput) {
         const parentGroup = productMinOrderValueInput.closest('.sq-feet-only');
         if(parentGroup) {
             parentGroup.style.display = unitType === 'Sq Feet' ? 'block' : 'none';
         }
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
        applyFiltersAndRender();
    }
 }
function handleSearchInput() { clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(applyFiltersAndRender, 300); }
function clearFilters() { if(filterSearchInput) filterSearchInput.value = ''; if(sortSelect) sortSelect.value = 'createdAt_desc'; currentSortField = 'createdAt'; currentSortDirection = 'desc'; applyFiltersAndRender(); }

// --- Firestore Listener for ONLINE Products ---
function listenForOnlineProducts() {
    if (unsubscribeProducts) { unsubscribeProducts(); unsubscribeProducts = null; }
    if (!window.db || !window.collection || !window.query || !window.onSnapshot) {
        console.error("Firestore functions unavailable!");
        if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Error: DB Connection Failed.</td></tr>`; // Colspan=8
        return;
    }
    if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="8" id="loadingMessage" style="text-align: center;">Loading online products...</td></tr>`; // Colspan=8

    try {
        console.log(`Setting up Firestore listener for 'onlineProducts'...`);
        const productsRef = window.collection(window.db, "onlineProducts");
        // Apply initial sorting from select directly if needed, or keep default
        const [initialSortField, initialSortDir] = sortSelect.value.split('_');
        const q = window.query(productsRef, window.orderBy(initialSortField || 'createdAt', initialSortDir || 'desc')); // Use initial sort

        unsubscribeProducts = window.onSnapshot(q, (snapshot) => {
            console.log(`Received ${snapshot.docs.length} online products.`);
            allProductsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            applyFiltersAndRender(); // Apply filters and current sort
        }, (error) => {
            console.error("Error fetching online products snapshot:", error);
             if (error.code === 'permission-denied') {
                if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Error loading products: Insufficient permissions. Check Firestore rules.</td></tr>`; // Colspan=8
             } else {
                if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Error loading products. Check connection/console.</td></tr>`; // Colspan=8
             }
        });
    } catch (error) {
        console.error("Error setting up online product listener:", error);
         if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Error setting up listener.</td></tr>`; // Colspan=8
    }
}

// --- Filter, Sort, Render ---
function applyFiltersAndRender() {
    if (!allProductsCache) return;
    console.log("Applying online product filters and rendering...");
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';

    let filteredProducts = allProductsCache.filter(product => {
        if (!product || !product.productName) return false;
        if (filterSearchValue) {
            const name = (product.productName || '').toLowerCase();
            const category = (product.category || '').toLowerCase();
            const brand = (product.brand || '').toLowerCase(); // Add brand to filter
            if (!(name.includes(filterSearchValue) || category.includes(filterSearchValue) || brand.includes(filterSearchValue))) {
                return false;
            }
        }
        return true;
    });

    // Sorting (using currentSortField and currentSortDirection globals)
    filteredProducts.sort((a, b) => {
        let valA, valB;
        if (currentSortField.startsWith('pricing.')) {
             const priceField = currentSortField.split('.')[1];
             valA = a.pricing?.[priceField];
             valB = b.pricing?.[priceField];
        } else {
             valA = a[currentSortField];
             valB = b[currentSortField];
        }
        // Handle timestamp sorting
        if (currentSortField === 'createdAt' || currentSortField === 'updatedAt') {
            valA = valA?.toDate ? valA.toDate().getTime() : 0;
            valB = valB?.toDate ? valB.toDate().getTime() : 0;
        }
        // Handle numeric sorting
        else if (['pricing.rate', 'pricing.purchasePrice', 'pricing.gstRate', 'pricing.mrp'].includes(currentSortField)) {
             valA = Number(valA) || 0;
             valB = Number(valB) || 0;
        }
        // Handle string sorting (case-insensitive)
        else if (typeof valA === 'string' && typeof valB === 'string') {
             valA = valA.toLowerCase();
             valB = valB.toLowerCase();
        } else {
             // Handle undefined/null values for sorting consistency
             valA = valA === undefined || valA === null ? (currentSortDirection === 'asc' ? Infinity : -Infinity) : valA;
             valB = valB === undefined || valB === null ? (currentSortDirection === 'asc' ? Infinity : -Infinity) : valB;
        }

        let comparison = 0;
        if (valA > valB) comparison = 1;
        else if (valA < valB) comparison = -1;

        return currentSortDirection === 'desc' ? (comparison * -1) : comparison;
    });

    renderProductTable(filteredProducts); // Render the filtered and sorted products
    console.log("Online product rendering complete.");
}


// <<< UPDATED: Table Rendering Function >>>
// --- Display Table Row (Updated with Brand and Date Added) ---
function renderProductTable(products) {
    if (!productTableBody) return;
    productTableBody.innerHTML = '';
    const expectedColumns = 8; // Number of columns in the thead

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
            const brand = data.brand || '-'; // Get brand data
            const rate = data.pricing?.rate !== undefined ? formatCurrency(data.pricing.rate) : '-';
            const unit = data.unit || '-';
            const enabled = data.isEnabled ? 'Yes' : 'No';
            const dateAdded = formatFirestoreTimestamp(data.createdAt); // Get formatted date

            // Ensure cells match the order in the updated thead
            tableRow.innerHTML = `
                <td>${escapeHtml(name)}</td>
                <td>${escapeHtml(category)}</td>
                <td>${escapeHtml(brand)}</td> <td style="text-align: right;">${rate}</td>
                <td style="text-align: center;">${escapeHtml(unit)}</td>
                <td style="text-align: center;">${enabled}</td>
                <td style="text-align: center;">${dateAdded}</td> <td style="text-align: center;">
                     <button class="button edit-product-btn" style="background-color: var(--info-color); color: white; padding: 5px 8px; font-size: 0.8em; margin: 2px;" title="Edit Online Product">
                         <i class="fas fa-edit"></i> Edit
                     </button>
                     <button class="button delete-product-btn" style="background-color: var(--danger-color); color: white; padding: 5px 8px; font-size: 0.8em; margin: 2px;" title="Delete Online Product">
                          <i class="fas fa-trash"></i> Delete
                     </button>
                </td>
            `;

            // Add event listeners
             const editBtn = tableRow.querySelector('.edit-product-btn');
             if (editBtn) {
                 editBtn.addEventListener('click', (e) => {
                     e.stopPropagation(); // Prevent potential row click if added later
                     openEditModal(firestoreId, data);
                 });
             }
             const delBtn = tableRow.querySelector('.delete-product-btn');
              if (delBtn) {
                  delBtn.addEventListener('click', (e) => {
                      e.stopPropagation();
                      productToDeleteId = firestoreId;
                      productToDeleteName = data.productName || 'this online product';
                       if(deleteWarningMessage) deleteWarningMessage.innerHTML = `Are you sure you want to delete the online product "<strong>${escapeHtml(productToDeleteName)}</strong>"? <br>This will also delete its images from storage. This action cannot be undone.`;
                       if(deleteConfirmCheckbox) deleteConfirmCheckbox.checked = false;
                       if(confirmDeleteFinalBtn) confirmDeleteFinalBtn.disabled = true;
                       if(deleteConfirmModal) deleteConfirmModal.classList.add('active');
                  });
              }
        });
    }
}


// --- Modal Handling (Add/Edit) ---
// (openAddModal, openEditModal, closeProductModal functions remain largely the same as provided before,
// ensuring they use the globally declared existingImageUrls, selectedFiles, imagesToDelete)

function openAddModal() {
    if (!productModal || !productForm) return;
    console.log("Opening modal to add new ONLINE product.");
    if(modalTitle) modalTitle.innerHTML = '<i class="fas fa-plus-circle success-icon"></i> Add New Online Product';
    if(editProductIdInput) editProductIdInput.value = '';
    productForm.reset();
    if(isEnabledCheckbox) isEnabledCheckbox.checked = true;
    if(hasExtraChargesCheckbox) hasExtraChargesCheckbox.checked = false;
    // Reset image-related global state variables
    existingImageUrls = [];
    selectedFiles = [];
    imagesToDelete = [];
    if(imagePreviewArea) imagePreviewArea.innerHTML = '';
    if(uploadProgressInfo) uploadProgressInfo.textContent = '';
    if(existingImageUrlsInput) existingImageUrlsInput.value = '[]';
    if(saveProductBtn) saveProductBtn.disabled = false;
    if(saveSpinner) saveSpinner.style.display = 'none';
    if(saveIcon) saveIcon.style.display = '';
    if(saveText) saveText.textContent = 'Save Product';
    if (deleteProductBtn) deleteProductBtn.style.display = 'none';
    toggleWeddingFields();
    toggleSqFtFields();
    toggleExtraCharges();
    productModal.classList.add('active');
}

async function openEditModal(firestoreId, data) {
    if (!productModal || !productForm || !data) return;
    console.log("Opening modal to edit ONLINE product:", firestoreId);
    if(modalTitle) modalTitle.innerHTML = '<i class="fas fa-edit info-icon"></i> Edit Online Product';
    productForm.reset();
    if(editProductIdInput) editProductIdInput.value = firestoreId;
    if(productNameInput) productNameInput.value = data.productName || '';
    if(productCategoryInput) productCategoryInput.value = data.category || '';
    if(productUnitSelect) productUnitSelect.value = data.unit || 'Qty';
    if(productDescInput) productDescInput.value = data.description || '';
    if(isEnabledCheckbox) isEnabledCheckbox.checked = data.isEnabled !== undefined ? data.isEnabled : true;
    const pricing = data.pricing || {};
    if(productSalePriceInput) productSalePriceInput.value = pricing.rate ?? '';
    if(productMinOrderValueInput) productMinOrderValueInput.value = pricing.minimumOrderValue ?? '';
    if(productPurchasePriceInput) productPurchasePriceInput.value = pricing.purchasePrice ?? '';
    if(productMrpInput) productMrpInput.value = pricing.mrp ?? '';
    if(productGstRateInput) productGstRateInput.value = pricing.gstRate ?? '';
    if(designChargeInput) designChargeInput.value = pricing.designCharge ?? '';
    if(printingChargeInput) printingChargeInput.value = pricing.printingChargeBase ?? '';
    if(transportChargeInput) transportChargeInput.value = pricing.transportCharge ?? '';
    if(extraMarginPercentInput) extraMarginPercentInput.value = pricing.extraMarginPercent ?? '';
    if(hasExtraChargesCheckbox) hasExtraChargesCheckbox.checked = pricing.hasExtraCharges || false;
    if(extraChargeNameInput) extraChargeNameInput.value = pricing.extraCharge?.name || '';
    if(extraChargeAmountInput) extraChargeAmountInput.value = pricing.extraCharge?.amount ?? '';
    if (productOptionsInput) {
        try { productOptionsInput.value = (data.options && Array.isArray(data.options)) ? JSON.stringify(data.options, null, 2) : ''; }
        catch { productOptionsInput.value = ''; }
    }
     if(productBrandInput) productBrandInput.value = data.brand || '';
     if(productItemCodeInput) productItemCodeInput.value = data.itemCode || '';
     if(productHsnSacCodeInput) productHsnSacCodeInput.value = data.hsnSacCode || '';
    // Image handling
    selectedFiles = [];
    imagesToDelete = [];
    if(imagePreviewArea) imagePreviewArea.innerHTML = '';
    existingImageUrls = data.imageUrls || [];
    if(existingImageUrlsInput) existingImageUrlsInput.value = JSON.stringify(existingImageUrls);
    existingImageUrls.forEach(url => displayImagePreview(null, url));
    if(uploadProgressInfo) uploadProgressInfo.textContent = '';
    // Button states
    if(saveProductBtn) saveProductBtn.disabled = false;
    if(saveSpinner) saveSpinner.style.display = 'none';
    if(saveIcon) saveIcon.style.display = '';
    if(saveText) saveText.textContent = 'Update Product';
    if(deleteProductBtn) deleteProductBtn.style.display = 'inline-flex';
    productToDeleteId = firestoreId;
    productToDeleteName = data.productName || 'this online product';
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
    }
}

// --- Image Handling ---
// (handleFileSelection, displayImagePreview, uploadImage, deleteStoredImage functions remain the same as provided before)
function handleFileSelection(event) {
    if (!imagePreviewArea || !productImagesInput) return;
    const files = Array.from(event.target.files);
    let currentImageCount = existingImageUrls.filter(url => !imagesToDelete.includes(url)).length + selectedFiles.length;
    const availableSlots = 4 - currentImageCount;
    if (files.length > availableSlots) {
        alert(`You can upload a maximum of 4 images. You have ${currentImageCount} and tried to add ${files.length}.`);
        productImagesInput.value = null;
        return;
    }
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
             if (selectedFiles.length + existingImageUrls.filter(url => !imagesToDelete.includes(url)).length < 4) {
                selectedFiles.push(file);
                displayImagePreview(file, null);
            }
        }
    });
    productImagesInput.value = null; // Clear file input after selection
}

function displayImagePreview(fileObject, existingUrl = null) {
    if (!imagePreviewArea) return;
    const previewId = existingUrl || `new-${fileObject.name}-${Date.now()}`;
    const previewWrapper = document.createElement('div');
    previewWrapper.className = 'image-preview-item';
    previewWrapper.setAttribute('data-preview-id', previewId);
    const img = document.createElement('img');
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-image-btn';
    removeBtn.innerHTML = '&times;';
    removeBtn.title = 'Remove image';
    const progressBar = document.createElement('div');
    progressBar.className = 'upload-progress-bar';
    const progressFill = document.createElement('div');
    progressBar.appendChild(progressFill);
    progressBar.style.display = 'none';

    if (existingUrl) {
        img.src = existingUrl;
        img.onerror = () => { img.src = 'images/placeholder.png'; }
        previewWrapper.imageUrl = existingUrl;
        removeBtn.onclick = () => {
            if (!imagesToDelete.includes(existingUrl)) imagesToDelete.push(existingUrl);
            previewWrapper.style.display = 'none'; // Hide instead of remove
            console.log("Marked for deletion:", existingUrl);
        };
    } else if (fileObject) {
        const reader = new FileReader();
        reader.onload = (e) => { img.src = e.target.result; }
        reader.readAsDataURL(fileObject);
        previewWrapper.fileData = fileObject;
        removeBtn.onclick = () => {
            selectedFiles = selectedFiles.filter(f => f !== fileObject);
            previewWrapper.remove();
            console.log("Removed new file:", fileObject.name);
        };
    }
    previewWrapper.appendChild(img);
    previewWrapper.appendChild(removeBtn);
    previewWrapper.appendChild(progressBar);
    imagePreviewArea.appendChild(previewWrapper);
}

async function uploadImage(file, productId, index) {
    // Logic as provided before...
    if (!window.storage || !window.storageRef || !window.uploadBytesResumable || !window.getDownloadURL) throw new Error("Storage functions missing.");
    const previewWrapper = [...imagePreviewArea.querySelectorAll('.image-preview-item')].find(el => el.fileData === file);
    const progressBar = previewWrapper?.querySelector('.upload-progress-bar');
    const progressFill = progressBar?.querySelector('div');
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}-image${index}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const filePath = `onlineProductImages/${productId}/${uniqueFileName}`;
    const fileRef = window.storageRef(window.storage, filePath);
    console.log(`Uploading ${file.name} to ${filePath}`);
    if (progressBar) progressBar.style.display = 'block';
    if (progressFill) progressFill.style.width = '0%';
    const uploadTask = window.uploadBytesResumable(fileRef, file);
    return new Promise((resolve, reject) => {
        uploadTask.on('state_changed', (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (uploadProgressInfo) uploadProgressInfo.textContent = `Uploading ${file.name}: ${progress.toFixed(0)}%`;
        }, (error) => {
            console.error(`Upload failed for ${file.name}:`, error);
            if (progressBar) progressBar.style.backgroundColor = 'red';
            if (uploadProgressInfo) uploadProgressInfo.textContent = `Upload failed for ${file.name}.`;
            reject(error);
        }, async () => {
            if (progressBar) progressBar.style.backgroundColor = 'var(--success-color)';
            if (uploadProgressInfo) uploadProgressInfo.textContent = `Upload complete. Getting URL...`;
            try {
                const downloadURL = await window.getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
            } catch (error) {
                 if (progressBar) progressBar.style.backgroundColor = 'red';
                 if (uploadProgressInfo) uploadProgressInfo.textContent = `Failed to get URL.`;
                reject(error);
            }
        });
    });
}

async function deleteStoredImage(imageUrl) {
    // Logic as provided before...
     if (!window.storage || !window.storageRef || !window.deleteObject) return;
     if (!imageUrl || !(imageUrl.startsWith('https://firebasestorage.googleapis.com/') || imageUrl.startsWith('gs://'))) return;
     try {
         const imageRef = window.storageRef(window.storage, imageUrl);
         await window.deleteObject(imageRef);
         console.log("Deleted image from Storage:", imageUrl);
     } catch (error) {
         if (error.code === 'storage/object-not-found') console.warn("Image not found in Storage:", imageUrl);
         else console.error("Error deleting image from Storage:", imageUrl, error);
     }
}


// --- Save/Update Online Product Handler ---
// (handleSaveProduct function remains the same as provided before,
// includes validation, data prep, image upload/delete calls, Firestore save/update)
async function handleSaveProduct(event) {
    event.preventDefault();
    if (!window.db || !window.collection || !window.addDoc || !window.doc || !window.updateDoc || !window.serverTimestamp ) {
         showToast("Database functions are unavailable. Cannot save.", 5000); return;
     }
    if (saveProductBtn) saveProductBtn.disabled = true;
    if (saveSpinner) saveSpinner.style.display = 'inline-block';
    if (saveIcon) saveIcon.style.display = 'none';
    if (saveText) saveText.textContent = 'Saving...';
    if (uploadProgressInfo) uploadProgressInfo.textContent = 'Preparing data...';

    const productId = editProductIdInput?.value;
    const isEditing = !!productId;
    let finalProductId = productId;

    // Validation
    const productName = productNameInput?.value.trim();
    const category = productCategoryInput?.value.trim();
    const unit = productUnitSelect?.value || null;
    const salePrice = parseNumericInput(productSalePriceInput?.value);
    if (!productName || !category || !unit || salePrice === null || isNaN(salePrice)) {
         showToast("Product Name, Category, Unit, and Base Sale Price are required fields.", 5000);
         if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product'; if (uploadProgressInfo) uploadProgressInfo.textContent = '';
         return;
    }
    const purchasePrice = parseNumericInput(productPurchasePriceInput?.value);
    const mrp = parseNumericInput(productMrpInput?.value);
    const gstRate = parseNumericInput(productGstRateInput?.value);
    const minOrderValue = parseNumericInput(productMinOrderValueInput?.value);
    const designCharge = parseNumericInput(designChargeInput?.value);
    const printingCharge = parseNumericInput(printingChargeInput?.value);
    const transportCharge = parseNumericInput(transportChargeInput?.value);
    const extraMarginPercent = parseNumericInput(extraMarginPercentInput?.value);
    const extraChargeAmount = parseNumericInput(extraChargeAmountInput?.value);
    if ([purchasePrice, mrp, gstRate, minOrderValue, designCharge, printingCharge, transportCharge, extraMarginPercent, extraChargeAmount].some(isNaN)) {
         showToast("Please enter valid numbers (or leave blank) for optional prices/charges.", 5000);
         if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product'; if (uploadProgressInfo) uploadProgressInfo.textContent = '';
         return;
     }

    // Prepare Data
     const productData = {
        productName: productName, productName_lowercase: productName.toLowerCase(),
        category: category, category_lowercase: category.toLowerCase(),
        unit: unit, description: productDescInput?.value.trim() || '',
        isEnabled: isEnabledCheckbox?.checked ?? true, options: [],
        brand: productBrandInput?.value.trim() || null, itemCode: productItemCodeInput?.value.trim() || null, hsnSacCode: productHsnSacCodeInput?.value.trim() || null,
        pricing: { rate: salePrice }
     };
     if (purchasePrice !== null) productData.pricing.purchasePrice = purchasePrice;
     if (mrp !== null) productData.pricing.mrp = mrp;
     if (gstRate !== null) productData.pricing.gstRate = gstRate;
     if (unit === 'Sq Feet' && minOrderValue !== null) productData.pricing.minimumOrderValue = minOrderValue;
     if (category.toLowerCase().includes('wedding card')) {
          if (designCharge !== null) productData.pricing.designCharge = designCharge;
          if (printingCharge !== null) productData.pricing.printingChargeBase = printingCharge;
          if (transportCharge !== null) productData.pricing.transportCharge = transportCharge;
          if (extraMarginPercent !== null) productData.pricing.extraMarginPercent = extraMarginPercent;
     }
     productData.pricing.hasExtraCharges = hasExtraChargesCheckbox?.checked ?? false;
     if (productData.pricing.hasExtraCharges) {
          productData.pricing.extraCharge = { name: extraChargeNameInput?.value.trim() || 'Additional Charge', amount: extraChargeAmount ?? 0 };
     }
     const optionsString = productOptionsInput?.value.trim();
      if (optionsString) { try { productData.options = JSON.parse(optionsString); if (!Array.isArray(productData.options)) throw new Error("Options must be an array."); } catch (err) { showToast('Error: Invalid JSON format in Options field.', 5000); if (saveProductBtn) saveProductBtn.disabled = false; if (saveSpinner) saveSpinner.style.display = 'none'; if (saveIcon) saveIcon.style.display = ''; if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product'; if (uploadProgressInfo) uploadProgressInfo.textContent = ''; return; } }
      productData.updatedAt = window.serverTimestamp();
      if (!isEditing) { productData.createdAt = window.serverTimestamp(); productData.imageUrls = []; }

    // --- Save/Update Process ---
    let uploadedImageUrls = []; let finalImageUrls = []; let currentExistingUrls = [];
     try { currentExistingUrls = JSON.parse(existingImageUrlsInput?.value || '[]'); } catch { console.error("Could not parse existing image URLs."); }

    try {
        // Step 1: Save/Update text data if needed
        if (!isEditing) {
             if (uploadProgressInfo) uploadProgressInfo.textContent = 'Saving product info...';
             const docRef = await window.addDoc(window.collection(window.db, "onlineProducts"), productData);
             finalProductId = docRef.id;
        } else { finalProductId = productId; }

        // Step 2: Handle image deletions
        if (isEditing && imagesToDelete.length > 0) {
             if (uploadProgressInfo) uploadProgressInfo.textContent = 'Deleting removed images...';
             const deletePromises = imagesToDelete.map(url => deleteStoredImage(url));
             await Promise.allSettled(deletePromises);
             currentExistingUrls = currentExistingUrls.filter(url => !imagesToDelete.includes(url));
        }

        // Step 3: Handle image uploads
        if (selectedFiles.length > 0) {
            if (uploadProgressInfo) uploadProgressInfo.textContent = `Uploading ${selectedFiles.length} images...`;
            // Simplified: uploadImage function handles individual progress reporting
            const uploadPromises = selectedFiles.map((file, index) => uploadImage(file, finalProductId, index));
            uploadedImageUrls = await Promise.all(uploadPromises);
            if (uploadProgressInfo) uploadProgressInfo.textContent = 'All images uploaded!';
        } else {
             if (uploadProgressInfo && !isEditing) uploadProgressInfo.textContent = 'Product info saved.';
             else if (uploadProgressInfo) uploadProgressInfo.textContent = '';
        }

        // Step 4: Combine URLs and Final Firestore Update
        finalImageUrls = [...currentExistingUrls, ...uploadedImageUrls];
        productData.imageUrls = finalImageUrls; // Add final URLs array

        const finalProductRef = window.doc(window.db, "onlineProducts", finalProductId);
        // Update only necessary fields, including imageUrls
        await window.updateDoc(finalProductRef, {
            ...productData // Update all prepared data fields ensures consistency
            // Or list specific fields if preferred:
            // imageUrls: productData.imageUrls, updatedAt: productData.updatedAt,
            // productName: productData.productName, /* ... etc ... */
        });

        showToast(isEditing ? 'Online Product updated!' : 'Online Product added!', 3000);
        closeProductModal();

    } catch (error) {
        console.error("Error during save/upload process:", error);
        showToast(`Error: ${error.message || 'Unknown error'}. Check console.`, 5000);
    } finally {
        if(saveProductBtn) saveProductBtn.disabled = false;
        if(saveSpinner) saveSpinner.style.display = 'none';
        if(saveIcon) saveIcon.style.display = '';
        if(saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product';
        if(uploadProgressInfo) setTimeout(() => { if(uploadProgressInfo) uploadProgressInfo.textContent = ''; }, 3000);
    }
}

// --- Delete Handling ---
// (handleDeleteButtonClick, closeDeleteConfirmModal, handleConfirmCheckboxChange, handleFinalDelete functions remain the same as provided before)
function handleDeleteButtonClick(event) {
    event.preventDefault();
    if (!productToDeleteId || !productToDeleteName) return;
    if (deleteWarningMessage) deleteWarningMessage.innerHTML = `Are you sure you want to delete "<strong>${escapeHtml(productToDeleteName)}</strong>"? <br>This will also delete its images. This action cannot be undone.`;
    if(deleteConfirmCheckbox) deleteConfirmCheckbox.checked = false;
    if(confirmDeleteFinalBtn) confirmDeleteFinalBtn.disabled = true;
    if(deleteConfirmModal) deleteConfirmModal.classList.add('active');
}
function closeDeleteConfirmModal() { if (deleteConfirmModal) { deleteConfirmModal.classList.remove('active'); } }
function handleConfirmCheckboxChange() { if (deleteConfirmCheckbox && confirmDeleteFinalBtn) { confirmDeleteFinalBtn.disabled = !deleteConfirmCheckbox.checked; } }
async function handleFinalDelete() {
    if (!deleteConfirmCheckbox?.checked || !productToDeleteId) return;
    if (!window.db || !window.doc || !window.getDoc || !window.deleteDoc || !window.storage || !window.storageRef || !window.deleteObject) {
         showToast("Core Firebase functions unavailable.", 5000); return;
     }
    if(confirmDeleteFinalBtn) { confirmDeleteFinalBtn.disabled = true; confirmDeleteFinalBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...'; }
    const productRef = window.doc(window.db, "onlineProducts", productToDeleteId);
    try {
        const productSnap = await window.getDoc(productRef);
        if (productSnap.exists()) {
            const productData = productSnap.data();
            if (productData.imageUrls && Array.isArray(productData.imageUrls) && productData.imageUrls.length > 0) {
                 const deletePromises = productData.imageUrls.map(url => deleteStoredImage(url));
                 await Promise.allSettled(deletePromises);
            }
        }
        await window.deleteDoc(productRef);
        showToast(`Product "${productToDeleteName || ''}" deleted!`);
        closeDeleteConfirmModal();
        closeProductModal();
    } catch (error) {
        console.error(`Error deleting ${productToDeleteId}:`, error);
         showToast(`Failed to delete product: ${error.message}`, 5000);
    } finally {
         if(confirmDeleteFinalBtn) { confirmDeleteFinalBtn.disabled = !deleteConfirmCheckbox?.checked; confirmDeleteFinalBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Confirm Delete'; }
    }
}

// --- END ---