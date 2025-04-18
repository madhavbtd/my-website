// js/new_order.js

// Firestore फंक्शन्स window ऑब्जेक्ट से उपलब्ध होने चाहिए
const { db, collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where } = window;

// --- DOM एलिमेंट रेफरेंस ---
const orderForm = document.getElementById('newOrderForm');
const saveButton = document.getElementById('saveOrderBtn');
const formHeader = document.getElementById('formHeader');
const hiddenEditOrderIdInput = document.getElementById('editOrderId'); // Hidden input for Firestore Doc ID
const displayOrderIdInput = document.getElementById('display_order_id'); // Input to show custom order ID

// --- हेल्पर फंक्शन्स ---

// प्रोडक्ट रो जोड़ने का फंक्शन
window.addProductRow = function() {
    let productRowCount = document.querySelectorAll('.product-detail-group').length + 1;
    const container = document.getElementById('product-details-container');
    if (!container) return;
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
    container.appendChild(newRow);
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
     if (!db || !doc || !getDoc) { alert("Database functions not available."); return; }
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

            orderForm.display_order_id.value = orderData.orderId || orderDocId; // कस्टम ID या Firestore ID दिखाएं
            orderForm.order_date.value = orderData.orderDate || '';
            orderForm.delivery_date.value = orderData.deliveryDate || '';
            orderForm.remarks.value = orderData.remarks || '';

            // Urgent रेडियो बटन
            const urgentRadio = orderForm.querySelector(`input[name="urgent"][value="${orderData.urgent || 'No'}"]`);
            if (urgentRadio) urgentRadio.checked = true;

            // Status चेकबॉक्स
            orderStatusCheckboxes.forEach(cb => cb.checked = false); // पहले सब अनचेक करें
            if (orderData.status) {
                 const statusCheckbox = orderForm.querySelector(`input[name="order_status"][value="${orderData.status}"]`);
                 if (statusCheckbox) statusCheckbox.checked = true;
            }

            // प्रोडक्ट डिटेल्स भरें
            const productContainer = document.getElementById('product-details-container');
            productContainer.innerHTML = ''; // पुरानी रो हटाएं
            if (orderData.products && orderData.products.length > 0) {
                orderData.products.forEach((product, index) => {
                     productRowCount = index + 1; // rowCount अपडेट करें
                     const newRow = document.createElement('div');
                     newRow.classList.add('product-detail-group');
                     const newProductId = `product_name_${Date.now()}_${productRowCount}`;
                     const newQuantityId = `quantity_${Date.now()}_${productRowCount}`;
                     newRow.innerHTML = `
                        <label for="${newProductId}">Product Name:</label>
                        <input type="text" id="${newProductId}" name="product_name[]" placeholder="Enter Product Name" autocomplete="off" value="${product.name || ''}">
                        <label for="${newQuantityId}">Qty</label>
                        <input type="number" id="${newQuantityId}" name="quantity[]" placeholder="Enter Quantity" value="${product.quantity || ''}">
                        <button type="button" class="remove-product-button" onclick="removeProductRow(this)">Remove</button>
                     `;
                     container.appendChild(newRow);
                });
            } else {
                // अगर कोई प्रोडक्ट नहीं है, तो एक खाली रो जोड़ें
                 addProductRow(); // यह पहली खाली रो जोड़ देगा
            }
             // Ensure at least one empty row if container is empty after loading
             if (productContainer.children.length === 0) {
                  addProductRow();
             }


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

    // 1. फॉर्म डेटा और एडिट ID प्राप्त करें
    const formData = new FormData(orderForm);
    const orderDocIdToEdit = formData.get('editOrderId'); // Firestore Doc ID for editing
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
        if (name.trim() !== '') {
            products.push({ name: name.trim(), quantity: quantities[index] || '0' });
        }
    });
     if (products.length === 0 && !orderDocIdToEdit) { // Add मोड में कम से कम एक प्रोडक्ट ज़रूरी है
         alert('Please add at least one product.');
         if (saveButton) { saveButton.disabled = false; saveButton.innerHTML = '<i class="fas fa-save"></i> Save Order'; }
         return;
     }


    // 3. DB जांचें
    if (!db) {
        alert("Database connection not found.");
        if (saveButton) { saveButton.disabled = false; saveButton.innerHTML = orderDocIdToEdit ? '<i class="fas fa-sync-alt"></i> Update' : '<i class="fas fa-save"></i> Save Order'; }
        return;
    }

    let customerIdToUse; // कस्टमर का Firestore Doc ID

    try {
        // 4. कस्टमर को ढूंढें या बनाएं (Add/Edit दोनों मोड में)
        const customersRef = collection(db, "customers");
        const q = query(customersRef, where("whatsappNo", "==", whatsappNo));
        const querySnapshot = await getDocs(q);

        const customerData = { /* ... पूरा कस्टमर डेटा फॉर्म से ... */
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
            customerData.createdAt = new Date();
            customerData.displayCustomerId = Date.now().toString(); // डिस्प्ले ID
            const customerDocRef = await addDoc(customersRef, customerData);
            customerIdToUse = customerDocRef.id;
        } else {
            // मौजूदा कस्टमर
            customerIdToUse = querySnapshot.docs[0].id;
            console.log("Found existing customer:", customerIdToUse);
            // वैकल्पिक: यहाँ मौजूदा कस्टमर को अपडेट भी कर सकते हैं
            // const customerRef = doc(db, "customers", customerIdToUse);
            // await updateDoc(customerRef, { ...customerData, updatedAt: new Date() });
        }

        // 5. ऑर्डर डेटा पेलोड बनाएं
         const orderDataPayload = {
            customerDetails: { fullName: fullName, address: customerData.billingAddress, whatsappNo: whatsappNo, contactNo: customerData.contactNo },
            customerId: customerIdToUse,
            orderDate: formData.get('order_date') || '',
            deliveryDate: formData.get('delivery_date') || '',
            urgent: formData.get('urgent') || 'No',
            remarks: formData.get('remarks')?.trim() || '',
            products: products,
            status: formData.get('order_status') || 'Order Received', // डिफ़ॉल्ट स्टेटस
            // createdAt/updatedAt नीचे जोड़ा जाएगा
            // orderId (कस्टम वाला) नीचे जोड़ा जाएगा (ऐड मोड में)
        };


        if (orderDocIdToEdit) {
            // --- अपडेट मोड ---
            console.log("Updating order with Firestore ID:", orderDocIdToEdit);
            orderDataPayload.updatedAt = new Date();
            // कस्टम orderId को अपडेट न करें, केवल अन्य फ़ील्ड्स करें
            const orderRef = doc(db, "orders", orderDocIdToEdit);
            await updateDoc(orderRef, orderDataPayload);
            alert('Order updated successfully!');
            window.location.href = 'order_history.html'; // हिस्ट्री पेज पर वापस

        } else {
            // --- ऐड मोड ---
            console.log("Adding new order.");
            orderDataPayload.orderId = Date.now().toString(); // <<< कस्टम न्यूमेरिकल ID
            orderDataPayload.createdAt = new Date();
            const orderDocRef = await addDoc(collection(db, "orders"), orderDataPayload);
            console.log("New order added with Firestore ID:", orderDocRef.id);
            alert('Order saved successfully!');
            orderForm.reset(); // फॉर्म रीसेट
            // तारीख रीसेट करें
            const orderDateInput = document.getElementById('order_date');
            if(orderDateInput) orderDateInput.value = new Date().toISOString().split('T')[0];
            // प्रोडक्ट रो रीसेट करें
            const productContainer = document.getElementById('product-details-container');
             if(productContainer){
                 while(productContainer.children.length > 1){ productContainer.removeChild(productContainer.lastChild); }
             }

            // आप चाहें तो यहाँ व्हाट्सएप रिमाइंडर पॉपअप दिखा सकते हैं (भविष्य में)
        }

    } catch (error) {
        console.error("Error saving order/customer: ", error);
        alert('Error saving data: ' + error.message);
    } finally {
        if (saveButton) {
             saveButton.disabled = false;
             // मोड के अनुसार बटन टेक्स्ट सही करें
              saveButton.innerHTML = orderDocIdToEdit ? '<i class="fas fa-sync-alt"></i> Update' : '<i class="fas fa-save"></i> Save Order';
        }
    }
}

console.log("new_order.js loaded.");