// /admin/js/agent_commission_report.js
import { db } from './firebase-init.js'; // एडमिन का Firebase init
import { collection, getDocs, query, where, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// DOM Elements
const reportAgentSelectEl = document.getElementById('reportAgentSelect');
const reportDateRangeSelectEl = document.getElementById('reportDateRange');
const reportCustomDateFiltersDivEl = document.getElementById('reportCustomDateFilters');
const reportStartDateInputEl = document.getElementById('reportStartDate');
const reportEndDateInputEl = document.getElementById('reportEndDate');
const applyReportFilterBtnEl = document.getElementById('applyReportFilterBtn');
const commissionReportTableBodyEl = document.getElementById('commissionReportTableBody');
const loadingReportMessageEl = document.getElementById('loadingReportMessage');
const noReportDataMessageEl = document.getElementById('noReportDataMessage');
const overallOutstandingTotalEl = document.getElementById('overallOutstandingTotal');

let allAgents = []; // एजेंट की जानकारी कैश करने के लिए {id, name, email}
let allLedgerEntries = []; // सभी लेजर एंट्रीज कैश करने के लिए

// Helper function
function formatCurrency(amount) {
    const num = Number(amount);
    return isNaN(num) ? '₹0.00' : num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// 1. सभी एजेंट्स को लोड करें और ड्रॉपडाउन में भरें
async function loadAgentsForFilter() {
    try {
        const agentsSnapshot = await getDocs(collection(db, "agents"));
        allAgents = agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        allAgents.sort((a, b) => a.name.localeCompare(b.name)); // नाम से सॉर्ट करें

        reportAgentSelectEl.innerHTML = '<option value="all_agents" selected>All Agents</option>'; // रीसेट
        allAgents.forEach(agent => {
            const option = document.createElement('option');
            option.value = agent.id;
            option.textContent = `${agent.name} (${agent.email})`;
            reportAgentSelectEl.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading agents for filter:", error);
        reportAgentSelectEl.innerHTML = '<option value="">Error loading agents</option>';
    }
}

// 2. सभी लेजर एंट्रीज को Firestore से लोड करें (एक बार)
async function fetchAllLedgerData() {
    loadingReportMessageEl.style.display = 'table-row';
    noReportDataMessageEl.style.display = 'none';
    commissionReportTableBodyEl.innerHTML = '';
    commissionReportTableBodyEl.appendChild(loadingReportMessageEl);

    try {
        const ledgerSnapshot = await getDocs(collection(db, "agentLedger"));
        allLedgerEntries = ledgerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        generateReport(); // डेटा आने के बाद रिपोर्ट जनरेट करें
    } catch (error) {
        console.error("Error fetching all ledger data:", error);
        loadingReportMessageEl.style.display = 'none';
        commissionReportTableBodyEl.innerHTML = `<tr><td colspan="7" style="color:red; text-align:center;">Error fetching ledger data: ${error.message}</td></tr>`;
    }
}

// 3. रिपोर्ट जनरेट करें और दिखाएं
function generateReport() {
    loadingReportMessageEl.style.display = 'none';
    commissionReportTableBodyEl.innerHTML = ''; // पुरानी एंट्रीज हटाएं

    const selectedAgentId = reportAgentSelectEl.value;
    const selectedDateRange = reportDateRangeSelectEl.value;
    let filterStartDate, filterEndDate;

    // तारीख फिल्टर सेट करें
    const now = new Date();
    if (selectedDateRange === 'current_month') {
        filterStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
        filterEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (selectedDateRange === 'last_month') {
        filterStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        filterEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (selectedDateRange === 'custom') {
        filterStartDate = reportStartDateInputEl.value ? new Date(reportStartDateInputEl.value + "T00:00:00") : null;
        filterEndDate = reportEndDateInputEl.value ? new Date(reportEndDateInputEl.value + "T23:59:59") : null;
    }

    // लेजर एंट्रीज को फिल्टर करें
    let filteredLedgerEntries = allLedgerEntries.filter(entry => {
        // एजेंट फिल्टर
        if (selectedAgentId !== 'all_agents' && entry.agentId !== selectedAgentId) {
            return false;
        }
        // तारीख फिल्टर (यदि लागू हो)
        if (filterStartDate && filterEndDate) {
            const entryDate = entry.date.toDate();
            if (entryDate < filterStartDate || entryDate > filterEndDate) {
                return false;
            }
        }
        return true;
    });

    if (filteredLedgerEntries.length === 0) {
        noReportDataMessageEl.style.display = 'table-row';
        commissionReportTableBodyEl.appendChild(noReportDataMessageEl);
        overallOutstandingTotalEl.textContent = formatCurrency(0);
        return;
    }
    noReportDataMessageEl.style.display = 'none';

    // एजेंट के अनुसार डेटा समूहित करें
    const reportData = {}; // { agentId: { name, email, commission, paid, ordersCount, outstanding } }

    allAgents.forEach(agent => {
        if (selectedAgentId === 'all_agents' || selectedAgentId === agent.id) {
            reportData[agent.id] = {
                name: agent.name,
                email: agent.email,
                commission: 0,
                paid: 0,
                ordersCount: 0, // यह अभी भी गणना करने की आवश्यकता है
                outstanding: 0
            };
        }
    });
    
    const agentOrderCounts = {}; // { agentId: Set(orderId1, orderId2) }

    filteredLedgerEntries.forEach(entry => {
        if (reportData[entry.agentId]) {
            if (entry.type === 'commission') {
                reportData[entry.agentId].commission += entry.amount;
                if(entry.orderId) { // Count unique orders for commission
                    if(!agentOrderCounts[entry.agentId]) agentOrderCounts[entry.agentId] = new Set();
                    agentOrderCounts[entry.agentId].add(entry.orderId);
                }
            } else if (entry.type === 'payment') {
                reportData[entry.agentId].paid += entry.amount;
            }
        }
    });

    let overallOutstanding = 0;

    for (const agentId in reportData) {
        reportData[agentId].outstanding = reportData[agentId].commission - reportData[agentId].paid;
        reportData[agentId].ordersCount = agentOrderCounts[agentId] ? agentOrderCounts[agentId].size : 0;
        overallOutstanding += reportData[agentId].outstanding;

        const row = commissionReportTableBodyEl.insertRow();
        row.insertCell().textContent = reportData[agentId].name;
        row.insertCell().textContent = reportData[agentId].email;
        const ordersCountCell = row.insertCell();
        ordersCountCell.style.textAlign = 'right';
        ordersCountCell.textContent = reportData[agentId].ordersCount;
        
        const commissionCell = row.insertCell();
        commissionCell.style.textAlign = 'right';
        commissionCell.textContent = formatCurrency(reportData[agentId].commission);

        const paidCell = row.insertCell();
        paidCell.style.textAlign = 'right';
        paidCell.textContent = formatCurrency(reportData[agentId].paid);

        const outstandingCell = row.insertCell();
        outstandingCell.style.textAlign = 'right';
        outstandingCell.textContent = formatCurrency(reportData[agentId].outstanding);

        // एक्शन बटन (जैसे, इस एजेंट का पूरा लेजर देखें)
        const actionCell = row.insertCell();
        actionCell.style.textAlign = 'center';
        const viewLedgerBtn = document.createElement('button');
        viewLedgerBtn.classList.add('button', 'action-button');
        viewLedgerBtn.innerHTML = '<i class="fas fa-eye"></i> View Ledger';
        viewLedgerBtn.onclick = () => {
            // TODO: इस एजेंट के लेजर पेज पर रीडायरेक्ट करें या Modal में दिखाएं
            // window.open(`/agent/ledger.html?agentId=${agentId}`); // उदाहरण
            alert(`View ledger for agent: ${reportData[agentId].name} (ID: ${agentId}) - Functionality to be implemented.`);
        };
        actionCell.appendChild(viewLedgerBtn);
    }
    overallOutstandingTotalEl.textContent = formatCurrency(overallOutstanding);
}


// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    await loadAgentsForFilter(); // पहले एजेंट्स लोड करें
    await fetchAllLedgerData(); // फिर सारा लेजर डेटा एक बार में लोड करें

    reportDateRangeSelectEl.addEventListener('change', () => {
        reportCustomDateFiltersDivEl.style.display = reportDateRangeSelectEl.value === 'custom' ? 'flex' : 'none';
    });

    applyReportFilterBtnEl.addEventListener('click', generateReport); // फिल्टर बदलने पर सिर्फ रिपोर्ट दोबारा जनरेट करें
});