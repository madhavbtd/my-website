// js/utils.js - v6 (New PDF Design based on INV290.pdf, Error Fix, No Logo, Flex Details)

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


// --- PDF Generation Function (New Design v6) ---
async function generatePoPdf(poData, supplierData) {
    // 1. jsPDF Check & Init
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
        console.error("jsPDF library (window.jspdf.jsPDF) not found!");
        alert("Error: PDF Library not loaded correctly. Cannot generate PDF.");
        return;
    }
    if (typeof window.jspdf.jsPDF.API.autoTable !== 'function') {
        console.error("jsPDF autoTable plugin not found!");
        alert("Error: PDF AutoTable Plugin not loaded correctly. Cannot generate PDF table.");
        return;
    }
    const { jsPDF } = window.jspdf;

    console.log("Generating PDF (v6 Design) for PO:", poData);
    console.log("Supplier Data for PDF:", supplierData);

    if (!poData || !poData.items || !supplierData) {
        alert("Error: Missing data to generate PDF.");
        console.error("Missing poData or items or supplierData for PDF generation");
        return;
    }

    // --- <<<<< आपकी कंपनी की डिटेल्स >>>>> ---
    const companyName = "Madhav Offset"; // आपका नाम
    const companyAddress = "Head Office: Moodh Market, Batadu"; // आपका पता
    const companyContact = "Mobile: 9549116541"; // आपका संपर्क
    const companySignature = "For, Madhav Offset"; // नीचे सिग्नेचर के लिए
    // ------------------------------------

    try {
        const doc = new jsPDF('p', 'pt', 'a4'); // Use points, A4 size
        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;
        const margin = 40; // Margin in points
        const contentWidth = pageWidth - (margin * 2);
        let currentY = margin;

        // --- Define Colors ---
        const headerColor = '#0056b3'; // आपका प्राइमरी नीला रंग
        const textColor = '#333333';
        const borderColor = '#CCCCCC';
        const whiteColor = '#FFFFFF';
        const blackColor = '#000000';
        const subTextColor = '#555555'; // थोड़ा हल्का टेक्स्ट

        // --- Set default text color & font ---
        doc.setTextColor(textColor);
        doc.setFont('helvetica', 'normal'); // आप चाहें तो 'Poppins' जैसा फॉन्ट लोड कर सकते हैं, पर वह जटिल है

        // --- 1. Header ---
        // Company Info (Right Aligned)
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(companyName, pageWidth - margin, currentY, { align: 'right' });
        currentY += 15;
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        const addressLines = doc.splitTextToSize(companyAddress, 180); // चौड़ाई एडजस्ट करें
        doc.text(addressLines, pageWidth - margin, currentY, { align: 'right' });
        currentY += (addressLines.length * 10) + 2;
        doc.text(companyContact, pageWidth - margin, currentY, { align: 'right' });
        currentY += 15; // हेडर के बाद थोड़ी जगह

        // Title (Centered)
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text("PURCHASE ORDER", pageWidth / 2, currentY, { align: 'center' });
        currentY += 30;

        // --- 2. Supplier/PO Info ---
        const infoStartY = currentY;
        const halfWidth = contentWidth / 2;
        const gap = 15;

        // Left Column: Supplier Details ("Issued To:")
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text("Issued To:", margin, currentY);
        currentY += 12;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        if(supplierData.name) doc.text(supplierData.name, margin, currentY);
        currentY += 13;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        if (supplierData.address) {
             const supAddressLines = doc.splitTextToSize(supplierData.address, halfWidth - gap);
             doc.text(supAddressLines, margin, currentY);
             currentY += (supAddressLines.length * 10) + 2;
        } else { currentY += 10; }
        if (supplierData.whatsappNo) { doc.text(`Contact: ${supplierData.whatsappNo}`, margin, currentY); currentY += 10; }
        if (supplierData.gstNo) { doc.text(`GST No.: ${supplierData.gstNo}`, margin, currentY); currentY += 10; }
        const leftColEndY = currentY;

        // Right Column: PO Details
        currentY = infoStartY; // Reset Y
        const col2X = margin + halfWidth + gap;
        const col2LabelWidth = 55;
        const col2ValueX = col2X + col2LabelWidth + 5;

        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');

        doc.text("Order No.", col2X, currentY, { align: 'left', maxWidth: col2LabelWidth });
        // --- <<< ERROR FIX APPLIED HERE >>> ---
        doc.text(`: ${String(poData.poNumber || 'N/A')}`, col2ValueX, currentY); // PO Number को स्ट्रिंग में बदला
        // --- <<< END ERROR FIX >>> ---
        currentY += 13;

        doc.text("Date", col2X, currentY, { align: 'left', maxWidth: col2LabelWidth });
        let orderDateStr = 'N/A';
        if (poData.orderDate?.toDate) {
           try { orderDateStr = poData.orderDate.toDate().toLocaleDateString('en-GB'); } catch(e){ console.error("Error formatting date:", e)}
        }
        doc.text(`: ${orderDateStr}`, col2ValueX, currentY);
        currentY += 13;

        doc.text("Status", col2X, currentY, { align: 'left', maxWidth: col2LabelWidth });
        doc.text(`: ${poData.status || 'N/A'}`, col2ValueX, currentY);
        currentY += 13;
        const rightColEndY = currentY;

        currentY = Math.max(leftColEndY, rightColEndY) + 20; // नीचे का Y सेट करें

        // --- 3. Prepare Table Data with Flex Details ---
        let totalQtySum = 0;
        const tableBody = poData.items.map((item, index) => {
            let qtyStr = '-';
            let sqfStr = '-';
            let particularsContent = []; // Use array for multi-line content

            // Add product name (Bold)
            particularsContent.push({ content: item.productName || 'N/A', styles: { fontStyle: 'bold' } });

            // Add Flex Details below product name for Sq Feet items
            if (item.type === 'Sq Feet') {
                const area = item.printSqFt !== undefined ? parseFloat(item.printSqFt) : 0;
                sqfStr = area.toFixed(2); // SqFt value for its column
                totalQtySum += 0; // Sqft items don't add to Qty sum

                // Format dimension details for Particulars column (smaller font, indented)
                const w = item.realWidth || item.width || '?';
                const h = item.realHeight || item.height || '?';
                const u = item.unit || item.inputUnit || 'units';
                const pw = item.printWidth || '?';
                const ph = item.printHeight || '?';
                const psf = item.printSqFt || '?';
                const rsf = item.realSqFt || '?';
                let wastage = parseFloat(psf) - parseFloat(rsf);
                wastage = (!isNaN(wastage) && wastage >= 0.01) ? wastage.toFixed(2) + ' sqft' : 'None';

                particularsContent.push({ content: `  Real: ${w}x${h} ${u} (${rsf} sqft)`, styles: { fontSize: 8, textColor: subTextColor } });
                particularsContent.push({ content: `  Print: ${pw}x${ph} (${psf} sqft)`, styles: { fontSize: 8, textColor: subTextColor } });
                particularsContent.push({ content: `  Wastage: ${wastage}`, styles: { fontSize: 8, textColor: subTextColor } });

            } else { // Qty
                const qty = parseInt(item.quantity || 0);
                qtyStr = `${qty}`;
                totalQtySum += qty;
            }
            const rateStr = typeof item.rate === 'number' ? item.rate.toFixed(2) : '-';
            const amountStr = typeof item.itemAmount === 'number' ? item.itemAmount.toFixed(2) : '-';

            return [ index + 1, particularsContent, qtyStr, sqfStr, rateStr, amountStr ];
        });

        // Add summary rows
        const summaryRows = [];
        if (totalQtySum > 0) {
             summaryRows.push([
                 { content: `Total Qty: ${totalQtySum}`, colSpan: 2, styles: { halign: 'left', fontStyle: 'bold'} },
                 { content: ''}, { content: '' }, { content: '' }, { content: '' }
             ]);
        }
         const finalTotalAmountStr = poData.totalAmount !== undefined ? poData.totalAmount.toFixed(2) : '0.00';
         summaryRows.push([
              { content: 'GRAND TOTAL', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold'} },
              { content: `₹ ${finalTotalAmountStr}`, styles: { halign: 'right', fontStyle: 'bold'} }
         ]);

        // --- 4. Define Table Styles ---
        const headStyles = {
            fillColor: headerColor, textColor: whiteColor, fontStyle: 'bold',
            halign: 'center', valign: 'middle', fontSize: 9, cellPadding: 5,
            lineWidth: 0.5, lineColor: borderColor
        };
        const bodyStyles = {
             fontSize: 9, textColor: textColor, cellPadding: {top: 4, right: 5, bottom: 4, left: 5},
             valign: 'top', lineWidth: 0.5, lineColor: borderColor
        };
        // Adjust column widths for new content
        const columnStyles = {
             0: { halign: 'center', cellWidth: 30 },    // S.No.
             1: { halign: 'left', cellWidth: 235 },   // Particulars (Wider)
             2: { halign: 'right', cellWidth: 40 },   // Qty
             3: { halign: 'right', cellWidth: 50 },   // Sqf
             4: { halign: 'right', cellWidth: 60 },   // Unit Price
             5: { halign: 'right', cellWidth: 70 }    // Amount
        };

        // --- 5. Call doc.autoTable() for Items ---
        doc.autoTable({
            head: [['S.No.', 'PARTICULARS', 'QTY', 'SQF', 'UNIT PRICE', 'AMOUNT']],
            body: tableBody,
            startY: currentY,
            theme: 'grid',
            headStyles: headStyles,
            bodyStyles: bodyStyles,
            columnStyles: columnStyles,
            margin: { left: margin, right: margin }
        });
        currentY = doc.lastAutoTable.finalY; // Get Y position after table

        // --- 6. Call doc.autoTable() for Summary Rows ---
         doc.autoTable({
            body: summaryRows,
            startY: currentY,
            theme: 'grid',
            showHead: false, // No header for summary rows
            bodyStyles: { // Specific styles for summary rows
                 fontSize: 9, textColor: textColor, cellPadding: {top: 4, right: 5, bottom: 4, left: 5},
                 valign: 'middle', lineWidth: 0.5, lineColor: borderColor, fontStyle: 'bold'
             },
             columnStyles: columnStyles, // Use same widths for alignment
             margin: { left: margin, right: margin }
        });
        currentY = doc.lastAutoTable.finalY + 15; // Position below summary

        // --- 7. Footer Sections ---
        // Amount in Words (Placeholder)
        // !!! इसे काम करने के लिए नंबर को शब्दों में बदलने वाला फंक्शन चाहिए !!!
        const amountInWords = "Rupees ... Only";
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text("Amount (in words):", margin, currentY);
        doc.setFont(undefined, 'normal');
        doc.text(amountInWords, margin + 95, currentY);
        currentY += 20;

        // Terms / Declaration
        doc.setFont(undefined, 'bold');
        doc.text("Terms / Declaration:", margin, currentY);
        currentY += 12;
        doc.setFont(undefined, 'normal');
        // --- <<< आप यहाँ अपनी शर्तें जोड़ सकते हैं >>> ---
        const terms = [
             "- Subject to Batadu jurisdiction.",
             "- Goods once sold will not be taken back.",
             // Add more terms if needed
        ];
         terms.forEach(term => {
             if (currentY > pageHeight - 60) { doc.addPage(); currentY = margin; } // Page break check before terms
             doc.text(term, margin, currentY);
             currentY += 10;
         });
        currentY += 15;

        // --- 8. Signature ---
        if (currentY > pageHeight - 40) { // Check space before signature
            doc.addPage();
            currentY = margin;
        }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(companySignature, pageWidth - margin, pageHeight - margin - 10, { align: 'right' }); // Position signature

        // --- 9. Save PDF ---
        const filename = `PO-${poData.poNumber || poData.id?.substring(0, 6) || 'PurchaseOrder'}.pdf`;
        doc.save(filename);
        console.log("PDF Generated (v6 Design):", filename);

    } catch (error) {
        console.error("Error generating PDF (v6 Design):", error);
        alert(`Could not generate PDF. Error: ${error.message}. Check console for more details.`);
    }
}

// Export the functions
export { generatePoPdf, calculateFlexDimensions };