// js/product-detail.js
// FINAL UPDATED Version: Includes Tabs, Quantity Buttons, New Price Layout, Related Products Slider, Schema Update, Review Logic, Social Sharing, and Error Checks
// Corrected Price Calculation for Wedding Cards & Flex Banners + Image in Cart

// --- Imports ---\
import { db } from './firebase-config.js';
// Import necessary Firestore functions
import {
    doc, getDoc, collection, query, where, limit, getDocs, addDoc, serverTimestamp, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { addToCart } from './cart.js';
// Ensure updateCartCount is exported from main.js or handle it appropriately
import { updateCartCount } from './main.js';

// --- DOM Elements ---\
const productDetailContainer = document.getElementById('product-detail-container');
const loadingIndicator = productDetailContainer?.querySelector('.loading-indicator');
const productContent = productDetailContainer?.querySelector('.product-content');
const errorMessageContainer = document.getElementById('error-message-container');
const breadcrumbProductName = document.getElementById('breadcrumb-product-name');
const productNameEl = document.getElementById('product-name');
const mainImageEl = document.getElementById('main-product-image');
const thumbnailImagesContainer = document.getElementById('thumbnail-images');
const priceEl = document.getElementById('product-price'); // Inside product-actions
const originalPriceEl = document.getElementById('original-price'); // Optional
const addToCartBtn = document.getElementById('add-to-cart-btn');
const cartFeedbackEl = document.getElementById('cart-feedback');
const quantityInput = document.getElementById('quantity-input'); // Standard quantity input
const quantityIncreaseBtn = document.getElementById('quantity-increase');
const quantityDecreaseBtn = document.getElementById('quantity-decrease');
const tabsContainer = document.querySelector('.product-tabs');
const tabContentsContainer = document.querySelector('.tab-contents');
const descriptionContent = document.getElementById('description-content');
const specificationsContent = document.getElementById('specifications-content');
const reviewsContent = document.getElementById('reviews-content');
const reviewForm = document.getElementById('review-form');
const reviewList = document.getElementById('review-list');
const relatedProductsContainer = document.getElementById('related-products-container');
const relatedLoadingIndicator = document.getElementById('related-loading');
const flexOptionsContainer = document.getElementById('flex-options'); // Container for flex inputs
const weddingOptionsContainer = document.getElementById('wedding-options'); // Container for wedding quantity

// --- Global Variables ---\
let currentProductData = null;
let currentProductId = null;

// --- Utility Functions ---\

// Function to display loading state
function showLoading(isLoading) {
    if (loadingIndicator) loadingIndicator.style.display = isLoading ? 'block' : 'none';
    if (productContent) productContent.style.display = isLoading ? 'none' : 'block'; // Hide content when loading
    if (isLoading && errorMessageContainer) errorMessageContainer.style.display = 'none'; // Hide errors when loading
}

// Function to display error messages
function showError(message) {
    showLoading(false); // Hide loading indicator
    if (productContent) productContent.style.display = 'none'; // Hide content on error
    if (errorMessageContainer) {
        errorMessageContainer.textContent = message;
        errorMessageContainer.style.display = 'block';
    }
    console.error("Error Displayed:", message); // Log error to console
}

// Function to show feedback messages (e.g., for cart actions)
function showFeedback(element, message, isError = false) {
    if (!element) return;
    element.textContent = message;
    element.className = isError ? 'feedback error' : 'feedback success'; // Add classes for styling
    element.style.display = 'block';
    // Hide message after 3 seconds
    setTimeout(() => {
        element.style.display = 'none';
    }, 3000);
}

// Format currency (ensure this matches your needs)
function formatCurrency(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return 'N/A'; // Or some other placeholder
    }
    return `₹${amount.toFixed(2)}`; // Example: ₹1,234.50
}

// --- Flex Banner Calculation Logic ---
/**
 * Calculates the printable square footage for a flex banner based on standard media widths.
 * @param {number} widthFt - Requested width in feet.
 * @param {number} heightFt - Requested height in feet.
 * @param {Array<number>} mediaWidthsFt - Array of available media widths in feet (e.g., [3, 4, 5, 6, 8, 10]).
 * @returns {{printSqFtPerBanner: number, actualWidthFt: number, actualHeightFt: number}} - Object with calculated dimensions.
 */
function calculateFlexDimensions(widthFt, heightFt, mediaWidthsFt = [3, 4, 5, 6, 8, 10]) {
    // Ensure dimensions are positive
    widthFt = Math.max(0, widthFt);
    heightFt = Math.max(0, heightFt);

    // Sort media widths for efficient searching
    mediaWidthsFt.sort((a, b) => a - b);

    let bestSqFt = Infinity;
    let actualWidth = widthFt; // Initialize with requested dimensions
    let actualHeight = heightFt;

    // Option 1: Print as is (width x height)
    // Find the smallest media width that fits the smaller dimension
    const smallerDim = Math.min(widthFt, heightFt);
    const largerDim = Math.max(widthFt, heightFt);
    let suitableMediaWidth = mediaWidthsFt.find(w => w >= smallerDim);

    if (suitableMediaWidth) {
        bestSqFt = largerDim * suitableMediaWidth; // Area used on the roll
        actualWidth = widthFt; // Keep original orientation
        actualHeight = heightFt;
    } else {
        // If even the largest media doesn't fit the smaller dimension, need multiple panels (complex case, maybe just use requested dimensions for now)
        console.warn(`Flex dimensions (${widthFt}x${heightFt}) exceed largest media width (${mediaWidthsFt[mediaWidthsFt.length - 1]}). Calculating based on requested size.`);
        bestSqFt = widthFt * heightFt;
        actualWidth = widthFt;
        actualHeight = heightFt;
        // More sophisticated logic could split the banner, but that's beyond basic calculation
    }


    // Option 2: Rotate 90 degrees (height x width) - Check if this is more efficient
    const smallerDimRotated = Math.min(heightFt, widthFt); // Same as smallerDim
    const largerDimRotated = Math.max(heightFt, widthFt); // Same as largerDim
    let suitableMediaWidthRotated = mediaWidthsFt.find(w => w >= smallerDimRotated);

    if (suitableMediaWidthRotated) {
        const rotatedSqFt = largerDimRotated * suitableMediaWidthRotated;
        if (rotatedSqFt < bestSqFt) {
            bestSqFt = rotatedSqFt;
            // Keep original width/height values as 'actual' because the *request* is still WxH
            // The calculation uses rotation for efficiency, but the user ordered WxH
            actualWidth = widthFt;
            actualHeight = heightFt;
        }
    }

    // If no suitable media found in either orientation (e.g., banner is wider/taller than largest roll)
    if (bestSqFt === Infinity) {
        console.error(`Could not find suitable media for dimensions ${widthFt}x${heightFt}. Using raw area.`);
        bestSqFt = widthFt * heightFt > 0 ? widthFt * heightFt : 0; // Avoid negative area if inputs were 0
        actualWidth = widthFt;
        actualHeight = heightFt;
    }


    console.log(`Flex Input: ${widthFt}x${heightFt}. Calculated Best SqFt Use: ${bestSqFt}. Actual Dims Used for Calc: W=${actualWidth}, H=${actualHeight}`);

    // Return the *calculated* square footage needed per banner,
    // but keep the original dimensions for reference if needed elsewhere.
    // The price should be based on bestSqFt.
    return {
        printSqFtPerBanner: bestSqFt > 0 ? bestSqFt : widthFt * heightFt, // Use calculated or raw area if calc failed but > 0
        actualWidthFt: widthFt, // Return original requested dimensions
        actualHeightFt: heightFt
    };
}


// --- Product Data Rendering ---

// Function to populate product details on the page
function renderProductDetails(productData) {
    if (!productData) {
        showError("Failed to load product data.");
        return;
    }

    currentProductData = productData; // Store globally

    // Update breadcrumb and product name
    if (breadcrumbProductName) breadcrumbProductName.textContent = productData.productName;
    if (productNameEl) productNameEl.textContent = productData.productName;

    // Update main image
    if (mainImageEl) {
        mainImageEl.src = productData.imageUrl || 'img/placeholder.png'; // Use placeholder if no image
        mainImageEl.alt = productData.productName;
    }

    // Update thumbnails
    if (thumbnailImagesContainer) {
        thumbnailImagesContainer.innerHTML = ''; // Clear existing thumbnails
        const imageUrls = [productData.imageUrl, ...(productData.additionalImages || [])].filter(Boolean); // Combine main and additional images

        if (imageUrls.length > 1) { // Only show thumbnails if there's more than one image
            imageUrls.forEach(url => {
                const img = document.createElement('img');
                img.src = url;
                img.alt = `${productData.productName} - Thumbnail`;
                img.addEventListener('click', () => {
                    if (mainImageEl) mainImageEl.src = url;
                    // Optionally highlight active thumbnail
                    thumbnailImagesContainer.querySelectorAll('img').forEach(thumb => thumb.classList.remove('active'));
                    img.classList.add('active');
                });
                thumbnailImagesContainer.appendChild(img);
            });
            // Set first thumbnail as active initially
            if (thumbnailImagesContainer.firstChild) {
                thumbnailImagesContainer.firstChild.classList.add('active');
            }
        } else {
            thumbnailImagesContainer.style.display = 'none'; // Hide container if only one image
        }
    }


    // --- Pricing Logic ---
    // Reset price display initially
    if (priceEl) priceEl.textContent = '';
    if (originalPriceEl) originalPriceEl.style.display = 'none';

    const category = productData.category?.toLowerCase() || '';
    const pricing = productData.pricing;

    if (category.includes('flex')) {
        // Hide standard price/quantity, show flex options
        if (priceEl) priceEl.closest('.price-section').style.display = 'none'; // Hide whole price section initially
        if (originalPriceEl) originalPriceEl.style.display = 'none';
        document.getElementById('standard-quantity-section')?.style.display = 'none';
        if (flexOptionsContainer) flexOptionsContainer.style.display = 'block';
        if (weddingOptionsContainer) weddingOptionsContainer.style.display = 'none';
        // Flex price is calculated on input change, see event listener below

    } else if (category.includes('wedding')) {
        // Hide standard price/quantity, show wedding options
        if (priceEl) priceEl.closest('.price-section').style.display = 'none'; // Hide whole price section initially
        if (originalPriceEl) originalPriceEl.style.display = 'none';
        document.getElementById('standard-quantity-section')?.style.display = 'none';
        if (flexOptionsContainer) flexOptionsContainer.style.display = 'none';
        if (weddingOptionsContainer) weddingOptionsContainer.style.display = 'block';
        // Populate wedding quantity dropdown
        populateWeddingQuantities(pricing?.quantities); // Assumes quantities are in pricing object
        // Wedding price is calculated on selection change

    } else { // Standard Product
        if (flexOptionsContainer) flexOptionsContainer.style.display = 'none';
        if (weddingOptionsContainer) weddingOptionsContainer.style.display = 'none';
        document.getElementById('standard-quantity-section')?.style.display = 'block'; // Show standard quantity
        if (priceEl?.closest('.price-section')) priceEl.closest('.price-section').style.display = 'block'; // Show price section

        if (pricing?.rate) {
            if (priceEl) priceEl.textContent = formatCurrency(pricing.rate);
            // Handle optional original price for discounts
            if (pricing.originalRate && pricing.originalRate > pricing.rate) {
                if (originalPriceEl) {
                    originalPriceEl.textContent = formatCurrency(pricing.originalRate);
                    originalPriceEl.style.display = 'inline'; // Show strikethrough price
                }
            }
        } else {
             if (priceEl) priceEl.textContent = "Price not available"; // Fallback
        }
    }


    // --- Tabs ---
    if (descriptionContent) descriptionContent.innerHTML = productData.description || 'No description available.';
    if (specificationsContent) {
        const specs = productData.specifications; // Assuming it's an object like { key: value, ... }
        if (specs && typeof specs === 'object' && Object.keys(specs).length > 0) {
            let specsHtml = '<ul>';
            for (const key in specs) {
                specsHtml += `<li><strong>${key}:</strong> ${specs[key]}</li>`;
            }
            specsHtml += '</ul>';
            specificationsContent.innerHTML = specsHtml;
        } else {
            specificationsContent.innerHTML = 'No specifications available.';
        }
    }
    // Reviews are loaded separately

    // --- Related Products ---
    fetchRelatedProducts(productData.category, productData.productId); // Use actual product ID if available

    // --- Update Schema.org JSON-LD ---
    updateProductSchema(productData);

    // --- Initialize UI elements ---
    setupTabs();
    setupQuantityButtons(); // For standard products
    setupFlexInputListeners(); // For flex banners
    setupWeddingQuantityListener(); // For wedding cards
    setupSocialSharing(); // Setup share buttons
    fetchReviews(); // Fetch and display reviews

    showLoading(false); // Hide loading indicator once done
}

// Function to populate wedding quantity dropdown
function populateWeddingQuantities(quantities) {
    const selectEl = document.getElementById('wedding-quantity-select');
    if (!selectEl || !quantities || !Array.isArray(quantities)) {
         console.warn("Wedding quantity dropdown or quantities data missing/invalid.");
         if (selectEl) selectEl.innerHTML = '<option value="">Quantities not available</option>';
        return;
    }

    selectEl.innerHTML = '<option value="">Select Quantity</option>'; // Default option
    quantities.forEach(qty => {
        if (typeof qty === 'number' && qty > 0) {
            const option = document.createElement('option');
            option.value = qty;
            option.textContent = qty;
            selectEl.appendChild(option);
        }
    });
}

// --- Event Listeners Setup ---

// Setup Tabs Functionality
function setupTabs() {
    if (!tabsContainer || !tabContentsContainer) return;

    const tabs = tabsContainer.querySelectorAll('.tab-link');
    const contents = tabContentsContainer.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', (event) => {
            event.preventDefault();
            const targetId = tab.getAttribute('href').substring(1); // Get ID like 'description-content'

            // Deactivate all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            // Activate clicked tab and corresponding content
            tab.classList.add('active');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });

    // Activate the first tab by default if none are active
    if (!tabsContainer.querySelector('.active')) {
        if (tabs[0]) tabs[0].classList.add('active');
        if (contents[0]) contents[0].classList.add('active');
    }
}

// Setup Standard Quantity Buttons Functionality
function setupQuantityButtons() {
    if (quantityInput && quantityIncreaseBtn && quantityDecreaseBtn) {
        quantityIncreaseBtn.addEventListener('click', () => {
            let currentValue = parseInt(quantityInput.value, 10);
            if (isNaN(currentValue)) currentValue = 1;
            quantityInput.value = currentValue + 1;
        });

        quantityDecreaseBtn.addEventListener('click', () => {
            let currentValue = parseInt(quantityInput.value, 10);
            if (isNaN(currentValue)) currentValue = 1;
            if (currentValue > 1) {
                quantityInput.value = currentValue - 1;
            }
        });
    }
}

// Setup Flex Input Listeners for Price Calculation
function setupFlexInputListeners() {
    const widthInput = document.getElementById('flex-width');
    const heightInput = document.getElementById('flex-height');
    const unitSelect = document.getElementById('flex-unit');
    const quantityInput = document.getElementById('flex-quantity'); // Quantity of banners
    const flexPriceDisplay = document.getElementById('flex-calculated-price'); // Specific element for flex price

    const calculateAndUpdateFlexPrice = () => {
        if (!currentProductData || !currentProductData.pricing || !flexPriceDisplay) return;

        const width = parseFloat(widthInput?.value || 0);
        const height = parseFloat(heightInput?.value || 0);
        const unit = unitSelect?.value || 'feet';
        const quantity = parseInt(quantityInput?.value || 1, 10);
        const ratePerSqFt = parseFloat(currentProductData.pricing.rate || 0); // Rate per sq ft
        const minimumOrderValue = parseFloat(currentProductData.pricing.minimumOrderValue || 0);
        const mediaWidths = currentProductData.pricing.mediaWidths || [3, 4, 5, 6, 8, 10]; // Get from Firestore or default

        if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0 || isNaN(quantity) || quantity <= 0 || isNaN(ratePerSqFt) || ratePerSqFt <= 0) {
            flexPriceDisplay.textContent = "Please enter valid dimensions and quantity.";
            flexPriceDisplay.style.display = 'block';
            return;
        }

        // Convert dimensions to feet if necessary
        const widthFt = unit === 'inches' ? width / 12 : width;
        const heightFt = unit === 'inches' ? height / 12 : height;

        // Calculate printable square footage using the utility function
        const { printSqFtPerBanner } = calculateFlexDimensions(widthFt, heightFt, mediaWidths);

        if (isNaN(printSqFtPerBanner) || printSqFtPerBanner <= 0) {
             flexPriceDisplay.textContent = "Could not calculate area.";
              flexPriceDisplay.style.display = 'block';
              return;
        }

        const totalPrintSqFt = printSqFtPerBanner * quantity;

        // Calculate cost based on total print area
        const calculatedCost = totalPrintSqFt * ratePerSqFt;

        // Apply minimum order value
        const finalCost = Math.max(calculatedCost, minimumOrderValue);

        // Display the calculated *total* price for the given quantity
        flexPriceDisplay.textContent = `Total Price: ${formatCurrency(finalCost)} (${printSqFtPerBanner.toFixed(2)} sqft/banner)`;
         flexPriceDisplay.style.display = 'block';
    };

    // Add listeners
    widthInput?.addEventListener('input', calculateAndUpdateFlexPrice);
    heightInput?.addEventListener('input', calculateAndUpdateFlexPrice);
    unitSelect?.addEventListener('change', calculateAndUpdateFlexPrice);
    quantityInput?.addEventListener('input', calculateAndUpdateFlexPrice);

    // Initial calculation if values are pre-filled (optional)
    // calculateAndUpdateFlexPrice();
}

// Setup Wedding Quantity Listener for Price Calculation
function setupWeddingQuantityListener() {
     const quantitySelect = document.getElementById('wedding-quantity-select');
     const weddingPriceDisplay = document.getElementById('wedding-calculated-price'); // Specific element

     const calculateAndUpdateWeddingPrice = () => {
         if (!currentProductData || !currentProductData.pricing || !quantitySelect || !weddingPriceDisplay) return;

         const selectedQuantity = parseInt(quantitySelect.value, 10);
         if (isNaN(selectedQuantity) || selectedQuantity <= 0) {
             weddingPriceDisplay.textContent = "Please select a quantity.";
              weddingPriceDisplay.style.display = 'block';
             return;
         }

         // Get pricing details from currentProductData
         const baseRate = parseFloat(currentProductData.pricing.rate || 0);
         const designCharge = parseFloat(currentProductData.pricing.designCharge || 0);
         const printingChargeBase = parseFloat(currentProductData.pricing.printingChargeBase || 0);
         const transportCharge = parseFloat(currentProductData.pricing.transportCharge || 0);
         const extraMarginPercent = parseFloat(currentProductData.pricing.extraMarginPercent || 0);

         // Validate required pricing fields
         if (isNaN(baseRate)) { // Only baseRate is strictly required for per-unit calculation part
              weddingPriceDisplay.textContent = "Pricing information incomplete.";
              weddingPriceDisplay.style.display = 'block';
              return;
         }

         // Calculate total amount for the selected quantity
         const subTotal = (baseRate * selectedQuantity) + designCharge + printingChargeBase + transportCharge;
         const finalAmount = subTotal * (1 + (extraMarginPercent / 100));

         // Calculate average price per unit for display purposes
         const averageUnitPrice = finalAmount / selectedQuantity;

         if (isNaN(finalAmount) || finalAmount <= 0 || isNaN(averageUnitPrice) || averageUnitPrice <= 0) {
              weddingPriceDisplay.textContent = "Could not calculate price.";
              weddingPriceDisplay.style.display = 'block';
               return;
         }

         // Display the total price and average price per unit
         weddingPriceDisplay.textContent = `Total: ${formatCurrency(finalAmount)} (${formatCurrency(averageUnitPrice)}/card)`;
         weddingPriceDisplay.style.display = 'block';
     };

     quantitySelect?.addEventListener('change', calculateAndUpdateWeddingPrice);
}

// --- Add to Cart Logic (UPDATED) ---
async function handleAddToCart() {
    if (!currentProductData || !currentProductId) {
        showFeedback(cartFeedbackEl, "Product data not loaded yet.", true);
        return;
    }

    // Clear previous feedback
    if (cartFeedbackEl) cartFeedbackEl.style.display = 'none';

    try {
        // --- Base Cart Options (Common to all types) ---
        let cartOptions = {
            name: currentProductData.productName || 'Unnamed Product',
            imageUrl: mainImageEl ? mainImageEl.src : (currentProductData.thumbnailUrl || 'img/placeholder.png')
            // Add any other common options here if needed later
        };

        let itemToAdd = { productId: currentProductId, quantity: 1 }; // Default quantity
        const category = currentProductData.category?.toLowerCase() || '';
        const pricing = currentProductData.pricing;

        // --- Category-Specific Logic ---
        if (category.includes('wedding')) {
            const quantityDropdown = document.getElementById('wedding-quantity-select');
            if (!quantityDropdown || !quantityDropdown.value) {
                showFeedback(cartFeedbackEl, "Please select a wedding card quantity.", true); return;
            }
            const selectedQuantity = parseInt(quantityDropdown.value, 10);

            if (isNaN(selectedQuantity) || selectedQuantity <= 0) {
                 showFeedback(cartFeedbackEl, "Invalid quantity selected.", true); return;
            }

            // Get pricing details
            const baseRate = parseFloat(pricing?.rate || 0);
            const designCharge = parseFloat(pricing?.designCharge || 0);
            const printingChargeBase = parseFloat(pricing?.printingChargeBase || 0);
            const transportCharge = parseFloat(pricing?.transportCharge || 0);
            const extraMarginPercent = parseFloat(pricing?.extraMarginPercent || 0);

            // Calculate Total Amount
            const subTotal = (baseRate * selectedQuantity) + designCharge + printingChargeBase + transportCharge;
            const finalAmount = subTotal * (1 + (extraMarginPercent / 100));

            // *** Calculate Average Unit Price for Cart ***
            const averageUnitPrice = finalAmount / selectedQuantity;

            // Validate calculated price
             if (isNaN(averageUnitPrice) || averageUnitPrice <= 0) {
                  console.error("Wedding Card price calculation resulted in invalid average price:", averageUnitPrice, "Final Amount:", finalAmount, "Quantity:", selectedQuantity);
                  showFeedback(cartFeedbackEl, "Could not calculate a valid price for this quantity.", true);
                  return;
             }

            // Update item details and cart options
            itemToAdd.quantity = selectedQuantity;
            cartOptions = {
                 ...cartOptions, // Preserve base options (name, image)
                type: 'Wedding Card',
                price: averageUnitPrice // <<<--- Send AVERAGE UNIT PRICE to cart
            };

        } else if (category.includes('flex')) {
            const widthInput = document.getElementById('flex-width');
            const heightInput = document.getElementById('flex-height');
            const unitSelect = document.getElementById('flex-unit');
            const quantityInput = document.getElementById('flex-quantity'); // Quantity of banners

            const width = parseFloat(widthInput?.value || 0);
            const height = parseFloat(heightInput?.value || 0);
            const unit = unitSelect?.value || 'feet';
            const quantity = parseInt(quantityInput?.value || 1, 10); // Quantity of banners

             if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0 || isNaN(quantity) || quantity <= 0) {
                showFeedback(cartFeedbackEl, "Please enter valid dimensions and quantity for the banner.", true); return;
            }

            const ratePerSqFt = parseFloat(pricing?.rate || 0);
            const minimumOrderValue = parseFloat(pricing?.minimumOrderValue || 0);
            const mediaWidths = pricing?.mediaWidths || [3, 4, 5, 6, 8, 10];

             if (isNaN(ratePerSqFt) || ratePerSqFt <= 0) {
                  showFeedback(cartFeedbackEl, "Flex pricing information is missing.", true); return;
             }

            // Convert dimensions to feet
            const widthFt = unit === 'inches' ? width / 12 : width;
            const heightFt = unit === 'inches' ? height / 12 : height;

            // Calculate printable square footage
            const { printSqFtPerBanner } = calculateFlexDimensions(widthFt, heightFt, mediaWidths);

             if (isNaN(printSqFtPerBanner) || printSqFtPerBanner <= 0) {
                 showFeedback(cartFeedbackEl, "Could not calculate printable area.", true); return;
            }

            // Calculate total cost for all banners
            const totalPrintSqFt = printSqFtPerBanner * quantity;
            const calculatedCost = totalPrintSqFt * ratePerSqFt;
            const finalCost = Math.max(calculatedCost, minimumOrderValue); // Apply min order value

            // *** Calculate Price Per Banner for Cart ***
            const pricePerBanner = finalCost / quantity;

             // Validate calculated price per banner
             if (isNaN(pricePerBanner) || pricePerBanner <= 0) {
                  console.error("Flex Banner price calculation resulted in invalid price per banner:", pricePerBanner, "Final Cost:", finalCost, "Quantity:", quantity);
                  showFeedback(cartFeedbackEl, "Could not calculate a valid price per banner.", true);
                  return;
             }

            // Update item details and cart options
             itemToAdd.quantity = quantity; // Number of banners
             cartOptions = {
                 ...cartOptions, // Preserve base options
                 type: 'Flex Banner',
                 sqFtInfo: `(${widthFt.toFixed(2)}' x ${heightFt.toFixed(2)}' = ${printSqFtPerBanner.toFixed(2)} sqft/banner)`, // Example details
                 price: pricePerBanner // <<<--- Send PRICE PER BANNER to cart
             };

        } else { // Standard Product
            const quantitySelected = parseInt(quantityInput?.value || 1, 10);
             if (isNaN(quantitySelected) || quantitySelected <= 0) {
                 showFeedback(cartFeedbackEl, "Please enter a valid quantity.", true); return;
             }

            const standardPrice = parseFloat(pricing?.rate || 0);
             if (isNaN(standardPrice) || standardPrice <= 0) {
                 showFeedback(cartFeedbackEl, "Product price is not available.", true); return;
             }

             // Update item details and cart options
            itemToAdd.quantity = quantitySelected;
            cartOptions = {
                 ...cartOptions, // Preserve base options
                 type: 'Standard', // Or use productData.category
                 price: standardPrice // <<<--- Send standard UNIT PRICE to cart
             };
        }

        // --- Final Price Validation (Before Adding to Cart) ---
         if (typeof cartOptions.price !== 'number' || isNaN(cartOptions.price) || cartOptions.price <= 0) {
              console.error("Invalid price determined before calling addToCart:", cartOptions.price, "Product ID:", itemToAdd.productId);
              showFeedback(cartFeedbackEl, "Could not determine a valid price for this item. Cannot add to cart.", true);
              return;
         }


        // --- Add To Cart Call ---
         console.log("Adding to cart:", itemToAdd.productId, itemToAdd.quantity, cartOptions); // Log what's being added
         addToCart(itemToAdd.productId, itemToAdd.quantity, cartOptions);

         showFeedback(cartFeedbackEl, "Product added to cart!", false);

         // Update cart count in header (ensure updateCartCount is imported and working)
         if (typeof updateCartCount === 'function') {
             updateCartCount();
         } else {
             console.warn("updateCartCount function not available.");
             // Optional: Implement a fallback or log this issue
         }

     } catch (error) {
         console.error("Error adding product to cart:", error);
         showFeedback(cartFeedbackEl, `Failed to add product to cart. ${error.message || 'Unknown error'}`, true);
     }
}


// --- Reviews Logic ---

// Fetch and display reviews
async function fetchReviews() {
    if (!currentProductId || !reviewList) return;
    reviewList.innerHTML = '<li>Loading reviews...</li>'; // Show loading state

    try {
        const reviewsRef = collection(db, 'products', currentProductId, 'reviews');
        const q = query(reviewsRef, orderBy('createdAt', 'desc'), limit(10)); // Get latest 10 reviews
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            reviewList.innerHTML = '<li>Be the first to review this product!</li>';
            return;
        }

        let reviewsHtml = '';
        querySnapshot.forEach((doc) => {
            const review = doc.data();
            const ratingStars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
            const reviewDate = review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString() : 'Unknown date';
            reviewsHtml += `
                <li>
                    <div class="review-header">
                        <strong>${review.userName || 'Anonymous'}</strong> - ${reviewDate}
                    </div>
                    <div class="review-rating">${ratingStars}</div>
                    <p>${review.comment || ''}</p>
                </li>
            `;
        });
        reviewList.innerHTML = reviewsHtml;

    } catch (error) {
        console.error("Error fetching reviews:", error);
        reviewList.innerHTML = '<li>Could not load reviews at this time.</li>';
    }
}

// Handle review form submission
async function handleReviewSubmit(event) {
    event.preventDefault();
    if (!currentProductId || !reviewForm) return;

    const submitButton = reviewForm.querySelector('button[type="submit"]');
    const feedbackEl = document.getElementById('review-feedback'); // Specific feedback element for reviews

    // Basic validation
    const rating = parseInt(reviewForm.rating.value, 10);
    const comment = reviewForm.comment.value.trim();
    const userName = reviewForm.userName.value.trim() || 'Anonymous'; // Optional name

    if (isNaN(rating) || rating < 1 || rating > 5) {
        showFeedback(feedbackEl, "Please select a rating between 1 and 5.", true);
        return;
    }
    if (!comment) {
        showFeedback(feedbackEl, "Please enter your review comment.", true);
        return;
    }

    // Disable button during submission
    submitButton.disabled = true;
    showFeedback(feedbackEl, "Submitting review...", false);

    try {
        const reviewsRef = collection(db, 'products', currentProductId, 'reviews');
        await addDoc(reviewsRef, {
            rating: rating,
            comment: comment,
            userName: userName,
            createdAt: serverTimestamp() // Use server timestamp
        });

        showFeedback(feedbackEl, "Review submitted successfully!", false);
        reviewForm.reset(); // Clear the form
        fetchReviews(); // Refresh the review list

    } catch (error) {
        console.error("Error submitting review:", error);
        showFeedback(feedbackEl, "Failed to submit review. Please try again.", true);
    } finally {
        submitButton.disabled = false; // Re-enable button
    }
}


// --- Related Products Logic ---

async function fetchRelatedProducts(category, currentProdId) {
    if (!relatedProductsContainer || !category) return;

    if (relatedLoadingIndicator) relatedLoadingIndicator.style.display = 'block';
    relatedProductsContainer.innerHTML = ''; // Clear previous related products

    try {
        const productsRef = collection(db, 'products');
        // Query for products in the same category, excluding the current one, limit results
        const q = query(
            productsRef,
            where('category', '==', category),
            where('productId', '!=', currentProdId || ''), // Exclude current product using its ID field
            limit(6) // Limit number of related products
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
             relatedProductsContainer.innerHTML = '<p>No related products found.</p>';
        } else {
            let productsHtml = '';
            querySnapshot.forEach((doc) => {
                const product = doc.data();
                const productPrice = product.pricing?.rate ? formatCurrency(product.pricing.rate) : 'N/A';
                 // Use product.productId if it exists, otherwise doc.id as fallback
                 const productId = product.productId || doc.id;
                 productsHtml += `
                    <div class="related-product-item">
                        <a href="product-detail.html?id=${productId}">
                            <img src="${product.thumbnailUrl || product.imageUrl || 'img/placeholder.png'}" alt="${product.productName}">
                            <h3>${product.productName}</h3>
                            <p class="related-price">${productPrice}</p>
                        </a>
                    </div>
                `;
            });
             relatedProductsContainer.innerHTML = productsHtml;
             // Basic Slider Initialization (Optional, needs CSS)
             // setupBasicSlider(relatedProductsContainer); // Implement this if needed
        }

    } catch (error) {
        console.error("Error fetching related products:", error);
        relatedProductsContainer.innerHTML = '<p>Could not load related products.</p>';
    } finally {
        if (relatedLoadingIndicator) relatedLoadingIndicator.style.display = 'none';
    }
}


// --- Schema.org JSON-LD Update ---

function updateProductSchema(productData) {
    const schemaScript = document.getElementById('product-schema');
    if (!schemaScript || !productData) return;

    const schema = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": productData.productName || "Unnamed Product",
        "image": productData.imageUrl || "",
        "description": productData.shortDescription || productData.description || "No description available.", // Prefer short description
        "sku": productData.sku || productData.productId || currentProductId, // Use SKU if available, else ID
        "brand": {
            "@type": "Brand",
            "name": productData.brand || "Madhav Multiprint" // Use brand if available, else default
        },
        // Add offers only if price is available
        ...(productData.pricing?.rate && {
            "offers": {
                "@type": "Offer",
                "url": window.location.href, // URL of the product page
                "priceCurrency": "INR", // Or your currency code
                "price": productData.pricing.rate.toFixed(2),
                "availability": "https://schema.org/InStock", // Or other availability status
                "itemCondition": "https://schema.org/NewCondition"
            }
        })
        // AggregateRating can be added here if you calculate average rating
        // "aggregateRating": {
        //     "@type": "AggregateRating",
        //     "ratingValue": "4.5", // Example average rating
        //     "reviewCount": "15" // Example review count
        // }
    };

    schemaScript.textContent = JSON.stringify(schema);
}

// --- Social Sharing Logic ---
function setupSocialSharing() {
    const socialShareLinks = document.querySelectorAll('.social-share a'); // Target links inside the container

     if (socialShareLinks.length > 0) {
         socialShareLinks.forEach(link => {
             link.addEventListener('click', (event) => {
                 event.preventDefault();
                 if (!currentProductData?.productName) return; // Need product name

                 const pageUrl = window.location.href;
                 const productName = encodeURIComponent(currentProductData.productName);
                 let shareUrl = '';
                 const network = link.getAttribute('aria-label')?.toLowerCase() || ''; // Get network from aria-label

                 if (network.includes('facebook')) {
                     shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
                 } else if (network.includes('twitter')) {
                     shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${productName}`;
                 } else if (network.includes('whatsapp')) {
                     shareUrl = `https://api.whatsapp.com/send?text=${productName}%20${encodeURIComponent(pageUrl)}`;
                 }
                 // Add more networks like Pinterest, LinkedIn if needed

                 if (shareUrl) {
                     // Open in a new, smaller window
                     window.open(shareUrl, '_blank', 'width=600,height=400');
                 }
             });
         });
     }
}


// --- Initialize Page ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM fully loaded. Initializing product detail page...");

    const urlParams = new URLSearchParams(window.location.search);
    currentProductId = urlParams.get('id'); // Store globally

    if (!currentProductId) {
        showError("Product ID not found in URL.");
        return;
    }

    console.log(`Product ID found: ${currentProductId}. Fetching data...`);
    showLoading(true);

    try {
        const productRef = doc(db, 'products', currentProductId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
            console.log("Product data fetched successfully.");
            const productData = { ...productSnap.data(), productId: productSnap.id }; // Include Firestore doc ID
             // Ensure pricing exists, create if not
             if (!productData.pricing) {
                 productData.pricing = {}; // Create an empty pricing object if it's missing
                 console.warn(`Product ${currentProductId} missing 'pricing' object. Created empty one.`);
             }

            renderProductDetails(productData);
            // Add event listener for the Add to Cart button AFTER rendering product details
            if (addToCartBtn) {
                addToCartBtn.addEventListener('click', handleAddToCart);
            } else {
                console.error("Add to Cart button not found!");
            }
             // Add event listener for review form submission
             if (reviewForm) {
                 reviewForm.addEventListener('submit', handleReviewSubmit);
             }

        } else {
            console.error(`No product found with ID: ${currentProductId}`);
            showError(`Product not found. It might have been removed or the ID is incorrect.`);
        }
    } catch (error) {
        console.error("Error fetching product details:", error);
        showError(`Failed to load product details. Please check the console for more information or try again later. Error: ${error.message}`);
    }
}); // End DOMContentLoaded