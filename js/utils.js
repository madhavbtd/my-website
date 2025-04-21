// js/utils.js - v7 (Layout Fixes, [object Object] Fix using didDrawCell hook)

// --- Function for Flex Calculation (यह फ़ंक्शन अपरिवर्तित है) ---
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


// --- PDF Generation Function (New Design v7) ---
async function generatePoPdf(poData, supplierData) {
    // 1. jsPDF Check & Init
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') { console.error("jsPDF library not found!"); alert("Error: PDF Library not loaded."); return; }
    if (typeof window.jspdf.jsPDF.API.autoTable !== 'function') { console.error("jsPDF autoTable plugin not found!"); alert("Error: PDF AutoTable Plugin not loaded."); return; }
    const { jsPDF } = window.jspdf;

    console.log("Generating PDF (v7 Design) for PO:", poData);
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
        const headerColor = '#0056b3'; // Primary Blue
        const textColor = '#333333';
        const subTextColor = '#555555';
        const borderColor = '#DDDDDD'; // Lighter border
        const whiteColor = '#FFFFFF';
        const blackColor = '#000000';
        const tableHeaderBG = '#F2F2F2'; // Light Grey Header BG
        const defaultFontSize = 9;
        const smallFontSize = 8;
        const headerFontSize = 10;

        doc.setTextColor(textColor);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(defaultFontSize);

        // --- 1. Header ---
        // Company Info (Right Aligned)
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text(companyName, pageWidth - margin, currentY + 5, { align: 'right' }); // Adjusted Y
        currentY += 14;
        doc.setFontSize(defaultFontSize);
        doc.setFont(undefined, 'normal');
        const addressLines = doc.splitTextToSize(companyAddress, 180);
        doc.text(addressLines, pageWidth - margin, currentY, { align: 'right' });
        currentY += (addressLines.length * 10) + 2;
        doc.text(companyContact, pageWidth - margin, currentY, { align: 'right' });
        currentY += 15; // Space after header

        // Title (Centered)
        doc.setFontSize(16); // Larger title
        doc.setFont(undefined, 'bold');
        doc.text("PURCHASE ORDER", pageWidth / 2, currentY, { align: 'center' });
        currentY += 25; // Space after title

        // --- 2. Supplier/PO Info ---
        const infoStartY = currentY;
        const halfWidth = contentWidth / 2;
        const gap = 15;

        // Left Column: Supplier Details ("Issued To:")
        doc.setFontSize(smallFontSize); // Smaller label
        doc.setFont(undefined, 'bold');
        doc.text("Issued To:", margin, currentY);
        currentY += 11; // Space after label
        doc.setFontSize(defaultFontSize); // Normal size for details
        doc.setFont(undefined, 'bold');
        if(supplierData.name) doc.text(supplierData.name, margin, currentY);
        currentY += 12; // Line height
        doc.setFont(undefined, 'normal');
        doc.setFontSize(smallFontSize + 1); // Normal small size
        if (supplierData.address) {
             const supAddressLines = doc.splitTextToSize(supplierData.address, halfWidth - gap);
             doc.text(supAddressLines, margin, currentY);
             currentY += (supAddressLines.length * (smallFontSize+1)) + 2; // Adjust Y based on lines
        } else { currentY += 10; }
        if (supplierData.whatsappNo) { doc.text(`Contact: ${supplierData.whatsappNo}`, margin, currentY); currentY += (smallFontSize+1); }
        if (supplierData.gstNo) { doc.text(`GST No.: ${supplierData.gstNo}`, margin, currentY); currentY += (smallFontSize+1); }
        const leftColEndY = currentY;

        // Right Column: PO Details
        currentY = infoStartY; // Reset Y
        const col2X = margin + halfWidth + gap;
        const col2LabelWidth = 55;
        const col2ValueX = col2X + col2LabelWidth + 5;

        doc.setFontSize(defaultFontSize);
        doc.setFont(undefined, 'normal');

        // Helper to draw Label: Value pair
        const drawInfoLine = (label, value) => {
            if (currentY > pageHeight - margin*2) { doc.addPage(); currentY = margin; } // Add page if needed
            doc.text(label, col2X, currentY, { align: 'left', maxWidth: col2LabelWidth });
            doc.text(`: ${value}`, col2ValueX, currentY);
            currentY += 13; // Line height
        };

        // --- <<< ERROR FIX included >>> ---
        drawInfoLine("Order No.", String(poData.poNumber || 'N/A'));
        // --- <<< END ERROR FIX >>> ---

        let orderDateStr = 'N/A';
        if (poData.orderDate?.toDate) {
           try { orderDateStr = poData.orderDate.toDate().toLocaleDateString('en-GB'); } catch(e){ console.error("Error formatting date:", e)}
        }
        drawInfoLine("Date", orderDateStr);
        drawInfoLine("Status", poData.status || 'N/A');

        const rightColEndY = currentY;

        currentY = Math.max(leftColEndY, rightColEndY) + 20; // Y below taller column + spacing

        // --- 3. Prepare Table Data with Flex Details ---
        let totalQtySum = 0;
        // This array will hold data for AutoTable body
        const tableBody = [];
        // This array will hold data needed for custom drawing in hooks
        const detailedItemData = [];

        poData.items.forEach((item, index) => {
            let qtyStr = '-';
            let sqfStr = '-';
            let productName = item.productName || 'N/A';
            let flexDetailsLines = []; // Store flex details for hook

            if (item.type === 'Sq Feet') {
                const area = item.printSqFt !== undefined ? parseFloat(item.printSqFt) : 0;
                sqfStr = area.toFixed(2);
                totalQtySum += 0;

                const w = item.realWidth || item.width || '?';
                const h = item.realHeight || item.height || '?';
                const u = item.unit || item.inputUnit || 'units';
                const pw = item.printWidth || '?';
                const ph = item.printHeight || '?';
                const psf = item.printSqFt || '?';
                const rsf = item.realSqFt || '?';
                let wastage = parseFloat(psf) - parseFloat(rsf);
                wastage = (!isNaN(wastage) && wastage >= 0.01) ? wastage.toFixed(2) + ' sqft' : 'None';

                // Prepare lines for the hook
                flexDetailsLines.push(`  Real: ${w}x${h} ${u} (${rsf} sqft)`);
                flexDetailsLines.push(`  Print: ${pw}x${ph} (${psf} sqft)`);
                flexDetailsLines.push(`  Wastage: ${wastage}`);
            } else { // Qty
                const qty = parseInt(item.quantity || 0);
                qtyStr = `${qty}`;
                totalQtySum += qty;
            }
            const rateStr = typeof item.rate === 'number' ? item.rate.toFixed(2) : '-';
            const amountStr = typeof item.itemAmount === 'number' ? item.itemAmount.toFixed(2) : '-';

            // Add data to tableBody - PARTICULARS only contains product name now
            tableBody.push([ index + 1, productName, qtyStr, sqfStr, rateStr, amountStr ]);
            // Store details needed for hook
            detailedItemData.push({ flexDetails: flexDetailsLines });
        });

        // Prepare summary rows
        const summaryRows = [];
        if (totalQtySum > 0) {
             summaryRows.push([
                 { content: `Total Qty: ${totalQtySum}`, colSpan: 2, styles: { halign: 'left', fontStyle: 'bold', fontSize: defaultFontSize} },
                 {}, {}, {}, {} // Empty cells for remaining columns
             ]);
        }
         const finalTotalAmountStr = poData.totalAmount !== undefined ? poData.totalAmount.toFixed(2) : '0.00';
         summaryRows.push([
              { content: 'GRAND TOTAL', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fontSize: headerFontSize} },
              { content: `₹ ${finalTotalAmountStr}`, styles: { halign: 'right', fontStyle: 'bold', fontSize: headerFontSize} }
         ]);

        // --- 4. Define Table Styles ---
        const headStyles = {
            fillColor: tableHeaderBG, // Light Grey BG
            textColor: blackColor,    // Black Text
            fontStyle: 'bold',
            halign: 'center', valign: 'middle', fontSize: headerFontSize,
            cellPadding: {top: 6, right: 5, bottom: 6, left: 5}, // More padding
            lineWidth: 0.5, lineColor: borderColor
        };
        const bodyStyles = {
             fontSize: defaultFontSize, textColor: textColor,
             cellPadding: {top: 4, right: 5, bottom: 4, left: 5},
             valign: 'top', // Important for multi-line content
             lineWidth: 0.5, lineColor: borderColor
        };
        // Adjusted column widths
        const columnStyles = {
             0: { halign: 'center', cellWidth: 30 },    // S.No.
             1: { halign: 'left', cellWidth: 235 },   // Particulars
             2: { halign: 'right', cellWidth: 40 },   // Qty
             3: { halign: 'right', cellWidth: 50 },   // Sqf
             4: { halign: 'right', cellWidth: 60 },   // Unit Price
             5: { halign: 'right', cellWidth: 70 }    // Amount
        };

        // --- 5. Use didDrawCell Hook for Custom Rendering ---
        let addPageRequired = false;
        const didDrawCell = (data) => {
            // Custom drawing for Particulars column (index 1) in the main body
            if (data.column.dataKey === 1 && data.row.section === 'body') {
                const itemIndex = data.row.index; // Index in the original items array
                const itemDetails = detailedItemData[itemIndex]; // Get our stored details

                if (itemDetails && itemDetails.flexDetails.length > 0) {
                    // Manually draw the flex details below the product name

                    // Store current styles
                    const originalSize = data.doc.getFontSize();
                    const originalStyle = data.doc.getFont().fontStyle;
                    const originalColor = data.doc.getTextColor();

                    // Style for flex details
                    data.doc.setFont(undefined, 'normal');
                    data.doc.setFontSize(smallFontSize);
                    data.doc.setTextColor(subTextColor);

                    let lineY = data.cell.y + cellPadding.top + (defaultFontSize * 1.15); // Start below product name line
                    const lineStartX = data.cell.x + cellPadding.left;

                    itemDetails.flexDetails.forEach(line => {
                         // Check if drawing this line would exceed page boundary
                         if (lineY + smallFontSize > pageHeight - margin) {
                             addPageRequired = true; // Signal that a new page is needed *before* the next autoTable call
                             // We can't add page *during* hook, so we defer it
                             return; // Skip drawing this line on this page
                         }
                        data.doc.text(line.trim(), lineStartX, lineY);
                        lineY += smallFontSize + 2; // Move Y for next line
                    });

                    // Restore original styles
                    data.doc.setFontSize(originalSize);
                    data.doc.setFont(undefined, originalStyle);
                    data.doc.setTextColor(originalColor);
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
            didDrawCell: didDrawCell, // Use the hook for custom drawing
             // Calculate cell heights dynamically based on content
            didParseCell: function (data) {
                if (data.column.dataKey === 1 && data.row.section === 'body') {
                     // Increase cell height if flex details exist for this row
                     const itemIndex = data.row.index;
                     if (detailedItemData[itemIndex] && detailedItemData[itemIndex].flexDetails.length > 0) {
                          // Estimate required height: base height + (lines * line height)
                          const baseHeight = data.cell.styles.fontSize * 1.15; // Approx height for product name
                          const detailLineHeight = smallFontSize * 1.15;
                          const requiredHeight = baseHeight + (detailedItemData[itemIndex].flexDetails.length * detailLineHeight) + (cellPadding.top + cellPadding.bottom);
                          data.cell.height = Math.max(data.cell.height, requiredHeight);
                     }
                }
            },
            margin: { left: margin, right: margin }
        });
        currentY = doc.lastAutoTable.finalY; // Y after item table

        // Check if a page break is needed *before* drawing summary
        if (addPageRequired || currentY > pageHeight - 80) { // Check space for summary + footer
             doc.addPage();
             currentY = margin;
             addPageRequired = false; // Reset flag
        }


        // --- 7. Call autoTable for Summary Rows ---
         doc.autoTable({
            body: summaryRows,
            startY: currentY,
            theme: 'grid',
            showHead: false,
            bodyStyles: {
                 fontSize: defaultFontSize, textColor: textColor,
                 cellPadding: {top: 5, right: 5, bottom: 5, left: 5}, // Adjusted padding
                 valign: 'middle', lineWidth: 0.5, lineColor: borderColor, fontStyle: 'bold'
             },
             columnStyles: columnStyles,
             margin: { left: margin, right: margin }
        });
        currentY = doc.lastAutoTable.finalY + 20; // Y after summary table

        // --- 8. Footer Sections ---
        // Check page break before footer sections
        if (currentY > pageHeight - 80) { doc.addPage(); currentY = margin; }

        // Amount in Words
        // !!! Placeholder - Requires a number-to-words library/function !!!
        const amountInWords = "Rupees ... Only";
        doc.setFontSize(defaultFontSize);
        doc.setFont(undefined, 'bold');
        doc.text("Amount (in words):", margin, currentY);
        doc.setFont(undefined, 'normal');
        doc.text(amountInWords, margin + 95, currentY);
        currentY += 20;

        // Terms / Declaration
        if (currentY > pageHeight - 60) { doc.addPage(); currentY = margin; }
        doc.setFont(undefined, 'bold');
        doc.text("Terms / Declaration:", margin, currentY);
        currentY += 12;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(smallFontSize); // Smaller font for terms
        const terms = [
             "- Subject to Batadu jurisdiction.",
             "- Goods once sold will not be taken back.",
             // Add more terms if needed
        ];
         terms.forEach(term => {
             if (currentY > pageHeight - 40) { doc.addPage(); currentY = margin; }
             doc.text(term, margin, currentY);
             currentY += (smallFontSize + 2); // Adjust line height for small font
         });
        // currentY += 15; // Space after terms (already included in loop)

        // --- 9. Signature ---
         // Ensure signature is at the bottom
         const signatureY = pageHeight - margin - 10; // Position from bottom
         if (currentY > signatureY - 10 ) { doc.addPage(); } // Add page if terms overlap signature area

        doc.setFontSize(defaultFontSize); // Back to default size
        doc.setFont(undefined, 'bold');
        doc.text(companySignature, pageWidth - margin, signatureY, { align: 'right' });

        // --- 10. Save PDF ---
        const filename = `PO-${poData.poNumber || poData.id?.substring(0, 6) || 'PurchaseOrder'}.pdf`;
        doc.save(filename);
        console.log("PDF Generated (v7 Design):", filename);

    } catch (error) {
        console.error("Error generating PDF (v7 Design):", error);
        alert(`Could not generate PDF. Error: ${error.message}. Check console for more details.`);
    }
}

// Export the functions
export { generatePoPdf, calculateFlexDimensions };