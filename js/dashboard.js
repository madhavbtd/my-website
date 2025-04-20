// js/dashboard.js

// Ensure Firebase functions are available from the inline script in HTML
// Using optional chaining just in case window object is not fully ready, though unlikely
const db = window?.db;
const collection = window?.collection;
const onSnapshot = window?.onSnapshot;
const query = window?.query;

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
const customerSearchInput = document.getElementById('customer-search');
const customerSearchButton = document.getElementById('customer-search-button');


// --- Function to Update Dashboard Counts ---
function updateDashboardCounts(orders) {
    // console.log(`[DEBUG] Updating counts for ${orders.length} orders.`);
    const statusCounts = {
        "Order Received": 0, "Designing": 0, "Verification": 0,
        "Design Approved": 0, "Ready for Working": 0, "Printing": 0,
        "Delivered": 0, "Completed": 0
    };

    orders.forEach(order => {
        const status = order.status;
        if (status && statusCounts.hasOwnProperty(status)) {
            statusCounts[status]++;
        } else if (status) {
             console.warn(`[DEBUG] Unknown order status found: ${status}`);
        }
    });

    // Update HTML elements
    for (const status in countElements) {
        if (countElements[status]) {
            const count = statusCounts[status] || 0;
            // Ensure element exists before setting textContent
            countElements[status].textContent = count.toString().padStart(2, '0');
        } else {
            console.warn(`[DEBUG] Count element for status "${status}" not found.`);
        }
    }
    // console.log("[DEBUG] Dashboard counts updated:", statusCounts);
}


// --- Firestore Listener for Order Updates ---
function listenForOrderUpdates() {
    // Check if essential Firestore functions are available
    if (!db || !collection || !query || !onSnapshot) {
        console.error("Firestore functions not available for dashboard listener. Cannot fetch counts.");
        // Update UI to show error state for counts
        Object.values(countElements).forEach(el => { if(el) el.textContent = "DB?"; });
        return; // Stop execution if DB connection is not ready
    }

    try {
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef); // Get all orders for counting

        console.log("[DEBUG] Setting up real-time listener for order counts...");
        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log(`[DEBUG] Order snapshot received with ${snapshot.size} documents.`);
            const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateDashboardCounts(orders); // Update counts whenever data changes
        }, (error) => {
            console.error("[DEBUG] Error listening to order updates:", error);
             // Update UI to show error state for counts
             Object.values(countElements).forEach(el => { if(el) el.textContent = "Err"; });
        });

        // Optional: Store unsubscribe function if needed for cleanup later
        // window.unsubscribeDashboardOrders = unsubscribe;

    } catch (error) {
        console.error("[DEBUG] Error setting up Firestore listener:", error);
        Object.values(countElements).forEach(el => { if(el) el.textContent = "Err"; });
    }
}

// --- Customer Search Functionality ---
function handleCustomerSearch() {
    if (!customerSearchInput) {
        console.error("Customer search input element not found.");
        return;
    }
    const searchTerm = customerSearchInput.value.trim();
    if (searchTerm) {
        // Redirect to customer management page with search query parameter
        // Encode the search term to handle special characters in the URL
        window.location.href = `customer_management.html?search=${encodeURIComponent(searchTerm)}`;
    } else {
        // Optionally, provide feedback if search term is empty
        // alert("Please enter a customer name or ID to search.");
        // Or redirect to the main customer page without a search term
         window.location.href = `customer_management.html`;
    }
}

function setupSearch() {
    // Ensure search elements exist before adding listeners
    if (customerSearchButton && customerSearchInput) {
        customerSearchButton.addEventListener('click', handleCustomerSearch);

        // Optional: Allow searching by pressing Enter in the input field
        customerSearchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                handleCustomerSearch();
            }
        });
        console.log("[DEBUG] Customer search listeners added.");
    } else {
         console.warn("[DEBUG] Customer search button or input not found. Search disabled.");
    }
}


// --- Initial Setup ---
// Waits for the global 'db' object (set by index.html) to be available
function waitForDbConnection(callback) {
    if (window.db) {
        console.log("[DEBUG] DB connection confirmed immediately (dashboard.js).");
        callback(); // Run the callback (listenForOrderUpdates)
    } else {
        console.log("[DEBUG] DB connection not ready, starting polling (dashboard.js)...");
        let attempts = 0;
        const maxAttempts = 20; // Poll for 5 seconds (20 * 250ms)
        const intervalId = setInterval(() => {
            attempts++;
            if (window.db) {
                clearInterval(intervalId);
                console.log(`[DEBUG] DB connection confirmed after ${attempts} attempts (dashboard.js).`);
                callback(); // Run the callback
            } else if (attempts >= maxAttempts) {
                clearInterval(intervalId);
                console.error("DB connection timeout (dashboard.js). Dashboard counts might not load.");
                 // Update UI to show error state for counts
                 Object.values(countElements).forEach(el => { if(el) el.textContent = "DB?"; });
                // Optionally alert user, but console error might be sufficient
                // alert("Dashboard could not connect to the database to load counts.");
            }
        }, 250); // Check every 250ms
    }
}

// --- Run Setup ---
// 1. Wait for the DOM to be fully loaded to ensure all elements are available
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DEBUG] DOM fully loaded (dashboard.js). Setting up search.");
    // 2. Setup search functionality (doesn't require DB connection)
    setupSearch();
    // 3. Wait for DB connection and then setup Firestore listener
    console.log("[DEBUG] Waiting for DB connection to setup listeners...");
    waitForDbConnection(listenForOrderUpdates);
});


console.log("dashboard.js loaded and executing.");