// js/home.js - Homepage Specific JavaScript

// --- Firebase Imports ---
import { db } from './firebase-config.js';
import { collection, query, where, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Helper Function: Format Currency ---
const formatIndianCurrency = (amount) => {
    const num = Number(amount);
    // Basic check for NaN, null, or 0. Adjust if 0 price is valid.
    if (isNaN(num) || num === null || amount === '' || amount === undefined) {
        return 'Contact for Price';
    }
    // Handle potential case where price is 0
    if (num === 0) {
         return 'Contact for Price'; // Or '₹ 0.00' if you want to show zero
    }
    return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// --- Render Function: Create HTML for one product card slide ---
const renderFeaturedProductCard = (product) => {
    if (!product || !product.id || !product.productName) {
        console.warn("Skipping rendering product card due to missing data:", product);
        return ''; // Return empty string if essential data is missing
    }
    const imageUrl = (product.imageUrls && product.imageUrls[0]) ? product.imageUrls[0] : 'images/placeholder.png';
    const productName = product.productName;
    const productUrl = `product-detail.html?id=${product.id}`;

    // Determine Price HTML more robustly
    let priceHTML = 'Contact for Price'; // Default
    if (product.pricing && typeof product.pricing.rate !== 'undefined' && product.pricing.rate !== null) {
        const rate = parseFloat(product.pricing.rate);
        const unit = product.unit || 'Qty'; // Default unit
        const minOrder = product.pricing.minimumOrderValue;

        if (!isNaN(rate) && rate > 0) { // Only format if rate is a positive number
             const formattedPrice = formatIndianCurrency(rate);
            if (unit.toLowerCase() === 'sq feet' || unit.toLowerCase() === 'sq ft') {
                priceHTML = `From ${formattedPrice} / sq ft`;
                 if (minOrder && parseFloat(minOrder) > 0) {
                    priceHTML += ` (Min. ${formatIndianCurrency(minOrder)})`;
                }
            } else {
                priceHTML = `${formattedPrice} / ${unit}`;
                 // Add minimum order info for non-sqft too if applicable
                 if (minOrder && parseFloat(minOrder) > 0 && unit.toLowerCase() !== 'qty' && unit.toLowerCase() !== 'piece') {
                    // Example: Only show min order if unit is not standard quantity/piece
                    // priceHTML += ` (Min. Order: ${formatIndianCurrency(minOrder)})`; // Decide if needed
                 }
            }
        }
    }

    // Fallback image logic
    const fallbackImage = 'images/placeholder.png';
    const imageErrorLogic = `this.onerror=null; this.src='${fallbackImage}'; this.alt='Image not available';`;

    return `
        <div class="swiper-slide">
            <div class="product-card">
                <div class="product-image-container">
                    <a href="${productUrl}">
                        <img src="${imageUrl}" alt="${productName}" loading="lazy" onerror="${imageErrorLogic}">
                    </a>
                </div>
                <div class="product-info">
                    <h3><a href="${productUrl}">${productName}</a></h3>
                    <div class="price">${priceHTML}</div>
                    <a href="${productUrl}" class="button-primary view-details-btn">View Details</a>
                </div>
            </div>
        </div>`;
};

// --- Async Function: Fetch and Render FIRST Row of Featured Products ---
async function loadAndRenderFeaturedProducts() {
    const container = document.getElementById('featured-product-cards-container');
    if (!container) { console.error("Container #featured-product-cards-container not found."); return { success: false, productsCount: 0 }; }

    try {
        // Query for first row (e.g., order by name ascending)
        const q = query(collection(db, "onlineProducts"), where("isEnabled", "==", true), orderBy("productName"), limit(8));
        const querySnapshot = await getDocs(q);
        let productsHTML = '';
        let count = 0;

        if (querySnapshot.empty) {
            productsHTML = '<div class="swiper-slide" style="width:100%; text-align:center; padding:50px 0;"><p style="color: var(--text-muted);">No featured products available.</p></div>';
        } else {
            querySnapshot.forEach((doc) => {
                productsHTML += renderFeaturedProductCard({ id: doc.id, ...doc.data() });
                count++;
            });
        }
        container.innerHTML = productsHTML;
        return { success: true, productsCount: count };
    } catch (error) {
        console.error("Error loading first row of featured products:", error);
        container.innerHTML = '<div class="swiper-slide" style="width:100%; text-align:center; padding:50px 0;"><p style="color: red;">Error loading products.</p></div>';
        return { success: false, productsCount: 0 };
    }
}

// --- Async Function: Fetch and Render SECOND Row of Featured Products ---
async function loadAndRenderMoreFeaturedProducts() {
    const container = document.getElementById('more-featured-product-cards-container');
    if (!container) { console.error("Container #more-featured-product-cards-container not found."); return { success: false, productsCount: 0 }; }

    try {
        // Query for second row (e.g., order by name descending, or use other criteria like 'dateAdded')
        // IMPORTANT: Ensure this query actually fetches DIFFERENT products if desired.
        // Using 'productName', 'desc' is just an example. You might need another field or logic.
        const q = query(collection(db, "onlineProducts"), where("isEnabled", "==", true), orderBy("productName", "desc"), limit(8));
        const querySnapshot = await getDocs(q);
        let productsHTML = '';
        let count = 0;

        if (querySnapshot.empty) {
            productsHTML = '<div class="swiper-slide" style="width:100%; text-align:center; padding:50px 0;"><p style="color: var(--text-muted);">No additional products available.</p></div>';
        } else {
            querySnapshot.forEach((doc) => {
                productsHTML += renderFeaturedProductCard({ id: doc.id, ...doc.data() });
                count++;
            });
        }
        container.innerHTML = productsHTML;
        return { success: true, productsCount: count };
    } catch (error) {
        console.error("Error loading second row of featured products:", error);
        container.innerHTML = '<div class="swiper-slide" style="width:100%; text-align:center; padding:50px 0;"><p style="color: red;">Error loading more products.</p></div>';
        return { success: false, productsCount: 0 };
    }
}


// --- DOMContentLoaded Listener ---
document.addEventListener('DOMContentLoaded', () => {

    // Check if Swiper is available
    if (typeof Swiper === 'undefined') {
        console.error("Swiper library is not loaded.");
        document.querySelectorAll('.hero-swiper, .featured-products-swiper, .more-featured-products-swiper').forEach(el => {
           el.innerHTML = "<p style='text-align:center; color: #888;'>Slider could not be loaded.</p>";
        });
        return; // Stop further execution if Swiper is missing
    }

    // --- Initialize Swipers ---

    // 1. Hero Slider
    try {
        const heroSlides = document.querySelectorAll('.hero-swiper .swiper-slide');
        new Swiper('.hero-swiper', {
            loop: heroSlides.length > 1,
            effect: 'fade', fadeEffect: { crossFade: true },
            autoplay: { delay: 5000, disableOnInteraction: false },
            pagination: { el: '.hero-pagination', clickable: true },
            navigation: { nextEl: '.hero-button-next', prevEl: '.hero-button-prev' },
            init: heroSlides.length > 0 // Only init if slides exist
        });
        console.log("Hero Swiper Initialized");
    } catch(e) { console.error("Hero Swiper Initialization Error:", e); }


    // Function to initialize a featured products swiper
    const initializeFeaturedSwiper = (containerSelector, paginationSelector, nextBtnSelector, prevBtnSelector, loopConditionCount) => {
         const swiperContainer = document.querySelector(containerSelector);
         if (!swiperContainer) {
             console.error(`Swiper container ${containerSelector} not found.`);
             return;
         }
         try {
             new Swiper(swiperContainer, {
                 slidesPerView: 1, spaceBetween: 20,
                 loop: loopConditionCount > 4, // Example: Loop if more than 4 slides
                 autoplay: { delay: 4000 + Math.random() * 1000, disableOnInteraction: false }, // Slightly varied autoplay
                 pagination: { el: paginationSelector, clickable: true },
                 navigation: { nextEl: nextBtnSelector, prevEl: prevBtnSelector },
                 breakpoints: { 576: { slidesPerView: 2 }, 768: { slidesPerView: 3, spaceBetween: 25 }, 1024: { slidesPerView: 4, spaceBetween: 30 } },
                 observer: true, // Re-init swiper on DOM changes inside container
                 observeParents: true, // Re-init swiper on DOM changes in parent elements
                 watchOverflow: true, // Disable nav/pagination if not enough slides to scroll
             });
             console.log(`Swiper Initialized for ${containerSelector}`);
         } catch(e) { console.error(`Swiper Initialization Error for ${containerSelector}:`, e); }
    };

    // Helper to hide controls if swiper isn't needed
    const hideSwiperControls = (containerSelector, controlsSelectors) => {
        const swiperContainer = document.querySelector(containerSelector);
        if (swiperContainer) {
            controlsSelectors.forEach(selector => {
                const el = swiperContainer.querySelector(selector);
                if(el) el.style.display = 'none';
            });
        }
    };

    // 2. Featured Products Slider (First Row)
    loadAndRenderFeaturedProducts().then(({ success, productsCount }) => {
        if (success && productsCount > 0) {
            initializeFeaturedSwiper('.featured-products-swiper', '.featured-pagination', '.featured-button-next', '.featured-button-prev', productsCount);
        } else {
            console.log("Featured Products Swiper (First Row) not initialized.");
            hideSwiperControls('.featured-products-swiper', ['.featured-pagination', '.featured-button-next', '.featured-button-prev']);
        }
    });

    // 3. More Featured Products Slider (Second Row)
    loadAndRenderMoreFeaturedProducts().then(({ success, productsCount }) => {
        if (success && productsCount > 0) {
            initializeFeaturedSwiper('.more-featured-products-swiper', '.more-featured-pagination', '.more-featured-button-next', '.more-featured-button-prev', productsCount);
        } else {
            console.log("Featured Products Swiper (Second Row) not initialized.");
            hideSwiperControls('.more-featured-products-swiper', ['.more-featured-pagination', '.more-featured-button-next', '.more-featured-button-prev']);
        }
    });


    // --- Mobile Cart Count Update Logic ---
    // This relies on main.js correctly updating #cart-count first
    const mobileCartCountBadge = document.getElementById('mobile-cart-count');
    function updateMobileCartBadge() {
        const cartCountSpan = document.getElementById('cart-count'); // Main cart count
        if (mobileCartCountBadge && cartCountSpan) {
            const count = parseInt(cartCountSpan.textContent || '0', 10);
            mobileCartCountBadge.textContent = count;
            mobileCartCountBadge.style.display = count > 0 ? 'flex' : 'none'; // Show badge only if count > 0
        } else {
            if(!cartCountSpan) console.warn("#cart-count span not found for mobile badge update.");
            if(!mobileCartCountBadge) console.warn("#mobile-cart-count span not found.");
        }
    }
    // Initial update attempt after a short delay (allow main.js to run)
    setTimeout(updateMobileCartBadge, 200);
    // Listen for cart updates triggered by main.js/cart.js
    document.addEventListener('cartUpdated', updateMobileCartBadge);

}); // End DOMContentLoaded listener

console.log("home.js loaded.");