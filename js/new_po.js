// js/new_po.js - v2 (Save PO Logic Added)

// Assume Firebase functions are globally available via HTML script block
const {
    db, collection, doc, addDoc, getDoc, getDocs, updateDoc, serverTimestamp, Timestamp,
    query, where, limit // Make sure all needed functions are here
} = window;

// --- DOM Elements ---
const poForm = document.getElementById('poForm');
const poPageTitle = document.getElementById('poPageTitle');
const poBreadcrumbAction = document.getElementById('poBreadcrumbAction');
const editPOIdInput = document.getElementById('editPOId'); // Hidden input for editing

// Supplier Search Elements
const supplierSearchInput = document.getElementById('supplierSearchInput');
const selectedSupplierIdInput = document.getElementById('selectedSupplierId');
const selectedSupplierNameInput = document.getElementById('selectedSupplierName'); // Hidden input for name (Make sure this exists in HTML)
const supplierSuggestionsDiv = document.getElementById('supplierSuggestions');
const addNewSupplierFromPOBtn = document.getElementById('addNewSupplierFromPO'); // Button to add new supplier

// PO Detail Elements
const poNumberInput = document.getElementById('poNumberInput');
const poOrderDateInput = document.getElementById('poOrderDateInput');

// Items Table Elements
const poItemsTableBody = document.getElementById('poItemsTableBody');
const addItemBtn = document.getElementById('addItemBtn');
const itemRowTemplate = document.getElementById('item-row-template'); // Template element
const calculationPreviewArea = document.getElementById('calculationPreviewArea'); // Div for calculation results

// Summary Elements
const poNotesInput = document.getElementById('poNotesInput');
const poTotalAmountSpan = document.getElementById('poTotalAmount');

// Action Elements
const savePOBtn = document.getElementById('savePOBtn');
const savePOBtnSpan = savePOBtn ? savePOBtn.querySelector('span') : null; // Span inside save button
const poErrorMsg = document.getElementById('poErrorMsg');

// --- Global State ---
let supplierSearchDebounceTimer;
let editingPOData = null; // To store data if editing

// --- Utility Functions ---

// Function for Flex Calculation
function calculateFlexDimensions(unit, width, height) {
    console.log(`Calculating flex: Unit=${unit}, W=${width}, H=${height}`);
    const mediaWidthsFt = [3, 4, 5, 6, 8, 10];

    let wFt = (unit === 'inches') ? parseFloat(width || 0) / 12 : parseFloat(width || 0);
    let hFt = (unit === 'inches') ? parseFloat(height || 0) / 12 : parseFloat(height || 0);

    if (isNaN(wFt) || isNaN(hFt) || wFt <= 0 || hFt <= 0) {
        return { realSqFt: 0, printWidth: 0, printHeight: 0, printSqFt: 0, inputUnit: unit };
    }

    const realSqFt = wFt * hFt;
    console.log(`Real dimensions in Ft: W=${wFt}, H=${hFt}, RealSqFt=${realSqFt}`);

    // Option 1: Fit width to media
    const mediaWidthFitW = mediaWidthsFt.find(mw => mw >= wFt);
    let printWidthFt1 = mediaWidthFitW || wFt;
    let printHeightFt1 = hFt;
    let printSqFt1 = printWidthFt1 * printHeightFt1;
     if (!mediaWidthFitW) console.warn(`Width ${wFt}ft exceeds max media width. Using actual width.`);

    // Option 2: Fit height to media
    const mediaWidthFitH = mediaWidthsFt.find(mw => mw >= hFt);
    let printWidthFt2 = wFt;
    let printHeightFt2 = mediaWidthFitH || hFt;
    let printSqFt2 = printWidthFt2 * printHeightFt2;
     if (!mediaWidthFitH) console.warn(`Height ${hFt}ft exceeds max media width. Using actual height.`);

    let finalPrintWidthFt, finalPrintHeightFt, finalPrintSqFt;

    if (printSqFt1 <= printSqFt2 || !mediaWidthFitH) {
         finalPrintWidthFt = printWidthFt1;
         finalPrintHeightFt = printHeightFt1;
         finalPrintSqFt = printSqFt1;
         console.log(`Choosing Option 1: MediaW=${printWidthFt1.toFixed(2)}ft, RealH=${printHeightFt1.toFixed(2)}ft, PrintSqFt=${printSqFt1.toFixed(2)}`);
    } else {
         finalPrintWidthFt = printWidthFt2;
         finalPrintHeightFt = printHeightFt2;
         finalPrintSqFt = printSqFt2;
         console.log(`Choosing Option 2: RealW=${printWidthFt2.toFixed(2)}ft, MediaH=${printHeightFt2.toFixed(2)}ft, PrintSqFt=${printSqFt2.toFixed(2)}`);
    }

    let displayPrintWidth = (unit === 'inches') ? finalPrintWidthFt * 12 : finalPrintWidthFt;
    let displayPrintHeight = (unit === 'inches') ? finalPrintHeightFt * 12 : finalPrintHeightFt;

    return {
        realSqFt: realSqFt.toFixed(2),
        printWidth: displayPrintWidth.toFixed(2),
        printHeight: displayPrintHeight.toFixed(2),
        printSqFt: finalPrintSqFt.toFixed(2),
        inputUnit: unit
    };
}

// Function to update total amount
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

// Function to update amount for a single row
function updateItemAmount(row) {
    if (!row) return;
    const unitTypeSelect = row.querySelector('.unit-type-select');
    const amountSpan = row.querySelector('.item-amount');
    const rateInput = row.querySelector('.rate-input'); // Get rate input
    let amount = 0;
    let calcPreviewHTML = ''; // HTML for calculation preview

    try {
        const rate = parseFloat(rateInput.value) || 0; // Get rate value

        if (unitTypeSelect.value === 'Sq Feet') {
            const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
            const widthInput = row.querySelector('.width-input');
            const heightInput = row.querySelector('.height-input');

            const unit = dimensionUnitSelect.value;
            const width = parseFloat(widthInput.value) || 0;
            const height = parseFloat(heightInput.value) || 0;

            if (width > 0 && height > 0) {
                 const calcResult = calculateFlexDimensions(unit, width, height);
                 amount = (parseFloat(calcResult.printSqFt) * rate); // Use correct rate
                 calcPreviewHTML = `
                    <i>Calculation Preview:</i><br>
                    Real Area: ${calcResult.realSqFt} sq ft |
                    Print Size: ${calcResult.printWidth} x ${calcResult.printHeight} ${calcResult.inputUnit} |
                    <b>Print Area: ${calcResult.printSqFt} sq ft</b>
                    `;
            }
        } else { // 'Qty'
            const quantityInput = row.querySelector('.quantity-input');
            const quantity = parseInt(quantityInput.value) || 0;
            amount = quantity * rate; // Use correct rate
        }
    } catch (e) {
         console.error("Error calculating item amount:", e);
         amount = 0;
         calcPreviewHTML = '<i style="color:red;">Calculation Error</i>';
    }

    amountSpan.textContent = amount.toFixed(2);
     // Update preview area only if the current row is active/focused (optional enhancement)
     // For simplicity, always update based on the row passed in
     if(calculationPreviewArea) calculationPreviewArea.innerHTML = calcPreviewHTML;

    updateTotalAmount();
}

// Function to handle unit type change for a row
function handleUnitTypeChange(event) {
    const row = event.target.closest('.item-row');
    if (!row) return;

    const unitType = event.target.value;
    const sqFeetInputs = row.querySelectorAll('.sq-feet-input'); // TDs containing dimension/unit inputs
    const qtyInput = row.querySelector('.qty-input'); // TD containing quantity input
    const sqFeetHeaders = document.querySelectorAll('#poItemsTable th.sq-feet-header');
    const qtyHeader = document.querySelector('#poItemsTable th.qty-header');
    const rateInput = row.querySelector('.rate-input');

    if (unitType === 'Sq Feet') {
        sqFeetInputs.forEach(el => el.style.display = ''); // Show TDs
        if(qtyInput) qtyInput.closest('td').style.display = 'none'; // Hide Quantity TD
        // Show relevant headers
        sqFeetHeaders.forEach(th => th.classList.remove('hidden-col'));
        if(qtyHeader) qtyHeader.classList.add('hidden-col');
        if(rateInput) rateInput.placeholder = 'Rate/SqFt';
        // Clear quantity input when switching to Sq Feet
        const quantityInputField = row.querySelector('.quantity-input');
        if(quantityInputField) quantityInputField.value = '';
    } else { // 'Qty'
        sqFeetInputs.forEach(el => el.style.display = 'none'); // Hide TDs
        if(qtyInput) qtyInput.closest('td').style.display = ''; // Show Quantity TD
        // Show relevant headers
        sqFeetHeaders.forEach(th => th.classList.add('hidden-col'));
        if(qtyHeader) qtyHeader.classList.remove('hidden-col');
        if(rateInput) rateInput.placeholder = 'Rate/Unit';
         // Clear dimension inputs when switching to Qty
         const widthInput = row.querySelector('.width-input');
         const heightInput = row.querySelector('.height-input');
         if(widthInput) widthInput.value = '';
         if(heightInput) heightInput.value = '';
         if(calculationPreviewArea) calculationPreviewArea.innerHTML = ''; // Clear preview
    }

    updateItemAmount(row); // Recalculate amount
}

// Function to add event listeners to a new item row
function addItemRowEventListeners(row) {
    const unitTypeSelect = row.querySelector('.unit-type-select');
    const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
    const widthInput = row.querySelector('.width-input');
    const heightInput = row.querySelector('.height-input');
    const quantityInput = row.querySelector('.quantity-input');
    const rateInput = row.querySelector('.rate-input');
    const deleteBtn = row.querySelector('.delete-item-btn');

    if(unitTypeSelect) unitTypeSelect.addEventListener('change', handleUnitTypeChange);

    // Add listeners to inputs that affect amount calculation
    [dimensionUnitSelect, widthInput, heightInput, quantityInput, rateInput].forEach(input => {
        if (input) {
            input.addEventListener('input', () => updateItemAmount(row));
            // Optional: Update preview on focus for dimension fields
            if(input.classList.contains('dimension-input') || input.classList.contains('dimension-unit-select')) {
                input.addEventListener('focus', () => updateItemAmount(row));
            }
        }
    });

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            row.remove();
            updateTotalAmount();
            if(calculationPreviewArea) calculationPreviewArea.innerHTML = ''; // Clear preview on delete
        });
    }
     // Initial setup for visibility based on default unit type ('Qty')
     // Find the select element within the row and trigger the handler
     const initialUnitTypeSelect = row.querySelector('.unit-type-select');
     if(initialUnitTypeSelect){
        handleUnitTypeChange({ target: initialUnitTypeSelect });
     }
}


// --- Initialization on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("new_po.js: DOM loaded.");
    if (!window.db) {
        console.error("new_po.js: Firestore (window.db) not available!");
        alert("Error initializing page. Firestore connection failed.");
        return;
    }
    console.log("new_po.js: Firestore connection confirmed.");

    // Set default order date to today
     if(poOrderDateInput) {
        try {
            // Format date as YYYY-MM-DD
            const today = new Date();
            const year = today.getFullYear();
            const month = (today.getMonth() + 1).toString().padStart(2, '0');
            const day = today.getDate().toString().padStart(2, '0');
            poOrderDateInput.value = `${year}-${month}-${day}`;
        } catch (e) {
            console.error("Error setting default date:", e);
        }
     }

    // --- Add Item Row Logic ---
    if (addItemBtn && itemRowTemplate && poItemsTableBody) {
        addItemBtn.addEventListener('click', () => {
            const templateContent = itemRowTemplate.content.cloneNode(true);
            poItemsTableBody.appendChild(templateContent);
            const appendedRow = poItemsTableBody.lastElementChild;
            if (appendedRow && appendedRow.matches('.item-row')) {
                addItemRowEventListeners(appendedRow);
            } else {
                 console.error("Failed to get appended row or it's not an item-row");
            }
        });
        // Add one row initially by default
        addItemBtn.click();

    } else {
         console.error("Add Item button, Item Row template or Table Body not found!");
     }

    // --- Supplier Auto Suggest Logic ---
    if (supplierSearchInput && supplierSuggestionsDiv && selectedSupplierIdInput && selectedSupplierNameInput) {
        supplierSearchInput.addEventListener('input', handleSupplierSearchInput);
         document.addEventListener('click', (e) => {
             if (!supplierSearchInput.contains(e.target) && !supplierSuggestionsDiv.contains(e.target)) {
                 supplierSuggestionsDiv.style.display = 'none';
             }
         });
    } else {
         console.warn("Supplier search elements not found.");
     }

     // Optional: Add New Supplier Button from PO page (Opens modal on supplier_management page? Complex. Or simple link?)
     if(addNewSupplierFromPOBtn) {
        addNewSupplierFromPOBtn.addEventListener('click', () => {
            // Option 1: Simple link
            window.open('supplier_management.html#add', '_blank'); // Opens in new tab
            // Option 2: More complex - use messaging or state management if modal needs to open on same page flow.
            // Option 3: Could try to include the supplier modal HTML here too and replicate logic.
            alert("Opening supplier management page. Add supplier there and then search here.");
        });
     }


    // --- Form Submission Logic ---
    if (poForm) {
        poForm.addEventListener('submit', handleSavePO);
    } else {
         console.error("PO Form element not found!");
     }

    // --- Load PO Data if Editing ---
    const urlParams = new URLSearchParams(window.location.search);
    const editPOId = urlParams.get('editPOId');
    if (editPOId) {
        loadPOForEditing(editPOId);
    }

    console.log("new_po.js: Basic setup and listeners added.");

}); // End DOMContentLoaded


// --- Supplier Search Implementation ---
function handleSupplierSearchInput() {
     // Ensure elements exist
     if (!supplierSearchInput || !supplierSuggestionsDiv || !selectedSupplierIdInput || !selectedSupplierNameInput) return;

     console.log("Supplier search input:", supplierSearchInput.value);
     clearTimeout(supplierSearchDebounceTimer);
     const searchTerm = supplierSearchInput.value.trim();
     // Clear hidden fields if search term is cleared or selection is invalid
     selectedSupplierIdInput.value = '';
     selectedSupplierNameInput.value = '';

     if (searchTerm.length < 1) { // Allow searching from 1 character
         supplierSuggestionsDiv.innerHTML = '';
         supplierSuggestionsDiv.style.display = 'none';
         return;
     }
     supplierSearchDebounceTimer = setTimeout(() => {
         fetchSupplierSuggestions(searchTerm);
     }, 350); // Slightly longer debounce
}

async function fetchSupplierSuggestions(searchTerm) {
    console.log("Fetching suppliers matching:", searchTerm);
     if (!supplierSuggestionsDiv) return; // Ensure div exists

     supplierSuggestionsDiv.innerHTML = '<div>Loading...</div>';
     supplierSuggestionsDiv.style.display = 'block';
    try {
         const lowerTerm = searchTerm.toLowerCase(); // Prepare for potential future case-insensitive search

        // Query: Use case-sensitive prefix matching for now
        const q = query(
            collection(db, "suppliers"),
            orderBy("name"),
            where("name", ">=", searchTerm), // Firestore default search is case-sensitive
            where("name", "<=", searchTerm + '\uf8ff'),
            limit(10)
        );

        const querySnapshot = await getDocs(q);
        supplierSuggestionsDiv.innerHTML = ''; // Clear loading

        if (querySnapshot.empty) {
            supplierSuggestionsDiv.innerHTML = '<div class="no-suggestions">No matching suppliers found.</div>';
        } else {
            querySnapshot.forEach((docSnapshot) => {
                const supplier = docSnapshot.data();
                const supplierId = docSnapshot.id;
                const div = document.createElement('div');
                div.textContent = `${supplier.name}${supplier.companyName ? ' (' + supplier.companyName + ')' : ''}`;
                div.dataset.id = supplierId;
                div.dataset.name = supplier.name; // Store name

                div.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    supplierSearchInput.value = supplier.name; // Display name
                    if(selectedSupplierIdInput) selectedSupplierIdInput.value = supplierId; // Store ID
                    if(selectedSupplierNameInput) selectedSupplierNameInput.value = supplier.name; // Store Name
                    supplierSuggestionsDiv.style.display = 'none';
                    console.log("Selected Supplier:", supplier.name, "ID:", supplierId);
                    supplierSearchInput.focus(); // Keep focus maybe? Or move to next field?
                });
                supplierSuggestionsDiv.appendChild(div);
            });
        }

    } catch (error) {
        console.error("Error fetching supplier suggestions:", error);
         supplierSuggestionsDiv.innerHTML = '<div class="no-suggestions">Error fetching suppliers.</div>';
    }
}


// --- Save PO Implementation ---
async function handleSavePO(event) {
    event.preventDefault();
    console.log("Attempting to save PO...");
    showPOError(''); // Clear previous errors

    // --- Ensure prerequisites ---
    if (!poForm || !selectedSupplierIdInput || !poOrderDateInput || !poItemsTableBody || !poTotalAmountSpan || !savePOBtn || !db || !addDoc || !collection || !doc || !updateDoc || !Timestamp || !serverTimestamp) {
        console.error("Save PO prerequisites missing.");
        showPOError("Critical error: Cannot save PO. Required elements or functions missing.");
        return;
    }

    // --- 1. Gather General PO Data ---
    const supplierId = selectedSupplierIdInput.value;
    const supplierName = selectedSupplierNameInput.value; // Get name from hidden input
    const poNumber = poNumberInput.value.trim() || null;
    const orderDateValue = poOrderDateInput.value;
    const notes = poNotesInput.value.trim();
    const editingPOId = editPOIdInput.value;
    const isEditing = !!editingPOId;

    // --- 2. Validation (Basic) ---
    if (!supplierId || !supplierName) { // Check both ID and Name are stored
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
        if (isNaN(itemAmount)) { validationPassed = false; showPOError(`Item ${index + 1}: Amount error.`); return; }

        let itemData = {
            productName: productName,
            type: unitType,
            rate: rate,
            itemAmount: itemAmount // Store the final calculated item amount
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
                 console.warn(`Item ${index + 1} amount mismatch: displayed=${itemAmount}, calculated=${expectedAmount.toFixed(2)}. Using calculated.`);
                 itemData.itemAmount = parseFloat(expectedAmount.toFixed(2));
             }

        } else { // 'Qty'
            const quantityInput = row.querySelector('.quantity-input');
            const quantity = parseInt(quantityInput.value);
            if (isNaN(quantity) || quantity <= 0) {
                validationPassed = false; showPOError(`Item ${index + 1}: Valid Quantity required.`); quantityInput.focus(); return;
            }
            itemData.quantity = quantity;
             // Verify itemAmount matches calculation
             const expectedAmount = itemData.quantity * itemData.rate;
              if (Math.abs(itemAmount - expectedAmount) > 0.01) {
                  console.warn(`Item ${index + 1} amount mismatch: displayed=${itemAmount}, calculated=${expectedAmount.toFixed(2)}. Using calculated.`);
                  itemData.itemAmount = parseFloat(expectedAmount.toFixed(2));
              }
        }

        itemsArray.push(itemData);
        calculatedTotalAmount += itemData.itemAmount; // Accumulate validated/recalculated item amount

    }); // End forEach itemRow

    if (!validationPassed) {
        console.error("PO save failed due to item validation errors.");
        return;
    }

    // --- 4. Create Firestore Data Object ---
    const poData = {
        supplierId: supplierId,
        supplierName: supplierName,
        poNumber: poNumber,
        orderDate: Timestamp.fromDate(new Date(orderDateValue + 'T00:00:00')), // Ensure it's treated as start of day in local timezone, converted to Timestamp
        status: editingPOData ? editingPOData.status : 'New',
        items: itemsArray,
        totalAmount: parseFloat(calculatedTotalAmount.toFixed(2)), // Use final calculated total
        notes: notes,
        updatedAt: serverTimestamp()
    };

    if (!isEditing) {
        poData.createdAt = serverTimestamp();
        poData.status = 'New';
    }

    console.log("Final PO Data to save:", poData);

    // --- 5. Save to Firestore ---
    savePOBtn.disabled = true;
    if (savePOBtnSpan) savePOBtnSpan.textContent = 'Saving...';

    try {
        let poDocRef;
        let successMessage = '';
        if (isEditing) {
            poDocRef = doc(db, "purchaseOrders", editingPOId);
            await updateDoc(poDocRef, poData);
            successMessage = "Purchase Order updated successfully!";
            console.log(successMessage, "ID:", editingPOId);
        } else {
            poDocRef = await addDoc(collection(db, "purchaseOrders"), poData);
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


// --- Load PO for Editing Implementation ---
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
             if(poNumberInput && editingPOData.poNumber) poNumberInput.value = editingPOData.poNumber;
             if(poOrderDateInput && editingPOData.orderDate && editingPOData.orderDate.toDate) {
                const orderDate = editingPOData.orderDate.toDate();
                // Format YYYY-MM-DD for input type="date"
                poOrderDateInput.value = orderDate.toISOString().split('T')[0];
             } else if (poOrderDateInput) {
                // Fallback if date is missing or not a timestamp
                poOrderDateInput.value = '';
             }
             if(poNotesInput && editingPOData.notes) poNotesInput.value = editingPOData.notes;

             // Populate items table
             poItemsTableBody.innerHTML = ''; // Clear any default rows
             if (editingPOData.items && Array.isArray(editingPOData.items)) {
                 if (editingPOData.items.length === 0) {
                    // If no items saved, add one blank row for editing
                    if (addItemBtn) addItemBtn.click();
                 } else {
                     editingPOData.items.forEach(item => {
                         if (!itemRowTemplate || !addItemBtn) return; // Skip if template/button missing
                         const templateContent = itemRowTemplate.content.cloneNode(true);
                         poItemsTableBody.appendChild(templateContent);
                         const newRow = poItemsTableBody.lastElementChild;

                         if (newRow && newRow.matches('.item-row')) {
                             // Populate fields
                             const productNameInput = newRow.querySelector('.product-name');
                             const unitTypeSelect = newRow.querySelector('.unit-type-select');
                             const rateInput = newRow.querySelector('.rate-input');

                             if(productNameInput) productNameInput.value = item.productName || '';
                             if(unitTypeSelect) unitTypeSelect.value = item.type || 'Qty';
                             if(rateInput) rateInput.value = item.rate !== undefined ? item.rate : ''; // Handle rate possibly being 0

                             if (item.type === 'Sq Feet') {
                                const dimensionUnitSelect = newRow.querySelector('.dimension-unit-select');
                                const widthInput = newRow.querySelector('.width-input');
                                const heightInput = newRow.querySelector('.height-input');
                                if(dimensionUnitSelect) dimensionUnitSelect.value = item.unit || 'feet';
                                if(widthInput) widthInput.value = item.realWidth !== undefined ? item.realWidth : '';
                                if(heightInput) heightInput.value = item.realHeight !== undefined ? item.realHeight : '';
                             } else {
                                const quantityInput = newRow.querySelector('.quantity-input');
                                if(quantityInput) quantityInput.value = item.quantity !== undefined ? item.quantity : '';
                             }
                             // Add listeners and trigger updates for the populated row
                             addItemRowEventListeners(newRow); // Ensure listeners are attached before triggering updates
                             // handleUnitTypeChange({ target: unitTypeSelect }); // Already called in addItemRowEventListeners
                             // updateItemAmount(newRow); // Already called in handleUnitTypeChange
                         }
                     });
                 }
             } else {
                 // No items array found, add a blank row
                  if (addItemBtn) addItemBtn.click();
             }
             updateTotalAmount(); // Update final total after populating all items

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


// Helper function to display errors on PO form
function showPOError(message) {
    if (poErrorMsg) {
        poErrorMsg.textContent = message;
        poErrorMsg.style.display = message ? 'block' : 'none';
    } else {
        if(message) alert(message); // Fallback
    }
}

// --- (Placeholder for PDF Generation - Implement Later) ---
// function generatePoPdf(poData, supplierData) { ... }

console.log("new_po.js loaded and initial functions defined.");