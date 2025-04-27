// js/utils.js - Updated with Counter Logic and Exports

// --- Firestore Functions (Assume available globally from HTML or import if needed) ---
// सुनिश्चित करें कि db, doc, runTransaction फंक्शन कॉल करने से पहले उपलब्ध हों
const { db, doc, runTransaction } = window; // Or import them if needed

// --- Function for Flex Calculation ---
// (यह फंक्शन वैसे ही रहेगा जैसा आपने भेजा था)
function calculateFlexDimensions(unit, width, height) {
    // ... (आपका मौजूदा calculateFlexDimensions कोड यहाँ) ...
    console.log(`Calculating flex: Unit=${unit}, W=${width}, H=${height}`);
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


// --- PDF Generation Function ---
// (यह फंक्शन वैसे ही रहेगा जैसा आपने भेजा था)
async function generatePoPdf(poData, supplierData) {
    // ... (आपका मौजूदा generatePoPdf कोड यहाँ) ...
     if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') { console.error("jsPDF library not found!"); alert("Error: PDF Library not loaded."); return; }
     if (typeof window.jspdf.jsPDF.API.autoTable !== 'function') { console.error("jsPDF autoTable plugin not found!"); alert("Error: PDF AutoTable Plugin not loaded."); return; }
     const { jsPDF } = window.jspdf;
     console.log("Generating PDF (v11 Modal Replica) for PO:", poData);
     if (!poData || !poData.items) { alert("Error: Missing PO items data to generate PDF."); console.error("Missing poData or items for PDF generation"); return; }
     try {
         const doc = new jsPDF('p', 'pt', 'a4');
         const pageHeight = doc.internal.pageSize.height;
         const pageWidth = doc.internal.pageSize.width;
         const margin = 40;
         const contentWidth = pageWidth - margin * 2;
         let currentY = margin;
         const textColor = '#333333'; const defaultFontSize = 10; const titleFontSize = 14;
         const tableHeaderBG = '#F5F5F5'; const blackColor = '#000000'; const borderColor = '#CCCCCC';
         doc.setTextColor(textColor); doc.setFont('helvetica', 'normal'); doc.setFontSize(defaultFontSize);
         doc.setFontSize(titleFontSize); doc.setFont(undefined, 'bold');
         doc.text(`Details for PO #${String(poData.poNumber || poData.id)}`, margin, currentY); currentY += titleFontSize * 1.5;
         const tableHead = [['#', 'Product Name', 'Type', 'Details (Qty/Size)', 'Rate', 'Party', 'Design', 'Amount']];
         const tableBody = poData.items.map((item, index) => {
             let detailStr = '';
             if (item.type === 'Sq Feet') {
                 const w = item.realWidth || item.width || '?'; const h = item.realHeight || item.height || '?'; const u = item.unit || item.inputUnit || 'units';
                 const psf = item.printSqFt || '?'; const pw = item.printWidth || '?'; const ph = item.printHeight || '?';
                 detailStr = `W:${w} x H:${h} ${u} (Print: ${pw}x${ph} = ${psf} sqft)`;
             } else { detailStr = `Qty: ${item.quantity || '?'}`; }
             const rateStr = typeof item.rate === 'number' ? `₹${item.rate.toFixed(2)}` : '-';
             const amountStr = typeof item.itemAmount === 'number' ? `₹${item.itemAmount.toFixed(2)}` : '-';
             return [ index + 1, item.productName || 'N/A', item.type || 'N/A', detailStr, rateStr, item.partyName || '-', item.designDetails || '-', amountStr ];
         });
         const headStyles = { fillColor: tableHeaderBG, textColor: blackColor, fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: defaultFontSize, lineWidth: 0.5, lineColor: borderColor, cellPadding: {top: 8, right: 5, bottom: 8, left: 5} };
         const bodyStyles = { fontSize: defaultFontSize, valign: 'middle', lineWidth: 0.5, lineColor: borderColor, cellPadding: {top: 6, right: 5, bottom: 6, left: 5} };
         const columnStyles = { 0: { halign: 'center', cellWidth: 25 }, 1: { halign: 'left', cellWidth: 110 }, 2: { halign: 'left', cellWidth: 50 }, 3: { halign: 'left', cellWidth: 150 }, 4: { halign: 'right', cellWidth: 45 }, 5: { halign: 'left', cellWidth: 50 }, 6: { halign: 'left', cellWidth: 50 }, 7: { halign: 'right', cellWidth: 55 } };
         doc.autoTable({ head: tableHead, body: tableBody, startY: currentY, theme: 'grid', headStyles: headStyles, bodyStyles: bodyStyles, columnStyles: columnStyles, margin: { left: margin, right: margin } });
         currentY = doc.lastAutoTable.finalY + 15;
         if (currentY > pageHeight - 60) { doc.addPage(); currentY = margin; }
         doc.setFontSize(defaultFontSize); doc.setFont(undefined, 'bold'); doc.text("Notes:", margin, currentY); currentY += defaultFontSize + 3; doc.setFont(undefined, 'normal');
         if (poData.notes) { const notesLines = doc.splitTextToSize(poData.notes, contentWidth); doc.text(notesLines, margin, currentY); } else { doc.text("-", margin, currentY); }
         const filename = `PO_Details-${String(poData.poNumber || poData.id?.substring(0, 6) || 'Details')}.pdf`;
         doc.save(filename); console.log("PDF Generated (v11 Modal Replica):", filename);
     } catch (error) { console.error("Error generating PDF (v11 Modal Replica):", error); alert(`Could not generate PDF. Error: ${error.message}. Check console for more details.`); }
}


// ---------->>> नया काउंटर फंक्शन (यहाँ जोड़ा गया) <<<----------
/**
 * Firestore काउंटर से अगला न्यूमेरिक ID प्राप्त करता है और काउंटर को अपडेट करता है।
 * Transaction का उपयोग करता है ताकि आईडी यूनिक रहे।
 * @param {string} counterName 'customerCounter' या 'orderCounter'
 * @param {number} startId यदि काउंटर मौजूद नहीं है तो शुरुआती ID (उदा. 101 या 1001)
 * @returns {Promise<number>} अगला न्यूमेरिक ID
 */
async function getNextNumericId(counterName, startId = 101) {
    // सुनिश्चित करें कि Firestore फंक्शन्स लोड हो गए हैं
    if (!db || !doc || !runTransaction) {
        console.error("Firestore functions (db, doc, runTransaction) not available for counter.");
        throw new Error("Database functions unavailable. Cannot generate ID.");
    }
    const counterRef = doc(db, "counters", counterName);
    console.log(`Attempting to get next ID for counter: ${counterName}`);
    try {
        // Transaction चलाएं
        const nextIdNum = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let nextId = startId;
            if (counterDoc.exists() && counterDoc.data().lastId) {
                nextId = counterDoc.data().lastId + 1;
            } else {
                console.log(`Counter '${counterName}' not found or 'lastId' missing, starting at ${startId}.`);
            }
            // Transaction के अंदर काउंटर डॉक्यूमेंट को नए ID के साथ अपडेट/सेट करें
            transaction.set(counterRef, { lastId: nextId }, { merge: true });
            return nextId; // Transaction से नया ID लौटाएं
        });
        console.log(`Next ID for ${counterName} is: ${nextIdNum}`);
        return nextIdNum; // फंक्शन से नया ID लौटाएं
    } catch (error) {
        console.error(`Error getting next ID for ${counterName}:`, error);
        throw new Error(`Failed to generate numeric ID for ${counterName}.`); // एरर थ्रो करें
    }
}
// ---------->>> काउंटर फंक्शन समाप्त <<<----------


// --- सभी उपयोगी फंक्शन्स को एक्सपोर्ट करें ---
// सुनिश्चित करें कि सभी फंक्शन्स जिन्हें आप अन्य फाइलों में उपयोग करना चाहते हैं, वे यहाँ एक्सपोर्ट किए गए हैं
export { generatePoPdf, calculateFlexDimensions, getNextNumericId };

console.log("utils.js loaded (including getNextNumericId).");