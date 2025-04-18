// js/new_order.js

// Get Firestore functions (from firebase init script)
const { db, collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, limit } = window;

// --- Global Variables ---
let addedProducts = []; // Array to hold products added by the user
let isEditMode = false; // Is this edit mode?
let orderIdToEdit = null; // Firestore ID of the order being edited
let selectedCustomerId = null; // Firestore ID of the customer selected via autocomplete

// --- DOM Element References ---
const orderForm = document.getElementById('newOrderForm');
const saveButton = document.getElementById('saveOrderBtn');
const saveButtonText = saveButton ? saveButton.querySelector('span') : null;
const formHeader = document.getElementById('formHeader');
const hiddenEditOrderIdInput = document.getElementById('editOrderId');
const selectedCustomerIdInput = document.getElementById('selectedCustomerId'); // Hidden input for customer ID
const displayOrderIdInput = document.getElementById('display_order_id');
const manualOrderIdInput = document.getElementById('manual_order_id');

const customerNameInput = document.getElementById('full_name');
const customerWhatsAppInput = document.getElementById('whatsapp_no');
const customerAddressInput = document.getElementById('address');
const customerContactInput = document.getElementById('contact_no'); // Contact No is kept
const customerSuggestionsNameBox = document.getElementById('customer-suggestions-name');
const customerSuggestionsWhatsAppBox = document.getElementById('customer-suggestions-whatsapp');

const productNameInput = document.getElementById('product_name_input');
const quantityInput = document.getElementById('quantity_input');
const addProductBtn = document.getElementById('add-product-btn');
const productListContainer = document.getElementById('product-list');
const productSuggestionsBox = document.getElementById('product-suggestions');

const orderStatusCheckboxes = document.querySelectorAll('input[name="order_status"]');
const orderStatusGroup = document.getElementById('order-status-group');

const whatsappReminderPopup = document.getElementById('whatsapp-reminder-popup');
const whatsappMsgPreview = document.getElementById('whatsapp-message-preview');
const whatsappSendLink = document.getElementById('whatsapp-send-link');
const popupCloseBtn = document.getElementById('popup-close-btn');

// --- Initialization on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("New Order DOM Loaded. Initializing...");
    waitForDbConnection(initializeForm); // Wait for DB then initialize

    // --- Event Listeners ---
    if (orderForm) orderForm.addEventListener('submit', handleFormSubmit);
    else console.error("FATAL: Order form (#newOrderForm) not found!");

    if (addProductBtn) addProductBtn.addEventListener('click', handleAddProduct);
    else console.error("Add product button (#add-product-btn) not found!");

    if (productListContainer) productListContainer.addEventListener('click', handleDeleteProduct);
    else console.error("Product list container (#product-list) not found!");

    // Autocomplete Listeners
    if (customerNameInput) customerNameInput.addEventListener('input', (e) => handleCustomerInput(e, 'name'));
    if (customerWhatsAppInput) customerWhatsAppInput.addEventListener('input', (e) => handleCustomerInput(e, 'whatsapp'));
    if (productNameInput) productNameInput.addEventListener('input', handleProductInput);

     // Popup Listeners
     if (popupCloseBtn) popupCloseBtn.addEventListener('click', closeWhatsAppPopup);
     if (whatsappReminderPopup) {
         whatsappReminderPopup.addEventListener('click', (event) => {
             if (event.target === whatsappReminderPopup) closeWhatsAppPopup();
         });
     }
});

// --- Wait for DB Connection ---
function waitForDbConnection(callback) {
    if (window.db) {
        console.log("DB connection confirmed immediately.");
        callback();
    } else {
        let attempts = 0;
        const maxAttempts = 20; // Approx 5 seconds
        const intervalId = setInterval(() => {
            attempts++;
            if (window.db) {
                clearInterval(intervalId);
                console.log("DB connection confirmed after check.");
                callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(intervalId);
                console.error("DB connection timeout. Firebase might not be initialized correctly.");
                alert("Database connection failed. Please refresh the page or check console.");
            } else {
                // console.log("Waiting for DB connection..."); // Reduce console noise
            }
        }, 250);
    }
}

// --- Initialize Form (Edit vs Add Mode) ---
function initializeForm() {
    const urlParams = new URLSearchParams(window.location.search);
    orderIdToEdit = urlParams.get('editOrderId'); // Firestore Document ID

    if (orderIdToEdit) {
        isEditMode = true;
        console.log("Edit Mode Initializing. Order Firestore ID:", orderIdToEdit);
        if(formHeader) formHeader.textContent = "Edit Order"; // English
        if(saveButtonText) saveButtonText.textContent = "Update Order"; // English
        if(hiddenEditOrderIdInput) hiddenEditOrderIdInput.value = orderIdToEdit;
        if(manualOrderIdInput) manualOrderIdInput.readOnly = true;
        loadOrderForEdit(orderIdToEdit); // Load existing data
        handleStatusCheckboxes(true); // Enable status checkboxes

    } else {
        isEditMode = false;
        console.log("Add Mode Initializing.");
        if(formHeader) formHeader.textContent = "New Order"; // English
        if(saveButtonText) saveButtonText.textContent = "Save Order"; // English
        if(manualOrderIdInput) manualOrderIdInput.readOnly = false;
        const orderDateInput = document.getElementById('order_date');
        if (orderDateInput && !orderDateInput.value) {
            orderDateInput.value = new Date().toISOString().split('T')[0]; // Default date
        }
        handleStatusCheckboxes(false); // Control status for new order
        renderProductList(); // Render empty product list
        resetCustomerSelection(); // Ensure no customer is selected initially
    }
}

// --- Load Order Data for Editing ---
async function loadOrderForEdit(docId) {
    console.log(`Loading order data for edit from Firestore: ${docId}`);
    try {
        const orderRef = doc(db, "orders", docId);
        const docSnap = await getDoc(orderRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("Order data for edit:", data);

            // Fill customer details
            customerNameInput.value = data.customerDetails?.fullName || '';
            customerAddressInput.value = data.customerDetails?.address || '';
            customerWhatsAppInput.value = data.customerDetails?.whatsappNo || '';
            customerContactInput.value = data.customerDetails?.contactNo || ''; // Contact No is kept
            selectedCustomerId = data.customerId || null; // Store customer ID
            if (selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId;
            // Make address/contact readonly after loading existing customer
            customerAddressInput.readOnly = true;
            customerContactInput.readOnly = true;

            // Fill order details
            displayOrderIdInput.value = data.orderId || docId; // Show system ID
            manualOrderIdInput.value = data.orderId || ''; // Show in manual field too (readonly)
            orderForm.order_date.value = data.orderDate || '';
            orderForm.delivery_date.value = data.deliveryDate || '';
            orderForm.remarks.value = data.remarks || '';

            // Set urgent status
            const urgentVal = data.urgent || 'No';
            const urgentRadio = orderForm.querySelector(`input[name="urgent"][value="${urgentVal}"]`);
            if (urgentRadio) urgentRadio.checked = true;

            // Set order status
            orderStatusCheckboxes.forEach(cb => cb.checked = false);
            if (data.status) {
                const statusCheckbox = orderForm.querySelector(`input[name="order_status"][value="${data.status}"]`);
                if (statusCheckbox) statusCheckbox.checked = true;
            }

            // Fill product list
            addedProducts = data.products || []; // Load products into global array
            renderProductList(); // Display products in UI

        } else {
            console.error("Order document not found for editing!");
            alert("Error: Cannot find the order to edit.");
            window.location.href = 'order_history.html'; // Redirect back
        }
    } catch (error) {
        console.error("Error loading order for edit:", error);
        alert("Error loading order data: " + error.message);
        window.location.href = 'order_history.html';
    }
}


// --- Product Handling Functions ---

// Add product to list
function handleAddProduct() {
    const name = productNameInput.value.trim();
    const quantity = quantityInput.value.trim();

    // Basic Validation
    if (!name) {
        alert("Please select or enter a product name."); // English
        productNameInput.focus();
        return;
    }
    // Optional: Add validation here to check if 'name' is from your Firestore 'products' list
    // if (!isProductFromAutocomplete(name)) { // Need to implement this check if required
    //     alert("Please select a product from the suggestions. New products cannot be added here.");
    //     return;
    // }

     if (!quantity || isNaN(quantity) || Number(quantity) <= 0) {
        alert("Please enter a valid quantity."); // English
        quantityInput.focus();
        return;
    }

    // Add to global array
    addedProducts.push({ name: name, quantity: Number(quantity) });
    console.log("Product added:", addedProducts);

    // Update UI list
    renderProductList();

    // Clear inputs for next product
    productNameInput.value = '';
    quantityInput.value = '';
    productNameInput.focus();
    if (productSuggestionsBox) productSuggestionsBox.innerHTML = ''; // Clear suggestions
    productNameInput.readOnly = false; // Ensure name is editable for next product search
}

// Render product list in UI
function renderProductList() {
    if (!productListContainer) return;
    productListContainer.innerHTML = ''; // Clear current list

    if (addedProducts.length === 0) {
        productListContainer.innerHTML = '<p class="empty-list-message">No products added yet.</p>'; // English
        return;
    }

    addedProducts.forEach((product, index) => {
        const listItem = document.createElement('div');
        listItem.classList.add('product-list-item');
        listItem.innerHTML = `
            <span>${index + 1}. ${product.name} - Qty: ${product.quantity}</span>
            <button type="button" class="delete-product-btn" data-index="${index}" title="Delete Product">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        productListContainer.appendChild(listItem);
    });
}

// Delete product from list
function handleDeleteProduct(event) {
    const deleteButton = event.target.closest('.delete-product-btn');
    if (deleteButton) {
        const indexToDelete = parseInt(deleteButton.dataset.index, 10);
        if (!isNaN(indexToDelete) && indexToDelete >= 0 && indexToDelete < addedProducts.length) {
            addedProducts.splice(indexToDelete, 1); // Remove from array
            console.log("Product deleted:", addedProducts);
            renderProductList(); // Update UI
        }
    }
}

// --- Status Checkbox Handling ---
function handleStatusCheckboxes(isEditing) {
    const defaultStatus = "Order Received";
    let defaultCheckbox = null;

    orderStatusCheckboxes.forEach(checkbox => {
        if (checkbox.value === defaultStatus) {
            defaultCheckbox = checkbox;
        }
        checkbox.disabled = !isEditing; // Disable if not editing
        checkbox.closest('label').classList.toggle('disabled', !isEditing); // Style disabled label
        // Remove previous listener before adding new one
        checkbox.removeEventListener('change', handleStatusChange);
        checkbox.addEventListener('change', handleStatusChange); // Add listener for single selection
    });

    // If new order, check default status
    if (!isEditing && defaultCheckbox) {
        defaultCheckbox.checked = true;
        // Keep it enabled to allow selection, but style implies it's default
        // defaultCheckbox.disabled = false;
        // defaultCheckbox.closest('label').classList.remove('disabled');
    }
}
// Helper for status checkbox change listener
function handleStatusChange(event) {
    const changedCheckbox = event.target;
     if (changedCheckbox.checked) {
        // Uncheck all others
        orderStatusCheckboxes.forEach(otherCb => {
            if (otherCb !== changedCheckbox) {
                otherCb.checked = false;
            }
        });
    }
    // Optional: Prevent unchecking all? Could re-check default if none selected.
}


// --- Autocomplete Functions (with improved error reporting) ---

// Customer Input Handler
let customerSearchTimeout;
function handleCustomerInput(event, type) {
    const searchTerm = event.target.value.trim();
    const suggestionBox = type === 'name' ? customerSuggestionsNameBox : customerSuggestionsWhatsAppBox;
    if (!suggestionBox) return;

    suggestionBox.innerHTML = ''; // Clear old suggestions
    resetCustomerSelection(); // Reset selection if user types again

    if (searchTerm.length < 3) { // Minimum characters to search
        clearTimeout(customerSearchTimeout);
        return;
    }

    // Debounce: wait after user stops typing
    clearTimeout(customerSearchTimeout);
    customerSearchTimeout = setTimeout(() => {
        console.log(`Searching customers (${type}): ${searchTerm}`);
        fetchCustomerSuggestions(searchTerm, type, suggestionBox);
    }, 400); // 400ms delay
}

// Fetch Customer Suggestions from Firestore
async function fetchCustomerSuggestions(term, type, box) {
    box.innerHTML = '<ul><li>Searching...</li></ul>'; // English loading message
    try {
        // Check if Firestore functions are available
        if(!db || !collection || !query || !where || !getDocs || typeof limit !== 'function') {
             throw new Error("Firestore query functions not available.");
        }

        const customersRef = collection(db, "customers"); // COLLECTION: 'customers'
        const fieldToQuery = type === 'name' ? 'fullName' : 'whatsappNo'; // FIELD: 'fullName' or 'whatsappNo'
        const queryLower = term; // Case-sensitive search start
        const queryUpper = term + '\uf8ff'; // Case-sensitive search end

        // ** IMPORTANT: Requires Firestore Index on the queried field **
        const q = query(
            customersRef,
            where(fieldToQuery, ">=", queryLower),
            where(fieldToQuery, "<=", queryUpper),
            limit(5) // Limit suggestions
        );

        console.log(`Executing Firestore customer query (${type}) for:`, term);
        const querySnapshot = await getDocs(q);
        console.log(`Customer query snapshot size (${type}):`, querySnapshot.size);

        const suggestions = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
             // Ensure essential data exists
            if (data.fullName && data.whatsappNo) {
                 suggestions.push({ id: doc.id, ...data });
            } else {
                 console.warn(`Customer document missing required fields (fullName/whatsappNo):`, doc.id);
            }
        });

        renderCustomerSuggestions(suggestions, term, box);

    } catch (error) {
        console.error(`Error fetching customer suggestions (${type}):`, error);
        // Show detailed error in suggestion box
        box.innerHTML = `<ul><li style="color:red;">Error: ${error.message}. Check Console (F12).</li></ul>`;
    }
}

// Render Customer Suggestions in UI
function renderCustomerSuggestions(suggestions, term, box) {
    if (suggestions.length === 0) {
        box.innerHTML = '<ul><li>No results found</li></ul>'; // English message
        return;
    }

    const ul = document.createElement('ul');
    suggestions.forEach(cust => {
        const li = document.createElement('li');
        const displayName = `${cust.fullName} (${cust.whatsappNo})`;
        // Highlight matching part (simple example)
        try {
            li.innerHTML = displayName.replace(new RegExp(`(${term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'), '<strong>$1</strong>'); // Bold matching text
        } catch {
            li.textContent = displayName; // Fallback if regex fails
        }
        li.dataset.customer = JSON.stringify(cust); // Store full data
        li.addEventListener('click', () => {
            fillCustomerData(cust); // Fill form on click
            box.innerHTML = ''; // Hide suggestions
        });
        ul.appendChild(li);
    });
    box.innerHTML = ''; // Clear previous
    box.appendChild(ul);
}

// Fill form with selected customer data
function fillCustomerData(customer) {
    console.log("Filling form with selected customer data:", customer);
    if (!customer) {
        resetCustomerSelection();
        return;
    }
    customerNameInput.value = customer.fullName || '';
    customerWhatsAppInput.value = customer.whatsappNo || '';
    customerAddressInput.value = customer.billingAddress || customer.address || '';
    customerContactInput.value = customer.contactNo || ''; // Contact No is kept

    selectedCustomerId = customer.id; // ** IMPORTANT: Store the Firestore ID **
    if(selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId;

    // Clear suggestion boxes
    if (customerSuggestionsNameBox) customerSuggestionsNameBox.innerHTML = '';
    if (customerSuggestionsWhatsAppBox) customerSuggestionsWhatsAppBox.innerHTML = '';

    // Make address/contact readonly to prevent accidental edits
    customerAddressInput.readOnly = true;
    customerContactInput.readOnly = true;
}

// Reset customer selection state
function resetCustomerSelection() {
     selectedCustomerId = null; // Clear stored ID
     if(selectedCustomerIdInput) selectedCustomerIdInput.value = '';
     // Make address/contact editable again
     customerAddressInput.readOnly = false;
     customerContactInput.readOnly = false;
     // Optionally clear the fields too
     // customerAddressInput.value = '';
     // customerContactInput.value = '';
     console.log("Customer selection reset.");
}


// Product Input Handler
let productSearchTimeout;
function handleProductInput(event) {
    const searchTerm = event.target.value.trim();
    if (!productSuggestionsBox) return;

    productSuggestionsBox.innerHTML = ''; // Clear old suggestions
    productNameInput.readOnly = false; // Ensure editable while typing

    if (searchTerm.length < 2) { // Min length for product search
        clearTimeout(productSearchTimeout);
        return;
    }

    // Debounce
    clearTimeout(productSearchTimeout);
    productSearchTimeout = setTimeout(() => {
        console.log("Searching products:", searchTerm);
        fetchProductSuggestions(searchTerm, productSuggestionsBox);
    }, 400);
}

// Fetch Product Suggestions from Firestore (with improved error handling)
async function fetchProductSuggestions(term, box) {
    box.innerHTML = '<ul><li>Searching...</li></ul>'; // English loading
    try {
        // Check functions
         if(!db || !collection || !query || !where || !getDocs || typeof limit !== 'function') {
             throw new Error("Firestore query functions not available.");
        }
        const productsRef = collection(db, "products"); // COLLECTION: 'products'
        const queryLower = term; // Case-sensitive start
        const queryUpper = term + '\uf8ff';

        // ** IMPORTANT: Requires Firestore Index on 'name' field **
        const q = query(
            productsRef,
            where("name", ">=", queryLower),
            where("name", "<=", queryUpper),
            limit(7) // Limit suggestions
        );
        console.log("Executing Firestore product query for:", term);
        const querySnapshot = await getDocs(q);
        console.log("Product query snapshot size:", querySnapshot.size);

        const suggestions = [];
        querySnapshot.forEach((doc) => {
             const data = doc.data();
             if(data.name) { // Check if 'name' field exists
                suggestions.push({ id: doc.id, name: data.name });
             } else {
                 console.warn("Product document missing 'name' field:", doc.id);
             }
        });
        renderProductSuggestions(suggestions, term, box);
    } catch (error) {
        console.error("Error fetching product suggestions:", error);
        // Show detailed error
        box.innerHTML = `<ul><li style="color:red;">Error: ${error.message}. Check Console (F12).</li></ul>`;
    }
}

// Render Product Suggestions
function renderProductSuggestions(suggestions, term, box) {
    if (suggestions.length === 0) {
        box.innerHTML = '<ul><li>No products found</li></ul>'; // English message
        return;
    }
    const ul = document.createElement('ul');
    suggestions.forEach(prod => {
        const li = document.createElement('li');
         try {
            li.innerHTML = prod.name.replace(new RegExp(`(${term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'), '<strong>$1</strong>'); // Bold matching text
        } catch {
            li.textContent = prod.name; // Fallback
        }
        li.dataset.name = prod.name; // Store name
        li.addEventListener('click', () => {
            productNameInput.value = prod.name; // Fill input on click
            box.innerHTML = ''; // Hide suggestions
            // Optional: Make readonly after selection?
            // productNameInput.readOnly = true;
            quantityInput.focus(); // Focus quantity field
        });
        ul.appendChild(li);
    });
    box.innerHTML = ''; // Clear previous
    box.appendChild(ul);
}

// --- Form Submit Handler ---
async function handleFormSubmit(event) {
    event.preventDefault();
    console.log("Form submission initiated...");
    if (!db || !collection || !addDoc || !doc || !updateDoc || !getDoc ) {
        alert("Database functions are not available. Cannot save.");
        console.error("Form submit failed: DB functions missing.");
        return;
    }
    if (!saveButton) return;

    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; // English Text

    try {
        // 1. Get Form Data
        const formData = new FormData(orderForm);
        const customerData = {
            fullName: formData.get('full_name')?.trim() || '',
            address: formData.get('address')?.trim() || '',
            whatsappNo: formData.get('whatsapp_no')?.trim() || '',
            contactNo: formData.get('contact_no')?.trim() || '' // Keep Contact No
        };
        const orderDetails = {
            manualOrderId: formData.get('manual_order_id')?.trim() || '',
            orderDate: formData.get('order_date') || '',
            deliveryDate: formData.get('delivery_date') || '',
            urgent: formData.get('urgent') || 'No',
            remarks: formData.get('remarks')?.trim() || ''
        };
        const statusCheckbox = orderForm.querySelector('input[name="order_status"]:checked');
        const selectedStatus = statusCheckbox ? statusCheckbox.value : (isEditMode ? null : 'Order Received');

        // 2. **Strict Validation**
        if (!selectedCustomerId) { // Check if a customer was selected via autocomplete
             throw new Error("Please select an existing customer from the suggestions.");
        }
        if (!customerData.fullName) throw new Error("Full Name is required.");
        if (!customerData.whatsappNo) throw new Error("WhatsApp No is required.");
        if (addedProducts.length === 0) throw new Error("At least one product must be added.");
        if (!orderDetails.orderDate) throw new Error("Order Date is required.");
        if (!selectedStatus) throw new Error("Please select an order status.");


        // 3. Use selected Customer ID
        const customerIdToUse = selectedCustomerId;

        // 4. Determine Order ID
        let orderIdToUse;
        const existingSystemId = displayOrderIdInput.value; // Use system ID in edit mode
        if (isEditMode) {
            orderIdToUse = existingSystemId; // Must use existing ID when editing
        } else {
            orderIdToUse = orderDetails.manualOrderId || Date.now().toString(); // Use manual or auto-generate
        }

        // 5. Prepare Order Payload
        const orderDataPayload = {
            orderId: orderIdToUse,
            customerId: customerIdToUse,
            customerDetails: customerData, // Includes contactNo
            orderDate: orderDetails.orderDate,
            deliveryDate: orderDetails.deliveryDate,
            urgent: orderDetails.urgent,
            remarks: orderDetails.remarks,
            status: selectedStatus,
            products: addedProducts, // Use the array of added products
            updatedAt: new Date() // Timestamp for last update
        };

        // 6. Save/Update in Firestore
        let orderDocRefPath;
        if (isEditMode) {
            // Update existing order using Firestore document ID
            console.log("Updating order with Firestore ID:", orderIdToEdit);
            if (!orderIdToEdit) throw new Error("Cannot update order: Missing Firestore document ID.");
            const orderRef = doc(db, "orders", orderIdToEdit);
            await updateDoc(orderRef, orderDataPayload);
            orderDocRefPath = orderRef.path;
            console.log("Order updated successfully:", orderIdToEdit);
            alert('Order updated successfully!'); // English

        } else {
            // Add new order
            console.log("Adding new order with generated/manual ID:", orderIdToUse);
            orderDataPayload.createdAt = new Date(); // Add creation timestamp
            const newOrderRef = await addDoc(collection(db, "orders"), orderDataPayload);
            orderDocRefPath = newOrderRef.path;
            console.log("New order saved successfully, Firestore ID:", newOrderRef.id);
            alert('New order saved successfully!'); // English
            // Update display ID field
            displayOrderIdInput.value = orderIdToUse;
        }

        // 7. Save to Daily Report (Placeholder)
        await saveToDailyReport(orderDataPayload, orderDocRefPath);

        // 8. Show WhatsApp Reminder Popup
        showWhatsAppReminder(customerData, orderIdToUse, orderDetails.deliveryDate);

        // 9. Reset form if it was a new order
        if (!isEditMode) {
            resetNewOrderForm(); // Call helper function to reset
        }

    } catch (error) {
        console.error("Error saving/updating order:", error);
        alert("Error: " + error.message); // Show specific error to user
    } finally {
        // Re-enable save button
        saveButton.disabled = false;
        const buttonText = isEditMode ? "Update Order" : "Save Order"; // English Text
        saveButton.innerHTML = `<i class="fas fa-save"></i> <span>${buttonText}</span>`;
    }
}

// Helper function to reset the form after adding a new order
function resetNewOrderForm() {
    console.log("Resetting form for new order entry.");
    resetCustomerSelection(); // Reset customer selection state and fields
    customerNameInput.value = '';
    customerWhatsAppInput.value = '';
    // customerAddressInput.value = ''; // Already cleared by resetCustomerSelection if editable
    // customerContactInput.value = '';
    manualOrderIdInput.value = '';
    // displayOrderIdInput.value = ''; // Keep the generated ID visible? Optional.
    orderForm.delivery_date.value = '';
    orderForm.remarks.value = '';
    addedProducts = []; // Clear product array
    renderProductList(); // Clear product list UI
    handleStatusCheckboxes(false); // Reset status checkboxes
    const urgentNoRadio = orderForm.querySelector('input[name="urgent"][value="No"]');
    if (urgentNoRadio) urgentNoRadio.checked = true; // Default urgent to No
     const orderDateInput = document.getElementById('order_date');
     if (orderDateInput) orderDateInput.value = new Date().toISOString().split('T')[0]; // Reset order date? Optional.
}

// --- Post-Save Functions ---

// (Placeholder) Save to Daily Report
async function saveToDailyReport(orderData, orderPath) {
    console.log(`Placeholder: Saving order to daily_reports (Original path: ${orderPath})`, orderData);
    try {
         if(!db || !collection || !addDoc) throw new Error("Firestore functions missing");
         // await addDoc(collection(db, "daily_reports"), { ...orderData, originalOrderPath: orderPath });
         console.log("Placeholder: Successfully called saveToDailyReport.");
    } catch (error) {
        console.error("Placeholder: Error saving to daily_reports:", error);
    }
}

// Show WhatsApp Reminder Popup
function showWhatsAppReminder(customer, orderId, deliveryDate) {
    if (!whatsappReminderPopup || !whatsappMsgPreview || !whatsappSendLink) {
        console.error("WhatsApp popup elements not found.");
        return;
    }
    const customerName = customer.fullName || 'Customer';
    const customerNumber = customer.whatsappNo?.replace(/[^0-9]/g, '');
    if (!customerNumber) {
        console.warn("Cannot show WhatsApp reminder, customer number is missing.");
        alert("Customer WhatsApp number is missing. Cannot generate reminder link."); // Inform user
        return;
    }

    // Construct message (English)
    let message = `Hello ${customerName},\n`;
    message += `Your order (ID: ${orderId}) has been received successfully.\n`;
    if (deliveryDate) {
        message += `Estimated delivery date is ${deliveryDate}.\n`;
    }
    message += `Thank you!`; // Add your shop name if desired

    // Show preview and set link
    whatsappMsgPreview.innerText = message;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customerNumber}?text=${encodedMessage}`;
    whatsappSendLink.href = whatsappUrl;

    // Show popup
    whatsappReminderPopup.classList.add('active');
    console.log("WhatsApp reminder popup shown.");
}

// Close WhatsApp Popup
function closeWhatsAppPopup() {
      if (whatsappReminderPopup) {
        whatsappReminderPopup.classList.remove('active');
     }
}