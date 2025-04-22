
// js/new_order.js - v2.2.1 (Changes click handler for suggestions)

// --- Firebase Functions ---
const {
    db, collection, addDoc, doc, getDoc, getDocs, updateDoc,
    query, where, orderBy, limit, Timestamp
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
const orderStatusCheckboxes = document.querySelectorAll('input[name="order_status"]');
const formErrorMsg = document.getElementById('formErrorMsg');
const whatsappReminderPopup = document.getElementById('whatsapp-reminder-popup');
const whatsappMsgPreview = document.getElementById('whatsapp-message-preview');
const whatsappSendLink = document.getElementById('whatsapp-send-link');
const popupCloseBtn = document.getElementById('popup-close-btn');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("New Order DOM Loaded (v2.2.1). Initializing...");
    if (!orderForm || !addItemBtn || !orderItemsTableBody || !itemRowTemplate || !calculationPreviewArea || !calculationPreviewContent) {
        console.error("Critical DOM elements missing! Check HTML IDs.", { orderForm: !!orderForm, addItemBtn: !!addItemBtn, orderItemsTableBody: !!orderItemsTableBody, itemRowTemplate: !!itemRowTemplate, calculationPreviewArea: !!calculationPreviewArea, calculationPreviewContent: !!calculationPreviewContent });
        alert("Page structure error. Cannot initialize order form.");
        return;
    }
    waitForDbConnection(initializeForm);

    // Event Listeners
    orderForm.addEventListener('submit', handleFormSubmit);
    addItemBtn.addEventListener('click', handleAddItem);
    orderItemsTableBody.addEventListener('click', handleItemTableClick); // Catches delete button clicks too
    orderItemsTableBody.addEventListener('input', handleItemTableInput);
    orderItemsTableBody.addEventListener('change', handleItemTableChange);
    orderItemsTableBody.addEventListener('focusin', (event) => { if (event.target.matches('.product-name')) activeProductInput = event.target; });
    // Note: Suggestion click handled by listener on productSuggestionsDiv (added later)
    if (customerNameInput) { customerNameInput.addEventListener('input', (e) => handleCustomerInput(e, 'name')); customerNameInput.addEventListener('blur', () => setTimeout(() => { if(customerSuggestionsNameBox && !customerSuggestionsNameBox.matches(':hover')) hideSuggestionBox(customerSuggestionsNameBox); }, 150)); } else { console.warn("Customer name input not found."); }
    if (customerWhatsAppInput) { customerWhatsAppInput.addEventListener('input', (e) => handleCustomerInput(e, 'whatsapp')); customerWhatsAppInput.addEventListener('blur', () => setTimeout(() => { if(customerSuggestionsWhatsAppBox && !customerSuggestionsWhatsAppBox.matches(':hover')) hideSuggestionBox(customerSuggestionsWhatsAppBox); }, 150)); } else { console.warn("Customer whatsapp input not found."); }
    if (summaryDiscountPercentInput) summaryDiscountPercentInput.addEventListener('input', handleDiscountInput); else { console.warn("Discount % input not found."); }
    if (summaryDiscountAmountInput) summaryDiscountAmountInput.addEventListener('input', handleDiscountInput); else { console.warn("Discount Amount input not found."); }
    if (summaryAdvancePaymentInput) summaryAdvancePaymentInput.addEventListener('input', updateOrderSummary); else { console.warn("Advance Payment input not found."); }
    if (popupCloseBtn) popupCloseBtn.addEventListener('click', closeWhatsAppPopup);
    if (whatsappReminderPopup) whatsappReminderPopup.addEventListener('click', (event) => { if (event.target === whatsappReminderPopup) closeWhatsAppPopup(); });
    document.addEventListener('click', handleGlobalClick); // Handles clicks outside suggestion boxes
});

// --- DB Connection Wait ---
function waitForDbConnection(callback) { if(window.db&&typeof window.query==='function'&&typeof window.collection==='function'){console.log("DB confirmed."); callback();}else{let a=0;const m=20,i=setInterval(()=>{a++; if(window.db&&typeof window.query==='function'&&typeof window.collection==='function'){clearInterval(i);console.log("DB confirmed later."); callback();}else if(a>=m){clearInterval(i);console.error("DB timeout.");alert("DB connection failed.");if(saveButton)saveButton.disabled=true;}},250);}}

// --- Global Click Handler ---
function handleGlobalClick(event) {
    // Hide product suggestions if click is outside the active input and the suggestions box itself
    if (productSuggestionsDiv && activeProductInput && !productSuggestionsDiv.contains(event.target) && event.target !== activeProductInput) {
        hideProductSuggestions();
    }
    // Note: Customer suggestion box hiding is handled by blur + setTimeout on the inputs themselves
}

// --- Utility Functions ---
function hideSuggestionBox(box) { if(box){box.classList.remove('active');box.style.display='none';}}
function formatCurrency(amount) { const n=Number(amount||0); return `₹${n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`; }
function showFormError(message) { if(formErrorMsg){formErrorMsg.textContent=message;formErrorMsg.style.display=message?'block':'none';if(message)formErrorMsg.scrollIntoView({behavior:'smooth',block:'center'});}else if(message){alert(message);}}

// --- Form Initialization ---
function initializeForm() { console.log("Running initializeForm..."); const uP=new URLSearchParams(window.location.search); orderIdToEdit=uP.get('editOrderId'); if(orderIdToEdit){isEditMode=true; console.log("Edit Mode:", orderIdToEdit); if(headerText)headerText.textContent="Edit Order"; if(breadcrumbAction)breadcrumbAction.textContent="Edit Order"; if(saveButtonText)saveButtonText.textContent="Update Order"; if(hiddenEditOrderIdInput)hiddenEditOrderIdInput.value=orderIdToEdit; if(manualOrderIdInput)manualOrderIdInput.readOnly=true; loadOrderForEdit(orderIdToEdit);}else{isEditMode=false; console.log("Add Mode."); if(headerText)headerText.textContent="New Order"; if(breadcrumbAction)breadcrumbAction.textContent="New Order"; if(saveButtonText)saveButtonText.textContent="Save Order"; if(manualOrderIdInput)manualOrderIdInput.readOnly=false; if(orderDateInput&&!orderDateInput.value)orderDateInput.value=new Date().toISOString().split('T')[0]; handleStatusCheckboxes(false); resetCustomerSelectionUI(); if(orderItemsTableBody&&orderItemsTableBody.children.length===0){handleAddItem();}else if(!orderItemsTableBody){console.error("Table body missing!");} updateOrderSummary();} preFetchCaches(); }

// --- Pre-fetch Caches ---
function preFetchCaches() { console.log("Pre-fetching caches..."); getOrFetchCustomerCache().catch(e=>console.error("Cust cache fetch err:", e)); getOrFetchProductCache().catch(e=>console.error("Prod cache fetch err:", e));}

// --- Load Order For Edit ---
async function loadOrderForEdit(docId) { console.log(`Loading order: ${docId}`); showFormError(''); if(!db||!doc||!getDoc){showFormError("DB func error.");return;} try{const r=doc(db,"orders",docId);const s=await getDoc(r); if(s.exists()){currentOrderData=s.data();console.log("Order loaded:",currentOrderData);selectedCustomerId=currentOrderData.customerId||null;if(selectedCustomerIdInput)selectedCustomerIdInput.value=selectedCustomerId;if(currentOrderData.customerDetails){customerNameInput.value=currentOrderData.customerDetails.fullName||'';customerWhatsAppInput.value=currentOrderData.customerDetails.whatsappNo||'';customerAddressInput.value=currentOrderData.customerDetails.address||'';customerContactInput.value=currentOrderData.customerDetails.contactNo||'';if(selectedCustomerId){fetchAndDisplayCustomerDetails(selectedCustomerId);}else{resetCustomerSelectionUI();}} displayOrderIdInput.value=currentOrderData.orderId||docId;manualOrderIdInput.value=currentOrderData.orderId||'';orderDateInput.value=currentOrderData.orderDate||'';deliveryDateInput.value=currentOrderData.deliveryDate||'';remarksInput.value=currentOrderData.remarks||'';const uV=currentOrderData.urgent||'No';const uR=orderForm.querySelector(`input[name="urgent"][value="${uV}"]`);if(uR)uR.checked=true; handleStatusCheckboxes(true);orderStatusCheckboxes.forEach(c=>c.checked=false);if(currentOrderData.status){const sC=orderForm.querySelector(`input[name="order_status"][value="${currentOrderData.status}"]`);if(sC)sC.checked=true;} if(!orderItemsTableBody){console.error("Item table body missing!");return;} orderItemsTableBody.innerHTML=''; if(currentOrderData.items&&Array.isArray(currentOrderData.items)){currentOrderData.items.forEach(i=>{const nR=addItemRow(false); if(nR)populateItemRow(nR,i);else console.error("Failed to add row for item:",i);});} if(orderItemsTableBody.children.length===0){handleAddItem();} if(summaryDiscountPercentInput)summaryDiscountPercentInput.value=currentOrderData.discountPercentage||''; if(summaryDiscountAmountInput)summaryDiscountAmountInput.value=currentOrderData.discountAmount||''; if(summaryAdvancePaymentInput)summaryAdvancePaymentInput.value=currentOrderData.advancePayment||''; updateOrderSummary();}else{console.error("Order doc not found!");showFormError("Error: Order not found.");if(saveButton)saveButton.disabled=true;}}catch(e){console.error("Load order error:",e);showFormError("Error loading data: "+e.message);if(saveButton)saveButton.disabled=true;}}

// --- Item Handling ---
function handleAddItem() { console.log("Adding item..."); if(!itemRowTemplate || !orderItemsTableBody){console.error("Template or body missing!");showFormError("Error: Page setup incomplete.");return;} const nR=addItemRow(true); if(nR){console.log("Row added.");updateOrderSummary();}else{console.error("Failed adding row.");}}
function addItemRow(focus = true) { if (!itemRowTemplate || !orderItemsTableBody) { console.error("addItemRow: Prereqs missing!"); return null; } try { const tC = itemRowTemplate.content.cloneNode(true), nRE = tC.querySelector('.item-row'); if (!nRE) { console.error("Template missing .item-row"); return null; } orderItemsTableBody.appendChild(nRE); const aR = orderItemsTableBody.lastElementChild; if (!aR || !aR.matches('.item-row')) { console.error("Append failed."); return null; } const uS = aR.querySelector('.unit-type-select'); if (uS) handleUnitTypeChange({ target: uS }); if (focus) aR.querySelector('.product-name')?.focus(); return aR; } catch (e) { console.error("addItemRow error:", e); showFormError(`Create item row error: ${e.message}`); return null; } }
function populateItemRow(row, itemData) { if(!row||!itemData)return;console.log("Populating:",itemData);try{row.querySelector('.product-name').value=itemData.productName||'';row.querySelector('.unit-type-select').value=itemData.unitType||'Qty';row.querySelector('.quantity-input').value=itemData.quantity||1;const rI=row.querySelector('.rate-input');rI.value=itemData.rate!==undefined?itemData.rate:'';const mR=itemData.minSalePrice; // const mRVS=row.querySelector('.min-rate-value'); // Element removed in HTML
 // if (mRVS) mRVS.textContent=mR!==undefined&&mR!==null?parseFloat(mR).toFixed(2):'--'; // Element removed in HTML
 if(rI) rI.dataset.minRate=mR!==undefined&&mR!==null?mR:'-1';if(itemData.unitType==='Sq Feet'){row.querySelector('.dimension-unit-select').value=itemData.dimensionUnit||'feet';row.querySelector('.width-input').value=itemData.width||'';row.querySelector('.height-input').value=itemData.height||'';}handleUnitTypeChange({target:row.querySelector('.unit-type-select')});updateItemAmount(row);}catch(e){console.error("Populate err:",e);}}
function handleItemTableClick(event) { // Handles clicks within the table body
     if (event.target.closest('.delete-item-btn')) {
         const r=event.target.closest('.item-row');
         if(r){
             r.remove();
             hideProductSuggestions(); // Hide if suggestion was open for this row
             updateOrderSummary();
             updateCalculationPreview();
         }
     }
     // Note: Click on suggestion items is handled by handleSuggestionClick directly
}

// Renamed from handleSuggestionMouseDown to handleSuggestionClick as listener changed
function handleSuggestionClick(event) {
     const pLI = event.target.closest('.product-suggestions-list li[data-product]');
     const cLI = event.target.closest('.suggestions-box li[data-customer-id]'); // For customer suggestions

     if (pLI) {
         event.preventDefault(); // Prevent any default action if needed
         try {
             const productDataString = pLI.dataset.product || '{}';
             const pD = JSON.parse(productDataString);
             if (activeProductInput) {
                 selectProductSuggestion(pD, activeProductInput);
             } else {
                 console.error("Cannot select product suggestion: No active product input found.");
             }
         } catch (e) {
             console.error("Error parsing product data or calling selectProductSuggestion:", e);
         }
     } else if (cLI) {
         // Handle customer suggestion selection (keep existing logic)
         event.preventDefault();
         fillCustomerData(cLI.dataset);
         const b = cLI.closest('.suggestions-box');
         if (b) hideSuggestionBox(b);
     }
}

function handleItemTableInput(event) { const t=event.target,r=t.closest('.item-row'); if(!r)return; if(t.matches('.product-name')){activeProductInput=t;handleProductSearchInput(event);}else if(t.matches('.quantity-input, .rate-input, .width-input, .height-input')){updateItemAmount(r);}} // updateItemAmount calls updateCalculationPreview
function handleItemTableChange(event){ const t=event.target,r=t.closest('.item-row'); if(!r)return; if(t.matches('.unit-type-select'))handleUnitTypeChange(event); else if(t.matches('.dimension-unit-select'))updateItemAmount(r);} // updateItemAmount calls updateCalculationPreview

// --- Sq Ft Calculation Logic ---
function calculateFlexDimensions(unit, width, height) { const m=[3,4,5,6,8,10]; let w=(unit==='inches')?parseFloat(width||0)/12:parseFloat(width||0), h=(unit==='inches')?parseFloat(height||0)/12:parseFloat(height||0); if(isNaN(w)||isNaN(h)||w<=0||h<=0) return{realSqFt:0, printSqFt:0, realWidthFt:0, realHeightFt:0, printWidthFt:0, printHeightFt:0}; const r=w*h; let b={pW:0,pH:0,pS:Infinity}; const fW=m.find(x=>x>=w); let pW1=fW||w, pH1=h, pS1=pW1*pH1; const fH=m.find(x=>x>=h); let pW2=w, pH2=fH||h, pS2=pW2*pH2; if(pS1<=pS2){b.pW=pW1; b.pH=pH1; b.pS=pS1;} else{b.pW=pW2; b.pH=pH2; b.pS=pS2;} return{realSqFt:r, printWidthFt:b.pW, printHeightFt:b.pH, printSqFt:b.pS, realWidthFt: w, realHeightFt: h };}
function handleUnitTypeChange(event) { const r=event.target.closest('.item-row'); if(!r)return; const uT=event.target.value; r.querySelectorAll('.sq-feet-input').forEach(e=>e.style.display=(uT==='Sq Feet')?'':'none'); r.closest('table')?.querySelectorAll('thead th.sq-feet-header').forEach(h=>h.classList.toggle('hidden-col',uT!=='Sq Feet')); r.querySelector('.rate-input').placeholder=(uT==='Sq Feet')?'Rate/SqFt':'Rate/Unit'; if(uT!=='Sq Feet'){r.querySelector('.width-input').value=''; r.querySelector('.height-input').value='';} updateItemAmount(r);}
function updateItemAmount(row) { if (!row) return; const uTS=row.querySelector('.unit-type-select'),aS=row.querySelector('.item-amount'),rI=row.querySelector('.rate-input'),qI=row.querySelector('.quantity-input'),mR=parseFloat(rI?.dataset.minRate||-1); let cA=0,rV=parseFloat(rI?.value||0),q=parseInt(qI?.value||1); if(isNaN(q)||q<1)q=1; try{if(mR>=0&&rV<mR){rI.classList.add('input-error');rI.title=`Rate < Min: ${formatCurrency(mR)}`;}else{rI.classList.remove('input-error');rI.title='';} if(uTS?.value==='Sq Feet'){const dUS=row.querySelector('.dimension-unit-select'),wI=row.querySelector('.width-input'),hI=row.querySelector('.height-input'); const u=dUS?.value||'feet',w=parseFloat(wI?.value||0),h=parseFloat(hI?.value||0); if(w>0&&h>0&&rV>=0){const cR=calculateFlexDimensions(u,w,h);cA=parseFloat(cR.printSqFt||0)*q*rV;}}else{if(rV>=0)cA=q*rV;}}catch(e){console.error("Amt calc error:",e);cA=0;} if(aS)aS.textContent=cA.toFixed(2); updateOrderSummary(); updateCalculationPreview(); }

// --- Calculation Preview Logic ---
function updateCalculationPreview() { if (!calculationPreviewArea || !calculationPreviewContent || !orderItemsTableBody) { console.warn("Calc preview elements missing."); return; } let entriesHTML = ''; const itemRows = orderItemsTableBody.querySelectorAll('.item-row'); let foundSqFt = false; itemRows.forEach((row, index) => { const unitTypeSelect = row.querySelector('.unit-type-select'); if (unitTypeSelect?.value === 'Sq Feet') { foundSqFt = true; const productNameInput = row.querySelector('.product-name'); const productName = productNameInput?.value.trim() || `Item ${index + 1}`; const dimensionUnitSelect = row.querySelector('.dimension-unit-select'); const widthInput = row.querySelector('.width-input'); const heightInput = row.querySelector('.height-input'); const quantityInput = row.querySelector('.quantity-input'); const unit = dimensionUnitSelect?.value || 'feet'; const width = parseFloat(widthInput?.value || 0); const height = parseFloat(heightInput?.value || 0); let quantity = parseInt(quantityInput?.value || 1); if (isNaN(quantity) || quantity < 1) quantity = 1; let entryContent = `<div class="item-preview-entry"><strong>${productName}:</strong><br>`; if (width > 0 && height > 0) { const calcResult = calculateFlexDimensions(unit, width, height); if (calcResult && parseFloat(calcResult.printSqFt) > 0) { const realSqFtNum = parseFloat(calcResult.realSqFt); const printSqFtNum = parseFloat(calcResult.printSqFt); const wastageSqFt = (printSqFtNum - realSqFtNum); const tolerance = 0.01; let wastageDesc = (wastageSqFt > tolerance) ? `<span style="color: orange;">Wastage: ${wastageSqFt.toFixed(2)} sq ft/item</span>` : `<span style="color: green;">Wastage: ${wastageSqFt.toFixed(2)} sq ft/item</span>`; entryContent += `&nbsp; Qty: ${quantity}<br>`; entryContent += `&nbsp; Real: ${calcResult.realWidthFt?.toFixed(2) ?? '?'}ft x ${calcResult.realHeightFt?.toFixed(2) ?? '?'}ft = ${realSqFtNum.toFixed(2)} sq ft/item<br>`; entryContent += `&nbsp; Print: ${calcResult.printWidthFt.toFixed(2)}ft x ${calcResult.printHeightFt.toFixed(2)}ft = ${printSqFtNum.toFixed(2)} sq ft/item<br>`; entryContent += `&nbsp; Total Print Area: ${(printSqFtNum * quantity).toFixed(2)} sq ft<br>`; entryContent += `&nbsp; ${wastageDesc}`; } else { entryContent += `&nbsp; <span style="color:orange;">Invalid dimensions or calc error.</span>`; } } else { entryContent += `&nbsp; <span style="color:grey;">Enter valid width & height.</span>`; } entryContent += `</div>`; entriesHTML += entryContent; } }); if (foundSqFt) { calculationPreviewContent.innerHTML = entriesHTML || '<p style="color:grey;">Enter dimensions.</p>'; calculationPreviewArea.style.display = 'block'; } else { calculationPreviewArea.style.display = 'none'; } }

// --- Order Summary Calculation ---
function updateOrderSummary() { let s=0; if(orderItemsTableBody) orderItemsTableBody.querySelectorAll('.item-row .item-amount').forEach(sp=>s+=parseFloat(sp.textContent||0)); let dP=parseFloat(summaryDiscountPercentInput?.value||0),dA=parseFloat(summaryDiscountAmountInput?.value||0),cDA=0; if(!isDiscountInputProgrammaticChange){if(document.activeElement===summaryDiscountPercentInput&&!isNaN(dP)){cDA=s*(dP/100); isDiscountInputProgrammaticChange=true; if(summaryDiscountAmountInput) summaryDiscountAmountInput.value=cDA.toFixed(2); isDiscountInputProgrammaticChange=false;}else if(document.activeElement===summaryDiscountAmountInput&&!isNaN(dA)){cDA=dA; if(s>0){const cP=(cDA/s)*100; isDiscountInputProgrammaticChange=true; if(summaryDiscountPercentInput) summaryDiscountPercentInput.value=cP.toFixed(2); isDiscountInputProgrammaticChange=false;}else{isDiscountInputProgrammaticChange=true; if(summaryDiscountPercentInput) summaryDiscountPercentInput.value=''; isDiscountInputProgrammaticChange=false;}}else{if(!isNaN(dP)&&dP>0)cDA=s*(dP/100); else if(!isNaN(dA)&&dA>0)cDA=dA; else cDA=0;}} cDA=Math.max(0,Math.min(cDA,s)); const fA=s-cDA,aP=parseFloat(summaryAdvancePaymentInput?.value||0),tB=fA-aP; if(summarySubtotalSpan)summarySubtotalSpan.textContent=s.toFixed(2); if(summaryFinalAmountSpan)summaryFinalAmountSpan.textContent=fA.toFixed(2); if(summaryTotalBalanceSpan)summaryTotalBalanceSpan.textContent=tB.toFixed(2); checkCreditLimit();}
function handleDiscountInput(event) { if(isDiscountInputProgrammaticChange)return; const cI=event.target; isDiscountInputProgrammaticChange=true; if(cI===summaryDiscountPercentInput){if(summaryDiscountAmountInput)summaryDiscountAmountInput.value='';}else if(cI===summaryDiscountAmountInput){if(summaryDiscountPercentInput)summaryDiscountPercentInput.value='';} isDiscountInputProgrammaticChange=false; updateOrderSummary();}

// --- Customer Autocomplete & Details ---
async function getOrFetchCustomerCache() { if(customerCache.length>0)return Promise.resolve(); if(customerFetchPromise)return customerFetchPromise; console.log("Fetching customers..."); try{if(!db||!collection||!query||!getDocs||!orderBy)throw new Error("DB func missing"); const q=query(collection(db,"customers"),orderBy("fullName")); customerFetchPromise=getDocs(q).then(s=>{customerCache=s.docs.map(d=>({id:d.id,...d.data()})); console.log(`Cached ${customerCache.length} customers.`); customerFetchPromise=null;}).catch(e=>{console.error(e);customerFetchPromise=null;throw e;}); return customerFetchPromise;}catch(e){console.error(e);customerFetchPromise=null;return Promise.reject(e);}}
function handleCustomerInput(event, type) { const i=event.target,t=i.value.trim(),b=type==='name'?customerSuggestionsNameBox:customerSuggestionsWhatsAppBox; if(!b)return; resetCustomerSelectionUI(false); if(t.length<1){clearTimeout(customerSearchDebounceTimer); hideSuggestionBox(b);return;} clearTimeout(customerSearchDebounceTimer); customerSearchDebounceTimer=setTimeout(()=>{getOrFetchCustomerCache().then(()=>filterAndRenderCustomerSuggestions(t,type,b,i)).catch(e=>console.error(e));},300);}
function filterAndRenderCustomerSuggestions(term, type, box, inputElement) { const l=term.toLowerCase(), f=type==='name'?'fullName':'whatsappNo', d=customerCache.filter(c=>String(c[f]||'').toLowerCase().includes(l)).slice(0,10); renderCustomerSuggestions(d,term,box,inputElement);}
function renderCustomerSuggestions(suggestions, term, box, inputElement) { if(!box)return; const ul=box.querySelector('ul')||document.createElement('ul'); ul.innerHTML=''; if(suggestions.length===0){ul.innerHTML='<li class="no-suggestions">No matching customers found.</li>';}else{suggestions.forEach(c=>{const li=document.createElement('li'); const dN=`${c.fullName} (${c.whatsappNo})`; try{li.innerHTML=dN.replace(new RegExp(`(${term.replace(/[-\/\^$*+?.()|[\]{}]/g,'\$&')})`,'gi'),'<strong>$1</strong>');}catch{li.textContent=dN;} li.dataset.customerId=c.id; li.dataset.customerName=c.fullName; li.dataset.customerWhatsapp=c.whatsappNo; li.dataset.customerAddress=c.billingAddress||c.address||''; li.dataset.customerContact=c.contactNo||''; li.addEventListener('click',(e)=>{e.preventDefault();fillCustomerData(li.dataset);hideSuggestionBox(box);}); ul.appendChild(li);});} if(!box.contains(ul))box.appendChild(ul); box.classList.add('active'); box.style.display='block'; const iR=inputElement.getBoundingClientRect(); box.style.position='absolute'; box.style.left='0'; box.style.top=`${iR.height}px`; box.style.width=`${iR.width}px`; box.style.zIndex='1000';}
function fillCustomerData(customerData) { if (!customerData || !customerData.customerId) { resetCustomerSelectionUI(); return; } console.log("Filling customer:", customerData); customerNameInput.value = customerData.customerName || ''; customerWhatsAppInput.value = customerData.customerWhatsapp || ''; customerAddressInput.value = customerData.customerAddress || ''; customerContactInput.value = customerData.customerContact || ''; selectedCustomerId = customerData.customerId; if (selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId; fetchAndDisplayCustomerDetails(selectedCustomerId); }
async function fetchAndDisplayCustomerDetails(customerId) { console.log("Fetching details:", customerId); resetCustomerSelectionUI(false); if (!customerId) return; try { let c = customerCache.find(c => c.id === customerId); if (!c) { const d = await getDoc(doc(db, "customers", customerId)); if (d.exists()) c = { id: d.id, ...d.data() }; else { console.warn("Cust not found in DB:", customerId); return; } } selectedCustomerData = c; let b = 'N/A'; /* TODO: Needs calculateCustomerBalance(customerId) */ if(customerBalanceArea) { customerCurrentBalanceSpan.textContent = (b !== 'N/A') ? formatCurrency(b) : 'N/A'; customerCurrentBalanceSpan.classList.toggle('positive-balance', b < 0); customerBalanceArea.style.display = 'block'; } if(viewCustomerAccountLink && customerAccountLinkArea) { viewCustomerAccountLink.href = `customer_account_detail.html?id=${encodeURIComponent(customerId)}`; customerAccountLinkArea.style.display = 'block'; } checkCreditLimit(); } catch(e) { console.error("Fetch details error:", e); resetCustomerSelectionUI(); } }
function resetCustomerSelectionUI(clearInputs = true) { console.log("Resetting customer UI."); selectedCustomerId = null; selectedCustomerData = null; if (selectedCustomerIdInput) selectedCustomerIdInput.value = ''; if (customerAccountLinkArea) customerAccountLinkArea.style.display = 'none'; if (customerBalanceArea) customerBalanceArea.style.display = 'none'; if (customerCurrentBalanceSpan) customerCurrentBalanceSpan.textContent = ''; if (creditLimitWarningDiv) creditLimitWarningDiv.style.display = 'none'; if (clearInputs) { if(customerNameInput) customerNameInput.value = ''; if(customerWhatsAppInput) customerWhatsAppInput.value = ''; if(customerAddressInput) customerAddressInput.value = ''; if(customerContactInput) customerContactInput.value = ''; } }

// --- Credit Limit Check ---
function checkCreditLimit() { if(!selectedCustomerData||!selectedCustomerData.creditAllowed){if(creditLimitWarningDiv)creditLimitWarningDiv.style.display='none';return;} const cl=parseFloat(selectedCustomerData.creditLimit||0); const cbT=customerCurrentBalanceSpan?.textContent||'0'; const cb=isNaN(parseFloat(cbT.replace(/[^0-9.-]+/g,"")))?0:parseFloat(cbT.replace(/[^0-9.-]+/g,"")); const faT=summaryFinalAmountSpan?.textContent||'0'; const nOV=parseFloat(faT)||0; if(isNaN(cb)||isNaN(nOV)){if(creditLimitWarningDiv)creditLimitWarningDiv.style.display='none';return;} const pb=cb+nOV; console.log(`Credit Check: L=${cl}, CB=${cb}, NOV=${nOV}, PB=${pb}`); if(cl>0&&pb>cl){if(creditLimitWarningDiv){creditLimitWarningDiv.textContent=`Warning: Exceeds credit limit of ${formatCurrency(cl)}. Potential Balance: ${formatCurrency(pb)}.`; creditLimitWarningDiv.style.display='block';}}else{if(creditLimitWarningDiv)creditLimitWarningDiv.style.display='none';}}


// --- Product Autocomplete ---
function getOrCreateProductSuggestionsDiv() {
    if (!productSuggestionsDiv) {
        productSuggestionsDiv = document.createElement('div');
        productSuggestionsDiv.className = 'product-suggestions-list';
        productSuggestionsDiv.style.display = 'none';
        document.body.appendChild(productSuggestionsDiv);
        // *** CHANGE: Use 'click' instead of 'mousedown' ***
        productSuggestionsDiv.addEventListener('click', handleSuggestionClick);
    }
    return productSuggestionsDiv;
}
function positionProductSuggestions(inputElement) { const s=getOrCreateProductSuggestionsDiv(), r=inputElement.getBoundingClientRect(); s.style.position='absolute'; s.style.left=`${r.left+window.scrollX}px`; s.style.top=`${r.bottom+window.scrollY}px`; s.style.width=`${r.width<250?250:r.width}px`; s.style.display='block'; s.style.zIndex='1050';}
function hideProductSuggestions() { if(productSuggestionsDiv)productSuggestionsDiv.style.display='none'; activeProductInput=null;}
function handleProductSearchInput(event) { const i=event.target; if(!i.matches('.product-name'))return; activeProductInput=i; clearTimeout(productSearchDebounceTimer); const t=i.value.trim(); if(t.length<1){hideProductSuggestions();return;} positionProductSuggestions(i); productSearchDebounceTimer=setTimeout(()=>{if(document.activeElement===i&&activeProductInput===i){getOrFetchProductCache().then(()=>filterAndRenderProductSuggestions(t,i)).catch(e=>console.error("Prod filter err:",e));}},350);}
async function getOrFetchProductCache() { if(productCache.length>0)return Promise.resolve(); if(productFetchPromise)return productFetchPromise; console.log("Fetching products..."); try{if(!db||!collection||!query||!getDocs||!orderBy)throw new Error("DB func missing"); const q=query(collection(db,"products"),orderBy("printName")); productFetchPromise=getDocs(q).then(s=>{productCache=s.docs.map(d=>{const dt=d.data(); return{id:d.id,name:dt.printName,unit:dt.unit,salePrice:dt.salePrice,minSalePrice:dt.minSalePrice};}); console.log(`Cached ${productCache.length} products.`); productFetchPromise=null;}).catch(e=>{console.error("Prod fetch err:",e);productFetchPromise=null;throw e;}); return productFetchPromise;}catch(e){console.error("Prod fetch setup err:",e);productFetchPromise=null;return Promise.reject(e);}}
function filterAndRenderProductSuggestions(term, inputElement) { const s=getOrCreateProductSuggestionsDiv(); s.innerHTML='<ul><li class="no-suggestions">Loading...</li></ul>'; if(activeProductInput!==inputElement){hideProductSuggestions();return;} positionProductSuggestions(inputElement); const l=term.toLowerCase(), f=productCache.filter(p=>p.name?.toLowerCase().includes(l)).slice(0,10); renderProductSuggestions(f,term,s);}
function renderProductSuggestions(suggestions, term, suggestionsContainer) { if(!suggestionsContainer)return; const ul=document.createElement('ul'); if(suggestions.length===0){ul.innerHTML='<li class="no-suggestions">No matching products found.</li>';}else{suggestions.forEach(p=>{const li=document.createElement('li'); try{li.innerHTML=p.name.replace(new RegExp(`(${term.replace(/[-\/\^$*+?.()|[\]{}]/g,'\$&')})`,'gi'),'<strong>$1</strong>');}catch{li.textContent=p.name;} li.dataset.product=JSON.stringify(p); ul.appendChild(li);});} suggestionsContainer.innerHTML=''; suggestionsContainer.appendChild(ul); suggestionsContainer.style.display='block';}

function selectProductSuggestion(productData, inputElement) {
    console.log("selectProductSuggestion called. Data:", productData); // Keep this log for basic check
    try {
        const r = inputElement.closest('.item-row');
        if (!r || !productData) {
            hideProductSuggestions();
            return;
        }
        const pNI = r.querySelector('.product-name');
        const uTS = r.querySelector('.unit-type-select');
        const rI = r.querySelector('.rate-input');
        const qI = r.querySelector('.quantity-input');

        if (!pNI || !uTS || !rI || !qI ) {
             console.error("Error in selectProductSuggestion: One or more elements not found in the row!");
            hideProductSuggestions();
            return;
        }

        pNI.value = productData.name || '';
        rI.value = productData.salePrice !== undefined ? productData.salePrice : '';
        const mR = productData.minSalePrice;
        rI.dataset.minRate = mR !== undefined && mR !== null ? mR : '-1';

        let dUT = 'Qty';
        if (productData.unit) {
            const uL = String(productData.unit).toLowerCase();
            if (uL.includes('sq') || uL.includes('ft')) dUT = 'Sq Feet';
        }
        uTS.value = dUT;

        hideProductSuggestions(); // Hide after selection

        // Trigger change event to update UI (like Sq Ft fields visibility) and calculations
        const cE = new Event('change', { bubbles: true });
        uTS.dispatchEvent(cE);

        // Set focus to the next logical input
        let nI = null;
        if (dUT === 'Sq Feet') nI = r.querySelector('.width-input');
        if (!nI) nI = qI; // Fallback to quantity if not Sq Feet or width input not found
        if (nI) {
            nI.focus();
            if (typeof nI.select === 'function') nI.select();
        } else {
            rI.focus(); // Fallback to rate input if others aren't found
        }

    } catch (error) {
        console.error("Error inside selectProductSuggestion:", error);
        hideProductSuggestions(); // Ensure suggestions are hidden on error
    }
}

// --- Status Checkbox Handling ---
function handleStatusCheckboxes(isEditing) { const dS="Order Received";let dC=null;orderStatusCheckboxes.forEach(c=>{if(c.value===dS)dC=c;c.disabled=false;c.closest('label').classList.remove('disabled');c.removeEventListener('change',handleStatusChange);c.addEventListener('change',handleStatusChange);});const iAC=Array.from(orderStatusCheckboxes).some(c=>c.checked);if(!isEditing&&!iAC&&dC)dC.checked=true;}
function handleStatusChange(event) { const cC=event.target;if(cC.checked){orderStatusCheckboxes.forEach(oC=>{if(oC!==cC)oC.checked=false;});}}

// --- Form Submit Handler ---
async function handleFormSubmit(event) { event.preventDefault();console.log("Submit...");showFormError('');if(!db||!addDoc||!doc||!updateDoc||!Timestamp||!getDoc||!getDocs||!collection||!query||!limit){showFormError("DB func error.");return;} if(!saveButton){console.error("Save btn missing");return;} saveButton.disabled=true;if(saveButtonText)saveButtonText.textContent=isEditMode?'Updating...':'Saving...';else saveButton.innerHTML='<i class="fas fa-spinner fa-spin"></i> Saving...'; try{const cFN=customerNameInput.value.trim();const cW=customerWhatsAppInput.value.trim();let cId=selectedCustomerId;if(!cFN)throw new Error("Customer Name required.");if(!cW)throw new Error("WhatsApp No required.");const cD={fullName:cFN,whatsappNo:cW,address:customerAddressInput.value.trim()||'',contactNo:customerContactInput.value.trim()||''};const oDV=orderDateInput.value;const dDV=deliveryDateInput.value||'';const uV=orderForm.querySelector('input[name="urgent"]:checked')?.value||'No';const rV=remarksInput.value.trim()||'';const sC=orderForm.querySelector('input[name="order_status"]:checked');const sS=sC?sC.value:'Order Received';if(!oDV)throw new Error("Order Date required."); let oId;const mId=manualOrderIdInput.value.trim();const eId=displayOrderIdInput.value; if(isEditMode){oId=currentOrderData?.orderId||eId||orderIdToEdit;}else if(mId){oId=mId;}else{oId=Date.now().toString();console.log(`Generated ID: ${oId}`);} const items=[];const rows=orderItemsTableBody.querySelectorAll('.item-row');if(rows.length===0)throw new Error("Add at least one item."); let valid=true; rows.forEach((row,idx)=>{if(!valid)return;const pNI=row.querySelector('.product-name'),uTS=row.querySelector('.unit-type-select'),qI=row.querySelector('.quantity-input'),rI=row.querySelector('.rate-input'),dUS=row.querySelector('.dimension-unit-select'),wI=row.querySelector('.width-input'),hI=row.querySelector('.height-input');const pN=pNI?.value.trim(),uT=uTS?.value,q=parseInt(qI?.value||0),r=parseFloat(rI?.value||0),mR=parseFloat(rI?.dataset.minRate||-1);if(!pN){valid=false;showFormError(`Item ${idx+1}: Product Name req.`);pNI?.focus();return;}if(isNaN(q)||q<=0){valid=false;showFormError(`Item ${idx+1}: Valid Qty req.`);qI?.focus();return;}if(isNaN(r)||r<0){valid=false;showFormError(`Item ${idx+1}: Valid Rate req.`);rI?.focus();return;}if(mR>=0&&r<mR){valid=false;showFormError(`Item ${idx+1}: Rate (${formatCurrency(r)}) < Minimum (${formatCurrency(mR)}).`);rI?.focus();return;}const iD={productName:pN,unitType:uT,quantity:q,rate:r,minSalePrice:mR>=0?mR:null};if(uT==='Sq Feet'){const dU=dUS?.value||'feet',w=parseFloat(wI?.value||0),h=parseFloat(hI?.value||0);if(isNaN(w)||w<=0){valid=false;showFormError(`Item ${idx+1}: Valid Width req.`);wI?.focus();return;}if(isNaN(h)||h<=0){valid=false;showFormError(`Item ${idx+1}: Valid Height req.`);hI?.focus();return;}const cR=calculateFlexDimensions(dU,w,h);iD.dimensionUnit=dU;iD.width=w;iD.height=h;iD.realSqFt=cR.realSqFt;iD.printSqFt=cR.printSqFt;iD.itemAmount=parseFloat((cR.printSqFt*q*r).toFixed(2));}else{iD.itemAmount=parseFloat((q*r).toFixed(2));}items.push(iD);}); if(!valid){saveButton.disabled=false;if(saveButtonText)saveButtonText.textContent=isEditMode?'Update Order':'Save Order';else saveButton.innerHTML=`<i class="fas fa-save"></i> ${isEditMode?'Update Order':'Save Order'}`;return;} let subT=0;items.forEach(i=>{subT+=i.itemAmount;});let dP=parseFloat(summaryDiscountPercentInput?.value||0),dA=parseFloat(summaryDiscountAmountInput?.value||0);let cDA=0;if(!isNaN(dP)&&dP>0)cDA=parseFloat((subT*(dP/100)).toFixed(2));else if(!isNaN(dA)&&dA>0)cDA=dA;cDA=Math.max(0,Math.min(cDA,subT));let fA=parseFloat((subT-cDA).toFixed(2)),aP=parseFloat(summaryAdvancePaymentInput?.value||0),tB=parseFloat((fA-aP).toFixed(2));const payload={orderId:oId,customerId:cId||null,customerDetails:cD,orderDate:oDV,deliveryDate:dDV,urgent:uV,remarks:rV,status:sS,items:items,subTotal:subT,discountPercentage:dP||0,discountAmount:cDA||0,finalAmount:fA,advancePayment:aP||0,totalBalance:tB,updatedAt:Timestamp.now()};if(!isEditMode)payload.createdAt=Timestamp.now();let savedId,msg;if(isEditMode){if(!orderIdToEdit)throw new Error("Missing ID for update.");await updateDoc(doc(db,"orders",orderIdToEdit),payload);savedId=orderIdToEdit;msg=`Order ${oId} updated!`;}else{const ref=await addDoc(collection(db,"orders"),payload);savedId=ref.id;msg=`Order ${oId} created!`;displayOrderIdInput.value=oId;}console.log(msg,"Doc ID:",savedId);if(aP>0){console.log("Adding advance payment...");try{const pD={customerId:cId,orderRefId:savedId,orderId:oId,amountPaid:aP,paymentDate:Timestamp.fromDate(new Date(oDV+'T00:00:00')),paymentMethod:"Order Advance",notes:`Advance for Order #${oId}`,createdAt:Timestamp.now()};if(!pD.customerId){alert("Order saved, advance not recorded (Customer ID missing).");}else{await addDoc(collection(db,"payments"),pD);console.log("Advance payment added.");}}catch(pE){console.error("Adv payment error:",pE);alert(`Order saved, error recording advance: ${pE.message}`);}}alert(msg);if(cD.whatsappNo){showWhatsAppReminder(cD,oId,dDV);}else{if(!isEditMode)resetNewOrderForm();}}catch(error){console.error("Submit error:",error);showFormError("Error: "+error.message);}finally{saveButton.disabled=false;const txt=isEditMode?"Update Order":"Save Order";if(saveButtonText)saveButtonText.textContent=txt;else saveButton.innerHTML=`<i class="fas fa-save"></i> ${txt}`;}}

// --- Reset Form ---
function resetNewOrderForm() { console.log("Resetting form."); orderForm.reset(); if(orderItemsTableBody) orderItemsTableBody.innerHTML=''; selectedCustomerId=null; selectedCustomerData=null; currentOrderData=null; isEditMode=false; orderIdToEdit=null; if(hiddenEditOrderIdInput)hiddenEditOrderIdInput.value=''; if(selectedCustomerIdInput)selectedCustomerIdInput.value=''; if(headerText)headerText.textContent="New Order"; if(breadcrumbAction)breadcrumbAction.textContent="New Order"; if(saveButtonText)saveButtonText.textContent="Save Order"; else if(saveButton)saveButton.innerHTML=`<i class="fas fa-save"></i> Save Order`; if(manualOrderIdInput)manualOrderIdInput.readOnly=false; if(orderDateInput)orderDateInput.value=new Date().toISOString().split('T')[0]; handleStatusCheckboxes(false); resetCustomerSelectionUI(true); updateOrderSummary(); handleAddItem(); showFormError(''); hideProductSuggestions(); if(customerSuggestionsNameBox) hideSuggestionBox(customerSuggestionsNameBox); if(customerSuggestionsWhatsAppBox) hideSuggestionBox(customerSuggestionsWhatsAppBox); }

// --- WhatsApp Reminder Functions ---
function showWhatsAppReminder(customer, orderId, deliveryDate) { if(!whatsappReminderPopup||!whatsappMsgPreview||!whatsappSendLink){if(!isEditMode)resetNewOrderForm();return;} const cN=customer.fullName||'Customer',cNum=customer.whatsappNo?.replace(/[^0-9]/g,''); if(!cNum){if(!isEditMode)resetNewOrderForm();return;} const fDD=deliveryDate?new Date(deliveryDate).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):' जल्द से जल्द'; let msg=`प्रिय ${cN},\nआपका ऑर्डर (Order ID: ${orderId}) सफलतापूर्वक सहेज लिया गया है। डिलीवरी की अनुमानित तिथि: ${fDD}.\nधन्यवाद,\nMadhav Offset`; whatsappMsgPreview.innerText=msg; const eM=encodeURIComponent(msg); const wUrl=`https://wa.me/${cNum}?text=${eM}`; whatsappSendLink.href=wUrl; whatsappReminderPopup.classList.add('active'); whatsappSendLink.onclick=()=>{if(!isEditMode)resetNewOrderForm(); closeWhatsAppPopup();}; popupCloseBtn.onclick=()=>{if(!isEditMode)resetNewOrderForm(); closeWhatsAppPopup();}; whatsappReminderPopup.onclick=(e)=>{if(e.target===whatsappReminderPopup){if(!isEditMode)resetNewOrderForm(); closeWhatsAppPopup();}}; }
function closeWhatsAppPopup() { if(whatsappReminderPopup)whatsappReminderPopup.classList.remove('active'); whatsappSendLink.onclick=null; popupCloseBtn.onclick=null; whatsappReminderPopup.onclick=null; if(whatsappReminderPopup)whatsappReminderPopup.addEventListener('click',(e)=>{if(e.target===whatsappReminderPopup)closeWhatsAppPopup();}); if(popupCloseBtn)popupCloseBtn.addEventListener('click',closeWhatsAppPopup); }

console.log("new_order.js script loaded (v2.2.1).");

