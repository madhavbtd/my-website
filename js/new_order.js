// js/new_order.js

const { db, collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where } = window;

const orderForm = document.getElementById('newOrderForm');
const saveButton = document.getElementById('saveOrderBtn');
const formHeader = document.getElementById('formHeader');
const hiddenEditOrderIdInput = document.getElementById('editOrderId'); // Firestore Doc ID for edit
const displayOrderIdInput = document.getElementById('display_order_id'); // To show custom ID
const productDetailsContainer = document.getElementById('product-details-container');

// --- Helper Functions ---
window.addProductRow = function() { /* ... जैसा पहले था ... */ };
window.removeProductRow = function(button) { /* ... जैसा पहले था ... */ };
const orderStatusCheckboxes = document.querySelectorAll('input[name="order_status"]');
orderStatusCheckboxes.forEach((checkbox) => { /* ... जैसा पहले था ... */ });

// --- Load Order Data for Edit ---
async function loadOrderForEdit(orderDocId) {
    if (!db || !doc || !getDoc || !orderForm) { return; }
    console.log(`Loading order data for edit. ID: ${orderDocId}`);
    try {
        const orderRef = doc(db, "orders", orderDocId);
        const docSnap = await getDoc(orderRef);
        if (docSnap.exists()) {
            const d = docSnap.data();
            // Populate form fields (customer details, order details, status, urgent, remarks)
            orderForm.full_name.value = d.customerDetails?.fullName || '';
            orderForm.address.value = d.customerDetails?.address || '';
            orderForm.whatsapp_no.value = d.customerDetails?.whatsappNo || '';
            orderForm.contact_no.value = d.customerDetails?.contactNo || '';
            displayOrderIdInput.value = d.orderId || orderDocId; // Show custom or Firestore ID
            orderForm.order_date.value = d.orderDate || '';
            orderForm.delivery_date.value = d.deliveryDate || '';
            orderForm.remarks.value = d.remarks || '';
            const urgentVal = d.urgent || 'No'; orderForm.querySelector(`input[name="urgent"][value="${urgentVal}"]`)?.setAttribute('checked', 'checked');
            orderStatusCheckboxes.forEach(cb => cb.checked = false); if (d.status) { const scb = orderForm.querySelector(`input[name="order_status"][value="${d.status}"]`); if (scb) scb.checked = true; } else { orderForm.querySelector('input[name="order_status"][value="Order Received"]')?.setAttribute('checked', 'checked'); }
            // Populate products
            productDetailsContainer.innerHTML = '';
            if (d.products && d.products.length > 0) { d.products.forEach((p, i) => { addProductRowWithData(p.name, p.quantity, i); }); }
            else { addProductRow(); } // Add one empty row if no products
            if(productDetailsContainer.children.length === 0) addProductRow(); // Ensure at least one row
        } else { console.error("Order doc not found!"); alert("Cannot find order to edit."); window.location.href = 'order_history.html'; }
    } catch (error) { console.error("Error loading order:", error); alert("Error loading order data: " + error.message); window.location.href = 'order_history.html'; }
}
// Helper to add product row with data during edit load
function addProductRowWithData(name = '', quantity = '', index) {
     const newRow = document.createElement('div'); newRow.classList.add('product-detail-group');
     const newProductId = `product_name_${index}`; const newQuantityId = `quantity_${index}`;
     newRow.innerHTML = `...`; // innerHTML structure as in addProductRow, but with value="${name}" and value="${quantity}"
     productDetailsContainer.appendChild(newRow);
}


// --- Form Submit Handler ---
async function handleFormSubmit(event) {
    event.preventDefault();
    if (saveButton) { saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }

    const formData = new FormData(orderForm);
    const orderDocIdToEdit = formData.get('editOrderId'); // Firestore Doc ID
    const fullName = formData.get('full_name')?.trim() || '';
    const whatsappNo = formData.get('whatsapp_no')?.trim() || '';

    if (!fullName || !whatsappNo) { /* ... Validation ... */ alert('Enter Name & WhatsApp No.'); /* Reset button */ return; }
    if (!db) { /* ... DB Check ... */ alert("DB connection error."); /* Reset button */ return; }

    // Gather products
    const products = []; /* ... Gather products logic as before ... */
    if (products.length === 0) { /* ... Validation ... */ alert('Add at least one product.'); /* Reset button */ return; }

    let customerIdToUse;
    try {
        // 4. Find/Create Customer
        const customersRef = collection(db, "customers");
        const q = query(customersRef, where("whatsappNo", "==", whatsappNo));
        const querySnapshot = await getDocs(q);
        const customerDataForSave = { /* ... customer data from form ... */
             fullName: fullName, billingAddress: formData.get('address')?.trim() || '', /* etc */ };
        if (querySnapshot.empty) {
             customerDataForSave.createdAt = new Date(); customerDataForSave.displayCustomerId = Date.now().toString();
             const customerDocRef = await addDoc(customersRef, customerDataForSave); customerIdToUse = customerDocRef.id;
        } else {
            customerIdToUse = querySnapshot.docs[0].id;
            // Optionally update existing customer
            const customerRef = doc(db, "customers", customerIdToUse);
             customerDataForSave.updatedAt = new Date();
             await updateDoc(customerRef, customerDataForSave);
        }

        // 5. Order Data Payload
        const orderDataPayload = {
            customerDetails: { fullName: fullName, address: customerDataForSave.billingAddress, whatsappNo: whatsappNo, contactNo: customerDataForSave.contactNo },
            customerId: customerIdToUse, orderDate: formData.get('order_date') || '', deliveryDate: formData.get('delivery_date') || '',
            urgent: formData.get('urgent') || 'No', remarks: formData.get('remarks')?.trim() || '',
            products: products, status: formData.get('order_status') || 'Order Received',
        };

        if (orderDocIdToEdit) { // Update mode
            console.log("Updating order:", orderDocIdToEdit);
            orderDataPayload.updatedAt = new Date();
            const orderRef = doc(db, "orders", orderDocIdToEdit);
            // Keep existing orderId if present, do not regenerate
            const existingOrderSnap = await getDoc(orderRef);
            if (existingOrderSnap.exists() && existingOrderSnap.data().orderId) {
                 orderDataPayload.orderId = existingOrderSnap.data().orderId;
            }
            await updateDoc(orderRef, orderDataPayload);
            alert('Order updated successfully!');
            window.location.href = 'order_history.html';
        } else { // Add mode
            console.log("Adding new order.");
            orderDataPayload.orderId = Date.now().toString(); // <<< Generate custom ID only for NEW orders
            orderDataPayload.createdAt = new Date();
            await addDoc(collection(db, "orders"), orderDataPayload);
            alert('Order saved successfully!');
            orderForm.reset();
            // Reset date and product rows
             const orderDateInput = document.getElementById('order_date'); if(orderDateInput) orderDateInput.value = new Date().toISOString().split('T')[0];
             productDetailsContainer.innerHTML = ''; addProductRow();
             const defaultStatusCheckbox = orderForm.querySelector('input[name="order_status"][value="Order Received"]'); if(defaultStatusCheckbox) defaultStatusCheckbox.checked = true;
        }
    } catch (error) { /* ... Error handling ... */
        console.error("Error saving:", error); alert('Error: ' + error.message);
    } finally { /* ... Reset button ... */
        if (saveButton) { saveButton.disabled = false; saveButton.innerHTML = orderDocIdToEdit ? '<i class="fas fa-sync-alt"></i> Update' : '<i class="fas fa-save"></i> Save Order'; }
    }
}

// --- DOMContentLoaded Listener ---
document.addEventListener('DOMContentLoaded', () => {
    const checkDbInterval = setInterval(() => {
        if (window.db) {
            clearInterval(checkDbInterval);
            console.log("DB ready for new_order.js");
            const urlParams = new URLSearchParams(window.location.search);
            const orderIdToEdit = urlParams.get('editOrderId'); // <<< Use correct parameter name
            if (orderIdToEdit) {
                console.log("Edit mode detected. Order Firestore ID:", orderIdToEdit);
                hiddenEditOrderIdInput.value = orderIdToEdit; // Store Firestore ID
                loadOrderForEdit(orderIdToEdit);
                if(formHeader) formHeader.textContent = "Edit Order";
                if(saveButton) saveButton.innerHTML = '<i class="fas fa-sync-alt"></i> Update';
            } else {
                console.log("Add mode detected.");
                if(formHeader) formHeader.textContent = "New Order";
                if(saveButton) saveButton.innerHTML = '<i class="fas fa-save"></i> Save Order';
                 if (productDetailsContainer && productDetailsContainer.children.length === 0) { addProductRow(); }
                 const orderDateInput = document.getElementById('order_date'); if(orderDateInput && !orderDateInput.value) orderDateInput.value = new Date().toISOString().split('T')[0];
                 const defaultStatusCheckbox = orderForm?.querySelector('input[name="order_status"][value="Order Received"]'); if(defaultStatusCheckbox) defaultStatusCheckbox.checked = true;
            }
            if (orderForm) { orderForm.addEventListener('submit', handleFormSubmit); }
            else { console.error("Order Form not found!"); }
        } else { console.log("Waiting for DB..."); }
    }, 100);
});
console.log("new_order.js loaded.");

// Helper to add product row with data during edit load (implementation)
function addProductRowWithData(name = '', quantity = '', index) {
     const newRow = document.createElement('div'); newRow.classList.add('product-detail-group');
     const newProductId = `product_name_${index}`; const newQuantityId = `quantity_${index}`;
     newRow.innerHTML = `
        <label for="${newProductId}">Product Name:</label>
        <input type="text" id="${newProductId}" name="product_name[]" placeholder="Enter Product Name" autocomplete="off" value="${name || ''}">
        <label for="${newQuantityId}">Qty</label>
        <input type="number" id="${newQuantityId}" name="quantity[]" placeholder="Enter Quantity" value="${quantity || ''}">
        <button type="button" class="remove-product-button" onclick="removeProductRow(this)">Remove</button>
     `;
     productDetailsContainer.appendChild(newRow);
}