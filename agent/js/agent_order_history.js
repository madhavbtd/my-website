// /agent/js/agent_order_history.js

// Import Firebase functions and instances
import { db, auth } from './agent_firebase_config.js';
import {
    collection, query, where, orderBy, onSnapshot, Timestamp
} from './agent_firebase_config.js'; // Firestore functions from config
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"; // Also import getDoc

// --- DOM Elements ---
const tableBody = document.getElementById('agentOrderHistoryTableBody');
const loadingMessageRowEl = document.getElementById('loadingAgentHistoryMessage'); // The <tr> element
const noOrdersMessageRowEl = document.getElementById('noAgentOrdersMessageRow'); // The <tr> element containing the message <p>
const noOrdersMessageParagraphEl = document.getElementById('noAgentOrdersMessage'); // The <p> element itself
const agentWelcomeMessageEl = document.getElementById('agentWelcomeMessage'); // From header
const agentLogoutBtnEl = document.getElementById('agentLogoutBtn'); // From header

let currentUser = null;
let agentPermissions = { role: null, status: 'inactive' }; // To store agent permissions
let unsubscribeAgentOrders = null; // To stop the listener

// --- Helper Functions ---
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') unsafe = String(unsafe || ''); return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");}
function formatTimestamp(timestamp) { if (!timestamp || typeof timestamp.toDate !== 'function') return 'N/A'; try { const date = timestamp.toDate(); const optionsDate = { day: '2-digit', month: 'short', year: 'numeric' }; return date.toLocaleDateString('en-GB', optionsDate); } catch (e) { console.error("Error formatting timestamp:", e); return 'Invalid Date'; } }
function formatCurrency(amount) { const num = Number(amount); return isNaN(num) ? 'N/A' : num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });}
function getStatusClass(status) { if (!status) return 'status-unknown'; const normalizedStatus = status.toLowerCase().replace(/\s+/g, '-'); const statusClasses = ['order-received', 'designing', 'verification', 'design-approved', 'ready-for-working', 'printing', 'delivered', 'completed', 'cancelled', 'pending-admin-approval']; return statusClasses.includes(normalizedStatus) ? `status-${normalizedStatus}` : 'status-unknown';}


// --- Main Logic ---

// Function to load and display agent's orders
async function loadAgentOrderHistory(agentId) {
    if (!tableBody || !loadingMessageRowEl || !noOrdersMessageRowEl || !db) {
        console.error("History Table elements or DB not found.");
        if (tableBody && loadingMessageRowEl) {
            loadingMessageRowEl.style.display = 'none';
            tableBody.innerHTML = `<tr><td colspan="7" style="color:red;">Error loading page.</td></tr>`; // English message
        }
        return;
    }
    console.log(`Loading order history for agent ${agentId}...`);

    loadingMessageRowEl.style.display = 'table-row';
    noOrdersMessageRowEl.style.display = 'none';
    // Clear previous rows except the loading/no-orders rows
    const rows = tableBody.querySelectorAll('tr:not(#loadingAgentHistoryMessage):not(#noAgentOrdersMessageRow)');
    rows.forEach(row => row.remove());

    if (unsubscribeAgentOrders) {
        unsubscribeAgentOrders();
        console.log("Previous agent order listener stopped.");
    }

    try {
        const ordersRef = collection(db, "orders"); // Listen to the main 'orders' collection

        // Query: Fetch only orders for this agent (filter by agentId), sort by createdAt
        const q = query(ordersRef,
                        where("agentId", "==", agentId), // Filter by agentId
                        orderBy("createdAt", "desc") // Newest first
                       );

        unsubscribeAgentOrders = onSnapshot(q, (snapshot) => {
            console.log(`Agent history snapshot: ${snapshot.docs.length} orders received.`);
            loadingMessageRowEl.style.display = 'none';

            const currentDataRows = tableBody.querySelectorAll('tr:not(#loadingAgentHistoryMessage):not(#noAgentOrdersMessageRow)');
            currentDataRows.forEach(row => row.remove()); // Ensure old rows are removed

            if (snapshot.empty) {
                noOrdersMessageRowEl.style.display = 'table-row';
                // Ensure the paragraph element has the right message (it's static in HTML now)
                if(noOrdersMessageParagraphEl) noOrdersMessageParagraphEl.textContent = "You haven't submitted any orders yet."; // Ensure English message
            } else {
                noOrdersMessageRowEl.style.display = 'none';
                snapshot.docs.forEach((doc) => {
                    displayAgentOrderRow(doc.id, doc.data());
                });
            }

        }, (error) => {
            console.error("Error fetching agent order history:", error);
            loadingMessageRowEl.style.display = 'none';
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error loading order history: ${error.message}</td></tr>`; // English message
        });

    } catch (error) {
        console.error("Error setting up agent order history listener:", error);
        loadingMessageRowEl.style.display = 'none';
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error setting up listener.</td></tr>`; // English message
    }
}

// Function to display a single order row
function displayAgentOrderRow(orderFirestoreId, orderData) {
    if (!tableBody) return;

    // Check if row already exists to prevent duplicates from snapshot updates
    if (tableBody.querySelector(`tr[data-id="${orderFirestoreId}"]`)) {
        console.log(`Row for ${orderFirestoreId} already exists. Skipping.`);
        return; // Or update the existing row if needed
    }

    const row = tableBody.insertRow(); // Insert at the end
    row.setAttribute('data-id', orderFirestoreId);

    const displayOrderId = escapeHtml(orderData.orderId || `Sys:${orderFirestoreId.substring(0,6)}`);
    // Prioritize orderDate or createdAt
    const orderDateToFormat = orderData.orderDate || orderData.createdAt;
    const orderDate = formatTimestamp(orderDateToFormat);
    const customerName = escapeHtml(orderData.customerDetails?.fullName || 'N/A');

    let itemsSummary = "N/A";
    if (orderData.items && orderData.items.length > 0) {
        itemsSummary = orderData.items.map(item =>
            `${escapeHtml(item.productName || '?')} (Qty: ${escapeHtml(item.quantity || '?')})` // English label
        ).join(', ');
        if (itemsSummary.length > 50) itemsSummary = itemsSummary.substring(0, 50) + "...";
    }

    const totalAmount = formatCurrency(orderData.finalAmount ?? orderData.totalAmount); // Use finalAmount or totalAmount
    const status = escapeHtml(orderData.status || 'Unknown');
    const statusClass = getStatusClass(status);

    row.innerHTML = `
        <td>${displayOrderId}</td>
        <td>${orderDate}</td>
        <td>${customerName}</td>
        <td title="${escapeHtml(orderData.items?.map(i=>i.productName).join(', ') || '')}">${itemsSummary}</td>
        <td style="text-align: right;">${totalAmount}</td>
        <td style="text-align: center;"><span class="status-badge ${statusClass}">${status}</span></td>
        <td style="text-align: center;">
            <button class="button view-details-button small-button" data-action="view-details" data-id="${orderFirestoreId}" title="View Order Details">
                <i class="fas fa-eye"></i> View
            </button>
        </td>
    `; // English button text/title
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Agent Order History JS Initializing...");

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            if (agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = `Welcome, ${user.email || 'Agent'}`;

            try {
                const agentDocRef = doc(db, "agents", currentUser.uid);
                const agentDocSnap = await getDoc(agentDocRef);

                if (agentDocSnap.exists() && agentDocSnap.data().role === 'agent' && agentDocSnap.data().status === 'active') {
                    agentPermissions = agentDocSnap.data();
                    console.log("Agent authenticated (Order History) and permissions loaded:", agentPermissions);
                    loadAgentOrderHistory(currentUser.uid); // Pass current agent's ID
                } else {
                    console.error("Agent document not found or role/status invalid. Logging out.");
                    if(agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = "Invalid Agent Account.";
                    if(tableBody && loadingMessageRowEl) {
                        loadingMessageRowEl.style.display = 'none';
                        // Display error in table body
                         tableBody.innerHTML = `<tr><td colspan="7"><p class="form-message error">You are not authorized to view order history.</p></td></tr>`; // English message
                    }
                    // auth.signOut();
                    // window.location.href = 'agent_login.html';
                }
            } catch (error) {
                console.error("Error loading agent permissions:", error);
                 if(agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = "Error loading profile.";
                 if(tableBody && loadingMessageRowEl) {
                     loadingMessageRowEl.style.display = 'none';
                     tableBody.innerHTML = `<tr><td colspan="7"><p class="form-message error">Error loading permissions. (${error.message})</p></td></tr>`; // English message
                 }
                // auth.signOut();
                // window.location.href = 'agent_login.html';
            }
        } else {
            console.log("Agent not logged in on order history page. Redirecting...");
            window.location.replace('agent_login.html');
        }
    });

    // Logout button
    if (agentLogoutBtnEl) {
        agentLogoutBtnEl.addEventListener('click', () => {
            if (confirm("Are you sure you want to logout?")) { // Translated
                auth.signOut().then(() => {
                    window.location.href = 'agent_login.html';
                }).catch((error) => {
                    console.error("Agent Logout Error:", error);
                    alert("Logout failed."); // Translated
                });
            }
        });
    }

    // Listener for action buttons in the table (View Details)
    if(tableBody) {
        tableBody.addEventListener('click', (event) => {
            const targetButton = event.target.closest('button.view-details-button');
            if (!targetButton) return;

            const orderId = targetButton.dataset.id;
            if (orderId) {
                // Here you would open a Modal or a new page to show order details.
                // For now, just an alert.
                alert(`View Order Details: ${orderId}. (Functionality to be implemented)`); // Translated alert
                // Example: openAgentOrderDetailModal(orderId);
                // Or: window.location.href = `agent_order_detail.html?id=${orderId}`;
            }
        });
    }

    console.log("Agent Order History JS Initialized.");
});