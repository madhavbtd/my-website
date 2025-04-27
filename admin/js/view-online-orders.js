// admin/js/view-online-orders.js - Updated to read top-level customer fields

// --- Imports ---
// Firestore फंक्शन्स window ऑब्जेक्ट से प्राप्त करें (HTML में सेट किए गए अनुसार)
const {
    db, auth,
    collection, getDocs, doc, getDoc, updateDoc, query, orderBy,
    serverTimestamp, Timestamp, runTransaction, addDoc, deleteDoc,
    where, limit
} = window;
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// utils.js से काउंटर फंक्शन इम्पोर्ट करें (सुनिश्चित करें पाथ सही है)
import { getNextNumericId } from '../../js/utils.js'; // <<<--- पाथ एडजस्ट करें यदि आवश्यक हो

// --- DOM Elements ---
const ordersTbody = document.getElementById('orders-tbody');
const modal = document.getElementById('order-detail-modal');
const modalContent = document.getElementById('order-detail-content');
const closeModalBtn = modal?.querySelector('.close-modal-btn');
const closeModalBottomBtn = modal?.querySelector('.close-modal-bottom-btn');
const loadingMessageRow = document.getElementById('loading-message-row'); // Updated ID

let currentOrderId = null; // Modal में उपयोग के लिए

// --- Helper Functions ---
function formatTimestamp(timestamp) {
    if (timestamp && typeof timestamp.toDate === 'function') {
        try {
            return timestamp.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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

// --- Load Orders ---
const loadOrders = async () => {
    if (!ordersTbody) { console.error("Orders table body not found."); return; }

    // Show loading message Row
    if (loadingMessageRow) {
         loadingMessageRow.style.display = 'table-row';
         loadingMessageRow.querySelector('td').textContent = 'Loading orders...';
    }
    ordersTbody.innerHTML = ''; // Clear previous content AFTER getting the loading row element
    if(loadingMessageRow) ordersTbody.appendChild(loadingMessageRow); // Add loading row back

    try {
        const q = query(collection(db, "online_orders"), orderBy("createdAt", "desc")); // <- Corrected collection name
        const querySnapshot = await getDocs(q);

        if (loadingMessageRow) loadingMessageRow.style.display = 'none'; // Hide loading

        if (querySnapshot.empty) {
            ordersTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: #666;">No new online orders found.</td></tr>`;
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const order = docSnap.data();
            const orderId = docSnap.id; // Firestore Document ID
            const tr = document.createElement('tr');
            tr.dataset.id = orderId;

            let itemsSummary = "N/A";
            if (order.items && order.items.length > 0) {
                itemsSummary = order.items.map(item => escapeHtml(item.name || 'Item')).join(', '); // Use name field
                if (itemsSummary.length > 50) itemsSummary = itemsSummary.substring(0, 50) + "...";
            }

            // <<<--- HTML Comment हटाया गया ---<<<
            tr.innerHTML = `
                <td>${escapeHtml(orderId.substring(0, 8))}...</td>
                <td>${formatTimestamp(order.createdt || order.createdAt)}</td> {/* Use createdt */}
                <td>${escapeHtml(order.customerName || 'N/A')}</td> {/* Use customerName */}
                <td>${escapeHtml(order.customerContact || 'N/A')}</td> {/* Use customerContact */}
                <td>${formatCurrency(order.totalAmount)}</td>
                <td>${itemsSummary}</td>
                <td>
                    <button class="btn btn-sm btn-view" data-id="${orderId}" title="View Details"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-sm btn-process" data-id="${orderId}" title="Process & Move to History"><i class="fas fa-arrow-right"></i> Process</button>
                </td>
            `;
            ordersTbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error loading online orders: ", error);
        if (loadingMessageRow) loadingMessageRow.style.display = 'none';
        ordersTbody.innerHTML = `<tr><td colspan="7" style="color:red; text-align:center; padding: 20px;">Error loading orders. Check console.</td></tr>`;
    }
};

// --- View Order Details (Modal) ---
const viewOrderDetails = async (orderId) => {
    if (!modal || !modalContent) { console.error("Modal elements not found."); return; }
    currentOrderId = orderId;
    modalContent.innerHTML = '<p>Loading details...</p>';
    modal.classList.add('active');

    try {
        const orderRef = doc(db, "online_orders", orderId); // <- Corrected collection name
        const docSnap = await getDoc(orderRef);

        if (docSnap.exists()) {
            const order = docSnap.data();
            let detailsHtml = `
                <h4>Order ID (Online): ${escapeHtml(orderId)}</h4>
                <p><strong>Date:</strong> ${formatTimestamp(order.createdt || order.createdAt)}</p> {/* Use createdt */}
                <p><strong>Total Amount:</strong> ${formatCurrency(order.totalAmount)}</p>
                <hr>
                <h4>Customer Details</h4>
                {/* <<<--- Read from top-level fields ---<<< */}
                <p><strong>Name:</strong> ${escapeHtml(order.customerName || 'N/A')}</p>
                <p><strong>Contact/WhatsApp:</strong> ${escapeHtml(order.customerContact || 'N/A')}</p>
                <p><strong>Address:</strong> ${escapeHtml(order.customerAddress || 'N/A')}</p>
                <hr>
                <h4>Items</h4>
            `;

            if (order.items && order.items.length > 0) {
                detailsHtml += '<ul>';
                order.items.forEach(item => {
                    detailsHtml += `<li>
                        <strong>${escapeHtml(item.name || 'Item')}</strong> - Qty: ${escapeHtml(item.quantity || '?')}
                        (${escapeHtml(item.unitType || 'N/A')}${item.unitType === 'Sq Feet' ? ` | ${item.width || ''}x${item.height || ''} ${item.dimensionUnit || 'ft'}` : ''})
                        - Rate: ${formatCurrency(item.unitPrice)} - Amount: ${formatCurrency(item.subtotal)}
                    </li>`;
                });
                detailsHtml += '</ul>';
            } else { detailsHtml += '<p>No items found.</p>'; }

            if (order.specialInstructions) { detailsHtml += `<hr><h4>Special Instructions</h4><p>${escapeHtml(order.specialInstructions).replace(/\n/g, '<br>')}</p>`; }
            if (order.designFileUrl) { detailsHtml += `<p><strong>Design File:</strong> <a href="${order.designFileUrl}" target="_blank" rel="noopener noreferrer">View File</a></p>`; }

            modalContent.innerHTML = detailsHtml;
        } else { modalContent.innerHTML = '<p class="error">Order details not found.</p>'; }
    } catch (error) { console.error("Error fetching order details:", error); modalContent.innerHTML = '<p class="error">Error loading order details.</p>'; }
};

// --- Process Order Function ---
async function processOrder(onlineOrderId, processButton) {
    console.log(`Processing online order: ${onlineOrderId}`);
    const originalButtonHTML = processButton.innerHTML;
    processButton.disabled = true;
    processButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    if (!db || !doc || !getDoc || !collection || !query || !where || !limit || !getDocs || !runTransaction || !addDoc || !deleteDoc || !serverTimestamp || !Timestamp || typeof getNextNumericId !== 'function') {
        alert("Error: Required functions not available. Cannot process.");
        processButton.disabled = false;
        processButton.innerHTML = originalButtonHTML;
        return;
    }

    try {
        // 1. Get Online Order Data
        const onlineOrderRef = doc(db, "online_orders", onlineOrderId);
        const onlineOrderSnap = await getDoc(onlineOrderRef);
        if (!onlineOrderSnap.exists()) throw new Error("Online order data not found.");
        const onlineOrderData = onlineOrderSnap.data();

        // --->>> यहाँ बदलाव: टॉप-लेवल फ़ील्ड्स से डेटा पढ़ें <<<---
        const fullName = onlineOrderData.customerName?.trim();
        const whatsappNo = onlineOrderData.customerContact?.trim(); // Use customerContact
        const address = onlineOrderData.customerAddress?.trim();
        // --->>> बदलाव समाप्त <<<---

        const itemsFromOnlineOrder = onlineOrderData.items || [];
        const totalAmount = onlineOrderData.totalAmount ?? 0;
        const orderRemarks = onlineOrderData.specialInstructions || '';
        const designFileUrl = onlineOrderData.designFileUrl || null;

        // Validate extracted data
        if (!whatsappNo || !fullName) {
            // Throw error AFTER logging the problematic data
            console.error("Missing required customer data in:", onlineOrderData);
            throw new Error("Customer Name or WhatsApp missing.");
        }

        // --- 2 & 3. Check/Create Customer ---
        let customerId = null;
        let customCustomerId = null;

        const customersRef = collection(db, "customers");
        const qCust = query(customersRef, where("whatsappNo", "==", whatsappNo), limit(1));
        const customerQuerySnap = await getDocs(qCust);

        if (!customerQuerySnap.empty) {
            const existingDoc = customerQuerySnap.docs[0];
            customerId = existingDoc.id;
            customCustomerId = existingDoc.data().customCustomerId;
            console.log(`Existing customer found: ID=${customerId}, CustomID=${customCustomerId}`);
        } else {
            console.log("Customer not found, creating new one...");
            customCustomerId = await getNextNumericId("customerCounter", 101); // Get next ID from utils.js
            const newCustomerData = {
                fullName: fullName,
                whatsappNo: whatsappNo,
                contactNo: whatsappNo, // Use whatsapp as contact initially
                billingAddress: address || null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                customCustomerId: customCustomerId,
                status: 'active'
            };
            const newCustomerRef = await addDoc(customersRef, newCustomerData);
            customerId = newCustomerRef.id;
            console.log(`New customer created: FirestoreID=${customerId}, CustomID=${customCustomerId}`);
        }

        if (!customerId) throw new Error("Failed to link or create customer.");

        // --- 4. Prepare and Save Order to 'orders' Collection ---
        let newOrderId;

        const newOrderRef = await runTransaction(db, async (transaction) => {
            const orderCounterRef = doc(db, "counters", "orderCounter");
            const orderCounterDoc = await transaction.get(orderCounterRef);
            let nextOrderIdNum = 1001; // Adjust start ID if needed
            if (orderCounterDoc.exists() && orderCounterDoc.data().lastId) {
                nextOrderIdNum = orderCounterDoc.data().lastId + 1;
            }
            newOrderId = `MM-${nextOrderIdNum}`; // Your order ID format

            // --->>> यहाँ customerDetails स्नैपशॉट सही करें <<<---
            const newOrderPayload = {
                orderId: newOrderId,
                customerId: customerId,
                customerDetails: { // Snapshot using extracted top-level fields
                    fullName: fullName,
                    whatsappNo: whatsappNo,
                    address: address || null,
                    contactNo: whatsappNo || null // Use whatsapp as contact
                },
                 // --->>> आइटम मैपिंग सही करें (online order से) <<<---
                 items: itemsFromOnlineOrder.map(item => ({
                    productName: item.name || 'N/A',         // <- Use name
                    productId: item.productId || null,     // <- Add productId if available
                    quantity: item.quantity || 0,
                    rate: item.unitPrice ?? 0,              // <- Use unitPrice as rate
                    itemAmount: item.subtotal ?? (item.quantity * (item.unitPrice ?? 0)), // <- Use subtotal
                    unitType: item.unitType || 'Qty',       // <- Add unitType if available
                     // Add Sq Feet details if they exist in online order items
                     ...(item.unitType === 'Sq Feet' && {
                        dimensionUnit: item.dimensionUnit,
                        width: item.width,
                        height: item.height,
                        realSqFt: item.realSqFt,
                        printSqFt: item.printSqFt
                     })
                 })),
                totalAmount: totalAmount,
                subTotal: itemsFromOnlineOrder.reduce((sum, item) => sum + (item.subtotal ?? (item.quantity * (item.unitPrice ?? 0))), 0), // Recalculate subtotal
                discountPercentage: 0, discountAmount: 0, finalAmount: totalAmount,
                orderDate: onlineOrderData.createdt || onlineOrderData.createdAt || serverTimestamp(), // Use online order time
                deliveryDate: null, status: "Order Received", urgent: "No",
                remarks: `${orderRemarks}${designFileUrl ? `\nOnline Design File: ${designFileUrl}` : ''}`,
                paymentStatus: "Pending", amountPaid: 0,
                createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
                statusHistory: [{ status: "Order Received", timestamp: serverTimestamp() }],
                linkedPOs: []
            };

            const newHistoryOrderRef = doc(collection(db, "orders"));
            transaction.set(newHistoryOrderRef, newOrderPayload);
            // काउंटर अपडेट अब getNextNumericId में होता है, यहाँ transaction.set(orderCounterRef...) की आवश्यकता नहीं
            // transaction.set(orderCounterRef, { lastId: nextOrderIdNum }, { merge: true }); // <<-- यह लाइन हटाएं यदि getNextNumericId का उपयोग कर रहे हैं
            return newHistoryOrderRef;
        });

        console.log(`Order saved to 'orders'. New Doc ID: ${newOrderRef.id}, Order ID: ${newOrderId}`);

        // --- 5. Delete from 'online_orders' ---
        await deleteDoc(onlineOrderRef);
        console.log(`Online order ${onlineOrderId} deleted.`);

        alert(`Order ${newOrderId} processed and moved to History!`);
        loadOrders(); // Refresh list

    } catch (error) {
        console.error(`Error processing order ${onlineOrderId}:`, error);
        alert(`Error processing order: ${error.message}`);
    } finally {
        if (processButton) {
            processButton.disabled = false;
            processButton.innerHTML = originalButtonHTML; // Restore original content
        }
    }
}

// --- Function to Initialize Page after Auth ---
function initializeOrderPage() {
    console.log("User authenticated, initializing Online Order View page...");

    if (ordersTbody) {
        ordersTbody.addEventListener('click', (event) => {
            const viewButton = event.target.closest('.btn-view');
            const processButton = event.target.closest('.btn-process');
            if (viewButton) {
                const orderId = viewButton.dataset.id;
                if (orderId) viewOrderDetails(orderId);
            } else if (processButton) {
                 const orderId = processButton.dataset.id;
                 if (orderId) {
                      if (confirm(`Process Online Order ${orderId.substring(0,8)}...? This will move it to main history and delete it from this list.`)) {
                          processOrder(orderId, processButton);
                      }
                 }
             }
        });
    } else { console.error("Orders table body not found!"); }

    if (closeModalBtn && modal) { closeModalBtn.addEventListener('click', () => { modal.classList.remove('active'); currentOrderId = null; }); }
    if (closeModalBottomBtn && modal) { closeModalBottomBtn.addEventListener('click', () => { modal.classList.remove('active'); currentOrderId = null; }); }
    window.addEventListener('click', (event) => { if (event.target == modal && modal) { modal.classList.remove('active'); currentOrderId = null; } });

    loadOrders(); // Initial Load
}

// --- Authentication Check ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        initializeOrderPage();
    } else {
        console.log("User not logged in for Online Order View, redirecting...");
        if (!window.location.pathname.includes('login.html')) {
             window.location.replace('login.html'); // Adjust path if needed
        }
    }
});

console.log("view-online-orders.js loaded.");