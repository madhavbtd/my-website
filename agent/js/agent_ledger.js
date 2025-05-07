// /agent/js/agent_ledger.js
import { db, auth } from './agent_firebase_config.js';
import { collection, query, where, orderBy, getDocs, Timestamp, doc, getDoc } from './agent_firebase_config.js'; // getDoc को इम्पोर्ट में जोड़ें
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// DOM Elements
const agentWelcomeMessageEl = document.getElementById('agentWelcomeMessage');
const agentLogoutBtnEl = document.getElementById('agentLogoutBtn');

const totalCommissionEarnedEl = document.getElementById('totalCommissionEarned');
const totalPaidToAgentEl = document.getElementById('totalPaidToAgent');
const outstandingBalanceEl = document.getElementById('outstandingBalance');

const ledgerTableBodyEl = document.getElementById('agentLedgerTableBody');
const loadingLedgerMessageEl = document.getElementById('loadingLedgerMessage');
const noLedgerEntriesMessageEl = document.getElementById('noLedgerEntriesMessage');

const ledgerDateRangeSelectEl = document.getElementById('ledgerDateRange');
const customDateFiltersDivEl = document.getElementById('customDateFilters');
const ledgerStartDateInputEl = document.getElementById('ledgerStartDate');
const ledgerEndDateInputEl = document.getElementById('ledgerEndDate');
const applyLedgerFilterBtnEl = document.getElementById('applyLedgerFilterBtn');

let currentUser = null; // वर्तमान लॉग-इन उपयोगकर्ता
let agentPermissions = { role: null, status: 'inactive' }; // एजेंट की अनुमतियाँ
let currentAgentIdForLedger = null; // लेजर के लिए स्पष्ट रूप से एजेंट आईडी स्टोर करें
let allLedgerEntriesCache = []; // सभी एंट्रीज को कैश करने के लिए (नाम बदला गया)

// Helper Functions
function formatCurrency(amount) {
    const num = Number(amount);
    return isNaN(num) ? '₹0.00' : num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateForDisplay(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== 'function') return 'N/A';
    try {
        const date = timestamp.toDate();
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
        console.error("Error formatting timestamp:", e, timestamp);
        return 'Invalid Date';
    }
}

// --- प्रमाणीकरण और अनुमति लोड करना ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        currentAgentIdForLedger = user.uid; // currentAgentIdForLedger को यहाँ सेट करें
        if (agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = `Welcome, ${user.email || 'Agent'}`;

        try {
            const agentDocRef = doc(db, "agents", currentUser.uid);
            const agentDocSnap = await getDoc(agentDocRef);

            if (agentDocSnap.exists() && agentDocSnap.data().role === 'agent' && agentDocSnap.data().status === 'active') {
                agentPermissions = agentDocSnap.data();
                console.log("एजेंट प्रमाणित (Ledger) और अनुमतियाँ लोड की गईं:", agentPermissions);
                fetchLedgerEntries(); // प्रारंभिक डेटा लोड करें
            } else {
                console.error("एजेंट दस्तावेज़ नहीं मिला या भूमिका/स्थिति अमान्य है। लॉग आउट किया जा रहा है।");
                if(agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = "अमान्य एजेंट खाता।";
                if(ledgerTableBodyEl && loadingLedgerMessageEl && noLedgerEntriesMessageEl) {
                    loadingLedgerMessageEl.style.display = 'none';
                    noLedgerEntriesMessageEl.textContent = "आप लेजर देखने के लिए अधिकृत नहीं हैं।";
                    noLedgerEntriesMessageEl.style.display = 'table-row';
                    ledgerTableBodyEl.innerHTML = ''; // पुरानी एंट्रीज हटाएं
                    ledgerTableBodyEl.appendChild(noLedgerEntriesMessageEl);
                }
                // auth.signOut();
                // window.location.href = 'agent_login.html';
            }
        } catch (error) {
            console.error("एजेंट अनुमतियाँ लोड करने में त्रुटि:", error);
            if(agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = "प्रोफ़ाइल लोड करने में त्रुटि।";
            if(ledgerTableBodyEl && loadingLedgerMessageEl && noLedgerEntriesMessageEl) {
                loadingLedgerMessageEl.style.display = 'none';
                noLedgerEntriesMessageEl.textContent = "अनुमतियाँ लोड करने में त्रुटि।";
                noLedgerEntriesMessageEl.style.display = 'table-row';
                ledgerTableBodyEl.innerHTML = '';
                ledgerTableBodyEl.appendChild(noLedgerEntriesMessageEl);
            }
            // auth.signOut();
            // window.location.href = 'agent_login.html';
        }
    } else {
        console.log("Agent not logged in on ledger page. Redirecting...");
        window.location.replace('agent_login.html');
    }
});


// Fetch ledger entries from Firestore
async function fetchLedgerEntries() {
    if (!currentAgentIdForLedger) { // currentAgentIdForLedger का उपयोग करें
        console.error("लेजर लोड करने के लिए एजेंट आईडी उपलब्ध नहीं है।");
        if(loadingLedgerMessageEl) loadingLedgerMessageEl.style.display = 'none';
        if(noLedgerEntriesMessageEl) {
            noLedgerEntriesMessageEl.textContent = "लेजर लोड करने में असमर्थ: एजेंट की पहचान नहीं हुई।";
            noLedgerEntriesMessageEl.style.display = 'table-row';
        }
        if(ledgerTableBodyEl) {
             ledgerTableBodyEl.innerHTML = ''; // पुरानी एंट्रीज हटाएं
             if(noLedgerEntriesMessageEl) ledgerTableBodyEl.appendChild(noLedgerEntriesMessageEl);
        }
        return;
    }

    if(loadingLedgerMessageEl) loadingLedgerMessageEl.style.display = 'table-row';
    if(noLedgerEntriesMessageEl) noLedgerEntriesMessageEl.style.display = 'none';
    if(ledgerTableBodyEl) {
        ledgerTableBodyEl.innerHTML = ''; // पुरानी एंट्रीज हटाएं
        if(loadingLedgerMessageEl) ledgerTableBodyEl.appendChild(loadingLedgerMessageEl);
    }


    try {
        const q = query(
            collection(db, "agentLedger"),
            where("agentId", "==", currentAgentIdForLedger), // currentAgentIdForLedger का उपयोग करें
            orderBy("date", "desc")
        );

        const querySnapshot = await getDocs(q);
        allLedgerEntriesCache = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`${allLedgerEntriesCache.length} लेजर एंट्री फ़ेच की गईं।`);
        applyFiltersAndDisplayLedger();

    } catch (error) {
        console.error("लेजर एंट्री फ़ेच करने में त्रुटि: ", error);
        if(loadingLedgerMessageEl) loadingLedgerMessageEl.style.display = 'none';
        if(ledgerTableBodyEl) ledgerTableBodyEl.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">लेजर डेटा लोड करने में त्रुटि: ${error.message}</td></tr>`;
        updateSummaryCards([]); // त्रुटि होने पर सारांश रीसेट करें
    }
}

// Apply filters and display entries
function applyFiltersAndDisplayLedger() { // फ़ंक्शन का नाम बदला
    if (!ledgerTableBodyEl || !loadingLedgerMessageEl || !noLedgerEntriesMessageEl || !ledgerDateRangeSelectEl) return;

    if(loadingLedgerMessageEl) loadingLedgerMessageEl.style.display = 'none';
    ledgerTableBodyEl.innerHTML = '';

    const selectedRange = ledgerDateRangeSelectEl.value;
    let startDate, endDate;
    const now = new Date();

    if (selectedRange === 'current_month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (selectedRange === 'last_month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (selectedRange === 'custom') {
        startDate = ledgerStartDateInputEl.value ? new Date(ledgerStartDateInputEl.value + "T00:00:00Z") : null; // UTC मानें
        endDate = ledgerEndDateInputEl.value ? new Date(ledgerEndDateInputEl.value + "T23:59:59Z") : null; // UTC मानें
        if (startDate && endDate && startDate > endDate) {
            alert("प्रारंभ तिथि समाप्ति तिथि के बाद नहीं हो सकती।");
            if(noLedgerEntriesMessageEl) {
                noLedgerEntriesMessageEl.textContent = "अमान्य तारीख सीमा।";
                noLedgerEntriesMessageEl.style.display = 'table-row';
                ledgerTableBodyEl.appendChild(noLedgerEntriesMessageEl);
            }
            updateSummaryCards([]);
            return;
        }
    }
    // 'all_time' का मतलब कोई तारीख फ़िल्टरिंग नहीं

    const filteredEntries = allLedgerEntriesCache.filter(entry => {
        if (!entry.date || typeof entry.date.toDate !== 'function') return false; // अमान्य एंट्री हटाएं
        const entryDate = entry.date.toDate();

        if (selectedRange === 'all_time') return true;
        if (!startDate && !endDate) return true; // यदि कोई तारीख सेट नहीं है (कस्टम में हो सकता है)

        if (startDate && endDate) return entryDate >= startDate && entryDate <= endDate;
        if (startDate) return entryDate >= startDate;
        if (endDate) return entryDate <= endDate;
        return false; // यदि केवल एक तारीख सेट है और वह मेल नहीं खाती
    });

    if (filteredEntries.length === 0) {
        if(noLedgerEntriesMessageEl) {
            noLedgerEntriesMessageEl.textContent = "इस अवधि के लिए कोई लेजर एंट्री नहीं मिली।";
            noLedgerEntriesMessageEl.style.display = 'table-row';
            ledgerTableBodyEl.appendChild(noLedgerEntriesMessageEl);
        }
    } else {
        if(noLedgerEntriesMessageEl) noLedgerEntriesMessageEl.style.display = 'none';
        displayEntriesInTable(filteredEntries);
    }
    updateSummaryCards(filteredEntries);
}


// Display entries in the HTML table
function displayEntriesInTable(entries) {
    // रनिंग बैलेंस के लिए, एंट्रीज को तारीख के अनुसार (पुराना पहले) सॉर्ट करना होगा
    const entriesForBalanceCalc = [...entries].sort((a, b) => a.date.toMillis() - b.date.toMillis());
    const entriesWithBalance = [];
    let runningBalance = 0;

    entriesForBalanceCalc.forEach(entry => {
        if (entry.type === 'commission') {
            runningBalance += (entry.amount || 0);
        } else if (entry.type === 'payment') {
            runningBalance -= (entry.amount || 0);
        }
        entriesWithBalance.push({...entry, currentBalance: runningBalance });
    });

    // प्रदर्शन के लिए मूल (यानी desc) क्रम में दिखाएं
    entriesWithBalance.sort((a,b) => b.date.toMillis() - a.date.toMillis()).forEach(entry => {
        const row = ledgerTableBodyEl.insertRow();
        row.classList.add(entry.type === 'commission' ? 'commission-entry' : 'payment-entry');

        row.insertCell().textContent = formatDateForDisplay(entry.date);
        row.insertCell().textContent = escapeHtml(entry.description || 'N/A');
        row.insertCell().textContent = escapeHtml(entry.orderId || (entry.refId || 'N/A'));

        const amountCell = row.insertCell();
        amountCell.style.textAlign = 'right';
        amountCell.textContent = `${entry.type === 'commission' ? '+' : '-'} ${formatCurrency(entry.amount || 0)}`;

        const balanceCell = row.insertCell();
        balanceCell.style.textAlign = 'right';
        balanceCell.textContent = formatCurrency(entry.currentBalance);
        // बैलेंस के आधार पर रंग (वैकल्पिक)
        if (entry.currentBalance < 0) balanceCell.style.color = 'red';
        else if (entry.currentBalance > 0) balanceCell.style.color = 'green';
    });
}

// Update summary cards (Total Commission, Total Paid, Outstanding)
function updateSummaryCards(entries) {
    let totalCommission = 0;
    let totalPaid = 0;

    entries.forEach(entry => {
        if (entry.type === 'commission') {
            totalCommission += (entry.amount || 0);
        } else if (entry.type === 'payment') {
            totalPaid += (entry.amount || 0);
        }
    });
    const outstanding = totalCommission - totalPaid;

    if(totalCommissionEarnedEl) totalCommissionEarnedEl.textContent = formatCurrency(totalCommission);
    if(totalPaidToAgentEl) totalPaidToAgentEl.textContent = formatCurrency(totalPaid);
    if(outstandingBalanceEl) {
        outstandingBalanceEl.textContent = formatCurrency(outstanding);
        outstandingBalanceEl.style.color = outstanding < 0 ? 'red' : (outstanding > 0 ? 'green' : 'inherit');
    }
}

// Event Listeners Setup (DOMContentloaded के अंदर)
document.addEventListener('DOMContentLoaded', () => {
    // onAuthStateChanged पहले से ही ऊपर है और fetchLedgerEntries को कॉल करेगा

    if (agentLogoutBtnEl) {
        agentLogoutBtnEl.addEventListener('click', () => {
             if (confirm("क्या आप वाकई लॉग आउट करना चाहते हैं?")) {
                auth.signOut().then(() => {
                    window.location.href = 'agent_login.html';
                }).catch(error => console.error("Logout error:", error));
            }
        });
    }

    if (ledgerDateRangeSelectEl) {
        ledgerDateRangeSelectEl.addEventListener('change', () => {
            if(customDateFiltersDivEl) customDateFiltersDivEl.style.display = ledgerDateRangeSelectEl.value === 'custom' ? 'flex' : 'none';
            if (ledgerDateRangeSelectEl.value !== 'custom') {
                 applyFiltersAndDisplayLedger();
            }
        });
    }
    if (applyLedgerFilterBtnEl) {
        applyLedgerFilterBtnEl.addEventListener('click', applyFiltersAndDisplayLedger);
    }

    console.log("Agent Ledger JS Initialized.");
});