// js/cart-page-logic.js (UPDATED to handle calculated prices)

// --- Imports ---
// Firebase और Firestore फंक्शन्स इम्पोर्ट करें
import { db } from './firebase-config.js';
import { doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// cart.js से आवश्यक फंक्शन्स इम्पोर्ट करें
import { getCart, removeFromCart, updateCartItemQuantity, clearCart } from './cart.js'; // Make sure getCart is imported

// main.js से हेडर कार्ट काउंट अपडेट फंक्शन इम्पोर्ट करें (यदि उपलब्ध है)
// import { updateCartCount } from './main.js';
// Fallback function
function updateCartCountFallback() {
    const cart = getCart(); // Use imported getCart
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
        cartCountElement.textContent = count;
    }
    console.log("Cart count updated (fallback):", count);
}


// --- DOM Elements ---
const cartItemsContainer = document.getElementById('cart-items');
const emptyCartMessage = cartItemsContainer?.querySelector('.empty-cart-message'); // Ensure template exists in HTML
const cartSuggestions = document.querySelector('.cart-suggestions');
const summarySubtotalEl = document.getElementById('summary-subtotal');
const summaryTotalEl = document.getElementById('summary-total');
const orderForm = document.getElementById('order-form');
const orderStatusDiv = document.getElementById('order-status-message');
const submitButton = document.getElementById('submit-order-btn');
const cartItemsSection = document.getElementById('cart-items-section');

// --- Helper Functions ---
const formatIndianCurrency = (amount) => {
    const num = Number(amount);
    // Display N/A or similar if amount is invalid/null/undefined after conversion
    return isNaN(num) ? '₹ --' : `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};


// --- Main Logic ---

/**
 * Renders cart items by fetching details from Firebase.
 * UPDATED: Uses pre-calculated price from cart item options if available.
 */
async function renderCartItems() {
    // Check if essential DOM elements exist
    if (!cartItemsContainer || !summarySubtotalEl || !summaryTotalEl) {
        console.error("Cart page critical DOM elements not found!");
        return;
    }
     // Ensure empty message template exists, even if inside cartItemsContainer
    const emptyCartMessageTemplate = document.querySelector('.empty-cart-message');


    const cart = getCart(); // Get cart from localStorage (should include options)
    cartItemsContainer.innerHTML = ''; // Clear previous items
    if(emptyCartMessageTemplate) emptyCartMessageTemplate.style.display = 'none'; // Hide template initially
    if (cartSuggestions) cartSuggestions.style.display = 'none';

    if (cart.length === 0) {
        // Use the template or create the message if template doesn't exist
        if (emptyCartMessageTemplate) {
             emptyCartMessageTemplate.style.display = 'block';
        } else {
            cartItemsContainer.innerHTML = '<p class="empty-cart-message">Your cart is currently empty. <a href="products.html">Continue Shopping</a></p>';
        }

        if (cartSuggestions) cartSuggestions.style.display = 'block';
        summarySubtotalEl.textContent = formatIndianCurrency(0);
        summaryTotalEl.textContent = formatIndianCurrency(0);
        if (orderForm) orderForm.style.display = 'none';
        if (cartItemsSection) cartItemsSection.style.display = 'block'; // Keep section visible for message
        return;
    }

    if (orderForm) orderForm.style.display = 'block'; // Show form if cart has items
    if (cartItemsSection) cartItemsSection.style.display = 'block'; // Ensure section is visible

    const itemPromises = cart.map(async (item) => {
        // Ensure item and item.productId exist before proceeding
        if (!item || !item.productId) {
            console.warn("Skipping invalid cart item:", item);
            return null; // Skip this item
        }
        try {
            // *** Adjust collection name 'onlineProducts' if needed ***
            const productRef = doc(db, "onlineProducts", item.productId);
            const productSnap = await getDoc(productRef);

            if (productSnap.exists()) {
                const productData = productSnap.data();
                const productName = productData.productName || 'Product Name Unavailable';
                const imageUrl = (productData.imageUrls && productData.imageUrls[0]) ? productData.imageUrls[0] : 'images/placeholder.png';
                const itemQuantity = item.quantity || 0; // Default to 0 if undefined

                // --- <<<< Pricing Logic Adjustment >>>> ---
                let itemPrice = 0; // Base price per unit (might not be used for calculated items)
                let itemSubtotal = 0; // The final subtotal for this line item
                let displayPriceText = ''; // Text to show in the price area
                let showQuantityInput = true; // Whether to show the editable quantity input

                // Check for pre-calculated price in options (from product-detail.js)
                 const itemOptions = item.options || {}; // Ensure options object exists
                 const calculatedPrice = parseFloat(itemOptions.price); // Get price from options

                if (itemOptions.type === 'Flex' && !isNaN(calculatedPrice)) {
                    itemSubtotal = calculatedPrice; // Use the total calculated price as the subtotal
                    const dims = itemOptions.dimensions || {};
                    // Display dimensions instead of unit price
                    displayPriceText = `Dimensions: ${dims.width || '?'}x${dims.height || '?'} ${dims.unit || 'units'}`;
                    // Item price per unit isn't really relevant here as it's a custom job
                    itemPrice = itemQuantity > 0 ? itemSubtotal / itemQuantity : 0; // Calculate effective unit price if needed
                    showQuantityInput = false; // Don't allow quantity change here for flex

                } else if (itemOptions.type === 'Wedding Card' && !isNaN(calculatedPrice)) {
                    itemSubtotal = calculatedPrice; // Use the total calculated price
                     // You could display 'Package Price' or the effective unit price
                    itemPrice = itemQuantity > 0 ? itemSubtotal / itemQuantity : 0;
                    displayPriceText = `Price: ${formatIndianCurrency(itemSubtotal)}`; // Show total price for the selected quantity
                    showQuantityInput = false; // Don't allow quantity change for wedding cards bundle

                } else {
                    // Standard product: Fetch rate from Firebase
                    itemPrice = parseFloat(productData.pricing?.rate || 0);
                    if (isNaN(itemPrice)) itemPrice = 0; // Ensure itemPrice is a number
                    itemSubtotal = itemPrice * itemQuantity;
                    displayPriceText = `Unit Price: ${formatIndianCurrency(itemPrice)}`;
                    showQuantityInput = true; // Allow quantity change for standard items
                }
                // --- <<<< End of Pricing Logic Adjustment >>>> ---


                const itemElement = document.createElement('div');
                itemElement.className = 'cart-item';
                itemElement.dataset.productId = item.productId;

                // HTML Structure (using displayPriceText and conditional quantity input)
                itemElement.innerHTML = `
                    <img src="${imageUrl}" alt="${productName}">
                    <div class="item-details">
                        <h4><a href="product-detail.html?id=${item.productId}">${productName}</a></h4>
                        <p class="item-price">${displayPriceText}</p>
                        ${showQuantityInput ? `
                        <div class="item-quantity">
                            <label for="qty-${item.productId}">Quantity:</label>
                            <input type="number" id="qty-${item.productId}" value="${itemQuantity}" min="1" class="item-qty-input" aria-label="Item Quantity" data-product-id="${item.productId}">
                        </div>
                        ` : `
                        <p class="item-quantity-display">Quantity: ${itemQuantity}</p>
                        `}
                    </div>
                    <div class="cart-item-controls" style="text-align: right; margin-left: auto;">
                        <button class="remove-item-btn" aria-label="Remove item" data-product-id="${item.productId}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        <p class="item-subtotal">Subtotal: ${formatIndianCurrency(itemSubtotal)}</p>
                    </div>
                `;

                return { element: itemElement, subtotal: itemSubtotal };

            } else {
                console.warn(`Product details not found for ID: ${item.productId}`);
                // Display placeholder for missing product
                 const itemElement = document.createElement('div');
                 itemElement.className = 'cart-item unavailable';
                 itemElement.innerHTML = `
                     <img src="images/placeholder.png" alt="Product unavailable">
                     <div class="item-details">
                         <h4>Product Unavailable (ID: ${item.productId})</h4>
                         <p class="item-options">This item might have been removed.</p>
                         <p class="item-quantity-display">Quantity: ${item?.quantity || 'N/A'}</p>
                     </div>
                     <div class="cart-item-controls" style="text-align: right; margin-left: auto;">
                        <button class="remove-item-btn" aria-label="Remove item" data-product-id="${item.productId}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        <p class="item-subtotal">Subtotal: ${formatIndianCurrency(0)}</p>
                    </div>`;
                 return { element: itemElement, subtotal: 0 }; // No subtotal for unavailable items
            }
        } catch (error) {
            console.error(`Error processing cart item ${item?.productId}:`, error);
            return null; // Handle error for individual item processing
        }
    });

    const renderedResults = await Promise.all(itemPromises);

    let finalTotal = 0;
    renderedResults.forEach(result => {
        if (result && result.element && typeof result.subtotal === 'number') { // Ensure result and subtotal are valid
            cartItemsContainer.appendChild(result.element);
            finalTotal += result.subtotal;
        }
    });

    // Update summary
    summarySubtotalEl.textContent = formatIndianCurrency(finalTotal);
    summaryTotalEl.textContent = formatIndianCurrency(finalTotal); // Adjust if shipping/discounts added

    // Add event listeners using event delegation AFTER items are in the DOM
    addCartItemListeners();

     // Final check for empty cart message (if all fetches failed or cart became empty)
     if (cartItemsContainer.children.length === 0 && emptyCartMessageTemplate) {
         emptyCartMessageTemplate.style.display = 'block';
         if (cartSuggestions) cartSuggestions.style.display = 'block';
         if (orderForm) orderForm.style.display = 'none';
     } else if (cartItemsContainer.children.length > 0 && emptyCartMessageTemplate) {
         emptyCartMessageTemplate.style.display = 'none'; // Hide if items are present
     }
}

/**
 * Add event listeners to cart items using event delegation.
 */
function addCartItemListeners() {
    if (!cartItemsContainer) return;

    cartItemsContainer.addEventListener('click', (event) => {
        // Handle remove button click
        const removeButton = event.target.closest('.remove-item-btn');
        if (removeButton) {
            const productId = removeButton.dataset.productId;
            if (productId) {
                handleRemoveItem(productId);
            }
        }
    });

    cartItemsContainer.addEventListener('change', (event) => {
        // Handle quantity input change
        if (event.target.classList.contains('item-qty-input')) {
            const input = event.target;
            const productId = input.dataset.productId;
            let newQuantity = parseInt(input.value, 10);

             // Ensure productId exists before proceeding
             if (!productId) {
                 console.error("Quantity change event missing product ID.");
                 return;
             }

            if (isNaN(newQuantity) || newQuantity < 1) {
                newQuantity = 1; // Reset to 1 if invalid
                input.value = newQuantity; // Update input field visually
             }
            handleQuantityChange(productId, newQuantity);
        }
    });
}


/**
 * Handles removing an item.
 */
function handleRemoveItem(productId) {
    console.log(`Removing item: ${productId}`);
    removeFromCart(productId); // Function from cart.js
    renderCartItems(); // Re-render the cart display
    updateCartCountFallback(); // Update header count
}

/**
 * Handles changing item quantity (only for standard items).
 */
function handleQuantityChange(productId, newQuantity) {
     console.log(`Updating quantity for item: ${productId} to ${newQuantity}`);
     updateCartItemQuantity(productId, newQuantity); // Function from cart.js
     renderCartItems(); // Re-render to update totals
     updateCartCountFallback(); // Update header count
}


/**
 * Handles the order form submission.
 * UPDATED: Includes 'group' field.
 */
async function handleOrderSubmit(event) {
    event.preventDefault();
    if (!submitButton || !orderForm) return;

    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing Order...';
    if (orderStatusDiv) orderStatusDiv.style.display = 'none';

    const cartItemsForOrder = getCart(); // Get cart items from localStorage
    if (cartItemsForOrder.length === 0) {
        alert("Your cart is empty.");
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-check-circle"></i> Place Order';
        return;
    }

    // Prepare item details for saving in the order
    // Uses the pre-calculated price from options where available
    const itemsWithDetails = [];
    let orderTotalAmount = 0;
    let orderPrepError = false;

    // Use a standard loop for async operations inside
    for (const item of cartItemsForOrder) {
         if (!item || !item.productId) continue; // Skip invalid items

         try {
             // *** ADJUST 'onlineProducts' if needed ***
             const productRef = doc(db, "onlineProducts", item.productId);
             const productSnap = await getDoc(productRef);

             if (productSnap.exists()) {
                 const productData = productSnap.data();
                 const itemName = productData.productName || 'N/A';
                 const itemQuantity = item.quantity || 0;
                 let itemUnitPrice = 0; // Price per base unit (e.g., sq ft rate)
                 let itemSubTotalForOrder = 0; // The subtotal to save in the order

                 const itemOptions = item.options || {};
                 const calculatedPrice = parseFloat(itemOptions.price);

                 if ((itemOptions.type === 'Flex' || itemOptions.type === 'Wedding Card') && !isNaN(calculatedPrice)) {
                     // Use the pre-calculated total price from options
                     itemSubTotalForOrder = calculatedPrice;
                     // Store effective unit price if needed, otherwise store base rate or 0
                     itemUnitPrice = itemQuantity > 0 ? itemSubTotalForOrder / itemQuantity : (parseFloat(productData.pricing?.rate || 0) || 0);
                 } else {
                     // Standard product: use Firebase rate
                     itemUnitPrice = parseFloat(productData.pricing?.rate || 0) || 0;
                     itemSubTotalForOrder = itemUnitPrice * itemQuantity;
                 }

                 itemsWithDetails.push({
                     productId: item.productId,
                     quantity: itemQuantity,
                     name: itemName,
                     unitPrice: itemUnitPrice, // Store base rate or effective rate
                     subtotal: itemSubTotalForOrder, // Store the correct subtotal
                     options: itemOptions // Include options like dimensions if needed
                 });
                 orderTotalAmount += itemSubTotalForOrder;

             } else {
                  console.error(`Product with ID ${item.productId} not found during order prep.`);
                  // Decide how to handle: skip item or fail order?
                  // Option: Fail order
                  throw new Error(`Product details for ${item.productId} not found.`);
                  // Option: Skip item (might lead to incorrect total)
                  // continue;
             }
         } catch (error) {
              console.error("Error fetching product details for order item:", item.productId, error);
              orderPrepError = true;
              if (orderStatusDiv) {
                  orderStatusDiv.innerHTML = `<p>Error preparing order details for item ID ${item.productId}. Please refresh cart or contact support.</p>`;
                  orderStatusDiv.className = 'error';
                  orderStatusDiv.style.display = 'block';
              }
              break; // Stop processing further items on error
         }
    }


    if (orderPrepError) {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-check-circle"></i> Place Order';
        return; // Stop if details couldn't be fetched accurately
    }

    // Create order data object including the 'group'
    const orderData = {
        customerName: document.getElementById('customer-name').value,
        customerContact: document.getElementById('customer-contact').value,
        customerAddress: document.getElementById('customer-address').value,
        specialInstructions: document.getElementById('special-instructions').value,
        items: itemsWithDetails, // Contains items with correct subtotals and options
        totalAmount: orderTotalAmount, // Correct total based on item subtotals
        orderStatus: 'Pending Confirmation',
        createdAt: serverTimestamp(),
        // ---- Add the group field ----
        group: 'Website Order' // Or make it dynamic based on items/customer etc.
        // Example dynamic: group: itemsWithDetails.length > 0 ? (itemsWithDetails[0].options?.type || 'General') : 'Unknown'
        // ---- End group field ----
    };

    try {
        // *** Collection name to save orders: 'online_orders' ***
        const ordersCollectionRef = collection(db, "online_orders");
        const docRef = await addDoc(ordersCollectionRef, orderData);
        console.log("Order saved to 'online_orders' with ID: ", docRef.id);
        console.log("Saved Order Data:", orderData); // Log the data being saved

        displayConfirmationMessage(docRef.id, itemsWithDetails); // Display success message
        clearCart(); // Clear localStorage cart
        updateCartCountFallback(); // Update header count

    } catch (error) {
        console.error("Error saving order to Firestore:", error);
        if (orderStatusDiv) {
            orderStatusDiv.innerHTML = `<p>Error placing order. Please try again. Error: ${error.message}</p>`;
            orderStatusDiv.className = 'error';
            orderStatusDiv.style.display = 'block';
        }
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-check-circle"></i> Place Order';
    }
}

/**
 * Displays the order confirmation message with WhatsApp button.
 */
function displayConfirmationMessage(orderId, orderedItems) {
    if (!orderStatusDiv || !orderForm || !cartItemsSection) {
        console.error("Cannot display confirmation: Missing key elements.");
        // Fallback alert
        alert(`Order ${orderId} placed successfully! Please WhatsApp us at 919549116541 with your design details, mentioning Order ID ${orderId}.`);
        // Try hiding form/cart anyway
        if(orderForm) orderForm.style.display = 'none';
        if(cartItemsSection) cartItemsSection.style.display = 'none';
        return;
    }

    let confirmationMessageHTML = `
        <h4>ऑर्डर देने के लिए धन्यवाद!</h4>
        <p>आपका ऑर्डर सफलतापूर्वक दर्ज हो गया है (Order ID: <strong>${orderId}</strong>)। हमारी टीम जल्द ही आपसे संपर्क करेगी।</p>
        <p>कृपया अपने डिज़ाइन, फोटो, या ऑर्डर से संबंधित कोई अन्य जानकारी नीचे दिए गए बटन पर क्लिक करके हमें WhatsApp पर भेजें:</p>
    `;

    // Prepare WhatsApp message text
    let whatsappText = `Order ID: ${orderId}\n\nItems:\n`;
    orderedItems.forEach(item => {
        // Include relevant details like dimensions for Flex
        let itemDesc = `- ${item.name} x ${item.quantity}`;
        if (item.options?.type === 'Flex' && item.options?.dimensions) {
            const dims = item.options.dimensions;
            itemDesc += ` (${dims.width}x${dims.height} ${dims.unit})`;
        }
        itemDesc += ` (Subtotal: ${formatIndianCurrency(item.subtotal)})`; // Add subtotal for clarity
        whatsappText += itemDesc + '\n';
    });
    whatsappText += `\nTotal: ${formatIndianCurrency(orderedItems.reduce((sum, item) => sum + item.subtotal, 0))}`; // Add Total Amount
    whatsappText += '\n\nPlease find my design/details attached.';

    // Construct WhatsApp URL (ensure number is correct)
    const whatsappNumber = "919549116541"; // Make sure this is the correct number format
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappText)}`;

    confirmationMessageHTML += `
        <a href="${whatsappUrl}" target="_blank" class="button-whatsapp">
            <i class="fab fa-whatsapp"></i> WhatsApp पर डिज़ाइन भेजें (${whatsappNumber.slice(2)})
        </a>
    `;

    orderStatusDiv.innerHTML = confirmationMessageHTML;
    orderStatusDiv.className = 'success';
    orderStatusDiv.style.display = 'block';

    // Hide form and cart items section
    orderForm.style.display = 'none';
    cartItemsSection.style.display = 'none';
}

// --- Initialize Page ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Cart page logic initializing...");
    renderCartItems(); // Render cart on page load

    if (orderForm) {
        orderForm.addEventListener('submit', handleOrderSubmit);
    } else {
        console.error("Order form element (#order-form) not found!");
    }

    // Optional: Add listener for file input name display if not already in HTML script tag
    const fileInput = document.getElementById('design-file-upload');
    const fileNameSpan = document.querySelector('.file-name');
    if (fileInput && fileNameSpan && !document.querySelector('script[data-handles-file-upload]')) { // Avoid duplicate listeners
        fileInput.addEventListener('change', function() {
            if (this.files && this.files.length > 0) {
                fileNameSpan.textContent = this.files[0].name;
            } else {
                fileNameSpan.textContent = 'No file chosen';
            }
        });
        // Mark that this script added the listener
        const scriptTag = document.createElement('script');
        scriptTag.setAttribute('data-handles-file-upload', 'true');
        document.body.appendChild(scriptTag); // Add dummy script tag to mark
    }
});

console.log("cart-page-logic.js loaded and updated logic included.");