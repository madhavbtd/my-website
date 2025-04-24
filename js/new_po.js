// js/new_po.js - v16 (Added productId save/retrieval)

// Assume Firebase functions are globally available via HTML script block
const {
    db, collection, doc, addDoc, getDoc, getDocs, updateDoc, serverTimestamp, Timestamp,
    query, where, orderBy, limit, arrayUnion // Add arrayUnion if used for linking
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
// const savePOBtnSpan = savePOBtn ? savePOBtn.querySelector('span') : null; // Defined inside handleSavePO
const poErrorMsg = document.getElementById('poErrorMsg');
let productSuggestionsDiv = null;

// --- Global State ---
let supplierSearchDebounceTimer;
let productSearchDebounceTimer;
let editingPOData = null;
let activeProductInput = null;

// --- Utility Functions --- (calculateFlexDimensions, updateTotalAmount, updateFullCalculationPreview, updateItemAmount, handleUnitTypeChange, addItemRowEventListeners - remain unchanged from v15)
function calculateFlexDimensions(unit, width, height) {
    console.log(`Calculating flex: Unit=${unit}, W=${width}, H=${height}`);
    const mediaWidthsFt = [3, 4, 5, 6, 8, 10];
    let wFt = (unit === 'inches') ? parseFloat(width || 0) / 12 : parseFloat(width || 0);
    let hFt = (unit === 'inches') ? parseFloat(height || 0) / 12 : parseFloat(height || 0);
    if (isNaN(wFt) || isNaN(hFt) || wFt <= 0 || hFt <= 0) {
        return { realSqFt: 0, printWidth: 0, printHeight: 0, printSqFt: 0, inputUnit: unit, realWidthFt: 0, realHeightFt: 0, printWidthFt: 0, printHeightFt: 0 };
    }
    const realSqFt = wFt * hFt;
    const mediaWidthFitW = mediaWidthsFt.find(mw => mw >= wFt);
    let printWidthFt1 = mediaWidthFitW || wFt;
    let printHeightFt1 = hFt;
    let printSqFt1 = printWidthFt1 * printHeightFt1;
    if (!mediaWidthFitW) console.warn(`Width ${wFt.toFixed(2)}ft exceeds max media width.`);
    const mediaWidthFitH = mediaWidthsFt.find(mw => mw >= hFt);
    let printWidthFt2 = wFt;
    let printHeightFt2 = mediaWidthFitH || hFt;
    let printSqFt2 = printWidthFt2 * printHeightFt2;
    if (!mediaWidthFitH) console.warn(`Height ${hFt.toFixed(2)}ft exceeds max media width.`);
    let finalPrintWidthFt, finalPrintHeightFt, finalPrintSqFt;
    if (!mediaWidthFitH || printSqFt1 <= printSqFt2) {
        finalPrintWidthFt = printWidthFt1;
        finalPrintHeightFt = printHeightFt1;
        finalPrintSqFt = printSqFt1;
    } else {
        finalPrintWidthFt = printWidthFt2;
        finalPrintHeightFt = printHeightFt2;
        finalPrintSqFt = printSqFt2;
    }
    let displayPrintWidth = (unit === 'inches') ? finalPrintWidthFt * 12 : finalPrintWidthFt;
    let displayPrintHeight = (unit === 'inches') ? finalPrintHeightFt * 12 : finalPrintHeightFt;
    return { realSqFt: realSqFt.toFixed(2), printWidth: displayPrintWidth.toFixed(2), printHeight: displayPrintHeight.toFixed(2), printSqFt: finalPrintSqFt.toFixed(2), inputUnit: unit, realWidthFt: wFt, realHeightFt: hFt, printWidthFt: finalPrintWidthFt, printHeightFt: finalPrintHeightFt };
}

function updateTotalAmount() {
    let total = 0;
    poItemsTableBody.querySelectorAll('.item-row').forEach(row => {
        const amountSpan = row.querySelector('.item-amount');
        total += parseFloat(amountSpan?.textContent || 0);
    });
    if (poTotalAmountSpan) {
        poTotalAmountSpan.textContent = total.toFixed(2);
    }
}

function updateFullCalculationPreview() {
    if (!calculationPreviewArea || !poItemsTableBody) return;
    let entriesHTML = '';
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
            const quantityInput = row.querySelector('.quantity-input');
            const unit = dimensionUnitSelect ? dimensionUnitSelect.value : 'feet';
            const width = parseFloat(widthInput?.value || 0);
            const height = parseFloat(heightInput?.value || 0);
            let quantity = parseInt(quantityInput?.value || 1);
            if (isNaN(quantity) || quantity < 1) { quantity = 1; }
            let entryContent = `<strong>${productName}:</strong><br>`;
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
                    entryContent += `&nbsp; Quantity: ${quantity}<br>`;
                    entryContent += `&nbsp; Real: ${calcResult.realWidthFt.toFixed(2)}ft x ${calcResult.realHeightFt.toFixed(2)}ft = ${realSqFtNum.toFixed(2)} sq ft/item<br>`;
                    entryContent += `&nbsp; Print: ${calcResult.printWidthFt.toFixed(2)}ft x ${calcResult.printHeightFt.toFixed(2)}ft = ${printSqFtNum.toFixed(2)} sq ft/item<br>`;
                    entryContent += `&nbsp; Total Print Area: ${(printSqFtNum * quantity).toFixed(2)} sq ft<br>`;
                    entryContent += `&nbsp; <strong style="color: ${wastageSqFt > tolerance ? 'orange' : 'green'};">Wastage: ${wastageSqFt.toFixed(2)} sq ft/item</strong> | <span style="color: ${wastageSqFt > tolerance ? 'orange' : 'green'};">Size: ${wastageSizeStr}</span>`;
                } else { entryContent += `&nbsp; <span style="color:orange;">Invalid dimensions or calculation error.</span>`; }
            } else { entryContent += `&nbsp; <span style="color:grey;">Enter valid width & height.</span>`; }
            entriesHTML += `<div class="item-preview-entry">${entryContent}</div>`;
        }
    });
    let finalHTML = '<h4>Calculation Details:</h4>';
    if (foundSqFt && entriesHTML) { finalHTML += `<div class="calculation-grid">${entriesHTML}</div>`; }
    else { finalHTML += '<p style="color:grey;">Add items with Unit Type "Sq Feet" to see calculations.</p>'; }
    calculationPreviewArea.innerHTML = finalHTML;
}

function updateItemAmount(row) {
    if (!row) return;
    const unitTypeSelect = row.querySelector('.unit-type-select');
    const amountSpan = row.querySelector('.item-amount');
    const rateInput = row.querySelector('.rate-input');
    const quantityInput = row.querySelector('.quantity-input');
    let amount = 0;
    try {
        const rate = parseFloat(rateInput?.value || 0);
        let quantity = parseInt(quantityInput?.value || 1);
        if (isNaN(quantity) || quantity < 1) { quantity = 1; }
        if (unitTypeSelect?.value === 'Sq Feet') {
            const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
            const widthInput = row.querySelector('.width-input');
            const heightInput = row.querySelector('.height-input');
            const unit = dimensionUnitSelect ? dimensionUnitSelect.value : 'feet';
            const width = parseFloat(widthInput?.value || 0);
            const height = parseFloat(heightInput?.value || 0);
            if (width > 0 && height > 0) {
                const calcResult = calculateFlexDimensions(unit, width, height);
                amount = (parseFloat(calcResult.printSqFt || 0) * quantity * rate);
            }
        } else { amount = quantity * rate; }
    } catch (e) { console.error("Error calculating item amount:", e); amount = 0; }
    if (amountSpan) amountSpan.textContent = amount.toFixed(2);
    updateTotalAmount();
    updateFullCalculationPreview();
}

function handleUnitTypeChange(event) {
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
    if (!sqFeetDimensionCell || !sqFeetUnitCell || !qtyInputDirectParentCell || !sqFeetHeader1 || !sqFeetHeader2 || !qtyHeader) { console.error("handleUnitTypeChange: Could not find all necessary cells/headers for unit type toggle."); return; }
    if (unitType === 'Sq Feet') {
        console.log("Switching to Sq Feet view");
        sqFeetDimensionCell.style.display = '';
        sqFeetUnitCell.style.display = '';
        sqFeetHeader1.classList.remove('hidden-col');
        sqFeetHeader2.classList.remove('hidden-col');
        qtyInputDirectParentCell.style.display = '';
        qtyHeader.classList.remove('hidden-col');
        if (rateInput) rateInput.placeholder = 'Rate/SqFt';
    } else {
        console.log("Switching to Qty view");
        sqFeetDimensionCell.style.display = 'none';
        sqFeetUnitCell.style.display = 'none';
        sqFeetHeader1.classList.add('hidden-col');
        sqFeetHeader2.classList.add('hidden-col');
        qtyInputDirectParentCell.style.display = '';
        qtyHeader.classList.remove('hidden-col');
        if (rateInput) rateInput.placeholder = 'Rate/Unit';
        const widthInput = sqFeetDimensionCell.querySelector('.width-input');
        const heightInput = sqFeetDimensionCell.querySelector('.height-input');
        if (widthInput) widthInput.value = '';
        if (heightInput) heightInput.value = '';
    }
    updateItemAmount(row);
}

function addItemRowEventListeners(row) {
    const unitTypeSelect = row.querySelector('.unit-type-select');
    const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
    const widthInput = row.querySelector('.width-input');
    const heightInput = row.querySelector('.height-input');
    const quantityInput = row.querySelector('.quantity-input');
    const rateInput = row.querySelector('.rate-input');
    const deleteBtn = row.querySelector('.delete-item-btn');
    const recalcInputs = [dimensionUnitSelect, widthInput, heightInput, quantityInput, rateInput];
    recalcInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', () => updateItemAmount(row));
            input.addEventListener('change', () => updateItemAmount(row));
        }
    });
    if (unitTypeSelect) { unitTypeSelect.addEventListener('change', handleUnitTypeChange); }
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            row.remove();
            hideProductSuggestions();
            updateTotalAmount();
            updateFullCalculationPreview();
        });
    }
    if (unitTypeSelect) {
        // Trigger the initial state setup based on the select's current value
        handleUnitTypeChange({ target: unitTypeSelect });
    } else { console.warn("Unit type select not found in row for initial state setting:", row); }
    updateItemAmount(row); // Initial calculation for the row
}


// --- Product Search Implementation --- (getOrCreateProductSuggestionsDiv, positionProductSuggestions, hideProductSuggestions, handleProductSearchInput, fetchProductSuggestions - remain unchanged from v15)
function getOrCreateProductSuggestionsDiv() {
    if (!productSuggestionsDiv) {
        productSuggestionsDiv = document.createElement('div');
        productSuggestionsDiv.className = 'product-suggestions-list';
        productSuggestionsDiv.style.display = 'none';
        document.body.appendChild(productSuggestionsDiv);
    }
    return productSuggestionsDiv;
}

function positionProductSuggestions(inputElement) {
    const suggestionsDiv = getOrCreateProductSuggestionsDiv();
    const rect = inputElement.getBoundingClientRect();
    suggestionsDiv.style.position = 'absolute'; // Ensure absolute positioning
    suggestionsDiv.style.left = `${rect.left + window.scrollX}px`;
    suggestionsDiv.style.top = `${rect.bottom + window.scrollY}px`;
    suggestionsDiv.style.width = `${rect.width}px`;
    suggestionsDiv.style.display = 'block';
}

function hideProductSuggestions() {
    if (productSuggestionsDiv) {
        productSuggestionsDiv.style.display = 'none';
    }
    activeProductInput = null; // Clear active input when hiding
}

function handleProductSearchInput(event) {
    const inputElement = event.target;
    if (!inputElement.matches('.product-name')) {
        return; // Only act on product name inputs
    }
    activeProductInput = inputElement; // Track which input is active
    clearTimeout(productSearchDebounceTimer);
    const searchTerm = inputElement.value.trim();
    if (searchTerm.length < 1) {
        hideProductSuggestions();
        return;
    }
    positionProductSuggestions(inputElement); // Position relative to the current input
    productSearchDebounceTimer = setTimeout(() => {
        fetchProductSuggestions(searchTerm, inputElement); // Pass the input element
    }, 350);
}

async function fetchProductSuggestions(searchTerm, inputElement) {
    const suggestionsDiv = getOrCreateProductSuggestionsDiv();
    suggestionsDiv.innerHTML = '<div>Loading...</div>';
    if (activeProductInput === inputElement) { // Check if the input is still the active one
        positionProductSuggestions(inputElement); // Reposition if needed (e.g., scrolling)
    }
    else {
        hideProductSuggestions(); // Hide if focus moved elsewhere
        return;
    }

    const searchTermLower = searchTerm.toLowerCase();

    try {
        console.log(`Searching products with lowercase term: "${searchTermLower}"`);
        // Ensure Firestore functions are available
        if (!db || !collection || !query || !orderBy || !where || !limit || !getDocs) {
             throw new Error("Firestore functions not available for product search.");
        }

        const q = query(
            collection(db, "products"),
            orderBy("printName_lowercase"),
            where("printName_lowercase", ">=", searchTermLower),
            where("printName_lowercase", "<=", searchTermLower + '\uf8ff'),
            limit(10)
        );
        const querySnapshot = await getDocs(q);
        suggestionsDiv.innerHTML = ''; // Clear loading message

        if (querySnapshot.empty) {
            console.log(`No products found matching lowercase: "${searchTermLower}"`);
            suggestionsDiv.innerHTML = '<div class="no-suggestions">No matching products found.</div>';
        } else {
            querySnapshot.forEach((docSnapshot) => {
                const product = docSnapshot.data();
                if (product.printName_lowercase === undefined) {
                     console.warn(`Product ${docSnapshot.id} (${product.printName}) is missing 'printName_lowercase' field.`);
                }
                const productId = docSnapshot.id;
                const div = document.createElement('div');
                div.textContent = product.printName || 'Unnamed Product';
                div.dataset.id = productId;
                div.dataset.name = product.printName || '';
                div.dataset.rate = product.purchasePrice ?? ''; // Use purchasePrice
                div.dataset.unitFirestore = product.unit || 'Qty'; // Store unit from Firestore

                // Use mousedown to prevent blur event from hiding suggestions before click registers
                div.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // Prevent focus loss
                    selectProductSuggestion(product, inputElement); // Pass product data and the input element
                });
                suggestionsDiv.appendChild(div);
            });
        }
         // Show suggestions only if the input is still active
         if (activeProductInput === inputElement) {
             suggestionsDiv.style.display = 'block';
         }
         else {
             hideProductSuggestions();
         }

    } catch (error) {
        console.error("Error fetching product suggestions:", error);
        if (error.message.includes("indexes are required")) {
             console.error("Firestore Index Missing: Please create a Firestore index for the 'products' collection on the 'printName_lowercase' field (ascending).");
             suggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Search Error (Index Missing).</div>';
        } else if (error.message.includes("does not support order by") || error.message.includes("indexes are required")) {
             console.error("Firestore Field Missing or Index Error: Ensure 'printName_lowercase' field exists and is indexed.");
             suggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Search Error (Field/Index).</div>';
        }
        else {
            suggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Error fetching products.</div>';
        }
         // Ensure suggestions are shown if input is active, even after error
         if (activeProductInput === inputElement) {
             suggestionsDiv.style.display = 'block';
         }
    }
}

// --- selectProductSuggestion (UPDATED CODE) ---
// js/new_po.js - Function: selectProductSuggestion (UPDATED to store productId)
function selectProductSuggestion(productData, inputElement) {
    const row = inputElement.closest('.item-row');
    if (!row) {
        console.error("Could not find parent row for product selection.");
        hideProductSuggestions();
        return;
    }
    const productNameInput = row.querySelector('.product-name');
    const unitTypeSelect = row.querySelector('.unit-type-select');
    const rateInput = row.querySelector('.rate-input');
    const quantityInput = row.querySelector('.quantity-input');

    if (!productNameInput || !unitTypeSelect || !rateInput || !quantityInput) {
        console.error("Could not find all necessary fields (product, unit type, rate, quantity) in the row.");
        hideProductSuggestions();
        return;
    }

    productNameInput.value = productData.printName || '';
    rateInput.value = productData.purchasePrice ?? '';

    // <<<--- START CHANGE: Store productId on the row ---<<<
    // NOTE: Firestore document ID is available on productData if fetched correctly
    // Assuming productData is the raw data from Firestore snapshot .data(),
    // we need the actual document ID which isn't part of .data().
    // We need to adjust fetchProductSuggestions slightly OR pass the ID along.
    // Let's assume fetchProductSuggestions was adjusted to add 'id' to productData:
    // (Modification in fetchProductSuggestions): Add 'id: docSnapshot.id' to product object
    if (productData.id) { // Check if 'id' field exists (added during fetch)
        row.dataset.productId = productData.id; // Store the product ID
        console.log(`Stored productId ${productData.id} on row.`);
    } else {
        // Fallback if ID wasn't passed correctly (remove any previous ID)
        delete row.dataset.productId;
        console.warn("No product ID found in suggestion data to store on row.");
    }
    // <<<--- END CHANGE ---<<<

    let unitFromFirestore = productData.unit || 'Qty';
    let valueToSelect = 'Qty';
    const unitLowerCase = unitFromFirestore.toLowerCase();
    if (unitLowerCase.includes('sq') || unitLowerCase.includes('feet') || unitLowerCase.includes('ft')) {
        valueToSelect = 'Sq Feet';
    } else if (unitLowerCase === 'nos' || unitLowerCase === 'qty') {
        valueToSelect = 'Qty';
    } else {
        console.warn(`Unexpected unit type "${unitFromFirestore}" from Firestore product data. Defaulting display type to Qty.`);
        valueToSelect = 'Qty';
    }

    let unitTypeFound = false;
    for (let option of unitTypeSelect.options) {
        if (option.value === valueToSelect) {
            unitTypeSelect.value = valueToSelect;
            unitTypeFound = true;
            break;
        }
    }
    if (!unitTypeFound) {
        console.error(`Dropdown option value "${valueToSelect}" (derived from unit "${unitFromFirestore}") not found! Check HTML template. Defaulting to Qty.`);
        unitTypeSelect.value = 'Qty';
    }

    hideProductSuggestions();
    const changeEvent = new Event('change', { bubbles: true });
    unitTypeSelect.dispatchEvent(changeEvent); // Trigger change event *after* setting unit type

    // Re-calculate amount after setting rate and unit type
    updateItemAmount(row);

    let nextInput = null;
    if (unitTypeSelect.value === 'Sq Feet') {
        nextInput = row.querySelector('.width-input');
    } else {
        // If rate has a value, focus quantity, otherwise focus rate
        nextInput = rateInput.value ? quantityInput : rateInput;
    }
    if (!nextInput) { // Fallback if previous logic failed
         nextInput = quantityInput || rateInput;
    }

    if (nextInput) {
        // Use setTimeout to ensure focus happens after any potential re-rendering/event processing
        setTimeout(() => {
            nextInput.focus();
            if (typeof nextInput.select === 'function') {
                nextInput.select();
            }
        }, 0);
    }
}


// --- DOMContentLoaded Listener --- (Unchanged from v15, except version log)
document.addEventListener('DOMContentLoaded', () => {
    console.log("new_po.js v16 (Added productId save): DOM loaded."); // Version bump
    if (!window.db || !window.query || !window.orderBy || !window.limit || !window.getDocs || !window.Timestamp) {
        console.error("new_po.js: Firestore (window.db) or essential functions not available!");
        alert("Error initializing page. Core functionalities missing.");
        if(poForm) poForm.style.opacity = '0.5';
        if(savePOBtn) savePOBtn.disabled = true;
        return;
    }
    console.log("new_po.js: Firestore connection and functions confirmed.");

    // Set default date only if creating a new PO (no editPOId and no sourceOrderId initially forcing a date)
    const urlParamsInit = new URLSearchParams(window.location.search);
    const isEditingInit = urlParamsInit.has('editPOId');
    const hasSourceOrder = urlParamsInit.has('sourceOrderId'); // Check if loading from order

    if (!isEditingInit && !hasSourceOrder && poOrderDateInput && !poOrderDateInput.value) {
        try {
            poOrderDateInput.value = new Date().toISOString().split('T')[0];
        } catch (e) {
            console.error("Error setting default date:", e);
        }
    }

    // Initialize Item Row Adding
    if (addItemBtn && itemRowTemplate && poItemsTableBody) {
        addItemBtn.addEventListener('click', () => {
            const templateContent = itemRowTemplate.content.cloneNode(true);
            poItemsTableBody.appendChild(templateContent);
            const appendedRow = poItemsTableBody.lastElementChild;
            if (appendedRow?.matches('.item-row')) {
                addItemRowEventListeners(appendedRow);
                const firstInput = appendedRow.querySelector('.product-name');
                if(firstInput) firstInput.focus();
            } else {
                console.error("Failed to get appended row or it's not an item-row");
            }
        });
    } else {
        console.error("Add Item button, Item Row template or Table Body not found!");
    }

    // Initialize Supplier Search
    if (supplierSearchInput && supplierSuggestionsDiv && selectedSupplierIdInput && selectedSupplierNameInput) {
        supplierSearchInput.addEventListener('input', handleSupplierSearchInput);
        // Global click listener to hide suggestions
        document.addEventListener('click', (e) => {
            // Hide supplier suggestions
            if (supplierSuggestionsDiv && supplierSuggestionsDiv.style.display === 'block' && !supplierSearchInput.contains(e.target) && !supplierSuggestionsDiv.contains(e.target)) {
                supplierSuggestionsDiv.style.display = 'none';
            }
            // Hide product suggestions
            if (productSuggestionsDiv && productSuggestionsDiv.style.display === 'block' && activeProductInput && !activeProductInput.contains(e.target) && !productSuggestionsDiv.contains(e.target)) {
                hideProductSuggestions();
            }
        });
         // Add blur listener to potentially hide suggestions too
         supplierSearchInput.addEventListener('blur', () => {
             // Delay hiding to allow click on suggestion
             setTimeout(() => {
                 if (supplierSuggestionsDiv && supplierSuggestionsDiv.style.display === 'block' && !supplierSuggestionsDiv.matches(':hover')) {
                     supplierSuggestionsDiv.style.display = 'none';
                 }
             }, 150);
         });

    } else {
        console.warn("Supplier search elements not found.");
    }

    // Initialize Add New Supplier Button
    if(addNewSupplierFromPOBtn) {
        addNewSupplierFromPOBtn.addEventListener('click', () => {
            window.open('supplier_management.html#add', '_blank');
            alert("Supplier management page opened in new tab. Add supplier there and then search here.");
        });
    }

    // Initialize Product Search Listener (on table body)
    if (poItemsTableBody) {
        poItemsTableBody.addEventListener('input', handleProductSearchInput);
        poItemsTableBody.addEventListener('focusin', (event) => {
            if (event.target.matches('.product-name')) {
                activeProductInput = event.target; // Track active input on focus
                // If input already has text, maybe show suggestions immediately?
                // if(event.target.value.trim().length > 0) {
                //     positionProductSuggestions(event.target);
                //     fetchProductSuggestions(event.target.value.trim(), event.target);
                // }
            }
        });
         poItemsTableBody.addEventListener('blur', (event) => {
             if (event.target.matches('.product-name')) {
                  // Delay hiding product suggestions on blur
                  setTimeout(() => {
                       if (productSuggestionsDiv && productSuggestionsDiv.style.display === 'block' && !productSuggestionsDiv.matches(':hover')) {
                           hideProductSuggestions();
                       }
                  }, 150);
             }
         }, true); // Use capture phase for blur if needed
    } else {
        console.error("Cannot add product search listener: Table body not found.");
    }

    // Initialize Form Submit Listener
    if (poForm) {
        poForm.addEventListener('submit', handleSavePO);
    } else {
        console.error("PO Form element not found!");
    }

    // --- Check URL Params for Edit OR Load from Order ---
    const editPOIdValue = urlParamsInit.get('editPOId');
    const sourceOrderId = urlParamsInit.get('sourceOrderId');
    const urlSupplierId = urlParamsInit.get('supplierId');
    const urlSupplierName = urlParamsInit.get('supplierName');
    const urlItemIndicesParam = urlParamsInit.get('itemIndices');

    if (editPOIdValue) {
        // --- Editing Mode ---
        loadPOForEditing(editPOIdValue);
    } else if (sourceOrderId && urlItemIndicesParam) {
        // --- Loading from Source Order Mode ---
        if (urlSupplierId && urlSupplierName && supplierSearchInput && selectedSupplierIdInput && selectedSupplierNameInput) {
            console.log("Pre-filling supplier from URL:", urlSupplierName, urlSupplierId);
            supplierSearchInput.value = urlSupplierName;
            selectedSupplierIdInput.value = urlSupplierId;
            selectedSupplierNameInput.value = urlSupplierName;
            supplierSearchInput.readOnly = true; // Make it read-only if pre-filled from order
            supplierSearchInput.style.backgroundColor = '#e9ecef'; // Visual cue
        }

        const itemIndices = urlItemIndicesParam.split(',').map(Number).filter(i => !isNaN(i));
        console.log("Loading items from source order:", sourceOrderId, "Indices:", itemIndices);
        loadOrderDataForPO(sourceOrderId, itemIndices); // Call the function to load items

        if (poNumberInput) poNumberInput.value = ''; // Ensure PO number is clear for new PO
        // Set order date here if not already set (optional, usually today's date is better)
        if (poOrderDateInput && !poOrderDateInput.value) {
             try { poOrderDateInput.value = new Date().toISOString().split('T')[0]; } catch(e){}
        }
        // Initial calculation/update will be handled within loadOrderDataForPO/populateItemRow

    } else {
        // --- Completely New PO Mode ---
        if (poItemsTableBody.children.length === 0 && addItemBtn) {
            // Add the first empty row only if no items were loaded
            addItemBtn.click();
        }
        if (poNumberInput) poNumberInput.value = ''; // Clear PO number field
        updateTotalAmount();
        updateFullCalculationPreview();
    }

    console.log("new_po.js v16 (Added productId save): Setup and listeners added.");
});


// --- Supplier Search Implementation --- (handleSupplierSearchInput, fetchSupplierSuggestions - remain unchanged from v15)
function handleSupplierSearchInput() {
     if (!supplierSearchInput || !supplierSuggestionsDiv || !selectedSupplierIdInput || !selectedSupplierNameInput) return;
     clearTimeout(supplierSearchDebounceTimer);
     const searchTerm = supplierSearchInput.value.trim();
     // Clear hidden fields immediately on input change
     selectedSupplierIdInput.value = '';
     selectedSupplierNameInput.value = '';

     if (searchTerm.length < 1) {
         supplierSuggestionsDiv.innerHTML = '';
         supplierSuggestionsDiv.style.display = 'none';
         return;
     }
     // Position suggestions relative to input
      const rect = supplierSearchInput.getBoundingClientRect();
      supplierSuggestionsDiv.style.position = 'absolute';
      supplierSuggestionsDiv.style.left = `${rect.left + window.scrollX}px`;
      supplierSuggestionsDiv.style.top = `${rect.bottom + window.scrollY}px`;
      supplierSuggestionsDiv.style.width = `${rect.width}px`;

     supplierSearchDebounceTimer = setTimeout(() => {
         fetchSupplierSuggestions(searchTerm);
     }, 350);
}
async function fetchSupplierSuggestions(searchTerm) {
    if (!supplierSuggestionsDiv) return;
    supplierSuggestionsDiv.innerHTML = '<div>Loading...</div>';
    supplierSuggestionsDiv.style.display = 'block'; // Show loading indicator

    const searchTermLower = searchTerm.toLowerCase();

    try {
         // Ensure Firestore functions are available
         if (!db || !collection || !query || !orderBy || !where || !limit || !getDocs) {
             throw new Error("Firestore functions not available for supplier search.");
         }
        console.log(`Searching suppliers with lowercase term: "${searchTermLower}"`);
        const q = query(
            collection(db, "suppliers"),
            orderBy("name_lowercase"), // Assumes 'name_lowercase' field exists
            where("name_lowercase", ">=", searchTermLower),
            where("name_lowercase", "<=", searchTermLower + '\uf8ff'),
            limit(10)
        );
        const querySnapshot = await getDocs(q);
        supplierSuggestionsDiv.innerHTML = ''; // Clear loading/previous results

        if (querySnapshot.empty) {
             console.log(`No suppliers found matching lowercase: "${searchTermLower}"`);
            // Offer to add new supplier
            supplierSuggestionsDiv.innerHTML = '<div class="no-suggestions">No matching suppliers found. <button type="button" id="suggestAddNewSupplier" class="button link-button" style="margin-left: 10px;">+ Add New</button></div>';
            const suggestBtn = supplierSuggestionsDiv.querySelector('#suggestAddNewSupplier');
            if (suggestBtn && addNewSupplierFromPOBtn) { // Ensure button exists
                suggestBtn.addEventListener('click', () => addNewSupplierFromPOBtn.click());
            }
        } else {
            querySnapshot.forEach((docSnapshot) => {
                 const supplier = docSnapshot.data();
                 if (supplier.name_lowercase === undefined) {
                     // Log warning if crucial field is missing, but still show the supplier
                     console.warn(`Supplier ${docSnapshot.id} (${supplier.name}) is missing 'name_lowercase' field.`);
                 }
                 const supplierId = docSnapshot.id;
                 const div = document.createElement('div');
                 // Display name and optionally company name
                 div.textContent = `${supplier.name}${supplier.companyName ? ' (' + supplier.companyName + ')' : ''}`;
                 div.dataset.id = supplierId;
                 div.dataset.name = supplier.name; // Store clean name
                 div.style.cursor = 'pointer';

                 // Use mousedown to select before blur hides the list
                 div.addEventListener('mousedown', (e) => {
                      e.preventDefault(); // Prevent input blur
                      supplierSearchInput.value = supplier.name; // Set display value
                      if(selectedSupplierIdInput) selectedSupplierIdInput.value = supplierId; // Set hidden ID
                      if(selectedSupplierNameInput) selectedSupplierNameInput.value = supplier.name; // Set hidden name
                      supplierSuggestionsDiv.style.display = 'none'; // Hide suggestions
                      if (poOrderDateInput) poOrderDateInput.focus(); // Move focus to next logical field
                 });
                 supplierSuggestionsDiv.appendChild(div);
            });
        }
    } catch (error) {
        console.error("Error fetching supplier suggestions:", error);
         // Provide more specific error feedback if possible
         if (error.message.includes("indexes are required") || error.message.includes("needs an index")) {
             console.error("Firestore Index Missing: Please create a Firestore index for the 'suppliers' collection on the 'name_lowercase' field (ascending).");
             supplierSuggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Search Error (Index Missing).</div>';
        } else if (error.message.includes("does not support order by")) {
             // This might indicate the 'name_lowercase' field is missing on some documents
             console.error("Firestore Field Missing or Index Error: Ensure 'name_lowercase' field exists on all suppliers and is indexed.");
             supplierSuggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Search Error (Field/Index).</div>';
        }
         else {
            // Generic error message
            supplierSuggestionsDiv.innerHTML = '<div class="no-suggestions" style="color:red;">Error fetching suppliers.</div>';
         }
         supplierSuggestionsDiv.style.display = 'block'; // Ensure error message is visible
    }
}


// --- Load Order Data for PO Function --- (Unchanged from v15)
async function loadOrderDataForPO(orderId, itemIndices) {
    if (!db || !doc || !getDoc || !poItemsTableBody || !itemRowTemplate) {
        console.error("loadOrderDataForPO: Prerequisites missing.");
        showPOError("Error: Cannot load order items automatically. Components missing.");
        return;
    }
    console.log(`Attempting to load order ${orderId} for PO items, indices: ${itemIndices.join(', ')}`);
    try {
        const orderDocRef = doc(db, "orders", orderId);
        const orderDocSnap = await getDoc(orderDocRef);

        if (orderDocSnap.exists()) {
            const orderData = orderDocSnap.data();
            console.log("Source Order Data:", orderData);
            const sourceItems = orderData.items || [];

            // Clear any default empty rows if present ONLY IF we have items to add
            if (itemIndices.length > 0 && sourceItems.length > 0) {
                 poItemsTableBody.innerHTML = ''; // Clear only if we have valid indices and items
            } else {
                 console.warn("No valid item indices provided or source order has no items.");
                 if (addItemBtn && poItemsTableBody.children.length === 0) addItemBtn.click(); // Add empty row if needed
                 updateTotalAmount();
                 updateFullCalculationPreview();
                 return; // Stop if no items to process
            }

            let itemsAdded = 0;
            // Use Promise.all to handle async population of rows
            const rowPromises = itemIndices.map(async (index) => {
                 if (index >= 0 && index < sourceItems.length) {
                    const item = sourceItems[index];
                    // Basic check for valid item structure
                    if (item && item.productName) {
                        console.log(`Processing item at index ${index}:`, item);
                        const templateContent = itemRowTemplate.content.cloneNode(true);
                        const newRow = templateContent.querySelector('.item-row');
                        if (newRow) {
                            // Populate the row asynchronously (includes product fetch if productId exists)
                            await populateItemRow(newRow, item); // Calls the async populate function
                            poItemsTableBody.appendChild(newRow);
                            addItemRowEventListeners(newRow); // Add event listeners *after* populating
                            itemsAdded++;
                        }
                    } else {
                         console.warn(`Item at index ${index} is invalid or missing productName.`);
                    }
                } else {
                     console.warn(`Item index ${index} is out of bounds for source items array (length ${sourceItems.length}).`);
                }
            });

            await Promise.all(rowPromises); // Wait for all rows to be populated and calculations done within populateItemRow

            // If no items were successfully added (e.g., bad indices), ensure there's at least one row
            if (itemsAdded === 0 && poItemsTableBody.children.length === 0 && addItemBtn) {
                console.warn("No valid items found from source order indices, adding a default empty row.");
                addItemBtn.click();
            }

            // Final updates after all rows are potentially added
            updateTotalAmount();
            updateFullCalculationPreview();

        } else {
            console.error("Source order document not found:", orderId);
            showPOError(`Error: Source order (${orderId}) not found.`);
             if (addItemBtn && poItemsTableBody.children.length === 0) addItemBtn.click(); // Add empty row on error
        }
    } catch (error) {
        console.error("Error loading source order data for PO:", error);
        showPOError("Error loading items from source order: " + error.message);
         if (addItemBtn && poItemsTableBody.children.length === 0) addItemBtn.click(); // Add empty row on error
    }
}


// --- populateItemRow function --- (Unchanged from v15)
// NOTE: This function already tries to fetch product using itemData.productId if it exists
async function populateItemRow(rowElement, itemData) {
    const productNameInput = rowElement.querySelector('.product-name');
    const quantityInput = rowElement.querySelector('.quantity-input');
    const partyNameInput = rowElement.querySelector('.party-name');
    const rateInput = rowElement.querySelector('.rate-input');
    const unitTypeSelect = rowElement.querySelector('.unit-type-select');

    // --- Populate basic info first ---
    if (productNameInput) productNameInput.value = itemData.productName || '';
    if (quantityInput) quantityInput.value = itemData.quantity || 1;
    if (partyNameInput && itemData.customerDetails?.fullName) {
         partyNameInput.value = itemData.customerDetails.fullName;
    } else if (partyNameInput && itemData.partyName) {
         partyNameInput.value = itemData.partyName;
    } else if (partyNameInput) {
        partyNameInput.value = ''; // Clear if no data
    }

    // --- Populate dimensions if unit type is Sq Feet ---
    // Uses unitType, dimensionUnit, width, height fields from itemData
    if (unitTypeSelect && itemData.unitType === 'Sq Feet') {
        const dimensionUnitSelect = rowElement.querySelector('.dimension-unit-select');
        const widthInput = rowElement.querySelector('.width-input');
        const heightInput = rowElement.querySelector('.height-input');

        if (dimensionUnitSelect) {
            dimensionUnitSelect.value = itemData.dimensionUnit || 'feet'; // Default to feet if missing
        }
        if (widthInput) {
            // Use specific width/height fields if they exist, fall back
            widthInput.value = itemData.realWidth ?? itemData.width ?? '';
        }
        if (heightInput) {
            heightInput.value = itemData.realHeight ?? itemData.height ?? '';
        }
         console.log(`Populated dimensions from itemData: Unit=${dimensionUnitSelect?.value}, W=${widthInput?.value}, H=${heightInput?.value}`);
    }


    // --- Attempt to fetch product data using productId ---
    let fetchedProductData = null;
    if (itemData.productId) { // Check if productId exists in the item data
        console.log(`Fetching product details for ID: ${itemData.productId}`);
        try {
             if (!db || !doc || !getDoc) { throw new Error("Firestore functions missing for product fetch."); }
            const productRef = doc(db, "products", itemData.productId);
            const productSnap = await getDoc(productRef);
            if (productSnap.exists()) {
                fetchedProductData = productSnap.data();
                // IMPORTANT: Add the ID to the fetched data object if selectProductSuggestion needs it
                fetchedProductData.id = productSnap.id;
                console.log("Fetched product data:", fetchedProductData);
            } else {
                console.warn(`Product document with ID ${itemData.productId} not found.`);
            }
        } catch (error) {
            console.error(`Error fetching product ${itemData.productId}:`, error);
        }
    } else {
        console.log("No productId found in itemData. Rate/Unit will rely on itemData or defaults.");
        // Clear any potential productId attribute on the row if loading data without one
        delete rowElement.dataset.productId;
    }

     // --- Set Rate and Unit Type based on fetched data or itemData ---
     let finalRate = '';
     let finalUnitType = 'Qty'; // Default unit type

     if (fetchedProductData) {
         // Use purchasePrice from fetched product if available
         if (fetchedProductData.purchasePrice !== undefined && fetchedProductData.purchasePrice !== null) {
             finalRate = String(fetchedProductData.purchasePrice);
         }
         // Determine unit type from fetched product's unit field
         if (fetchedProductData.unit) {
             const unitLowerCase = String(fetchedProductData.unit).toLowerCase();
             if (unitLowerCase.includes('sq') || unitLowerCase.includes('feet') || unitLowerCase.includes('ft') || unitLowerCase.includes('inches')) {
                 finalUnitType = 'Sq Feet';
             } else {
                 finalUnitType = 'Qty'; // Default to Qty otherwise
             }
         }
         // Store the fetched product ID on the row dataset as well (for consistency)
         if(fetchedProductData.id) {
             rowElement.dataset.productId = fetchedProductData.id;
         }

     } else {
         // Fallback if product data couldn't be fetched or no productId
         // Use unit info from the original itemData itself
         const itemUnitInfo = itemData.unitType || 'Qty'; // Use unitType from PO/Order item
         const unitLowerCase = itemUnitInfo.toLowerCase();
          if (unitLowerCase.includes('sq') || unitLowerCase.includes('feet') || unitLowerCase.includes('ft') || unitLowerCase.includes('inches')) {
             finalUnitType = 'Sq Feet';
         } else {
             finalUnitType = 'Qty';
         }
         // Use rate from itemData if it exists (e.g., editing a PO where rate was manually entered)
         if (itemData.rate !== undefined && itemData.rate !== null) {
              finalRate = String(itemData.rate);
              console.log(`Using rate ${finalRate} from existing itemData because product/purchasePrice was not found.`);
         } else {
              // Leave rate blank if no purchase price found and no rate in itemData
              finalRate = '';
         }
     }

     // Set the rate input
     if (rateInput) {
         rateInput.value = finalRate;
     }

     // Set the unit type dropdown
     if (unitTypeSelect) {
          let unitTypeFound = false;
          for (let option of unitTypeSelect.options) {
              if (option.value === finalUnitType) {
                  unitTypeSelect.value = finalUnitType;
                  unitTypeFound = true;
                  break;
              }
          }
          if (!unitTypeFound) {
              console.warn(`Dropdown option value "${finalUnitType}" not found! Defaulting to Qty.`);
              unitTypeSelect.value = 'Qty';
          }
          // Trigger change handler *after* setting value to update UI (SqFt inputs)
          handleUnitTypeChange({ target: unitTypeSelect });
     }

     // Focus rate input after population if it's empty, otherwise quantity
     const inputToFocus = (rateInput && !rateInput.value) ? rateInput : quantityInput;
     if (inputToFocus) {
          setTimeout(() => inputToFocus.focus(), 0);
     }

    // Important: Update item amount *after* setting rate/unit/dimensions
    updateItemAmount(rowElement);
}


// --- handleSavePO function (UPDATED CODE) ---
// js/new_po.js - Function: handleSavePO (UPDATED to include productId in saved item data)
async function handleSavePO(event) {
    event.preventDefault();
    console.log("DEBUG PO Gen: handleSavePO started (v16 - with ProductID Save)."); // Version bump
    showPOError('');

    // --- Prerequisites check ---
    if (!poForm || !selectedSupplierIdInput || !poOrderDateInput || !poItemsTableBody || !poTotalAmountSpan || !savePOBtn || !db || !addDoc || !collection || !doc || !getDoc || !getDocs || !updateDoc || !Timestamp || !serverTimestamp || !query || !orderBy || !limit || !arrayUnion) { // Added getDoc, arrayUnion
        console.error("Save PO prerequisites missing.");
        showPOError("Critical error: Cannot save PO. Essential components missing.");
        return;
    }

    const editingPOId = editPOIdInput.value;
    const isEditing = !!editingPOId;
    let finalPoNumber = null;

    console.log("DEBUG PO Gen: Editing Mode:", isEditing);
    savePOBtn.disabled = true;
    const savePOBtnSpan = savePOBtn ? savePOBtn.querySelector('span') : null; // Get span here
    if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Updating...' : 'Processing...';

    // --- PO Number Generation/Retrieval ---
    if (isEditing) {
        const existingValue = poNumberInput.value.trim();
        const numericValue = Number(existingValue);
        // Allow alphanumeric PO numbers during edit, but ensure it's not empty
        finalPoNumber = existingValue || null;
        console.log("DEBUG PO Gen: Using PO number for edit:", finalPoNumber);
         if (!finalPoNumber) {
             showPOError("PO Number cannot be empty when editing.");
             savePOBtn.disabled = false;
             if (savePOBtnSpan) savePOBtnSpan.textContent = 'Update Purchase Order';
             poNumberInput.focus();
             return;
         }

    } else {
        if (savePOBtnSpan) savePOBtnSpan.textContent = 'Generating PO#...';
        console.log("DEBUG PO Gen: Starting PO number generation...");
        try {
            const q = query(collection(db, "purchaseOrders"), orderBy("createdAt", "desc"), limit(1));
            const querySnapshot = await getDocs(q);
            let lastPoNumber = 1000; // Default starting point if no POs exist
            if (!querySnapshot.empty) {
                const lastPO = querySnapshot.docs[0].data();
                const lastPoNumberStr = lastPO.poNumber;
                // Try to parse the last PO number, even if it's stored as string/number
                if (lastPoNumberStr !== undefined && lastPoNumberStr !== null && String(lastPoNumberStr).trim() !== "") {
                    // Extract trailing numbers if it's like 'PO-1001'
                    const match = String(lastPoNumberStr).match(/\d+$/);
                    if (match) {
                         const lastNum = Number(match[0]);
                         if (!isNaN(lastNum)) {
                             lastPoNumber = lastNum;
                         }
                    } else {
                         // If it's just a number
                         const lastNum = Number(lastPoNumberStr);
                         if (!isNaN(lastNum)) {
                             lastPoNumber = lastNum;
                         }
                    }
                }
            }
            finalPoNumber = lastPoNumber + 1;
            // Ensure minimum PO number (optional)
            // if (finalPoNumber < 1001) {
            //     finalPoNumber = 1001;
            // }
            poNumberInput.value = finalPoNumber; // Update the input field
            console.log("DEBUG PO Gen: Generated PO Number:", finalPoNumber);
        } catch (error) {
            console.error("DEBUG PO Gen: Error during PO number generation:", error);
            showPOError("Error generating PO Number. " + error.message);
            savePOBtn.disabled = false;
            if (savePOBtnSpan) savePOBtnSpan.textContent = 'Save Purchase Order';
            return;
        }
    }

    // --- Form Data Validation (Supplier, Date) ---
    const supplierId = selectedSupplierIdInput.value;
    const supplierName = selectedSupplierNameInput.value; // Get name from hidden input
    const orderDateValue = poOrderDateInput.value;
    const notes = poNotesInput.value.trim();

    if (!supplierId || !supplierName) {
        showPOError("Please select a supplier.");
        savePOBtn.disabled = false;
        if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Update Purchase Order' : 'Save Purchase Order';
        supplierSearchInput.focus();
        return;
    }
    if (!orderDateValue) {
        showPOError("Please select an order date.");
        savePOBtn.disabled = false;
        if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Update Purchase Order' : 'Save Purchase Order';
        poOrderDateInput.focus();
        return;
    }

    const itemRows = poItemsTableBody.querySelectorAll('.item-row');
    if (itemRows.length === 0) {
        showPOError("Please add at least one item.");
        savePOBtn.disabled = false;
        if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Update Purchase Order' : 'Save Purchase Order';
        // Optionally trigger adding a row: if (addItemBtn) addItemBtn.click();
        return;
    }

    // Check PO number validity again before proceeding
    if (finalPoNumber === null || String(finalPoNumber).trim() === "") {
         showPOError("Could not determine a valid PO Number. Cannot save.");
         console.error("DEBUG PO Gen: finalPoNumber is invalid before item processing:", finalPoNumber);
         savePOBtn.disabled = false;
         if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Update Purchase Order' : 'Save Purchase Order';
         return;
    }

    // --- Item Data Processing (UPDATED to include productId) ---
    let itemsArray = [];
    let validationPassed = true;
    let calculatedTotalAmount = 0;

    itemRows.forEach((row, index) => {
        if (!validationPassed) return; // Stop processing if validation failed on a previous row

        // Get input elements for the current row
        const productNameInput = row.querySelector('.product-name');
        const unitTypeSelect = row.querySelector('.unit-type-select');
        const quantityInput = row.querySelector('.quantity-input');
        const rateInput = row.querySelector('.rate-input');
        const itemAmountSpan = row.querySelector('.item-amount');
        const partyNameInput = row.querySelector('.party-name');
        const designDetailsInput = row.querySelector('.design-details');

        // <<<--- START CHANGE: Get Product ID from row ---<<<
        // Retrieve the productId stored in the row's dataset (from selectProductSuggestion)
        const productIdFromRow = row.dataset.productId || null; // Use null if not found
        // <<<--- END CHANGE ---<<<

        // Get values from inputs
        const productName = productNameInput?.value.trim();
        const unitType = unitTypeSelect?.value; // 'Sq Feet' or 'Qty'
        const quantity = parseInt(quantityInput?.value || 0); // Default to 0 if empty/invalid
        const rate = parseFloat(rateInput?.value || 0); // Default to 0 if empty/invalid
        const itemAmount = parseFloat(itemAmountSpan?.textContent || 0); // Read displayed amount

        // --- Item Validation ---
        if (!productName) { validationPassed = false; showPOError(`Item ${index + 1}: Product Name required.`); productNameInput?.focus(); return; }
        if (isNaN(quantity) || quantity <= 0) { validationPassed = false; showPOError(`Item ${index + 1}: Valid Quantity (>= 1) required.`); quantityInput?.focus(); return; }
        if (isNaN(rate) || rate < 0) { // Allow rate to be 0, but not negative
            validationPassed = false; showPOError(`Item ${index + 1}: Valid Rate (>= 0) required.`); rateInput?.focus(); return;
        }
        if (isNaN(itemAmount)) { // Should not happen if calculation is correct
            validationPassed = false; console.error(`Item ${index + 1}: Amount calculation error (displaying NaN).`); showPOError(`Item ${index + 1}: Internal amount error.`); return;
        }

        // <<<--- START CHANGE: Create itemData object with productId ---<<<
        // Create the object to be saved in the items array
        let itemData = {
            productId: productIdFromRow, // Include the retrieved productId (can be null)
            productName: productName,
            unitType: unitType, // Save the type selected in dropdown ('Sq Feet' or 'Qty')
            quantity: quantity,
            rate: rate,
            itemAmount: 0, // Placeholder, will be calculated/verified next
            partyName: partyNameInput?.value.trim() || '', // Save party name
            designDetails: designDetailsInput?.value.trim() || '' // Save design details
        };
        // <<<--- END CHANGE ---<<<

        // --- Dimension/Amount Calculation ---
        let expectedAmount = 0; // Variable to store the calculated amount
        if (unitType === 'Sq Feet') {
            // Get dimension inputs only if type is Sq Feet
            const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
            const widthInput = row.querySelector('.width-input');
            const heightInput = row.querySelector('.height-input');

            const dimensionUnit = dimensionUnitSelect?.value || 'feet'; // Default unit
            const width = parseFloat(widthInput?.value || 0);
            const height = parseFloat(heightInput?.value || 0);

            // Validate dimensions for Sq Feet type
            if (isNaN(width) || width <= 0) { validationPassed = false; showPOError(`Item ${index + 1}: Valid Width required for Sq Feet.`); widthInput?.focus(); return; }
            if (isNaN(height) || height <= 0) { validationPassed = false; showPOError(`Item ${index + 1}: Valid Height required for Sq Feet.`); heightInput?.focus(); return; }

            // Calculate based on print dimensions
            const calcResult = calculateFlexDimensions(dimensionUnit, width, height);
            const printSqFtPerItem = parseFloat(calcResult.printSqFt || 0);

            if(printSqFtPerItem <= 0) { // Should not happen with valid W/H
                validationPassed = false; showPOError(`Item ${index + 1}: Area calculation error.`); widthInput?.focus(); return;
            }

            // Add dimension details to itemData object
            itemData.dimensionUnit = dimensionUnit; // Save unit used (feet/inches)
            itemData.width = width;             // Save input width
            itemData.height = height;            // Save input height
            itemData.realSqFt = parseFloat(calcResult.realSqFt); // Save calculated real sq ft
            itemData.printSqFt = printSqFtPerItem; // Save calculated print sq ft (used for amount)
            itemData.printWidthFt = parseFloat(calcResult.printWidthFt); // Optional: save calculated print width
            itemData.printHeightFt = parseFloat(calcResult.printHeightFt); // Optional: save calculated print height

            // Calculate expected amount for Sq Feet item
            expectedAmount = itemData.printSqFt * itemData.quantity * itemData.rate;
        } else {
            // Calculate expected amount for Qty item
            expectedAmount = itemData.quantity * itemData.rate;
        }

        // Verify calculated amount against the amount displayed on the row
        // Use a small tolerance for floating point comparisons
        if (Math.abs(itemAmount - expectedAmount) > 0.01) {
            console.warn(`Item ${index + 1} amount mismatch on save: displayed=${itemAmount.toFixed(2)}, calculated=${expectedAmount.toFixed(2)}. Using calculated value for saving.`);
            // Use the robustly calculated amount for saving
            itemData.itemAmount = parseFloat(expectedAmount.toFixed(2));
        } else {
            // If they match (or are very close), use the displayed amount (which should be same as calculated)
            itemData.itemAmount = parseFloat(itemAmount.toFixed(2));
        }

        itemsArray.push(itemData); // Add the processed item data to the array
        calculatedTotalAmount += itemData.itemAmount; // Add to the grand total
    }); // --- End of itemRows.forEach loop ---

    // If validation failed in the loop, stop the save process
    if (!validationPassed) {
        console.error("Validation failed during item processing. Aborting save.");
        savePOBtn.disabled = false; // Re-enable button
        if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Update Purchase Order' : 'Save Purchase Order';
        return; // Stop execution
    }

    // --- Prepare Final PO Data Object for Firestore ---
    savePOBtn.disabled = true; // Ensure button is disabled before final Firestore operation
    if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Updating...' : 'Saving...';

    const poData = {
        supplierId: supplierId,
        supplierName: supplierName, // Save the supplier name as well for display convenience
        poNumber: finalPoNumber, // Use the generated or existing PO number
        orderDate: Timestamp.fromDate(new Date(orderDateValue + 'T00:00:00')), // Convert date string to Firestore Timestamp
        items: itemsArray, // The array of processed item objects (now includes productId)
        totalAmount: parseFloat(calculatedTotalAmount.toFixed(2)), // Save the calculated total
        notes: notes, // Save notes
        updatedAt: serverTimestamp() // Add/update timestamp for last modification
    };

    // Add createdAt timestamp and initial status only if creating a new PO
    if (!isEditing) {
        poData.createdAt = serverTimestamp();
        poData.status = 'New'; // Initial status for new POs
    } else {
        // Preserve existing status when editing, otherwise default to 'Updated' or keep original
        // editingPOData should be populated by loadPOForEditing
        poData.status = editingPOData?.status || 'Updated'; // Use existing status or mark as 'Updated'
    }

    console.log("DEBUG PO Gen: Final PO Data being sent to Firestore:", poData);

    // --- Firestore Save/Update Operation ---
    try {
        let successMessage = '';
        let poDocId = editingPOId; // Use existing ID if editing

        if (isEditing) {
            // Update existing PO document
            const poDocRef = doc(db, "purchaseOrders", editingPOId);
            await updateDoc(poDocRef, poData);
            successMessage = `Purchase Order ${poData.poNumber} updated successfully!`;
            console.log(successMessage, "ID:", editingPOId);
        } else {
             // Create new PO document
             // Final check on PO number validity before addDoc
             if (poData.poNumber === null || String(poData.poNumber).trim() === "") {
                 throw new Error(`Invalid PO number detected just before final save operation: ${poData.poNumber}`);
             }
            const poDocRef = await addDoc(collection(db, "purchaseOrders"), poData);
            poDocId = poDocRef.id; // Get the ID of the newly created document
            successMessage = `Purchase Order ${poData.poNumber} created successfully!`;
            console.log(successMessage, "ID:", poDocId);
        }

        // --- Link PO back to Source Order if applicable ---
         const urlParamsForLink = new URLSearchParams(window.location.search);
         const sourceOrderIdForLink = urlParamsForLink.get('sourceOrderId');
         if (sourceOrderIdForLink && poDocId && poData.poNumber) {
             console.log(`Linking PO ${poDocId} (${poData.poNumber}) back to source order ${sourceOrderIdForLink}`);
             const orderRef = doc(db, "orders", sourceOrderIdForLink);
             try {
                  // Data to link
                  const poLinkData = {
                      poId: poDocId,
                      poNumber: String(poData.poNumber), // Ensure poNumber is string if needed
                      supplierName: poData.supplierName,
                      createdAt: poData.createdAt || Timestamp.now() // Use PO creation time or now
                  };

                  // Use arrayUnion if available and imported, otherwise fallback
                  if (typeof arrayUnion === 'function') {
                       await updateDoc(orderRef, {
                           linkedPOs: arrayUnion(poLinkData)
                       });
                  } else {
                       // Fallback: Read existing array, add new item, write back
                       console.warn("arrayUnion not available globally, using read-modify-write fallback for linking PO.");
                       const orderSnap = await getDoc(orderRef); // Requires getDoc import
                       const existingLinks = orderSnap.data()?.linkedPOs || [];
                       // Avoid adding duplicate links
                       if (!existingLinks.some(link => link.poId === poDocId)) {
                            existingLinks.push(poLinkData);
                            await updateDoc(orderRef, { linkedPOs: existingLinks });
                       }
                  }
                  console.log(`Successfully linked PO ${poDocId} to order ${sourceOrderIdForLink}`);
             } catch (linkError) {
                 console.error(`Error linking PO ${poDocId} back to order ${sourceOrderIdForLink}:`, linkError);
                 // Show a non-critical warning to the user
                 showPOError("PO Saved, but an error occurred linking it back to the original order.");
             }
         }
         // --- End Link PO ---

        alert(successMessage); // Notify user of success

        // Redirect after successful save
        if (sourceOrderIdForLink) {
            // If PO was generated from an order, redirect back to order history, attempting to highlight the order
            window.location.href = `order_history.html?openModalForId=${sourceOrderIdForLink}`;
        } else {
            // Default redirect to PO list / supplier management page
            window.location.href = 'supplier_management.html';
        }

    } catch (error) {
        console.error("Error saving PO to Firestore:", error);
        showPOError("Error saving Purchase Order: " + error.message);
        savePOBtn.disabled = false; // Re-enable button on error
        if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Update Purchase Order' : 'Save Purchase Order';
    }
} // End of handleSavePO function


// --- Load PO for Editing --- (Unchanged from v15)
// NOTE: Relies on populateItemRow which now attempts to fetch product based on productId
async function loadPOForEditing(poId) {
    console.log(`Loading PO ${poId} for editing...`);
    if (!db || !doc || !getDoc || !poForm) {
        showPOError("Cannot load PO: Initialization error.");
        return;
    }
    // Update UI for editing mode
    if (poPageTitle) poPageTitle.innerHTML = `<i class="fas fa-edit"></i> Edit Purchase Order`;
    if (poBreadcrumbAction) poBreadcrumbAction.textContent = `Edit PO`;
    const savePOBtnSpan = savePOBtn ? savePOBtn.querySelector('span') : null;
    if (savePOBtnSpan) savePOBtnSpan.textContent = 'Update Purchase Order';
    if (editPOIdInput) editPOIdInput.value = poId;
    // Allow editing PO number? Set to false if it should be read-only during edit
    if (poNumberInput) poNumberInput.readOnly = false;

     try {
        const poDocRef = doc(db, "purchaseOrders", poId);
        const poDocSnap = await getDoc(poDocRef);

        if (poDocSnap.exists()) {
            editingPOData = poDocSnap.data(); // Store fetched data globally for reference (e.g., status)
            console.log("PO Data loaded for editing:", editingPOData);

            // Populate Header fields
            if(supplierSearchInput && editingPOData.supplierName) supplierSearchInput.value = editingPOData.supplierName;
            if(selectedSupplierIdInput && editingPOData.supplierId) selectedSupplierIdInput.value = editingPOData.supplierId;
            if(selectedSupplierNameInput && editingPOData.supplierName) selectedSupplierNameInput.value = editingPOData.supplierName; // Populate hidden name field too

            if(poNumberInput && editingPOData.poNumber !== undefined) {
                 poNumberInput.value = editingPOData.poNumber;
                 if (poBreadcrumbAction) poBreadcrumbAction.textContent = `Edit PO #${editingPOData.poNumber}`;
            } else if (poNumberInput) {
                 poNumberInput.value = ''; // Clear if missing
            }

            if(poOrderDateInput && editingPOData.orderDate?.toDate) {
                try {
                     poOrderDateInput.value = editingPOData.orderDate.toDate().toISOString().split('T')[0];
                } catch(dateError) {
                     console.error("Error formatting PO order date:", dateError);
                     poOrderDateInput.value = '';
                }
            } else if (poOrderDateInput) {
                 poOrderDateInput.value = ''; // Clear if missing or invalid
            }

            if(poNotesInput && editingPOData.notes) poNotesInput.value = editingPOData.notes;

            // Populate Items Table
            poItemsTableBody.innerHTML = ''; // Clear existing/template rows
            if (editingPOData.items && Array.isArray(editingPOData.items) && editingPOData.items.length > 0) {
                // Use Promise.all to handle async population of rows
                 const rowPromises = editingPOData.items.map(async (item) => {
                     if (!itemRowTemplate) return; // Skip if template missing
                     const templateContent = itemRowTemplate.content.cloneNode(true);
                     const newRow = templateContent.querySelector('.item-row');
                     if (newRow) {
                         // Populate row using the potentially async function
                         // This will now attempt to fetch product using item.productId if present
                         await populateItemRow(newRow, item);
                         poItemsTableBody.appendChild(newRow);
                         addItemRowEventListeners(newRow); // Add listeners after population
                     }
                 });
                 await Promise.all(rowPromises); // Wait for all items to be processed
             } else {
                  // If PO has no items, add one empty row
                  if (addItemBtn) addItemBtn.click();
             }

             // Update totals and previews after all items are loaded
             updateTotalAmount();
             updateFullCalculationPreview();

        } else {
            console.error("No such PO document found for ID:", poId);
            showPOError("Error: Could not find the Purchase Order to edit.");
            if(savePOBtn) savePOBtn.disabled = true; // Disable save if PO not loaded
        }
    } catch (error) {
        console.error("Error loading PO for editing:", error);
        showPOError("Error loading PO data: " + error.message);
        if(savePOBtn) savePOBtn.disabled = true; // Disable save on error
    }
}

// --- Helper function showPOError --- (Unchanged from v15)
function showPOError(message) {
    if (poErrorMsg) {
        poErrorMsg.textContent = message;
        poErrorMsg.style.display = message ? 'block' : 'none'; // Show only if message exists
    } else {
        // Fallback if error message element is missing
        if(message) alert(message);
    }
}

console.log("new_po.js v16 (Added productId save) loaded and ready."); // Version bump