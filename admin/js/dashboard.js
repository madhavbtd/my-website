// js/dashboard.js (Revised Import & Structure + Updates + Online Pending Orders KPI + Quick Payment - Dedicated Search Modal)

// Import initialized db and auth from firebase-init.js
import { db, auth } from './firebase-init.js';

// Import necessary functions directly from the SDK
// Ensure all needed functions are listed here
import { collection, onSnapshot, query, where, getDocs, limit, orderBy, Timestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- DOM Elements ---
const countElements = {
    "Order Received": document.getElementById('count-order-received'),
    "Designing": document.getElementById('count-designing'),
    "Verification": document.getElementById('count-verification'),
    "Design Approved": document.getElementById('count-design-approved'),
    "Ready for Working": document.getElementById('count-ready-for-working'),
    "Printing": document.getElementById('count-printing'),
    "Delivered": document.getElementById('count-delivered'),
    "Completed": document.getElementById('count-completed')
};
const orderIdSearchInput = document.getElementById('order-id-search'); // Main search input
const orderIdSearchButton = document.getElementById('order-id-search-button'); // Main search button
const suggestionsContainer = document.getElementById('order-suggestions'); // Main search suggestions
const welcomeUserSpan = document.getElementById('welcome-user');
const dateTimeSpan = document.getElementById('currentDateTime');
const logoutLink = document.getElementById('logout-link');
// KPI Elements
const kpiTotalCustomers = document.getElementById('kpi-total-customers');
const kpiTotalSuppliers = document.getElementById('kpi-total-suppliers');
const kpiPendingPayments = document.getElementById('kpi-pending-payments');
const kpiOrdersToday = document.getElementById('kpi-orders-today');
const kpiPendingPOs = document.getElementById('kpi-pending-pos');
const kpiOnlinePendingOrders = document.getElementById('kpi-online-pending-orders');
// Other List Elements
const recentActivityList = document.getElementById('recent-activity-list');
const licReminderList = document.getElementById('lic-reminder-list');
const upcomingTaskList = document.getElementById('upcoming-task-list');
const upcomingDeliveryList = document.getElementById('upcoming-delivery-list');
const orderStatusChartCanvas = document.getElementById('orderStatusChart');
let orderChartInstance = null;

// --- Quick Payment - New Search Modal DOM Elements ---
const quickAddPaymentBtn = document.getElementById('quickAddPaymentBtn');
const quickPaymentSearchModal = document.getElementById('quickPaymentSearchModal');
const closeQuickSearchModalBtn = document.getElementById('closeQuickSearchModal');
const cancelQuickSearchBtn = document.getElementById('cancelQuickSearchBtn');
const quickPaymentSearchInput = document.getElementById('quick-payment-search-input');
const quickPaymentSearchResultsContainer = document.getElementById('quick-payment-search-results');

// --- Quick Payment - Payment Entry Modal DOM Elements ---
const addPaymentModal = document.getElementById('addPaymentModal');
const closePaymentModalBtn = document.getElementById('closePaymentModal');
const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
const addPaymentForm = document.getElementById('addPaymentForm');
const paymentModalCustNameSpan = document.getElementById('payment-modal-cust-name');
const paymentModalCustBalance = document.getElementById('payment-modal-cust-balance'); // Balance display
const quickPaymentCustomerIdInput = document.getElementById('quickPaymentCustomerId'); // Hidden input for ID
const paymentAmountInput = document.getElementById('paymentAmount');
const paymentDateInput = document.getElementById('paymentDate');
const paymentMethodSelect = document.getElementById('paymentMethod');
const paymentNotesInput = document.getElementById('paymentNotes');
const savePaymentBtn = document.getElementById('savePaymentBtn');

// Global state
let mainSearchDebounceTimer; // Renamed from suggestionDebounceTimer
let quickSearchDebounceTimer; // New timer for quick search
let dateTimeIntervalId = null;
let userRole = null;
let quickPaymentTargetCustomerId = null; // To store customer ID for saving payment

// --- Initialization on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DEBUG] Dashboard DOM Loaded (Using firebase-init - Dedicated Quick Search Modal).");
    if (!auth) {
        console.error("Firebase Auth instance not found! Check firebase-init.js loading.");
        alert("Critical Error: Authentication system failed to load.");
        return;
    }
    setupEventListeners();
    listenForAuthChanges();
});

// --- Setup Event Listeners ---
function setupEventListeners() {
    // Main Search Bar Listeners
    if (orderIdSearchInput) {
        orderIdSearchInput.addEventListener('input', handleMainSearchInput); // Use new handler name
        // Blur event to hide suggestions, but with a slight delay to allow clicks
        orderIdSearchInput.addEventListener('blur', () => setTimeout(clearMainSuggestions, 150)); // Use new clear func name
    }
    if (orderIdSearchButton) orderIdSearchButton.addEventListener('click', triggerMainSearch); // Use new trigger func name

    // Logout
    if (logoutLink) logoutLink.addEventListener('click', handleLogout);

    // --- Quick Payment Listeners ---
    // Button to open the search modal
    if (quickAddPaymentBtn) quickAddPaymentBtn.addEventListener('click', handleQuickPaymentClick); // Opens search modal

    // New Search Modal Listeners
    if(closeQuickSearchModalBtn) closeQuickSearchModalBtn.addEventListener('click', closeQuickSearchModal);
    if(cancelQuickSearchBtn) cancelQuickSearchBtn.addEventListener('click', closeQuickSearchModal);
    if(quickPaymentSearchModal) quickPaymentSearchModal.addEventListener('click', (event) => { if(event.target === quickPaymentSearchModal) closeQuickSearchModal(); });
    if (quickPaymentSearchInput) { // Listener for typing in the search modal input
        quickPaymentSearchInput.addEventListener('input', () => {
            clearTimeout(quickSearchDebounceTimer);
            const searchTerm = quickPaymentSearchInput.value.trim();
            if (searchTerm.length > 1) {
                quickSearchDebounceTimer = setTimeout(searchCustomersForQuickPayment, 400);
            } else {
                 if(quickPaymentSearchResultsContainer) quickPaymentSearchResultsContainer.innerHTML = '<div class="suggestion-item no-suggestions">कम से कम 2 अक्षर टाइप करें...</div>';
            }
        });
    }

    // Existing Payment Entry Modal Listeners
    if (closePaymentModalBtn) closePaymentModalBtn.addEventListener('click', closeAddPaymentModal);
    if (cancelPaymentBtn) cancelPaymentBtn.addEventListener('click', closeAddPaymentModal);
    if (addPaymentModal) addPaymentModal.addEventListener('click', (event) => { if (event.target === addPaymentModal) closeAddPaymentModal(); });
    if (addPaymentForm) addPaymentForm.addEventListener('submit', handleSavePayment); // Saves the payment

    console.log("[DEBUG] Dashboard event listeners set up (Dedicated Quick Search Modal).");
}

// --- Date/Time Update ---
function updateDateTime() {
    if (!dateTimeSpan) return;
    const now = new Date();
    const optsDate = { year: 'numeric', month: 'short', day: 'numeric' };
    const optsTime = { hour: 'numeric', minute: '2-digit', hour12: true };
    const optsDay = { weekday: 'long' };
    try {
        const date = now.toLocaleDateString('en-IN', optsDate);
        const day = now.toLocaleDateString('en-IN', optsDay);
        const time = now.toLocaleTimeString('en-US', optsTime);
        dateTimeSpan.textContent = `${date} | ${day} | ${time}`;
        dateTimeSpan.classList.remove('loading-placeholder');
    } catch (e) {
        console.error("Error formatting date/time:", e);
        dateTimeSpan.textContent = 'Error loading time';
        dateTimeSpan.classList.remove('loading-placeholder');
    }
}

function startDateTimeUpdate() {
    if (dateTimeIntervalId) clearInterval(dateTimeIntervalId);
    updateDateTime();
    dateTimeIntervalId = setInterval(updateDateTime, 10000); // Check every 10 secs
}

// --- Authentication Handling ---
function listenForAuthChanges() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("[DEBUG] User authenticated via onAuthStateChanged.");
            startDateTimeUpdate();
            user.getIdTokenResult(true).then((idTokenResult) => {
                userRole = idTokenResult.claims.role || 'Standard';
                if (welcomeUserSpan) {
                    welcomeUserSpan.textContent = `Welcome ${user.email || 'User'} (${userRole})`;
                }
                 console.log(`[DEBUG] User role identified as: ${userRole}`);
                 initializeDashboardDataFetching();
            }).catch(error => {
                console.error('Error getting user role:', error);
                if (welcomeUserSpan) welcomeUserSpan.textContent = `Welcome ${user.email || 'User'} (Role Error)`;
                 initializeDashboardDataFetching();
            });
        } else {
            console.log("[DEBUG] User not authenticated. Redirecting...");
            if (!window.location.pathname.endsWith('login.html')) {
                 window.location.replace('login.html');
            }
            if (welcomeUserSpan) welcomeUserSpan.textContent = 'Not Logged In';
            if (dateTimeIntervalId) clearInterval(dateTimeIntervalId);
            if (dateTimeSpan) dateTimeSpan.textContent = '';
             clearDashboardDataDisplay();
        }
    });
}

// Function to clear dashboard data display on logout
function clearDashboardDataDisplay() {
    Object.values(countElements).forEach(el => showLoading(el));
    if(kpiTotalCustomers) showLoading(kpiTotalCustomers);
    if(kpiTotalSuppliers) showLoading(kpiTotalSuppliers);
    if(kpiOrdersToday) showLoading(kpiOrdersToday);
    if(kpiPendingPayments) showLoading(kpiPendingPayments);
    if(kpiPendingPOs) showLoading(kpiPendingPOs);
    if(kpiOnlinePendingOrders) showLoading(kpiOnlinePendingOrders);
    if(recentActivityList) showLoading(recentActivityList, 'list');
    if(licReminderList) showLoading(licReminderList, 'list');
    if(upcomingTaskList) showLoading(upcomingTaskList, 'list');
    if(upcomingDeliveryList) showLoading(upcomingDeliveryList, 'list');
    if(orderChartInstance) { orderChartInstance.destroy(); orderChartInstance = null; }
    if(orderStatusChartCanvas) {
        const ctx = orderStatusChartCanvas.getContext('2d');
        if(ctx) ctx.clearRect(0, 0, orderStatusChartCanvas.width, orderStatusChartCanvas.height);
    }
    console.log("[DEBUG] Dashboard data display cleared on logout.");
}

// Function to initialize all data fetching
function initializeDashboardDataFetching() {
    console.log("[DEBUG] Initializing data fetching...");
    listenForOrderCounts();
    loadDashboardKPIs();
    listenForOnlineOrderCount();
    loadRecentActivity();
    loadRemindersAndTasks();
}

// --- Logout Handler ---
function handleLogout(e) {
    e.preventDefault();
    if (confirm("Are you sure you want to logout?")) {
        signOut(auth).then(() => {
            console.log('User signed out.');
        }).catch((error) => {
            console.error('Sign out error:', error);
            alert("Logout failed.");
        });
    }
}

// --- Loading Indicators ---
function showLoading(element, type = 'text') {
    if (!element) return;
    if (type === 'spinner') { element.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 0.8em; color: #aaa;"></i>'; }
    else if (type === 'list') { element.innerHTML = '<li class="loading-placeholder" style="color:#aaa; font-style:italic;">Loading...</li>'; }
    else { element.innerHTML = '<span class="loading-placeholder" style="color:#aaa;">...</span>'; }
}

// --- Currency Formatter ---
function formatCurrency(amount) {
    const num = Number(amount || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// --- Dashboard Counts & Chart ---
function updateDashboardCounts(orders) {
    const statusCounts = {
        "Order Received": 0, "Designing": 0, "Verification": 0, "Design Approved": 0,
        "Ready for Working": 0, "Printing": 0, "Delivered": 0, "Completed": 0
    };
    orders.forEach(order => { const status = order.status; if (status && statusCounts.hasOwnProperty(status)) { statusCounts[status]++; } });

    let totalActiveOrders = 0;
    for (const status in countElements) {
        if (countElements[status]) {
            const count = statusCounts[status] || 0;
            const panelItem = countElements[status].closest('.panel-item');
            if (panelItem) {
                 panelItem.className = panelItem.className.replace(/\b\S+-status\b/g, '').trim();
                 const statusClass = status.toLowerCase().replace(/\s+/g, '-') + '-status';
                 panelItem.classList.add(statusClass);
            }
            countElements[status].textContent = count.toString().padStart(2, '0');
            if (status !== "Completed" && status !== "Delivered") {
                 totalActiveOrders += count;
            }
        }
    }
    console.log(`[DEBUG] Dashboard Counts Updated. Total Active: ${totalActiveOrders}`);
    initializeOrUpdateChart(statusCounts);
}

function listenForOrderCounts() {
    Object.values(countElements).forEach(el => showLoading(el));
    try {
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef);
        onSnapshot(q, (snapshot) => {
            const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateDashboardCounts(orders);
        }, (error) => {
             console.error("[DEBUG] Error listening to order counts:", error);
             Object.values(countElements).forEach(el => { if(el) el.textContent = 'Err'; });
             if(orderChartInstance) { orderChartInstance.destroy(); orderChartInstance = null; }
        });
    } catch (e) {
        console.error("Error setting up counts listener:", e);
        Object.values(countElements).forEach(el => { if(el) el.textContent = 'Err'; });
    }
}

function initializeOrUpdateChart(statusCounts) {
    if (!orderStatusChartCanvas || typeof Chart === 'undefined') {
         console.warn("Chart canvas or Chart.js library not found.");
         return;
    }
    const labels = Object.keys(statusCounts);
    const data = Object.values(statusCounts);
    const backgroundColors = labels.map(label => {
        switch(label.toLowerCase()) {
            case "order received": return 'rgba(108, 117, 125, 0.7)'; case "designing":      return 'rgba(255, 193, 7, 0.7)'; case "verification":   return 'rgba(253, 126, 20, 0.7)'; case "design approved": return 'rgba(32, 201, 151, 0.7)'; case "printing":       return 'rgba(23, 162, 184, 0.7)'; case "ready for working": return 'rgba(111, 66, 193, 0.7)'; case "delivered":      return 'rgba(13, 202, 240, 0.7)'; case "completed":      return 'rgba(40, 167, 69, 0.7)'; default:               return 'rgba(200, 200, 200, 0.7)';
        }
    });
    const borderColors = backgroundColors.map(color => color.replace('0.7', '1'));

    const chartData = { labels: labels, datasets: [{ label: 'Order Count', data: data, backgroundColor: backgroundColors, borderColor: borderColors, borderWidth: 1 }] };
    const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15, font: { size: 10 } } }, tooltip: { callbacks: { label: function(context){ return `${context.label || ''}: ${context.parsed || 0}`; } } }, title: { display: false } }, cutout: '50%' };

    if (orderChartInstance) { orderChartInstance.destroy(); }

    try {
        orderChartInstance = new Chart(orderStatusChartCanvas, { type: 'doughnut', data: chartData, options: chartOptions });
        console.log("[DEBUG] Chart initialized/updated.");
    } catch (e) {
        console.error("Error creating chart:", e);
         const ctx = orderStatusChartCanvas.getContext('2d');
         if (ctx) { ctx.clearRect(0, 0, orderStatusChartCanvas.width, orderStatusChartCanvas.height); ctx.fillStyle = '#6c757d'; ctx.textAlign = 'center'; ctx.fillText('Chart Error', orderStatusChartCanvas.width / 2, orderStatusChartCanvas.height / 2); }
    }
}

// --- Online Pending Order Count Listener ---
function listenForOnlineOrderCount() {
    const element = kpiOnlinePendingOrders;
    if (!element) {
        console.warn("KPI element for online pending orders not found.");
        return;
    }
    showLoading(element);
    try {
        const onlineOrdersRef = collection(db, "online_orders");
        const q = query(onlineOrdersRef);
        onSnapshot(q, (snapshot) => {
            const count = snapshot.size;
            element.textContent = count.toString();
            console.log(`[DEBUG] Online Pending Orders Count Updated: ${count}`);
        }, (error) => {
            console.error("[DEBUG] Error listening to online order counts:", error);
            if(element) element.textContent = 'Err';
        });
    } catch (e) {
        console.error("Error setting up online orders count listener:", e);
        if(element) element.textContent = 'Err';
    }
}

// --- Load KPIs ---
// Helper Function for Balance Calculation (Needed for Pending Payments KPI)
async function getCustomerBalanceForKPI(customerId) {
    try {
        const [orderTotal, paymentTotal, adjustmentTotals] = await Promise.all([
            getCustomerTotalOrderValue(customerId), // Reuse balance calculation function
            getCustomerTotalPaymentAmount(customerId),
            getCustomerAdjustmentTotals(customerId)
        ]);
        const totalDebits = orderTotal + adjustmentTotals.totalDebit;
        const totalCredits = paymentTotal + adjustmentTotals.totalCredit;
        return totalDebits - totalCredits; // Return raw balance number
    } catch (error) {
        console.error(`Error getting balance for customer ${customerId}:`, error);
        return 0; // Assume zero balance on error to avoid NaN
    }
}

async function loadDashboardKPIs() {
    showLoading(kpiTotalCustomers); showLoading(kpiTotalSuppliers); showLoading(kpiOrdersToday); showLoading(kpiPendingPayments); showLoading(kpiPendingPOs);

    try { const custSnapshot = await getDocs(collection(db, "customers")); if (kpiTotalCustomers) kpiTotalCustomers.textContent = custSnapshot.size; } catch (e) { console.error("KPI Error (Cust):", e); if(kpiTotalCustomers) kpiTotalCustomers.textContent = 'Err'; }
    try { const suppSnapshot = await getDocs(collection(db, "suppliers")); if (kpiTotalSuppliers) kpiTotalSuppliers.textContent = suppSnapshot.size; } catch (e) { console.error("KPI Error (Supp):", e); if(kpiTotalSuppliers) kpiTotalSuppliers.textContent = 'Err'; }
    try { const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0); const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999); const q = query(collection(db, "orders"), where('createdAt', '>=', Timestamp.fromDate(todayStart)), where('createdAt', '<=', Timestamp.fromDate(todayEnd))); const todaySnapshot = await getDocs(q); if(kpiOrdersToday) kpiOrdersToday.textContent = todaySnapshot.size; } catch (e) { console.error("KPI Error (Orders Today):", e); if(kpiOrdersToday) kpiOrdersToday.textContent = 'Err'; }
    // --- Pending Payments KPI Calculation (Using Full Balance) ---
    try {
        const customersSnapshot = await getDocs(collection(db, "customers"));
        let totalPendingAmount = 0;
        // Create an array of promises to get balance for each customer
        const balancePromises = customersSnapshot.docs.map(doc => getCustomerBalanceForKPI(doc.id));
        // Wait for all balances to be calculated
        const balances = await Promise.all(balancePromises);
        // Sum up positive balances (amount due)
        balances.forEach(balance => {
            if (balance > 0) {
                totalPendingAmount += balance;
            }
        });
        if (kpiPendingPayments) { kpiPendingPayments.textContent = formatCurrency(totalPendingAmount); }
         console.log(`[DEBUG] Total Pending Payments Calculated (Full Balance): ${formatCurrency(totalPendingAmount)}`);
    } catch (e) { console.error("KPI Error (Pending Payments - Full):", e); if(kpiPendingPayments) kpiPendingPayments.textContent = '₹ Err'; }
    // --- End Pending Payments ---
    try { const poQuery = query(collection(db, "purchaseOrders"), where('status', '==', 'Pending')); const poSnapshot = await getDocs(poQuery); const pendingPoCount = poSnapshot.size; if (kpiPendingPOs) { kpiPendingPOs.textContent = pendingPoCount; } console.log(`[DEBUG] Pending POs Count: ${pendingPoCount}`); } catch (e) { console.error("KPI Error (Pending POs):", e); if(kpiPendingPOs) kpiPendingPOs.textContent = 'Err'; }
}

// --- Load Recent Activity ---
async function loadRecentActivity() {
    if (!recentActivityList) return; showLoading(recentActivityList, 'list');
    try {
        const q = query(collection(db, "orders"), orderBy('updatedAt', 'desc'), limit(5));
        const snapshot = await getDocs(q); recentActivityList.innerHTML = '';
        if (snapshot.empty) { recentActivityList.innerHTML = '<li>No recent activity.</li>'; } else { snapshot.forEach(doc => { const order = doc.data(); const li = document.createElement('li'); const orderId = order.orderId || `Sys:${doc.id.substring(0,6)}`; const custName = order.customerDetails?.fullName || 'Unknown'; const status = order.status || 'N/A'; const time = order.updatedAt?.toDate ? formatTimeAgo(order.updatedAt.toDate()) : 'recent'; li.innerHTML = `<span>Order <strong>${orderId}</strong> (${custName}) status: ${status}</span><span class="activity-time">${time}</span>`; li.style.cursor = 'pointer'; li.onclick = () => { window.location.href = `order_history.html?openModalForId=${doc.id}`; }; recentActivityList.appendChild(li); }); }
    } catch (e) { console.error("Error fetching recent activity:", e); if(recentActivityList) recentActivityList.innerHTML = '<li>Error loading activity.</li>'; }
}

// --- Load Reminders & Tasks ---
async function loadRemindersAndTasks() {
    if (licReminderList) { showLoading(licReminderList, 'list'); console.warn("LIC Reminder section needs Firestore query implementation in dashboard.js."); setTimeout(() => { if(licReminderList && licReminderList.innerHTML.includes('Loading')) licReminderList.innerHTML = '<li>(LIC Reminder Data Not Implemented)</li>'; }, 2000); }
    if (upcomingTaskList) { showLoading(upcomingTaskList, 'list'); console.warn("Upcoming Tasks section needs Firestore query implementation in dashboard.js."); setTimeout(() => { if(upcomingTaskList && upcomingTaskList.innerHTML.includes('Loading')) upcomingTaskList.innerHTML = '<li>(Task Data Not Implemented)</li>'; }, 2100); }
    if (upcomingDeliveryList) {
        showLoading(upcomingDeliveryList, 'list');
        try {
            const threeDaysLater = new Date(); threeDaysLater.setDate(threeDaysLater.getDate() + 3); threeDaysLater.setHours(23, 59, 59, 999); const todayStart = new Date(); todayStart.setHours(0,0,0,0);
            const qDel = query(collection(db, "orders"), where('deliveryDate', '>=', Timestamp.fromDate(todayStart)), where('deliveryDate', '<=', Timestamp.fromDate(threeDaysLater)), orderBy('deliveryDate', 'asc'), limit(5));
            const delSnapshot = await getDocs(qDel); upcomingDeliveryList.innerHTML = '';
            if(delSnapshot.empty) { upcomingDeliveryList.innerHTML = '<li>No deliveries due soon.</li>'; } else { delSnapshot.forEach(doc => { const order = doc.data(); const li = document.createElement('li'); li.innerHTML = `Order <strong>${order.orderId || 'N/A'}</strong> (${order.customerDetails?.fullName || '?'}) - Due: ${order.deliveryDate.toDate().toLocaleDateString('en-GB')}`; li.style.cursor = 'pointer'; li.onclick = () => { window.location.href = `order_history.html?openModalForId=${doc.id}`; }; upcomingDeliveryList.appendChild(li); }); }
        } catch (e) { console.error("Error fetching upcoming deliveries:", e); if(upcomingDeliveryList) upcomingDeliveryList.innerHTML = '<li>Error loading deliveries.</li>'; }
    }
}

// --- Helper Function: Time Ago ---
function formatTimeAgo(date) {
  if (!(date instanceof Date)) return ''; const seconds = Math.floor((new Date() - date) / 1000); if (seconds < 5) return "just now"; if (seconds < 60) return Math.floor(seconds) + "s ago"; const minutes = Math.floor(seconds / 60); if (minutes < 60) return minutes + "m ago"; const hours = Math.floor(minutes / 60); if (hours < 24) return hours + "h ago"; const days = Math.floor(hours / 24); if (days < 30) return days + "d ago"; const months = Math.floor(days / 30); if (months < 12) return months + "mo ago"; const years = Math.floor(days / 365); return years + "y ago";
}


// ==============================================================
// <<< MAIN Dashboard Search Functions (Orders, LIC, etc.) >>>
// ==============================================================
function handleMainSearchInput() { clearTimeout(mainSearchDebounceTimer); const searchTerm = orderIdSearchInput.value.trim(); if (searchTerm.length > 1) { mainSearchDebounceTimer = setTimeout(() => fetchAndDisplayMainSuggestions(searchTerm), 300); } else { clearMainSuggestions(); } }
function triggerMainSearch() { const searchTerm = orderIdSearchInput.value.trim(); if(searchTerm.length > 1) fetchAndDisplayMainSuggestions(searchTerm); else clearMainSuggestions(); }
function clearMainSuggestions() { if (suggestionsContainer) { suggestionsContainer.innerHTML = ''; suggestionsContainer.style.display = 'none'; } }

async function fetchAndDisplayMainSuggestions(searchTerm) {
    if (!suggestionsContainer || !db) return;
    if (!searchTerm) { clearMainSuggestions(); return; }

    suggestionsContainer.innerHTML = '<div class="suggestion-item loading-placeholder">Searching...</div>';
    suggestionsContainer.style.display = 'block';

    try {
        const ordersRef = collection(db, "orders");
        const licCustomersRef = collection(db, "licCustomers");
        // Customers are now searched only in the quick payment modal
        // const customersRef = collection(db, "customers");
        const searchLower = searchTerm.toLowerCase();
        const searchUpper = searchTerm.toUpperCase();

        // --- Firebase Queries (excluding Customer search for main bar) ---
        const orderByIdQuery = query(ordersRef, where('orderId', '>=', searchTerm), where('orderId', '<=', searchTerm + '\uf8ff'), limit(3));
        const orderByCustomerNameQuery = query(ordersRef, limit(15)); // Fetch more initially for client-side filter
        const licByNameQuery = query(licCustomersRef, where('customerNameLower', '>=', searchLower), where('customerNameLower', '<=', searchLower + '\uf8ff'), limit(3));
        const licByPolicyNoQuery = query(licCustomersRef, where('policyNumber', '>=', searchTerm), where('policyNumber', '<=', searchTerm + '\uf8ff'), limit(3));

        // Execute queries in parallel
        const [
            orderByIdSnapshot,
            orderByCustomerNameSnapshot,
            licByNameSnapshot,
            licByPolicyNoSnapshot,
        ] = await Promise.allSettled([
            getDocs(orderByIdQuery),
            getDocs(orderByCustomerNameQuery),
            getDocs(licByNameQuery),
            getDocs(licByPolicyNoQuery),
        ]);

        let suggestions = [];
        const addedIds = new Set();

        // Function to add suggestion if unique
        const addUniqueSuggestion = (item, type) => {
             const uniqueKey = `${type}-${item.id}`;
             if (!addedIds.has(uniqueKey)) {
                 suggestions.push({ ...item, type: type });
                 addedIds.add(uniqueKey);
             }
        };

        // --- Process Results (Orders and LIC only) ---
        // Orders by ID
        if (orderByIdSnapshot.status === 'fulfilled') {
            orderByIdSnapshot.value.forEach(doc => addUniqueSuggestion({ id: doc.id, ...doc.data() }, 'Order'));
        } else { console.error("Order by ID query failed:", orderByIdSnapshot.reason); }

        // Orders by Customer Name (Client-side filter)
        if (orderByCustomerNameSnapshot.status === 'fulfilled') {
            orderByCustomerNameSnapshot.value.forEach(doc => {
                const order = { id: doc.id, ...doc.data() };
                if (order.customerDetails?.fullName?.toLowerCase().includes(searchLower)) {
                    addUniqueSuggestion(order, 'Order');
                }
            });
        } else { console.error("Order by Name query failed:", orderByCustomerNameSnapshot.reason); }

        // LIC by Name
        if (licByNameSnapshot.status === 'fulfilled') {
             licByNameSnapshot.value.forEach(doc => addUniqueSuggestion({ id: doc.id, ...doc.data() }, 'LIC'));
        } else { console.error("LIC by Name query failed:", licByNameSnapshot.reason); }

         // LIC by Policy No
         if (licByPolicyNoSnapshot.status === 'fulfilled') {
             licByPolicyNoSnapshot.value.forEach(doc => addUniqueSuggestion({ id: doc.id, ...doc.data() }, 'LIC'));
        } else { console.error("LIC by Policy No query failed:", licByPolicyNoSnapshot.reason); }


        // --- Render Suggestions ---
        suggestions = suggestions.slice(0, 10); // Limit total suggestions
        suggestionsContainer.innerHTML = '';

        if (suggestions.length === 0) {
            suggestionsContainer.innerHTML = '<div class="suggestion-item no-suggestions">कोई मिलान नहीं मिला।</div>';
        } else {
            suggestions.forEach((item) => {
                const suggestionDiv = document.createElement('div');
                suggestionDiv.classList.add('suggestion-item');
                let iconClass = '';
                let displayName = '';
                let destinationUrl = '#';

                // --- Determine display based on type ---
                 if (item.type === 'Order') {
                    iconClass = 'fas fa-receipt';
                    displayName = `Order: ${item.orderId || 'N/A'} (${item.customerDetails?.fullName || 'Unknown'}) - ${item.status || 'N/A'}`;
                    destinationUrl = `order_history.html?openModalForId=${item.id}`;
                } else if (item.type === 'LIC') {
                    iconClass = 'fas fa-shield-alt';
                    displayName = `LIC: ${item.customerName || 'N/A'} (Policy: ${item.policyNumber || 'N/A'})`;
                    destinationUrl = `lic_management.html?openClientDetail=${item.id}`;
                 }
                 // Removed CustomerProfile type handling from main search

                suggestionDiv.innerHTML = `<i class="${iconClass}" style="margin-right: 8px; color: #555; width: 16px; text-align: center;"></i> ${displayName}`;
                suggestionDiv.setAttribute('data-firestore-id', item.id);
                suggestionDiv.setAttribute('data-type', item.type);
                suggestionDiv.setAttribute('data-url', destinationUrl);
                suggestionDiv.title = `Click to view ${item.type}`;

                // --- Mousedown Listener for Navigation ---
                suggestionDiv.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    const targetElement = e.currentTarget;
                    const url = targetElement.getAttribute('data-url');
                    if (url && url !== '#') {
                        window.location.href = url;
                    }
                    clearMainSuggestions();
                });
                // --- End of Mousedown Listener ---
                suggestionsContainer.appendChild(suggestionDiv);
            });
        }
        suggestionsContainer.style.display = 'block';

    } catch (error) {
        console.error("Error fetching or displaying main suggestions:", error);
        if (suggestionsContainer) {
             suggestionsContainer.innerHTML = '<div class="suggestion-item no-suggestions">सुझाव लाने में त्रुटि हुई।</div>';
             suggestionsContainer.style.display = 'block';
        }
    }
}
// ==============================================================
// <<< END OF MAIN Dashboard Search Functions >>>
// ==============================================================


// ==============================================================
// <<< NEW Quick Payment Functions (Dedicated Search Modal Flow) >>>
// ==============================================================

// --- Function to handle the Quick Payment button click ---
// Opens the dedicated search modal
function handleQuickPaymentClick() {
    if (quickPaymentSearchModal && quickPaymentSearchInput && quickPaymentSearchResultsContainer) {
        console.log("क्विक पेमेंट सर्च Modal खोल रहे हैं।");
        quickPaymentSearchInput.value = ''; // Clear input
        quickPaymentSearchResultsContainer.innerHTML = '<div class="suggestion-item no-suggestions">खोजने के लिए टाइप करें...</div>'; // Show default text
        quickPaymentSearchModal.classList.add('active'); // Show the new search modal
        quickPaymentSearchInput.focus(); // Focus the input
    } else {
        console.error("क्विक पेमेंट सर्च Modal या उसके एलिमेंट्स नहीं मिले!");
        alert("क्विक पेमेंट फ़ॉर्म खोलने में त्रुटि।");
    }
}

// --- Function to close the Quick Payment Search modal ---
function closeQuickSearchModal() {
    if (quickPaymentSearchModal) {
        quickPaymentSearchModal.classList.remove('active');
    }
}

// --- Function to search customers within the Quick Payment Search modal ---
async function searchCustomersForQuickPayment() {
    if (!quickPaymentSearchInput || !quickPaymentSearchResultsContainer || !db) return;

    const searchTerm = quickPaymentSearchInput.value.trim();
    quickPaymentSearchResultsContainer.innerHTML = '<div class="suggestion-item loading-placeholder">खोज रहे हैं...</div>'; // Show loading

    if (searchTerm.length < 2) { // Search only if >= 2 chars
        quickPaymentSearchResultsContainer.innerHTML = '<div class="suggestion-item no-suggestions">कम से कम 2 अक्षर टाइप करें...</div>';
        return;
    }

    const searchLower = searchTerm.toLowerCase();
    const customersRef = collection(db, "customers");
    let results = [];
    const addedIds = new Set(); // To prevent duplicates

    try {
        // Define queries
        const nameQuery = query(customersRef,
            where('fullNameLower', '>=', searchLower),
            where('fullNameLower', '<=', searchLower + '\uf8ff'),
            limit(5)
        );
        const whatsappQuery = query(customersRef,
            where('whatsappNo', '>=', searchTerm),
            where('whatsappNo', '<=', searchTerm + '\uf8ff'),
            limit(5)
        );
        const contactQuery = query(customersRef,
            where('contactNo', '>=', searchTerm),
            where('contactNo', '<=', searchTerm + '\uf8ff'),
            limit(5)
        );

        // Execute queries
        const [nameSnapshot, whatsappSnapshot, contactSnapshot] = await Promise.all([
            getDocs(nameQuery),
            getDocs(whatsappQuery),
            getDocs(contactQuery)
        ]);

        // Helper to add unique results
        const addUniqueResult = (doc) => {
            if (!addedIds.has(doc.id)) {
                results.push({ id: doc.id, ...doc.data() });
                addedIds.add(doc.id);
            }
        };

        // Process results
        nameSnapshot.forEach(addUniqueResult);
        whatsappSnapshot.forEach(addUniqueResult);
        contactSnapshot.forEach(addUniqueResult);

        // --- Display results in the search modal ---
        quickPaymentSearchResultsContainer.innerHTML = ''; // Clear previous results/loading
        if (results.length === 0) {
            quickPaymentSearchResultsContainer.innerHTML = '<div class="suggestion-item no-suggestions">कोई ग्राहक नहीं मिला।</div>';
        } else {
            results.slice(0, 10).forEach(customer => { // Show max 10 results
                const div = document.createElement('div');
                div.classList.add('suggestion-item');
                div.style.cursor = 'pointer'; // Make it clickable
                div.innerHTML = `
                    <i class="fas fa-user" style="margin-right: 8px; color: #555;"></i>
                    <strong>${customer.fullName || 'N/A'}</strong>
                    <span style="font-size: 0.9em; color: #777; margin-left: 10px;">(${customer.whatsappNo || customer.contactNo || 'No Contact'})</span>
                `;
                // --- Event listener for selecting a customer ---
                div.addEventListener('click', () => {
                    console.log(`ग्राहक चुना: ${customer.fullName} (ID: ${customer.id})`);
                    closeQuickSearchModal(); // Close the search modal
                    // Open the payment entry modal with balance calculation
                    openQuickPaymentModal(customer.id, customer.fullName);
                });
                quickPaymentSearchResultsContainer.appendChild(div);
            });
        }

    } catch (error) {
        console.error("क्विक पेमेंट ग्राहक खोज में त्रुटि:", error);
        quickPaymentSearchResultsContainer.innerHTML = '<div class="suggestion-item no-suggestions">खोजने में त्रुटि हुई।</div>';
    }
}


// --- Balance Calculation Functions (Needed for Quick Payment & KPIs) ---
async function getCustomerTotalOrderValue(customerId) {
    let total = 0;
    if (!collection || !query || !where || !getDocs) return 0;
    try {
        const q = query(collection(db, "orders"), where("customerId", "==", customerId));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            total += Number(doc.data().totalAmount || 0);
        });
        return total;
    } catch (error) { console.error("Error fetching order total:", error); return 0; }
}

async function getCustomerTotalPaymentAmount(customerId) {
    let total = 0;
    if (!collection || !query || !where || !getDocs) return 0;
    try {
        const q = query(collection(db, "payments"), where("customerId", "==", customerId));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            total += Number(doc.data().amountPaid || 0);
        });
        return total;
    } catch (error) { console.error("Error fetching payment total:", error); return 0; }
}

async function getCustomerAdjustmentTotals(customerId) {
    let totalDebit = 0; let totalCredit = 0;
    if (!collection || !query || !where || !getDocs) return { totalDebit: 0, totalCredit: 0 };
    try {
        const q = query(collection(db, "accountAdjustments"), where("customerId", "==", customerId));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            const adj = doc.data(); const amount = Number(adj.amount || 0);
            if (adj.adjustmentType === 'debit') { totalDebit += amount; }
            else if (adj.adjustmentType === 'credit') { totalCredit += amount; }
        });
        return { totalDebit, totalCredit };
    } catch (error) { console.error("Error fetching adjustment totals:", error); return { totalDebit: 0, totalCredit: 0 }; }
}

async function calculateCustomerBalance(customerId) {
    try {
        const [orderTotal, paymentTotal, adjustmentTotals] = await Promise.all([
            getCustomerTotalOrderValue(customerId),
            getCustomerTotalPaymentAmount(customerId),
            getCustomerAdjustmentTotals(customerId)
        ]);

        const totalDebits = orderTotal + adjustmentTotals.totalDebit;
        const totalCredits = paymentTotal + adjustmentTotals.totalCredit;
        const finalBalance = totalDebits - totalCredits;

        let balanceText = formatCurrency(0);
        let balanceClass = 'balance-info';

        if (finalBalance > 0.005) {
            balanceText = formatCurrency(finalBalance) + " Dr.";
            balanceClass = 'balance-due';
        } else if (finalBalance < -0.005) {
             balanceText = formatCurrency(Math.abs(finalBalance)) + " Cr.";
            balanceClass = 'balance-credit';
        }
        return { balanceText, balanceClass };
    } catch (error) {
        console.error("Error calculating balance:", error);
        return { balanceText: "Error", balanceClass: 'balance-due' };
    }
}


// --- Function to open the Quick Payment **Entry** modal (Called after customer selection) ---
async function openQuickPaymentModal(customerId, customerName) { // Make async
    // Ensure modal elements are available
    if(!addPaymentModal || !customerId || !customerName || !paymentModalCustNameSpan || !quickPaymentCustomerIdInput || !paymentDateInput || !savePaymentBtn || !addPaymentForm || !paymentModalCustBalance){
        console.error("पेमेंट एंट्री modal नहीं खोल सकते। आवश्यक एलिमेंट या customerId/name गायब है।");
        alert("पेमेंट फ़ॉर्म खोलने में त्रुटि। कृपया कंसोल जांचें।");
        return;
    }
    console.log(`पेमेंट एंट्री modal खोल रहे हैं ${customerName} (ID: ${customerId}) के लिए`);

    // --- Reset Modal ---
    addPaymentForm.reset();
    paymentModalCustNameSpan.textContent = customerName;
    paymentDateInput.valueAsDate = new Date();
    quickPaymentCustomerIdInput.value = customerId; // Store the customer ID
    quickPaymentTargetCustomerId = customerId; // Store in global variable too
    savePaymentBtn.disabled = false;
    savePaymentBtn.innerHTML = '<i class="fas fa-save"></i> पेमेंट सेव करें';
    paymentModalCustBalance.textContent = "गणना हो रही है..."; // Show loading state for balance
    paymentModalCustBalance.className = ''; // Reset balance color class

    addPaymentModal.classList.add('active'); // Show the modal *before* fetching balance

    // --- Fetch and Display Balance ---
    const { balanceText, balanceClass } = await calculateCustomerBalance(customerId);
    // Check if the modal is still open before updating (user might close it quickly)
    if (addPaymentModal.classList.contains('active')) {
        paymentModalCustBalance.textContent = balanceText;
        paymentModalCustBalance.className = balanceClass; // Apply color class
        console.log(`बैलेंस दिखाया गया: ${balanceText}`);
    } else {
        console.log("पेमेंट एंट्री modal बैलेंस दिखाने से पहले बंद कर दिया गया था।");
    }
}

// --- Function to close the Quick Payment **Entry** modal ---
function closeAddPaymentModal() {
    if (addPaymentModal) {
         addPaymentModal.classList.remove('active');
    }
     quickPaymentTargetCustomerId = null; // Clear stored ID when closing
}

// --- Function to save the Quick Payment (No changes needed from previous version) ---
async function handleSavePayment(event) {
    event.preventDefault();
    if (!db || !addDoc || !collection || !Timestamp) {
        alert("Database functions are not available. Cannot save payment.");
        console.error("Firestore functions (db, addDoc, collection, Timestamp) missing.");
        return;
    }
    const customerId = quickPaymentTargetCustomerId || quickPaymentCustomerIdInput.value; // Get ID
    if (!customerId) {
         alert("Customer ID missing. Cannot save payment.");
         console.error("Customer ID not found for saving payment.");
         return;
     }
    const amount = paymentAmountInput ? parseFloat(paymentAmountInput.value) : NaN;
    const date = paymentDateInput ? paymentDateInput.value : null;
    const method = paymentMethodSelect ? paymentMethodSelect.value : 'Other';
    const notes = paymentNotesInput ? paymentNotesInput.value.trim() : '';
    if (isNaN(amount) || amount <= 0) { alert("Please enter a valid positive amount."); return; }
    if (!date) { alert("Please select a payment date."); return; }
    if (!savePaymentBtn) { console.error("Save button not found."); return; }

    savePaymentBtn.disabled = true;
    const originalHTML = savePaymentBtn.innerHTML;
    savePaymentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const paymentDateTimestamp = Timestamp.fromDate(new Date(date + 'T00:00:00'));
        const paymentData = {
            customerId: customerId,
            amountPaid: amount,
            paymentDate: paymentDateTimestamp,
            paymentMethod: method,
            notes: notes || null,
            createdAt: Timestamp.now()
        };
        const docRef = await addDoc(collection(db, "payments"), paymentData);
        console.log("क्विक पेमेंट सफलतापूर्वक जोड़ा गया:", docRef.id, "ग्राहक के लिए:", customerId);
        alert("पेमेंट सफलतापूर्वक जोड़ा गया!");
        closeAddPaymentModal(); // Close modal on success
        loadDashboardKPIs(); // Refresh KPIs
    } catch (error) {
        console.error("क्विक पेमेंट सेव करने में त्रुटि:", error);
        alert(`पेमेंट सेव करने में त्रुटि: ${error.message}`);
    } finally {
        // Ensure button is re-enabled only if the modal is still meant to be open
        if (addPaymentModal && addPaymentModal.classList.contains('active') && savePaymentBtn) {
            savePaymentBtn.disabled = false;
            savePaymentBtn.innerHTML = originalHTML;
        }
        quickPaymentTargetCustomerId = null; // Clear stored ID after attempt
    }
}
// ==============================================================
// <<< END OF Quick Payment Functions >>>
// ==============================================================

console.log("dashboard.js (Dedicated Quick Search Modal) script loaded.");