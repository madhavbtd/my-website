// new_order.js
// Version: Combined updates + Delay Timer + Balance Display Fix + Initial Focus

// --- Delay Timer ---
const INITIALIZATION_DELAY = 1000; // milliseconds (1 second)
console.log(`new_order.js: Waiting ${INITIALIZATION_DELAY}ms before initializing...`);

// Wrap the entire initialization logic in a setTimeout
setTimeout(() => {
    console.log("new_order.js: Delay finished, proceeding with initialization.");

    // --- Firebase Functions ---
    const {
        db, collection, addDoc, doc, getDoc, getDocs, updateDoc, runTransaction,
        query, where, orderBy, limit, Timestamp, arrayUnion, serverTimestamp
    } = window;

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
    const customerFullNameInput = document.getElementById('full_name'); // <<< यह रहा नाम वाला इनपुट
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

    // --- Status Definitions ---
    const statusList = [
        "Order Received", "Designing", "Verification", "Design Approved",
        "Printing", "Ready for Working", "Delivered", "Completed"
    ];

    // --- Initialization Function ---
    function initializeAppLogic() {
        console.log("New Order DOM Loaded (Combined Updates + Delay + Focus). Initializing App Logic...");

        if (!orderForm || !addItemBtn || !orderItemsTableBody || !itemRowTemplate || !calculationPreviewArea || !calculationPreviewContent || !orderStatusSelect) {
            console.error("Critical DOM elements missing! Check HTML IDs.");
            alert("Page structure error. Cannot initialize order form.");
            return;
        }
        if (!db || !runTransaction || !collection) {
             console.error("DB functions still missing after delay!", {db: !!db, runTransaction: typeof runTransaction, collection: typeof collection});
             alert("DB Connection failed even after delay. Check HTML Firebase setup and console.");
             if(saveButton) saveButton.disabled = true;
             return;
        }
         console.log("DB functions confirmed available after delay.");

        // --- Event Listeners ---
        orderForm.addEventListener('submit', handleFormSubmit);
        addItemBtn.addEventListener('click', handleAddItem);
        orderItemsTableBody.addEventListener('click', handleItemTableClick);
        orderItemsTableBody.addEventListener('input', handleItemTableInput);
        orderItemsTableBody.addEventListener('change', handleItemTableChange);
        orderItemsTableBody.addEventListener('focusin', (event) => { if (event.target.matches('.product-name')) activeProductInput = event.target; });
        if (customerFullNameInput) { customerFullNameInput.addEventListener('input', (e) => handleCustomerInput(e, 'name')); customerFullNameInput.addEventListener('blur', () => setTimeout(() => { if(customerSuggestionsNameBox && !customerSuggestionsNameBox.matches(':hover')) hideSuggestionBox(customerSuggestionsNameBox); }, 150)); } else { console.warn("Customer name input not found."); }
        if (customerWhatsAppInput) { customerWhatsAppInput.addEventListener('input', (e) => handleCustomerInput(e, 'whatsapp')); customerWhatsAppInput.addEventListener('blur', () => setTimeout(() => { if(customerSuggestionsWhatsAppBox && !customerSuggestionsWhatsAppBox.matches(':hover')) hideSuggestionBox(customerSuggestionsWhatsAppBox); }, 150)); } else { console.warn("Customer whatsapp input not found."); }
        if (summaryDiscountPercentInput) summaryDiscountPercentInput.addEventListener('input', handleDiscountInput); else { console.warn("Discount % input not found."); }
        if (summaryDiscountAmountInput) summaryDiscountAmountInput.addEventListener('input', handleDiscountInput); else { console.warn("Discount Amount input not found."); }
        if (summaryAdvancePaymentInput) summaryAdvancePaymentInput.addEventListener('input', updateOrderSummary); else { console.warn("Advance Payment input not found."); }
        if (popupCloseBtn) popupCloseBtn.addEventListener('click', closeWhatsAppPopup);
        if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (event) => { if (event.target === whatsappReminderPopup) closeWhatsAppPopup(); });
        document.addEventListener('click', handleGlobalClick);
        orderStatusSelect.addEventListener('change', (event) => { updateStatusDropdownColor(event.target.value); });

        // --- Initialize Form ---
        initializeForm();
    }

    // --- Run Initialization ---
    initializeAppLogic();

    // --- Global Click Handler (for hiding suggestions) ---
    function handleGlobalClick(event) {
        if (productSuggestionsDiv && activeProductInput && !productSuggestionsDiv.contains(event.target) && event.target !== activeProductInput) { hideProductSuggestions(); }
        if (customerSuggestionsNameBox && customerNameInput && !customerSuggestionsNameBox.contains(event.target) && event.target !== customerNameInput) { hideSuggestionBox(customerSuggestionsNameBox); }
        if (customerSuggestionsWhatsAppBox && customerWhatsAppInput && !customerSuggestionsWhatsAppBox.contains(event.target) && event.target !== customerWhatsAppInput) { hideSuggestionBox(customerSuggestionsWhatsAppBox); }
    }

    // --- Helper Functions ---
    function hideSuggestionBox(box) { if(box){box.classList.remove('active');box.style.display='none';}}
    function formatCurrency(amount) { const n=Number(amount||0); return `₹${n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`; }
    function showFormError(message) { if(formErrorMsg){formErrorMsg.textContent=message;formErrorMsg.style.display=message?'block':'none';if(message)formErrorMsg.scrollIntoView({behavior:'smooth',block:'center'});}else if(message){alert(message);}}

    // --- Form Initialization Logic ---
    function initializeForm() {
        console.log("Running initializeForm...");
        const uP = new URLSearchParams(window.location.search);
        orderIdToEdit = uP.get('editOrderId');
        const customerIdFromUrl = uP.get('customerId');

        if (orderIdToEdit) {
            // --- Edit Mode ---
            isEditMode = true;
            console.log("Edit Mode:", orderIdToEdit);
            if (headerText) headerText.textContent = "Edit Order";
            if (breadcrumbAction) breadcrumbAction.textContent = "Edit Order";
            if (saveButtonText) saveButtonText.textContent = "Update Order";
            if (hiddenEditOrderIdInput) hiddenEditOrderIdInput.value = orderIdToEdit;
            if (manualOrderIdInput) manualOrderIdInput.readOnly = true; // Prevent changing ID in edit mode
            loadOrderForEdit(orderIdToEdit); // Load existing order data

        } else {
            // --- Add Mode ---
            isEditMode = false;
            console.log("Add Mode.");
            if (headerText) headerText.textContent = "New Order";
            if (breadcrumbAction) breadcrumbAction.textContent = "New Order";
            if (saveButtonText) saveButtonText.textContent = "Save Order";
            if (manualOrderIdInput) manualOrderIdInput.readOnly = false;
            if (displayOrderIdInput) displayOrderIdInput.value = ''; // Clear system ID display
            if (orderDateInput && !orderDateInput.value) orderDateInput.value = new Date().toISOString().split('T')[0]; // Default order date
            const defaultStatus = "Order Received"; // Default status
            if (orderStatusSelect) {
                orderStatusSelect.value = defaultStatus;
                updateStatusDropdownColor(defaultStatus);
            }
            resetCustomerSelectionUI(true); // Reset customer area

            // Handle customer pre-fill from URL
            if (customerIdFromUrl) {
                console.log("Customer ID found in URL for New Order:", customerIdFromUrl);
                selectedCustomerId = customerIdFromUrl;
                 if (selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId;
                fetchAndDisplayCustomerDetails(customerIdFromUrl).catch(e => {
                    console.error("Error pre-filling customer details from URL:", e);
                    showFormError("Could not automatically load details for the selected customer.");
                    resetCustomerSelectionUI(true);
                });
            }

            // Add first item row if table body is empty
            if (orderItemsTableBody && orderItemsTableBody.children.length === 0) {
                handleAddItem(); // Adds the first row
            } else if (!orderItemsTableBody) {
                console.error("Order items table body missing!");
            }
            updateOrderSummary(); // Initial summary calculation

            // <<< --- FOCUS SETTING --- >>>
            // Set focus to the Full Name input field after other setup
            if (customerFullNameInput) {
                customerFullNameInput.focus();
                console.log("Focus set to Full Name input.");
            }
            // <<< --- END OF FOCUS SETTING --- >>>

        } // End Add Mode else block

        preFetchCaches(); // Start fetching caches in background
    }

    // --- Pre-fetch Customer and Product Data ---
    function preFetchCaches() {
        console.log("Pre-fetching caches...");
        getOrFetchCustomerCache().catch(e => console.error("Customer cache pre-fetch error:", e));
        getOrFetchProductCache().catch(e => console.error("Product cache pre-fetch error:", e));
    }

    // --- Load Existing Order for Editing ---
    async function loadOrderForEdit(docId) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        console.log(`Loading order for edit: ${docId}`); showFormError(''); if(!db||!doc||!getDoc){showFormError("DB function error.");return;} try{ const r=doc(db,"orders",docId); const s=await getDoc(r); if(s.exists()){ currentOrderData=s.data(); console.log("Order data loaded for edit:",currentOrderData); selectedCustomerId = currentOrderData.customerId || currentOrderData.customerDetails?.customerId || null; if(selectedCustomerIdInput)selectedCustomerIdInput.value=selectedCustomerId || ''; customerNameInput.value = currentOrderData.customerName || currentOrderData.customerDetails?.fullName || ''; customerWhatsAppInput.value = currentOrderData.whatsappNo || currentOrderData.customerDetails?.whatsappNo || ''; customerAddressInput.value = currentOrderData.address || currentOrderData.customerDetails?.address || currentOrderData.customerDetails?.billingAddress || ''; customerContactInput.value = currentOrderData.contactNo || currentOrderData.customerDetails?.contactNo || ''; if(selectedCustomerId){ await fetchAndDisplayCustomerDetails(selectedCustomerId); } else { console.warn("Order loaded but customerId is missing/null in data."); resetCustomerSelectionUI(true); } displayOrderIdInput.value=currentOrderData.orderId||docId; manualOrderIdInput.value=currentOrderData.orderId||''; const primaryDate = currentOrderData.createdAt || currentOrderData.orderDate; orderDateInput.value = primaryDate?.toDate ? primaryDate.toDate().toISOString().split('T')[0] : (typeof primaryDate === 'string' ? primaryDate : ''); deliveryDateInput.value=currentOrderData.deliveryDate?.toDate ? currentOrderData.deliveryDate.toDate().toISOString().split('T')[0] : (typeof currentOrderData.deliveryDate === 'string' ? currentOrderData.deliveryDate : ''); remarksInput.value=currentOrderData.remarks||''; const uV=currentOrderData.urgent||'No'; const uR=orderForm.querySelector(`input[name="urgent"][value="${uV}"]`); if(uR)uR.checked=true; const loadedStatus = currentOrderData.status || "Order Received"; orderStatusSelect.value = loadedStatus; updateStatusDropdownColor(loadedStatus); if(!orderItemsTableBody){console.error("Item table body missing!");return;} orderItemsTableBody.innerHTML=''; const itemsToLoad = currentOrderData.items || currentOrderData.products || []; if(Array.isArray(itemsToLoad)){ itemsToLoad.forEach(i=>{ const itemDataForPopulation = { productId: i.productId, productName: i.productName || i.name, unitType: i.unitType || i.unit, quantity: i.quantity, rate: i.rate, minSalePrice: i.minSalePrice, dimensionUnit: i.dimensionUnit, width: i.width, height: i.height }; const nR=addItemRow(false); if(nR){ populateItemRow(nR, itemDataForPopulation); if (itemDataForPopulation.productId) { nR.dataset.productId = itemDataForPopulation.productId; } } else { console.error("Failed to add row for item:",i); } }); } if(orderItemsTableBody.children.length===0){handleAddItem();} if(summaryDiscountPercentInput)summaryDiscountPercentInput.value=currentOrderData.discountPercentage||''; if(summaryDiscountAmountInput)summaryDiscountAmountInput.value=currentOrderData.discountAmount||''; if(summaryAdvancePaymentInput) summaryAdvancePaymentInput.value = currentOrderData.advancePayment || ''; // Populate advance payment too
        updateOrderSummary(); } else { console.error("Order document not found for editing!"); showFormError("Error: The order you are trying to edit could not be found."); if(saveButton)saveButton.disabled=true; } } catch(e) { console.error("Error loading order for edit:",e); showFormError("Error loading order data: "+e.message); if(saveButton)saveButton.disabled=true; }
    }

    // --- Item Table Handling ---
    function handleAddItem() {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        if(!itemRowTemplate || !orderItemsTableBody){console.error("Template or body missing!");showFormError("Error: Page setup incomplete.");return;} const nR=addItemRow(true); if(nR){updateOrderSummary();}else{console.error("Failed adding item row.");}
    }
    function addItemRow(focus = true) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        if (!itemRowTemplate || !orderItemsTableBody) { console.error("addItemRow: Prerequisites missing!"); return null; } try { const tC = itemRowTemplate.content.cloneNode(true), nRE = tC.querySelector('.item-row'); if (!nRE) { console.error("Template is missing the .item-row element"); return null; } orderItemsTableBody.appendChild(nRE); const aR = orderItemsTableBody.lastElementChild; if (!aR || !aR.matches('.item-row')) { console.error("Failed to append or find the new row."); return null; } const uS = aR.querySelector('.unit-type-select'); if (uS) handleUnitTypeChange({ target: uS }); if (focus) { const firstInput = aR.querySelector('.product-name'); if (firstInput) firstInput.focus(); } return aR; } catch (e) { console.error("Error in addItemRow:", e); showFormError(`Error creating item row: ${e.message}`); return null; }
    }
    function populateItemRow(row, itemData) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        if(!row||!itemData){console.warn("populateItemRow called with invalid row or data.");return;} try{row.querySelector('.product-name').value=itemData.productName||'';row.querySelector('.unit-type-select').value=itemData.unitType||'Qty';row.querySelector('.quantity-input').value=itemData.quantity||1;const rI=row.querySelector('.rate-input');rI.value=itemData.rate!==undefined?String(itemData.rate):''; const mR=itemData.minSalePrice; if(rI) rI.dataset.minRate=mR!==undefined&&mR!==null?String(mR):'-1';if(itemData.unitType==='Sq Feet'){row.querySelector('.dimension-unit-select').value=itemData.dimensionUnit||'feet';row.querySelector('.width-input').value=itemData.width||'';row.querySelector('.height-input').value=itemData.height||'';}handleUnitTypeChange({target:row.querySelector('.unit-type-select')});updateItemAmount(row);}catch(e){console.error("Error populating item row:",e);}
    }
    function handleItemTableClick(event) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        if (event.target.closest('.delete-item-btn')) { const r=event.target.closest('.item-row'); if(r){ r.remove(); hideProductSuggestions(); updateOrderSummary(); updateCalculationPreview(); } }
    }
    function handleSuggestionClick(event) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        const pLI = event.target.closest('.product-suggestions-list li[data-product]'); const cLI = event.target.closest('.suggestions-box li[data-customer-id]'); if (pLI) { event.preventDefault(); try { const pD = JSON.parse(pLI.dataset.product || '{}'); if (activeProductInput) selectProductSuggestion(pD, activeProductInput); } catch (e) { console.error("Error parsing/selecting product suggestion:", e); } } else if (cLI) { event.preventDefault(); try { fillCustomerData(cLI.dataset); const b = cLI.closest('.suggestions-box'); if (b) hideSuggestionBox(b); } catch(e) { console.error("Error selecting customer suggestion:", e); } }
    }
    function handleItemTableInput(event) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        const t=event.target,r=t.closest('.item-row'); if(!r)return; if(t.matches('.product-name')){activeProductInput=t;handleProductSearchInput(event);}else if(t.matches('.quantity-input, .rate-input, .width-input, .height-input')){updateItemAmount(r);}
    }
    function handleItemTableChange(event){
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        const t=event.target,r=t.closest('.item-row'); if(!r)return; if(t.matches('.unit-type-select'))handleUnitTypeChange(event); else if(t.matches('.dimension-unit-select'))updateItemAmount(r);
    }

    // --- Item Amount & Dimension Calculations ---
    function calculateFlexDimensions(unit, width, height) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        const m=[3,4,5,6,8,10]; let w=(unit==='inches')?parseFloat(width||0)/12:parseFloat(width||0), h=(unit==='inches')?parseFloat(height||0)/12:parseFloat(height||0); if(isNaN(w)||isNaN(h)||w<=0||h<=0) return{realSqFt:0, printSqFt:0, realWidthFt:0, realHeightFt:0, printWidthFt:0, printHeightFt:0}; const r=w*h; let b={pW:0,pH:0,pS:Infinity}; const fW=m.find(x=>x>=w); let pW1=fW||w, pH1=h, S1=pW1*pH1; const fH=m.find(x=>x>=h); let pW2=w, pH2=fH||h, S2=pW2*pH2; if(S1<=S2){b.pW=pW1; b.pH=pH1; b.pS=S1;} else{b.pW=pW2; b.pH=pH2; b.pS=S2;} return{realSqFt:r.toFixed(2), printWidthFt:b.pW, printHeightFt:b.pH, printSqFt:b.pS.toFixed(2), realWidthFt: w, realHeightFt: h };
    }
    function handleUnitTypeChange(event) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        const r=event.target.closest('.item-row'); if(!r)return; const uT=event.target.value; const isSqFt = (uT === 'Sq Feet'); r.querySelectorAll('.sq-feet-input').forEach(e=>e.style.display = isSqFt ? '' : 'none'); r.closest('table')?.querySelectorAll('thead th.sq-feet-header').forEach(h=>h.classList.toggle('hidden-col',!isSqFt)); r.querySelector('.rate-input').placeholder = isSqFt ? 'Rate/SqFt' : 'Rate/Unit'; if(!isSqFt){r.querySelector('.width-input').value=''; r.querySelector('.height-input').value='';} updateItemAmount(r);
    }
    function updateItemAmount(row) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        if (!row) return; const uTS=row.querySelector('.unit-type-select'),aS=row.querySelector('.item-amount'),rI=row.querySelector('.rate-input'),qI=row.querySelector('.quantity-input'),mR=parseFloat(rI?.dataset.minRate||-1); let cA=0,rV=parseFloat(rI?.value||0),q=parseInt(qI?.value||1); if(isNaN(q)||q<1)q=1; try{rI.classList.remove('input-error');rI.title='';if(mR>=0&&rV<mR && Math.abs(rV - mR) > 0.001 ){rI.classList.add('input-error');rI.title=`Rate ${formatCurrency(rV)} is below Minimum ${formatCurrency(mR)}`;} if(uTS?.value==='Sq Feet'){const dUS=row.querySelector('.dimension-unit-select'),wI=row.querySelector('.width-input'),hI=row.querySelector('.height-input'); const u=dUS?.value||'feet',w=parseFloat(wI?.value||0),h=parseFloat(hI?.value||0); if(w>0&&h>0&&!isNaN(rV)&&rV>=0){const cR=calculateFlexDimensions(u,w,h);cA=parseFloat(cR.printSqFt||0)*q*rV;}}else{if(!isNaN(rV)&&rV>=0)cA=q*rV;}}catch(e){console.error("Error calculating item amount:",e);cA=0;} if(aS)aS.textContent=cA.toFixed(2); updateOrderSummary(); updateCalculationPreview();
    }

    // --- Calculation Preview & Order Summary ---
    function updateCalculationPreview() {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        if (!calculationPreviewArea || !calculationPreviewContent || !orderItemsTableBody) { return; } let entriesHTML = ''; const itemRows = orderItemsTableBody.querySelectorAll('.item-row'); let foundSqFt = false; itemRows.forEach((row, index) => { const unitTypeSelect = row.querySelector('.unit-type-select'); if (unitTypeSelect?.value === 'Sq Feet') { foundSqFt = true; const productNameInput = row.querySelector('.product-name'); const productName = productNameInput?.value.trim() || `Item ${index + 1}`; const dimensionUnitSelect = row.querySelector('.dimension-unit-select'); const widthInput = row.querySelector('.width-input'); const heightInput = row.querySelector('.height-input'); const quantityInput = row.querySelector('.quantity-input'); const unit = dimensionUnitSelect?.value || 'feet'; const width = parseFloat(widthInput?.value || 0); const height = parseFloat(heightInput?.value || 0); let quantity = parseInt(quantityInput?.value || 1); if (isNaN(quantity) || quantity < 1) quantity = 1; let entryContent = `<div class="item-preview-entry"><strong>${productName}:</strong><br>`; if (width > 0 && height > 0) { const calcResult = calculateFlexDimensions(unit, width, height); if (calcResult && parseFloat(calcResult.printSqFt) >= 0) { const realSqFtNum = parseFloat(calcResult.realSqFt); const printSqFtNum = parseFloat(calcResult.printSqFt); const wastageSqFt = (printSqFtNum - realSqFtNum); const tolerance = 0.01; let wastageDesc = (wastageSqFt > tolerance) ? `<span style="color: orange;">Wastage: ${wastageSqFt.toFixed(2)} sq ft/item</span>` : `<span style="color: green;">Wastage: ${wastageSqFt.toFixed(2)} sq ft/item</span>`; entryContent += `&nbsp; Qty: ${quantity}<br>`; entryContent += `&nbsp; Real: ${calcResult.realWidthFt?.toFixed(2) ?? '?'}ft x ${calcResult.realHeightFt?.toFixed(2) ?? '?'}ft = ${realSqFtNum.toFixed(2)} sq ft/item<br>`; entryContent += `&nbsp; Print: ${calcResult.printWidthFt.toFixed(2)}ft x ${calcResult.printHeightFt.toFixed(2)}ft = ${printSqFtNum.toFixed(2)} sq ft/item<br>`; entryContent += `&nbsp; Total Print Area: ${(printSqFtNum * quantity).toFixed(2)} sq ft<br>`; entryContent += `&nbsp; ${wastageDesc}`; } else { entryContent += `&nbsp; <span style="color:orange;">Invalid dimensions or calculation error.</span>`; } } else { entryContent += `&nbsp; <span style="color:grey;">Enter valid width & height for calculation.</span>`; } entryContent += `</div>`; entriesHTML += entryContent; } }); if (foundSqFt) { calculationPreviewContent.innerHTML = entriesHTML || '<p style="color:grey;">Enter dimensions for Sq Ft items.</p>'; calculationPreviewArea.style.display = 'block'; } else { calculationPreviewArea.style.display = 'none'; }
    }
    function updateOrderSummary() {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        let s=0; if(orderItemsTableBody) orderItemsTableBody.querySelectorAll('.item-row .item-amount').forEach(sp=>s+=parseFloat(sp.textContent||0)); let dP=parseFloat(summaryDiscountPercentInput?.value||0),dA=parseFloat(summaryDiscountAmountInput?.value||0),cDA=0; const activeEl = document.activeElement; if(!isDiscountInputProgrammaticChange){if(activeEl===summaryDiscountPercentInput&&!isNaN(dP)){cDA=s*(dP/100); isDiscountInputProgrammaticChange=true; if(summaryDiscountAmountInput) summaryDiscountAmountInput.value=cDA.toFixed(2); isDiscountInputProgrammaticChange=false;}else if(activeEl===summaryDiscountAmountInput&&!isNaN(dA)){cDA=dA; if(s>0){const cP=(cDA/s)*100; isDiscountInputProgrammaticChange=true; if(summaryDiscountPercentInput) summaryDiscountPercentInput.value=cP.toFixed(2); isDiscountInputProgrammaticChange=false;}else{isDiscountInputProgrammaticChange=true; if(summaryDiscountPercentInput) summaryDiscountPercentInput.value=''; isDiscountInputProgrammaticChange=false;}}else{if(!isNaN(dP)&&dP>0)cDA=s*(dP/100); else if(!isNaN(dA)&&dA>0)cDA=dA; else cDA=0;}} cDA=Math.max(0,Math.min(cDA,s)); const fA=s-cDA,aP=parseFloat(summaryAdvancePaymentInput?.value||0),tB=fA-aP; if(summarySubtotalSpan)summarySubtotalSpan.textContent=s.toFixed(2); if(summaryFinalAmountSpan)summaryFinalAmountSpan.textContent=fA.toFixed(2); if(summaryTotalBalanceSpan)summaryTotalBalanceSpan.textContent=tB.toFixed(2); checkCreditLimit();
    }
    function handleDiscountInput(event) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        if(isDiscountInputProgrammaticChange)return; const cI=event.target; isDiscountInputProgrammaticChange=true; if(cI===summaryDiscountPercentInput){if(summaryDiscountAmountInput)summaryDiscountAmountInput.value='';}else if(cI===summaryDiscountAmountInput){if(summaryDiscountPercentInput)summaryDiscountPercentInput.value='';} isDiscountInputProgrammaticChange=false; updateOrderSummary();
    }

    // --- Customer Search, Cache, and Selection ---
    async function getOrFetchCustomerCache() {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        if(customerCache.length>0)return Promise.resolve(); if(customerFetchPromise)return customerFetchPromise; console.log("Fetching customers..."); try{if(!db||!collection||!query||!getDocs||!orderBy)throw new Error("DB function missing"); const q=query(collection(db,"customers"),orderBy("fullName")); customerFetchPromise=getDocs(q).then(s=>{customerCache=s.docs.map(d=>({id:d.id,...d.data()})); console.log(`Cached ${customerCache.length} customers.`); customerFetchPromise=null;}).catch(e=>{console.error(e);customerFetchPromise=null;throw e;}); return customerFetchPromise;}catch(e){console.error(e);customerFetchPromise=null;return Promise.reject(e);}
    }
    function handleCustomerInput(event, type) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        const i=event.target,t=i.value.trim(),b=type==='name'?customerSuggestionsNameBox:customerSuggestionsWhatsAppBox; if(!b)return; if(t.length<1){clearTimeout(customerSearchDebounceTimer); hideSuggestionBox(b); selectedCustomerId = null; if(selectedCustomerIdInput) selectedCustomerIdInput.value = ''; resetCustomerSelectionUI(false); return;} clearTimeout(customerSearchDebounceTimer); customerSearchDebounceTimer=setTimeout(()=>{getOrFetchCustomerCache().then(()=>filterAndRenderCustomerSuggestions(t,type,b,i)).catch(e=>console.error(e));},300);
    }
    function filterAndRenderCustomerSuggestions(term, type, box, inputElement) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        const l=term.toLowerCase(), f=type==='name'?'fullNameLower':'whatsappNo'; // Use fullNameLower for name search
        const d=customerCache.filter(c=>String(c[f]||(type === 'name' ? c.fullName : '')||'').toLowerCase().includes(l)).slice(0,10); renderCustomerSuggestions(d,term,box,inputElement);
    }
    function renderCustomerSuggestions(suggestions, term, box, inputElement) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        if(!box)return; const ul=box.querySelector('ul')||document.createElement('ul'); ul.innerHTML=''; if(suggestions.length===0){ul.innerHTML='<li class="no-suggestions">No matching customers found.</li>';}else{suggestions.forEach(c=>{const li=document.createElement('li'); const dN=`${c.fullName} (${c.whatsappNo})`; try{li.innerHTML=dN.replace(new RegExp(`(${term.replace(/[-\/\^$*+?.()|[\]{}]/g,'\$&')})`,'gi'),'<strong>$1</strong>');}catch{li.textContent=dN;} li.dataset.customerId=c.id; li.dataset.customerName=c.fullName; li.dataset.customerWhatsapp=c.whatsappNo; li.dataset.customerAddress=c.billingAddress||c.address||''; li.dataset.customerContact=c.contactNo||''; ul.appendChild(li);});} if(!box.contains(ul))box.appendChild(ul); box.classList.add('active'); box.style.display='block'; const iR=inputElement.getBoundingClientRect(); box.style.position='absolute'; box.style.left='0'; box.style.top=`${iR.height}px`; box.style.width=`${iR.width}px`; box.style.zIndex='1000'; box.removeEventListener('click', handleSuggestionClick); box.addEventListener('click', handleSuggestionClick);
    }
    function fillCustomerData(customerData) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        if (!customerData || !customerData.customerId) { console.warn("fillCustomerData called with invalid data or missing customerId."); resetCustomerSelectionUI(true); return; } console.log("Filling customer data for ID:", customerData.customerId); customerNameInput.value = customerData.customerName || ''; customerWhatsAppInput.value = customerData.customerWhatsapp || ''; customerAddressInput.value = customerData.customerAddress || ''; customerContactInput.value = customerData.customerContact || ''; selectedCustomerId = customerData.customerId; if (selectedCustomerIdInput) { selectedCustomerIdInput.value = selectedCustomerId; } else { console.error("Hidden input selectedCustomerId not found!"); } fetchAndDisplayCustomerDetails(selectedCustomerId).catch(e => { console.error("Error during fetchAndDisplayCustomerDetails after fill:", e); showFormError("Could not load customer balance details."); });
    }

    // --- Fetch Customer Details & Balance ---
    async function fetchAndDisplayCustomerDetails(customerId) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        if (!customerId) { console.warn("fetchAndDisplayCustomerDetails called without customerId."); resetCustomerSelectionUI(true); return; } try { let c = customerCache.find(cust => cust.id === customerId); if (!c) { console.log(`Customer ${customerId} not in cache, fetching from DB...`); const customerDoc = await getDoc(doc(db, "customers", customerId)); if (customerDoc.exists()) { c = { id: customerDoc.id, ...customerDoc.data() }; } else { console.warn("Customer not found in DB:", customerId); showFormError(`Selected customer (ID: ${customerId.substring(0,6)}...) not found in database. Please check selection or add as new customer.`); resetCustomerSelectionUI(true); return; } } selectedCustomerData = c; if(!customerNameInput.value && c.fullName) customerNameInput.value = c.fullName; if(!customerWhatsAppInput.value && c.whatsappNo) customerWhatsAppInput.value = c.whatsappNo; if(!customerAddressInput.value && (c.billingAddress || c.address)) customerAddressInput.value = c.billingAddress || c.address; if(!customerContactInput.value && c.contactNo) customerContactInput.value = c.contactNo; let balanceText = 'Calculating...'; let balanceNum = NaN; let initialBalanceFetchError = false; if(customerBalanceArea && customerCurrentBalanceSpan){ customerCurrentBalanceSpan.textContent = balanceText; customerCurrentBalanceSpan.classList.remove('positive-balance', 'negative-balance', 'zero-balance'); customerBalanceArea.style.display = 'block'; } try { const totalPaid = await loadPaymentTotals_NewOrder(customerId); const totalOrderValue = await loadOrderTotals_NewOrder(customerId); if (totalOrderValue !== 'N/A') { balanceNum = Number(totalOrderValue) - Number(totalPaid); } else if (totalPaid > 0) { balanceNum = -totalPaid; balanceText = `(Paid: ${formatCurrency(totalPaid)})`; } else { balanceNum = 0; } } catch (calcError) { console.error("Error calculating balance:", calcError); balanceText = 'Error'; balanceNum = NaN; initialBalanceFetchError = true; } if(customerBalanceArea && customerCurrentBalanceSpan){ let displayValue = 'Error'; let balanceClass = ''; let titleText = `Balance: ${balanceText}`; customerCurrentBalanceSpan.classList.remove('positive-balance', 'negative-balance', 'zero-balance'); if (!isNaN(balanceNum)) { const tolerance = 0.01; if (balanceNum > tolerance) { balanceClass = 'negative-balance'; displayValue = "-" + formatCurrency(balanceNum); titleText = `Due: ${formatCurrency(balanceNum)}`; } else if (balanceNum < -tolerance) { balanceClass = 'positive-balance'; displayValue = formatCurrency(Math.abs(balanceNum)); titleText = `Credit: ${formatCurrency(Math.abs(balanceNum))}`; } else { balanceClass = 'zero-balance'; displayValue = formatCurrency(0); titleText = 'Zero Balance'; } customerCurrentBalanceSpan.textContent = displayValue; if (balanceClass) customerCurrentBalanceSpan.classList.add(balanceClass); } else { customerCurrentBalanceSpan.textContent = balanceText; } customerCurrentBalanceSpan.title = titleText; customerBalanceArea.style.display = 'block'; } if(viewCustomerAccountLink && customerAccountLinkArea){ viewCustomerAccountLink.href = `customer_account_detail.html?id=${encodeURIComponent(customerId)}`; customerAccountLinkArea.style.display = 'block'; } checkCreditLimit(initialBalanceFetchError ? NaN : balanceNum); } catch (e) { console.error("Error in fetchAndDisplayCustomerDetails:", e); resetCustomerSelectionUI(true); }
    }
    function resetCustomerSelectionUI(clearInputs = true) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        selectedCustomerData = null; if(customerAccountLinkArea) customerAccountLinkArea.style.display = 'none'; if(customerBalanceArea) customerBalanceArea.style.display = 'none'; if(customerCurrentBalanceSpan) customerCurrentBalanceSpan.textContent = ''; if(creditLimitWarningDiv) creditLimitWarningDiv.style.display = 'none'; if (clearInputs) { if(customerNameInput) customerNameInput.value = ''; if(customerWhatsAppInput) customerWhatsAppInput.value = ''; if(customerAddressInput) customerAddressInput.value = ''; if(customerContactInput) customerContactInput.value = ''; if(selectedCustomerIdInput) selectedCustomerIdInput.value = ''; selectedCustomerId = null; }
    }
    function checkCreditLimit(currentBalanceNum = NaN) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        if (!selectedCustomerData || !selectedCustomerData.creditAllowed) { if(creditLimitWarningDiv) creditLimitWarningDiv.style.display = 'none'; return; } const creditLimit = parseFloat(selectedCustomerData.creditLimit || 0); const finalAmountText = summaryFinalAmountSpan?.textContent || '0'; const newOrderValue = parseFloat(finalAmountText.replace(/[^0-9.-]+/g,"")) || 0; if (isNaN(currentBalanceNum) || isNaN(newOrderValue) || creditLimit <= 0) { if(creditLimitWarningDiv) creditLimitWarningDiv.style.display = 'none'; return; } const potentialBalance = currentBalanceNum + newOrderValue; if (potentialBalance > creditLimit) { if(creditLimitWarningDiv) { creditLimitWarningDiv.textContent = `Warning: Potential balance (${formatCurrency(potentialBalance)}) exceeds credit limit of ${formatCurrency(creditLimit)}.`; creditLimitWarningDiv.style.display = 'block'; } } else { if(creditLimitWarningDiv) creditLimitWarningDiv.style.display = 'none'; }
    }

    // --- Product Search, Cache, and Selection ---
    function getOrCreateProductSuggestionsDiv() {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        if (!productSuggestionsDiv) { productSuggestionsDiv = document.createElement('div'); productSuggestionsDiv.className = 'product-suggestions-list'; productSuggestionsDiv.style.display = 'none'; document.body.appendChild(productSuggestionsDiv); productSuggestionsDiv.addEventListener('click', handleSuggestionClick); } return productSuggestionsDiv;
    }
    function positionProductSuggestions(inputElement) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        const s=getOrCreateProductSuggestionsDiv(), r=inputElement.getBoundingClientRect(); s.style.position='absolute'; s.style.left=`${r.left+window.scrollX}px`; s.style.top=`${r.bottom+window.scrollY}px`; s.style.width=`${r.width<250?250:r.width}px`; s.style.display='block'; s.style.zIndex='1050';
    }
    function hideProductSuggestions() {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        if(productSuggestionsDiv)productSuggestionsDiv.style.display='none'; activeProductInput=null;
    }
    function handleProductSearchInput(event) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        const i=event.target; if(!i.matches('.product-name'))return; activeProductInput=i; clearTimeout(productSearchDebounceTimer); const t=i.value.trim(); if(t.length<1){hideProductSuggestions();return;} positionProductSuggestions(i); productSearchDebounceTimer=setTimeout(()=>{if(document.activeElement===i&&activeProductInput===i){getOrFetchProductCache().then(()=>filterAndRenderProductSuggestions(t,i)).catch(e=>console.error("Prod filter err:",e));}},350);
    }
    async function getOrFetchProductCache() {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        if(productCache.length>0)return Promise.resolve(); if(productFetchPromise)return productFetchPromise; console.log("Fetching products..."); try{if(!db||!collection||!query||!getDocs||!orderBy)throw new Error("DB func missing"); const q=query(collection(db,"products"),orderBy("printName")); productFetchPromise=getDocs(q).then(s=>{productCache=s.docs.map(d=>{const dt=d.data(); return{id:d.id,name:dt.printName,unit:dt.unit,salePrice:dt.salePrice,minSalePrice:dt.minSalePrice};}); productFetchPromise=null;}).catch(e=>{console.error("Prod fetch err:",e);productFetchPromise=null;throw e;}); return productFetchPromise;}catch(e){console.error("Prod fetch setup err:",e);productFetchPromise=null;return Promise.reject(e);}
    }
    function filterAndRenderProductSuggestions(term, inputElement) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        const s=getOrCreateProductSuggestionsDiv(); s.innerHTML='<ul><li class="no-suggestions">Loading...</li></ul>'; if(activeProductInput!==inputElement){hideProductSuggestions();return;} positionProductSuggestions(inputElement); const l=term.toLowerCase(), f=productCache.filter(p=>p.name?.toLowerCase().includes(l)).slice(0,10); renderProductSuggestions(f,term,s);
    }
    function renderProductSuggestions(suggestions, term, suggestionsContainer) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        if(!suggestionsContainer)return; const ul=document.createElement('ul'); if(suggestions.length===0){ul.innerHTML='<li class="no-suggestions">No matching products found.</li>';}else{suggestions.forEach(p=>{const li=document.createElement('li'); try{li.innerHTML=p.name.replace(new RegExp(`(${term.replace(/[-\/\^$*+?.()|[\]{}]/g,'\$&')})`,'gi'),'<strong>$1</strong>');}catch{li.textContent=p.name;} li.dataset.product=JSON.stringify(p); ul.appendChild(li);});} suggestionsContainer.innerHTML=''; suggestionsContainer.appendChild(ul); suggestionsContainer.style.display='block';
    }
    function selectProductSuggestion(productData, inputElement) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        try { const r = inputElement.closest('.item-row'); if (!r || !productData || !productData.id) { console.error("Row or productData or productData.id missing in selectProductSuggestion"); hideProductSuggestions(); return; } r.dataset.productId = productData.id; const pNI = r.querySelector('.product-name'), uTS = r.querySelector('.unit-type-select'), rI = r.querySelector('.rate-input'), qI = r.querySelector('.quantity-input'); if (!pNI || !uTS || !rI || !qI ) { console.error("Error in selectProductSuggestion: Row elements missing!"); hideProductSuggestions(); return; } pNI.value = productData.name || ''; rI.value = productData.salePrice !== undefined ? String(productData.salePrice) : ''; const mR = productData.minSalePrice; rI.dataset.minRate = mR !== undefined && mR !== null ? String(mR) : '-1'; let dUT = 'Qty'; if (productData.unit) { const uL = String(productData.unit).toLowerCase(); if (uL.includes('sq') || uL.includes('ft') || uL.includes('feet')) dUT = 'Sq Feet'; } uTS.value = dUT; hideProductSuggestions(); const changeEvent = new Event('change', { bubbles: true }); uTS.dispatchEvent(changeEvent); updateItemAmount(r); let nextInput = null; if (dUT === 'Sq Feet') nextInput = r.querySelector('.width-input'); if (!nextInput) nextInput = qI; if (nextInput) { nextInput.focus(); if (typeof nextInput.select === 'function') nextInput.select(); } else { rI.focus(); } } catch (error) { console.error("Error inside selectProductSuggestion:", error); hideProductSuggestions(); }
    }

    // --- Status Dropdown Color ---
    function updateStatusDropdownColor(statusValue) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        if (!orderStatusSelect) return; statusList.forEach(status => { const className = `status-select-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; orderStatusSelect.classList.remove(className); }); orderStatusSelect.classList.remove('status-select-default'); if (statusValue) { const currentClassName = `status-select-${statusValue.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; orderStatusSelect.classList.add(currentClassName); } else { orderStatusSelect.classList.add('status-select-default'); }
    }

    // --- ID Generation ---
    async function getNextIdWithPrefix(counterName, prefix = '', startId = 101) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        if (!db || !doc || !runTransaction) throw new Error("Firestore functions (db, doc, runTransaction) not available for counter."); const counterRef = doc(db, "counters", counterName); try { const nextIdNum = await runTransaction(db, async (transaction) => { const counterDoc = await transaction.get(counterRef); let nextId = startId; if (counterDoc.exists() && counterDoc.data().lastId) { const lastId = Number(counterDoc.data().lastId); if (!isNaN(lastId)) { nextId = lastId + 1; } else { console.warn(`Counter '${counterName}' lastId is not a number (${counterDoc.data().lastId}). Resetting to startId.`); nextId = startId; } } else { console.log(`Counter '${counterName}' not found or lastId missing, starting at ${startId}.`); } transaction.set(counterRef, { lastId: nextId }, { merge: true }); return nextId; }); return prefix ? `${prefix}${nextIdNum}` : nextIdNum; } catch (error) { console.error(`Error getting next ID for ${counterName}:`, error); throw new Error(`Failed to generate ID for ${counterName}. Error: ${error.message}`); }
    }

    // --- Form Submission ---
    async function handleFormSubmit(event) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        event.preventDefault(); console.log("Submit initiated (Combined Updates)..."); showFormError(''); if (!db || !addDoc || !doc || !updateDoc || !Timestamp || !getDoc || !getDocs || !collection || !query || !limit || typeof window.serverTimestamp !== 'function' || typeof window.arrayUnion !== 'function') { showFormError("Database functions unavailable."); console.error("Missing Firestore functions..."); return; } if (!saveButton) { console.error("Save button element missing!"); return; } saveButton.disabled = true; const originalButtonText = saveButtonText ? saveButtonText.textContent : (isEditMode ? 'Update Order' : 'Save Order'); const originalButtonHTML = saveButton.innerHTML; if (saveButtonText) saveButtonText.textContent = isEditMode ? 'Updating...' : 'Saving...'; else saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; try { const cFN = customerNameInput.value.trim(); const cW = customerWhatsAppInput.value.trim(); let cId = selectedCustomerId; if (!cFN) throw new Error("Customer Name is required."); if (!cW) throw new Error("WhatsApp No is required."); if (!cId) { cId = selectedCustomerIdInput?.value || null; if (!cId) { throw new Error("Customer is not selected or linked properly."); } console.warn("Used customerId from hidden input as fallback:", cId); selectedCustomerId = cId; } console.log('Proceeding to save order with customerId:', cId); const cD = { fullName: cFN, whatsappNo: cW, address: customerAddressInput.value.trim() || '', contactNo: customerContactInput.value.trim() || '' }; const oDV = orderDateInput.value; const dDV = deliveryDateInput.value || ''; const uV = orderForm.querySelector('input[name="urgent"]:checked')?.value || 'No'; const rV = remarksInput.value.trim() || ''; const sS = orderStatusSelect.value; if (!oDV) throw new Error("Order Date is required."); let oId; const mId = manualOrderIdInput.value.trim(); const eId = displayOrderIdInput.value; if (isEditMode) { oId = currentOrderData?.orderId || eId || orderIdToEdit; if (!oId) throw new Error("Internal Error: Missing Order ID for update."); console.log(`Using existing Order ID for update: ${oId}`); } else if (mId) { oId = mId; console.log(`Using provided Manual Order ID: ${oId}`); if(displayOrderIdInput) displayOrderIdInput.value = oId; } else { try { oId = await getNextIdWithPrefix("orderCounter", "MM-", 1001); console.log(`Generated automatic Order ID for manual order: ${oId}`); if(displayOrderIdInput) displayOrderIdInput.value = oId; } catch (idError) { console.error("Error generating Order ID:", idError); showFormError(`Failed to generate automatic Order ID: ${idError.message}`); throw idError; } } const items = []; const rows = orderItemsTableBody.querySelectorAll('.item-row'); if (rows.length === 0) throw new Error("Please add at least one item to the order."); let validItems = true; rows.forEach((row, idx) => { if (!validItems) return; const pNI = row.querySelector('.product-name'); const uTS = row.querySelector('.unit-type-select'); const qI = row.querySelector('.quantity-input'); const rI = row.querySelector('.rate-input'); const dUS = row.querySelector('.dimension-unit-select'); const wI = row.querySelector('.width-input'); const hI = row.querySelector('.height-input'); const productId = row.dataset.productId || null; const pN = pNI?.value.trim(); const uT = uTS?.value; const q = parseInt(qI?.value || 0); const r = parseFloat(rI?.value || ''); const mR = parseFloat(rI?.dataset.minRate || -1); if (!pN) { validItems = false; showFormError(`Item ${idx + 1}: Product Name required.`); pNI?.focus(); return; } if (isNaN(q) || q <= 0) { validItems = false; showFormError(`Item ${idx + 1}: Valid Quantity required.`); qI?.focus(); return; } if (isNaN(r) || r < 0) { validItems = false; showFormError(`Item ${idx + 1}: Valid Rate required (must be 0 or more).`); rI?.focus(); return; } if (mR >= 0 && r < mR && Math.abs(r - mR) > 0.001) { validItems = false; showFormError(`Item ${idx + 1}: Rate ${formatCurrency(r)} is below Minimum Sale Price (${formatCurrency(mR)}).`); rI?.focus(); return; } const iD = { productId: productId, productName: pN, unitType: uT, quantity: q, rate: r, minSalePrice: mR >= 0 ? mR : null }; if (uT === 'Sq Feet') { const dU = dUS?.value || 'feet'; const w = parseFloat(wI?.value || 0); const h = parseFloat(hI?.value || 0); if (isNaN(w) || w <= 0) { validItems = false; showFormError(`Item ${idx + 1}: Valid Width required.`); wI?.focus(); return; } if (isNaN(h) || h <= 0) { validItems = false; showFormError(`Item ${idx + 1}: Valid Height required.`); hI?.focus(); return; } const cR = calculateFlexDimensions(dU, w, h); iD.dimensionUnit = dU; iD.width = w; iD.height = h; iD.realSqFt = cR.realSqFt; iD.printSqFt = cR.printSqFt; iD.itemAmount = parseFloat((parseFloat(cR.printSqFt || 0) * q * r).toFixed(2)); } else { iD.itemAmount = parseFloat((q * r).toFixed(2)); } items.push(iD); }); if (!validItems) { throw new Error("Please fix item errors."); } let subT = 0; items.forEach(i => { subT += (i.itemAmount || 0); }); let dP = parseFloat(summaryDiscountPercentInput?.value || 0); let dA = parseFloat(summaryDiscountAmountInput?.value || 0); let cDA = 0; if (!isNaN(dP) && dP > 0) { cDA = parseFloat((subT * (dP / 100)).toFixed(2)); } else if (!isNaN(dA) && dA > 0) { cDA = dA; if (subT > 0) dP = parseFloat(((cDA / subT) * 100).toFixed(2)); else dP = 0; } cDA = Math.max(0, Math.min(cDA, subT)); let finalAmount = parseFloat((subT - cDA).toFixed(2)); let aP = parseFloat(summaryAdvancePaymentInput?.value || 0); const payload = { orderId: oId, customerId: cId, customerDetails: cD, orderDate: Timestamp.fromDate(new Date(oDV + 'T00:00:00')), deliveryDate: dDV ? Timestamp.fromDate(new Date(dDV + 'T00:00:00')) : null, urgent: uV, remarks: rV, status: sS, items: items, subTotal: subT, discountPercentage: dP || 0, discountAmount: cDA, totalAmount: finalAmount, finalAmount: finalAmount, updatedAt: serverTimestamp() }; let savedId, msg; if (isEditMode) { if (!orderIdToEdit) throw new Error("Internal Error: Missing Firestore Document ID for update."); delete payload.createdAt; if (currentOrderData && sS !== currentOrderData.status) { const historyUpdate = { status: sS, timestamp: serverTimestamp() }; payload.statusHistory = arrayUnion(historyUpdate); } else { delete payload.statusHistory; } payload.orderSource = currentOrderData?.orderSource || 'Manual'; payload.advancePayment = aP || 0; // Save advance payment for edits too
            await updateDoc(doc(db, "orders", orderIdToEdit), payload); savedId = orderIdToEdit; msg = `Order ${oId} updated successfully!`; } else { payload.createdAt = serverTimestamp(); payload.statusHistory = [{ status: sS, timestamp: Timestamp.now() }]; payload.orderSource = 'Manual'; payload.advancePayment = aP || 0; // Save advance payment for new orders
            const orderDocRef = await addDoc(collection(db, "orders"), payload); savedId = orderDocRef.id; msg = `Order ${oId} created successfully!`; if(displayOrderIdInput) displayOrderIdInput.value = oId; } console.log(msg, "Firestore Doc ID:", savedId); if (aP > 0 && !isEditMode) { console.log(`Advance payment amount entered: ${aP}. Creating payment record...`); try { const paymentData = { customerId: cId, orderRefId: savedId, orderId: oId, amountPaid: aP, paymentDate: serverTimestamp(), paymentMethod: "Order Advance", notes: `Advance payment for Order #${oId}`, createdAt: serverTimestamp() }; const paymentDocRef = await addDoc(collection(db, "payments"), paymentData); console.log(`Advance payment record added successfully. Payment Doc ID: ${paymentDocRef.id}`); } catch (paymentError) { console.error("Error saving advance payment record:", paymentError); alert(`Order ${oId} was saved successfully, but there was an error recording the advance payment: ${paymentError.message}\n\nPlease add the payment manually later.`); } } alert(msg); if (cD.whatsappNo) { showWhatsAppReminder(cD, oId, deliveryDateInput.value); } else { if (!isEditMode) { resetNewOrderForm(); } else { window.location.href = `order_history.html?highlightOrderId=${orderIdToEdit || ''}`; } } } catch (error) { console.error("Form submission failed:", error); showFormError("Error saving order: " + error.message); } finally { saveButton.disabled = false; if (saveButtonText) saveButtonText.textContent = originalButtonText; else saveButton.innerHTML = originalButtonHTML; }
    }

    // --- Reset Form ---
    function resetNewOrderForm() {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        console.log("Resetting form for new order."); orderForm.reset(); if(orderItemsTableBody) orderItemsTableBody.innerHTML=''; selectedCustomerId=null; selectedCustomerData=null; currentOrderData=null; isEditMode=false; orderIdToEdit=null; if(hiddenEditOrderIdInput)hiddenEditOrderIdInput.value=''; if(selectedCustomerIdInput)selectedCustomerIdInput.value=''; if(displayOrderIdInput) displayOrderIdInput.value = ''; if(manualOrderIdInput) manualOrderIdInput.value = ''; if(headerText)headerText.textContent="New Order"; if(breadcrumbAction)breadcrumbAction.textContent="New Order"; if(saveButtonText)saveButtonText.textContent="Save Order"; else if(saveButton)saveButton.innerHTML=`<i class="fas fa-save"></i> Save Order`; if(manualOrderIdInput)manualOrderIdInput.readOnly=false; if(orderDateInput)orderDateInput.value=new Date().toISOString().split('T')[0]; const defaultStatus = "Order Received"; orderStatusSelect.value = defaultStatus; updateStatusDropdownColor(defaultStatus); resetCustomerSelectionUI(true); updateOrderSummary(); handleAddItem(); showFormError(''); hideProductSuggestions(); if(customerSuggestionsNameBox) hideSuggestionBox(customerSuggestionsNameBox); if(customerSuggestionsWhatsAppBox) hideSuggestionBox(customerSuggestionsWhatsAppBox); window.scrollTo(0, 0);
        // --- Set focus back to Full Name after reset ---
        if (customerFullNameInput) customerFullNameInput.focus();
    }

    // --- WhatsApp Reminder ---
    function showWhatsAppReminder(customer, orderId, deliveryDateStr) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        if (!whatsappReminderPopup || !whatsappMsgPreview || !whatsappSendLink) { console.warn("WhatsApp popup elements missing."); const redirectUrl = isEditMode ? `order_history.html?highlightOrderId=${orderIdToEdit || ''}` : 'new_order.html'; if (!isEditMode) resetNewOrderForm(); window.location.href = redirectUrl; return; } const cN = customer.fullName || 'Customer'; const cNum = customer.whatsappNo?.replace(/[^0-9]/g, ''); if (!cNum) { console.warn("Cannot send WhatsApp, number missing/invalid."); const redirectUrl = isEditMode ? `order_history.html?highlightOrderId=${orderIdToEdit || ''}` : 'new_order.html'; if (!isEditMode) resetNewOrderForm(); window.location.href = redirectUrl; return; } let fDD = ' As Soon As Possible'; try { if (deliveryDateStr) fDD = new Date(deliveryDateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { console.error("Error formatting delivery date:", e); } let msg = `Dear ${cN},\nYour order (Order ID: ${orderId}) has been saved successfully. Estimated delivery date: ${fDD}.\nThank you,\nMadhav Multiprint`; whatsappMsgPreview.innerText = msg; const eM = encodeURIComponent(msg); const wUrl = `https://wa.me/91${cNum}?text=${eM}`; whatsappSendLink.href = wUrl; whatsappSendLink.style.pointerEvents = 'auto'; whatsappSendLink.style.opacity = '1'; const redirectUrl = isEditMode ? `order_history.html?highlightOrderId=${orderIdToEdit || ''}` : 'new_order.html'; const delayMilliseconds = 1000; const handleSendClick = () => { console.log("WhatsApp link clicked..."); whatsappSendLink.style.pointerEvents = 'none'; whatsappSendLink.style.opacity = '0.7'; setTimeout(() => { console.log("Redirecting after send delay..."); if (!isEditMode) resetNewOrderForm(); window.location.href = redirectUrl; }, delayMilliseconds); }; const handleCloseOrOverlayClick = () => { console.log("Popup closed without sending..."); if (!isEditMode) resetNewOrderForm(); window.location.href = redirectUrl; closeWhatsAppPopup(); }; whatsappSendLink.onclick = null; popupCloseBtn.onclick = null; whatsappReminderPopup.onclick = null; whatsappSendLink.onclick = handleSendClick; popupCloseBtn.onclick = handleCloseOrOverlayClick; whatsappReminderPopup.onclick = (event) => { if (event.target === whatsappReminderPopup) { handleCloseOrOverlayClick(); } }; whatsappReminderPopup.classList.add('active');
    }
    function closeWhatsAppPopup() {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        if (whatsappReminderPopup) { whatsappReminderPopup.classList.remove('active'); if (whatsappSendLink) whatsappSendLink.onclick = null; if (popupCloseBtn) popupCloseBtn.onclick = null; whatsappReminderPopup.onclick = null; if (whatsappSendLink) { whatsappSendLink.style.pointerEvents = 'auto'; whatsappSendLink.style.opacity = '1'; } }
    }

    // --- Balance Helpers (for customer details section) ---
    async function loadPaymentTotals_NewOrder(customerId) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        let totalPaid = 0; if (!db || !collection || !query || !where || !getDocs) { console.error("_newOrder: DB functions missing for payments."); return 0; } try { const q = query(collection(db, "payments"), where("customerId", "==", customerId)); const querySnapshot = await getDocs(q); querySnapshot.forEach(doc => { totalPaid += Number(doc.data().amountPaid || 0); }); return totalPaid; } catch (error) { console.error("_newOrder: Error loading payment total:", error); if (error.code === 'failed-precondition' || error.message.includes("index")) { console.warn("_newOrder: Firestore index missing for payments/customerId. Balance calculation might be inaccurate."); showFormError("Notice: Cannot calculate exact previous balance (missing payments index)."); } return 0; }
    }
    async function loadOrderTotals_NewOrder(customerId) {
        // ... (यह फंक्शन वैसा ही रहेगा जैसा पिछले कोड में था) ...
        let totalOrderValue = 0; let foundOrders = false; if (!db || !collection || !query || !where || !getDocs) { console.error("_newOrder: DB functions missing for orders."); return 'N/A'; } try { const q = query(collection(db, "orders"), where("customerId", "==", customerId)); const querySnapshot = await getDocs(q); querySnapshot.forEach(doc => { foundOrders = true; totalOrderValue += Number(doc.data().totalAmount || doc.data().finalAmount || 0); }); return foundOrders ? totalOrderValue : 0; } catch (error) { console.error("_newOrder: Error loading order total value:", error); if (error.code === 'failed-precondition' || error.message.includes("index")) { console.warn("_newOrder: Firestore index missing for orders/customerId. Balance calculation might be inaccurate."); showFormError("Notice: Cannot calculate exact previous balance (missing orders index)."); } return 'N/A'; }
    }

    // --- Log End of Initialization ---
    console.log("new_order.js script logic initialized (Combined Updates + Delay + Focus Fix).");

}, INITIALIZATION_DELAY); // End of setTimeout wrapper