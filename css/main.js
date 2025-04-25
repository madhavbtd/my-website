// js/main.js - Mobile Menu Toggle Script

document.addEventListener('DOMContentLoaded', () => {
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (mobileMenuToggle && navLinks) {
        mobileMenuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            // Optional: Change button text/icon when menu is open
            if (navLinks.classList.contains('active')) {
                mobileMenuToggle.setAttribute('aria-expanded', 'true');
                // mobileMenuToggle.textContent = '✕'; // Example: Change icon to X
            } else {
                mobileMenuToggle.setAttribute('aria-expanded', 'false');
                // mobileMenuToggle.textContent = '☰'; // Example: Change back to hamburger
            }
        });
    } else {
        if (!mobileMenuToggle) console.error("Mobile menu toggle button not found.");
        if (!navLinks) console.error("Navigation links container not found.");
    }

    // Optional: Close menu when a link is clicked (useful for single-page apps or jump links)
    /*
    if (navLinks) {
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if (navLinks.classList.contains('active')) {
                    navLinks.classList.remove('active');
                    mobileMenuToggle.setAttribute('aria-expanded', 'false');
                    // mobileMenuToggle.textContent = '☰'; // Change back to hamburger
                }
            });
        });
    }
    */
});