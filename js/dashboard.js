// js/dashboard.js (Revised Import & Structure + Updates)

// Import initialized db and auth from firebase-init.js
import { db, auth } from './firebase-init.js';

// Import necessary functions directly from the SDK
import { collection, onSnapshot, query, where, getDocs, limit, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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
const orderIdSearchInput = document.getElementById('order-id-search');
const orderIdSearchButton = document.getElementById('order-id-search-button');
const suggestionsContainer = document.getElementById('order-suggestions');
const welcomeUserSpan = document.getElementById('welcome-user');
const dateTimeSpan = document.getElementById('currentDateTime');
const logoutLink = document.getElementById('logout-link');
// KPI Elements
const kpiTotalCustomers = document.getElementById('kpi-total-customers');
const kpiTotalSuppliers = document.getElementById('kpi-total-suppliers');
const kpiPendingPayments = document.getElementById('kpi-pending-payments');
const kpiOrdersToday = document.getElementById('kpi-orders-today');
const kpiPendingPOs = document.getElementById('kpi-pending-pos');
// Other List Elements
const recentActivityList = document.getElementById('recent-activity-list');
const licReminderList = document.getElementById('lic-reminder-list');
const upcomingTaskList = document.getElementById('upcoming-task-list');
const upcomingDeliveryList = document.getElementById('upcoming-delivery-list');
const orderStatusChartCanvas = document.getElementById('orderStatusChart');
let orderChartInstance = null;

// Global state
let suggestionDebounceTimer;
let dateTimeIntervalId = null;
let userRole = null;

// --- Initialization on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DEBUG] Dashboard DOM Loaded (Using firebase-init).");
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
    if (orderIdSearchInput) {
        orderIdSearchInput.addEventListener('input', handleSearchInput);
        orderIdSearchInput.addEventListener('blur', () => setTimeout(clearSuggestions, 150));
    }
    if (orderIdSearchButton) orderIdSearchButton.addEventListener('click', triggerSearch);
    if (logoutLink) logoutLink.addEventListener('click', handleLogout);
    console.log("[DEBUG] Dashboard event listeners set up.");
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
    dateTimeIntervalId = setInterval(updateDateTime, 10000);
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
            }).catch(error => {
                console.error('Error getting user role:', error);
                if (welcomeUserSpan) welcomeUserSpan.textContent = `Welcome ${user.email || 'User'} (Role Error)`;
            });
            initializeDashboardDataFetching();
        } else {
            console.log("[DEBUG] User not authenticated. Redirecting...");
            if (!window.location.pathname.endsWith('login.html')) {
                 window.location.replace('login.html');
            }
            if (welcomeUserSpan) welcomeUserSpan.textContent = 'Not Logged In';
            if (dateTimeIntervalId) clearInterval(dateTimeIntervalId);
            if (dateTimeSpan) dateTimeSpan.textContent = '';
        }
    });
}

// Function to initialize all data fetching
function initializeDashboardDataFetching() {
    console.log("[DEBUG] Initializing data fetching...");
    listenForOrderCounts();
    loadDashboardKPIs();
    loadRecentActivity();
    loadRemindersAndTasks();
}

// --- Logout Handler ---
function handleLogout(e) {
    e.preventDefault();
    if (confirm("Are you sure you want to logout?")) {
        signOut(auth).then(() => {
            console.log('User signed out.');
            window.location.href = 'login.html';
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

// --- Dashboard Counts ---
function updateDashboardCounts(orders) {
    const statusCounts = { "Order Received": 0, "Designing": 0, "Verification": 0, "Design Approved": 0, "Ready for Working": 0, "Printing": 0, "Delivered": 0, "Completed": 0 };
    orders.forEach(order => { const status = order.status; if (status && statusCounts.hasOwnProperty(status)) { statusCounts[status]++; } });
    let totalActiveOrders = 0;
    for (const status in countElements) {
        if (countElements[status]) {
            const count = statusCounts[status] || 0;
            const panelItem = countElements[status].closest('.panel-item');
            if(panelItem) {
                 panelItem.className = panelItem.className.replace(/\b\S+-status\b/g, '').trim();
                 panelItem.className = panelItem.className.replace(/\blight-\w+\b/g, '').trim(); // Remove old light- classes
                 const statusClass = status.toLowerCase().replace(/\s+/g, '-') + '-status';
                 panelItem.classList.add(statusClass);
                 // Add specific classes based on status for coloring
                 switch (status) {
                    case "Order Received": panelItem.classList.add('order-received-status'); break;
                    case "Designing": panelItem.classList.add('designing-status'); break;
                    case "Verification": panelItem.classList.add('verification-status'); break;
                    case "Design Approved": /* Add specific class if needed */ break;
                    case "Printing": panelItem.classList.add('printing-status'); break;
                    case "Ready for Working": panelItem.classList.add('ready-for-working-status'); break;
                    case "Delivered": panelItem.classList.add('delivered-status'); break;
                    case "Completed": panelItem.classList.add('completed-status'); break;
                    default: panelItem.classList.add('light-red'); // Fallback color example
                 }
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
        }, (error) => { console.error("[DEBUG] Error listening to order counts:", error); Object.values(countElements).forEach(el => { if(el) el.textContent = 'Err'; }); });
    } catch (e) {
        console.error("Error setting up counts listener:", e);
        Object.values(countElements).forEach(el => { if(el) el.textContent = 'Err'; });
    }
}

// --- Load KPIs (Updated with Debugging) ---
async function loadDashboardKPIs() {
    // KPIs के लिए लोडिंग दिखाएं
    showLoading(kpiTotalCustomers); showLoading(kpiTotalSuppliers); showLoading(kpiOrdersToday);
    showLoading(kpiPendingPayments); showLoading(kpiPendingPOs);

    // ग्राहक गणना
    try {
        const custSnapshot = await getDocs(collection(db, "customers"));
        if (kpiTotalCustomers) kpiTotalCustomers.textContent = custSnapshot.size;
    } catch (e) { console.error("KPI Error (Cust):", e); if(kpiTotalCustomers) kpiTotalCustomers.textContent = 'Err'; }

    // सप्लायर गणना
    try {
        const suppSnapshot = await getDocs(collection(db, "suppliers"));
        if (kpiTotalSuppliers) kpiTotalSuppliers.textContent = suppSnapshot.size;
    } catch (e) { console.error("KPI Error (Supp):", e); if(kpiTotalSuppliers) kpiTotalSuppliers.textContent = 'Err'; }

    // --- आज के ऑर्डर गणना (डीबगिंग के साथ) ---
    try {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
        // डीबगिंग के लिए तारीखें लॉग करें
        console.log("[DEBUG] Orders Today Query - Start Date (Local):", todayStart);
        console.log("[DEBUG] Orders Today Query - End Date (Local):", todayEnd);
        console.log("[DEBUG] Orders Today Query - Start Date (Timestamp):", Timestamp.fromDate(todayStart));
        console.log("[DEBUG] Orders Today Query - End Date (Timestamp):", Timestamp.fromDate(todayEnd));

        // <<<--- सुनिश्चित करें कि 'createdAt' फ़ील्ड मौजूद है और एक Timestamp है --->>>
        const q = query(collection(db, "orders"),
                        where('createdAt', '>=', Timestamp.fromDate(todayStart)),
                        where('createdAt', '<=', Timestamp.fromDate(todayEnd))
                      );
        const todaySnapshot = await getDocs(q);

        // क्वेरी परिणाम लॉग करें
        console.log(`[DEBUG] Orders Today Query - Found ${todaySnapshot.size} orders.`);

        if(kpiOrdersToday) {
            kpiOrdersToday.textContent = todaySnapshot.size;
        } else {
            console.warn("kpiOrdersToday element not found");
        }
    } catch (e) {
        console.error("KPI Error (Orders Today):", e);
        if(kpiOrdersToday) kpiOrdersToday.textContent = 'Err';
    }

    // पेंडिंग पेमेंट्स गणना
    try {
        const ordersQuery = query(collection(db, "orders"), where('status', '!=', 'Completed'));
        const ordersSnapshot = await getDocs(ordersQuery);
        let totalPendingAmount = 0;
        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            const totalAmount = Number(order.totalAmount) || 0;
            const amountPaid = Number(order.amountPaid) || 0;
            const balanceDue = totalAmount - amountPaid;
            if (balanceDue > 0) { totalPendingAmount += balanceDue; }
        });
        if (kpiPendingPayments) { kpiPendingPayments.textContent = `₹ ${totalPendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
        console.log(`[DEBUG] Total Pending Payments Calculated: ₹ ${totalPendingAmount}`);
    } catch (e) { console.error("KPI Error (Pending Payments):", e); if(kpiPendingPayments) kpiPendingPayments.textContent = '₹ Err'; }

    // --- पेंडिंग POs गणना (डीबगिंग के साथ) ---
    try {
        // <<<--- कृपया अपने PO Collection का सही नाम और Status फ़ील्ड/वैल्यू की पुष्टि करें --->>>
        const poCollectionName = "purchaseOrders"; // <<-- क्या यह सही है? पुष्टि करें
        const poStatusField = "status";          // <<-- क्या यह सही है? पुष्टि करें
        const poPendingValue = "Pending";        // <<-- क्या यह सही है? पुष्टि करें

        console.log(`[DEBUG] Pending POs Query - Collection: ${poCollectionName}, Field: ${poStatusField}, Value: ${poPendingValue}`);

        const poQuery = query(collection(db, poCollectionName), where(poStatusField, '==', poPendingValue));
        const poSnapshot = await getDocs(poQuery);

        const pendingPoCount = poSnapshot.size;
        console.log(`[DEBUG] Pending POs Query - Found ${pendingPoCount} pending POs.`);

        if (kpiPendingPOs) {
            kpiPendingPOs.textContent = pendingPoCount;
        } else {
            console.warn("kpiPendingPOs element not found");
        }
    } catch (e) {
        console.error("KPI Error (Pending POs):", e);
        if(kpiPendingPOs) kpiPendingPOs.textContent = `Err (${e.code || ''})`;
        console.error("Firestore Error Details:", e);
    }
}

// --- Load Recent Activity ---
async function loadRecentActivity() {
    // (पहले जैसा)
    if (!recentActivityList) return;
    showLoading(recentActivityList, 'list');
    try {
        const q = query(collection(db, "orders"), orderBy('updatedAt', 'desc'), limit(5));
        const snapshot = await getDocs(q);
        recentActivityList.innerHTML = '';
        if (snapshot.empty) { recentActivityList.innerHTML = '<li>No recent activity.</li>'; }
        else { /* ... (पहले जैसा) ... */ }
    } catch (e) { console.error("Error fetching recent activity:", e); if(recentActivityList) recentActivityList.innerHTML = '<li>Error loading activity.</li>'; }
}

// --- Load Reminders & Tasks ---
async function loadRemindersAndTasks() {
    // (पहले जैसा)
     if (licReminderList) { /* ... (पहले जैसा) ... */ }
     if (upcomingTaskList) { /* ... (पहले जैसा) ... */ }
     if (upcomingDeliveryList) { /* ... (पहले जैसा) ... */ }
}

// --- Order/Customer/LIC Search Functions ---
function handleSearchInput() { clearTimeout(suggestionDebounceTimer); const searchTerm = orderIdSearchInput.value.trim(); if (searchTerm.length > 0) { suggestionDebounceTimer = setTimeout(() => fetchAndDisplaySuggestions(searchTerm), 300); } else { clearSuggestions(); } }
function triggerSearch() { const searchTerm = orderIdSearchInput.value.trim(); fetchAndDisplaySuggestions(searchTerm); }
function clearSuggestions() { if (suggestionsContainer) { suggestionsContainer.innerHTML = ''; suggestionsContainer.style.display = 'none'; } }

async function fetchAndDisplaySuggestions(searchTerm) {
    // (पहले जैसा)
    if (!suggestionsContainer) return;
    if (!searchTerm) { clearSuggestions(); return; }
    suggestionsContainer.innerHTML = '<div class="loading-placeholder">Searching...</div>';
    suggestionsContainer.style.display = 'block';
    try {
        // ... (सभी क्वेरीज़ और लॉजिक पहले जैसा) ...
        const ordersRef = collection(db, "orders");
        const licCustomersRef = collection(db, "licCustomers");
        const searchLower = searchTerm.toLowerCase();
        const orderByIdQuery = query(ordersRef, where('orderId', '>=', searchTerm), where('orderId', '<=', searchTerm + '\uf8ff'), limit(5) );
        const orderByCustomerNameQuery = query(ordersRef, limit(20));
        const licByNameQuery = query(licCustomersRef, where('customerNameLower', '>=', searchLower), where('customerNameLower', '<=', searchLower + '\uf8ff'), limit(5) );
        const licByPolicyNoQuery = query(licCustomersRef, where('policyNumber', '>=', searchTerm), where('policyNumber', '<=', searchTerm + '\uf8ff'), limit(5) );

        const [ orderByIdSnapshot, orderByCustomerNameSnapshot, licByNameSnapshot, licByPolicyNoSnapshot ] = await Promise.all([ getDocs(orderByIdQuery), getDocs(orderByCustomerNameQuery), getDocs(licByNameQuery), getDocs(licByPolicyNoQuery) ]);
        let suggestions = [];
        orderByIdSnapshot.forEach((doc) => { /* ... */ });
        orderByCustomerNameSnapshot.forEach((doc) => { /* ... */ });
        licByNameSnapshot.forEach((doc) => { /* ... */ });
        licByPolicyNoSnapshot.forEach((doc) => { /* ... */ });
        suggestions = suggestions.slice(0, 10);
        suggestionsContainer.innerHTML = '';
        if (suggestions.length === 0) { /* ... */ } else { suggestions.forEach((item) => { /* ... (destinationUrl आदि सेट करें) ... */ }); }
        suggestionsContainer.style.display = 'block';
    } catch (error) {
        console.error("सुझाव लाने में त्रुटि:", error);
        suggestionsContainer.innerHTML = '<div class="no-suggestions">त्रुटि हुई।</div>';
        suggestionsContainer.style.display = 'block';
    }
}

// --- Chart Functions ---
function initializeOrUpdateChart(statusCounts) {
    // (पहले जैसा)
     if (!orderStatusChartCanvas || typeof Chart === 'undefined') return;
     // ... (Chart.js लॉजिक पहले जैसा) ...
}

// --- Helper Function: Time Ago ---
function formatTimeAgo(date) {
    // (पहले जैसा)
    if (!(date instanceof Date)) return ''; /* ... */ return years + "y ago";
}

console.log("dashboard.js (with firebase-init import and latest updates) script loaded.");