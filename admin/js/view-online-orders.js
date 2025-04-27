// admin/js/view-online-orders.js
// Version: Updated with OM- prefix and fixed Firestore field reading

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
const loadingMessageRow = document.getElementById('loading-message-row'); // Updated ID
const loadingMessage = document.getElementById('loading-message'); // Reference to the cell itself

let currentOrderId = null; // For use in Modal

// --- Helper Functions ---
function formatTimestamp(timestamp) {
    if (timestamp && typeof timestamp.toDate === 'function') {
        try {
            // Use 'en-GB' for dd/mm/yyyy format
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
/**
 * Gets the next ID from a Firestore counter and updates it.
 * @param {string} counterName 'customerCounter' or 'orderCounter'
 * @param {string} prefix 'OM-' (online orders), 'MM-' (manual orders), '' (customers)
 * @param {number} startId Starting ID if counter doesn't exist
 * @returns {Promise<string|number>} The next ID (string or number)
 */
async function getNextIdWithPrefix(counterName, prefix = '', startId = 101) {
    if (!db || !doc || !runTransaction) throw new Error("Firestore functions (db, doc, runTransaction) not available for counter.");
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
    loadingMessageRow.style.display = 'table-row'; // Show loading
    loadingMessage.textContent = 'Loading orders...'; // Set loading text
    // Clear previous content except the loading row
    const rows = ordersTbody.querySelectorAll('tr:not(#loading-message-row)');
    rows.forEach(row => row.remove());


    try {
        // Query online_orders collection, ordered by creation time descending
        const q = query(collection(db, "online_orders"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        loadingMessageRow.style.display = 'none'; // Hide loading row

        if (querySnapshot.empty) {
            // Add a "No orders" row if empty
            ordersTbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px; color: #666;">No new online orders found.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const order = docSnap.data();
            const orderId = docSnap.id; // Firestore Document ID (e.g., GtoaRvMx...)
            const tr = document.createElement('tr');
            tr.dataset.id = orderId; // Store Firestore ID for actions

            // --- UPDATED: Read correct fields based on screenshot ---
            const customerName = order.customerName || 'N/A';
            const customerContact = order.customerContact || 'N/A'; // Using customerContact field
            // --- End of Update ---

            // Create a summary of items
            let itemsSummary = "N/A";
            if (order.items && order.items.length > 0) {
                // Using 'name' field from items array based on screenshot
                itemsSummary = order.items.map(item => escapeHtml(item.name || 'Item')).join(', ');
                if (itemsSummary.length > 50) itemsSummary = itemsSummary.substring(0, 50) + "...";
            }

            tr.innerHTML = `
                <td>${escapeHtml(orderId.substring(0, 8))}...</td>
                <td>${formatTimestamp(order.createdAt)}</td>
                <td>${escapeHtml(customerName)}</td>
                <td>${escapeHtml(customerContact)}</td>
                <td>${formatCurrency(order.subtotal)}</td> {/* Assuming total is in subtotal field */}
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
        loadingMessageRow.style.display = 'none'; // Hide loading row on error
        // Show error message in the table
        ordersTbody.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center; padding: 20px;">Error loading orders. Check console.</td></tr>';
    }
};

// --- View Order Details (Optional Modal) ---
const viewOrderDetails = async (orderId) => {
    if (!modal || !modalContent) { console.error("Modal elements not found."); return; }

    currentOrderId = orderId;
    modalContent.innerHTML = '<p>Loading details...</p>';
    modal.classList.add('active'); // Show modal

    try {
        const orderRef = doc(db, "online_orders", orderId);
        const docSnap = await getDoc(orderRef);

        if (docSnap.exists()) {
            const order = docSnap.data();

            // --- UPDATED: Read correct fields for modal ---
            const customerName = order.customerName || 'N/A';
            const customerContact = order.customerContact || 'N/A';
            // Address field not present in screenshot, default to N/A
            const customerAddress = order.customerAddress || 'N/A'; // Assuming field name might be customerAddress
            // --- End of Update ---

            let detailsHtml = `
                <h4>Order ID (Online): ${escapeHtml(orderId)}</h4>
                <p><strong>Date:</strong> ${formatTimestamp(order.createdAt)}</p>
                <p><strong>Total Amount:</strong> ${formatCurrency(order.subtotal)}</p> {/* Using subtotal */}
                <hr>
                <h4>Customer Details</h4>
                <p><strong>Name:</strong> ${escapeHtml(customerName)}</p>
                {/* Showing Contact in both WhatsApp and Contact No fields for now */}
                <p><strong>WhatsApp:</strong> ${escapeHtml(customerContact)}</p>
                <p><strong>Contact No:</strong> ${escapeHtml(customerContact)}</p>
                <p><strong>Address:</strong> ${escapeHtml(customerAddress)}</p>
                <hr>
                <h4>Items</h4>
            `;

            if (order.items && order.items.length > 0) {
                detailsHtml += '<ul>';
                order.items.forEach(item => {
                    // Using 'name' and 'unitPrice' from screenshot item structure
                    detailsHtml += `<li>
                        <strong>${escapeHtml(item.name || 'Item')}</strong>
                        - Qty: ${escapeHtml(item.quantity || '?')}
                        - Rate: ${formatCurrency(item.unitPrice)}
                        - Amount: ${formatCurrency(item.subtotal)}
                    </li>`;
                });
                detailsHtml += '</ul>';
            } else {
                detailsHtml += '<p>No items found.</p>';
            }

             // Show instructions/file URL if they exist
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

        // --- UPDATED: Extract info using correct field names ---
        const fullName = onlineOrderData.customerName?.trim();
        const whatsappNo = onlineOrderData.customerContact?.trim(); // Using customerContact for WhatsApp
        // Assuming items structure from screenshot
        const itemsFromOnlineOrder = (onlineOrderData.items || []).map(item => ({
             productName: item.name || 'N/A',
             quantity: item.quantity || 0,
             rate: item.unitPrice ?? 0,
             itemAmount: item.subtotal ?? (item.quantity * (item.unitPrice ?? 0)),
             // Assuming default unit type if not specified
             unitType: item.unitType || 'Qty',
             // Add dimension fields if they exist in your online_orders item structure
             // dimensionUnit: item.dimensionUnit,
             // width: item.width,
             // height: item.height,
             // realSqFt: item.realSqFt,
             // printSqFt: item.printSqFt
             productId: item.productId || null // Include productId if available
         }));
        const totalAmount = onlineOrderData.subtotal ?? 0; // Using subtotal field
        const orderRemarks = onlineOrderData.specialInstructions || ''; // Assuming this field exists
        const designFileUrl = onlineOrderData.designFileUrl || null; // Assuming this field exists
        // Address and a separate Contact Number are not directly in the screenshot's top level.
        // We'll use customerContact for both WhatsApp and Contact for now in the final order.
        const address = onlineOrderData.customerAddress || null; // Attempt to read address
        const contactNo = onlineOrderData.customerContact || null; // Re-use customerContact
        // --- End of Update ---

        if (!whatsappNo || !fullName) throw new Error("Customer Name or Contact missing in online order.");

        // --- 2 & 3. Check/Create Customer ---
        let customerId = null;
        let customCustomerId = null; // Readable Customer ID

        const customersRef = collection(db, "customers");
        // Search using whatsappNo (which now holds customerContact)
        const qCust = query(customersRef, where("whatsappNo", "==", whatsappNo), limit(1));
        const customerQuerySnap = await getDocs(qCust);

        if (!customerQuerySnap.empty) {
            const existingDoc = customerQuerySnap.docs[0];
            customerId = existingDoc.id;
            customCustomerId = existingDoc.data().customCustomerId;
            console.log(`Existing customer found: ID=${customerId}, CustomID=${customCustomerId}`);
            // Optional: Update existing customer if needed (e.g., if address is provided online)
            // await updateDoc(doc(db, "customers", customerId), { billingAddress: address, updatedAt: serverTimestamp() });
        } else {
            console.log("Customer not found, creating new one...");
            try {
                 customCustomerId = await getNextIdWithPrefix("customerCounter", '', 101); // Get next CUSTOMER ID
                 const newCustomerData = {
                    fullName: fullName,
                    whatsappNo: whatsappNo, // Save contact as WhatsApp number
                    contactNo: contactNo, // Also save contact as Contact number
                    billingAddress: address, // Save address if found
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    customCustomerId: customCustomerId,
                    status: 'active'
                };
                 const newCustomerRef = await addDoc(customersRef, newCustomerData);
                 customerId = newCustomerRef.id;
                 console.log(`New customer created: FirestoreID=${customerId}, CustomID=${customCustomerId}`);
            } catch(e) {
                 console.error("Error creating customer:", e);
                 throw new Error("Failed to create new customer.");
            }
        }

        if (!customerId) throw new Error("Failed to link or create customer.");

        // --- 4. Prepare and Save Order to 'orders' Collection ---
        // --- UPDATED: Using "OM-" prefix for Order ID ---
        let newOrderId; // Will be like OM-1001

        const newOrderRef = await runTransaction(db, async (transaction) => {
            const orderCounterRef = doc(db, "counters", "orderCounter");
            const orderCounterDoc = await transaction.get(orderCounterRef);
            let nextOrderIdNum = 1001; // Default start
            if (orderCounterDoc.exists() && orderCounterDoc.data().lastId) {
                 const lastId = Number(orderCounterDoc.data().lastId);
                 if (!isNaN(lastId)) {
                    nextOrderIdNum = lastId + 1;
                 } else {
                     console.warn("Order counter lastId is not a number. Resetting.");
                 }
            }
            // *** Use the "OM-" prefix for Online Orders ***
            newOrderId = `OM-${nextOrderIdNum}`;

            const newOrderPayload = {
                orderId: newOrderId, // The OM-xxxx ID
                customerId: customerId,
                // Create the customerDetails snapshot for the 'orders' collection
                customerDetails: {
                    fullName: fullName,
                    whatsappNo: whatsappNo, // Mapped from customerContact
                    address: address,      // Mapped from customerAddress (if exists)
                    contactNo: contactNo     // Mapped from customerContact
                    // customCustomerId: customCustomerId // Optional
                },
                // Use the mapped items array
                items: itemsFromOnlineOrder,
                totalAmount: totalAmount, // Mapped from subtotal
                subTotal: itemsFromOnlineOrder.reduce((sum, item) => sum + (item.itemAmount ?? 0), 0), // Recalculate subtotal from items
                discountPercentage: 0, // Default values
                discountAmount: 0,
                finalAmount: totalAmount, // Assuming no discount initially
                orderDate: onlineOrderData.createdAt || serverTimestamp(), // Use online order creation time
                deliveryDate: null, // No delivery date from online order usually
                status: "Order Received", // Initial status
                urgent: "No", // Default
                remarks: `${orderRemarks}${designFileUrl ? `\nOnline Design File: ${designFileUrl}` : ''}`.trim(), // Combine remarks
                paymentStatus: "Pending",
                amountPaid: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                statusHistory: [{ status: "Order Received", timestamp: serverTimestamp() }],
                linkedPOs: [],
                orderSource: 'Online' // Add the source field
            };

            const newHistoryOrderRef = doc(collection(db, "orders")); // Generate ref for new doc in 'orders'
            transaction.set(newHistoryOrderRef, newOrderPayload); // Save the data
            transaction.set(orderCounterRef, { lastId: nextOrderIdNum }, { merge: true }); // Update the counter
            return newHistoryOrderRef; // Return the reference to the newly created order
        });

        console.log(`Order saved to 'orders'. New Doc ID: ${newOrderRef.id}, Generated Order ID: ${newOrderId}`);

        // --- 5. Delete from 'online_orders' ---
        await deleteDoc(onlineOrderRef);
        console.log(`Online order ${onlineOrderId} deleted.`);

        alert(`Order ${newOrderId} processed successfully and moved to Order History!`);
        loadOrders(); // Refresh the list of online orders

    } catch (error) {
        console.error(`Error processing order ${onlineOrderId}:`, error);
        alert(`Error processing order: ${error.message}`);
    } finally {
        // Ensure button is re-enabled regardless of success or failure
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
                      // Confirmation dialog before processing
                      if (confirm(`Process Online Order ${orderId.substring(0,8)}...? This will create Order ID OM-XXXX, move it to main history, and delete it from this list.`)) {
                          processOrder(orderId, processButton);
                      }
                 }
             }
        });
    } else {
        console.error("Orders table body (orders-tbody) not found!");
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

    // Close modal if clicked outside the content area
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
        // User is logged in, initialize the page features
        initializeOrderPage();
    } else {
        // User is not logged in, redirect to login page
        console.log("User not logged in for Online Order View, redirecting...");
        // Adjust the path to your login page if it's different
        if (!window.location.pathname.includes('login.html')) {
             window.location.replace('login.html');
        }
    }
});

console.log("view-online-orders.js loaded (with OM- prefix and field fixes).");