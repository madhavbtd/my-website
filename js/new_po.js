// js/new_po.js - v4 (Auto PO#, Item Details, Enhanced Preview)

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
const poNumberInput = document.getElementById('poNumberInput'); // Readonly input
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

/**
 * Calculates Flex Dimensions including wastage.
 * IMPORTANT: This is a modified local copy.
 * If you have this in utils.js, update that one instead or ensure this local one is used.
 */
function calculateFlexDimensions(unit, width, height) {
    console.log(`Calculating flex: Unit=${unit}, W=${width}, H=${height}`);
    const mediaWidthsFt = [3, 4, 5, 6, 8, 10]; // Standard media widths in feet

    let wFt = (unit === 'inches') ? parseFloat(width || 0) / 12 : parseFloat(width || 0);
    let hFt = (unit === 'inches') ? parseFloat(height || 0) / 12 : parseFloat(height || 0);

    if (isNaN(wFt) || isNaN(hFt) || wFt <= 0 || hFt <= 0) {
        return { realSqFt: 0, printWidth: 0, printHeight: 0, printSqFt: 0, inputUnit: unit, realWidthFt: 0, realHeightFt: 0, printWidthFt: 0, printHeightFt: 0 };
    }

    const realSqFt = wFt * hFt;
    console.log(`Real dimensions in Ft: W=${wFt.toFixed(2)}, H=${hFt.toFixed(2)}, RealSqFt=${realSqFt.toFixed(2)}`);

    // Option 1: Fit width to nearest larger media width, keep height same
    const mediaWidthFitW = mediaWidthsFt.find(mw => mw >= wFt);
    let printWidthFt1 = mediaWidthFitW || wFt;
    let printHeightFt1 = hFt;
    let printSqFt1 = printWidthFt1 * printHeightFt1;
    if (!mediaWidthFitW) console.warn(`Width ${wFt.toFixed(2)}ft exceeds max media width.`);

    // Option 2: Fit height to nearest larger media width (assuming roll can be rotated), keep width same
    const mediaWidthFitH = mediaWidthsFt.find(mw => mw >= hFt);
    let printWidthFt2 = wFt;
    let printHeightFt2 = mediaWidthFitH || hFt;
    let printSqFt2 = printWidthFt2 * printHeightFt2;
    if (!mediaWidthFitH) console.warn(`Height ${hFt.toFixed(2)}ft exceeds max media width.`);

    let finalPrintWidthFt, finalPrintHeightFt, finalPrintSqFt;

    // Choose the option with less wastage (smaller printSqFt)
    if (!mediaWidthFitH || printSqFt1 <= printSqFt2) { // Prioritize fitting width if height fit not possible or equal/less waste
         finalPrintWidthFt = printWidthFt1;
         finalPrintHeightFt = printHeightFt1;
         finalPrintSqFt = printSqFt1;
         console.log(`Choosing Option 1 (Fit Width): MediaW=${printWidthFt1.toFixed(2)}ft, RealH=${printHeightFt1.toFixed(2)}ft, PrintSqFt=${printSqFt1.toFixed(2)}`);
    } else {
         finalPrintWidthFt = printWidthFt2;
         finalPrintHeightFt = printHeightFt2;
         finalPrintSqFt = printSqFt2;
         console.log(`Choosing Option 2 (Fit Height): RealW=${printWidthFt2.toFixed(2)}ft, MediaH=${printHeightFt2.toFixed(2)}ft, PrintSqFt=${printSqFt2.toFixed(2)}`);
    }

    // Convert final print dimensions back to the original input unit for display consistency
    let displayPrintWidth = (unit === 'inches') ? finalPrintWidthFt * 12 : finalPrintWidthFt;
    let displayPrintHeight = (unit === 'inches') ? finalPrintHeightFt * 12 : finalPrintHeightFt;

    return {
        realSqFt: realSqFt.toFixed(2),          // Actual design area
        printWidth: displayPrintWidth.toFixed(2), // Final width on media (in original unit)
        printHeight: displayPrintHeight.toFixed(2),// Final height on media (in original unit)
        printSqFt: finalPrintSqFt.toFixed(2),   // Billing area in Square Feet
        inputUnit: unit,                        // The unit used for input width/height
        // **** ADDED/MODIFIED FOR WASTAGE CALC ****
        realWidthFt: wFt,                       // Original width in feet
        realHeightFt: hFt,                      // Original height in feet
        printWidthFt: finalPrintWidthFt,        // Print width in feet
        printHeightFt: finalPrintHeightFt       // Print height in feet
        // ***************************************
    };
}

// Function to update total amount
function updateTotalAmount() {
    let total = 0;
    poItemsTableBody.querySelectorAll('.item-row').forEach(row => {
        const amountSpan = row.querySelector('.item-amount');
        total += parseFloat(amountSpan?.textContent || 0); // Added safety check for amountSpan
    });
    if (poTotalAmountSpan) {
        poTotalAmountSpan.textContent = total.toFixed(2);
    }
    console.log("Total amount updated:", total.toFixed(2));
}

/**
 * NEW function to update the calculation preview for ALL Sq Feet items
 */
function updateFullCalculationPreview() {
    if (!calculationPreviewArea || !poItemsTableBody) return;

    let previewHTML = '<h4>Calculation Details:</h4>';
    const itemRows = poItemsTableBody.querySelectorAll('.item-row');
    let foundSqFt = false;

    itemRows.forEach((row, index) => {
        const unitTypeSelect = row.querySelector('.unit-type-select');
        if (unitTypeSelect?.value === 'Sq Feet') { // Added safety check
            foundSqFt = true;
            const productNameInput = row.querySelector('.product-name');
            const productName = productNameInput?.value.trim() || `Item ${index + 1}`; // Added safety check

            const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
            const widthInput = row.querySelector('.width-input');
            const heightInput = row.querySelector('.height-input');

            const unit = dimensionUnitSelect ? dimensionUnitSelect.value : 'feet';
            const width = parseFloat(widthInput?.value || 0); // Added safety check
            const height = parseFloat(heightInput?.value || 0); // Added safety check

            previewHTML += `<div class="item-preview-entry"><strong>${productName}:</strong><br>`;

            if (width > 0 && height > 0) {
                // Use the modified local calculateFlexDimensions function
                const calcResult = calculateFlexDimensions(unit, width, height);

                if (calcResult && parseFloat(calcResult.printSqFt) > 0) {
                     const realSqFtNum = parseFloat(calcResult.realSqFt);
                     const printSqFtNum = parseFloat(calcResult.printSqFt);
                     const wastageSqFt = (printSqFtNum - realSqFtNum); // Calculate before rounding for precision checks

                     // Calculate Wastage Size String
                     let wastageSizeStr = "N/A";
                     const widthDiff = (calcResult.printWidthFt - calcResult.realWidthFt);
                     const heightDiff = (calcResult.printHeightFt - calcResult.realHeightFt);
                     const tolerance = 0.01; // Tolerance for floating point comparisons

                     // Determine how wastage occurred
                     if (widthDiff > tolerance && Math.abs(heightDiff) < tolerance) {
                         // Only width increased significantly
                         wastageSizeStr = `${widthDiff.toFixed(2)}ft W x ${calcResult.realHeightFt.toFixed(2)}ft H`;
                     } else if (heightDiff > tolerance && Math.abs(widthDiff) < tolerance) {
                         // Only height increased significantly
                         wastageSizeStr = `${calcResult.realWidthFt.toFixed(2)}ft W x ${heightDiff.toFixed(2)}ft H`;
                     } else if (widthDiff > tolerance && heightDiff > tolerance) {
                          // Both increased - Complex scenario (L-shape waste)
                          // Reporting simple dimensions can be misleading. Report area instead.
                          wastageSizeStr = `~${wastageSqFt.toFixed(2)} sq ft area (complex)`;
                     } else if (wastageSqFt > tolerance) {
                          // Wastage exists, but not due to simple dimension increase (e.g. slight rounding diffs?)
                          wastageSizeStr = `~${wastageSqFt.toFixed(2)} sq ft area`;
                     } else {
                          // No significant wastage
                          wastageSizeStr = "None";
                     }


                     previewHTML += `
                         &nbsp; Real: ${calcResult.realWidthFt.toFixed(2)}ft x ${calcResult.realHeightFt.toFixed(2)}ft = ${realSqFtNum.toFixed(2)} sq ft<br>
                         &nbsp; Print: ${calcResult.printWidthFt.toFixed(2)}ft x ${calcResult.printHeightFt.toFixed(2)}ft = ${printSqFtNum.toFixed(2)} sq ft<br>
                         &nbsp; <strong style="color: ${wastageSqFt > tolerance ? 'orange' : 'green'};">Wastage: ${wastageSqFt.toFixed(2)} sq ft</strong> | <span style="color: ${wastageSqFt > tolerance ? 'orange' : 'green'};">Size: ${wastageSizeStr}</span>
                     `;
                } else {
                    previewHTML += `&nbsp; <span style="color:orange;">Invalid dimensions or calculation error.</span>`;
                }
            } else {
                 previewHTML += `&nbsp; <span style="color:grey;">Enter valid width & height.</span>`;
            }
            previewHTML += `</div>`;
        }
    });

    if (!foundSqFt) {
         previewHTML += '<p style="color:grey;">Add items with Unit Type "Sq Feet" to see calculations.</p>';
    }

    calculationPreviewArea.innerHTML = previewHTML;
}


// Function to update amount for a single row and trigger full preview update
function updateItemAmount(row) {
    if (!row) return;
    const unitTypeSelect = row.querySelector('.unit-type-select');
    const amountSpan = row.querySelector('.item-amount');
    const rateInput = row.querySelector('.rate-input');
    let amount = 0;

    try {
        const rate = parseFloat(rateInput?.value || 0); // Added safety check

        if (unitTypeSelect?.value === 'Sq Feet') { // Added safety check
            const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
            const widthInput = row.querySelector('.width-input');
            const heightInput = row.querySelector('.height-input');

            const unit = dimensionUnitSelect ? dimensionUnitSelect.value : 'feet';
            const width = parseFloat(widthInput?.value || 0); // Added safety check
            const height = parseFloat(heightInput?.value || 0); // Added safety check

            if (width > 0 && height > 0) {
                 const calcResult = calculateFlexDimensions(unit, width, height); // Use local modified function
                 amount = (parseFloat(calcResult.printSqFt) * rate);
            }
        } else { // 'Qty'
            const quantityInput = row.querySelector('.quantity-input'); // Get input inside TD
            const quantity = parseInt(quantityInput?.value || 0); // Added safety check
            amount = quantity * rate;
        }
    } catch (e) { console.error("Error calculating item amount:", e); amount = 0; }

    if (amountSpan) amountSpan.textContent = amount.toFixed(2); // Added safety check
    updateTotalAmount(); // Update overall total
    updateFullCalculationPreview(); // **** UPDATE FULL PREVIEW ****
}

// Function to handle unit type change for a row
function handleUnitTypeChange(event) {
    const row = event.target.closest('.item-row');
    if (!row) return;

    const unitType = event.target.value;
    const sqFeetInputs = row.querySelectorAll('.sq-feet-input');
    const qtyInputCell = row.querySelector('.qty-input'); // Direct TD
    const sqFeetHeaders = document.querySelectorAll('#poItemsTable th.sq-feet-header');
    const qtyHeader = document.querySelector('#poItemsTable th.qty-header');
    const rateInput = row.querySelector('.rate-input');

    if (unitType === 'Sq Feet') {
        sqFeetInputs.forEach(el => el.style.display = ''); // Show TDs
        if(qtyInputCell) qtyInputCell.style.display = 'none'; // Hide Quantity TD
        sqFeetHeaders.forEach(th => th.classList.remove('hidden-col'));
        if(qtyHeader) qtyHeader.classList.add('hidden-col');
        if(rateInput) rateInput.placeholder = 'Rate/SqFt';
        const quantityInputField = row.querySelector('.quantity-input'); // Get input inside TD
        if(quantityInputField) quantityInputField.value = '';
    } else { // 'Qty'
        sqFeetInputs.forEach(el => el.style.display = 'none'); // Hide TDs
        if(qtyInputCell) qtyInputCell.style.display = ''; // Show Quantity TD
        sqFeetHeaders.forEach(th => th.classList.add('hidden-col'));
        if(qtyHeader) qtyHeader.classList.remove('hidden-col');
        if(rateInput) rateInput.placeholder = 'Rate/Unit';
         const widthInput = row.querySelector('.width-input');
         const heightInput = row.querySelector('.height-input');
         if(widthInput) widthInput.value = '';
         if(heightInput) heightInput.value = '';
    }

    updateItemAmount(row); // Recalculate amount for this row (which also calls updateFullCalculationPreview)
}

// Function to add event listeners to a new item row
function addItemRowEventListeners(row) {
    const unitTypeSelect = row.querySelector('.unit-type-select');
    const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
    const widthInput = row.querySelector('.width-input');
    const heightInput = row.querySelector('.height-input');
    const quantityInput = row.querySelector('.quantity-input'); // Get the input element if needed for direct listening
    const rateInput = row.querySelector('.rate-input');
    const deleteBtn = row.querySelector('.delete-item-btn');

    // Inputs that trigger recalculation for the specific row AND full preview update
    const recalcInputs = [unitTypeSelect, dimensionUnitSelect, widthInput, heightInput, quantityInput, rateInput];

    recalcInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', () => updateItemAmount(row));
            input.addEventListener('change', () => updateItemAmount(row)); // Also on change for selects
            input.addEventListener('blur', () => updateItemAmount(row));   // Ensure update on blur
        }
    });

     // Delete button listener
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            row.remove();
            updateTotalAmount();
            updateFullCalculationPreview(); // Update preview after row removal
        });
    }

     // Initial setup for visibility based on default unit type ('Qty')
     if(unitTypeSelect){
        handleUnitTypeChange({ target: unitTypeSelect }); // This will also trigger updateItemAmount -> updateFullCalculationPreview
     }
}

// --- Initialization on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("new_po.js: DOM loaded.");
    if (!window.db || !window.query || !window.orderBy || !window.limit || !window.getDocs) {
        console.error("new_po.js: Firestore (window.db) or query functions not available!");
        alert("Error initializing page. Firestore connection or required functions failed.");
        if(poForm) poForm.style.opacity = '0.5'; if(savePOBtn) savePOBtn.disabled = true;
        return;
    }
    console.log("new_po.js: Firestore connection and functions confirmed.");

    // Set default order date to today
    if(poOrderDateInput && !poOrderDateInput.value) { // Set only if empty
       try { poOrderDateInput.value = new Date().toISOString().split('T')[0]; }
       catch (e) { console.error("Error setting default date:", e); }
    }

    // --- Add Item Row Logic ---
    if (addItemBtn && itemRowTemplate && poItemsTableBody) {
        addItemBtn.addEventListener('click', () => {
            const templateContent = itemRowTemplate.content.cloneNode(true);
            poItemsTableBody.appendChild(templateContent);
            const appendedRow = poItemsTableBody.lastElementChild;
            if (appendedRow?.matches('.item-row')) { // Added safety check
                addItemRowEventListeners(appendedRow);
                updateFullCalculationPreview(); // Update preview after adding row
                 const firstInput = appendedRow.querySelector('.product-name');
                 if(firstInput) firstInput.focus();
            } else { console.error("Failed to get appended row or it's not an item-row"); }
        });
        // Add one row initially only if NOT editing and no rows exist yet
        const urlParams = new URLSearchParams(window.location.search);
        const editPOId = urlParams.get('editPOId');
        if (!editPOId && poItemsTableBody.children.length === 0) {
            addItemBtn.click();
        } else {
             updateFullCalculationPreview(); // Update preview on initial load (for editing or if rows already exist)
        }

    } else { console.error("Add Item button, Item Row template or Table Body not found!"); }

    // --- Supplier Auto Suggest Logic ---
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

    // --- Form Submission Logic ---
    if (poForm) {
        poForm.addEventListener('submit', handleSavePO); // Use the updated handleSavePO
    } else { console.error("PO Form element not found!"); }

    // --- Load PO Data if Editing ---
    const urlParamsForEdit = new URLSearchParams(window.location.search);
    const editPOIdValue = urlParamsForEdit.get('editPOId');
    if (editPOIdValue) {
        loadPOForEditing(editPOIdValue);
    } else {
        // Creating new PO
        if(poNumberInput) poNumberInput.value = ''; // Ensure PO number is clear initially
        updateFullCalculationPreview(); // Update preview for potentially empty state
    }

    console.log("new_po.js: Basic setup and listeners added.");

}); // End DOMContentLoaded


// --- Supplier Search Implementation (Keep unchanged from previous versions) ---
function handleSupplierSearchInput() {
     if (!supplierSearchInput || !supplierSuggestionsDiv || !selectedSupplierIdInput || !selectedSupplierNameInput) return;
     console.log("Supplier search input:", supplierSearchInput.value);
     clearTimeout(supplierSearchDebounceTimer);
     const searchTerm = supplierSearchInput.value.trim();
     selectedSupplierIdInput.value = ''; selectedSupplierNameInput.value = '';
     if (searchTerm.length < 1) {
         supplierSuggestionsDiv.innerHTML = ''; supplierSuggestionsDiv.style.display = 'none'; return;
     }
     supplierSearchDebounceTimer = setTimeout(() => { fetchSupplierSuggestions(searchTerm); }, 350);
}
async function fetchSupplierSuggestions(searchTerm) {
    console.log("Fetching suppliers matching:", searchTerm);
     if (!supplierSuggestionsDiv) return;
     supplierSuggestionsDiv.innerHTML = '<div>Loading...</div>'; supplierSuggestionsDiv.style.display = 'block';
    try {
        const q = query( collection(db, "suppliers"), orderBy("name"),
            where("name", ">=", searchTerm), where("name", "<=", searchTerm + '\uf8ff'), limit(10) );
        const querySnapshot = await getDocs(q);
        supplierSuggestionsDiv.innerHTML = '';
        if (querySnapshot.empty) {
            supplierSuggestionsDiv.innerHTML = '<div class="no-suggestions">No matching suppliers found. <button type="button" id="suggestAddNewSupplier" class="button link-button" style="margin-left: 10px;">+ Add New</button></div>';
            // Add listener for the new button within suggestions
            const suggestBtn = supplierSuggestionsDiv.querySelector('#suggestAddNewSupplier');
            if (suggestBtn && addNewSupplierFromPOBtn) {
                suggestBtn.addEventListener('click', () => addNewSupplierFromPOBtn.click());
            }
        } else {
            querySnapshot.forEach((docSnapshot) => {
                const supplier = docSnapshot.data(); const supplierId = docSnapshot.id;
                const div = document.createElement('div');
                div.textContent = `${supplier.name}${supplier.companyName ? ' (' + supplier.companyName + ')' : ''}`;
                div.dataset.id = supplierId; div.dataset.name = supplier.name;
                div.style.cursor = 'pointer'; // Make it look clickable
                div.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    supplierSearchInput.value = supplier.name;
                    if(selectedSupplierIdInput) selectedSupplierIdInput.value = supplierId;
                    if(selectedSupplierNameInput) selectedSupplierNameInput.value = supplier.name;
                    supplierSuggestionsDiv.style.display = 'none';
                    console.log("Selected Supplier:", supplier.name, "ID:", supplierId);
                    if (poOrderDateInput) poOrderDateInput.focus(); // Move focus
                });
                supplierSuggestionsDiv.appendChild(div);
            });
        }
    } catch (error) {
        console.error("Error fetching supplier suggestions:", error);
         supplierSuggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Error fetching suppliers.</div>';
    }
}

// --- ***** UPDATED Save PO Implementation ***** ---
async function handleSavePO(event) {
    event.preventDefault();
    console.log("Attempting to save PO...");
    showPOError('');

    // --- Ensure prerequisites ---
    if (!poForm || !selectedSupplierIdInput || !poOrderDateInput || !poItemsTableBody || !poTotalAmountSpan || !savePOBtn || !db || !addDoc || !collection || !doc || !updateDoc || !Timestamp || !serverTimestamp || !query || !orderBy || !limit || !getDocs) {
        console.error("Save PO prerequisites missing.");
        showPOError("Critical error: Cannot save PO. Required elements or functions missing.");
        return;
    }

    const editingPOId = editPOIdInput.value;
    const isEditing = !!editingPOId;
    let finalPoNumber = null;

    // --- Disable button early ---
    savePOBtn.disabled = true;
    if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Updating...' : 'Processing...';

    // --- Determine PO Number ---
    if (isEditing) {
        const existingValue = poNumberInput.value.trim();
        const numericValue = Number(existingValue);
        finalPoNumber = (!isNaN(numericValue)) ? numericValue : (existingValue || null);
        console.log("Using existing PO Number for edit:", finalPoNumber);
    } else {
        // --- Generate New PO Number ---
        if(savePOBtnSpan) savePOBtnSpan.textContent = 'Generating PO#...';
        console.log("Generating new PO Number...");
        try {
            const q = query(collection(db, "purchaseOrders"), orderBy("poNumber", "desc"), limit(1));
            const querySnapshot = await getDocs(q);
            let lastPoNumber = 1000;
            if (!querySnapshot.empty) {
                const lastPO = querySnapshot.docs[0].data();
                const lastNum = Number(lastPO.poNumber);
                if (!isNaN(lastNum) && lastNum >= 1000) { lastPoNumber = lastNum; }
                else { console.warn("Last PO number wasn't valid >= 1000, restarting sequence from 1001.", lastPO.poNumber); }
            } else { console.log("No existing POs found, starting sequence from 1001."); }
            finalPoNumber = lastPoNumber + 1;
            poNumberInput.value = finalPoNumber;
            console.log("Generated PO Number:", finalPoNumber);
        } catch (error) {
             console.error("Error generating PO number:", error); showPOError("Error generating PO Number. Cannot save. " + error.message);
             savePOBtn.disabled = false; if (savePOBtnSpan) savePOBtnSpan.textContent = 'Save Purchase Order'; return;
        }
        // --- End Generate New PO Number ---
    }

     // Re-enable button momentarily for validation phase
     savePOBtn.disabled = false;
     if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Update Purchase Order' : 'Save Purchase Order';

    // --- 1. Gather General PO Data ---
    const supplierId = selectedSupplierIdInput.value;
    const supplierName = selectedSupplierNameInput.value;
    const orderDateValue = poOrderDateInput.value;
    const notes = poNotesInput.value.trim();

    // --- 2. Basic Validation ---
    if (!supplierId || !supplierName) { showPOError("Please select a supplier."); supplierSearchInput.focus(); return; }
    if (!orderDateValue) { showPOError("Please select an order date."); poOrderDateInput.focus(); return; }
    const itemRows = poItemsTableBody.querySelectorAll('.item-row');
    if (itemRows.length === 0) { showPOError("Please add at least one item."); return; }
    if (finalPoNumber === null && !isEditing) { showPOError("PO Number generation failed. Cannot save."); return;} // Should not happen due to error handling above

    // --- 3. Gather and Validate Item Data ---
    let itemsArray = [];
    let validationPassed = true;
    let calculatedTotalAmount = 0;

    itemRows.forEach((row, index) => {
        if (!validationPassed) return;
        const productNameInput = row.querySelector('.product-name');
        const unitTypeSelect = row.querySelector('.unit-type-select');
        const rateInput = row.querySelector('.rate-input');
        const itemAmountSpan = row.querySelector('.item-amount');
        const partyNameInput = row.querySelector('.party-name');       // Get party name input
        const designDetailsInput = row.querySelector('.design-details'); // Get design details input

        const productName = productNameInput?.value.trim(); // Safety check
        const unitType = unitTypeSelect?.value;           // Safety check
        const rate = parseFloat(rateInput?.value || 0);   // Safety check
        const itemAmount = parseFloat(itemAmountSpan?.textContent || 0); // Safety check

        if (!productName) { validationPassed = false; showPOError(`Item ${index + 1}: Product Name required.`); productNameInput?.focus(); return; } // Safety check focus
        if (isNaN(rate) || rate < 0) { validationPassed = false; showPOError(`Item ${index + 1}: Valid Rate required.`); rateInput?.focus(); return; } // Safety check focus
        if (isNaN(itemAmount)) { validationPassed = false; showPOError(`Item ${index + 1}: Amount calculation error.`); return; }

        let itemData = {
            productName: productName, type: unitType, rate: rate, itemAmount: 0, // Amount will be set below
            partyName: partyNameInput?.value.trim() || '',           // Add party name
            designDetails: designDetailsInput?.value.trim() || ''    // Add design details
        };

        // Calculate/Verify Amount and add type-specific details
        let expectedAmount = 0;
        if (unitType === 'Sq Feet') {
            const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
            const widthInput = row.querySelector('.width-input');
            const heightInput = row.querySelector('.height-input');
            const unit = dimensionUnitSelect?.value || 'feet'; // Safety check
            const width = parseFloat(widthInput?.value || 0); // Safety check
            const height = parseFloat(heightInput?.value || 0); // Safety check
            if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0) { validationPassed = false; showPOError(`Item ${index + 1}: Valid Width & Height required.`); widthInput?.focus(); return; } // Safety check focus
            const calcResult = calculateFlexDimensions(unit, width, height);
            if(parseFloat(calcResult.printSqFt) <= 0) { validationPassed = false; showPOError(`Item ${index + 1}: Calculation error.`); widthInput?.focus(); return; } // Safety check focus
            itemData.unit = unit; itemData.realWidth = width; itemData.realHeight = height;
            itemData.realSqFt = parseFloat(calcResult.realSqFt); itemData.printWidth = parseFloat(calcResult.printWidth);
            itemData.printHeight = parseFloat(calcResult.printHeight); itemData.printSqFt = parseFloat(calcResult.printSqFt);
            expectedAmount = itemData.printSqFt * itemData.rate;
        } else { // 'Qty'
            const quantityInput = row.querySelector('.quantity-input'); // Get input inside TD
            const quantity = parseInt(quantityInput?.value || 0); // Safety check
            if (isNaN(quantity) || quantity <= 0) { validationPassed = false; showPOError(`Item ${index + 1}: Valid Quantity required.`); quantityInput?.focus(); return; } // Safety check focus
            itemData.quantity = quantity;
            expectedAmount = itemData.quantity * itemData.rate;
        }

        // Set final item amount (use calculated, log warning if different from displayed)
        if (Math.abs(itemAmount - expectedAmount) > 0.01) {
             console.warn(`Item ${index + 1} amount mismatch: displayed=${itemAmount.toFixed(2)}, calculated=${expectedAmount.toFixed(2)}. Using calculated.`);
             itemData.itemAmount = parseFloat(expectedAmount.toFixed(2));
        } else {
             itemData.itemAmount = parseFloat(itemAmount.toFixed(2));
        }

        itemsArray.push(itemData);
        calculatedTotalAmount += itemData.itemAmount;
    });

    if (!validationPassed) { console.error("PO save failed due to item validation errors."); return; }

    // --- Disable button again before final save ---
    savePOBtn.disabled = true;
    if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Updating...' : 'Saving...';

    // --- 4. Create Firestore Data Object ---
    const poData = {
        supplierId: supplierId, supplierName: supplierName, poNumber: finalPoNumber,
        orderDate: Timestamp.fromDate(new Date(orderDateValue + 'T00:00:00')), // Treat date as local timezone start of day
        items: itemsArray, totalAmount: parseFloat(calculatedTotalAmount.toFixed(2)),
        notes: notes, updatedAt: serverTimestamp()
    };
    if (!isEditing) { poData.createdAt = serverTimestamp(); poData.status = 'New'; }
    else { poData.status = editingPOData?.status || 'New'; } // Use loaded status for editing

    console.log("Final PO Data to save:", poData);

    // --- 5. Save to Firestore ---
    try {
        let successMessage = '';
        if (isEditing) {
            const poDocRef = doc(db, "purchaseOrders", editingPOId);
            await updateDoc(poDocRef, poData);
            successMessage = "Purchase Order updated successfully!";
            console.log(successMessage, "ID:", editingPOId);
        } else {
            if (typeof poData.poNumber !== 'number' || isNaN(poData.poNumber)) { throw new Error("Generated PO number is not valid before saving."); }
            const poDocRef = await addDoc(collection(db, "purchaseOrders"), poData);
            successMessage = "Purchase Order saved successfully!";
            console.log(successMessage, "ID:", poDocRef.id);
        }
        alert(successMessage);
        window.location.href = 'supplier_management.html';
    } catch (error) {
        console.error("Error saving Purchase Order: ", error);
        showPOError("Error saving PO: " + error.message);
        savePOBtn.disabled = false; // Re-enable on error
        if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Update Purchase Order' : 'Save Purchase Order';
    }
}

// --- Load PO for Editing Implementation ---
async function loadPOForEditing(poId) {
    console.log("Loading PO data for editing:", poId);
    if (!db || !doc || !getDoc || !poForm) { showPOError("Cannot load PO for editing. Initialization error."); return; }

    if (poPageTitle) poPageTitle.innerHTML = `<i class="fas fa-edit"></i> Edit Purchase Order`;
    if (poBreadcrumbAction) poBreadcrumbAction.textContent = `Edit PO`;
    if (savePOBtnSpan) savePOBtnSpan.textContent = 'Update Purchase Order';
    editPOIdInput.value = poId;
    if(poNumberInput) poNumberInput.readOnly = false; // Allow editing PO number if needed

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

            poItemsTableBody.innerHTML = ''; // Clear default rows
            if (editingPOData.items?.length > 0) { // Check if items exist and is array
                editingPOData.items.forEach(item => {
                    if (!itemRowTemplate) return;
                    const templateContent = itemRowTemplate.content.cloneNode(true);
                    poItemsTableBody.appendChild(templateContent);
                    const newRow = poItemsTableBody.lastElementChild;
                    if (newRow?.matches('.item-row')) { // Safety check
                        // Populate standard fields
                        const productNameInput = newRow.querySelector('.product-name'); if(productNameInput) productNameInput.value = item.productName || '';
                        const unitTypeSelect = newRow.querySelector('.unit-type-select'); if(unitTypeSelect) unitTypeSelect.value = item.type || 'Qty';
                        const rateInput = newRow.querySelector('.rate-input'); if(rateInput) rateInput.value = item.rate ?? ''; // Use ?? for 0 value
                        // Populate NEW fields
                        const partyNameInput = newRow.querySelector('.party-name'); if(partyNameInput) partyNameInput.value = item.partyName || '';
                        const designDetailsInput = newRow.querySelector('.design-details'); if(designDetailsInput) designDetailsInput.value = item.designDetails || '';
                        // Populate type-specific fields
                        if (item.type === 'Sq Feet') {
                           const dimensionUnitSelect = newRow.querySelector('.dimension-unit-select'); if(dimensionUnitSelect) dimensionUnitSelect.value = item.unit || 'feet';
                           const widthInput = newRow.querySelector('.width-input'); if(widthInput) widthInput.value = item.realWidth ?? '';
                           const heightInput = newRow.querySelector('.height-input'); if(heightInput) heightInput.value = item.realHeight ?? '';
                        } else {
                           const quantityInput = newRow.querySelector('.quantity-input'); if(quantityInput) quantityInput.value = item.quantity ?? '';
                        }
                        addItemRowEventListeners(newRow); // Attach listeners AFTER populating
                        // Amount is recalculated via listeners triggering updateItemAmount
                    }
                });
            } else { // No items saved, add a blank row
                 if (addItemBtn) addItemBtn.click();
            }
            updateTotalAmount(); // Update total after populating all
            updateFullCalculationPreview(); // Update preview after populating all

        } else {
            console.error("No such PO document!"); showPOError("Error: Could not find the Purchase Order to edit.");
            if(savePOBtn) savePOBtn.disabled = true;
        }
    } catch (error) {
        console.error("Error loading PO for editing:", error); showPOError("Error loading PO data: " + error.message);
        if(savePOBtn) savePOBtn.disabled = true;
    }
}

// Helper function to display errors on PO form
function showPOError(message) {
    if (poErrorMsg) {
        poErrorMsg.textContent = message;
        poErrorMsg.style.display = message ? 'block' : 'none';
    } else { if(message) alert(message); }
}

console.log("new_po.js loaded and initial functions defined.");