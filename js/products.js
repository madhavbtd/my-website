// js/products.js
import { db, collection, getDocs, query, where, orderBy } from './firebase-config.js';
import { updateCartCount } from './main.js'; // Common function

document.addEventListener('DOMContentLoaded', () => {
    const productListContainer = document.getElementById('product-list-container');
    const noProductsMessage = document.getElementById('no-products-message');
    const categoryFilter = document.getElementById('category-filter'); // Filter element

    // Function to render product cards
    const renderProducts = (products) => {
        productListContainer.innerHTML = ''; // Clear previous content/spinner

        if (!products || products.length === 0) {
            noProductsMessage.style.display = 'block';
            return;
        }
        noProductsMessage.style.display = 'none';

        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.dataset.productId = product.id; // Store product ID

            // Determine price display (handle different pricing structures later)
            let priceDisplay = 'N/A';
            if (product.pricing && product.pricing.rate !== undefined) {
                 if (product.unitType === 'Sq Feet') {
                     priceDisplay = `From ₹${product.pricing.rate}/sq ft`;
                     // Add minimum order note if applicable
                     if (product.pricing.minimumOrderValue) {
                         priceDisplay += ` (Min. ₹${product.pricing.minimumOrderValue})`;
                     }
                 } else {
                     priceDisplay = `₹${product.pricing.rate}/unit`;
                 }
            } else if (product.category === 'Wedding Card') { // Example: Placeholder for complex pricing
                 priceDisplay = 'Starting from ₹...'; // Or fetch a base price
            }


            card.innerHTML = `
                <div class="product-image-container">
                    <img src="${product.imageUrl || 'images/placeholder.png'}" alt="${product.productName}" loading="lazy">
                </div>
                <div class="product-info">
                    <h3>${product.productName}</h3>
                    <div class="price">${priceDisplay}</div>
                    <a href="product-detail.html?id=${product.id}" class="button-primary">View Details</a>
                </div>
            `;
            productListContainer.appendChild(card);
        });
    };

    // Function to fetch products from Firestore
    const fetchProducts = async (category = 'all') => {
        try {
            productListContainer.innerHTML = `
                <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin fa-3x"></i>
                    <p>Loading products...</p>
                </div>`; // Show spinner
            noProductsMessage.style.display = 'none';

            // Query 'onlineProducts' collection
            let productQuery;
            const productsRef = collection(db, "onlineProducts");

            if (category === 'all') {
                // Fetch all enabled products, ordered by name
                productQuery = query(productsRef, where("isEnabled", "==", true), orderBy("productName"));
            } else {
                // Fetch enabled products for a specific category, ordered by name
                productQuery = query(productsRef, where("isEnabled", "==", true), where("category", "==", category), orderBy("productName"));
            }

            const querySnapshot = await getDocs(productQuery);
            const products = [];
            querySnapshot.forEach((doc) => {
                products.push({ id: doc.id, ...doc.data() });
            });

            renderProducts(products);

        } catch (error) {
            console.error("Error fetching products: ", error);
            productListContainer.innerHTML = `<p class="message-box error">Failed to load products. Please try again later.</p>`;
        }
    };

     // --- Optional: Fetch and populate categories for the filter ---
     const populateCategoryFilter = async () => {
        try {
            // Assuming you have a 'productCategories' collection
            // Or get unique categories from 'onlineProducts'
            const categoriesRef = collection(db, "onlineProducts"); // Example: Get from products
            const q = query(categoriesRef, where("isEnabled", "==", true));
            const snapshot = await getDocs(q);
            const uniqueCategories = new Set();
            snapshot.forEach(doc => {
                if (doc.data().category) {
                    uniqueCategories.add(doc.data().category);
                }
            });

            uniqueCategories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categoryFilter.appendChild(option);
            });

        } catch (error) {
            console.error("Error fetching categories:", error);
            // Handle error - maybe hide filter or show message
        }
     };

    // Event listener for category filter change
    if (categoryFilter) {
        categoryFilter.addEventListener('change', (event) => {
            fetchProducts(event.target.value); // Fetch products for selected category
        });
    }


    // Initial setup
    updateCartCount(); // Update cart count from common function
    populateCategoryFilter(); // Populate filter dropdown
    fetchProducts(); // Fetch all products initially
});