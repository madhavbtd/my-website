// js/utils.js

// --- PDF Generation Function ---

// Make sure jsPDF and autoTable are loaded (e.g., via script tags in HTML)
const { jsPDF } = window.jspdf;

async function generatePoPdf(poData, supplierData) {
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
        doc.text("Your Company Address Line 1", pageWidth - 15, currentY + 4, { align: 'right' }); // <-- अपना पता डालें
        doc.text("Your City, Pincode", pageWidth - 15, currentY + 8, { align: 'right' });       // <-- अपना शहर/पिन डालें
        doc.text("Mobile: Your Mobile", pageWidth - 15, currentY + 12, { align: 'right' });     // <-- अपना मोबाइल डालें
        doc.text("Email: your.email@example.com", pageWidth - 15, currentY + 16, { align: 'right' });// <-- अपना ईमेल डालें
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
        let supplierY = currentY + 5; // Start position for supplier details
        doc.text(supplierData.name || '', col1X, supplierY); supplierY += 4;
        if (supplierData.companyName) { doc.text(supplierData.companyName, col1X, supplierY); supplierY += 4; }
        if (supplierData.address) { doc.text(supplierData.address, col1X, supplierY); supplierY += 4; }
        if (supplierData.whatsappNo) { doc.text(`Ph: ${supplierData.whatsappNo}`, col1X, supplierY); supplierY += 4; }
        if (supplierData.email) { doc.text(`Email: ${supplierData.email}`, col1X, supplierY); supplierY += 4; }
        if (supplierData.gstNo) { doc.text(`GST: ${supplierData.gstNo}`, col1X, supplierY); supplierY += 4; }

        // Column 2: PO Info
        let poInfoY = currentY + 5; // Start position for PO info
        doc.setFont(undefined, 'bold');
        doc.text("PO Number:", col2X, poInfoY);
        doc.setFont(undefined, 'normal');
        doc.text(poData.poNumber || 'N/A', col2X + 30, poInfoY); poInfoY += 5;

        doc.setFont(undefined, 'bold');
        doc.text("Order Date:", col2X, poInfoY);
        doc.setFont(undefined, 'normal');
        let orderDateStr = 'N/A';
        if (poData.orderDate && poData.orderDate.toDate) {
           try { orderDateStr = poData.orderDate.toDate().toLocaleDateString('en-GB'); } catch(e){}
        }
        doc.text(orderDateStr, col2X + 30, poInfoY); poInfoY += 5;

        // Ensure currentY moves past the taller column
        currentY = Math.max(supplierY, poInfoY) + 5; // Move down past this section

        // ----- Items Table -----
        const tableHeaders = [["#", "Product Name", "Details", "Rate", "Amount"]];
        const tableBody = poData.items.map((item, index) => {
            let details = '';
            if (item.type === 'Sq Feet') {
                // Include real size in details as well? Optional.
                 details = `Size: ${item.printWidth}x${item.printHeight} ${item.unit}\n(Print Area: ${item.printSqFt} sq ft)`;
            } else { // Qty
                details = `Qty: ${item.quantity}`;
            }
            const rateStr = typeof item.rate === 'number' ? item.rate.toFixed(2) : '-';
            const amountStr = typeof item.itemAmount === 'number' ? item.itemAmount.toFixed(2) : '-';

            return [
                index + 1,
                item.productName || 'N/A',
                details,
                rateStr + (item.type === 'Sq Feet' ? '/sqft' : '/unit'),
                amountStr
            ];
        });

        doc.autoTable({
            head: tableHeaders,
            body: tableBody,
            startY: currentY,
            theme: 'grid',
            headStyles: { fillColor: [22, 160, 133], textColor: 255, fontStyle: 'bold', halign: 'center' },
            columnStyles: {
                 0: { halign: 'right', cellWidth: 10 }, // Sr No align right
                 1: { halign: 'left', cellWidth: 60 },   // Product Name
                 2: { halign: 'left', cellWidth: 'auto'}, // Details
                 3: { halign: 'right', cellWidth: 30},  // Rate
                 4: { halign: 'right', cellWidth: 30}   // Amount
            },
            didDrawPage: function (data) { /* Footer can be added */ }
        });

        currentY = doc.lastAutoTable.finalY + 15;

        // ----- Totals -----
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text("Total Amount:", pageWidth - 65, currentY, { align: 'left' });
        doc.setFont(undefined, 'normal');
        doc.text(`Rs. ${poData.totalAmount !== undefined ? poData.totalAmount.toFixed(2) : '0.00'}`, pageWidth - 15, currentY, { align: 'right' });
        currentY += 10;

        // ----- Notes -----
        if (poData.notes) {
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text("Notes:", 15, currentY);
            doc.setFont(undefined, 'normal');
            const splitNotes = doc.splitTextToSize(poData.notes, pageWidth - 30);
            doc.text(splitNotes, 15, currentY + 5);
            currentY += (splitNotes.length * 4) + 5;
        }

        // ----- Terms & Conditions / Footer -----
        const bottomMargin = 15;
        const termsY = pageHeight - bottomMargin - 15; // Adjust position slightly up
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text("Terms & Conditions: 1. Payment: Advance/Due. 2. Delivery: As per schedule.", 15, termsY); // Example T&C
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


// --- Function for Flex Calculation (Keep it here or in new_po.js) ---
function calculateFlexDimensions(unit, width, height) {
    // ... (The full code for this function should be here) ...
    // Example placeholder:
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


// +++++ Export the function +++++
export { generatePoPdf, calculateFlexDimensions };
// ++++++++++++++++++++++++++++++++