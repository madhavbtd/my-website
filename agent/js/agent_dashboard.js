// /agent/js/agent_dashboard.js

// Import Firebase functions and instances from agent_firebase_config.js
import { auth, db, onAuthStateChanged } from './agent_firebase_config.js';
// Firestore functions used in this file
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from './agent_firebase_config.js';
import { updateNavigation } from './agent_main.js'; // इम्पोर्ट

document.addEventListener('DOMContentLoaded', () => {
    console.log("Agent Dashboard JS Initializing...");

    const agentWelcomeMessageEl = document.getElementById('agentWelcomeMessage');
    const agentLogoutBtnEl = document.getElementById('agentLogoutBtn');
    const recentOrdersWidgetEl = document.getElementById('recentOrdersWidget');
    const accountSummaryWidgetEl = document.getElementById('accountSummaryWidget');
    // Add more widget elements here according to your dashboard HTML

    let currentUser = null;
    let agentData = null; // To store agent's Firestore document data

    // Helper Functions (Can be moved to a common utils.js file if needed)
    function formatCurrency(amount) {
        const num = Number(amount);
        return isNaN(num) ? 'N/A' : num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function formatDateForDisplay(timestamp) {
        if (!timestamp || typeof timestamp.toDate !== 'function') return 'N/A';
        try {
            return timestamp.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch (e) { return 'Invalid Date'; }
    }

    // Logout Button Event Listener
    if (agentLogoutBtnEl) {
        agentLogoutBtnEl.addEventListener('click', () => {
            if (confirm("Are you sure you want to logout?")) { // Translated
                auth.signOut().then(() => {
                    console.log("Agent logged out successfully.");
                    window.location.href = 'agent_login.html';
                }).catch((error) => {
                    console.error("Agent Logout Error:", error);
                    alert("Logout failed. Please try again."); // Translated
                });
            }
        });
    }

    // Authentication State Check
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            console.log("Agent User authenticated:", user.uid);

            // Fetch agent's Firestore document
            try {
                const agentDocRef = doc(db, "agents", currentUser.uid);
                const agentDocSnap = await getDoc(agentDocRef);

                if (agentDocSnap.exists() && agentDocSnap.data().role === 'agent' && agentDocSnap.data().status === 'active') {
                    agentData = agentDocSnap.data(); // Store agent data
                    if (agentWelcomeMessageEl) {
                        agentWelcomeMessageEl.textContent = `Welcome, ${agentData.name || user.email || 'Agent'}`;
                    }

                    // परमिशन के आधार पर नेविगेशन अपडेट करें
                    const agentPermissions = agentData.permissions || [];
                    updateNavigation(agentPermissions);

                    // अब एजेंट-विशिष्ट डेटा लोड करें
                    loadRecentOrders(currentUser.uid);
                    loadAccountSummary(currentUser.uid);
                    // Load other dashboard widgets
                } else {
                    console.error("Agent document not found, or role/status is not valid. Logging out.");
                    alert("Your agent account is not valid or not active. Please contact admin."); // Translated
                    auth.signOut(); // Log out for security
                    window.location.href = 'agent_login.html';
                }
            } catch (error) {
                console.error("Error fetching agent document:", error);
                alert("Error loading your profile. Please try again."); // Translated
                auth.signOut();
                window.location.href = 'agent_login.html';
            }
        } else {
            console.log("Agent User is not authenticated. Redirecting to login.");
            if (!window.location.pathname.endsWith('agent_login.html')) {
                window.location.replace('agent_login.html');
            }
        }
    });

    // Function to load recent orders
    async function loadRecentOrders(agentId) {
        console.log(`Loading recent orders for agent ${agentId}...`);
        if (!recentOrdersWidgetEl) return;
        recentOrdersWidgetEl.innerHTML = "<p><em>Loading recent orders...</em></p>"; // Translated
        try {
            const ordersRef = collection(db, "orders"); // Main 'orders' collection
            const q = query(
                ordersRef,
                where("agentId", "==", agentId), // Only this agent's orders
                orderBy("createdAt", "desc"), // Newest first
                limit(5) // Example: only 5 recent orders
            );
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                recentOrdersWidgetEl.innerHTML = "<p><em>No recent orders found.</em></p>"; // Translated
            } else {
                let html = '<h5>Your Recent Orders:</h5><ul>'; // Translated
                snapshot.forEach(doc => {
                    const order = doc.data();
                    // Ensure orderId exists, otherwise fallback to a truncated doc.id
                    const displayOrderId = order.orderId || `Sys:${doc.id.substring(0, 6)}`;
                    // Prioritize createdAt if available, fallback to orderDate
                    const dateToFormat = order.createdAt || order.orderDate;
                    html += `<li>${formatDateForDisplay(dateToFormat)} - Order #${displayOrderId} (${order.customerDetails?.fullName || 'N/A'}) - Status: ${order.status || 'N/A'}</li>`; // Translated status
                });
                html += '</ul><p><a href="agent_order_history.html">View All Orders</a></p>'; // Translated link text
                recentOrdersWidgetEl.innerHTML = html;
            }
        } catch (error) {
            console.error("Error loading recent orders:", error); // Translated error log
            recentOrdersWidgetEl.innerHTML = "<p style='color:red;'>Error loading recent orders.</p>"; // Translated error message
        }
    }

    // Function to load account summary
    async function loadAccountSummary(agentId) {
        console.log(`Loading account summary for agent ${agentId}...`);
        if (!accountSummaryWidgetEl) return;
        accountSummaryWidgetEl.innerHTML = "<p><em>Loading account summary...</em></p>"; // Translated
        try {
            const ledgerQuery = query(
                collection(db, "agentLedger"),
                where("agentId", "==", agentId)
            );
            const snapshot = await getDocs(ledgerQuery);
            let totalCommission = 0;
            let totalPaid = 0;
            snapshot.forEach(doc => {
                const entry = doc.data();
                if (entry.type === 'commission') {
                    totalCommission += entry.amount || 0;
                } else if (entry.type === 'payment') {
                    totalPaid += entry.amount || 0;
                }
            });
            const outstanding = totalCommission - totalPaid;
            accountSummaryWidgetEl.innerHTML = `
                <h5>Your Account Summary:</h5>
                <p><strong>Total Commission Earned:</strong> ${formatCurrency(totalCommission)}</p>
                <p><strong>Total Paid to You:</strong> ${formatCurrency(totalPaid)}</p>
                <p><strong>Outstanding Balance:</strong> ${formatCurrency(outstanding)}</p>
                <p><a href="agent_ledger.html">View Full Ledger</a></p>
            `; // Translated labels and link text
        } catch (error) {
            console.error("Error loading account summary:", error); // Translated error log
            accountSummaryWidgetEl.innerHTML = "<p style='color:red;'>Error loading account summary.</p>"; // Translated error message
        }
    }

    console.log("Agent Dashboard JS Initialized and listeners potentially active.");
});