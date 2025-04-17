// js/customer_management.js

// Firestore फंक्शन्स window ऑब्जेक्ट से उपलब्ध होने चाहिए
// const { db, collection, onSnapshot, doc, deleteDoc, query, where, getDocs } = window;

// --- DOM एलिमेंट रेफरेंस (DOMContentLoaded के अंदर सेट होंगे) ---
let customerTableBody;
let filterNameInput;
let filterCityInput;
let filterMobileInput;
let customerOrdersDiv;
let ordersForCustomerTableBody;
let customerDetailsDiv; // इसे भी डिफाइन करें

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

        // कॉलम 1: Customer ID (Clickable, Bold, Blue)
        const idCell = row.insertCell();
        idCell.innerHTML = `<a href="#" onclick="event.preventDefault(); showCustomerOrderHistory('${customer.id}', this)">${customer.id}</a>`;
        idCell.classList.add('customer-id-cell');
        idCell.title = 'Click to view order history';

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
}

// कस्टमर डिलीट फंक्शन
async function deleteCustomer(id, name) {
     if (!id) { console.error("Delete failed: Invalid ID."); return; }
     if (confirm(`Are you sure you want to delete customer "${name || 'this customer'}"?`)) {
        try {
            if (!window.db || !window.doc || !window.deleteDoc) throw new Error("Firestore functions not available.");
            await window.deleteDoc(window.doc(window.db, "customers", id)); // window. का इस्तेमाल करें
            alert("Customer deleted successfully!");
            if(customerOrdersDiv) customerOrdersDiv.style.display = 'none'; // हिस्ट्री छिपाएं
        } catch (error) {
            console.error("Error deleting customer: ", error);
            alert("Error deleting customer: " + error.message);
        }
     }
}

// फ़िल्टरिंग लॉजिक
function applyFilters() {
    // सुनिश्चित करें कि DOM एलिमेंट्स लोड हो चुके हैं
    if (!filterNameInput || !filterCityInput || !filterMobileInput) {
        // console.warn("Filter inputs not ready yet.");
        // अगर एलिमेंट्स अभी तक नहीं मिले हैं तो फ़िल्टर न करें
        // पेज लोड होने पर displayCustomers कॉल हो जाएगा जब डेटा आएगा
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

    // DOM एलिमेंट्स प्राप्त करें (अगर पहले से नहीं हैं)
    customerOrdersDiv = customerOrdersDiv || document.querySelector('#customer-orders');
    ordersForCustomerTableBody = ordersForCustomerTableBody || document.querySelector('#orders-for-customer tbody');
    customerDetailsDiv = customerDetailsDiv || document.querySelector('#customer-details');
    customerTableBody = customerTableBody || document.querySelector('#customer-table tbody'); // इसे भी जांचें

    if (!customerOrdersDiv || !ordersForCustomerTableBody || !customerTableBody) {
        console.error("Order history or main table elements not found!");
        return;
    }
    if (!window.db || !window.collection || !window.query || !window.where || !window.getDocs) {
         alert("Database functions not available. Cannot fetch order history.");
         return;
    }

    // Highlight row
    const allRows = customerTableBody.querySelectorAll('tr');
    allRows.forEach(row => row.style.backgroundColor = ''); // Reset background
    if (clickedElement) {
       const parentRow = clickedElement.closest('tr');
       if(parentRow) parentRow.style.backgroundColor = '#f0f0f0'; // Highlight clicked row
    }

    if (customerDetailsDiv) customerDetailsDiv.style.display = 'none'; // Customer Details छिपाएं
    ordersForCustomerTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading orders...</td></tr>';
    customerOrdersDiv.style.display = 'block'; // ऑर्डर सेक्शन दिखाएं

    try {
        const ordersRef = window.collection(db, "orders");
        const q = window.query(ordersRef, window.where("customerId", "==", customerId));
        const querySnapshot = await window.getDocs(q);
        ordersForCustomerTableBody.innerHTML = ''; // लोडिंग हटाएं

        if (querySnapshot.empty) {
            ordersForCustomerTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No orders found for this customer.</td></tr>';
        } else {
            querySnapshot.forEach((orderDoc) => { // वेरिएबल का नाम बदलें
                const order = orderDoc.data();
                const row = ordersForCustomerTableBody.insertRow();
                row.insertCell().textContent = orderDoc.id;
                row.insertCell().textContent = order.orderDate || '-';
                row.insertCell().textContent = order.status || '-';
            });
        }
    } catch (error) {
        console.error("Error fetching order history:", error);
        ordersForCustomerTableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color: red;">Error loading orders.</td></tr>`;
    }
}

// कस्टम स्टाइलिंग जोड़ने का फंक्शन
function addCustomStyles() {
    const styleId = 'customer-page-styles';
    if (!document.getElementById(styleId)) {
        const styleSheet = document.createElement("style");
        styleSheet.id = styleId;
        styleSheet.innerHTML = `
        td.customer-id-cell a { /* क्लास सेलेक्टर का उपयोग करें */
             font-weight: bold;
             color: #007bff; /* Blue color */
             text-decoration: none;
             cursor: pointer;
        }
        td.customer-id-cell a:hover {
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
}

// Firestore Listener सेट अप करने का फंक्शन
function setupSnapshotListener(){
     if (!window.db) { // db की उपलब्धता जांचें
         console.error("Firestore DB is not available to setup listener.");
         if(customerTableBody) customerTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Database connection error.</td></tr>`;
         return;
     }
     const customersCollectionRef = window.collection(db, "customers");
     currentUnsub = window.onSnapshot(customersCollectionRef, (snapshot) => { // window.onSnapshot का इस्तेमाल करें
            console.log("Customer snapshot received");
            allCustomers = [];
            snapshot.forEach((doc) => {
                allCustomers.push({ id: doc.id, ...doc.data() });
            });
            allCustomers.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
            console.log("Customers fetched:", allCustomers);
            applyFilters(); // फ़िल्टर लागू करें

        }, (error) => {
            console.error("Error listening to customer updates: ", error);
            if(customerTableBody) customerTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Error loading customers. Check console.</td></tr>`;
        });
}

// Firestore listener शुरू करने का फंक्शन
function listenToCustomers() {
    if (currentUnsub) {
        console.log("Stopping previous listener.");
        currentUnsub();
        currentUnsub = null;
    }
    console.log("Setting up Firestore listener...");
    setupSnapshotListener(); // सीधे लिस्नर सेट करें
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
    customerDetailsDiv = document.querySelector('#customer-details'); // इसे भी प्राप्त करें

    if (!customerTableBody) {
        console.error("CRITICAL: customerTableBody not found after DOM loaded!");
        return;
    } else {
         customerTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Initializing...</td></tr>';
    }

    // फ़िल्टर इनपुट पर इवेंट लिसनर लगाएं
    if (filterNameInput) filterNameInput.addEventListener('input', applyFilters);
    if (filterCityInput) filterCityInput.addEventListener('input', applyFilters);
    if (filterMobileInput) filterMobileInput.addEventListener('input', applyFilters);

    // स्टाइल जोड़ें
    addCustomStyles();

    // Firebase तैयार होने का इंतज़ार करें और फिर Listener शुरू करें
    const checkDbInterval = setInterval(() => {
        if (window.db) {
            clearInterval(checkDbInterval);
            console.log("DB ready, starting customer listener.");
            listenToCustomers(); // DB तैयार होने पर ही Listener शुरू करें
        } else {
            console.log("Waiting for DB initialization in customer_management.js...");
        }
    }, 100); // हर 100ms में चेक करें

    console.log("customer_management.js initialization setup complete.");
});