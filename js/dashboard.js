// js/dashboard.js (Revised Import & Structure)

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
const kpiTotalCustomers = document.getElementById('kpi-total-customers');
const kpiTotalSuppliers = document.getElementById('kpi-total-suppliers');
const kpiPendingPayments = document.getElementById('kpi-pending-payments');
const kpiOrdersToday = document.getElementById('kpi-orders-today');
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
    // Check if auth is immediately available (it should be if init.js is loaded correctly)
    if (!auth) {
        console.error("Firebase Auth instance not found! Check firebase-init.js loading.");
        alert("Critical Error: Authentication system failed to load.");
        // Potentially disable UI elements here
        return;
    }
    setupEventListeners();
    // Start listening for auth changes, data loading will be triggered inside
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
    // Add listeners for other buttons like Quick Payment if implemented
    // const quickPaymentBtn = document.getElementById('quickAddPaymentBtn');
    // if (quickPaymentBtn) quickPaymentBtn.addEventListener('click', handleQuickPayment);
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
    dateTimeIntervalId = setInterval(updateDateTime, 10000); // Update every 10 seconds
}

// --- Authentication Handling ---
function listenForAuthChanges() {
    onAuthStateChanged(auth, (user) => { // 'auth' is imported
        if (user) {
            console.log("[DEBUG] User authenticated via onAuthStateChanged.");
            startDateTimeUpdate(); // Start date/time update when user is logged in
            // Fetch and display user role
            user.getIdTokenResult(true).then((idTokenResult) => {
                userRole = idTokenResult.claims.role || 'Standard';
                if (welcomeUserSpan) {
                    welcomeUserSpan.textContent = `Welcome ${user.email || 'User'} (${userRole})`;
                }
            }).catch(error => {
                console.error('Error getting user role:', error);
                if (welcomeUserSpan) welcomeUserSpan.textContent = `Welcome ${user.email || 'User'} (Role Error)`;
            });
            // Load dashboard data now that user is confirmed
            initializeDashboardDataFetching();
        } else {
            console.log("[DEBUG] User not authenticated. Redirecting...");
            // Redirect to login page if not already there
            if (!window.location.pathname.endsWith('login.html')) {
                 window.location.replace('login.html'); // Use replace to prevent back button issues
            }
            if (welcomeUserSpan) welcomeUserSpan.textContent = 'Not Logged In';
            if (dateTimeIntervalId) clearInterval(dateTimeIntervalId); // Stop date/time update
            if (dateTimeSpan) dateTimeSpan.textContent = ''; // Clear date/time display
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
        signOut(auth).then(() => { // 'signOut' is imported
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
            countElements[status].textContent = count.toString().padStart(2, '0');
            if (status !== "Completed" && status !== "Delivered") { // Define which statuses are active
                 totalActiveOrders += count;
            }
        }
    }
    console.log(`[DEBUG] Dashboard Counts Updated. Total Active: ${totalActiveOrders}`);
    initializeOrUpdateChart(statusCounts); // Update chart with new counts
}

function listenForOrderCounts() {
    Object.values(countElements).forEach(el => showLoading(el));
    try {
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef); // Consider adding filters if needed for performance
        onSnapshot(q, (snapshot) => {
            const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateDashboardCounts(orders);
        }, (error) => { console.error("[DEBUG] Error listening to order counts:", error); Object.values(countElements).forEach(el => { if(el) el.textContent = 'Err'; }); });
    } catch (e) {
        console.error("Error setting up counts listener:", e);
        Object.values(countElements).forEach(el => { if(el) el.textContent = 'Err'; });
    }
}

// --- Load KPIs ---
async function loadDashboardKPIs() {
    showLoading(kpiTotalCustomers); showLoading(kpiTotalSuppliers); showLoading(kpiOrdersToday); showLoading(kpiPendingPayments);

    // Customers Count
    try { const custSnapshot = await getDocs(collection(db, "customers")); if(kpiTotalCustomers) kpiTotalCustomers.textContent = custSnapshot.size; }
    catch (e) { console.error("KPI Error (Cust):", e); if(kpiTotalCustomers) kpiTotalCustomers.textContent = 'Err'; }

    // Suppliers Count
    try { const suppSnapshot = await getDocs(collection(db, "suppliers")); if(kpiTotalSuppliers) kpiTotalSuppliers.textContent = suppSnapshot.size; }
    catch (e) { console.error("KPI Error (Supp):", e); if(kpiTotalSuppliers) kpiTotalSuppliers.textContent = 'Err'; }

    // Orders Today Count
    try {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
        const q = query(collection(db, "orders"), where('createdAt', '>=', Timestamp.fromDate(todayStart)), where('createdAt', '<=', Timestamp.fromDate(todayEnd)));
        const todaySnapshot = await getDocs(q);
        if(kpiOrdersToday) kpiOrdersToday.textContent = todaySnapshot.size;
    } catch (e) { console.error("KPI Error (Orders Today):", e); if(kpiOrdersToday) kpiOrdersToday.textContent = 'Err'; }

    // Pending Payments (Placeholder - Needs Implementation)
    console.warn("Pending Payments KPI needs proper calculation logic based on orders and payments.");
    setTimeout(() => { if(kpiPendingPayments) kpiPendingPayments.textContent = '₹ ...'; }, 1500);
}

// --- Load Recent Activity ---
async function loadRecentActivity() {
    if (!recentActivityList) return;
    showLoading(recentActivityList, 'list');
    try {
        const q = query(collection(db, "orders"), orderBy('updatedAt', 'desc'), limit(5));
        const snapshot = await getDocs(q);
        recentActivityList.innerHTML = ''; // Clear loading/previous
        if (snapshot.empty) { recentActivityList.innerHTML = '<li>No recent activity.</li>'; }
        else {
            snapshot.forEach(doc => {
                const order = doc.data();
                const li = document.createElement('li');
                const orderId = order.orderId || `Sys:${doc.id.substring(0,6)}`;
                const custName = order.customerDetails?.fullName || 'Unknown';
                const status = order.status || 'N/A';
                const time = order.updatedAt?.toDate ? formatTimeAgo(order.updatedAt.toDate()) : 'recent';
                li.innerHTML = `<span>Order <strong>${orderId}</strong> (${custName}) status: ${status}</span><span class="activity-time">${time}</span>`;
                li.style.cursor = 'pointer';
                li.onclick = () => { window.location.href = `order_history.html?openModalForId=${doc.id}`; };
                recentActivityList.appendChild(li);
            });
        }
    } catch (e) { console.error("Error fetching recent activity:", e); if(recentActivityList) recentActivityList.innerHTML = '<li>Error loading activity.</li>'; }
}

// --- Load Reminders & Tasks ---
async function loadRemindersAndTasks() {
    // Load LIC Reminders
    if (licReminderList) {
        showLoading(licReminderList, 'list');
        console.warn("LIC Reminder section needs Firestore query implementation in dashboard.js.");
        // **** Placeholder Logic ****
        // Query 'licCustomers' collection for upcoming due dates
        setTimeout(() => { licReminderList.innerHTML = '<li>(LIC Reminder Data Not Implemented)</li>'; }, 1000);
    }

    // Load Upcoming Tasks
    if (upcomingTaskList) {
         showLoading(upcomingTaskList, 'list');
         console.warn("Upcoming Tasks section needs Firestore query implementation in dashboard.js.");
         // **** Placeholder Logic ****
         // Query 'tasks' collection for pending tasks due soon
         setTimeout(() => { upcomingTaskList.innerHTML = '<li>(Task Data Not Implemented)</li>'; }, 1100);
    }

    // Load Upcoming Deliveries
    if (upcomingDeliveryList) {
        showLoading(upcomingDeliveryList, 'list');
        try {
            const threeDaysLater = new Date(); threeDaysLater.setDate(threeDaysLater.getDate() + 3); threeDaysLater.setHours(23, 59, 59, 999);
            const todayStart = new Date(); todayStart.setHours(0,0,0,0);
            const qDel = query(collection(db, "orders"), where('deliveryDate', '>=', Timestamp.fromDate(todayStart)), where('deliveryDate', '<=', Timestamp.fromDate(threeDaysLater)), orderBy('deliveryDate', 'asc'), limit(5));
            const delSnapshot = await getDocs(qDel);
            upcomingDeliveryList.innerHTML = '';
            if(delSnapshot.empty) { upcomingDeliveryList.innerHTML = '<li>No deliveries due soon.</li>'; }
            else {
                 delSnapshot.forEach(doc => {
                      const order = doc.data(); const li = document.createElement('li');
                      li.innerHTML = `Order <strong>${order.orderId || 'N/A'}</strong> (${order.customerDetails?.fullName || '?'}) - Due: ${order.deliveryDate.toDate().toLocaleDateString('en-GB')}`;
                      li.style.cursor = 'pointer';
                      li.onclick = () => { window.location.href = `order_history.html?openModalForId=${doc.id}`; };
                      upcomingDeliveryList.appendChild(li);
                 });
            }
        } catch (e) { console.error("Error fetching upcoming deliveries:", e); if(upcomingDeliveryList) upcomingDeliveryList.innerHTML = '<li>Error loading deliveries.</li>'; }
    }
}

// --- Order Search Functions ---
function handleSearchInput() { clearTimeout(suggestionDebounceTimer); const searchTerm = orderIdSearchInput.value.trim(); if (searchTerm.length > 0) { suggestionDebounceTimer = setTimeout(() => fetchAndDisplaySuggestions(searchTerm), 300); } else { clearSuggestions(); } }
function triggerSearch() { const searchTerm = orderIdSearchInput.value.trim(); fetchAndDisplaySuggestions(searchTerm); }
function clearSuggestions() { if (suggestionsContainer) { suggestionsContainer.innerHTML = ''; suggestionsContainer.style.display = 'none'; } }
async function fetchAndDisplaySuggestions(searchTerm) {
    if (!suggestionsContainer) return;
    if (!searchTerm) { clearSuggestions(); return; }
    try {
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef, where('orderId', '>=', searchTerm), where('orderId', '<=', searchTerm + '\uf8ff'), limit(10));
        const querySnapshot = await getDocs(q);
        suggestionsContainer.innerHTML = '';
        if (querySnapshot.empty) { suggestionsContainer.innerHTML = '<div class="no-suggestions">No matching orders found.</div>'; }
        else {
            querySnapshot.forEach((doc) => {
                const order = { id: doc.id, ...doc.data() };
                const suggestionDiv = document.createElement('div');
                const displayName = `${order.orderId || 'N/A'} - ${order.customerDetails?.fullName || 'Unknown'}`;
                suggestionDiv.textContent = displayName;
                suggestionDiv.setAttribute('data-firestore-id', order.id);
                suggestionDiv.addEventListener('mousedown', (e) => { e.preventDefault(); window.location.href = `order_history.html?openModalForId=${order.id}`; clearSuggestions(); });
                suggestionsContainer.appendChild(suggestionDiv);
            });
        }
        suggestionsContainer.style.display = 'block';
    } catch (error) { console.error("Error fetching suggestions:", error); suggestionsContainer.innerHTML = '<div class="no-suggestions">Error fetching.</div>'; suggestionsContainer.style.display = 'block'; }
}

// --- Chart Functions ---
function initializeOrUpdateChart(statusCounts) {
    if (!orderStatusChartCanvas || !window.Chart) return; // Exit if no canvas or Chart.js
    const labels = Object.keys(statusCounts);
    const data = Object.values(statusCounts);
    const backgroundColors = labels.map(label => { /* ... पहले जैसा कलर लॉजिक ... */
        switch(label) {
            case "Order Received": return 'rgba(108, 117, 125, 0.7)'; case "Designing": return 'rgba(255, 193, 7, 0.7)'; case "Verification": return 'rgba(253, 126, 20, 0.7)'; case "Design Approved": return 'rgba(32, 201, 151, 0.7)'; case "Printing": return 'rgba(23, 162, 184, 0.7)'; case "Ready for Working": return 'rgba(111, 66, 193, 0.7)'; case "Delivered": return 'rgba(13, 202, 240, 0.7)'; case "Completed": return 'rgba(40, 167, 69, 0.7)'; default: return 'rgba(200, 200, 200, 0.7)';
        }
    });
    const borderColors = backgroundColors.map(color => color.replace('0.7', '1'));
    const chartData = { labels: labels, datasets: [{ label: 'Order Count', data: data, backgroundColor: backgroundColors, borderColor: borderColors, borderWidth: 1 }] };
    const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15, font: { size: 10 } } }, tooltip: { callbacks: { label: function(c){ return `${c.dataset.label||''}: ${c.parsed||0}`; }}}, title: { display: false } }, cutout: '50%' }; // Doughnut
    if (orderChartInstance) { orderChartInstance.destroy(); }
    try { orderChartInstance = new Chart(orderStatusChartCanvas, { type: 'doughnut', data: chartData, options: chartOptions }); console.log("[DEBUG] Chart initialized/updated."); }
    catch (e) { console.error("Error creating chart:", e); }
}

// --- Helper Function: Time Ago ---
function formatTimeAgo(date) {
  if (!(date instanceof Date)) return '';
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return Math.floor(seconds) + "s ago";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  if (days < 30) return days + "d ago";
   const months = Math.floor(days / 30);
  if (months < 12) return months + "mo ago";
  const years = Math.floor(days / 365);
  return years + "y ago";
}

console.log("dashboard.js (with firebase-init import) script loaded.");