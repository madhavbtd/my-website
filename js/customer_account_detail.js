// js/customer_account_detail.js (Version 2.0 - Integrated Order Details Modal)

// --- Firebase Functions (Globally available from HTML script block) ---
const {
    db, doc, getDoc, collection, query, where, getDocs, orderBy: firestoreOrderBy, // Renamed orderBy
    updateDoc, deleteDoc, Timestamp, arrayUnion // Needed for Modal actions
} = window;

// --- Global State ---
let currentCustomerId = null;
let currentCustomerData = null; // Stores fetched customer data for reuse
let currentTotalOrderValue = 'N/A'; // Stores calculated order value ('N/A' if amount missing)

// --- DOM Element References (Main Page) ---
// (Add references as needed)

// --- DOM Element References (Copied Order Detail Modal) ---
// We get these inside functions or setup listeners later to ensure they exist
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
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') { unsafe = String(unsafe || ''); }
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatDate(dateObj) {
    if (!dateObj || typeof dateObj.toLocaleDateString !== 'function') return 'N/A';
    return dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dateObj) {
     if (!dateObj || typeof dateObj.toLocaleDateString !== 'function') return '?';
     return dateObj.toLocaleDateString('en-GB',{day:'numeric',month:'short'}) + ' ' + dateObj.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});
}

function formatCurrency(amount) {
    const num = Number(amount || 0);
    return `₹${num.toLocaleString('en-IN')}`;
}

// --- Core Page Logic ---

/** Reads the customer ID from the URL query parameter (?id=...) */
function getCustomerIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

/** Fetches customer data from Firestore and updates the main page elements. */
async function loadCustomerDetails(customerId) {
    console.log(`V2.0: Loading details for customer: ${customerId}`);
    currentCustomerData = null; // Reset previous data
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

    if (nameHeaderEl) nameHeaderEl.textContent = "Loading...";
    if (nameBreadcrumbEl) nameBreadcrumbEl.textContent = "Loading...";

    try {
        const customerRef = doc(db, "customers", customerId);
        const customerSnap = await getDoc(customerRef);

        if (customerSnap.exists()) {
            currentCustomerData = customerSnap.data(); // Store fetched data globally
            console.log("V2.0: Customer data fetched:", currentCustomerData);

            const customerName = currentCustomerData.fullName || 'N/A';
            if(nameHeaderEl) nameHeaderEl.textContent = customerName;
            if(nameBreadcrumbEl) nameBreadcrumbEl.textContent = customerName;
            document.title = `Customer Account - ${customerName}`;

            if(idEl) idEl.textContent = currentCustomerData.customCustomerId || 'N/A';
            if(whatsappEl) whatsappEl.textContent = currentCustomerData.whatsappNo || '-';
            if(contactEl) contactEl.textContent = currentCustomerData.contactNo || '-';
            if(emailEl) emailEl.textContent = currentCustomerData.email || '-';
            if(addressEl) addressEl.textContent = (currentCustomerData.billingAddress || currentCustomerData.address || '-');
            if(cityEl) cityEl.textContent = currentCustomerData.city || '-';
            if(stateEl) stateEl.textContent = currentCustomerData.state || '-';

            const status = currentCustomerData.status || 'active';
            if (statusEl) {
                statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
                statusEl.className = 'status-badge';
                statusEl.classList.add(`status-${status.toLowerCase()}`);
            }
            if(toggleStatusBtnSpan) {
                toggleStatusBtnSpan.textContent = (status === 'active') ? 'Disable Account' : 'Enable Account';
                 if(toggleStatusBtn) toggleStatusBtn.querySelector('i').className = (status === 'active') ? 'fas fa-toggle-on' : 'fas fa-toggle-off';
            }

            const creditAllowed = currentCustomerData.creditAllowed === true;
            if(creditAllowedEl) creditAllowedEl.textContent = creditAllowed ? 'Yes' : 'No';
            if(creditLimitEl) creditLimitEl.textContent = creditAllowed ? formatCurrency(currentCustomerData.creditLimit) : 'N/A';

            if(notesEl) notesEl.textContent = currentCustomerData.notes || 'No remarks.';

             if(editCustomerBtn) editCustomerBtn.disabled = false;
             if(addPaymentBtn) addPaymentBtn.disabled = false;
             if(toggleStatusBtn) toggleStatusBtn.disabled = false;
             if(deleteCustomerBtn) deleteCustomerBtn.disabled = false;

             if(addNewOrderLink) {
                 addNewOrderLink.href = `new_order.html?customerId=${encodeURIComponent(customerId)}&customerName=${encodeURIComponent(customerName)}`;
                 addNewOrderLink.classList.remove('disabled');
             }

            console.log("V2.0: Customer details displayed.");
            return true; // Success

        } else {
            console.error(`V2.0: Customer document with ID ${customerId} does not exist.`);
            displayError("Customer not found.");
            return false; // Failure
        }
    } catch (error) {
        console.error("V2.0: Error loading customer details:", error);
        displayError(`Error loading details: ${error.message}`);
        return false; // Failure
    }
}

/**
 * Fetches and displays the order history, making rows clickable to open the modal.
 * (Version 2.0 - Row Click Opens Modal / No Amount)
 */
async function loadOrderHistory(customerId) {
    console.log(`V2.0: Loading order history for customer: ${customerId} (Row click opens modal)`);
    const orderTableBody = document.getElementById('customerOrderTableBody');
    const summaryTotalOrdersEl = document.getElementById('summary-total-orders');
    currentTotalOrderValue = 'N/A'; // Reset/confirm as N/A

    if (!orderTableBody || !summaryTotalOrdersEl) { console.error("V2.0: Order table elements missing."); return; }
    if (!collection || !query || !where || !getDocs || !firestoreOrderBy ) {
         displayError("DB function missing (orders).");
         orderTableBody.innerHTML = `<tr><td colspan="4">Error</td></tr>`; // Colspan 4
         summaryTotalOrdersEl.textContent = "Error"; return;
    }

    orderTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Loading orders...</td></tr>`; // Colspan 4
    summaryTotalOrdersEl.textContent = "N/A";
    document.getElementById('summary-balance').textContent = "N/A";

    try {
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef, where("customerId", "==", customerId), firestoreOrderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        orderTableBody.innerHTML = ''; // Clear

        if (querySnapshot.empty) {
            orderTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">No orders found.</td></tr>`; // Colspan 4
        } else {
            querySnapshot.forEach(doc => {
                const order = doc.data();
                const displayOrderId = order.customOrderId || `(sys) ${doc.id.substring(0,6)}...`; // Show custom or part of Firestore ID
                const firestoreOrderId = doc.id;
                const orderDate = order.createdAt?.toDate ? formatDate(order.createdAt.toDate()) : 'N/A';
                const status = order.currentStatus || 'Unknown';
                let productsHtml = 'N/A';
                if (order.products && Array.isArray(order.products)) {
                   productsHtml = order.products.map(p => `${escapeHtml(p.name || '?')} (${escapeHtml(p.quantity || '?')})`).join('<br>');
                }

                const row = document.createElement('tr');
                row.setAttribute('data-order-id', firestoreOrderId); // Store ID on row
                row.classList.add('order-row-clickable'); // Add class for styling and listener

                // HTML structure without Amount and Action columns
                row.innerHTML = `
                    <td>${escapeHtml(displayOrderId)}</td>
                    <td>${orderDate}</td>
                    <td>${productsHtml}</td> {/* Already escaped in loop */}
                    <td><span class="status-badge status-${status.toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(status)}</span></td>
                `;
                orderTableBody.appendChild(row);
            });

             // --- >>> यहाँ बदलाव किया गया है <<< ---
             // Add ONE event listener to the table body (Event Delegation)
             orderTableBody.addEventListener('click', (event) => {
                 const clickedRow = event.target.closest('tr.order-row-clickable'); // Find the closest clickable row
                 if (clickedRow && clickedRow.dataset.orderId) {
                     const orderId = clickedRow.dataset.orderId;
                     console.log(`V2.0: Order row clicked, opening modal for: ${orderId}`);
                     openOrderDetailsModal_CustPage(orderId); // Call the function to open the modal
                 }
             });
             // --- >>> बदलाव समाप्त <<< ---

        }
        console.log(`V2.0: Order history loaded.`);
    } catch (error) {
        console.error("V2.0: Error loading order history:", error);
        displayError(`Error loading orders: ${error.message}`);
        orderTableBody.innerHTML = `<tr><td colspan="4">Error</td></tr>`; // Colspan 4
        summaryTotalOrdersEl.textContent = "Error";
    }
}

/**
 * Fetches and displays the payment history.
 * (Version 1.2 logic - included in V2.0)
 */
async function loadPaymentHistory(customerId) {
    console.log(`V2.0: Loading payment history for customer: ${customerId}`);
    const paymentTableBody = document.getElementById('customerPaymentTableBody');
    let totalPaidAmount = 0;

    if (!paymentTableBody) { console.error("V2.0: Payment table body not found."); return 0; }
     if (!collection || !query || !where || !getDocs || !firestoreOrderBy ) {
          displayError("DB function missing (payments).");
          paymentTableBody.innerHTML = `<tr><td colspan="5">Error</td></tr>`; return 0;
     }

    paymentTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Loading payments...</td></tr>`;

    try {
        const paymentsRef = collection(db, "payments");
        const q = query(paymentsRef, where("customerId", "==", customerId), firestoreOrderBy("paymentDate", "desc"));
        const querySnapshot = await getDocs(q);
        paymentTableBody.innerHTML = ''; // Clear

        if (querySnapshot.empty) {
            paymentTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No payments recorded.</td></tr>`;
        } else {
            querySnapshot.forEach(doc => {
                const payment = doc.data();
                const paymentId = doc.id;
                const paymentDate = payment.paymentDate?.toDate ? formatDate(payment.paymentDate.toDate()) : 'N/A';
                const amountPaid = Number(payment.amountPaid || 0);
                const method = payment.paymentMethod || '-';
                const notes = payment.notes || '-';

                totalPaidAmount += amountPaid;

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${paymentDate}</td>
                    <td>${formatCurrency(amountPaid)}</td>
                    <td>${escapeHtml(method)}</td>
                    <td>${escapeHtml(notes)}</td>
                    <td>
                        <button class="button danger-button delete-payment-btn" data-payment-id="${paymentId}" title="Delete Payment">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                `;
                paymentTableBody.appendChild(row);
            });

             // Add event listeners for delete payment buttons (placeholder action)
              paymentTableBody.querySelectorAll('.delete-payment-btn').forEach(btn => {
                  btn.addEventListener('click', (e) => {
                      e.stopPropagation();
                      const paymentIdToDelete = btn.getAttribute('data-payment-id');
                      handleDeletePayment(paymentIdToDelete);
                  });
              });
        }
        console.log(`V2.0: Payment history loaded. Total Paid: ${totalPaidAmount}`);
        return totalPaidAmount; // Return total

    } catch (error) {
        // Handle index error for payments query
        if (error.code === 'failed-precondition') {
           console.error("V2.0: Firestore index required for payments query:", error);
           const indexLink = error.message.match(/https:\/\/[^\s]+/);
           displayError(`Error loading payments: Firestore index required. Please create it using the link in the console or here: ${indexLink ? indexLink[0] : '(Link not found)'}`);
           paymentTableBody.innerHTML = `<tr><td colspan="5" class="text-danger" style="text-align: center;">Error: Index required. See console.</td></tr>`;
        } else {
           console.error("V2.0: Error loading payment history:", error);
           displayError(`Error loading payments: ${error.message}`);
           paymentTableBody.innerHTML = `<tr><td colspan="5" class="text-danger" style="text-align: center;">Error loading payments.</td></tr>`;
        }
        return 0; // Return 0 on error
    }
}

/** Updates the account summary section based on loaded data. */
function updateAccountSummary(totalOrderValue, totalPaidAmount) {
    console.log(`V2.0: Updating account summary. Order Value: ${totalOrderValue}, Paid Amount: ${totalPaidAmount}`);
    const summaryTotalOrdersEl = document.getElementById('summary-total-orders');
    const summaryTotalPaidEl = document.getElementById('summary-total-paid');
    const summaryBalanceEl = document.getElementById('summary-balance');

    if(summaryTotalOrdersEl) {
        summaryTotalOrdersEl.textContent = (totalOrderValue === 'N/A') ? 'N/A' : formatCurrency(totalOrderValue);
    }
    if(summaryTotalPaidEl) {
        summaryTotalPaidEl.textContent = formatCurrency(totalPaidAmount);
    }

    if (summaryBalanceEl) {
         if (totalOrderValue !== 'N/A') {
             const balance = Number(totalOrderValue) - Number(totalPaidAmount);
             summaryBalanceEl.textContent = formatCurrency(balance);
             summaryBalanceEl.className = balance < 0 ? 'balance-credit' : 'balance-due';
         } else {
             summaryBalanceEl.textContent = `(Paid: ${formatCurrency(totalPaidAmount)})`;
             summaryBalanceEl.className = 'balance-info';
         }
    }
}


// --- >>> Functions Adapted/Copied from order_history.js <<< ---
// These functions control the #detailsModal

/**
 * Opens and populates the Order Details Modal. Fetches fresh order data.
 * (Adapted from order_history.js)
 * @param {string} firestoreId - The Firestore document ID of the order.
 */
async function openOrderDetailsModal_CustPage(firestoreId) {
    // Ensure modal elements exist (check moved here)
    if (!detailsModal_CustPage || !modalOrderIdInput_CustPage || !closeModalBtn_CustPage || !modalDisplayOrderIdSpan_CustPage || !modalCustomerNameSpan_CustPage || !modalCustomerWhatsAppSpan_CustPage || !modalOrderStatusSelect_CustPage || !modalUpdateStatusBtn_CustPage || !modalDeleteBtn_CustPage || !modalEditFullBtn_CustPage || !modalProductListContainer_CustPage || !modalStatusHistoryListContainer_CustPage) {
         console.error("V2.0: One or more essential modal elements are missing from HTML.");
         alert("Error: Cannot display order details popup. Required elements missing.");
         return;
     }
     if (!firestoreId) { console.error("V2.0: No order ID passed to openOrderDetailsModal_CustPage"); return; }
     console.log(`V2.0: Opening details modal for order: ${firestoreId}`);

    // Reset modal state
    modalOrderIdInput_CustPage.value = firestoreId;
    modalDisplayOrderIdSpan_CustPage.textContent = 'Loading...';
    modalCustomerNameSpan_CustPage.textContent = 'Loading...';
    modalCustomerWhatsAppSpan_CustPage.textContent = '';
    modalProductListContainer_CustPage.innerHTML = '<p>Loading...</p>';
    modalStatusHistoryListContainer_CustPage.innerHTML = '<p>Loading history...</p>';
    modalOrderStatusSelect_CustPage.value = '';
    modalUpdateStatusBtn_CustPage.disabled = true;
    modalDeleteBtn_CustPage.disabled = true;
    modalEditFullBtn_CustPage.disabled = true;

    detailsModal_CustPage.classList.add('active'); // Show modal

    try {
        const orderRef = doc(db, "orders", firestoreId);
        const orderSnap = await getDoc(orderRef);

        if (orderSnap.exists()) {
            const orderData = { id: orderSnap.id, ...orderSnap.data() };
            console.log("V2.0: Fetched order data for modal:", orderData);
            populateOrderModal_CustPage(orderData); // Populate fields

            // Enable buttons after data is loaded
            modalUpdateStatusBtn_CustPage.disabled = false;
            modalDeleteBtn_CustPage.disabled = false;
            modalEditFullBtn_CustPage.disabled = false;
        } else {
            console.error(`V2.0: Order document ${firestoreId} not found for modal.`);
            alert("Order details not found.");
            closeDetailsModal_CustPage();
        }
    } catch (error) {
        console.error(`V2.0: Error fetching order details for modal (ID: ${firestoreId}):`, error);
        alert(`Error loading order details: ${error.message}`);
        closeDetailsModal_CustPage();
    }
}

/** Populates the modal fields. (Adapted from order_history.js) */
function populateOrderModal_CustPage(orderData) {
    if (!orderData) return;

    modalDisplayOrderIdSpan_CustPage.textContent = orderData.orderId || `(Sys: ${orderData.id.substring(0, 6)}...)`;
    // Use current customer data if available, otherwise from order
    modalCustomerNameSpan_CustPage.textContent = currentCustomerData?.fullName || orderData.customerDetails?.fullName || 'N/A';
    modalCustomerWhatsAppSpan_CustPage.textContent = currentCustomerData?.whatsappNo || orderData.customerDetails?.whatsappNo || 'N/A';
    modalOrderStatusSelect_CustPage.value = orderData.status || orderData.currentStatus || '';

    // Populate Product List
    modalProductListContainer_CustPage.innerHTML = '';
    const products = orderData.products;
    if (Array.isArray(products) && products.length > 0) {
        const ul = document.createElement('ul'); ul.style.cssText = 'list-style:none;padding:0;margin:0;';
        products.forEach(p => {
            const li = document.createElement('li');
            li.style.cssText = 'margin-bottom:5px;padding-bottom:5px;border-bottom:1px dotted #eee;';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = p.name || 'Unnamed'; nameSpan.style.fontWeight = '600';
            const qtySpan = document.createElement('span');
            qtySpan.textContent = ` - Qty: ${p.quantity || '?'}`; qtySpan.style.cssText='font-size:0.9em;color:#555;';
            li.append(nameSpan, qtySpan); ul.appendChild(li);
        });
        if(ul.lastChild) ul.lastChild.style.borderBottom = 'none';
        modalProductListContainer_CustPage.appendChild(ul);
    } else { modalProductListContainer_CustPage.innerHTML = '<p class="no-products">No products listed.</p>'; }

    // Populate Status History
    modalStatusHistoryListContainer_CustPage.innerHTML = '';
    const history = orderData.statusHistory;
    if (Array.isArray(history) && history.length > 0) {
        const sortedHistory = [...history].sort((a, b) => (b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0) - (a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0));
        const ul = document.createElement('ul'); ul.style.cssText='list-style:none;padding:0;margin:0;max-height:150px;overflow-y:auto;';
        sortedHistory.forEach(entry => {
            const li = document.createElement('li');
            li.style.cssText='display:flex;justify-content:space-between;font-size:0.9em;padding:3px 0;border-bottom:1px dotted #eee;';
            const statusSpan = document.createElement('span');
            statusSpan.className = 'history-status'; statusSpan.textContent = entry.status || '?'; statusSpan.style.fontWeight = '500';
            const timeSpan = document.createElement('span');
            timeSpan.className = 'history-time'; timeSpan.style.color = '#777';
            timeSpan.textContent = entry.timestamp?.toDate ? formatDateTime(entry.timestamp.toDate()) : '?';
            li.append(statusSpan, timeSpan); ul.appendChild(li);
        });
         if(ul.lastChild) ul.lastChild.style.borderBottom = 'none';
        modalStatusHistoryListContainer_CustPage.appendChild(ul);
    } else { modalStatusHistoryListContainer_CustPage.innerHTML = '<p class="no-history">No status history.</p>'; }
}

/** Closes the Order Details Modal */
function closeDetailsModal_CustPage() {
    if (detailsModal_CustPage) { detailsModal_CustPage.classList.remove('active'); }
}

/** Handles the "Update Status" button click inside the modal */
async function handleUpdateStatus_CustPage() {
    const firestoreId = modalOrderIdInput_CustPage.value;
    const newStatus = modalOrderStatusSelect_CustPage.value;
    if (!firestoreId || !newStatus || !updateDoc || !doc || !Timestamp || !arrayUnion) { alert("Error: Cannot update status."); return; }

    // Optional: Check if status actually changed
    // const currentStatus = ... get current status if needed ...
    // if (currentStatus === newStatus) { alert("Status is already set to this value."); return; }

    const button = modalUpdateStatusBtn_CustPage;
    button.disabled = true; const originalHTML = button.innerHTML; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

    const historyEntry = { status: newStatus, timestamp: Timestamp.now() };

    try {
        await updateDoc(doc(db, "orders", firestoreId), {
            status: newStatus, currentStatus: newStatus, updatedAt: historyEntry.timestamp, statusHistory: arrayUnion(historyEntry)
        });
        console.log("V2.0: Status updated successfully for order:", firestoreId);
        alert("Status updated!");

        // Refresh UI
        const orderSnap = await getDoc(doc(db, "orders", firestoreId)); // Re-fetch updated data
        if(orderSnap.exists()) { populateOrderModal_CustPage({ id: orderSnap.id, ...orderSnap.data() }); } // Repopulate modal
        await loadOrderHistory(currentCustomerId); // Reload the table on the main page

    } catch (e) { console.error("V2.0: Error updating status:", e); alert("Error updating status: " + e.message);
    } finally { button.disabled = false; button.innerHTML = originalHTML; }
}

/** Handles the "Delete Order" button click from the modal */
async function handleDeleteFromModal_CustPage() {
    const firestoreId = modalOrderIdInput_CustPage.value;
    const displayId = modalDisplayOrderIdSpan_CustPage.textContent;
    if (!firestoreId) return;
    if (confirm(`Are you sure you want to delete Order ID: ${displayId}? This action cannot be undone.`)) {
        closeDetailsModal_CustPage(); // Close modal first
        await deleteSingleOrder_CustPage(firestoreId); // Call delete function
    } else { console.log("V2.0: Deletion cancelled."); }
}

/** Deletes a single order document */
async function deleteSingleOrder_CustPage(firestoreId) {
    if (!db || !doc || !deleteDoc) { alert("Delete function unavailable."); return; }
    console.log(`V2.0: Attempting to delete order: ${firestoreId}`);
    try {
        await deleteDoc(doc(db, "orders", firestoreId));
        console.log("V2.0: Order deleted:", firestoreId);
        alert("Order deleted successfully.");
        await loadOrderHistory(currentCustomerId); // Reload the table on the main page
    } catch (e) { console.error("V2.0: Error deleting order:", e); alert("Error deleting order: " + e.message); }
}

/** Handles the "Edit Full Order" button click from the modal */
function handleEditFullFromModal_CustPage() {
     const firestoreId = modalOrderIdInput_CustPage.value;
     if (firestoreId) {
         console.log(`V2.0: Navigating to edit order page for ID: ${firestoreId}`);
         // Navigate to new_order.html for editing
         window.location.href = `new_order.html?editOrderId=${firestoreId}`;
     }
}

/** Placeholder: Deletes a payment record. */
async function handleDeletePayment(paymentId) {
     console.log(`V2.0: Placeholder: Attempting to delete payment ${paymentId}`);
     alert(`Placeholder: Delete payment ${paymentId}. Implement in Phase 4.`);
}

/** Displays an error message on the page. */
function displayError(message) {
     console.error("V2.0: Displaying Error - ", message);
     alert(message);
     const nameHeaderEl = document.getElementById('cust-detail-name-header');
     const nameBreadcrumbEl = document.getElementById('cust-detail-name-breadcrumb');
     if(nameHeaderEl) nameHeaderEl.textContent = "Error";
     if(nameBreadcrumbEl) nameBreadcrumbEl.textContent = "Error";
     document.title = "Error Loading Customer";
}

/** Sets up event listeners for elements that exist on page load (like modal buttons) */
function setupStaticEventListeners() {
     if (closeModalBtn_CustPage) closeModalBtn_CustPage.addEventListener('click', closeDetailsModal_CustPage);
     if (detailsModal_CustPage) detailsModal_CustPage.addEventListener('click', (event) => { if (event.target === detailsModal_CustPage) closeDetailsModal_CustPage(); });
     if (modalUpdateStatusBtn_CustPage) modalUpdateStatusBtn_CustPage.addEventListener('click', handleUpdateStatus_CustPage);
     if (modalDeleteBtn_CustPage) modalDeleteBtn_CustPage.addEventListener('click', handleDeleteFromModal_CustPage);
     if (modalEditFullBtn_CustPage) modalEditFullBtn_CustPage.addEventListener('click', handleEditFullFromModal_CustPage);

     // Add listeners for main page buttons later in Phase 4
     // e.g., editCustomerBtn, addPaymentBtn, toggleStatusBtn, deleteCustomerBtn
}


/** Main function to initialize the page. */
window.initializeCustomerDetailPage = async function(user) {
    console.log("V2.0: Initializing customer detail page...");
    currentCustomerId = getCustomerIdFromUrl();
    if (!currentCustomerId) { displayError("Customer ID missing."); return; }
    console.log(`V2.0: Customer ID: ${currentCustomerId}`);

    // Setup listeners for static elements like modal buttons first
    setupStaticEventListeners();

    const customerLoaded = await loadCustomerDetails(currentCustomerId);
    if (!customerLoaded) return; // Stop if customer fails

    const orderValue = await loadOrderHistory(currentCustomerId); // Returns 'N/A' or 0
    const paidAmount = await loadPaymentHistory(currentCustomerId); // Returns total paid

    updateAccountSummary(currentTotalOrderValue, paidAmount); // Update summary

    console.log("V2.0: Page initialized. Next: Implement main action buttons (Phase 4).");
    // setupActionListeners(currentCustomerId); // Phase 4 call
}

console.log("customer_account_detail.js (V2.0) loaded.");