// js/customer_account_detail.js (Version 2.1 - Implemented Page Actions)

// --- Firebase Functions ---
const {
    db, doc, getDoc, collection, query, where, getDocs, orderBy: firestoreOrderBy,
    updateDoc, deleteDoc, Timestamp, arrayUnion, addDoc // Added addDoc
} = window;

// --- Global State ---
let currentCustomerId = null;
let currentCustomerData = null;
let currentTotalOrderValue = 'N/A';
let currentTotalPaidAmount = 0;

// --- DOM References (Main Page Buttons) ---
const editCustomerBtn = document.getElementById('editCustomerBtn');
const addPaymentBtn = document.getElementById('addPaymentBtn');
const toggleStatusBtn = document.getElementById('toggleStatusBtn');
const deleteCustomerBtn = document.getElementById('deleteCustomerBtn');

// --- DOM References (Add Payment Modal) ---
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

// --- DOM References (Edit Customer Modal) ---
const customerEditModal = document.getElementById('customerEditModal');
const closeCustomerEditModalBtn = document.getElementById('closeCustomerEditModal');
const cancelCustomerEditBtn = document.getElementById('cancelCustomerEditBtn');
const customerEditForm = document.getElementById('customerEditForm');
const customerEditModalTitle = document.getElementById('customerEditModalTitle');
const editCustPageCustomerIdInput = document.getElementById('editCustPageCustomerId'); // Hidden input
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


// --- DOM References (Order Details Modal - Copied) ---
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

// --- Helper Functions ---
function escapeHtml(unsafe) { /* ... (पहले जैसा) ... */
     if (typeof unsafe !== 'string') { unsafe = String(unsafe || ''); } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
 }
function formatDate(dateObj) { /* ... (पहले जैसा) ... */
    if (!dateObj || typeof dateObj.toLocaleDateString !== 'function') return 'N/A'; return dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatDateTime(dateObj) { /* ... (पहले जैसा) ... */
     if (!dateObj || typeof dateObj.toLocaleDateString !== 'function') return '?'; return dateObj.toLocaleDateString('en-GB',{day:'numeric',month:'short'}) + ' ' + dateObj.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});
 }
function formatCurrency(amount) { /* ... (पहले जैसा) ... */
     const num = Number(amount || 0); return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; // Ensure 2 decimal places
 }

// --- Core Page Logic ---

/** Reads the customer ID from the URL */
function getCustomerIdFromUrl() { /* ... (पहले जैसा) ... */
    const params = new URLSearchParams(window.location.search); return params.get('id');
}

/** Fetches and displays customer details */
async function loadCustomerDetails(customerId) { /* ... (V2.0 जैसा, सिर्फ कंसोल मैसेज बदले) ... */
    console.log(`V2.1: Loading details for customer: ${customerId}`);
    currentCustomerData = null;
    if (!db || !doc || !getDoc) { displayError("DB function missing (details)."); return false; }
    // ... (get element references) ...
    const nameHeaderEl=document.getElementById('cust-detail-name-header'),nameBreadcrumbEl=document.getElementById('cust-detail-name-breadcrumb'),idEl=document.getElementById('cust-detail-id'),whatsappEl=document.getElementById('cust-detail-whatsapp'),contactEl=document.getElementById('cust-detail-contact'),emailEl=document.getElementById('cust-detail-email'),addressEl=document.getElementById('cust-detail-address'),cityEl=document.getElementById('cust-detail-city'),stateEl=document.getElementById('cust-detail-state'),statusEl=document.getElementById('cust-detail-status'),creditAllowedEl=document.getElementById('cust-detail-credit-allowed'),creditLimitEl=document.getElementById('cust-detail-credit-limit'),notesEl=document.getElementById('cust-detail-notes'),toggleStatusBtn=document.getElementById('toggleStatusBtn'),toggleStatusBtnSpan=toggleStatusBtn?toggleStatusBtn.querySelector('span'):null,addNewOrderLink=document.getElementById('addNewOrderLink'),editCustomerBtn=document.getElementById('editCustomerBtn'),addPaymentBtn=document.getElementById('addPaymentBtn'),deleteCustomerBtn=document.getElementById('deleteCustomerBtn');

    if (nameHeaderEl) nameHeaderEl.textContent = "Loading...";
    if (nameBreadcrumbEl) nameBreadcrumbEl.textContent = "Loading...";

    try {
        const customerRef = doc(db, "customers", customerId);
        const customerSnap = await getDoc(customerRef);
        if (customerSnap.exists()) {
            currentCustomerData = customerSnap.data(); // Store data
            console.log("V2.1: Customer data fetched:", currentCustomerData);
            // ... (populate elements using currentCustomerData) ...
            const customerName=currentCustomerData.fullName||'N/A';if(nameHeaderEl)nameHeaderEl.textContent=customerName;if(nameBreadcrumbEl)nameBreadcrumbEl.textContent=customerName;document.title=`Customer Account - ${customerName}`;if(idEl)idEl.textContent=currentCustomerData.customCustomerId||'N/A';if(whatsappEl)whatsappEl.textContent=currentCustomerData.whatsappNo||'-';if(contactEl)contactEl.textContent=currentCustomerData.contactNo||'-';if(emailEl)emailEl.textContent=currentCustomerData.email||'-';if(addressEl)addressEl.textContent=(currentCustomerData.billingAddress||currentCustomerData.address||'-');if(cityEl)cityEl.textContent=currentCustomerData.city||'-';if(stateEl)stateEl.textContent=currentCustomerData.state||'-';const status=currentCustomerData.status||'active';if(statusEl){statusEl.textContent=status.charAt(0).toUpperCase()+status.slice(1);statusEl.className='status-badge';statusEl.classList.add(`status-${status.toLowerCase()}`);}if(toggleStatusBtnSpan){toggleStatusBtnSpan.textContent=(status==='active')?'Disable Account':'Enable Account';if(toggleStatusBtn)toggleStatusBtn.querySelector('i').className=(status==='active')?'fas fa-toggle-on':'fas fa-toggle-off';}const creditAllowed=currentCustomerData.creditAllowed===true;if(creditAllowedEl)creditAllowedEl.textContent=creditAllowed?'Yes':'No';if(creditLimitEl)creditLimitEl.textContent=creditAllowed?formatCurrency(currentCustomerData.creditLimit):'N/A';if(notesEl)notesEl.textContent=currentCustomerData.notes||'No remarks.';if(editCustomerBtn)editCustomerBtn.disabled=false;if(addPaymentBtn)addPaymentBtn.disabled=false;if(toggleStatusBtn)toggleStatusBtn.disabled=false;if(deleteCustomerBtn)deleteCustomerBtn.disabled=false;if(addNewOrderLink){addNewOrderLink.href=`new_order.html?customerId=${encodeURIComponent(customerId)}&customerName=${encodeURIComponent(customerName)}`;addNewOrderLink.classList.remove('disabled');}
            console.log("V2.1: Customer details displayed.");
            return true;
        } else { displayError("Customer not found."); return false; }
    } catch (error) { displayError(`Error loading details: ${error.message}`); return false; }
}

/** Fetches and displays order history (row click opens modal). */
async function loadOrderHistory(customerId) { /* ... (V2.0 जैसा) ... */
    console.log(`V2.1: Loading order history for customer: ${customerId}`);
    const orderTableBody = document.getElementById('customerOrderTableBody');
    const summaryTotalOrdersEl = document.getElementById('summary-total-orders');
    currentTotalOrderValue = 'N/A'; // Assuming amount still missing from orders

    if (!orderTableBody || !summaryTotalOrdersEl) { console.error("V2.1: Order table elements missing."); return; }
    if (!collection || !query || !where || !getDocs || !firestoreOrderBy ) { displayError("DB function missing (orders)."); orderTableBody.innerHTML = `<tr><td colspan="4">Error</td></tr>`; summaryTotalOrdersEl.textContent = "Error"; return; }

    orderTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Loading orders...</td></tr>`;
    summaryTotalOrdersEl.textContent = "N/A";
    document.getElementById('summary-balance').textContent = "N/A";

    // Clear previous listeners before adding new ones (important!)
    const newOrderTableBody = orderTableBody.cloneNode(false); // Create fresh body
    orderTableBody.parentNode.replaceChild(newOrderTableBody, orderTableBody); // Replace old body

    try {
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef, where("customerId", "==", customerId), firestoreOrderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            newOrderTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">No orders found.</td></tr>`;
        } else {
            querySnapshot.forEach(doc => {
                const order = doc.data();
                const displayOrderId = order.customOrderId || `(sys) ${doc.id.substring(0,6)}...`;
                const firestoreOrderId = doc.id;
                const orderDate = order.createdAt?.toDate ? formatDate(order.createdAt.toDate()) : 'N/A';
                const status = order.currentStatus || 'Unknown';
                let productsHtml = 'N/A';
                if (order.products && Array.isArray(order.products)) {
                   productsHtml = order.products.map(p => `${escapeHtml(p.name || '?')} (${escapeHtml(p.quantity || '?')})`).join('<br>');
                }
                const row = newOrderTableBody.insertRow(); // Use insertRow for tables
                row.setAttribute('data-order-id', firestoreOrderId);
                row.classList.add('order-row-clickable');
                row.innerHTML = `
                    <td>${escapeHtml(displayOrderId)}</td>
                    <td>${orderDate}</td>
                    <td>${productsHtml}</td>
                    <td><span class="status-badge status-${status.toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(status)}</span></td>
                `;
            });

             // Add ONE event listener to the new table body (Event Delegation)
             newOrderTableBody.addEventListener('click', (event) => {
                 const clickedRow = event.target.closest('tr.order-row-clickable');
                 if (clickedRow && clickedRow.dataset.orderId) {
                     openOrderDetailsModal_CustPage(clickedRow.dataset.orderId); // Open modal
                 }
             });
        }
        console.log(`V2.1: Order history loaded.`);
    } catch (error) { console.error("V2.1: Error loading order history:", error); displayError(`Error loading orders: ${error.message}`); newOrderTableBody.innerHTML = `<tr><td colspan="4">Error</td></tr>`; summaryTotalOrdersEl.textContent = "Error"; }
}

/** Fetches and displays payment history. */
async function loadPaymentHistory(customerId) { /* ... (V2.0 जैसा, सिर्फ कंसोल मैसेज बदले) ... */
    console.log(`V2.1: Loading payment history for customer: ${customerId}`);
    const paymentTableBody = document.getElementById('customerPaymentTableBody');
    let totalPaid = 0;
    if (!paymentTableBody) { console.error("V2.1: Payment table body missing."); return 0; }
     if (!collection || !query || !where || !getDocs || !firestoreOrderBy ) { displayError("DB function missing (payments)."); paymentTableBody.innerHTML = `<tr><td colspan="5">Error</td></tr>`; return 0; }

    paymentTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Loading payments...</td></tr>`;

    // Clear previous listeners (using delegation is better here too)
     const newPaymentTableBody = paymentTableBody.cloneNode(false);
     paymentTableBody.parentNode.replaceChild(newPaymentTableBody, paymentTableBody);

    try {
        const paymentsRef = collection(db, "payments");
        const q = query(paymentsRef, where("customerId", "==", customerId), firestoreOrderBy("paymentDate", "desc"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            newPaymentTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No payments recorded.</td></tr>`;
        } else {
            querySnapshot.forEach(doc => {
                const payment = doc.data();
                const paymentId = doc.id;
                const paymentDate = payment.paymentDate?.toDate ? formatDate(payment.paymentDate.toDate()) : 'N/A';
                const amountPaid = Number(payment.amountPaid || 0);
                const method = payment.paymentMethod || '-';
                const notes = payment.notes || '-';
                totalPaid += amountPaid;
                const row = newPaymentTableBody.insertRow();
                row.innerHTML = `
                    <td>${paymentDate}</td>
                    <td>${formatCurrency(amountPaid)}</td>
                    <td>${escapeHtml(method)}</td>
                    <td>${escapeHtml(notes)}</td>
                    <td>
                        <button class="button danger-button delete-payment-btn" data-payment-id="${paymentId}" title="Delete Payment" style="padding: 3px 6px; font-size: 0.9em;">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                `;
            });

             // Add ONE event listener to the new payment table body
              newPaymentTableBody.addEventListener('click', (event) => {
                  const deleteButton = event.target.closest('button.delete-payment-btn');
                  if (deleteButton && deleteButton.dataset.paymentId) {
                      handleDeletePayment_CustPage(deleteButton.dataset.paymentId); // Call delete function
                  }
              });
        }
        console.log(`V2.1: Payment history loaded. Total Paid: ${totalPaid}`);
        currentTotalPaidAmount = totalPaid; // Store globally
        return totalPaid;

    } catch (error) {
         if (error.code === 'failed-precondition') { displayError(`Error loading payments: Firestore index required. Link: ${error.message.match(/https:\/\/[^\s]+/)?.[0] || '(See console)'}`); paymentTableBody.innerHTML = `<tr><td colspan="5">Error: Index required</td></tr>`; }
         else { displayError(`Error loading payments: ${error.message}`); paymentTableBody.innerHTML = `<tr><td colspan="5">Error</td></tr>`; }
        return 0;
    }
}

/** Updates account summary. */
function updateAccountSummary() { /* ... (V2.0 जैसा, global vars इस्तेमाल) ... */
     console.log(`V2.1: Updating account summary. Order Value: ${currentTotalOrderValue}, Paid Amount: ${currentTotalPaidAmount}`);
     const summaryTotalOrdersEl=document.getElementById('summary-total-orders');
     const summaryTotalPaidEl=document.getElementById('summary-total-paid');
     const summaryBalanceEl=document.getElementById('summary-balance');
     if(summaryTotalOrdersEl){summaryTotalOrdersEl.textContent=(currentTotalOrderValue==='N/A')?'N/A':formatCurrency(currentTotalOrderValue);}
     if(summaryTotalPaidEl){summaryTotalPaidEl.textContent=formatCurrency(currentTotalPaidAmount);}
     if(summaryBalanceEl){if(currentTotalOrderValue!=='N/A'){const balance=Number(currentTotalOrderValue)-Number(currentTotalPaidAmount);summaryBalanceEl.textContent=formatCurrency(balance);summaryBalanceEl.className=balance<0?'balance-credit':'balance-due';}else{summaryBalanceEl.textContent=`(Paid: ${formatCurrency(currentTotalPaidAmount)})`;summaryBalanceEl.className='balance-info';}}
 }


// --- Order Details Modal Functions (Adapted/Copied) ---
async function openOrderDetailsModal_CustPage(firestoreId) { /* ... (V2.0 जैसा) ... */
    if (!detailsModal_CustPage || !firestoreId) { console.error("V2.1: Modal element or Order ID missing."); alert("Cannot open order details."); return; }
    console.log(`V2.1: Opening details modal for order: ${firestoreId}`);
    // Reset state
    modalOrderIdInput_CustPage.value = firestoreId; modalDisplayOrderIdSpan_CustPage.textContent = 'Loading...'; modalCustomerNameSpan_CustPage.textContent = 'Loading...'; modalCustomerWhatsAppSpan_CustPage.textContent = ''; modalProductListContainer_CustPage.innerHTML = '<p>Loading...</p>'; modalStatusHistoryListContainer_CustPage.innerHTML = '<p>Loading history...</p>'; modalOrderStatusSelect_CustPage.value = ''; modalUpdateStatusBtn_CustPage.disabled = true; modalDeleteBtn_CustPage.disabled = true; modalEditFullBtn_CustPage.disabled = true;
    detailsModal_CustPage.classList.add('active');
    try {
        const orderRef = doc(db, "orders", firestoreId); const orderSnap = await getDoc(orderRef);
        if (orderSnap.exists()) {
            const orderData = { id: orderSnap.id, ...orderSnap.data() }; console.log("V2.1: Fetched order data for modal:", orderData);
            populateOrderModal_CustPage(orderData); // Populate fields
            modalUpdateStatusBtn_CustPage.disabled = false; modalDeleteBtn_CustPage.disabled = false; modalEditFullBtn_CustPage.disabled = false;
        } else { console.error(`V2.1: Order ${firestoreId} not found.`); alert("Order details not found."); closeDetailsModal_CustPage(); }
    } catch (error) { console.error(`V2.1: Error fetching order details:`, error); alert(`Error loading details: ${error.message}`); closeDetailsModal_CustPage(); }
}
function populateOrderModal_CustPage(orderData) { /* ... (V2.0 जैसा) ... */
    if (!orderData) return;
    modalDisplayOrderIdSpan_CustPage.textContent = orderData.orderId || `(Sys: ${orderData.id.substring(0, 6)}...)`;
    modalCustomerNameSpan_CustPage.textContent = currentCustomerData?.fullName || orderData.customerDetails?.fullName || 'N/A';
    modalCustomerWhatsAppSpan_CustPage.textContent = currentCustomerData?.whatsappNo || orderData.customerDetails?.whatsappNo || 'N/A';
    modalOrderStatusSelect_CustPage.value = orderData.status || orderData.currentStatus || '';
    modalProductListContainer_CustPage.innerHTML = '';
    const products = orderData.products; if (Array.isArray(products) && products.length > 0) { const ul = document.createElement('ul'); ul.style.cssText = 'list-style:none;padding:0;margin:0;'; products.forEach(p => { const li = document.createElement('li'); li.style.cssText = 'margin-bottom:5px;padding-bottom:5px;border-bottom:1px dotted #eee;'; const nameSpan = document.createElement('span'); nameSpan.textContent = p.name || 'Unnamed'; nameSpan.style.fontWeight = '600'; const qtySpan = document.createElement('span'); qtySpan.textContent = ` - Qty: ${p.quantity || '?'}`; qtySpan.style.cssText='font-size:0.9em;color:#555;'; li.append(nameSpan, qtySpan); ul.appendChild(li); }); if(ul.lastChild) ul.lastChild.style.borderBottom = 'none'; modalProductListContainer_CustPage.appendChild(ul); } else { modalProductListContainer_CustPage.innerHTML = '<p class="no-products">No products listed.</p>'; }
    modalStatusHistoryListContainer_CustPage.innerHTML = '';
    const history = orderData.statusHistory; if (Array.isArray(history) && history.length > 0) { const sortedHistory = [...history].sort((a, b) => (b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0) - (a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0)); const ul = document.createElement('ul'); ul.style.cssText='list-style:none;padding:0;margin:0;max-height:150px;overflow-y:auto;'; sortedHistory.forEach(entry => { const li = document.createElement('li'); li.style.cssText='display:flex;justify-content:space-between;font-size:0.9em;padding:3px 0;border-bottom:1px dotted #eee;'; const statusSpan = document.createElement('span'); statusSpan.className = 'history-status'; statusSpan.textContent = entry.status || '?'; statusSpan.style.fontWeight = '500'; const timeSpan = document.createElement('span'); timeSpan.className = 'history-time'; timeSpan.textContent = entry.timestamp?.toDate ? formatDateTime(entry.timestamp.toDate()) : '?'; li.append(statusSpan, timeSpan); ul.appendChild(li); }); if(ul.lastChild) ul.lastChild.style.borderBottom = 'none'; modalStatusHistoryListContainer_CustPage.appendChild(ul); } else { modalStatusHistoryListContainer_CustPage.innerHTML = '<p class="no-history">No status history.</p>'; }
}
function closeDetailsModal_CustPage() { /* ... (V2.0 जैसा) ... */
    if (detailsModal_CustPage) { detailsModal_CustPage.classList.remove('active'); }
}
async function handleUpdateStatus_CustPage() { /* ... (V2.0 जैसा, सिर्फ कंसोल मैसेज बदले) ... */
    const firestoreId=modalOrderIdInput_CustPage.value;const newStatus=modalOrderStatusSelect_CustPage.value;if(!firestoreId||!newStatus||!updateDoc||!doc||!Timestamp||!arrayUnion){alert("Error: Cannot update status.");return;}const button=modalUpdateStatusBtn_CustPage;button.disabled=true;const originalHTML=button.innerHTML;button.innerHTML='<i class="fas fa-spinner fa-spin"></i> Updating...';const historyEntry={status:newStatus,timestamp:Timestamp.now()};try{await updateDoc(doc(db,"orders",firestoreId),{status:newStatus,currentStatus:newStatus,updatedAt:historyEntry.timestamp,statusHistory:arrayUnion(historyEntry)});console.log("V2.1: Status updated for order:",firestoreId);alert("Status updated!");const orderSnap=await getDoc(doc(db,"orders",firestoreId));if(orderSnap.exists()){populateOrderModal_CustPage({id:orderSnap.id,...orderSnap.data()});}await loadOrderHistory(currentCustomerId);}catch(e){console.error("V2.1: Error updating status:",e);alert("Error updating status: "+e.message);}finally{button.disabled=false;button.innerHTML=originalHTML;}
}
async function handleDeleteFromModal_CustPage() { /* ... (V2.0 जैसा, सिर्फ कंसोल मैसेज बदले) ... */
    const firestoreId=modalOrderIdInput_CustPage.value;const displayId=modalDisplayOrderIdSpan_CustPage.textContent;if(!firestoreId)return;if(confirm(`Are you sure you want to delete Order ID: ${displayId}? This action cannot be undone.`)){closeDetailsModal_CustPage();await deleteSingleOrder_CustPage(firestoreId);}else{console.log("V2.1: Deletion cancelled.");}
}
async function deleteSingleOrder_CustPage(firestoreId) { /* ... (V2.0 जैसा, सिर्फ कंसोल मैसेज बदले) ... */
    if(!db||!doc||!deleteDoc){alert("Delete unavailable.");return;}console.log(`V2.1: Attempting delete order: ${firestoreId}`);try{await deleteDoc(doc(db,"orders",firestoreId));console.log("V2.1: Order deleted:",firestoreId);alert("Order deleted.");await loadOrderHistory(currentCustomerId);}catch(e){console.error("V2.1: Error deleting order:",e);alert("Error deleting order: "+e.message);}
}
function handleEditFullFromModal_CustPage() { /* ... (V2.0 जैसा, सिर्फ कंसोल मैसेज बदले) ... */
    const firestoreId=modalOrderIdInput_CustPage.value;if(firestoreId){console.log(`V2.1: Navigating to edit page for order ID: ${firestoreId}`);window.location.href=`new_order.html?editOrderId=${firestoreId}`;}
}


// --- >>> नए फंक्शन और इवेंट लिस्टनर्स (फेज 4) <<< ---

// --- Add Payment Modal Logic ---
function openAddPaymentModal() {
    if (!addPaymentModal) { console.error("Add Payment Modal not found"); return; }
    if (!currentCustomerData) { alert("Customer data not loaded yet."); return; }

    console.log("V2.1: Opening Add Payment modal.");
    addPaymentForm.reset(); // Clear previous entries
    // Set customer name in modal title
    if (paymentModalCustNameSpan) {
        paymentModalCustNameSpan.textContent = currentCustomerData.fullName || 'Selected Customer';
    }
    // Set current date as default
    if (paymentDateInput) {
        paymentDateInput.valueAsDate = new Date();
    }
    savePaymentBtn.disabled = false;
    savePaymentBtn.innerHTML = '<i class="fas fa-save"></i> Save Payment';
    addPaymentModal.classList.add('active');
}

function closeAddPaymentModal() {
    if (addPaymentModal) addPaymentModal.classList.remove('active');
}

async function handleSavePayment(event) {
    event.preventDefault();
    if (!addDoc || !collection || !Timestamp) { alert("DB function missing (add payment)"); return; }
    if (!currentCustomerId) { alert("Customer ID is missing."); return; }

    const amount = parseFloat(paymentAmountInput.value);
    const date = paymentDateInput.value; // YYYY-MM-DD string
    const method = paymentMethodSelect.value;
    const notes = paymentNotesInput.value.trim();

    // Validation
    if (isNaN(amount) || amount <= 0) { alert("Please enter a valid positive amount."); return; }
    if (!date) { alert("Please select a payment date."); return; }

    savePaymentBtn.disabled = true;
    const originalHTML = savePaymentBtn.innerHTML;
    savePaymentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const paymentDateTimestamp = Timestamp.fromDate(new Date(date + 'T00:00:00')); // Store date as Timestamp (start of day)

        const paymentData = {
            customerId: currentCustomerId,
            amountPaid: amount,
            paymentDate: paymentDateTimestamp,
            paymentMethod: method,
            notes: notes || null, // Store null if empty
            createdAt: Timestamp.now()
        };

        const docRef = await addDoc(collection(db, "payments"), paymentData);
        console.log("V2.1: Payment added successfully with ID:", docRef.id);
        alert("Payment added successfully!");
        closeAddPaymentModal();

        // Refresh payment list and summary
        const paidAmount = await loadPaymentHistory(currentCustomerId);
        updateAccountSummary(); // Update summary with new total paid

    } catch (error) {
        console.error("V2.1: Error saving payment:", error);
        alert(`Error saving payment: ${error.message}`);
    } finally {
        savePaymentBtn.disabled = false;
        savePaymentBtn.innerHTML = originalHTML;
    }
}

// --- Edit Customer Modal Logic (Adapted from customer_management.js) ---
function openEditCustomerModal_CustPage() {
    if (!customerEditModal || !customerEditForm) { console.error("Edit Customer Modal not found."); return; }
    if (!currentCustomerData || !currentCustomerId) { alert("Customer data not loaded."); return; }

    console.log("V2.1: Opening Edit Customer modal.");
    customerEditModalTitle.textContent = `Edit Customer: ${currentCustomerData.fullName}`;
    editCustPageCustomerIdInput.value = currentCustomerId; // Set hidden ID

    // Populate form fields
    customerEditFullNameInput.value = currentCustomerData.fullName || '';
    customerEditWhatsAppInput.value = currentCustomerData.whatsappNo || '';
    customerEditContactInput.value = currentCustomerData.contactNo || '';
    customerEditAddressInput.value = currentCustomerData.billingAddress || currentCustomerData.address || '';
    customerEditEmailInput.value = currentCustomerData.email || '';
    customerEditCityInput.value = currentCustomerData.city || '';
    customerEditStateInput.value = currentCustomerData.state || '';
    customerEditNotesInput.value = currentCustomerData.notes || '';

    // Credit fields
    const isCreditAllowed = currentCustomerData.creditAllowed === true;
    creditEditYesRadio.checked = isCreditAllowed;
    creditEditNoRadio.checked = !isCreditAllowed;
    customerEditCreditLimitInput.value = currentCustomerData.creditLimit || '';
    creditLimitEditGroup.style.display = isCreditAllowed ? 'block' : 'none';

    saveCustomerEditBtn.disabled = false;
    saveCustomerEditBtn.querySelector('span').textContent = 'Update Customer';
    customerEditModal.classList.add('active');
}

function closeEditCustomerModal_CustPage() {
    if (customerEditModal) customerEditModal.classList.remove('active');
}

// Listener for radio buttons to show/hide credit limit
if (creditEditYesRadio && creditEditNoRadio) {
    creditEditYesRadio.addEventListener('change', () => { if(creditLimitEditGroup) creditLimitEditGroup.style.display = 'block'; });
    creditEditNoRadio.addEventListener('change', () => { if(creditLimitEditGroup) creditLimitEditGroup.style.display = 'none'; });
}

async function handleUpdateCustomer_CustPage(event) {
    event.preventDefault();
    if (!updateDoc || !doc || !Timestamp) { alert("DB function missing (update customer)"); return; }
    const customerIdToUpdate = editCustPageCustomerIdInput.value;
    if (!customerIdToUpdate) { alert("Cannot update, customer ID missing."); return; }

    // Get updated values
    const fullName = customerEditFullNameInput.value.trim();
    const whatsappNo = customerEditWhatsAppInput.value.trim();
    const contactNo = customerEditContactInput.value.trim() || null;
    const address = customerEditAddressInput.value.trim() || null;
    const email = customerEditEmailInput.value.trim() || null;
    const city = customerEditCityInput.value.trim() || null;
    const state = customerEditStateInput.value.trim() || null;
    const notes = customerEditNotesInput.value.trim() || null;
    const creditAllowed = creditEditYesRadio.checked;
    const creditLimit = creditAllowed ? parseFloat(customerEditCreditLimitInput.value) || 0 : null;

    if (!fullName || !whatsappNo) { alert("Full Name and WhatsApp are required."); return; }

    const button = saveCustomerEditBtn;
    button.disabled = true; const originalHTML = button.innerHTML; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

    const updateData = {
        fullName, whatsappNo, contactNo, billingAddress: address, email, city, state, notes,
        creditAllowed, creditLimit,
        updatedAt: Timestamp.now()
    };
    // Remove null fields if Firestore rules require fields to exist or be non-null
    Object.keys(updateData).forEach(key => (updateData[key] === null || updateData[key] === undefined) && delete updateData[key]);


    try {
        const customerRef = doc(db, "customers", customerIdToUpdate);
        await updateDoc(customerRef, updateData);
        console.log("V2.1: Customer details updated.");
        alert("Customer details updated successfully!");
        closeEditCustomerModal_CustPage();
        await loadCustomerDetails(customerIdToUpdate); // Refresh details on the page

    } catch (error) {
        console.error("V2.1: Error updating customer:", error);
        alert(`Error updating customer: ${error.message}`);
    } finally {
        button.disabled = false; button.innerHTML = originalHTML;
    }
}


// --- Toggle Account Status Logic ---
async function handleToggleAccountStatus() {
    if (!updateDoc || !doc || !Timestamp) { alert("DB function missing (toggle status)"); return; }
    if (!currentCustomerId || !currentCustomerData) { alert("Customer data not loaded."); return; }

    const currentStatus = currentCustomerData.status || 'active';
    const newStatus = (currentStatus === 'active') ? 'inactive' : 'active';
    const actionText = (newStatus === 'active') ? 'enable' : 'disable';

    if (!confirm(`Are you sure you want to ${actionText} this customer account?`)) {
        return; // User cancelled
    }

    const button = toggleStatusBtn; // Reference to the button
    button.disabled = true;
    const originalContent = button.innerHTML; // Store original content
    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Changing...`;

    try {
        const customerRef = doc(db, "customers", currentCustomerId);
        await updateDoc(customerRef, {
            status: newStatus,
            updatedAt: Timestamp.now()
        });
        console.log(`V2.1: Customer status changed to ${newStatus}.`);
        alert(`Customer account ${actionText}d successfully.`);

        // Update UI immediately (or reload details)
        currentCustomerData.status = newStatus; // Update local cache
        const statusEl = document.getElementById('cust-detail-status');
        const toggleStatusBtnSpan = button.querySelector('span');
        if (statusEl) {
            statusEl.textContent = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
            statusEl.className = 'status-badge';
            statusEl.classList.add(`status-${newStatus.toLowerCase()}`);
        }
         if(toggleStatusBtnSpan) {
             toggleStatusBtnSpan.textContent = (newStatus === 'active') ? 'Disable Account' : 'Enable Account';
              button.querySelector('i').className = (newStatus === 'active') ? 'fas fa-toggle-on' : 'fas fa-toggle-off';
         }
        // Optionally: await loadCustomerDetails(currentCustomerId); // To ensure consistency

    } catch (error) {
        console.error("V2.1: Error toggling account status:", error);
        alert(`Error changing status: ${error.message}`);
    } finally {
        button.disabled = false;
        button.innerHTML = originalContent; // Restore original content
    }
}


// --- Delete Customer Logic ---
async function handleDeleteCustomer_CustPage() {
    if (!deleteDoc || !doc) { alert("DB function missing (delete customer)"); return; }
    if (!currentCustomerId || !currentCustomerData) { alert("Customer data not loaded."); return; }

    const customerName = currentCustomerData.fullName || `ID: ${currentCustomerData.customCustomerId || currentCustomerId}`;

    // Stronger confirmation
    if (!confirm(`ARE YOU ABSOLUTELY SURE?\n\nThis will permanently delete customer "${customerName}".\nAssociated orders and payments WILL NOT be deleted automatically.\n\nThis action cannot be undone.`)) {
        return; // User cancelled
    }
     // Second confirmation
     if (!confirm(`FINAL CONFIRMATION:\nDelete customer "${customerName}" permanently?`)) {
        return; // User cancelled again
     }


    console.log(`V2.1: Attempting to delete customer ${currentCustomerId}`);
    const button = deleteCustomerBtn;
    button.disabled = true;
    const originalHTML = button.innerHTML;
    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Deleting...`;

    try {
        await deleteDoc(doc(db, "customers", currentCustomerId));
        console.log("V2.1: Customer deleted successfully.");
        alert(`Customer "${customerName}" deleted successfully.`);
        // Redirect back to the customer list page
        window.location.href = 'customer_management.html';

    } catch (error) {
        console.error("V2.1: Error deleting customer:", error);
        alert(`Error deleting customer: ${error.message}`);
        button.disabled = false;
        button.innerHTML = originalHTML;
    }
}

// --- Placeholder for deleting a payment ---
async function handleDeletePayment_CustPage(paymentId) {
     if (!deleteDoc || !doc) { alert("DB function missing (delete payment)"); return; }
     if (!paymentId) return;

     if (confirm(`Are you sure you want to delete this payment record?`)) {
         console.log(`V2.1: Attempting to delete payment ${paymentId}`);
         try {
             await deleteDoc(doc(db, "payments", paymentId));
             console.log("V2.1: Payment deleted.");
             alert("Payment record deleted.");
             // Refresh payment list and summary
             const paidAmount = await loadPaymentHistory(currentCustomerId);
             updateAccountSummary();
         } catch (error) {
              console.error("V2.1: Error deleting payment:", error);
              alert(`Error deleting payment: ${error.message}`);
         }
     }
}


/** Displays an error message */
function displayError(message) { /* ... (V2.0 जैसा) ... */
    console.error("V2.1: ERROR - ", message); alert(message); const nameHeaderEl = document.getElementById('cust-detail-name-header'); const nameBreadcrumbEl = document.getElementById('cust-detail-name-breadcrumb'); if(nameHeaderEl) nameHeaderEl.textContent = "Error"; if(nameBreadcrumbEl) nameBreadcrumbEl.textContent = "Error"; document.title = "Error Loading Customer";
}

/** Sets up event listeners for elements loaded with the page */
function setupStaticEventListeners() {
     console.log("V2.1: Setting up static event listeners...");
     // Order Modal Listeners
     if (closeModalBtn_CustPage) closeModalBtn_CustPage.addEventListener('click', closeDetailsModal_CustPage);
     if (detailsModal_CustPage) detailsModal_CustPage.addEventListener('click', (event) => { if (event.target === detailsModal_CustPage) closeDetailsModal_CustPage(); });
     if (modalUpdateStatusBtn_CustPage) modalUpdateStatusBtn_CustPage.addEventListener('click', handleUpdateStatus_CustPage);
     if (modalDeleteBtn_CustPage) modalDeleteBtn_CustPage.addEventListener('click', handleDeleteFromModal_CustPage);
     if (modalEditFullBtn_CustPage) modalEditFullBtn_CustPage.addEventListener('click', handleEditFullFromModal_CustPage);

     // Add Payment Modal Listeners
     if (addPaymentBtn) addPaymentBtn.addEventListener('click', openAddPaymentModal);
     if (closePaymentModalBtn) closePaymentModalBtn.addEventListener('click', closeAddPaymentModal);
     if (cancelPaymentBtn) cancelPaymentBtn.addEventListener('click', closeAddPaymentModal);
     if (addPaymentModal) addPaymentModal.addEventListener('click', (event) => { if (event.target === addPaymentModal) closeAddPaymentModal(); });
     if (addPaymentForm) addPaymentForm.addEventListener('submit', handleSavePayment);

     // Edit Customer Modal Listeners
     if (editCustomerBtn) editCustomerBtn.addEventListener('click', openEditCustomerModal_CustPage);
     if (closeCustomerEditModalBtn) closeCustomerEditModalBtn.addEventListener('click', closeEditCustomerModal_CustPage);
     if (cancelCustomerEditBtn) cancelCustomerEditBtn.addEventListener('click', closeEditCustomerModal_CustPage);
     if (customerEditModal) customerEditModal.addEventListener('click', (event) => { if (event.target === customerEditModal) closeEditCustomerModal_CustPage(); });
     if (customerEditForm) customerEditForm.addEventListener('submit', handleUpdateCustomer_CustPage);

     // Other Main Page Button Listeners
     if (toggleStatusBtn) toggleStatusBtn.addEventListener('click', handleToggleAccountStatus);
     if (deleteCustomerBtn) deleteCustomerBtn.addEventListener('click', handleDeleteCustomer_CustPage);

     console.log("V2.1: Static listeners attached.");
}


/** Main function to initialize the page */
window.initializeCustomerDetailPage = async function(user) {
    console.log("V2.1: Initializing customer detail page...");
    currentCustomerId = getCustomerIdFromUrl();
    if (!currentCustomerId) { displayError("Customer ID missing."); return; }
    console.log(`V2.1: Customer ID: ${currentCustomerId}`);

    setupStaticEventListeners(); // Setup listeners for buttons/modals

    const customerLoaded = await loadCustomerDetails(currentCustomerId);
    if (!customerLoaded) return;

    await loadOrderHistory(currentCustomerId);
    await loadPaymentHistory(currentCustomerId);

    updateAccountSummary(); // Initial summary calculation

    console.log("V2.1: Page initialized successfully.");
}

console.log("customer_account_detail.js (V2.1) loaded.");