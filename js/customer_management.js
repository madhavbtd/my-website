// js/customer_management.js

// Firestore फंक्शन्स window ऑब्जेक्ट से उपलब्ध होने चाहिए
const { db, collection, onSnapshot, doc, deleteDoc, query, where, getDocs } = window;

// --- DOM एलिमेंट रेफरेंस ---
let customerTableBody;
let filterNameInput;
let filterCityInput;
let filterMobileInput;
let customerOrdersDiv;
let ordersForCustomerTableBody;
let customerDetailsDiv;

// --- ग्लोबल वेरिएबल्स ---
let allCustomers = [];
let currentUnsub = null;

// --- फंक्शन परिभाषाएं ---

// टेबल में कस्टमर्स दिखाने का फंक्शन (अपडेटेड: displayCustomerId दिखाने के लिए)
function displayCustomers(customersToDisplay) {
    if (!customerTableBody) { console.error("displayCustomers: customerTableBody not ready!"); return; }
    customerTableBody.innerHTML = '';

    if (customersToDisplay.length === 0) {
        customerTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No customers found.</td></tr>';
        return;
    }

    customersToDisplay.forEach((customer) => {
        const row = customerTableBody.insertRow();

        // === कॉलम 1: Customer ID (displayCustomerId या Firestore ID दिखाएगा) ===
        const idCell = row.insertCell();
        // अगर displayCustomerId है तो उसे दिखाएं, वरना Firestore ID दिखाएं
        const displayIdToShow = customer.displayCustomerId || customer.id;
        // क्लिक करने पर हमेशा Firestore ID (customer.id) का उपयोग करें
        idCell.innerHTML = `<a href="#" class="customer-id-link" onclick="event.preventDefault(); showCustomerOrderHistory('${customer.id}', this)" title="Click for history (ID: ${customer.id})">${displayIdToShow}</a>`;
        // idCell.classList.add('customer-id-cell'); // स्टाइल नीचे addCustomStyles से लगेगी
        // ==================================================================

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

        // एडिट/डिलीट बटन लॉजिक
        const editBtn = actionsCell.querySelector('.edit-btn');
        if (editBtn) { editBtn.addEventListener('click', () => { window.location.href = `new_customer.html?editId=${customer.id}`; }); }
        const deleteBtn = actionsCell.querySelector('.delete-btn');
        if (deleteBtn) { deleteBtn.addEventListener('click', () => deleteCustomer(customer.id, customer.fullName)); }
    });
    addCustomStyles(); // स्टाइलिंग लागू करें
}

// कस्टमर डिलीट फंक्शन
async function deleteCustomer(id, name) {
     if (!id) { console.error("Delete failed: Invalid ID."); return; }
     if (confirm(`Are you sure you want to delete customer "${name || 'this customer'}"?`)) {
        try {
            if (!window.db || !window.doc || !window.deleteDoc) throw new Error("Firestore functions not available.");
            await window.deleteDoc(window.doc(window.db, "customers", id));
            alert("Customer deleted successfully!");
            if(customerOrdersDiv) customerOrdersDiv.style.display = 'none';
        } catch (error) { console.error("Error deleting customer: ", error); alert("Error deleting customer: " + error.message); }
     }
}

// फ़िल्टरिंग लॉजिक
function applyFilters() {
    if (!filterNameInput || !filterCityInput || !filterMobileInput || !allCustomers) { return; }
    const nameFilter = filterNameInput.value.toLowerCase().trim() || '';
    const cityFilter = filterCityInput.value.toLowerCase().trim() || '';
    const mobileFilter = filterMobileInput.value.trim() || '';
    const filteredCustomers = allCustomers.filter(customer => {
        const nameMatch = !nameFilter || (customer.fullName && customer.fullName.toLowerCase().includes(nameFilter));
        const cityMatch = !cityFilter || (customer.city && customer.city.toLowerCase().includes(cityFilter));
        const mobileMatch = !mobileFilter || (customer.whatsappNo && customer.whatsappNo.includes(mobileFilter));
        return nameMatch && cityMatch && mobileMatch;
    });
    displayCustomers(filteredCustomers);
}

// Order History दिखाने का फंक्शन
window.showCustomerOrderHistory = async function(customerId, clickedElement) {
    console.log("Fetching order history for customer:", customerId);
    customerOrdersDiv = customerOrdersDiv || document.querySelector('#customer-orders');
    ordersForCustomerTableBody = ordersForCustomerTableBody || document.querySelector('#orders-for-customer tbody');
    customerDetailsDiv = customerDetailsDiv || document.querySelector('#customer-details');
    customerTableBody = customerTableBody || document.querySelector('#customer-table tbody');

    if (!customerOrdersDiv || !ordersForCustomerTableBody || !customerTableBody) { return; }
    if (!window.db || !window.collection || !window.query || !window.where || !window.getDocs) { return; }

    // Highlight row
    const allRows = customerTableBody.querySelectorAll('tr');
    allRows.forEach(row => row.style.backgroundColor = '');
    if (clickedElement) { const parentRow = clickedElement.closest('tr'); if(parentRow) parentRow.style.backgroundColor = '#f0f0f0'; }

    if (customerDetailsDiv) customerDetailsDiv.style.display = 'none';
    ordersForCustomerTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading orders...</td></tr>';
    customerOrdersDiv.style.display = 'block';

    try {
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef, where("customerId", "==", customerId));
        const querySnapshot = await getDocs(q);
        ordersForCustomerTableBody.innerHTML = '';

        if (querySnapshot.empty) {
            ordersForCustomerTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No orders found.</td></tr>';
        } else {
            querySnapshot.forEach((orderDoc) => {
                const order = orderDoc.data();
                const row = ordersForCustomerTableBody.insertRow();
                row.insertCell().textContent = order.orderId || orderDoc.id; // Use custom orderId if available
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
    if (!document.getElementById(styleId)) {
        const styleSheet = document.createElement("style");
        styleSheet.id = styleId;
        styleSheet.innerHTML = `
        /* Style for the clickable customer ID */
        td a.customer-id-link {
             font-weight: bold;
             color: #007bff; /* Blue color */
             text-decoration: none;
             cursor: pointer;
             display: inline-block;
             max-width: 150px; /* Adjust width as needed */
             overflow: hidden;
             text-overflow: ellipsis;
             white-space: nowrap;
             vertical-align: middle;
        }
        td a.customer-id-link:hover {
            text-decoration: underline;
        }
        /* Styles for action buttons */
        .action-btn { background: none; border: none; cursor: pointer; padding: 2px 5px; margin: 0 2px; font-size: 14px; }
        .action-btn i { pointer-events: none; }
        .action-btn.edit-btn { color: #0d6efd; }
        .action-btn.delete-btn { color: #dc3545; }
        .action-btn:hover { opacity: 0.7; }
        td.actions { text-align: center; }
        `;
        document.head.appendChild(styleSheet);
    }
    // क्लास को td > a पर लागू करें (हर बार डिस्प्ले होने पर)
     const idLinks = customerTableBody?.querySelectorAll('td:first-child a');
     idLinks?.forEach(a => a.classList.add('customer-id-link'));
}


// Firestore Listener सेट अप फंक्शन
function setupSnapshotListener(){
     if (!window.db) { console.error("DB not available"); return; }
     const customersCollectionRef = window.collection(db, "customers");
     currentUnsub = window.onSnapshot(customersCollectionRef, (snapshot) => {
            allCustomers = [];
            snapshot.forEach((doc) => { allCustomers.push({ id: doc.id, ...doc.data() }); });
            allCustomers.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
            applyFilters();
        }, (error) => { console.error("Error listening: ", error); /* ... */ });
}

// Firestore listener शुरू करने का फंक्शन
function listenToCustomers() {
    if (currentUnsub) { currentUnsub(); currentUnsub = null; }
    setupSnapshotListener();
}

// --- मुख्य लॉजिक (DOM लोड होने के बाद) ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded: customer_management.js");
    // DOM रेफेरेंसेस प्राप्त करें
    customerTableBody = document.querySelector('#customer-table tbody');
    filterNameInput = document.querySelector('#filter-name-input');
    filterCityInput = document.querySelector('#filter-city-input');
    filterMobileInput = document.querySelector('#filter-mobile-input');
    customerOrdersDiv = document.querySelector('#customer-orders');
    ordersForCustomerTableBody = document.querySelector('#orders-for-customer tbody');
    customerDetailsDiv = document.querySelector('#customer-details');

    if (!customerTableBody) { console.error("CRITICAL: customerTableBody not found!"); return; }
    else { customerTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Initializing...</td></tr>'; }

    // इवेंट लिसनर लगाएं
    if (filterNameInput) filterNameInput.addEventListener('input', applyFilters);
    if (filterCityInput) filterCityInput.addEventListener('input', applyFilters);
    if (filterMobileInput) filterMobileInput.addEventListener('input', applyFilters);

    // स्टाइल जोड़ें
    addCustomStyles();

    // Firebase तैयार होने का इंतज़ार करें और Listener शुरू करें
    const checkDbInterval = setInterval(() => {
        if (window.db) {
            clearInterval(checkDbInterval);
            console.log("DB ready, starting customer listener.");
            listenToCustomers();
        } else { console.log("Waiting for DB..."); }
    }, 100);

    console.log("customer_management.js initialization setup complete.");
});