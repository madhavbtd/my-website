// js/product_management.js (Online Version - Based on V2.5 + New Features V3)

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
const saveSpinner = saveProductBtn?.querySelector('.fa-spinner'); // Optional chaining
const saveIcon = saveProductBtn?.querySelector('.fa-save');
const saveText = saveProductBtn?.querySelector('span');
const editProductIdInput = document.getElementById('editProductId');
const deleteProductBtn = document.getElementById('deleteProductBtn');

// Modal Form Field References
const productNameInput = document.getElementById('productName');
const productCategoryInput = document.getElementById('productCategory'); // Changed from productGroup
const productUnitSelect = document.getElementById('productUnit');
const productDescInput = document.getElementById('productDescription');
const isEnabledCheckbox = document.getElementById('isEnabled');
// Images
const productImagesInput = document.getElementById('productImages');
const imagePreviewArea = document.getElementById('image-preview-area');
const uploadProgressInfo = document.getElementById('upload-progress-info');
const existingImageUrlsInput = document.getElementById('existingImageUrls'); // Hidden input
// Pricing
const productSalePriceInput = document.getElementById('productSalePrice'); // Base Sale Price
const productMinOrderValueInput = document.getElementById('productMinOrderValue'); // For Sq Ft
const productPurchasePriceInput = document.getElementById('productPurchasePrice'); // Optional Costing
const productMrpInput = document.getElementById('productMrp'); // Optional Costing
const productGstRateInput = document.getElementById('productGstRate'); // Optional Costing
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
let allProductsCache = []; // Cache for filtering/sorting
let searchDebounceTimer;
let productToDeleteId = null;
let productToDeleteName = null;
let selectedFiles = []; // Stores NEW File objects selected for upload
let imagesToDelete = []; // Stores existing image URLs marked for deletion during EDIT

// --- Helper Functions ---
function formatCurrency(amount) { const num = Number(amount); return isNaN(num) || num === null || num === undefined ? '-' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { unsafe = String(unsafe || ''); } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function parseNumericInput(value, allowZero = true) { if (value === undefined || value === null) return null; const trimmedValue = String(value).trim(); if (trimmedValue === '') return null; const num = parseFloat(trimmedValue); if (isNaN(num) || (!allowZero && num <= 0) || (allowZero && num < 0)) { return NaN; } return num; }

// --- Toast Notification ---
function showToast(message, duration = 3500) {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) { existingToast.remove(); } // Remove previous toast immediately

    const toast = document.createElement('div');
    toast.className = 'toast-notification'; // Use class defined in product_management.css
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger fade in
    setTimeout(() => toast.classList.add('show'), 10);

    // Set timeout to remove the toast
    setTimeout(() => {
        toast.classList.remove('show');
        // Remove the element after the transition is complete
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 400); // Match CSS transition duration
    }, duration);
    console.log("Toast:", message);
}

// --- Initialization ---
// Renamed function to be specific
window.initializeOnlineProductManagement = () => {
    console.log("Online Product Management Initializing (V3)...");
    // Ensure Firebase services are ready
    if (!window.db || !window.auth || !window.storage) {
        console.error("Firebase services (db, auth, storage) not available on window object.");
        alert("Error initializing page. Firebase services missing. Check HTML initialization script.");
        return;
    }
    console.log("Firebase services confirmed. Setting up listeners (V3).");
    listenForOnlineProducts();
    setupEventListeners();
    console.log("Online Product Management Initialized (V3).");
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

    // Listeners for Delete Confirmation Modal
    if (closeDeleteConfirmModalBtn) closeDeleteConfirmModalBtn.addEventListener('click', closeDeleteConfirmModal);
    if (cancelDeleteFinalBtn) cancelDeleteFinalBtn.addEventListener('click', closeDeleteConfirmModal);
    if (deleteConfirmModal) deleteConfirmModal.addEventListener('click', (event) => { if (event.target === deleteConfirmModal) closeDeleteConfirmModal(); });
    if (deleteConfirmCheckbox) deleteConfirmCheckbox.addEventListener('change', handleConfirmCheckboxChange);
    if (confirmDeleteFinalBtn) confirmDeleteFinalBtn.addEventListener('click', handleFinalDelete);

    // Listeners for new fields
    if (productImagesInput) productImagesInput.addEventListener('change', handleFileSelection);
    if (hasExtraChargesCheckbox) hasExtraChargesCheckbox.addEventListener('change', toggleExtraCharges);
    if (productCategoryInput) productCategoryInput.addEventListener('input', toggleWeddingFields); // Show/hide based on category
    if (productUnitSelect) productUnitSelect.addEventListener('input', toggleSqFtFields); // Show/hide based on unit

    console.log("Online Product Management event listeners set up (V3).");
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
     // Assuming only productMinOrderValueInput needs toggling based on Sq Feet
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
        if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">Error: DB Connection Failed.</td></tr>`;
        return;
    }
    if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="6" id="loadingMessage" style="text-align: center;">Loading online products...</td></tr>`;

    try {
        console.log(`Setting up Firestore listener for 'onlineProducts'...`);
        // *** TARGET COLLECTION IS onlineProducts ***
        const productsRef = window.collection(window.db, "onlineProducts");
        const q = window.query(productsRef); // Apply sorting later

        unsubscribeProducts = window.onSnapshot(q, (snapshot) => {
            console.log(`Received ${snapshot.docs.length} online products.`);
            allProductsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            applyFiltersAndRender();
        }, (error) => {
            console.error("Error fetching online products snapshot:", error);
            if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">Error loading products. Check connection/permissions.</td></tr>`;
        });
    } catch (error) {
        console.error("Error setting up online product listener:", error);
         if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">Error setting up listener.</td></tr>`;
    }
}

// --- Filter, Sort, Render ---
function applyFiltersAndRender() {
    if (!allProductsCache) return;
    console.log("Applying online product filters and rendering...");
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';

    let filteredProducts = allProductsCache.filter(product => {
        if (!product || !product.productName) return false; // Basic check

        if (filterSearchValue) {
            const name = (product.productName || '').toLowerCase();
            const category = (product.category || '').toLowerCase();
            // Add other fields if needed for search
            if (!(name.includes(filterSearchValue) || category.includes(filterSearchValue))) {
                return false;
            }
        }
        return true;
    });

    // Sorting
    filteredProducts.sort((a, b) => {
        let valA, valB;

        // Handle nested pricing fields or direct fields
        if (currentSortField.startsWith('pricing.')) {
             const priceField = currentSortField.split('.')[1];
             valA = a.pricing?.[priceField]; // Use optional chaining
             valB = b.pricing?.[priceField];
        } else if (currentSortField === 'productName') {
             // Use lowercase for consistent sorting if needed, ensure field exists
             valA = (a.productName_lowercase || a.productName || '').toLowerCase();
             valB = (b.productName_lowercase || b.productName || '').toLowerCase();
        }
         else {
             valA = a[currentSortField];
             valB = b[currentSortField];
        }


        // Handle timestamp sorting
        if (valA && typeof valA.toDate === 'function') valA = valA.toDate().getTime();
        if (valB && typeof valB.toDate === 'function') valB = valB.toDate().getTime();

        // Convert potential numeric fields to numbers for comparison
        if (['pricing.rate', 'pricing.purchasePrice', 'pricing.gstRate', 'pricing.mrp'].includes(currentSortField)) {
             valA = Number(valA) || 0;
             valB = Number(valB) || 0;
        }
        // Convert potential string fields to lowercase if not already done
        else if (typeof valA === 'string' && typeof valB === 'string' && !currentSortField.endsWith('_lowercase')) {
             valA = valA.toLowerCase();
             valB = valB.toLowerCase();
        } else if (valA === undefined || valA === null) { // Handle undefined/null values
             valA = currentSortDirection === 'asc' ? Infinity : -Infinity;
        } else if (valB === undefined || valB === null) {
             valB = currentSortDirection === 'asc' ? Infinity : -Infinity;
        }


        let comparison = 0;
        if (valA > valB) comparison = 1;
        else if (valA < valB) comparison = -1;

        return currentSortDirection === 'desc' ? (comparison * -1) : comparison;
    });

    renderProductTable(filteredProducts);
    console.log("Online product rendering complete.");
}

// --- Display Table Row (Updated Columns) ---
function renderProductTable(products) {
    if (!productTableBody) return;
    productTableBody.innerHTML = '';

    if (products.length === 0) {
        productTableBody.innerHTML = `<tr><td colspan="6" id="noProductsMessage" style="text-align: center;">No online products found matching criteria.</td></tr>`;
    } else {
        products.forEach(product => {
            const firestoreId = product.id;
            const data = product;
            const tableRow = productTableBody.insertRow();
            tableRow.setAttribute('data-id', firestoreId);
            // tableRow.classList.add('clickable-row'); // Optional: Keep row clickable?

            const name = data.productName || 'N/A';
            const category = data.category || '-';
            const rate = data.pricing?.rate !== undefined ? formatCurrency(data.pricing.rate) : '-';
            const unit = data.unit || '-';
            const enabled = data.isEnabled ? 'Yes' : 'No';

            // Updated table structure based on new thead
            tableRow.innerHTML = `
                <td>${escapeHtml(name)}</td>
                <td>${escapeHtml(category)}</td>
                <td style="text-align: right;">${rate}</td>
                <td style="text-align: center;">${escapeHtml(unit)}</td>
                <td style="text-align: center;">${enabled}</td>
                <td style="text-align: center;">
                     <button class="button edit-product-btn" style="background-color: var(--info-color); color: white; padding: 5px 8px; font-size: 0.8em; margin: 2px;" title="Edit Online Product">
                         <i class="fas fa-edit"></i> Edit
                     </button>
                     <button class="button delete-product-btn" style="background-color: var(--danger-color); color: white; padding: 5px 8px; font-size: 0.8em; margin: 2px;" title="Delete Online Product">
                          <i class="fas fa-trash"></i> Delete
                     </button>
                </td>
            `;

            // Add event listener for the EDIT button
             const editBtn = tableRow.querySelector('.edit-product-btn');
             if (editBtn) {
                 editBtn.addEventListener('click', (e) => {
                     e.stopPropagation();
                     console.log(`Edit button clicked for online product: ${firestoreId}`);
                     openEditModal(firestoreId, data); // Call existing function
                 });
             }
             // Add event listener for the DELETE button
             const delBtn = tableRow.querySelector('.delete-product-btn');
              if (delBtn) {
                  delBtn.addEventListener('click', (e) => {
                      e.stopPropagation();
                      // Set global vars needed by confirmation modal
                      productToDeleteId = firestoreId;
                      productToDeleteName = data.productName || 'this online product';
                       console.log(`Delete button clicked for online product ${productToDeleteName} (${productToDeleteId}). Opening confirmation modal.`);
                       if(deleteWarningMessage) deleteWarningMessage.innerHTML = `Are you sure you want to delete the online product "<strong>${escapeHtml(productToDeleteName)}</strong>"? <br>This will also delete its images from storage. This action cannot be undone.`;
                       if(deleteConfirmCheckbox) deleteConfirmCheckbox.checked = false;
                       if(confirmDeleteFinalBtn) confirmDeleteFinalBtn.disabled = true;
                       if(deleteConfirmModal) deleteConfirmModal.classList.add('active');
                  });
              }

        });
    }
}


// --- Modal Handling ---
function openAddModal() {
    if (!productModal || !productForm) return;
    console.log("Opening modal to add new ONLINE product.");
    if(modalTitle) modalTitle.innerHTML = '<i class="fas fa-plus-circle success-icon"></i> Add New Online Product';
    if(editProductIdInput) editProductIdInput.value = '';
    productForm.reset();
    // Reset specific fields and states
    if(isEnabledCheckbox) isEnabledCheckbox.checked = true;
    if(hasExtraChargesCheckbox) hasExtraChargesCheckbox.checked = false;
    existingImageUrls = []; // Clear existing images tracker
    selectedFiles = []; // Clear selected files
    imagesToDelete = []; // Clear deletion queue
    if(imagePreviewArea) imagePreviewArea.innerHTML = ''; // Clear previews
    if(uploadProgressInfo) uploadProgressInfo.textContent = ''; // Clear progress
    if(existingImageUrlsInput) existingImageUrlsInput.value = '[]'; // Reset hidden input

    if(saveProductBtn) saveProductBtn.disabled = false;
    if(saveSpinner) saveSpinner.style.display = 'none';
    if(saveIcon) saveIcon.style.display = '';
    if(saveText) saveText.textContent = 'Save Product';
    if (deleteProductBtn) deleteProductBtn.style.display = 'none'; // Hide delete btn on Add

    toggleWeddingFields(); // Update visibility
    toggleSqFtFields();
    toggleExtraCharges();
    productModal.classList.add('active');
}

async function openEditModal(firestoreId, data) {
    if (!productModal || !productForm || !data) return;
    console.log("Opening modal to edit ONLINE product:", firestoreId);
    if(modalTitle) modalTitle.innerHTML = '<i class="fas fa-edit info-icon"></i> Edit Online Product';
    productForm.reset();

    // Populate basic fields
    if(editProductIdInput) editProductIdInput.value = firestoreId;
    if(productNameInput) productNameInput.value = data.productName || '';
    if(productCategoryInput) productCategoryInput.value = data.category || '';
    if(productUnitSelect) productUnitSelect.value = data.unit || 'Qty';
    if(productDescInput) productDescInput.value = data.description || '';
    if(isEnabledCheckbox) isEnabledCheckbox.checked = data.isEnabled !== undefined ? data.isEnabled : true;

    // Populate Pricing
    const pricing = data.pricing || {};
    if(productSalePriceInput) productSalePriceInput.value = pricing.rate ?? '';
    if(productMinOrderValueInput) productMinOrderValueInput.value = pricing.minimumOrderValue ?? '';
    if(productPurchasePriceInput) productPurchasePriceInput.value = pricing.purchasePrice ?? '';
    if(productMrpInput) productMrpInput.value = pricing.mrp ?? '';
    if(productGstRateInput) productGstRateInput.value = pricing.gstRate ?? '';

    // Populate Wedding Card Fields
    if(designChargeInput) designChargeInput.value = pricing.designCharge ?? '';
    if(printingChargeInput) printingChargeInput.value = pricing.printingChargeBase ?? '';
    if(transportChargeInput) transportChargeInput.value = pricing.transportCharge ?? '';
    if(extraMarginPercentInput) extraMarginPercentInput.value = pricing.extraMarginPercent ?? '';

    // Populate Extra Charges
    if(hasExtraChargesCheckbox) hasExtraChargesCheckbox.checked = pricing.hasExtraCharges || false;
    if(extraChargeNameInput) extraChargeNameInput.value = pricing.extraCharge?.name || '';
    if(extraChargeAmountInput) extraChargeAmountInput.value = pricing.extraCharge?.amount ?? '';

    // Populate Options JSON
    if (productOptionsInput) {
        if (data.options && Array.isArray(data.options)) { // Check if it's an array
             try { productOptionsInput.value = JSON.stringify(data.options, null, 2); }
             catch { productOptionsInput.value = ''; } // Clear if error stringifying
        } else { productOptionsInput.value = ''; } // Clear if not array or doesn't exist
    }

     // Populate Optional Offline Fields
     if(productBrandInput) productBrandInput.value = data.brand || '';
     if(productItemCodeInput) productItemCodeInput.value = data.itemCode || '';
     if(productHsnSacCodeInput) productHsnSacCodeInput.value = data.hsnSacCode || '';


    // Handle Images
    selectedFiles = []; // Clear any previously selected files for upload
    imagesToDelete = []; // Clear deletion queue
    if(imagePreviewArea) imagePreviewArea.innerHTML = ''; // Clear previous previews
    existingImageUrls = data.imageUrls || []; // Store existing URLs
    if(existingImageUrlsInput) existingImageUrlsInput.value = JSON.stringify(existingImageUrls);

    // Display existing images
    existingImageUrls.forEach(url => displayImagePreview(null, url));
    if(uploadProgressInfo) uploadProgressInfo.textContent = ''; // Clear progress

    // Set button states
    if(saveProductBtn) saveProductBtn.disabled = false;
    if(saveSpinner) saveSpinner.style.display = 'none';
    if(saveIcon) saveIcon.style.display = '';
    if(saveText) saveText.textContent = 'Update Product';
    if(deleteProductBtn) deleteProductBtn.style.display = 'inline-flex'; // Show delete btn
    productToDeleteId = firestoreId; // Set ID for potential deletion
    productToDeleteName = data.productName || 'this online product';

    toggleWeddingFields(); // Update conditional field visibility
    toggleSqFtFields();
    toggleExtraCharges();
    productModal.classList.add('active');
}


function closeProductModal() {
    if (productModal) {
        productModal.classList.remove('active');
        productToDeleteId = null;
        productToDeleteName = null;
        if (productImagesInput) productImagesInput.value = null; // Clear file input
        selectedFiles = []; // Clear staged files
        imagesToDelete = []; // Clear deletion queue
    }
}


// --- Image Handling ---
function handleFileSelection(event) {
    if (!imagePreviewArea || !productImagesInput) return;
    const files = Array.from(event.target.files);
    const existingPreviews = imagePreviewArea.querySelectorAll('.image-preview-item');

    // Calculate current images (existing shown - marked for deletion + new staged)
    let currentImageCount = 0;
    existingImageUrls = JSON.parse(existingImageUrlsInput.value || '[]'); // Get current state
    currentImageCount = existingImageUrls.filter(url => !imagesToDelete.includes(url)).length + selectedFiles.length;


    const availableSlots = 4 - currentImageCount;

    if (files.length > availableSlots) {
        alert(`You can upload a maximum of 4 images. You have ${currentImageCount} and tried to add ${files.length}.`);
        productImagesInput.value = null; // Clear selection
        return;
    }

    // Add newly selected files to the staging array and display previews
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            if (selectedFiles.length + existingImageUrls.filter(url => !imagesToDelete.includes(url)).length < 4) {
                selectedFiles.push(file); // Add to files to be uploaded
                displayImagePreview(file, null); // Display preview for new file
            }
        }
    });

     // Clear the file input value
     productImagesInput.value = null;
}

function displayImagePreview(fileObject, existingUrl = null) {
    if (!imagePreviewArea) return;

    const previewId = existingUrl || `new-${fileObject.name}-${Date.now()}`; // Unique ID
    const previewWrapper = document.createElement('div');
    previewWrapper.className = 'image-preview-item';
    previewWrapper.setAttribute('data-preview-id', previewId);

    const img = document.createElement('img');
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button'; // Prevent form submission
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
        img.onerror = () => { img.src = 'images/placeholder.png'; } // Fallback image
        // Store the URL with the element
        previewWrapper.imageUrl = existingUrl;
        removeBtn.onclick = () => {
            // Mark this existing URL for deletion
            if (!imagesToDelete.includes(existingUrl)) {
                 imagesToDelete.push(existingUrl);
            }
            // Visually remove, but don't remove from existingImageUrls array yet
            previewWrapper.style.display = 'none'; // Hide instead of remove to track deletion
            console.log("Marked for deletion:", existingUrl);
            console.log("Images to delete:", imagesToDelete);
        };
    } else if (fileObject) {
        const reader = new FileReader();
        reader.onload = (e) => { img.src = e.target.result; }
        reader.readAsDataURL(fileObject);
        previewWrapper.fileData = fileObject; // Store file object
        removeBtn.onclick = () => {
            selectedFiles = selectedFiles.filter(f => f !== fileObject); // Remove from staging array
            previewWrapper.remove(); // Remove preview element completely
            console.log("Removed new file from selection:", fileObject.name);
             console.log("Selected files now:", selectedFiles);
        };
    }

    previewWrapper.appendChild(img);
    previewWrapper.appendChild(removeBtn);
    previewWrapper.appendChild(progressBar);
    imagePreviewArea.appendChild(previewWrapper);
}


// --- Upload Image Function ---
async function uploadImage(file, productId, index) {
    if (!window.storage || !window.storageRef || !window.uploadBytesResumable || !window.getDownloadURL) {
        throw new Error("Firebase Storage functions not available.");
    }
     // Find the preview element associated with this specific file object
     const previewWrapper = [...imagePreviewArea.querySelectorAll('.image-preview-item')].find(el => el.fileData === file);
     const progressBar = previewWrapper?.querySelector('.upload-progress-bar');
     const progressFill = progressBar?.querySelector('div');

    const timestamp = Date.now();
    // Use more robust unique naming
    const uniqueFileName = `${timestamp}-image${index}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const filePath = `onlineProductImages/${productId}/${uniqueFileName}`;
    const fileRef = window.storageRef(window.storage, filePath);

    console.log(`Uploading ${file.name} to ${filePath}`);
    if (progressBar) progressBar.style.display = 'block';
    if (progressFill) progressFill.style.width = '0%'; // Reset progress

    const uploadTask = window.uploadBytesResumable(fileRef, file);

    return new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log(`${file.name} Upload is ${progress.toFixed(0)}% done`);
                if (progressFill) progressFill.style.width = `${progress}%`;
                if (uploadProgressInfo) uploadProgressInfo.textContent = `Uploading ${file.name}: ${progress.toFixed(0)}%`;
            },
            (error) => {
                console.error(`Upload failed for ${file.name}:`, error);
                if (progressBar) progressBar.style.backgroundColor = 'red';
                if (uploadProgressInfo) uploadProgressInfo.textContent = `Upload failed for ${file.name}.`;
                reject(error);
            },
            async () => {
                console.log(`${file.name} uploaded successfully.`);
                 if (progressBar) progressBar.style.backgroundColor = 'var(--success-color)';
                 if (uploadProgressInfo) uploadProgressInfo.textContent = `Upload complete for ${file.name}. Getting URL...`;
                try {
                    const downloadURL = await window.getDownloadURL(uploadTask.snapshot.ref);
                    console.log('File available at', downloadURL);
                    resolve(downloadURL);
                } catch (error) {
                    console.error(`Failed to get download URL for ${file.name}:`, error);
                    if (progressBar) progressBar.style.backgroundColor = 'red'; // Mark error getting URL
                     if (uploadProgressInfo) uploadProgressInfo.textContent = `Failed to get URL for ${file.name}.`;
                    reject(error);
                }
            }
        );
    });
}

// --- Delete Stored Image Function ---
async function deleteStoredImage(imageUrl) {
    if (!window.storage || !window.storageRef || !window.deleteObject) {
         console.error("Firebase Storage delete functions not available.");
         return; // Don't throw error, just log and return
    }
     if (!imageUrl || !(imageUrl.startsWith('https://firebasestorage.googleapis.com/') || imageUrl.startsWith('gs://'))) {
         console.warn("Invalid or non-Firebase Storage URL provided for deletion:", imageUrl);
         return;
     }

     try {
         console.log("Attempting to delete image from Storage:", imageUrl);
         const imageRef = window.storageRef(window.storage, imageUrl); // Get reference from URL
         await window.deleteObject(imageRef);
         console.log("Successfully deleted image from Storage:", imageUrl);
     } catch (error) {
         if (error.code === 'storage/object-not-found') {
             console.warn("Image not found in Storage (may have been deleted already):", imageUrl);
         } else {
             console.error("Error deleting image from Storage:", imageUrl, error);
             // Consider whether to inform the user or just log
         }
     }
}


// --- Save/Update Online Product Handler (UPDATED) ---
async function handleSaveProduct(event) {
    event.preventDefault();
    if (!window.db || !window.collection || !window.addDoc || !window.doc || !window.updateDoc || !window.serverTimestamp ) {
         alert("Database functions are unavailable. Cannot save.");
         return;
     }

    // Disable button, show spinner
    if (saveProductBtn) saveProductBtn.disabled = true;
    if (saveSpinner) saveSpinner.style.display = 'inline-block';
    if (saveIcon) saveIcon.style.display = 'none';
    if (saveText) saveText.textContent = 'Saving...';
    if (uploadProgressInfo) uploadProgressInfo.textContent = 'Preparing data...';

    const productId = editProductIdInput?.value;
    const isEditing = !!productId;
    let finalProductId = productId; // ID used for uploads and final save

    // --- Basic Validation ---
    const productName = productNameInput?.value.trim();
    const category = productCategoryInput?.value.trim();
    const unit = productUnitSelect?.value || null;
    const salePrice = parseNumericInput(productSalePriceInput?.value);

    if (!productName || !category || !unit || salePrice === null || isNaN(salePrice)) {
         alert("Product Name, Category, Unit, and Base Sale Price are required fields and must be valid.");
         // Re-enable button
          if (saveProductBtn) saveProductBtn.disabled = false;
          if (saveSpinner) saveSpinner.style.display = 'none';
          if (saveIcon) saveIcon.style.display = '';
          if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product';
          if (uploadProgressInfo) uploadProgressInfo.textContent = '';
          return;
    }
    // Further validation for numeric inputs (allow null for optional fields)
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
         alert("Please enter valid numbers (or leave blank) for optional prices/charges.");
         // Re-enable button
          if (saveProductBtn) saveProductBtn.disabled = false;
          if (saveSpinner) saveSpinner.style.display = 'none';
          if (saveIcon) saveIcon.style.display = '';
          if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product';
          if (uploadProgressInfo) uploadProgressInfo.textContent = '';
          return;
     }
    // --- End Validation ---


    // --- Prepare Base Data (without images yet) ---
     const productData = {
        productName: productName,
        productName_lowercase: productName.toLowerCase(),
        category: category,
        category_lowercase: category.toLowerCase(),
        unit: unit,
        description: productDescInput?.value.trim() || '',
        isEnabled: isEnabledCheckbox?.checked ?? true,
        options: [], // Initialize options array
        // Optional offline fields
        brand: productBrandInput?.value.trim() || null,
        itemCode: productItemCodeInput?.value.trim() || null,
        hsnSacCode: productHsnSacCodeInput?.value.trim() || null,
     };

     // --- Prepare Pricing Object ---
     const pricing = { rate: salePrice }; // Base Sale Price
     if (purchasePrice !== null) pricing.purchasePrice = purchasePrice;
     if (mrp !== null) pricing.mrp = mrp;
     if (gstRate !== null) pricing.gstRate = gstRate;
     if (unit === 'Sq Feet' && minOrderValue !== null) pricing.minimumOrderValue = minOrderValue;
     // Wedding Card specific
     if (category.toLowerCase().includes('wedding card')) {
          if (designCharge !== null) pricing.designCharge = designCharge;
          if (printingCharge !== null) pricing.printingChargeBase = printingCharge;
          if (transportCharge !== null) pricing.transportCharge = transportCharge;
          if (extraMarginPercent !== null) pricing.extraMarginPercent = extraMarginPercent;
     }
     // Extra Charges
     pricing.hasExtraCharges = hasExtraChargesCheckbox?.checked ?? false;
     if (pricing.hasExtraCharges) {
          pricing.extraCharge = {
              name: extraChargeNameInput?.value.trim() || 'Additional Charge',
              amount: extraChargeAmount ?? 0
          };
     } // No need for else, field won't exist if not checked

     productData.pricing = pricing;

     // --- Prepare Options ---
      const optionsString = productOptionsInput?.value.trim();
      if (optionsString) {
          try {
              productData.options = JSON.parse(optionsString);
              if (!Array.isArray(productData.options)) throw new Error("Options must be an array.");
               // Further validation can be added here to check if each item has 'name' and 'values' array
          } catch (err) {
              showMessage('Error: Invalid JSON format in Options field. Fix or clear it.', true);
               if (saveProductBtn) saveProductBtn.disabled = false; // Re-enable button
               if (saveSpinner) saveSpinner.style.display = 'none';
               if (saveIcon) saveIcon.style.display = '';
               if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product';
               if (uploadProgressInfo) uploadProgressInfo.textContent = '';
               return;
          }
      }

      // --- Timestamps ---
      productData.updatedAt = window.serverTimestamp();
      if (!isEditing) {
          productData.createdAt = window.serverTimestamp();
          productData.imageUrls = []; // Ensure imageUrls exists for new doc before potential upload
      }

    // --- Save/Update Firestore (Part 1 - To get ID if adding) and Handle Images ---
    let uploadedImageUrls = [];
    let finalImageUrls = [];
    // Get existing URLs from hidden input (safer than relying on global var)
    let currentExistingUrls = [];
     try {
         currentExistingUrls = JSON.parse(existingImageUrlsInput?.value || '[]');
     } catch {
         console.error("Could not parse existing image URLs from hidden input.");
     }


    try {
        // Step 1: Save/Update text data to get ID if needed
        if (!isEditing) {
             if (uploadProgressInfo) uploadProgressInfo.textContent = 'Saving product info...';
             const docRef = await window.addDoc(window.collection(window.db, "onlineProducts"), productData);
             finalProductId = docRef.id;
             console.log("Initial online product data saved with ID:", finalProductId);
        } else {
             finalProductId = productId; // Use existing ID
             // Optionally update text data here if you want it saved before image uploads start
             // await window.updateDoc(window.doc(window.db, "onlineProducts", finalProductId), productData);
             // console.log("Text data updated before image processing for:", finalProductId);
        }

        // Step 2: Handle image deletions from Storage (only in edit mode)
        if (isEditing && imagesToDelete.length > 0) {
             console.log("Deleting images from Storage:", imagesToDelete);
             if (uploadProgressInfo) uploadProgressInfo.textContent = 'Deleting removed images...';
             const deletePromises = imagesToDelete.map(url => deleteStoredImage(url));
             await Promise.allSettled(deletePromises); // Wait for deletions to attempt
             console.log("Finished attempting image deletions.");
              // Update the list of current URLs after deletion
             currentExistingUrls = currentExistingUrls.filter(url => !imagesToDelete.includes(url));
        }

        // Step 3: Handle image uploads
        if (selectedFiles.length > 0) {
             console.log(`Starting upload for ${selectedFiles.length} new images...`);
             if (uploadProgressInfo) uploadProgressInfo.textContent = `Uploading ${selectedFiles.length} images... (0%)`; // Initial progress

            // We need to handle progress reporting better for multiple files
            let totalBytes = selectedFiles.reduce((acc, file) => acc + file.size, 0);
            let totalBytesTransferred = 0;
            let completedUploads = 0;

             const uploadPromises = selectedFiles.map(async (file, index) => {
                if (!window.storage || !window.storageRef || !window.uploadBytesResumable || !window.getDownloadURL) { throw new Error("Storage functions missing."); }
                 const timestamp = Date.now();
                 const uniqueFileName = `${timestamp}-image${index}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                 const filePath = `onlineProductImages/${finalProductId}/${uniqueFileName}`;
                 const fileRef = window.storageRef(window.storage, filePath);
                 const uploadTask = window.uploadBytesResumable(fileRef, file);

                 // Find preview element more reliably
                 const previewWrapper = [...imagePreviewArea.querySelectorAll('.image-preview-item')].find(el => el.fileData === file);
                 const progressBar = previewWrapper?.querySelector('.upload-progress-bar');
                 const progressFill = progressBar?.querySelector('div');
                 if(progressBar) progressBar.style.display = 'block';
                 if(progressFill) progressFill.style.width = '0%';


                 return new Promise((resolve, reject) => {
                     uploadTask.on('state_changed',
                         (snapshot) => {
                             // Note: This progress is per file, calculating aggregate is complex here
                             const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                              if (progressFill) progressFill.style.width = `${progress}%`;
                              // Update aggregate progress (approximate)
                              // Need a more robust way if detailed aggregate progress is needed
                              if(uploadProgressInfo) uploadProgressInfo.textContent = `Uploading image ${index+1}/${selectedFiles.length}: ${progress.toFixed(0)}%`;

                         },
                         (error) => reject(error), // Let outer catch handle logging
                         async () => {
                            if(progressBar) progressBar.style.backgroundColor = 'var(--success-color)';
                            if(uploadProgressInfo) uploadProgressInfo.textContent = `Getting URL for image ${index+1}...`;
                             try {
                                 const downloadURL = await window.getDownloadURL(uploadTask.snapshot.ref);
                                 resolve(downloadURL);
                             } catch (getUrlError) {
                                 reject(getUrlError); // Reject if URL fails
                             }
                         }
                     );
                 });
             });

            // Wait for all uploads to complete
            uploadedImageUrls = await Promise.all(uploadPromises);
            if (uploadProgressInfo) uploadProgressInfo.textContent = 'All images uploaded!';
        } else {
             if (uploadProgressInfo && !isEditing) uploadProgressInfo.textContent = 'Product info saved. No new images selected.';
             else if (uploadProgressInfo) uploadProgressInfo.textContent = ''; // Clear progress if editing and no new uploads
        }


        // Step 4: Combine URLs and Final Firestore Update
        finalImageUrls = [...currentExistingUrls, ...uploadedImageUrls]; // Combine kept old URLs and new URLs
        productData.imageUrls = finalImageUrls; // Add final URLs array to product data

        console.log("Final product data being sent:", productData);

        // Final update to Firestore doc with image URLs included
        const finalProductRef = window.doc(window.db, "onlineProducts", finalProductId);
        await window.updateDoc(finalProductRef, {
            imageUrls: productData.imageUrls,
            updatedAt: window.serverTimestamp(),
            // Update other fields as well, in case they changed while images uploaded
            productName: productData.productName,
            productName_lowercase: productData.productName_lowercase,
            category: productData.category,
            category_lowercase: productData.category_lowercase,
            unit: productData.unit,
            description: productData.description,
            isEnabled: productData.isEnabled,
            options: productData.options,
            pricing: productData.pricing,
            brand: productData.brand,
            itemCode: productData.itemCode,
            hsnSacCode: productData.hsnSacCode
        });

        showMessage(isEditing ? 'Online Product updated successfully!' : 'Online Product added successfully!', false);
        closeProductModal();
        // Firestore listener will handle table refresh

    } catch (error) {
        console.error("Error during save/upload process:", error);
        showMessage(`Error saving product or uploading images: ${error.message || 'Unknown error'}. Check console.`, true);
    } finally {
        // Restore button state
        if(saveProductBtn) saveProductBtn.disabled = false;
        if(saveSpinner) saveSpinner.style.display = 'none';
        if(saveIcon) saveIcon.style.display = '';
        if(saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product';
        if(uploadProgressInfo) setTimeout(() => { if(uploadProgressInfo) uploadProgressInfo.textContent = ''; }, 3000);
    }
}


// --- Delete Handling (UPDATED for Image Deletion) ---
function handleDeleteButtonClick(event) {
    event.preventDefault();
    // Use the globally set productToDeleteId and productToDeleteName from openEditModal
    if (!productToDeleteId || !productToDeleteName) {
        console.error("Product ID or Name for deletion is not set.");
        return;
    }
    console.log(`Delete button clicked for online product ${productToDeleteName} (${productToDeleteId}). Opening confirmation modal.`);
    if (deleteWarningMessage) deleteWarningMessage.innerHTML = `Are you sure you want to delete the online product "<strong>${escapeHtml(productToDeleteName)}</strong>"? <br>This will also delete its images from storage. This action cannot be undone.`;
    if(deleteConfirmCheckbox) deleteConfirmCheckbox.checked = false;
    if(confirmDeleteFinalBtn) confirmDeleteFinalBtn.disabled = true;
    if(deleteConfirmModal) deleteConfirmModal.classList.add('active');
}

function closeDeleteConfirmModal() { if (deleteConfirmModal) { deleteConfirmModal.classList.remove('active'); } }
function handleConfirmCheckboxChange() { if (deleteConfirmCheckbox && confirmDeleteFinalBtn) { confirmDeleteFinalBtn.disabled = !deleteConfirmCheckbox.checked; } }

async function handleFinalDelete() {
    if (!deleteConfirmCheckbox?.checked || !productToDeleteId) {
        console.error("Confirmation checkbox not checked or product ID missing.");
        return;
    }
    // Ensure core functions are available
     if (!window.db || !window.doc || !window.getDoc || !window.deleteDoc || !window.storage || !window.storageRef || !window.deleteObject) {
         alert("Core Firebase functions unavailable. Cannot delete.");
         return;
     }

    console.log(`Proceeding with deletion of online product ID: ${productToDeleteId}`);
    if(confirmDeleteFinalBtn) {
        confirmDeleteFinalBtn.disabled = true;
        confirmDeleteFinalBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    }

    const productRef = window.doc(window.db, "onlineProducts", productToDeleteId); // Target onlineProducts

    try {
        // 1. Get the document to find associated images
        const productSnap = await window.getDoc(productRef);

        if (productSnap.exists()) {
            const productData = productSnap.data();
            // 2. Delete images from Storage first
            if (productData.imageUrls && Array.isArray(productData.imageUrls) && productData.imageUrls.length > 0) {
                 console.log("Deleting associated images from Storage...");
                 const deletePromises = productData.imageUrls.map(url => deleteStoredImage(url)); // Use helper
                 await Promise.allSettled(deletePromises); // Wait for deletions attempt
                 console.log("Finished attempting image deletions.");
            } else {
                 console.log("No associated images found in Firestore document.");
            }
        } else {
             console.warn("Product document not found in Firestore, cannot delete images.");
        }

        // 3. Now delete the Firestore document
        await window.deleteDoc(productRef);

        console.log(`Successfully deleted online product: ${productToDeleteId}`);
        showToast(`Product "${productToDeleteName || ''}" deleted successfully!`);
        closeDeleteConfirmModal();
        closeProductModal(); // Close the edit modal too if open
        // Listener will refresh the table automatically

    } catch (error) {
        console.error(`Error deleting online product ${productToDeleteId}:`, error);
        alert(`Failed to delete product: ${error.message}`);
    } finally {
         if(confirmDeleteFinalBtn) {
             confirmDeleteFinalBtn.disabled = !deleteConfirmCheckbox?.checked;
             confirmDeleteFinalBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Confirm Delete';
         }
    }
}