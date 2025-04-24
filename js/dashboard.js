// js/dashboard.js (v3 - Multi-Search, Reminders, Tasks, Quick Pay Setup)

// Import initialized db and auth from firebase-init.js
import { db, auth } from './firebase-init.js';

// Import necessary functions directly from the SDK
import { collection, onSnapshot, query, where, getDocs, limit, orderBy, Timestamp, doc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- DOM Elements ---
const countElements = { "Order Received": document.getElementById('count-order-received'), "Designing": document.getElementById('count-designing'), "Verification": document.getElementById('count-verification'), "Design Approved": document.getElementById('count-design-approved'), "Ready for Working": document.getElementById('count-ready-for-working'), "Printing": document.getElementById('count-printing'), "Delivered": document.getElementById('count-delivered'), "Completed": document.getElementById('count-completed') };
const dashboardSearchInput = document.getElementById('dashboardSearchInput'); // <<< Updated ID
const dashboardSearchButton = document.getElementById('dashboardSearchButton'); // <<< Updated ID
const suggestionsContainer = document.getElementById('dashboardSuggestions');   // <<< Updated ID
const welcomeUserSpan = document.getElementById('welcome-user');
const dateTimeSpan = document.getElementById('currentDateTime');
const logoutLink = document.getElementById('logout-link');
const kpiPendingPayments = document.getElementById('kpi-pending-payments');
const kpiOrdersToday = document.getElementById('kpi-orders-today');
const recentActivityList = document.getElementById('recent-activity-list');
const licReminderList = document.getElementById('lic-reminder-list');
const upcomingTaskList = document.getElementById('upcoming-task-list');
const upcomingDeliveryList = document.getElementById('upcoming-delivery-list');
const orderStatusChartCanvas = document.getElementById('orderStatusChart');
const customerDuesList = document.getElementById('customer-dues-list'); // <<< New Dues List

// Quick Payment Modal Elements
const quickPaymentModal = document.getElementById('quickPaymentModal');
const closeQuickPaymentModalBtn = document.getElementById('closeQuickPaymentModal');
const cancelQuickPaymentBtn = document.getElementById('cancelQuickPaymentBtn');
const quickPaymentForm = document.getElementById('quickPaymentForm');
const quickPaymentCustomerSearch = document.getElementById('quickPaymentCustomerSearch');
const quickPaymentCustomerId = document.getElementById('quickPaymentCustomerId');
const quickPaymentCustomerSuggestions = document.getElementById('quickPaymentCustomerSuggestions');
const quickPaymentSelectedCustomer = document.getElementById('quickPaymentSelectedCustomer');
const saveQuickPaymentBtn = document.getElementById('saveQuickPaymentBtn');
const quickPaymentError = document.getElementById('quickPaymentError');
const quickAddPaymentBtn = document.getElementById('quickAddPaymentBtn'); // The button in the header

// Global state
let suggestionDebounceTimer;
let customerSearchDebounceTimerQP; // Separate timer for quick payment search
let dateTimeIntervalId = null;
let userRole = null;
let allOrdersCache = []; // Cache for orders (used in search)
let allLicPoliciesCache = []; // Cache for LIC policies (used in search)
let allCustomersCacheQP = []; // Cache for customers (used in quick payment search)
let licPoliciesListenerUnsubscribe = null;
let orderCountsListenerUnsubscribe = null;
let customerListenerUnsubscribeQP = null;
let orderChartInstance = null;

// --- Initialization on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DEBUG] Dashboard DOM Loaded (v3).");
    if (!auth) { console.error("Auth instance not found!"); alert("Critical Error: Auth system failed."); return; }
    setupEventListeners();
    listenForAuthChanges();
});

// --- Setup Event Listeners ---
function setupEventListeners() {
    if (dashboardSearchInput) {
        dashboardSearchInput.addEventListener('input', handleDashboardSearchInput);
        dashboardSearchInput.addEventListener('blur', () => setTimeout(clearSuggestions, 150));
    }
    if (dashboardSearchButton) dashboardSearchButton.addEventListener('click', triggerDashboardSearch);
    if (logoutLink) logoutLink.addEventListener('click', handleLogout);
    if (quickAddPaymentBtn) quickAddPaymentBtn.addEventListener('click', openQuickPaymentModal);

    // Quick Payment Modal Listeners
    if (closeQuickPaymentModalBtn) closeQuickPaymentModalBtn.addEventListener('click', closeQuickPaymentModal);
    if (cancelQuickPaymentBtn) cancelQuickPaymentBtn.addEventListener('click', closeQuickPaymentModal);
    if (quickPaymentModal) quickPaymentModal.addEventListener('click', (e) => { if (e.target === quickPaymentModal) closeQuickPaymentModal(); });
    if (quickPaymentForm) quickPaymentForm.addEventListener('submit', handleSaveQuickPayment);
    if (quickPaymentCustomerSearch) quickPaymentCustomerSearch.addEventListener('input', handleQuickPaymentCustomerSearch);

    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (suggestionsContainer && suggestionsContainer.style.display === 'block' && !dashboardSearchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            clearSuggestions();
        }
        if (quickPaymentCustomerSuggestions && quickPaymentCustomerSuggestions.style.display === 'block' && !quickPaymentCustomerSearch.contains(e.target) && !quickPaymentCustomerSuggestions.contains(e.target)) {
            hideSuggestionBox(quickPaymentCustomerSuggestions);
        }
    });

    console.log("[DEBUG] Dashboard event listeners set up (v3).");
}

// --- Date/Time Update ---
function updateDateTime() { /* ... पहले जैसा ... */ if (!dateTimeSpan) return; const now = new Date(); const optsDate = { year: 'numeric', month: 'short', day: 'numeric' }; const optsTime = { hour: 'numeric', minute: '2-digit', hour12: true }; const optsDay = { weekday: 'long' }; try { const date = now.toLocaleDateString('en-IN', optsDate); const day = now.toLocaleDateString('en-IN', optsDay); const time = now.toLocaleTimeString('en-US', optsTime); dateTimeSpan.textContent = `${date} | ${day} | ${time}`; dateTimeSpan.classList.remove('loading-placeholder'); } catch (e) { console.error("Error formatting date/time:", e); dateTimeSpan.textContent = 'Error loading time'; dateTimeSpan.classList.remove('loading-placeholder'); } }
function startDateTimeUpdate() { /* ... पहले जैसा ... */ if (dateTimeIntervalId) clearInterval(dateTimeIntervalId); updateDateTime(); dateTimeIntervalId = setInterval(updateDateTime, 10000); }

// --- Authentication Handling ---
function listenForAuthChanges() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("[DEBUG] User authenticated.");
            startDateTimeUpdate();
            user.getIdTokenResult(true).then((idTokenResult) => { userRole = idTokenResult.claims.role || 'Standard'; if (welcomeUserSpan) welcomeUserSpan.textContent = `Welcome ${user.email || 'User'} (${userRole})`; }).catch(error => { console.error('Error getting user role:', error); if (welcomeUserSpan) welcomeUserSpan.textContent = `Welcome ${user.email || 'User'} (Role Error)`; });
            initializeDashboardDataFetching(); // Load data after auth confirmed
        } else {
            console.log("[DEBUG] User not authenticated. Redirecting...");
            if (dateTimeIntervalId) clearInterval(dateTimeIntervalId); if (dateTimeSpan) dateTimeSpan.textContent = ''; if (welcomeUserSpan) welcomeUserSpan.textContent = 'Not Logged In';
            if (!window.location.pathname.endsWith('login.html')) { window.location.replace('login.html'); }
        }
    });
}

// --- Logout Handler ---
function handleLogout(e) { /* ... पहले जैसा ... */ e.preventDefault(); if (confirm("Are you sure?")) { signOut(auth).then(() => { window.location.href = 'login.html'; }).catch((error) => { console.error('Sign out error:', error); alert("Logout failed."); }); } }

// --- Initialize Data Fetching ---
function initializeDashboardDataFetching() {
    console.log("[DEBUG] Initializing data fetching (v3)...");
    listenForOrderCounts();
    fetchAndCacheLicPolicies(); // Start caching LIC policies for search
    fetchAndCacheCustomersForQP(); // Start caching customers for quick payment
    loadDashboardKPIs();
    loadRecentActivity();
    loadRemindersAndTasks();
    loadCustomerDues();
}

// --- Loading Indicators ---
function showLoading(element, type = 'text') { /* ... पहले जैसा ... */ if (!element) return; if (type === 'spinner') { element.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 0.8em; color: #aaa;"></i>'; } else if (type === 'list') { element.innerHTML = '<li class="loading-placeholder" style="color:#aaa; font-style:italic;">Loading...</li>'; } else { element.innerHTML = '<span class="loading-placeholder" style="color:#aaa;">...</span>'; } }

// --- Dashboard Counts ---
function updateDashboardCounts(orders) { /* ... पहले जैसा, Chart अपडेट शामिल ... */ const statusCounts = { "Order Received": 0, "Designing": 0, "Verification": 0, "Design Approved": 0, "Ready for Working": 0, "Printing": 0, "Delivered": 0, "Completed": 0 }; orders.forEach(order => { const status = order.status; if (status && statusCounts.hasOwnProperty(status)) { statusCounts[status]++; } }); let totalActiveOrders = 0; for (const status in countElements) { if (countElements[status]) { const count = statusCounts[status] || 0; countElements[status].textContent = count.toString().padStart(2, '0'); if (status !== "Completed" && status !== "Delivered") { totalActiveOrders += count; } } } console.log(`[DEBUG] Dashboard Counts Updated. Total Active: ${totalActiveOrders}`); initializeOrUpdateChart(statusCounts); }
function listenForOrderCounts() { /* ... पहले जैसा ... */ Object.values(countElements).forEach(el => showLoading(el)); try { if (orderCountsListenerUnsubscribe) orderCountsListenerUnsubscribe(); const ordersRef = collection(db, "orders"); const q = query(ordersRef); orderCountsListenerUnsubscribe = onSnapshot(q, (snapshot) => { const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); allOrdersCache = orders; updateDashboardCounts(orders); }, (error) => { console.error("[DEBUG] Error listening to order counts:", error); Object.values(countElements).forEach(el => { if(el) el.textContent = 'Err'; }); }); } catch (e) { console.error("Error setting up counts listener:", e); Object.values(countElements).forEach(el => { if(el) el.textContent = 'Err'; }); } }

// --- Load KPIs ---
async function loadDashboardKPIs() { /* ... Total Customers/Suppliers हटाया गया ... */ showLoading(kpiOrdersToday); showLoading(kpiPendingPayments); try { const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0); const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999); const q = query(collection(db, "orders"), where('createdAt', '>=', Timestamp.fromDate(todayStart)), where('createdAt', '<=', Timestamp.fromDate(todayEnd))); const todaySnapshot = await getDocs(q); if(kpiOrdersToday) kpiOrdersToday.textContent = todaySnapshot.size; } catch (e) { console.error("KPI Error (Orders Today):", e); if(kpiOrdersToday) kpiOrdersToday.textContent = 'Err'; } console.warn("Pending Payments KPI needs proper calculation logic."); setTimeout(() => { if(kpiPendingPayments) kpiPendingPayments.textContent = '₹ ...'; }, 1500); }

// --- Load Recent Activity ---
async function loadRecentActivity() { /* ... पहले जैसा ... */ if (!recentActivityList) return; showLoading(recentActivityList, 'list'); try { const q = query(collection(db, "orders"), orderBy('updatedAt', 'desc'), limit(5)); const snapshot = await getDocs(q); recentActivityList.innerHTML = ''; if (snapshot.empty) { recentActivityList.innerHTML = '<li>No recent activity.</li>'; } else { snapshot.forEach(doc => { const order = doc.data(); const li = document.createElement('li'); const orderId = order.orderId || `Sys:${doc.id.substring(0,6)}`; const custName = order.customerDetails?.fullName || 'Unknown'; const status = order.status || 'N/A'; const time = order.updatedAt?.toDate ? formatTimeAgo(order.updatedAt.toDate()) : 'recent'; li.innerHTML = `<span>Order <strong>${orderId}</strong> (${custName}) status: ${status}</span><span class="activity-time">${time}</span>`; li.style.cursor = 'pointer'; li.onclick = () => { window.location.href = `order_history.html?openModalForId=${doc.id}`; }; recentActivityList.appendChild(li); }); } } catch (e) { console.error("Error fetching recent activity:", e); if(recentActivityList) recentActivityList.innerHTML = '<li>Error loading activity.</li>'; } }

// --- Load Reminders & Tasks (Actual Implementation) ---
async function loadRemindersAndTasks() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fifteenDaysLater = new Date(todayStart); fifteenDaysLater.setDate(todayStart.getDate() + 15);
    const sevenDaysLater = new Date(todayStart); sevenDaysLater.setDate(todayStart.getDate() + 7);
    const threeDaysLater = new Date(todayStart); threeDaysLater.setDate(todayStart.getDate() + 3); threeDaysLater.setHours(23, 59, 59, 999);


    // Load LIC Reminders
    if (licReminderList) {
        showLoading(licReminderList, 'list');
        try {
            const licQuery = query(collection(db, "licCustomers"),
                                 where('nextInstallmentDate', '>=', Timestamp.fromDate(todayStart)),
                                 where('nextInstallmentDate', '<=', Timestamp.fromDate(fifteenDaysLater)),
                                 where('policyStatus', 'in', ['Active', 'Lapsed']),
                                 orderBy('nextInstallmentDate', 'asc'),
                                 limit(5)); // Limit results
            const licSnapshot = await getDocs(licQuery);
            licReminderList.innerHTML = '';
            if(licSnapshot.empty){ licReminderList.innerHTML = '<li>No LIC premiums due soon.</li>'; }
            else {
                 licSnapshot.forEach(doc => {
                      const policy = doc.data(); const li = document.createElement('li');
                      li.innerHTML = `${policy.customerName || '?'} (${policy.policyNumber || '?'}) - Due: <strong>${policy.nextInstallmentDate.toDate().toLocaleDateString('en-GB')}</strong>`;
                      // Add link to lic_management.html?policyId=... or a detail modal
                      li.style.cursor = 'pointer';
                      li.title=`View Policy ${policy.policyNumber}`;
                      li.onclick = () => { window.location.href = `lic_management.html?policyId=${doc.id}`; }; // Example Link
                      licReminderList.appendChild(li);
                 });
            }
        } catch (e) { console.error("Error fetching LIC reminders:", e); if(licReminderList) licReminderList.innerHTML = '<li>Error loading LIC data.</li>'; }
    }

    // Load Upcoming Tasks
    if (upcomingTaskList) {
         showLoading(upcomingTaskList, 'list');
         try {
             const taskQuery = query(collection(db, "tasks"),
                                  where('completed', '==', false),
                                  where('dueDate', '>=', Timestamp.fromDate(todayStart)),
                                  where('dueDate', '<=', Timestamp.fromDate(sevenDaysLater)),
                                  orderBy('dueDate', 'asc'),
                                  limit(5)); // Limit results
            const taskSnapshot = await getDocs(taskQuery);
            upcomingTaskList.innerHTML = '';
            if(taskSnapshot.empty){ upcomingTaskList.innerHTML = '<li>No tasks due soon.</li>'; }
            else {
                 taskSnapshot.forEach(doc => {
                     const task = doc.data(); const li = document.createElement('li');
                     li.innerHTML = `${task.customerName ? task.customerName + ': ' : ''}${task.description} - Due: <strong>${task.dueDate.toDate().toLocaleDateString('en-GB')}</strong>`;
                      // Add link to open task edit modal (requires function from lic_management.js or similar)
                      li.style.cursor = 'pointer';
                      li.title = `View/Edit Task`;
                      // li.onclick = () => { /* Function to open task modal needs implementation */ };
                     upcomingTaskList.appendChild(li);
                 });
            }
         } catch (e) { console.error("Error fetching upcoming tasks:", e); if(upcomingTaskList) upcomingTaskList.innerHTML = '<li>Error loading tasks.</li>'; }
    }

     // Load Upcoming Deliveries
     if (upcomingDeliveryList) {
         showLoading(upcomingDeliveryList, 'list');
         try {
             const qDel = query(collection(db, "orders"),
                              where('deliveryDate', '>=', Timestamp.fromDate(todayStart)),
                              where('deliveryDate', '<=', Timestamp.fromDate(threeDaysLater)), // Use 3 days
                              orderBy('deliveryDate', 'asc'),
                              limit(5)); // Limit results
              const delSnapshot = await getDocs(qDel);
              upcomingDeliveryList.innerHTML = '';
              if(delSnapshot.empty) { upcomingDeliveryList.innerHTML = '<li>No deliveries due soon.</li>'; }
              else {
                   delSnapshot.forEach(doc => {
                        const order = doc.data(); const li = document.createElement('li');
                        li.innerHTML = `Order <strong>${order.orderId || 'N/A'}</strong> (${order.customerDetails?.fullName || '?'}) - Due: ${order.deliveryDate.toDate().toLocaleDateString('en-GB')}`;
                        li.style.cursor = 'pointer';
                        li.title = `View Order ${order.orderId || '?'}`;
                        li.onclick = () => { window.location.href = `order_history.html?openModalForId=${doc.id}`; };
                        upcomingDeliveryList.appendChild(li);
                   });
              }
         } catch (e) { console.error("Error fetching upcoming deliveries:", e); if(upcomingDeliveryList) upcomingDeliveryList.innerHTML = '<li>Error loading deliveries.</li>'; }
     }
}

// --- Load Customer Dues ---
async function loadCustomerDues() {
    if (!customerDuesList) return;
    showLoading(customerDuesList, 'list');
    console.warn("Customer Dues section relies on 'currentBalance' field in 'customers' collection or needs complex calculation.");
    // **** Placeholder Logic: Replace with actual logic ****
    // Option 1: Use stored balance (Recommended)
     try {
         const customerQuery = query(collection(db, "customers"),
                                    where('currentBalance', '>', 0), // Query for positive balance
                                    orderBy('currentBalance', 'desc'),
                                    limit(10));
         const customerSnapshot = await getDocs(customerQuery);
         customerDuesList.innerHTML = '';
         if (customerSnapshot.empty) {
             customerDuesList.innerHTML = '<li>No customers with outstanding dues found.</li>';
         } else {
              customerSnapshot.forEach(doc => {
                  const customer = doc.data();
                  const li = document.createElement('li');
                  li.dataset.customerId = doc.id;
                  li.innerHTML = `<span class="customer-name">${customer.fullName || 'N/A'}</span> <span class="due-amount">₹ ${parseFloat(customer.currentBalance || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>`;
                  li.addEventListener('click', () => { window.location.href = `customer_account_detail.html?id=${doc.id}`; });
                  customerDuesList.appendChild(li);
              });
         }
     } catch (e) {
         console.error("Error fetching customer dues:", e);
          if (e.message && e.message.includes('index')) {
              console.warn("Firestore index on 'customers/currentBalance' (desc) might be required.");
              customerDuesList.innerHTML = '<li>Error loading dues (Index missing?).</li>';
          } else {
             customerDuesList.innerHTML = '<li>Error loading customer dues.</li>';
          }
     }
    // Option 2: Calculate manually (Slow, not recommended for dashboard)
    // setTimeout(() => { customerDuesList.innerHTML = '<li>(Dues Calculation Not Implemented)</li>'; }, 1300);
}

// --- Dashboard Multi-Search Functions ---
function handleDashboardSearchInput() { clearTimeout(suggestionDebounceTimer); const searchTerm = dashboardSearchInput.value.trim(); if (searchTerm.length > 0) { suggestionDebounceTimer = setTimeout(() => fetchAndDisplayDashboardSuggestions(searchTerm), 300); } else { clearSuggestions(); } }
function triggerDashboardSearch() { const searchTerm = dashboardSearchInput.value.trim(); fetchAndDisplayDashboardSuggestions(searchTerm); }
function clearSuggestions() { if (suggestionsContainer) { suggestionsContainer.innerHTML = ''; suggestionsContainer.style.display = 'none'; } }
async function fetchAndDisplayDashboardSuggestions(searchTerm) {
    // Client-side search implementation
    if (!suggestionsContainer || !allOrdersCache) return;
    if (!searchTerm) { clearSuggestions(); return; }

    const searchTermLower = searchTerm.toLowerCase();
    suggestionsContainer.innerHTML = '';
    let combinedResults = [];

    // Filter Orders
    const filteredOrders = allOrdersCache.filter(order => {
        if (!order) return false;
        const orderIdMatch = String(order.orderId || '').toLowerCase().includes(searchTermLower);
        const custNameMatch = String(order.customerDetails?.fullName || '').toLowerCase().includes(searchTermLower);
        const sysIdMatch = String(order.id || '').toLowerCase().includes(searchTermLower);
        return orderIdMatch || custNameMatch || sysIdMatch;
    }).slice(0, 5);
    filteredOrders.forEach(order => combinedResults.push({ type: 'Order', id: order.id, displayId: order.orderId || `Sys:${order.id.substring(0,6)}`, name: order.customerDetails?.fullName || '?', link: `order_history.html?openModalForId=${order.id}` }));

    // Filter LIC Policies (using cached data)
    if (allLicPoliciesCache && allLicPoliciesCache.length > 0) {
        const filteredLic = allLicPoliciesCache.filter(policy => {
            if (!policy) return false;
            const policyNumMatch = String(policy.policyNumber || '').toLowerCase().includes(searchTermLower);
            const custNameMatch = String(policy.customerName || '').toLowerCase().includes(searchTermLower);
            return policyNumMatch || custNameMatch;
        }).slice(0, 5);
        filteredLic.forEach(policy => combinedResults.push({ type: 'LIC', id: policy.id, displayId: policy.policyNumber || '?', name: policy.customerName || '?', link: `lic_management.html?policyId=${policy.id}` }));
    } else {
         console.log("LIC Cache not ready for search yet.");
         // Optionally add a message to suggestions: results.push({ type: 'Info', name: 'LIC search unavailable...' });
    }

    // Filter Customers (using cached data from quick payment)
     if (allCustomersCacheQP && allCustomersCacheQP.length > 0) {
        const filteredCustomers = allCustomersCacheQP.filter(cust => {
            if (!cust) return false;
            const custNameMatch = String(cust.fullName || '').toLowerCase().includes(searchTermLower);
            const custWhatsappMatch = String(cust.whatsappNo || '').toLowerCase().includes(searchTermLower);
            return custNameMatch || custWhatsappMatch;
        }).slice(0, 5);
        filteredCustomers.forEach(cust => combinedResults.push({ type: 'Customer', id: cust.id, displayId: cust.fullName || '?', name: cust.whatsappNo || '?', link: `customer_account_detail.html?id=${cust.id}` }));
    } else {
         console.log("Customer Cache (QP) not ready for search yet.");
    }


    // Display Combined Results
    if (combinedResults.length === 0) { suggestionsContainer.innerHTML = '<div class="no-suggestions">No matches found.</div>'; }
    else {
        combinedResults.forEach(result => {
            const suggestionDiv = document.createElement('div');
            const typeColor = result.type === 'Order' ? 'var(--primary-color)' : (result.type === 'LIC' ? '#6f42c1' : '#17a2b8');
            suggestionDiv.innerHTML = `<span style="font-weight: bold; color: ${typeColor};">[${result.type}]</span> <strong>${result.displayId}</strong> - ${result.name}`;
            suggestionDiv.setAttribute('data-link', result.link);
            suggestionDiv.addEventListener('mousedown', (e) => { e.preventDefault(); window.location.href = result.link; clearSuggestions(); });
            suggestionsContainer.appendChild(suggestionDiv);
        });
    }
    suggestionsContainer.style.display = 'block';
}

// --- Chart Functions ---
function initializeOrUpdateChart(statusCounts) { /* ... पहले जैसा ... */ if (!orderStatusChartCanvas || !window.Chart) { console.warn("Chart canvas or Chart.js library not found."); return; } const labels = Object.keys(statusCounts); const data = Object.values(statusCounts); const backgroundColors = labels.map(label => { switch(label) { case "Order Received": return 'rgba(108, 117, 125, 0.7)'; case "Designing": return 'rgba(255, 193, 7, 0.7)'; case "Verification": return 'rgba(253, 126, 20, 0.7)'; case "Design Approved": return 'rgba(32, 201, 151, 0.7)'; case "Printing": return 'rgba(23, 162, 184, 0.7)'; case "Ready for Working": return 'rgba(111, 66, 193, 0.7)'; case "Delivered": return 'rgba(13, 202, 240, 0.7)'; case "Completed": return 'rgba(40, 167, 69, 0.7)'; default: return 'rgba(200, 200, 200, 0.7)'; } }); const borderColors = backgroundColors.map(color => color.replace('0.7', '1')); const chartData = { labels: labels, datasets: [{ label: 'Order Count', data: data, backgroundColor: backgroundColors, borderColor: borderColors, borderWidth: 1 }] }; const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15, font: { size: 10 } } }, tooltip: { callbacks: { label: function(c){ return `${c.dataset.label||''}: ${c.parsed||0}`; }}}, title: { display: false } }, cutout: '50%' }; if (orderChartInstance) { orderChartInstance.destroy(); } try { orderChartInstance = new Chart(orderStatusChartCanvas, { type: 'doughnut', data: chartData, options: chartOptions }); console.log("[DEBUG] Chart initialized/updated."); } catch (e) { console.error("Error creating chart:", e); } }

// --- Helper: Time Ago ---
function formatTimeAgo(date) { /* ... पहले जैसा ... */ if (!(date instanceof Date)) return ''; const seconds = Math.floor((new Date() - date) / 1000); if (seconds < 5) return "just now"; if (seconds < 60) return Math.floor(seconds) + "s ago"; const minutes = Math.floor(seconds / 60); if (minutes < 60) return minutes + "m ago"; const hours = Math.floor(minutes / 60); if (hours < 24) return hours + "h ago"; const days = Math.floor(hours / 24); if (days < 30) return days + "d ago"; const months = Math.floor(days / 30); if (months < 12) return months + "mo ago"; const years = Math.floor(days / 365); return years + "y ago"; }
// --- Helper: Hide Suggestion Box ---
function hideSuggestionBox(box) { if(box){ box.style.display = 'none'; box.innerHTML = '<ul></ul>'; }}


// --- Quick Payment Modal Functions ---
function openQuickPaymentModal() {
    if (!quickPaymentModal) { console.error("Quick Payment modal not found."); return; }
    console.log("Opening Quick Payment modal.");
    quickPaymentForm.reset();
    quickPaymentCustomerId.value = '';
    quickPaymentSelectedCustomer.textContent = '';
    quickPaymentError.style.display = 'none';
    if (saveQuickPaymentBtn) saveQuickPaymentBtn.disabled = true; // Disable save until customer selected
    if (document.getElementById('quickPaymentDate')) document.getElementById('quickPaymentDate').valueAsDate = new Date();
    quickPaymentModal.classList.add('active');
    fetchAndCacheCustomersForQP(); // Ensure customer cache is ready
}

function closeQuickPaymentModal() {
    if (quickPaymentModal) quickPaymentModal.classList.remove('active');
}

async function fetchAndCacheCustomersForQP() {
    // Prevent multiple fetches if already done or in progress
    if (customerListenerUnsubscribeQP || allCustomersCacheQP.length > 0) {
        // console.log("Customers for QP already cached or listener active.");
        return;
    }
    console.log("Fetching customers for Quick Payment search...");
    try {
        const custQuery = query(collection(db, "customers"), orderBy('fullName')); // Order by name
        // Use onSnapshot to keep cache updated (optional)
        customerListenerUnsubscribeQP = onSnapshot(custQuery, (snapshot) => {
            allCustomersCacheQP = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`[DEBUG] Cached ${allCustomersCacheQP.length} customers for QP.`);
        }, (error) => {
            console.error("Error listening to customers for QP:", error);
            allCustomersCacheQP = [];
        });
    } catch (e) {
        console.error("Error setting up customer listener for QP:", e);
        allCustomersCacheQP = [];
    }
}

function handleQuickPaymentCustomerSearch() {
    clearTimeout(customerSearchDebounceTimerQP);
    if (!quickPaymentCustomerSearch || !quickPaymentCustomerSuggestions) return;

    const searchTerm = quickPaymentCustomerSearch.value.trim();
    quickPaymentCustomerId.value = ''; // Clear selected ID when searching
    quickPaymentSelectedCustomer.textContent = '';
    if(saveQuickPaymentBtn) saveQuickPaymentBtn.disabled = true; // Disable save

    if (searchTerm.length < 1) {
        hideSuggestionBox(quickPaymentCustomerSuggestions);
        return;
    }
    customerSearchDebounceTimerQP = setTimeout(() => {
        filterAndRenderQPCustomerSuggestions(searchTerm);
    }, 300);
}

function filterAndRenderQPCustomerSuggestions(term) {
    if (!quickPaymentCustomerSuggestions || !allCustomersCacheQP) return;
    const list = quickPaymentCustomerSuggestions.querySelector('ul');
    if (!list) return; // Should have ul inside

    const termLower = term.toLowerCase();
    const filtered = allCustomersCacheQP.filter(c =>
        String(c.fullName || '').toLowerCase().includes(termLower) ||
        String(c.whatsappNo || '').toLowerCase().includes(termLower)
    ).slice(0, 10);

    list.innerHTML = ''; // Clear previous suggestions
    if (filtered.length === 0) {
        list.innerHTML = '<li class="no-suggestions">No matching customers.</li>';
    } else {
        filtered.forEach(c => {
            const li = document.createElement('li');
            li.textContent = `${c.fullName} (${c.whatsappNo || 'No WhatsApp'})`;
            li.dataset.customerId = c.id;
            li.dataset.customerName = c.fullName;
            li.addEventListener('mousedown', selectQPCustomer); // Use mousedown
            list.appendChild(li);
        });
    }
    quickPaymentCustomerSuggestions.style.display = 'block';
    // Position suggestions (basic example, might need refinement)
    const inputRect = quickPaymentCustomerSearch.getBoundingClientRect();
    quickPaymentCustomerSuggestions.style.position = 'absolute';
    quickPaymentCustomerSuggestions.style.width = `${inputRect.width}px`;
    quickPaymentCustomerSuggestions.style.top = `${inputRect.bottom}px`; // Position below input
    quickPaymentCustomerSuggestions.style.left = `${inputRect.left}px`;
    quickPaymentCustomerSuggestions.style.zIndex = '1100'; // Ensure it's above modal content
    quickPaymentCustomerSuggestions.style.backgroundColor = 'white';
    quickPaymentCustomerSuggestions.style.border = '1px solid #ccc';
}

function selectQPCustomer(event) {
    event.preventDefault();
    const targetLi = event.currentTarget;
    const custId = targetLi.dataset.customerId;
    const custName = targetLi.dataset.customerName;

    if (custId && custName) {
        quickPaymentCustomerSearch.value = custName; // Display selected name
        quickPaymentCustomerId.value = custId;     // Store ID in hidden field
        quickPaymentSelectedCustomer.textContent = `Selected: ${custName}`;
        if(saveQuickPaymentBtn) saveQuickPaymentBtn.disabled = false; // Enable save button
        hideSuggestionBox(quickPaymentCustomerSuggestions);
        // Focus amount field
        document.getElementById('quickPaymentAmount')?.focus();
    } else {
        console.error("Missing customer data on selected suggestion.");
    }
}

async function handleSaveQuickPayment(event) {
    event.preventDefault();
    const custId = quickPaymentCustomerId.value;
    const amountInput = document.getElementById('quickPaymentAmount');
    const dateInput = document.getElementById('quickPaymentDate');
    const methodSelect = document.getElementById('quickPaymentMethod');
    const notesInput = document.getElementById('quickPaymentNotes');

    if (!custId) { showQuickPaymentError("Please select a customer."); return; }
    if (!amountInput || !dateInput || !methodSelect || !saveQuickPaymentBtn) { showQuickPaymentError("Form elements missing."); return; }

    const amount = parseFloat(amountInput.value);
    const date = dateInput.value;
    const method = methodSelect.value;
    const notes = notesInput?.value.trim() || null;

    if (isNaN(amount) || amount <= 0) { showQuickPaymentError("Invalid amount."); amountInput.focus(); return; }
    if (!date) { showQuickPaymentError("Payment date required."); dateInput.focus(); return; }

    saveQuickPaymentBtn.disabled = true;
    saveQuickPaymentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    showQuickPaymentError(''); // Clear error

    try {
        const paymentDateTimestamp = Timestamp.fromDate(new Date(date + 'T00:00:00'));
        const paymentData = {
            customerId: custId,
            amountPaid: amount,
            paymentDate: paymentDateTimestamp,
            paymentMethod: method,
            notes: notes,
            createdAt: serverTimestamp()
        };
        await addDoc(collection(db, "payments"), paymentData);
        alert("Payment saved successfully!");
        closeQuickPaymentModal();
        // Refresh relevant dashboard data (e.g., pending payments KPI)
        loadDashboardKPIs(); // Reload KPIs
        loadCustomerDues(); // Reload dues list

    } catch (e) {
        console.error("Error saving quick payment:", e);
        showQuickPaymentError(`Error: ${e.message}`);
    } finally {
        if (saveQuickPaymentBtn) {
            saveQuickPaymentBtn.disabled = false;
            saveQuickPaymentBtn.innerHTML = '<i class="fas fa-save"></i> Save';
        }
    }
}

function showQuickPaymentError(message) {
    if (!quickPaymentError) return;
    quickPaymentError.textContent = message;
    quickPaymentError.style.display = message ? 'block' : 'none';
}

console.log("dashboard.js (v3) script loaded.");