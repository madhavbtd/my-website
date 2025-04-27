// js/product-detail.js
// UPDATED Version: Tabs, Quantity Buttons, Related Products Slider, Schema, Review Placeholders etc.

// --- Imports ---
import { db } from './firebase-config.js'; // Firebase config इम्पोर्ट करें
// Firestore functions इम्पोर्ट करें (Ensure addDoc, serverTimestamp, collection, query, where, etc. are included if needed for reviews)
import { doc, getDoc, collection, query, where, limit, getDocs, addDoc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { addToCart } from './cart.js'; // cart.js से addToCart फंक्शन इम्पोर्ट करें
import { updateCartCount } from './main.js'; // main.js से updateCartCount फंक्शन इम्पोर्ट करें

// --- DOM Elements ---
const productDetailContainer = document.getElementById('product-detail-container');
const loadingIndicator = productDetailContainer?.querySelector('.loading-indicator');
const productContent = productDetailContainer?.querySelector('.product-content');
const errorMessageContainer = document.getElementById('error-message-container');

// Specific Element IDs
const breadcrumbProductName = document.getElementById('breadcrumb-product-name');
const productNameEl = document.getElementById('product-name');
const mainImageEl = document.getElementById('main-product-image');
const thumbnailImagesContainer = document.getElementById('thumbnail-images');
const priceEl = document.getElementById('product-price');
const addToCartBtn = document.getElementById('add-to-cart-btn');
const cartFeedbackEl = document.getElementById('cart-feedback');
const productSchemaScript = document.getElementById('product-schema'); // Schema script tag

// Description/Specs/etc. within Tabs
const descriptionShortEl = document.getElementById('product-description-short'); // Optional: keep short desc outside tabs
const descriptionFullEl = document.getElementById('product-description-full'); // Full desc inside tab
const specsListEl = document.getElementById('product-specs'); // Specs list inside tab
const usageCareInfoEl = document.getElementById('usage-care-info'); // Usage info inside tab
const faqListEl = document.getElementById('faq-list'); // FAQ list inside tab

// Input Containers
const standardQuantityContainer = document.getElementById('standard-quantity-container');
const flexInputsContainer = document.getElementById('flex-inputs-container');
const weddingQuantityContainer = document.getElementById('wedding-quantity-container');

// Specific Input Elements
const standardQuantityInput = document.getElementById('quantity'); // Standard quantity
const bannerWidthInput = document.getElementById('banner-width');
const bannerHeightInput = document.getElementById('banner-height');
const bannerUnitSelect = document.getElementById('banner-unit');
const bannerQuantityInput = document.getElementById('banner-quantity'); // Flex quantity

// Tabs Elements
const tabsContainer = document.querySelector('.product-details-tabs');
const tabsNavLinks = document.querySelectorAll('.tabs-nav a');
const tabPanes = document.querySelectorAll('.tabs-content .tab-pane');

// Related Products Elements
const relatedProductsSection = document.getElementById('related-products-section');
const relatedProductsContainer = document.getElementById('related-products-container'); // Swiper wrapper

// Reviews Elements
const reviewsListEl = document.getElementById('reviews-list');
const reviewForm = document.getElementById('review-form');
const reviewFeedbackEl = document.getElementById('review-feedback');
const averageRatingEl = document.getElementById('average-rating');
const reviewCountEl = document.getElementById('review-count');

// --- Global State ---
let currentProductData = null; // Store loaded product data globally
let currentProductId = null;
let relatedProductsSwiper = null; // Swiper instance

// --- Helper Functions ---

// Currency Formatting
const formatIndianCurrency = (amount) => {
    const num = Number(amount);
    return isNaN(num) || num === null ? 'N/A' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Format Specification Key
function formatSpecKey(key) {
    const result = key.replace(/([A-Z])/g, ' $1');
    return result.charAt(0).toUpperCase() + result.slice(1);
}

// Show Error Message
function showError(message) {
    if (productContent) productContent.style.display = 'none';
    if (tabsContainer) tabsContainer.style.display = 'none'; // Hide tabs on error
    if (relatedProductsSection) relatedProductsSection.style.display = 'none'; // Hide related on error
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (errorMessageContainer) {
        errorMessageContainer.textContent = message;
        errorMessageContainer.style.display = 'block';
    }
    document.title = "Error - Madhav Multiprint";
    if (breadcrumbProductName) breadcrumbProductName.textContent = "Error";
}

// Show Cart Feedback Message
function showFeedback(element, message, isError = false) {
    if (element) {
        element.textContent = message;
        element.className = isError ? 'cart-feedback-message error' : 'cart-feedback-message success'; // Adjust class if needed
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, 3000);
    }
}

// --- Flex Banner Calculation Logic ---
const mediaWidthsFt = [3, 4, 5, 6, 8, 10];
function calculateFlexDimensions(unit, width, height) {
    // ... (calculation logic remains the same as before) ...
    let wFt = (unit === 'inches') ? parseFloat(width || 0) / 12 : parseFloat(width || 0);
    let hFt = (unit === 'inches') ? parseFloat(height || 0) / 12 : parseFloat(height || 0);

    if (isNaN(wFt) || isNaN(hFt) || wFt <= 0 || hFt <= 0) {
        return { realSqFt: 0, printWidthFt: 0, printHeightFt: 0, printSqFt: 0 };
    }
    const realSqFt = wFt * hFt;
    const mediaWidthFitW = mediaWidthsFt.find(mw => mw >= wFt);
    let printWidthFt1 = mediaWidthFitW || wFt;
    let printHeightFt1 = hFt;
    let printSqFt1 = printWidthFt1 * printHeightFt1;
    const mediaWidthFitH = mediaWidthsFt.find(mw => mw >= hFt);
    let printWidthFt2 = wFt;
    let printHeightFt2 = mediaWidthFitH || hFt;
    let printSqFt2 = printWidthFt2 * printHeightFt2;
    let finalPrintWidthFt, finalPrintHeightFt, finalPrintSqFt;
    if (!mediaWidthFitH || printSqFt1 <= printSqFt2) {
        finalPrintWidthFt = printWidthFt1;
        finalPrintHeightFt = printHeightFt1;
        finalPrintSqFt = printSqFt1;
    } else {
        finalPrintWidthFt = printWidthFt2;
        finalPrintHeightFt = printHeightFt2;
        finalPrintSqFt = printSqFt2;
    }
    return {
        realSqFt: realSqFt.toFixed(2),
        printWidthFt: finalPrintWidthFt,
        printHeightFt: finalPrintHeightFt,
        printSqFt: finalPrintSqFt.toFixed(2)
    };
}

// --- Update Price Functions ---
function updateFlexPrice() {
    if (!currentProductData || !currentProductData.pricing || !priceEl || !bannerWidthInput || !bannerHeightInput || !bannerUnitSelect || !bannerQuantityInput) return;

    const rate = parseFloat(currentProductData.pricing.rate || 0);
    const minOrderValue = parseFloat(currentProductData.pricing.minimumOrderValue || 0);
    const width = parseFloat(bannerWidthInput.value || 0);
    const height = parseFloat(bannerHeightInput.value || 0);
    const unit = bannerUnitSelect.value || 'feet';
    const quantity = parseInt(bannerQuantityInput.value || 1);

    if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0 || isNaN(quantity) || quantity < 1 || isNaN(rate)) {
        priceEl.textContent = formatIndianCurrency(minOrderValue > 0 ? minOrderValue : 0);
        return;
    }

    const calcResult = calculateFlexDimensions(unit, width, height);
    const printSqFtPerBanner = parseFloat(calcResult.printSqFt || 0);

    if (printSqFtPerBanner <= 0) {
        priceEl.textContent = formatIndianCurrency(minOrderValue > 0 ? minOrderValue : 0);
        return;
    }

    const totalPrintSqFt = printSqFtPerBanner * quantity;
    const calculatedCost = totalPrintSqFt * rate;
    const finalCost = Math.max(calculatedCost, minOrderValue);

    priceEl.textContent = formatIndianCurrency(finalCost);
}

function updateWeddingPrice() {
    if (!currentProductData || !currentProductData.pricing || !priceEl) return;
    const quantityDropdown = document.getElementById('wedding-quantity-select');
    if (!quantityDropdown) return;
    const selectedQuantity = parseInt(quantityDropdown.value, 10);
    if (isNaN(selectedQuantity) || selectedQuantity <= 0) {
        priceEl.textContent = "Select Quantity"; return;
    }
    const baseRate = parseFloat(currentProductData.pricing.rate || 0);
    const designCharge = parseFloat(currentProductData.pricing.designCharge || 0);
    const printingChargeBase = parseFloat(currentProductData.pricing.printingChargeBase || 0);
    const transportCharge = parseFloat(currentProductData.pricing.transportCharge || 0);
    const extraMarginPercent = parseFloat(currentProductData.pricing.extraMarginPercent || 0);
    const subTotal = (baseRate * selectedQuantity) + designCharge + printingChargeBase + transportCharge;
    const finalAmount = subTotal * (1 + (extraMarginPercent / 100));
    priceEl.textContent = formatIndianCurrency(finalAmount);
}

function renderSimplePrice(productData) {
     if (!productData || !productData.pricing || !priceEl) {
         priceEl.textContent = 'Contact for Price'; return;
     }
     let priceDisplay = 'Contact for Price';
     const rate = productData.pricing.rate;
     if (typeof rate !== 'undefined' && rate !== null) {
         const unit = productData.unit || 'Qty';
         if (unit.toLowerCase() !== 'sq feet') {
             priceDisplay = `${formatIndianCurrency(rate)} / ${unit}`;
         } else {
             const minOrderValue = parseFloat(productData.pricing.minimumOrderValue || 0);
             priceDisplay = minOrderValue > 0 ? `From ${formatIndianCurrency(minOrderValue)}` : 'Enter Dimensions';
         }
     }
     priceEl.textContent = priceDisplay;
}

// --- Schema Update Function ---
function updateProductSchema(productData, reviewsData = { average: 0, count: 0, reviews: [] }) {
    if (!productSchemaScript || !productData) return;

    const schema = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": productData.productName || "",
        "image": productData.imageUrls || [],
        "description": productData.description || "",
        "sku": productData.sku || currentProductId, // Use SKU or product ID
        "brand": {
            "@type": "Brand",
            "name": "Madhav Multiprint" // Assuming brand name
        },
        "offers": {
            "@type": "Offer",
            "url": window.location.href, // Current page URL
            "priceCurrency": "INR",
            // Price needs careful handling based on product type
            "price": productData.pricing?.rate ?? "0", // Use base rate as placeholder, might need dynamic update
            "availability": productData.isEnabled ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", // Basic availability
            "itemCondition": "https://schema.org/NewCondition"
        },
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": reviewsData.average.toFixed(1) || "0",
            "reviewCount": reviewsData.count || "0"
        },
        "review": reviewsData.reviews.map(review => ({ // Map fetched reviews
             "@type": "Review",
             "author": {"@type": "Person", "name": review.reviewerName || "Anonymous"},
             "datePublished": review.createdAt ? new Date(review.createdAt.seconds * 1000).toISOString().split('T')[0] : "", // Format date
             "reviewBody": review.comment || "",
             "reviewRating": {
               "@type": "Rating",
               "ratingValue": review.rating || "0"
             }
        }))
    };

    // Handle dynamic pricing display for schema (simplified example)
    const category = productData.category?.toLowerCase() || '';
    if (category.includes('flex') && productData.pricing?.minimumOrderValue) {
        schema.offers.price = productData.pricing.minimumOrderValue; // Use min price for flex schema
    } else if (category.includes('wedding')) {
         schema.offers.price = productData.pricing?.rate; // Base rate, might need adjustment
         schema.offers.priceSpecification = [ // Add details for wedding cards
             { "@type": "UnitPriceSpecification", "price": productData.pricing?.rate, "unitText": "card" },
             { "@type": "PriceSpecification", "price": productData.pricing?.designCharge, "valueAddedTaxIncluded": false, "description": "Design Charge"},
             // Add other charges if applicable
         ];
    }


    productSchemaScript.textContent = JSON.stringify(schema, null, 2); // Pretty print JSON
}


// --- Main Product Loading Logic ---
async function loadProductDetails(productId) {
    if (!loadingIndicator || !productContent || !errorMessageContainer || !tabsContainer) {
        console.error("Core layout elements not found!");
        showError("Page layout error."); return;
    }
    loadingIndicator.style.display = 'flex';
    productContent.style.display = 'none';
    tabsContainer.style.display = 'none'; // Hide tabs while loading
    errorMessageContainer.style.display = 'none';
    if (relatedProductsSection) relatedProductsSection.style.display = 'none'; // Hide related initially
    if (weddingQuantityContainer) weddingQuantityContainer.innerHTML = '';

    try {
        const productRef = doc(db, "onlineProducts", productId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
            currentProductData = productSnap.data();
            currentProductId = productId;

            if (!currentProductData) {
                 showError("Failed to process product data."); return;
            }

            // --- Populate HTML Elements ---
            document.title = `${currentProductData.productName || 'Product'} - Madhav Multiprint`;
            if(breadcrumbProductName) breadcrumbProductName.textContent = currentProductData.productName || 'Product Details';
            if(productNameEl) productNameEl.textContent = currentProductData.productName || 'N/A';

            // Images
            if (mainImageEl && thumbnailImagesContainer) {
                if (currentProductData.imageUrls && Array.isArray(currentProductData.imageUrls) && currentProductData.imageUrls.length > 0) {
                    mainImageEl.src = currentProductData.imageUrls[0];
                    mainImageEl.alt = currentProductData.productName || 'Product image';
                    thumbnailImagesContainer.innerHTML = '';
                    currentProductData.imageUrls.forEach((url, index) => {
                        const thumb = document.createElement('img');
                        thumb.src = url; thumb.alt = `Thumbnail ${index + 1}`; thumb.classList.add('thumbnail');
                        if (index === 0) thumb.classList.add('active');
                        thumbnailImagesContainer.appendChild(thumb);
                    });
                } else {
                    mainImageEl.src = 'images/placeholder.png'; mainImageEl.alt = 'Placeholder image';
                    thumbnailImagesContainer.innerHTML = '';
                }
            }

             // Populate Descriptions (Short and Full in Tab)
            if (descriptionShortEl) descriptionShortEl.textContent = currentProductData.shortDescription || currentProductData.description?.substring(0, 150) + '...' || 'View description below.'; // Show short desc or snippet
            if (descriptionFullEl) descriptionFullEl.textContent = currentProductData.description || 'No description available.';


            // --- Handle Product Type Specific UI & Pricing ---
            const category = currentProductData.category?.toLowerCase() || '';
            if (standardQuantityContainer) standardQuantityContainer.style.display = 'none';
            if (flexInputsContainer) flexInputsContainer.style.display = 'none';
            if (weddingQuantityContainer) weddingQuantityContainer.style.display = 'none';

            if (category.includes('flex')) {
                if (flexInputsContainer) {
                    flexInputsContainer.style.display = 'grid'; // Use grid as per CSS
                    [bannerWidthInput, bannerHeightInput, bannerUnitSelect, bannerQuantityInput].forEach(input => {
                        input?.addEventListener('input', updateFlexPrice);
                    });
                    updateFlexPrice(); // Initial calculation
                }
            } else if (category.includes('wedding')) {
                if (weddingQuantityContainer && currentProductData.options && Array.isArray(currentProductData.options)) {
                    const quantityOption = currentProductData.options.find(opt => opt.name?.toLowerCase() === 'quantity');
                    if (quantityOption && quantityOption.values && Array.isArray(quantityOption.values)) {
                        const select = document.createElement('select');
                        select.id = 'wedding-quantity-select'; select.name = 'wedding_quantity';
                        select.innerHTML = `<option value="">-- Select Quantity --</option>`;
                        quantityOption.values.forEach(val => {
                            select.innerHTML += `<option value="${val}">${val}</option>`;
                        });
                        const label = document.createElement('label');
                        label.htmlFor = 'wedding-quantity-select'; label.textContent = 'Select Quantity:';
                        weddingQuantityContainer.appendChild(label); weddingQuantityContainer.appendChild(select);
                        weddingQuantityContainer.style.display = 'block';
                        select.addEventListener('change', updateWeddingPrice);
                        priceEl.textContent = "Select Quantity";
                    } else {
                        if (standardQuantityContainer) standardQuantityContainer.style.display = 'block';
                        renderSimplePrice(currentProductData);
                    }
                } else {
                    if (standardQuantityContainer) standardQuantityContainer.style.display = 'block';
                    renderSimplePrice(currentProductData);
                }
            } else { // Standard Product
                if (standardQuantityContainer) standardQuantityContainer.style.display = 'block';
                renderSimplePrice(currentProductData);
            }

            // Specifications (in Tab)
            if (specsListEl) {
                specsListEl.innerHTML = ''; // Clear loading text
                if (currentProductData.specifications && typeof currentProductData.specifications === 'object' && Object.keys(currentProductData.specifications).length > 0) {
                    for (const [key, value] of Object.entries(currentProductData.specifications)) {
                        if (value) {
                            const li = document.createElement('li');
                            // Wrap value in span for better CSS targeting
                            li.innerHTML = `<strong>${formatSpecKey(key)}:</strong> <span>${value}</span>`;
                            specsListEl.appendChild(li);
                        }
                    }
                } else {
                    specsListEl.innerHTML = '<li>No specifications available.</li>';
                }
            }

            // Populate other tabs (Usage/Care, FAQ) - Placeholder
            if (usageCareInfoEl) usageCareInfoEl.textContent = currentProductData.usageInfo || "No usage information available.";
            if (faqListEl) {
                faqListEl.innerHTML = ''; // Clear loading
                if (currentProductData.faqs && Array.isArray(currentProductData.faqs) && currentProductData.faqs.length > 0) {
                     currentProductData.faqs.forEach(faq => {
                          const item = document.createElement('div');
                          item.className = 'faq-item';
                          item.innerHTML = `<h4>Q: ${faq.question}</h4><p>A: ${faq.answer}</p>`;
                          faqListEl.appendChild(item);
                     });
                } else {
                     faqListEl.innerHTML = '<p>No frequently asked questions available for this product.</p>';
                }
            }

            // --- Show Content & Tabs ---
            productContent.style.display = 'grid';
            tabsContainer.style.display = 'block'; // Show tabs now
            loadingIndicator.style.display = 'none';

            // --- Load Reviews & Related Products ---
            // Load reviews first to update schema correctly
            const reviewsData = await loadReviews(productId);
            updateProductSchema(currentProductData, reviewsData); // Update schema with product and review data

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
        console.error("Error loading product details: ", error);
        showError(`Failed to load product details. ${error.message}`);
    }
}

// --- Related Products Function (using SwiperJS) ---
async function loadRelatedProducts(currentProductId, category) {
    if (!relatedProductsSection || !relatedProductsContainer) return;
    relatedProductsContainer.innerHTML = '<div class="swiper-slide"><p>Loading related products...</p></div>';

    try {
        const productsRef = collection(db, "onlineProducts");
        const q = query(
            productsRef,
            where("isEnabled", "==", true), where("category", "==", category),
            where("__name__", "!=", currentProductId), limit(10)
        );
        const querySnapshot = await getDocs(q);
        const relatedProducts = [];
        querySnapshot.forEach((doc) => { relatedProducts.push({ id: doc.id, ...doc.data() }); });

        if (relatedProducts.length > 0) {
            relatedProductsContainer.innerHTML = ''; // Clear loading
            relatedProducts.forEach(product => {
                const slide = document.createElement('div'); slide.className = 'swiper-slide';
                let imageUrl = product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : 'images/placeholder.png';
                let priceHTML = '';
                const hasPrice = product.pricing && typeof product.pricing.rate !== 'undefined' && product.pricing.rate !== null;
                 if (hasPrice) {
                     const rate = product.pricing.rate;
                     if (product.unit && typeof product.unit === 'string' && product.unit.toLowerCase() === 'sq feet') { priceHTML = `<div class="price">From ${formatIndianCurrency(rate)} / sq ft</div>`; }
                     else if (product.unit) { priceHTML = `<div class="price">${formatIndianCurrency(rate)} / ${product.unit}</div>`; }
                     else { priceHTML = `<div class="price">${formatIndianCurrency(rate)}</div>`; }
                 } else { priceHTML = `<div class="price">Contact for Price</div>`; }

                slide.innerHTML = `
                    <div class="product-card">
                        <div class="product-image-container">
                            <a href="product-detail.html?id=${product.id}"><img src="${imageUrl}" alt="${product.productName || 'Product'}" loading="lazy"></a>
                        </div>
                        <div class="product-info">
                             <h3><a href="product-detail.html?id=${product.id}">${product.productName || 'Unnamed Product'}</a></h3>
                            ${priceHTML}
                            <a href="product-detail.html?id=${product.id}" class="button-primary view-details-btn">View Details</a>
                        </div>
                    </div>`;
                relatedProductsContainer.appendChild(slide);
            });

            relatedProductsSection.style.display = 'block';
            if (relatedProductsSwiper) { relatedProductsSwiper.destroy(true, true); relatedProductsSwiper = null; }

            // Initialize Swiper (Ensure Swiper class is available globally)
             if (typeof Swiper !== 'undefined') {
                 relatedProductsSwiper = new Swiper('.related-products-swiper', {
                    loop: relatedProducts.length > 5, // Adjust loop condition based on slidesPerView
                    slidesPerView: 2, spaceBetween: 15,
                    autoplay: { delay: 4000, disableOnInteraction: false, },
                    pagination: { el: '.swiper-pagination', clickable: true, },
                    navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev', },
                    breakpoints: { 640: { slidesPerView: 3, spaceBetween: 20 }, 768: { slidesPerView: 4, spaceBetween: 25 }, 1024: { slidesPerView: 5, spaceBetween: 30 } }
                });
             } else {
                console.error("Swiper is not defined. Make sure the Swiper library is loaded.");
             }

        } else {
            relatedProductsSection.style.display = 'none';
        }
    } catch (error) {
        console.error("Error loading related products:", error);
        relatedProductsContainer.innerHTML = '<div class="swiper-slide"><p>Error loading related products.</p></div>';
        relatedProductsSection.style.display = 'block';
    }
}

// --- Review Functions ---
async function loadReviews(productId) {
    if (!reviewsListEl || !averageRatingEl || !reviewCountEl) return { average: 0, count: 0, reviews: [] }; // Return default if elements missing

    reviewsListEl.innerHTML = '<p>Loading reviews...</p>';
    let totalRating = 0;
    let reviewCount = 0;
    const fetchedReviews = [];

    try {
        const reviewsRef = collection(db, "onlineProducts", productId, "reviews");
        // Order reviews by creation date, newest first
        const q = query(reviewsRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            reviewsListEl.innerHTML = ''; // Clear loading message
            querySnapshot.forEach((doc) => {
                 const review = { id: doc.id, ...doc.data() };
                 fetchedReviews.push(review); // Store for schema update

                 const reviewItem = document.createElement('div');
                 reviewItem.className = 'review-item';

                 const rating = review.rating || 0;
                 const starsHTML = Array.from({ length: 5 }, (_, i) =>
                     `<i class="fas fa-star${i < rating ? '' : '-empty'}" style="color: #f0ad4e;"></i>` // Simple star display
                 ).join('');

                 const date = review.createdAt?.seconds ? new Date(review.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';

                 reviewItem.innerHTML = `
                     <div class="review-rating">${starsHTML}</div>
                     <p class="review-comment">${review.comment || ''}</p>
                     <p class="review-meta">By <strong>${review.reviewerName || 'Anonymous'}</strong> on ${date}</p>
                 `;
                 reviewsListEl.appendChild(reviewItem);

                 totalRating += rating;
                 reviewCount++;
            });

            const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;
            averageRatingEl.textContent = `${averageRating.toFixed(1)} / 5`;
            reviewCountEl.textContent = reviewCount;

             return { average: averageRating, count: reviewCount, reviews: fetchedReviews };

        } else {
            reviewsListEl.innerHTML = '<p>No reviews yet. Be the first!</p>';
            averageRatingEl.textContent = 'N/A';
            reviewCountEl.textContent = '0';
             return { average: 0, count: 0, reviews: fetchedReviews };
        }
    } catch (error) {
        console.error("Error loading reviews:", error);
        reviewsListEl.innerHTML = '<p>Could not load reviews.</p>';
         averageRatingEl.textContent = 'Error';
         reviewCountEl.textContent = '0';
         return { average: 0, count: 0, reviews: fetchedReviews }; // Return empty on error
    }
}

async function submitReview(event) {
    event.preventDefault();
    if (!reviewForm || !currentProductId || !reviewFeedbackEl) return;

    const reviewerName = reviewForm.elements['reviewer_name']?.value.trim();
    const comment = reviewForm.elements['review_comment']?.value.trim();
    const ratingInput = reviewForm.querySelector('input[name="rating"]:checked');
    const rating = ratingInput ? parseInt(ratingInput.value, 10) : 0;

    if (!reviewerName || !comment || rating === 0) {
        showFeedback(reviewFeedbackEl, "Please fill in all fields and select a rating.", true);
        return;
    }

    // Disable form while submitting
    reviewForm.querySelector('button[type="submit"]').disabled = true;
    showFeedback(reviewFeedbackEl, "Submitting review...", false);

    try {
        // **** Add review to Firebase ****
        const reviewsRef = collection(db, "onlineProducts", currentProductId, "reviews");
        await addDoc(reviewsRef, {
            reviewerName: reviewerName,
            comment: comment,
            rating: rating,
            createdAt: serverTimestamp() // Use server timestamp
        });

        showFeedback(reviewFeedbackEl, "Review submitted successfully!", false);
        reviewForm.reset(); // Clear the form
        // Reload reviews to show the new one immediately and update schema/average
        const reviewsData = await loadReviews(currentProductId);
        updateProductSchema(currentProductData, reviewsData);

    } catch (error) {
        console.error("Error submitting review:", error);
        showFeedback(reviewFeedbackEl, `Failed to submit review. ${error.message}`, true);
    } finally {
         // Re-enable form
         reviewForm.querySelector('button[type="submit"]').disabled = false;
    }
}

// --- Add to Cart Handler ---
function handleAddToCart() {
    if (!currentProductId || !currentProductData || !cartFeedbackEl) {
        showFeedback(cartFeedbackEl, "Error: Product data not loaded.", true); return;
    }

    const category = currentProductData.category?.toLowerCase() || '';
    let itemToAdd = { productId: currentProductId, quantity: 0 };
    let cartOptions = {};

    try {
        if (category.includes('flex')) {
            const width = parseFloat(bannerWidthInput?.value || 0);
            const height = parseFloat(bannerHeightInput?.value || 0);
            const unit = bannerUnitSelect?.value || 'feet';
            const quantity = parseInt(bannerQuantityInput?.value || 1);
            if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0 || isNaN(quantity) || quantity < 1) {
                showFeedback(cartFeedbackEl, "Please enter valid dimensions and quantity.", true); return;
            }
            const rate = parseFloat(currentProductData.pricing?.rate || 0);
            const minOrderValue = parseFloat(currentProductData.pricing?.minimumOrderValue || 0);
            const calcResult = calculateFlexDimensions(unit, width, height);
            const printSqFtPerBanner = parseFloat(calcResult.printSqFt || 0);
            if (printSqFtPerBanner <= 0 || isNaN(rate)) {
                 showFeedback(cartFeedbackEl, "Error calculating price. Cannot add to cart.", true); return;
            }
            const totalPrintSqFt = printSqFtPerBanner * quantity;
            const calculatedCost = totalPrintSqFt * rate;
            const finalCost = Math.max(calculatedCost, minOrderValue);
            itemToAdd.quantity = quantity;
            cartOptions = { type: 'Flex', dimensions: { width, height, unit }, printSqFt: printSqFtPerBanner.toFixed(2), price: finalCost };

        } else if (category.includes('wedding')) {
             const quantityDropdown = document.getElementById('wedding-quantity-select');
             if (!quantityDropdown || !quantityDropdown.value) {
                  showFeedback(cartFeedbackEl, "Please select a quantity.", true); return;
             }
             const selectedQuantity = parseInt(quantityDropdown.value, 10);
             const baseRate = parseFloat(currentProductData.pricing?.rate || 0);
             const designCharge = parseFloat(currentProductData.pricing?.designCharge || 0);
             const printingChargeBase = parseFloat(currentProductData.pricing?.printingChargeBase || 0);
             const transportCharge = parseFloat(currentProductData.pricing?.transportCharge || 0);
             const extraMarginPercent = parseFloat(currentProductData.pricing?.extraMarginPercent || 0);
             const subTotal = (baseRate * selectedQuantity) + designCharge + printingChargeBase + transportCharge;
             const finalAmount = subTotal * (1 + (extraMarginPercent / 100));
             itemToAdd.quantity = selectedQuantity;
             cartOptions = { type: 'Wedding Card', price: finalAmount };

        } else { // Standard Product
             const quantityInput = standardQuantityContainer?.querySelector('.quantity-input');
             const quantity = parseInt(quantityInput?.value || 1);
             if (isNaN(quantity) || quantity < 1) {
                 showFeedback(cartFeedbackEl, "Please enter a valid quantity.", true); return;
             }
             itemToAdd.quantity = quantity;
             cartOptions = { type: 'Standard', price: currentProductData.pricing?.rate };
        }

        addToCart(itemToAdd.productId, itemToAdd.quantity, cartOptions);
        showFeedback(cartFeedbackEl, "Product added to cart!", false);
        if (typeof updateCartCount === 'function') { updateCartCount(); }

    } catch (error) {
        console.error("Error adding to cart:", error);
        showFeedback(cartFeedbackEl, `Failed to add product to cart. ${error.message}`, true);
    }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Add to Cart Button
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', handleAddToCart);
    }

    // Thumbnail Click
    if (thumbnailImagesContainer) {
        thumbnailImagesContainer.addEventListener('click', (event) => {
            if (event.target.tagName === 'IMG' && mainImageEl) {
                mainImageEl.src = event.target.src;
                thumbnailImagesContainer.querySelectorAll('img').forEach(thumb => thumb.classList.remove('active'));
                event.target.classList.add('active');
            }
        });
    }

     // Tab Navigation
     if (tabsNavLinks.length > 0 && tabPanes.length > 0) {
         tabsNavLinks.forEach(link => {
             link.addEventListener('click', (event) => {
                 event.preventDefault();
                 const targetTabId = link.getAttribute('href'); //.substring(1); // e.g., #tab-description -> tab-description

                 tabsNavLinks.forEach(navLink => navLink.classList.remove('active'));
                 tabPanes.forEach(pane => pane.classList.remove('active'));

                 link.classList.add('active');
                 const targetPane = document.querySelector(targetTabId);
                 if(targetPane) targetPane.classList.add('active');
             });
         });
     }

     // Quantity Buttons (Event Delegation on container)
     const quantityContainers = document.querySelectorAll('.quantity-input-wrapper');
     quantityContainers.forEach(wrapper => {
        wrapper.addEventListener('click', (event) => {
            const button = event.target.closest('.quantity-btn');
            if (!button) return;

            const input = wrapper.querySelector('.quantity-input');
            if (!input) return;

            const currentValue = parseInt(input.value, 10) || 1;
            const min = parseInt(input.min, 10) || 1;
            let newValue = currentValue;

            if (button.classList.contains('quantity-increase')) {
                newValue = currentValue + 1;
            } else if (button.classList.contains('quantity-decrease')) {
                newValue = currentValue - 1;
            }

            // Ensure value stays within limits
            if (newValue < min) {
                newValue = min;
            }

            input.value = newValue;

            // Trigger price update if it's the flex banner quantity
            if (input.id === 'banner-quantity') {
                updateFlexPrice();
            }
            // Add price update logic for standard quantity if needed
            // else if (input.id === 'quantity') { updateStandardPrice(); }
        });
     });

     // Review Form Submission
     if (reviewForm) {
         reviewForm.addEventListener('submit', submitReview);
     }

     // Add more listeners here (e.g., social share buttons if they need JS)
}

// --- Initialize Page ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        showError("Product ID not found in URL.");
        if(relatedProductsSection) relatedProductsSection.style.display = 'none';
        return;
    }

    loadProductDetails(productId); // Load product data, reviews, related products, setup specific inputs
    setupEventListeners(); // Setup general event listeners after DOM is ready
});