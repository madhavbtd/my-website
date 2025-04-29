// js/dashboard.js (Revised Import & Structure + Updates + Online Pending Orders KPI + Quick Payment)

// Import initialized db and auth from firebase-init.js
import { db, auth } from './firebase-init.js';

// Import necessary functions directly from the SDK
// Added addDoc for saving payments
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
const kpiOnlinePendingOrders = document.getElementById('kpi-online-pending-orders');
// Other List Elements
const recentActivityList = document.getElementById('recent-activity-list');
const licReminderList = document.getElementById('lic-reminder-list');
const upcomingTaskList = document.getElementById('upcoming-task-list');
const upcomingDeliveryList = document.getElementById('upcoming-delivery-list');
const orderStatusChartCanvas = document.getElementById('orderStatusChart');
let orderChartInstance = null;

// --- Quick Payment Modal DOM Elements ---
const quickAddPaymentBtn = document.getElementById('quickAddPaymentBtn');
const addPaymentModal = document.getElementById('addPaymentModal'); // Modal from index.html
const closePaymentModalBtn = document.getElementById('closePaymentModal'); // Close button in modal
const cancelPaymentBtn = document.getElementById('cancelPaymentBtn'); // Cancel button in modal
const addPaymentForm = document.getElementById('addPaymentForm'); // Form in modal
const paymentModalCustNameSpan = document.getElementById('payment-modal-cust-name'); // Span for customer name in modal
const quickPaymentCustomerIdInput = document.getElementById('quickPaymentCustomerId'); // Hidden input for customer ID in modal
const paymentAmountInput = document.getElementById('paymentAmount'); // Amount input
const paymentDateInput = document.getElementById('paymentDate'); // Date input
const paymentMethodSelect = document.getElementById('paymentMethod'); // Method select
const paymentNotesInput = document.getElementById('paymentNotes'); // Notes textarea
const savePaymentBtn = document.getElementById('savePaymentBtn'); // Save button in modal


// Global state
let suggestionDebounceTimer;
let dateTimeIntervalId = null;
let userRole = null;
let isQuickPaymentMode = false; // Flag to check if search is for quick payment
let quickPaymentTargetCustomerId = null; // To store customer ID for saving

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
        // Blur event to hide suggestions, but with a slight delay to allow clicks
        orderIdSearchInput.addEventListener('blur', () => setTimeout(clearSuggestions, 150));
    }
    if (orderIdSearchButton) orderIdSearchButton.addEventListener('click', triggerSearch);
    if (logoutLink) logoutLink.addEventListener('click', handleLogout);

    // --- Quick Payment Listeners ---
    if (quickAddPaymentBtn) quickAddPaymentBtn.addEventListener('click', handleQuickPaymentClick);
    if (closePaymentModalBtn) closePaymentModalBtn.addEventListener('click', closeAddPaymentModal);
    if (cancelPaymentBtn) cancelPaymentBtn.addEventListener('click', closeAddPaymentModal);
    if (addPaymentModal) addPaymentModal.addEventListener('click', (event) => { if (event.target === addPaymentModal) closeAddPaymentModal(); }); // Close on backdrop click
    if (addPaymentForm) addPaymentForm.addEventListener('submit', handleSavePayment); // Use the same save function

    console.log("[DEBUG] Dashboard event listeners set up (incl. Quick Payment).");
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
                userRole = idTokenResult.claims.role || 'Standard'; // Get role from custom claims
                if (welcomeUserSpan) {
                    welcomeUserSpan.textContent = `Welcome ${user.email || 'User'} (${userRole})`;
                }
                 console.log(`[DEBUG] User role identified as: ${userRole}`);
                 // Initialize data fetching *after* user role is confirmed
                 initializeDashboardDataFetching();
            }).catch(error => {
                console.error('Error getting user role:', error);
                if (welcomeUserSpan) welcomeUserSpan.textContent = `Welcome ${user.email || 'User'} (Role Error)`;
                 // Initialize data fetching even if role check fails, using default permissions
                 initializeDashboardDataFetching();
            });
        } else {
            console.log("[DEBUG] User not authenticated. Redirecting...");
            if (!window.location.pathname.endsWith('login.html')) {
                 window.location.replace('login.html');
            }
            // Clear sensitive UI elements or display "Not Logged In"
            if (welcomeUserSpan) welcomeUserSpan.textContent = 'Not Logged In';
            if (dateTimeIntervalId) clearInterval(dateTimeIntervalId);
            if (dateTimeSpan) dateTimeSpan.textContent = '';
             // Clear potentially sensitive data display elements
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
    loadDashboardKPIs(); // For static KPIs
    listenForOnlineOrderCount(); // Listener for online order count
    loadRecentActivity();
    loadRemindersAndTasks();
}

// --- Logout Handler ---
function handleLogout(e) {
    e.preventDefault();
    if (confirm("Are you sure you want to logout?")) {
        signOut(auth).then(() => {
            console.log('User signed out.');
            // No need to redirect here, onAuthStateChanged will handle it
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
async function loadDashboardKPIs() {
    showLoading(kpiTotalCustomers); showLoading(kpiTotalSuppliers); showLoading(kpiOrdersToday); showLoading(kpiPendingPayments); showLoading(kpiPendingPOs);
    // kpiOnlinePendingOrders is handled by its listener

    try { const custSnapshot = await getDocs(collection(db, "customers")); if (kpiTotalCustomers) kpiTotalCustomers.textContent = custSnapshot.size; } catch (e) { console.error("KPI Error (Cust):", e); if(kpiTotalCustomers) kpiTotalCustomers.textContent = 'Err'; }
    try { const suppSnapshot = await getDocs(collection(db, "suppliers")); if (kpiTotalSuppliers) kpiTotalSuppliers.textContent = suppSnapshot.size; } catch (e) { console.error("KPI Error (Supp):", e); if(kpiTotalSuppliers) kpiTotalSuppliers.textContent = 'Err'; }
    try { const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0); const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999); const q = query(collection(db, "orders"), where('createdAt', '>=', Timestamp.fromDate(todayStart)), where('createdAt', '<=', Timestamp.fromDate(todayEnd))); const todaySnapshot = await getDocs(q); if(kpiOrdersToday) kpiOrdersToday.textContent = todaySnapshot.size; } catch (e) { console.error("KPI Error (Orders Today):", e); if(kpiOrdersToday) kpiOrdersToday.textContent = 'Err'; }
    try {
        const ordersQuery = query(collection(db, "orders"), where('status', '!=', 'Completed'));
        const ordersSnapshot = await getDocs(ordersQuery); let totalPendingAmount = 0;
        ordersSnapshot.forEach(doc => {
            const order = doc.data(); const totalAmount = Number(order.totalAmount) || 0; const amountPaid = Number(order.amountPaid) || 0; const balanceDue = totalAmount - amountPaid; if (balanceDue > 0) { totalPendingAmount += balanceDue; } });
        if (kpiPendingPayments) { kpiPendingPayments.textContent = `₹ ${totalPendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; } console.log(`[DEBUG] Total Pending Payments Calculated: ₹ ${totalPendingAmount}`);
    } catch (e) { console.error("KPI Error (Pending Payments):", e); if(kpiPendingPayments) kpiPendingPayments.textContent = '₹ Err'; }
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
    if (licReminderList) { showLoading(licReminderList, 'list'); console.warn("LIC Reminder section needs Firestore query implementation in dashboard.js."); setTimeout(() => { if(licReminderList.innerHTML.includes('Loading')) licReminderList.innerHTML = '<li>(LIC Reminder Data Not Implemented)</li>'; }, 2000); }
    if (upcomingTaskList) { showLoading(upcomingTaskList, 'list'); console.warn("Upcoming Tasks section needs Firestore query implementation in dashboard.js."); setTimeout(() => { if(upcomingTaskList.innerHTML.includes('Loading')) upcomingTaskList.innerHTML = '<li>(Task Data Not Implemented)</li>'; }, 2100); }
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

// --- Order/Customer/LIC Search Functions ---
function handleSearchInput() { clearTimeout(suggestionDebounceTimer); const searchTerm = orderIdSearchInput.value.trim(); if (searchTerm.length > 1) { suggestionDebounceTimer = setTimeout(() => fetchAndDisplaySuggestions(searchTerm), 300); } else { clearSuggestions(); } }
function triggerSearch() { const searchTerm = orderIdSearchInput.value.trim(); if(searchTerm.length > 1) fetchAndDisplaySuggestions(searchTerm); else clearSuggestions(); }
function clearSuggestions() { if (suggestionsContainer) { suggestionsContainer.innerHTML = ''; suggestionsContainer.style.display = 'none'; } }

// ==============================================================
// <<< UPDATED fetchAndDisplaySuggestions Function >>>
// ==============================================================
async function fetchAndDisplaySuggestions(searchTerm) {
    if (!suggestionsContainer || !db) return;
    if (!searchTerm) { clearSuggestions(); return; }

    suggestionsContainer.innerHTML = '<div class="suggestion-item loading-placeholder">Searching...</div>';
    suggestionsContainer.style.display = 'block';

    try {
        const ordersRef = collection(db, "orders");
        const licCustomersRef = collection(db, "licCustomers");
        const customersRef = collection(db, "customers");
        const searchLower = searchTerm.toLowerCase();
        const searchUpper = searchTerm.toUpperCase();

        // --- Firebase Queries ---
        const orderByIdQuery = query(ordersRef, where('orderId', '>=', searchTerm), where('orderId', '<=', searchTerm + '\uf8ff'), limit(3));
        const orderByCustomerNameQuery = query(ordersRef, limit(15));
        const licByNameQuery = query(licCustomersRef, where('customerNameLower', '>=', searchLower), where('customerNameLower', '<=', searchLower + '\uf8ff'), limit(3));
        const licByPolicyNoQuery = query(licCustomersRef, where('policyNumber', '>=', searchTerm), where('policyNumber', '<=', searchTerm + '\uf8ff'), limit(3));
        const customerByNameQuery = query(customersRef, where('fullNameLower', '>=', searchLower), where('fullNameLower', '<=', searchLower + '\uf8ff'), limit(3));
        // --- NEW: Customer by Mobile/WhatsApp Query ---
        // Combine queries if possible, or run separately
        const customerByWhatsappQuery = query(customersRef, where('whatsappNo', '>=', searchTerm), where('whatsappNo', '<=', searchTerm + '\uf8ff'), limit(3));
        const customerByContactQuery = query(customersRef, where('contactNo', '>=', searchTerm), where('contactNo', '<=', searchTerm + '\uf8ff'), limit(3));


        // Execute all queries in parallel
        const [
            orderByIdSnapshot,
            orderByCustomerNameSnapshot,
            licByNameSnapshot,
            licByPolicyNoSnapshot,
            customerByNameSnapshot,
            customerByWhatsappSnapshot, // Added
            customerByContactSnapshot // Added
        ] = await Promise.allSettled([
            getDocs(orderByIdQuery),
            getDocs(orderByCustomerNameQuery),
            getDocs(licByNameQuery),
            getDocs(licByPolicyNoQuery),
            getDocs(customerByNameQuery),
            getDocs(customerByWhatsappQuery), // Added
            getDocs(customerByContactQuery) // Added
        ]);

        let suggestions = [];
        const addedIds = new Set(); // Keep track of added items to avoid duplicates

        // --- Process Results ---

        // Function to add suggestion if unique
        const addUniqueSuggestion = (item, type) => {
             const uniqueKey = `${type}-${item.id}`;
             if (!addedIds.has(uniqueKey)) {
                 suggestions.push({ ...item, type: type }); // Add type explicitly
                 addedIds.add(uniqueKey);
             }
        };

        // Customer Profiles (Name, WhatsApp, Contact)
        if (customerByNameSnapshot.status === 'fulfilled') {
            customerByNameSnapshot.value.forEach(doc => addUniqueSuggestion({ id: doc.id, ...doc.data() }, 'CustomerProfile'));
        } else { console.error("Customer Name query failed:", customerByNameSnapshot.reason); }

        if (customerByWhatsappSnapshot.status === 'fulfilled') {
            customerByWhatsappSnapshot.value.forEach(doc => addUniqueSuggestion({ id: doc.id, ...doc.data() }, 'CustomerProfile'));
        } else { console.error("Customer WhatsApp query failed:", customerByWhatsappSnapshot.reason); }

        if (customerByContactSnapshot.status === 'fulfilled') {
            customerByContactSnapshot.value.forEach(doc => addUniqueSuggestion({ id: doc.id, ...doc.data() }, 'CustomerProfile'));
        } else { console.error("Customer Contact query failed:", customerByContactSnapshot.reason); }


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
        suggestionsContainer.innerHTML = ''; // Clear loading/previous

        if (suggestions.length === 0) {
            suggestionsContainer.innerHTML = '<div class="suggestion-item no-suggestions">कोई मिलान नहीं मिला।</div>';
        } else {
            suggestions.forEach((item) => {
                const suggestionDiv = document.createElement('div');
                suggestionDiv.classList.add('suggestion-item');
                let iconClass = '';
                let displayName = '';
                let destinationUrl = '#';
                let actionType = 'navigate'; // Default action is navigate

                // --- Determine display based on type ---
                 if (item.type === 'Order') {
                    iconClass = 'fas fa-receipt';
                    displayName = `Order: ${item.orderId || 'N/A'} (${item.customerDetails?.fullName || 'Unknown'}) - ${item.status || 'N/A'}`;
                    destinationUrl = `order_history.html?openModalForId=${item.id}`;
                    actionType = 'navigate';
                } else if (item.type === 'LIC') {
                    iconClass = 'fas fa-shield-alt';
                    displayName = `LIC: ${item.customerName || 'N/A'} (Policy: ${item.policyNumber || 'N/A'})`;
                    destinationUrl = `lic_management.html?openClientDetail=${item.id}`;
                    actionType = 'navigate';
                } else if (item.type === 'CustomerProfile') {
                    iconClass = 'fas fa-user';
                    displayName = `Customer: ${item.fullName || 'N/A'} (${item.whatsappNo || item.contactNo || 'No Contact'})`;
                    // If NOT in Quick Payment mode, destination is customer detail page
                    destinationUrl = `customer_account_detail.html?id=${item.id}`;
                    // Action type depends on isQuickPaymentMode flag (checked in listener)
                    actionType = 'customerAction'; // Special action type for customer
                }

                suggestionDiv.innerHTML = `<i class="${iconClass}" style="margin-right: 8px; color: #555; width: 16px; text-align: center;"></i> ${displayName}`;
                suggestionDiv.setAttribute('data-firestore-id', item.id);
                suggestionDiv.setAttribute('data-type', item.type); // Store the type ('Order', 'LIC', 'CustomerProfile')
                suggestionDiv.setAttribute('data-url', destinationUrl);
                suggestionDiv.setAttribute('data-action', actionType); // Store action type
                suggestionDiv.title = `Click to view ${item.type}`;

                // --- MODIFIED Mousedown Listener ---
                suggestionDiv.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // Prevent input blur before action
                    const targetElement = e.currentTarget;
                    const type = targetElement.getAttribute('data-type');
                    const id = targetElement.getAttribute('data-firestore-id');
                    const url = targetElement.getAttribute('data-url');
                    const action = targetElement.getAttribute('data-action');
                    // Extract customer name directly from the displayed text
                    const displayNameText = targetElement.textContent || '';
                    let customerName = 'Customer'; // Default
                    if (type === 'CustomerProfile' && displayNameText.startsWith('Customer:')) {
                        const match = displayNameText.match(/Customer:\s*([^()]+)/);
                        if (match && match[1]) {
                             customerName = match[1].trim();
                        }
                    }

                    console.log(`Suggestion clicked: Type=${type}, Action=${action}, URL=${url}, ID=${id}, QuickPaymentMode=${isQuickPaymentMode}`);

                    if (isQuickPaymentMode && type === 'CustomerProfile' && id) {
                        // <<< QUICK PAYMENT LOGIC >>>
                        // If in quick payment mode and a customer is clicked, open the payment modal
                        openQuickPaymentModal(id, customerName); // Pass ID and extracted name
                        clearSuggestions(); // Hide suggestions
                        isQuickPaymentMode = false; // Reset flag
                        if(orderIdSearchInput) orderIdSearchInput.placeholder = "Search Order ID / Customer / LIC..."; // Reset placeholder

                    } else if (action === 'navigate' && url !== '#') {
                        // <<< DEFAULT NAVIGATION LOGIC >>>
                        // Navigate if action is 'navigate' and URL is valid
                        window.location.href = url;
                        clearSuggestions(); // Hide suggestions after action
                        isQuickPaymentMode = false; // Reset flag if navigation happens
                         if(orderIdSearchInput) orderIdSearchInput.placeholder = "Search Order ID / Customer / LIC..."; // Reset placeholder
                    } else if (action === 'customerAction' && type === 'CustomerProfile' && url !== '#'){
                         // <<< DEFAULT CUSTOMER CLICK (Not Quick Payment) >>>
                         // Navigate to customer detail page
                         window.location.href = url;
                         clearSuggestions();
                         isQuickPaymentMode = false;
                         if(orderIdSearchInput) orderIdSearchInput.placeholder = "Search Order ID / Customer / LIC..."; // Reset placeholder
                    }
                     else {
                         // Handle other actions or do nothing
                         console.log("Unhandled suggestion click or no action defined.");
                         isQuickPaymentMode = false; // Reset flag on any other click too
                          if(orderIdSearchInput) orderIdSearchInput.placeholder = "Search Order ID / Customer / LIC..."; // Reset placeholder
                    }
                });
                 // --- End of MODIFIED Mousedown Listener ---

                suggestionsContainer.appendChild(suggestionDiv);
            });
        }
        suggestionsContainer.style.display = 'block';

    } catch (error) {
        console.error("Error fetching or displaying suggestions:", error);
        if (suggestionsContainer) {
             suggestionsContainer.innerHTML = '<div class="suggestion-item no-suggestions">सुझाव लाने में त्रुटि हुई।</div>';
             suggestionsContainer.style.display = 'block';
        }
        isQuickPaymentMode = false; // Reset flag on error
        if(orderIdSearchInput) orderIdSearchInput.placeholder = "Search Order ID / Customer / LIC..."; // Reset placeholder
    }
}
// ==============================================================
// <<< END OF UPDATED fetchAndDisplaySuggestions Function >>>
// ==============================================================


// --- Chart Functions ---
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

// --- Helper Function: Time Ago ---
function formatTimeAgo(date) {
  if (!(date instanceof Date)) return ''; const seconds = Math.floor((new Date() - date) / 1000); if (seconds < 5) return "just now"; if (seconds < 60) return Math.floor(seconds) + "s ago"; const minutes = Math.floor(seconds / 60); if (minutes < 60) return minutes + "m ago"; const hours = Math.floor(minutes / 60); if (hours < 24) return hours + "h ago"; const days = Math.floor(hours / 24); if (days < 30) return days + "d ago"; const months = Math.floor(days / 30); if (months < 12) return months + "mo ago"; const years = Math.floor(days / 365); return years + "y ago";
}

// ==============================================================
// <<< NEW Quick Payment Functions >>>
// ==============================================================

// --- Function to handle the Quick Payment button click ---
function handleQuickPaymentClick() {
    isQuickPaymentMode = true;
    // Focus the existing search bar and maybe change placeholder
    if (orderIdSearchInput) {
        orderIdSearchInput.placeholder = "Search Customer Name/Mobile for Quick Payment...";
        orderIdSearchInput.value = ''; // Clear current search term
        orderIdSearchInput.focus();
        // Optionally clear previous suggestions
        clearSuggestions();
    }
    console.log("Quick Payment mode activated. Search for customer.");
    // Inform the user to search using the main search bar
    // You could display a small temporary message near the search bar if needed
    // alert("Please search for the customer name or mobile number in the search bar above.");
}

// --- Function to open the Quick Payment modal ---
function openQuickPaymentModal(customerId, customerName) {
    // Ensure modal elements are available
    if(!addPaymentModal || !customerId || !customerName || !paymentModalCustNameSpan || !quickPaymentCustomerIdInput || !paymentDateInput || !savePaymentBtn || !addPaymentForm){
        console.error("Cannot open quick payment modal. Required elements (modal, name span, hidden input, date input, save button, form) or customerId/name missing.");
        alert("Error opening payment form. Please check console.");
        isQuickPaymentMode = false; // Reset flag on error
        return;
    }
    console.log(`Opening Quick Payment modal for ${customerName} (ID: ${customerId})`);
    addPaymentForm.reset(); // Clear the form
    paymentModalCustNameSpan.textContent = customerName;
    paymentDateInput.valueAsDate = new Date(); // Default to today
    quickPaymentCustomerIdInput.value = customerId; // Store the customer ID in the hidden input
    quickPaymentTargetCustomerId = customerId; // Also store in global variable for saving phase

    savePaymentBtn.disabled = false;
    savePaymentBtn.innerHTML = '<i class="fas fa-save"></i> Save Payment'; // Reset button text
    addPaymentModal.classList.add('active'); // Show the modal
}

// --- Function to close the Quick Payment modal ---
function closeAddPaymentModal() {
    if (addPaymentModal) {
         addPaymentModal.classList.remove('active');
    }
     quickPaymentTargetCustomerId = null; // Clear stored ID when closing
     isQuickPaymentMode = false; // Ensure flag is reset if modal is closed manually
     if(orderIdSearchInput) {
        orderIdSearchInput.placeholder = "Search Order ID / Customer / LIC..."; // Reset placeholder
        // orderIdSearchInput.value = ''; // Optionally clear search input
     }
     clearSuggestions(); // Hide any lingering suggestions
}

// --- Function to save the Quick Payment ---
async function handleSavePayment(event) {
    event.preventDefault();
     // Ensure Firestore functions are available (should be imported at the top)
    if (!db || !addDoc || !collection || !Timestamp) {
        alert("Database functions are not available. Cannot save payment.");
        console.error("Firestore functions (db, addDoc, collection, Timestamp) missing.");
        return;
    }

    // Get customer ID from the stored variable (set when modal opened)
    const customerId = quickPaymentTargetCustomerId || quickPaymentCustomerIdInput.value;

    if (!customerId) {
         alert("Customer ID missing. Cannot save payment.");
         console.error("Customer ID not found for saving payment.");
         return;
     }

    // Get form values (ensure elements exist)
    const amount = paymentAmountInput ? parseFloat(paymentAmountInput.value) : NaN;
    const date = paymentDateInput ? paymentDateInput.value : null;
    const method = paymentMethodSelect ? paymentMethodSelect.value : 'Other';
    const notes = paymentNotesInput ? paymentNotesInput.value.trim() : '';

    if (isNaN(amount) || amount <= 0) { alert("Please enter a valid positive amount."); return; }
    if (!date) { alert("Please select a payment date."); return; }
    if (!savePaymentBtn) { console.error("Save button not found."); return; } // Check for save button


    savePaymentBtn.disabled = true;
    const originalHTML = savePaymentBtn.innerHTML;
    savePaymentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const paymentDateTimestamp = Timestamp.fromDate(new Date(date + 'T00:00:00')); // Ensure time is start of day
        const paymentData = {
            customerId: customerId, // Use the correct customer ID
            amountPaid: amount,
            paymentDate: paymentDateTimestamp,
            paymentMethod: method,
            notes: notes || null, // Store null if notes are empty
            createdAt: Timestamp.now() // Record when the payment was added
        };

        // Use addDoc with the 'payments' collection reference
        const docRef = await addDoc(collection(db, "payments"), paymentData);

        console.log("Quick Payment added successfully:", docRef.id, "for customer:", customerId);
        alert("Payment added successfully!");
        closeAddPaymentModal(); // Close modal on success

        // Refresh pending payments KPI if needed
        loadDashboardKPIs(); // Recalculate KPIs including pending payments


    } catch (error) {
        console.error("Error saving quick payment:", error);
        alert(`Error saving payment: ${error.message}`);
        // Re-enable button on error
        savePaymentBtn.disabled = false;
        savePaymentBtn.innerHTML = originalHTML;
    } finally {
        // Ensure button is re-enabled even if try block finishes without error but doesn't close modal
        if (!addPaymentModal || !addPaymentModal.classList.contains('active')) {
             // If modal is already closed, button state might be wrong
        } else if(savePaymentBtn) {
            savePaymentBtn.disabled = false;
            savePaymentBtn.innerHTML = originalHTML;
        }
        quickPaymentTargetCustomerId = null; // Clear stored ID after attempt
        isQuickPaymentMode = false; // Reset flag
        if(orderIdSearchInput) orderIdSearchInput.placeholder = "Search Order ID / Customer / LIC..."; // Reset placeholder
    }
}

// ==============================================================
// <<< END OF Quick Payment Functions >>>
// ==============================================================

console.log("dashboard.js (with Quick Payment) script loaded."); // Log message updated