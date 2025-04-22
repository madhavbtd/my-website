// js/product_management.js (Version 2.0 - Added multiple fields)

// --- Firebase Functions ---
// Ensure all needed functions are available globally from HTML script block
const { db, collection, onSnapshot, query, orderBy, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } = window;

// --- DOM Elements ---
const productTableBody = document.getElementById('productTableBody');
const loadingRow = document.getElementById('loadingMessage');
const sortSelect = document.getElementById('sort-products');
const filterSearchInput = document.getElementById('filterSearch');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const addNewProductBtn = document.getElementById('addNewProductBtn');

// --- Modal Elements ---
const productModal = document.getElementById('productModal');
const modalTitle = document.getElementById('modalTitle');
const productForm = document.getElementById('productForm');
const closeProductModalBtn = document.getElementById('closeProductModal');
const cancelProductBtn = document.getElementById('cancelProductBtn');
const saveProductBtn = document.getElementById('saveProductBtn');
const saveProductBtnSpan = saveProductBtn ? saveProductBtn.querySelector('span') : null;
const editProductIdInput = document.getElementById('editProductId');

// --- >>> ALL NEW Modal Form Field References <<< ---
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
// --- >>> End New References <<< ---


// --- Global State ---
let currentSortField = 'createdAt';
let currentSortDirection = 'desc';
let unsubscribeProducts = null;
let allProductsCache = [];
let searchDebounceTimer;

// --- Helper Functions ---
function formatCurrency(amount) {
    const num = Number(amount);
    // Return empty string or '-' if not a valid number or zero, else format
    return isNaN(num) || num === null || num === undefined ? '-' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { unsafe = String(unsafe || ''); } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
// Helper to parse numeric input, returns null if empty or invalid
function parseNumericInput(value, allowZero = true) {
    const trimmedValue = String(value).trim();
    if (trimmedValue === '') return null; // Treat empty string as null
    const num = parseFloat(trimmedValue);
    if (isNaN(num) || (!allowZero && num < 0) || (allowZero && num < 0) ) { // Only allow >= 0 or null
        return NaN; // Indicate invalid number
    }
    return num;
}


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Product Management DOM Loaded (V2.0).");
    waitForDbConnection(() => {
        console.log("DB connection confirmed. Initializing listener (V2.0).");
        listenForProducts(); // Start listening
        setupEventListeners(); // Setup all listeners
    });
});

// --- DB Connection Wait ---
function waitForDbConnection(callback) { if (window.db) { callback(); } else { let a = 0, m = 20, i = setInterval(() => { a++; if (window.db) { clearInterval(i); callback(); } else if (a >= m) { clearInterval(i); console.error("DB timeout"); alert("DB Error"); } }, 250); } }

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
    console.log("Product Management V2.0 event listeners set up.");
}

// --- Sorting & Filtering Handlers ---
function handleSortChange() { if (!sortSelect) return; const [field, direction] = sortSelect.value.split('_'); if (field && direction) { if (field === currentSortField && direction === currentSortDirection) return; currentSortField = field; currentSortDirection = direction; console.log(`Product sort: ${currentSortField} ${currentSortDirection}`); applyFiltersAndRender(); } }
function handleSearchInput() { clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(applyFiltersAndRender, 300); }
function clearFilters() { console.log("Clearing product filters."); if(filterSearchInput) filterSearchInput.value = ''; if(sortSelect) sortSelect.value = 'createdAt_desc'; currentSortField = 'createdAt'; currentSortDirection = 'desc'; applyFiltersAndRender(); }

// --- Firestore Listener ---
function listenForProducts() {
    if (unsubscribeProducts) { unsubscribeProducts(); unsubscribeProducts = null; }
    if (!db || !collection || !query || !orderBy || !onSnapshot) { console.error("Firestore functions unavailable!"); return; }
    productTableBody.innerHTML = `<tr><td colspan="7" id="loadingMessage" style="text-align: center;">Loading products...</td></tr>`; // Colspan 7
    try {
        console.log(`Setting up Firestore listener 'products'...`);
        const productsRef = collection(db, "products");
        const q = query(productsRef); // Fetch all initially
        unsubscribeProducts = onSnapshot(q, (snapshot) => {
            console.log(`Received ${snapshot.docs.length} products.`);
            allProductsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            applyFiltersAndRender();
        }, (error) => { console.error("Error fetching products snapshot:", error); productTableBody.innerHTML = `<tr><td colspan="7" style="color: red;">Error loading products.</td></tr>`; });
    } catch (error) { console.error("Error setting up product listener:", error); productTableBody.innerHTML = `<tr><td colspan="7" style="color: red;">Error setting up listener.</td></tr>`; }
}

// --- Filter, Sort, Render ---
function applyFiltersAndRender() {
    if (!allProductsCache) return;
    console.log("Applying product filters and rendering (V2.0)...");
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';
    let filteredProducts = allProductsCache.filter(product => {
        if (filterSearchValue) {
            const name = (product.printName || '').toLowerCase();
            const itemCode = (product.itemCode || '').toLowerCase();
            const hsn = (product.hsnSacCode || '').toLowerCase();
            const brand = (product.brand || '').toLowerCase();
            const group = (product.group || product.productGroup || '').toLowerCase(); // Check both names
            if (!(name.includes(filterSearchValue) || itemCode.includes(filterSearchValue) || hsn.includes(filterSearchValue) || brand.includes(filterSearchValue) || group.includes(filterSearchValue))) { return false; }
        }
        return true;
    });
    console.log(`Filtered to ${filteredProducts.length} products.`);
    // Sorting
    filteredProducts.sort((a, b) => {
        let valA = a[currentSortField]; let valB = b[currentSortField];
        if (valA && typeof valA.toDate === 'function') valA = valA.toDate().getTime();
        if (valB && typeof valB.toDate === 'function') valB = valB.toDate().getTime();
        if (['salePrice', 'purchasePrice', 'gstRate', 'mrp', 'minSalePrice', 'openingStock', 'saleDiscount'].includes(currentSortField)) { valA = Number(valA) || 0; valB = Number(valB) || 0; }
        if (['printName', 'brand', 'itemCode', 'hsnSacCode', 'category', 'group', 'unit'].includes(currentSortField)) { valA = (valA || '').toLowerCase(); valB = (valB || '').toLowerCase(); }
        let comparison = 0; if (valA > valB) comparison = 1; else if (valA < valB) comparison = -1;
        return currentSortDirection === 'desc' ? comparison * -1 : comparison;
    });
    console.log(`Sorted ${filteredProducts.length} products.`);
    // Render
    productTableBody.innerHTML = '';
    if (filteredProducts.length === 0) { productTableBody.innerHTML = `<tr><td colspan="7" id="noProductsMessage" style="text-align: center;">No products found.</td></tr>`; } // Colspan 7
    else { filteredProducts.forEach(product => displayProductRow(product.id, product)); }
     console.log("Product rendering complete (V2.0).");
}

// --- Display Row (Updated Columns V2.0) ---
function displayProductRow(firestoreId, data) {
    if (!productTableBody || !data) return;
    const tableRow = productTableBody.insertRow(); // Use insertRow
    tableRow.setAttribute('data-id', firestoreId);

    const name = data.printName || 'N/A';
    const salePrice = formatCurrency(data.salePrice); // Use new salePrice field
    const purchasePrice = formatCurrency(data.purchasePrice);
    const unit = data.unit || data.productUnit || '-';
    const hsn = data.hsnSacCode || '-';
    const gst = (data.gstRate !== null && data.gstRate !== undefined) ? `${data.gstRate}%` : '-';

    // Create Cells
    const cellName = tableRow.insertCell(); cellName.textContent = escapeHtml(name);
    const cellSale = tableRow.insertCell(); cellSale.textContent = salePrice; cellSale.style.textAlign = 'right';
    const cellPurchase = tableRow.insertCell(); cellPurchase.textContent = purchasePrice; cellPurchase.style.textAlign = 'right';
    const cellUnit = tableRow.insertCell(); cellUnit.textContent = escapeHtml(unit);
    const cellHsn = tableRow.insertCell(); cellHsn.textContent = escapeHtml(hsn);
    const cellGst = tableRow.insertCell(); cellGst.textContent = gst; cellGst.style.textAlign = 'right';
    const cellActions = tableRow.insertCell(); cellActions.style.textAlign = 'center';

    // Action Buttons
    const editButton = document.createElement('button');
    editButton.type = 'button'; editButton.className = 'action-button edit-button'; editButton.title = 'Edit Product';
    editButton.innerHTML = '<i class="fas fa-edit"></i>';
    editButton.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(firestoreId, data); });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button'; deleteButton.className = 'action-button delete-button'; deleteButton.title = 'Delete Product';
    deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteButton.addEventListener('click', (e) => { e.stopPropagation(); handleDeleteProduct(firestoreId, name); });

    cellActions.append(editButton, deleteButton);
}


// --- Modal Handling ---
function openAddModal() {
    console.log("Opening modal to add new product (V2.0).");
    if (!productModal || !productForm) return;
    modalTitle.innerHTML = '<i class="fas fa-plus-circle success-icon"></i> Add New Product'; // Added Icon
    editProductIdInput.value = '';
    productForm.reset();
    // Reset checkbox states manually if form.reset() doesn't
    settingPrintDescCheckbox.checked = false;
    settingOneClickSaleCheckbox.checked = false;
    settingEnableTrackingCheckbox.checked = false;
    settingPrintSerialCheckbox.checked = false;
    settingNotForSaleCheckbox.checked = false;

    if(saveProductBtnSpan) saveProductBtnSpan.textContent = 'Save Product';
    else if(saveProductBtn) saveProductBtn.innerHTML = '<i class="fas fa-save"></i> Save Product';
    saveProductBtn.disabled = false;
    productModal.classList.add('active');
}

function openEditModal(firestoreId, data) {
     console.log("Opening modal to edit product (V2.0):", firestoreId);
     if (!productModal || !productForm) return;
     modalTitle.innerHTML = '<i class="fas fa-edit info-icon"></i> Edit Product'; // Added Icon
     editProductIdInput.value = firestoreId;
     if(saveProductBtnSpan) saveProductBtnSpan.textContent = 'Update Product';
     else if(saveProductBtn) saveProductBtn.innerHTML = '<i class="fas fa-save"></i> Update Product';
     saveProductBtn.disabled = false;

     // --- Populate ALL form fields ---
     productPrintNameInput.value = data.printName || '';
     productPurchasePriceInput.value = data.purchasePrice ?? '';
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

     productModal.classList.add('active');
}

function closeProductModal() { if (productModal) { productModal.classList.remove('active'); } }

// --- Save/Update Handler (V2.0 - All Fields) ---
async function handleSaveProduct(event) {
    event.preventDefault();
    if (!db || !collection || !addDoc || !doc || !updateDoc || !serverTimestamp ) { alert("DB functions unavailable."); return; }

    const productId = editProductIdInput.value;
    const isEditing = !!productId;

    // Get ALL values
    const printName = productPrintNameInput.value.trim();
    const unit = productUnitSelect.value || null;
    if (!printName || !unit) { alert("Print Name and Unit are required."); return; }

    const purchasePrice = parseNumericInput(productPurchasePriceInput.value);
    const salePrice = parseNumericInput(productSalePriceInput.value);
    const minSalePrice = parseNumericInput(productMinSalePriceInput.value);
    const mrp = parseNumericInput(productMrpInput.value);
    const openingStock = parseNumericInput(productOpeningStockInput.value, true); // Allow 0 stock
    const gstRate = parseNumericInput(productGstRateInput.value);
    const saleDiscount = parseNumericInput(productSaleDiscountInput.value);

    // Validate numeric fields
    if (isNaN(purchasePrice) || isNaN(salePrice) || isNaN(minSalePrice) || isNaN(mrp) || isNaN(openingStock) || isNaN(gstRate) || isNaN(saleDiscount)) {
         alert("Please enter valid numbers (or leave blank) for prices, stock, GST rate, and discount.");
         return;
     }

    const group = productGroupInput.value.trim() || null;
    const brand = productBrandInput.value.trim() || null;
    const itemCode = productItemCodeInput.value.trim() || null;
    const hsnSacCode = productHsnSacCodeInput.value.trim() || null;
    const description = productDescriptionInput.value.trim() || null;
    const category = productCategoryInput.value.trim() || null; // Still saving legacy category
    // Settings
    const settings_printDescription = settingPrintDescCheckbox.checked;
    const settings_oneClickSale = settingOneClickSaleCheckbox.checked;
    const settings_enableTracking = settingEnableTrackingCheckbox.checked;
    const settings_printSerialNo = settingPrintSerialCheckbox.checked;
    const settings_notForSale = settingNotForSaleCheckbox.checked;

    // Prepare data payload
    const productData = {
        printName, purchasePrice, salePrice, minSalePrice, mrp,
        group, // Renamed? Using 'group' now
        brand, itemCode, unit, openingStock, hsnSacCode, gstRate,
        saleDiscount, description, category,
        settings_printDescription, settings_oneClickSale, settings_enableTracking,
        settings_printSerialNo, settings_notForSale,
        updatedAt: serverTimestamp()
    };

    // Remove null fields before saving (optional, depends on preference/rules)
    // Object.keys(productData).forEach(key => (productData[key] === null) && delete productData[key]);

    // Disable button
    saveProductBtn.disabled = true; const originalButtonHTML = saveProductBtn.innerHTML;
    saveProductBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        if (isEditing) {
             console.log(`Updating product ${productId}...`);
             const productRef = doc(db, "products", productId);
             delete productData.createdAt; // Don't overwrite createdAt on update
             await updateDoc(productRef, productData);
             console.log("Product updated."); alert("Product updated!");
        } else {
            console.log("Adding new product...");
            productData.createdAt = serverTimestamp(); // Add createdAt
            const docRef = await addDoc(collection(db, "products"), productData);
            console.log("New product added:", docRef.id); alert("New product added!");
        }
        closeProductModal();
    } catch (error) { console.error("Error saving product:", error); alert(`Error: ${error.message}`);
    } finally { saveProductBtn.disabled = false; saveProductBtn.innerHTML = originalButtonHTML; }
}

// --- Delete Handler ---
async function handleDeleteProduct(firestoreId, productName) { /* ... (V2.0 जैसा) ... */ if(!db||!doc||!deleteDoc){alert("Delete unavailable.");return;}if(confirm(`Delete product "${productName}"?`)){console.log(`Deleting: ${firestoreId}`);try{await deleteDoc(doc(db,"products",firestoreId));console.log(`Deleted: ${firestoreId}`);}catch(error){console.error(`Error deleting ${firestoreId}:`,error);alert(`Failed to delete: ${error.message}`);}}else{console.log("Deletion cancelled.");} }

// --- Final Log ---
console.log("product_management.js (V2.0) script loaded.");