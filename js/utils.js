// js/utils.js - v2 (Fix jsPDF loading)

// --- PDF Generation Function ---
async function generatePoPdf(poData, supplierData) {
    // --- Get jsPDF inside the function ---
    // Ensure jsPDF is loaded when this function is CALLED
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
         console.error("jsPDF library (window.jspdf.jsPDF) not found! Make sure it's loaded on the calling page or included globally.");
         alert("Error: PDF Library not loaded correctly. Cannot generate PDF.");
         return; // Stop if library isn't loaded
    }
    const { jsPDF } = window.jspdf;
    // ------------------------------------

    console.log("Generating PDF for PO:", poData);
    console.log("Supplier Data for PDF:", supplierData);

    if (!poData || !poData.items || !supplierData) {
        alert("Error: Missing data to generate PDF.");
        console.error("Missing poData or items or supplierData for PDF generation");
        return;
    }

    try {
        const doc = new jsPDF();
        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;
        let currentY = 15;

        // ----- PDF Header -----
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text("Madhav MultyPrint", pageWidth - 15, currentY, { align: 'right' });
        doc.setFont(undefined, 'normal');
        // !!! अपना सही पता, शहर, मोबाइल, ईमेल यहाँ डालें !!!
        doc.text("Shop No. X, Market Name", pageWidth - 15, currentY + 4, { align: 'right' });
        doc.text("Sujangarh, Rajasthan", pageWidth - 15, currentY + 8, { align: 'right' });
        doc.text("Mobile: 9876543210", pageWidth - 15, currentY + 12, { align: 'right' });
        doc.text("email@example.com", pageWidth - 15, currentY + 16, { align: 'right' });
        currentY += 25;

        // ----- Document Title -----
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text("PURCHASE ORDER", pageWidth / 2, currentY, { align: 'center' });
        currentY += 10;

        // ----- Supplier & PO Info -----
        doc.setLineWidth(0.1);
        doc.line(15, currentY - 2, pageWidth - 15, currentY - 2);

        const col1X = 15;
        const col2X = pageWidth / 2 + 10;
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');

        // Column 1: Supplier Info
        doc.text("Supplier Details:", col1X, currentY);
        doc.setFont(undefined, 'normal');
        let supplierY = currentY + 5;
        if(supplierData.name) { doc.text(supplierData.name, col1X, supplierY); supplierY += 4; }
        if (supplierData.companyName) { doc.text(supplierData.companyName, col1X, supplierY); supplierY += 4; }
        if (supplierData.address) { doc.text(supplierData.address, col1X, supplierY); supplierY += 4; }
        if (supplierData.whatsappNo) { doc.text(`Ph: ${supplierData.whatsappNo}`, col1X, supplierY); supplierY += 4; }
        if (supplierData.email) { doc.text(`Email: ${supplierData.email}`, col1X, supplierY); supplierY += 4; }
        if (supplierData.gstNo) { doc.text(`GST: ${supplierData.gstNo}`, col1X, supplierY); supplierY += 4; }

        // Column 2: PO Info
        let poInfoY = currentY + 5;
        doc.setFont(undefined, 'bold'); doc.text("PO Number:", col2X, poInfoY);
        doc.setFont(undefined, 'normal'); doc.text(poData.poNumber || 'N/A', col2X + 30, poInfoY); poInfoY += 5;

        doc.setFont(undefined, 'bold'); doc.text("Order Date:", col2X, poInfoY);
        doc.setFont(undefined, 'normal');
        let orderDateStr = 'N/A';
        if (poData.orderDate && poData.orderDate.toDate) {
           try { orderDateStr = poData.orderDate.toDate().toLocaleDateString('en-GB'); } catch(e){}
        }
        doc.text(orderDateStr, col2X + 30, poInfoY); poInfoY += 5;

        currentY = Math.max(supplierY, poInfoY) + 5;

        // ----- Items Table -----
        const tableHeaders = [["#", "Product Name", "Details", "Rate", "Amount"]];
        const tableBody = poData.items.map((item, index) => {
            let details = '';
            if (item.type === 'Sq Feet') {
                 details = `Size: ${item.printWidth}x${item.printHeight} ${item.unit}\n(Print Area: ${item.printSqFt} sq ft)`;
            } else { details = `Qty: ${item.quantity}`; }
            const rateStr = typeof item.rate === 'number' ? item.rate.toFixed(2) : '-';
            const amountStr = typeof item.itemAmount === 'number' ? item.itemAmount.toFixed(2) : '-';
            return [ index + 1, item.productName || 'N/A', details, rateStr + (item.type === 'Sq Feet' ? '/sqft' : '/unit'), amountStr ];
        });

        doc.autoTable({
            head: tableHeaders, body: tableBody, startY: currentY, theme: 'grid',
            headStyles: { fillColor: [22, 160, 133], textColor: 255, fontStyle: 'bold', halign: 'center' },
            columnStyles: {
                 0: { halign: 'right', cellWidth: 10 }, 1: { halign: 'left', cellWidth: 60 },
                 2: { halign: 'left', cellWidth: 'auto'}, 3: { halign: 'right', cellWidth: 30},
                 4: { halign: 'right', cellWidth: 30}
            },
            didDrawPage: function (data) { /* Footer possible here */ }
        });

        currentY = doc.lastAutoTable.finalY + 15;

        // ----- Totals -----
        doc.setFontSize(11); doc.setFont(undefined, 'bold');
        doc.text("Total Amount:", pageWidth - 65, currentY, { align: 'left' });
        doc.setFont(undefined, 'normal');
        doc.text(`Rs. ${poData.totalAmount !== undefined ? poData.totalAmount.toFixed(2) : '0.00'}`, pageWidth - 15, currentY, { align: 'right' });
        currentY += 10;

        // ----- Notes -----
        if (poData.notes) {
            doc.setFontSize(10); doc.setFont(undefined, 'bold');
            doc.text("Notes:", 15, currentY);
            doc.setFont(undefined, 'normal');
            const splitNotes = doc.splitTextToSize(poData.notes, pageWidth - 30);
            doc.text(splitNotes, 15, currentY + 5);
            currentY += (splitNotes.length * 4) + 5;
        }

        // ----- Terms & Conditions / Footer -----
        const bottomMargin = 15; const termsY = pageHeight - bottomMargin - 15;
        doc.setFontSize(8); doc.setTextColor(100);
        doc.text("Terms & Conditions: 1. Payment: Advance/Due. 2. Delivery: As per schedule.", 15, termsY); // Example
        doc.text("For Madhav MultyPrint", pageWidth - 15, termsY + 5, { align: 'right' });
        doc.text("Authorized Signatory", pageWidth - 15, termsY + 10, { align: 'right' });

        // ----- Save PDF -----
        const filename = `PO-${poData.poNumber || poData.id?.substring(0, 6) || 'PurchaseOrder'}.pdf`;
        doc.save(filename);
        console.log("PDF Generated:", filename);

    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Could not generate PDF. Check console for errors.");
    }
}

// --- Function for Flex Calculation ---
function calculateFlexDimensions(unit, width, height) {
    // ... (Assume the full correct code is here) ...
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

// +++++ Export the functions +++++
export { generatePoPdf, calculateFlexDimensions };
// ++++++++++++++++++++++++++++++++