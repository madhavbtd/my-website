// js/products.js
// FINAL Version: Includes Server-side Search (Keywords), Pagination, Request Quote,
// Custom Average Price Calculation (Approx Note REMOVED)

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
    let lastVisible = null;
    let isLoading = false;
    let allProductsLoaded = false;
    const PRODUCTS_PER_PAGE = 8;

    // --- Helper Functions ---
    const formatIndianCurrency = (amount) => {
        const num = Number(amount);
        return isNaN(num) || num === null ? 'N/A' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };
    const showLoading = (show) => {
        if (loadingSpinner) {
            if(show && !productListContainer.contains(loadingSpinner)){ productListContainer.appendChild(loadingSpinner); }
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

    // --- renderProducts Function (MODIFIED - Approx Note Removed) ---
    const renderProducts = (products, append = false) => {
        if (!append && !isLoading) { productListContainer.innerHTML = ''; }

        if (!products || products.length === 0) {
            if (!append) {
                 if (productListContainer.children.length === 0 || (productListContainer.children.length === 1 && productListContainer.contains(loadingSpinner))) {
                     showNoProductsMessage(true);
                 }
            }
            if (products.length < PRODUCTS_PER_PAGE) { showPaginationControls(false); allProductsLoaded = true; }
            return;
        }
        showNoProductsMessage(false);

        products.forEach(product => {
            if (!product?.id || !product?.productName) { console.warn("Skipping invalid product:", product); return; }

            const card = document.createElement('div'); card.className = 'product-card'; card.dataset.productId = product.id;
            let imageUrl = product.imageUrls?.[0] || 'images/placeholder.png';
            let priceOrQuoteButtonHTML = '';
            const productName = product.productName;
            const category = product.category || '';
            const pricing = product.pricing;
            const options = product.options;

            let calculateAveragePrice = false;
            if (category.toLowerCase().includes('wedding') && pricing && typeof pricing.rate === 'number' && options && Array.isArray(options)) {
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
                            const totalFixedCharges = designCharge + printingChargeBase + transportCharge;

                            if (largestQty > 0) {
                                const totalCost = (baseRate * largestQty) + totalFixedCharges;
                                const averagePrice = totalCost / largestQty;

                                // बदला हुआ: (Approx @...) वाला नोट हटा दिया गया
                                priceOrQuoteButtonHTML = `<div class="price">${formatIndianCurrency(averagePrice)} / Qty</div>`;

                            } else { calculateAveragePrice = false; } // Fallback
                        } else { calculateAveragePrice = false; } // Fallback
                    } else { calculateAveragePrice = false; } // Fallback
                } catch (calcError) { console.error(`Error calculating avg price for ${product.id}:`, calcError); calculateAveragePrice = false; } // Fallback
            }

            // Fallback/Default Price Logic
            if (!calculateAveragePrice) {
                 const hasPrice = pricing && typeof pricing.rate === 'number';
                 if (hasPrice) {
                    const rate = pricing.rate; const unit = product.unit || 'Qty';
                    if (unit.toLowerCase() === 'sq feet') { priceOrQuoteButtonHTML = `<div class="price">From ${formatIndianCurrency(rate)} / sq ft${(pricing.minimumOrderValue > 0 ? ` (Min. ${formatIndianCurrency(pricing.minimumOrderValue)})` : '')}</div>`; }
                    else { priceOrQuoteButtonHTML = `<div class="price">${formatIndianCurrency(rate)} / ${unit}</div>`; }
                 } else { priceOrQuoteButtonHTML = `<a href="contact.html?product_id=${product.id}&product_name=${encodeURIComponent(productName)}" class="button-secondary request-quote-btn">Request Quote</a>`; }
            }

            card.innerHTML = `
                <div class="product-image-container">
                    <a href="product-detail.html?id=${product.id}">
                        <img src="${imageUrl}" alt="${productName}" loading="lazy" onerror="this.onerror=null; this.src='images/placeholder.png';">
                    </a>
                </div>
                <div class="product-info">
                     <h3><a href="product-detail.html?id=${product.id}">${productName}</a></h3>
                    ${priceOrQuoteButtonHTML}
                    <a href="product-detail.html?id=${product.id}" class="button-primary view-details-btn">View Details</a>
                </div>`;
            productListContainer.appendChild(card);
        });

        allProductsLoaded = products.length < PRODUCTS_PER_PAGE;
        showPaginationControls(!allProductsLoaded);
    };
    // --- END of renderProducts Function ---


    // --- fetchProducts Function (Server-Side Search Logic) ---
    const fetchProducts = async (loadMore = false) => {
        if (isLoading) return; showLoading(true);
        if (!loadMore) { lastVisible = null; allProductsLoaded = false; productListContainer.innerHTML = ''; if(loadingSpinner) productListContainer.appendChild(loadingSpinner); }
        else { if(loadMoreButton) loadMoreButton.disabled = true; if(loadingSpinner) loadingSpinner.style.display = 'none'; }
        showNoProductsMessage(false);
        try {
            if (!db) throw new Error("Firestore DB not available.");
            const selectedCategory = categoryFilter ? categoryFilter.value : 'all'; const selectedSort = sortFilter ? sortFilter.value : 'name_asc'; const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
            const productsRef = collection(db, "onlineProducts"); let constraints = [where("isEnabled", "==", true)];
            if (selectedCategory !== 'all' && selectedCategory) { constraints.push(where("category", "==", selectedCategory)); }
            if (searchTerm) { constraints.push(where("keywords", "array-contains", searchTerm)); }
            let addDefaultSort = true; if (!searchTerm) { if (selectedSort === 'price_asc') { constraints.push(orderBy("pricing.rate", "asc")); addDefaultSort = false; } else if (selectedSort === 'price_desc') { constraints.push(orderBy("pricing.rate", "desc")); addDefaultSort = false; } } if(addDefaultSort) { constraints.push(orderBy("productName", "asc")); }
            if (loadMore && lastVisible) { constraints.push(startAfter(lastVisible)); } constraints.push(limit(PRODUCTS_PER_PAGE));
            const productQuery = query(productsRef, ...constraints); const querySnapshot = await getDocs(productQuery); const fetchedProducts = [];
            querySnapshot.forEach((doc) => { if (doc.exists() && doc.data().productName) { fetchedProducts.push({ id: doc.id, ...doc.data() }); } else { console.warn(`Doc ${doc.id} skipped.`); } });
            if (querySnapshot.docs.length > 0) { lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1]; } allProductsLoaded = querySnapshot.docs.length < PRODUCTS_PER_PAGE;
            showLoading(false); if (loadingSpinner && loadingSpinner.parentNode === productListContainer) { productListContainer.removeChild(loadingSpinner); }
            renderProducts(fetchedProducts, loadMore);
            if (!loadMore && fetchedProducts.length === 0) { showNoProductsMessage(true); } showPaginationControls(!allProductsLoaded);
        } catch (error) {
            console.error("Error fetching products: ", error); showLoading(false); if (loadingSpinner && loadingSpinner.parentNode === productListContainer) { productListContainer.removeChild(loadingSpinner); }
            let errorMsg = `Failed to load products. ${error.message}`; if (error.code === 'failed-precondition') { errorMsg = "Failed to load products. A database index might be required (check 'keywords' field index if searching)."; } else if (error.code === 'invalid-argument' && searchTerm && selectedSort !== 'name_asc') { errorMsg = "Sorting by price might not work with keyword search without specific database setup."; }
            productListContainer.innerHTML = `<div class="message-box error" style="grid-column: 1 / -1;"><p>${errorMsg}</p></div>`; showNoProductsMessage(false); showPaginationControls(false);
        } finally { isLoading = false; if (loadMoreButton) loadMoreButton.disabled = false; }
    }; // --- END of fetchProducts Function ---

    // --- populateCategoryFilter Function ---
    const populateCategoryFilter = async () => {
        if (!categoryFilter || !db) return;
        try {
            const q = query(collection(db, "onlineProducts"), where("isEnabled", "==", true)); const snapshot = await getDocs(q); const uniqueCategories = new Set();
            snapshot.forEach(doc => { const cat = doc.data().category; if (cat && typeof cat === 'string') uniqueCategories.add(cat.trim()); });
            const sortedCategories = Array.from(uniqueCategories).sort(); categoryFilter.options.length = 1;
            sortedCategories.forEach(category => { const option = document.createElement('option'); option.value = category; option.textContent = category; categoryFilter.appendChild(option); });
        } catch (error) { console.error("Error fetching categories:", error); }
    };

    // --- Event Listeners ---
    if (categoryFilter) { categoryFilter.addEventListener('change', () => fetchProducts(false)); }
    if (sortFilter) { sortFilter.addEventListener('change', () => fetchProducts(false)); }
    if (searchButton && searchInput) { searchButton.addEventListener('click', () => fetchProducts(false)); searchInput.addEventListener('keyup', (event) => { if (event.key === 'Enter') fetchProducts(false); }); }
    if (loadMoreButton) { loadMoreButton.addEventListener('click', () => fetchProducts(true)); }
    featuredItems.forEach(item => { item.addEventListener('click', () => { const category = item.dataset.category; if (!category || !categoryFilter) return; const categoryExists = Array.from(categoryFilter.options).some(opt => opt.value === category); if(categoryExists) { categoryFilter.value = category; if(searchInput) searchInput.value = ''; fetchProducts(false); document.getElementById('product-list-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } else { console.warn(`Category "${category}" not found.`); categoryFilter.value = 'all'; if(searchInput) searchInput.value = ''; fetchProducts(false); } }); });

    // --- Featured Product Slider Logic ---
    const featuredSlidersData = { 'slider-flex-banner': ['https://i.ibb.co/ZRwV0sx5/2.jpg', 'https://i.ibb.co/1Gxw1pVv/1.jpg', 'https://i.ibb.co/4GYgD4t/3.jpg'], 'slider-wedding-card': ['https://i.ibb.co/XZDSGBQH/3.jpg', 'https://i.ibb.co/dwkTVrht/2.jpg', 'https://i.ibb.co/xtNQ1wTr/1.jpg'] };
    function initializeSlider(sliderId, images) { const sliderElement = document.getElementById(sliderId); if (!sliderElement || !images?.length) return; sliderElement.innerHTML = ''; let currentSlide = 0; images.forEach((imgUrl, index) => { const img = document.createElement('img'); img.src = imgUrl; img.alt = `${sliderId.replace('slider-', '')} image ${index + 1}`; img.loading = 'lazy'; if (index === 0) img.classList.add('active'); sliderElement.appendChild(img); }); const slides = sliderElement.querySelectorAll('img'); const slideInterval = 3500; let intervalId = null; function nextSlide() { if (slides.length > 1) { slides[currentSlide].classList.remove('active'); currentSlide = (currentSlide + 1) % slides.length; slides[currentSlide].classList.add('active'); } } function startSlider() { if (slides.length > 1 && !intervalId) { intervalId = setInterval(nextSlide, slideInterval); } } startSlider(); }
    for (const sliderId in featuredSlidersData) { initializeSlider(sliderId, featuredSlidersData[sliderId]); }

    // --- Initial Setup ---
    populateCategoryFilter().then(() => { fetchProducts(false); }).catch(error => { console.error("Failed initial setup:", error); fetchProducts(false); });

}); // End DOMContentLoaded