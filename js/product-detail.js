// js/product-detail.js
import { db } from './firebase-config.js'; // Firebase config इम्पोर्ट करें
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"; // Firestore functions इम्पोर्ट करें
import { addToCart } from './cart.js'; // cart.js से addToCart फंक्शन इम्पोर्ट करें
import { updateCartCount } from './main.js'; // main.js से updateCartCount फंक्शन इम्पोर्ट करें

// DOM Elements को प्राप्त करें (उदाहरण)
const productDetailContainer = document.getElementById('product-detail-container');
const loadingIndicator = document.querySelector('.loading-indicator');
const breadcrumbProductName = document.getElementById('breadcrumb-product-name');
// ... अन्य एलिमेंट्स (इमेज, नाम, कीमत, विवरण, बटन आदि) के लिए वेरिएबल्स बनाएं ...
const productNameEl = document.getElementById('product-name');
const mainImageEl = document.getElementById('main-product-image');
const descriptionEl = document.getElementById('product-description');
const priceEl = document.getElementById('product-price');
const specsListEl = document.getElementById('product-specs');
const addToCartBtn = document.getElementById('add-to-cart-btn');
const quantityInput = document.getElementById('quantity');
const cartFeedbackEl = document.getElementById('cart-feedback');


// URL से प्रोडक्ट ID प्राप्त करें
const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id');

// प्रोडक्ट डेटा लोड करने के लिए फंक्शन
async function loadProductDetails() {
    if (!productId) {
        productDetailContainer.innerHTML = '<p class="error-message">Product ID not found in URL.</p>';
        loadingIndicator.style.display = 'none';
        return;
    }

    loadingIndicator.style.display = 'flex'; // लोडिंग दिखाएं

    try {
        // Firestore से प्रोडक्ट डॉक्यूमेंट प्राप्त करें
        const productRef = doc(db, "products", productId); // "products" आपके कलेक्शन का नाम होना चाहिए
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
            const productData = productSnap.data();

            // --- HTML को डेटा से भरें ---
            document.title = `${productData.name} - Madhav Multiprint`; // पेज का टाइटल बदलें
            breadcrumbProductName.textContent = productData.name;

            // कंस्ट्रक्ट HTML स्ट्रक्चर (यह सुरक्षित तरीका नहीं है, बेहतर तरीके से करें)
            // नोट:innerHTML का उपयोग XSS के प्रति संवेदनशील हो सकता है। सुरक्षित तरीकों का उपयोग करें।
             const detailHTML = `
                <div class="product-image-gallery">
                    <div class="main-image">
                        <img id="main-product-image" src="<span class="math-inline">\{productData\.imageUrl \|\| 'placeholder\.jpg'\}" alt\="</span>{productData.name}">
                    </div>
                    </div>
                <div class="product-info-details">
                    <h1 id="product-name"><span class="math-inline">\{productData\.name\}</h1\>