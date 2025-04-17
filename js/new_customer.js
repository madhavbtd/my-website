// js/new_customer.js

// Firestore फंक्शन्स window ऑब्जेक्ट से उपलब्ध हैं
const { db, collection, addDoc, getDocs, query, where } = window;

// --- DOM एलिमेंट रेफरेंस ---
const customerForm = document.getElementById('newCustomerForm');
const saveButton = customerForm?.querySelector('.save-button'); // फॉर्म के अंदर वाला बटन

// --- मुख्य सेव फंक्शन ---
async function saveCustomerData(event) {
    event.preventDefault(); // फॉर्म का डिफ़ॉल्ट सबमिशन रोकें

    if (!customerForm) {
        alert("Form not found!");
        return;
    }
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';
        // आइकॉन बदलने के लिए (वैकल्पिक)
        // saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    // 1. फॉर्म से डेटा प्राप्त करें
    const formData = new FormData(customerForm);
    const fullName = formData.get('full_name')?.trim() || '';
    const billingAddress = formData.get('billing_address')?.trim() || '';
    const city = formData.get('city')?.trim() || '';
    const state = formData.get('state')?.trim() || '';
    const pinCode = formData.get('pin_code')?.trim() || '';
    const country = formData.get('country') || 'India';
    const emailId = formData.get('email_id')?.trim() || '';
    const whatsappNo = formData.get('whatsapp_no')?.trim() || ''; // यूनिक मानेंगे
    const contactNo = formData.get('contact_no')?.trim() || '';
    const panNo = formData.get('pan_no')?.trim() || '';
    const gstin = formData.get('gstin')?.trim() || '';
    const gstType = formData.get('gst_type') || '';
    const compositeTradeName = formData.get('composite_trade_name')?.trim() || '';

    // 2. बेसिक वैलिडेशन
    if (!fullName || !whatsappNo) {
        alert('Please enter Full Name and WhatsApp No.');
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = 'Save';
            // saveButton.innerHTML = '<i class="fas fa-save"></i> Save';
        }
        return;
    }

    // 3. Firebase इंस्टेंस जांचें
    if (!db) {
        alert("Database connection not found. Cannot save data.");
         if (saveButton) { saveButton.disabled = false; saveButton.textContent = 'Save'; }
        return;
    }

    try {
        // 4. कस्टमर डुप्लीकेट चेक (WhatsApp नंबर के आधार पर)
        const customersRef = collection(db, "customers");
        const q = query(customersRef, where("whatsappNo", "==", whatsappNo));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            // कस्टमर मौजूद नहीं है - नया ऐड करें
            console.log("Customer not found via WhatsApp, adding new one.");
            const customerData = {
                // customerId अब Firestore द्वारा ऑटो-जेनरेट होगा
                fullName: fullName,
                billingAddress: billingAddress,
                city: city,
                state: state,
                pinCode: pinCode,
                country: country,
                emailId: emailId,
                whatsappNo: whatsappNo,
                contactNo: contactNo,
                panNo: panNo,
                gstin: gstin,
                gstType: gstType,
                compositeTradeName: compositeTradeName,
                createdAt: new Date() // बनाने का समय
            };
            const customerDocRef = await addDoc(customersRef, customerData);
            console.log("New customer added with ID: ", customerDocRef.id);
            alert('Customer saved successfully!');
            // कस्टमर लिस्ट पेज पर वापस भेजें
            window.location.href = 'customer_management.html';

        } else {
            // कस्टमर पहले से मौजूद है
            const existingCustomerId = querySnapshot.docs[0].id;
            console.log("Existing customer found with ID: ", existingCustomerId);
            alert(`Customer with WhatsApp number ${whatsappNo} already exists. Not adding duplicate.`);
            // आप चाहें तो यहाँ यूजर को कस्टमर लिस्ट पर वापस भेज सकते हैं
             window.location.href = 'customer_management.html';
        }

    } catch (error) {
        console.error("Error saving customer: ", error);
        alert('Error saving customer: ' + error.message);
    } finally {
        // बटन को फिर से इनेबल करें
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = 'Save';
             // saveButton.innerHTML = '<i class="fas fa-save"></i> Save';
        }
    }
}

// --- इवेंट लिसनर ---
if (customerForm) {
    customerForm.addEventListener('submit', saveCustomerData);
} else {
    console.error("Customer form not found!");
}

console.log("new_customer.js loaded.");