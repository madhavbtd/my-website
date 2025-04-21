// js/send_po_email.js

// Ensure you import ONLY what's needed from firebase-init
import { db, doc, getDoc, Timestamp } from './firebase-init.js';

// DOM Elements
const loadingMessage = document.getElementById('loadingMessage');
const emailComposer = document.getElementById('emailComposer');
const emailToInput = document.getElementById('emailTo');
const emailSubjectInput = document.getElementById('emailSubject');
const emailBodyTextarea = document.getElementById('emailBody');
const copyBodyBtn = document.getElementById('copyBodyBtn');
const copyStatus = document.getElementById('copyStatus');
const errorMessage = document.getElementById('errorMessage');

// Function to format PO Items for email body
function formatPoItemsForEmail(items = []) {
    let itemsText = '';
    if (!Array.isArray(items)) return 'Error: Items data is invalid.\n'; // Basic check

    items.forEach((item, index) => {
        if (!item) return; // Skip if item is null/undefined
        itemsText += `${index + 1}. ${item.productName || 'N/A'}\n`;
        if (item.type === 'Sq Feet') {
            const w = item.realWidth || item.width || '?';
            const h = item.realHeight || item.height || '?';
            const u = item.unit || item.inputUnit || 'units';
            const psf = item.printSqFt || '?';
            const pw = item.printWidth || '?';
            const ph = item.printHeight || '?';
            itemsText += `   Details: W:<span class="math-inline">\{w\} x H\:</span>{h} ${u} (Print: <span class="math-inline">\{pw\}x</span>{ph} = ${psf} sqft)\n`;
        } else { // Qty
            itemsText += `   Details: Qty: ${item.quantity || '?'}\n`;
        }
        itemsText += `   Rate: ₹${(item.rate ?? 0).toFixed(2)}\n`;
        itemsText += `   Amount: ₹${(item.itemAmount ?? 0).toFixed(2)}\n`;
        if (item.partyName) itemsText += `   Party: ${item.partyName}\n`;
        if (item.designDetails) itemsText += `   Design: ${item.designDetails}\n`;
        itemsText += `\n`; // Extra line break
    });
    return itemsText;
}

// Function to format Terms for email body
function formatTermsForEmail() {
    let termsText = `Terms & Conditions:\n`;
    termsText += `- Print quality must be high-resolution as per approved design/proof. Color matching should be accurate.\n`;
    termsText += `- Flex material quality and GSM should match the agreed-upon specifications or approved sample.\n`;
    termsText += `- Timely delivery is expected as per the agreed schedule.\n`;
    termsText += `- Billing will be strictly based on the final print area (SqFt) mentioned in this Purchase Order. Extra charges require prior approval.\n`;
    termsText += `- Goods not meeting quality standards or specifications are subject to rejection upon delivery inspection.\n\n`;
    return termsText;
}

// Function to show error messages
function showError(message) {
     if(errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
     }
     if(loadingMessage) loadingMessage.style.display = 'none';
     if(emailComposer) emailComposer.style.display = 'none'; // Hide composer on error
}


// --- Main Logic ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("send_po_email.js loaded");

    // Check if Firestore db is available
    if (!db || !doc || !getDoc) {
         showError("Error: Database connection not available. Please check firebase-init.js");
         return;
    }


    // 1. Get IDs from URL
    const urlParams = new URLSearchParams(window.location.search);
    const poId = urlParams.get('poId');
    const supplierId = urlParams.get('supplierId');

    if (!poId || !supplierId) {
        showError("Error: Purchase Order ID or Supplier ID not found in URL.");
        return;
    }

    // 2. Fetch Data from Firestore
    try {
        const poRef = doc(db, "purchaseOrders", poId);
        const supplierRef = doc(db, "suppliers", supplierId);

        console.log(`Workspaceing data for PO: ${poId} and Supplier: ${supplierId}`);
        // Show loading immediately
         if(loadingMessage) loadingMessage.style.display = 'block';
         if(emailComposer) emailComposer.style.display = 'none';
         if(errorMessage) errorMessage.style.display = 'none';


        const [poSnap, supplierSnap] = await Promise.all([getDoc(poRef), getDoc(supplierRef)]);

        if (!poSnap.exists()) { throw new Error(`Purchase Order ${poId} not found.`); }
        if (!supplierSnap.exists()) { throw new Error(`Supplier ${supplierId} not found.`); }

        const poData = poSnap.data();
        const supplierData = supplierSnap.data();
        console.log("PO Data:", poData);
        console.log("Supplier Data:", supplierData);

        // 3. Populate Fields
        if(!emailToInput || !emailSubjectInput || !emailBodyTextarea) {
             throw new Error("Email composer elements not found in HTML.");
        }

        emailToInput.value = supplierData.email || 'Email not found for supplier';
        emailSubjectInput.value = `Purchase Order - ${poData.poNumber || poId}`;

        // Format Email Body
        let bodyText = `Dear <span class="math-inline">\{supplierData\.name \|\| 'Supplier'\},\\n\\nPlease find the details for Purchase Order \#</span>{poData.poNumber || poId} below:\n\n`;
        bodyText += `PO Date: ${poData.orderDate?.toDate ? poData.orderDate.toDate().toLocaleDateString('en-GB') : 'N/A'}\n`;
        // bodyText += `Status: ${poData.status || 'N/A'}\n`; // Optional: Include status?
        bodyText += `--------------------\nITEMS:\n--------------------\n`;
        bodyText += formatPoItemsForEmail(poData.items); // Add formatted items
        bodyText += `--------------------\n`;
        bodyText += `GRAND TOTAL: ₹${(poData.totalAmount ?? 0).toFixed(2)}\n`;
        bodyText += `--------------------\n\n`;
        if(poData.notes) { bodyText += `Notes:\n${poData.notes}\n\n`; }
        bodyText += formatTermsForEmail(); // Add terms
        bodyText += `Thank you,\nMadhav Offset`; // Add closing

        emailBodyTextarea.value = bodyText;

        // Hide loading, show composer
        if(loadingMessage) loadingMessage.style.display = 'none';
        if(emailComposer) emailComposer.style.display = 'block';

    } catch (error) {
        console.error("Error fetching or processing data:", error);
        showError(`Error loading details: ${error.message}`);
    }
});

// --- Copy Button Functionality ---
if (copyBodyBtn && emailBodyTextarea && copyStatus) {
    copyBodyBtn.addEventListener('click', () => {
        emailBodyTextarea.select();
        emailBodyTextarea.setSelectionRange(0, 99999); // For mobile
        try {
             // Use Clipboard API if available (more modern and secure)
             if (navigator.clipboard && navigator.clipboard.writeText) {
                 navigator.clipboard.writeText(emailBodyTextarea.value).then(() => {
                     copyStatus.textContent = 'Copied to clipboard!';
                     copyStatus.style.display = 'block';
                     copyStatus.style.color = 'green';
                     setTimeout(() => { copyStatus.style.display = 'none'; }, 2000);
                 }).catch(err => {
                      console.error('Async: Could not copy text: ', err);
                      copyStatus.textContent = 'Failed to copy!';
                      copyStatus.style.color = 'red';
                      copyStatus.style.display = 'block';
                      setTimeout(() => { copyStatus.style.display = 'none'; copyStatus.style.color = 'green';}, 3000);
                 });
             } else {
                  // Fallback to execCommand (less reliable)
                  let successful = document.execCommand('copy');
                  if(successful) {
                      copyStatus.textContent = 'Copied to clipboard!';
                      copyStatus.style.display = 'block';
                      copyStatus.style.color = 'green';
                       setTimeout(() => { copyStatus.style.display = 'none'; }, 2000);
                  } else { throw new Error('execCommand failed'); }
             }
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
            copyStatus.textContent = 'Failed to copy!';
            copyStatus.style.color = 'red';
            copyStatus.style.display = 'block';
            setTimeout(() => { copyStatus.style.display = 'none'; copyStatus.style.color = 'green'; }, 3000);
        }
        window.getSelection()?.removeAllRanges(); // Deselect
    });
} else {
     console.warn("Copy button or related elements not found.");
}