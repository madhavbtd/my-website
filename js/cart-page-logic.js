// js/cart-page-logic.js

// --- Imports ---
// Firebase और Firestore फंक्शन्स इम्पोर्ट करें
import { db } from './firebase-config.js';
import { doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// cart.js से आवश्यक फंक्शन्स इम्पोर्ट करें
import { getCart, removeFromCart, updateCartItemQuantity, clearCart } from './cart.js';

// main.js से हेडर कार्ट काउंट अपडेट फंक्शन इम्पोर्ट करें (यदि उपलब्ध है)
// import { updateCartCount } from './main.js';
// यदि updateCartCount main.js में नहीं है या एक्सपोर्ट नहीं किया गया है, तो आपको इसे हैंडल करने का तरीका एडजस्ट करना होगा।
// अस्थायी समाधान के लिए, आप इसे कमेंट कर सकते हैं और सीधे localStorage से काउंट पढ़ सकते हैं।
function updateCartCountFallback() {
    const cart = getCart();
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
const orderStatusDiv = document.getElementById('order-status-message');
const submitButton = document.getElementById('submit-order-btn');
const cartItemsSection = document.getElementById('cart-items-section');

// --- Helper Functions ---
const formatIndianCurrency = (amount) => {
    const num = Number(amount);
    return isNaN(num) ? '₹ 0.00' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// --- Main Logic ---

/**
 * Renders cart items by fetching details from Firebase.
 */
async function renderCartItems() {
    // Check if essential DOM elements exist
    if (!cartItemsContainer || !summarySubtotalEl || !summaryTotalEl) {
        console.error("Cart page critical DOM elements not found!");
        return;
    }
     // Ensure empty message template exists, even if inside cartItemsContainer
    const emptyCartMessageTemplate = document.querySelector('.empty-cart-message');


    const cart = getCart(); // Get cart from localStorage
    cartItemsContainer.innerHTML = ''; // Clear previous items
    if(emptyCartMessageTemplate) emptyCartMessageTemplate.style.display = 'none'; // Hide template initially
    if (cartSuggestions) cartSuggestions.style.display = 'none';

    if (cart.length === 0) {
        // Use the template or create the message if template doesn't exist
        if (emptyCartMessageTemplate) {
             emptyCartMessageTemplate.style.display = 'block';
        } else {
            cartItemsContainer.innerHTML = '<p class="empty-cart-message">Your cart is currently empty. <a href="products.html">Continue Shopping</a></p>';
        }

        if (cartSuggestions) cartSuggestions.style.display = 'block';
        summarySubtotalEl.textContent = formatIndianCurrency(0);
        summaryTotalEl.textContent = formatIndianCurrency(0);
        if (orderForm) orderForm.style.display = 'none';
        if (cartItemsSection) cartItemsSection.style.display = 'block'; // Keep section visible for message
        return;
    }

    if (orderForm) orderForm.style.display = 'block'; // Show form if cart has items
    if (cartItemsSection) cartItemsSection.style.display = 'block'; // Ensure section is visible

    let subtotal = 0;
    const itemPromises = cart.map(async (item) => {
        try {
            // *** महत्वपूर्ण: सुनिश्चित करें 'onlineProducts' आपके फायरबेस कलेक्शन का सही नाम है ***
            const productRef = doc(db, "onlineProducts", item.productId);
            const productSnap = await getDoc(productRef);

            if (productSnap.exists()) {
                const productData = productSnap.data();
                // *** महत्वपूर्ण: सुनिश्चित करें ये फ़ील्ड नाम आपके प्रोडक्ट डेटा से मेल खाते हैं ***
                const productName = productData.productName || 'Product Name Unavailable';
                const imageUrl = (productData.imageUrls && productData.imageUrls[0]) ? productData.imageUrls[0] : 'images/placeholder.png';
                // *** कीमत निर्धारण लॉजिक: यह साधारण रेट मानता है। जटिल उत्पादों के लिए एडजस्ट करें ***
                const itemPrice = parseFloat(productData.pricing?.rate || 0);
                const itemQuantity = item.quantity;
                const itemSubtotal = itemPrice * itemQuantity;

                const itemElement = document.createElement('div');
                itemElement.className = 'cart-item';
                itemElement.dataset.productId = item.productId;

                // HTML संरचना (जैसा cart.html में उदाहरण दिया गया है)
                itemElement.innerHTML = `
                    <img src="${imageUrl}" alt="${productName}">
                    <div class="item-details">
                        <h4><a href="product-detail.html?id=${item.productId}">${productName}</a></h4>
                        <p class="item-price">Unit Price: ${formatIndianCurrency(itemPrice)}</p>
                        <div class="item-quantity">
                            <label for="qty-${item.productId}">Quantity:</label>
                            <input type="number" id="qty-${item.productId}" value="${itemQuantity}" min="1" class="item-qty-input" aria-label="Item Quantity" data-product-id="${item.productId}">
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <button class="remove-item-btn" aria-label="Remove item" data-product-id="${item.productId}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        <p class="item-subtotal">Subtotal: ${formatIndianCurrency(itemSubtotal)}</p>
                    </div>
                `;
                return { element: itemElement, subtotal: itemSubtotal };
            } else {
                console.warn(`Product details not found for ID: ${item.productId}`);
                // गुम हुए प्रोडक्ट के लिए प्लेसहोल्डर दिखाएं
                 const itemElement = document.createElement('div');
                 itemElement.className = 'cart-item unavailable';
                 itemElement.innerHTML = `
                     <img src="images/placeholder.png" alt="Product unavailable">
                     <div class="item-details">
                         <h4>Product Unavailable (ID: ${item.productId})</h4>
                         <p class="item-options">This item might have been removed.</p>
                     </div>
                     <div style="text-align: right;">
                        <button class="remove-item-btn" aria-label="Remove item" data-product-id="${item.productId}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>`;
                 return { element: itemElement, subtotal: 0 }; // No subtotal for unavailable items
            }
        } catch (error) {
            console.error(`Error fetching details for product ${item.productId}:`, error);
            return null; // Handle error for individual item fetch
        }
    });

    const renderedResults = await Promise.all(itemPromises);

    let finalTotal = 0;
    renderedResults.forEach(result => {
        if (result && result.element) {
            cartItemsContainer.appendChild(result.element);
            finalTotal += result.subtotal;
        }
    });

    // Update summary
    summarySubtotalEl.textContent = formatIndianCurrency(finalTotal);
    summaryTotalEl.textContent = formatIndianCurrency(finalTotal); // Adjust if shipping/discounts added

    // Add event listeners using event delegation AFTER items are in the DOM
    addCartItemListeners();

     // Final check for empty cart message (if all fetches failed)
     if (cartItemsContainer.children.length === 0 && emptyCartMessageTemplate) {
         emptyCartMessageTemplate.style.display = 'block';
         if (cartSuggestions) cartSuggestions.style.display = 'block';
         if (orderForm) orderForm.style.display = 'none';
     }
}

/**
 * Add event listeners to cart items using event delegation.
 */
function addCartItemListeners() {
    if (!cartItemsContainer) return;

    cartItemsContainer.addEventListener('click', (event) => {
        // Handle remove button click
        if (event.target.closest('.remove-item-btn')) {
            const button = event.target.closest('.remove-item-btn');
            const productId = button.dataset.productId;
            if (productId) {
                handleRemoveItem(productId);
            }
        }
    });

    cartItemsContainer.addEventListener('change', (event) => {
        // Handle quantity input change
        if (event.target.classList.contains('item-qty-input')) {
            const input = event.target;
            const productId = input.dataset.productId;
            let newQuantity = parseInt(input.value, 10);
            if (productId) {
                 if (isNaN(newQuantity) || newQuantity < 1) {
                    newQuantity = 1; // Reset to 1 if invalid
                    input.value = newQuantity; // Update input field visually
                 }
                handleQuantityChange(productId, newQuantity);
            }
        }
    });
}


/**
 * Handles removing an item.
 */
function handleRemoveItem(productId) {
    console.log(`Removing item: ${productId}`);
    removeFromCart(productId);
    renderCartItems();
    updateCartCountFallback(); // Use fallback or imported function
}

/**
 * Handles changing item quantity.
 */
function handleQuantityChange(productId, newQuantity) {
     console.log(`Updating quantity for item: ${productId} to ${newQuantity}`);
     updateCartItemQuantity(productId, newQuantity);
     renderCartItems(); // Re-render to update totals
     updateCartCountFallback(); // Use fallback or imported function
}


/**
 * Handles the order form submission.
 */
async function handleOrderSubmit(event) {
    event.preventDefault();
    if (!submitButton || !orderForm) return;

    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing Order...';
    if (orderStatusDiv) orderStatusDiv.style.display = 'none';

    const cartItemsForOrder = getCart();
    if (cartItemsForOrder.length === 0) {
        alert("Your cart is empty.");
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-check-circle"></i> Place Order';
        return;
    }

    // Fetch details again to save accurate data in the order
    const itemsWithDetails = [];
    let orderTotalAmount = 0;
    let fetchError = false;
    try {
        for (const item of cartItemsForOrder) {
            // *** ADJUST 'onlineProducts' if needed ***
            const productRef = doc(db, "onlineProducts", item.productId);
            const productSnap = await getDoc(productRef);
            if (productSnap.exists()) {
                const productData = productSnap.data();
                // *** ADJUST price logic if needed ***
                const price = parseFloat(productData.pricing?.rate || 0);
                const itemSub = price * item.quantity;
                itemsWithDetails.push({
                    productId: item.productId,
                    quantity: item.quantity,
                    name: productData.productName || 'N/A',
                    unitPrice: price,
                    subtotal: itemSub
                });
                orderTotalAmount += itemSub;
            } else {
                 throw new Error(`Product with ID ${item.productId} not found.`);
            }
        }
    } catch (error) {
         fetchError = true;
         console.error("Error fetching product details for order:", error);
         if (orderStatusDiv) {
             orderStatusDiv.innerHTML = `<p>Error preparing order: ${error.message}. Please refresh cart.</p>`;
             orderStatusDiv.className = 'error';
             orderStatusDiv.style.display = 'block';
         }
    }

    if (fetchError) {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-check-circle"></i> Place Order';
        return; // Stop if details couldn't be fetched
    }

    // Create order data object
    const orderData = {
        customerName: document.getElementById('customer-name').value,
        customerContact: document.getElementById('customer-contact').value,
        customerAddress: document.getElementById('customer-address').value,
        specialInstructions: document.getElementById('special-instructions').value,
        items: itemsWithDetails,
        totalAmount: orderTotalAmount,
        orderStatus: 'Pending Confirmation',
        createdAt: serverTimestamp()
    };

    try {
        // *** सेव करने के लिए कलेक्शन का नाम 'online_orders' ***
        const ordersCollectionRef = collection(db, "online_orders");
        const docRef = await addDoc(ordersCollectionRef, orderData);
        console.log("Order saved to 'online_orders' with ID: ", docRef.id);

        displayConfirmationMessage(docRef.id, itemsWithDetails); // Display success message
        clearCart(); // Clear localStorage cart
        updateCartCountFallback(); // Update header count

    } catch (error) {
        console.error("Error saving order:", error);
        if (orderStatusDiv) {
            orderStatusDiv.innerHTML = `<p>Error placing order. Please try again. Error: ${error.message}</p>`;
            orderStatusDiv.className = 'error';
            orderStatusDiv.style.display = 'block';
        }
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-check-circle"></i> Place Order';
    }
}

/**
 * Displays the order confirmation message with WhatsApp button.
 */
function displayConfirmationMessage(orderId, orderedItems) {
    if (!orderStatusDiv || !orderForm || !cartItemsSection) {
        console.error("Cannot display confirmation: Missing key elements.");
        // Fallback alert
        alert(`Order ${orderId} placed successfully! Please WhatsApp us at 9549116541 with your design details, mentioning Order ID ${orderId}.`);
        // Try hiding form/cart anyway
        if(orderForm) orderForm.style.display = 'none';
        if(cartItemsSection) cartItemsSection.style.display = 'none';
        return;
    }

    let confirmationMessageHTML = `
        <h4>ऑर्डर देने के लिए धन्यवाद!</h4>
        <p>आपका ऑर्डर सफलतापूर्वक दर्ज हो गया है (Order ID: <strong>${orderId}</strong>)। हमारी टीम जल्द ही आपसे संपर्क करेगी।</p>
        <p>कृपया अपने डिज़ाइन, फोटो, या ऑर्डर से संबंधित कोई अन्य जानकारी नीचे दिए गए बटन पर क्लिक करके हमें WhatsApp पर भेजें:</p>
    `;

    let whatsappText = `Order ID: ${orderId}\n\nItems:\n`;
    orderedItems.forEach(item => {
        whatsappText += `- ${item.name} x ${item.quantity}\n`;
    });
    whatsappText += '\nPlease find my design/details attached.';

    const whatsappUrl = `https://wa.me/919549116541?text=${encodeURIComponent(whatsappText)}`;

    confirmationMessageHTML += `
        <a href="${whatsappUrl}" target="_blank" class="button-whatsapp">
            <i class="fab fa-whatsapp"></i> WhatsApp पर डिज़ाइन भेजें (9549116541)
        </a>
    `;

    orderStatusDiv.innerHTML = confirmationMessageHTML;
    orderStatusDiv.className = 'success';
    orderStatusDiv.style.display = 'block';

    // Hide form and cart items section
    orderForm.style.display = 'none';
    cartItemsSection.style.display = 'none';
}

// --- Initialize Page ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Cart page logic initializing...");
    renderCartItems(); // Render cart on page load

    if (orderForm) {
        orderForm.addEventListener('submit', handleOrderSubmit);
    } else {
        console.error("Order form element not found!");
    }
});

console.log("cart-page-logic.js loaded");