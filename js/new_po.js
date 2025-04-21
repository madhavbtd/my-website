// js/new_po.js - v5 (Fix Qty/SqFt Toggle, includes Auto PO#, Item Details, Enhanced Preview)

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

// --- Global State ---
let supplierSearchDebounceTimer;
let editingPOData = null;

// --- Utility Functions ---

// Local modified copy of calculateFlexDimensions
function calculateFlexDimensions(unit, width, height) {
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

// Function to update total amount
function updateTotalAmount() {
    let total = 0;
    poItemsTableBody.querySelectorAll('.item-row').forEach(row => {
        const amountSpan = row.querySelector('.item-amount');
        total += parseFloat(amountSpan?.textContent || 0);
    });
    if (poTotalAmountSpan) { poTotalAmountSpan.textContent = total.toFixed(2); }
}

// Function updateFullCalculationPreview
function updateFullCalculationPreview() {
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

// Function updateItemAmount
function updateItemAmount(row) {
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
    updateFullCalculationPreview();
}

// --- **** FIXED handleUnitTypeChange Function **** ---
function handleUnitTypeChange(event) {
    const row = event.target.closest('.item-row');
    if (!row) {
        console.error("handleUnitTypeChange: Could not find parent row.");
        return;
    }

    const unitType = event.target.value;
    console.log(`Unit type changed to: ${unitType} for row:`, row);

    // Use querySelectorAll to find all potentially relevant cells in the row
    const cells = row.querySelectorAll('td');
    // Use more specific selectors if possible, otherwise rely on index (less robust)
    // Assuming the structure from new_po.html (v4):
    // 0: Prod Name | 1: Unit Type | 2: Dimensions | 3: Dim Unit | 4: Qty | 5: Rate | 6: Party | 7: Design | 8: Amount | 9: Action
    const sqFeetDimensionCell = cells.length > 2 ? cells[2] : null; // Contains WxH inputs
    const sqFeetUnitCell = cells.length > 3 ? cells[3] : null;     // Contains Unit select (ft/in)
    const qtyInputCell = row.querySelector('td:nth-child(5)');     // Qty TD (More reliable selector needed if columns change)
                                                                   // Let's try getting the specific TD containing the .quantity-input
    const qtyInputDirectParentCell = row.querySelector('.quantity-input')?.closest('td');


    // Find corresponding headers
    const table = row.closest('table');
    const headers = table?.querySelectorAll('thead th'); // Find headers within the same table

    if (!headers || headers.length < 5) { // Need at least 5 headers for basic Qty/SqFt toggle
        console.error("handleUnitTypeChange: Could not find table headers.");
        return;
    }
    // Indices based on HTML v4 thead
    const sqFeetHeader1 = headers[2]; // Dimensions Header
    const sqFeetHeader2 = headers[3]; // Unit Header
    const qtyHeader = headers[4];     // Qty Header

    const rateInput = row.querySelector('.rate-input');

    // Check if elements were found
    if (!sqFeetDimensionCell || !sqFeetUnitCell || !qtyInputDirectParentCell || !sqFeetHeader1 || !sqFeetHeader2 || !qtyHeader) {
        console.error("handleUnitTypeChange: Could not find all necessary cells/headers for unit type toggle. Check selectors/HTML structure.",
                      {sqFeetDimensionCell, sqFeetUnitCell, qtyInputDirectParentCell, sqFeetHeader1, sqFeetHeader2, qtyHeader});
        return;
    }

    if (unitType === 'Sq Feet') {
        console.log("Switching to Sq Feet view");
        // Show Sq Feet Cells
        sqFeetDimensionCell.style.display = ''; // Use default display (usually 'table-cell')
        sqFeetUnitCell.style.display = '';
        // Hide Qty Cell
        qtyInputDirectParentCell.style.display = 'none';

        // Show/Hide Headers
        sqFeetHeader1.classList.remove('hidden-col');
        sqFeetHeader2.classList.remove('hidden-col');
        qtyHeader.classList.add('hidden-col');

        // Update Rate Placeholder
        if (rateInput) rateInput.placeholder = 'Rate/SqFt';

        // Clear Qty Input
        const quantityInputField = qtyInputDirectParentCell.querySelector('.quantity-input');
        if (quantityInputField) quantityInputField.value = '';

    } else { // 'Qty' selected
        console.log("Switching to Qty view");
        // Hide Sq Feet Cells
        sqFeetDimensionCell.style.display = 'none';
        sqFeetUnitCell.style.display = 'none';
        // Show Qty Cell
        qtyInputDirectParentCell.style.display = '';

        // Show/Hide Headers
        sqFeetHeader1.classList.add('hidden-col');
        sqFeetHeader2.classList.add('hidden-col');
        qtyHeader.classList.remove('hidden-col');

        // Update Rate Placeholder
        if (rateInput) rateInput.placeholder = 'Rate/Unit';

        // Clear Dimension Inputs
        const widthInput = sqFeetDimensionCell.querySelector('.width-input');
        const heightInput = sqFeetDimensionCell.querySelector('.height-input');
        if (widthInput) widthInput.value = '';
        if (heightInput) heightInput.value = '';
    }

    // Update amount and preview (should happen regardless of type change)
    updateItemAmount(row);
}
// --- **** END FIXED Function **** ---


// --- **** FIXED addItemRowEventListeners Function **** ---
function addItemRowEventListeners(row) {
    const unitTypeSelect = row.querySelector('.unit-type-select');
    const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
    const widthInput = row.querySelector('.width-input');
    const heightInput = row.querySelector('.height-input');
    const quantityInput = row.querySelector('.quantity-input'); // Get the input itself
    const rateInput = row.querySelector('.rate-input');
    const deleteBtn = row.querySelector('.delete-item-btn');

    // Inputs that trigger recalculation
    const recalcInputs = [dimensionUnitSelect, widthInput, heightInput, quantityInput, rateInput];
    recalcInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', () => updateItemAmount(row));
            input.addEventListener('change', () => updateItemAmount(row));
            input.addEventListener('blur', () => updateItemAmount(row));
        }
    });

    // Unit Type Select - special handling
    if (unitTypeSelect) {
        unitTypeSelect.addEventListener('change', handleUnitTypeChange); // Use the FIXED handler
    }

    // Delete button listener
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            row.remove();
            updateTotalAmount();
            updateFullCalculationPreview();
        });
    }

    // Set initial state for the row *after* attaching listeners
    // This ensures the correct fields are visible when a row is added or loaded
    if (unitTypeSelect) {
       handleUnitTypeChange({ target: unitTypeSelect });
    } else {
        // Fallback if select not found
        console.warn("Unit type select not found in row for initial state setting:", row);
        updateFullCalculationPreview(); // Still update preview
    }
}
// --- **** END FIXED Function **** ---


// --- Initialization on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("new_po.js v5: DOM loaded.");
    // Ensure dependencies are available
    if (!window.db || !window.query || !window.orderBy || !window.limit || !window.getDocs || !window.Timestamp) {
        console.error("new_po.js: Firestore (window.db) or essential functions not available!");
        alert("Error initializing page. Core functionalities missing.");
        if(poForm) poForm.style.opacity = '0.5'; if(savePOBtn) savePOBtn.disabled = true;
        return;
    }
    console.log("new_po.js: Firestore connection and functions confirmed.");

    // Set default order date only if creating new PO and date is empty
    const urlParamsInit = new URLSearchParams(window.location.search);
    const isEditingInit = urlParamsInit.has('editPOId');
    if (!isEditingInit && poOrderDateInput && !poOrderDateInput.value) {
       try { poOrderDateInput.value = new Date().toISOString().split('T')[0]; }
       catch (e) { console.error("Error setting default date:", e); }
    }

    // Add Item Button Logic
    if (addItemBtn && itemRowTemplate && poItemsTableBody) {
        addItemBtn.addEventListener('click', () => {
             const templateContent = itemRowTemplate.content.cloneNode(true);
             poItemsTableBody.appendChild(templateContent);
             const appendedRow = poItemsTableBody.lastElementChild;
             if (appendedRow?.matches('.item-row')) {
                 // Add listeners which will also call handleUnitTypeChange for initial state
                 addItemRowEventListeners(appendedRow);
                 // Focus the first input
                 const firstInput = appendedRow.querySelector('.product-name');
                 if(firstInput) firstInput.focus();
             } else { console.error("Failed to get appended row or it's not an item-row"); }
             // Preview is updated inside addItemRowEventListeners -> handleUnitTypeChange -> updateItemAmount
        });
        // Add one row initially only if creating new PO
        if (!isEditingInit && poItemsTableBody.children.length === 0) {
            addItemBtn.click();
        }
    } else { console.error("Add Item button, Item Row template or Table Body not found!"); }

    // Supplier Auto Suggest Logic
    if (supplierSearchInput && supplierSuggestionsDiv && selectedSupplierIdInput && selectedSupplierNameInput) {
        supplierSearchInput.addEventListener('input', handleSupplierSearchInput);
         document.addEventListener('click', (e) => {
              if (supplierSuggestionsDiv && !supplierSearchInput.contains(e.target) && !supplierSuggestionsDiv.contains(e.target)) {
                  supplierSuggestionsDiv.style.display = 'none';
              }
         });
    } else { console.warn("Supplier search elements not found."); }

    // Add New Supplier Button Link
     if(addNewSupplierFromPOBtn) {
         addNewSupplierFromPOBtn.addEventListener('click', () => {
             window.open('supplier_management.html#add', '_blank');
             alert("Supplier management page opened in new tab. Add supplier there and then search here.");
         });
     }

    // Form Submission Logic
    if (poForm) {
        poForm.addEventListener('submit', handleSavePO);
    } else { console.error("PO Form element not found!"); }

    // Load PO Data if Editing
    const editPOIdValue = urlParamsInit.get('editPOId');
    if (editPOIdValue) {
        loadPOForEditing(editPOIdValue); // This function now correctly sets initial states and updates preview
    } else {
        // Ensure PO number is clear and preview is updated for new PO
        if(poNumberInput) poNumberInput.value = '';
        if (poItemsTableBody.children.length > 0) { // Only update if rows exist (e.g., if first row added automatically)
             updateFullCalculationPreview();
        }
    }
    console.log("new_po.js: Basic setup and listeners added.");
}); // End DOMContentLoaded


// --- Supplier Search Implementation (Keep unchanged from v4 response) ---
function handleSupplierSearchInput() {
     if (!supplierSearchInput || !supplierSuggestionsDiv || !selectedSupplierIdInput || !selectedSupplierNameInput) return;
     clearTimeout(supplierSearchDebounceTimer); const searchTerm = supplierSearchInput.value.trim();
     selectedSupplierIdInput.value = ''; selectedSupplierNameInput.value = '';
     if (searchTerm.length < 1) { supplierSuggestionsDiv.innerHTML = ''; supplierSuggestionsDiv.style.display = 'none'; return; }
     supplierSearchDebounceTimer = setTimeout(() => { fetchSupplierSuggestions(searchTerm); }, 350);
}
async function fetchSupplierSuggestions(searchTerm) {
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


// --- Save PO Implementation handleSavePO (Keep unchanged from v4 response) ---
async function handleSavePO(event) {
    event.preventDefault(); console.log("Attempting to save PO..."); showPOError('');
    // ... (Prerequisite checks - same as v4) ...
    if (!poForm || !selectedSupplierIdInput || !poOrderDateInput || !poItemsTableBody || !poTotalAmountSpan || !savePOBtn || !db || !addDoc || !collection || !doc || !updateDoc || !Timestamp || !serverTimestamp || !query || !orderBy || !limit || !getDocs) { console.error("Save PO prerequisites missing."); showPOError("Critical error: Cannot save PO."); return; }
    const editingPOId = editPOIdInput.value; const isEditing = !!editingPOId; let finalPoNumber = null;
    savePOBtn.disabled = true; if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Updating...' : 'Processing...';
    // Determine PO Number (same as v4)
    if (isEditing) { const existingValue = poNumberInput.value.trim(); const numericValue = Number(existingValue); finalPoNumber = (!isNaN(numericValue)) ? numericValue : (existingValue || null); }
    else { /* ... (v4 auto-generation code) ... */ if(savePOBtnSpan) savePOBtnSpan.textContent = 'Generating PO#...'; try { const q = query(collection(db, "purchaseOrders"), orderBy("poNumber", "desc"), limit(1)); const querySnapshot = await getDocs(q); let lastPoNumber = 1000; if (!querySnapshot.empty) { const lastPO = querySnapshot.docs[0].data(); const lastNum = Number(lastPO.poNumber); if (!isNaN(lastNum) && lastNum >= 1000) { lastPoNumber = lastNum; } else { console.warn("Last PO invalid.", lastPO.poNumber); } } else { console.log("No existing POs found."); } finalPoNumber = lastPoNumber + 1; poNumberInput.value = finalPoNumber; console.log("Generated PO Number:", finalPoNumber); } catch (error) { console.error("Error generating PO number:", error); showPOError("Error generating PO Number. " + error.message); savePOBtn.disabled = false; if (savePOBtnSpan) savePOBtnSpan.textContent = 'Save Purchase Order'; return; } }
    savePOBtn.disabled = false; if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Update Purchase Order' : 'Save Purchase Order';
    // Gather General Data (same as v4)
    const supplierId = selectedSupplierIdInput.value; const supplierName = selectedSupplierNameInput.value; const orderDateValue = poOrderDateInput.value; const notes = poNotesInput.value.trim();
    // Basic Validation (same as v4)
    if (!supplierId || !supplierName) { showPOError("Please select a supplier."); supplierSearchInput.focus(); return; } if (!orderDateValue) { showPOError("Please select an order date."); poOrderDateInput.focus(); return; } const itemRows = poItemsTableBody.querySelectorAll('.item-row'); if (itemRows.length === 0) { showPOError("Please add at least one item."); return; } if (finalPoNumber === null && !isEditing) { showPOError("PO Number generation failed."); return;}
    // Gather and Validate Item Data (same as v4 - includes Party/Design)
    let itemsArray = []; let validationPassed = true; let calculatedTotalAmount = 0;
    itemRows.forEach((row, index) => { /* ... (Keep the v4 loop code that gathers all item data including party/design and validates) ... */ if (!validationPassed) return; const productNameInput = row.querySelector('.product-name'); const unitTypeSelect = row.querySelector('.unit-type-select'); const rateInput = row.querySelector('.rate-input'); const itemAmountSpan = row.querySelector('.item-amount'); const partyNameInput = row.querySelector('.party-name'); const designDetailsInput = row.querySelector('.design-details'); const productName = productNameInput?.value.trim(); const unitType = unitTypeSelect?.value; const rate = parseFloat(rateInput?.value || 0); const itemAmount = parseFloat(itemAmountSpan?.textContent || 0);
    if (!productName) { validationPassed = false; showPOError(`Item ${index + 1}: Product Name required.`); productNameInput?.focus(); return; } if (isNaN(rate) || rate < 0) { validationPassed = false; showPOError(`Item ${index + 1}: Valid Rate required.`); rateInput?.focus(); return; } if (isNaN(itemAmount)) { validationPassed = false; showPOError(`Item ${index + 1}: Amount calculation error.`); return; }
    let itemData = { productName: productName, type: unitType, rate: rate, itemAmount: 0, partyName: partyNameInput?.value.trim() || '', designDetails: designDetailsInput?.value.trim() || '' }; let expectedAmount = 0;
    if (unitType === 'Sq Feet') { const dimensionUnitSelect = row.querySelector('.dimension-unit-select'); const widthInput = row.querySelector('.width-input'); const heightInput = row.querySelector('.height-input'); const unit = dimensionUnitSelect?.value || 'feet'; const width = parseFloat(widthInput?.value || 0); const height = parseFloat(heightInput?.value || 0); if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0) { validationPassed = false; showPOError(`Item ${index + 1}: Valid Width & Height required.`); widthInput?.focus(); return; } const calcResult = calculateFlexDimensions(unit, width, height); if(parseFloat(calcResult.printSqFt) <= 0) { validationPassed = false; showPOError(`Item ${index + 1}: Calculation error.`); widthInput?.focus(); return; } itemData.unit = unit; itemData.realWidth = width; itemData.realHeight = height; itemData.realSqFt = parseFloat(calcResult.realSqFt); itemData.printWidth = parseFloat(calcResult.printWidth); itemData.printHeight = parseFloat(calcResult.printHeight); itemData.printSqFt = parseFloat(calcResult.printSqFt); expectedAmount = itemData.printSqFt * itemData.rate; }
    else { const quantityInput = row.querySelector('.quantity-input'); const quantity = parseInt(quantityInput?.value || 0); if (isNaN(quantity) || quantity <= 0) { validationPassed = false; showPOError(`Item ${index + 1}: Valid Quantity required.`); quantityInput?.focus(); return; } itemData.quantity = quantity; expectedAmount = itemData.quantity * itemData.rate; }
    if (Math.abs(itemAmount - expectedAmount) > 0.01) { console.warn(`Item ${index + 1} amount mismatch: disp=${itemAmount.toFixed(2)}, calc=${expectedAmount.toFixed(2)}.`); itemData.itemAmount = parseFloat(expectedAmount.toFixed(2)); } else { itemData.itemAmount = parseFloat(itemAmount.toFixed(2)); }
    itemsArray.push(itemData); calculatedTotalAmount += itemData.itemAmount; });
    if (!validationPassed) { console.error("Validation errors."); return; }
    savePOBtn.disabled = true; if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Updating...' : 'Saving...';
    // Create Firestore Data Object (same as v4)
    const poData = { supplierId: supplierId, supplierName: supplierName, poNumber: finalPoNumber, orderDate: Timestamp.fromDate(new Date(orderDateValue + 'T00:00:00')), items: itemsArray, totalAmount: parseFloat(calculatedTotalAmount.toFixed(2)), notes: notes, updatedAt: serverTimestamp() };
    if (!isEditing) { poData.createdAt = serverTimestamp(); poData.status = 'New'; } else { poData.status = editingPOData?.status || 'New'; }
    console.log("Final PO Data:", poData);
    // Save to Firestore (same as v4)
    try { let successMessage = ''; if (isEditing) { const poDocRef = doc(db, "purchaseOrders", editingPOId); await updateDoc(poDocRef, poData); successMessage = "PO updated!"; console.log(successMessage, "ID:", editingPOId);} else { if (typeof poData.poNumber !== 'number' || isNaN(poData.poNumber)) { throw new Error("PO number invalid."); } const poDocRef = await addDoc(collection(db, "purchaseOrders"), poData); successMessage = "PO saved!"; console.log(successMessage, "ID:", poDocRef.id); } alert(successMessage); window.location.href = 'supplier_management.html'; }
    catch (error) { console.error("Error saving PO:", error); showPOError("Error saving: " + error.message); savePOBtn.disabled = false; if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Update PO' : 'Save PO'; }
}


// --- **** FIXED loadPOForEditing Function **** ---
async function loadPOForEditing(poId) {
    console.log(`Loading PO ${poId} for editing...`);
    if (!db || !doc || !getDoc || !poForm) { showPOError("Cannot load PO: Init error."); return; }

    // Update UI text
    if (poPageTitle) poPageTitle.innerHTML = `<i class="fas fa-edit"></i> Edit Purchase Order`;
    if (poBreadcrumbAction) poBreadcrumbAction.textContent = `Edit PO #${poId}`;
    if (savePOBtnSpan) savePOBtnSpan.textContent = 'Update Purchase Order';
    editPOIdInput.value = poId;
    if (poNumberInput) poNumberInput.readOnly = false; // Allow editing PO number

    try {
        const poDocRef = doc(db, "purchaseOrders", poId);
        const poDocSnap = await getDoc(poDocRef);
        if (poDocSnap.exists()) {
            editingPOData = poDocSnap.data();
            console.log("PO Data loaded:", editingPOData);

            // Populate top-level fields
            if(supplierSearchInput && editingPOData.supplierName) supplierSearchInput.value = editingPOData.supplierName;
            if(selectedSupplierIdInput && editingPOData.supplierId) selectedSupplierIdInput.value = editingPOData.supplierId;
            if(selectedSupplierNameInput && editingPOData.supplierName) selectedSupplierNameInput.value = editingPOData.supplierName;
            if(poNumberInput && editingPOData.poNumber !== undefined) { poNumberInput.value = editingPOData.poNumber; } else if (poNumberInput) { poNumberInput.value = ''; }
            if(poOrderDateInput && editingPOData.orderDate?.toDate) { poOrderDateInput.value = editingPOData.orderDate.toDate().toISOString().split('T')[0]; } else if (poOrderDateInput) { poOrderDateInput.value = ''; }
            if(poNotesInput && editingPOData.notes) poNotesInput.value = editingPOData.notes;

            // Populate items table
            poItemsTableBody.innerHTML = ''; // Clear any potential default rows first
            if (editingPOData.items?.length > 0) {
                editingPOData.items.forEach(item => {
                    if (!itemRowTemplate) return;
                    const templateContent = itemRowTemplate.content.cloneNode(true);
                    poItemsTableBody.appendChild(templateContent);
                    const newRow = poItemsTableBody.lastElementChild;

                    if (newRow?.matches('.item-row')) {
                        // Populate fields
                        const productNameInput = newRow.querySelector('.product-name'); if(productNameInput) productNameInput.value = item.productName || '';
                        const unitTypeSelect = newRow.querySelector('.unit-type-select'); if(unitTypeSelect) unitTypeSelect.value = item.type || 'Qty'; // Set value FIRST
                        const rateInput = newRow.querySelector('.rate-input'); if(rateInput) rateInput.value = item.rate ?? '';
                        const partyNameInput = newRow.querySelector('.party-name'); if(partyNameInput) partyNameInput.value = item.partyName || '';
                        const designDetailsInput = newRow.querySelector('.design-details'); if(designDetailsInput) designDetailsInput.value = item.designDetails || '';

                        // Populate type-specific fields *before* calling addItemRowEventListeners
                        if (item.type === 'Sq Feet') {
                           const dimensionUnitSelect = newRow.querySelector('.dimension-unit-select'); if(dimensionUnitSelect) dimensionUnitSelect.value = item.unit || 'feet';
                           const widthInput = newRow.querySelector('.width-input'); if(widthInput) widthInput.value = item.realWidth ?? '';
                           const heightInput = newRow.querySelector('.height-input'); if(heightInput) heightInput.value = item.realHeight ?? '';
                        } else {
                           const quantityInput = newRow.querySelector('.quantity-input'); if(quantityInput) quantityInput.value = item.quantity ?? ''; // Target the INPUT
                        }

                        // Attach listeners and set initial visibility state
                        // This call is crucial and must happen AFTER values are set
                        addItemRowEventListeners(newRow);

                        // Explicitly update amount for the loaded row as listeners might not fire initially
                        updateItemAmount(newRow);
                    }
                });
            } else { // No items saved
                 if (addItemBtn) addItemBtn.click(); // Add a blank row
            }

            // Update totals and preview *after* all rows are processed and initialized
            updateTotalAmount();
            updateFullCalculationPreview();

        } else {
            console.error("No such PO document!"); showPOError("Error: Could not find PO to edit.");
            if(savePOBtn) savePOBtn.disabled = true;
        }
    } catch (error) {
        console.error("Error loading PO for editing:", error); showPOError("Error loading PO data: " + error.message);
        if(savePOBtn) savePOBtn.disabled = true;
    }
}
// --- **** END FIXED Function **** ---


// Helper function to display errors on PO form
function showPOError(message) {
    if (poErrorMsg) {
        poErrorMsg.textContent = message;
        poErrorMsg.style.display = message ? 'block' : 'none';
    } else { if(message) alert(message); }
}

console.log("new_po.js v5 loaded and ready.");