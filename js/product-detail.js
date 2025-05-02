// js/product-detail.js
// FINAL UPDATED Version: Includes Tabs, Quantity Buttons, New Price Layout, Related Products Slider, Schema Update, Review Logic, Social Sharing, and Error Checks
// Corrected Price Calculation for Wedding Cards & Flex Banners + Image in Cart
// Includes fix for potential SyntaxError around social sharing

// --- Imports ---\
import { db } from './firebase-config.js';
// Import necessary Firestore functions
import {
    doc, getDoc, collection, query, where, limit, getDocs, addDoc, serverTimestamp, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { addToCart } from './cart.js';
// Ensure updateCartCount is exported from main.js or handle it appropriately
// If main.js doesn't export it reliably, consider adding a fallback or direct update mechanism here.
import { updateCartCount } from './main.js'; // Make sure this import works

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
const flexPriceDisplay = document.getElementById('flex-calculated-price'); // Specific element for flex price
const weddingPriceDisplay = document.getElementById('wedding-calculated-price'); // Specific element for wedding price

// --- Global Variables ---\
let currentProductData = null;
let currentProductId = null;

// --- Utility Functions ---\

// Function to display loading state
function showLoading(isLoading) {
    if (loadingIndicator) loadingIndicator.style.display = isLoading ? 'block' : 'none';
    // Hide/show content area as well to prevent showing stale data while loading
    if (productContent) productContent.style.display = isLoading ? 'none' : 'block';
    if (isLoading && errorMessageContainer) errorMessageContainer.style.display = 'none'; // Hide errors when starting to load
}

// Function to display error messages
function showError(message) {
    showLoading(false); // Ensure loading is hidden
    if (productContent) productContent.style.display = 'none'; // Hide the main content area on error
    if (errorMessageContainer) {
        errorMessageContainer.textContent = message;
        errorMessageContainer.style.display = 'block';
    }
    console.error("Product Detail Page Error:", message);
}

// Function to show feedback messages (e.g., for cart actions, reviews)
function showFeedback(element, message, isError = false) {
    if (!element) {
        console.warn("Feedback element not found for message:", message);
        return;
    }
    element.textContent = message;
    element.className = isError ? 'feedback error active' : 'feedback success active'; // Use classes for styling visibility
    element.style.display = 'block'; // Ensure it's visible

    // Hide message after 3 seconds
    setTimeout(() => {
        element.style.display = 'none';
        element.classList.remove('active');
    }, 3000);
}

// Format currency (ensure this matches your needs)
function formatCurrency(amount) {
    // Handle potential non-numeric input gracefully
    const numericAmount = Number(amount);
    if (isNaN(numericAmount)) {
        // console.warn("Invalid amount passed to formatCurrency:", amount);
        return 'N/A'; // Or return a default string like "₹ -.--"
    }
    // Use Intl.NumberFormat for better localization and formatting if needed
    // return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(numericAmount);
    return `₹${numericAmount.toFixed(2)}`; // Simple formatting
}

// --- Flex Banner Calculation Logic ---
/**
 * Calculates the printable square footage for a flex banner based on standard media widths.
 * Attempts to find the most efficient orientation (width x height or height x width) on available media.
 * @param {number} widthFt - Requested width in feet.
 * @param {number} heightFt - Requested height in feet.
 * @param {Array<number>} mediaWidthsFt - Array of available media widths in feet (e.g., [3, 4, 5, 6, 8, 10]). Sorted ascending.
 * @returns {{printSqFtPerBanner: number, actualWidthFt: number, actualHeightFt: number, error?: string}} - Object with calculated dimensions or error.
 */
function calculateFlexDimensions(widthFt, heightFt, mediaWidthsFt = [3, 4, 5, 6, 8, 10]) {
    // Validate inputs
    widthFt = Math.max(0, Number(widthFt));
    heightFt = Math.max(0, Number(heightFt));

    if (isNaN(widthFt) || isNaN(heightFt) || widthFt <= 0 || heightFt <= 0) {
        return { printSqFtPerBanner: 0, actualWidthFt: 0, actualHeightFt: 0, error: "Invalid dimensions provided." };
    }

    // Ensure media widths are sorted numerically
    const sortedMediaWidths = [...mediaWidthsFt].sort((a, b) => a - b);

    let bestSqFt = Infinity;

    // Try both orientations (width x height and height x width)
    const orientations = [
        { w: widthFt, h: heightFt }, // Original
        { w: heightFt, h: widthFt }  // Rotated
    ];

    for (const dim of orientations) {
        const currentW = dim.w;
        const currentH = dim.h;

        // Find the smallest media roll width that the banner's smaller dimension fits onto
        const smallerDim = Math.min(currentW, currentH);
        const largerDim = Math.max(currentW, currentH);

        let suitableMediaWidth = sortedMediaWidths.find(mediaW => mediaW >= smallerDim);

        if (suitableMediaWidth) {
            // Calculate the square footage used on this roll for this orientation
            const currentSqFt = largerDim * suitableMediaWidth;
            bestSqFt = Math.min(bestSqFt, currentSqFt); // Keep track of the minimum area needed
        }
        // If no suitable width found for this orientation's smaller dimension, this orientation is impossible on available rolls
    }

    // Check if a valid calculation was possible
    if (bestSqFt === Infinity) {
        console.warn(`Flex dimensions (${widthFt}x${heightFt}) might exceed largest media width in any orientation. Using raw area.`);
        // As a fallback, calculate raw area, but signal potential issue.
        // Or, you might decide to return an error here.
        bestSqFt = widthFt * heightFt; // Use raw area as fallback if > 0
        if (bestSqFt <= 0) {
             return { printSqFtPerBanner: 0, actualWidthFt: widthFt, actualHeightFt: heightFt, error: "Dimensions result in zero area." };
        }
         // Optionally add an error/warning message to the result object
         // return { printSqFtPerBanner: bestSqFt, actualWidthFt: widthFt, actualHeightFt: heightFt, warning: "Dimensions may exceed media limitations." };
    }

     if (bestSqFt <= 0) {
           return { printSqFtPerBanner: 0, actualWidthFt: widthFt, actualHeightFt: heightFt, error: "Calculated area is zero or negative." };
     }


    // console.log(`Flex Input: ${widthFt}x${heightFt}. Calculated Best SqFt Use: ${bestSqFt}.`);

    // Return the calculated minimum printable square footage needed per banner.
    return {
        printSqFtPerBanner: bestSqFt,
        actualWidthFt: widthFt, // Return original requested dimensions for reference
        actualHeightFt: heightFt
    };
}


// --- Product Data Rendering ---

// Function to populate product details on the page
function renderProductDetails(productData) {
    if (!productData) {
        showError("Failed to load product data (productData is null).");
        return;
    }

    currentProductData = productData; // Store globally

    // --- Basic Info ---
    if (breadcrumbProductName) breadcrumbProductName.textContent = productData.productName;
    if (productNameEl) productNameEl.textContent = productData.productName;

    // --- Images ---
    if (mainImageEl) {
        mainImageEl.src = productData.imageUrl || 'img/placeholder.png';
        mainImageEl.alt = productData.productName || 'Product Image';
    }
    if (thumbnailImagesContainer) {
        thumbnailImagesContainer.innerHTML = ''; // Clear existing
        const imageUrls = [productData.imageUrl, ...(productData.additionalImages || [])].filter(Boolean);
        if (imageUrls.length > 1) {
            thumbnailImagesContainer.style.display = 'flex'; // Or 'block' based on your CSS
            imageUrls.forEach((url, index) => {
                const img = document.createElement('img');
                img.src = url;
                img.alt = `${productData.productName || 'Product'} - Thumbnail ${index + 1}`;
                img.addEventListener('click', () => {
                    if (mainImageEl) mainImageEl.src = url;
                    thumbnailImagesContainer.querySelectorAll('img').forEach(thumb => thumb.classList.remove('active'));
                    img.classList.add('active');
                });
                thumbnailImagesContainer.appendChild(img);
            });
            if (thumbnailImagesContainer.firstChild) thumbnailImagesContainer.firstChild.classList.add('active');
        } else {
            thumbnailImagesContainer.style.display = 'none'; // Hide if only one image
        }
    }

    // --- Pricing and Options Logic ---
    // Reset visibility states first
    document.getElementById('standard-price-section')?.style.display = 'none';
    document.getElementById('standard-quantity-section')?.style.display = 'none';
    if (flexOptionsContainer) flexOptionsContainer.style.display = 'none';
    if (weddingOptionsContainer) weddingOptionsContainer.style.display = 'none';
    if (flexPriceDisplay) flexPriceDisplay.style.display = 'none';
    if (weddingPriceDisplay) weddingPriceDisplay.style.display = 'none';
    if (priceEl) priceEl.textContent = '';
    if (originalPriceEl) originalPriceEl.style.display = 'none';


    const category = productData.category?.toLowerCase() || '';
    const pricing = productData.pricing; // Ensure pricing object exists

    if (!pricing) {
         console.warn(`Product ${currentProductId} has no pricing information.`);
         // Display a general message if appropriate
         if(priceEl) priceEl.textContent = "Price not available";
         document.getElementById('standard-price-section')?.style.display = 'block'; // Show price section with message
         // Disable add to cart?
         if (addToCartBtn) addToCartBtn.disabled = true;

    } else if (category.includes('flex')) {
        if (flexOptionsContainer) flexOptionsContainer.style.display = 'block';
        if (flexPriceDisplay) flexPriceDisplay.style.display = 'block'; // Show calculated price area
        // Price calculation is triggered by input listeners

    } else if (category.includes('wedding')) {
        if (weddingOptionsContainer) weddingOptionsContainer.style.display = 'block';
        if (weddingPriceDisplay) weddingPriceDisplay.style.display = 'block'; // Show calculated price area
        populateWeddingQuantities(pricing.quantities); // Pass quantities array
        // Price calculation is triggered by dropdown listener

    } else { // Standard Product
        const priceSection = document.getElementById('standard-price-section');
        const quantitySection = document.getElementById('standard-quantity-section');
        if (priceSection) priceSection.style.display = 'block';
        if (quantitySection) quantitySection.style.display = 'block';

        if (typeof pricing.rate === 'number' && !isNaN(pricing.rate)) {
            if (priceEl) priceEl.textContent = formatCurrency(pricing.rate);
            if (typeof pricing.originalRate === 'number' && pricing.originalRate > pricing.rate) {
                if (originalPriceEl) {
                    originalPriceEl.textContent = formatCurrency(pricing.originalRate);
                    originalPriceEl.style.display = 'inline';
                }
            }
        } else {
             if (priceEl) priceEl.textContent = "Price not available";
              if (addToCartBtn) addToCartBtn.disabled = true; // Disable if no price
        }
    }

    // --- Tabs ---
    if (descriptionContent) descriptionContent.innerHTML = productData.description || 'No description available.';
    if (specificationsContent) {
        const specs = productData.specifications;
        if (specs && typeof specs === 'object' && Object.keys(specs).length > 0) {
            let specsHtml = '<ul>';
            for (const key in specs) {
                // Basic sanitation might be needed here if keys/values come from user input elsewhere
                specsHtml += `<li><strong>${String(key)}:</strong> ${String(specs[key])}</li>`;
            }
            specsHtml += '</ul>';
            specificationsContent.innerHTML = specsHtml;
        } else {
            specificationsContent.innerHTML = 'No specifications available.';
        }
    }
    // Reviews are loaded separately via fetchReviews()

    // --- Related Products ---
    fetchRelatedProducts(productData.category, currentProductId); // Pass current product ID

    // --- Update Schema.org JSON-LD ---
    updateProductSchema(productData);

    // --- Initialize UI elements (after data is loaded) ---
    setupTabs();
    setupQuantityButtons(); // For standard products (will only work if section is visible)
    setupFlexInputListeners(); // For flex banners (will only work if section is visible)
    setupWeddingQuantityListener(); // For wedding cards (will only work if section is visible)
    setupSocialSharing();
    fetchReviews();

    // Ensure add to cart button is enabled initially if price exists (might be disabled above if no price)
     if (addToCartBtn && pricing && (pricing.rate || category.includes('flex') || category.includes('wedding')) ) {
          addToCartBtn.disabled = false;
     }


    showLoading(false); // Hide loading indicator
}

// Function to populate wedding quantity dropdown
function populateWeddingQuantities(quantities) {
    const selectEl = document.getElementById('wedding-quantity-select');
    if (!selectEl) return; // Element not found

    // Clear previous options but keep the default prompt
    selectEl.innerHTML = '<option value="">Select Quantity</option>';

    if (!quantities || !Array.isArray(quantities) || quantities.length === 0) {
        console.warn("Wedding quantities data missing or invalid.");
        const option = document.createElement('option');
        option.textContent = "Quantities not available";
        option.disabled = true;
        selectEl.appendChild(option);
        return;
    }

    quantities.forEach(qty => {
        const numQty = Number(qty); // Ensure it's a number
        if (!isNaN(numQty) && numQty > 0) {
            const option = document.createElement('option');
            option.value = numQty;
            option.textContent = numQty;
            selectEl.appendChild(option);
        } else {
            console.warn("Invalid quantity value found in wedding quantities array:", qty);
        }
    });
}

// --- Event Listeners Setup ---

// Setup Tabs Functionality
function setupTabs() {
    if (!tabsContainer || !tabContentsContainer) return;
    const tabs = tabsContainer.querySelectorAll('.tab-link');
    const contents = tabContentsContainer.querySelectorAll('.tab-content');
    if (tabs.length === 0 || contents.length === 0) return; // No tabs/content found

    tabs.forEach(tab => {
        tab.addEventListener('click', (event) => {
            event.preventDefault();
            const targetId = tab.getAttribute('href')?.substring(1); // Use optional chaining
            if (!targetId) return;

            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });

    // Ensure first tab is active by default if none is marked active in HTML
    const activeTab = tabsContainer.querySelector('.tab-link.active');
    if (!activeTab && tabs.length > 0) {
        tabs[0].classList.add('active');
        const firstContentId = tabs[0].getAttribute('href')?.substring(1);
        if (firstContentId) {
             const firstContent = document.getElementById(firstContentId);
             if(firstContent) firstContent.classList.add('active');
        }
    } else if (activeTab) {
         // Ensure corresponding content is active if tab is pre-selected
         const targetId = activeTab.getAttribute('href')?.substring(1);
         if (targetId) {
              contents.forEach(c => c.classList.remove('active')); // Deactivate others first
              const targetContent = document.getElementById(targetId);
              if (targetContent) targetContent.classList.add('active');
         }
    }
}

// Setup Standard Quantity Buttons Functionality
function setupQuantityButtons() {
    if (quantityInput && quantityIncreaseBtn && quantityDecreaseBtn) {
        quantityIncreaseBtn.onclick = () => { // Use onclick for simplicity or replace previous listener
            let currentValue = parseInt(quantityInput.value, 10);
            quantityInput.value = isNaN(currentValue) ? 1 : currentValue + 1;
        };
        quantityDecreaseBtn.onclick = () => { // Use onclick for simplicity
            let currentValue = parseInt(quantityInput.value, 10);
            if (!isNaN(currentValue) && currentValue > 1) {
                quantityInput.value = currentValue - 1;
            } else {
                 quantityInput.value = 1; // Reset to 1 if invalid or less than 1
            }
        };
    }
}

// Setup Flex Input Listeners for Price Calculation
function setupFlexInputListeners() {
    const widthInput = document.getElementById('flex-width');
    const heightInput = document.getElementById('flex-height');
    const unitSelect = document.getElementById('flex-unit');
    const quantityInput = document.getElementById('flex-quantity'); // Quantity of banners

    // Combine all relevant inputs into an array
    const inputsToListen = [widthInput, heightInput, unitSelect, quantityInput];

    // Check if all required elements exist
    if (!flexPriceDisplay || inputsToListen.some(el => !el)) {
        // console.warn("One or more Flex elements missing. Cannot setup listeners.");
        return;
    }

    const calculateAndUpdateFlexPrice = () => {
         // Check if current product is actually a flex banner before calculating
         if (!currentProductData || !currentProductData.category?.toLowerCase().includes('flex') || !currentProductData.pricing) {
              flexPriceDisplay.textContent = ""; // Clear price if not a flex product or no pricing
              flexPriceDisplay.style.display = 'none';
             return;
         }

        const width = parseFloat(widthInput.value);
        const height = parseFloat(heightInput.value);
        const unit = unitSelect.value;
        const quantity = parseInt(quantityInput.value, 10);
        const ratePerSqFt = parseFloat(currentProductData.pricing.rate);
        const minimumOrderValue = parseFloat(currentProductData.pricing.minimumOrderValue || 0); // Default min value to 0
        const mediaWidths = currentProductData.pricing.mediaWidths || [3, 4, 5, 6, 8, 10];

        // Basic validation for inputs
        if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0 || isNaN(quantity) || quantity <= 0) {
            flexPriceDisplay.textContent = "Enter valid dimensions & quantity.";
            flexPriceDisplay.style.display = 'block';
            return;
        }
        // Validate pricing data
         if (isNaN(ratePerSqFt) || ratePerSqFt <= 0) {
            flexPriceDisplay.textContent = "Pricing info unavailable.";
            flexPriceDisplay.style.display = 'block';
            return;
         }


        // Convert dimensions to feet
        const widthFt = unit === 'inches' ? width / 12 : width;
        const heightFt = unit === 'inches' ? height / 12 : height;

        // Calculate printable square footage
        const dimResult = calculateFlexDimensions(widthFt, heightFt, mediaWidths);

        if (dimResult.error || isNaN(dimResult.printSqFtPerBanner) || dimResult.printSqFtPerBanner <= 0) {
            flexPriceDisplay.textContent = dimResult.error || "Cannot calculate area.";
            flexPriceDisplay.style.display = 'block';
            return;
        }

        const printSqFtPerBanner = dimResult.printSqFtPerBanner;
        const totalPrintSqFt = printSqFtPerBanner * quantity;

        // Calculate cost
        const calculatedCost = totalPrintSqFt * ratePerSqFt;
        const finalCost = Math.max(calculatedCost, minimumOrderValue); // Apply min order value

        // Display the calculated total price
        flexPriceDisplay.textContent = `Total Price: ${formatCurrency(finalCost)} (${printSqFtPerBanner.toFixed(2)} sqft/banner)`;
        flexPriceDisplay.style.display = 'block';
    };

    // Add a single listener to each input
    inputsToListen.forEach(input => {
         // Use 'input' for text/number fields, 'change' for select dropdown
         const eventType = (input.tagName === 'SELECT') ? 'change' : 'input';
         input.removeEventListener(eventType, calculateAndUpdateFlexPrice); // Remove previous listener if any
         input.addEventListener(eventType, calculateAndUpdateFlexPrice);
    });

    // Optional: Trigger initial calculation if inputs might have default values
    // calculateAndUpdateFlexPrice();
}

// Setup Wedding Quantity Listener for Price Calculation
function setupWeddingQuantityListener() {
     const quantitySelect = document.getElementById('wedding-quantity-select');
     if (!quantitySelect || !weddingPriceDisplay) {
          // console.warn("Wedding quantity select or price display element missing.");
          return;
     }

     const calculateAndUpdateWeddingPrice = () => {
         // Check if current product is actually a wedding card before calculating
         if (!currentProductData || !currentProductData.category?.toLowerCase().includes('wedding') || !currentProductData.pricing) {
             weddingPriceDisplay.textContent = ""; // Clear price
             weddingPriceDisplay.style.display = 'none';
             return;
         }

         const selectedQuantity = parseInt(quantitySelect.value, 10);

         // Handle the default "Select Quantity" option
         if (isNaN(selectedQuantity) || selectedQuantity <= 0) {
             weddingPriceDisplay.textContent = "Please select quantity.";
             weddingPriceDisplay.style.display = 'block';
             return;
         }

         // Get pricing details safely
         const pricing = currentProductData.pricing;
         const baseRate = parseFloat(pricing.rate);
         const designCharge = parseFloat(pricing.designCharge || 0);
         const printingChargeBase = parseFloat(pricing.printingChargeBase || 0);
         const transportCharge = parseFloat(pricing.transportCharge || 0);
         const extraMarginPercent = parseFloat(pricing.extraMarginPercent || 0);

         // Validate base rate is essential
         if (isNaN(baseRate)) {
             weddingPriceDisplay.textContent = "Base price info missing.";
             weddingPriceDisplay.style.display = 'block';
             return;
         }

         // Calculate total amount
         const subTotal = (baseRate * selectedQuantity) + designCharge + printingChargeBase + transportCharge;
         const finalAmount = subTotal * (1 + (extraMarginPercent / 100));

         // Calculate average price per unit
         const averageUnitPrice = finalAmount / selectedQuantity;

         // Final validation of calculated prices
         if (isNaN(finalAmount) || finalAmount < 0 || isNaN(averageUnitPrice) || averageUnitPrice < 0) {
             weddingPriceDisplay.textContent = "Error calculating price.";
             weddingPriceDisplay.style.display = 'block';
             return;
         }

         // Display the results
         weddingPriceDisplay.textContent = `Total: ${formatCurrency(finalAmount)} (${formatCurrency(averageUnitPrice)}/card)`;
         weddingPriceDisplay.style.display = 'block';
     };

     // Add listener (use change event for select dropdown)
     quantitySelect.removeEventListener('change', calculateAndUpdateWeddingPrice); // Remove previous if any
     quantitySelect.addEventListener('change', calculateAndUpdateWeddingPrice);

     // Optional: Trigger initial calculation if a default value might be selected
     // calculateAndUpdateWeddingPrice();
}

// --- Add to Cart Logic (UPDATED - Includes checks and correct price sending) ---
async function handleAddToCart() {
    // 1. Check if product data is loaded
    if (!currentProductData || !currentProductId) {
        showFeedback(cartFeedbackEl, "Product data not ready. Please wait.", true);
        return;
    }
    // 2. Check if pricing info exists (unless it's handled inside category checks)
     if (!currentProductData.pricing && !currentProductData.category?.toLowerCase().includes('flex') && !currentProductData.category?.toLowerCase().includes('wedding')) {
         // Allow flex/wedding to proceed as their price might be calculated dynamically
         // but block standard products without pricing.
          showFeedback(cartFeedbackEl, "Pricing information is missing for this product.", true);
          return;
     }


    // Clear previous feedback
    if (cartFeedbackEl) cartFeedbackEl.style.display = 'none';

    try {
        // --- Base Cart Options (Common to all types) ---
        let cartOptions = {
            name: currentProductData.productName || 'Unnamed Product',
            // Ensure mainImageEl exists and has a src, otherwise use thumbnail or placeholder
            imageUrl: mainImageEl?.src || currentProductData.thumbnailUrl || 'img/placeholder.png'
        };

        let itemToAdd = { productId: currentProductId, quantity: 1 }; // Default values
        const category = currentProductData.category?.toLowerCase() || '';
        const pricing = currentProductData.pricing || {}; // Use empty object if pricing is missing

        // --- Category-Specific Logic ---

        if (category.includes('wedding')) {
            const quantityDropdown = document.getElementById('wedding-quantity-select');
            const selectedQuantity = parseInt(quantityDropdown?.value, 10);

            if (!quantityDropdown || isNaN(selectedQuantity) || selectedQuantity <= 0) {
                showFeedback(cartFeedbackEl, "Please select a valid wedding card quantity.", true); return;
            }

            // Recalculate price to ensure consistency (avoids relying on display)
            const baseRate = parseFloat(pricing.rate);
            if (isNaN(baseRate)) { showFeedback(cartFeedbackEl, "Base price info missing.", true); return; }
            const designCharge = parseFloat(pricing.designCharge || 0);
            const printingChargeBase = parseFloat(pricing.printingChargeBase || 0);
            const transportCharge = parseFloat(pricing.transportCharge || 0);
            const extraMarginPercent = parseFloat(pricing.extraMarginPercent || 0);

            const subTotal = (baseRate * selectedQuantity) + designCharge + printingChargeBase + transportCharge;
            const finalAmount = subTotal * (1 + (extraMarginPercent / 100));
            const averageUnitPrice = finalAmount / selectedQuantity;

            if (isNaN(averageUnitPrice) || averageUnitPrice <= 0) {
                showFeedback(cartFeedbackEl, "Could not calculate valid price per card.", true); return;
            }

            itemToAdd.quantity = selectedQuantity;
            cartOptions = { ...cartOptions, type: 'Wedding Card', price: averageUnitPrice };

        } else if (category.includes('flex')) {
            const widthInput = document.getElementById('flex-width');
            const heightInput = document.getElementById('flex-height');
            const unitSelect = document.getElementById('flex-unit');
            const quantityInput = document.getElementById('flex-quantity');

            const width = parseFloat(widthInput?.value);
            const height = parseFloat(heightInput?.value);
            const unit = unitSelect?.value;
            const quantity = parseInt(quantityInput?.value, 10); // Quantity of banners

            if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0 || isNaN(quantity) || quantity <= 0) {
                showFeedback(cartFeedbackEl, "Enter valid flex dimensions & quantity.", true); return;
            }

            const ratePerSqFt = parseFloat(pricing.rate);
            if (isNaN(ratePerSqFt) || ratePerSqFt <= 0) { showFeedback(cartFeedbackEl, "Flex price info missing.", true); return; }
            const minimumOrderValue = parseFloat(pricing.minimumOrderValue || 0);
            const mediaWidths = pricing.mediaWidths || [3, 4, 5, 6, 8, 10];

            const widthFt = unit === 'inches' ? width / 12 : width;
            const heightFt = unit === 'inches' ? height / 12 : height;

            const dimResult = calculateFlexDimensions(widthFt, heightFt, mediaWidths);
            if (dimResult.error || isNaN(dimResult.printSqFtPerBanner) || dimResult.printSqFtPerBanner <= 0) {
                 showFeedback(cartFeedbackEl, dimResult.error || "Cannot calculate flex area.", true); return;
            }
            const printSqFtPerBanner = dimResult.printSqFtPerBanner;

            // Recalculate total cost and price per banner
            const totalPrintSqFt = printSqFtPerBanner * quantity;
            const calculatedCost = totalPrintSqFt * ratePerSqFt;
            const finalCost = Math.max(calculatedCost, minimumOrderValue);
            const pricePerBanner = finalCost / quantity;

            if (isNaN(pricePerBanner) || pricePerBanner <= 0) {
                showFeedback(cartFeedbackEl, "Could not calculate valid price per banner.", true); return;
            }

            itemToAdd.quantity = quantity; // Number of banners
            cartOptions = {
                ...cartOptions,
                type: 'Flex Banner',
                sqFtInfo: `(${widthFt.toFixed(2)}'x${heightFt.toFixed(2)}'=${printSqFtPerBanner.toFixed(2)}sqft/ea)`, // Example detail
                price: pricePerBanner
            };

        } else { // Standard Product
            const quantitySelected = parseInt(quantityInput?.value || 1, 10);
            if (isNaN(quantitySelected) || quantitySelected <= 0) {
                showFeedback(cartFeedbackEl, "Please enter a valid quantity.", true); return;
            }

            const standardPrice = parseFloat(pricing?.rate); // Use optional chaining
            if (isNaN(standardPrice) || standardPrice <= 0) {
                showFeedback(cartFeedbackEl, "Product price is not available.", true); return;
            }

            itemToAdd.quantity = quantitySelected;
            cartOptions = { ...cartOptions, type: 'Standard', price: standardPrice };
        }

        // --- Final Price Validation (Universal) ---
        if (typeof cartOptions.price !== 'number' || isNaN(cartOptions.price) || cartOptions.price < 0) { // Allow 0 price? Decide policy. Usually > 0.
            console.error("Invalid final price determined before addToCart:", cartOptions.price, "Data:", itemToAdd, cartOptions);
            showFeedback(cartFeedbackEl, "Could not determine a valid price. Item not added.", true);
            return;
        }


        // --- Add To Cart Call ---
        console.log("Adding to cart:", itemToAdd.productId, "Qty:", itemToAdd.quantity, "Options:", cartOptions);
        addToCart(itemToAdd.productId, itemToAdd.quantity, cartOptions);

        showFeedback(cartFeedbackEl, "Product added to cart!", false);

        // Update cart count in header
        if (typeof updateCartCount === 'function') {
            updateCartCount();
        } else {
            console.warn("updateCartCount function is not available or not imported correctly.");
            // Maybe add a manual event dispatch if updateCartCount is unreliable
            // document.dispatchEvent(new CustomEvent('cartUpdated')); // cart.js should dispatch this anyway
        }

    } catch (error) {
        console.error("Error in handleAddToCart:", error);
        showFeedback(cartFeedbackEl, `Failed to add product. ${error.message || 'Unknown error'}`, true);
    }
}


// --- Reviews Logic ---

// Fetch and display reviews
async function fetchReviews() {
    if (!currentProductId || !reviewList) return;
    reviewList.innerHTML = '<li>Loading reviews...</li>';

    try {
        const reviewsRef = collection(db, 'products', currentProductId, 'reviews');
        const q = query(reviewsRef, orderBy('createdAt', 'desc'), limit(10));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            reviewList.innerHTML = '<li>Be the first to review this product!</li>';
            return;
        }

        let reviewsHtml = '';
        querySnapshot.forEach((doc) => {
            const review = doc.data();
            // Basic XSS prevention (replace < and >) - consider a library for robust sanitization if needed
            const safeComment = review.comment?.replace(/</g, "&lt;").replace(/>/g, "&gt;") || '';
            const safeUserName = review.userName?.replace(/</g, "&lt;").replace(/>/g, "&gt;") || 'Anonymous';
            const rating = Number(review.rating) || 0; // Ensure rating is a number
            const ratingStars = '★'.repeat(Math.max(0, Math.min(5, Math.round(rating)))) + '☆'.repeat(Math.max(0, 5 - Math.round(rating)));
            const reviewDate = review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString() : 'Unknown date';

            reviewsHtml += `
                <li>
                    <div class="review-header">
                        <strong>${safeUserName}</strong> - <span class="review-date">${reviewDate}</span>
                    </div>
                    <div class="review-rating">${ratingStars}</div>
                    <p class="review-comment">${safeComment}</p>
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
    const feedbackEl = document.getElementById('review-feedback');

    // Basic validation
    const rating = parseInt(reviewForm.rating?.value, 10);
    const comment = reviewForm.comment?.value.trim();
    const userName = reviewForm.userName?.value.trim(); // Keep it simple, allow empty

    // Ensure feedbackEl exists before using
    const showReviewFeedback = (msg, isErr) => feedbackEl ? showFeedback(feedbackEl, msg, isErr) : console.warn("Review feedback element missing");


    if (isNaN(rating) || rating < 1 || rating > 5) {
        showReviewFeedback("Please select a rating (1-5 stars).", true); return;
    }
    if (!comment) {
        showReviewFeedback("Please enter your review comment.", true); return;
    }

    // Disable button and show loading feedback
    if(submitButton) submitButton.disabled = true;
    showReviewFeedback("Submitting review...", false);

    try {
        const reviewsRef = collection(db, 'products', currentProductId, 'reviews');
        await addDoc(reviewsRef, {
            rating: rating,
            comment: comment,
            userName: userName || 'Anonymous', // Default to Anonymous if empty
            createdAt: serverTimestamp()
        });

        showReviewFeedback("Review submitted successfully!", false);
        reviewForm.reset();
        fetchReviews(); // Refresh the review list

    } catch (error) {
        console.error("Error submitting review:", error);
        showReviewFeedback("Failed to submit review. Please try again.", true);
    } finally {
         if(submitButton) submitButton.disabled = false; // Re-enable button
    }
}


// --- Related Products Logic ---

async function fetchRelatedProducts(category, currentProdId) {
    if (!relatedProductsContainer || !category || !currentProdId) {
        // Hide section or show placeholder if essential info is missing
         if(relatedLoadingIndicator) relatedLoadingIndicator.style.display = 'none';
         if(relatedProductsContainer) relatedProductsContainer.innerHTML = ''; // Clear it
        return;
    }

    if (relatedLoadingIndicator) relatedLoadingIndicator.style.display = 'block';
    relatedProductsContainer.innerHTML = ''; // Clear previous

    try {
        const productsRef = collection(db, 'products');
        const q = query(
            productsRef,
            where('category', '==', category),
            where('productId', '!=', currentProdId), // Use the actual unique product ID field
            limit(6)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            relatedProductsContainer.innerHTML = '<p>No related products found in this category.</p>';
        } else {
            let productsHtml = '';
            querySnapshot.forEach((doc) => {
                const product = doc.data();
                 // Ensure required fields exist before creating HTML
                 const pId = product.productId || doc.id; // Use field or doc ID
                 const pName = product.productName || 'Unnamed Product';
                 const pImageUrl = product.thumbnailUrl || product.imageUrl || 'img/placeholder.png';
                 const pPrice = (product.pricing && typeof product.pricing.rate === 'number')
                                ? formatCurrency(product.pricing.rate)
                                : 'N/A';

                 productsHtml += `
                    <div class="related-product-item">
                        <a href="product-detail.html?id=${pId}">
                            <img src="${pImageUrl}" alt="${pName}" loading="lazy">
                            <h3>${pName}</h3>
                            <p class="related-price">${pPrice}</p>
                        </a>
                    </div>
                `;
            });
            relatedProductsContainer.innerHTML = productsHtml;
             // Optional: Initialize a slider if needed for related products
        }

    } catch (error) {
        console.error("Error fetching related products:", error);
        relatedProductsContainer.innerHTML = '<p>Could not load related products due to an error.</p>';
    } finally {
        if (relatedLoadingIndicator) relatedLoadingIndicator.style.display = 'none';
    }
}


// --- Schema.org JSON-LD Update ---

function updateProductSchema(productData) {
    const schemaScript = document.getElementById('product-schema');
    if (!schemaScript || !productData) return;

    const priceInfo = productData.pricing;
    let offerDetails = null;

    // Create offer only if there's a valid price (rate)
    if (priceInfo && typeof priceInfo.rate === 'number' && !isNaN(priceInfo.rate) && priceInfo.rate >= 0) {
        offerDetails = {
            "@type": "Offer",
            "url": window.location.href,
            "priceCurrency": "INR", // Adjust if needed
            "price": priceInfo.rate.toFixed(2),
            // Determine availability based on stock status if available, otherwise assume InStock
            "availability": (productData.stockStatus === 'OutOfStock') ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
            "itemCondition": "https://schema.org/NewCondition"
        };
        // Add original price if applicable (for Sale price indication)
        if (typeof priceInfo.originalRate === 'number' && priceInfo.originalRate > priceInfo.rate) {
            // Schema.org doesn't have a direct 'originalPrice' field in Offer,
            // but indicating a sale price often relies on context or specific offer types.
            // For simplicity, we include the sale price. You could use PriceSpecification for more detail.
        }
    }


    const schema = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": productData.productName || "Unnamed Product",
        "image": productData.imageUrl || "",
        // Use description or a shorter version if available
        "description": productData.description || "No description available.",
        // Use SKU or product ID if available
        "sku": productData.sku || productData.productId || currentProductId,
        "brand": {
            "@type": "Brand",
            "name": productData.brand || "Madhav Multiprint" // Default brand
        },
        // Only include offers if valid price details were found
        ...(offerDetails && { "offers": offerDetails })
        // AggregateRating can be added later if review data is processed
    };

    schemaScript.textContent = JSON.stringify(schema, null, 2); // Use null, 2 for pretty printing JSON
}

// --- Social Sharing Logic (Corrected Version) ---
function setupSocialSharing() {
    const socialShareLinks = document.querySelectorAll('.social-share a'); // Target links inside the container

     if (socialShareLinks.length > 0) {
         socialShareLinks.forEach(link => {
             // Ensure event listeners are not duplicated if this function is called multiple times
             link.removeEventListener('click', handleSocialLinkClick); // Remove previous listener first
             link.addEventListener('click', handleSocialLinkClick); // Add the new listener
         });
     } else {
          // console.log("No social share links found to attach listeners to.");
     }
}
// Define the handler function separately to allow removal
function handleSocialLinkClick(event) {
    event.preventDefault();
    // Ensure currentProductData and productName are available before proceeding
    if (!currentProductData || !currentProductData.productName) {
        console.warn("Cannot share: Product data or name missing.");
        return;
    }

    const pageUrl = window.location.href;
    const productName = encodeURIComponent(currentProductData.productName);
    let shareUrl = '';
    // Use nullish coalescing for safety, although aria-label should ideally exist
    const network = this.getAttribute('aria-label')?.toLowerCase() ?? ''; // 'this' refers to the clicked link

    if (network.includes('facebook')) {
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
    } else if (network.includes('twitter')) {
        shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${productName}`;
    } else if (network.includes('whatsapp')) {
        shareUrl = `https://api.whatsapp.com/send?text=${productName}%20${encodeURIComponent(pageUrl)}`;
    }
    // Add more networks like Pinterest, LinkedIn if needed

    if (shareUrl) {
        // Open in a new, smaller window for better user experience
        window.open(shareUrl, '_blank', 'width=600,height=400,noopener,noreferrer');
    } else {
         console.warn(`Could not generate share URL for network: ${network}`);
    }
}


// --- Initialize Page ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM fully loaded. Initializing product detail page...");

    const urlParams = new URLSearchParams(window.location.search);
    currentProductId = urlParams.get('id'); // Store globally

    if (!currentProductId) {
        showError("Product ID not found in URL. Cannot load details.");
        return;
    }

    console.log(`Product ID found: ${currentProductId}. Fetching data...`);
    showLoading(true);

    try {
        // Construct the document reference
        const productRef = doc(db, 'products', currentProductId);
        // Fetch the document
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
            console.log("Product data fetched successfully.");
            // Combine data and ID
            const productData = { ...productSnap.data(), productId: productSnap.id };

            // --- Crucial Check & Default for Pricing ---
            if (!productData.pricing) {
                productData.pricing = {}; // Ensure pricing object exists, even if empty
                console.warn(`Product ${currentProductId} was missing 'pricing' object. Created an empty one.`);
            }
            // -----------------------------------------

            renderProductDetails(productData); // Render everything

            // Attach event listeners AFTER elements are potentially rendered/modified by renderProductDetails
            if (addToCartBtn) {
                 // Remove previous listener before adding new one to prevent duplicates on potential re-renders
                 addToCartBtn.removeEventListener('click', handleAddToCart);
                 addToCartBtn.addEventListener('click', handleAddToCart);
            } else {
                console.error("Add to Cart button not found after rendering!");
            }

            if (reviewForm) {
                 reviewForm.removeEventListener('submit', handleReviewSubmit);
                 reviewForm.addEventListener('submit', handleReviewSubmit);
            } else {
                 console.log("Review form not found."); // Not necessarily an error
            }

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
         // Add a small delay? Sometimes rendering takes a moment after async ops finish.
         // setTimeout(() => showLoading(false), 100); // Optional small delay
         showLoading(false); // Usually fine to hide immediately
    }
}); // End DOMContentLoaded