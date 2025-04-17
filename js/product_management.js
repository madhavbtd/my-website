// js/product_management.js

// Firebase फ़ंक्शंस HTML से ग्लोबल स्कोप में उपलब्ध हैं
// इसलिए यहाँ दोबारा इम्पोर्ट या इनिशियलाइज़ करने की आवश्यकता नहीं है।
// const { db, collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, getDocs } = window;
// ऊपर वाली लाइन सिर्फ यह बताने के लिए है कि हम window ऑब्जेक्ट से इन्हें इस्तेमाल कर रहे हैं।

// --- DOM एलिमेंट रेफरेंस ---
const addProductForm = document.getElementById('addProductForm');
const productListTableBody = document.querySelector('#productListTable tbody');
const searchInput = document.getElementById('search');
const filterButton = document.getElementById('filterBtn');
const addProductModal = document.getElementById('addProductModal'); // Modal का रेफरेंस
const modalOverlay = document.getElementById('modalOverlay'); // Overlay का रेफरेंस

// --- ग्लोबल वेरिएबल्स ---
let allProducts = []; // सभी प्रोडक्ट्स को स्टोर करने के लिए (onSnapshot अपडेट करेगा)


// --- Modal दिखाने/छिपाने के फंक्शन ---
// (ये फंक्शन अब HTML के onclick से कॉल होंगे)

window.showAddProductForm = function(isEdit = false, productData = null) {
    const modalTitle = addProductModal.querySelector('.modal-header h2');
    const saveButton = addProductModal.querySelector('#saveProductBtn');
    const editIdInput = addProductForm.editProductId;

    if (!isEdit) {
        addProductForm.reset(); // फॉर्म रीसेट करें
        modalTitle.textContent = 'Add New Product';
        saveButton.textContent = 'Save Product';
        editIdInput.value = ''; // एडिट ID खाली करें
        const descriptionCount = document.getElementById('descriptionCount');
        if (descriptionCount) descriptionCount.textContent = '0 / 250'; // काउंटर रीसेट
    } else {
        // एडिट मोड में टाइटल और बटन बदलें (फॉर्म भरना loadProductForEdit में होगा)
        modalTitle.textContent = 'Edit Product';
        saveButton.textContent = 'Update Product';
        // editIdInput.value को loadProductForEdit में सेट किया जाएगा
    }
    addProductModal.style.display = 'flex';
    modalOverlay.style.display = 'block';
};

window.hideAddProductForm = function() {
    addProductModal.style.display = 'none';
    modalOverlay.style.display = 'none';
    addProductForm.reset(); // बंद होने पर हमेशा रीसेट करें
    addProductForm.editProductId.value = ''; // एडिट ID खाली करें
    const descriptionCount = document.getElementById('descriptionCount');
    if(descriptionCount) descriptionCount.textContent = '0 / 250'; // काउंटर रीसेट
};


// --- Firestore से रियल-टाइम डेटा सुनना और टेबल अपडेट करना ---
try {
    const productsCollectionRef = window.collection(window.db, "products"); // 'products' कलेक्शन का नाम
    window.onSnapshot(productsCollectionRef, (querySnapshot) => {
        console.log("Snapshot received");
        allProducts = []; // लिस्ट क्लियर करें
        let serialNumber = 1;
        querySnapshot.forEach((doc) => {
            allProducts.push({ id: doc.id, ...doc.data(), serialNumber: serialNumber++ });
        });
        console.log("Products fetched/updated:", allProducts);
        displayProductsInTable(allProducts); // फिल्टर की गई लिस्ट दिखाएँ
    }, (error) => {
        console.error("Error listening to product updates: ", error);
        alert("Could not fetch products in real-time.");
    });
} catch(e) {
    console.error("Error setting up Firestore listener: ", e);
    alert("Error connecting to database. Please check console.");
}


// --- टेबल में प्रोडक्ट्स दिखाने का फंक्शन ---
function displayProductsInTable(productsToDisplay) {
    if (!productListTableBody) {
        console.error("Table body not found!");
        return;
    }
    productListTableBody.innerHTML = ''; // टेबल बॉडी खाली करें

    if (productsToDisplay.length === 0) {
        productListTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No products found.</td></tr>';
        return;
    }

    productsToDisplay.forEach(product => {
        const row = productListTableBody.insertRow();
        row.innerHTML = `
            <td>${product.serialNumber}</td>
            <td>${product.productName || '-'}</td>
            <td>${product.printName || '-'}</td>
            <td>${(product.purchasePrice || 0).toFixed(2)}</td>
            <td>${(product.salePrice || 0).toFixed(2)}</td>
            <td>${product.unit || '-'}</td>
            <td>${product.currentStock !== undefined ? product.currentStock : (product.openingStock !== undefined ? product.openingStock : 0)}</td>
            <td class="actions">
                <button class="action-btn edit-btn" data-id="${product.id}" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete-btn" data-id="${product.id}" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        `;
        // Edit/Delete बटन के लिए इवेंट लिसनर जोड़ें
         const editBtn = row.querySelector('.edit-btn');
         if(editBtn) {
            editBtn.addEventListener('click', () => loadProductForEdit(product.id));
         }
         const deleteBtn = row.querySelector('.delete-btn');
          if(deleteBtn) {
             deleteBtn.addEventListener('click', () => deleteProduct(product.id, product.productName));
          }
    });
    addActionButtonStyles(); // बटन स्टाइलिंग
}


// --- एडिट के लिए प्रोडक्ट डेटा फॉर्म में लोड करना ---
function loadProductForEdit(id) {
    const product = allProducts.find(p => p.id === id);
    if (!product) {
        console.error("Product not found for editing:", id);
        return;
    }

    console.log("Loading product for edit:", product);

    // फॉर्म फ़ील्ड्स भरें
    addProductForm.editProductId.value = product.id; // हिडन ID सेट करें
    addProductForm.productName.value = product.productName || '';
    addProductForm.printName.value = product.printName || '';
    addProductForm.purchasePrice.value = product.purchasePrice || 0;
    addProductForm.salePrice.value = product.salePrice || 0;
    addProductForm.minSalePrice.value = product.minSalePrice || '';
    addProductForm.mrp.value = product.mrp || '';
    addProductForm.unit.value = product.unit || 'NOS';
    addProductForm.openingStock.value = product.openingStock || 0;
    addProductForm.saleDiscount.value = product.saleDiscount || '';
    addProductForm.lowLevelLimit.value = product.lowLevelLimit || '';
    addProductForm.productDescription.value = product.productDescription || '';

    // डिस्क्रिप्शन काउंटर अपडेट करें
    const descriptionCount = document.getElementById('descriptionCount');
    if(descriptionCount) {
        const currentLength = addProductForm.productDescription.value.length;
        descriptionCount.textContent = currentLength + ' / 250';
    }

    // चेकबॉक्स सेट करें
    addProductForm.printDescription.checked = product.printDescription || false;
    addProductForm.printSerialNo.checked = product.printSerialNo || false;
    addProductForm.oneClickSale.checked = product.oneClickSale || false;
    addProductForm.notForSale.checked = product.notForSale || false;
    addProductForm.enableTracking.checked = product.enableTracking || false;

    // एडिट मोड के साथ Modal दिखाएँ
    window.showAddProductForm(true); // isEdit = true
}


// --- फॉर्म सबमिशन (नया जोड़ना / अपडेट करना) ---
if (addProductForm) {
    addProductForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const saveButton = document.getElementById('saveProductBtn');
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';

        // फॉर्म डेटा इकट्ठा करें (सभी फ़ील्ड्स)
        const openingStockValue = parseInt(addProductForm.openingStock.value) || 0;
        const productData = {
            productName: addProductForm.productName.value.trim(),
            printName: addProductForm.printName.value.trim(),
            purchasePrice: parseFloat(addProductForm.purchasePrice.value) || 0,
            salePrice: parseFloat(addProductForm.salePrice.value) || 0,
            minSalePrice: addProductForm.minSalePrice.value ? parseFloat(addProductForm.minSalePrice.value) : null,
            mrp: addProductForm.mrp.value ? parseFloat(addProductForm.mrp.value) : null,
            unit: addProductForm.unit.value,
            openingStock: openingStockValue,
            // currentStock को अपडेट/सेट करें (अगर एडिट नहीं हो रहा तो openingStock के बराबर)
            saleDiscount: addProductForm.saleDiscount.value ? parseFloat(addProductForm.saleDiscount.value) : null,
            lowLevelLimit: addProductForm.lowLevelLimit.value ? parseInt(addProductForm.lowLevelLimit.value) : null,
            productDescription: addProductForm.productDescription.value.trim(),
            printDescription: addProductForm.printDescription.checked,
            printSerialNo: addProductForm.printSerialNo.checked,
            oneClickSale: addProductForm.oneClickSale.checked,
            notForSale: addProductForm.notForSale.checked,
            enableTracking: addProductForm.enableTracking.checked
        };

        const editId = addProductForm.editProductId.value;

        try {
            if (editId) {
                // --- अपडेट मोड ---
                const productRef = window.doc(window.db, "products", editId);
                // Note: Update logic might need to adjust currentStock based on transactions,
                // Here we are just updating the fields from the form.
                // We should likely NOT overwrite currentStock here unless specifically intended.
                // Let's preserve currentStock unless openingStock changed? Or maybe never update currentStock from this form?
                // For simplicity, let's assume this form primarily sets configuration and initial/opening stock.
                // We won't explicitly update currentStock here. It should be updated via purchases/sales logic elsewhere.
                // However, we WILL update openingStock if changed.
                productData.updatedAt = new Date(); // अपडेट का समय
                await window.updateDoc(productRef, productData);
                alert('Product updated successfully!');
            } else {
                // --- ऐड मोड ---
                productData.createdAt = new Date(); // बनाने का समय
                productData.currentStock = openingStockValue; // नया प्रोडक्ट है तो currentStock = openingStock
                await window.addDoc(window.collection(window.db, "products"), productData);
                alert('Product saved successfully!');
            }
            window.hideAddProductForm(); // सफल होने पर ही फॉर्म बंद करें

        } catch (e) {
            console.error("Error adding/updating document: ", e);
            alert('Error saving product: ' + e.message);
        } finally {
            // बटन को फिर से इनेबल करें और टेक्स्ट सही करें
            saveButton.disabled = false;
            saveButton.textContent = editId ? 'Update Product' : 'Save Product';
        }
    });
} else {
     console.error("Add Product Form not found!");
}


// --- प्रोडक्ट डिलीट करना ---
async function deleteProduct(id, productName) {
    if (!id) {
        console.error("Delete failed: Invalid ID provided.");
        return;
    }
    if (confirm(`Are you sure you want to delete "${productName || 'this product'}"?`)) {
        try {
            const productRef = window.doc(window.db, 'products', id);
            await window.deleteDoc(productRef);
            console.log('Product deleted successfully: ', id);
            alert('Product deleted successfully!');
            // टेबल onSnapshot के कारण अपने आप अपडेट हो जाएगी
        } catch (error) {
            console.error('Error deleting product: ', error);
            alert('Error deleting product: ' + error.message);
        }
    }
}


// --- फ़िल्टरिंग लॉजिक ---
function filterProducts() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (!searchTerm) {
        displayProductsInTable(allProducts); // कोई सर्च टर्म नहीं, सब दिखाएं
        return;
    }
    const filtered = allProducts.filter(product =>
        (product.productName && product.productName.toLowerCase().includes(searchTerm)) ||
        (product.printName && product.printName.toLowerCase().includes(searchTerm))
    );
    displayProductsInTable(filtered);
}

// फ़िल्टर बटन और सर्च इनपुट पर इवेंट लिसनर
if (filterButton) {
    filterButton.addEventListener('click', filterProducts);
} else {
    console.warn("Filter button not found");
}
if (searchInput) {
    searchInput.addEventListener('input', filterProducts); // टाइप करते ही फ़िल्टर करें
} else {
    console.warn("Search input not found");
}


// --- एक्शन बटन के लिए बेसिक स्टाइल (अगर CSS में नहीं है) ---
function addActionButtonStyles() {
    const styleId = 'action-button-styles';
    if (!document.getElementById(styleId)) {
        const styleSheet = document.createElement("style");
        styleSheet.id = styleId;
        styleSheet.innerHTML = `
        .action-btn {
            background: none;
            border: none;
            cursor: pointer;
            padding: 2px 5px;
            margin: 0 2px;
            font-size: 14px;
        }
        .action-btn i { /* Font Awesome icons */
            pointer-events: none; /* Prevent icon from stealing click */
        }
        .action-btn.edit-btn { color: #0d6efd; } /* Bootstrap blue */
        .action-btn.delete-btn { color: #dc3545; } /* Bootstrap red */
        .action-btn:hover { opacity: 0.7; }
        td.actions {
            text-align: center; /* Center align buttons */
        }
        `;
        document.head.appendChild(styleSheet);
    }
}

// --- इनिशियलाइज़ेशन ---
// displayProductsInTable(allProducts); // onSnapshot इसे अपने आप कॉल करेगा जब डेटा आएगा

console.log("product_management.js loaded and listeners attached.");