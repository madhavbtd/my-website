// /agent/js/agent_dashboard.js

// Firebase functions और इंस्टेंस agent_firebase_config.js से इम्पोर्ट करें
import { auth, db, onAuthStateChanged } from './agent_firebase_config.js';
// Firestore फ़ंक्शंस जो इस फ़ाइल में उपयोग होंगे
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from './agent_firebase_config.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("Agent Dashboard JS Initializing...");

    const agentWelcomeMessageEl = document.getElementById('agentWelcomeMessage');
    const agentLogoutBtnEl = document.getElementById('agentLogoutBtn');
    const recentOrdersWidgetEl = document.getElementById('recentOrdersWidget');
    const accountSummaryWidgetEl = document.getElementById('accountSummaryWidget');
    // अपने डैशबोर्ड HTML के अनुसार और विजेट एलिमेंट्स यहाँ जोड़ें

    let currentUser = null;
    let agentData = null; // एजेंट का Firestore दस्तावेज़ डेटा स्टोर करने के लिए

    // Helper Functions (यदि आवश्यक हो, तो इन्हें एक सामान्य utils.js फ़ाइल में ले जा सकते हैं)
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
            if (confirm("क्या आप वाकई लॉग आउट करना चाहते हैं?")) {
                auth.signOut().then(() => {
                    console.log("Agent logged out successfully.");
                    window.location.href = 'agent_login.html';
                }).catch((error) => {
                    console.error("Agent Logout Error:", error);
                    alert("लॉगआउट विफल रहा। कृपया पुनः प्रयास करें।");
                });
            }
        });
    }

    // Authentication State Check
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            console.log("Agent User authenticated:", user.uid);

            // एजेंट का Firestore दस्तावेज़ फ़ेच करें
            try {
                const agentDocRef = doc(db, "agents", currentUser.uid);
                const agentDocSnap = await getDoc(agentDocRef);

                if (agentDocSnap.exists() && agentDocSnap.data().role === 'agent' && agentDocSnap.data().status === 'active') {
                    agentData = agentDocSnap.data(); // एजेंट का डेटा स्टोर करें
                    if (agentWelcomeMessageEl) {
                        agentWelcomeMessageEl.textContent = `Welcome, ${agentData.name || user.email || 'Agent'}`;
                    }
                    // अब एजेंट-विशिष्ट डेटा लोड करें
                    loadRecentOrders(currentUser.uid);
                    loadAccountSummary(currentUser.uid);
                    // अन्य डैशबोर्ड विजेट लोड करें
                } else {
                    console.error("Agent document not found, or role/status is not valid. Logging out.");
                    alert("आपका एजेंट खाता मान्य नहीं है या सक्रिय नहीं है। कृपया एडमिन से संपर्क करें।");
                    auth.signOut(); // सुरक्षा के लिए लॉग आउट करें
                    window.location.href = 'agent_login.html';
                }
            } catch (error) {
                console.error("Error fetching agent document:", error);
                alert("आपकी प्रोफ़ाइल लोड करने में त्रुटि हुई। कृपया पुनः प्रयास करें।");
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

    // हाल के ऑर्डर लोड करने का फ़ंक्शन
    async function loadRecentOrders(agentId) {
        console.log(`Loading recent orders for agent ${agentId}...`);
        if (!recentOrdersWidgetEl) return;
        recentOrdersWidgetEl.innerHTML = "<p><em>हाल के ऑर्डर लोड हो रहे हैं...</em></p>";
        try {
            const ordersRef = collection(db, "orders"); // मुख्य 'orders' कलेक्शन
            const q = query(
                ordersRef,
                where("agentId", "==", agentId), // केवल इस एजेंट के ऑर्डर
                orderBy("createdAt", "desc"), // सबसे नए पहले
                limit(5) // उदाहरण: केवल 5 हाल के ऑर्डर
            );
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                recentOrdersWidgetEl.innerHTML = "<p><em>कोई हालिया ऑर्डर नहीं मिला।</em></p>";
            } else {
                let html = '<h5>आपके हाल के ऑर्डर:</h5><ul>';
                snapshot.forEach(doc => {
                    const order = doc.data();
                    html += `<li>${formatDateForDisplay(order.createdAt || order.orderDate)} - ऑर्डर #${order.orderId || doc.id.substring(0, 6)} (${order.customerDetails?.fullName || 'N/A'}) - स्थिति: ${order.status || 'N/A'}</li>`;
                });
                html += '</ul><p><a href="agent_order_history.html">सभी ऑर्डर देखें</a></p>';
                recentOrdersWidgetEl.innerHTML = html;
            }
        } catch (error) {
            console.error("हाल के ऑर्डर लोड करने में त्रुटि:", error);
            recentOrdersWidgetEl.innerHTML = "<p style='color:red;'>हाल के ऑर्डर लोड करने में त्रुटि हुई।</p>";
        }
    }

    // खाता सारांश लोड करने का फ़ंक्शन
    async function loadAccountSummary(agentId) {
        console.log(`Loading account summary for agent ${agentId}...`);
        if (!accountSummaryWidgetEl) return;
        accountSummaryWidgetEl.innerHTML = "<p><em>खाता सारांश लोड हो रहा है...</em></p>";
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
                <h5>आपका खाता सारांश:</h5>
                <p><strong>कुल अर्जित कमीशन:</strong> ${formatCurrency(totalCommission)}</p>
                <p><strong>आपको कुल भुगतान:</strong> ${formatCurrency(totalPaid)}</p>
                <p><strong>बकाया शेष:</strong> ${formatCurrency(outstanding)}</p>
                <p><a href="agent_ledger.html">पूरा लेजर देखें</a></p>
            `;
        } catch (error) {
            console.error("खाता सारांश लोड करने में त्रुटि:", error);
            accountSummaryWidgetEl.innerHTML = "<p style='color:red;'>खाता सारांश लोड करने में त्रुटि हुई।</p>";
        }
    }

    console.log("Agent Dashboard JS Initialized and listeners potentially active.");
});