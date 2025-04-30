// js/cart-page-logic.js

// --- Imports ---
// Firebase और Firestore फंक्शन्स इम्पोर्ट करें
import { db } from './firebase-config.js';
import { doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// cart.js से आवश्यक फंक्शन्स इम्पोर्ट करें
import { getCart, removeFromCart, updateCartItemQuantity, clearCart } from './cart.js';

// main.js से हेडर कार्ट काउंट अपडेट फंक्शन इम्पोर्ट करें (Fallback)
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
const emptyCartMessage = cartItemsContainer?.querySelector('.empty-cart-message'); // HTML में टेम्पलेट मौजूद होना चाहिए
const cartSuggestions = document.querySelector('.cart-suggestions'); // Ensure this element exists
const orderForm = document.getElementById('order-form');
const cartSummarySubtotal = document.getElementById('summary-subtotal');
const cartSummaryTotal = document.getElementById('summary-total');
const cartItemsSection = document.getElementById('cart-items-section'); // Confirmation के बाद छिपाने के लिए


// --- Functions ---

/**
 * कार्ट आइटम्स को पेज पर रेंडर करने के लिए फंक्शन
 */
function renderCartItems() {
    const cart = getCart();
    cartItemsContainer.innerHTML = ''; // Clear previous items

    if (!cart || cart.length === 0) {
        if (emptyCartMessage) {
            emptyCartMessage.style.display = 'block';
        }
        if (cartSuggestions) {
            cartSuggestions.style.display = 'block'; // Show suggestions if cart is empty
        }
         if (orderForm) { // Hide order form if cart is empty
             orderForm.style.display = 'none';
         }
        updateCartSummary(0); // Update summary to zero
        return;
    }

    // If cart has items, ensure form and suggestions are correctly displayed/hidden
     if (emptyCartMessage) emptyCartMessage.style.display = 'none';
     if (cartSuggestions) cartSuggestions.style.display = 'none';
     if (orderForm) orderForm.style.display = 'block'; // Show order form

    let currentSubtotal = 0;

    cart.forEach(item => {
        // Validate item structure (basic)
        if (!item || !item.productId || !item.name || typeof item.price !== 'number' || typeof item.quantity !== 'number') {
            console.error("Invalid item found in cart:", item);
            // Optionally remove invalid item from cart here
            // removeFromCart(item.productId);
            return; // Skip rendering this invalid item
        }

        const itemSubtotal = item.price * item.quantity;
        currentSubtotal += itemSubtotal;

        const itemElement = document.createElement('div');
        itemElement.classList.add('cart-item');
        itemElement.setAttribute('data-product-id', item.productId); // Add data attribute

        // Default image if none provided
        const imageUrl = item.image && item.image !== 'undefined' && item.image !== 'null' ? item.image : 'img/placeholder.png'; // Use a placeholder

        itemElement.innerHTML = `
            <img src="${imageUrl}" alt="${item.name}" onerror="this.onerror=null;this.src='img/placeholder.png';">
            <div class="item-details">
                <h4><a href="product-detail.html?id=${item.productId}">${item.name}</a></h4>
                <p class="item-price">Unit Price: ₹${item.price.toFixed(2)}</p>
                 <div class="item-quantity">
                    <label for="qty-${item.productId}">Quantity:</label>
                    <input type="number" id="qty-${item.productId}" class="item-qty-input" value="${item.quantity}" min="1" data-product-id="${item.productId}">
                 </div>
            </div>
            <div>
                 <p class="item-subtotal">Subtotal: ₹${itemSubtotal.toFixed(2)}</p>
                 <button class="button-danger remove-item-btn" data-product-id="${item.productId}" aria-label="Remove ${item.name}">
                    <i class="fas fa-trash-alt"></i>
                 </button>
            </div>
        `;

        // --- Event Listeners for Quantity Change and Remove Button ---
        const quantityInput = itemElement.querySelector('.item-qty-input');
        quantityInput.addEventListener('change', handleQuantityChange);
        quantityInput.addEventListener('input', handleQuantityChange); // Handle direct input too

        const removeButton = itemElement.querySelector('.remove-item-btn');
        removeButton.addEventListener('click', handleRemoveItem);

        cartItemsContainer.appendChild(itemElement);
    });

    updateCartSummary(currentSubtotal);
}

/**
 * मात्रा बदलने पर हैंडलर
 */
function handleQuantityChange(event) {
    const input = event.target;
    const productId = input.dataset.productId;
    let newQuantity = parseInt(input.value, 10);

    // Validate quantity
    if (isNaN(newQuantity) || newQuantity < 1) {
        newQuantity = 1; // Reset to 1 if invalid or less than 1
        input.value = newQuantity; // Update input field visually
    }

    updateCartItemQuantity(productId, newQuantity); // Update in localStorage
    renderCartItems(); // Re-render the entire cart to reflect changes
    updateCartCountFallback(); // Update header count
}

/**
 * आइटम हटाने पर हैंडलर
 */
function handleRemoveItem(event) {
    const button = event.currentTarget; // Use currentTarget for delegation
    const productId = button.dataset.productId;

    if (confirm(`Are you sure you want to remove this item from your cart?`)) {
        removeFromCart(productId); // Remove from localStorage
        renderCartItems(); // Re-render the cart
        updateCartCountFallback(); // Update header count
    }
}


/**
 * कार्ट सारांश (सबटोटल, टोटल) अपडेट करने के लिए फंक्शन
 */
function updateCartSummary(subtotal) {
    const formattedSubtotal = `₹${subtotal.toFixed(2)}`;
    const formattedTotal = `₹${subtotal.toFixed(2)}`; // Assuming no extra charges for now

    if (cartSummarySubtotal) cartSummarySubtotal.textContent = formattedSubtotal;
    if (cartSummaryTotal) cartSummaryTotal.textContent = formattedTotal;
}

/**
 * ऑर्डर स्टेटस मैसेज दिखाने के लिए फंक्शन
 */
function displayOrderStatus(message, type = 'info') { // type can be 'info', 'success', 'error'
    const orderStatusDiv = document.getElementById('order-status-message');
    if (!orderStatusDiv) return;

    orderStatusDiv.textContent = message;
    orderStatusDiv.className = ''; // Clear previous classes
    if (type === 'success') {
        orderStatusDiv.classList.add('success'); // Add success class (defined in CSS/HTML style)
    } else if (type === 'error') {
        orderStatusDiv.classList.add('error'); // Add error class (defined in CSS/HTML style)
    } else {
         orderStatusDiv.classList.add('info'); // Default or neutral info style
    }
    orderStatusDiv.style.display = 'block';
}


/**
 * ऑर्डर सबमिट करने के लिए फंक्शन
 */
async function handleOrderSubmit(event) {
    event.preventDefault(); // डिफ़ॉल्ट फॉर्म सबमिशन रोकें

    const submitButton = document.getElementById('submit-order-btn');
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    const orderStatusDiv = document.getElementById('order-status-message');
    orderStatusDiv.style.display = 'none'; // पिछले संदेश छिपाएं

    // --- ग्राहक विवरण प्राप्त करें ---
    const customerNameInput = document.getElementById('customer-name');
    const customerContactInput = document.getElementById('customer-contact');
    const customerAddressInput = document.getElementById('customer-address');

    const customerName = customerNameInput?.value.trim();
    const customerContact = customerContactInput?.value.trim();
    const customerAddress = customerAddressInput?.value.trim();

    // --- बुनियादी सत्यापन ---
    if (!customerName || !customerContact || !customerAddress) {
        console.error("Validation failed: Missing required fields.");
        displayOrderStatus("Please fill in all required fields (Name, Contact, Address).", 'error');
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-check-circle"></i> Place Order';
        // पहले अमान्य फ़ील्ड पर स्क्रॉल करें (वैकल्पिक सुधार)
        if (!customerName) customerNameInput?.focus();
        else if (!customerContact) customerContactInput?.focus();
        else if (!customerAddress) customerAddressInput?.focus();
        return; // सबमिशन रोकें
    }

    // --- कार्ट आइटम्स प्राप्त करें ---
    const cart = getCart();
    if (cart.length === 0) {
        displayOrderStatus("Your cart is empty. Please add items before placing an order.", 'error');
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-check-circle"></i> Place Order';
        return; // यदि कार्ट खाली है तो सबमिशन रोकें
    }

    // --- ऑर्डर डेटा तैयार करें ---
    const orderItems = cart.map(item => ({
        productId: item.productId,
        name: item.name,
        price: item.price, // Use the price stored in the cart
        quantity: item.quantity,
        subtotal: item.price * item.quantity, // Calculate subtotal based on cart price
        type: item.type || 'Standard', // प्रकार शामिल करें यदि उपलब्ध हो
        image: item.image || '' // छवि URL शामिल करें यदि उपलब्ध हो
    }));

    // Calculate total from items in cart
    const orderTotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

    const orderData = {
        customerInfo: {
            name: customerName,
            contact: customerContact,
            address: customerAddress,
        },
        items: orderItems,
        subtotal: orderTotal,
        totalAmount: orderTotal, // अभी के लिए कोई अतिरिक्त शुल्क नहीं
        orderStatus: 'Pending', // प्रारंभिक स्थिति
        orderTimestamp: serverTimestamp(), // Firestore सर्वर टाइमस्टैम्प का उपयोग करें
        paymentStatus: 'Pending' // डिफ़ॉल्ट भुगतान स्थिति
    };

    console.log("Order Data Prepared:", orderData);

    // --- Firestore में ऑर्डर सेव करें ---
    try {
        const ordersCollectionRef = collection(db, "online_orders");
        const docRef = await addDoc(ordersCollectionRef, orderData);
        console.log("Order successfully saved with ID: ", docRef.id);

        // सफलता संदेश और WhatsApp बटन दिखाएं
        displayOrderConfirmation(docRef.id, orderItems); // ऑर्डर ID और आइटम पास करें

        // सफल ऑर्डर के बाद कार्ट साफ़ करें
        clearCart();
        updateCartCountFallback(); // हेडर काउंट अपडेट करें

        // वैकल्पिक रूप से, पुष्टि संदेश पर स्क्रॉल करें
        orderStatusDiv.scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        console.error("Error saving order: ", error);
        let errorMessage = "An error occurred while placing your order. Please try again.";
        if (error.message && error.message.includes("Missing or insufficient permissions")) {
             errorMessage = "Order could not be placed due to a permissions issue. Please contact support.";
        } else if (error.message) {
            errorMessage += ` Details: ${error.message}`;
        }
        displayOrderStatus(errorMessage, 'error');

        // त्रुटि होने पर बटन फिर से सक्षम करें
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-check-circle"></i> Place Order';
    }
}


/**
 * ऑर्डर कन्फर्मेशन मैसेज (WhatsApp लिंक के साथ) दिखाने का फंक्शन
 */
function displayOrderConfirmation(orderId, orderedItems) {
    const orderStatusDiv = document.getElementById('order-status-message');
    if (!orderStatusDiv || !orderForm || !cartItemsSection) return;

    let confirmationMessageHTML = `
        <h4><i class="fas fa-check-circle"></i> Order Placed Successfully!</h4>
        <p>आपका ऑर्डर सफलतापूर्वक दर्ज हो गया है (Order ID: <strong>${orderId}</strong>)। हमारी टीम जल्द ही आपसे संपर्क करेगी।</p>
        <p>कृपया अपने डिज़ाइन, फोटो, या ऑर्डर से संबंधित कोई अन्य जानकारी नीचे दिए गए बटन पर क्लिक करके हमें WhatsApp पर भेजें:</p>
    `;

    // Prepare WhatsApp message text
    let whatsappText = `Order ID: ${orderId}\n\nItems:\n`;
    orderedItems.forEach(item => {
        whatsappText += `- ${item.name} (Qty: ${item.quantity})\n`;
    });
    whatsappText += '\nPlease find my design/details attached.';

    const whatsappNumber = '919549116541'; // आपका WhatsApp नंबर
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappText)}`;

    confirmationMessageHTML += `
        <a href="${whatsappUrl}" target="_blank" class="button-whatsapp">
            <i class="fab fa-whatsapp"></i> WhatsApp पर डिज़ाइन भेजें (${whatsappNumber})
        </a>
    `;

    orderStatusDiv.innerHTML = confirmationMessageHTML;
    orderStatusDiv.className = 'success'; // Style for success
    orderStatusDiv.style.display = 'block';

    // Hide form and cart items section after successful order
    orderForm.style.display = 'none';
    cartItemsSection.style.display = 'none';

    // Also hide the main H1 title "Shopping Cart" to avoid confusion
    const mainTitle = document.querySelector('.cart-page > h1');
    if (mainTitle) {
        mainTitle.style.display = 'none';
    }
}


// --- Initialize Page ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Cart page logic initializing...");
    renderCartItems(); // पेज लोड पर कार्ट रेंडर करें

    // ऑर्डर फॉर्म सबमिशन हैंडलर जोड़ें
    if (orderForm) {
        orderForm.addEventListener('submit', handleOrderSubmit);
    } else {
        console.error("Order form not found!");
    }

    // कार्ट अपडेट होने पर री-रेंडर करने के लिए इवेंट श्रोता (वैकल्पिक)
    document.addEventListener('cartUpdated', renderCartItems);

    console.log("Cart page logic loaded.");
});