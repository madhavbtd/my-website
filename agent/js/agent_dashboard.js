// /agent/js/agent_dashboard.js

// Firebase functions और इंस्टेंस agent_firebase_config.js से इम्पोर्ट करें
import { auth, db, onAuthStateChanged } from './agent_firebase_config.js'; 
// अन्य आवश्यक Firestore फ़ंक्शन (यदि आवश्यक हो)
// import { collection, query, where, orderBy, limit, getDocs, onSnapshot } from './agent_firebase_config.js'; 

document.addEventListener('DOMContentLoaded', () => {
    console.log("Agent Dashboard JS Initializing...");

    const agentWelcomeMessage = document.getElementById('agentWelcomeMessage');
    const agentLogoutBtn = document.getElementById('agentLogoutBtn');
    const recentOrdersWidget = document.getElementById('recentOrdersWidget');
    const accountSummaryWidget = document.getElementById('accountSummaryWidget');

    // Logout Button Event Listener
    if (agentLogoutBtn) {
        agentLogoutBtn.addEventListener('click', () => {
            auth.signOut().then(() => {
                console.log("Agent logged out successfully.");
                window.location.href = 'agent_login.html'; // लॉगिन पेज पर वापस भेजें
            }).catch((error) => {
                console.error("Agent Logout Error:", error);
                alert("Logout failed. Please try again.");
            });
        });
    }

    // Authentication State Check
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in
            console.log("Agent User authenticated:", user.uid);
            if (agentWelcomeMessage) {
                agentWelcomeMessage.textContent = `Welcome, ${user.email || 'Agent'}`;
            }
            
            // --- Load Dashboard Data (Functions to be implemented later) ---
            loadRecentOrders();
            loadAccountSummary();

        } else {
            // User is signed out
            console.log("Agent User is not authenticated. Redirecting to login.");
            // Ensure we are not already on login page to prevent loop
            if (!window.location.pathname.endsWith('agent_login.html')) {
                window.location.replace('agent_login.html');
            }
        }
    });

    // Placeholder function to load recent orders
    function loadRecentOrders() {
        console.log("Loading recent orders widget data (placeholder)...");
        if (recentOrdersWidget) {
            // Later, fetch data from Firestore and display here
            recentOrdersWidget.innerHTML = "<p><em>Recent order details will appear here.</em></p>"; 
        }
    }

    // Placeholder function to load account summary
    function loadAccountSummary() {
        console.log("Loading account summary widget data (placeholder)...");
        if (accountSummaryWidget) {
            // Later, fetch balance/commission data from Firestore
            accountSummaryWidget.innerHTML = "<p><em>Account balance/commission info will appear here.</em></p>"; 
        }
    }

    console.log("Agent Dashboard JS Initialized.");
});