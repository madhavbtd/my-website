// /agent/js/agent_ledger.js
import { db, auth } from './agent_firebase_config.js';
import { collection, query, where, orderBy, getDocs, Timestamp, doc, getDoc } from './agent_firebase_config.js'; // Added getDoc to imports
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// DOM Elements
const agentWelcomeMessageEl = document.getElementById('agentWelcomeMessage');
const agentLogoutBtnEl = document.getElementById('agentLogoutBtn');

const totalCommissionEarnedEl = document.getElementById('totalCommissionEarned');
const totalPaidToAgentEl = document.getElementById('totalPaidToAgent');
const outstandingBalanceEl = document.getElementById('outstandingBalance');

const ledgerTableBodyEl = document.getElementById('agentLedgerTableBody');
const loadingLedgerMessageEl = document.getElementById('loadingLedgerMessage');
const noLedgerEntriesMessageEl = document.getElementById('noLedgerEntriesMessage'); // Ensure this element exists with this ID in ledger.html

const ledgerDateRangeSelectEl = document.getElementById('ledgerDateRange');
const customDateFiltersDivEl = document.getElementById('customDateFilters');
const ledgerStartDateInputEl = document.getElementById('ledgerStartDate');
const ledgerEndDateInputEl = document.getElementById('ledgerEndDate');
const applyLedgerFilterBtnEl = document.getElementById('applyLedgerFilterBtn');

let currentUser = null; // Current logged-in user
let agentPermissions = { role: null, status: 'inactive' }; // Agent permissions
let currentAgentIdForLedger = null; // Explicitly store agent ID for ledger
let allLedgerEntriesCache = []; // To cache all fetched entries

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

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') unsafe = String(unsafe || '');
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}


// --- Authentication and Permission Loading ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        currentAgentIdForLedger = user.uid; // Set currentAgentIdForLedger here
        if (agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = `Welcome, ${user.email || 'Agent'}`;

        try {
            const agentDocRef = doc(db, "agents", currentUser.uid);
            const agentDocSnap = await getDoc(agentDocRef);

            if (agentDocSnap.exists() && agentDocSnap.data().role === 'agent' && agentDocSnap.data().status === 'active') {
                agentPermissions = agentDocSnap.data();
                console.log("Agent authenticated (Ledger) and permissions loaded:", agentPermissions);
                fetchLedgerEntries(); // Load initial data
            } else {
                console.error("Agent document not found or role/status invalid. Logging out.");
                if(agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = "Invalid Agent Account.";
                if(ledgerTableBodyEl && loadingLedgerMessageEl && noLedgerEntriesMessageEl) {
                    loadingLedgerMessageEl.style.display = 'none';
                    noLedgerEntriesMessageEl.textContent = "You are not authorized to view the ledger."; // English message
                    noLedgerEntriesMessageEl.parentElement.style.display = 'table-row'; // Show the wrapper row
                    ledgerTableBodyEl.innerHTML = ''; // Clear old entries
                    ledgerTableBodyEl.appendChild(noLedgerEntriesMessageEl.parentElement); // Append the wrapper row
                }
                // auth.signOut();
                // window.location.href = 'agent_login.html';
            }
        } catch (error) {
            console.error("Error loading agent permissions:", error);
            if(agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = "Error loading profile.";
            if(ledgerTableBodyEl && loadingLedgerMessageEl && noLedgerEntriesMessageEl) {
                loadingLedgerMessageEl.style.display = 'none';
                noLedgerEntriesMessageEl.textContent = "Error loading permissions."; // English message
                noLedgerEntriesMessageEl.parentElement.style.display = 'table-row';
                ledgerTableBodyEl.innerHTML = '';
                ledgerTableBodyEl.appendChild(noLedgerEntriesMessageEl.parentElement);
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
    if (!currentAgentIdForLedger) {
        console.error("Agent ID not available for loading ledger.");
        if(loadingLedgerMessageEl) loadingLedgerMessageEl.style.display = 'none';
        if(noLedgerEntriesMessageEl) {
            noLedgerEntriesMessageEl.textContent = "Unable to load ledger: Agent not identified."; // English message
            noLedgerEntriesMessageEl.parentElement.style.display = 'table-row';
        }
        if(ledgerTableBodyEl) {
             ledgerTableBodyEl.innerHTML = ''; // Clear old entries
             if(noLedgerEntriesMessageEl) ledgerTableBodyEl.appendChild(noLedgerEntriesMessageEl.parentElement);
        }
        return;
    }

    if(loadingLedgerMessageEl) loadingLedgerMessageEl.parentElement.style.display = 'table-row'; // Show loading row
    if(noLedgerEntriesMessageEl) noLedgerEntriesMessageEl.parentElement.style.display = 'none';
    if(ledgerTableBodyEl) {
        const rowsToRemove = ledgerTableBodyEl.querySelectorAll('tr:not(#loadingLedgerMessage)');
        rowsToRemove.forEach(row => row.remove());
    }


    try {
        const q = query(
            collection(db, "agentLedger"),
            where("agentId", "==", currentAgentIdForLedger),
            orderBy("date", "desc")
        );

        const querySnapshot = await getDocs(q);
        allLedgerEntriesCache = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`${allLedgerEntriesCache.length} ledger entries fetched.`);
        applyFiltersAndDisplayLedger();

    } catch (error) {
        console.error("Error fetching ledger entries: ", error);
        if(loadingLedgerMessageEl) loadingLedgerMessageEl.parentElement.style.display = 'none';
        if(ledgerTableBodyEl) ledgerTableBodyEl.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Error loading ledger data: ${error.message}</td></tr>`;
        updateSummaryCards([]); // Reset summary on error
    }
}

// Apply filters and display entries
function applyFiltersAndDisplayLedger() {
    if (!ledgerTableBodyEl || !loadingLedgerMessageEl || !noLedgerEntriesMessageEl || !ledgerDateRangeSelectEl) return;

    if(loadingLedgerMessageEl) loadingLedgerMessageEl.parentElement.style.display = 'none'; // Hide loading row
    ledgerTableBodyEl.innerHTML = ''; // Clear previous entries

    const selectedRange = ledgerDateRangeSelectEl.value;
    let startDate = null;
    let endDate = null;
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const todayEnd = new Date(now.setHours(23, 59, 59, 999));


    if (selectedRange === 'current_month') {
        startDate = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
        endDate = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (selectedRange === 'last_month') {
        startDate = new Date(todayStart.getFullYear(), todayStart.getMonth() - 1, 1);
        endDate = new Date(todayStart.getFullYear(), todayStart.getMonth(), 0, 23, 59, 59, 999);
    } else if (selectedRange === 'custom') {
        // For date inputs, get value and create Date objects at start/end of day
        // Important: Treat input values as local time and convert to Timestamp correctly
        const startVal = ledgerStartDateInputEl.value;
        const endVal = ledgerEndDateInputEl.value;

        if (startVal) {
            const localStartDate = new Date(startVal + 'T00:00:00');
            startDate = Timestamp.fromDate(localStartDate);
        }
        if (endVal) {
            const localEndDate = new Date(endVal + 'T23:59:59.999');
            endDate = Timestamp.fromDate(localEndDate);
        }

        // Validate date range
        if (startDate && endDate && startDate.toMillis() > endDate.toMillis()) {
            alert("Start date cannot be after end date."); // English alert
             if(noLedgerEntriesMessageEl) {
                noLedgerEntriesMessageEl.textContent = "Invalid date range."; // English message
                noLedgerEntriesMessageEl.parentElement.style.display = 'table-row';
                ledgerTableBodyEl.appendChild(noLedgerEntriesMessageEl.parentElement);
            }
            updateSummaryCards([]);
            return;
        }
    }
    // 'all_time' means no date filtering

    const filteredEntries = allLedgerEntriesCache.filter(entry => {
        if (!entry.date || typeof entry.date.toMillis !== 'function') return false; // Skip invalid entries
        const entryTimestamp = entry.date; // It's already a Timestamp

        if (selectedRange === 'all_time') return true;
        if (!startDate && !endDate && selectedRange !== 'custom') return true; // Should not happen unless 'all_time'

        const entryMillis = entryTimestamp.toMillis();

        const startMillis = startDate ? startDate.toMillis() : null;
        const endMillis = endDate ? endDate.toMillis() : null;

        if (startMillis && endMillis) return entryMillis >= startMillis && entryMillis <= endMillis;
        if (startMillis) return entryMillis >= startMillis;
        if (endMillis) return entryMillis <= endMillis;

        // If custom range selected but dates are empty, show all (or handle as needed)
        if(selectedRange === 'custom' && !startMillis && !endMillis) return true;

        return false;
    });

    if (filteredEntries.length === 0) {
        if(noLedgerEntriesMessageEl) {
            noLedgerEntriesMessageEl.textContent = "No ledger entries found for the selected period."; // English message
            noLedgerEntriesMessageEl.parentElement.style.display = 'table-row';
            ledgerTableBodyEl.appendChild(noLedgerEntriesMessageEl.parentElement);
        }
    } else {
        if(noLedgerEntriesMessageEl) noLedgerEntriesMessageEl.parentElement.style.display = 'none';
        displayEntriesInTable(filteredEntries);
    }
    updateSummaryCards(filteredEntries);
}


// Display entries in the HTML table
function displayEntriesInTable(entries) {
    // Sort entries by date ascending for running balance calculation
    const entriesForBalanceCalc = [...entries].sort((a, b) => a.date.toMillis() - b.date.toMillis());
    const entriesWithBalance = [];
    let runningBalance = 0;

    entriesForBalanceCalc.forEach(entry => {
        if (entry.type === 'commission') {
            runningBalance += (entry.amount || 0);
        } else if (entry.type === 'payment') {
            runningBalance -= (entry.amount || 0);
        }
        // Add other adjustment types if they exist
        entriesWithBalance.push({...entry, currentBalance: runningBalance });
    });

    // Sort back to descending for display
    ledgerTableBodyEl.innerHTML = ''; // Clear before adding new rows
    entriesWithBalance.sort((a,b) => b.date.toMillis() - a.date.toMillis()).forEach(entry => {
        const row = ledgerTableBodyEl.insertRow();
        row.classList.add(entry.type === 'commission' ? 'commission-entry' : 'payment-entry');

        row.insertCell().textContent = formatDateForDisplay(entry.date);
        row.insertCell().textContent = escapeHtml(entry.description || 'N/A');
        // Try orderId first, then fall back to refId if it exists
        const refDisplay = entry.orderId ? `Order #${entry.orderId}` : (entry.refId ? `Ref: ${entry.refId}` : 'N/A');
        row.insertCell().textContent = escapeHtml(refDisplay);

        const amountCell = row.insertCell();
        amountCell.style.textAlign = 'right';
        const amountPrefix = entry.type === 'commission' ? '+' : (entry.type === 'payment' ? '-' : '');
        amountCell.textContent = `${amountPrefix} ${formatCurrency(entry.amount || 0)}`;

        const balanceCell = row.insertCell();
        balanceCell.style.textAlign = 'right';
        balanceCell.textContent = formatCurrency(entry.currentBalance);
        // Optional: Color based on balance
        balanceCell.classList.remove('balance-positive', 'balance-negative'); // Reset classes
        if (entry.currentBalance < 0) {
             balanceCell.classList.add('balance-negative');
             balanceCell.style.color = 'var(--agent-danger, red)';
        } else if (entry.currentBalance > 0) {
             balanceCell.classList.add('balance-positive');
             balanceCell.style.color = 'var(--agent-success, green)';
        }
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
        // Add other types if needed
    });
    const outstanding = totalCommission - totalPaid;

    if(totalCommissionEarnedEl) totalCommissionEarnedEl.textContent = formatCurrency(totalCommission);
    if(totalPaidToAgentEl) totalPaidToAgentEl.textContent = formatCurrency(totalPaid);
    if(outstandingBalanceEl) {
        outstandingBalanceEl.textContent = formatCurrency(outstanding);
        outstandingBalanceEl.style.color = outstanding < 0 ? 'var(--agent-danger, red)' : (outstanding > 0 ? 'var(--agent-success, green)' : 'inherit');
    }
}

// Event Listeners Setup
document.addEventListener('DOMContentLoaded', () => {
    // onAuthStateChanged is already above and will call fetchLedgerEntries

    if (agentLogoutBtnEl) {
        agentLogoutBtnEl.addEventListener('click', () => {
             if (confirm("Are you sure you want to logout?")) { // Translated
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
                 applyFiltersAndDisplayLedger(); // Apply filter immediately if not custom
            }
        });
    }
    if (applyLedgerFilterBtnEl) {
        applyLedgerFilterBtnEl.addEventListener('click', applyFiltersAndDisplayLedger);
    }

    console.log("Agent Ledger JS Initialized.");
}); // End DOMContentLoaded