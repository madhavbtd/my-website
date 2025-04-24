// js/dashboard.js (vFinal Debug - More Logging, Fixes)

// Import initialized db and auth from firebase-init.js
import { db, auth } from './firebase-init.js';

// Import necessary functions directly from the SDK
import { collection, onSnapshot, query, where, getDocs, limit, orderBy, Timestamp, doc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { formatTimeAgo } from './helper_utils.js'; // Assuming formatTimeAgo is in utils.js

// --- DOM Elements ---
// (पहले जैसा, सभी IDs यहाँ परिभाषित करें)
const countElements = { /* ... पहले जैसा ... */ "Order Received": document.getElementById('count-order-received'), "Designing": document.getElementById('count-designing'), "Verification": document.getElementById('count-verification'), "Design Approved": document.getElementById('count-design-approved'), "Ready for Working": document.getElementById('count-ready-for-working'), "Printing": document.getElementById('count-printing'), "Delivered": document.getElementById('count-delivered'), "Completed": document.getElementById('count-completed') };
const dashboardSearchInput = document.getElementById('dashboardSearchInput');
const dashboardSearchButton = document.getElementById('dashboardSearchButton');
const suggestionsContainer = document.getElementById('dashboardSuggestions');
const welcomeUserSpan = document.getElementById('welcome-user');
const dateTimeSpan = document.getElementById('currentDateTime');
const logoutLink = document.getElementById('logout-link');
const kpiActiveOrders = document.getElementById('kpi-active-orders'); // <<< नया
const kpiPendingPayments = document.getElementById('kpi-pending-payments');
const kpiOrdersToday = document.getElementById('kpi-orders-today');
const recentActivityList = document.getElementById('recent-activity-list');
const licReminderList = document.getElementById('lic-reminder-list');
const upcomingTaskList = document.getElementById('upcoming-task-list');
const upcomingDeliveryList = document.getElementById('upcoming-delivery-list');
const orderStatusChartCanvas = document.getElementById('orderStatusChart');
const customerDuesList = document.getElementById('customer-dues-list');
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
const quickAddPaymentBtn = document.getElementById('quickAddPaymentBtn');

// Global state (पहले जैसा)
let suggestionDebounceTimer, customerSearchDebounceTimerQP, dateTimeIntervalId = null, userRole = null;
let allOrdersCache = [], allLicPoliciesCache = [], allCustomersCacheQP = [];
let licPoliciesListenerUnsubscribe = null, orderCountsListenerUnsubscribe = null, customerListenerUnsubscribeQP = null;
let orderChartInstance = null;

// --- Initialization on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DEBUG] Dashboard DOM Loaded (vFinal Debug).");
    if (!auth) { console.error("Auth instance not found! Check firebase-init.js loading."); alert("Critical Error: Auth system failed."); return; }
    setupEventListeners();
    listenForAuthChanges(); // Auth बदलावों को सुनना शुरू करें
});

// --- Setup Event Listeners ---
function setupEventListeners() { /* ... पिछले उत्तर जैसा, कोई बदलाव नहीं ... */ if (dashboardSearchInput) { dashboardSearchInput.addEventListener('input', handleDashboardSearchInput); dashboardSearchInput.addEventListener('blur', () => setTimeout(clearSuggestions, 150)); } else { console.warn("Dashboard Search Input not found");} if (dashboardSearchButton) dashboardSearchButton.addEventListener('click', triggerDashboardSearch); else { console.warn("Dashboard Search Button not found");} if (logoutLink) logoutLink.addEventListener('click', handleLogout); else { console.warn("Logout Link not found");} if (quickAddPaymentBtn) quickAddPaymentBtn.addEventListener('click', openQuickPaymentModal); else { console.warn("Quick Add Payment Button not found");} if (closeQuickPaymentModalBtn) closeQuickPaymentModalBtn.addEventListener('click', closeQuickPaymentModal); else { console.warn("Close Quick Payment Modal Button not found");} if (cancelQuickPaymentBtn) cancelQuickPaymentBtn.addEventListener('click', closeQuickPaymentModal); else { console.warn("Cancel Quick Payment Button not found");} if (quickPaymentModal) quickPaymentModal.addEventListener('click', (e) => { if (e.target === quickPaymentModal) closeQuickPaymentModal(); }); else { console.warn("Quick Payment Modal not found");} if (quickPaymentForm) quickPaymentForm.addEventListener('submit', handleSaveQuickPayment); else { console.warn("Quick Payment Form not found");} if (quickPaymentCustomerSearch) quickPaymentCustomerSearch.addEventListener('input', handleQuickPaymentCustomerSearch); else { console.warn("Quick Payment Customer Search Input not found");} document.addEventListener('click', (e) => { if (suggestionsContainer && suggestionsContainer.style.display === 'block' && !dashboardSearchInput?.contains(e.target) && !suggestionsContainer.contains(e.target)) { clearSuggestions(); } if (quickPaymentCustomerSuggestions && quickPaymentCustomerSuggestions.style.display === 'block' && !quickPaymentCustomerSearch?.contains(e.target) && !quickPaymentCustomerSuggestions.contains(e.target)) { hideSuggestionBox(quickPaymentCustomerSuggestions); } }); console.log("[DEBUG] Dashboard event listeners setup complete."); }

// --- Date/Time Update ---
function updateDateTime() {
    if (!dateTimeSpan) { /* console.log("[DEBUG DateTime] Span not found"); */ return; }
    console.log("[DEBUG DateTime] Updating time..."); // <<< लॉग जोड़ा गया
    const now = new Date(); const optsDate = { year: 'numeric', month: 'short', day: 'numeric' }; const optsTime = { hour: 'numeric', minute: '2-digit', hour12: true }; const optsDay = { weekday: 'long' };
    try { const date = now.toLocaleDateString('en-IN', optsDate); const day = now.toLocaleDateString('en-IN', optsDay); const time = now.toLocaleTimeString('en-US', optsTime); dateTimeSpan.textContent = `${date} | ${day} | ${time}`; dateTimeSpan.classList.remove('loading-placeholder'); }
    catch (e) { console.error("[ERROR DateTime] Formatting error:", e); dateTimeSpan.textContent = 'Error'; dateTimeSpan.classList.remove('loading-placeholder'); }
}
function startDateTimeUpdate() { if (dateTimeIntervalId) clearInterval(dateTimeIntervalId); updateDateTime(); dateTimeIntervalId = setInterval(updateDateTime, 10000); console.log("[DEBUG DateTime] Update interval started."); }

// --- Authentication Handling ---
function listenForAuthChanges() {
    console.log("[DEBUG Auth] Setting up onAuthStateChanged listener...");
    try {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log("[DEBUG Auth] User authenticated:", user.uid);
                startDateTimeUpdate(); // <<<--- Ensure called HERE
                user.getIdTokenResult(true).then((idTokenResult) => { userRole = idTokenResult.claims.role || 'Standard'; if (welcomeUserSpan) welcomeUserSpan.textContent = `Welcome ${user.email || 'User'} (${userRole})`; }).catch(error => { console.error('[ERROR Auth] Getting role:', error); if (welcomeUserSpan) welcomeUserSpan.textContent = `Welcome ${user.email || 'User'} (Role Err)`; });
                initializeDashboardDataFetching();
            } else {
                console.log("[DEBUG Auth] User not authenticated. Redirecting...");
                if (dateTimeIntervalId) { clearInterval(dateTimeIntervalId); console.log("[DEBUG DateTime] Update interval stopped."); }
                if (dateTimeSpan) dateTimeSpan.textContent = ''; if (welcomeUserSpan) welcomeUserSpan.textContent = 'Not Logged In';
                if (!window.location.pathname.endsWith('login.html')) { window.location.replace('login.html'); }
            }
        });
    } catch (e) {
         console.error("[ERROR Auth] Failed to set up listener:", e);
         if (welcomeUserSpan) welcomeUserSpan.textContent = 'Auth Error';
         // Consider disabling parts of the UI if auth fails critically
    }
}

// --- Logout Handler ---
function handleLogout(e) { /* ... पहले जैसा ... */ e.preventDefault(); if (confirm("Are you sure?")) { signOut(auth).then(() => { window.location.href = 'login.html'; }).catch((error) => { console.error('Sign out error:', error); alert("Logout failed."); }); } }

// --- Initialize Data Fetching ---
function initializeDashboardDataFetching() {
    console.log("[DEBUG] initializeDashboardDataFetching called."); // <<< लॉग जोड़ा गया
    try {
        listenForOrderCounts(); // <<< Starts order cache population
        fetchAndCacheLicPolicies(); // <<< Starts LIC cache population
        fetchAndCacheCustomersForQP(); // <<< Starts Customer cache population
        loadDashboardKPIs();
        // loadRecentActivity(); // <<< फिलहाल टिप्पणी की गई
        loadRemindersAndTasks();
        loadCustomerDues();
        // Cache Check Log moved inside individual fetch functions for better timing
    } catch (e) {
        console.error("[ERROR] During initializeDashboardDataFetching:", e);
        alert("Error loading dashboard data. Please check console.");
    }
}

// --- Loading Indicators ---
function showLoading(element, type = 'text') { /* ... पहले जैसा ... */ if (!element) return; if (type === 'spinner') { element.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 0.8em; color: #aaa;"></i>'; } else if (type === 'list') { element.innerHTML = '<li class="loading-placeholder" style="color:#aaa; font-style:italic;">Loading...</li>'; } else { element.innerHTML = '<span class="loading-placeholder" style="color:#aaa;">...</span>'; } }

// --- Dashboard Counts & Active Orders ---
function updateDashboardCounts(orders) {
    console.log("[DEBUG Counts] updateDashboardCounts called with", orders?.length, "orders."); // <<< लॉग
    if (!orders) { console.warn("[DEBUG Counts] updateDashboardCounts received null/undefined orders."); orders = []; }
    const statusCounts = { "Order Received": 0, "Designing": 0, "Verification": 0, "Design Approved": 0, "Ready for Working": 0, "Printing": 0, "Delivered": 0, "Completed": 0 };
    orders.forEach(order => { const status = order.status; if (status && statusCounts.hasOwnProperty(status)) { statusCounts[status]++; } });
    let totalActiveOrders = 0;
    for (const status in countElements) {
        if (countElements[status]) {
            const count = statusCounts[status] || 0;
            countElements[status].textContent = count.toString().padStart(2, '0');
            if (status !== "Completed" && status !== "Delivered") { totalActiveOrders += count; }
        } else { console.warn(`[DEBUG Counts] Element not found for status: ${status}`); }
    }
    if (kpiActiveOrders) { kpiActiveOrders.textContent = totalActiveOrders.toString().padStart(2, '0'); kpiActiveOrders.classList.remove('loading-placeholder'); } else { console.warn("[DEBUG Counts] Active Orders KPI element not found"); }
    console.log(`[DEBUG Counts] Counts updated. Active: ${totalActiveOrders}. StatusCounts:`, statusCounts);
    initializeOrUpdateChart(statusCounts); // Update chart
}
function listenForOrderCounts() { Object.values(countElements).forEach(el => showLoading(el)); if(kpiActiveOrders) showLoading(kpiActiveOrders); console.log("[DEBUG Counts] Setting up Firestore listener for orders..."); try { if (orderCountsListenerUnsubscribe) orderCountsListenerUnsubscribe(); const ordersRef = collection(db, "orders"); const q = query(ordersRef); orderCountsListenerUnsubscribe = onSnapshot(q, (snapshot) => { allOrdersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); console.log(`[DEBUG Counts] Snapshot received, ${allOrdersCache.length} orders cached.`); updateDashboardCounts(allOrdersCache); }, (error) => { console.error("[ERROR Counts] Error listening to orders:", error); Object.values(countElements).forEach(el => { if(el) el.textContent = 'Err'; }); if(kpiActiveOrders) kpiActiveOrders.textContent = 'Err'; }); } catch (e) { console.error("[ERROR Counts] Error setting up listener:", e); Object.values(countElements).forEach(el => { if(el) el.textContent = 'Err'; }); if(kpiActiveOrders) kpiActiveOrders.textContent = 'Err';} }

// --- Load KPIs ---
async function loadDashboardKPIs() {
    console.log("[DEBUG KPIs] Loading KPIs..."); // <<< लॉग
    showLoading(kpiOrdersToday); showLoading(kpiPendingPayments);
    // Orders Today
    try { /* ... पहले जैसा ... */ const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0); const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999); const q = query(collection(db, "orders"), where('createdAt', '>=', Timestamp.fromDate(todayStart)), where('createdAt', '<=', Timestamp.fromDate(todayEnd))); const todaySnapshot = await getDocs(q); if(kpiOrdersToday) {kpiOrdersToday.textContent = todaySnapshot.size; console.log(`[DEBUG KPIs] Orders Today: ${todaySnapshot.size}`);} }
    catch (e) { console.error("[ERROR KPIs] Orders Today:", e); if(kpiOrdersToday) kpiOrdersToday.textContent = 'Err'; if (e.message.includes('index')) console.warn("[INDEX WARNING] Index needed for Orders Today KPI: orders on createdAt"); }
    // Pending Payments Placeholder
    console.warn("[DEBUG KPIs] Pending Payments needs implementation."); setTimeout(() => { if(kpiPendingPayments) kpiPendingPayments.textContent = '₹ ...'; }, 1500);
}

// --- Load Recent Activity ---
// async function loadRecentActivity() { /* ... पहले जैसा ... */ } // यदि आवश्यक हो तो अनकमेंट करें

// --- Fetch & Cache LIC Policies for Search ---
async function fetchAndCacheLicPolicies() { if (licPoliciesListenerUnsubscribe) { console.log("[DEBUG CACHE LIC] Listener already active."); return;} console.log("[DEBUG CACHE LIC] Setting up listener..."); try { const licQuery = query(collection(db, "licCustomers"), orderBy('customerName')); licPoliciesListenerUnsubscribe = onSnapshot(licQuery, (snapshot) => { allLicPoliciesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); console.log(`[DEBUG CACHE LIC] Snapshot received, Cached ${allLicPoliciesCache.length} policies.`); }, (error) => { console.error("[ERROR CACHE LIC] Listener error:", error); allLicPoliciesCache = []; }); } catch (e) { console.error("[ERROR CACHE LIC] Setup error:", e); allLicPoliciesCache = []; } }

// --- Load Reminders & Tasks (Implemented Queries + Logging) ---
async function loadRemindersAndTasks() {
    console.log("[DEBUG Reminders/Tasks] Loading reminders and tasks..."); // <<< लॉग
    const now = new Date(); const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fifteenDaysLater = new Date(todayStart); fifteenDaysLater.setDate(todayStart.getDate() + 15);
    const sevenDaysLater = new Date(todayStart); sevenDaysLater.setDate(todayStart.getDate() + 7);
    const threeDaysLater = new Date(todayStart); threeDaysLater.setDate(todayStart.getDate() + 3); threeDaysLater.setHours(23, 59, 59, 999);
    // Load LIC Reminders
    if (licReminderList) { showLoading(licReminderList, 'list'); try { const licQuery = query(collection(db, "licCustomers"), where('nextInstallmentDate', '>=', Timestamp.fromDate(todayStart)), where('nextInstallmentDate', '<=', Timestamp.fromDate(fifteenDaysLater)), where('policyStatus', 'in', ['Active', 'Lapsed']), orderBy('nextInstallmentDate', 'asc'), limit(5)); const licSnapshot = await getDocs(licQuery); licReminderList.innerHTML = ''; if(licSnapshot.empty){ licReminderList.innerHTML = '<li>No LIC premiums due soon.</li>'; } else { licSnapshot.forEach(doc => { /* ... */ const policy = doc.data(); const li = document.createElement('li'); li.innerHTML = `${policy.customerName || '?'} (${policy.policyNumber || '?'}) - Due: <strong>${policy.nextInstallmentDate.toDate().toLocaleDateString('en-GB')}</strong>`; li.style.cursor = 'pointer'; li.title=`View Policy ${policy.policyNumber}`; li.onclick = () => { window.location.href = `lic_management.html?policyId=${doc.id}`; }; licReminderList.appendChild(li); }); } console.log(`[DEBUG Reminders/Tasks] Loaded ${licSnapshot.size} LIC reminders.`); } catch (e) { console.error("[ERROR Reminders/Tasks] Fetching LIC reminders:", e); if(licReminderList) licReminderList.innerHTML = '<li>Error loading LIC data.</li>'; if(e.message?.includes('index')) console.warn("[INDEX WARNING] Index needed for LIC Reminders"); } } else { console.warn("[DEBUG Reminders/Tasks] LIC Reminder List element not found.");}
    // Load Upcoming Tasks
    if (upcomingTaskList) { showLoading(upcomingTaskList, 'list'); try { const taskQuery = query(collection(db, "tasks"), where('completed', '==', false), where('dueDate', '>=', Timestamp.fromDate(todayStart)), where('dueDate', '<=', Timestamp.fromDate(sevenDaysLater)), orderBy('dueDate', 'asc'), limit(5)); const taskSnapshot = await getDocs(taskQuery); upcomingTaskList.innerHTML = ''; if(taskSnapshot.empty){ upcomingTaskList.innerHTML = '<li>No tasks due soon.</li>'; } else { taskSnapshot.forEach(doc => { /* ... */ const task = doc.data(); const li = document.createElement('li'); li.innerHTML = `${task.customerName ? task.customerName + ': ' : ''}${task.description} - Due: <strong>${task.dueDate.toDate().toLocaleDateString('en-GB')}</strong>`; li.style.cursor = 'pointer'; li.title = `View/Edit Task`; /* li.onclick = () => {}; */ upcomingTaskList.appendChild(li); }); } console.log(`[DEBUG Reminders/Tasks] Loaded ${taskSnapshot.size} upcoming tasks.`); } catch (e) { console.error("[ERROR Reminders/Tasks] Fetching upcoming tasks:", e); if(upcomingTaskList) upcomingTaskList.innerHTML = '<li>Error loading tasks.</li>'; if(e.message?.includes('index')) console.warn("[INDEX WARNING] Index needed for Tasks"); } } else { console.warn("[DEBUG Reminders/Tasks] Upcoming Task List element not found.");}
     // Load Upcoming Deliveries
     if (upcomingDeliveryList) { showLoading(upcomingDeliveryList, 'list'); try { const qDel = query(collection(db, "orders"), where('deliveryDate', '>=', Timestamp.fromDate(todayStart)), where('deliveryDate', '<=', Timestamp.fromDate(threeDaysLater)), orderBy('deliveryDate', 'asc'), limit(5)); const delSnapshot = await getDocs(qDel); upcomingDeliveryList.innerHTML = ''; if(delSnapshot.empty) { upcomingDeliveryList.innerHTML = '<li>No deliveries due soon.</li>'; } else { delSnapshot.forEach(doc => { /* ... */ const order = doc.data(); const li = document.createElement('li'); li.innerHTML = `Order <strong>${order.orderId || 'N/A'}</strong> (${order.customerDetails?.fullName || '?'}) - Due: ${order.deliveryDate.toDate().toLocaleDateString('en-GB')}`; li.style.cursor = 'pointer'; li.title = `View Order ${order.orderId || '?'}`; li.onclick = () => { window.location.href = `order_history.html?openModalForId=${doc.id}`; }; upcomingDeliveryList.appendChild(li); }); } console.log(`[DEBUG Reminders/Tasks] Loaded ${delSnapshot.size} upcoming deliveries.`); } catch (e) { console.error("[ERROR Reminders/Tasks] Fetching upcoming deliveries:", e); if(upcomingDeliveryList) upcomingDeliveryList.innerHTML = '<li>Error loading deliveries.</li>'; if(e.message?.includes('index')) console.warn("[INDEX WARNING] Index needed for Deliveries");} } else { console.warn("[DEBUG Reminders/Tasks] Upcoming Delivery List element not found.");}
}

// --- Load Customer Dues (With Improved Logging + Field Check Reminder) ---
async function loadCustomerDues() {
    if (!customerDuesList) { console.warn("[DEBUG DUES] List element not found."); return; }
    showLoading(customerDuesList, 'list');
    console.warn("[DEBUG DUES] Feature relies on 'currentBalance' field & Firestore index. Please verify.");
     try {
         console.log("[DEBUG DUES] Querying customers with currentBalance > 0...");
         const customerQuery = query(collection(db, "customers"), where('currentBalance', '>', 0), orderBy('currentBalance', 'desc'), limit(10));
         const customerSnapshot = await getDocs(customerQuery);
         console.log(`[DEBUG DUES] Query returned ${customerSnapshot.size} documents.`);
         customerDuesList.innerHTML = '';
         if (customerSnapshot.empty) { customerDuesList.innerHTML = '<li>No customers with outstanding dues found.</li>'; }
         else {
              customerSnapshot.forEach(doc => {
                  const customer = doc.data();
                  // <<<--- CHECK if currentBalance exists and is a number ---<<<
                  if (typeof customer.currentBalance !== 'number') {
                      console.warn(`[DEBUG DUES] Customer ${doc.id} (${customer.fullName}) has missing or invalid 'currentBalance' field.`);
                      return; // Skip this customer
                  }
                  const li = document.createElement('li'); li.dataset.customerId = doc.id;
                  const balance = parseFloat(customer.currentBalance || 0);
                  li.innerHTML = `<span class="customer-name">${customer.fullName || 'N/A'}</span> <span class="due-amount">₹ ${balance.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>`;
                  li.addEventListener('click', () => { window.location.href = `customer_account_detail.html?id=${doc.id}`; });
                  customerDuesList.appendChild(li);
              });
              if (customerDuesList.innerHTML === '') { // If all valid dues were < 0.01 or had bad data
                   customerDuesList.innerHTML = '<li>No customers with outstanding dues found.</li>';
              }
              console.log("[DEBUG DUES] Rendered dues list.");
         }
     } catch (e) {
         console.error("[ERROR DUES] Fetching/displaying customer dues:", e);
         if (customerDuesList) { customerDuesList.innerHTML = '<li>Error loading customer dues. Check console.</li>'; }
         if (e.message && e.message.includes('index')) { console.error("[ERROR DUES] Firestore index required: customers on currentBalance (>) and currentBalance (desc). Create it in Firestore console."); customerDuesList.innerHTML = '<li>Error: Database index required.</li>'; }
         else if (e.message && e.message.includes('currentBalance')){ console.error("[ERROR DUES] Field Error: 'currentBalance' field might be missing or not a number."); customerDuesList.innerHTML = '<li>Error: Data field missing/incorrect.</li>'; }
     }
}

// --- Dashboard Multi-Search Functions (Fixed LIC filter + Enhanced Logging) ---
function handleDashboardSearchInput() { clearTimeout(suggestionDebounceTimer); const searchTerm = dashboardSearchInput.value.trim(); if (searchTerm.length > 0) { suggestionDebounceTimer = setTimeout(() => fetchAndDisplayDashboardSuggestions(searchTerm), 350); } else { clearSuggestions(); } }
function triggerDashboardSearch() { const searchTerm = dashboardSearchInput.value.trim(); fetchAndDisplayDashboardSuggestions(searchTerm); }
function clearSuggestions() { if (suggestionsContainer) { suggestionsContainer.innerHTML = ''; suggestionsContainer.style.display = 'none'; } }
async function fetchAndDisplayDashboardSuggestions(searchTerm) {
    if (!suggestionsContainer || !allOrdersCache) { console.error("[SEARCH] Prerequisites missing (container or order cache)."); return; }
    if (!searchTerm) { clearSuggestions(); return; }
    const searchTermLower = searchTerm.toLowerCase(); suggestionsContainer.innerHTML = ''; let combinedResults = [];
    console.log(`[DEBUG SEARCH] Searching for: "${searchTermLower}"`);
    console.log(`[DEBUG SEARCH] Cache sizes - Orders: ${allOrdersCache?.length}, LIC: ${allLicPoliciesCache?.length}, Cust(QP): ${allCustomersCacheQP?.length}`);

    // Filter Orders
    try { const filteredOrders = allOrdersCache.filter(order => { if (!order) return false; const orderIdMatch = String(order.orderId || '').toLowerCase().includes(searchTermLower); const custNameMatch = String(order.customerDetails?.fullName || '').toLowerCase().includes(searchTermLower); const sysIdMatch = String(order.id || '').toLowerCase().includes(searchTermLower); return orderIdMatch || custNameMatch || sysIdMatch; }).slice(0, 5); console.log(`[DEBUG SEARCH] Filtered Orders: ${filteredOrders.length}`); filteredOrders.forEach(order => combinedResults.push({ type: 'Order', id: order.id, displayId: order.orderId || `Sys:${order.id.substring(0,6)}`, name: order.customerDetails?.fullName || '?', link: `order_history.html?openModalForId=${order.id}` })); } catch(e){ console.error("[ERROR SEARCH] Filtering orders cache:", e); }

    // Filter LIC Policies
    try { if (allLicPoliciesCache && allLicPoliciesCache.length > 0) { const filteredLic = allLicPoliciesCache.filter(policy => { if (!policy) return false; const policyNumMatch = String(policy.policyNumber || '').toLowerCase().includes(searchTermLower); const custNameMatch = String(policy.customerName || '').toLowerCase().includes(searchTermLower); return policyNumMatch || custNameMatch; }).slice(0, 5); console.log(`[DEBUG SEARCH] Filtered LIC: ${filteredLic.length}`); filteredLic.forEach(policy => combinedResults.push({ type: 'LIC', id: policy.id, displayId: policy.policyNumber || '?', name: policy.customerName || '?', link: `lic_management.html?policyId=${policy.id}` })); } else { console.log("[DEBUG SEARCH] LIC Cache empty/not ready."); } } catch(e){ console.error("[ERROR SEARCH] Filtering LIC cache:", e); }

    // Filter Customers
     try { if (allCustomersCacheQP && allCustomersCacheQP.length > 0) { const filteredCustomers = allCustomersCacheQP.filter(cust => { if (!cust) return false; const custNameMatch = String(cust.fullName || '').toLowerCase().includes(searchTermLower); const custWhatsappMatch = String(cust.whatsappNo || '').toLowerCase().includes(searchTermLower); return custNameMatch || custWhatsappMatch; }).slice(0, 5); console.log(`[DEBUG SEARCH] Filtered Customers (QP): ${filteredCustomers.length}`); filteredCustomers.forEach(cust => combinedResults.push({ type: 'Customer', id: cust.id, displayId: cust.fullName || '?', name: cust.whatsappNo || '?', link: `customer_account_detail.html?id=${cust.id}` })); } else { console.log("[DEBUG SEARCH] Customer Cache (QP) not ready."); } } catch(e){ console.error("[ERROR SEARCH] Filtering customers cache (QP):", e); }

    // Display Combined Results
    console.log(`[DEBUG SEARCH] Final Combined Results: ${combinedResults.length}`);
    if (combinedResults.length === 0) { suggestionsContainer.innerHTML = '<div class="no-suggestions">No matches found.</div>'; }
    else { combinedResults.forEach(result => { const suggestionDiv = document.createElement('div'); const typeColor = result.type === 'Order' ? 'var(--primary-color)' : (result.type === 'LIC' ? '#6f42c1' : '#17a2b8'); suggestionDiv.innerHTML = `<span style="font-weight: bold; color: ${typeColor};">[${result.type}]</span> <strong>${escapeHtml(result.displayId)}</strong> - ${escapeHtml(result.name)}`; suggestionDiv.setAttribute('data-link', result.link); suggestionDiv.addEventListener('mousedown', (e) => { e.preventDefault(); window.location.href = result.link; clearSuggestions(); }); suggestionsContainer.appendChild(suggestionDiv); }); }
    suggestionsContainer.style.display = 'block';
}

// --- Chart Functions (Added Robust Checks) ---
function initializeOrUpdateChart(statusCounts) {
    if (!orderStatusChartCanvas) { console.warn("[CHART] Canvas element (#orderStatusChart) not found."); return; }
    if (typeof window.Chart === 'undefined') { console.error("[CHART] Chart.js library not loaded! Check <script> tag."); const ctx = orderStatusChartCanvas.getContext('2d'); if(ctx){ ctx.clearRect(0, 0, orderStatusChartCanvas.width, orderStatusChartCanvas.height); ctx.fillStyle = '#dc3545'; ctx.textAlign = 'center'; ctx.fillText('Chart Library Error', orderStatusChartCanvas.width / 2, orderStatusChartCanvas.height / 2); } return; }
    console.log("[DEBUG CHART] Initializing/Updating chart with counts:", statusCounts);
    const labels = Object.keys(statusCounts); const data = Object.values(statusCounts); const backgroundColors = labels.map(label => { switch(label) { case "Order Received": return 'rgba(108, 117, 125, 0.7)'; case "Designing": return 'rgba(255, 193, 7, 0.7)'; case "Verification": return 'rgba(253, 126, 20, 0.7)'; case "Design Approved": return 'rgba(32, 201, 151, 0.7)'; case "Printing": return 'rgba(23, 162, 184, 0.7)'; case "Ready for Working": return 'rgba(111, 66, 193, 0.7)'; case "Delivered": return 'rgba(13, 202, 240, 0.7)'; case "Completed": return 'rgba(40, 167, 69, 0.7)'; default: return 'rgba(200, 200, 200, 0.7)'; } }); const borderColors = backgroundColors.map(color => color.replace('0.7', '1')); const chartData = { labels: labels, datasets: [{ label: 'Order Count', data: data, backgroundColor: backgroundColors, borderColor: borderColors, borderWidth: 1 }] }; const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15, font: { size: 10 } } }, tooltip: { callbacks: { label: function(c){ return `${c.dataset.label||''}: ${c.parsed||0}`; }}}, title: { display: false } }, cutout: '50%' };
    try { if (orderChartInstance) { console.log("[DEBUG CHART] Destroying previous chart instance."); orderChartInstance.destroy(); } orderChartInstance = new Chart(orderStatusChartCanvas, { type: 'doughnut', data: chartData, options: chartOptions }); console.log("[DEBUG CHART] Chart creation/update successful."); }
    catch (e) { console.error("[ERROR CHART] Error creating chart:", e); const ctx = orderStatusChartCanvas.getContext('2d'); if(ctx){ ctx.clearRect(0, 0, orderStatusChartCanvas.width, orderStatusChartCanvas.height); ctx.fillStyle = '#dc3545'; ctx.textAlign = 'center'; ctx.fillText('Chart Render Error', orderStatusChartCanvas.width / 2, orderStatusChartCanvas.height / 2); } }
}

// --- Quick Payment Modal Functions ---
function openQuickPaymentModal() { /* ... पहले जैसा ... */ if (!quickPaymentModal) { console.error("QP Modal not found."); return; } console.log("Opening QP modal."); quickPaymentForm.reset(); quickPaymentCustomerId.value = ''; quickPaymentSelectedCustomer.textContent = ''; showQuickPaymentError(''); if (saveQuickPaymentBtn) saveQuickPaymentBtn.disabled = true; const dateInput = document.getElementById('quickPaymentDate'); if (dateInput) dateInput.valueAsDate = new Date(); quickPaymentModal.classList.add('active'); fetchAndCacheCustomersForQP(); }
function closeQuickPaymentModal() { /* ... पहले जैसा ... */ if (quickPaymentModal) quickPaymentModal.classList.remove('active'); }
async function fetchAndCacheCustomersForQP() { /* ... पहले जैसा ... */ if (customerListenerUnsubscribeQP || allCustomersCacheQP.length > 0) return; console.log("[DEBUG CACHE CUST QP] Setting up listener..."); try { const custQuery = query(collection(db, "customers"), orderBy('fullName')); customerListenerUnsubscribeQP = onSnapshot(custQuery, (snapshot) => { allCustomersCacheQP = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); console.log(`[DEBUG CACHE CUST QP] Snapshot received, Cached ${allCustomersCacheQP.length} customers.`); }, (error) => { console.error("[ERROR CACHE CUST QP] Listener error:", error); allCustomersCacheQP = []; }); } catch (e) { console.error("[ERROR CACHE CUST QP] Setup error:", e); allCustomersCacheQP = []; } }
function handleQuickPaymentCustomerSearch() { /* ... पहले जैसा ... */ clearTimeout(customerSearchDebounceTimerQP); if (!quickPaymentCustomerSearch || !quickPaymentCustomerSuggestions) return; const searchTerm = quickPaymentCustomerSearch.value.trim(); quickPaymentCustomerId.value = ''; quickPaymentSelectedCustomer.textContent = ''; if(saveQuickPaymentBtn) saveQuickPaymentBtn.disabled = true; if (searchTerm.length < 1) { hideSuggestionBox(quickPaymentCustomerSuggestions); return; } customerSearchDebounceTimerQP = setTimeout(() => { filterAndRenderQPCustomerSuggestions(searchTerm); }, 300); }
function filterAndRenderQPCustomerSuggestions(term) { /* ... पहले जैसा ... */ if (!quickPaymentCustomerSuggestions || !allCustomersCacheQP) return; const list = quickPaymentCustomerSuggestions.querySelector('ul'); if (!list) return; const termLower = term.toLowerCase(); const filtered = allCustomersCacheQP.filter(c => String(c.fullName || '').toLowerCase().includes(termLower) || String(c.whatsappNo || '').toLowerCase().includes(termLower)).slice(0, 10); list.innerHTML = ''; if (filtered.length === 0) { list.innerHTML = '<li class="no-suggestions">No matching customers.</li>'; } else { filtered.forEach(c => { const li = document.createElement('li'); li.textContent = `${c.fullName} (${c.whatsappNo || 'No WhatsApp'})`; li.dataset.customerId = c.id; li.dataset.customerName = c.fullName; li.addEventListener('mousedown', selectQPCustomer); list.appendChild(li); }); } quickPaymentCustomerSuggestions.style.display = 'block'; const inputRect = quickPaymentCustomerSearch.getBoundingClientRect(); const modalContentRect = quickPaymentModal.querySelector('.modal-content')?.getBoundingClientRect(); if(modalContentRect) { quickPaymentCustomerSuggestions.style.position = 'absolute'; quickPaymentCustomerSuggestions.style.width = `${inputRect.width}px`; quickPaymentCustomerSuggestions.style.top = `${inputRect.bottom - modalContentRect.top}px`; quickPaymentCustomerSuggestions.style.left = `${inputRect.left - modalContentRect.left}px`; quickPaymentCustomerSuggestions.style.zIndex = '1100'; quickPaymentCustomerSuggestions.style.backgroundColor = 'white'; quickPaymentCustomerSuggestions.style.border = '1px solid #ccc'; } else { quickPaymentCustomerSuggestions.style.position = 'static'; } }
function selectQPCustomer(event) { /* ... पहले जैसा ... */ event.preventDefault(); const targetLi = event.currentTarget; const custId = targetLi.dataset.customerId; const custName = targetLi.dataset.customerName; if (custId && custName) { quickPaymentCustomerSearch.value = custName; quickPaymentCustomerId.value = custId; quickPaymentSelectedCustomer.textContent = `Selected: ${custName}`; if(saveQuickPaymentBtn) saveQuickPaymentBtn.disabled = false; hideSuggestionBox(quickPaymentCustomerSuggestions); document.getElementById('quickPaymentAmount')?.focus(); } else { console.error("Missing customer data on QP selection."); } }
function hideSuggestionBox(box) { if(box){ box.style.display = 'none'; const list = box.querySelector('ul'); if (list) list.innerHTML = ''; }}
async function handleSaveQuickPayment(event) {
    event.preventDefault();
    console.log("[DEBUG QP] Attempting to save quick payment...");
    const custId = quickPaymentCustomerId.value; const amountInput = document.getElementById('quickPaymentAmount'); const dateInput = document.getElementById('quickPaymentDate'); const methodSelect = document.getElementById('quickPaymentMethod'); const notesInput = document.getElementById('quickPaymentNotes');
    if (!custId) { showQuickPaymentError("Please select a customer."); return; } if (!amountInput || !dateInput || !methodSelect || !saveQuickPaymentBtn) { showQuickPaymentError("Form elements missing."); return; }
    const amount = parseFloat(amountInput.value); const date = dateInput.value; const method = methodSelect.value; const notes = notesInput?.value.trim() || null;
    if (isNaN(amount) || amount <= 0) { showQuickPaymentError("Invalid amount."); amountInput.focus(); return; } if (!date) { showQuickPaymentError("Payment date required."); dateInput.focus(); return; }
    saveQuickPaymentBtn.disabled = true; saveQuickPaymentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; showQuickPaymentError('');
    try {
        console.log(`[DEBUG QP] Saving payment for customer: ${custId}, Amount: ${amount}, Date: ${date}`);
        const paymentDateTimestamp = Timestamp.fromDate(new Date(date + 'T00:00:00Z'));
        const paymentData = { customerId: custId, amountPaid: amount, paymentDate: paymentDateTimestamp, paymentMethod: method, notes: notes, createdAt: serverTimestamp() };
        await addDoc(collection(db, "payments"), paymentData);
        alert("Payment saved successfully!"); console.log("[DEBUG QP] Payment saved successfully.");
        closeQuickPaymentModal();
        // Refresh KPIs and Dues List
        loadDashboardKPIs();
        loadCustomerDues();
        console.log("[DEBUG QP] KPIs and Dues refreshed.");

    } catch (e) { console.error("[ERROR QP] Saving quick payment:", e); showQuickPaymentError(`Error: ${e.message}`); }
    finally { if (saveQuickPaymentBtn) { saveQuickPaymentBtn.disabled = false; saveQuickPaymentBtn.innerHTML = '<i class="fas fa-save"></i> Save'; } }
}
function showQuickPaymentError(message) { if (!quickPaymentError) return; quickPaymentError.textContent = message; quickPaymentError.style.display = message ? 'block' : 'none'; }

// --- Helper: Escape HTML ---
function escapeHtml(unsafe) { try { if (typeof unsafe !== 'string') { unsafe = String(unsafe ?? ''); } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); } catch(e) { return ''; } }

console.log("dashboard.js (vFinal Fixes) script loaded.");