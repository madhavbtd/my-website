// js/new_order.js

// Firestore फंक्शन्स window ऑब्जेक्ट से उपलब्ध होने चाहिए
const { db, collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where } = window;

// --- DOM एलिमेंट रेफरेंस ---
const orderForm = document.getElementById('newOrderForm');
const saveButton = document.getElementById('saveOrderBtn');
const formHeader = document.getElementById('formHeader');
const hiddenEditOrderIdInput = document.getElementById('editOrderId');
const displayOrderIdInput = document.getElementById('display_order_id');
const productDetailsContainer = document.getElementById('product-details-container');

// --- हेल्पर फंक्शन्स ---

// प्रोडक्ट रो जोड़ने का फंक्शन
window.addProductRow = function() {
    let productRowCount = document.querySelectorAll('.product-detail-group').length + 1;
    if (!productDetailsContainer) return;
    const newRow = document.createElement('div');
    newRow.classList.add('product-detail-group');
    const newProductId = `product_name_${Date.now()}_${productRowCount}`;
    const newQuantityId = `quantity_${Date.now()}_${productRowCount}`;
    newRow.innerHTML = `
        <label for="${newProductId}">Product Name:</label>
        <input type="text" id="${newProductId}" name="product_name[]" placeholder="Enter Product Name" autocomplete="off">
        <label for="${newQuantityId}">Qty</label>
        <input type="number" id="${newQuantityId}" name="quantity[]" placeholder="Enter Quantity">
        <button type="button" class="remove-product-button" onclick="removeProductRow(this)">Remove</button>
    `;
    productDetailsContainer.appendChild(newRow);
}

// प्रोडक्ट रो हटाने का फंक्शन
window.removeProductRow = function(button) {
    const groupToRemove = button.closest('.product-detail-group');
    if (document.querySelectorAll('.product-detail-group').length > 1 && groupToRemove) {
        groupToRemove.remove();
    } else {
        alert("You must have at least one product row.");
    }
}

// ऑर्डर स्टेटस चेकबॉक्स लॉजिक
const orderStatusCheckboxes = document.querySelectorAll('input[name="order_status"]');
orderStatusCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', function () {
        if (this.checked) {
            orderStatusCheckboxes.forEach(otherCheckbox => { if (otherCheckbox !== this) { otherCheckbox.checked = false; } });
        }
    });
});

// --- एडिट मोड के लिए डेटा लोड करना ---
async function loadOrderForEdit(orderDocId) {
     if (!db || !doc || !getDoc || !orderForm) { alert("Core components missing. Cannot load data."); return; }
     console.log(`Loading order data for edit. ID: ${orderDocId}`);
     try {
        const orderRef = doc(db, "orders", orderDocId);
        const docSnap = await getDoc(orderRef);
        if (docSnap.exists()) {
            const orderData = docSnap.data();
            console.log("Order data loaded:", orderData);

            // फॉर्म फ़ील्ड्स भरें
            orderForm.full_name.value = orderData.customerDetails?.fullName || '';
            orderForm.address.value = orderData.customerDetails?.address || '';
            orderForm.whatsapp_no.value = orderData.customerDetails?.whatsappNo || '';
            orderForm.contact_no.value = orderData.customerDetails?.contactNo || '';

            orderForm.display_order_id.value = orderData.orderId || orderDocId; // कस्टम ID दिखाएं
            orderForm.order_date.value = orderData.orderDate || '';
            orderForm.delivery_date.value = orderData.deliveryDate || '';
            orderForm.remarks.value = orderData.remarks || '';

            // Urgent रेडियो बटन
            const urgentVal = orderData.urgent || 'No';
            orderForm.querySelector(`input[name="urgent"][value="${urgentVal}"]`)?.setAttribute('checked', 'checked');


            // Status चेकबॉक्स
            orderStatusCheckboxes.forEach(cb => cb.checked = false);
            if (orderData.status) {
                 const statusCheckbox = orderForm.querySelector(`input[name="order_status"][value="${orderData.status}"]`);
                 if (statusCheckbox) statusCheckbox.checked = true;
            } else { // डिफ़ॉल्ट रूप से Order Received चेक करें अगर कोई स्टेटस नहीं है
                 orderForm.querySelector('input[name="order_status"][value="Order Received"]')?.setAttribute('checked', 'checked');
            }


            // प्रोडक्ट डिटेल्स भरें
            productDetailsContainer.innerHTML = ''; // पुरानी रो हटाएं
            if (orderData.products && orderData.products.length > 0) {
                orderData.products.forEach((product, index) => {
                     const newRow = document.createElement('div');
                     newRow.classList.add('product-detail-group');
                     const newProductId = `product_name_${index}`; // सरल ID
                     const newQuantityId = `quantity_${index}`;
                     newRow.innerHTML = `
                        <label for="${newProductId}">Product Name:</label>
                        <input type="text" id="${newProductId}" name="product_name[]" placeholder="Enter Product Name" autocomplete="off" value="${product.name || ''}">
                        <label for="${newQuantityId}">Qty</label>
                        <input type="number" id="${newQuantityId}" name="quantity[]" placeholder="Enter Quantity" value="${product.quantity || ''}">
                        <button type="button" class="remove-product-button" onclick="removeProductRow(this)">Remove</button>
                     `;
                     productDetailsContainer.appendChild(newRow);
                });
            }
             // Add बटन के साथ एक अतिरिक्त खाली रो जोड़ें
             addProductRow();

        } else {
            console.error("Order document not found for editing!");
            alert("Could not find order data to edit.");
            window.location.href = 'order_history.html';
        }
    } catch (error) {
        console.error("Error loading order data for edit: ", error);
        alert("Error loading order data: " + error.message);
        window.location.href = 'order_history.html';
    }
}


// --- फॉर्म सबमिट हैंडलर ---
async function handleFormSubmit(event) {
    event.preventDefault();
    if (saveButton) { saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }

    // 1. फॉर्म डेटा प्राप्त करें
    const formData = new FormData(orderForm);
    const orderDocIdToEdit = formData.get('editOrderId'); // Firestore Doc ID
    const fullName = formData.get('full_name')?.trim() || '';
    const whatsappNo = formData.get('whatsapp_no')?.trim() || '';

    // 2. वैलिडेशन
    if (!fullName || !whatsappNo) {
        alert('Please enter Full Name and WhatsApp No.');
        if (saveButton) { saveButton.disabled = false; saveButton.innerHTML = orderDocIdToEdit ? '<i class="fas fa-sync-alt"></i> Update' : '<i class="fas fa-save"></i> Save Order'; }
        return;
    }

    // प्रोडक्ट डिटेल्स प्राप्त करें
    const products = [];
    const productNames = formData.getAll('product_name[]');
    const quantities = formData.getAll('quantity[]');
    productNames.forEach((name, index) => {
        if (name.trim() !== '') { // केवल वही प्रोडक्ट जोड़ें जिनका नाम खाली न हो
            products.push({ name: name.trim(), quantity: quantities[index] || '0' });
        }
    });
     if (products.length === 0) { // कम से कम एक प्रोडक्ट ज़रूरी है
         alert('Please add at least one product with a name.');
         if (saveButton) { saveButton.disabled = false; saveButton.innerHTML = orderDocIdToEdit ? '<i class="fas fa-sync-alt"></i> Update' : '<i class="fas fa-save"></i> Save Order'; }
         return;
     }

    // 3. DB जांचें
    if (!db) {
        alert("Database connection not found.");
        if (saveButton) { saveButton.disabled = false; saveButton.innerHTML = orderDocIdToEdit ? '<i class="fas fa-sync-alt"></i> Update' : '<i class="fas fa-save"></i> Save Order'; }
        return;
    }

    let customerIdToUse;

    try {
        // 4. कस्टमर ढूंढें या बनाएं
        const customersRef = collection(db, "customers");
        const q = query(customersRef, where("whatsappNo", "==", whatsappNo));
        const querySnapshot = await getDocs(q);

        const customerDataForSave = { /* ... कस्टमर का पूरा डेटा फॉर्म से ... */
            fullName: fullName, billingAddress: formData.get('address')?.trim() || '',
            city: formData.get('city')?.trim() || '', state: formData.get('state')?.trim() || '',
            pinCode: formData.get('pin_code')?.trim() || '', country: 'India',
            emailId: formData.get('email_id')?.trim() || '', whatsappNo: whatsappNo,
            contactNo: formData.get('contact_no')?.trim() || '', panNo: formData.get('pan_no')?.trim() || '',
            gstin: formData.get('gstin')?.trim() || '', gstType: formData.get('gst_type') || '',
            compositeTradeName: formData.get('composite_trade_name')?.trim() || ''
        };

        if (querySnapshot.empty) {
            // नया कस्टमर
            console.log("Adding new customer from order form.");
            customerDataForSave.createdAt = new Date();
            customerDataForSave.displayCustomerId = Date.now().toString();
            const customerDocRef = await addDoc(customersRef, customerDataForSave);
            customerIdToUse = customerDocRef.id;
        } else {
            // मौजूदा कस्टमर
            customerIdToUse = querySnapshot.docs[0].id;
            console.log("Found existing customer:", customerIdToUse);
            // मौजूदा कस्टमर को अपडेट करें (अगर डिटेल्स बदली हैं)
            const customerRef = doc(db, "customers", customerIdToUse);
            customerDataForSave.updatedAt = new Date(); // अपडेट समय जोड़ें
            await updateDoc(customerRef, customerDataForSave);
            console.log("Existing customer details updated (if changed).");
        }

        // 5. ऑर्डर डेटा पेलोड बनाएं
        const orderDataPayload = {
            customerDetails: { fullName: fullName, address: customerDataForSave.billingAddress, whatsappNo: whatsappNo, contactNo: customerDataForSave.contactNo },
            customerId: customerIdToUse,
            orderDate: formData.get('order_date') || '',
            deliveryDate: formData.get('delivery_date') || '',
            urgent: formData.get('urgent') || 'No',
            remarks: formData.get('remarks')?.trim() || '',
            products: products, // अपडेटेड प्रोडक्ट लिस्ट
            status: formData.get('order_status') || 'Order Received',
        };

        if (orderDocIdToEdit) {
            // --- अपडेट मोड ---
            console.log("Updating order with Firestore ID:", orderDocIdToEdit);
            orderDataPayload.updatedAt = new Date();
            // कस्टम orderId को अपडेट करते समय न बदलें
            const orderRef = doc(db, "orders", orderDocIdToEdit);
            await updateDoc(orderRef, orderDataPayload);
            alert('Order updated successfully!');
            window.location.href = 'order_history.html';

        } else {
            // --- ऐड मोड ---
            console.log("Adding new order.");
            orderDataPayload.orderId = Date.now().toString(); // <<< कस्टम न्यूमेरिकल ID
            orderDataPayload.createdAt = new Date();
            const orderDocRef = await addDoc(collection(db, "orders"), orderDataPayload);
            console.log("New order added with Firestore ID:", orderDocRef.id);
            alert('Order saved successfully!');
            orderForm.reset();
            // तारीख और प्रोडक्ट रो रीसेट करें
            const orderDateInput = document.getElementById('order_date');
            if(orderDateInput) orderDateInput.value = new Date().toISOString().split('T')[0];
            productDetailsContainer.innerHTML = ''; // सभी रो हटाएं
            addProductRow(); // पहली खाली रो जोड़ें
             // डिफ़ॉल्ट स्टेटस को चेक करें
             const defaultStatusCheckbox = orderForm.querySelector('input[name="order_status"][value="Order Received"]');
             if(defaultStatusCheckbox) defaultStatusCheckbox.checked = true;
        }

    } catch (error) {
        console.error("Error saving order/customer: ", error);
        alert('Error saving data: ' + error.message);
    } finally {
        if (saveButton) {
             saveButton.disabled = false;
             saveButton.innerHTML = orderDocIdToEdit ? '<i class="fas fa-sync-alt"></i> Update' : '<i class="fas fa-save"></i> Save Order';
        }
    }
}

// --- DOMContentLoaded Listener ---
document.addEventListener('DOMContentLoaded', () => {
    // Firebase लोड होने का इंतज़ार करें
    const checkDbInterval = setInterval(() => {
        if (window.db) {
            clearInterval(checkDbInterval);
            console.log("DB ready for new_order.js");

            // एडिट मोड चेक करें
            const urlParams = new URLSearchParams(window.location.search);
            const orderIdToEdit = urlParams.get('editOrderId'); // Parameter name for order edit

            if (orderIdToEdit) {
                console.log("Edit mode detected. Order Firestore ID:", orderIdToEdit);
                hiddenEditOrderIdInput.value = orderIdToEdit; // हिडन फ़ील्ड में Firestore ID स्टोर करें
                loadOrderForEdit(orderIdToEdit); // डेटा लोड करें
                if(formHeader) formHeader.textContent = "Edit Order";
                if(saveButton) saveButton.innerHTML = '<i class="fas fa-sync-alt"></i> Update';
            } else {
                console.log("Add mode detected.");
                if(formHeader) formHeader.textContent = "New Order";
                if(saveButton) saveButton.innerHTML = '<i class="fas fa-save"></i> Save Order';
                 // Add mode में पहली प्रोडक्ट रो सुनिश्चित करें
                 if (productDetailsContainer && productDetailsContainer.children.length === 0) {
                     addProductRow();
                 }
                 // Add mode में डिफ़ॉल्ट तारीख और स्टेटस सेट करें
                 const orderDateInput = document.getElementById('order_date');
                 if(orderDateInput && !orderDateInput.value) orderDateInput.value = new Date().toISOString().split('T')[0];
                 const defaultStatusCheckbox = orderForm?.querySelector('input[name="order_status"][value="Order Received"]');
                 if(defaultStatusCheckbox) defaultStatusCheckbox.checked = true;

            }

            // फॉर्म सबमिशन लिसनर लगाएं
            if (orderForm) {
                orderForm.addEventListener('submit', handleFormSubmit);
            } else { console.error("Order Form (#newOrderForm) not found!"); }

        } else { console.log("Waiting for DB initialization in new_order.js..."); }
    }, 100);
});

console.log("new_order.js loaded.");