// js/order_history.js

// Firestore फंक्शन्स window ऑब्जेक्ट से उपलब्ध होने चाहिए
const { db, collection, onSnapshot, doc, getDoc, deleteDoc, query, where, orderBy } = window;

// --- DOM एलिमेंट रेफरेंस ---
let tableBody;
let prevPageButton;
let nextPageButton;
let pageInfoSpan;
let searchInput;
let filterDateInput;
let filterStatusSelect;
let showEntriesSelect;
let editModal;
let modalCloseBtn;
let modalBody;
let modalDeleteBtn;

// --- ग्लोबल वेरिएबल्स ---
let currentPage = 1;
let rowsPerPage = 10; // डिफ़ॉल्ट
let allOrders = []; // Firestore से आए सभी ऑर्डर्स
let filteredOrders = []; // फ़िल्टर के बाद बचे ऑर्डर्स
let currentOrderListenerUnsub = null; // Listener को बंद करने के लिए
let orderIdToDelete = null; // Modal में डिलीट करने के लिए ऑर्डर ID स्टोर करें

// --- फंक्शन परिभाषाएं ---

// टेबल में ऑर्डर दिखाने का फंक्शन
function renderTableRows(ordersForPage) {
    if (!tableBody) return;
    tableBody.innerHTML = ''; // टेबल खाली करें

    if (ordersForPage.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center;">No orders found matching criteria.</td></tr>`;
        return;
    }

    ordersForPage.forEach(order => {
        const row = tableBody.insertRow();
        const customerName = order.customerDetails?.fullName || 'N/A'; // कस्टमर का नाम निकालें
        const whatsappNo = order.customerDetails?.whatsappNo || '';

        row.insertCell().textContent = order.orderId || order.id; // कस्टम orderId या Firestore ID
        row.insertCell().textContent = customerName;
        row.insertCell().textContent = order.orderDate || '-';
        row.insertCell().textContent = order.deliveryDate || '-';
        row.insertCell().textContent = order.urgent || 'No';
        row.insertCell().textContent = order.status || '-';

        // Actions सेल
        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions'); // CSS क्लास
        actionsCell.innerHTML = `<button class="edit-button" data-id="${order.id}">Edit/View</button>`; // Firestore ID इस्तेमाल करें

        // WhatsApp सेल
        const whatsappCell = row.insertCell();
        whatsappCell.classList.add('send-wtsp-cell');
        if (whatsappNo) {
             // Format message (Example)
            const message = encodeURIComponent(`Regarding your order ${order.orderId || order.id}...`);
            whatsappCell.innerHTML = `<a href="https://wa.me/${whatsappNo}?text=${message}" target="_blank" title="Send WhatsApp to ${customerName}"><i class="fab fa-whatsapp whatsapp-icon"></i></a>`;
        } else {
            whatsappCell.innerHTML = '-';
        }

        // Edit बटन के लिए Event Listener
        const editBtn = actionsCell.querySelector('.edit-button');
        if(editBtn) {
            editBtn.addEventListener('click', () => {
                openEditModal(order.id); // Firestore ID पास करें
            });
        }
    });
}

// पेजिनेशन अपडेट फंक्शन
function updatePagination(totalFilteredRows) {
    if (!pageInfoSpan || !prevPageButton || !nextPageButton) return;

    rowsPerPage = parseInt(showEntriesSelect?.value || '10'); // वर्तमान सिलेक्शन लें
    const totalPages = Math.ceil(totalFilteredRows / rowsPerPage);
    currentPage = Math.max(1, Math.min(currentPage, totalPages)); // सुनिश्चित करें कि currentPage वैलिड है

    pageInfoSpan.textContent = `Page ${currentPage} of ${Math.max(totalPages, 1)}`;
    prevPageButton.disabled = currentPage === 1;
    nextPageButton.disabled = currentPage === totalPages || totalPages === 0;
}

// पेज बदलने का फंक्शन
function goToPage(page) {
    const totalPages = Math.ceil(filteredOrders.length / rowsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        displayPaginatedOrders();
    }
}

// फ़िल्टर और पेजिनेशन लागू करने का फंक्शन
function applyFiltersAndPagination() {
    // 1. फ़िल्टर करें
    const searchTerm = searchInput?.value.toLowerCase().trim() || '';
    const filterDate = filterDateInput?.value || '';
    const filterStatus = filterStatusSelect?.value || '';

    filteredOrders = allOrders.filter(order => {
        const searchMatch = !searchTerm ||
                            (order.orderId && String(order.orderId).toLowerCase().includes(searchTerm)) ||
                            (order.customerDetails?.fullName && order.customerDetails.fullName.toLowerCase().includes(searchTerm));
        const dateMatch = !filterDate || order.orderDate === filterDate;
        const statusMatch = !filterStatus || order.status === filterStatus;
        return searchMatch && dateMatch && statusMatch;
    });

    // 2. पेजिनेशन अपडेट करें और दिखाएं
    currentPage = 1; // फ़िल्टर बदलने पर पहले पेज पर जाएं
    displayPaginatedOrders();
}

// वर्तमान पेज के लिए ऑर्डर दिखाने का फंक्शन
function displayPaginatedOrders() {
    if(!tableBody) return;
    rowsPerPage = parseInt(showEntriesSelect?.value || '10');
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageOrders = filteredOrders.slice(startIndex, endIndex);

    renderTableRows(pageOrders);
    updatePagination(filteredOrders.length);
}


// Edit Modal खोलने और डेटा भरने का फंक्शन
async function openEditModal(orderDocId) {
    if (!editModal || !modalBody || !modalDeleteBtn) {
        console.error("Modal elements not found!");
        return;
    }
     if (!db || !doc || !getDoc) {
         alert("Database functions not available.");
         return;
     }

    modalBody.innerHTML = '<p>Loading order details...</p>'; // लोडिंग दिखाएं
    editModal.style.display = "block";
    orderIdToDelete = null; // पुराने ID को क्लियर करें

    try {
        const orderRef = doc(db, "orders", orderDocId);
        const docSnap = await getDoc(orderRef);

        if (docSnap.exists()) {
            const order = docSnap.data();
            orderIdToDelete = orderDocId; // डिलीट के लिए ID स्टोर करें

            // Modal बॉडी में डिटेल्स भरें
            let productsHtml = '<ul>';
            if (order.products && order.products.length > 0) {
                order.products.forEach(p => {
                    productsHtml += `<li>${p.name || 'N/A'} - Qty: ${p.quantity || 'N/A'}</li>`;
                });
            } else {
                productsHtml += '<li>No products listed</li>';
            }
            productsHtml += '</ul>';

            modalBody.innerHTML = `
                <p><strong>Order ID:</strong> ${order.orderId || orderDocId}</p>
                <p><strong>Customer Name:</strong> ${order.customerDetails?.fullName || 'N/A'}</p>
                <p><strong>WhatsApp No:</strong> ${order.customerDetails?.whatsappNo || 'N/A'}</p>
                <p><strong>Address:</strong> ${order.customerDetails?.address || 'N/A'}</p>
                <hr>
                <p><strong>Order Date:</strong> ${order.orderDate || 'N/A'}</p>
                <p><strong>Delivery Date:</strong> ${order.deliveryDate || 'N/A'}</p>
                <p><strong>Priority:</strong> ${order.urgent || 'N/A'}</p>
                <p><strong>Status:</strong> ${order.status || 'N/A'}</p>
                <p><strong>Remarks:</strong> ${order.remarks || 'N/A'}</p>
                <hr>
                <strong>Products:</strong>
                ${productsHtml}
            `;
             // डिलीट बटन को अब इनेबल करें (अगर ज़रूरत हो)
             modalDeleteBtn.disabled = false;

        } else {
            console.error("Order document not found!");
            modalBody.innerHTML = '<p style="color:red;">Error: Order details not found.</p>';
             modalDeleteBtn.disabled = true; // डिलीट डिसेबल करें
        }
    } catch (error) {
        console.error("Error fetching order details for modal:", error);
        modalBody.innerHTML = '<p style="color:red;">Error loading order details.</p>';
         modalDeleteBtn.disabled = true;
    }
}

// Modal बंद करने का फंक्शन
function closeModal() {
    if (editModal) {
        editModal.style.display = "none";
        orderIdToDelete = null; // स्टोर्ड ID क्लियर करें
    }
}

// Firestore से ऑर्डर डिलीट करने का फंक्शन
async function deleteOrderFromFirestore() {
    if (!orderIdToDelete) {
        alert("No order selected for deletion.");
        return;
    }
    if (!db || !doc || !deleteDoc) {
        alert("Database delete function not available.");
        return;
    }

    if (confirm(`Are you sure you want to delete order ID ${orderIdToDelete}? This cannot be undone.`)) {
        try {
             modalDeleteBtn.disabled = true; // डिलीट बटन डिसेबल करें
             modalDeleteBtn.textContent = 'Deleting...';

             await deleteDoc(doc(db, "orders", orderIdToDelete));
             alert("Order deleted successfully!");
             closeModal(); // Modal बंद करें
             // लिस्ट onSnapshot से अपने आप अपडेट हो जाएगी

        } catch (error) {
            console.error("Error deleting order:", error);
            alert("Error deleting order: " + error.message);
            modalDeleteBtn.disabled = false; // एरर आने पर इनेबल करें
            modalDeleteBtn.textContent = 'Delete Order';
        }
    }
}


// --- Firestore Listener सेट अप ---
function listenToOrders() {
    if (currentOrderListenerUnsub) { currentOrderListenerUnsub(); currentOrderListenerUnsub = null; }
    try {
        if (!db) throw new Error("Firestore not initialized");
        const ordersRef = collection(db, "orders");
        // तारीख के अनुसार सॉर्ट करें (सबसे नया पहले)
        const q = query(ordersRef, orderBy("createdAt", "desc"));

        currentOrderListenerUnsub = onSnapshot(q, (snapshot) => {
            console.log("Order snapshot received");
            allOrders = [];
            snapshot.forEach((doc) => {
                allOrders.push({ id: doc.id, ...doc.data() }); // Firestore ID भी सेव करें
            });
            console.log("Total orders fetched:", allOrders.length);
            // डेटा आने पर फ़िल्टर और पेजिनेशन लागू करें
            applyFiltersAndPagination();

        }, (error) => {
            console.error("Error listening to order updates: ", error);
            if(tableBody) tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:red;">Error loading orders. Check console.</td></tr>`;
        });
    } catch (e) {
        console.error("Error setting up Firestore listener: ", e);
         if(tableBody) tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:red;">Database connection error. Check console.</td></tr>`;
    }
}

// --- इवेंट लिसनर्स ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded: order_history.js");

    // DOM एलिमेंट्स प्राप्त करें
    tableBody = document.querySelector('#order-table tbody');
    prevPageButton = document.querySelector('#prev-page');
    nextPageButton = document.querySelector('#next-page');
    pageInfoSpan = document.querySelector('#page-info');
    searchInput = document.querySelector('#search-order');
    filterDateInput = document.querySelector('#filter-date');
    filterStatusSelect = document.querySelector('#filter-status');
    // filterButton = document.querySelector('#filter-button'); // यह बटन अब इस्तेमाल में नहीं है
    showEntriesSelect = document.querySelector('#show-entries');
    editModal = document.getElementById("editModal");
    modalCloseBtn = editModal?.querySelector(".close"); // Modal के अंदर वाला क्लोज बटन
    modalBody = document.getElementById("modal-body");
    modalDeleteBtn = document.getElementById("modalDeleteBtn"); // डिलीट बटन को ID दें

    // बेसिक जांच
    if (!tableBody || !prevPageButton || !nextPageButton || !pageInfoSpan || !searchInput || !filterDateInput || !filterStatusSelect || !showEntriesSelect || !editModal || !modalCloseBtn || !modalBody || !modalDeleteBtn) {
        console.error("One or more essential page elements are missing!");
        return;
    }

    // इवेंट लिसनर्स लगाएं
    prevPageButton.addEventListener('click', () => goToPage(currentPage - 1));
    nextPageButton.addEventListener('click', () => goToPage(currentPage + 1));
    showEntriesSelect.addEventListener('change', () => { currentPage = 1; applyFiltersAndPagination(); });
    searchInput.addEventListener('input', applyFiltersAndPagination);
    filterDateInput.addEventListener('change', applyFiltersAndPagination);
    filterStatusSelect.addEventListener('change', applyFiltersAndPagination);
    // filterButton?.addEventListener('click', applyFiltersAndPagination); // Filter बटन हटा दिया गया है

    // Modal इवेंट्स
    modalCloseBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => { if (event.target === editModal) closeModal(); });
    modalDeleteBtn.addEventListener('click', deleteOrderFromFirestore);

    // Firebase तैयार होने का इंतज़ार करें और Listener शुरू करें
    const checkDbInterval = setInterval(() => {
        if (window.db) {
            clearInterval(checkDbInterval);
            console.log("DB ready, starting order listener.");
            listenToOrders(); // DB तैयार होने पर ही Listener शुरू करें
        } else { console.log("Waiting for DB in order_history.js..."); }
    }, 100);

    console.log("order_history.js initialization setup complete.");
});