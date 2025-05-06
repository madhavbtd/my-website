// js/supplier_account_detail.js - v8 (PO Status Update + Header Theme)

// --- Firebase Imports ---
import { db, auth } from './firebase-init.js';
import {
    doc, getDoc, collection, query, where, getDocs, orderBy as firestoreOrderBy,
    Timestamp, addDoc, serverTimestamp, updateDoc, deleteDoc, runTransaction, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Global State ---
let initializationAttempted = false;
let currentSupplierId = null;
let currentSupplierData = null;
let purchaseOrdersData = [];
let supplierPaymentsData = [];
let supplierAdjustmentsData = [];
let listenersAttached = false;
let supplierDetailPageInitialized = false;
let isRefreshingData = false;

// --- DOM Element Cache (Optional but good practice) ---
// Cache frequently accessed elements after DOM is ready if needed
// Example: let editSupplierModal, paymentMadeModal, etc.

// --- Helper Functions ---
function displayError(message, elementId = 'generalErrorDisplay') {
    console.error("Displaying Error:", message, "Target Element ID:", elementId);
    try {
        let errorElement = document.getElementById(elementId); // Try specific ID first
        if (!errorElement && elementId !== 'generalErrorDisplay') {
            errorElement = document.getElementById('generalErrorDisplay'); // Fallback
        }

        // Try finding error elements within active modals if specific ID not found
        if (!errorElement) {
             const activeModal = document.querySelector('.modal.active');
             if (activeModal) {
                 errorElement = activeModal.querySelector(`#${elementId}`);
             }
        }
        // Final fallback to general display
        if (!errorElement) {
             errorElement = document.getElementById('generalErrorDisplay');
        }

        if (errorElement) {
            errorElement.textContent = `Error: ${message}`;
            errorElement.style.display = 'block';
            errorElement.style.color = 'red'; // Ensure error color
            console.log("Error displayed in element:", errorElement.id);
             // Scroll into view if it's the general error display at the top
            if (errorElement.id === 'generalErrorDisplay') {
                errorElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } else {
            console.warn(`Error element '${elementId}' or fallback 'generalErrorDisplay' not found. Using alert.`);
            alert(`Error: ${message}`);
        }
    } catch(e) {
        console.error("Error within displayError function itself:", e);
        alert(`Critical Error Display Failure: ${message}`);
    }
}

function clearError(elementId = 'generalErrorDisplay') {
    try {
        let errorElement = document.getElementById(elementId);
         if (elementId === 'generalErrorDisplay') {
            // Clear all common modal errors as well when clearing general error
            const specificErrors = [
                'paymentMadeError', 'editSupplierError', 'supplierAdjustmentError',
                'supplierPaymentListError', 'supplierPoListError', 'accountSummaryError',
                'supplierLedgerError'
                // Add confirmation modal errors if they exist
             ];
            specificErrors.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.textContent = '';
                    el.style.display = 'none';
                }
            });
        }
        // Clear the specified or general error element
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
    } catch(e) {
        console.error("Error within clearError:", e);
    }
}

function getSupplierIdFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    } catch (e) {
        console.error("Error getting supplier ID from URL:", e);
        displayError("Could not read supplier ID from page address.");
        return null;
    }
}

function formatDate(timestamp, includeTime = false) {
    if (!timestamp || typeof timestamp.toDate !== 'function') { return '-'; }
    try {
        const date = timestamp.toDate();
        // Use 'en-IN' for Indian locale if desired, or 'en-GB' for dd/mm/yyyy common in India
        const optionsDate = { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' };
        const optionsTime = { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' };
        const formattedDate = date.toLocaleDateString('en-GB', optionsDate); // Example: 6 May 2025
        if (includeTime) {
            return `${formattedDate}, ${date.toLocaleTimeString('en-US', optionsTime)}`; // Example: 9:08 AM
        }
        return formattedDate;
    } catch (e) {
        console.error("Error formatting date:", timestamp, e);
        return 'Format Error';
    }
}

function formatCurrency(amount) {
    try {
        let numAmount = typeof amount === 'number' ? amount : parseFloat(amount);
        if (isNaN(numAmount)) {
            return '₹ --.--';
        }
        // Format as Indian Rupees
        return `₹ ${numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } catch (e) {
        console.error("Error formatting currency:", amount, e);
        return '₹ Format Error';
    }
}

function getStatusClass(status) {
    if (!status) return 'status-unknown';
    const normalizedStatus = status.toLowerCase().replace(/\s+/g, '-');
    // Add other PO statuses if they exist
    switch (normalizedStatus) {
        case 'new': return 'status-new';
        case 'sent': return 'status-sent';
        case 'processing': return 'status-processing'; // Example
        case 'shipped': return 'status-shipped'; // Example
        case 'delivered': return 'status-delivered'; // Example
        case 'completed': return 'status-completed'; // Example
        case 'cancelled': return 'status-cancel'; // Use consistent naming
        case 'printing': return 'status-printing';
        case 'product-received': return 'status-product-received';
        case 'po-paid': return 'status-po-paid'; // Might be redundant if using paymentStatus
        case 'cancel': return 'status-cancel';
        default: return 'status-unknown';
    }
}

function getPaymentStatusClass(status) {
    if (!status) return 'payment-status-pending';
    const normalizedStatus = status.toLowerCase().replace(/\s+/g, '-');
    switch (normalizedStatus) {
        case 'pending': return 'payment-status-pending';
        case 'partially-paid': return 'payment-status-partially-paid';
        case 'paid': return 'payment-status-paid';
        default: return 'payment-status-pending'; // Default to pending
    }
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        unsafe = String(unsafe || ''); // Ensure it's a string, handle null/undefined
    }
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// --- Helper Function to set Modal Header Theme ---
function setModalHeaderTheme(modalElement, themeClass) {
    if (!modalElement) return;
    const header = modalElement.querySelector('.modal-header');
    if (!header) {
        console.warn("Modal header not found for theming in element:", modalElement);
        return;
    }

    // Remove existing theme classes
    header.classList.remove(
        'modal-header-info',
        'modal-header-success',
        'modal-header-warning',
        'modal-header-danger',
        'modal-header-secondary'
    );

    // Add the new theme class if provided
    if (themeClass) {
        header.classList.add(themeClass);
    }
}

// --- Helper Function to Update PO Payment Status ---
async function updatePoPaymentStatus(poId) {
    if (!poId || !db) {
        console.error("Missing PO ID or DB connection for status update.");
        return Promise.reject("Missing PO ID or DB"); // Return a rejected promise
    }
    console.log(`Updating payment status for PO ID: ${poId}`);
    const poRef = doc(db, "purchaseOrders", poId); // Reference to the PO in purchaseOrders collection

    try {
        // 1. Get PO Data
        const poSnap = await getDoc(poRef);
        if (!poSnap.exists()) {
            console.error(`PO document ${poId} not found.`);
            return Promise.resolve(); // Resolve successfully if PO doesn't exist anymore
        }
        const poData = poSnap.data();
        const poTotalAmount = Number(poData.totalAmount || 0);

        // 2. Find all payments linked to this PO
        // Ensure you have the necessary Firestore index: `supplier_payments` collection, `linkedPoIds` field, Array configuration
        const paymentQuery = query(
            collection(db, "supplier_payments"),
            where("supplierId", "==", poData.supplierId), // Optimization: ensure payment belongs to the supplier first
            where("linkedPoIds", "array-contains", poId)
        );
        const paymentSnapshot = await getDocs(paymentQuery);

        let totalPaidForThisPO = 0;
        paymentSnapshot.forEach(paymentDoc => {
            // Sum amounts from all payments linked to this specific PO ID
            totalPaidForThisPO += Number(paymentDoc.data().paymentAmount || 0);
        });

        console.log(`PO ${poId}: Total = ${poTotalAmount}, Calculated Total Paid = ${totalPaidForThisPO}`);

        // 3. Determine new status
        let newPaymentStatus = 'Pending';
        const tolerance = 0.005; // Tolerance for floating point comparisons
        let finalAmountPaid = totalPaidForThisPO;

        if (finalAmountPaid >= poTotalAmount - tolerance) {
            newPaymentStatus = 'Paid';
            finalAmountPaid = poTotalAmount; // Cap amountPaid at totalAmount
        } else if (finalAmountPaid > tolerance) {
            newPaymentStatus = 'Partially Paid';
        } else {
            newPaymentStatus = 'Pending';
            finalAmountPaid = 0; // Reset to 0 if effectively unpaid
        }

        // 4. Update PO Document only if status or amount changes
        if (poData.paymentStatus !== newPaymentStatus || poData.amountPaid !== finalAmountPaid) {
             await updateDoc(poRef, {
                 amountPaid: finalAmountPaid, // Update the amount paid field
                 paymentStatus: newPaymentStatus // Update the status field
             });
             console.log(`PO ${poId} status updated successfully to ${newPaymentStatus} with amount paid ${formatCurrency(finalAmountPaid)}`);
        } else {
             console.log(`PO ${poId} status (${poData.paymentStatus}) and amount (${formatCurrency(poData.amountPaid)}) already up-to-date.`);
        }
        return Promise.resolve(); // Indicate success

    } catch (error) {
         // Handle specific errors like missing index
         if (error.code === 'failed-precondition') {
             const indexErrorMsg = `Firestore index needed for PO status update query (supplier_payments collection, field 'linkedPoIds' array-contains, potentially also 'supplierId'). Please create it in your Firebase console. PO ID: ${poId}`;
             console.error(indexErrorMsg, error);
             displayError(`Cannot update PO ${poId} status due to missing database index. Contact support or check Firebase console.`);
             return Promise.reject(indexErrorMsg); // Reject promise
         } else {
             console.error(`Error updating PO ${poId} status: `, error);
             displayError(`Error updating PO ${poId} status: ${error.message}`);
             return Promise.reject(error); // Reject promise
         }
    }
}


// --- UI Population Functions ---
function populateSupplierDetails(data) {
    console.log("Populating supplier details with data:", data);
    const elements = {
        supplierNameHeader: document.getElementById('supplierNameHeader'),
        supplierNameBreadcrumb: document.getElementById('supplierNameBreadcrumb'),
        detailSupplierId: document.getElementById('detailSupplierId'),
        detailSupplierName: document.getElementById('detailSupplierName'),
        detailSupplierCompany: document.getElementById('detailSupplierCompany'),
        detailSupplierWhatsapp: document.getElementById('detailSupplierWhatsapp'),
        detailSupplierContact: document.getElementById('detailSupplierContact'),
        detailSupplierEmail: document.getElementById('detailSupplierEmail'),
        detailSupplierGst: document.getElementById('detailSupplierGst'),
        detailSupplierAddress: document.getElementById('detailSupplierAddress'),
        detailAddedOn: document.getElementById('detailAddedOn'),
        supplierStatusBadge: document.getElementById('supplierStatusBadge'),
        supplierRemarksNotes: document.getElementById('supplierRemarksNotes')
    };

    for (const key in elements) { if (!elements[key]) { console.warn(`Supplier Detail element missing: ${key}`); } }

    const status = data?.status || 'active';
    if (elements.supplierStatusBadge) {
        elements.supplierStatusBadge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        elements.supplierStatusBadge.className = 'status-badge';
        elements.supplierStatusBadge.classList.add(`status-${status.toLowerCase()}`);
    }
    if (elements.supplierRemarksNotes) { elements.supplierRemarksNotes.textContent = data?.notes || 'No remarks.'; }

    if (elements.supplierNameHeader) elements.supplierNameHeader.textContent = data?.name || 'Details';
    if (elements.supplierNameBreadcrumb) elements.supplierNameBreadcrumb.textContent = data?.name || 'Details';
    if (elements.detailSupplierId) elements.detailSupplierId.textContent = currentSupplierId || 'N/A';
    if (elements.detailSupplierName) elements.detailSupplierName.textContent = data?.name || 'N/A';
    if (elements.detailSupplierCompany) elements.detailSupplierCompany.textContent = data?.companyName || 'N/A'; // Corrected field name
    if (elements.detailSupplierWhatsapp) elements.detailSupplierWhatsapp.textContent = data?.whatsappNo || 'N/A'; // Corrected field name
    if (elements.detailSupplierContact) elements.detailSupplierContact.textContent = data?.contact || 'N/A';
    if (elements.detailSupplierEmail) elements.detailSupplierEmail.textContent = data?.email || 'N/A';
    if (elements.detailSupplierGst) elements.detailSupplierGst.textContent = data?.gstNo || 'N/A'; // Corrected field name
    if (elements.detailSupplierAddress) elements.detailSupplierAddress.textContent = data?.address || 'N/A';
    if (elements.detailAddedOn) elements.detailAddedOn.textContent = data?.createdAt ? formatDate(data.createdAt) : 'N/A';

    const toggleStatusBtn = document.getElementById('toggleSupplierStatusBtn');
    const toggleStatusBtnSpan = toggleStatusBtn ? toggleStatusBtn.querySelector('span') : null;
     if (toggleStatusBtn && toggleStatusBtnSpan) {
         const isInactive = status !== 'active';
         toggleStatusBtnSpan.textContent = isInactive ? 'Enable Account' : 'Disable Account';
         toggleStatusBtn.querySelector('i').className = isInactive ? 'fas fa-toggle-off' : 'fas fa-toggle-on';
         toggleStatusBtn.classList.remove('enable', 'disable'); // Remove old classes
         toggleStatusBtn.classList.add(isInactive ? 'enable' : 'disable'); // Add new class based on state
     }
}

function populatePaymentHistory(payments) {
    console.log("Populating payment history");
    const tableBody = document.getElementById('transactionsTableBody');
    const loadingRow = document.getElementById('transactionsLoading');
    const noDataRow = document.getElementById('noTransactionsMessage');
    const errorDisplay = document.getElementById('supplierPaymentListError');

    if (!tableBody) { console.error("Payment history table body ('transactionsTableBody') not found!"); if(errorDisplay) displayError("Could not display payment history (UI element missing).", 'supplierPaymentListError'); return; }

    tableBody.innerHTML = ''; // Clear existing rows
    if (errorDisplay) errorDisplay.style.display = 'none';
    if (loadingRow) loadingRow.style.display = 'table-row'; // Show loading initially
    if (noDataRow) noDataRow.style.display = 'none';

    if (!payments || payments.length === 0) {
        if (loadingRow) loadingRow.style.display = 'none';
        if (noDataRow) {
            noDataRow.style.display = 'table-row';
        } else {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No payment history found.</td></tr>';
        }
        return;
    }

    if (loadingRow) loadingRow.style.display = 'none';
    // Sort by payment date descending
    payments.sort((a, b) => (b.paymentDate?.toDate?.()?.getTime() || 0) - (a.paymentDate?.toDate?.()?.getTime() || 0));

    payments.forEach((payment) => {
        try {
            const row = tableBody.insertRow();
            row.insertCell(0).textContent = formatDate(payment.paymentDate, true); // Include time
            row.insertCell(1).textContent = escapeHtml(payment.notes || payment.description || payment.reference || '-');
            row.insertCell(2).textContent = escapeHtml(payment.paymentMethod || payment.mode || 'N/A');

            // Display linked PO numbers
            let linkedPoDisplay = '-';
            if (Array.isArray(payment.linkedPoNumbers) && payment.linkedPoNumbers.length > 0) {
                linkedPoDisplay = payment.linkedPoNumbers.join(', ');
            } else if (payment.linkedPoNumber) { // Fallback for older single link
                linkedPoDisplay = payment.linkedPoNumber;
            }
            row.insertCell(3).textContent = escapeHtml(linkedPoDisplay);

            const amountCell = row.insertCell(4);
            amountCell.textContent = formatCurrency(payment.paymentAmount);
            amountCell.classList.add('amount-paid'); // Apply currency styling

            // Actions cell (e.g., edit/delete payment - if implemented)
            const actionCell = row.insertCell(5);
             // actionCell.innerHTML = `<button class="small-button edit-payment-btn" data-id="${payment.id}"><i class="fas fa-pencil-alt"></i></button>
             //                      <button class="small-button delete-payment-btn" data-id="${payment.id}"><i class="fas fa-trash-alt"></i></button>`;

        } catch(e) {
            console.error(`Error creating payment row:`, payment, e);
            // Optionally insert an error row
        }
    });
}

function populatePoHistoryTable(pos) {
    console.log("Populating PO history");
    const tableBody = document.getElementById('supplierPoTableBody');
    const loadingRow = document.getElementById('supplierPoLoading');
    const noDataRow = document.getElementById('noSupplierPoMessage');
    const errorDisplay = document.getElementById('supplierPoListError');

    if (!tableBody) { console.error("PO history table body ('supplierPoTableBody') not found!"); if (errorDisplay) displayError("Could not display PO history (UI element missing).", 'supplierPoListError'); return; }

    tableBody.innerHTML = ''; // Clear existing rows
    if (errorDisplay) errorDisplay.style.display = 'none';
    if (loadingRow) loadingRow.style.display = 'table-row'; // Show loading initially
    if (noDataRow) noDataRow.style.display = 'none';

    if (!pos || pos.length === 0) {
        if (loadingRow) loadingRow.style.display = 'none';
        if (noDataRow) {
            noDataRow.style.display = 'table-row';
        } else {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No purchase orders found.</td></tr>';
        }
        return;
    }

     if (loadingRow) loadingRow.style.display = 'none';
     // Sort by order date descending
     pos.sort((a, b) => (b.orderDate?.toDate?.()?.getTime() || 0) - (a.orderDate?.toDate?.()?.getTime() || 0));

     pos.forEach((po) => {
        try {
            const row = tableBody.insertRow();
            row.insertCell(0).textContent = escapeHtml(po.poNumber || `PO-${po.id.substring(0, 6)}`);
            row.insertCell(1).textContent = formatDate(po.orderDate);

            const amountCell = row.insertCell(2);
            amountCell.textContent = formatCurrency(po.totalAmount);
            amountCell.classList.add('amount-po'); // PO amount styling

            // PO Status
            const statusCell = row.insertCell(3);
            const statusSpan = document.createElement('span');
            const poStatus = po.status || 'Unknown';
            statusSpan.className = `status-badge ${getStatusClass(poStatus)}`;
            statusSpan.textContent = poStatus;
            statusCell.appendChild(statusSpan);

            // Payment Status
            const paymentStatusCell = row.insertCell(4);
            const paymentStatusSpan = document.createElement('span');
            // Use the paymentStatus field directly from the PO data
            const poPaymentStatus = po.paymentStatus || 'Pending';
            paymentStatusSpan.className = `status-badge ${getPaymentStatusClass(poPaymentStatus)}`;
            paymentStatusSpan.textContent = poPaymentStatus;
            paymentStatusCell.appendChild(paymentStatusSpan);

            // Actions cell (e.g., view PO details link)
            const actionCell = row.insertCell(5);
            // Example: actionCell.innerHTML = `<a href="po_details.html?id=${po.id}" class="small-button"><i class="fas fa-eye"></i></a>`;

        } catch (e) {
            console.error(`Error creating PO row:`, po, e);
        }
    });
}

function populatePoCheckboxListForPayment(pos) {
    const listContainer = document.getElementById('paymentLinkPOList');
    if (!listContainer) { console.error("PO Checkbox list container ('paymentLinkPOList') not found!"); return; }
    listContainer.innerHTML = ''; // Clear previous list

    if (!pos || pos.length === 0) {
        listContainer.innerHTML = '<p>No POs available for linking.</p>';
        return;
    }

    // Filter for POs that are not fully 'Paid'
    const openPOs = pos.filter(po => {
        const total = parseFloat(po.totalAmount) || 0;
        const paid = parseFloat(po.amountPaid) || 0;
        const isPaid = po.paymentStatus === 'Paid'; // Check status field
        // Include if status is not 'Paid' OR if explicitly calculated balance > 0 (redundancy)
        return !isPaid || (total - paid > 0.005);
    });

    if (openPOs.length === 0) {
        listContainer.innerHTML = '<p>No open POs found requiring payment.</p>';
        return;
    }

    // Sort open POs, maybe by date ascending
    openPOs.sort((a, b) => (a.orderDate?.toDate?.()?.getTime() || 0) - (b.orderDate?.toDate?.()?.getTime() || 0));

    openPOs.forEach((po) => {
        const total = parseFloat(po.totalAmount) || 0;
        const paid = parseFloat(po.amountPaid) || 0;
        const balance = Math.max(0, total - paid); // Ensure balance isn't negative

        const div = document.createElement('div');
        div.className = 'po-checkbox-item';

        const checkboxId = `po_link_${po.id}`;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = checkboxId;
        checkbox.name = 'linkedPOs';
        checkbox.value = po.id; // Store the PO document ID
        checkbox.dataset.poNumber = po.poNumber || `PO-${po.id.substring(0, 6)}`;
        checkbox.dataset.poBalance = balance.toFixed(2);

        const label = document.createElement('label');
        label.htmlFor = checkboxId;
        label.innerHTML = `
            <span class="po-number">${escapeHtml(po.poNumber || po.id.substring(0, 6))}</span>
            <span class="po-date">(${formatDate(po.orderDate)})</span>
            <span class="po-balance">Balance: ${formatCurrency(balance)}</span>
        `;

        div.appendChild(checkbox);
        div.appendChild(label);
        listContainer.appendChild(div);
    });
}

// --- Data Fetching Helpers (Consider abstracting these further if used elsewhere) ---
async function getSupplierTotalPoValue(supplierId) {
    let total = 0;
    try {
        const q = query(collection(db, "purchaseOrders"), where("supplierId", "==", supplierId));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            total += Number(doc.data().totalAmount || 0);
        });
        console.log(`Calculated Total PO Value: ${total}`);
        return total;
    } catch (error) {
        console.error("Error fetching PO total:", error);
        displayError("Could not calculate total PO value.", "accountSummaryError");
        return 0; // Return 0 on error
    }
}

async function getSupplierTotalPaymentAmount(supplierId) {
    let total = 0;
    try {
        const q = query(collection(db, "supplier_payments"), where("supplierId", "==", supplierId));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            total += Number(doc.data().paymentAmount || 0);
        });
        console.log(`Calculated Total Payment Amount: ${total}`);
        return total;
    } catch (error) {
        console.error("Error fetching payment total:", error);
         displayError("Could not calculate total payments.", "accountSummaryError");
        return 0; // Return 0 on error
    }
}

async function getSupplierAdjustmentTotals(supplierId) {
    let totalDebit = 0;
    let totalCredit = 0;
    try {
        // Ensure Firestore index exists: supplierAccountAdjustments collection, supplierId field ascending/descending
        const q = query(collection(db, "supplierAccountAdjustments"), where("supplierId", "==", supplierId));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            const adj = doc.data();
            const amount = Number(adj.amount || 0);
            if (adj.adjustmentType === 'debit') {
                totalDebit += amount;
            } else if (adj.adjustmentType === 'credit') {
                totalCredit += amount;
            }
        });
        console.log(`Calculated Adjustment Totals: Debit=${totalDebit}, Credit=${totalCredit}`);
        return { totalDebit, totalCredit };
    } catch (error) {
        if (error.code === 'failed-precondition') {
            console.warn("Firestore index missing for supplierAccountAdjustments by supplierId.");
            displayError("Cannot calculate adjustments due to missing index.", "accountSummaryError");
        } else {
            console.error("Error fetching adjustment totals:", error);
            displayError("Could not calculate adjustments.", "accountSummaryError");
        }
        return { totalDebit: 0, totalCredit: 0 }; // Return 0 on error
    }
}

// --- Account Summary Update ---
async function updateSupplierAccountSummary(supplierId) {
    console.log(`Updating account summary for supplier: ${supplierId}`);
    const summaryTotalPoValue = document.getElementById('summaryTotalPoValue');
    const summaryTotalPaid = document.getElementById('summaryTotalPaid');
    const summaryBalance = document.getElementById('summaryBalance');
    const summaryError = document.getElementById('accountSummaryError');

    if (!summaryTotalPoValue || !summaryTotalPaid || !summaryBalance) { console.error("Account summary elements missing!"); return; }

    // Set loading states
    summaryTotalPoValue.textContent = "Calculating..."; summaryTotalPoValue.classList.add('loading-state');
    summaryTotalPaid.textContent = "Calculating..."; summaryTotalPaid.classList.add('loading-state');
    summaryBalance.textContent = "Calculating..."; summaryBalance.className = 'balance-info loading-state';
    clearError('accountSummaryError'); // Clear previous errors

    try {
        // Fetch all data concurrently
        const [poTotal, paymentTotal, adjustmentTotals] = await Promise.all([
            getSupplierTotalPoValue(supplierId),
            getSupplierTotalPaymentAmount(supplierId),
            getSupplierAdjustmentTotals(supplierId)
        ]);

        // Balance Logic: Payable = PO Total + Adjustments(Debit) - Payments - Adjustments(Credit)
        const totalDebits = poTotal + adjustmentTotals.totalDebit;    // Amount supplier should receive
        const totalCredits = paymentTotal + adjustmentTotals.totalCredit; // Amount supplier has received (or credits given)
        const finalBalance = totalDebits - totalCredits;            // Positive = You Owe Supplier, Negative = Supplier Owes You (or has credit)

        summaryTotalPoValue.textContent = formatCurrency(poTotal);
        summaryTotalPaid.textContent = formatCurrency(paymentTotal); // This is total payments, not credits

        summaryBalance.classList.remove('loading-state', 'balance-due', 'balance-credit', 'balance-zero');

        if (finalBalance > 0.005) { // You owe the supplier
            summaryBalance.textContent = formatCurrency(finalBalance) + " Payable";
            summaryBalance.classList.add('balance-due'); // Typically red
        } else if (finalBalance < -0.005) { // Supplier owes you / You have credit
            summaryBalance.textContent = formatCurrency(Math.abs(finalBalance)) + " Credit";
            summaryBalance.classList.add('balance-credit'); // Typically green
        } else { // Settled
            summaryBalance.textContent = formatCurrency(0);
            summaryBalance.classList.add('balance-zero'); // Typically muted/gray
        }
        console.log(`Account summary updated. PO: ${poTotal}, Paid: ${paymentTotal}, Adj D: ${adjustmentTotals.totalDebit}, Adj C: ${adjustmentTotals.totalCredit}, Balance: ${finalBalance}`);

    } catch (error) {
        // Errors should be displayed by the helper functions now
        console.error("Error updating account summary:", error);
        // displayError(`Error calculating summary: ${error.message}`, 'accountSummaryError'); // Already handled?
        summaryTotalPoValue.textContent = "Error";
        summaryTotalPaid.textContent = "Error";
        summaryBalance.textContent = "Error";
        summaryBalance.classList.add('balance-due'); // Default to error state appearance
    } finally {
        // Remove loading states
        summaryTotalPoValue.classList.remove('loading-state');
        summaryTotalPaid.classList.remove('loading-state');
        // summaryBalance class is handled based on value
    }
}

// --- Account Ledger ---
async function loadSupplierAccountLedger(supplierId) {
    console.log(`Loading account ledger for supplier: ${supplierId}`);
    const accountLedgerTableBody = document.getElementById('accountLedgerTableBody');
    const ledgerError = document.getElementById('supplierLedgerError');

    if (!accountLedgerTableBody) { console.error("Ledger table body missing."); return; }
    clearError('supplierLedgerError');
    accountLedgerTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;" class="loading-state"><i class="fas fa-spinner fa-spin"></i> Loading ledger...</td></tr>`;

    let transactions = [];
    try {
        // Ensure indexes exist for these queries if needed (supplierId + date ordering)
        // 1. Fetch POs (Debit - Increases amount payable by you)
        const poQuery = query(collection(db, "purchaseOrders"), where("supplierId", "==", supplierId), firestoreOrderBy("orderDate", "asc"));
        const poSnapshot = await getDocs(poQuery);
        poSnapshot.forEach(doc => {
            const po = doc.data();
            if (po.totalAmount > 0) { // Only include POs with a value
                 transactions.push({ date: po.orderDate, type: 'po', description: `PO #${escapeHtml(po.poNumber || doc.id.substring(0,6))}`, debitAmount: Number(po.totalAmount || 0), creditAmount: 0, docId: doc.id });
            }
        });

        // 2. Fetch Payments (Credit - Decreases amount payable by you)
        const paymentQuery = query(collection(db, "supplier_payments"), where("supplierId", "==", supplierId), firestoreOrderBy("paymentDate", "asc"));
        const paymentSnapshot = await getDocs(paymentQuery);
        paymentSnapshot.forEach(doc => {
            const payment = doc.data();
             if (payment.paymentAmount > 0) { // Only include payments with a value
                 transactions.push({ date: payment.paymentDate, type: 'payment', description: `Payment Sent (${escapeHtml(payment.paymentMethod || 'N/A')}) ${payment.notes ? '- '+escapeHtml(payment.notes) : ''}`, debitAmount: 0, creditAmount: Number(payment.paymentAmount || 0), docId: doc.id });
             }
        });

        // 3. Fetch Adjustments
        const adjQuery = query(collection(db, "supplierAccountAdjustments"), where("supplierId", "==", supplierId), firestoreOrderBy("adjustmentDate", "asc"));
        const adjSnapshot = await getDocs(adjQuery);
        adjSnapshot.forEach(doc => {
            const adj = doc.data();
            const amount = Number(adj.amount || 0);
             if (amount > 0) { // Only include adjustments with a value
                 const typeText = adj.adjustmentType === 'debit' ? 'Debit Adj.' : 'Credit Adj.';
                 // Debit Adjustment increases amount payable by you (Debit column)
                 // Credit Adjustment decreases amount payable by you (Credit column)
                 transactions.push({
                     date: adj.adjustmentDate,
                     type: 'adjustment',
                     description: `${typeText}${adj.remarks ? ': ' + escapeHtml(adj.remarks) : ''}`,
                     debitAmount: adj.adjustmentType === 'debit' ? amount : 0,
                     creditAmount: adj.adjustmentType === 'credit' ? amount : 0,
                     docId: doc.id
                 });
             }
        });

        // 4. Sort All Transactions by Date (Primary) and Type (Secondary - Debits first on same day?)
         transactions.sort((a, b) => {
             const dateA = a.date?.toDate ? a.date.toDate().getTime() : 0;
             const dateB = b.date?.toDate ? b.date.toDate().getTime() : 0;
             if (dateA !== dateB) {
                 return dateA - dateB; // Sort by date first
             }
             // If dates are the same, maybe prioritize Debits (PO/Debit Adj) over Credits (Payment/Credit Adj)
             const typeAWeight = (a.type === 'po' || (a.type === 'adjustment' && a.debitAmount > 0)) ? 1 : 2;
             const typeBWeight = (b.type === 'po' || (b.type === 'adjustment' && b.debitAmount > 0)) ? 1 : 2;
             return typeAWeight - typeBWeight;
         });

        // 5. Render Ledger
        accountLedgerTableBody.innerHTML = ''; // Clear loading row
        let runningBalance = 0; // Positive = You Owe (Payable), Negative = You have Credit

        if (transactions.length === 0) {
            accountLedgerTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No transactions found.</td></tr>`;
        } else {
            transactions.forEach(tx => {
                runningBalance = runningBalance + tx.debitAmount - tx.creditAmount;
                const row = accountLedgerTableBody.insertRow();
                row.insertCell(0).textContent = tx.date?.toDate ? formatDate(tx.date) : 'N/A'; // Only date, no time
                const descCell = row.insertCell(1); descCell.textContent = tx.description; descCell.title = tx.description; // Tooltip for long descriptions

                const debitCell = row.insertCell(2); debitCell.textContent = tx.debitAmount > 0 ? formatCurrency(tx.debitAmount) : '-'; debitCell.style.textAlign = 'right';
                const creditCell = row.insertCell(3); creditCell.textContent = tx.creditAmount > 0 ? formatCurrency(tx.creditAmount) : '-'; creditCell.style.textAlign = 'right';

                const cellBalance = row.insertCell(4);
                cellBalance.style.textAlign = 'right';
                cellBalance.classList.remove('ledger-balance-positive', 'ledger-balance-negative', 'ledger-balance-zero');

                if (runningBalance > 0.005) { // You Owe
                    cellBalance.textContent = formatCurrency(runningBalance) + " Dr"; // Use Dr for Debit Balance (Payable)
                    cellBalance.classList.add('ledger-balance-negative'); // Red
                } else if (runningBalance < -0.005) { // You Have Credit
                    cellBalance.textContent = formatCurrency(Math.abs(runningBalance)) + " Cr"; // Use Cr for Credit Balance
                    cellBalance.classList.add('ledger-balance-positive'); // Green
                } else { // Zero Balance
                    cellBalance.textContent = formatCurrency(0);
                    cellBalance.classList.add('ledger-balance-zero'); // Muted
                }
            });
        }
        console.log(`Ledger rendered. Final running balance: ${runningBalance}`);

    } catch (error) {
        console.error("Error loading account ledger:", error);
        if(error.code === 'failed-precondition'){
             const msg = `Error loading ledger: Firestore Index required. Check console.`;
             displayError(msg, 'supplierLedgerError');
             accountLedgerTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">${msg}</td></tr>`;
         } else {
             displayError(`Error loading ledger: ${error.message}`, 'supplierLedgerError');
             accountLedgerTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Error loading ledger. See console for details.</td></tr>`;
         }
    }
}


// --- Core Data Loading ---
async function loadSupplierPageData() {
    console.log("loadSupplierPageData called");
    if (!currentSupplierId) { console.error("Supplier ID is null"); displayError("Cannot load data: Supplier ID is missing."); return; }
    if (!db) { displayError("Database connection failed."); return; }
    if (isRefreshingData) { console.log("Data refresh already in progress."); return; }

    isRefreshingData = true;
    const loadingIndicator = document.getElementById('loadingIndicator');
    const actionsBarButtons = document.querySelectorAll('.actions-bar .button, .actions-bar a.button');

    if (loadingIndicator) loadingIndicator.style.display = 'flex'; // Use flex for centering
    clearError(); // Clear all errors before loading
    actionsBarButtons.forEach(btn => btn.disabled = true); // Disable buttons during load

    try {
        console.log("Fetching core supplier details for ID:", currentSupplierId);
        const supplierRef = doc(db, "suppliers", currentSupplierId);
        const supplierSnap = await getDoc(supplierRef);

        if (!supplierSnap.exists()) {
            throw new Error(`Supplier with ID ${currentSupplierId} not found.`);
        }
        currentSupplierData = { id: supplierSnap.id, ...supplierSnap.data() };
        populateSupplierDetails(currentSupplierData);

        // Fetch related data concurrently
        console.log("Fetching POs, Payments, Ledger, Summary...");
        await Promise.all([
            loadSupplierPoHistory(currentSupplierId), // Also populates purchaseOrdersData
            loadSupplierPaymentHistory(currentSupplierId),
            loadSupplierAccountLedger(currentSupplierId),
            updateSupplierAccountSummary(currentSupplierId)
        ]);

        // Enable buttons based on status AFTER data load
        const status = currentSupplierData.status || 'active';
        document.getElementById('editSupplierDetailsBtn').disabled = false;
        document.getElementById('addPaymentMadeBtn').disabled = (status !== 'active'); // Only allow payment if active
        document.getElementById('addSupplierAdjustmentBtn').disabled = false; // Allow adjustments regardless of status?
        document.getElementById('toggleSupplierStatusBtn').disabled = false;
        document.getElementById('deleteSupplierBtn').disabled = false;
        const addNewPoLink = document.getElementById('addNewPoLink');
        if (addNewPoLink) {
            addNewPoLink.href = `new_po.html?supplierId=${encodeURIComponent(currentSupplierId)}&supplierName=${encodeURIComponent(currentSupplierData.name || '')}`;
            if (status !== 'active') {
                 addNewPoLink.classList.add('disabled'); // Visually disable if inactive
                 addNewPoLink.onclick = (e) => e.preventDefault(); // Prevent navigation
            } else {
                 addNewPoLink.classList.remove('disabled');
                 addNewPoLink.onclick = null; // Allow navigation
            }
        }
        document.querySelector('.actions-bar .back-button').disabled = false; // Back button always enabled


        console.log("All supplier page data fetched and displayed.");

    } catch (error) {
        console.error("Error loading supplier page data:", error);
        displayError(`Error loading supplier data: ${error.message}. Please check the ID or try again.`);
        // Clear populated data on error
        populateSupplierDetails(null); // Clear details section
        const supplierPoTableBody = document.getElementById('supplierPoTableBody');
        const transactionsTableBody = document.getElementById('transactionsTableBody');
        const accountLedgerTableBody = document.getElementById('accountLedgerTableBody');
        const summaryBalance = document.getElementById('summaryBalance');
        if(supplierPoTableBody) supplierPoTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Error loading POs.</td></tr>';
        if(transactionsTableBody) transactionsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Error loading payments.</td></tr>';
        if(accountLedgerTableBody) accountLedgerTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Error loading ledger.</td></tr>';
        if(summaryBalance) summaryBalance.textContent = "Error";
        actionsBarButtons.forEach(btn => { // Keep buttons disabled on error, except back
            if (!btn.classList.contains('back-button')) {
                 btn.disabled = true;
            } else {
                 btn.disabled = false; // Ensure back button works
            }
        });

    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        isRefreshingData = false;
    }
}

async function loadSupplierPoHistory(supplierId) {
    try {
        const q = query(collection(db, "purchaseOrders"), where("supplierId", "==", supplierId), firestoreOrderBy("orderDate", "desc"));
        const snapshot = await getDocs(q);
        // Store PO data for use in payment linking etc.
        purchaseOrdersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        populatePoHistoryTable(purchaseOrdersData); // Populate the table
    } catch (error) {
        console.error("Error loading PO history:", error);
        displayError("Could not load PO History.", "supplierPoListError");
        populatePoHistoryTable([]); // Show empty state on error
    }
}

async function loadSupplierPaymentHistory(supplierId) {
    try {
        const q = query(collection(db, "supplier_payments"), where("supplierId", "==", supplierId), firestoreOrderBy("paymentDate", "desc"));
        const snapshot = await getDocs(q);
        supplierPaymentsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        populatePaymentHistory(supplierPaymentsData);
    } catch (error) {
        console.error("Error loading Payment history:", error);
        displayError("Could not load Payment History.", "supplierPaymentListError");
        populatePaymentHistory([]); // Show empty state on error
    }
}

// --- Refresh Data Function ---
async function refreshSupplierPageData() {
    console.log("Refreshing supplier page data...");
    clearError(); // Clear errors before refresh
    await loadSupplierPageData(); // Reload everything
}

// --- Modal Functions & Handlers ---

// Add Payment Modal
function openPaymentModal() {
    if (!currentSupplierData) { alert("Supplier data not loaded yet."); return; }
    if (currentSupplierData.status !== 'active') { alert("Cannot record payment for an inactive supplier."); return; }

    const paymentMadeModal = document.getElementById('paymentMadeModal');
    const paymentMadeForm = document.getElementById('paymentMadeForm');
    const paymentSupplierName = document.getElementById('paymentSupplierName');
    if (!paymentMadeModal || !paymentMadeForm || !paymentSupplierName) { console.error("Payment modal elements missing."); return; }

    setModalHeaderTheme(paymentMadeModal, 'modal-header-success'); // Set header theme
    clearError('paymentMadeError'); // Clear errors specific to this modal
    paymentMadeForm.reset(); // Reset form fields
    paymentSupplierName.textContent = currentSupplierData.name || 'Supplier';

    try { // Set default date to today
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        paymentMadeForm.querySelector('#paymentDate').value = `${year}-${month}-${day}`;
    } catch (e) {
         console.warn("Could not set default payment date", e);
         paymentMadeForm.querySelector('#paymentDate').value = '';
    }

    populatePoCheckboxListForPayment(purchaseOrdersData); // Populate POs based on current data
    paymentMadeModal.classList.add('active');
}

function closePaymentModal() {
    const paymentMadeModal = document.getElementById('paymentMadeModal');
    if (paymentMadeModal) paymentMadeModal.classList.remove('active');
}

async function handleSavePayment(event) {
    event.preventDefault();
    if (!currentSupplierId || !db) { displayError("Cannot save payment. Missing critical data.", "paymentMadeError"); return; }

    const amountInput = document.getElementById('paymentAmount');
    const dateInput = document.getElementById('paymentDate');
    const methodInput = document.getElementById('paymentMethod');
    const notesInput = document.getElementById('paymentNotes');
    const poListContainer = document.getElementById('paymentLinkPOList');
    const saveBtn = document.getElementById('savePaymentBtn');

    if (!amountInput || !dateInput || !methodInput || !notesInput || !poListContainer || !saveBtn) {
        displayError("Payment form elements missing. Cannot save.", "paymentMadeError"); return;
    }

    const amount = parseFloat(amountInput.value);
    const paymentDateStr = dateInput.value;
    const method = methodInput.value;
    const notes = notesInput.value.trim();

    // Validation
    if (isNaN(amount) || amount <= 0) { displayError("Please enter a valid positive payment amount.", "paymentMadeError"); amountInput.focus(); return; }
    if (!paymentDateStr) { displayError("Please select a payment date.", "paymentMadeError"); dateInput.focus(); return; }
    // Method is optional, so no validation needed unless required

    const selectedCheckboxes = poListContainer.querySelectorAll('input[name="linkedPOs"]:checked');
    const linkedPoIds = Array.from(selectedCheckboxes).map(cb => cb.value);
    const linkedPoNumbers = Array.from(selectedCheckboxes).map(cb => cb.dataset.poNumber);

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    clearError('paymentMadeError');

    try {
        // Use local timezone interpretation for the date string
        const localDate = new Date(paymentDateStr + 'T00:00:00'); // Assumes date input is YYYY-MM-DD
        const paymentDateTimestamp = Timestamp.fromDate(localDate);

        const paymentData = {
            supplierId: currentSupplierId,
            supplierName: currentSupplierData?.name || 'N/A',
            paymentAmount: amount,
            paymentDate: paymentDateTimestamp, // Use Timestamp
            paymentMethod: method,
            notes: notes,
            createdAt: serverTimestamp(), // Use server timestamp for creation time
            linkedPoIds: linkedPoIds || [], // Ensure it's an array
            linkedPoNumbers: linkedPoNumbers || [] // Ensure it's an array
        };

        const paymentDocRef = await addDoc(collection(db, "supplier_payments"), paymentData);
        console.log("Payment recorded:", paymentDocRef.id);

        // --- START: PO Status Update Logic ---
        if (linkedPoIds && linkedPoIds.length > 0) {
            console.log(`Updating status for ${linkedPoIds.length} linked POs...`);
            // Update each linked PO status individually
            // Using Promise.allSettled to handle potential errors in individual updates without stopping others
            const updatePromises = linkedPoIds.map(poId => updatePoPaymentStatus(poId));
            const results = await Promise.allSettled(updatePromises);

            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.error(`Failed to update status for PO ID ${linkedPoIds[index]}:`, result.reason);
                    // Optionally display a summary error to the user after trying all updates
                }
            });
            console.log("Finished updating linked PO statuses (check logs for errors).");
        }
        // --- END: PO Status Update Logic ---

        closePaymentModal();
        alert("Payment recorded successfully!");
        await refreshSupplierPageData(); // Refresh data including PO table

    } catch (error) {
        console.error("Error saving payment or updating PO status:", error);
        displayError(`Failed to save payment: ${error.message}`, "paymentMadeError");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Payment';
    }
}

// Edit Supplier Modal
function openEditSupplierModal() {
    const editSupplierModal = document.getElementById('editSupplierModal');
    const editSupplierForm = document.getElementById('editSupplierForm');
    const editSupplierNotes = document.getElementById('editSupplierNotes'); // Remarks field

    if (!editSupplierModal || !editSupplierForm || !currentSupplierData || !currentSupplierId) { console.error("Edit modal elements or data missing."); alert("Cannot open edit modal."); return; }

    setModalHeaderTheme(editSupplierModal, 'modal-header-info'); // Set theme
    clearError('editSupplierError');
    editSupplierForm.reset();

    // Populate form
    document.getElementById('editingSupplierId').value = currentSupplierId;
    document.getElementById('editSupplierNameInput').value = currentSupplierData.name || '';
    document.getElementById('editSupplierCompanyInput').value = currentSupplierData.companyName || '';
    document.getElementById('editSupplierWhatsappInput').value = currentSupplierData.whatsappNo || '';
    document.getElementById('editSupplierContactInput').value = currentSupplierData.contact || '';
    document.getElementById('editSupplierEmailInput').value = currentSupplierData.email || '';
    document.getElementById('editSupplierGstInput').value = currentSupplierData.gstNo || '';
    document.getElementById('editSupplierAddressInput').value = currentSupplierData.address || '';
    if(editSupplierNotes) editSupplierNotes.value = currentSupplierData.notes || ''; // Populate remarks

    editSupplierModal.classList.add('active');
}

function closeEditSupplierModal() {
    const editSupplierModal = document.getElementById('editSupplierModal');
    if (editSupplierModal) editSupplierModal.classList.remove('active');
}

async function handleEditSupplierSubmit(event) {
    event.preventDefault();
    const editingId = document.getElementById('editingSupplierId').value;
    if (!editingId || !db) { displayError("Cannot update supplier. ID missing.", "editSupplierError"); return; }

    const form = event.target;
    const saveBtn = document.getElementById('updateSupplierBtn');
    if (!form || !saveBtn) { displayError("Edit form error.", "editSupplierError"); return; }

    const nameValue = form.querySelector('#editSupplierNameInput')?.value.trim();
    if (!nameValue) { displayError("Supplier Name is required.", "editSupplierError"); return; }

    const updatedData = {
        name: nameValue,
        name_lowercase: nameValue.toLowerCase(), // For case-insensitive search/sort
        companyName: form.querySelector('#editSupplierCompanyInput')?.value.trim(),
        whatsappNo: form.querySelector('#editSupplierWhatsappInput')?.value.trim(),
        contact: form.querySelector('#editSupplierContactInput')?.value.trim(),
        email: form.querySelector('#editSupplierEmailInput')?.value.trim(),
        gstNo: form.querySelector('#editSupplierGstInput')?.value.trim(),
        address: form.querySelector('#editSupplierAddressInput')?.value.trim(),
        notes: form.querySelector('#editSupplierNotes')?.value.trim() || '', // Save empty string if blank
        updatedAt: serverTimestamp() // Track last update time
    };

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    clearError('editSupplierError');

    try {
        const supplierRef = doc(db, "suppliers", editingId);
        await updateDoc(supplierRef, updatedData);
        console.log("Supplier details updated for ID:", editingId);
        alert("Supplier details updated successfully!");
        closeEditSupplierModal();
        await refreshSupplierPageData(); // Refresh to show updated details
    } catch(error) {
        console.error("Error updating supplier:", error);
        displayError(`Failed to update supplier: ${error.message}`, "editSupplierError");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Update Supplier';
    }
}

// Add Adjustment Modal
function openAddSupplierAdjustmentModal() {
    const addSupplierAdjustmentModal = document.getElementById('addSupplierAdjustmentModal');
    const adjustmentSupplierName = document.getElementById('adjustmentSupplierName');
    const addSupplierAdjustmentForm = document.getElementById('addSupplierAdjustmentForm');
    const supplierAdjustmentDate = document.getElementById('supplierAdjustmentDate');
    const supplierAdjustmentTypeDebit = document.getElementById('supplierAdjustmentTypeDebit');
    const saveSupplierAdjustmentBtn = document.getElementById('saveSupplierAdjustmentBtn');

    if (!addSupplierAdjustmentModal || !currentSupplierData || !addSupplierAdjustmentForm) { alert("Cannot open add adjustment modal."); return; }
    console.log("Opening Add Supplier Adjustment modal.");

    setModalHeaderTheme(addSupplierAdjustmentModal, 'modal-header-warning'); // Set theme
    addSupplierAdjustmentForm.reset();
    if(adjustmentSupplierName) adjustmentSupplierName.textContent = currentSupplierData.name || '';

    // Set default date to today
    if(supplierAdjustmentDate) try {
         const today = new Date();
         const year = today.getFullYear();
         const month = String(today.getMonth() + 1).padStart(2, '0');
         const day = String(today.getDate()).padStart(2, '0');
         supplierAdjustmentDate.value = `${year}-${month}-${day}`;
    } catch(e){ supplierAdjustmentDate.value = ''; }

    if(supplierAdjustmentTypeDebit) supplierAdjustmentTypeDebit.checked = true; // Default to Debit
    if(saveSupplierAdjustmentBtn) { saveSupplierAdjustmentBtn.disabled = false; saveSupplierAdjustmentBtn.innerHTML = '<i class="fas fa-save"></i> Save Adjustment'; }
    clearError('supplierAdjustmentError');
    addSupplierAdjustmentModal.classList.add('active');
}

function closeAddSupplierAdjustmentModal() {
    const addSupplierAdjustmentModal = document.getElementById('addSupplierAdjustmentModal');
    if (addSupplierAdjustmentModal) addSupplierAdjustmentModal.classList.remove('active');
}

async function handleSaveSupplierAdjustment(event) {
    event.preventDefault();
    if (!addDoc || !collection || !Timestamp || !currentSupplierId) { alert("DB function missing or Supplier ID missing."); return; }

    const supplierAdjustmentAmount = document.getElementById('supplierAdjustmentAmount');
    const supplierAdjustmentDate = document.getElementById('supplierAdjustmentDate');
    const supplierAdjustmentTypeDebit = document.getElementById('supplierAdjustmentTypeDebit');
    const supplierAdjustmentTypeCredit = document.getElementById('supplierAdjustmentTypeCredit');
    const supplierAdjustmentRemarks = document.getElementById('supplierAdjustmentRemarks');
    const saveSupplierAdjustmentBtn = document.getElementById('saveSupplierAdjustmentBtn');

    const amount = parseFloat(supplierAdjustmentAmount.value);
    const date = supplierAdjustmentDate.value;
    const type = supplierAdjustmentTypeDebit.checked ? 'debit' : (supplierAdjustmentTypeCredit.checked ? 'credit' : null);
    const remarks = supplierAdjustmentRemarks.value.trim();

    // Validation
    if (!type) { displayError("Please select adjustment type (Debit or Credit).", "supplierAdjustmentError"); return; }
    if (isNaN(amount) || amount <= 0) { displayError("Please enter a valid positive adjustment amount.", "supplierAdjustmentError"); return; }
    if (!date) { displayError("Please select an adjustment date.", "supplierAdjustmentError"); return; }

    saveSupplierAdjustmentBtn.disabled = true;
    saveSupplierAdjustmentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    clearError('supplierAdjustmentError');

    try {
        const localDate = new Date(date + 'T00:00:00'); // Assume local timezone
        const adjustmentDateTimestamp = Timestamp.fromDate(localDate);
        const adjustmentData = {
            supplierId: currentSupplierId,
            supplierName: currentSupplierData?.name || 'N/A',
            amount: amount,
            adjustmentType: type,
            adjustmentDate: adjustmentDateTimestamp,
            remarks: remarks || '', // Save empty string if blank
            createdAt: serverTimestamp() // Use server timestamp
        };
        const docRef = await addDoc(collection(db, "supplierAccountAdjustments"), adjustmentData);
        console.log("Supplier Adjustment added:", docRef.id);
        alert("Account adjustment added successfully!");
        closeAddSupplierAdjustmentModal();
        await refreshSupplierPageData(); // Refresh ledger and summary
    } catch (error) {
        console.error("Error saving supplier adjustment:", error);
        displayError(`Error saving adjustment: ${error.message}`, "supplierAdjustmentError");
    } finally {
        saveSupplierAdjustmentBtn.disabled = false;
        saveSupplierAdjustmentBtn.innerHTML = '<i class="fas fa-save"></i> Save Adjustment';
    }
}

// Toggle Status Functions
function handleToggleSupplierStatus() {
    if (!currentSupplierId || !currentSupplierData) { alert("Supplier data not loaded."); return; }
    const currentStatus = currentSupplierData.status || 'active';
    const isDisabling = currentStatus === 'active';
    const actionText = isDisabling ? 'disable' : 'enable';
    const newStatus = isDisabling ? 'inactive' : 'active';
    openConfirmToggleSupplierModal(actionText, newStatus); // Pass action and NEW status
}

function openConfirmToggleSupplierModal(action, newStatus) {
    const confirmToggleSupplierStatusModal = document.getElementById('confirmToggleSupplierStatusModal');
    const toggleSupplierActionText = document.getElementById('toggleSupplierActionText');
    const toggleSupplierName = document.getElementById('toggleSupplierName');
    const confirmToggleSupplierCheckbox = document.getElementById('confirmToggleSupplierCheckbox');
    const confirmSupplierToggleBtn = document.getElementById('confirmSupplierToggleBtn');
    const toggleSupplierWarningMessage = document.getElementById('toggleSupplierWarningMessage');
    const toggleSupplierCheckboxLabel = document.getElementById('toggleSupplierCheckboxLabel');
    const confirmSupplierToggleBtnText = document.getElementById('confirmSupplierToggleBtnText');

    if (!confirmToggleSupplierStatusModal || !toggleSupplierActionText || !toggleSupplierName || !confirmToggleSupplierCheckbox || !confirmSupplierToggleBtn || !toggleSupplierWarningMessage || !toggleSupplierCheckboxLabel || !confirmSupplierToggleBtnText) { console.error("Toggle confirm modal elements missing!"); return; }
    console.log(`Opening confirm toggle modal. Action: ${action}, New Status: ${newStatus}`);

    // Determine theme and button class based on action
    let headerThemeClass = '';
    let buttonActionClass = '';
    if (action === 'disable') {
         headerThemeClass = 'modal-header-secondary'; // Match action bar button color
         buttonActionClass = 'disable-action'; // Class for button styling
    } else { // enable
         headerThemeClass = 'modal-header-success'; // Match action bar button color
         buttonActionClass = 'enable-action'; // Class for button styling
    }
    setModalHeaderTheme(confirmToggleSupplierStatusModal, headerThemeClass); // Apply theme

    // Set text content
    toggleSupplierActionText.textContent = action;
    toggleSupplierName.textContent = currentSupplierData?.name || 'this supplier';
    toggleSupplierWarningMessage.style.display = (action === 'disable') ? 'block' : 'none';
    toggleSupplierCheckboxLabel.textContent = `I understand and want to ${action} this account.`;
    confirmSupplierToggleBtnText.textContent = action.charAt(0).toUpperCase() + action.slice(1) + ' Account';

    // Set button state and icon
    const icon = confirmSupplierToggleBtn.querySelector('i');
    confirmSupplierToggleBtn.classList.remove('enable-action', 'disable-action'); // Remove previous action classes
    confirmSupplierToggleBtn.classList.add(buttonActionClass); // Add current action class
    if (icon) icon.className = `fas ${action === 'disable' ? 'fa-toggle-off' : 'fa-toggle-on'}`;

    // Reset checkbox and disable confirm button
    confirmToggleSupplierCheckbox.checked = false;
    confirmSupplierToggleBtn.disabled = true;
    confirmSupplierToggleBtn.dataset.newStatus = newStatus; // Store the target status on the button

    confirmToggleSupplierStatusModal.classList.add('active');
}

function closeConfirmToggleSupplierModal() {
    const confirmToggleSupplierStatusModal = document.getElementById('confirmToggleSupplierStatusModal');
    if (confirmToggleSupplierStatusModal) confirmToggleSupplierStatusModal.classList.remove('active');
}

async function executeToggleSupplierStatus() { // Removed newStatus param, get from button dataset
    const button = document.getElementById('confirmSupplierToggleBtn');
    const newStatus = button?.dataset.newStatus; // Get status from data attribute

    if (!updateDoc || !doc || !Timestamp || !currentSupplierId || !newStatus) {
        alert("Cannot toggle status: DB function, Supplier ID, or New Status missing.");
        console.error("executeToggleSupplierStatus missing data", { currentSupplierId, newStatus });
        return;
    }

    button.disabled = true;
    const originalHTML = button.innerHTML;
    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;

    try {
        const supplierRef = doc(db, "suppliers", currentSupplierId);
        await updateDoc(supplierRef, {
            status: newStatus,
            updatedAt: Timestamp.now() // Use Firestore Timestamp
        });
        console.log(`Supplier status successfully changed to ${newStatus}.`);
        alert(`Supplier account status changed to ${newStatus}.`);
        closeConfirmToggleSupplierModal();
        await loadSupplierPageData(); // Reload Data to reflect changes everywhere
    } catch (error) {
        console.error("Error toggling supplier status:", error);
        alert(`Error changing status: ${error.message}`);
        // Re-enable button on error
         button.disabled = false;
         button.innerHTML = originalHTML;
    }
    // No finally needed here as button state is handled in try/catch
}

// Delete Supplier Functions
function handleDeleteSupplier() {
    if (!currentSupplierId || !currentSupplierData) { alert("Supplier data not loaded."); return; }
    openConfirmDeleteSupplierModal();
}

function openConfirmDeleteSupplierModal() {
    const confirmDeleteSupplierModal = document.getElementById('confirmDeleteSupplierModal');
    const deleteSupplierName = document.getElementById('deleteSupplierName');
    const confirmDeleteSupplierCheckbox = document.getElementById('confirmDeleteSupplierCheckbox');
    const confirmSupplierDeleteBtn = document.getElementById('confirmSupplierDeleteBtn');

    if (!confirmDeleteSupplierModal || !deleteSupplierName || !confirmDeleteSupplierCheckbox || !confirmSupplierDeleteBtn) { console.error("Delete confirm modal elements missing!"); return; }
    console.log("Opening delete supplier confirmation modal.");

    setModalHeaderTheme(confirmDeleteSupplierModal, 'modal-header-danger'); // Set theme

    deleteSupplierName.textContent = currentSupplierData?.name || 'this supplier';
    confirmDeleteSupplierCheckbox.checked = false;
    confirmSupplierDeleteBtn.disabled = true;
    confirmDeleteSupplierModal.classList.add('active');
}

function closeConfirmDeleteSupplierModal() {
    const confirmDeleteSupplierModal = document.getElementById('confirmDeleteSupplierModal');
    if (confirmDeleteSupplierModal) confirmDeleteSupplierModal.classList.remove('active');
}

async function executeDeleteSupplier() {
    if (!deleteDoc || !doc || !currentSupplierId) { alert("DB function missing or ID missing."); return; }
    const supplierName = currentSupplierData?.name || `ID: ${currentSupplierId}`;
    console.log(`Executing permanent deletion for supplier ${currentSupplierId}`);

    const button = document.getElementById('confirmSupplierDeleteBtn');
    button.disabled = true;
    const originalHTML = button.innerHTML;
    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Deleting...`;

    try {
        await deleteDoc(doc(db, "suppliers", currentSupplierId));
        console.log("Supplier deleted successfully.");
        alert(`Supplier "${escapeHtml(supplierName)}" has been permanently deleted.`);
        closeConfirmDeleteSupplierModal();
        window.location.href = 'supplier_management.html'; // Redirect back to list
    } catch (error) {
        console.error("Error deleting supplier:", error);
        alert(`Error deleting supplier: ${error.message}`);
        button.disabled = false; // Re-enable button on error
        button.innerHTML = originalHTML;
    }
}


// --- Event Listeners Setup ---
function setupEventListeners() {
    if (listenersAttached) { console.log("Listeners already attached."); return; }
    console.log("Setting up event listeners...");

    // Action Bar Buttons
    document.getElementById('addPaymentMadeBtn')?.addEventListener('click', openPaymentModal);
    document.getElementById('editSupplierDetailsBtn')?.addEventListener('click', openEditSupplierModal);
    document.getElementById('addSupplierAdjustmentBtn')?.addEventListener('click', openAddSupplierAdjustmentModal);
    document.getElementById('toggleSupplierStatusBtn')?.addEventListener('click', handleToggleSupplierStatus);
    document.getElementById('deleteSupplierBtn')?.addEventListener('click', handleDeleteSupplier);
    document.querySelector('.actions-bar a.back-button')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'supplier_management.html';
    });

    // --- Modals --- (Using event delegation on a common parent might be more efficient if many modals/buttons)

    // Payment Modal
    const paymentModal = document.getElementById('paymentMadeModal');
    paymentModal?.querySelector('.close-btn')?.addEventListener('click', closePaymentModal);
    paymentModal?.querySelector('#cancelPaymentBtn')?.addEventListener('click', closePaymentModal);
    paymentModal?.addEventListener('click', (event) => { if (event.target === paymentModal) closePaymentModal(); });
    paymentModal?.querySelector('#paymentMadeForm')?.addEventListener('submit', handleSavePayment);

    // Edit Supplier Modal
    const editModal = document.getElementById('editSupplierModal');
    editModal?.querySelector('.close-btn')?.addEventListener('click', closeEditSupplierModal);
    editModal?.querySelector('#cancelEditSupplierBtn')?.addEventListener('click', closeEditSupplierModal);
    editModal?.addEventListener('click', (event) => { if (event.target === editModal) closeEditSupplierModal(); });
    editModal?.querySelector('#editSupplierForm')?.addEventListener('submit', handleEditSupplierSubmit);

    // Add Adjustment Modal
    const adjModal = document.getElementById('addSupplierAdjustmentModal');
    adjModal?.querySelector('.close-btn')?.addEventListener('click', closeAddSupplierAdjustmentModal);
    adjModal?.querySelector('#cancelSupplierAdjustmentBtn')?.addEventListener('click', closeAddSupplierAdjustmentModal);
    adjModal?.addEventListener('click', (e) => { if (e.target === adjModal) closeAddSupplierAdjustmentModal(); });
    adjModal?.querySelector('#addSupplierAdjustmentForm')?.addEventListener('submit', handleSaveSupplierAdjustment);

    // Confirm Toggle Status Modal
    const confirmToggleModal = document.getElementById('confirmToggleSupplierStatusModal');
    confirmToggleModal?.querySelector('.close-btn')?.addEventListener('click', closeConfirmToggleSupplierModal);
    confirmToggleModal?.querySelector('#cancelSupplierToggleBtn')?.addEventListener('click', closeConfirmToggleSupplierModal);
    confirmToggleModal?.addEventListener('click', (e) => { if (e.target === confirmToggleModal) closeConfirmToggleSupplierModal(); });
    confirmToggleModal?.querySelector('#confirmToggleSupplierCheckbox')?.addEventListener('change', (e) => {
        const btn = confirmToggleModal.querySelector('#confirmSupplierToggleBtn');
        if(btn) btn.disabled = !e.target.checked;
    });
    confirmToggleModal?.querySelector('#confirmSupplierToggleBtn')?.addEventListener('click', () => {
         const chk = confirmToggleModal.querySelector('#confirmToggleSupplierCheckbox');
         if(chk?.checked){ executeToggleSupplierStatus(); } // Get status from button dataset inside function
    });

    // Confirm Delete Modal
    const confirmDeleteModal = document.getElementById('confirmDeleteSupplierModal');
    confirmDeleteModal?.querySelector('.close-btn')?.addEventListener('click', closeConfirmDeleteSupplierModal);
    confirmDeleteModal?.querySelector('#cancelSupplierDeleteBtn')?.addEventListener('click', closeConfirmDeleteSupplierModal);
    confirmDeleteModal?.addEventListener('click', (e) => { if (e.target === confirmDeleteModal) closeConfirmDeleteSupplierModal(); });
    confirmDeleteModal?.querySelector('#confirmDeleteSupplierCheckbox')?.addEventListener('change', (e) => {
         const btn = confirmDeleteModal.querySelector('#confirmSupplierDeleteBtn');
         if(btn) btn.disabled = !e.target.checked;
    });
    confirmDeleteModal?.querySelector('#confirmSupplierDeleteBtn')?.addEventListener('click', () => {
        const chk = confirmDeleteModal.querySelector('#confirmDeleteSupplierCheckbox');
        if(chk?.checked){ executeDeleteSupplier(); }
    });

    listenersAttached = true;
    console.log("Event listeners setup complete.");
}

// --- Global Initialization & Auth Handling ---
window.initializeSupplierDetailPage = (user) => { // Accept user object passed by auth check
     console.log("initializeSupplierDetailPage called");
     if (supplierDetailPageInitialized) { console.log("Supplier detail page already initialized."); return; }

     currentSupplierId = getSupplierIdFromUrl();
     if (!currentSupplierId) { displayError("Supplier ID missing from URL. Cannot load page."); return; }
     console.log("Supplier ID:", currentSupplierId);

     const mainContent = document.getElementById('supplierAccountDetailContent');
     if (!mainContent) { console.error("Critical: Main content container missing!"); displayError("Page layout structure is broken."); return; }

     // Ensure content is visible (might be hidden initially)
     // mainContent.style.visibility = 'visible'; // Or remove a 'hidden' class

     supplierDetailPageInitialized = true;
     clearError(); // Clear any initial errors

     // Setup listeners ONCE upon initialization
     if (!listenersAttached) {
         setupEventListeners();
     }

     // Load data now that everything is ready and auth is confirmed
     console.log("Triggering initial data load...");
     loadSupplierPageData(); // Load all data

};

// --- Initial Check (Auth handled by inline script in HTML head) ---
// The inline script in HTML <head> will call window.initializeSupplierDetailPage
// after auth state is confirmed. No need for DOMContentLoaded listener here
// if the initialization is guaranteed to be called by the auth script.

console.log("supplier_account_detail.js (v8) script loaded. Waiting for initialization call.");