// js/product_management.js (Online Version - Based on V2.5 + New Features)

// --- Ensure Firebase Functions are available globally via HTML script block ---
// We expect db, auth, storage, collection, onSnapshot, query, orderBy, doc,
// addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp,
// storageRef, uploadBytesResumable, getDownloadURL, deleteObject
// to be available on the window object.

// --- DOM Elements ---
const productTableBody = document.getElementById('productTableBody');
const loadingRow = document.getElementById('loadingMessage'); // Check if this ID exists in your HTML
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
const saveSpinner = saveProductBtn ? saveProductBtn.querySelector('.fa-spinner') : null;
const saveIcon = saveProductBtn ? saveProductBtn.querySelector('.fa-save') : null;
const saveText = saveProductBtn ? saveProductBtn.querySelector('span') : null;
const editProductIdInput = document.getElementById('editProductId');
const deleteProductBtn = document.getElementById('deleteProductBtn');

// New Modal Form Field References
const productNameInput = document.getElementById('productName');
const productCategoryInput = document.getElementById('productCategory');
const productUnitSelect = document.getElementById('productUnit');
const productDescInput = document.getElementById('productDescription');
const isEnabledCheckbox = document.getElementById('isEnabled');
// Images
const productImagesInput = document.getElementById('productImages');
const imagePreviewArea = document.getElementById('image-preview-area');
const uploadProgressInfo = document.getElementById('upload-progress-info');
const existingImageUrlsInput = document.getElementById('existingImageUrls'); // Hidden input
// Pricing
const productSalePriceInput = document.getElementById('productSalePrice');
const productMinOrderValueInput = document.getElementById('productMinOrderValue');
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
let selectedFiles = []; // Stores files selected for upload
let existingImageUrls = []; // Stores existing image URLs during edit
let imagesToDelete = []; // Stores existing image URLs marked for deletion

// --- Helper Functions ---
function formatCurrency(amount) { const num = Number(amount); return isNaN(num) || num === null || num === undefined ? '-' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { unsafe = String(unsafe || ''); } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function parseNumericInput(value, allowZero = true) { const trimmedValue = String(value).trim(); if (trimmedValue === '') return null; const num = parseFloat(trimmedValue); if (isNaN(num) || (!allowZero && num <= 0) || (allowZero && num < 0)) { return NaN; } return num; }

// --- Initialization ---
// Changed function name and added event listener trigger
window.initializeOnlineProductManagement = () => {
    console.log("Online Product Management Initializing...");
    // Ensure Firebase services are ready (relying on window object assignment in HTML)
    if (!window.db || !window.auth || !window.storage) {
        console.error("Firebase services (db, auth, storage) not available on window object.");
        alert("Error initializing page. Firebase services missing.");
        return;
    }
    console.log("Firebase services confirmed. Setting up listeners.");
    listenForOnlineProducts(); // Changed function name
    setupEventListeners();
    console.log("Online Product Management Initialized.");
};
// Dispatch event at the end of the script to signal loading completion
window.dispatchEvent(new CustomEvent('productManagementScriptLoaded'));
console.log("product_management.js (Online Version) script loaded.");


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
     document.querySelectorAll('.sq-feet-only').forEach(el => {
          el.style.display = unitType === 'Sq Feet' ? 'block' : 'none';
     });
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
    // Ensure dependencies are available
    if (!window.db || !window.collection || !window.query || !window.orderBy || !window.onSnapshot) {
        console.error("Firestore functions unavailable!");
        if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">Error: DB Connection Failed.</td></tr>`;
        return;
    }

    if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="6" id="loadingMessage" style="text-align: center;">Loading online products...</td></tr>`;

    try {
        console.log(`Setting up Firestore listener for 'onlineProducts'...`);
        // *** TARGET COLLECTION CHANGED TO onlineProducts ***
        const productsRef = window.collection(window.db, "onlineProducts");
        const q = window.query(productsRef); // Removed default sort here, apply in render

        unsubscribeProducts = window.onSnapshot(q, (snapshot) => {
            console.log(`Received ${snapshot.docs.length} online products.`);
            allProductsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            applyFiltersAndRender(); // Render the fetched products
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
        if (!product) return false;
        // Basic check for required fields
        if (!product.productName) return false;

        if (filterSearchValue) {
            const name = (product.productName || '').toLowerCase();
            const category = (product.category || '').toLowerCase();
            // Add other fields to search if needed
            if (!(name.includes(filterSearchValue) || category.includes(filterSearchValue))) {
                return false;
            }
        }
        return true;
    });

    // Sorting logic - needs careful handling of nested pricing object
    filteredProducts.sort((a, b) => {
        let valA = a[currentSortField];
        let valB = b[currentSortField];

        // Handle nested pricing fields
        if (currentSortField.startsWith('pricing.')) {
             const priceField = currentSortField.split('.')[1];
             valA = a.pricing ? a.pricing[priceField] : null;
             valB = b.pricing ? b.pricing[priceField] : null;
        }
        // Handle timestamp sorting
        else if (valA && typeof valA.toDate === 'function') valA = valA.toDate().getTime();
        if (valB && typeof valB.toDate === 'function') valB = valB.toDate().getTime();

        // Convert potential numeric fields to numbers for comparison
        if (['pricing.rate', 'pricing.purchasePrice', 'pricing.gstRate', 'pricing.mrp'].includes(currentSortField)) {
             valA = Number(valA) || 0;
             valB = Number(valB) || 0;
        }
        // Convert potential string fields to lowercase for comparison
        else if (['productName', 'category', 'unit'].includes(currentSortField)) {
             valA = (valA || '').toLowerCase();
             valB = (valB || '').toLowerCase();
        }


        let comparison = 0;
        if (valA > valB) comparison = 1;
        else if (valA < valB) comparison = -1;

        return currentSortDirection === 'desc' ? (comparison * -1) : comparison;
    });

    renderProductTable(filteredProducts); // Call render function
    console.log("Online product rendering complete.");
}

// --- Display Table Row ---
function renderProductTable(products) {
    if (!productTableBody) return;
    productTableBody.innerHTML = ''; // Clear previous rows

    if (products.length === 0) {
        productTableBody.innerHTML = `<tr><td colspan="6" id="noProductsMessage" style="text-align: center;">No online products found matching your criteria.</td></tr>`;
    } else {
        products.forEach(product => {
            const firestoreId = product.id;
            const data = product; // Data includes ID already from cache prep
            const tableRow = productTableBody.insertRow();
            tableRow.setAttribute('data-id', firestoreId);
            tableRow.classList.add('clickable-row');

            const name = data.productName || 'N/A';
            const category = data.category || '-';
            const rate = data.pricing?.rate !== undefined ? formatCurrency(data.pricing.rate) : '-'; // Access nested rate
            const unit = data.unit || '-';
            const enabled = data.isEnabled ? 'Yes' : 'No';

            tableRow.innerHTML = `
                <td>${escapeHtml(name)}</td>
                <td>${escapeHtml(category)}</td>
                <td style="text-align: right;">${rate}</td>
                <td style="text-align: center;">${escapeHtml(unit)}</td>
                <td style="text-align: center;">${enabled}</td>
                <td style="text-align: center;">
                     <button class="button edit-product-btn" style="background-color: var(--info-color); color: white; padding: 5px 8px; font-size: 0.8em;" title="Edit">
                         <i class="fas fa-edit"></i> Edit
                     </button>
                </td>
            `;

            // Add click listener for editing
             const editBtn = tableRow.querySelector('.edit-product-btn');
             if (editBtn) {
                 editBtn.addEventListener('click', (e) => {
                     e.stopPropagation(); // Prevent row click listener if button is clicked
                     console.log(`Edit button clicked for: ${firestoreId}`);
                     openEditModal(firestoreId, data);
                 });
             }
              // Add row click listener (optional, could be confusing with button)
             /*
             tableRow.addEventListener('click', () => {
                 console.log(`Row clicked, opening edit modal for: ${firestoreId}`);
                 openEditModal(firestoreId, data);
             });
             */
        });
    }
}


// --- Modal Handling ---
function openAddModal() {
    if (!productModal || !productForm) return;
    console.log("Opening modal to add new ONLINE product.");
    modalTitle.innerHTML = '<i class="fas fa-plus-circle success-icon"></i> Add New Online Product';
    editProductIdInput.value = '';
    productForm.reset();
    // Reset specific fields and states
    if(isEnabledCheckbox) isEnabledCheckbox.checked = true;
    if(hasExtraChargesCheckbox) hasExtraChargesCheckbox.checked = false;
    existingImageUrls = []; // Clear existing images tracker
    selectedFiles = []; // Clear selected files
    imagesToDelete = []; // Clear deletion queue
    if(imagePreviewArea) imagePreviewArea.innerHTML = ''; // Clear previews
    if(uploadProgressInfo) uploadProgressInfo.innerHTML = ''; // Clear progress
    if(saveProductBtn) saveProductBtn.disabled = false;
    if(saveSpinner) saveSpinner.style.display = 'none';
    if(saveIcon) saveIcon.style.display = '';
    if(saveText) saveText.textContent = 'Save Product';
    if (deleteProductBtn) deleteProductBtn.style.display = 'none';
    toggleWeddingFields(); // Update visibility
    toggleSqFtFields();
    toggleExtraCharges();
    productModal.classList.add('active');
}

async function openEditModal(firestoreId, data) {
    if (!productModal || !productForm || !data) return;
    console.log("Opening modal to edit ONLINE product:", firestoreId);
    modalTitle.innerHTML = '<i class="fas fa-edit info-icon"></i> Edit Online Product';
    productForm.reset(); // Reset form first

    // Populate basic fields
    editProductIdInput.value = firestoreId;
    productNameInput.value = data.productName || '';
    productCategoryInput.value = data.category || ''; // Populate Category
    productUnitSelect.value = data.unit || 'Qty';
    productDescInput.value = data.description || '';
    isEnabledCheckbox.checked = data.isEnabled !== undefined ? data.isEnabled : true;

    // Populate Pricing
    const pricing = data.pricing || {};
    productSalePriceInput.value = pricing.rate ?? '';
    productMinOrderValueInput.value = pricing.minimumOrderValue ?? '';
    productPurchasePriceInput.value = pricing.purchasePrice ?? ''; // Optional
    productMrpInput.value = pricing.mrp ?? ''; // Optional
    productGstRateInput.value = pricing.gstRate ?? ''; // Optional

    // Populate Wedding Card Fields
    designChargeInput.value = pricing.designCharge ?? '';
    printingChargeInput.value = pricing.printingChargeBase ?? '';
    transportChargeInput.value = pricing.transportCharge ?? '';
    extraMarginPercentInput.value = pricing.extraMarginPercent ?? '';

    // Populate Extra Charges
    hasExtraChargesCheckbox.checked = pricing.hasExtraCharges || false;
    extraChargeNameInput.value = pricing.extraCharge?.name || '';
    extraChargeAmountInput.value = pricing.extraCharge?.amount ?? '';

    // Populate Options JSON
    if (productOptionsInput) {
        if (data.options) {
             try { productOptionsInput.value = typeof data.options === 'string' ? data.options : JSON.stringify(data.options, null, 2); }
             catch { productOptionsInput.value = ''; }
        } else { productOptionsInput.value = ''; }
    }

     // Populate Optional Offline Fields
     if(productBrandInput) productBrandInput.value = data.brand || '';
     if(productItemCodeInput) productItemCodeInput.value = data.itemCode || '';
     if(productHsnSacCodeInput) productHsnSacCodeInput.value = data.hsnSacCode || '';


    // Handle Images
    selectedFiles = []; // Clear any previously selected files for upload
    imagesToDelete = []; // Clear deletion queue
    imagePreviewArea.innerHTML = ''; // Clear previous previews
    existingImageUrls = data.imageUrls || []; // Store existing URLs
    existingImageUrlsInput.value = JSON.stringify(existingImageUrls); // Store in hidden input

    // Display existing images
    existingImageUrls.forEach(url => displayImagePreview(null, url));

    // Set button states
    if(saveProductBtn) saveProductBtn.disabled = false;
    if(saveSpinner) saveSpinner.style.display = 'none';
    if(saveIcon) saveIcon.style.display = '';
    if(saveText) saveText.textContent = 'Update Product';
    if(deleteProductBtn) deleteProductBtn.style.display = 'inline-flex';
    productToDeleteId = firestoreId; // Set ID for potential deletion
    productToDeleteName = data.productName || 'this product';

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
        // Clear file input value if needed, though it often resets automatically
        if (productImagesInput) productImagesInput.value = null;
    }
}


// --- Image Handling ---
function handleFileSelection(event) {
    if (!imagePreviewArea || !productImagesInput) return;
    const files = Array.from(event.target.files); // Get selected files as array

    // Combine newly selected files with files already staged (if any)
    const currentFilesCount = selectedFiles.length + imagePreviewArea.querySelectorAll('.image-preview-item').length - imagesToDelete.length;
    const availableSlots = 4 - currentFilesCount;

    if (files.length > availableSlots) {
        alert(`You can only upload a maximum of 4 images. You have ${currentFilesCount} existing/staged images and tried to add ${files.length}. Please select fewer files.`);
        productImagesInput.value = null; // Clear selection
        return;
    }

    // Store selected files for later upload
    selectedFiles = selectedFiles.concat(files);

    // Display previews for newly selected files
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            displayImagePreview(file, null); // Display preview for new file
        }
    });

     // Clear the file input value so the same file can be selected again if removed and re-added
     productImagesInput.value = null;
}

function displayImagePreview(fileObject, existingUrl = null) {
    if (!imagePreviewArea) return;

    const previewId = existingUrl || `new-${Date.now()}-${Math.random()}`; // Unique ID for the preview element
    const previewWrapper = document.createElement('div');
    previewWrapper.className = 'image-preview-item';
    previewWrapper.setAttribute('data-preview-id', previewId);

    const img = document.createElement('img');
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-image-btn';
    removeBtn.innerHTML = '&times;'; // Close icon
    removeBtn.title = 'Remove image';

    // For progress bar
    const progressBar = document.createElement('div');
    progressBar.className = 'upload-progress-bar';
    const progressFill = document.createElement('div');
    progressBar.appendChild(progressFill);
    progressBar.style.display = 'none'; // Hide initially

    if (existingUrl) {
        // Display existing image from URL
        img.src = existingUrl;
        removeBtn.onclick = () => {
            // Mark this existing URL for deletion on save
            imagesToDelete.push(existingUrl);
            previewWrapper.remove();
            console.log("Marked for deletion:", existingUrl);
        };
    } else if (fileObject) {
        // Display preview for new file using FileReader
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
        }
        reader.readAsDataURL(fileObject);
        // Store file object reference with the element for upload later
        previewWrapper.fileData = fileObject;

        removeBtn.onclick = () => {
            // Remove this new file from the selectedFiles array
            selectedFiles = selectedFiles.filter(f => f !== fileObject);
            previewWrapper.remove();
            console.log("Removed new file from selection:", fileObject.name);
        };
    }

    previewWrapper.appendChild(img);
    previewWrapper.appendChild(removeBtn);
    previewWrapper.appendChild(progressBar); // Add progress bar element
    imagePreviewArea.appendChild(previewWrapper);
}


// --- Upload Image Function ---
async function uploadImage(file, productId, index) {
    // Ensure storage and related functions are available
    if (!window.storage || !window.storageRef || !window.uploadBytesResumable || !window.getDownloadURL) {
        throw new Error("Firebase Storage functions not available.");
    }

    // Find the corresponding preview element to show progress
    const previewElement = imagePreviewArea.querySelector(`[data-preview-id="new-${file.lastModified}-${file.name}"]`) || // Heuristic match for new files
                           [...imagePreviewArea.querySelectorAll('.image-preview-item')].find(el => el.fileData === file); // Match by file object if possible
    const progressBar = previewElement?.querySelector('.upload-progress-bar');
    const progressFill = progressBar?.querySelector('div');

    // Create a unique path
    const timestamp = Date.now();
    const filePath = `onlineProductImages/${productId}/${timestamp}-image${index}-${file.name}`;
    const fileRef = window.storageRef(window.storage, filePath);

    console.log(`Uploading ${file.name} to ${filePath}`);
    if (progressBar) progressBar.style.display = 'block'; // Show progress bar

    const uploadTask = window.uploadBytesResumable(fileRef, file);

    return new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
            (snapshot) => {
                // Progress monitoring
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log(`${file.name} Upload is ${progress}% done`);
                if (progressFill) progressFill.style.width = `${progress}%`;
            },
            (error) => {
                // Handle unsuccessful uploads
                console.error(`Upload failed for ${file.name}:`, error);
                if (progressBar) progressBar.style.backgroundColor = 'red'; // Indicate error
                reject(error);
            },
            async () => {
                // Handle successful uploads on complete
                console.log(`${file.name} uploaded successfully.`);
                if (progressBar) progressBar.style.backgroundColor = 'var(--success-color)'; // Indicate success
                try {
                    const downloadURL = await window.getDownloadURL(uploadTask.snapshot.ref);
                    console.log('File available at', downloadURL);
                    resolve(downloadURL); // Resolve the promise with the download URL
                } catch (error) {
                    console.error(`Failed to get download URL for ${file.name}:`, error);
                    reject(error); // Reject if URL retrieval fails
                }
            }
        );
    });
}

// --- Delete Stored Image Function ---
async function deleteStoredImage(imageUrl) {
    // Ensure storage and related functions are available
    if (!window.storage || !window.storageRef || !window.deleteObject) {
         console.error("Firebase Storage delete functions not available.");
         return; // Or throw error
    }
     if (!imageUrl || !imageUrl.startsWith('https://firebasestorage.googleapis.com/')) {
         console.warn("Invalid or non-Firebase Storage URL provided for deletion:", imageUrl);
         return; // Don't try to delete non-storage URLs
     }

     try {
         const imageRef = window.storageRef(window.storage, imageUrl); // Get reference from URL
         await window.deleteObject(imageRef);
         console.log("Successfully deleted image from Storage:", imageUrl);
     } catch (error) {
         // Handle errors, e.g., file not found (might have been deleted already)
         if (error.code === 'storage/object-not-found') {
             console.warn("Image not found in Storage (may have been deleted already):", imageUrl);
         } else {
             console.error("Error deleting image from Storage:", imageUrl, error);
             // Optionally re-throw or alert user
         }
     }
}


// --- Save/Update Online Product Handler (UPDATED) ---
async function handleSaveProduct(event) {
    event.preventDefault();
     // Ensure dependencies are available
     if (!window.db || !window.collection || !window.addDoc || !window.doc || !window.updateDoc || !window.serverTimestamp ) {
         alert("Database functions are unavailable. Cannot save.");
         return;
     }

    // Disable button, show spinner
    if (saveProductBtn) saveProductBtn.disabled = true;
    if (saveSpinner) saveSpinner.style.display = 'inline-block';
    if (saveIcon) saveIcon.style.display = 'none';
    if (saveText) saveText.textContent = 'Saving...';
    if (uploadProgressInfo) uploadProgressInfo.textContent = 'Starting save process...';

    const productId = editProductIdInput.value;
    const isEditing = !!productId;
    let finalProductId = productId; // Will hold the ID used for uploads

    // --- Validation ---
    const productName = productNameInput?.value.trim();
    const category = productCategoryInput?.value.trim();
    const unit = productUnitSelect?.value || null;
    const salePrice = parseNumericInput(productSalePriceInput?.value);

    if (!productName || !category || !unit || isNaN(salePrice)) {
         alert("Product Name, Category, Unit, and Base Sale Price are required fields.");
         if (saveProductBtn) saveProductBtn.disabled = false;
         if (saveSpinner) saveSpinner.style.display = 'none';
         if (saveIcon) saveIcon.style.display = '';
         if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product';
         if (uploadProgressInfo) uploadProgressInfo.textContent = '';
         return;
    }
    // Further validation for numeric inputs
    const purchasePrice = parseNumericInput(productPurchasePriceInput?.value);
    const minSalePrice = null; // Not currently in the online form, remove reference
    const mrp = parseNumericInput(productMrpInput?.value);
    const gstRate = parseNumericInput(productGstRateInput?.value);
    const minOrderValue = parseNumericInput(productMinOrderValueInput?.value);
    const designCharge = parseNumericInput(designChargeInput?.value);
    const printingCharge = parseNumericInput(printingChargeInput?.value);
    const transportCharge = parseNumericInput(transportChargeInput?.value);
    const extraMarginPercent = parseNumericInput(extraMarginPercentInput?.value);
    const extraChargeAmount = parseNumericInput(extraChargeAmountInput?.value);

     if ([purchasePrice, mrp, gstRate, minOrderValue, designCharge, printingCharge, transportCharge, extraMarginPercent, extraChargeAmount].some(isNaN)) {
         alert("Please enter valid numbers (or leave blank) for optional prices/charges. Invalid characters are not allowed.");
          if (saveProductBtn) saveProductBtn.disabled = false;
          if (saveSpinner) saveSpinner.style.display = 'none';
          if (saveIcon) saveIcon.style.display = '';
          if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product';
          if (uploadProgressInfo) uploadProgressInfo.textContent = '';
          return;
     }
    // --- End Validation ---


    // --- Prepare Base Data (without images first) ---
     const productData = {
        productName: productName,
        productName_lowercase: productName.toLowerCase(), // For case-insensitive search/sort
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
        // Timestamp will be added later
     };

     // --- Prepare Pricing Object ---
     const pricing = {
         rate: salePrice, // Base Sale Price
         purchasePrice: purchasePrice, // Optional
         mrp: mrp, // Optional
         gstRate: gstRate, // Optional
     };
     if (productData.unit === 'Sq Feet' && minOrderValue !== null) {
         pricing.minimumOrderValue = minOrderValue;
     }
     // Add wedding card pricing fields if category matches
     if (category.toLowerCase().includes('wedding card')) {
          if (designCharge !== null) pricing.designCharge = designCharge;
          if (printingCharge !== null) pricing.printingChargeBase = printingCharge;
          if (transportCharge !== null) pricing.transportCharge = transportCharge;
          if (extraMarginPercent !== null) pricing.extraMarginPercent = extraMarginPercent;
     }
     // Add extra charges
     pricing.hasExtraCharges = hasExtraChargesCheckbox?.checked ?? false;
     if (pricing.hasExtraCharges) {
          pricing.extraCharge = {
              name: extraChargeNameInput?.value.trim() || 'Additional Charge',
              amount: extraChargeAmount ?? 0
          };
     } else {
         // Optionally remove the extraCharge field if unchecked
         // delete pricing.extraCharge; // Or set to null
     }
     productData.pricing = pricing; // Add pricing object

     // --- Prepare Options ---
      const optionsString = productOptionsInput?.value.trim();
      if (optionsString) {
          try {
              productData.options = JSON.parse(optionsString);
              if (!Array.isArray(productData.options)) throw new Error("Options must be an array.");
              // Basic validation for options structure could be added here
          } catch (err) {
              showMessage('Error: Invalid JSON format in Options field. Must be an array like [{"name":"N", "values":["V1"]}].', true);
              if (saveProductBtn) saveProductBtn.disabled = false; // Re-enable button
              if (saveSpinner) saveSpinner.style.display = 'none';
              if (saveIcon) saveIcon.style.display = '';
              if (saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product';
              if (uploadProgressInfo) uploadProgressInfo.textContent = '';
              return; // Stop saving
          }
      }


    // --- Save/Update Firestore (Part 1 - Get ID if adding) and Handle Images ---
    let uploadedImageUrls = [];
    let finalImageUrls = [];

    try {
        // If ADDING NEW product, save basic data first to get an ID
        if (!isEditing) {
             productData.createdAt = window.serverTimestamp();
             productData.updatedAt = window.serverTimestamp();
             productData.imageUrls = []; // Initialize empty array
             const docRef = await window.addDoc(window.collection(window.db, "onlineProducts"), productData);
             finalProductId = docRef.id; // Get the new ID
             console.log("Initial product data saved with ID:", finalProductId);
             if (uploadProgressInfo) uploadProgressInfo.textContent = 'Product info saved, starting image uploads...';
        } else {
             // Use existing product ID for editing
             finalProductId = productId;
             if (uploadProgressInfo) uploadProgressInfo.textContent = 'Starting image uploads...';
        }

        // --- Now handle image uploads using finalProductId ---
        if (selectedFiles.length > 0) {
            const uploadPromises = selectedFiles.map((file, index) =>
                uploadImage(file, finalProductId, index) // Pass index for potential naming uniqueness
            );
            // Wait for all uploads to complete
            uploadedImageUrls = await Promise.all(uploadPromises);
            if (uploadProgressInfo) uploadProgressInfo.textContent = 'Images uploaded successfully!';
        } else {
             if (uploadProgressInfo) uploadProgressInfo.textContent = 'No new images selected for upload.';
        }

        // --- Handle image deletions for EDITING mode ---
        if (isEditing && imagesToDelete.length > 0) {
             console.log("Deleting images from Storage:", imagesToDelete);
             if (uploadProgressInfo) uploadProgressInfo.textContent += ' Deleting removed images...';
             const deletePromises = imagesToDelete.map(url => deleteStoredImage(url));
             await Promise.allSettled(deletePromises); // Use allSettled to continue even if one delete fails
             console.log("Finished attempting image deletions.");
        }

        // Combine existing (kept) URLs with newly uploaded URLs
        const keptExistingUrls = isEditing ? existingImageUrls.filter(url => !imagesToDelete.includes(url)) : [];
        finalImageUrls = [...keptExistingUrls, ...uploadedImageUrls];

        // --- Final Update/Set to Firestore ---
        productData.imageUrls = finalImageUrls; // Add final URLs array
        productData.updatedAt = window.serverTimestamp(); // Ensure updatedAt is set

        const finalProductRef = window.doc(window.db, "onlineProducts", finalProductId);
        // Use updateDoc if editing (even if no images changed, other fields might have)
        // Use updateDoc if adding and images were uploaded (to add URLs)
        await window.updateDoc(finalProductRef, productData); // Use updateDoc for both cases after initial add

        showMessage(isEditing ? 'Online Product updated successfully!' : 'Online Product added successfully!', false);
        closeProductModal();
        // No need to call loadProducts() here, listener will catch the update/add

    } catch (error) {
        console.error("Error during save/upload process:", error);
        showMessage('Error saving product or uploading images. Check console.', true);
    } finally {
        // Restore button state
        if(saveProductBtn) saveProductBtn.disabled = false;
        if(saveSpinner) saveSpinner.style.display = 'none';
        if(saveIcon) saveIcon.style.display = '';
        if(saveText) saveText.textContent = isEditing ? 'Update Product' : 'Save Product';
        if(uploadProgressInfo) setTimeout(() => { if(uploadProgressInfo) uploadProgressInfo.textContent = ''; }, 3000); // Clear progress message
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
    console.log(`Delete button clicked for ${productToDeleteName} (${productToDeleteId}). Opening confirmation modal.`);
    if (deleteWarningMessage) deleteWarningMessage.innerHTML = `Are you sure you want to delete the online product "<strong>${escapeHtml(productToDeleteName)}</strong>"? <br>This will also delete its images from storage. This action cannot be undone.`;
    if(deleteConfirmCheckbox) deleteConfirmCheckbox.checked = false;
    if(confirmDeleteFinalBtn) confirmDeleteFinalBtn.disabled = true;
    if(deleteConfirmModal) deleteConfirmModal.classList.add('active');
}

function closeDeleteConfirmModal() { /* ... unchanged ... */ }
function handleConfirmCheckboxChange() { /* ... unchanged ... */ }

async function handleFinalDelete() {
    if (!deleteConfirmCheckbox?.checked || !productToDeleteId) {
        console.error("Confirmation checkbox not checked or product ID missing.");
        return;
    }
    if (!window.db || !window.doc || !window.getDoc || !window.deleteDoc) {
         alert("Database functions unavailable. Cannot delete.");
         return;
    }

    console.log(`Proceeding with deletion of online product ID: ${productToDeleteId}`);
    if(confirmDeleteFinalBtn) {
        confirmDeleteFinalBtn.disabled = true;
        confirmDeleteFinalBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    }

    try {
        const productRef = window.doc(window.db, "onlineProducts", productToDeleteId);
        const productSnap = await window.getDoc(productRef);

        if (productSnap.exists()) {
            const productData = productSnap.data();
            // Delete images from Storage first
            if (productData.imageUrls && Array.isArray(productData.imageUrls)) {
                 console.log("Deleting associated images from Storage...");
                 const deletePromises = productData.imageUrls.map(url => deleteStoredImage(url));
                 await Promise.allSettled(deletePromises); // Wait for deletions attempt
                 console.log("Finished attempting image deletions.");
            }
        } else {
             console.warn("Product document not found in Firestore, cannot delete images.");
        }

        // Now delete the Firestore document
        await window.deleteDoc(productRef);

        console.log(`Successfully deleted online product: ${productToDeleteId}`);
        showToast(`Product "${productToDeleteName}" deleted successfully!`);
        closeDeleteConfirmModal();
        closeProductModal(); // Close the edit modal too if open
         // Listener will refresh the table automatically
    } catch (error) {
        console.error(`Error deleting online product ${productToDeleteId}:`, error);
        alert(`Failed to delete product: ${error.message}`);
    } finally {
         if(confirmDeleteFinalBtn) {
             confirmDeleteFinalBtn.disabled = !deleteConfirmCheckbox?.checked; // Re-enable based on checkbox
             confirmDeleteFinalBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Confirm Delete';
         }
    }
}


// --- Toast Notification ---
function showToast(message, duration = 3000) { /* ... unchanged ... */ }
// (Ensure Toast CSS is included, either here or in product_management.css)