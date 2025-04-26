// js/product-detail.js
import { db } from './firebase-config.js'; // Firebase config इम्पोर्ट करें
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"; // Firestore functions इम्पोर्ट करें
import { addToCart } from './cart.js'; // cart.js से addToCart फंक्शन इम्पोर्ट करें
import { updateCartCount } from './main.js'; // main.js से updateCartCount फंक्शन इम्पोर्ट करें (सुनिश्चित करें कि यह एक्सपोर्ट किया गया है)

// --- DOM Elements ---
const productDetailContainer = document.getElementById('product-detail-container');
const loadingIndicator = productDetailContainer.querySelector('.loading-indicator');
const productContent = productDetailContainer.querySelector('.product-content');
const errorMessageContainer = document.getElementById('error-message-container');

// स्पेसिफिक एलिमेंट IDs
const breadcrumbProductName = document.getElementById('breadcrumb-product-name');
const productNameEl = document.getElementById('product-name');
const mainImageEl = document.getElementById('main-product-image');
const thumbnailImagesContainer = document.getElementById('thumbnail-images');
const descriptionEl = document.getElementById('product-description');
const priceEl = document.getElementById('product-price');
const specsListEl = document.getElementById('product-specs');
const addToCartBtn = document.getElementById('add-to-cart-btn');
const quantityInput = document.getElementById('quantity');
const cartFeedbackEl = document.getElementById('cart-feedback');

// --- Helper Function ---
// भारतीय रुपये में करेंसी फॉर्मेटिंग
const formatIndianCurrency = (amount) => {
    const num = Number(amount);
    return isNaN(num) || num === null ? 'N/A' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// --- Main Logic ---
document.addEventListener('DOMContentLoaded', () => {
    // URL से प्रोडक्ट ID प्राप्त करें
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        showError("Product ID not found in URL.");
        return;
    }

    loadProductDetails(productId);

    // 'Add to Cart' बटन के लिए इवेंट लिसनर
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', handleAddToCart);
    } else {
         console.error("Add to Cart button not found!");
    }

     // Thumbnail क्लिक हैंडलर
     if (thumbnailImagesContainer) {
        thumbnailImagesContainer.addEventListener('click', (event) => {
            if (event.target.tagName === 'IMG') {
                mainImageEl.src = event.target.src;
                // एक्टिव थंबनेल स्टाइल अपडेट करें
                 const thumbnails = thumbnailImagesContainer.querySelectorAll('img');
                 thumbnails.forEach(thumb => thumb.classList.remove('active'));
                 event.target.classList.add('active');
            }
        });
     }

});

// प्रोडक्ट डेटा लोड करने और पेज पॉप्युलेट करने का फंक्शन
async function loadProductDetails(productId) {
    loadingIndicator.style.display = 'flex'; // लोडिंग दिखाएं
    productContent.style.display = 'none'; // कंटेंट छिपाएं
    errorMessageContainer.style.display = 'none'; // एरर छिपाएं

    try {
        // Firestore से प्रोडक्ट डॉक्यूमेंट प्राप्त करें - CORRECT COLLECTION NAME
        const productRef = doc(db, "onlineProducts", productId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
            const productData = productSnap.data();

            // --- HTML को डेटा से भरें ---
            document.title = `${productData.productName || 'Product'} - Madhav Multiprint`; // पेज का टाइटल बदलें
            breadcrumbProductName.textContent = productData.productName || 'Product Details';
            productNameEl.textContent = productData.productName || 'N/A';

            // मुख्य इमेज और थंबनेल सेट करें
             if (productData.imageUrls && Array.isArray(productData.imageUrls) && productData.imageUrls.length > 0) {
                mainImageEl.src = productData.imageUrls[0];
                mainImageEl.alt = productData.productName || 'Product image';
                thumbnailImagesContainer.innerHTML = ''; // पुराने थंबनेल हटाएं
                productData.imageUrls.forEach((url, index) => {
                    const thumb = document.createElement('img');
                    thumb.src = url;
                    thumb.alt = `Thumbnail ${index + 1} for ${productData.productName || 'product'}`;
                    thumb.classList.add('thumbnail');
                    if (index === 0) thumb.classList.add('active'); // पहला थंबनेल एक्टिव करें
                    thumbnailImagesContainer.appendChild(thumb);
                });
             } else {
                 mainImageEl.src = 'images/placeholder.png'; // डिफ़ॉल्ट प्लेसहोल्डर
                 mainImageEl.alt = 'Placeholder image';
                 thumbnailImagesContainer.innerHTML = ''; // कोई थंबनेल नहीं
             }

            // विवरण
            descriptionEl.textContent = productData.description || 'No description available.';

            // कीमत
             renderPrice(productData);

             // विनिर्देश (यदि 'specifications' एक ऑब्जेक्ट है)
            specsListEl.innerHTML = ''; // पुराने स्पेसिफिकेशन्स हटाएं
            if (productData.specifications && typeof productData.specifications === 'object') {
                for (const [key, value] of Object.entries(productData.specifications)) {
                    if (value) { // केवल वैल्यू वाले स्पेसिफिकेशन्स दिखाएं
                         const li = document.createElement('li');
                         li.innerHTML = `<strong>${formatSpecKey(key)}:</strong> ${value}`;
                         specsListEl.appendChild(li);
                    }
                }
                if (specsListEl.children.length === 0) {
                     specsListEl.innerHTML = '<li>No specifications available.</li>';
                }
            } else {
                specsListEl.innerHTML = '<li>No specifications available.</li>';
            }

            // कंटेंट दिखाएं और लोडर छिपाएं
            productContent.style.display = 'grid'; // या 'flex', आपके CSS पर निर्भर करता है
            loadingIndicator.style.display = 'none';

        } else {
            showError("Product not found.");
        }
    } catch (error) {
        console.error("Error loading product details: ", error);
        showError(`Failed to load product details. ${error.message}`);
    }
}

// कीमत को रेंडर करने का फंक्शन
function renderPrice(productData) {
    let priceDisplay = 'Contact for Price';
     if (productData.pricing && typeof productData.pricing.rate !== 'undefined' && productData.pricing.rate !== null) {
         const rate = productData.pricing.rate;
         if (productData.unit && typeof productData.unit === 'string') {
             if (productData.unit.toLowerCase() === 'sq feet') {
                 priceDisplay = `From ${formatIndianCurrency(rate)} / sq ft`;
                 if (typeof productData.pricing.minimumOrderValue === 'number' && productData.pricing.minimumOrderValue > 0) {
                     priceDisplay += ` (Min. ${formatIndianCurrency(productData.pricing.minimumOrderValue)})`;
                 }
             } else {
                 priceDisplay = `${formatIndianCurrency(rate)} / ${productData.unit}`;
             }
         } else {
             priceDisplay = formatIndianCurrency(rate);
         }
     }
     priceEl.innerHTML = priceDisplay; // Use innerHTML if price includes tags, else textContent
}

// स्पेसिफिकेशन key को फॉर्मेट करने का हेल्पर फंक्शन (e.g., camelCase to Title Case)
function formatSpecKey(key) {
    const result = key.replace(/([A-Z])/g, ' $1');
    return result.charAt(0).toUpperCase() + result.slice(1);
}


// एरर मैसेज दिखाने का फंक्शन
function showError(message) {
    if(productContent) productContent.style.display = 'none';
    if(loadingIndicator) loadingIndicator.style.display = 'none';
    if(errorMessageContainer) {
        errorMessageContainer.textContent = message;
        errorMessageContainer.style.display = 'block';
    }
     // पेज टाइटल और ब्रेडक्रंब अपडेट करें
     document.title = "Error - Madhav Multiprint";
     if(breadcrumbProductName) breadcrumbProductName.textContent = "Error";
}

// कार्ट में जोड़ने का हैंडलर
function handleAddToCart() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    const quantity = parseInt(quantityInput.value, 10);

    if (!productId) {
        showFeedback("Error: Product ID is missing.", true);
        return;
    }
    if (isNaN(quantity) || quantity < 1) {
        showFeedback("Please enter a valid quantity.", true);
        return;
    }

    try {
        addToCart(productId, quantity);
        showFeedback("Product added to cart!", false);

        // कार्ट काउंट अपडेट करें (main.js से इम्पोर्टेड फंक्शन)
        if (typeof updateCartCount === 'function') {
            updateCartCount();
        } else {
            console.warn("updateCartCount function is not available.");
        }

    } catch (error) {
        console.error("Error adding to cart:", error);
        showFeedback("Failed to add product to cart. Please try again.", true);
    }
}

// कार्ट फीडबैक दिखाने का फंक्शन
function showFeedback(message, isError = false) {
    if (cartFeedbackEl) {
        cartFeedbackEl.textContent = message;
        cartFeedbackEl.className = isError ? 'cart-feedback-message error' : 'cart-feedback-message success'; // CSS क्लास अपडेट करें
        cartFeedbackEl.style.display = 'block';

        // कुछ सेकंड बाद मैसेज छिपाएं
        setTimeout(() => {
            cartFeedbackEl.style.display = 'none';
        }, 3000); // 3 सेकंड
    }
}