// js/product-detail.js
// FINAL UPDATED Version: Includes Tabs, Quantity Buttons, New Price Layout, Related Products Slider, Schema Update, Review Logic, Social Sharing, and Error Checks
// Corrected Price Calculation for Wedding Cards & Flex Banners + Image in Cart
// Intended to fix SyntaxError caused by previous copy-paste issues.

// --- Imports ---
import { db } from './firebase-config.js';
// Import necessary Firestore functions
import {
    doc, getDoc, collection, query, where, limit, getDocs, addDoc, serverTimestamp, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { addToCart } from './cart.js';
// Ensure updateCartCount is exported from main.js or handle it appropriately
// If main.js doesn't export it reliably, consider adding a fallback or direct update mechanism here.
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
    // Hide error message when loading starts
    if (errorMessageContainer && isLoading) {
        errorMessageContainer.style.display = 'none';
        errorMessageContainer.textContent = '';
    }
}

// Function to display error messages
function showError(message) {
    showLoading(false); // Hide loading indicator
    if (errorMessageContainer) {
        errorMessageContainer.textContent = message;
        errorMessageContainer.style.display = 'block';
    }
    if (productContent) {
        productContent.style.display = 'none'; // Hide content area on error
    }
}

// Show feedback message near cart button
function showCartFeedback(message, type = 'success') {
    if (!cartFeedback) return;
    cartFeedback.textContent = message;
    cartFeedback.className = `cart-feedback-message ${type}`; // Apply class for styling (e.g., success or error)
    cartFeedback.style.display = 'block';

    // Hide the message after 3 seconds
    setTimeout(() => {
        cartFeedback.style.display = 'none';
    }, 3000);
}


// --- Product Data Display Functions ---

// Update breadcrumbs
function updateBreadcrumbs(category, productName) {
    const breadcrumbsContainer = document.querySelector('.breadcrumbs');
    if (breadcrumbsContainer) {
        // Basic breadcrumb structure - enhance as needed
        breadcrumbsContainer.innerHTML = `
            <a href="index.html">Home</a> &gt;
            <a href="products.html?category=${encodeURIComponent(category)}">${category}</a> &gt;
            <span id="breadcrumb-product-name">${productName}</span>
        `;
    }
}

// Function to display images (main and thumbnails)
function displayImages(imageUrls) {
    if (!imageUrls || imageUrls.length === 0) {
        mainImageEl.src = 'path/to/default/image.jpg'; // Fallback image
        mainImageEl.alt = "No image available";
        thumbnailContainer.innerHTML = ''; // Clear thumbnails
        return;
    }

    mainImageEl.src = imageUrls[0];
    mainImageEl.alt = currentProduct.name; // Use product name for alt text
    thumbnailContainer.innerHTML = ''; // Clear previous thumbnails

    if (imageUrls.length > 1) {
        imageUrls.forEach((url, index) => {
            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.alt = `${currentProduct.name} - view ${index + 1}`;
            thumb.classList.add('thumbnail');
            if (index === 0) {
                thumb.classList.add('active');
            }
            thumb.addEventListener('click', () => {
                mainImageEl.src = url;
                // Update active thumbnail
                thumbnailContainer.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            });
            thumbnailContainer.appendChild(thumb);
        });
    }
}

// --- Price Calculation & Display ---

// Enhanced Price Calculation Logic
function calculatePrice(product, quantity = 1, options = {}) {
    let basePrice = parseFloat(product.price || 0);
    let originalPrice = basePrice; // Store the original base price
    let discount = parseFloat(product.discountPercentage || 0);
    let finalPrice = basePrice;
    let priceDetailsHTML = ''; // To build the HTML string for display

    console.log(`Calculating price for: ${product.name}, Base Price: ${basePrice}, Discount: ${discount}%`);

    // Apply percentage discount if available
    if (discount > 0) {
        finalPrice = basePrice * (1 - discount / 100);
        console.log(`Applied ${discount}% discount. Price after discount: ${finalPrice}`);
        // Display original price struck through
        priceDetailsHTML += `<span class="original-price">₹${basePrice.toFixed(2)}</span> `;
        if (discountBadgeEl) {
            discountBadgeEl.textContent = `${discount}% OFF`;
            discountBadgeEl.style.display = 'inline-block';
        }
    } else {
        // Hide discount badge and original price element if no discount
        if (originalPriceEl) originalPriceEl.style.display = 'none';
        if (discountBadgeEl) discountBadgeEl.style.display = 'none';
    }

    // --- Category-Specific Pricing Adjustments ---

    // 1. Wedding Cards Pricing Logic
    if (product.category === 'Wedding Cards' && options.cardType) {
         // Example: Different card types have different base prices or adjustments
         const cardTypePrices = {
             'Standard': 0,      // Base price is standard
             'Premium': 5,       // Premium adds ₹5 per card
             'Luxury': 15        // Luxury adds ₹15 per card
         };
         const typeAdjustment = cardTypePrices[options.cardType] || 0;
         finalPrice += typeAdjustment; // Add adjustment to the possibly discounted price
         originalPrice += typeAdjustment; // Adjust original price for comparison too
         console.log(`Wedding Card Type: ${options.cardType}, Adjustment: ${typeAdjustment}, New Price: ${finalPrice}`);
         // Update HTML if original price needs display after adjustment
         if(discount > 0) {
            priceDetailsHTML = `<span class="original-price">₹${originalPrice.toFixed(2)}</span> `;
         }
    }

    // 2. Flex Banner Pricing Logic (Based on Size and Sides)
    if (product.category === 'Flex Banner' && options.width && options.height) {
        const width = parseFloat(options.width);
        const height = parseFloat(options.height);
        const sides = parseInt(options.sides || 1, 10); // Default to 1 side if not specified

        if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
            const area = width * height; // Area in square feet (assuming inputs are in feet)
            const pricePerSqFt = parseFloat(product.pricePerSqFt || 15); // Default price per sq ft if not specified on product
            let calculatedFlexPrice = area * pricePerSqFt;

            // Adjust for double-sided printing (e.g., 80% extra cost for the second side)
            if (sides === 2) {
                calculatedFlexPrice *= 1.8; // Example: 80% increase for double-sided
            }

            // Overwrite finalPrice with the calculated flex price
            finalPrice = calculatedFlexPrice;
            // If there was a discount, apply it to the *calculated* flex price
            if (discount > 0) {
                 originalPrice = finalPrice / (1 - discount / 100); // Recalculate original based on final flex price
                 priceDetailsHTML = `<span class="original-price">₹${originalPrice.toFixed(2)}</span> `;
            } else {
                priceDetailsHTML = ''; // No original price needed if no discount
            }

            console.log(`Flex Banner: ${width}x${height} ft, Area: ${area} sq ft, Sides: ${sides}, Price/sqft: ${pricePerSqFt}, Calculated Price: ${finalPrice}`);
        } else {
             console.warn("Invalid dimensions for Flex Banner price calculation.");
        }
    }

    // --- Final Price Display ---
    priceDetailsHTML += `<span class="current-price">₹${finalPrice.toFixed(2)}</span>`;
    if (product.priceUnit) {
         priceDetailsHTML += ` <span class="price-unit">(${product.priceUnit})</span>`;
    }

    // Update the DOM elements for price
    if (productPriceEl) {
        productPriceEl.innerHTML = priceDetailsHTML; // Main price display area
    }
    // Update hidden original price element separately if needed elsewhere
    if (originalPriceEl && discount > 0) {
        originalPriceEl.textContent = `₹${originalPrice.toFixed(2)}`;
        originalPriceEl.style.display = 'inline'; // Ensure it's visible
    } else if (originalPriceEl) {
         originalPriceEl.style.display = 'none';
    }


    // Return both the final price per item and the original (base or adjusted) price
    return {
        finalPrice: finalPrice, // The price per single item after all adjustments/discounts
        originalPrice: originalPrice // The base price before discount, possibly adjusted for options
    };
}


// Function to get selected options for Flex Banners
function getSelectedFlexOptions() {
    const widthInput = document.getElementById('flex-width');
    const heightInput = document.getElementById('flex-height');
    const sidesInput = document.getElementById('flex-sides');
    const qualityInput = document.getElementById('flex-quality'); // Example: Add quality if needed

    return {
        width: widthInput?.value || null,
        height: heightInput?.value || null,
        sides: sidesInput?.value || null,
        quality: qualityInput?.value || null // Include other options
    };
}


// Function to update price display when options change
function handleOptionChange() {
    if (!currentProduct) return;
    const quantity = parseInt(quantityInput.value, 10);
    let options = {};
    if (currentProduct.category === 'Flex Banner') {
        options = getSelectedFlexOptions();
        // Basic validation for flex dimensions
        if (!options.width || !options.height || parseFloat(options.width) <= 0 || parseFloat(options.height) <= 0) {
            console.warn("Flex dimensions are invalid or missing.");
            // Optionally disable add to cart or show a warning message near the price
             if (productPriceEl) {
                  productPriceEl.innerHTML += ' <span style="color: red; font-size: 0.8em;">(Enter valid dimensions)</span>';
             }
            return; // Stop price calculation if dimensions invalid
        }
    } else if (currentProduct.category === 'Wedding Cards') {
         const cardTypeSelect = document.getElementById('wedding-card-type');
         if (cardTypeSelect) {
             options.cardType = cardTypeSelect.value;
         }
    }
    // Add logic for other categories with options here...

    calculatePrice(currentProduct, quantity, options);
}

// Display Flex Banner specific options
function displayFlexOptions(product) {
    if (!flexOptionsContainer) return;
    if (product.category === 'Flex Banner') {
        flexOptionsContainer.innerHTML = `
            <h4>Customize Your Flex Banner</h4>
            <div class="flex-options">
                 <div class="form-group-inline">
                    <label for="flex-width">Width (ft):</label>
                    <input type="number" id="flex-width" name="flex-width" min="1" step="0.1" required>
                 </div>
                 <div class="form-group-inline">
                     <label for="flex-height">Height (ft):</label>
                     <input type="number" id="flex-height" name="flex-height" min="1" step="0.1" required>
                 </div>
                 <div class="form-group-inline quantity-control-group"> <label for="flex-sides">Sides:</label>
                    <select id="flex-sides" name="flex-sides">
                        <option value="1">Single-Sided</option>
                        <option value="2">Double-Sided</option>
                    </select>
                 </div>
                 </div>
                 <p class="price-note">Price calculated based on square footage and sides.</p>
             `;
        // Attach event listeners to update price on change
        flexOptionsContainer.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('change', handleOptionChange);
            input.addEventListener('keyup', handleOptionChange); // For number inputs
        });
        flexOptionsContainer.style.display = 'block';
    } else {
        flexOptionsContainer.innerHTML = '';
        flexOptionsContainer.style.display = 'none';
    }
}

// Display Wedding Card options (Example)
function displayWeddingCardOptions(product) {
     // Assuming you have a container like flexOptionsContainer or a dedicated one
     const optionsContainer = document.getElementById('wedding-card-options-container'); // Create this in HTML if needed
     if (!optionsContainer) return;

     if (product.category === 'Wedding Cards') {
         optionsContainer.innerHTML = `
             <h4>Select Card Options</h4>
             <div class="form-group">
                 <label for="wedding-card-type">Card Type:</label>
                 <select id="wedding-card-type" name="wedding-card-type">
                     <option value="Standard">Standard</option>
                     <option value="Premium">Premium (+₹5)</option>
                     <option value="Luxury">Luxury (+₹15)</option>
                 </select>
             </div>
             `;
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

    const { finalPrice } = calculatePrice(product, 1, {}); // Get base price for schema

    const schema = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": product.name,
        "image": product.imageUrls || [],
        "description": product.description || product.shortDescription || "High-quality printing services by Madhav Multiprint.",
        "sku": product.sku || product.id, // Use product ID if SKU is missing
        "brand": {
            "@type": "Brand",
            "name": "Madhav Multiprint"
        },
        "offers": {
            "@type": "Offer",
            "url": window.location.href, // Current page URL
            "priceCurrency": "INR",
            "price": finalPrice.toFixed(2), // Use calculated final price
            "itemCondition": "https://schema.org/NewCondition",
            "availability": product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            "priceValidUntil": new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0] // Price valid for 1 year (example)
        },
        // Add aggregateRating if reviews are available
        // "aggregateRating": {
        //   "@type": "AggregateRating",
        //   "ratingValue": "4.8", // Fetch dynamically
        //   "reviewCount": "5" // Fetch dynamically
        // },
        // "review": [ // Add individual reviews if available
        //   {
        //     "@type": "Review",
        //     "author": {"@type": "Person", "name": "Customer Name"},
        //     "datePublished": "2024-01-15",
        //     "reviewBody": "Great product!",
        //     "reviewRating": {
        //       "@type": "Rating",
        //       "ratingValue": "5"
        //     }
        //   }
        // ]
    };

    // Update Aggregate Rating dynamically if reviews exist
    if (product.averageRating && product.reviewCount > 0) {
        schema.aggregateRating = {
            "@type": "AggregateRating",
            "ratingValue": product.averageRating.toFixed(1),
            "bestRating": "5",
            "worstRating": "1",
            "ratingCount": product.reviewCount
        };
    }


    productSchemaEl.textContent = JSON.stringify(schema, null, 2); // Pretty print JSON
}


// Display Product Details
function displayProductDetails(product) {
    currentProduct = product; // Store globally

    if (!product) {
        showError("Product data is not available.");
        return;
    }

    // Basic Info
    if (productNameEl) productNameEl.textContent = product.name || 'Product Name Unavailable';
    if (breadcrumbProductName) breadcrumbProductName.textContent = product.name || ''; // Update breadcrumb span
    if (productDescriptionEl) productDescriptionEl.innerHTML = product.description || 'No description available.'; // Use innerHTML if desc contains HTML

    // Update breadcrumbs
    updateBreadcrumbs(product.category || 'Products', product.name || 'Details');

    // Images
    displayImages(product.imageUrls || []);

    // Price - Initial calculation (quantity 1, no options yet)
    calculatePrice(product, 1, {});

    // Features (render as list)
    if (featuresListEl && product.features && product.features.length > 0) {
        featuresListEl.innerHTML = product.features.map(feature => `<li>${feature}</li>`).join('');
        featuresListEl.closest('.tab-pane')?.classList.add('active'); // Show features tab if content exists
    } else if (featuresListEl) {
        featuresListEl.innerHTML = '<li>No specific features listed.</li>';
    }

     // Display category-specific options BEFORE attaching event listeners that depend on them
     displayFlexOptions(product); // Display flex inputs if it's a flex product
     displayWeddingCardOptions(product); // Display wedding card options if applicable

    // Initialize Quantity Controls
    setupQuantityControls();

    // Setup Tabs
    setupTabs();

    // Load related products
    fetchRelatedProducts(product.category, product.id);

    // Update the structured data
    updateProductSchema(product);

    // Setup Reviews
    setupReviewSystem(currentProductId);

    // Setup FAQs
    fetchAndDisplayFAQs(product.faqIds || []);

    // Setup Social Sharing
    setupSocialSharing(product);

}

// --- Quantity Controls ---
function setupQuantityControls() {
    if (!quantityInput || !quantityDecreaseBtn || !quantityIncreaseBtn) return;

    quantityDecreaseBtn.addEventListener('click', () => {
        let currentValue = parseInt(quantityInput.value, 10);
        if (currentValue > 1) {
            quantityInput.value = currentValue - 1;
             handleOptionChange(); // Recalculate price on quantity change
        }
    });

    quantityIncreaseBtn.addEventListener('click', () => {
        let currentValue = parseInt(quantityInput.value, 10);
        // Add check for stock if available: if (currentValue < currentProduct.stock)
        quantityInput.value = currentValue + 1;
         handleOptionChange(); // Recalculate price on quantity change
    });

    quantityInput.addEventListener('change', () => {
        let currentValue = parseInt(quantityInput.value, 10);
        if (isNaN(currentValue) || currentValue < 1) {
            quantityInput.value = 1; // Reset to minimum if invalid
        }
         handleOptionChange(); // Recalculate price on quantity change
    });
}

// --- Tabs Functionality ---
function setupTabs() {
    if (!tabsNav || !tabsContent) return;

    const tabLinks = tabsNav.querySelectorAll('a');
    const tabPanes = tabsContent.querySelectorAll('.tab-pane');

    // Function to switch tabs
    const switchTab = (targetId) => {
        tabLinks.forEach(link => link.classList.remove('active'));
        tabPanes.forEach(pane => pane.classList.remove('active'));

        const activeLink = tabsNav.querySelector(`a[href="#${targetId}"]`);
        const activePane = tabsContent.querySelector(`#${targetId}`);

        if (activeLink) activeLink.classList.add('active');
        if (activePane) activePane.classList.add('active');
    };

    // Add click listeners to tab links
    tabLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1); // Get ID from href="#..."
            switchTab(targetId);
        });
    });

    // Activate the first visible tab by default, or Features if it has content
     // Find the first tab pane that should be visible (e.g., description or features if populated)
     let defaultTabId = 'description'; // Default to description
     const featuresPane = document.getElementById('features');
     if (featuresPane && featuresListEl && featuresListEl.children.length > 1) { // Check if features has actual content
          defaultTabId = 'features';
     }
     // Find the reviews pane and check if it should be shown initially
     const reviewsPane = document.getElementById('reviews');
     // Add logic here if you want reviews to be default under certain conditions


     // Activate the determined default tab
     switchTab(defaultTabId);


}

// --- Related Products ---
async function fetchRelatedProducts(category, currentProductId) {
    if (!relatedProductsContainer || !category || !currentProductId) {
         if (relatedProductsSection) relatedProductsSection.style.display = 'none';
         return;
    }

    console.log(`Workspaceing related products for category: ${category}, excluding ID: ${currentProductId}`);
    relatedProductsContainer.innerHTML = '<div class="swiper-slide"><p>Loading related products...</p></div>'; // Show loading state

    try {
        const productsRef = collection(db, "products");
        // Query for products in the same category, excluding the current one, limit results
        const q = query(
            productsRef,
            where("category", "==", category),
            limit(8) // Limit to 8 related products
        );

        const querySnapshot = await getDocs(q);
        let relatedProducts = [];
        querySnapshot.forEach((doc) => {
            // Exclude the current product itself from the related list
            if (doc.id !== currentProductId) {
                relatedProducts.push({ id: doc.id, ...doc.data() });
            }
        });

         // Limit again after filtering, just in case the current product was in the first 'limit' results
         relatedProducts = relatedProducts.slice(0, 6); // Show max 6


        if (relatedProducts.length > 0) {
            displayRelatedProducts(relatedProducts);
            relatedProductsSection.style.display = 'block'; // Show the section
        } else {
            console.log("No related products found.");
            relatedProductsSection.style.display = 'none'; // Hide if none found
        }
    } catch (error) {
        console.error("Error fetching related products:", error);
         relatedProductsContainer.innerHTML = '<div class="swiper-slide"><p>Could not load related products.</p></div>';
         relatedProductsSection.style.display = 'block'; // Still show section, but with error message
    }
}

function displayRelatedProducts(products) {
    relatedProductsContainer.innerHTML = ''; // Clear loading/previous

    products.forEach(product => {
        const { finalPrice, originalPrice } = calculatePrice(product, 1, {}); // Get price for display
        const hasDiscount = product.discountPercentage && product.discountPercentage > 0;

        const slide = document.createElement('div');
        slide.classList.add('swiper-slide'); // Necessary for Swiper

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
            </div>
        `;
        relatedProductsContainer.appendChild(slide);
    });

    // Initialize Swiper for related products
    initializeRelatedProductsSwiper();
}


function initializeRelatedProductsSwiper() {
     // Ensure Swiper library is loaded
     if (typeof Swiper === 'undefined') {
         console.error("Swiper library not loaded.");
         return;
     }

     // Destroy previous instance if exists
     if (relatedProductsContainer.swiper) {
         relatedProductsContainer.swiper.destroy(true, true);
     }


     // Initialize Swiper
     new Swiper('.related-products-swiper', {
         slidesPerView: 1,
         spaceBetween: 15,
         pagination: {
             el: '.swiper-pagination',
             clickable: true,
         },
         navigation: {
             nextEl: '.swiper-button-next',
             prevEl: '.swiper-button-prev',
         },
         breakpoints: {
             // when window width is >= 480px
             480: {
                 slidesPerView: 2,
                 spaceBetween: 20
             },
             // when window width is >= 768px
             768: {
                 slidesPerView: 3,
                 spaceBetween: 30
             },
             // when window width is >= 1024px
             1024: {
                 slidesPerView: 4, // Show 4 slides on larger screens
                 spaceBetween: 30
             }
         }
     });
     console.log("Related products swiper initialized.");
}


// --- Review System ---

function setupReviewSystem(productId) {
    if (!reviewSection || !productId) {
        console.warn("Review section or Product ID not found. Skipping review setup.");
        return;
    }
     console.log("Setting up review system for product:", productId);


     // Display existing reviews
     fetchAndDisplayReviews(productId);

     // Handle review form submission
     if (reviewForm) {
         reviewForm.addEventListener('submit', (e) => handleReviewSubmit(e, productId));
     } else {
         console.warn("Review form element not found.");
     }
}

async function handleReviewSubmit(event, productId) {
    event.preventDefault();
    if (!reviewForm) return;

    const ratingInput = reviewForm.querySelector('input[name="rating"]:checked');
    const commentInput = reviewForm.querySelector('textarea[name="comment"]');
    const nameInput = reviewForm.querySelector('input[name="reviewerName"]'); // Assuming you add this field
    const submitButton = reviewForm.querySelector('button[type="submit"]');
    const formFeedback = reviewForm.querySelector('.form-feedback'); // Add a div for feedback

    if (!ratingInput) {
        if (formFeedback) formFeedback.textContent = "Please select a rating.";
        return;
    }
    if (!commentInput || commentInput.value.trim() === '') {
         if (formFeedback) formFeedback.textContent = "Please enter your comment.";
         return;
     }
     if (!nameInput || nameInput.value.trim() === '') {
         if (formFeedback) formFeedback.textContent = "Please enter your name.";
         return;
     }


    const reviewData = {
        productId: productId,
        rating: parseInt(ratingInput.value, 10),
        comment: commentInput.value.trim(),
        reviewerName: nameInput.value.trim(), // Include reviewer's name
        createdAt: serverTimestamp() // Use Firestore server timestamp
    };

    // Disable button and show loading state
    if (submitButton) submitButton.disabled = true;
    if (formFeedback) formFeedback.textContent = "Submitting review...";

    try {
        const reviewsRef = collection(db, "reviews");
        await addDoc(reviewsRef, reviewData);

        if (formFeedback) formFeedback.textContent = "Review submitted successfully! Thank you.";
        formFeedback.className = 'form-feedback success'; // Style for success
        reviewForm.reset(); // Clear the form

        // Refresh the review list after successful submission
        await fetchAndDisplayReviews(productId); // Refresh reviews

    } catch (error) {
        console.error("Error submitting review:", error);
        if (formFeedback) formFeedback.textContent = `Error: ${error.message}`;
        formFeedback.className = 'form-feedback error'; // Style for error
    } finally {
        if (submitButton) submitButton.disabled = false; // Re-enable button
    }
}


// Fetch and Display Reviews
async function fetchAndDisplayReviews(productId) {
     if (!reviewList || !avgRatingEl || !reviewCountEl) return;

     reviewList.innerHTML = '<p>Loading reviews...</p>'; // Loading indicator

     try {
         const reviewsRef = collection(db, "reviews");
         const q = query(
             reviewsRef,
             where("productId", "==", productId),
             orderBy("createdAt", "desc") // Show newest reviews first
         );

         const querySnapshot = await getDocs(q);
         const reviews = [];
         let totalRating = 0;

         querySnapshot.forEach((doc) => {
             const review = { id: doc.id, ...doc.data() };
             reviews.push(review);
             totalRating += review.rating;
         });

         // Calculate average rating and count
         const reviewCount = reviews.length;
         const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;

         // Update average rating display
         avgRatingEl.textContent = averageRating.toFixed(1); // Format to one decimal place
         reviewCountEl.textContent = `(${reviewCount} review${reviewCount !== 1 ? 's' : ''})`; // Pluralize 'review'

         // Update Aggregate Rating in product schema (if product data is available)
         if(currentProduct) {
             currentProduct.averageRating = averageRating;
             currentProduct.reviewCount = reviewCount;
             updateProductSchema(currentProduct);
         }


         // Display reviews
         if (reviewCount > 0) {
             reviewList.innerHTML = reviews.map(review => `
                 <div class="review-item">
                     <div class="review-rating">
                         ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}
                     </div>
                     <p class="review-comment">"${review.comment}"</p>
                     <p class="review-author">- ${review.reviewerName || 'Anonymous'}</p>
                     <p class="review-date">${review.createdAt ? new Date(review.createdAt.toDate()).toLocaleDateString() : ''}</p>
                 </div>
             `).join('');
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
        if (faqListEl) faqListEl.innerHTML = '<p>No frequently asked questions available for this product.</p>';
        // Hide the entire FAQ tab/section if desired
        const faqTabLink = document.querySelector('a[href="#faqs"]');
        const faqPane = document.getElementById('faqs');
        if(faqTabLink) faqTabLink.style.display = 'none';
        if(faqPane) faqPane.style.display = 'none';
        return;
    }

    faqListEl.innerHTML = '<p>Loading FAQs...</p>'; // Loading indicator

    try {
        const faqs = [];
        // Fetch each FAQ document based on the IDs provided in the product data
        for (const id of faqIds) {
             if (!id) continue; // Skip if ID is empty/invalid
             const faqRef = doc(db, "faqs", id); // Assuming FAQs are in a top-level 'faqs' collection
             const docSnap = await getDoc(faqRef);
             if (docSnap.exists()) {
                 faqs.push({ id: docSnap.id, ...docSnap.data() });
             } else {
                 console.warn(`FAQ with ID ${id} not found.`);
             }
         }


        if (faqs.length > 0) {
            faqListEl.innerHTML = faqs.map((faq, index) => `
                <details class="faq-item">
                    <summary class="faq-question">${index + 1}. ${faq.question}</summary>
                    <div class="faq-answer">
                        ${faq.answer}
                    </div>
                </details>
            `).join('');
            // Show the FAQ tab/section if hidden
            const faqTabLink = document.querySelector('a[href="#faqs"]');
             const faqPane = document.getElementById('faqs');
             if(faqTabLink) faqTabLink.style.display = 'inline-block'; // Or block, depending on layout
             // if(faqPane) faqPane.style.display = 'block'; // Pane visibility handled by tab logic
        } else {
            faqListEl.innerHTML = '<p>No frequently asked questions available for this product.</p>';
             // Hide tab/section if no FAQs were actually found
             const faqTabLink = document.querySelector('a[href="#faqs"]');
             const faqPane = document.getElementById('faqs');
             if(faqTabLink) faqTabLink.style.display = 'none';
             // if(faqPane) faqPane.style.display = 'none';
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
     const shareText = `Check out this product: ${product.name} from Madhav Multiprint!`;
     const imageUrl = product.imageUrls?.[0] || ''; // Get first image URL

     const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + pageUrl)}`;
     const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
     const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(shareText)}`;
     // Pinterest requires an image URL
     const pinterestUrl = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(pageUrl)}&media=${encodeURIComponent(imageUrl)}&description=${encodeURIComponent(shareText)}`;


     socialShareContainer.innerHTML = `
         <span>Share:</span>
         <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp" class="social-icon whatsapp"><i class="fab fa-whatsapp"></i></a>
         <a href="${facebookUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook" class="social-icon facebook"><i class="fab fa-facebook-f"></i></a>
         <a href="${twitterUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on Twitter" class="social-icon twitter"><i class="fab fa-twitter"></i></a>
          ${imageUrl ? `<a href="${pinterestUrl}" target="_blank" rel="noopener noreferrer" aria-label="Pin on Pinterest" class="social-icon pinterest"><i class="fab fa-pinterest"></i></a>` : ''}
     `;
}



// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Product Detail Page Loaded.");
    showLoading(true);

    // Get product ID from URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    currentProductId = urlParams.get('id'); // Store globally

    if (!currentProductId) {
        showError("No product ID specified in the URL.");
        return;
    }

    console.log(`Workspaceing details for Product ID: ${currentProductId}`);

    try {
        // Reference to the specific product document in Firestore
        const productRef = doc(db, "products", currentProductId);

        // Fetch the document data
        const docSnap = await getDoc(productRef);

        if (docSnap.exists()) {
            // Product found, display its details
            const productData = { id: docSnap.id, ...docSnap.data() };
            console.log("Product data fetched:", productData);
            displayProductDetails(productData);

            // --- Attach Event Listeners after rendering ---
            // Must be done *after* elements exist in the DOM
            const addToCartBtn = document.getElementById('add-to-cart-btn');
            const reviewForm = document.getElementById('review-form'); // Ensure this ID matches your HTML form

            if (addToCartBtn) {
                // Define the handler function here, potentially referencing 'currentProduct' if needed within its scope
                const handleAddToCart = () => { // Define the handler function
                    console.log("Add to Cart button clicked.");
                    // ... (rest of the addToCart logic) ...
                    try {
                         const selectedQuantity = parseInt(document.getElementById('quantity-input').value, 10);
                         // Ensure quantity is valid
                         if (isNaN(selectedQuantity) || selectedQuantity < 1) {
                             showCartFeedback("Please enter a valid quantity.", 'error');
                             return;
                         }

                         // Get selected variation/options if applicable
                         let priceDetails = calculatePrice(currentProduct); // Use the price calculation logic
                         let selectedOptions = {};

                         if (currentProduct.category === 'Flex Banner') {
                            options = getSelectedFlexOptions();
                             // Validate Flex options before adding to cart
                            if (!options.width || !options.height || parseFloat(options.width) <= 0 || parseFloat(options.height) <= 0) {
                                showCartFeedback("Please enter valid dimensions for the flex banner.", 'error');
                                return; // Prevent adding to cart
                            }
                            // Recalculate price with final options for cart
                             priceDetails = calculatePrice(currentProduct, 1, options);
                             selectedOptions = options;

                         } else if (currentProduct.category === 'Wedding Cards') {
                              const cardTypeSelect = document.getElementById('wedding-card-type');
                              if (cardTypeSelect) {
                                  options.cardType = cardTypeSelect.value;
                              }
                               // Recalculate price with final options for cart
                              priceDetails = calculatePrice(currentProduct, 1, options);
                              selectedOptions = options;
                         }
                         // Add other option gathering logic here...


                         // Add item to cart using imported function
                         addToCart(
                             currentProductId,
                             currentProduct.name,
                             selectedQuantity,
                             priceDetails.finalPrice, // Use calculated final price per item
                             currentProduct.imageUrls?.[0] || 'path/to/default/image.jpg', // Main image
                             selectedOptions // Pass selected options
                         );

                        showCartFeedback(`${selectedQuantity} x ${currentProduct.name} added to cart!`, 'success');
                        updateCartCount(); // Update header count (imported from main.js)

                    } catch (cartError) {
                        console.error("Error adding to cart:", cartError);
                        showCartFeedback(`Error adding item: ${cartError.message}`, 'error');
                    }
                }; // END of handleAddToCart function definition

                 // Remove previous listener before adding new one to prevent duplicates on potential re-renders
                 addToCartBtn.removeEventListener('click', handleAddToCart);
                 addToCartBtn.addEventListener('click', handleAddToCart);
            } else {
                console.error("Add to Cart button not found after rendering!");
            }

            // Review form listener is attached in setupReviewSystem if form exists

        } else {
            // Product with the given ID doesn't exist in Firestore
            console.error(`No product found with ID: ${currentProductId}`);
            showError(`Sorry, we couldn't find the product you're looking for (ID: ${currentProductId}). It might have been removed or the link is incorrect.`);
        }
    } catch (error) {
        // Handle errors during Firestore fetch or processing
        console.error("Error fetching product details:", error);
        showError(`Failed to load product details. Please try refreshing the page. Error: ${error.message}`);
    } finally {
         // Ensure loading indicator is always hidden after attempt, regardless of success/failure
         showLoading(false);
    }
}); // End DOMContentLoaded