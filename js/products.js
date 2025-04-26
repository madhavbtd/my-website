// js/products.js
// UPDATED Version: Fixed import statements

// Import db instance from firebase-config.js
import { db } from './firebase-config.js';

// Import Firestore functions directly from the Firebase SDK
import {
    collection, getDocs, query, where, orderBy, startAfter, limit
    // Add any other specific Firestore functions you use here
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"; // Use the correct SDK path


document.addEventListener('DOMContentLoaded', () => {
    const productListContainer = document.getElementById('product-list-container');
    const noProductsMessage = document.getElementById('no-products-message');
    const categoryFilter = document.getElementById('category-filter');
    const sortFilter = document.getElementById('sort-filter'); // New sort filter
    const loadingSpinner = document.getElementById('loading');
    const featuredItems = document.querySelectorAll('.clickable-featured'); // Select clickable featured items

    // Helper function for Indian Rupee currency formatting
    const formatIndianCurrency = (amount) => {
        const num = Number(amount);
        return isNaN(num) || num === null ? 'N/A' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // --- renderProducts Function ---
    // ...(बाकी का कोड जैसा पिछले उत्तर में था वैसा ही रहेगा)...
    const renderProducts = (products) => {
        // Clear previous content/spinner (ensure spinner is removed)
        productListContainer.innerHTML = '';

        if (!products || products.length === 0) {
            if (noProductsMessage) noProductsMessage.style.display = 'block';
            return;
        }

        if (noProductsMessage) noProductsMessage.style.display = 'none';

        products.forEach(product => {
            if (!product || !product.id) {
                console.warn("Skipping invalid product data:", product);
                return;
            }

            const card = document.createElement('div');
            card.className = 'product-card'; // Use updated class name
            card.dataset.productId = product.id;

            let imageUrl = 'images/placeholder.png';
            if (product.imageUrls && Array.isArray(product.imageUrls) && product.imageUrls.length > 0 && product.imageUrls[0]) {
                imageUrl = product.imageUrls[0];
            }

            let priceDisplay = 'Contact for Price';
            if (product.pricing && typeof product.pricing.rate !== 'undefined' && product.pricing.rate !== null) {
                 const rate = product.pricing.rate;
                 if (product.unit && typeof product.unit === 'string') {
                     if (product.unit.toLowerCase() === 'sq feet') {
                         priceDisplay = `From ${formatIndianCurrency(rate)} / sq ft`;
                         if (typeof product.pricing.minimumOrderValue === 'number' && product.pricing.minimumOrderValue > 0) {
                             priceDisplay += ` (Min. ${formatIndianCurrency(product.pricing.minimumOrderValue)})`;
                         }
                     } else {
                         priceDisplay = `${formatIndianCurrency(rate)} / ${product.unit}`;
                     }
                 } else {
                     priceDisplay = formatIndianCurrency(rate);
                 }
            }

            const productName = product.productName || 'Unnamed Product';

            // Updated Card Structure (matches new CSS)
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


     // --- fetchProducts Function (MODIFIED for Sorting) ---
    const fetchProducts = async () => {
        if (!productListContainer) {
            console.error("Product list container not found on fetch.");
            return;
        }

        // Get current filter values
        const selectedCategory = categoryFilter ? categoryFilter.value : 'all';
        const selectedSort = sortFilter ? sortFilter.value : 'name_asc';

        // Show spinner
        if (loadingSpinner) loadingSpinner.style.display = 'flex';
        productListContainer.innerHTML = ''; // Clear previous products
        productListContainer.appendChild(loadingSpinner); // Add spinner back
        if (noProductsMessage) noProductsMessage.style.display = 'none';

        try {
            if (!db) {
                throw new Error("Firestore database instance is not available.");
            }

            const productsRef = collection(db, "onlineProducts");
            let constraints = [where("isEnabled", "==", true)];

            // Add category filter constraint
            if (selectedCategory !== 'all' && selectedCategory) {
                constraints.push(where("category", "==", selectedCategory));
            }

            // Add sorting constraint
            // IMPORTANT: Firestore requires composite indexes for queries filtering on one field
            // and ordering by another. You might need to create these indexes in your Firebase console.
            // Example index: Collection=onlineProducts, Fields: isEnabled ASC, category ASC, pricing.rate ASC
            // Example index: Collection=onlineProducts, Fields: isEnabled ASC, category ASC, pricing.rate DESC
            // Example index: Collection=onlineProducts, Fields: isEnabled ASC, category ASC, productName ASC
            switch (selectedSort) {
                case 'price_asc':
                    // Assuming price is stored in product.pricing.rate
                    constraints.push(orderBy("pricing.rate", "asc"));
                    break;
                case 'price_desc':
                    constraints.push(orderBy("pricing.rate", "desc"));
                    break;
                case 'name_asc':
                default:
                    constraints.push(orderBy("productName", "asc"));
                    break;
            }

            const productQuery = query(productsRef, ...constraints);

            const querySnapshot = await getDocs(productQuery);
            const products = [];
            querySnapshot.forEach((doc) => {
                if (doc.exists() && doc.data().productName) {
                    products.push({ id: doc.id, ...doc.data() });
                } else {
                    console.warn(`Document ${doc.id} skipped due to missing data or name.`);
                }
            });

            if (loadingSpinner) loadingSpinner.style.display = 'none'; // Hide spinner BEFORE rendering
            renderProducts(products); // Render fetched products

        } catch (error) {
            console.error("Error fetching/sorting products: ", error);
            if (loadingSpinner) loadingSpinner.style.display = 'none';
             // Display specific error message if it's likely an index issue
             let errorMsg = `Failed to load products. ${error.message}`;
             if (error.code === 'failed-precondition' && selectedSort !== 'name_asc' && selectedCategory !== 'all') {
                errorMsg = "Failed to load products. Sorting by price with a category filter might require a composite index in Firestore. Please check the developer console and Firebase settings.";
             }
             productListContainer.innerHTML = `<div class="message-box error" style="grid-column: 1 / -1;"><p>${errorMsg}</p></div>`;
            if (noProductsMessage) noProductsMessage.style.display = 'none';
        }
    };

     // --- populateCategoryFilter Function (Unchanged) ---
    const populateCategoryFilter = async () => {
       // ... (same as previous version) ...
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

            // Keep "All Categories" and add the rest
            categoryFilter.options.length = 1;
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

    // --- Event Listeners for Filters ---
    if (categoryFilter) {
        categoryFilter.addEventListener('change', fetchProducts); // Call fetchProducts on change
    }
    if (sortFilter) {
        sortFilter.addEventListener('change', fetchProducts); // Call fetchProducts on change
    }

    // --- Event Listener for Featured Items ---
    featuredItems.forEach(item => {
        item.addEventListener('click', () => {
            const category = item.dataset.category; // Get category from data attribute
            if (category && categoryFilter) {
                // Find if the category exists in the dropdown
                const categoryExists = Array.from(categoryFilter.options).some(opt => opt.value === category);

                if(categoryExists) {
                    console.log(`Filtering by featured category: ${category}`);
                    categoryFilter.value = category; // Set dropdown value
                    fetchProducts(); // Fetch products for this category (uses current sort setting)
                    // Optionally scroll to the product list
                    // document.getElementById('product-list-container').scrollIntoView({ behavior: 'smooth' });
                } else {
                    console.warn(`Category "${category}" from featured item not found in filter dropdown.`);
                    // Optionally, show all products or an error message
                    categoryFilter.value = 'all';
                    fetchProducts();
                }
            }
        });
    });

     // --- Featured Product Slider Logic (Unchanged from previous version) ---
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
    };
    function initializeSlider(sliderId, images) {
        // ... (same slider initialization code as previous version) ...
         const sliderElement = document.getElementById(sliderId);
        if (!sliderElement || !images || images.length === 0) {
            // console.warn(`Slider element #${sliderId} not found or no images provided.`);
            return;
        }
        sliderElement.innerHTML = ''; // Clear any previous content
        images.forEach((imgUrl, index) => {
            const img = document.createElement('img');
            img.src = imgUrl;
            img.alt = `${sliderId.replace('slider-', '')} image ${index + 1}`;
            if (index === 0) img.classList.add('active');
            sliderElement.appendChild(img);
        });
        let currentSlide = 0;
        const slides = sliderElement.querySelectorAll('img');
        const slideInterval = 3000;
        function nextSlide() {
            if (slides.length > 1) {
                slides[currentSlide].classList.remove('active');
                currentSlide = (currentSlide + 1) % slides.length;
                slides[currentSlide].classList.add('active');
            }
        }
        if (slides.length > 1) {
           setInterval(nextSlide, slideInterval);
        }
    }
    for (const sliderId in featuredSlidersData) {
        initializeSlider(sliderId, featuredSlidersData[sliderId]);
    }
    // --- END of Featured Product Slider Logic ---


    // --- Initial Setup ---
    populateCategoryFilter(); // Populate filter dropdown first
    fetchProducts(); // Fetch products based on initial filter/sort values
});