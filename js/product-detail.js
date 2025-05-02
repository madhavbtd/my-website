// js/product-detail.js
// FINAL Version: Includes Add-to-Cart Popup Fix, Wedding Qty Fix, Related Products Fix, SetupTabs Fix, showLoading Fix, Debug Logs, Flex Price Update Fix. Uses 'onlineProducts'.

// --- Imports ---
import { db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, limit, getDocs, addDoc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { addToCart } from './cart.js';
import { updateCartCount } from './main.js'; // Assuming main.js exports this

// --- DOM Elements ---
const productDetailContainer = document.getElementById('product-detail-container');
const loadingIndicator = productDetailContainer?.querySelector('.loading-indicator');
const productContent = productDetailContainer?.querySelector('.product-content');
const errorMessageContainer = document.getElementById('error-message-container');
const breadcrumbProductName = document.getElementById('breadcrumb-product-name');
const productNameEl = document.getElementById('product-name');
const mainImageEl = document.getElementById('main-product-image');
const thumbnailImagesContainer = document.getElementById('thumbnail-images');
const priceEl = document.getElementById('product-price'); // Main price display
const originalPriceEl = document.getElementById('original-price');
const perCardPriceEl = document.getElementById('per-card-price'); // Combined display area for per-card price
const weddingPerCardPriceEl = document.getElementById('wedding-per-card-price'); // Specific wedding per-card price
const addToCartBtn = document.getElementById('add-to-cart-btn');
const cartFeedbackEl = document.getElementById('cart-feedback-message');
const viewCartButton = document.getElementById('view-cart-button'); // Get the View Cart button

// Product Type Specific Containers
const standardOptionsContainer = document.getElementById('standard-options-container');
const weddingOptionsContainer = document.getElementById('wedding-options-container');
const flexOptionsContainer = document.getElementById('flex-options-container');

// Standard Quantity Controls
const quantityInput = document.getElementById('quantity');
const quantityDecreaseBtn = document.getElementById('quantity-decrease');
const quantityIncreaseBtn = document.getElementById('quantity-increase');

// Wedding Quantity Controls
const weddingQuantitySelect = document.getElementById('wedding-quantity-select');

// Flex Banner Controls
const bannerWidthInput = document.getElementById('banner-width');
const bannerHeightInput = document.getElementById('banner-height');
const bannerUnitSelect = document.getElementById('banner-unit');

// Popup Elements
const popupOverlay = document.getElementById('popup-overlay');
const popupProductName = document.getElementById('popup-product-name');
const popupProductImage = document.getElementById('popup-product-image');
const popupProductQuantity = document.getElementById('popup-product-quantity');
const popupProductOptions = document.getElementById('popup-product-options');
const popupProductPrice = document.getElementById('popup-product-price');
const popupPerCardPrice = document.getElementById('popup-per-card-price'); // Popup per card price element
const popupConfirmBtn = document.getElementById('popup-confirm-add');
const popupCancelBtn = document.getElementById('popup-cancel');
const popupCloseBtn = popupOverlay?.querySelector('.popup-close-btn'); // Assuming a close 'x' button might exist

// Related Products
const relatedProductsSection = document.getElementById('related-products-section');
const relatedProductsContainer = document.getElementById('related-products-container');

// Tabs
const tabsNav = document.querySelector('.tabs-nav');
const tabPanes = document.querySelectorAll('.tab-pane');

// Global variable to hold current product data
let currentProductData = null;
let currentPricingType = 'standard'; // 'standard', 'wedding', 'flex'
let currentPerCardPrice = 0; // Store the calculated per-card price for wedding cards

// --- Helper Functions ---
function showLoading(section = 'main') {
    console.log(`लोडिंग दिखाया जा रहा है: ${section}`);
    if (section === 'main' && loadingIndicator && productContent) {
        loadingIndicator.style.display = 'flex';
        productContent.style.display = 'none';
        errorMessageContainer.style.display = 'none';
        if(relatedProductsSection) relatedProductsSection.style.display = 'none'; // संबंधित उत्पादों को भी छिपाएं
    } else if (section === 'related' && relatedProductsSection) {
        // वैकल्पिक: यदि आवश्यक हो तो संबंधित उत्पादों के लिए एक विशिष्ट लोडर जोड़ें
        relatedProductsContainer.innerHTML = '<p>संबंधित उत्पाद लोड हो रहे हैं...</p>';
        relatedProductsSection.style.display = 'block';
    }
}

function hideLoading(section = 'main') {
    console.log(`लोडिंग छिपाया जा रहा है: ${section}`);
    if (section === 'main' && loadingIndicator && productContent) {
        loadingIndicator.style.display = 'none';
        productContent.style.display = 'grid'; // या आपके लेआउट के आधार पर 'block'
    }
    // यदि सामग्री लोडिंग टेक्स्ट को प्रतिस्थापित करती है तो संबंधित के लिए विशिष्ट छिपाने की आवश्यकता नहीं है
}

function showError(message) {
    console.error("त्रुटि प्रदर्शित:", message);
    if (errorMessageContainer && loadingIndicator && productContent) {
        errorMessageContainer.textContent = message;
        errorMessageContainer.style.display = 'block';
        loadingIndicator.style.display = 'none';
        productContent.style.display = 'none';
        if(relatedProductsSection) relatedProductsSection.style.display = 'none';
    } else {
        console.error("त्रुटि प्रदर्शन तत्व नहीं मिले।");
    }
}

function formatPrice(price) {
    // सुनिश्चित करें कि मूल्य एक संख्या है
    const numericPrice = Number(price);
    if (isNaN(numericPrice)) {
        console.error(`अमान्य मूल्य प्रारूपण के लिए इनपुट: ${price}`);
        return 'N/A'; // या कोई डिफ़ॉल्ट स्ट्रिंग
    }
    return `₹${numericPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// --- Product Data Fetching & Rendering ---
async function loadProductDetails(productId) {
    showLoading('main');
    try {
        console.log(`उत्पाद आईडी के साथ प्राप्त किया जा रहा है: ${productId}`);
        const productRef = doc(db, "onlineProducts", productId); // 'onlineProducts' संग्रह का उपयोग करें
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
            console.log("उत्पाद डेटा मिला:", productSnap.data());
            currentProductData = { id: productSnap.id, ...productSnap.data() };
            renderProductDetails(currentProductData);
            // संबंधित उत्पादों को तुरंत प्राप्त न करें, मुख्य उत्पाद रेंडर की प्रतीक्षा करें
        } else {
            console.error("ऐसा कोई उत्पाद नहीं मिला!");
            showError("उत्पाद नहीं मिला।");
        }
    } catch (error) {
        console.error("उत्पाद विवरण प्राप्त करने में त्रुटि:", error);
        showError("उत्पाद विवरण लोड नहीं किया जा सका। कृपया अपना कनेक्शन जांचें और पुनः प्रयास करें।");
    } finally {
        // मुख्य लोडिंग renderProductDetails या showError के अंदर छिपी हुई है
    }
}

function renderProductDetails(productData) {
    console.log("उत्पाद विवरण प्रस्तुत किया जा रहा है...");

    if (!productData || !productDetailContainer) {
        showError("उत्पाद विवरण प्रस्तुत करने में विफल: डेटा या कंटेनर गायब है।");
        return;
    }

    // मूल्य निर्धारण प्रकार निर्धारित करें
    if (productData.pricingType === 'wedding') {
        currentPricingType = 'wedding';
    } else if (productData.pricingType === 'flex') {
        currentPricingType = 'flex';
    } else {
        currentPricingType = 'standard';
    }
    console.log(`उत्पाद मूल्य निर्धारण प्रकार निर्धारित किया गया है: ${currentPricingType}`);

    // --- मूल जानकारी अपडेट करें ---
    if (breadcrumbProductName) breadcrumbProductName.textContent = productData.name || 'Product';
    if (productNameEl) productNameEl.textContent = productData.name || 'N/A';
    document.title = `${productData.name || 'Product'} Details - Madhav Multiprint`;

    // --- छवियां अपडेट करें ---
    if (mainImageEl) {
        mainImageEl.src = productData.imageUrls?.[0] || 'images/placeholder.png'; // सुनिश्चित करें कि पाथ सही है
        mainImageEl.alt = productData.name || 'Product Image';
    }
    if (thumbnailImagesContainer) {
        thumbnailImagesContainer.innerHTML = ''; // पुराने थंबनेल साफ़ करें
        if (productData.imageUrls && productData.imageUrls.length > 1) {
            productData.imageUrls.forEach((url, index) => {
                const img = document.createElement('img');
                img.src = url;
                img.alt = `Thumbnail ${index + 1}`;
                img.dataset.full = url;
                if (index === 0) img.classList.add('active');
                img.addEventListener('click', () => {
                    if (mainImageEl) mainImageEl.src = img.dataset.full;
                    thumbnailImagesContainer.querySelectorAll('img').forEach(i => i.classList.remove('active'));
                    img.classList.add('active');
                });
                thumbnailImagesContainer.appendChild(img);
            });
            thumbnailImagesContainer.style.display = 'grid';
        } else {
             thumbnailImagesContainer.style.display = 'none'; // यदि केवल एक छवि है तो थंबनेल छिपाएं
        }
    }

    // --- विवरण अपडेट करें ---
    const shortDescEl = document.querySelector('.product-description-short');
    if (shortDescEl) shortDescEl.textContent = productData.shortDescription || '';
    const longDescEl = document.getElementById('tab-description');
    if (longDescEl) longDescEl.innerHTML = productData.longDescription || '<p>No description available.</p>'; // यदि विवरण में HTML है तो innerHTML का उपयोग करें

    // --- विनिर्देश अपडेट करें ---
    const specsList = document.getElementById('tab-specifications ul');
    if (specsList) {
        specsList.innerHTML = ''; // मौजूदा विनिर्देश साफ़ करें
        if (productData.specifications && typeof productData.specifications === 'object') {
            for (const [key, value] of Object.entries(productData.specifications)) {
                if (value) { // केवल मान वाले विनिर्देश प्रदर्शित करें
                    const li = document.createElement('li');
                    const strong = document.createElement('strong');
                    strong.textContent = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()); // कुंजी को अच्छी तरह से प्रारूपित करें
                    const span = document.createElement('span');
                    span.textContent = value;
                    li.appendChild(strong);
                    li.appendChild(span);
                    specsList.appendChild(li);
                }
            }
        } else {
            specsList.innerHTML = '<li>No specifications available.</li>';
        }
    }


    // --- मूल्य निर्धारण और विकल्प अपडेट करें ---
    updatePricingAndOptionsVisibility(productData);

    // --- ईवेंट श्रोता सेटअप करें (महत्वपूर्ण: तत्व प्रस्तुत होने के बाद) ---
    attachEventListeners(productData); // मात्रा, कार्ट में जोड़ें आदि के लिए श्रोता संलग्न करें।

    // --- Schema.org JSON-LD अपडेट करें ---
    updateProductSchema(productData);

    // --- संबंधित उत्पाद प्राप्त करें और प्रस्तुत करें ---
    if (productData.category) {
        loadRelatedProducts(productData.category, productData.id);
    } else {
        console.log("कोई श्रेणी नहीं मिली, संबंधित उत्पादों को छोड़ा जा रहा है।");
        if(relatedProductsSection) relatedProductsSection.style.display = 'none';
    }

    // --- समीक्षाएं प्राप्त करें और प्रस्तुत करें ---
    loadReviews(productData.id);

    // --- टैब सेटअप करें ---
    setupTabs(); // सुनिश्चित करें कि टैब काम करते हैं

     // --- लोडिंग छिपाएं, सामग्री दिखाएं ---
    hideLoading('main');
    console.log("उत्पाद विवरण सफलतापूर्वक प्रस्तुत किया गया।");
}

function updatePricingAndOptionsVisibility(productData) {
    console.log("प्रकार के आधार पर मूल्य निर्धारण और विकल्पों की दृश्यता अपडेट की जा रही है:", currentPricingType);
    // प्रारंभ में सभी विकल्प कंटेनर छिपाएं
    if (standardOptionsContainer) standardOptionsContainer.style.display = 'none';
    if (weddingOptionsContainer) weddingOptionsContainer.style.display = 'none';
    if (flexOptionsContainer) flexOptionsContainer.style.display = 'none';
    if (originalPriceEl) originalPriceEl.style.display = 'none'; // मूल मूल्य डिफ़ॉल्ट रूप से छिपाएं
    if (perCardPriceEl) perCardPriceEl.style.display = 'none'; // सामान्य प्रति-कार्ड मूल्य प्रदर्शन छिपाएं
    if (weddingPerCardPriceEl) weddingPerCardPriceEl.style.display = 'none'; // विशिष्ट वेडिंग प्रति-कार्ड मूल्य प्रदर्शन छिपाएं

    switch (currentPricingType) {
        case 'wedding':
            if (weddingOptionsContainer) weddingOptionsContainer.style.display = 'block';
            if (weddingQuantitySelect && productData.weddingPricing) {
                populateWeddingQuantities(productData.weddingPricing);
                updateWeddingPriceDisplay(); // प्रारंभिक मूल्य अपडेट
            } else {
                 console.error("वेडिंग मूल्य निर्धारण डेटा या चयन तत्व गायब है।");
                 if (priceEl) priceEl.textContent = 'Price Unavailable';
            }
            break;
        case 'flex':
            if (flexOptionsContainer) flexOptionsContainer.style.display = 'block';
            // सुनिश्चित करें कि फ्लेक्स के लिए मूल्य प्रदर्शन प्रारंभ में अपडेट किया गया है
            updateFlexPriceDisplay(); // प्रारंभिक मूल्य अपडेट करें (या डिफ़ॉल्ट स्थिति सेट करें)
            break;
        case 'standard':
        default:
            if (standardOptionsContainer) standardOptionsContainer.style.display = 'block';
            if (priceEl) priceEl.textContent = formatPrice(productData.price || 0);
            if (productData.originalPrice && productData.originalPrice > productData.price) {
                if (originalPriceEl) {
                    originalPriceEl.textContent = formatPrice(productData.originalPrice);
                    originalPriceEl.style.display = 'inline';
                }
            }
            if (quantityInput) quantityInput.value = 1; // मात्रा रीसेट करें
            break;
    }
}

function populateWeddingQuantities(pricingTiers) {
    if (!weddingQuantitySelect || !pricingTiers || pricingTiers.length === 0) return;

    // टियर्स को मात्रा के अनुसार आरोही क्रम में क्रमबद्ध करें
    pricingTiers.sort((a, b) => a.minQuantity - b.minQuantity);

    weddingQuantitySelect.innerHTML = ''; // मौजूदा विकल्प साफ़ करें
    pricingTiers.forEach(tier => {
        const option = document.createElement('option');
        option.value = tier.minQuantity; // मान के रूप में minQuantity का उपयोग करें
        option.dataset.pricePerCard = tier.pricePerCard; // डेटा विशेषता में प्रति कार्ड मूल्य संग्रहीत करें
        option.textContent = `${tier.minQuantity}+ Cards`;
        weddingQuantitySelect.appendChild(option);
    });
    // डिफ़ॉल्ट रूप से पहले विकल्प का चयन करें (यदि कोई हो)
    if (weddingQuantitySelect.options.length > 0) {
       weddingQuantitySelect.selectedIndex = 0;
    }
}


function updateWeddingPriceDisplay() {
    if (!weddingQuantitySelect || !priceEl || !weddingPerCardPriceEl) return;

    // चयनित विकल्प प्राप्त करें, सुनिश्चित करें कि एक चयनित है
     const selectedIndex = weddingQuantitySelect.selectedIndex;
     if (selectedIndex < 0 || selectedIndex >= weddingQuantitySelect.options.length) {
          console.warn("कोई वेडिंग मात्रा चयनित नहीं है।");
          // यदि कोई चयन नहीं है तो मूल्य को डिफ़ॉल्ट या N/A पर सेट करें
          priceEl.textContent = 'Select Quantity';
          weddingPerCardPriceEl.textContent = '';
          weddingPerCardPriceEl.style.display = 'none';
          currentPerCardPrice = 0; // वैश्विक प्रति-कार्ड मूल्य रीसेट करें
          return;
     }
    const selectedOption = weddingQuantitySelect.options[selectedIndex];

    if (!selectedOption || !selectedOption.dataset.pricePerCard) {
        console.error("चयनित वेडिंग विकल्प या मूल्य डेटा गायब है।");
        priceEl.textContent = 'N/A';
        weddingPerCardPriceEl.textContent = '';
        weddingPerCardPriceEl.style.display = 'none';
        return;
    }

    const quantity = parseInt(selectedOption.value, 10);
    currentPerCardPrice = parseFloat(selectedOption.dataset.pricePerCard); // वैश्विक प्रति-कार्ड मूल्य अपडेट करें
    const totalPrice = quantity * currentPerCardPrice;

    // totalPrice की NaN के लिए जांच करें
    if (isNaN(totalPrice)) {
         console.error("वेडिंग कार्ड के लिए NaN मूल्य की गणना की गई।");
         priceEl.textContent = 'Error';
         weddingPerCardPriceEl.textContent = '';
         weddingPerCardPriceEl.style.display = 'none';
         return;
    }

    priceEl.textContent = formatPrice(totalPrice);
    weddingPerCardPriceEl.textContent = `${formatPrice(currentPerCardPrice)} per card`;
    weddingPerCardPriceEl.style.display = 'block'; // प्रति-कार्ड मूल्य दिखाएं

    console.log(`वेडिंग मूल्य अपडेट किया गया: मात्रा=${quantity}, प्रति कार्ड=${currentPerCardPrice}, कुल=${totalPrice}`);
}

// **संशोधित और बेहतर updateFlexPriceDisplay फ़ंक्शन**
function updateFlexPriceDisplay() {
    // पहले सुनिश्चित करें कि सभी जरूरी एलिमेंट और डेटा मौजूद हैं
    if (!bannerWidthInput || !bannerHeightInput || !bannerUnitSelect || !priceEl || !currentProductData?.basePriceSqFt) {
         console.warn("फ्लेक्स मूल्य अपडेट छोड़ा गया: आवश्यक तत्व या बेस मूल्य गायब है।");
         // अगर इनपुट गायब हैं तो मूल्य को साफ़ करें या डिफ़ॉल्ट दिखाएं
         if (priceEl) priceEl.textContent = formatPrice(0); // या 'N/A' दिखा सकते हैं
         return;
    }

    const width = parseFloat(bannerWidthInput.value) || 0;
    const height = parseFloat(bannerHeightInput.value) || 0;
    const unit = bannerUnitSelect.value;
    const basePriceSqFt = parseFloat(currentProductData.basePriceSqFt);

    // मान प्राप्त करने के बाद मान्य डाइमेंशन और बेस मूल्य की जांच करें
    if (width <= 0 || height <= 0 || !basePriceSqFt || isNaN(basePriceSqFt)) {
        priceEl.textContent = formatPrice(0); // यदि डाइमेंशन अमान्य हैं तो 0 दिखाएं
        console.log("अमान्य डाइमेंशन या बेस मूल्य के कारण फ्लेक्स मूल्य 0 पर सेट किया गया।");
        return;
    }

    let areaSqFt = 0;
    if (unit === 'ft') {
        areaSqFt = width * height;
    } else if (unit === 'in') {
        areaSqFt = (width / 12) * (height / 12);
    } else if (unit === 'cm') {
        // cm से फीट में सही रूपांतरण (1 फीट = 30.48 सेमी)
        areaSqFt = (width / 30.48) * (height / 30.48);
    } else {
        console.error(`अज्ञात इकाई: ${unit}`);
        priceEl.textContent = 'N/A'; // त्रुटि दर्शाएं
        return;
    }

    // बेस मूल्य से गुणा करने से पहले क्षेत्र की जांच करें
    if (isNaN(areaSqFt) || areaSqFt < 0) {
         console.error("गणना किया गया क्षेत्रफल अमान्य है।");
         priceEl.textContent = 'Error'; // गणना त्रुटि दर्शाएं
         return;
    }


    const totalPrice = areaSqFt * basePriceSqFt;

    // अंतिम मूल्य की जांच करें
    if (isNaN(totalPrice)) {
         console.error("गणना किया गया कुल मूल्य NaN है।");
         priceEl.textContent = 'Error'; // गणना त्रुटि दर्शाएं
         return;
    }

    priceEl.textContent = formatPrice(totalPrice); // मूल्य प्रदर्शन अपडेट करें
    console.log(`फ्लेक्स मूल्य अपडेट किया गया: W=${width}, H=${height}, Unit=${unit}, AreaSqFt=${areaSqFt.toFixed(2)}, BasePrice=${basePriceSqFt}, Total=${totalPrice}`);
}


function updateProductSchema(productData) {
    const schemaScript = document.getElementById('product-schema');
    if (schemaScript) {
        try {
            const schema = {
                "@context": "https://schema.org/",
                "@type": "Product",
                "name": productData.name || "Unnamed Product",
                "image": productData.imageUrls || [],
                "description": productData.shortDescription || productData.longDescription || "No description available.",
                "sku": productData.sku || productData.id, // SKU का उपयोग करें यदि उपलब्ध हो, अन्यथा उत्पाद आईडी
                "brand": {
                    "@type": "Brand",
                    "name": "Madhav Multiprint" // एक निश्चित ब्रांड नाम मानते हुए
                },
                "offers": {
                    "@type": "Offer",
                    "url": window.location.href, // वर्तमान पृष्ठ URL
                    "priceCurrency": "INR",
                    // मूल्य निर्धारण pricingType के आधार पर तर्क की आवश्यकता है
                    "price": determineSchemaPrice(productData),
                    "availability": "https://schema.org/InStock", // अभी के लिए हमेशा स्टॉक में मानते हुए
                    "priceValidUntil": new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().substring(0,10) // 30 दिनों के लिए मान्य उदाहरण
                },
                // वैकल्पिक: यदि समीक्षाएं लागू की गई हैं तो aggregateRating जोड़ें
                // "aggregateRating": {
                //   "@type": "AggregateRating",
                //   "ratingValue": "4.5", // उदाहरण
                //   "reviewCount": "15" // उदाहरण
                // },
                // वैकल्पिक: समीक्षाएं जोड़ें
                // "review": [ { ... समीक्षा स्कीमा ... } ]
            };
            schemaScript.textContent = JSON.stringify(schema, null, 2); // JSON को सुंदर प्रिंट करें
             console.log("उत्पाद स्कीमा अपडेट किया गया।");
        } catch (e) {
            console.error("उत्पाद स्कीमा अपडेट करने में त्रुटि:", e);
        }
    }
}

function determineSchemaPrice(productData) {
    // Schema.org के लिए एक प्रतिनिधि मूल्य प्रदान करता है
    // परिवर्तनीय मूल्य निर्धारण के लिए, आधार या निम्नतम टियर मूल्य का उपयोग करना आम है।
    switch (productData.pricingType) {
        case 'wedding':
            // निम्नतम मात्रा टियर का मूल्य उपयोग करें
            const weddingTiers = productData.weddingPricing || [];
            const sortedTiers = [...weddingTiers].sort((a,b) => a.minQuantity - b.minQuantity);
             return sortedTiers[0] ? (sortedTiers[0].pricePerCard * sortedTiers[0].minQuantity).toString() : "0";
        case 'flex':
            // फ्लेक्स मूल्य आयामों पर निर्भर करता है, शायद प्रति वर्ग फुट आधार मूल्य प्रदान करें?
            // या डिफ़ॉल्ट आकार (जैसे, 1x1 फीट) के लिए गणना करें। अभी के लिए 0 या आधार मूल्य का उपयोग करें।
            return productData.basePriceSqFt ? productData.basePriceSqFt.toString() : "0"; // प्रति वर्ग फुट मूल्य का प्रतिनिधित्व करते हुए
        case 'standard':
        default:
            return productData.price ? productData.price.toString() : "0";
    }
}

// --- ईवेंट श्रोता सेटअप ---
// हटाने की अनुमति देने के लिए श्रोताओं के संदर्भ संग्रहीत करें
let handleAddToCartListener;
let standardQuantityButtonListener;
let weddingQuantityChangeListener;
let flexInputListeners = []; // फ्लेक्स इनपुट के लिए एकाधिक श्रोता संग्रहीत करें

function attachEventListeners(productData) {
    console.log("ईवेंट श्रोता संलग्न किए जा रहे हैं...");

    // --- पिछले श्रोताओं को हटाएं (महत्वपूर्ण) ---
    // यह डुप्लिकेट श्रोताओं को रोकता है यदि renderProductDetails को किसी तरह फिर से कॉल किया जाता है
    if (addToCartBtn && handleAddToCartListener) {
        addToCartBtn.removeEventListener('click', handleAddToCartListener);
        console.log("पिछला कार्ट में जोड़ें श्रोता हटाया गया।");
    }
    if (quantityDecreaseBtn && standardQuantityButtonListener) {
        quantityDecreaseBtn.removeEventListener('click', standardQuantityButtonListener);
    }
    if (quantityIncreaseBtn && standardQuantityButtonListener) {
        quantityIncreaseBtn.removeEventListener('click', standardQuantityButtonListener);
         console.log("पिछले मानक मात्रा श्रोता हटाए गए।");
    }
    if (weddingQuantitySelect && weddingQuantityChangeListener) {
        weddingQuantitySelect.removeEventListener('change', weddingQuantityChangeListener);
        console.log("पिछला वेडिंग मात्रा श्रोता हटाया गया।");
    }
    // पिछले फ्लेक्स श्रोताओं को हटाएं
    flexInputListeners.forEach(({ element, type, listener }) => {
        if (element) element.removeEventListener(type, listener);
    });
    flexInputListeners = []; // ऐरे साफ़ करें
    console.log("पिछले फ्लेक्स इनपुट श्रोता हटाए गए।");


    // --- नए श्रोता जोड़ें ---

    // कार्ट में जोड़ें बटन
    if (addToCartBtn) {
        handleAddToCartListener = () => handleAddToCart(productData); // श्रोता को परिभाषित करें
        addToCartBtn.addEventListener('click', handleAddToCartListener);
        console.log("कार्ट में जोड़ें बटन श्रोता संलग्न किया गया।");
    } else {
        console.error("कार्ट में जोड़ें बटन नहीं मिला।");
    }

    // मानक मात्रा नियंत्रण
    if (quantityDecreaseBtn && quantityIncreaseBtn && quantityInput && currentPricingType === 'standard') {
        standardQuantityButtonListener = (event) => handleStandardQuantityChange(event.target); // श्रोता को परिभाषित करें
        quantityDecreaseBtn.addEventListener('click', standardQuantityButtonListener);
        quantityIncreaseBtn.addEventListener('click', standardQuantityButtonListener);
        console.log("मानक मात्रा बटन श्रोता संलग्न किए गए।");
    }

    // वेडिंग मात्रा चयन
    if (weddingQuantitySelect && currentPricingType === 'wedding') {
        weddingQuantityChangeListener = updateWeddingPriceDisplay; // श्रोता को परिभाषित करें
        weddingQuantitySelect.addEventListener('change', weddingQuantityChangeListener);
        console.log("वेडिंग मात्रा चयन श्रोता संलग्न किया गया।");
    }

    // फ्लेक्स इनपुट नियंत्रण
    if (currentPricingType === 'flex') {
        const inputs = [bannerWidthInput, bannerHeightInput, bannerUnitSelect];
        if (inputs.every(el => el)) { // जांचें कि क्या सभी तत्व मौजूद हैं
            inputs.forEach(input => {
                const eventType = (input.tagName === 'SELECT') ? 'change' : 'input';
                const listener = updateFlexPriceDisplay; // श्रोता को परिभाषित करें
                input.addEventListener(eventType, listener);
                flexInputListeners.push({ element: input, type: eventType, listener }); // श्रोता जानकारी संग्रहीत करें
            });
             console.log("फ्लेक्स इनपुट श्रोता संलग्न किए गए।");
        } else {
             console.error("एक या अधिक फ्लेक्स इनपुट तत्व नहीं मिले।");
        }
    }
}


function handleStandardQuantityChange(button) {
    if (!quantityInput) return;
    let currentValue = parseInt(quantityInput.value, 10) || 1;
    const min = parseInt(quantityInput.min, 10) || 1;
    const step = parseInt(quantityInput.step, 10) || 1;

    if (button.classList.contains('quantity-increase')) {
        currentValue += step;
    } else if (button.classList.contains('quantity-decrease')) {
        currentValue -= step;
    }

    quantityInput.value = Math.max(min, currentValue);
    // नोट: मानक मूल्य निर्धारण आमतौर पर यहां मात्रा के साथ नहीं बदलता है, मूल्य प्रति आइटम है।
    // यदि मूल्य मात्रा पर निर्भर करता है, तो आप यहां मूल्य प्रदर्शन अपडेट करेंगे।
    console.log(`मानक मात्रा अपडेट की गई: ${quantityInput.value}`);
}


// --- कार्ट में जोड़ें तर्क ---
function handleAddToCart(productData) {
    console.log(`'कार्ट में जोड़ें' पर क्लिक किया गया उत्पाद के लिए: ${productData.id}`);
    if (!productData) {
        console.error("कार्ट में नहीं जोड़ा जा सकता: उत्पाद डेटा गायब है।");
        showCartFeedback("त्रुटि: उत्पाद डेटा अनुपलब्ध।", "error");
        return;
    }

    let quantity = 1;
    let price = productData.price || 0;
    let options = {}; // चयनित विकल्प एकत्र करें
    let itemPerCardPrice = null; // विशेष रूप से वेडिंग कार्ड के लिए

    try {
        switch (currentPricingType) {
            case 'wedding':
                if (!weddingQuantitySelect || weddingQuantitySelect.selectedIndex < 0) {
                    throw new Error("कृपया वेडिंग कार्ड के लिए एक मात्रा चुनें।");
                }
                const selectedWeddingOption = weddingQuantitySelect.options[weddingQuantitySelect.selectedIndex];
                quantity = parseInt(selectedWeddingOption.value, 10);
                itemPerCardPrice = parseFloat(selectedWeddingOption.dataset.pricePerCard);

                 if (isNaN(quantity) || quantity <= 0 || isNaN(itemPerCardPrice) || itemPerCardPrice <= 0) {
                     throw new Error("अमान्य वेडिंग मात्रा या प्रति कार्ड मूल्य।");
                 }

                price = quantity * itemPerCardPrice; // चयनित मात्रा के लिए कुल मूल्य
                options['Quantity Tier'] = `${quantity}+ Cards`;
                options['Price Per Card'] = formatPrice(itemPerCardPrice);
                break;
            case 'flex':
                if (!bannerWidthInput || !bannerHeightInput || !bannerUnitSelect || !priceEl) {
                     throw new Error("फ्लेक्स बैनर विवरण अपूर्ण।");
                }
                 const width = parseFloat(bannerWidthInput.value) || 0;
                 const height = parseFloat(bannerHeightInput.value) || 0;
                 const unit = bannerUnitSelect.value;
                 if (width <= 0 || height <= 0) {
                     throw new Error("कृपया फ्लेक्स बैनर के लिए मान्य आयाम दर्ज करें।");
                 }
                 // मूल्य प्रदर्शन से मूल्य प्राप्त करें (क्योंकि यह रीयल-टाइम में अपडेट होता है)
                 price = parseFloat(priceEl.textContent.replace(/[^0-9.]/g, ''));
                 quantity = 1; // फ्लेक्स आमतौर पर विशिष्ट आयामों के साथ एक इकाई के रूप में बेचा जाता है
                 options['Dimensions'] = `${width} x ${height} ${unit}`;
                break;
            case 'standard':
            default:
                if (!quantityInput) {
                     throw new Error("मात्रा इनपुट नहीं मिला।");
                 }
                quantity = parseInt(quantityInput.value, 10) || 1;
                if (quantity < 1) {
                     throw new Error("मात्रा कम से कम 1 होनी चाहिए।");
                 }
                 // मानक मूल्य निर्धारण के लिए उत्पाद डेटा से आधार मूल्य का उपयोग करें
                 price = (productData.price || 0) * quantity; // कुल मूल्य
                 // अन्य मानक विकल्प जोड़ें यदि वे मौजूद हैं (जैसे, आकार, रंग ड्रॉपडाउन)
                 // options['Size'] = document.getElementById('size-select')?.value;
                break;
        }

        // NaN या शून्य मूल्य के लिए जाँच करें (फ्लेक्स के लिए 0 की अनुमति दें यदि गणना की गई हो)
        if (isNaN(price) || (price <= 0 && !(currentPricingType === 'flex' && price === 0))) {
             throw new Error("अमान्य मूल्य गणना की गई। कृपया विकल्प जांचें।");
        }


        const itemDetails = {
            quantity: quantity,
            price: price, // आइटम/मात्रा के लिए कुल मूल्य
            options: options,
            // इकाई मूल्य (add to cart फंक्शन के लिए) - यदि आवश्यक हो तो गणना करें
            unitPrice: (currentPricingType === 'standard') ? (productData.price || 0) : (price / quantity),
            perCardPrice: itemPerCardPrice // गैर-वेडिंग आइटम के लिए शून्य होगा
        };

        console.log("पॉपअप के लिए तैयार आइटम विवरण:", itemDetails);
        showConfirmationPopup(itemDetails, productData);

    } catch (error) {
        console.error("कार्ट के लिए आइटम तैयार करने में त्रुटि:", error);
        showCartFeedback(error.message || "आइटम तैयार नहीं किया जा सका। कृपया चयन जांचें।", "error");
    }
}

// --- पॉपअप प्रबंधन ---
// उचित निष्कासन की अनुमति देने के लिए श्रोता कार्यों को संग्रहीत करें
let handleConfirmAdd;
let handleCancelPopup;
let handleClosePopup;

function showConfirmationPopup(itemDetails, productData) {
    console.log("पुष्टिकरण पॉपअप दिखाया जा रहा है...");
    if (!popupOverlay || !productData || !itemDetails) {
        console.error("पॉपअप तत्व, उत्पाद डेटा, या आइटम विवरण गायब हैं।");
        return;
    }

    // पॉपअप सामग्री भरें
    popupProductName.textContent = productData.name || 'Product';
    popupProductImage.src = productData.imageUrls?.[0] || 'images/placeholder.png'; // पाथ जांचें
    popupProductImage.alt = productData.name || 'Product';
    popupProductQuantity.textContent = itemDetails.quantity;
    popupProductPrice.textContent = formatPrice(itemDetails.price); // कुल मूल्य प्रदर्शित करें

    // विकल्प प्रदर्शित करें
    let optionsText = Object.entries(itemDetails.options)
        .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
        .join('<br>');
    popupProductOptions.innerHTML = optionsText;

    // प्रति-कार्ड मूल्य केवल वेडिंग कार्ड के लिए प्रदर्शित करें
    if (itemDetails.perCardPrice !== null && itemDetails.perCardPrice > 0) {
        popupPerCardPrice.textContent = `${formatPrice(itemDetails.perCardPrice)} per card`;
        popupPerCardPrice.style.display = 'block';
    } else {
        popupPerCardPrice.textContent = '';
        popupPerCardPrice.style.display = 'none';
    }


    // श्रोताओं को जोड़ने से *पहले* परिभाषित करें
    handleConfirmAdd = () => {
        console.log("पुष्टि बटन पर क्लिक किया गया।");
        try {
            // addToCart को यूनिट मूल्य भेजें (यदि आवश्यक हो)
            const unitPriceForCart = itemDetails.unitPrice || (itemDetails.price / itemDetails.quantity);
            addToCart(
                productData.id,
                itemDetails.quantity,
                unitPriceForCart, // कार्ट फ़ंक्शन में इकाई मूल्य भेजें
                productData.name,
                productData.imageUrls?.[0] || 'images/placeholder.png', // पाथ जांचें
                itemDetails.options,
                itemDetails.perCardPrice // यदि उपलब्ध हो तो perCardPrice पास करें
            );
            showCartFeedback("आइटम सफलतापूर्वक जोड़ा गया!", "success", true); // प्रतिक्रिया और कार्ट देखें बटन दिखाएं
            updateCartCount(); // हेडर कार्ट गणना अपडेट करें
        } catch (error) {
            console.error("कार्ट में आइटम जोड़ने में त्रुटि:", error);
            showCartFeedback("कार्ट में आइटम जोड़ने में त्रुटि। कृपया पुनः प्रयास करें।", "error");
        } finally {
            hidePopup();
        }
    };

    handleCancelPopup = () => {
        console.log("रद्द करें बटन पर क्लिक किया गया।");
        hidePopup();
    };

    handleClosePopup = () => {
         console.log("पॉपअप बंद करें बटन पर क्लिक किया गया।");
         hidePopup();
    }


    // *** नए जोड़ने से पहले मौजूदा श्रोताओं को हटाएं ***
    popupConfirmBtn.removeEventListener('click', handleConfirmAdd);
    popupCancelBtn.removeEventListener('click', handleCancelPopup);
    popupCloseBtn?.removeEventListener('click', handleClosePopup); // क्लोज बटन के लिए वैकल्पिक चेनिंग का उपयोग करें

    // नए श्रोता जोड़ें
    popupConfirmBtn.addEventListener('click', handleConfirmAdd);
    popupCancelBtn.addEventListener('click', handleCancelPopup);
    popupCloseBtn?.addEventListener('click', handleClosePopup); // वैकल्पिक चेनिंग का उपयोग करें

    // पॉपअप दिखाएं
    popupOverlay.classList.add('active');
     console.log("पॉपअप प्रदर्शित किया गया और श्रोता संलग्न किए गए।");
}

function hidePopup() {
    if (!popupOverlay) return;
    console.log("पॉपअप छिपाया जा रहा है...");
    popupOverlay.classList.remove('active');

    // *** छिपाने पर श्रोताओं को हटाएं ***
    popupConfirmBtn.removeEventListener('click', handleConfirmAdd);
    popupCancelBtn.removeEventListener('click', handleCancelPopup);
    popupCloseBtn?.removeEventListener('click', handleClosePopup); // वैकल्पिक चेनिंग का उपयोग करें

     console.log("पॉपअप छिपाया गया और श्रोता हटा दिए गए।");

    // वैकल्पिक: यदि चाहें तो संग्रहीत श्रोता कार्यों को रीसेट करें, हालांकि उन्हें हटाना मुख्य भाग है
    handleConfirmAdd = null;
    handleCancelPopup = null;
    handleClosePopup = null;
}

// --- कार्ट प्रतिक्रिया ---
function showCartFeedback(message, type = 'success', showViewCart = false) {
    if (!cartFeedbackEl) return;

    console.log(`कार्ट प्रतिक्रिया (${type}): ${message}`);
    cartFeedbackEl.textContent = message;
    cartFeedbackEl.className = `cart-feedback-message ${type}`; // कक्षाएं रीसेट करें और नई जोड़ें
    cartFeedbackEl.style.display = 'block';

    // सफलता के आधार पर कार्ट देखें बटन दिखाएं/छिपाएं
     if (viewCartButton) {
        viewCartButton.style.display = showViewCart ? 'inline-flex' : 'none';
     }


    // वैकल्पिक: देरी के बाद संदेश छिपाएं
    // setTimeout(() => {
    //     cartFeedbackEl.style.display = 'none';
    //      if (viewCartButton) viewCartButton.style.display = 'none'; // संदेश के साथ बटन छिपाएं
    // }, 5000); // 5 सेकंड के बाद छिपाएं
}

// --- संबंधित उत्पाद ---
async function loadRelatedProducts(category, currentProductId) {
    if (!relatedProductsSection || !relatedProductsContainer) {
        console.log("संबंधित उत्पाद अनुभाग/कंटेनर नहीं मिला, छोड़ा जा रहा है।");
        return;
    }
    showLoading('related'); // इस अनुभाग के लिए विशेष रूप से लोडिंग इंगित करें

    try {
        console.log(`श्रेणी के लिए संबंधित उत्पाद प्राप्त किए जा रहे हैं: ${category}, आईडी को छोड़कर: ${currentProductId}`);
        const productsRef = collection(db, "onlineProducts");
        // समान श्रेणी में उत्पादों के लिए क्वेरी, वर्तमान को छोड़कर, परिणाम सीमित करें
        const q = query(
            productsRef,
            where("category", "==", category),
            // where(documentId(), "!=", currentProductId), // Firestore जटिल क्वेरी में आईडी पर प्रत्यक्ष असमानता का आसानी से समर्थन नहीं करता है
            limit(10) // संबंधित उत्पादों की संख्या सीमित करें
        );
        const querySnapshot = await getDocs(q);

        relatedProductsContainer.innerHTML = ''; // पिछली सामग्री/लोडर साफ़ करें
        let count = 0;
        const slides = [];

        querySnapshot.forEach((docSnap) => {
            // वर्तमान उत्पाद को बाहर करने के लिए मैन्युअल जांच
            if (docSnap.id !== currentProductId) {
                 const product = { id: docSnap.id, ...docSnap.data() };
                 // केवल आवश्यक जानकारी (नाम, मूल्य, छवि) वाले उत्पादों को शामिल करें
                 if (product.name && (product.price || product.weddingPricing || product.basePriceSqFt) && product.imageUrls?.[0]) {
                    slides.push(createRelatedProductSlide(product));
                    count++;
                 } else {
                     console.warn(`लापता डेटा के कारण संबंधित उत्पाद (${product.id}) को छोड़ा जा रहा है।`);
                 }

            }
        });

        if (count > 0) {
             // स्वाइपर रैपर और आवश्यक नेविगेशन बटन डालें
             relatedProductsContainer.innerHTML = `
                <div class="swiper related-products-swiper">
                    <div class="swiper-wrapper">
                        ${slides.join('')}
                    </div>
                    <div class="swiper-pagination"></div>
                    <div class="swiper-button-prev"></div>
                    <div class="swiper-button-next"></div>
                </div>
            `;
            relatedProductsSection.style.display = 'block'; // अनुभाग दिखाएं
            initializeRelatedProductsSwiper(); // स्लाइड जोड़ने के बाद स्वाइपर प्रारंभ करें
             console.log(`${count} संबंधित उत्पाद लोड किए गए।`);
        } else {
            relatedProductsSection.style.display = 'none'; // यदि कोई संबंधित उत्पाद नहीं मिला तो अनुभाग छिपाएं
             console.log("कोई उपयुक्त संबंधित उत्पाद नहीं मिला।");
        }

    } catch (error) {
        console.error("संबंधित उत्पाद प्राप्त करने में त्रुटि:", error);
        relatedProductsContainer.innerHTML = '<p>संबंधित उत्पाद लोड नहीं किए जा सके।</p>'; // कंटेनर में त्रुटि दिखाएं
        relatedProductsSection.style.display = 'block'; // त्रुटि दिखाने के लिए अनुभाग दृश्यमान सुनिश्चित करें
    }
}


function createRelatedProductSlide(product) {
    const priceDisplay = getProductPriceForCard(product); // उपयुक्त मूल्य प्रदर्शन प्राप्त करें
    const imageUrl = product.imageUrls?.[0] || 'images/placeholder.png'; // पाथ जांचें
    const productUrl = `product-detail.html?id=${product.id}`;

    // स्वाइपर स्लाइड संरचना का उपयोग करना
    return `
        <div class="swiper-slide">
            <div class="product-card">
                <a href="${productUrl}" class="product-image-container">
                    <img src="${imageUrl}" alt="${product.name || 'Product'}" loading="lazy">
                </a>
                <div class="product-info">
                    <h3><a href="${productUrl}">${product.name || 'N/A'}</a></h3>
                    <div class="price">${priceDisplay}</div>
                    <a href="${productUrl}" class="view-details-btn">View Details</a>
                </div>
            </div>
        </div>
    `;
}

function getProductPriceForCard(product) {
    // उत्पाद कार्ड पर एक प्रतिनिधि मूल्य प्रदर्शित करने में सहायक
    switch (product.pricingType) {
        case 'wedding':
            const weddingTiers = product.weddingPricing || [];
            const sortedTiers = [...weddingTiers].sort((a,b) => a.minQuantity - b.minQuantity);
            const lowestTier = sortedTiers[0];
            return lowestTier ? `${formatPrice(lowestTier.pricePerCard)}/card (for ${lowestTier.minQuantity}+)` : 'Price Varies';
        case 'flex':
            return product.basePriceSqFt ? `${formatPrice(product.basePriceSqFt)}/sq.ft` : 'Price Varies';
        case 'standard':
        default:
            return formatPrice(product.price || 0);
    }
}


function initializeRelatedProductsSwiper() {
    // इसे कॉल करने से पहले सुनिश्चित करें कि स्वाइपर लाइब्रेरी लोड हो गई है
     if (typeof Swiper === 'undefined') {
         console.error("स्वाइपर लाइब्रेरी लोड नहीं है।");
         return;
     }

     // जांचें कि क्या कंटेनर पर स्वाइपर इंस्टेंस पहले से मौजूद है और इसे नष्ट कर दें
     const swiperContainer = relatedProductsContainer.querySelector('.related-products-swiper');
     if (!swiperContainer) {
          console.error("स्वाइपर कंटेनर तत्व नहीं मिला।");
          return;
     }

    if (swiperContainer.swiper) {
        swiperContainer.swiper.destroy(true, true);
         console.log("मौजूदा स्वाइपर इंस्टेंस नष्ट किया गया।");
    }


    // स्वाइपर प्रारंभ करें
    const swiper = new Swiper('.related-products-swiper', {
        slidesPerView: 2, // प्रारंभ में मोबाइल पर 2 स्लाइड दिखाएं
        spaceBetween: 15,
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
        breakpoints: {
            // जब विंडो की चौड़ाई >= 576px हो
            576: { slidesPerView: 2, spaceBetween: 20 },
            // जब विंडो की चौड़ाई >= 768px हो
            768: { slidesPerView: 3, spaceBetween: 25 },
            // जब विंडो की चौड़ाई >= 992px हो
            992: { slidesPerView: 4, spaceBetween: 30 },
             // जब विंडो की चौड़ाई >= 1200px हो
             1200: { slidesPerView: 5, spaceBetween: 30 }
        },
         // गतिशील सामग्री लोडिंग के लिए ऑब्जर्वर और ऑब्जर्वपेरेंट्स जोड़ें
         observer: true,
         observeParents: true,
    });
     console.log("संबंधित उत्पाद स्वाइपर प्रारंभ किया गया।");
}


// --- Tabs ---
function setupTabs() {
     if (!tabsNav || !tabPanes.length) {
          console.warn("टैब सेटअप छोड़ा गया: नेव या पैन नहीं मिले।");
          return; // यदि टैब तत्व मौजूद नहीं हैं तो बाहर निकलें
     }

     console.log("टैब सेटअप किया जा रहा है...");

    // डिफ़ॉल्ट रूप से पहले टैब और पैन को सक्रिय के रूप में सेट करें
    const firstTabLink = tabsNav.querySelector('li a');
    const firstPaneId = firstTabLink?.getAttribute('href');
    if (firstTabLink && firstPaneId && firstPaneId.startsWith('#')) { // सुनिश्चित करें कि href एक आईडी है
        tabsNav.querySelectorAll('li a').forEach(link => link.classList.remove('active'));
        tabPanes.forEach(pane => pane.classList.remove('active'));

        firstTabLink.classList.add('active');
        try {
            const firstPane = document.querySelector(firstPaneId);
            if (firstPane) {
                firstPane.classList.add('active');
                console.log(`डिफ़ॉल्ट सक्रिय टैब सेट किया गया: ${firstPaneId}`);
            } else {
                 console.error(`डिफ़ॉल्ट सक्रिय पैन (${firstPaneId}) नहीं मिला।`);
            }
        } catch (e) {
            console.error(`अमान्य चयनकर्ता ${firstPaneId} के साथ पैन खोजने में त्रुटि:`, e);
        }

    } else {
         console.warn("डिफ़ॉल्ट सक्रिय टैब सेट नहीं किया जा सका। पहला लिंक या मान्य href गायब है।");
    }


    // नेविगेशन कंटेनर में क्लिक इवेंट श्रोता जोड़ें (इवेंट डेलिगेशन)
    tabsNav.addEventListener('click', (e) => {
        // जांचें कि क्या क्लिक किया गया तत्व एक टैब लिंक (<a> टैग) है और एक आईडी href है
        if (e.target.tagName === 'A' && e.target.getAttribute('href')?.startsWith('#')) {
            e.preventDefault(); // डिफ़ॉल्ट एंकर लिंक व्यवहार रोकें

            const targetPaneId = e.target.getAttribute('href');
            console.log(`टैब क्लिक किया गया: ${targetPaneId}`);

            // सभी टैब लिंक और पैन से 'सक्रिय' वर्ग हटाएं
            tabsNav.querySelectorAll('li a').forEach(link => link.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));

            // क्लिक किए गए टैब लिंक में 'सक्रिय' वर्ग जोड़ें
            e.target.classList.add('active');

            // संबंधित टैब पैन में 'सक्रिय' वर्ग जोड़ें
            try {
                 const targetPane = document.querySelector(targetPaneId);
                 if (targetPane) {
                     targetPane.classList.add('active');
                 } else {
                     console.error(`लक्ष्य पैन (${targetPaneId}) नहीं मिला।`);
                 }
            } catch (er) {
                 console.error(`अमान्य चयनकर्ता ${targetPaneId} के साथ पैन खोजने में त्रुटि:`, er);
            }
        }
    });
     console.log("टैब क्लिक श्रोता तैयार हैं।");
}


// --- समीक्षाएं ---
async function loadReviews(productId) {
    const reviewsList = document.getElementById('reviews-list');
    const reviewsSummary = document.querySelector('.reviews-summary'); // औसत रेटिंग/गणना दिखाने के लिए तत्व
    if (!reviewsList || !reviewsSummary) {
         console.warn("समीक्षा सूची या सारांश तत्व नहीं मिला, समीक्षा लोडिंग छोड़ी जा रही है।");
         return;
    }

    reviewsList.innerHTML = '<li>Loading reviews...</li>'; // लोडिंग इंगित करें
    reviewsSummary.textContent = ''; // सारांश साफ़ करें

    try {
        console.log(`उत्पाद आईडी के लिए समीक्षाएं प्राप्त की जा रही हैं: ${productId}`);
        const reviewsRef = collection(db, "onlineProducts", productId, "reviews");
        const q = query(reviewsRef, orderBy("timestamp", "desc")); // नवीनतम समीक्षाएं पहले प्राप्त करें
        const querySnapshot = await getDocs(q);

        reviewsList.innerHTML = ''; // लोडिंग संदेश साफ़ करें
        let totalRating = 0;
        let reviewCount = 0;

        if (querySnapshot.empty) {
            reviewsList.innerHTML = '<li>Be the first to review this product!</li>';
             reviewsSummary.textContent = 'No reviews yet.';
        } else {
            querySnapshot.forEach((doc) => {
                const review = doc.data();
                if (review.rating && review.comment && review.userName) { // मूल सत्यापन
                    const li = document.createElement('li');
                    li.classList.add('review-item');
                    li.innerHTML = `
                        <div class="review-rating">${generateStarRating(review.rating)}</div>
                        <p class="review-comment">${escapeHTML(review.comment)}</p>
                        <p class="review-meta">By <strong>${escapeHTML(review.userName)}</strong> on ${review.timestamp?.toDate().toLocaleDateString() || 'N/A'}</p>
                    `;
                    reviewsList.appendChild(li);
                    totalRating += Number(review.rating);
                    reviewCount++;
                }
            });

            if (reviewCount > 0) {
                 const averageRating = (totalRating / reviewCount).toFixed(1);
                 reviewsSummary.innerHTML = `Average Rating: ${generateStarRating(averageRating)} (${averageRating} out of 5) based on ${reviewCount} review(s).`;
                 console.log(`लोड की गई ${reviewCount} समीक्षाएं। औसत रेटिंग: ${averageRating}`);
            } else {
                 reviewsList.innerHTML = '<li>No valid reviews found.</li>';
                 reviewsSummary.textContent = 'No reviews yet.';
            }

        }
    } catch (error) {
        console.error("समीक्षाएं प्राप्त करने में त्रुटि:", error);
        reviewsList.innerHTML = '<li>Could not load reviews. Please try again later.</li>';
         reviewsSummary.textContent = 'Could not load rating.';
    }

    // समीक्षा फ़ॉर्म श्रोता सेटअप करें (भले ही समीक्षाएं लोड हुई हों या नहीं)
    setupReviewForm(productId);
}

function generateStarRating(ratingStrOrNum) {
    const rating = Number(ratingStrOrNum); // संख्या में कनवर्ट करें
    if (isNaN(rating) || rating < 0) return 'No Rating'; // अमान्य रेटिंग संभालें

    const totalStars = 5;
    let starsHTML = '';
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.45 ? 1 : 0; // आधे स्टार के लिए थोड़ी सहनशीलता
    const emptyStars = totalStars - fullStars - halfStar;

    for (let i = 0; i < fullStars; i++) starsHTML += '<i class="fas fa-star"></i>';
    if (halfStar) starsHTML += '<i class="fas fa-star-half-alt"></i>';
    for (let i = 0; i < emptyStars; i++) starsHTML += '<i class="far fa-star"></i>'; // खाली सितारों के लिए far का उपयोग करें

    return starsHTML || 'No Rating'; // उस स्थिति को संभालें जहां रेटिंग 0 हो सकती है
}

function setupReviewForm(productId) {
    const reviewForm = document.getElementById('review-form');
    const formMessage = document.getElementById('review-form-message');
    if (!reviewForm || !formMessage) {
        console.warn("समीक्षा फ़ॉर्म या संदेश तत्व नहीं मिला, सेटअप छोड़ा जा रहा है।");
        return;
    }

     console.log("समीक्षा फ़ॉर्म श्रोता सेटअप किया जा रहा है।");

    reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        formMessage.textContent = '';
        formMessage.className = ''; // पिछली स्थिति कक्षाएं साफ़ करें
        const submitButton = reviewForm.querySelector('button[type="submit"]');
        if (submitButton) { // जांचें कि क्या बटन मौजूद है
           submitButton.disabled = true;
           submitButton.textContent = 'Submitting...';
        }

        try {
            const rating = reviewForm.querySelector('input[name="rating"]:checked')?.value;
            const userName = reviewForm.querySelector('#reviewer-name').value.trim();
            const comment = reviewForm.querySelector('#review-comment').value.trim();

            if (!rating || !userName || !comment) {
                throw new Error("Please fill in all fields and select a rating.");
            }
            if (userName.length < 2) {
                 throw new Error("Name must be at least 2 characters long.");
            }
             if (comment.length < 10) {
                 throw new Error("Comment must be at least 10 characters long.");
            }


            const reviewsRef = collection(db, "onlineProducts", productId, "reviews");
            await addDoc(reviewsRef, {
                rating: Number(rating),
                userName: userName,
                comment: comment,
                timestamp: serverTimestamp()
            });

            formMessage.textContent = 'Review submitted successfully! Thank you.';
            formMessage.className = 'success'; // सफलता वर्ग जोड़ें
            reviewForm.reset(); // फ़ॉर्म साफ़ करें
             console.log("समीक्षा प्रस्तुत की गई।");

            // वैकल्पिक: सबमिशन के बाद समीक्षाएं पुनः लोड करें
             setTimeout(() => loadReviews(productId), 1000); // 1 सेकंड के बाद पुनः लोड करें

        } catch (error) {
            console.error("समीक्षा सबमिट करने में त्रुटि:", error);
            formMessage.textContent = `Error: ${error.message || "Could not submit review."}`;
            formMessage.className = 'error'; // त्रुटि वर्ग जोड़ें
        } finally {
             if (submitButton) { // जांचें कि क्या बटन मौजूद है
                 submitButton.disabled = false;
                 submitButton.textContent = 'Submit Review';
             }
        }
    });
}

// XSS को रोकने के लिए HTML एस्केप करने की उपयोगिता
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}


// --- Initialize Page ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM पूरी तरह से लोड हो गया।");
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        showError("URL में उत्पाद आईडी नहीं मिली। कृपया दुकान पर वापस जाएं और एक उत्पाद चुनें।");
        return;
    }

    console.log(`उत्पाद आईडी के लिए पृष्ठ प्रारंभ किया जा रहा है: ${productId}`);
    loadProductDetails(productId); // डेटा प्राप्त करें और रेंडर करें, इसमें ईवेंट श्रोताओं को संलग्न करना शामिल है

    // पृष्ठ लोड पर प्रारंभिक कार्ट गणना अपडेट
    updateCartCount();
});