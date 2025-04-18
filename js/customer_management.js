// js/customer_management.js

// Firestore फंक्शन्स window ऑब्जेक्ट से उपलब्ध होने चाहिए
const { db, collection, onSnapshot, doc, deleteDoc, query, where, getDocs, orderBy } = window;

// --- DOM एलिमेंट रेफरेंस (DOMContentLoaded के अंदर सेट होंगे) ---
let customerTableBody;
let filterNameInput;
let filterCityInput;
let filterMobileInput;
let customerOrdersDiv;
let ordersForCustomerTableBody;
let customerDetailsDiv;

// --- ग्लोबल वेरिएबल्स ---
let allCustomers = []; // Firestore से आए सभी कस्टमर्स
let currentUnsub = null; // Firestore listener को बंद करने के लिए

// --- फंक्शन परिभाषाएं ---

// टेबल में कस्टमर्स दिखाने का फंक्शन
function displayCustomers(customersToDisplay) {
    // फंक्शन की शुरुआत में जांचें कि क्या customerTableBody मौजूद है
    if (!customerTableBody) {
        console.error("displayCustomers called but customerTableBody is not available!");
        return; // अगर टेबल बॉडी नहीं मिली तो कुछ न करें
    }
    customerTableBody.innerHTML = ''; // टेबल खाली करें

    if (customersToDisplay.length === 0) {
        customerTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No customers found matching filters.</td></tr>';
        return;
    }

    customersToDisplay.forEach((customer) => {
        const row = customerTableBody.insertRow();

        // कॉलम 1: Customer ID (displayCustomerId या Firestore ID दिखाएगा)
        const idCell = row.insertCell();
        // अगर displayCustomerId है तो उसे दिखाएं, वरना Firestore ID दिखाएं
        const displayIdToShow = customer.displayCustomerId || customer.id;
        // क्लिक करने पर हमेशा Firestore ID (customer.id) का उपयोग करें
        idCell.innerHTML = `<a href="#" class="customer-id-link" onclick="event.preventDefault(); showCustomerOrderHistory('${customer.id}', this)" title="Click for history (Internal ID: ${customer.id})">${displayIdToShow}</a>`;

        // बाकी कॉलम्स
        row.insertCell().textContent = customer.fullName || '-';
        row.insertCell().textContent = customer.emailId || '-';
        row.insertCell().textContent = customer.billingAddress || '-';
        row.insertCell().textContent = customer.whatsappNo || '-';
        row.insertCell().textContent = customer.city || '-';

        // Actions कॉलम
        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions');
        actionsCell.innerHTML = `
            <button class="action-btn edit-btn" data-id="${customer.id}" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="action-btn delete-btn" data-id="${customer.id}" title="Delete"><i class="fas fa-trash"></i></button>
        `;

        // एडिट बटन का लॉजिक
        const editBtn = actionsCell.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                window.location.href = `new_customer.html?editId=${customer.id}`;
            });
        }

        // डिलीट बटन का लॉजिक
        const deleteBtn = actionsCell.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => deleteCustomer(customer.id, customer.fullName));
        }
    });
    addCustomStyles(); // स्टाइलिंग लागू करें (ID सेल के लिए भी)
}

// कस्टमर डिलीट फंक्शन
async function deleteCustomer(id, name) {
     if (!id) { console.error("Delete failed: Invalid ID."); return; }
     if (confirm(`Are you sure you want to delete customer "${name || 'this customer'}"?`)) {
        try {
            // Ensure Firebase functions are available on window scope
            if (!window.db || !window.doc || !window.deleteDoc) throw new Error("Firestore delete functions not available.");
            await window.deleteDoc(window.doc(window.db, "customers", id));
            alert("Customer deleted successfully!");
            if(customerOrdersDiv) customerOrdersDiv.style.display = 'none'; // Hide history if open
        } catch (error) {
            console.error("Error deleting customer: ", error);
            alert("Error deleting customer: " + error.message);
        }
     }
}

// फ़िल्टरिंग लॉजिक
function applyFilters() {
    // Ensure DOM elements are ready
    if (!filterNameInput || !filterCityInput || !filterMobileInput || !allCustomers) {
        // console.warn("Filter inputs or customer data not ready yet.");
        return;
    }
    const nameFilter = filterNameInput.value.toLowerCase().trim() || '';
    const cityFilter = filterCityInput.value.toLowerCase().trim() || '';
    const mobileFilter = filterMobileInput.value.trim() || '';

    const filteredCustomers = allCustomers.filter(customer => {
        const nameMatch = !nameFilter || (customer.fullName && customer.fullName.toLowerCase().includes(nameFilter));
        const cityMatch = !cityFilter || (customer.city && customer.city.toLowerCase().includes(cityFilter));
        const mobileMatch = !mobileFilter || (customer.whatsappNo && customer.whatsappNo.includes(mobileFilter));
        return nameMatch && cityMatch && mobileMatch;
    });
    displayCustomers(filteredCustomers); // फ़िल्टर की हुई लिस्ट दिखाएं
}


// Order History दिखाने का फंक्शन
window.showCustomerOrderHistory = async function(customerId, clickedElement) {
    console.log("Fetching order history for customer:", customerId);
    // Get elements dynamically or ensure they exist
    customerOrdersDiv = customerOrdersDiv || document.querySelector('#customer-orders');
    ordersForCustomerTableBody = ordersForCustomerTableBody || document.querySelector('#orders-for-customer tbody');
    customerDetailsDiv = customerDetailsDiv || document.querySelector('#customer-details');
    customerTableBody = customerTableBody || document.querySelector('#customer-table tbody'); // Ensure this too

    if (!customerOrdersDiv || !ordersForCustomerTableBody || !customerTableBody) {
        console.error("Order history or main table elements not found!"); return; }
    // Ensure Firebase functions are available
    if (!window.db || !window.collection || !window.query || !window.where || !window.getDocs || !window.orderBy) {
         alert("Database functions not available. Cannot fetch order history."); return; }

    // Highlight row
    const allRows = customerTableBody.querySelectorAll('tr');
    allRows.forEach(row => row.style.backgroundColor = '');
    if (clickedElement) { const parentRow = clickedElement.closest('tr'); if(parentRow) parentRow.style.backgroundColor = '#f0f0f0'; }

    if (customerDetailsDiv) customerDetailsDiv.style.display = 'none';
    ordersForCustomerTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading orders...</td></tr>';
    customerOrdersDiv.style.display = 'block';

    try {
        const ordersRef = collection(db, "orders");
        // Query orders for the customer, sorted by date descending
        const q = query(ordersRef, where("customerId", "==", customerId), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        ordersForCustomerTableBody.innerHTML = '';

        if (querySnapshot.empty) {
            ordersForCustomerTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No orders found for this customer.</td></tr>';
        } else {
            querySnapshot.forEach((orderDoc) => {
                const order = orderDoc.data();
                const row = ordersForCustomerTableBody.insertRow();
                row.insertCell().textContent = order.orderId || orderDoc.id; // Use custom or Firestore ID
                row.insertCell().textContent = order.orderDate || '-';
                row.insertCell().textContent = order.status || '-';
            });
        }
    } catch (error) {
        console.error("Error fetching order history:", error);
        ordersForCustomerTableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color: red;">Error loading orders.</td></tr>`;
    }
}

// कस्टम स्टाइलिंग फंक्शन
function addCustomStyles() {
    const styleId = 'customer-page-styles';
    if (document.getElementById(styleId)) return; // Add only once
    const styleSheet = document.createElement("style");
    styleSheet.id = styleId;
    // Styles for customer ID link and action buttons
    styleSheet.innerHTML = `
    td a.customer-id-link {
         font-weight: bold; color: #007bff; text-decoration: none; cursor: pointer;
         display: inline-block; max-width: 150px; overflow: hidden;
         text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;
    }
    td a.customer-id-link:hover { text-decoration: underline; }
    .action-btn { background: none; border: none; cursor: pointer; padding: 2px 5px; margin: 0 2px; font-size: 14px; }
    .action-btn i { pointer-events: none; }
    .action-btn.edit-btn { color: #0d6efd; } .action-btn.delete-btn { color: #dc3545; }
    .action-btn:hover { opacity: 0.7; }
    td.actions { text-align: center; }
    `;
    document.head.appendChild(styleSheet);

    // Apply class after styles are potentially added (might be redundant if styles always present)
    const idLinks = customerTableBody?.querySelectorAll('td:first-child a');
    idLinks?.forEach(a => a.classList.add('customer-id-link'));
}


// Firestore Listener सेट अप करने का फंक्शन
function setupSnapshotListener(){
     if (!window.db || !window.collection || !window.onSnapshot || !window.query || !window.orderBy ) {
         console.error("Firestore listener functions not available.");
         if(customerTableBody) customerTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">DB connection error.</td></tr>`;
         return;
     }
     const customersCollectionRef = collection(db, "customers");
     // Sort by name directly in Firestore query if desired, or keep client-side sort
     const q = query(customersCollectionRef, orderBy("fullName", "asc")); // Sort by name ascending

     currentUnsub = onSnapshot(q, (snapshot) => {
            console.log("Customer snapshot received");
            allCustomers = [];
            snapshot.forEach((doc) => {
                allCustomers.push({ id: doc.id, ...doc.data() });
            });
            // Client-side sort might still be useful if Firestore sort isn't perfect for locale
            // allCustomers.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
            console.log("Customers fetched:", allCustomers.length);
            applyFilters(); // फ़िल्टर लागू करें

        }, (error) => {
            console.error("Error listening to customer updates: ", error);
            if(customerTableBody) customerTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Error loading customers. Check console.</td></tr>`;
        });
}

// Firestore listener शुरू करने का फंक्शन
function listenToCustomers() {
    if (currentUnsub) { currentUnsub(); currentUnsub = null; }
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
    customerDetailsDiv = document.querySelector('#customer-details');

    // === यहाँ सेलेक्टर ठीक किया गया है ===
    searchInput = document.querySelector('#search-order'); // <<< पहले #search-input था
    // ==================================

    // जांचें कि क्या सभी ज़रूरी एलिमेंट्स मौजूद हैं
    if (!customerTableBody || !filterNameInput || !filterCityInput || !filterMobileInput || !customerOrdersDiv || !ordersForCustomerTableBody || !customerDetailsDiv) {
        console.error("One or more essential page elements are missing! Check IDs in HTML and JS selectors.");
        if(customerTableBody) {
            // Display error in table body if possible
            customerTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Page Error: UI Elements missing. Check console.</td></tr>`;
        }
        return; // Stop further execution
    } else {
         customerTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Initializing...</td></tr>';
    }

    // फ़िल्टर इनपुट पर इवेंट लिसनर लगाएं
    filterNameInput.addEventListener('input', applyFilters);
    filterCityInput.addEventListener('input', applyFilters);
    filterMobileInput.addEventListener('input', applyFilters);

    // स्टाइल जोड़ें
    addCustomStyles();

    // Firebase तैयार होने का इंतज़ार करें और फिर Listener शुरू करें
    const checkDbInterval = setInterval(() => {
        if (window.db) {
            clearInterval(checkDbInterval);
            console.log("DB ready, starting customer listener.");
            listenToCustomers(); // DB तैयार होने पर ही Listener शुरू करें
        } else { console.log("Waiting for DB initialization in customer_management.js..."); }
    }, 100);

    console.log("customer_management.js initialization setup complete.");
});