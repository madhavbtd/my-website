// js/cart.js

// --- महत्वपूर्ण नोट ---
// आपकी main.js फ़ाइल में भी getCart और saveCart फंक्शन हैं,
// लेकिन वे 'shoppingCart' नाम की localStorage key का उपयोग करते हैं।
// यह cart.js 'madhavMultiprintCart' key का उपयोग करता है।
// आपको पूरी वेबसाइट पर *एक ही* key और *एक ही* फंक्शन सेट का उपयोग करना चाहिए
// ताकि कन्फ्यूजन न हो। सुझाव है कि आप cart.js वाले फंक्शन्स का उपयोग करें
// और main.js से डुप्लिकेट फंक्शन्स हटा दें।

const CART_STORAGE_KEY = 'madhavMultiprintCart'; // localStorage key

// localStorage से कार्ट प्राप्त करने के लिए फंक्शन
function getCart() {
    const cart = localStorage.getItem(CART_STORAGE_KEY);
    // अगर कार्ट मौजूद है, तो उसे पार्स करें, वरना खाली ऐरे लौटाएं
    return cart ? JSON.parse(cart) : [];
}

// कार्ट को localStorage में सेव करने के लिए फंक्शन
function saveCart(cartData) {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartData));
     // आप चाहें तो यहाँ से भी सीधे कार्ट काउंट अपडेट कर सकते हैं,
     // या cartUpdated इवेंट पर निर्भर रह सकते हैं।
     // updateCartCount(); // अगर main.js से इम्पोर्ट किया है
}

// कार्ट में प्रोडक्ट जोड़ने के लिए फंक्शन (इसे एक्सपोर्ट करें)
// *** महत्वपूर्ण: यदि आप कीमत, नाम आदि कार्ट में स्टोर करना चाहते हैं, तो इस फंक्शन को संशोधित करें ***
// export function addToCart(productId, quantity, options = {}) { // options ऑब्जेक्ट जोड़ें
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
        // आप चाहें तो यहाँ options भी अपडेट कर सकते हैं
        // cart[existingProductIndex].options = { ...cart[existingProductIndex].options, ...options };
    } else {
        // यदि प्रोडक्ट नया है, तो उसे कार्ट में जोड़ें
        // cart.push({ productId, quantity: numericQuantity, options }); // options के साथ जोड़ें
         cart.push({ productId, quantity: numericQuantity }); // केवल ID और मात्रा
    }

    // अपडेटेड कार्ट को localStorage में सेव करें
    saveCart(cart);

    console.log(`Product ${productId} (qty: ${numericQuantity}) added/updated in cart.`);

    // कार्ट अपडेट होने पर कस्टम इवेंट डिस्पैच करें
    // ताकि अन्य स्क्रिप्ट्स (जैसे main.js या cart-page-logic.js) सुन सकें और UI अपडेट कर सकें
    document.dispatchEvent(new CustomEvent('cartUpdated'));

}

// कार्ट में कुल आइटम्स की संख्या प्राप्त करने के लिए फंक्शन (इसे एक्सपोर्ट करें)
// Note: This function might be better placed in main.js or used via cartUpdated event listener
export function getCartItemCount() {
    const cart = getCart();
    // सभी प्रोडक्ट्स की मात्राओं का योग करें
    return cart.reduce((total, item) => total + item.quantity, 0);
}

// कार्ट से किसी आइटम को हटाने के लिए फंक्शन (इसे एक्सपोर्ट करें)
export function removeFromCart(productId) {
    let cart = getCart();
    const initialLength = cart.length;
    cart = cart.filter(item => item.productId !== productId);

    if(cart.length < initialLength) { // Check if item was actually removed
        saveCart(cart);
        console.log(`Product ${productId} removed from cart.`);
        document.dispatchEvent(new CustomEvent('cartUpdated')); // UI अपडेट के लिए इवेंट
    } else {
        console.warn(`Product ${productId} not found in cart for removal.`);
    }
}

// कार्ट में किसी आइटम की मात्रा अपडेट करने के लिए फंक्शन (इसे एक्सपोर्ट करें)
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
            // मात्रा 0 है, तो आइटम हटाएं (या remove फंक्शन कॉल करें)
            cart.splice(itemIndex, 1);
            console.log(`Product ${productId} removed due to zero quantity.`);
        } else {
            // मात्रा अपडेट करें
            cart[itemIndex].quantity = numericQuantity;
            console.log(`Product ${productId} quantity updated to ${numericQuantity}.`);
        }
        saveCart(cart);
        document.dispatchEvent(new CustomEvent('cartUpdated')); // UI अपडेट के लिए इवेंट
    } else {
        console.warn(`Product ${productId} not found in cart for update.`);
    }
}

// --------------------------------------------------------------------
// --- पूरे कार्ट को खाली करने के लिए फंक्शन (इसे एक्सपोर्ट करें) ---
// --------------------------------------------------------------------
export function clearCart() { // <--- यह वह फंक्शन है जिसकी आवश्यकता है
    saveCart([]); // खाली ऐरे सेव करें
    console.log("Cart cleared.");
    document.dispatchEvent(new CustomEvent('cartUpdated')); // UI अपडेट के लिए इवेंट
}
// --------------------------------------------------------------------

// --- Initialization & Event Listener ---
// कार्ट अपडेट होने पर सुनने के लिए एक इवेंट लिसनर जोड़ना अच्छा अभ्यास है
// ताकि हेडर काउंट जैसी चीजें अपडेट हो सकें। main.js में यह लॉजिक हो सकता है।

// Example of how main.js could listen for updates:
/*
// In main.js:
import { updateCartCount } from './main.js'; // Or define updateCartCount in main.js

document.addEventListener('cartUpdated', () => {
    console.log('Cart updated event received in main.js');
    updateCartCount(); // Update header count whenever cart changes
});

// Initial load update (already likely in your main.js)
document.addEventListener('DOMContentLoaded', updateCartCount);
*/

console.log("cart.js loaded"); // पुष्टि के लिए कि फ़ाइल लोड हो गई है