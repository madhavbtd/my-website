// js/order_history.js

// --- Ensure Firestore functions are available globally ---
// These should be populated by the inline script in HTML
const { db, collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc } = window;

// --- DOM Elements ---
const orderTableBody = document.getElementById('orderTableBody');
const loadingRow = document.getElementById('loadingMessage'); // Cell inside the loading row
const sortSelect = document.getElementById('sort-orders');

// Modal 1: Details/Edit Elements
const detailsModal = document.getElementById('detailsModal');
const closeModalBtn = document.getElementById('closeDetailsModal');
const modalOrderIdInput = document.getElementById('modalOrderId'); // Hidden input for Firestore ID
const modalDisplayOrderIdSpan = document.getElementById('modalDisplayOrderId');
const modalCustomerNameSpan = document.getElementById('modalCustomerName');
const modalOrderStatusSelect = document.getElementById('modalOrderStatus');
const modalUpdateStatusBtn = document.getElementById('modalUpdateStatusBtn');
const modalDeleteBtn = document.getElementById('modalDeleteBtn');
const modalEditFullBtn = document.getElementById('modalEditFullBtn');

// Modal 2: WhatsApp Reminder Elements
const whatsappReminderPopup = document.getElementById('whatsapp-reminder-popup');
const whatsappPopupCloseBtn = document.getElementById('popup-close-btn'); // Close button for WhatsApp popup
const whatsappMsgPreview = document.getElementById('whatsapp-message-preview');
const whatsappSendLink = document.getElementById('whatsapp-send-link');

// --- Global State ---
let currentSortField = 'createdAt'; // Default sort field
let currentSortDirection = 'desc'; // Default sort direction
let unsubscribeOrders = null; // Firestore listener cleanup function
let currentOrderDataCache = {}; // Cache order data {firestoreId: data} for modal/actions

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DEBUG] Order History DOM Loaded (v3 - Table/Dual Modal).");

    // Wait for DB connection established by inline script
    waitForDbConnection(() => {
        console.log("[DEBUG] DB connection confirmed. Initializing listener.");
        listenForOrders(); // Start listening with default sort

        // --- Event Listeners ---
        // Sorting Dropdown
        if (sortSelect) {
            sortSelect.addEventListener('change', handleSortChange);
        }

        // Modal 1 (Details/Edit) Listeners
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeDetailsModal);
        if (detailsModal) detailsModal.addEventListener('click', (event) => {
            if (event.target === detailsModal) closeDetailsModal(); // Close if clicking overlay
        });
        if (modalUpdateStatusBtn) modalUpdateStatusBtn.addEventListener('click', handleUpdateStatus);
        if (modalDeleteBtn) modalDeleteBtn.addEventListener('click', handleDeleteFromModal);
        if (modalEditFullBtn) modalEditFullBtn.addEventListener('click', handleEditFullFromModal);

        // Modal 2 (WhatsApp Reminder) Listeners
        if (whatsappPopupCloseBtn) {
             whatsappPopupCloseBtn.addEventListener('click', closeWhatsAppPopup);
        }
        if (whatsappReminderPopup) {
            whatsappReminderPopup.addEventListener('click', (event) => {
                if (event.target === whatsappReminderPopup) { // Click on overlay
                    closeWhatsAppPopup();
                }
            });
        }
         console.log("[DEBUG] All event listeners set up.");
    });
});

// --- DB Connection Wait ---
// Waits for the inline script in HTML to make window.db available
function waitForDbConnection(callback) {
    if (window.db) {
        console.log("[DEBUG] DB connection confirmed immediately.");
        callback();
    } else {
        let attempts = 0;
        const maxAttempts = 20; // Try for 5 seconds
        const intervalId = setInterval(() => {
            attempts++;
            if (window.db) {
                clearInterval(intervalId);
                console.log("[DEBUG] DB connection confirmed after check.");
                callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(intervalId);
                console.error("[DEBUG] DB connection timeout.");
                if(loadingRow) loadingRow.textContent = 'Database connection failed.';
                alert("Database connection failed. Please refresh the page.");
            }
        }, 250);
    }
}


// --- Sorting Change Handler ---
function handleSortChange() {
    if (!sortSelect) return;
    const selectedValue = sortSelect.value;
    const [field, direction] = selectedValue.split('_');

    if (field && direction) {
        // Prevent re-listening if selection hasn't actually changed
        if (field === currentSortField && direction === currentSortDirection) {
            console.log("[DEBUG] Sort selection unchanged.");
            return;
        }
        currentSortField = field;
        currentSortDirection = direction;
        console.log(`[DEBUG] Sort changed to: Field=${currentSortField}, Direction=${currentSortDirection}`);
        listenForOrders(); // Re-attach listener with new sorting
    }
}

// --- Firestore Listener Setup ---
function listenForOrders() {
    // Cleanup previous listener if it exists
    if (unsubscribeOrders) {
        console.log("[DEBUG] Unsubscribing previous order listener.");
        unsubscribeOrders();
        unsubscribeOrders = null;
    }

    // Check if Firestore functions are available
    if (!db || !collection || !query || !orderBy || !onSnapshot) {
        console.error("[DEBUG] Firestore functions not available!");
        orderTableBody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Error: Cannot connect to database functions.</td></tr>`;
        return;
    }

    // Show loading state
    orderTableBody.innerHTML = `<tr><td colspan="8" id="loadingMessage" style="text-align: center; color: #666;">Loading orders...</td></tr>`;

    try {
        console.log(`[DEBUG] Setting up Firestore listener for 'orders'. Sorting by ${currentSortField} ${currentSortDirection}...`);
        const ordersRef = collection(db, "orders");
        // Create the query based on selected sorting
        const q = query(ordersRef, orderBy(currentSortField, currentSortDirection));

        // Attach the real-time listener
        unsubscribeOrders = onSnapshot(q, (snapshot) => {
            console.log(`[DEBUG] Received ${snapshot.docs.length} orders from Firestore snapshot.`);
            orderTableBody.innerHTML = ''; // Clear loading message/previous orders
            currentOrderDataCache = {}; // Reset cache on new data

            if (snapshot.empty) {
                orderTableBody.innerHTML = `<tr><td colspan="8" id="noOrdersMessage" style="text-align: center; color: #666;">No orders found.</td></tr>`;
                return;
            }

            // Process and display each order
            snapshot.forEach(doc => {
                currentOrderDataCache[doc.id] = doc.data(); // Cache the data using Firestore ID as key
                displayOrderRow(doc.id, doc.data()); // Render the table row
            });

        }, (error) => {
            // Handle errors during listening
            console.error("[DEBUG] Error fetching orders snapshot:", error);
            orderTableBody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Error loading orders: ${error.message}. Please check console.</td></tr>`;
            unsubscribeOrders = null; // Reset listener state on error
        });

    } catch (error) {
        // Handle errors setting up the listener
        console.error("[DEBUG] Error setting up Firestore listener:", error);
         orderTableBody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Error setting up listener: ${error.message}.</td></tr>`;
         unsubscribeOrders = null;
    }
}

// --- Display Single Order Row in Table ---
function displayOrderRow(firestoreId, data) {
    const tableRow = document.createElement('tr');
    tableRow.setAttribute('data-id', firestoreId); // Store Firestore ID on the row

    // Extract data safely, providing defaults
    const customerName = data.customerDetails?.fullName || 'N/A';
    const orderDate = data.orderDate ? new Date(data.orderDate).toLocaleDateString() : '-';
    const deliveryDate = data.deliveryDate ? new Date(data.deliveryDate).toLocaleDateString() : '-';
    // Use the orderId field if available, otherwise show part of Firestore ID
    const displayId = data.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`;
    const status = data.status || 'Unknown';
    const priority = data.urgent || 'No'; // 'urgent' field maps to Priority

    // Determine CSS classes for status and priority for styling
    const statusClass = `status-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; // Sanitize status for CSS class
    const priorityClass = priority === 'Yes' ? 'priority-yes' : 'priority-no';

    // Populate table cells (ensure order matches <thead>)
    tableRow.innerHTML = `
        <td>${displayId}</td>
        <td>${customerName}</td>
        <td>${orderDate}</td>
        <td>${deliveryDate}</td>
        <td class="${priorityClass}">${priority}</td>
        <td><span class="status-badge ${statusClass}">${status}</span></td>
        <td>
            <button type="button" class="button details-edit-button" title="View Details / Edit Status">
                <i class="fas fa-info-circle"></i> Details/Edit
            </button>
        </td>
        <td>
             <button type="button" class="whatsapp-button" title="Send WhatsApp Update">
                <i class="fab fa-whatsapp"></i>
            </button>
        </td>
    `;

    // Add event listener for the "Details/Edit" button in this row
    const detailsButton = tableRow.querySelector('.details-edit-button');
    if (detailsButton) {
        detailsButton.addEventListener('click', (e) => {
             e.stopPropagation(); // Prevent potential row click events if added later
            openDetailsModal(firestoreId); // Pass the Firestore ID to the modal opener
        });
    }

     // Add event listener for the WhatsApp button in this row
    const whatsappButton = tableRow.querySelector('.whatsapp-button');
    if (whatsappButton) {
        whatsappButton.addEventListener('click', (e) => {
             e.stopPropagation();
            sendWhatsAppMessage(firestoreId); // Pass Firestore ID to WhatsApp function
        });
    }

    // Append the completed row to the table body
    orderTableBody.appendChild(tableRow);
}

// --- Modal 1 (Details/Edit) Handling ---
function openDetailsModal(firestoreId) {
    // Retrieve the cached data for this order
    const orderData = currentOrderDataCache[firestoreId];

    // Ensure data and modal exist
    if (!orderData || !detailsModal) {
        console.error("[DEBUG] Cannot open modal, order data not found in cache for ID:", firestoreId);
        alert("Could not load order details. Please refresh the page.");
        return;
    }

    console.log("[DEBUG] Opening details modal for Firestore ID:", firestoreId);

    // Populate Modal Fields
    modalOrderIdInput.value = firestoreId; // Store Firestore ID in hidden input
    modalDisplayOrderIdSpan.textContent = orderData.orderId || `(Sys: ${firestoreId.substring(0, 6)}...)`;
    modalCustomerNameSpan.textContent = orderData.customerDetails?.fullName || 'N/A';
    // Set the dropdown to the order's current status
    modalOrderStatusSelect.value = orderData.status || '';

    // Display the modal
    detailsModal.style.display = 'flex'; // Use 'flex' to enable alignment styles
}

function closeDetailsModal() {
    if (detailsModal) {
        detailsModal.style.display = 'none';
         console.log("[DEBUG] Details modal closed.");
    }
}

// --- Modal 1 Action Handlers ---

// Handle Status Update Button Click
async function handleUpdateStatus() {
    const firestoreId = modalOrderIdInput.value;
    const newStatus = modalOrderStatusSelect.value;

    // Validations
    if (!firestoreId || !newStatus) {
         alert("Error: Missing order ID or status for update.");
         return;
    }
    if (!db || !doc || !updateDoc) {
         alert("Error: Database update function not available.");
         return;
    }

    console.log(`[DEBUG] Attempting to update status for ${firestoreId} to ${newStatus}`);
    // Disable button to prevent multiple clicks
    modalUpdateStatusBtn.disabled = true;
    modalUpdateStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

    try {
        const orderRef = doc(db, "orders", firestoreId);
        // Update only the status and the updatedAt timestamp in Firestore
        await updateDoc(orderRef, {
            status: newStatus,
            updatedAt: new Date() // Use server timestamp if preferred: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[DEBUG] Status updated successfully in Firestore for ${firestoreId}`);

        // --- Trigger WhatsApp Popup ---
        const orderData = currentOrderDataCache[firestoreId]; // Get data again (or ensure it's up-to-date)
        if (orderData && orderData.customerDetails) {
             const displayId = orderData.orderId || `(Sys: ${firestoreId.substring(0,6)}...)`;
             // Show the WhatsApp prompt with the NEW status
             showStatusUpdateWhatsAppReminder(orderData.customerDetails, displayId, newStatus);
        } else {
            console.warn("[DEBUG] Could not show WhatsApp reminder post-update: Customer details missing.");
            alert("Status updated, but couldn't prepare WhatsApp message.");
            closeDetailsModal(); // Close details modal if WhatsApp can't be shown
        }
        // --- End Trigger ---

    } catch (error) {
        console.error(`[DEBUG] Error updating status for ${firestoreId}:`, error);
        alert(`Failed to update status: ${error.message}`);
    } finally {
        // Re-enable the button regardless of success or failure
        modalUpdateStatusBtn.disabled = false;
        modalUpdateStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Status';
    }
}

// Handle Delete Button Click in Modal
function handleDeleteFromModal() {
    const firestoreId = modalOrderIdInput.value;
    // Retrieve the display ID shown in the modal for the confirmation message
    const displayId = modalDisplayOrderIdSpan.textContent;
    if (!firestoreId) {
         alert("Error: Could not find Order ID to delete.");
         return;
    }
    console.log(`[DEBUG] Delete initiated from modal for Firestore ID: ${firestoreId}`);
    // Close the details modal *before* showing the confirmation dialog
    closeDetailsModal();
    // Call the main delete handler function
    handleDeleteOrder(firestoreId, displayId);
}

// Handle Edit Full Order Button Click in Modal
function handleEditFullFromModal() {
    const firestoreId = modalOrderIdInput.value;
    if (!firestoreId) {
         alert("Error: Could not find Order ID to edit.");
         return;
    }
    console.log(`[DEBUG] Redirecting to full edit page for Firestore ID: ${firestoreId}`);
    // Redirect to the new_order page, passing the Firestore ID as a URL parameter
    window.location.href = `new_order.html?editOrderId=${firestoreId}`;
}


// --- Main Delete Order Function (Called from Modal) ---
async function handleDeleteOrder(firestoreId, orderDisplayId) {
    console.log(`[DEBUG] handleDeleteOrder called for Firestore ID: ${firestoreId}`);
    // Check if delete function is available
    if (!db || !doc || !deleteDoc) {
         alert("Error: Delete function not available. Database connection issue.");
         return;
    }

    // Confirmation dialog
    if (confirm(`Are you sure you want to permanently delete Order ID: ${orderDisplayId}? This action cannot be undone.`)) {
        console.log(`[DEBUG] User confirmed deletion for ${firestoreId}.`);
        try {
            const orderRef = doc(db, "orders", firestoreId);
            // Perform the delete operation in Firestore
            await deleteDoc(orderRef);
            console.log(`[DEBUG] Order deleted successfully from Firestore: ${firestoreId}`);
            // UI automatically updates because of the onSnapshot listener.
            // Optionally, show a brief success message here if desired.
        } catch (error) {
            console.error(`[DEBUG] Error deleting order ${firestoreId}:`, error);
            alert(`Failed to delete order: ${error.message}`);
        }
    } else {
        // User cancelled deletion
        console.log("[DEBUG] Deletion cancelled by user.");
    }
}

// --- Modal 2 (WhatsApp Reminder) Handling ---

// Shows the WhatsApp popup after status update
function showStatusUpdateWhatsAppReminder(customer, orderId, updatedStatus) {
    // Ensure WhatsApp popup elements are available
    if (!whatsappReminderPopup || !whatsappMsgPreview || !whatsappSendLink) {
        console.error("[DEBUG] WhatsApp popup elements missing.");
        // Close details modal as WhatsApp popup cannot be shown
        closeDetailsModal();
        alert("Status Updated, but failed to show WhatsApp prompt.");
        return;
    }

    const customerName = customer.fullName || 'Customer';
    const customerNumber = customer.whatsappNo?.replace(/[^0-9]/g, ''); // Clean number

    // Don't show popup if WhatsApp number is missing
    if (!customerNumber) {
        console.warn("[DEBUG] WhatsApp No missing for status update reminder. Skipping popup.");
         // Close details modal as WhatsApp popup won't show
        closeDetailsModal();
        alert("Status Updated! (Customer WhatsApp number missing for sending update).");
        return;
    }

    // Construct the WhatsApp message for status update
    let message = `Hello ${customerName},\n\n`;
    message += `Update for your order (ID: ${orderId}):\n`;
    message += `The status has been updated to: *${updatedStatus}*.\n\n`; // Use Markdown for bold
    message += `Thank you!`;

    // Display the message preview
    whatsappMsgPreview.innerText = message;

    // Create the WhatsApp URL
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customerNumber}?text=${encodedMessage}`;
    whatsappSendLink.href = whatsappUrl; // Set the link on the button

    // Show the WhatsApp popup
    whatsappReminderPopup.classList.add('active'); // Use 'active' class to display
    console.log("[DEBUG] Status update WhatsApp reminder shown.");
}

// Closes the WhatsApp popup
function closeWhatsAppPopup() {
    if (whatsappReminderPopup) {
        whatsappReminderPopup.classList.remove('active');
        console.log("[DEBUG] WhatsApp reminder popup closed.");
        // Decide whether to close the details modal too
        // closeDetailsModal(); // Uncomment this line if you want Modal 1 to close when Modal 2 closes
    }
}

// --- Table Row WhatsApp Button Handler ---
// Sends a generic message or current status via WhatsApp from the table row button
function sendWhatsAppMessage(firestoreId) {
    const orderData = currentOrderDataCache[firestoreId]; // Get data from cache

    if (!orderData) {
        console.error("[DEBUG] Cannot send WhatsApp from table, order data missing for ID:", firestoreId);
        alert("Could not load order details for WhatsApp. Please refresh.");
        return;
    }

     const customer = orderData.customerDetails;
     const orderId = orderData.orderId || `(Sys: ${firestoreId.substring(0,6)}...)`;
     const status = orderData.status; // Get current status

    if (!customer || !customer.whatsappNo) {
        alert("Customer WhatsApp number is missing for this order.");
        return;
    }

    const customerName = customer.fullName || 'Customer';
    const customerNumber = customer.whatsappNo.replace(/[^0-9]/g, '');

    // Construct a generic message or current status message
    // You can customize this message
    let message = `Hello ${customerName},\nRegarding your order (ID: ${orderId}).\nCurrent Status: *${status}*.\n\nThank you!`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customerNumber}?text=${encodedMessage}`;

    console.log(`[DEBUG] Opening WhatsApp URL from table button: ${whatsappUrl}`);
    window.open(whatsappUrl, '_blank'); // Open WhatsApp in a new tab
}


// --- Final Log ---
console.log("order_history.js script fully loaded and initialized (v3).");