// js/new_order.js - v2.0 (PO Style Items, Discount, Advance Payment)

// --- Firebase Functions ---
const {
    db, collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc,
    query, where, orderBy, limit, Timestamp, serverTimestamp // serverTimestamp might be needed for payments
} = window;

// --- Global Variables ---
let isEditMode = false;
let orderIdToEdit = null;
let currentOrderData = null; // Store loaded order data for editing
let selectedCustomerId = null;
let selectedCustomerData = null; // Store fetched customer data
let productCache = [];
let customerCache = [];
let productFetchPromise = null;
let customerFetchPromise = null;
let activeProductInput = null; // For product suggestions positioning
let productSearchDebounceTimer;
let customerSearchDebounceTimer;

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
// Customer fields
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
// Order Date/Delivery/Remarks
const orderDateInput = document.getElementById('order_date');
const deliveryDateInput = document.getElementById('delivery_date');
const remarksInput = document.getElementById('remarks');
// Item Table
const orderItemsTableBody = document.getElementById('orderItemsTableBody');
const itemRowTemplate = document.getElementById('item-row-template');
const addItemBtn = document.getElementById('addItemBtn');
const calculationPreviewArea = document.getElementById('calculationPreviewArea'); // Optional preview area
// Summary Section
const summarySubtotalSpan = document.getElementById('summarySubtotal');
const summaryDiscountPercentInput = document.getElementById('summaryDiscountPercent');
const summaryDiscountAmountInput = document.getElementById('summaryDiscountAmount');
const summaryFinalAmountSpan = document.getElementById('summaryFinalAmount');
const summaryAdvancePaymentInput = document.getElementById('summaryAdvancePayment');
const summaryTotalBalanceSpan = document.getElementById('summaryTotalBalance');
const creditLimitWarningDiv = document.getElementById('creditLimitWarning');
// Status & Others
const orderStatusCheckboxes = document.querySelectorAll('input[name="order_status"]');
const formErrorMsg = document.getElementById('formErrorMsg');
// WhatsApp Popup (references assumed from previous version)
const whatsappReminderPopup = document.getElementById('whatsapp-reminder-popup');
const whatsappMsgPreview = document.getElementById('whatsapp-message-preview');
const whatsappSendLink = document.getElementById('whatsapp-send-link');
const popupCloseBtn = document.getElementById('popup-close-btn');
let productSuggestionsDiv = null; // For product suggestions

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("New Order DOM Loaded (v2.0). Initializing...");
    waitForDbConnection(initializeForm);

    // Event Listeners
    if (orderForm) orderForm.addEventListener('submit', handleFormSubmit);
    if (addItemBtn) addItemBtn.addEventListener('click', handleAddItem);

    // Use event delegation for item rows (delete, inputs)
    if (orderItemsTableBody) {
        orderItemsTableBody.addEventListener('click', handleItemTableClick);
        orderItemsTableBody.addEventListener('input', handleItemTableInput);
        orderItemsTableBody.addEventListener('change', handleItemTableChange); // For selects
        orderItemsTableBody.addEventListener('focusin', (event) => { // Track focused product input
             if (event.target.matches('.product-name')) {
                activeProductInput = event.target;
             }
        });
    }

    // Customer Autocomplete Listeners
    if (customerNameInput) customerNameInput.addEventListener('input', (e) => handleCustomerInput(e, 'name'));
    if (customerWhatsAppInput) customerWhatsAppInput.addEventListener('input', (e) => handleCustomerInput(e, 'whatsapp'));
    if (customerNameInput) customerNameInput.addEventListener('blur', () => hideSuggestionBox(customerSuggestionsNameBox));
    if (customerWhatsAppInput) customerWhatsAppInput.addEventListener('blur', () => hideSuggestionBox(customerSuggestionsWhatsAppBox));

    // Summary Field Listeners
    if (summaryDiscountPercentInput) summaryDiscountPercentInput.addEventListener('input', handleDiscountInput);
    if (summaryDiscountAmountInput) summaryDiscountAmountInput.addEventListener('input', handleDiscountInput);
    if (summaryAdvancePaymentInput) summaryAdvancePaymentInput.addEventListener('input', updateOrderSummary); // Only need to update balance

    // WhatsApp Popup Listener
    if (popupCloseBtn) popupCloseBtn.addEventListener('click', closeWhatsAppPopup);
    if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (event) => { if (event.target === whatsappReminderPopup) closeWhatsAppPopup(); });

    // Global click listener to hide suggestion boxes
    document.addEventListener('click', handleGlobalClick);
});

// --- DB Connection Wait ---
function waitForDbConnection(callback) {
    if (window.db) { console.log("DB connection confirmed."); callback(); }
    else { let attempts = 0; const maxAttempts = 20; const intervalId = setInterval(() => { attempts++; if (window.db) { clearInterval(intervalId); console.log("DB connection confirmed after check."); callback(); } else if (attempts >= maxAttempts) { clearInterval(intervalId); console.error("DB connection timeout."); alert("Database connection failed."); if(saveButton){saveButton.disabled=true;} } }, 250); }
}

 // --- Global Click Handler ---
 function handleGlobalClick(event) {
    // Hide customer suggestions if clicked outside
    if (customerSuggestionsNameBox && !customerSuggestionsNameBox.contains(event.target) && event.target !== customerNameInput) {
        hideSuggestionBox(customerSuggestionsNameBox);
    }
    if (customerSuggestionsWhatsAppBox && !customerSuggestionsWhatsAppBox.contains(event.target) && event.target !== customerWhatsAppInput) {
        hideSuggestionBox(customerSuggestionsWhatsAppBox);
    }
    // Hide product suggestions if clicked outside
    if (productSuggestionsDiv && activeProductInput && !productSuggestionsDiv.contains(event.target) && event.target !== activeProductInput) {
         hideProductSuggestions();
    }
 }

// --- Utility to Hide Suggestion Box ---
function hideSuggestionBox(box) {
    if (box) {
         box.classList.remove('active');
         box.style.display = 'none'; // Ensure it's hidden
    }
}

// --- Form Initialization ---
function initializeForm() {
    const urlParams = new URLSearchParams(window.location.search);
    orderIdToEdit = urlParams.get('editOrderId');

    if (orderIdToEdit) {
        isEditMode = true;
        console.log("Edit Mode Initializing. Order Firestore ID:", orderIdToEdit);
        if (headerText) headerText.textContent = "Edit Order";
        if (breadcrumbAction) breadcrumbAction.textContent = "Edit Order";
        if (saveButtonText) saveButtonText.textContent = "Update Order";
        if (hiddenEditOrderIdInput) hiddenEditOrderIdInput.value = orderIdToEdit;
        if (manualOrderIdInput) manualOrderIdInput.readOnly = true;
        loadOrderForEdit(orderIdToEdit);
        // Status checkboxes handled within loadOrderForEdit
    } else {
        isEditMode = false;
        console.log("Add Mode Initializing.");
        if (headerText) headerText.textContent = "New Order";
        if (breadcrumbAction) breadcrumbAction.textContent = "New Order";
        if (saveButtonText) saveButtonText.textContent = "Save Order";
        if (manualOrderIdInput) manualOrderIdInput.readOnly = false;
        if (orderDateInput && !orderDateInput.value) { orderDateInput.value = new Date().toISOString().split('T')[0]; }
        handleStatusCheckboxes(false); // Set default status for new order
        resetCustomerSelectionUI(); // Reset customer display
        // Add one empty item row automatically for new orders
        if (orderItemsTableBody.children.length === 0) {
             handleAddItem();
        }
        updateOrderSummary(); // Calculate initial summary (all zeros)
    }
    preFetchCaches(); // Pre-fetch customer and product data
}

// --- Pre-fetch Caches ---
function preFetchCaches() {
    getOrFetchCustomerCache().catch(err => console.error("Initial customer cache fetch failed:", err));
    getOrFetchProductCache().catch(err => console.error("Initial product cache fetch failed:", err));
}

// --- Load Order For Edit ---
async function loadOrderForEdit(docId) {
    console.log(`Loading order data for edit: ${docId}`);
    showFormError('');
    try {
        const orderRef = doc(db, "orders", docId);
        const docSnap = await getDoc(orderRef);
        if (docSnap.exists()) {
            currentOrderData = docSnap.data();
            console.log("Order data for edit:", currentOrderData);

            // Fill Customer Details
            selectedCustomerId = currentOrderData.customerId || null;
            if (selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId;
            if (currentOrderData.customerDetails) {
                customerNameInput.value = currentOrderData.customerDetails.fullName || '';
                customerWhatsAppInput.value = currentOrderData.customerDetails.whatsappNo || '';
                customerAddressInput.value = currentOrderData.customerDetails.address || '';
                customerContactInput.value = currentOrderData.customerDetails.contactNo || '';
                // Fetch full customer data for balance/link if ID exists
                if(selectedCustomerId) {
                     fetchAndDisplayCustomerDetails(selectedCustomerId);
                } else {
                     resetCustomerSelectionUI();
                }
            }

            // Fill Order Details
            displayOrderIdInput.value = currentOrderData.orderId || docId;
            manualOrderIdInput.value = currentOrderData.orderId || ''; // Keep readOnly
            orderDateInput.value = currentOrderData.orderDate || '';
            deliveryDateInput.value = currentOrderData.deliveryDate || '';
            remarksInput.value = currentOrderData.remarks || '';
            const urgentVal = currentOrderData.urgent || 'No';
            const urgentRadio = orderForm.querySelector(`input[name="urgent"][value="${urgentVal}"]`);
            if (urgentRadio) urgentRadio.checked = true;

            // Fill Status
            handleStatusCheckboxes(true); // Enable all first
            orderStatusCheckboxes.forEach(cb => cb.checked = false); // Uncheck all
            if (currentOrderData.status) {
                const statusCheckbox = orderForm.querySelector(`input[name="order_status"][value="${currentOrderData.status}"]`);
                if (statusCheckbox) statusCheckbox.checked = true;
            }

            // Fill Item Table
            orderItemsTableBody.innerHTML = ''; // Clear existing rows
            if (currentOrderData.items && Array.isArray(currentOrderData.items)) {
                currentOrderData.items.forEach(item => {
                    const newRow = addItemRow(false); // Add row without focusing
                    populateItemRow(newRow, item);
                });
            }
            if (orderItemsTableBody.children.length === 0) { handleAddItem();} // Add empty row if no items loaded

            // Fill Summary Section
            summaryDiscountPercentInput.value = currentOrderData.discountPercentage || '';
            summaryDiscountAmountInput.value = currentOrderData.discountAmount || '';
            summaryAdvancePaymentInput.value = currentOrderData.advancePayment || '';

            updateOrderSummary(); // Calculate and display all summary fields

        } else {
            console.error("Order document not found for editing!");
            showFormError("Error: Cannot find the order to edit.");
            if(saveButton) saveButton.disabled = true;
            // Consider redirecting: window.location.href = 'order_history.html';
        }
    } catch (error) {
        console.error("Error loading order for edit:", error);
        showFormError("Error loading order data: " + error.message);
         if(saveButton) saveButton.disabled = true;
    }
}

// --- Item Handling (Adapted from new_po.js) ---

function handleAddItem() {
    const newRow = addItemRow(true); // Add row and focus
    if (newRow) {
        // Trigger change on unit type to ensure correct initial display
        const unitSelect = newRow.querySelector('.unit-type-select');
        if (unitSelect) {
             handleUnitTypeChange({ target: unitSelect }); // Simulate change event
        }
        updateOrderSummary(); // Update summary when item is added
    }
}

function addItemRow(focusOnFirstInput = true) {
     if (!itemRowTemplate || !orderItemsTableBody) {
         console.error("Item template or table body not found!");
         return null;
     }
     const templateContent = itemRowTemplate.content.cloneNode(true);
     const newRow = templateContent.querySelector('.item-row');
     if (!newRow) {
         console.error("Cloned node is not an item-row");
         return null;
     }
     orderItemsTableBody.appendChild(templateContent); // Appending the document fragment automatically moves the row

     // Focus on the first product input if requested
     if (focusOnFirstInput) {
         const firstInput = orderItemsTableBody.lastElementChild?.querySelector('.product-name');
         if (firstInput) {
             firstInput.focus();
         }
     }
      // Ensure the row is fully in the DOM before returning it
     return orderItemsTableBody.lastElementChild;
 }

function populateItemRow(row, itemData) {
    if (!row || !itemData) return;

    const productNameInput = row.querySelector('.product-name');
    const unitTypeSelect = row.querySelector('.unit-type-select');
    const quantityInput = row.querySelector('.quantity-input');
    const rateInput = row.querySelector('.rate-input');
    const itemAmountSpan = row.querySelector('.item-amount');
    const minRateValueSpan = row.querySelector('.min-rate-value');

    if (productNameInput) productNameInput.value = itemData.productName || '';
    if (unitTypeSelect) unitTypeSelect.value = itemData.unitType || 'Qty';
    if (quantityInput) quantityInput.value = itemData.quantity || 1;
    if (rateInput) rateInput.value = itemData.rate || '';
    if (minRateValueSpan) minRateValueSpan.textContent = itemData.minSaleRate !== undefined ? parseFloat(itemData.minSaleRate).toFixed(2) : '--'; // Store min rate on row if needed later

    // Store min rate in dataset for validation later
    if(rateInput && itemData.minSaleRate !== undefined) {
        rateInput.dataset.minRate = itemData.minSaleRate;
    }

    // Handle Sq Ft fields
    if (itemData.unitType === 'Sq Feet') {
        const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
        const widthInput = row.querySelector('.width-input');
        const heightInput = row.querySelector('.height-input');
        if (dimensionUnitSelect) dimensionUnitSelect.value = itemData.dimensionUnit || 'feet';
        if (widthInput) widthInput.value = itemData.width || '';
        if (heightInput) heightInput.value = itemData.height || '';
    }

    // Simulate change on unit type to show/hide correct fields
    if (unitTypeSelect) {
        handleUnitTypeChange({ target: unitTypeSelect });
    }

    // Calculate and display amount AFTER setting all values and handling unit type
    updateItemAmount(row); // This will also call updateOrderSummary
}


function handleItemTableClick(event) {
    // Handle Delete Button Click
    if (event.target.closest('.delete-item-btn')) {
        const row = event.target.closest('.item-row');
        if (row) {
            row.remove();
            hideProductSuggestions(); // Hide if suggestion was open for this row
            updateOrderSummary(); // Recalculate total after deleting
        }
    }
    // Handle Product Suggestion Click (using mousedown for reliability)
     if (event.type === 'mousedown' && event.target.closest('.product-suggestions li')) {
        event.preventDefault(); // Prevent blur on product input
        const li = event.target.closest('li');
        const productData = JSON.parse(li.dataset.product || '{}');
         if (activeProductInput) {
            selectProductSuggestion(productData, activeProductInput);
         }
     }
}

// Use event delegation for inputs/changes within the table body
function handleItemTableInput(event) {
    const target = event.target;
    const row = target.closest('.item-row');
    if (!row) return;

    // Handle product name input for suggestions
    if (target.matches('.product-name')) {
         activeProductInput = target; // Update active input
         handleProductSearchInput(event);
    }
    // Handle numeric inputs (Quantity, Rate, Dimensions)
    else if (target.matches('.quantity-input, .rate-input, .width-input, .height-input')) {
         updateItemAmount(row); // This implicitly calls updateOrderSummary
    }
}
function handleItemTableChange(event){
     const target = event.target;
     const row = target.closest('.item-row');
     if (!row) return;
      // Handle select changes (Unit Type, Dimension Unit)
     if (target.matches('.unit-type-select')) {
         handleUnitTypeChange(event); // This calls updateItemAmount -> updateOrderSummary
     } else if (target.matches('.dimension-unit-select')) {
         updateItemAmount(row); // This calls updateOrderSummary
     }
}


// --- Sq Ft Calculation Logic (from new_po.js) ---
function calculateFlexDimensions(unit, width, height) {
    // console.log(`Calculating flex: Unit=<span class="math-inline">\{unit\}, W\=</span>{width}, H=${height}`);
    const mediaWidthsFt = [3, 4, 5, 6, 8, 10]; // Standard media widths in feet

    let wFt = (unit === 'inches') ? parseFloat(width || 0) / 12 : parseFloat(width || 0);
    let hFt = (unit === 'inches') ? parseFloat(height || 0) / 12 : parseFloat(height || 0);

    // Basic validation
    if (isNaN(wFt) || isNaN(hFt) || wFt <= 0 || hFt <= 0) {
        return { realSqFt: 0, printWidthFt: 0, printHeightFt: 0, printSqFt: 0 };
    }

    const realSqFt = wFt * hFt;

    // Find best fit considering rotation
    let bestFit = { widthFt: wFt, heightFt: hFt, mediaWidthFt: Infinity, printSqFt: Infinity };

    // Option 1: No rotation (Use width against media widths)
    const mediaWidthFitW = mediaWidthsFt.find(mw => mw >= wFt);
    let printWidthFt1 = mediaWidthFitW || wFt; // Use actual width if larger than max media
    let printHeightFt1 = hFt;
    let printSqFt1 = printWidthFt1 * printHeightFt1;
    if (!mediaWidthFitW) console.warn(`Width ${wFt.toFixed(2)}ft might exceed max media width.`);

    // Option 2: Rotation (Use height against media widths)
    const mediaWidthFitH = mediaWidthsFt.find(mw => mw >= hFt);
    let printWidthFt2 = wFt;
    let printHeightFt2 = mediaWidthFitH || hFt; // Use actual height if larger than max media
    let printSqFt2 = printWidthFt2 * printHeightFt2;
    if (!mediaWidthFitH) console.warn(`Height ${hFt.toFixed(2)}ft might exceed max media width.`);

    // Choose the orientation with less print area (less wastage)
    if (printSqFt1 <= printSqFt2) {
         bestFit.printWidthFt = printWidthFt1;
         bestFit.printHeightFt = printHeightFt1;
         bestFit.printSqFt = printSqFt1;
         bestFit.mediaWidthFt = mediaWidthFitW || Infinity; // Store which media was used (or Infinity if none)
    } else {
        bestFit.printWidthFt = printWidthFt2;
        bestFit.printHeightFt = printHeightFt2;
        bestFit.printSqFt = printSqFt2;
        bestFit.mediaWidthFt = mediaWidthFitH || Infinity; // Store which media was used (or Infinity if none)
    }

     // Return necessary values (mostly in feet for consistency in calculation)
     return {
        realSqFt: realSqFt,
        printWidthFt: bestFit.printWidthFt,
        printHeightFt: bestFit.printHeightFt,
        printSqFt: bestFit.printSqFt,
        // Optional extra info for display/debug:
        // inputUnit: unit,
        // realWidthFt: wFt,
        // realHeightFt: hFt,
        // usedMediaWidthFt: bestFit.mediaWidthFt
     };
}

function handleUnitTypeChange(event) {
    const row = event.target.closest('.item-row');
    if (!row) return;

    const unitType = event.target.value;
    const sqFeetInputs = row.querySelectorAll('.sq-feet-input');
    const qtyInputCell = row.querySelector('.quantity-input')?.closest('td'); // Find the cell containing qty input
    const rateInput = row.querySelector('.rate-input');
    const rateWrapper = row.querySelector('.rate-input-wrapper');
    const minRateInfo = rateWrapper?.querySelector('.min-rate-info');

    // Toggle visibility of dimension/unit inputs
    sqFeetInputs.forEach(el => {
        el.style.display = (unitType === 'Sq Feet') ? '' : 'none';
    });

    // Toggle visibility of table headers (find headers in the table)
    const table = row.closest('table');
    const headers = table?.querySelectorAll('thead th.sq-feet-header');
    headers?.forEach(th => {
         th.classList.toggle('hidden-col', unitType !== 'Sq Feet');
    });

    // Update rate placeholder and min rate info visibility
    if (rateInput) {
        rateInput.placeholder = (unitType === 'Sq Feet') ? 'Rate/SqFt' : 'Rate/Unit';
    }
     if (minRateInfo) {
         // Keep min rate info always visible, just update placeholder
         // minRateInfo.style.display = ''; // Always visible
     }

    // Clear dimension values if switching away from Sq Feet
    if (unitType !== 'Sq Feet') {
        row.querySelector('.width-input')?.value = '';
        row.querySelector('.height-input')?.value = '';
    }

    updateItemAmount(row); // Recalculate amount after changing unit type
}

function updateItemAmount(row) {
    if (!row) return;
    const unitTypeSelect = row.querySelector('.unit-type-select');
    const amountSpan = row.querySelector('.item-amount');
    const rateInput = row.querySelector('.rate-input');
    const quantityInput = row.querySelector('.quantity-input');
    const minRate = parseFloat(rateInput?.dataset.minRate || -1); // Get min rate from dataset

    let calculatedAmount = 0;
    let rateValue = parseFloat(rateInput?.value || 0);
    let quantity = parseInt(quantityInput?.value || 1);
    if (isNaN(quantity) || quantity < 1) { quantity = 1; } // Default quantity to 1

    try {
        // Check Minimum Rate
        if (minRate >= 0 && rateValue < minRate) {
             rateInput.classList.add('input-error'); // Add error style
             rateInput.title = `Rate cannot be less than minimum: ${formatCurrency(minRate)}`;
             // Optionally prevent calculation or just show warning
        } else {
             rateInput.classList.remove('input-error');
             rateInput.title = '';
        }

        if (unitTypeSelect?.value === 'Sq Feet') {
            const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
            const widthInput = row.querySelector('.width-input');
            const heightInput = row.querySelector('.height-input');
            const unit = dimensionUnitSelect ? dimensionUnitSelect.value : 'feet';
            const width = parseFloat(widthInput?.value || 0);
            const height = parseFloat(heightInput?.value || 0);

            if (width > 0 && height > 0 && rateValue >= 0) { // Check rateValue >= 0
                const calcResult = calculateFlexDimensions(unit, width, height);
                const printSqFtPerItem = parseFloat(calcResult.printSqFt || 0);
                calculatedAmount = printSqFtPerItem * quantity * rateValue;
                 // Optional: Update preview area if using it
                 // updateFlexCalculationPreview(row, calcResult);
            }
        } else { // Assuming 'Qty' or similar
            if (rateValue >= 0) { // Check rateValue >= 0
                 calculatedAmount = quantity * rateValue;
            }
             // Optional: Clear preview area if switching from Sq Ft
             // clearFlexCalculationPreview(row);
        }
    } catch (e) {
        console.error("Error calculating item amount:", e);
        calculatedAmount = 0;
    }

    if (amountSpan) {
        amountSpan.textContent = calculatedAmount.toFixed(2);
    }

    updateOrderSummary(); // Update totals whenever an item amount changes
}

// --- Order Summary Calculation ---
function updateOrderSummary() {
    let subtotal = 0;
    orderItemsTableBody.querySelectorAll('.item-row').forEach(row => {
        const amountSpan = row.querySelector('.item-amount');
        subtotal += parseFloat(amountSpan?.textContent || 0);
    });

    const discountPercent = parseFloat(summaryDiscountPercentInput?.value || 0);
    const discountAmount = parseFloat(summaryDiscountAmountInput?.value || 0);
    let calculatedDiscountAmount = 0;

    // Prioritize percentage if both are entered or if percentage has a value
    if (discountPercent > 0 && !isNaN(discountPercent)) {
        calculatedDiscountAmount = subtotal * (discountPercent / 100);
        if (summaryDiscountAmountInput) summaryDiscountAmountInput.value = calculatedDiscountAmount.toFixed(2); // Update amount field
    } else if (discountAmount > 0 && !isNaN(discountAmount)) {
        calculatedDiscountAmount = discountAmount;
        // Optional: Calculate and update percentage field if amount was entered directly
        if (summaryDiscountPercentInput && subtotal > 0) {
             const calculatedPercent = (calculatedDiscountAmount / subtotal) * 100;
             summaryDiscountPercentInput.value = calculatedPercent.toFixed(2);
        } else if (summaryDiscountPercentInput) {
             summaryDiscountPercentInput.value = ''; // Clear percent if subtotal is 0
        }
    } else {
         // If both are 0 or invalid, ensure fields reflect 0
         if (summaryDiscountPercentInput) summaryDiscountPercentInput.value = '';
         if (summaryDiscountAmountInput) summaryDiscountAmountInput.value = '';
    }


    const finalAmount = subtotal - calculatedDiscountAmount;
    const advancePayment = parseFloat(summaryAdvancePaymentInput?.value || 0);
    const totalBalance = finalAmount - advancePayment;

    // Update display spans/fields
    if (summarySubtotalSpan) summarySubtotalSpan.textContent = subtotal.toFixed(2);
    if (summaryFinalAmountSpan) summaryFinalAmountSpan.textContent = finalAmount.toFixed(2);
    if (summaryTotalBalanceSpan) summaryTotalBalanceSpan.textContent = totalBalance.toFixed(2);

     // Check Credit Limit after summary update
     checkCreditLimit();
}

function handleDiscountInput(event) {
    const changedInput = event.target;
    // If % changed, clear Amount field to allow recalculation based on %
    if (changedInput === summaryDiscountPercentInput) {
        summaryDiscountAmountInput.value = '';
    }
    // If Amount changed, clear % field to allow recalculation based on Amount
    else if (changedInput === summaryDiscountAmountInput) {
         summaryDiscountPercentInput.value = '';
    }
    updateOrderSummary(); // Recalculate everything
}

// --- Customer Autocomplete & Details ---
// handleCustomerInput, getOrFetchCustomerCache, filterAndRenderCustomerSuggestions, renderCustomerSuggestions - Keep similar to previous version
// Add fetchAndDisplayCustomerDetails to get balance and credit limit

async function getOrFetchCustomerCache() {
     if (customerCache.length > 0) { return Promise.resolve(); }
     if (customerFetchPromise) { return customerFetchPromise; }
     console.log("Fetching initial customer data...");
     try {
        if (!db || !collection || !query || !getDocs || !orderBy) { throw new Error("Firestore query functions unavailable for customers."); }
        const customersRef = collection(db, "customers");
        // Fetch active customers first? Or all? Fetch all for now. Consider adding where("status", "==", "active") if needed.
        const q = query(customersRef, orderBy("fullName")); // Requires index on fullName
        customerFetchPromise = getDocs(q).then(snapshot => {
            customerCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`Cached ${customerCache.length} customers.`);
            customerFetchPromise = null; // Clear promise after success
        }).catch(err => { console.error("Error fetching customers:", err); customerFetchPromise = null; throw err; }); // Clear promise on error
        return customerFetchPromise;
     } catch (error) { console.error("Error setting up customer fetch:", error); customerFetchPromise = null; return Promise.reject(error); }
}


function handleCustomerInput(event, type) {
    const inputElement = event.target;
    const searchTerm = inputElement.value.trim();
    const suggestionBox = type === 'name' ? customerSuggestionsNameBox : customerSuggestionsWhatsAppBox;
    if (!suggestionBox) return;

    // Reset full selection if user starts typing again
    resetCustomerSelectionUI(false); // Keep inputs, clear link/balance

    if (searchTerm.length < 1) { // Suggest even on 1 character? Changed from 2
        clearTimeout(customerSearchDebounceTimer);
        hideSuggestionBox(suggestionBox);
        return;
    }

    clearTimeout(customerSearchDebounceTimer);
    customerSearchDebounceTimer = setTimeout(() => {
        getOrFetchCustomerCache().then(() => {
            filterAndRenderCustomerSuggestions(searchTerm, type, suggestionBox, inputElement);
        }).catch(err => console.error("Error during customer fetch/filter:", err));
    }, 300);
}

function filterAndRenderCustomerSuggestions(term, type, box, inputElement) {
    const lowerTerm = term.toLowerCase();
    const field = type === 'name' ? 'fullName' : 'whatsappNo';
    const filtered = customerCache.filter(c => {
         const value = String(c[field] || '').toLowerCase(); // Ensure it's a string
         return value.includes(lowerTerm);
    }).slice(0, 10); // Limit suggestions
    renderCustomerSuggestions(filtered, term, box, inputElement);
}

function renderCustomerSuggestions(suggestions, term, box, inputElement) {
    if (!box) return;
    if (suggestions.length === 0) {
         box.innerHTML = '<li class="no-suggestions">No matching customers found.</li>';
         box.classList.add('active');
         box.style.display = 'block';
        return;
    }

    const ul = document.createElement('ul');
    suggestions.forEach(cust => {
        const li = document.createElement('li');
        const displayName = `<span class="math-inline">\{cust\.fullName\} \(</span>{cust.whatsappNo})`;
        try {
            li.innerHTML = displayName.replace(new RegExp(`(<span class="math-inline">\{term\.replace\(/\[\-\\/\\\\^</span>*+?.()|[\]{}]/g, '\\$&')})`, 'gi'), '<strong>$1</strong>');
        } catch {
            li.textContent = displayName;
        }
        // Store necessary data directly on the element
        li.dataset.customerId = cust.id;
        li.dataset.customerName = cust.fullName;
        li.dataset.customerWhatsapp = cust.whatsappNo;
        li.dataset.customerAddress = cust.billingAddress || cust.address || '';
        li.dataset.customerContact = cust.contactNo || '';

        li.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent input blur before click registers
            fillCustomerData(li.dataset); // Pass dataset object
            hideSuggestionBox(box);
        });
        ul.appendChild(li);
    });
    box.innerHTML = ''; // Clear previous
    box.appendChild(ul);
    box.classList.add('active');
    box.style.display = 'block';

     // Position relative to the input element that triggered it
     const inputRect = inputElement.getBoundingClientRect();
     box.style.position = 'absolute'; // Ensure positioning context
     box.style.left = '0'; // Align with left of input container (form-group)
     box.style.top = `${inputRect.height}px`; // Position below the input
     box.style.width = `${inputRect.width}px`; // Match input width
     box.style.zIndex = '1000';
}


function fillCustomerData(customerData) {
    if (!customerData || !customerData.customerId) {
        resetCustomerSelectionUI();
        return;
    }
    console.log("Filling customer data:", customerData);
    customerNameInput.value = customerData.customerName || '';
    customerWhatsAppInput.value = customerData.customerWhatsapp || '';
    customerAddressInput.value = customerData.customerAddress || '';
    customerContactInput.value = customerData.customerContact || '';
    selectedCustomerId = customerData.customerId;
    if (selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId;

    // Now fetch full details including balance and limit
    fetchAndDisplayCustomerDetails(selectedCustomerId);
}

async function fetchAndDisplayCustomerDetails(customerId) {
     console.log("Fetching full details for customer:", customerId);
     resetCustomerSelectionUI(false); // Clear previous balance/link first
     if (!customerId) return;

     try {
        // Find customer data in cache first
        let customer = customerCache.find(c => c.id === customerId);
        if (!customer) {
             // If not in cache, fetch directly (should ideally not happen if cache is pre-fetched)
             console.log("Customer not in cache, fetching directly...");
             const custDoc = await getDoc(doc(db, "customers", customerId));
             if (custDoc.exists()) {
                 customer = { id: custDoc.id, ...custDoc.data() };
             } else {
                 console.error("Customer document not found during detail fetch.");
                 return;
             }
        }
        selectedCustomerData = customer; // Store fetched data globally

        // --- Calculate Balance (Simplified: Needs proper calculation function) ---
        // This is a placeholder. You need a robust function like in customer_account_detail.js
        // that fetches all orders (finalAmount) and all payments (amountPaid) for the customer.
        // For now, just display N/A or fetch if function exists.
         let balance = 'N/A';
         // Example: const balanceResult = await calculateCustomerBalance(customerId); // Assume this function exists
         // balance = balanceResult.balance;

         if(customerBalanceArea) {
             customerCurrentBalanceSpan.textContent = (balance !== 'N/A') ? formatCurrency(balance) : 'N/A';
             customerBalanceArea.style.display = 'block';
         }
         // --- End Placeholder Balance Calculation ---

        // Display Account Link
         if(viewCustomerAccountLink && customerAccountLinkArea) {
            viewCustomerAccountLink.href = `customer_account_detail.html?id=${encodeURIComponent(customerId)}`;
            customerAccountLinkArea.style.display = 'block';
         }

         // Check credit limit immediately after fetching customer data
         checkCreditLimit();

     } catch(error) {
        console.error("Error fetching customer details:", error);
        resetCustomerSelectionUI();
     }
}

function resetCustomerSelectionUI(clearInputs = true) {
    console.log("Resetting customer UI elements.");
    selectedCustomerId = null;
    selectedCustomerData = null; // Clear stored customer data
    if (selectedCustomerIdInput) selectedCustomerIdInput.value = '';
    if (customerAccountLinkArea) customerAccountLinkArea.style.display = 'none';
    if (customerBalanceArea) customerBalanceArea.style.display = 'none';
    if (customerCurrentBalanceSpan) customerCurrentBalanceSpan.textContent = '';
    if (creditLimitWarningDiv) creditLimitWarningDiv.style.display = 'none'; // Hide warning

    if (clearInputs) {
        customerNameInput.value = '';
        customerWhatsAppInput.value = '';
        customerAddressInput.value = '';
        customerContactInput.value = '';
    }
}

// --- Credit Limit Check ---
function checkCreditLimit() {
     if (!selectedCustomerData || !selectedCustomerData.creditAllowed) {
         if(creditLimitWarningDiv) creditLimitWarningDiv.style.display = 'none';
         return; // No credit allowed or customer not selected
     }

     const creditLimit = parseFloat(selectedCustomerData.creditLimit || 0);
     const currentBalanceText = customerCurrentBalanceSpan?.textContent || '0';
     // Extract number from formatted currency string or handle N/A
     const currentBalance = parseFloat(currentBalanceText.replace(/[^0-9.-]+/g,"")) || 0;

     const finalAmountText = summaryFinalAmountSpan?.textContent || '0';
     const newOrderValue = parseFloat(finalAmountText) || 0;

     if (isNaN(currentBalance) || isNaN(newOrderValue)) {
          console.warn("Cannot check credit limit due to invalid balance or order value.");
          if(creditLimitWarningDiv) creditLimitWarningDiv.style.display = 'none';
          return;
     }

     const potentialBalance = currentBalance + newOrderValue;

     console.log(`Credit Check: Limit=<span class="math-inline">\{creditLimit\}, CurrentBalance\=</span>{currentBalance}, NewOrder=<span class="math-inline">\{newOrderValue\}, Potential\=</span>{potentialBalance}`);

     if (potentialBalance > creditLimit) {
         if (creditLimitWarningDiv) {
             creditLimitWarningDiv.textContent = `Warning: This order will exceed the customer's credit limit of ${formatCurrency(creditLimit)}. Current Balance: ${formatCurrency(currentBalance)}, Potential Balance: ${formatCurrency(potentialBalance)}.`;
             creditLimitWarningDiv.style.display = 'block';
         }
     } else {
          if (creditLimitWarningDiv) creditLimitWarningDiv.style.display = 'none';
     }
 }

// --- Product Autocomplete (Adapted from new_po.js v13) ---
function getOrCreateProductSuggestionsDiv() {
    if (!productSuggestionsDiv) {
         productSuggestionsDiv = document.createElement('div');
         productSuggestionsDiv.className = 'product-suggestions-list'; // Use a distinct class if needed
         productSuggestionsDiv.style.display = 'none';
         // Append globally or relative to the table container? Append globally for simplicity.
         document.body.appendChild(productSuggestionsDiv);

          // Add mousedown listener to the suggestions container
         productSuggestionsDiv.addEventListener('mousedown', handleItemTableClick);
    }
    return productSuggestionsDiv;
}

function positionProductSuggestions(inputElement) {
    const suggestionsContainer = getOrCreateProductSuggestionsDiv();
    const inputRect = inputElement.getBoundingClientRect();
    // Position below the input element
    suggestionsContainer.style.position = 'absolute';
    suggestionsContainer.style.left = `${inputRect.left + window.scrollX}px`;
    suggestionsContainer.style.top = `${inputRect.bottom + window.scrollY}px`;
    suggestionsContainer.style.width = `${inputRect.width < 250 ? 250 : inputRect.width}px`; // Min width
    suggestionsContainer.style.display = 'block';
    suggestionsContainer.style.zIndex = '1050'; // Ensure it's above other elements
}

function hideProductSuggestions() {
    if (productSuggestionsDiv) {
        productSuggestionsDiv.style.display = 'none';
    }
    activeProductInput = null; // Clear active input when hiding
}

function handleProductSearchInput(event) {
    const inputElement = event.target;
    if (!inputElement.matches('.product-name')) return; // Ensure it's the product input

    activeProductInput = inputElement; // Track the currently active input
    clearTimeout(productSearchDebounceTimer);
    const searchTerm = inputElement.value.trim();

    if (searchTerm.length < 1) { // Start searching from 1 character
        hideProductSuggestions();
        return;
    }

    positionProductSuggestions(inputElement); // Position immediately

    productSearchDebounceTimer = setTimeout(() => {
        // Check if the input still has focus and matches the active input
         if (document.activeElement === inputElement && activeProductInput === inputElement) {
             getOrFetchProductCache().then(() => {
                 filterAndRenderProductSuggestions(searchTerm, inputElement);
             }).catch(err => console.error("Error fetching/filtering products:", err));
         } else {
              // If focus moved or input changed, hide suggestions
              // hideProductSuggestions(); // Already handled by global click/blur usually
         }
    }, 350); // Debounce time
}

async function getOrFetchProductCache() {
     if (productCache.length > 0) { return Promise.resolve(); }
     if (productFetchPromise) { return productFetchPromise; }
     console.log("Fetching initial product data...");
     try {
         if (!db || !collection || !query || !getDocs || !orderBy) { throw new Error("Firestore functions unavailable."); }
         const productsRef = collection(db, "products");
         // Fetch products ordered by name (requires index)
         // Also fetch saleRate and minSaleRate
         const q = query(productsRef, orderBy("printName")); // Add where clause if needed (e.g., active products)
         productFetchPromise = getDocs(q).then(snapshot => {
            productCache = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.printName,
                    unit: data.unit, // Need unit to suggest default type?
                    saleRate: data.saleRate, // Fetch sale rate
                    minSaleRate: data.minSaleRate // Fetch min rate
                };
            });
             console.log(`Cached ${productCache.length} products.`);
             productFetchPromise = null;
         }).catch(err => { console.error("Error fetching products:", err); productFetchPromise = null; throw err; });
         return productFetchPromise;
     } catch (error) { console.error("Error setting up product fetch:", error); productFetchPromise = null; return Promise.reject(error); }
}

function filterAndRenderProductSuggestions(term, inputElement) {
     const suggestionsContainer = getOrCreateProductSuggestionsDiv();
     suggestionsContainer.innerHTML = '<ul><li class="no-suggestions">Loading...</li></ul>'; // Show loading
     if (activeProductInput !== inputElement) { // Check if the suggestion is still for the current input
          hideProductSuggestions();
          return;
     }
     positionProductSuggestions(inputElement); // Reposition just in case

     const lowerTerm = term.toLowerCase();
     const filtered = productCache.filter(p =>
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
         suggestions.forEach(prod => {
             const li = document.createElement('li');
             try { // Highlight match
                li.innerHTML = prod.name.replace(new RegExp(`(<span class="math-inline">\{term\.replace\(/\[\-\\/\\\\^</span>*+?.()|[\]{}]/g, '\\$&')})`, 'gi'), '<strong>$1</strong>');
             } catch { li.textContent = prod.name; }
             // Store product data (including rates) in dataset for selection
             li.dataset.product = JSON.stringify(prod);
             // Mousedown listener handled by delegation on the container (handleItemTableClick)
             ul.appendChild(li);
         });
     }
     suggestionsContainer.innerHTML = ''; // Clear loading/previous
     suggestionsContainer.appendChild(ul);
     suggestionsContainer.style.display = 'block'; // Ensure visible
}

 function selectProductSuggestion(productData, inputElement) {
     const row = inputElement.closest('.item-row');
     if (!row || !productData) {
         console.error("Could not find row or product data for suggestion.");
         hideProductSuggestions();
         return;
     }

     const productNameInput = row.querySelector('.product-name');
     const unitTypeSelect = row.querySelector('.unit-type-select');
     const rateInput = row.querySelector('.rate-input');
     const quantityInput = row.querySelector('.quantity-input'); // To focus later
     const minRateValueSpan = row.querySelector('.min-rate-value');

     if (!productNameInput || !unitTypeSelect || !rateInput || !quantityInput || !minRateValueSpan) {
         console.error("Missing required elements in the item row for product selection.");
         hideProductSuggestions();
         return;
     }

     productNameInput.value = productData.name || '';
     rateInput.value = productData.saleRate !== undefined ? productData.saleRate : '';
     minRateValueSpan.textContent = productData.minSaleRate !== undefined ? parseFloat(productData.minSaleRate).toFixed(2) : '--';

     // Store min rate in dataset for validation
     rateInput.dataset.minRate = productData.minSaleRate !== undefined ? productData.minSaleRate : '-1';


     // Suggest Unit Type based on product data (optional)
     let defaultUnitType = 'Qty';
     if (productData.unit) {
         const unitLower = productData.unit.toLowerCase();
         if (unitLower.includes('sq') || unitLower.includes('feet') || unitLower.includes('ft')) {
             defaultUnitType = 'Sq Feet';
         }
     }
     unitTypeSelect.value = defaultUnitType;

     hideProductSuggestions(); // Hide after selection

     // Trigger change event on unit type select to update UI
     const changeEvent = new Event('change', { bubbles: true });
     unitTypeSelect.dispatchEvent(changeEvent); // This will call handleUnitTypeChange -> updateItemAmount -> updateOrderSummary

     // Focus on the next logical input (quantity or width)
     let nextInput = null;
     if (defaultUnitType === 'Sq Feet') {
        nextInput = row.querySelector('.width-input');
     }
     if (!nextInput) { // If not SqFt or width input not found
         nextInput = quantityInput;
     }
     if (nextInput) {
         nextInput.focus();
         if (typeof nextInput.select === 'function') {
             nextInput.select(); // Select content if possible
         }
     } else {
         rateInput.focus(); // Fallback to rate input
     }
     // Recalculate amount just in case focus logic didn't trigger it
      updateItemAmount(row);
 }


// --- Status Checkbox Handling ---
function handleStatusCheckboxes(isEditing) {
    const defaultStatus = "Order Received";
    let defaultCheckbox = null;
    orderStatusCheckboxes.forEach(checkbox => {
        if (checkbox.value === defaultStatus) defaultCheckbox = checkbox;
        checkbox.disabled = false; // Always enable status change
        checkbox.closest('label').classList.remove('disabled');
        checkbox.removeEventListener('change', handleStatusChange); // Remove previous listener
        checkbox.addEventListener('change', handleStatusChange);
    });

    // Only default check 'Order Received' if it's a truly new order and no status is loaded yet
    // Check if any checkbox is already checked (could happen during loadOrderForEdit)
    const isAnyChecked = Array.from(orderStatusCheckboxes).some(cb => cb.checked);
    if (!isEditing && !isAnyChecked && defaultCheckbox) {
        defaultCheckbox.checked = true;
    }
}
// Single Status Selection Logic
function handleStatusChange(event) {
    const changedCheckbox = event.target;
    if (changedCheckbox.checked) {
        orderStatusCheckboxes.forEach(otherCb => {
            if (otherCb !== changedCheckbox) otherCb.checked = false;
        });
    }
    // If user unchecks the only checked box, optionally re-check the default or leave none checked
    // const isAnyChecked = Array.from(orderStatusCheckboxes).some(cb => cb.checked);
    // if (!isAnyChecked) {
    //    // Option 1: Re-check default
    //    // const defaultCheck = Array.from(orderStatusCheckboxes).find(cb => cb.value === "Order Received");
    //    // if (defaultCheck) defaultCheck.checked = true;
    //    // Option 2: Allow no status (will default on save)
    // }
}


// --- Form Submit Handler ---
async function handleFormSubmit(event) {
    event.preventDefault();
    console.log("Form submission initiated (v2.0)...");
    showFormError(''); // Clear previous errors

    if (!db || !collection || !addDoc || !doc || !updateDoc || !getDoc || !Timestamp || !getDocs || !query || !limit ) {
        showFormError("Database functions unavailable. Cannot save order."); return;
    }
    if (!saveButton) return;
    saveButton.disabled = true;
    if (saveButtonText) saveButtonText.textContent = isEditMode ? 'Updating...' : 'Saving...';
    else saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        // --- 1. Gather Customer Data ---
        const customerFullNameFromInput = customerNameInput.value.trim();
        const customerWhatsAppFromInput = customerWhatsAppInput.value.trim();
        let customerIdToUse = selectedCustomerId; // Use ID if a customer was selected

        // Basic Customer Validation
        if (!customerFullNameFromInput) throw new Error("Customer Full Name is required.");
        if (!customerWhatsAppFromInput) throw new Error("Customer WhatsApp No is required.");

        // If no customer was selected (i.e., new customer details entered manually)
        // Optional: Check if this customer already exists based on WhatsApp? Or just create a new one?
        // For now, assume if no ID, it might be a new customer or just details were typed.
        // We save the details as entered. Linking might happen later or requires more logic.
         const customerDataForOrder = {
             fullName: customerFullNameFromInput,
             whatsappNo: customerWhatsAppFromInput,
             address: customerAddressInput.value.trim() || '',
             contactNo: customerContactInput.value.trim() || ''
         };

        // --- 2. Gather Order Details ---
        const orderDateValue = orderDateInput.value;
        const deliveryDateValue = deliveryDateInput.value || '';
        const urgentValue = orderForm.querySelector('input[name="urgent"]:checked')?.value || 'No';
        const remarksValue = remarksInput.value.trim() || '';
        const statusCheckbox = orderForm.querySelector('input[name="order_status"]:checked');
        const selectedStatus = statusCheckbox ? statusCheckbox.value : 'Order Received'; // Default if none selected

        if (!orderDateValue) throw new Error("Order Date is required.");

         // --- 3. Generate/Determine Order ID ---
         let orderIdToUse;
         const manualOrderIdValue = manualOrderIdInput.value.trim();
         const existingSystemId = displayOrderIdInput.value; // From edit mode load

         if (isEditMode) {
             orderIdToUse = currentOrderData?.orderId || existingSystemId || orderIdToEdit; // Use loaded ID
             console.log(`Edit mode. Using Order ID: ${orderIdToUse}`);
         } else if (manualOrderIdValue) {
             orderIdToUse = manualOrderIdValue; // Use manual ID if provided for new order
             console.log(`Manual Order ID provided for new order: ${orderIdToUse}`);
             // Optional: Check if this manual ID already exists?
         } else {
              // Generate new ID (Using simpler timestamp-based for now, replace with counter if needed)
              // const nextId = await getNextOrderIdCounter(); // Preferred method
              // orderIdToUse = nextId.toString();
              orderIdToUse = Date.now().toString(); // Fallback simple generation
              console.log(`New Order ID generated: ${orderIdToUse}`);
         }


        // --- 4. Gather Item Data ---
        const itemsArray = [];
        const itemRows = orderItemsTableBody.querySelectorAll('.item-row');
        if (itemRows.length === 0) throw new Error("Please add at least one item to the order.");

        let validationPassed = true;
        itemRows.forEach((row, index) => {
            if (!validationPassed) return;

            const productNameInput = row.querySelector('.product-name');
            const unitTypeSelect = row.querySelector('.unit-type-select');
            const quantityInput = row.querySelector('.quantity-input');
            const rateInput = row.querySelector('.rate-input');
            const itemAmountSpan = row.querySelector('.item-amount');
            // Sq Ft Inputs
            const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
            const widthInput = row.querySelector('.width-input');
            const heightInput = row.querySelector('.height-input');

            const productName = productNameInput?.value.trim();
            const unitType = unitTypeSelect?.value;
            const quantity = parseInt(quantityInput?.value || 0);
            const rate = parseFloat(rateInput?.value || 0);
            const itemAmount = parseFloat(itemAmountSpan?.textContent || 0);
            const minRate = parseFloat(rateInput?.dataset.minRate || -1);

            // Item Validation
            if (!productName) { validationPassed = false; showFormError(`Item ${index + 1}: Product Name is required.`); productNameInput?.focus(); return; }
            if (isNaN(quantity) || quantity <= 0) { validationPassed = false; showFormError(`Item ${index + 1}: Valid Quantity (>= 1) is required.`); quantityInput?.focus(); return; }
            if (isNaN(rate) || rate < 0) { validationPassed = false; showFormError(`Item ${index + 1}: Valid Rate (>= 0) is required.`); rateInput?.focus(); return; }
            if (minRate >= 0 && rate < minRate) { validationPassed = false; showFormError(`Item <span class="math-inline">\{index \+ 1\}\: Rate cannot be less than minimum \(</span>{formatCurrency(minRate)}).`); rateInput?.focus(); return; }


            const itemData = {
                productName: productName,
                unitType: unitType,
                quantity: quantity,
                rate: rate,
                itemAmount: itemAmount, // Amount calculated and displayed
                minSaleRate: minRate >= 0 ? minRate : null // Store min rate used for this item
            };

            if (unitType === 'Sq Feet') {
                const dimensionUnit = dimensionUnitSelect?.value || 'feet';
                const width = parseFloat(widthInput?.value || 0);
                const height = parseFloat(heightInput?.value || 0);
                if (isNaN(width) || width <= 0) { validationPassed = false; showFormError(`Item ${index + 1}: Valid Width required for Sq Feet.`); widthInput?.focus(); return; }
                if (isNaN(height) || height <= 0) { validationPassed = false; showFormError(`Item ${index + 1}: Valid Height required for Sq Feet.`); heightInput?.focus(); return; }

                // Recalculate dimensions on save to ensure accuracy
                const calcResult = calculateFlexDimensions(dimensionUnit, width, height);
                itemData.dimensionUnit = dimensionUnit;
                itemData.width = width;
                itemData.height = height;
                itemData.realSqFt = calcResult.realSqFt;
                itemData.printSqFt = calcResult.printSqFt;
                // Recalculate itemAmount based on saved data
                itemData.itemAmount = parseFloat((calcResult.printSqFt * quantity * rate).toFixed(2));
             } else {
                 // Recalculate for Qty just in case
                 itemData.itemAmount = parseFloat((quantity * rate).toFixed(2));
             }

            itemsArray.push(itemData);
        });

        if (!validationPassed) { throw new Error("Please fix the errors in the item list."); }

        // --- 5. Gather Summary Data ---
         // Recalculate summary on save to ensure consistency
         let finalSubtotal = 0;
         itemsArray.forEach(item => { finalSubtotal += item.itemAmount; });

         const discountPercentValue = parseFloat(summaryDiscountPercentInput?.value || 0);
         let discountAmountValue = parseFloat(summaryDiscountAmountInput?.value || 0);

         // Recalculate discount amount based on percentage if provided
         if (discountPercentValue > 0 && !isNaN(discountPercentValue)) {
             discountAmountValue = parseFloat((finalSubtotal * (discountPercentValue / 100)).toFixed(2));
         } else if (discountAmountValue > 0 && !isNaN(discountAmountValue)) {
             // Keep the directly entered amount
         } else {
              discountAmountValue = 0; // No discount
         }

         const finalAmountValue = parseFloat((finalSubtotal - discountAmountValue).toFixed(2));
         const advancePaymentValue = parseFloat(summaryAdvancePaymentInput?.value || 0);
         const totalBalanceValue = parseFloat((finalAmountValue - advancePaymentValue).toFixed(2));


        // --- 6. Prepare Firestore Payload ---
        const orderDataPayload = {
            orderId: orderIdToUse,
            customerId: customerIdToUse || null, // Link to customer if selected
            customerDetails: customerDataForOrder, // Save details entered/selected
            orderDate: orderDateValue,
            deliveryDate: deliveryDateValue,
            urgent: urgentValue,
            remarks: remarksValue,
            status: selectedStatus,
            items: itemsArray, // Detailed items
            subTotal: finalSubtotal,
            discountPercentage: discountPercentValue || 0,
            discountAmount: discountAmountValue || 0,
            finalAmount: finalAmountValue,
            advancePayment: advancePaymentValue || 0,
            totalBalance: totalBalanceValue,
            // Timestamps
            updatedAt: Timestamp.now() // Use client-side timestamp for consistency
        };

        // Add createdAt only for new orders
        if (!isEditMode) {
            orderDataPayload.createdAt = Timestamp.now();
        } else {
             // Keep original createdAt if it exists? Or update? Let's keep it.
             // payload.createdAt = currentOrderData?.createdAt || Timestamp.now(); // Or use serverTimestamp()
        }


        // --- 7. Save to Firestore ---
        let savedDocId;
        let successMessage;

        if (isEditMode) {
            if (!orderIdToEdit) throw new Error("Missing Firestore Document ID for update.");
            const orderRef = doc(db, "orders", orderIdToEdit);
            await updateDoc(orderRef, orderDataPayload);
            savedDocId = orderIdToEdit;
            successMessage = `Order ${orderIdToUse} updated successfully!`;
            console.log(successMessage);
        } else {
            const newOrderRef = await addDoc(collection(db, "orders"), orderDataPayload);
            savedDocId = newOrderRef.id; // Firestore auto-generated doc ID
            successMessage = `Order ${orderIdToUse} created successfully!`;
            console.log(successMessage, "Firestore Doc ID:", savedDocId);
            displayOrderIdInput.value = orderIdToUse; // Display the generated/used ID
        }

        // --- 8. Handle Advance Payment ---
        if (advancePaymentValue > 0) {
            console.log("Adding advance payment record...");
            try {
                const paymentData = {
                    customerId: customerIdToUse, // Must have customer ID to link payment
                    orderRefId: isEditMode ? orderIdToEdit : savedDocId, // Link payment to the order document ID
                    orderId: orderIdToUse, // Store the display Order ID as well
                    amountPaid: advancePaymentValue,
                    paymentDate: Timestamp.fromDate(new Date(orderDateValue + 'T00:00:00')), // Use order date for payment date? Or today? Let's use Order Date.
                    paymentMethod: "Order Advance", // Specific method
                    notes: `Advance payment recorded with Order #${orderIdToUse}`,
                    createdAt: Timestamp.now()
                };
                 if (!paymentData.customerId) {
                      console.warn("Cannot save advance payment record without a selected Customer ID.");
                      alert("Order saved, but advance payment could not be recorded automatically as no existing customer was linked.");
                 } else {
                    await addDoc(collection(db, "payments"), paymentData);
                    console.log("Advance payment record added successfully.");
                 }
            } catch (paymentError) {
                console.error("Error saving advance payment record:", paymentError);
                alert(`Order saved, but failed to automatically record advance payment: ${paymentError.message}`);
            }
        }

        // --- 9. Post-Save Actions ---
        alert(successMessage);

        // Show WhatsApp reminder only if WhatsApp number exists
        if (customerDataForOrder.whatsappNo) {
            showWhatsAppReminder(customerDataForOrder, orderIdToUse, deliveryDateValue);
            // Form reset is handled within showWhatsAppReminder or its close function for NEW orders
        } else {
            console.warn("WhatsApp number missing, skipping reminder.");
            if (!isEditMode) {
                // Reset form immediately if no reminder shown
                 resetNewOrderForm();
            } else {
                 // Optionally reload the edited data or redirect
                 // loadOrderForEdit(orderIdToEdit); // Reload
            }
        }

    } catch (error) {
        console.error("Error saving/updating order:", error);
        showFormError("Error: " + error.message);
    } finally {
        saveButton.disabled = false;
        const btnTxt = isEditMode ? "Update Order" : "Save Order";
        if (saveButtonText) { saveButtonText.textContent = btnTxt; }
        else { saveButton.innerHTML = `<i class="fas fa-save"></i> ${btnTxt}`; }
    }
}

// --- Reset Form ---
function resetNewOrderForm() {
     console.log("Resetting form for New Order.");
     orderForm.reset(); // Reset all form fields
     orderItemsTableBody.innerHTML = ''; // Clear items table
     selectedCustomerId = null;
     selectedCustomerData = null;
     currentOrderData = null;
     isEditMode = false;
     orderIdToEdit = null;
     if (hiddenEditOrderIdInput) hiddenEditOrderIdInput.value = '';
     if (selectedCustomerIdInput) selectedCustomerIdInput.value = '';
     if (headerText) headerText.textContent = "New Order";
     if (breadcrumbAction) breadcrumbAction.textContent = "New Order";
     if (saveButtonText) saveButtonText.textContent = "Save Order";
     else if (saveButton) saveButton.innerHTML = `<i class="fas fa-save"></i> Save Order`;
     if (manualOrderIdInput) manualOrderIdInput.readOnly = false;
     if (orderDateInput) orderDateInput.value = new Date().toISOString().split('T')[0]; // Reset date
     handleStatusCheckboxes(false); // Reset status to default
     resetCustomerSelectionUI(true); // Clear customer inputs/display
     updateOrderSummary(); // Reset summary fields to zero
     handleAddItem(); // Add one empty row back
     showFormError(''); // Clear any previous errors
     hideProductSuggestions(); // Hide suggestions
     hideSuggestionBox(customerSuggestionsNameBox);
     hideSuggestionBox(customerSuggestionsWhatsAppBox);
}

// --- Helper Functions ---
function showFormError(message) {
    if (formErrorMsg) {
        formErrorMsg.textContent = message;
        formErrorMsg.style.display = message ? 'block' : 'none';
        if (message) {
             formErrorMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } else {
         if(message) alert(message); // Fallback
    }
}

function formatCurrency(amount) {
    const num = Number(amount || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// --- WhatsApp Reminder Functions (Keep similar to previous version) ---
function showWhatsAppReminder(customer, orderId, deliveryDate) {
     if (!whatsappReminderPopup || !whatsappMsgPreview || !whatsappSendLink) {
         console.error("WhatsApp popup elements missing.");
         if (!isEditMode) { resetNewOrderForm(); } // Reset if popup fails for new order
         return;
     }
     const customerName = customer.fullName || 'Customer';
     const customerNumber = customer.whatsappNo?.replace(/[^0-9]/g, '');
     if (!customerNumber) {
         console.warn("WhatsApp No missing, skipping reminder.");
         if (!isEditMode) { resetNewOrderForm(); } // Reset if no reminder shown for new order
         return;
     }
     const formattedDeliveryDate = deliveryDate ? new Date(deliveryDate).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : ' जल्द से जल्द';
     // Simplified message
     let message = `प्रिय ${customerName},\nआपका ऑर्डर (Order ID: ${orderId}) सफलतापूर्वक सहेज लिया गया है। डिलीवरी की अनुमानित तिथि: ${formattedDeliveryDate}.\nधन्यवाद,\nMadhav Offset`;

     whatsappMsgPreview.innerText = message;
     const encodedMessage = encodeURIComponent(message);
     const whatsappUrl = `https://wa.me/<span class="math-inline">\{customerNumber\}?text\=</span>{encodedMessage}`;
     whatsappSendLink.href = whatsappUrl;
     whatsappReminderPopup.classList.add('active');
     console.log("WhatsApp reminder shown.");
     // Reset form for NEW orders only AFTER showing reminder
     // The user might want to send the message before the form clears
     whatsappSendLink.onclick = () => { // Reset after clicking send
         if (!isEditMode) { resetNewOrderForm(); }
         closeWhatsAppPopup();
     };
     popupCloseBtn.onclick = () => { // Reset after clicking close
         if (!isEditMode) { resetNewOrderForm(); }
         closeWhatsAppPopup();
     };
     // Also reset if overlay is clicked to close
     whatsappReminderPopup.onclick = (event) => {
         if (event.target === whatsappReminderPopup) {
              if (!isEditMode) { resetNewOrderForm(); }
              closeWhatsAppPopup();
         }
     };

}
function closeWhatsAppPopup() {
    if (whatsappReminderPopup) whatsappReminderPopup.classList.remove('active');
    // Remove specific click listeners to prevent multiple resets if popup reused
    whatsappSendLink.onclick = null;
    popupCloseBtn.onclick = null;
    whatsappReminderPopup.onclick = null;
    // Re-add the generic overlay click listener
    if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (event) => { if (event.target === whatsappReminderPopup) closeWhatsAppPopup(); });
    if (popupCloseBtn) popupCloseBtn.addEventListener('click', closeWhatsAppPopup);
}

console.log("new_order.js script loaded (v2.0 - PO Style, Discount, Advance).");