// js/customer_account_detail.js (Version 1.1a - Loads Orders without Amount)

// Firebase functions made global in HTML script block
// Ensure db, doc, getDoc, collection, query, where, getDocs, orderBy are available
const { db, doc, getDoc, collection, query, where, getDocs, orderBy: firestoreOrderBy } = window; // Alias orderBy

let currentCustomerId = null; // Store the ID of the customer being viewed

/**
 * Reads the customer ID from the URL query parameter (?id=...)
 * @returns {string|null} The customer ID or null if not found.
 */
function getCustomerIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

/**
 * Fetches customer data from Firestore and updates the HTML page.
 * @param {string} customerId - The Firestore document ID of the customer.
 */
async function loadCustomerDetails(customerId) {
    console.log(`V1.1a: Loading details for customer: ${customerId}`);
    if (!db || !doc || !getDoc) {
        console.error("V1.1a: Firestore functions not available for loading details.");
        displayError("Database error. Cannot load details.");
        return;
    }

    // Get references to HTML elements
    const nameHeaderEl = document.getElementById('cust-detail-name-header');
    const nameBreadcrumbEl = document.getElementById('cust-detail-name-breadcrumb');
    const idEl = document.getElementById('cust-detail-id');
    const whatsappEl = document.getElementById('cust-detail-whatsapp');
    const contactEl = document.getElementById('cust-detail-contact');
    const emailEl = document.getElementById('cust-detail-email');
    const addressEl = document.getElementById('cust-detail-address');
    const cityEl = document.getElementById('cust-detail-city');
    const stateEl = document.getElementById('cust-detail-state');
    const statusEl = document.getElementById('cust-detail-status');
    const creditAllowedEl = document.getElementById('cust-detail-credit-allowed');
    const creditLimitEl = document.getElementById('cust-detail-credit-limit');
    const notesEl = document.getElementById('cust-detail-notes');
    const toggleStatusBtn = document.getElementById('toggleStatusBtn');
    const toggleStatusBtnSpan = toggleStatusBtn ? toggleStatusBtn.querySelector('span') : null;
    const addNewOrderLink = document.getElementById('addNewOrderLink');
    const editCustomerBtn = document.getElementById('editCustomerBtn');
    const addPaymentBtn = document.getElementById('addPaymentBtn');
    const deleteCustomerBtn = document.getElementById('deleteCustomerBtn');

     // Display initial loading state
     if (nameHeaderEl) nameHeaderEl.textContent = "Loading...";
     if (nameBreadcrumbEl) nameBreadcrumbEl.textContent = "Loading...";

    try {
        const customerRef = doc(db, "customers", customerId);
        const customerSnap = await getDoc(customerRef);

        if (customerSnap.exists()) {
            const data = customerSnap.data();
            console.log("V1.1a: Customer data fetched:", data);

            // Populate HTML elements
            const customerName = data.fullName || 'N/A';
            if(nameHeaderEl) nameHeaderEl.textContent = customerName;
            if(nameBreadcrumbEl) nameBreadcrumbEl.textContent = customerName;
            document.title = `Customer Account - ${customerName}`;

            if(idEl) idEl.textContent = data.customCustomerId || 'N/A';
            if(whatsappEl) whatsappEl.textContent = data.whatsappNo || '-';
            if(contactEl) contactEl.textContent = data.contactNo || '-';
            if(emailEl) emailEl.textContent = data.email || '-';
            if(addressEl) addressEl.textContent = (data.billingAddress || data.address || '-');
            if(cityEl) cityEl.textContent = data.city || '-';
            if(stateEl) stateEl.textContent = data.state || '-';

            // Status
            const status = data.status || 'active';
            if (statusEl) {
                statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
                statusEl.className = 'status-badge';
                statusEl.classList.add(`status-${status.toLowerCase()}`);
            }
            if(toggleStatusBtnSpan) {
                toggleStatusBtnSpan.textContent = (status === 'active') ? 'Disable Account' : 'Enable Account';
                if (toggleStatusBtn) toggleStatusBtn.querySelector('i').className = (status === 'active') ? 'fas fa-toggle-on' : 'fas fa-toggle-off';
            }

            // Credit Info
            const creditAllowed = data.creditAllowed === true;
            if(creditAllowedEl) creditAllowedEl.textContent = creditAllowed ? 'Yes' : 'No';
            if(creditLimitEl) creditLimitEl.textContent = creditAllowed ? `₹${Number(data.creditLimit || 0).toLocaleString('en-IN')}` : 'N/A';

            // Notes
             if(notesEl) notesEl.textContent = data.notes || 'No remarks.';

            // Enable Action Buttons
             if(editCustomerBtn) editCustomerBtn.disabled = false;
             if(addPaymentBtn) addPaymentBtn.disabled = false;
             if(toggleStatusBtn) toggleStatusBtn.disabled = false;
             if(deleteCustomerBtn) deleteCustomerBtn.disabled = false;

             // Update Add New Order link
             if(addNewOrderLink) {
                 addNewOrderLink.href = `new_order.html?customerId=${encodeURIComponent(customerId)}&customerName=${encodeURIComponent(customerName)}`;
                 addNewOrderLink.classList.remove('disabled');
             }

            console.log("V1.1a: Customer details displayed successfully.");

        } else {
            console.error(`V1.1a: Customer document with ID ${customerId} does not exist.`);
            displayError("Customer not found.");
        }
    } catch (error) {
        console.error("V1.1a: Error loading customer details:", error);
        displayError(`Error loading details: ${error.message}`);
    }
}

/**
 * Fetches and displays the order history for a specific customer.
 * (Version 1.1a - Modified: Does NOT calculate total order value)
 * @param {string} customerId - The Firestore document ID of the customer.
 * @returns {Promise<number>} - A promise that resolves (returns 0 as total value is not calculated).
 */
async function loadOrderHistory(customerId) {
    console.log(`V1.1a: Loading order history for customer: ${customerId} (Amount field ignored)`);
    const orderTableBody = document.getElementById('customerOrderTableBody');
    const summaryTotalOrdersEl = document.getElementById('summary-total-orders');
    // const totalOrderValue = 0; // Not calculating this now

    if (!orderTableBody || !summaryTotalOrdersEl) {
        console.error("V1.1a: Order table body or summary element not found.");
        return 0;
    }

    // Firestore functions should be available from window scope
     if (!collection || !query || !where || !getDocs || !firestoreOrderBy ) {
         console.error("V1.1a: Firestore query functions not available.");
         orderTableBody.innerHTML = `<tr><td colspan="5" class="text-danger" style="text-align: center;">Error: DB function missing</td></tr>`; // Colspan 5
         summaryTotalOrdersEl.textContent = "Error";
         document.getElementById('summary-balance').textContent = "Error"; // Also error
         return 0;
    }

    orderTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Loading orders...</td></tr>`; // Colspan 5
    summaryTotalOrdersEl.textContent = "N/A"; // Set summary to N/A
    document.getElementById('summary-balance').textContent = "N/A"; // Balance also N/A

    try {
        const ordersRef = collection(db, "orders");
        // Query orders for the specific customer, order by creation date descending
        const q = query(ordersRef,
                      where("customerId", "==", customerId),
                      firestoreOrderBy("createdAt", "desc")); // Make sure 'createdAt' field exists in orders

        const querySnapshot = await getDocs(q);

        orderTableBody.innerHTML = ''; // Clear loading message

        if (querySnapshot.empty) {
            console.log("V1.1a: No orders found for this customer.");
            orderTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No orders found for this customer.</td></tr>`; // Colspan 5
        } else {
            querySnapshot.forEach(doc => {
                const order = doc.data();
                const orderId = order.customOrderId || doc.id; // Prefer customOrderId if it exists
                const orderDate = order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A';
                // const orderAmount = Number(order.orderTotalAmount || 0); // --- SKIPPED ---
                const status = order.currentStatus || 'Unknown';

                // totalOrderValue += orderAmount; // --- SKIPPED ---

                // Create table row (Amount column is removed from HTML)
                const row = document.createElement('tr');

                // Display products (basic implementation)
                let productsHtml = 'N/A';
                if (order.products && Array.isArray(order.products)) {
                   productsHtml = order.products.map(p => {
                       return `${p.name || 'Unnamed Product'} (${p.quantity || 'Qty?'})`; // Show name and quantity
                   }).join('<br>');
                }

                // HTML structure without the Amount column
                row.innerHTML = `
                    <td>${orderId}</td>
                    <td>${orderDate}</td>
                    <td>${productsHtml}</td>
                    <td><span class="status-badge status-${status.toLowerCase().replace(/\s+/g, '-')}">${status}</span></td>
                    <td>
                        <button class="button details-edit-button view-order-btn" data-order-id="${doc.id}" title="View Order Details">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </td>
                `;
                orderTableBody.appendChild(row);
            });

            // Add event listeners for the "View" buttons
             orderTableBody.querySelectorAll('.view-order-btn').forEach(btn => {
                 btn.addEventListener('click', (e) => {
                     e.stopPropagation(); // Prevent row click if row has listener
                     const viewOrderId = btn.getAttribute('data-order-id');
                     console.log(`V1.1a: View button clicked for Order ID: ${viewOrderId}`);
                     // --- Placeholder Action ---
                     alert(`Order details view not implemented yet for ID: ${viewOrderId}`);
                     // --- Future Implementation Ideas ---
                     // 1. Open a Modal: Adapt modal from order_history.html/js
                     //    openOrderDetailModal(viewOrderId);
                     // 2. Navigate to a new page:
                     //    window.location.href = `order_detail_view.html?id=${viewOrderId}`;
                 });
             });
        }

        // Update the summary section - It remains N/A
        // summaryTotalOrdersEl.textContent = `₹${totalOrderValue.toLocaleString('en-IN')}`; // --- SKIPPED ---
        console.log(`V1.1a: Order history loaded (Amount calculation skipped).`);
        return 0; // Return 0 as we didn't calculate total value

    } catch (error) {
        console.error("V1.1a: Error loading order history:", error);
        orderTableBody.innerHTML = `<tr><td colspan="5" class="text-danger" style="text-align: center;">Error loading orders: ${error.message}</td></tr>`; // Colspan 5
        summaryTotalOrdersEl.textContent = "Error";
        document.getElementById('summary-balance').textContent = "Error";
        return 0;
    }
}


/**
 * Displays an error message on the page.
 * @param {string} message - The error message to display.
 */
function displayError(message) {
     console.error("V1.1a: Displaying Error - ", message);
     alert(message); // Simple alert notification
     const nameHeaderEl = document.getElementById('cust-detail-name-header');
     const nameBreadcrumbEl = document.getElementById('cust-detail-name-breadcrumb');
     if(nameHeaderEl) nameHeaderEl.textContent = "Error";
     if(nameBreadcrumbEl) nameBreadcrumbEl.textContent = "Error";
     document.title = "Error Loading Customer";
     // Disable all action buttons on error
     document.querySelectorAll('.cust-detail-actions button').forEach(btn => btn.disabled = true);
     document.querySelectorAll('.cust-detail-actions a.button').forEach(btn => btn.classList.add('disabled'));
}


/**
 * Main function to initialize the page.
 * Fetches customer ID and loads data.
 * This function is made global and called by the inline script in HTML after auth check.
 */
window.initializeCustomerDetailPage = async function(user) { // Make sure it's async
    console.log("V1.1a: Initializing customer detail page...");
    currentCustomerId = getCustomerIdFromUrl();

    if (!currentCustomerId) {
        console.error("V1.1a: Customer ID not found in URL.");
        displayError("Could not load customer details. ID missing.");
        return;
    }

    console.log(`V1.1a: Customer ID found: ${currentCustomerId}`);

    // Load customer details first
    await loadCustomerDetails(currentCustomerId);

    // Load order history (Modified version - doesn't need return value for now)
    await loadOrderHistory(currentCustomerId);

    // --- Placeholders for future phases ---
    console.log("V1.1a: Next steps: Load Payment History (Phase 3) and implement actions (Phase 4).");
    // await loadPaymentHistory(currentCustomerId); // Phase 3 call
    // setupActionListeners(currentCustomerId); // Phase 4 call
}

console.log("customer_account_detail.js (V1.1a) loaded.");