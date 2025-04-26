// js/cart.js

// localStorage से कार्ट प्राप्त करने के लिए फंक्शन
function getCart() {
    const cart = localStorage.getItem('madhavMultiprintCart');
    // अगर कार्ट मौजूद है, तो उसे पार्स करें, वरना खाली ऐरे लौटाएं
    return cart ? JSON.parse(cart) : [];
}

// कार्ट को localStorage में सेव करने के लिए फंक्शन
function saveCart(cartData) {
    localStorage.setItem('madhavMultiprintCart', JSON.stringify(cartData));
}

// कार्ट में प्रोडक्ट जोड़ने के लिए फंक्शन (इसे एक्सपोर्ट करें)
export function addToCart(productId, quantity) {
    if (!productId || !quantity || quantity < 1) {
        console.error("Invalid product ID or quantity provided to addToCart.");
        return; // अमान्य इनपुट पर कुछ न करें
    }

    const cart = getCart();
    const numericQuantity = parseInt(quantity, 10); // सुनिश्चित करें कि मात्रा एक संख्या है

    // देखें कि क्या प्रोडक्ट पहले से कार्ट में है
    const existingProductIndex = cart.findIndex(item => item.productId === productId);

    if (existingProductIndex > -1) {
        // यदि प्रोडक्ट मौजूद है, तो मात्रा अपडेट करें
        cart[existingProductIndex].quantity += numericQuantity;
    } else {
        // यदि प्रोडक्ट नया है, तो उसे कार्ट में जोड़ें
        cart.push({ productId, quantity: numericQuantity });
    }

    // अपडेटेड कार्ट को localStorage में सेव करें
    saveCart(cart);

    console.log(`Product ${productId} (qty: ${numericQuantity}) added/updated in cart.`);

    // वैकल्पिक: कार्ट अपडेट होने पर कस्टम इवेंट डिस्पैच करें
    // ताकि अन्य स्क्रिप्ट्स (जैसे main.js) सुन सकें और UI अपडेट कर सकें
    document.dispatchEvent(new CustomEvent('cartUpdated'));

}

// कार्ट में कुल आइटम्स की संख्या प्राप्त करने के लिए फंक्शन (इसे एक्सपोर्ट करें)
export function getCartItemCount() {
    const cart = getCart();
    // सभी प्रोडक्ट्स की मात्राओं का योग करें
    return cart.reduce((total, item) => total + item.quantity, 0);
}

// कार्ट से किसी आइटम को हटाने के लिए फंक्शन (भविष्य के उपयोग के लिए)
export function removeFromCart(productId) {
    let cart = getCart();
    cart = cart.filter(item => item.productId !== productId);
    saveCart(cart);
    console.log(`Product ${productId} removed from cart.`);
    document.dispatchEvent(new CustomEvent('cartUpdated')); // UI अपडेट के लिए इवेंट
}

// कार्ट में किसी आइटम की मात्रा अपडेट करने के लिए फंक्शन (भविष्य के उपयोग के लिए)
export function updateCartItemQuantity(productId, quantity) {
    const numericQuantity = parseInt(quantity, 10);
    if (!productId || isNaN(numericQuantity) || numericQuantity < 0) {
        console.error("Invalid product ID or quantity for update.");
        return;
    }

    let cart = getCart();
    const itemIndex = cart.findIndex(item => item.productId === productId);

    if (itemIndex > -1) {
        if (numericQuantity === 0) {
            // मात्रा 0 है, तो आइटम हटाएं
            cart.splice(itemIndex, 1);
        } else {
            // मात्रा अपडेट करें
            cart[itemIndex].quantity = numericQuantity;
        }
        saveCart(cart);
        console.log(`Product ${productId} quantity updated to ${numericQuantity}.`);
        document.dispatchEvent(new CustomEvent('cartUpdated')); // UI अपडेट के लिए इवेंट
    } else {
        console.warn(`Product ${productId} not found in cart for update.`);
    }
}

// पूरे कार्ट को खाली करने के लिए फंक्शन (भविष्य के उपयोग के लिए)
export function clearCart() {
    saveCart([]); // खाली ऐरे सेव करें
    console.log("Cart cleared.");
    document.dispatchEvent(new CustomEvent('cartUpdated')); // UI अपडेट के लिए इवेंट
}

// --- Initialization ---
// जब यह स्क्रिप्ट लोड होती है, तो आप सुनिश्चित कर सकते हैं कि कार्ट काउंट अपडेट हो।
// हालाँकि, DOM एलिमेंट (#cart-count) को अपडेट करने का काम आमतौर पर main.js में होता है।
// main.js इस तरह का कोड इस्तेमाल कर सकता है:
/*
// --- Example for main.js ---
import { getCartItemCount } from './cart.js';

function updateHeaderCartCount() {
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
        const count = getCartItemCount();
        cartCountElement.textContent = count;
        console.log("Cart count updated in header:", count)
    }
}

// Initial load
document.addEventListener('DOMContentLoaded', updateHeaderCartCount);

// Listen for cart updates triggered by cart.js
document.addEventListener('cartUpdated', updateHeaderCartCount);

// Make sure updateCartCount is available if other scripts import it
export { updateHeaderCartCount as updateCartCount }; // Exporting with the expected name
*/

console.log("cart.js loaded"); // पुष्टि के लिए कि फ़ाइल लोड हो गई है