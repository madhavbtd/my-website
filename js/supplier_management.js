// js/supplier_management.js - v8 (Print Sizes Column, View Details Modal Added)

// Import PDF function
import { generatePoPdf } from './utils.js'; // Assuming utils.js still exists and is correct

// Import from firebase-init.js
import {
    db, auth,
    collection, doc, getDoc, getDocs, updateDoc, deleteDoc,
    query, orderBy, where, Timestamp, serverTimestamp
} from './firebase-init.js';

// --- DOM Elements ---
// (Keep existing references: addSupplierBtn, supplierTableBody, poTableBody, supplier modal elements, status modal elements)
const addSupplierBtn = document.getElementById('addSupplierBtn');
const supplierTableBody = document.getElementById('supplierTableBody');
const poTableBody = document.getElementById('poTableBody');
const supplierModal = document.getElementById('supplierModal');
const supplierModalTitle = document.getElementById('supplierModalTitle');
const closeSupplierModalBtn = document.getElementById('closeSupplierModal');
const cancelSupplierBtn = document.getElementById('cancelSupplierBtn');
const saveSupplierBtn = document.getElementById('saveSupplierBtn');
const supplierForm = document.getElementById('supplierForm');
const supplierIdInput = document.getElementById('supplierIdInput');
const supplierNameInput = document.getElementById('supplierNameInput');
const supplierCompanyInput = document.getElementById('supplierCompanyInput');
const supplierWhatsappInput = document.getElementById('supplierWhatsappInput');
const supplierEmailInput = document.getElementById('supplierEmailInput');
const supplierAddressInput = document.getElementById('supplierAddressInput');
const supplierGstInput = document.getElementById('supplierGstInput');
const supplierErrorMsg = document.getElementById('supplierErrorMsg');
const poSearchInput = document.getElementById('poSearchInput');
const poStatusFilter = document.getElementById('poStatusFilter');
const poFilterBtn = document.getElementById('poFilterBtn');
const statusUpdateModal = document.getElementById('statusUpdateModal');
const statusModalTitle = document.getElementById('statusModalTitle');
const closeStatusModalBtn = document.getElementById('closeStatusModal');
const cancelStatusBtn = document.getElementById('cancelStatusBtn');
const saveStatusBtn = document.getElementById('saveStatusBtn');
const statusUpdateForm = document.getElementById('statusUpdateForm');
const statusUpdatePOId = document.getElementById('statusUpdatePOId');
const currentPOStatusSpan = document.getElementById('currentPOStatus');
const statusSelect = document.getElementById('statusSelect');
const statusErrorMsg = document.getElementById('statusErrorMsg');

// **** NEW PO Details Modal Elements ****
const poDetailsModal = document.getElementById('poDetailsModal');
const poDetailsModalTitle = document.getElementById('poDetailsModalTitle');
const poDetailsModalContent = document.getElementById('poDetailsModalContent');
const closePoDetailsModalBtn = document.getElementById('closePoDetailsModal');
const cancelPoDetailsBtn = document.getElementById('cancelPoDetailsBtn');
const printPoDetailsBtn = document.getElementById('printPoDetailsBtn'); // Optional print button
// *************************************

let currentEditingSupplierId = null;
let currentPODataCache = {}; // Cache PO data for modal use

// --- Local Helper: calculateFlexDimensions (Copied & modified from new_po.js v5) ---
// Needed for View Details Modal calculations if utils.js is not imported/reliable
function calculateFlexDimensions(unit, width, height) {
    // ... (Keep the full function code from new_po.js v5 response) ...
    const mediaWidthsFt = [3, 4, 5, 6, 8, 10];
    let wFt = (unit === 'inches') ? parseFloat(width || 0) / 12 : parseFloat(width || 0);
    let hFt = (unit === 'inches') ? parseFloat(height || 0) / 12 : parseFloat(height || 0);
    if (isNaN(wFt) || isNaN(hFt) || wFt <= 0 || hFt <= 0) { return { realSqFt: 0, printWidth: 0, printHeight: 0, printSqFt: 0, inputUnit: unit, realWidthFt: 0, realHeightFt: 0, printWidthFt: 0, printHeightFt: 0 }; }
    const realSqFt = wFt * hFt;
    const mediaWidthFitW = mediaWidthsFt.find(mw => mw >= wFt);
    let printWidthFt1 = mediaWidthFitW || wFt; let printHeightFt1 = hFt; let printSqFt1 = printWidthFt1 * printHeightFt1;
    const mediaWidthFitH = mediaWidthsFt.find(mw => mw >= hFt);
    let printWidthFt2 = wFt; let printHeightFt2 = mediaWidthFitH || hFt; let printSqFt2 = printWidthFt2 * printHeightFt2;
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


// --- Supplier Modal Handling (Keep existing functions) ---
function openSupplierModal(mode = 'add', supplierData = null, supplierId = null) { /* ... keep existing ... */ }
function closeSupplierModal() { /* ... keep existing ... */ }

// --- Status Modal Handling (Keep existing functions) ---
function openStatusModal(poId, currentStatus, poNumber) { /* ... keep existing ... */ }
function closeStatusModal() { /* ... keep existing ... */ }

// --- **** NEW PO Details Modal Handling **** ---
function openPoDetailsModal(poId) {
    if (!poDetailsModal || !poDetailsModalContent || !poDetailsModalTitle) {
         console.error("PO Details modal elements not found!"); alert("Error: Cannot show PO details."); return;
    }

    const poInfo = currentPODataCache[poId]; // Get cached data
    if (!poInfo || !poInfo.poData || !poInfo.poData.items) {
        console.error("PO data not found in cache for ID:", poId);
        poDetailsModalContent.innerHTML = '<p class="error-message">Error: Could not load PO details.</p>';
        poDetailsModal.classList.add('active');
        return;
    }

    const poData = poInfo.poData;
    const supplierName = poInfo.supplierName || 'N/A';
    const poNumber = poInfo.poNumber || poId;

    poDetailsModalTitle.textContent = `Details for PO #${poNumber} (${supplierName})`;
    poDetailsModalContent.innerHTML = ''; // Clear previous content

    // Build table header
    let tableHTML = `<table id="poDetailsModalTable">
        <thead>
            <tr>
                <th class="col-item-name">Item Name</th>
                <th class="col-party">Party</th>
                <th class="col-design">Design</th>
                <th class="col-size">Size (Real / Print)</th>
                <th class="col-area">Area (Real / Print SqFt)</th>
                <th class="col-wastage">Wastage (SqFt / Size)</th>
                <th class="col-rate">Rate</th>
                <th class="col-amount">Amount</th>
            </tr>
        </thead>
        <tbody>`;

    // Build table body
    let totalCalcAmount = 0;
    poData.items.forEach(item => {
        let sizeHtml = '-';
        let areaHtml = '-';
        let wastageHtml = '-';

        if (item.type === 'Sq Feet') {
            // Recalculate using the local function for consistency
            const calcResult = calculateFlexDimensions(item.unit || 'feet', item.realWidth || 0, item.realHeight || 0);
            const realSqFtNum = parseFloat(calcResult.realSqFt);
            const printSqFtNum = parseFloat(calcResult.printSqFt);
            const wastageSqFt = (printSqFtNum - realSqFtNum);
            const tolerance = 0.01;
            let wastageSizeStr = "None";
            if (wastageSqFt > tolerance) {
                 const widthDiff = (calcResult.printWidthFt - calcResult.realWidthFt);
                 const heightDiff = (calcResult.printHeightFt - calcResult.realHeightFt);
                 if (widthDiff > tolerance && Math.abs(heightDiff) < tolerance) { wastageSizeStr = `${widthDiff.toFixed(2)} W x ${calcResult.realHeightFt.toFixed(2)} H`; }
                 else if (heightDiff > tolerance && Math.abs(widthDiff) < tolerance) { wastageSizeStr = `${calcResult.realWidthFt.toFixed(2)} W x ${heightDiff.toFixed(2)} H`; }
                 else { wastageSizeStr = `~Area`; } // Simplify complex case
            }

            sizeHtml = `${(item.realWidth || 0)}${item.unit === 'inches' ? '"' : 'ft'} x ${(item.realHeight || 0)}${item.unit === 'inches' ? '"' : 'ft'} <br> / ${calcResult.printWidthFt.toFixed(2)}ft x ${calcResult.printHeightFt.toFixed(2)}ft`;
            areaHtml = `${realSqFtNum.toFixed(2)} / ${printSqFtNum.toFixed(2)} sq ft`;
            wastageHtml = `${wastageSqFt.toFixed(2)} sq ft <br> ${wastageSizeStr}`;

        } else { // Qty type
            sizeHtml = `Qty: ${item.quantity || 0}`;
        }

        tableHTML += `
            <tr>
                <td class="col-item-name">${item.productName || 'N/A'}</td>
                <td class="col-party">${item.partyName || '-'}</td>
                <td class="col-design">${item.designDetails || '-'}</td>
                <td class="col-size">${sizeHtml}</td>
                <td class="col-area">${areaHtml}</td>
                <td class="col-wastage">${wastageHtml}</td>
                <td class="col-rate">${(item.rate ?? 0).toFixed(2)}</td>
                <td class="col-amount">${(item.itemAmount ?? 0).toFixed(2)}</td>
            </tr>`;
        totalCalcAmount += (item.itemAmount ?? 0);
    });

    tableHTML += `</tbody>
        <tfoot>
            <tr>
                <td colspan="7" style="text-align: right; font-weight: bold;">Total:</td>
                <td style="text-align: right; font-weight: bold;">${totalCalcAmount.toFixed(2)}</td>
            </tr>
        </tfoot>
        </table>`;

    poDetailsModalContent.innerHTML = tableHTML;
    poDetailsModal.classList.add('active');
}

function closePoDetailsModal() {
    if (poDetailsModal) {
        poDetailsModal.classList.remove('active');
        poDetailsModalContent.innerHTML = '<p>Loading details...</p>'; // Reset content
    }
}
// ****************************************

// --- Firestore Operations ---

// Function to display suppliers (Keep existing function)
async function displaySupplierList() { /* ... keep existing ... */ }

// Function to save/update supplier (Keep existing function)
async function saveSupplier(event) { /* ... keep existing ... */ }

// Function to delete supplier (Keep existing function)
async function deleteSupplier(supplierId, supplierName) { /* ... keep existing ... */ }

// Function to delete PO (Keep existing function)
async function handleDeletePO(poId, poNumber) { /* ... keep existing ... */ }

// Function to Handle Status Update Submission (Keep existing function)
async function handleStatusUpdate(event) { /* ... keep existing ... */ }

// **** MODIFIED Function to display POs ****
async function displayPoList() {
    if (!poTableBody) { console.error("PO table body (poTableBody) not found!"); return; }
    if (!db || !collection || !getDocs || !query || !orderBy || !doc || !getDoc || !deleteDoc || !updateDoc) {
        console.error("Firestore functions not available in displayPoList.");
        poTableBody.innerHTML = '<tr><td colspan="7" class="error-message">Error: Cannot load POs.</td></tr>'; return; // Adjusted colspan
    }

    poTableBody.innerHTML = '<tr><td colspan="7"><i class="fas fa-spinner fa-spin"></i> Loading purchase orders...</td></tr>'; // Adjusted colspan
    currentPODataCache = {}; // Clear cache before fetching

    try {
        const q = query(collection(db, "purchaseOrders"), orderBy("orderDate", "desc"));
        const querySnapshot = await getDocs(q);
        poTableBody.innerHTML = '';
        if (querySnapshot.empty) {
            poTableBody.innerHTML = '<tr><td colspan="7">No purchase orders found.</td></tr>'; return; // Adjusted colspan
        }

        const poPromises = querySnapshot.docs.map(async (docRef_po) => {
            const po = docRef_po.data(); const poId = docRef_po.id;
            let supplierName = 'Unknown Supplier';
            if (po.supplierId) {
                try { /* ... fetch supplier name ... */ const supplierSnap = await getDoc(doc(db, "suppliers", po.supplierId)); if (supplierSnap.exists()) { supplierName = supplierSnap.data().name || 'N/A'; } }
                catch (err) { console.error(`Error fetching supplier ${po.supplierId}:`, err); supplierName = 'Error'; }
            } else { supplierName = po.supplierName || 'N/A (Legacy)'; }

            let orderDateStr = po.orderDate?.toDate ? po.orderDate.toDate().toLocaleDateString('en-GB') : '-';
            let statusClass = (po.status || 'unknown').toLowerCase().replace(/\s+/g, '-');
            let statusText = po.status || 'Unknown';
            let amountStr = po.totalAmount !== undefined ? `₹ ${po.totalAmount.toFixed(2)} : '-';

            // **** NEW: Generate Print Sizes Summary ****
            let printSizeSummary = '-';
            if (po.items && Array.isArray(po.items)) {
                printSizeSummary = po.items
                    .filter(item => item.type === 'Sq Feet' && item.printWidthFt && item.printHeightFt) // Use calculated Ft dimensions if available
                    .map(item => `${(item.productName || '').substring(0,10)}:${item.printWidthFt.toFixed(1)}x${item.printHeightFt.toFixed(1)}ft`)
                    .slice(0, 3) // Limit to first 3 items for summary
                    .join(', ');
                 if (po.items.filter(item => item.type === 'Sq Feet').length > 3) {
                      printSizeSummary += '...';
                 }
                 if (!printSizeSummary) { // Handle cases where no Sq Feet items exist
                     printSizeSummary = po.items.length > 0 ? 'Qty Items Only' : '-';
                 }
            }
            // **************************************

            const poInfo = {
                id: poId, poNumber: po.poNumber || 'N/A', supplierName: supplierName,
                orderDate: orderDateStr, status: statusText, statusClass: statusClass,
                printSizeSummary: printSizeSummary, // Add summary to data
                amount: amountStr, poData: po
            };
            currentPODataCache[poId] = poInfo; // Cache data for modal
            return poInfo;
        });

        const posData = await Promise.all(poPromises);

        posData.forEach(poInfo => {
             const tr = document.createElement('tr'); tr.setAttribute('data-id', poInfo.id);
             // **** UPDATED Row HTML ****
             tr.innerHTML = `
                 <td>${poInfo.poNumber}</td>
                 <td>${poInfo.supplierName}</td>
                 <td>${poInfo.orderDate}</td>
                 <td title="${poInfo.printSizeSummary}">${poInfo.printSizeSummary}</td> <td><span class="status-badge status-${poInfo.statusClass}">${poInfo.status}</span></td>
                 <td style="text-align: right;">${poInfo.amount}</td>
                 <td class="action-buttons">
                     <a href="new_po.html?editPOId=${poInfo.id}" class="button edit-button" title="Edit PO"><i class="fas fa-edit"></i></a>
                     <button class="button status-button" data-poid="${poInfo.id}" data-ponumber="${poInfo.poNumber}" data-currentstatus="${poInfo.status}" title="Update Status"><i class="fas fa-sync-alt"></i></button>
                     <button class="button view-details-button" data-poid="${poInfo.id}" title="View Details" style="background-color: #6f42c1; color: white;"><i class="fas fa-eye"></i></button>
                     <button class="button pdf-button" data-id="${poInfo.id}" title="Download PDF"><i class="fas fa-file-pdf"></i></button>
                     <button class="button delete-button" data-id="${poInfo.id}" data-ponumber="${poInfo.poNumber}" title="Delete PO"><i class="fas fa-trash-alt"></i></button>
                 </td>
             `;
             // *************************

             // --- Add Event Listeners ---
             // Delete Button
             const deletePoBtn = tr.querySelector('.delete-button[title="Delete PO"]');
             if (deletePoBtn) { deletePoBtn.addEventListener('click', () => handleDeletePO(poInfo.id, poInfo.poNumber)); }

             // PDF Button
             const pdfBtn = tr.querySelector('.pdf-button');
             if (pdfBtn) { pdfBtn.addEventListener('click', async () => { /* ... Keep existing PDF logic ... */ }); }

             // Status Button
             const statusBtn = tr.querySelector('.status-button');
             if (statusBtn) { statusBtn.addEventListener('click', () => openStatusModal(poInfo.id, poInfo.status, poInfo.poNumber)); }

             // **** NEW View Details Listener ****
             const viewDetailsBtn = tr.querySelector('.view-details-button');
             if (viewDetailsBtn) {
                 viewDetailsBtn.addEventListener('click', () => {
                     openPoDetailsModal(poInfo.id); // Pass only ID, data is cached
                 });
             }
             // ***********************************

             poTableBody.appendChild(tr);
        }); // End forEach posData

        console.log("Purchase Orders list displayed successfully.");

    } catch (error) {
        console.error("Error processing or displaying POs: ", error);
        poTableBody.innerHTML = `<tr><td colspan="7" class="error-message">Error loading POs: ${error.message}</td></tr>`; // Adjusted colspan
    }
}


// Helper to show errors in supplier modal
function showSupplierError(message) { /* ... keep existing ... */ }
// Helper to show errors in status modal
function showStatusError(message) { /* ... keep existing ... */ }

// --- Initialization on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Supplier Management v8: DOM loaded. Initializing.");

    if (!db) { /* ... keep existing DB check ... */ return; }
    console.log("Supplier Management: DB connection confirmed.");

    // Setup Event Listeners (Supplier Modal, Status Modal)
    if (addSupplierBtn) { addSupplierBtn.addEventListener('click', () => openSupplierModal('add')); }
    if (closeSupplierModalBtn) { closeSupplierModalBtn.addEventListener('click', closeSupplierModal); }
    if (cancelSupplierBtn) { cancelSupplierBtn.addEventListener('click', closeSupplierModal); }
    if (supplierForm) { supplierForm.addEventListener('submit', saveSupplier); }
    if (supplierModal) { supplierModal.addEventListener('click', (event) => { if (event.target === supplierModal) closeSupplierModal(); }); }
    if (closeStatusModalBtn) { closeStatusModalBtn.addEventListener('click', closeStatusModal); }
    if (cancelStatusBtn) { cancelStatusBtn.addEventListener('click', closeStatusModal); }
    if (statusUpdateForm) { statusUpdateForm.addEventListener('submit', handleStatusUpdate); }
    if (statusUpdateModal) { statusUpdateModal.addEventListener('click', (event) => { if (event.target === statusUpdateModal) closeStatusModal(); }); }

    // **** NEW PO Details Modal Listeners ****
    if (closePoDetailsModalBtn) { closePoDetailsModalBtn.addEventListener('click', closePoDetailsModal); }
    else { console.warn("Close PO Details Modal button not found."); }
    if (cancelPoDetailsBtn) { cancelPoDetailsBtn.addEventListener('click', closePoDetailsModal); }
    else { console.warn("Cancel PO Details button not found."); }
    if (poDetailsModal) { poDetailsModal.addEventListener('click', (event) => { if (event.target === poDetailsModal) closePoDetailsModal(); }); }
    else { console.warn("PO Details modal not found."); }
    // Optional: Add listener for print button
    if (printPoDetailsBtn) {
        printPoDetailsBtn.addEventListener('click', () => {
            // Basic print functionality - might need refinement for better layout
            const contentToPrint = poDetailsModalContent.innerHTML;
            const title = poDetailsModalTitle.textContent;
            const printWindow = window.open('', '_blank', 'height=600,width=800');
            printWindow.document.write(`<html><head><title>${title}</title>`);
            // Optional: Add basic styling for print
            printWindow.document.write('<style> table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #ccc; padding: 5px; text-align: left; } th { background-color: #f2f2f2; } </style>');
            printWindow.document.write('</head><body>');
            printWindow.document.write(`<h2>${title}</h2>`);
            printWindow.document.write(contentToPrint);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus(); // Required for IE
            // Timeout needed for content to render before print command
            setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
        });
    }
    // *************************************

    // PO Filter Listener
    if (poFilterBtn) { poFilterBtn.addEventListener('click', displayPoList); }

    // Initial data load
    (async () => {
        try { await displaySupplierList(); } catch (e) { console.error("Error initial supplier load:", e); }
        try { await displayPoList(); } catch (e) { console.error("Error initial PO load:", e); }
    })();

    // Check for #add hash
    if(window.location.hash === '#add') { /* ... keep existing ... */ }

    console.log("Supplier Management Initialized via DOMContentLoaded.");
});

console.log("supplier_management.js v8 module processed.");