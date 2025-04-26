import {
    db, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc,
    query, orderBy, serverTimestamp
} from '../../js/firebase-config.js'; // Adjust path as needed

const productForm = document.getElementById('product-form');
const productsTbody = document.getElementById('products-tbody');
const editProductIdInput = document.getElementById('edit-product-id');
const formMessage = document.getElementById('form-message');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const unitTypeSelect = document.getElementById('unitType');
const sqFeetOnlyFields = document.querySelectorAll('.sq-feet-only');
const weddingCardOnlyFields = document.querySelectorAll('.wedding-card-only'); // Assuming category check later

// --- Helper Functions ---
function showMessage(msg, isError = false) {
    formMessage.textContent = msg;
    formMessage.className = isError ? 'message error' : 'message success';
    setTimeout(() => formMessage.textContent = '', 5000);
}

function toggleConditionalFields() {
    const unitType = unitTypeSelect.value;
    const category = document.getElementById('productCategory').value.toLowerCase();

    sqFeetOnlyFields.forEach(el => el.style.display = unitType === 'Sq Feet' ? 'block' : 'none');
    // Example: Show wedding card fields if category is 'Wedding Card' (case-insensitive)
    // You might need a more robust way to identify wedding cards
    weddingCardOnlyFields.forEach(el => el.style.display = category.includes('wedding card') ? 'block' : 'none');
}

// --- Event Listeners ---
unitTypeSelect.addEventListener('change', toggleConditionalFields);
// Also call on category change if wedding fields depend on it
document.getElementById('productCategory').addEventListener('input', toggleConditionalFields);


cancelEditBtn.addEventListener('click', () => {
    productForm.reset();
    editProductIdInput.value = '';
    cancelEditBtn.style.display = 'none';
    showMessage(''); // Clear message
    toggleConditionalFields(); // Reset conditional fields visibility
});

// --- Load Products ---
const loadProducts = async () => {
    try {
        productsTbody.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';
        const q = query(collection(db, "onlineProducts"), orderBy("productName")); // Use "onlineProducts"
        const querySnapshot = await getDocs(q);
        productsTbody.innerHTML = ''; // Clear loading row

        if (querySnapshot.empty) {
            productsTbody.innerHTML = '<tr><td colspan="6">No online products found.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const product = docSnap.data();
            const productId = docSnap.id;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${product.productName || 'N/A'}</td>
                <td>${product.category || 'N/A'}</td>
                <td>${product.unitType || 'N/A'}</td>
                <td>${product.pricing?.rate !== undefined ? product.pricing.rate : 'N/A'}</td>
                <td>${product.isEnabled ? 'Yes' : 'No'}</td>
                <td>
                    <button class="btn btn-sm btn-edit" data-id="${productId}"><i class="fas fa-edit"></i> Edit</button>
                    <button class="btn btn-sm btn-delete" data-id="${productId}"><i class="fas fa-trash"></i> Delete</button>
                </td>
            `;
            // Edit Button Action
            tr.querySelector('.btn-edit').addEventListener('click', async () => {
                await populateFormForEdit(productId);
            });
            // Delete Button Action
            tr.querySelector('.btn-delete').addEventListener('click', async () => {
                await deleteProduct(productId, product.productName);
            });

            productsTbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error loading products: ", error);
        productsTbody.innerHTML = '<tr><td colspan="6" class="error">Error loading products.</td></tr>';
    }
};

// --- Populate Form for Editing ---
const populateFormForEdit = async (productId) => {
    try {
        const productRef = doc(db, "onlineProducts", productId); // Use "onlineProducts"
        const docSnap = await getDoc(productRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            productForm.reset(); // Clear previous values

            editProductIdInput.value = productId;
            document.getElementById('productName').value = data.productName || '';
            document.getElementById('productDesc').value = data.description || '';
            document.getElementById('productCategory').value = data.category || '';
            document.getElementById('imageUrl').value = data.imageUrl || '';
            unitTypeSelect.value = data.unitType || 'Qty'; // Set unit type
            document.getElementById('productRate').value = data.pricing?.rate ?? '';
            document.getElementById('minOrderValue').value = data.pricing?.minimumOrderValue ?? '';
            // Populate wedding card fields if they exist in data.pricing
            document.getElementById('designCharge').value = data.pricing?.designCharge ?? '';
            document.getElementById('printingCharge').value = data.pricing?.printingChargeBase ?? ''; // Adjust field name if needed
            document.getElementById('transportCharge').value = data.pricing?.transportCharge ?? '';

            // Handle options (assuming JSON string or object)
            if (data.options) {
                 try {
                     document.getElementById('productOptions').value = typeof data.options === 'string' ? data.options : JSON.stringify(data.options, null, 2);
                 } catch {
                     document.getElementById('productOptions').value = ''; // Clear if invalid
                 }
            } else {
                 document.getElementById('productOptions').value = '';
            }


            document.getElementById('isEnabled').checked = data.isEnabled !== undefined ? data.isEnabled : true;

            cancelEditBtn.style.display = 'inline-block'; // Show cancel button
            toggleConditionalFields(); // Show/hide fields based on loaded data
            showMessage(''); // Clear any previous message
            window.scrollTo(0, 0); // Scroll to top to see form
        } else {
            showMessage(`Error: Product with ID ${productId} not found.`, true);
        }
    } catch (error) {
        console.error("Error fetching product for edit:", error);
        showMessage("Error loading product data for editing.", true);
    }
};


// --- Delete Product ---
const deleteProduct = async (productId, productName) => {
    if (!confirm(`Are you sure you want to delete product "${productName || 'this product'}"?`)) {
        return;
    }
    try {
        await deleteDoc(doc(db, "onlineProducts", productId)); // Use "onlineProducts"
        showMessage(`Product "${productName}" deleted successfully.`, false);
        loadProducts(); // Refresh the list
    } catch (error) {
        console.error("Error deleting product: ", error);
        showMessage("Error deleting product.", true);
    }
};


// --- Save/Update Product ---
productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    formMessage.textContent = ''; // Clear previous message

    const productId = editProductIdInput.value;
    const isEditing = !!productId;

    // --- Basic Data ---
    const productData = {
        productName: document.getElementById('productName').value.trim(),
        description: document.getElementById('productDesc').value.trim(),
        category: document.getElementById('productCategory').value.trim(),
        imageUrl: document.getElementById('imageUrl').value.trim(),
        unitType: unitTypeSelect.value,
        isEnabled: document.getElementById('isEnabled').checked,
        updatedAt: serverTimestamp()
    };

    // --- Pricing Data ---
    const pricing = {
        rate: parseFloat(document.getElementById('productRate').value) || 0,
    };
    if (productData.unitType === 'Sq Feet') {
        const minVal = parseFloat(document.getElementById('minOrderValue').value);
        if (!isNaN(minVal) && minVal > 0) {
            pricing.minimumOrderValue = minVal;
        }
    }
    // Add wedding card pricing fields if category matches (adjust condition if needed)
    if (productData.category.toLowerCase().includes('wedding card')) {
         const design = parseFloat(document.getElementById('designCharge').value);
         const print = parseFloat(document.getElementById('printingCharge').value);
         const transport = parseFloat(document.getElementById('transportCharge').value);
         if (!isNaN(design)) pricing.designCharge = design;
         if (!isNaN(print)) pricing.printingChargeBase = print; // Adjust field name if needed
         if (!isNaN(transport)) pricing.transportCharge = transport;
    }


    productData.pricing = pricing; // Add pricing object

    // --- Options Data ---
    const optionsString = document.getElementById('productOptions').value.trim();
    if (optionsString) {
        try {
            productData.options = JSON.parse(optionsString);
        } catch (err) {
            showMessage('Error: Invalid JSON format in Options field.', true);
            return; // Stop saving
        }
    } else {
        productData.options = []; // Or null, depending on preference
    }


    // --- Validation (Basic) ---
    if (!productData.productName || !productData.category || isNaN(pricing.rate)) {
        showMessage('Please fill in required fields (Name, Category, Rate).', true);
        return;
    }

    // --- Firestore Operation ---
    try {
        if (isEditing) {
            // Update existing product
            const productRef = doc(db, "onlineProducts", productId); // Use "onlineProducts"
            await updateDoc(productRef, productData);
            showMessage('Product updated successfully!', false);
        } else {
            // Add new product
            productData.createdAt = serverTimestamp(); // Add createdAt for new products
            const docRef = await addDoc(collection(db, "onlineProducts"), productData); // Use "onlineProducts"
            showMessage(`Product "${productData.productName}" added successfully! ID: ${docRef.id}`, false);
        }
        productForm.reset();
        editProductIdInput.value = '';
        cancelEditBtn.style.display = 'none';
        toggleConditionalFields(); // Reset conditional fields
        loadProducts(); // Refresh the list

    } catch (error) {
        console.error("Error saving product: ", error);
        showMessage('Error saving product. See console for details.', true);
    }
});

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    toggleConditionalFields(); // Set initial visibility
});