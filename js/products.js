// js/products.js
// UPDATED Version: Handles imageUrls array, correct price logic, currency formatting, and uses updated firebase-config exports.

// Import necessary functions and db instance from firebase-config.js
import {
    db, collection, getDocs, query, where, orderBy
} from './firebase-config.js';

// Assuming updateCartCount is available globally or in main.js
// If main.js is also a module, you might need: import { updateCartCount } from './main.js';
// For now, we'll assume it's globally available or handled elsewhere.
// declare function updateCartCount(): void; // Placeholder if using TypeScript or for clarity

document.addEventListener('DOMContentLoaded', () => {
    const productListContainer = document.getElementById('product-list-container');
    const noProductsMessage = document.getElementById('no-products-message');
    const categoryFilter = document.getElementById('category-filter'); // Filter element

    // Helper function for Indian Rupee currency formatting
    const formatIndianCurrency = (amount) => {
         const num = Number(amount);
         // Returns 'N/A' if amount is not a valid number, otherwise formats it.
         return isNaN(num) || num === null ? 'N/A' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // --- UPDATED renderProducts Function ---
    const renderProducts = (products) => {
        if (!productListContainer) {
            console.error("Error: Product list container not found!");
            return;
        }
        productListContainer.innerHTML = ''; // Clear previous content/spinner

        if (!products || products.length === 0) {
            if(noProductsMessage) noProductsMessage.style.display = 'block';
            // Ensure spinner is hidden if no products message is shown
            const spinner = productListContainer.querySelector('.loading-spinner');
            if (spinner) spinner.style.display = 'none';
            return;
        }
        if(noProductsMessage) noProductsMessage.style.display = 'none';

        products.forEach(product => {
            if (!product || !product.id) {
                console.warn("Skipping invalid product data:", product);
                return; // Skip rendering if product data is invalid
            }

            const card = document.createElement('div');
            card.className = 'product-card';
            card.dataset.productId = product.id; // Store product ID

            // --- Correct Image URL Access ---
            let imageUrl = 'images/placeholder.png'; // Default placeholder
            // Check if imageUrls exists, is an array, and has at least one item
            if (product.imageUrls && Array.isArray(product.imageUrls) && product.imageUrls.length > 0 && product.imageUrls[0]) {
                imageUrl = product.imageUrls[0]; // Use the first image URL
            }

            // --- Correct Price Display Logic ---
            let priceDisplay = 'Contact for Price'; // Default text, especially if pricing is complex or missing
            // Check if pricing object and rate exist
            if (product.pricing && typeof product.pricing.rate !== 'undefined' && product.pricing.rate !== null) {
                 const rate = product.pricing.rate;
                 // Check product.unit (exists and is a string)
                 if (product.unit && typeof product.unit === 'string') {
                    if (product.unit.toLowerCase() === 'sq feet') { // Case-insensitive check
                        priceDisplay = `From ${formatIndianCurrency(rate)} / sq ft`;
                        // Add minimum order value note if applicable and valid
                        if (typeof product.pricing.minimumOrderValue === 'number' && product.pricing.minimumOrderValue > 0) {
                            priceDisplay += ` (Min. ${formatIndianCurrency(product.pricing.minimumOrderValue)})`;
                        }
                    } else { // For Qty, Nos, etc.
                        priceDisplay = `${formatIndianCurrency(rate)} / ${product.unit}`;
                    }
                 } else { // Fallback if unit is missing but rate exists
                     priceDisplay = formatIndianCurrency(rate);
                 }
            }
            // No need for the explicit 'Wedding Card' check here anymore unless specific logic is needed beyond 'Contact for Price'

            // --- Sanitize Product Name ---
            const productName = product.productName || 'Unnamed Product'; // Fallback name

            card.innerHTML = `
                <div class="product-image-container">
                    <img src="${imageUrl}" alt="${productName}" loading="lazy" onerror="this.onerror=null; this.src='images/placeholder.png';">
                </div>
                <div class="product-info">
                    <h3>${productName}</h3>
                    <div class="price">${priceDisplay}</div>
                    <a href="product-detail.html?id=${product.id}" class="button-primary">View Details</a>
                </div>
            `;
            productListContainer.appendChild(card);
        });
    };
    // --- END of UPDATED renderProducts Function ---

    // Function to fetch products from Firestore (Mostly Unchanged)
    const fetchProducts = async (category = 'all') => {
        if (!productListContainer) {
             console.error("Product list container not found on fetch.");
             return;
        }
        // Show spinner and hide messages
        productListContainer.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin fa-3x"></i>
                <p>Loading products...</p>
            </div>`;
        if(noProductsMessage) noProductsMessage.style.display = 'none';

        try {
            if (!db) {
                throw new Error("Firestore database instance is not available.");
            }
            // Query 'onlineProducts' collection
            let productQuery;
            const productsRef = collection(db, "onlineProducts");
            const constraints = [where("isEnabled", "==", true)]; // Base constraint

            if (category !== 'all' && category) {
                 constraints.push(where("category", "==", category)); // Add category constraint if selected
            }
            constraints.push(orderBy("productName")); // Always order by name

            productQuery = query(productsRef, ...constraints); // Build the query

            const querySnapshot = await getDocs(productQuery);
            const products = [];
            querySnapshot.forEach((doc) => {
                // Basic validation before pushing
                if (doc.exists() && doc.data().productName) {
                     products.push({ id: doc.id, ...doc.data() });
                } else {
                    console.warn(`Document ${doc.id} skipped due to missing data or name.`);
                }
            });

            renderProducts(products); // Pass fetched products to the updated render function

        } catch (error) {
            console.error("Error fetching products: ", error);
            productListContainer.innerHTML = `<div class="message-box error" style="grid-column: 1 / -1;"><p>Failed to load products. Please check your connection or try again later. Error: ${error.message}</p></div>`;
            if(noProductsMessage) noProductsMessage.style.display = 'none'; // Hide 'no products' message if error occurs
        }
    };

     // Fetch and populate categories for the filter (Mostly Unchanged)
     const populateCategoryFilter = async () => {
        if (!categoryFilter || !db) {
            console.log("Category filter element or DB not available.");
            return; // Exit if filter dropdown or db doesn't exist
        }
        try {
            const categoriesRef = collection(db, "onlineProducts");
            // Query only enabled products to get relevant categories
            const q = query(categoriesRef, where("isEnabled", "==", true));
            const snapshot = await getDocs(q);
            const uniqueCategories = new Set();
            snapshot.forEach(doc => {
                const category = doc.data().category;
                // Add category only if it's a non-empty string
                if (category && typeof category === 'string' && category.trim() !== '') {
                    uniqueCategories.add(category.trim());
                }
            });

            // Sort categories alphabetically before adding
            const sortedCategories = Array.from(uniqueCategories).sort();

            // Clear existing options except the first 'All Categories' one
            // categoryFilter.innerHTML = '<option value="all">All Categories</option>'; // Alternative way to clear

            // Add sorted categories to the dropdown
            sortedCategories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categoryFilter.appendChild(option);
            });

        } catch (error) {
            console.error("Error fetching categories:", error);
            // Optionally disable the filter or show a message
            // categoryFilter.disabled = true;
        }
     };

    // Event listener for category filter change (Unchanged)
    if (categoryFilter) {
        categoryFilter.addEventListener('change', (event) => {
            fetchProducts(event.target.value); // Fetch products for selected category
        });
    } else {
        console.log("Category filter element not found.");
    }

    // Initial setup
    if (typeof updateCartCount === 'function') {
        updateCartCount(); // Update cart count if function exists
    }
    populateCategoryFilter(); // Populate filter dropdown
    fetchProducts(); // Fetch all products initially
});