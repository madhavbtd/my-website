// js/customer_account_detail.js (Version 2.2 - Confirmation Modals & Design Prep)

// --- Firebase Functions ---
const {
    db, doc, getDoc, collection, query, where, getDocs, orderBy: firestoreOrderBy,
    updateDoc, deleteDoc, Timestamp, arrayUnion, addDoc
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
const editCustPageCustomerIdInput = document.getElementById('editCustPageCustomerId');
const customerEditFullNameInput = document.getElementById('customerEditFullName');
const customerEditWhatsAppInput = document.getElementById('customerEditWhatsApp');
// ... (other edit form inputs) ...
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


// --- DOM References (Order Details Modal) ---
const detailsModal_CustPage = document.getElementById('detailsModal');
const modalOrderIdInput_CustPage = document.getElementById('modalOrderId');
const closeModalBtn_CustPage = document.getElementById('closeDetailsModal');
// ... (other order modal elements) ...
const modalDisplayOrderIdSpan_CustPage = document.getElementById('modalDisplayOrderId');
const modalCustomerNameSpan_CustPage = document.getElementById('modalCustomerName');
const modalCustomerWhatsAppSpan_CustPage = document.getElementById('modalCustomerWhatsApp');
const modalOrderStatusSelect_CustPage = document.getElementById('modalOrderStatus');
const modalUpdateStatusBtn_CustPage = document.getElementById('modalUpdateStatusBtn');
const modalDeleteBtn_CustPage = document.getElementById('modalDeleteBtn');
const modalEditFullBtn_CustPage = document.getElementById('modalEditFullBtn');
const modalProductListContainer_CustPage = document.getElementById('modalProductList');
const modalStatusHistoryListContainer_CustPage = document.getElementById('modalStatusHistoryList');


// --- >>> नए कन्फर्मेशन पॉपअप के एलिमेंट्स <<< ---
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
// --- >>> एलिमेंट्स समाप्त <<< ---


// --- Helper Functions ---
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { unsafe = String(unsafe || ''); } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function formatDate(dateObj) { if (!dateObj || typeof dateObj.toLocaleDateString !== 'function') return 'N/A'; return dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function formatDateTime(dateObj) { if (!dateObj || typeof dateObj.toLocaleDateString !== 'function') return '?'; return dateObj.toLocaleDateString('en-GB',{day:'numeric',month:'short'}) + ' ' + dateObj.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}); }
function formatCurrency(amount) { const num = Number(amount || 0); return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

// --- Core Page Logic ---
function getCustomerIdFromUrl() { const params = new URLSearchParams(window.location.search); return params.get('id'); }

async function loadCustomerDetails(customerId) { /* ... (V2.1 जैसा) ... */
     console.log(`V2.2: Loading details for customer: ${customerId}`);
     currentCustomerData = null; if (!db || !doc || !getDoc) { displayError("DB function missing (details)."); return false; }
     const nameHeaderEl=document.getElementById('cust-detail-name-header'),nameBreadcrumbEl=document.getElementById('cust-detail-name-breadcrumb'),idEl=document.getElementById('cust-detail-id'),whatsappEl=document.getElementById('cust-detail-whatsapp'),contactEl=document.getElementById('cust-detail-contact'),emailEl=document.getElementById('cust-detail-email'),addressEl=document.getElementById('cust-detail-address'),cityEl=document.getElementById('cust-detail-city'),stateEl=document.getElementById('cust-detail-state'),statusEl=document.getElementById('cust-detail-status'),creditAllowedEl=document.getElementById('cust-detail-credit-allowed'),creditLimitEl=document.getElementById('cust-detail-credit-limit'),notesEl=document.getElementById('cust-detail-notes'),toggleStatusBtn=document.getElementById('toggleStatusBtn'),toggleStatusBtnSpan=toggleStatusBtn?toggleStatusBtn.querySelector('span'):null,addNewOrderLink=document.getElementById('addNewOrderLink'),editCustomerBtn=document.getElementById('editCustomerBtn'),addPaymentBtn=document.getElementById('addPaymentBtn'),deleteCustomerBtn=document.getElementById('deleteCustomerBtn');
     if (nameHeaderEl) nameHeaderEl.textContent = "Loading..."; if (nameBreadcrumbEl) nameBreadcrumbEl.textContent = "Loading...";
     try {
         const customerRef = doc(db, "customers", customerId); const customerSnap = await getDoc(customerRef);
         if (customerSnap.exists()) {
             currentCustomerData = customerSnap.data(); console.log("V2.2: Customer data fetched:", currentCustomerData);
             const customerName=currentCustomerData.fullName||'N/A';if(nameHeaderEl)nameHeaderEl.textContent=customerName;if(nameBreadcrumbEl)nameBreadcrumbEl.textContent=customerName;document.title=`Customer Account - ${customerName}`;if(idEl)idEl.textContent=currentCustomerData.customCustomerId||'N/A';if(whatsappEl)whatsappEl.textContent=currentCustomerData.whatsappNo||'-';if(contactEl)contactEl.textContent=currentCustomerData.contactNo||'-';if(emailEl)emailEl.textContent=currentCustomerData.email||'-';if(addressEl)addressEl.textContent=(currentCustomerData.billingAddress||currentCustomerData.address||'-');if(cityEl)cityEl.textContent=currentCustomerData.city||'-';if(stateEl)stateEl.textContent=currentCustomerData.state||'-';const status=currentCustomerData.status||'active';if(statusEl){statusEl.textContent=status.charAt(0).toUpperCase()+status.slice(1);statusEl.className='status-badge';statusEl.classList.add(`status-${status.toLowerCase()}`);}if(toggleStatusBtnSpan){toggleStatusBtnSpan.textContent=(status==='active')?'Disable Account':'Enable Account';if(toggleStatusBtn)toggleStatusBtn.querySelector('i').className=(status==='active')?'fas fa-toggle-on':'fas fa-toggle-off';}const creditAllowed=currentCustomerData.creditAllowed===true;if(creditAllowedEl)creditAllowedEl.textContent=creditAllowed?'Yes':'No';if(creditLimitEl)creditLimitEl.textContent=creditAllowed?formatCurrency(currentCustomerData.creditLimit):'N/A';if(notesEl)notesEl.textContent=currentCustomerData.notes||'No remarks.';if(editCustomerBtn)editCustomerBtn.disabled=false;if(addPaymentBtn)addPaymentBtn.disabled=false;if(toggleStatusBtn)toggleStatusBtn.disabled=false;if(deleteCustomerBtn)deleteCustomerBtn.disabled=false;if(addNewOrderLink){addNewOrderLink.href=`new_order.html?customerId=<span class="math-inline">\{encodeURIComponent\(customerId\)\}&customerName\=</span>{encodeURIComponent(customerName)}`;addNewOrderLink.classList.remove('disabled');}
             console.log("V2.2: Customer details displayed."); return true;
         } else { displayError("Customer not found."); return false; }
     } catch (error) { displayError(`Error loading details: ${error.message}`); return false; }
 }
async function loadOrderHistory(customerId) { /* ... (V2.1 जैसा) ... */
    console.log(`V2.2: Loading order history for customer: ${customerId}`);
    const orderTableBody = document.getElementById('customerOrderTableBody');
    const summaryTotalOrdersEl = document.getElementById('summary-total-orders');
    currentTotalOrderValue = 'N/A';
    if (!orderTableBody || !summaryTotalOrdersEl) { console.error("V2.2: Order table elements missing."); return; }
    if (!collection || !query || !where || !getDocs || !firestoreOrderBy ) { displayError("DB function missing (orders)."); orderTableBody.innerHTML = `<tr><td colspan="4">Error</td></tr>`; summaryTotalOrdersEl.textContent = "Error"; return; }
    orderTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Loading orders...</td></tr>`;
    summaryTotalOrdersEl.textContent = "N/A"; document.getElementById('summary-balance').textContent = "N/A";
    const newOrderTableBody = orderTableBody.cloneNode(false); orderTableBody.parentNode.replaceChild(newOrderTableBody, orderTableBody);
    try {
        const ordersRef = collection(db, "orders"); const q = query(ordersRef, where("customerId", "==", customerId), firestoreOrderBy("createdAt", "desc")); const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) { newOrderTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">No orders found.</td></tr>`; }
        else {
            querySnapshot.forEach(doc => { /* ... (row creation logic as in V2.1) ... */
                const order=doc.data();const displayOrderId=order.customOrderId||`(sys) ${doc.id.substring(0,6)}...`;const firestoreOrderId=doc.id;const orderDate=order.createdAt?.toDate?formatDate(order.createdAt.toDate()):'N/A';const status=order.currentStatus||'Unknown';let productsHtml='N/A';if(order.products&&Array.isArray(order.products)){productsHtml=order.products.map(p=>`<span class="math-inline">\{escapeHtml\(p\.name\|\|'?'\)\} \(</span>{escapeHtml(p.quantity||'?')})`).join('<br>');}const row=newOrderTableBody.insertRow();row.setAttribute('data-order-id',firestoreOrderId);row.classList.add('order-row-clickable');row.innerHTML=`<td><span class="math-inline">\{escapeHtml\(displayOrderId\)\}</td\><td\></span>{orderDate}</td><td><span class="math-inline">\{productsHtml\}</td\><td\><span class\="status\-badge status\-</span>{status.toLowerCase().replace(/\s+/g,'-')}">${escapeHtml(status)}</span></td>`;
             });
            newOrderTableBody.addEventListener('click', (event) => { const clickedRow = event.target.closest('tr.order-row-clickable'); if (clickedRow && clickedRow.dataset.orderId) { openOrderDetailsModal_CustPage(clickedRow.dataset.orderId); } });
         } console.log(`V2.2: Order history loaded.`);
    } catch (error) { console.error("V2.2: Error loading order history:", error); displayError(`Error loading orders: ${error.message}`); newOrderTableBody.innerHTML = `<tr><td colspan="4">Error</td></tr>`; summaryTotalOrdersEl.textContent = "Error"; }
}
async function loadPaymentHistory(customerId) { /* ... (V2.1 जैसा) ... */
    console.log(`V2.2: Loading payment history for customer: ${customerId}`);
    const paymentTableBody = document.getElementById('customerPaymentTableBody'); let totalPaid = 0;
    if (!paymentTableBody) { console.error("V2.2: Payment table body missing."); return 0; }
    if (!collection || !query || !where || !getDocs || !firestoreOrderBy ) { displayError("DB function missing (payments)."); paymentTableBody.innerHTML = `<tr><td colspan="5">Error</td></tr>`; return 0; }
    paymentTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Loading payments...</td></tr>`;
    const newPaymentTableBody = paymentTableBody.cloneNode(false); paymentTableBody.parentNode.replaceChild(newPaymentTableBody, paymentTableBody);
    try {
        const paymentsRef = collection(db, "payments"); const q = query(paymentsRef, where("customerId", "==", customerId), firestoreOrderBy("paymentDate", "desc")); const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) { newPaymentTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No payments recorded.</td></tr>`; }
         else {
             querySnapshot.forEach(doc => { /* ... (row creation logic as in V2.1) ... */
                 const payment=doc.data();const paymentId=doc.id;const paymentDate=payment.paymentDate?.toDate?formatDate(payment.paymentDate.toDate()):'N/A';const amountPaid=Number(payment.amountPaid||0);const method=payment.paymentMethod||'-';const notes=payment.notes||'-';totalPaid+=amountPaid;const row=newPaymentTableBody.insertRow();row.innerHTML=`<td><span class="math-inline">\{paymentDate\}</td\><td\></span>{formatCurrency(amountPaid)}</td><td><span class="math-inline">\{escapeHtml\(method\)\}</td\><td\></span>{escapeHtml(notes)}</td><td><button class="button danger-button delete-payment-btn" data-payment-id="${paymentId}" title="Delete Payment" style="padding:3px 6px;font-size:0.9em;"><i class="fas fa-trash-alt"></i></button></td>`;
              });
              newPaymentTableBody.addEventListener('click', (event) => { const deleteButton = event.target.closest('button.delete-payment-btn'); if (deleteButton && deleteButton.dataset.paymentId) { handleDeletePayment_CustPage(deleteButton.dataset.paymentId); } });
          }
        console.log(`V2.2: Payment history loaded. Total Paid: ${totalPaid}`); currentTotalPaidAmount = totalPaid; return totalPaid;
    } catch (error) { if(error.code==='failed-precondition'){displayError(`Error loading payments: Index required. Link: ${error.message.match(/https:\/\/[^\s]+/)?.[0]||'(See console)'}`);paymentTableBody.innerHTML=`<tr><td colspan="5">Error: Index required</td></tr>`;}else{displayError(`Error loading payments: ${error.message}`);paymentTableBody.innerHTML=`<tr><td colspan="5">Error</td></tr>`;} return 0; }
}
function updateAccountSummary() { /* ... (V2.1 जैसा) ... */
    console.log(`V2.2: Updating account summary. Order Value: ${currentTotalOrderValue}, Paid Amount: ${currentTotalPaidAmount}`);const summaryTotalOrdersEl=document.getElementById('summary-total-orders');const summaryTotalPaidEl=document.getElementById('summary-total-paid');const summaryBalanceEl=document.getElementById('summary-balance');if(summaryTotalOrdersEl){summaryTotalOrdersEl.textContent=(currentTotalOrderValue==='N/A')?'N/A':formatCurrency(currentTotalOrderValue);}if(summaryTotalPaidEl){summaryTotalPaidEl.textContent=formatCurrency(currentTotalPaidAmount);}if(summaryBalanceEl){if(currentTotalOrderValue!=='N/A'){const balance=Number(currentTotalOrderValue)-Number(currentTotalPaidAmount);summaryBalanceEl.textContent=formatCurrency(balance);summaryBalanceEl.className=balance<0?'balance-credit':'balance-due';}else{summaryBalanceEl.textContent=`(Paid: ${formatCurrency(currentTotalPaidAmount)})`;summaryBalanceEl.className='balance-info';}}
}

// --- Order Details Modal Functions ---
async function openOrderDetailsModal_CustPage(firestoreId) { /* ... (V2.1 जैसा) ... */
     if(!detailsModal_CustPage||!firestoreId){console.error("V2.2: Modal/Order ID missing.");alert("Cannot open details.");return;}console.log(`V2.2: Opening order modal: ${firestoreId}`);modalOrderIdInput_CustPage.value=firestoreId;modalDisplayOrderIdSpan_CustPage.textContent='Loading...';modalCustomerNameSpan_CustPage.textContent='Loading...';modalCustomerWhatsAppSpan_CustPage.textContent='';modalProductListContainer_CustPage.innerHTML='<p>Loading...</p>';modalStatusHistoryListContainer_CustPage.innerHTML='<p>Loading...</p>';modalOrderStatusSelect_CustPage.value='';modalUpdateStatusBtn_CustPage.disabled=true;modalDeleteBtn_CustPage.disabled=true;modalEditFullBtn_CustPage.disabled=true;detailsModal_CustPage.classList.add('active');try{const orderRef=doc(db,"orders",firestoreId);const orderSnap=await getDoc(orderRef);if(orderSnap.exists()){const orderData={id:orderSnap.id,...orderSnap.data()};console.log("V2.2: Fetched order data:",orderData);populateOrderModal_CustPage(orderData);modalUpdateStatusBtn_CustPage.disabled=false;modalDeleteBtn_CustPage.disabled=false;modalEditFullBtn_CustPage.disabled=false;}else{alert("Order details not found.");closeDetailsModal_CustPage();}}catch(error){alert(`Error loading order details: ${error.message}`);closeDetailsModal_CustPage();}
 }
function populateOrderModal_CustPage(orderData) { /* ... (V2.1 जैसा) ... */
    if (!orderData) return; modalDisplayOrderIdSpan_CustPage.textContent = orderData.orderId || `(Sys: ${orderData.id.substring(0, 6)}...)`; modalCustomerNameSpan_CustPage.textContent = currentCustomerData?.fullName || orderData.customerDetails?.fullName || 'N/A'; modalCustomerWhatsAppSpan_CustPage.textContent = currentCustomerData?.whatsappNo || orderData.customerDetails?.whatsappNo || 'N/A'; modalOrderStatusSelect_CustPage.value = orderData.status || orderData.currentStatus || ''; modalProductListContainer_CustPage.innerHTML = ''; const products = orderData.products; if (Array.isArray(products) && products.length > 0) { const ul = document.createElement('ul'); ul.style.cssText = 'list-style:none;padding:0;margin:0;'; products.forEach(p => { const li = document.createElement('li'); li.style.cssText = 'margin-bottom:5px;padding-bottom:5px;border-bottom:1px dotted #eee;'; const nameSpan = document.createElement('span'); nameSpan.textContent = p.name || 'Unnamed'; nameSpan.style.fontWeight = '600'; const qtySpan = document.createElement('span'); qtySpan.textContent = ` - Qty: ${p.quantity || '?'}`; qtySpan.style.cssText='font-size:0.9em;color:#555;'; li.append(nameSpan, qtySpan); ul.appendChild(li); }); if(ul.lastChild) ul.lastChild.style.borderBottom = 'none'; modalProductListContainer_CustPage.appendChild(ul); } else { modalProductListContainer_CustPage.innerHTML = '<p class="no-products">No products listed.</p>'; } modalStatusHistoryListContainer_CustPage.innerHTML = ''; const history = orderData.statusHistory; if (Array.isArray(history) && history.length > 0) { const sortedHistory = [...history].sort((a, b) => (b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0) - (a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0)); const ul = document.createElement('ul'); ul.style.cssText='list-style:none;padding:0;margin:0;max-height:150px;overflow-y:auto;'; sortedHistory.forEach(entry => { const li = document.createElement('li'); li.style.cssText='display:flex;justify-content:space-between;font-size:0.9em;padding:3px 0;border-bottom:1px dotted #eee;'; const statusSpan = document.createElement('span'); statusSpan.className = 'history-status'; statusSpan.textContent = entry.status || '?'; statusSpan.style.fontWeight = '500'; const timeSpan = document.createElement('span'); timeSpan.className = 'history-time'; timeSpan.textContent = entry.timestamp?.toDate ? formatDateTime(entry.timestamp.toDate()) : '?'; li.append(statusSpan, timeSpan); ul.appendChild(li); }); if(ul.lastChild) ul.lastChild.style.borderBottom = 'none'; modalStatusHistoryListContainer_CustPage.appendChild(ul); } else { modalStatusHistoryListContainer_CustPage.innerHTML = '<p class="no-history">No status history.</p>'; }
}
function closeDetailsModal_CustPage() { /* ... (V2.1 जैसा) ... */ if (detailsModal_CustPage) { detailsModal_CustPage.classList.remove('active'); } }
async function handleUpdateStatus_CustPage() { /* ... (V2.1 जैसा) ... */ const firestoreId=modalOrderIdInput_CustPage.value;const newStatus=modalOrderStatusSelect_CustPage.value;if(!firestoreId||!newStatus||!updateDoc||!doc||!Timestamp||!arrayUnion){alert("Error: Cannot update status.");return;}const button=modalUpdateStatusBtn_CustPage;button.disabled=true;const originalHTML=button.innerHTML;button.innerHTML='<i class="fas fa-spinner fa-spin"></i> Updating...';const historyEntry={status:newStatus,timestamp:Timestamp.now()};try{await updateDoc(doc(db,"orders",firestoreId),{status:newStatus,currentStatus:newStatus,updatedAt:historyEntry.timestamp,statusHistory:arrayUnion(historyEntry)});console.log("V2.2: Status updated:",firestoreId);alert("Status updated!");const orderSnap=await getDoc(doc(db,"orders",firestoreId));if(orderSnap.exists()){populateOrderModal_CustPage({id:orderSnap.id,...orderSnap.data()});}await loadOrderHistory(currentCustomerId);}catch(e){console.error("V2.2: Error updating status:",e);alert("Error updating status: "+e.message);}finally{button.disabled=false;button.innerHTML=originalHTML;} }
async function handleDeleteFromModal_CustPage() { /* ... (V2.1 जैसा) ... */ const firestoreId=modalOrderIdInput_CustPage.value;const displayId=modalDisplayOrderIdSpan_CustPage.textContent;if(!firestoreId)return;if(confirm(`Delete Order ID: ${displayId}?`)){closeDetailsModal_CustPage();await deleteSingleOrder_CustPage(firestoreId);}else{console.log("V2.2: Deletion cancelled.");} }
async function deleteSingleOrder_CustPage(firestoreId) { /* ... (V2.1 जैसा) ... */ if(!db||!doc||!deleteDoc){alert("Delete unavailable.");return;}console.log(`V2.2: Deleting order: ${firestoreId}`);try{await deleteDoc(doc(db,"orders",firestoreId));console.log("V2.2: Order deleted:",firestoreId);alert("Order deleted.");await loadOrderHistory(currentCustomerId);}catch(e){console.error("V2.2: Error deleting order:",e);alert("Error: "+e.message);} }
function handleEditFullFromModal_CustPage() { /* ... (V2.1 जैसा) ... */ const firestoreId=modalOrderIdInput_CustPage.value;if(firestoreId){console.log(`V2.2: Edit order: ${firestoreId}`);window.location.href=`new_order.html?editOrderId=${firestoreId}`;} }

// --- Add Payment Modal Functions ---
function openAddPaymentModal() { /* ... (V2.1 जैसा) ... */ if(!addPaymentModal||!currentCustomerData){alert("Cannot open add payment modal.");return;}console.log("V2.2: Opening Add Payment modal.");addPaymentForm.reset();if(paymentModalCustNameSpan){paymentModalCustNameSpan.textContent=currentCustomerData.fullName||'';}if(paymentDateInput){paymentDateInput.valueAsDate=new Date();}savePaymentBtn.disabled=false;savePaymentBtn.innerHTML='<i class="fas fa-save"></i> Save Payment';addPaymentModal.classList.add('active');}
function closeAddPaymentModal() { /* ... (V2.1 जैसा) ... */ if (addPaymentModal) addPaymentModal.classList.remove('active');}
async function handleSavePayment(event) { /* ... (V2.1 जैसा) ... */ event.preventDefault();if(!addDoc||!collection||!Timestamp||!currentCustomerId){alert("DB function missing or Customer ID missing.");return;}const amount=parseFloat(paymentAmountInput.value);const date=paymentDateInput.value;const method=paymentMethodSelect.value;const notes=paymentNotesInput.value.trim();if(isNaN(amount)||amount<=0){alert("Please enter a valid positive amount.");return;}if(!date){alert("Please select a payment date.");return;}savePaymentBtn.disabled=true;const originalHTML=savePaymentBtn.innerHTML;savePaymentBtn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Saving...';try{const paymentDateTimestamp=Timestamp.fromDate(new Date(date+'T00:00:00'));const paymentData={customerId:currentCustomerId,amountPaid:amount,paymentDate:paymentDateTimestamp,paymentMethod:method,notes:notes||null,createdAt:Timestamp.now()};const docRef=await addDoc(collection(db,"payments"),paymentData);console.log("V2.2: Payment added:",docRef.id);alert("Payment added successfully!");closeAddPaymentModal();const paidAmount=await loadPaymentHistory(currentCustomerId);updateAccountSummary();}catch(error){console.error("V2.2: Error saving payment:",error);alert(`Error saving payment: ${error.message}`);}finally{savePaymentBtn.disabled=false;savePaymentBtn.innerHTML=originalHTML;}}

// --- Edit Customer Modal Functions ---
function openEditCustomerModal_CustPage() { /* ... (V2.1 जैसा) ... */ if(!customerEditModal||!customerEditForm||!currentCustomerData||!currentCustomerId){alert("Cannot open edit customer modal.");return;}console.log("V2.2: Opening Edit Customer modal.");customerEditModalTitle.textContent=`Edit Customer: ${currentCustomerData.fullName||''}`;editCustPageCustomerIdInput.value=currentCustomerId;customerEditFullNameInput.value=currentCustomerData.fullName||'';customerEditWhatsAppInput.value=currentCustomerData.whatsappNo||'';customerEditContactInput.value=currentCustomerData.contactNo||'';customerEditAddressInput.value=currentCustomerData.billingAddress||currentCustomerData.address||'';customerEditEmailInput.value=currentCustomerData.email||'';customerEditCityInput.value=currentCustomerData.city||'';customerEditStateInput.value=currentCustomerData.state||'';customerEditNotesInput.value=currentCustomerData.notes||'';const isCreditAllowed=currentCustomerData.creditAllowed===true;creditEditYesRadio.checked=isCreditAllowed;creditEditNoRadio.checked=!isCreditAllowed;customerEditCreditLimitInput.value=currentCustomerData.creditLimit||'';creditLimitEditGroup.style.display=isCreditAllowed?'block':'none';saveCustomerEditBtn.disabled=false;saveCustomerEditBtn.querySelector('span').textContent='Update Customer';customerEditModal.classList.add('active');}
function closeEditCustomerModal_CustPage() { /* ... (V2.1 जैसा) ... */ if (customerEditModal) customerEditModal.classList.remove('active');}
async function handleUpdateCustomer_CustPage(event) { /* ... (V2.1 जैसा) ... */ event.preventDefault();if(!updateDoc||!doc||!Timestamp){alert("DB function missing (update customer)");return;}const customerIdToUpdate=editCustPageCustomerIdInput.value;if(!customerIdToUpdate){alert("Customer ID missing.");return;}const fullName=customerEditFullNameInput.value.trim();const whatsappNo=customerEditWhatsAppInput.value.trim();if(!fullName||!whatsappNo){alert("Full Name and WhatsApp are required.");return;}const contactNo=customerEditContactInput.value.trim()||null;const address=customerEditAddressInput.value.trim()||null;const email=customerEditEmailInput.value.trim()||null;const city=customerEditCityInput.value.trim()||null;const state=customerEditStateInput.value.trim()||null;const notes=customerEditNotesInput.value.trim()||null;const creditAllowed=creditEditYesRadio.checked;const creditLimit=creditAllowed?parseFloat(customerEditCreditLimitInput.value)||0:null;const button=saveCustomerEditBtn;button.disabled=true;const originalHTML=button.innerHTML;button.innerHTML='<i class="fas fa-spinner fa-spin"></i> Updating...';const updateData={fullName,whatsappNo,contactNo,billingAddress:address,email,city,state,notes,creditAllowed,creditLimit,updatedAt:Timestamp.now()};Object.keys(updateData).forEach(key=>(updateData[key]===null||updateData[key]===undefined)&&delete updateData[key]);try{const customerRef=doc(db,"customers",customerIdToUpdate);await updateDoc(customerRef,updateData);console.log("V2.2: Customer details updated.");alert("Customer details updated successfully!");closeEditCustomerModal_CustPage();await loadCustomerDetails(customerIdToUpdate);}catch(error){console.error("V2.2: Error updating customer:",error);alert(`Error updating customer: ${error.message}`);}finally{button.disabled=false;button.innerHTML=originalHTML;}}


// --- >>> Delete Payment Logic <<< ---
async function handleDeletePayment_CustPage(paymentId) {
    if (!deleteDoc || !doc) { alert("DB function missing (delete payment)"); return; }
    if (!paymentId) return;
    if (confirm(`Are you sure you want to delete this payment record?`)) {
        console.log(`V2.2: Attempting to delete payment ${paymentId}`);
        try {
            await deleteDoc(doc(db, "payments", paymentId));
            console.log("V2.2: Payment deleted."); alert("Payment record deleted.");
            // Refresh payment list and summary
            await loadPaymentHistory(currentCustomerId);
            updateAccountSummary(); // Recalculate summary
        } catch (error) { console.error("V2.2: Error deleting payment:", error); alert(`Error deleting payment: ${error.message}`); }
    }
}

// --- >>> Confirmation Modal Logic (NEW in V2.2) <<< ---

// --- Toggle Account Status ---
function handleToggleAccountStatus() {
    if (!currentCustomerId || !currentCustomerData) { alert("Customer data not loaded."); return; }
    const currentStatus = currentCustomerData.status || 'active';
    const isDisabling = currentStatus === 'active'; // Action is to disable
    const actionText = isDisabling ? 'disable' : 'enable';
    const newStatus = isDisabling ? 'inactive' : 'active';

    if (isDisabling) { // Show confirmation modal only for disabling
        openConfirmToggleModal(actionText, newStatus);
    } else { // Directly enable if currently inactive (no confirmation needed?)
        // Or always show modal - let's always show for consistency
         openConfirmToggleModal(actionText, newStatus);
        // Alternatively, call executeToggleStatus directly for enabling:
        // if (confirm(`Are you sure you want to enable this account?`)) {
        //     executeToggleStatus(newStatus);
        // }
    }
}

function openConfirmToggleModal(action, newStatus) {
    if (!confirmToggleStatusModal || !toggleActionTextSpan || !toggleCustNameSpan || !confirmToggleCheckbox || !confirmToggleBtn || !toggleWarningMessage || !toggleCheckboxLabel || !confirmToggleBtnText) {
        console.error("Toggle status confirmation modal elements missing!"); return;
    }
    console.log(`V2.2: Opening confirm toggle modal. Action: ${action}, New Status: ${newStatus}`);

    // Populate modal text
    toggleActionTextSpan.textContent = action;
    toggleCustNameSpan.textContent = currentCustomerData?.fullName || 'this customer';
    toggleWarningMessage.style.display = (action === 'disable') ? 'block' : 'none'; // Show warning only when disabling
    toggleCheckboxLabel.textContent = `I understand and want to ${action} this account.`;
    confirmToggleBtnText.textContent = action.charAt(0).toUpperCase() + action.slice(1) + ' Account'; // e.g., "Disable Account"

    // Set button style and icon based on action
     const icon = confirmToggleBtn.querySelector('i');
     confirmToggleBtn.className = `button ${action === 'disable' ? 'secondary-button' : 'success-button'}`; // Grey for disable, Green for enable
     if(icon) icon.className = `fas ${action === 'disable' ? 'fa-toggle-off' : 'fa-toggle-on'}`;


    // Reset checkbox and button state
    confirmToggleCheckbox.checked = false;
    confirmToggleBtn.disabled = true;

    // Store the new status to be set on confirmation
    confirmToggleBtn.dataset.newStatus = newStatus;

    confirmToggleStatusModal.classList.add('active');
}

function closeConfirmToggleModal() {
    if (confirmToggleStatusModal) confirmToggleStatusModal.classList.remove('active');
}

// Handles checkbox change for toggle modal
if (confirmToggleCheckbox && confirmToggleBtn) {
    confirmToggleCheckbox.addEventListener('change', () => {
        confirmToggleBtn.disabled = !confirmToggleCheckbox.checked;
    });
}

// Handles confirm button click for toggle modal
if (confirmToggleBtn) {
     confirmToggleBtn.addEventListener('click', () => {
        const newStatus = confirmToggleBtn.dataset.newStatus;
        if (confirmToggleCheckbox.checked && newStatus) {
             executeToggleStatus(newStatus);
        }
     });
}

async function executeToggleStatus(newStatus) {
    if (!updateDoc || !doc || !Timestamp || !currentCustomerId) { alert("DB function missing (toggle status)"); return; }

    const button = confirmToggleBtn; // Confirmation modal button
    button.disabled = true; const originalHTML = button.innerHTML; button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;

    try {
        const customerRef = doc(db, "customers", currentCustomerId);
        await updateDoc(customerRef, { status: newStatus, updatedAt: Timestamp.now() });
        console.log(`V2.2: Customer status changed to ${newStatus}.`);
        alert(`Customer account status changed to ${newStatus}.`);
        closeConfirmToggleModal(); // Close confirmation modal
        await loadCustomerDetails(currentCustomerId); // Refresh details on page
    } catch (error) {
        console.error("V2.2: Error toggling account status:", error); alert(`Error changing status: ${error.message}`);
    } finally { button.disabled = false; button.innerHTML = originalHTML; }
}


// --- Delete Customer Confirmation ---
function handleDeleteCustomer_CustPage() { // Renamed to avoid conflict maybe? No, original was fine.
    if (!currentCustomerId || !currentCustomerData) { alert("Customer data not loaded."); return; }
    openConfirmDeleteModal(); // Open confirmation modal first
}

function openConfirmDeleteModal() {
     if (!confirmDeleteModal || !deleteCustNameSpan || !confirmDeleteCheckboxModal || !confirmDeleteBtn) {
        console.error("Delete confirmation modal elements missing!"); return;
     }
     console.log("V2.2: Opening delete confirmation modal.");
     deleteCustNameSpan.textContent = currentCustomerData?.fullName || 'this customer';
     confirmDeleteCheckboxModal.checked = false;
     confirmDeleteBtn.disabled = true;
     confirmDeleteModal.classList.add('active');
}

function closeConfirmDeleteModal() {
     if (confirmDeleteModal) confirmDeleteModal.classList.remove('active');
}

 // Handles checkbox change for delete modal
if (confirmDeleteCheckboxModal && confirmDeleteBtn) {
    confirmDeleteCheckboxModal.addEventListener('change', () => {
        confirmDeleteBtn.disabled = !confirmDeleteCheckboxModal.checked;
    });
}

// Handles confirm button click for delete modal
if (confirmDeleteBtn) {
     confirmDeleteBtn.addEventListener('click', () => {
         if (confirmDeleteCheckboxModal.checked) {
             executeDeleteCustomer();
         }
     });
}

async function executeDeleteCustomer() {
    if (!deleteDoc || !doc || !currentCustomerId) { alert("DB function missing (delete customer)"); return; }

    const customerName = currentCustomerData?.fullName || `ID: ${currentCustomerId}`;
    console.log(`V2.2: Executing delete for customer ${currentCustomerId}`);

    const button = confirmDeleteBtn; // Confirmation modal button
    button.disabled = true; const originalHTML = button.innerHTML; button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Deleting...`;

    try {
        await deleteDoc(doc(db, "customers", currentCustomerId));
        console.log("V2.2: Customer deleted successfully.");
        alert(`Customer "${customerName}" deleted successfully.`);
        closeConfirmDeleteModal(); // Close the confirmation modal
        window.location.href = 'customer_management.html'; // Redirect back to list
    } catch (error) {
        console.error("V2.2: Error deleting customer:", error); alert(`Error deleting customer: ${error.message}`);
        button.disabled = false; button.innerHTML = originalHTML; // Re-enable button on error
    }
}


/** Sets up event listeners for elements loaded with the page */
function setupStaticEventListeners() {
     console.log("V2.2: Setting up static event listeners...");
     // Order Modal
     if (closeModalBtn_CustPage) closeModalBtn_CustPage.addEventListener('click', closeDetailsModal_CustPage);
     if (detailsModal_CustPage) detailsModal_CustPage.addEventListener('click', (event) => { if (event.target === detailsModal_CustPage) closeDetailsModal_CustPage(); });
     if (modalUpdateStatusBtn_CustPage) modalUpdateStatusBtn_CustPage.addEventListener('click', handleUpdateStatus_CustPage);
     if (modalDeleteBtn_CustPage) modalDeleteBtn_CustPage.addEventListener('click', handleDeleteFromModal_CustPage);
     if (modalEditFullBtn_CustPage) modalEditFullBtn_CustPage.addEventListener('click', handleEditFullFromModal_CustPage);

     // Add Payment Modal
     if (addPaymentBtn) addPaymentBtn.addEventListener('click', openAddPaymentModal);
     if (closePaymentModalBtn) closePaymentModalBtn.addEventListener('click', closeAddPaymentModal);
     if (cancelPaymentBtn) cancelPaymentBtn.addEventListener('click', closeAddPaymentModal);
     if (addPaymentModal) addPaymentModal.addEventListener('click', (event) => { if (event.target === addPaymentModal) closeAddPaymentModal(); });
     if (addPaymentForm) addPaymentForm.addEventListener('submit', handleSavePayment);

     // Edit Customer Modal
     if (editCustomerBtn) editCustomerBtn.addEventListener('click', openEditCustomerModal_CustPage);
     if (closeCustomerEditModalBtn) closeCustomerEditModalBtn.addEventListener('click', closeEditCustomerModal_CustPage);
     if (cancelCustomerEditBtn) cancelCustomerEditBtn.addEventListener('click', closeEditCustomerModal_CustPage);
     if (customerEditModal) customerEditModal.addEventListener('click', (event) => { if (event.target === customerEditModal) closeEditCustomerModal_CustPage(); });
     if (customerEditForm) customerEditForm.addEventListener('submit', handleUpdateCustomer_CustPage);
     if (creditEditYesRadio && creditEditNoRadio) { // Listener for credit limit show/hide
        creditEditYesRadio.addEventListener('change', () => { if(creditLimitEditGroup) creditLimitEditGroup.style.display = 'block'; });
        creditEditNoRadio.addEventListener('change', () => { if(creditLimitEditGroup) creditLimitEditGroup.style.display = 'none'; });
    }

     // Main Page Buttons (triggering confirmation modals or direct actions)
     if (toggleStatusBtn) toggleStatusBtn.addEventListener('click', handleToggleAccountStatus); // Opens confirm modal now
     if (deleteCustomerBtn) deleteCustomerBtn.addEventListener('click', handleDeleteCustomer_CustPage); // Opens confirm modal now

     // Confirmation Modals
     if (closeConfirmToggleModalBtn) closeConfirmToggleModalBtn.addEventListener('click', closeConfirmToggleModal);
     if (cancelToggleBtn) cancelToggleBtn.addEventListener('click', closeConfirmToggleModal);
     if (confirmToggleStatusModal) confirmToggleStatusModal.addEventListener('click', (e) => { if (e.target === confirmToggleStatusModal) closeConfirmToggleModal(); });
     // Checkbox and Confirm button listeners for Toggle Modal are setup when modal opens/globally if elements exist

     if (closeConfirmDeleteModalBtn) closeConfirmDeleteModalBtn.addEventListener('click', closeConfirmDeleteModal);
     if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeConfirmDeleteModal);
     if (confirmDeleteModal) confirmDeleteModal.addEventListener('click', (e) => { if (e.target === confirmDeleteModal) closeConfirmDeleteModal(); });
     // Checkbox and Confirm button listeners for Delete Modal are setup globally if elements exist


     console.log("V2.2: Static listeners attached.");
}


/** Main function to initialize the page */
window.initializeCustomerDetailPage = async function(user) {
    console.log("V2.2: Initializing customer detail page...");
    currentCustomerId = getCustomerIdFromUrl();
    if (!currentCustomerId) { displayError("Customer ID missing."); return; }
    console.log(`V2.2: Customer ID: ${currentCustomerId}`);

    setupStaticEventListeners(); // Setup listeners for ALL buttons/modals

    const customerLoaded = await loadCustomerDetails(currentCustomerId);
    if (!customerLoaded) return;

    await loadOrderHistory(currentCustomerId);
    const paidAmount = await loadPaymentHistory(currentCustomerId);

    updateAccountSummary(); // Initial summary calculation

    console.log("V2.2: Page initialized successfully. All base features implemented.");
}

console.log("customer_account_detail.js (V2.2) loaded.");