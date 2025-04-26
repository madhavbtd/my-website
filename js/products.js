// js/products.js
// UPDATED Version: Includes Search, Pagination ("Load More"), and "Request Quote" button

// Import db instance from firebase-config.js
import { db } from './firebase-config.js';

// Import Firestore functions directly from the Firebase SDK
import {
    collection, getDocs, query, where, orderBy, startAfter, limit, getCountFromServer
    // Add any other specific Firestore functions you use here
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"; // Use the correct SDK path


document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const productListContainer = document.getElementById('product-list-container');
    const noProductsMessage = document.getElementById('no-products-message');
    const categoryFilter = document.getElementById('category-filter');
    const sortFilter = document.getElementById('sort-filter');
    const loadingSpinner = document.getElementById('loading');
    const featuredItems = document.querySelectorAll('.clickable-featured');
    // New elements from updated HTML
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const paginationContainer = document.getElementById('pagination-container');
    const loadMoreButton = document.getElementById('load-more-button');

    // --- State Variables ---
    let lastVisible = null; // For pagination
    let isLoading = false; // To prevent multiple simultaneous loads
    let allProductsLoaded = false; // To track if all products are loaded
    const PRODUCTS_PER_PAGE = 8; // Number of products to load per page/batch

    // --- Helper Functions ---
    const formatIndianCurrency = (amount) => {
        const num = Number(amount);
        return isNaN(num) || num === null ? 'N/A' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const showLoading = (show) => {
        if (loadingSpinner) {
            loadingSpinner.style.display = show ? 'flex' : 'none';
        }
        isLoading = show;
    };

    const showNoProductsMessage = (show) => {
        if (noProductsMessage) {
            noProductsMessage.style.display = show ? 'block' : 'none';
        }
    };

    const showPaginationControls = (show) => {
         if (paginationContainer) {
             paginationContainer.style.display = show && !allProductsLoaded ? 'block' : 'none';
         }
         if (loadMoreButton) {
            loadMoreButton.disabled = isLoading; // Disable button while loading
         }
    }

    // --- renderProducts Function (MODIFIED for "Request Quote" and Append) ---
    const renderProducts = (products, append = false) => {
        // If not appending, clear previous content (but not the loading spinner itself if it's inside)
        if (!append) {
            productListContainer.innerHTML = ''; // Clear previous cards
             // Ensure loading spinner exists if needed, otherwise add it temporarily
             if (loadingSpinner && loadingSpinner.parentNode !== productListContainer) {
                // This case shouldn't happen often with current HTML structure
             }
        }

        if (!products || products.length === 0) {
            if (!append) { // Only show "no products" if it's not an append operation that yielded zero *new* products
                 showNoProductsMessage(true);
            }
            showPaginationControls(false); // Hide pagination if no products
            return;
        }

        showNoProductsMessage(false); // Hide message if we have products

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

            let priceOrQuoteButtonHTML = '';
            // Check if rate exists and is a valid number or explicitly set to null/undefined
            const hasPrice = product.pricing && typeof product.pricing.rate !== 'undefined' && product.pricing.rate !== null;

            if (hasPrice) {
                 const rate = product.pricing.rate;
                 if (product.unit && typeof product.unit === 'string') {
                     if (product.unit.toLowerCase() === 'sq feet') {
                         priceOrQuoteButtonHTML = `<div class="price">From ${formatIndianCurrency(rate)} / sq ft`;
                         if (typeof product.pricing.minimumOrderValue === 'number' && product.pricing.minimumOrderValue > 0) {
                             priceOrQuoteButtonHTML += ` (Min. ${formatIndianCurrency(product.pricing.minimumOrderValue)})`;
                         }
                         priceOrQuoteButtonHTML += `</div>`;
                     } else {
                         priceOrQuoteButtonHTML = `<div class="price">${formatIndianCurrency(rate)} / ${product.unit}</div>`;
                     }
                 } else {
                     priceOrQuoteButtonHTML = `<div class="price">${formatIndianCurrency(rate)}</div>`;
                 }
            } else {
                // Price not available, show Request Quote button
                priceOrQuoteButtonHTML = `<a href="contact.html?product_id=${product.id}&product_name=${encodeURIComponent(product.productName || '')}" class="button-secondary request-quote-btn">Request Quote</a>`;
            }


            const productName = product.productName || 'Unnamed Product';

            // Updated Card Structure
            card.innerHTML = `
                <div class="product-image-container">
                    <img src="${imageUrl}" alt="${productName}" loading="lazy" onerror="this.onerror=null; this.src='images/placeholder.png';">
                </div>
                <div class="product-info">
                    <h3>${productName}</h3>
                    ${priceOrQuoteButtonHTML}
                    <a href="product-detail.html?id=${product.id}" class="button-primary view-details-btn">View Details</a>
                </div>
            `;
            productListContainer.appendChild(card);
        });

        // Show pagination if needed (and not already determined that all are loaded)
        showPaginationControls(true);
    };
    // --- END of renderProducts Function ---


     // --- fetchProducts Function (MODIFIED for Search, Sorting, Pagination) ---
    const fetchProducts = async (loadMore = false) => {
        if (isLoading) return; // Prevent concurrent fetches
        showLoading(true);
        if (!loadMore) {
             lastVisible = null; // Reset pagination cursor for fresh fetch/filter
             allProductsLoaded = false; // Reset loaded flag
             productListContainer.innerHTML = ''; // Clear previous results immediately
             productListContainer.appendChild(loadingSpinner); // Add spinner back
        } else {
            // For "Load More", disable button temporarily
            if(loadMoreButton) loadMoreButton.disabled = true;
        }

        showNoProductsMessage(false); // Hide message initially

        try {
            if (!db) {
                throw new Error("Firestore database instance is not available.");
            }

            // Get current filter values
            const selectedCategory = categoryFilter ? categoryFilter.value : 'all';
            const selectedSort = sortFilter ? sortFilter.value : 'name_asc';
            const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

            const productsRef = collection(db, "onlineProducts");
            let constraints = [where("isEnabled", "==", true)];

            // Add category filter constraint
            if (selectedCategory !== 'all' && selectedCategory) {
                constraints.push(where("category", "==", selectedCategory));
            }

            // Add sorting constraint
            // IMPORTANT: Composite indexes might be needed in Firebase console.
            switch (selectedSort) {
                case 'price_asc':
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

            // Add pagination constraints
            if (loadMore && lastVisible) {
                 constraints.push(startAfter(lastVisible));
            }
            constraints.push(limit(PRODUCTS_PER_PAGE));


            const productQuery = query(productsRef, ...constraints);
            const querySnapshot = await getDocs(productQuery);

            const fetchedProducts = [];
            querySnapshot.forEach((doc) => {
                if (doc.exists() && doc.data().productName) {
                    fetchedProducts.push({ id: doc.id, ...doc.data() });
                } else {
                    console.warn(`Document ${doc.id} skipped due to missing data or name.`);
                }
            });

            // --- Client-side Search Filtering ---
            let filteredProducts = fetchedProducts;
            if (searchTerm) {
                filteredProducts = fetchedProducts.filter(product =>
                    product.productName.toLowerCase().includes(searchTerm)
                );
                // Note: If client-side search filters out all products from this page,
                // it might seem like there are no more products even if some exist
                // on subsequent pages that *would* match the search. This is a limitation
                // of client-side search with pagination.
            }

            // Update pagination state
            if (querySnapshot.docs.length > 0) {
                lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
            }
            // Determine if all products (matching current filters, before client-side search) have been loaded
            if (querySnapshot.docs.length < PRODUCTS_PER_PAGE) {
                 allProductsLoaded = true;
            }


            // Hide main spinner AFTER potential client-side filtering
            showLoading(false);

            // Render products (append if loadMore is true)
            renderProducts(filteredProducts, loadMore);

            // Update UI state after rendering
             if (!loadMore && filteredProducts.length === 0 && !searchTerm) {
                 showNoProductsMessage(true); // Show "no products" only on initial load if empty
             } else if (filteredProducts.length === 0 && searchTerm) {
                // If search yields no results for this batch, show a specific message maybe?
                // For now, just don't show the main "no products" unless it's the initial load.
             }

             // Show/hide "Load More" button based on whether all products (matching Firestore query) are loaded
             showPaginationControls(!allProductsLoaded);


        } catch (error) {
            console.error("Error fetching/sorting products: ", error);
            showLoading(false);
             // Display specific error message
             let errorMsg = `Failed to load products. Please try again later. ${error.message}`;
             if (error.code === 'failed-precondition' && (selectedSort !== 'name_asc' || selectedCategory !== 'all')) {
                errorMsg = "Failed to load products. Filtering or sorting might require a database index. Please check the Firebase console or contact support.";
             }
             // Display error within the container
             productListContainer.innerHTML = `<div class="message-box error" style="grid-column: 1 / -1;"><p>${errorMsg}</p></div>`;
             showNoProductsMessage(false);
             showPaginationControls(false); // Hide pagination on error
        } finally {
             isLoading = false; // Ensure loading state is reset
             if (loadMoreButton) loadMoreButton.disabled = false; // Re-enable button
        }
    };
    // --- END of fetchProducts Function ---

     // --- populateCategoryFilter Function (Unchanged) ---
    const populateCategoryFilter = async () => {
        if (!categoryFilter || !db) {
            console.log("Category filter element or DB not available.");
            return;
        }
        try {
            // Optimization: Fetch only distinct categories if possible, or cache them.
            // For simplicity, fetching all and using Set is okay for moderate data.
            const categoriesRef = collection(db, "onlineProducts");
            const q = query(categoriesRef, where("isEnabled", "==", true)); // Fetch only enabled products for categories
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
            categoryFilter.options.length = 1; // Clear existing options except the first one
            sortedCategories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categoryFilter.appendChild(option);
            });

        } catch (error) {
            console.error("Error fetching categories:", error);
            // Optionally display an error to the user
        }
    };

    // --- Event Listeners ---

    // Filters
    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => fetchProducts(false)); // False = Trigger fresh load
    }
    if (sortFilter) {
        sortFilter.addEventListener('change', () => fetchProducts(false)); // False = Trigger fresh load
    }

    // Search
    if (searchButton && searchInput) {
        searchButton.addEventListener('click', () => fetchProducts(false)); // False = Trigger fresh load
        searchInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                fetchProducts(false); // False = Trigger fresh load
            }
        });
    }

    // Pagination ("Load More")
    if (loadMoreButton) {
         loadMoreButton.addEventListener('click', () => fetchProducts(true)); // True = Load more
    }

    // Featured Items Click
    featuredItems.forEach(item => {
        item.addEventListener('click', () => {
            const category = item.dataset.category;
            if (category && categoryFilter) {
                const categoryExists = Array.from(categoryFilter.options).some(opt => opt.value === category);

                if(categoryExists) {
                    console.log(`Filtering by featured category: ${category}`);
                    categoryFilter.value = category; // Set dropdown value
                    searchInput.value = ''; // Clear search on featured click
                    fetchProducts(false); // Fetch products for this category (resetting pagination)
                    // Optionally scroll to the product list
                    document.getElementById('product-list-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    console.warn(`Category "${category}" from featured item not found in filter dropdown.`);
                    categoryFilter.value = 'all'; // Reset to all
                    searchInput.value = ''; // Clear search
                    fetchProducts(false); // Fetch all products (resetting pagination)
                }
            }
        });
    });

     // --- Featured Product Slider Logic (Unchanged) ---
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
         const sliderElement = document.getElementById(sliderId);
        if (!sliderElement || !images || images.length === 0) {
            return;
        }
        sliderElement.innerHTML = ''; // Clear any previous content
        images.forEach((imgUrl, index) => {
            const img = document.createElement('img');
            img.src = imgUrl;
            img.alt = `${sliderId.replace('slider-', '')} image ${index + 1}`;
            img.loading = 'lazy'; // Add lazy loading to slider images too
            if (index === 0) img.classList.add('active');
            sliderElement.appendChild(img);
        });
        let currentSlide = 0;
        const slides = sliderElement.querySelectorAll('img');
        const slideInterval = 3500; // Slightly slower maybe
        let intervalId = null;
        function nextSlide() {
            if (slides.length > 1) {
                slides[currentSlide].classList.remove('active');
                currentSlide = (currentSlide + 1) % slides.length;
                slides[currentSlide].classList.add('active');
            }
        }
        function startSlider() {
             if (slides.length > 1 && !intervalId) {
               intervalId = setInterval(nextSlide, slideInterval);
            }
        }
        function stopSlider() {
             clearInterval(intervalId);
             intervalId = null;
        }
         // Start slider initially
         startSlider();
         // Optional: Pause slider on hover
         // sliderElement.addEventListener('mouseenter', stopSlider);
         // sliderElement.addEventListener('mouseleave', startSlider);
    }
    for (const sliderId in featuredSlidersData) {
        initializeSlider(sliderId, featuredSlidersData[sliderId]);
    }
    // --- END of Featured Product Slider Logic ---


    // --- Initial Setup ---
    populateCategoryFilter().then(() => {
        // Fetch initial products only after categories are potentially populated
        fetchProducts(false); // Initial fetch (not loading more)
    }).catch(error => {
        console.error("Failed initial setup:", error);
        // Fallback if category population fails, still try to fetch products
        fetchProducts(false);
    });

}); // End DOMContentLoaded