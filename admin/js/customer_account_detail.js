// js/customer_account_detail.js (Version 2.5.0 - Adjustment & Balance Display)

// --- Firebase Functions ---
const {
    db, doc, getDoc, collection, query, where, getDocs, orderBy: firestoreOrderBy,
    updateDoc, deleteDoc, Timestamp, arrayUnion, addDoc
} = window;

// --- Global State ---
let currentCustomerId = null;
let currentCustomerData = null;
// REMOVED: Global variable for total paid amount is no longer sufficient due to adjustments.
// let currentTotalPaidAmount = 0; // Removed

// --- DOM References ---
// (Assume all IDs from HTML exist)
const editCustomerBtn = document.getElementById('editCustomerBtn');
const addPaymentBtn = document.getElementById('addPaymentBtn');
const addAdjustmentBtn = document.getElementById('addAdjustmentBtn'); // <<< New Adjustment Button
const toggleStatusBtn = document.getElementById('toggleStatusBtn');
const deleteCustomerBtn = document.getElementById('deleteCustomerBtn');
const addPaymentModal = document.getElementById('addPaymentModal');
const closePaymentModalBtn = document.getElementById('closePaymentModal');
const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
const addPaymentForm = document.getElementById('addPaymentForm');
const paymentModalCustNameSpan = document.getElementById('payment-modal-cust-name');
const paymentAmountInput = document.getElementById('paymentAmount');
const paymentDateInput = document.getElementById('paymentDate');
const paymentMethodSelect = document.getElementById('paymentMethod');
const paymentNotesInput = document.getElementById('paymentNotes');
const savePaymentBtn = document.getElementById('savePaymentBtn');

// <<< New Adjustment Modal References >>>
const addAdjustmentModal = document.getElementById('addAdjustmentModal');
const closeAdjustmentModalBtn = document.getElementById('closeAdjustmentModal');
const cancelAdjustmentBtn = document.getElementById('cancelAdjustmentBtn');
const addAdjustmentForm = document.getElementById('addAdjustmentForm');
const adjustmentModalCustNameSpan = document.getElementById('adjustment-modal-cust-name');
const adjustmentTypeDebitRadio = document.getElementById('adjustmentTypeDebit');
const adjustmentTypeCreditRadio = document.getElementById('adjustmentTypeCredit');
const adjustmentAmountInput = document.getElementById('adjustmentAmount');
const adjustmentDateInput = document.getElementById('adjustmentDate');
const adjustmentRemarksInput = document.getElementById('adjustmentRemarks');
const saveAdjustmentBtn = document.getElementById('saveAdjustmentBtn');
// <<< End New Adjustment Modal References >>>

const customerEditModal = document.getElementById('customerEditModal');
const closeCustomerEditModalBtn = document.getElementById('closeCustomerEditModal');
const cancelCustomerEditBtn = document.getElementById('cancelCustomerEditBtn');
const customerEditForm = document.getElementById('customerEditForm');
const customerEditModalTitle = document.getElementById('customerEditModalTitle');
const editCustPageCustomerIdInput = document.getElementById('editCustPageCustomerId');
const customerEditFullNameInput = document.getElementById('customerEditFullName');
const customerEditWhatsAppInput = document.getElementById('customerEditWhatsApp');
const customerEditContactInput = document.getElementById('customerEditContact');
const customerEditAddressInput = document.getElementById('customerEditAddress');
const customerEditEmailInput = document.getElementById('customerEditEmail');
const customerEditCityInput = document.getElementById('customerEditCity');
const customerEditStateInput = document.getElementById('customerEditState');
const creditEditYesRadio = document.getElementById('creditEditYes');
const creditEditNoRadio = document.getElementById('creditEditNo');
const creditLimitEditGroup = document.getElementById('creditLimitEditGroup');
const customerEditCreditLimitInput = document.getElementById('customerEditCreditLimit');
const customerEditNotesInput = document.getElementById('customerEditNotes');
const saveCustomerEditBtn = document.getElementById('saveCustomerEditBtn');
const detailsModal_CustPage = document.getElementById('detailsModal');
const modalOrderIdInput_CustPage = document.getElementById('modalOrderId');
const closeModalBtn_CustPage = document.getElementById('closeDetailsModal');
const modalDisplayOrderIdSpan_CustPage = document.getElementById('modalDisplayOrderId');
const modalCustomerNameSpan_CustPage = document.getElementById('modalCustomerName');
const modalCustomerWhatsAppSpan_CustPage = document.getElementById('modalCustomerWhatsApp');
const modalOrderStatusSelect_CustPage = document.getElementById('modalOrderStatus');
const modalUpdateStatusBtn_CustPage = document.getElementById('modalUpdateStatusBtn');
const modalDeleteBtn_CustPage = document.getElementById('modalDeleteBtn');
const modalEditFullBtn_CustPage = document.getElementById('modalEditFullBtn');
const modalProductListContainer_CustPage = document.getElementById('modalProductList');
const modalStatusHistoryListContainer_CustPage = document.getElementById('modalStatusHistoryList');
const confirmToggleStatusModal = document.getElementById('confirmToggleStatusModal');
const closeConfirmToggleModalBtn = document.getElementById('closeConfirmToggleModal');
const cancelToggleBtn = document.getElementById('cancelToggleBtn');
const confirmToggleBtn = document.getElementById('confirmToggleBtn');
const confirmToggleCheckbox = document.getElementById('confirmToggleCheckbox');
const toggleActionTextSpan = document.getElementById('toggleActionText');
const toggleCustNameSpan = document.getElementById('toggleCustName');
const toggleWarningMessage = document.getElementById('toggleWarningMessage');
const toggleCheckboxLabel = document.getElementById('toggleCheckboxLabel');
const confirmToggleBtnText = document.getElementById('confirmToggleBtnText');
const confirmDeleteModal = document.getElementById('confirmDeleteModal');
const closeConfirmDeleteModalBtn = document.getElementById('closeConfirmDeleteModal');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const confirmDeleteCheckboxModal = document.getElementById('confirmDeleteCheckboxModal');
const deleteCustNameSpan = document.getElementById('deleteCustName');

// Ledger Table Body Reference
const accountLedgerTableBody = document.getElementById('accountLedgerTableBody');

// --- Helper Functions ---
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { unsafe = String(unsafe || ''); } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function formatDate(dateObj) { if (!dateObj || typeof dateObj.toLocaleDateString !== 'function') return 'N/A'; return dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function formatDateTime(dateObj) { if (!dateObj || typeof dateObj.toLocaleDateString !== 'function') return '?'; return dateObj.toLocaleDateString('en-GB',{day:'numeric',month:'short'}) + ' ' + dateObj.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}); }
function formatCurrency(amount) { const num = Number(amount || 0); return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

// --- Core Page Logic ---

function getCustomerIdFromUrl() { const params = new URLSearchParams(window.location.search); return params.get('id'); }

async function loadCustomerDetails(customerId) {
    console.log(`V2.5.0: Loading details for customer: ${customerId}`);
    currentCustomerData = null;
    // Enable adjustment button after customer loads
    if(addAdjustmentBtn) addAdjustmentBtn.disabled = true;

    if (!db || !doc || !getDoc) {
        displayError("DB function missing (details).");
        return false;
    }

    // Get all element references
    const nameHeaderEl = document.getElementById('cust-detail-name-header');
    const nameBreadcrumbEl = document.getElementById('cust-detail-name-breadcrumb');
    const idEl = document.getElementById('cust-detail-id');
    const whatsappEl = document.getElementById('cust-detail-whatsapp');
    const contactEl = document.getElementById('cust-detail-contact');
    const emailEl = document.getElementById('cust-detail-email');
    const addressEl = document.getElementById('cust-detail-address');
    const cityEl = document.getElementById('cust-detail-city');
    const stateEl = document.getElementById('cust-detail-state');
    const statusEl = document.getElementById('cust-detail-status');
    const creditAllowedEl = document.getElementById('cust-detail-credit-allowed');
    const creditLimitEl = document.getElementById('cust-detail-credit-limit');
    const notesEl = document.getElementById('cust-detail-notes');
    const toggleStatusBtn = document.getElementById('toggleStatusBtn');
    const toggleStatusBtnSpan = toggleStatusBtn ? toggleStatusBtn.querySelector('span') : null;
    const addNewOrderLink = document.getElementById('addNewOrderLink');
    const editCustomerBtn = document.getElementById('editCustomerBtn');
    const addPaymentBtn = document.getElementById('addPaymentBtn');
    const deleteCustomerBtn = document.getElementById('deleteCustomerBtn');

    // Set initial loading states
    if (nameHeaderEl) nameHeaderEl.textContent = "Loading...";
    if (nameBreadcrumbEl) nameBreadcrumbEl.textContent = "Loading...";
    // Optionally clear other fields or show 'Loading...'

    try {
        const customerRef = doc(db, "customers", customerId);
        const customerSnap = await getDoc(customerRef);

        if (customerSnap.exists()) {
            currentCustomerData = customerSnap.data();
            console.log("V2.5.0: Customer data fetched:", currentCustomerData);
            const customerName = currentCustomerData.fullName || 'N/A';

            // Update UI elements
            if (nameHeaderEl) nameHeaderEl.textContent = customerName;
            if (nameBreadcrumbEl) nameBreadcrumbEl.textContent = customerName;
            document.title = `Customer Account - ${customerName}`;
            if (idEl) idEl.textContent = currentCustomerData.customCustomerId || 'N/A';
            if (whatsappEl) whatsappEl.textContent = currentCustomerData.whatsappNo || '-';
            if (contactEl) contactEl.textContent = currentCustomerData.contactNo || '-';
            if (emailEl) emailEl.textContent = currentCustomerData.email || '-';
            if (addressEl) addressEl.textContent = (currentCustomerData.billingAddress || currentCustomerData.address || '-');
            if (cityEl) cityEl.textContent = currentCustomerData.city || '-';
            if (stateEl) stateEl.textContent = currentCustomerData.state || '-';

            const status = currentCustomerData.status || 'active';
            if (statusEl) {
                statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
                statusEl.className = 'status-badge'; // Reset classes
                statusEl.classList.add(`status-${status.toLowerCase()}`);
            }

            if (toggleStatusBtn && toggleStatusBtnSpan) {
                const isInactive = status !== 'active';
                toggleStatusBtnSpan.textContent = isInactive ? 'Enable Account' : 'Disable Account';
                toggleStatusBtn.querySelector('i').className = isInactive ? 'fas fa-toggle-off' : 'fas fa-toggle-on';
                toggleStatusBtn.className = `button ${isInactive ? 'success-button' : 'secondary-button'}`;
            }

            const creditAllowed = currentCustomerData.creditAllowed === true;
            if (creditAllowedEl) creditAllowedEl.textContent = creditAllowed ? 'Yes' : 'No';
            if (creditLimitEl) creditLimitEl.textContent = creditAllowed ? formatCurrency(currentCustomerData.creditLimit) : 'N/A';
            if (notesEl) notesEl.textContent = currentCustomerData.notes || 'No remarks.';

            // Enable buttons
            if (editCustomerBtn) editCustomerBtn.disabled = false;
            if (addPaymentBtn) addPaymentBtn.disabled = false;
            if (addAdjustmentBtn) addAdjustmentBtn.disabled = false; // Enable adjustment button
            if (toggleStatusBtn) toggleStatusBtn.disabled = false;
            if (deleteCustomerBtn) deleteCustomerBtn.disabled = false;

            // Update Add New Order link
            if (addNewOrderLink) {
                addNewOrderLink.href = `new_order.html?customerId=${encodeURIComponent(customerId)}&customerName=${encodeURIComponent(customerName)}`;
                addNewOrderLink.classList.remove('disabled');
            }

            console.log("V2.5.0: Customer details displayed.");
            return true; // Success
        } else {
            displayError("Customer not found.");
            return false; // Failure
        }
    } catch (error) {
        console.error("V2.5.0: Error loading customer details:", error);
        displayError(`Error loading details: ${error.message}`);
        return false; // Failure
    }
}

// --- Data Fetching Helper Functions ---

/** Fetches total order value for a customer. */
async function getCustomerTotalOrderValue(customerId) {
    let total = 0;
    if (!collection || !query || !where || !getDocs) {
        console.error("V2.5.0: DB functions missing (orders total).");
        return 0;
    }
    try {
        const q = query(collection(db, "orders"), where("customerId", "==", customerId));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            total += Number(doc.data().totalAmount || 0);
        });
        console.log(`V2.5.0: Calculated Total Order Value: ${total}`);
        return total;
    } catch (error) {
        console.error("V2.5.0: Error fetching order total:", error);
        return 0;
    }
}

/** Fetches total payment amount for a customer. */
async function getCustomerTotalPaymentAmount(customerId) {
    let total = 0;
    if (!collection || !query || !where || !getDocs) {
        console.error("V2.5.0: DB functions missing (payments total).");
        return 0;
    }
    try {
        const q = query(collection(db, "payments"), where("customerId", "==", customerId));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            total += Number(doc.data().amountPaid || 0);
        });
         console.log(`V2.5.0: Calculated Total Payment Amount: ${total}`);
        return total;
    } catch (error) {
         if(error.code === 'failed-precondition'){
             console.warn("V2.5.0: Firestore index missing for payments by customerId. Calculation might be incomplete.");
         } else {
            console.error("V2.5.0: Error fetching payment total:", error);
         }
        return 0;
    }
}

/** Fetches total adjustment amounts (debit and credit) for a customer. */
async function getCustomerAdjustmentTotals(customerId) {
    let totalDebit = 0;
    let totalCredit = 0;
    if (!collection || !query || !where || !getDocs) {
        console.error("V2.5.0: DB functions missing (adjustments total).");
        return { totalDebit: 0, totalCredit: 0 };
    }
    try {
        const q = query(collection(db, "accountAdjustments"), where("customerId", "==", customerId));
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
        console.log(`V2.5.0: Calculated Adjustment Totals: Debit=${totalDebit}, Credit=${totalCredit}`);
        return { totalDebit, totalCredit };
    } catch (error) {
        if(error.code === 'failed-precondition'){
             console.warn("V2.5.0: Firestore index missing for adjustments by customerId. Calculation might be incomplete.");
         } else {
            console.error("V2.5.0: Error fetching adjustment totals:", error);
        }
        return { totalDebit: 0, totalCredit: 0 };
    }
}


/**
 * Fetches and displays order history. (No balance calculation here anymore)
 */
async function loadOrderHistory(customerId) {
    console.log(`V2.5.0: Loading order history for customer: ${customerId}`);
    const orderTableBody = document.getElementById('customerOrderTableBody');

    if (!orderTableBody) { console.error("V2.5.0: Order table body missing."); return; }
    if (!collection || !query || !where || !getDocs || !firestoreOrderBy ) {
        displayError("DB function missing (orders).");
        orderTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Error loading orders</td></tr>`;
        return;
    }

    orderTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Loading orders...</td></tr>`;

    // Clone and replace the table body to remove old event listeners
    const newOrderTableBody = orderTableBody.cloneNode(false);
    orderTableBody.parentNode.replaceChild(newOrderTableBody, orderTableBody);

    try {
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef, where("customerId", "==", customerId), firestoreOrderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            newOrderTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">No orders found.</td></tr>`;
        } else {
            querySnapshot.forEach(doc => {
                const order = doc.data();
                const firestoreOrderId = doc.id;

                const displayOrderId = order.orderId || order.customOrderId || `(sys) ${firestoreOrderId.substring(0,6)}...`;
                const orderDate = order.createdAt?.toDate ? formatDate(order.createdAt.toDate()) : 'N/A';
                const status = order.status || order.currentStatus || 'Unknown';

                let productsHtml = 'N/A';
                if (order.products && Array.isArray(order.products)) {
                   productsHtml = order.products.map(p => `${escapeHtml(p.name || '?')} (${escapeHtml(p.quantity || '?')})`).join('<br>');
                } else if (order.items && Array.isArray(order.items)) { // Compatibility with potential 'items' field
                     productsHtml = order.items.map(p => `${escapeHtml(p.productName || '?')} (${escapeHtml(p.quantity || '?')})`).join('<br>');
                }


                const row = newOrderTableBody.insertRow();
                row.setAttribute('data-order-id', firestoreOrderId);
                row.classList.add('order-row-clickable'); // Class for click handling

                // Create and populate cells
                const cellId = row.insertCell();
                cellId.textContent = displayOrderId;

                const cellDate = row.insertCell();
                cellDate.textContent = orderDate;

                const cellProducts = row.insertCell();
                cellProducts.innerHTML = productsHtml; // Use innerHTML for line breaks

                const cellStatus = row.insertCell();
                const statusBadge = document.createElement('span');
                statusBadge.className = `status-badge status-${status.toLowerCase().replace(/\s+/g, '-')}`;
                statusBadge.textContent = escapeHtml(status);
                cellStatus.appendChild(statusBadge);
            });

             // Add event listener using delegation on the new table body
             newOrderTableBody.addEventListener('click', (event) => {
                 const clickedRow = event.target.closest('tr.order-row-clickable');
                 if (clickedRow && clickedRow.dataset.orderId) {
                     openOrderDetailsModal_CustPage(clickedRow.dataset.orderId);
                 }
             });
        }
        console.log(`V2.5.0: Order history loaded.`);

    } catch (error) {
        console.error("V2.5.0: Error loading order history:", error);
        displayError(`Error loading orders: ${error.message}`);
        newOrderTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Error loading orders.</td></tr>`;
    }
}


/**
 * Updates the Account Summary box using calculated totals. (MODIFIED in V2.5.0)
 * Fetches order, payment, and adjustment totals to calculate final balance.
 * Implements new display logic: (-) Red for Due, (+) Green for Credit.
 */
async function updateAccountSummary(customerId) {
    console.log(`V2.5.0: Updating account summary for customer: ${customerId}`);
    const summaryTotalOrdersEl = document.getElementById('summary-total-orders');
    const summaryTotalPaidEl = document.getElementById('summary-total-paid');
    const summaryBalanceEl = document.getElementById('summary-balance');

    if (!summaryTotalOrdersEl || !summaryTotalPaidEl || !summaryBalanceEl) {
        console.error("V2.5.0: Account summary elements missing!");
        return;
    }

    // Set loading state
    summaryTotalOrdersEl.textContent = "Calculating...";
    summaryTotalPaidEl.textContent = "Calculating...";
    summaryBalanceEl.textContent = "Calculating...";
    summaryBalanceEl.className = 'balance-info'; // Default class

    try {
        // Fetch all necessary totals in parallel
        const [orderTotal, paymentTotal, adjustmentTotals] = await Promise.all([
            getCustomerTotalOrderValue(customerId),
            getCustomerTotalPaymentAmount(customerId),
            getCustomerAdjustmentTotals(customerId)
        ]);

        const totalDebits = orderTotal + adjustmentTotals.totalDebit;
        const totalCredits = paymentTotal + adjustmentTotals.totalCredit;
        const finalBalance = totalDebits - totalCredits; // Positive = Due, Negative = Credit

        // Update Total Order Value display (consider if adjustments should be shown separately?)
        // For now, just show raw order total.
        summaryTotalOrdersEl.textContent = formatCurrency(orderTotal);

        // Update Total Paid Amount display (consider if adjustments should be shown separately?)
        // For now, just show raw payment total.
        summaryTotalPaidEl.textContent = formatCurrency(paymentTotal);

        // Update Outstanding Balance display with new logic
        summaryBalanceEl.classList.remove('balance-due', 'balance-credit', 'balance-info'); // Clear previous classes

        if (finalBalance > 0.005) { // Customer owes money (Due)
            summaryBalanceEl.textContent = formatCurrency(finalBalance) + " Dr."; // Show positive value + Dr.
            summaryBalanceEl.classList.add('balance-due'); // Red color
        } else if (finalBalance < -0.005) { // Customer has credit (Advance)
             summaryBalanceEl.textContent = formatCurrency(Math.abs(finalBalance)) + " Cr."; // Show positive value + Cr.
            summaryBalanceEl.classList.add('balance-credit'); // Green color
        } else { // Zero balance
            summaryBalanceEl.textContent = formatCurrency(0);
            summaryBalanceEl.classList.add('balance-info'); // Neutral color
        }

        console.log(`V2.5.0: Account summary updated. Final Balance: ${finalBalance}`);

    } catch (error) {
        console.error("V2.5.0: Error updating account summary:", error);
        summaryTotalOrdersEl.textContent = "Error";
        summaryTotalPaidEl.textContent = "Error";
        summaryBalanceEl.textContent = "Error";
        summaryBalanceEl.className = 'balance-due'; // Show error in red
    }
}


/**
 * Loads orders, payments, AND adjustments, merges them chronologically,
 * and displays the account ledger with running balance. (MODIFIED in V2.5.0)
 * Implements new display logic for running balance: (-) Red for Due, (+) Green for Credit.
 */
async function loadAccountLedger(customerId) {
    console.log(`V2.5.0: Loading account ledger for customer: ${customerId}`);
    if (!accountLedgerTableBody) { console.error("V2.5.0: Ledger table body missing."); return; }
    if (!db || !collection || !query || !where || !getDocs || !firestoreOrderBy || !Timestamp) {
        displayError("DB function missing (ledger).");
        accountLedgerTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Error loading ledger</td></tr>`;
        return;
    }

    accountLedgerTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Loading ledger...</td></tr>`;

    let transactions = [];

    try {
        // 1. Fetch Orders (sorted ascending by date)
        const ordersRef = collection(db, "orders");
        const orderQuery = query(ordersRef, where("customerId", "==", customerId), firestoreOrderBy("createdAt", "asc"));
        const orderSnapshot = await getDocs(orderQuery);
        orderSnapshot.forEach(doc => {
            const order = doc.data();
            const orderId = order.orderId || order.customOrderId || `Sys: ${doc.id.substring(0,6)}`;
            transactions.push({
                date: order.createdAt, // Firestore Timestamp
                type: 'order',
                description: `Order #${orderId}`,
                debitAmount: Number(order.totalAmount || 0),
                creditAmount: 0,
                docId: doc.id
            });
        });
        console.log(`V2.5.0: Fetched ${orderSnapshot.size} orders for ledger.`);

        // 2. Fetch Payments (sorted ascending by date)
        const paymentsRef = collection(db, "payments");
        const paymentQuery = query(paymentsRef, where("customerId", "==", customerId), firestoreOrderBy("paymentDate", "asc"));
        const paymentSnapshot = await getDocs(paymentQuery);
        paymentSnapshot.forEach(doc => {
            const payment = doc.data();
            transactions.push({
                date: payment.paymentDate, // Firestore Timestamp
                type: 'payment',
                description: `Payment Received (${payment.paymentMethod || 'N/A'})${payment.notes ? ' - ' + payment.notes : ''}`,
                debitAmount: 0,
                creditAmount: Number(payment.amountPaid || 0),
                docId: doc.id
            });
        });
        console.log(`V2.5.0: Fetched ${paymentSnapshot.size} payments for ledger.`);

        // 3. <<< NEW: Fetch Adjustments (sorted ascending by date) >>>
        const adjustmentsRef = collection(db, "accountAdjustments");
        const adjustmentQuery = query(adjustmentsRef, where("customerId", "==", customerId), firestoreOrderBy("adjustmentDate", "asc"));
        const adjustmentSnapshot = await getDocs(adjustmentQuery);
        adjustmentSnapshot.forEach(doc => {
            const adj = doc.data();
            const amount = Number(adj.amount || 0);
            const typeText = adj.adjustmentType === 'debit' ? 'Debit' : 'Credit';
            transactions.push({
                date: adj.adjustmentDate, // Firestore Timestamp
                type: 'adjustment',
                description: `Adjustment (${typeText})${adj.remarks ? ': ' + adj.remarks : ''}`,
                debitAmount: adj.adjustmentType === 'debit' ? amount : 0,
                creditAmount: adj.adjustmentType === 'credit' ? amount : 0,
                docId: doc.id // Store ID if needed for deletion later
            });
        });
         console.log(`V2.5.0: Fetched ${adjustmentSnapshot.size} adjustments for ledger.`);
        // <<< END NEW >>>

        // 4. Sort All Transactions Chronologically by Date
        transactions.sort((a, b) => {
            const dateA = a.date?.toDate ? a.date.toDate().getTime() : 0;
            const dateB = b.date?.toDate ? b.date.toDate().getTime() : 0;
            // If dates are the same, maybe process debits first? (Optional refinement)
            if (dateA === dateB) {
                if (a.debitAmount > 0 && b.creditAmount > 0) return -1; // Debit before Credit on same timestamp
                if (a.creditAmount > 0 && b.debitAmount > 0) return 1; // Credit after Debit on same timestamp
            }
            return dateA - dateB; // Primary sort by date ascending
        });
        console.log(`V2.5.0: Sorted ${transactions.length} total transactions.`);

        // 5. Render Ledger Table with Running Balance and New Display Logic
        accountLedgerTableBody.innerHTML = ''; // Clear loading/previous state
        let runningBalance = 0; // Positive = Due, Negative = Credit

        if (transactions.length === 0) {
            accountLedgerTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No transactions found.</td></tr>`;
        } else {
            transactions.forEach(tx => {
                // Calculate running balance *before* displaying the row
                // Debit increases amount due (more positive balance)
                // Credit decreases amount due (more negative balance / more credit)
                runningBalance = runningBalance + tx.debitAmount - tx.creditAmount;

                const row = accountLedgerTableBody.insertRow();

                const cellDate = row.insertCell();
                cellDate.textContent = tx.date?.toDate ? formatDate(tx.date.toDate()) : 'N/A';

                const cellDesc = row.insertCell();
                cellDesc.textContent = escapeHtml(tx.description);
                 // Add tooltip for potentially long descriptions
                cellDesc.title = escapeHtml(tx.description);

                const cellDebit = row.insertCell();
                cellDebit.textContent = tx.debitAmount > 0 ? formatCurrency(tx.debitAmount) : '-';
                cellDebit.style.textAlign = 'right';

                const cellCredit = row.insertCell();
                cellCredit.textContent = tx.creditAmount > 0 ? formatCurrency(tx.creditAmount) : '-';
                cellCredit.style.textAlign = 'right';

                const cellBalance = row.insertCell();
                cellBalance.style.textAlign = 'right';
                cellBalance.classList.remove('ledger-balance-positive', 'ledger-balance-negative', 'ledger-balance-zero'); // Clear previous

                // Apply new display logic for running balance
                if (runningBalance > 0.005) { // Customer owes (Due)
                    cellBalance.textContent = formatCurrency(runningBalance) + " Dr.";
                    cellBalance.classList.add('ledger-balance-negative'); // Use negative class for Red
                } else if (runningBalance < -0.005) { // Customer has credit
                    cellBalance.textContent = formatCurrency(Math.abs(runningBalance)) + " Cr.";
                    cellBalance.classList.add('ledger-balance-positive'); // Use positive class for Green
                } else { // Zero balance
                    cellBalance.textContent = formatCurrency(0);
                     cellBalance.classList.add('ledger-balance-zero'); // Optional class for zero
                }
            });
        }
        console.log(`V2.5.0: Ledger rendered. Final running balance: ${runningBalance}`);

    } catch (error) {
        console.error("V2.5.0: Error loading account ledger:", error);
         if(error.code === 'failed-precondition'){
             const msg = `Error loading ledger: Firestore Index required. Please check Firestore console for needed indexes on 'orders', 'payments', and 'accountAdjustments'.`;
             displayError(msg);
             console.error("Firestore Index Error:", error.message);
             accountLedgerTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">${msg}</td></tr>`;
         } else{
            displayError(`Error loading ledger: ${error.message}`);
             accountLedgerTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Error loading ledger.</td></tr>`;
         }
    }
}


// --- Order Details Modal Functions --- (No changes needed for ledger/adjustment)
async function openOrderDetailsModal_CustPage(firestoreId) {
    // ... (existing code - no changes needed here)
    if(!detailsModal_CustPage || !firestoreId){ console.error("V2.5.0: Modal/Order ID missing."); alert("Cannot open details."); return; }
    console.log(`V2.5.0: Opening order modal: ${firestoreId}`);
    // Reset modal fields
    modalOrderIdInput_CustPage.value = firestoreId;
    modalDisplayOrderIdSpan_CustPage.textContent = 'Loading...';
    modalCustomerNameSpan_CustPage.textContent = 'Loading...';
    modalCustomerWhatsAppSpan_CustPage.textContent = '';
    modalProductListContainer_CustPage.innerHTML = '<p>Loading...</p>';
    modalStatusHistoryListContainer_CustPage.innerHTML = '<p>Loading history...</p>';
    modalOrderStatusSelect_CustPage.value = ''; // Reset dropdown
    // Disable buttons initially
    modalUpdateStatusBtn_CustPage.disabled = true;
    modalDeleteBtn_CustPage.disabled = true;
    modalEditFullBtn_CustPage.disabled = true;
    // Show modal
    detailsModal_CustPage.classList.add('active');
    try {
        const orderRef = doc(db, "orders", firestoreId);
        const orderSnap = await getDoc(orderRef);
        if (orderSnap.exists()) {
            const orderData = { id: orderSnap.id, ...orderSnap.data() };
            console.log("V2.5.0: Fetched order data for modal:", orderData);
            populateOrderModal_CustPage(orderData); // Populate fields
            // Enable buttons after loading
            modalUpdateStatusBtn_CustPage.disabled = false;
            modalDeleteBtn_CustPage.disabled = false;
            modalEditFullBtn_CustPage.disabled = false;
        } else {
            alert("Order details not found.");
            closeDetailsModal_CustPage();
        }
    } catch (error) {
        console.error("V2.5.0: Error loading order details for modal:", error);
        alert(`Error loading order details: ${error.message}`);
        closeDetailsModal_CustPage();
    }
}

function populateOrderModal_CustPage(orderData) {
    // ... (existing code - no changes needed here)
    if (!orderData) return;

    // Populate basic info
    modalDisplayOrderIdSpan_CustPage.textContent = orderData.orderId || orderData.customOrderId || `(Sys: ${orderData.id.substring(0, 6)}...)`;
    modalCustomerNameSpan_CustPage.textContent = currentCustomerData?.fullName || orderData.customerDetails?.fullName || 'N/A'; // Use cached customer data if available
    modalCustomerWhatsAppSpan_CustPage.textContent = currentCustomerData?.whatsappNo || orderData.customerDetails?.whatsappNo || 'N/A';
    modalOrderStatusSelect_CustPage.value = orderData.status || orderData.currentStatus || ''; // Set current status in dropdown

    // Populate Product List
    modalProductListContainer_CustPage.innerHTML = ''; // Clear previous
    // Use order.items if available (newer format), fallback to order.products
    const products = (Array.isArray(orderData.items) && orderData.items.length > 0) ? orderData.items : orderData.products;

    if (Array.isArray(products) && products.length > 0) {
        const ul = document.createElement('ul');
        ul.style.cssText = 'list-style:none; padding:0; margin:0;';
        products.forEach(p => {
            const li = document.createElement('li');
            li.style.cssText = 'margin-bottom:5px; padding-bottom:5px; border-bottom:1px dotted #eee;';
            const nameSpan = document.createElement('span');
            // Check for productName (from 'items') or name (from 'products')
            nameSpan.textContent = p.productName || p.name || 'Unnamed Product';
            nameSpan.style.fontWeight = '600';
            const qtySpan = document.createElement('span');
            qtySpan.textContent = ` - Qty: ${p.quantity || '?'}`;
            qtySpan.style.cssText = 'font-size:0.9em; color:#555;';
            li.append(nameSpan, qtySpan); // Append both spans
            ul.appendChild(li);
        });
        if (ul.lastChild) ul.lastChild.style.borderBottom = 'none'; // Remove border from last item
        modalProductListContainer_CustPage.appendChild(ul);
    } else {
        modalProductListContainer_CustPage.innerHTML = '<p class="no-products" style="font-style:italic; color:#777;">No products listed for this order.</p>';
    }


    // Populate Status History
    modalStatusHistoryListContainer_CustPage.innerHTML = ''; // Clear previous
    const history = orderData.statusHistory;
    if (Array.isArray(history) && history.length > 0) {
        // Sort history newest first
        const sortedHistory = [...history].sort((a, b) =>
            (b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0) -
            (a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0)
        );
        const ul = document.createElement('ul');
        ul.style.cssText = 'list-style:none; padding:0; margin:0; max-height:150px; overflow-y:auto;'; // Scrollable history
        sortedHistory.forEach(entry => {
            const li = document.createElement('li');
            li.style.cssText = 'display:flex; justify-content:space-between; font-size:0.9em; padding:3px 0; border-bottom:1px dotted #eee;';
            const statusSpan = document.createElement('span');
            statusSpan.className = 'history-status';
            statusSpan.textContent = entry.status || '?';
            statusSpan.style.fontWeight = '500';
            const timeSpan = document.createElement('span');
            timeSpan.className = 'history-time';
            timeSpan.textContent = entry.timestamp?.toDate ? formatDateTime(entry.timestamp.toDate()) : '?';
            li.append(statusSpan, timeSpan);
            ul.appendChild(li);
        });
        if (ul.lastChild) ul.lastChild.style.borderBottom = 'none';
        modalStatusHistoryListContainer_CustPage.appendChild(ul);
    } else {
        modalStatusHistoryListContainer_CustPage.innerHTML = '<p class="no-history" style="font-style:italic; color:#777;">No status history available.</p>';
    }
}

function closeDetailsModal_CustPage() { if (detailsModal_CustPage) { detailsModal_CustPage.classList.remove('active'); } }

async function handleUpdateStatus_CustPage() {
    // ... (existing code - only change is refresh at the end)
    const firestoreId = modalOrderIdInput_CustPage.value;
    const newStatus = modalOrderStatusSelect_CustPage.value;
    if (!firestoreId || !newStatus || !updateDoc || !doc || !Timestamp || !arrayUnion) {
        alert("Error: Cannot update status. Missing required info or DB functions.");
        return;
    }

    const button = modalUpdateStatusBtn_CustPage;
    button.disabled = true;
    const originalHTML = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

    const historyEntry = {
        status: newStatus,
        timestamp: Timestamp.now()
    };

    try {
        await updateDoc(doc(db, "orders", firestoreId), {
            status: newStatus,
            currentStatus: newStatus, // Keep both fields updated if used elsewhere
            updatedAt: historyEntry.timestamp, // Update main timestamp
            statusHistory: arrayUnion(historyEntry) // Add to history array
        });
        console.log("V2.5.0: Status updated successfully for order:", firestoreId);
        alert("Order status updated!");

        // Refresh modal content and main page data
        const orderSnap = await getDoc(doc(db, "orders", firestoreId));
        if (orderSnap.exists()) {
            populateOrderModal_CustPage({ id: orderSnap.id, ...orderSnap.data() });
        }
         await refreshAccountData(); // <<< Refresh all account data

    } catch (e) {
        console.error("V2.5.0: Error updating status:", e);
        alert("Error updating status: " + e.message);
    } finally {
        button.disabled = false;
        button.innerHTML = originalHTML;
    }
}

async function handleDeleteFromModal_CustPage() {
    // ... (existing code - only change is refresh call)
    const firestoreId = modalOrderIdInput_CustPage.value;
    const displayId = modalDisplayOrderIdSpan_CustPage.textContent || `Order ID: ${firestoreId}`; // Get display ID for confirmation
    if (!firestoreId) return;

    if (confirm(`Are you sure you want to delete this order?\nOrder: ${displayId}\n\nThis action cannot be undone.`)) {
        closeDetailsModal_CustPage(); // Close modal before deleting
        await deleteSingleOrder_CustPage(firestoreId); // Call delete function
    } else {
        console.log("V2.5.0: Order deletion cancelled by user.");
    }
}

async function deleteSingleOrder_CustPage(firestoreId) {
     // ... (existing code - only change is refresh call)
    if (!db || !doc || !deleteDoc) { alert("Delete function is unavailable."); return; }
    console.log(`V2.5.0: Attempting to delete order: ${firestoreId}`);
    try {
        await deleteDoc(doc(db, "orders", firestoreId));
        console.log("V2.5.0: Order deleted successfully:", firestoreId);
        alert("Order deleted successfully.");

        // Refresh data after deleting the order
        await refreshAccountData(); // <<< Refresh all account data

    } catch (e) {
        console.error("V2.5.0: Error deleting order:", e);
        alert("Error deleting order: " + e.message);
    }
}

function handleEditFullFromModal_CustPage() {
    // ... (existing code - no changes needed here)
     const firestoreId = modalOrderIdInput_CustPage.value;
    if (firestoreId) {
        console.log(`V2.5.0: Redirecting to edit order form for: ${firestoreId}`);
        // Redirect to the new_order page with the order ID to edit
        window.location.href = `new_order.html?editOrderId=${firestoreId}`;
    } else {
        alert("Cannot edit order: Order ID is missing.");
    }
}

// --- Add Payment Modal Functions ---
function openAddPaymentModal() {
    // ... (existing code - no changes needed here)
     if(!addPaymentModal || !currentCustomerData){ alert("Cannot open add payment modal. Customer data missing."); return; }
    console.log("V2.5.0: Opening Add Payment modal.");
    addPaymentForm.reset(); // Clear the form
    if(paymentModalCustNameSpan){ paymentModalCustNameSpan.textContent = currentCustomerData.fullName || ''; }
    if(paymentDateInput){ paymentDateInput.valueAsDate = new Date(); } // Default to today
    savePaymentBtn.disabled = false;
    savePaymentBtn.innerHTML = '<i class="fas fa-save"></i> Save Payment'; // Reset button text
    addPaymentModal.classList.add('active');
}

function closeAddPaymentModal() { if (addPaymentModal) addPaymentModal.classList.remove('active'); }

/**
 * Saves a new payment and refreshes relevant page sections. (MODIFIED in V2.5.0)
 * Calls refreshAccountData after saving.
 */
async function handleSavePayment(event) {
    event.preventDefault();
    if (!addDoc || !collection || !Timestamp || !currentCustomerId) {
        alert("DB function missing or Customer ID missing."); return;
    }
    const amount = parseFloat(paymentAmountInput.value);
    const date = paymentDateInput.value;
    const method = paymentMethodSelect.value;
    const notes = paymentNotesInput.value.trim();
    if (isNaN(amount) || amount <= 0) { alert("Please enter a valid positive amount."); return; }
    if (!date) { alert("Please select a payment date."); return; }

    savePaymentBtn.disabled = true;
    const originalHTML = savePaymentBtn.innerHTML;
    savePaymentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const paymentDateTimestamp = Timestamp.fromDate(new Date(date + 'T00:00:00'));
        const paymentData = {
            customerId: currentCustomerId,
            amountPaid: amount,
            paymentDate: paymentDateTimestamp,
            paymentMethod: method,
            notes: notes || null,
            createdAt: Timestamp.now()
        };
        const docRef = await addDoc(collection(db, "payments"), paymentData);
        console.log("V2.5.0: Payment added successfully:", docRef.id);
        alert("Payment added successfully!");
        closeAddPaymentModal();

        // Refresh data after saving
        await refreshAccountData(); // <<< Refresh all account data

    } catch (error) {
        console.error("V2.5.0: Error saving payment:", error);
        alert(`Error saving payment: ${error.message}`);
    } finally {
        savePaymentBtn.disabled = false;
        savePaymentBtn.innerHTML = originalHTML;
    }
}


// --- <<< NEW Add Adjustment Modal Functions >>> ---
function openAddAdjustmentModal() {
    if(!addAdjustmentModal || !currentCustomerData){ alert("Cannot open add adjustment modal. Customer data missing."); return; }
    console.log("V2.5.0: Opening Add Adjustment modal.");
    addAdjustmentForm.reset(); // Clear the form
    if(adjustmentModalCustNameSpan){ adjustmentModalCustNameSpan.textContent = currentCustomerData.fullName || ''; }
    if(adjustmentDateInput){ adjustmentDateInput.valueAsDate = new Date(); } // Default to today
    if(adjustmentTypeDebitRadio) adjustmentTypeDebitRadio.checked = true; // Default to Debit
    saveAdjustmentBtn.disabled = false;
    saveAdjustmentBtn.innerHTML = '<i class="fas fa-save"></i> Save Adjustment'; // Reset button text
    addAdjustmentModal.classList.add('active');
}

function closeAddAdjustmentModal() { if (addAdjustmentModal) addAdjustmentModal.classList.remove('active'); }

async function handleSaveAdjustment(event) {
    event.preventDefault();
    if (!addDoc || !collection || !Timestamp || !currentCustomerId) {
        alert("DB function missing or Customer ID missing for adjustment."); return;
    }
    const amount = parseFloat(adjustmentAmountInput.value);
    const date = adjustmentDateInput.value;
    const type = adjustmentTypeDebitRadio.checked ? 'debit' : (adjustmentTypeCreditRadio.checked ? 'credit' : null);
    const remarks = adjustmentRemarksInput.value.trim();

    if (!type) { alert("Please select adjustment type (Debit or Credit)."); return; }
    if (isNaN(amount) || amount <= 0) { alert("Please enter a valid positive adjustment amount."); return; }
    if (!date) { alert("Please select an adjustment date."); return; }

    saveAdjustmentBtn.disabled = true;
    const originalHTML = saveAdjustmentBtn.innerHTML;
    saveAdjustmentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const adjustmentDateTimestamp = Timestamp.fromDate(new Date(date + 'T00:00:00'));
        const adjustmentData = {
            customerId: currentCustomerId,
            amount: amount,
            adjustmentType: type,
            adjustmentDate: adjustmentDateTimestamp,
            remarks: remarks || null,
            createdAt: Timestamp.now()
        };
        const docRef = await addDoc(collection(db, "accountAdjustments"), adjustmentData);
        console.log("V2.5.0: Adjustment added successfully:", docRef.id);
        alert("Account adjustment added successfully!");
        closeAddAdjustmentModal();

        // Refresh data after saving
        await refreshAccountData(); // <<< Refresh all account data

    } catch (error) {
        console.error("V2.5.0: Error saving adjustment:", error);
        alert(`Error saving adjustment: ${error.message}`);
    } finally {
        saveAdjustmentBtn.disabled = false;
        saveAdjustmentBtn.innerHTML = originalHTML;
    }
}
// --- <<< END Add Adjustment Modal Functions >>> ---


// --- Edit Customer Modal Functions --- (No changes needed for ledger/adjustment)
function openEditCustomerModal_CustPage() {
    // ... (existing code - no changes needed here)
    if(!customerEditModal || !customerEditForm || !currentCustomerData || !currentCustomerId){
        alert("Cannot open edit customer modal. Data missing."); return;
    }
    console.log("V2.5.0: Opening Edit Customer modal.");
    // Set modal title
    customerEditModalTitle.innerHTML = `<i class="fas fa-user-edit info-icon"></i> Edit Customer: ${currentCustomerData.fullName || ''}`;
    // Populate form fields
    editCustPageCustomerIdInput.value = currentCustomerId;
    customerEditFullNameInput.value = currentCustomerData.fullName || '';
    customerEditWhatsAppInput.value = currentCustomerData.whatsappNo || '';
    customerEditContactInput.value = currentCustomerData.contactNo || '';
    customerEditAddressInput.value = currentCustomerData.billingAddress || currentCustomerData.address || ''; // Prefer billingAddress
    customerEditEmailInput.value = currentCustomerData.email || '';
    customerEditCityInput.value = currentCustomerData.city || '';
    customerEditStateInput.value = currentCustomerData.state || '';
    customerEditNotesInput.value = currentCustomerData.notes || '';
    // Handle Credit options
    const isCreditAllowed = currentCustomerData.creditAllowed === true;
    creditEditYesRadio.checked = isCreditAllowed;
    creditEditNoRadio.checked = !isCreditAllowed;
    customerEditCreditLimitInput.value = currentCustomerData.creditLimit || '';
    creditLimitEditGroup.style.display = isCreditAllowed ? 'block' : 'none'; // Show/hide limit input
    // Reset button state
    saveCustomerEditBtn.disabled = false;
    saveCustomerEditBtn.querySelector('span').textContent = 'Update Customer';
    // Show modal
    customerEditModal.classList.add('active');
}

function closeEditCustomerModal_CustPage() { if (customerEditModal) customerEditModal.classList.remove('active'); }

async function handleUpdateCustomer_CustPage(event) {
     // ... (existing code - only change is refresh call *if* name changes)
    event.preventDefault();
    if (!updateDoc || !doc || !Timestamp) { alert("DB function missing (update customer)"); return; }
    const customerIdToUpdate = editCustPageCustomerIdInput.value;
    if (!customerIdToUpdate) { alert("Customer ID missing. Cannot update."); return; }

    // Get form values
    const fullName = customerEditFullNameInput.value.trim();
    const whatsappNo = customerEditWhatsAppInput.value.trim();
    if (!fullName || !whatsappNo) { alert("Full Name and WhatsApp Number are required."); return; }

    const contactNo = customerEditContactInput.value.trim() || null;
    const address = customerEditAddressInput.value.trim() || null; // Use billingAddress field
    const email = customerEditEmailInput.value.trim() || null;
    const city = customerEditCityInput.value.trim() || null;
    const state = customerEditStateInput.value.trim() || null;
    const notes = customerEditNotesInput.value.trim() || null;
    const creditAllowed = creditEditYesRadio.checked;
    const creditLimit = creditAllowed ? (parseFloat(customerEditCreditLimitInput.value) || 0) : null; // Store 0 if empty but allowed

    const button = saveCustomerEditBtn;
    button.disabled = true;
    const originalHTML = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

    // Prepare update data object, removing null/undefined fields
    const updateData = {
        fullName, whatsappNo, contactNo, billingAddress: address, email, city, state, notes, creditAllowed, creditLimit,
        updatedAt: Timestamp.now()
    };
    Object.keys(updateData).forEach(key => (updateData[key] === null || updateData[key] === undefined) && delete updateData[key]);
    // Ensure creditLimit is explicitly null if creditAllowed is false
    if (!creditAllowed) updateData.creditLimit = null;

    try {
        const customerRef = doc(db, "customers", customerIdToUpdate);
        await updateDoc(customerRef, updateData);
        console.log("V2.5.0: Customer details updated successfully.");
        alert("Customer details updated successfully!");
        closeEditCustomerModal_CustPage();

        // Reload customer details on the page to reflect changes
        // This will also trigger summary/ledger updates if necessary fields changed
        await initializePageDataLoading(); // Use the main loading function

    } catch (error) {
        console.error("V2.5.0: Error updating customer:", error);
        alert(`Error updating customer: ${error.message}`);
    } finally {
        button.disabled = false;
        button.innerHTML = originalHTML;
    }
}

// --- Delete Payment Logic --- (No longer directly used if ledger is primary view)
/**
 * Deletes a payment record and refreshes relevant sections. (MODIFIED in V2.5.0)
 * Calls refreshAccountData after deleting.
 */
async function handleDeletePayment_CustPage(paymentId) {
     // This function might still be called if delete buttons are added elsewhere
     // (e.g., back to the ledger or a separate payment history)
    if (!deleteDoc || !doc) { alert("DB function missing (delete payment)"); return; }
    if (!paymentId) { console.warn("V2.5.0: Delete payment called without ID."); return; }

    if (confirm(`Are you sure you want to permanently delete this payment record?\n\nThis action cannot be undone.`)) {
        console.log(`V2.5.0: User confirmed deletion for payment ${paymentId}. Proceeding...`);
        try {
            await deleteDoc(doc(db, "payments", paymentId));
            console.log("V2.5.0: Payment deleted successfully from Firestore.");
            alert("Payment record deleted.");

            // Refresh data after deleting
             await refreshAccountData(); // <<< Refresh all account data

        } catch (error) {
            console.error(`V2.5.0: Error deleting payment ${paymentId}:`, error);
            alert(`Failed to delete payment record: ${error.message}`);
        }
    } else {
        console.log("V2.5.0: Payment deletion cancelled by user.");
    }
}


// --- Confirmation Modal Logic (Toggle Status, Delete Customer) --- (No changes needed for ledger/adjustment)
function handleToggleAccountStatus() {
    // ... (existing code)
     if(!currentCustomerId || !currentCustomerData){ alert("Customer data not loaded. Cannot toggle status."); return; }
    const currentStatus = currentCustomerData.status || 'active';
    const isDisabling = currentStatus === 'active';
    const actionText = isDisabling ? 'disable' : 'enable';
    const newStatus = isDisabling ? 'inactive' : 'active';
    openConfirmToggleModal(actionText, newStatus);
}

function openConfirmToggleModal(action, newStatus) {
    // ... (existing code)
     if(!confirmToggleStatusModal || !toggleActionTextSpan || !toggleCustNameSpan || !confirmToggleCheckbox || !confirmToggleBtn || !toggleWarningMessage || !toggleCheckboxLabel || !confirmToggleBtnText){
        console.error("Toggle confirm modal elements missing!"); return;
    }
    console.log(`V2.5.0: Opening confirm toggle modal. Action: ${action}, New Status: ${newStatus}`);
    // Populate modal text
    toggleActionTextSpan.textContent = action;
    toggleCustNameSpan.textContent = currentCustomerData?.fullName || 'this customer';
    toggleWarningMessage.style.display = (action === 'disable') ? 'block' : 'none'; // Show warning only when disabling
    toggleCheckboxLabel.textContent = `I understand and want to ${action} this account.`;
    confirmToggleBtnText.textContent = action.charAt(0).toUpperCase() + action.slice(1) + ' Account';
    // Set button style and icon
    const icon = confirmToggleBtn.querySelector('i');
    confirmToggleBtn.className = `button ${action === 'disable' ? 'secondary-button' : 'success-button'}`; // Warning/Secondary for disable, Success for enable
    if (icon) icon.className = `fas ${action === 'disable' ? 'fa-toggle-off' : 'fa-toggle-on'}`;
    // Reset checkbox and button state
    confirmToggleCheckbox.checked = false;
    confirmToggleBtn.disabled = true;
    confirmToggleBtn.dataset.newStatus = newStatus; // Store new status on button
    // Show modal
    confirmToggleStatusModal.classList.add('active');
}

function closeConfirmToggleModal() { if (confirmToggleStatusModal) confirmToggleStatusModal.classList.remove('active');}

async function executeToggleStatus(newStatus) {
    // ... (existing code - reload details at end is sufficient)
     if(!updateDoc || !doc || !Timestamp || !currentCustomerId){ alert("DB function missing (toggle status)"); return; }

    const button = confirmToggleBtn;
    button.disabled = true;
    const originalHTML = button.innerHTML;
    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;

    try {
        const customerRef = doc(db, "customers", currentCustomerId);
        await updateDoc(customerRef, {
            status: newStatus,
            updatedAt: Timestamp.now()
        });
        console.log(`V2.5.0: Customer status successfully changed to ${newStatus}.`);
        alert(`Customer account status changed to ${newStatus}.`);
        closeConfirmToggleModal();
        // Reload customer details to update status badge and button text on page
        await loadCustomerDetails(currentCustomerId); // Reload only basic details
    } catch (error) {
        console.error("V2.5.0: Error toggling account status:", error);
        alert(`Error changing status: ${error.message}`);
    } finally {
        button.disabled = false;
        button.innerHTML = originalHTML;
    }
}

function handleDeleteCustomer_CustPage() {
    // ... (existing code)
     if(!currentCustomerId || !currentCustomerData){ alert("Customer data not loaded. Cannot delete."); return; }
    openConfirmDeleteModal(); // Open the confirmation modal
}

function openConfirmDeleteModal() {
    // ... (existing code)
    if(!confirmDeleteModal || !deleteCustNameSpan || !confirmDeleteCheckboxModal || !confirmDeleteBtn){
        console.error("Delete confirm modal elements missing!"); return;
    }
    console.log("V2.5.0: Opening delete confirmation modal.");
    deleteCustNameSpan.textContent = currentCustomerData?.fullName || 'this customer';
    confirmDeleteCheckboxModal.checked = false; // Reset checkbox
    confirmDeleteBtn.disabled = true; // Disable button initially
    confirmDeleteModal.classList.add('active');
}

function closeConfirmDeleteModal() { if (confirmDeleteModal) confirmDeleteModal.classList.remove('active');}

async function executeDeleteCustomer() {
    // ... (existing code)
    if(!deleteDoc || !doc || !currentCustomerId){ alert("DB function missing (delete customer)"); return; }
    const customerName = currentCustomerData?.fullName || `ID: ${currentCustomerId}`;
    console.log(`V2.5.0: Executing permanent deletion for customer ${currentCustomerId}`);

    const button = confirmDeleteBtn;
    button.disabled = true;
    const originalHTML = button.innerHTML;
    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Deleting...`;

    try {
        // Consider related data deletion strategy (orders, payments, adjustments)
        // For now, only deletes the customer document.
        await deleteDoc(doc(db, "customers", currentCustomerId));
        console.log("V2.5.0: Customer deleted successfully from Firestore.");
        alert(`Customer "${customerName}" has been permanently deleted.`);
        closeConfirmDeleteModal();
        // Redirect back to the customer list page after deletion
        window.location.href = 'customer_management.html';
    } catch (error) {
        console.error("V2.5.0: Error deleting customer:", error);
        alert(`Error deleting customer: ${error.message}`);
        // Re-enable button on error
        button.disabled = false;
        button.innerHTML = originalHTML;
    }
}

/** Displays an error message to the user and console */
function displayError(message) {
    console.error("V2.5.0: ERROR - ", message);
    alert(message); // Simple alert for now
    // Optionally update UI elements to show error state
    const nameHeaderEl=document.getElementById('cust-detail-name-header');
    const nameBreadcrumbEl=document.getElementById('cust-detail-name-breadcrumb');
    if(nameHeaderEl) nameHeaderEl.textContent="Error";
    if(nameBreadcrumbEl) nameBreadcrumbEl.textContent="Error";
    document.title="Error Loading Customer";
}

/** Sets up ALL static event listeners for the page */
function setupStaticEventListeners() {
    console.log("V2.5.0: Setting up static event listeners...");

    // Order Details Modal Listeners
    if(closeModalBtn_CustPage) closeModalBtn_CustPage.addEventListener('click', closeDetailsModal_CustPage);
    if(detailsModal_CustPage) detailsModal_CustPage.addEventListener('click', (event) => { if(event.target === detailsModal_CustPage) closeDetailsModal_CustPage(); });
    if(modalUpdateStatusBtn_CustPage) modalUpdateStatusBtn_CustPage.addEventListener('click', handleUpdateStatus_CustPage);
    if(modalDeleteBtn_CustPage) modalDeleteBtn_CustPage.addEventListener('click', handleDeleteFromModal_CustPage);
    if(modalEditFullBtn_CustPage) modalEditFullBtn_CustPage.addEventListener('click', handleEditFullFromModal_CustPage);

    // Add Payment Modal Listeners
    if(addPaymentBtn) addPaymentBtn.addEventListener('click', openAddPaymentModal);
    if(closePaymentModalBtn) closePaymentModalBtn.addEventListener('click', closeAddPaymentModal);
    if(cancelPaymentBtn) cancelPaymentBtn.addEventListener('click', closeAddPaymentModal);
    if(addPaymentModal) addPaymentModal.addEventListener('click', (event) => { if(event.target === addPaymentModal) closeAddPaymentModal(); });
    if(addPaymentForm) addPaymentForm.addEventListener('submit', handleSavePayment);

    // <<< Add Adjustment Modal Listeners >>>
    if(addAdjustmentBtn) addAdjustmentBtn.addEventListener('click', openAddAdjustmentModal);
    if(closeAdjustmentModalBtn) closeAdjustmentModalBtn.addEventListener('click', closeAddAdjustmentModal);
    if(cancelAdjustmentBtn) cancelAdjustmentBtn.addEventListener('click', closeAddAdjustmentModal);
    if(addAdjustmentModal) addAdjustmentModal.addEventListener('click', (event) => { if(event.target === addAdjustmentModal) closeAddAdjustmentModal(); });
    if(addAdjustmentForm) addAdjustmentForm.addEventListener('submit', handleSaveAdjustment);
    // <<< End Adjustment Listeners >>>

    // Edit Customer Modal Listeners
    if(editCustomerBtn) editCustomerBtn.addEventListener('click', openEditCustomerModal_CustPage);
    if(closeCustomerEditModalBtn) closeCustomerEditModalBtn.addEventListener('click', closeEditCustomerModal_CustPage);
    if(cancelCustomerEditBtn) cancelCustomerEditBtn.addEventListener('click', closeEditCustomerModal_CustPage);
    if(customerEditModal) customerEditModal.addEventListener('click', (event) => { if(event.target === customerEditModal) closeEditCustomerModal_CustPage(); });
    if(customerEditForm) customerEditForm.addEventListener('submit', handleUpdateCustomer_CustPage);
    // Listener for credit allowed radio buttons to toggle limit input visibility
    if(creditEditYesRadio && creditEditNoRadio && creditLimitEditGroup){
        const toggleCreditLimitField = () => { creditLimitEditGroup.style.display = creditEditYesRadio.checked ? 'block' : 'none'; };
        creditEditYesRadio.addEventListener('change', toggleCreditLimitField);
        creditEditNoRadio.addEventListener('change', toggleCreditLimitField);
    }

    // Toggle Account Status Listeners
    if(toggleStatusBtn) toggleStatusBtn.addEventListener('click', handleToggleAccountStatus);
    if(closeConfirmToggleModalBtn) closeConfirmToggleModalBtn.addEventListener('click', closeConfirmToggleModal);
    if(cancelToggleBtn) cancelToggleBtn.addEventListener('click', closeConfirmToggleModal);
    if(confirmToggleStatusModal) confirmToggleStatusModal.addEventListener('click', (e) => { if(e.target === confirmToggleStatusModal) closeConfirmToggleModal(); });
    if(confirmToggleCheckbox) confirmToggleCheckbox.addEventListener('change', () => { if(confirmToggleBtn) confirmToggleBtn.disabled = !confirmToggleCheckbox.checked; });
    if(confirmToggleBtn) confirmToggleBtn.addEventListener('click', () => {
        const newStatus = confirmToggleBtn.dataset.newStatus;
        if(confirmToggleCheckbox.checked && newStatus){ executeToggleStatus(newStatus); }
    });

    // Delete Customer Confirmation Listeners
    if(deleteCustomerBtn) deleteCustomerBtn.addEventListener('click', handleDeleteCustomer_CustPage);
    if(closeConfirmDeleteModalBtn) closeConfirmDeleteModalBtn.addEventListener('click', closeConfirmDeleteModal);
    if(cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeConfirmDeleteModal);
    if(confirmDeleteModal) confirmDeleteModal.addEventListener('click', (e) => { if(e.target === confirmDeleteModal) closeConfirmDeleteModal(); });
    if(confirmDeleteCheckboxModal) confirmDeleteCheckboxModal.addEventListener('change', () => { if(confirmDeleteBtn) confirmDeleteBtn.disabled = !confirmDeleteCheckboxModal.checked; });
    if(confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', () => { if(confirmDeleteCheckboxModal.checked){ executeDeleteCustomer(); } });

    console.log("V2.5.0: Static event listeners attached.");
}


/** Helper function to reload all relevant account data and update UI */
async function refreshAccountData() {
    if (!currentCustomerId) {
        console.error("V2.5.0: Cannot refresh data, customer ID missing.");
        return;
    }
    console.log("V2.5.0: Refreshing all account data...");
    try {
        // Reload order history (UI only)
        await loadOrderHistory(currentCustomerId);
        // Reload ledger (UI + recalculates final balance)
        await loadAccountLedger(currentCustomerId);
        // Reload summary (UI + fetches totals)
        await updateAccountSummary(currentCustomerId);
        console.log("V2.5.0: Account data refreshed.");
    } catch (error) {
        console.error("V2.5.0: Error during account data refresh:", error);
        displayError("Failed to refresh account data. Please reload the page.");
    }
}

/** Loads primary data needed for the page display (Details, Summary, Ledger, Orders) */
async function initializePageDataLoading() {
     console.log("V2.5.0: Initializing page data loading...");
     if (!currentCustomerId) {
        console.error("V2.5.0: Cannot initialize data loading, customer ID missing.");
        displayError("Customer ID missing. Cannot load data.");
        return;
     }
     try {
        // Load basic customer details first
        const customerLoaded = await loadCustomerDetails(currentCustomerId);
        if (!customerLoaded) {
            console.error("V2.5.0: Failed to load customer details. Stopping data initialization.");
            // displayError handled within loadCustomerDetails
            return; // Stop if customer details fail
        }

        // Now load dependent data concurrently
        await Promise.all([
            loadOrderHistory(currentCustomerId), // Load order list UI
            loadAccountLedger(currentCustomerId), // Load ledger UI
            updateAccountSummary(currentCustomerId) // Load summary UI (fetches totals inside)
        ]);

        console.log("V2.5.0: Page data loading complete.");

     } catch(error) {
        console.error("V2.5.0: Error during initial page data load:", error);
        displayError(`Error loading account data: ${error.message}`);
     }
}


/** Main function to initialize the customer detail page (MODIFIED in V2.5.0) */
window.initializeCustomerDetailPage = async function(user) {
    console.log("V2.5.0: Initializing customer detail page...");
    currentCustomerId = getCustomerIdFromUrl();
    if (!currentCustomerId) {
        displayError("Customer ID missing from URL. Cannot load page.");
        return;
    }
    console.log(`V2.5.0: Customer ID found: ${currentCustomerId}`);

    // Setup listeners first, regardless of data loading outcome
    setupStaticEventListeners();

    // Load all page data
    await initializePageDataLoading();

    console.log("V2.5.0: Customer detail page initialization sequence finished.");
}

// Log that the script has loaded
console.log("customer_account_detail.js (V2.5.0 - Adjustment & Balance Display) script loaded.");