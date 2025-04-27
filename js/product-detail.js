// js/product-detail.js
// FINAL UPDATED Version: Includes Tabs, Quantity Buttons, New Price Layout, Related Products Slider, Schema Update, Review Logic, Social Sharing, and Error Checks

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
const productSchemaScript = document.getElementById('product-schema'); // Crucial: Must exist in HTML
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
const formatIndianCurrency = (amount) => {
    const num = Number(amount);
    return isNaN(num) || num === null ? 'N/A' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
function formatSpecKey(key) {
    const result = key.replace(/([A-Z])/g, ' $1');
    return result.charAt(0).toUpperCase() + result.slice(1);
 }
function showError(message) {
    if (productContent) productContent.style.display = 'none';
    if (tabsContainer) tabsContainer.style.display = 'none';
    if (relatedProductsSection) relatedProductsSection.style.display = 'none';
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (errorMessageContainer) {
        // Append the specific error message part if available
        errorMessageContainer.textContent = message;
        errorMessageContainer.style.display = 'block';
    }
    document.title = "Error - Madhav Multiprint";
    if (breadcrumbProductName) breadcrumbProductName.textContent = "Error";
}
function showFeedback(element, message, isError = false) {
     if (element) {
        element.textContent = message;
        element.className = `cart-feedback-message ${isError ? 'error' : 'success'}`;
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, 3000);
    }
}

// --- Flex Banner Calculation Logic ---
const mediaWidthsFt = [3, 4, 5, 6, 8, 10];
function calculateFlexDimensions(unit, width, height) {
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
function updateFlexPrice() {
     if (!currentProductData || !currentProductData.pricing || !priceEl || !bannerWidthInput || !bannerHeightInput || !bannerUnitSelect || !bannerQuantityInput) return;
     const rate = parseFloat(currentProductData.pricing.rate || 0); const minOrderValue = parseFloat(currentProductData.pricing.minimumOrderValue || 0);
     const width = parseFloat(bannerWidthInput.value || 0); const height = parseFloat(bannerHeightInput.value || 0); const unit = bannerUnitSelect.value || 'feet'; const quantity = parseInt(bannerQuantityInput.value || 1);
     if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0 || isNaN(quantity) || quantity < 1 || isNaN(rate)) { priceEl.textContent = formatIndianCurrency(minOrderValue > 0 ? minOrderValue : 0); return; }
     const calcResult = calculateFlexDimensions(unit, width, height); const printSqFtPerBanner = parseFloat(calcResult.printSqFt || 0);
     if (printSqFtPerBanner <= 0) { priceEl.textContent = formatIndianCurrency(minOrderValue > 0 ? minOrderValue : 0); return; }
     const totalPrintSqFt = printSqFtPerBanner * quantity; const calculatedCost = totalPrintSqFt * rate; const finalCost = Math.max(calculatedCost, minOrderValue);
     priceEl.textContent = formatIndianCurrency(finalCost);
     // Update original price
     if (originalPriceEl) {
        if (currentProductData.pricing?.originalRate && finalCost < (totalPrintSqFt * currentProductData.pricing.originalRate) ) {
            originalPriceEl.textContent = formatIndianCurrency(totalPrintSqFt * currentProductData.pricing.originalRate); originalPriceEl.style.display = 'inline-block';
        } else { originalPriceEl.style.display = 'none'; }
     }
}
function updateWeddingPrice() {
    if (!currentProductData || !currentProductData.pricing || !priceEl) return;
    const quantityDropdown = document.getElementById('wedding-quantity-select'); if (!quantityDropdown) return;
    const selectedQuantity = parseInt(quantityDropdown.value, 10); if (isNaN(selectedQuantity) || selectedQuantity <= 0) { priceEl.textContent = "Select Quantity"; return; }
    const baseRate = parseFloat(currentProductData.pricing.rate || 0); const designCharge = parseFloat(currentProductData.pricing.designCharge || 0); const printingChargeBase = parseFloat(currentProductData.pricing.printingChargeBase || 0); const transportCharge = parseFloat(currentProductData.pricing.transportCharge || 0); const extraMarginPercent = parseFloat(currentProductData.pricing.extraMarginPercent || 0);
    const subTotal = (baseRate * selectedQuantity) + designCharge + printingChargeBase + transportCharge; const finalAmount = subTotal * (1 + (extraMarginPercent / 100));
    priceEl.textContent = formatIndianCurrency(finalAmount);
    // Update original price
     if (originalPriceEl) {
        if (currentProductData.pricing?.originalRate && finalAmount < (baseRate * selectedQuantity) ) { // Simplified original comparison
            originalPriceEl.textContent = formatIndianCurrency(baseRate * selectedQuantity); originalPriceEl.style.display = 'inline-block';
        } else { originalPriceEl.style.display = 'none'; }
     }
}
function renderSimplePrice(productData) {
     if (!productData || !productData.pricing || !priceEl) { priceEl.textContent = 'Contact for Price'; return; }
     let priceDisplay = 'Contact for Price'; const rate = productData.pricing.rate;
     if (typeof rate !== 'undefined' && rate !== null) {
         const unit = productData.unit || 'Qty';
         if (unit.toLowerCase() !== 'sq feet') { priceDisplay = `${formatIndianCurrency(rate)} / ${unit}`; }
         else { const minOrderValue = parseFloat(productData.pricing.minimumOrderValue || 0); priceDisplay = minOrderValue > 0 ? `From ${formatIndianCurrency(minOrderValue)}` : 'Enter Dimensions'; }
     }
     priceEl.textContent = priceDisplay;
     // Update original price
     if (originalPriceEl) {
         if (productData.pricing?.originalRate && rate < productData.pricing.originalRate) {
            originalPriceEl.textContent = formatIndianCurrency(productData.pricing.originalRate); originalPriceEl.style.display = 'inline-block';
         } else { originalPriceEl.style.display = 'none'; }
     }
}

// --- Schema Update Function ---
function updateProductSchema(productData, reviewsData = { average: 0, count: 0, reviews: [] }) {
    // **Error Check 1: Make sure the script tag exists**
    if (!productSchemaScript) {
        console.error("Schema update failed: Script tag with id 'product-schema' not found in HTML.");
        return;
    }
     // **Error Check 2: Make sure product data is valid**
    if (!productData || !productData.productName) {
         console.error("Schema update failed: Invalid product data provided.");
         return;
    }

    // Define the base schema structure
    const schema = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": productData.productName,
        "image": productData.imageUrls || [],
        "description": productData.description || "",
        "sku": productData.sku || currentProductId,
        "brand": { "@type": "Brand", "name": "Madhav Multiprint" },
        "offers": { // Define offers object
            "@type": "Offer",
            "url": window.location.href, // Set URL here
            "priceCurrency": "INR",
            "price": productData.pricing?.rate ?? "0", // Default price
            "availability": productData.isEnabled ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            "itemCondition": "https://schema.org/NewCondition"
        },
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": reviewsData.average.toFixed(1) || "0",
            "reviewCount": reviewsData.count || "0"
        },
        "review": reviewsData.reviews.map(review => ({
             "@type": "Review",
             "author": {"@type": "Person", "name": review.reviewerName || "Anonymous"},
             "datePublished": review.createdAt ? new Date(review.createdAt.seconds * 1000).toISOString().split('T')[0] : "",
             "reviewBody": review.comment || "",
             "reviewRating": { "@type": "Rating", "ratingValue": review.rating || "0" }
        }))
    };

    // Adjust offer price based on product type (Example)
    const category = productData.category?.toLowerCase() || '';
    if (schema.offers) { // Check if offers exists before modifying
        if (category.includes('flex') && productData.pricing?.minimumOrderValue) {
            schema.offers.price = productData.pricing.minimumOrderValue;
        } else if (category.includes('wedding')) {
            schema.offers.price = productData.pricing?.rate; // Base rate example
            // Optionally add priceSpecification for complex pricing
        }
    } else {
        console.error("Schema offers object is unexpectedly undefined during price adjustment!");
    }


    // Update the script tag content
    try {
        productSchemaScript.textContent = JSON.stringify(schema, null, 2);
        // console.log("DEBUG: Schema script updated successfully."); // Optional success log
    } catch (e) {
        console.error("Error updating schema script content:", e);
    }
}


// --- Main Product Loading Logic ---
async function loadProductDetails(productId) {
    if (!loadingIndicator || !productContent || !errorMessageContainer || !tabsContainer) { showError("Core layout elements not found!"); return; }
    loadingIndicator.style.display = 'flex'; productContent.style.display = 'none'; tabsContainer.style.display = 'none'; errorMessageContainer.style.display = 'none';
    if (relatedProductsSection) relatedProductsSection.style.display = 'none';
    if (weddingQuantityContainer) weddingQuantityContainer.innerHTML = '';

    try {
        const productRef = doc(db, "onlineProducts", productId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
            currentProductData = productSnap.data(); currentProductId = productId;
            if (!currentProductData) { showError("Failed to process product data."); return; }

            // --- Populate Base HTML ---
            document.title = `${currentProductData.productName || 'Product'} - Madhav Multiprint`;
            if(breadcrumbProductName) breadcrumbProductName.textContent = currentProductData.productName || 'Product Details';
            if(productNameEl) productNameEl.textContent = currentProductData.productName || 'N/A';

            // --- Populate Images ---
            if (mainImageEl && thumbnailImagesContainer) {
                 if (currentProductData.imageUrls && Array.isArray(currentProductData.imageUrls) && currentProductData.imageUrls.length > 0) {
                    mainImageEl.src = currentProductData.imageUrls[0]; mainImageEl.alt = currentProductData.productName || 'Product image';
                    thumbnailImagesContainer.innerHTML = '';
                    currentProductData.imageUrls.forEach((url, index) => {
                         const thumb = document.createElement('img'); thumb.src = url; thumb.alt = `Thumbnail ${index + 1}`; thumb.classList.add('thumbnail');
                        if (index === 0) thumb.classList.add('active');
                        thumbnailImagesContainer.appendChild(thumb);
                    });
                } else { mainImageEl.src = 'images/placeholder.png'; mainImageEl.alt = 'Placeholder image'; thumbnailImagesContainer.innerHTML = ''; }
            }

            // --- Populate Descriptions ---
            if (descriptionShortEl) descriptionShortEl.textContent = currentProductData.shortDescription || currentProductData.description?.substring(0, 150) + '...' || '';
            if (descriptionFullEl) descriptionFullEl.textContent = currentProductData.description || 'No description available.';

            // --- Setup Product Options & Pricing ---
            const category = currentProductData.category?.toLowerCase() || '';
            if (standardQuantityContainer) standardQuantityContainer.style.display = 'none'; if (flexInputsContainer) flexInputsContainer.style.display = 'none'; if (weddingQuantityContainer) weddingQuantityContainer.style.display = 'none';
            if (category.includes('flex')) {
                if (flexInputsContainer) {
                    flexInputsContainer.style.display = 'grid';
                    [bannerWidthInput, bannerHeightInput, bannerUnitSelect, bannerQuantityInput].forEach(input => { input?.addEventListener('input', updateFlexPrice); });
                    updateFlexPrice();
                }
            } else if (category.includes('wedding')) {
                if (weddingQuantityContainer && currentProductData.options?.find(opt => opt.name?.toLowerCase() === 'quantity')?.values) {
                    const quantityOption = currentProductData.options.find(opt => opt.name.toLowerCase() === 'quantity');
                    const select = document.createElement('select'); select.id = 'wedding-quantity-select'; select.name = 'wedding_quantity'; select.innerHTML = `<option value="">-- Select Quantity --</option>`;
                    quantityOption.values.forEach(val => { select.innerHTML += `<option value="${val}">${val}</option>`; });
                    const label = document.createElement('label'); label.htmlFor = 'wedding-quantity-select'; label.textContent = 'Select Quantity:';
                    weddingQuantityContainer.innerHTML = ''; // Clear previous
                    weddingQuantityContainer.appendChild(label); weddingQuantityContainer.appendChild(select);
                    weddingQuantityContainer.style.display = 'flex'; // Use flex as per CSS potentially
                    select.addEventListener('change', updateWeddingPrice);
                    if(priceEl) priceEl.textContent = "Select Quantity";
                } else { if (standardQuantityContainer) standardQuantityContainer.style.display = 'block'; renderSimplePrice(currentProductData); }
            } else { if (standardQuantityContainer) standardQuantityContainer.style.display = 'block'; renderSimplePrice(currentProductData); }

            // --- Populate Tabs Content ---
            if (specsListEl) {
                specsListEl.innerHTML = '';
                if (currentProductData.specifications && typeof currentProductData.specifications === 'object' && Object.keys(currentProductData.specifications).length > 0) {
                    for (const [key, value] of Object.entries(currentProductData.specifications)) { if (value) { const li = document.createElement('li'); li.innerHTML = `<strong>${formatSpecKey(key)}:</strong> <span>${value}</span>`; specsListEl.appendChild(li); } }
                } else { specsListEl.innerHTML = '<li>No specifications available.</li>'; }
            }
            if (usageCareInfoEl) usageCareInfoEl.textContent = currentProductData.usageInfo || "No usage information available.";
            if (faqListEl) {
                faqListEl.innerHTML = '';
                if (currentProductData.faqs && Array.isArray(currentProductData.faqs) && currentProductData.faqs.length > 0) {
                     currentProductData.faqs.forEach(faq => { const item = document.createElement('div'); item.className = 'faq-item'; item.innerHTML = `<h4>Q: ${faq.question}</h4><p>A: ${faq.answer}</p>`; faqListEl.appendChild(item); });
                } else { faqListEl.innerHTML = '<p>No frequently asked questions available.</p>'; }
            }

            // --- Show Content & Tabs ---
            productContent.style.display = 'grid';
            tabsContainer.style.display = 'block'; // Show tabs
            loadingIndicator.style.display = 'none';

            // --- Load Reviews & Related Products ---
            // Wrap async calls that depend on each other if needed, or use Promise.all
            let reviewsData = { average: 0, count: 0, reviews: [] }; // Default value
            try {
                reviewsData = await loadReviews(productId); // Load reviews
            } catch (reviewError) {
                 console.error("Error caught during loadReviews call:", reviewError);
                 // Use default reviewsData if loading fails, schema update will proceed
            }

            // Update schema only AFTER product data is confirmed and reviews attempted
            updateProductSchema(currentProductData, reviewsData);

            // Load related products
            const currentCategory = currentProductData?.category;
            if (currentCategory) {
                 loadRelatedProducts(productId, currentCategory);
            } else {
                 if(relatedProductsSection) relatedProductsSection.style.display = 'none';
            }

        } else {
            showError("Product not found.");
        }
    } catch (error) {
        // Catch errors during the main product loading phase
        console.error("Error loading product details in main block: ", error);
        // Pass the specific error message part if available
        const specificError = error.message ? `: ${error.message}` : '';
        showError(`Failed to load product details${specificError}`);
    }
}

// --- Related Products Function (using SwiperJS) ---
async function loadRelatedProducts(currentProductId, category) {
     if (!relatedProductsSection || !relatedProductsContainer) return;
    relatedProductsContainer.innerHTML = '<div class="swiper-slide"><p>Loading related products...</p></div>';
     try {
         const q = query(collection(db, "onlineProducts"), where("isEnabled", "==", true), where("category", "==", category), where("__name__", "!=", currentProductId), limit(10));
         const querySnapshot = await getDocs(q); const relatedProducts = [];
         querySnapshot.forEach((doc) => { relatedProducts.push({ id: doc.id, ...doc.data() }); });
         if (relatedProducts.length > 0) {
             relatedProductsContainer.innerHTML = '';
             relatedProducts.forEach(product => {
                 const slide = document.createElement('div'); slide.className = 'swiper-slide';
                 let imageUrl = product.imageUrls?.[0] || 'images/placeholder.png';
                 let priceHTML = 'Contact for Price';
                 const hasPrice = product.pricing && typeof product.pricing.rate !== 'undefined' && product.pricing.rate !== null;
                 if (hasPrice) {
                     const rate = product.pricing.rate; const unit = product.unit || 'Qty';
                     if (unit.toLowerCase() === 'sq feet') { priceHTML = `From ${formatIndianCurrency(rate)} / sq ft`; }
                     else { priceHTML = `${formatIndianCurrency(rate)} / ${unit}`; }
                 }
                 slide.innerHTML = `
                    <div class="product-card">
                        <div class="product-image-container"><a href="product-detail.html?id=${product.id}"><img src="${imageUrl}" alt="${product.productName || 'Product'}" loading="lazy"></a></div>
                        <div class="product-info">
                             <h3><a href="product-detail.html?id=${product.id}">${product.productName || 'Unnamed'}</a></h3>
                             <div class="price">${priceHTML}</div>
                            <a href="product-detail.html?id=${product.id}" class="button-primary view-details-btn">View Details</a>
                        </div>
                    </div>`;
                 relatedProductsContainer.appendChild(slide);
             });
             relatedProductsSection.style.display = 'block';
             if (relatedProductsSwiper) { relatedProductsSwiper.destroy(true, true); relatedProductsSwiper = null; }
             if (typeof Swiper !== 'undefined') {
                 relatedProductsSwiper = new Swiper('.related-products-swiper', {
                    loop: relatedProducts.length > 5, slidesPerView: 2, spaceBetween: 15,
                    autoplay: { delay: 4000, disableOnInteraction: false, },
                    pagination: { el: '.swiper-pagination', clickable: true, },
                    navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev', },
                    breakpoints: { 640: { slidesPerView: 3, spaceBetween: 20 }, 768: { slidesPerView: 4, spaceBetween: 25 }, 1024: { slidesPerView: 5, spaceBetween: 30 } }
                 });
             } else { console.error("Swiper is not defined. Make sure Swiper library is loaded BEFORE this script."); }
         } else { relatedProductsSection.style.display = 'none'; }
     } catch (error) { console.error("Error loading related products:", error); relatedProductsContainer.innerHTML = '<div class="swiper-slide"><p>Error loading related products.</p></div>'; relatedProductsSection.style.display = 'block'; }
}

// --- Review Functions ---
async function loadReviews(productId) {
     if (!reviewsListEl || !averageRatingEl || !reviewCountEl) return { average: 0, count: 0, reviews: [] };
     reviewsListEl.innerHTML = '<p>Loading reviews...</p>'; let totalRating = 0; let reviewCount = 0; const fetchedReviews = [];
     try {
         const reviewsRef = collection(db, "onlineProducts", productId, "reviews");
         const q = query(reviewsRef, orderBy("createdAt", "desc"));
         const querySnapshot = await getDocs(q);
         if (!querySnapshot.empty) {
             reviewsListEl.innerHTML = ''; // Clear loading
             querySnapshot.forEach((doc) => {
                 const review = { id: doc.id, ...doc.data() }; fetchedReviews.push(review);
                 const reviewItem = document.createElement('div'); reviewItem.className = 'review-item';
                 const rating = review.rating || 0; const starsHTML = Array(5).fill(0).map((_, i) => `<i class="fas fa-star${i < rating ? '' : '-empty'}" style="color: #f0ad4e;"></i>`).join('');
                 const date = review.createdAt?.seconds ? new Date(review.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
                 reviewItem.innerHTML = `<div class="review-rating">${starsHTML}</div> <p class="review-comment">${review.comment || ''}</p> <p class="review-meta">By <strong>${review.reviewerName || 'Anonymous'}</strong> on ${date}</p>`;
                 reviewsListEl.appendChild(reviewItem); totalRating += rating; reviewCount++;
             });
             const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;
             averageRatingEl.textContent = `${averageRating.toFixed(1)} / 5`; reviewCountEl.textContent = reviewCount;
             return { average: averageRating, count: reviewCount, reviews: fetchedReviews };
         } else { reviewsListEl.innerHTML = '<p>No reviews yet. Be the first!</p>'; averageRatingEl.textContent = 'N/A'; reviewCountEl.textContent = '0'; return { average: 0, count: 0, reviews: [] }; }
     } catch (error) {
         console.error("Error loading reviews:", error); // Log the specific error
         // **Display permission error message specifically**
         if (error.code === 'permission-denied' || error.message.includes('permission')) {
              reviewsListEl.innerHTML = '<p>Could not load reviews due to permission issues. Please check Firestore rules.</p>';
         } else {
              reviewsListEl.innerHTML = '<p>Could not load reviews.</p>';
         }
         averageRatingEl.textContent = 'Error'; reviewCountEl.textContent = '0';
         // Rethrow or handle as needed, but return default for schema function
         // throw error; // Or rethrow if needed elsewhere
          return { average: 0, count: 0, reviews: [] }; // Return default on error
     }
}

async function submitReview(event) {
     event.preventDefault(); if (!reviewForm || !currentProductId || !reviewFeedbackEl) return;
     const reviewerName = reviewForm.elements['reviewer_name']?.value.trim(); const comment = reviewForm.elements['review_comment']?.value.trim();
     const ratingInput = reviewForm.querySelector('input[name="rating"]:checked'); const rating = ratingInput ? parseInt(ratingInput.value, 10) : 0;
     if (!reviewerName || !comment || rating === 0) { showFeedback(reviewFeedbackEl, "Please fill in all fields and select a rating.", true); return; }
     const submitButton = reviewForm.querySelector('button[type="submit"]');
     submitButton.disabled = true; showFeedback(reviewFeedbackEl, "Submitting review...", false);
     try {
         const reviewsRef = collection(db, "onlineProducts", currentProductId, "reviews");
         await addDoc(reviewsRef, { reviewerName, comment, rating, createdAt: serverTimestamp() });
         showFeedback(reviewFeedbackEl, "Review submitted successfully!", false); reviewForm.reset();
         const reviewsData = await loadReviews(currentProductId); updateProductSchema(currentProductData, reviewsData);
     } catch (error) { console.error("Error submitting review:", error); showFeedback(reviewFeedbackEl, `Failed to submit review. ${error.message}`, true);
     } finally { submitButton.disabled = false; }
}

// --- Add to Cart Handler ---
function handleAddToCart() {
     if (!currentProductId || !currentProductData || !cartFeedbackEl) { showFeedback(cartFeedbackEl, "Error: Product data not loaded.", true); return; }
     const category = currentProductData.category?.toLowerCase() || ''; let itemToAdd = { productId: currentProductId, quantity: 0 }; let cartOptions = {};
     try {
         if (category.includes('flex')) {
             const width = parseFloat(bannerWidthInput?.value || 0); const height = parseFloat(bannerHeightInput?.value || 0); const unit = bannerUnitSelect?.value || 'feet'; const quantity = parseInt(bannerQuantityInput?.value || 1);
             if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0 || isNaN(quantity) || quantity < 1) { showFeedback(cartFeedbackEl, "Please enter valid dimensions and quantity.", true); return; }
             const rate = parseFloat(currentProductData.pricing?.rate || 0); const minOrderValue = parseFloat(currentProductData.pricing?.minimumOrderValue || 0); const calcResult = calculateFlexDimensions(unit, width, height); const printSqFtPerBanner = parseFloat(calcResult.printSqFt || 0);
             if (printSqFtPerBanner <= 0 || isNaN(rate)) { showFeedback(cartFeedbackEl, "Error calculating price. Cannot add to cart.", true); return; }
             const totalPrintSqFt = printSqFtPerBanner * quantity; const calculatedCost = totalPrintSqFt * rate; const finalCost = Math.max(calculatedCost, minOrderValue);
             itemToAdd.quantity = quantity; cartOptions = { type: 'Flex', dimensions: { width, height, unit }, printSqFt: printSqFtPerBanner.toFixed(2), price: finalCost };
         }
         else if (category.includes('wedding')) {
             const quantityDropdown = document.getElementById('wedding-quantity-select'); if (!quantityDropdown || !quantityDropdown.value) { showFeedback(cartFeedbackEl, "Please select a quantity.", true); return; }
             const selectedQuantity = parseInt(quantityDropdown.value, 10);
             // Recalculate price (ensure logic matches updateWeddingPrice)
             const baseRate = parseFloat(currentProductData.pricing?.rate || 0); const designCharge = parseFloat(currentProductData.pricing?.designCharge || 0); const printingChargeBase = parseFloat(currentProductData.pricing?.printingChargeBase || 0); const transportCharge = parseFloat(currentProductData.pricing?.transportCharge || 0); const extraMarginPercent = parseFloat(currentProductData.pricing?.extraMarginPercent || 0);
             const subTotal = (baseRate * selectedQuantity) + designCharge + printingChargeBase + transportCharge; const finalAmount = subTotal * (1 + (extraMarginPercent / 100));
             itemToAdd.quantity = selectedQuantity; cartOptions = { type: 'Wedding Card', price: finalAmount };
         }
         else { // Standard Product
             const quantityInput = standardQuantityContainer?.querySelector('.quantity-input'); if (!quantityInput) { throw new Error("Standard quantity input not found"); }
             const quantity = parseInt(quantityInput.value || 1);
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
    if (thumbnailImagesContainer) { thumbnailImagesContainer.addEventListener('click', (event) => { if (event.target.tagName === 'IMG' && mainImageEl) { mainImageEl.src = event.target.src; thumbnailImagesContainer.querySelectorAll('img').forEach(thumb => thumb.classList.remove('active')); event.target.classList.add('active'); } }); }

     // Tab Navigation
     if (tabsNavLinks.length > 0 && tabPanes.length > 0) { tabsNavLinks.forEach(link => { link.addEventListener('click', (event) => { event.preventDefault(); const targetTabId = link.getAttribute('href'); if (!targetTabId) return; tabsNavLinks.forEach(navLink => navLink.classList.remove('active')); tabPanes.forEach(pane => pane.classList.remove('active')); link.classList.add('active'); const targetPane = document.querySelector(targetTabId); if(targetPane) targetPane.classList.add('active'); }); }); }

     // Quantity Buttons (Event Delegation)
     const quantityWrappers = document.querySelectorAll('.quantity-input-wrapper');
     quantityWrappers.forEach(wrapper => { wrapper.addEventListener('click', (event) => { const button = event.target.closest('.quantity-btn'); if (!button) return; const input = wrapper.querySelector('.quantity-input'); if (!input) return; const currentValue = parseInt(input.value, 10) || 1; const min = parseInt(input.min, 10) || 1; let newValue = currentValue; if (button.classList.contains('quantity-increase')) { newValue = currentValue + 1; } else if (button.classList.contains('quantity-decrease')) { newValue = currentValue - 1; } if (newValue < min) { newValue = min; } input.value = newValue; if (input.id === 'banner-quantity') { updateFlexPrice(); } }); });

     // Review Form Submission
     if (reviewForm) { reviewForm.addEventListener('submit', submitReview); }

     // Social Sharing Links
      if (socialShareLinks.length > 0) { socialShareLinks.forEach(link => { link.addEventListener('click', (event) => { event.preventDefault(); if (!currentProductData?.productName) return; const pageUrl = window.location.href; const productName = encodeURIComponent(currentProductData.productName); let shareUrl = ''; const network = link.getAttribute('aria-label')?.toLowerCase() || ''; if (network.includes('facebook')) { shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`; } else if (network.includes('twitter')) { shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${productName}`; } else if (network.includes('whatsapp')) { shareUrl = `https://api.whatsapp.com/send?text=${productName}%20${encodeURIComponent(pageUrl)}`; } if (shareUrl) { window.open(shareUrl, '_blank', 'width=600,height=400'); } }); }); }
}

// --- Initialize Page ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    if (!productId) { showError("Product ID not found in URL."); return; }
    loadProductDetails(productId);
    setupEventListeners();
});