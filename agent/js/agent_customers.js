// /agent/js/agent_customers.js
import { db, auth } from './agent_firebase_config.js';
import {
    collection, query, where, orderBy, getDocs, addDoc,
    doc, getDoc, updateDoc, deleteDoc, serverTimestamp
} from './agent_firebase_config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// DOM Elements
const agentWelcomeMessageEl = document.getElementById('agentWelcomeMessage');
const agentLogoutBtnEl = document.getElementById('agentLogoutBtn');
const addNewCustomerBtnEl = document.getElementById('addNewCustomerBtn');
const customerSearchInputEl = document.getElementById('customerSearchInput');
const customersTableBodyEl = document.getElementById('agentCustomersTableBody');
const loadingCustomersMessageEl = document.getElementById('loadingCustomersMessage');
const noCustomersMessageEl = document.getElementById('noCustomersMessage');

// Modal DOM Elements
const customerModalEl = document.getElementById('customerModal');
const customerModalTitleEl = document.getElementById('customerModalTitle');
const closeCustomerModalBtnEl = document.getElementById('closeCustomerModalBtn');
const customerFormEl = document.getElementById('customerForm');
const editCustomerIdInputEl = document.getElementById('editCustomerId'); // Hidden input
const customerFullNameInputEl = document.getElementById('customerFullName');
const customerWhatsAppNoInputEl = document.getElementById('customerWhatsAppNo');
const customerContactNoInputEl = document.getElementById('customerContactNo');
const customerAddressInputEl = document.getElementById('customerAddress');
const saveCustomerBtnEl = document.getElementById('saveCustomerBtn');
const cancelCustomerFormBtnEl = document.getElementById('cancelCustomerFormBtn');
const customerFormMessageEl = document.getElementById('customerFormMessage');


let currentUser = null;
let agentPermissions = { canAddCustomers: false };
let allAgentCustomers = []; // इस एजेंट के ग्राहकों को कैश करने के लिए

function showFormMessage(message, isError = false) {
    customerFormMessageEl.textContent = message;
    customerFormMessageEl.className = 'form-message'; // बेस क्लास रीसेट करें
    customerFormMessageEl.classList.add(isError ? 'error' : 'success');
    customerFormMessageEl.style.display = 'block';
}

// एजेंट की अनुमतियाँ लोड करें
async function loadAgentPermissions() {
    if (!currentUser) return;
    try {
        const agentDocSnap = await getDoc(doc(db, "agents", currentUser.uid));
        if (agentDocSnap.exists()) {
            agentPermissions = agentDocSnap.data();
            if (agentPermissions.canAddCustomers) {
                addNewCustomerBtnEl.style.display = 'inline-flex';
            } else {
                addNewCustomerBtnEl.style.display = 'none';
            }
        }
    } catch (error) {
        console.error("Error loading agent permissions:", error);
    }
}

// Modal खोलें
function openCustomerModal(mode = 'add', customerData = null) {
    customerFormEl.reset();
    editCustomerIdInputEl.value = '';
    showFormMessage("", false); // पिछला संदेश हटाएं

    if (mode === 'add') {
        customerModalTitleEl.innerHTML = '<i class="fas fa-user-plus"></i> Add New Customer';
        saveCustomerBtnEl.innerHTML = '<i class="fas fa-save"></i> Save Customer';
    } else if (mode === 'edit' && customerData) {
        customerModalTitleEl.innerHTML = '<i class="fas fa-user-edit"></i> Edit Customer';
        saveCustomerBtnEl.innerHTML = '<i class="fas fa-save"></i> Update Customer';
        editCustomerIdInputEl.value = customerData.id;
        customerFullNameInputEl.value = customerData.fullName || '';
        customerWhatsAppNoInputEl.value = customerData.whatsappNo || '';
        customerContactNoInputEl.value = customerData.contactNo || '';
        customerAddressInputEl.value = customerData.address || '';
    }
    customerModalEl.classList.add('active');
    customerModalEl.style.display = 'flex';
}

// Modal बंद करें
function closeCustomerModal() {
    customerModalEl.classList.remove('active');
    customerModalEl.style.display = 'none';
}

// ग्राहकों को लोड करें और टेबल में दिखाएं
async function loadCustomers(searchTerm = '') {
    if (!currentUser) return;

    loadingCustomersMessageEl.style.display = 'table-row';
    noCustomersMessageEl.style.display = 'none';
    customersTableBodyEl.innerHTML = '';
    customersTableBodyEl.appendChild(loadingCustomersMessageEl);

    try {
        // ग्राहकों को फिल्टर करें: केवल इस एजेंट द्वारा जोड़े गए (addedByAgentId)
        // या यदि सभी ग्राहक दिखाने हैं तो यह 'where' क्लॉज हटाएं।
        // अभी के लिए, हम सभी ग्राहकों को लाएंगे जिन्हें 'create_order' पेज पर भी एक्सेस किया जा सकता है।
        // यदि आप चाहते हैं कि एजेंट केवल अपने द्वारा जोड़े गए ग्राहक देखें,
        // तो आपको 'customers' कलेक्शन में 'addedByAgentId' फील्ड जोड़ना होगा।
        const customersQuery = query(
            collection(db, "customers"),
            orderBy("fullNameLower") // नाम से सॉर्ट करें
            // where("addedByAgentId", "==", currentUser.uid) // यह लाइन जोड़ें यदि एजेंट सिर्फ अपने ग्राहक देख सके
        );
        const snapshot = await getDocs(customersQuery);
        allAgentCustomers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        displayCustomers(searchTerm);

    } catch (error) {
        console.error("Error loading customers:", error);
        loadingCustomersMessageEl.style.display = 'none';
        customersTableBodyEl.innerHTML = `<tr><td colspan="6" class="form-message error">Error loading customers.</td></tr>`;
    }
}

function displayCustomers(searchTerm = '') {
    loadingCustomersMessageEl.style.display = 'none';
    customersTableBodyEl.innerHTML = '';
    const term = searchTerm.toLowerCase();

    const filteredCustomers = allAgentCustomers.filter(cust => {
        return (cust.fullName?.toLowerCase().includes(term) ||
                cust.whatsappNo?.includes(term) ||
                cust.contactNo?.includes(term));
    });

    if (filteredCustomers.length === 0) {
        noCustomersMessageEl.style.display = 'table-row';
        customersTableBodyEl.appendChild(noCustomersMessageEl);
        return;
    }
    noCustomersMessageEl.style.display = 'none';

    filteredCustomers.forEach(cust => {
        const row = customersTableBodyEl.insertRow();
        row.insertCell().textContent = cust.fullName || 'N/A';
        row.insertCell().textContent = cust.whatsappNo || 'N/A';
        row.insertCell().textContent = cust.contactNo || 'N/A';
        row.insertCell().textContent = cust.address || 'N/A';
        row.insertCell().textContent = cust.createdAt && cust.createdAt.toDate ? cust.createdAt.toDate().toLocaleDateString('en-GB') : 'N/A';

        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions-cell');
        if (agentPermissions.canAddCustomers) { // या canEditCustomers
            const editBtn = document.createElement('button');
            editBtn.classList.add('button', 'edit-btn');
            editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
            editBtn.title = "Edit Customer";
            editBtn.onclick = () => openCustomerModal('edit', cust);
            actionsCell.appendChild(editBtn);

            // डिलीट बटन (यदि आवश्यक हो)
            // const deleteBtn = document.createElement('button');
            // deleteBtn.classList.add('button', 'delete-btn');
            // deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
            // deleteBtn.onclick = () => handleDeleteCustomer(cust.id, cust.fullName);
            // actionsCell.appendChild(deleteBtn);
        } else {
            actionsCell.textContent = '-';
        }
    });
}


// ग्राहक फॉर्म सबमिट हैंडलर
if (customerFormEl) {
    customerFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!agentPermissions.canAddCustomers && !editCustomerIdInputEl.value) { // यदि जोड़ने की अनुमति नहीं और नया जोड़ रहे हैं
            showFormMessage("You do not have permission to add new customers.", true);
            return;
        }

        const customerId = editCustomerIdInputEl.value;
        const fullName = customerFullNameInputEl.value.trim();
        const whatsappNo = customerWhatsAppNoInputEl.value.trim();
        const contactNo = customerContactNoInputEl.value.trim() || null;
        const address = customerAddressInputEl.value.trim() || null;

        if (!fullName || !whatsappNo) {
            showFormMessage("Full Name and WhatsApp Number are required.", true);
            return;
        }
        // WhatsApp नंबर का बेसिक वैलिडेशन (उदाहरण)
        if (!/^\+?[1-9]\d{1,14}$/.test(whatsappNo.replace(/\s+/g, ''))) {
             showFormMessage("Please enter a valid WhatsApp number (e.g., +91XXXXXXXXXX or XXXXXXXXXX).", true);
             return;
        }


        const originalBtnText = saveCustomerBtnEl.innerHTML;
        saveCustomerBtnEl.disabled = true;
        saveCustomerBtnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        showFormMessage("");

        const customerData = {
            fullName: fullName,
            fullNameLower: fullName.toLowerCase(), // सर्चिंग के लिए
            whatsappNo: whatsappNo,
            contactNo: contactNo,
            address: address,
            // billingAddress: address, // यदि billingAddress और shippingAddress अलग नहीं हैं
            updatedAt: serverTimestamp()
        };

        try {
            if (customerId) { // एडिट मोड
                const custDocRef = doc(db, "customers", customerId);
                await updateDoc(custDocRef, customerData);
                showFormMessage("Customer updated successfully!");
            } else { // ऐड मोड
                customerData.createdAt = serverTimestamp();
                customerData.addedByAgentId = currentUser.uid; // एजेंट की ID स्टोर करें जिसने ग्राहक जोड़ा
                customerData.status = 'active'; // डिफ़ॉल्ट स्टेटस
                // customerData.customCustomerId = await getNextNumericId("customerCounter", 101); // यदि कस्टम आईडी चाहिए
                await addDoc(collection(db, "customers"), customerData);
                showFormMessage("Customer added successfully!");
            }
            customerFormEl.reset();
            setTimeout(() => { // थोड़ा रुककर Modal बंद करें ताकि संदेश दिख सके
                closeCustomerModal();
                loadCustomers(customerSearchInputEl.value); // लिस्ट रिफ्रेश करें
            }, 1500);
        } catch (error) {
            console.error("Error saving customer:", error);
            showFormMessage(`Error saving customer: ${error.message}`, true);
        } finally {
            saveCustomerBtnEl.disabled = false;
            saveCustomerBtnEl.innerHTML = originalBtnText;
        }
    });
}

// सर्च इनपुट के लिए डिबाउंस
let searchDebounceTimer;
if(customerSearchInputEl) {
    customerSearchInputEl.addEventListener('input', (e) => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            displayCustomers(e.target.value);
        }, 300);
    });
}

// DOMContentLoaded और Auth State Change
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            if(agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = `Welcome, ${user.email || 'Agent'}`;
            loadAgentPermissions().then(() => {
                loadCustomers(); // अनुमतियाँ लोड होने के बाद ग्राहक लोड करें
            });
        } else {
            window.location.href = 'agent_login.html';
        }
    });

    if(agentLogoutBtnEl) {
        agentLogoutBtnEl.addEventListener('click', () => {
            auth.signOut().then(() => window.location.href = 'agent_login.html');
        });
    }

    if(addNewCustomerBtnEl) addNewCustomerBtnEl.onclick = () => openCustomerModal('add');
    if(closeCustomerModalBtnEl) closeCustomerModalBtnEl.onclick = closeCustomerModal;
    if(cancelCustomerFormBtnEl) cancelCustomerFormBtnEl.onclick = closeCustomerModal;

    // Modal के बाहर क्लिक करने पर बंद करें
    if(customerModalEl) {
        customerModalEl.addEventListener('click', (event) => {
            if (event.target === customerModalEl) { // यदि क्लिक ओवरले पर हुआ है, कंटेंट पर नहीं
                closeCustomerModal();
            }
        });
    }
});