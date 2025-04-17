// js/new_customer.js

// Firestore फंक्शन्स window ऑब्जेक्ट से उपलब्ध हैं
const { db, collection, addDoc, doc, getDocs, query, where, getDoc, updateDoc } = window;

// --- DOM एलिमेंट रेफरेंस ---
const customerForm = document.getElementById('newCustomerForm');
const saveButton = document.getElementById('saveCustomerBtn');
const formHeader = document.getElementById('formHeader');
const hiddenEditIdInput = document.getElementById('editCustomerId');

// --- पेज लोड होने पर एडिट मोड चेक करें ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const customerIdToEdit = urlParams.get('editId');

    const checkDbInterval = setInterval(() => {
        if (window.db) {
            clearInterval(checkDbInterval);
            console.log("DB ready for new_customer.js");
            if (customerIdToEdit) {
                console.log("Edit mode detected. Customer ID:", customerIdToEdit);
                hiddenEditIdInput.value = customerIdToEdit;
                loadCustomerDataForEdit(customerIdToEdit);
                if(formHeader) formHeader.textContent = "Edit Customer Information";
                if(saveButton) saveButton.innerHTML = '<i class="fas fa-sync-alt"></i> Update';
            } else {
                console.log("Add mode detected.");
                if(formHeader) formHeader.textContent = "New Customer Information";
                if(saveButton) saveButton.innerHTML = '<i class="fas fa-save"></i> Save';
            }
        } else { console.log("Waiting for DB initialization..."); }
    }, 100);

    if (customerForm) {
        customerForm.addEventListener('submit', handleFormSubmit);
    } else { console.error("Customer form not found!"); }
});

// --- एडिट के लिए डेटा लोड करने का फंक्शन ---
async function loadCustomerDataForEdit(customerId) {
     if (!db || !doc || !getDoc) { alert("Database functions not available."); return; }
     console.log(`Attempting to load data for customer ID: ${customerId}`);
     try {
        const customerRef = doc(db, "customers", customerId);
        const docSnap = await getDoc(customerRef);
        if (docSnap.exists()) {
            const customerData = docSnap.data();
            console.log("Customer data loaded for edit:", customerData);
            // फॉर्म फ़ील्ड्स भरें (सभी फ़ील्ड्स)
            customerForm.full_name.value = customerData.fullName || '';
            customerForm.billing_address.value = customerData.billingAddress || '';
            customerForm.city.value = customerData.city || '';
            customerForm.state.value = customerData.state || '';
            customerForm.pin_code.value = customerData.pinCode || '';
            customerForm.email_id.value = customerData.emailId || '';
            customerForm.whatsapp_no.value = customerData.whatsappNo || '';
            customerForm.contact_no.value = customerData.contactNo || '';
            customerForm.pan_no.value = customerData.panNo || '';
            customerForm.gstin.value = customerData.gstin || '';
            customerForm.composite_trade_name.value = customerData.compositeTradeName || '';
            if (customerData.gstType) {
                const gstRadio = customerForm.querySelector(`input[name="gst_type"][value="${customerData.gstType}"]`);
                if (gstRadio) gstRadio.checked = true;
                else customerForm.querySelectorAll('input[name="gst_type"]').forEach(r => r.checked = false);
            } else { customerForm.querySelectorAll('input[name="gst_type"]').forEach(r => r.checked = false); }
        } else {
            console.error("No such customer document for editing!");
            alert("Could not find customer data to edit.");
            window.location.href = 'customer_management.html';
        }
    } catch (error) {
        console.error("Error loading customer data for edit: ", error);
        alert("Error loading customer data: " + error.message);
        window.location.href = 'customer_management.html';
    }
}


// --- फॉर्म सबमिट हैंडलर (ऐड और अपडेट दोनों के लिए) ---
async function handleFormSubmit(event) {
    event.preventDefault();
    if (saveButton) { saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }

    const formData = new FormData(customerForm);
    const customerId = formData.get('editCustomerId');
    const fullName = formData.get('full_name')?.trim() || '';
    const whatsappNo = formData.get('whatsapp_no')?.trim() || '';

    if (!fullName || !whatsappNo) {
        alert('Please enter Full Name and WhatsApp No.');
        if (saveButton) { saveButton.disabled = false; saveButton.innerHTML = customerId ? '<i class="fas fa-sync-alt"></i> Update' : '<i class="fas fa-save"></i> Save'; }
        return;
    }
    if (!db) {
        alert("Database connection not found.");
        if (saveButton) { saveButton.disabled = false; saveButton.innerHTML = customerId ? '<i class="fas fa-sync-alt"></i> Update' : '<i class="fas fa-save"></i> Save'; }
        return;
    }

    const customerDataPayload = {
        fullName: fullName,
        billingAddress: formData.get('billing_address')?.trim() || '',
        city: formData.get('city')?.trim() || '',
        state: formData.get('state')?.trim() || '',
        pinCode: formData.get('pin_code')?.trim() || '',
        country: formData.get('country') || 'India',
        emailId: formData.get('email_id')?.trim() || '',
        whatsappNo: whatsappNo,
        contactNo: formData.get('contact_no')?.trim() || '',
        panNo: formData.get('pan_no')?.trim() || '',
        gstin: formData.get('gstin')?.trim() || '',
        gstType: formData.get('gst_type') || '',
        compositeTradeName: formData.get('composite_trade_name')?.trim() || '',
    };

    try {
        const customersRef = collection(db, "customers");
        if (customerId) {
            // --- अपडेट मोड ---
             console.log("Updating customer with ID:", customerId);
             customerDataPayload.updatedAt = new Date(); // अपडेट का समय
             const customerRef = doc(db, "customers", customerId);
             await updateDoc(customerRef, customerDataPayload);
             alert('Customer updated successfully!');
             window.location.href = 'customer_management.html';

        } else {
            // --- ऐड मोड (डुप्लीकेट चेक और नया displayCustomerId जोड़ें) ---
            console.log("Adding new customer. Checking for duplicates...");
            const q = query(customersRef, where("whatsappNo", "==", whatsappNo));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                // === नया न्यूमेरिकल ID यहाँ जेनरेट करें ===
                customerDataPayload.displayCustomerId = Date.now().toString(); // टाइमस्टैम्प को स्ट्रिंग के रूप में सेव करें
                // ========================================
                customerDataPayload.createdAt = new Date();
                const customerDocRef = await addDoc(customersRef, customerDataPayload);
                console.log("New customer added with ID: ", customerDocRef.id, "and Display ID:", customerDataPayload.displayCustomerId);
                alert('Customer saved successfully!');
                window.location.href = 'customer_management.html';

            } else {
                // डुप्लीकेट मिला
                const existingCustomerId = querySnapshot.docs[0].id;
                console.log("Duplicate found with ID: ", existingCustomerId);
                alert(`Customer with WhatsApp number ${whatsappNo} already exists.`);
                // बटन री-इनेबल करें
                if (saveButton) { saveButton.disabled = false; saveButton.innerHTML = '<i class="fas fa-save"></i> Save'; }
                return; // सेविंग रोकें
            }
        }
    } catch (error) {
        console.error("Error saving customer: ", error);
        alert('Error saving customer: ' + error.message);
        if (saveButton) { saveButton.disabled = false; saveButton.innerHTML = customerId ? '<i class="fas fa-sync-alt"></i> Update' : '<i class="fas fa-save"></i> Save'; }
    }
}
console.log("new_customer.js loaded.");