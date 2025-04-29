// new_order.js
// Version: 1.2 (Balance Display Fix, Product Description Added + Combined Updates)

// --- Delay Timer ---
const INITIALIZATION_DELAY = 500; // milliseconds (Adjust if needed)
console.log(`new_order.js V1.2: Waiting ${INITIALIZATION_DELAY}ms before initializing...`);

setTimeout(() => {
    console.log("new_order.js V1.2: Delay finished, proceeding with initialization.");

    // --- Firebase Functions ---
    // Try accessing functions attached to window by HTML script
    const {
        db, collection, addDoc, doc, getDoc, getDocs, updateDoc, runTransaction,
        query, where, orderBy, limit, Timestamp, arrayUnion, serverTimestamp
    } = window;

    // --- Global Variables ---
    let isEditMode = false;
    let orderIdToEdit = null;
    let currentOrderData = null;
    let selectedCustomerId = null;
    let selectedCustomerData = null; // Holds full data of selected customer
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
    const customerCurrentBalanceSpan = document.getElementById('customerCurrentBalance'); // Span to update
    const orderDateInput = document.getElementById('order_date');
    const deliveryDateInput = document.getElementById('delivery_date');
    const remarksInput = document.getElementById('remarks');
    const orderItemsTableBody = document.getElementById('orderItemsTableBody');
    const itemRowTemplate = document.getElementById('item-row-template'); // Reference to the template
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
        console.log("New Order V1.2 DOM Loaded. Initializing App Logic...");

        if (!orderForm || !addItemBtn || !orderItemsTableBody || !itemRowTemplate || !calculationPreviewArea || !calculationPreviewContent || !orderStatusSelect) {
            console.error("Critical DOM elements missing! Check HTML IDs.");
            alert("Page structure error. Cannot initialize order form.");
            return;
        }

        // Check if DB functions are actually available now
        if (!db || !runTransaction || !collection || !getDocs || !query || !where) {
             console.error("DB functions still missing after delay!", {db: !!db, runTransaction: typeof runTransaction, collection: typeof collection});
             alert("DB Connection failed even after delay. Check HTML Firebase setup and console.");
             if(saveButton) saveButton.disabled = true;
             return;
        }
         console.log("DB functions confirmed available after delay.");

        // Event Listeners
        orderForm.addEventListener('submit', handleFormSubmit);
        addItemBtn.addEventListener('click', handleAddItem);
        orderItemsTableBody.addEventListener('click', handleItemTableClick);
        orderItemsTableBody.addEventListener('input', handleItemTableInput); // Handles inputs including description
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


    // --- Global Click Handler ---
    function handleGlobalClick(event) {
        if (productSuggestionsDiv && activeProductInput && !productSuggestionsDiv.contains(event.target) && event.target !== activeProductInput) { hideProductSuggestions(); }
        if (customerSuggestionsNameBox && customerNameInput && !customerSuggestionsNameBox.contains(event.target) && event.target !== customerNameInput) { hideSuggestionBox(customerSuggestionsNameBox); }
        if (customerSuggestionsWhatsAppBox && customerWhatsAppInput && !customerSuggestionsWhatsAppBox.contains(event.target) && event.target !== customerWhatsAppInput) { hideSuggestionBox(customerSuggestionsWhatsAppBox); }
    }

    // --- Utility Functions ---
    function hideSuggestionBox(box) { if(box){box.classList.remove('active');box.style.display='none';}}
    function formatCurrency(amount) { const n=Number(amount||0); return `₹${n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`; }
    function showFormError(message) { if(formErrorMsg){formErrorMsg.textContent=message;formErrorMsg.style.display=message?'block':'none';if(message)formErrorMsg.scrollIntoView({behavior:'smooth',block:'center'});}else if(message){alert(message);}}

    // --- Form Initialization ---
    function initializeForm() {
        console.log("Running initializeForm (V1.2)...");
        const uP=new URLSearchParams(window.location.search);
        orderIdToEdit=uP.get('editOrderId');
        const customerIdFromUrl = uP.get('customerId');

        if(orderIdToEdit){
            isEditMode=true;
            console.log("Edit Mode:", orderIdToEdit);
            if(headerText)headerText.textContent="Edit Order";
            if(breadcrumbAction)breadcrumbAction.textContent="Edit Order";
            if(saveButtonText)saveButtonText.textContent="Update Order";
            if(hiddenEditOrderIdInput)hiddenEditOrderIdInput.value=orderIdToEdit;
            if(manualOrderIdInput)manualOrderIdInput.readOnly=true;
            loadOrderForEdit(orderIdToEdit); // This will load customer data too
        } else {
            isEditMode=false;
            console.log("Add Mode.");
            if(headerText)headerText.textContent="New Order";
            if(breadcrumbAction)breadcrumbAction.textContent="New Order";
            if(saveButtonText)saveButtonText.textContent="Save Order";
            if(manualOrderIdInput)manualOrderIdInput.readOnly=false;
            if(displayOrderIdInput) displayOrderIdInput.value = '';
            if(orderDateInput&&!orderDateInput.value)orderDateInput.value=new Date().toISOString().split('T')[0];
            const defaultStatus = "Order Received";
            orderStatusSelect.value = defaultStatus;
            updateStatusDropdownColor(defaultStatus);
            resetCustomerSelectionUI(true); // Reset customer fields

            if (customerIdFromUrl) {
                console.log("Customer ID found in URL for New Order:", customerIdFromUrl);
                selectedCustomerId = customerIdFromUrl;
                 if (selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId;
                // Fetch and display details including balance
                fetchAndDisplayCustomerDetails(customerIdFromUrl).catch(e => {
                    console.error("Error pre-filling customer details from URL:", e);
                    showFormError("Could not automatically load details for the selected customer.");
                    resetCustomerSelectionUI(true);
                });
            }

            // Add one empty item row initially
            if(orderItemsTableBody && orderItemsTableBody.children.length === 0){
                handleAddItem();
            } else if (!orderItemsTableBody){
                console.error("Table body missing!");
            }
            updateOrderSummary();
        }
        // Pre-fetch caches in background
        preFetchCaches();
    }

    // --- Pre-fetch Caches ---
    function preFetchCaches() { console.log("Pre-fetching caches..."); getOrFetchCustomerCache().catch(e=>console.error("Cust cache fetch err:", e)); getOrFetchProductCache().catch(e=>console.error("Prod cache fetch err:", e));}

    // --- Load Order For Edit (MODIFIED to populate description) ---
    async function loadOrderForEdit(docId) {
        console.log(`Loading order for edit: ${docId}`);
        showFormError('');
        if (!db || !doc || !getDoc) { showFormError("DB function error."); return; }
        try {
            const orderRef = doc(db, "orders", docId);
            const orderSnap = await getDoc(orderRef);
            if (orderSnap.exists()) {
                currentOrderData = orderSnap.data();
                console.log("Order data loaded for edit:", currentOrderData);
                selectedCustomerId = currentOrderData.customerId || currentOrderData.customerDetails?.customerId || null;
                if (selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId || '';

                // Populate Customer Fields
                customerNameInput.value = currentOrderData.customerName || currentOrderData.customerDetails?.fullName || '';
                customerWhatsAppInput.value = currentOrderData.whatsappNo || currentOrderData.customerDetails?.whatsappNo || '';
                customerAddressInput.value = currentOrderData.address || currentOrderData.customerDetails?.address || currentOrderData.customerDetails?.billingAddress || '';
                customerContactInput.value = currentOrderData.contactNo || currentOrderData.customerDetails?.contactNo || '';

                // Fetch full customer details (incl. balance) if ID exists
                if (selectedCustomerId) {
                    await fetchAndDisplayCustomerDetails(selectedCustomerId);
                } else {
                    console.warn("Order loaded but customerId is missing/null in data.");
                    resetCustomerSelectionUI(true);
                }

                // Populate Order Fields
                displayOrderIdInput.value = currentOrderData.orderId || docId;
                manualOrderIdInput.value = currentOrderData.orderId || ''; // Use manual ID field if present
                const primaryDate = currentOrderData.createdAt || currentOrderData.orderDate; // Handle both possible date fields
                orderDateInput.value = primaryDate?.toDate ? primaryDate.toDate().toISOString().split('T')[0] : (typeof primaryDate === 'string' ? primaryDate : '');
                deliveryDateInput.value = currentOrderData.deliveryDate?.toDate ? currentOrderData.deliveryDate.toDate().toISOString().split('T')[0] : (typeof currentOrderData.deliveryDate === 'string' ? currentOrderData.deliveryDate : '');
                remarksInput.value = currentOrderData.remarks || '';
                const urgentValue = currentOrderData.urgent || 'No';
                const urgentRadio = orderForm.querySelector(`input[name="urgent"][value="${urgentValue}"]`);
                if (urgentRadio) urgentRadio.checked = true;
                const loadedStatus = currentOrderData.status || "Order Received";
                orderStatusSelect.value = loadedStatus;
                updateStatusDropdownColor(loadedStatus);

                // Populate Order Items (including description)
                if (!orderItemsTableBody) { console.error("Item table body missing!"); return; }
                orderItemsTableBody.innerHTML = ''; // Clear existing rows
                const itemsToLoad = currentOrderData.items || currentOrderData.products || []; // Use 'items' first
                if (Array.isArray(itemsToLoad)) {
                    itemsToLoad.forEach(item => {
                        const itemDataForPopulation = {
                            productId: item.productId,
                            productName: item.productName || item.name, // Handle both possible names
                            itemDescription: item.itemDescription || '', // <<< Get description
                            unitType: item.unitType || item.unit,
                            quantity: item.quantity,
                            rate: item.rate,
                            minSalePrice: item.minSalePrice,
                            dimensionUnit: item.dimensionUnit,
                            width: item.width,
                            height: item.height
                        };
                        const newRow = addItemRow(false); // Add row without focusing
                        if (newRow) {
                            populateItemRow(newRow, itemDataForPopulation); // Populate with data
                            if (itemDataForPopulation.productId) {
                                newRow.dataset.productId = itemDataForPopulation.productId;
                            }
                        } else {
                            console.error("Failed to add row for item:", item);
                        }
                    });
                }
                // If no items loaded, add an empty row
                if (orderItemsTableBody.children.length === 0) { handleAddItem(); }

                // Populate Summary Fields
                if (summaryDiscountPercentInput) summaryDiscountPercentInput.value = currentOrderData.discountPercentage || '';
                if (summaryDiscountAmountInput) summaryDiscountAmountInput.value = currentOrderData.discountAmount || '';
                // Do NOT load advance payment here, it's a separate transaction usually
                if (summaryAdvancePaymentInput) summaryAdvancePaymentInput.value = ''; // Clear advance on edit load
                updateOrderSummary();

            } else {
                console.error("Order document not found for editing!");
                showFormError("Error: The order you are trying to edit could not be found.");
                if (saveButton) saveButton.disabled = true;
            }
        } catch (e) {
            console.error("Error loading order for edit:", e);
            showFormError("Error loading order data: " + e.message);
            if (saveButton) saveButton.disabled = true;
        }
    }

    // --- Item Handling ---
    function handleAddItem() {
        if (!itemRowTemplate || !orderItemsTableBody) {
            console.error("Template or body missing!");
            showFormError("Error: Page setup incomplete.");
            return;
        }
        const newRow = addItemRow(true); // Add and focus
        if (newRow) {
            updateOrderSummary(); // Recalculate summary after adding row
        } else {
            console.error("Failed adding item row.");
        }
    }

    function addItemRow(focus = true) {
        if (!itemRowTemplate || !orderItemsTableBody) {
            console.error("addItemRow: Prerequisites missing!"); return null;
        }
        try {
            const templateContent = itemRowTemplate.content.cloneNode(true);
            // Find the main row element within the template
            const newRowElement = templateContent.querySelector('.item-row');
            if (!newRowElement) {
                console.error("Template is missing the .item-row element"); return null;
            }
            orderItemsTableBody.appendChild(newRowElement); // Append only the row

            // Get the actual appended row element
            const appendedRow = orderItemsTableBody.lastElementChild;
            if (!appendedRow || !appendedRow.matches('.item-row')) {
                console.error("Failed to append or find the new row."); return null;
            }

            // Trigger initial setup for unit type display
            const unitTypeSelect = appendedRow.querySelector('.unit-type-select');
            if (unitTypeSelect) handleUnitTypeChange({ target: unitTypeSelect });

            // Focus on the first input if requested
            if (focus) {
                const firstInput = appendedRow.querySelector('.product-name');
                if (firstInput) firstInput.focus();
            }
            return appendedRow; // Return the appended row element
        } catch (e) {
            console.error("Error in addItemRow:", e);
            showFormError(`Error creating item row: ${e.message}`); return null;
        }
    }

    // --- MODIFIED to populate description ---
    function populateItemRow(row, itemData) {
        if (!row || !itemData) { console.warn("populateItemRow called with invalid row or data."); return; }
        try {
            row.querySelector('.product-name').value = itemData.productName || '';
            row.querySelector('.item-description-input').value = itemData.itemDescription || ''; // <<< Populate description
            row.querySelector('.unit-type-select').value = itemData.unitType || 'Qty';
            row.querySelector('.quantity-input').value = itemData.quantity || 1;
            const rateInput = row.querySelector('.rate-input');
            rateInput.value = itemData.rate !== undefined ? String(itemData.rate) : '';
            const minRate = itemData.minSalePrice;
            if (rateInput) rateInput.dataset.minRate = minRate !== undefined && minRate !== null ? String(minRate) : '-1'; // Store min rate

            // Handle Sq Feet specific fields
            if (itemData.unitType === 'Sq Feet') {
                row.querySelector('.dimension-unit-select').value = itemData.dimensionUnit || 'feet';
                row.querySelector('.width-input').value = itemData.width || '';
                row.querySelector('.height-input').value = itemData.height || '';
            }
            // Trigger unit type change handler to show/hide fields correctly
            handleUnitTypeChange({ target: row.querySelector('.unit-type-select') });
            updateItemAmount(row); // Calculate initial amount
        } catch (e) { console.error("Error populating item row:", e); }
    }

    function handleItemTableClick(event) {
        if (event.target.closest('.delete-item-btn')) {
            const row = event.target.closest('.item-row');
            if (row) {
                row.remove();
                hideProductSuggestions(); // Hide suggestions if open
                updateOrderSummary(); // Recalculate totals
                updateCalculationPreview(); // Update preview
            }
        }
    }

    function handleSuggestionClick(event) {
        const productLi = event.target.closest('.product-suggestions-list li[data-product]');
        const customerLi = event.target.closest('.suggestions-box li[data-customer-id]');

        if (productLi) { // Product suggestion clicked
            event.preventDefault();
            try {
                const productData = JSON.parse(productLi.dataset.product || '{}');
                if (activeProductInput) {
                    selectProductSuggestion(productData, activeProductInput);
                }
            } catch (e) { console.error("Error parsing/selecting product suggestion:", e); }
        } else if (customerLi) { // Customer suggestion clicked
            event.preventDefault();
            try {
                fillCustomerData(customerLi.dataset); // Use dataset attributes
                const box = customerLi.closest('.suggestions-box');
                if (box) hideSuggestionBox(box); // Hide suggestions
            } catch(e) { console.error("Error selecting customer suggestion:", e); }
        }
    }

    function handleItemTableInput(event) {
        const target = event.target;
        const row = target.closest('.item-row');
        if (!row) return;

        if (target.matches('.product-name')) {
            activeProductInput = target; // Keep track of active input
            handleProductSearchInput(event); // Trigger suggestions
        } else if (target.matches('.quantity-input, .rate-input, .width-input, .height-input')) {
            updateItemAmount(row); // Recalculate item amount on input change
        }
        // Description input changes don't require immediate recalculation
    }

    function handleItemTableChange(event){
        const target = event.target;
        const row = target.closest('.item-row');
        if (!row) return;

        if (target.matches('.unit-type-select')) {
            handleUnitTypeChange(event); // Update UI based on unit type
        } else if (target.matches('.dimension-unit-select')) {
            updateItemAmount(row); // Recalculate if dimension unit changes
        }
    }

    // --- Sq Ft Calculation Logic ---
    function calculateFlexDimensions(unit, width, height) {
        const mediaRolls = [3, 4, 5, 6, 8, 10]; // Available media widths in feet
        let widthFt = (unit === 'inches') ? parseFloat(width || 0) / 12 : parseFloat(width || 0);
        let heightFt = (unit === 'inches') ? parseFloat(height || 0) / 12 : parseFloat(height || 0);

        if (isNaN(widthFt) || isNaN(heightFt) || widthFt <= 0 || heightFt <= 0) {
            return { realSqFt: 0, printSqFt: 0, realWidthFt: 0, realHeightFt: 0, printWidthFt: 0, printHeightFt: 0 };
        }

        const realSqFt = widthFt * heightFt;

        // Find the best fit orientation
        let bestFit = { printWidth: 0, printHeight: 0, printSqFt: Infinity };

        // Option 1: Width fits a roll width
        const fittingWidthRoll = mediaRolls.find(rollWidth => rollWidth >= widthFt);
        let printWidth1 = fittingWidthRoll || widthFt; // Use roll width or actual if larger than max roll
        let printHeight1 = heightFt;
        let printSqFt1 = printWidth1 * printHeight1;

        // Option 2: Height fits a roll width (rotate 90 deg)
        const fittingHeightRoll = mediaRolls.find(rollWidth => rollWidth >= heightFt);
        let printWidth2 = widthFt;
        let printHeight2 = fittingHeightRoll || heightFt; // Use roll width or actual if larger than max roll
        let printSqFt2 = printWidth2 * printHeight2;

        // Choose the orientation with less wastage (smaller print area)
        if (printSqFt1 <= printSqFt2) {
            bestFit.printWidth = printWidth1;
            bestFit.printHeight = printHeight1;
            bestFit.printSqFt = printSqFt1;
        } else {
            bestFit.printWidth = printWidth2;
            bestFit.printHeight = printHeight2;
            bestFit.printSqFt = printSqFt2;
        }

        return {
            realSqFt: realSqFt.toFixed(2),
            printWidthFt: bestFit.printWidth,
            printHeightFt: bestFit.printHeight,
            printSqFt: bestFit.printSqFt.toFixed(2),
            realWidthFt: widthFt, // Return original dimensions in feet
            realHeightFt: heightFt
        };
    }

    function handleUnitTypeChange(event) {
        const row = event.target.closest('.item-row');
        if (!row) return;
        const unitType = event.target.value;
        const isSqFt = (unitType === 'Sq Feet');
        // Show/hide dimension inputs and unit selector
        row.querySelectorAll('.sq-feet-input').forEach(el => {
             el.style.display = isSqFt ? '' : 'none';
             // Make dimension inputs required only if Sq Feet is selected
             const inputs = el.querySelectorAll('input, select');
             inputs.forEach(input => input.required = isSqFt);
        });
        // Show/hide corresponding table header
        row.closest('table')?.querySelectorAll('thead th.sq-feet-header').forEach(th => th.classList.toggle('hidden-col', !isSqFt));
        // Update rate input placeholder
        row.querySelector('.rate-input').placeholder = isSqFt ? 'Rate/SqFt' : 'Rate/Unit';
        // Clear dimension inputs if switched away from Sq Feet
        if (!isSqFt) {
            row.querySelector('.width-input').value = '';
            row.querySelector('.height-input').value = '';
        }
        updateItemAmount(row); // Recalculate amount
    }

    function updateItemAmount(row) {
        if (!row) return;
        const unitTypeSelect = row.querySelector('.unit-type-select');
        const amountSpan = row.querySelector('.item-amount');
        const rateInput = row.querySelector('.rate-input');
        const quantityInput = row.querySelector('.quantity-input');
        const minRate = parseFloat(rateInput?.dataset.minRate || -1); // Get min rate from data attribute

        let calculatedAmount = 0;
        let rateValue = parseFloat(rateInput?.value || 0);
        let quantity = parseInt(quantityInput?.value || 1);
        if (isNaN(quantity) || quantity < 1) quantity = 1; // Default quantity to 1 if invalid

        try {
            // --- Rate validation ---
            rateInput.classList.remove('input-error'); // Clear previous error
            rateInput.title = ''; // Clear tooltip
            if (minRate >= 0 && rateValue < minRate && Math.abs(rateValue - minRate) > 0.001) {
                rateInput.classList.add('input-error');
                rateInput.title = `Rate ${formatCurrency(rateValue)} is below Minimum ${formatCurrency(minRate)}`;
            }
            // --- End Rate validation ---

            if (unitTypeSelect?.value === 'Sq Feet') {
                const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
                const widthInput = row.querySelector('.width-input');
                const heightInput = row.querySelector('.height-input');
                const unit = dimensionUnitSelect?.value || 'feet';
                const width = parseFloat(widthInput?.value || 0);
                const height = parseFloat(heightInput?.value || 0);

                if (width > 0 && height > 0 && !isNaN(rateValue) && rateValue >= 0) {
                    const calcResult = calculateFlexDimensions(unit, width, height);
                    // Use calculated printable square footage
                    calculatedAmount = parseFloat(calcResult.printSqFt || 0) * quantity * rateValue;
                }
            } else { // For 'Qty' or other unit types
                if (!isNaN(rateValue) && rateValue >= 0) {
                    calculatedAmount = quantity * rateValue;
                }
            }
        } catch (e) {
            console.error("Error calculating item amount:", e);
            calculatedAmount = 0; // Default to 0 on error
        }

        if (amountSpan) amountSpan.textContent = calculatedAmount.toFixed(2); // Update display
        updateOrderSummary(); // Recalculate overall summary
        updateCalculationPreview(); // Update the Sq Ft calculation preview box
    }

    // --- Calculation Preview Logic ---
    function updateCalculationPreview() {
        // ... (existing code - no changes needed here) ...
         if (!calculationPreviewArea || !calculationPreviewContent || !orderItemsTableBody) { return; }
         let entriesHTML = '';
         const itemRows = orderItemsTableBody.querySelectorAll('.item-row');
         let foundSqFt = false;
         itemRows.forEach((row, index) => {
             const unitTypeSelect = row.querySelector('.unit-type-select');
             if (unitTypeSelect?.value === 'Sq Feet') {
                 foundSqFt = true;
                 const productNameInput = row.querySelector('.product-name');
                 const productName = productNameInput?.value.trim() || `Item ${index + 1}`;
                 const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
                 const widthInput = row.querySelector('.width-input');
                 const heightInput = row.querySelector('.height-input');
                 const quantityInput = row.querySelector('.quantity-input');
                 const unit = dimensionUnitSelect?.value || 'feet';
                 const width = parseFloat(widthInput?.value || 0);
                 const height = parseFloat(heightInput?.value || 0);
                 let quantity = parseInt(quantityInput?.value || 1);
                 if (isNaN(quantity) || quantity < 1) quantity = 1;
                 let entryContent = `<div class="item-preview-entry"><strong>${productName}:</strong><br>`;
                 if (width > 0 && height > 0) {
                     const calcResult = calculateFlexDimensions(unit, width, height);
                     if (calcResult && parseFloat(calcResult.printSqFt) >= 0) {
                         const realSqFtNum = parseFloat(calcResult.realSqFt);
                         const printSqFtNum = parseFloat(calcResult.printSqFt);
                         const wastageSqFt = (printSqFtNum - realSqFtNum);
                         const tolerance = 0.01;
                         let wastageDesc = (wastageSqFt > tolerance) ? `<span style="color: orange;">Wastage: ${wastageSqFt.toFixed(2)} sq ft/item</span>` : `<span style="color: green;">Wastage: ${wastageSqFt.toFixed(2)} sq ft/item</span>`;
                         entryContent += `&nbsp; Qty: ${quantity}<br>`;
                         entryContent += `&nbsp; Real: ${calcResult.realWidthFt?.toFixed(2) ?? '?'}ft x ${calcResult.realHeightFt?.toFixed(2) ?? '?'}ft = ${realSqFtNum.toFixed(2)} sq ft/item<br>`;
                         entryContent += `&nbsp; Print: ${calcResult.printWidthFt.toFixed(2)}ft x ${calcResult.printHeightFt.toFixed(2)}ft = ${printSqFtNum.toFixed(2)} sq ft/item<br>`;
                         entryContent += `&nbsp; Total Print Area: ${(printSqFtNum * quantity).toFixed(2)} sq ft<br>`;
                         entryContent += `&nbsp; ${wastageDesc}`;
                     } else { entryContent += `&nbsp; <span style="color:orange;">Invalid dimensions or calculation error.</span>`; }
                 } else { entryContent += `&nbsp; <span style="color:grey;">Enter valid width & height for calculation.</span>`; }
                 entryContent += `</div>`; entriesHTML += entryContent;
             }
         });
         if (foundSqFt) { calculationPreviewContent.innerHTML = entriesHTML || '<p style="color:grey;">Enter dimensions for Sq Ft items.</p>'; calculationPreviewArea.style.display = 'block'; }
         else { calculationPreviewArea.style.display = 'none'; }
    }

    // --- Order Summary Calculation ---
    function updateOrderSummary() {
        // ... (existing code - no changes needed here) ...
        let subtotal = 0;
        if (orderItemsTableBody) {
            orderItemsTableBody.querySelectorAll('.item-row .item-amount').forEach(span => {
                subtotal += parseFloat(span.textContent || 0);
            });
        }

        let discountPercent = parseFloat(summaryDiscountPercentInput?.value || 0);
        let discountAmount = parseFloat(summaryDiscountAmountInput?.value || 0);
        let calculatedDiscountAmount = 0;

        const activeElement = document.activeElement;

        // Determine calculated discount based on which input was last touched (if not programmatic)
        if (!isDiscountInputProgrammaticChange) {
            if (activeElement === summaryDiscountPercentInput && !isNaN(discountPercent)) {
                calculatedDiscountAmount = subtotal * (discountPercent / 100);
                // Update the other input programmatically
                isDiscountInputProgrammaticChange = true;
                if(summaryDiscountAmountInput) summaryDiscountAmountInput.value = calculatedDiscountAmount.toFixed(2);
                isDiscountInputProgrammaticChange = false;
            } else if (activeElement === summaryDiscountAmountInput && !isNaN(discountAmount)) {
                calculatedDiscountAmount = discountAmount;
                 // Update the other input programmatically
                 if (subtotal > 0) {
                     const calculatedPercent = (calculatedDiscountAmount / subtotal) * 100;
                     isDiscountInputProgrammaticChange = true;
                     if(summaryDiscountPercentInput) summaryDiscountPercentInput.value = calculatedPercent.toFixed(2);
                     isDiscountInputProgrammaticChange = false;
                 } else {
                      isDiscountInputProgrammaticChange = true;
                      if(summaryDiscountPercentInput) summaryDiscountPercentInput.value = ''; // Avoid division by zero
                      isDiscountInputProgrammaticChange = false;
                 }
            } else { // Default calculation if neither is active or if one is invalid
                if (!isNaN(discountPercent) && discountPercent > 0) {
                     calculatedDiscountAmount = subtotal * (discountPercent / 100);
                } else if (!isNaN(discountAmount) && discountAmount > 0) {
                     calculatedDiscountAmount = discountAmount;
                } else {
                     calculatedDiscountAmount = 0; // No discount if inputs are invalid or zero
                }
            }
        } else { // If change was programmatic, recalculate based on primary input if needed
             if (!isNaN(discountPercent) && discountPercent > 0) {
                     calculatedDiscountAmount = subtotal * (discountPercent / 100);
                } else if (!isNaN(discountAmount) && discountAmount > 0) {
                     calculatedDiscountAmount = discountAmount;
                } else {
                     calculatedDiscountAmount = 0;
                }
        }


        // Ensure discount doesn't exceed subtotal
        calculatedDiscountAmount = Math.max(0, Math.min(calculatedDiscountAmount, subtotal));

        const finalAmount = subtotal - calculatedDiscountAmount;
        const advancePayment = parseFloat(summaryAdvancePaymentInput?.value || 0);
        const totalBalance = finalAmount - advancePayment;

        // Update UI
        if (summarySubtotalSpan) summarySubtotalSpan.textContent = subtotal.toFixed(2);
        if (summaryFinalAmountSpan) summaryFinalAmountSpan.textContent = finalAmount.toFixed(2);
        if (summaryTotalBalanceSpan) summaryTotalBalanceSpan.textContent = totalBalance.toFixed(2);

        // Check credit limit after summary updates
        checkCreditLimit();
    }

    function handleDiscountInput(event) {
        if (isDiscountInputProgrammaticChange) return; // Prevent loops

        const currentInput = event.target;
        isDiscountInputProgrammaticChange = true; // Set flag

        // Clear the *other* discount input when one is manually changed
        if (currentInput === summaryDiscountPercentInput) {
            if (summaryDiscountAmountInput) summaryDiscountAmountInput.value = '';
        } else if (currentInput === summaryDiscountAmountInput) {
            if (summaryDiscountPercentInput) summaryDiscountPercentInput.value = '';
        }

        isDiscountInputProgrammaticChange = false; // Reset flag
        updateOrderSummary(); // Recalculate everything
    }

    // --- Customer Autocomplete & Details ---
    async function getOrFetchCustomerCache() {
        if (customerCache.length > 0) return Promise.resolve(customerCache); // Return cached data if available
        if (customerFetchPromise) return customerFetchPromise; // Return existing promise if fetch is in progress

        console.log("Fetching customers for cache...");
        try {
            if (!db || !collection || !query || !getDocs || !orderBy) throw new Error("DB function missing for customer cache.");

            const q = query(collection(db, "customers"), orderBy("fullName")); // Order by name for suggestions
            customerFetchPromise = getDocs(q).then(snapshot => {
                customerCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                console.log(`Cached ${customerCache.length} customers.`);
                customerFetchPromise = null; // Clear promise holder
                return customerCache; // Return data
            }).catch(e => {
                console.error("Error fetching customer cache:", e);
                customerFetchPromise = null; // Clear promise holder on error
                throw e; // Re-throw error
            });
            return customerFetchPromise;
        } catch (e) {
            console.error("Error setting up customer cache fetch:", e);
            customerFetchPromise = null;
            return Promise.reject(e);
        }
    }

    function handleCustomerInput(event, type) {
        const inputElement = event.target;
        const searchTerm = inputElement.value.trim();
        const suggestionsBox = (type === 'name') ? customerSuggestionsNameBox : customerSuggestionsWhatsAppBox;
        if (!suggestionsBox) return;

        // Clear selection and details if input is cleared
        if (searchTerm.length < 1) {
            clearTimeout(customerSearchDebounceTimer);
            hideSuggestionBox(suggestionsBox);
            if (selectedCustomerId) { // Only reset if a customer was previously selected
                 resetCustomerSelectionUI(false); // Keep inputs, clear balance/link
            }
            return;
        }

        // Debounce search
        clearTimeout(customerSearchDebounceTimer);
        customerSearchDebounceTimer = setTimeout(() => {
            getOrFetchCustomerCache()
                .then(cache => filterAndRenderCustomerSuggestions(searchTerm, type, suggestionsBox, inputElement, cache))
                .catch(e => console.error("Failed to get customer cache for suggestions:", e));
        }, 300); // 300ms delay
    }

    function filterAndRenderCustomerSuggestions(term, type, box, inputElement, cache) {
        const lowerTerm = term.toLowerCase();
        const filterField = (type === 'name') ? 'fullName' : 'whatsappNo';
        const filtered = cache.filter(customer =>
            String(customer[filterField] || '').toLowerCase().includes(lowerTerm)
        ).slice(0, 10); // Limit suggestions

        renderCustomerSuggestions(filtered, term, box, inputElement);
    }

    function renderCustomerSuggestions(suggestions, term, box, inputElement) {
        if (!box) return;
        const ul = box.querySelector('ul') || document.createElement('ul');
        ul.innerHTML = ''; // Clear previous suggestions

        if (suggestions.length === 0) {
            ul.innerHTML = '<li class="no-suggestions">No matching customers found.</li>';
        } else {
            suggestions.forEach(c => {
                const li = document.createElement('li');
                const displayName = `${c.fullName} (${c.whatsappNo})`;
                try {
                    // Highlight the search term
                    li.innerHTML = displayName.replace(new RegExp(`(${term.replace(/[-\/\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'), '<strong>$1</strong>');
                } catch { li.textContent = displayName; } // Fallback if regex fails

                // Store customer data in dataset attributes
                li.dataset.customerId = c.id;
                li.dataset.customerName = c.fullName || '';
                li.dataset.customerWhatsapp = c.whatsappNo || '';
                li.dataset.customerAddress = c.billingAddress || c.address || '';
                li.dataset.customerContact = c.contactNo || '';
                ul.appendChild(li);
            });
        }

        if (!box.contains(ul)) box.appendChild(ul);
        box.classList.add('active');
        box.style.display = 'block'; // Make sure it's visible

        // Position suggestions box below the input
        const inputRect = inputElement.getBoundingClientRect();
        box.style.position = 'absolute'; // Ensure absolute positioning
        box.style.left = '0'; // Align with left of parent (.form-group)
        box.style.top = `${inputRect.height}px`; // Position below input
        box.style.width = `${inputRect.width}px`; // Match input width
        box.style.zIndex = '1000';

        // Add click listener (remove previous if any to avoid duplicates)
        box.removeEventListener('click', handleSuggestionClick);
        box.addEventListener('click', handleSuggestionClick);
    }

    function fillCustomerData(customerData) {
        // Fills form fields when a suggestion is clicked
        if (!customerData || !customerData.customerId) {
            console.warn("fillCustomerData called with invalid data or missing customerId.");
            resetCustomerSelectionUI(true); // Reset everything if data is bad
            return;
        }
        console.log("Filling customer data for ID:", customerData.customerId);
        customerNameInput.value = customerData.customerName || '';
        customerWhatsAppInput.value = customerData.customerWhatsapp || '';
        customerAddressInput.value = customerData.customerAddress || '';
        customerContactInput.value = customerData.customerContact || '';
        selectedCustomerId = customerData.customerId;
        if (selectedCustomerIdInput) {
            selectedCustomerIdInput.value = selectedCustomerId;
        } else { console.error("Hidden input selectedCustomerId not found!"); }

        // Fetch full details including balance and credit info
        fetchAndDisplayCustomerDetails(selectedCustomerId).catch(e => {
            console.error("Error during fetchAndDisplayCustomerDetails after fill:", e);
            showFormError("Could not load customer balance details.");
        });
    }

    // --- MODIFIED for Balance Display Logic ---
    async function fetchAndDisplayCustomerDetails(customerId) {
        if (!customerId) {
            console.warn("fetchAndDisplayCustomerDetails called without customerId.");
            resetCustomerSelectionUI(true);
            return;
        }
        console.log(`Workspaceing details and balance for customer: ${customerId}`);
        resetCustomerSelectionUI(false); // Clear balance/link but keep inputs

        try {
            // Find customer in cache or fetch from DB
            let customer = customerCache.find(cust => cust.id === customerId);
            if (!customer) {
                console.log(`Customer ${customerId} not in cache, fetching from DB...`);
                if (!db || !doc || !getDoc) throw new Error("DB functions missing.");
                const customerDoc = await getDoc(doc(db, "customers", customerId));
                if (customerDoc.exists()) {
                    customer = { id: customerDoc.id, ...customerDoc.data() };
                    // Optional: Add to cache? Be careful about stale data if not using listeners here.
                } else {
                    console.warn("Customer not found in DB:", customerId);
                    showFormError(`Selected customer (ID: ${customerId.substring(0,6)}...) not found. Please check or add as new.`);
                    resetCustomerSelectionUI(true); // Reset all fields
                    return;
                }
            }
            selectedCustomerData = customer; // Store full data globally

            // Update inputs only if they are empty (in case user typed something)
            if (!customerNameInput.value && customer.fullName) customerNameInput.value = customer.fullName;
            if (!customerWhatsAppInput.value && customer.whatsappNo) customerWhatsAppInput.value = customer.whatsappNo;
            if (!customerAddressInput.value && (customer.billingAddress || customer.address)) customerAddressInput.value = customer.billingAddress || customer.address;
            if (!customerContactInput.value && customer.contactNo) customerContactInput.value = customer.contactNo;

            // Show Account Link
            if(viewCustomerAccountLink && customerAccountLinkArea){
                viewCustomerAccountLink.href = `customer_account_detail.html?id=${encodeURIComponent(customerId)}`;
                customerAccountLinkArea.style.display = 'block';
            }

            // Calculate and Display Balance
            let balanceText = 'Calculating...';
            let balanceNum = NaN;
            customerCurrentBalanceSpan.textContent = balanceText;
            customerCurrentBalanceSpan.className = ''; // Clear classes
            if(customerBalanceArea) customerBalanceArea.style.display = 'block';

            try {
                // Fetch totals (ensure helper functions exist and handle errors)
                const totalOrderValue = await loadOrderTotals_NewOrder(customerId);
                const totalPaidAmount = await loadPaymentTotals_NewOrder(customerId);
                // NOTE: Adjustments are NOT included here for simplicity on New Order page.
                // Detail page shows fully adjusted balance.

                if (typeof totalOrderValue === 'number' && typeof totalPaidAmount === 'number') {
                    balanceNum = totalOrderValue - totalPaidAmount; // Positive = Due, Negative = Credit

                    // Apply the new display logic
                    const tolerance = 0.005;
                    if (balanceNum > tolerance) { // Due
                        balanceText = "-" + formatCurrency(balanceNum); // Negative sign
                        customerCurrentBalanceSpan.classList.add('negative-balance'); // Red color class
                    } else if (balanceNum < -tolerance) { // Credit
                        balanceText = formatCurrency(Math.abs(balanceNum)); // Positive value
                        // balanceText = "+" + formatCurrency(Math.abs(balanceNum)); // Optional + sign
                        customerCurrentBalanceSpan.classList.add('positive-balance'); // Green color class
                    } else { // Zero
                        balanceText = formatCurrency(0);
                    }
                } else {
                    balanceText = 'Error'; // If totals couldn't be fetched
                }
            } catch (calcError) {
                console.error("Error calculating balance:", calcError);
                balanceText = 'Error';
            }

            customerCurrentBalanceSpan.textContent = balanceText; // Update displayed text
            customerCurrentBalanceSpan.title = `Calculated Balance: ${balanceText}`; // Tooltip

            checkCreditLimit(balanceNum); // Check credit limit based on calculated balance

        } catch (e) {
            console.error("Error in fetchAndDisplayCustomerDetails:", e);
            resetCustomerSelectionUI(true); // Reset everything on error
        }
    }

    function resetCustomerSelectionUI(clearInputs = true) {
        selectedCustomerId = null; // Clear selected ID
        selectedCustomerData = null; // Clear selected data
        if (selectedCustomerIdInput) selectedCustomerIdInput.value = ''; // Clear hidden input
        if(customerAccountLinkArea) customerAccountLinkArea.style.display = 'none'; // Hide link
        if(customerBalanceArea) customerBalanceArea.style.display = 'none'; // Hide balance
        if(customerCurrentBalanceSpan) {
            customerCurrentBalanceSpan.textContent = '';
            customerCurrentBalanceSpan.className = ''; // Clear color classes
        }
        if(creditLimitWarningDiv) creditLimitWarningDiv.style.display = 'none'; // Hide warning
        if (clearInputs) { // Optionally clear visible input fields
            if(customerNameInput) customerNameInput.value = '';
            if(customerWhatsAppInput) customerWhatsAppInput.value = '';
            if(customerAddressInput) customerAddressInput.value = '';
            if(customerContactInput) customerContactInput.value = '';
        }
    }

    // --- Credit Limit Check ---
    function checkCreditLimit(currentBalanceNum = NaN) {
        // ... (existing code - relies on selectedCustomerData) ...
         if (!selectedCustomerData || !selectedCustomerData.creditAllowed) {
             if(creditLimitWarningDiv) creditLimitWarningDiv.style.display = 'none';
             return;
         }
         const creditLimit = parseFloat(selectedCustomerData.creditLimit || 0);

         // Get the currently calculated final amount of the *new* order being created
         const finalAmountText = summaryFinalAmountSpan?.textContent || '0';
         // Extract number from formatted currency string
         const newOrderValue = parseFloat(finalAmountText.replace(/[^0-9.-]+/g,"")) || 0;

         // Only show warning if we have valid numbers
         if (isNaN(currentBalanceNum) || isNaN(newOrderValue) || creditLimit <= 0) {
             if(creditLimitWarningDiv) creditLimitWarningDiv.style.display = 'none';
             return;
         }

         // Calculate potential balance: Current Due Balance + New Order Value
         // Remember: currentBalanceNum > 0 means Due
         const potentialBalance = currentBalanceNum + newOrderValue;

         if (potentialBalance > creditLimit) {
             if(creditLimitWarningDiv) {
                 creditLimitWarningDiv.textContent = `Warning: Potential balance (${formatCurrency(potentialBalance)} Dr.) exceeds credit limit of ${formatCurrency(creditLimit)}.`;
                 creditLimitWarningDiv.style.display = 'block';
             }
         } else {
              if(creditLimitWarningDiv) creditLimitWarningDiv.style.display = 'none';
         }
    }

    // --- Product Autocomplete ---
    function getOrCreateProductSuggestionsDiv() {
        if (!productSuggestionsDiv) {
            productSuggestionsDiv = document.createElement('div');
            productSuggestionsDiv.className = 'product-suggestions-list'; // Use specific class
            productSuggestionsDiv.style.display = 'none';
            document.body.appendChild(productSuggestionsDiv); // Append to body to overlay other elements
            // Add event listener to the container for delegation
            productSuggestionsDiv.addEventListener('click', handleSuggestionClick);
        }
        return productSuggestionsDiv;
    }

    function positionProductSuggestions(inputElement) {
        const suggestionsContainer = getOrCreateProductSuggestionsDiv();
        const inputRect = inputElement.getBoundingClientRect();
        // Position relative to viewport, accounting for scroll
        suggestionsContainer.style.position = 'absolute';
        suggestionsContainer.style.left = `${inputRect.left + window.scrollX}px`;
        suggestionsContainer.style.top = `${inputRect.bottom + window.scrollY}px`;
        suggestionsContainer.style.width = `${inputRect.width < 250 ? 250 : inputRect.width}px`; // Minimum width
        suggestionsContainer.style.display = 'block'; // Make visible
        suggestionsContainer.style.zIndex = '1050'; // Ensure it's above other elements
    }

    function hideProductSuggestions() {
        if (productSuggestionsDiv) productSuggestionsDiv.style.display = 'none';
        activeProductInput = null; // Clear active input tracker
    }

    function handleProductSearchInput(event) {
        const inputElement = event.target;
        if (!inputElement.matches('.product-name')) return; // Only for product name inputs
        activeProductInput = inputElement; // Track the currently focused input
        clearTimeout(productSearchDebounceTimer);
        const searchTerm = inputElement.value.trim();

        if (searchTerm.length < 1) { // Hide if input is empty
            hideProductSuggestions();
            return;
        }

        positionProductSuggestions(inputElement); // Position first

        // Debounce the actual fetching/filtering
        productSearchDebounceTimer = setTimeout(() => {
            // Check if the input still has focus and is the active one
            if (document.activeElement === inputElement && activeProductInput === inputElement) {
                getOrFetchProductCache()
                    .then(cache => filterAndRenderProductSuggestions(searchTerm, inputElement, cache))
                    .catch(e => console.error("Product suggestion fetch/filter error:", e));
            } else {
                 hideProductSuggestions(); // Hide if focus moved away during debounce
            }
        }, 350); // 350ms delay
    }

    async function getOrFetchProductCache() {
        if (productCache.length > 0) return Promise.resolve(productCache);
        if (productFetchPromise) return productFetchPromise;

        console.log("Fetching products for cache...");
        try {
             if (!db || !collection || !query || !getDocs || !orderBy) throw new Error("DB function missing for product cache.");
            const q = query(collection(db, "products"), orderBy("printName")); // Order products alphabetically
            productFetchPromise = getDocs(q).then(snapshot => {
                productCache = snapshot.docs.map(d => {
                    const data = d.data();
                    // Ensure essential fields are mapped
                    return {
                        id: d.id,
                        name: data.printName || data.name || 'Unknown Product', // Use printName first
                        unit: data.unit || 'Qty', // Default unit
                        salePrice: data.salePrice, // May be undefined
                        minSalePrice: data.minSalePrice // May be undefined
                    };
                });
                console.log(`Cached ${productCache.length} products.`);
                productFetchPromise = null; // Clear promise holder
                return productCache;
            }).catch(e => {
                console.error("Error fetching product cache:", e);
                productFetchPromise = null;
                throw e;
            });
            return productFetchPromise;
        } catch (e) {
            console.error("Error setting up product cache fetch:", e);
            productFetchPromise = null;
            return Promise.reject(e);
        }
    }

    function filterAndRenderProductSuggestions(term, inputElement, cache) {
        const suggestionsContainer = getOrCreateProductSuggestionsDiv();
        suggestionsContainer.innerHTML = '<ul><li class="no-suggestions">Loading...</li></ul>'; // Show loading state

        // Double check if still the active input after async fetch might have happened
        if (activeProductInput !== inputElement) {
             hideProductSuggestions();
             return;
         }

        positionProductSuggestions(inputElement); // Reposition just in case

        const lowerTerm = term.toLowerCase();
        const filtered = cache.filter(p =>
            p.name?.toLowerCase().includes(lowerTerm)
        ).slice(0, 10); // Limit results

        renderProductSuggestions(filtered, term, suggestionsContainer);
    }

    function renderProductSuggestions(suggestions, term, suggestionsContainer) {
        if (!suggestionsContainer) return;
        const ul = document.createElement('ul');
        if (suggestions.length === 0) {
            ul.innerHTML = '<li class="no-suggestions">No matching products found.</li>';
        } else {
            suggestions.forEach(p => {
                const li = document.createElement('li');
                try {
                     // Highlight the search term
                     li.innerHTML = p.name.replace(new RegExp(`(${term.replace(/[-\/\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'), '<strong>$1</strong>');
                } catch { li.textContent = p.name; } // Fallback

                // Store product data as JSON string in dataset attribute
                li.dataset.product = JSON.stringify(p);
                ul.appendChild(li);
            });
        }
        suggestionsContainer.innerHTML = ''; // Clear previous content (like "Loading...")
        suggestionsContainer.appendChild(ul);
        suggestionsContainer.style.display = 'block'; // Ensure visibility
    }

    function selectProductSuggestion(productData, inputElement) {
        try {
            const row = inputElement.closest('.item-row');
            if (!row || !productData || !productData.id) {
                console.error("Row or productData or productData.id missing in selectProductSuggestion");
                hideProductSuggestions(); return;
            }

            row.dataset.productId = productData.id; // Store Firestore product ID on the row

            // Find elements within the row
            const productNameInput = row.querySelector('.product-name');
            const unitTypeSelect = row.querySelector('.unit-type-select');
            const rateInput = row.querySelector('.rate-input');
            const quantityInput = row.querySelector('.quantity-input');
            // Description input is NOT auto-filled from product data usually
            // const descriptionInput = row.querySelector('.item-description-input');

            if (!productNameInput || !unitTypeSelect || !rateInput || !quantityInput) {
                console.error("Error in selectProductSuggestion: Row elements missing!");
                hideProductSuggestions(); return;
            }

            // Populate fields
            productNameInput.value = productData.name || '';
            rateInput.value = productData.salePrice !== undefined ? String(productData.salePrice) : '';
            const minRate = productData.minSalePrice;
            rateInput.dataset.minRate = minRate !== undefined && minRate !== null ? String(minRate) : '-1'; // Set min rate

            // Determine default unit type based on product data unit field
            let defaultUnitType = 'Qty';
            if (productData.unit) {
                const unitLower = String(productData.unit).toLowerCase();
                if (unitLower.includes('sq') || unitLower.includes('ft') || unitLower.includes('feet')) {
                    defaultUnitType = 'Sq Feet';
                }
                // Add more conditions for other unit types if needed
            }
            unitTypeSelect.value = defaultUnitType;

            hideProductSuggestions(); // Hide the suggestions list

            // Manually trigger change event for unit type to update UI (show/hide sq ft inputs)
            const changeEvent = new Event('change', { bubbles: true });
            unitTypeSelect.dispatchEvent(changeEvent);

            updateItemAmount(row); // Recalculate amount based on new rate/unit

            // Focus management: move to the next logical input
            let nextInput = null;
            if (defaultUnitType === 'Sq Feet') {
                nextInput = row.querySelector('.width-input'); // Focus width first for Sq Ft
            }
            if (!nextInput) {
                nextInput = quantityInput; // Otherwise focus quantity
            }

            if (nextInput) {
                 nextInput.focus();
                 if (typeof nextInput.select === 'function') {
                    nextInput.select(); // Select content if possible
                 }
            } else {
                rateInput.focus(); // Fallback to rate input
            }

        } catch (error) {
            console.error("Error inside selectProductSuggestion:", error);
            hideProductSuggestions();
        }
    }


    // --- Status Dropdown Handling ---
    function updateStatusDropdownColor(statusValue) {
        if (!orderStatusSelect) return;
        // Remove all existing status classes
        statusList.forEach(status => {
            const className = `status-select-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            orderStatusSelect.classList.remove(className);
        });
        orderStatusSelect.classList.remove('status-select-default');

        // Add the appropriate class for the selected status
        if (statusValue) {
            const currentClassName = `status-select-${statusValue.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            orderStatusSelect.classList.add(currentClassName);
        } else {
            orderStatusSelect.classList.add('status-select-default'); // Default style if no value
        }
    }

    // --- Get Next ID with Prefix Function ---
    async function getNextIdWithPrefix(counterName, prefix = '', startId = 101) {
        // Ensure needed functions are available
        if (!db || !doc || !runTransaction) throw new Error("Firestore functions (db, doc, runTransaction) not available for counter.");

        const counterRef = doc(db, "counters", counterName); // Document reference for the counter

        try {
            const nextIdNum = await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef); // Get counter doc inside transaction
                let nextId = startId; // Default if counter doesn't exist

                if (counterDoc.exists() && counterDoc.data().lastId) {
                    const lastId = Number(counterDoc.data().lastId);
                    if (!isNaN(lastId)) {
                        nextId = lastId + 1; // Increment
                    } else {
                        console.warn(`Counter '${counterName}' lastId is not a number (${counterDoc.data().lastId}). Resetting to startId.`);
                        nextId = startId;
                    }
                } else {
                    console.log(`Counter '${counterName}' not found or lastId missing, starting at ${startId}.`);
                }

                // Update the counter within the transaction
                transaction.set(counterRef, { lastId: nextId }, { merge: true });
                return nextId; // Return the generated number
            });

            // Return the number with prefix (or just number if no prefix)
            return prefix ? `${prefix}${nextIdNum}` : nextIdNum;

        } catch (error) {
            console.error(`Error getting next ID for ${counterName}:`, error);
            // Provide a more specific error message to the user/caller
            throw new Error(`Failed to generate ID for ${counterName}. Error: ${error.message}`);
        }
    }

    // --- Form Submission (MODIFIED to include description) ---
    async function handleFormSubmit(event) {
        event.preventDefault();
        console.log("Submit initiated (V1.2)...");
        showFormError(''); // Clear previous errors

        // Check required functions
        if (!db || !addDoc || !doc || !updateDoc || !Timestamp || !getDoc || !getDocs || !collection || !query || !limit || typeof window.serverTimestamp !== 'function' || typeof window.arrayUnion !== 'function') {
             showFormError("Database functions unavailable."); console.error("Missing Firestore functions..."); return;
        }
        if (!saveButton) { console.error("Save button element missing!"); return; }

        // Disable button, show loading
        saveButton.disabled = true;
        const originalButtonText = saveButtonText ? saveButtonText.textContent : (isEditMode ? 'Update Order' : 'Save Order');
        const originalButtonHTML = saveButton.innerHTML;
        if (saveButtonText) saveButtonText.textContent = isEditMode ? 'Updating...' : 'Saving...';
        else saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            // --- 1. Gather Customer Data ---
            const customerFullName = customerNameInput.value.trim();
            const customerWhatsapp = customerWhatsAppInput.value.trim();
            let customerId = selectedCustomerId; // Use ID selected via autocomplete/URL param

            if (!customerFullName) throw new Error("Customer Name is required.");
            if (!customerWhatsapp) throw new Error("WhatsApp No is required.");
            // Use selectedCustomerId if available, otherwise check hidden input (less reliable)
            if (!customerId) { customerId = selectedCustomerIdInput?.value || null; }
            if (!customerId) {
                 // This should ideally not happen if suggestion/URL param used correctly
                 throw new Error("Customer is not selected or linked properly. Please re-select from suggestions.");
            }
            console.log('Proceeding to save order with customerId:', customerId);

            // Customer details snapshot to save with the order
            const customerDetailsSnapshot = {
                 fullName: customerFullName,
                 whatsappNo: customerWhatsapp,
                 address: customerAddressInput.value.trim() || '', // Save current address input
                 contactNo: customerContactInput.value.trim() || '' // Save current contact input
            };

            // --- 2. Gather Order Data ---
            const orderDateValue = orderDateInput.value;
            const deliveryDateValue = deliveryDateInput.value || '';
            const urgentValue = orderForm.querySelector('input[name="urgent"]:checked')?.value || 'No';
            const remarksValue = remarksInput.value.trim() || '';
            const statusValue = orderStatusSelect.value;

            if (!orderDateValue) throw new Error("Order Date is required.");

            // --- 3. Determine Order ID ---
            let orderId;
            const manualOrderIdValue = manualOrderIdInput.value.trim();
            const existingDisplayId = displayOrderIdInput.value;

            if (isEditMode) {
                // Use existing order ID from loaded data or fallback to URL param ID
                orderId = currentOrderData?.orderId || existingDisplayId || orderIdToEdit;
                if (!orderId) throw new Error("Internal Error: Missing Order ID for update.");
                console.log(`Using existing Order ID for update: ${orderId}`);
            } else if (manualOrderIdValue) {
                // Use manually entered ID
                orderId = manualOrderIdValue;
                console.log(`Using provided Manual Order ID: ${orderId}`);
                if(displayOrderIdInput) displayOrderIdInput.value = orderId; // Update display field
            } else {
                // Generate automatic ID if no manual ID provided in add mode
                try {
                    orderId = await getNextIdWithPrefix("orderCounter", "MM-", 1001); // Use prefix MM-
                    console.log(`Generated automatic Order ID for manual order: ${orderId}`);
                    if(displayOrderIdInput) displayOrderIdInput.value = orderId; // Update display field
                } catch (idError) {
                    console.error("Error generating Order ID:", idError);
                    showFormError(`Failed to generate automatic Order ID: ${idError.message}`);
                    throw idError; // Let outer catch handle button reset
                }
            }

            // --- 4. Gather and Validate Item Data (including description) ---
            const items = [];
            const itemRows = orderItemsTableBody.querySelectorAll('.item-row');
            if (itemRows.length === 0) throw new Error("Please add at least one item to the order.");

            let allItemsValid = true; // Flag to track validation
            itemRows.forEach((row, index) => {
                if (!allItemsValid) return; // Stop processing if an error was found

                const productNameInput = row.querySelector('.product-name');
                const descriptionInput = row.querySelector('.item-description-input'); // <<< Get description input
                const unitTypeSelect = row.querySelector('.unit-type-select');
                const quantityInput = row.querySelector('.quantity-input');
                const rateInput = row.querySelector('.rate-input');
                const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
                const widthInput = row.querySelector('.width-input');
                const heightInput = row.querySelector('.height-input');

                const productId = row.dataset.productId || null; // Get stored product ID
                const productName = productNameInput?.value.trim();
                const itemDescription = descriptionInput?.value.trim() || null; // <<< Get description value
                const unitType = unitTypeSelect?.value;
                const quantity = parseInt(quantityInput?.value || 0);
                const rate = parseFloat(rateInput?.value || '');
                const minRate = parseFloat(rateInput?.dataset.minRate || -1);

                // --- Validation ---
                if (!productName) { allItemsValid = false; showFormError(`Item ${index + 1}: Product Name is required.`); productNameInput?.focus(); return; }
                if (!unitType) { allItemsValid = false; showFormError(`Item ${index + 1}: Unit Type is required.`); unitTypeSelect?.focus(); return; }
                if (isNaN(quantity) || quantity <= 0) { allItemsValid = false; showFormError(`Item ${index + 1}: Valid Quantity (1 or more) is required.`); quantityInput?.focus(); return; }
                if (isNaN(rate) || rate < 0) { allItemsValid = false; showFormError(`Item ${index + 1}: Valid Rate (0 or more) is required.`); rateInput?.focus(); return; }
                // Check against min rate
                if (minRate >= 0 && rate < minRate && Math.abs(rate - minRate) > 0.001) {
                    allItemsValid = false;
                    showFormError(`Item ${index + 1}: Rate ${formatCurrency(rate)} is below Minimum Sale Price (${formatCurrency(minRate)}).`);
                    rateInput?.focus(); return;
                }
                // --- End Validation ---

                // Build item data object
                const itemData = {
                    productId: productId,
                    productName: productName,
                    itemDescription: itemDescription, // <<< Save description
                    unitType: unitType,
                    quantity: quantity,
                    rate: rate,
                    minSalePrice: minRate >= 0 ? minRate : null // Store min rate if available
                };

                // Add dimension data if unit type is Sq Feet
                if (unitType === 'Sq Feet') {
                    const dimensionUnit = dimensionUnitSelect?.value || 'feet';
                    const width = parseFloat(widthInput?.value || 0);
                    const height = parseFloat(heightInput?.value || 0);
                    // Validate dimensions
                    if (isNaN(width) || width <= 0) { allItemsValid = false; showFormError(`Item ${index + 1}: Valid Width is required for Sq Feet.`); widthInput?.focus(); return; }
                    if (isNaN(height) || height <= 0) { allItemsValid = false; showFormError(`Item ${index + 1}: Valid Height is required for Sq Feet.`); heightInput?.focus(); return; }

                    const calcResult = calculateFlexDimensions(dimensionUnit, width, height);
                    itemData.dimensionUnit = dimensionUnit;
                    itemData.width = width;
                    itemData.height = height;
                    itemData.realSqFt = calcResult.realSqFt;
                    itemData.printSqFt = calcResult.printSqFt;
                    // Calculate item amount based on printSqFt
                    itemData.itemAmount = parseFloat((parseFloat(calcResult.printSqFt || 0) * quantity * rate).toFixed(2));
                } else {
                    // Calculate item amount based on quantity and rate
                    itemData.itemAmount = parseFloat((quantity * rate).toFixed(2));
                }
                items.push(itemData); // Add valid item to the array
            }); // End itemRows.forEach

            if (!allItemsValid) {
                throw new Error("Please fix the errors in the order items."); // Stop submission if any item is invalid
            }

            // --- 5. Calculate Summary ---
            let subTotal = 0; items.forEach(i => { subTotal += (i.itemAmount || 0); });
            let discountPercentValue = parseFloat(summaryDiscountPercentInput?.value || 0);
            let discountAmountValue = parseFloat(summaryDiscountAmountInput?.value || 0);
            let finalDiscountAmount = 0;

            // Prioritize amount if both are entered, otherwise use percent
            if (!isNaN(discountAmountValue) && discountAmountValue > 0) {
                finalDiscountAmount = discountAmountValue;
                // Recalculate percent based on final amount and subtotal
                if (subTotal > 0) discountPercentValue = parseFloat(((finalDiscountAmount / subTotal) * 100).toFixed(2));
                else discountPercentValue = 0;
            } else if (!isNaN(discountPercentValue) && discountPercentValue > 0) {
                finalDiscountAmount = parseFloat((subTotal * (discountPercentValue / 100)).toFixed(2));
            }
            // Ensure discount is valid
            finalDiscountAmount = Math.max(0, Math.min(finalDiscountAmount, subTotal));

            let finalTotalAmount = parseFloat((subTotal - finalDiscountAmount).toFixed(2));
            let advancePaymentAmount = parseFloat(summaryAdvancePaymentInput?.value || 0);

            // --- 6. Prepare Firestore Payload ---
            const orderPayload = {
                orderId: orderId, // Generated or manual ID
                customerId: customerId,
                customerDetails: customerDetailsSnapshot, // Snapshot of customer details at time of order
                orderDate: Timestamp.fromDate(new Date(orderDateValue + 'T00:00:00')), // Store as Timestamp
                deliveryDate: deliveryDateValue ? Timestamp.fromDate(new Date(deliveryDateValue + 'T00:00:00')) : null, // Store as Timestamp or null
                urgent: urgentValue,
                remarks: remarksValue,
                status: statusValue,
                items: items, // Array of item objects (includes description)
                subTotal: subTotal,
                discountPercentage: discountPercentValue || 0, // Store calculated percentage
                discountAmount: finalDiscountAmount,
                totalAmount: finalTotalAmount, // Store final calculated amount
                finalAmount: finalTotalAmount, // Duplicate field for potential compatibility
                updatedAt: serverTimestamp(), // Timestamp for last update
                // Add orderSource field
                orderSource: isEditMode ? (currentOrderData?.orderSource || 'Manual') : 'Manual' // Preserve source on edit, set Manual for new
            };

            // --- 7. Save to Firestore ---
            let savedFirestoreId; // To store the document ID
            let successMessage;

            if (isEditMode) {
                if (!orderIdToEdit) throw new Error("Internal Error: Missing Firestore Document ID for update.");
                // Don't overwrite createdAt on edit
                delete orderPayload.createdAt;
                // Add status change to history only if status actually changed
                if (currentOrderData && statusValue !== currentOrderData.status) {
                    const historyEntry = { status: statusValue, timestamp: serverTimestamp() };
                    orderPayload.statusHistory = arrayUnion(historyEntry); // Add to existing history array
                } else {
                    delete orderPayload.statusHistory; // Don't update history if status is same
                }
                // Perform Update
                await updateDoc(doc(db, "orders", orderIdToEdit), orderPayload);
                savedFirestoreId = orderIdToEdit; // Use the existing Firestore ID
                successMessage = `Order ${orderId} updated successfully!`;
            } else {
                // Add creation timestamp and initial status history for new orders
                orderPayload.createdAt = serverTimestamp();
                orderPayload.statusHistory = [{ status: statusValue, timestamp: Timestamp.now() }]; // Initial history entry
                // Perform Add
                const orderDocRef = await addDoc(collection(db, "orders"), orderPayload);
                savedFirestoreId = orderDocRef.id; // Get the new Firestore ID
                successMessage = `Order ${orderId} created successfully!`;
                // Update display ID field if it was auto-generated
                 if(!manualOrderIdValue && displayOrderIdInput) displayOrderIdInput.value = orderId;
            }
            console.log(successMessage, "Firestore Doc ID:", savedFirestoreId);

            // --- 8. Handle Advance Payment (Only for NEW orders) ---
            if (!isEditMode && advancePaymentAmount > 0) {
                console.log(`Advance payment amount entered: ${advancePaymentAmount}. Creating payment record...`);
                try {
                    const paymentData = {
                        customerId: customerId,
                        orderRefId: savedFirestoreId, // Link payment to the Firestore order doc ID
                        orderId: orderId, // Store the display order ID as well
                        amountPaid: advancePaymentAmount,
                        paymentDate: orderPayload.orderDate, // Use order date for advance payment timestamp? Or serverTimestamp()? Using orderDate for now.
                        paymentMethod: "Order Advance",
                        notes: `Advance payment for Order #${orderId}`,
                        createdAt: serverTimestamp() // Record creation time
                    };
                    const paymentDocRef = await addDoc(collection(db, "payments"), paymentData);
                    console.log(`Advance payment record added successfully. Payment Doc ID: ${paymentDocRef.id}`);
                } catch (paymentError) {
                    console.error("Error saving advance payment record:", paymentError);
                    // Alert user that order saved but payment failed
                    alert(`${successMessage}\n\nHowever, there was an error recording the advance payment: ${paymentError.message}\nPlease add the payment manually later.`);
                    // Continue with showing WhatsApp reminder or redirecting
                }
            }

            // --- 9. Show Success / WhatsApp Reminder ---
            if (!isEditMode || (isEditMode && !paymentError)) { // Show standard success message if no payment error occurred
                 alert(successMessage);
            }

            if (customerDetailsSnapshot.whatsappNo) {
                showWhatsAppReminder(customerDetailsSnapshot, orderId, deliveryDateValue); // Show popup
            } else {
                // If no WhatsApp, redirect immediately
                if (!isEditMode) {
                     resetNewOrderForm(); // Reset form for next new order
                 } else {
                     // Redirect back to history after edit, potentially highlighting the edited order
                    window.location.href = `order_history.html?highlightOrderId=${orderIdToEdit || ''}`;
                 }
            }

        } catch (error) {
            console.error("Form submission failed:", error);
            showFormError("Error saving order: " + error.message);
        } finally {
            // Re-enable save button and restore text
            saveButton.disabled = false;
            if (saveButtonText) saveButtonText.textContent = originalButtonText;
            else saveButton.innerHTML = originalButtonHTML;
        }
    }
    // ==================================================================================
    // ===            End of MODIFIED handleFormSubmit Function                      ===
    // ==================================================================================


    // --- Reset Form ---
    function resetNewOrderForm() {
        console.log("Resetting form for new order.");
        orderForm.reset(); // Reset all form fields
        if (orderItemsTableBody) orderItemsTableBody.innerHTML = ''; // Clear item table
        selectedCustomerId = null;
        selectedCustomerData = null;
        currentOrderData = null;
        isEditMode = false;
        orderIdToEdit = null;
        if (hiddenEditOrderIdInput) hiddenEditOrderIdInput.value = '';
        if (selectedCustomerIdInput) selectedCustomerIdInput.value = '';
        if (displayOrderIdInput) displayOrderIdInput.value = ''; // Clear display ID
        if (manualOrderIdInput) manualOrderIdInput.value = ''; // Clear manual ID
        // Reset header/breadcrumb text
        if (headerText) headerText.textContent = "New Order";
        if (breadcrumbAction) breadcrumbAction.textContent = "New Order";
        if (saveButtonText) saveButtonText.textContent = "Save Order";
        else if (saveButton) saveButton.innerHTML = `<i class="fas fa-save"></i> Save Order`;
        if (manualOrderIdInput) manualOrderIdInput.readOnly = false; // Make manual ID editable again
        // Set default dates/status
        if (orderDateInput) orderDateInput.value = new Date().toISOString().split('T')[0];
        const defaultStatus = "Order Received";
        orderStatusSelect.value = defaultStatus;
        updateStatusDropdownColor(defaultStatus);
        // Reset UI elements related to customer selection
        resetCustomerSelectionUI(true); // Clear inputs, balance, link
        updateOrderSummary(); // Recalculate summary (should be zero)
        handleAddItem(); // Add one empty item row
        showFormError(''); // Clear any previous error messages
        hideProductSuggestions(); // Hide product suggestions if open
        if (customerSuggestionsNameBox) hideSuggestionBox(customerSuggestionsNameBox); // Hide customer suggestions
        if (customerSuggestionsWhatsAppBox) hideSuggestionBox(customerSuggestionsWhatsAppBox);
        window.scrollTo(0, 0); // Scroll to top
    }

    // --- WhatsApp Reminder Functions ---
    function showWhatsAppReminder(customer, orderId, deliveryDateStr) {
        // ... (existing code - no changes needed here) ...
        if (!whatsappReminderPopup || !whatsappMsgPreview || !whatsappSendLink) {
            console.warn("WhatsApp popup elements missing.");
            // Determine redirect URL based on mode
            const redirectUrl = isEditMode ? `order_history.html?highlightOrderId=${orderIdToEdit || ''}` : 'new_order.html';
            if (!isEditMode) { resetNewOrderForm(); } // Reset only if adding new
            // Redirect immediately if popup elements are missing
            window.location.href = redirectUrl;
            return;
        }

        const customerName = customer.fullName || 'Customer';
        const customerNumber = customer.whatsappNo?.replace(/[^0-9]/g, ''); // Clean number

        if (!customerNumber) {
            console.warn("Cannot send WhatsApp, number missing/invalid.");
            const redirectUrl = isEditMode ? `order_history.html?highlightOrderId=${orderIdToEdit || ''}` : 'new_order.html';
             if (!isEditMode) resetNewOrderForm();
            window.location.href = redirectUrl;
            return;
        }

        // Format delivery date
        let formattedDeliveryDate = ' जल्द से जल्द'; // Default
        try {
             if (deliveryDateStr) {
                 // Basic date formatting, consider library for complex needs
                 formattedDeliveryDate = new Date(deliveryDateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
             }
        } catch (e) { console.error("Error formatting delivery date:", e); }

        // Construct message
        let message = `प्रिय ${customerName},\n`;
        message += `आपका ऑर्डर (Order ID: ${orderId}) सफलतापूर्वक सहेज लिया गया है।\n`;
        message += `डिलीवरी की अनुमानित तिथि: ${formattedDeliveryDate}.\n\n`;
        message += `धन्यवाद,\n[Your Company Name]`; // <<< Replace with your actual company name

        whatsappMsgPreview.innerText = message; // Display preview

        // Encode message for URL
        const encodedMessage = encodeURIComponent(message);
        // Construct wa.me URL (assuming Indian numbers)
        const whatsappUrl = `https://wa.me/91${customerNumber}?text=${encodedMessage}`;

        whatsappSendLink.href = whatsappUrl; // Set link href
        whatsappSendLink.style.pointerEvents = 'auto'; // Ensure link is clickable
        whatsappSendLink.style.opacity = '1';

        // Determine redirect URL for after closing/sending
        const redirectUrl = isEditMode ? `order_history.html?highlightOrderId=${orderIdToEdit || ''}` : 'new_order.html';
        const closePopupDelay = 1000; // Delay before redirect after clicking send

        // Define actions
        const handleSendClick = () => {
            console.log("WhatsApp link clicked...");
            whatsappSendLink.style.pointerEvents = 'none'; // Prevent multiple clicks
            whatsappSendLink.style.opacity = '0.7';
            // Redirect after a short delay to allow WhatsApp to open
            setTimeout(() => {
                console.log("Redirecting after send delay...");
                if (!isEditMode) resetNewOrderForm(); // Reset form only if adding new
                 window.location.href = redirectUrl;
            }, closePopupDelay);
        };

        const handleCloseOrOverlayClick = () => {
            console.log("Popup closed without sending explicitly...");
             if (!isEditMode) resetNewOrderForm(); // Reset form only if adding new
            window.location.href = redirectUrl; // Redirect immediately
            closeWhatsAppPopup(); // Ensure popup closes visually
        };

        // Remove previous listeners before adding new ones
        whatsappSendLink.onclick = null;
        popupCloseBtn.onclick = null;
        whatsappReminderPopup.onclick = null;

        // Add new listeners
        whatsappSendLink.onclick = handleSendClick;
        popupCloseBtn.onclick = handleCloseOrOverlayClick;
        whatsappReminderPopup.onclick = (event) => {
            // Close only if clicking the overlay itself, not content inside
            if (event.target === whatsappReminderPopup) {
                handleCloseOrOverlayClick();
            }
        };

        // Show the popup
        whatsappReminderPopup.classList.add('active');
    }

    function closeWhatsAppPopup() {
        if (whatsappReminderPopup) {
            whatsappReminderPopup.classList.remove('active');
            // Clean up listeners and reset button state
            if (whatsappSendLink) {
                whatsappSendLink.onclick = null;
                whatsappSendLink.style.pointerEvents = 'auto';
                whatsappSendLink.style.opacity = '1';
            }
            if (popupCloseBtn) popupCloseBtn.onclick = null;
            whatsappReminderPopup.onclick = null;
        }
    }

    // ----- Balance Calculation Helper Functions (for New Order Page) -----
    // These calculate totals based *only* on orders and payments, excluding adjustments
    // for simplicity on this page. The detail page shows the fully adjusted balance.
    async function loadPaymentTotals_NewOrder(customerId) {
        let totalPaid = 0;
        if (!db || !collection || !query || !where || !getDocs) {
            console.error("_newOrder: DB functions missing for payments."); return 0; // Return 0 on error
        }
        try {
            const q = query(collection(db, "payments"), where("customerId", "==", customerId));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => {
                totalPaid += Number(doc.data().amountPaid || 0);
            });
            return totalPaid;
        } catch (error) {
            console.error("_newOrder: Error loading payment total:", error);
            if (error.code === 'failed-precondition' || error.message.includes("index")) {
                console.warn("_newOrder: Firestore index missing for payments/customerId. Balance calculation might be inaccurate.");
                // Don't show form error here, just return 0
            }
            return 0; // Return 0 on error
        }
    }

    async function loadOrderTotals_NewOrder(customerId) {
        let totalOrderValue = 0;
        if (!db || !collection || !query || !where || !getDocs) {
            console.error("_newOrder: DB functions missing for orders."); return 'Error'; // Return 'Error' string
        }
        try {
            const q = query(collection(db, "orders"), where("customerId", "==", customerId));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => {
                // Use finalAmount if available, otherwise totalAmount
                totalOrderValue += Number(doc.data().finalAmount || doc.data().totalAmount || 0);
            });
            return totalOrderValue; // Return calculated total (can be 0 if no orders)
        } catch (error) {
            console.error("_newOrder: Error loading order total value:", error);
            if (error.code === 'failed-precondition' || error.message.includes("index")) {
                 console.warn("_newOrder: Firestore index missing for orders/customerId. Balance calculation might be inaccurate.");
            }
            return 'Error'; // Return 'Error' string
        }
    }

    // --- Log that the script finished loading ---
    console.log("new_order.js V1.2 script logic initialized.");

}, INITIALIZATION_DELAY); // End of setTimeout wrapper