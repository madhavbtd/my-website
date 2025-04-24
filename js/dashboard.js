// js/dashboard.js

// Ensure Firebase functions are available from the inline script in index.html
// Destructuring assignment for clarity
const {
    db, collection, onSnapshot, query, where, getDocs, limit, // Firestore functions
} = window;

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

// *** NEW: Order ID Search Elements ***
const orderIdSearchInput = document.getElementById('order-id-search');
const orderIdSearchButton = document.getElementById('order-id-search-button'); // Assuming you keep a button, though search might trigger on input
const suggestionsContainer = document.getElementById('order-suggestions');
let suggestionDebounceTimer; // Timer for debouncing input

// --- Function to Update Dashboard Counts ---
function updateDashboardCounts(orders) {
    // This function remains the same as before
    const statusCounts = { "Order Received": 0, "Designing": 0, "Verification": 0, "Design Approved": 0, "Ready for Working": 0, "Printing": 0, "Delivered": 0, "Completed": 0 };
    orders.forEach(order => {
        const status = order.status;
        if (status && statusCounts.hasOwnProperty(status)) { statusCounts[status]++; }
        // else if (status) { console.warn(`[DEBUG] Unknown status found: ${status}`); } // Optional warning
    });
    for (const status in countElements) {
        if (countElements[status]) {
            const count = statusCounts[status] || 0;
            countElements[status].textContent = count.toString().padStart(2, '0');
        }
    }
}

// --- Firestore Listener for Order Counts ---
function listenForOrderCounts() {
    // This function remains the same - listens for ALL orders to update counts
    if (!db || !collection || !query || !onSnapshot) { console.error("Firestore functions (counts) missing."); /*...*/ return; }
    try {
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef);
        console.log("[DEBUG] Setting up real-time listener for order counts...");
        const unsubscribe = onSnapshot(q, (snapshot) => {
            // console.log(`[DEBUG] Counts snapshot received with ${snapshot.size} documents.`);
            const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateDashboardCounts(orders);
        }, (error) => { console.error("[DEBUG] Error listening to order counts:", error); /*...*/ });
    } catch (error) { console.error("[DEBUG] Error setting up counts listener:", error); /*...*/ }
}


// --- *** NEW: Order ID Search Functionality *** ---

// Function to fetch and display order ID suggestions
async function fetchAndDisplaySuggestions(searchTerm) {
    if (!suggestionsContainer || !db || !collection || !query || !where || !limit || !getDocs) {
        console.error("Search suggestion prerequisites missing.");
        return;
    }

    if (!searchTerm) {
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.style.display = 'none';
        return;
    }

    try {
        console.log(`[DEBUG] Searching for Order IDs starting with: ${searchTerm}`);
        // Query using the 'orderId' field confirmed from screenshot
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef,
                        where('orderId', '>=', searchTerm),
                        where('orderId', '<=', searchTerm + '\uf8ff'), // Firestore "starts with" trick
                        limit(10) // Limit results for performance
                       );

        const querySnapshot = await getDocs(q);
        suggestionsContainer.innerHTML = ''; // Clear previous suggestions

        if (querySnapshot.empty) {
            suggestionsContainer.innerHTML = '<div class="no-suggestions">No matching Order IDs found.</div>';
            suggestionsContainer.style.display = 'block';
        } else {
            querySnapshot.forEach((doc) => {
                const order = { id: doc.id, ...doc.data() };
                const suggestionDiv = document.createElement('div');
                suggestionDiv.textContent = order.orderId || `(Sys ID: ${order.id.substring(0,6)}...)`; // Display orderId
                suggestionDiv.setAttribute('data-firestore-id', order.id); // Store Firestore ID
                suggestionDiv.addEventListener('mousedown', (e) => { // Use mousedown to fire before blur
                    e.preventDefault(); // Prevent input blur before click registers
                    console.log(`Suggestion clicked: Firestore ID ${order.id}`);
                    // Redirect to order_history page with parameter to open modal
                    window.location.href = `order_history.html?openModalForId=${order.id}`;
                     clearSuggestions(); // Clear suggestions after click
                });
                suggestionsContainer.appendChild(suggestionDiv);
            });
            suggestionsContainer.style.display = 'block'; // Show suggestions
        }

    } catch (error) {
        console.error("Error fetching order suggestions:", error);
        suggestionsContainer.innerHTML = '<div class="no-suggestions">Error fetching suggestions.</div>';
        suggestionsContainer.style.display = 'block';
    }
}

// Function to clear suggestions
function clearSuggestions() {
    if(suggestionsContainer) {
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.style.display = 'none';
    }
}

// Event listener for the search input field
function setupOrderIdSearch() {
    if (orderIdSearchInput && suggestionsContainer) {
        orderIdSearchInput.addEventListener('input', () => {
            clearTimeout(suggestionDebounceTimer);
            const searchTerm = orderIdSearchInput.value.trim();
            if (searchTerm.length > 0) { // Only search if input is not empty
                 // Debounce: wait 300ms after user stops typing
                suggestionDebounceTimer = setTimeout(() => {
                    fetchAndDisplaySuggestions(searchTerm);
                }, 300);
            } else {
                clearSuggestions(); // Clear if input is emptied
            }
        });

        // Hide suggestions when clicking outside
         orderIdSearchInput.addEventListener('blur', () => {
             // Delay hiding to allow suggestion clicks
             setTimeout(clearSuggestions, 150);
         });

        // Optional: Handle search button click (might just trigger search for current input)
        if (orderIdSearchButton) {
            orderIdSearchButton.addEventListener('click', () => {
                const searchTerm = orderIdSearchInput.value.trim();
                fetchAndDisplaySuggestions(searchTerm); // Fetch immediately on button click
            });
        }

        console.log("[DEBUG] Order ID search listeners added.");

    } else {
        console.warn("[DEBUG] Order ID search input or suggestions container not found.");
    }
}


// --- Initial Setup ---
function waitForDbConnection(callback) {
    // This function remains the same
    if (window.db) { callback(); }
    else { let a=0, m=20, i=setInterval(()=>{ a++; if(window.db){ clearInterval(i); callback(); } else if(a>=m){ clearInterval(i); console.error("DB timeout"); /*...*/ }}, 250); }
}

// --- Run Setup ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DEBUG] DOM fully loaded (dashboard.js).");
    // 1. Setup the new Order ID search functionality
    setupOrderIdSearch();
    // 2. Wait for DB connection and then setup Firestore listener for counts
    console.log("[DEBUG] Waiting for DB connection to setup count listeners...");
    waitForDbConnection(listenForOrderCounts); // Renamed function for clarity
});

console.log("dashboard.js loaded and executing.");