// js/product-detail.js
// FINAL UPDATED Version: Includes setupTabs fix, relatedProducts const->let fix.
// Uses 'onlineProducts', fixes Wedding Qty logic. Includes showLoading.
// Includes Tabs, Quantity Buttons, New Price Layout, Related Products Slider, Schema Update, Review Logic (subcollection), Social Sharing, and Error Checks

// --- Imports ---
import { db } from './firebase-config.js';
// Import necessary Firestore functions
import {
    doc, getDoc, collection, query, where, limit, getDocs, addDoc, serverTimestamp, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { addToCart } from './cart.js';
// Ensure updateCartCount is exported from main.js or handle it appropriately
import { updateCartCount } from './main.js'; // Make sure this import works

// --- DOM Elements ---
const productDetailContainer = document.getElementById('product-detail-container');
const loadingIndicator = productDetailContainer?.querySelector('.loading-indicator');
const productContent = productDetailContainer?.querySelector('.product-content');
const errorMessageContainer = document.getElementById('error-message-container');
const breadcrumbProductName = document.getElementById('breadcrumb-product-name');
const productNameEl = document.getElementById('product-name');
const mainImageEl = document.getElementById('main-product-image');
const thumbnailImagesContainer = document.getElementById('thumbnail-images');
const priceEl = document.getElementById('product-price');
const originalPriceEl = document.getElementById('original-price');
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
const tabsContainer = document.querySelector('.product-details-tabs'); // Main tabs container
const tabsNav = document.querySelector('.tabs-nav'); // Container for tab links <<-- Added this selector
const tabPanes = document.querySelectorAll('.tabs-content .tab-pane'); // Tab content panes
const relatedProductsSection = document.getElementById('related-products-section');
const relatedProductsContainer = document.getElementById('related-products-container');
const reviewsListEl = document.getElementById('reviews-list');
const reviewForm = document.getElementById('review-form');
const reviewFeedbackEl = document.getElementById('review-feedback');
const averageRatingEl = document.getElementById('average-rating');
const reviewCountEl = document.getElementById('review-count');
const socialShareLinksContainer = document.querySelector('.social-sharing');

// --- Global State ---
let currentProductData = null;
let currentProductId = null;
let relatedProductsSwiper = null;

// --- Helper Functions ---

function showLoading(isLoading) {
    if (loadingIndicator) loadingIndicator.style.display = isLoading ? 'flex' : 'none';
    if (productContent) productContent.style.display = isLoading ? 'none' : 'grid';
    if (errorMessageContainer && isLoading) {
        errorMessageContainer.style.display = 'none';
        errorMessageContainer.textContent = '';
    }
}

function showError(message) {
    showLoading(false);
    if (errorMessageContainer) {
        errorMessageContainer.textContent = message;
        errorMessageContainer.style.display = 'block';
    }
    if (productContent) productContent.style.display = 'none';
    if (tabsContainer) tabsContainer.style.display = 'none';
    if (relatedProductsSection) relatedProductsSection.style.display = 'none';
    document.title = "Error - Madhav Multiprint";
    if (breadcrumbProductName) breadcrumbProductName.textContent = "Error";
}

const formatIndianCurrency = (amount) => {
    const num = Number(amount);
    return isNaN(num) || num === null ? 'N/A' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

function formatSpecKey(key) {
    const result = key.replace(/([A-Z])/g, ' $1');
    return result.charAt(0).toUpperCase() + result.slice(1);
 }

function showFeedback(element, message, isError = false) {
     if (element) {
        element.textContent = message;
        element.className = `cart-feedback-message ${isError ? 'error' : 'success'}`;
        element.style.display = 'block';
        setTimeout(() => { element.style.display = 'none'; }, 3000);
    }
}

// --- Flex Banner Calculation Logic ---
const mediaWidthsFt = [3, 4, 5, 6, 8, 10];
function calculateFlexDimensions(widthFt, heightFt, availableMediaWidths = mediaWidthsFt) {
    widthFt = Math.max(0, Number(widthFt)); heightFt = Math.max(0, Number(heightFt));
    if (isNaN(widthFt) || isNaN(heightFt) || widthFt <= 0 || heightFt <= 0) return { printSqFtPerBanner: 0, actualWidthFt: 0, actualHeightFt: 0, error: "Invalid dimensions." };
    const sortedMediaWidths = [...availableMediaWidths].sort((a, b) => a - b); let bestSqFt = Infinity;
    const orientations = [{ w: widthFt, h: heightFt }, { w: heightFt, h: widthFt }];
    for (const dim of orientations) {
        const currentW = dim.w; const currentH = dim.h;
        const smallerDim = Math.min(currentW, currentH); const largerDim = Math.max(currentW, currentH);
        let suitableMediaWidth = sortedMediaWidths.find(mediaW => mediaW >= smallerDim);
        if (suitableMediaWidth) { const currentSqFt = largerDim * suitableMediaWidth; bestSqFt = Math.min(bestSqFt, currentSqFt); }
    }
    if (bestSqFt === Infinity) {
        console.warn(`Flex dimensions (${widthFt}x${heightFt}) may exceed largest media width. Using raw area.`);
        bestSqFt = widthFt * heightFt;
        if (bestSqFt <= 0) return { printSqFtPerBanner: 0, actualWidthFt: widthFt, actualHeightFt: heightFt, error: "Zero area." };
    }
    if (bestSqFt <= 0) return { printSqFtPerBanner: 0, actualWidthFt: widthFt, actualHeightFt: heightFt, error: "Calculated area is zero." };
    return { printSqFtPerBanner: bestSqFt, actualWidthFt: widthFt, actualHeightFt: heightFt };
}


// --- Update Price Functions ---
function updateFlexPriceDisplay() {
     const width = parseFloat(bannerWidthInput?.value); const height = parseFloat(bannerHeightInput?.value); const unit = bannerUnitSelect?.value; const quantity = parseInt(bannerQuantityInput?.value, 10); const pricing = currentProductData?.pricing;
     if (!priceEl) return; // Exit if price element doesn't exist
     if (!pricing || isNaN(width) || width <= 0 || isNaN(height) || height <= 0 || isNaN(quantity) || quantity <= 0) { priceEl.textContent = "Enter valid dimensions & quantity"; return; }
     const ratePerSqFt = parseFloat(pricing.rate); if (isNaN(ratePerSqFt) || ratePerSqFt <= 0) { priceEl.textContent = "Pricing unavailable"; return; }
     const minimumOrderValue = parseFloat(pricing.minimumOrderValue || 0); const mediaWidths = pricing.mediaWidths || mediaWidthsFt;
     const widthFt = unit === 'inches' ? width / 12 : width; const heightFt = unit === 'inches' ? height / 12 : height;
     const dimResult = calculateFlexDimensions(widthFt, heightFt, mediaWidths); if (dimResult.error || isNaN(dimResult.printSqFtPerBanner) || dimResult.printSqFtPerBanner <= 0) { priceEl.textContent = dimResult.error || "Calculation error"; return; }
     const printSqFtPerBanner = dimResult.printSqFtPerBanner; const totalPrintSqFt = printSqFtPerBanner * quantity; const calculatedCost = totalPrintSqFt * ratePerSqFt; const finalCost = Math.max(calculatedCost, minimumOrderValue);
     priceEl.textContent = formatIndianCurrency(finalCost); if (originalPriceEl) originalPriceEl.style.display = 'none';
}
function updateWeddingPriceDisplay() {
    const quantityDropdown = document.getElementById('wedding-quantity-select'); const selectedQuantity = parseInt(quantityDropdown?.value, 10); const pricing = currentProductData?.pricing;
    if (!priceEl) return; // Exit if price element doesn't exist
    if (!pricing || isNaN(selectedQuantity) || selectedQuantity <= 0) { priceEl.textContent = "Select Quantity"; return; }
    const baseRate = parseFloat(pricing.rate); if (isNaN(baseRate)) { priceEl.textContent = "Price info missing"; return; }
    const designCharge = parseFloat(pricing.designCharge || 0); const printingChargeBase = parseFloat(pricing.printingChargeBase || 0); const transportCharge = parseFloat(pricing.transportCharge || 0); const extraMarginPercent = parseFloat(pricing.extraMarginPercent || 0);
    const subTotal = (baseRate * selectedQuantity) + designCharge + printingChargeBase + transportCharge; const finalAmount = subTotal * (1 + (extraMarginPercent / 100)); const averageUnitPrice = finalAmount / selectedQuantity;
    if (isNaN(finalAmount)) { priceEl.textContent = "Calculation Error"; return; }
    priceEl.textContent = `${formatIndianCurrency(finalAmount)} (${formatIndianCurrency(averageUnitPrice)}/card)`;
    if (originalPriceEl) { if (pricing.originalRate && averageUnitPrice < pricing.originalRate) { originalPriceEl.textContent = formatIndianCurrency(pricing.originalRate) + "/card (Original)"; originalPriceEl.style.display = 'inline-block'; } else { originalPriceEl.style.display = 'none'; } }
}
function renderStandardPriceDisplay(pricing) {
     if (!priceEl) return; // Exit if price element doesn't exist
     if (!pricing || typeof pricing.rate !== 'number') { priceEl.textContent = 'Price Unavailable'; if (originalPriceEl) originalPriceEl.style.display = 'none'; return; }
     priceEl.textContent = formatIndianCurrency(pricing.rate);
     if (originalPriceEl) { if (typeof pricing.originalRate === 'number' && pricing.originalRate > pricing.rate) { originalPriceEl.textContent = formatIndianCurrency(pricing.originalRate); originalPriceEl.style.display = 'inline'; } else { originalPriceEl.style.display = 'none'; } }
}

// --- Populate Wedding Dropdown ---
function populateWeddingQuantities(optionsArray) {
    const selectEl = document.getElementById('wedding-quantity-select');
    if (!selectEl) { console.error("Wedding quantity select element not found!"); return; }
    selectEl.innerHTML = '<option value="">Select Quantity</option>';
    const quantityOptionData = optionsArray?.find(opt => opt && opt.name?.toLowerCase() === 'quantity');
    if (!quantityOptionData || !Array.isArray(quantityOptionData.values) || quantityOptionData.values.length === 0) { console.warn("Wedding quantities data missing or invalid within product options."); selectEl.innerHTML += '<option disabled>Quantities not available</option>'; return; }
    quantityOptionData.values.forEach(val => { const numQty = Number(val); if (!isNaN(numQty) && numQty > 0) { const option = document.createElement('option'); option.value = numQty; option.textContent = numQty; selectEl.appendChild(option); } else { console.warn("Invalid quantity value found in wedding options array:", val); } });
}

// --- Schema Update Function ---
function updateProductSchema(productData, reviewsData = { average: 0, count: 0, reviews: [] }) {
    // (Code included below in the full block)
    if (!productSchemaScript || !productData || !productData.productName) return;
    let priceForSchema = productData.pricing?.rate ?? "0"; // Default
    const category = productData.category?.toLowerCase() || '';
    if (category.includes('flex') && productData.pricing?.minimumOrderValue) { priceForSchema = productData.pricing.minimumOrderValue; }
    const schema = { "@context": "https://schema.org/", "@type": "Product", "name": productData.productName, "image": productData.imageUrls || [], "description": productData.description || productData.shortDescription || "", "sku": productData.sku || currentProductId, "brand": { "@type": "Brand", "name": productData.brand || "Madhav Multiprint" }, "offers": { "@type": "Offer", "url": window.location.href, "priceCurrency": "INR", "price": priceForSchema.toString(), "availability": productData.isEnabled ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", "itemCondition": "https://schema.org/NewCondition" }, "aggregateRating": { "@type": "AggregateRating", "ratingValue": reviewsData.average.toFixed(1) || "0", "reviewCount": reviewsData.count || "0" }, "review": reviewsData.reviews.map(review => ({ "@type": "Review", "author": {"@type": "Person", "name": review.reviewerName || "Anonymous"}, "datePublished": review.createdAt?.seconds ? new Date(review.createdAt.seconds * 1000).toISOString().split('T')[0] : "", "reviewBody": review.comment || "", "reviewRating": { "@type": "Rating", "ratingValue": review.rating || "0" } })) };
    try { productSchemaScript.textContent = JSON.stringify(schema, null, 2); } catch (e) { console.error("Error updating schema script:", e); }
}

// --- Main Product Loading Logic ---
async function loadProductDetails(productId) {
    // (Code included below in the full block)
    if (!loadingIndicator || !productContent || !errorMessageContainer || !tabsContainer || !productNameEl || !mainImageEl || !thumbnailImagesContainer || !breadcrumbProductName || !descriptionShortEl || !descriptionFullEl || !specsListEl || !usageCareInfoEl || !faqListEl || !relatedProductsSection || !reviewsListEl) { console.error("Core layout elements missing! Cannot proceed."); const errContainer = errorMessageContainer || document.body; errContainer.textContent = "Page layout error. Required elements missing."; errContainer.style.display = 'block'; if (loadingIndicator) loadingIndicator.style.display = 'none'; return; }
    showLoading(true); relatedProductsSection.style.display = 'none'; if (weddingQuantityContainer) weddingQuantityContainer.innerHTML = '';
    try {
        const productRef = doc(db, "onlineProducts", productId); const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
            currentProductData = productSnap.data(); currentProductId = productId; if (!currentProductData) { showError("Failed to process product data."); return; } if (!currentProductData.pricing) currentProductData.pricing = {}; if (!currentProductData.options) currentProductData.options = [];
            document.title = `${currentProductData.productName || 'Product'} - Madhav Multiprint`; breadcrumbProductName.textContent = currentProductData.productName || 'Details'; productNameEl.textContent = currentProductData.productName || 'N/A';
            const imageUrls = currentProductData.imageUrls && Array.isArray(currentProductData.imageUrls) ? currentProductData.imageUrls : []; if (imageUrls.length > 0) { mainImageEl.src = imageUrls[0]; mainImageEl.alt = currentProductData.productName || 'Product image'; thumbnailImagesContainer.innerHTML = ''; imageUrls.forEach((url, index) => { const thumb = document.createElement('img'); thumb.src = url; thumb.alt = `Thumbnail ${index + 1}`; thumb.classList.add('thumbnail'); if (index === 0) thumb.classList.add('active'); thumbnailImagesContainer.appendChild(thumb); }); thumbnailImagesContainer.style.display = imageUrls.length > 1 ? 'grid' : 'none'; } else { mainImageEl.src = 'images/placeholder.png'; mainImageEl.alt = 'Placeholder'; thumbnailImagesContainer.innerHTML = ''; thumbnailImagesContainer.style.display = 'none';}
            descriptionShortEl.textContent = currentProductData.shortDescription || currentProductData.description?.substring(0, 150) + '...' || ''; descriptionFullEl.innerHTML = currentProductData.description || 'No description available.';
            const category = currentProductData.category?.toLowerCase() || ''; if (standardQuantityContainer) standardQuantityContainer.style.display = 'none'; if (flexInputsContainer) flexInputsContainer.style.display = 'none'; if (weddingQuantityContainer) weddingQuantityContainer.style.display = 'none';
            if (category.includes('flex')) { if (flexInputsContainer) flexInputsContainer.style.display = 'grid'; updateFlexPriceDisplay(); } else if (category.includes('wedding')) { if (weddingQuantityContainer) { if (!document.getElementById('wedding-quantity-select')) { const label = document.createElement('label'); label.htmlFor = 'wedding-quantity-select'; label.textContent = 'Select Quantity:'; const select = document.createElement('select'); select.id = 'wedding-quantity-select'; select.name = 'wedding_quantity'; weddingQuantityContainer.appendChild(label); weddingQuantityContainer.appendChild(select); } weddingQuantityContainer.style.display = 'flex'; populateWeddingQuantities(currentProductData.options); updateWeddingPriceDisplay(); } else { if (standardQuantityContainer) standardQuantityContainer.style.display = 'block'; renderStandardPriceDisplay(currentProductData.pricing); } } else { if (standardQuantityContainer) standardQuantityContainer.style.display = 'block'; renderStandardPriceDisplay(currentProductData.pricing); }
            specsListEl.innerHTML = ''; if (currentProductData.specifications && typeof currentProductData.specifications === 'object' && Object.keys(currentProductData.specifications).length > 0) { for (const [key, value] of Object.entries(currentProductData.specifications)) { if (value) { const li = document.createElement('li'); li.innerHTML = `<strong>${formatSpecKey(key)}:</strong> <span>${value}</span>`; specsListEl.appendChild(li); } } } else { specsListEl.innerHTML = '<li>No specifications available.</li>'; } usageCareInfoEl.textContent = currentProductData.usageInfo || "No usage information available."; await fetchAndDisplayFAQs(currentProductData.faqIds || []);
            productContent.style.display = 'grid'; tabsContainer.style.display = 'block';
            let reviewsData = { average: 0, count: 0, reviews: [] }; try { reviewsData = await fetchAndDisplayReviews(productId); } catch (reviewError) { console.error("Error loading reviews (caught):", reviewError); } updateProductSchema(currentProductData, reviewsData); if (currentProductData.category) { fetchRelatedProducts(productId, currentProductData.category); } else { relatedProductsSection.style.display = 'none'; }
            setupAllEventListeners(); // Attach listeners AFTER rendering
        } else { showError(`Product not found (ID: ${productId}).`); }
    } catch (error) { console.error("Error in loadProductDetails:", error); showError(`Failed to load details: ${error.message}`); } finally { showLoading(false); }
}

// --- Related Products ---
async function fetchRelatedProducts(currentProdId, category) {
    if (!relatedProductsSection || !relatedProductsContainer) return;
    relatedProductsContainer.innerHTML = '<div class="swiper-slide"><p>Loading...</p></div>';
    try {
        // ***** FIX: Declare relatedProducts with let *****
        let relatedProducts = [];
        const productsRef = collection(db, "onlineProducts");
        const q = query(collection(db, "onlineProducts"), where("category", "==", category), limit(10));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            if (doc.id !== currentProdId) {
                relatedProducts.push({ id: doc.id, ...doc.data() });
            }
        });
        // ***** FIX: No reassignment needed if declared with let *****
        relatedProducts = relatedProducts.slice(0, 6); // Limit display

        if (relatedProducts.length > 0) {
            displayRelatedProducts(relatedProducts);
            relatedProductsSection.style.display = 'block';
        } else { relatedProductsSection.style.display = 'none'; }
    } catch (error) {
        console.error("Error loading related products:", error);
        relatedProductsSection.style.display = 'block'; // Show section to display error
        relatedProductsContainer.innerHTML = '<p>Error loading related items.</p>'; // Show error message
    }
}
// (Includes displayRelatedProducts, initializeRelatedProductsSwiper - code omitted for brevity)
function displayRelatedProducts(products) {
    relatedProductsContainer.innerHTML = '';
    products.forEach(product => {
        const slide = document.createElement('div'); slide.className = 'swiper-slide';
        let imageUrl = product.imageUrls?.[0] || 'images/placeholder.png'; let priceHTML = 'Contact for Price'; const pricing = product.pricing; if (pricing && typeof pricing.rate === 'number') { priceHTML = formatIndianCurrency(pricing.rate); if(product.unit && product.unit !== 'QTY') priceHTML += ` / ${product.unit}`; }
        slide.innerHTML = ` <div class="product-card"> <div class="product-image-container"><a href="product-detail.html?id=${product.id}"><img src="${imageUrl}" alt="${product.productName || 'Product'}" loading="lazy"></a></div> <div class="product-info"> <h3><a href="product-detail.html?id=${product.id}">${product.productName || 'Unnamed'}</a></h3> <div class="price">${priceHTML}</div> <a href="product-detail.html?id=${product.id}" class="button-primary view-details-btn">View Details</a> </div> </div>`; relatedProductsContainer.appendChild(slide); });
    initializeRelatedProductsSwiper();
}
function initializeRelatedProductsSwiper() {
     if (typeof Swiper === 'undefined') { console.error("Swiper library not loaded."); return; } if (relatedProductsContainer.swiper) { relatedProductsContainer.swiper.destroy(true, true); relatedProductsContainer.swiper = null; }
     relatedProductsContainer.swiper = new Swiper('.related-products-swiper', { loop: relatedProductsContainer.querySelectorAll('.swiper-slide').length > 5, slidesPerView: 2, spaceBetween: 15, autoplay: { delay: 4000, disableOnInteraction: false, }, pagination: { el: '.swiper-pagination', clickable: true, }, navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev', }, breakpoints: { 640: { slidesPerView: 3 }, 768: { slidesPerView: 4 }, 1024: { slidesPerView: 5 } } });
}

// --- Review Functions ---
// (Includes fetchAndDisplayReviews, handleReviewSubmit - code omitted for brevity)
async function fetchAndDisplayReviews(productId) {
     if (!reviewsListEl || !averageRatingEl || !reviewCountEl || !productId) return { average: 0, count: 0, reviews: [] };
     reviewsListEl.innerHTML = '<p>Loading reviews...</p>'; let totalRating = 0; let reviewCount = 0; const fetchedReviews = [];
     try {
         const reviewsRef = collection(db, "onlineProducts", productId, "reviews"); const q = query(reviewsRef, orderBy("createdAt", "desc")); const querySnapshot = await getDocs(q);
         if (!querySnapshot.empty) {
             reviewsListEl.innerHTML = ''; querySnapshot.forEach((doc) => { const review = { id: doc.id, ...doc.data() }; fetchedReviews.push(review); const reviewItem = document.createElement('div'); reviewItem.className = 'review-item'; const rating = review.rating || 0; const starsHTML = Array(5).fill(0).map((_, i) => `<i class="fas fa-star${i < rating ? '' : '-empty'}" style="color: #f0ad4e;"></i>`).join(''); const date = review.createdAt?.seconds ? new Date(review.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'; reviewItem.innerHTML = `<div class="review-rating">${starsHTML}</div> <p class="review-comment">${review.comment || ''}</p> <p class="review-meta">By <strong>${review.reviewerName || 'Anonymous'}</strong> on ${date}</p>`; reviewsListEl.appendChild(reviewItem); totalRating += rating; reviewCount++; }); const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0; averageRatingEl.textContent = `${averageRating.toFixed(1)} / 5`; reviewCountEl.textContent = reviewCount; return { average: averageRating, count: reviewCount, reviews: fetchedReviews };
         } else { reviewsListEl.innerHTML = '<p>No reviews yet.</p>'; averageRatingEl.textContent = 'N/A'; reviewCountEl.textContent = '0'; return { average: 0, count: 0, reviews: [] }; }
     } catch (error) { console.error("Error loading reviews:", error); reviewsListEl.innerHTML = '<p>Could not load reviews.</p>'; averageRatingEl.textContent = 'Error'; reviewCountEl.textContent = '0'; return { average: 0, count: 0, reviews: [] }; }
}
async function handleReviewSubmit(event, productId) {
     event.preventDefault(); if (!reviewForm || !productId || !reviewFeedbackEl) return; const reviewerName = reviewForm.elements['reviewer_name']?.value.trim(); const comment = reviewForm.elements['review_comment']?.value.trim(); const ratingInput = reviewForm.querySelector('input[name="rating"]:checked'); const rating = ratingInput ? parseInt(ratingInput.value, 10) : 0; if (!reviewerName || !comment || rating === 0) { showFeedback(reviewFeedbackEl, "Please fill name, comment and rating.", true); return; } const submitButton = reviewForm.querySelector('button[type="submit"]'); if (submitButton) submitButton.disabled = true; showFeedback(reviewFeedbackEl, "Submitting...", false); try { const reviewsRef = collection(db, "onlineProducts", productId, "reviews"); await addDoc(reviewsRef, { reviewerName, comment, rating, createdAt: serverTimestamp() }); showFeedback(reviewFeedbackEl, "Review submitted!", false); reviewForm.reset(); const reviewsData = await fetchAndDisplayReviews(productId); updateProductSchema(currentProductData, reviewsData); } catch (error) { console.error("Error submitting review:", error); showFeedback(reviewFeedbackEl, `Failed: ${error.message}`, true); } finally { if (submitButton) submitButton.disabled = false; }
}

// --- FAQ System ---
// (Included fetchAndDisplayFAQs - code omitted for brevity)
async function fetchAndDisplayFAQs(faqIds) {
    if (!faqListEl || !faqIds || faqIds.length === 0) { if (faqListEl) faqListEl.innerHTML = '<p>No FAQs available.</p>'; return; } faqListEl.innerHTML = '<p>Loading FAQs...</p>'; try { const faqs = []; for (const id of faqIds) { if (!id) continue; const faqRef = doc(db, "faqs", id); const docSnap = await getDoc(faqRef); if (docSnap.exists()) faqs.push({ id: docSnap.id, ...docSnap.data() }); } if (faqs.length > 0) { faqListEl.innerHTML = faqs.map((faq, index) => `<details class="faq-item"><summary class="faq-question">${index + 1}. ${faq.question}</summary><div class="faq-answer">${faq.answer}</div></details>`).join(''); } else { faqListEl.innerHTML = '<p>No FAQs available.</p>'; } } catch (error) { console.error("Error fetching FAQs:", error); faqListEl.innerHTML = `<p class="error">Could not load FAQs.</p>`; }
}

// --- Social Sharing ---
// (Included setupSocialSharing, handleSocialLinkClick - code omitted for brevity)
function setupSocialSharing() { if (!socialShareLinksContainer) return; socialShareLinksContainer.removeEventListener('click', handleSocialLinkClick); socialShareLinksContainer.addEventListener('click', handleSocialLinkClick); }
function handleSocialLinkClick(event) { const link = event.target.closest('a.social-icon'); if (!link) return; event.preventDefault(); if (!currentProductData || !currentProductData.productName) return; const pageUrl = window.location.href; const productName = encodeURIComponent(currentProductData.productName); let shareUrl = ''; const network = link.getAttribute('aria-label')?.toLowerCase() ?? ''; if (network.includes('facebook')) { shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`; } else if (network.includes('twitter')) { shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${productName}`; } else if (network.includes('whatsapp')) { shareUrl = `https://api.whatsapp.com/send?text=${productName}%20${encodeURIComponent(pageUrl)}`; } if (shareUrl) window.open(shareUrl, '_blank', 'width=600,height=400,noopener,noreferrer'); }


// --- Add to Cart Handler ---
// (Included handleAddToCart - code omitted for brevity)
function handleAddToCart() {
     if (!currentProductId || !currentProductData) { showFeedback(cartFeedbackEl, "Product data not ready.", true); return; } if (cartFeedbackEl) cartFeedbackEl.style.display = 'none'; try { let cartOptions = { name: currentProductData.productName, imageUrl: mainImageEl?.src || 'images/placeholder.png' }; let itemToAdd = { productId: currentProductId, quantity: 1 }; const category = currentProductData.category?.toLowerCase() || ''; const pricing = currentProductData.pricing || {}; if (category.includes('wedding')) { const quantityDropdown = document.getElementById('wedding-quantity-select'); const selectedQuantity = parseInt(quantityDropdown?.value, 10); if (!quantityDropdown || isNaN(selectedQuantity) || selectedQuantity <= 0) { showFeedback(cartFeedbackEl, "Select wedding quantity.", true); return; } const baseRate = parseFloat(pricing.rate); if (isNaN(baseRate)) { showFeedback(cartFeedbackEl, "Price info missing.", true); return; } const designCharge = parseFloat(pricing.designCharge || 0); const printingChargeBase = parseFloat(pricing.printingChargeBase || 0); const transportCharge = parseFloat(pricing.transportCharge || 0); const extraMarginPercent = parseFloat(pricing.extraMarginPercent || 0); const subTotal = (baseRate * selectedQuantity) + designCharge + printingChargeBase + transportCharge; const finalAmount = subTotal * (1 + (extraMarginPercent / 100)); const averageUnitPrice = finalAmount / selectedQuantity; if (isNaN(averageUnitPrice) || averageUnitPrice <= 0) { showFeedback(cartFeedbackEl, "Could not calculate price.", true); return; } itemToAdd.quantity = selectedQuantity; cartOptions = { ...cartOptions, type: 'Wedding Card', price: averageUnitPrice }; } else if (category.includes('flex')) { const width = parseFloat(bannerWidthInput?.value); const height = parseFloat(bannerHeightInput?.value); const unit = bannerUnitSelect?.value; const quantity = parseInt(bannerQuantityInput?.value, 10); if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0 || isNaN(quantity) || quantity <= 0) { showFeedback(cartFeedbackEl, "Enter valid flex dimensions & quantity.", true); return; } const ratePerSqFt = parseFloat(pricing.rate); if (isNaN(ratePerSqFt) || ratePerSqFt <= 0) { showFeedback(cartFeedbackEl, "Flex price info missing.", true); return; } const minimumOrderValue = parseFloat(pricing.minimumOrderValue || 0); const mediaWidths = pricing.mediaWidths || mediaWidthsFt; const widthFt = unit === 'inches' ? width / 12 : width; const heightFt = unit === 'inches' ? height / 12 : height; const dimResult = calculateFlexDimensions(widthFt, heightFt, mediaWidths); if (dimResult.error || isNaN(dimResult.printSqFtPerBanner) || dimResult.printSqFtPerBanner <= 0) { showFeedback(cartFeedbackEl, dimResult.error || "Cannot calculate area.", true); return; } const printSqFtPerBanner = dimResult.printSqFtPerBanner; const totalPrintSqFt = printSqFtPerBanner * quantity; const calculatedCost = totalPrintSqFt * ratePerSqFt; const finalCost = Math.max(calculatedCost, minimumOrderValue); const pricePerBanner = finalCost / quantity; if (isNaN(pricePerBanner) || pricePerBanner <= 0) { showFeedback(cartFeedbackEl, "Could not calculate price/banner.", true); return; } itemToAdd.quantity = quantity; cartOptions = { ...cartOptions, type: 'Flex Banner', details: `${width}x${height} ${unit}`, price: pricePerBanner }; } else { const quantitySelected = parseInt(standardQuantityInput?.value || 1, 10); if (isNaN(quantitySelected) || quantitySelected <= 0) { showFeedback(cartFeedbackEl, "Enter valid quantity.", true); return; } const standardPrice = parseFloat(pricing?.rate); if (isNaN(standardPrice) || standardPrice < 0) { showFeedback(cartFeedbackEl, "Product price unavailable.", true); return; } itemToAdd.quantity = quantitySelected; cartOptions = { ...cartOptions, type: 'Standard', price: standardPrice }; } if (typeof cartOptions.price !== 'number' || isNaN(cartOptions.price) || cartOptions.price < 0) { console.error("Invalid final price:", cartOptions.price); showFeedback(cartFeedbackEl, "Invalid price. Cannot add.", true); return; } addToCart(itemToAdd.productId, itemToAdd.quantity, cartOptions); showFeedback(cartFeedbackEl, "Product added to cart!", false); if (typeof updateCartCount === 'function') updateCartCount(); else console.warn("updateCartCount function not available."); } catch (error) { console.error("Error in handleAddToCart:", error); showFeedback(cartFeedbackEl, `Failed to add. ${error.message}`, true); }
}

// --- Setup Event Listeners (Consolidated) ---
// (Includes setupAllEventListeners, handleThumbnailClick, handleReviewSubmitWrapper, setupTabs, setupQuantityButtons, handleQuantityButtonClick, setupFlexInputListeners, setupWeddingQuantityListener - code omitted for brevity)

// ***** FIX: Add setupTabs Function Definition *****
function setupTabs() {
    // Check if necessary elements exist
    if (!tabsNav || !tabPanes || tabPanes.length === 0) {
        // console.warn("Tab navigation or panes not found. Cannot set up tabs.");
        return;
    }

    const tabLinks = tabsNav.querySelectorAll('a'); // Get links within the nav container
    if (tabLinks.length === 0) {
         // console.warn("No tab links found within .tabs-nav");
         return;
    }


    tabLinks.forEach(link => {
        // Ensure listener isn't duplicated if setupTabs is called again
        link.removeEventListener('click', handleTabClick);
        link.addEventListener('click', handleTabClick);
    });

    // Activate the first valid tab by default
    const firstVisibleLink = Array.from(tabLinks).find(link => link.offsetParent !== null); // Find first link actually visible
    if (firstVisibleLink && !tabsNav.querySelector('a.active')) {
        activateTab(firstVisibleLink);
    } else if (tabsNav.querySelector('a.active')) {
        // If a tab is already active (e.g., from HTML), ensure its content is shown
        activateTab(tabsNav.querySelector('a.active'));
    }
}

function handleTabClick(event) {
    event.preventDefault();
    const clickedLink = event.currentTarget; // Use currentTarget
    activateTab(clickedLink);
}

function activateTab(activeLink) {
    if (!activeLink) return;
    const targetId = activeLink.getAttribute('href')?.substring(1);
    if (!targetId) return;

    // Deactivate all tabs and panes first
    tabsNav.querySelectorAll('a').forEach(link => link.classList.remove('active'));
    tabPanes.forEach(pane => pane.classList.remove('active'));

    // Activate the clicked tab and corresponding pane
    activeLink.classList.add('active');
    const targetPane = document.getElementById(targetId);
    if (targetPane) {
        targetPane.classList.add('active');
    } else {
        console.warn(`Tab content pane with ID '${targetId}' not found.`);
    }
}


function setupAllEventListeners() {
     if (addToCartBtn) { addToCartBtn.removeEventListener('click', handleAddToCart); addToCartBtn.addEventListener('click', handleAddToCart); }
     if (thumbnailImagesContainer) { thumbnailImagesContainer.removeEventListener('click', handleThumbnailClick); thumbnailImagesContainer.addEventListener('click', handleThumbnailClick); }
     setupTabs(); // Setup tab clicks <<--- CALL IT HERE
     setupQuantityButtons(); // Setup standard +/- buttons
     setupFlexInputListeners(); // Setup flex input changes
     setupWeddingQuantityListener(); // Setup wedding dropdown changes
     if (reviewForm) { reviewForm.removeEventListener('submit', handleReviewSubmitWrapper); reviewForm.addEventListener('submit', handleReviewSubmitWrapper); }
     setupSocialSharing(); // Setup social sharing clicks
}
function handleThumbnailClick(event) {
     if (event.target.tagName === 'IMG' && mainImageEl) { mainImageEl.src = event.target.src; thumbnailImagesContainer.querySelectorAll('img').forEach(thumb => thumb.classList.remove('active')); event.target.classList.add('active'); }
}
function handleReviewSubmitWrapper(event) { handleReviewSubmit(event, currentProductId); }
function setupQuantityButtons() { [standardQuantityContainer, flexInputsContainer].forEach(container => { if (!container) return; container.removeEventListener('click', handleQuantityButtonClick); container.addEventListener('click', handleQuantityButtonClick); }); }
function handleQuantityButtonClick(event) { const button = event.target.closest('.quantity-btn'); if (!button) return; const wrapper = button.closest('.quantity-input-wrapper'); if (!wrapper) return; const input = wrapper.querySelector('.quantity-input'); if (!input) return; let currentValue = parseInt(input.value, 10) || 1; const min = parseInt(input.min, 10) || 1; const step = parseInt(input.step, 10) || 1; if (button.classList.contains('quantity-increase')) { currentValue += step; } else if (button.classList.contains('quantity-decrease')) { currentValue -= step; } input.value = Math.max(min, currentValue); if (input.id === 'banner-quantity') { updateFlexPriceDisplay(); } }
function setupFlexInputListeners() { const inputs = [bannerWidthInput, bannerHeightInput, bannerUnitSelect]; if (inputs.some(el => !el)) return; inputs.forEach(input => { const eventType = (input.tagName === 'SELECT') ? 'change' : 'input'; input.removeEventListener(eventType, updateFlexPriceDisplay); input.addEventListener(eventType, updateFlexPriceDisplay); }); }
function setupWeddingQuantityListener() { const select = document.getElementById('wedding-quantity-select'); if (!select) return; select.removeEventListener('change', updateWeddingPriceDisplay); select.addEventListener('change', updateWeddingPriceDisplay); }

// --- Initialize Page ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded.");
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    if (!productId) { showError("Product ID not found in URL."); return; }
    console.log(`Initializing page for Product ID: ${productId}`);
    loadProductDetails(productId); // Fetch data and render, includes attaching event listeners
    // Note: setupAllEventListeners() is now called within loadProductDetails after elements are populated.
});