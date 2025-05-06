// /agent/js/agent_create_order.js

// Firebase कॉन्फिग और जरूरी फंक्शन्स इम्पोर्ट करें
// Ensure Timestamp, serverTimestamp, addDoc, arrayUnion etc. are exported from config
import { 
    db, auth, collection, query, where, orderBy, limit, getDocs, 
    doc, getDoc, addDoc, updateDoc, Timestamp, serverTimestamp, 
    runTransaction, arrayUnion 
} from './agent_firebase_config.js'; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Global Variables ---
let productCache = [];
let customerCache = [];
let productFetchPromise = null;
let customerFetchPromise = null;
let activeProductInput = null; 
let productSuggestionsDiv = null; 
let customerSearchDebounceTimer;
let isDiscountInputProgrammaticChange = false;
let selectedCustomerId = null; 
let selectedCustomerData = null; 

// --- DOM Element References ---
const orderForm = document.getElementById('agentNewOrderForm');
const customerNameInput = document.getElementById('agent_customer_name');
const customerWhatsAppInput = document.getElementById('agent_customer_whatsapp');
const customerAddressInput = document.getElementById('agent_customer_address');
const customerContactInput = document.getElementById('agent_customer_contact');
const customerSuggestionsNameBox = document.getElementById('agent-customer-suggestions-name');
const customerSuggestionsWhatsAppBox = document.getElementById('agent-customer-suggestions-whatsapp');
const selectedCustomerIdInput = document.getElementById('agentSelectedCustomerId');
const orderItemsTableBody = document.getElementById('agentOrderItemsTableBody');
const itemRowTemplate = document.getElementById('agent-item-row-template');
const addItemBtn = document.getElementById('agentAddItemBtn');
const summarySubtotalSpan = document.getElementById('agentSummarySubtotal');
const summaryDiscountPercentInput = document.getElementById('agentSummaryDiscountPercent');
const summaryDiscountAmountInput = document.getElementById('agentSummaryDiscountAmount');
const summaryFinalAmountSpan = document.getElementById('agentSummaryFinalAmount');
const deliveryDateInput = document.getElementById('agent_delivery_date');
const remarksInput = document.getElementById('agent_remarks');
// const urgentRadioYes = document.querySelector('input[name="agent_urgent"][value="Yes"]'); // Get specific radio
const saveOrderBtn = document.getElementById('agentSaveOrderBtn');
const formErrorMsg = document.getElementById('agentFormErrorMsg');

// --- Helper Functions ---
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') unsafe = String(unsafe || ''); return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");}
function formatCurrency(amount) { const num = Number(amount); if (amount === null || amount === undefined || isNaN(num)) { return 'N/A'; } return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });}
function showFormError(message) { if(formErrorMsg){ formErrorMsg.textContent = message; formErrorMsg.style.display = message ? 'block' : 'none'; if(message)formErrorMsg.scrollIntoView({behavior:'smooth', block:'center'}); } else if(message) { alert(message); } }
function hideSuggestionBox(box) { if(box){box.classList.remove('active');box.style.display='none';}}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    if (!orderForm || !addItemBtn || !orderItemsTableBody || !itemRowTemplate || !db) {
        console.error("Create Order form elements or DB missing!");
        showFormError("Error: Page initialization failed. Cannot create orders.");
        return;
    }

    // Check Auth State - Redirect if not logged in
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            console.log("Agent not logged in on create order page. Redirecting...");
            window.location.replace('agent_login.html');
        } else {
            console.log("Agent authenticated:", user.uid);
            // User is logged in, proceed with setup
            attachEventListeners();
            addInitialItemRow();
            preFetchCaches();
        }
    });
});

function attachEventListeners() {
    addItemBtn.addEventListener('click', handleAddItem);
    orderItemsTableBody.addEventListener('click', handleItemTableClick); 
    orderItemsTableBody.addEventListener('input', handleItemTableInput); 
    orderItemsTableBody.addEventListener('change', handleItemTableChange); 
    orderItemsTableBody.addEventListener('focusin', (event) => { 
        if (event.target.matches('.product-name')) activeProductInput = event.target; 
    });
    
    if (customerNameInput) customerNameInput.addEventListener('input', (e) => handleCustomerInput(e, 'name'));
    if (customerWhatsAppInput) customerWhatsAppInput.addEventListener('input', (e) => handleCustomerInput(e, 'whatsapp'));
    document.addEventListener('click', handleGlobalClickForSuggestions);

    if(summaryDiscountPercentInput) summaryDiscountPercentInput.addEventListener('input', handleDiscountInput);
    if(summaryDiscountAmountInput) summaryDiscountAmountInput.addEventListener('input', handleDiscountInput);
    
    orderForm.addEventListener('submit', handleFormSubmit); // Attach submit handler

    console.log("Agent Create Order Event Listeners Attached.");
}

function addInitialItemRow() {
    // Add one empty row when the page loads if none exist
    if(orderItemsTableBody && orderItemsTableBody.rows.length === 0){
        handleAddItem();
    }
}

// --- Event Handlers & Logic (Add/Remove Item, Calculations etc. remain the same) ---

function handleAddItem() { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ if (!itemRowTemplate || !orderItemsTableBody) return; const templateContent = itemRowTemplate.content.cloneNode(true); const newRow = templateContent.querySelector('.item-row'); if (newRow) { orderItemsTableBody.appendChild(newRow); const addedRow = orderItemsTableBody.lastElementChild; if (addedRow) { addItemRowEventListeners(addedRow); const firstInput = addedRow.querySelector('.product-name'); if (firstInput) firstInput.focus(); updateOrderSummary(); } } }
function addItemRowEventListeners(row) { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ const unitTypeSelect = row.querySelector('.unit-type-select'); const dimensionUnitSelect = row.querySelector('.dimension-unit-select'); const widthInput = row.querySelector('.width-input'); const heightInput = row.querySelector('.height-input'); const quantityInput = row.querySelector('.quantity-input'); const rateInput = row.querySelector('.rate-input'); const deleteBtn = row.querySelector('.delete-item-btn'); const productNameInput = row.querySelector('.product-name'); const recalcInputs = [dimensionUnitSelect, widthInput, heightInput, quantityInput, rateInput]; recalcInputs.forEach(input => { if (input) { input.addEventListener('input', () => updateItemAmount(row)); input.addEventListener('change', () => updateItemAmount(row)); } }); if (unitTypeSelect) { unitTypeSelect.addEventListener('change', handleUnitTypeChange); handleUnitTypeChange({ target: unitTypeSelect }); } if (deleteBtn) { deleteBtn.addEventListener('click', () => { row.remove(); hideProductSuggestions(); updateOrderSummary(); /* updateCalculationPreview(); */ }); } if (productNameInput) { productNameInput.addEventListener('input', handleProductSearchInput); } }
function handleItemTableClick(event) { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ handleSuggestionClick(event); }
function handleItemTableInput(event) { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ const target = event.target; const row = target.closest('.item-row'); if (!row) return; if (target.matches('.quantity-input, .rate-input, .width-input, .height-input')) { updateItemAmount(row); } else if (target.matches('.product-name')) { activeProductInput = target; handleProductSearchInput(event); } }
function handleItemTableChange(event){ /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ const target = event.target; const row = target.closest('.item-row'); if (!row) return; if (target.matches('.unit-type-select')) { handleUnitTypeChange(event); } else if (target.matches('.dimension-unit-select')) { updateItemAmount(row); } }
function handleUnitTypeChange(event) { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ const select = event.target; const row = select.closest('tr'); if (!row) return; const isSqFt = (select.value === 'Sq Feet'); const sqFtCells = row.querySelectorAll('.sq-feet-input'); const rateInput = row.querySelector('.rate-input'); const table = row.closest('table'); sqFtCells.forEach(cell => { cell.style.display = isSqFt ? '' : 'none'; const inputs = cell.querySelectorAll('.dimension-input'); inputs.forEach(input => input.required = isSqFt); }); table?.querySelectorAll('thead th.sq-feet-header').forEach(th => { th.classList.toggle('hidden-col', !isSqFt); }); if (rateInput) { rateInput.placeholder = isSqFt ? 'Rate/SqFt' : 'Rate/Unit'; } if (!isSqFt) { row.querySelector('.width-input')?.value = ''; row.querySelector('.height-input')?.value = ''; } updateItemAmount(row); }
function calculateFlexDimensions(unit, width, height) { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ const mediaWidthsFt = [3, 4, 5, 6, 8, 10]; let wFt = (unit === 'inches') ? parseFloat(width || 0) / 12 : parseFloat(width || 0); let hFt = (unit === 'inches') ? parseFloat(height || 0) / 12 : parseFloat(height || 0); if (isNaN(wFt) || isNaN(hFt) || wFt <= 0 || hFt <= 0) { return { realSqFt: 0, printSqFt: 0 }; } const realSqFt = wFt * hFt; let printSqFt = realSqFt; const smallerDim = Math.min(wFt, hFt); const largerDim = Math.max(wFt, hFt); let suitableMediaWidth = mediaWidthsFt.find(mediaW => mediaW >= smallerDim); if(suitableMediaWidth){ printSqFt = largerDim * suitableMediaWidth; } else { console.warn(`Dimension (${smallerDim} ft) might exceed max media width.`); printSqFt = realSqFt; } return { realSqFt: realSqFt.toFixed(2), printSqFt: printSqFt.toFixed(2) }; }
function updateItemAmount(row) { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ if (!row) return; const unitTypeSelect = row.querySelector('.unit-type-select'); const amountSpan = row.querySelector('.item-amount'); const rateInput = row.querySelector('.rate-input'); const quantityInput = row.querySelector('.quantity-input'); let calculatedAmount = 0; const rate = parseFloat(rateInput?.value || 0); let quantity = parseInt(quantityInput?.value || 1); if (isNaN(quantity) || quantity < 1) quantity = 1; try { if (unitTypeSelect?.value === 'Sq Feet') { const dimensionUnitSelect = row.querySelector('.dimension-unit-select'); const widthInput = row.querySelector('.width-input'); const heightInput = row.querySelector('.height-input'); const unit = dimensionUnitSelect?.value || 'feet'; const width = parseFloat(widthInput?.value || 0); const height = parseFloat(heightInput?.value || 0); if (width > 0 && height > 0 && !isNaN(rate) && rate >= 0) { const calcResult = calculateFlexDimensions(unit, width, height); calculatedAmount = parseFloat(calcResult.printSqFt || 0) * quantity * rate; } } else { if (!isNaN(rate) && rate >= 0) { calculatedAmount = quantity * rate; } } } catch (e) { console.error("Error calculating item amount:", e); calculatedAmount = 0; } if (amountSpan) { amountSpan.textContent = calculatedAmount.toFixed(2); } updateOrderSummary(); /* updateCalculationPreview(); */ }
function updateOrderSummary() { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ let subtotal = 0; if (orderItemsTableBody) { orderItemsTableBody.querySelectorAll('.item-row .item-amount').forEach(span => { subtotal += parseFloat(span.textContent || 0); }); } let discountPercent = parseFloat(summaryDiscountPercentInput?.value || 0); let discountAmount = parseFloat(summaryDiscountAmountInput?.value || 0); let calculatedDiscountAmount = 0; const activeElement = document.activeElement; if (!isDiscountInputProgrammaticChange) { if (activeElement === summaryDiscountPercentInput && !isNaN(discountPercent)) { calculatedDiscountAmount = subtotal * (discountPercent / 100); isDiscountInputProgrammaticChange = true; if(summaryDiscountAmountInput) summaryDiscountAmountInput.value = calculatedDiscountAmount.toFixed(2); isDiscountInputProgrammaticChange = false; } else if (activeElement === summaryDiscountAmountInput && !isNaN(discountAmount)) { calculatedDiscountAmount = discountAmount; if (subtotal > 0) { const calculatedPercent = (calculatedDiscountAmount / subtotal) * 100; isDiscountInputProgrammaticChange = true; if(summaryDiscountPercentInput) summaryDiscountPercentInput.value = calculatedPercent.toFixed(2); isDiscountInputProgrammaticChange = false; } else { isDiscountInputProgrammaticChange = true; if(summaryDiscountPercentInput) summaryDiscountPercentInput.value = ''; isDiscountInputProgrammaticChange = false; } } else { if (!isNaN(discountPercent) && discountPercent > 0) { calculatedDiscountAmount = subtotal * (discountPercent / 100); } else if (!isNaN(discountAmount) && dA > 0) { calculatedDiscountAmount = discountAmount; } else { calculatedDiscountAmount = 0; } } } calculatedDiscountAmount = Math.max(0, Math.min(calculatedDiscountAmount, subtotal)); const finalAmount = subtotal - calculatedDiscountAmount; if (summarySubtotalSpan) summarySubtotalSpan.textContent = subtotal.toFixed(2); if (summaryFinalAmountSpan) summaryFinalAmountSpan.textContent = finalAmount.toFixed(2); }
function handleDiscountInput(event) { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ if (isDiscountInputProgrammaticChange) return; const currentInput = event.target; isDiscountInputProgrammaticChange = true; if (currentInput === summaryDiscountPercentInput) { if (summaryDiscountAmountInput) summaryDiscountAmountInput.value = ''; } else if (currentInput === summaryDiscountAmountInput) { if (summaryDiscountPercentInput) summaryDiscountPercentInput.value = ''; } isDiscountInputProgrammaticChange = false; updateOrderSummary(); }

// --- Customer Search/Select Logic ---
async function getOrFetchCustomerCache() { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ if(customerCache.length>0)return Promise.resolve(); if(customerFetchPromise)return customerFetchPromise; console.log("Fetching customers..."); try{if(!db||!collection||!query||!getDocs||!orderBy)throw new Error("DB function missing"); const q=query(collection(db,"customers"),orderBy("fullName")); customerFetchPromise=getDocs(q).then(s=>{customerCache=s.docs.map(d=>({id:d.id,...d.data()})); console.log(`Cached ${customerCache.length} customers.`); customerFetchPromise=null;}).catch(e=>{console.error(e);customerFetchPromise=null;throw e;}); return customerFetchPromise;}catch(e){console.error(e);customerFetchPromise=null;return Promise.reject(e);}}
function handleCustomerInput(event, type) { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ const inputElement=event.target; const searchTerm=inputElement.value.trim(); const suggestionsBox=type==='name'?customerSuggestionsNameBox:customerSuggestionsWhatsAppBox; if(!suggestionsBox)return; if(searchTerm.length<1){clearTimeout(customerSearchDebounceTimer); hideSuggestionBox(suggestionsBox); selectedCustomerId = null; if(selectedCustomerIdInput) selectedCustomerIdInput.value = ''; resetCustomerFields(false); return;} clearTimeout(customerSearchDebounceTimer); customerSearchDebounceTimer=setTimeout(()=>{getOrFetchCustomerCache().then(()=>filterAndRenderCustomerSuggestions(searchTerm,type,suggestionsBox,inputElement)).catch(e=>console.error("Error fetching/rendering cust suggestions:",e));},300);}
function filterAndRenderCustomerSuggestions(term, type, box, inputElement) { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ const termLower=term.toLowerCase(); const filterField=type==='name'?'fullName':'whatsappNo'; const suggestions=customerCache.filter(c=>String(c[filterField]||'').toLowerCase().includes(termLower)).slice(0,10); renderCustomerSuggestions(suggestions,term,box,inputElement); }
function renderCustomerSuggestions(suggestions, term, box, inputElement) { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ if(!box)return; const ul=box.querySelector('ul')||document.createElement('ul'); ul.innerHTML=''; if(suggestions.length===0){ul.innerHTML='<li class="no-suggestions">No matching customers found.</li>';}else{suggestions.forEach(c=>{const li=document.createElement('li'); const displayValue = type === 'name' ? c.fullName : c.whatsappNo; const otherValue = type === 'name' ? c.whatsappNo : c.fullName; const displayText = `${displayValue} (${otherValue || 'No other contact'})`; try{li.innerHTML=displayText.replace(new RegExp(`(${term.replace(/[-\/\^$*+?.()|[\]{}]/g,'\\$&')})`,'gi'),'<strong>$1</strong>');}catch{li.textContent=displayText;} li.dataset.customerId=c.id; li.dataset.customerName=c.fullName; li.dataset.customerWhatsapp=c.whatsappNo; li.dataset.customerAddress=c.billingAddress||c.address||''; li.dataset.customerContact=c.contactNo||''; ul.appendChild(li);});} if(!box.contains(ul))box.appendChild(ul); box.classList.add('active'); box.style.display='block'; const inputRect=inputElement.getBoundingClientRect(); const containerRect = inputElement.closest('.form-section-card')?.getBoundingClientRect() || document.body.getBoundingClientRect(); box.style.position='absolute'; box.style.left = `${inputRect.left - containerRect.left}px`; box.style.top = `${inputRect.bottom - containerRect.top}px`; box.style.width = `${inputRect.width}px`; box.style.zIndex='1000'; box.removeEventListener('click', handleSuggestionClick); box.addEventListener('click', handleSuggestionClick); }
function selectCustomerSuggestion(customerData) { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ if (!customerData || !customerData.customerId) { console.warn("selectCustomerSuggestion called with invalid data."); resetCustomerFields(true); return; } console.log("Selecting customer:", customerData); if(customerNameInput) customerNameInput.value = customerData.customerName || ''; if(customerWhatsAppInput) customerWhatsAppInput.value = customerData.customerWhatsapp || ''; if(customerAddressInput) customerAddressInput.value = customerData.customerAddress || ''; if(customerContactInput) customerContactInput.value = customerData.customerContact || ''; selectedCustomerId = customerData.customerId; if(selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId; selectedCustomerData = customerCache.find(c => c.id === selectedCustomerId) || customerData; /* updateOrderSummary(); */ /* fetchAndDisplayCustomerDetails(selectedCustomerId); */} // Assuming customer data is now in selectedCustomerData
function resetCustomerFields(clearId = true) { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ selectedCustomerId = clearId ? null : selectedCustomerId; selectedCustomerData = null; if(clearId && selectedCustomerIdInput) selectedCustomerIdInput.value = ''; }

// --- Product Search/Select Logic ---
async function getOrFetchProductCache() { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ if(productCache.length>0)return Promise.resolve(); if(productFetchPromise)return productFetchPromise; console.log("Fetching products for agent..."); try{if(!db||!collection||!query||!getDocs||!orderBy)throw new Error("DB func missing"); const q=query(collection(db,"onlineProducts"), where("isEnabled", "==", true), orderBy("productName")); productFetchPromise=getDocs(q).then(s=>{productCache=s.docs.map(d=>{const dt=d.data(); return{ id:d.id, name:dt.productName, unit:dt.unit, agentRate: dt.pricing?.agentRate ?? dt.pricing?.rate ?? null, stock: dt.stock ?? null };}); console.log(`Cached ${productCache.length} products for agent.`); productFetchPromise=null;}).catch(e=>{console.error("Agent product fetch err:",e);productFetchPromise=null;throw e;}); return productFetchPromise;}catch(e){console.error("Agent product fetch setup err:",e);productFetchPromise=null;return Promise.reject(e);}}
function getOrCreateProductSuggestionsDiv() { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ if (!productSuggestionsDiv) { productSuggestionsDiv = document.createElement('div'); productSuggestionsDiv.className = 'product-suggestions-list'; productSuggestionsDiv.style.display = 'none'; document.body.appendChild(productSuggestionsDiv); productSuggestionsDiv.addEventListener('mousedown', handleSuggestionClick); } return productSuggestionsDiv; }
function positionProductSuggestions(inputElement) { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ const s=getOrCreateProductSuggestionsDiv(), r=inputElement.getBoundingClientRect(), tableContainer = inputElement.closest('.table-container') || document.body; const containerScrollTop = tableContainer.scrollTop; const containerRect = tableContainer.getBoundingClientRect(); s.style.position='absolute'; s.style.left=`${r.left - containerRect.left}px`; s.style.top=`${r.bottom - containerRect.top + containerScrollTop}px`; s.style.width=`${r.width<250?250:r.width}px`; s.style.display='block'; s.style.zIndex='1050';}
function hideProductSuggestions() { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ if(productSuggestionsDiv)productSuggestionsDiv.style.display='none'; activeProductInput=null;}
function handleProductSearchInput(event) { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ const inputElement=event.target; if(!inputElement.matches('.product-name'))return; activeProductInput=inputElement; clearTimeout(productSearchDebounceTimer); const searchTerm=inputElement.value.trim(); if(searchTerm.length<1){hideProductSuggestions();return;} positionProductSuggestions(inputElement); productSearchDebounceTimer=setTimeout(()=>{if(document.activeElement===inputElement && activeProductInput===inputElement){getOrFetchProductCache().then(()=>filterAndRenderProductSuggestions(searchTerm,inputElement)).catch(e=>console.error("Agent prod filter err:",e));}},350);}
function filterAndRenderProductSuggestions(term, inputElement) { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ const suggestionsDiv=getOrCreateProductSuggestionsDiv(); suggestionsDiv.innerHTML='<ul><li class="no-suggestions">Loading...</li></ul>'; if(activeProductInput!==inputElement){hideProductSuggestions();return;} positionProductSuggestions(inputElement); const termLower=term.toLowerCase(); const filteredProducts=productCache.filter(p=>p.name?.toLowerCase().includes(termLower)).slice(0,10); renderProductSuggestions(filteredProducts,term,suggestionsDiv);}
function renderProductSuggestions(suggestions, term, suggestionsContainer) { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ if(!suggestionsContainer)return; const ul=document.createElement('ul'); if(suggestions.length===0){ul.innerHTML='<li class="no-suggestions">No matching products found.</li>';}else{suggestions.forEach(p=>{const li=document.createElement('li'); try{li.innerHTML=p.name.replace(new RegExp(`(${term.replace(/[-\/\^$*+?.()|[\]{}]/g,'\\$&')})`,'gi'),'<strong>$1</strong>');}catch{li.textContent=p.name;} li.dataset.product=JSON.stringify({ id: p.id, name: p.name, agentRate: p.agentRate, unit: p.unit, stock: p.stock }); ul.appendChild(li);});} suggestionsContainer.innerHTML=''; suggestionsContainer.appendChild(ul); suggestionsContainer.style.display='block';}
function selectProductSuggestion(productData, inputElement) { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ try { const row = inputElement.closest('.item-row'); if (!row || !productData || !productData.id) { console.error("Row or productData missing."); hideProductSuggestions(); return; } const productNameInput = row.querySelector('.product-name'); const unitTypeSelect = row.querySelector('.unit-type-select'); const rateInput = row.querySelector('.rate-input'); const quantityInput = row.querySelector('.quantity-input'); if (!productNameInput || !unitTypeSelect || !rateInput || !quantityInput ) { console.error("Row elements missing!"); hideProductSuggestions(); return; } const stock = productData.stock; if (typeof stock === 'number' && stock <= 0) { alert(`"${productData.name}" is out of stock!`); hideProductSuggestions(); productNameInput.value = ''; return; } productNameInput.value = productData.name || ''; rateInput.value = productData.agentRate !== null ? String(productData.agentRate) : ''; let defaultUnitType = 'Qty'; if (productData.unit) { const unitLower = String(productData.unit).toLowerCase(); if (unitLower.includes('sq') || unitLower.includes('ft') || unitLower.includes('feet')) defaultUnitType = 'Sq Feet'; } unitTypeSelect.value = defaultUnitType; hideProductSuggestions(); const changeEvent = new Event('change', { bubbles: true }); unitTypeSelect.dispatchEvent(changeEvent); updateItemAmount(row); let nextInput = null; if (defaultUnitType === 'Sq Feet') nextInput = row.querySelector('.width-input'); if (!nextInput) nextInput = quantityInput; if (nextInput) { nextInput.focus(); if (typeof nextInput.select === 'function') nextInput.select(); } else { rateInput.focus(); } } catch (error) { console.error("Error in selectProductSuggestion:", error); hideProductSuggestions(); } }
function handleSuggestionClick(event) { /* ... (जैसा पिछले जवाब में था, कोई बदलाव नहीं) ... */ const productLi = event.target.closest('.product-suggestions-list li[data-product]'); const customerLi = event.target.closest('.suggestions-box li[data-customer-id]'); if (productLi) { event.preventDefault(); try { const productData = JSON.parse(productLi.dataset.product || '{}'); if (activeProductInput) { selectProductSuggestion(productData, activeProductInput); } } catch (e) { console.error("Error parsing/selecting product suggestion:", e); } } else if (customerLi) { event.preventDefault(); try { selectCustomerSuggestion(customerLi.dataset); const box = customerLi.closest('.suggestions-box'); if (box) hideSuggestionBox(box); } catch(e) { console.error("Error selecting customer suggestion:", e); } } }

// --- Form Submission ---
async function handleFormSubmit(event) {
    event.preventDefault();
    console.log("Agent Order Submit initiated...");
    showFormError(''); // Clear previous errors

    if (!db || !addDoc || !collection || !serverTimestamp || !auth || !auth.currentUser) {
        showFormError("Error: Cannot submit order. Database connection or user authentication failed.");
        console.error("Firestore functions or auth user missing.");
        return;
    }
    if (!saveOrderBtn) return;

    saveOrderBtn.disabled = true;
    saveOrderBtn.querySelector('span').textContent = 'Submitting...';
    saveOrderBtn.querySelector('i').className = 'fas fa-spinner fa-spin'; // Show spinner

    try {
        // 1. Validate Customer
        const customerName = customerNameInput.value.trim();
        const customerWhatsapp = customerWhatsAppInput.value.trim();
        const customerId = selectedCustomerIdInput?.value || null; // Get selected ID

        if (!customerName || !customerWhatsapp) {
            throw new Error("Customer Name and WhatsApp No are required.");
        }
        if (!customerId) {
             // Optionally handle creating a new customer here if allowed, 
             // or enforce selecting an existing one based on agent permissions (Phase 3).
             // For now, we assume a customer must be selected/linked.
             throw new Error("Please select or link a customer.");
        }

        // 2. Validate Items & Collect Data
        const items = [];
        const rows = orderItemsTableBody.querySelectorAll('.item-row');
        if (rows.length === 0) {
            throw new Error("Please add at least one item to the order.");
        }

        let validationPassed = true;
        rows.forEach((row, idx) => {
            if (!validationPassed) return; 
            const productNameInput = row.querySelector('.product-name');
            const unitTypeSelect = row.querySelector('.unit-type-select');
            const quantityInput = row.querySelector('.quantity-input');
            const rateInput = row.querySelector('.rate-input'); // Agent Rate input
            const itemAmountSpan = row.querySelector('.item-amount');

            const productName = productNameInput?.value.trim();
            const unitType = unitTypeSelect?.value;
            const quantity = parseInt(quantityInput?.value || 0);
            const rate = parseFloat(rateInput?.value || ''); // Agent Rate from input
            const itemAmount = parseFloat(itemAmountSpan?.textContent || 0);

            // --- Basic Item Validation ---
            if (!productName) { validationPassed = false; showFormError(`Item ${idx + 1}: Product Name is required.`); productNameInput?.focus(); return; }
            if (isNaN(quantity) || quantity <= 0) { validationPassed = false; showFormError(`Item ${idx + 1}: Quantity must be a positive number.`); quantityInput?.focus(); return; }
            if (isNaN(rate) || rate < 0) { validationPassed = false; showFormError(`Item ${idx + 1}: Valid Agent Rate required.`); rateInput?.focus(); return; }
            if (isNaN(itemAmount)) { validationPassed = false; showFormError(`Item ${idx + 1}: Amount calculation error.`); return; }
            
            const itemData = {
                productName: productName,
                unitType: unitType,
                quantity: quantity,
                rate: rate, // Save the Agent Rate used
                itemAmount: itemAmount,
                // Add Sq Ft details if applicable
            };

            if (unitType === 'Sq Feet') {
                const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
                const widthInput = row.querySelector('.width-input');
                const heightInput = row.querySelector('.height-input');
                const dimensionUnit = dimensionUnitSelect?.value || 'feet';
                const width = parseFloat(widthInput?.value || 0);
                const height = parseFloat(heightInput?.value || 0);

                if (isNaN(width) || width <= 0) { validationPassed = false; showFormError(`Item ${idx + 1}: Valid Width required for Sq Feet.`); widthInput?.focus(); return; }
                if (isNaN(height) || height <= 0) { validationPassed = false; showFormError(`Item ${idx + 1}: Valid Height required for Sq Feet.`); heightInput?.focus(); return; }
                
                const calcResult = calculateFlexDimensions(dimensionUnit, width, height);
                itemData.dimensionUnit = dimensionUnit;
                itemData.width = width;
                itemData.height = height;
                itemData.realSqFt = parseFloat(calcResult.realSqFt);
                itemData.printSqFt = parseFloat(calcResult.printSqFt);
            }
            
            items.push(itemData);
        });

        if (!validationPassed) {
            throw new Error("Please correct the errors in the item list.");
        }

        // 3. Collect Other Order Details
        const deliveryDateValue = deliveryDateInput.value || null;
        const remarksValue = remarksInput.value.trim() || '';
        const urgentValue = orderForm.querySelector('input[name="agent_urgent"]:checked')?.value || 'No';

        // 4. Collect Summary Details
        const subTotal = parseFloat(summarySubtotalSpan?.textContent || 0);
        const discountPercent = parseFloat(summaryDiscountPercentInput?.value || 0) || 0;
        const discountAmount = parseFloat(summaryDiscountAmountInput?.value || 0) || 0;
        const finalAmount = parseFloat(summaryFinalAmountSpan?.textContent || 0);
        
        // Basic check for summary calculation consistency
        if (isNaN(subTotal) || isNaN(finalAmount)) {
             throw new Error("Error in order summary calculation.");
        }

        // 5. Prepare Firestore Payload for 'pendingAgentOrders' collection
        const agentId = auth.currentUser.uid;
        const agentEmail = auth.currentUser.email; // Store agent email for easy identification

        const pendingOrderData = {
            agentId: agentId,
            agentEmail: agentEmail,
            customerId: customerId, // Store the linked Customer ID
            customerDetails: { // Store customer details snapshot at time of order
                fullName: customerName,
                whatsappNo: customerWhatsapp,
                address: customerAddressInput.value.trim() || '',
                contactNo: customerContactInput.value.trim() || ''
            },
            deliveryDate: deliveryDateValue ? Timestamp.fromDate(new Date(deliveryDateValue + 'T00:00:00')) : null,
            remarks: remarksValue,
            urgent: urgentValue,
            items: items,
            subTotal: subTotal,
            discountPercentage: discountPercent,
            discountAmount: discountAmount,
            finalAmount: finalAmount,
            status: "Pending Admin Approval", // Initial status
            submittedAt: serverTimestamp() // Timestamp when agent submitted
        };

        // 6. Save to 'pendingAgentOrders' collection
        const pendingOrdersRef = collection(db, "pendingAgentOrders");
        const docRef = await addDoc(pendingOrdersRef, pendingOrderData);

        console.log("Pending agent order submitted successfully:", docRef.id);
        alert(`Order submitted successfully for processing! Pending ID: ${docRef.id}`);
        
        // 7. Reset the form
        resetAgentOrderForm();

    } catch (error) {
        console.error("Order submission failed:", error);
        showFormError("Error submitting order: " + error.message);
    } finally {
        // 8. Re-enable button
        if(saveOrderBtn) {
            saveOrderBtn.disabled = false;
            saveOrderBtn.querySelector('span').textContent = 'Submit Order';
            saveOrderBtn.querySelector('i').className = 'fas fa-paper-plane';
        }
    }
}

// Function to reset the form after successful submission
function resetAgentOrderForm() {
    console.log("Resetting agent order form...");
    if(orderForm) orderForm.reset(); 
    if(orderItemsTableBody) orderItemsTableBody.innerHTML = ''; 
    selectedCustomerId = null;
    selectedCustomerData = null;
    if(selectedCustomerIdInput) selectedCustomerIdInput.value = ''; 
    updateOrderSummary(); 
    handleAddItem(); // Add one empty row back
    showFormError(''); 
    hideProductSuggestions(); 
    if(customerSuggestionsNameBox) hideSuggestionBox(customerSuggestionsNameBox); 
    if(customerSuggestionsWhatsAppBox) hideSuggestionBox(customerSuggestionsWhatsAppBox); 
    window.scrollTo(0, 0); // Scroll to top
}

// Pre-fetch product and customer data on load
function preFetchCaches() {
     console.log("Pre-fetching caches for Agent Create Order...");
     getOrFetchCustomerCache().catch(e => console.error("Initial Customer cache fetch failed:", e));
     getOrFetchProductCache().catch(e => console.error("Initial Product cache fetch failed:", e));
}