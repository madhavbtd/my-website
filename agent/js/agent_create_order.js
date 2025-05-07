// /agent/js/agent_create_order.js

// Firebase कॉन्फिग और जरूरी फंक्शन्स इम्पोर्ट करें
import {
    db, auth, collection, query, where, orderBy, limit, getDocs,
    doc, getDoc, addDoc, updateDoc, Timestamp, serverTimestamp,
    runTransaction, arrayUnion
} from './agent_firebase_config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Global Variables ---
let currentUser = null;
let agentPermissions = { role: null, status: 'inactive', email: null, canAddCustomers: false }; // डिफ़ॉल्ट अनुमतियाँ
let productCache = [];
let customerCache = []; // यह कैश अब अधिक महत्वपूर्ण होगा
let productFetchPromise = null;
let customerFetchPromise = null;
let activeProductInput = null;
let productSuggestionsDiv = null;
let customerSearchDebounceTimer;
let isDiscountInputProgrammaticChange = false;
let selectedCustomerId = null;
// let selectedCustomerData = null; // अब सीधे customerCache से प्राप्त किया जाएगा या `agents` में `addedByAgentId` से

// --- DOM Element References --- (आपके मौजूदा कोड से)
const orderForm = document.getElementById('agentNewOrderForm');
const customerNameInput = document.getElementById('agent_customer_name');
const customerWhatsAppInput = document.getElementById('agent_customer_whatsapp');
const customerAddressInput = document.getElementById('agent_customer_address');
const customerContactInput = document.getElementById('agent_customer_contact');
const customerSuggestionsNameBox = document.getElementById('agent-customer-suggestions-name');
const customerSuggestionsWhatsAppBox = document.getElementById('agent-customer-suggestions-whatsapp');
const selectedCustomerIdInput = document.getElementById('agentSelectedCustomerId');
const orderItemsTableBody = document.getElementById('agentOrderItemsTableBody');
const itemRowTemplate = document.getElementById('agent-item-row-template');
const addItemBtn = document.getElementById('agentAddItemBtn');
const summarySubtotalSpan = document.getElementById('agentSummarySubtotal');
const summaryDiscountPercentInput = document.getElementById('agentSummaryDiscountPercent');
const summaryDiscountAmountInput = document.getElementById('agentSummaryDiscountAmount');
const summaryFinalAmountSpan = document.getElementById('agentSummaryFinalAmount');
const deliveryDateInput = document.getElementById('agent_delivery_date');
const remarksInput = document.getElementById('agent_remarks');
const saveOrderBtn = document.getElementById('agentSaveOrderBtn');
const formErrorMsg = document.getElementById('agentFormErrorMsg');
const agentWelcomeMessageEl = document.getElementById('agentWelcomeMessage');
const agentLogoutBtnEl = document.getElementById('agentLogoutBtn');


// --- Helper Functions --- (आपके मौजूदा कोड से)
function escapeHtml(unsafe) { /* ... */ }
function formatCurrency(amount) { /* ... */ }
function showFormError(message) { /* ... */ }
function hideSuggestionBox(box) { /* ... */ }

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
                agentPermissions.email = user.email; // Auth से ईमेल जोड़ें
                console.log("एजेंट प्रमाणित (Create Order) और अनुमतियाँ लोड की गईं:", agentPermissions);

                // पेज-विशिष्ट सेटअप
                attachEventListeners();
                addInitialItemRow();
                preFetchCaches();
                resetAgentOrderForm(false); // केवल आइटम रीसेट करें, ग्राहक नहीं यदि पहले से चयनित है
            } else {
                console.error("एजेंट दस्तावेज़ नहीं मिला या भूमिका/स्थिति अमान्य है। लॉग आउट किया जा रहा है।");
                if(formErrorMsg) showFormError("आपका एजेंट खाता मान्य नहीं है या सक्रिय नहीं है। कृपया एडमिन से संपर्क करें।");
                if(saveOrderBtn) saveOrderBtn.disabled = true;
                auth.signOut().then(() => window.location.href = 'agent_login.html');
            }
        } catch (error) {
            console.error("एजेंट अनुमतियाँ लोड करने में त्रुटि:", error);
            if(formErrorMsg) showFormError("आपकी प्रोफ़ाइल लोड करने में त्रुटि हुई। कृपया पुनः प्रयास करें।");
            if(saveOrderBtn) saveOrderBtn.disabled = true;
            auth.signOut().then(() => window.location.href = 'agent_login.html');
        }
    } else {
        console.log("Agent not logged in on create order page. Redirecting...");
        window.location.replace('agent_login.html');
    }
});

// --- Event Listeners और अन्य फ़ंक्शंस --- (आपके मौजूदा कोड से)
function attachEventListeners() { /* ... (सुनिश्चित करें कि Logout बटन भी यहाँ है) ... */
    if (agentLogoutBtnEl) {
        agentLogoutBtnEl.addEventListener('click', () => {
            if (confirm("क्या आप वाकई लॉग आउट करना चाहते हैं?")) {
                auth.signOut().then(() => window.location.href = 'agent_login.html');
            }
        });
    }
    // बाकी लिस्नर पहले जैसे
    if (!addItemBtn || !orderItemsTableBody || !orderForm || !customerNameInput || !customerWhatsAppInput || !summaryDiscountPercentInput || !summaryDiscountAmountInput) { return; }
    addItemBtn.addEventListener('click', handleAddItem);
    orderItemsTableBody.addEventListener('click', handleItemTableClick);
    orderItemsTableBody.addEventListener('input', handleItemTableInput);
    orderItemsTableBody.addEventListener('change', handleItemTableChange);
    orderItemsTableBody.addEventListener('focusin', (event) => {
        if (event.target.matches('.product-name')) activeProductInput = event.target;
    });
    customerNameInput.addEventListener('input', (e) => handleCustomerInput(e, 'name'));
    customerWhatsAppInput.addEventListener('input', (e) => handleCustomerInput(e, 'whatsapp'));
    document.addEventListener('click', handleGlobalClickForSuggestions);
    summaryDiscountPercentInput.addEventListener('input', handleDiscountInput);
    summaryDiscountAmountInput.addEventListener('input', handleDiscountInput);
    orderForm.addEventListener('submit', handleFormSubmit);
}

function addInitialItemRow() { if(orderItemsTableBody && orderItemsTableBody.rows.length === 0){ handleAddItem(); }}
function handleAddItem() { /* ... (पहले जैसा) ... */ }
function addItemRowEventListeners(row) { /* ... (पहले जैसा) ... */ }
function handleItemTableClick(event) { /* ... (पहले जैसा) ... */ }
function handleItemTableInput(event) { /* ... (पहले जैसा) ... */ }
function handleItemTableChange(event){ /* ... (पहले जैसा) ... */ }
function handleUnitTypeChange(event) { /* ... (पहले जैसा) ... */ }
function calculateFlexDimensions(unit, width, height) { /* ... (पहले जैसा) ... */ }
function updateItemAmount(row) { /* ... (पहले जैसा) ... */ }
function updateOrderSummary() { /* ... (पहले जैसा) ... */ }
function handleDiscountInput(event) { /* ... (पहले जैसा) ... */ }

// --- ग्राहक खोज/चयन तर्क (Customer Search/Select Logic) ---
async function getOrFetchCustomerCache() {
    if (customerCache.length > 0 && customerFetchPromise === null) return Promise.resolve(); // यदि कैश भरा है और कोई फ़ेच चालू नहीं है
    if (customerFetchPromise) return customerFetchPromise;
    console.log("एजेंट के लिए ग्राहक फ़ेच किए जा रहे हैं (Create Order)...");
    try {
        if (!db || !collection || !query || !getDocs || !orderBy || !where || !currentUser) {
            throw new Error("DB func missing or user not authenticated for customer cache");
        }

        let customersQuery;
        // **सुरक्षा नियम के आधार पर:**
        // यदि नियम है: allow read: if isAgent() && resource.data.addedByAgentId == uid();
        // तो यह क्वेरी केवल एजेंट के ग्राहकों को लाएगी।
        // यदि नियम है: allow read: if isAgent(); (और वह सभी ग्राहकों को पढ़ सकता है)
        // तो यह सभी ग्राहकों को लाएगा। सुनिश्चित करें कि आपका UI और नियम सुसंगत हैं।
        // यहाँ हम मानते हैं कि एजेंट केवल अपने ग्राहकों को खोज और लिंक कर सकता है,
        // या यदि उसके पास अनुमति है तो नया बना सकता है (handleFormSubmit में जाँच होगी)।
        customersQuery = query(
            collection(db, "customers"),
            where("addedByAgentId", "==", currentUser.uid), // केवल इस एजेंट द्वारा जोड़े गए ग्राहक
            orderBy("fullNameLower")
        );
        // यदि आप चाहते हैं कि एजेंट सभी ग्राहकों को खोज सकें:
        // customersQuery = query(collection(db, "customers"), orderBy("fullNameLower"));

        customerFetchPromise = getDocs(customersQuery).then(s => {
            customerCache = s.docs.map(d => ({ id: d.id, ...d.data() }));
            console.log(`एजेंट के लिए ${customerCache.length} ग्राहक कैश किए गए (Create Order)।`);
        }).catch(e => {
            console.error("एजेंट ग्राहक कैश फ़ेच करने में त्रुटि (Create Order):", e);
            throw e; // त्रुटि को आगे बढ़ाएं
        }).finally(() => {
            customerFetchPromise = null; // फ़ेच पूरा होने के बाद रीसेट करें
        });
        return customerFetchPromise;
    } catch (e) {
        console.error("एजेंट ग्राहक कैश सेटअप में त्रुटि (Create Order):", e);
        customerFetchPromise = null;
        return Promise.reject(e);
    }
}

function handleCustomerInput(event, type) { /* ... (पहले जैसा, getOrFetchCustomerCache का उपयोग करें) ... */ }
function filterAndRenderCustomerSuggestions(term, type, box, inputElement) { /* ... (पहले जैसा) ... */ }
function renderCustomerSuggestions(suggestions, term, box, inputElement) { /* ... (पहले जैसा) ... */ }
function selectCustomerSuggestion(customerData) {
    if (!customerData || !customerData.customerId) {
        console.warn("selectCustomerSuggestion को अमान्य डेटा या ग्राहक आईडी के बिना कॉल किया गया।");
        resetCustomerFields(true);
        return;
    }
    console.log("ग्राहक चुना जा रहा है:", customerData);
    if(customerNameInput) customerNameInput.value = customerData.customerName || '';
    if(customerWhatsAppInput) customerWhatsAppInput.value = customerData.customerWhatsapp || '';
    if(customerAddressInput) customerAddressInput.value = customerData.customerAddress || '';
    if(customerContactInput) customerContactInput.value = customerData.customerContact || '';
    selectedCustomerId = customerData.customerId; // Firestore दस्तावेज़ ID
    if(selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId;

    // चयनित ग्राहक का पूरा डेटा ऑब्जेक्ट प्राप्त करें (यदि आवश्यक हो, उदाहरण के लिए क्रेडिट सीमा)
    // selectedCustomerData = customerCache.find(c => c.id === selectedCustomerId);
    // यदि आप ग्राहक का बैलेंस या अन्य विवरण दिखाना चाहते हैं, तो यहाँ उन्हें फ़ेच करें।
}
function resetCustomerFields(clearAllFields = true) {
    if(clearAllFields) {
        if(customerNameInput) customerNameInput.value = '';
        if(customerWhatsAppInput) customerWhatsAppInput.value = '';
        if(customerAddressInput) customerAddressInput.value = '';
        if(customerContactInput) customerContactInput.value = '';
    }
    selectedCustomerId = null;
    // selectedCustomerData = null;
    if(selectedCustomerIdInput) selectedCustomerIdInput.value = '';
}

// --- उत्पाद खोज/चयन तर्क (Product Search/Select Logic) ---
async function getOrFetchProductCache() {
    if (productCache.length > 0 && productFetchPromise === null) return Promise.resolve();
    if (productFetchPromise) return productFetchPromise;
    console.log("एजेंट के लिए उत्पाद फ़ेच किए जा रहे हैं (Create Order)...");
    try {
        if (!db || !collection || !query || !getDocs || !orderBy || !where || !agentPermissions) { // agentPermissions की जाँच करें
            throw new Error("DB func missing or agent permissions not loaded for product cache");
        }
        let productsQuery;
        if (agentPermissions.allowedCategories && agentPermissions.allowedCategories.length > 0) {
            console.log("एजेंट की अनुमत श्रेणियों के आधार पर उत्पाद फ़िल्टर किए जा रहे हैं:", agentPermissions.allowedCategories);
            productsQuery = query(
                collection(db, "onlineProducts"),
                where("isEnabled", "==", true),
                where("category", "in", agentPermissions.allowedCategories),
                orderBy("productName")
            );
        } else {
            console.log("एजेंट सभी सक्षम उत्पाद देख सकता है (कोई श्रेणी फ़िल्टर नहीं)।");
            productsQuery = query(
                collection(db, "onlineProducts"),
                where("isEnabled", "==", true),
                orderBy("productName")
            );
        }
        productFetchPromise = getDocs(productsQuery).then(s => {
            productCache = s.docs.map(d => { /* ... (पहले जैसा, agentRate सुनिश्चित करें) ... */ });
        }).catch(e => { /* ... */ }).finally(() => { productFetchPromise = null; });
        return productFetchPromise;
    } catch (e) { /* ... */ }
}
// ... (बाकी उत्पाद खोज फ़ंक्शन पहले जैसे, सुनिश्चित करें कि selectProductSuggestion productData.agentRate का उपयोग करता है)
function getOrCreateProductSuggestionsDiv() { /* ... */ }
function positionProductSuggestions(inputElement) { /* ... */ }
function hideProductSuggestions() { /* ... */ }
function handleProductSearchInput(event) { /* ... */ }
function filterAndRenderProductSuggestions(term, inputElement) { /* ... */ }
function renderProductSuggestions(suggestions, term, suggestionsContainer) { /* ... */ }
function selectProductSuggestion(productData, inputElement) { /* ... (सुनिश्चित करें कि rateInput.value = productData.agentRate सेट हो रहा है) ... */ }
function handleSuggestionClick(event) { /* ... */ }
function handleGlobalClickForSuggestions(event) { /* ... */ }


// --- Form Submission ---
async function handleFormSubmit(event) {
    event.preventDefault();
    console.log("एजेंट ऑर्डर सबमिट प्रारंभ...");
    showFormError('');

    if (!currentUser || !agentPermissions) {
        showFormError("त्रुटि: ऑर्डर सबमिट करने में असमर्थ। उपयोगकर्ता या अनुमतियाँ लोड नहीं हुईं।");
        return;
    }
    // ... (बाकी DOM तत्व और Firebase फ़ंक्शन जाँच पहले जैसी) ...

    // सुनिश्चित करें कि saveOrderBtn अक्षम किया गया है और लोडर दिखाया गया है
    const saveBtnSpan = saveOrderBtn.querySelector('span');
    const saveBtnIcon = saveOrderBtn.querySelector('i');
    const originalBtnText = saveBtnSpan ? saveBtnSpan.textContent : "Submit Order";
    saveOrderBtn.disabled = true;
    if(saveBtnSpan) saveBtnSpan.textContent = 'सबमिट हो रहा है...';
    if(saveBtnIcon) saveBtnIcon.className = 'fas fa-spinner fa-spin';

    try {
        // 1. ग्राहक को मान्य करें
        const customerName = customerNameInput.value.trim();
        const customerWhatsapp = customerWhatsAppInput.value.trim();
        // selectedCustomerId को ग्राहक चयन के समय सेट किया जाना चाहिए
        const customerIdToUse = selectedCustomerIdInput?.value || selectedCustomerId || null;

        if (!customerName || !customerWhatsapp) throw new Error("ग्राहक का नाम और व्हाट्सएप नंबर आवश्यक हैं।");
        if (!customerIdToUse) {
            // यदि एजेंट को नए ग्राहक जोड़ने की अनुमति है, तो यहाँ एक नया ग्राहक बना सकते हैं
            // या चयन को अनिवार्य कर सकते हैं। अभी के लिए, चयन अनिवार्य है।
            if (agentPermissions.canAddCustomers) {
                 throw new Error("कृपया एक ग्राहक चुनें या नया ग्राहक बनाएँ (कार्यक्षमता लंबित)।");
            } else {
                 throw new Error("कृपया एक मौजूदा ग्राहक चुनें।");
            }
        }

        // 2. आइटम को मान्य करें और डेटा एकत्र करें (आपके मौजूदा कोड से)
        const items = [];
        const rows = orderItemsTableBody.querySelectorAll('.item-row');
        if (rows.length === 0) throw new Error("कृपया ऑर्डर में कम से कम एक आइटम जोड़ें।");
        let validationPassed = true;
        rows.forEach((row, idx) => {
            if (!validationPassed) return;
            const productNameInput = row.querySelector('.product-name');
            const unitTypeSelect = row.querySelector('.unit-type-select');
            const quantityInput = row.querySelector('.quantity-input');
            const rateInput = row.querySelector('.rate-input'); // यह एजेंट रेट इनपुट है
            const itemAmountSpan = row.querySelector('.item-amount');

            const productName = productNameInput?.value.trim();
            const unitType = unitTypeSelect?.value;
            const quantity = parseInt(quantityInput?.value || 0);
            const rate = parseFloat(rateInput?.value || ''); // यह एजेंट रेट है
            const itemAmount = parseFloat(itemAmountSpan?.textContent || 0);

            if (!productName) { validationPassed = false; showFormError(`आइटम ${idx + 1}: उत्पाद का नाम आवश्यक है।`); productNameInput?.focus(); return; }
            if (isNaN(quantity) || quantity <= 0) { validationPassed = false; showFormError(`आइटम ${idx + 1}: मात्रा एक सकारात्मक संख्या होनी चाहिए।`); quantityInput?.focus(); return; }
            if (isNaN(rate) || rate < 0) { validationPassed = false; showFormError(`आइटम ${idx + 1}: मान्य एजेंट दर आवश्यक है।`); rateInput?.focus(); return; }
            // आप यहाँ स्टॉक की भी जाँच कर सकते हैं यदि आवश्यक हो (productCache से)

            const itemData = { productName, unitType, quantity, rate, itemAmount };
            if (unitType === 'Sq Feet') { /* ... (Sq Ft विवरण पहले जैसा) ... */ }
            items.push(itemData);
        });
        if (!validationPassed) throw new Error("कृपया आइटम सूची में त्रुटियों को ठीक करें।");

        // 3. अन्य ऑर्डर विवरण एकत्र करें (पहले जैसा)
        // ... deliveryDateValue, remarksValue, urgentValue ...

        // 4. सारांश विवरण एकत्र करें (पहले जैसा)
        // ... subTotal, discountPercent, discountAmount, finalAmount ...

        // 5. Firestore पेलोड 'pendingAgentOrders' कलेक्शन के लिए
        const pendingOrderData = {
            agentId: currentUser.uid,
            agentEmail: agentPermissions.email || currentUser.email, // एजेंट दस्तावेज़ से ईमेल लें
            customerId: customerIdToUse,
            customerDetails: { // ऑर्डर के समय ग्राहक विवरण का स्नैपशॉट
                fullName: customerName,
                whatsappNo: customerWhatsapp,
                address: customerAddressInput.value.trim() || '',
                contactNo: customerContactInput.value.trim() || ''
            },
            deliveryDate: deliveryDateValue ? Timestamp.fromDate(new Date(deliveryDateValue + 'T00:00:00Z')) : null, // UTC मानें
            remarks: remarksValue,
            urgent: urgentValue,
            items: items,
            subTotal: subTotal,
            discountPercentage: discountPercent,
            discountAmount: discountAmount,
            finalAmount: finalAmount,
            status: "Pending Admin Approval", // प्रारंभिक स्थिति
            submittedAt: serverTimestamp()
        };

        // 6. 'pendingAgentOrders' कलेक्शन में सहेजें
        const pendingOrdersRef = collection(db, "pendingAgentOrders");
        const docRef = await addDoc(pendingOrdersRef, pendingOrderData);

        console.log("लंबित एजेंट ऑर्डर सफलतापूर्वक सबमिट किया गया:", docRef.id);
        alert(`ऑर्डर सफलतापूर्वक प्रोसेसिंग के लिए सबमिट किया गया! लंबित ID: ${docRef.id.substring(0,10)}...`);
        resetAgentOrderForm(true); // सब कुछ रीसेट करें

    } catch (error) {
        console.error("ऑर्डर सबमिशन विफल:", error);
        showFormError("ऑर्डर सबमिट करने में त्रुटि: " + error.message);
    } finally {
        if(saveOrderBtn) {
            saveOrderBtn.disabled = false;
            if(saveBtnSpan) saveBtnSpan.textContent = originalBtnText;
            if(saveBtnIcon) saveBtnIcon.className = 'fas fa-paper-plane';
        }
    }
}

function resetAgentOrderForm(clearAll = true) { /* ... (पहले जैसा) ... */ }
function preFetchCaches() { /* ... (पहले जैसा) ... */ }

console.log("agent_create_order.js लोड और तैयार है (v2)।");