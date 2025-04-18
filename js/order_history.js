
[Filename: order_history.js - Attempt 2]
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
    let orderDisplayIdForModal = null; // Manual/System ID for display
    let customerDetailsForModal = null; // Store customer details for WhatsApp

    // --- DOM एलिमेंट रेफरेंस (Ensure IDs match HTML exactly) ---
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
        // Specific divs within modal body (Ensure these exist in HTML)
        modalOrderInfo: document.getElementById('modalOrderInfo'),
        modalProductList: document.getElementById('modalProductList'),
        modalRemarksText: document.getElementById('modalRemarksText'),
        // Modal Buttons & Controls
        modalCloseBtn: document.getElementById('modalCloseBtn'),
        modalDeleteBtn: document.getElementById('modalDeleteBtn'),
        modalGoToEditBtn: document.getElementById('modalGoToEditBtn'),
        modalStatusSelect: document.getElementById('modalStatusSelect'),
        modalSaveStatusBtn: document.getElementById('modalSaveStatusBtn'),
        // WhatsApp Popup Elements (History specific IDs)
        whatsappReminderPopupHistory: document.getElementById('whatsapp-reminder-popup-history'),
        whatsappMsgPreviewHistory: document.getElementById('history-whatsapp-message-preview'),
        whatsappSendLinkHistory: document.getElementById('history-whatsapp-send-link'),
        popupCloseBtnHistory: document.getElementById('historyPopupCloseBtn')
    };

    // --- एलिमेंट वेरिफिकेशन ---
    let allElementsFound = true;
    const missingElements = [];
    for (const key in elements) {
        if (!elements[key]) {
            // Allow optional elements but warn
             if (key.startsWith('whatsapp') || key.startsWith('popupCloseBtnHistory') || key.startsWith('modalOrderInfo') || key.startsWith('modalProductList') || key.startsWith('modalRemarksText') ) {
                 console.warn(`Element reference missing or null for "${key}". Check HTML ID. Dependent features might fail.`);
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
            elements.tableBody.innerHTML = `<tr><td colspan="8" style="color:red; text-align:center; font-weight:bold;">Page Initialization Error! Check Console (F12). Missing: ${missingElements.join(', ')}</td></tr>`;
        }
        return; // Stop execution
    }
    console.log("All essential page elements referenced (check warnings for optional elements).");

    // --- Firestore फंक्शन्स (Ensure updateDoc is available) ---
    const { db, collection, onSnapshot, doc, getDoc, deleteDoc, updateDoc, query, where, orderBy } = window;

    if (!db || !collection || !onSnapshot || !doc || !getDoc || !deleteDoc || !updateDoc || !query || !where || !orderBy) {
        console.error("Firestore functions are not available on the window object.");
        if (elements.tableBody) {
             elements.tableBody.innerHTML = `<tr><td colspan="8" class="loading-message" style="color:red;">Database connection error!</td></tr>`;
        }
        return;
    }
    console.log("Firestore functions seem available.");


    // --- फंक्शन परिभाषाएं ---

    // टेबल में ऑर्डर दिखाने का फंक्शन (Original structure, updated button text/modal call)
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
            row.insertCell().textContent = order.status || '-';

            // Action Cell
            const actionsCell = row.insertCell();
            actionsCell.classList.add('actions');
            const manageButton = document.createElement('button');
            manageButton.textContent = 'Manage Status'; // Changed Text
            manageButton.classList.add('edit-details-button');
            manageButton.dataset.id = firestoreOrderId;
            manageButton.addEventListener('click', () => openDetailsModal(firestoreOrderId, displayOrderId)); // Pass both IDs
            actionsCell.appendChild(manageButton);

            // WhatsApp Cell
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

    // पेजिनेशन अपडेट फंक्शन (Original - UNTOUCHED)
    function updatePagination(totalFilteredRows) {
        if (!elements.showEntriesSelect || !elements.pageInfoSpan || !elements.prevPageButton || !elements.nextPageButton) return; // Safety check
        rowsPerPage = parseInt(elements.showEntriesSelect.value || '10');
        const totalPages = Math.ceil(totalFilteredRows / rowsPerPage);
        currentPage = Math.max(1, Math.min(currentPage, totalPages || 1));
        elements.pageInfoSpan.textContent = `Page ${currentPage} of ${Math.max(totalPages, 1)}`;
        elements.prevPageButton.disabled = currentPage === 1;
        elements.nextPageButton.disabled = currentPage === totalPages || totalPages === 0;
    }

    // पेज बदलने का फंक्शन (Original - UNTOUCHED)
    function goToPage(page) {
        if (!filteredOrders) return;
        const totalPages = Math.ceil(filteredOrders.length / rowsPerPage);
        if (page >= 1 && page <= Math.max(totalPages, 1)) {
            currentPage = page;
            displayPaginatedOrders();
        }
    }

    // फ़िल्टर और पेजिनेशन लागू करने का फंक्शन (Original - UNTOUCHED)
    function applyFiltersAndPagination() {
        if (!allOrders || !elements.searchInput || !elements.filterDateInput || !elements.filterStatusSelect) return; // Safety check
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
        if (!filteredOrders || !elements.tableBody || !elements.showEntriesSelect) return; // Safety check
        rowsPerPage = parseInt(elements.showEntriesSelect.value || '10');
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const pageOrders = filteredOrders.slice(startIndex, endIndex);
        renderTableRows(pageOrders);
        updatePagination(filteredOrders.length);
    }

    // *** MODIFIED: मोडाल खोलने, डिटेल्स भरने, और स्टेटस ड्रॉपडाउन सेट करने का फंक्शन ***
    async function openDetailsModal(orderDocId, displayId) {
        // Check critical modal elements again before proceeding
        if (!elements.modalOverlay || !elements.modalOrderInfo || !elements.modalStatusSelect || !elements.modalProductList || !elements.modalRemarksText || !elements.modalDeleteBtn || !elements.modalSaveStatusBtn || !elements.modalGoToEditBtn) {
             console.error("Modal elements missing inside openDetailsModal!");
             return;
        }
        console.log("Opening modal for order Firestore ID:", orderDocId, "Display ID:", displayId);
        orderIdForModal = orderDocId;
        orderDisplayIdForModal = displayId;
        customerDetailsForModal = null;

        // Reset UI
        elements.modalOrderInfo.innerHTML = '<p class="loading-message">Loading details...</p>';
        elements.modalProductList.innerHTML = '<li>Loading products...</li>';
        elements.modalRemarksText.textContent = 'Loading...';
        elements.modalStatusSelect.disabled = true;
        elements.modalDeleteBtn.disabled = true;
        elements.modalSaveStatusBtn.disabled = true;
        elements.modalOverlay.classList.add('active');

        try {
            const orderRef = doc(db, "orders", orderDocId);
            const docSnap = await getDoc(orderRef);

            if (docSnap.exists()) {
                const order = { id: docSnap.id, ...docSnap.data() };
                console.log("Order details fetched for modal:", order);
                customerDetailsForModal = order.customerDetails;

                // Populate Modal Sections (Check if elements exist before setting innerHTML/textContent)
                if (elements.modalOrderInfo) {
                    elements.modalOrderInfo.innerHTML = `
                        <p><strong>Order ID:</strong> ${order.orderId || order.id}</p>
                        <p><strong>Customer Name:</strong> ${order.customerDetails?.fullName || 'N/A'}</p>
                        <p><strong>WhatsApp No:</strong> ${order.customerDetails?.whatsappNo || 'N/A'}</p>
                        <p><strong>Order Date:</strong> ${order.orderDate || 'N/A'}</p>
                        <p><strong>Delivery Date:</strong> ${order.deliveryDate || 'N/A'}</p>
                         <p><strong>Priority:</strong> ${order.urgent || 'N/A'}</p>
                    `;
                }

                if (elements.modalStatusSelect) {
                    elements.modalStatusSelect.value = order.status || 'Order Received';
                    elements.modalStatusSelect.disabled = false;
                }

                if (elements.modalProductList) {
                    elements.modalProductList.innerHTML = '';
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

                 if (elements.modalRemarksText) {
                    elements.modalRemarksText.textContent = order.remarks || 'N/A';
                 }

                // Enable action buttons
                if (elements.modalDeleteBtn) elements.modalDeleteBtn.disabled = false;
                if (elements.modalSaveStatusBtn) elements.modalSaveStatusBtn.disabled = false;

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
            orderIdForModal = null;
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
        // Check required elements exist before using them
        if (!elements.modalStatusSelect || !elements.modalSaveStatusBtn) { alert("Error: Modal save elements missing."); return; }
        if (!db || !doc || !updateDoc) { alert("Database update function not available."); return; }

        const newStatus = elements.modalStatusSelect.value;
        // Find original status carefully, handle case where order might have been removed from filtered list
        const currentOrderData = allOrders.find(o => o.id === orderIdForModal); // Check against allOrders as filteredOrders might change
        const originalStatus = currentOrderData?.status;

        if(newStatus === originalStatus){
            alert("Status has not changed.");
            return; // No need to save if status is the same
        }

        console.log(`Attempting to update status for order ${orderIdForModal} from '${originalStatus}' to '${newStatus}'`);

        elements.modalSaveStatusBtn.disabled = true;
        elements.modalSaveStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            const orderRef = doc(db, "orders", orderIdForModal);
            await updateDoc(orderRef, {
                status: newStatus,
                updatedAt: new Date()
            });

            console.log(`Order ${orderIdForModal} status updated to ${newStatus}`);
            alert("Order status updated successfully!");

            // --- Trigger WhatsApp Popup if applicable ---
            const statusesForPopup = ['Verification', 'Ready for Working', 'Delivered'];
            if (customerDetailsForModal && orderDisplayIdForModal && statusesForPopup.includes(newStatus)) {
                 console.log(`Status '${newStatus}' triggers WhatsApp popup from history.`);
                 triggerWhatsAppPopupHistory(customerDetailsForModal, orderDisplayIdForModal, newStatus); // Call the new function
            }

            closeModal(); // Close modal after success

        } catch (error) {
             console.error("Error updating order status:", error);
             alert("Error updating status: " + error.message);
             // Re-enable button only if it still exists
             if (elements.modalSaveStatusBtn) elements.modalSaveStatusBtn.disabled = false;
        } finally {
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
                if (elements.modalDeleteBtn) elements.modalDeleteBtn.disabled = false; // Check existence
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
                console.log(`Snapshot received: ${snapshot.size} documents.`);
                allOrders = []; // Reset allOrders array
                snapshot.forEach((doc) => {
                     allOrders.push({ id: doc.id, ...doc.data() });
                });
                console.log("Total orders processed:", allOrders.length);
                // Apply filters and pagination AFTER new data is loaded
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
        // Add checks to ensure elements exist before using them
        if (!elements.whatsappReminderPopupHistory || !elements.whatsappMsgPreviewHistory || !elements.whatsappSendLinkHistory) {
            console.error("[DEBUG] WhatsApp popup elements missing in history page HTML or elements object.");
            return;
        }

        const customerName = customer?.fullName ? customer.fullName.trim() : 'Customer';
        const customerNumber = customer?.whatsappNo?.replace(/[^0-9]/g, '');

        if (!customerNumber) {
            console.warn("[DEBUG] WhatsApp No missing or invalid for triggering popup:", customerName);
            return;
        }

        let message = '';
        const signature = "\n\n*Madhav Multy Print*\n9549116541";

        // Generate message based on status
        switch (status) {
            case 'Verification':
                message = `नमस्ते *${customerName}*,\n\nआपके ऑर्डर (ID: *${orderId}*) का डिज़ाइन वेरिफिकेशन के लिए तैयार है।`;
                message += `\nकृपया डिज़ाइन को ध्यानपूर्वक चेक करें। *OK* का जवाब देने के बाद कोई बदलाव संभव नहीं होगा।`;
                message += `\n\nधन्यवाद!`;
                break;
            case 'Ready for Working': // Assuming this is the 'Ready' status
                 message = `नमस्ते *${customerName}*,\n\nआपका ऑर्डर (ID: *${orderId}*) अब प्रिंटिंग/वर्किंग के लिए तैयार है।`;
                 message += `\n\nधन्यवाद!`;
                 break;
            case 'Delivered':
                message = `नमस्ते *${customerName}*,\n\nआपका ऑर्डर (ID: *${orderId}*) सफलतापूर्वक डिलीवर कर दिया गया है।`;
                message += `\n\nहमें सेवा का अवसर देने के लिए धन्यवाद!`;
                break;
            default:
                console.log(`[DEBUG] WhatsApp popup trigger called for unhandled status from history: ${status}`);
                return;
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
    // Check if elements exist before adding listeners
    if(elements.prevPageButton) elements.prevPageButton.addEventListener('click', () => goToPage(currentPage - 1));
    if(elements.nextPageButton) elements.nextPageButton.addEventListener('click', () => goToPage(currentPage + 1));
    if(elements.showEntriesSelect) elements.showEntriesSelect.addEventListener('change', () => { currentPage = 1; applyFiltersAndPagination(); });
    if(elements.searchInput) elements.searchInput.addEventListener('input', applyFiltersAndPagination);
    if(elements.filterDateInput) elements.filterDateInput.addEventListener('change', applyFiltersAndPagination);
    if(elements.filterStatusSelect) elements.filterStatusSelect.addEventListener('change', applyFiltersAndPagination);

    // मोडाल इवेंट्स
    if(elements.modalCloseBtn) elements.modalCloseBtn.addEventListener('click', closeModal);
    if(elements.modalOverlay) elements.modalOverlay.addEventListener('click', (event) => {
        if (event.target === elements.modalOverlay) { closeModal(); }
    });
    if(elements.modalDeleteBtn) elements.modalDeleteBtn.addEventListener('click', deleteOrderFromFirestore);
    if(elements.modalGoToEditBtn) elements.modalGoToEditBtn.addEventListener('click', redirectToEditPage);
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
        if (window.db && typeof window.onSnapshot === 'function' && typeof window.updateDoc === 'function') { // Check for functions needed early
            clearInterval(checkDbInterval);
            console.log("DB connection and functions ready. Initializing order listener...");
            listenToOrders(); // Start listening for orders
        } else {
            console.log("Waiting for DB connection and functions...");
        }
    }, 200); // Check slightly faster

    console.log("Order History page script initialization complete.");

}); // End DOMContentLoaded Listener