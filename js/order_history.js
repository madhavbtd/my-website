[Filename: order_history.js]
// js/order_history.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed for Order History.");

    // --- ग्लोबल वेरिएबल्स (Original + New for modal data) ---
    let currentPage = 1;
    let rowsPerPage = 10;
    let allOrders = [];
    let filteredOrders = [];
    let currentOrderListenerUnsub = null;
    let orderIdForModal = null; // Firestore Doc ID
    let orderDisplayIdForModal = null; // Manual/System ID for display
    let customerDetailsForModal = null; // Store customer details for WhatsApp

    // --- DOM एलिमेंट रेफरेंस (Add new modal & popup elements) ---
    const elements = {
        tableBody: document.querySelector('#order-table tbody'),
        prevPageButton: document.getElementById('prev-page'),
        nextPageButton: document.getElementById('next-page'),
        pageInfoSpan: document.getElementById('page-info'),
        searchInput: document.getElementById('search-input'),
        filterDateInput: document.getElementById('filter-date'),
        filterStatusSelect: document.getElementById('filter-status'),
        showEntriesSelect: document.getElementById('show-entries'),
        // Modal Elements
        modalOverlay: document.getElementById('detailsModal'),
        modalBody: document.getElementById('modalBody'),
        modalOrderInfo: document.getElementById('modalOrderInfo'), // Div for basic info (Needs to exist in HTML)
        modalProductInfo: document.getElementById('modalProductInfo'), // Div for products (Needs to exist in HTML)
        modalProductList: document.getElementById('modalProductList'), // UL for products (Needs to exist in HTML)
        modalRemarksInfo: document.getElementById('modalRemarksInfo'), // Div for remarks (Needs to exist in HTML)
        modalRemarksText: document.getElementById('modalRemarksText'), // P for remarks text (Needs to exist in HTML)
        modalCloseBtn: document.getElementById('modalCloseBtn'),
        modalDeleteBtn: document.getElementById('modalDeleteBtn'),
        modalGoToEditBtn: document.getElementById('modalGoToEditBtn'),
        modalStatusSelect: document.getElementById('modalStatusSelect'), // *** ADDED Dropdown ref ***
        modalSaveStatusBtn: document.getElementById('modalSaveStatusBtn'), // *** ADDED Save button ref ***
        // WhatsApp Popup Elements (History specific IDs from HTML)
        whatsappReminderPopupHistory: document.getElementById('whatsapp-reminder-popup-history'),
        whatsappMsgPreviewHistory: document.getElementById('history-whatsapp-message-preview'),
        whatsappSendLinkHistory: document.getElementById('history-whatsapp-send-link'),
        popupCloseBtnHistory: document.getElementById('historyPopupCloseBtn')
    };

    // --- एलिमेंट वेरिफिकेशन (Check all, warn for optional popup ones) ---
    let allElementsFound = true;
    const missingElements = [];
    for (const key in elements) {
        if (!elements[key]) {
             if (key.startsWith('whatsapp') || key.startsWith('popupCloseBtnHistory') || key.startsWith('modalOrderInfo') || key.startsWith('modalProduct') || key.startsWith('modalRemarks')) {
                 console.warn(`Element "${key}" not found. Check HTML structure for modal details/WhatsApp popup. Functionality might be limited.`);
                 // Allow script to continue but warn user
             } else {
                // Critical elements like table, pagination, core modal parts
                allElementsFound = false;
                missingElements.push(key);
                console.error(`Initialization failed: Essential element "${key}" not found.`);
             }
        }
    }

    if (!allElementsFound) {
        console.error("CRITICAL ERROR: Essential page elements are missing:", missingElements.join(', '));
        alert("Page Error: Could not find essential elements. Check console (F12).");
        if (elements.tableBody) {
            elements.tableBody.innerHTML = `<tr><td colspan="8" style="color:red; text-align:center; font-weight:bold;">Page Initialization Error! Check Console (F12). Missing: ${missingElements.join(', ')}</td></tr>`;
        }
        return; // Stop execution
    }
    console.log("All essential page elements verified (with potential warnings for optional elements).");

    // --- Firestore फंक्शन्स (Ensure updateDoc is included) ---
    const { db, collection, onSnapshot, doc, getDoc, deleteDoc, updateDoc, query, where, orderBy } = window; // Added updateDoc

    // जांचें कि क्या Firestore फंक्शन्स उपलब्ध हैं
    if (!db || !collection || !onSnapshot || !doc || !getDoc || !deleteDoc || !updateDoc || !query || !where || !orderBy) { // Added updateDoc check
        console.error("Firestore functions are not available on the window object.");
        alert("Database functions error. Check console (F12).");
        if (elements.tableBody) {
             elements.tableBody.innerHTML = `<tr><td colspan="8" class="loading-message" style="color:red;">Database connection error!</td></tr>`;
        }
        return;
    }
    console.log("Firestore functions seem available.");


    // --- फंक्शन परिभाषाएं ---

    // टेबल में ऑर्डर दिखाने का फंक्शन (UPDATED button text and modal call)
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
            const firestoreOrderId = order.id; // Firestore Document ID
            const displayOrderId = order.orderId || firestoreOrderId; // Use Manual/System ID or fallback to Firestore ID

            // Cells Data (Original)
            row.insertCell().textContent = displayOrderId;
            row.insertCell().textContent = customerName;
            row.insertCell().textContent = order.orderDate || '-';
            row.insertCell().textContent = order.deliveryDate || '-';
            row.insertCell().textContent = order.urgent || 'No';
            row.insertCell().textContent = order.status || '-';

            // *** Action Cell (Manage Status) ***
            const actionsCell = row.insertCell();
            actionsCell.classList.add('actions');
            const manageButton = document.createElement('button');
            manageButton.textContent = 'Manage Status'; // *** Changed Text ***
            manageButton.classList.add('edit-details-button'); // Use existing class for style
            manageButton.dataset.id = firestoreOrderId; // Store Firestore Doc ID
            // *** Pass both IDs to modal function ***
            manageButton.addEventListener('click', () => openDetailsModal(firestoreOrderId, displayOrderId));
            actionsCell.appendChild(manageButton);

            // WhatsApp Cell (Original)
            const whatsappCell = row.insertCell();
            whatsappCell.classList.add('send-wtsp-cell');
            if (whatsappNo) {
                const cleanWhatsAppNo = String(whatsappNo).replace(/[^0-9]/g, '');
                if (cleanWhatsAppNo) {
                    const message = encodeURIComponent(`Regarding your order ${displayOrderId}...`); // Use display ID
                    whatsappCell.innerHTML = `<a href="https://wa.me/${cleanWhatsAppNo}?text=${message}" target="_blank" title="Send WhatsApp to ${customerName}" class="whatsapp-icon"><i class="fab fa-whatsapp"></i></a>`;
                } else { whatsappCell.innerHTML = '-'; }
            } else { whatsappCell.innerHTML = '-'; }
        });
    }

    // पेजिनेशन अपडेट फंक्शन (Original - UNTOUCHED)
    function updatePagination(totalFilteredRows) {
        rowsPerPage = parseInt(elements.showEntriesSelect.value || '10');
        const totalPages = Math.ceil(totalFilteredRows / rowsPerPage);
        currentPage = Math.max(1, Math.min(currentPage, totalPages || 1));
        elements.pageInfoSpan.textContent = `Page ${currentPage} of ${Math.max(totalPages, 1)}`;
        elements.prevPageButton.disabled = currentPage === 1;
        elements.nextPageButton.disabled = currentPage === totalPages || totalPages === 0;
    }

    // पेज बदलने का फंक्शन (Original - UNTOUCHED)
    function goToPage(page) {
        const totalPages = Math.ceil(filteredOrders.length / rowsPerPage);
        if (page >= 1 && page <= Math.max(totalPages, 1)) {
            currentPage = page;
            displayPaginatedOrders();
        }
    }

    // फ़िल्टर और पेजिनेशन लागू करने का फंक्शन (Original - UNTOUCHED)
    function applyFiltersAndPagination() {
        const searchTerm = elements.searchInput.value.toLowerCase().trim();
        const filterDate = elements.filterDateInput.value;
        const filterStatus = elements.filterStatusSelect.value;

        filteredOrders = allOrders.filter(order => {
            const searchMatch = !searchTerm ||
                                (order.orderId && String(order.orderId).toLowerCase().includes(searchTerm)) ||
                                (order.customerDetails?.fullName && order.customerDetails.fullName.toLowerCase().includes(searchTerm)) ||
                                (order.id && order.id.toLowerCase().includes(searchTerm));
            const dateMatch = !filterDate || order.orderDate === filterDate;
            const statusMatch = !filterStatus || order.status === filterStatus;
            return searchMatch && dateMatch && statusMatch;
        });
        currentPage = 1;
        displayPaginatedOrders();
    }

    // वर्तमान पेज के लिए ऑर्डर दिखाने का फंक्शन (Original - UNTOUCHED)
    function displayPaginatedOrders() {
        if (!elements.tableBody) return;
        rowsPerPage = parseInt(elements.showEntriesSelect.value || '10');
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const pageOrders = filteredOrders.slice(startIndex, endIndex);
        renderTableRows(pageOrders);
        updatePagination(filteredOrders.length);
    }

    // *** MODIFIED: मोडाल खोलने, डिटेल्स भरने, और स्टेटस ड्रॉपडाउन सेट करने का फंक्शन ***
    async function openDetailsModal(orderDocId, displayId) {
        // Ensure all required modal elements exist (check critical ones)
        if (!elements.modalOverlay || !elements.modalOrderInfo || !elements.modalStatusSelect || !elements.modalProductList || !elements.modalRemarksText || !elements.modalDeleteBtn || !elements.modalSaveStatusBtn || !elements.modalGoToEditBtn) {
             console.error("Modal elements missing! Cannot open modal correctly.");
             alert("Error: Modal structure incomplete.");
             return;
        }
        console.log("Opening modal for order Firestore ID:", orderDocId, "Display ID:", displayId);
        orderIdForModal = orderDocId; // Store Firestore ID for actions
        orderDisplayIdForModal = displayId; // Store display ID for WhatsApp msg
        customerDetailsForModal = null; // Reset customer details

        // Reset modal content to loading state & disable controls
        elements.modalOrderInfo.innerHTML = '<p class="loading-message">Loading details...</p>';
        elements.modalProductList.innerHTML = '<li>Loading products...</li>';
        elements.modalRemarksText.textContent = 'Loading...';
        elements.modalStatusSelect.disabled = true;
        elements.modalDeleteBtn.disabled = true;
        elements.modalSaveStatusBtn.disabled = true;
        elements.modalOverlay.classList.add('active'); // Show modal

        try {
            const orderRef = doc(db, "orders", orderDocId);
            const docSnap = await getDoc(orderRef);

            if (docSnap.exists()) {
                const order = { id: docSnap.id, ...docSnap.data() };
                console.log("Order details fetched for modal:", order);
                customerDetailsForModal = order.customerDetails; // Store for WhatsApp

                // --- Populate Modal Sections ---
                elements.modalOrderInfo.innerHTML = `
                    <p><strong>Order ID:</strong> ${order.orderId || order.id}</p>
                    <p><strong>Customer Name:</strong> ${order.customerDetails?.fullName || 'N/A'}</p>
                    <p><strong>WhatsApp No:</strong> ${order.customerDetails?.whatsappNo || 'N/A'}</p>
                    <p><strong>Order Date:</strong> ${order.orderDate || 'N/A'}</p>
                    <p><strong>Delivery Date:</strong> ${order.deliveryDate || 'N/A'}</p>
                     <p><strong>Priority:</strong> ${order.urgent || 'N/A'}</p>
                `;

                elements.modalStatusSelect.value = order.status || 'Order Received';
                elements.modalStatusSelect.disabled = false; // Enable dropdown

                elements.modalProductList.innerHTML = ''; // Clear loading message
                if (order.products && Array.isArray(order.products) && order.products.length > 0) {
                    order.products.forEach(p => {
                        const li = document.createElement('li');
                        li.textContent = `${p.name || 'N/A'} - Qty: ${p.quantity || 'N/A'}`;
                        elements.modalProductList.appendChild(li);
                    });
                } else {
                    elements.modalProductList.innerHTML = '<li>No products listed</li>';
                }

                 elements.modalRemarksText.textContent = order.remarks || 'N/A';

                // Enable action buttons
                elements.modalDeleteBtn.disabled = false;
                elements.modalSaveStatusBtn.disabled = false;

            } else {
                console.error("Order document not found in modal! ID:", orderDocId);
                elements.modalOrderInfo.innerHTML = '<p class="loading-message" style="color:red;">Error: Order details not found.</p>';
                 elements.modalProductList.innerHTML = '';
                 elements.modalRemarksText.textContent = 'Error';
            }
        } catch (error) {
            console.error("Error fetching order details for modal:", error);
            elements.modalOrderInfo.innerHTML = `<p class="loading-message" style="color:red;">Error loading details.</p>`;
            elements.modalProductList.innerHTML = '';
            elements.modalRemarksText.textContent = 'Error';
            orderIdForModal = null; // Clear ID on error
            orderDisplayIdForModal = null;
        }
    }

    // मोडाल बंद करने का फंक्शन (Original - UNTOUCHED)
    function closeModal() {
        if (elements.modalOverlay) {
            elements.modalOverlay.classList.remove('active');
            orderIdForModal = null;
            orderDisplayIdForModal = null;
            customerDetailsForModal = null;
            console.log("Modal closed.");
        }
    }

    // *** NEW: मोडाल से स्टेटस सेव करने का फंक्शन ***
    async function saveStatusFromModal() {
        if (!orderIdForModal) { alert("Error: No order selected."); return; }
        if (!elements.modalStatusSelect || !elements.modalSaveStatusBtn) { alert("Error: Modal elements missing."); return; }
        if (!db || !doc || !updateDoc) { alert("Database update function not available."); return; }

        const newStatus = elements.modalStatusSelect.value;
        // Find the original status from the currently displayed *filtered* data to check if changed
        const currentOrderData = filteredOrders.find(o => o.id === orderIdForModal);
        const originalStatus = currentOrderData?.status;

        // Optional: Only proceed if status has actually changed
        if(newStatus === originalStatus){
            alert("Status has not changed.");
            // Maybe close the modal or just do nothing
            // closeModal();
            return;
        }

        console.log(`Attempting to update status for order ${orderIdForModal} from '${originalStatus}' to '${newStatus}'`);

        elements.modalSaveStatusBtn.disabled = true;
        elements.modalSaveStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            const orderRef = doc(db, "orders", orderIdForModal);
            await updateDoc(orderRef, {
                status: newStatus,
                updatedAt: new Date() // Always update timestamp
            });

            console.log(`Order ${orderIdForModal} status updated to ${newStatus}`);
            alert("Order status updated successfully!");

            // --- Trigger WhatsApp Popup if applicable ---
            // Confirm which statuses trigger popup from history
            const statusesForPopup = ['Verification', 'Ready for Working', 'Delivered'];
            // Use stored customer details and display ID
            if (customerDetailsForModal && orderDisplayIdForModal && statusesForPopup.includes(newStatus)) {
                 console.log(`Status '${newStatus}' triggers WhatsApp popup from history.`);
                 triggerWhatsAppPopupHistory(customerDetailsForModal, orderDisplayIdForModal, newStatus); // Call the new function
            }

            // Close modal after successful save
            closeModal();

        } catch (error) {
             console.error("Error updating order status:", error);
             alert("Error updating status: " + error.message);
             elements.modalSaveStatusBtn.disabled = false; // Re-enable button on error
        } finally {
             // Restore button text safely
             if (elements.modalSaveStatusBtn) {
                 elements.modalSaveStatusBtn.innerHTML = '<i class="fas fa-save"></i> Save Status';
                 // Re-enable button if modal is still open after error
                 if (elements.modalOverlay.classList.contains('active')) {
                     elements.modalSaveStatusBtn.disabled = false;
                 }
             }
        }
    }


    // Firestore से ऑर्डर डिलीट करने का फंक्शन (Original - UNTOUCHED)
    async function deleteOrderFromFirestore() {
        if (!orderIdForModal) { alert("No order selected for deletion."); return; }
        if (!db || !doc || !deleteDoc) { alert("Database delete function not available."); return; }
        if (!elements.modalDeleteBtn) { alert("Delete button not found."); return; }

        const orderIdentifier = orderDisplayIdForModal || orderIdForModal;
        if (confirm(`Are you sure you want to delete this order (${orderIdentifier})? This cannot be undone.`)) {
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
                elements.modalDeleteBtn.disabled = false;
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
            window.location.href = `new_order.html?editOrderId=${orderIdForModal}`; // Pass Firestore ID
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
            const q = query(ordersRef, orderBy("createdAt", "desc")); // Assumes 'createdAt' field exists

            currentOrderListenerUnsub = onSnapshot(q, (snapshot) => {
                console.log(`Snapshot received: ${snapshot.size} documents.`);
                allOrders = [];
                snapshot.forEach((doc) => {
                     allOrders.push({ id: doc.id, ...doc.data() });
                });
                console.log("Total orders processed:", allOrders.length);
                // Apply filters and pagination whenever data changes
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

    // --- WhatsApp Popup Functions (ADDED for History Page) ---
    function triggerWhatsAppPopupHistory(customer, orderId, status) {
        // Use history-specific element IDs from `elements` object
        if (!elements.whatsappReminderPopupHistory || !elements.whatsappMsgPreviewHistory || !elements.whatsappSendLinkHistory) {
            console.error("[DEBUG] WhatsApp popup elements missing in history page HTML or elements object.");
            // alert("Error: Could not find WhatsApp popup elements."); // Avoid alert
            return;
        }

        const customerName = customer?.fullName ? customer.fullName.trim() : 'Customer';
        const customerNumber = customer?.whatsappNo?.replace(/[^0-9]/g, '');

        if (!customerNumber) {
            console.warn("[DEBUG] WhatsApp No missing or invalid for triggering popup:", customerName);
            return; // Cannot send without number
        }

        let message = '';
        const signature = "\n\n*Madhav Multy Print*\n9549116541"; // Ensure correct number

        // Generate message based on status
        // ** Confirm the exact statuses and messages needed **
        switch (status) {
            case 'Verification':
                message = `नमस्ते *${customerName}*,\n\nआपके ऑर्डर (ID: *${orderId}*) का डिज़ाइन वेरिफिकेशन के लिए तैयार है।`;
                message += `\nकृपया डिज़ाइन को ध्यानपूर्वक चेक करें। *OK* का जवाब देने के बाद कोई बदलाव संभव नहीं होगा।`;
                message += `\n\nधन्यवाद!`;
                break;
            case 'Ready for Working': // Assuming this is the 'Ready' status mentioned
                 message = `नमस्ते *${customerName}*,\n\nआपका ऑर्डर (ID: *${orderId}*) अब प्रिंटिंग/वर्किंग के लिए तैयार है।`;
                 // Add delivery estimate if available?
                 message += `\n\nधन्यवाद!`;
                 break;
            case 'Delivered':
                message = `नमस्ते *${customerName}*,\n\nआपका ऑर्डर (ID: *${orderId}*) सफलतापूर्वक डिलीवर कर दिया गया है।`;
                message += `\n\nहमें सेवा का अवसर देने के लिए धन्यवाद!`;
                break;
            default:
                console.log(`[DEBUG] WhatsApp popup trigger called for unhandled status from history: ${status}`);
                return; // Don't show for other statuses
        }
        message += signature;

        elements.whatsappMsgPreviewHistory.innerText = message;
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${customerNumber}?text=${encodedMessage}`;
        elements.whatsappSendLinkHistory.href = whatsappUrl;
        elements.whatsappReminderPopupHistory.classList.add('active'); // Show the popup
        console.log("[DEBUG] WhatsApp reminder shown from history page for status:", status);
    }

    function closeWhatsAppPopupHistory() {
        // Use history-specific element ID from `elements` object
        if (elements.whatsappReminderPopupHistory) {
            elements.whatsappReminderPopupHistory.classList.remove('active');
        }
    }


    // --- इवेंट लिसनर्स जोड़ें (Original + New Modal/Popup Listeners) ---
    // Ensure original listeners point to correct elements if IDs haven't changed
    elements.prevPageButton.addEventListener('click', () => goToPage(currentPage - 1));
    elements.nextPageButton.addEventListener('click', () => goToPage(currentPage + 1));
    elements.showEntriesSelect.addEventListener('change', () => { currentPage = 1; applyFiltersAndPagination(); });
    elements.searchInput.addEventListener('input', applyFiltersAndPagination);
    elements.filterDateInput.addEventListener('change', applyFiltersAndPagination);
    elements.filterStatusSelect.addEventListener('change', applyFiltersAndPagination);

    // मोडाल इवेंट्स
    elements.modalCloseBtn.addEventListener('click', closeModal);
    elements.modalOverlay.addEventListener('click', (event) => {
        if (event.target === elements.modalOverlay) { closeModal(); } // Close on overlay click
    });
    elements.modalDeleteBtn.addEventListener('click', deleteOrderFromFirestore); // Keep original delete
    elements.modalGoToEditBtn.addEventListener('click', redirectToEditPage); // Keep original edit redirect
    // *** ADDED Listener for new Save Status button ***
    if (elements.modalSaveStatusBtn) {
        elements.modalSaveStatusBtn.addEventListener('click', saveStatusFromModal);
    }

    // WhatsApp Popup Close Button (History specific)
    if (elements.popupCloseBtnHistory) {
         elements.popupCloseBtnHistory.addEventListener('click', closeWhatsAppPopupHistory);
    }
     // Optional: Close WhatsApp popup if overlay clicked (History specific)
     if (elements.whatsappReminderPopupHistory) {
         elements.whatsappReminderPopupHistory.addEventListener('click', (event) => { if (event.target === elements.whatsappReminderPopupHistory) closeWhatsAppPopupHistory(); });
     }


    // --- इनिशियलाइज़ेशन (Original - UNTOUCHED logic) ---
    console.log("Starting listener to wait for DB connection and fetch initial data...");
    const checkDbInterval = setInterval(() => {
        // Ensure db AND key Firestore functions are loaded globally before proceeding
        if (window.db && typeof window.onSnapshot === 'function' && typeof window.query === 'function' && typeof window.orderBy === 'function' && typeof window.collection === 'function' && typeof window.doc === 'function' && typeof window.getDoc === 'function' && typeof window.updateDoc === 'function' && typeof window.deleteDoc === 'function') {
            clearInterval(checkDbInterval);
            console.log("DB connection and functions ready. Initializing order listener...");
            listenToOrders(); // Start listening for orders
        } else {
            console.log("Waiting for DB connection and functions...");
        }
    }, 200); // Check slightly more often

    console.log("Order History page script initialization complete.");

}); // End DOMContentLoaded Listener