// /admin/js/pending_agent_orders.js

// Firebase फ़ंक्शंस import करें
import { db, auth } from './firebase-init.js'; 
import { 
    collection, query, orderBy, onSnapshot, Timestamp, serverTimestamp,
    doc, getDoc, deleteDoc, addDoc, runTransaction, writeBatch, // Processing के लिए Imports
    where, limit, getDocs, arrayUnion // Customer check और History के लिए Imports
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// Auth state check की यहाँ खास जरूरत नहीं क्योंकि यह एडमिन पेज है

// --- Helper Functions ---
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') unsafe = String(unsafe || ''); return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");}
function formatTimestamp(timestamp, includeTime = false) { if (!timestamp || typeof timestamp.toDate !== 'function') return 'N/A'; try { const date = timestamp.toDate(); const optionsDate = { day: '2-digit', month: 'short', year: 'numeric' }; const optionsTime = { hour: 'numeric', minute: '2-digit', hour12: true }; let formattedString = date.toLocaleDateString('en-GB', optionsDate); if (includeTime) { formattedString += ', ' + date.toLocaleTimeString('en-US', optionsTime); } return formattedString; } catch (e) { console.error("Error formatting timestamp:", e); return 'Invalid Date'; } }
function formatCurrency(amount) { const num = Number(amount); return isNaN(num) ? 'N/A' : num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });}

// --- Function to get next Numeric ID using Firestore Counter ---
async function getNextNumericId(counterName, startId = 101) {
    if (!db || !doc || !runTransaction) throw new Error("Firestore functions not available for counter.");
    const counterRef = doc(db, "counters", counterName);
    try {
        const nextIdNum = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let nextId = startId;
            if (counterDoc.exists() && counterDoc.data().lastId) {
                const lastId = Number(counterDoc.data().lastId);
                 if(!isNaN(lastId)) {
                    nextId = lastId + 1;
                 } else {
                     console.warn(`Counter '${counterName}' lastId is invalid, resetting to startId.`);
                     nextId = startId; 
                 }
            } else {
                console.log(`Counter '${counterName}' not found, starting at ${startId}.`);
            }
            nextId = Math.max(nextId, startId); 
            transaction.set(counterRef, { lastId: nextId }, { merge: true });
            return nextId;
        });
        return nextIdNum;
    } catch (error) {
        console.error(`Error getting next ID for ${counterName}:`, error);
        throw new Error(`Failed to generate numeric ID for ${counterName}. Error: ${error.message}`);
    }
}

// --- Function to get next Order ID ---
async function getNextOrderId(prefix = "OM-", startId = 1001) {
    const numericId = await getNextNumericId("orderCounter", startId); // Use 'orderCounter'
    return `${prefix}${numericId}`;
}


// --- Main Logic ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Admin Pending Agent Orders JS Initializing...");

    const tableBody = document.getElementById('pendingAgentOrdersTableBody');
    const loadingMessage = document.getElementById('loadingPendingOrdersMessage');
    let unsubscribePendingOrders = null; 

    if (!tableBody || !loadingMessage || !db) {
        console.error("Error: Table body, loading message, or DB connection not found.");
        if(tableBody) tableBody.innerHTML = '<tr><td colspan="6" style="color: red; text-align: center;">Page Error: Cannot load orders.</td></tr>';
        return; 
    }

    // एक पेंडिंग ऑर्डर की पंक्ति (row) बनाने का फ़ंक्शन
    function displayPendingOrderRow(orderId, orderData) { /* ... (जैसा Step 3.2 में था) ... */ if (!tableBody) return; const row = tableBody.insertRow(); row.setAttribute('data-id', orderId); const submittedAt = formatTimestamp(orderData.submittedAt, true); const agentDisplay = escapeHtml(orderData.agentEmail || orderData.agentId || 'Unknown Agent'); const customerName = escapeHtml(orderData.customerDetails?.fullName || 'N/A'); let itemsSummary = "N/A"; if (orderData.items && orderData.items.length > 0) { itemsSummary = orderData.items.map(item => `${escapeHtml(item.productName || '?')} (Qty: ${escapeHtml(item.quantity || '?')})`).join(', '); if (itemsSummary.length > 60) itemsSummary = itemsSummary.substring(0, 60) + "..."; } const totalAmount = formatCurrency(orderData.finalAmount); row.innerHTML = `<td>${submittedAt}</td><td>${agentDisplay}</td><td>${customerName}</td><td title="${escapeHtml(itemsSummary)}">${itemsSummary}</td><td style="text-align: right;">${totalAmount}</td><td> <div class="action-buttons-container"> <button class="button action-button process-order-button" data-action="process" data-id="${orderId}" title="Process Order"><i class="fas fa-check"></i> Process</button> <button class="button action-button view-order-button" data-action="view" data-id="${orderId}" title="View Details"><i class="fas fa-eye"></i> View</button> <button class="button action-button cancel-order-button" data-action="cancel" data-id="${orderId}" title="Cancel/Delete Pending Order"><i class="fas fa-times"></i> Cancel</button> </div> </td>`; }
    
    // पेंडिंग ऑर्डर्स लोड करने का फ़ंक्शन (onSnapshot)
    function loadPendingOrders() { /* ... (जैसा Step 3.2 में था) ... */ console.log("Setting up listener for 'pendingAgentOrders'..."); if (loadingMessage) loadingMessage.style.display = 'table-row'; if (tableBody) { const rows = tableBody.querySelectorAll('tr:not(#loadingPendingOrdersMessage)'); rows.forEach(row => row.remove()); } if (unsubscribePendingOrders) { unsubscribePendingOrders(); console.log("Previous listener stopped."); } try { const pendingOrdersRef = collection(db, "pendingAgentOrders"); const q = query(pendingOrdersRef, orderBy("submittedAt", "desc")); unsubscribePendingOrders = onSnapshot(q, (snapshot) => { console.log(`Snapshot: Received ${snapshot.docs.length} pending orders.`); if (loadingMessage) loadingMessage.style.display = 'none'; if (tableBody) { const currentRows = tableBody.querySelectorAll('tr:not(#loadingPendingOrdersMessage)'); currentRows.forEach(row => row.remove()); } if (snapshot.empty) { if (tableBody) { tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #6c757d;">No pending agent orders found.</td></tr>'; } } else { snapshot.docs.forEach((doc) => { displayPendingOrderRow(doc.id, doc.data()); }); } }, (error) => { console.error("Error fetching pending orders:", error); if (loadingMessage) loadingMessage.style.display = 'none'; if (tableBody) { tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red; padding: 20px;">Error loading: ${error.message}</td></tr>`; } }); } catch (error) { console.error("Error setting up listener:", error); if (loadingMessage) loadingMessage.style.display = 'none'; if (tableBody) { tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red; padding: 20px;">Error setting up listener.</td></tr>`; } } }

    // --- <<< प्रोसेस एजेंट ऑर्डर फ़ंक्शन (Implemented) >>> ---
    async function processAgentOrder(pendingOrderId, buttonElement) {
        console.log(`Processing order ID: ${pendingOrderId}`);
        // Firestore फंक्शन्स की उपलब्धता जांचें
        if (!db || !doc || !getDoc || !addDoc || !deleteDoc || !collection || !serverTimestamp || !Timestamp || !runTransaction || !query || !where || !limit || !getDocs || !writeBatch || !arrayUnion) {
            alert("Error: Database functions missing. Cannot process order.");
            if(buttonElement){ buttonElement.disabled = false; buttonElement.innerHTML = '<i class="fas fa-check"></i> Process'; } // Restore button
            return;
        }

        // बटन को डिसेबल करें और लोडिंग दिखाएं
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        const originalButtonHTML = '<i class="fas fa-check"></i> Process'; 

        try {
            // 1. पेंडिंग ऑर्डर का डेटा प्राप्त करें
            const pendingOrderRef = doc(db, "pendingAgentOrders", pendingOrderId);
            const pendingOrderSnap = await getDoc(pendingOrderRef);

            if (!pendingOrderSnap.exists()) {
                throw new Error(`Pending order ${pendingOrderId} not found (maybe already processed or cancelled).`);
            }
            const pendingOrderData = pendingOrderSnap.data();

            // 2. ग्राहक जांचें/बनाएं
            const customerName = pendingOrderData.customerDetails?.fullName?.trim();
            const whatsappNo = pendingOrderData.customerDetails?.whatsappNo?.trim();
            if (!whatsappNo || !customerName) {
                throw new Error("Customer name or WhatsApp number missing in pending order data.");
            }

            let customerId = null;
            let customerDocData = null; 
            const customersRef = collection(db, "customers");
            const qCust = query(customersRef, where("whatsappNo", "==", whatsappNo), limit(1));
            const customerQuerySnap = await getDocs(qCust);

            if (!customerQuerySnap.empty) {
                const existingDoc = customerQuerySnap.docs[0];
                customerId = existingDoc.id;
                customerDocData = { id: customerId, ...existingDoc.data() }; 
                console.log(`Existing customer found: ID=${customerId}`);
                // Optional: Update existing customer address/contact if needed from pending order?
                // For now, we'll just use the existing ID.
            } else {
                console.log("Customer not found, creating new one...");
                try {
                    const customCustomerId = await getNextNumericId("customerCounter", 101); 
                    const newCustomerData = { 
                        fullName: customerName,
                        fullNameLower: customerName.toLowerCase(),
                        whatsappNo: whatsappNo, 
                        contactNo: pendingOrderData.customerDetails?.contactNo || null, 
                        billingAddress: pendingOrderData.customerDetails?.address || null,
                        address: pendingOrderData.customerDetails?.address || null, 
                        createdAt: serverTimestamp(), 
                        updatedAt: serverTimestamp(), 
                        customCustomerId: customCustomerId, 
                        status: 'active', 
                        creditAllowed: false, 
                        creditLimit: 0,
                        // You might want to add an 'addedByAgent' field here
                        // addedByAgent: pendingOrderData.agentId || null 
                    };
                    const newCustomerRef = await addDoc(customersRef, newCustomerData);
                    customerId = newCustomerRef.id;
                    // For consistency, set customerDocData even for new customer
                    customerDocData = { id: customerId, ...newCustomerData, customCustomerId: customCustomerId }; 
                    console.log(`New customer created: FirestoreID=${customerId}, CustomID=${customCustomerId}`);
                } catch(e) {
                    console.error("Error creating customer during processing:", e);
                    throw new Error(`Failed to create new customer: ${e.message}`);
                }
            }
            if (!customerId || !customerDocData) {
                throw new Error("Failed to link or create customer record.");
            }

            // 3. नया मुख्य ऑर्डर आईडी जेनरेट करें
            const mainOrderId = await getNextOrderId("OM-", 1001); 

            // 4. मुख्य 'orders' कलेक्शन के लिए पेलोड तैयार करें
            const mainOrderData = {
                orderId: mainOrderId, 
                agentId: pendingOrderData.agentId || null,
                agentEmail: pendingOrderData.agentEmail || null,
                customerId: customerId, 
                customerDetails: { // Store consistent customer details with the main order
                    fullName: customerDocData.fullName, 
                    whatsappNo: customerDocData.whatsappNo, 
                    address: customerDocData.billingAddress || customerDocData.address, 
                    contactNo: customerDocData.contactNo 
                },
                orderDate: pendingOrderData.submittedAt || serverTimestamp(), // Use submitted time as order date
                deliveryDate: pendingOrderData.deliveryDate || null, // Copy delivery date if provided
                urgent: pendingOrderData.urgent || 'No',
                remarks: pendingOrderData.remarks || '',
                status: "Order Received", // Initial status for main order
                items: pendingOrderData.items || [], // Copy items list
                subTotal: pendingOrderData.subTotal || 0,
                discountPercentage: pendingOrderData.discountPercentage || 0,
                discountAmount: pendingOrderData.discountAmount || 0,
                totalAmount: pendingOrderData.finalAmount || 0, // Use finalAmount from pending
                finalAmount: pendingOrderData.finalAmount || 0, // Store finalAmount as well
                paymentStatus: "Pending", 
                amountPaid: 0,            
                createdAt: serverTimestamp(), 
                updatedAt: serverTimestamp(),
                statusHistory: [{ status: "Order Received", timestamp: Timestamp.now() }], // Initial history
                linkedPOs: [], 
                orderSource: 'Agent' // Mark source as Agent
            };

            // --- (वैकल्पिक) स्टॉक अपडेट लॉजिक ---
            // const stockUpdates = []; 
            // for (const item of mainOrderData.items) { ... }
            // console.log("Stock update logic pending implementation.");
            // ---------------------------------

            // 5. Batch Write: मुख्य ऑर्डर बनाएं और पेंडिंग ऑर्डर डिलीट करें
            const batch = writeBatch(db);
            const newMainOrderRef = doc(collection(db, "orders")); 
            batch.set(newMainOrderRef, mainOrderData);
            batch.delete(pendingOrderRef); 
            // --- स्टॉक अपडेट बैच में जोड़ें ---
            // stockUpdates.forEach(update => batch.update(update.ref, { stock: ... }));
            // ---------------------------------
            await batch.commit(); // Execute batch

            console.log(`Order ${pendingOrderId} processed successfully. New Order ID: ${mainOrderId} created in 'orders'.`);
            alert(`Order ${mainOrderId} processed successfully and moved to main Order History!`);
            // onSnapshot अपने आप UI से पंक्ति हटा देगा
            // No need to re-enable button here, the row disappears

        } catch (error) {
            console.error(`Error processing order ${pendingOrderId}:`, error);
            alert(`Error processing order: ${error.message}`);
            // एरर होने पर बटन को फिर से सक्षम करें
            buttonElement.disabled = false;
            buttonElement.innerHTML = originalButtonHTML; // Restore original HTML
        } 
    }
    // --- <<< एंड ऑफ़ प्रोसेस एजेंट ऑर्डर फ़ंक्शन >>> ---


    // --- टेबल एक्शन के लिए इवेंट लिस्नर (अपडेटेड) ---
    if (tableBody) {
        tableBody.addEventListener('click', (event) => {
            const targetButton = event.target.closest('button.action-button');
            if (!targetButton) return;

            const action = targetButton.dataset.action; 
            const orderId = targetButton.closest('tr')?.dataset.id; 

            if (!orderId || !action) return;

            console.log(`Action Clicked: ${action}, Order Firestore ID: ${orderId}`);

            if (action === 'process') {
                // नया processAgentOrder फ़ंक्शन कॉल करें
                processAgentOrder(orderId, targetButton); 
            } else if (action === 'view') {
                alert(`View button clicked for Order ID: ${orderId}. Functionality pending.`);
                // openPendingOrderDetailsModal(orderId); 
            } else if (action === 'cancel') {
                 if (confirm(`Are you sure you want to cancel/delete pending order ${orderId}? This cannot be undone.`)) {
                     cancelPendingAgentOrder(orderId, targetButton); 
                 }
            }
        });
    }

    // --- पेंडिंग ऑर्डर को कैंसिल/डिलीट करने का फ़ंक्शन (पहले जैसा) ---
    async function cancelPendingAgentOrder(orderId, buttonElement) { /* ... (जैसा पहले था) ... */ if (!db || !doc || !deleteDoc) { alert("Error: Delete function not available."); if(buttonElement) buttonElement.disabled = false; return; } if(buttonElement){ buttonElement.disabled = true; buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; } try { const orderRef = doc(db, "pendingAgentOrders", orderId); await deleteDoc(orderRef); console.log(`Pending order ${orderId} cancelled/deleted successfully.`); alert(`Pending order ${orderId.substring(0,6)}... cancelled successfully.`); } catch (error) { console.error(`Error cancelling pending order ${orderId}:`, error); alert(`Failed to cancel pending order: ${error.message}`); if(buttonElement){ buttonElement.disabled = false; buttonElement.innerHTML = '<i class="fas fa-times"></i> Cancel'; } } }

    // पेज लोड होने पर पेंडिंग ऑर्डर्स लोड करें
    loadPendingOrders();

    console.log("Admin Pending Agent Orders JS Initialized and Listener Active.");
});

// --- Functions to be implemented later ---
// function openPendingOrderDetailsModal(orderId) { ... }