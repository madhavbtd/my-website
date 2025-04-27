// js/new_order.js - v2.6.4 (Counter Logic updated to use utils.js, Full File)

// --- Firebase Functions (Assume available globally) ---
const {
    db, collection, addDoc, doc, getDoc, getDocs, updateDoc,
    query, where, orderBy, limit, Timestamp, arrayUnion, serverTimestamp
} = window;

// --- >>> नया इम्पोर्ट: utils.js से काउंटर फंक्शन <<< ---
import { getNextNumericId } from './utils.js';
// --->>> इम्पोर्ट समाप्त <<<---

// --- Global Variables ---
// (ये वैसे ही रहेंगे)
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
// (ये वैसे ही रहेंगे)
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

// --- Status Definitions ---
// (यह वैसे ही रहेगा)
const statusList = [
    "Order Received", "Designing", "Verification", "Design Approved",
    "Printing", "Ready for Working", "Delivered", "Completed"
];


// --- Initialization ---
// (यह फंक्शन वैसे ही रहेगा)
document.addEventListener('DOMContentLoaded', () => {
    console.log("New Order DOM Loaded (v2.6.4 - Counter Updated). Initializing...");
    if (!orderForm || !addItemBtn || !orderItemsTableBody || !itemRowTemplate || !calculationPreviewArea || !calculationPreviewContent || !orderStatusSelect) {
        console.error("Critical DOM elements missing! Check HTML IDs.");
        alert("Page structure error. Cannot initialize order form.");
        return;
    }
    waitForDbConnection(initializeForm);

    // Event Listeners (ये वैसे ही रहेंगे)
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
});

// --- DB Connection Wait ---
// (यह फंक्शन वैसे ही रहेगा)
function waitForDbConnection(callback) { if(window.db && typeof window.query === 'function' && typeof window.collection === 'function' && typeof window.serverTimestamp === 'function' && typeof window.arrayUnion === 'function' && typeof getNextNumericId === 'function' ){ console.log("DB & Utils confirmed."); callback(); } else { let a = 0; const m = 20, i = setInterval(() => { a++; if(window.db && typeof window.query === 'function' && typeof window.collection === 'function' && typeof window.serverTimestamp === 'function' && typeof window.arrayUnion === 'function' && typeof getNextNumericId === 'function') { clearInterval(i); console.log("DB & Utils confirmed later."); callback(); } else if(a >= m) { clearInterval(i); console.error("DB/Utils timeout or missing functions."); alert("DB/Utils connection failed or functions missing."); if(saveButton) saveButton.disabled = true; } }, 250); } }

// --- Global Click Handler ---
// (यह फंक्शन वैसे ही रहेगा)
function handleGlobalClick(event) {
    if (productSuggestionsDiv && activeProductInput && !productSuggestionsDiv.contains(event.target) && event.target !== activeProductInput) { hideProductSuggestions(); }
    if (customerSuggestionsNameBox && customerNameInput && !customerSuggestionsNameBox.contains(event.target) && event.target !== customerNameInput) { hideSuggestionBox(customerSuggestionsNameBox); }
    if (customerSuggestionsWhatsAppBox && customerWhatsAppInput && !customerSuggestionsWhatsAppBox.contains(event.target) && event.target !== customerWhatsAppInput) { hideSuggestionBox(customerSuggestionsWhatsAppBox); }
}

// --- Utility Functions ---
// (ये फंक्शन्स वैसे ही रहेंगे)
function hideSuggestionBox(box) { if(box){box.classList.remove('active');box.style.display='none';}}
function formatCurrency(amount) { const n=Number(amount||0); return `₹${n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`; }
function showFormError(message) { if(formErrorMsg){formErrorMsg.textContent=message;formErrorMsg.style.display=message?'block':'none';if(message)formErrorMsg.scrollIntoView({behavior:'smooth',block:'center'});}else if(message){alert(message);}}

// --- Form Initialization ---
// (यह फंक्शन वैसे ही रहेगा)
function initializeForm() { /* ... आपका मौजूदा initializeForm कोड ... */
    console.log("Running initializeForm...");
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
        if(manualOrderIdInput)manualOrderIdInput.readOnly=true; // <<< एडिट मोड में इसे रीड-ओनली करें
        loadOrderForEdit(orderIdToEdit);
    } else {
        isEditMode=false;
        console.log("Add Mode.");
        if(headerText)headerText.textContent="New Order";
        if(breadcrumbAction)breadcrumbAction.textContent="New Order";
        if(saveButtonText)saveButtonText.textContent="Save Order";
        if(manualOrderIdInput)manualOrderIdInput.readOnly=false; // <<< नए ऑर्डर मोड में इनेबल करें
        if(orderDateInput&&!orderDateInput.value)orderDateInput.value=new Date().toISOString().split('T')[0];
        const defaultStatus = "Order Received";
        orderStatusSelect.value = defaultStatus;
        updateStatusDropdownColor(defaultStatus);
        resetCustomerSelectionUI(true);

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

        if(orderItemsTableBody&&orderItemsTableBody.children.length===0){handleAddItem();}else if(!orderItemsTableBody){console.error("Table body missing!");}
        updateOrderSummary();
    }
    preFetchCaches();
}

// --- Pre-fetch Caches ---
// (यह फंक्शन वैसे ही रहेगा)
function preFetchCaches() { console.log("Pre-fetching caches..."); getOrFetchCustomerCache().catch(e=>console.error("Cust cache fetch err:", e)); getOrFetchProductCache().catch(e=>console.error("Prod cache fetch err:", e));}

// --- Load Order For Edit ---
// (यह फंक्शन थोड़ा बदलेगा ताकि मैन्युअल ID फील्ड में ऑर्डर ID दिखे)
async function loadOrderForEdit(docId) {
    console.log(`Loading order for edit: ${docId}`);
    showFormError('');
    if(!db||!doc||!getDoc){showFormError("DB function error.");return;}
    try{
        const r=doc(db,"orders",docId);
        const s=await getDoc(r);
        if(s.exists()){
            currentOrderData=s.data();
            console.log("Order data loaded for edit:",currentOrderData);
            selectedCustomerId = currentOrderData.customerId || currentOrderData.customerDetails?.customerId || null;
            if(selectedCustomerIdInput)selectedCustomerIdInput.value=selectedCustomerId || '';
             customerNameInput.value = currentOrderData.customerName || currentOrderData.customerDetails?.fullName || '';
             customerWhatsAppInput.value = currentOrderData.whatsappNo || currentOrderData.customerDetails?.whatsappNo || '';
             customerAddressInput.value = currentOrderData.address || currentOrderData.customerDetails?.address || currentOrderData.customerDetails?.billingAddress || '';
             customerContactInput.value = currentOrderData.contactNo || currentOrderData.customerDetails?.contactNo || '';
            if(selectedCustomerId){ await fetchAndDisplayCustomerDetails(selectedCustomerId); }
            else { resetCustomerSelectionUI(true); }

            const loadedOrderId = currentOrderData.orderId || ''; // <<-- ऑर्डर ID प्राप्त करें
            displayOrderIdInput.value=loadedOrderId; // सिस्टम आईडी (शायद हटा सकते हैं)
            manualOrderIdInput.value=loadedOrderId; // <<<--- मैन्युअल ID फील्ड में भी दिखाएं
            manualOrderIdInput.readOnly=true; // <<<--- एडिट मोड में इसे रीड-ओनली करें

            const primaryDate = currentOrderData.createdAt || currentOrderData.orderDate;
            orderDateInput.value = primaryDate?.toDate ? primaryDate.toDate().toISOString().split('T')[0] : (typeof primaryDate === 'string' ? primaryDate : '');
            deliveryDateInput.value=currentOrderData.deliveryDate?.toDate ? currentOrderData.deliveryDate.toDate().toISOString().split('T')[0] : (typeof currentOrderData.deliveryDate === 'string' ? currentOrderData.deliveryDate : '');
            remarksInput.value=currentOrderData.remarks||'';
            const uV=currentOrderData.urgent||'No';
            const uR=orderForm.querySelector(`input[name="urgent"][value="${uV}"]`);
            if(uR)uR.checked=true;
            const loadedStatus = currentOrderData.status || "Order Received";
            orderStatusSelect.value = loadedStatus;
            updateStatusDropdownColor(loadedStatus);
            if(!orderItemsTableBody){console.error("Item table body missing!");return;}
            orderItemsTableBody.innerHTML='';
            const itemsToLoad = currentOrderData.items || currentOrderData.products || [];
            if(Array.isArray(itemsToLoad)){ itemsToLoad.forEach(i=>{ const itemDataForPopulation = { productId: i.productId, productName: i.productName || i.name, unitType: i.unitType || i.unit, quantity: i.quantity, rate: i.rate, minSalePrice: i.minSalePrice, dimensionUnit: i.dimensionUnit, width: i.width, height: i.height }; const nR=addItemRow(false); if(nR){ populateItemRow(nR, itemDataForPopulation); if (itemDataForPopulation.productId) { nR.dataset.productId = itemDataForPopulation.productId; } } }); }
            if(orderItemsTableBody.children.length===0){handleAddItem();}
            if(summaryDiscountPercentInput)summaryDiscountPercentInput.value=currentOrderData.discountPercentage||'';
            if(summaryDiscountAmountInput)summaryDiscountAmountInput.value=currentOrderData.discountAmount||'';
            if(summaryAdvancePaymentInput) summaryAdvancePaymentInput.value = '';
            updateOrderSummary();
        } else { console.error("Order document not found for editing!"); showFormError("Error: The order you are trying to edit could not be found."); if(saveButton)saveButton.disabled=true; }
    } catch(e) { console.error("Error loading order for edit:",e); showFormError("Error loading order data: "+e.message); if(saveButton)saveButton.disabled=true; }
}

// --- Item Handling ---
// (ये सभी फंक्शन्स वैसे ही रहेंगे: handleAddItem, addItemRow, populateItemRow, handleItemTableClick, handleSuggestionClick, handleItemTableInput, handleItemTableChange)
/* ... आपके मौजूदा Item Handling फंक्शन्स ... */
function handleAddItem() { if(!itemRowTemplate || !orderItemsTableBody){console.error("Template or body missing!");showFormError("Error: Page setup incomplete.");return;} const nR=addItemRow(true); if(nR){updateOrderSummary();}else{console.error("Failed adding item row.");}}
function addItemRow(focus = true) { if (!itemRowTemplate || !orderItemsTableBody) { console.error("addItemRow: Prerequisites missing!"); return null; } try { const tC = itemRowTemplate.content.cloneNode(true), nRE = tC.querySelector('.item-row'); if (!nRE) { console.error("Template is missing the .item-row element"); return null; } orderItemsTableBody.appendChild(nRE); const aR = orderItemsTableBody.lastElementChild; if (!aR || !aR.matches('.item-row')) { console.error("Failed to append or find the new row."); return null; } const uS = aR.querySelector('.unit-type-select'); if (uS) handleUnitTypeChange({ target: uS }); if (focus) { const firstInput = aR.querySelector('.product-name'); if (firstInput) firstInput.focus(); } return aR; } catch (e) { console.error("Error in addItemRow:", e); showFormError(`Error creating item row: ${e.message}`); return null; } }
function populateItemRow(row, itemData) { if(!row||!itemData){console.warn("populateItemRow called with invalid row or data.");return;}try{row.querySelector('.product-name').value=itemData.productName||'';row.querySelector('.unit-type-select').value=itemData.unitType||'Qty';row.querySelector('.quantity-input').value=itemData.quantity||1;const rI=row.querySelector('.rate-input');rI.value=itemData.rate!==undefined?String(itemData.rate):''; const mR=itemData.minSalePrice; if(rI) rI.dataset.minRate=mR!==undefined&&mR!==null?String(mR):'-1';if(itemData.unitType==='Sq Feet'){row.querySelector('.dimension-unit-select').value=itemData.dimensionUnit||'feet';row.querySelector('.width-input').value=itemData.width||'';row.querySelector('.height-input').value=itemData.height||'';}handleUnitTypeChange({target:row.querySelector('.unit-type-select')});updateItemAmount(row);}catch(e){console.error("Error populating item row:",e);}}
function handleItemTableClick(event) { if (event.target.closest('.delete-item-btn')) { const r=event.target.closest('.item-row'); if(r){ r.remove(); hideProductSuggestions(); updateOrderSummary(); updateCalculationPreview(); } } }
function handleSuggestionClick(event) { const pLI = event.target.closest('.product-suggestions-list li[data-product]'); const cLI = event.target.closest('.suggestions-box li[data-customer-id]'); if (pLI) { event.preventDefault(); try { const pD = JSON.parse(pLI.dataset.product || '{}'); if (activeProductInput) selectProductSuggestion(pD, activeProductInput); } catch (e) { console.error("Error parsing/selecting product suggestion:", e); } } else if (cLI) { event.preventDefault(); try { fillCustomerData(cLI.dataset); const b = cLI.closest('.suggestions-box'); if (b) hideSuggestionBox(b); } catch(e) { console.error("Error selecting customer suggestion:", e); } } }
function handleItemTableInput(event) { const t=event.target,r=t.closest('.item-row'); if(!r)return; if(t.matches('.product-name')){activeProductInput=t;handleProductSearchInput(event);}else if(t.matches('.quantity-input, .rate-input, .width-input, .height-input')){updateItemAmount(r);}}
function handleItemTableChange(event){ const t=event.target,r=t.closest('.item-row'); if(!r)return; if(t.matches('.unit-type-select'))handleUnitTypeChange(event); else if(t.matches('.dimension-unit-select'))updateItemAmount(r);}

// --- Sq Ft Calculation Logic ---
// (यह फंक्शन वैसे ही रहेगा)
function calculateFlexDimensions(unit, width, height) { /* ... आपका मौजूदा calculateFlexDimensions कोड ... */
    const m=[3,4,5,6,8,10]; let w=(unit==='inches')?parseFloat(width||0)/12:parseFloat(width||0), h=(unit==='inches')?parseFloat(height||0)/12:parseFloat(height||0); if(isNaN(w)||isNaN(h)||w<=0||h<=0) return{realSqFt:0, printSqFt:0, realWidthFt:0, realHeightFt:0, printWidthFt:0, printHeightFt:0}; const r=w*h; let b={pW:0,pH:0,pS:Infinity}; const fW=m.find(x=>x>=w); let pW1=fW||w, pH1=h, S1=pW1*pH1; const fH=m.find(x=>x>=h); let pW2=w, pH2=fH||h, S2=pW2*pH2; if(S1<=S2){b.pW=pW1; b.pH=pH1; b.pS=S1;} else{b.pW=pW2; b.pH=pH2; b.pS=S2;} return{realSqFt:r.toFixed(2), printWidthFt:b.pW, printHeightFt:b.pH, printSqFt:b.pS.toFixed(2), realWidthFt: w, realHeightFt: h };}
function handleUnitTypeChange(event) { /* ... आपका मौजूदा handleUnitTypeChange कोड ... */
    const r=event.target.closest('.item-row'); if(!r)return; const uT=event.target.value; const isSqFt = (uT === 'Sq Feet'); r.querySelectorAll('.sq-feet-input').forEach(e=>e.style.display = isSqFt ? '' : 'none'); r.closest('table')?.querySelectorAll('thead th.sq-feet-header').forEach(h=>h.classList.toggle('hidden-col',!isSqFt)); r.querySelector('.rate-input').placeholder = isSqFt ? 'Rate/SqFt' : 'Rate/Unit'; if(!isSqFt){r.querySelector('.width-input').value=''; r.querySelector('.height-input').value='';} updateItemAmount(r);}
function updateItemAmount(row) { /* ... आपका मौजूदा updateItemAmount कोड ... */
    if (!row) return; const uTS=row.querySelector('.unit-type-select'),aS=row.querySelector('.item-amount'),rI=row.querySelector('.rate-input'),qI=row.querySelector('.quantity-input'),mR=parseFloat(rI?.dataset.minRate||-1); let cA=0,rV=parseFloat(rI?.value||0),q=parseInt(qI?.value||1); if(isNaN(q)||q<1)q=1; try{rI.classList.remove('input-error');rI.title='';if(mR>=0&&rV<mR && Math.abs(rV - mR) > 0.001 ){rI.classList.add('input-error');rI.title=`Rate ${formatCurrency(rV)} is below Minimum ${formatCurrency(mR)}`;} if(uTS?.value==='Sq Feet'){const dUS=row.querySelector('.dimension-unit-select'),wI=row.querySelector('.width-input'),hI=row.querySelector('.height-input'); const u=dUS?.value||'feet',w=parseFloat(wI?.value||0),h=parseFloat(hI?.value||0); if(w>0&&h>0&&!isNaN(rV)&&rV>=0){const cR=calculateFlexDimensions(u,w,h);cA=parseFloat(cR.printSqFt||0)*q*rV;}}else{if(!isNaN(rV)&&rV>=0)cA=q*rV;}}catch(e){console.error("Error calculating item amount:",e);cA=0;} if(aS)aS.textContent=cA.toFixed(2); updateOrderSummary(); updateCalculationPreview(); }

// --- Calculation Preview Logic ---
// (यह फंक्शन वैसे ही रहेगा)
function updateCalculationPreview() { /* ... आपका मौजूदा updateCalculationPreview कोड ... */
    if (!calculationPreviewArea || !calculationPreviewContent || !orderItemsTableBody) { return; } let entriesHTML = ''; const itemRows = orderItemsTableBody.querySelectorAll('.item-row'); let foundSqFt = false; itemRows.forEach((row, index) => { const unitTypeSelect = row.querySelector('.unit-type-select'); if (unitTypeSelect?.value === 'Sq Feet') { foundSqFt = true; const productNameInput = row.querySelector('.product-name'); const productName = productNameInput?.value.trim() || `Item ${index + 1}`; const dimensionUnitSelect = row.querySelector('.dimension-unit-select'); const widthInput = row.querySelector('.width-input'); const heightInput = row.querySelector('.height-input'); const quantityInput = row.querySelector('.quantity-input'); const unit = dimensionUnitSelect?.value || 'feet'; const width = parseFloat(widthInput?.value || 0); const height = parseFloat(heightInput?.value || 0); let quantity = parseInt(quantityInput?.value || 1); if (isNaN(quantity) || quantity < 1) quantity = 1; let entryContent = `<div class="item-preview-entry"><strong>${productName}:</strong><br>`; if (width > 0 && height > 0) { const calcResult = calculateFlexDimensions(unit, width, height); if (calcResult && parseFloat(calcResult.printSqFt) >= 0) { const realSqFtNum = parseFloat(calcResult.realSqFt); const printSqFtNum = parseFloat(calcResult.printSqFt); const wastageSqFt = (printSqFtNum - realSqFtNum); const tolerance = 0.01; let wastageDesc = (wastageSqFt > tolerance) ? `<span style="color: orange;">Wastage: ${wastageSqFt.toFixed(2)} sq ft/item</span>` : `<span style="color: green;">Wastage: ${wastageSqFt.toFixed(2)} sq ft/item</span>`; entryContent += `&nbsp; Qty: ${quantity}<br>`; entryContent += `&nbsp; Real: ${calcResult.realWidthFt?.toFixed(2) ?? '?'}ft x ${calcResult.realHeightFt?.toFixed(2) ?? '?'}ft = ${realSqFtNum.toFixed(2)} sq ft/item<br>`; entryContent += `&nbsp; Print: ${calcResult.printWidthFt.toFixed(2)}ft x ${calcResult.printHeightFt.toFixed(2)}ft = ${printSqFtNum.toFixed(2)} sq ft/item<br>`; entryContent += `&nbsp; Total Print Area: ${(printSqFtNum * quantity).toFixed(2)} sq ft<br>`; entryContent += `&nbsp; ${wastageDesc}`; } else { entryContent += `&nbsp; <span style="color:orange;">Invalid dimensions or calculation error.</span>`; } } else { entryContent += `&nbsp; <span style="color:grey;">Enter valid width & height for calculation.</span>`; } entryContent += `</div>`; entriesHTML += entryContent; } }); if (foundSqFt) { calculationPreviewContent.innerHTML = entriesHTML || '<p style="color:grey;">Enter dimensions for Sq Ft items.</p>'; calculationPreviewArea.style.display = 'block'; } else { calculationPreviewArea.style.display = 'none'; } }


// --- Order Summary Calculation ---
// (यह फंक्शन वैसे ही रहेगा)
function updateOrderSummary() { /* ... आपका मौजूदा updateOrderSummary कोड ... */
    let s=0; if(orderItemsTableBody) orderItemsTableBody.querySelectorAll('.item-row .item-amount').forEach(sp=>s+=parseFloat(sp.textContent||0)); let dP=parseFloat(summaryDiscountPercentInput?.value||0),dA=parseFloat(summaryDiscountAmountInput?.value||0),cDA=0; const activeEl = document.activeElement; if(!isDiscountInputProgrammaticChange){if(activeEl===summaryDiscountPercentInput&&!isNaN(dP)){cDA=s*(dP/100); isDiscountInputProgrammaticChange=true; if(summaryDiscountAmountInput) summaryDiscountAmountInput.value=cDA.toFixed(2); isDiscountInputProgrammaticChange=false;}else if(activeEl===summaryDiscountAmountInput&&!isNaN(dA)){cDA=dA; if(s>0){const cP=(cDA/s)*100; isDiscountInputProgrammaticChange=true; if(summaryDiscountPercentInput) summaryDiscountPercentInput.value=cP.toFixed(2); isDiscountInputProgrammaticChange=false;}else{isDiscountInputProgrammaticChange=true; if(summaryDiscountPercentInput) summaryDiscountPercentInput.value=''; isDiscountInputProgrammaticChange=false;}}else{if(!isNaN(dP)&&dP>0)cDA=s*(dP/100); else if(!isNaN(dA)&&dA>0)cDA=dA; else cDA=0;}} cDA=Math.max(0,Math.min(cDA,s)); const fA=s-cDA,aP=parseFloat(summaryAdvancePaymentInput?.value||0),tB=fA-aP; if(summarySubtotalSpan)summarySubtotalSpan.textContent=s.toFixed(2); if(summaryFinalAmountSpan)summaryFinalAmountSpan.textContent=fA.toFixed(2); if(summaryTotalBalanceSpan)summaryTotalBalanceSpan.textContent=tB.toFixed(2); checkCreditLimit();}
function handleDiscountInput(event) { /* ... आपका मौजूदा handleDiscountInput कोड ... */
    if(isDiscountInputProgrammaticChange)return; const cI=event.target; isDiscountInputProgrammaticChange=true; if(cI===summaryDiscountPercentInput){if(summaryDiscountAmountInput)summaryDiscountAmountInput.value='';}else if(cI===summaryDiscountAmountInput){if(summaryDiscountPercentInput)summaryDiscountPercentInput.value='';} isDiscountInputProgrammaticChange=false; updateOrderSummary();}

// --- Customer Autocomplete & Details ---
// (ये सभी फंक्शन्स वैसे ही रहेंगे)
/* ... आपके मौजूदा Customer Autocomplete & Details फंक्शन्स ... */
async function getOrFetchCustomerCache() { /* ... */ }
function handleCustomerInput(event, type) { /* ... */ }
function filterAndRenderCustomerSuggestions(term, type, box, inputElement) { /* ... */ }
function renderCustomerSuggestions(suggestions, term, box, inputElement) { /* ... */ }
function fillCustomerData(customerData) { /* ... */ }
async function fetchAndDisplayCustomerDetails(customerId) { /* ... */ }
function resetCustomerSelectionUI(clearInputs = true) { /* ... */ }
function checkCreditLimit(currentBalanceNum = NaN) { /* ... */ }
async function loadPaymentTotals_NewOrder(customerId) { /* ... */ }
async function loadOrderTotals_NewOrder(customerId) { /* ... */ }

// --- Product Autocomplete ---
// (ये सभी फंक्शन्स वैसे ही रहेंगे)
/* ... आपके मौजूदा Product Autocomplete फंक्शन्स ... */
function getOrCreateProductSuggestionsDiv() { /* ... */ }
function positionProductSuggestions(inputElement) { /* ... */ }
function hideProductSuggestions() { /* ... */ }
function handleProductSearchInput(event) { /* ... */ }
async function getOrFetchProductCache() { /* ... */ }
function filterAndRenderProductSuggestions(term, inputElement) { /* ... */ }
function renderProductSuggestions(suggestions, term, suggestionsContainer) { /* ... */ }
function selectProductSuggestion(productData, inputElement) { /* ... */ }

// --- Status Dropdown Handling ---
// (यह फंक्शन वैसे ही रहेगा)
function updateStatusDropdownColor(statusValue) { /* ... आपका मौजूदा updateStatusDropdownColor कोड ... */ }

// --- Form Submission (UPDATED to use getNextNumericId Correctly) ---
async function handleFormSubmit(event) {
    event.preventDefault();
    console.log("Submit initiated (v2.6.4 - Fixed Auto ID Generation)...");
    showFormError('');

    // Ensure necessary functions are available
    if (!db || !addDoc || !doc || !updateDoc || !Timestamp || !getDoc || !getDocs || !collection || !query || !limit || typeof window.serverTimestamp !== 'function' || typeof window.arrayUnion !== 'function' || typeof getNextNumericId !== 'function') {
        showFormError("Database or Counter functions unavailable. Please check setup.");
        console.error("Missing functions: check imports/global scope for Firestore and getNextNumericId")
        return;
    }
    if (!saveButton) { console.error("Save button element missing!"); return; }

    saveButton.disabled = true;
    const originalButtonText = saveButtonText ? saveButtonText.textContent : (isEditMode ? 'Update Order' : 'Save Order');
    const originalButtonHTML = saveButton.innerHTML;
    if (saveButtonText) saveButtonText.textContent = isEditMode ? 'Updating...' : 'Saving...';
    else saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        // --- Collect Customer Data ---
        const cFN = customerNameInput.value.trim();
        const cW = customerWhatsAppInput.value.trim();
        let cId = selectedCustomerId;
        if (!cFN) throw new Error("Customer Name is required.");
        if (!cW) throw new Error("WhatsApp No is required.");
        if (!cId) { cId = selectedCustomerIdInput?.value || null; if (!cId) { throw new Error("Customer is not selected or linked properly."); } selectedCustomerId = cId; }
        const cD = { fullName: cFN, whatsappNo: cW, address: customerAddressInput.value.trim() || '', contactNo: customerContactInput.value.trim() || '' };

        // --- Collect Order MetaData ---
        const oDV = orderDateInput.value;
        const dDV = deliveryDateInput.value || '';
        const uV = orderForm.querySelector('input[name="urgent"]:checked')?.value || 'No';
        const rV = remarksInput.value.trim() || '';
        const sS = orderStatusSelect.value;
        if (!oDV) throw new Error("Order Date is required.");

        // --- Determine Order ID ---
        let oId;
        const mId = manualOrderIdInput.value.trim();

        if (isEditMode) {
            // Use existing ID in edit mode
            oId = currentOrderData?.orderId || orderIdToEdit; // Get from loaded data or URL param
            if (!oId) throw new Error("Internal Error: Missing Order ID for update.");
            console.log(`Using existing Order ID for update: ${oId}`);
        } else if (mId) {
            // Use manual ID if provided for new order
            oId = mId;
            console.log(`Using manually entered Order ID: ${oId}`);
        } else {
            // --->>> Generate automatic ID ONLY if NOT in edit mode AND manual ID is BLANK <<<---
            console.log("Manual Order ID is blank, generating new Order ID...");
            // Call the imported function
            const nextOrderIdNum = await getNextNumericId("orderCounter", 1001); // Start ID 1001 (Adjust if needed)
            oId = `MM-${nextOrderIdNum}`; // Add your prefix
            console.log(`Generated Order ID: ${oId}`);
            // --->>> End of Automatic ID Generation <<<---
        }

        // --- Collect and Validate Items ---
        // (यह हिस्सा अपरिवर्तित रहेगा)
        const items = []; let validItems = true;
        const rows = orderItemsTableBody.querySelectorAll('.item-row');
        if (rows.length === 0) throw new Error("Please add at least one item.");
        rows.forEach((row, idx) => { /* ... आपका मौजूदा आइटम वैलिडेशन लॉजिक ... */
            if (!validItems) return; const pNI = row.querySelector('.product-name'); const uTS = row.querySelector('.unit-type-select'); const qI = row.querySelector('.quantity-input'); const rI = row.querySelector('.rate-input'); const dUS = row.querySelector('.dimension-unit-select'); const wI = row.querySelector('.width-input'); const hI = row.querySelector('.height-input'); const productId = row.dataset.productId || null; const pN = pNI?.value.trim(); const uT = uTS?.value; const q = parseInt(qI?.value || 0); const r = parseFloat(rI?.value || ''); const mR = parseFloat(rI?.dataset.minRate || -1);
             if (!pN) { validItems = false; showFormError(`Item ${idx + 1}: Product Name required.`); pNI?.focus(); return; }
             if (isNaN(q) || q <= 0) { validItems = false; showFormError(`Item ${idx + 1}: Valid Quantity required.`); qI?.focus(); return; }
             if (isNaN(r) || r < 0) { validItems = false; showFormError(`Item ${idx + 1}: Valid Rate required (must be 0 or more).`); rI?.focus(); return; }
             if (mR >= 0 && r < mR && Math.abs(r - mR) > 0.001) { validItems = false; showFormError(`Item ${idx + 1}: Rate ${formatCurrency(r)} is below Minimum Sale Price (${formatCurrency(mR)}).`); rI?.focus(); return; }
             const iD = { productId: productId, productName: pN, unitType: uT, quantity: q, rate: r, minSalePrice: mR >= 0 ? mR : null };
             if (uT === 'Sq Feet') { const dU = dUS?.value || 'feet'; const w = parseFloat(wI?.value || 0); const h = parseFloat(hI?.value || 0); if (isNaN(w) || w <= 0) { validItems = false; showFormError(`Item ${idx + 1}: Valid Width required.`); wI?.focus(); return; } if (isNaN(h) || h <= 0) { validItems = false; showFormError(`Item ${idx + 1}: Valid Height required.`); hI?.focus(); return; } const cR = calculateFlexDimensions(dU, w, h); iD.dimensionUnit = dU; iD.width = w; iD.height = h; iD.realSqFt = cR.realSqFt; iD.printSqFt = cR.printSqFt; iD.itemAmount = parseFloat((cR.printSqFt * q * r).toFixed(2)); } else { iD.itemAmount = parseFloat((q * r).toFixed(2)); }
             items.push(iD);
        });
        if (!validItems) { throw new Error("Please correct the errors in the items list."); }

        // --- Calculate Order Totals ---
        // (यह हिस्सा अपरिवर्तित रहेगा)
        let subT = 0; items.forEach(i => { subT += i.itemAmount; });
        let dP = parseFloat(summaryDiscountPercentInput?.value || 0); let dA = parseFloat(summaryDiscountAmountInput?.value || 0); let cDA = 0;
        if (!isNaN(dP) && dP > 0) { cDA = parseFloat((subT * (dP / 100)).toFixed(2)); } else if (!isNaN(dA) && dA > 0) { cDA = dA; if (subT > 0) dP = parseFloat(((cDA / subT) * 100).toFixed(2)); else dP = 0; }
        cDA = Math.max(0, Math.min(cDA, subT));
        let finalAmount = parseFloat((subT - cDA).toFixed(2));
        let aP = parseFloat(summaryAdvancePaymentInput?.value || 0);

        // --- Prepare Final Payload ---
        const payload = {
            orderId: oId, // <- यहाँ सही ID सेट होगी
            customerId: cId, customerDetails: cD,
            orderDate: Timestamp.fromDate(new Date(oDV + 'T00:00:00')),
            deliveryDate: dDV ? Timestamp.fromDate(new Date(dDV + 'T00:00:00')) : null,
            urgent: uV, remarks: rV, status: sS, items: items, subTotal: subT,
            discountPercentage: dP || 0, discountAmount: cDA, totalAmount: finalAmount,
            finalAmount: finalAmount, updatedAt: serverTimestamp()
        };

        let savedId, msg;

        if (isEditMode) { // --- UPDATE ---
            if (!orderIdToEdit) throw new Error("Missing Firestore ID for update.");
            delete payload.createdAt; // Don't overwrite createdAt on update
            if (currentOrderData && sS !== currentOrderData.status) {
                payload.statusHistory = arrayUnion({ status: sS, timestamp: serverTimestamp() });
            } else { delete payload.statusHistory; }
            await updateDoc(doc(db, "orders", orderIdToEdit), payload);
            savedId = orderIdToEdit;
            msg = `Order ${oId} updated successfully!`;
        } else { // --- ADD ---
            payload.createdAt = serverTimestamp();
            payload.statusHistory = [{ status: sS, timestamp: Timestamp.now() }];
            // Use addDoc directly, no need for transaction here as counter is handled by getNextNumericId
            const orderDocRef = await addDoc(collection(db, "orders"), payload);
            savedId = orderDocRef.id;
            msg = `Order ${oId} created successfully!`;
            // Update display fields if auto-generated
            if (displayOrderIdInput && !manualOrderIdInput.value) displayOrderIdInput.value = oId;
            // Optionally update manual input field as well (and make read-only?)
            // if (manualOrderIdInput && !manualOrderIdInput.value) manualOrderIdInput.value = oId;
        }

        console.log(msg, "Firestore Doc ID:", savedId);

        // --- Handle Advance Payment ---
        // (यह हिस्सा अपरिवर्तित रहेगा)
        if (aP > 0 && !isEditMode) { /* ... आपका मौजूदा एडवांस पेमेंट लॉजिक ... */
            console.log(`Advance payment amount entered: ${aP}. Creating payment record...`);
            try { const paymentData = { customerId: cId, orderRefId: savedId, orderId: oId, amountPaid: aP, paymentDate: serverTimestamp(), paymentMethod: "Order Advance", notes: `Advance payment for Order #${oId}`, createdAt: serverTimestamp() }; const paymentDocRef = await addDoc(collection(db, "payments"), paymentData); console.log(`Advance payment record added successfully. Payment Doc ID: ${paymentDocRef.id}`); } catch (paymentError) { console.error("Error saving advance payment record:", paymentError); alert(`Order ${oId} was saved successfully, but there was an error recording the advance payment: ${paymentError.message}\n\nPlease add the payment manually later.`); }
        }

        alert(msg);

        // --- Handle redirection/WhatsApp ---
        // (यह हिस्सा अपरिवर्तित रहेगा)
        if (cD.whatsappNo) { showWhatsAppReminder(cD, oId, deliveryDateInput.value); }
        else { if (!isEditMode) { resetNewOrderForm(); } else { window.location.href = `order_history.html?highlightOrderId=${orderIdToEdit || ''}`; } }

    } catch (error) {
        console.error("Form submission failed:", error);
        showFormError("Error saving order: " + error.message);
    } finally {
        // Re-enable button
        saveButton.disabled = false;
        if (saveButtonText) saveButtonText.textContent = originalButtonText; else saveButton.innerHTML = originalButtonHTML;
    }
}


// --- Reset Form ---
// (यह फंक्शन वैसे ही रहेगा)
function resetNewOrderForm() { /* ... आपका मौजूदा resetNewOrderForm कोड ... */
    console.log("Resetting form for new order."); orderForm.reset(); if(orderItemsTableBody) orderItemsTableBody.innerHTML=''; selectedCustomerId=null; selectedCustomerData=null; currentOrderData=null; isEditMode=false; orderIdToEdit=null; if(hiddenEditOrderIdInput)hiddenEditOrderIdInput.value=''; if(selectedCustomerIdInput)selectedCustomerIdInput.value=''; if(displayOrderIdInput) displayOrderIdInput.value = ''; if(headerText)headerText.textContent="New Order"; if(breadcrumbAction)breadcrumbAction.textContent="New Order"; if(saveButtonText)saveButtonText.textContent="Save Order"; else if(saveButton)saveButton.innerHTML=`<i class="fas fa-save"></i> Save Order`; if(manualOrderIdInput)manualOrderIdInput.readOnly=false; if(orderDateInput)orderDateInput.value=new Date().toISOString().split('T')[0]; const defaultStatus = "Order Received"; orderStatusSelect.value = defaultStatus; updateStatusDropdownColor(defaultStatus); resetCustomerSelectionUI(true); updateOrderSummary(); handleAddItem(); showFormError(''); hideProductSuggestions(); if(customerSuggestionsNameBox) hideSuggestionBox(customerSuggestionsNameBox); if(customerSuggestionsWhatsAppBox) hideSuggestionBox(customerSuggestionsWhatsAppBox); window.scrollTo(0, 0);
}

// --- WhatsApp Reminder Functions ---
// (ये फंक्शन्स वैसे ही रहेंगे)
function showWhatsAppReminder(customer, orderId, deliveryDateStr) { /* ... आपका मौजूदा showWhatsAppReminder कोड ... */ }
function closeWhatsAppPopup() { /* ... आपका मौजूदा closeWhatsAppPopup कोड ... */ }

// --- Log ---
console.log("new_order.js script loaded (v2.6.4 - Fixed Auto ID Generation).");