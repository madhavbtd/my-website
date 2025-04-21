// js/new_po.js - v4 (Auto PO Number Generation Added)

// --- Firebase Functions Import ---
import {
    db,
    collection, doc, addDoc, getDoc, getDocs, updateDoc, serverTimestamp, Timestamp,
    query, where, limit, orderBy,
    runTransaction // <<<--- runTransaction इम्पोर्ट किया गया
} from './firebase-init.js';
// ---------------------------------


// --- DOM Elements ---
// (सभी मौजूदा DOM refs यहाँ अपरिवर्तित रहेंगे)
const poForm = document.getElementById('poForm');
const poPageTitle = document.getElementById('poPageTitle');
const poBreadcrumbAction = document.getElementById('poBreadcrumbAction');
const editPOIdInput = document.getElementById('editPOId');
const supplierSearchInput = document.getElementById('supplierSearchInput');
const selectedSupplierIdInput = document.getElementById('selectedSupplierId');
const selectedSupplierNameInput = document.getElementById('selectedSupplierName');
const supplierSuggestionsDiv = document.getElementById('supplierSuggestions');
const addNewSupplierFromPOBtn = document.getElementById('addNewSupplierFromPO');
const poNumberInput = document.getElementById('poNumberInput'); // PO नंबर इनपुट
const poOrderDateInput = document.getElementById('poOrderDateInput');
const poStatusInput = document.getElementById('poStatusInput');
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
// calculateFlexDimensions, updateTotalAmount, updateItemAmount, handleUnitTypeChange, addItemRowEventListeners
// (ये फंक्शन्स यहाँ अपरिवर्तित रहेंगे)
function calculateFlexDimensions(unit, width, height) { /* ... */
    console.log(`Calculating flex: Unit=${unit}, W=${width}, H=${height}`);
    const mediaWidthsFt = [3, 4, 5, 6, 8, 10];
    let wFt = (unit === 'inches') ? parseFloat(width || 0) / 12 : parseFloat(width || 0);
    let hFt = (unit === 'inches') ? parseFloat(height || 0) / 12 : parseFloat(height || 0);
    if (isNaN(wFt) || isNaN(hFt) || wFt <= 0 || hFt <= 0) { return { realSqFt: 0, printWidth: 0, printHeight: 0, printSqFt: 0, inputUnit: unit }; }
    const realSqFt = wFt * hFt;
    const mediaWidthFitW = mediaWidthsFt.find(mw => mw >= wFt);
    let printWidthFt1 = mediaWidthFitW || wFt; let printHeightFt1 = hFt; let printSqFt1 = printWidthFt1 * printHeightFt1;
    const mediaWidthFitH = mediaWidthsFt.find(mw => mw >= hFt);
    let printWidthFt2 = wFt; let printHeightFt2 = mediaWidthFitH || hFt; let printSqFt2 = printWidthFt2 * printHeightFt2;
    let finalPrintWidthFt, finalPrintHeightFt, finalPrintSqFt;
    if (printSqFt1 <= printSqFt2 || !mediaWidthFitH) { finalPrintWidthFt = printWidthFt1; finalPrintHeightFt = printHeightFt1; finalPrintSqFt = printSqFt1; } else { finalPrintWidthFt = printWidthFt2; finalPrintHeightFt = printHeightFt2; finalPrintSqFt = printSqFt2; }
    let displayPrintWidth = (unit === 'inches') ? finalPrintWidthFt * 12 : finalPrintWidthFt;
    let displayPrintHeight = (unit === 'inches') ? finalPrintHeightFt * 12 : finalPrintHeightFt;
    return { realSqFt: realSqFt.toFixed(2), printWidth: displayPrintWidth.toFixed(2), printHeight: displayPrintHeight.toFixed(2), printSqFt: finalPrintSqFt.toFixed(2), inputUnit: unit };
}
function updateTotalAmount() { /* ... */
    let total = 0;
    poItemsTableBody.querySelectorAll('.item-row').forEach(row => {
        const amountSpan = row.querySelector('.item-amount');
        total += parseFloat(amountSpan.textContent) || 0;
    });
    if (poTotalAmountSpan) { poTotalAmountSpan.textContent = total.toFixed(2); }
    console.log("Total amount updated:", total.toFixed(2));
 }
function updateItemAmount(row) { /* ... */
    if (!row) return;
    const unitTypeSelect = row.querySelector('.unit-type-select'); const amountSpan = row.querySelector('.item-amount');
    const rateInput = row.querySelector('.rate-input'); let amount = 0; let calcPreviewHTML = '';
    try {
        const rate = parseFloat(rateInput.value) || 0;
        if (unitTypeSelect.value === 'Sq Feet') {
            const dimensionUnitSelect = row.querySelector('.dimension-unit-select'); const widthInput = row.querySelector('.width-input');
            const heightInput = row.querySelector('.height-input'); const unit = dimensionUnitSelect.value;
            const width = parseFloat(widthInput.value) || 0; const height = parseFloat(heightInput.value) || 0;
            if (width > 0 && height > 0) {
                 const calcResult = calculateFlexDimensions(unit, width, height); amount = (parseFloat(calcResult.printSqFt) * rate);
                 calcPreviewHTML = `<i>Calculation Preview:</i> Real: ${calcResult.realSqFt} sq ft | Print Area: <b>${calcResult.printSqFt} sq ft</b> (${calcResult.printWidth} x ${calcResult.printHeight} ${calcResult.inputUnit})`;
            } else { calcPreviewHTML = '<i>Enter valid dimensions for Sq Feet calculation.</i>'; }
        } else {
            const quantityInput = row.querySelector('.quantity-input'); const quantity = parseInt(quantityInput.value) || 0;
            amount = quantity * rate; calcPreviewHTML = '';
        }
    } catch (e) { console.error("Error calculating item amount:", e); amount = 0; calcPreviewHTML = '<i style="color:red;">Calculation Error</i>'; }
    amountSpan.textContent = amount.toFixed(2); if(calculationPreviewArea) calculationPreviewArea.innerHTML = calcPreviewHTML; updateTotalAmount();
 }
function handleUnitTypeChange(event) { /* ... */
    const row = event.target.closest('.item-row'); if (!row) return; const unitType = event.target.value;
    const sqFeetInputs = row.querySelectorAll('.sq-feet-input'); const qtyInputCell = row.querySelector('.qty-input');
    const sqFeetHeaders = document.querySelectorAll('#poItemsTable th.sq-feet-header'); const qtyHeader = document.querySelector('#poItemsTable th.qty-header');
    const rateInput = row.querySelector('.rate-input'); const quantityInputField = row.querySelector('.quantity-input');
    const widthInput = row.querySelector('.width-input'); const heightInput = row.querySelector('.height-input');
    if (unitType === 'Sq Feet') {
        sqFeetInputs.forEach(el => el.style.display = ''); if(qtyInputCell) qtyInputCell.closest('td').style.display = 'none';
        sqFeetHeaders.forEach(th => th.classList.remove('hidden-col')); if(qtyHeader) qtyHeader.classList.add('hidden-col');
        if(rateInput) rateInput.placeholder = 'Rate/SqFt'; if(quantityInputField) { quantityInputField.value = ''; quantityInputField.required = false; }
        if(widthInput) widthInput.required = true; if(heightInput) heightInput.required = true;
    } else {
        sqFeetInputs.forEach(el => el.style.display = 'none'); if(qtyInputCell) qtyInputCell.closest('td').style.display = '';
        sqFeetHeaders.forEach(th => th.classList.add('hidden-col')); if(qtyHeader) qtyHeader.classList.remove('hidden-col');
        if(rateInput) rateInput.placeholder = 'Rate/Unit'; if(quantityInputField) quantityInputField.required = true;
        if(widthInput) { widthInput.value = ''; widthInput.required = false; } if(heightInput) { heightInput.value = ''; heightInput.required = false;}
        if(calculationPreviewArea) calculationPreviewArea.innerHTML = '';
    }
    updateItemAmount(row);
 }
function addItemRowEventListeners(row) { /* ... */
    const unitTypeSelect = row.querySelector('.unit-type-select'); const dimensionUnitSelect = row.querySelector('.dimension-unit-select');
    const widthInput = row.querySelector('.width-input'); const heightInput = row.querySelector('.height-input');
    const quantityInput = row.querySelector('.quantity-input'); const rateInput = row.querySelector('.rate-input');
    const deleteBtn = row.querySelector('.delete-item-btn'); if(unitTypeSelect) unitTypeSelect.addEventListener('change', handleUnitTypeChange);
    [dimensionUnitSelect, widthInput, heightInput, quantityInput, rateInput].forEach(input => { if (input) { input.addEventListener('input', () => updateItemAmount(row)); if(input.classList.contains('dimension-input') || input.classList.contains('dimension-unit-select')) { input.addEventListener('focus', () => updateItemAmount(row)); } } });
    if (deleteBtn) { deleteBtn.addEventListener('click', () => { row.remove(); updateTotalAmount(); if(calculationPreviewArea) calculationPreviewArea.innerHTML = ''; }); }
    const initialUnitTypeSelect = row.querySelector('.unit-type-select'); if(initialUnitTypeSelect){ handleUnitTypeChange({ target: initialUnitTypeSelect }); }
 }


// --- Initialization on DOM Load (UPDATED) ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("new_po.js: DOM loaded.");
    if (!db) {
        console.error("new_po.js: Firestore (db) not available from import!");
        alert("Error initializing page. Firestore connection failed.");
        return;
    }
    console.log("new_po.js: Firestore connection confirmed.");

    // Set default order date
     if(poOrderDateInput) {
        try {
            const today = new Date();
            poOrderDateInput.value = today.toISOString().split('T')[0];
        } catch (e) { console.error("Error setting default date:", e); }
     }

    // Add Item Row Logic (अपरिवर्तित)
    if (addItemBtn && itemRowTemplate && poItemsTableBody) {
        addItemBtn.addEventListener('click', () => {
            const templateContent = itemRowTemplate.content.cloneNode(true);
            poItemsTableBody.appendChild(templateContent);
            const appendedRow = poItemsTableBody.lastElementChild;
            if (appendedRow && appendedRow.matches('.item-row')) { addItemRowEventListeners(appendedRow); }
            else { console.error("Failed to get appended row or it's not an item-row"); }
        });
        addItemBtn.click(); // Add first row automatically
    } else { console.error("Add Item button, Item Row template or Table Body not found!"); }

    // Supplier Search Logic (अपरिवर्तित)
    if (supplierSearchInput && supplierSuggestionsDiv && selectedSupplierIdInput && selectedSupplierNameInput) {
        supplierSearchInput.addEventListener('input', handleSupplierSearchInput);
        document.addEventListener('click', (e) => { if (!supplierSearchInput.contains(e.target) && !supplierSuggestionsDiv.contains(e.target)) { supplierSuggestionsDiv.style.display = 'none'; } });
    } else { console.warn("Supplier search elements not found."); }
    if(addNewSupplierFromPOBtn) {
        addNewSupplierFromPOBtn.addEventListener('click', () => { window.open('supplier_management.html#add', '_blank'); alert("Opening supplier management page. Add supplier there and then search here."); });
    }

    // Form Submission Logic (अपरिवर्तित)
    if (poForm) {
        poForm.addEventListener('submit', handleSavePO);
    } else { console.error("PO Form element not found!"); }

    // Load PO Data if Editing OR Set PO Number Input Readonly for New
    const urlParams = new URLSearchParams(window.location.search);
    const editPOId = urlParams.get('editPOId');
    if (editPOId) {
        loadPOForEditing(editPOId);
        // Make PO number readonly even when editing an existing PO
        if(poNumberInput) {
           poNumberInput.readOnly = true;
           poNumberInput.style.backgroundColor = '#e9ecef';
           poNumberInput.placeholder = 'Cannot change existing PO number';
        }
    } else {
        // New PO: Keep PO number input readonly (already set in HTML)
         if(poNumberInput) {
             poNumberInput.placeholder = "Will be generated on save";
         }
    }

    console.log("new_po.js: Basic setup and listeners added.");

}); // End DOMContentLoaded


// --- Supplier Search Implementation --- (अपरिवर्तित)
function handleSupplierSearchInput() { /* ... */
    if (!supplierSearchInput || !supplierSuggestionsDiv || !selectedSupplierIdInput || !selectedSupplierNameInput) return;
     console.log("Supplier search input:", supplierSearchInput.value); clearTimeout(supplierSearchDebounceTimer);
     const searchTerm = supplierSearchInput.value.trim(); selectedSupplierIdInput.value = ''; selectedSupplierNameInput.value = '';
     if (searchTerm.length < 1) { supplierSuggestionsDiv.innerHTML = ''; supplierSuggestionsDiv.style.display = 'none'; return; }
     supplierSearchDebounceTimer = setTimeout(() => { fetchSupplierSuggestions(searchTerm); }, 350);
}
async function fetchSupplierSuggestions(searchTerm) { /* ... */
    console.log("Fetching suppliers matching:", searchTerm); if (!supplierSuggestionsDiv) return;
     supplierSuggestionsDiv.innerHTML = '<div>Loading...</div>'; supplierSuggestionsDiv.style.display = 'block';
    try {
        const q = query(collection(db, "suppliers"), orderBy("name"), where("name", ">=", searchTerm), where("name", "<=", searchTerm + '\uf8ff'), limit(10) );
        const querySnapshot = await getDocs(q); supplierSuggestionsDiv.innerHTML = '';
        if (querySnapshot.empty) { supplierSuggestionsDiv.innerHTML = '<div class="no-suggestions">No matching suppliers found.</div>'; }
        else { querySnapshot.forEach((docSnapshot) => { /* ... */
                const supplier = docSnapshot.data(); const supplierId = docSnapshot.id; const div = document.createElement('div');
                div.textContent = `${supplier.name}${supplier.companyName ? ' (' + supplier.companyName + ')' : ''}`;
                div.dataset.id = supplierId; div.dataset.name = supplier.name;
                div.addEventListener('mousedown', (e) => { e.preventDefault(); supplierSearchInput.value = supplier.name; if(selectedSupplierIdInput) selectedSupplierIdInput.value = supplierId; if(selectedSupplierNameInput) selectedSupplierNameInput.value = supplier.name; supplierSuggestionsDiv.style.display = 'none'; console.log("Selected Supplier:", supplier.name, "ID:", supplierId); supplierSearchInput.focus(); });
                supplierSuggestionsDiv.appendChild(div); }); }
    } catch (error) { console.error("Error fetching supplier suggestions:", error); supplierSuggestionsDiv.innerHTML = '<div class="no-suggestions">Error fetching suppliers.</div>'; }
}


// --- Save PO Implementation (UPDATED for Auto PO Number) ---
async function handleSavePO(event) {
    event.preventDefault();
    console.log("Attempting to save PO...");
    showPOError('');

    // Prerequisites Check (runTransaction जोड़ा गया)
    if (!poForm || !selectedSupplierIdInput || !poOrderDateInput || !poItemsTableBody || !poTotalAmountSpan || !savePOBtn || !db || !addDoc || !collection || !doc || !updateDoc || !Timestamp || !serverTimestamp || !poStatusInput || !runTransaction) {
        console.error("Save PO prerequisites missing.");
        showPOError("Critical error: Cannot save PO. Required elements/functions missing.");
        return;
    }

    // --- 1. Gather General PO Data (PO नंबर छोड़कर) ---
    const supplierId = selectedSupplierIdInput.value;
    const supplierName = selectedSupplierNameInput.value;
    // const poNumber = poNumberInput.value.trim() || null; // <<< यह लाइन हटाई गई
    const orderDateValue = poOrderDateInput.value;
    const selectedStatus = poStatusInput.value;
    const notes = poNotesInput.value.trim();
    const editingPOId = editPOIdInput.value;
    const isEditing = !!editingPOId;

    // --- 2. Validation (अपरिवर्तित) ---
    if (!supplierId || !supplierName) { showPOError("Please select a supplier."); supplierSearchInput.focus(); return; }
    if (!orderDateValue) { showPOError("Please select an order date."); poOrderDateInput.focus(); return; }
    if (!selectedStatus) { showPOError("Please select a status."); poStatusInput.focus(); return; }
    const itemRows = poItemsTableBody.querySelectorAll('.item-row');
    if (itemRows.length === 0) { showPOError("Please add at least one item."); return; }

    // --- 3. Gather and Validate Item Data (अपरिवर्तित) ---
    let itemsArray = [];
    let validationPassed = true;
    let calculatedTotalAmount = 0;
    itemRows.forEach((row, index) => { /* ... (पूरा आइटम वैलिडेशन लॉजिक अपरिवर्तित) ... */
        if (!validationPassed) return;
        const productNameInput = row.querySelector('.product-name'); const unitTypeSelect = row.querySelector('.unit-type-select');
        const rateInput = row.querySelector('.rate-input'); const itemAmountSpan = row.querySelector('.item-amount');
        const productName = productNameInput.value.trim(); const unitType = unitTypeSelect.value;
        const rate = parseFloat(rateInput.value); const itemAmount = parseFloat(itemAmountSpan.textContent);
        if (!productName) { validationPassed = false; showPOError(`Item ${index + 1}: Product Name required.`); productNameInput.focus(); return; }
        if (isNaN(rate) || rate < 0) { validationPassed = false; showPOError(`Item ${index + 1}: Valid Rate required.`); rateInput.focus(); return; }
        if (isNaN(itemAmount)) { validationPassed = false; showPOError(`Item ${index + 1}: Amount error.`); return; }
        let itemData = { productName: productName, type: unitType, rate: rate, itemAmount: itemAmount };
        if (unitType === 'Sq Feet') {
            const dimensionUnitSelect = row.querySelector('.dimension-unit-select'); const widthInput = row.querySelector('.width-input');
            const heightInput = row.querySelector('.height-input'); const unit = dimensionUnitSelect.value;
            const width = parseFloat(widthInput.value); const height = parseFloat(heightInput.value);
            if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0) { validationPassed = false; showPOError(`Item ${index + 1}: Valid Width & Height required.`); widthInput.focus(); return; }
            const calcResult = calculateFlexDimensions(unit, width, height); if(parseFloat(calcResult.printSqFt) <= 0) { validationPassed = false; showPOError(`Item ${index + 1}: Calculation error.`); widthInput.focus(); return; }
            itemData.unit = unit; itemData.realWidth = width; itemData.realHeight = height; itemData.realSqFt = parseFloat(calcResult.realSqFt);
            itemData.printWidth = parseFloat(calcResult.printWidth); itemData.printHeight = parseFloat(calcResult.printHeight); itemData.printSqFt = parseFloat(calcResult.printSqFt);
            const expectedAmount = itemData.printSqFt * itemData.rate; if (Math.abs(itemAmount - expectedAmount) > 0.01) { itemData.itemAmount = parseFloat(expectedAmount.toFixed(2)); }
        } else {
            const quantityInput = row.querySelector('.quantity-input'); const quantity = parseInt(quantityInput.value);
            if (isNaN(quantity) || quantity <= 0) { validationPassed = false; showPOError(`Item ${index + 1}: Valid Quantity required.`); quantityInput.focus(); return; }
            itemData.quantity = quantity; const expectedAmount = itemData.quantity * itemData.rate; if (Math.abs(itemAmount - expectedAmount) > 0.01) { itemData.itemAmount = parseFloat(expectedAmount.toFixed(2)); }
        }
        itemsArray.push(itemData); calculatedTotalAmount += itemData.itemAmount;
     });
    if (!validationPassed) { console.error("PO save failed due to item validation errors."); return; }

    // --- Disable Save Button ---
    savePOBtn.disabled = true;
    if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Updating...' : 'Generating PO# & Saving...'; // <<< टेक्स्ट बदला

    try {
        let finalPoNumber; // जेनरेटेड या मौजूदा PO नंबर स्टोर करने के लिए
        let poDocRef;      // PO डॉक्यूमेंट रेफरेंस के लिए

        // --- 4. Create Firestore Data Object (बिना PO नंबर के) ---
        const basePoData = {
            supplierId: supplierId,
            supplierName: supplierName,
            // poNumber: नीचे जोड़ा जाएगा
            orderDate: Timestamp.fromDate(new Date(orderDateValue + 'T00:00:00')),
            status: selectedStatus,
            items: itemsArray,
            totalAmount: parseFloat(calculatedTotalAmount.toFixed(2)),
            notes: notes,
            updatedAt: serverTimestamp() // अपडेट टाइमस्टैम्प
        };

        // --- 5. Save Logic (Editing vs Adding New) ---
        if (isEditing) {
            // --- UPDATE EXISTING PO ---
            poDocRef = doc(db, "purchaseOrders", editingPOId);
            // मौजूदा PO नंबर का उपयोग करें (इसे बदलना नहीं है)
            finalPoNumber = editingPOData?.poNumber || poNumberInput.value || 'N/A'; // editingPOData से प्राप्त करें
            basePoData.poNumber = finalPoNumber; // डेटा में नंबर जोड़ें
            // createdAt टाइमस्टैम्प अगर मौजूद है तो रखें
            if (editingPOData?.createdAt) {
               basePoData.createdAt = editingPOData.createdAt;
            }

            await updateDoc(poDocRef, basePoData); // डॉक्यूमेंट अपडेट करें
            console.log("Purchase Order updated successfully:", editingPOId);
            alert("Purchase Order updated successfully!");

        } else {
            // --- ADD NEW PO (Generate Number using Transaction) ---
            basePoData.createdAt = serverTimestamp(); // नया बनाते समय createdAt जोड़ें

            const counterRef = doc(db, "counters", "poCounter"); // काउंटर डॉक्यूमेंट का रेफरेंस
            poDocRef = doc(collection(db, "purchaseOrders")); // नए PO के लिए रेफरेंस बनाएं (ID अभी नहीं मिलेगा)

            // ट्रांज़ैक्शन चलाएं
            await runTransaction(db, async (transaction) => {
                const counterSnap = await transaction.get(counterRef);
                if (!counterSnap.exists()) {
                    // काउंटर डॉक्यूमेंट मौजूद नहीं है! इसे मैन्युअल रूप से बनाना होगा।
                    throw new Error("PO Counter document ('counters/poCounter') not found in Firestore!");
                }

                const lastNumber = counterSnap.data().lastNumber;
                // सुनिश्चित करें कि lastNumber एक संख्या है, डिफ़ॉल्ट 1000
                const currentLastNumber = (typeof lastNumber === 'number' && !isNaN(lastNumber)) ? lastNumber : 1000;
                const newPoNumberValue = currentLastNumber + 1;

                // PO नंबर फॉर्मेट (सिर्फ नंबर, जैसा कि अनुरोध किया गया था)
                finalPoNumber = newPoNumberValue; // Use the number directly

                console.log(`Generating PO Number: Last was ${currentLastNumber}, New is ${finalPoNumber}`);

                // काउंटर अपडेट करें
                transaction.update(counterRef, { lastNumber: newPoNumberValue });

                // जेनरेटेड नंबर को PO डेटा में जोड़ें
                basePoData.poNumber = finalPoNumber;

                // ट्रांज़ैक्शन के अंदर नया PO डॉक्यूमेंट बनाएं
                // poDocRef यहाँ ट्रांज़ैक्शन के बाहर बनाया गया था, transaction.set के लिए इसका उपयोग करें
                transaction.set(poDocRef, basePoData);
            });

            console.log("Transaction successful!");
            console.log("Purchase Order saved successfully with ID:", poDocRef.id, "and PO Number:", finalPoNumber);
            alert(`Purchase Order saved successfully! PO Number: ${finalPoNumber}`);
            // आप चाहें तो जेनरेटेड नंबर को इनपुट में दिखा सकते हैं (लेकिन पेज रीडायरेक्ट हो रहा है)
            // if(poNumberInput) poNumberInput.value = finalPoNumber;
        }

        // सफलता के बाद रीडायरेक्ट करें (एडिट और ऐड दोनों के लिए)
        window.location.href = 'supplier_management.html';

    } catch (error) {
        console.error("Error saving Purchase Order: ", error);
        showPOError("Error saving PO: " + error.message + (error.message.includes('Counter') ? ' Please ensure counters/poCounter document exists with a numeric lastNumber field.' : ''));
        // बटन को finally ब्लॉक में पुनः सक्षम किया जाएगा
    } finally {
        savePOBtn.disabled = false;
        if (savePOBtnSpan) savePOBtnSpan.textContent = isEditing ? 'Update Purchase Order' : 'Save Purchase Order';
    }
}


// --- Load PO for Editing Implementation (UPDATED to handle readonly PO Number) ---
async function loadPOForEditing(poId) {
    console.log("Loading PO data for editing:", poId);
    if (!db || !doc || !getDoc || !poForm || !poStatusInput || !poNumberInput /*poNumberInput जोड़ा गया*/) {
         showPOError("Cannot load PO for editing. Initialization error.");
         return;
     }
    if (poPageTitle) poPageTitle.innerHTML = `<i class="fas fa-edit"></i> Edit Purchase Order`;
    if (poBreadcrumbAction) poBreadcrumbAction.textContent = `Edit PO (${poId.substring(0,6)}...)`;
    if (savePOBtnSpan) savePOBtnSpan.textContent = 'Update Purchase Order';
    editPOIdInput.value = poId;

    try {
         const poDocRef = doc(db, "purchaseOrders", poId);
         const poDocSnap = await getDoc(poDocRef);
         if (poDocSnap.exists()) {
             editingPOData = poDocSnap.data(); // Store fetched data globally
             console.log("PO Data loaded:", editingPOData);

             // Populate main form fields
             if(supplierSearchInput && editingPOData.supplierName) supplierSearchInput.value = editingPOData.supplierName;
             if(selectedSupplierIdInput && editingPOData.supplierId) selectedSupplierIdInput.value = editingPOData.supplierId;
             if(selectedSupplierNameInput && editingPOData.supplierName) selectedSupplierNameInput.value = editingPOData.supplierName;

             // <<< PO नंबर दिखाएं (लेकिन readonly रहेगा जैसा DOMContentLoaded में सेट किया गया है) >>>
             if(poNumberInput && editingPOData.poNumber != null) { // Check for null/undefined
                 poNumberInput.value = editingPOData.poNumber;
             } else if(poNumberInput) {
                 poNumberInput.value = ''; // खाली करें यदि मौजूद नहीं है
                 poNumberInput.placeholder = 'N/A';
             }
             // <<< >>>

             if(poOrderDateInput && editingPOData.orderDate && editingPOData.orderDate.toDate) { /* ... */
                poOrderDateInput.value = editingPOData.orderDate.toDate().toISOString().split('T')[0];
             } else if (poOrderDateInput) { poOrderDateInput.value = ''; }
             if(poStatusInput && editingPOData.status) { /* ... */
                poStatusInput.value = editingPOData.status;
             } else if (poStatusInput) { poStatusInput.value = 'New'; }
             if(poNotesInput && editingPOData.notes) poNotesInput.value = editingPOData.notes;

             // Populate items table (अपरिवर्तित)
             poItemsTableBody.innerHTML = ''; /* ... (पूरा आइटम पॉप्युलेशन लॉजिक अपरिवर्तित) ... */
             if (editingPOData.items && Array.isArray(editingPOData.items)) {
                 if (editingPOData.items.length === 0) { if (addItemBtn) addItemBtn.click(); }
                 else { editingPOData.items.forEach(item => { if (!itemRowTemplate || !addItemBtn) return; const templateContent = itemRowTemplate.content.cloneNode(true); poItemsTableBody.appendChild(templateContent); const newRow = poItemsTableBody.lastElementChild; if (newRow && newRow.matches('.item-row')) { const productNameInput = newRow.querySelector('.product-name'); if(productNameInput) productNameInput.value = item.productName || ''; const unitTypeSelect = newRow.querySelector('.unit-type-select'); if(unitTypeSelect) unitTypeSelect.value = item.type || 'Qty'; const rateInput = newRow.querySelector('.rate-input'); if(rateInput) rateInput.value = item.rate !== undefined ? item.rate : ''; if (item.type === 'Sq Feet') { const dimensionUnitSelect = newRow.querySelector('.dimension-unit-select'); if(dimensionUnitSelect) dimensionUnitSelect.value = item.unit || 'feet'; const widthInput = newRow.querySelector('.width-input'); if(widthInput) widthInput.value = item.realWidth !== undefined ? item.realWidth : ''; const heightInput = newRow.querySelector('.height-input'); if(heightInput) heightInput.value = item.realHeight !== undefined ? item.realHeight : ''; } else { const quantityInput = newRow.querySelector('.quantity-input'); if(quantityInput) quantityInput.value = item.quantity !== undefined ? item.quantity : ''; } addItemRowEventListeners(newRow); } }); }
             } else { if (addItemBtn) addItemBtn.click(); }
             updateTotalAmount();

         } else { /* ... (PO नहीं मिला हैंडलिंग) ... */
            console.error("No such PO document!"); showPOError("Error: Could not find the Purchase Order to edit."); if(savePOBtn) savePOBtn.disabled = true;
         }
     } catch (error) { /* ... (त्रुटि हैंडलिंग) ... */
        console.error("Error loading PO for editing:", error); showPOError("Error loading PO data: " + error.message); if(savePOBtn) savePOBtn.disabled = true;
     }
}


// Helper function to display errors on PO form (अपरिवर्तित)
function showPOError(message) { /* ... */
    if (poErrorMsg) { poErrorMsg.textContent = message; poErrorMsg.style.display = message ? 'block' : 'none'; }
    else { if(message) alert(message); }
}


console.log("new_po.js loaded and initial functions defined.");