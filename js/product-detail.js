// js/product-detail.js
// FINAL Version: Includes ALL requested updates (Popup Icons, Font Pop, Flex Options, Price Calc Check, Repeat Add Fix, Flex Design Simplicity)

// --- Imports ---
import { db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, limit, getDocs, addDoc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { addToCart } from './cart.js';
import { updateCartCount } from './main.js'; // Ensure main.js exports this

// --- DOM Elements ---
const productDetailContainer = document.getElementById('product-detail-container');
const loadingIndicator = productDetailContainer?.querySelector('.loading-indicator');
const productContent = productDetailContainer?.querySelector('.product-content');
const errorMessageContainer = document.getElementById('error-message-container');
const breadcrumbProductName = document.getElementById('breadcrumb-product-name');
const productNameEl = document.getElementById('product-name');
const mainImageEl = document.getElementById('main-product-image');
const thumbnailImagesContainer = document.getElementById('thumbnail-images');
const priceEl = document.getElementById('product-price');
const originalPriceEl = document.getElementById('original-price');
const weddingPerCardPriceEl = document.getElementById('wedding-per-card-price');
const addToCartBtn = document.getElementById('add-to-cart-btn');
const cartFeedbackEl = document.getElementById('cart-feedback'); // Ensure this exists or add it
const viewCartBtn = document.getElementById('view-cart-btn'); // Ensure this exists or add it
const productOptionsContainer = document.getElementById('product-options-container');
const descriptionTab = document.getElementById('description-tab-content');
const specificationsTab = document.getElementById('specifications-tab-content');
const reviewsTab = document.getElementById('reviews-tab-content'); // Assuming you might add reviews
const relatedProductsContainer = document.getElementById('related-products-grid');

// Popup Elements
const confirmationPopup = document.getElementById('confirmation-popup');
const popupImage = document.getElementById('popup-product-image');
const popupName = document.getElementById('popup-product-name');
const popupQuantity = document.getElementById('popup-product-quantity');
const popupPrice = document.getElementById('popup-product-price');
const popupOptions = document.getElementById('popup-product-options'); // To show selected options
const popupPerCardPrice = document.getElementById('popup-per-card-price'); // For wedding cards in popup
const popupConfirmBtn = document.getElementById('popup-confirm-add');
const popupCancelBtn = document.getElementById('popup-cancel');
const closePopupBtn = confirmationPopup?.querySelector('.close-popup');

// Flex Banner Inputs (will be created dynamically)
let bannerWidthInput, bannerHeightInput, bannerUnitSelect, bannerQuantityInput;

let currentProductData = null; // Store loaded product data globally for reuse

// --- Utility Functions ---
function showLoading(isLoading) {
    if (!productDetailContainer) return;
    if (isLoading) {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if (productContent) productContent.style.display = 'none';
        hideError(); // Hide error when loading starts
    } else {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (productContent) productContent.style.display = 'block';
    }
}

function showError(message) {
    console.error("Error:", message);
    if (errorMessageContainer) {
        errorMessageContainer.textContent = message;
        errorMessageContainer.style.display = 'block';
    }
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (productContent) productContent.style.display = 'none'; // Hide content on error
}

function hideError() {
    if (errorMessageContainer) {
        errorMessageContainer.style.display = 'none';
    }
}

function formatPrice(price) {
    return `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// --- Product Data Loading ---
async function loadProductDetails(productId) {
    if (!productId) {
        showError("Invalid Product ID.");
        return;
    }
    showLoading(true);
    try {
        const productRef = doc(db, "onlineProducts", productId); // Changed collection name
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
            currentProductData = { id: productSnap.id, ...productSnap.data() };
            console.log("Product data loaded:", currentProductData);
            renderProductDetails(currentProductData);
            loadRelatedProducts(currentProductData.category, productId); // Load related products
            setupEventListeners(); // Setup listeners after rendering
        } else {
            showError("Product not found.");
            currentProductData = null;
        }
    } catch (error) {
        showError(`Failed to load product details: ${error.message}`);
        console.error("Firestore error:", error);
        currentProductData = null;
    } finally {
        showLoading(false);
    }
}

// --- Rendering Functions ---
function renderProductDetails(product) {
    if (!product) return;

    // Update Breadcrumbs & Title
    if (breadcrumbProductName) breadcrumbProductName.textContent = product.productName;
    document.title = `${product.productName} - Madhav Multiprint`;
    if (productNameEl) productNameEl.textContent = product.productName;

    // Update Image Gallery
    renderImageGallery(product.imageUrls || [product.imageUrl]); // Use imageUrls if available

    // Update Pricing
    renderPrice(product);

    // Update Description & Specs
    if (descriptionTab) descriptionTab.innerHTML = product.description || 'No description available.';
    if (specificationsTab) renderSpecifications(product.specifications); // Assuming specs is an object

    // Clear and Render Options (Wedding, Flex, etc.)
    if (productOptionsContainer) {
        productOptionsContainer.innerHTML = ''; // Clear previous options
        if (product.type === 'wedding_card' && product.quantityOptions) {
            createWeddingOptions(product);
        } else if (product.type === 'flex_banner' && product.pricePerSqFt) {
            createFlexOptions(product);
        } else {
            // Default quantity input (if needed for other types)
             createDefaultQuantityOption();
        }
    } else {
        console.warn("productOptionsContainer not found in DOM.");
    }

    // Update Structured Data
    updateProductSchema(product);

    // Initial UI state
    if (cartFeedbackEl) cartFeedbackEl.style.display = 'none';
    if (viewCartBtn) viewCartBtn.style.display = 'none';
    if (addToCartBtn) addToCartBtn.disabled = false;
}

function renderImageGallery(imageUrls) {
    if (!mainImageEl || !thumbnailImagesContainer) return;
    thumbnailImagesContainer.innerHTML = ''; // Clear existing thumbnails

    if (!imageUrls || imageUrls.length === 0) {
        mainImageEl.src = 'images/placeholder.png'; // Default placeholder
        mainImageEl.alt = 'No Image Available';
        return;
    }

    mainImageEl.src = imageUrls[0]; // Set main image to the first one
    mainImageEl.alt = productNameEl?.textContent || 'Product Image';

    imageUrls.forEach((url, index) => {
        const img = document.createElement('img');
        img.src = url;
        img.alt = `Thumbnail ${index + 1}`;
        img.dataset.full = url; // Store full image URL
        if (index === 0) img.classList.add('active'); // Mark first as active
        img.addEventListener('click', () => {
            mainImageEl.src = url;
            mainImageEl.alt = productNameEl?.textContent || 'Product Image';
            // Update active thumbnail
            thumbnailImagesContainer.querySelectorAll('img').forEach(thumb => thumb.classList.remove('active'));
            img.classList.add('active');
        });
        thumbnailImagesContainer.appendChild(img);
    });
}

function renderPrice(product) {
    if (!priceEl) return;

    if (product.type === 'wedding_card' || product.type === 'flex_banner') {
        // Price is dynamic, show a base indicator or leave blank initially
        priceEl.textContent = product.type === 'wedding_card' ? 'Select Quantity' : 'Enter Dimensions';
        if (originalPriceEl) originalPriceEl.style.display = 'none';
        if (weddingPerCardPriceEl) weddingPerCardPriceEl.style.display = 'none'; // Hide per-card initially
    } else {
        // Standard pricing
        priceEl.textContent = formatPrice(product.price || 0);
        if (originalPriceEl) {
            if (product.originalPrice && product.originalPrice > product.price) {
                originalPriceEl.textContent = formatPrice(product.originalPrice);
                originalPriceEl.style.display = 'inline';
            } else {
                originalPriceEl.style.display = 'none';
            }
        }
         if (weddingPerCardPriceEl) weddingPerCardPriceEl.style.display = 'none';
    }
}

function renderSpecifications(specs) {
    if (!specs || typeof specs !== 'object' || Object.keys(specs).length === 0) {
        specificationsTab.innerHTML = '<p>No specifications available.</p>';
        return;
    }
    let specsHtml = '<ul>';
    for (const [key, value] of Object.entries(specs)) {
        if (value) { // Only show specs with a value
            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()); // Format camelCase to Title Case
            specsHtml += `<li><strong>${formattedKey}:</strong> ${value}</li>`;
        }
    }
    specsHtml += '</ul>';
    specificationsTab.innerHTML = specsHtml;
}

function updateProductSchema(product) {
    const schemaElement = document.getElementById('product-schema');
    if (!schemaElement) return;

    const schema = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": product.productName,
        "image": product.imageUrls || [product.imageUrl],
        "description": product.description,
        "sku": product.id, // Use Firestore ID as SKU
        "brand": { "@type": "Brand", "name": "Madhav Multiprint" },
        "offers": {
            "@type": "Offer",
            "url": window.location.href,
            "priceCurrency": "INR",
            // Price might be variable, setting a default or range if possible
            "price": product.price || (product.quantityOptions ? product.quantityOptions[0]?.price : '0'), // Example: Use base price or first option
            "availability": "https://schema.org/InStock", // Assuming products are generally in stock
            "itemCondition": "https://schema.org/NewCondition"
        }
        // Add reviews, aggregateRating if available later
    };
    schemaElement.textContent = JSON.stringify(schema);
}

// --- Option Creation Functions ---

function createWeddingOptions(product) {
    if (!productOptionsContainer || !product.quantityOptions) return;

    const group = document.createElement('div');
    group.className = 'option-group';

    const label = document.createElement('label');
    label.htmlFor = 'wedding-quantity-select';
    label.textContent = 'Select Quantity:';
    group.appendChild(label);

    const select = document.createElement('select');
    select.id = 'wedding-quantity-select';
    select.name = 'quantity';

    // Add a default placeholder option
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = '-- Select Quantity --';
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    select.appendChild(placeholderOption);


    product.quantityOptions.forEach(option => {
        const opt = document.createElement('option');
        opt.value = `${option.quantity}-${option.price}`; // Store both quantity and price
        opt.textContent = `${option.quantity} Cards - ${formatPrice(option.price)}`;
        opt.dataset.quantity = option.quantity;
        opt.dataset.price = option.price;
        opt.dataset.perCardPrice = (option.price / option.quantity).toFixed(2); // Calculate per-card price
        select.appendChild(opt);
    });

    group.appendChild(select);
    productOptionsContainer.appendChild(group);

    // Add listener to update price display when selection changes
    select.addEventListener('change', updateWeddingPriceDisplay);
}

// MODIFIED: Create Flex Banner Options (Point 3 & 6/7 - Simplified)
function createFlexOptions(product) {
    if (!productOptionsContainer || !product.pricePerSqFt) return;

    const flexDiv = document.createElement('div');
    flexDiv.className = 'flex-options'; // Add class for specific styling

    const title = document.createElement('h4');
    title.textContent = 'Enter Dimensions & Quantity:'; // More concise title
    flexDiv.appendChild(title);

    const gridDiv = document.createElement('div'); // Use a grid for inputs
    gridDiv.className = 'option-grid';

    // --- Width Input ---
    const widthGroup = document.createElement('div');
    widthGroup.className = 'option-group';
    const widthLabel = document.createElement('label');
    widthLabel.htmlFor = 'banner-width';
    widthLabel.textContent = 'Width:';
    bannerWidthInput = document.createElement('input');
    bannerWidthInput.type = 'text'; // Use text to allow decimals like 4.5
    bannerWidthInput.id = 'banner-width';
    bannerWidthInput.name = 'width';
    bannerWidthInput.placeholder = 'e.g., 4.5'; // Allow decimals
    bannerWidthInput.required = true;
    widthGroup.appendChild(widthLabel);
    widthGroup.appendChild(bannerWidthInput);
    gridDiv.appendChild(widthGroup);

    // --- Height Input ---
    const heightGroup = document.createElement('div');
    heightGroup.className = 'option-group';
    const heightLabel = document.createElement('label');
    heightLabel.htmlFor = 'banner-height';
    heightLabel.textContent = 'Height:';
    bannerHeightInput = document.createElement('input');
    bannerHeightInput.type = 'text'; // Use text for decimals
    bannerHeightInput.id = 'banner-height';
    bannerHeightInput.name = 'height';
    bannerHeightInput.placeholder = 'e.g., 2';
    bannerHeightInput.required = true;
    heightGroup.appendChild(heightLabel);
    heightGroup.appendChild(bannerHeightInput);
    gridDiv.appendChild(heightGroup);

    // --- Unit Select ---
    const unitGroup = document.createElement('div');
    unitGroup.className = 'option-group unit-select';
    const unitLabel = document.createElement('label');
    unitLabel.htmlFor = 'banner-unit';
    unitLabel.textContent = 'Unit:';
    bannerUnitSelect = document.createElement('select');
    bannerUnitSelect.id = 'banner-unit';
    bannerUnitSelect.name = 'unit';
    ['Feet', 'Inches'].forEach(unit => {
        const opt = document.createElement('option');
        opt.value = unit.toLowerCase();
        opt.textContent = unit;
        bannerUnitSelect.appendChild(opt);
    });
    unitGroup.appendChild(unitLabel);
    unitGroup.appendChild(bannerUnitSelect);
    gridDiv.appendChild(unitGroup);

    // --- Quantity Input (No +/- buttons) ---
    const quantityGroup = document.createElement('div');
    quantityGroup.className = 'option-group';
    const quantityLabel = document.createElement('label');
    quantityLabel.htmlFor = 'banner-quantity';
    quantityLabel.textContent = 'Quantity:';
    bannerQuantityInput = document.createElement('input');
    bannerQuantityInput.type = 'number';
    bannerQuantityInput.id = 'banner-quantity';
    bannerQuantityInput.name = 'quantity';
    bannerQuantityInput.value = '1';
    bannerQuantityInput.min = '1';
    bannerQuantityInput.step = '1';
    bannerQuantityInput.required = true;
    quantityGroup.appendChild(quantityLabel);
    quantityGroup.appendChild(bannerQuantityInput);
    gridDiv.appendChild(quantityGroup);

    flexDiv.appendChild(gridDiv);
    productOptionsContainer.appendChild(flexDiv);

    // Add listeners for price updates
    setupFlexInputListeners();
}

function createDefaultQuantityOption() {
     if (!productOptionsContainer) return;
     // Basic quantity input for standard products if needed
     const group = document.createElement('div');
     group.className = 'option-group';
     const label = document.createElement('label');
     label.htmlFor = 'product-quantity';
     label.textContent = 'Quantity:';

     const inputContainer = document.createElement('div');
     inputContainer.className = 'input-with-buttons'; // Use existing style

     const decreaseBtn = document.createElement('button');
     decreaseBtn.type = 'button';
     decreaseBtn.className = 'quantity-decrease';
     decreaseBtn.textContent = '-';
     decreaseBtn.setAttribute('aria-label', 'Decrease quantity');

     const input = document.createElement('input');
     input.type = 'number';
     input.id = 'product-quantity';
     input.name = 'quantity';
     input.value = '1';
     input.min = '1';
     input.step = '1';
     input.required = true;

     const increaseBtn = document.createElement('button');
     increaseBtn.type = 'button';
     increaseBtn.className = 'quantity-increase';
     increaseBtn.textContent = '+';
     increaseBtn.setAttribute('aria-label', 'Increase quantity');

     inputContainer.appendChild(decreaseBtn);
     inputContainer.appendChild(input);
     inputContainer.appendChild(increaseBtn);

     group.appendChild(label);
     group.appendChild(inputContainer);
     productOptionsContainer.appendChild(group);

     // Setup listeners for these buttons
     setupQuantityButtons(inputContainer); // Pass the container
}


// --- Price Update Functions ---

function updateWeddingPriceDisplay() {
    const select = document.getElementById('wedding-quantity-select');
    if (!select || !priceEl || !weddingPerCardPriceEl) return;

    const selectedOption = select.options[select.selectedIndex];
    if (!selectedOption || !selectedOption.dataset.price) {
        priceEl.textContent = 'Select Quantity';
        weddingPerCardPriceEl.style.display = 'none';
        return;
    }

    const price = parseFloat(selectedOption.dataset.price);
    const perCardPrice = parseFloat(selectedOption.dataset.perCardPrice);

    priceEl.textContent = formatPrice(price);
    weddingPerCardPriceEl.textContent = `(${formatPrice(perCardPrice)} per card)`;
    weddingPerCardPriceEl.style.display = 'block'; // Show per-card price
    if (originalPriceEl) originalPriceEl.style.display = 'none'; // Hide original price if shown
}

// MODIFIED: Flex Price Calculation (Point 4)
function updateFlexPriceDisplay() {
    if (!bannerWidthInput || !bannerHeightInput || !bannerUnitSelect || !bannerQuantityInput || !priceEl || !currentProductData?.pricePerSqFt) {
        // console.warn("Flex inputs or price element not ready for calculation.");
        return;
    }

    const width = parseFloat(bannerWidthInput.value);
    const height = parseFloat(bannerHeightInput.value);
    const quantity = parseInt(bannerQuantityInput.value, 10);
    const unit = bannerUnitSelect.value; // 'feet' or 'inches'
    const pricePerSqFt = parseFloat(currentProductData.pricePerSqFt);

    // console.log(`Calculating: W=${width}, H=${height}, Qty=${quantity}, Unit=${unit}, Price/SqFt=${pricePerSqFt}`); // Debug Log

    if (isNaN(width) || isNaN(height) || isNaN(quantity) || width <= 0 || height <= 0 || quantity <= 0 || isNaN(pricePerSqFt)) {
        priceEl.textContent = 'Enter Valid Dimensions';
        // console.warn("Invalid input for price calculation.");
        if (weddingPerCardPriceEl) weddingPerCardPriceEl.style.display = 'none';
         if (originalPriceEl) originalPriceEl.style.display = 'none';
        return;
    }

    let areaInSqFt;
    if (unit === 'inches') {
        areaInSqFt = (width / 12) * (height / 12);
    } else { // Default to feet
        areaInSqFt = width * height;
    }

    const totalPrice = areaInSqFt * pricePerSqFt * quantity;

    // console.log(`Calculated Area (SqFt): ${areaInSqFt}, Total Price: ${totalPrice}`); // Debug Log

    priceEl.textContent = formatPrice(totalPrice);
    if (weddingPerCardPriceEl) weddingPerCardPriceEl.style.display = 'none'; // Ensure per-card is hidden
    if (originalPriceEl) originalPriceEl.style.display = 'none'; // Ensure original price is hidden
}


// --- Event Listener Setup ---
function setupEventListeners() {
    console.log("Setting up event listeners...");

    // Add to Cart Button
    if (addToCartBtn) {
         // Remove previous listener to avoid duplicates if function is called multiple times
        addToCartBtn.removeEventListener('click', handleAddToCartClick);
        addToCartBtn.addEventListener('click', handleAddToCartClick);
    } else {
        console.warn("Add to Cart button not found.");
    }

    // Tabs
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    if (tabLinks.length > 0 && tabContents.length > 0) {
        setupTabs(tabLinks, tabContents);
    } else {
        console.warn("Tabs or tab content not found.");
    }

    // Popup Buttons
    if (popupConfirmBtn) {
        popupConfirmBtn.removeEventListener('click', handlePopupConfirm);
        popupConfirmBtn.addEventListener('click', handlePopupConfirm);
    }
     if (popupCancelBtn) {
         popupCancelBtn.removeEventListener('click', hidePopup);
        popupCancelBtn.addEventListener('click', hidePopup);
    }
    if (closePopupBtn) {
        closePopupBtn.removeEventListener('click', hidePopup);
        closePopupBtn.addEventListener('click', hidePopup);
    }
    if (confirmationPopup) {
         // Optional: Close popup if clicking outside the content
        confirmationPopup.removeEventListener('click', handleOutsidePopupClick);
        confirmationPopup.addEventListener('click', handleOutsidePopupClick);
    }

    // Listeners for dynamic options (these are setup when options are created)
    // setupFlexInputListeners(); // Called within createFlexOptions
    // setupWeddingQuantityListener(); // Called within createWeddingOptions
}

function setupTabs(tabLinks, tabContents) {
     // Ensure default state: first tab active, others hidden
    tabLinks.forEach((link, index) => {
        const targetId = link.dataset.target;
        const targetContent = document.getElementById(targetId);

        if (index === 0) {
            link.classList.add('active');
             if (targetContent) targetContent.classList.add('active');
        } else {
             link.classList.remove('active');
             if (targetContent) targetContent.classList.remove('active');
        }

        // Remove old listener before adding new one
        link.removeEventListener('click', handleTabClick);
        link.addEventListener('click', handleTabClick);
    });
}

function handleTabClick(event) {
    const clickedTab = event.currentTarget;
     const targetId = clickedTab.dataset.target;
     const targetContent = document.getElementById(targetId);

     // Remove active class from all tabs and content
    document.querySelectorAll('.tab-link').forEach(link => link.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Add active class to the clicked tab and corresponding content
     clickedTab.classList.add('active');
     if (targetContent) {
        targetContent.classList.add('active');
    } else {
         console.warn(`Tab content with ID ${targetId} not found.`);
    }
}


// MODIFIED: Setup Quantity Buttons (Only for non-flex quantity inputs now)
function setupQuantityButtons(container) {
    // Find buttons within the specific container passed
    const decreaseButton = container.querySelector('.quantity-decrease');
    const increaseButton = container.querySelector('.quantity-increase');
    const input = container.querySelector('input[type="number"]');

    if (!decreaseButton || !increaseButton || !input) return;

    // Remove old listeners first
    decreaseButton.removeEventListener('click', handleQuantityChange);
    increaseButton.removeEventListener('click', handleQuantityChange);

    // Add new listeners
    decreaseButton.addEventListener('click', handleQuantityChange);
    increaseButton.addEventListener('click', handleQuantityChange);
}

// Handles quantity change for +/- buttons
function handleQuantityChange(event) {
    const button = event.currentTarget;
    const inputContainer = button.closest('.input-with-buttons'); // Find the parent container
    if (!inputContainer) return;

    const input = inputContainer.querySelector('input[type="number"]');
    if (!input) return;

    let currentValue = parseInt(input.value, 10) || 1;
    const min = parseInt(input.min, 10) || 1;
    const step = parseInt(input.step, 10) || 1;

    if (button.classList.contains('quantity-increase')) {
        currentValue += step;
    } else if (button.classList.contains('quantity-decrease')) {
        currentValue -= step;
    }

    input.value = Math.max(min, currentValue);

    // Trigger input event manually if needed for other listeners
     input.dispatchEvent(new Event('input', { bubbles: true }));
     // input.dispatchEvent(new Event('change', { bubbles: true })); // Also trigger change
}


// MODIFIED: Setup Flex Input Listeners (Point 4 robustness)
function setupFlexInputListeners() {
    const inputs = [bannerWidthInput, bannerHeightInput, bannerUnitSelect, bannerQuantityInput];
    if (inputs.some(el => !el)) {
        console.warn("One or more flex inputs not found, cannot attach listeners.");
        return;
    }

    inputs.forEach(input => {
        if (!input) return; // Double check
        const eventType = (input.tagName === 'SELECT') ? 'change' : 'input';
         // Use debounce or throttle here if performance becomes an issue
        input.removeEventListener(eventType, updateFlexPriceDisplay); // Remove old listener
        input.addEventListener(eventType, updateFlexPriceDisplay); // Add new listener
    });
    console.log("Flex input listeners attached.");
     // Initial price calculation call
     updateFlexPriceDisplay();
}

// --- Add to Cart Logic ---

function handleAddToCartClick() {
    if (!currentProductData) {
        showError("Product data not loaded. Cannot add to cart.");
        return;
    }
    if (addToCartBtn) addToCartBtn.disabled = true; // Disable button immediately

    const productToAdd = {
        productId: currentProductData.id,
        name: currentProductData.productName,
        imageUrl: (currentProductData.imageUrls && currentProductData.imageUrls[0]) || currentProductData.imageUrl || 'images/placeholder.png',
        options: {}, // Store selected options here
    };

    let price = 0;
    let quantity = 1;
    let isValid = true; // Flag to check if inputs are valid

    try {
        if (currentProductData.type === 'wedding_card') {
            const select = document.getElementById('wedding-quantity-select');
            if (select && select.value) {
                const selectedOption = select.options[select.selectedIndex];
                quantity = parseInt(selectedOption.dataset.quantity, 10);
                price = parseFloat(selectedOption.dataset.price);
                 productToAdd.pricePerItem = parseFloat(selectedOption.dataset.perCardPrice); // Store per-card price
                 productToAdd.options['Quantity'] = `${quantity} Cards`;
            } else {
                showError("Please select quantity for wedding cards.");
                isValid = false;
            }
        } else if (currentProductData.type === 'flex_banner') {
            const width = parseFloat(bannerWidthInput?.value);
            const height = parseFloat(bannerHeightInput?.value);
             quantity = parseInt(bannerQuantityInput?.value, 10);
            const unit = bannerUnitSelect?.value;
            const pricePerSqFt = parseFloat(currentProductData.pricePerSqFt);

            if (isNaN(width) || isNaN(height) || isNaN(quantity) || width <= 0 || height <= 0 || quantity <= 0 || !unit || isNaN(pricePerSqFt)) {
                showError("Please enter valid dimensions and quantity for the flex banner.");
                isValid = false;
            } else {
                let areaInSqFt = (unit === 'inches') ? (width / 12) * (height / 12) : width * height;
                price = areaInSqFt * pricePerSqFt * quantity; // Total price for this specific banner order
                 productToAdd.pricePerItem = areaInSqFt * pricePerSqFt; // Price per single banner of this size
                 productToAdd.options['Dimensions'] = `${width} x ${height} ${unit === 'inches' ? 'in' : 'ft'}`;
                 productToAdd.options['Quantity'] = quantity; // Store quantity within options too if needed
            }
        } else {
            // Standard product or other types
            const quantityInput = document.getElementById('product-quantity');
            if (quantityInput) {
                 quantity = parseInt(quantityInput.value, 10);
                 if (isNaN(quantity) || quantity < 1) {
                     showError("Please enter a valid quantity.");
                    isValid = false;
                 }
            } else {
                 // Assume quantity 1 if no input found
                 quantity = 1;
            }
             price = (currentProductData.price || 0) * quantity; // Total price
             productToAdd.pricePerItem = currentProductData.price || 0; // Price per single item
        }

        if (!isValid) {
             if (addToCartBtn) addToCartBtn.disabled = false; // Re-enable button on validation error
            return; // Stop processing
        }

        // Final product object properties
        productToAdd.quantity = quantity;
        productToAdd.totalPrice = price; // Total price for this specific order item

        console.log("Prepared data for popup:", productToAdd);
        showPopup(productToAdd); // Show confirmation popup

    } catch (error) {
        showError(`Error preparing item for cart: ${error.message}`);
        console.error("Add to cart preparation error:", error);
        if (addToCartBtn) addToCartBtn.disabled = false; // Re-enable on error
    }
}


// --- Popup Handling ---

// MODIFIED: Show Popup (Point 1)
function showPopup(productData) {
    if (!confirmationPopup || !productData) return;

    // Populate popup details
    if (popupImage) popupImage.src = productData.imageUrl;
    if (popupImage) popupImage.alt = productData.name;
    if (popupName) popupName.textContent = productData.name; // Set name in the header
    if (popupQuantity) popupQuantity.textContent = productData.quantity;
    if (popupPrice) popupPrice.textContent = formatPrice(productData.totalPrice);

    // Display options
    if (popupOptions) {
         let optionsText = '';
         if (productData.options) {
            optionsText = Object.entries(productData.options)
                .map(([key, value]) => `${key}: ${value}`)
                .join('<br>'); // Display options line by line
         }
        popupOptions.innerHTML = optionsText;
    }

     // Show per-card price specifically for wedding cards in popup
     if (popupPerCardPrice) {
         if (currentProductData?.type === 'wedding_card' && productData.pricePerItem) {
            popupPerCardPrice.textContent = `(${formatPrice(productData.pricePerItem)} per card)`;
            popupPerCardPrice.style.display = 'block';
         } else {
            popupPerCardPrice.style.display = 'none';
         }
     }

    // Store the product data to be added if confirmed
    confirmationPopup.dataset.productToAdd = JSON.stringify(productData);

    confirmationPopup.style.display = 'flex'; // Show the popup using flex for centering
}

function hidePopup() {
    if (confirmationPopup) {
        confirmationPopup.style.display = 'none';
        confirmationPopup.dataset.productToAdd = ''; // Clear stored data
    }
    // Re-enable Add to Cart button ONLY if validation passed before showing popup
     if (addToCartBtn && !addToCartBtn.disabled) {
          // Check if it was disabled due to an earlier validation error
          // This logic might need refinement depending on exact flow
     } else if (addToCartBtn) {
         // Assume popup was shown after validation passed, re-enable.
         addToCartBtn.disabled = false;
     }
}

function handleOutsidePopupClick(event) {
    // Close if clicked directly on the overlay (event.target), not on the content inside
    if (event.target === confirmationPopup) {
        hidePopup();
    }
}

// MODIFIED: Handle Popup Confirmation (Point 5 - Reset Inputs)
async function handlePopupConfirm() {
    if (!confirmationPopup || !confirmationPopup.dataset.productToAdd) return;

    const productToAddString = confirmationPopup.dataset.productToAdd;
    try {
        const productToAdd = JSON.parse(productToAddString);
        console.log("Confirming addition:", productToAdd);

        // Add item to cart using imported function
        await addToCart(productToAdd); // Assumes addToCart handles merging/updating quantities correctly

        // Show feedback
        if (cartFeedbackEl) {
            cartFeedbackEl.textContent = `${productToAdd.name} added to cart!`;
            cartFeedbackEl.style.display = 'block';
        }
        if (viewCartBtn) viewCartBtn.style.display = 'inline-block'; // Show view cart button

        // Hide popup
        hidePopup(); // Hide before resetting inputs

        // **NEW: Reset inputs after successful addition (Point 5)**
        resetInputsAfterAdd();

        // Update header cart count
        updateCartCount(); // Call function from main.js

        // Optional: Scroll to top or show feedback near header
        // window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        showError(`Failed to add item to cart: ${error.message}`);
        console.error("Popup confirm error:", error);
         if (addToCartBtn) addToCartBtn.disabled = false; // Re-enable on error
    }
}

// NEW: Function to reset inputs (Point 5)
function resetInputsAfterAdd() {
    console.log("Resetting inputs after adding to cart...");
    // Reset Flex Banner inputs if they exist
    if (bannerWidthInput) bannerWidthInput.value = '';
    if (bannerHeightInput) bannerHeightInput.value = '';
    if (bannerQuantityInput) bannerQuantityInput.value = '1'; // Reset quantity to 1
    if (bannerUnitSelect) bannerUnitSelect.selectedIndex = 0; // Reset unit to default (Feet)

    // Reset Wedding Card select if it exists
    const weddingSelect = document.getElementById('wedding-quantity-select');
    if (weddingSelect) {
        weddingSelect.selectedIndex = 0; // Reset to placeholder
    }

     // Reset standard quantity input if it exists
     const standardQuantityInput = document.getElementById('product-quantity');
     if (standardQuantityInput) {
        standardQuantityInput.value = '1';
     }

    // Re-calculate/update the displayed price on the main page
    if (currentProductData?.type === 'flex_banner') {
        updateFlexPriceDisplay(); // Update flex price (will likely show 'Enter Valid Dimensions')
    } else if (currentProductData?.type === 'wedding_card') {
        updateWeddingPriceDisplay(); // Update wedding price (will show 'Select Quantity')
    } else {
        // For standard products, the price doesn't usually change based on quantity input after adding
        // but you could re-render the base price if needed.
        renderPrice(currentProductData);
    }

     // Hide feedback message after a delay (optional)
     setTimeout(() => {
         if (cartFeedbackEl) cartFeedbackEl.style.display = 'none';
         if (viewCartBtn) viewCartBtn.style.display = 'none';
     }, 5000); // Hide after 5 seconds

     // IMPORTANT: Re-enable add to cart button is handled in hidePopup() now.
}


// --- Related Products ---
async function loadRelatedProducts(category, currentProductId) {
    if (!relatedProductsContainer || !category) return;
    relatedProductsContainer.innerHTML = '<p class="loading-related">Loading related products...</p>'; // Loading message

    try {
        const productsRef = collection(db, "onlineProducts");
        // Query for products in the same category, excluding the current one, limit results
        const q = query(
            productsRef,
            where("category", "==", category),
            where("__name__", "!=", currentProductId), // Exclude current product using document ID
            limit(4) // Limit to 4 related products
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            relatedProductsContainer.innerHTML = '<p>No related products found.</p>';
            return;
        }

        relatedProductsContainer.innerHTML = ''; // Clear loading message
        querySnapshot.forEach(docSnap => {
            const product = { id: docSnap.id, ...docSnap.data() };
            const card = createProductCard(product); // Use a helper to create card HTML
            relatedProductsContainer.appendChild(card);
        });

    } catch (error) {
        console.error("Error loading related products:", error);
        relatedProductsContainer.innerHTML = '<p>Could not load related products.</p>';
    }
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card'; // Use the same class as in CSS

    const imageLink = document.createElement('a');
    imageLink.href = `product-detail.html?id=${product.id}`;
    imageLink.className = 'product-image-link';

    const img = document.createElement('img');
    img.src = (product.imageUrls && product.imageUrls[0]) || product.imageUrl || 'images/placeholder.png';
    img.alt = product.productName;
    img.className = 'product-image';
    img.loading = 'lazy'; // Lazy load images
    imageLink.appendChild(img);

    const infoDiv = document.createElement('div');
    infoDiv.className = 'product-info';

    const name = document.createElement('h3');
    const nameLink = document.createElement('a');
    nameLink.href = `product-detail.html?id=${product.id}`;
    nameLink.textContent = product.productName;
    name.appendChild(nameLink);

    const priceDiv = document.createElement('div');
    priceDiv.className = 'price';
    // Handle variable pricing display for cards/banners if needed, or show base price
    if (product.type === 'wedding_card' || product.type === 'flex_banner') {
         priceDiv.textContent = 'Price Varies'; // Or fetch a base price if available
         priceDiv.style.fontSize = '0.9em'; // Smaller font for variable price text
    } else {
         priceDiv.textContent = formatPrice(product.price || 0);
    }


    const viewButton = document.createElement('a');
    viewButton.href = `product-detail.html?id=${product.id}`;
    viewButton.className = 'button-primary'; // Style as button
    viewButton.textContent = 'View Details';

    infoDiv.appendChild(name);
    infoDiv.appendChild(priceDiv);
    infoDiv.appendChild(viewButton); // Add button last

    card.appendChild(imageLink);
    card.appendChild(infoDiv);

    return card;
}


// --- Initialize Page ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded for Product Detail.");
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        showError("Product ID not found in URL.");
        return;
    }
    console.log(`Initializing page for Product ID: ${productId}`);
    loadProductDetails(productId); // Fetch data and render, includes attaching event listeners
});