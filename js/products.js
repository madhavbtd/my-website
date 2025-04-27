// js/products.js
// FINAL UPDATED Version: Server-side Search (Keywords), Pagination, Request Quote

// Import db instance from firebase-config.js
import { db } from './firebase-config.js';

// Import Firestore functions directly from the Firebase SDK
import {
    collection, getDocs, query, where, orderBy, startAfter, limit, getCountFromServer
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
            // Check if it needs to be added or just displayed
            if(show && !productListContainer.contains(loadingSpinner)){
                 productListContainer.appendChild(loadingSpinner); // Add if removed
            }
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

    // --- renderProducts Function ---
    const renderProducts = (products, append = false) => {
        // If not appending and not currently loading (to avoid clearing spinner), clear previous content
        if (!append && !isLoading) {
            productListContainer.innerHTML = '';
        }

        if (!products || products.length === 0) {
            // Only show "no products" if it's a fresh load/filter yielding zero products.
            // Don't show it if appending resulted in zero *new* products but some existed before.
            if (!append) {
                 // If the spinner is the only child, it means no products were rendered yet
                 if (productListContainer.children.length === 0 || (productListContainer.children.length === 1 && productListContainer.contains(loadingSpinner))) {
                     showNoProductsMessage(true);
                 }
            }
            // Hide pagination if no more products were found in this batch
             if (products.length < PRODUCTS_PER_PAGE) {
                showPaginationControls(false);
                allProductsLoaded = true; // Mark as all loaded for this query
            }
            return; // Nothing more to render
        }

        showNoProductsMessage(false); // Hide message if we have products to render

        products.forEach(product => {
            if (!product?.id || !product?.productName) { console.warn("Skipping invalid product:", product); return; }

            const card = document.createElement('div'); card.className = 'product-card'; card.dataset.productId = product.id;
            let imageUrl = product.imageUrls?.[0] || 'images/placeholder.png';
            let priceOrQuoteButtonHTML = ''; const hasPrice = product.pricing && typeof product.pricing.rate === 'number';

            if (hasPrice) {
                 const rate = product.pricing.rate; const unit = product.unit || 'Qty';
                 if (unit.toLowerCase() === 'sq feet') { priceOrQuoteButtonHTML = `<div class="price">From ${formatIndianCurrency(rate)} / sq ft${(product.pricing.minimumOrderValue > 0 ? ` (Min. ${formatIndianCurrency(product.pricing.minimumOrderValue)})` : '')}</div>`; }
                 else { priceOrQuoteButtonHTML = `<div class="price">${formatIndianCurrency(rate)} / ${unit}</div>`; }
            } else { priceOrQuoteButtonHTML = `<a href="contact.html?product_id=${product.id}&product_name=${encodeURIComponent(product.productName || '')}" class="button-secondary request-quote-btn">Request Quote</a>`; }

            const productName = product.productName;
            card.innerHTML = `
                <div class="product-image-container">
                    <a href="product-detail.html?id=${product.id}"> <img src="${imageUrl}" alt="${productName}" loading="lazy" onerror="this.onerror=null; this.src='images/placeholder.png';">
                    </a>
                </div>
                <div class="product-info">
                     <h3><a href="product-detail.html?id=${product.id}">${productName}</a></h3> ${priceOrQuoteButtonHTML}
                    <a href="product-detail.html?id=${product.id}" class="button-primary view-details-btn">View Details</a>
                </div>`;
            productListContainer.appendChild(card);
        });

        // Show pagination only if we fetched a full page, otherwise assume end is reached
        allProductsLoaded = products.length < PRODUCTS_PER_PAGE;
        showPaginationControls(!allProductsLoaded);
    };
    // --- END of renderProducts Function ---


     // --- fetchProducts Function (MODIFIED for Server-Side Search) ---
    const fetchProducts = async (loadMore = false) => {
        if (isLoading) return;
        showLoading(true); // Show spinner

        if (!loadMore) {
             lastVisible = null; // Reset pagination cursor
             allProductsLoaded = false; // Reset loaded flag
             productListContainer.innerHTML = ''; // Clear previous results immediately
              if(loadingSpinner) productListContainer.appendChild(loadingSpinner); // Ensure spinner is inside for clearing
        } else {
            if(loadMoreButton) loadMoreButton.disabled = true; // Disable while loading more
            if(loadingSpinner) loadingSpinner.style.display = 'none'; // Hide main spinner when loading more
        }
        showNoProductsMessage(false); // Hide message initially

        try {
            if (!db) throw new Error("Firestore DB not available.");

            const selectedCategory = categoryFilter ? categoryFilter.value : 'all';
            const selectedSort = sortFilter ? sortFilter.value : 'name_asc';
            const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

            const productsRef = collection(db, "onlineProducts");
            let constraints = [where("isEnabled", "==", true)];

            // Category Filter
            if (selectedCategory !== 'all' && selectedCategory) {
                constraints.push(where("category", "==", selectedCategory));
            }

            // Server-Side Search Filter (Requires 'keywords' array field and index in Firestore)
            if (searchTerm) {
                 console.log(`Applying server-side search for term: ${searchTerm}`);
                 constraints.push(where("keywords", "array-contains", searchTerm));
                 // Note: Complex sorting (like by price) might conflict with 'array-contains'
                 // without a composite index. Prioritize search results accuracy.
            }

            // Sorting (Apply price sort only if NO search term is active, or if composite index exists)
            let addDefaultSort = true;
            if (!searchTerm) { // Apply price sort only when not searching
                if (selectedSort === 'price_asc') {
                    constraints.push(orderBy("pricing.rate", "asc")); addDefaultSort = false;
                } else if (selectedSort === 'price_desc') {
                    constraints.push(orderBy("pricing.rate", "desc")); addDefaultSort = false;
                }
            }
             // Default sort (or sort when searching)
             if(addDefaultSort) {
                 constraints.push(orderBy("productName", "asc"));
             }

            // Pagination
            if (loadMore && lastVisible) {
                 constraints.push(startAfter(lastVisible));
            }
            constraints.push(limit(PRODUCTS_PER_PAGE));

            // Execute Query
            const productQuery = query(productsRef, ...constraints);
            const querySnapshot = await getDocs(productQuery);

            const fetchedProducts = [];
            querySnapshot.forEach((doc) => {
                if (doc.exists() && doc.data().productName) {
                    fetchedProducts.push({ id: doc.id, ...doc.data() });
                } else { console.warn(`Doc ${doc.id} skipped.`); }
            });

            // Update lastVisible for next page
            if (querySnapshot.docs.length > 0) {
                lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
            }

            // Check if this batch was the last one
            allProductsLoaded = querySnapshot.docs.length < PRODUCTS_PER_PAGE;

            // Hide main spinner before rendering
            showLoading(false);
            if (loadingSpinner && loadingSpinner.parentNode === productListContainer) {
                 productListContainer.removeChild(loadingSpinner);
            }

            // Render fetched products
            renderProducts(fetchedProducts, loadMore);

             // Show "No products" message only if it's a fresh load with zero results
             if (!loadMore && fetchedProducts.length === 0) {
                 showNoProductsMessage(true);
             }

             // Update pagination controls visibility
             showPaginationControls(!allProductsLoaded);


        } catch (error) {
            console.error("Error fetching products: ", error);
            showLoading(false); // Hide spinner on error
             if (loadingSpinner && loadingSpinner.parentNode === productListContainer) { productListContainer.removeChild(loadingSpinner); }

             let errorMsg = `Failed to load products. ${error.message}`;
             if (error.code === 'failed-precondition') { errorMsg = "Failed to load products. A database index might be required for the selected filter/sort/search combination. Please check the Firebase console (ensure 'keywords' field is indexed if searching)."; }
             else if (error.code === 'invalid-argument' && searchTerm && selectedSort !== 'name_asc') { errorMsg = "Failed to load products. Sorting by price might not work combined with keyword search without specific database setup."; }

             // Clear container and show error message
             productListContainer.innerHTML = `<div class="message-box error" style="grid-column: 1 / -1;"><p>${errorMsg}</p></div>`;
             showNoProductsMessage(false); // Hide the regular "no products" message
             showPaginationControls(false); // Hide pagination
        } finally {
             isLoading = false;
             if (loadMoreButton) loadMoreButton.disabled = false; // Re-enable button
        }
    };
    // --- END of fetchProducts Function ---


    // --- populateCategoryFilter Function ---
    const populateCategoryFilter = async () => {
        if (!categoryFilter || !db) return;
        try {
            const q = query(collection(db, "onlineProducts"), where("isEnabled", "==", true));
            const snapshot = await getDocs(q); const uniqueCategories = new Set();
            snapshot.forEach(doc => { const cat = doc.data().category; if (cat && typeof cat === 'string') uniqueCategories.add(cat.trim()); });
            const sortedCategories = Array.from(uniqueCategories).sort();
            categoryFilter.options.length = 1;
            sortedCategories.forEach(category => { const option = document.createElement('option'); option.value = category; option.textContent = category; categoryFilter.appendChild(option); });
        } catch (error) { console.error("Error fetching categories:", error); }
    };

    // --- Event Listeners ---
    if (categoryFilter) { categoryFilter.addEventListener('change', () => fetchProducts(false)); }
    if (sortFilter) { sortFilter.addEventListener('change', () => fetchProducts(false)); }
    if (searchButton && searchInput) {
        searchButton.addEventListener('click', () => fetchProducts(false));
        searchInput.addEventListener('keyup', (event) => { if (event.key === 'Enter') fetchProducts(false); });
    }
    if (loadMoreButton) { loadMoreButton.addEventListener('click', () => fetchProducts(true)); }
    // Featured Items Click
    featuredItems.forEach(item => { item.addEventListener('click', () => {
        const category = item.dataset.category; if (!category || !categoryFilter) return;
        const categoryExists = Array.from(categoryFilter.options).some(opt => opt.value === category);
        if(categoryExists) { categoryFilter.value = category; if(searchInput) searchInput.value = ''; fetchProducts(false); document.getElementById('product-list-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        else { console.warn(`Category "${category}" not found.`); categoryFilter.value = 'all'; if(searchInput) searchInput.value = ''; fetchProducts(false); }
    }); });

    // --- Featured Product Slider Logic ---
    const featuredSlidersData = {
        'slider-flex-banner': ['https://i.ibb.co/ZRwV0sx5/2.jpg', 'https://i.ibb.co/1Gxw1pVv/1.jpg', 'https://i.ibb.co/4GYgD4t/3.jpg'],
        'slider-wedding-card': ['https://i.ibb.co/XZDSGBQH/3.jpg', 'https://i.ibb.co/dwkTVrht/2.jpg', 'https://i.ibb.co/xtNQ1wTr/1.jpg']
    };
    function initializeSlider(sliderId, images) {
         const sliderElement = document.getElementById(sliderId); if (!sliderElement || !images?.length) return;
         sliderElement.innerHTML = ''; let currentSlide = 0;
         images.forEach((imgUrl, index) => { const img = document.createElement('img'); img.src = imgUrl; img.alt = `${sliderId.replace('slider-', '')} image ${index + 1}`; img.loading = 'lazy'; if (index === 0) img.classList.add('active'); sliderElement.appendChild(img); });
         const slides = sliderElement.querySelectorAll('img'); const slideInterval = 3500; let intervalId = null;
         function nextSlide() { if (slides.length > 1) { slides[currentSlide].classList.remove('active'); currentSlide = (currentSlide + 1) % slides.length; slides[currentSlide].classList.add('active'); } }
         function startSlider() { if (slides.length > 1 && !intervalId) { intervalId = setInterval(nextSlide, slideInterval); } }
         startSlider(); // Auto-start
    }
    for (const sliderId in featuredSlidersData) { initializeSlider(sliderId, featuredSlidersData[sliderId]); }

    // --- Initial Setup ---
    populateCategoryFilter().then(() => {
        fetchProducts(false); // Initial fetch after categories (might be) populated
    }).catch(error => {
        console.error("Failed initial setup (category population):", error); fetchProducts(false); // Fallback fetch
    });

}); // End DOMContentLoaded