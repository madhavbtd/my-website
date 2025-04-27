// js/main.js - Combined Mobile Menu Toggle Script + Updated Cart Count Logic

// ==============================================
// Cart Functions Import
// ==============================================
// cart.js से getCart इम्पोर्ट करें ताकि सही localStorage key का उपयोग हो
import { getCart } from './cart.js'; // <<<--- यह लाइन जोड़ी गई है

// ==============================================
// Cart Count Update Function
// ==============================================

/**
 * Updates the cart item count displayed in the website header.
 * Uses getCart imported from cart.js to ensure correct localStorage key is used.
 */
export function updateCartCount() {
    const cartCountSpan = document.getElementById('cart-count');
    if (cartCountSpan) {
        const cart = getCart(); // यह अब cart.js से इम्पोर्टेड फंक्शन है
        // Sabhi items ki quantity ko jodkar total count nikalein
        const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
        cartCountSpan.textContent = totalItems;
        console.log("Header cart count updated using cart.js getCart:", totalItems);
    } else {
        console.warn("Cart count span element (#cart-count) not found in header.");
    }
}

// ==============================================
// DOM Ready Listener (Initializes Menu & Cart Count)
// ==============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("main.js: DOMContentLoaded event fired.");

    // --- Mobile Menu Toggle Logic ---
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


    // --- Optional: Add listener for 'cartUpdated' event ---
    // This ensures count updates whenever cart.js functions modify the cart
    document.addEventListener('cartUpdated', () => {
        console.log('main.js received cartUpdated event.');
        updateCartCount(); // Update header count when cart changes
    });


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

console.log("main.js loaded.");