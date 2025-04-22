// js/new_po.js - v13 (Case-Insensitive Search for Product & Supplier Suggestions)

// Assume Firebase functions are globally available via HTML script block
const {
    db, collection, doc, addDoc, getDoc, getDocs, updateDoc, serverTimestamp, Timestamp,
    query, where, orderBy, limit
} = window;

// --- DOM Elements ---
// (No changes needed here, same as v12)
const poForm = document.getElementById('poForm');
const poPageTitle = document.getElementById('poPageTitle');
const poBreadcrumbAction = document.getElementById('poBreadcrumbAction');
const editPOIdInput = document.getElementById('editPOId');
const supplierSearchInput = document.getElementById('supplierSearchInput');
const selectedSupplierIdInput = document.getElementById('selectedSupplierId');
const selectedSupplierNameInput = document.getElementById('selectedSupplierName');
const supplierSuggestionsDiv = document.getElementById('supplierSuggestions');
const addNewSupplierFromPOBtn = document.getElementById('addNewSupplierFromPO');
const poNumberInput = document.getElementById('poNumberInput');
const poOrderDateInput = document.getElementById('poOrderDateInput');
const poItemsTableBody = document.getElementById('poItemsTableBody');
const addItemBtn = document.getElementById('addItemBtn');
const itemRowTemplate = document.getElementById('item-row-template');
const calculationPreviewArea = document.getElementById('calculationPreviewArea');
const poNotesInput = document.getElementById('poNotesInput');
const poTotalAmountSpan = document.getElementById('poTotalAmount');
const savePOBtn = document.getElementById('savePOBtn');
const savePOBtnSpan = savePOBtn ? savePOBtn.querySelector('span') : null;
const poErrorMsg = document.getElementById('poErrorMsg');
let productSuggestionsDiv = null;

// --- Global State ---
// (No changes needed here, same as v12)
let supplierSearchDebounceTimer;
let productSearchDebounceTimer;
let editingPOData = null;
let activeProductInput = null;

// --- Utility Functions ---
// (No changes needed here, same as v12)
function calculateFlexDimensions(unit, width, height) { /* ... unchanged ... */ console.log(`Calculating flex: Unit=${unit}, W=${width}, H=${height}`); const mediaWidthsFt = [3, 4, 5, 6, 8, 10]; let wFt = (unit === 'inches') ? parseFloat(width || 0) / 12 : parseFloat(width || 0); let hFt = (unit === 'inches') ? parseFloat(height || 0) / 12 : parseFloat(height || 0); if (isNaN(wFt) || isNaN(hFt) || wFt <= 0 || hFt <= 0) { return { realSqFt: 0, printWidth: 0, printHeight: 0, printSqFt: 0, inputUnit: unit, realWidthFt: 0, realHeightFt: 0, printWidthFt: 0, printHeightFt: 0 }; } const realSqFt = wFt * hFt; const mediaWidthFitW = mediaWidthsFt.find(mw => mw >= wFt); let printWidthFt1 = mediaWidthFitW || wFt; let printHeightFt1 = hFt; let printSqFt1 = printWidthFt1 * printHeightFt1; if (!mediaWidthFitW) console.warn(`Width ${wFt.toFixed(2)}ft exceeds max media width.`); const mediaWidthFitH = mediaWidthsFt.find(mw => mw >= hFt); let printWidthFt2 = wFt; let printHeightFt2 = mediaWidthFitH || hFt; let printSqFt2 = printWidthFt2 * printHeightFt2; if (!mediaWidthFitH) console.warn(`Height ${hFt.toFixed(2)}ft exceeds max media width.`); let finalPrintWidthFt, finalPrintHeightFt, finalPrintSqFt; if (!mediaWidthFitH || printSqFt1 <= printSqFt2) { finalPrintWidthFt = printWidthFt1; finalPrintHeightFt = printHeightFt1; finalPrintSqFt = printSqFt1; } else { finalPrintWidthFt = printWidthFt2; finalPrintHeightFt = printHeightFt2; finalPrintSqFt = printSqFt2; } let displayPrintWidth = (unit === 'inches') ? finalPrintWidthFt * 12 : finalPrintWidthFt; let displayPrintHeight = (unit === 'inches') ? finalPrintHeightFt * 12 : finalPrintHeightFt; return { realSqFt: realSqFt.toFixed(2), printWidth: displayPrintWidth.toFixed(2), printHeight: displayPrintHeight.toFixed(2), printSqFt: finalPrintSqFt.toFixed(2), inputUnit: unit, realWidthFt: wFt, realHeightFt: hFt, printWidthFt: finalPrintWidthFt, printHeightFt: finalPrintHeightFt }; }
function updateTotalAmount() { /* ... unchanged ... */ let total = 0; poItemsTableBody.querySelectorAll('.item-row').forEach(row => { const amountSpan = row.querySelector('.item-amount'); total += parseFloat(amountSpan?.textContent || 0); }); if (poTotalAmountSpan) { poTotalAmountSpan.textContent = total.toFixed(2); } }
function updateFullCalculationPreview() { /* ... unchanged ... */ if (!calculationPreviewArea || !poItemsTableBody) return; let entriesHTML = ''; const itemRows = poItemsTableBody.querySelectorAll('.item-row'); let foundSqFt = false; itemRows.forEach((row, index) => { const unitTypeSelect = row.querySelector('.unit-type-select'); if (unitTypeSelect?.value === 'Sq Feet') { foundSqFt = true; const productNameInput = row.querySelector('.product-name'); const productName = productNameInput?.value.trim() || `Item ${index + 1}`; const dimensionUnitSelect = row.querySelector('.dimension-unit-select'); const widthInput = row.querySelector('.width-input'); const heightInput = row.querySelector('.height-input'); const quantityInput = row.querySelector('.quantity-input'); const unit = dimensionUnitSelect ? dimensionUnitSelect.value : 'feet'; const width = parseFloat(widthInput?.value || 0); const height = parseFloat(heightInput?.value || 0); let quantity = parseInt(quantityInput?.value || 1); if (isNaN(quantity) || quantity < 1) { quantity = 1; } let entryContent = `<strong>${productName}:</strong><br>`; if (width > 0 && height > 0) { const calcResult = calculateFlexDimensions(unit, width, height); if (calcResult && parseFloat(calcResult.printSqFt) > 0) { const realSqFtNum = parseFloat(calcResult.realSqFt); const printSqFtNum = parseFloat(calcResult.printSqFt); const wastageSqFt = (printSqFtNum - realSqFtNum); let wastageSizeStr = "N/A"; const widthDiff = (calcResult.printWidthFt - calcResult.realWidthFt); const heightDiff = (calcResult.printHeightFt - calcResult.realHeightFt); const tolerance = 0.01; if (widthDiff > tolerance && Math.abs(heightDiff) < tolerance) { wastageSizeStr = `${widthDiff.toFixed(2)}ft W x ${calcResult.realHeightFt.toFixed(2)}ft H`; } else if (heightDiff > tolerance && Math.abs(widthDiff) < tolerance) { wastageSizeStr = `${calcResult.realWidthFt.toFixed(2)}ft W x ${heightDiff.toFixed(2)}ft H`; } else if (widthDiff > tolerance && heightDiff > tolerance) { wastageSizeStr = `~${wastageSqFt.toFixed(2)} sq ft area (complex)`; } else if (wastageSqFt > tolerance) { wastageSizeStr = `~${wastageSqFt.toFixed(2)} sq ft area`; } else { wastageSizeStr = "None"; } entryContent += `&nbsp; Quantity: ${quantity}<br>`; entryContent += `&nbsp; Real: ${calcResult.realWidthFt.toFixed(2)}ft x ${calcResult.realHeightFt.toFixed(2)}ft = ${realSqFtNum.toFixed(2)} sq ft/item<br>`; entryContent += `&nbsp; Print: ${calcResult.printWidthFt.toFixed(2)}ft x ${calcResult.printHeightFt.toFixed(2)}ft = ${printSqFtNum.toFixed(2)} sq ft/item<br>`; entryContent += `&nbsp; Total Print Area: ${(printSqFtNum * quantity).toFixed(2)} sq ft<br>`; entryContent += `&nbsp; <strong style="color: ${wastageSqFt > tolerance ? 'orange' : 'green'};">Wastage: ${wastageSqFt.toFixed(2)} sq ft/item</strong> | <span style="color: ${wastageSqFt > tolerance ? 'orange' : 'green'};">Size: ${wastageSizeStr}</span>`; } else { entryContent += `&nbsp; <span style="color:orange;">Invalid dimensions or calculation error.</span>`; } } else { entryContent += `&nbsp; <span style="color:grey;">Enter valid width & height.</span>`; } entriesHTML += `<div class="item-preview-entry">${entryContent}</div>`; } }); let finalHTML = '<h4>Calculation Details:</h4>'; if (foundSqFt && entriesHTML) { finalHTML += `<div class="calculation-grid">${entriesHTML}</div>`; } else { finalHTML += '<p style="color:grey;">Add items with Unit Type "Sq Feet" to see calculations.</p>'; } calculationPreviewArea.innerHTML = finalHTML; }
function updateItemAmount(row) { /* ... unchanged ... */ if (!row) return; const unitTypeSelect = row.querySelector('.unit-type-select'); const amountSpan = row.querySelector('.item-amount'); const rateInput = row.querySelector('.rate-input'); const quantityInput = row.querySelector('.quantity-input'); let amount = 0; try { const rate = parseFloat(rateInput?.value || 0); let quantity = parseInt(quantityInput?.value || 1); if (isNaN(quantity) || quantity < 1) { quantity = 1; } if (unitTypeSelect?.value === 'Sq Feet') { const dimensionUnitSelect = row.querySelector('.dimension-unit-select'); const widthInput = row.querySelector('.width-input'); const heightInput = row.querySelector('.height-input'); const unit = dimensionUnitSelect ? dimensionUnitSelect.value : 'feet'; const width = parseFloat(widthInput?.value || 0); const height = parseFloat(heightInput?.value || 0); if (width > 0 && height > 0) { const calcResult = calculateFlexDimensions(unit, width, height); amount = (parseFloat(calcResult.printSqFt || 0) * quantity * rate); } } else { amount = quantity * rate; } } catch (e) { console.error("Error calculating item amount:", e); amount = 0; } if (amountSpan) amountSpan.textContent = amount.toFixed(2); updateTotalAmount(); updateFullCalculationPreview(); }
function handleUnitTypeChange(event) { /* ... unchanged ... */ const row = event.target.closest('.item-row'); if (!row) { console.error("handleUnitTypeChange: Could not find parent row."); return; } const unitType = event.target.value; console.log(`Unit type changed to: ${unitType} for row:`, row); const cells = row.querySelectorAll('td'); const sqFeetDimensionCell = cells.length > 2 ? cells[2] : null; const sqFeetUnitCell = cells.length > 3 ? cells[3] : null; const qtyInputDirectParentCell = row.querySelector('.quantity-input')?.closest('td'); const table = row.closest('table'); const headers = table?.querySelectorAll('thead th'); if (!headers || headers.length < 5) { console.error("handleUnitTypeChange: Could not find table headers."); return; } const sqFeetHeader1 = headers[2]; const sqFeetHeader2 = headers[3]; const qtyHeader = headers[4]; const rateInput = row.querySelector('.rate-input'); if (!sqFeetDimensionCell || !sqFeetUnitCell || !qtyInputDirectParentCell || !sqFeetHeader1 || !sqFeetHeader2 || !qtyHeader) { console.error("handleUnitTypeChange: Could not find all necessary cells/headers for unit type toggle."); return; } if (unitType === 'Sq Feet') { console.log("Switching to Sq Feet view"); sqFeetDimensionCell.style.display = ''; sqFeetUnitCell.style.display = ''; sqFeetHeader1.classList.remove('hidden-col'); sqFeetHeader2.classList.remove('hidden-col'); qtyInputDirectParentCell.style.display = ''; qtyHeader.classList.remove('hidden-col'); if (rateInput) rateInput.placeholder = 'Rate/SqFt'; } else { console.log("Switching to Qty view"); sqFeetDimensionCell.style.display = 'none'; sqFeetUnitCell.style.display = 'none'; sqFeetHeader1.classList.add('hidden-col'); sqFeetHeader2.classList.add('hidden-col'); qtyInputDirectParentCell.style.display = ''; qtyHeader.classList.remove('hidden-col'); if (rateInput) rateInput.placeholder = 'Rate/Unit'; const widthInput = sqFeetDimensionCell.querySelector('.width-input'); const heightInput = sqFeetDimensionCell.querySelector('.height-input'); if (widthInput) widthInput.value = ''; if (heightInput) heightInput.value = ''; } updateItemAmount(row); }
function addItemRowEventListeners(row) { /* ... unchanged ... */ const unitTypeSelect = row.querySelector('.unit-type-select'); const dimensionUnitSelect = row.querySelector('.dimension-unit-select'); const widthInput = row.querySelector('.width-input'); const heightInput = row.querySelector('.height-input'); const quantityInput = row.querySelector('.quantity-input'); const rateInput = row.querySelector('.rate-input'); const deleteBtn = row.querySelector('.delete-item-btn'); const recalcInputs = [dimensionUnitSelect, widthInput, heightInput, quantityInput, rateInput]; recalcInputs.forEach(input => { if (input) { input.addEventListener('input', () => updateItemAmount(row)); input.addEventListener('change', () => updateItemAmount(row)); } }); if (unitTypeSelect) { unitTypeSelect.addEventListener('change', handleUnitTypeChange); } if (deleteBtn) { deleteBtn.addEventListener('click', () => { row.remove(); hideProductSuggestions(); updateTotalAmount(); updateFullCalculationPreview(); }); } if (unitTypeSelect) { handleUnitTypeChange({ target: unitTypeSelect }); } else { console.warn("Unit type select not found in row for initial state setting:", row); } updateItemAmount(row); }

// --- Product Search Implementation ---
function getOrCreateProductSuggestionsDiv() { /* ... unchanged ... */ if (!productSuggestionsDiv) { productSuggestionsDiv = document.createElement('div'); productSuggestionsDiv.className = 'product-suggestions-list'; productSuggestionsDiv.style.display = 'none'; document.body.appendChild(productSuggestionsDiv); } return productSuggestionsDiv; }
function positionProductSuggestions(inputElement) { /* ... unchanged ... */ const suggestionsDiv = getOrCreateProductSuggestionsDiv(); const rect = inputElement.getBoundingClientRect(); suggestionsDiv.style.left = `${rect.left + window.scrollX}px`; suggestionsDiv.style.top = `${rect.bottom + window.scrollY}px`; suggestionsDiv.style.width = `${rect.width}px`; suggestionsDiv.style.display = 'block'; }
function hideProductSuggestions() { /* ... unchanged ... */ if (productSuggestionsDiv) { productSuggestionsDiv.style.display = 'none'; } activeProductInput = null; }
function handleProductSearchInput(event) { /* ... unchanged ... */ const inputElement = event.target; if (!inputElement.matches('.product-name')) { return; } activeProductInput = inputElement; clearTimeout(productSearchDebounceTimer); const searchTerm = inputElement.value.trim(); if (searchTerm.length < 1) { hideProductSuggestions(); return; } positionProductSuggestions(inputElement); productSearchDebounceTimer = setTimeout(() => { fetchProductSuggestions(searchTerm, inputElement); }, 350); }

// *** UPDATED FUNCTION: fetchProductSuggestions ***
// Uses lowercase field for case-insensitive search
async function fetchProductSuggestions(searchTerm, inputElement) {
    const suggestionsDiv = getOrCreateProductSuggestionsDiv();
    suggestionsDiv.innerHTML = '<div>Loading...</div>';
    if (activeProductInput === inputElement) { positionProductSuggestions(inputElement); }
    else { hideProductSuggestions(); return; }

    // *** CHANGE: Convert search term to lowercase ***
    const searchTermLower = searchTerm.toLowerCase();

    try {
        // *** CHANGE: Query the lowercase field ***
        // ASSUMPTION: 'printName_lowercase' field exists in Firestore products collection
        console.log(`Searching products with lowercase term: "${searchTermLower}"`);
        const q = query(
            collection(db, "products"),
            orderBy("printName_lowercase"), // Order by the lowercase field
            where("printName_lowercase", ">=", searchTermLower),
            where("printName_lowercase", "<=", searchTermLower + '\uf8ff'),
            limit(10)
        );
        const querySnapshot = await getDocs(q);
        suggestionsDiv.innerHTML = ''; // Clear loading

        if (querySnapshot.empty) {
            console.log(`No products found matching lowercase: "${searchTermLower}"`);
            suggestionsDiv.innerHTML = '<div class="no-suggestions">No matching products found.</div>';
        } else {
            querySnapshot.forEach((docSnapshot) => {
                const product = docSnapshot.data();
                // Check if the lowercase field exists before proceeding fully
                if (product.printName_lowercase === undefined) {
                     console.warn(`Product ${docSnapshot.id} (${product.printName}) is missing 'printName_lowercase' field.`);
                     // Optionally skip or show differently
                }
                const productId = docSnapshot.id;
                const div = document.createElement('div');
                // Display the original name (with original casing)
                div.textContent = product.printName || 'Unnamed Product';
                div.dataset.id = productId;
                // Store original name, purchase price, and unit in dataset
                div.dataset.name = product.printName || '';
                div.dataset.rate = product.purchasePrice ?? ''; // Use purchasePrice
                div.dataset.unitFirestore = product.unit || 'Qty'; // Use correct 'unit' field

                div.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    selectProductSuggestion(product, inputElement); // Pass full data
                });
                suggestionsDiv.appendChild(div);
            });
        }
         if (activeProductInput === inputElement) { suggestionsDiv.style.display = 'block'; }
         else { hideProductSuggestions(); }

    } catch (error) {
        console.error("Error fetching product suggestions:", error);
        // Check if the error is due to the missing index for 'printName_lowercase'
        if (error.message.includes("indexes are required")) {
             console.error("Firestore Index Missing: Please create a Firestore index for the 'products' collection on the 'printName_lowercase' field (ascending).");
             suggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Search Error (Index Missing).</div>';
        } else if (error.message.includes("does not support order by")) {
             console.error("Firestore Field Missing or Index Error: Ensure 'printName_lowercase' field exists and is indexed.");
             suggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Search Error (Field/Index).</div>';
        }
        else {
            suggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Error fetching products.</div>';
        }
        if (activeProductInput === inputElement) { suggestionsDiv.style.display = 'block'; }
    }
}

// selectProductSuggestion function remains unchanged from v12
function selectProductSuggestion(productData, inputElement) { /* ... unchanged ... */ const row = inputElement.closest('.item-row'); if (!row) { console.error("Could not find parent row for product selection."); hideProductSuggestions(); return; } const productNameInput = row.querySelector('.product-name'); const unitTypeSelect = row.querySelector('.unit-type-select'); const rateInput = row.querySelector('.rate-input'); const quantityInput = row.querySelector('.quantity-input'); if (!productNameInput || !unitTypeSelect || !rateInput || !quantityInput) { console.error("Could not find all necessary fields (product, unit type, rate, quantity) in the row."); hideProductSuggestions(); return; } productNameInput.value = productData.printName || ''; rateInput.value = productData.purchasePrice ?? ''; let unitFromFirestore = productData.unit || 'Qty'; let valueToSelect = 'Qty'; const unitLowerCase = unitFromFirestore.toLowerCase(); if (unitLowerCase.includes('sq') || unitLowerCase.includes('feet') || unitLowerCase.includes('ft')) { valueToSelect = 'Sq Feet'; } else if (unitLowerCase === 'nos' || unitLowerCase === 'qty') { valueToSelect = 'Qty'; } else { console.warn(`Unexpected unit type "${unitFromFirestore}" from Firestore product data. Defaulting display type to Qty.`); valueToSelect = 'Qty'; } let unitTypeFound = false; for (let option of unitTypeSelect.options) { if (option.value === valueToSelect) { unitTypeSelect.value = valueToSelect; unitTypeFound = true; break; } } if (!unitTypeFound) { console.error(`Dropdown option value "${valueToSelect}" (derived from unit "${unitFromFirestore}") not found! Check HTML template. Defaulting to Qty.`); unitTypeSelect.value = 'Qty'; } hideProductSuggestions(); const changeEvent = new Event('change', { bubbles: true }); unitTypeSelect.dispatchEvent(changeEvent); let nextInput = null; if (unitTypeSelect.value === 'Sq Feet') { nextInput = row.querySelector('.width-input'); } else { nextInput = quantityInput; } if (!nextInput) { nextInput = rateInput; } if (nextInput) { nextInput.focus(); if (typeof nextInput.select === 'function') { nextInput.select(); } } }


// --- DOMContentLoaded Listener ---
document.addEventListener('DOMContentLoaded', () => {
    // This listener remains unchanged.
    console.log("new_po.js v13: DOM loaded."); // Version bump
    if (!window.db || !window.query || !window.orderBy || !window.limit || !window.getDocs || !window.Timestamp) { console.error("new_po.js: Firestore (window.db) or essential functions not available!"); alert("Error initializing page. Core functionalities missing."); if(poForm) poForm.style.opacity = '0.5'; if(savePOBtn) savePOBtn.disabled = true; return; }
    console.log("new_po.js: Firestore connection and functions confirmed.");
    const urlParamsInit = new URLSearchParams(window.location.search); const isEditingInit = urlParamsInit.has('editPOId');
    if (!isEditingInit && poOrderDateInput && !poOrderDateInput.value) { try { poOrderDateInput.value = new Date().toISOString().split('T')[0]; } catch (e) { console.error("Error setting default date:", e); } }
    if (addItemBtn && itemRowTemplate && poItemsTableBody) {
        addItemBtn.addEventListener('click', () => { const templateContent = itemRowTemplate.content.cloneNode(true); poItemsTableBody.appendChild(templateContent); const appendedRow = poItemsTableBody.lastElementChild; if (appendedRow?.matches('.item-row')) { addItemRowEventListeners(appendedRow); const firstInput = appendedRow.querySelector('.product-name'); if(firstInput) firstInput.focus(); } else { console.error("Failed to get appended row or it's not an item-row"); } });
        if (!isEditingInit && poItemsTableBody.children.length === 0) { addItemBtn.click(); }
    } else { console.error("Add Item button, Item Row template or Table Body not found!"); }
    if (supplierSearchInput && supplierSuggestionsDiv && selectedSupplierIdInput && selectedSupplierNameInput) { supplierSearchInput.addEventListener('input', handleSupplierSearchInput); document.addEventListener('click', (e) => { if (supplierSuggestionsDiv && supplierSuggestionsDiv.style.display === 'block' && !supplierSearchInput.contains(e.target) && !supplierSuggestionsDiv.contains(e.target)) { supplierSuggestionsDiv.style.display = 'none'; } if (productSuggestionsDiv && productSuggestionsDiv.style.display === 'block' && activeProductInput && !activeProductInput.contains(e.target) && !productSuggestionsDiv.contains(e.target)) { hideProductSuggestions(); } }); }
    else { console.warn("Supplier search elements not found."); }
    if(addNewSupplierFromPOBtn) { addNewSupplierFromPOBtn.addEventListener('click', () => { window.open('supplier_management.html#add', '_blank'); alert("Supplier management page opened in new tab. Add supplier there and then search here."); }); }
    if (poItemsTableBody) { poItemsTableBody.addEventListener('input', handleProductSearchInput); poItemsTableBody.addEventListener('focusin', (event) => { if (event.target.matches('.product-name')) { activeProductInput = event.target; } }); }
    else { console.error("Cannot add product search listener: Table body not found."); }
    if (poForm) { poForm.addEventListener('submit', handleSavePO); } else { console.error("PO Form element not found!"); }
    const editPOIdValue = urlParamsInit.get('editPOId'); if (editPOIdValue) { loadPOForEditing(editPOIdValue); } else { if (poItemsTableBody.children.length > 0) { updateFullCalculationPreview(); updateTotalAmount(); } if(poNumberInput) poNumberInput.value = ''; }
    console.log("new_po.js v13: Basic setup and listeners added.");
});

// --- Supplier Search Implementation ---
// *** UPDATED FUNCTION: handleSupplierSearchInput ***
// Converts search term to lowercase before fetching
function handleSupplierSearchInput() {
     if (!supplierSearchInput || !supplierSuggestionsDiv || !selectedSupplierIdInput || !selectedSupplierNameInput) return;
     clearTimeout(supplierSearchDebounceTimer);
     const searchTerm = supplierSearchInput.value.trim();
     // Clear selected supplier ID/Name when input changes
     selectedSupplierIdInput.value = '';
     selectedSupplierNameInput.value = '';

     if (searchTerm.length < 1) {
         supplierSuggestionsDiv.innerHTML = '';
         supplierSuggestionsDiv.style.display = 'none';
         return;
     }
     // Fetch suggestions after a short delay
     supplierSearchDebounceTimer = setTimeout(() => {
         fetchSupplierSuggestions(searchTerm); // Pass original term for now, handled in fetch
     }, 350);
}

// *** UPDATED FUNCTION: fetchSupplierSuggestions ***
// Uses lowercase field for case-insensitive search
async function fetchSupplierSuggestions(searchTerm) {
    if (!supplierSuggestionsDiv) return;
    supplierSuggestionsDiv.innerHTML = '<div>Loading...</div>';
    supplierSuggestionsDiv.style.display = 'block';

    // *** CHANGE: Convert search term to lowercase ***
    const searchTermLower = searchTerm.toLowerCase();

    try {
        // *** CHANGE: Query the lowercase field ***
        // ASSUMPTION: 'name_lowercase' field exists in Firestore suppliers collection
        console.log(`Searching suppliers with lowercase term: "${searchTermLower}"`);
        const q = query(
            collection(db, "suppliers"),
            orderBy("name_lowercase"), // Order by lowercase field
            where("name_lowercase", ">=", searchTermLower),
            where("name_lowercase", "<=", searchTermLower + '\uf8ff'),
            limit(10)
        );
        const querySnapshot = await getDocs(q);
        supplierSuggestionsDiv.innerHTML = ''; // Clear loading

        if (querySnapshot.empty) {
             console.log(`No suppliers found matching lowercase: "${searchTermLower}"`);
            supplierSuggestionsDiv.innerHTML = '<div class="no-suggestions">No matching suppliers found. <button type="button" id="suggestAddNewSupplier" class="button link-button" style="margin-left: 10px;">+ Add New</button></div>';
            const suggestBtn = supplierSuggestionsDiv.querySelector('#suggestAddNewSupplier');
            if (suggestBtn && addNewSupplierFromPOBtn) {
                suggestBtn.addEventListener('click', () => addNewSupplierFromPOBtn.click());
            }
        } else {
            querySnapshot.forEach((docSnapshot) => {
                 const supplier = docSnapshot.data();
                 // Check if the lowercase field exists
                 if (supplier.name_lowercase === undefined) {
                     console.warn(`Supplier ${docSnapshot.id} (${supplier.name}) is missing 'name_lowercase' field.`);
                 }
                 const supplierId = docSnapshot.id;
                 const div = document.createElement('div');
                 // Display original name
                 div.textContent = `${supplier.name}${supplier.companyName ? ' (' + supplier.companyName + ')' : ''}`;
                 div.dataset.id = supplierId;
                 div.dataset.name = supplier.name; // Store original name
                 div.style.cursor = 'pointer';

                 div.addEventListener('mousedown', (e) => {
                      e.preventDefault();
                      supplierSearchInput.value = supplier.name; // Display original name in input
                      if(selectedSupplierIdInput) selectedSupplierIdInput.value = supplierId;
                      if(selectedSupplierNameInput) selectedSupplierNameInput.value = supplier.name;
                      supplierSuggestionsDiv.style.display = 'none';
                      if (poOrderDateInput) poOrderDateInput.focus(); // Move focus to next logical field
                 });
                 supplierSuggestionsDiv.appendChild(div);
            });
        }
    } catch (error) {
        console.error("Error fetching supplier suggestions:", error);
         // Check if the error is due to the missing index for 'name_lowercase'
         if (error.message.includes("indexes are required")) {
             console.error("Firestore Index Missing: Please create a Firestore index for the 'suppliers' collection on the 'name_lowercase' field (ascending).");
             supplierSuggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Search Error (Index Missing).</div>';
        } else if (error.message.includes("does not support order by")) {
             console.error("Firestore Field Missing or Index Error: Ensure 'name_lowercase' field exists and is indexed.");
             supplierSuggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Search Error (Field/Index).</div>';
        }
         else {
            supplierSuggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Error fetching suppliers.</div>';
         }
    }
}


// --- Save PO Function ---
async function handleSavePO(event) {
    // This function remains unchanged from v12.
    event.preventDefault(); console.log("DEBUG PO Gen: handleSavePO started (v13)."); showPOError(''); if (!poForm || !selectedSupplierIdInput || !poOrderDateInput || !poItemsTableBody || !poTotalAmountSpan || !savePOBtn || !db || !addDoc || !collection || !doc || !updateDoc || !Timestamp || !serverTimestamp || !query || !orderBy || !limit || !getDocs) { console.error("Save PO prerequisites missing."); showPOError("Critical error: Cannot save PO. Essential components missing."); return; } const editingPOId = editPOIdInput.value; const isEditing = !!editingPOId; let finalPoNumber = null; console.log("DEBUG PO Gen: Editing Mode:", isEditing); savePOBtn.disabled = true; if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Updating...' : 'Processing...'; if (isEditing) { const existingValue = poNumberInput.value.trim(); const numericValue = Number(existingValue); finalPoNumber = (!isNaN(numericValue)) ? numericValue : (existingValue || null); console.log("DEBUG PO Gen: Using existing PO number for edit:", finalPoNumber); savePOBtn.disabled = false; if (savePOBtnSpan) savePOBtnSpan.textContent = 'Update Purchase Order'; } else { if (savePOBtnSpan) savePOBtnSpan.textContent = 'Generating PO#...'; console.log("DEBUG PO Gen: Starting PO number generation..."); try { const q = query(collection(db, "purchaseOrders"), orderBy("createdAt", "desc"), limit(1)); const querySnapshot = await getDocs(q); let lastPoNumber = 1000; if (!querySnapshot.empty) { const lastPO = querySnapshot.docs[0].data(); const lastPoNumberStr = lastPO.poNumber; if (lastPoNumberStr !== undefined && lastPoNumberStr !== null && String(lastPoNumberStr).trim() !== "") { const lastNum = Number(lastPoNumberStr); if (!isNaN(lastNum)) { lastPoNumber = lastNum; } } } finalPoNumber = lastPoNumber + 1; if (finalPoNumber < 1001) { finalPoNumber = 1001; } poNumberInput.value = finalPoNumber; console.log("DEBUG PO Gen: Generated PO Number:", finalPoNumber); savePOBtn.disabled = false; if (savePOBtnSpan) savePOBtnSpan.textContent = 'Save Purchase Order'; } catch (error) { console.error("DEBUG PO Gen: Error during PO number generation:", error); showPOError("Error generating PO Number. " + error.message); savePOBtn.disabled = false; if (savePOBtnSpan) savePOBtnSpan.textContent = 'Save Purchase Order'; return; } } const supplierId = selectedSupplierIdInput.value; const supplierName = selectedSupplierNameInput.value; const orderDateValue = poOrderDateInput.value; const notes = poNotesInput.value.trim(); if (!supplierId || !supplierName) { showPOError("Please select a supplier."); savePOBtn.disabled = false; if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Update Purchase Order' : 'Save Purchase Order'; supplierSearchInput.focus(); return; } if (!orderDateValue) { showPOError("Please select an order date."); savePOBtn.disabled = false; if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Update Purchase Order' : 'Save Purchase Order'; poOrderDateInput.focus(); return; } const itemRows = poItemsTableBody.querySelectorAll('.item-row'); if (itemRows.length === 0) { showPOError("Please add at least one item."); savePOBtn.disabled = false; if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Update Purchase Order' : 'Save Purchase Order'; return; } if ((finalPoNumber === null || finalPoNumber === undefined || (typeof finalPoNumber === 'number' && isNaN(finalPoNumber)) ) && !isEditing) { showPOError("Could not determine a valid PO Number. Cannot save."); console.error("DEBUG PO Gen: finalPoNumber is invalid before saving:", finalPoNumber); savePOBtn.disabled = false; if (savePOBtnSpan) savePOBtnSpan.textContent = 'Save Purchase Order'; return; } let itemsArray = []; let validationPassed = true; let calculatedTotalAmount = 0; itemRows.forEach((row, index) => { if (!validationPassed) return; const productNameInput = row.querySelector('.product-name'); const unitTypeSelect = row.querySelector('.unit-type-select'); const quantityInput = row.querySelector('.quantity-input'); const rateInput = row.querySelector('.rate-input'); const itemAmountSpan = row.querySelector('.item-amount'); const partyNameInput = row.querySelector('.party-name'); const designDetailsInput = row.querySelector('.design-details'); const productName = productNameInput?.value.trim(); const unitType = unitTypeSelect?.value; const quantity = parseInt(quantityInput?.value || 0); const rate = parseFloat(rateInput?.value || 0); const itemAmount = parseFloat(itemAmountSpan?.textContent || 0); if (!productName) { validationPassed = false; showPOError(`Item ${index + 1}: Product Name required.`); productNameInput?.focus(); return; } if (isNaN(quantity) || quantity <= 0) { validationPassed = false; showPOError(`Item ${index + 1}: Valid Quantity (>= 1) required.`); quantityInput?.focus(); return; } if (isNaN(rate) || rate < 0) { validationPassed = false; showPOError(`Item ${index + 1}: Valid Rate required.`); rateInput?.focus(); return; } if (isNaN(itemAmount)) { validationPassed = false; console.error(`Item ${index + 1}: Amount calculation error (displaying NaN).`); showPOError(`Item ${index + 1}: Internal amount error.`); return; } let itemData = { productName: productName, type: unitType, quantity: quantity, rate: rate, itemAmount: 0, partyName: partyNameInput?.value.trim() || '', designDetails: designDetailsInput?.value.trim() || '' }; let expectedAmount = 0; if (unitType === 'Sq Feet') { const dimensionUnitSelect = row.querySelector('.dimension-unit-select'); const widthInput = row.querySelector('.width-input'); const heightInput = row.querySelector('.height-input'); const unit = dimensionUnitSelect?.value || 'feet'; const width = parseFloat(widthInput?.value || 0); const height = parseFloat(heightInput?.value || 0); if (isNaN(width) || width <= 0) { validationPassed = false; showPOError(`Item ${index + 1}: Valid Width required.`); widthInput?.focus(); return; } if (isNaN(height) || height <= 0) { validationPassed = false; showPOError(`Item ${index + 1}: Valid Height required.`); heightInput?.focus(); return; } const calcResult = calculateFlexDimensions(unit, width, height); const printSqFtPerItem = parseFloat(calcResult.printSqFt || 0); if(printSqFtPerItem <= 0) { validationPassed = false; showPOError(`Item ${index + 1}: Area calculation error.`); widthInput?.focus(); return; } itemData.unit = unit; itemData.realWidth = width; itemData.realHeight = height; itemData.realSqFt = parseFloat(calcResult.realSqFt); itemData.printWidth = parseFloat(calcResult.printWidth); itemData.printHeight = parseFloat(calcResult.printHeight); itemData.printSqFt = printSqFtPerItem; itemData.inputUnit = calcResult.inputUnit; expectedAmount = itemData.printSqFt * itemData.quantity * itemData.rate; } else { expectedAmount = itemData.quantity * itemData.rate; } if (Math.abs(itemAmount - expectedAmount) > 0.01) { console.warn(`Item ${index + 1} amount mismatch on save: displayed=${itemAmount.toFixed(2)}, calculated=${expectedAmount.toFixed(2)}. Using calculated value.`); itemData.itemAmount = parseFloat(expectedAmount.toFixed(2)); } else { itemData.itemAmount = parseFloat(itemAmount.toFixed(2)); } itemsArray.push(itemData); calculatedTotalAmount += itemData.itemAmount; }); if (!validationPassed) { console.error("Validation failed during item processing."); savePOBtn.disabled = false; if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Update Purchase Order' : 'Save Purchase Order'; return; } savePOBtn.disabled = true; if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Updating...' : 'Saving...'; const poData = { supplierId: supplierId, supplierName: supplierName, poNumber: finalPoNumber, orderDate: Timestamp.fromDate(new Date(orderDateValue + 'T00:00:00')), items: itemsArray, totalAmount: parseFloat(calculatedTotalAmount.toFixed(2)), notes: notes, updatedAt: serverTimestamp() }; if (!isEditing) { poData.createdAt = serverTimestamp(); poData.status = 'New'; } else { poData.status = editingPOData?.status || 'Updated'; } console.log("DEBUG PO Gen: Final PO Data being sent to Firestore:", poData); try { let successMessage = ''; if (isEditing) { const poDocRef = doc(db, "purchaseOrders", editingPOId); await updateDoc(poDocRef, poData); successMessage = `Purchase Order ${poData.poNumber} updated successfully!`; console.log(successMessage, "ID:", editingPOId); } else { if (typeof poData.poNumber !== 'number' || isNaN(poData.poNumber) || poData.poNumber <= 0) { throw new Error(`Invalid PO number detected just before save: ${poData.poNumber}`); } const poDocRef = await addDoc(collection(db, "purchaseOrders"), poData); successMessage = `Purchase Order ${poData.poNumber} created successfully!`; console.log(successMessage, "ID:", poDocRef.id); } alert(successMessage); window.location.href = 'supplier_management.html'; } catch (error) { console.error("Error saving PO to Firestore:", error); showPOError("Error saving Purchase Order: " + error.message); savePOBtn.disabled = false; if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Update Purchase Order' : 'Save Purchase Order'; }
}

// --- Load PO for Editing ---
async function loadPOForEditing(poId) {
    // This function remains unchanged from v12.
    console.log(`Loading PO ${poId} for editing...`); if (!db || !doc || !getDoc || !poForm) { showPOError("Cannot load PO: Init error."); return; } if (poPageTitle) poPageTitle.innerHTML = `<i class="fas fa-edit"></i> Edit Purchase Order`; if (poBreadcrumbAction) poBreadcrumbAction.textContent = `Edit PO`; if (savePOBtnSpan) savePOBtnSpan.textContent = 'Update Purchase Order'; editPOIdInput.value = poId; if (poNumberInput) poNumberInput.readOnly = false; try { const poDocRef = doc(db, "purchaseOrders", poId); const poDocSnap = await getDoc(poDocRef); if (poDocSnap.exists()) { editingPOData = poDocSnap.data(); console.log("PO Data loaded:", editingPOData); if(supplierSearchInput && editingPOData.supplierName) supplierSearchInput.value = editingPOData.supplierName; if(selectedSupplierIdInput && editingPOData.supplierId) selectedSupplierIdInput.value = editingPOData.supplierId; if(selectedSupplierNameInput && editingPOData.supplierName) selectedSupplierNameInput.value = editingPOData.supplierName; if(poNumberInput && editingPOData.poNumber !== undefined) { poNumberInput.value = editingPOData.poNumber; if (poBreadcrumbAction) poBreadcrumbAction.textContent = `Edit PO #${editingPOData.poNumber}`; } else if (poNumberInput) { poNumberInput.value = ''; } if(poOrderDateInput && editingPOData.orderDate?.toDate) { poOrderDateInput.value = editingPOData.orderDate.toDate().toISOString().split('T')[0]; } else if (poOrderDateInput) { poOrderDateInput.value = ''; } if(poNotesInput && editingPOData.notes) poNotesInput.value = editingPOData.notes; poItemsTableBody.innerHTML = ''; if (editingPOData.items && Array.isArray(editingPOData.items) && editingPOData.items.length > 0) { editingPOData.items.forEach(item => { if (!itemRowTemplate) return; const templateContent = itemRowTemplate.content.cloneNode(true); const newRow = templateContent.querySelector('.item-row'); if (newRow) { const productNameInput = newRow.querySelector('.product-name'); if(productNameInput) productNameInput.value = item.productName || ''; const unitTypeSelect = newRow.querySelector('.unit-type-select'); if(unitTypeSelect) unitTypeSelect.value = item.type || 'Qty'; const rateInput = newRow.querySelector('.rate-input'); if(rateInput) rateInput.value = item.rate ?? ''; const partyNameInput = newRow.querySelector('.party-name'); if(partyNameInput) partyNameInput.value = item.partyName || ''; const designDetailsInput = newRow.querySelector('.design-details'); if(designDetailsInput) designDetailsInput.value = item.designDetails || ''; const quantityInput = newRow.querySelector('.quantity-input'); if(quantityInput) { quantityInput.value = item.quantity ?? 1; } if (item.type === 'Sq Feet') { const dimensionUnitSelect = newRow.querySelector('.dimension-unit-select'); if(dimensionUnitSelect) dimensionUnitSelect.value = item.unit || 'feet'; const widthInput = newRow.querySelector('.width-input'); if(widthInput) widthInput.value = item.realWidth ?? item.width ?? ''; const heightInput = newRow.querySelector('.height-input'); if(heightInput) heightInput.value = item.realHeight ?? item.height ?? ''; } poItemsTableBody.appendChild(newRow); addItemRowEventListeners(newRow); } }); } else { if (addItemBtn) addItemBtn.click(); } updateTotalAmount(); updateFullCalculationPreview(); } else { console.error("No such PO document!"); showPOError("Error: Could not find PO to edit."); if(savePOBtn) savePOBtn.disabled = true; } } catch (error) { console.error("Error loading PO for editing:", error); showPOError("Error loading PO data: " + error.message); if(savePOBtn) savePOBtn.disabled = true; }
}

// --- Helper function showPOError ---
function showPOError(message) {
    // This function remains unchanged.
    if (poErrorMsg) { poErrorMsg.textContent = message; poErrorMsg.style.display = message ? 'block' : 'none'; } else { if(message) alert(message); }
}

console.log("new_po.js v13 loaded and ready."); // Version bump