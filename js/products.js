// js/products.js
// UPDATED Version: Handles imageUrls array, correct price logic, currency formatting, and uses updated firebase-config exports.

// Import necessary functions and db instance from firebase-config.js
import {
    db, collection, getDocs, query, where, orderBy
} from './firebase-config.js';

// Assuming updateCartCount might be needed (from main.js or cart.js)
// Try importing from main.js as potentially done in product-detail.js
// import { updateCartCount } from './main.js';


document.addEventListener('DOMContentLoaded', () => {
    const productListContainer = document.getElementById('product-list-container');
    const noProductsMessage = document.getElementById('no-products-message');
    const categoryFilter = document.getElementById('category-filter'); // Filter element
    const loadingSpinner = document.getElementById('loading'); // Get spinner element

    // Helper function for Indian Rupee currency formatting
    const formatIndianCurrency = (amount) => {
         const num = Number(amount);
         // Returns 'N/A' if amount is not a valid number, otherwise formats it.
         return isNaN(num) || num === null ? 'N/A' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // --- renderProducts Function (Largely Unchanged, ensure it uses new CSS classes if needed) ---
    const renderProducts = (products) => {
        if (!productListContainer) {
            console.error("Error: Product list container not found!");
            if(loadingSpinner) loadingSpinner.style.display = 'none'; // Hide spinner on error too
            return;
        }
        productListContainer.innerHTML = ''; // Clear previous content/spinner

        if (!products || products.length === 0) {
            if(noProductsMessage) noProductsMessage.style.display = 'block';
            // Ensure spinner is hidden if no products message is shown
             // Already cleared above, no need to hide spinner again here
            return;
        }

        if(noProductsMessage) noProductsMessage.style.display = 'none';

        products.forEach(product => {
            if (!product || !product.id) {
                console.warn("Skipping invalid product data:", product);
                return; // Skip rendering if product data is invalid
            }

            const card = document.createElement('div');
            card.className = 'product-card'; // Use updated CSS class name
            card.dataset.productId = product.id; // Store product ID

            // --- Image URL Access ---
            let imageUrl = 'images/placeholder.png'; // Default placeholder
            if (product.imageUrls && Array.isArray(product.imageUrls) && product.imageUrls.length > 0 && product.imageUrls[0]) {
                imageUrl = product.imageUrls[0]; // Use the first image URL
            }

            // --- Price Display Logic ---
            let priceDisplay = 'Contact for Price';
             if (product.pricing && typeof product.pricing.rate !== 'undefined' && product.pricing.rate !== null) {
                 const rate = product.pricing.rate;
                 if (product.unit && typeof product.unit === 'string') {
                    if (product.unit.toLowerCase() === 'sq feet') { // Case-insensitive check
                        priceDisplay = `From ${formatIndianCurrency(rate)} / sq ft`;
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

            // --- Sanitize Product Name ---
            const productName = product.productName || 'Unnamed Product'; // Fallback name

            // HTML Structure for Product Card (Matches new CSS potentially)
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
    // --- END of renderProducts Function ---

    // --- fetchProducts Function (Show/Hide Spinner added) ---
    const fetchProducts = async (category = 'all') => {
        if (!productListContainer) {
             console.error("Product list container not found on fetch.");
             return;
        }
        // Show spinner and hide messages/content
         if(loadingSpinner) loadingSpinner.style.display = 'flex';
         productListContainer.innerHTML = ''; // Clear previous products immediately
         productListContainer.appendChild(loadingSpinner); // Re-append spinner to cleared container
         if(noProductsMessage) noProductsMessage.style.display = 'none';

        try {
            if (!db) {
                throw new Error("Firestore database instance is not available.");
            }
            let productQuery;
            const productsRef = collection(db, "onlineProducts");
            const constraints = [where("isEnabled", "==", true)];

            if (category !== 'all' && category) {
                 constraints.push(where("category", "==", category));
            }
            constraints.push(orderBy("productName"));

            productQuery = query(productsRef, ...constraints);

            const querySnapshot = await getDocs(productQuery);
            const products = [];
            querySnapshot.forEach((doc) => {
                if (doc.exists() && doc.data().productName) {
                     products.push({ id: doc.id, ...doc.data() });
                } else {
                    console.warn(`Document ${doc.id} skipped due to missing data or name.`);
                }
            });

             if(loadingSpinner) loadingSpinner.style.display = 'none'; // Hide spinner BEFORE rendering
             renderProducts(products); // Render fetched products

        } catch (error) {
            console.error("Error fetching products: ", error);
             if(loadingSpinner) loadingSpinner.style.display = 'none'; // Hide spinner on error
             // Display error message within the container
             productListContainer.innerHTML = `<div class="message-box error" style="grid-column: 1 / -1;"><p>Failed to load products. Please check your connection or try again later. Error: ${error.message}</p></div>`;
            if(noProductsMessage) noProductsMessage.style.display = 'none';
        }
    };

     // --- populateCategoryFilter Function (Unchanged) ---
     const populateCategoryFilter = async () => {
        if (!categoryFilter || !db) {
            console.log("Category filter element or DB not available.");
            return;
        }
        try {
            const categoriesRef = collection(db, "onlineProducts");
            const q = query(categoriesRef, where("isEnabled", "==", true));
            const snapshot = await getDocs(q);
            const uniqueCategories = new Set();
            snapshot.forEach(doc => {
                const category = doc.data().category;
                if (category && typeof category === 'string' && category.trim() !== '') {
                    uniqueCategories.add(category.trim());
                }
            });

            const sortedCategories = Array.from(uniqueCategories).sort();

            // Add sorted categories to the dropdown (start from index 1 to keep 'All Categories')
            categoryFilter.options.length = 1; // Keep only the first option
            sortedCategories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categoryFilter.appendChild(option);
            });

        } catch (error) {
            console.error("Error fetching categories:", error);
        }
     };

    // --- Event listener for category filter change (Unchanged) ---
    if (categoryFilter) {
        categoryFilter.addEventListener('change', (event) => {
            fetchProducts(event.target.value); // Fetch products for selected category
        });
    } else {
        console.log("Category filter element not found.");
    }

    // --- NEW: Featured Product Slider Logic ---
    const featuredSlidersData = {
        'slider-flex-banner': [
            'https://i.ibb.co/ZRwV0sx5/2.jpg',
            'https://i.ibb.co/1Gxw1pVv/1.jpg',
            'https://i.ibb.co/4GYgD4t/3.jpg'
        ],
        'slider-wedding-card': [
            'https://i.ibb.co/XZDSGBQH/3.jpg',
            'https://i.ibb.co/dwkTVrht/2.jpg',
            'https://i.ibb.co/xtNQ1wTr/1.jpg'
        ]
        // Add more sliders here if needed
        // 'slider-id': ['img1.jpg', 'img2.jpg']
    };

    function initializeSlider(sliderId, images) {
        const sliderElement = document.getElementById(sliderId);
        if (!sliderElement || images.length === 0) {
            console.warn(`Slider element #${sliderId} not found or no images provided.`);
            return;
        }

        // Add images to the slider
        images.forEach((imgUrl, index) => {
            const img = document.createElement('img');
            img.src = imgUrl;
            img.alt = `${sliderId.replace('slider-', '')} image ${index + 1}`;
             // Add 'active' class to the first image
            if (index === 0) {
                img.classList.add('active');
            }
            sliderElement.appendChild(img);
        });

        let currentSlide = 0;
        const slides = sliderElement.querySelectorAll('img');
        const slideInterval = 3000; // Time in ms (3 seconds)

        function nextSlide() {
            slides[currentSlide].classList.remove('active');
            currentSlide = (currentSlide + 1) % slides.length;
            slides[currentSlide].classList.add('active');
        }

        // Start auto-sliding only if there's more than one image
        if (slides.length > 1) {
           setInterval(nextSlide, slideInterval);
        }
    }

    // Initialize all sliders defined in featuredSlidersData
    for (const sliderId in featuredSlidersData) {
        initializeSlider(sliderId, featuredSlidersData[sliderId]);
    }
    // --- END of Featured Product Slider Logic ---


    // --- Initial Setup ---
    // Update cart count on initial load (assuming function is available)
    // if (typeof updateCartCount === 'function') {
    //     updateCartCount();
    // } else {
    //     console.warn("updateCartCount function not found for initial load.");
    // }

    populateCategoryFilter(); // Populate filter dropdown
    fetchProducts(); // Fetch all products initially
});