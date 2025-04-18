// js/customer_management.js

// === सीधे Firebase SDK से फंक्शन्स इम्पोर्ट करें ===
import { getFirestore, collection, onSnapshot, doc, deleteDoc, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// ================================================

// --- ग्लोबल वेरिएबल्स ---
let customerTableBody;
let filterNameInput;
let filterCityInput;
let filterMobileInput;
let customerOrdersDiv;
let ordersForCustomerTableBody;
// let customerDetailsDiv; // Seems unused, removed for now
// let searchInput; // Seems unused or related to a different search, remove/comment if not needed

let allCustomers = []; // Firestore से आए सभी कस्टमर्स
let currentUnsub = null; // Firestore listener को बंद करने के लिए

// --- फंक्शन परिभाषाएं ---

// टेबल में कस्टमर्स दिखाने का फंक्शन
function displayCustomers(customersToDisplay) {
    if (!customerTableBody) { console.error("displayCustomers: customerTableBody not found!"); return; }
    customerTableBody.innerHTML = '';
    if (customersToDisplay.length === 0) {
        customerTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No customers found matching filters.</td></tr>'; return;
    }
    customersToDisplay.forEach((customer) => {
        const row = customerTableBody.insertRow();
        const idCell = row.insertCell();
        const displayIdToShow = customer.displayCustomerId || customer.id;
        // === showCustomerOrderHistory को ग्लोबल बनाने की ज़रूरत नहीं, क्योंकि यह इसी फाइल में है ===
        idCell.innerHTML = `<a href="#" class="customer-id-link" data-custid="${customer.id}" title="Click for history (Internal ID: ${customer.id})">${displayIdToShow}</a>`;
        row.insertCell().textContent = customer.fullName || '-';
        row.insertCell().textContent = customer.emailId || '-';
        row.insertCell().textContent = customer.billingAddress || '-';
        row.insertCell().textContent = customer.whatsappNo || '-';
        row.insertCell().textContent = customer.city || '-';
        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions');
        actionsCell.innerHTML = `<button class="action-btn edit-btn" data-id="${customer.id}" title="Edit"><i class="fas fa-edit"></i></button> <button class="action-btn delete-btn" data-id="${customer.id}" title="Delete"><i class="fas fa-trash"></i></button>`;
        // इवेंट लिस्नर जोड़ें
        actionsCell.querySelector('.edit-btn')?.addEventListener('click', () => { window.location.href = `new_customer.html?editId=${customer.id}`; });
        actionsCell.querySelector('.delete-btn')?.addEventListener('click', () => deleteCustomer(customer.id, customer.fullName));
        idCell.querySelector('.customer-id-link')?.addEventListener('click', (e) => { e.preventDefault(); showCustomerOrderHistory(customer.id, e.target); });
    });
    addCustomStyles();
}

// कस्टमर डिलीट फंक्शन
async function deleteCustomer(id, name) {
     if (!id) { console.error("Delete failed: Invalid ID."); return; }
     // === window.db का उपयोग करें जो HTML स्क्रिप्ट से सेट हुआ है ===
     const db = window.db;
     if (!db || !doc || !deleteDoc) { // इम्पोर्टेड फंक्शन्स का उपयोग करें
         alert("Database delete functions not available.");
         console.error("Firestore delete functions not found (check imports/initialization).");
         return;
     }
     if (confirm(`Are you sure you want to delete customer "${name || 'this customer'}"? This cannot be undone.`)) {
        try {
            await deleteDoc(doc(db, "customers", id)); // db का उपयोग करें
            alert("Customer deleted successfully!");
            if(customerOrdersDiv) customerOrdersDiv.style.display = 'none';
        } catch (error) {
            console.error("Error deleting customer: ", error); alert("Error deleting customer: " + error.message);
        }
     }
}

// फ़िल्टरिंग लॉजिक
function applyFilters() {
    if (!filterNameInput || !filterCityInput || !filterMobileInput || !allCustomers) { return; }
    const nameFilter = filterNameInput.value.toLowerCase().trim();
    const cityFilter = filterCityInput.value.toLowerCase().trim();
    const mobileFilter = filterMobileInput.value.trim();
    const filteredCustomers = allCustomers.filter(customer => {
        const nameMatch = !nameFilter || (customer.fullName && customer.fullName.toLowerCase().includes(nameFilter));
        const cityMatch = !cityFilter || (customer.city && customer.city.toLowerCase().includes(cityFilter));
        const mobileMatch = !mobileFilter || (customer.whatsappNo && customer.whatsappNo.includes(mobileFilter));
        return nameMatch && cityMatch && mobileMatch;
    });
    displayCustomers(filteredCustomers);
}

// Order History दिखाने का फंक्शन
async function showCustomerOrderHistory(customerId, clickedElement) {
    console.log("Fetching order history for customer:", customerId);
    // लोकल वेरिएबल्स का उपयोग करें या सुनिश्चित करें कि ग्लोबल सही हैं
    const ordersDiv = customerOrdersDiv || document.querySelector('#customer-orders');
    const ordersTBody = ordersForCustomerTableBody || document.querySelector('#orders-for-customer tbody');
    const mainTableBody = customerTableBody || document.querySelector('#customer-table tbody');

    if (!ordersDiv || !ordersTBody || !mainTableBody) { console.error("Order history or main table elements not found!"); return; }
    // === window.db का उपयोग करें ===
    const db = window.db;
    if (!db || !collection || !query || !where || !getDocs || !orderBy) { // इम्पोर्टेड फंक्शन्स जांचें
         alert("Database functions not available. Cannot fetch order history.");
         console.error("Firestore functions not available for order history.");
         return;
    }

    // हाईलाइट रो
    mainTableBody.querySelectorAll('tr').forEach(row => row.style.backgroundColor = '');
    if (clickedElement) { const parentRow = clickedElement.closest('tr'); if(parentRow) parentRow.style.backgroundColor = '#f0f0f0'; }

    ordersTBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading orders...</td></tr>';
    ordersDiv.style.display = 'block'; // सेक्शन दिखाएं

    try {
        const ordersRef = collection(db, "orders");
        // ** Firestore इंडेक्स orders.customerId (Asc) और orders.createdAt (Desc) पर आवश्यक हो सकता है **
        const q = query(ordersRef, where("customerId", "==", customerId), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        ordersTBody.innerHTML = ''; // टेबल खाली करें

        if (querySnapshot.empty) {
            ordersTBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No orders found for this customer.</td></tr>';
        } else {
            querySnapshot.forEach((orderDoc) => {
                const order = orderDoc.data();
                const row = ordersTBody.insertRow();
                row.insertCell().textContent = order.orderId || orderDoc.id;
                row.insertCell().textContent = order.orderDate || '-';
                row.insertCell().textContent = order.status || '-';
            });
        }
    } catch (error) {
        console.error("Error fetching order history:", error);
        ordersTBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color: red;">Error loading orders: ${error.message}</td></tr>`;
    }
}

// कस्टम स्टाइलिंग फंक्शन
function addCustomStyles() {
    // ... (पहले जैसा कोड)
}

// Firestore Listener सेट अप करने का फंक्शन
function setupSnapshotListener() {
     // === window.db का उपयोग करें ===
     const db = window.db;
     // === फंक्शन्स के लिए window ऑब्जेक्ट की जांच हटाएं, db की जांच रखें ===
     if (!db || !collection || !onSnapshot || !query || !orderBy ) {
         console.error("Firestore DB or required functions not available for listener.");
         if(customerTableBody) customerTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">DB connection error! Check console.</td></tr>`;
         return;
     }
     // === फंक्शन्स को सीधे उपयोग करें ===
     const customersCollectionRef = collection(db, "customers");
     // ** Firestore इंडेक्स customers.fullName (Asc) पर आवश्यक **
     const q = query(customersCollectionRef, orderBy("fullName", "asc"));

     console.log("Setting up Firestore snapshot listener for customers...");
     currentUnsub = onSnapshot(q, (snapshot) => {
            console.log("Customer snapshot received, processing docs:", snapshot.size);
            allCustomers = [];
            snapshot.forEach((doc) => {
                allCustomers.push({ id: doc.id, ...doc.data() });
            });
            console.log("Customers fetched:", allCustomers.length);
            applyFilters(); // फ़िल्टर लागू करें (यह displayCustomers कॉल करेगा)
        }, (error) => {
            console.error("Error listening to customer updates: ", error);
            if(customerTableBody) customerTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Error loading customers: ${error.message}. Check console.</td></tr>`;
        });
     console.log("Snapshot listener attached.");
}

// Firestore listener शुरू करने का फंक्शन
function listenToCustomers() {
    if (currentUnsub) { console.log("Removing previous listener."); currentUnsub(); currentUnsub = null; }
    setupSnapshotListener();
}

// --- मुख्य लॉजिक (DOM लोड होने के बाद) ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed for customer_management.js");

    // DOM रेफेरेंसेस अब प्राप्त करें
    customerTableBody = document.querySelector('#customer-table tbody');
    filterNameInput = document.querySelector('#filter-name-input');
    filterCityInput = document.querySelector('#filter-city-input');
    filterMobileInput = document.querySelector('#filter-mobile-input');
    customerOrdersDiv = document.querySelector('#customer-orders');
    ordersForCustomerTableBody = document.querySelector('#orders-for-customer tbody');
    // customerDetailsDiv = document.querySelector('#customer-details'); // Remove if unused

    // searchInput reference seems unused in provided HTML, remove if not needed
    // searchInput = document.querySelector('#search-order');

    // जांचें कि क्या मुख्य टेबल बॉडी मौजूद है
    if (!customerTableBody) {
         console.error("CRITICAL: customerTableBody ('#customer-table tbody') not found! Aborting script.");
         alert("Page Error: Customer table body not found.");
         return; // Stop script execution if table body is missing
    }

    // जांचें कि क्या अन्य ज़रूरी एलिमेंट्स मौजूद हैं (वैकल्पिक वार्निंग)
    if (!filterNameInput || !filterCityInput || !filterMobileInput || !customerOrdersDiv || !ordersForCustomerTableBody) {
         console.warn("One or more page elements might be missing! Check IDs (e.g., filters, order history table). Functionality might be limited.");
    }

    // Set initial state
    customerTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Initializing...</td></tr>';

    // फ़िल्टर इनपुट पर इवेंट लिसनर लगाएं (null चेक के साथ)
    if (filterNameInput) filterNameInput.addEventListener('input', applyFilters);
    if (filterCityInput) filterCityInput.addEventListener('input', applyFilters);
    if (filterMobileInput) filterMobileInput.addEventListener('input', applyFilters);

    // स्टाइल जोड़ें
    addCustomStyles();

    // Firebase तैयार होने का इंतज़ार करें और फिर Listener शुरू करें
    const checkDbInterval = setInterval(() => {
        // ** सिर्फ window.db की जांच करें **
        if (window.db) {
            clearInterval(checkDbInterval);
            console.log("DB ready, starting customer listener.");
            listenToCustomers(); // DB तैयार होने पर ही Listener शुरू करें
        } else {
            console.log("Waiting for DB initialization in customer_management.js...");
        }
    }, 150); // थोड़ा ज़्यादा समय दें

    console.log("customer_management.js initialization setup complete.");
});