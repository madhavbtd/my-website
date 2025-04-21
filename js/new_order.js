// js/new_po.js - v4 (Auto PO Number Generation Added)

// --- Global Firestore Functions (Made available by new_po.html script) ---
const {
    db, collection, doc, addDoc, getDoc, getDocs, updateDoc, serverTimestamp, Timestamp,
    query, where, orderBy, limit
} = window; // Access globally defined functions

// --- DOM Elements ---
const poForm = document.getElementById('poForm');
const poPageTitle = document.getElementById('poPageTitle');
const poBreadcrumbAction = document.getElementById('poBreadcrumbAction');
const editPOIdInput = document.getElementById('editPOId'); // Hidden input for edit mode
const supplierSearchInput = document.getElementById('supplierSearchInput');
const selectedSupplierIdInput = document.getElementById('selectedSupplierId');
const selectedSupplierNameInput = document.getElementById('selectedSupplierName');
const supplierSuggestionsDiv = document.getElementById('supplierSuggestions');
const poNumberInput = document.getElementById('poNumberInput'); // PO Number Field
const poOrderDateInput = document.getElementById('poOrderDateInput');
const poItemsTableBody = document.getElementById('poItemsTableBody');
const itemRowTemplate = document.getElementById('item-row-template');
const addItemBtn = document.getElementById('addItemBtn');
const calculationPreviewArea = document.getElementById('calculationPreviewArea');
const poNotesInput = document.getElementById('poNotesInput');
const poTotalAmountSpan = document.getElementById('poTotalAmount');
const savePOBtn = document.getElementById('savePOBtn');
const poErrorMsg = document.getElementById('poErrorMsg');
const addNewSupplierFromPOBtn = document.getElementById('addNewSupplierFromPO');

let currentEditingPOId = null;
let supplierSearchTimeout = null;
let itemsDataCache = []; // Cache item details for calculation preview

// Import calculation function if needed elsewhere (assuming it's mainly for PDF now)
// import { calculateFlexDimensions } from './utils.js';
// Make calculateFlexDimensions available globally if needed by utils.js used via script tag
// window.calculateFlexDimensions = calculateFlexDimensions; // Not ideal, but works with current utils.js


// --- Function to Generate Next PO Number ---
async function generateNextPoNumber() {
    if (!poNumberInput) return; // Ensure element exists
    poNumberInput.value = "Generating..."; // Show loading state

    // Query Firestore for the PO with the highest poNumber
    // Option 1: Assuming poNumber is stored as a string like "1001", "1002"
    // String sort might work for a limited range, but number sort is safer.
    // Option 2: Sort by creation time to get the latest physically created PO. Often PO numbers increase with time.
    // Let's try sorting by 'poNumber' field descending first. Ensure it's indexed in Firestore.
    // If 'poNumber' is not numeric, string sort "999" > "1000". If numeric, 1000 > 999.

    const q = query(
        collection(db, "purchaseOrders"),
        orderBy("poNumber", "desc"), // TRY THIS FIRST: Assumes poNumber might be number or string sort works
        // orderBy("createdAt", "desc"), // ALTERNATIVE: If poNumber sort is unreliable
        limit(1)
    );

    try {
        const querySnapshot = await getDocs(q);
        let nextPoNumber = 1001; // Default starting number

        if (!querySnapshot.empty) {
            const lastPO = querySnapshot.docs[0].data();
            const lastPoNumberStr = lastPO.poNumber; // Get the last PO number string/number

            if (lastPoNumberStr) {
                const lastPoNumberInt = parseInt(lastPoNumberStr, 10);
                if (!isNaN(lastPoNumberInt)) {
                    nextPoNumber = lastPoNumberInt + 1;
                } else {
                    console.warn(`Last PO Number "${lastPoNumberStr}" is not a valid integer. Falling back to default.`);
                    // Fallback logic? Maybe try sorting by createdAt if number fails?
                }
            } else {
                 console.warn("Last PO found but has no 'poNumber' field. Falling back.");
            }
        } else {
            console.log("No existing POs found. Starting with PO number 1001.");
        }

        poNumberInput.value = nextPoNumber.toString(); // Display the generated number

    } catch (error) {
        console.error("Error generating PO number:", error);
        poNumberInput.value = "Error"; // Indicate error
        showPOError("Could not generate PO Number. Please check connection or try again.");
        // Optionally disable form submission if PO number fails?
        // savePOBtn.disabled = true;
    }
}


// --- Supplier Search Functionality ---
async function searchSuppliers(searchTerm) {
    if (!db || !collection || !query || !where || !orderBy || !getDocs) {
         console.error("Firestore functions not available for supplier search."); return;
    }
    if (searchTerm.length < 1) { supplierSuggestionsDiv.style.display = 'none'; return; }

    supplierSuggestionsDiv.innerHTML = '<div><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
    supplierSuggestionsDiv.style.display = 'block';

    try {
        // Basic prefix search (case-sensitive in Firestore default index)
        // For case-insensitive, store a lowercase version or use more advanced search
        const q = query(collection(db, "suppliers"),
                      orderBy("name"), // Order results
                      where("name", ">=", searchTerm),
                      where("name", "<=", searchTerm + '\uf8ff'), // Firestore prefix trick
                      limit(10)); // Limit results

        const querySnapshot = await getDocs(q);
        supplierSuggestionsDiv.innerHTML = ''; // Clear previous results
        if (querySnapshot.empty) {
            supplierSuggestionsDiv.innerHTML = '<div>No suppliers found.</div>';
        } else {
            querySnapshot.forEach((doc) => {
                const supplier = doc.data();
                const div = document.createElement('div');
                div.textContent = `${supplier.name} (${supplier.companyName || 'N/A'})`;
                div.dataset.id = doc.id;
                div.dataset.name = supplier.name;
                div.addEventListener('click', () => {
                    supplierSearchInput.value = supplier.name; // Display selected name
                    selectedSupplierIdInput.value = doc.id;     // Store ID
                    selectedSupplierNameInput.value = supplier.name; // Store Name
                    supplierSuggestionsDiv.style.display = 'none'; // Hide suggestions
                });
                supplierSuggestionsDiv.appendChild(div);
            });
        }
    } catch (error) {
        console.error("Error searching suppliers:", error);
        supplierSuggestionsDiv.innerHTML = '<div class="error-message">Error searching.</div>';
    }
}

// Debounce supplier search input
if (supplierSearchInput) {
    supplierSearchInput.addEventListener('keyup', (event) => {
        clearTimeout(supplierSearchTimeout);
        const searchTerm = event.target.value.trim();
        // Clear hidden fields if input is cleared
        if (!searchTerm) {
             selectedSupplierIdInput.value = '';
             selectedSupplierNameInput.value = '';
             supplierSuggestionsDiv.style.display = 'none';
             return;
        }
        // Reset hidden ID if user types something new after selecting
        selectedSupplierIdInput.value = '';
        selectedSupplierNameInput.value = '';

        supplierSearchTimeout = setTimeout(() => {
            searchSuppliers(searchTerm);
        }, 300); // Wait 300ms after typing stops
    });
    // Hide suggestions if clicked outside
    document.addEventListener('click', (event) => {
        if (!supplierSearchInput.contains(event.target) && !supplierSuggestionsDiv.contains(event.target)) {
            supplierSuggestionsDiv.style.display = 'none';
        }
    });
}

// Navigate to add supplier page (or open modal if implemented differently)
if (addNewSupplierFromPOBtn) {
    addNewSupplierFromPOBtn.addEventListener('click', () => {
        // Redirect to supplier management page with a flag to open the modal
        window.location.href = 'supplier_management.html#add';
    });
}

// --- Item Row Management ---
function addItemRow() {
    if (!itemRowTemplate || !poItemsTableBody) return;
    const templateContent = itemRowTemplate.content.cloneNode(true);
    poItemsTableBody.appendChild(templateContent);
    const newRow = poItemsTableBody.lastElementChild;
    attachRowListeners(newRow);
    updateItemsUI(); // Update visibility based on initial state
    updateTotalAmount(); // Update total when row added (likely 0 initially)
}

function deleteItemRow(button) {
    const row = button.closest('.item-row');
    if (row) {
        row.remove();
        updateTotalAmount(); // Recalculate total after deletion
        updateCalculationPreview(); // Update preview after deletion
    }
}

function attachRowListeners(row) {
    // Delete button
    const deleteBtn = row.querySelector('.delete-item-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => deleteItemRow(deleteBtn));
    }

    // Inputs that affect amount or preview
    const inputs = row.querySelectorAll('.unit-type-select, .dimension-input, .dimension-unit-select, .quantity-input, .rate-input');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            calculateItemAmount(row); // Recalculate item amount on change
            updateCalculationPreview(); // Update preview on change
        });
        input.addEventListener('change', () => { // Also handle change for selects/blur
            calculateItemAmount(row);
            updateCalculationPreview();
        });
    });

    // Unit Type Select specific logic
    const unitTypeSelect = row.querySelector('.unit-type-select');
    if (unitTypeSelect) {
        unitTypeSelect.addEventListener('change', () => updateItemsUI(row));
    }
    // Ensure initial state is correct
    updateItemsUI(row);
}

// Update UI elements based on Unit Type (Sq Feet vs Qty)
function updateItemsUI(row = null) {
    const rowsToUpdate = row ? [row] : poItemsTableBody.querySelectorAll('.item-row');
    const isAnySqFeet = Array.from(poItemsTableBody.querySelectorAll('.unit-type-select')).some(sel => sel.value === 'Sq Feet');

    // Update table headers visibility
    const sqFeetHeaders = document.querySelectorAll('.sq-feet-header');
    sqFeetHeaders.forEach(th => th.style.display = isAnySqFeet ? '' : 'none');
    document.querySelector('.qty-header').style.display = ''; // Always show Qty header for now

    rowsToUpdate.forEach(r => {
        const unitType = r.querySelector('.unit-type-select').value;
        const sqFeetInputs = r.querySelectorAll('.sq-feet-input');
        const qtyInput = r.querySelector('.qty-input');
        const widthInput = r.querySelector('.width-input');
        const heightInput = r.querySelector('.height-input');
        const quantityInput = r.querySelector('.quantity-input');

        if (unitType === 'Sq Feet') {
            sqFeetInputs.forEach(el => el.style.display = '');
            qtyInput.style.display = 'none';
            // Make dimension inputs required, quantity not required
            widthInput?.setAttribute('required', '');
            heightInput?.setAttribute('required', '');
            quantityInput?.removeAttribute('required');
            quantityInput.value = ''; // Clear quantity if switching to Sq Feet
        } else { // Qty
            sqFeetInputs.forEach(el => el.style.display = 'none');
            qtyInput.style.display = '';
            // Make quantity required, dimensions not required
            widthInput?.removeAttribute('required');
            heightInput?.removeAttribute('required');
            quantityInput?.setAttribute('required', '');
            widthInput.value = ''; // Clear dimensions if switching to Qty
            heightInput.value = '';
        }
    });
}


// --- Calculation Logic ---

// Calculates amount for a single item row and updates its display
function calculateItemAmount(row) {
    const unitType = row.querySelector('.unit-type-select').value;
    const rateInput = row.querySelector('.rate-input');
    const rate = parseFloat(rateInput.value) || 0;
    const itemAmountSpan = row.querySelector('.item-amount');
    let itemAmount = 0;

    // Basic validation: Rate is required
    if (rate <= 0) {
         rateInput.style.borderColor = 'red'; // Highlight error
    } else {
         rateInput.style.borderColor = ''; // Clear error highlight
    }

    if (unitType === 'Sq Feet') {
        const widthInput = row.querySelector('.width-input');
        const heightInput = row.querySelector('.height-input');
        const unitSelect = row.querySelector('.dimension-unit-select');
        const width = parseFloat(widthInput.value) || 0;
        const height = parseFloat(heightInput.value) || 0;
        const unit = unitSelect.value;

        // Basic validation: Dimensions required for Sq Feet
        let validDims = true;
        if (width <= 0) { widthInput.style.borderColor = 'red'; validDims = false; } else { widthInput.style.borderColor = ''; }
        if (height <= 0) { heightInput.style.borderColor = 'red'; validDims = false; } else { heightInput.style.borderColor = ''; }

        if (rate > 0 && validDims) {
            // Use calculateFlexDimensions (ensure it's loaded/available)
            if (typeof calculateFlexDimensions === 'function') {
                 const calcResult = calculateFlexDimensions(unit, width, height);
                 const finalSqFt = parseFloat(calcResult.printSqFt) || 0; // Use calculated printSqFt
                 itemAmount = finalSqFt * rate;
            } else {
                 console.warn("calculateFlexDimensions function not found. Using basic W*H.");
                 // Fallback basic calculation (less accurate)
                 let wFt = (unit === 'inches') ? width / 12 : width;
                 let hFt = (unit === 'inches') ? height / 12 : height;
                 itemAmount = wFt * hFt * rate;
            }
        }

    } else { // Qty
        const quantityInput = row.querySelector('.quantity-input');
        const quantity = parseInt(quantityInput.value) || 0;

        // Basic validation: Quantity required
        if (quantity <= 0) { quantityInput.style.borderColor = 'red'; } else { quantityInput.style.borderColor = ''; }

        if (rate > 0 && quantity > 0) {
            itemAmount = quantity * rate;
        }
    }

    itemAmountSpan.textContent = itemAmount.toFixed(2);
    updateTotalAmount(); // Update overall total whenever an item amount changes
}

// Update the grand total amount display
function updateTotalAmount() {
    let total = 0;
    poItemsTableBody.querySelectorAll('.item-row').forEach(row => {
        const itemAmount = parseFloat(row.querySelector('.item-amount').textContent) || 0;
        total += itemAmount;
    });
    poTotalAmountSpan.textContent = total.toFixed(2);
}

// Update the calculation preview area
function updateCalculationPreview() {
    if (!calculationPreviewArea) return;
    itemsDataCache = []; // Clear cache
    let previewHtml = '<h4>Calculation Preview:</h4>';
    let hasContent = false;

    poItemsTableBody.querySelectorAll('.item-row').forEach((row, index) => {
        const productName = row.querySelector('.product-name').value || `Item ${index + 1}`;
        const unitType = row.querySelector('.unit-type-select').value;
        const rate = parseFloat(row.querySelector('.rate-input').value) || 0;
        let itemDetails = `<div class="item-preview-entry"><strong>${productName}</strong>: `;
        let calculationText = "N/A";

        const itemCacheEntry = { name: productName, type: unitType }; // Start cache entry

        if (unitType === 'Sq Feet' && rate > 0) {
            const width = row.querySelector('.width-input').value;
            const height = row.querySelector('.height-input').value;
            const unit = row.querySelector('.dimension-unit-select').value;

            itemCacheEntry.width = width;
            itemCacheEntry.height = height;
            itemCacheEntry.unit = unit;

            if (parseFloat(width) > 0 && parseFloat(height) > 0 && typeof calculateFlexDimensions === 'function') {
                const calc = calculateFlexDimensions(unit, width, height);
                itemCacheEntry.calc = calc; // Store calculation result
                calculationText = `Real Size: ${parseFloat(width).toFixed(2)}x${parseFloat(height).toFixed(2)} ${unit} (${calc.realSqFt} sq ft).
                                   Print Size Used: ${calc.printWidth}x${calc.printHeight} ${calc.inputUnit}.
                                   Billing Area: <strong>${calc.printSqFt} sq ft</strong> @ ₹${rate.toFixed(2)}/sq ft.`;
                hasContent = true;
            } else if (parseFloat(width) > 0 && parseFloat(height) > 0) {
                 calculationText = `Real Size: ${parseFloat(width).toFixed(2)}x${parseFloat(height).toFixed(2)} ${unit}. Rate: ₹${rate.toFixed(2)}/sq ft. (Full calculation function missing/invalid).`;
                 hasContent = true;
            } else {
                 calculationText = "Incomplete dimensions.";
            }
        } else if (unitType === 'Qty' && rate > 0) {
            const quantity = row.querySelector('.quantity-input').value;
            itemCacheEntry.quantity = quantity;
            if (parseInt(quantity) > 0) {
                 calculationText = `Quantity: <strong>${quantity}</strong> @ ₹${rate.toFixed(2)}/unit.`;
                 hasContent = true;
            } else {
                 calculationText = "Invalid quantity.";
            }
        } else {
            calculationText = "Incomplete rate or details.";
        }
        itemDetails += calculationText + '</div>';
        previewHtml += itemDetails;
        itemsDataCache.push(itemCacheEntry); // Add details to cache
    });

    calculationPreviewArea.innerHTML = hasContent ? previewHtml : ''; // Only show preview if there's content
    calculationPreviewArea.style.display = hasContent ? 'block' : 'none';
}


// --- Form Submission ---
async function savePO(event) {
    event.preventDefault();
    showPOError(''); // Clear previous errors
    savePOBtn.disabled = true;
    savePOBtn.querySelector('span').textContent = 'Saving...';

    if (!db || !collection || !addDoc || !doc || !updateDoc || !serverTimestamp || !Timestamp) {
        showPOError("Error: Database functions not loaded correctly.");
        savePOBtn.disabled = false; savePOBtn.querySelector('span').textContent = 'Save Purchase Order';
        return;
    }

    // --- Validation ---
    const supplierId = selectedSupplierIdInput.value;
    const orderDate = poOrderDateInput.value;
    if (!supplierId) { showPOError("Please select a supplier from the suggestions."); supplierSearchInput.focus(); savePOBtn.disabled = false; savePOBtn.querySelector('span').textContent = 'Save Purchase Order'; return; }
    if (!orderDate) { showPOError("Please select an Order Date."); poOrderDateInput.focus(); savePOBtn.disabled = false; savePOBtn.querySelector('span').textContent = 'Save Purchase Order'; return; }
    if (poItemsTableBody.rows.length === 0) { showPOError("Please add at least one item to the Purchase Order."); addItemBtn.focus(); savePOBtn.disabled = false; savePOBtn.querySelector('span').textContent = 'Save Purchase Order'; return; }

    let itemsValid = true;
    const items = [];
    poItemsTableBody.querySelectorAll('.item-row').forEach((row, index) => {
        const productNameInput = row.querySelector('.product-name');
        const rateInput = row.querySelector('.rate-input');
        const unitType = row.querySelector('.unit-type-select').value;

        const productName = productNameInput.value.trim();
        const rate = parseFloat(rateInput.value) || 0;

        // Validate common fields
        if (!productName) { productNameInput.style.borderColor = 'red'; itemsValid = false; } else { productNameInput.style.borderColor = ''; }
        if (rate <= 0) { rateInput.style.borderColor = 'red'; itemsValid = false; } else { rateInput.style.borderColor = ''; }

        const item = {
            productName: productName,
            type: unitType,
            rate: rate,
            partyName: row.querySelector('.party-name').value.trim(),
            designDetails: row.querySelector('.design-details').value.trim(),
            itemAmount: parseFloat(row.querySelector('.item-amount').textContent) || 0,
        };

        if (unitType === 'Sq Feet') {
            const widthInput = row.querySelector('.width-input');
            const heightInput = row.querySelector('.height-input');
            const unitSelect = row.querySelector('.dimension-unit-select');
            const width = parseFloat(widthInput.value) || 0;
            const height = parseFloat(heightInput.value) || 0;
            const unit = unitSelect.value;

            if (width <= 0) { widthInput.style.borderColor = 'red'; itemsValid = false; } else { widthInput.style.borderColor = ''; }
            if (height <= 0) { heightInput.style.borderColor = 'red'; itemsValid = false; } else { heightInput.style.borderColor = ''; }

            item.width = width;
            item.height = height;
            item.unit = unit;

            // Add calculated print dimensions from cache or recalculate
            const cachedItem = itemsDataCache[index];
            if (cachedItem && cachedItem.type === 'Sq Feet' && cachedItem.calc) {
                item.printWidth = parseFloat(cachedItem.calc.printWidth) || 0;
                item.printHeight = parseFloat(cachedItem.calc.printHeight) || 0;
                item.inputUnit = cachedItem.calc.inputUnit;
                item.printSqFt = parseFloat(cachedItem.calc.printSqFt) || 0;
            } else if (typeof calculateFlexDimensions === 'function') {
                 // Recalculate if cache is missing (should not happen ideally)
                 console.warn(`Recalculating dimensions for item ${index} during save.`);
                 const calcResult = calculateFlexDimensions(unit, width, height);
                 item.printWidth = parseFloat(calcResult.printWidth) || 0;
                 item.printHeight = parseFloat(calcResult.printHeight) || 0;
                 item.inputUnit = calcResult.inputUnit;
                 item.printSqFt = parseFloat(calcResult.printSqFt) || 0;
            } else {
                 item.printSqFt = (width/ (unit === 'inches' ? 12:1)) * (height/ (unit === 'inches' ? 12:1)); // Basic fallback
            }

        } else { // Qty
            const quantityInput = row.querySelector('.quantity-input');
            const quantity = parseInt(quantityInput.value) || 0;
            if (quantity <= 0) { quantityInput.style.borderColor = 'red'; itemsValid = false; } else { quantityInput.style.borderColor = ''; }
            item.quantity = quantity;
        }
        items.push(item);
    });

    if (!itemsValid) {
        showPOError("Please fill in all required fields for items (marked in red).");
        savePOBtn.disabled = false; savePOBtn.querySelector('span').textContent = 'Save Purchase Order'; return;
    }

    // --- Prepare Data for Firestore ---
    const poData = {
        supplierId: supplierId,
        supplierName: selectedSupplierNameInput.value, // Store supplier name for convenience
        poNumber: poNumberInput.value.trim(), // Use the generated or existing number
        orderDate: Timestamp.fromDate(new Date(orderDate)), // Convert date string to Firestore Timestamp
        items: items,
        totalAmount: parseFloat(poTotalAmountSpan.textContent) || 0,
        notes: poNotesInput.value.trim(),
        updatedAt: serverTimestamp(), // Use server timestamp for updates
    };

    try {
        if (currentEditingPOId) { // --- Update Existing PO ---
            const poRef = doc(db, "purchaseOrders", currentEditingPOId);
            // Keep original status unless explicitly changed elsewhere
            // poData.status = ??; // Need logic if status can be changed on edit form
            await updateDoc(poRef, poData);
            console.log("Purchase Order updated with ID: ", currentEditingPOId);
            alert("Purchase Order updated successfully!");
        } else { // --- Add New PO ---
            poData.createdAt = serverTimestamp(); // Set creation timestamp only for new POs
            poData.status = "New"; // Default status for new POs
            const docRef = await addDoc(collection(db, "purchaseOrders"), poData);
            console.log("Purchase Order added with ID: ", docRef.id);
            alert(`Purchase Order ${poData.poNumber} created successfully!`);
        }
        // Redirect back to the PO list page
        window.location.href = 'supplier_management.html';

    } catch (error) {
        console.error("Error saving Purchase Order: ", error);
        showPOError("Error saving Purchase Order: " + error.message);
        savePOBtn.disabled = false;
        savePOBtn.querySelector('span').textContent = 'Save Purchase Order';
    }
}

// --- Load PO Data for Editing ---
async function loadPOForEditing(poId) {
    currentEditingPOId = poId; // Set global editing ID
    editPOIdInput.value = poId; // Set hidden input value
    poPageTitle.textContent = 'Edit Purchase Order';
    poBreadcrumbAction.textContent = 'Edit PO';
    savePOBtn.querySelector('span').textContent = 'Update Purchase Order';
    poNumberInput.readOnly = true; // Keep PO number readonly even in edit mode

    if (!db || !doc || !getDoc) { showPOError("Database functions not loaded."); return; }

    try {
        const poRef = doc(db, "purchaseOrders", poId);
        const docSnap = await getDoc(poRef);

        if (docSnap.exists()) {
            const poData = docSnap.data();

            // Populate Supplier Info
            selectedSupplierIdInput.value = poData.supplierId;
            selectedSupplierNameInput.value = poData.supplierName || ''; // Use stored name
            supplierSearchInput.value = poData.supplierName || ''; // Display supplier name
            // Optionally fetch full supplier details if needed:
            // if (poData.supplierId) {
            //     const supplierSnap = await getDoc(doc(db, "suppliers", poData.supplierId));
            //     if (supplierSnap.exists()) supplierSearchInput.value = supplierSnap.data().name;
            // }

            // Populate PO Details
            poNumberInput.value = poData.poNumber || '';
            if (poData.orderDate?.toDate) {
                poOrderDateInput.valueAsDate = poData.orderDate.toDate();
            }
            poNotesInput.value = poData.notes || '';

            // Populate Items
            poItemsTableBody.innerHTML = ''; // Clear any existing rows
            if (poData.items && poData.items.length > 0) {
                poData.items.forEach(item => {
                    if (!itemRowTemplate || !poItemsTableBody) return;
                    const templateContent = itemRowTemplate.content.cloneNode(true);
                    const newRow = templateContent.querySelector('.item-row'); // Get the row element

                    // Populate fields
                    newRow.querySelector('.product-name').value = item.productName || '';
                    newRow.querySelector('.unit-type-select').value = item.type || 'Qty';
                    newRow.querySelector('.rate-input').value = item.rate?.toFixed(2) || '0.00';
                    newRow.querySelector('.party-name').value = item.partyName || '';
                    newRow.querySelector('.design-details').value = item.designDetails || '';
                    newRow.querySelector('.item-amount').textContent = item.itemAmount?.toFixed(2) || '0.00';

                    if (item.type === 'Sq Feet') {
                        newRow.querySelector('.width-input').value = item.width || '';
                        newRow.querySelector('.height-input').value = item.height || '';
                        newRow.querySelector('.dimension-unit-select').value = item.unit || 'feet';
                    } else {
                        newRow.querySelector('.quantity-input').value = item.quantity || '';
                    }

                    poItemsTableBody.appendChild(templateContent); // Append the populated template
                    attachRowListeners(newRow); // Attach listeners to the new row
                });
            }
            updateItemsUI(); // Update headers/visibility based on loaded items
            updateTotalAmount(); // Calculate total based on loaded items
            updateCalculationPreview(); // Show preview for loaded items

        } else {
            console.error("No such PO document!");
            showPOError(`Error: Purchase Order with ID ${poId} not found.`);
            savePOBtn.disabled = true; // Disable saving if PO not found
        }
    } catch (error) {
        console.error("Error loading PO for editing:", error);
        showPOError("Error loading Purchase Order data: " + error.message);
        savePOBtn.disabled = true;
    }
}


// Helper to show errors
function showPOError(message) {
    poErrorMsg.textContent = message;
    poErrorMsg.style.display = message ? 'block' : 'none';
}


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("new_po.js: DOM loaded.");
    itemsDataCache = []; // Initialize cache

    // Check for Firestore availability (should be set by HTML script)
    if (!window.db || !window.collection) {
         console.error("Firestore instance (db or collection) not found on window object.");
         showPOError("Application Error: Database connection failed. Please refresh.");
         if(savePOBtn) savePOBtn.disabled = true;
         return;
    }

    // Add first item row automatically only if NOT editing
    const urlParams = new URLSearchParams(window.location.search);
    const editPOId = urlParams.get('editPOId');

    if (editPOId) {
        console.log("Loading PO for editing:", editPOId);
        loadPOForEditing(editPOId);
    } else {
        console.log("Creating new PO.");
        // Add initial item row for new POs
        addItemRow();
        // Set default order date to today
        poOrderDateInput.valueAsDate = new Date();
        // Generate the next PO Number
        generateNextPoNumber(); // <-- कॉल करें
    }

    // Add Item button listener
    if (addItemBtn) {
        addItemBtn.addEventListener('click', addItemRow);
    }

    // Form submit listener
    if (poForm) {
        poForm.addEventListener('submit', savePO);
    }

     // Initial UI update for headers
    updateItemsUI();
    console.log("new_po.js: Initialized.");
});