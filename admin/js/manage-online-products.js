// admin/js/manage-online-products.js

// Imports: Firebase init, Firestore functions, Auth functions
// !! PATH CHECK KAREIN !! (Assuming admin folder is at root, js folder is at root)
import { db, auth } from '../../js/firebase-init.js'; // Adjust path based on your structure (e.g., '../js/firebase-init.js')
import {
    collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc,
    query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"; // Use correct SDK version if different
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- DOM Elements ---
const productForm = document.getElementById('product-form');
const productsTbody = document.getElementById('products-tbody');
const editProductIdInput = document.getElementById('edit-product-id');
const formMessage = document.getElementById('form-message');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const unitTypeSelect = document.getElementById('unitType');
const sqFeetOnlyFields = document.querySelectorAll('.sq-feet-only');
const weddingCardOnlyFields = document.querySelectorAll('.wedding-card-only');
const productCategoryInput = document.getElementById('productCategory'); // Added for event listener


// --- Helper Functions ---
function showMessage(msg, isError = false) {
    if (!formMessage) return;
    formMessage.textContent = msg;
    formMessage.className = isError ? 'message error' : 'message success';
    setTimeout(() => { if (formMessage) formMessage.textContent = ''; }, 5000);
}

function toggleConditionalFields() {
    if (!unitTypeSelect || !productCategoryInput) return; // Ensure elements exist
    const unitType = unitTypeSelect.value;
    const category = productCategoryInput.value.toLowerCase();

    sqFeetOnlyFields.forEach(el => el.style.display = unitType === 'Sq Feet' ? 'block' : 'none');
    // Example: Show wedding card fields if category contains 'wedding card' (case-insensitive)
    weddingCardOnlyFields.forEach(el => el.style.display = category.includes('wedding card') ? 'block' : 'none');
}

// --- Load Products ---
const loadProducts = async () => {
    if (!productsTbody) return;
    try {
        productsTbody.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';
        // Use "onlineProducts" collection
        const q = query(collection(db, "onlineProducts"), orderBy("productName"));
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
            const editBtn = tr.querySelector('.btn-edit');
            if (editBtn) {
                editBtn.addEventListener('click', async () => {
                    await populateFormForEdit(productId);
                });
            }
            // Delete Button Action
            const deleteBtn = tr.querySelector('.btn-delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async () => {
                    await deleteProduct(productId, product.productName);
                });
            }

            productsTbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error loading products: ", error);
        productsTbody.innerHTML = '<tr><td colspan="6" class="error">Error loading products.</td></tr>';
    }
};

// --- Populate Form for Editing ---
const populateFormForEdit = async (productId) => {
    if (!productForm) return;
    try {
        const productRef = doc(db, "onlineProducts", productId); // Use "onlineProducts"
        const docSnap = await getDoc(productRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            productForm.reset(); // Clear previous values

            editProductIdInput.value = productId;
            document.getElementById('productName').value = data.productName || '';
            document.getElementById('productDesc').value = data.description || '';
            if (productCategoryInput) productCategoryInput.value = data.category || ''; // Check element exists
            document.getElementById('imageUrl').value = data.imageUrl || '';
            if (unitTypeSelect) unitTypeSelect.value = data.unitType || 'Qty'; // Check element exists
            document.getElementById('productRate').value = data.pricing?.rate ?? '';
            document.getElementById('minOrderValue').value = data.pricing?.minimumOrderValue ?? '';
            // Populate wedding card fields if they exist in data.pricing
            document.getElementById('designCharge').value = data.pricing?.designCharge ?? '';
            document.getElementById('printingCharge').value = data.pricing?.printingChargeBase ?? ''; // Adjust field name if needed
            document.getElementById('transportCharge').value = data.pricing?.transportCharge ?? '';

            // Handle options (assuming JSON string or object)
            const optionsTextArea = document.getElementById('productOptions');
             if (optionsTextArea) {
                if (data.options) {
                     try {
                         optionsTextArea.value = typeof data.options === 'string' ? data.options : JSON.stringify(data.options, null, 2);
                     } catch {
                         optionsTextArea.value = ''; // Clear if invalid
                     }
                } else {
                     optionsTextArea.value = '';
                }
            }

            const isEnabledCheckbox = document.getElementById('isEnabled');
            if(isEnabledCheckbox) isEnabledCheckbox.checked = data.isEnabled !== undefined ? data.isEnabled : true;

            if (cancelEditBtn) cancelEditBtn.style.display = 'inline-block'; // Show cancel button
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


// --- Function to Initialize Page after Auth ---
function initializeProductPage() {
    console.log("User authenticated, initializing Product Management page...");

    // Add Event Listeners if elements exist
    if (unitTypeSelect) unitTypeSelect.addEventListener('change', toggleConditionalFields);
    if (productCategoryInput) productCategoryInput.addEventListener('input', toggleConditionalFields); // Check element exists

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            if (productForm) productForm.reset();
            if (editProductIdInput) editProductIdInput.value = '';
            cancelEditBtn.style.display = 'none';
            showMessage(''); // Clear message
            toggleConditionalFields(); // Reset conditional fields visibility
        });
    }

    // Form Submit Listener
    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            formMessage.textContent = ''; // Clear previous message

            const productId = editProductIdInput?.value; // Use optional chaining
            const isEditing = !!productId;

            // --- Basic Data ---
            const productData = {
                productName: document.getElementById('productName')?.value.trim() || '',
                description: document.getElementById('productDesc')?.value.trim() || '',
                category: productCategoryInput?.value.trim() || '',
                imageUrl: document.getElementById('imageUrl')?.value.trim() || '',
                unitType: unitTypeSelect?.value || 'Qty',
                isEnabled: document.getElementById('isEnabled')?.checked ?? true,
                updatedAt: serverTimestamp()
            };

            // --- Pricing Data ---
            const pricing = {
                rate: parseFloat(document.getElementById('productRate')?.value) || 0,
            };
            if (productData.unitType === 'Sq Feet') {
                const minVal = parseFloat(document.getElementById('minOrderValue')?.value);
                if (!isNaN(minVal) && minVal > 0) {
                    pricing.minimumOrderValue = minVal;
                }
            }
            // Add wedding card pricing fields if category matches (adjust condition if needed)
            if (productData.category.toLowerCase().includes('wedding card')) {
                 const design = parseFloat(document.getElementById('designCharge')?.value);
                 const print = parseFloat(document.getElementById('printingCharge')?.value);
                 const transport = parseFloat(document.getElementById('transportCharge')?.value);
                 if (!isNaN(design)) pricing.designCharge = design;
                 if (!isNaN(print)) pricing.printingChargeBase = print; // Adjust field name if needed
                 if (!isNaN(transport)) pricing.transportCharge = transport;
            }
            productData.pricing = pricing; // Add pricing object

             // --- Options Data ---
             const optionsTextArea = document.getElementById('productOptions');
             const optionsString = optionsTextArea?.value.trim() || '';
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
                if(editProductIdInput) editProductIdInput.value = '';
                if(cancelEditBtn) cancelEditBtn.style.display = 'none';
                toggleConditionalFields(); // Reset conditional fields
                loadProducts(); // Refresh the list

            } catch (error) {
                console.error("Error saving product: ", error);
                showMessage('Error saving product. See console for details.', true);
            }
        });
    } // end if(productForm)

    // --- Initial Load ---
    loadProducts();
    toggleConditionalFields(); // Set initial visibility
}


// --- Authentication Check ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User logged in hai, page ko initialize karein
        initializeProductPage();
    } else {
        // User logged in nahi hai, login page par redirect karein
        console.log("User not logged in for Product Management, redirecting...");
        // Ensure we are not already on login page to avoid infinite loop
        if (!window.location.pathname.includes('login.html')) {
             // Adjust path relative to admin folder
             window.location.replace('../login.html'); // Assumes login.html is one level up
        }
    }
});