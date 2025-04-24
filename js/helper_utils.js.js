// js/utils.js - v11 (Generate PDF Replica of the 'View Details' Modal)

// --- Function for Flex Calculation (Not directly used in this PDF version, but keep for other calculations) ---
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


// --- PDF Generation Function (v11 - Modal Replica) ---
async function generatePoPdf(poData, supplierData) { // supplierData is not strictly needed for this version
    // 1. jsPDF Check & Init
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') { console.error("jsPDF library not found!"); alert("Error: PDF Library not loaded."); return; }
    if (typeof window.jspdf.jsPDF.API.autoTable !== 'function') { console.error("jsPDF autoTable plugin not found!"); alert("Error: PDF AutoTable Plugin not loaded."); return; }
    const { jsPDF } = window.jspdf;

    console.log("Generating PDF (v11 Modal Replica) for PO:", poData);

    // We only strictly need poData for this version
    if (!poData || !poData.items) {
        alert("Error: Missing PO items data to generate PDF.");
        console.error("Missing poData or items for PDF generation");
        return;
    }

    try {
        const doc = new jsPDF('p', 'pt', 'a4'); // Still use A4 portrait, content will fit
        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;
        const margin = 40;
        let currentY = margin;

        // --- Styles ---
        const textColor = '#333333';
        const defaultFontSize = 10; // Slightly larger default font
        const titleFontSize = 14;
        const tableHeaderBG = '#F5F5F5'; // Light Grey Header BG
        const blackColor = '#000000';
        const borderColor = '#CCCCCC'; // Slightly darker border

        doc.setTextColor(textColor);
        doc.setFont('helvetica', 'normal'); // Standard font
        doc.setFontSize(defaultFontSize);

        // --- 1. Title ---
        doc.setFontSize(titleFontSize);
        doc.setFont(undefined, 'bold');
        // Use String() for PO number just in case
        doc.text(`Details for PO #${String(poData.poNumber || poData.id)}`, margin, currentY);
        currentY += titleFontSize * 1.5; // Space after title

        // --- 2. Items Table ---
        const tableHead = [['#', 'Product Name', 'Type', 'Details (Qty/Size)', 'Rate', 'Party', 'Design', 'Amount']];

        const tableBody = poData.items.map((item, index) => {
            let detailStr = '';
            if (item.type === 'Sq Feet') {
                const w = item.realWidth || item.width || '?';
                const h = item.realHeight || item.height || '?';
                const u = item.unit || item.inputUnit || 'units';
                const psf = item.printSqFt || '?';
                const pw = item.printWidth || '?'; // Get print width
                const ph = item.printHeight || '?'; // Get print height
                 // Format matching modal screenshot
                detailStr = `W:${w} x H:${h} ${u} (Print: ${pw}x${ph} = ${psf} sqft)`;
            } else { // Qty
                detailStr = `Qty: ${item.quantity || '?'}`;
            }
            const rateStr = typeof item.rate === 'number' ? `₹${item.rate.toFixed(2)}` : '-';
            const amountStr = typeof item.itemAmount === 'number' ? `₹${item.itemAmount.toFixed(2)}` : '-';

            return [
                index + 1,
                item.productName || 'N/A',
                item.type || 'N/A',
                detailStr, // The combined details string
                rateStr,
                item.partyName || '-',
                item.designDetails || '-',
                amountStr
            ];
        });

        // Table Styles
        const headStyles = {
             fillColor: tableHeaderBG, textColor: blackColor, fontStyle: 'bold',
             halign: 'center', valign: 'middle', fontSize: defaultFontSize, // Header font same as body
             lineWidth: 0.5, lineColor: borderColor,
             cellPadding: {top: 8, right: 5, bottom: 8, left: 5} // More padding in header
        };
        const bodyStyles = {
             fontSize: defaultFontSize, valign: 'middle', // Middle align vertically
             lineWidth: 0.5, lineColor: borderColor,
             cellPadding: {top: 6, right: 5, bottom: 6, left: 5} // More padding in body
        };
        // Adjust column widths to better match the modal screenshot
        const columnStyles = {
             0: { halign: 'center', cellWidth: 25 },  // #
             1: { halign: 'left', cellWidth: 110 }, // Product Name
             2: { halign: 'left', cellWidth: 50 },  // Type
             3: { halign: 'left', cellWidth: 150 }, // Details (wider)
             4: { halign: 'right', cellWidth: 45 }, // Rate
             5: { halign: 'left', cellWidth: 50 },  // Party
             6: { halign: 'left', cellWidth: 50 },  // Design
             7: { halign: 'right', cellWidth: 55 }  // Amount
        };

        doc.autoTable({
            head: tableHead,
            body: tableBody,
            startY: currentY,
            theme: 'grid', // Simple grid theme
            headStyles: headStyles,
            bodyStyles: bodyStyles,
            columnStyles: columnStyles,
            margin: { left: margin, right: margin }
        });
        currentY = doc.lastAutoTable.finalY + 15; // Space after table

        // --- 3. Notes ---
        if (currentY > pageHeight - 60) { doc.addPage(); currentY = margin; }
        doc.setFontSize(defaultFontSize);
        doc.setFont(undefined, 'bold');
        doc.text("Notes:", margin, currentY);
        currentY += defaultFontSize + 3;
        doc.setFont(undefined, 'normal');
        if (poData.notes) {
             const notesLines = doc.splitTextToSize(poData.notes, contentWidth);
             doc.text(notesLines, margin, currentY);
        } else {
             doc.text("-", margin, currentY);
        }

        // --- 4. Save ---
        const filename = `PO_Details-${String(poData.poNumber || poData.id?.substring(0, 6) || 'Details')}.pdf`;
        doc.save(filename);
        console.log("PDF Generated (v11 Modal Replica):", filename);

    } catch (error) {
        console.error("Error generating PDF (v11 Modal Replica):", error);
        alert(`Could not generate PDF. Error: ${error.message}. Check console for more details.`);
    }
}

// Export the functions
export { generatePoPdf, calculateFlexDimensions };