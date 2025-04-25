// js/product_management.js (Version 2.5 - Added printName_lowercase for case-insensitive search)

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
const deleteProductBtn = document.getElementById('deleteProductBtn'); // Delete button in edit modal

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
let productToDeleteId = null;
let productToDeleteName = null;

// --- Helper Functions ---
function formatCurrency(amount) { /* ... unchanged ... */ const num = Number(amount); return isNaN(num) || num === null || num === undefined ? '-' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function escapeHtml(unsafe) { /* ... unchanged ... */ if (typeof unsafe !== 'string') { unsafe = String(unsafe || ''); } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function parseNumericInput(value, allowZero = true) { /* ... unchanged ... */ const trimmedValue = String(value).trim(); if (trimmedValue === '') return null; const num = parseFloat(trimmedValue); if (isNaN(num) || (!allowZero && num <= 0) || (allowZero && num < 0)) { return NaN; } return num; }

// --- Initialization ---
window.initializeProductManagement = () => {
    console.log("Product Management Initializing (V2.5)..."); // Version Bump
    waitForDbConnection(() => {
        console.log("DB connection confirmed. Initializing listener (V2.5).");
        listenForProducts();
        setupEventListeners();
        console.log("Product Management Initialized (V2.5).");
    });
};

// --- DB Connection Wait ---
function waitForDbConnection(callback) { /* ... unchanged ... */ if (window.db) { callback(); } else { let a = 0, m = 20, i = setInterval(() => { a++; if (window.db) { clearInterval(i); callback(); } else if (a >= m) { clearInterval(i); console.error("Database connection timed out."); alert("Error: Could not connect to the database. Please refresh the page."); } }, 250); } }

// --- Setup Event Listeners ---
function setupEventListeners() { /* ... unchanged ... */ if (sortSelect) sortSelect.addEventListener('change', handleSortChange); if (filterSearchInput) filterSearchInput.addEventListener('input', handleSearchInput); if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters); if (addNewProductBtn) addNewProductBtn.addEventListener('click', openAddModal); if (closeProductModalBtn) closeProductModalBtn.addEventListener('click', closeProductModal); if (cancelProductBtn) cancelProductBtn.addEventListener('click', closeProductModal); if (productModal) productModal.addEventListener('click', (event) => { if (event.target === productModal) closeProductModal(); }); if (productForm) productForm.addEventListener('submit', handleSaveProduct); if (deleteProductBtn) deleteProductBtn.addEventListener('click', handleDeleteButtonClick); if (closeDeleteConfirmModalBtn) closeDeleteConfirmModalBtn.addEventListener('click', closeDeleteConfirmModal); if (cancelDeleteFinalBtn) cancelDeleteFinalBtn.addEventListener('click', closeDeleteConfirmModal); if (deleteConfirmModal) deleteConfirmModal.addEventListener('click', (event) => { if (event.target === deleteConfirmModal) closeDeleteConfirmModal(); }); if (deleteConfirmCheckbox) deleteConfirmCheckbox.addEventListener('change', handleConfirmCheckboxChange); if (confirmDeleteFinalBtn) confirmDeleteFinalBtn.addEventListener('click', handleFinalDelete); console.log("Product Management V2.5 event listeners set up."); }

// --- Sorting & Filtering Handlers ---
function handleSortChange() { /* ... unchanged ... */ if (!sortSelect) return; const [field, direction] = sortSelect.value.split('_'); if (field && direction) { if (field === currentSortField && direction === currentSortDirection) return; currentSortField = field; currentSortDirection = direction; applyFiltersAndRender(); } }
function handleSearchInput() { /* ... unchanged ... */ clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(applyFiltersAndRender, 300); }
function clearFilters() { /* ... unchanged ... */ if(filterSearchInput) filterSearchInput.value = ''; if(sortSelect) sortSelect.value = 'createdAt_desc'; currentSortField = 'createdAt'; currentSortDirection = 'desc'; applyFiltersAndRender(); }

// --- Firestore Listener ---
function listenForProducts() { /* ... unchanged ... */ if (unsubscribeProducts) { unsubscribeProducts(); unsubscribeProducts = null; } if (!db || !collection || !query || !orderBy || !onSnapshot) { console.error("Firestore functions unavailable!"); return; } productTableBody.innerHTML = `<tr><td colspan="6" id="loadingMessage" style="text-align: center;">Loading products...</td></tr>`; try { console.log(`Setting up Firestore listener for 'products'...`); const productsRef = collection(db, "products"); const q = query(productsRef); unsubscribeProducts = onSnapshot(q, (snapshot) => { console.log(`Received ${snapshot.docs.length} products.`); allProductsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); applyFiltersAndRender(); }, (error) => { console.error("Error fetching products snapshot:", error); productTableBody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">Error loading products. Check connection.</td></tr>`; }); } catch (error) { console.error("Error setting up product listener:", error); productTableBody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">Error setting up listener.</td></tr>`; } }

// --- Filter, Sort, Render ---
function applyFiltersAndRender() { /* ... unchanged ... */ if (!allProductsCache) return; console.log("Applying product filters and rendering (V2.5)..."); const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : ''; let filteredProducts = allProductsCache.filter(product => { if (!product) return false; if (filterSearchValue) { const name = (product.printName || '').toLowerCase(); const itemCode = (product.itemCode || '').toLowerCase(); const hsn = (product.hsnSacCode || '').toLowerCase(); const brand = (product.brand || '').toLowerCase(); const group = (product.group || product.productGroup || '').toLowerCase(); if (!(name.includes(filterSearchValue) || itemCode.includes(filterSearchValue) || hsn.includes(filterSearchValue) || brand.includes(filterSearchValue) || group.includes(filterSearchValue))) { return false; } } return true; }); filteredProducts.sort((a, b) => { let valA = a[currentSortField]; let valB = b[currentSortField]; if (valA && typeof valA.toDate === 'function') valA = valA.toDate().getTime(); if (valB && typeof valB.toDate === 'function') valB = valB.toDate().getTime(); if (['salePrice', 'purchasePrice', 'gstRate', 'mrp', 'minSalePrice', 'openingStock', 'saleDiscount'].includes(currentSortField)) { valA = Number(valA) || 0; valB = Number(valB) || 0; } if (['printName', 'brand', 'itemCode', 'hsnSacCode', 'category', 'group', 'unit'].includes(currentSortField)) { valA = (valA || '').toLowerCase(); valB = (valB || '').toLowerCase(); } let comparison = 0; if (valA > valB) comparison = 1; else if (valA < valB) comparison = -1; return currentSortDirection === 'desc' ? (comparison * -1) : comparison; }); productTableBody.innerHTML = ''; if (filteredProducts.length === 0) { productTableBody.innerHTML = `<tr><td colspan="6" id="noProductsMessage" style="text-align: center;">No products found matching your criteria.</td></tr>`; } else { filteredProducts.forEach(product => displayProductRow(product.id, product)); } console.log("Product rendering complete (V2.5)."); }

// --- Display Table Row (with Row Click) ---
function displayProductRow(firestoreId, data) { /* ... unchanged ... */ if (!productTableBody || !data) return; const tableRow = productTableBody.insertRow(); tableRow.setAttribute('data-id', firestoreId); tableRow.classList.add('clickable-row'); const name = data.printName || 'N/A'; const salePrice = formatCurrency(data.salePrice); const purchasePrice = formatCurrency(data.purchasePrice); const unit = data.unit || data.productUnit || '-'; const hsn = data.hsnSacCode || '-'; const gst = (data.gstRate !== null && data.gstRate !== undefined) ? `${data.gstRate}%` : '-'; const cellName = tableRow.insertCell(); cellName.textContent = escapeHtml(name); const cellSale = tableRow.insertCell(); cellSale.textContent = salePrice; cellSale.style.textAlign = 'right'; const cellPurchase = tableRow.insertCell(); cellPurchase.textContent = purchasePrice; cellPurchase.style.textAlign = 'right'; const cellUnit = tableRow.insertCell(); cellUnit.textContent = escapeHtml(unit); cellUnit.style.textAlign = 'center'; const cellHsn = tableRow.insertCell(); cellHsn.textContent = escapeHtml(hsn); const cellGst = tableRow.insertCell(); cellGst.textContent = gst; cellGst.style.textAlign = 'right'; tableRow.addEventListener('click', () => { console.log(`Row clicked, opening edit modal for: ${firestoreId}`); openEditModal(firestoreId, data); }); }


// --- Modal Handling ---
function openAddModal() { /* ... unchanged ... */ console.log("Opening modal to add new product (V2.5)."); if (!productModal || !productForm) return; modalTitle.innerHTML = '<i class="fas fa-plus-circle success-icon"></i> Add New Product'; editProductIdInput.value = ''; productForm.reset(); settingPrintDescCheckbox.checked = false; settingOneClickSaleCheckbox.checked = false; settingEnableTrackingCheckbox.checked = false; settingPrintSerialCheckbox.checked = false; settingNotForSaleCheckbox.checked = false; if(saveProductBtnSpan) saveProductBtnSpan.textContent = 'Save Product'; else if(saveProductBtn) saveProductBtn.innerHTML = '<i class="fas fa-save"></i> Save Product'; saveProductBtn.disabled = false; deleteProductBtn.style.display = 'none'; productModal.classList.add('active'); }
function openEditModal(firestoreId, data) { /* ... unchanged ... */ console.log("Opening modal to edit product (V2.5):", firestoreId); if (!productModal || !productForm || !data) return; modalTitle.innerHTML = '<i class="fas fa-edit info-icon"></i> Edit Product'; editProductIdInput.value = firestoreId; if(saveProductBtnSpan) saveProductBtnSpan.textContent = 'Update Product'; else if(saveProductBtn) saveProductBtn.innerHTML = '<i class="fas fa-save"></i> Update Product'; saveProductBtn.disabled = false; productPrintNameInput.value = data.printName || ''; productPurchasePriceInput.value = data.purchasePrice ?? ''; productSalePriceInput.value = data.salePrice ?? ''; productMinSalePriceInput.value = data.minSalePrice ?? ''; productMrpInput.value = data.mrp ?? ''; productGroupInput.value = data.group || data.productGroup || ''; productBrandInput.value = data.brand || ''; productItemCodeInput.value = data.itemCode || ''; productUnitSelect.value = data.unit || data.productUnit || ''; productOpeningStockInput.value = data.openingStock ?? ''; productHsnSacCodeInput.value = data.hsnSacCode || ''; productGstRateInput.value = data.gstRate ?? ''; productSaleDiscountInput.value = data.saleDiscount ?? ''; productDescriptionInput.value = data.description || ''; settingPrintDescCheckbox.checked = data.settings_printDescription || false; settingOneClickSaleCheckbox.checked = data.settings_oneClickSale || false; settingEnableTrackingCheckbox.checked = data.settings_enableTracking || false; settingPrintSerialCheckbox.checked = data.settings_printSerialNo || false; settingNotForSaleCheckbox.checked = data.settings_notForSale || false; productCategoryInput.value = data.category || ''; deleteProductBtn.style.display = 'inline-flex'; productToDeleteId = firestoreId; productToDeleteName = data.printName || 'this product'; productModal.classList.add('active'); }
function closeProductModal() { /* ... unchanged ... */ if (productModal) { productModal.classList.remove('active'); productToDeleteId = null; productToDeleteName = null; } }

// --- Save/Update Handler (V2.5 - Added lowercase field) ---
async function handleSaveProduct(event) {
    event.preventDefault();
    if (!db || !collection || !addDoc || !doc || !updateDoc || !serverTimestamp ) {
         alert("Database functions are unavailable. Cannot save.");
         return;
    }
    const productId = editProductIdInput.value;
    const isEditing = !!productId;

    // --- Validation ---
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

    if ([purchasePrice, salePrice, minSalePrice, mrp, openingStock, gstRate, saleDiscount].some(isNaN)) {
         alert("Please enter valid numbers (or leave blank) for prices, stock, GST rate, and discount. Invalid characters are not allowed.");
         return;
    }
    // --- End Validation ---

    const group = productGroupInput.value.trim() || null;
    const brand = productBrandInput.value.trim() || null;
    const itemCode = productItemCodeInput.value.trim() || null;
    const hsnSacCode = productHsnSacCodeInput.value.trim() || null;
    const description = productDescriptionInput.value.trim() || null;
    const category = productCategoryInput.value.trim() || null;
    const settings_printDescription = settingPrintDescCheckbox.checked;
    const settings_oneClickSale = settingOneClickSaleCheckbox.checked;
    const settings_enableTracking = settingEnableTrackingCheckbox.checked;
    const settings_printSerialNo = settingPrintSerialCheckbox.checked;
    const settings_notForSale = settingNotForSaleCheckbox.checked;

    // *** CHANGE: Create productData object and add lowercase name ***
    const productData = {
        printName,
        printName_lowercase: printName.toLowerCase(), // <<<--- ADDED lowercase field
        purchasePrice, salePrice, minSalePrice, mrp,
        group, brand, itemCode, unit,
        openingStock, hsnSacCode, gstRate, saleDiscount, description, category,
        settings_printDescription, settings_oneClickSale, settings_enableTracking,
        settings_printSerialNo, settings_notForSale,
        updatedAt: serverTimestamp()
    };
    // *** END CHANGE ***

    // Disable button, show spinner
    saveProductBtn.disabled = true;
    const originalButtonHTML = saveProductBtn.innerHTML;
    saveProductBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        if (isEditing) {
             console.log(`Updating product ${productId}...`);
             const productRef = doc(db, "products", productId);
             delete productData.createdAt; // Ensure createdAt is not overwritten
             // Update logic automatically includes printName_lowercase if present in productData
             await updateDoc(productRef, productData);
             console.log("Product updated successfully:", productId);
             showToast("Product updated successfully!");
        } else {
            console.log("Adding new product...");
            productData.createdAt = serverTimestamp(); // Add createdAt timestamp for new docs
             // Add logic automatically includes printName_lowercase if present in productData
            const docRef = await addDoc(collection(db, "products"), productData);
            console.log("New product added with ID:", docRef.id);
            showToast("New product added successfully!");
        }
        closeProductModal(); // Close modal on success
    } catch (error) {
        console.error("Error saving product:", error);
        alert(`Error saving product: ${error.message}`); // Display error to user
    } finally {
        // Restore button state
        saveProductBtn.disabled = false;
        saveProductBtn.innerHTML = originalButtonHTML;
    }
}

// --- Delete Handling ---
function handleDeleteButtonClick(event) { /* ... unchanged ... */ event.preventDefault(); if (!productToDeleteId || !productToDeleteName) { console.error("Product ID or Name for deletion is not set."); return; } console.log(`Delete button clicked for ${productToDeleteName} (${productToDeleteId}). Opening confirmation modal.`); deleteWarningMessage.innerHTML = `Are you sure you want to delete the product "<strong>${escapeHtml(productToDeleteName)}</strong>"? <br>This action cannot be undone.`; deleteConfirmCheckbox.checked = false; confirmDeleteFinalBtn.disabled = true; deleteConfirmModal.classList.add('active'); }
function closeDeleteConfirmModal() { /* ... unchanged ... */ if (deleteConfirmModal) { deleteConfirmModal.classList.remove('active'); } }
function handleConfirmCheckboxChange() { /* ... unchanged ... */ if (deleteConfirmCheckbox && confirmDeleteFinalBtn) { confirmDeleteFinalBtn.disabled = !deleteConfirmCheckbox.checked; } }
async function handleFinalDelete() { /* ... unchanged ... */ if (!deleteConfirmCheckbox.checked || !productToDeleteId) { console.error("Confirmation checkbox not checked or product ID missing."); return; } console.log(`Proceeding with deletion of product ID: ${productToDeleteId}`); confirmDeleteFinalBtn.disabled = true; confirmDeleteFinalBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...'; try { await performDelete(productToDeleteId); console.log(`Successfully deleted product: ${productToDeleteId}`); showToast(`Product "${productToDeleteName}" deleted successfully!`); closeDeleteConfirmModal(); closeProductModal(); } catch (error) { console.error(`Error deleting product ${productToDeleteId}:`, error); alert(`Failed to delete product: ${error.message}`); } finally { confirmDeleteFinalBtn.disabled = !deleteConfirmCheckbox.checked; confirmDeleteFinalBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Confirm Delete'; } }
async function performDelete(firestoreId) { /* ... unchanged ... */ if (!db || !doc || !deleteDoc) { throw new Error("Firestore delete function is not available."); } if (!firestoreId) { throw new Error("No Product ID provided for deletion."); } console.log(`Attempting to delete document with ID: ${firestoreId}`); const productRef = doc(db, "products", firestoreId); await deleteDoc(productRef); }

// --- Simple Toast Notification Function ---
function showToast(message, duration = 3000) { /* ... unchanged ... */ const existingToast = document.querySelector('.toast-notification'); if (existingToast) { existingToast.remove(); } const toast = document.createElement('div'); toast.className = 'toast-notification'; toast.textContent = message; document.body.appendChild(toast); setTimeout(() => toast.classList.add('show'), 10); setTimeout(() => { toast.classList.remove('show'); setTimeout(() => { if (toast.parentNode) { toast.parentNode.removeChild(toast); } }, 400); }, duration); console.log("Toast:", message); }

// --- Add CSS for Toast (Injecting into head) ---
const toastStyle = `... unchanged ...`;
if (!document.getElementById('toast-styles')) { /* ... unchanged ... */ const styleSheet = document.createElement("style"); styleSheet.id = 'toast-styles'; styleSheet.type = "text/css"; styleSheet.innerText = toastStyle; document.head.appendChild(styleSheet); }

// --- Final Log ---
console.log("product_management.js (V2.5 - Added lowercase field) script loaded."); // Version Bump