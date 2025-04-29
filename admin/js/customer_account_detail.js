// js/customer_account_detail.js
// Version: 2.5.1 (Corrected firestoreOrderBy usage + Previous Updates)
// WARNING: This code assumes corresponding changes have been made in customer_account_detail.html
// and potentially in customer_account_detail.css for styling.
// PLEASE TEST THOROUGHLY AFTER IMPLEMENTING.

// --- Firebase Functions ---
// Ensure these are available globally via the script in customer_account_detail.html
const {
    db, doc, getDoc, collection, query, where, getDocs, orderBy: firestoreOrderBy, // <-- Renamed Import
    updateDoc, deleteDoc, Timestamp, arrayUnion, addDoc
} = window;

// --- Global State ---
let currentCustomerId = null;
let currentCustomerData = null;
let currentTotalPaidAmount = 0; // Includes payments AND credit adjustments, excludes debit adjustments

// --- DOM References ---
// Existing References
const editCustomerBtn = document.getElementById('editCustomerBtn');
const addPaymentBtn = document.getElementById('addPaymentBtn');
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
const accountLedgerTableBody = document.getElementById('accountLedgerTableBody'); // Ledger Table

// <<< NEW DOM REF >>>
// Payment History Table
const customerPaymentTableBody = document.getElementById('customerPaymentTableBody'); // Needs ID in HTML

// Adjustment Modal Elements
const addAdjustmentBtn = document.getElementById('addAdjustmentBtn');               // Needs ID in HTML
const addAdjustmentModal = document.getElementById('addAdjustmentModal');         // Needs ID in HTML
const closeAdjustmentModalBtn = document.getElementById('closeAdjustmentModal');   // Needs ID in HTML
const cancelAdjustmentBtn = document.getElementById('cancelAdjustmentBtn');       // Needs ID in HTML
const addAdjustmentForm = document.getElementById('addAdjustmentForm');           // Needs ID in HTML
const adjustmentTypeDebitRadio = document.getElementById('adjustmentTypeDebit');   // Needs ID in HTML
const adjustmentTypeCreditRadio = document.getElementById('adjustmentTypeCredit'); // Needs ID in HTML
const adjustmentDateInput = document.getElementById('adjustmentDateInput');       // Needs ID in HTML
const adjustmentAmountInput = document.getElementById('adjustmentAmountInput');     // Needs ID in HTML
const adjustmentRemarksInput = document.getElementById('adjustmentRemarksInput');   // Needs ID in HTML
const saveAdjustmentBtn = document.getElementById('saveAdjustmentBtn');           // Needs ID in HTML
// <<< NEW DOM REF END >>>


// --- Helper Functions ---
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { unsafe = String(unsafe || ''); } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function formatDate(dateObj) { if (!dateObj || typeof dateObj.toLocaleDateString !== 'function') return 'N/A'; return dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function formatDateTime(dateObj) { if (!dateObj || typeof dateObj.toLocaleDateString !== 'function') return '?'; return dateObj.toLocaleDateString('en-GB',{day:'numeric',month:'short'}) + ' ' + dateObj.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}); }

// <<< MODIFIED HELPER >>> Formats number only
function formatNumber(amount) {
    const num = Number(amount);
    if (isNaN(num)) return 'N/A';
    return Math.abs(num).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
// <<< MODIFIED HELPER END >>>

function displayError(message) {
    console.error("V2.5.1: ERROR - ", message);
    alert(message);
    const nameHeaderEl=document.getElementById('cust-detail-name-header');
    const nameBreadcrumbEl=document.getElementById('cust-detail-name-breadcrumb');
    if(nameHeaderEl) nameHeaderEl.textContent="Error";
    if(nameBreadcrumbEl) nameBreadcrumbEl.textContent="Error";
    document.title="Error Loading Customer";
}

// --- Core Page Logic ---

function getCustomerIdFromUrl() { const params = new URLSearchParams(window.location.search); return params.get('id'); }

// Load Customer Details (No change)
async function loadCustomerDetails(customerId) {
    console.log(`V2.5.1: Loading details for customer: ${customerId}`);
    currentCustomerData = null;
    if (!db || !doc || !getDoc) { displayError("DB function missing (details)."); return false; }
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
    const addAdjustmentBtn = document.getElementById('addAdjustmentBtn');

    if (nameHeaderEl) nameHeaderEl.textContent = "Loading...";
    if (nameBreadcrumbEl) nameBreadcrumbEl.textContent = "Loading...";

    try {
        const customerRef = doc(db, "customers", customerId);
        const customerSnap = await getDoc(customerRef);

        if (customerSnap.exists()) {
            currentCustomerData = customerSnap.data();
            console.log("V2.5.1: Customer data fetched:", currentCustomerData);
            const customerName = currentCustomerData.fullName || 'N/A';

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
                statusEl.className = 'status-badge';
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
            if (creditLimitEl) creditLimitEl.textContent = creditAllowed ? `₹${formatNumber(currentCustomerData.creditLimit)}` : 'N/A';
            if (notesEl) notesEl.textContent = currentCustomerData.notes || 'No remarks.';

            if (editCustomerBtn) editCustomerBtn.disabled = false;
            if (addPaymentBtn) addPaymentBtn.disabled = false;
            if (toggleStatusBtn) toggleStatusBtn.disabled = false;
            if (deleteCustomerBtn) deleteCustomerBtn.disabled = false;
            if (addAdjustmentBtn) addAdjustmentBtn.disabled = false;

            if (addNewOrderLink) {
                addNewOrderLink.href = `new_order.html?customerId=${encodeURIComponent(customerId)}&customerName=${encodeURIComponent(customerName)}`;
                addNewOrderLink.classList.remove('disabled');
            }

            console.log("V2.5.1: Customer details displayed.");
            return true;
        } else {
            displayError("Customer not found.");
            return false;
        }
    } catch (error) {
        console.error("V2.5.1: Error loading customer details:", error);
        displayError(`Error loading details: ${error.message}`);
        return false;
    }
}

// Load Order History (Ensure firestoreOrderBy is used)
async function loadOrderHistory(customerId) {
    console.log(`V2.5.1: Loading order history for customer: ${customerId}`);
    const orderTableBody = document.getElementById('customerOrderTableBody');
    let totalOrderValue = 0;

    if (!orderTableBody) { console.error("V2.5.1: Order table body missing."); return 0; }
    // Check for necessary Firestore functions including the renamed orderBy
    if (!collection || !query || !where || !getDocs || !firestoreOrderBy) { // <<< CHECK HERE
        displayError("DB function missing (orders).");
        orderTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Error loading orders (DB func)</td></tr>`;
        return 0;
    }

    orderTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Loading orders...</td></tr>`;
    const newOrderTableBody = orderTableBody.cloneNode(false);
    orderTableBody.parentNode.replaceChild(newOrderTableBody, orderTableBody);

    try {
        const ordersRef = collection(db, "orders");
        // Use the RENAMED firestoreOrderBy function here
        const q = query(ordersRef, where("customerId", "==", customerId), firestoreOrderBy("createdAt", "desc")); // <<< USE firestoreOrderBy
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            newOrderTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">No orders found.</td></tr>`;
        } else {
            querySnapshot.forEach(doc => {
                // ... (rest of the row creation logic - no changes needed here) ...
                const order = doc.data();
                const firestoreOrderId = doc.id;
                totalOrderValue += Number(order.totalAmount || 0);
                const displayOrderId = order.orderId || order.customOrderId || `(sys) ${firestoreOrderId.substring(0,6)}...`;
                const orderDate = order.createdAt?.toDate ? formatDate(order.createdAt.toDate()) : 'N/A';
                const status = order.status || order.currentStatus || 'Unknown';
                let productsHtml = 'N/A';
                if (order.products && Array.isArray(order.products)) {
                   productsHtml = order.products.map(p => `${escapeHtml(p.name || '?')} (${escapeHtml(p.quantity || '?')})`).join('<br>');
                }
                const row = newOrderTableBody.insertRow();
                row.setAttribute('data-order-id', firestoreOrderId);
                row.classList.add('order-row-clickable');
                row.insertCell().textContent = displayOrderId;
                row.insertCell().textContent = orderDate;
                row.insertCell().innerHTML = productsHtml;
                const cellStatus = row.insertCell();
                const statusBadge = document.createElement('span');
                statusBadge.className = `status-badge status-${status.toLowerCase().replace(/\s+/g, '-')}`;
                statusBadge.textContent = escapeHtml(status);
                cellStatus.appendChild(statusBadge);
            });

             newOrderTableBody.addEventListener('click', (event) => {
                 const clickedRow = event.target.closest('tr.order-row-clickable');
                 if (clickedRow && clickedRow.dataset.orderId) {
                     openOrderDetailsModal_CustPage(clickedRow.dataset.orderId);
                 }
             });
        }
        console.log(`V2.5.1: Order history loaded. Total Order Value: ${totalOrderValue}`);
        return totalOrderValue;
    } catch (error) {
        console.error("V2.5.1: Error loading order history:", error);
         if(error.code === 'failed-precondition' && error.message.includes("index")){
             displayError(`Error loading orders: Index required. Please check Firestore console.`);
         } else{
            displayError(`Error loading orders: ${error.message}`);
         }
        newOrderTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Error loading orders.</td></tr>`;
        return 0;
    }
}

// Load Payment History Calculation (No change needed here)
async function loadPaymentHistory(customerId) {
    console.log(`V2.5.1: Calculating total paid/adjusted amount for customer: ${customerId}`);
    let totalPaidAdjusted = 0;
    if (!collection || !query || !where || !getDocs) {
        displayError("DB function missing (payments calculation).");
        return 0;
    }
    try {
        const paymentsRef = collection(db, "payments");
        const q = query(paymentsRef, where("customerId", "==", customerId));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
             querySnapshot.forEach(doc => {
                totalPaidAdjusted += Number(doc.data().amountPaid || 0);
            });
        } else {
            console.log("V2.5.1: No payments or adjustments found during calculation.");
        }
        console.log(`V2.5.1: Payment/Adjustment calculation complete. Net Paid/Adjusted: ${totalPaidAdjusted}`);
        currentTotalPaidAmount = totalPaidAdjusted;
        return totalPaidAdjusted;
    } catch (error) {
         if(error.code === 'failed-precondition' && error.message.includes("index")){
             displayError(`Error calculating payments: Index required. Please check Firestore console.`);
             console.error("Firestore Index Error:", error.message);
         } else{
             displayError(`Error calculating payments: ${error.message}`);
             console.error("V2.5.1: Error calculating payment history:", error);
         }
        return 0;
    }
}


// <<< MODIFIED FUNCTION >>>
// Updates Account Summary with new balance display logic
function updateAccountSummary(totalOrderValue) {
    console.log(`V2.5.1: Updating account summary. Order Value: ${totalOrderValue}, Paid Amount (Net): ${currentTotalPaidAmount}`);
    const summaryTotalOrdersEl = document.getElementById('summary-total-orders');
    const summaryTotalPaidEl = document.getElementById('summary-total-paid');
    const summaryBalanceEl = document.getElementById('summary-balance');

    if (!summaryTotalOrdersEl || !summaryTotalPaidEl || !summaryBalanceEl) {
        console.error("V2.5.1: Account summary elements missing!");
        return;
    }

    summaryTotalOrdersEl.textContent = `₹${formatNumber(totalOrderValue)}`;
    summaryTotalPaidEl.textContent = `₹${formatNumber(currentTotalPaidAmount)}`; // Show net paid

    const balance = Number(totalOrderValue || 0) - Number(currentTotalPaidAmount || 0);

    // --- Display Outstanding Balance (Due = Red/-, Credit = Green/+) ---
    let displayBalance = balance;
    let balanceClass = 'balance-info'; // Default for zero
    let prefix = '';

    if (balance > 0.001) { // Positive Balance = ग्राहक पर बकाया
        balanceClass = 'balance-due'; // Use due class for RED color
        prefix = '-';
    } else if (balance < -0.001) { // Negative Balance = ग्राहक का क्रेडिट/जमा
        balanceClass = 'balance-credit'; // Use credit class for GREEN color
        prefix = '+';
        displayBalance = Math.abs(balance);
    } else {
         prefix = ''; displayBalance = 0;
    }

    const formattedNumber = formatNumber(Math.abs(displayBalance));
    let finalDisplay = `₹${prefix}${formattedNumber}`;
    if (balanceClass === 'balance-info') { finalDisplay = `₹0.00`; }
    // --- End New Logic ---

    summaryBalanceEl.textContent = finalDisplay;
    summaryBalanceEl.className = '';
    summaryBalanceEl.classList.add(balanceClass);

    console.log("V2.5.1: Account summary updated with new display logic.");
}
// <<< MODIFIED FUNCTION END >>>


// <<< MODIFIED FUNCTION >>>
// Loads Account Ledger - Corrected calculation, new display logic, uses firestoreOrderBy
async function loadAccountLedger(customerId) {
    console.log(`V2.5.1: Loading account ledger for customer: ${customerId}`);
    if (!accountLedgerTableBody) { console.error("V2.5.1: Ledger table body missing."); return; }
    // Check for necessary functions including renamed orderBy
    if (!db || !collection || !query || !where || !getDocs || !firestoreOrderBy || !Timestamp) { // <<< CHECK HERE
        displayError("DB function missing (ledger).");
        accountLedgerTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Error loading ledger (DB func)</td></tr>`;
        return;
    }

    accountLedgerTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Loading ledger...</td></tr>`;
    let transactions = [];

    try {
        // 1. Fetch Orders (Use firestoreOrderBy)
        const ordersRef = collection(db, "orders");
        const orderQuery = query(ordersRef, where("customerId", "==", customerId), firestoreOrderBy("createdAt", "asc")); // <<< USE firestoreOrderBy
        const orderSnapshot = await getDocs(orderQuery);
        orderSnapshot.forEach(doc => {
            const order = doc.data();
            const orderId = order.orderId || order.customOrderId || `Sys: ${doc.id.substring(0,6)}`;
            transactions.push({ date: order.createdAt, type: 'order', description: `Order #${orderId}`, debitAmount: Number(order.totalAmount || 0), creditAmount: 0, docId: doc.id });
        });
        console.log(`V2.5.1: Fetched ${orderSnapshot.size} orders for ledger.`);

        // 2. Fetch Payments (Use firestoreOrderBy)
        const paymentsRef = collection(db, "payments");
        const paymentQuery = query(paymentsRef, where("customerId", "==", customerId), firestoreOrderBy("paymentDate", "asc")); // <<< USE firestoreOrderBy
        const paymentSnapshot = await getDocs(paymentQuery);
        paymentSnapshot.forEach(doc => {
            const payment = doc.data();
            let desc = `Payment Received (${payment.paymentMethod || 'N/A'})`;
            if (payment.isAdjustment === true) { desc = payment.notes || `Adjustment (${payment.paymentMethod})`; }
            let debitLedger = 0; let creditLedger = 0;
            if (payment.amountPaid < 0) { debitLedger = Math.abs(payment.amountPaid); }
            else { creditLedger = payment.amountPaid; }
            transactions.push({ date: payment.paymentDate, type: payment.isAdjustment ? 'adjustment' : 'payment', description: desc, debitAmount: debitLedger, creditAmount: creditLedger, docId: doc.id });
        });
        console.log(`V2.5.1: Fetched ${paymentSnapshot.size} payments/adjustments for ledger.`);

        // 3. Sort Transactions
        transactions.sort((a, b) => {
            const dateA = a.date?.toDate ? a.date.toDate().getTime() : 0;
            const dateB = b.date?.toDate ? b.date.toDate().getTime() : 0;
            if (dateA === dateB) { if (a.type === 'order' && b.type !== 'order') return -1; if (a.type !== 'order' && b.type === 'order') return 1; }
            return dateA - dateB;
        });
        console.log(`V2.5.1: Sorted ${transactions.length} total transactions.`);

        // 4. Render Ledger Table
        accountLedgerTableBody.innerHTML = '';
        let runningBalance = 0; // Positive = Due

        if (transactions.length === 0) {
            accountLedgerTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No transactions found.</td></tr>`;
        } else {
            transactions.forEach(tx => {
                // --- Correct Running Balance Calculation (Positive = Due) ---
                 runningBalance = runningBalance + (tx.debitAmount || 0) - (tx.creditAmount || 0);
                // --- End Correction ---

                const row = accountLedgerTableBody.insertRow();
                row.insertCell().textContent = tx.date?.toDate ? formatDate(tx.date.toDate()) : 'N/A';
                row.insertCell().textContent = escapeHtml(tx.description);
                const cellDebit = row.insertCell();
                cellDebit.textContent = tx.debitAmount > 0 ? `₹${formatNumber(tx.debitAmount)}` : '-';
                cellDebit.style.textAlign = 'right';
                const cellCredit = row.insertCell();
                cellCredit.textContent = tx.creditAmount > 0 ? `₹${formatNumber(tx.creditAmount)}` : '-';
                cellCredit.style.textAlign = 'right';
                const cellBalance = row.insertCell();
                cellBalance.style.textAlign = 'right';

                // --- Apply New Display Logic to Running Balance (Due = Red/-, Credit = Green/+) ---
                let displayBalance = runningBalance;
                let balanceClass = 'ledger-balance-zero';
                let prefix = '';

                if (runningBalance > 0.001) {
                    balanceClass = 'ledger-balance-negative'; // Use negative class for RED
                    prefix = '-';
                } else if (runningBalance < -0.001) {
                    balanceClass = 'ledger-balance-positive'; // Use positive class for GREEN
                    prefix = '+';
                    displayBalance = Math.abs(runningBalance);
                } else {
                    prefix = ''; displayBalance = 0;
                }

                const formattedNumber = formatNumber(Math.abs(displayBalance));
                let finalDisplay = `₹${prefix}${formattedNumber}`;
                if (balanceClass === 'ledger-balance-zero') { finalDisplay = `₹0.00`; }
                // --- End New Display Logic ---

                cellBalance.innerHTML = `<span class="${balanceClass}">${finalDisplay}</span>`;
            });
        }
        console.log(`V2.5.1: Ledger rendered. Final balance (internal): ${runningBalance}`);

    } catch (error) {
        console.error("V2.5.1: Error loading account ledger:", error);
         if(error.code === 'failed-precondition' && error.message.includes("index")){
             displayError(`Error loading ledger: Index required. Please check Firestore console.`);
             console.error("Firestore Index Error:", error.message);
         } else{
            displayError(`Error loading ledger: ${error.message}`);
         }
        accountLedgerTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Error loading ledger.</td></tr>`;
    }
}
// <<< MODIFIED FUNCTION END >>>


// --- Order Details Modal Functions --- (No change)
async function openOrderDetailsModal_CustPage(firestoreId) { /* ... existing code ... */ }
function populateOrderModal_CustPage(orderData) { /* ... existing code ... */ }
function closeDetailsModal_CustPage() { /* ... existing code ... */ }
async function handleUpdateStatus_CustPage() { /* ... existing code ... */ }
async function handleDeleteFromModal_CustPage() { /* ... existing code ... */ }
async function deleteSingleOrder_CustPage(firestoreId) { /* ... existing code ... */ }
function handleEditFullFromModal_CustPage() { /* ... existing code ... */ }

// --- Add Payment Modal Functions --- (Refreshes Payment Table)
function openAddPaymentModal() { /* ... existing code ... */ }
function closeAddPaymentModal() { /* ... existing code ... */ }
async function handleSavePayment(event) {
    event.preventDefault();
    if (!addDoc || !collection || !Timestamp || !currentCustomerId) { alert("DB function missing or Customer ID missing."); return; }
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
        const paymentData = { customerId: currentCustomerId, amountPaid: amount, paymentDate: paymentDateTimestamp, paymentMethod: method, notes: notes || null, createdAt: Timestamp.now(), isAdjustment: false };
        const docRef = await addDoc(collection(db, "payments"), paymentData);
        console.log("V2.5.1: Payment added successfully:", docRef.id);
        alert("Payment added successfully!");
        closeAddPaymentModal();
        // Refresh data
        console.log("V2.5.1: Refreshing data after payment save...");
        currentTotalPaidAmount = await loadPaymentHistory(currentCustomerId);
        const currentOrderTotal = await loadOrderHistory(currentCustomerId);
        updateAccountSummary(currentOrderTotal);
        await loadAccountLedger(currentCustomerId);
        await loadPaymentHistoryTable(currentCustomerId); // <<< Refresh payment table
        console.log("V2.5.1: Data refreshed.");
    } catch (error) { console.error("V2.5.1: Error saving payment:", error); alert(`Error saving payment: ${error.message}`);
    } finally { savePaymentBtn.disabled = false; savePaymentBtn.innerHTML = originalHTML; }
}

// --- Edit Customer Modal Functions --- (No change)
function openEditCustomerModal_CustPage() { /* ... existing code ... */ }
function closeEditCustomerModal_CustPage() { /* ... existing code ... */ }
async function handleUpdateCustomer_CustPage(event) { /* ... existing code ... */ }

// --- Confirmation Modal Logic (Toggle/Delete Customer) --- (No change)
function handleToggleAccountStatus() { /* ... existing code ... */ }
function openConfirmToggleModal(action, newStatus) { /* ... existing code ... */ }
function closeConfirmToggleModal() { /* ... existing code ... */}
async function executeToggleStatus(newStatus) { /* ... existing code ... */ }
function handleDeleteCustomer_CustPage() { /* ... existing code ... */ }
function openConfirmDeleteModal() { /* ... existing code ... */ }
function closeConfirmDeleteModal() { /* ... existing code ... */}
async function executeDeleteCustomer() { /* ... existing code ... */ }


// <<< NEW FUNCTION >>> - Loads Payment History Table (Uses firestoreOrderBy)
async function loadPaymentHistoryTable(customerId) {
    console.log(`V2.5.1: Loading payment history table for customer: ${customerId}`);
    if (!customerPaymentTableBody) { console.log("V2.5.1: Payment history table body not found. Skipping."); return; }
    // Check for necessary functions including renamed orderBy
    if (!collection || !query || !where || !getDocs || !firestoreOrderBy) { // <<< CHECK HERE
        displayError("DB function missing (payments table).");
        customerPaymentTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Error loading payments (DB func)</td></tr>`;
        return;
    }
    customerPaymentTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Loading payments...</td></tr>`;
    const newPaymentTableBody = customerPaymentTableBody.cloneNode(false);
    customerPaymentTableBody.parentNode.replaceChild(newPaymentTableBody, customerPaymentTableBody);
    try {
        const paymentsRef = collection(db, "payments");
        // Use the RENAMED firestoreOrderBy function here
        const q = query(paymentsRef, where("customerId", "==", customerId), firestoreOrderBy("paymentDate", "desc")); // <<< USE firestoreOrderBy
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            newPaymentTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No payments or adjustments found.</td></tr>`;
        } else {
            querySnapshot.forEach(doc => {
                // ... (rest of row creation logic - same as previous version) ...
                const payment = doc.data();
                const paymentId = doc.id;
                const paymentDate = payment.paymentDate?.toDate ? formatDate(payment.paymentDate.toDate()) : 'N/A';
                const amountPaid = payment.amountPaid || 0;
                const paymentMethod = payment.paymentMethod || 'N/A';
                const notes = payment.notes || '';
                const isAdj = payment.isAdjustment === true;
                const row = newPaymentTableBody.insertRow();
                row.insertCell().textContent = paymentDate;
                const amountCell = row.insertCell();
                amountCell.textContent = `₹${formatNumber(amountPaid)}`;
                 if (isAdj && amountPaid < 0) { amountCell.style.color = 'red'; amountCell.title = 'Debit Adjustment'; }
                 else if (isAdj && amountPaid >= 0) { amountCell.style.color = 'green'; amountCell.title = 'Credit Adjustment'; }
                row.insertCell().textContent = paymentMethod;
                row.insertCell().textContent = notes;
                const actionCell = row.insertCell();
                actionCell.style.textAlign = 'center';
                const deleteButton = document.createElement('button');
                deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
                deleteButton.className = 'action-button delete-payment-btn';
                deleteButton.title = 'Delete Payment/Adjustment';
                deleteButton.setAttribute('data-payment-id', paymentId);
                 if (payment.notes?.startsWith("Advance payment for Order #")) {
                     deleteButton.disabled = true; deleteButton.title = 'Cannot delete advance payment entry.';
                     deleteButton.style.opacity = '0.5'; deleteButton.style.cursor = 'not-allowed';
                 }
                actionCell.appendChild(deleteButton);
            });
             newPaymentTableBody.addEventListener('click', (event) => {
                 const deleteBtn = event.target.closest('button.delete-payment-btn');
                 if (deleteBtn && !deleteBtn.disabled) {
                      const paymentIdToDelete = deleteBtn.getAttribute('data-payment-id');
                      if (paymentIdToDelete) { handleDeletePayment(paymentIdToDelete); }
                 }
             });
        }
        console.log(`V2.5.1: Payment history table loaded.`);
    } catch (error) {
        console.error("V2.5.1: Error loading payment history table:", error);
         if(error.code === 'failed-precondition' && error.message.includes("index")){
             displayError(`Error loading payments table: Index required. Please check Firestore console.`);
         } else{
            displayError(`Error loading payments table: ${error.message}`);
         }
        newPaymentTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Error loading payments table.</td></tr>`;
    }
}
// <<< NEW FUNCTION END >>>

// <<< NEW FUNCTION >>> - Handles Payment/Adjustment Deletion
async function handleDeletePayment(paymentId) {
    if (!deleteDoc || !doc) { alert("DB function missing (delete payment)"); return; }
    if (!paymentId) { console.warn("V2.5.1: Delete payment called without ID."); return; }
    if (confirm('क्या आप वाकई इस भुगतान/एडजस्टमेंट एंट्री को डिलीट करना चाहते हैं? यह वापस नहीं लाया जा सकेगा।')) {
        console.log(`V2.5.1: User confirmed deletion for payment/adjustment ${paymentId}. Proceeding...`);
        try {
            await deleteDoc(doc(db, "payments", paymentId));
            console.log("V2.5.1: Payment/Adjustment deleted successfully from Firestore.");
            alert("Payment/Adjustment record deleted.");
            // Refresh data
            console.log("V2.5.1: Refreshing data after delete...");
            currentTotalPaidAmount = await loadPaymentHistory(currentCustomerId);
            const currentOrderTotal = await loadOrderHistory(currentCustomerId);
            updateAccountSummary(currentOrderTotal);
            await loadAccountLedger(currentCustomerId);
            await loadPaymentHistoryTable(currentCustomerId);
            console.log("V2.5.1: Data refreshed.");
        } catch (error) { console.error(`V2.5.1: Error deleting payment/adjustment ${paymentId}:`, error); alert(`Failed to delete record: ${error.message}`); }
    } else { console.log("V2.5.1: Deletion cancelled by user."); }
}
// <<< NEW FUNCTION END >>>

// <<< NEW FUNCTIONS >>> - Handle Balance Adjustment Modal
function openAddAdjustmentModal() {
    if (!addAdjustmentModal || !addAdjustmentForm) { alert("Cannot open adjustment modal. Elements missing from HTML."); return; }
    console.log("V2.5.1: Opening Add Adjustment modal.");
    addAdjustmentForm.reset();
    if (adjustmentDateInput) adjustmentDateInput.valueAsDate = new Date();
    if(adjustmentTypeDebitRadio) adjustmentTypeDebitRadio.checked = true;
    if (saveAdjustmentBtn) { saveAdjustmentBtn.disabled = false; saveAdjustmentBtn.innerHTML = '<i class="fas fa-save"></i> Save Adjustment'; }
    addAdjustmentModal.classList.add('active');
}

function closeAddAdjustmentModal() { if (addAdjustmentModal) { addAdjustmentModal.classList.remove('active'); } }

async function handleSaveAdjustment(event) {
    event.preventDefault();
    if (!addDoc || !collection || !Timestamp || !currentCustomerId) { alert("DB function missing or Customer ID missing for adjustment."); return; }
    const adjustmentType = document.querySelector('input[name="adjustmentType"]:checked')?.value;
    const adjustmentDateStr = adjustmentDateInput.value;
    const adjustmentAmount = parseFloat(adjustmentAmountInput.value);
    const adjustmentRemarks = adjustmentRemarksInput.value.trim();
    if (isNaN(adjustmentAmount) || adjustmentAmount <= 0) { alert("Please enter a valid positive Amount for the adjustment."); return; }
    if (!adjustmentType || !adjustmentDateStr) { alert("Please fill all required fields (Type, Date)."); return; }
    if (confirm('क्या आप वाकई यह एडजस्टमेंट जोड़ना चाहते हैं?')) {
        const button = saveAdjustmentBtn;
        if(button) button.disabled = true;
        const originalHTML = button ? button.innerHTML : '';
        if(button) button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        try {
            let amountToLog = adjustmentAmount; let method = "Adjustment"; let notes = adjustmentRemarks || "";
            if (adjustmentType === 'debit') { amountToLog = -adjustmentAmount; notes = `Adjustment - Debit: ${notes}`; method = "Adj-Debit"; }
            else { amountToLog = adjustmentAmount; notes = `Adjustment - Credit: ${notes}`; method = "Adj-Credit"; }
            const paymentData = { customerId: currentCustomerId, amountPaid: amountToLog, paymentDate: Timestamp.fromDate(new Date(adjustmentDateStr + 'T00:00:00')), paymentMethod: method, notes: notes.trim(), createdAt: Timestamp.now(), isAdjustment: true };
            const docRef = await addDoc(collection(db, "payments"), paymentData);
            console.log("V2.5.1: Adjustment added successfully:", docRef.id);
            alert("Adjustment saved successfully!");
            closeAddAdjustmentModal();
            // Refresh data
            console.log("V2.5.1: Refreshing data after adjustment save...");
            currentTotalPaidAmount = await loadPaymentHistory(currentCustomerId);
            const currentOrderTotal = await loadOrderHistory(currentCustomerId);
            updateAccountSummary(currentOrderTotal);
            await loadAccountLedger(currentCustomerId);
            await loadPaymentHistoryTable(currentCustomerId);
            console.log("V2.5.1: Data refreshed.");
        } catch (error) { console.error("V2.5.1: Error saving adjustment:", error); alert(`Error saving adjustment: ${error.message}`);
        } finally { if(button){ button.disabled = false; button.innerHTML = originalHTML; } }
    } else { console.log("V2.5.1: Adjustment save cancelled by user."); }
}
// <<< NEW FUNCTIONS END >>>


// <<< MODIFIED FUNCTION >>> - Setup ALL static event listeners
function setupStaticEventListeners() {
    console.log("V2.5.1: Setting up static event listeners...");
    // --- Existing Listeners (Verify IDs in HTML) ---
    if(closeModalBtn_CustPage) closeModalBtn_CustPage.addEventListener('click', closeDetailsModal_CustPage);
    if(detailsModal_CustPage) detailsModal_CustPage.addEventListener('click', (event) => { if(event.target === detailsModal_CustPage) closeDetailsModal_CustPage(); });
    if(modalUpdateStatusBtn_CustPage) modalUpdateStatusBtn_CustPage.addEventListener('click', handleUpdateStatus_CustPage);
    if(modalDeleteBtn_CustPage) modalDeleteBtn_CustPage.addEventListener('click', handleDeleteFromModal_CustPage); // Deletes ORDER
    if(modalEditFullBtn_CustPage) modalEditFullBtn_CustPage.addEventListener('click', handleEditFullFromModal_CustPage);
    if(addPaymentBtn) addPaymentBtn.addEventListener('click', openAddPaymentModal);
    if(closePaymentModalBtn) closePaymentModalBtn.addEventListener('click', closeAddPaymentModal);
    if(cancelPaymentBtn) cancelPaymentBtn.addEventListener('click', closeAddPaymentModal);
    if(addPaymentModal) addPaymentModal.addEventListener('click', (event) => { if(event.target === addPaymentModal) closeAddPaymentModal(); });
    if(addPaymentForm) addPaymentForm.addEventListener('submit', handleSavePayment);
    if(editCustomerBtn) editCustomerBtn.addEventListener('click', openEditCustomerModal_CustPage);
    if(closeCustomerEditModalBtn) closeCustomerEditModalBtn.addEventListener('click', closeEditCustomerModal_CustPage);
    if(cancelCustomerEditBtn) cancelCustomerEditBtn.addEventListener('click', closeEditCustomerModal_CustPage);
    if(customerEditModal) customerEditModal.addEventListener('click', (event) => { if(event.target === customerEditModal) closeEditCustomerModal_CustPage(); });
    if(customerEditForm) customerEditForm.addEventListener('submit', handleUpdateCustomer_CustPage);
    if(creditEditYesRadio && creditEditNoRadio && creditLimitEditGroup){ const toggleCreditLimitField = () => { creditLimitEditGroup.style.display = creditEditYesRadio.checked ? 'block' : 'none'; }; creditEditYesRadio.addEventListener('change', toggleCreditLimitField); creditEditNoRadio.addEventListener('change', toggleCreditLimitField); }
    if(toggleStatusBtn) toggleStatusBtn.addEventListener('click', handleToggleAccountStatus);
    if(closeConfirmToggleModalBtn) closeConfirmToggleModalBtn.addEventListener('click', closeConfirmToggleModal);
    if(cancelToggleBtn) cancelToggleBtn.addEventListener('click', closeConfirmToggleModal);
    if(confirmToggleStatusModal) confirmToggleStatusModal.addEventListener('click', (e) => { if(e.target === confirmToggleStatusModal) closeConfirmToggleModal(); });
    if(confirmToggleCheckbox) confirmToggleCheckbox.addEventListener('change', () => { if(confirmToggleBtn) confirmToggleBtn.disabled = !confirmToggleCheckbox.checked; });
    if(confirmToggleBtn) confirmToggleBtn.addEventListener('click', () => { const newStatus = confirmToggleBtn.dataset.newStatus; if(confirmToggleCheckbox.checked && newStatus){ executeToggleStatus(newStatus); } });
    if(deleteCustomerBtn) deleteCustomerBtn.addEventListener('click', handleDeleteCustomer_CustPage);
    if(closeConfirmDeleteModalBtn) closeConfirmDeleteModalBtn.addEventListener('click', closeConfirmDeleteModal);
    if(cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeConfirmDeleteModal);
    if(confirmDeleteModal) confirmDeleteModal.addEventListener('click', (e) => { if(e.target === confirmDeleteModal) closeConfirmDeleteModal(); });
    if(confirmDeleteCheckboxModal) confirmDeleteCheckboxModal.addEventListener('change', () => { if(confirmDeleteBtn) confirmDeleteBtn.disabled = !confirmDeleteCheckboxModal.checked; });
    if(confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', () => { if(confirmDeleteCheckboxModal.checked){ executeDeleteCustomer(); } });
    // --- NEW Listeners ---
    // Payment Deletion listener is now added dynamically within loadPaymentHistoryTable
    // Adjustment Modal Listeners
    if (addAdjustmentBtn) addAdjustmentBtn.addEventListener('click', openAddAdjustmentModal);
    if (closeAdjustmentModalBtn) closeAdjustmentModalBtn.addEventListener('click', closeAddAdjustmentModal);
    if (cancelAdjustmentBtn) cancelAdjustmentBtn.addEventListener('click', closeAddAdjustmentModal);
    if (addAdjustmentModal) addAdjustmentModal.addEventListener('click', (event) => { if (event.target === addAdjustmentModal) closeAddAdjustmentModal(); });
    if (addAdjustmentForm) addAdjustmentForm.addEventListener('submit', handleSaveAdjustment);
    // --- End NEW Listeners ---
    console.log("V2.5.1: Static event listeners attached.");
}
// <<< MODIFIED FUNCTION END >>>


// <<< MODIFIED FUNCTION >>> - Initializes page, calls payment table load
window.initializeCustomerDetailPage = async function(user) {
    console.log("V2.5.1: Initializing customer detail page...");
    currentCustomerId = getCustomerIdFromUrl();
    if (!currentCustomerId) { displayError("Customer ID missing from URL."); return; }
    console.log(`V2.5.1: Customer ID found: ${currentCustomerId}`);
    setupStaticEventListeners(); // Setup listeners first
    const customerLoaded = await loadCustomerDetails(currentCustomerId);
    if (!customerLoaded) { console.error("V2.5.1: Failed to load customer details."); return; }
    console.log("V2.5.1: Loading related data...");
    const totalOrderValue = await loadOrderHistory(currentCustomerId);
    await loadPaymentHistory(currentCustomerId); // Calculates global currentTotalPaidAmount
    updateAccountSummary(totalOrderValue); // Update summary box
    await loadAccountLedger(currentCustomerId); // Load ledger
    await loadPaymentHistoryTable(currentCustomerId); // <<< Load the payment history table
    console.log("V2.5.1: Customer detail page initialization complete.");
}
// <<< MODIFIED FUNCTION END >>>

// Log script load
console.log("customer_account_detail.js (V2.5.1 - Corrected firestoreOrderBy) script loaded.");