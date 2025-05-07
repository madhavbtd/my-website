// /agent/js/agent_customers.js
import { db, auth } from './agent_firebase_config.js';
import {
    collection, query, where, orderBy, getDocs, addDoc,
    doc, getDoc, updateDoc, deleteDoc, serverTimestamp
} from './agent_firebase_config.js'; // या सीधे Firebase SDK से
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
// एजेंट की अनुमतियाँ यहाँ स्टोर होंगी
let agentPermissions = {
    canAddCustomers: false, // डिफ़ॉल्ट
    role: null,
    status: 'inactive',
    email: null // एजेंट का ईमेल स्टोर करने के लिए
};
let allAgentCustomersCache = []; // इस एजेंट के ग्राहकों को कैश करने के लिए (सुरक्षा नियमों के आधार पर)

// --- हेल्पर फ़ंक्शंस ---
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') unsafe = String(unsafe || ''); return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");}

function showFormMessage(message, isError = false) {
    if (!customerFormMessageEl) return;
    customerFormMessageEl.textContent = message;
    customerFormMessageEl.className = 'form-message';
    customerFormMessageEl.classList.add(isError ? 'error' : 'success');
    customerFormMessageEl.style.display = 'block';
}

// --- प्रमाणीकरण और अनुमति लोड करना ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        if (agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = `Welcome, ${user.email || 'Agent'}`;

        try {
            const agentDocRef = doc(db, "agents", currentUser.uid);
            const agentDocSnap = await getDoc(agentDocRef);

            if (agentDocSnap.exists() && agentDocSnap.data().role === 'agent' && agentDocSnap.data().status === 'active') {
                agentPermissions = agentDocSnap.data();
                agentPermissions.email = user.email; // Auth से ईमेल जोड़ें (यदि agents doc में नहीं है)
                console.log("एजेंट प्रमाणित और अनुमतियाँ लोड की गईं:", agentPermissions);

                if (addNewCustomerBtnEl) {
                    addNewCustomerBtnEl.style.display = agentPermissions.canAddCustomers ? 'inline-flex' : 'none';
                } else {
                    console.warn("'Add New Customer' बटन (addNewCustomerBtnEl) HTML में नहीं मिला।");
                }
                loadCustomers(); // अनुमतियाँ लोड होने के बाद ग्राहक लोड करें
            } else {
                console.error("एजेंट दस्तावेज़ नहीं मिला या भूमिका/स्थिति अमान्य है। लॉग आउट किया जा रहा है।");
                if (agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = "अमान्य एजेंट खाता।";
                if (addNewCustomerBtnEl) addNewCustomerBtnEl.style.display = 'none';
                if (customersTableBodyEl) customersTableBodyEl.innerHTML = `<tr><td colspan="6" class="form-message error">आप ग्राहक डेटा देखने के लिए अधिकृत नहीं हैं।</td></tr>`;
                if (loadingCustomersMessageEl) loadingCustomersMessageEl.style.display = 'none';
                // auth.signOut(); // वैकल्पिक: तुरंत लॉगआउट करें
                // window.location.href = 'agent_login.html';
            }
        } catch (error) {
            console.error("एजेंट अनुमतियाँ लोड करने में त्रुटि:", error);
            if (agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = "प्रोफ़ाइल लोड करने में त्रुटि।";
            if (customersTableBodyEl) customersTableBodyEl.innerHTML = `<tr><td colspan="6" class="form-message error">अनुमतियाँ लोड करने में त्रुटि। (${error.message})</td></tr>`;
            if (loadingCustomersMessageEl) loadingCustomersMessageEl.style.display = 'none';
            // auth.signOut();
            // window.location.href = 'agent_login.html';
        }
    } else {
        console.log("Agent not logged in on customers page. Redirecting...");
        window.location.replace('agent_login.html');
    }
});

// --- ग्राहक Modal ---
function openCustomerModal(mode = 'add', customerData = null) {
    if (!customerFormEl || !customerModalEl /*...अन्य आवश्यक तत्व जांचें...*/) {
        console.error("ग्राहक Modal या उसके तत्व नहीं मिले!");
        alert("फ़ॉर्म खोलने में त्रुटि।");
        return;
    }
    customerFormEl.reset();
    editCustomerIdInputEl.value = '';
    showFormMessage("", false);

    if (mode === 'add') {
        if (!agentPermissions.canAddCustomers) {
            alert("आपके पास नए ग्राहक जोड़ने की अनुमति नहीं है।");
            return; // Modal न खोलें
        }
        customerModalTitleEl.innerHTML = '<i class="fas fa-user-plus"></i> नया ग्राहक जोड़ें';
        saveCustomerBtnEl.innerHTML = '<i class="fas fa-save"></i> ग्राहक सहेजें';
    } else if (mode === 'edit' && customerData) {
        customerModalTitleEl.innerHTML = '<i class="fas fa-user-edit"></i> ग्राहक संपादित करें';
        saveCustomerBtnEl.innerHTML = '<i class="fas fa-save"></i> अपडेट ग्राहक';
        editCustomerIdInputEl.value = customerData.id || '';
        customerFullNameInputEl.value = customerData.fullName || '';
        customerWhatsAppNoInputEl.value = customerData.whatsappNo || '';
        customerContactNoInputEl.value = customerData.contactNo || '';
        customerAddressInputEl.value = customerData.address || customerData.billingAddress || '';
    }
    customerModalEl.classList.add('active');
    customerModalEl.style.display = 'flex';
    customerFullNameInputEl.focus();
}

function closeCustomerModal() {
    if (customerModalEl) {
        customerModalEl.classList.remove('active');
        customerModalEl.style.display = 'none';
    }
}

// --- ग्राहक डेटा लोड करना और दिखाना ---
async function loadCustomers() {
    if (!currentUser || !customersTableBodyEl || !loadingCustomersMessageEl || !noCustomersMessageEl) {
        console.warn("loadCustomers: आवश्यक तत्व या उपयोगकर्ता नहीं मिला।");
        if (customersTableBodyEl && loadingCustomersMessageEl) {
             loadingCustomersMessageEl.style.display = 'none';
             customersTableBodyEl.innerHTML = `<tr><td colspan="6" class="form-message error">ग्राहक लोड करने के लिए लॉग इन करें।</td></tr>`;
        }
        return;
    }

    loadingCustomersMessageEl.style.display = 'table-row';
    noCustomersMessageEl.style.display = 'none';
    const rowsToRemove = customersTableBodyEl.querySelectorAll('tr:not(#loadingCustomersMessage):not(#noCustomersMessage)');
    rowsToRemove.forEach(row => row.remove());

    try {
        // सुरक्षा नियम यह सुनिश्चित करेंगे कि एजेंट केवल अपने ग्राहक ही देख सके,
        // यदि नियमों में `where("addedByAgentId", "==", request.auth.uid)` का उपयोग किया गया है।
        const customersQuery = query(
            collection(db, "customers"),
            where("addedByAgentId", "==", currentUser.uid), // केवल इस एजेंट द्वारा जोड़े गए ग्राहक
            orderBy("fullNameLower")
        );
        // यदि आपके सुरक्षा नियम एजेंटों को सभी ग्राहक पढ़ने की अनुमति देते हैं,
        // और आप चाहते हैं कि UI में भी सभी ग्राहक दिखें (लेकिन संपादन केवल अपने पर हो),
        // तो आप ऊपर की `where` क्लॉज को हटा सकते हैं।

        const snapshot = await getDocs(customersQuery);
        allAgentCustomersCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log(`एजेंट ${currentUser.uid} के लिए ${allAgentCustomersCache.length} ग्राहक लोड किए गए।`);
        displayCustomers();

    } catch (error) {
        console.error("ग्राहक लोड करने में त्रुटि:", error);
        loadingCustomersMessageEl.style.display = 'none';
        customersTableBodyEl.innerHTML = `<tr><td colspan="6" class="form-message error">ग्राहक लोड करने में त्रुटि हुई। (${error.message})</td></tr>`;
    }
}

function displayCustomers(searchTerm = (customerSearchInputEl ? customerSearchInputEl.value.trim() : '')) {
    if (!customersTableBodyEl || !loadingCustomersMessageEl || !noCustomersMessageEl) return;

    loadingCustomersMessageEl.style.display = 'none';
    const rowsToRemove = customersTableBodyEl.querySelectorAll('tr:not(#loadingCustomersMessage):not(#noCustomersMessage)');
    rowsToRemove.forEach(row => row.remove());

    const term = searchTerm.toLowerCase();
    const filteredCustomers = allAgentCustomersCache.filter(cust => {
        return (cust.fullName?.toLowerCase().includes(term) ||
                cust.whatsappNo?.includes(term) ||
                (cust.contactNo && cust.contactNo.includes(term)) );
    });

    if (filteredCustomers.length === 0) {
        noCustomersMessageEl.style.display = 'table-row';
         if (!document.getElementById('noCustomersMessage')) { // यदि पहले से नहीं जोड़ा गया है
             customersTableBodyEl.appendChild(noCustomersMessageEl);
         }
        return;
    }
    noCustomersMessageEl.style.display = 'none';

    filteredCustomers.forEach(cust => {
        const row = customersTableBodyEl.insertRow();
        row.insertCell().textContent = escapeHtml(cust.fullName || 'N/A');
        row.insertCell().textContent = escapeHtml(cust.whatsappNo || 'N/A');
        row.insertCell().textContent = escapeHtml(cust.contactNo || 'N/A');
        row.insertCell().textContent = escapeHtml(cust.address || cust.billingAddress || 'N/A');
        row.insertCell().textContent = cust.createdAt?.toDate ? cust.createdAt.toDate().toLocaleDateString('en-GB') : 'N/A';

        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions-cell');

        // संपादन बटन दिखाएं। सुरक्षा नियम सर्वर पर जाँच करेंगे कि क्या एजेंट इस ग्राहक को संपादित कर सकता है।
        // UI में, आप `cust.addedByAgentId === currentUser.uid` की भी जाँच कर सकते हैं यदि आवश्यक हो।
        const editBtn = document.createElement('button');
        editBtn.classList.add('button', 'edit-btn', 'small-button');
        editBtn.innerHTML = '<i class="fas fa-edit"></i> संपादित करें';
        editBtn.title = "ग्राहक संपादित करें";
        editBtn.onclick = () => openCustomerModal('edit', cust);
        actionsCell.appendChild(editBtn);

        // डिलीट बटन (यदि एजेंटों को डिलीट करने की अनुमति है - आमतौर पर नहीं)
        // if (agentPermissions.canDeleteCustomers) {
        // const deleteBtn = document.createElement('button'); ... }
    });
}


// --- ग्राहक फ़ॉर्म सबमिट हैंडलर ---
async function handleSaveCustomer(e) {
    e.preventDefault();
    if (!currentUser) {
        showFormMessage("आपको इस क्रिया के लिए लॉग इन होना चाहिए।", true);
        return;
    }

    const customerIdToEdit = editCustomerIdInputEl.value;
    const isEditing = !!customerIdToEdit;

    if (!isEditing && (!agentPermissions || !agentPermissions.canAddCustomers)) {
        showFormMessage("आपके पास नए ग्राहक जोड़ने की अनुमति नहीं है।", true);
        return;
    }

    const fullName = customerFullNameInputEl.value.trim();
    const whatsappNo = customerWhatsAppNoInputEl.value.trim();
    const contactNo = customerContactNoInputEl.value.trim() || null;
    const address = customerAddressInputEl.value.trim() || null;

    if (!fullName || !whatsappNo) {
        showFormMessage("पूरा नाम और व्हाट्सएप नंबर आवश्यक हैं।", true);
        return;
    }
    if (!/^\+?[1-9]\d{7,14}$/.test(whatsappNo.replace(/\s+/g, ''))) {
         showFormMessage("कृपया एक मान्य व्हाट्सएप नंबर दर्ज करें।", true);
         return;
    }

    const originalBtnHTML = saveCustomerBtnEl.innerHTML;
    saveCustomerBtnEl.disabled = true;
    saveCustomerBtnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> सहेजा जा रहा है...';
    showFormMessage("");

    const customerDataPayload = {
        fullName: fullName,
        fullNameLower: fullName.toLowerCase(),
        whatsappNo: whatsappNo,
        contactNo: contactNo,
        address: address,
        billingAddress: address, // यदि एक ही है
        updatedAt: serverTimestamp(),
        // status: 'active' // यदि नया है तो इसे सेट करें, या सुरक्षा नियमों में इसे डिफ़ॉल्ट करें
    };

    try {
        if (isEditing) {
            const custDocRef = doc(db, "customers", customerIdToEdit);
            // सुनिश्चित करें कि addedByAgentId और createdAt अपडेट नहीं हो रहे हैं
            delete customerDataPayload.addedByAgentId;
            delete customerDataPayload.agentEmail;
            delete customerDataPayload.createdAt;
            await updateDoc(custDocRef, customerDataPayload);
            showFormMessage("ग्राहक सफलतापूर्वक अपडेट किया गया!");
        } else { // नया ग्राहक जोड़ रहे हैं
            customerDataPayload.createdAt = serverTimestamp();
            customerDataPayload.addedByAgentId = currentUser.uid; // एजेंट की ID सेट करें
            customerDataPayload.agentEmail = agentPermissions.email || currentUser.email; // एजेंट का ईमेल
            customerDataPayload.status = 'active'; // नए ग्राहक के लिए डिफ़ॉल्ट स्थिति

            const docRef = await addDoc(collection(db, "customers"), customerDataPayload);
            console.log("नया ग्राहक सहेजा गया ID:", docRef.id);
            showFormMessage("ग्राहक सफलतापूर्वक जोड़ा गया!");
        }
        customerFormEl.reset();
        setTimeout(() => {
            closeCustomerModal();
            loadCustomers(); // नवीनतम डेटा के साथ सूची को रीफ्रेश करें
        }, 1500);
    } catch (error) {
        console.error("ग्राहक सहेजने में त्रुटि:", error);
        showFormMessage(`ग्राहक सहेजने में त्रुटि: ${error.message}`, true);
    } finally {
        saveCustomerBtnEl.disabled = false;
        saveCustomerBtnEl.innerHTML = originalBtnHTML;
    }
}

// --- प्रारंभिक इवेंट लिस्नर सेटअप ---
document.addEventListener('DOMContentLoaded', () => {
    // onAuthStateChanged पहले से ही ऊपर है और वह loadAgentPermissions और loadCustomers को कॉल करेगा।

    if (addNewCustomerBtnEl) addNewCustomerBtnEl.onclick = () => openCustomerModal('add');
    if (closeCustomerModalBtnEl) closeCustomerModalBtnEl.onclick = closeCustomerModal;
    if (cancelCustomerFormBtnEl) cancelCustomerFormBtnEl.onclick = closeCustomerModal;

    if (customerModalEl) {
        customerModalEl.addEventListener('click', (event) => {
            if (event.target === customerModalEl) closeCustomerModal();
        });
    }
    if (customerFormEl) {
        customerFormEl.addEventListener('submit', handleSaveCustomer);
    }

    let searchDebounceTimer;
    if (customerSearchInputEl) {
        customerSearchInputEl.addEventListener('input', (e) => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                displayCustomers(e.target.value); // केवल कैश की गई सूची को फ़िल्टर करें, Firestore को दोबारा क्वेरी न करें
            }, 300);
        });
    }

    if (agentLogoutBtnEl && auth) {
        agentLogoutBtnEl.addEventListener('click', () => {
            if(confirm("क्या आप वाकई लॉग आउट करना चाहते हैं?")) {
                auth.signOut().then(() => {
                    window.location.href = 'agent_login.html';
                }).catch(error => {
                     console.error("Logout error:", error);
                     alert("लॉगआउट विफल रहा।");
                });
            }
        });
    }
    console.log("Agent Customers JS DOMContentLoaded listeners attached.");
});