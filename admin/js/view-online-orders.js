// admin/js/view-online-orders.js

// --- Imports ---
// सुनिश्चित करें कि पाथ सही है (मान लें admin फोल्डर रूट में है, और js फोल्डर भी रूट में है)
// import { db, auth } from '../../js/firebase-init.js'; // यदि firebase-init.js उपयोग कर रहे हैं
// यदि आप firebase-config.js का उपयोग कर रहे हैं:
// import { db, auth } from '../../js/firebase-config.js'; // Adjust path if needed

// Firestore फंक्शन्स जो window ऑब्जेक्ट पर उपलब्ध कराए गए हैं (HTML से)
const {
    db, auth, // From global scope set in HTML
    collection, getDocs, doc, getDoc, updateDoc, query, orderBy,
    serverTimestamp, Timestamp, runTransaction, addDoc, deleteDoc,
    where, limit
} = window; // Use functions made global in HTML script
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- DOM Elements ---
const ordersTbody = document.getElementById('orders-tbody');
const modal = document.getElementById('order-detail-modal');
const modalContent = document.getElementById('order-detail-content');
const closeModalBtn = modal?.querySelector('.close-modal-btn');
const closeModalBottomBtn = modal?.querySelector('.close-modal-bottom-btn');
const loadingMessageRow = document.getElementById('loading-message');
// Status update elements (यदि आप इन्हें रखते हैं)
// const statusSelect = document.getElementById('order-status-update');
// const updateStatusBtn = document.getElementById('update-status-btn');
// const statusUpdateMessage = document.getElementById('status-update-message');

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


// --- काउंटर लॉजिक (Utility Function - आदर्श रूप से साझा फ़ाइल में रखें) ---
/**
 * Firestore काउंटर से अगला ID प्राप्त करता है और काउंटर को अपडेट करता है।
 * @param {string} counterName 'customerCounter' या 'orderCounter'
 * @param {string} prefix 'MM-' (ऑर्डर के लिए) या खाली (ग्राहक के लिए)
 * @param {number} startId यदि काउंटर मौजूद नहीं है तो शुरुआती ID
 * @returns {Promise<string|number>} अगला ID (string या number)
 */
async function getNextIdWithPrefix(counterName, prefix = '', startId = 101) {
    if (!db || !doc || !runTransaction) throw new Error("Firestore functions not available for counter.");
    const counterRef = doc(db, "counters", counterName);
    try {
        const nextIdNum = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let nextId = startId;
            if (counterDoc.exists() && counterDoc.data().lastId) {
                nextId = counterDoc.data().lastId + 1;
            } else {
                console.log(`Counter '${counterName}' not found, starting at ${startId}.`);
            }
            transaction.set(counterRef, { lastId: nextId }, { merge: true });
            return nextId;
        });
        return prefix ? `${prefix}${nextIdNum}` : nextIdNum; // Prefix जोड़ें यदि आवश्यक हो
    } catch (error) {
        console.error(`Error getting next ID for ${counterName}:`, error);
        throw new Error(`Failed to generate ID for ${counterName}.`);
    }
}


// --- Load Orders ---
const loadOrders = async () => {
    if (!ordersTbody) { console.error("Orders table body not found."); return; }
    if (loadingMessageRow) loadingMessageRow.style.display = 'table-row'; // Show loading
    ordersTbody.innerHTML = ''; // Clear previous content but keep the loading row element available

    try {
        // *** सुनिश्चित करें कि कलेक्शन का नाम सही है: online_orders ***
        const q = query(collection(db, "online_orders"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        if (loadingMessageRow) loadingMessageRow.style.display = 'none'; // Hide loading

        if (querySnapshot.empty) {
            ordersTbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px; color: #666;">No new online orders found.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const order = docSnap.data();
            const orderId = docSnap.id; // Firestore Document ID
            const tr = document.createElement('tr');
            tr.dataset.id = orderId; // Store Firestore ID

            // आइटम लिस्ट का संक्षिप्त रूप बनाएं
            let itemsSummary = "N/A";
            if (order.items && order.items.length > 0) {
                itemsSummary = order.items.map(item => escapeHtml(item.productName || 'Item')).join(', ');
                if (itemsSummary.length > 50) itemsSummary = itemsSummary.substring(0, 50) + "..."; // छोटा करें
            }

            tr.innerHTML = `
                <td>${escapeHtml(orderId.substring(0, 8))}...</td>
                <td>${formatTimestamp(order.createdAt)}</td>
                <td>${escapeHtml(order.customerDetails?.fullName || 'N/A')}</td>
                <td>${escapeHtml(order.customerDetails?.whatsappNo || 'N/A')}</td>
                <td>${formatCurrency(order.totalAmount)}</td>
                <td>${itemsSummary}</td>
                {/* <td><span class="status-badge status-new">New</span></td> */} {/* स्टेटस अब प्रोसेस होने के बाद सेट होगा */}
                <td>
                    <button class="btn btn-sm btn-view" data-id="${orderId}" title="View Details"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-sm btn-process" data-id="${orderId}" title="Process & Move to History"><i class="fas fa-arrow-right"></i> Process</button>
                </td>
            `;
            ordersTbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error loading online orders: ", error);
        if (loadingMessageRow) loadingMessageRow.style.display = 'none'; // Hide loading on error too
        ordersTbody.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center; padding: 20px;">Error loading orders. Check console.</td></tr>';
    }
};

// --- View Order Details (Optional Modal) ---
const viewOrderDetails = async (orderId) => {
    if (!modal || !modalContent) { console.error("Modal elements not found."); return; }

    currentOrderId = orderId;
    modalContent.innerHTML = '<p>Loading details...</p>';
    modal.classList.add('active'); // Show modal using class

    try {
        // *** कलेक्शन का नाम ठीक करें ***
        const orderRef = doc(db, "online_orders", orderId);
        const docSnap = await getDoc(orderRef);

        if (docSnap.exists()) {
            const order = docSnap.data();
            let detailsHtml = `
                <h4>Order ID (Online): ${escapeHtml(orderId)}</h4>
                <p><strong>Date:</strong> ${formatTimestamp(order.createdAt)}</p>
                <p><strong>Total Amount:</strong> ${formatCurrency(order.totalAmount)}</p>
                <hr>
                <h4>Customer Details</h4>
                <p><strong>Name:</strong> ${escapeHtml(order.customerDetails?.fullName || 'N/A')}</p>
                <p><strong>WhatsApp:</strong> ${escapeHtml(order.customerDetails?.whatsappNo || 'N/A')}</p>
                <p><strong>Address:</strong> ${escapeHtml(order.customerDetails?.address || 'N/A')}</p>
                <p><strong>Contact No:</strong> ${escapeHtml(order.customerDetails?.contactNo || 'N/A')}</p>
                <hr>
                <h4>Items</h4>
            `;

            if (order.items && order.items.length > 0) {
                detailsHtml += '<ul>';
                order.items.forEach(item => {
                    // आइटम की अधिक जानकारी दिखाएं
                    detailsHtml += `<li>
                        <strong>${escapeHtml(item.productName || 'Item')}</strong> - Qty: ${escapeHtml(item.quantity || '?')}
                        ${item.unitType === 'Sq Feet' ? ` (${escapeHtml(item.width)}x${escapeHtml(item.height)} ${escapeHtml(item.dimensionUnit)})` : ''}
                        - Rate: ${formatCurrency(item.rate)} - Amount: ${formatCurrency(item.itemAmount)}
                    </li>`;
                });
                detailsHtml += '</ul>';
            } else {
                detailsHtml += '<p>No items found.</p>';
            }

             // निर्देश और फाइल लिंक दिखाएं
             if (order.specialInstructions) {
                 detailsHtml += `<hr><h4>Special Instructions</h4><p>${escapeHtml(order.specialInstructions).replace(/\n/g, '<br>')}</p>`;
             }
             if (order.designFileUrl) {
                 detailsHtml += `<p><strong>Design File:</strong> <a href="${order.designFileUrl}" target="_blank" rel="noopener noreferrer">View/Download File</a></p>`;
             }

            modalContent.innerHTML = detailsHtml;
        } else {
            modalContent.innerHTML = '<p class="error">Order details not found.</p>';
        }
    } catch (error) {
        console.error("Error fetching order details:", error);
        modalContent.innerHTML = '<p class="error">Error loading order details.</p>';
    }
};

// --- Process Order Function ---
async function processOrder(onlineOrderId, processButton) {
    console.log(`Processing online order: ${onlineOrderId}`);
    const originalButtonHTML = processButton.innerHTML;
    processButton.disabled = true;
    processButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    // सुनिश्चित करें कि सभी आवश्यक Firestore फंक्शन लोड हो गए हैं
    if (!db || !doc || !getDoc || !collection || !query || !where || !limit || !getDocs || !runTransaction || !addDoc || !deleteDoc || !serverTimestamp || !Timestamp) {
        alert("Error: Firestore functions not fully loaded. Cannot process order.");
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
        console.log("Fetched Online Order Data:", onlineOrderData);

        // Extract necessary info
        const customerDetails = onlineOrderData.customerDetails || {};
        const whatsappNo = customerDetails.whatsappNo?.trim();
        const fullName = customerDetails.fullName?.trim();
        const itemsFromOnlineOrder = onlineOrderData.items || [];
        const totalAmount = onlineOrderData.totalAmount ?? 0;
        const orderRemarks = onlineOrderData.specialInstructions || '';
        const designFileUrl = onlineOrderData.designFileUrl || null; // Get file URL

        if (!whatsappNo || !fullName) throw new Error("Customer Name or WhatsApp missing.");

        // --- 2 & 3. Check/Create Customer ---
        let customerId = null;
        let customCustomerId = null; // Readable Customer ID

        const customersRef = collection(db, "customers");
        const qCust = query(customersRef, where("whatsappNo", "==", whatsappNo), limit(1));
        const customerQuerySnap = await getDocs(qCust);

        if (!customerQuerySnap.empty) {
            const existingDoc = customerQuerySnap.docs[0];
            customerId = existingDoc.id;
            customCustomerId = existingDoc.data().customCustomerId;
            console.log(`Existing customer found: ID=${customerId}, CustomID=${customCustomerId}`);
            // Optionally update existing customer details if needed (e.g., address)
            // await updateDoc(doc(db, "customers", customerId), { ... details from onlineOrder ... });
        } else {
            console.log("Customer not found, creating new one using transaction...");
            try {
                 customCustomerId = await getNextIdWithPrefix("customerCounter", '', 101); // Get next CUSTOMER ID
                 const newCustomerData = {
                    fullName: fullName,
                    whatsappNo: whatsappNo,
                    contactNo: customerDetails.contactNo || null,
                    billingAddress: customerDetails.address || null, // Use billingAddress
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    customCustomerId: customCustomerId, // Save readable ID
                    status: 'active'
                };
                 const newCustomerRef = await addDoc(customersRef, newCustomerData);
                 customerId = newCustomerRef.id; // Get the Firestore generated ID
                 console.log(`New customer created: FirestoreID=${customerId}, CustomID=${customCustomerId}`);
            } catch(e) {
                 console.error("Error creating customer within transaction alternative:", e);
                 throw new Error("Failed to create new customer.");
            }
        }

        if (!customerId) throw new Error("Failed to link or create customer.");

        // --- 4. Prepare and Save Order to 'orders' Collection (using transaction for Order ID) ---
        let newOrderId; // Readable Order ID like MM-1001

        const newOrderRef = await runTransaction(db, async (transaction) => {
            const orderCounterRef = doc(db, "counters", "orderCounter");
            const orderCounterDoc = await transaction.get(orderCounterRef);
            let nextOrderIdNum = 1001;
            if (orderCounterDoc.exists() && orderCounterDoc.data().lastId) {
                nextOrderIdNum = orderCounterDoc.data().lastId + 1;
            }
            newOrderId = `MM-${nextOrderIdNum}`;

            const newOrderPayload = {
                orderId: newOrderId,
                customerId: customerId,
                customerDetails: { // Snapshot
                    fullName: fullName,
                    whatsappNo: whatsappNo,
                    address: customerDetails.address || null,
                    contactNo: customerDetails.contactNo || null,
                    // customCustomerId: customCustomerId // optional
                },
                items: itemsFromOnlineOrder.map(item => ({
                     productName: item.productName || 'N/A',
                     quantity: item.quantity || 0,
                     rate: item.rate ?? 0,
                     itemAmount: item.itemAmount ?? (item.quantity * (item.rate ?? 0)),
                     unitType: item.unitType || 'Qty',
                     ...(item.unitType === 'Sq Feet' && {
                        dimensionUnit: item.dimensionUnit,
                        width: item.width,
                        height: item.height,
                        realSqFt: item.realSqFt,
                        printSqFt: item.printSqFt
                     })
                     // productId: item.productId || null
                 })),
                totalAmount: totalAmount,
                subTotal: itemsFromOnlineOrder.reduce((sum, item) => sum + (item.itemAmount ?? (item.quantity * (item.rate ?? 0))), 0),
                discountPercentage: 0,
                discountAmount: 0,
                finalAmount: totalAmount,
                orderDate: onlineOrderData.createdAt || serverTimestamp(),
                deliveryDate: null,
                status: "Order Received",
                urgent: "No",
                remarks: `${orderRemarks}${designFileUrl ? `\nOnline Design File: ${designFileUrl}` : ''}`,
                paymentStatus: "Pending",
                amountPaid: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                statusHistory: [{ status: "Order Received", timestamp: serverTimestamp() }], // Use serverTimestamp here too
                linkedPOs: []
            };

            const newHistoryOrderRef = doc(collection(db, "orders"));
            transaction.set(newHistoryOrderRef, newOrderPayload);
            transaction.set(orderCounterRef, { lastId: nextOrderIdNum }, { merge: true });
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
        if (processButton) {
            processButton.disabled = false;
            processButton.innerHTML = originalButtonHTML;
        }
    }
}


// --- Function to Initialize Page after Auth ---
function initializeOrderPage() {
    console.log("User authenticated, initializing Online Order View page...");

    // Add Event Listeners
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
    } else {
        console.error("Orders table body not found!");
    }

    // --- Modal Close ---
    if (closeModalBtn && modal) {
        closeModalBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            currentOrderId = null;
        });
    }
    if (closeModalBottomBtn && modal) {
         closeModalBottomBtn.addEventListener('click', () => {
             modal.classList.remove('active');
             currentOrderId = null;
         });
     }

    // Close modal if clicked outside
    window.addEventListener('click', (event) => {
        if (event.target == modal && modal) {
            modal.classList.remove('active');
            currentOrderId = null;
        }
    });

    // --- Initial Load ---
    loadOrders();
}


// --- Authentication Check ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        initializeOrderPage();
    } else {
        console.log("User not logged in for Online Order View, redirecting...");
        // Adjust path based on your structure - assuming admin is a subfolder
        if (!window.location.pathname.includes('login.html')) {
             window.location.replace('login.html'); // Redirect to login within admin folder
        }
    }
});

console.log("view-online-orders.js loaded.");