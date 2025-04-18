[Filename: order_history.js]
// js/order_history.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed for Order History.");

    // --- ग्लोबल वेरिएबल्स ---
    let currentPage = 1;
    let rowsPerPage = 10;
    let allOrders = [];
    let filteredOrders = [];
    let currentOrderListenerUnsub = null;
    let orderIdForModal = null; // Firestore Doc ID
    let orderDisplayIdForModal = null; // Not strictly needed yet
    let customerDetailsForModal = null; // Not strictly needed yet

    // --- DOM एलिमेंट रेफरेंस (Add new modal elements) ---
    const elements = {
        tableBody: document.querySelector('#order-table tbody'),
        prevPageButton: document.getElementById('prev-page'),
        nextPageButton: document.getElementById('next-page'),
        pageInfoSpan: document.getElementById('page-info'),
        searchInput: document.getElementById('search-input'),
        filterDateInput: document.getElementById('filter-date'),
        filterStatusSelect: document.getElementById('filter-status'),
        showEntriesSelect: document.getElementById('show-entries'),
        modalOverlay: document.getElementById('detailsModal'),
        modalBody: document.getElementById('modalBody'),
        // Specific divs within modal body (Ensure these exist in HTML)
        modalOrderInfo: document.getElementById('modalOrderInfo'),
        modalProductList: document.getElementById('modalProductList'),
        modalRemarksText: document.getElementById('modalRemarksText'),
        // Modal Buttons & Controls
        modalCloseBtn: document.getElementById('modalCloseBtn'),
        modalDeleteBtn: document.getElementById('modalDeleteBtn'),
        modalGoToEditBtn: document.getElementById('modalGoToEditBtn'),
        modalStatusSelect: document.getElementById('modalStatusSelect'), // Added dropdown ref
        modalSaveStatusBtn: document.getElementById('modalSaveStatusBtn'), // Added save button ref
        // WhatsApp elements are not needed yet for this step
    };

    // --- एलिमेंट वेरिफिकेशन ---
    let allElementsFound = true;
    const missingElements = [];
    for (const key in elements) {
        if (!elements[key]) {
            // Allow optional elements but warn
             if (key.startsWith('whatsapp') || key.startsWith('popupCloseBtnHistory') || key.startsWith('modalOrderInfo') || key.startsWith('modalProductList') || key.startsWith('modalRemarksText') ) {
                 console.warn(`DEBUG: Optional element reference missing or null for "${key}". Check HTML ID. Dependent features might fail.`);
             } else {
                 // Consider these critical
                 allElementsFound = false;
                 missingElements.push(key);
                 console.error(`Initialization failed: Essential element "${key}" not found or null.`);
             }
        }
    }

    if (!allElementsFound) {
        console.error("CRITICAL ERROR: Essential page elements are missing:", missingElements.join(', '));
        alert("Page Error: Could not find essential elements. Check console (F12).");
        if (elements.tableBody) {
            elements.tableBody.innerHTML = `<tr><td colspan="8" style="color:red; text-align:center; font-weight:bold;">Page Initialization Error! Missing: ${missingElements.join(', ')}</td></tr>`;
        }
        return;
    }
    console.log("All essential page elements referenced.");

    // --- Firestore फंक्शन्स (Ensure updateDoc is available) ---
    const { db, collection, onSnapshot, doc, getDoc, deleteDoc, updateDoc, query, where, orderBy } = window; // Added updateDoc

    if (!db || !collection || !onSnapshot || !doc || !getDoc || !deleteDoc || !updateDoc || !query || !where || !orderBy) { // Added updateDoc check
        console.error("Firestore functions are not available on the window object.");
        if (elements.tableBody) {
             elements.tableBody.innerHTML = `<tr><td colspan="8" class="loading-message" style="color:red;">Database connection error!</td></tr>`;
        }
        return;
    }
    console.log("Firestore functions seem available.");

    // --- फंक्शन परिभाषाएं ---

    // टेबल में ऑर्डर दिखाने का फंक्शन (Updated button text)
    function renderTableRows(ordersForPage) {
        if (!elements.tableBody) return;
        elements.tableBody.innerHTML = '';

        if (!ordersForPage || ordersForPage.length === 0) {
            elements.tableBody.innerHTML = `<tr><td colspan="8" class="no-results-message">No orders found matching criteria.</td></tr>`;
            return;
        }

        ordersForPage.forEach(order => {
            const row = elements.tableBody.insertRow();
            const customerName = order.customerDetails?.fullName || 'N/A';
            const whatsappNo = order.customerDetails?.whatsappNo || '';
            const firestoreOrderId = order.id;
            const displayOrderId = order.orderId || firestoreOrderId;

            row.insertCell().textContent = displayOrderId;
            row.insertCell().textContent = customerName;
            row.insertCell().textContent = order.orderDate || '-';
            row.insertCell().textContent = order.deliveryDate || '-';
            row.insertCell().textContent = order.urgent || 'No';
            row.insertCell().textContent = order.status || '-'; // Static status in table

            // Action Cell
            const actionsCell = row.insertCell();
            actionsCell.classList.add('actions');
            const manageButton = document.createElement('button');
            manageButton.textContent = 'Manage Status'; // Changed Text
            manageButton.classList.add('edit-details-button');
            manageButton.dataset.id = firestoreOrderId;
            manageButton.addEventListener('click', () => openDetailsModal(firestoreOrderId)); // Only pass firestore ID now
            actionsCell.appendChild(manageButton);

            // WhatsApp Cell (No change)
            const whatsappCell = row.insertCell();
            whatsappCell.classList.add('send-wtsp-cell');
            if (whatsappNo) {
                const cleanWhatsAppNo = String(whatsappNo).replace(/[^0-9]/g, '');
                if (cleanWhatsAppNo) {
                    const message = encodeURIComponent(`Regarding your order ${displayOrderId}...`);
                    whatsappCell.innerHTML = `<a href="https://wa.me/${cleanWhatsAppNo}?text=${message}" target="_blank" title="Send WhatsApp to ${customerName}" class="whatsapp-icon"><i class="fab fa-whatsapp"></i></a>`;
                } else { whatsappCell.innerHTML = '-'; }
            } else { whatsappCell.innerHTML = '-'; }
        });
    }

    // Pagination functions (Original - UNTOUCHED)
    function updatePagination(totalFilteredRows) {
        if (!elements.showEntriesSelect || !elements.pageInfoSpan || !elements.prevPageButton || !elements.nextPageButton) return;
        rowsPerPage = parseInt(elements.showEntriesSelect.value || '10');
        const totalPages = Math.ceil(totalFilteredRows / rowsPerPage);
        currentPage = Math.max(1, Math.min(currentPage, totalPages || 1));
        elements.pageInfoSpan.textContent = `Page ${currentPage} of ${Math.max(totalPages, 1)}`;
        elements.prevPageButton.disabled = currentPage === 1;
        elements.nextPageButton.disabled = currentPage === totalPages || totalPages === 0;
    }
    function goToPage(page) {
        if (!filteredOrders) return;
        const totalPages = Math.ceil(filteredOrders.length / rowsPerPage);
        if (page >= 1 && page <= Math.max(totalPages, 1)) {
            currentPage = page;
            displayPaginatedOrders();
        }
    }
    function applyFiltersAndPagination() {
        if (!allOrders || !elements.searchInput || !elements.filterDateInput || !elements.filterStatusSelect) return;
        const searchTerm = elements.searchInput.value.toLowerCase().trim();
        const filterDate = elements.filterDateInput.value;
        const filterStatus = elements.filterStatusSelect.value;
        filteredOrders = allOrders.filter(order => {
            const searchMatch = !searchTerm || (order.orderId && String(order.orderId).toLowerCase().includes(searchTerm)) || (order.customerDetails?.fullName && order.customerDetails.fullName.toLowerCase().includes(searchTerm)) || (order.id && order.id.toLowerCase().includes(searchTerm));
            const dateMatch = !filterDate || order.orderDate === filterDate;
            const statusMatch = !filterStatus || order.status === filterStatus;
            return searchMatch && dateMatch && statusMatch;
        });
        currentPage = 1;
        displayPaginatedOrders();
    }
    function displayPaginatedOrders() {
        if (!filteredOrders || !elements.tableBody || !elements.showEntriesSelect) return;
        rowsPerPage = parseInt(elements.showEntriesSelect.value || '10');
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const pageOrders = filteredOrders.slice(startIndex, endIndex);
        renderTableRows(pageOrders);
        updatePagination(filteredOrders.length);
    }
    // --- End Pagination functions ---

    // *** MODIFIED: विवरण मोडाल खोलने और डेटा भरने का फंक्शन ***
    async function openDetailsModal(orderDocId) {
        // Ensure critical elements exist
        if (!elements.modalOverlay || !elements.modalOrderInfo || !elements.modalStatusSelect || !elements.modalProductList || !elements.modalRemarksText || !elements.modalDeleteBtn || !elements.modalSaveStatusBtn || !elements.modalGoToEditBtn) {
            console.error("Modal elements missing! Cannot open modal correctly.");
            return;
        }
        console.log("Opening modal for order Firestore ID:", orderDocId);
        orderIdForModal = orderDocId; // Store Firestore ID for actions
        // Reset temporary storage
        orderDisplayIdForModal = null;
        customerDetailsForModal = null;

        // Reset UI to loading state
        elements.modalOrderInfo.innerHTML = '<p class="loading-message">Loading details...</p>';
        elements.modalProductList.innerHTML = '<li>Loading products...</li>';
        elements.modalRemarksText.textContent = 'Loading...';
        elements.modalStatusSelect.disabled = true; // Disable dropdown during load
        elements.modalDeleteBtn.disabled = true;
        elements.modalSaveStatusBtn.disabled = true; // Disable save button during load
        elements.modalOverlay.classList.add('active'); // Show modal

        try {
            const orderRef = doc(db, "orders", orderDocId);
            const docSnap = await getDoc(orderRef);

            if (docSnap.exists()) {
                const order = { id: docSnap.id, ...docSnap.data() };
                console.log("Order details fetched for modal:", order);
                // Store data needed later (if implementing WhatsApp)
                // customerDetailsForModal = order.customerDetails;
                // orderDisplayIdForModal = order.orderId || order.id;

                // --- Populate Modal Sections ---
                 // Basic Info (Remove static status line from original template)
                 if (elements.modalOrderInfo) {
                    elements.modalOrderInfo.innerHTML = `
                        <p><strong>Order ID:</strong> ${order.orderId || order.id}</p>
                        <p><strong>Customer Name:</strong> ${order.customerDetails?.fullName || 'N/A'}</p>
                        <p><strong>WhatsApp No:</strong> ${order.customerDetails?.whatsappNo || 'N/A'}</p>
                        <p><strong>Address:</strong> ${order.customerDetails?.address || 'N/A'}</p>
                        <hr>
                        <p><strong>Order Date:</strong> ${order.orderDate || 'N/A'}</p>
                        <p><strong>Delivery Date:</strong> ${order.deliveryDate || 'N/A'}</p>
                        <p><strong>Priority:</strong> ${order.urgent || 'N/A'}</p>
                        `;
                }

                // Status Dropdown - Set value and enable
                if (elements.modalStatusSelect) {
                    elements.modalStatusSelect.value = order.status || 'Order Received';
                    elements.modalStatusSelect.disabled = false;
                }

                // Product List
                if (elements.modalProductList) {
                    elements.modalProductList.innerHTML = ''; // Clear loading
                    if (order.products && Array.isArray(order.products) && order.products.length > 0) {
                        order.products.forEach(p => {
                            const li = document.createElement('li');
                            li.textContent = `${p.name || 'N/A'} - Qty: ${p.quantity || 'N/A'}`;
                            elements.modalProductList.appendChild(li);
                        });
                    } else {
                        elements.modalProductList.innerHTML = '<li>No products listed</li>';
                    }
                }

                 // Remarks
                 if (elements.modalRemarksText) {
                    elements.modalRemarksText.textContent = order.remarks || 'N/A';
                 }

                // Enable action buttons
                if (elements.modalDeleteBtn) elements.modalDeleteBtn.disabled = false;
                if (elements.modalSaveStatusBtn) elements.modalSaveStatusBtn.disabled = false; // Enable the new save button

            } else {
                console.error("Order document not found in modal! ID:", orderDocId);
                if(elements.modalOrderInfo) elements.modalOrderInfo.innerHTML = '<p class="loading-message" style="color:red;">Error: Order details not found.</p>';
                if(elements.modalProductList) elements.modalProductList.innerHTML = '';
                if(elements.modalRemarksText) elements.modalRemarksText.textContent = 'Error';
            }
        } catch (error) {
            console.error("Error fetching order details for modal:", error);
            if(elements.modalOrderInfo) elements.modalOrderInfo.innerHTML = `<p class="loading-message" style="color:red;">Error loading details.</p>`;
            if(elements.modalProductList) elements.modalProductList.innerHTML = '';
            if(elements.modalRemarksText) elements.modalRemarksText.textContent = 'Error';
            orderIdForModal = null; // Clear ID on error
        }
    }

    // मोडाल बंद करने का फंक्शन (Original - UNTOUCHED)
    function closeModal() {
        if (elements.modalOverlay) {
            elements.modalOverlay.classList.remove('active');
            orderIdForModal = null;
            // orderDisplayIdForModal = null; // Reset if needed
            // customerDetailsForModal = null; // Reset if needed
            console.log("Modal closed.");
        }
    }

    // *** NEW: मोडाल से स्टेटस सेव करने का फंक्शन ***
    async function saveStatusFromModal() {
        if (!orderIdForModal) { alert("Error: No order selected."); return; }
        if (!elements.modalStatusSelect || !elements.modalSaveStatusBtn) { alert("Error: Modal status elements missing."); return; }
        if (!db || !doc || !updateDoc) { alert("Database update function not available."); return; }

        const newStatus = elements.modalStatusSelect.value;
        // Find original status from allOrders to check if it actually changed
        const currentOrderData = allOrders.find(o => o.id === orderIdForModal);
        const originalStatus = currentOrderData?.status;

        if(newStatus === originalStatus){
            alert("Status has not changed.");
            // closeModal(); // Optionally close modal even if no change
            return;
        }

        console.log(`Attempting to update status for order ${orderIdForModal} to ${newStatus}`);

        elements.modalSaveStatusBtn.disabled = true;
        elements.modalSaveStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            const orderRef = doc(db, "orders", orderIdForModal);
            await updateDoc(orderRef, {
                status: newStatus,
                updatedAt: new Date() // Update the timestamp
            });

            console.log(`Order ${orderIdForModal} status updated to ${newStatus}`);
            alert("Order status updated successfully!");

            // --- WhatsApp Trigger Logic (DEFERRED) ---
            // const statusesForPopup = ['Verification', 'Ready for Working', 'Delivered'];
            // if (customerDetailsForModal && orderDisplayIdForModal && statusesForPopup.includes(newStatus)) {
            //      console.log(`Status '${newStatus}' triggers WhatsApp popup from history.`);
            //      triggerWhatsAppPopupHistory(customerDetailsForModal, orderDisplayIdForModal, newStatus);
            // }
            // --- End Deferred Logic ---

            closeModal(); // Close modal after successful save

        } catch (error) {
             console.error("Error updating order status:", error);
             alert("Error updating status: " + error.message);
             // Re-enable button only if it still exists
             if (elements.modalSaveStatusBtn) elements.modalSaveStatusBtn.disabled = false;
        } finally {
             // Restore button text safely
             if (elements.modalSaveStatusBtn) {
                 elements.modalSaveStatusBtn.innerHTML = '<i class="fas fa-save"></i> Save Status';
             }
        }
    }


    // Firestore से ऑर्डर डिलीट करने का फंक्शन (Original - UNTOUCHED)
    async function deleteOrderFromFirestore() {
        if (!orderIdForModal) { alert("No order selected for deletion."); return; }
        if (!db || !doc || !deleteDoc) { alert("Database delete function not available."); return; }
        if (!elements.modalDeleteBtn) { alert("Delete button not found."); return; }

        // Use Firestore ID for confirmation message for clarity
        if (confirm(`Are you sure you want to delete this order (${orderIdForModal})? This cannot be undone.`)) {
            console.log("Attempting to delete order:", orderIdForModal);
            elements.modalDeleteBtn.disabled = true;
            elements.modalDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

            try {
                 await deleteDoc(doc(db, "orders", orderIdForModal));
                 alert("Order deleted successfully!");
                 console.log("Order deleted:", orderIdForModal);
                 closeModal();
            } catch (error) {
                console.error("Error deleting order:", error);
                alert("Error deleting order: " + error.message);
                if (elements.modalDeleteBtn) elements.modalDeleteBtn.disabled = false;
            } finally {
                 if (elements.modalDeleteBtn){
                     elements.modalDeleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Order';
                 }
            }
        }
    }

    // एडिट पेज पर रीडायरेक्ट करने का फंक्शन (Original - UNTOUCHED)
    function redirectToEditPage() {
        if (orderIdForModal) {
            console.log("Redirecting to edit page for order:", orderIdForModal);
            window.location.href = `new_order.html?editOrderId=${orderIdForModal}`;
        } else {
            alert("Could not determine which order to edit.");
            console.warn("redirectToEditPage called without orderIdForModal set.");
        }
    }


    // --- Firestore Listener सेट अप (Original - UNTOUCHED) ---
    function listenToOrders() {
        if (currentOrderListenerUnsub) {
            console.log("Stopping previous Firestore listener.");
            currentOrderListenerUnsub();
        }
        try {
            console.log("Setting up Firestore listener for 'orders' collection...");
            const ordersRef = collection(db, "orders");
            const q = query(ordersRef, orderBy("createdAt", "desc")); // Requires index

            currentOrderListenerUnsub = onSnapshot(q, (snapshot) => {
                console.log(`Snapshot received: ${snapshot.docs.length} documents.`);
                allOrders = [];
                snapshot.forEach((doc) => {
                     allOrders.push({ id: doc.id, ...doc.data() });
                });
                console.log("Total orders processed:", allOrders.length);
                applyFiltersAndPagination();

            }, (error) => {
                console.error("Error listening to order updates: ", error);
                if(elements.tableBody) elements.tableBody.innerHTML = `<tr><td colspan="8" class="loading-message" style="color:red;">Error loading orders: ${error.message}. Check console.</td></tr>`;
            });
            console.log("Firestore listener successfully attached.");

        } catch (e) {
            console.error("Failed to set up Firestore listener: ", e);
             if(elements.tableBody) elements.tableBody.innerHTML = `<tr><td colspan="8" class="loading-message" style="color:red;">Database listener error: ${e.message}. Check console.</td></tr>`;
        }
    }

    // --- WhatsApp Popup Functions (DEFERRED - Not needed yet) ---
    // function triggerWhatsAppPopupHistory(customer, orderId, status) { ... }
    // function closeWhatsAppPopupHistory() { ... }


    // --- इवेंट लिसनर्स जोड़ें (Original + New Modal Save Button Listener) ---
    // Check if elements exist before adding listeners
    if(elements.prevPageButton) elements.prevPageButton.addEventListener('click', () => goToPage(currentPage - 1));
    if(elements.nextPageButton) elements.nextPageButton.addEventListener('click', () => goToPage(currentPage + 1));
    if(elements.showEntriesSelect) elements.showEntriesSelect.addEventListener('change', () => { currentPage = 1; applyFiltersAndPagination(); });
    if(elements.searchInput) elements.searchInput.addEventListener('input', applyFiltersAndPagination);
    if(elements.filterDateInput) elements.filterDateInput.addEventListener('change', applyFiltersAndPagination);
    if(elements.filterStatusSelect) elements.filterStatusSelect.addEventListener('change', applyFiltersAndPagination);

    // मोडाल इवेंट्स
    if(elements.modalCloseBtn) elements.modalCloseBtn.addEventListener('click', closeModal);
    if(elements.modalOverlay) elements.modalOverlay.addEventListener('click', (event) => { if (event.target === elements.modalOverlay) { closeModal(); } });
    if(elements.modalDeleteBtn) elements.modalDeleteBtn.addEventListener('click', deleteOrderFromFirestore);
    if(elements.modalGoToEditBtn) elements.modalGoToEditBtn.addEventListener('click', redirectToEditPage);
    // *** ADDED Listener for new Save Status button ***
    if (elements.modalSaveStatusBtn) {
        elements.modalSaveStatusBtn.addEventListener('click', saveStatusFromModal);
    }

    // WhatsApp Popup Listeners (DEFERRED)
    // if (elements.popupCloseBtnHistory) elements.popupCloseBtnHistory.addEventListener('click', closeWhatsAppPopupHistory);
    // if (elements.whatsappReminderPopupHistory) elements.whatsappReminderPopupHistory.addEventListener('click', (event) => { if (event.target === elements.whatsappReminderPopupHistory) closeWhatsAppPopupHistory(); });


    // --- इनिशियलाइज़ेशन (Original - UNTOUCHED logic) ---
    console.log("Starting listener to wait for DB connection and fetch initial data...");
    const checkDbInterval = setInterval(() => {
        // Check if essential functions are available on window object
        if (window.db && typeof window.onSnapshot === 'function' && typeof window.updateDoc === 'function') { // Check updateDoc too
            clearInterval(checkDbInterval);
            console.log("DB connection and functions ready. Initializing order listener...");
            listenToOrders(); // Start listening now that DB is ready
        } else {
            // console.log("Waiting for DB connection and functions..."); // Can be verbose
        }
    }, 100);

    console.log("Order History page script initialization nominally complete (waiting for DB).");

}); // End DOMContentLoaded Listener