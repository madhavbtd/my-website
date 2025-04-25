// js/dashboard.js (Revised Import & Structure + Updates)

// Import initialized db and auth from firebase-init.js
import { db, auth } from './firebase-init.js';

// Import necessary functions directly from the SDK
import { collection, onSnapshot, query, where, getDocs, limit, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- DOM Elements ---
// ... (पहले जैसा) ...
const countElements = { /* ... */ };
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
const kpiPendingPOs = document.getElementById('kpi-pending-pos');
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
// ... (पहले जैसा) ...
document.addEventListener('DOMContentLoaded', () => { /* ... */ });

// --- Setup Event Listeners ---
// ... (पहले जैसा) ...
function setupEventListeners() { /* ... */ }

// --- Date/Time Update ---
// ... (पहले जैसा) ...
function updateDateTime() { /* ... */ }
function startDateTimeUpdate() { /* ... */ }

// --- Authentication Handling ---
// ... (पहले जैसा) ...
function listenForAuthChanges() { /* ... */ }
function clearDashboardDataDisplay() { /* ... */ }
function initializeDashboardDataFetching() { /* ... */ }

// --- Logout Handler ---
// ... (पहले जैसा) ...
function handleLogout(e) { /* ... */ }

// --- Loading Indicators ---
// ... (पहले जैसा) ...
function showLoading(element, type = 'text') { /* ... */ }

// --- Dashboard Counts ---
// ... (पहले जैसा) ...
function updateDashboardCounts(orders) { /* ... */ }
function listenForOrderCounts() { /* ... */ }

// --- Load KPIs (Updated) ---
// ... (पहले जैसा) ...
async function loadDashboardKPIs() { /* ... */ }

// --- Load Recent Activity ---
// ... (पहले जैसा) ...
async function loadRecentActivity() { /* ... */ }

// --- Load Reminders & Tasks ---
// ... (पहले जैसा) ...
async function loadRemindersAndTasks() { /* ... */ }

// --- Order/Customer/LIC Search Functions (Updated) ---
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

        // --- Queries ---
        const queryPromises = [
            // Orders by ID
            getDocs(query(ordersRef, where('orderId', '>=', searchTerm), where('orderId', '<=', searchTerm + '\uf8ff'), limit(3))), // Query 0
            // Orders by Customer Name (Fetch more for client-side filter)
            getDocs(query(ordersRef, limit(20))), // Query 1
            // LIC Customers by Name (Fetch more for client-side filter - NO 'where' clause for name)
            getDocs(query(licCustomersRef, limit(25))), // Query 2 <<<--- Query Changed
            // LIC Customers by Policy Number
            getDocs(query(licCustomersRef, where('policyNumber', '>=', searchTerm), where('policyNumber', '<=', searchTerm + '\uf8ff'), limit(4))), // Query 3
            // Customers by Name (Fetch more for client-side filter)
            getDocs(query(customersRef, limit(25))) // Query 4
        ];

        // Execute all queries
        const results = await Promise.allSettled(queryPromises);

        let suggestions = [];
        const addedIds = { order: new Set(), lic: new Set(), customer: new Set() };

        // --- Process Results ---

        // Customers by Name (Query 4 Results - Client-side filter)
        if (results[4].status === 'fulfilled') {
            results[4].value.forEach((doc) => {
                const customer = { id: doc.id, ...doc.data(), type: 'CustomerProfile' };
                // Apply client-side filter using fullName
                if (customer.fullName && customer.fullName.toLowerCase().includes(searchLower)) {
                    if (!addedIds.customer.has(customer.id)) {
                        suggestions.push(customer);
                        addedIds.customer.add(customer.id);
                    }
                }
            });
        } else { console.error("Customer Profile query failed:", results[4].reason); }

        // LIC by Name (Query 2 Results - Client-side filter) <<<--- Logic Changed
        if (results[2].status === 'fulfilled') {
            results[2].value.forEach((doc) => {
                const licCustomer = { id: doc.id, ...doc.data(), type: 'LIC' };
                // Apply client-side filter using customerName
                 if (licCustomer.customerName && licCustomer.customerName.toLowerCase().includes(searchLower)) { // <<<--- Client-side check
                     if (!addedIds.lic.has(licCustomer.id)) {
                         suggestions.push(licCustomer);
                         addedIds.lic.add(licCustomer.id);
                    }
                 }
            });
        } else { console.error("LIC by Name query failed:", results[2].reason); }

         // LIC by Policy No (Query 3 Results)
         if (results[3].status === 'fulfilled') {
            results[3].value.forEach((doc) => {
                 const licCustomer = { id: doc.id, ...doc.data(), type: 'LIC' };
                 if (!addedIds.lic.has(licCustomer.id)) { // Avoid duplicates
                     suggestions.push(licCustomer);
                     addedIds.lic.add(licCustomer.id);
                }
            });
        } else { console.error("LIC by Policy No query failed:", results[3].reason); }

        // Orders by ID (Query 0 Results)
        if (results[0].status === 'fulfilled') {
            results[0].value.forEach((doc) => {
                const order = { id: doc.id, ...doc.data(), type: 'Order' };
                if (!addedIds.order.has(order.id)) {
                    suggestions.push(order);
                    addedIds.order.add(order.id);
                }
            });
        } else { console.error("Order by ID query failed:", results[0].reason); }

        // Orders by Customer Name (Query 1 Results - Client-side filter)
        if (results[1].status === 'fulfilled') {
            results[1].value.forEach((doc) => {
                const order = { id: doc.id, ...doc.data(), type: 'Order' };
                if (order.customerDetails?.fullName?.toLowerCase().includes(searchLower)) {
                     if (!addedIds.order.has(order.id)) {
                         suggestions.push(order);
                         addedIds.order.add(order.id);
                    }
                }
            });
        } else { console.error("Order by Name query failed:", results[1].reason); }


        // --- Render Suggestions (unchanged) ---
        suggestions = suggestions.slice(0, 10);
        suggestionsContainer.innerHTML = '';

        if (suggestions.length === 0) {
            suggestionsContainer.innerHTML = '<div class="suggestion-item no-suggestions">कोई मिलान नहीं मिला।</div>';
        } else {
            suggestions.forEach((item) => {
                const suggestionDiv = document.createElement('div');
                suggestionDiv.classList.add('suggestion-item');
                let iconClass = 'fas fa-question-circle';
                let displayName = 'Unknown Item';
                let destinationUrl = '#';
                let actionType = 'none';

                if (item.type === 'CustomerProfile') {
                    iconClass = 'fas fa-user';
                    displayName = `Customer: ${item.fullName || 'N/A'} (${item.whatsappNo || item.contactNo || 'No Contact'})`;
                    destinationUrl = `customer_account_detail.html?id=${item.id}`;
                    actionType = 'navigate';
                } else if (item.type === 'LIC') {
                    iconClass = 'fas fa-shield-alt';
                    displayName = `LIC: ${item.customerName || 'N/A'} (Policy: ${item.policyNumber || 'N/A'})`;
                    destinationUrl = `lic_management.html?openClientDetail=${item.id}`;
                    actionType = 'navigate';
                } else if (item.type === 'Order') {
                    iconClass = 'fas fa-receipt';
                    displayName = `Order: ${item.orderId || 'N/A'} (${item.customerDetails?.fullName || 'Unknown'}) - ${item.status || 'N/A'}`;
                    destinationUrl = `order_history.html?openModalForId=${item.id}`;
                    actionType = 'navigate';
                }

                suggestionDiv.innerHTML = `<i class="${iconClass}" style="margin-right: 8px; color: #555; width: 16px; text-align: center;"></i> ${displayName}`;
                suggestionDiv.setAttribute('data-firestore-id', item.id);
                suggestionDiv.setAttribute('data-type', item.type);
                suggestionDiv.setAttribute('data-url', destinationUrl);
                suggestionDiv.setAttribute('data-action', actionType);
                suggestionDiv.title = `Click to view ${item.type}`;

                suggestionDiv.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    const url = e.currentTarget.getAttribute('data-url');
                    const action = e.currentTarget.getAttribute('data-action');
                    console.log(`Suggestion clicked: Type=${item.type}, Action=${action}, URL=${url}, ID=${item.id}`);
                    if (action === 'navigate' && url !== '#') { window.location.href = url; }
                    clearSuggestions();
                });
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
    }
}
// ==============================================================
// <<< END OF UPDATED fetchAndDisplaySuggestions Function >>>
// ==============================================================


// --- Chart Functions ---
// ... (पहले जैसा) ...
function initializeOrUpdateChart(statusCounts) { /* ... */ }

// --- Helper Function: Time Ago ---
// ... (पहले जैसा) ...
function formatTimeAgo(date) { /* ... */ }

console.log("dashboard.js (with firebase-init import and updates) script loaded.");