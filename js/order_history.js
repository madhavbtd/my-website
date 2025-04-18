[Filename: order_history.js]
// js/order_history.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed for Order History.");

    // --- ग्लोबल वेरिएबल्स ---
    let currentPage = 1;
    let rowsPerPage = 10;
    let allOrders = []; // Firestore से आए सभी ऑर्डर्स
    let filteredOrders = []; // फ़िल्टर के बाद बचे ऑर्डर्स
    let currentOrderListenerUnsub = null; // Firestore listener को बंद करने के लिए
    let orderIdForModal = null; // Modal में किस ऑर्डर का विवरण दिखाना है (Firestore Doc ID)
    let customerDetailsForModal = null; // Store customer details for WhatsApp popup

    // --- DOM एलिमेंट रेफरेंस ---
    const elements = {
        tableBody: document.querySelector('#order-table tbody'),
        prevPageButton: document.getElementById('prev-page'),
        nextPageButton: document.getElementById('next-page'),
        pageInfoSpan: document.getElementById('page-info'),
        searchInput: document.getElementById('search-input'),
        filterDateInput: document.getElementById('filter-date'),
        filterStatusSelect: document.getElementById('filter-status'), // Filter dropdown
        showEntriesSelect: document.getElementById('show-entries'),
        // Modal Elements
        modalOverlay: document.getElementById('detailsModal'),
        modalBody: document.getElementById('modalBody'), // Main content area
        modalCloseBtn: document.getElementById('modalCloseBtn'), // Modal close button
        modalDeleteBtn: document.getElementById('modalDeleteBtn'), // Delete Order button
        modalGoToEditBtn: document.getElementById('modalGoToEditBtn'), // Edit Full Order button
        modalStatusSelect: document.getElementById('modalStatusSelect'), // Status dropdown within modal
        modalSaveStatusBtn: document.getElementById('modalSaveStatusBtn'), // Save Status button
        // WhatsApp Popup Elements (Copied HTML) - Use distinct IDs if necessary
        whatsappReminderPopupHistory: document.getElementById('whatsapp-reminder-popup'), // Assuming same ID for overlay
        whatsappMsgPreviewHistory: document.getElementById('history-whatsapp-message-preview'), // Use distinct ID
        whatsappSendLinkHistory: document.getElementById('history-whatsapp-send-link'), // Use distinct ID
        popupCloseBtnHistory: document.getElementById('historyPopupCloseBtn') // Use distinct ID
    };

    // --- एलिमेंट वेरिफिकेशन ---
    let allElementsFound = true;
    const missingElements = [];
    for (const key in elements) {
        if (!elements[key]) {
            allElementsFound = false;
            missingElements.push(`#${key} or element for ${key}`);
            console.error(`Initialization failed: Element "${key}" not found.`);
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
    console.log("All essential page elements found.");

    // --- Firestore फंक्शन्स (विंडो ऑब्जेक्ट से प्राप्त करें) ---
    const { db, collection, onSnapshot, doc, getDoc, deleteDoc, updateDoc, query, where, orderBy } = window; // Added updateDoc

    // जांचें कि क्या Firestore फंक्शन्स उपलब्ध हैं
    if (!db || !collection || !onSnapshot || !doc || !getDoc || !deleteDoc || !updateDoc || !query || !where || !orderBy) { // Added updateDoc check
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
            const displayOrderId = order.orderId || firestoreOrderId; // Display Manual/System ID or Firestore ID

            // सेल बनाएं और डेटा डालें
            row.insertCell().textContent = displayOrderId;
            row.insertCell().textContent = customerName;
            row.insertCell().textContent = order.orderDate || '-';
            row.insertCell().textContent = order.deliveryDate || '-';
            row.insertCell().textContent = order.urgent || 'No';
            row.insertCell().textContent = order.status || '-';

            // एक्शन सेल (Manage Status)
            const actionsCell = row.insertCell();
            actionsCell.classList.add('actions'); // CSS क्लास
            const manageButton = document.createElement('button');
            manageButton.textContent = 'Manage Status'; // Changed Text
            manageButton.classList.add('edit-details-button'); // Keep class for styling
            manageButton.dataset.id = firestoreOrderId; // Set Firestore Doc ID
            manageButton.addEventListener('click', () => openDetailsModal(firestoreOrderId));
            actionsCell.appendChild(manageButton);

            // WhatsApp सेल
            const whatsappCell = row.insertCell();
            whatsappCell.classList.add('send-wtsp-cell');
            if (whatsappNo) {
                const cleanWhatsAppNo = String(whatsappNo).replace(/[^0-9]/g, '');
                if (cleanWhatsAppNo) {
                    // Generic message for direct link, specific message comes from popup
                    const message = encodeURIComponent(`Regarding your order ${displayOrderId}...`);
                    whatsappCell.innerHTML = `<a href="https://wa.me/${cleanWhatsAppNo}?text=${message}" target="_blank" title="Send WhatsApp to ${customerName}" class="whatsapp-icon"><i class="fab fa-whatsapp"></i></a>`;
                } else {
                    whatsappCell.innerHTML = '-';
                }
            } else {
                whatsappCell.innerHTML = '-';
            }
        });
    }

    // पेजिनेशन अपडेट फंक्शन (Same as before)
    function updatePagination(totalFilteredRows) {
        rowsPerPage = parseInt(elements.showEntriesSelect.value || '10');
        const totalPages = Math.ceil(totalFilteredRows / rowsPerPage);
        currentPage = Math.max(1, Math.min(currentPage, totalPages || 1));
        elements.pageInfoSpan.textContent = `Page ${currentPage} of ${Math.max(totalPages, 1)}`;
        elements.prevPageButton.disabled = currentPage === 1;
        elements.nextPageButton.disabled = currentPage === totalPages || totalPages === 0;
    }

    // पेज बदलने का फंक्शन (Same as before)
    function goToPage(page) {
        const totalPages = Math.ceil(filteredOrders.length / rowsPerPage);
        if (page >= 1 && page <= Math.max(totalPages, 1)) {
            currentPage = page;
            displayPaginatedOrders();
        }
    }

    // फ़िल्टर और पेजिनेशन लागू करने का फंक्शन (Same as before)
    function applyFiltersAndPagination() {
        const searchTerm = elements.searchInput.value.toLowerCase().trim();
        const filterDate = elements.filterDateInput.value;
        const filterStatus = elements.filterStatusSelect.value; // Use the filter dropdown

        filteredOrders = allOrders.filter(order => {
            const searchMatch = !searchTerm ||
                                (order.orderId && String(order.orderId).toLowerCase().includes(searchTerm)) || // Manual/System ID
                                (order.customerDetails?.fullName && order.customerDetails.fullName.toLowerCase().includes(searchTerm)) ||
                                (order.id && order.id.toLowerCase().includes(searchTerm)); // Firestore ID
            const dateMatch = !filterDate || order.orderDate === filterDate;
            const statusMatch = !filterStatus || order.status === filterStatus;
            return searchMatch && dateMatch && statusMatch;
        });
        currentPage = 1; // Reset to first page after filtering
        displayPaginatedOrders();
    }

    // वर्तमान पेज के लिए ऑर्डर दिखाने का फंक्शन (Same as before)
    function displayPaginatedOrders() {
        rowsPerPage = parseInt(elements.showEntriesSelect.value || '10');
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const pageOrders = filteredOrders.slice(startIndex, endIndex);
        renderTableRows(pageOrders);
        updatePagination(filteredOrders.length);
    }

    // *** MODIFIED: विवरण मोडाल खोलने और स्टेटस ड्रॉपडाउन भरने का फंक्शन ***
    async function openDetailsModal(orderDocId) {
        console.log("Opening modal for order ID:", orderDocId);
        orderIdForModal = orderDocId; // Store Firestore ID for actions
        customerDetailsForModal = null; // Reset customer details
        elements.modalBody.innerHTML = '<p class="loading-message">Loading details...</p>'; // Show loading message
        elements.modalDeleteBtn.disabled = true; // Disable buttons initially
        elements.modalSaveStatusBtn.disabled = true;
        elements.modalStatusSelect.disabled = true; // Disable dropdown initially
        elements.modalOverlay.classList.add('active'); // Show modal

        try {
            const orderRef = doc(db, "orders", orderDocId);
            const docSnap = await getDoc(orderRef);

            if (docSnap.exists()) {
                const order = { id: docSnap.id, ...docSnap.data() }; // Include ID
                console.log("Order details fetched:", order);
                customerDetailsForModal = order.customerDetails; // Store customer details for WhatsApp

                // Display basic details (customize as needed)
                 const detailsHtml = `
                    <p><strong>Order ID:</strong> ${order.orderId || order.id}</p>
                    <p><strong>Customer Name:</strong> ${order.customerDetails?.fullName || 'N/A'}</p>
                    <hr>
                     `;
                 // Find the placeholder div or directly set innerHTML of modal body
                 const modalBodyContentArea = elements.modalBody.querySelector('.loading-message');
                 if (modalBodyContentArea) {
                    modalBodyContentArea.outerHTML = detailsHtml; // Replace loading message
                 } else {
                     elements.modalBody.innerHTML = detailsHtml + elements.modalBody.innerHTML; // Prepend if loading msg gone
                 }


                // Set the status dropdown value
                if (elements.modalStatusSelect) {
                    elements.modalStatusSelect.value = order.status || 'Order Received'; // Set current status
                    elements.modalStatusSelect.disabled = false; // Enable dropdown
                }

                elements.modalDeleteBtn.disabled = false; // Enable delete button
                elements.modalSaveStatusBtn.disabled = false; // Enable save status button

            } else {
                console.error("Order document not found in modal! ID:", orderDocId);
                elements.modalBody.innerHTML = '<p class="loading-message" style="color:red;">Error: Order details not found.</p>';
            }
        } catch (error) {
            console.error("Error fetching order details for modal:", error);
            elements.modalBody.innerHTML = `<p class="loading-message" style="color:red;">Error loading details: ${error.message}</p>`;
            orderIdForModal = null; // Clear ID on error
        }
    }

    // मोडाल बंद करने का फंक्शन
    function closeModal() {
        if (elements.modalOverlay) {
            elements.modalOverlay.classList.remove('active');
            orderIdForModal = null; // स्टोर की गई ID साफ़ करें
            customerDetailsForModal = null; // Clear stored customer details
            console.log("Modal closed.");
        }
    }

    // *** NEW: मोडाल से स्टेटस सेव करने का फंक्शन ***
    async function saveStatusFromModal() {
        if (!orderIdForModal) {
            alert("Error: No order ID available for saving status.");
            return;
        }
        if (!elements.modalStatusSelect) {
             alert("Error: Status dropdown element not found.");
             return;
        }
        if (!db || !doc || !updateDoc) {
             alert("Database update function not available.");
             return;
        }

        const newStatus = elements.modalStatusSelect.value;
        console.log(`Attempting to update status for order ${orderIdForModal} to ${newStatus}`);

        elements.modalSaveStatusBtn.disabled = true;
        elements.modalSaveStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            const orderRef = doc(db, "orders", orderIdForModal);
            await updateDoc(orderRef, {
                status: newStatus,
                updatedAt: new Date() // Update timestamp
            });

            console.log(`Order ${orderIdForModal} status updated to ${newStatus}`);
            alert("Order status updated successfully!");

            // --- Trigger WhatsApp Popup if applicable ---
            const statusesForPopup = ['Verification', 'Delivered'];
            const orderDisplayId = document.querySelector(`#detailsModal p strong:contains('Order ID:')`)?.nextSibling.textContent.trim() || orderIdForModal; // Try to get display ID

            if (customerDetailsForModal && statusesForPopup.includes(newStatus)) {
                 console.log(`Status '${newStatus}' triggers WhatsApp popup from history.`);
                 triggerWhatsAppPopupHistory(customerDetailsForModal, orderDisplayId, newStatus); // Pass customer details, display ID, and status
            }

            closeModal(); // Close modal after successful save

        } catch (error) {
             console.error("Error updating order status:", error);
             alert("Error updating status: " + error.message);
             elements.modalSaveStatusBtn.disabled = false; // Re-enable button on error
        } finally {
             // Restore button text
             if (elements.modalSaveStatusBtn) {
                 elements.modalSaveStatusBtn.innerHTML = '<i class="fas fa-save"></i> Save Status';
             }
        }
    }


    // Firestore से ऑर्डर डिलीट करने का फंक्शन (Same as before, uses orderIdForModal)
    async function deleteOrderFromFirestore() {
        if (!orderIdForModal) { alert("No order selected for deletion."); return; }
        if (!db || !doc || !deleteDoc) { alert("Database delete function not available."); return; }

        if (confirm(`Are you sure you want to delete this order (${orderIdForModal})? This cannot be undone.`)) {
            console.log("Attempting to delete order:", orderIdForModal);
            elements.modalDeleteBtn.disabled = true;
            elements.modalDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

            try {
                 await deleteDoc(doc(db, "orders", orderIdForModal));
                 alert("Order deleted successfully!");
                 console.log("Order deleted:", orderIdForModal);
                 closeModal(); // मोडाल बंद करें (Table will auto-update via listener)
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

    // एडिट पेज पर रीडायरेक्ट करने का फंक्शन (Same as before, uses orderIdForModal)
    function redirectToEditPage() {
        if (orderIdForModal) {
            console.log("Redirecting to edit page for order:", orderIdForModal);
            window.location.href = `new_order.html?editOrderId=${orderIdForModal}`; // Pass Firestore ID
        } else {
            alert("Could not determine which order to edit.");
            console.warn("redirectToEditPage called without orderIdForModal set.");
        }
    }


    // --- Firestore Listener सेट अप (Same as before) ---
    function listenToOrders() {
        if (currentOrderListenerUnsub) {
            console.log("Stopping previous Firestore listener.");
            currentOrderListenerUnsub();
        }
        try {
            console.log("Setting up Firestore listener for 'orders' collection...");
            const ordersRef = collection(db, "orders");
            // Order by creation date, newest first. Ensure you have a Firestore index for this.
            const q = query(ordersRef, orderBy("createdAt", "desc"));

            currentOrderListenerUnsub = onSnapshot(q, (snapshot) => {
                console.log(`Snapshot received: ${snapshot.size} documents.`);
                allOrders = []; // Clear previous list
                snapshot.forEach((doc) => {
                     allOrders.push({ id: doc.id, ...doc.data() }); // Store Firestore ID and data
                });
                console.log("Total orders processed:", allOrders.length);
                // Apply filters and pagination whenever data changes
                applyFiltersAndPagination();

            }, (error) => {
                // Error in listener
                console.error("Error listening to order updates: ", error);
                elements.tableBody.innerHTML = `<tr><td colspan="8" class="loading-message" style="color:red;">Error loading orders: ${error.message}. Check console.</td></tr>`;
            });
            console.log("Firestore listener successfully attached.");

        } catch (e) {
            // Error setting up listener
            console.error("Failed to set up Firestore listener: ", e);
            elements.tableBody.innerHTML = `<tr><td colspan="8" class="loading-message" style="color:red;">Database listener error: ${e.message}. Check console.</td></tr>`;
        }
    }

    // --- WhatsApp Popup Functions (Adapted for History Page) ---
    function triggerWhatsAppPopupHistory(customer, orderId, status) {
        // Ensure elements specific to the history page popup are referenced
        if (!elements.whatsappReminderPopupHistory || !elements.whatsappMsgPreviewHistory || !elements.whatsappSendLinkHistory) {
            console.error("[DEBUG] WhatsApp popup elements missing in history page.");
            alert("Error: Could not find WhatsApp popup elements.");
            return;
        }

        const customerName = customer?.fullName ? customer.fullName.trim() : 'Customer';
        const customerNumber = customer?.whatsappNo?.replace(/[^0-9]/g, '');

        if (!customerNumber) {
            console.warn("[DEBUG] WhatsApp No missing or invalid for customer:", customerName);
            // Optionally inform user if needed, but don't block workflow
            return;
        }

        let message = '';
        const signature = "\n\n*Madhav Multy Print*\nMob. 9549116541";

        // Generate message based on status (Only Verification and Delivered trigger this)
        switch (status) {
            case 'Verification':
                message = `नमस्ते *${customerName}*,\n\nआपके ऑर्डर (ID: *${orderId}*) का डिज़ाइन वेरिफिकेशन के लिए तैयार है।`;
                message += `\nकृपया डिज़ाइन को ध्यानपूर्वक चेक करें। *OK* का जवाब देने के बाद कोई बदलाव संभव नहीं होगा।`;
                message += `\n\nधन्यवाद!`;
                break;
            case 'Delivered':
                message = `नमस्ते *${customerName}*,\n\nआपका ऑर्डर (ID: *${orderId}*) सफलतापूर्वक डिलीवर कर दिया गया है।`;
                message += `\n\nहमें सेवा का अवसर देने के लिए धन्यवाद!`;
                break;
            default:
                console.log(`[DEBUG] WhatsApp popup triggered for unhandled status from history: ${status}`);
                return; // Don't show for other statuses triggered from history update
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
        // Ensure elements specific to the history page popup are referenced
        if (elements.whatsappReminderPopupHistory) {
            elements.whatsappReminderPopupHistory.classList.remove('active');
        }
    }


    // --- इवेंट लिसनर्स जोड़ें ---
    elements.prevPageButton.addEventListener('click', () => goToPage(currentPage - 1));
    elements.nextPageButton.addEventListener('click', () => goToPage(currentPage + 1));
    elements.showEntriesSelect.addEventListener('change', () => { currentPage = 1; applyFiltersAndPagination(); });
    elements.searchInput.addEventListener('input', applyFiltersAndPagination); // Filter on input
    elements.filterDateInput.addEventListener('change', applyFiltersAndPagination);
    elements.filterStatusSelect.addEventListener('change', applyFiltersAndPagination);

    // मोडाल इवेंट्स
    elements.modalCloseBtn.addEventListener('click', closeModal);
    elements.modalOverlay.addEventListener('click', (event) => {
        if (event.target === elements.modalOverlay) { closeModal(); } // Close on overlay click
    });
    elements.modalDeleteBtn.addEventListener('click', deleteOrderFromFirestore);
    elements.modalGoToEditBtn.addEventListener('click', redirectToEditPage);
    elements.modalSaveStatusBtn.addEventListener('click', saveStatusFromModal); // Listener for new button

    // WhatsApp Popup Close Button (History specific)
    if (elements.popupCloseBtnHistory) {
         elements.popupCloseBtnHistory.addEventListener('click', closeWhatsAppPopupHistory);
    }
     // Optional: Close WhatsApp popup if overlay clicked
     if (elements.whatsappReminderPopupHistory) {
         elements.whatsappReminderPopupHistory.addEventListener('click', (event) => { if (event.target === elements.whatsappReminderPopupHistory) closeWhatsAppPopupHistory(); });
     }


    // --- इनिशियलाइज़ेशन ---
    console.log("Starting listener to wait for DB connection and fetch initial data...");
    // DB तैयार होने का इंतज़ार करें और फिर ऑर्डर सुनना शुरू करें (Same as before)
    const checkDbInterval = setInterval(() => {
        if (window.db) {
            clearInterval(checkDbInterval);
            console.log("DB connection ready. Initializing order listener...");
            listenToOrders(); // Start listening for orders
        } else {
            console.log("Waiting for DB connection...");
        }
    }, 200);

    console.log("Order History page script initialization complete.");

}); // End DOMContentLoaded Listener

// Helper function to check if an element contains specific text (case-insensitive)
// Used to find the Order ID in the modal for WhatsApp message
if (!Node.prototype.contains) {
  Node.prototype.contains = function(text) {
    return this.textContent.toLowerCase().includes(text.toLowerCase());
  };
}
if (!Element.prototype.contains) {
 Element.prototype.contains = function(text) {
   return this.textContent.toLowerCase().includes(text.toLowerCase());
 };
}