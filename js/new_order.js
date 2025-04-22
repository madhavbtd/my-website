// js/new_order.js - v2.1.1 (Syntax Checked, PO Style Items, Discount, Advance Payment)

// --- Firebase Functions ---
const {
    db, collection, addDoc, doc, getDoc, getDocs, updateDoc,
    query, where, orderBy, limit, Timestamp
} = window; // Ensure all needed functions are available globally

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
const summarySubtotalSpan = document.getElementById('summarySubtotal');
const summaryDiscountPercentInput = document.getElementById('summaryDiscountPercent');
const summaryDiscountAmountInput = document.getElementById('summaryDiscountAmount');
const summaryFinalAmountSpan = document.getElementById('summaryFinalAmount');
const summaryAdvancePaymentInput = document.getElementById('summaryAdvancePayment');
const summaryTotalBalanceSpan = document.getElementById('summaryTotalBalance');
const creditLimitWarningDiv = document.getElementById('creditLimitWarning');
const orderStatusCheckboxes = document.querySelectorAll('input[name="order_status"]');
const formErrorMsg = document.getElementById('formErrorMsg');
const whatsappReminderPopup = document.getElementById('whatsapp-reminder-popup');
const whatsappMsgPreview = document.getElementById('whatsapp-message-preview');
const whatsappSendLink = document.getElementById('whatsapp-send-link');
const popupCloseBtn = document.getElementById('popup-close-btn');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("New Order DOM Loaded (v2.1.1). Initializing...");
    waitForDbConnection(initializeForm); // Wait for db before initializing

    // Event Listeners
    if (orderForm) orderForm.addEventListener('submit', handleFormSubmit);
    if (addItemBtn) addItemBtn.addEventListener('click', handleAddItem);

    // Event delegation for item table
    if (orderItemsTableBody) {
        orderItemsTableBody.addEventListener('click', handleItemTableClick);
        orderItemsTableBody.addEventListener('input', handleItemTableInput);
        orderItemsTableBody.addEventListener('change', handleItemTableChange);
        orderItemsTableBody.addEventListener('focusin', (event) => {
             if (event.target.matches('.product-name')) activeProductInput = event.target;
        });
        orderItemsTableBody.addEventListener('mousedown', handleSuggestionMouseDown);
    }

    // Customer Autocomplete Listeners
    if (customerNameInput) {
        customerNameInput.addEventListener('input', (e) => handleCustomerInput(e, 'name'));
        customerNameInput.addEventListener('blur', () => setTimeout(() => hideSuggestionBox(customerSuggestionsNameBox), 150));
    }
    if (customerWhatsAppInput) {
        customerWhatsAppInput.addEventListener('input', (e) => handleCustomerInput(e, 'whatsapp'));
        customerWhatsAppInput.addEventListener('blur', () => setTimeout(() => hideSuggestionBox(customerSuggestionsWhatsAppBox), 150));
    }

    // Summary Field Listeners
    if (summaryDiscountPercentInput) summaryDiscountPercentInput.addEventListener('input', handleDiscountInput);
    if (summaryDiscountAmountInput) summaryDiscountAmountInput.addEventListener('input', handleDiscountInput);
    if (summaryAdvancePaymentInput) summaryAdvancePaymentInput.addEventListener('input', updateOrderSummary);

    // WhatsApp Popup Listener
    if (popupCloseBtn) popupCloseBtn.addEventListener('click', closeWhatsAppPopup);
    if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (event) => { if (event.target === whatsappReminderPopup) closeWhatsAppPopup(); });

    // Global click listener for hiding product suggestions
    document.addEventListener('click', handleGlobalClick);
});

// --- DB Connection Wait ---
function waitForDbConnection(callback) {
    if (window.db && typeof window.query === 'function') { // Check for db and a function
        console.log("DB connection and functions confirmed.");
        callback();
    } else {
        let attempts = 0;
        const maxAttempts = 20; // Wait for 5 seconds max
        const intervalId = setInterval(() => {
            attempts++;
            if (window.db && typeof window.query === 'function') {
                clearInterval(intervalId);
                console.log("DB connection and functions confirmed after check.");
                callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(intervalId);
                console.error("DB connection timeout or Firestore functions not loaded.");
                alert("Database connection failed. Please refresh the page.");
                if (saveButton) saveButton.disabled = true;
            }
        }, 250);
    }
}

// --- Global Click Handler ---
function handleGlobalClick(event) {
    // Hide product suggestions if clicked outside
    if (productSuggestionsDiv && activeProductInput &&
        !productSuggestionsDiv.contains(event.target) &&
        event.target !== activeProductInput) {
         hideProductSuggestions();
    }
    // Customer suggestions hidden on blur+timeout
}

// --- Utility Functions ---
function hideSuggestionBox(box) {
    if (box) { box.classList.remove('active'); box.style.display = 'none'; }
}
function formatCurrency(amount) {
    const num = Number(amount || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function showFormError(message) {
    if (formErrorMsg) {
        formErrorMsg.textContent = message;
        formErrorMsg.style.display = message ? 'block' : 'none';
        if (message) formErrorMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (message) { alert(message); }
}

// --- Form Initialization ---
function initializeForm() {
    console.log("Running initializeForm..."); // Debug log
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
    } else {
        isEditMode = false;
        console.log("Add Mode Initializing.");
        if (headerText) headerText.textContent = "New Order";
        if (breadcrumbAction) breadcrumbAction.textContent = "New Order";
        if (saveButtonText) saveButtonText.textContent = "Save Order";
        if (manualOrderIdInput) manualOrderIdInput.readOnly = false;
        if (orderDateInput && !orderDateInput.value) { orderDateInput.value = new Date().toISOString().split('T')[0]; }
        handleStatusCheckboxes(false);
        resetCustomerSelectionUI();
        if (orderItemsTableBody && orderItemsTableBody.children.length === 0) {
             handleAddItem(); // Add first empty row
        }
        updateOrderSummary(); // Calculate initial summary
    }
    preFetchCaches(); // Start fetching caches
}

// --- Pre-fetch Caches ---
function preFetchCaches() {
    console.log("Pre-fetching caches..."); // Debug log
    getOrFetchCustomerCache().catch(err => console.error("Initial customer cache fetch failed:", err));
    getOrFetchProductCache().catch(err => console.error("Initial product cache fetch failed:", err));
}

// --- Load Order For Edit ---
async function loadOrderForEdit(docId) {
    console.log(`Loading order data for edit: ${docId}`);
    showFormError('');
    if (!db || !doc || !getDoc) { showFormError("DB functions not ready for loading."); return; }
    try {
        const orderRef = doc(db, "orders", docId);
        const docSnap = await getDoc(orderRef);
        if (docSnap.exists()) {
            currentOrderData = docSnap.data();
            console.log("Order data loaded:", currentOrderData);

            // Fill Customer
            selectedCustomerId = currentOrderData.customerId || null;
            if (selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId;
            if (currentOrderData.customerDetails) {
                customerNameInput.value = currentOrderData.customerDetails.fullName || '';
                customerWhatsAppInput.value = currentOrderData.customerDetails.whatsappNo || '';
                customerAddressInput.value = currentOrderData.customerDetails.address || '';
                customerContactInput.value = currentOrderData.customerDetails.contactNo || '';
                if(selectedCustomerId) {
                     fetchAndDisplayCustomerDetails(selectedCustomerId);
                } else { resetCustomerSelectionUI(); }
            }

            // Fill Order Details
            displayOrderIdInput.value = currentOrderData.orderId || docId;
            manualOrderIdInput.value = currentOrderData.orderId || '';
            orderDateInput.value = currentOrderData.orderDate || '';
            deliveryDateInput.value = currentOrderData.deliveryDate || '';
            remarksInput.value = currentOrderData.remarks || '';
            const urgentVal = currentOrderData.urgent || 'No';
            const urgentRadio = orderForm.querySelector(`input[name="urgent"][value="${urgentVal}"]`);
            if (urgentRadio) urgentRadio.checked = true;

            // Fill Status
            handleStatusCheckboxes(true);
            orderStatusCheckboxes.forEach(cb => cb.checked = false);
            if (currentOrderData.status) {
                const statusCheckbox = orderForm.querySelector(`input[name="order_status"][value="${currentOrderData.status}"]`);
                if (statusCheckbox) statusCheckbox.checked = true;
            }

            // Fill Item Table
            orderItemsTableBody.innerHTML = '';
            if (currentOrderData.items && Array.isArray(currentOrderData.items)) {
                currentOrderData.items.forEach(item => {
                    const newRow = addItemRow(false);
                    populateItemRow(newRow, item); // Populate with saved item data
                });
            }
            if (orderItemsTableBody.children.length === 0) { handleAddItem();}

            // Fill Summary Section
            summaryDiscountPercentInput.value = currentOrderData.discountPercentage || '';
            summaryDiscountAmountInput.value = currentOrderData.discountAmount || '';
            summaryAdvancePaymentInput.value = currentOrderData.advancePayment || '';

            updateOrderSummary(); // Calculate summary based on loaded items & discount

        } else {
            console.error("Order document not found!"); showFormError("Error: Order not found."); if(saveButton) saveButton.disabled = true;
        }
    } catch (error) {
        console.error("Error loading order:", error); showFormError("Error loading order data: " + error.message); if(saveButton) saveButton.disabled = true;
    }
}

// --- Item Handling ---
function handleAddItem() {
    console.log("Add item button clicked or called"); // Debug log
    const newRow = addItemRow(true);
    if (newRow) {
        const unitSelect = newRow.querySelector('.unit-type-select');
        if (unitSelect) {
             handleUnitTypeChange({ target: unitSelect }); // Set initial state correctly
        } else {
            console.error("Unit select not found in new row!"); // Debug log
        }
        updateOrderSummary(); // Update summary when item is added
    } else {
        console.error("Failed to add item row"); // Debug log
    }
}

function addItemRow(focusOnFirstInput = true) {
     if (!itemRowTemplate || !orderItemsTableBody) { console.error("Item template or table body missing!"); return null; }
     try {
        const templateContent = itemRowTemplate.content.cloneNode(true);
        const newRow = templateContent.querySelector('.item-row'); // Get the row element itself
        if (!newRow) { console.error("Cloned node is not an item-row"); return null; }
        orderItemsTableBody.appendChild(newRow); // Append the row

        const addedRow = orderItemsTableBody.lastElementChild; // Get the appended row from the DOM

        // Make sure the event listeners are added to the *newly added row*
        // Note: Event delegation in initializeForm handles most listeners now.
        // We might only need specific setup here if delegation doesn't cover it.
        // Example: Manually trigger unit type change if needed on creation.
         const unitSelect = addedRow?.querySelector('.unit-type-select');
         if (unitSelect) {
              handleUnitTypeChange({ target: unitSelect }); // Ensure initial state
         }


        if (focusOnFirstInput) {
            addedRow?.querySelector('.product-name')?.focus();
        }
        console.log("Item row added successfully."); // Debug log
        return addedRow; // Return the row added to the DOM
     } catch (e) {
         console.error("Error cloning/appending item row:", e);
         return null;
     }
 }

function populateItemRow(row, itemData) {
    // (Populates a row with data, used during edit load)
    if (!row || !itemData) return;
    try {
        const productNameInput = row.querySelector('.product-name');
        const unitTypeSelect = row.querySelector('.unit-type-select');
        const quantityInput = row.querySelector('.quantity-input');
        const rateInput = row.querySelector('.rate-input');
        const minRateValueSpan = row.querySelector('.min-rate-value');

        if (productNameInput) productNameInput.value = itemData.productName || '';
        if (unitTypeSelect) unitTypeSelect.value = itemData.unitType || 'Qty';
        if (quantityInput) quantityInput.value = itemData.quantity || 1;
        if (rateInput) rateInput.value = itemData.rate !== undefined ? itemData.rate : ''; // Use saved rate

        const minRate = itemData.minSalePrice; // Use saved min price
        if (minRateValueSpan) minRateValueSpan.textContent = minRate !== undefined && minRate !== null ? parseFloat(minRate).toFixed(2) : '--';
        if (rateInput) rateInput.dataset.minRate = minRate !== undefined && minRate !== null ? minRate : '-1';

        if (itemData.unitType === 'Sq Feet') {
            const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
            const widthInput = row.querySelector('.width-input');
            const heightInput = row.querySelector('.height-input');
            if (dimensionUnitSelect) dimensionUnitSelect.value = itemData.dimensionUnit || 'feet';
            if (widthInput) widthInput.value = itemData.width || '';
            if (heightInput) heightInput.value = itemData.height || '';
        }

        if (unitTypeSelect) handleUnitTypeChange({ target: unitTypeSelect }); // Trigger UI update
        updateItemAmount(row); // Calculate amount based on loaded data
    } catch(e) { console.error("Error populating item row:", e); }
}

function handleItemTableClick(event) {
    // Handles delete button clicks via delegation
    if (event.target.closest('.delete-item-btn')) {
        const row = event.target.closest('.item-row');
        if (row) {
            row.remove();
            hideProductSuggestions();
            updateOrderSummary();
        }
    }
}

function handleSuggestionMouseDown(event) {
    // Handles product suggestion clicks via delegation
    if (event.target.closest('.product-suggestions-list li[data-product]')) {
         event.preventDefault();
         const li = event.target.closest('li');
         const productData = JSON.parse(li.dataset.product || '{}');
          if (activeProductInput) {
             selectProductSuggestion(productData, activeProductInput);
          }
    }
}

function handleItemTableInput(event) {
    // Handles text/number inputs via delegation
    const target = event.target;
    const row = target.closest('.item-row');
    if (!row) return;
    if (target.matches('.product-name')) {
         activeProductInput = target;
         handleProductSearchInput(event);
    }
    else if (target.matches('.quantity-input, .rate-input, .width-input, .height-input')) {
         updateItemAmount(row);
    }
}
function handleItemTableChange(event){
    // Handles select changes via delegation
     const target = event.target;
     const row = target.closest('.item-row');
     if (!row) return;
     if (target.matches('.unit-type-select')) {
         handleUnitTypeChange(event);
     } else if (target.matches('.dimension-unit-select')) {
         updateItemAmount(row);
     }
}


// --- Sq Ft Calculation Logic ---
function calculateFlexDimensions(unit, width, height) {
    // (Same as v2.1)
    const mediaWidthsFt = [3, 4, 5, 6, 8, 10]; let wFt = (unit === 'inches') ? parseFloat(width || 0) / 12 : parseFloat(width || 0); let hFt = (unit === 'inches') ? parseFloat(height || 0) / 12 : parseFloat(height || 0); if (isNaN(wFt) || isNaN(hFt) || wFt <= 0 || hFt <= 0) return { realSqFt: 0, printWidthFt: 0, printHeightFt: 0, printSqFt: 0 }; const realSqFt = wFt * hFt; let bestFit = { widthFt: wFt, heightFt: hFt, mediaWidthFt: Infinity, printSqFt: Infinity }; const mediaWidthFitW = mediaWidthsFt.find(mw => mw >= wFt); let printWidthFt1 = mediaWidthFitW || wFt; let printHeightFt1 = hFt; let printSqFt1 = printWidthFt1 * printHeightFt1; const mediaWidthFitH = mediaWidthsFt.find(mw => mw >= hFt); let printWidthFt2 = wFt; let printHeightFt2 = mediaWidthFitH || hFt; let printSqFt2 = printWidthFt2 * printHeightFt2; if (printSqFt1 <= printSqFt2) { bestFit.printWidthFt = printWidthFt1; bestFit.printHeightFt = printHeightFt1; bestFit.printSqFt = printSqFt1; bestFit.mediaWidthFt = mediaWidthFitW || Infinity; } else { bestFit.printWidthFt = printWidthFt2; bestFit.printHeightFt = printHeightFt2; bestFit.printSqFt = printSqFt2; bestFit.mediaWidthFt = mediaWidthFitH || Infinity; } return { realSqFt: realSqFt, printWidthFt: bestFit.printWidthFt, printHeightFt: bestFit.printHeightFt, printSqFt: bestFit.printSqFt };
}

function handleUnitTypeChange(event) {
    // (Same as v2.1)
    const row = event.target.closest('.item-row'); if (!row) return; const unitType = event.target.value; const sqFeetInputs = row.querySelectorAll('.sq-feet-input'); const rateInput = row.querySelector('.rate-input'); sqFeetInputs.forEach(el => { el.style.display = (unitType === 'Sq Feet') ? '' : 'none'; }); const table = row.closest('table'); const headers = table?.querySelectorAll('thead th.sq-feet-header'); headers?.forEach(th => { th.classList.toggle('hidden-col', unitType !== 'Sq Feet'); }); if (rateInput) { rateInput.placeholder = (unitType === 'Sq Feet') ? 'Rate/SqFt' : 'Rate/Unit'; } if (unitType !== 'Sq Feet') { row.querySelector('.width-input')?.value = ''; row.querySelector('.height-input')?.value = ''; } updateItemAmount(row);
}

function updateItemAmount(row) {
    // (Same as v2.1 - includes min rate check)
    if (!row) return; const unitTypeSelect = row.querySelector('.unit-type-select'); const amountSpan = row.querySelector('.item-amount'); const rateInput = row.querySelector('.rate-input'); const quantityInput = row.querySelector('.quantity-input'); const minRate = parseFloat(rateInput?.dataset.minRate || -1); let calculatedAmount = 0; let rateValue = parseFloat(rateInput?.value || 0); let quantity = parseInt(quantityInput?.value || 1); if (isNaN(quantity) || quantity < 1) { quantity = 1; }
    try { if (minRate >= 0 && rateValue < minRate) { rateInput.classList.add('input-error'); rateInput.title = `Rate cannot be less than minimum: ${formatCurrency(minRate)}`; } else { rateInput.classList.remove('input-error'); rateInput.title = ''; } if (unitTypeSelect?.value === 'Sq Feet') { const dimensionUnitSelect = row.querySelector('.dimension-unit-select'); const widthInput = row.querySelector('.width-input'); const heightInput = row.querySelector('.height-input'); const unit = dimensionUnitSelect ? dimensionUnitSelect.value : 'feet'; const width = parseFloat(widthInput?.value || 0); const height = parseFloat(heightInput?.value || 0); if (width > 0 && height > 0 && rateValue >= 0) { const calcResult = calculateFlexDimensions(unit, width, height); const printSqFtPerItem = parseFloat(calcResult.printSqFt || 0); calculatedAmount = printSqFtPerItem * quantity * rateValue; } } else { if (rateValue >= 0) { calculatedAmount = quantity * rateValue; } } } catch (e) { console.error("Error calculating item amount:", e); calculatedAmount = 0; } if (amountSpan) { amountSpan.textContent = calculatedAmount.toFixed(2); } updateOrderSummary();
}

// --- Order Summary Calculation ---
function updateOrderSummary() {
    // (Same as v2.1 - handles discount interaction)
    let subtotal = 0; orderItemsTableBody.querySelectorAll('.item-row').forEach(row => { const amountSpan = row.querySelector('.item-amount'); subtotal += parseFloat(amountSpan?.textContent || 0); }); let discountPercent = parseFloat(summaryDiscountPercentInput?.value || 0); let discountAmount = parseFloat(summaryDiscountAmountInput?.value || 0); let calculatedDiscountAmount = 0; if (!isDiscountInputProgrammaticChange) { if (document.activeElement === summaryDiscountPercentInput && !isNaN(discountPercent)) { calculatedDiscountAmount = subtotal * (discountPercent / 100); isDiscountInputProgrammaticChange = true; summaryDiscountAmountInput.value = calculatedDiscountAmount.toFixed(2); isDiscountInputProgrammaticChange = false; } else if (document.activeElement === summaryDiscountAmountInput && !isNaN(discountAmount)) { calculatedDiscountAmount = discountAmount; if (subtotal > 0) { const calculatedPercent = (calculatedDiscountAmount / subtotal) * 100; isDiscountInputProgrammaticChange = true; summaryDiscountPercentInput.value = calculatedPercent.toFixed(2); isDiscountInputProgrammaticChange = false; } else { isDiscountInputProgrammaticChange = true; summaryDiscountPercentInput.value = ''; isDiscountInputProgrammaticChange = false; } } else { if (!isNaN(discountPercent) && discountPercent > 0) { calculatedDiscountAmount = subtotal * (discountPercent / 100); } else if (!isNaN(discountAmount) && discountAmount > 0) { calculatedDiscountAmount = discountAmount; } else { calculatedDiscountAmount = 0; } } } calculatedDiscountAmount = Math.max(0, Math.min(calculatedDiscountAmount, subtotal)); const finalAmount = subtotal - calculatedDiscountAmount; const advancePayment = parseFloat(summaryAdvancePaymentInput?.value || 0); const totalBalance = finalAmount - advancePayment; if (summarySubtotalSpan) summarySubtotalSpan.textContent = subtotal.toFixed(2); if (summaryFinalAmountSpan) summaryFinalAmountSpan.textContent = finalAmount.toFixed(2); if (summaryTotalBalanceSpan) summaryTotalBalanceSpan.textContent = totalBalance.toFixed(2); checkCreditLimit();
}

function handleDiscountInput(event) {
    // (Same as v2.1)
    if (isDiscountInputProgrammaticChange) return; const changedInput = event.target; isDiscountInputProgrammaticChange = true; if (changedInput === summaryDiscountPercentInput) { summaryDiscountAmountInput.value = ''; } else if (changedInput === summaryDiscountAmountInput) { summaryDiscountPercentInput.value = ''; } isDiscountInputProgrammaticChange = false; updateOrderSummary();
}

// --- Customer Autocomplete & Details ---
// (All functions: getOrFetchCustomerCache, handleCustomerInput, filterAndRenderCustomerSuggestions, renderCustomerSuggestions, fillCustomerData, fetchAndDisplayCustomerDetails, resetCustomerSelectionUI - Keep same as v2.1)
async function getOrFetchCustomerCache() { /* ... Same as v2.1 ... */ if (customerCache.length > 0) return Promise.resolve(); if (customerFetchPromise) return customerFetchPromise; console.log("Fetching customer data..."); try { if (!db || !collection || !query || !getDocs || !orderBy) throw new Error("Firestore functions unavailable."); const q = query(collection(db, "customers"), orderBy("fullName")); customerFetchPromise = getDocs(q).then(s => { customerCache = s.docs.map(d => ({ id: d.id, ...d.data() })); console.log(`Cached ${customerCache.length} customers.`); customerFetchPromise = null; }).catch(e => { console.error(e); customerFetchPromise = null; throw e; }); return customerFetchPromise; } catch (e) { console.error(e); customerFetchPromise = null; return Promise.reject(e); } }
function handleCustomerInput(event, type) { /* ... Same as v2.1 ... */ const i = event.target, t = i.value.trim(), b = type === 'name' ? customerSuggestionsNameBox : customerSuggestionsWhatsAppBox; if (!b) return; resetCustomerSelectionUI(false); if (t.length < 1) { clearTimeout(customerSearchDebounceTimer); hideSuggestionBox(b); return; } clearTimeout(customerSearchDebounceTimer); customerSearchDebounceTimer = setTimeout(() => { getOrFetchCustomerCache().then(() => filterAndRenderCustomerSuggestions(t, type, b, i)).catch(e => console.error(e)); }, 300); }
function filterAndRenderCustomerSuggestions(term, type, box, inputElement) { /* ... Same as v2.1 ... */ const l = term.toLowerCase(), f = type === 'name' ? 'fullName' : 'whatsappNo', d = customerCache.filter(c => String(c[f] || '').toLowerCase().includes(l)).slice(0, 10); renderCustomerSuggestions(d, term, box, inputElement); }
function renderCustomerSuggestions(suggestions, term, box, inputElement) { /* ... Same as v2.1 ... */ if (!box) return; const ul = box.querySelector('ul') || document.createElement('ul'); ul.innerHTML = ''; if (suggestions.length === 0) { ul.innerHTML = '<li class="no-suggestions">No matching customers found.</li>'; } else { suggestions.forEach(c => { const li = document.createElement('li'); const d = `${c.fullName} (${c.whatsappNo})`; try { li.innerHTML = d.replace(new RegExp(`(${term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'), '<strong>$1</strong>'); } catch { li.textContent = d; } li.dataset.customerId = c.id; li.dataset.customerName = c.fullName; li.dataset.customerWhatsapp = c.whatsappNo; li.dataset.customerAddress = c.billingAddress || c.address || ''; li.dataset.customerContact = c.contactNo || ''; li.addEventListener('mousedown', (e) => { e.preventDefault(); fillCustomerData(li.dataset); hideSuggestionBox(box); }); ul.appendChild(li); }); } if (!box.contains(ul)) box.appendChild(ul); box.classList.add('active'); box.style.display = 'block'; const iR = inputElement.getBoundingClientRect(); box.style.position = 'absolute'; box.style.left = '0'; box.style.top = `${iR.height}px`; box.style.width = `${iR.width}px`; box.style.zIndex = '1000'; }
function fillCustomerData(customerData) { /* ... Same as v2.1 ... */ if (!customerData || !customerData.customerId) { resetCustomerSelectionUI(); return; } console.log("Filling customer data:", customerData); customerNameInput.value = customerData.customerName || ''; customerWhatsAppInput.value = customerData.customerWhatsapp || ''; customerAddressInput.value = customerData.customerAddress || ''; customerContactInput.value = customerData.customerContact || ''; selectedCustomerId = customerData.customerId; if (selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId; fetchAndDisplayCustomerDetails(selectedCustomerId); }
async function fetchAndDisplayCustomerDetails(customerId) { /* ... Same as v2.1 ... */ console.log("Fetching details:", customerId); resetCustomerSelectionUI(false); if (!customerId) return; try { let c = customerCache.find(c => c.id === customerId); if (!c) { const d = await getDoc(doc(db, "customers", customerId)); if (d.exists()) c = { id: d.id, ...d.data() }; else return; } selectedCustomerData = c; let b = 'N/A'; /* Needs calculateCustomerBalance(customerId) */ if(customerBalanceArea) { customerCurrentBalanceSpan.textContent = (b !== 'N/A') ? formatCurrency(b) : 'N/A'; customerCurrentBalanceSpan.classList.toggle('positive-balance', b < 0); customerBalanceArea.style.display = 'block'; } if(viewCustomerAccountLink && customerAccountLinkArea) { viewCustomerAccountLink.href = `customer_account_detail.html?id=${encodeURIComponent(customerId)}`; customerAccountLinkArea.style.display = 'block'; } checkCreditLimit(); } catch(e) { console.error(e); resetCustomerSelectionUI(); } }
function resetCustomerSelectionUI(clearInputs = true) { /* ... Same as v2.1 ... */ console.log("Resetting customer UI."); selectedCustomerId = null; selectedCustomerData = null; if (selectedCustomerIdInput) selectedCustomerIdInput.value = ''; if (customerAccountLinkArea) customerAccountLinkArea.style.display = 'none'; if (customerBalanceArea) customerBalanceArea.style.display = 'none'; if (customerCurrentBalanceSpan) customerCurrentBalanceSpan.textContent = ''; if (creditLimitWarningDiv) creditLimitWarningDiv.style.display = 'none'; if (clearInputs) { customerNameInput.value = ''; customerWhatsAppInput.value = ''; customerAddressInput.value = ''; customerContactInput.value = ''; } }

// --- Credit Limit Check ---
function checkCreditLimit() { /* ... Same as v2.1 ... */ if (!selectedCustomerData || !selectedCustomerData.creditAllowed) { if(creditLimitWarningDiv) creditLimitWarningDiv.style.display = 'none'; return; } const cl = parseFloat(selectedCustomerData.creditLimit || 0); const cbT = customerCurrentBalanceSpan?.textContent || '0'; const cb = parseFloat(cbT.replace(/[^0-9.-]+/g,"")) || 0; const faT = summaryFinalAmountSpan?.textContent || '0'; const nOV = parseFloat(faT) || 0; if (isNaN(cb) || isNaN(nOV)) { if(creditLimitWarningDiv) creditLimitWarningDiv.style.display = 'none'; return; } const pb = cb + nOV; console.log(`Credit Check: L=${cl}, CB=${cb}, NOV=${nOV}, PB=${pb}`); if (pb > cl) { if (creditLimitWarningDiv) { creditLimitWarningDiv.textContent = `Warning: Exceeds credit limit of ${formatCurrency(cl)}. Potential Balance: ${formatCurrency(pb)}.`; creditLimitWarningDiv.style.display = 'block'; } } else { if (creditLimitWarningDiv) creditLimitWarningDiv.style.display = 'none'; } }

// --- Product Autocomplete ---
// (Functions: getOrCreateProductSuggestionsDiv, positionProductSuggestions, hideProductSuggestions, handleProductSearchInput, getOrFetchProductCache, filterAndRenderProductSuggestions, renderProductSuggestions, selectProductSuggestion - Keep same as v2.1, uses salePrice/minSalePrice)
function getOrCreateProductSuggestionsDiv() { /* ... Same as v2.1 ... */ if (!productSuggestionsDiv) { productSuggestionsDiv = document.createElement('div'); productSuggestionsDiv.className = 'product-suggestions-list'; productSuggestionsDiv.style.display = 'none'; document.body.appendChild(productSuggestionsDiv); productSuggestionsDiv.addEventListener('mousedown', handleSuggestionMouseDown); } return productSuggestionsDiv; }
function positionProductSuggestions(inputElement) { /* ... Same as v2.1 ... */ const s=getOrCreateProductSuggestionsDiv(), r=inputElement.getBoundingClientRect(); s.style.position = 'absolute'; s.style.left = `${r.left + window.scrollX}px`; s.style.top = `${r.bottom + window.scrollY}px`; s.style.width = `${r.width < 250 ? 250 : r.width}px`; s.style.display = 'block'; s.style.zIndex = '1050'; }
function hideProductSuggestions() { /* ... Same as v2.1 ... */ if (productSuggestionsDiv) productSuggestionsDiv.style.display = 'none'; activeProductInput = null; }
function handleProductSearchInput(event) { /* ... Same as v2.1 ... */ const i = event.target; if (!i.matches('.product-name')) return; activeProductInput = i; clearTimeout(productSearchDebounceTimer); const t = i.value.trim(); if (t.length < 1) { hideProductSuggestions(); return; } positionProductSuggestions(i); productSearchDebounceTimer = setTimeout(() => { if (document.activeElement === i && activeProductInput === i) { getOrFetchProductCache().then(() => filterAndRenderProductSuggestions(t, i)).catch(e => console.error(e)); } }, 350); }
async function getOrFetchProductCache() { /* ... Same as v2.1 (fetches salePrice/minSalePrice) ... */ if (productCache.length > 0) return Promise.resolve(); if (productFetchPromise) return productFetchPromise; console.log("Fetching product data..."); try { if (!db || !collection || !query || !getDocs || !orderBy) throw new Error("Firestore functions unavailable."); const q = query(collection(db, "products"), orderBy("printName")); productFetchPromise = getDocs(q).then(s => { productCache = s.docs.map(d => { const dt = d.data(); return { id: d.id, name: dt.printName, unit: dt.unit, salePrice: dt.salePrice, minSalePrice: dt.minSalePrice }; }); console.log(`Cached ${productCache.length} products.`); productFetchPromise = null; }).catch(e => { console.error(e); productFetchPromise = null; throw e; }); return productFetchPromise; } catch (e) { console.error(e); productFetchPromise = null; return Promise.reject(e); } }
function filterAndRenderProductSuggestions(term, inputElement) { /* ... Same as v2.1 ... */ const s = getOrCreateProductSuggestionsDiv(); s.innerHTML = '<ul><li class="no-suggestions">Loading...</li></ul>'; if (activeProductInput !== inputElement) { hideProductSuggestions(); return; } positionProductSuggestions(inputElement); const l = term.toLowerCase(), f = productCache.filter(p => p.name?.toLowerCase().includes(l)).slice(0, 10); renderProductSuggestions(f, term, s); }
function renderProductSuggestions(suggestions, term, suggestionsContainer) { /* ... Same as v2.1 ... */ if (!suggestionsContainer) return; const ul = document.createElement('ul'); if (suggestions.length === 0) { ul.innerHTML = '<li class="no-suggestions">No matching products found.</li>'; } else { suggestions.forEach(p => { const li = document.createElement('li'); try { li.innerHTML = p.name.replace(new RegExp(`(${term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'), '<strong>$1</strong>'); } catch { li.textContent = p.name; } li.dataset.product = JSON.stringify(p); ul.appendChild(li); }); } suggestionsContainer.innerHTML = ''; suggestionsContainer.appendChild(ul); suggestionsContainer.style.display = 'block'; }
function selectProductSuggestion(productData, inputElement) { /* ... Same as v2.1 (uses salePrice/minSalePrice) ... */ const r = inputElement.closest('.item-row'); if (!r || !productData) { hideProductSuggestions(); return; } const pNI = r.querySelector('.product-name'), uTS = r.querySelector('.unit-type-select'), rI = r.querySelector('.rate-input'), qI = r.querySelector('.quantity-input'), mRVS = r.querySelector('.min-rate-value'); if (!pNI || !uTS || !rI || !qI || !mRVS) { hideProductSuggestions(); return; } pNI.value = productData.name || ''; rI.value = productData.salePrice !== undefined ? productData.salePrice : ''; const mR = productData.minSalePrice; mRVS.textContent = mR !== undefined && mR !== null ? parseFloat(mR).toFixed(2) : '--'; rI.dataset.minRate = mR !== undefined && mR !== null ? mR : '-1'; let dUT = 'Qty'; if (productData.unit) { const uL = productData.unit.toLowerCase(); if (uL.includes('sq') || uL.includes('ft')) dUT = 'Sq Feet'; } uTS.value = dUT; hideProductSuggestions(); const cE = new Event('change', { bubbles: true }); uTS.dispatchEvent(cE); let nI = null; if (dUT === 'Sq Feet') nI = r.querySelector('.width-input'); if (!nI) nI = qI; if (nI) { nI.focus(); if (typeof nI.select === 'function') nI.select(); } else rI.focus(); updateItemAmount(r); }

// --- Status Checkbox Handling ---
// (Functions: handleStatusCheckboxes, handleStatusChange - Keep same as v2.1)
function handleStatusCheckboxes(isEditing) { /* ... Same as v2.1 ... */ const dS = "Order Received"; let dC = null; orderStatusCheckboxes.forEach(c => { if (c.value === dS) dC = c; c.disabled = false; c.closest('label').classList.remove('disabled'); c.removeEventListener('change', handleStatusChange); c.addEventListener('change', handleStatusChange); }); const iAC = Array.from(orderStatusCheckboxes).some(c => c.checked); if (!isEditing && !iAC && dC) dC.checked = true; }
function handleStatusChange(event) { /* ... Same as v2.1 ... */ const cC = event.target; if (cC.checked) { orderStatusCheckboxes.forEach(oC => { if (oC !== cC) oC.checked = false; }); } }


// --- Form Submit Handler ---
async function handleFormSubmit(event) {
    // (Same as v2.1 - Includes detailed item saving and advance payment handling)
    event.preventDefault(); console.log("Form submission initiated (v2.1.1)..."); showFormError('');
    if (!db || !addDoc || !doc || !updateDoc || !Timestamp || !getDoc || !getDocs || !collection || !query || !limit) { showFormError("DB functions not ready."); return; }
    if (!saveButton) return; saveButton.disabled = true; if (saveButtonText) saveButtonText.textContent = isEditMode ? 'Updating...' : 'Saving...'; else saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        // --- 1. Gather Customer Data ---
        const customerFullName = customerNameInput.value.trim(); const customerWhatsApp = customerWhatsAppInput.value.trim(); let customerId = selectedCustomerId;
        if (!customerFullName) throw new Error("Customer Full Name required."); if (!customerWhatsApp) throw new Error("Customer WhatsApp No required.");
        const customerData = { fullName: customerFullName, whatsappNo: customerWhatsApp, address: customerAddressInput.value.trim() || '', contactNo: customerContactInput.value.trim() || '' };

        // --- 2. Gather Order Details ---
        const orderDateValue = orderDateInput.value; const deliveryDateValue = deliveryDateInput.value || ''; const urgentValue = orderForm.querySelector('input[name="urgent"]:checked')?.value || 'No'; const remarksValue = remarksInput.value.trim() || ''; const statusCheckbox = orderForm.querySelector('input[name="order_status"]:checked'); const selectedStatus = statusCheckbox ? statusCheckbox.value : 'Order Received';
        if (!orderDateValue) throw new Error("Order Date required.");

         // --- 3. Generate/Determine Order ID ---
         let orderId; const manualId = manualOrderIdInput.value.trim(); const existingId = displayOrderIdInput.value;
         if (isEditMode) { orderId = currentOrderData?.orderId || existingId || orderIdToEdit; }
         else if (manualId) { orderId = manualId; /* Optional: Check uniqueness */ }
         else { /* Replace with counter if needed */ orderId = Date.now().toString(); console.log(`Generated Order ID: ${orderId}`); }

        // --- 4. Gather Item Data ---
        const items = []; const rows = orderItemsTableBody.querySelectorAll('.item-row'); if (rows.length === 0) throw new Error("Add at least one item.");
        let valid = true;
        rows.forEach((row, index) => {
            if (!valid) return;
            const pNI = row.querySelector('.product-name'), uTS = row.querySelector('.unit-type-select'), qI = row.querySelector('.quantity-input'), rI = row.querySelector('.rate-input'), dUS = row.querySelector('.dimension-unit-select'), wI = row.querySelector('.width-input'), hI = row.querySelector('.height-input');
            const pN = pNI?.value.trim(), uT = uTS?.value, q = parseInt(qI?.value || 0), r = parseFloat(rI?.value || 0), mR = parseFloat(rI?.dataset.minRate || -1);
            if (!pN) { valid = false; showFormError(`Item ${index + 1}: Product Name required.`); pNI?.focus(); return; }
            if (isNaN(q) || q <= 0) { valid = false; showFormError(`Item ${index + 1}: Valid Quantity required.`); qI?.focus(); return; }
            if (isNaN(r) || r < 0) { valid = false; showFormError(`Item ${index + 1}: Valid Rate required.`); rI?.focus(); return; }
            if (mR >= 0 && r < mR) { valid = false; showFormError(`Item ${index + 1}: Rate (${formatCurrency(r)}) < Minimum (${formatCurrency(mR)}).`); rI?.focus(); return; }

            const iData = { productName: pN, unitType: uT, quantity: q, rate: r, minSalePrice: mR >= 0 ? mR : null };
            if (uT === 'Sq Feet') {
                const dU = dUS?.value || 'feet', w = parseFloat(wI?.value || 0), h = parseFloat(hI?.value || 0);
                if (isNaN(w) || w <= 0) { valid = false; showFormError(`Item ${index + 1}: Valid Width required.`); wI?.focus(); return; }
                if (isNaN(h) || h <= 0) { valid = false; showFormError(`Item ${index + 1}: Valid Height required.`); hI?.focus(); return; }
                const cR = calculateFlexDimensions(dU, w, h); iData.dimensionUnit = dU; iData.width = w; iData.height = h; iData.realSqFt = cR.realSqFt; iData.printSqFt = cR.printSqFt; iData.itemAmount = parseFloat((cR.printSqFt * q * r).toFixed(2));
            } else { iData.itemAmount = parseFloat((q * r).toFixed(2)); }
            items.push(iData); // Push validated item data
        });
        if (!valid) throw new Error("Please fix item errors.");

        // --- 5. Gather Summary Data & Recalculate ---
         let subT = 0; items.forEach(i => { subT += i.itemAmount; }); let dP = parseFloat(summaryDiscountPercentInput?.value || 0), dA = parseFloat(summaryDiscountAmountInput?.value || 0); let cDA = 0; if (!isNaN(dP) && dP > 0) cDA = parseFloat((subT * (dP / 100)).toFixed(2)); else if (!isNaN(dA) && dA > 0) cDA = dA; cDA = Math.max(0, Math.min(cDA, subT)); let fA = parseFloat((subT - cDA).toFixed(2)), aP = parseFloat(summaryAdvancePaymentInput?.value || 0), tB = parseFloat((fA - aP).toFixed(2));

        // --- 6. Prepare Firestore Payload ---
        const payload = { orderId: orderId, customerId: customerId || null, customerDetails: customerData, orderDate: orderDateValue, deliveryDate: deliveryDateValue, urgent: urgentValue, remarks: remarksValue, status: selectedStatus, items: items, subTotal: subT, discountPercentage: dP || 0, discountAmount: cDA || 0, finalAmount: fA, advancePayment: aP || 0, totalBalance: tB, updatedAt: Timestamp.now() };
        if (!isEditMode) payload.createdAt = Timestamp.now();

        // --- 7. Save to Firestore ---
        let savedId, msg;
        if (isEditMode) { if (!orderIdToEdit) throw new Error("Missing ID for update."); await updateDoc(doc(db, "orders", orderIdToEdit), payload); savedId = orderIdToEdit; msg = `Order ${orderId} updated!`; }
        else { const ref = await addDoc(collection(db, "orders"), payload); savedId = ref.id; msg = `Order ${orderId} created!`; displayOrderIdInput.value = orderId; }
        console.log(msg, "Doc ID:", savedId);

        // --- 8. Handle Advance Payment ---
        if (aP > 0) { console.log("Adding advance payment..."); try { const pData = { customerId: customerId, orderRefId: savedId, orderId: orderId, amountPaid: aP, paymentDate: Timestamp.fromDate(new Date(orderDateValue + 'T00:00:00')), paymentMethod: "Order Advance", notes: `Advance for Order #${orderId}`, createdAt: Timestamp.now() }; if (!pData.customerId) { alert("Order saved, but advance payment not recorded (Customer ID missing)."); } else { await addDoc(collection(db, "payments"), pData); console.log("Advance payment added."); } } catch (pE) { console.error("Adv payment error:", pE); alert(`Order saved, error recording advance: ${pE.message}`); } }

        // --- 9. Post-Save Actions ---
        alert(msg);
        if (customerData.whatsappNo) { showWhatsAppReminder(customerData, orderId, deliveryDateValue); }
        else { if (!isEditMode) resetNewOrderForm(); }

    } catch (error) { console.error("Submit error:", error); showFormError("Error: " + error.message); }
    finally { saveButton.disabled = false; const txt = isEditMode ? "Update Order" : "Save Order"; if (saveButtonText) saveButtonText.textContent = txt; else saveButton.innerHTML = `<i class="fas fa-save"></i> ${txt}`; }
}

// --- Reset Form ---
function resetNewOrderForm() {
    // (Same as v2.1)
     console.log("Resetting form."); orderForm.reset(); orderItemsTableBody.innerHTML = ''; selectedCustomerId = null; selectedCustomerData = null; currentOrderData = null; isEditMode = false; orderIdToEdit = null;
     if (hiddenEditOrderIdInput) hiddenEditOrderIdInput.value = ''; if (selectedCustomerIdInput) selectedCustomerIdInput.value = ''; if (headerText) headerText.textContent = "New Order"; if (breadcrumbAction) breadcrumbAction.textContent = "New Order"; if (saveButtonText) saveButtonText.textContent = "Save Order"; else if (saveButton) saveButton.innerHTML = `<i class="fas fa-save"></i> Save Order`; if (manualOrderIdInput) manualOrderIdInput.readOnly = false; if (orderDateInput) orderDateInput.value = new Date().toISOString().split('T')[0]; handleStatusCheckboxes(false); resetCustomerSelectionUI(true); updateOrderSummary(); handleAddItem(); showFormError(''); hideProductSuggestions(); hideSuggestionBox(customerSuggestionsNameBox); hideSuggestionBox(customerSuggestionsWhatsAppBox);
}

// --- WhatsApp Reminder Functions ---
// (Functions: showWhatsAppReminder, closeWhatsAppPopup - Keep same as v2.1)
function showWhatsAppReminder(customer, orderId, deliveryDate) { /* ... Same as v2.1 ... */ if (!whatsappReminderPopup || !whatsappMsgPreview || !whatsappSendLink) { if (!isEditMode) resetNewOrderForm(); return; } const cN = customer.fullName || 'Customer', cNum = customer.whatsappNo?.replace(/[^0-9]/g, ''); if (!cNum) { if (!isEditMode) resetNewOrderForm(); return; } const fDD = deliveryDate ? new Date(deliveryDate).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : ' जल्द से जल्द'; let msg = `प्रिय ${cN},\nआपका ऑर्डर (Order ID: ${orderId}) सफलतापूर्वक सहेज लिया गया है। डिलीवरी की अनुमानित तिथि: ${fDD}.\nधन्यवाद,\nMadhav Offset`; whatsappMsgPreview.innerText = msg; const eM = encodeURIComponent(msg); const wUrl = `https://wa.me/${cNum}?text=${eM}`; whatsappSendLink.href = wUrl; whatsappReminderPopup.classList.add('active'); whatsappSendLink.onclick = () => { if (!isEditMode) resetNewOrderForm(); closeWhatsAppPopup(); }; popupCloseBtn.onclick = () => { if (!isEditMode) resetNewOrderForm(); closeWhatsAppPopup(); }; whatsappReminderPopup.onclick = (e) => { if (e.target === whatsappReminderPopup) { if (!isEditMode) resetNewOrderForm(); closeWhatsAppPopup(); } }; }
function closeWhatsAppPopup() { /* ... Same as v2.1 ... */ if (whatsappReminderPopup) whatsappReminderPopup.classList.remove('active'); whatsappSendLink.onclick = null; popupCloseBtn.onclick = null; whatsappReminderPopup.onclick = null; if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (e) => { if (e.target === whatsappReminderPopup) closeWhatsAppPopup(); }); if (popupCloseBtn) popupCloseBtn.addEventListener('click', closeWhatsAppPopup); }

console.log("new_order.js script loaded (v2.1.1).");