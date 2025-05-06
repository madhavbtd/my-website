// /agent/js/agent_ledger.js
import { db, auth } from './agent_firebase_config.js';
import { collection, query, where, orderBy, getDocs, Timestamp } from './agent_firebase_config.js'; // Firestore functions
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

let currentAgentId = null;
let allLedgerEntries = []; // सभी एंट्रीज को कैश करने के लिए

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

// Fetch ledger entries from Firestore
async function fetchLedgerEntries() {
    if (!currentAgentId) {
        console.error("Agent ID is not available.");
        loadingLedgerMessageEl.style.display = 'none';
        noLedgerEntriesMessageEl.textContent = "Could not load ledger: Agent not identified.";
        noLedgerEntriesMessageEl.style.display = 'table-row'; // Or 'block' if it's a p tag
        return;
    }

    loadingLedgerMessageEl.style.display = 'table-row';
    noLedgerEntriesMessageEl.style.display = 'none';
    ledgerTableBodyEl.innerHTML = ''; // Clear previous entries before appending loading message
    ledgerTableBodyEl.appendChild(loadingLedgerMessageEl);

    try {
        // मान लीजिए आपका कलेक्शन 'agentLedger' है
        // और उसमें 'agentId', 'date', 'type', 'amount', 'description', 'orderId' फील्ड्स हैं
        const q = query(
            collection(db, "agentLedger"),
            where("agentId", "==", currentAgentId),
            orderBy("date", "desc") // सबसे नई एंट्री पहले
        );

        const querySnapshot = await getDocs(q);
        allLedgerEntries = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        applyFiltersAndDisplay(); // डेटा आने के बाद फिल्टर लगाकर दिखाएं

    } catch (error) {
        console.error("Error fetching ledger entries: ", error);
        loadingLedgerMessageEl.style.display = 'none';
        ledgerTableBodyEl.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Error loading ledger data: ${error.message}</td></tr>`;
    }
}

// Apply filters and display entries
function applyFiltersAndDisplay() {
    loadingLedgerMessageEl.style.display = 'none';
    ledgerTableBodyEl.innerHTML = ''; // Clear table for new/filtered data

    const selectedRange = ledgerDateRangeSelectEl.value;
    let startDate, endDate;

    const now = new Date();
    if (selectedRange === 'current_month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59); // End of current month
    } else if (selectedRange === 'last_month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); // End of last month
    } else if (selectedRange === 'custom') {
        startDate = ledgerStartDateInputEl.value ? new Date(ledgerStartDateInputEl.value + "T00:00:00") : null;
        endDate = ledgerEndDateInputEl.value ? new Date(ledgerEndDateInputEl.value + "T23:59:59") : null;
    }
    // 'all_time' means no date filtering

    const filteredEntries = allLedgerEntries.filter(entry => {
        if (!startDate || !endDate) { // For 'all_time' or if one custom date is missing
             if (selectedRange === 'all_time') return true;
             if (startDate && !endDate && entry.date.toDate() >= startDate) return true;
             if (!startDate && endDate && entry.date.toDate() <= endDate) return true;
             if (startDate && endDate && entry.date.toDate() >= startDate && entry.date.toDate() <= endDate) return true;
             if (selectedRange !== 'custom') return true; // Only apply strict for custom if both dates there
             return false; // Or handle partial custom range differently
        }
        const entryDate = entry.date.toDate();
        return entryDate >= startDate && entryDate <= endDate;
    });

    if (filteredEntries.length === 0) {
        noLedgerEntriesMessageEl.style.display = 'table-row'; // or 'block'
        ledgerTableBodyEl.appendChild(noLedgerEntriesMessageEl);
    } else {
        noLedgerEntriesMessageEl.style.display = 'none';
        displayEntriesInTable(filteredEntries);
    }
    updateSummaryCards(filteredEntries); // समरी कार्ड्स को अपडेट करें
}


// Display entries in the HTML table
function displayEntriesInTable(entries) {
    let runningBalance = 0;
    // सही रनिंग बैलेंस के लिए, एंट्रीज को तारीख के अनुसार (पुराना पहले) सॉर्ट करना होगा
    // या, अगर आप सबसे नई एंट्री पहले दिखा रहे हैं, तो आपको कुल बैलेंस पहले से पता होना चाहिए
    // यहाँ हम मान रहे हैं कि entries पहले से 'date' के अनुसार 'desc' (नई पहले) सॉर्टेड हैं
    // रनिंग बैलेंस के लिए, हम इसे उल्टा करेंगे, गणना करेंगे, फिर सीधा करेंगे
    
    const entriesForBalanceCalc = [...entries].sort((a, b) => a.date.toMillis() - b.date.toMillis());
    const entriesWithBalance = [];
    
    entriesForBalanceCalc.forEach(entry => {
        if (entry.type === 'commission') {
            runningBalance += entry.amount;
        } else if (entry.type === 'payment') {
            runningBalance -= entry.amount;
        }
        entriesWithBalance.push({...entry, currentBalance: runningBalance });
    });

    // अब प्रदर्शन के लिए मूल (यानी desc) क्रम में दिखाएं
    entriesWithBalance.sort((a,b) => b.date.toMillis() - a.date.toMillis()).forEach(entry => {
        const row = ledgerTableBodyEl.insertRow();
        row.classList.add(entry.type === 'commission' ? 'commission-entry' : 'payment-entry');

        row.insertCell().textContent = formatDateForDisplay(entry.date);
        row.insertCell().textContent = entry.description || 'N/A';
        row.insertCell().textContent = entry.orderId || (entry.refId || 'N/A'); // Order ID or Payment Ref

        const amountCell = row.insertCell();
        amountCell.style.textAlign = 'right';
        amountCell.textContent = `${entry.type === 'commission' ? '+' : '-'} ${formatCurrency(entry.amount)}`;
        
        const balanceCell = row.insertCell();
        balanceCell.style.textAlign = 'right';
        balanceCell.textContent = formatCurrency(entry.currentBalance);
    });
}

// Update summary cards (Total Commission, Total Paid, Outstanding)
function updateSummaryCards(entries) {
    let totalCommission = 0;
    let totalPaid = 0;

    entries.forEach(entry => {
        if (entry.type === 'commission') {
            totalCommission += entry.amount;
        } else if (entry.type === 'payment') {
            totalPaid += entry.amount;
        }
    });
    const outstanding = totalCommission - totalPaid;

    totalCommissionEarnedEl.textContent = formatCurrency(totalCommission);
    totalPaidToAgentEl.textContent = formatCurrency(totalPaid);
    outstandingBalanceEl.textContent = formatCurrency(outstanding);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentAgentId = user.uid;
            if(agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = `Welcome, ${user.email || 'Agent'}`;
            fetchLedgerEntries(); // प्रारंभिक डेटा लोड करें
        } else {
            window.location.href = 'agent_login.html';
        }
    });

    if (agentLogoutBtnEl) {
        agentLogoutBtnEl.addEventListener('click', () => {
            auth.signOut().then(() => {
                window.location.href = 'agent_login.html';
            }).catch(error => console.error("Logout error:", error));
        });
    }

    if (ledgerDateRangeSelectEl) {
        ledgerDateRangeSelectEl.addEventListener('change', () => {
            customDateFiltersDivEl.style.display = ledgerDateRangeSelectEl.value === 'custom' ? 'flex' : 'none';
            if (ledgerDateRangeSelectEl.value !== 'custom') {
                 applyFiltersAndDisplay(); // यदि 'custom' नहीं है, तो तुरंत फिल्टर करें
            }
        });
    }
    if (applyLedgerFilterBtnEl) {
        applyLedgerFilterBtnEl.addEventListener('click', applyFiltersAndDisplay);
    }
});