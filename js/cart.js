// js/cart.js - Updated with validation in addToCart

// --- localStorage Key ---
const CART_STORAGE_KEY = 'madhavMultiprintCart'; // Using this key consistently

// --- Helper Functions (Not Exported, used internally) ---

// Cart को localStorage में सेव करने के लिए फंक्शन
function saveCart(cartData) {
    try {
        // Filter out any null or undefined items just in case
        const validCartData = cartData.filter(item => item != null);
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(validCartData));
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
export function getCart() {
    try {
        const cartJson = localStorage.getItem(CART_STORAGE_KEY);
        if (!cartJson) {
            return []; // Return empty array if null or undefined
        }
        const cart = JSON.parse(cartJson);
        // Ensure it's an array and filter out potential invalid entries saved previously
        return Array.isArray(cart) ? cart.filter(item => item && item.productId) : [];
    } catch (error) {
        console.error("Error reading or parsing cart from localStorage:", error);
        // If parsing fails or any error occurs, return empty array to prevent breaking the app
        localStorage.removeItem(CART_STORAGE_KEY); // Optionally clear corrupted data
        return [];
    }
}

/**
 * कार्ट में प्रोडक्ट जोड़ने या मात्रा अपडेट करने के लिए फंक्शन (मान्यकरण के साथ अपडेटेड)
 * @param {string} productId - प्रोडक्ट का ID
 * @param {number} quantity - जोड़ने वाली मात्रा
 * @param {object} [options={}] - (वैकल्पिक) प्रोडक्ट के अन्य विवरण (जैसे कीमत, नाम, प्रकार, इमेज)
 */
export function addToCart(productId, quantity, options = {}) {
    // Validate basic inputs
    if (!productId || typeof productId !== 'string' || productId.trim() === '') {
        console.error("addToCart: Invalid or missing Product ID.");
        return; // Stop if productId is invalid
    }

    const itemQuantity = parseInt(quantity, 10); // Ensure quantity is an integer
    if (isNaN(itemQuantity) || itemQuantity <= 0) {
        console.error(`addToCart: Invalid quantity (${quantity}) for Product ID ${productId}. Quantity must be at least 1.`);
        return; // Stop if quantity is invalid
    }

    // Validate necessary options (name and price)
    // Check if price exists before parsing
    if (options.price === undefined || options.price === null) {
         console.error(`addToCart: Missing price for Product ID ${productId}.`);
         return; // Stop if price is missing
    }
    let itemPrice = parseFloat(options.price); // Ensure price is a number
    if (isNaN(itemPrice) || itemPrice < 0) {
        console.error(`addToCart: Invalid price (${options.price}) for Product ID ${productId}. Price must be a non-negative number.`);
        return; // Stop if price is invalid (NaN or negative)
    }

    const itemName = options.name || `Product ${productId}`; // Use provided name or generate a default
    if (typeof itemName !== 'string' || itemName.trim() === '') {
        console.warn(`addToCart: Invalid or missing name for Product ID ${productId}. Using default name.`);
        // Allow continuing with default name, but log a warning
    }

    const itemType = options.type || 'Standard'; // Default type if not provided
    const itemImage = options.image || null; // Image URL or null

    let cart = getCart(); // Get the current valid cart
    const existingItemIndex = cart.findIndex(item => item.productId === productId);

    if (existingItemIndex > -1) {
        // आइटम पहले से मौजूद है, मात्रा अपडेट करें
        cart[existingItemIndex].quantity += itemQuantity;
        // Update price if it has changed (e.g., for different options later)
        cart[existingItemIndex].price = itemPrice;
        cart[existingItemIndex].name = itemName.trim(); // Also update name/image if needed
        cart[existingItemIndex].image = itemImage;
        console.log(`Product ${productId} quantity updated to ${cart[existingItemIndex].quantity}.`);
    } else {
        // नया आइटम जोड़ें
        const newItem = {
            productId: productId.trim(), // Ensure no extra spaces
            name: itemName.trim(),
            price: itemPrice, // Use the validated number
            quantity: itemQuantity, // Use the validated number
            type: itemType,
            image: itemImage
        };
        cart.push(newItem);
        console.log(`Product ${productId} added to cart with quantity ${itemQuantity}.`);
    }

    saveCart(cart); // Update localStorage
    document.dispatchEvent(new CustomEvent('cartUpdated')); // Notify other parts of the app
}


/**
 * कार्ट से किसी आइटम को हटाने के लिए फंक्शन
 * @param {string} productId - हटाने वाले प्रोडक्ट का ID
 */
export function removeFromCart(productId) {
    if (!productId) {
        console.error("removeFromCart: Invalid Product ID provided.");
        return;
    }
    let cart = getCart();
    const updatedCart = cart.filter(item => item.productId !== productId);

    if (cart.length !== updatedCart.length) {
        saveCart(updatedCart);
        console.log(`Product ${productId} removed from cart.`);
        document.dispatchEvent(new CustomEvent('cartUpdated'));
    } else {
        console.warn(`removeFromCart: Product ${productId} not found in cart.`);
    }
}


/**
 * कार्ट में किसी आइटम की मात्रा अपडेट करने के लिए फंक्शन
 * @param {string} productId - अपडेट करने वाले प्रोडक्ट का ID
 * @param {number} quantity - नई मात्रा (0 या कम होने पर आइटम हट जाएगा)
 */
export function updateCartItemQuantity(productId, quantity) {
    const numericQuantity = parseInt(quantity, 10);
    if (!productId || isNaN(numericQuantity)) { // Allow 0 quantity to remove item
        console.error("updateCartItemQuantity: Invalid product ID or quantity provided.");
        return;
    }

    let cart = getCart();
    const itemIndex = cart.findIndex(item => item.productId === productId);

    if (itemIndex > -1) {
        if (numericQuantity <= 0) {
            cart.splice(itemIndex, 1); // मात्रा 0 या कम होने पर हटाएं
            console.log(`Product ${productId} removed due to zero or negative quantity.`);
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
    document.dispatchEvent(new CustomEvent('cartUpdated')); // Notify update
}