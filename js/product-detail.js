// js/product-detail.js
// FINAL UPDATED Version: Uses 'onlineProducts', fixes Wedding Qty logic.
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
const thumbnailImagesContainer = document.getElementById('thumbnail-images'); // Corrected ID reference
const priceEl = document.getElementById('product-price'); // Main price display SPAN
const originalPriceEl = document.getElementById('original-price'); // Optional original price SPAN
const addToCartBtn = document.getElementById('add-to-cart-btn');
const cartFeedbackEl = document.getElementById('cart-feedback'); // Feedback P element
const productSchemaScript = document.getElementById('product-schema');
const descriptionShortEl = document.getElementById('product-description-short'); // Short description P element
const descriptionFullEl = document.getElementById('product-description-full'); // Full description P element in tab
const specsListEl = document.getElementById('product-specs'); // Specs UL element in tab
const usageCareInfoEl = document.getElementById('usage-care-info'); // Usage/care P element in tab
const faqListEl = document.getElementById('faq-list'); // FAQ DIV element in tab
const standardQuantityContainer = document.getElementById('standard-quantity-container'); // DIV for standard qty controls
const flexInputsContainer = document.getElementById('flex-inputs-container'); // DIV for flex inputs
const weddingQuantityContainer = document.getElementById('wedding-quantity-container'); // DIV for wedding qty dropdown
const standardQuantityInput = document.getElementById('quantity'); // Standard quantity INPUT
const bannerWidthInput = document.getElementById('banner-width'); // Flex width INPUT
const bannerHeightInput = document.getElementById('banner-height'); // Flex height INPUT
const bannerUnitSelect = document.getElementById('banner-unit'); // Flex unit SELECT
const bannerQuantityInput = document.getElementById('banner-quantity'); // Flex quantity INPUT
const tabsContainer = document.querySelector('.product-details-tabs'); // Main tabs container DIV
const tabsNavLinks = document.querySelectorAll('.tabs-nav a'); // Tab navigation links
const tabPanes = document.querySelectorAll('.tabs-content .tab-pane'); // Tab content panes
const relatedProductsSection = document.getElementById('related-products-section'); // Related products SECTION
const relatedProductsContainer = document.getElementById('related-products-container'); // Swiper wrapper DIV
const reviewsListEl = document.getElementById('reviews-list'); // Review list DIV
const reviewForm = document.getElementById('review-form'); // Review FORM element
const reviewFeedbackEl = document.getElementById('review-feedback'); // Review feedback P element
const averageRatingEl = document.getElementById('average-rating'); // Average rating SPAN
const reviewCountEl = document.getElementById('review-count'); // Review count SPAN
const socialShareLinksContainer = document.querySelector('.social-sharing'); // Container for social links

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
        errorMessageContainer.textContent = message;
        errorMessageContainer.style.display = 'block';
    }
    document.title = "Error - Madhav Multiprint";
    if (breadcrumbProductName) breadcrumbProductName.textContent = "Error";
}
function showFeedback(element, message, isError = false) {
     if (element) {
        element.textContent = message;
        element.className = `cart-feedback-message ${isError ? 'error' : 'success'}`; // Ensure correct base class
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, 3000);
    }
}

// --- Flex Banner Calculation Logic ---
// (Keep the existing robust calculateFlexDimensions function)
const mediaWidthsFt = [3, 4, 5, 6, 8, 10]; // Default, can be overridden by product data
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


// --- Update Price Functions (Separate logic for clarity) ---

function updateFlexPriceDisplay() {
     const width = parseFloat(bannerWidthInput?.value);
     const height = parseFloat(bannerHeightInput?.value);
     const unit = bannerUnitSelect?.value;
     const quantity = parseInt(bannerQuantityInput?.value, 10);
     const pricing = currentProductData?.pricing;

     if (!pricing || isNaN(width) || width <= 0 || isNaN(height) || height <= 0 || isNaN(quantity) || quantity <= 0) {
         priceEl.textContent = "Enter valid dimensions & quantity"; return;
     }
     const ratePerSqFt = parseFloat(pricing.rate);
     if (isNaN(ratePerSqFt) || ratePerSqFt <= 0) { priceEl.textContent = "Pricing unavailable"; return; }
     const minimumOrderValue = parseFloat(pricing.minimumOrderValue || 0);
     const mediaWidths = pricing.mediaWidths || mediaWidthsFt; // Use default if not specified

     const widthFt = unit === 'inches' ? width / 12 : width;
     const heightFt = unit === 'inches' ? height / 12 : height;
     const dimResult = calculateFlexDimensions(widthFt, heightFt, mediaWidths);
     if (dimResult.error || isNaN(dimResult.printSqFtPerBanner) || dimResult.printSqFtPerBanner <= 0) {
         priceEl.textContent = dimResult.error || "Calculation error"; return;
     }
     const printSqFtPerBanner = dimResult.printSqFtPerBanner;
     const totalPrintSqFt = printSqFtPerBanner * quantity;
     const calculatedCost = totalPrintSqFt * ratePerSqFt;
     const finalCost = Math.max(calculatedCost, minimumOrderValue);

     priceEl.textContent = formatIndianCurrency(finalCost);
     if (originalPriceEl) originalPriceEl.style.display = 'none'; // Flex usually doesn't have original price concept like this
}

function updateWeddingPriceDisplay() {
    const quantityDropdown = document.getElementById('wedding-quantity-select');
    const selectedQuantity = parseInt(quantityDropdown?.value, 10);
    const pricing = currentProductData?.pricing;

    if (!pricing || isNaN(selectedQuantity) || selectedQuantity <= 0) {
        priceEl.textContent = "Select Quantity"; return;
    }
    const baseRate = parseFloat(pricing.rate);
    if (isNaN(baseRate)) { priceEl.textContent = "Price info missing"; return; }
    const designCharge = parseFloat(pricing.designCharge || 0);
    const printingChargeBase = parseFloat(pricing.printingChargeBase || 0);
    const transportCharge = parseFloat(pricing.transportCharge || 0);
    const extraMarginPercent = parseFloat(pricing.extraMarginPercent || 0);

    const subTotal = (baseRate * selectedQuantity) + designCharge + printingChargeBase + transportCharge;
    const finalAmount = subTotal * (1 + (extraMarginPercent / 100));
    const averageUnitPrice = finalAmount / selectedQuantity;

    if (isNaN(finalAmount)) { priceEl.textContent = "Calculation Error"; return; }

    priceEl.textContent = `${formatIndianCurrency(finalAmount)} (${formatIndianCurrency(averageUnitPrice)}/card)`;
    // Handle original price if applicable (logic depends on how original price is defined for wedding cards)
    if (originalPriceEl) {
        if (pricing.originalRate && averageUnitPrice < pricing.originalRate) { // Example condition
             originalPriceEl.textContent = formatIndianCurrency(pricing.originalRate) + "/card (Original)";
             originalPriceEl.style.display = 'inline-block';
        } else {
            originalPriceEl.style.display = 'none';
        }
    }
}

function renderStandardPriceDisplay(pricing) {
     if (!pricing || typeof pricing.rate !== 'number') {
          priceEl.textContent = 'Price Unavailable';
          if (originalPriceEl) originalPriceEl.style.display = 'none';
          return;
     }
     priceEl.textContent = formatIndianCurrency(pricing.rate);
     if (originalPriceEl) {
         if (typeof pricing.originalRate === 'number' && pricing.originalRate > pricing.rate) {
            originalPriceEl.textContent = formatIndianCurrency(pricing.originalRate);
            originalPriceEl.style.display = 'inline';
         } else {
            originalPriceEl.style.display = 'none';
         }
     }
}

// --- Populate Wedding Dropdown (Corrected Logic) ---
function populateWeddingQuantities(optionsArray) {
    const selectEl = document.getElementById('wedding-quantity-select'); // Ensure this ID exists in HTML within weddingQuantityContainer
    if (!selectEl) { console.error("Wedding quantity select element not found!"); return; }

    selectEl.innerHTML = '<option value="">Select Quantity</option>'; // Default prompt

    // Find the option object named 'Quantity' within the options array
    const quantityOptionData = optionsArray?.find(opt => opt && opt.name?.toLowerCase() === 'quantity');

    if (!quantityOptionData || !Array.isArray(quantityOptionData.values) || quantityOptionData.values.length === 0) {
        console.warn("Wedding quantities data missing or invalid within product options.");
        selectEl.innerHTML += '<option disabled>Quantities not available</option>'; // Show unavailability
        return;
    }

    quantityOptionData.values.forEach(val => {
        const numQty = Number(val); // Convert to number
        if (!isNaN(numQty) && numQty > 0) {
            const option = document.createElement('option');
            option.value = numQty;
            option.textContent = numQty;
            selectEl.appendChild(option);
        } else {
            console.warn("Invalid quantity value found in wedding options array:", val);
        }
    });
}


// --- Schema Update Function ---
function updateProductSchema(productData, reviewsData = { average: 0, count: 0, reviews: [] }) {
    if (!productSchemaScript || !productData || !productData.productName) return;
    let priceForSchema = productData.pricing?.rate ?? "0"; // Default
    const category = productData.category?.toLowerCase() || '';
    if (category.includes('flex') && productData.pricing?.minimumOrderValue) {
        priceForSchema = productData.pricing.minimumOrderValue;
    }

    const schema = {
        "@context": "https://schema.org/", "@type": "Product",
        "name": productData.productName, "image": productData.imageUrls || [],
        "description": productData.description || productData.shortDescription || "",
        "sku": productData.sku || currentProductId,
        "brand": { "@type": "Brand", "name": productData.brand || "Madhav Multiprint" }, // Use brand if exists, else default
        "offers": {
            "@type": "Offer", "url": window.location.href, "priceCurrency": "INR",
            "price": priceForSchema.toString(), // Use determined price, ensure string
            "availability": productData.isEnabled ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", // Use isEnabled field
            "itemCondition": "https://schema.org/NewCondition"
        },
        "aggregateRating": {
            "@type": "AggregateRating", "ratingValue": reviewsData.average.toFixed(1) || "0", "reviewCount": reviewsData.count || "0"
        },
        "review": reviewsData.reviews.map(review => ({
             "@type": "Review", "author": {"@type": "Person", "name": review.reviewerName || "Anonymous"},
             "datePublished": review.createdAt?.seconds ? new Date(review.createdAt.seconds * 1000).toISOString().split('T')[0] : "",
             "reviewBody": review.comment || "", "reviewRating": { "@type": "Rating", "ratingValue": review.rating || "0" }
        }))
    };
    try { productSchemaScript.textContent = JSON.stringify(schema, null, 2); }
    catch (e) { console.error("Error updating schema script:", e); }
}

// --- Main Product Loading Logic ---
async function loadProductDetails(productId) {
    if (!loadingIndicator || !productContent || !errorMessageContainer || !tabsContainer) { showError("Core layout elements missing!"); return; }
    showLoading(true);
    if (relatedProductsSection) relatedProductsSection.style.display = 'none';
    if (weddingQuantityContainer) weddingQuantityContainer.innerHTML = ''; // Clear specifically

    try {
        const productRef = doc(db, "onlineProducts", productId); // Fetch from onlineProducts
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
            currentProductData = productSnap.data(); currentProductId = productId;
            if (!currentProductData) { showError("Failed to process product data."); return; }
            // Ensure pricing object exists (important!)
            if (!currentProductData.pricing) { currentProductData.pricing = {}; }
             // Ensure options array exists if needed (important!)
             if (!currentProductData.options) { currentProductData.options = []; }


            // --- Populate Base HTML ---
            document.title = `${currentProductData.productName || 'Product'} - Madhav Multiprint`;
            if(breadcrumbProductName) breadcrumbProductName.textContent = currentProductData.productName || 'Details';
            if(productNameEl) productNameEl.textContent = currentProductData.productName || 'N/A';

            // --- Populate Images ---
            if (mainImageEl && thumbnailImagesContainer) {
                const imageUrls = currentProductData.imageUrls && Array.isArray(currentProductData.imageUrls) ? currentProductData.imageUrls : [];
                if (imageUrls.length > 0) {
                    mainImageEl.src = imageUrls[0]; mainImageEl.alt = currentProductData.productName || 'Product image';
                    thumbnailImagesContainer.innerHTML = '';
                    imageUrls.forEach((url, index) => { /* ... thumbnail logic ... */
                         const thumb = document.createElement('img'); thumb.src = url; thumb.alt = `Thumbnail ${index + 1}`; thumb.classList.add('thumbnail');
                         if (index === 0) thumb.classList.add('active');
                         thumbnailImagesContainer.appendChild(thumb);
                    });
                    thumbnailImagesContainer.style.display = imageUrls.length > 1 ? 'grid' : 'none'; // Show only if more than 1 image
                } else { mainImageEl.src = 'images/placeholder.png'; mainImageEl.alt = 'Placeholder'; thumbnailImagesContainer.innerHTML = ''; thumbnailImagesContainer.style.display = 'none';}
            }

            // --- Populate Descriptions ---
            if (descriptionShortEl) descriptionShortEl.textContent = currentProductData.shortDescription || currentProductData.description?.substring(0, 150) + '...' || '';
            if (descriptionFullEl) descriptionFullEl.innerHTML = currentProductData.description || 'No description available.'; // Use innerHTML if needed

            // --- Setup Product Options & Pricing ---
            const category = currentProductData.category?.toLowerCase() || '';
            // Hide all option containers initially
            if (standardQuantityContainer) standardQuantityContainer.style.display = 'none';
            if (flexInputsContainer) flexInputsContainer.style.display = 'none';
            if (weddingQuantityContainer) weddingQuantityContainer.style.display = 'none';

            if (category.includes('flex')) {
                if (flexInputsContainer) flexInputsContainer.style.display = 'grid'; // Show flex container
                updateFlexPriceDisplay(); // Initial price calculation
            } else if (category.includes('wedding')) {
                if (weddingQuantityContainer) {
                     // ** Add the select dropdown HTML here if it's not static in product-detail.html **
                     // Ensure the select element exists before populating
                     if (!document.getElementById('wedding-quantity-select')) {
                          const label = document.createElement('label'); label.htmlFor = 'wedding-quantity-select'; label.textContent = 'Select Quantity:';
                          const select = document.createElement('select'); select.id = 'wedding-quantity-select'; select.name = 'wedding_quantity';
                          weddingQuantityContainer.appendChild(label);
                          weddingQuantityContainer.appendChild(select);
                     }
                     weddingQuantityContainer.style.display = 'flex'; // Show wedding container
                     populateWeddingQuantities(currentProductData.options); // Populate using CORRECTED logic
                     updateWeddingPriceDisplay(); // Initial price display (likely "Select Quantity")
                }
            } else {
                 if (standardQuantityContainer) standardQuantityContainer.style.display = 'block'; // Show standard qty
                 renderStandardPriceDisplay(currentProductData.pricing); // Render standard price
            }

            // --- Populate Tabs Content ---
             if (specsListEl) { /* ... spec logic ... */
                 specsListEl.innerHTML = '';
                 if (currentProductData.specifications && typeof currentProductData.specifications === 'object' && Object.keys(currentProductData.specifications).length > 0) {
                     for (const [key, value] of Object.entries(currentProductData.specifications)) { if (value) { const li = document.createElement('li'); li.innerHTML = `<strong>${formatSpecKey(key)}:</strong> <span>${value}</span>`; specsListEl.appendChild(li); } }
                 } else { specsListEl.innerHTML = '<li>No specifications available.</li>'; }
             }
             if (usageCareInfoEl) usageCareInfoEl.textContent = currentProductData.usageInfo || "No usage information available.";
             if (faqListEl) { await fetchAndDisplayFAQs(currentProductData.faqIds || []); } // Fetch FAQs if IDs exist


            // --- Show Content & Tabs ---
            productContent.style.display = 'grid'; // Use 'grid' as per your CSS
            tabsContainer.style.display = 'block';
            loadingIndicator.style.display = 'none';

            // --- Load Reviews & Related Products ---
            let reviewsData = { average: 0, count: 0, reviews: [] }; // Default
            try { reviewsData = await fetchAndDisplayReviews(productId); } // Load reviews using correct subcollection path
            catch (reviewError) { console.error("Error loading reviews (caught):", reviewError); }

            updateProductSchema(currentProductData, reviewsData); // Update schema

            if (currentProductData.category) { // Load related only if category exists
                 fetchRelatedProducts(productId, currentProductData.category);
            } else { if(relatedProductsSection) relatedProductsSection.style.display = 'none'; }

            // Attach event listeners AFTER everything is rendered
            setupAllEventListeners();


        } else { showError(`Product not found (ID: ${productId}).`); }
    } catch (error) {
        console.error("Error in loadProductDetails:", error);
        showError(`Failed to load details: ${error.message}`);
    } finally { showLoading(false); }
}


// --- Related Products ---
async function fetchRelatedProducts(currentProdId, category) {
     if (!relatedProductsSection || !relatedProductsContainer) return;
    relatedProductsContainer.innerHTML = '<div class="swiper-slide"><p>Loading...</p></div>'; // Loading state
     try {
         const productsRef = collection(db, "onlineProducts"); // Use correct collection
         // Query needs refinement: Cannot use inequality (!=) on document ID AND other fields simultaneously easily.
         // Fetch by category and filter client-side, OR ensure a unique field can be used for exclusion.
         // Let's fetch by category and filter current ID later.
         const q = query(collection(db, "onlineProducts"), where("category", "==", category), limit(10)); // Fetch a bit more
         const querySnapshot = await getDocs(q); const relatedProducts = [];
         querySnapshot.forEach((doc) => {
             if (doc.id !== currentProdId) { // Filter current product ID here
                 relatedProducts.push({ id: doc.id, ...doc.data() });
             }
         });
         relatedProducts = relatedProducts.slice(0, 6); // Limit to display

         if (relatedProducts.length > 0) {
             displayRelatedProducts(relatedProducts); // Call display function
             relatedProductsSection.style.display = 'block';
         } else { relatedProductsSection.style.display = 'none'; }
     } catch (error) { console.error("Error loading related products:", error); /* Show error message */ }
}

function displayRelatedProducts(products) { // Separated display logic
    relatedProductsContainer.innerHTML = ''; // Clear loading
    products.forEach(product => {
        const slide = document.createElement('div'); slide.className = 'swiper-slide';
        let imageUrl = product.imageUrls?.[0] || 'images/placeholder.png';
        let priceHTML = 'Contact for Price';
        const pricing = product.pricing;
        if (pricing && typeof pricing.rate === 'number') {
             priceHTML = formatIndianCurrency(pricing.rate);
             if(product.unit && product.unit !== 'QTY') priceHTML += ` / ${product.unit}`;
        }
        slide.innerHTML = `
           <div class="product-card">
               <div class="product-image-container"><a href="product-detail.html?id=${product.id}"><img src="${imageUrl}" alt="${product.productName || 'Product'}" loading="lazy"></a></div>
               <div class="product-info">
                    <h3><a href="product-detail.html?id=${product.id}">${product.productName || 'Unnamed'}</a></h3> <div class="price">${priceHTML}</div>
                   <a href="product-detail.html?id=${product.id}" class="button-primary view-details-btn">View Details</a>
               </div>
           </div>`;
        relatedProductsContainer.appendChild(slide);
    });
    initializeRelatedProductsSwiper(); // Initialize swiper after adding slides
}

function initializeRelatedProductsSwiper() {
     if (typeof Swiper === 'undefined') { console.error("Swiper library not loaded."); return; }
     if (relatedProductsContainer.swiper) relatedProductsContainer.swiper.destroy(true, true);
     relatedProductsContainer.swiper = new Swiper('.related-products-swiper', { // Assign to container property
         loop: relatedProductsContainer.querySelectorAll('.swiper-slide').length > 5, // Loop only if enough slides
         slidesPerView: 2, spaceBetween: 15,
         autoplay: { delay: 4000, disableOnInteraction: false, },
         pagination: { el: '.swiper-pagination', clickable: true, },
         navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev', },
         breakpoints: { 640: { slidesPerView: 3 }, 768: { slidesPerView: 4 }, 1024: { slidesPerView: 5 } }
     });
}

// --- Review Functions (Using subcollection path) ---
async function fetchAndDisplayReviews(productId) {
     if (!reviewsListEl || !averageRatingEl || !reviewCountEl || !productId) return { average: 0, count: 0, reviews: [] }; // Return default data
     reviewsListEl.innerHTML = '<p>Loading reviews...</p>'; let totalRating = 0; let reviewCount = 0; const fetchedReviews = [];
     try {
         const reviewsRef = collection(db, "onlineProducts", productId, "reviews"); // Correct Path
         const q = query(reviewsRef, orderBy("createdAt", "desc"));
         const querySnapshot = await getDocs(q);
         if (!querySnapshot.empty) {
             reviewsListEl.innerHTML = '';
             querySnapshot.forEach((doc) => { /* ... review rendering logic ... */
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
         } else { reviewsListEl.innerHTML = '<p>No reviews yet.</p>'; averageRatingEl.textContent = 'N/A'; reviewCountEl.textContent = '0'; return { average: 0, count: 0, reviews: [] }; }
     } catch (error) { /* ... error handling ... */
         console.error("Error loading reviews:", error); reviewsListEl.innerHTML = '<p>Could not load reviews.</p>';
         averageRatingEl.textContent = 'Error'; reviewCountEl.textContent = '0'; return { average: 0, count: 0, reviews: [] };
     }
}

async function handleReviewSubmit(event, productId) {
     event.preventDefault(); if (!reviewForm || !productId || !reviewFeedbackEl) return;
     const reviewerName = reviewForm.elements['reviewer_name']?.value.trim();
     const comment = reviewForm.elements['review_comment']?.value.trim();
     const ratingInput = reviewForm.querySelector('input[name="rating"]:checked');
     const rating = ratingInput ? parseInt(ratingInput.value, 10) : 0;
     if (!reviewerName || !comment || rating === 0) { showFeedback(reviewFeedbackEl, "Please fill name, comment and rating.", true); return; }
     const submitButton = reviewForm.querySelector('button[type="submit"]');
     if (submitButton) submitButton.disabled = true; showFeedback(reviewFeedbackEl, "Submitting...", false);
     try {
         const reviewsRef = collection(db, "onlineProducts", productId, "reviews"); // Correct Path
         await addDoc(reviewsRef, { reviewerName, comment, rating, createdAt: serverTimestamp() });
         showFeedback(reviewFeedbackEl, "Review submitted!", false); reviewForm.reset();
         const reviewsData = await fetchAndDisplayReviews(productId); // Reload reviews
         updateProductSchema(currentProductData, reviewsData); // Update schema
     } catch (error) { console.error("Error submitting review:", error); showFeedback(reviewFeedbackEl, `Failed: ${error.message}`, true);
     } finally { if (submitButton) submitButton.disabled = false; }
}


// --- FAQ System ---
async function fetchAndDisplayFAQs(faqIds) {
    if (!faqListEl || !faqIds || faqIds.length === 0) { if (faqListEl) faqListEl.innerHTML = '<p>No FAQs available.</p>'; return; }
    faqListEl.innerHTML = '<p>Loading FAQs...</p>';
    try {
        const faqs = [];
        for (const id of faqIds) { if (!id) continue; const faqRef = doc(db, "faqs", id); const docSnap = await getDoc(faqRef); if (docSnap.exists()) faqs.push({ id: docSnap.id, ...docSnap.data() }); }
        if (faqs.length > 0) { /* ... render FAQs ... */
             faqListEl.innerHTML = faqs.map((faq, index) => `<details class="faq-item"><summary class="faq-question">${index + 1}. ${faq.question}</summary><div class="faq-answer">${faq.answer}</div></details>`).join('');
        } else { faqListEl.innerHTML = '<p>No FAQs available.</p>'; }
    } catch (error) { console.error("Error fetching FAQs:", error); faqListEl.innerHTML = `<p class="error">Could not load FAQs.</p>`; }
}

// --- Social Sharing ---
function setupSocialSharing() {
     if (!socialShareLinksContainer) return;
     socialShareLinksContainer.addEventListener('click', (event) => {
         event.preventDefault();
         const link = event.target.closest('a.social-icon');
         if (!link || !currentProductData || !currentProductData.productName) return;
         const pageUrl = window.location.href;
         const productName = encodeURIComponent(currentProductData.productName);
         let shareUrl = '';
         const network = link.getAttribute('aria-label')?.toLowerCase() ?? '';
         if (network.includes('facebook')) { shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`; }
         else if (network.includes('twitter')) { shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${productName}`; }
         else if (network.includes('whatsapp')) { shareUrl = `https://api.whatsapp.com/send?text=${productName}%20${encodeURIComponent(pageUrl)}`; }
         if (shareUrl) window.open(shareUrl, '_blank', 'width=600,height=400,noopener,noreferrer');
     });
}

// --- Add to Cart Handler ---
function handleAddToCart() {
     if (!currentProductId || !currentProductData) { showFeedback(cartFeedbackEl, "Product data not ready.", true); return; }
     if (cartFeedbackEl) cartFeedbackEl.style.display = 'none'; // Clear previous feedback
     try {
         let cartOptions = { name: currentProductData.productName, imageUrl: mainImageEl?.src || 'img/placeholder.png' };
         let itemToAdd = { productId: currentProductId, quantity: 1 };
         const category = currentProductData.category?.toLowerCase() || '';
         const pricing = currentProductData.pricing || {};

         if (category.includes('wedding')) {
             const quantityDropdown = document.getElementById('wedding-quantity-select');
             const selectedQuantity = parseInt(quantityDropdown?.value, 10);
             if (!quantityDropdown || isNaN(selectedQuantity) || selectedQuantity <= 0) { showFeedback(cartFeedbackEl, "Select wedding quantity.", true); return; }
             const baseRate = parseFloat(pricing.rate);
             if (isNaN(baseRate)) { showFeedback(cartFeedbackEl, "Price info missing.", true); return; }
             const designCharge = parseFloat(pricing.designCharge || 0); const printingChargeBase = parseFloat(pricing.printingChargeBase || 0); const transportCharge = parseFloat(pricing.transportCharge || 0); const extraMarginPercent = parseFloat(pricing.extraMarginPercent || 0);
             const subTotal = (baseRate * selectedQuantity) + designCharge + printingChargeBase + transportCharge; const finalAmount = subTotal * (1 + (extraMarginPercent / 100)); const averageUnitPrice = finalAmount / selectedQuantity;
             if (isNaN(averageUnitPrice) || averageUnitPrice <= 0) { showFeedback(cartFeedbackEl, "Could not calculate price.", true); return; }
             itemToAdd.quantity = selectedQuantity; cartOptions = { ...cartOptions, type: 'Wedding Card', price: averageUnitPrice };
         } else if (category.includes('flex')) {
             const width = parseFloat(bannerWidthInput?.value); const height = parseFloat(bannerHeightInput?.value); const unit = bannerUnitSelect?.value; const quantity = parseInt(bannerQuantityInput?.value, 10);
             if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0 || isNaN(quantity) || quantity <= 0) { showFeedback(cartFeedbackEl, "Enter valid flex dimensions & quantity.", true); return; }
             const ratePerSqFt = parseFloat(pricing.rate); if (isNaN(ratePerSqFt) || ratePerSqFt <= 0) { showFeedback(cartFeedbackEl, "Flex price info missing.", true); return; }
             const minimumOrderValue = parseFloat(pricing.minimumOrderValue || 0); const mediaWidths = pricing.mediaWidths || mediaWidthsFt;
             const widthFt = unit === 'inches' ? width / 12 : width; const heightFt = unit === 'inches' ? height / 12 : height;
             const dimResult = calculateFlexDimensions(widthFt, heightFt, mediaWidths); if (dimResult.error || isNaN(dimResult.printSqFtPerBanner) || dimResult.printSqFtPerBanner <= 0) { showFeedback(cartFeedbackEl, dimResult.error || "Cannot calculate area.", true); return; }
             const printSqFtPerBanner = dimResult.printSqFtPerBanner; const totalPrintSqFt = printSqFtPerBanner * quantity; const calculatedCost = totalPrintSqFt * ratePerSqFt; const finalCost = Math.max(calculatedCost, minimumOrderValue); const pricePerBanner = finalCost / quantity;
             if (isNaN(pricePerBanner) || pricePerBanner <= 0) { showFeedback(cartFeedbackEl, "Could not calculate price/banner.", true); return; }
             itemToAdd.quantity = quantity; cartOptions = { ...cartOptions, type: 'Flex Banner', details: `${width}x${height} ${unit}`, price: pricePerBanner };
         } else { // Standard Product
             const quantitySelected = parseInt(standardQuantityInput?.value || 1, 10); if (isNaN(quantitySelected) || quantitySelected <= 0) { showFeedback(cartFeedbackEl, "Enter valid quantity.", true); return; }
             const standardPrice = parseFloat(pricing?.rate); if (isNaN(standardPrice) || standardPrice < 0) { showFeedback(cartFeedbackEl, "Product price unavailable.", true); return; } // Allow 0 price?
             itemToAdd.quantity = quantitySelected; cartOptions = { ...cartOptions, type: 'Standard', price: standardPrice };
         }

         if (typeof cartOptions.price !== 'number' || isNaN(cartOptions.price) || cartOptions.price < 0) { console.error("Invalid final price:", cartOptions.price); showFeedback(cartFeedbackEl, "Invalid price. Cannot add.", true); return; }

         addToCart(itemToAdd.productId, itemToAdd.quantity, cartOptions); // Use imported addToCart
         showFeedback(cartFeedbackEl, "Product added to cart!", false);
         if (typeof updateCartCount === 'function') updateCartCount(); // Update header
         else console.warn("updateCartCount function not available.");

     } catch (error) { console.error("Error in handleAddToCart:", error); showFeedback(cartFeedbackEl, `Failed to add. ${error.message}`, true); }
}

// --- Setup Event Listeners (Consolidated) ---
function setupAllEventListeners() {
     // Add to Cart Button
     if (addToCartBtn) { addToCartBtn.removeEventListener('click', handleAddToCart); addToCartBtn.addEventListener('click', handleAddToCart); }
     // Thumbnail Click
     if (thumbnailImagesContainer) {
         thumbnailImagesContainer.removeEventListener('click', handleThumbnailClick); // Remove previous listener
         thumbnailImagesContainer.addEventListener('click', handleThumbnailClick);
     }
     // Tab Navigation
     setupTabs(); // Re-run setupTabs to ensure listeners are correct
     // Standard Quantity Buttons
     setupQuantityButtons();
     // Flex Input Listeners
     setupFlexInputListeners();
     // Wedding Quantity Listener
     setupWeddingQuantityListener();
     // Review Form Submission
     if (reviewForm) { reviewForm.removeEventListener('submit', handleReviewSubmitWrapper); reviewForm.addEventListener('submit', handleReviewSubmitWrapper); }
     // Social Sharing
     setupSocialSharing(); // Re-attaches listener to container
}

// Wrapper for thumbnail click handler
function handleThumbnailClick(event) {
     if (event.target.tagName === 'IMG' && mainImageEl) {
          mainImageEl.src = event.target.src;
          thumbnailImagesContainer.querySelectorAll('img').forEach(thumb => thumb.classList.remove('active'));
          event.target.classList.add('active');
     }
}

// Wrapper for review submit to pass productId
function handleReviewSubmitWrapper(event) {
     handleReviewSubmit(event, currentProductId);
}


// --- Initialize Page ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded.");
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    if (!productId) { showError("Product ID not found in URL."); return; }
    console.log(`Initializing page for Product ID: ${productId}`);
    loadProductDetails(productId); // Fetch data and render
    // Event listeners are now attached within loadProductDetails/renderProductDetails or called from there
});