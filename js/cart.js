// js/cart.js - Updated with getCart export

// --- localStorage Key ---
const CART_STORAGE_KEY = 'madhavMultiprintCart'; // Using this key consistently

// --- Helper Functions (Not Exported, used internally) ---

// Cart को localStorage में सेव करने के लिए फंक्शन
function saveCart(cartData) {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartData));
    } catch (error) {
        console.error("Error saving cart to localStorage:", error);
        // Optionally notify the user or implement fallback
    }
}

// --- Exported Functions ---

/**
 * localStorage से कार्ट प्राप्त करने के लिए फंक्शन
 * @returns {Array} Cart items array or empty array
 */
export function getCart() { // <<<--- EXPORT जोड़ा गया
    try {
        const cart = localStorage.getItem(CART_STORAGE_KEY);
        return cart ? JSON.parse(cart) : [];
    } catch (error) {
        console.error("Error reading cart from localStorage:", error);
        return []; // Return empty array on error
    }
}

/**
 * कार्ट में प्रोडक्ट जोड़ने या मात्रा अपडेट करने के लिए फंक्शन
 * @param {string} productId - प्रोडक्ट का ID
 * @param {number} quantity - जोड़ने वाली मात्रा
 * @param {object} [options={}] - (वैकल्पिक) प्रोडक्ट के अन्य विवरण (जैसे कीमत, प्रकार)
 */
export function addToCart(productId, quantity, options = {}) { // Options जोड़ा गया (वैकल्पिक उपयोग के लिए)
    if (!productId || !quantity || quantity < 1) {
        console.error("addToCart: Invalid product ID or quantity.");
        return;
    }

    const cart = getCart();
    const numericQuantity = parseInt(quantity, 10);

    const existingProductIndex = cart.findIndex(item => item.productId === productId);

    if (existingProductIndex > -1) {
        // अपडेट मात्रा
        cart[existingProductIndex].quantity += numericQuantity;
        // आप चाहें तो options भी अपडेट कर सकते हैं
        if (options && Object.keys(options).length > 0) {
             cart[existingProductIndex].options = { ...(cart[existingProductIndex].options || {}), ...options };
        }
        console.log(`Product ${productId} quantity updated to ${cart[existingProductIndex].quantity}.`);
    } else {
        // नया आइटम जोड़ें
        const newItem = { productId, quantity: numericQuantity };
         if (options && Object.keys(options).length > 0) {
            newItem.options = options;
         }
        cart.push(newItem);
        console.log(`Product ${productId} added to cart.`);
    }

    saveCart(cart);
    // कार्ट अपडेट इवेंट भेजें
    document.dispatchEvent(new CustomEvent('cartUpdated'));
}

/**
 * कार्ट में कुल आइटम्स की संख्या प्राप्त करने के लिए फंक्शन
 * @returns {number} Total number of items (sum of quantities)
 */
export function getCartItemCount() {
    const cart = getCart();
    return cart.reduce((total, item) => total + (item.quantity || 0), 0);
}

/**
 * कार्ट से किसी आइटम को हटाने के लिए फंक्शन
 * @param {string} productId - हटाने वाले प्रोडक्ट का ID
 */
export function removeFromCart(productId) {
    let cart = getCart();
    const initialLength = cart.length;
    cart = cart.filter(item => item.productId !== productId);

    if (cart.length < initialLength) {
        saveCart(cart);
        console.log(`Product ${productId} removed from cart.`);
        document.dispatchEvent(new CustomEvent('cartUpdated'));
    } else {
        console.warn(`removeFromCart: Product ${productId} not found.`);
    }
}

/**
 * कार्ट में किसी आइटम की मात्रा अपडेट करने के लिए फंक्शन
 * @param {string} productId - अपडेट करने वाले प्रोडक्ट का ID
 * @param {number} quantity - नई मात्रा (0 होने पर आइटम हट जाएगा)
 */
export function updateCartItemQuantity(productId, quantity) {
    const numericQuantity = parseInt(quantity, 10);
    if (!productId || isNaN(numericQuantity) || numericQuantity < 0) {
        console.error("updateCartItemQuantity: Invalid product ID or quantity.");
        return;
    }

    let cart = getCart();
    const itemIndex = cart.findIndex(item => item.productId === productId);

    if (itemIndex > -1) {
        if (numericQuantity === 0) {
            cart.splice(itemIndex, 1); // मात्रा 0 होने पर हटाएं
            console.log(`Product ${productId} removed due to zero quantity.`);
        } else {
            cart[itemIndex].quantity = numericQuantity; // मात्रा अपडेट करें
            console.log(`Product ${productId} quantity updated to ${numericQuantity}.`);
        }
        saveCart(cart);
        document.dispatchEvent(new CustomEvent('cartUpdated'));
    } else {
        console.warn(`updateCartItemQuantity: Product ${productId} not found.`);
    }
}

/**
 * पूरे कार्ट को खाली करने के लिए फंक्शन
 */
export function clearCart() {
    saveCart([]); // खाली ऐरे सेव करें
    console.log("Cart cleared.");
    document.dispatchEvent(new CustomEvent('cartUpdated'));
}

// --- Log on Load ---
console.log("cart.js loaded and functions exported.");