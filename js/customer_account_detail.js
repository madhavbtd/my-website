// js/customer_account_detail.js (Version 2.4.0 - Ledger Added)

// --- Firebase Functions ---
const {
    db, doc, getDoc, collection, query, where, getDocs, orderBy: firestoreOrderBy,
    updateDoc, deleteDoc, Timestamp, arrayUnion, addDoc
} = window;

// --- Global State ---
let currentCustomerId = null;
let currentCustomerData = null;
// Global variable for total paid amount, updated by loadPaymentHistory
let currentTotalPaidAmount = 0;

// --- DOM References ---
// (Assume all IDs from HTML exist)
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
    console.log(`V2.4.0: Loading details for customer: ${customerId}`);
    currentCustomerData = null;
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
            console.log("V2.4.0: Customer data fetched:", currentCustomerData);
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
            if (toggleStatusBtn) toggleStatusBtn.disabled = false;
            if (deleteCustomerBtn) deleteCustomerBtn.disabled = false;

            // Update Add New Order link
            if (addNewOrderLink) {
                addNewOrderLink.href = `new_order.html?customerId=${encodeURIComponent(customerId)}&customerName=${encodeURIComponent(customerName)}`;
                addNewOrderLink.classList.remove('disabled');
            }

            console.log("V2.4.0: Customer details displayed.");
            return true; // Success
        } else {
            displayError("Customer not found.");
            return false; // Failure
        }
    } catch (error) {
        console.error("V2.4.0: Error loading customer details:", error);
        displayError(`Error loading details: ${error.message}`);
        return false; // Failure
    }
}


/**
 * Fetches and displays order history, returns total order value. (MODIFIED in V2.4.0)
 */
async function loadOrderHistory(customerId) {
    console.log(`V2.4.0: Loading order history for customer: ${customerId}`);
    const orderTableBody = document.getElementById('customerOrderTableBody');

    let totalOrderValue = 0; // Initialize total order value

    if (!orderTableBody) { console.error("V2.4.0: Order table body missing."); return 0; }
    if (!collection || !query || !where || !getDocs || !firestoreOrderBy ) {
        displayError("DB function missing (orders).");
        orderTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Error loading orders</td></tr>`;
        return 0;
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

                // Accumulate total order value (Make sure 'totalAmount' field exists in your order documents)
                totalOrderValue += Number(order.totalAmount || 0);

                // --- Corrected Order ID and Status field access (as per V2.3.5 logic) ---
                const displayOrderId = order.orderId || order.customOrderId || `(sys) ${firestoreOrderId.substring(0,6)}...`;
                const orderDate = order.createdAt?.toDate ? formatDate(order.createdAt.toDate()) : 'N/A';
                const status = order.status || order.currentStatus || 'Unknown';
                // --- End Correction ---

                let productsHtml = 'N/A';
                if (order.products && Array.isArray(order.products)) {
                   productsHtml = order.products.map(p => `${escapeHtml(p.name || '?')} (${escapeHtml(p.quantity || '?')})`).join('<br>');
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
        console.log(`V2.4.0: Order history loaded. Total Order Value: ${totalOrderValue}`);
        return totalOrderValue; // Return the calculated total value
    } catch (error) {
        console.error("V2.4.0: Error loading order history:", error);
        displayError(`Error loading orders: ${error.message}`);
        newOrderTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Error loading orders.</td></tr>`;
        return 0; // Return 0 on error
    }
}

/**
 * Fetches payment history and returns total paid amount. (MODIFIED in V2.4.0)
 * No longer updates the UI directly; UI is handled by the ledger.
 */
async function loadPaymentHistory(customerId) {
    console.log(`V2.4.0: Loading payment history calculation for customer: ${customerId}`);
    let totalPaid = 0;

    if (!collection || !query || !where || !getDocs || !firestoreOrderBy ) {
        displayError("DB function missing (payments).");
        return 0;
    }

    try {
        const paymentsRef = collection(db, "payments");
        const q = query(paymentsRef, where("customerId", "==", customerId), firestoreOrderBy("paymentDate", "desc")); // Sort by date for consistency
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
             querySnapshot.forEach(doc => {
                const payment = doc.data();
                totalPaid += Number(payment.amountPaid || 0);
            });
        } else {
            console.log("V2.4.0: No payments found for this customer during calculation.");
        }

        console.log(`V2.4.0: Payment history calculation complete. Total Paid: ${totalPaid}`);
        currentTotalPaidAmount = totalPaid; // Update the global variable
        return totalPaid; // Return the calculated total paid amount
    } catch (error) {
         // Handle Firestore index errors specifically
         if(error.code === 'failed-precondition'){
             displayError(`Error loading payments: Index required. Please check Firestore console.`);
             console.error("Firestore Index Error:", error.message);
         } else{
             displayError(`Error loading payments: ${error.message}`);
         }
        return 0; // Return 0 on error
    }
}

/**
 * Updates the Account Summary box using calculated totals. (MODIFIED in V2.4.0)
 * Now takes totalOrderValue as a parameter. Uses global currentTotalPaidAmount.
 */
function updateAccountSummary(totalOrderValue) {
    console.log(`V2.4.0: Updating account summary. Order Value: ${totalOrderValue}, Paid Amount: ${currentTotalPaidAmount}`);
    const summaryTotalOrdersEl = document.getElementById('summary-total-orders');
    const summaryTotalPaidEl = document.getElementById('summary-total-paid');
    const summaryBalanceEl = document.getElementById('summary-balance');

    if (!summaryTotalOrdersEl || !summaryTotalPaidEl || !summaryBalanceEl) {
        console.error("V2.4.0: Account summary elements missing!");
        return;
    }

    // Display Total Order Value
    summaryTotalOrdersEl.textContent = formatCurrency(totalOrderValue);

    // Display Total Paid Amount (from global variable)
    summaryTotalPaidEl.textContent = formatCurrency(currentTotalPaidAmount);

    // Calculate and Display Outstanding Balance
    const balance = Number(totalOrderValue) - Number(currentTotalPaidAmount);
    summaryBalanceEl.textContent = formatCurrency(balance);

    // Set class based on balance
    if (balance < 0) {
        summaryBalanceEl.className = 'balance-credit'; // Customer has credit
    } else if (balance > 0) {
        summaryBalanceEl.className = 'balance-due'; // Customer owes money
    } else {
        summaryBalanceEl.className = 'balance-info'; // Zero balance
    }
     console.log("V2.4.0: Account summary updated.");
}


// ---------->>> NEW ACCOUNT LEDGER FUNCTION <<<----------
/**
 * Loads orders and payments, merges them chronologically, and displays the account ledger. (NEW in V2.4.0)
 */
async function loadAccountLedger(customerId) {
    console.log(`V2.4.0: Loading account ledger for customer: ${customerId}`);
    if (!accountLedgerTableBody) { console.error("V2.4.0: Ledger table body missing."); return; }
    if (!db || !collection || !query || !where || !getDocs || !firestoreOrderBy || !Timestamp) {
        displayError("DB function missing (ledger).");
        accountLedgerTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Error loading ledger</td></tr>`;
        return;
    }

    accountLedgerTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Loading ledger...</td></tr>`;

    let transactions = [];

    try {
        // 1. Fetch Orders (sorted ascending by date for correct running balance)
        const ordersRef = collection(db, "orders");
        const orderQuery = query(ordersRef, where("customerId", "==", customerId), firestoreOrderBy("createdAt", "asc"));
        const orderSnapshot = await getDocs(orderQuery);
        orderSnapshot.forEach(doc => {
            const order = doc.data();
            // Use custom order ID if available, otherwise fallback
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
         console.log(`V2.4.0: Fetched ${orderSnapshot.size} orders for ledger.`);

        // 2. Fetch Payments (sorted ascending by date)
        const paymentsRef = collection(db, "payments");
        const paymentQuery = query(paymentsRef, where("customerId", "==", customerId), firestoreOrderBy("paymentDate", "asc"));
        const paymentSnapshot = await getDocs(paymentQuery);
        paymentSnapshot.forEach(doc => {
            const payment = doc.data();
            transactions.push({
                date: payment.paymentDate, // Firestore Timestamp
                type: 'payment',
                description: `Payment Received (${payment.paymentMethod || 'N/A'})`,
                debitAmount: 0,
                creditAmount: Number(payment.amountPaid || 0),
                docId: doc.id
            });
        });
        console.log(`V2.4.0: Fetched ${paymentSnapshot.size} payments for ledger.`);

        // 3. Sort All Transactions Chronologically by Date
        transactions.sort((a, b) => {
            const dateA = a.date?.toDate ? a.date.toDate().getTime() : 0;
            const dateB = b.date?.toDate ? b.date.toDate().getTime() : 0;
            // If dates are the same, maybe prioritize orders slightly? (Optional)
            // if (dateA === dateB && a.type === 'order' && b.type === 'payment') return -1;
            // if (dateA === dateB && a.type === 'payment' && b.type === 'order') return 1;
            return dateA - dateB; // Primary sort by date ascending
        });
        console.log(`V2.4.0: Sorted ${transactions.length} total transactions.`);

        // 4. Render Ledger Table with Running Balance
        accountLedgerTableBody.innerHTML = ''; // Clear loading/previous state
        let runningBalance = 0;

        if (transactions.length === 0) {
            accountLedgerTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No transactions found.</td></tr>`;
        } else {
            transactions.forEach(tx => {
                // Calculate running balance *before* displaying the row
                runningBalance = runningBalance - tx.debitAmount + tx.creditAmount;

                const row = accountLedgerTableBody.insertRow();

                const cellDate = row.insertCell();
                cellDate.textContent = tx.date?.toDate ? formatDate(tx.date.toDate()) : 'N/A';

                const cellDesc = row.insertCell();
                cellDesc.textContent = escapeHtml(tx.description);

                const cellDebit = row.insertCell();
                cellDebit.textContent = tx.debitAmount > 0 ? formatCurrency(tx.debitAmount) : '-';
                cellDebit.style.textAlign = 'right'; // Ensure alignment

                const cellCredit = row.insertCell();
                cellCredit.textContent = tx.creditAmount > 0 ? formatCurrency(tx.creditAmount) : '-';
                cellCredit.style.textAlign = 'right'; // Ensure alignment

                const cellBalance = row.insertCell();
                cellBalance.textContent = formatCurrency(runningBalance);
                cellBalance.style.textAlign = 'right'; // Ensure alignment
                // Add classes for styling based on balance
                cellBalance.classList.add(runningBalance >= 0 ? 'ledger-balance-positive' : 'ledger-balance-negative');
            });
        }
        console.log(`V2.4.0: Ledger rendered. Final balance: ${runningBalance}`);

        // Note: Delete buttons for payments are intentionally omitted from the ledger
        // to keep it cleaner. Deletion can happen from a separate payment history view if needed,
        // or by adding an Action column back here if required.

    } catch (error) {
        console.error("V2.4.0: Error loading account ledger:", error);
         if(error.code === 'failed-precondition'){
             displayError(`Error loading ledger: Index required. Please check Firestore console.`);
             console.error("Firestore Index Error:", error.message);
         } else{
            displayError(`Error loading ledger: ${error.message}`);
         }
        accountLedgerTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Error loading ledger.</td></tr>`;
    }
}
// ---------->>> END OF NEW LEDGER FUNCTION <<<----------


// --- Order Details Modal Functions --- (No changes needed for ledger)
async function openOrderDetailsModal_CustPage(firestoreId) {
    if(!detailsModal_CustPage || !firestoreId){ console.error("V2.4.0: Modal/Order ID missing."); alert("Cannot open details."); return; }
    console.log(`V2.4.0: Opening order modal: ${firestoreId}`);
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
            console.log("V2.4.0: Fetched order data for modal:", orderData);
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
        console.error("V2.4.0: Error loading order details for modal:", error);
        alert(`Error loading order details: ${error.message}`);
        closeDetailsModal_CustPage();
    }
}

function populateOrderModal_CustPage(orderData) {
    if (!orderData) return;

    // Populate basic info
    modalDisplayOrderIdSpan_CustPage.textContent = orderData.orderId || orderData.customOrderId || `(Sys: ${orderData.id.substring(0, 6)}...)`;
    modalCustomerNameSpan_CustPage.textContent = currentCustomerData?.fullName || orderData.customerDetails?.fullName || 'N/A'; // Use cached customer data if available
    modalCustomerWhatsAppSpan_CustPage.textContent = currentCustomerData?.whatsappNo || orderData.customerDetails?.whatsappNo || 'N/A';
    modalOrderStatusSelect_CustPage.value = orderData.status || orderData.currentStatus || ''; // Set current status in dropdown

    // Populate Product List
    modalProductListContainer_CustPage.innerHTML = ''; // Clear previous
    const products = orderData.products;
    if (Array.isArray(products) && products.length > 0) {
        const ul = document.createElement('ul');
        ul.style.cssText = 'list-style:none; padding:0; margin:0;';
        products.forEach(p => {
            const li = document.createElement('li');
            li.style.cssText = 'margin-bottom:5px; padding-bottom:5px; border-bottom:1px dotted #eee;';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = p.name || 'Unnamed Product';
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
        // Update both 'status' and 'currentStatus' for consistency, and add to history
        await updateDoc(doc(db, "orders", firestoreId), {
            status: newStatus,
            currentStatus: newStatus, // Keep both fields updated if used elsewhere
            updatedAt: historyEntry.timestamp, // Update main timestamp
            statusHistory: arrayUnion(historyEntry) // Add to history array
        });
        console.log("V2.4.0: Status updated successfully for order:", firestoreId);
        alert("Order status updated!");

        // Refresh modal content and order history table
        const orderSnap = await getDoc(doc(db, "orders", firestoreId));
        if (orderSnap.exists()) {
            populateOrderModal_CustPage({ id: orderSnap.id, ...orderSnap.data() });
        }
        await loadOrderHistory(currentCustomerId); // Reload order history table
        await loadAccountLedger(currentCustomerId); // Reload ledger as status might affect display context (though not balance)

    } catch (e) {
        console.error("V2.4.0: Error updating status:", e);
        alert("Error updating status: " + e.message);
    } finally {
        button.disabled = false;
        button.innerHTML = originalHTML;
    }
}

async function handleDeleteFromModal_CustPage() {
    const firestoreId = modalOrderIdInput_CustPage.value;
    const displayId = modalDisplayOrderIdSpan_CustPage.textContent || `Order ID: ${firestoreId}`; // Get display ID for confirmation
    if (!firestoreId) return;

    if (confirm(`Are you sure you want to delete this order?\nOrder: ${displayId}\n\nThis action cannot be undone.`)) {
        closeDetailsModal_CustPage(); // Close modal before deleting
        await deleteSingleOrder_CustPage(firestoreId); // Call delete function
    } else {
        console.log("V2.4.0: Order deletion cancelled by user.");
    }
}

async function deleteSingleOrder_CustPage(firestoreId) {
    if (!db || !doc || !deleteDoc) { alert("Delete function is unavailable."); return; }
    console.log(`V2.4.0: Attempting to delete order: ${firestoreId}`);
    try {
        await deleteDoc(doc(db, "orders", firestoreId));
        console.log("V2.4.0: Order deleted successfully:", firestoreId);
        alert("Order deleted successfully.");

        // Refresh data after deleting the order
        const currentOrderTotal = await loadOrderHistory(currentCustomerId); // Reloads order table UI & recalculates total
        currentTotalPaidAmount = await loadPaymentHistory(currentCustomerId); // Recalculate total paid (unlikely to change, but good practice)
        updateAccountSummary(currentOrderTotal); // Update summary
        await loadAccountLedger(currentCustomerId); // Reload ledger

    } catch (e) {
        console.error("V2.4.0: Error deleting order:", e);
        alert("Error deleting order: " + e.message);
    }
}

function handleEditFullFromModal_CustPage() {
    const firestoreId = modalOrderIdInput_CustPage.value;
    if (firestoreId) {
        console.log(`V2.4.0: Redirecting to edit order form for: ${firestoreId}`);
        // Redirect to the new_order page with the order ID to edit
        window.location.href = `new_order.html?editOrderId=${firestoreId}`;
    } else {
        alert("Cannot edit order: Order ID is missing.");
    }
}

// --- Add Payment Modal Functions --- (No changes needed for ledger)
function openAddPaymentModal() {
    if(!addPaymentModal || !currentCustomerData){ alert("Cannot open add payment modal. Customer data missing."); return; }
    console.log("V2.4.0: Opening Add Payment modal.");
    addPaymentForm.reset(); // Clear the form
    if(paymentModalCustNameSpan){ paymentModalCustNameSpan.textContent = currentCustomerData.fullName || ''; }
    if(paymentDateInput){ paymentDateInput.valueAsDate = new Date(); } // Default to today
    savePaymentBtn.disabled = false;
    savePaymentBtn.innerHTML = '<i class="fas fa-save"></i> Save Payment'; // Reset button text
    addPaymentModal.classList.add('active');
}

function closeAddPaymentModal() { if (addPaymentModal) addPaymentModal.classList.remove('active'); }

/**
 * Saves a new payment and refreshes relevant page sections. (MODIFIED in V2.4.0)
 * Refreshes ledger and summary after saving.
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
        // Set time to beginning of the day for consistency
        const paymentDateTimestamp = Timestamp.fromDate(new Date(date + 'T00:00:00'));
        const paymentData = {
            customerId: currentCustomerId,
            amountPaid: amount,
            paymentDate: paymentDateTimestamp,
            paymentMethod: method,
            notes: notes || null, // Store null if empty
            createdAt: Timestamp.now() // Record creation time
        };
        const docRef = await addDoc(collection(db, "payments"), paymentData);
        console.log("V2.4.0: Payment added successfully:", docRef.id);
        alert("Payment added successfully!");
        closeAddPaymentModal();

        // --- Refresh data after saving ---
        console.log("V2.4.0: Refreshing data after payment save...");
        // 1. Recalculate total paid (includes the new payment)
        currentTotalPaidAmount = await loadPaymentHistory(currentCustomerId); // Recalculates global var
        // 2. Get current total order value (should be unchanged by payment)
        const currentOrderTotal = await loadOrderHistory(currentCustomerId); // Reloads order table UI & gets total
        // 3. Update the summary box
        updateAccountSummary(currentOrderTotal);
        // 4. Reload the ledger (includes the new payment)
        await loadAccountLedger(currentCustomerId);
        console.log("V2.4.0: Data refreshed.");
        // --- End refresh ---

    } catch (error) {
        console.error("V2.4.0: Error saving payment:", error);
        alert(`Error saving payment: ${error.message}`);
    } finally {
        savePaymentBtn.disabled = false;
        savePaymentBtn.innerHTML = originalHTML;
    }
}


// --- Edit Customer Modal Functions --- (No changes needed for ledger)
function openEditCustomerModal_CustPage() {
    if(!customerEditModal || !customerEditForm || !currentCustomerData || !currentCustomerId){
        alert("Cannot open edit customer modal. Data missing."); return;
    }
    console.log("V2.4.0: Opening Edit Customer modal.");
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
        console.log("V2.4.0: Customer details updated successfully.");
        alert("Customer details updated successfully!");
        closeEditCustomerModal_CustPage();
        // Reload customer details on the page to reflect changes
        await loadCustomerDetails(customerIdToUpdate);
        // No need to reload ledger/summary as customer details don't affect balance

    } catch (error) {
        console.error("V2.4.0: Error updating customer:", error);
        alert(`Error updating customer: ${error.message}`);
    } finally {
        button.disabled = false;
        button.innerHTML = originalHTML;
    }
}

// --- Delete Payment Logic ---
/**
 * Deletes a payment record and refreshes relevant sections. (MODIFIED in V2.4.0)
 * Refreshes ledger and summary after deleting.
 */
async function handleDeletePayment_CustPage(paymentId) {
    if (!deleteDoc || !doc) { alert("DB function missing (delete payment)"); return; }
    if (!paymentId) { console.warn("V2.4.0: Delete payment called without ID."); return; }

    // Confirmation dialog
    if (confirm(`Are you sure you want to permanently delete this payment record?\n\nThis action cannot be undone.`)) {
        console.log(`V2.4.0: User confirmed deletion for payment ${paymentId}. Proceeding...`);
        try {
            await deleteDoc(doc(db, "payments", paymentId));
            console.log("V2.4.0: Payment deleted successfully from Firestore.");
            alert("Payment record deleted.");

            // --- Refresh data after deleting ---
            console.log("V2.4.0: Refreshing data after payment delete...");
            // 1. Recalculate total paid (excludes deleted payment)
            currentTotalPaidAmount = await loadPaymentHistory(currentCustomerId); // Recalculates global var
            // 2. Get current total order value (should be unchanged)
            const currentOrderTotal = await loadOrderHistory(currentCustomerId); // Reloads order table UI & gets total
            // 3. Update the summary box
            updateAccountSummary(currentOrderTotal);
            // 4. Reload the ledger (excludes deleted payment)
            await loadAccountLedger(currentCustomerId);
            console.log("V2.4.0: Data refreshed.");
            // --- End refresh ---

        } catch (error) {
            console.error(`V2.4.0: Error deleting payment ${paymentId}:`, error);
            alert(`Failed to delete payment record: ${error.message}`);
        }
    } else {
        console.log("V2.4.0: Payment deletion cancelled by user.");
    }
}


// --- Confirmation Modal Logic (Toggle Status, Delete Customer) --- (No changes needed for ledger)
function handleToggleAccountStatus() {
    if(!currentCustomerId || !currentCustomerData){ alert("Customer data not loaded. Cannot toggle status."); return; }
    const currentStatus = currentCustomerData.status || 'active';
    const isDisabling = currentStatus === 'active';
    const actionText = isDisabling ? 'disable' : 'enable';
    const newStatus = isDisabling ? 'inactive' : 'active';
    openConfirmToggleModal(actionText, newStatus);
}

function openConfirmToggleModal(action, newStatus) {
    if(!confirmToggleStatusModal || !toggleActionTextSpan || !toggleCustNameSpan || !confirmToggleCheckbox || !confirmToggleBtn || !toggleWarningMessage || !toggleCheckboxLabel || !confirmToggleBtnText){
        console.error("Toggle confirm modal elements missing!"); return;
    }
    console.log(`V2.4.0: Opening confirm toggle modal. Action: ${action}, New Status: ${newStatus}`);
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
        console.log(`V2.4.0: Customer status successfully changed to ${newStatus}.`);
        alert(`Customer account status changed to ${newStatus}.`);
        closeConfirmToggleModal();
        // Reload customer details to update status badge and button text on page
        await loadCustomerDetails(currentCustomerId);
    } catch (error) {
        console.error("V2.4.0: Error toggling account status:", error);
        alert(`Error changing status: ${error.message}`);
    } finally {
        button.disabled = false;
        button.innerHTML = originalHTML;
    }
}

function handleDeleteCustomer_CustPage() {
    if(!currentCustomerId || !currentCustomerData){ alert("Customer data not loaded. Cannot delete."); return; }
    openConfirmDeleteModal(); // Open the confirmation modal
}

function openConfirmDeleteModal() {
    if(!confirmDeleteModal || !deleteCustNameSpan || !confirmDeleteCheckboxModal || !confirmDeleteBtn){
        console.error("Delete confirm modal elements missing!"); return;
    }
    console.log("V2.4.0: Opening delete confirmation modal.");
    deleteCustNameSpan.textContent = currentCustomerData?.fullName || 'this customer';
    confirmDeleteCheckboxModal.checked = false; // Reset checkbox
    confirmDeleteBtn.disabled = true; // Disable button initially
    confirmDeleteModal.classList.add('active');
}

function closeConfirmDeleteModal() { if (confirmDeleteModal) confirmDeleteModal.classList.remove('active');}

async function executeDeleteCustomer() {
    if(!deleteDoc || !doc || !currentCustomerId){ alert("DB function missing (delete customer)"); return; }
    const customerName = currentCustomerData?.fullName || `ID: ${currentCustomerId}`;
    console.log(`V2.4.0: Executing permanent deletion for customer ${currentCustomerId}`);

    const button = confirmDeleteBtn;
    button.disabled = true;
    const originalHTML = button.innerHTML;
    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Deleting...`;

    try {
        await deleteDoc(doc(db, "customers", currentCustomerId));
        console.log("V2.4.0: Customer deleted successfully from Firestore.");
        alert(`Customer "${customerName}" has been permanently deleted.`);
        closeConfirmDeleteModal();
        // Redirect back to the customer list page after deletion
        window.location.href = 'customer_management.html';
    } catch (error) {
        console.error("V2.4.0: Error deleting customer:", error);
        alert(`Error deleting customer: ${error.message}`);
        // Re-enable button on error
        button.disabled = false;
        button.innerHTML = originalHTML;
    }
}


/** Displays an error message to the user and console */
function displayError(message) {
    console.error("V2.4.0: ERROR - ", message);
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
    console.log("V2.4.0: Setting up static event listeners...");

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

    // Note: Event listener for deleting payments from the original payment table is removed
    // as the ledger is intended to replace its detailed view. If you add delete buttons
    // to the ledger itself, add the listener here or within loadAccountLedger.

    console.log("V2.4.0: Static event listeners attached.");
}


/** Main function to initialize the customer detail page (MODIFIED in V2.4.0) */
window.initializeCustomerDetailPage = async function(user) {
    console.log("V2.4.0: Initializing customer detail page...");
    currentCustomerId = getCustomerIdFromUrl();
    if (!currentCustomerId) {
        displayError("Customer ID missing from URL. Cannot load page.");
        return;
    }
    console.log(`V2.4.0: Customer ID found: ${currentCustomerId}`);

    // Setup listeners first, regardless of data loading outcome
    setupStaticEventListeners();

    // Load customer details first, as other parts might depend on it
    const customerLoaded = await loadCustomerDetails(currentCustomerId);
    if (!customerLoaded) {
        console.error("V2.4.0: Failed to load customer details. Stopping initialization.");
        // displayError handled within loadCustomerDetails
        return; // Stop initialization if customer details fail
    }

    // Now load order history, payment totals, and the ledger
    console.log("V2.4.0: Loading order history, calculating payment totals, and loading ledger...");

    // We need total order value for the summary
    const totalOrderValue = await loadOrderHistory(currentCustomerId); // Also updates order table UI

    // We need total paid amount for the summary (updates global variable)
    await loadPaymentHistory(currentCustomerId); // Just calculates total paid

    // Update the summary box with the fetched/calculated values
    updateAccountSummary(totalOrderValue);

    // Finally, load the detailed transaction ledger
    await loadAccountLedger(currentCustomerId);

    console.log("V2.4.0: Customer detail page initialization complete.");
}

// Log that the script has loaded
console.log("customer_account_detail.js (V2.4.0 - Ledger Added) script loaded.");