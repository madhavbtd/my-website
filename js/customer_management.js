// js/customer_management.js

// Firestore फंक्शन्स window ऑब्जेक्ट से उपलब्ध हैं
const { db, collection, onSnapshot, doc, deleteDoc, query, where, getDocs } = window;

// --- DOM एलिमेंट रेफरेंस ---
const customerTableBody = document.querySelector('#customer-table tbody');
const filterNameInput = document.querySelector('#filter-name-input');
const filterCityInput = document.querySelector('#filter-city-input');
const filterMobileInput = document.querySelector('#filter-mobile-input');
// Customer Details/Orders divs (अभी इस्तेमाल नहीं किये जायेंगे)
// const customerDetailsDiv = document.querySelector('#customer-details');
// const customerInfoDiv = document.querySelector('#customer-info');
// const customerOrdersDiv = document.querySelector('#customer-orders');
// const ordersForCustomerTableBody = document.querySelector('#orders-for-customer tbody');

// --- ग्लोबल वेरिएबल्स ---
let allCustomers = []; // Firestore से आए सभी कस्टमर्स

// --- Firestore से रियल-टाइम डेटा सुनना ---
try {
    if (!db) throw new Error("Firestore not initialized"); // जांचें कि db मौजूद है

    const customersCollectionRef = collection(db, "customers");
    onSnapshot(customersCollectionRef, (snapshot) => {
        console.log("Customer snapshot received");
        allCustomers = []; // पुरानी लिस्ट हटाएं
        let serialNumber = 1;
        snapshot.forEach((doc) => {
            allCustomers.push({ id: doc.id, ...doc.data(), serialNumber: serialNumber++ });
        });
        console.log("Customers fetched:", allCustomers);
        // डेटा आने के बाद टेबल डिस्प्ले और फ़िल्टर लागू करें
        applyFilters(); // यह displayCustomers को कॉल करेगा

    }, (error) => {
        console.error("Error listening to customer updates: ", error);
        customerTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Error loading customers. Check console.</td></tr>`;
    });

} catch (e) {
    console.error("Error setting up Firestore listener: ", e);
    customerTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Database connection error. Check console.</td></tr>`;
}


// --- टेबल में कस्टमर्स दिखाने का फंक्शन ---
function displayCustomers(customersToDisplay) {
    if (!customerTableBody) return;
    customerTableBody.innerHTML = ''; // टेबल खाली करें

    if (customersToDisplay.length === 0) {
        customerTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No customers found.</td></tr>';
        return;
    }

    customersToDisplay.forEach(customer => {
        const row = customerTableBody.insertRow();
        row.innerHTML = `
            <td>${customer.serialNumber}</td>
            <td>${customer.fullName || '-'}</td>
            <td>${customer.emailId || '-'}</td>
            <td>${customer.billingAddress || '-'}</td>
            <td>${customer.whatsappNo || '-'}</td>
            <td>${customer.city || '-'}</td>
            <td class="actions">
                <button class="action-btn edit-btn" data-id="${customer.id}" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete-btn" data-id="${customer.id}" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        `;

        // एडिट बटन का लॉजिक (अभी सिर्फ अलर्ट दिखाएगा)
        const editBtn = row.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                alert(`Edit action for customer ID: ${customer.id}. Functionality to be implemented.`);
                // भविष्य में: आप यहाँ एडिट फॉर्म खोलने का लॉजिक लिख सकते हैं
                // window.location.href = `edit_customer.html?id=${customer.id}`;
            });
        }

        // डिलीट बटन का लॉजिक
        const deleteBtn = row.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => deleteCustomer(customer.id, customer.fullName));
        }

        // Row click listener (अभी निष्क्रिय)
        // row.addEventListener('click', (event) => {
        //     if (!event.target.closest('.action-btn')) { // बटन क्लिक न हो तो
        //         showCustomerDetailsAndOrders(customer.id);
        //     }
        // });
    });
    addActionButtonStyles(); // बटन स्टाइलिंग
}

// --- कस्टमर डिलीट फंक्शन ---
async function deleteCustomer(id, name) {
     if (!id) {
        console.error("Delete failed: Invalid ID.");
        return;
     }
     if (confirm(`Are you sure you want to delete customer "${name || 'this customer'}"?`)) {
        try {
            if (!db || !doc || !deleteDoc) throw new Error("Firestore functions not available.");
            await deleteDoc(doc(db, "customers", id));
            alert("Customer deleted successfully!");
            // लिस्ट onSnapshot के कारण अपने आप अपडेट हो जाएगी
        } catch (error) {
            console.error("Error deleting customer: ", error);
            alert("Error deleting customer: " + error.message);
        }
     }
}

// --- फ़िल्टरिंग लॉजिक ---
function applyFilters() {
    const nameFilter = filterNameInput?.value.toLowerCase().trim() || '';
    const cityFilter = filterCityInput?.value.toLowerCase().trim() || '';
    const mobileFilter = filterMobileInput?.value.trim() || ''; // मोबाइल नंबर केस सेंसिटिव नहीं होना चाहिए

    const filteredCustomers = allCustomers.filter(customer => {
        const nameMatch = !nameFilter || (customer.fullName && customer.fullName.toLowerCase().includes(nameFilter));
        const cityMatch = !cityFilter || (customer.city && customer.city.toLowerCase().includes(cityFilter));
        const mobileMatch = !mobileFilter || (customer.whatsappNo && customer.whatsappNo.includes(mobileFilter));
        return nameMatch && cityMatch && mobileMatch;
    });
    displayCustomers(filteredCustomers);
}

// फ़िल्टर इनपुट पर इवेंट लिसनर (टाइप करते ही फ़िल्टर करें)
if (filterNameInput) filterNameInput.addEventListener('input', applyFilters);
if (filterCityInput) filterCityInput.addEventListener('input', applyFilters);
if (filterMobileInput) filterMobileInput.addEventListener('input', applyFilters);


// --- कस्टमर डिटेल्स और ऑर्डर दिखाने का लॉजिक (भविष्य के लिए) ---
// function showCustomerDetailsAndOrders(customerId) {
//     console.log("Show details for customer:", customerId);
//     // यहाँ localStorage की जगह Firestore से ग्राहक और ऑर्डर डेटा लाने का लॉजिक आएगा
//     // customerDetailsDiv.style.display = 'block';
//     // customerOrdersDiv.style.display = 'block';
// }


// --- एक्शन बटन स्टाइलिंग ---
function addActionButtonStyles() {
    const styleId = 'customer-action-btn-styles';
    if (!document.getElementById(styleId)) {
        const styleSheet = document.createElement("style");
        styleSheet.id = styleId;
        styleSheet.innerHTML = `
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

console.log("customer_management.js loaded.");