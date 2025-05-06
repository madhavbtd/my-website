// /agent/js/agent_order_history.js

// Firebase functions और इंस्टेंस इम्पोर्ट करें
import { db, auth } from './agent_firebase_config.js';
import { 
    collection, query, where, orderBy, onSnapshot, Timestamp 
} from './agent_firebase_config.js'; // Firestore functions from config
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- DOM Elements ---
const tableBody = document.getElementById('agentOrderHistoryTableBody');
const loadingMessage = document.getElementById('loadingAgentHistoryMessage');
const noOrdersMessage = document.getElementById('noAgentOrdersMessage');
let unsubscribeAgentOrders = null; // Listener को बंद करने के लिए

// --- Helper Functions ---
function escapeHtml(unsafe) { /* ... (जैसा पहले था) ... */ if (typeof unsafe !== 'string') unsafe = String(unsafe || ''); return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");}
function formatTimestamp(timestamp) { /* ... (जैसा पहले था, बिना time) ... */ if (!timestamp || typeof timestamp.toDate !== 'function') return 'N/A'; try { const date = timestamp.toDate(); const optionsDate = { day: '2-digit', month: 'short', year: 'numeric' }; return date.toLocaleDateString('en-GB', optionsDate); } catch (e) { console.error("Error formatting timestamp:", e); return 'Invalid Date'; } }
function formatCurrency(amount) { /* ... (जैसा पहले था) ... */ const num = Number(amount); return isNaN(num) ? 'N/A' : num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });}
function getStatusClass(status) { /* ... (जैसा order_history.css में है) ... */ if (!status) return 'status-unknown'; const normalizedStatus = status.toLowerCase().replace(/\s+/g, '-'); const statusClasses = ['order-received', 'designing', 'verification', 'design-approved', 'ready-for-working', 'printing', 'delivered', 'completed', 'cancelled']; return statusClasses.includes(normalizedStatus) ? `status-${normalizedStatus}` : 'status-unknown';}


// --- Main Logic ---

// एजेंट के ऑर्डर्स को लोड और डिस्प्ले करने का फ़ंक्शन
function loadAgentOrderHistory(agentId) {
    if (!tableBody || !loadingMessage || !noOrdersMessage || !db) {
        console.error("History Table elements or DB not found.");
        return;
    }
    console.log(`Loading order history for agent: ${agentId}`);

    loadingMessage.style.display = 'table-row';
    noOrdersMessage.style.display = 'none';
    // मौजूदा पंक्तियाँ साफ़ करें (लोडिंग पंक्ति को छोड़कर)
    const rows = tableBody.querySelectorAll('tr:not(#loadingAgentHistoryMessage)');
    rows.forEach(row => row.remove());

    // पिछला लिस्नर बंद करें
    if (unsubscribeAgentOrders) {
        unsubscribeAgentOrders();
        console.log("Previous agent orders listener stopped.");
    }

    try {
        const ordersRef = collection(db, "orders"); // मुख्य 'orders' कलेक्शन को सुनें
        
        // क्वेरी: केवल इस एजेंट के ऑर्डर्स लाएं (agentId फील्ड पर फ़िल्टर करें), createdAt के अनुसार सॉर्ट करें
        const q = query(ordersRef, 
                        where("agentId", "==", agentId), 
                        orderBy("createdAt", "desc") // सबसे नया पहले
                       ); 

        unsubscribeAgentOrders = onSnapshot(q, (snapshot) => {
            console.log(`Agent History Snapshot: Received ${snapshot.docs.length} orders.`);
            loadingMessage.style.display = 'none';
            
            // टेबल बॉडी फिर से साफ़ करें
            const currentRows = tableBody.querySelectorAll('tr:not(#loadingAgentHistoryMessage)');
            currentRows.forEach(row => row.remove());

            if (snapshot.empty) {
                noOrdersMessage.style.display = 'table-row';
            } else {
                noOrdersMessage.style.display = 'none';
                snapshot.docs.forEach((doc) => {
                    displayAgentOrderRow(doc.id, doc.data());
                });
            }

        }, (error) => {
            console.error("Error fetching agent order history:", error);
            loadingMessage.style.display = 'none';
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error loading order history: ${error.message}</td></tr>`;
        });

    } catch (error) {
        console.error("Error setting up agent order history listener:", error);
        loadingMessage.style.display = 'none';
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error setting up listener.</td></tr>`;
    }
}

// एक ऑर्डर पंक्ति (row) डिस्प्ले करने का फ़ंक्शन
function displayAgentOrderRow(orderId, orderData) {
    if (!tableBody) return;

    const row = tableBody.insertRow();
    row.setAttribute('data-id', orderId); // Firestore Doc ID

    const displayOrderId = escapeHtml(orderData.orderId || `Sys:${orderId.substring(0,6)}`);
    const orderDate = formatTimestamp(orderData.orderDate || orderData.createdAt);
    const customerName = escapeHtml(orderData.customerDetails?.fullName || 'N/A');
    
    let itemsSummary = "N/A";
    if (orderData.items && orderData.items.length > 0) {
        itemsSummary = orderData.items.map(item => 
            `${escapeHtml(item.productName || '?')} (Qty: ${escapeHtml(item.quantity || '?')})`
        ).join(', ');
        if (itemsSummary.length > 50) itemsSummary = itemsSummary.substring(0, 50) + "...";
    }

    const totalAmount = formatCurrency(orderData.finalAmount);
    const status = escapeHtml(orderData.status || 'Unknown');
    const statusClass = getStatusClass(status);

    row.innerHTML = `
        <td>${displayOrderId}</td>
        <td>${orderDate}</td>
        <td>${customerName}</td>
        <td title="${escapeHtml(itemsSummary)}">${itemsSummary}</td>
        <td style="text-align: right;">${totalAmount}</td>
        <td style="text-align: center;"><span class="status-badge ${statusClass}">${status}</span></td>
        <td style="text-align: center;">
            <button class="button action-button view-details-button" data-action="view-details" data-id="${orderId}" title="View Order Details">
                <i class="fas fa-eye"></i> View
            </button>
        </td>
    `;
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Agent Order History JS Initializing...");
    
    // Auth स्थिति जांचें और फिर डेटा लोड करें
    onAuthStateChanged(auth, (user) => {
        const agentWelcomeMessageCommon = document.getElementById('agentWelcomeMessage'); 
        if (user) {
            console.log("Agent authenticated:", user.uid);
            if(agentWelcomeMessageCommon) agentWelcomeMessageCommon.textContent = `Welcome, ${user.email || 'Agent'}`;
            loadAgentOrderHistory(user.uid); // Current agent की ID पास करें

            // Logout बटन (कॉमन कोड)
            const agentLogoutBtnCommon = document.getElementById('agentLogoutBtn'); 
            if (agentLogoutBtnCommon) {
                agentLogoutBtnCommon.addEventListener('click', () => {
                     if (confirm("Are you sure you want to logout?")) {
                        auth.signOut().then(() => {
                            window.location.href = 'agent_login.html'; 
                        }).catch((error) => {
                            console.error("Agent Logout Error:", error);
                            alert("Logout failed.");
                        });
                    }
                });
            }

            // टेबल में एक्शन बटन के लिए लिस्नर (View Details)
            if(tableBody) {
                tableBody.addEventListener('click', (event) => {
                    const targetButton = event.target.closest('button.action-button');
                    if (!targetButton) return;

                    const action = targetButton.dataset.action;
                    const orderId = targetButton.dataset.id;

                    if (action === 'view-details' && orderId) {
                        alert(`View details clicked for order: ${orderId}. Functionality pending (needs a modal or detail page for agents).`);
                        // Future: openAgentOrderDetailModal(orderId);
                    }
                });
            }

        } else {
            console.log("Agent not logged in. Redirecting...");
            window.location.replace('agent_login.html'); 
        }
    });

    console.log("Agent Order History JS Initialized.");
});