// js/main.js
document.addEventListener('DOMContentLoaded', () => {
    console.log("Customer website main JS loaded.");
    updateCartCount(); // कार्ट काउंट अपडेट करें

    // मोबाइल मेनू टॉगल (उदाहरण)
    const toggleButton = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    if (toggleButton && navLinks) {
        toggleButton.addEventListener('click', () => {
            navLinks.classList.toggle('active'); // CSS में .active क्लास को स्टाइल करें
        });
    }
});

// कार्ट काउंट अपडेट करने के लिए फंक्शन (इसे cart.js से भी कॉल किया जा सकता है)
export function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('shoppingCart') || '[]');
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
        cartCountElement.textContent = cart.length;
    }
}