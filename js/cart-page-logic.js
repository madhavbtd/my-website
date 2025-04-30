// js/cart-page-logic.js
// UPDATED: Includes console.log for debugging order data before sending to Firestore

// --- Imports ---
// Firebase और Firestore फंक्शन्स इम्पोर्ट करें
import { db } from './firebase-config.js';
import { doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// cart.js से आवश्यक फंक्शन्स इम्पोर्ट करें
import { getCart, removeFromCart, updateCartItemQuantity, clearCart } from './cart.js'; // Make sure getCart is imported

// main.js से हेडर कार्ट काउंट अपडेट फंक्शन इम्पोर्ट करें (यदि उपलब्ध है)
// import { updateCartCount } from './main.js';
// Fallback function
function updateCartCountFallback() {
    const cart = getCart(); // Use imported getCart
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
        cartCountElement.textContent = count;
    }
    console.log("Cart count updated (fallback):", count);
}


// --- DOM Elements ---
const cartItemsContainer = document.getElementById('cart-items');
const emptyCartMessage = cartItemsContainer?.querySelector('.empty-cart-message'); // Ensure template exists in HTML
const cartSuggestions = document.querySelector('.cart-suggestions');
const summarySubtotalEl = document.getElementById('summary-subtotal');
const summaryTotalEl = document.getElementById('summary-total');
const orderForm = document.getElementById('order-form');
const orderStatusDiv = document.getElementById('order-status'); // Make sure this ID exists in your HTML
const orderStatusMessageEl = document.getElementById('order-status-message'); // Make sure this ID exists
const cartItemsSection = document.getElementById('cart-items-section'); // ID for the "Items in Your Cart" column

// --- Helper Functions ---

// Format currency
function formatCurrency(amount) {
    // Use Intl.NumberFormat for proper currency formatting
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

// Fetch product details (basic version for price calculation if needed, can be expanded)
async function getProductDetails(productId) {
    try {
        const productRef = doc(db, 'onlineProducts', productId); // Assuming products are in 'onlineProducts'
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
            return productSnap.data();
        } else {
            console.warn(`Product with ID ${productId} not found in Firestore.`);
            return null;
        }
    } catch (error) {
        console.error(`Error fetching product details for ${productId}:`, error);
        return null; // Return null on error
    }
}

// --- Core Logic ---

// Function to render cart items on the page
async function renderCartItems() {
    if (!cartItemsContainer || !summarySubtotalEl || !summaryTotalEl) {
        console.error("Cart elements not found in the DOM!");
        return;
    }

    const cart = getCart();
    cartItemsContainer.innerHTML = ''; // Clear existing items

    if (cart.length === 0) {
        // Show empty cart message and suggestions
        if (emptyCartMessage) emptyCartMessage.style.display = 'block'; // Show template message
        if (cartSuggestions) cartSuggestions.style.display = 'block';
        // Hide form and summary if cart is empty? Maybe optional.
        if(orderForm) orderForm.closest('.cart-column').style.display = 'none'; // Hide the whole form column
        if(cartItemsSection) cartItemsSection.style.display = 'none'; // Hide items section

        summarySubtotalEl.textContent = formatCurrency(0);
        summaryTotalEl.textContent = formatCurrency(0);
        console.log("Cart is empty.");
        return; // Exit if cart is empty
    }

    // If cart is not empty, hide empty message/suggestions and show form/items
    if (emptyCartMessage) emptyCartMessage.style.display = 'none';
    if (cartSuggestions) cartSuggestions.style.display = 'none';
    if(orderForm) orderForm.closest('.cart-column').style.display = 'block'; // Show form column
     if(cartItemsSection) cartItemsSection.style.display = 'block'; // Show items section


    let subtotal = 0;

    // Use Promise.all to fetch product details concurrently if needed for price verification
    // OR use prices stored directly in the cart item during 'addToCart'
    for (const item of cart) {
        // Assuming price is stored in item when added to cart
        // If not, you'd need: const productData = await getProductDetails(item.productId);
        const itemTotal = item.price * item.quantity; // Use price stored in cart item
        subtotal += itemTotal;

        const cartItemElement = document.createElement('div');
        cartItemElement.classList.add('cart-item');
        cartItemElement.innerHTML = `
            <img src="<span class="math-inline">\{item\.image</1\> \|\| 'images/placeholder\.png'\}" alt\="</span>{item.name}" class="cart-item-image">
            <div class="cart-item-details">
                <span class="cart-item-name">${item.name || 'Product Name Missing'}</span>
                <span class="cart-item-price">Price: <span class="math-inline">\{formatCurrency\(item\.price \|\| 0\)\}</span\>
<div class\="cart\-item\-quantity"\>
<label for\="qty\-</span>{item.productId}">Quantity:</label>
                    <input type="number" id="qty-<span class="math-inline">\{item\.productId\}" value\="</span>{item.quantity}" min="1" data-product-id="${item.productId}" class="quantity-input">
                </div>
            </div>
            <div class="cart-item-subtotal">
                 <span>Subtotal: <span class="math-inline">\{formatCurrency\(itemTotal\)\}</span\>
<button class\="remove\-item\-btn" data\-product\-id\="</span>{item.productId}" title="Remove Item">
                     <i class="fas fa-trash-alt"></i>
                 </button>
            </div>

        `;
        cartItemsContainer.appendChild(cartItemElement);
    }

    // Add event listeners for quantity changes and remove buttons
    cartItemsContainer.querySelectorAll('.quantity-input').forEach(input => {
        input.addEventListener('change', handleQuantityChange);
    });

    cartItemsContainer.querySelectorAll('.remove-item-btn').forEach(button => {
        button.addEventListener('click', handleRemoveItem);
    });

    // Update summary
    summarySubtotalEl.textContent = formatCurrency(subtotal);
    summaryTotalEl.textContent = formatCurrency(subtotal); // Assuming no taxes/shipping for now

    console.log("Cart items rendered. Subtotal:", subtotal);
}

// Handle quantity change
function handleQuantityChange(event) {
    const input = event.target;
    const productId = input.dataset.productId;
    const newQuantity = parseInt(input.value, 10);

    if (isNaN(newQuantity) || newQuantity < 1) {
        // Reset to 1 or previous value if invalid (or remove if 0 allowed)
        input.value = 1; // Or fetch old value
        console.warn(`Invalid quantity entered for ${productId}. Resetting to 1.`);
        updateCartItemQuantity(productId, 1);
    } else {
        updateCartItemQuantity(productId, newQuantity);
    }
    renderCartItems(); // Re-render cart to update totals and subtotals
    updateCartCountFallback(); // Update header count
}

// Handle item removal
function handleRemoveItem(event) {
    const button = event.currentTarget; // Use currentTarget to ensure it's the button
    const productId = button.dataset.productId;
    removeFromCart(productId);
    renderCartItems(); // Re-render cart
    updateCartCountFallback(); // Update header count
    console.log(`Removed item ${productId}`);
}


// --- Firestore Order Submission ---

// Function to create the order document in Firestore
async function createOrderInFirestore(cartDetails) {
    // 1. Get customer details from the form
    const customerName = document.getElementById('customer-name')?.value?.trim();
    const customerContact = document.getElementById('customer-contact')?.value?.trim();
    const customerAddress = document.getElementById('customer-address')?.value?.trim();
    const specialInstructions = document.getElementById('special-instructions')?.value?.trim() || ''; // Default to empty string if not present or empty

    // Basic Validation (should ideally be more robust)
    if (!customerName || !customerContact || !customerAddress) {
        throw new Error("Please fill in all required contact information.");
    }
     if (!cartDetails || !cartDetails.items || cartDetails.items.length === 0) {
        throw new Error("Cannot place an order with an empty cart.");
    }

    // 2. Prepare order data object
    const orderData = {
        customerName: customerName,
        customerContact: customerContact,
        customerAddress: customerAddress,
        specialInstructions: specialInstructions, // Included, even if empty
        orderItems: cartDetails.items.map(item => ({ // Store relevant item details
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            price: item.price, // Price per unit at time of order
            image: item.image || null // Include image URL if available
        })),
        totalAmount: cartDetails.total, // Use calculated total from cart
        status: 'Pending', // Initial order status
        timestamp: serverTimestamp() // Use Firestore server timestamp
    };

    // --- <<< DEBUGGING LOG: Print the data object before sending >>> ---
    console.log("Attempting to save order data:", JSON.stringify(orderData, null, 2));
    // --- <<< END DEBUGGING LOG >>> ---


    try {
        // 3. Add order document to Firestore 'orders' collection
        const ordersCollection = collection(db, 'orders'); // Ensure this matches your Firestore collection name
        const docRef = await addDoc(ordersCollection, orderData);
        console.log("Order placed successfully with ID:", docRef.id);
        return docRef.id; // Return the new order ID
    } catch (error) {
        console.error("Error placing order to Firestore:", error); // This is where the permission error likely originates
        // Re-throw the error so it can be caught by handleOrderSubmit
        // Include more details if possible
        throw new Error(`Firestore error: ${error.message || error}`);
    }
}


// Handle form submission
async function handleOrderSubmit(event) {
    event.preventDefault(); // Prevent default form submission
    console.log("Order form submitted.");

    const submitButton = document.getElementById('submit-order-btn');
    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        const cart = getCart();
        const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

        if (cart.length === 0) {
             throw new Error("Your cart is empty. Cannot place order.");
        }

        const cartDetails = {
            items: cart,
            total: subtotal // Pass the calculated total
        };

        // Call the function to create the order in Firestore
        const orderId = await createOrderInFirestore(cartDetails);

        // Order successful
        console.log(`Order ${orderId} creation initiated successfully.`);
        clearCart(); // Clear the cart from localStorage
        updateCartCountFallback(); // Update header count
        // renderCartItems(); // Re-render to show empty cart (or show success message)
        showOrderStatus(`✅ Order placed successfully! Your Order ID is: ${orderId}`);

    } catch (error) {
        // Order failed
        console.error("Order placement failed:", error);
        // Show specific error message to the user
        showOrderStatus(`❌ Error placing order. ${error.message || 'Please try again.'}`, true); // Mark as error

    } finally {
        // Re-enable the button regardless of success or failure
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    }
}

// Function to display order status message
function showOrderStatus(message, isError = false) {
    if (!orderStatusDiv || !orderStatusMessageEl || !orderForm || !cartItemsSection) {
        console.error("Required elements for showing order status not found.");
        // Fallback alert
        alert(message);
        return;
    }

    orderStatusMessageEl.textContent = message;
    orderStatusMessageEl.className = isError ? 'status-message error' : 'status-message success'; // Add classes for styling
    orderStatusDiv.style.display = 'block';

    // Hide form and cart items section ONLY if successful
     if (!isError) {
         orderForm.style.display = 'none';
         cartItemsSection.style.display = 'none'; // Hide items section as well
     }
}

// --- Initialize Page ---\ndocument.addEventListener('DOMContentLoaded', () => {\n    console.log(\"Cart page logic initializing...\");\n    renderCartItems(); // Render cart on page load\n\n    if (orderForm) {\n        orderForm.addEventListener('submit', handleOrderSubmit);\n    } else {\n        console.error(\"Order form element (#order-form) not found!\");\n    }\n\n    // Optional: Add listener for file input name display if not already in HTML script tag\n    // (Assuming file upload is not part of the immediate order logic fix)\n    /*\n    const fileInput = document.getElementById('design-file-upload');\n    const fileNameSpan = document.querySelector('.file-name');\n    if (fileInput && fileNameSpan && !document.querySelector('script[data-handles-file-upload]')) { \n        fileInput.addEventListener('change', function() {\n            if (this.files && this.files.length > 0) {\n                fileNameSpan.textContent = this.files[0].name;\n            } else {\n                fileNameSpan.textContent = 'No file chosen';\n            }\n        });\n        const scriptTag = document.createElement('script');\n        scriptTag.setAttribute('data-handles-file-upload', 'true');\n        document.body.appendChild(scriptTag); \n    }\n    */\n});\n\nconsole.log(\"cart-page-logic.js loaded with updated logic and debugging log included.\");\n```