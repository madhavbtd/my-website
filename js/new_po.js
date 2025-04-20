// js/new_po.js

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
const selectedSupplierNameInput = document.getElementById('selectedSupplierName'); // Hidden input for name
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
let poItemsData = []; // Array to hold item data temporarily (optional)
let editingPOData = null; // To store data if editing

// --- Utility Functions ---

// Function for Flex Calculation (Copy from previous discussions or create utils.js)
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
    let printWidthFt1 = mediaWidthFitW || wFt; // Use real width if wider than max roll? Check this logic.
    let printHeightFt1 = hFt;
    let printSqFt1 = printWidthFt1 * printHeightFt1;
    if (!mediaWidthFitW) console.warn(`Width ${wFt}ft exceeds max media width.`);

    // Option 2: Fit height to media
    const mediaWidthFitH = mediaWidthsFt.find(mw => mw >= hFt);
    let printWidthFt2 = wFt;
    let printHeightFt2 = mediaWidthFitH || hFt; // Use real height if taller than max roll? Check this logic.
    let printSqFt2 = printWidthFt2 * printHeightFt2;
     if (!mediaWidthFitH) console.warn(`Height ${hFt}ft exceeds max media width.`);


    let finalPrintWidthFt, finalPrintHeightFt, finalPrintSqFt;

    // Choose the option with the minimum print square footage
    if (printSqFt1 <= printSqFt2 || !mediaWidthFitH) { // Favor option 1 if equal or height doesn't fit any media
         finalPrintWidthFt = printWidthFt1;
         finalPrintHeightFt = printHeightFt1;
         finalPrintSqFt = printSqFt1;
         console.log(`Choosing Option 1: MediaW=${printWidthFt1}, RealH=${printHeightFt1}, PrintSqFt=${printSqFt1}`);
    } else { // Option 2 is better
         finalPrintWidthFt = printWidthFt2;
         finalPrintHeightFt = printHeightFt2;
         finalPrintSqFt = printSqFt2;
         console.log(`Choosing Option 2: RealW=${printWidthFt2}, MediaH=${printHeightFt2}, PrintSqFt=${printSqFt2}`);
    }

    // Convert final print dimensions back to the original unit for display
    let displayPrintWidth = (unit === 'inches') ? finalPrintWidthFt * 12 : finalPrintWidthFt;
    let displayPrintHeight = (unit === 'inches') ? finalPrintHeightFt * 12 : finalPrintHeightFt;

    return {
        realSqFt: realSqFt.toFixed(2),
        printWidth: displayPrintWidth.toFixed(2),
        printHeight: displayPrintHeight.toFixed(2),
        printSqFt: finalPrintSqFt.toFixed(2),
        inputUnit: unit // Pass back the unit used for display consistency
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
    let amount = 0;

    try {
        if (unitTypeSelect.value === 'Sq Feet') {
            const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
            const widthInput = row.querySelector('.width-input');
            const heightInput = row.querySelector('.height-input');
            const rateInput = row.querySelector('.rate-input'); // Rate per PrintSqFt

            const unit = dimensionUnitSelect.value;
            const width = parseFloat(widthInput.value) || 0;
            const height = parseFloat(heightInput.value) || 0;
            const rate = parseFloat(rateInput.value) || 0;

            // Clear preview initially
            if(calculationPreviewArea) calculationPreviewArea.innerHTML = '';

            if (width > 0 && height > 0) {
                 const calcResult = calculateFlexDimensions(unit, width, height);
                 amount = (parseFloat(calcResult.printSqFt) * rate);
                 // Show calculation preview
                 if(calculationPreviewArea) {
                    calculationPreviewArea.innerHTML = `
                    <i>Calculation Preview:</i><br>
                    Real Area: ${calcResult.realSqFt} sq ${unit === 'inches' ? 'in' : 'ft'} |
                    Print Size: ${calcResult.printWidth} x ${calcResult.printHeight} ${calcResult.inputUnit} |
                    <b>Print Area: ${calcResult.printSqFt} sq ft</b> (Rate applies to this)
                    `;
                 }
            }
        } else { // 'Qty'
            const quantityInput = row.querySelector('.quantity-input');
            const rateInput = row.querySelector('.rate-input'); // Rate per Qty Unit
            const quantity = parseInt(quantityInput.value) || 0;
            const rate = parseFloat(rateInput.value) || 0;
            amount = quantity * rate;
            // Clear preview area for Qty items
            if(calculationPreviewArea) calculationPreviewArea.innerHTML = '';
        }
    } catch (e) {
         console.error("Error calculating item amount:", e);
         amount = 0;
         if(calculationPreviewArea) calculationPreviewArea.innerHTML = '<i style="color:red;">Calculation Error</i>';
    }

    amountSpan.textContent = amount.toFixed(2);
    updateTotalAmount(); // Update grand total whenever an item amount changes
}

// Function to handle unit type change for a row
function handleUnitTypeChange(event) {
    const row = event.target.closest('.item-row');
    if (!row) return;

    const unitType = event.target.value;
    const sqFeetInputs = row.querySelectorAll('.sq-feet-input');
    const qtyInput = row.querySelector('.qty-input');
    const sqFeetHeaders = document.querySelectorAll('#poItemsTable th.sq-feet-header'); // Use querySelectorAll
    const qtyHeader = document.querySelector('#poItemsTable th.qty-header'); // Use querySelector

    if (unitType === 'Sq Feet') {
        sqFeetInputs.forEach(el => el.style.display = ''); // Show dimension/unit inputs TD
        if(qtyInput) qtyInput.style.display = 'none'; // Hide quantity input TD
        // Show relevant headers
        sqFeetHeaders.forEach(th => th.classList.remove('hidden-col'));
        if(qtyHeader) qtyHeader.classList.add('hidden-col');
    } else { // 'Qty'
        sqFeetInputs.forEach(el => el.style.display = 'none'); // Hide dimension/unit inputs TD
        if(qtyInput) qtyInput.style.display = ''; // Show quantity input TD
        // Show relevant headers
        sqFeetHeaders.forEach(th => th.classList.add('hidden-col'));
        if(qtyHeader) qtyHeader.classList.remove('hidden-col');
    }
    // Reset rate placeholder potentially
    const rateInput = row.querySelector('.rate-input');
    if(rateInput) rateInput.placeholder = (unitType === 'Sq Feet' ? 'Rate/SqFt' : 'Rate/Unit');

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
        if (input) input.addEventListener('input', () => updateItemAmount(row));
        // Also recalculate on focus out for dimensions/rate maybe?
        // if (input) input.addEventListener('focusout', () => updateItemAmount(row));
    });

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            row.remove();
            updateTotalAmount(); // Recalculate total after removing row
        });
    }
     // Initial setup for visibility based on default unit type ('Qty')
     handleUnitTypeChange({ target: unitTypeSelect }); // Simulate change event
}


// --- Initialization on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("new_po.js: DOM loaded.");

    // Check if Firestore is available (made global in HTML)
    if (!window.db) {
        console.error("new_po.js: Firestore (window.db) not available!");
        alert("Error initializing page. Firestore connection failed.");
        return;
    }
    console.log("new_po.js: Firestore connection confirmed.");

    // --- Add Item Row Logic ---
    if (addItemBtn && itemRowTemplate) {
        addItemBtn.addEventListener('click', () => {
            const newRow = itemRowTemplate.content.cloneNode(true);
            poItemsTableBody.appendChild(newRow);
            // Get the actual row element after appending
            const appendedRow = poItemsTableBody.lastElementChild;
            if (appendedRow && appendedRow.matches('.item-row')) {
                addItemRowEventListeners(appendedRow); // Add listeners to the new row
            } else {
                 console.error("Failed to get appended row or it's not an item-row");
            }
        });
         // Add one row initially? Or let user click? Let user click for now.
         // addItemBtn.click(); // Uncomment to add one row on load

    } else {
         console.error("Add Item button or Item Row template not found!");
     }

    // --- Supplier Auto Suggest Logic (Placeholder) ---
    if (supplierSearchInput && supplierSuggestionsDiv) {
        supplierSearchInput.addEventListener('input', handleSupplierSearchInput);
         // Hide suggestions when clicking outside
         document.addEventListener('click', (e) => {
             if (!supplierSearchInput.contains(e.target) && !supplierSuggestionsDiv.contains(e.target)) {
                 supplierSuggestionsDiv.style.display = 'none';
             }
         });
    }

    // --- Form Submission Logic (Placeholder) ---
    if (poForm) {
        poForm.addEventListener('submit', handleSavePO);
    }

    // --- Load PO Data if Editing (Placeholder) ---
    const urlParams = new URLSearchParams(window.location.search);
    const editPOId = urlParams.get('editPOId');
    if (editPOId) {
        console.log("Editing PO with ID:", editPOId);
        loadPOForEditing(editPOId);
    } else {
         // Set default order date to today for new POs
         if(poOrderDateInput) {
            poOrderDateInput.valueAsDate = new Date();
         }
    }

    console.log("new_po.js: Basic setup and listeners added.");

}); // End DOMContentLoaded


// --- Function Placeholders (Implement these next) ---

function handleSupplierSearchInput() {
    console.log("Supplier search input changed:", supplierSearchInput.value);
     clearTimeout(supplierSearchDebounceTimer);
     const searchTerm = supplierSearchInput.value.trim();
     if (searchTerm.length < 2) { // Only search after 2+ characters
         supplierSuggestionsDiv.innerHTML = '';
         supplierSuggestionsDiv.style.display = 'none';
         return;
     }
     supplierSearchDebounceTimer = setTimeout(() => {
         fetchSupplierSuggestions(searchTerm);
     }, 300); // Debounce
}

async function fetchSupplierSuggestions(searchTerm) {
     console.log("Fetching suppliers matching:", searchTerm);
     supplierSuggestionsDiv.innerHTML = '<div>Loading...</div>';
     supplierSuggestionsDiv.style.display = 'block';
    try {
         const lowerTerm = searchTerm.toLowerCase();
         const upperTerm = lowerTerm + '\uf8ff'; // Firestore prefix search trick

        // Query based on name - adjust field if needed
        // Case-insensitive search is tricky in Firestore, this is a basic prefix search
        const q = query(
            collection(db, "suppliers"),
            where("name", ">=", searchTerm), // Case-sensitive prefix search
            where("name", "<=", searchTerm + '\uf8ff'),
            limit(10)
            // TODO: Implement better case-insensitive search if needed (e.g., store lowercase name)
        );

        const querySnapshot = await getDocs(q);
        supplierSuggestionsDiv.innerHTML = ''; // Clear loading

        if (querySnapshot.empty) {
            supplierSuggestionsDiv.innerHTML = '<div class="no-suggestions">No matching suppliers found.</div>';
        } else {
            querySnapshot.forEach((doc) => {
                const supplier = doc.data();
                const supplierId = doc.id;
                const div = document.createElement('div');
                div.textContent = `${supplier.name} ${supplier.companyName ? '('+supplier.companyName+')' : ''}`;
                div.dataset.id = supplierId;
                div.dataset.name = supplier.name;
                div.addEventListener('click', () => {
                    supplierSearchInput.value = supplier.name;
                    selectedSupplierIdInput.value = supplierId; // Store ID
                    selectedSupplierNameInput.value = supplier.name; // Store Name
                    supplierSuggestionsDiv.style.display = 'none';
                    console.log("Selected Supplier:", supplier.name, "ID:", supplierId);
                });
                supplierSuggestionsDiv.appendChild(div);
            });
        }

    } catch (error) {
        console.error("Error fetching supplier suggestions:", error);
         supplierSuggestionsDiv.innerHTML = '<div class="no-suggestions">Error fetching suppliers.</div>';
    }
}


async function handleSavePO(event) {
    event.preventDefault();
    console.log("Attempting to save PO...");
    alert("Save PO function not fully implemented yet!"); // Replace with actual logic
    // 1. Get Supplier ID, PO Number, Date, Notes
    // 2. Loop through item rows (.item-row in poItemsTableBody)
    // 3. For each row, get product name, unit type
    // 4. Based on unit type, get qty OR dimensions/unit/rate
    // 5. If 'Sq Feet', call calculateFlexDimensions again to get final values
    // 6. Get item amount
    // 7. Create item object with all necessary fields (real/print dimensions etc. for flex)
    // 8. Add item object to an 'items' array
    // 9. Get total amount
    // 10. Create final PO data object
    // 11. Validate data
    // 12. Use addDoc or updateDoc to save to 'purchaseOrders' collection
    // 13. Handle success/error (show message, maybe call PDF generation, redirect)
}

async function loadPOForEditing(poId) {
    console.log("Loading PO data for editing:", poId);
    if (poPageTitle) poPageTitle.innerHTML = `<i class="fas fa-edit"></i> Edit Purchase Order`;
    if (poBreadcrumbAction) poBreadcrumbAction.textContent = `Edit PO (${poId.substring(0,6)}...)`;
    if (savePOBtnSpan) savePOBtnSpan.textContent = 'Update Purchase Order';
    editPOIdInput.value = poId; // Store the editing ID

    alert("Load PO for editing function not fully implemented yet!"); // Replace with actual logic
    // 1. Fetch PO document from Firestore using getDoc(doc(db, 'purchaseOrders', poId))
    // 2. Populate Supplier Search (and hidden ID/Name inputs), PO Number, Date, Notes
    // 3. Loop through the 'items' array in the fetched data
    // 4. For each item, call addItemBtn.click() to create a row
    // 5. Populate the new row's fields based on the item data (product name, unit type, qty/dimensions, rate)
    // 6. Make sure handleUnitTypeChange is called for each row to set visibility correctly
    // 7. Call updateItemAmount for each row to display correct amount
    // 8. Call updateTotalAmount once at the end
}


console.log("new_po.js loaded.");