// js/customer_account_detail.js (Version 1)

// Firebase functions made global in HTML script block
const { db, doc, getDoc } = window;

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
    console.log(`V1: Loading details for customer: ${customerId}`);
    if (!db || !doc || !getDoc) {
        console.error("V1: Firestore functions not available for loading details.");
        displayError("Database error. Cannot load details.");
        return;
    }

    // Get references to HTML elements (cache them for performance if needed later)
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

    // Action buttons to enable
    const editCustomerBtn = document.getElementById('editCustomerBtn');
    const addPaymentBtn = document.getElementById('addPaymentBtn');
    const deleteCustomerBtn = document.getElementById('deleteCustomerBtn');

    // Display initial loading state in key areas
     if (nameHeaderEl) nameHeaderEl.textContent = "Loading...";
     if (nameBreadcrumbEl) nameBreadcrumbEl.textContent = "Loading...";

    try {
        const customerRef = doc(db, "customers", customerId);
        const customerSnap = await getDoc(customerRef);

        if (customerSnap.exists()) {
            const data = customerSnap.data();
            console.log("V1: Customer data fetched:", data);

            // --- Populate HTML elements ---
            const customerName = data.fullName || 'N/A';
            if(nameHeaderEl) nameHeaderEl.textContent = customerName;
            if(nameBreadcrumbEl) nameBreadcrumbEl.textContent = customerName;
            document.title = `Customer Account - ${customerName}`; // Update page title

            if(idEl) idEl.textContent = data.customCustomerId || 'N/A';
            if(whatsappEl) whatsappEl.textContent = data.whatsappNo || '-';
            if(contactEl) contactEl.textContent = data.contactNo || '-';
            if(emailEl) emailEl.textContent = data.email || '-';
            if(addressEl) addressEl.textContent = (data.billingAddress || data.address || '-');
            if(cityEl) cityEl.textContent = data.city || '-';
            if(stateEl) stateEl.textContent = data.state || '-';

            // Status Handling
            const status = data.status || 'active'; // Default to active
            if (statusEl) {
                statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
                statusEl.className = 'status-badge'; // Reset class
                statusEl.classList.add(`status-${status.toLowerCase()}`); // Add specific class
            }
            // Update Toggle button based on status
            if(toggleStatusBtnSpan) {
                toggleStatusBtnSpan.textContent = (status === 'active') ? 'Disable Account' : 'Enable Account';
                toggleStatusBtn.querySelector('i').className = (status === 'active') ? 'fas fa-toggle-on' : 'fas fa-toggle-off';
            }

            // Credit Info
            const creditAllowed = data.creditAllowed === true; // Explicit boolean check
            if(creditAllowedEl) creditAllowedEl.textContent = creditAllowed ? 'Yes' : 'No';
            if(creditLimitEl) creditLimitEl.textContent = creditAllowed ? `₹${Number(data.creditLimit || 0).toLocaleString('en-IN')}` : 'N/A';

            // Notes
             if(notesEl) notesEl.textContent = data.notes || 'No remarks.';

            // --- Enable Action Buttons ---
             if(editCustomerBtn) editCustomerBtn.disabled = false;
             if(addPaymentBtn) addPaymentBtn.disabled = false;
             if(toggleStatusBtn) toggleStatusBtn.disabled = false;
             if(deleteCustomerBtn) deleteCustomerBtn.disabled = false;

             // Update Add New Order link with customer ID and name
             if(addNewOrderLink) {
                 addNewOrderLink.href = `new_order.html?customerId=${encodeURIComponent(customerId)}&customerName=${encodeURIComponent(customerName)}`;
                 addNewOrderLink.classList.remove('disabled');
             }

             console.log("V1: Customer details displayed successfully.");

        } else {
            console.error(`V1: Customer document with ID ${customerId} does not exist.`);
            displayError("Customer not found.");
        }
    } catch (error) {
        console.error("V1: Error loading customer details:", error);
        displayError(`Error loading details: ${error.message}`);
    }
}

/**
 * Displays an error message on the page.
 * @param {string} message - The error message to display.
 */
function displayError(message) {
     alert(message); // Simple alert for now
     const nameHeaderEl = document.getElementById('cust-detail-name-header');
     const nameBreadcrumbEl = document.getElementById('cust-detail-name-breadcrumb');
     if(nameHeaderEl) nameHeaderEl.textContent = "Error";
     if(nameBreadcrumbEl) nameBreadcrumbEl.textContent = "Error";
     document.title = "Error Loading Customer";
     // Disable all action buttons
     document.querySelectorAll('.cust-detail-actions button').forEach(btn => btn.disabled = true);
     document.querySelectorAll('.cust-detail-actions a.button').forEach(btn => btn.classList.add('disabled'));
}


/**
 * Main function to initialize the page.
 * Fetches customer ID and loads data.
 * This function is made global and called by the inline script in HTML after auth check.
 */
window.initializeCustomerDetailPage = async function(user) {
    console.log("V1: Initializing customer detail page...");
    currentCustomerId = getCustomerIdFromUrl();

    if (!currentCustomerId) {
        console.error("V1: Customer ID not found in URL.");
        displayError("Could not load customer details. ID missing.");
        // Optional: Redirect back
        // window.location.href = 'customer_management.html';
        return;
    }

    console.log(`V1: Customer ID found: ${currentCustomerId}`);
    await loadCustomerDetails(currentCustomerId);

    // --- Placeholders for future phases ---
    console.log("V1: Next steps: Load Order History, Payment History, and implement actions.");
    // await loadOrderHistory(currentCustomerId); // Phase 2
    // await loadPaymentHistory(currentCustomerId); // Phase 3
    // setupActionListeners(currentCustomerId); // Phase 4
}

console.log("customer_account_detail.js (V1) loaded.");