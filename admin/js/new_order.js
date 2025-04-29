// new_order.js
// Version: 2.5.1 (Updated Balance Display Logic: Due = Red/-, Credit = Green/+)
// PLEASE TEST THOROUGHLY AFTER IMPLEMENTING.

// --- Delay Timer ---
const INITIALIZATION_DELAY = 500; // milliseconds (Reduced delay slightly)
console.log(`new_order.js (V2.5.1): Waiting ${INITIALIZATION_DELAY}ms before initializing...`);

// Wrap the entire initialization logic in a setTimeout
setTimeout(() => {
    console.log("new_order.js (V2.5.1): Delay finished, proceeding with initialization.");

    // --- Firebase Functions ---
    let db, collection, addDoc, doc, getDoc, getDocs, updateDoc, runTransaction, query, where, orderBy, limit, Timestamp, arrayUnion, serverTimestamp;
    try {
        // Access functions *after* the delay
        ({
            db, collection, addDoc, doc, getDoc, getDocs, updateDoc, runTransaction,
            query, where, orderBy, limit, Timestamp, arrayUnion, serverTimestamp
        } = window); // Destructure from global window object set by HTML

        if (!db || !collection || !addDoc) { // Basic check
             throw new Error("Essential Firestore functions not found on window object.");
        }
         console.log("new_order.js (V2.5.1): Firebase functions confirmed available.");

    } catch (error) {
        console.error("new_order.js (V2.5.1): Critical error accessing Firebase functions:", error);
        alert("Application Error: Cannot initialize Firebase connection in new_order.js. Check console and HTML setup.");
        // Disable save button if initialization fails critically
        const saveBtn = document.getElementById('saveOrderBtn');
        if (saveBtn) saveBtn.disabled = true;
        return; // Stop execution if Firebase isn't ready
    }


    // --- Global Variables ---
    let isEditMode = false;
    let orderIdToEdit = null;
    let currentOrderData = null;
    let selectedCustomerId = null;
    let selectedCustomerData = null;
    let productCache = [];
    let customerCache = [];
    let productFetchPromise = null;
    let customerFetchPromise = null;
    let activeProductInput = null;
    let productSearchDebounceTimer;
    let customerSearchDebounceTimer;
    let isDiscountInputProgrammaticChange = false;
    let productSuggestionsDiv = null;

    // --- DOM Element References ---
    // Ensure DOM is ready before accessing elements
    const orderForm = document.getElementById('newOrderForm');
    const saveButton = document.getElementById('saveOrderBtn');
    const saveButtonText = saveButton ? saveButton.querySelector('span') : null;
    const headerText = document.getElementById('headerText');
    const breadcrumbAction = document.getElementById('breadcrumbAction');
    const hiddenEditOrderIdInput = document.getElementById('editOrderId');
    const selectedCustomerIdInput = document.getElementById('selectedCustomerId');
    const displayOrderIdInput = document.getElementById('display_order_id');
    const manualOrderIdInput = document.getElementById('manual_order_id');
    const customerNameInput = document.getElementById('full_name');
    const customerWhatsAppInput = document.getElementById('whatsapp_no');
    const customerAddressInput = document.getElementById('address');
    const customerContactInput = document.getElementById('contact_no');
    const customerSuggestionsNameBox = document.getElementById('customer-suggestions-name');
    const customerSuggestionsWhatsAppBox = document.getElementById('customer-suggestions-whatsapp');
    const customerAccountLinkArea = document.getElementById('customerAccountLinkArea');
    const viewCustomerAccountLink = document.getElementById('viewCustomerAccountLink');
    const customerBalanceArea = document.getElementById('customerBalanceArea');
    const customerCurrentBalanceSpan = document.getElementById('customerCurrentBalance');
    const orderDateInput = document.getElementById('order_date');
    const deliveryDateInput = document.getElementById('delivery_date');
    const remarksInput = document.getElementById('remarks');
    const orderItemsTableBody = document.getElementById('orderItemsTableBody');
    const itemRowTemplate = document.getElementById('item-row-template');
    const addItemBtn = document.getElementById('addItemBtn');
    const calculationPreviewArea = document.getElementById('calculationPreviewArea');
    const calculationPreviewContent = document.getElementById('calculationPreviewContent');
    const summarySubtotalSpan = document.getElementById('summarySubtotal');
    const summaryDiscountPercentInput = document.getElementById('summaryDiscountPercent');
    const summaryDiscountAmountInput = document.getElementById('summaryDiscountAmount');
    const summaryFinalAmountSpan = document.getElementById('summaryFinalAmount');
    const summaryAdvancePaymentInput = document.getElementById('summaryAdvancePayment');
    const summaryTotalBalanceSpan = document.getElementById('summaryTotalBalance');
    const creditLimitWarningDiv = document.getElementById('creditLimitWarning');
    const orderStatusSelect = document.getElementById('orderStatusSelect');
    const formErrorMsg = document.getElementById('formErrorMsg');
    const whatsappReminderPopup = document.getElementById('whatsapp-reminder-popup');
    const whatsappMsgPreview = document.getElementById('whatsapp-message-preview');
    const whatsappSendLink = document.getElementById('whatsapp-send-link');
    const popupCloseBtn = document.getElementById('popup-close-btn');

    // --- Status Definitions (for color mapping) ---
    const statusList = [
        "Order Received", "Designing", "Verification", "Design Approved",
        "Printing", "Ready for Working", "Delivered", "Completed"
    ];

    // --- Initialization Function ---
    function initializeAppLogic() {
        console.log("new_order.js (V2.5.1): Initializing App Logic...");

        if (!orderForm || !addItemBtn || !orderItemsTableBody || !itemRowTemplate || !calculationPreviewArea || !calculationPreviewContent || !orderStatusSelect) {
            console.error("Critical DOM elements missing! Check HTML IDs.");
            alert("Page structure error. Cannot initialize order form.");
            return;
        }

        // Event Listeners (Keep existing)
        orderForm.addEventListener('submit', handleFormSubmit);
        addItemBtn.addEventListener('click', handleAddItem);
        orderItemsTableBody.addEventListener('click', handleItemTableClick);
        orderItemsTableBody.addEventListener('input', handleItemTableInput);
        orderItemsTableBody.addEventListener('change', handleItemTableChange);
        orderItemsTableBody.addEventListener('focusin', (event) => { if (event.target.matches('.product-name')) activeProductInput = event.target; });
        if (customerNameInput) { customerNameInput.addEventListener('input', (e) => handleCustomerInput(e, 'name')); customerNameInput.addEventListener('blur', () => setTimeout(() => { if(customerSuggestionsNameBox && !customerSuggestionsNameBox.matches(':hover')) hideSuggestionBox(customerSuggestionsNameBox); }, 150)); } else { console.warn("Customer name input not found."); }
        if (customerWhatsAppInput) { customerWhatsAppInput.addEventListener('input', (e) => handleCustomerInput(e, 'whatsapp')); customerWhatsAppInput.addEventListener('blur', () => setTimeout(() => { if(customerSuggestionsWhatsAppBox && !customerSuggestionsWhatsAppBox.matches(':hover')) hideSuggestionBox(customerSuggestionsWhatsAppBox); }, 150)); } else { console.warn("Customer whatsapp input not found."); }
        if (summaryDiscountPercentInput) summaryDiscountPercentInput.addEventListener('input', handleDiscountInput); else { console.warn("Discount % input not found."); }
        if (summaryDiscountAmountInput) summaryDiscountAmountInput.addEventListener('input', handleDiscountInput); else { console.warn("Discount Amount input not found."); }
        if (summaryAdvancePaymentInput) summaryAdvancePaymentInput.addEventListener('input', updateOrderSummary); else { console.warn("Advance Payment input not found."); }
        if (popupCloseBtn) popupCloseBtn.addEventListener('click', closeWhatsAppPopup);
        if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (event) => { if (event.target === whatsappReminderPopup) closeWhatsAppPopup(); });
        document.addEventListener('click', handleGlobalClick);
        orderStatusSelect.addEventListener('change', (event) => { updateStatusDropdownColor(event.target.value); });

        // Call the form initialization logic
        initializeForm();
    }

    // Run the app logic initialization
    initializeAppLogic();


    // --- Global Click Handler --- (Keep existing)
    function handleGlobalClick(event) {
        if (productSuggestionsDiv && activeProductInput && !productSuggestionsDiv.contains(event.target) && event.target !== activeProductInput) { hideProductSuggestions(); }
        if (customerSuggestionsNameBox && customerNameInput && !customerSuggestionsNameBox.contains(event.target) && event.target !== customerNameInput) { hideSuggestionBox(customerSuggestionsNameBox); }
        if (customerSuggestionsWhatsAppBox && customerWhatsAppInput && !customerSuggestionsWhatsAppBox.contains(event.target) && event.target !== customerWhatsAppInput) { hideSuggestionBox(customerSuggestionsWhatsAppBox); }
    }

    // --- Utility Functions --- (Keep existing or add formatNumber)
    function hideSuggestionBox(box) { if(box){box.classList.remove('active');box.style.display='none';}}

    // <<< NEW/MODIFIED HELPER >>> Formats number only
    function formatNumber(amount) {
        const num = Number(amount);
        if (isNaN(num)) return 'N/A';
        return Math.abs(num).toLocaleString('en-IN', { // Use Math.abs for simplicity
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
    // <<< END HELPER >>>

    function showFormError(message) { if(formErrorMsg){formErrorMsg.textContent=message;formErrorMsg.style.display=message?'block':'none';if(message)formErrorMsg.scrollIntoView({behavior:'smooth',block:'center'});}else if(message){alert(message);}}

    // --- Form Initialization --- (Keep existing)
    function initializeForm() { /* ... existing code ... */ }

    // --- Pre-fetch Caches --- (Keep existing)
    function preFetchCaches() { /* ... existing code ... */ }

    // --- Load Order For Edit --- (Keep existing)
    async function loadOrderForEdit(docId) { /* ... existing code ... */ }

    // --- Item Handling --- (Keep existing)
    function handleAddItem() { /* ... existing code ... */ }
    function addItemRow(focus = true) { /* ... existing code ... */ }
    function populateItemRow(row, itemData) { /* ... existing code ... */ }
    function handleItemTableClick(event) { /* ... existing code ... */ }
    function handleSuggestionClick(event) { /* ... existing code ... */ }
    function handleItemTableInput(event) { /* ... existing code ... */ }
    function handleItemTableChange(event){ /* ... existing code ... */ }

    // --- Sq Ft Calculation Logic --- (Keep existing)
    function calculateFlexDimensions(unit, width, height) { /* ... existing code ... */ }
    function handleUnitTypeChange(event) { /* ... existing code ... */ }
    function updateItemAmount(row) { /* ... existing code ... */ }

    // --- Calculation Preview Logic --- (Keep existing)
    function updateCalculationPreview() { /* ... existing code ... */ }

    // --- Order Summary Calculation --- (Keep existing)
    function updateOrderSummary() { /* ... existing code ... */ }
    function handleDiscountInput(event) { /* ... existing code ... */ }

    // --- Customer Autocomplete & Details --- (Keep existing fetching/filtering logic)
    async function getOrFetchCustomerCache() { /* ... existing code ... */ }
    function handleCustomerInput(event, type) { /* ... existing code ... */ }
    function filterAndRenderCustomerSuggestions(term, type, box, inputElement) { /* ... existing code ... */ }
    function renderCustomerSuggestions(suggestions, term, box, inputElement) { /* ... existing code ... */ }
    function fillCustomerData(customerData) { /* ... existing code ... */ }

    // <<< MODIFIED FUNCTION >>> (fetchAndDisplayCustomerDetails)
    // Updates balance display logic
    async function fetchAndDisplayCustomerDetails(customerId) {
        if (!customerId) { console.warn("fetchAndDisplayCustomerDetails called without customerId."); resetCustomerSelectionUI(true); return; }
        console.log(`Fetching details and balance for customer: ${customerId}`);
        resetCustomerSelectionUI(false); // Clear previous balance display first

        try {
            // 1. Get Customer Data (from cache or DB)
            let c = customerCache.find(cust => cust.id === customerId);
            if (!c) {
                console.log(`Customer ${customerId} not in cache, fetching from DB...`);
                const customerDoc = await getDoc(doc(db, "customers", customerId));
                if (customerDoc.exists()) {
                    c = { id: customerDoc.id, ...customerDoc.data() };
                } else {
                    console.warn("Customer not found in DB:", customerId);
                    showFormError(`Selected customer (ID: ${customerId.substring(0,6)}...) not found in database.`);
                    resetCustomerSelectionUI(true);
                    return;
                }
            }
            selectedCustomerData = c;

            // 2. Fill Customer Info Inputs (if empty)
            if(!customerNameInput.value && c.fullName) customerNameInput.value = c.fullName;
            if(!customerWhatsAppInput.value && c.whatsappNo) customerWhatsAppInput.value = c.whatsappNo;
            if(!customerAddressInput.value && (c.billingAddress || c.address)) customerAddressInput.value = c.billingAddress || c.address;
            if(!customerContactInput.value && c.contactNo) customerContactInput.value = c.contactNo;

            // 3. Calculate and Display Balance
            let balanceText = 'Calculating...';
            let balanceNum = NaN;
            let balanceClass = ''; // CSS class for color
            let prefix = '';      // + or - sign

            if(customerBalanceArea) {
                customerCurrentBalanceSpan.textContent = balanceText;
                customerCurrentBalanceSpan.className = ''; // Reset class
                customerBalanceArea.style.display = 'block';
            }

            try {
                // Calculate balance using helper functions
                const totalPaidAdjusted = await loadPaymentTotals_NewOrder(customerId); // Includes adjustments
                const totalOrderValue = await loadOrderTotals_NewOrder(customerId);

                if (totalOrderValue !== 'N/A') { // Check if order total could be fetched
                    balanceNum = Number(totalOrderValue) - Number(totalPaidAdjusted);

                    // --- Apply New Display Logic (Due = Red/-, Credit = Green/+) ---
                    let displayBalance = balanceNum;
                    if (balanceNum > 0.001) { // Positive Balance = Due
                        balanceClass = 'negative-balance'; // Use negative class for RED
                        prefix = '-';
                        // displayBalance = balanceNum;
                    } else if (balanceNum < -0.001) { // Negative Balance = Credit
                        balanceClass = 'positive-balance'; // Use positive class for GREEN
                        prefix = '+';
                        displayBalance = Math.abs(balanceNum);
                    } else { // Zero Balance
                         balanceClass = '';
                         prefix = '';
                         displayBalance = 0;
                    }

                    const formattedNumber = formatNumber(Math.abs(displayBalance));
                    balanceText = `₹${prefix}${formattedNumber}`;
                    if (balanceClass === '') balanceText = `₹0.00`; // Explicit zero format
                    // --- End New Display Logic ---

                } else if (totalPaidAdjusted !== 0) { // Only have payment info
                     balanceNum = -totalPaidAdjusted; // Treat as credit
                     balanceClass = 'positive-balance'; // Green
                     prefix = '+';
                     balanceText = `₹${prefix}${formatNumber(Math.abs(balanceNum))}`; // Show as credit
                } else { // No orders, no payments found
                     balanceText = '₹0.00';
                     balanceNum = 0;
                     balanceClass = '';
                }

            } catch (calcError) {
                console.error("Error calculating balance:", calcError);
                balanceText = 'Error';
                balanceNum = NaN;
                balanceClass = 'negative-balance'; // Show error in red
            }

            // 4. Update Balance Display SPAN
            if(customerBalanceArea) {
                customerCurrentBalanceSpan.textContent = balanceText;
                customerCurrentBalanceSpan.className = balanceClass; // Apply color class
                customerCurrentBalanceSpan.title = `Calculated Balance: ${balanceNum.toFixed(2)}`; // Tooltip with actual value
            }

            // 5. Show Account Link
            if(viewCustomerAccountLink && customerAccountLinkArea){
                viewCustomerAccountLink.href = `customer_account_detail.html?id=${encodeURIComponent(customerId)}`;
                customerAccountLinkArea.style.display = 'block';
            }

            // 6. Check Credit Limit (uses calculated balanceNum)
            checkCreditLimit(balanceNum);

        } catch (e) {
            console.error("Error in fetchAndDisplayCustomerDetails:", e);
            resetCustomerSelectionUI(true);
            showFormError("Error loading customer details or balance.");
        }
    }
    // <<< MODIFIED FUNCTION END >>>

    function resetCustomerSelectionUI(clearInputs = true) { /* ... existing code ... */ }

    // --- Credit Limit Check --- (Keep existing)
    function checkCreditLimit(currentBalanceNum = NaN) { /* ... existing code ... */ }

    // --- Product Autocomplete --- (Keep existing)
    function getOrCreateProductSuggestionsDiv() { /* ... existing code ... */ }
    function positionProductSuggestions(inputElement) { /* ... existing code ... */ }
    function hideProductSuggestions() { /* ... existing code ... */ }
    function handleProductSearchInput(event) { /* ... existing code ... */ }
    async function getOrFetchProductCache() { /* ... existing code ... */ }
    function filterAndRenderProductSuggestions(term, inputElement) { /* ... existing code ... */ }
    function renderProductSuggestions(suggestions, term, suggestionsContainer) { /* ... existing code ... */ }
    function selectProductSuggestion(productData, inputElement) { /* ... existing code ... */ }

    // --- Status Dropdown Handling --- (Keep existing)
    function updateStatusDropdownColor(statusValue) { /* ... existing code ... */ }

    // --- Get Next ID Function --- (Keep existing)
    async function getNextIdWithPrefix(counterName, prefix = '', startId = 101) { /* ... existing code ... */ }

    // --- Form Submit --- (Keep existing V2.5 logic for ID gen and source)
    async function handleFormSubmit(event) { /* ... existing code ... */ }

    // --- Reset Form --- (Keep existing)
    function resetNewOrderForm() { /* ... existing code ... */ }

    // --- WhatsApp Reminder Functions --- (Keep existing)
    function showWhatsAppReminder(customer, orderId, deliveryDateStr) { /* ... existing code ... */ }
    function closeWhatsAppPopup() { /* ... existing code ... */ }

    // --- Balance Calculation Helper Functions --- (Keep existing)
    // These calculate the actual balance (Order Total - Net Paid/Adjusted)
    async function loadPaymentTotals_NewOrder(customerId) { /* ... existing code ... */ }
    async function loadOrderTotals_NewOrder(customerId) { /* ... existing code ... */ }

    // --- Log that the script finished loading ---
    console.log("new_order.js (V2.5.1 - Inverted Balance Display) script logic initialized.");

}, INITIALIZATION_DELAY); // End of setTimeout wrapper