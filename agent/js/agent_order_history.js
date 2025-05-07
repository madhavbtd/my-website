// /agent/js/agent_order_history.js

// Firebase functions और इंस्टेंस इम्पोर्ट करें
import { db, auth } from './agent_firebase_config.js';
import {
    collection, query, where, orderBy, onSnapshot, Timestamp
} from './agent_firebase_config.js'; // Firestore functions from config
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"; // getDoc को भी इम्पोर्ट करें

// --- DOM Elements ---
const tableBody = document.getElementById('agentOrderHistoryTableBody');
const loadingMessageEl = document.getElementById('loadingAgentHistoryMessage'); // वेरिएबल का नाम बदला
const noOrdersMessageEl = document.getElementById('noAgentOrdersMessage'); // वेरिएबल का नाम बदला
const agentWelcomeMessageEl = document.getElementById('agentWelcomeMessage'); // हेडर से
const agentLogoutBtnEl = document.getElementById('agentLogoutBtn'); // हेडर से

let currentUser = null;
let agentPermissions = { role: null, status: 'inactive' }; // एजेंट की अनुमतियाँ स्टोर करने के लिए
let unsubscribeAgentOrders = null; // Listener को बंद करने के लिए

// --- Helper Functions ---
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') unsafe = String(unsafe || ''); return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");}
function formatTimestamp(timestamp) { if (!timestamp || typeof timestamp.toDate !== 'function') return 'N/A'; try { const date = timestamp.toDate(); const optionsDate = { day: '2-digit', month: 'short', year: 'numeric' }; return date.toLocaleDateString('en-GB', optionsDate); } catch (e) { console.error("Error formatting timestamp:", e); return 'Invalid Date'; } }
function formatCurrency(amount) { const num = Number(amount); return isNaN(num) ? 'N/A' : num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });}
function getStatusClass(status) { if (!status) return 'status-unknown'; const normalizedStatus = status.toLowerCase().replace(/\s+/g, '-'); const statusClasses = ['order-received', 'designing', 'verification', 'design-approved', 'ready-for-working', 'printing', 'delivered', 'completed', 'cancelled', 'pending-admin-approval']; return statusClasses.includes(normalizedStatus) ? `status-${normalizedStatus}` : 'status-unknown';}


// --- Main Logic ---

// एजेंट के ऑर्डर्स को लोड और डिस्प्ले करने का फ़ंक्शन
async function loadAgentOrderHistory(agentId) {
    if (!tableBody || !loadingMessageEl || !noOrdersMessageEl || !db) {
        console.error("History Table elements or DB not found.");
        if (tableBody && loadingMessageEl) {
            loadingMessageEl.style.display = 'none';
            tableBody.innerHTML = `<tr><td colspan="7" style="color:red;">पेज लोड करने में त्रुटि।</td></tr>`;
        }
        return;
    }
    console.log(`एजेंट ${agentId} के लिए ऑर्डर इतिहास लोड किया जा रहा है...`);

    loadingMessageEl.style.display = 'table-row';
    noOrdersMessageEl.style.display = 'none';
    const rows = tableBody.querySelectorAll('tr:not(#loadingAgentHistoryMessage)');
    rows.forEach(row => row.remove());

    if (unsubscribeAgentOrders) {
        unsubscribeAgentOrders();
        console.log("पिछला एजेंट ऑर्डर लिस्नर बंद किया गया।");
    }

    try {
        const ordersRef = collection(db, "orders"); // मुख्य 'orders' कलेक्शन को सुनें

        // क्वेरी: केवल इस एजेंट के ऑर्डर्स लाएं (agentId फील्ड पर फ़िल्टर करें), createdAt के अनुसार सॉर्ट करें
        const q = query(ordersRef,
                        where("agentId", "==", agentId), // agentId द्वारा फ़िल्टर करें
                        orderBy("createdAt", "desc") // सबसे नया पहले
                       );

        unsubscribeAgentOrders = onSnapshot(q, (snapshot) => {
            console.log(`एजेंट इतिहास स्नैपशॉट: ${snapshot.docs.length} ऑर्डर प्राप्त हुए।`);
            loadingMessageEl.style.display = 'none';

            const currentRows = tableBody.querySelectorAll('tr:not(#loadingAgentHistoryMessage)');
            currentRows.forEach(row => row.remove()); // सुनिश्चित करें कि पुरानी पंक्तियाँ हटाई गई हैं

            if (snapshot.empty) {
                noOrdersMessageEl.style.display = 'table-row';
                if (!document.getElementById('noAgentOrdersMessage')) { // यदि पहले से नहीं जोड़ा गया है
                     tableBody.appendChild(noOrdersMessageEl);
                }
            } else {
                noOrdersMessageEl.style.display = 'none';
                snapshot.docs.forEach((doc) => {
                    displayAgentOrderRow(doc.id, doc.data());
                });
            }

        }, (error) => {
            console.error("एजेंट ऑर्डर इतिहास फ़ेच करने में त्रुटि:", error);
            loadingMessageEl.style.display = 'none';
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">ऑर्डर इतिहास लोड करने में त्रुटि: ${error.message}</td></tr>`;
        });

    } catch (error) {
        console.error("एजेंट ऑर्डर इतिहास लिस्नर सेटअप करने में त्रुटि:", error);
        loadingMessageEl.style.display = 'none';
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">लिस्नर सेटअप करने में त्रुटि।</td></tr>`;
    }
}

// एक ऑर्डर पंक्ति (row) डिस्प्ले करने का फ़ंक्शन
function displayAgentOrderRow(orderFirestoreId, orderData) {
    if (!tableBody) return;

    const row = tableBody.insertRow();
    row.setAttribute('data-id', orderFirestoreId);

    const displayOrderId = escapeHtml(orderData.orderId || `Sys:${orderFirestoreId.substring(0,6)}`);
    // orderDate या createdAt को प्राथमिकता दें
    const orderDateToFormat = orderData.orderDate || orderData.createdAt;
    const orderDate = formatTimestamp(orderDateToFormat);
    const customerName = escapeHtml(orderData.customerDetails?.fullName || 'N/A');

    let itemsSummary = "N/A";
    if (orderData.items && orderData.items.length > 0) {
        itemsSummary = orderData.items.map(item =>
            `${escapeHtml(item.productName || '?')} (मात्रा: ${escapeHtml(item.quantity || '?')})`
        ).join(', ');
        if (itemsSummary.length > 50) itemsSummary = itemsSummary.substring(0, 50) + "...";
    }

    const totalAmount = formatCurrency(orderData.finalAmount || orderData.totalAmount); // finalAmount या totalAmount
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
            <button class="button action-button view-details-button small-button" data-action="view-details" data-id="${orderFirestoreId}" title="ऑर्डर विवरण देखें">
                <i class="fas fa-eye"></i> देखें
            </button>
        </td>
    `;
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
                    console.log("एजेंट प्रमाणित (Order History) और अनुमतियाँ लोड की गईं:", agentPermissions);
                    loadAgentOrderHistory(currentUser.uid); // वर्तमान एजेंट की ID पास करें
                } else {
                    console.error("एजेंट दस्तावेज़ नहीं मिला या भूमिका/स्थिति अमान्य है। लॉग आउट किया जा रहा है।");
                    if(agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = "अमान्य एजेंट खाता।";
                    if(tableBody && loadingMessageEl) {
                        loadingMessageEl.style.display = 'none';
                        tableBody.innerHTML = `<tr><td colspan="7" class="form-message error">आप ऑर्डर इतिहास देखने के लिए अधिकृत नहीं हैं।</td></tr>`;
                    }
                    // auth.signOut();
                    // window.location.href = 'agent_login.html';
                }
            } catch (error) {
                console.error("एजेंट अनुमतियाँ लोड करने में त्रुटि:", error);
                 if(agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = "प्रोफ़ाइल लोड करने में त्रुटि।";
                 if(tableBody && loadingMessageEl) {
                     loadingMessageEl.style.display = 'none';
                     tableBody.innerHTML = `<tr><td colspan="7" class="form-message error">अनुमतियाँ लोड करने में त्रुटि। (${error.message})</td></tr>`;
                 }
                // auth.signOut();
                // window.location.href = 'agent_login.html';
            }
        } else {
            console.log("Agent not logged in on order history page. Redirecting...");
            window.location.replace('agent_login.html');
        }
    });

    // लॉगआउट बटन
    if (agentLogoutBtnEl) {
        agentLogoutBtnEl.addEventListener('click', () => {
            if (confirm("क्या आप वाकई लॉग आउट करना चाहते हैं?")) {
                auth.signOut().then(() => {
                    window.location.href = 'agent_login.html';
                }).catch((error) => {
                    console.error("Agent Logout Error:", error);
                    alert("लॉगआउट विफल रहा।");
                });
            }
        });
    }

    // टेबल में एक्शन बटन के लिए लिस्नर (View Details)
    if(tableBody) {
        tableBody.addEventListener('click', (event) => {
            const targetButton = event.target.closest('button.view-details-button');
            if (!targetButton) return;

            const orderId = targetButton.dataset.id;
            if (orderId) {
                // यहाँ आपको ऑर्डर विवरण दिखाने के लिए एक Modal या एक नया पेज खोलना होगा।
                // अभी के लिए, हम एक अलर्ट दिखाएंगे।
                alert(`ऑर्डर विवरण देखें: ${orderId}. (यह कार्यक्षमता अभी लागू की जानी है)`);
                // उदाहरण: openAgentOrderDetailModal(orderId);
                // या: window.location.href = `agent_order_detail.html?id=${orderId}`;
            }
        });
    }

    console.log("Agent Order History JS Initialized.");
});