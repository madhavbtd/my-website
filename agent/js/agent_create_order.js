// /agent/js/agent_create_order.js

// Import Firebase config and necessary functions
import {
    db, auth, collection, query, where, orderBy, limit, getDocs,
    doc, getDoc, addDoc, updateDoc, Timestamp, serverTimestamp,
    runTransaction, arrayUnion
} from './agent_firebase_config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Global Variables ---
let currentUser = null;
let agentPermissions = { role: null, status: 'inactive', email: null, canAddCustomers: false }; // Default permissions
let productCache = [];
let customerCache = []; // This cache will be more crucial now
let productFetchPromise = null;
let customerFetchPromise = null;
let activeProductInput = null; // Track which product input is active
let productSuggestionsDiv = null; // The suggestions dropdown element
let customerSearchDebounceTimer; // Timer for debouncing customer search
let isDiscountInputProgrammaticChange = false; // Flag to prevent infinite loops on discount calculation
let selectedCustomerId = null; // Stores the Firestore ID of the selected customer
// let selectedCustomerData = null; // Will be retrieved from customerCache or agents collection via addedByAgentId

// --- DOM Element References ---
const orderForm = document.getElementById('agentNewOrderForm');
const customerNameInput = document.getElementById('agent_customer_name');
const customerWhatsAppInput = document.getElementById('agent_customer_whatsapp');
const customerAddressInput = document.getElementById('agent_customer_address');
const customerContactInput = document.getElementById('agent_customer_contact');
const customerSuggestionsNameBox = document.getElementById('agent-customer-suggestions-name');
const customerSuggestionsWhatsAppBox = document.getElementById('agent-customer-suggestions-whatsapp');
const selectedCustomerIdInput = document.getElementById('agentSelectedCustomerId'); // Hidden input
const orderItemsTableBody = document.getElementById('agentOrderItemsTableBody');
const itemRowTemplate = document.getElementById('agent-item-row-template');
const addItemBtn = document.getElementById('agentAddItemBtn');
const summarySubtotalSpan = document.getElementById('agentSummarySubtotal');
const summaryDiscountPercentInput = document.getElementById('agentSummaryDiscountPercent');
const summaryDiscountAmountInput = document.getElementById('agentSummaryDiscountAmount');
const summaryFinalAmountSpan = document.getElementById('agentSummaryFinalAmount');
const deliveryDateInput = document.getElementById('agent_delivery_date');
const remarksInput = document.getElementById('agent_remarks');
const saveOrderBtn = document.getElementById('agentSaveOrderBtn');
const formErrorMsg = document.getElementById('agentFormErrorMsg'); // The error message paragraph/div
const agentWelcomeMessageEl = document.getElementById('agentWelcomeMessage'); // From header
const agentLogoutBtnEl = document.getElementById('agentLogoutBtn'); // From header


// --- Helper Functions ---
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') unsafe = String(unsafe || ''); return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function formatCurrency(amount) { const num = Number(amount); return isNaN(num) ? '₹0.00' : num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function showFormError(message) { if (!formErrorMsg) return; formErrorMsg.textContent = message; formErrorMsg.style.display = message ? 'block' : 'none'; }
function hideSuggestionBox(box) { if (box) { box.innerHTML = '<ul></ul>'; box.classList.remove('active'); } }

// --- Authentication and Permission Loading ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        if (agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = `Welcome, ${user.email || 'Agent'}`;

        try {
            const agentDocRef = doc(db, "agents", currentUser.uid);
            const agentDocSnap = await getDoc(agentDocRef);

            if (agentDocSnap.exists() && agentDocSnap.data().role === 'agent' && agentDocSnap.data().status === 'active') {
                agentPermissions = agentDocSnap.data();
                agentPermissions.email = user.email; // Add email from Auth
                console.log("Agent authenticated (Create Order) and permissions loaded:", agentPermissions);

                // Page-specific setup
                attachEventListeners();
                addInitialItemRow(); // Add one item row to start
                preFetchCaches(); // Start fetching caches in the background
                resetAgentOrderForm(false); // Only reset items, not customer if already selected perhaps?
            } else {
                console.error("Agent document not found or role/status invalid. Logging out.");
                if(formErrorMsg) showFormError("Your agent account is not valid or not active. Please contact admin."); // English message
                if(saveOrderBtn) saveOrderBtn.disabled = true;
                auth.signOut().then(() => window.location.href = 'agent_login.html');
            }
        } catch (error) {
            console.error("Error loading agent permissions:", error);
            if(formErrorMsg) showFormError("Error loading your profile. Please try again."); // English message
            if(saveOrderBtn) saveOrderBtn.disabled = true;
            auth.signOut().then(() => window.location.href = 'agent_login.html');
        }
    } else {
        console.log("Agent not logged in on create order page. Redirecting...");
        window.location.replace('agent_login.html');
    }
});

// --- Event Listeners Setup ---
function attachEventListeners() {
    if (agentLogoutBtnEl) {
        agentLogoutBtnEl.addEventListener('click', () => {
            if (confirm("Are you sure you want to logout?")) { // English message
                auth.signOut().then(() => window.location.href = 'agent_login.html');
            }
        });
    }

    // Ensure elements exist before attaching listeners
    if (!addItemBtn || !orderItemsTableBody || !orderForm || !customerNameInput || !customerWhatsAppInput || !summaryDiscountPercentInput || !summaryDiscountAmountInput) {
        console.error("One or more required elements for event listeners not found on Create Order page.");
        return;
    }
    addItemBtn.addEventListener('click', handleAddItem);
    orderItemsTableBody.addEventListener('click', handleItemTableClick);
    orderItemsTableBody.addEventListener('input', handleItemTableInput);
    orderItemsTableBody.addEventListener('change', handleItemTableChange);
    // Track focus for product suggestions
    orderItemsTableBody.addEventListener('focusin', (event) => {
        if (event.target.matches('.product-name')) {
            activeProductInput = event.target; // Store the currently focused product input
            getOrFetchProductCache().then(() => {
                 handleProductSearchInput({ target: activeProductInput }); // Trigger search immediately on focus if needed
            });
        }
    });
    // Customer search listeners
    customerNameInput.addEventListener('input', (e) => handleCustomerInput(e, 'name'));
    customerWhatsAppInput.addEventListener('input', (e) => handleCustomerInput(e, 'whatsapp'));
    // Global click listener to hide suggestion boxes
    document.addEventListener('click', handleGlobalClickForSuggestions);
    // Discount listeners
    summaryDiscountPercentInput.addEventListener('input', handleDiscountInput);
    summaryDiscountAmountInput.addEventListener('input', handleDiscountInput);
    // Form submit listener
    orderForm.addEventListener('submit', handleFormSubmit);
}

// --- Item Row Management ---
function addInitialItemRow() { if(orderItemsTableBody && orderItemsTableBody.rows.length === 0){ handleAddItem(); }}

function handleAddItem() {
    if (!itemRowTemplate || !orderItemsTableBody) return;
    const templateContent = itemRowTemplate.content.cloneNode(true);
    const newRow = templateContent.querySelector('.item-row');
    orderItemsTableBody.appendChild(newRow);
    addItemRowEventListeners(newRow); // Attach listeners to the new row
}

function addItemRowEventListeners(row) {
    const deleteBtn = row.querySelector('.delete-item-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (orderItemsTableBody.rows.length > 1) { // Prevent deleting the last row
                row.remove();
                updateOrderSummary(); // Recalculate summary after deletion
            } else {
                alert("You cannot remove the last item row."); // English alert
            }
        });
    }
    // Attach listener for product name input (handled by focusin now)
    // const productNameInput = row.querySelector('.product-name');
    // if (productNameInput) productNameInput.addEventListener('input', handleProductSearchInput);

    // Attach listeners for inputs that affect amount/summary
    const quantityInput = row.querySelector('.quantity-input');
    const rateInput = row.querySelector('.rate-input'); // Agent rate input
    const unitTypeSelect = row.querySelector('.unit-type-select');
    const widthInput = row.querySelector('.width-input');
    const heightInput = row.querySelector('.height-input');
    const unitSelect = row.querySelector('.dimension-unit-select');

    if (quantityInput) quantityInput.addEventListener('input', () => updateItemAmount(row));
    if (rateInput) rateInput.addEventListener('input', () => updateItemAmount(row)); // Although rate is readonly, keep for future?
    if (unitTypeSelect) unitTypeSelect.addEventListener('change', (e) => handleUnitTypeChange(e));
    if (widthInput) widthInput.addEventListener('input', () => updateItemAmount(row));
    if (heightInput) heightInput.addEventListener('input', () => updateItemAmount(row));
    if (unitSelect) unitSelect.addEventListener('change', () => updateItemAmount(row));
}

function handleItemTableClick(event) {
    // Currently handled by button listener in addItemRowEventListeners
}

function handleItemTableInput(event) {
    // Could consolidate logic here, but separate listeners in addItemRowEventListeners might be clearer
}
function handleItemTableChange(event){
    // Could consolidate logic here, but separate listeners in addItemRowEventListeners might be clearer
}

function handleUnitTypeChange(event) {
    const selectElement = event.target;
    const row = selectElement.closest('.item-row');
    const sqFeetInputs = row.querySelectorAll('.sq-feet-input');
    const isSqFeet = selectElement.value === 'Sq Feet';

    sqFeetInputs.forEach(el => {
        el.classList.toggle('hidden-col', !isSqFeet); // Use CSS class to hide/show
        const input = el.querySelector('input, select');
        if (input) {
            input.required = isSqFeet; // Make Sq Ft inputs required only when selected
        }
    });
     // Clear non-relevant values and recalculate
     if (!isSqFeet) {
        row.querySelector('.width-input').value = '';
        row.querySelector('.height-input').value = '';
     }
     updateItemAmount(row);
}

function calculateFlexDimensions(unit, width, height) {
    if (unit === 'inches') {
        width /= 12;
        height /= 12;
    }
    return width * height; // Area in square feet
}

function updateItemAmount(row) {
    const quantityInput = row.querySelector('.quantity-input');
    const rateInput = row.querySelector('.rate-input'); // Agent rate
    const itemAmountSpan = row.querySelector('.item-amount');
    const unitTypeSelect = row.querySelector('.unit-type-select');

    let quantity = parseFloat(quantityInput.value) || 0;
    let rate = parseFloat(rateInput.value) || 0;
    let amount = 0;

    if (unitTypeSelect.value === 'Sq Feet') {
        const widthInput = row.querySelector('.width-input');
        const heightInput = row.querySelector('.height-input');
        const unitSelect = row.querySelector('.dimension-unit-select');
        let width = parseFloat(widthInput.value) || 0;
        let height = parseFloat(heightInput.value) || 0;
        const unit = unitSelect.value;

        if (width > 0 && height > 0) {
            const sqFeetArea = calculateFlexDimensions(unit, width, height);
            // Amount = Area * Quantity * Rate
            amount = sqFeetArea * quantity * rate;
        }
    } else { // 'Qty' type
        amount = quantity * rate;
    }

    itemAmountSpan.textContent = amount.toFixed(2);
    updateOrderSummary(); // Recalculate overall summary
}

// --- Order Summary Calculation ---
function updateOrderSummary() {
    let subTotal = 0;
    const rows = orderItemsTableBody.querySelectorAll('.item-row');
    rows.forEach(row => {
        const itemAmountSpan = row.querySelector('.item-amount');
        subTotal += parseFloat(itemAmountSpan.textContent) || 0;
    });

    summarySubtotalSpan.textContent = subTotal.toFixed(2);

    // Calculate final amount based on discounts
    let discountPercent = parseFloat(summaryDiscountPercentInput.value) || 0;
    let discountAmount = parseFloat(summaryDiscountAmountInput.value) || 0;
    let finalAmount = subTotal;

    if (!isDiscountInputProgrammaticChange) { // Prevent loop if change was programmatic
        if (document.activeElement === summaryDiscountPercentInput && discountPercent >= 0) {
            discountAmount = (subTotal * discountPercent) / 100;
            isDiscountInputProgrammaticChange = true;
            summaryDiscountAmountInput.value = discountAmount.toFixed(2);
            isDiscountInputProgrammaticChange = false;
        } else if (document.activeElement === summaryDiscountAmountInput && discountAmount >= 0) {
             if (subTotal > 0) {
                 discountPercent = (discountAmount / subTotal) * 100;
                 isDiscountInputProgrammaticChange = true;
                 summaryDiscountPercentInput.value = discountPercent.toFixed(2);
                 isDiscountInputProgrammaticChange = false;
             } else {
                 isDiscountInputProgrammaticChange = true;
                 summaryDiscountPercentInput.value = '0.00'; // Avoid NaN if subtotal is 0
                 isDiscountInputProgrammaticChange = false;
             }
        }
    }

    if (discountAmount > 0 && discountAmount <= finalAmount) {
        finalAmount -= discountAmount;
    } else if (discountAmount < 0){
        // Reset if negative discount amount entered
        isDiscountInputProgrammaticChange = true;
        summaryDiscountAmountInput.value = '0.00';
        summaryDiscountPercentInput.value = '0.00';
        isDiscountInputProgrammaticChange = false;
    } else if (discountAmount > subTotal) {
         // Cap discount at subtotal
         discountAmount = subTotal;
         isDiscountInputProgrammaticChange = true;
         summaryDiscountAmountInput.value = discountAmount.toFixed(2);
         summaryDiscountPercentInput.value = '100.00';
         isDiscountInputProgrammaticChange = false;
         finalAmount = 0;
    }


    summaryFinalAmountSpan.textContent = finalAmount.toFixed(2);
}

function handleDiscountInput(event) {
    if (!isDiscountInputProgrammaticChange) {
        updateOrderSummary();
    }
}

// --- Customer Search/Select Logic ---
async function getOrFetchCustomerCache() {
    if (customerCache.length > 0 && customerFetchPromise === null) return Promise.resolve(customerCache); // Return cached data if available
    if (customerFetchPromise) return customerFetchPromise; // Return ongoing promise
    console.log("Fetching customers for agent (Create Order)...");
    try {
        if (!db || !collection || !query || !getDocs || !orderBy || !where || !currentUser) {
            throw new Error("DB func missing or user not authenticated for customer cache");
        }

        // Query customers added by the current agent.
        // Ensure Firestore security rules allow this read.
        const customersQuery = query(
            collection(db, "customers"),
            where("addedByAgentId", "==", currentUser.uid),
            orderBy("fullNameLower")
        );

        customerFetchPromise = getDocs(customersQuery).then(snapshot => {
            customerCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            console.log(`${customerCache.length} customers cached for agent (Create Order).`);
            return customerCache; // Resolve with the fetched data
        }).catch(e => {
            console.error("Error fetching agent customer cache (Create Order):", e);
            throw e; // Propagate error
        }).finally(() => {
            customerFetchPromise = null; // Reset promise after completion/error
        });
        return customerFetchPromise;
    } catch (e) {
        console.error("Error setting up agent customer cache (Create Order):", e);
        customerFetchPromise = null; // Reset on setup error
        return Promise.reject(e);
    }
}

function handleCustomerInput(event, type) {
    const inputElement = event.target;
    const term = inputElement.value.trim().toLowerCase();
    const suggestionsBox = (type === 'name') ? customerSuggestionsNameBox : customerSuggestionsWhatsAppBox;

    clearTimeout(customerSearchDebounceTimer);
    customerSearchDebounceTimer = setTimeout(async () => {
        if (term.length < 1) { // Require at least 1 character
            hideSuggestionBox(suggestionsBox);
            resetCustomerFields(type === 'name'); // Reset fields if name input is cleared significantly
            return;
        }
        try {
            await getOrFetchCustomerCache(); // Ensure cache is populated
            filterAndRenderCustomerSuggestions(term, type, suggestionsBox, inputElement);
        } catch (error) {
             console.error("Error fetching/filtering customer suggestions:", error);
             // Optionally show an error in the suggestion box
             if (suggestionsBox) {
                suggestionsBox.innerHTML = '<ul><li class="no-suggestions">Error loading customers</li></ul>';
                suggestionsBox.classList.add('active');
             }
        }
    }, 300); // Debounce time
}

function filterAndRenderCustomerSuggestions(term, type, box, inputElement) {
    if (!box || !inputElement) return;
    const filteredCustomers = customerCache.filter(cust => {
        if (type === 'name') {
            return (cust.fullNameLower || '').includes(term);
        } else if (type === 'whatsapp') {
            return (cust.whatsappNo || '').replace(/\s+/g, '').includes(term.replace(/\s+/g, '')); // Match digits
        }
        return false;
    });
    renderCustomerSuggestions(filteredCustomers, term, box, inputElement);
}

function renderCustomerSuggestions(suggestions, term, box, inputElement) {
    if (!box) return;
    const ul = box.querySelector('ul');
    if (!ul) return; // Ensure ul exists
    ul.innerHTML = ''; // Clear previous suggestions

    if (suggestions.length > 0) {
        suggestions.slice(0, 7).forEach(cust => { // Limit suggestions shown
            const li = document.createElement('li');
            const name = escapeHtml(cust.fullName || '');
            const whatsapp = escapeHtml(cust.whatsappNo || '');
            // Highlight matching term (simple implementation)
            const displayName = name.replace(new RegExp(term, 'gi'), (match) => `<strong>${match}</strong>`);
            const displayWhatsApp = whatsapp.replace(new RegExp(term.replace(/\s+/g, ''), 'gi'), (match) => `<strong>${match}</strong>`);
            li.innerHTML = `${displayName} - ${displayWhatsApp}`;
            li.addEventListener('mousedown', (e) => { // Use mousedown to fire before blur
                e.preventDefault(); // Prevent input blur
                 selectCustomerSuggestion({
                     customerId: cust.id,
                     customerName: cust.fullName,
                     customerWhatsapp: cust.whatsappNo,
                     customerAddress: cust.address || cust.billingAddress,
                     customerContact: cust.contactNo
                 });
                hideSuggestionBox(box);
            });
            ul.appendChild(li);
        });
        box.classList.add('active');
    } else {
        // Optionally show "No results" or allow adding new if permitted
        const li = document.createElement('li');
        li.classList.add('no-suggestions');
        li.textContent = "No matching customers found."; // English message
        ul.appendChild(li);
        box.classList.add('active');
         resetCustomerFields(false); // Reset selection if no match found
    }
}

function selectCustomerSuggestion(customerData) {
    if (!customerData || !customerData.customerId) {
        console.warn("selectCustomerSuggestion called without valid data or customerId.");
        resetCustomerFields(true); // Reset all if selection is invalid
        return;
    }
    console.log("Selecting customer:", customerData);
    if(customerNameInput) customerNameInput.value = customerData.customerName || '';
    if(customerWhatsAppInput) customerWhatsAppInput.value = customerData.customerWhatsapp || '';
    if(customerAddressInput) customerAddressInput.value = customerData.customerAddress || '';
    if(customerContactInput) customerContactInput.value = customerData.customerContact || '';
    selectedCustomerId = customerData.customerId; // Store Firestore document ID
    if(selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId;

    // Hide suggestion boxes after selection
    hideSuggestionBox(customerSuggestionsNameBox);
    hideSuggestionBox(customerSuggestionsWhatsAppBox);
}

function resetCustomerFields(clearAllFields = true) {
    if (clearAllFields) {
        if(customerNameInput) customerNameInput.value = '';
        if(customerWhatsAppInput) customerWhatsAppInput.value = '';
        if(customerAddressInput) customerAddressInput.value = '';
        if(customerContactInput) customerContactInput.value = '';
    }
    selectedCustomerId = null;
    if(selectedCustomerIdInput) selectedCustomerIdInput.value = '';
    // selectedCustomerData = null;
}

// --- Product Search/Select Logic ---
async function getOrFetchProductCache() {
    if (productCache.length > 0 && productFetchPromise === null) return Promise.resolve(productCache);
    if (productFetchPromise) return productFetchPromise;
    console.log("Fetching products for agent (Create Order)...");
    try {
        if (!db || !collection || !query || !getDocs || !orderBy || !where || !agentPermissions) {
            throw new Error("DB func missing or agent permissions not loaded for product cache");
        }
        let productsQuery;
        // Filter products based on agent's allowed categories, if they exist
        if (agentPermissions.allowedCategories && agentPermissions.allowedCategories.length > 0) {
             console.log("Filtering products by agent's allowed categories:", agentPermissions.allowedCategories);
             // Note: Firestore 'in' query limit is 30. If more categories, fetch all and filter client-side.
             productsQuery = query(
                 collection(db, "onlineProducts"),
                 where("isEnabled", "==", true),
                 where("category", "in", agentPermissions.allowedCategories),
                 orderBy("productName")
             );
        } else {
            // Agent can see all enabled products
            console.log("Agent can view all enabled products (no category filter).");
            productsQuery = query(
                collection(db, "onlineProducts"),
                where("isEnabled", "==", true),
                orderBy("productName")
            );
        }

        productFetchPromise = getDocs(productsQuery).then(snapshot => {
            productCache = snapshot.docs.map(d => {
                const data = d.data();
                // Ensure agentRate exists, fallback to rate if not
                const agentRate = data.pricing?.agentRate ?? data.pricing?.rate ?? 0;
                return {
                    id: d.id,
                    name: data.productName,
                    unitType: data.unitType || 'Qty', // Default to Qty
                    rate: agentRate, // Use agent rate for calculation
                    productCode: data.itemCode || '', // Add product code if available
                    ...data // Include other data like category, isEnabled etc.
                };
            });
            console.log(`${productCache.length} products cached for agent (Create Order).`);
            return productCache;
        }).catch(e => {
            console.error("Error fetching agent product cache (Create Order):", e);
            throw e;
        }).finally(() => {
            productFetchPromise = null; // Reset promise
        });
        return productFetchPromise;
    } catch (e) {
        console.error("Error setting up agent product cache (Create Order):", e);
        productFetchPromise = null; // Reset on setup error
        return Promise.reject(e);
    }
}

function getOrCreateProductSuggestionsDiv() {
    if (!productSuggestionsDiv) {
        productSuggestionsDiv = document.createElement('div');
        productSuggestionsDiv.className = 'suggestions-box products'; // Specific class for styling
        productSuggestionsDiv.style.position = 'absolute'; // Position near input
        productSuggestionsDiv.style.zIndex = '1001'; // Above other elements
        productSuggestionsDiv.innerHTML = '<ul></ul>'; // Start with empty list
        document.body.appendChild(productSuggestionsDiv); // Append to body initially
        productSuggestionsDiv.addEventListener('mousedown', handleSuggestionClick); // Prevent blur on click
    }
    return productSuggestionsDiv;
}

function positionProductSuggestions(inputElement) {
    if (!productSuggestionsDiv || !inputElement) return;
    const rect = inputElement.getBoundingClientRect();
    const parentRect = inputElement.closest('td')?.getBoundingClientRect() || rect; // Get position relative to cell or input

    productSuggestionsDiv.style.left = `${parentRect.left + window.scrollX}px`;
    productSuggestionsDiv.style.top = `${parentRect.bottom + window.scrollY}px`;
    productSuggestionsDiv.style.width = `${parentRect.width}px`; // Match width of cell/input
     productSuggestionsDiv.style.display = 'block';
     productSuggestionsDiv.classList.add('active');
}

function hideProductSuggestions() {
    if (productSuggestionsDiv) {
        productSuggestionsDiv.style.display = 'none';
        productSuggestionsDiv.classList.remove('active');
        productSuggestionsDiv.querySelector('ul').innerHTML = '';
    }
    activeProductInput = null;
}

function handleProductSearchInput(event) {
    const inputElement = event.target;
    if (!inputElement || !inputElement.matches('.product-name')) return;
    const term = inputElement.value.trim().toLowerCase();
    activeProductInput = inputElement; // Update active input

    if (term.length < 1) { // Only search if term is long enough
        hideProductSuggestions();
        return;
    }
    getOrFetchProductCache().then(cache => {
        filterAndRenderProductSuggestions(term, inputElement);
    }).catch(error => {
        console.error("Error getting product cache for suggestions:", error);
         // Show error in suggestions box
         const suggestionsContainer = getOrCreateProductSuggestionsDiv();
         const ul = suggestionsContainer.querySelector('ul');
         ul.innerHTML = '<li class="no-suggestions">Error loading products</li>';
         positionProductSuggestions(inputElement);
    });
}

function filterAndRenderProductSuggestions(term, inputElement) {
    const suggestionsContainer = getOrCreateProductSuggestionsDiv();
    const filteredProducts = productCache.filter(p =>
        (p.name || '').toLowerCase().includes(term) ||
        (p.productCode || '').toLowerCase().includes(term) // Search by name or code
    );
    renderProductSuggestions(filteredProducts, term, suggestionsContainer);
    if (filteredProducts.length > 0) {
        positionProductSuggestions(inputElement);
    } else {
        hideProductSuggestions(); // Hide if no results
    }
}

function renderProductSuggestions(suggestions, term, suggestionsContainer) {
    const ul = suggestionsContainer.querySelector('ul');
    ul.innerHTML = ''; // Clear previous
    if (suggestions.length > 0) {
        suggestions.slice(0, 10).forEach(p => { // Limit to 10 suggestions
            const li = document.createElement('li');
            const name = escapeHtml(p.name);
            const rate = formatCurrency(p.rate); // Agent rate
            const code = p.productCode ? ` (${escapeHtml(p.productCode)})` : '';
            // Simple highlight
            const displayName = name.replace(new RegExp(term, 'gi'), match => `<strong>${match}</strong>`);
            const displayCode = code.replace(new RegExp(term, 'gi'), match => `<strong>${match}</strong>`);

            li.innerHTML = `${displayName}${displayCode} - ${rate}`;
            li.dataset.productId = p.id; // Store product data if needed, or just select using object
            li.onclick = () => { // Use onclick for simplicity here
                selectProductSuggestion(p, activeProductInput); // Pass the product object and the input
            };
            ul.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.classList.add('no-suggestions');
        li.textContent = 'No matching products found.'; // English message
        ul.appendChild(li);
    }
}

function selectProductSuggestion(productData, inputElement) {
    if (!inputElement || !productData) return;
    const row = inputElement.closest('.item-row');
    if (!row) return;

    inputElement.value = productData.name; // Set input value

    const rateInput = row.querySelector('.rate-input');
    const unitTypeSelect = row.querySelector('.unit-type-select');

    if (rateInput) {
        rateInput.value = productData.rate.toFixed(2); // Set agent rate (readonly)
    }
    if (unitTypeSelect) {
        unitTypeSelect.value = productData.unitType || 'Qty'; // Set unit type
        handleUnitTypeChange({ target: unitTypeSelect }); // Trigger update for Sq Ft fields
    }
    hideProductSuggestions();
    updateItemAmount(row); // Recalculate amount for this row
}

function handleSuggestionClick(event) {
    // This prevents the input from losing focus before the click event on the suggestion fires
    event.preventDefault();
}

function handleGlobalClickForSuggestions(event) {
    // Hide customer suggestions
    if (customerSuggestionsNameBox && !customerSuggestionsNameBox.contains(event.target) && event.target !== customerNameInput) {
        hideSuggestionBox(customerSuggestionsNameBox);
    }
    if (customerSuggestionsWhatsAppBox && !customerSuggestionsWhatsAppBox.contains(event.target) && event.target !== customerWhatsAppInput) {
        hideSuggestionBox(customerSuggestionsWhatsAppBox);
    }
    // Hide product suggestions
    if (productSuggestionsDiv && !productSuggestionsDiv.contains(event.target) && event.target !== activeProductInput) {
        hideProductSuggestions();
    }
}

// --- Form Submission ---
async function handleFormSubmit(event) {
    event.preventDefault();
    console.log("Agent order submit initiated...");
    showFormError(''); // Clear previous errors

    if (!currentUser || !agentPermissions) {
        showFormError("Error: Cannot submit order. User or permissions not loaded."); // English message
        return;
    }
    if (!db || !collection || !addDoc || !serverTimestamp || !Timestamp) {
         showFormError("Error: Database connection not ready."); // English message
         return;
    }

    // Disable button and show loader
    const saveBtnSpan = saveOrderBtn.querySelector('span');
    const saveBtnIcon = saveOrderBtn.querySelector('i');
    const originalBtnText = saveBtnSpan ? saveBtnSpan.textContent : "Submit Order";
    saveOrderBtn.disabled = true;
    if(saveBtnSpan) saveBtnSpan.textContent = 'Submitting...'; // English message
    if(saveBtnIcon) saveBtnIcon.className = 'fas fa-spinner fa-spin';

    try {
        // 1. Validate Customer
        const customerName = customerNameInput.value.trim();
        const customerWhatsapp = customerWhatsAppInput.value.trim();
        const customerIdToUse = selectedCustomerIdInput?.value || selectedCustomerId || null; // Get selected ID

        if (!customerName || !customerWhatsapp) throw new Error("Customer Name and WhatsApp Number are required."); // English message
        if (!customerIdToUse) {
            // If agent can add customers, logic to create/link new customer would go here.
            // For now, assume selection is mandatory.
            if (agentPermissions.canAddCustomers) {
                 throw new Error("Please select an existing customer or create a new one (functionality pending)."); // English message
            } else {
                 throw new Error("Please select an existing customer."); // English message
            }
        }

        // 2. Validate and collect items
        const items = [];
        const rows = orderItemsTableBody.querySelectorAll('.item-row');
        if (rows.length === 0) throw new Error("Please add at least one item to the order."); // English message
        let validationPassed = true;
        rows.forEach((row, idx) => {
            if (!validationPassed) return;
            const productNameInput = row.querySelector('.product-name');
            const unitTypeSelect = row.querySelector('.unit-type-select');
            const quantityInput = row.querySelector('.quantity-input');
            const rateInput = row.querySelector('.rate-input'); // Agent rate input
            const itemAmountSpan = row.querySelector('.item-amount');
            const widthInput = row.querySelector('.width-input');
            const heightInput = row.querySelector('.height-input');
            const unitSelect = row.querySelector('.dimension-unit-select');

            const productName = productNameInput?.value.trim();
            const unitType = unitTypeSelect?.value;
            const quantity = parseInt(quantityInput?.value || 0);
            const rate = parseFloat(rateInput?.value || ''); // Agent rate
            const itemAmount = parseFloat(itemAmountSpan?.textContent || 0);

            if (!productName) { validationPassed = false; showFormError(`Item ${idx + 1}: Product name is required.`); productNameInput?.focus(); return; } // English
            if (isNaN(quantity) || quantity <= 0) { validationPassed = false; showFormError(`Item ${idx + 1}: Quantity must be a positive number.`); quantityInput?.focus(); return; } // English
            if (isNaN(rate) || rate < 0) { validationPassed = false; showFormError(`Item ${idx + 1}: Valid agent rate is required.`); rateInput?.focus(); return; } // English

            const itemData = { productName, unitType, quantity, rate, itemAmount };

            if (unitType === 'Sq Feet') {
                 const width = parseFloat(widthInput?.value || '');
                 const height = parseFloat(heightInput?.value || '');
                 const dimensionUnit = unitSelect?.value;
                 if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0) {
                      validationPassed = false; showFormError(`Item ${idx + 1}: Valid Width and Height required for Sq Feet.`); widthInput?.focus(); return; // English
                 }
                 itemData.width = width;
                 itemData.height = height;
                 itemData.dimensionUnit = dimensionUnit;
                 itemData.sqFeetArea = calculateFlexDimensions(dimensionUnit, width, height); // Store calculated area
            }
            items.push(itemData);
        });
        if (!validationPassed) throw new Error("Please correct the errors in the item list."); // English message

        // 3. Collect other order details
        const deliveryDateValue = deliveryDateInput.value;
        const remarksValue = remarksInput.value.trim();
        const urgentRadio = document.querySelector('input[name="agent_urgent"]:checked');
        const urgentValue = urgentRadio ? urgentRadio.value === "Yes" : false; // Default to No if none selected

        // 4. Collect summary details
        const subTotal = parseFloat(summarySubtotalSpan.textContent) || 0;
        const discountPercent = parseFloat(summaryDiscountPercentInput.value) || 0;
        const discountAmount = parseFloat(summaryDiscountAmountInput.value) || 0;
        const finalAmount = parseFloat(summaryFinalAmountSpan.textContent) || 0;

        // 5. Prepare Firestore payload for 'pendingAgentOrders' collection
        const pendingOrderData = {
            agentId: currentUser.uid,
            agentEmail: agentPermissions.email || currentUser.email, // Get email from permissions/auth
            customerId: customerIdToUse,
            customerDetails: { // Snapshot of customer details at time of order
                fullName: customerName,
                whatsappNo: customerWhatsapp,
                address: customerAddressInput.value.trim() || '',
                contactNo: customerContactInput.value.trim() || ''
            },
            // Store date as Timestamp, treating input as local date start
            deliveryDate: deliveryDateValue ? Timestamp.fromDate(new Date(deliveryDateValue + 'T00:00:00')) : null,
            remarks: remarksValue,
            urgent: urgentValue,
            items: items, // Array of item objects
            subTotal: subTotal,
            discountPercentage: discountPercent,
            discountAmount: discountAmount,
            finalAmount: finalAmount,
            status: "Pending Admin Approval", // Initial status
            submittedAt: serverTimestamp() // Firestore server timestamp
        };

        // 6. Save to 'pendingAgentOrders' collection
        const pendingOrdersRef = collection(db, "pendingAgentOrders");
        const docRef = await addDoc(pendingOrdersRef, pendingOrderData);

        console.log("Pending agent order submitted successfully:", docRef.id);
        alert(`Order submitted successfully for processing! Pending ID: ${docRef.id.substring(0,10)}...`); // English alert
        resetAgentOrderForm(true); // Reset everything

    } catch (error) {
        console.error("Order submission failed:", error);
        showFormError("Error submitting order: " + error.message); // English error
    } finally {
        // Re-enable button and restore text/icon
        if(saveOrderBtn) {
            saveOrderBtn.disabled = false;
            if(saveBtnSpan) saveBtnSpan.textContent = originalBtnText;
            if(saveBtnIcon) saveBtnIcon.className = 'fas fa-paper-plane';
        }
    }
}

// --- Reset Form ---
function resetAgentOrderForm(clearAll = true) {
    if(orderForm) orderForm.reset(); // Reset native form elements
    if(orderItemsTableBody) {
        // Remove all but the first row, then clear the first row
        while (orderItemsTableBody.rows.length > 1) {
            orderItemsTableBody.deleteRow(1);
        }
        if (orderItemsTableBody.rows.length === 1) {
             const firstRow = orderItemsTableBody.rows[0];
             firstRow.querySelector('.product-name').value = '';
             firstRow.querySelector('.quantity-input').value = '1';
             firstRow.querySelector('.rate-input').value = '';
             firstRow.querySelector('.item-amount').textContent = '0.00';
             const unitTypeSelect = firstRow.querySelector('.unit-type-select');
             if (unitTypeSelect) unitTypeSelect.value = 'Qty';
             handleUnitTypeChange({target: unitTypeSelect}); // Hide SqFt fields
        } else if (orderItemsTableBody.rows.length === 0) {
             addInitialItemRow(); // Add one row back if table was completely empty
        }
    }
    if(clearAll) {
       resetCustomerFields(true); // Clear customer fields as well
    }
    if(summarySubtotalSpan) summarySubtotalSpan.textContent = '0.00';
    if(summaryDiscountPercentInput) summaryDiscountPercentInput.value = '';
    if(summaryDiscountAmountInput) summaryDiscountAmountInput.value = '';
    if(summaryFinalAmountSpan) summaryFinalAmountSpan.textContent = '0.00';
    showFormError(''); // Clear error message
    selectedCustomerId = null; // Clear selected customer ID
    if(selectedCustomerIdInput) selectedCustomerIdInput.value = '';
}

// --- Pre-fetch Caches ---
function preFetchCaches() {
    getOrFetchProductCache().catch(err => console.error("Initial product cache fetch failed:", err));
    getOrFetchCustomerCache().catch(err => console.error("Initial customer cache fetch failed:", err));
}

console.log("agent_create_order.js loaded and ready (v2 - English)."); // English comment