// js/dashboard.js (Updated Structure)

// Ensure Firebase functions are globally available
const {
    db, auth, collection, onSnapshot, query, where, getDocs, limit, orderBy, Timestamp, signOut
} = window;

// --- DOM Elements ---
const countElements = { /* ... पहले जैसा ... */ };
const orderIdSearchInput = document.getElementById('order-id-search');
const orderIdSearchButton = document.getElementById('order-id-search-button');
const suggestionsContainer = document.getElementById('order-suggestions');
const welcomeUserSpan = document.getElementById('welcome-user'); // Welcome message
const dateTimeSpan = document.getElementById('currentDateTime'); // Date/Time display
const logoutLink = document.getElementById('logout-link'); // Logout link

// New KPI Elements
const kpiTotalCustomers = document.getElementById('kpi-total-customers');
const kpiTotalSuppliers = document.getElementById('kpi-total-suppliers');
const kpiPendingPayments = document.getElementById('kpi-pending-payments');
const kpiOrdersToday = document.getElementById('kpi-orders-today');

// New Info Feed & Reminder Elements
const recentActivityList = document.getElementById('recent-activity-list');
const licReminderList = document.getElementById('lic-reminder-list');
const upcomingTaskList = document.getElementById('upcoming-task-list');
const upcomingDeliveryList = document.getElementById('upcoming-delivery-list');

// Chart Element (Optional)
const orderStatusChartCanvas = document.getElementById('orderStatusChart');
let orderChartInstance = null; // To hold the chart object

// Global state
let suggestionDebounceTimer;
let dateTimeIntervalId = null;
let userRole = null; // Store user role

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DEBUG] Dashboard DOM Loaded. Initializing...");
    waitForDbConnection(() => {
        console.log("[DEBUG] DB connection confirmed.");
        setupEventListeners(); // Setup all listeners first
        listenForOrderCounts(); // Start listening for order counts
        loadDashboardKPIs(); // Load initial KPIs
        loadRecentActivity(); // Load initial activity feed
        loadRemindersAndTasks(); // Load reminders/tasks
        // Chart initialization depends on counts being loaded first
    });
});

// --- DB Connection Wait ---
function waitForDbConnection(callback) {
    // ... (पहले जैसा) ...
    if (window.db) { callback(); }
    else { let a=0, m=20, i=setInterval(()=>{ a++; if(window.db){ clearInterval(i); callback(); } else if(a>=m){ clearInterval(i); console.error("DB timeout"); /*...*/ }}, 250); }
}

// --- Setup Event Listeners ---
function setupEventListeners() {
    if (orderIdSearchInput) {
        orderIdSearchInput.addEventListener('input', handleSearchInput);
        orderIdSearchInput.addEventListener('blur', () => setTimeout(clearSuggestions, 150));
    }
    if (orderIdSearchButton) orderIdSearchButton.addEventListener('click', triggerSearch);
    if (logoutLink) logoutLink.addEventListener('click', handleLogout);
    // Add listeners for new buttons if needed (e.g., #quickAddPaymentBtn)

    // Start Date/Time Update
    startDateTimeUpdate();

    console.log("[DEBUG] Dashboard event listeners set up.");
}

// --- Date/Time Update (Moved from inline script) ---
function updateDateTime() {
    if (!dateTimeSpan) return;
    const now = new Date();
    const optsDate = { year: 'numeric', month: 'short', day: 'numeric' };
    const optsTime = { hour: 'numeric', minute: '2-digit', hour12: true };
    const optsDay = { weekday: 'long' };
    try {
        const date = now.toLocaleDateString('en-IN', optsDate); // Use Indian locale
        const day = now.toLocaleDateString('en-IN', optsDay);
        const time = now.toLocaleTimeString('en-US', optsTime); // US locale for AM/PM
        dateTimeSpan.textContent = `${date} | ${day} | ${time}`;
        dateTimeSpan.classList.remove('loading-placeholder'); // Remove placeholder class
    } catch (e) {
        console.error("Error formatting date/time:", e);
        dateTimeSpan.textContent = 'Error loading time';
        dateTimeSpan.classList.remove('loading-placeholder');
    }
}

function startDateTimeUpdate() {
    if (dateTimeIntervalId) clearInterval(dateTimeIntervalId); // Clear existing interval
    updateDateTime(); // Update immediately
    dateTimeIntervalId = setInterval(updateDateTime, 10000); // Update every 10 seconds
}

// --- Authentication Handling (Include Role Check if needed) ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Fetch and display user role
        user.getIdTokenResult(true).then((idTokenResult) => {
            userRole = idTokenResult.claims.role || 'Standard'; // Get role, default to Standard
            if (welcomeUserSpan) {
                welcomeUserSpan.textContent = `Welcome ${user.email || 'User'} (${userRole})`;
            }
        }).catch(error => {
            console.error('Error getting user role:', error);
            if (welcomeUserSpan) {
                welcomeUserSpan.textContent = `Welcome ${user.email || 'User'} (Role Error)`;
            }
        });
    } else {
        // Not logged in, redirect handled in index.html script
        if (welcomeUserSpan) welcomeUserSpan.textContent = 'Not Logged In';
    }
});

// --- Logout Handler ---
function handleLogout(e) {
    e.preventDefault();
    if (confirm("Are you sure you want to logout?")) {
        signOut(auth).then(() => {
            console.log('User signed out.');
            window.location.href = 'login.html'; // Redirect to login
        }).catch((error) => {
            console.error('Sign out error:', error);
            alert("Logout failed.");
        });
    }
}

// --- Loading Indicators ---
function showLoading(element, type = 'text') {
    if (!element) return;
    if (type === 'spinner') {
        element.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 0.8em; color: #aaa;"></i>';
    } else if (type === 'list') {
         element.innerHTML = '<li class="loading-placeholder">Loading...</li>';
    }
     else {
        element.innerHTML = '<span class="loading-placeholder">...</span>';
    }
}

// --- Dashboard Counts ---
function updateDashboardCounts(orders) {
    const statusCounts = { /* ... पहले जैसा ... */ };
    orders.forEach(order => { /* ... पहले जैसा ... */ });
    for (const status in countElements) {
        if (countElements[status]) {
            const count = statusCounts[status] || 0;
            countElements[status].textContent = count.toString().padStart(2, '0');
        }
    }
    // Initialize or update chart after counts are available
    initializeOrUpdateChart(statusCounts);
}

function listenForOrderCounts() {
    // ... (पहले जैसा, लेकिन शुरुआत में लोडिंग दिखाएं) ...
    Object.values(countElements).forEach(el => showLoading(el)); // Show loading initially
    const ordersRef = collection(db, "orders");
    const q = query(ordersRef); // Query all orders for counts
    onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateDashboardCounts(orders); // Update counts and potentially the chart
    }, (error) => { console.error("[DEBUG] Error listening to order counts:", error); Object.values(countElements).forEach(el => { if(el) el.textContent = 'Err'; }); });
}

// --- NEW: Load KPIs ---
async function loadDashboardKPIs() {
    // Total Customers
    showLoading(kpiTotalCustomers);
    try {
        const custSnapshot = await getDocs(collection(db, "customers"));
        if(kpiTotalCustomers) kpiTotalCustomers.textContent = custSnapshot.size;
    } catch (e) { console.error("Error fetching customer count:", e); if(kpiTotalCustomers) kpiTotalCustomers.textContent = 'Err'; }

    // Total Suppliers
    showLoading(kpiTotalSuppliers);
     try {
        const suppSnapshot = await getDocs(collection(db, "suppliers"));
        if(kpiTotalSuppliers) kpiTotalSuppliers.textContent = suppSnapshot.size;
    } catch (e) { console.error("Error fetching supplier count:", e); if(kpiTotalSuppliers) kpiTotalSuppliers.textContent = 'Err'; }

    // Orders Today
    showLoading(kpiOrdersToday);
    try {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
        const q = query(collection(db, "orders"),
                      where('createdAt', '>=', Timestamp.fromDate(todayStart)),
                      where('createdAt', '<=', Timestamp.fromDate(todayEnd)));
        const todaySnapshot = await getDocs(q);
         if(kpiOrdersToday) kpiOrdersToday.textContent = todaySnapshot.size;
    } catch (e) { console.error("Error fetching orders today count:", e); if(kpiOrdersToday) kpiOrdersToday.textContent = 'Err'; }

    // Pending Payments (Complex - Example Placeholder)
    showLoading(kpiPendingPayments);
     // **** Placeholder Logic: Requires fetching all orders and payments or a dedicated balance field ****
     // This is a simplified example. Real implementation needs careful calculation.
     setTimeout(() => { if(kpiPendingPayments) kpiPendingPayments.textContent = '₹ ...'; }, 500); // Simulate loading
     console.warn("Pending Payments KPI needs proper calculation logic.");
}

// --- NEW: Load Recent Activity ---
async function loadRecentActivity() {
    if (!recentActivityList) return;
    showLoading(recentActivityList, 'list');
    try {
        // Get latest 5 updated/created orders
        const q = query(collection(db, "orders"), orderBy('updatedAt', 'desc'), limit(5));
        const snapshot = await getDocs(q);
        recentActivityList.innerHTML = ''; // Clear loading/previous
        if (snapshot.empty) {
            recentActivityList.innerHTML = '<li>No recent activity.</li>';
        } else {
            snapshot.forEach(doc => {
                const order = doc.data();
                const li = document.createElement('li');
                const orderId = order.orderId || `Sys:${doc.id.substring(0,6)}`;
                const custName = order.customerDetails?.fullName || 'Unknown';
                const status = order.status || 'N/A';
                const time = order.updatedAt?.toDate ? formatTimeAgo(order.updatedAt.toDate()) : 'recent'; // Helper needed

                li.innerHTML = `
                    <span>Order <strong>${orderId}</strong> (${custName}) status: ${status}</span>
                    <span class="activity-time">${time}</span>
                `;
                // Optional: Make the item clickable to view order details
                 li.style.cursor = 'pointer';
                 li.onclick = () => { /* Navigate to order details or open modal */ window.location.href = `order_history.html?openModalForId=${doc.id}`; };
                recentActivityList.appendChild(li);
            });
        }
    } catch (e) {
        console.error("Error fetching recent activity:", e);
        if(recentActivityList) recentActivityList.innerHTML = '<li>Error loading activity.</li>';
    }
}

// --- NEW: Load Reminders & Tasks ---
async function loadRemindersAndTasks() {
    // Load LIC Reminders
    if (licReminderList) {
        showLoading(licReminderList, 'list');
        try {
            // **** Placeholder: Query 'licCustomers' collection for upcoming due dates ****
             // Example: Find policies where nextInstallmentDate is within 15 days
             // const qLic = query(collection(db, "licCustomers"), where(...), limit(5));
             // const licSnapshot = await getDocs(qLic);
             // Render results in licReminderList
             setTimeout(() => { // Simulate fetch
                licReminderList.innerHTML = '<li>LIC Reminder 1 - Due Soon</li><li>LIC Reminder 2 - Due Next Week</li>';
             }, 1200);
             console.warn("LIC Reminder section needs Firestore query implementation.");
        } catch (e) { console.error("Error fetching LIC reminders:", e); if(licReminderList) licReminderList.innerHTML = '<li>Error loading LIC reminders.</li>'; }
    }

    // Load Upcoming Tasks
    if (upcomingTaskList) {
         showLoading(upcomingTaskList, 'list');
         try {
            // **** Placeholder: Query 'tasks' collection for pending tasks due soon ****
             // Example: Find tasks where completed is false and dueDate is within 7 days
             // const qTask = query(collection(db, "tasks"), where('completed', '==', false), where(...), limit(5));
             // const taskSnapshot = await getDocs(qTask);
             // Render results in upcomingTaskList
             setTimeout(() => { // Simulate fetch
                upcomingTaskList.innerHTML = '<li>Task 1 - Due Today</li><li>Task 2 - Due Tomorrow</li>';
             }, 1400);
             console.warn("Upcoming Tasks section needs Firestore query implementation.");
         } catch (e) { console.error("Error fetching upcoming tasks:", e); if(upcomingTaskList) upcomingTaskList.innerHTML = '<li>Error loading tasks.</li>'; }
    }

    // Load Upcoming Deliveries
    if (upcomingDeliveryList) {
        showLoading(upcomingDeliveryList, 'list');
        try {
            // **** Placeholder: Query 'orders' collection for upcoming delivery dates ****
            const threeDaysLater = new Date(); threeDaysLater.setDate(threeDaysLater.getDate() + 3); threeDaysLater.setHours(23, 59, 59, 999);
            const todayStart = new Date(); todayStart.setHours(0,0,0,0);

            const qDel = query(collection(db, "orders"),
                             where('deliveryDate', '>=', Timestamp.fromDate(todayStart)),
                             where('deliveryDate', '<=', Timestamp.fromDate(threeDaysLater)),
                             orderBy('deliveryDate', 'asc'),
                             limit(5));
             const delSnapshot = await getDocs(qDel);
             upcomingDeliveryList.innerHTML = '';
             if(delSnapshot.empty) {
                  upcomingDeliveryList.innerHTML = '<li>No deliveries due soon.</li>';
             } else {
                  delSnapshot.forEach(doc => {
                       const order = doc.data();
                       const li = document.createElement('li');
                       li.innerHTML = `Order <strong>${order.orderId || 'N/A'}</strong> (${order.customerDetails?.fullName || '?'}) - Due: ${order.deliveryDate.toDate().toLocaleDateString('en-GB')}`;
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
    // ... (पहले जैसा, लेकिन सजेशन में ग्राहक का नाम शामिल करें) ...
     if (!suggestionsContainer || !db || !collection || !query || !where || !limit || !getDocs) { console.error("Search suggestion prerequisites missing."); return; }
    if (!searchTerm) { clearSuggestions(); return; }
    try {
        const ordersRef = collection(db, "orders");
        // Example: Search by Order ID (add other fields like customer name later)
        const q = query(ordersRef, where('orderId', '>=', searchTerm), where('orderId', '<=', searchTerm + '\uf8ff'), limit(10));
        const querySnapshot = await getDocs(q);
        suggestionsContainer.innerHTML = ''; // Clear previous
        if (querySnapshot.empty) { suggestionsContainer.innerHTML = '<div class="no-suggestions">No matching orders found.</div>'; }
        else {
            querySnapshot.forEach((doc) => {
                const order = { id: doc.id, ...doc.data() };
                const suggestionDiv = document.createElement('div');
                // <<< सुधार: ग्राहक का नाम शामिल करें >>>
                const displayName = `${order.orderId || 'N/A'} - ${order.customerDetails?.fullName || 'Unknown Cust.'}`;
                suggestionDiv.textContent = displayName;
                suggestionDiv.setAttribute('data-firestore-id', order.id);
                suggestionDiv.addEventListener('mousedown', (e) => { e.preventDefault(); window.location.href = `order_history.html?openModalForId=${order.id}`; clearSuggestions(); });
                suggestionsContainer.appendChild(suggestionDiv);
            });
        }
        suggestionsContainer.style.display = 'block';
    } catch (error) { console.error("Error fetching suggestions:", error); suggestionsContainer.innerHTML = '<div class="no-suggestions">Error fetching.</div>'; suggestionsContainer.style.display = 'block'; }
}

// --- NEW: Chart Functions (Using Chart.js) ---
function initializeOrUpdateChart(statusCounts) {
    if (!orderStatusChartCanvas) {
        // console.warn("Chart canvas not found.");
        return; // Don't proceed if canvas doesn't exist
    }
     if (!window.Chart) {
        console.warn("Chart.js library not loaded. Cannot create chart.");
        // Optionally display a message in the chart area
        const ctx = orderStatusChartCanvas.getContext('2d');
        ctx.clearRect(0, 0, orderStatusChartCanvas.width, orderStatusChartCanvas.height); // Clear canvas
        ctx.fillStyle = '#6c757d'; // Muted text color
        ctx.textAlign = 'center';
        ctx.fillText('Chart library not available.', orderStatusChartCanvas.width / 2, orderStatusChartCanvas.height / 2);
        return;
    }

    const labels = Object.keys(statusCounts);
    const data = Object.values(statusCounts);

    // Define consistent colors for statuses (optional but recommended)
    const backgroundColors = labels.map(label => {
        switch(label) {
            case "Order Received": return 'rgba(108, 117, 125, 0.7)'; // Secondary
            case "Designing": return 'rgba(255, 193, 7, 0.7)';     // Warning
            case "Verification": return 'rgba(253, 126, 20, 0.7)';   // Orange
            case "Design Approved": return 'rgba(32, 201, 151, 0.7)'; // Teal
            case "Printing": return 'rgba(23, 162, 184, 0.7)';    // Info
            case "Ready for Working": return 'rgba(111, 66, 193, 0.7)'; // Purple
            case "Delivered": return 'rgba(13, 202, 240, 0.7)';    // Cyan
            case "Completed": return 'rgba(40, 167, 69, 0.7)';    // Success
            default: return 'rgba(200, 200, 200, 0.7)';          // Default Grey
        }
    });
     const borderColors = backgroundColors.map(color => color.replace('0.7', '1')); // Make borders solid

    const chartData = {
        labels: labels,
        datasets: [{
            label: 'Order Count',
            data: data,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 1
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom', // Position legend at the bottom
                 labels: { boxWidth: 12, padding: 15, font: { size: 10 } }
            },
            tooltip: {
                callbacks: { label: function(context) { let label = context.dataset.label || ''; if (label) { label += ': '; } if (context.parsed !== null) { label += context.parsed; } return label; } }
            },
            title: { display: false } // Title is in the card header
        },
        // Consider adding options for pie/doughnut chart if preferred
         // cutout: '50%', // For doughnut chart
    };

    // Destroy existing chart before creating a new one
    if (orderChartInstance) { orderChartInstance.destroy(); }

    // Create the chart
    try {
        orderChartInstance = new Chart(orderStatusChartCanvas, {
            type: 'doughnut', // Or 'pie', 'bar'
            data: chartData,
            options: chartOptions
        });
        console.log("[DEBUG] Chart initialized/updated.");
    } catch (e) {
        console.error("Error creating chart:", e);
         // Display error on canvas
         const ctx = orderStatusChartCanvas.getContext('2d');
         ctx.clearRect(0, 0, orderStatusChartCanvas.width, orderStatusChartCanvas.height);
         ctx.fillStyle = '#dc3545'; // Error color
         ctx.textAlign = 'center';
         ctx.fillText('Error creating chart.', orderStatusChartCanvas.width / 2, orderStatusChartCanvas.height / 2);
    }
}

// --- Helper Function: Time Ago (Example) ---
function formatTimeAgo(date) {
  if (!(date instanceof Date)) return '';
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return Math.floor(seconds) < 5 ? "just now" : Math.floor(seconds) + " seconds ago";
}