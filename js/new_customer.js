// js/new_customer.js

const { db, collection, addDoc, doc, getDocs, query, where, getDoc, updateDoc } = window;

const customerForm = document.getElementById('newCustomerForm');
const saveButton = document.getElementById('saveCustomerBtn');
const formHeader = document.getElementById('formHeader');
const hiddenEditIdInput = document.getElementById('editCustomerId');

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const customerIdToEdit = urlParams.get('editId'); // Use editId from customer list link

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

async function loadCustomerDataForEdit(customerId) {
     if (!db || !doc || !getDoc) { alert("Database functions not available."); return; }
     console.log(`Loading data for customer ID: ${customerId}`);
     try {
        const customerRef = doc(db, "customers", customerId);
        const docSnap = await getDoc(customerRef);
        if (docSnap.exists()) {
            const d = docSnap.data();
            console.log("Customer data loaded:", d);
            customerForm.full_name.value = d.fullName || '';
            customerForm.billing_address.value = d.billingAddress || '';
            customerForm.city.value = d.city || '';
            customerForm.state.value = d.state || '';
            customerForm.pin_code.value = d.pinCode || '';
            customerForm.email_id.value = d.emailId || '';
            customerForm.whatsapp_no.value = d.whatsappNo || '';
            customerForm.contact_no.value = d.contactNo || '';
            customerForm.pan_no.value = d.panNo || '';
            customerForm.gstin.value = d.gstin || '';
            customerForm.composite_trade_name.value = d.compositeTradeName || '';
            if (d.gstType) { const r = customerForm.querySelector(`input[name="gst_type"][value="${d.gstType}"]`); if (r) r.checked = true; else customerForm.querySelectorAll('input[name="gst_type"]').forEach(r => r.checked = false); }
            else { customerForm.querySelectorAll('input[name="gst_type"]').forEach(r => r.checked = false); }
        } else { console.error("Doc not found!"); alert("Could not find customer data."); window.location.href = 'customer_management.html'; }
    } catch (error) { console.error("Error loading data: ", error); alert("Error loading data: " + error.message); window.location.href = 'customer_management.html'; }
}

async function handleFormSubmit(event) {
    event.preventDefault();
    if (saveButton) { saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }

    const formData = new FormData(customerForm);
    const customerId = formData.get('editCustomerId');
    const fullName = formData.get('full_name')?.trim() || '';
    const whatsappNo = formData.get('whatsapp_no')?.trim() || '';

    if (!fullName || !whatsappNo) { alert('Please enter Full Name and WhatsApp No.'); if (saveButton) { saveButton.disabled = false; saveButton.innerHTML = customerId ? '<i class="fas fa-sync-alt"></i> Update' : '<i class="fas fa-save"></i> Save'; } return; }
    if (!db) { alert("Database connection error."); if (saveButton) { saveButton.disabled = false; saveButton.innerHTML = customerId ? '<i class="fas fa-sync-alt"></i> Update' : '<i class="fas fa-save"></i> Save'; } return; }

    const payload = {
        fullName: fullName, billingAddress: formData.get('billing_address')?.trim() || '', city: formData.get('city')?.trim() || '',
        state: formData.get('state')?.trim() || '', pinCode: formData.get('pin_code')?.trim() || '', country: 'India',
        emailId: formData.get('email_id')?.trim() || '', whatsappNo: whatsappNo, contactNo: formData.get('contact_no')?.trim() || '',
        panNo: formData.get('pan_no')?.trim() || '', gstin: formData.get('gstin')?.trim() || '', gstType: formData.get('gst_type') || '',
        compositeTradeName: formData.get('composite_trade_name')?.trim() || '',
    };

    try {
        const customersRef = collection(db, "customers");
        if (customerId) { // Update mode
             console.log("Updating customer:", customerId);
             payload.updatedAt = new Date();
             const customerRef = doc(db, "customers", customerId);
             await updateDoc(customerRef, payload);
             alert('Customer updated successfully!');
             window.location.href = 'customer_management.html';
        } else { // Add mode
            console.log("Adding customer, checking duplicate...");
            const q = query(customersRef, where("whatsappNo", "==", whatsappNo));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                payload.displayCustomerId = Date.now().toString(); // Add display ID
                payload.createdAt = new Date();
                const docRef = await addDoc(customersRef, payload);
                console.log("New customer added:", docRef.id);
                alert('Customer saved successfully!');
                window.location.href = 'customer_management.html';
            } else {
                alert(`Customer with WhatsApp ${whatsappNo} already exists.`);
                if (saveButton) { saveButton.disabled = false; saveButton.innerHTML = '<i class="fas fa-save"></i> Save'; }
                return;
            }
        }
    } catch (error) {
        console.error("Error saving customer: ", error);
        alert('Error saving customer: ' + error.message);
        if (saveButton) { saveButton.disabled = false; saveButton.innerHTML = customerId ? '<i class="fas fa-sync-alt"></i> Update' : '<i class="fas fa-save"></i> Save'; }
    }
}
console.log("new_customer.js loaded.");