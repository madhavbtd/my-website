// js/product-detail.js
// FINAL UPDATED Version: Includes Tabs, Quantity Buttons, New Price Layout, Related Products Slider, Schema Update, Review Logic, Social Sharing

// --- Imports ---
import { db } from './firebase-config.js';
// Import necessary Firestore functions
import {
    doc, getDoc, collection, query, where, limit, getDocs, addDoc, serverTimestamp, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { addToCart } from './cart.js';
import { updateCartCount } from './main.js';

// --- DOM Elements ---
const productDetailContainer = document.getElementById('product-detail-container');
const loadingIndicator = productDetailContainer?.querySelector('.loading-indicator');
const productContent = productDetailContainer?.querySelector('.product-content');
const errorMessageContainer = document.getElementById('error-message-container');
const breadcrumbProductName = document.getElementById('breadcrumb-product-name');
const productNameEl = document.getElementById('product-name');
const mainImageEl = document.getElementById('main-product-image');
const thumbnailImagesContainer = document.getElementById('thumbnail-images');
const priceEl = document.getElementById('product-price'); // Now inside product-actions
const originalPriceEl = document.getElementById('original-price'); // Optional original price
const addToCartBtn = document.getElementById('add-to-cart-btn');
const cartFeedbackEl = document.getElementById('cart-feedback');
const productSchemaScript = document.getElementById('product-schema');
const descriptionShortEl = document.getElementById('product-description-short');
const descriptionFullEl = document.getElementById('product-description-full');
const specsListEl = document.getElementById('product-specs');
const usageCareInfoEl = document.getElementById('usage-care-info');
const faqListEl = document.getElementById('faq-list');
const standardQuantityContainer = document.getElementById('standard-quantity-container');
const flexInputsContainer = document.getElementById('flex-inputs-container');
const weddingQuantityContainer = document.getElementById('wedding-quantity-container');
const standardQuantityInput = document.getElementById('quantity');
const bannerWidthInput = document.getElementById('banner-width');
const bannerHeightInput = document.getElementById('banner-height');
const bannerUnitSelect = document.getElementById('banner-unit');
const bannerQuantityInput = document.getElementById('banner-quantity');
const tabsContainer = document.querySelector('.product-details-tabs');
const tabsNavLinks = document.querySelectorAll('.tabs-nav a');
const tabPanes = document.querySelectorAll('.tabs-content .tab-pane');
const relatedProductsSection = document.getElementById('related-products-section');
const relatedProductsContainer = document.getElementById('related-products-container');
const reviewsListEl = document.getElementById('reviews-list');
const reviewForm = document.getElementById('review-form');
const reviewFeedbackEl = document.getElementById('review-feedback');
const averageRatingEl = document.getElementById('average-rating');
const reviewCountEl = document.getElementById('review-count');
const socialShareLinks = document.querySelectorAll('.social-sharing a'); // Social share links

// --- Global State ---
let currentProductData = null;
let currentProductId = null;
let relatedProductsSwiper = null;

// --- Helper Functions ---
const formatIndianCurrency = (amount) => { /* ... (same as before) ... */
    const num = Number(amount);
    return isNaN(num) || num === null ? 'N/A' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
function formatSpecKey(key) { /* ... (same as before) ... */
    const result = key.replace(/([A-Z])/g, ' $1');
    return result.charAt(0).toUpperCase() + result.slice(1);
 }
function showError(message) { /* ... (same as before, ensure tabs/related are hidden) ... */
    if (productContent) productContent.style.display = 'none';
    if (tabsContainer) tabsContainer.style.display = 'none';
    if (relatedProductsSection) relatedProductsSection.style.display = 'none';
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (errorMessageContainer) {
        errorMessageContainer.textContent = message;
        errorMessageContainer.style.display = 'block';
    }
    document.title = "Error - Madhav Multiprint";
    if (breadcrumbProductName) breadcrumbProductName.textContent = "Error";
}
function showFeedback(element, message, isError = false) { /* ... (same as before) ... */
     if (element) {
        element.textContent = message;
        // Use specific classes if .cart-feedback-message structure differs for review feedback
        element.className = `cart-feedback-message ${isError ? 'error' : 'success'}`;
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, 3000);
    }
}

// --- Flex Banner Calculation Logic ---
const mediaWidthsFt = [3, 4, 5, 6, 8, 10];
function calculateFlexDimensions(unit, width, height) { /* ... (same as before) ... */
    let wFt = (unit === 'inches') ? parseFloat(width || 0) / 12 : parseFloat(width || 0);
    let hFt = (unit === 'inches') ? parseFloat(height || 0) / 12 : parseFloat(height || 0);
    if (isNaN(wFt) || isNaN(hFt) || wFt <= 0 || hFt <= 0) return { realSqFt: 0, printWidthFt: 0, printHeightFt: 0, printSqFt: 0 };
    const realSqFt = wFt * hFt;
    const mediaWidthFitW = mediaWidthsFt.find(mw => mw >= wFt); let printWidthFt1 = mediaWidthFitW || wFt; let printHeightFt1 = hFt; let printSqFt1 = printWidthFt1 * printHeightFt1;
    const mediaWidthFitH = mediaWidthsFt.find(mw => mw >= hFt); let printWidthFt2 = wFt; let printHeightFt2 = mediaWidthFitH || hFt; let printSqFt2 = printWidthFt2 * printHeightFt2;
    let finalPrintWidthFt, finalPrintHeightFt, finalPrintSqFt;
    if (!mediaWidthFitH || printSqFt1 <= printSqFt2) { finalPrintWidthFt = printWidthFt1; finalPrintHeightFt = printHeightFt1; finalPrintSqFt = printSqFt1; }
    else { finalPrintWidthFt = printWidthFt2; finalPrintHeightFt = printHeightFt2; finalPrintSqFt = printSqFt2; }
    return { realSqFt: realSqFt.toFixed(2), printWidthFt: finalPrintWidthFt, printHeightFt: finalPrintHeightFt, printSqFt: finalPrintSqFt.toFixed(2) };
}

// --- Update Price Functions ---
function updateFlexPrice() { /* ... (same as before, targets #product-price) ... */
     if (!currentProductData || !currentProductData.pricing || !priceEl || !bannerWidthInput || !bannerHeightInput || !bannerUnitSelect || !bannerQuantityInput) return;
     // ... calculation logic ...
     priceEl.textContent = formatIndianCurrency(finalCost);
     // Update original price if applicable
     if (originalPriceEl && currentProductData.pricing?.originalRate && finalCost < (totalPrintSqFt * currentProductData.pricing.originalRate) ) {
        // Example: Show original only if discount exists (simple logic)
        originalPriceEl.textContent = formatIndianCurrency(totalPrintSqFt * currentProductData.pricing.originalRate);
        originalPriceEl.style.display = 'inline-block';
     } else if (originalPriceEl) {
        originalPriceEl.style.display = 'none';
     }
}
function updateWeddingPrice() { /* ... (same as before, targets #product-price) ... */
    if (!currentProductData || !currentProductData.pricing || !priceEl) return;
    // ... calculation logic ...
    priceEl.textContent = formatIndianCurrency(finalAmount);
    // Update original price if applicable
    if (originalPriceEl && currentProductData.pricing?.originalRate && finalAmount < (baseRate * selectedQuantity /* simplified original */) ) {
        originalPriceEl.textContent = formatIndianCurrency(baseRate * selectedQuantity);
        originalPriceEl.style.display = 'inline-block';
    } else if (originalPriceEl) {
        originalPriceEl.style.display = 'none';
    }
}
function renderSimplePrice(productData) { /* ... (same as before, targets #product-price) ... */
     if (!productData || !productData.pricing || !priceEl) { priceEl.textContent = 'Contact for Price'; return; }
     // ... logic ...
     priceEl.textContent = priceDisplay;
      // Update original price if applicable
     if (originalPriceEl && productData.pricing?.originalRate && productData.pricing.rate < productData.pricing.originalRate) {
        originalPriceEl.textContent = formatIndianCurrency(productData.pricing.originalRate);
        originalPriceEl.style.display = 'inline-block';
     } else if (originalPriceEl) {
        originalPriceEl.style.display = 'none';
     }
}

// --- Schema Update Function ---
function updateProductSchema(productData, reviewsData = { average: 0, count: 0, reviews: [] }) { /* ... (same as before) ... */
    if (!productSchemaScript || !productData) return;
    const schema = { /* ... schema structure ... */ };
    // Populate schema fields from productData and reviewsData
    schema.name = productData.productName || "";
    schema.image = productData.imageUrls || [];
    schema.description = productData.description || "";
    schema.sku = productData.sku || currentProductId;
    schema.offers.url = window.location.href;
    schema.offers.price = productData.pricing?.rate ?? "0"; // Needs refinement based on type
    schema.offers.availability = productData.isEnabled ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
    schema.aggregateRating.ratingValue = reviewsData.average.toFixed(1) || "0";
    schema.aggregateRating.reviewCount = reviewsData.count || "0";
    schema.review = reviewsData.reviews.map(review => ({ /* ... review schema structure ... */
         "@type": "Review",
         "author": {"@type": "Person", "name": review.reviewerName || "Anonymous"},
         "datePublished": review.createdAt ? new Date(review.createdAt.seconds * 1000).toISOString().split('T')[0] : "",
         "reviewBody": review.comment || "",
         "reviewRating": { "@type": "Rating", "ratingValue": review.rating || "0" }
    }));
    // Adjust offer price based on type (example)
    const category = productData.category?.toLowerCase() || '';
    if (category.includes('flex') && productData.pricing?.minimumOrderValue) { schema.offers.price = productData.pricing.minimumOrderValue; }
    // Add priceSpecification for complex pricing like wedding cards

    productSchemaScript.textContent = JSON.stringify(schema, null, 2);
}

// --- Main Product Loading Logic ---
async function loadProductDetails(productId) { /* ... (mostly same as before) ... */
    if (!loadingIndicator || !productContent || !errorMessageContainer || !tabsContainer) { showError("Page layout error."); return; }
    loadingIndicator.style.display = 'flex'; productContent.style.display = 'none'; tabsContainer.style.display = 'none'; errorMessageContainer.style.display = 'none';
    if (relatedProductsSection) relatedProductsSection.style.display = 'none';
    if (weddingQuantityContainer) weddingQuantityContainer.innerHTML = '';

    try {
        const productRef = doc(db, "onlineProducts", productId); const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
            currentProductData = productSnap.data(); currentProductId = productId;
            if (!currentProductData) { showError("Failed to process product data."); return; }

            // Populate Header/Title
            document.title = `${currentProductData.productName || 'Product'} - Madhav Multiprint`;
            if(breadcrumbProductName) breadcrumbProductName.textContent = currentProductData.productName || 'Product Details';
            if(productNameEl) productNameEl.textContent = currentProductData.productName || 'N/A';

            // Populate Images
            if (mainImageEl && thumbnailImagesContainer) { /* ... (image loading logic) ... */
                 if (currentProductData.imageUrls && Array.isArray(currentProductData.imageUrls) && currentProductData.imageUrls.length > 0) {
                    mainImageEl.src = currentProductData.imageUrls[0]; mainImageEl.alt = currentProductData.productName || 'Product image';
                    thumbnailImagesContainer.innerHTML = '';
                    currentProductData.imageUrls.forEach((url, index) => { /* ... create thumbnails ... */
                         const thumb = document.createElement('img'); thumb.src = url; thumb.alt = `Thumbnail ${index + 1}`; thumb.classList.add('thumbnail');
                        if (index === 0) thumb.classList.add('active');
                        thumbnailImagesContainer.appendChild(thumb);
                    });
                } else { /* ... placeholder image ... */ }
            }

            // Populate Descriptions
            if (descriptionShortEl) descriptionShortEl.textContent = currentProductData.shortDescription || currentProductData.description?.substring(0, 150) + '...' || '';
            if (descriptionFullEl) descriptionFullEl.textContent = currentProductData.description || 'No description available.';

            // Setup Product Options & Pricing
            const category = currentProductData.category?.toLowerCase() || '';
            if (standardQuantityContainer) standardQuantityContainer.style.display = 'none';
            if (flexInputsContainer) flexInputsContainer.style.display = 'none';
            if (weddingQuantityContainer) weddingQuantityContainer.style.display = 'none';
            // ... (logic to show correct options container and call updateFlexPrice/updateWeddingPrice/renderSimplePrice) ...
            if (category.includes('flex')) { /* ... setup flex ... */ updateFlexPrice();}
            else if (category.includes('wedding')) { /* ... setup wedding ... */ priceEl.textContent = "Select Quantity";}
            else { /* ... setup standard ... */ renderSimplePrice(currentProductData); }


            // Populate Tabs
            if (specsListEl) { /* ... (populate specs list) ... */ }
            if (usageCareInfoEl) usageCareInfoEl.textContent = currentProductData.usageInfo || "No usage information available.";
            if (faqListEl) { /* ... (populate FAQ list) ... */ }

            // Show Content & Tabs
            productContent.style.display = 'grid'; tabsContainer.style.display = 'block'; loadingIndicator.style.display = 'none';

            // Load Reviews & Related Products
            const reviewsData = await loadReviews(productId); // Load reviews
            updateProductSchema(currentProductData, reviewsData); // Update schema

            const currentCategory = currentProductData?.category; // Load related
            if (currentCategory) { loadRelatedProducts(productId, currentCategory); }
            else { if(relatedProductsSection) relatedProductsSection.style.display = 'none'; }

        } else { showError("Product not found."); }
    } catch (error) { console.error("Error loading product details: ", error); showError(`Failed to load product details. ${error.message}`); }
}

// --- Related Products Function (using SwiperJS) ---
async function loadRelatedProducts(currentProductId, category) { /* ... (same as before) ... */
     if (!relatedProductsSection || !relatedProductsContainer) return;
    relatedProductsContainer.innerHTML = '<div class="swiper-slide"><p>Loading related products...</p></div>';
     try {
         const q = query(collection(db, "onlineProducts"), where("isEnabled", "==", true), where("category", "==", category), where("__name__", "!=", currentProductId), limit(10));
         const querySnapshot = await getDocs(q); const relatedProducts = [];
         querySnapshot.forEach((doc) => { relatedProducts.push({ id: doc.id, ...doc.data() }); });
         if (relatedProducts.length > 0) {
             relatedProductsContainer.innerHTML = '';
             relatedProducts.forEach(product => { /* ... create product card slide ... */ });
             relatedProductsSection.style.display = 'block';
             if (relatedProductsSwiper) { relatedProductsSwiper.destroy(true, true); relatedProductsSwiper = null; }
             if (typeof Swiper !== 'undefined') {
                 relatedProductsSwiper = new Swiper('.related-products-swiper', { /* ... swiper options ... */
                    loop: relatedProducts.length > 5, slidesPerView: 2, spaceBetween: 15,
                    autoplay: { delay: 4000, disableOnInteraction: false, },
                    pagination: { el: '.swiper-pagination', clickable: true, },
                    navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev', },
                    breakpoints: { 640: { slidesPerView: 3, spaceBetween: 20 }, 768: { slidesPerView: 4, spaceBetween: 25 }, 1024: { slidesPerView: 5, spaceBetween: 30 } }
                 });
             } else { console.error("Swiper is not defined."); }
         } else { relatedProductsSection.style.display = 'none'; }
     } catch (error) { console.error("Error loading related products:", error); /* ... show error ... */ }
}

// --- Review Functions ---
async function loadReviews(productId) { /* ... (same as before) ... */
     if (!reviewsListEl || !averageRatingEl || !reviewCountEl) return { average: 0, count: 0, reviews: [] };
     reviewsListEl.innerHTML = '<p>Loading reviews...</p>'; let totalRating = 0; let reviewCount = 0; const fetchedReviews = [];
     try {
         const q = query(collection(db, "onlineProducts", productId, "reviews"), orderBy("createdAt", "desc"));
         const querySnapshot = await getDocs(q);
         if (!querySnapshot.empty) {
             reviewsListEl.innerHTML = '';
             querySnapshot.forEach((doc) => { /* ... process and display each review ... */ });
             const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;
             averageRatingEl.textContent = `${averageRating.toFixed(1)} / 5`; reviewCountEl.textContent = reviewCount;
             return { average: averageRating, count: reviewCount, reviews: fetchedReviews };
         } else { /* ... show no reviews message ... */ return { average: 0, count: 0, reviews: [] }; }
     } catch (error) { console.error("Error loading reviews:", error); /* ... show error ... */ return { average: 0, count: 0, reviews: [] }; }
}

async function submitReview(event) { /* ... (same as before, includes addDoc to Firestore) ... */
     event.preventDefault(); if (!reviewForm || !currentProductId || !reviewFeedbackEl) return;
     const reviewerName = reviewForm.elements['reviewer_name']?.value.trim(); const comment = reviewForm.elements['review_comment']?.value.trim();
     const ratingInput = reviewForm.querySelector('input[name="rating"]:checked'); const rating = ratingInput ? parseInt(ratingInput.value, 10) : 0;
     if (!reviewerName || !comment || rating === 0) { showFeedback(reviewFeedbackEl, "Please fill in all fields and select a rating.", true); return; }
     reviewForm.querySelector('button[type="submit"]').disabled = true; showFeedback(reviewFeedbackEl, "Submitting review...", false);
     try {
         const reviewsRef = collection(db, "onlineProducts", currentProductId, "reviews");
         await addDoc(reviewsRef, { reviewerName, comment, rating, createdAt: serverTimestamp() });
         showFeedback(reviewFeedbackEl, "Review submitted successfully!", false); reviewForm.reset();
         const reviewsData = await loadReviews(currentProductId); updateProductSchema(currentProductData, reviewsData); // Reload reviews & update schema
     } catch (error) { console.error("Error submitting review:", error); showFeedback(reviewFeedbackEl, `Failed to submit review. ${error.message}`, true);
     } finally { reviewForm.querySelector('button[type="submit"]').disabled = false; }
}

// --- Add to Cart Handler ---
function handleAddToCart() { /* ... (same as before, targets correct quantity inputs) ... */
     if (!currentProductId || !currentProductData || !cartFeedbackEl) { showFeedback(cartFeedbackEl, "Error: Product data not loaded.", true); return; }
     const category = currentProductData.category?.toLowerCase() || ''; let itemToAdd = { productId: currentProductId, quantity: 0 }; let cartOptions = {};
     try {
         if (category.includes('flex')) { /* ... get flex options and calculate price ... */ }
         else if (category.includes('wedding')) { /* ... get wedding options and calculate price ... */ }
         else { /* ... get standard options ... */
             const quantityInput = standardQuantityContainer?.querySelector('.quantity-input'); // Get qty from standard options container
             const quantity = parseInt(quantityInput?.value || 1);
             if (isNaN(quantity) || quantity < 1) { showFeedback(cartFeedbackEl, "Please enter a valid quantity.", true); return; }
             itemToAdd.quantity = quantity; cartOptions = { type: 'Standard', price: currentProductData.pricing?.rate };
         }
         addToCart(itemToAdd.productId, itemToAdd.quantity, cartOptions);
         showFeedback(cartFeedbackEl, "Product added to cart!", false);
         if (typeof updateCartCount === 'function') { updateCartCount(); }
     } catch (error) { console.error("Error adding to cart:", error); showFeedback(cartFeedbackEl, `Failed to add product to cart. ${error.message}`, true); }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Add to Cart Button
    if (addToCartBtn) { addToCartBtn.addEventListener('click', handleAddToCart); }

    // Thumbnail Click
    if (thumbnailImagesContainer) { /* ... (thumbnail click logic) ... */ }

     // Tab Navigation
     if (tabsNavLinks.length > 0 && tabPanes.length > 0) { /* ... (tab click logic) ... */ }

     // Quantity Buttons (Event Delegation)
     const quantityContainers = document.querySelectorAll('.quantity-input-wrapper');
     quantityContainers.forEach(wrapper => { wrapper.addEventListener('click', (event) => { /* ... (quantity button logic) ... */
        const button = event.target.closest('.quantity-btn'); if (!button) return;
        const input = wrapper.querySelector('.quantity-input'); if (!input) return;
        const currentValue = parseInt(input.value, 10) || 1; const min = parseInt(input.min, 10) || 1; let newValue = currentValue;
        if (button.classList.contains('quantity-increase')) { newValue = currentValue + 1; } else if (button.classList.contains('quantity-decrease')) { newValue = currentValue - 1; }
        if (newValue < min) { newValue = min; } input.value = newValue;
        if (input.id === 'banner-quantity') { updateFlexPrice(); } // Trigger flex price update
     }); });

     // Review Form Submission
     if (reviewForm) { reviewForm.addEventListener('submit', submitReview); }

     // Social Sharing Links
      if (socialShareLinks.length > 0) { socialShareLinks.forEach(link => { link.addEventListener('click', (event) => { /* ... (social share logic) ... */
           event.preventDefault();
           if (!currentProductData || !currentProductData.productName) return;
           const pageUrl = window.location.href; const productName = encodeURIComponent(currentProductData.productName); let shareUrl = '';
           const network = link.getAttribute('aria-label')?.toLowerCase() || '';
           if (network.includes('facebook')) { shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`; }
           else if (network.includes('twitter')) { shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${productName}`; }
           else if (network.includes('whatsapp')) { shareUrl = `https://api.whatsapp.com/send?text=${productName}%20${encodeURIComponent(pageUrl)}`; }
           if (shareUrl) { window.open(shareUrl, '_blank', 'width=600,height=400'); }
       }); }); }
}

// --- Initialize Page ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    if (!productId) { showError("Product ID not found in URL."); return; }
    loadProductDetails(productId); // Load initial data
    setupEventListeners(); // Setup interactions
});