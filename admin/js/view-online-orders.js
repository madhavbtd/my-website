// admin/js/view-online-orders.js
// Version: Fixes + Added Delete/Edit/Cancel buttons

// Firestore functions available globally from HTML script
const {
    db, auth,
    collection, getDocs, doc, getDoc, updateDoc, query, orderBy,
    serverTimestamp, Timestamp, runTransaction, addDoc, deleteDoc,
    where, limit
} = window;
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- DOM Elements ---
const ordersTbody = document.getElementById('orders-tbody');
const modal = document.getElementById('order-detail-modal');
const modalContent = document.getElementById('order-detail-content');
const closeModalBtn = modal?.querySelector('.close-modal-btn');
const closeModalBottomBtn = modal?.querySelector('.close-modal-bottom-btn');
const loadingMessageRow = document.getElementById('loading-message-row');
const loadingMessage = document.getElementById('loading-message');

let currentOrderId = null; // For use in Modal

// --- Helper Functions ---
function formatTimestamp(timestamp) {
    if (timestamp && typeof timestamp.toDate === 'function') {
        try {
            return timestamp.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) { console.error("Error formatting timestamp:", e); return 'Invalid Date'; }
    } return 'N/A';
}
function formatCurrency(amount) {
    const num = Number(amount);
    return isNaN(num) ? 'N/A' : num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') unsafe = String(unsafe || '');
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// --- Counter Logic (Helper Function) ---
async function getNextIdWithPrefix(counterName, prefix = '', startId = 101) {
    // Ensure functions are loaded
    if (!db || !doc || !runTransaction) {
         console.error("getNextIdWithPrefix: Firestore functions not available!");
         throw new Error("Firestore functions (db, doc, runTransaction) not available for counter.");
     }
    const counterRef = doc(db, "counters", counterName);
    try {
        const nextIdNum = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let nextId = startId;
            if (counterDoc.exists() && counterDoc.data().lastId) {
                const lastId = Number(counterDoc.data().lastId);
                if (!isNaN(lastId)) {
                   nextId = lastId + 1;
                } else {
                   console.warn(`Counter '${counterName}' lastId is not a number (${counterDoc.data().lastId}). Resetting to startId.`);
                   nextId = startId;
                }
            } else {
                console.log(`Counter '${counterName}' not found or lastId missing, starting at ${startId}.`);
            }
            transaction.set(counterRef, { lastId: nextId }, { merge: true });
            return nextId;
        });
        return prefix ? `${prefix}${nextIdNum}` : nextIdNum;
    } catch (error) {
        console.error(`Error getting next ID for ${counterName}:`, error);
        throw new Error(`Failed to generate ID for ${counterName}. Error: ${error.message}`);
    }
}


// --- Load Orders ---
const loadOrders = async () => {
    if (!ordersTbody || !loadingMessageRow || !loadingMessage) {
        console.error("Orders table body or loading message elements not found.");
        return;
    }
    loadingMessageRow.style.display = 'table-row';
    loadingMessage.textContent = 'Loading orders...';
    const rows = ordersTbody.querySelectorAll('tr:not(#loading-message-row)');
    rows.forEach(row => row.remove());

    try {
        const q = query(collection(db, "online_orders"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        loadingMessageRow.style.display = 'none';

        if (querySnapshot.empty) {
            ordersTbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px; color: #666;">No new online orders found.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const order = docSnap.data();
            const orderId = docSnap.id; // Firestore Document ID
            const tr = document.createElement('tr');
            tr.dataset.id = orderId;

            const customerName = order.customerName || 'N/A';
            const customerContact = order.customerContact || 'N/A';

            let itemsSummary = "N/A";
            if (order.items && order.items.length > 0) {
                itemsSummary = order.items.map(item => escapeHtml(item.name || 'Item')).join(', ');
                if (itemsSummary.length > 50) itemsSummary = itemsSummary.substring(0, 50) + "...";
            }

            // *** FIX 1: Removed comment from total amount cell ***
            // *** FIX 3: Added Edit, Delete, Cancel Buttons ***
            tr.innerHTML = `
                <td>${escapeHtml(orderId.substring(0, 8))}...</td>
                <td>${formatTimestamp(order.createdAt)}</td>
                <td>${escapeHtml(customerName)}</td>
                <td>${escapeHtml(customerContact)}</td>
                <td>${formatCurrency(order.subtotal)}</td>
                <td>${itemsSummary}</td>
                <td>
                    <button class="btn btn-sm btn-view" data-id="${orderId}" title="View Details"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-sm btn-edit" data-id="${orderId}" title="Edit Online Order"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-delete" data-id="${orderId}" title="Delete Online Order"><i class="fas fa-trash-alt"></i></button>
                    <button class="btn btn-sm btn-cancel" data-id="${orderId}" title="Cancel Online Order"><i class="fas fa-times-circle"></i></button>
                    <button class="btn btn-sm btn-process" data-id="${orderId}" title="Process & Move to History"><i class="fas fa-arrow-right"></i> Process</button>
                </td>
            `;
            ordersTbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error loading online orders: ", error);
        loadingMessageRow.style.display = 'none';
        ordersTbody.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center; padding: 20px;">Error loading orders. Check console.</td></tr>';
    }
};

// --- View Order Details (Optional Modal - Fixed total amount comment) ---
const viewOrderDetails = async (orderId) => {
    if (!modal || !modalContent) { console.error("Modal elements not found."); return; }
    currentOrderId = orderId;
    modalContent.innerHTML = '<p>Loading details...</p>';
    modal.classList.add('active');

    try {
        const orderRef = doc(db, "online_orders", orderId);
        const docSnap = await getDoc(orderRef);

        if (docSnap.exists()) {
            const order = docSnap.data();
            const customerName = order.customerName || 'N/A';
            const customerContact = order.customerContact || 'N/A';
            const customerAddress = order.customerAddress || 'N/A';

            // *** FIX 1: Removed comment from total amount line ***
            let detailsHtml = `
                <h4>Order ID (Online): ${escapeHtml(orderId)}</h4>
                <p><strong>Date:</strong> ${formatTimestamp(order.createdAt)}</p>
                <p><strong>Total Amount:</strong> ${formatCurrency(order.subtotal)}</p>
                <hr>
                <h4>Customer Details</h4>
                <p><strong>Name:</strong> ${escapeHtml(customerName)}</p>
                <p><strong>WhatsApp:</strong> ${escapeHtml(customerContact)}</p>
                <p><strong>Contact No:</strong> ${escapeHtml(customerContact)}</p>
                <p><strong>Address:</strong> ${escapeHtml(customerAddress)}</p>
                <hr>
                <h4>Items</h4>
            `;

            if (order.items && order.items.length > 0) {
                detailsHtml += '<ul>';
                order.items.forEach(item => {
                    detailsHtml += `<li>
                        <strong>${escapeHtml(item.name || 'Item')}</strong>
                        - Qty: ${escapeHtml(item.quantity || '?')}
                        - Rate: ${formatCurrency(item.unitPrice)}
                        - Amount: ${formatCurrency(item.subtotal)}
                    </li>`;
                });
                detailsHtml += '</ul>';
            } else { detailsHtml += '<p>No items found.</p>'; }

            if (order.specialInstructions) { detailsHtml += `<hr><h4>Special Instructions</h4><p>${escapeHtml(order.specialInstructions).replace(/\n/g, '<br>')}</p>`; }
            if (order.designFileUrl) { detailsHtml += `<p><strong>Design File:</strong> <a href="${order.designFileUrl}" target="_blank" rel="noopener noreferrer">View/Download File</a></p>`; }

            modalContent.innerHTML = detailsHtml;
        } else { modalContent.innerHTML = '<p class="error">Order details not found.</p>'; }
    } catch (error) { console.error("Error fetching order details:", error); modalContent.innerHTML = '<p class="error">Error loading order details.</p>'; }
};

// --- Process Order Function (FIXED serverTimestamp issue) ---
async function processOrder(onlineOrderId, processButton) {
    console.log(`Processing online order: ${onlineOrderId}`);
    const originalButtonHTML = processButton.innerHTML;
    processButton.disabled = true;
    processButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    // Ensure functions are loaded
    if (!db || !doc || !getDoc || !collection || !query || !where || !limit || !getDocs || !runTransaction || !addDoc || !deleteDoc || !serverTimestamp || !Timestamp) {
        alert("Error: Firestore functions not fully loaded. Cannot process order.");
        processButton.disabled = false; processButton.innerHTML = originalButtonHTML; return;
    }

    try {
        // 1. Get Online Order Data
        const onlineOrderRef = doc(db, "online_orders", onlineOrderId);
        const onlineOrderSnap = await getDoc(onlineOrderRef);
        if (!onlineOrderSnap.exists()) throw new Error("Online order data not found.");
        const onlineOrderData = onlineOrderSnap.data();

        const fullName = onlineOrderData.customerName?.trim();
        const whatsappNo = onlineOrderData.customerContact?.trim();
        const itemsFromOnlineOrder = (onlineOrderData.items || []).map(item => ({
             productName: item.name || 'N/A', quantity: item.quantity || 0, rate: item.unitPrice ?? 0,
             itemAmount: item.subtotal ?? (item.quantity * (item.unitPrice ?? 0)),
             unitType: item.unitType || 'Qty', productId: item.productId || null
        }));
        const totalAmount = onlineOrderData.subtotal ?? 0;
        const orderRemarks = onlineOrderData.specialInstructions || '';
        const designFileUrl = onlineOrderData.designFileUrl || null;
        const address = onlineOrderData.customerAddress || null;
        const contactNo = onlineOrderData.customerContact || null;

        if (!whatsappNo || !fullName) throw new Error("Customer Name or Contact missing in online order.");

        // 2 & 3. Check/Create Customer
        let customerId = null; let customCustomerId = null;
        const customersRef = collection(db, "customers");
        const qCust = query(customersRef, where("whatsappNo", "==", whatsappNo), limit(1));
        const customerQuerySnap = await getDocs(qCust);

        if (!customerQuerySnap.empty) {
            const existingDoc = customerQuerySnap.docs[0]; customerId = existingDoc.id; customCustomerId = existingDoc.data().customCustomerId; console.log(`Existing customer found: ID=${customerId}, CustomID=${customCustomerId}`);
        } else {
            console.log("Customer not found, creating new one...");
            try {
                 customCustomerId = await getNextIdWithPrefix("customerCounter", '', 101);
                 const newCustomerData = { fullName: fullName, whatsappNo: whatsappNo, contactNo: contactNo, billingAddress: address, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), customCustomerId: customCustomerId, status: 'active' };
                 const newCustomerRef = await addDoc(customersRef, newCustomerData); customerId = newCustomerRef.id; console.log(`New customer created: FirestoreID=${customerId}, CustomID=${customCustomerId}`);
            } catch(e) { console.error("Error creating customer:", e); throw new Error("Failed to create new customer."); }
        }
        if (!customerId) throw new Error("Failed to link or create customer.");

        // 4. Prepare and Save Order to 'orders' Collection
        let newOrderId; // OM-xxxx

        const newOrderRef = await runTransaction(db, async (transaction) => {
            const orderCounterRef = doc(db, "counters", "orderCounter");
            const orderCounterDoc = await transaction.get(orderCounterRef);
            let nextOrderIdNum = 1001;
            if (orderCounterDoc.exists() && orderCounterDoc.data().lastId) {
                 const lastId = Number(orderCounterDoc.data().lastId);
                 if (!isNaN(lastId)) { nextOrderIdNum = lastId + 1; }
                 else { console.warn("Order counter lastId is not a number. Resetting."); }
            }
            newOrderId = `OM-${nextOrderIdNum}`; // Use OM- prefix

            const newOrderPayload = {
                orderId: newOrderId, customerId: customerId,
                customerDetails: { fullName: fullName, whatsappNo: whatsappNo, address: address, contactNo: contactNo },
                items: itemsFromOnlineOrder, totalAmount: totalAmount,
                subTotal: itemsFromOnlineOrder.reduce((sum, item) => sum + (item.itemAmount ?? 0), 0),
                discountPercentage: 0, discountAmount: 0, finalAmount: totalAmount,
                orderDate: onlineOrderData.createdAt || serverTimestamp(), deliveryDate: null,
                status: "Order Received", urgent: "No",
                remarks: `${orderRemarks}${designFileUrl ? `\nOnline Design File: ${designFileUrl}` : ''}`.trim(),
                paymentStatus: "Pending", amountPaid: 0,
                createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
                // *** FIX 2: Use Timestamp.now() for initial history entry ***
                statusHistory: [{ status: "Order Received", timestamp: Timestamp.now() }],
                linkedPOs: [], orderSource: 'Online'
            };

            const newHistoryOrderRef = doc(collection(db, "orders"));
            transaction.set(newHistoryOrderRef, newOrderPayload);
            transaction.set(orderCounterRef, { lastId: nextOrderIdNum }, { merge: true });
            return newHistoryOrderRef;
        });
        console.log(`Order saved to 'orders'. New Doc ID: ${newOrderRef.id}, Generated Order ID: ${newOrderId}`);

        // 5. Delete from 'online_orders'
        await deleteDoc(onlineOrderRef);
        console.log(`Online order ${onlineOrderId} deleted.`);
        alert(`Order ${newOrderId} processed successfully and moved to Order History!`);
        loadOrders();

    } catch (error) {
        console.error(`Error processing order ${onlineOrderId}:`, error);
        alert(`Error processing order: ${error.message}`);
    } finally {
        if (processButton) { processButton.disabled = false; processButton.innerHTML = originalButtonHTML; }
    }
}

// --- *** NEW: Delete Online Order Function *** ---
async function deleteOnlineOrder(onlineOrderId, deleteButton) {
    console.log(`Attempting to delete online order: ${onlineOrderId}`);
    const originalButtonHTML = deleteButton.innerHTML;
    deleteButton.disabled = true;
    deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    // Ensure deleteDoc function is available
    if (!db || !doc || !deleteDoc) {
        alert("Error: Firestore delete function not available.");
        deleteButton.disabled = false;
        deleteButton.innerHTML = originalButtonHTML;
        return;
    }

    try {
        const onlineOrderRef = doc(db, "online_orders", onlineOrderId);
        await deleteDoc(onlineOrderRef);
        console.log(`Online order ${onlineOrderId} deleted successfully.`);
        alert(`Online order ${onlineOrderId.substring(0, 8)}... deleted.`);
        // Remove the row from the table visually
        const row = ordersTbody.querySelector(`tr[data-id="${onlineOrderId}"]`);
        if (row) {
            row.remove();
        }
        // Check if table is empty after deletion
        if (ordersTbody.rows.length === 0 || (ordersTbody.rows.length === 1 && ordersTbody.rows[0].id === 'loading-message-row')) {
             ordersTbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px; color: #666;">No new online orders found.</td></tr>';
        }

    } catch (error) {
        console.error(`Error deleting online order ${onlineOrderId}:`, error);
        alert(`Error deleting order: ${error.message}`);
        // Re-enable button on error
        if (deleteButton) {
            deleteButton.disabled = false;
            deleteButton.innerHTML = originalButtonHTML;
        }
    }
}

// --- Function to Initialize Page after Auth ---
function initializeOrderPage() {
    console.log("User authenticated, initializing Online Order View page (with Delete/Edit/Cancel)...");

    // Add Event Listeners (Modified for new buttons)
    if (ordersTbody) {
        ordersTbody.addEventListener('click', (event) => {
            const targetButton = event.target.closest('.btn'); // Get the clicked button
            if (!targetButton) return; // Exit if click wasn't on a button

            const orderId = targetButton.dataset.id;
            if (!orderId) return; // Exit if button has no data-id

            // Handle different button clicks
            if (targetButton.classList.contains('btn-view')) {
                viewOrderDetails(orderId);
            } else if (targetButton.classList.contains('btn-process')) {
                 if (confirm(`Process Online Order ${orderId.substring(0,8)}...? This will create Order ID OM-XXXX, move it to main history, and delete it from this list.`)) {
                     processOrder(orderId, targetButton);
                 }
            } else if (targetButton.classList.contains('btn-delete')) {
                 if (confirm(`Are you sure you want to permanently DELETE the online order ${orderId.substring(0,8)}...? This cannot be undone.`)) {
                     deleteOnlineOrder(orderId, targetButton);
                 }
            } else if (targetButton.classList.contains('btn-cancel')) {
                 // Currently, Cancel also deletes. Change logic if needed.
                 if (confirm(`Are you sure you want to CANCEL (delete) the online order ${orderId.substring(0,8)}...?`)) {
                     deleteOnlineOrder(orderId, targetButton); // Reusing delete function for cancel
                 }
            } else if (targetButton.classList.contains('btn-edit')) {
                 console.log(`Edit clicked for online order: ${orderId}`);
                 alert("Editing unprocessed online orders directly is not yet implemented. Please process the order first, then edit from Order History.");
                 // Possible future implementation:
                 // window.location.href = `edit_online_order.html?id=${orderId}`; // Needs a dedicated edit page
            }
        });
    } else {
        console.error("Orders table body (orders-tbody) not found!");
    }

    // --- Modal Close (No changes needed here) ---
    if (closeModalBtn && modal) { closeModalBtn.addEventListener('click', () => { modal.classList.remove('active'); currentOrderId = null; }); }
    if (closeModalBottomBtn && modal) { closeModalBottomBtn.addEventListener('click', () => { modal.classList.remove('active'); currentOrderId = null; }); }
    window.addEventListener('click', (event) => { if (event.target == modal && modal) { modal.classList.remove('active'); currentOrderId = null; } });

    // --- Initial Load ---
    loadOrders();
}

// --- Authentication Check ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        initializeOrderPage();
    } else {
        console.log("User not logged in for Online Order View, redirecting...");
        if (!window.location.pathname.includes('login.html')) {
             window.location.replace('login.html');
        }
    }
});

console.log("view-online-orders.js loaded (with fixes and action buttons).");