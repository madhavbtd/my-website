// js/supplier_account_detail.js - v7 (Merged Customer Features + Supplier Logic)

// --- Firebase Imports ---
// Ensure ALL necessary functions are imported or globally available via firebase-init.js
import { db, auth } from './firebase-init.js';
import {
    doc, getDoc, collection, query, where, getDocs, orderBy as firestoreOrderBy, // Renamed orderBy
    Timestamp, addDoc, serverTimestamp, updateDoc, deleteDoc, runTransaction, writeBatch
    // arrayUnion might be needed if status history is implemented for suppliers
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Global State ---
let initializationAttempted = false;
let currentSupplierId = null;
let currentSupplierData = null;
let purchaseOrdersData = [];
let supplierPaymentsData = [];
let supplierAdjustmentsData = []; // Store adjustments
let listenersAttached = false;
let supplierDetailPageInitialized = false;
let isRefreshingData = false; // Flag to prevent concurrent refreshes

// --- Helper Functions ---
function displayError(message, elementId = 'generalErrorDisplay') { /* ... (Same as previous version) ... */ console.error("Displaying Error:", message, "Target Element ID:", elementId); try { let errorElement = document.getElementById('generalErrorDisplay'); if (!errorElement) { if (elementId === 'paymentMadeError') errorElement = document.getElementById('paymentMadeError'); else if (elementId === 'editSupplierError') errorElement = document.getElementById('editSupplierError'); else if (elementId === 'supplierPaymentListError') errorElement = document.getElementById('supplierPaymentListError'); else if (elementId === 'supplierPoListError') errorElement = document.getElementById('supplierPoListError'); else if (elementId === 'accountSummaryError') errorElement = document.getElementById('accountSummaryError'); else if (elementId === 'supplierAdjustmentError') errorElement = document.getElementById('supplierAdjustmentError'); else if (elementId === 'supplierLedgerError') errorElement = document.getElementById('supplierLedgerError'); } if (errorElement) { errorElement.textContent = `Error: ${message}`; errorElement.style.display = 'block'; errorElement.style.color = 'red'; console.log("Error displayed in element:", errorElement.id); } else { console.warn(`Error element '${elementId}' or fallback 'generalErrorDisplay' not found. Using alert.`); alert(`Error: ${message}`); } } catch(e) { console.error("Error within displayError function itself:", e); alert(`Critical Error: ${message}`); } }
function clearError(elementId = 'generalErrorDisplay') { /* ... (Same as previous version) ... */ try { let errorElement = document.getElementById(elementId); if (elementId === 'generalErrorDisplay') { const specificErrors = ['paymentMadeError', 'editSupplierError', 'supplierPaymentListError', 'supplierPoListError', 'accountSummaryError', 'supplierAdjustmentError', 'supplierLedgerError']; specificErrors.forEach(id => { const el = document.getElementById(id); if (el) { el.textContent = ''; el.style.display = 'none'; } }); } if (errorElement) { errorElement.textContent = ''; errorElement.style.display = 'none'; } } catch(e) { console.error("Error within clearError:", e); } }
function getSupplierIdFromUrl() { /* ... (Same as previous version) ... */ try { const params = new URLSearchParams(window.location.search); return params.get('id'); } catch (e) { console.error("Error getting supplier ID from URL:", e); displayError("Could not read supplier ID from page address."); return null; } }
function formatDate(timestamp, includeTime = false) { /* ... (Same as previous version) ... */ if (!timestamp || typeof timestamp.toDate !== 'function') { return '-'; } try { const date = timestamp.toDate(); const optionsDate = { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' }; const optionsTime = { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }; const formattedDate = date.toLocaleDateString('en-IN', optionsDate); if (includeTime) { return `${formattedDate}, ${date.toLocaleTimeString('en-IN', optionsTime)}`; } return formattedDate; } catch (e) { console.error("Error formatting date:", timestamp, e); return 'Format Error'; } }
function formatCurrency(amount) { /* ... (Same as previous version) ... */ try { let numAmount = typeof amount === 'number' ? amount : parseFloat(amount); if (isNaN(numAmount)) { return '₹ --.--'; } return `₹ ${numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; } catch (e) { console.error("Error formatting currency:", amount, e); return '₹ Format Error'; } }
function getStatusClass(status) { /* ... (Same as previous version) ... */ if (!status) return 'status-unknown'; const normalizedStatus = status.toLowerCase().replace(/\s+/g, '-'); switch (normalizedStatus) { case 'new': return 'status-new'; case 'sent': return 'status-sent'; case 'printing': return 'status-printing'; case 'product-received': return 'status-product-received'; case 'po-paid': return 'status-po-paid'; case 'cancel': return 'status-cancel'; default: return 'status-unknown'; } }
function getPaymentStatusClass(status) { /* ... (Same as previous version) ... */ if (!status) return 'payment-status-pending'; const normalizedStatus = status.toLowerCase().replace(/\s+/g, '-'); switch (normalizedStatus) { case 'pending': return 'payment-status-pending'; case 'partially-paid': return 'payment-status-partially-paid'; case 'paid': return 'payment-status-paid'; default: return 'payment-status-pending'; } }
function escapeHtml(unsafe) { /* ... (Same as previous version) ... */ if (typeof unsafe !== 'string') { unsafe = String(unsafe || ''); } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }

// --- UI Population Functions ---
function populateSupplierDetails(data) {
    console.log("Populating supplier details with data:", data);
    const elements = { // IDs from updated HTML
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
        supplierStatusBadge: document.getElementById('supplierStatusBadge'), // New
        supplierRemarksNotes: document.getElementById('supplierRemarksNotes') // New
    };
    // Check if all required elements exist
    for (const key in elements) { if (!elements[key]) { console.warn(`Supplier Detail element missing: ${key}`); } }

    // Populate safely
    const status = data?.status || 'active'; // Default to active
    if (elements.supplierStatusBadge) {
        elements.supplierStatusBadge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        elements.supplierStatusBadge.className = 'status-badge'; // Reset
        elements.supplierStatusBadge.classList.add(`status-${status.toLowerCase()}`); // Use customer CSS convention
    }
    if (elements.supplierRemarksNotes) { elements.supplierRemarksNotes.textContent = data?.notes || 'No remarks.'; } // Use 'notes' field like customer

    if (elements.supplierNameHeader) elements.supplierNameHeader.textContent = data?.name || 'Details';
    if (elements.supplierNameBreadcrumb) elements.supplierNameBreadcrumb.textContent = data?.name || 'Details';
    if (elements.detailSupplierId) elements.detailSupplierId.textContent = currentSupplierId || 'N/A';
    if (elements.detailSupplierName) elements.detailSupplierName.textContent = data?.name || 'N/A';
    if (elements.detailSupplierCompany) elements.detailSupplierCompany.textContent = data?.companyName || 'N/A';
    if (elements.detailSupplierWhatsapp) elements.detailSupplierWhatsapp.textContent = data?.whatsappNo || 'N/A';
    if (elements.detailSupplierContact) elements.detailSupplierContact.textContent = data?.contact || 'N/A';
    if (elements.detailSupplierEmail) elements.detailSupplierEmail.textContent = data?.email || 'N/A';
    if (elements.detailSupplierGst) elements.detailSupplierGst.textContent = data?.gstNo || 'N/A';
    if (elements.detailSupplierAddress) elements.detailSupplierAddress.textContent = data?.address || 'N/A';
    if (elements.detailAddedOn) elements.detailAddedOn.textContent = data?.createdAt ? formatDate(data.createdAt) : 'N/A';

    // Update toggle button text based on status
    const toggleStatusBtn = document.getElementById('toggleSupplierStatusBtn'); // Correct ID
    const toggleStatusBtnSpan = toggleStatusBtn ? toggleStatusBtn.querySelector('span') : null;
     if (toggleStatusBtn && toggleStatusBtnSpan) {
         const isInactive = status !== 'active';
         toggleStatusBtnSpan.textContent = isInactive ? 'Enable Account' : 'Disable Account';
         toggleStatusBtn.querySelector('i').className = isInactive ? 'fas fa-toggle-off' : 'fas fa-toggle-on';
         // Use classes based on customer theme button styles
         toggleStatusBtn.className = `button status-toggle-button ${isInactive ? 'enable' : 'disable'}`;
     }
}

function populatePaymentHistory(payments) {
    // ... (Keep existing function, IDs match HTML) ...
     console.log("Populating payment history"); const tableBody = document.getElementById('transactionsTableBody'); const loadingRow = document.getElementById('transactionsLoading'); const noDataRow = document.getElementById('noTransactionsMessage'); const errorDisplay = document.getElementById('supplierPaymentListError'); if (!tableBody) { console.error("Payment history table body ('transactionsTableBody') not found!"); if(errorDisplay) displayError("Could not display payment history (UI element missing).", 'supplierPaymentListError'); return; } tableBody.innerHTML = ''; if (errorDisplay) errorDisplay.style.display = 'none'; if (loadingRow) loadingRow.style.display = 'none'; if (!payments || payments.length === 0) { if (noDataRow) { noDataRow.style.display = 'table-row'; } else { tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No payment history found.</td></tr>'; } return; } if (noDataRow) noDataRow.style.display = 'none'; payments.sort((a, b) => (b.paymentDate?.toDate?.() || 0) - (a.paymentDate?.toDate?.() || 0)); payments.forEach((payment) => { try { const row = tableBody.insertRow(); row.insertCell(0).textContent = formatDate(payment.paymentDate, true); row.insertCell(1).textContent = payment.notes || payment.description || payment.reference || '-'; row.insertCell(2).textContent = payment.paymentMethod || payment.mode || 'N/A'; let linkedPoDisplay = '-'; if (Array.isArray(payment.linkedPoNumbers) && payment.linkedPoNumbers.length > 0) { linkedPoDisplay = payment.linkedPoNumbers.join(', '); } else if (payment.linkedPoNumber) { linkedPoDisplay = payment.linkedPoNumber; } row.insertCell(3).textContent = linkedPoDisplay; const amountCell = row.insertCell(4); amountCell.textContent = formatCurrency(payment.paymentAmount); amountCell.classList.add('amount-paid'); row.insertCell(5); } catch(e) { console.error(`Error creating payment row:`, payment, e); } });
}

function populatePoHistoryTable(pos) {
    // ... (Keep existing function, IDs match HTML) ...
     console.log("Populating PO history"); const tableBody = document.getElementById('supplierPoTableBody'); const loadingRow = document.getElementById('supplierPoLoading'); const noDataRow = document.getElementById('noSupplierPoMessage'); const errorDisplay = document.getElementById('supplierPoListError'); if (!tableBody) { console.error("PO history table body ('supplierPoTableBody') not found!"); if (errorDisplay) displayError("Could not display PO history (UI element missing).", 'supplierPoListError'); return; } tableBody.innerHTML = ''; if (errorDisplay) errorDisplay.style.display = 'none'; if (loadingRow) loadingRow.style.display = 'none'; if (!pos || pos.length === 0) { if (noDataRow) { noDataRow.style.display = 'table-row'; } else { tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No purchase orders found.</td></tr>'; } return; } if (noDataRow) noDataRow.style.display = 'none'; pos.sort((a, b) => (b.orderDate?.toDate?.() || 0) - (a.orderDate?.toDate?.() || 0)); pos.forEach((po) => { try { const row = tableBody.insertRow(); row.insertCell(0).textContent = po.poNumber || `PO-${po.id.substring(0, 6)}`; row.insertCell(1).textContent = formatDate(po.orderDate); const amountCell = row.insertCell(2); amountCell.textContent = formatCurrency(po.totalAmount); amountCell.classList.add('amount-po'); const statusCell = row.insertCell(3); const statusSpan = document.createElement('span'); statusSpan.className = `status-badge ${getStatusClass(po.status)}`; statusSpan.textContent = po.status || 'Unknown'; statusCell.appendChild(statusSpan); const paymentStatusCell = row.insertCell(4); const paymentStatusSpan = document.createElement('span'); paymentStatusSpan.className = `status-badge ${getPaymentStatusClass(po.paymentStatus)}`; paymentStatusSpan.textContent = po.paymentStatus || 'Pending'; paymentStatusCell.appendChild(paymentStatusSpan); row.insertCell(5); } catch (e) { console.error(`Error creating PO row:`, po, e); } });
}

function populatePoCheckboxListForPayment(pos) {
    // ... (Keep existing function, IDs match HTML) ...
    const listContainer = document.getElementById('paymentLinkPOList'); if (!listContainer) { console.error("PO Checkbox list container ('paymentLinkPOList') not found!"); return; } listContainer.innerHTML = ''; if (!pos || pos.length === 0) { listContainer.innerHTML = '<p>No POs found.</p>'; return; } const openPOs = pos.filter(po => { const total = parseFloat(po.totalAmount) || 0; const paid = parseFloat(po.amountPaid) || 0; return po.paymentStatus !== 'Paid' && (isNaN(paid) || total - paid > 0.01); }); if (openPOs.length === 0) { listContainer.innerHTML = '<p>No open POs found.</p>'; return; } openPOs.sort((a, b) => (a.orderDate?.toDate?.() || 0) - (b.orderDate?.toDate?.() || 0)); openPOs.forEach((po) => { const total = parseFloat(po.totalAmount) || 0; const paid = parseFloat(po.amountPaid) || 0; const balance = total - paid; const div = document.createElement('div'); div.className = 'po-checkbox-item'; const checkboxId = `po_link_${po.id}`; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = checkboxId; checkbox.name = 'linkedPOs'; checkbox.value = po.id; checkbox.dataset.poNumber = po.poNumber || `PO-${po.id.substring(0, 6)}`; checkbox.dataset.poBalance = balance.toFixed(2); const label = document.createElement('label'); label.htmlFor = checkboxId; label.innerHTML = `<span class="po-number">${po.poNumber || po.id.substring(0, 6)}</span> <span class="po-date">(${formatDate(po.orderDate)})</span> <span class="po-balance">Balance: ${formatCurrency(balance)}</span>`; div.appendChild(checkbox); div.appendChild(label); listContainer.appendChild(div); });
}

// --- Data Fetching Helpers (Adapted for Supplier) ---
async function getSupplierTotalPoValue(supplierId) { /* ... (Keep existing) ... */ let total = 0; try { const q = query(collection(db, "purchaseOrders"), where("supplierId", "==", supplierId)); const snapshot = await getDocs(q); snapshot.forEach(doc => { total += Number(doc.data().totalAmount || 0); }); console.log(`Workspaceed Total PO Value: ${total}`); return total; } catch (error) { console.error("Error fetching PO total:", error); return 0; } }
async function getSupplierTotalPaymentAmount(supplierId) { /* ... (Keep existing) ... */ let total = 0; try { const q = query(collection(db, "supplier_payments"), where("supplierId", "==", supplierId)); const snapshot = await getDocs(q); snapshot.forEach(doc => { total += Number(doc.data().paymentAmount || 0); }); console.log(`Workspaceed Total Payment Amount: ${total}`); return total; } catch (error) { console.error("Error fetching payment total:", error); return 0; } }
async function getSupplierAdjustmentTotals(supplierId) { /* ... (Keep existing) ... */ let totalDebit = 0; let totalCredit = 0; try { const q = query(collection(db, "supplierAccountAdjustments"), where("supplierId", "==", supplierId)); const snapshot = await getDocs(q); snapshot.forEach(doc => { const adj = doc.data(); const amount = Number(adj.amount || 0); if (adj.adjustmentType === 'debit') { totalDebit += amount; } else if (adj.adjustmentType === 'credit') { totalCredit += amount; } }); console.log(`Workspaceed Adjustment Totals: Debit=${totalDebit}, Credit=${totalCredit}`); return { totalDebit, totalCredit }; } catch (error) { if (error.code === 'failed-precondition') { console.warn("Firestore index missing for supplierAccountAdjustments by supplierId."); } else { console.error("Error fetching adjustment totals:", error); } return { totalDebit: 0, totalCredit: 0 }; } }

// --- Account Summary Update (Adapted for Supplier) ---
async function updateSupplierAccountSummary(supplierId) {
    console.log(`Updating account summary for supplier: ${supplierId}`);
    const summaryTotalPoValue = document.getElementById('summaryTotalPoValue');
    const summaryTotalPaid = document.getElementById('summaryTotalPaid');
    const summaryBalance = document.getElementById('summaryBalance');
    if (!summaryTotalPoValue || !summaryTotalPaid || !summaryBalance) { console.error("Account summary elements missing!"); return; }
    summaryTotalPoValue.textContent = "Calculating..."; summaryTotalPaid.textContent = "Calculating..."; summaryBalance.textContent = "Calculating...";
    summaryBalance.className = 'balance-info loading-state'; clearError('accountSummaryError');
    try {
        const [poTotal, paymentTotal, adjustmentTotals] = await Promise.all([ getSupplierTotalPoValue(supplierId), getSupplierTotalPaymentAmount(supplierId), getSupplierAdjustmentTotals(supplierId) ]);
        // Balance Logic: Payable = PO Total + Adjustments(Debit) - Payments - Adjustments(Credit)
        const totalDebits = poTotal + adjustmentTotals.totalDebit; // Amount you owe / PO value
        const totalCredits = paymentTotal + adjustmentTotals.totalCredit; // Amount you paid / Got credit
        const finalBalance = totalDebits - totalCredits; // Positive = You Owe (Payable), Negative = Supplier Owes You (Credit)
        summaryTotalPoValue.textContent = formatCurrency(poTotal);
        summaryTotalPaid.textContent = formatCurrency(paymentTotal);
        summaryBalance.classList.remove('loading-state', 'balance-due', 'balance-credit', 'balance-zero');
        if (finalBalance > 0.005) { summaryBalance.textContent = formatCurrency(finalBalance) + " Payable"; summaryBalance.classList.add('balance-due'); }
        else if (finalBalance < -0.005) { summaryBalance.textContent = formatCurrency(Math.abs(finalBalance)) + " Credit"; summaryBalance.classList.add('balance-credit'); }
        else { summaryBalance.textContent = formatCurrency(0); summaryBalance.classList.add('balance-zero'); }
        console.log(`Account summary updated. Final Balance: ${finalBalance}`);
    } catch (error) { console.error("Error updating account summary:", error); displayError(`Error calculating summary: ${error.message}`, 'accountSummaryError'); summaryTotalPoValue.textContent = "Error"; summaryTotalPaid.textContent = "Error"; summaryBalance.textContent = "Error"; summaryBalance.classList.add('balance-due'); }
    finally { summaryTotalPoValue.classList.remove('loading-state'); summaryTotalPaid.classList.remove('loading-state'); }
}


// --- Account Ledger (Adapted for Supplier) ---
async function loadSupplierAccountLedger(supplierId) {
    console.log(`Loading account ledger for supplier: ${supplierId}`);
    const accountLedgerTableBody = document.getElementById('accountLedgerTableBody'); // Correct ID
    if (!accountLedgerTableBody) { console.error("Ledger table body missing."); return; }
    clearError('supplierLedgerError');
    accountLedgerTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;" class="loading-state">Loading ledger...</td></tr>`;
    let transactions = [];
    try {
        // 1. Fetch POs (Debit - Increases amount payable by you)
        const poQuery = query(collection(db, "purchaseOrders"), where("supplierId", "==", supplierId), firestoreOrderBy("orderDate", "asc"));
        const poSnapshot = await getDocs(poQuery);
        poSnapshot.forEach(doc => {
            const po = doc.data();
            transactions.push({ date: po.orderDate, type: 'po', description: `PO #${po.poNumber || doc.id.substring(0,6)}`, debitAmount: Number(po.totalAmount || 0), creditAmount: 0, docId: doc.id });
        });
        // 2. Fetch Payments (Credit - Decreases amount payable by you)
        const paymentQuery = query(collection(db, "supplier_payments"), where("supplierId", "==", supplierId), firestoreOrderBy("paymentDate", "asc"));
        const paymentSnapshot = await getDocs(paymentQuery);
        paymentSnapshot.forEach(doc => {
            const payment = doc.data();
            transactions.push({ date: payment.paymentDate, type: 'payment', description: `Payment Sent (${payment.paymentMethod || 'N/A'}) ${payment.notes ? '- '+payment.notes : ''}`, debitAmount: 0, creditAmount: Number(payment.paymentAmount || 0), docId: doc.id });
        });
        // 3. Fetch Adjustments
        const adjQuery = query(collection(db, "supplierAccountAdjustments"), where("supplierId", "==", supplierId), firestoreOrderBy("adjustmentDate", "asc"));
        const adjSnapshot = await getDocs(adjQuery);
        adjSnapshot.forEach(doc => {
            const adj = doc.data();
            const amount = Number(adj.amount || 0);
            const typeText = adj.adjustmentType === 'debit' ? 'Debit' : 'Credit';
            // Debit Adjustment increases amount payable
            // Credit Adjustment decreases amount payable
            transactions.push({ date: adj.adjustmentDate, type: 'adjustment', description: `Adjustment (${typeText})${adj.remarks ? ': ' + adj.remarks : ''}`, debitAmount: adj.adjustmentType === 'debit' ? amount : 0, creditAmount: adj.adjustmentType === 'credit' ? amount : 0, docId: doc.id });
        });
        // 4. Sort All Transactions
        transactions.sort((a, b) => { const dateA = a.date?.toDate ? a.date.toDate().getTime() : 0; const dateB = b.date?.toDate ? b.date.toDate().getTime() : 0; if (dateA === dateB) { if (a.debitAmount > 0 && b.creditAmount > 0) return -1; if (a.creditAmount > 0 && b.debitAmount > 0) return 1; } return dateA - dateB; });
        // 5. Render Ledger
        accountLedgerTableBody.innerHTML = '';
        let runningBalance = 0; // Positive = Payable, Negative = Credit
        if (transactions.length === 0) { accountLedgerTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No transactions found.</td></tr>`; }
        else {
            transactions.forEach(tx => {
                runningBalance = runningBalance + tx.debitAmount - tx.creditAmount;
                const row = accountLedgerTableBody.insertRow();
                row.insertCell(0).textContent = tx.date?.toDate ? formatDate(tx.date.toDate()) : 'N/A';
                const descCell = row.insertCell(1); descCell.textContent = escapeHtml(tx.description); descCell.title = tx.description; // Tooltip
                const debitCell = row.insertCell(2); debitCell.textContent = tx.debitAmount > 0 ? formatCurrency(tx.debitAmount) : '-'; debitCell.classList.add('amount-po'); // Style debit like PO amount
                const creditCell = row.insertCell(3); creditCell.textContent = tx.creditAmount > 0 ? formatCurrency(tx.creditAmount) : '-'; creditCell.classList.add('amount-paid'); // Style credit like payment amount
                const cellBalance = row.insertCell(4);
                cellBalance.classList.remove('ledger-balance-positive', 'ledger-balance-negative', 'ledger-balance-zero');
                if (runningBalance > 0.005) { cellBalance.textContent = formatCurrency(runningBalance) + " Payable"; cellBalance.classList.add('ledger-balance-negative'); } // Payable = Red
                else if (runningBalance < -0.005) { cellBalance.textContent = formatCurrency(Math.abs(runningBalance)) + " Credit"; cellBalance.classList.add('ledger-balance-positive'); } // Credit = Green
                else { cellBalance.textContent = formatCurrency(0); cellBalance.classList.add('ledger-balance-zero'); }
            });
        }
        console.log(`Ledger rendered. Final running balance: ${runningBalance}`);
    } catch (error) { console.error("Error loading account ledger:", error); if(error.code === 'failed-precondition'){ const msg = `Error loading ledger: Firestore Index required. Check console.`; displayError(msg, 'supplierLedgerError'); accountLedgerTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">${msg}</td></tr>`; } else{ displayError(`Error loading ledger: ${error.message}`, 'supplierLedgerError'); accountLedgerTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Error loading ledger.</td></tr>`; } }
}

// --- Core Data Loading (Supplier Page) ---
async function loadSupplierPageData() {
    // ... (Keep existing function, it calls the individual load functions) ...
     console.log("loadSupplierPageData called"); if (!currentSupplierId) { console.error("Supplier ID is null"); displayError("Cannot load data: Supplier ID is missing."); return; } if (!db) { displayError("Database connection failed."); return; } if (isRefreshingData) { console.log("Data refresh already in progress."); return; } isRefreshingData = true; const loadingIndicator = document.getElementById('loadingIndicator'); if (loadingIndicator) loadingIndicator.style.display = 'block'; clearError(); try { console.log("Fetching core supplier details for ID:", currentSupplierId); const supplierRef = doc(db, "suppliers", currentSupplierId); const supplierSnap = await getDoc(supplierRef); if (!supplierSnap.exists()) { throw new Error("Supplier not found in database."); } currentSupplierData = { id: supplierSnap.id, ...supplierSnap.data() }; populateSupplierDetails(currentSupplierData); const status = currentSupplierData.status || 'active'; if (editSupplierDetailsBtn) editSupplierDetailsBtn.disabled = false; if (addPaymentMadeBtn) addPaymentMadeBtn.disabled = (status !== 'active'); if (addSupplierAdjustmentBtn) addSupplierAdjustmentBtn.disabled = false; if (toggleSupplierStatusBtn) toggleSupplierStatusBtn.disabled = false; if (deleteSupplierBtn) deleteSupplierBtn.disabled = false; if (addNewPoLink) { addNewPoLink.href = `new_po.html?supplierId=${encodeURIComponent(currentSupplierId)}&supplierName=${encodeURIComponent(currentSupplierData.name || '')}`; addNewPoLink.classList.remove('disabled'); if (status !== 'active') addNewPoLink.classList.add('disabled'); } console.log("Fetching POs, Payments, Ledger, Summary..."); await Promise.all([ loadSupplierPoHistory(currentSupplierId), loadSupplierPaymentHistory(currentSupplierId), loadSupplierAccountLedger(currentSupplierId), updateSupplierAccountSummary(currentSupplierId) ]); console.log("All supplier page data fetched and displayed."); } catch (error) { console.error("Error loading supplier page data:", error); displayError(`Error loading data: ${error.message}.`); populateSupplierDetails(null); if(supplierPoTableBody) supplierPoTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Error loading POs.</td></tr>'; if(transactionsTableBody) transactionsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Error loading payments.</td></tr>'; if(accountLedgerTableBody) accountLedgerTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Error loading ledger.</td></tr>'; if(summaryBalance) summaryBalance.textContent = "Error"; const buttons = document.querySelectorAll('.actions-bar .button, .actions-bar a.button'); buttons.forEach(btn => btn.disabled = true); } finally { if (loadingIndicator) loadingIndicator.style.display = 'none'; isRefreshingData = false; }
}
async function loadSupplierPoHistory(supplierId) { /* ... (Keep existing) ... */ try { const q = query(collection(db, "purchaseOrders"), where("supplierId", "==", supplierId), firestoreOrderBy("orderDate", "desc")); const snapshot = await getDocs(q); purchaseOrdersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); populatePoHistoryTable(purchaseOrdersData); } catch (error) { console.error("Error loading PO history:", error); displayError("Could not load PO History.", "supplierPoListError"); populatePoHistoryTable([]); } }
async function loadSupplierPaymentHistory(supplierId) { /* ... (Keep existing) ... */ try { const q = query(collection(db, "supplier_payments"), where("supplierId", "==", supplierId), firestoreOrderBy("paymentDate", "desc")); const snapshot = await getDocs(q); supplierPaymentsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); populatePaymentHistory(supplierPaymentsData); } catch (error) { console.error("Error loading Payment history:", error); displayError("Could not load Payment History.", "supplierPaymentListError"); populatePaymentHistory([]); } }

// --- Refresh Data Function ---
async function refreshSupplierPageData() { /* ... (Keep existing) ... */ console.log("Refreshing supplier page data..."); await loadSupplierPageData(); }

// --- Modal Functions & Handlers ---
// Add Payment Modal
function openPaymentModal(){ /* Keep existing */ if (!currentSupplierData) { alert("Supplier data not loaded yet."); return; } const paymentMadeModal=document.getElementById('paymentMadeModal'); const paymentMadeForm=document.getElementById('paymentMadeForm'); const paymentSupplierName=document.getElementById('paymentSupplierName'); if(!paymentMadeModal || !paymentMadeForm || !paymentSupplierName) { console.error("Payment modal elements missing."); return; } clearError('paymentMadeError'); paymentMadeForm.reset(); paymentSupplierName.textContent = currentSupplierData.name || 'Supplier'; try { paymentMadeForm.querySelector('#paymentDate').valueAsDate = new Date(); } catch(e){ paymentMadeForm.querySelector('#paymentDate').value = new Date().toISOString().slice(0,10); } populatePoCheckboxListForPayment(purchaseOrdersData); paymentMadeModal.classList.add('active'); }
function closePaymentModal(){ /* Keep existing */ if (paymentMadeModal) paymentMadeModal.classList.remove('active'); }
async function handleSavePayment(event) { /* Keep existing, calls refresh */ event.preventDefault(); if (!currentSupplierId || !db) { displayError("Cannot save payment.", "paymentMadeError"); return; } const amountInput = document.getElementById('paymentAmount'); const dateInput = document.getElementById('paymentDate'); const methodInput = document.getElementById('paymentMethod'); const notesInput = document.getElementById('paymentNotes'); const poListContainer = document.getElementById('paymentLinkPOList'); const saveBtn = document.getElementById('savePaymentBtn'); if (!amountInput || !dateInput || !methodInput || !notesInput || !poListContainer || !saveBtn) { displayError("Payment form elements missing.", "paymentMadeError"); return; } const amount = parseFloat(amountInput.value); const paymentDateStr = dateInput.value; const method = methodInput.value; const notes = notesInput.value.trim(); if (isNaN(amount) || amount <= 0) { displayError("Please enter a valid positive payment amount.", "paymentMadeError"); amountInput.focus(); return; } if (!paymentDateStr) { displayError("Please select a payment date.", "paymentMadeError"); dateInput.focus(); return; } if (!method) { displayError("Please select a payment method.", "paymentMadeError"); methodInput.focus(); return; } const selectedCheckboxes = poListContainer.querySelectorAll('input[name="linkedPOs"]:checked'); const linkedPoIds = Array.from(selectedCheckboxes).map(cb => cb.value); const linkedPoNumbers = Array.from(selectedCheckboxes).map(cb => cb.dataset.poNumber); saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; clearError('paymentMadeError'); try { const localDate = new Date(paymentDateStr + 'T00:00:00'); const paymentDate = Timestamp.fromDate(localDate); const paymentData = { supplierId: currentSupplierId, supplierName: currentSupplierData?.name || 'N/A', paymentAmount: amount, paymentDate: paymentDate, paymentMethod: method, notes: notes, createdAt: serverTimestamp(), linkedPoIds: linkedPoIds || [], linkedPoNumbers: linkedPoNumbers || [] }; const paymentDocRef = await addDoc(collection(db, "supplier_payments"), paymentData); console.log("Payment recorded:", paymentDocRef.id); if (linkedPoIds.length > 0) { console.warn(`TODO: Update PO status logic needed for ${linkedPoIds.length} POs`); } closePaymentModal(); alert("Payment recorded successfully!"); await refreshSupplierPageData(); } catch (error) { console.error("Error saving payment:", error); displayError(`Failed to save payment: ${error.message}`, "paymentMadeError"); } finally { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Payment'; } }

// Edit Supplier Modal
function openEditSupplierModal(){ /* Keep existing, added notes */ const editSupplierModal=document.getElementById('editSupplierModal'); const editSupplierForm=document.getElementById('editSupplierForm'); const editSupplierNotes = document.getElementById('editSupplierNotes'); if(!editSupplierModal || !editSupplierForm || !currentSupplierData || !currentSupplierId){ console.error("Edit modal elements missing."); return; } clearError('editSupplierError'); editSupplierForm.reset(); document.getElementById('editingSupplierId').value = currentSupplierId; document.getElementById('editSupplierNameInput').value = currentSupplierData.name || ''; document.getElementById('editSupplierCompanyInput').value = currentSupplierData.companyName || ''; document.getElementById('editSupplierWhatsappInput').value = currentSupplierData.whatsappNo || ''; document.getElementById('editSupplierContactInput').value = currentSupplierData.contact || ''; document.getElementById('editSupplierEmailInput').value = currentSupplierData.email || ''; document.getElementById('editSupplierGstInput').value = currentSupplierData.gstNo || ''; document.getElementById('editSupplierAddressInput').value = currentSupplierData.address || ''; if(editSupplierNotes) editSupplierNotes.value = currentSupplierData.notes || ''; editSupplierModal.classList.add('active'); }
function closeEditSupplierModal(){ /* Keep existing */ if (editSupplierModal) editSupplierModal.classList.remove('active'); }
async function handleEditSupplierSubmit(event){ /* Keep existing, added notes, calls refresh */ event.preventDefault(); if (!currentSupplierId || !db) { displayError("Cannot update supplier.", "editSupplierError"); return; } const form = event.target; const saveBtn = document.getElementById('updateSupplierBtn'); if(!form || !saveBtn) { displayError("Edit form error.", "editSupplierError"); return; } const updatedData = { name: form.querySelector('#editSupplierNameInput')?.value.trim(), name_lowercase: form.querySelector('#editSupplierNameInput')?.value.trim().toLowerCase(), companyName: form.querySelector('#editSupplierCompanyInput')?.value.trim(), whatsappNo: form.querySelector('#editSupplierWhatsappInput')?.value.trim(), contact: form.querySelector('#editSupplierContactInput')?.value.trim(), email: form.querySelector('#editSupplierEmailInput')?.value.trim(), gstNo: form.querySelector('#editSupplierGstInput')?.value.trim(), address: form.querySelector('#editSupplierAddressInput')?.value.trim(), notes: form.querySelector('#editSupplierNotes')?.value.trim() || null, updatedAt: serverTimestamp() }; if (!updatedData.name) { displayError("Supplier Name is required.", "editSupplierError"); return; } saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; clearError('editSupplierError'); try { const supplierRef = doc(db, "suppliers", currentSupplierId); await updateDoc(supplierRef, updatedData); console.log("Supplier details updated."); alert("Supplier details updated successfully!"); closeEditSupplierModal(); await refreshSupplierPageData(); } catch(error) { console.error("Error updating supplier:", error); displayError(`Failed to update: ${error.message}`, "editSupplierError"); } finally { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Update Supplier'; } }

// --- Add Adjustment Modal Functions (NEW - Adapted for Supplier) ---
function openAddSupplierAdjustmentModal() { /* Keep existing */ const addSupplierAdjustmentModal=document.getElementById('addSupplierAdjustmentModal'); const adjustmentSupplierName=document.getElementById('adjustmentSupplierName'); const addSupplierAdjustmentForm=document.getElementById('addSupplierAdjustmentForm'); const supplierAdjustmentDate=document.getElementById('supplierAdjustmentDate'); const supplierAdjustmentTypeDebit=document.getElementById('supplierAdjustmentTypeDebit'); const saveSupplierAdjustmentBtn=document.getElementById('saveSupplierAdjustmentBtn'); if(!addSupplierAdjustmentModal || !currentSupplierData){ alert("Cannot open add adjustment modal."); return; } console.log("Opening Add Supplier Adjustment modal."); addSupplierAdjustmentForm.reset(); if(adjustmentSupplierName) adjustmentSupplierName.textContent = currentSupplierData.name || ''; if(supplierAdjustmentDate) try { supplierAdjustmentDate.valueAsDate = new Date(); } catch(e){ supplierAdjustmentDate.value = new Date().toISOString().slice(0,10); } if(supplierAdjustmentTypeDebit) supplierAdjustmentTypeDebit.checked = true; if(saveSupplierAdjustmentBtn) { saveSupplierAdjustmentBtn.disabled = false; saveSupplierAdjustmentBtn.innerHTML = '<i class="fas fa-save"></i> Save Adjustment'; } clearError('supplierAdjustmentError'); addSupplierAdjustmentModal.classList.add('active'); }
function closeAddSupplierAdjustmentModal() { /* Keep existing */ if (addSupplierAdjustmentModal) addSupplierAdjustmentModal.classList.remove('active'); }
async function handleSaveSupplierAdjustment(event) { /* Keep existing, calls refresh */ event.preventDefault(); if (!addDoc || !collection || !Timestamp || !currentSupplierId) { alert("DB function missing or Supplier ID missing."); return; } const supplierAdjustmentAmount=document.getElementById('supplierAdjustmentAmount'); const supplierAdjustmentDate=document.getElementById('supplierAdjustmentDate'); const supplierAdjustmentTypeDebit=document.getElementById('supplierAdjustmentTypeDebit'); const supplierAdjustmentTypeCredit=document.getElementById('supplierAdjustmentTypeCredit'); const supplierAdjustmentRemarks=document.getElementById('supplierAdjustmentRemarks'); const saveSupplierAdjustmentBtn=document.getElementById('saveSupplierAdjustmentBtn'); const amount = parseFloat(supplierAdjustmentAmount.value); const date = supplierAdjustmentDate.value; const type = supplierAdjustmentTypeDebit.checked ? 'debit' : (supplierAdjustmentTypeCredit.checked ? 'credit' : null); const remarks = supplierAdjustmentRemarks.value.trim(); if (!type) { displayError("Please select adjustment type.", "supplierAdjustmentError"); return; } if (isNaN(amount) || amount <= 0) { displayError("Please enter a valid positive adjustment amount.", "supplierAdjustmentError"); return; } if (!date) { displayError("Please select an adjustment date.", "supplierAdjustmentError"); return; } saveSupplierAdjustmentBtn.disabled = true; saveSupplierAdjustmentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; try { const adjustmentDateTimestamp = Timestamp.fromDate(new Date(date + 'T00:00:00')); const adjustmentData = { supplierId: currentSupplierId, supplierName: currentSupplierData?.name || 'N/A', amount: amount, adjustmentType: type, adjustmentDate: adjustmentDateTimestamp, remarks: remarks || null, createdAt: Timestamp.now() }; const docRef = await addDoc(collection(db, "supplierAccountAdjustments"), adjustmentData); console.log("Supplier Adjustment added:", docRef.id); alert("Account adjustment added successfully!"); closeAddSupplierAdjustmentModal(); await refreshSupplierPageData(); } catch (error) { console.error("Error saving supplier adjustment:", error); displayError(`Error saving adjustment: ${error.message}`, "supplierAdjustmentError"); } finally { saveSupplierAdjustmentBtn.disabled = false; saveSupplierAdjustmentBtn.innerHTML = '<i class="fas fa-save"></i> Save Adjustment'; } }

// --- Toggle Status Functions (NEW - Adapted for Supplier) ---
function handleToggleSupplierStatus() { /* Keep existing */ if(!currentSupplierId || !currentSupplierData){ alert("Supplier data not loaded."); return; } const currentStatus = currentSupplierData.status || 'active'; const isDisabling = currentStatus === 'active'; const actionText = isDisabling ? 'disable' : 'enable'; const newStatus = isDisabling ? 'inactive' : 'active'; openConfirmToggleSupplierModal(actionText, newStatus); }
function openConfirmToggleSupplierModal(action, newStatus) { /* Keep existing */ const confirmToggleSupplierStatusModal=document.getElementById('confirmToggleSupplierStatusModal'); const toggleSupplierActionText=document.getElementById('toggleSupplierActionText'); const toggleSupplierName=document.getElementById('toggleSupplierName'); const confirmToggleSupplierCheckbox=document.getElementById('confirmToggleSupplierCheckbox'); const confirmSupplierToggleBtn=document.getElementById('confirmSupplierToggleBtn'); const toggleSupplierWarningMessage=document.getElementById('toggleSupplierWarningMessage'); const toggleSupplierCheckboxLabel=document.getElementById('toggleSupplierCheckboxLabel'); const confirmSupplierToggleBtnText=document.getElementById('confirmSupplierToggleBtnText'); if(!confirmToggleSupplierStatusModal || !toggleSupplierActionText || !toggleSupplierName || !confirmToggleSupplierCheckbox || !confirmSupplierToggleBtn || !toggleSupplierWarningMessage || !toggleSupplierCheckboxLabel || !confirmSupplierToggleBtnText){ console.error("Toggle confirm modal elements missing!"); return; } console.log(`Opening confirm toggle modal. Action: ${action}, New Status: ${newStatus}`); toggleSupplierActionText.textContent = action; toggleSupplierName.textContent = currentSupplierData?.name || 'this supplier'; toggleSupplierWarningMessage.style.display = (action === 'disable') ? 'block' : 'none'; toggleSupplierCheckboxLabel.textContent = `I understand and want to ${action} this account.`; confirmSupplierToggleBtnText.textContent = action.charAt(0).toUpperCase() + action.slice(1) + ' Account'; const icon = confirmSupplierToggleBtn.querySelector('i'); confirmSupplierToggleBtn.className = `button status-toggle-button ${action === 'disable' ? 'disable' : 'enable'}`; if (icon) icon.className = `fas ${action === 'disable' ? 'fa-toggle-off' : 'fa-toggle-on'}`; confirmToggleSupplierCheckbox.checked = false; confirmSupplierToggleBtn.disabled = true; confirmSupplierToggleBtn.dataset.newStatus = newStatus; confirmToggleSupplierStatusModal.classList.add('active'); }
function closeConfirmToggleSupplierModal() { /* Keep existing */ const confirmToggleSupplierStatusModal=document.getElementById('confirmToggleSupplierStatusModal'); if (confirmToggleSupplierStatusModal) confirmToggleSupplierStatusModal.classList.remove('active');}
async function executeToggleSupplierStatus(newStatus) { /* Keep existing, calls loadSupplierPageData */ if(!updateDoc || !doc || !Timestamp || !currentSupplierId){ alert("DB function missing."); return; } const button = document.getElementById('confirmSupplierToggleBtn'); button.disabled = true; const originalHTML = button.innerHTML; button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`; try { const supplierRef = doc(db, "suppliers", currentSupplierId); await updateDoc(supplierRef, { status: newStatus, updatedAt: Timestamp.now() }); console.log(`Supplier status successfully changed to ${newStatus}.`); alert(`Supplier account status changed to ${newStatus}.`); closeConfirmToggleSupplierModal(); await loadSupplierPageData(); /* <<< Reload Data */ } catch (error) { console.error("Error toggling supplier status:", error); alert(`Error changing status: ${error.message}`); } finally { button.disabled = false; button.innerHTML = originalHTML; } }

// --- Delete Supplier Functions (NEW - Adapted for Supplier) ---
function handleDeleteSupplier() { /* Keep existing */ if(!currentSupplierId || !currentSupplierData){ alert("Supplier data not loaded."); return; } openConfirmDeleteSupplierModal(); }
function openConfirmDeleteSupplierModal() { /* Keep existing */ const confirmDeleteSupplierModal=document.getElementById('confirmDeleteSupplierModal'); const deleteSupplierName=document.getElementById('deleteSupplierName'); const confirmDeleteSupplierCheckbox=document.getElementById('confirmDeleteSupplierCheckbox'); const confirmSupplierDeleteBtn=document.getElementById('confirmSupplierDeleteBtn'); if(!confirmDeleteSupplierModal || !deleteSupplierName || !confirmDeleteSupplierCheckbox || !confirmSupplierDeleteBtn){ console.error("Delete confirm modal elements missing!"); return; } console.log("Opening delete supplier confirmation modal."); deleteSupplierName.textContent = currentSupplierData?.name || 'this supplier'; confirmDeleteSupplierCheckbox.checked = false; confirmSupplierDeleteBtn.disabled = true; confirmDeleteSupplierModal.classList.add('active'); }
function closeConfirmDeleteSupplierModal() { /* Keep existing */ const confirmDeleteSupplierModal=document.getElementById('confirmDeleteSupplierModal'); if (confirmDeleteSupplierModal) confirmDeleteSupplierModal.classList.remove('active');}
async function executeDeleteSupplier() { /* Keep existing */ if(!deleteDoc || !doc || !currentSupplierId){ alert("DB function missing."); return; } const supplierName = currentSupplierData?.name || `ID: ${currentSupplierId}`; console.log(`Executing permanent deletion for supplier ${currentSupplierId}`); const button = document.getElementById('confirmSupplierDeleteBtn'); button.disabled = true; const originalHTML = button.innerHTML; button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Deleting...`; try { await deleteDoc(doc(db, "suppliers", currentSupplierId)); console.log("Supplier deleted successfully."); alert(`Supplier "${supplierName}" has been permanently deleted.`); closeConfirmDeleteSupplierModal(); window.location.href = 'supplier_management.html'; } catch (error) { console.error("Error deleting supplier:", error); alert(`Error deleting supplier: ${error.message}`); button.disabled = false; button.innerHTML = originalHTML; } }


// --- Event Listeners Setup (MERGED) ---
function setupEventListeners() {
    if (listenersAttached) { console.log("Listeners already attached."); return; }
    console.log("Setting up MERGED event listeners...");

    // --- Supplier Core Buttons ---
    const addPayBtn = document.getElementById('addPaymentMadeBtn');
    const editSupplierBtn = document.getElementById('editSupplierDetailsBtn');
    const backBtn = document.querySelector('a.back-button'); // Use class
    const addPOBtn = document.getElementById('addNewPoLink');

    if (addPayBtn) addPayBtn.addEventListener('click', openPaymentModal); else console.warn("Add Payment Btn not found");
    if (editSupplierBtn) editSupplierBtn.addEventListener('click', openEditSupplierModal); else console.warn("Edit Supplier Details Btn not found");
    if (backBtn) backBtn.addEventListener('click', (e) => { e.preventDefault(); window.location.href = 'supplier_management.html'; }); else console.warn("Back to List Btn not found");
    if (!addPOBtn) console.warn("Add New PO Link not found");

    // --- Added Feature Buttons ---
    const addAdjBtn = document.getElementById('addSupplierAdjustmentBtn');
    const toggleStatusBtn = document.getElementById('toggleSupplierStatusBtn');
    const delSupplierBtn = document.getElementById('deleteSupplierBtn');

    if (addAdjBtn) addAdjBtn.addEventListener('click', openAddSupplierAdjustmentModal); else console.warn("Add Supplier Adjustment Btn not found");
    if (toggleStatusBtn) toggleStatusBtn.addEventListener('click', handleToggleSupplierStatus); else console.warn("Toggle Supplier Status Btn not found");
    if (delSupplierBtn) delSupplierBtn.addEventListener('click', handleDeleteSupplier); else console.warn("Delete Supplier Btn not found");

    // --- Payment Modal ---
    const closeBtnPay = document.getElementById('closePaymentMadeModalBtn');
    const cancelBtnPay = document.getElementById('cancelPaymentBtn');
    const payModal = document.getElementById('paymentMadeModal');
    const payForm = document.getElementById('paymentMadeForm');
    if (closeBtnPay) closeBtnPay.addEventListener('click', closePaymentModal); else console.warn("Close Payment Modal Btn not found");
    if (cancelBtnPay) cancelBtnPay.addEventListener('click', closePaymentModal); else console.warn("Cancel Payment Btn not found");
    if (payModal) payModal.addEventListener('click', (event) => { if (event.target === payModal) closePaymentModal(); }); else console.warn("Payment Modal not found");
    if (payForm) payForm.addEventListener('submit', handleSavePayment); else console.warn("Payment Form not found");

    // --- Edit Supplier Modal ---
    const closeEditBtn = document.getElementById('closeEditSupplierBtn');
    const cancelEditBtn = document.getElementById('cancelEditSupplierBtn');
    const editModal = document.getElementById('editSupplierModal');
    const editForm = document.getElementById('editSupplierForm');
    if (closeEditBtn) closeEditBtn.addEventListener('click', closeEditSupplierModal); else console.warn("Close Edit Supplier Btn not found");
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditSupplierModal); else console.warn("Cancel Edit Supplier Btn not found");
    if (editModal) editModal.addEventListener('click', (event) => { if (event.target === editModal) closeEditSupplierModal(); }); else console.warn("Edit Supplier Modal not found");
    if (editForm) editForm.addEventListener('submit', handleEditSupplierSubmit); else console.warn("Edit Supplier Form not found");

    // --- Add Adjustment Modal ---
    const closeAdjModal = document.getElementById('closeSupplierAdjustmentModal');
    const cancelAdjBtn = document.getElementById('cancelSupplierAdjustmentBtn');
    const adjModal = document.getElementById('addSupplierAdjustmentModal');
    const adjForm = document.getElementById('addSupplierAdjustmentForm');
    if(closeAdjModal) closeAdjModal.addEventListener('click', closeAddSupplierAdjustmentModal); else console.warn("Close Adjustment Modal Btn not found");
    if(cancelAdjBtn) cancelAdjBtn.addEventListener('click', closeAddSupplierAdjustmentModal); else console.warn("Cancel Adjustment Btn not found");
    if(adjModal) adjModal.addEventListener('click', (e) => { if(e.target === adjModal) closeAddSupplierAdjustmentModal(); }); else console.warn("Adjustment Modal not found");
    if(adjForm) adjForm.addEventListener('submit', handleSaveSupplierAdjustment); else console.warn("Adjustment Form not found");

    // --- Confirm Toggle Status Modal ---
    const closeConfirmToggleModal = document.getElementById('closeConfirmToggleSupplierModal');
    const cancelToggleBtn = document.getElementById('cancelSupplierToggleBtn');
    const confirmToggleModal = document.getElementById('confirmToggleSupplierStatusModal');
    const confirmToggleChk = document.getElementById('confirmToggleSupplierCheckbox');
    const confirmToggleActionBtn = document.getElementById('confirmSupplierToggleBtn');
    if(closeConfirmToggleModal) closeConfirmToggleModal.addEventListener('click', closeConfirmToggleSupplierModal); else console.warn("Close Confirm Toggle Modal Btn not found");
    if(cancelToggleBtn) cancelToggleBtn.addEventListener('click', closeConfirmToggleSupplierModal); else console.warn("Cancel Toggle Btn not found");
    if(confirmToggleModal) confirmToggleModal.addEventListener('click', (e) => { if(e.target === confirmToggleModal) closeConfirmToggleSupplierModal(); }); else console.warn("Confirm Toggle Modal not found");
    if(confirmToggleChk) confirmToggleChk.addEventListener('change', () => { if(confirmToggleActionBtn) confirmToggleActionBtn.disabled = !confirmToggleChk.checked; }); else console.warn("Confirm Toggle Checkbox not found");
    if(confirmToggleActionBtn) confirmToggleActionBtn.addEventListener('click', () => { const newStatus = confirmToggleActionBtn.dataset.newStatus; if(confirmToggleChk.checked && newStatus){ executeToggleSupplierStatus(newStatus); } }); else console.warn("Confirm Toggle Action Btn not found");

    // --- Confirm Delete Modal ---
    const closeConfirmDeleteModal = document.getElementById('closeConfirmDeleteSupplierModal');
    const cancelDeleteBtn = document.getElementById('cancelSupplierDeleteBtn');
    const confirmDeleteModal = document.getElementById('confirmDeleteSupplierModal');
    const confirmDeleteChk = document.getElementById('confirmDeleteSupplierCheckbox');
    const confirmDeleteActionBtn = document.getElementById('confirmSupplierDeleteBtn');
    if(closeConfirmDeleteModal) closeConfirmDeleteModal.addEventListener('click', closeConfirmDeleteSupplierModal); else console.warn("Close Confirm Delete Modal Btn not found");
    if(cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeConfirmDeleteSupplierModal); else console.warn("Cancel Delete Btn not found");
    if(confirmDeleteModal) confirmDeleteModal.addEventListener('click', (e) => { if(e.target === confirmDeleteModal) closeConfirmDeleteSupplierModal(); }); else console.warn("Confirm Delete Modal not found");
    if(confirmDeleteChk) confirmDeleteChk.addEventListener('change', () => { if(confirmDeleteActionBtn) confirmDeleteActionBtn.disabled = !confirmDeleteChk.checked; }); else console.warn("Confirm Delete Checkbox not found");
    if(confirmDeleteActionBtn) confirmDeleteActionBtn.addEventListener('click', () => { if(confirmDeleteChk.checked){ executeDeleteSupplier(); } }); else console.warn("Confirm Delete Action Btn not found");

    listenersAttached = true;
    console.log("MERGED event listeners setup complete.");
}

// --- Global Initialization & Auto-run ---
// Ensure this runs only once after DOM is ready and auth state is known
function attemptInitialization() {
    console.log("Attempting initialization (v7 - Merged)...");
    if (initializationAttempted) { console.log("Initialization already attempted."); return; }
    initializationAttempted = true;
    // Ensure the main init function is defined before calling
    if (typeof window.initializeSupplierDetailPage === 'function') {
        console.log("Calling initializeSupplierDetailPage...");
        window.initializeSupplierDetailPage(); // Auth check should be handled within or by the inline script
    } else {
        console.error("Initialization function (window.initializeSupplierDetailPage) not found!");
        displayError("Page initialization function failed to load.");
    }
}

// Main initialization function for this page (now includes auth check assumption)
window.initializeSupplierDetailPage = (user) => { // Accept user object if passed by auth check
     console.log("initializeSupplierDetailPage called (v7 - Merged)");
     if (supplierDetailPageInitialized) { console.log("Supplier detail page already initialized."); return; }

     currentSupplierId = getSupplierIdFromUrl();
     if (!currentSupplierId) { displayError("Supplier ID missing from URL."); return; }
     console.log("Supplier ID:", currentSupplierId);

     const mainContent = document.getElementById('supplierAccountDetailContent');
     if (mainContent) { mainContent.style.visibility = 'visible'; }
     else { console.error("Critical: Main content container missing!"); displayError("Page layout structure is broken."); return; }

     supplierDetailPageInitialized = true;
     clearError();

     // Setup listeners ONCE upon initialization
     if (!listenersAttached) {
         setupEventListeners();
     }

     // Load data (assuming auth is already confirmed by the time this runs)
     // The inline script in HTML <head> should handle Auth check and call this
     console.log("Triggering initial data load (assuming user is authenticated)...");
     loadSupplierPageData(); // Load all data including ledger, summary etc.

};

// Trigger initialization based on DOM readiness (Auth check in HTML will call the function)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log("DOMContentLoaded fired. Initialization will be triggered by Auth script in <head>.");
        // attemptInitialization(); // Let Auth script call initializeSupplierDetailPage
    });
} else {
    console.log("DOM already loaded. Initialization will be triggered by Auth script in <head>.");
    // attemptInitialization(); // Let Auth script call initializeSupplierDetailPage
}

console.log("supplier_account_detail.js (v7 - Merged) script loaded.");