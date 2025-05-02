// js/product-detail.js
// FINAL UPDATED Version: Uses 'onlineProducts' collection for website data.
// Includes Tabs, Quantity Buttons, New Price Layout, Related Products Slider, Schema Update, Review Logic (subcollection), Social Sharing, and Error Checks
// Corrected Price Calculation for Wedding Cards & Flex Banners + Image in Cart

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
const thumbnailContainer = document.getElementById('thumbnail-images');
const productPriceEl = document.getElementById('product-price');
const originalPriceEl = document.getElementById('original-price'); // Element for original price (if applicable)
const discountBadgeEl = document.getElementById('discount-badge'); // Element for discount badge
const productDescriptionEl = document.getElementById('product-description');
const featuresListEl = document.getElementById('features-list');
const addToCartBtn = document.getElementById('add-to-cart-btn');
const quantityInput = document.getElementById('quantity-input');
const quantityDecreaseBtn = document.getElementById('quantity-decrease');
const quantityIncreaseBtn = document.getElementById('quantity-increase');
const tabsContainer = document.getElementById('product-tabs');
const tabsNav = tabsContainer?.querySelector('.tabs-nav');
const tabsContent = tabsContainer?.querySelector('.tabs-content');
const cartFeedback = document.getElementById('cart-feedback-message');
const flexOptionsContainer = document.getElementById('flex-options-container'); // Container for flex options
const relatedProductsContainer = document.getElementById('related-products-container');
const relatedProductsSection = document.getElementById('related-products-section');
const reviewForm = document.getElementById('review-form'); // Review form element
const reviewList = document.getElementById('review-list'); // Review list element
const reviewSection = document.getElementById('reviews-section'); // Reviews section container
const avgRatingEl = document.getElementById('average-rating'); // Average rating display
const reviewCountEl = document.getElementById('review-count'); // Review count display
const faqListEl = document.getElementById('faq-list'); // FAQ list element
const socialShareContainer = document.getElementById('social-share');

// Product Schema element
const productSchemaEl = document.getElementById('product-schema');

// Store the current product data globally within this module's scope
let currentProduct = null;
let currentProductId = null;

// --- Helper Functions ---

// Function to display loading indicator
function showLoading(isLoading) {
    if (loadingIndicator) {
        loadingIndicator.style.display = isLoading ? 'flex' : 'none';
    }
    if (productContent) {
        productContent.style.display = isLoading ? 'none' : 'block';
    }
    if (errorMessageContainer && isLoading) {
        errorMessageContainer.style.display = 'none';
        errorMessageContainer.textContent = '';
    }
}

// Function to display error messages
function showError(message) {
    showLoading(false);
    if (errorMessageContainer) {
        errorMessageContainer.textContent = message;
        errorMessageContainer.style.display = 'block';
    }
    if (productContent) {
        productContent.style.display = 'none';
    }
}

// Show feedback message near cart button
function showCartFeedback(message, type = 'success') {
    if (!cartFeedback) return;
    cartFeedback.textContent = message;
    cartFeedback.className = `cart-feedback-message ${type}`;
    cartFeedback.style.display = 'block';
    setTimeout(() => {
        cartFeedback.style.display = 'none';
    }, 3000);
}


// --- Product Data Display Functions ---

// Update breadcrumbs
function updateBreadcrumbs(category, productName) {
    const breadcrumbsContainer = document.querySelector('.breadcrumbs');
    if (breadcrumbsContainer) {
        breadcrumbsContainer.innerHTML = `
            <a href="index.html">Home</a> &gt;
            <a href="products.html?category=${encodeURIComponent(category)}">${category}</a> &gt;
            <span id="breadcrumb-product-name">${productName}</span>
        `;
    }
}

// Function to display images
function displayImages(imageUrls) {
    if (!imageUrls || imageUrls.length === 0) {
        mainImageEl.src = 'path/to/default/image.jpg';
        mainImageEl.alt = "No image available";
        thumbnailContainer.innerHTML = '';
        return;
    }
    mainImageEl.src = imageUrls[0];
    mainImageEl.alt = currentProduct.name;
    thumbnailContainer.innerHTML = '';

    if (imageUrls.length > 1) {
        imageUrls.forEach((url, index) => {
            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.alt = `${currentProduct.name} - view ${index + 1}`;
            thumb.classList.add('thumbnail');
            if (index === 0) thumb.classList.add('active');
            thumb.addEventListener('click', () => {
                mainImageEl.src = url;
                thumbnailContainer.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            });
            thumbnailContainer.appendChild(thumb);
        });
    }
}

// --- Price Calculation & Display ---
function calculatePrice(product, quantity = 1, options = {}) {
    let basePrice = parseFloat(product.price || 0);
    let originalPrice = basePrice;
    let discount = parseFloat(product.discountPercentage || 0);
    let finalPrice = basePrice;
    let priceDetailsHTML = '';

    // Apply discount
    if (discount > 0) {
        finalPrice = basePrice * (1 - discount / 100);
        priceDetailsHTML += `<span class="original-price">₹${basePrice.toFixed(2)}</span> `;
        if (discountBadgeEl) {
            discountBadgeEl.textContent = `${discount}% OFF`;
            discountBadgeEl.style.display = 'inline-block';
        }
    } else {
        if (originalPriceEl) originalPriceEl.style.display = 'none';
        if (discountBadgeEl) discountBadgeEl.style.display = 'none';
    }

    // Wedding Cards Pricing
    if (product.category === 'Wedding Cards' && options.cardType) {
         const cardTypePrices = { 'Standard': 0, 'Premium': 5, 'Luxury': 15 };
         const typeAdjustment = cardTypePrices[options.cardType] || 0;
         finalPrice += typeAdjustment;
         originalPrice += typeAdjustment;
         if(discount > 0) priceDetailsHTML = `<span class="original-price">₹${originalPrice.toFixed(2)}</span> `;
    }

    // Flex Banner Pricing
    if (product.category === 'Flex Banner' && options.width && options.height) {
        const width = parseFloat(options.width);
        const height = parseFloat(options.height);
        const sides = parseInt(options.sides || 1, 10);
        if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
            const area = width * height;
            const pricePerSqFt = parseFloat(product.pricePerSqFt || 15);
            let calculatedFlexPrice = area * pricePerSqFt;
            if (sides === 2) calculatedFlexPrice *= 1.8;
            finalPrice = calculatedFlexPrice;
            if (discount > 0) {
                 originalPrice = finalPrice / (1 - discount / 100);
                 priceDetailsHTML = `<span class="original-price">₹${originalPrice.toFixed(2)}</span> `;
            } else {
                priceDetailsHTML = '';
            }
        }
    }

    // Final Price Display
    priceDetailsHTML += `<span class="current-price">₹${finalPrice.toFixed(2)}</span>`;
    if (product.priceUnit) priceDetailsHTML += ` <span class="price-unit">(${product.priceUnit})</span>`;
    if (productPriceEl) productPriceEl.innerHTML = priceDetailsHTML;
    if (originalPriceEl && discount > 0) {
        originalPriceEl.textContent = `₹${originalPrice.toFixed(2)}`;
        originalPriceEl.style.display = 'inline';
    } else if (originalPriceEl) {
         originalPriceEl.style.display = 'none';
    }

    return { finalPrice: finalPrice, originalPrice: originalPrice };
}

// Get selected options for Flex Banners
function getSelectedFlexOptions() {
    const widthInput = document.getElementById('flex-width');
    const heightInput = document.getElementById('flex-height');
    const sidesInput = document.getElementById('flex-sides');
    return {
        width: widthInput?.value || null,
        height: heightInput?.value || null,
        sides: sidesInput?.value || null
    };
}

// Update price display when options change
function handleOptionChange() {
    if (!currentProduct) return;
    const quantity = parseInt(quantityInput.value, 10);
    let options = {};
    if (currentProduct.category === 'Flex Banner') {
        options = getSelectedFlexOptions();
        if (!options.width || !options.height || parseFloat(options.width) <= 0 || parseFloat(options.height) <= 0) {
             if (productPriceEl) productPriceEl.innerHTML += ' <span style="color: red; font-size: 0.8em;">(Enter valid dimensions)</span>';
            return;
        }
    } else if (currentProduct.category === 'Wedding Cards') {
         const cardTypeSelect = document.getElementById('wedding-card-type');
         if (cardTypeSelect) options.cardType = cardTypeSelect.value;
    }
    calculatePrice(currentProduct, quantity, options);
}

// Display Flex Banner specific options
function displayFlexOptions(product) {
    if (!flexOptionsContainer) return;
    if (product.category === 'Flex Banner') {
        flexOptionsContainer.innerHTML = `
            <h4>Customize Your Flex Banner</h4>
            <div class="flex-options">
                 <div class="form-group-inline"><label for="flex-width">Width (ft):</label><input type="number" id="flex-width" name="flex-width" min="1" step="0.1" required></div>
                 <div class="form-group-inline"><label for="flex-height">Height (ft):</label><input type="number" id="flex-height" name="flex-height" min="1" step="0.1" required></div>
                 <div class="form-group-inline quantity-control-group"><label for="flex-sides">Sides:</label><select id="flex-sides" name="flex-sides"><option value="1">Single-Sided</option><option value="2">Double-Sided</option></select></div>
            </div>
            <p class="price-note">Price calculated based on square footage and sides.</p>`;
        flexOptionsContainer.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('change', handleOptionChange);
            input.addEventListener('keyup', handleOptionChange);
        });
        flexOptionsContainer.style.display = 'block';
    } else {
        flexOptionsContainer.innerHTML = '';
        flexOptionsContainer.style.display = 'none';
    }
}

// Display Wedding Card options
function displayWeddingCardOptions(product) {
     const optionsContainer = document.getElementById('wedding-card-options-container');
     if (!optionsContainer) return;
     if (product.category === 'Wedding Cards') {
         optionsContainer.innerHTML = `
             <h4>Select Card Options</h4>
             <div class="form-group">
                 <label for="wedding-card-type">Card Type:</label>
                 <select id="wedding-card-type" name="wedding-card-type"><option value="Standard">Standard</option><option value="Premium">Premium (+₹5)</option><option value="Luxury">Luxury (+₹15)</option></select>
             </div>`;
         optionsContainer.querySelectorAll('select').forEach(select => {
             select.addEventListener('change', handleOptionChange);
         });
         optionsContainer.style.display = 'block';
     } else {
         optionsContainer.innerHTML = '';
         optionsContainer.style.display = 'none';
     }
}

// Update Product Schema
function updateProductSchema(product) {
    if (!productSchemaEl || !product) return;
    const { finalPrice } = calculatePrice(product, 1, {});
    const schema = {
        "@context": "https://schema.org/", "@type": "Product",
        "name": product.name, "image": product.imageUrls || [],
        "description": product.description || product.shortDescription || "High-quality printing services.",
        "sku": product.sku || product.id,
        "brand": { "@type": "Brand", "name": "Madhav Multiprint" },
        "offers": {
            "@type": "Offer", "url": window.location.href, "priceCurrency": "INR",
            "price": finalPrice.toFixed(2), "itemCondition": "https://schema.org/NewCondition",
            "availability": product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            "priceValidUntil": new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
        }
    };
    if (product.averageRating && product.reviewCount > 0) {
        schema.aggregateRating = {
            "@type": "AggregateRating", "ratingValue": product.averageRating.toFixed(1),
            "bestRating": "5", "worstRating": "1", "ratingCount": product.reviewCount
        };
    }
    productSchemaEl.textContent = JSON.stringify(schema, null, 2);
}


// Display Product Details
function displayProductDetails(product) {
    currentProduct = product;
    if (!product) { showError("Product data is not available."); return; }

    if (productNameEl) productNameEl.textContent = product.name || 'Product Name Unavailable';
    if (breadcrumbProductName) breadcrumbProductName.textContent = product.name || '';
    if (productDescriptionEl) productDescriptionEl.innerHTML = product.description || 'No description available.';
    updateBreadcrumbs(product.category || 'Products', product.name || 'Details');
    displayImages(product.imageUrls || []);
    calculatePrice(product, 1, {}); // Initial price calculation

    if (featuresListEl && product.features && product.features.length > 0) {
        featuresListEl.innerHTML = product.features.map(feature => `<li>${feature}</li>`).join('');
        featuresListEl.closest('.tab-pane')?.classList.add('active');
    } else if (featuresListEl) {
        featuresListEl.innerHTML = '<li>No specific features listed.</li>';
    }

    displayFlexOptions(product);
    displayWeddingCardOptions(product);
    setupQuantityControls();
    setupTabs();
    fetchRelatedProducts(product.category, product.id);
    updateProductSchema(product);
    setupReviewSystem(currentProductId); // Pass ID here
    fetchAndDisplayFAQs(product.faqIds || []);
    setupSocialSharing(product);
}

// --- Quantity Controls ---
function setupQuantityControls() {
    if (!quantityInput || !quantityDecreaseBtn || !quantityIncreaseBtn) return;
    quantityDecreaseBtn.addEventListener('click', () => {
        let currentValue = parseInt(quantityInput.value, 10);
        if (currentValue > 1) { quantityInput.value = currentValue - 1; handleOptionChange(); }
    });
    quantityIncreaseBtn.addEventListener('click', () => {
        let currentValue = parseInt(quantityInput.value, 10);
        quantityInput.value = currentValue + 1; handleOptionChange();
    });
    quantityInput.addEventListener('change', () => {
        let currentValue = parseInt(quantityInput.value, 10);
        if (isNaN(currentValue) || currentValue < 1) quantityInput.value = 1;
        handleOptionChange();
    });
}

// --- Tabs Functionality ---
function setupTabs() {
    if (!tabsNav || !tabsContent) return;
    const tabLinks = tabsNav.querySelectorAll('a');
    const tabPanes = tabsContent.querySelectorAll('.tab-pane');
    const switchTab = (targetId) => {
        tabLinks.forEach(link => link.classList.remove('active'));
        tabPanes.forEach(pane => pane.classList.remove('active'));
        const activeLink = tabsNav.querySelector(`a[href="#${targetId}"]`);
        const activePane = tabsContent.querySelector(`#${targetId}`);
        if (activeLink) activeLink.classList.add('active');
        if (activePane) activePane.classList.add('active');
    };
    tabLinks.forEach(link => {
        link.addEventListener('click', (e) => { e.preventDefault(); switchTab(link.getAttribute('href').substring(1)); });
    });
    let defaultTabId = 'description';
    const featuresPane = document.getElementById('features');
    if (featuresPane && featuresListEl && featuresListEl.children.length > 1) defaultTabId = 'features';
    switchTab(defaultTabId);
}

// --- Related Products ---
async function fetchRelatedProducts(category, currentProdId) {
    if (!relatedProductsContainer || !category || !currentProdId) {
         if (relatedProductsSection) relatedProductsSection.style.display = 'none';
         return;
    }
    relatedProductsContainer.innerHTML = '<div class="swiper-slide"><p>Loading related products...</p></div>';
    try {
        // ***** CHANGE: Use 'onlineProducts' collection *****
        const productsRef = collection(db, "onlineProducts");
        const q = query( productsRef, where("category", "==", category), limit(8) );
        const querySnapshot = await getDocs(q);
        let relatedProducts = [];
        querySnapshot.forEach((doc) => {
            if (doc.id !== currentProdId) { // Exclude current product
                relatedProducts.push({ id: doc.id, ...doc.data() });
            }
        });
        relatedProducts = relatedProducts.slice(0, 6); // Limit displayed

        if (relatedProducts.length > 0) {
            displayRelatedProducts(relatedProducts);
            relatedProductsSection.style.display = 'block';
        } else {
            relatedProductsSection.style.display = 'none';
        }
    } catch (error) {
        console.error("Error fetching related products:", error);
        relatedProductsContainer.innerHTML = '<div class="swiper-slide"><p>Could not load related products.</p></div>';
        relatedProductsSection.style.display = 'block';
    }
}

function displayRelatedProducts(products) {
    relatedProductsContainer.innerHTML = '';
    products.forEach(product => {
        const { finalPrice, originalPrice } = calculatePrice(product, 1, {});
        const hasDiscount = product.discountPercentage && product.discountPercentage > 0;
        const slide = document.createElement('div');
        slide.classList.add('swiper-slide');
        slide.innerHTML = `
            <div class="product-card related">
                <a href="product-detail.html?id=${product.id}" class="product-image-link">
                    <img src="${product.imageUrls?.[0] || 'path/to/default/image.jpg'}" alt="${product.name}">
                </a>
                 ${hasDiscount ? `<span class="discount-badge-related">${product.discountPercentage}% OFF</span>` : ''}
                <div class="product-info">
                    <h3><a href="product-detail.html?id=${product.id}">${product.name}</a></h3>
                    <div class="price-container">
                        ${hasDiscount ? `<span class="original-price related">₹${originalPrice.toFixed(2)}</span>` : ''}
                         <span class="price related">₹${finalPrice.toFixed(2)}</span>
                     </div>
                    <a href="product-detail.html?id=${product.id}" class="button-secondary view-details-btn">View Details</a>
                </div>
            </div>`;
        relatedProductsContainer.appendChild(slide);
    });
    initializeRelatedProductsSwiper();
}

function initializeRelatedProductsSwiper() {
     if (typeof Swiper === 'undefined') { console.error("Swiper library not loaded."); return; }
     if (relatedProductsContainer.swiper) relatedProductsContainer.swiper.destroy(true, true);
     new Swiper('.related-products-swiper', {
         slidesPerView: 1, spaceBetween: 15,
         pagination: { el: '.swiper-pagination', clickable: true },
         navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
         breakpoints: { 480: { slidesPerView: 2, spaceBetween: 20 }, 768: { slidesPerView: 3, spaceBetween: 30 }, 1024: { slidesPerView: 4, spaceBetween: 30 } }
     });
     console.log("Related products swiper initialized.");
}

// --- Review System ---
function setupReviewSystem(productId) { // productId is passed from main logic
    if (!reviewSection || !productId) return;
    fetchAndDisplayReviews(productId);
    if (reviewForm) {
        // Define handler here to capture productId
        const submitHandler = (e) => handleReviewSubmit(e, productId);
        reviewForm.removeEventListener('submit', submitHandler); // Remove potential previous listener
        reviewForm.addEventListener('submit', submitHandler);
    }
}

async function handleReviewSubmit(event, productId) { // Receive productId
    event.preventDefault();
    if (!reviewForm || !productId) return;

    const ratingInput = reviewForm.querySelector('input[name="rating"]:checked');
    const commentInput = reviewForm.querySelector('textarea[name="comment"]');
    const nameInput = reviewForm.querySelector('input[name="reviewerName"]');
    const submitButton = reviewForm.querySelector('button[type="submit"]');
    const formFeedback = reviewForm.querySelector('.form-feedback');

    if (!ratingInput) { if (formFeedback) formFeedback.textContent = "Please select a rating."; return; }
    if (!commentInput || commentInput.value.trim() === '') { if (formFeedback) formFeedback.textContent = "Please enter your comment."; return; }
    if (!nameInput || nameInput.value.trim() === '') { if (formFeedback) formFeedback.textContent = "Please enter your name."; return; }

    const reviewData = {
        // No need to store productId within the review document itself if it's a subcollection
        rating: parseInt(ratingInput.value, 10),
        comment: commentInput.value.trim(),
        reviewerName: nameInput.value.trim(),
        createdAt: serverTimestamp()
    };

    if (submitButton) submitButton.disabled = true;
    if (formFeedback) formFeedback.textContent = "Submitting review...";

    try {
        // ***** CHANGE: Use 'onlineProducts/{productId}/reviews' subcollection *****
        const reviewsRef = collection(db, "onlineProducts", productId, "reviews");
        await addDoc(reviewsRef, reviewData);

        if (formFeedback) formFeedback.textContent = "Review submitted successfully!";
        formFeedback.className = 'form-feedback success';
        reviewForm.reset();
        await fetchAndDisplayReviews(productId); // Refresh reviews

    } catch (error) {
        console.error("Error submitting review:", error);
        if (formFeedback) formFeedback.textContent = `Error: ${error.message}`;
        formFeedback.className = 'form-feedback error';
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

async function fetchAndDisplayReviews(productId) {
     if (!reviewList || !avgRatingEl || !reviewCountEl || !productId) return;
     reviewList.innerHTML = '<p>Loading reviews...</p>';
     try {
         // ***** CHANGE: Use 'onlineProducts/{productId}/reviews' subcollection *****
         const reviewsRef = collection(db, "onlineProducts", productId, "reviews");
         const q = query( reviewsRef, orderBy("createdAt", "desc") );

         const querySnapshot = await getDocs(q);
         const reviews = [];
         let totalRating = 0;
         querySnapshot.forEach((doc) => {
             const review = { id: doc.id, ...doc.data() };
             reviews.push(review);
             totalRating += review.rating;
         });

         const reviewCount = reviews.length;
         const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;
         avgRatingEl.textContent = averageRating.toFixed(1);
         reviewCountEl.textContent = `(${reviewCount} review${reviewCount !== 1 ? 's' : ''})`;

         if(currentProduct) { // Update schema if product data is loaded
             currentProduct.averageRating = averageRating;
             currentProduct.reviewCount = reviewCount;
             updateProductSchema(currentProduct);
         }

         if (reviewCount > 0) {
             reviewList.innerHTML = reviews.map(review => `
                 <div class="review-item">
                     <div class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
                     <p class="review-comment">"${review.comment}"</p>
                     <p class="review-author">- ${review.reviewerName || 'Anonymous'}</p>
                     <p class="review-date">${review.createdAt ? new Date(review.createdAt.toDate()).toLocaleDateString() : ''}</p>
                 </div>`).join('');
         } else {
             reviewList.innerHTML = '<p>Be the first to review this product!</p>';
         }
     } catch (error) {
         console.error("Error fetching reviews:", error);
         reviewList.innerHTML = `<p class="error">Could not load reviews. Error: ${error.message}</p>`;
         avgRatingEl.textContent = 'N/A';
         reviewCountEl.textContent = '(0 reviews)';
     }
}

// --- FAQ System ---
async function fetchAndDisplayFAQs(faqIds) {
    if (!faqListEl || !faqIds || faqIds.length === 0) {
        if (faqListEl) faqListEl.innerHTML = '<p>No FAQs available.</p>';
        const faqTabLink = document.querySelector('a[href="#faqs"]');
        const faqPane = document.getElementById('faqs');
        if(faqTabLink) faqTabLink.style.display = 'none';
        // if(faqPane) faqPane.style.display = 'none'; // Tab logic handles pane visibility
        return;
    }
    faqListEl.innerHTML = '<p>Loading FAQs...</p>';
    try {
        const faqs = [];
        for (const id of faqIds) {
             if (!id) continue;
             // Assuming FAQs are top-level 'faqs' collection, as per rules
             const faqRef = doc(db, "faqs", id);
             const docSnap = await getDoc(faqRef);
             if (docSnap.exists()) faqs.push({ id: docSnap.id, ...docSnap.data() });
             else console.warn(`FAQ with ID ${id} not found.`);
         }
        if (faqs.length > 0) {
            faqListEl.innerHTML = faqs.map((faq, index) => `
                <details class="faq-item"><summary class="faq-question">${index + 1}. ${faq.question}</summary><div class="faq-answer">${faq.answer}</div></details>
            `).join('');
            const faqTabLink = document.querySelector('a[href="#faqs"]');
            if(faqTabLink) faqTabLink.style.display = 'inline-block';
        } else {
            faqListEl.innerHTML = '<p>No FAQs available.</p>';
            const faqTabLink = document.querySelector('a[href="#faqs"]');
            if(faqTabLink) faqTabLink.style.display = 'none';
        }
    } catch (error) {
        console.error("Error fetching FAQs:", error);
        faqListEl.innerHTML = `<p class="error">Could not load FAQs. Error: ${error.message}</p>`;
    }
}

// --- Social Sharing ---
function setupSocialSharing(product) {
     if (!socialShareContainer || !product) return;
     const pageUrl = window.location.href;
     const shareText = `Check out: ${product.name} from Madhav Multiprint!`;
     const imageUrl = product.imageUrls?.[0] || '';
     const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + pageUrl)}`;
     const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
     const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(shareText)}`;
     const pinterestUrl = imageUrl ? `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(pageUrl)}&media=${encodeURIComponent(imageUrl)}&description=${encodeURIComponent(shareText)}` : '';

     socialShareContainer.innerHTML = `
         <span>Share:</span>
         <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp" class="social-icon whatsapp"><i class="fab fa-whatsapp"></i></a>
         <a href="${facebookUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook" class="social-icon facebook"><i class="fab fa-facebook-f"></i></a>
         <a href="${twitterUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on Twitter" class="social-icon twitter"><i class="fab fa-twitter"></i></a>
         ${pinterestUrl ? `<a href="${pinterestUrl}" target="_blank" rel="noopener noreferrer" aria-label="Pin on Pinterest" class="social-icon pinterest"><i class="fab fa-pinterest"></i></a>` : ''}
     `;
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Product Detail Page Loaded.");
    showLoading(true);
    const urlParams = new URLSearchParams(window.location.search);
    currentProductId = urlParams.get('id'); // Store globally

    if (!currentProductId) { showError("No product ID specified."); return; }
    console.log(`Workspaceing details for Product ID: ${currentProductId} from onlineProducts collection`);

    try {
        // ***** CHANGE: Use 'onlineProducts' collection *****
        const productRef = doc(db, "onlineProducts", currentProductId);
        const docSnap = await getDoc(productRef);

        if (docSnap.exists()) {
            const productData = { id: docSnap.id, ...docSnap.data() };
            console.log("Product data fetched:", productData);
            displayProductDetails(productData); // This now also calls setupReviewSystem with the ID

            // --- Attach Event Listeners after rendering ---
            const addToCartBtn = document.getElementById('add-to-cart-btn');
            // Review form listener is attached within setupReviewSystem

            if (addToCartBtn) {
                const handleAddToCart = () => { // Define handler here
                    console.log("Add to Cart button clicked.");
                    try {
                         const selectedQuantity = parseInt(document.getElementById('quantity-input').value, 10);
                         if (isNaN(selectedQuantity) || selectedQuantity < 1) { showCartFeedback("Please enter a valid quantity.", 'error'); return; }
                         let priceDetails = calculatePrice(currentProduct);
                         let selectedOptions = {};
                         let optionsValid = true; // Flag for validation

                         if (currentProduct.category === 'Flex Banner') {
                            options = getSelectedFlexOptions();
                            if (!options.width || !options.height || parseFloat(options.width) <= 0 || parseFloat(options.height) <= 0) {
                                showCartFeedback("Please enter valid dimensions for the flex banner.", 'error');
                                optionsValid = false; // Mark options as invalid
                            } else {
                                priceDetails = calculatePrice(currentProduct, 1, options); // Recalculate with valid options
                                selectedOptions = options;
                            }
                         } else if (currentProduct.category === 'Wedding Cards') {
                              const cardTypeSelect = document.getElementById('wedding-card-type');
                              if (cardTypeSelect) options.cardType = cardTypeSelect.value;
                              priceDetails = calculatePrice(currentProduct, 1, options);
                              selectedOptions = options;
                         }
                         // Add other option gathering/validation logic here...


                         if (optionsValid) { // Only add to cart if options are valid
                             addToCart(
                                 currentProductId, currentProduct.name, selectedQuantity,
                                 priceDetails.finalPrice, // Use final calculated price per item
                                 currentProduct.imageUrls?.[0] || 'path/to/default/image.jpg',
                                 selectedOptions // Pass selected options
                             );
                            showCartFeedback(`${selectedQuantity} x ${currentProduct.name} added to cart!`, 'success');
                            updateCartCount();
                         } // If options were not valid, feedback was already shown

                    } catch (cartError) {
                        console.error("Error adding to cart:", cartError);
                        showCartFeedback(`Error adding item: ${cartError.message}`, 'error');
                    }
                }; // END of handleAddToCart

                 addToCartBtn.removeEventListener('click', handleAddToCart); // Prevent duplicates
                 addToCartBtn.addEventListener('click', handleAddToCart);
            } else {
                console.error("Add to Cart button not found after rendering!");
            }

        } else {
            console.error(`No product found with ID: ${currentProductId} in onlineProducts collection.`);
            showError(`Sorry, we couldn't find the product (ID: ${currentProductId}). It might have been removed or the link is incorrect.`);
        }
    } catch (error) {
        console.error("Error fetching product details:", error);
        // Check specifically for permission errors, although rules should allow reads now
        if (error.code === 'permission-denied') {
             showError(`Error: Insufficient permissions to read product data from onlineProducts. Please check Firestore rules.`);
        } else {
            showError(`Failed to load product details. Please try refreshing. Error: ${error.message}`);
        }
    } finally {
         showLoading(false);
    }
}); // End DOMContentLoaded