// js/product_management.js (Version 2.2 - Delete Confirmation Added)

// --- Firebase Functions (Assured by HTML script block) ---
const { db, collection, onSnapshot, query, orderBy, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } = window;

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
const saveProductBtnSpan = saveProductBtn ? saveProductBtn.querySelector('span') : null;
const editProductIdInput = document.getElementById('editProductId');
const deleteProductBtn = document.getElementById('deleteProductBtn'); // New Delete button in edit modal

// --- Modal Form Field References ---
const productPrintNameInput = document.getElementById('productPrintName');
const productPurchasePriceInput = document.getElementById('productPurchasePrice');
const productSalePriceInput = document.getElementById('productSalePrice');
const productMinSalePriceInput = document.getElementById('productMinSalePrice');
const productMrpInput = document.getElementById('productMrp');
const productGroupInput = document.getElementById('productGroup');
const productBrandInput = document.getElementById('productBrand');
const productItemCodeInput = document.getElementById('productItemCode');
const productUnitSelect = document.getElementById('productUnit');
const productOpeningStockInput = document.getElementById('productOpeningStock');
const productHsnSacCodeInput = document.getElementById('productHsnSacCode');
const productGstRateInput = document.getElementById('productGstRate');
const productSaleDiscountInput = document.getElementById('productSaleDiscount');
const productDescriptionInput = document.getElementById('productDescription');
// Settings Checkboxes
const settingPrintDescCheckbox = document.getElementById('settingPrintDesc');
const settingOneClickSaleCheckbox = document.getElementById('settingOneClickSale');
const settingEnableTrackingCheckbox = document.getElementById('settingEnableTracking');
const settingPrintSerialCheckbox = document.getElementById('settingPrintSerial');
const settingNotForSaleCheckbox = document.getElementById('settingNotForSale');
// Legacy field (optional)
const productCategoryInput = document.getElementById('productCategory');

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
let productToDeleteId = null; // Store ID for delete confirmation
let productToDeleteName = null; // Store Name for delete confirmation

// --- Helper Functions ---
function formatCurrency(amount) {
    const num = Number(amount);
    return isNaN(num) || num === null || num === undefined ? '-' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') { unsafe = String(unsafe || ''); }
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function parseNumericInput(value, allowZero = true) {
    const trimmedValue = String(value).trim();
    if (trimmedValue === '') return null;
    const num = parseFloat(trimmedValue);
    if (isNaN(num) || (!allowZero && num <= 0) || (allowZero && num < 0)) { // Corrected logic
        return NaN;
    }
    return num;
}

// --- Initialization ---
// We need to expose the initialization function to the global scope
window.initializeProductManagement = () => {
    console.log("Product Management Initializing (V2.2)...");
    // Ensure DB is ready before listening
    waitForDbConnection(() => {
        console.log("DB connection confirmed. Initializing listener (V2.2).");
        listenForProducts(); // Start listening
        setupEventListeners(); // Setup all listeners
        console.log("Product Management Initialized (V2.2).");
    });
};

// --- DB Connection Wait ---
function waitForDbConnection(callback) {
    if (window.db) {
        callback();
    } else {
        let attempts = 0;
        const maxAttempts = 20; // Try for 5 seconds
        const interval = setInterval(() => {
            attempts++;
            if (window.db) {
                clearInterval(interval);
                callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                console.error("Database connection timed out.");
                alert("Error: Could not connect to the database. Please refresh the page.");
            }
        }, 250);
    }
}

// --- Setup Event Listeners ---
function setupEventListeners() {
    if (sortSelect) sortSelect.addEventListener('change', handleSortChange);
    if (filterSearchInput) filterSearchInput.addEventListener('input', handleSearchInput);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
    if (addNewProductBtn) addNewProductBtn.addEventListener('click', openAddModal);

    // Product Modal Listeners
    if (closeProductModalBtn) closeProductModalBtn.addEventListener('click', closeProductModal);
    if (cancelProductBtn) cancelProductBtn.addEventListener('click', closeProductModal);
    if (productModal) productModal.addEventListener('click', (event) => { if (event.target === productModal) closeProductModal(); });
    if (productForm) productForm.addEventListener('submit', handleSaveProduct);
    if (deleteProductBtn) deleteProductBtn.addEventListener('click', handleDeleteButtonClick); // Listener for delete button in edit modal

    // Delete Confirmation Modal Listeners
    if (closeDeleteConfirmModalBtn) closeDeleteConfirmModalBtn.addEventListener('click', closeDeleteConfirmModal);
    if (cancelDeleteFinalBtn) cancelDeleteFinalBtn.addEventListener('click', closeDeleteConfirmModal);
    if (deleteConfirmModal) deleteConfirmModal.addEventListener('click', (event) => { if (event.target === deleteConfirmModal) closeDeleteConfirmModal(); });
    if (deleteConfirmCheckbox) deleteConfirmCheckbox.addEventListener('change', handleConfirmCheckboxChange);
    if (confirmDeleteFinalBtn) confirmDeleteFinalBtn.addEventListener('click', handleFinalDelete);

    console.log("Product Management V2.2 event listeners set up.");
}

// --- Sorting & Filtering Handlers ---
function handleSortChange() { if (!sortSelect) return; const [field, direction] = sortSelect.value.split('_'); if (field && direction) { if (field === currentSortField && direction === currentSortDirection) return; currentSortField = field; currentSortDirection = direction; applyFiltersAndRender(); } }
function handleSearchInput() { clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(applyFiltersAndRender, 300); }
function clearFilters() { if(filterSearchInput) filterSearchInput.value = ''; if(sortSelect) sortSelect.value = 'createdAt_desc'; currentSortField = 'createdAt'; currentSortDirection = 'desc'; applyFiltersAndRender(); }

// --- Firestore Listener ---
function listenForProducts() {
    if (unsubscribeProducts) { unsubscribeProducts(); unsubscribeProducts = null; }
    if (!db || !collection || !query || !orderBy || !onSnapshot) { console.error("Firestore functions unavailable!"); return; }

    productTableBody.innerHTML = `<tr><td colspan="6" id="loadingMessage" style="text-align: center;">Loading products...</td></tr>`; // Colspan 6
    try {
        console.log(`Setting up Firestore listener for 'products'...`);
        const productsRef = collection(db, "products");
        const q = query(productsRef); // Fetch all initially, sort client-side for flexibility
        unsubscribeProducts = onSnapshot(q, (snapshot) => {
            console.log(`Received ${snapshot.docs.length} products.`);
            allProductsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            applyFiltersAndRender(); // Render after getting data
        }, (error) => {
            console.error("Error fetching products snapshot:", error);
            productTableBody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">Error loading products. Check connection.</td></tr>`; // Colspan 6
        });
    } catch (error) {
        console.error("Error setting up product listener:", error);
        productTableBody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">Error setting up listener.</td></tr>`; // Colspan 6
    }
}

// --- Filter, Sort, Render ---
function applyFiltersAndRender() {
    if (!allProductsCache) return;
    console.log("Applying product filters and rendering (V2.2)...");
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';

    // Filtering
    let filteredProducts = allProductsCache.filter(product => {
        if (!product) return false; // Handle potential null/undefined products
        if (filterSearchValue) {
            const name = (product.printName || '').toLowerCase();
            const itemCode = (product.itemCode || '').toLowerCase();
            const hsn = (product.hsnSacCode || '').toLowerCase();
            const brand = (product.brand || '').toLowerCase();
            const group = (product.group || product.productGroup || '').toLowerCase();
            // Check if any field includes the search value
            if (!(name.includes(filterSearchValue) || itemCode.includes(filterSearchValue) || hsn.includes(filterSearchValue) || brand.includes(filterSearchValue) || group.includes(filterSearchValue))) {
                return false;
            }
        }
        return true;
    });

    // Sorting
    filteredProducts.sort((a, b) => {
        let valA = a[currentSortField]; let valB = b[currentSortField];
        // Handle Timestamps
        if (valA && typeof valA.toDate === 'function') valA = valA.toDate().getTime();
        if (valB && typeof valB.toDate === 'function') valB = valB.toDate().getTime();
        // Handle Numeric Fields for sorting (treat null/undefined as 0 for sorting)
        if (['salePrice', 'purchasePrice', 'gstRate', 'mrp', 'minSalePrice', 'openingStock', 'saleDiscount'].includes(currentSortField)) {
             valA = Number(valA) || 0;
             valB = Number(valB) || 0;
        }
        // Handle String Fields for sorting (treat null/undefined as empty string)
        if (['printName', 'brand', 'itemCode', 'hsnSacCode', 'category', 'group', 'unit'].includes(currentSortField)) {
             valA = (valA || '').toLowerCase();
             valB = (valB || '').toLowerCase();
        }
        // Comparison logic
        let comparison = 0;
        if (valA > valB) comparison = 1;
        else if (valA < valB) comparison = -1;
        return currentSortDirection === 'desc' ? comparison * -1 : comparison;
    });

    // Render
    productTableBody.innerHTML = ''; // Clear previous rows
    if (filteredProducts.length === 0) {
        productTableBody.innerHTML = `<tr><td colspan="6" id="noProductsMessage" style="text-align: center;">No products found matching your criteria.</td></tr>`; // Colspan 6
    } else {
        filteredProducts.forEach(product => displayProductRow(product.id, product));
    }
    console.log("Product rendering complete (V2.2).");
}

// --- Display Table Row (with Row Click) ---
function displayProductRow(firestoreId, data) {
    if (!productTableBody || !data) return;
    const tableRow = productTableBody.insertRow();
    tableRow.setAttribute('data-id', firestoreId);
    tableRow.classList.add('clickable-row'); // Add class for styling and click handling

    const name = data.printName || 'N/A';
    const salePrice = formatCurrency(data.salePrice);
    const purchasePrice = formatCurrency(data.purchasePrice);
    const unit = data.unit || data.productUnit || '-';
    const hsn = data.hsnSacCode || '-';
    const gst = (data.gstRate !== null && data.gstRate !== undefined) ? `${data.gstRate}%` : '-';

    // Create Cells (No Actions column)
    const cellName = tableRow.insertCell(); cellName.textContent = escapeHtml(name);
    const cellSale = tableRow.insertCell(); cellSale.textContent = salePrice; cellSale.style.textAlign = 'right';
    const cellPurchase = tableRow.insertCell(); cellPurchase.textContent = purchasePrice; cellPurchase.style.textAlign = 'right';
    const cellUnit = tableRow.insertCell(); cellUnit.textContent = escapeHtml(unit); cellUnit.style.textAlign = 'center';
    const cellHsn = tableRow.insertCell(); cellHsn.textContent = escapeHtml(hsn);
    const cellGst = tableRow.insertCell(); cellGst.textContent = gst; cellGst.style.textAlign = 'right';

    // Add click listener to the entire row to open the edit modal
    tableRow.addEventListener('click', () => {
        console.log(`Row clicked, opening edit modal for: ${firestoreId}`);
        openEditModal(firestoreId, data);
    });
}


// --- Modal Handling ---
function openAddModal() {
    console.log("Opening modal to add new product (V2.2).");
    if (!productModal || !productForm) return;
    modalTitle.innerHTML = '<i class="fas fa-plus-circle success-icon"></i> Add New Product';
    editProductIdInput.value = ''; // Clear edit ID
    productForm.reset(); // Reset form fields
    // Reset checkboxes explicitly
    settingPrintDescCheckbox.checked = false;
    settingOneClickSaleCheckbox.checked = false;
    settingEnableTrackingCheckbox.checked = false;
    settingPrintSerialCheckbox.checked = false;
    settingNotForSaleCheckbox.checked = false;

    if(saveProductBtnSpan) saveProductBtnSpan.textContent = 'Save Product';
    else if(saveProductBtn) saveProductBtn.innerHTML = '<i class="fas fa-save"></i> Save Product';
    saveProductBtn.disabled = false;

    deleteProductBtn.style.display = 'none'; // Hide delete button in add mode

    productModal.classList.add('active');
}

function openEditModal(firestoreId, data) {
     console.log("Opening modal to edit product (V2.2):", firestoreId);
     if (!productModal || !productForm || !data) return;
     modalTitle.innerHTML = '<i class="fas fa-edit info-icon"></i> Edit Product';
     editProductIdInput.value = firestoreId; // Set the ID for saving

     if(saveProductBtnSpan) saveProductBtnSpan.textContent = 'Update Product';
     else if(saveProductBtn) saveProductBtn.innerHTML = '<i class="fas fa-save"></i> Update Product';
     saveProductBtn.disabled = false;

     // Populate ALL form fields from data
     productPrintNameInput.value = data.printName || '';
     productPurchasePriceInput.value = data.purchasePrice ?? ''; // Use nullish coalescing
     productSalePriceInput.value = data.salePrice ?? '';
     productMinSalePriceInput.value = data.minSalePrice ?? '';
     productMrpInput.value = data.mrp ?? '';
     productGroupInput.value = data.group || data.productGroup || '';
     productBrandInput.value = data.brand || '';
     productItemCodeInput.value = data.itemCode || '';
     productUnitSelect.value = data.unit || data.productUnit || '';
     productOpeningStockInput.value = data.openingStock ?? '';
     productHsnSacCodeInput.value = data.hsnSacCode || '';
     productGstRateInput.value = data.gstRate ?? '';
     productSaleDiscountInput.value = data.saleDiscount ?? '';
     productDescriptionInput.value = data.description || '';
     // Settings Checkboxes
     settingPrintDescCheckbox.checked = data.settings_printDescription || false;
     settingOneClickSaleCheckbox.checked = data.settings_oneClickSale || false;
     settingEnableTrackingCheckbox.checked = data.settings_enableTracking || false;
     settingPrintSerialCheckbox.checked = data.settings_printSerialNo || false;
     settingNotForSaleCheckbox.checked = data.settings_notForSale || false;
     // Legacy category
     productCategoryInput.value = data.category || '';

     deleteProductBtn.style.display = 'inline-flex'; // Show delete button in edit mode
     // Store ID and Name for potential delete action
     productToDeleteId = firestoreId;
     productToDeleteName = data.printName || 'this product';

     productModal.classList.add('active');
}

function closeProductModal() {
    if (productModal) {
        productModal.classList.remove('active');
        // Reset temporary delete info
        productToDeleteId = null;
        productToDeleteName = null;
    }
}

// --- Save/Update Handler ---
async function handleSaveProduct(event) {
    event.preventDefault();
    if (!db || !collection || !addDoc || !doc || !updateDoc || !serverTimestamp ) {
         alert("Database functions are unavailable. Cannot save.");
         return;
    }

    const productId = editProductIdInput.value;
    const isEditing = !!productId;

    // Get ALL values & Perform Validation
    const printName = productPrintNameInput.value.trim();
    const unit = productUnitSelect.value || null;
    if (!printName || !unit) { alert("Print Name and Unit are required fields."); return; }

    const purchasePrice = parseNumericInput(productPurchasePriceInput.value);
    const salePrice = parseNumericInput(productSalePriceInput.value);
    const minSalePrice = parseNumericInput(productMinSalePriceInput.value);
    const mrp = parseNumericInput(productMrpInput.value);
    const openingStock = parseNumericInput(productOpeningStockInput.value, true);
    const gstRate = parseNumericInput(productGstRateInput.value);
    const saleDiscount = parseNumericInput(productSaleDiscountInput.value);

    // Validate numeric fields (check for NaN specifically)
    if (isNaN(purchasePrice) || isNaN(salePrice) || isNaN(minSalePrice) || isNaN(mrp) || isNaN(openingStock) || isNaN(gstRate) || isNaN(saleDiscount)) {
         alert("Please enter valid numbers (or leave blank) for prices, stock, GST rate, and discount. Invalid characters are not allowed.");
         return;
     }

    // Get other string/boolean values
    const group = productGroupInput.value.trim() || null;
    const brand = productBrandInput.value.trim() || null;
    const itemCode = productItemCodeInput.value.trim() || null;
    const hsnSacCode = productHsnSacCodeInput.value.trim() || null;
    const description = productDescriptionInput.value.trim() || null;
    const category = productCategoryInput.value.trim() || null;
    // Settings
    const settings_printDescription = settingPrintDescCheckbox.checked;
    const settings_oneClickSale = settingOneClickSaleCheckbox.checked;
    const settings_enableTracking = settingEnableTrackingCheckbox.checked;
    const settings_printSerialNo = settingPrintSerialCheckbox.checked;
    const settings_notForSale = settingNotForSaleCheckbox.checked;

    // Prepare data payload
    const productData = {
        printName, purchasePrice, salePrice, minSalePrice, mrp,
        group, brand, itemCode, unit, openingStock, hsnSacCode, gstRate,
        saleDiscount, description, category, // Include legacy category if needed
        settings_printDescription, settings_oneClickSale, settings_enableTracking,
        settings_printSerialNo, settings_notForSale,
        updatedAt: serverTimestamp() // Always update timestamp
    };

    // Remove null fields before saving (Optional: Firestore handles nulls, but reduces payload size)
    // Object.keys(productData).forEach(key => (productData[key] === null) && delete productData[key]);

    // Disable button and show spinner
    saveProductBtn.disabled = true;
    const originalButtonHTML = saveProductBtn.innerHTML;
    saveProductBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        if (isEditing) {
             console.log(`Updating product ${productId}...`);
             const productRef = doc(db, "products", productId);
             // Don't overwrite createdAt on update
             delete productData.createdAt; // Ensure createdAt is not in the update payload
             await updateDoc(productRef, productData);
             console.log("Product updated successfully:", productId);
             showToast("Product updated successfully!"); // Use a toast notification
        } else {
            console.log("Adding new product...");
            productData.createdAt = serverTimestamp(); // Add createdAt for new product
            const docRef = await addDoc(collection(db, "products"), productData);
            console.log("New product added with ID:", docRef.id);
            showToast("New product added successfully!"); // Use a toast notification
        }
        closeProductModal();
    } catch (error) {
        console.error("Error saving product:", error);
        alert(`Error saving product: ${error.message}`); // Show error alert
    } finally {
        // Re-enable button and restore original text
        saveProductBtn.disabled = false;
        saveProductBtn.innerHTML = originalButtonHTML;
    }
}

// --- Delete Handling (Triggered by Edit Modal Button) ---
function handleDeleteButtonClick(event) {
    event.preventDefault(); // Prevent potential form submission if type was submit
    if (!productToDeleteId || !productToDeleteName) {
        console.error("Product ID or Name for deletion is not set.");
        return;
    }
    console.log(`Delete button clicked for ${productToDeleteName} (${productToDeleteId}). Opening confirmation modal.`);

    // Populate warning message
    deleteWarningMessage.innerHTML = `Are you sure you want to delete the product "<strong>${escapeHtml(productToDeleteName)}</strong>"? <br>This action cannot be undone.`;

    // Reset confirmation state
    deleteConfirmCheckbox.checked = false;
    confirmDeleteFinalBtn.disabled = true;

    // Show confirmation modal
    deleteConfirmModal.classList.add('active');
}

// --- Delete Confirmation Modal Logic ---
function closeDeleteConfirmModal() {
    if (deleteConfirmModal) {
        deleteConfirmModal.classList.remove('active');
    }
}

function handleConfirmCheckboxChange() {
    if (deleteConfirmCheckbox && confirmDeleteFinalBtn) {
        confirmDeleteFinalBtn.disabled = !deleteConfirmCheckbox.checked;
    }
}

async function handleFinalDelete() {
    if (!deleteConfirmCheckbox.checked || !productToDeleteId) {
        console.error("Confirmation checkbox not checked or product ID missing.");
        return;
    }

    console.log(`Proceeding with deletion of product ID: ${productToDeleteId}`);
    confirmDeleteFinalBtn.disabled = true; // Disable button during deletion
    confirmDeleteFinalBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    try {
        // Call the actual delete function
        await performDelete(productToDeleteId);
        console.log(`Successfully deleted product: ${productToDeleteId}`);
        showToast(`Product "${productToDeleteName}" deleted successfully!`); // Use toast

        // Close both modals
        closeDeleteConfirmModal();
        closeProductModal();

    } catch (error) {
        console.error(`Error deleting product ${productToDeleteId}:`, error);
        alert(`Failed to delete product: ${error.message}`);
    } finally {
        // Reset button state regardless of success/failure
        confirmDeleteFinalBtn.disabled = false; // Re-enable in case of error, reset checkbox state handles final logic
        confirmDeleteFinalBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Confirm Delete';
        // Reset checkbox only after closing or on next open
    }
}

// --- Actual Firestore Delete Operation ---
// (Separated for clarity, previously part of handleDeleteProduct)
async function performDelete(firestoreId) {
    if (!db || !doc || !deleteDoc) {
        throw new Error("Firestore delete function is not available.");
    }
    if (!firestoreId) {
         throw new Error("No Product ID provided for deletion.");
    }
    console.log(`Attempting to delete document with ID: ${firestoreId}`);
    const productRef = doc(db, "products", firestoreId);
    await deleteDoc(productRef);
}


// --- Simple Toast Notification Function (Example) ---
// (You might want a more sophisticated library)
function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Basic styling (add this to your CSS)
    /*
    .toast-notification {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #333;
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        z-index: 1100;
        font-size: 0.9em;
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    .toast-notification.show {
        opacity: 1;
    }
    */
    // Trigger fade in
     setTimeout(() => toast.classList.add('show'), 10);
     // Set timeout to remove the toast
     setTimeout(() => {
         toast.classList.remove('show');
         // Remove from DOM after fade out
         setTimeout(() => {
             if (toast.parentNode) {
                 toast.parentNode.removeChild(toast);
             }
         }, 300); // Match transition duration
     }, duration);

     console.log("Toast:", message);
}

// --- Add CSS for Toast ---
// Ensure the following CSS is added to product_management.css or a common CSS file
const toastStyle = `
.toast-notification {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.8); /* Darker semi-transparent */
    color: white;
    padding: 12px 25px; /* More padding */
    border-radius: 25px; /* Pill shape */
    z-index: 1100; /* Ensure it's above modals if needed */
    font-size: 0.95em; /* Slightly larger font */
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
    opacity: 0;
    transition: opacity 0.4s ease, bottom 0.4s ease; /* Smooth transition */
    white-space: nowrap;
}
.toast-notification.show {
    opacity: 1;
    bottom: 30px; /* Move up slightly when shown */
}
`;
// Inject CSS into the head (simple way)
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = toastStyle;
document.head.appendChild(styleSheet);


// --- Final Log ---
console.log("product_management.js (V2.2 - Delete Confirmation Added) script loaded.");

// --- Initialize when DOM is ready (if not already called by auth listener) ---
// This ensures initialization happens even if auth state change is very fast
// document.addEventListener('DOMContentLoaded', () => {
//     if (typeof initializeProductManagement === 'function' && window.auth && window.auth.currentUser) {
//          console.log("DOM Ready, user logged in, initializing PM.");
//          initializeProductManagement();
//     } else if (typeof initializeProductManagement === 'function'){
//          console.log("DOM Ready, initializing PM (will wait for DB).");
//          // This might be called before the auth listener sets up the user,
//          // but initializeProductManagement now waits for the DB connection.
//          initializeProductManagement();
//     }
// });