// js/new_po.js - v7 (Product Auto-Suggest Added)

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
// Dynamic Product Suggestion List Element (created on demand)
let productSuggestionsDiv = null;

// --- Global State ---
let supplierSearchDebounceTimer;
let productSearchDebounceTimer; // <<< Added for product search
let editingPOData = null;
let activeProductInput = null; // <<< Added: Track which product input is active

// --- Utility Functions --- (calculateFlexDimensions, updateTotalAmount, etc. - Kept from previous version)
function calculateFlexDimensions(unit, width, height) {
    // ... (Keep the function exactly as it was in the file you sent) ...
    console.log(`Calculating flex: Unit=${unit}, W=${width}, H=${height}`);
    const mediaWidthsFt = [3, 4, 5, 6, 8, 10];
    let wFt = (unit === 'inches') ? parseFloat(width || 0) / 12 : parseFloat(width || 0);
    let hFt = (unit === 'inches') ? parseFloat(height || 0) / 12 : parseFloat(height || 0);
    if (isNaN(wFt) || isNaN(hFt) || wFt <= 0 || hFt <= 0) { return { realSqFt: 0, printWidth: 0, printHeight: 0, printSqFt: 0, inputUnit: unit, realWidthFt: 0, realHeightFt: 0, printWidthFt: 0, printHeightFt: 0 }; }
    const realSqFt = wFt * hFt;
    const mediaWidthFitW = mediaWidthsFt.find(mw => mw >= wFt);
    let printWidthFt1 = mediaWidthFitW || wFt; let printHeightFt1 = hFt; let printSqFt1 = printWidthFt1 * printHeightFt1;
    if (!mediaWidthFitW) console.warn(`Width ${wFt.toFixed(2)}ft exceeds max media width.`);
    const mediaWidthFitH = mediaWidthsFt.find(mw => mw >= hFt);
    let printWidthFt2 = wFt; let printHeightFt2 = mediaWidthFitH || hFt; let printSqFt2 = printWidthFt2 * printHeightFt2;
    if (!mediaWidthFitH) console.warn(`Height ${hFt.toFixed(2)}ft exceeds max media width.`);
    let finalPrintWidthFt, finalPrintHeightFt, finalPrintSqFt;
    if (!mediaWidthFitH || printSqFt1 <= printSqFt2) {
         finalPrintWidthFt = printWidthFt1; finalPrintHeightFt = printHeightFt1; finalPrintSqFt = printSqFt1;
    } else {
         finalPrintWidthFt = printWidthFt2; finalPrintHeightFt = printHeightFt2; finalPrintSqFt = printSqFt2;
    }
    let displayPrintWidth = (unit === 'inches') ? finalPrintWidthFt * 12 : finalPrintWidthFt;
    let displayPrintHeight = (unit === 'inches') ? finalPrintHeightFt * 12 : finalPrintHeightFt;
    return {
        realSqFt: realSqFt.toFixed(2), printWidth: displayPrintWidth.toFixed(2), printHeight: displayPrintHeight.toFixed(2),
        printSqFt: finalPrintSqFt.toFixed(2), inputUnit: unit, realWidthFt: wFt, realHeightFt: hFt,
        printWidthFt: finalPrintWidthFt, printHeightFt: finalPrintHeightFt
    };
}
function updateTotalAmount() {
    // ... (Keep the function exactly as it was in the file you sent) ...
    let total = 0;
    poItemsTableBody.querySelectorAll('.item-row').forEach(row => {
        const amountSpan = row.querySelector('.item-amount');
        total += parseFloat(amountSpan?.textContent || 0);
    });
    if (poTotalAmountSpan) { poTotalAmountSpan.textContent = total.toFixed(2); }
}
function updateFullCalculationPreview() {
     // ... (Keep the function exactly as it was in the file you sent) ...
     if (!calculationPreviewArea || !poItemsTableBody) return;
     let previewHTML = '<h4>Calculation Details:</h4>';
     const itemRows = poItemsTableBody.querySelectorAll('.item-row');
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
             const unit = dimensionUnitSelect ? dimensionUnitSelect.value : 'feet';
             const width = parseFloat(widthInput?.value || 0);
             const height = parseFloat(heightInput?.value || 0);
             previewHTML += `<div class="item-preview-entry"><strong>${productName}:</strong><br>`;
             if (width > 0 && height > 0) {
                 const calcResult = calculateFlexDimensions(unit, width, height);
                 if (calcResult && parseFloat(calcResult.printSqFt) > 0) {
                      const realSqFtNum = parseFloat(calcResult.realSqFt);
                      const printSqFtNum = parseFloat(calcResult.printSqFt);
                      const wastageSqFt = (printSqFtNum - realSqFtNum);
                      let wastageSizeStr = "N/A";
                      const widthDiff = (calcResult.printWidthFt - calcResult.realWidthFt);
                      const heightDiff = (calcResult.printHeightFt - calcResult.realHeightFt);
                      const tolerance = 0.01;
                      if (widthDiff > tolerance && Math.abs(heightDiff) < tolerance) { wastageSizeStr = `${widthDiff.toFixed(2)}ft W x ${calcResult.realHeightFt.toFixed(2)}ft H`; }
                      else if (heightDiff > tolerance && Math.abs(widthDiff) < tolerance) { wastageSizeStr = `${calcResult.realWidthFt.toFixed(2)}ft W x ${heightDiff.toFixed(2)}ft H`; }
                      else if (widthDiff > tolerance && heightDiff > tolerance) { wastageSizeStr = `~${wastageSqFt.toFixed(2)} sq ft area (complex)`; }
                      else if (wastageSqFt > tolerance) { wastageSizeStr = `~${wastageSqFt.toFixed(2)} sq ft area`; }
                      else { wastageSizeStr = "None"; }
                      previewHTML += `&nbsp; Real: ${calcResult.realWidthFt.toFixed(2)}ft x ${calcResult.realHeightFt.toFixed(2)}ft = ${realSqFtNum.toFixed(2)} sq ft<br>&nbsp; Print: ${calcResult.printWidthFt.toFixed(2)}ft x ${calcResult.printHeightFt.toFixed(2)}ft = ${printSqFtNum.toFixed(2)} sq ft<br>&nbsp; <strong style="color: ${wastageSqFt > tolerance ? 'orange' : 'green'};">Wastage: ${wastageSqFt.toFixed(2)} sq ft</strong> | <span style="color: ${wastageSqFt > tolerance ? 'orange' : 'green'};">Size: ${wastageSizeStr}</span>`;
                 } else { previewHTML += `&nbsp; <span style="color:orange;">Invalid dimensions or calculation error.</span>`; }
             } else { previewHTML += `&nbsp; <span style="color:grey;">Enter valid width & height.</span>`; }
             previewHTML += `</div>`;
         }
     });
     if (!foundSqFt) { previewHTML += '<p style="color:grey;">Add items with Unit Type "Sq Feet" to see calculations.</p>'; }
     calculationPreviewArea.innerHTML = previewHTML;
}
function updateItemAmount(row) {
    // ... (Keep the function exactly as it was in the file you sent) ...
    if (!row) return;
    const unitTypeSelect = row.querySelector('.unit-type-select');
    const amountSpan = row.querySelector('.item-amount');
    const rateInput = row.querySelector('.rate-input');
    let amount = 0;
    try {
        const rate = parseFloat(rateInput?.value || 0);
        if (unitTypeSelect?.value === 'Sq Feet') {
            const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
            const widthInput = row.querySelector('.width-input');
            const heightInput = row.querySelector('.height-input');
            const unit = dimensionUnitSelect ? dimensionUnitSelect.value : 'feet';
            const width = parseFloat(widthInput?.value || 0);
            const height = parseFloat(heightInput?.value || 0);
            if (width > 0 && height > 0) {
                 const calcResult = calculateFlexDimensions(unit, width, height);
                 amount = (parseFloat(calcResult.printSqFt) * rate);
            }
        } else { // Qty
            const quantityInput = row.querySelector('.quantity-input'); // Find the input field itself
            const quantity = parseInt(quantityInput?.value || 0); // Get value from the input field
            amount = quantity * rate;
        }
    } catch (e) { console.error("Error calculating item amount:", e); amount = 0; }
    if (amountSpan) amountSpan.textContent = amount.toFixed(2);
    updateTotalAmount();
    updateFullCalculationPreview(); // Already called here, good.
}
function handleUnitTypeChange(event) {
     // ... (Keep the function exactly as it was in the file you sent) ...
    const row = event.target.closest('.item-row');
    if (!row) { console.error("handleUnitTypeChange: Could not find parent row."); return; }
    const unitType = event.target.value;
    console.log(`Unit type changed to: ${unitType} for row:`, row);
    const cells = row.querySelectorAll('td');
    const sqFeetDimensionCell = cells.length > 2 ? cells[2] : null;
    const sqFeetUnitCell = cells.length > 3 ? cells[3] : null;
    const qtyInputDirectParentCell = row.querySelector('.quantity-input')?.closest('td');
    const table = row.closest('table');
    const headers = table?.querySelectorAll('thead th');
    if (!headers || headers.length < 5) { console.error("handleUnitTypeChange: Could not find table headers."); return; }
    const sqFeetHeader1 = headers[2];
    const sqFeetHeader2 = headers[3];
    const qtyHeader = headers[4];
    const rateInput = row.querySelector('.rate-input');
    if (!sqFeetDimensionCell || !sqFeetUnitCell || !qtyInputDirectParentCell || !sqFeetHeader1 || !sqFeetHeader2 || !qtyHeader) { console.error("handleUnitTypeChange: Could not find all necessary cells/headers for unit type toggle.", {sqFeetDimensionCell, sqFeetUnitCell, qtyInputDirectParentCell, sqFeetHeader1, sqFeetHeader2, qtyHeader}); return; }
    if (unitType === 'Sq Feet') {
        console.log("Switching to Sq Feet view");
        sqFeetDimensionCell.style.display = ''; sqFeetUnitCell.style.display = ''; qtyInputDirectParentCell.style.display = 'none';
        sqFeetHeader1.classList.remove('hidden-col'); sqFeetHeader2.classList.remove('hidden-col'); qtyHeader.classList.add('hidden-col');
        if (rateInput) rateInput.placeholder = 'Rate/SqFt';
        const quantityInputField = qtyInputDirectParentCell.querySelector('.quantity-input'); if (quantityInputField) quantityInputField.value = '';
    } else { // 'Qty' selected
        console.log("Switching to Qty view");
        sqFeetDimensionCell.style.display = 'none'; sqFeetUnitCell.style.display = 'none'; qtyInputDirectParentCell.style.display = '';
        sqFeetHeader1.classList.add('hidden-col'); sqFeetHeader2.classList.add('hidden-col'); qtyHeader.classList.remove('hidden-col');
        if (rateInput) rateInput.placeholder = 'Rate/Unit';
        const widthInput = sqFeetDimensionCell.querySelector('.width-input'); const heightInput = sqFeetDimensionCell.querySelector('.height-input');
        if (widthInput) widthInput.value = ''; if (heightInput) heightInput.value = '';
    }
    updateItemAmount(row); // Amount recalculated here
}
function addItemRowEventListeners(row) {
    // ... (Keep the function exactly as it was in the file you sent) ...
    const productNameInput = row.querySelector('.product-name'); // <<< Get product name input
    const unitTypeSelect = row.querySelector('.unit-type-select');
    const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
    const widthInput = row.querySelector('.width-input');
    const heightInput = row.querySelector('.height-input');
    const quantityInput = row.querySelector('.quantity-input');
    const rateInput = row.querySelector('.rate-input');
    const deleteBtn = row.querySelector('.delete-item-btn');

    // --- Product Name Input Listener (Using Delegation Now) ---
    // if (productNameInput) {
    //     productNameInput.addEventListener('input', handleProductSearchInput); // <<< Attach listener directly (will be replaced by delegation)
    // }

    // Existing listeners for calculation updates
    const recalcInputs = [dimensionUnitSelect, widthInput, heightInput, quantityInput, rateInput];
    recalcInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', () => updateItemAmount(row));
            input.addEventListener('change', () => updateItemAmount(row));
            input.addEventListener('blur', () => updateItemAmount(row)); // Recalculate on blur too
        }
    });
    if (unitTypeSelect) { unitTypeSelect.addEventListener('change', handleUnitTypeChange); }
    if (deleteBtn) { deleteBtn.addEventListener('click', () => { row.remove(); hideProductSuggestions(); updateTotalAmount(); updateFullCalculationPreview(); }); }

    // Set initial state based on Unit Type
    if (unitTypeSelect) { handleUnitTypeChange({ target: unitTypeSelect }); }
    else { console.warn("Unit type select not found in row for initial state setting:", row); updateFullCalculationPreview(); }
}

// --- Product Search Implementation --- <<< NEW SECTION START >>>

// Create or get the suggestion div
function getOrCreateProductSuggestionsDiv() {
    if (!productSuggestionsDiv) {
        productSuggestionsDiv = document.createElement('div');
        productSuggestionsDiv.className = 'product-suggestions-list'; // Use the new CSS class
        productSuggestionsDiv.style.display = 'none'; // Start hidden
        document.body.appendChild(productSuggestionsDiv); // Append to body for positioning freedom
    }
    return productSuggestionsDiv;
}

// Position the suggestion div below the target input
function positionProductSuggestions(inputElement) {
    const suggestionsDiv = getOrCreateProductSuggestionsDiv();
    const rect = inputElement.getBoundingClientRect();
    suggestionsDiv.style.left = `${rect.left + window.scrollX}px`;
    suggestionsDiv.style.top = `${rect.bottom + window.scrollY}px`;
    suggestionsDiv.style.width = `${rect.width}px`; // Match input width
    suggestionsDiv.style.display = 'block';
}

// Hide the product suggestion list
function hideProductSuggestions() {
    if (productSuggestionsDiv) {
        productSuggestionsDiv.style.display = 'none';
    }
    activeProductInput = null; // Reset active input tracking
}

// Handle input event on product name fields (using delegation)
function handleProductSearchInput(event) {
    const inputElement = event.target;
    if (!inputElement.matches('.product-name')) {
        return; // Ignore if not a product name input
    }
    activeProductInput = inputElement; // Track the currently focused input
    clearTimeout(productSearchDebounceTimer);
    const searchTerm = inputElement.value.trim();

    if (searchTerm.length < 1) { // Require at least 1 char
        hideProductSuggestions();
        return;
    }

    // Position the list first, then fetch
    positionProductSuggestions(inputElement);

    productSearchDebounceTimer = setTimeout(() => {
        fetchProductSuggestions(searchTerm, inputElement);
    }, 350); // Debounce time
}

// Fetch suggestions from Firestore
async function fetchProductSuggestions(searchTerm, inputElement) {
    const suggestionsDiv = getOrCreateProductSuggestionsDiv();
    suggestionsDiv.innerHTML = '<div>Loading...</div>';
    // Ensure it's still positioned correctly relative to the active input
    if (activeProductInput === inputElement) {
        positionProductSuggestions(inputElement);
    } else {
        hideProductSuggestions(); // Hide if input changed during debounce
        return;
    }

    try {
        // Query based on product_management.js structure
        const q = query(
            collection(db, "products"),
            orderBy("printName"), // Use 'printName' for sorting/searching
            where("printName", ">=", searchTerm),
            where("printName", "<=", searchTerm + '\uf8ff'),
            limit(10)
        );
        const querySnapshot = await getDocs(q);
        suggestionsDiv.innerHTML = ''; // Clear loading/previous results

        if (querySnapshot.empty) {
            suggestionsDiv.innerHTML = '<div class="no-suggestions">No matching products found.</div>';
        } else {
            querySnapshot.forEach((docSnapshot) => {
                const product = docSnapshot.data();
                const productId = docSnapshot.id; // Keep ID if needed later
                const div = document.createElement('div');
                div.textContent = product.printName || 'Unnamed Product'; // Display printName
                // Store necessary data in dataset
                div.dataset.id = productId;
                div.dataset.name = product.printName || '';
                // Store rate (price) and unit type (productUnit)
                div.dataset.rate = product.price ?? ''; // Use 'price', default to empty string if null/undefined
                div.dataset.unit = product.productUnit || 'Qty'; // Use 'productUnit', default to 'Qty'

                div.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // Prevent input blur on click
                    selectProductSuggestion(product, inputElement);
                });
                suggestionsDiv.appendChild(div);
            });
        }
         // Ensure list is visible after population
         if (activeProductInput === inputElement) {
             suggestionsDiv.style.display = 'block';
         } else {
             hideProductSuggestions(); // Hide if input changed while fetching
         }

    } catch (error) {
        console.error("Error fetching product suggestions:", error);
        if (suggestionsDiv) { // Check if div still exists
             suggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Error fetching products.</div>';
             if (activeProductInput === inputElement) {
                 suggestionsDiv.style.display = 'block';
             }
        }
    }
}

// Handle selection of a product suggestion
function selectProductSuggestion(productData, inputElement) {
    const row = inputElement.closest('.item-row');
    if (!row) {
        console.error("Could not find parent row for product selection.");
        hideProductSuggestions();
        return;
    }

    // Find elements within THIS row
    const productNameInput = row.querySelector('.product-name');
    const unitTypeSelect = row.querySelector('.unit-type-select');
    const rateInput = row.querySelector('.rate-input');

    if (!productNameInput || !unitTypeSelect || !rateInput) {
        console.error("Could not find all necessary fields in the row.");
        hideProductSuggestions();
        return;
    }

    // 1. Fill Product Name
    productNameInput.value = productData.printName || '';

    // 2. Fill Rate
    rateInput.value = productData.price ?? ''; // Use 'price' from Firestore

    // 3. Fill Unit Type
    const targetUnit = productData.productUnit || 'Qty'; // Default to 'Qty' if missing
    let unitFound = false;
    // Check if the unit type exists as an option
    for (let option of unitTypeSelect.options) {
        if (option.value === targetUnit) {
            unitTypeSelect.value = targetUnit;
            unitFound = true;
            break;
        }
    }
    if (!unitFound) {
        console.warn(`Product unit "${targetUnit}" not found in dropdown. Defaulting to 'Qty'.`);
        unitTypeSelect.value = 'Qty'; // Fallback if unit doesn't match options
    }

    // 4. Hide suggestions
    hideProductSuggestions();

    // 5. Trigger updates
    // Create a synthetic event for handleUnitTypeChange
    const changeEvent = new Event('change', { bubbles: true });
    unitTypeSelect.dispatchEvent(changeEvent); // This calls handleUnitTypeChange -> updateItemAmount

    // Optional: Focus the next input (e.g., Qty or Width)
    let nextInput = null;
    if (unitTypeSelect.value === 'Sq Feet') {
        nextInput = row.querySelector('.width-input');
    } else {
        nextInput = row.querySelector('.quantity-input');
    }
    if (nextInput) {
        nextInput.focus();
        nextInput.select(); // Select text if needed
    }
}

// --- <<< NEW SECTION END >>> ---


// --- DOMContentLoaded Listener --- (MODIFIED FOR PRODUCT SEARCH)
document.addEventListener('DOMContentLoaded', () => {
    console.log("new_po.js v7: DOM loaded.");
    if (!window.db || !window.query || !window.orderBy || !window.limit || !window.getDocs || !window.Timestamp) { console.error("new_po.js: Firestore (window.db) or essential functions not available!"); alert("Error initializing page. Core functionalities missing."); if(poForm) poForm.style.opacity = '0.5'; if(savePOBtn) savePOBtn.disabled = true; return; }
    console.log("new_po.js: Firestore connection and functions confirmed.");
    const urlParamsInit = new URLSearchParams(window.location.search);
    const isEditingInit = urlParamsInit.has('editPOId');
    if (!isEditingInit && poOrderDateInput && !poOrderDateInput.value) { try { poOrderDateInput.value = new Date().toISOString().split('T')[0]; } catch (e) { console.error("Error setting default date:", e); } }

    // Add Item Button Listener
    if (addItemBtn && itemRowTemplate && poItemsTableBody) {
        addItemBtn.addEventListener('click', () => {
            const templateContent = itemRowTemplate.content.cloneNode(true);
            poItemsTableBody.appendChild(templateContent);
            const appendedRow = poItemsTableBody.lastElementChild;
            if (appendedRow?.matches('.item-row')) {
                addItemRowEventListeners(appendedRow); // Add standard listeners
                const firstInput = appendedRow.querySelector('.product-name');
                if(firstInput) firstInput.focus();
            } else { console.error("Failed to get appended row or it's not an item-row"); }
        });
        // Add initial row if not editing
        if (!isEditingInit && poItemsTableBody.children.length === 0) {
            addItemBtn.click();
        }
    } else { console.error("Add Item button, Item Row template or Table Body not found!"); }

    // Supplier Search Listener
    if (supplierSearchInput && supplierSuggestionsDiv && selectedSupplierIdInput && selectedSupplierNameInput) {
        supplierSearchInput.addEventListener('input', handleSupplierSearchInput);
        // Global click listener to hide supplier suggestions (Keep this one)
        document.addEventListener('click', (e) => {
             if (supplierSuggestionsDiv && supplierSuggestionsDiv.style.display === 'block' && !supplierSearchInput.contains(e.target) && !supplierSuggestionsDiv.contains(e.target)) {
                supplierSuggestionsDiv.style.display = 'none';
            }
            // Global click listener to hide PRODUCT suggestions <<< ADDED >>>
            if (productSuggestionsDiv && productSuggestionsDiv.style.display === 'block' && activeProductInput && !activeProductInput.contains(e.target) && !productSuggestionsDiv.contains(e.target)) {
                hideProductSuggestions();
            }
         });
    } else { console.warn("Supplier search elements not found."); }

    // Add New Supplier Button Listener
    if(addNewSupplierFromPOBtn) {
        addNewSupplierFromPOBtn.addEventListener('click', () => {
            window.open('supplier_management.html#add', '_blank');
            alert("Supplier management page opened in new tab. Add supplier there and then search here.");
        });
    }

    // --- Product Search Event Delegation <<< ADDED >>> ---
    if (poItemsTableBody) {
        poItemsTableBody.addEventListener('input', handleProductSearchInput);
        // Add focus listener to track active product input
        poItemsTableBody.addEventListener('focusin', (event) => {
             if (event.target.matches('.product-name')) {
                 activeProductInput = event.target;
             }
        });
    } else {
        console.error("Cannot add product search listener: Table body not found.");
    }


    // Form Submit Listener
    if (poForm) { poForm.addEventListener('submit', handleSavePO); }
    else { console.error("PO Form element not found!"); }

    // Load data if editing
    const editPOIdValue = urlParamsInit.get('editPOId');
    if (editPOIdValue) { loadPOForEditing(editPOIdValue); }
    else { if(poNumberInput) poNumberInput.value = ''; if (poItemsTableBody.children.length > 0) { updateFullCalculationPreview(); } }
    console.log("new_po.js v7: Basic setup and listeners added.");
});

// --- Supplier Search Implementation --- (Kept from previous version)
function handleSupplierSearchInput() {
    // ... (Keep the function exactly as it was in the file you sent) ...
     if (!supplierSearchInput || !supplierSuggestionsDiv || !selectedSupplierIdInput || !selectedSupplierNameInput) return;
     clearTimeout(supplierSearchDebounceTimer); const searchTerm = supplierSearchInput.value.trim();
     selectedSupplierIdInput.value = ''; selectedSupplierNameInput.value = '';
     if (searchTerm.length < 1) { supplierSuggestionsDiv.innerHTML = ''; supplierSuggestionsDiv.style.display = 'none'; return; }
     supplierSearchDebounceTimer = setTimeout(() => { fetchSupplierSuggestions(searchTerm); }, 350);
}
async function fetchSupplierSuggestions(searchTerm) {
    // ... (Keep the function exactly as it was in the file you sent) ...
    if (!supplierSuggestionsDiv) return;
    supplierSuggestionsDiv.innerHTML = '<div>Loading...</div>'; supplierSuggestionsDiv.style.display = 'block';
    try {
        const q = query( collection(db, "suppliers"), orderBy("name"), where("name", ">=", searchTerm), where("name", "<=", searchTerm + '\uf8ff'), limit(10) );
        const querySnapshot = await getDocs(q); supplierSuggestionsDiv.innerHTML = '';
        if (querySnapshot.empty) {
            supplierSuggestionsDiv.innerHTML = '<div class="no-suggestions">No matching suppliers found. <button type="button" id="suggestAddNewSupplier" class="button link-button" style="margin-left: 10px;">+ Add New</button></div>';
            const suggestBtn = supplierSuggestionsDiv.querySelector('#suggestAddNewSupplier');
            if (suggestBtn && addNewSupplierFromPOBtn) { suggestBtn.addEventListener('click', () => addNewSupplierFromPOBtn.click()); }
        } else {
            querySnapshot.forEach((docSnapshot) => {
                 const supplier = docSnapshot.data(); const supplierId = docSnapshot.id; const div = document.createElement('div');
                 div.textContent = `${supplier.name}${supplier.companyName ? ' (' + supplier.companyName + ')' : ''}`;
                 div.dataset.id = supplierId; div.dataset.name = supplier.name; div.style.cursor = 'pointer';
                 div.addEventListener('mousedown', (e) => {
                      e.preventDefault(); supplierSearchInput.value = supplier.name;
                      if(selectedSupplierIdInput) selectedSupplierIdInput.value = supplierId; if(selectedSupplierNameInput) selectedSupplierNameInput.value = supplier.name;
                      supplierSuggestionsDiv.style.display = 'none'; if (poOrderDateInput) poOrderDateInput.focus();
                 });
                 supplierSuggestionsDiv.appendChild(div);
            });
        }
    } catch (error) { console.error("Error fetching supplier suggestions:", error); supplierSuggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Error fetching suppliers.</div>'; }
}


// --- Save PO Implementation handleSavePO --- (Kept from previous version)
async function handleSavePO(event) {
    event.preventDefault();
    console.log("DEBUG PO Gen: handleSavePO started."); // DEBUG
    showPOError('');
    // Prerequisite checks
    if (!poForm || !selectedSupplierIdInput || !poOrderDateInput || !poItemsTableBody || !poTotalAmountSpan || !savePOBtn || !db || !addDoc || !collection || !doc || !updateDoc || !Timestamp || !serverTimestamp || !query || !orderBy || !limit || !getDocs) {
        console.error("Save PO prerequisites missing.");
        showPOError("Critical error: Cannot save PO.");
        return;
    }

    const editingPOId = editPOIdInput.value;
    const isEditing = !!editingPOId;
    let finalPoNumber = null;

    console.log("DEBUG PO Gen: Editing Mode:", isEditing); // DEBUG

    savePOBtn.disabled = true;
    if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Updating...' : 'Processing...';

    // Determine PO Number
    if (isEditing) {
        const existingValue = poNumberInput.value.trim();
        const numericValue = Number(existingValue);
        finalPoNumber = (!isNaN(numericValue)) ? numericValue : (existingValue || null); // Use existing number or entered value
        console.log("DEBUG PO Gen: Using existing PO number for edit:", finalPoNumber); // DEBUG
    } else {
        // --- Auto-generation logic for NEW PO ---
        if (savePOBtnSpan) savePOBtnSpan.textContent = 'Generating PO#...';
        console.log("DEBUG PO Gen: Starting PO number generation..."); // DEBUG
        try {
            const q = query(collection(db, "purchaseOrders"), orderBy("createdAt", "desc"), limit(1)); // Use createdAt for reliable last PO
            console.log("DEBUG PO Gen: Querying Firestore for last PO (using createdAt)..."); // DEBUG

            const querySnapshot = await getDocs(q);
            let lastPoNumber = 1000; // Default starting point

            if (!querySnapshot.empty) {
                const lastPO = querySnapshot.docs[0].data();
                console.log("DEBUG PO Gen: Last PO document found:", lastPO); // DEBUG
                const lastPoNumberStr = lastPO.poNumber;
                console.log(`DEBUG PO Gen: Found last PO Number string/value: "${lastPoNumberStr}" (Type: ${typeof lastPoNumberStr})`); // DEBUG

                if (lastPoNumberStr !== undefined && lastPoNumberStr !== null && String(lastPoNumberStr).trim() !== "") {
                    const lastNum = Number(lastPoNumberStr);
                    console.log(`DEBUG PO Gen: Attempted conversion to number: ${lastNum}`); // DEBUG

                    if (!isNaN(lastNum)) {
                         lastPoNumber = lastNum;
                    } else {
                         console.warn("DEBUG PO Gen: Last PO number is not a valid number (NaN). Falling back.");
                    }
                } else {
                     console.warn("DEBUG PO Gen: Last PO number field is missing, null, or empty. Falling back.");
                }
            } else {
                console.log("DEBUG PO Gen: No existing POs found in query result. Starting with default.");
            }

            finalPoNumber = lastPoNumber + 1; // Calculate the next number
             if (finalPoNumber < 1001) { // Ensure minimum starting number
                  console.log(`DEBUG PO Gen: Calculated number ${finalPoNumber} is less than 1001, adjusting.`);
                  finalPoNumber = 1001;
             }

            poNumberInput.value = finalPoNumber; // Update the UI input field
            console.log("DEBUG PO Gen: Generated PO Number:", finalPoNumber); // DEBUG

        } catch (error) {
            console.error("DEBUG PO Gen: Error during PO number generation:", error); // DEBUG
            showPOError("Error generating PO Number. " + error.message);
            savePOBtn.disabled = false;
            if (savePOBtnSpan) savePOBtnSpan.textContent = 'Save Purchase Order';
            return; // Stop saving if generation fails
        }
    }
    // Re-enable button temporarily before final validation and save attempt
    savePOBtn.disabled = false;
    if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Update Purchase Order' : 'Save Purchase Order';


    // Gather General Data
    const supplierId = selectedSupplierIdInput.value;
    const supplierName = selectedSupplierNameInput.value;
    const orderDateValue = poOrderDateInput.value;
    const notes = poNotesInput.value.trim();

    // Basic Validation
    if (!supplierId || !supplierName) { showPOError("Please select a supplier."); supplierSearchInput.focus(); return; }
    if (!orderDateValue) { showPOError("Please select an order date."); poOrderDateInput.focus(); return; }
    const itemRows = poItemsTableBody.querySelectorAll('.item-row');
    if (itemRows.length === 0) { showPOError("Please add at least one item."); return; }
    // Validate the final determined PO number
    if ((finalPoNumber === null || finalPoNumber === undefined || (typeof finalPoNumber === 'number' && isNaN(finalPoNumber)) ) && !isEditing) {
         showPOError("Could not determine a valid PO Number. Cannot save.");
         console.error("DEBUG PO Gen: finalPoNumber is invalid before saving:", finalPoNumber); // DEBUG
         return;
    }

    // Gather and Validate Item Data
    let itemsArray = [];
    let validationPassed = true;
    let calculatedTotalAmount = 0;
    itemRows.forEach((row, index) => {
        if (!validationPassed) return; // Stop processing if previous item failed
        const productNameInput = row.querySelector('.product-name');
        const unitTypeSelect = row.querySelector('.unit-type-select');
        const rateInput = row.querySelector('.rate-input');
        const itemAmountSpan = row.querySelector('.item-amount');
        const partyNameInput = row.querySelector('.party-name');
        const designDetailsInput = row.querySelector('.design-details');

        const productName = productNameInput?.value.trim();
        const unitType = unitTypeSelect?.value;
        const rate = parseFloat(rateInput?.value || 0);
        const itemAmount = parseFloat(itemAmountSpan?.textContent || 0); // Amount displayed

        // --- Item Validation ---
        if (!productName) { validationPassed = false; showPOError(`Item ${index + 1}: Product Name required.`); productNameInput?.focus(); return; }
        if (isNaN(rate) || rate < 0) { validationPassed = false; showPOError(`Item ${index + 1}: Valid Rate required.`); rateInput?.focus(); return; }
        if (isNaN(itemAmount)) { validationPassed = false; showPOError(`Item ${index + 1}: Amount calculation error.`); return; } // Should not happen if inputs are validated

        let itemData = {
            productName: productName,
            type: unitType,
            rate: rate,
            itemAmount: 0, // Will be recalculated/verified
            partyName: partyNameInput?.value.trim() || '',
            designDetails: designDetailsInput?.value.trim() || ''
        };
        let expectedAmount = 0;

        if (unitType === 'Sq Feet') {
            const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
            const widthInput = row.querySelector('.width-input');
            const heightInput = row.querySelector('.height-input');
            const unit = dimensionUnitSelect?.value || 'feet';
            const width = parseFloat(widthInput?.value || 0);
            const height = parseFloat(heightInput?.value || 0);

            if (isNaN(width) || width <= 0) { validationPassed = false; showPOError(`Item ${index + 1}: Valid Width required.`); widthInput?.focus(); return; }
            if (isNaN(height) || height <= 0) { validationPassed = false; showPOError(`Item ${index + 1}: Valid Height required.`); heightInput?.focus(); return; }

            const calcResult = calculateFlexDimensions(unit, width, height);

            if(parseFloat(calcResult.printSqFt) <= 0) { validationPassed = false; showPOError(`Item ${index + 1}: Calculation error (printSqFt is zero).`); widthInput?.focus(); return; }

            itemData.unit = unit;
            itemData.realWidth = width;
            itemData.realHeight = height;
            itemData.realSqFt = parseFloat(calcResult.realSqFt);
            itemData.printWidth = parseFloat(calcResult.printWidth);
            itemData.printHeight = parseFloat(calcResult.printHeight);
            itemData.printSqFt = parseFloat(calcResult.printSqFt);
            itemData.inputUnit = calcResult.inputUnit;

            expectedAmount = itemData.printSqFt * itemData.rate;

        } else { // Qty type
            const quantityInput = row.querySelector('.quantity-input');
            const quantity = parseInt(quantityInput?.value || 0);

            if (isNaN(quantity) || quantity <= 0) { validationPassed = false; showPOError(`Item ${index + 1}: Valid Quantity required.`); quantityInput?.focus(); return; }

            itemData.quantity = quantity;
            expectedAmount = itemData.quantity * itemData.rate;
        }

        // Verify calculated amount against displayed amount (within tolerance)
        if (Math.abs(itemAmount - expectedAmount) > 0.01) {
            console.warn(`Item ${index + 1} amount mismatch on save: displayed=${itemAmount.toFixed(2)}, calculated=${expectedAmount.toFixed(2)}. Using calculated.`);
            itemData.itemAmount = parseFloat(expectedAmount.toFixed(2));
        } else {
            itemData.itemAmount = parseFloat(itemAmount.toFixed(2));
        }

        itemsArray.push(itemData);
        calculatedTotalAmount += itemData.itemAmount;
    }); // End itemRows.forEach

    if (!validationPassed) {
        console.error("Validation failed during item processing.");
        savePOBtn.disabled = false;
        if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Update Purchase Order' : 'Save Purchase Order';
        return; // Stop saving
    }

    // Final button disable before Firestore operation
    savePOBtn.disabled = true;
    if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Updating...' : 'Saving...';

    // Create Firestore Data Object
    const poData = {
        supplierId: supplierId,
        supplierName: supplierName,
        poNumber: finalPoNumber,
        orderDate: Timestamp.fromDate(new Date(orderDateValue + 'T00:00:00')),
        items: itemsArray,
        totalAmount: parseFloat(calculatedTotalAmount.toFixed(2)),
        notes: notes,
        updatedAt: serverTimestamp()
    };

    if (!isEditing) {
        poData.createdAt = serverTimestamp();
        poData.status = 'New';
    } else {
        poData.status = editingPOData?.status || 'New';
    }

    console.log("DEBUG PO Gen: Final PO Data being sent to Firestore:", poData); // DEBUG

    // Save to Firestore
    try {
        let successMessage = '';
        if (isEditing) {
            const poDocRef = doc(db, "purchaseOrders", editingPOId);
            await updateDoc(poDocRef, poData);
            successMessage = "Purchase Order updated successfully!";
            console.log(successMessage, "ID:", editingPOId);
        } else {
             if (typeof poData.poNumber !== 'number' || isNaN(poData.poNumber) || poData.poNumber <= 0) {
                  throw new Error(`Invalid PO number detected just before save: ${poData.poNumber}`);
             }
            const poDocRef = await addDoc(collection(db, "purchaseOrders"), poData);
            successMessage = `Purchase Order ${poData.poNumber} created successfully!`;
            console.log(successMessage, "ID:", poDocRef.id);
        }
        alert(successMessage);
        window.location.href = 'supplier_management.html'; // Redirect on success

    } catch (error) {
        console.error("Error saving PO to Firestore:", error); // DEBUG
        showPOError("Error saving Purchase Order: " + error.message);
        savePOBtn.disabled = false;
        if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Update Purchase Order' : 'Save Purchase Order';
    }
} // End handleSavePO


// --- Load PO For Editing Implementation --- (Kept from previous version)
async function loadPOForEditing(poId) {
    // ... (Keep the function exactly as it was in the file you sent) ...
    console.log(`Loading PO ${poId} for editing...`);
    if (!db || !doc || !getDoc || !poForm) { showPOError("Cannot load PO: Init error."); return; }
    if (poPageTitle) poPageTitle.innerHTML = `<i class="fas fa-edit"></i> Edit Purchase Order`;
    if (poBreadcrumbAction) poBreadcrumbAction.textContent = `Edit PO #${poId}`;
    if (savePOBtnSpan) savePOBtnSpan.textContent = 'Update Purchase Order';
    editPOIdInput.value = poId;
    if (poNumberInput) poNumberInput.readOnly = false;
    try {
        const poDocRef = doc(db, "purchaseOrders", poId);
        const poDocSnap = await getDoc(poDocRef);
        if (poDocSnap.exists()) {
            editingPOData = poDocSnap.data(); console.log("PO Data loaded:", editingPOData);
            if(supplierSearchInput && editingPOData.supplierName) supplierSearchInput.value = editingPOData.supplierName;
            if(selectedSupplierIdInput && editingPOData.supplierId) selectedSupplierIdInput.value = editingPOData.supplierId;
            if(selectedSupplierNameInput && editingPOData.supplierName) selectedSupplierNameInput.value = editingPOData.supplierName;
            if(poNumberInput && editingPOData.poNumber !== undefined) { poNumberInput.value = editingPOData.poNumber; } else if (poNumberInput) { poNumberInput.value = ''; }
            if(poOrderDateInput && editingPOData.orderDate?.toDate) { poOrderDateInput.value = editingPOData.orderDate.toDate().toISOString().split('T')[0]; } else if (poOrderDateInput) { poOrderDateInput.value = ''; }
            if(poNotesInput && editingPOData.notes) poNotesInput.value = editingPOData.notes;
            poItemsTableBody.innerHTML = '';
            if (editingPOData.items?.length > 0) {
                editingPOData.items.forEach(item => {
                    if (!itemRowTemplate) return;
                    const templateContent = itemRowTemplate.content.cloneNode(true);
                    poItemsTableBody.appendChild(templateContent);
                    const newRow = poItemsTableBody.lastElementChild;
                    if (newRow?.matches('.item-row')) {
                        const productNameInput = newRow.querySelector('.product-name'); if(productNameInput) productNameInput.value = item.productName || '';
                        const unitTypeSelect = newRow.querySelector('.unit-type-select'); if(unitTypeSelect) unitTypeSelect.value = item.type || 'Qty';
                        const rateInput = newRow.querySelector('.rate-input'); if(rateInput) rateInput.value = item.rate ?? '';
                        const partyNameInput = newRow.querySelector('.party-name'); if(partyNameInput) partyNameInput.value = item.partyName || '';
                        const designDetailsInput = newRow.querySelector('.design-details'); if(designDetailsInput) designDetailsInput.value = item.designDetails || '';
                        if (item.type === 'Sq Feet') {
                           const dimensionUnitSelect = newRow.querySelector('.dimension-unit-select'); if(dimensionUnitSelect) dimensionUnitSelect.value = item.unit || 'feet';
                           const widthInput = newRow.querySelector('.width-input'); if(widthInput) widthInput.value = item.realWidth ?? item.width ?? ''; // Use realWidth if available
                           const heightInput = newRow.querySelector('.height-input'); if(heightInput) heightInput.value = item.realHeight ?? item.height ?? ''; // Use realHeight if available
                        } else {
                           const quantityInput = newRow.querySelector('.quantity-input'); if(quantityInput) quantityInput.value = item.quantity ?? '';
                        }
                        addItemRowEventListeners(newRow); // Add listeners AFTER populating
                        // updateItemAmount(newRow); // updateItemAmount is called by handleUnitTypeChange inside addItemRowEventListeners
                    }
                });
            } else { if (addItemBtn) addItemBtn.click(); } // Add a blank row if no items exist
            updateTotalAmount(); updateFullCalculationPreview();
        } else { console.error("No such PO document!"); showPOError("Error: Could not find PO to edit."); if(savePOBtn) savePOBtn.disabled = true; }
    } catch (error) { console.error("Error loading PO for editing:", error); showPOError("Error loading PO data: " + error.message); if(savePOBtn) savePOBtn.disabled = true; }
}

// Helper function showPOError (Kept from previous version)
function showPOError(message) {
    // ... (Keep the function exactly as it was in the file you sent) ...
    if (poErrorMsg) {
        poErrorMsg.textContent = message;
        poErrorMsg.style.display = message ? 'block' : 'none';
    } else { if(message) alert(message); }
}

console.log("new_po.js v7 (Product Suggest) loaded and ready.");