// js/dashboard.js

// Ensure Firebase functions are available from the inline script in HTML
const { db, collection, onSnapshot, query } = window;

// --- DOM Elements for Counts ---
// Get references to the span elements where counts will be displayed
const countElements = {
    "Order Received": document.getElementById('count-order-received'),
    "Designing": document.getElementById('count-designing'),
    "Verification": document.getElementById('count-verification'),
    "Design Approved": document.getElementById('count-design-approved'),
    "Ready for Working": document.getElementById('count-ready-for-working'),
    "Printing": document.getElementById('count-printing'),
    "Delivered": document.getElementById('count-delivered'),
    "Completed": document.getElementById('count-completed')
    // Add more if you have other status panels
};

// --- Function to Update Counts ---
function updateDashboardCounts(orders) {
    console.log(`[DEBUG] Updating counts for ${orders.length} orders.`);

    // Initialize counts for all known statuses
    const statusCounts = {
        "Order Received": 0,
        "Designing": 0,
        "Verification": 0,
        "Design Approved": 0,
        "Ready for Working": 0,
        "Printing": 0,
        "Delivered": 0,
        "Completed": 0
        // Add other statuses here if needed
    };

    // Count orders by status
    orders.forEach(order => {
        const status = order.status; // Assuming 'status' field exists in your order data
        if (status && statusCounts.hasOwnProperty(status)) {
            statusCounts[status]++;
        } else if (status) {
             console.warn(`[DEBUG] Unknown status found in order ${order.id}: ${status}`);
        }
    });

    // Update the HTML elements
    for (const status in countElements) {
        if (countElements[status]) {
            const count = statusCounts[status] || 0;
            // Format count with leading zero (e.g., 01, 05, 10)
            countElements[status].textContent = count.toString().padStart(2, '0');
        } else {
            console.warn(`[DEBUG] Count element not found for status: ${status}`);
        }
    }
     console.log("[DEBUG] Dashboard counts updated:", statusCounts);
}


// --- Firestore Listener for Orders ---
function listenForOrderUpdates() {
    // Check if required Firestore functions are available
    if (!db || !collection || !query || !onSnapshot) {
        console.error("Firestore functions not available for dashboard listener.");
        // Optionally display an error message on the dashboard itself
        Object.values(countElements).forEach(el => { if(el) el.textContent = "DB?"; });
        return;
    }

    const ordersRef = collection(db, "orders");
    const q = query(ordersRef); // Query to get all orders

    console.log("[DEBUG] Setting up real-time listener for order counts...");

    // Listen for real-time updates
    const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log(`[DEBUG] Snapshot received with ${snapshot.size} documents.`);
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateDashboardCounts(orders); // Update counts whenever data changes
    }, (error) => {
        console.error("[DEBUG] Error listening to order updates:", error);
        // Display error state in counts
         Object.values(countElements).forEach(el => { if(el) el.textContent = "Err"; });
    });

    // Note: You might want to store 'unsubscribe' somewhere if you need to stop listening later.
    // For a dashboard that's always open, it might not be necessary.
}

// --- Initial Setup ---
// Wait for DB connection before starting listener
function waitForDbConnection(callback) {
    if (window.db) {
        console.log("[DEBUG] DB connection confirmed immediately (dashboard.js).");
        callback();
    } else {
        let attempts = 0; const maxAttempts = 20;
        const intervalId = setInterval(() => {
            attempts++;
            if (window.db) { clearInterval(intervalId); console.log("[DEBUG] DB connection confirmed after check (dashboard.js)."); callback(); }
            else if (attempts >= maxAttempts) { clearInterval(intervalId); console.error("DB connection timeout (dashboard.js)."); alert("Dashboard could not connect to database."); }
        }, 250);
    }
}

// Start the listener after DB connection is confirmed
waitForDbConnection(listenForOrderUpdates);

console.log("dashboard.js loaded.");