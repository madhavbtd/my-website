// js/cart-page-logic.js

import { db } from './firebase-config.js';
import { doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getCart, removeFromCart, updateCartItemQuantity, clearCart } from './cart.js'; // Assuming cart.js exports these
import { updateCartCount } from './main.js'; // Assuming main.js exports this

// --- DOM Elements ---
const cartItemsContainer = document.getElementById('cart-items');
const emptyCartMessage = cartItemsContainer?.querySelector('.empty-cart-message');
const cartSuggestions = document.querySelector('.cart-suggestions');
const summarySubtotalEl = document.getElementById('summary-subtotal');
const summaryTotalEl = document.getElementById('summary-total');
const orderForm = document.getElementById('order-form');
const orderStatusDiv = document.getElementById('order-status-message');
const submitButton = document.getElementById('submit-order-btn');
const cartItemsSection = document.getElementById('cart-items-section'); // Cart items column

// --- Helper Functions ---
const formatIndianCurrency = (amount) => {
    const num = Number(amount);
    return isNaN(num) ? '₹ 0.00' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// --- Main Functions ---

/**
 * Renders cart items by fetching details from Firebase.
 */
async function renderCartItems() {
    if (!cartItemsContainer || !summarySubtotalEl || !summaryTotalEl || !emptyCartMessage) {
        console.error("Cart DOM elements not found!");
        return;
    }

    const cart = getCart(); // Get cart from localStorage
    cartItemsContainer.innerHTML = ''; // Clear previous items (keep empty message template if needed)
    emptyCartMessage.style.display = 'none'; // Hide initially
    if (cartSuggestions) cartSuggestions.style.display = 'none'; // Hide suggestions initially

    if (cart.length === 0) {
        emptyCartMessage.style.display = 'block';
        if (cartSuggestions) cartSuggestions.style.display = 'block';
        summarySubtotalEl.textContent = formatIndianCurrency(0);
        summaryTotalEl.textContent = formatIndianCurrency(0);
        if (orderForm) orderForm.style.display = 'none'; // Hide form if cart is empty
        return;
    }

    if (orderForm) orderForm.style.display = 'block'; // Show form if cart has items

    let subtotal = 0;
    const itemPromises = cart.map(async (item) => {
        try {
            // Fetch product details from Firebase 'onlineProducts' collection
            // *** ADJUST 'onlineProducts' if your collection name is different ***
            const productRef = doc(db, "onlineProducts", item.productId);
            const productSnap = await getDoc(productRef);

            if (productSnap.exists()) {
                const productData = productSnap.data();
                // *** ADJUST field names like 'productName', 'imageUrls', 'pricing.rate' if needed ***
                const productName = productData.productName || 'Product Name Unavailable';
                const imageUrl = (productData.imageUrls && productData.imageUrls[0]) ? productData.imageUrls[0] : 'images/placeholder.png'; // Use placeholder if no image
                // --- Price Logic ---
                // This assumes a simple 'rate'. For complex pricing (Flex/Wedding),
                // you might need to store the calculated price in the cart itself
                // or replicate the price calculation logic here.
                // For simplicity, we'll use productData.pricing.rate here.
                const itemPrice = parseFloat(productData.pricing?.rate || 0);
                const itemQuantity = item.quantity;
                const itemSubtotal = itemPrice * itemQuantity;
                subtotal += itemSubtotal;

                // Create HTML for the cart item
                const itemElement = document.createElement('div');
                itemElement.className = 'cart-item';
                itemElement.dataset.productId = item.productId; // Store product ID for removal etc.

                itemElement.innerHTML = `
                    <img src="${imageUrl}" alt="${productName}">
                    <div class="item-details">
                        <h4><a href="product-detail.html?id=${item.productId}">${productName}</a></h4>
                        <p class="item-price">Unit Price: ${formatIndianCurrency(itemPrice)}</p>
                        <div class="item-quantity">
                            <label for="qty-${item.productId}">Quantity:</label>
                            <input type="number" id="qty-${item.productId}" value="${itemQuantity}" min="1" class="item-qty-input" aria-label="Item Quantity">
                            </div>
                    </div>
                    <div style="text-align: right;">
                        <button class="remove-item-btn" aria-label="Remove item">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        <p class="item-subtotal">Subtotal: ${formatIndianCurrency(itemSubtotal)}</p>
                    </div>
                `;
                // Add event listeners for quantity change and removal for this item
                const qtyInput = itemElement.querySelector('.item-qty-input');
                const removeBtn = itemElement.querySelector('.remove-item-btn');

                if (qtyInput) {
                    qtyInput.addEventListener('change', (e) => handleQuantityChange(item.productId, parseInt(e.target.value, 10)));
                }
                if (removeBtn) {
                    removeBtn.addEventListener('click', () => handleRemoveItem(item.productId));
                }

                return { element: itemElement, subtotal: itemSubtotal };
            } else {
                console.warn(`Product details not found for ID: ${item.productId}`);
                // Optionally render a placeholder for missing products
                return null;
            }
        } catch (error) {
            console.error(`Error fetching details for product ${item.productId}:`, error);
            // Optionally render an error placeholder for this item
            return null;
        }
    });

    // Wait for all product details to be fetched and processed
    const renderedItems = await Promise.all(itemPromises);

    // Append valid items to the container and calculate final total
    let finalTotal = 0;
    renderedItems.forEach(result => {
        if (result && result.element) {
            cartItemsContainer.appendChild(result.element);
            finalTotal += result.subtotal; // Use the subtotal calculated during fetch
        }
    });

    // Update summary
    summarySubtotalEl.textContent = formatIndianCurrency(finalTotal);
    summaryTotalEl.textContent = formatIndianCurrency(finalTotal); // Assuming no other charges for now

    // Add empty message if needed (though initial check should cover this)
     if (cartItemsContainer.children.length === 0 && emptyCartMessage) {
         emptyCartMessage.style.display = 'block';
          if (cartSuggestions) cartSuggestions.style.display = 'block';
           if (orderForm) orderForm.style.display = 'none';
     }

}

/**
 * Handles removing an item from the cart.
 */
function handleRemoveItem(productId) {
    console.log(`Removing item: ${productId}`);
    removeFromCart(productId); // Function from cart.js
    renderCartItems(); // Re-render the cart
    updateCartCount(); // Update header count
}

/**
 * Handles changing item quantity.
 */
function handleQuantityChange(productId, newQuantity) {
     if (isNaN(newQuantity) || newQuantity < 1) {
         // Optionally reset to 1 or show an error
         console.warn(`Invalid quantity ${newQuantity} for product ${productId}. Setting to 1.`);
         newQuantity = 1;
     }
     console.log(`Updating quantity for item: ${productId} to ${newQuantity}`);
     updateCartItemQuantity(productId, newQuantity); // Function from cart.js
     renderCartItems(); // Re-render the cart to update subtotals
     updateCartCount(); // Update header count (total items might change)
}


/**
 * Handles the order form submission.
 */
async function handleOrderSubmit(event) {
    event.preventDefault(); // Prevent default form submission
    if (!submitButton || !orderForm) return;

    // Disable button and show loading state
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing Order...';
    if (orderStatusDiv) orderStatusDiv.style.display = 'none'; // Hide previous messages

    // 1. Get cart items for the order
    const cartItemsForOrder = getCart(); // Get current cart state
    if (cartItemsForOrder.length === 0) {
        alert("Your cart is empty. Please add items before placing an order.");
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-check-circle"></i> Place Order';
        return;
    }

    // --- Fetch Full Product Details for Order ---
    // It's better to save more details in the order than just ID/Qty
    // Fetch details again to ensure accuracy at the time of order
    const itemsWithDetails = [];
    let orderTotalAmount = 0;
    try {
        for (const item of cartItemsForOrder) {
            const productRef = doc(db, "onlineProducts", item.productId);
            const productSnap = await getDoc(productRef);
            if (productSnap.exists()) {
                const productData = productSnap.data();
                const price = parseFloat(productData.pricing?.rate || 0); // Adjust price logic if needed
                const itemSub = price * item.quantity;
                itemsWithDetails.push({
                    productId: item.productId,
                    quantity: item.quantity,
                    name: productData.productName || 'N/A', // Save name
                    unitPrice: price, // Save unit price at time of order
                    subtotal: itemSub
                    // Add other details like type, dimensions if needed/available
                });
                orderTotalAmount += itemSub;
            } else {
                // Handle case where a product in cart no longer exists
                throw new Error(`Product with ID ${item.productId} not found.`);
            }
        }
    } catch (error) {
         console.error("Error fetching product details for order:", error);
         if (orderStatusDiv) {
             orderStatusDiv.innerHTML = `<p>Error preparing order: ${error.message}. Please refresh and try again.</p>`;
             orderStatusDiv.className = 'error';
             orderStatusDiv.style.display = 'block';
         }
         submitButton.disabled = false;
         submitButton.innerHTML = '<i class="fas fa-check-circle"></i> Place Order';
         return; // Stop submission
    }


    // 2. Create order data object
    const orderData = {
        customerName: document.getElementById('customer-name').value,
        customerContact: document.getElementById('customer-contact').value,
        customerAddress: document.getElementById('customer-address').value,
        specialInstructions: document.getElementById('special-instructions').value,
        // File upload handling needs separate logic (upload to Firebase Storage, get URL)
        // designFileUrl: uploadedFileUrl || null,
        items: itemsWithDetails, // Save detailed items
        totalAmount: orderTotalAmount, // Use calculated total
        orderStatus: 'Pending Confirmation',
        createdAt: serverTimestamp()
    };

    try {
        // 3. Save order to Firebase 'online_orders' collection
        const ordersCollectionRef = collection(db, "online_orders");
        const docRef = await addDoc(ordersCollectionRef, orderData);

        console.log("Order saved to 'online_orders' with ID: ", docRef.id);

        // 4. Display confirmation message
        displayConfirmationMessage(docRef.id, itemsWithDetails); // Pass detailed items

        // 5. Clear the cart from localStorage
        clearCart(); // Function from cart.js

        // 6. Update header cart count
        updateCartCount(); // Function from main.js


    } catch (error) {
        console.error("Error saving order to 'online_orders': ", error);
        if (orderStatusDiv) {
            orderStatusDiv.innerHTML = `<p>There was an error placing your order. Please try again. Error: ${error.message}</p>`;
            orderStatusDiv.className = 'error';
            orderStatusDiv.style.display = 'block';
        }
        // Re-enable button on error
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-check-circle"></i> Place Order';
    }
}

/**
 * Displays the order confirmation message with WhatsApp button.
 */
function displayConfirmationMessage(orderId, orderedItems) {

    if (orderStatusDiv && orderForm && cartItemsSection) {
        // 1. Confirmation Message HTML
        let confirmationMessageHTML = `
            <h4>ऑर्डर देने के लिए धन्यवाद!</h4>
            <p>आपका ऑर्डर सफलतापूर्वक दर्ज हो गया है (Order ID: <strong>${orderId}</strong>)। हमारी टीम जल्द ही आपसे संपर्क करेगी।</p>
            <p>कृपया अपने डिज़ाइन, फोटो, या ऑर्डर से संबंधित कोई अन्य जानकारी नीचे दिए गए बटन पर क्लिक करके हमें WhatsApp पर भेजें:</p>
        `;

        // 2. Create WhatsApp pre-filled text
        let whatsappText = `Order ID: ${orderId}\n\nProduct Details:\n`;
        orderedItems.forEach(item => {
            // Using the name saved in the order data
            whatsappText += `- ${item.name} x ${item.quantity}\n`;
        });
        whatsappText += '\nPlease find my design/details attached.';

        // 3. Create WhatsApp URL (Encode the text)
        const whatsappUrl = `https://wa.me/919549116541?text=${encodeURIComponent(whatsappText)}`;

        // 4. Add WhatsApp button HTML
        confirmationMessageHTML += `
            <a href="${whatsappUrl}" target="_blank" class="button-whatsapp">
                <i class="fab fa-whatsapp"></i> WhatsApp पर डिज़ाइन भेजें (9549116541)
            </a>
        `;

        // 5. Display the message and button
        orderStatusDiv.innerHTML = confirmationMessageHTML;
        orderStatusDiv.className = 'success'; // Apply success styling
        orderStatusDiv.style.display = 'block';

        // 6. Hide the form and cart items section
        orderForm.style.display = 'none';
        cartItemsSection.style.display = 'none';
    } else {
        console.error("Could not find necessary elements to display confirmation message.");
        // Fallback alert maybe?
        alert(`Order ${orderId} placed successfully! Please contact us on WhatsApp at 9549116541 with your design details.`);
    }
}


// --- Initialize Page ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Cart page loaded. Rendering items...");
    renderCartItems(); // Initial render of cart items

    // Add form submit listener
    if (orderForm) {
        orderForm.addEventListener('submit', handleOrderSubmit);
    } else {
        console.error("Order form not found!");
    }
});