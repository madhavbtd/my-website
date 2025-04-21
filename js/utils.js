// js/utils.js - v10 (Fix text overlap in Particulars, refined styles)

// --- Function for Flex Calculation (No changes) ---
function calculateFlexDimensions(unit, width, height) {
    // ... (Keep the function exactly as it was) ...
    console.log(`Calculating flex: Unit=${unit}, W=${width}, H=${height}`);
    const mediaWidthsFt = [3, 4, 5, 6, 8, 10];
    let wFt = (unit === 'inches') ? parseFloat(width || 0) / 12 : parseFloat(width || 0);
    let hFt = (unit === 'inches') ? parseFloat(height || 0) / 12 : parseFloat(height || 0);
    if (isNaN(wFt) || isNaN(hFt) || wFt <= 0 || hFt <= 0) { return { realSqFt: 0, printWidth: 0, printHeight: 0, printSqFt: 0, inputUnit: unit, realWidthFt: 0, realHeightFt: 0, printWidthFt: 0, printHeightFt: 0 }; }
    const realSqFt = wFt * hFt;
    const mediaWidthFitW = mediaWidthsFt.find(mw => mw >= wFt);
    let printWidthFt1 = mediaWidthFitW || wFt; let printHeightFt1 = hFt; let printSqFt1 = printWidthFt1 * printHeightFt1;
    if (!mediaWidthFitW) console.warn(`Width ${wFt.toFixed(2)}ft exceeds max media width.`);
    const mediaWidthFitH = mediaWidthsFt.find(mw => mw >= hFt);
    let printWidthFt2 = wFt; let printHeightFt2 = mediaWidthFitH || hFt; let printSqFt2 = printWidthFt2 * printHeightFt2;
    if (!mediaWidthFitH) console.warn(`Height ${hFt.toFixed(2)}ft exceeds max media width.`);
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


// --- PDF Generation Function (New Design v10) ---
async function generatePoPdf(poData, supplierData) {
    // 1. jsPDF Check & Init
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') { console.error("jsPDF library not found!"); alert("Error: PDF Library not loaded."); return; }
    if (typeof window.jspdf.jsPDF.API.autoTable !== 'function') { console.error("jsPDF autoTable plugin not found!"); alert("Error: PDF AutoTable Plugin not loaded."); return; }
    const { jsPDF } = window.jspdf;

    console.log("Generating PDF (v10 Design) for PO:", poData);
    console.log("Supplier Data for PDF:", supplierData);

    if (!poData || !poData.items || !supplierData) { alert("Error: Missing data to generate PDF."); console.error("Missing PDF data"); return; }

    // --- Company Details ---
    const companyName = "Madhav Offset";
    const companyAddress = "Head Office: Moodh Market, Batadu";
    const companyContact = "Mobile: 9549116541";
    const companySignature = "For, Madhav Offset";

    try {
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;
        const margin = 40;
        const contentWidth = pageWidth - (margin * 2);
        let currentY = margin;

        // --- Define Colors & Fonts ---
        const headerColor = '#0056b3';
        const textColor = '#333333';
        const subTextColor = '#555555';
        const borderColor = '#DDDDDD';
        const whiteColor = '#FFFFFF';
        const blackColor = '#000000';
        const tableHeaderBG = '#F5F5F5';
        const defaultFontSize = 9;
        const smallFontSize = 8;
        const headerFontSize = 10;
        const defaultLineHeightFactor = 1.15; // Standard line height factor

        doc.setTextColor(textColor);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(defaultFontSize);

        // --- 1. Header ---
        doc.setFontSize(11); doc.setFont(undefined, 'bold');
        doc.text(companyName, pageWidth - margin, currentY + 5, { align: 'right' });
        currentY += 14; doc.setFontSize(defaultFontSize); doc.setFont(undefined, 'normal');
        const addressLines = doc.splitTextToSize(companyAddress, 180);
        doc.text(addressLines, pageWidth - margin, currentY, { align: 'right' });
        currentY += (addressLines.length * (defaultFontSize * defaultLineHeightFactor)) + 2;
        doc.text(companyContact, pageWidth - margin, currentY, { align: 'right' });
        currentY += 20;

        // Title
        doc.setFontSize(16); doc.setFont(undefined, 'bold');
        doc.text("PURCHASE ORDER", pageWidth / 2, currentY, { align: 'center' });
        currentY += 25;

        // --- 2. Supplier/PO Info ---
        const infoStartY = currentY; const halfWidth = contentWidth / 2; const gap = 20;

        // Left Column: Supplier
        doc.setFontSize(smallFontSize); doc.setFont(undefined, 'bold'); doc.setTextColor(subTextColor);
        doc.text("Issued To:", margin, currentY); currentY += 11; doc.setTextColor(textColor);
        doc.setFontSize(defaultFontSize); doc.setFont(undefined, 'bold');
        if(supplierData.name) doc.text(supplierData.name, margin, currentY); currentY += 12;
        doc.setFont(undefined, 'normal'); doc.setFontSize(defaultFontSize);
        if (supplierData.address) { const supAddressLines = doc.splitTextToSize(supplierData.address, halfWidth - gap); doc.text(supAddressLines, margin, currentY); currentY += (supAddressLines.length * (defaultFontSize * defaultLineHeightFactor)) + 2; } else { currentY += 10; }
        if (supplierData.whatsappNo) { doc.text(`Contact: ${supplierData.whatsappNo}`, margin, currentY); currentY += (defaultFontSize + 2); }
        if (supplierData.gstNo) { doc.text(`GST No.: ${supplierData.gstNo}`, margin, currentY); currentY += (defaultFontSize + 2); }
        const leftColEndY = currentY;

        // Right Column: PO
        currentY = infoStartY; const col2X = margin + halfWidth + gap; const col2LabelWidth = 55; const col2ValueX = col2X + col2LabelWidth + 5;
        doc.setFontSize(defaultFontSize); doc.setFont(undefined, 'normal');
        const drawInfoLine = (label, value) => { if (currentY > pageHeight - margin*2) { doc.addPage(); currentY = margin; } doc.setFont(undefined, 'bold'); doc.text(label, col2X, currentY, { align: 'left', maxWidth: col2LabelWidth }); doc.setFont(undefined, 'normal'); doc.text(`: ${value}`, col2ValueX, currentY); currentY += 14; };
        drawInfoLine("Order No.", String(poData.poNumber || 'N/A'));
        let orderDateStr = 'N/A'; if (poData.orderDate?.toDate) { try { orderDateStr = poData.orderDate.toDate().toLocaleDateString('en-GB'); } catch(e){ console.error("Error formatting date:", e)} } drawInfoLine("Date", orderDateStr); drawInfoLine("Status", poData.status || 'N/A');
        const rightColEndY = currentY;
        currentY = Math.max(leftColEndY, rightColEndY) + 25;

        // --- 3. Prepare Table Data ---
        let totalQtySum = 0; const tableBody = []; const detailedItemData = [];
        poData.items.forEach((item, index) => {
            let qtyStr = '-'; let sqfStr = '-'; let productName = item.productName || 'N/A'; let flexDetailsLines = [];
            if (item.type === 'Sq Feet') {
                const area = item.printSqFt !== undefined ? parseFloat(item.printSqFt) : 0; sqfStr = area.toFixed(2);
                const w = item.realWidth || item.width || '?'; const h = item.realHeight || item.height || '?'; const u = item.unit || item.inputUnit || 'units'; const pw = item.printWidth || '?'; const ph = item.printHeight || '?'; const psf = item.printSqFt || '?'; const rsf = item.realSqFt || '?'; let wastage = parseFloat(psf) - parseFloat(rsf); wastage = (!isNaN(wastage) && wastage >= 0.01) ? wastage.toFixed(2) + ' sqft' : 'None';
                flexDetailsLines.push(`  Real: ${w}x${h} ${u} (${rsf} sqft)`); flexDetailsLines.push(`  Print: ${pw}x${ph} (${psf} sqft)`); flexDetailsLines.push(`  Wastage: ${wastage}`);
            } else { const qty = parseInt(item.quantity || 0); qtyStr = `${qty}`; totalQtySum += qty; }
            const rateStr = typeof item.rate === 'number' ? `₹${item.rate.toFixed(2)}` : '-'; const amountStr = typeof item.itemAmount === 'number' ? `₹${item.itemAmount.toFixed(2)}` : '-';
            tableBody.push([ index + 1, productName, qtyStr, sqfStr, rateStr, amountStr ]); // Only productName here
            detailedItemData.push({ flexDetails: flexDetailsLines }); // Store details for hook
        });
        const summaryRows = [];
        // if (totalQtySum > 0) { summaryRows.push([ { content: `Total Qty: ${totalQtySum}`, colSpan: 2, styles: { halign: 'left', fontStyle: 'bold', fontSize: defaultFontSize} }, {}, {}, {}, {} ]); } // Removed Total Qty Row
        const finalTotalAmountStr = poData.totalAmount !== undefined ? poData.totalAmount.toFixed(2) : '0.00';
        summaryRows.push([ { content: 'GRAND TOTAL', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fontSize: headerFontSize} }, { content: `₹ ${finalTotalAmountStr}`, styles: { halign: 'right', fontStyle: 'bold', fontSize: headerFontSize} } ]);

        // --- 4. Define Table Styles ---
        const headStyles = { fillColor: tableHeaderBG, textColor: blackColor, fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: headerFontSize, cellPadding: {top: 6, right: 5, bottom: 6, left: 5}, lineWidth: 0.5, lineColor: borderColor };
        const cellPadding = {top: 5, right: 5, bottom: 5, left: 5}; // Define default padding
        const bodyStyles = { fontSize: defaultFontSize, textColor: textColor, cellPadding: cellPadding, valign: 'top', lineWidth: 0.5, lineColor: borderColor };
        const columnStyles = { 0: { halign: 'center', cellWidth: 30 }, 1: { halign: 'left', cellWidth: 235 }, 2: { halign: 'right', cellWidth: 40 }, 3: { halign: 'right', cellWidth: 50 }, 4: { halign: 'right', cellWidth: 60 }, 5: { halign: 'right', cellWidth: 70 } };

        // --- 5. Hooks for Styling and Height ---
        let addPageRequired = false;
        const didParseCell = (data) => {
            // Adjust height only for Particulars column in the main body
            if (data.column.dataKey === 1 && data.row.section === 'body') {
                const itemIndex = data.row.index;
                if (detailedItemData[itemIndex] && detailedItemData[itemIndex].flexDetails.length > 0) {
                     const cell = data.cell;
                     const doc = data.doc;
                     const textLines = 1 + detailedItemData[itemIndex].flexDetails.length; // Product Name + Detail Lines
                     const mainLineHeight = (cell.styles.fontSize || defaultFontSize) * defaultLineHeightFactor / doc.internal.scaleFactor;
                     const detailLineHeight = smallFontSize * defaultLineHeightFactor / doc.internal.scaleFactor;
                     // Approximate height needed
                     const requiredHeight = mainLineHeight + (detailedItemData[itemIndex].flexDetails.length * detailLineHeight) + cell.padding('vertical');

                     if (requiredHeight > cell.height) {
                          cell.height = requiredHeight;
                     }
                }
            }
        };

        const didDrawCell = (data) => {
            // Draw flex details manually only for Particulars column in the main body
            if (data.column.dataKey === 1 && data.row.section === 'body') {
                const itemIndex = data.row.index;
                const itemDetails = detailedItemData[itemIndex];

                if (itemDetails && itemDetails.flexDetails.length > 0) {
                    const cell = data.cell;
                    const doc = data.doc;
                    const leftPadding = cell.padding('left');
                    const topPadding = cell.padding('top');
                    const indent = 4; // Indentation for detail lines

                    // Calculate Y position to start drawing details (below the product name)
                    const productNameFontSize = cell.styles.fontSize || defaultFontSize;
                    const productNameLineHeight = productNameFontSize * defaultLineHeightFactor / doc.internal.scaleFactor;
                    let lineY = cell.y + topPadding + productNameLineHeight - 2; // Adjust offset slightly

                    const lineStartX = cell.x + leftPadding + indent;

                    // Store current styles
                    const originalSize = doc.getFontSize();
                    const originalStyle = doc.getFont().fontStyle;
                    const originalColor = doc.getTextColor();

                    // Style for flex details
                    doc.setFont(undefined, 'normal');
                    doc.setFontSize(smallFontSize);
                    doc.setTextColor(subTextColor);
                    const detailLineHeight = smallFontSize * defaultLineHeightFactor / doc.internal.scaleFactor;

                    itemDetails.flexDetails.forEach(line => {
                        // Check page boundary BEFORE drawing this line
                        if (lineY + detailLineHeight > pageHeight - margin) {
                             addPageRequired = true; return; // Stop drawing details for THIS item if it breaks page
                        }
                        doc.text(line.trim(), lineStartX, lineY);
                        lineY += detailLineHeight; // Move Y for next detail line
                    });

                    // Restore original styles
                    doc.setFontSize(originalSize);
                    doc.setFont(undefined, originalStyle);
                    doc.setTextColor(originalColor);
                }
            }
        };

        // --- 6. Call autoTable for Items ---
        doc.autoTable({
            head: [['S.No.', 'PARTICULARS', 'QTY', 'SQF', 'UNIT PRICE', 'AMOUNT']],
            body: tableBody,
            startY: currentY,
            theme: 'grid',
            headStyles: headStyles,
            bodyStyles: bodyStyles,
            columnStyles: columnStyles,
            didParseCell: didParseCell, // Hook for adjusting cell height
            didDrawCell: didDrawCell,   // Hook for drawing flex details
            margin: { left: margin, right: margin }
        });
        currentY = doc.lastAutoTable.finalY;

        // Check if a page break happened during item drawing
        if (addPageRequired) {
             doc.addPage(); currentY = margin; addPageRequired = false;
             // Note: Ideally, redraw headers if table breaks across pages (more complex)
        }

        // Check space before drawing summary
        if (currentY > pageHeight - 80) { doc.addPage(); currentY = margin; }

        // --- 7. Call autoTable for Summary Rows ---
         doc.autoTable({
            body: summaryRows,
            startY: currentY,
            theme: 'grid',
            showHead: false,
            bodyStyles: {
                 fontSize: defaultFontSize, // Use default size for consistency
                 textColor: textColor,
                 cellPadding: {top: 6, right: 5, bottom: 6, left: 5}, // More padding for total row
                 valign: 'middle', lineWidth: 0.5, lineColor: borderColor, fontStyle: 'bold'
             },
             // Style the GRAND TOTAL row specifically if needed via hooks or direct styles
             didParseCell: function (data) {
                  // Make total amount cell bolder or different background?
                  // Example: Make last cell (amount) slightly larger font
                  if (data.row.index === summaryRows.length - 1 && data.column.index === 1) { // Check column index carefully based on colSpans
                       data.cell.styles.fontSize = headerFontSize; // Make amount font same as header
                  }
             },
             columnStyles: columnStyles, // Apply same column widths
             margin: { left: margin, right: margin }
        });
        currentY = doc.lastAutoTable.finalY + 20;

        // --- 8. Footer Sections ---
        if (currentY > pageHeight - 80) { doc.addPage(); currentY = margin; }

        // Amount in Words
        const amountInWords = "Rupees ... Only"; // !!! Needs function !!!
        doc.setFontSize(defaultFontSize); doc.setFont(undefined, 'bold');
        doc.text("Amount (in words):", margin, currentY);
        doc.setFont(undefined, 'normal'); doc.text(amountInWords, margin + 95, currentY);
        currentY += 20;

        // Terms
        if (currentY > pageHeight - 60) { doc.addPage(); currentY = margin; }
        doc.setFont(undefined, 'bold'); doc.text("Terms / Declaration:", margin, currentY);
        currentY += 12; doc.setFont(undefined, 'normal'); doc.setFontSize(smallFontSize);
        const terms = [ "- Subject to Batadu jurisdiction.", "- Goods once sold will not be taken back." ];
         terms.forEach(term => {
             if (currentY > pageHeight - 40) { doc.addPage(); currentY = margin; }
             doc.text(term, margin, currentY); currentY += (smallFontSize + 2);
         });

        // --- 9. Signature ---
         const signatureY = pageHeight - margin - 20;
         // Ensure currentY doesn't overlap signature area
         if (currentY > signatureY - 10 ) { doc.addPage(); currentY = margin;} // Add page if needed, reset Y (signature will be drawn relative to bottom)

        doc.setFontSize(defaultFontSize); doc.setFont(undefined, 'bold');
        doc.text(companySignature, pageWidth - margin, signatureY, { align: 'right' });

        // --- 10. Save PDF ---
        const filename = `PO-${poData.poNumber || poData.id?.substring(0, 6) || 'PurchaseOrder'}.pdf`;
        doc.save(filename);
        console.log("PDF Generated (v10 Design):", filename);

    } catch (error) {
        console.error("Error generating PDF (v10 Design):", error);
        alert(`Could not generate PDF. Error: ${error.message}. Check console for more details.`);
    }
}

// Export the functions
export { generatePoPdf, calculateFlexDimensions };