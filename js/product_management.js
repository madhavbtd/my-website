// js/product_management.js

// --- Ensure Firestore functions are available globally ---
const { db, collection, onSnapshot, query, orderBy, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } = window;

// --- DOM Elements ---
const productTableBody = document.getElementById('productTableBody');
const loadingRow = document.getElementById('loadingMessage');
const sortSelect = document.getElementById('sort-products');
const filterSearchInput = document.getElementById('filterSearch');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const addNewProductBtn = document.getElementById('addNewProductBtn');

// Modal Elements
const productModal = document.getElementById('productModal');
const modalTitle = document.getElementById('modalTitle');
const productForm = document.getElementById('productForm');
const closeProductModalBtn = document.getElementById('closeProductModal');
const cancelProductBtn = document.getElementById('cancelProductBtn');
const saveProductBtn = document.getElementById('saveProductBtn');
const saveProductBtnText = saveProductBtn.querySelector('span');
const editProductIdInput = document.getElementById('editProductId'); // Hidden input for ID

// Modal Form Fields
const productPrintNameInput = document.getElementById('productPrintName');
const productPriceInput = document.getElementById('productPrice');
const productCategoryInput = document.getElementById('productCategory');
// >> NEW FIELD ELEMENTS <<
const productGroupInput = document.getElementById('productGroup');
const productUnitSelect = document.getElementById('productUnit');
// >> END NEW FIELD ELEMENTS <<


// --- Global State ---
let currentSortField = 'createdAt'; // Default sort
let currentSortDirection = 'desc';
let unsubscribeProducts = null; // Firestore listener cleanup
let allProductsCache = []; // Stores ALL products fetched from Firestore
let searchDebounceTimer;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DEBUG] Product Management DOM Loaded.");
    waitForDbConnection(() => {
        console.log("[DEBUG] DB connection confirmed. Initializing listener.");
        listenForProducts(); // Start listening

        // --- Event Listeners ---
        if (sortSelect) sortSelect.addEventListener('change', handleSortChange);
        if (filterSearchInput) filterSearchInput.addEventListener('input', handleSearchInput);
        if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
        if (addNewProductBtn) addNewProductBtn.addEventListener('click', openAddModal);

        // Modal Listeners
        if (closeProductModalBtn) closeProductModalBtn.addEventListener('click', closeProductModal);
        if (cancelProductBtn) cancelProductBtn.addEventListener('click', closeProductModal);
        if (productModal) productModal.addEventListener('click', (event) => {
            if (event.target === productModal) closeProductModal();
        });
        if (productForm) productForm.addEventListener('submit', handleSaveProduct);

        console.log("[DEBUG] Product Management event listeners set up.");
    });
});

// --- DB Connection Wait ---
function waitForDbConnection(callback) {
    if (window.db) { callback(); } else {
        let attempts = 0; const maxAttempts = 20;
        const intervalId = setInterval(() => {
            attempts++;
            if (window.db) { clearInterval(intervalId); callback(); }
            else if (attempts >= maxAttempts) { clearInterval(intervalId); console.error("DB timeout"); alert("DB Error"); }
        }, 250);
    }
}


// --- Sorting Change Handler ---
function handleSortChange() {
    if (!sortSelect) return;
    const selectedValue = sortSelect.value;
    const [field, direction] = selectedValue.split('_');
    if (field && direction) {
        if (field === currentSortField && direction === currentSortDirection) return;
        currentSortField = field;
        currentSortDirection = direction;
        console.log(`[DEBUG] Product sort changed: ${currentSortField} ${currentSortDirection}`);
        applyFiltersAndRender();
    }
}

// --- Filter Change Handlers ---
function handleSearchInput() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        console.log("[DEBUG] Product search processed.");
        applyFiltersAndRender();
    }, 300);
}

function clearFilters() {
    console.log("[DEBUG] Clearing product filters.");
    if(filterSearchInput) filterSearchInput.value = '';
    // Reset sort to default?
    if(sortSelect) sortSelect.value = 'createdAt_desc';
    currentSortField = 'createdAt';
    currentSortDirection = 'desc';
    applyFiltersAndRender();
}


// --- Firestore Listener Setup ---
function listenForProducts() {
    if (unsubscribeProducts) { unsubscribeProducts(); unsubscribeProducts = null; }
    if (!db || !collection || !query || !orderBy || !onSnapshot) { console.error("Firestore functions not available!"); /* Error handling */ return; }

    productTableBody.innerHTML = `<tr><td colspan="4" id="loadingMessage" style="text-align: center; color: #666;">Loading products...</td></tr>`; // Updated colspan

    try {
        console.log(`[DEBUG] Setting up Firestore listener for 'products'...`);
        const productsRef = collection(db, "products");
        const q = query(productsRef); // Fetch all, sort/filter client-side

        unsubscribeProducts = onSnapshot(q, (snapshot) => {
            console.log(`[DEBUG] Received ${snapshot.docs.length} total products from Firestore.`);
            allProductsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`[DEBUG] Stored ${allProductsCache.length} products.`);
            applyFiltersAndRender();

        }, (error) => { console.error("Error fetching products snapshot:", error); /* Error handling */ });
    } catch (error) { console.error("Error setting up product listener:", error); /* Error handling */ }
}


// --- Filter, Sort, and Render Function ---
function applyFiltersAndRender() {
    if (!allProductsCache) return;
    console.log("[DEBUG] Applying product filters and rendering...");

    // 1. Get filter values
    const filterSearchValue = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';

    // 2. Filter cached data
    let filteredProducts = allProductsCache.filter(product => {
        if (filterSearchValue) {
            // Search in printName and potentially category
            const name = (product.printName || '').toLowerCase();
            const category = (product.category || '').toLowerCase(); // Optional search in category

            if (!(name.includes(filterSearchValue) || category.includes(filterSearchValue))) {
                 return false; // Doesn't match search
            }
        }
        return true; // Passes filters
    });
    console.log(`[DEBUG] Filtered down to ${filteredProducts.length} products.`);

    // 3. Sort filtered data
    filteredProducts.sort((a, b) => {
        let valA = a[currentSortField];
        let valB = b[currentSortField];

        if (valA && typeof valA.toDate === 'function') valA = valA.toDate(); // Handle Timestamps
        if (valB && typeof valB.toDate === 'function') valB = valB.toDate();
        if (currentSortField === 'price') { // Handle Price as number
             valA = Number(valA) || 0;
             valB = Number(valB) || 0;
        }
        if (currentSortField === 'printName') { // Handle Name case-insensitively
            valA = (valA || '').toLowerCase();
            valB = (valB || '').toLowerCase();
        }

        let comparison = 0;
        if (valA > valB) comparison = 1;
        else if (valA < valB) comparison = -1;
        return currentSortDirection === 'desc' ? comparison * -1 : comparison;
    });
    console.log(`[DEBUG] Sorted ${filteredProducts.length} products.`);

    // 4. Render table
    productTableBody.innerHTML = '';
    if (filteredProducts.length === 0) {
        productTableBody.innerHTML = `<tr><td colspan="4" id="noProductsMessage" style="text-align: center; color: #666;">No products found matching filters.</td></tr>`; // Updated colspan
    } else {
        filteredProducts.forEach(product => {
            displayProductRow(product.id, product); // Render row
        });
    }
     console.log("[DEBUG] Product rendering complete.");
}


// --- Display Single Product Row ---
function displayProductRow(firestoreId, data) {
    const tableRow = document.createElement('tr');
    tableRow.setAttribute('data-id', firestoreId);

    const name = data.printName || 'N/A'; // Use printName field
    const price = data.price !== undefined && data.price !== null ? `₹ ${Number(data.price).toFixed(2)}` : '-'; // Format price
    const category = data.category || '-';

    // Updated table structure
    tableRow.innerHTML = `
        <td>${name}</td>
        <td>${price}</td>
        <td>${category}</td>
        <td>
            <button type="button" class="action-button edit-button" title="Edit Product">
                <i class="fas fa-edit"></i>
            </button>
            <button type="button" class="action-button delete-button" title="Delete Product">
                <i class="fas fa-trash-alt"></i>
            </button>
        </td>
    `;

    // Add event listeners for actions
    const editButton = tableRow.querySelector('.edit-button');
    if (editButton) editButton.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(firestoreId, data); });
    const deleteButton = tableRow.querySelector('.delete-button');
    if (deleteButton) deleteButton.addEventListener('click', (e) => { e.stopPropagation(); handleDeleteProduct(firestoreId, name); });

    productTableBody.appendChild(tableRow);
}


// --- Modal Handling (Add/Edit) ---
function openAddModal() {
    console.log("[DEBUG] Opening modal to add new product.");
    if (!productModal || !productForm) return;
    modalTitle.textContent = "Add New Product";
    editProductIdInput.value = ''; // Clear edit ID
    productForm.reset(); // Clear form fields
    if(saveProductBtnText) saveProductBtnText.textContent = 'Save Product';
    else if(saveProductBtn) saveProductBtn.innerHTML = '<i class="fas fa-save"></i> Save Product';
    saveProductBtn.disabled = false;
    productModal.classList.add('active');
}

function openEditModal(firestoreId, data) {
     console.log("[DEBUG] Opening modal to edit product:", firestoreId);
     if (!productModal || !productForm) return;
     modalTitle.textContent = "Edit Product";
     editProductIdInput.value = firestoreId; // Set ID for update logic
     if(saveProductBtnText) saveProductBtnText.textContent = 'Update Product';
     else if(saveProductBtn) saveProductBtn.innerHTML = '<i class="fas fa-save"></i> Update Product';
     saveProductBtn.disabled = false;

     // Fill form with existing data
     productPrintNameInput.value = data.printName || '';
     productPriceInput.value = data.price !== undefined ? data.price : ''; // Handle potential null/undefined price
     productCategoryInput.value = data.category || '';
     // >> FILL NEW FIELDS IF DATA EXISTS <<
     productGroupInput.value = data.productGroup || ''; // Fill group if present
     productUnitSelect.value = data.productUnit || '';   // Fill unit if present
     // >> END FILL NEW FIELDS <<

     productModal.classList.add('active');
}

function closeProductModal() {
     if (productModal) { productModal.classList.remove('active'); }
}

// --- Save/Update Product Handler ---
async function handleSaveProduct(event) {
    event.preventDefault();
    if (!db || !collection || !addDoc || !doc || !updateDoc || !serverTimestamp ) {
         alert("Database functions unavailable."); return;
    }

    const productId = editProductIdInput.value; // Firestore document ID
    const isEditing = !!productId;

    // Get data from form
    const printName = productPrintNameInput.value.trim();
    const priceString = productPriceInput.value.trim();
    const category = productCategoryInput.value.trim() || null;
    // >> GET NEW FIELD VALUES <<
    const productGroup = productGroupInput.value.trim() || null;
    const productUnit = productUnitSelect.value || null;
    // >> END GET NEW FIELD VALUES <<

    // Basic Validation
    if (!printName) {
        alert("Product Name (Print Name) is required.");
        return;
    }

    // Convert price to number, handle empty string as null
    let price = null;
    if (priceString !== '') {
        price = parseFloat(priceString);
        if (isNaN(price) || price < 0) {
             alert("Please enter a valid positive number for Price, or leave it empty.");
             return;
        }
    }


    // Prepare data payload
    const productData = {
        printName: printName, // Field used by new_order.js
        price: price,         // Store price as number or null
        category: category,
        // >> ADD NEW FIELDS TO PAYLOAD <<
        productGroup: productGroup,
        productUnit: productUnit,
        // >> END ADD NEW FIELDS <<
        updatedAt: serverTimestamp()
    };

    // Disable save button
    saveProductBtn.disabled = true;
    const originalButtonHTML = saveProductBtn.innerHTML;
    saveProductBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        if (isEditing) {
            // Update existing product
             console.log(`[DEBUG] Updating product ${productId}...`);
             const productRef = doc(db, "products", productId);
             await updateDoc(productRef, productData);
             console.log("[DEBUG] Product updated successfully.");
             alert("Product updated successfully!");
        } else {
            // Add new product
            console.log("[DEBUG] Adding new product...");
            productData.createdAt = serverTimestamp(); // Add createdAt for new products
            const docRef = await addDoc(collection(db, "products"), productData);
            console.log("[DEBUG] New product added with ID:", docRef.id);
            alert("New product added successfully!");
        }
        closeProductModal(); // Close modal on success
    } catch (error) {
        console.error("Error saving product:", error);
        alert(`Error saving product: ${error.message}`);
    } finally {
        // Re-enable button
        saveProductBtn.disabled = false;
        saveProductBtn.innerHTML = originalButtonHTML;
    }
}


// --- Delete Product Handler ---
async function handleDeleteProduct(firestoreId, productName) {
    console.log(`[DEBUG] handleDeleteProduct called for ID: ${firestoreId}, Name: ${productName}`);
    if (!db || !doc || !deleteDoc) { alert("Error: Delete function not available."); return; }

    // ** Consideration: Check if product is used in any existing orders before deleting? **
    if (confirm(`Are you sure you want to delete product "${productName}"? This might affect existing orders if the product name was used.`)) {
        console.log(`[DEBUG] User confirmed deletion for ${firestoreId}.`);
        try {
            const productRef = doc(db, "products", firestoreId);
            await deleteDoc(productRef);
            console.log(`[DEBUG] Product deleted successfully from Firestore: ${firestoreId}`);
            // UI updates via onSnapshot listener
        } catch (error) {
            console.error(`[DEBUG] Error deleting product ${firestoreId}:`, error);
            alert(`Failed to delete product: ${error.message}`);
        }
    } else {
        console.log("[DEBUG] Deletion cancelled by user.");
    }
}

// --- Final Log ---
console.log("product_management.js script fully loaded and initialized.");