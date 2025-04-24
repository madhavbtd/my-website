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
const kpiPendingPOs = document.getElementById('kpi-pending-pos'); // <<< नया KPI एलिमेंट
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
    loadDashboardKPIs(); // <<< यह अब पेंडिंग पेमेंट्स और POs भी लोड करेगा
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
            // स्टेटस पैनल में क्लास जोड़ें (जैसे 'designing-status')
            const panelItem = countElements[status].closest('.panel-item');
            if(panelItem) {
                 // पुरानी स्टेटस क्लास हटाएं
                 panelItem.className = panelItem.className.replace(/\b\S+-status\b/g, '').trim();
                 // नई स्टेटस क्लास जोड़ें (यदि स्थिति ज्ञात है)
                 const statusClass = status.toLowerCase().replace(/\s+/g, '-') + '-status';
                 panelItem.classList.add(statusClass);
                 // विशिष्ट रंग वर्गों को भी लागू करें (यदि परिभाषित है)
                 switch (status) {
                     case "Order Received": panelItem.classList.add('light-blue'); break; // उदाहरण
                     case "Designing": panelItem.classList.add('designing-status'); break; // पीला उदाहरण
                     case "Verification": panelItem.classList.add('light-orange'); break; // उदाहरण
                     case "Completed": panelItem.classList.add('light-green'); break; // उदाहरण
                     case "Delivered": panelItem.classList.add('light-green'); break; // उदाहरण
                     // अन्य स्टेटस के लिए क्लास जोड़ें...
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

// --- Load KPIs (Updated) ---
async function loadDashboardKPIs() {
    // KPIs के लिए लोडिंग दिखाएं
    showLoading(kpiTotalCustomers);
    showLoading(kpiTotalSuppliers);
    showLoading(kpiOrdersToday);
    showLoading(kpiPendingPayments);
    showLoading(kpiPendingPOs); // <<-- पेंडिंग POs के लिए

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

    // आज के ऑर्डर गणना
    try {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
        const q = query(collection(db, "orders"), where('createdAt', '>=', Timestamp.fromDate(todayStart)), where('createdAt', '<=', Timestamp.fromDate(todayEnd)));
        const todaySnapshot = await getDocs(q);
        if(kpiOrdersToday) kpiOrdersToday.textContent = todaySnapshot.size;
    } catch (e) { console.error("KPI Error (Orders Today):", e); if(kpiOrdersToday) kpiOrdersToday.textContent = 'Err'; }

    // --- पेंडिंग पेमेंट्स गणना ---
    try {
        const ordersQuery = query(collection(db, "orders"), where('status', '!=', 'Completed'));
        const ordersSnapshot = await getDocs(ordersQuery);
        let totalPendingAmount = 0;
        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            const totalAmount = Number(order.totalAmount) || 0;
            const amountPaid = Number(order.amountPaid) || 0; // <<-- सुनिश्चित करें यह फ़ील्ड मौजूद है
            const balanceDue = totalAmount - amountPaid;
            if (balanceDue > 0) { totalPendingAmount += balanceDue; }
        });
        if (kpiPendingPayments) { kpiPendingPayments.textContent = `₹ ${totalPendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
        console.log(`[DEBUG] Total Pending Payments Calculated: ₹ ${totalPendingAmount}`);
    } catch (e) { console.error("KPI Error (Pending Payments):", e); if(kpiPendingPayments) kpiPendingPayments.textContent = '₹ Err'; }

    // --- पेंडिंग POs गणना ---
    try {
        // <<-- अपने PO कलेक्शन का नाम और स्टेटस फ़ील्ड यहाँ एडजस्ट करें
        const poQuery = query(collection(db, "purchaseOrders"), where('status', '==', 'Pending'));
        const poSnapshot = await getDocs(poQuery);
        const pendingPoCount = poSnapshot.size;
        if (kpiPendingPOs) { kpiPendingPOs.textContent = pendingPoCount; }
        console.log(`[DEBUG] Pending POs Count: ${pendingPoCount}`);
    } catch (e) { console.error("KPI Error (Pending POs):", e); if(kpiPendingPOs) kpiPendingPOs.textContent = 'Err'; }
}

// --- Load Recent Activity ---
async function loadRecentActivity() {
    if (!recentActivityList) return;
    showLoading(recentActivityList, 'list');
    try {
        const q = query(collection(db, "orders"), orderBy('updatedAt', 'desc'), limit(5));
        const snapshot = await getDocs(q);
        recentActivityList.innerHTML = '';
        if (snapshot.empty) { recentActivityList.innerHTML = '<li>No recent activity.</li>'; }
        else {
            snapshot.forEach(doc => {
                const order = doc.data(); const li = document.createElement('li');
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
        setTimeout(() => { licReminderList.innerHTML = '<li>(LIC Reminder Data Not Implemented)</li>'; }, 1000);
    }

    // Load Upcoming Tasks
    if (upcomingTaskList) {
         showLoading(upcomingTaskList, 'list');
         console.warn("Upcoming Tasks section needs Firestore query implementation in dashboard.js.");
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

// --- Order/Customer/LIC Search Functions (Updated) ---
function handleSearchInput() { clearTimeout(suggestionDebounceTimer); const searchTerm = orderIdSearchInput.value.trim(); if (searchTerm.length > 0) { suggestionDebounceTimer = setTimeout(() => fetchAndDisplaySuggestions(searchTerm), 300); } else { clearSuggestions(); } }
function triggerSearch() { const searchTerm = orderIdSearchInput.value.trim(); fetchAndDisplaySuggestions(searchTerm); }
function clearSuggestions() { if (suggestionsContainer) { suggestionsContainer.innerHTML = ''; suggestionsContainer.style.display = 'none'; } }

async function fetchAndDisplaySuggestions(searchTerm) {
    if (!suggestionsContainer) return;
    if (!searchTerm) { clearSuggestions(); return; }

    suggestionsContainer.innerHTML = '<div class="loading-placeholder">Searching...</div>';
    suggestionsContainer.style.display = 'block';

    try {
        const ordersRef = collection(db, "orders");
        const licCustomersRef = collection(db, "licCustomers");
        const searchLower = searchTerm.toLowerCase();

        // ऑर्डर क्वेरीज़: Order ID या Customer Name द्वारा
        const orderByIdQuery = query(ordersRef,
            where('orderId', '>=', searchTerm),
            where('orderId', '<=', searchTerm + '\uf8ff'),
            limit(5)
        );
        // कस्टमर नाम के लिए क्लाइंट-साइड फ़िल्टरिंग (या लोअरकेस फ़ील्ड का उपयोग करें)
        const orderByCustomerNameQuery = query(ordersRef, limit(20));

        // LIC कस्टमर क्वेरीज़: Customer Name या Policy Number द्वारा
        // <<-- 'customerNameLower' का उपयोग करें या क्लाइंट-साइड फ़िल्टर करें
        const licByNameQuery = query(licCustomersRef,
            where('customerNameLower', '>=', searchLower),
            where('customerNameLower', '<=', searchLower + '\uf8ff'),
            limit(5)
        );
        const licByPolicyNoQuery = query(licCustomersRef,
             where('policyNumber', '>=', searchTerm),
             where('policyNumber', '<=', searchTerm + '\uf8ff'),
             limit(5)
         );

        // सभी क्वेरीज़ चलाएं
        const [
            orderByIdSnapshot,
            orderByCustomerNameSnapshot,
            licByNameSnapshot,
            licByPolicyNoSnapshot
        ] = await Promise.all([
            getDocs(orderByIdQuery),
            getDocs(orderByCustomerNameQuery),
            getDocs(licByNameQuery),
            getDocs(licByPolicyNoQuery)
        ]);

        let suggestions = [];

        // ऑर्डर रिजल्ट्स (ID द्वारा)
        orderByIdSnapshot.forEach((doc) => {
            const order = { id: doc.id, ...doc.data(), type: 'Order' };
            if (!suggestions.some(s => s.id === order.id && s.type === 'Order')) { suggestions.push(order); }
        });

        // ऑर्डर रिजल्ट्स (नाम द्वारा - क्लाइंट-साइड)
         orderByCustomerNameSnapshot.forEach((doc) => {
            const order = { id: doc.id, ...doc.data(), type: 'Order' };
            if (order.customerDetails?.fullName?.toLowerCase().includes(searchLower)) {
                 if (!suggestions.some(s => s.id === order.id && s.type === 'Order')) { suggestions.push(order); }
            }
         });

        // LIC रिजल्ट्स (नाम द्वारा)
        licByNameSnapshot.forEach((doc) => {
            const licCustomer = { id: doc.id, ...doc.data(), type: 'LIC' };
             if (!suggestions.some(s => s.id === licCustomer.id && s.type === 'LIC')) { suggestions.push(licCustomer); }
        });

         // LIC रिजल्ट्स (पॉलिसी न. द्वारा)
         licByPolicyNoSnapshot.forEach((doc) => {
             const licCustomer = { id: doc.id, ...doc.data(), type: 'LIC' };
             if (!suggestions.some(s => s.id === licCustomer.id && s.type === 'LIC')) { suggestions.push(licCustomer); }
         });

        // सुझावों को सीमित करें
        suggestions = suggestions.slice(0, 10);
        suggestionsContainer.innerHTML = ''; // Clear loading/previous

        if (suggestions.length === 0) {
            suggestionsContainer.innerHTML = '<div class="no-suggestions">कोई मिलान नहीं मिला।</div>';
        } else {
            suggestions.forEach((item) => {
                const suggestionDiv = document.createElement('div');
                let displayName = '';
                let destinationUrl = '#';

                if (item.type === 'Order') {
                    displayName = `Order: ${item.orderId || 'N/A'} (${item.customerDetails?.fullName || 'Unknown'}) - ${item.status || 'N/A'}`;
                    destinationUrl = `order_history.html?openModalForId=${item.id}`;
                } else if (item.type === 'LIC') {
                    displayName = `LIC: ${item.customerName || 'N/A'} (Policy: ${item.policyNumber || 'N/A'})`;
                    // <<< lic_management.js में इस हैश को हैंडल करने का लॉजिक जोड़ें
                    destinationUrl = `lic_management.html#clientDetail=${item.id}`;
                }

                suggestionDiv.textContent = displayName;
                suggestionDiv.setAttribute('data-firestore-id', item.id);
                suggestionDiv.setAttribute('data-type', item.type);

                suggestionDiv.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    window.location.href = destinationUrl;
                    clearSuggestions();
                });
                suggestionsContainer.appendChild(suggestionDiv);
            });
        }
        suggestionsContainer.style.display = 'block';

    } catch (error) {
        console.error("सुझाव लाने में त्रुटि:", error);
        suggestionsContainer.innerHTML = '<div class="no-suggestions">त्रुटि हुई।</div>';
        suggestionsContainer.style.display = 'block';
    }
}

// --- Chart Functions ---
function initializeOrUpdateChart(statusCounts) {
    if (!orderStatusChartCanvas || typeof Chart === 'undefined') return; // Chart.js लोड हुआ है या नहीं जांचें
    const labels = Object.keys(statusCounts);
    const data = Object.values(statusCounts);
    const backgroundColors = labels.map(label => {
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

console.log("dashboard.js (with firebase-init import and updates) script loaded.");