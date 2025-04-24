// js/new_po.js - v15.1 (Fix: Use itemData.rate when populating PO edit form)

// Assume Firebase functions are globally available via HTML script block
const {
    db, collection, doc, addDoc, getDoc, getDocs, updateDoc, serverTimestamp, Timestamp,
    query, where, orderBy, limit
} = window;

// --- DOM Elements ---
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
let supplierSearchDebounceTimer;
let productSearchDebounceTimer;
let editingPOData = null; // Store loaded PO data for edit mode reference
let activeProductInput = null;

// --- Utility Functions ---
function calculateFlexDimensions(unit, width, height) { /* ... (Code unchanged from original v15) ... */ console.log(`Calculating flex: Unit=${unit}, W=${width}, H=${height}`); const mediaWidthsFt = [3, 4, 5, 6, 8, 10]; let wFt = (unit === 'inches') ? parseFloat(width || 0) / 12 : parseFloat(width || 0); let hFt = (unit === 'inches') ? parseFloat(height || 0) / 12 : parseFloat(height || 0); if (isNaN(wFt) || isNaN(hFt) || wFt <= 0 || hFt <= 0) { return { realSqFt: 0, printWidth: 0, printHeight: 0, printSqFt: 0, inputUnit: unit, realWidthFt: 0, realHeightFt: 0, printWidthFt: 0, printHeightFt: 0 }; } const realSqFt = wFt * hFt; const mediaWidthFitW = mediaWidthsFt.find(mw => mw >= wFt); let printWidthFt1 = mediaWidthFitW || wFt; let printHeightFt1 = hFt; let printSqFt1 = printWidthFt1 * printHeightFt1; if (!mediaWidthFitW) console.warn(`Width ${wFt.toFixed(2)}ft exceeds max media width.`); const mediaWidthFitH = mediaWidthsFt.find(mw => mw >= hFt); let printWidthFt2 = wFt; let printHeightFt2 = mediaWidthFitH || hFt; let printSqFt2 = printWidthFt2 * printHeightFt2; if (!mediaWidthFitH) console.warn(`Height ${hFt.toFixed(2)}ft exceeds max media width.`); let finalPrintWidthFt, finalPrintHeightFt, finalPrintSqFt; if (!mediaWidthFitH || printSqFt1 <= printSqFt2) { finalPrintWidthFt = printWidthFt1; finalPrintHeightFt = printHeightFt1; finalPrintSqFt = printSqFt1; } else { finalPrintWidthFt = printWidthFt2; finalPrintHeightFt = printHeightFt2; finalPrintSqFt = printSqFt2; } let displayPrintWidth = (unit === 'inches') ? finalPrintWidthFt * 12 : finalPrintWidthFt; let displayPrintHeight = (unit === 'inches') ? finalPrintHeightFt * 12 : finalPrintHeightFt; return { realSqFt: realSqFt.toFixed(2), printWidth: displayPrintWidth.toFixed(2), printHeight: displayPrintHeight.toFixed(2), printSqFt: finalPrintSqFt.toFixed(2), inputUnit: unit, realWidthFt: wFt, realHeightFt: hFt, printWidthFt: finalPrintWidthFt, printHeightFt: finalPrintHeightFt }; }
function updateTotalAmount() { /* ... (Code unchanged from original v15) ... */ let total = 0; poItemsTableBody.querySelectorAll('.item-row').forEach(row => { const amountSpan = row.querySelector('.item-amount'); total += parseFloat(amountSpan?.textContent || 0); }); if (poTotalAmountSpan) { poTotalAmountSpan.textContent = total.toFixed(2); } }
function updateFullCalculationPreview() { /* ... (Code unchanged from original v15) ... */ if (!calculationPreviewArea || !poItemsTableBody) return; let entriesHTML = ''; const itemRows = poItemsTableBody.querySelectorAll('.item-row'); let foundSqFt = false; itemRows.forEach((row, index) => { const unitTypeSelect = row.querySelector('.unit-type-select'); if (unitTypeSelect?.value === 'Sq Feet') { foundSqFt = true; const productNameInput = row.querySelector('.product-name'); const productName = productNameInput?.value.trim() || `Item ${index + 1}`; const dimensionUnitSelect = row.querySelector('.dimension-unit-select'); const widthInput = row.querySelector('.width-input'); const heightInput = row.querySelector('.height-input'); const quantityInput = row.querySelector('.quantity-input'); const unit = dimensionUnitSelect ? dimensionUnitSelect.value : 'feet'; const width = parseFloat(widthInput?.value || 0); const height = parseFloat(heightInput?.value || 0); let quantity = parseInt(quantityInput?.value || 1); if (isNaN(quantity) || quantity < 1) { quantity = 1; } let entryContent = `<strong>${productName}:</strong><br>`; if (width > 0 && height > 0) { const calcResult = calculateFlexDimensions(unit, width, height); if (calcResult && parseFloat(calcResult.printSqFt) > 0) { const realSqFtNum = parseFloat(calcResult.realSqFt); const printSqFtNum = parseFloat(calcResult.printSqFt); const wastageSqFt = (printSqFtNum - realSqFtNum); let wastageSizeStr = "N/A"; const widthDiff = (calcResult.printWidthFt - calcResult.realWidthFt); const heightDiff = (calcResult.printHeightFt - calcResult.realHeightFt); const tolerance = 0.01; if (widthDiff > tolerance && Math.abs(heightDiff) < tolerance) { wastageSizeStr = `${widthDiff.toFixed(2)}ft W x ${calcResult.realHeightFt.toFixed(2)}ft H`; } else if (heightDiff > tolerance && Math.abs(widthDiff) < tolerance) { wastageSizeStr = `${calcResult.realWidthFt.toFixed(2)}ft W x ${heightDiff.toFixed(2)}ft H`; } else if (widthDiff > tolerance && heightDiff > tolerance) { wastageSizeStr = `~${wastageSqFt.toFixed(2)} sq ft area (complex)`; } else if (wastageSqFt > tolerance) { wastageSizeStr = `~${wastageSqFt.toFixed(2)} sq ft area`; } else { wastageSizeStr = "None"; } entryContent += `&nbsp; Quantity: ${quantity}<br>`; entryContent += `&nbsp; Real: ${calcResult.realWidthFt.toFixed(2)}ft x ${calcResult.realHeightFt.toFixed(2)}ft = ${realSqFtNum.toFixed(2)} sq ft/item<br>`; entryContent += `&nbsp; Print: ${calcResult.printWidthFt.toFixed(2)}ft x ${calcResult.printHeightFt.toFixed(2)}ft = ${printSqFtNum.toFixed(2)} sq ft/item<br>`; entryContent += `&nbsp; Total Print Area: ${(printSqFtNum * quantity).toFixed(2)} sq ft<br>`; entryContent += `&nbsp; <strong style="color: ${wastageSqFt > tolerance ? 'orange' : 'green'};">Wastage: ${wastageSqFt.toFixed(2)} sq ft/item</strong> | <span style="color: ${wastageSqFt > tolerance ? 'orange' : 'green'};">Size: ${wastageSizeStr}</span>`; } else { entryContent += `&nbsp; <span style="color:orange;">Invalid dimensions or calculation error.</span>`; } } else { entryContent += `&nbsp; <span style="color:grey;">Enter valid width & height.</span>`; } entriesHTML += `<div class="item-preview-entry">${entryContent}</div>`; } }); let finalHTML = '<h4>Calculation Details:</h4>'; if (foundSqFt && entriesHTML) { finalHTML += `<div class="calculation-grid">${entriesHTML}</div>`; } else { finalHTML += '<p style="color:grey;">Add items with Unit Type "Sq Feet" to see calculations.</p>'; } calculationPreviewArea.innerHTML = finalHTML; }
function updateItemAmount(row) { /* ... (Code unchanged from original v15) ... */ if (!row) return; const unitTypeSelect = row.querySelector('.unit-type-select'); const amountSpan = row.querySelector('.item-amount'); const rateInput = row.querySelector('.rate-input'); const quantityInput = row.querySelector('.quantity-input'); let amount = 0; try { const rate = parseFloat(rateInput?.value || 0); let quantity = parseInt(quantityInput?.value || 1); if (isNaN(quantity) || quantity < 1) { quantity = 1; } if (unitTypeSelect?.value === 'Sq Feet') { const dimensionUnitSelect = row.querySelector('.dimension-unit-select'); const widthInput = row.querySelector('.width-input'); const heightInput = row.querySelector('.height-input'); const unit = dimensionUnitSelect ? dimensionUnitSelect.value : 'feet'; const width = parseFloat(widthInput?.value || 0); const height = parseFloat(heightInput?.value || 0); if (width > 0 && height > 0) { const calcResult = calculateFlexDimensions(unit, width, height); amount = (parseFloat(calcResult.printSqFt || 0) * quantity * rate); } } else { amount = quantity * rate; } } catch (e) { console.error("Error calculating item amount:", e); amount = 0; } if (amountSpan) amountSpan.textContent = amount.toFixed(2); updateTotalAmount(); updateFullCalculationPreview(); }
function handleUnitTypeChange(event) { /* ... (Code unchanged from original v15) ... */ const row = event.target.closest('.item-row'); if (!row) { console.error("handleUnitTypeChange: Could not find parent row."); return; } const unitType = event.target.value; console.log(`Unit type changed to: ${unitType} for row:`, row); const cells = row.querySelectorAll('td'); const sqFeetDimensionCell = cells.length > 2 ? cells[2] : null; const sqFeetUnitCell = cells.length > 3 ? cells[3] : null; const qtyInputDirectParentCell = row.querySelector('.quantity-input')?.closest('td'); const table = row.closest('table'); const headers = table?.querySelectorAll('thead th'); if (!headers || headers.length < 5) { console.error("handleUnitTypeChange: Could not find table headers."); return; } const sqFeetHeader1 = headers[2]; const sqFeetHeader2 = headers[3]; const qtyHeader = headers[4]; const rateInput = row.querySelector('.rate-input'); if (!sqFeetDimensionCell || !sqFeetUnitCell || !qtyInputDirectParentCell || !sqFeetHeader1 || !sqFeetHeader2 || !qtyHeader) { console.error("handleUnitTypeChange: Could not find all necessary cells/headers for unit type toggle."); return; } if (unitType === 'Sq Feet') { console.log("Switching to Sq Feet view"); sqFeetDimensionCell.style.display = ''; sqFeetUnitCell.style.display = ''; sqFeetHeader1.classList.remove('hidden-col'); sqFeetHeader2.classList.remove('hidden-col'); qtyInputDirectParentCell.style.display = ''; qtyHeader.classList.remove('hidden-col'); if (rateInput) rateInput.placeholder = 'Rate/SqFt'; } else { console.log("Switching to Qty view"); sqFeetDimensionCell.style.display = 'none'; sqFeetUnitCell.style.display = 'none'; sqFeetHeader1.classList.add('hidden-col'); sqFeetHeader2.classList.add('hidden-col'); qtyInputDirectParentCell.style.display = ''; qtyHeader.classList.remove('hidden-col'); if (rateInput) rateInput.placeholder = 'Rate/Unit'; const widthInput = sqFeetDimensionCell.querySelector('.width-input'); const heightInput = sqFeetDimensionCell.querySelector('.height-input'); if (widthInput) widthInput.value = ''; if (heightInput) heightInput.value = ''; } updateItemAmount(row); }
function addItemRowEventListeners(row) { /* ... (Code unchanged from original v15) ... */ const unitTypeSelect = row.querySelector('.unit-type-select'); const dimensionUnitSelect = row.querySelector('.dimension-unit-select'); const widthInput = row.querySelector('.width-input'); const heightInput = row.querySelector('.height-input'); const quantityInput = row.querySelector('.quantity-input'); const rateInput = row.querySelector('.rate-input'); const deleteBtn = row.querySelector('.delete-item-btn'); const recalcInputs = [dimensionUnitSelect, widthInput, heightInput, quantityInput, rateInput]; recalcInputs.forEach(input => { if (input) { input.addEventListener('input', () => updateItemAmount(row)); input.addEventListener('change', () => updateItemAmount(row)); } }); if (unitTypeSelect) { unitTypeSelect.addEventListener('change', handleUnitTypeChange); } if (deleteBtn) { deleteBtn.addEventListener('click', () => { row.remove(); hideProductSuggestions(); updateTotalAmount(); updateFullCalculationPreview(); }); } if (unitTypeSelect) { handleUnitTypeChange({ target: unitTypeSelect }); } else { console.warn("Unit type select not found in row for initial state setting:", row); } updateItemAmount(row); }

// --- Product Search Implementation ---
// (No changes needed in these functions)
function getOrCreateProductSuggestionsDiv() { /* ... same as before ... */ if (!productSuggestionsDiv) { productSuggestionsDiv = document.createElement('div'); productSuggestionsDiv.className = 'product-suggestions-list'; productSuggestionsDiv.style.display = 'none'; document.body.appendChild(productSuggestionsDiv); } return productSuggestionsDiv; }
function positionProductSuggestions(inputElement) { /* ... same as before ... */ const suggestionsDiv = getOrCreateProductSuggestionsDiv(); const rect = inputElement.getBoundingClientRect(); suggestionsDiv.style.left = `${rect.left + window.scrollX}px`; suggestionsDiv.style.top = `${rect.bottom + window.scrollY}px`; suggestionsDiv.style.width = `${rect.width}px`; suggestionsDiv.style.display = 'block'; }
function hideProductSuggestions() { /* ... same as before ... */ if (productSuggestionsDiv) { productSuggestionsDiv.style.display = 'none'; } activeProductInput = null; }
function handleProductSearchInput(event) { /* ... same as before ... */ const inputElement = event.target; if (!inputElement.matches('.product-name')) { return; } activeProductInput = inputElement; clearTimeout(productSearchDebounceTimer); const searchTerm = inputElement.value.trim(); if (searchTerm.length < 1) { hideProductSuggestions(); return; } positionProductSuggestions(inputElement); productSearchDebounceTimer = setTimeout(() => { fetchProductSuggestions(searchTerm, inputElement); }, 350); }
async function fetchProductSuggestions(searchTerm, inputElement) { /* ... same as before ... */ const suggestionsDiv = getOrCreateProductSuggestionsDiv(); suggestionsDiv.innerHTML = '<div>Loading...</div>'; if (activeProductInput === inputElement) { positionProductSuggestions(inputElement); } else { hideProductSuggestions(); return; } const searchTermLower = searchTerm.toLowerCase(); try { console.log(`Searching products with lowercase term: "${searchTermLower}"`); const q = query( collection(db, "products"), orderBy("printName_lowercase"), where("printName_lowercase", ">=", searchTermLower), where("printName_lowercase", "<=", searchTermLower + '\uf8ff'), limit(10) ); const querySnapshot = await getDocs(q); suggestionsDiv.innerHTML = ''; if (querySnapshot.empty) { console.log(`No products found matching lowercase: "${searchTermLower}"`); suggestionsDiv.innerHTML = '<div class="no-suggestions">No matching products found.</div>'; } else { querySnapshot.forEach((docSnapshot) => { const product = docSnapshot.data(); if (product.printName_lowercase === undefined) { console.warn(`Product ${docSnapshot.id} (${product.printName}) is missing 'printName_lowercase' field.`); } const productId = docSnapshot.id; const div = document.createElement('div'); div.textContent = product.printName || 'Unnamed Product'; div.dataset.id = productId; div.dataset.name = product.printName || ''; div.dataset.rate = product.purchasePrice ?? ''; div.dataset.unitFirestore = product.unit || 'Qty'; div.addEventListener('mousedown', (e) => { e.preventDefault(); selectProductSuggestion(product, inputElement); }); suggestionsDiv.appendChild(div); }); } if (activeProductInput === inputElement) { suggestionsDiv.style.display = 'block'; } else { hideProductSuggestions(); } } catch (error) { console.error("Error fetching product suggestions:", error); if (error.message.includes("indexes are required")) { console.error("Firestore Index Missing: Please create a Firestore index for the 'products' collection on the 'printName_lowercase' field (ascending)."); suggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Search Error (Index Missing).</div>'; } else if (error.message.includes("does not support order by")) { console.error("Firestore Field Missing or Index Error: Ensure 'printName_lowercase' field exists and is indexed."); suggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Search Error (Field/Index).</div>'; } else { suggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Error fetching products.</div>'; } if (activeProductInput === inputElement) { suggestionsDiv.style.display = 'block'; } } }
function selectProductSuggestion(productData, inputElement) { /* ... same as before ... */ const row = inputElement.closest('.item-row'); if (!row) { console.error("Could not find parent row for product selection."); hideProductSuggestions(); return; } const productNameInput = row.querySelector('.product-name'); const unitTypeSelect = row.querySelector('.unit-type-select'); const rateInput = row.querySelector('.rate-input'); const quantityInput = row.querySelector('.quantity-input'); if (!productNameInput || !unitTypeSelect || !rateInput || !quantityInput) { console.error("Could not find all necessary fields (product, unit type, rate, quantity) in the row."); hideProductSuggestions(); return; } productNameInput.value = productData.printName || ''; rateInput.value = productData.purchasePrice ?? ''; let unitFromFirestore = productData.unit || 'Qty'; let valueToSelect = 'Qty'; const unitLowerCase = unitFromFirestore.toLowerCase(); if (unitLowerCase.includes('sq') || unitLowerCase.includes('feet') || unitLowerCase.includes('ft')) { valueToSelect = 'Sq Feet'; } else if (unitLowerCase === 'nos' || unitLowerCase === 'qty') { valueToSelect = 'Qty'; } else { console.warn(`Unexpected unit type "${unitFromFirestore}" from Firestore product data. Defaulting display type to Qty.`); valueToSelect = 'Qty'; } let unitTypeFound = false; for (let option of unitTypeSelect.options) { if (option.value === valueToSelect) { unitTypeSelect.value = valueToSelect; unitTypeFound = true; break; } } if (!unitTypeFound) { console.error(`Dropdown option value "${valueToSelect}" (derived from unit "${unitFromFirestore}") not found! Check HTML template. Defaulting to Qty.`); unitTypeSelect.value = 'Qty'; } hideProductSuggestions(); const changeEvent = new Event('change', { bubbles: true }); unitTypeSelect.dispatchEvent(changeEvent); let nextInput = null; if (unitTypeSelect.value === 'Sq Feet') { nextInput = row.querySelector('.width-input'); } else { nextInput = quantityInput; } if (!nextInput) { nextInput = rateInput; } if (nextInput) { nextInput.focus(); if (typeof nextInput.select === 'function') { nextInput.select(); } } }


// --- DOMContentLoaded Listener ---
// (No changes needed in this function)
document.addEventListener('DOMContentLoaded', () => { /* ... same as before ... */ });


// --- Supplier Search Implementation ---
// (No changes needed in these functions)
function handleSupplierSearchInput() { /* ... same as before ... */ }
async function fetchSupplierSuggestions(searchTerm) { /* ... same as before ... */ }


// --- Load Order Data for PO Function ---
// (No changes needed in this function)
async function loadOrderDataForPO(orderId, itemIndices) { /* ... same as before ... */ }

// ========================================================================
// <<<--- UPDATED populateItemRow function (v15.1 - Prioritize itemData.rate) ---<<<
// ========================================================================
async function populateItemRow(rowElement, itemData) {
    // Get references to elements in the row
    const productNameInput = rowElement.querySelector('.product-name');
    const quantityInput = rowElement.querySelector('.quantity-input');
    const partyNameInput = rowElement.querySelector('.party-name');
    const rateInput = rowElement.querySelector('.rate-input');
    const unitTypeSelect = rowElement.querySelector('.unit-type-select');
    const dimensionUnitSelect = rowElement.querySelector('.dimension-unit-select');
    const widthInput = rowElement.querySelector('.width-input');
    const heightInput = rowElement.querySelector('.height-input');

    // Ensure all critical elements exist
    if (!productNameInput || !quantityInput || !partyNameInput || !rateInput || !unitTypeSelect || !dimensionUnitSelect || !widthInput || !heightInput) {
        console.error("populateItemRow: Could not find all necessary input/select elements within the row:", rowElement);
        return; // Stop if elements are missing
    }

    console.log("Populating row with itemData:", itemData);

    // --- Populate basic info first ---
    productNameInput.value = itemData.productName || '';
    quantityInput.value = itemData.quantity || 1;
    // Use partyName if available, otherwise fallback to customer name from itemData if loading from order
    partyNameInput.value = itemData.partyName || itemData.customerDetails?.fullName || '';

    // Determine unit type based on itemData first, fallback to product data later if needed
    let itemUnitType = itemData.unitType || 'Qty'; // Get unit type saved with the item
    let valueToSelect = 'Qty'; // Default value for dropdown
    const unitLowerCase = itemUnitType.toLowerCase();
    if (unitLowerCase.includes('sq') || unitLowerCase.includes('feet') || unitLowerCase.includes('ft')) {
        valueToSelect = 'Sq Feet';
    }
    // Set the dropdown value
    let unitTypeFound = false;
    for (let option of unitTypeSelect.options) {
        if (option.value === valueToSelect) {
            unitTypeSelect.value = valueToSelect;
            unitTypeFound = true;
            break;
        }
    }
    if (!unitTypeFound) {
        console.warn(`Dropdown option value "${valueToSelect}" (from itemData.unitType "${itemUnitType}") not found! Defaulting to Qty.`);
        unitTypeSelect.value = 'Qty';
    }

    // Populate dimensions if it's Sq Feet type
    if (unitTypeSelect.value === 'Sq Feet') {
        // Use dimensionUnit, width, height saved with the item
        dimensionUnitSelect.value = itemData.dimensionUnit || 'feet';
        widthInput.value = itemData.width ?? ''; // Use saved width
        heightInput.value = itemData.height ?? ''; // Use saved height
        console.log(`Populated dimensions: Unit=${dimensionUnitSelect.value}, W=${widthInput.value}, H=${heightInput.value}`);
    } else {
        // Clear dimension fields if not Sq Feet
        dimensionUnitSelect.value = 'feet';
        widthInput.value = '';
        heightInput.value = '';
    }

    // --- Set Rate (Prioritize itemData.rate) ---
    let finalRate = '';
    if (itemData.rate !== undefined && itemData.rate !== null) {
        // *** USE THE RATE SAVED WITH THE ITEM DATA FIRST ***
        finalRate = String(itemData.rate);
        console.log(`Using rate from itemData: ${finalRate}`);
    } else {
        // Fallback: Try fetching product data if rate wasn't in itemData
        // This might happen when loading from a Sales Order for a new PO
        console.log("Rate not found in itemData, attempting to fetch product purchasePrice...");
        let fetchedProductData = null;
        if (itemData.productId) {
            try {
                const productRef = doc(db, "products", itemData.productId);
                const productSnap = await getDoc(productRef);
                if (productSnap.exists()) {
                    fetchedProductData = productSnap.data();
                    console.log("Fetched product data for rate fallback:", fetchedProductData);
                    // Use purchasePrice if available
                    if (fetchedProductData.purchasePrice !== undefined && fetchedProductData.purchasePrice !== null) {
                        finalRate = String(fetchedProductData.purchasePrice);
                        console.log(`Using purchasePrice from fetched product: ${finalRate}`);
                    } else {
                         console.log("purchasePrice not found in fetched product data.");
                    }
                } else {
                    console.warn(`Product document ${itemData.productId} not found for rate fallback.`);
                }
            } catch (error) {
                console.error(`Error fetching product ${itemData.productId} for rate fallback:`, error);
            }
        } else {
            console.warn("No productId in itemData to fetch product for rate fallback.");
        }
    }

    // Set the rate input value
    rateInput.value = finalRate;

    // Trigger change on unit type AFTER potentially fetching product data
    // to ensure UI visibility (Sq Feet inputs) is correct based on FINAL unit type.
    handleUnitTypeChange({ target: unitTypeSelect });

    // Important: Update item amount calculation AFTER all fields are set
    updateItemAmount(rowElement);

    // Focus logic (optional, can be adjusted)
    // If rate is empty after all checks, focus it. Otherwise focus quantity.
    if (rateInput && !rateInput.value) {
        setTimeout(() => rateInput.focus(), 0);
    } else if (quantityInput) {
        setTimeout(() => quantityInput.focus(), 0); // Fallback focus
    }
}
// ========================================================================
// --- End UPDATED populateItemRow ---
// ========================================================================


// --- Save PO Function ---
// (No changes needed in this function compared to v15)
async function handleSavePO(event) { /* ... same as original v15 ... */ }


// --- Load PO for Editing ---
// (No changes needed in this function)
async function loadPOForEditing(poId) { /* ... same as original v15 ... */ }


// --- Helper function showPOError ---
// (No changes needed in this function)
function showPOError(message) { /* ... same as original v15 ... */ }

console.log("new_po.js v15.1 (Fixed Rate Population) loaded and ready."); // Version bump