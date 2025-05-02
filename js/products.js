// js/products.js
// FINAL UPDATED Version: Fixes Category Filter, Uses productName Search, Includes User's Featured Slider Images

// Import db instance from firebase-config.js
import { db } from './firebase-config.js';

// Import Firestore functions
import {
    collection, getDocs, query, where, orderBy, startAfter, limit
    // Note: Removed getCountFromServer as it wasn't used in the final fetch logic
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const productListContainer = document.getElementById('product-list-container');
    const noProductsMessage = document.getElementById('no-products-message');
    const categoryFilter = document.getElementById('category-filter');
    const sortFilter = document.getElementById('sort-filter');
    const loadingSpinner = document.getElementById('loading');
    const featuredItems = document.querySelectorAll('.clickable-featured');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const paginationContainer = document.getElementById('pagination-container');
    const loadMoreButton = document.getElementById('load-more-button');

    // --- State Variables ---
    let lastVisible = null;
    let isLoading = false;
    let allProductsLoaded = false;
    const PRODUCTS_PER_PAGE = 8; // Adjust as needed

    // --- Helper Functions ---
    const formatIndianCurrency = (amount) => {
        const num = Number(amount);
        return isNaN(num) || num === null ? 'N/A' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
     };
    const showLoading = (show) => {
        if (loadingSpinner) {
             // Only append spinner if it's not already there
             if(show && !productListContainer.contains(loadingSpinner)){
                 productListContainer.appendChild(loadingSpinner);
             }
             loadingSpinner.style.display = show ? 'flex' : 'none';
        }
        isLoading = show;
    };
    const showNoProductsMessage = (show) => {
        if (noProductsMessage) { noProductsMessage.style.display = show ? 'block' : 'none'; }
     };
    const showPaginationControls = (show) => {
         if (paginationContainer) { paginationContainer.style.display = show && !allProductsLoaded ? 'block' : 'none'; }
         if (loadMoreButton) { loadMoreButton.disabled = isLoading; }
    };

    // --- renderProducts Function (Includes Average Price Logic from previous version) ---
    const renderProducts = (products, append = false) => {
        if (!append && !isLoading) {
             // Clear only product cards, keep the spinner if it's there initially
             Array.from(productListContainer.children).forEach(child => {
                 if (!child.classList.contains('loading-spinner')) {
                     productListContainer.removeChild(child);
                 }
             });
        }

        if (!products || products.length === 0) {
            // Show 'no products' only if not appending and container is empty (or just has spinner)
            if (!append && (productListContainer.children.length === 0 || (productListContainer.children.length === 1 && productListContainer.contains(loadingSpinner)))) {
                showNoProductsMessage(true);
            }
            // Check if fewer products than page size were loaded
            if (products.length < PRODUCTS_PER_PAGE) {
                allProductsLoaded = true; // Mark all as loaded
            }
            showPaginationControls(!allProductsLoaded); // Update pagination visibility
            return;
        }
        showNoProductsMessage(false);

        products.forEach(product => {
            if (!product?.id || !product?.productName) { console.warn("Skipping invalid product:", product); return; }

            const card = document.createElement('div');
            card.className = 'product-card';
            card.dataset.productId = product.id;

            let imageUrl = product.imageUrls?.[0] || 'images/placeholder.png'; // Default placeholder
            let priceOrQuoteButtonHTML = '';
            const productName = product.productName;
            const category = product.category || '';
            const pricing = product.pricing;
            const options = product.options;

            // --- START: Custom Average Price Logic (Option A: Including Margin) ---
            // (Copied from original user code - Verify if still needed/correct)
             let calculateAveragePrice = false;
             if (category.toLowerCase().includes('wedding') && // Adjust category check if needed
                 pricing && typeof pricing.rate === 'number' &&
                 typeof pricing.extraMarginPercent === 'number' && // Ensure margin exists
                 options && Array.isArray(options)) {
                  calculateAveragePrice = true;
             }

             if (calculateAveragePrice) {
                 try {
                     const quantityOption = options.find(opt => opt?.name?.toLowerCase() === 'quantity');
                     const quantityValues = quantityOption?.values;

                     if (quantityValues && Array.isArray(quantityValues) && quantityValues.length > 0) {
                         const numericQuantities = quantityValues.map(val => parseInt(val, 10)).filter(num => !isNaN(num));
                         if (numericQuantities.length > 0) {
                             const largestQty = Math.max(...numericQuantities);
                             const baseRate = pricing.rate;
                             const designCharge = Number(pricing.designCharge || 0);
                             const printingChargeBase = Number(pricing.printingChargeBase || 0);
                             const transportCharge = Number(pricing.transportCharge || 0);
                             const extraMarginPercent = Number(pricing.extraMarginPercent);
                             const totalFixedCharges = designCharge + printingChargeBase + transportCharge;

                             if (largestQty > 0) {
                                 const subTotal = (baseRate * largestQty) + totalFixedCharges;
                                 const finalTotalCost = subTotal * (1 + (extraMarginPercent / 100));
                                 const averagePrice = finalTotalCost / largestQty;
                                 priceOrQuoteButtonHTML = `<div class="price">${formatIndianCurrency(averagePrice)} / Qty</div>`;
                             } else { calculateAveragePrice = false; } // Fallback
                         } else { calculateAveragePrice = false; } // Fallback
                     } else { calculateAveragePrice = false; } // Fallback
                 } catch (calcError) { console.error(`Error calculating avg price for ${product.id}:`, calcError); calculateAveragePrice = false; } // Fallback
             }
             // --- END: Custom Average Price Logic ---


             // --- Fallback/Default Price Logic ---
             if (!calculateAveragePrice) {
                  const hasPrice = pricing && typeof pricing.rate === 'number';
                  if (hasPrice) {
                     const rate = pricing.rate;
                     const unit = product.unit || 'Qty';
                     if (unit.toLowerCase() === 'sq feet') {
                         priceOrQuoteButtonHTML = `<div class="price">From ${formatIndianCurrency(rate)} / sq ft${(pricing.minimumOrderValue > 0 ? ` (Min. ${formatIndianCurrency(pricing.minimumOrderValue)})` : '')}</div>`;
                     }
                     else {
                         priceOrQuoteButtonHTML = `<div class="price">${formatIndianCurrency(rate)} / ${unit}</div>`;
                     }
                  } else {
                      // Use standard secondary button style for Request Quote
                      priceOrQuoteButtonHTML = `<a href="contact.html?product_id=${product.id}&product_name=${encodeURIComponent(productName)}" class="button-secondary request-quote-btn">Request Quote</a>`;
                  }
             }
             // --- END: Fallback/Default Price Logic ---

            card.innerHTML = `
                <div class="product-image-container">
                    <a href="product-detail.html?id=${product.id}"> <img src="${imageUrl}" alt="${productName}" loading="lazy" onerror="this.onerror=null; this.src='images/placeholder.png'; this.alt='Image not available';"> </a>
                </div>
                <div class="product-info">
                     <h3><a href="product-detail.html?id=${product.id}">${productName}</a></h3>
                    ${priceOrQuoteButtonHTML}
                    <a href="product-detail.html?id=${product.id}" class="button-primary view-details-btn">View Details</a>
                </div>`;

            // Append the card before the loading spinner if it exists
            if (loadingSpinner && productListContainer.contains(loadingSpinner)) {
                productListContainer.insertBefore(card, loadingSpinner);
            } else {
                productListContainer.appendChild(card);
            }
        });

        // Update allProductsLoaded status AFTER processing the fetched products
        allProductsLoaded = products.length < PRODUCTS_PER_PAGE;
        showPaginationControls(!allProductsLoaded); // Show/hide based on updated status

    }; // --- END of renderProducts Function ---


    // --- fetchProducts Function (MODIFIED for "Starts With" Search on productName_lowercase) ---
    const fetchProducts = async (loadMore = false) => {
        if (isLoading) return;
        showLoading(true); // Show spinner immediately

        if (!loadMore) {
            lastVisible = null;
            allProductsLoaded = false;
            // Clear previous products when not loading more
            Array.from(productListContainer.children).forEach(child => {
                 if (!child.classList.contains('loading-spinner')) {
                     productListContainer.removeChild(child);
                 }
             });
            // Ensure spinner is visible if container was emptied
             if(loadingSpinner && !productListContainer.contains(loadingSpinner)){
                  productListContainer.appendChild(loadingSpinner);
             }
             if(loadingSpinner) loadingSpinner.style.display = 'flex';

        } else {
            if(loadMoreButton) loadMoreButton.disabled = true; // Disable button while loading more
            // Keep spinner hidden when loading more, products are appended
             if(loadingSpinner) loadingSpinner.style.display = 'none';
        }
        showNoProductsMessage(false); // Hide no products message initially

        try {
            if (!db) throw new Error("Firestore DB not available.");
            const selectedCategory = categoryFilter ? categoryFilter.value : 'all';
            const selectedSort = sortFilter ? sortFilter.value : 'name_asc';
            const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : ''; // Search term in lowercase

            const productsRef = collection(db, "onlineProducts");
            let constraints = [where("isEnabled", "==", true)];

            if (selectedCategory !== 'all' && selectedCategory) {
                constraints.push(where("category", "==", selectedCategory));
            }

            // --- SEARCH LOGIC MODIFICATION ---
            if (searchTerm) {
                // Use 'productName_lowercase' "starts with" search
                constraints.push(where("productName_lowercase", ">=", searchTerm));
                constraints.push(where("productName_lowercase", "<=", searchTerm + '\uf8ff'));
            }
            // --- END OF SEARCH LOGIC MODIFICATION ---

            // --- SORT LOGIC ADJUSTMENT ---
            let addDefaultSort = true;
             if (searchTerm) {
                 // Inequality field (productName_lowercase) must be the first orderBy when searching
                 constraints.push(orderBy("productName_lowercase", "asc"));
                 addDefaultSort = false; // Default sort applied
                 // Note: Sorting by price might not work reliably with search without specific composite indexes
                 if (selectedSort === 'price_asc') { console.warn("Sorting by price ASC while searching might require specific index."); }
                 else if (selectedSort === 'price_desc') { console.warn("Sorting by price DESC while searching might require specific index."); }

             } else {
                 // Sorting logic when not searching
                 if (selectedSort === 'price_asc') { constraints.push(orderBy("pricing.rate", "asc")); addDefaultSort = false; }
                 else if (selectedSort === 'price_desc') { constraints.push(orderBy("pricing.rate", "desc")); addDefaultSort = false; }
             }
             // Add default sort by name if no other sort is applied and not searching
             if (addDefaultSort) {
                 constraints.push(orderBy("productName", "asc")); // Default sort
             }
            // --- END OF SORT LOGIC ADJUSTMENT ---

            if (loadMore && lastVisible) {
                constraints.push(startAfter(lastVisible));
            }
            constraints.push(limit(PRODUCTS_PER_PAGE));

            const productQuery = query(productsRef, ...constraints);
            console.log("Executing query with constraints:", constraints); // Log constraints for debugging
            const querySnapshot = await getDocs(productQuery);
            const fetchedProducts = [];

            querySnapshot.forEach((doc) => {
                 if (doc.exists() && doc.data().productName) {
                     fetchedProducts.push({ id: doc.id, ...doc.data() });
                 } else {
                     console.warn(`Document ${doc.id} skipped (maybe missing productName?).`);
                 }
            });

            console.log(`Fetched ${fetchedProducts.length} products.`);

            if (querySnapshot.docs.length > 0) {
                lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
            }

            showLoading(false); // Hide spinner after fetching
            // Ensure spinner is removed AFTER rendering or if no products found
            if (loadingSpinner && loadingSpinner.parentNode === productListContainer) {
                 productListContainer.removeChild(loadingSpinner);
            }

            renderProducts(fetchedProducts, loadMore);

            // Show 'no products' only if it's not 'load more' and nothing was found AND spinner is removed
            if (!loadMore && fetchedProducts.length === 0 && !productListContainer.querySelector('.product-card')) {
                showNoProductsMessage(true);
            }
            // Ensure pagination controls reflect the final 'allProductsLoaded' status correctly
            showPaginationControls(!allProductsLoaded);

        } catch (error) {
            console.error("Error fetching products: ", error);
            showLoading(false); // Hide spinner on error
             if (loadingSpinner && loadingSpinner.parentNode === productListContainer) {
                 productListContainer.removeChild(loadingSpinner); // Remove spinner on error
             }
            let errorMsg = `Failed to load products. ${error.message}`;
            // Specific error messages based on codes
            if (error.code === 'failed-precondition') {
                 errorMsg = "Failed to load products. A database index might be required. Please check Firestore console for index suggestions related to your query (especially involving category, isEnabled, productName_lowercase, and pricing.rate).";
             } else if (error.code === 'invalid-argument') {
                 errorMsg = "Failed to load products due to an invalid argument. Check query constraints.";
             }
            // Display error message in the product list area
            productListContainer.innerHTML = `<div class="message-box error" style="grid-column: 1 / -1;"><p>${errorMsg}</p></div>`;
            showNoProductsMessage(false); // Hide the standard 'no products' message
            showPaginationControls(false); // Hide pagination on error
             allProductsLoaded = true; // Prevent further loading attempts on error

        } finally {
            isLoading = false; // Reset loading flag
            if (loadMoreButton) loadMoreButton.disabled = false; // Re-enable button
        }
    }; // --- END of fetchProducts Function ---


    // --- populateCategoryFilter Function (IMPLEMENTED) ---
    const populateCategoryFilter = async () => {
        if (!db || !categoryFilter) {
            console.warn("DB or Category Filter element not found.");
            return;
         }

        try {
            console.log("Populating category filter...");
            const productsRef = collection(db, "onlineProducts");
            const categoryQuery = query(productsRef, where("isEnabled", "==", true)); // Fetch categories from enabled products
            const querySnapshot = await getDocs(categoryQuery);

            const categories = new Set(); // Use Set for automatic uniqueness
            querySnapshot.forEach((doc) => {
                const productData = doc.data();
                // Ensure category exists and is a non-empty string
                if (productData.category && typeof productData.category === 'string' && productData.category.trim()) {
                    categories.add(productData.category.trim());
                }
            });

            // Clear existing options except the first one ("All Categories")
            categoryFilter.innerHTML = '<option value="all">All Categories</option>';

            const sortedCategories = Array.from(categories).sort(); // Sort alphabetically
            sortedCategories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category; // Text displayed in the dropdown
                categoryFilter.appendChild(option);
            });
            console.log("Categories populated:", sortedCategories);

        } catch (error) {
            console.error("Error populating category filter: ", error);
            categoryFilter.innerHTML = '<option value="all">Error loading categories</option>'; // Show error in dropdown
        }
    }; // --- END of populateCategoryFilter ---


    // --- Event Listeners ---
    if (categoryFilter) { categoryFilter.addEventListener('change', () => fetchProducts(false)); }
    if (sortFilter) { sortFilter.addEventListener('change', () => fetchProducts(false)); }
    if (searchButton && searchInput) {
        searchButton.addEventListener('click', () => fetchProducts(false));
        searchInput.addEventListener('keyup', (event) => {
             if (event.key === 'Enter') {
                  fetchProducts(false);
             }
        });
        // Optional: Clear search on 'x' button click (if browser supports it)
        searchInput.addEventListener('search', () => {
             // Fetch products when the search input is cleared using the 'x' button
             if (!searchInput.value) {
                 fetchProducts(false);
             }
        });
    }
    if (loadMoreButton) { loadMoreButton.addEventListener('click', () => fetchProducts(true)); }

    // Click listener for Featured Items (Copied from original - Verify functionality)
    if (featuredItems) {
         featuredItems.forEach(item => {
             item.addEventListener('click', () => {
                 const category = item.dataset.category;
                 if (category && categoryFilter) {
                    // Check if category exists in the filter before setting it
                     const categoryExists = Array.from(categoryFilter.options).some(opt => opt.value === category);
                     if (categoryExists) {
                          categoryFilter.value = category; // Set dropdown value
                          fetchProducts(false); // Fetch products for this category
                          // Optional: Scroll to product list
                          document.getElementById('product-list-container')?.scrollIntoView({ behavior: 'smooth' });
                     } else {
                         console.warn(`Featured item category "${category}" not found in filter dropdown. Fetching all.`);
                         categoryFilter.value = 'all'; // Reset to all
                         fetchProducts(false);
                     }
                 }
             });
         });
    }


    // --- Featured Product Slider Logic (IMPLEMENTED with User's Links) ---

    // 1. Define the images for each slider using links from user's file
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

    // 2. Implement the function to initialize a slider
    function initializeSlider(sliderId, images) {
        const sliderElement = document.getElementById(sliderId);
        if (!sliderElement || !images || images.length === 0) {
            console.warn(`Slider element #${sliderId} not found or no images provided.`);
            if(sliderElement) sliderElement.innerHTML = '<p style="text-align:center; padding: 20px; color: #888;">Images coming soon!</p>';
            return;
        }

        sliderElement.innerHTML = ''; // Clear previous content
        let currentImageIndex = 0;

        images.forEach((imgSrc, index) => {
            const img = document.createElement('img');
            img.src = imgSrc;
            img.alt = `${sliderId.replace('slider-', '')} featured image ${index + 1}`;
            img.loading = 'lazy'; // Improve performance
            img.onerror = function() { // Handle image loading errors
                 this.onerror=null;
                 this.alt='Image not available';
                 // Provide a fallback placeholder image if needed
                 this.src='images/placeholder.png';
                 console.error(`Failed to load slider image: ${imgSrc}`);
            };
            if (index === 0) {
                img.classList.add('active'); // Show first image
            }
            sliderElement.appendChild(img);
        });

        // Function to switch to the next image
        const showNextImage = () => {
            const allImages = sliderElement.querySelectorAll('img');
            if (allImages.length <= 1) return; // Stop if only one image or no images

            allImages[currentImageIndex].classList.remove('active');
            currentImageIndex = (currentImageIndex + 1) % allImages.length;
            allImages[currentImageIndex].classList.add('active');
        };

        // Change image every 3 seconds (3000 milliseconds)
        setInterval(showNextImage, 3000);
    }

    // 3. Initialize all sliders defined in featuredSlidersData
    console.log("Initializing featured sliders...");
    for (const sliderId in featuredSlidersData) {
        initializeSlider(sliderId, featuredSlidersData[sliderId]);
    }
    console.log("Featured sliders initialization attempted.");
    // --- END of Featured Slider Logic ---


    // --- Initial Setup ---
    // Populate categories first, then fetch initial products
    populateCategoryFilter().then(() => {
        console.log("Initial product fetch after categories populated.");
        fetchProducts(false); // Fetch initial products (all categories, default sort)
    }).catch(error => {
        console.error("Failed initial category population:", error);
        // Still try to fetch products even if categories fail to load
        console.log("Attempting initial product fetch despite category error.");
        fetchProducts(false);
    });

}); // End DOMContentLoaded