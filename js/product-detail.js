// js/product-detail.js
// UPDATED Version: Incorporates Flex Banner PO Logic, Wedding Card Dropdown, and other enhancements.

// --- Imports ---
import { db } from './firebase-config.js'; // Firebase config इम्पोर्ट करें
import { doc, getDoc, collection, query, where, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"; // Firestore functions इम्पोर्ट करें
import { addToCart } from './cart.js'; // cart.js से addToCart फंक्शन इम्पोर्ट करें
import { updateCartCount } from './main.js'; // main.js से updateCartCount फंक्शन इम्पोर्ट करें (सुनिश्चित करें कि यह एक्सपोर्ट किया गया है)

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
const descriptionEl = document.getElementById('product-description');
const priceEl = document.getElementById('product-price');
const specsListEl = document.getElementById('product-specs');
const addToCartBtn = document.getElementById('add-to-cart-btn');
const cartFeedbackEl = document.getElementById('cart-feedback');

// --- Input Containers (Need to exist in HTML) ---
// Assumes a container wrapping the standard quantity input
const standardQuantityContainer = document.getElementById('standard-quantity-container'); // *** Add this div around the default label/input in HTML ***
// Assumes a container for Flex Banner inputs
const flexInputsContainer = document.getElementById('flex-inputs-container'); // *** Add this div in HTML, initially hidden ***
// Assumes a container for Wedding Card quantity dropdown
const weddingQuantityContainer = document.getElementById('wedding-quantity-container'); // *** Add this div in HTML, initially hidden ***

// Specific Input Elements
const standardQuantityInput = document.getElementById('quantity'); // The original quantity input

// Flex Banner Inputs (Need to be added to HTML inside flexInputsContainer)
const bannerWidthInput = document.getElementById('banner-width');
const bannerHeightInput = document.getElementById('banner-height');
const bannerUnitSelect = document.getElementById('banner-unit'); // Should have options 'feet' and 'inches'
const bannerQuantityInput = document.getElementById('banner-quantity');

// --- Global State ---
let currentProductData = null; // Store loaded product data globally
let currentProductId = null;

// --- Helper Functions ---

// Currency Formatting
const formatIndianCurrency = (amount) => {
    const num = Number(amount);
    return isNaN(num) || num === null ? 'N/A' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Format Specification Key (e.g., camelCase to Title Case)
function formatSpecKey(key) {
    const result = key.replace(/([A-Z])/g, ' $1');
    return result.charAt(0).toUpperCase() + result.slice(1);
}

// Show Error Message
function showError(message) {
    if (productContent) productContent.style.display = 'none';
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (errorMessageContainer) {
        errorMessageContainer.textContent = message;
        errorMessageContainer.style.display = 'block';
    }
    document.title = "Error - Madhav Multiprint";
    if (breadcrumbProductName) breadcrumbProductName.textContent = "Error";
}

// Show Cart Feedback Message
function showFeedback(message, isError = false) {
    if (cartFeedbackEl) {
        cartFeedbackEl.textContent = message;
        cartFeedbackEl.className = isError ? 'cart-feedback-message error' : 'cart-feedback-message success';
        cartFeedbackEl.style.display = 'block';
        setTimeout(() => {
            cartFeedbackEl.style.display = 'none';
        }, 3000);
    }
}

// --- Flex Banner Calculation Logic (from new_po.js) ---
const mediaWidthsFt = [3, 4, 5, 6, 8, 10]; // Standard media widths in feet

function calculateFlexDimensions(unit, width, height) {
    console.log(`Calculating flex: Unit=${unit}, W=${width}, H=${height}`);
    let wFt = (unit === 'inches') ? parseFloat(width || 0) / 12 : parseFloat(width || 0);
    let hFt = (unit === 'inches') ? parseFloat(height || 0) / 12 : parseFloat(height || 0);

    if (isNaN(wFt) || isNaN(hFt) || wFt <= 0 || hFt <= 0) {
        return { realSqFt: 0, printWidthFt: 0, printHeightFt: 0, printSqFt: 0 };
    }

    const realSqFt = wFt * hFt;

    // Find the best fit trying width against media widths
    const mediaWidthFitW = mediaWidthsFt.find(mw => mw >= wFt);
    let printWidthFt1 = mediaWidthFitW || wFt; // Use actual width if wider than all media
    let printHeightFt1 = hFt;
    let printSqFt1 = printWidthFt1 * printHeightFt1;
    if (!mediaWidthFitW) console.warn(`Width ${wFt.toFixed(2)}ft exceeds max media width.`);

    // Find the best fit trying height against media widths (rotated 90 deg)
    const mediaWidthFitH = mediaWidthsFt.find(mw => mw >= hFt);
    let printWidthFt2 = wFt;
    let printHeightFt2 = mediaWidthFitH || hFt; // Use actual height if taller than all media
    let printSqFt2 = printWidthFt2 * printHeightFt2;
    if (!mediaWidthFitH) console.warn(`Height ${hFt.toFixed(2)}ft exceeds max media width.`);

    // Choose the orientation that results in less print area
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
        printWidthFt: finalPrintWidthFt, // Width of media used
        printHeightFt: finalPrintHeightFt, // Height of media used (often matches banner height unless rotated)
        printSqFt: finalPrintSqFt.toFixed(2) // Area used for pricing
    };
}

// --- Update Price Functions ---

// Updates price for Flex Banners based on inputs
function updateFlexPrice() {
    if (!currentProductData || !currentProductData.pricing) return;

    const rate = parseFloat(currentProductData.pricing.rate || 0);
    const minOrderValue = parseFloat(currentProductData.pricing.minimumOrderValue || 0);

    const width = parseFloat(bannerWidthInput?.value || 0);
    const height = parseFloat(bannerHeightInput?.value || 0);
    const unit = bannerUnitSelect?.value || 'feet';
    const quantity = parseInt(bannerQuantityInput?.value || 1);

    if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0 || isNaN(quantity) || quantity < 1 || isNaN(rate)) {
        priceEl.textContent = formatIndianCurrency(minOrderValue > 0 ? minOrderValue : 0); // Show min price or 0 if invalid input
        return;
    }

    const calcResult = calculateFlexDimensions(unit, width, height);
    const printSqFtPerBanner = parseFloat(calcResult.printSqFt || 0);

    if (printSqFtPerBanner <= 0) {
        priceEl.textContent = formatIndianCurrency(minOrderValue > 0 ? minOrderValue : 0); // Show min price or 0 if calculation fails
        return;
    }

    const totalPrintSqFt = printSqFtPerBanner * quantity;
    const calculatedCost = totalPrintSqFt * rate;
    const finalCost = Math.max(calculatedCost, minOrderValue);

    priceEl.textContent = formatIndianCurrency(finalCost);
}

// Updates price for Wedding Cards based on selected quantity
function updateWeddingPrice() {
    if (!currentProductData || !currentProductData.pricing) return;

    const quantityDropdown = document.getElementById('wedding-quantity-select'); // Assumes this ID for the dropdown
    if (!quantityDropdown) return;

    const selectedQuantity = parseInt(quantityDropdown.value, 10);
    if (isNaN(selectedQuantity) || selectedQuantity <= 0) {
        priceEl.textContent = "Select Quantity";
        return;
    }

    // Retrieve pricing components
    const baseRate = parseFloat(currentProductData.pricing.rate || 0); // Assume this is per card for simplicity now
    const designCharge = parseFloat(currentProductData.pricing.designCharge || 0);
    const printingChargeBase = parseFloat(currentProductData.pricing.printingChargeBase || 0); // Assume this is a fixed base, adjust if needed
    const transportCharge = parseFloat(currentProductData.pricing.transportCharge || 0);
    const extraMarginPercent = parseFloat(currentProductData.pricing.extraMarginPercent || 0);

    // --- Simplified Calculation (Needs refinement based on exact business logic for printing charge) ---
    // Example: baseRate includes per-card cost, printingChargeBase is a fixed setup cost.
    const subTotal = (baseRate * selectedQuantity) + designCharge + printingChargeBase + transportCharge;
    const finalAmount = subTotal * (1 + (extraMarginPercent / 100));

    priceEl.textContent = formatIndianCurrency(finalAmount);
}

// Renders price for simple products or shows "Contact for Price"
function renderSimplePrice(productData) {
    if (!productData || !productData.pricing) {
        priceEl.textContent = 'Contact for Price';
        return;
    }

    let priceDisplay = 'Contact for Price';
    const rate = productData.pricing.rate;

    if (typeof rate !== 'undefined' && rate !== null) {
        const unit = productData.unit || 'Qty'; // Default to Qty if unit is missing
        if (unit.toLowerCase() !== 'sq feet') { // Only handle non-SqFeet here
            priceDisplay = `${formatIndianCurrency(rate)} / ${unit}`;
        } else {
             // Price for Sq Feet handled by updateFlexPrice, show Contact initially or min price?
             const minOrderValue = parseFloat(productData.pricing.minimumOrderValue || 0);
             priceDisplay = minOrderValue > 0 ? `From ${formatIndianCurrency(minOrderValue)}` : 'Enter Dimensions';
        }
    }
    priceEl.textContent = priceDisplay;
}

// --- Main Logic ---

// Load Product Details Function
async function loadProductDetails(productId) {
    if (!loadingIndicator || !productContent || !errorMessageContainer) {
        console.error("Core layout elements not found!");
        showError("Page layout error.");
        return;
    }
    loadingIndicator.style.display = 'flex';
    productContent.style.display = 'none';
    errorMessageContainer.style.display = 'none';

    // Clear previous dynamic elements
    if (weddingQuantityContainer) weddingQuantityContainer.innerHTML = '';

    try {
        const productRef = doc(db, "onlineProducts", productId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
            currentProductData = productSnap.data(); // Store data globally
            currentProductId = productId; // Store ID globally

            if (!currentProductData) {
                 showError("Failed to process product data.");
                 return;
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
                        thumb.src = url;
                        thumb.alt = `Thumbnail ${index + 1}`;
                        thumb.classList.add('thumbnail');
                        if (index === 0) thumb.classList.add('active');
                        thumbnailImagesContainer.appendChild(thumb);
                    });
                } else {
                    mainImageEl.src = 'images/placeholder.png';
                    mainImageEl.alt = 'Placeholder image';
                    thumbnailImagesContainer.innerHTML = '';
                }
            }

            // Description
            if (descriptionEl) descriptionEl.textContent = currentProductData.description || 'No description available.';

            // --- Handle Product Type Specific UI ---
            const category = currentProductData.category?.toLowerCase() || '';
            const unit = currentProductData.unit?.toLowerCase() || 'qty';

            // Hide all input sections initially
            if (standardQuantityContainer) standardQuantityContainer.style.display = 'none';
            if (flexInputsContainer) flexInputsContainer.style.display = 'none';
            if (weddingQuantityContainer) weddingQuantityContainer.style.display = 'none';

            if (category.includes('flex')) { // Check if Flex Banner
                if (flexInputsContainer) {
                    flexInputsContainer.style.display = 'block'; // Or 'flex', 'grid' depending on your CSS
                    // Add event listeners for flex inputs
                    [bannerWidthInput, bannerHeightInput, bannerUnitSelect, bannerQuantityInput].forEach(input => {
                        input?.addEventListener('input', updateFlexPrice);
                    });
                    // Initial price calculation
                    updateFlexPrice();
                } else { console.warn("Flex input container not found in HTML."); }
            } else if (category.includes('wedding')) { // Check if Wedding Card
                if (weddingQuantityContainer && currentProductData.options && Array.isArray(currentProductData.options)) {
                    const quantityOption = currentProductData.options.find(opt => opt.name?.toLowerCase() === 'quantity');
                    if (quantityOption && quantityOption.values && Array.isArray(quantityOption.values)) {
                        // Create dropdown
                        const select = document.createElement('select');
                        select.id = 'wedding-quantity-select'; // Give it an ID
                        select.name = 'wedding_quantity';

                        const defaultOption = document.createElement('option');
                        defaultOption.value = '';
                        defaultOption.textContent = '-- Select Quantity --';
                        select.appendChild(defaultOption);

                        quantityOption.values.forEach(val => {
                            const option = document.createElement('option');
                            option.value = val;
                            option.textContent = val;
                            select.appendChild(option);
                        });

                        // Add label (optional)
                        const label = document.createElement('label');
                        label.htmlFor = 'wedding-quantity-select';
                        label.textContent = 'Select Quantity:';

                        weddingQuantityContainer.appendChild(label);
                        weddingQuantityContainer.appendChild(select);
                        weddingQuantityContainer.style.display = 'block'; // Or 'flex'

                        // Add event listener for wedding quantity dropdown
                        select.addEventListener('change', updateWeddingPrice);
                        // Set initial price text
                        priceEl.textContent = "Select Quantity";
                    } else {
                        // Fallback to standard quantity if options are invalid
                        if (standardQuantityContainer) standardQuantityContainer.style.display = 'block';
                         renderSimplePrice(currentProductData);
                    }
                } else {
                     // Fallback to standard quantity if options missing
                    if (standardQuantityContainer) standardQuantityContainer.style.display = 'block';
                    renderSimplePrice(currentProductData);
                     console.warn("Wedding card options not found or invalid.");
                }
            } else { // Standard Product (Stamp, Pamphlet, etc.)
                if (standardQuantityContainer) standardQuantityContainer.style.display = 'block'; // Or 'flex'
                renderSimplePrice(currentProductData);
            }

            // Specifications
            if (specsListEl) {
                specsListEl.innerHTML = '';
                if (currentProductData.specifications && typeof currentProductData.specifications === 'object' && Object.keys(currentProductData.specifications).length > 0) {
                    for (const [key, value] of Object.entries(currentProductData.specifications)) {
                        if (value) {
                            const li = document.createElement('li');
                            li.innerHTML = `<strong>${formatSpecKey(key)}:</strong> ${value}`;
                            specsListEl.appendChild(li);
                        }
                    }
                } else {
                    specsListEl.innerHTML = '<li>No specifications available.</li>';
                }
            }

            // --- Show Content ---
            productContent.style.display = 'grid'; // Or 'flex', based on your CSS
            loadingIndicator.style.display = 'none';

        } else {
            showError("Product not found.");
        }
    } catch (error) {
        console.error("Error loading product details: ", error);
        showError(`Failed to load product details. ${error.message}`);
    }
}


// Add to Cart Handler (UPDATED)
function handleAddToCart() {
    if (!currentProductId || !currentProductData) {
        showFeedback("Error: Product data not loaded.", true);
        return;
    }

    const category = currentProductData.category?.toLowerCase() || '';
    let itemToAdd = { productId: currentProductId, quantity: 0 };
    let cartOptions = {}; // Extra details for the cart item

    try {
        if (category.includes('flex')) {
            // --- Flex Banner Add to Cart ---
            const width = parseFloat(bannerWidthInput?.value || 0);
            const height = parseFloat(bannerHeightInput?.value || 0);
            const unit = bannerUnitSelect?.value || 'feet';
            const quantity = parseInt(bannerQuantityInput?.value || 1);

            if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0 || isNaN(quantity) || quantity < 1) {
                showFeedback("Please enter valid dimensions and quantity.", true);
                return;
            }

            // Recalculate price to ensure accuracy
            const rate = parseFloat(currentProductData.pricing?.rate || 0);
            const minOrderValue = parseFloat(currentProductData.pricing?.minimumOrderValue || 0);
            const calcResult = calculateFlexDimensions(unit, width, height);
            const printSqFtPerBanner = parseFloat(calcResult.printSqFt || 0);

            if (printSqFtPerBanner <= 0 || isNaN(rate)) {
                 showFeedback("Error calculating price. Cannot add to cart.", true);
                 return;
            }
            const totalPrintSqFt = printSqFtPerBanner * quantity;
            const calculatedCost = totalPrintSqFt * rate;
            const finalCost = Math.max(calculatedCost, minOrderValue);

            itemToAdd.quantity = quantity;
            cartOptions = {
                type: 'Flex',
                dimensions: { width, height, unit },
                printSqFt: printSqFtPerBanner.toFixed(2),
                price: finalCost // Pass the final calculated price
            };

        } else if (category.includes('wedding')) {
            // --- Wedding Card Add to Cart ---
             const quantityDropdown = document.getElementById('wedding-quantity-select');
             if (!quantityDropdown || !quantityDropdown.value) {
                  showFeedback("Please select a quantity.", true);
                  return;
             }
             const selectedQuantity = parseInt(quantityDropdown.value, 10);

             // Recalculate price
             const baseRate = parseFloat(currentProductData.pricing?.rate || 0);
             const designCharge = parseFloat(currentProductData.pricing?.designCharge || 0);
             const printingChargeBase = parseFloat(currentProductData.pricing?.printingChargeBase || 0);
             const transportCharge = parseFloat(currentProductData.pricing?.transportCharge || 0);
             const extraMarginPercent = parseFloat(currentProductData.pricing?.extraMarginPercent || 0);
             const subTotal = (baseRate * selectedQuantity) + designCharge + printingChargeBase + transportCharge;
             const finalAmount = subTotal * (1 + (extraMarginPercent / 100));

             itemToAdd.quantity = selectedQuantity;
             cartOptions = {
                type: 'Wedding Card',
                 price: finalAmount // Pass the final calculated price
             };

        } else {
            // --- Standard Product Add to Cart ---
             const quantity = parseInt(standardQuantityInput?.value || 1);
             if (isNaN(quantity) || quantity < 1) {
                 showFeedback("Please enter a valid quantity.", true);
                 return;
             }
             itemToAdd.quantity = quantity;
             // For standard items, price might be fetched directly in cart or stored here if needed
             cartOptions = {
                 type: 'Standard',
                 price: currentProductData.pricing?.rate // Pass base rate if needed by cart
             };
        }

        // Call the imported addToCart function
        addToCart(itemToAdd.productId, itemToAdd.quantity, cartOptions);
        showFeedback("Product added to cart!", false);

        // Update header cart count
        if (typeof updateCartCount === 'function') {
            updateCartCount();
        } else {
            console.warn("updateCartCount function is not available.");
        }

    } catch (error) {
        console.error("Error adding to cart:", error);
        showFeedback(`Failed to add product to cart. ${error.message}`, true);
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        showError("Product ID not found in URL.");
        return;
    }

    loadProductDetails(productId);

    // Add to Cart Button Listener
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', handleAddToCart);
    } else {
        console.error("Add to Cart button not found!");
    }

    // Thumbnail Click Listener
    if (thumbnailImagesContainer) {
        thumbnailImagesContainer.addEventListener('click', (event) => {
            if (event.target.tagName === 'IMG' && mainImageEl) {
                mainImageEl.src = event.target.src;
                const thumbnails = thumbnailImagesContainer.querySelectorAll('img');
                thumbnails.forEach(thumb => thumb.classList.remove('active'));
                event.target.classList.add('active');
            }
        });
    }

    // --- Add listeners for other potential features here (e.g., related products, reviews) ---

}); // End DOMContentLoaded