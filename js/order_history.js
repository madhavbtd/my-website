// js/order_history.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");

    // --- ग्लोबल वेरिएबल्स ---
    let currentPage = 1;
    let rowsPerPage = 10;
    let allOrders = []; // Firestore से आए सभी ऑर्डर्स
    let filteredOrders = []; // फ़िल्टर के बाद बचे ऑर्डर्स
    let currentOrderListenerUnsub = null; // Firestore listener को बंद करने के लिए
    let orderIdForModal = null; // Modal में किस ऑर्डर का विवरण दिखाना है

    // --- DOM एलिमेंट रेफरेंस ---
    const elements = {
        tableBody: document.querySelector('#order-table tbody'),
        prevPageButton: document.getElementById('prev-page'),
        nextPageButton: document.getElementById('next-page'),
        pageInfoSpan: document.getElementById('page-info'),
        searchInput: document.getElementById('search-input'),
        filterDateInput: document.getElementById('filter-date'),
        filterStatusSelect: document.getElementById('filter-status'),
        showEntriesSelect: document.getElementById('show-entries'),
        modalOverlay: document.getElementById('detailsModal'), // ओवरले का ID बदला गया
        modalBody: document.getElementById('modalBody'),
        modalCloseBtn: document.getElementById('modalCloseBtn'),
        modalDeleteBtn: document.getElementById('modalDeleteBtn'),
        modalGoToEditBtn: document.getElementById('modalGoToEditBtn')
    };

    // --- एलिमेंट वेरिफिकेशन ---
    let allElementsFound = true;
    const missingElements = [];
    for (const key in elements) {
        if (!elements[key]) {
            allElementsFound = false;
            missingElements.push(`#${key} or element for ${key}`); // Log which element is missing
            console.error(`Initialization failed: Element "${key}" not found.`);
        }
    }

    if (!allElementsFound) {
        console.error("CRITICAL ERROR: Essential page elements are missing:", missingElements.join(', '));
        alert("Page Error: Could not find essential elements. Check console (F12).");
        // पेज पर एरर दिखाएं यदि संभव हो
        if (elements.tableBody) {
            elements.tableBody.innerHTML = `<tr><td colspan="8" style="color:red; text-align:center; font-weight:bold;">Page Initialization Error! Check Console (F12). Missing: ${missingElements.join(', ')}</td></tr>`;
        }
        return; // आगे का कोड न चलाएं
    }
    console.log("All essential page elements found.");


    // --- Firestore फंक्शन्स (विंडो ऑब्जेक्ट से प्राप्त करें) ---
    const { db, collection, onSnapshot, doc, getDoc, deleteDoc, query, where, orderBy } = window;

    // जांचें कि क्या Firestore फंक्शन्स उपलब्ध हैं
    if (!db || !collection || !onSnapshot || !doc || !getDoc || !deleteDoc || !query || !where || !orderBy) {
        console.error("Firestore functions are not available on the window object. Firebase initialization might have failed.");
        alert("Database functions error. Check console (F12).");
        if (elements.tableBody) {
             elements.tableBody.innerHTML = `<tr><td colspan="8" class="loading-message" style="color:red;">Database connection error!</td></tr>`;
        }
        return;
    }
    console.log("Firestore functions seem available.");


    // --- फंक्शन परिभाषाएं ---

    // टेबल में ऑर्डर दिखाने का फंक्शन
    function renderTableRows(ordersForPage) {
        elements.tableBody.innerHTML = ''; // पुरानी पंक्तियाँ साफ़ करें

        if (!ordersForPage || ordersForPage.length === 0) {
            elements.tableBody.innerHTML = `<tr><td colspan="8" class="no-results-message">No orders found matching criteria.</td></tr>`;
            return;
        }

        ordersForPage.forEach(order => {
            const row = elements.tableBody.insertRow();
            const customerName = order.customerDetails?.fullName || 'N/A';
            const whatsappNo = order.customerDetails?.whatsappNo || '';
            const firestoreOrderId = order.id; // Firestore Document ID

            // सेल बनाएं और डेटा डालें
            row.insertCell().textContent = order.orderId || firestoreOrderId;
            row.insertCell().textContent = customerName;
            row.insertCell().textContent = order.orderDate || '-';
            row.insertCell().textContent = order.deliveryDate || '-';
            row.insertCell().textContent = order.urgent || 'No';
            row.insertCell().textContent = order.status || '-';

            // एक्शन सेल
            const actionsCell = row.insertCell();
            actionsCell.classList.add('actions'); // CSS क्लास
            const detailsButton = document.createElement('button');
            detailsButton.textContent = 'Details/Edit';
            detailsButton.classList.add('edit-details-button'); // CSS क्लास
            detailsButton.dataset.id = firestoreOrderId; // डेटा-आईडी सेट करें
            detailsButton.addEventListener('click', () => openDetailsModal(firestoreOrderId));
            actionsCell.appendChild(detailsButton);

            // WhatsApp सेल
            const whatsappCell = row.insertCell();
            whatsappCell.classList.add('send-wtsp-cell'); // CSS क्लास
            if (whatsappNo) {
                const cleanWhatsAppNo = String(whatsappNo).replace(/[^0-9]/g, '');
                if (cleanWhatsAppNo) {
                    const message = encodeURIComponent(`Regarding your order ${order.orderId || firestoreOrderId}...`);
                    whatsappCell.innerHTML = `<a href="https://wa.me/${cleanWhatsAppNo}?text=${message}" target="_blank" title="Send WhatsApp to ${customerName}" class="whatsapp-icon"><i class="fab fa-whatsapp"></i></a>`;
                } else {
                    whatsappCell.innerHTML = '-';
                }
            } else {
                whatsappCell.innerHTML = '-';
            }
        });
    }

    // पेजिनेशन अपडेट फंक्शन
    function updatePagination(totalFilteredRows) {
        rowsPerPage = parseInt(elements.showEntriesSelect.value || '10');
        const totalPages = Math.ceil(totalFilteredRows / rowsPerPage);
        currentPage = Math.max(1, Math.min(currentPage, totalPages || 1)); // सुनिश्चित करें कि currentPage वैलिड है

        elements.pageInfoSpan.textContent = `Page ${currentPage} of ${Math.max(totalPages, 1)}`;
        elements.prevPageButton.disabled = currentPage === 1;
        elements.nextPageButton.disabled = currentPage === totalPages || totalPages === 0;
    }

    // पेज बदलने का फंक्शन
    function goToPage(page) {
        const totalPages = Math.ceil(filteredOrders.length / rowsPerPage);
        if (page >= 1 && page <= Math.max(totalPages, 1)) {
            currentPage = page;
            displayPaginatedOrders();
        }
    }

    // फ़िल्टर और पेजिनेशन लागू करने का फंक्शन
    function applyFiltersAndPagination() {
        const searchTerm = elements.searchInput.value.toLowerCase().trim();
        const filterDate = elements.filterDateInput.value;
        const filterStatus = elements.filterStatusSelect.value;

        // पहले फ़िल्टर करें
        filteredOrders = allOrders.filter(order => {
            const searchMatch = !searchTerm ||
                                (order.orderId && String(order.orderId).toLowerCase().includes(searchTerm)) ||
                                (order.customerDetails?.fullName && order.customerDetails.fullName.toLowerCase().includes(searchTerm)) ||
                                (order.id && order.id.toLowerCase().includes(searchTerm)); // Firestore ID से भी खोजें
            const dateMatch = !filterDate || order.orderDate === filterDate;
            const statusMatch = !filterStatus || order.status === filterStatus;
            return searchMatch && dateMatch && statusMatch;
        });

        // फ़िल्टर के बाद पहले पेज पर जाएं
        currentPage = 1;
        // फिर पेजिनेशन के साथ दिखाएं
        displayPaginatedOrders();
    }

    // वर्तमान पेज के लिए ऑर्डर दिखाने का फंक्शन
    function displayPaginatedOrders() {
        rowsPerPage = parseInt(elements.showEntriesSelect.value || '10');
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const pageOrders = filteredOrders.slice(startIndex, endIndex);

        renderTableRows(pageOrders);
        updatePagination(filteredOrders.length);
    }

    // विवरण मोडाल खोलने और डेटा भरने का फंक्शन
    async function openDetailsModal(orderDocId) {
        console.log("Opening modal for order ID:", orderDocId);
        orderIdForModal = orderDocId; // ID स्टोर करें ताकि डिलीट और एडिट में इस्तेमाल हो सके
        elements.modalBody.innerHTML = '<p class="loading-message">Loading details...</p>';
        elements.modalDeleteBtn.disabled = true; // डिलीट बटन अक्षम करें जब तक डेटा लोड न हो
        elements.modalOverlay.classList.add('active'); // मोडाल दिखाएं

        try {
            const orderRef = doc(db, "orders", orderDocId);
            const docSnap = await getDoc(orderRef);

            if (docSnap.exists()) {
                const order = docSnap.data();
                console.log("Order details fetched:", order);

                // उत्पादों की लिस्ट बनाएं
                let productsHtml = '<ul>';
                if (order.products && Array.isArray(order.products) && order.products.length > 0) {
                    order.products.forEach(p => {
                        productsHtml += `<li>${p.name || 'N/A'} - Qty: ${p.quantity || 'N/A'}</li>`;
                    });
                } else {
                    productsHtml += '<li>No products listed</li>';
                }
                productsHtml += '</ul>';

                // मोडाल बॉडी में HTML भरें
                elements.modalBody.innerHTML = `
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
                elements.modalDeleteBtn.disabled = false; // डेटा लोड होने के बाद डिलीट बटन सक्षम करें

            } else {
                console.error("Order document not found in modal! ID:", orderDocId);
                elements.modalBody.innerHTML = '<p class="loading-message" style="color:red;">Error: Order details not found.</p>';
            }
        } catch (error) {
            console.error("Error fetching order details for modal:", error);
            elements.modalBody.innerHTML = `<p class="loading-message" style="color:red;">Error loading details: ${error.message}</p>`;
        }
    }

    // मोडाल बंद करने का फंक्शन
    function closeModal() {
        if (elements.modalOverlay) {
            elements.modalOverlay.classList.remove('active');
            orderIdForModal = null; // स्टोर की गई ID साफ़ करें
            console.log("Modal closed.");
        }
    }

    // Firestore से ऑर्डर डिलीट करने का फंक्शन
    async function deleteOrderFromFirestore() {
        if (!orderIdForModal) {
            alert("No order selected for deletion.");
            return;
        }
        if (!db || !doc || !deleteDoc) {
             alert("Database delete function not available.");
             return;
        }

        if (confirm(`Are you sure you want to delete this order (${orderIdForModal})? This cannot be undone.`)) {
            console.log("Attempting to delete order:", orderIdForModal);
            elements.modalDeleteBtn.disabled = true;
            elements.modalDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...'; // Loading state

            try {
                 await deleteDoc(doc(db, "orders", orderIdForModal));
                 alert("Order deleted successfully!");
                 console.log("Order deleted:", orderIdForModal);
                 closeModal(); // मोडाल बंद करें
                 // टेबल अपने आप अपडेट हो जाएगी onSnapshot के कारण
            } catch (error) {
                console.error("Error deleting order:", error);
                alert("Error deleting order: " + error.message);
                elements.modalDeleteBtn.disabled = false; // एरर आने पर बटन फिर सक्षम करें
            } finally {
                 // बटन का टेक्स्ट वापस सेट करें (यदि अभी भी मौजूद है)
                 if (elements.modalDeleteBtn){
                     elements.modalDeleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Order';
                 }
            }
        }
    }

    // एडिट पेज पर रीडायरेक्ट करने का फंक्शन
    function redirectToEditPage() {
        if (orderIdForModal) {
            console.log("Redirecting to edit page for order:", orderIdForModal);
            window.location.href = `new_order.html?editOrderId=${orderIdForModal}`;
        } else {
            alert("Could not determine which order to edit.");
            console.warn("redirectToEditPage called without orderIdForModal set.");
        }
    }


    // --- Firestore Listener सेट अप ---
    function listenToOrders() {
        // यदि पहले से कोई listener चल रहा है, तो उसे बंद करें
        if (currentOrderListenerUnsub) {
            console.log("Stopping previous Firestore listener.");
            currentOrderListenerUnsub();
        }

        try {
            console.log("Setting up Firestore listener for 'orders' collection...");
            const ordersRef = collection(db, "orders");
            const q = query(ordersRef, orderBy("createdAt", "desc")); // नए ऑर्डर सबसे ऊपर

            currentOrderListenerUnsub = onSnapshot(q, (snapshot) => {
                console.log(`Snapshot received: ${snapshot.size} documents.`);
                allOrders = []; // पुरानी लिस्ट खाली करें
                snapshot.forEach((doc) => {
                    allOrders.push({ id: doc.id, ...doc.data() }); // ID और डेटा स्टोर करें
                });
                console.log("Total orders processed:", allOrders.length);
                // डेटा आने/बदलने पर फिल्टर और पेजिनेशन लागू करें
                applyFiltersAndPagination();

            }, (error) => {
                // Listener में एरर आने पर
                console.error("Error listening to order updates: ", error);
                elements.tableBody.innerHTML = `<tr><td colspan="8" class="loading-message" style="color:red;">Error loading orders: ${error.message}. Check console.</td></tr>`;
            });
            console.log("Firestore listener successfully attached.");

        } catch (e) {
            // Listener सेट अप करने में एरर आने पर
            console.error("Failed to set up Firestore listener: ", e);
            elements.tableBody.innerHTML = `<tr><td colspan="8" class="loading-message" style="color:red;">Database listener error: ${e.message}. Check console.</td></tr>`;
        }
    }

    // --- इवेंट लिसनर्स जोड़ें ---
    elements.prevPageButton.addEventListener('click', () => goToPage(currentPage - 1));
    elements.nextPageButton.addEventListener('click', () => goToPage(currentPage + 1));
    elements.showEntriesSelect.addEventListener('change', () => { currentPage = 1; applyFiltersAndPagination(); });
    elements.searchInput.addEventListener('input', applyFiltersAndPagination); // हर कीस्ट्रोक पर फिल्टर करें
    elements.filterDateInput.addEventListener('change', applyFiltersAndPagination);
    elements.filterStatusSelect.addEventListener('change', applyFiltersAndPagination);

    // मोडाल इवेंट्स
    elements.modalCloseBtn.addEventListener('click', closeModal);
    elements.modalOverlay.addEventListener('click', (event) => {
        // यदि क्लिक ओवरले (पृष्ठभूमि) पर हुआ हो, न कि कंटेंट पर
        if (event.target === elements.modalOverlay) {
            closeModal();
        }
    });
    elements.modalDeleteBtn.addEventListener('click', deleteOrderFromFirestore);
    elements.modalGoToEditBtn.addEventListener('click', redirectToEditPage);

    // --- इनिशियलाइज़ेशन ---
    console.log("Adding initial styles via JS (basic table layout)...");
    // addCustomStyles(); // बेसिक टेबल स्टाइलिंग CSS में है, JS की शायद जरूरत नहीं

    console.log("Starting listener to wait for DB connection and fetch initial data...");
    // DB तैयार होने का इंतज़ार करें और फिर ऑर्डर सुनना शुरू करें
    const checkDbInterval = setInterval(() => {
        if (window.db) { // जांचें कि क्या Firebase init स्क्रिप्ट ने db सेट किया है
            clearInterval(checkDbInterval);
            console.log("DB connection ready. Initializing order listener...");
            listenToOrders(); // ऑर्डर सुनना शुरू करें
        } else {
            console.log("Waiting for DB connection...");
        }
    }, 200); // हर 200ms पर जांचें

    console.log("Order History page script initialization complete.");

}); // End DOMContentLoaded Listener