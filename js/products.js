// js/product-detail.js
// Handles fetching product details, displaying customization options,
// and calling the Cloud Function for dynamic pricing.

import { db, functions, doc, getDoc } from './firebase-config.js'; // Import Firestore and Functions
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { addToCart } from './cart.js'; // Import from cart.js (Stage 5)

// DOM Elements (Ensure these IDs exist in product-detail.html)
const productDetailContainer = document.getElementById('product-detail-content');
let currentProductData = null; // To store loaded product data
let currentProductId = null;

// Reference to the 'calculatePrice' Cloud Function
const calculatePriceFunction = httpsCallable(functions, 'calculatePrice');

/**
 * Fetches and displays product details
 */
async function loadProductDetails() {
    if (!productDetailContainer) {
        console.error("Product detail container not found.");
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    currentProductId = urlParams.get('id'); // Get product ID from URL

    if (!currentProductId) {
        productDetailContainer.innerHTML = '<p>Error: Product ID not specified.</p>';
        return;
    }

    productDetailContainer.innerHTML = '<p>Loading product details...</p>';

    try {
        const productRef = doc(db, "products", currentProductId);
        const docSnap = await getDoc(productRef);

        if (docSnap.exists()) {
            currentProductData = docSnap.data(); // Store product data globally
            document.title = `${currentProductData.printName || 'Product'} - Madhav Offset`;

            // Generate HTML structure
            productDetailContainer.innerHTML = `
                <h1>${currentProductData.printName || 'N/A'}</h1>
                <div class="product-layout">
                    <div class="product-images">
                        <img src="${currentProductData.imageUrl || 'images/placeholder.png'}" alt="${currentProductData.printName}">
                        </div>
                    <div class="product-info">
                        <p>${currentProductData.description || 'No description available.'}</p>
                        ${currentProductData.specifications ? `<h4>Specifications:</h4><p>${currentProductData.specifications}</p>` : ''}

                        <div id="customization-options">
                            <p>Loading options...</p>
                        </div>
                        <div id="price-display">
                            <p>Calculating price...</p>
                        </div>
                        <button id="add-to-cart-btn" class="button-primary" data-product-id="${currentProductId}" disabled>Add to Cart</button>
                    </div>
                </div>
            `;
            // Load customization options based on product type
            loadCustomizationOptions(currentProductData, currentProductId);
        } else {
            productDetailContainer.innerHTML = '<p>Product not found.</p>';
        }
    } catch (error) {
        console.error("Error loading product details:", error);
        productDetailContainer.innerHTML = '<p>Error loading product details. Please try again.</p>';
    }
}

/**
 * Loads customization inputs based on product type
 */
function loadCustomizationOptions(product, productId) {
    const customizationContainer = document.getElementById('customization-options');
    if (!customizationContainer) return;

    let optionsHTML = '<h3>Customize Your Product:</h3>';
    const productType = product.type || 'default'; // Assume a 'type' field exists in your product data

    // Add options based on Requirement 2.C
    switch (productType) {
        case 'flex':
            optionsHTML += `
                <div class="form-group">
                    <label for="width">Width (feet):</label>
                    <input type="number" id="width" name="width" step="0.01" required class="customization-input">
                </div>
                <div class="form-group">
                    <label for="height">Height (feet):</label>
                    <input type="number" id="height" name="height" step="0.01" required class="customization-input">
                </div>
                <input type="hidden" id="unitType" value="Sq Feet">
            `;
            break;
        case 'wedding_card':
            optionsHTML += `
                <div class="form-group">
                    <label for="quantity">Quantity (Min 50):</label>
                    <input type="number" id="quantity" name="quantity" min="50" step="50" value="50" required class="customization-input">
                    <input type="hidden" id="unitType" value="Qty">
                </div>
            `;
            break;
        case 'bill_book':
             optionsHTML += `
                <div class="form-group">
                    <label for="size">Size:</label>
                    <select id="size" name="size" required class="customization-input">
                        <option value="A5">A5</option>
                        <option value="A4">A4</option>
                        </select>
                </div>
                <div class="form-group">
                    <label for="sets">Sets (1 Set = 5 Books):</label>
                    <select id="sets" name="sets" required class="customization-input">
                         <option value="1">1 Set (5 Books)</option>
                         <option value="2">2 Sets (10 Books)</option>
                         </select>
                 </div>
                 <input type="hidden" id="unitType" value="Set">
             `;
             break;
        case 'visiting_card':
             optionsHTML += `
                <div class="form-group">
                    <label for="cardType">Card Type:</label>
                    <select id="cardType" name="cardType" required class="customization-input">
                        <option value="standard">Standard</option>
                        <option value="premium">Premium</option>
                        </select>
                </div>
                 <div class="form-group">
                     <label for="quantity">Quantity:</label>
                     <input type="number" id="quantity_display" value="1000" required readonly class="customization-input-display">
                     <input type="hidden" id="quantity" name="quantity" value="1000">
                     <small>(Minimum 1000 pieces. For 2000, add quantity 2 in cart)</small>
                     <input type="hidden" id="unitType" value="FixedQty">
                 </div>
             `;
             break;
        default: // Default quantity option
             optionsHTML += `
                 <div class="form-group">
                    <label for="quantity">Quantity:</label>
                    <input type="number" id="quantity" name="quantity" value="1" min="1" step="1" required class="customization-input">
                     <input type="hidden" id="unitType" value="Qty">
                 </div>
            `;
    }
    customizationContainer.innerHTML = optionsHTML;

    // Add event listeners to update price on change
    customizationContainer.querySelectorAll('.customization-input').forEach(input => {
        input.addEventListener('change', () => updatePrice(productId));
        input.addEventListener('input', () => updatePrice(productId)); // For number fields
    });

    // Load initial price
    updatePrice(productId);

    // Add to cart button listener
    const addToCartButton = document.getElementById('add-to-cart-btn');
    if (addToCartButton) {
        addToCartButton.addEventListener('click', handleAddToCart);
    }
}

/**
 * Gathers options, calls Cloud Function, updates price display
 */
async function updatePrice(productId) {
    const priceDisplayContainer = document.getElementById('price-display');
    const customizationContainer = document.getElementById('customization-options');
    const addToCartButton = document.getElementById('add-to-cart-btn');

    if (!priceDisplayContainer || !customizationContainer || !addToCartButton) return;

    priceDisplayContainer.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Calculating price...</p>';
    addToCartButton.disabled = true; // Disable button during calculation

    // Gather selected options
    const options = {};
    let isValid = true; // Flag to check if all required inputs have values
    customizationContainer.querySelectorAll('.customization-input').forEach(input => {
        if (input.name) {
            if (input.required && !input.value) {
                isValid = false; // Mark as invalid if a required field is empty
            }
            options[input.name] = input.value;
        }
    });

    // Add unitType separately
    const unitTypeInput = customizationContainer.querySelector('#unitType');
    const unitType = unitTypeInput ? unitTypeInput.value : 'Qty';

    // Only proceed if all required inputs are valid
    if (!isValid) {
        priceDisplayContainer.innerHTML = `<p class="price-error">Please select all required options.</p>`;
        addToCartButton.disabled = true;
        return;
    }

    console.log("Calling calculatePrice with:", { productId, unitType, options });

    try {
        const result = await calculatePriceFunction({ productId: productId, unitType: unitType, options: options });
        const price = result.data.price; // Assume function returns { data: { price: NUMBER } }

        if (typeof price === 'number' && price >= 0) {
            priceDisplayContainer.innerHTML = `<p class="calculated-price">Estimated Price: ₹${price.toFixed(2)}</p>`;
            addToCartButton.disabled = false; // Enable button
            addToCartButton.dataset.price = price.toFixed(2); // Store calculated price
            addToCartButton.dataset.options = JSON.stringify(options); // Store selected options
            addToCartButton.dataset.unitType = unitType; // Store unit type
        } else {
            throw new Error("Invalid price received from server.");
        }
    } catch (error) {
        console.error("Price calculation error:", error);
        priceDisplayContainer.innerHTML = `<p class="price-error">Could not calculate price. ${error.message || ''}</p>`;
        addToCartButton.disabled = true;
    }
}

/**
 * Handles adding the configured product to the cart (Stage 5 logic)
 */
function handleAddToCart(event) {
    const button = event.target;
    const productId = button.dataset.productId;
    const price = parseFloat(button.dataset.price);
    const unitType = button.dataset.unitType;
    let options = {};
    try {
        options = JSON.parse(button.dataset.options || '{}');
    } catch (e) { console.error("Error parsing options from button dataset", e); }

    if (!currentProductData || !productId || isNaN(price)) {
        alert("Error: Product data or price missing. Cannot add to cart.");
        return;
    }

    // Add unitType and quantity explicitly to options if not already present
    options.unitType = unitType;
    const qtyInput = document.getElementById('quantity'); // Assuming ID is 'quantity'
    if (qtyInput && !options.quantity) {
        options.quantity = qtyInput.value;
    }
     // Special case for visiting cards where display might be 1000 but we track sets of 1000
     if (productType === 'visiting_card') {
         options.quantity = 1; // Represent as 1 unit of 1000 cards
     }


    console.log("Adding to cart:", { product: currentProductData, options, price });
    // Call the actual addToCart function from cart.js
    addToCart(currentProductData, options, price); // Pass necessary data
}


// Initial load when the page is ready
document.addEventListener('DOMContentLoaded', loadProductDetails);