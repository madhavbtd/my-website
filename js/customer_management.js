// js/customer_management.js

const { db, collection, onSnapshot, doc, deleteDoc, query, where, getDocs, orderBy } = window;

let customerTableBody; let filterNameInput; let filterCityInput; let filterMobileInput;
let customerOrdersDiv; let ordersForCustomerTableBody; let customerDetailsDiv;
let allCustomers = []; let currentUnsub = null;

function displayCustomers(customersToDisplay) {
    if (!customerTableBody) { console.error("displayCustomers: customerTableBody not ready!"); return; }
    customerTableBody.innerHTML = '';
    if (customersToDisplay.length === 0) { customerTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No customers found.</td></tr>'; return; }

    customersToDisplay.forEach((customer) => {
        const row = customerTableBody.insertRow();
        const idCell = row.insertCell();
        const displayIdToShow = customer.displayCustomerId || customer.id; // न्यूमेरिकल या Firestore ID
        idCell.innerHTML = `<a href="#" class="customer-id-link" onclick="event.preventDefault(); showCustomerOrderHistory('${customer.id}', this)" title="Click for history (Internal ID: ${customer.id})">${displayIdToShow}</a>`;
        row.insertCell().textContent = customer.fullName || '-';
        row.insertCell().textContent = customer.emailId || '-';
        row.insertCell().textContent = customer.billingAddress || '-';
        row.insertCell().textContent = customer.whatsappNo || '-';
        row.insertCell().textContent = customer.city || '-';
        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions');
        actionsCell.innerHTML = `<button class="action-btn edit-btn" data-id="${customer.id}" title="Edit"><i class="fas fa-edit"></i></button> <button class="action-btn delete-btn" data-id="${customer.id}" title="Delete"><i class="fas fa-trash"></i></button>`;
        const editBtn = actionsCell.querySelector('.edit-btn');
        if (editBtn) { editBtn.addEventListener('click', () => { window.location.href = `new_customer.html?editId=${customer.id}`; }); }
        const deleteBtn = actionsCell.querySelector('.delete-btn');
        if (deleteBtn) { deleteBtn.addEventListener('click', () => deleteCustomer(customer.id, customer.fullName)); }
    });
    addCustomStyles();
}

async function deleteCustomer(id, name) {
    if (!id) { console.error("Delete failed: Invalid ID."); return; }
    if (confirm(`Are you sure you want to delete customer "${name || 'this customer'}"?`)) {
        try {
            if (!db || !doc || !deleteDoc) throw new Error("Firestore functions not available.");
            await deleteDoc(doc(db, "customers", id));
            alert("Customer deleted successfully!");
            if (customerOrdersDiv) customerOrdersDiv.style.display = 'none';
        } catch (error) { console.error("Error deleting customer: ", error); alert("Error deleting customer: " + error.message); }
    }
}

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

window.showCustomerOrderHistory = async function (customerId, clickedElement) {
    console.log("Fetching order history for customer:", customerId);
    customerOrdersDiv = customerOrdersDiv || document.querySelector('#customer-orders');
    ordersForCustomerTableBody = ordersForCustomerTableBody || document.querySelector('#orders-for-customer tbody');
    customerDetailsDiv = customerDetailsDiv || document.querySelector('#customer-details');
    customerTableBody = customerTableBody || document.querySelector('#customer-table tbody');
    if (!customerOrdersDiv || !ordersForCustomerTableBody || !customerTableBody) { return; }
    if (!db || !collection || !query || !where || !getDocs) { return; }
    const allRows = customerTableBody.querySelectorAll('tr');
    allRows.forEach(row => row.style.backgroundColor = '');
    if (clickedElement) { const parentRow = clickedElement.closest('tr'); if (parentRow) parentRow.style.backgroundColor = '#f0f0f0'; }
    if (customerDetailsDiv) customerDetailsDiv.style.display = 'none';
    ordersForCustomerTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading orders...</td></tr>';
    customerOrdersDiv.style.display = 'block';
    try {
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef, where("customerId", "==", customerId), orderBy("createdAt", "desc")); // Sort by date descending
        const querySnapshot = await getDocs(q);
        ordersForCustomerTableBody.innerHTML = '';
        if (querySnapshot.empty) { ordersForCustomerTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No orders found.</td></tr>'; }
        else {
            querySnapshot.forEach((orderDoc) => {
                const order = orderDoc.data();
                const row = ordersForCustomerTableBody.insertRow();
                row.insertCell().textContent = order.orderId || orderDoc.id;
                row.insertCell().textContent = order.orderDate || '-';
                row.insertCell().textContent = order.status || '-';
            });
        }
    } catch (error) { console.error("Error fetching order history:", error); ordersForCustomerTableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color: red;">Error loading orders.</td></tr>`; }
}

function addCustomStyles() { /* ... Styles as before ... */ }

function setupSnapshotListener() {
    if (!db) { console.error("DB not available"); return; }
    const customersCollectionRef = collection(db, "customers");
    const q = query(customersCollectionRef, orderBy("createdAt", "desc")); // Sort by creation time
    currentUnsub = onSnapshot(q, (snapshot) => {
        allCustomers = [];
        snapshot.forEach((doc) => { allCustomers.push({ id: doc.id, ...doc.data() }); });
        // Sorting by name after fetch
        allCustomers.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
        applyFilters();
    }, (error) => { console.error("Error listening: ", error); /* ... */ });
}

function listenToCustomers() {
    if (currentUnsub) { currentUnsub(); currentUnsub = null; }
    setupSnapshotListener();
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded: customer_management.js");
    customerTableBody = document.querySelector('#customer-table tbody');
    filterNameInput = document.querySelector('#filter-name-input');
    filterCityInput = document.querySelector('#filter-city-input');
    filterMobileInput = document.querySelector('#filter-mobile-input');
    customerOrdersDiv = document.querySelector('#customer-orders');
    ordersForCustomerTableBody = document.querySelector('#orders-for-customer tbody');
    customerDetailsDiv = document.querySelector('#customer-details');
    if (!customerTableBody) { console.error("CRITICAL: customerTableBody not found!"); return; }
    else { customerTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Initializing...</td></tr>'; }
    if (filterNameInput) filterNameInput.addEventListener('input', applyFilters);
    if (filterCityInput) filterCityInput.addEventListener('input', applyFilters);
    if (filterMobileInput) filterMobileInput.addEventListener('input', applyFilters);
    addCustomStyles();
    const checkDbInterval = setInterval(() => {
        if (window.db) { clearInterval(checkDbInterval); console.log("DB ready, starting listener."); listenToCustomers(); }
        else { console.log("Waiting for DB..."); }
    }, 100);
    console.log("customer_management.js init setup complete.");
});

// Add Custom Styles implementation (as provided in previous response)
function addCustomStyles() {
    const styleId = 'customer-page-styles';
    if (!document.getElementById(styleId)) {
        const styleSheet = document.createElement("style");
        styleSheet.id = styleId;
        styleSheet.innerHTML = `
        td a.customer-id-link { /* क्लास का उपयोग करें */
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
     const idLinks = customerTableBody?.querySelectorAll('td:first-child a'); // पहले सेल के लिंक पर क्लास लगाएं
     idLinks?.forEach(a => a.classList.add('customer-id-link'));
}