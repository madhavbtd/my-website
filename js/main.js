// js/main.js - Combined Mobile Menu Toggle Script + Cart Functions

// ==============================================
// Cart Functions (Using Local Storage)
// ==============================================

/**
 * Retrieves the shopping cart from local storage.
 * @returns {Array} An array of cart items or an empty array if cart is empty/not found.
 */
export function getCart() {
    const cartJson = localStorage.getItem('shoppingCart');
    // Agar cart null/undefined hai toh empty array return karein
    return cartJson ? JSON.parse(cartJson) : [];
}

/**
 * Saves the shopping cart to local storage and updates the header count.
 * @param {Array} cart - The array of cart items to save.
 */
export function saveCart(cart) {
    localStorage.setItem('shoppingCart', JSON.stringify(cart));
    updateCartCount(); // Cart save hone par header count update karein
}

/**
 * Updates the cart item count displayed in the website header.
 */
export function updateCartCount() {
    const cartCountSpan = document.getElementById('cart-count');
    if (cartCountSpan) {
        const cart = getCart();
        // Sabhi items ki quantity ko jodkar total count nikalein
        const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
        cartCountSpan.textContent = totalItems;
    }
}

// ==============================================
// DOM Ready Listener (Initializes Menu & Cart Count)
// ==============================================

document.addEventListener('DOMContentLoaded', () => {

    // --- Mobile Menu Toggle Logic (from your original file) ---
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (mobileMenuToggle && navLinks) {
        mobileMenuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            // Optional: Change button icon/state
            const icon = mobileMenuToggle.querySelector('i'); // Assuming Font Awesome icon
            if (navLinks.classList.contains('active')) {
                mobileMenuToggle.setAttribute('aria-expanded', 'true');
                if(icon) { // Change icon if found
                   icon.classList.remove('fa-bars');
                   icon.classList.add('fa-times');
                }
            } else {
                mobileMenuToggle.setAttribute('aria-expanded', 'false');
                 if(icon) { // Change icon back if found
                   icon.classList.remove('fa-times');
                   icon.classList.add('fa-bars');
                 }
            }
        });
    } else {
        // Error logging if elements are not found
        if (!mobileMenuToggle) console.error("Mobile menu toggle button not found.");
        if (!navLinks) console.error("Navigation links container not found.");
    }
    // --- End Mobile Menu Logic ---


    // --- Initialize Cart Count Display ---
    // Update the cart count in the header when the page loads
    updateCartCount();
    // --- End Cart Count Init ---

    // --- Optional: Close mobile menu when a link is clicked ---
    /*
    if (navLinks) {
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if (navLinks.classList.contains('active')) {
                    navLinks.classList.remove('active');
                    mobileMenuToggle.setAttribute('aria-expanded', 'false');
                    const icon = mobileMenuToggle.querySelector('i');
                    if(icon) {
                       icon.classList.remove('fa-times');
                       icon.classList.add('fa-bars');
                    }
                }
            });
        });
    }
    */

}); // End DOMContentLoaded