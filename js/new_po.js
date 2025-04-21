// js/new_po.js - v3 (Auto PO Number Generation Added)

// Assume Firebase functions are globally available via HTML script block
const {
    db, collection, doc, addDoc, getDoc, getDocs, updateDoc, serverTimestamp, Timestamp,
    query, where, orderBy, limit // **** Ensure orderBy and limit are available globally ****
} = window;

// --- DOM Elements ---
const poForm = document.getElementById('poForm');
const poPageTitle = document.getElementById('poPageTitle');
const poBreadcrumbAction = document.getElementById('poBreadcrumbAction');
const editPOIdInput = document.getElementById('editPOId'); // Hidden input for editing

// Supplier Search Elements
const supplierSearchInput = document.getElementById('supplierSearchInput');
const selectedSupplierIdInput = document.getElementById('selectedSupplierId');
const selectedSupplierNameInput = document.getElementById('selectedSupplierName');
const supplierSuggestionsDiv = document.getElementById('supplierSuggestions');
const addNewSupplierFromPOBtn = document.getElementById('addNewSupplierFromPO');

// PO Detail Elements
const poNumberInput = document.getElementById('poNumberInput'); // Readonly input now
const poOrderDateInput = document.getElementById('poOrderDateInput');

// Items Table Elements
const poItemsTableBody = document.getElementById('poItemsTableBody');
const addItemBtn = document.getElementById('addItemBtn');
const itemRowTemplate = document.getElementById('item-row-template');
const calculationPreviewArea = document.getElementById('calculationPreviewArea');

// Summary Elements
const poNotesInput = document.getElementById('poNotesInput');
const poTotalAmountSpan = document.getElementById('poTotalAmount');

// Action Elements
const savePOBtn = document.getElementById('savePOBtn');
const savePOBtnSpan = savePOBtn ? savePOBtn.querySelector('span') : null;
const poErrorMsg = document.getElementById('poErrorMsg');

// --- Global State ---
let supplierSearchDebounceTimer;
let editingPOData = null; // To store data if editing

// --- Utility Functions (calculateFlexDimensions, updateTotalAmount, updateItemAmount, handleUnitTypeChange, addItemRowEventListeners) ---
// KEEP THESE FUNCTIONS AS THEY WERE IN YOUR ORIGINAL new_po.js V2
// (These functions are required for item calculation and table interaction)

// Function for Flex Calculation (Keep your existing version)
function calculateFlexDimensions(unit, width, height) {
    console.log(`Calculating flex: Unit=${unit}, W=${width}, H=${height}`);
    const mediaWidthsFt = [3, 4, 5, 6, 8, 10];
    let wFt = (unit === 'inches') ? parseFloat(width || 0) / 12 : parseFloat(width || 0);
    let hFt = (unit === 'inches') ? parseFloat(height || 0) / 12 : parseFloat(height || 0);
    if (isNaN(wFt) || isNaN(hFt) || wFt <= 0 || hFt <= 0) {
        return { realSqFt: 0, printWidth: 0, printHeight: 0, printSqFt: 0, inputUnit: unit };
    }
    const realSqFt = wFt * hFt;
    console.log(`Real dimensions in Ft: W=${wFt.toFixed(2)}, H=${hFt.toFixed(2)}, RealSqFt=${realSqFt.toFixed(2)}`);
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
    if (printSqFt1 <= printSqFt2 || !mediaWidthFitH) {
         finalPrintWidthFt = printWidthFt1; finalPrintHeightFt = printHeightFt1; finalPrintSqFt = printSqFt1;
         console.log(`Choosing Option 1: MediaW=${printWidthFt1.toFixed(2)}ft, RealH=${printHeightFt1.toFixed(2)}ft, PrintSqFt=${printSqFt1.toFixed(2)}`);
    } else {
         finalPrintWidthFt = printWidthFt2; finalPrintHeightFt = printHeightFt2; finalPrintSqFt = printSqFt2;
         console.log(`Choosing Option 2: RealW=${printWidthFt2.toFixed(2)}ft, MediaH=${printHeightFt2.toFixed(2)}ft, PrintSqFt=${printSqFt2.toFixed(2)}`);
    }
    let displayPrintWidth = (unit === 'inches') ? finalPrintWidthFt * 12 : finalPrintWidthFt;
    let displayPrintHeight = (unit === 'inches') ? finalPrintHeightFt * 12 : finalPrintHeightFt;
    return {
        realSqFt: realSqFt.toFixed(2), printWidth: displayPrintWidth.toFixed(2),
        printHeight: displayPrintHeight.toFixed(2), printSqFt: finalPrintSqFt.toFixed(2), inputUnit: unit
    };
}

// Function to update total amount (Keep your existing version)
function updateTotalAmount() {
    let total = 0;
    poItemsTableBody.querySelectorAll('.item-row').forEach(row => {
        const amountSpan = row.querySelector('.item-amount');
        total += parseFloat(amountSpan.textContent) || 0;
    });
    if (poTotalAmountSpan) {
        poTotalAmountSpan.textContent = total.toFixed(2);
    }
    console.log("Total amount updated:", total.toFixed(2));
}

// Function to update amount for a single row (Keep your existing version)
function updateItemAmount(row) {
    if (!row) return;
    const unitTypeSelect = row.querySelector('.unit-type-select');
    const amountSpan = row.querySelector('.item-amount');
    const rateInput = row.querySelector('.rate-input');
    let amount = 0;
    let calcPreviewHTML = '';
    try {
        const rate = parseFloat(rateInput.value) || 0;
        if (unitTypeSelect.value === 'Sq Feet') {
            const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
            const widthInput = row.querySelector('.width-input');
            const heightInput = row.querySelector('.height-input');
            const unit = dimensionUnitSelect.value;
            const width = parseFloat(widthInput.value) || 0;
            const height = parseFloat(heightInput.value) || 0;
            if (width > 0 && height > 0) {
                 const calcResult = calculateFlexDimensions(unit, width, height);
                 amount = (parseFloat(calcResult.printSqFt) * rate);
                 calcPreviewHTML = `<i>Calculation Preview:</i><br>Real Area: ${calcResult.realSqFt} sq ft | Print Size: ${calcResult.printWidth} x ${calcResult.printHeight} ${calcResult.inputUnit} | <b>Print Area: ${calcResult.printSqFt} sq ft</b>`;
            }
        } else { // 'Qty'
            const quantityInput = row.querySelector('.quantity-input');
            const quantity = parseInt(quantityInput.value) || 0;
            amount = quantity * rate;
        }
    } catch (e) { console.error("Error calculating item amount:", e); amount = 0; calcPreviewHTML = '<i style="color:red;">Calculation Error</i>'; }
    amountSpan.textContent = amount.toFixed(2);
    if(calculationPreviewArea && document.activeElement && (row.contains(document.activeElement) || document.activeElement === rateInput || document.activeElement === unitTypeSelect) ) {
        calculationPreviewArea.innerHTML = calcPreviewHTML;
    } else if (!calculationPreviewArea.innerHTML && calcPreviewHTML) {
        // Optionally show preview for first valid row if nothing else focused
        calculationPreviewArea.innerHTML = calcPreviewHTML;
    }
    updateTotalAmount();
}

// Function to handle unit type change for a row (Keep your existing version)
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
        const quantityInputField = row.querySelector('.quantity-input input'); // Input inside TD
        if(quantityInputField) quantityInputField.value = '';
        if(calculationPreviewArea) calculationPreviewArea.innerHTML = ''; // Clear preview initially
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
         if(calculationPreviewArea) calculationPreviewArea.innerHTML = '';
    }
    updateItemAmount(row);
}

// Function to add event listeners to a new item row (Keep your existing version)
function addItemRowEventListeners(row) {
    const unitTypeSelect = row.querySelector('.unit-type-select');
    const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
    const widthInput = row.querySelector('.width-input');
    const heightInput = row.querySelector('.height-input');
    const quantityInput = row.querySelector('.quantity-input input'); // Get the input element
    const rateInput = row.querySelector('.rate-input');
    const deleteBtn = row.querySelector('.delete-item-btn');

    if(unitTypeSelect) unitTypeSelect.addEventListener('change', handleUnitTypeChange);

    [dimensionUnitSelect, widthInput, heightInput, quantityInput, rateInput].forEach(input => {
        if (input) {
            input.addEventListener('input', () => updateItemAmount(row));
            input.addEventListener('focus', () => updateItemAmount(row)); // Update preview on focus too
        }
    });

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const wasActiveRow = row.contains(document.activeElement);
            row.remove();
            updateTotalAmount();
            // Clear preview if the deleted row was the one showing preview
            if(wasActiveRow && calculationPreviewArea) calculationPreviewArea.innerHTML = '';
            // If no rows left, clear preview
            if(poItemsTableBody.querySelectorAll('.item-row').length === 0 && calculationPreviewArea){
                 calculationPreviewArea.innerHTML = '';
            }
        });
    }
     // Initial setup for visibility based on default unit type
     const initialUnitTypeSelect = row.querySelector('.unit-type-select');
     if(initialUnitTypeSelect){
        handleUnitTypeChange({ target: initialUnitTypeSelect });
     }
}

// --- Initialization on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("new_po.js: DOM loaded.");
    if (!window.db || !window.query || !window.orderBy || !window.limit || !window.getDocs) { // Check required functions
        console.error("new_po.js: Firestore (window.db) or query functions not available!");
        alert("Error initializing page. Firestore connection or required functions failed.");
        // Optionally disable form controls
        if(poForm) poForm.style.opacity = '0.5';
        if(savePOBtn) savePOBtn.disabled = true;
        return;
    }
    console.log("new_po.js: Firestore connection and functions confirmed.");

    // Set default order date to today
     if(poOrderDateInput) {
        try {
            const today = new Date();
            poOrderDateInput.value = today.toISOString().split('T')[0]; // YYYY-MM-DD format
        } catch (e) { console.error("Error setting default date:", e); }
     }

    // --- Add Item Row Logic ---
    if (addItemBtn && itemRowTemplate && poItemsTableBody) {
        addItemBtn.addEventListener('click', () => {
            const templateContent = itemRowTemplate.content.cloneNode(true);
            poItemsTableBody.appendChild(templateContent);
            const appendedRow = poItemsTableBody.lastElementChild;
            if (appendedRow && appendedRow.matches('.item-row')) {
                addItemRowEventListeners(appendedRow);
                 // Focus the first input (product name) in the new row
                 const firstInput = appendedRow.querySelector('.product-name');
                 if(firstInput) firstInput.focus();
            } else { console.error("Failed to get appended row or it's not an item-row"); }
        });
        // Add one row initially if not editing
        const urlParams = new URLSearchParams(window.location.search);
        const editPOId = urlParams.get('editPOId');
        if (!editPOId) {
            addItemBtn.click();
        }

    } else { console.error("Add Item button, Item Row template or Table Body not found!"); }

    // --- Supplier Auto Suggest Logic ---
    if (supplierSearchInput && supplierSuggestionsDiv && selectedSupplierIdInput && selectedSupplierNameInput) {
        supplierSearchInput.addEventListener('input', handleSupplierSearchInput);
         document.addEventListener('click', (e) => {
             if (!supplierSearchInput.contains(e.target) && !supplierSuggestionsDiv.contains(e.target)) {
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
         // If creating a new PO, ensure PO number input is clear initially
         if(poNumberInput) poNumberInput.value = '';
    }

    console.log("new_po.js: Basic setup and listeners added.");

}); // End DOMContentLoaded


// --- Supplier Search Implementation (Keep your existing version) ---
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
            supplierSuggestionsDiv.innerHTML = '<div class="no-suggestions">No matching suppliers found.</div>';
        } else {
            querySnapshot.forEach((docSnapshot) => {
                const supplier = docSnapshot.data(); const supplierId = docSnapshot.id;
                const div = document.createElement('div');
                div.textContent = `${supplier.name}${supplier.companyName ? ' (' + supplier.companyName + ')' : ''}`;
                div.dataset.id = supplierId; div.dataset.name = supplier.name;
                div.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    supplierSearchInput.value = supplier.name;
                    if(selectedSupplierIdInput) selectedSupplierIdInput.value = supplierId;
                    if(selectedSupplierNameInput) selectedSupplierNameInput.value = supplier.name;
                    supplierSuggestionsDiv.style.display = 'none';
                    console.log("Selected Supplier:", supplier.name, "ID:", supplierId);
                    // Optional: Move focus to the next logical field, e.g., Order Date
                    if (poOrderDateInput) poOrderDateInput.focus();
                });
                supplierSuggestionsDiv.appendChild(div);
            });
        }
    } catch (error) {
        console.error("Error fetching supplier suggestions:", error);
         supplierSuggestionsDiv.innerHTML = '<div class="no-suggestions">Error fetching suppliers.</div>';
    }
}

// --- ***** UPDATED Save PO Implementation ***** ---
async function handleSavePO(event) {
    event.preventDefault();
    console.log("Attempting to save PO...");
    showPOError(''); // Clear previous errors

    // --- Ensure prerequisites ---
    if (!poForm || !selectedSupplierIdInput || !poOrderDateInput || !poItemsTableBody || !poTotalAmountSpan || !savePOBtn || !db || !addDoc || !collection || !doc || !updateDoc || !Timestamp || !serverTimestamp || !query || !orderBy || !limit || !getDocs) { // Added checks for query functions
        console.error("Save PO prerequisites missing.");
        showPOError("Critical error: Cannot save PO. Required elements or functions missing.");
        return;
    }

    const editingPOId = editPOIdInput.value;
    const isEditing = !!editingPOId;
    let finalPoNumber = null; // Variable to hold the final PO number

    // --- Disable button early ---
    savePOBtn.disabled = true;
    if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Updating...' : 'Processing...';


    // --- Determine PO Number ---
    if (isEditing) {
        // Use the value loaded/present in the input for editing
        // Try to keep it numeric if it came from the input as a number
        const existingValue = poNumberInput.value.trim();
        const numericValue = Number(existingValue);
        if (!isNaN(numericValue)) {
             finalPoNumber = numericValue;
        } else {
             finalPoNumber = existingValue || null; // Keep as string if not numeric or use null if empty
        }
        console.log("Using existing PO Number for edit:", finalPoNumber);
    } else {
        // --- Generate New PO Number ---
        if(savePOBtnSpan) savePOBtnSpan.textContent = 'Generating PO#...';
        console.log("Generating new PO Number...");

        try {
            const q = query(
                collection(db, "purchaseOrders"),
                orderBy("poNumber", "desc"), // Sort by poNumber numerically, descending
                limit(1) // Get only the latest one
            );
            const querySnapshot = await getDocs(q);
            let lastPoNumber = 1000; // Default to 1000 so the first one is 1001

            if (!querySnapshot.empty) {
                const lastPO = querySnapshot.docs[0].data();
                // Ensure lastPO.poNumber is treated as a number
                const lastNum = Number(lastPO.poNumber);
                // Check if it's a valid number and >= 1000 (or your starting logic)
                if (!isNaN(lastNum) && lastNum >= 1000) {
                    lastPoNumber = lastNum;
                } else {
                     console.warn("Last PO number wasn't a valid number >= 1000, restarting sequence from 1001.", lastPO.poNumber);
                     // Default lastPoNumber remains 1000
                }
            } else {
                 console.log("No existing POs found, starting sequence from 1001.");
                 // Default lastPoNumber remains 1000
            }

            finalPoNumber = lastPoNumber + 1;
            poNumberInput.value = finalPoNumber; // Display the generated number in the readonly field
            console.log("Generated PO Number:", finalPoNumber);

        } catch (error) {
             console.error("Error generating PO number:", error);
             showPOError("Error generating PO Number. Cannot save. " + error.message);
             savePOBtn.disabled = false; // Re-enable on error
             if (savePOBtnSpan) savePOBtnSpan.textContent = 'Save Purchase Order';
             return; // Stop saving process
        }
        // --- End Generate New PO Number ---
    }

     // --- Re-enable button momentarily for user feedback IF validation fails later ---
     // We will disable it again just before the final save action if validation passes
     savePOBtn.disabled = false;
     if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Update Purchase Order' : 'Save Purchase Order';


    // --- 1. Gather General PO Data (Supplier, Date, Notes) ---
    const supplierId = selectedSupplierIdInput.value;
    const supplierName = selectedSupplierNameInput.value; // Get name from hidden input
    const orderDateValue = poOrderDateInput.value;
    const notes = poNotesInput.value.trim();
    // finalPoNumber is already determined above

    // --- 2. Basic Validation ---
    if (!supplierId || !supplierName) {
        showPOError("Please select a supplier from the suggestions.");
        supplierSearchInput.focus();
        return;
    }
    if (!orderDateValue) {
        showPOError("Please select an order date.");
        poOrderDateInput.focus();
        return;
    }
    const itemRows = poItemsTableBody.querySelectorAll('.item-row');
    if (itemRows.length === 0) {
        showPOError("Please add at least one item to the purchase order.");
        return;
    }
    // PO number validation is implicitly handled by generation/edit logic

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

        const productName = productNameInput.value.trim();
        const unitType = unitTypeSelect.value;
        const rate = parseFloat(rateInput.value);
        const itemAmount = parseFloat(itemAmountSpan.textContent); // Get amount displayed

        // Validate common fields
        if (!productName) { validationPassed = false; showPOError(`Item ${index + 1}: Product Name required.`); productNameInput.focus(); return; }
        if (isNaN(rate) || rate < 0) { validationPassed = false; showPOError(`Item ${index + 1}: Valid Rate required.`); rateInput.focus(); return; }
        if (isNaN(itemAmount)) { validationPassed = false; showPOError(`Item ${index + 1}: Amount calculation error.`); return; } // Check calculated amount

        let itemData = {
            productName: productName,
            type: unitType,
            rate: rate,
            itemAmount: itemAmount // Store the final calculated item amount (will be verified below)
        };

        if (unitType === 'Sq Feet') {
            const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
            const widthInput = row.querySelector('.width-input');
            const heightInput = row.querySelector('.height-input');
            const unit = dimensionUnitSelect.value;
            const width = parseFloat(widthInput.value);
            const height = parseFloat(heightInput.value);

            if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0) {
                validationPassed = false; showPOError(`Item ${index + 1}: Valid Width & Height required.`); widthInput.focus(); return;
            }
            // Recalculate final values on save
            const calcResult = calculateFlexDimensions(unit, width, height);
            if(parseFloat(calcResult.printSqFt) <= 0) { // Additional check
                 validationPassed = false; showPOError(`Item ${index + 1}: Calculation error (invalid dimensions?).`); widthInput.focus(); return;
            }

            itemData.unit = unit;
            itemData.realWidth = width; // Store original input
            itemData.realHeight = height; // Store original input
            itemData.realSqFt = parseFloat(calcResult.realSqFt);
            itemData.printWidth = parseFloat(calcResult.printWidth);   // In original unit
            itemData.printHeight = parseFloat(calcResult.printHeight); // In original unit
            itemData.printSqFt = parseFloat(calcResult.printSqFt);     // In sq ft

            // Verify itemAmount matches calculation
            const expectedAmount = itemData.printSqFt * itemData.rate;
             if (Math.abs(itemAmount - expectedAmount) > 0.01) {
                 console.warn(`Item ${index + 1} SqFt amount mismatch: displayed=${itemAmount}, calculated=${expectedAmount.toFixed(2)}. Using calculated.`);
                 itemData.itemAmount = parseFloat(expectedAmount.toFixed(2)); // CORRECTED AMOUNT USED
             } else {
                  itemData.itemAmount = parseFloat(itemAmount.toFixed(2)); // Use displayed if close enough
             }

        } else { // 'Qty'
            const quantityInput = row.querySelector('.quantity-input input'); // Get input within TD
            const quantity = parseInt(quantityInput.value);
            if (isNaN(quantity) || quantity <= 0) {
                validationPassed = false; showPOError(`Item ${index + 1}: Valid Quantity required.`); quantityInput.focus(); return;
            }
            itemData.quantity = quantity;
             // Verify itemAmount matches calculation
             const expectedAmount = itemData.quantity * itemData.rate;
              if (Math.abs(itemAmount - expectedAmount) > 0.01) {
                  console.warn(`Item ${index + 1} Qty amount mismatch: displayed=${itemAmount}, calculated=${expectedAmount.toFixed(2)}. Using calculated.`);
                  itemData.itemAmount = parseFloat(expectedAmount.toFixed(2)); // CORRECTED AMOUNT USED
              } else {
                   itemData.itemAmount = parseFloat(itemAmount.toFixed(2)); // Use displayed if close enough
              }
        }

        itemsArray.push(itemData);
        calculatedTotalAmount += itemData.itemAmount; // Accumulate validated/recalculated item amount

    }); // End forEach itemRow

    if (!validationPassed) {
        console.error("PO save failed due to item validation errors.");
        // Button is already re-enabled above
        return;
    }

    // --- Disable button again before final save ---
    savePOBtn.disabled = true;
    if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Updating...' : 'Saving...';

    // --- 4. Create Firestore Data Object ---
    const poData = {
        supplierId: supplierId,
        supplierName: supplierName, // Keep supplier name for easier display later
        poNumber: finalPoNumber, // Use the generated or existing number (MUST be Number type for sorting/incrementing)
        orderDate: Timestamp.fromDate(new Date(orderDateValue + 'T00:00:00')), // Use Timestamp, treat date as start of day local
        items: itemsArray,
        totalAmount: parseFloat(calculatedTotalAmount.toFixed(2)), // Use final calculated total
        notes: notes,
        updatedAt: serverTimestamp() // Update timestamp
    };

    // Add createdAt and status only if creating a new PO
    if (!isEditing) {
        poData.createdAt = serverTimestamp();
        poData.status = 'New'; // Set default status for new PO
    } else {
        // Keep the existing status when editing (or update if you add status change controls)
         poData.status = editingPOData ? editingPOData.status : 'New'; // Fallback needed if editingPOData failed load
    }


    console.log("Final PO Data to save:", poData);

    // --- 5. Save to Firestore ---
    try {
        let poDocRef;
        let successMessage = '';
        if (isEditing) {
            poDocRef = doc(db, "purchaseOrders", editingPOId);
            await updateDoc(poDocRef, poData); // Use updateDoc for edits
            successMessage = "Purchase Order updated successfully!";
            console.log(successMessage, "ID:", editingPOId);
        } else {
            // Ensure the PO number is indeed a number before adding
            if (typeof poData.poNumber !== 'number' || isNaN(poData.poNumber)) {
                 throw new Error("Generated PO number is not a valid number before saving.");
            }
            poDocRef = await addDoc(collection(db, "purchaseOrders"), poData); // Use addDoc for new POs
            successMessage = "Purchase Order saved successfully!";
            console.log(successMessage, "ID:", poDocRef.id);
        }
        alert(successMessage);

        // Redirect back to the management page
        window.location.href = 'supplier_management.html';

    } catch (error) {
        console.error("Error saving Purchase Order: ", error);
        showPOError("Error saving PO: " + error.message);
        savePOBtn.disabled = false; // Re-enable button on error
        if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Update Purchase Order' : 'Save Purchase Order';
    }
}
// --- ***** END UPDATED Save PO Implementation ***** ---


// --- Load PO for Editing Implementation (Keep your existing version, ensure it populates the readonly poNumberInput) ---
async function loadPOForEditing(poId) {
    console.log("Loading PO data for editing:", poId);
     if (!db || !doc || !getDoc || !poForm) {
         showPOError("Cannot load PO for editing. Initialization error.");
         return;
     }

    // Update UI for edit mode
    if (poPageTitle) poPageTitle.innerHTML = `<i class="fas fa-edit"></i> Edit Purchase Order`;
    if (poBreadcrumbAction) poBreadcrumbAction.textContent = `Edit PO`;
    if (savePOBtnSpan) savePOBtnSpan.textContent = 'Update Purchase Order';
    editPOIdInput.value = poId; // Store the editing ID
    if(poNumberInput) poNumberInput.readOnly = false; // *** Allow editing PO number if desired *** (Or keep readonly if you NEVER want it changed)

    try {
         const poDocRef = doc(db, "purchaseOrders", poId);
         const poDocSnap = await getDoc(poDocRef);

         if (poDocSnap.exists()) {
             editingPOData = poDocSnap.data(); // Store fetched data
             console.log("PO Data loaded:", editingPOData);

             // Populate main form fields
             if(supplierSearchInput && editingPOData.supplierName) supplierSearchInput.value = editingPOData.supplierName;
             if(selectedSupplierIdInput && editingPOData.supplierId) selectedSupplierIdInput.value = editingPOData.supplierId;
             if(selectedSupplierNameInput && editingPOData.supplierName) selectedSupplierNameInput.value = editingPOData.supplierName;
             // *** Populate PO Number field ***
             if(poNumberInput && editingPOData.poNumber !== undefined && editingPOData.poNumber !== null) {
                 poNumberInput.value = editingPOData.poNumber;
             } else if (poNumberInput) {
                  poNumberInput.value = ''; // Clear if null/undefined in DB
             }
             // ******************************
             if(poOrderDateInput && editingPOData.orderDate && editingPOData.orderDate.toDate) {
                const orderDate = editingPOData.orderDate.toDate();
                poOrderDateInput.value = orderDate.toISOString().split('T')[0];
             } else if (poOrderDateInput) { poOrderDateInput.value = ''; }
             if(poNotesInput && editingPOData.notes) poNotesInput.value = editingPOData.notes;

             // Populate items table
             poItemsTableBody.innerHTML = ''; // Clear any default rows
             if (editingPOData.items && Array.isArray(editingPOData.items)) {
                 if (editingPOData.items.length === 0) {
                    if (addItemBtn) addItemBtn.click(); // Add blank row if saved with no items
                 } else {
                     editingPOData.items.forEach(item => {
                         if (!itemRowTemplate || !addItemBtn) return;
                         const templateContent = itemRowTemplate.content.cloneNode(true);
                         poItemsTableBody.appendChild(templateContent);
                         const newRow = poItemsTableBody.lastElementChild;
                         if (newRow && newRow.matches('.item-row')) {
                             // Populate fields (productName, unitType, rate, dimensions/qty)
                             // ... (Your existing item population logic here) ...
                             const productNameInput = newRow.querySelector('.product-name');
                             const unitTypeSelect = newRow.querySelector('.unit-type-select');
                             const rateInput = newRow.querySelector('.rate-input');
                             if(productNameInput) productNameInput.value = item.productName || '';
                             if(unitTypeSelect) unitTypeSelect.value = item.type || 'Qty';
                             if(rateInput) rateInput.value = item.rate !== undefined ? item.rate : '';
                             if (item.type === 'Sq Feet') {
                                const dimensionUnitSelect = newRow.querySelector('.dimension-unit-select');
                                const widthInput = newRow.querySelector('.width-input');
                                const heightInput = newRow.querySelector('.height-input');
                                if(dimensionUnitSelect) dimensionUnitSelect.value = item.unit || 'feet';
                                if(widthInput) widthInput.value = item.realWidth !== undefined ? item.realWidth : '';
                                if(heightInput) heightInput.value = item.realHeight !== undefined ? item.realHeight : '';
                             } else {
                                const quantityInput = newRow.querySelector('.quantity-input input'); // Get input
                                if(quantityInput) quantityInput.value = item.quantity !== undefined ? item.quantity : '';
                             }
                             addItemRowEventListeners(newRow); // Attach listeners
                             // Amount will be recalculated by listeners/updates
                         }
                     });
                 }
             } else { // No items array found
                  if (addItemBtn) addItemBtn.click();
             }
             updateTotalAmount(); // Update final total after populating

         } else {
             console.error("No such PO document!");
             showPOError("Error: Could not find the Purchase Order to edit.");
             if(savePOBtn) savePOBtn.disabled = true; // Disable save if load fails
         }
     } catch (error) {
         console.error("Error loading PO for editing:", error);
         showPOError("Error loading PO data: " + error.message);
          if(savePOBtn) savePOBtn.disabled = true; // Disable save if load fails
     }
}


// Helper function to display errors on PO form (Keep your existing version)
function showPOError(message) {
    if (poErrorMsg) {
        poErrorMsg.textContent = message;
        poErrorMsg.style.display = message ? 'block' : 'none';
    } else {
        if(message) alert(message); // Fallback
    }
}

console.log("new_po.js loaded and initial functions defined.");