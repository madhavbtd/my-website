// js/utils.js (v4 - Updated PDF Design with User Details)

// --- Function for Flex Calculation (यह फ़ंक्शन अपरिवर्तित है) ---
function calculateFlexDimensions(unit, width, height) {
    console.log(`Calculating flex: Unit=${unit}, W=${width}, H=${height}`);
    const mediaWidthsFt = [3, 4, 5, 6, 8, 10]; // Standard media widths in feet

    // Convert input dimensions to feet
    let wFt = (unit === 'inches') ? parseFloat(width || 0) / 12 : parseFloat(width || 0);
    let hFt = (unit === 'inches') ? parseFloat(height || 0) / 12 : parseFloat(height || 0);

    // Basic validation
    if (isNaN(wFt) || isNaN(hFt) || wFt <= 0 || hFt <= 0) {
        return { realSqFt: 0, printWidth: 0, printHeight: 0, printSqFt: 0, inputUnit: unit };
    }

    const realSqFt = wFt * hFt; // Actual area of the design
    console.log(`Real dimensions in Ft: W=${wFt.toFixed(2)}, H=${hFt.toFixed(2)}, RealSqFt=${realSqFt.toFixed(2)}`);

    // Option 1: Fit width to nearest larger media width, keep height same
    const mediaWidthFitW = mediaWidthsFt.find(mw => mw >= wFt);
    let printWidthFt1 = mediaWidthFitW || wFt; // Use actual width if larger than max media
    let printHeightFt1 = hFt;
    let printSqFt1 = printWidthFt1 * printHeightFt1;
    if (!mediaWidthFitW) console.warn(`Width ${wFt.toFixed(2)}ft exceeds max media width. Using actual width.`);

    // Option 2: Fit height to nearest larger media width (assuming roll can be rotated), keep width same
    const mediaWidthFitH = mediaWidthsFt.find(mw => mw >= hFt);
    let printWidthFt2 = wFt;
    let printHeightFt2 = mediaWidthFitH || hFt; // Use actual height if larger than max media
    let printSqFt2 = printWidthFt2 * printHeightFt2;
    if (!mediaWidthFitH) console.warn(`Height ${hFt.toFixed(2)}ft exceeds max media width. Using actual height.`);

    let finalPrintWidthFt, finalPrintHeightFt, finalPrintSqFt;

    // Choose the option with less wastage (smaller printSqFt)
    // If fitting height isn't possible (mediaWidthFitH is undefined), default to fitting width
    if (printSqFt1 <= printSqFt2 || !mediaWidthFitH) {
         finalPrintWidthFt = printWidthFt1;
         finalPrintHeightFt = printHeightFt1;
         finalPrintSqFt = printSqFt1;
         console.log(`Choosing Option 1 (Fit Width): MediaW=${printWidthFt1.toFixed(2)}ft, RealH=${printHeightFt1.toFixed(2)}ft, PrintSqFt=${printSqFt1.toFixed(2)}`);
    } else {
         finalPrintWidthFt = printWidthFt2;
         finalPrintHeightFt = printHeightFt2;
         finalPrintSqFt = printSqFt2;
         console.log(`Choosing Option 2 (Fit Height): RealW=${printWidthFt2.toFixed(2)}ft, MediaH=${printHeightFt2.toFixed(2)}ft, PrintSqFt=${printSqFt2.toFixed(2)}`);
    }

    // Convert final print dimensions back to the original input unit for display consistency
    let displayPrintWidth = (unit === 'inches') ? finalPrintWidthFt * 12 : finalPrintWidthFt;
    let displayPrintHeight = (unit === 'inches') ? finalPrintHeightFt * 12 : finalPrintHeightFt;

    return {
        realSqFt: realSqFt.toFixed(2), // Actual design area
        printWidth: displayPrintWidth.toFixed(2), // Final width on media (in original unit)
        printHeight: displayPrintHeight.toFixed(2), // Final height on media (in original unit)
        printSqFt: finalPrintSqFt.toFixed(2), // Billing area in Square Feet
        inputUnit: unit // The unit used for input width/height
    };
}


// --- PDF Generation Function (Updated Design with User Details) ---
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

    console.log("Generating PDF (New Design - User Details) for PO:", poData);
    console.log("Supplier Data for PDF:", supplierData);

    if (!poData || !poData.items || !supplierData) {
        alert("Error: Missing data to generate PDF.");
        console.error("Missing poData or items or supplierData for PDF generation");
        return;
    }

    try {
        const doc = new jsPDF('p', 'pt', 'a4'); // Use points, A4 size
        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;
        const margin = 40; // Margin in points
        const contentWidth = pageWidth - (margin * 2);
        let currentY = margin;

        // --- Define Colors ---
        const primaryColor = '#0D47A1'; // Dark Blue
        const whiteColor = '#FFFFFF';
        const blackColor = '#000000';
        const grayColor = '#333333'; // Darker gray for text

        // --- Set default text color & font ---
        doc.setTextColor(grayColor);
        doc.setFont('helvetica'); // Standard font

        // --- 3. Header ---
        // Company Info (Right Aligned) - USER DETAILS UPDATED
        const companyName = "MADHAV OFFSET";
        const companyAddress1 = "MOODH MARKET, BATADU, BARMER";
        const companyContact = "Contact : 9549116541";

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(companyName, pageWidth - margin, currentY, { align: 'right' });
        currentY += 15;
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(companyAddress1, pageWidth - margin, currentY, { align: 'right' });
        currentY += 12;
        doc.text(companyContact, pageWidth - margin, currentY, { align: 'right' });
        currentY += 25;

        // Title (Centered)
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(blackColor);
        doc.text("PURCHASE ORDER", pageWidth / 2, currentY, { align: 'center' });
        currentY += 30;
        doc.setTextColor(grayColor);

        // --- 4. Supplier/PO Info ---
        const infoStartY = currentY;
        const col1X = margin;
        const col2X = pageWidth / 2 + 20;
        const col2LabelX = col2X;
        const col2ValueX = col2X + 65;

        // Draw Blue Bar for "Issued To:"
        doc.setFillColor(primaryColor);
        doc.rect(margin, currentY, contentWidth, 20, 'F'); // Taller bar
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(whiteColor);
        doc.text("Issued To:", margin + 5, currentY + 13); // Vertically centered text
        currentY += 20 + 10; // Bar height + padding
        doc.setTextColor(grayColor);

        // Supplier Details (Left Column)
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        if(supplierData.name) doc.text(supplierData.name, col1X, currentY);
        currentY += 15;
        doc.setFont(undefined, 'normal');
        if (supplierData.address) {
             const addressLines = doc.splitTextToSize(supplierData.address, (pageWidth / 2) - margin - 10);
             doc.text(addressLines, col1X, currentY);
             currentY += (addressLines.length * 12) + 2; // Adjust Y based on lines
        } else {
             currentY += 12; // Space even if no address
        }
        if (supplierData.whatsappNo) { doc.text(`Contact: ${supplierData.whatsappNo}`, col1X, currentY); currentY += 12; }
        if (supplierData.gstNo) { doc.text(`GST: ${supplierData.gstNo}`, col1X, currentY); currentY += 12; }
        // Add other supplier details if needed

        const leftColEndY = currentY;

        // PO Details (Right Column) - Reset Y
        currentY = infoStartY + 20 + 10; // Start below blue bar
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');

        doc.text("Order No.", col2LabelX, currentY);
        doc.text(":", col2ValueX - 5, currentY);
        doc.text(poData.poNumber || 'N/A', col2ValueX, currentY);
        currentY += 15;

        doc.text("Date", col2LabelX, currentY);
        doc.text(":", col2ValueX - 5, currentY);
        let orderDateStr = 'N/A';
        if (poData.orderDate && poData.orderDate.toDate) {
           try { orderDateStr = poData.orderDate.toDate().toLocaleDateString('en-GB'); } catch(e){} // dd/mm/yyyy
        }
        doc.text(orderDateStr, col2ValueX, currentY);
        currentY += 15;

        const rightColEndY = currentY;

        // Set currentY below the taller column
        currentY = Math.max(leftColEndY, rightColEndY) + 20;

        // --- 5. Prepare Table Data ---
        let totalQtySum = 0;
        let totalSqFtSum = 0;

        const tableBody = poData.items.map((item, index) => {
            let qtyStr = '';
            let sqfStr = '';

            if (item.type === 'Sq Feet') {
                const area = item.printSqFt !== undefined ? parseFloat(item.printSqFt) : 0;
                sqfStr = area.toFixed(2);
                totalSqFtSum += area;
            } else { // Qty
                const qty = parseInt(item.quantity || 0);
                qtyStr = `${qty}`;
                totalQtySum += qty;
            }
            const rateStr = typeof item.rate === 'number' ? item.rate.toFixed(2) : '-';
            const amountStr = typeof item.itemAmount === 'number' ? item.itemAmount.toFixed(2) : '-';

            return [ index + 1, item.productName || 'N/A', qtyStr, sqfStr, rateStr, amountStr ];
        });

        // Add Total Qty Row (if applicable)
        if (totalQtySum > 0) {
             tableBody.push([
                 { content: `Total Qty: ${totalQtySum}`, colSpan: 4, styles: { halign: 'left' } }, // Spanning applied via hook
                 { content: ''}, { content: ''}
             ]);
        }

        // Add final TOTAL row
         const finalTotalAmountStr = poData.totalAmount !== undefined ? poData.totalAmount.toFixed(2) : '0.00';
         tableBody.push([
              { content: 'TOTAL', colSpan: 4, styles: { halign: 'right'} }, // Spanning applied via hook
              { content: '' }, // Empty Unit Price
              { content: `₹ ${finalTotalAmountStr}`, styles: { halign: 'right'} } // Amount
         ]);


        // --- 6. Define Table Styles ---
        const headStyles = {
            fillColor: primaryColor, textColor: whiteColor, fontStyle: 'bold',
            halign: 'center', valign: 'middle', fontSize: 10, cellPadding: 5,
        };
        const bodyStyles = {
             fontSize: 9, textColor: grayColor, cellPadding: 4, valign: 'middle'
        };
        const columnStyles = {
             0: { halign: 'center', cellWidth: 30 },    // S.No.
             1: { halign: 'left', cellWidth: 200 },   // Particulars
             2: { halign: 'right', cellWidth: 40 },   // Qty
             3: { halign: 'right', cellWidth: 45 },   // Sqf
             4: { halign: 'right', cellWidth: 60 },   // Unit Price
             5: { halign: 'right', cellWidth: 70 }    // Amount
        };

         // Hook to style specific rows/cells
         const didParseCell = (data) => {
              // Style the final TOTAL row (last row)
              if (data.row.index === tableBody.length - 1) {
                  data.cell.styles.fillColor = '#f0f0f0'; // Light gray
                  data.cell.styles.textColor = blackColor;
                  data.cell.styles.fontStyle = 'bold';
                  data.cell.styles.fontSize = 10; // Match header font size
              }
              // Style the Total Qty row (second to last if total exists and qty > 0)
              if (totalQtySum > 0 && data.row.index === tableBody.length - 2) {
                   data.cell.styles.fontStyle = 'bold';
                   data.cell.styles.fontSize = 10;
              }
          };

        // --- 7. Call doc.autoTable() ---
        doc.autoTable({
            head: [['S.No.', 'PARTICULARS', 'QTY', 'SQF', 'UNIT PRICE', 'AMOUNT']],
            body: tableBody,
            startY: currentY,
            theme: 'grid', // Use grid for borders like sample
            headStyles: headStyles,
            bodyStyles: bodyStyles,
            columnStyles: columnStyles,
            didParseCell: didParseCell, // Apply custom styling
            margin: { left: margin, right: margin }
        });

        currentY = doc.lastAutoTable.finalY + 15; // Position below table

        // --- 8. Totals Section ---
        // Amount in Words (Placeholder)
        const amountInWords = "Rupees ... Only"; // !!! Requires number-to-words function !!!
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text("Amount (in words):", margin, currentY);
        doc.setFont(undefined, 'normal');
        doc.text(amountInWords, margin + 95, currentY);
        currentY += 15;

        // Terms / Declaration (Placeholder)
        doc.setFont(undefined, 'bold');
        doc.text("Terms / Declaration:", margin, currentY);
        doc.setFont(undefined, 'normal');
        // !!! Add your terms here !!!
        // doc.text("- Term 1...", margin, currentY + 12);
        currentY += 25;

        // --- 9. Final Total Bar (Skipped as total is in table now) ---

        // --- 10. Footer ---
        if (currentY > pageHeight - 50) { // Check space
            doc.addPage();
            currentY = margin;
        }
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        // Footer Text - USER DETAILS UPDATED
        const footerText = "For, MADHAV OFFSET";
        doc.text(footerText, pageWidth - margin, pageHeight - margin, { align: 'right' });

        // --- 11. Save PDF ---
        const filename = `PO-${poData.poNumber || poData.id?.substring(0, 6) || 'PurchaseOrder'}.pdf`;
        doc.save(filename);
        console.log("PDF Generated (New Design - User Details Updated):", filename);

    } catch (error) {
        console.error("Error generating PDF (New Design):", error);
        alert("Could not generate PDF. Check console for errors.");
    }
}

// +++++ Export the functions +++++
// सुनिश्चित करें कि दोनों फ़ंक्शन एक्सपोर्ट किए गए हैं
export { generatePoPdf, calculateFlexDimensions };
// ++++++++++++++++++++++++++++++++