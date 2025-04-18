// js/new_order.js

// Firestore फंक्शन्स प्राप्त करें (firebase init स्क्रिप्ट से)
const { db, collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where } = window;

// --- ग्लोबल वेरिएबल्स ---
let addedProducts = []; // जोड़े गए उत्पादों की सूची (एरे)
let isEditMode = false; // क्या यह एडिट मोड है?
let orderIdToEdit = null; // एडिट किए जा रहे ऑर्डर की Firestore ID
let selectedCustomerId = null; // ऑटो-कम्प्लीट से चुने गए ग्राहक की Firestore ID

// --- DOM एलिमेंट रेफरेंस ---
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
const customerContactInput = document.getElementById('contact_no'); // Contact No रखा गया है
const customerSuggestionsNameBox = document.getElementById('customer-suggestions-name');
const customerSuggestionsWhatsAppBox = document.getElementById('customer-suggestions-whatsapp');

const productNameInput = document.getElementById('product_name_input');
const quantityInput = document.getElementById('quantity_input');
const addProductBtn = document.getElementById('add-product-btn');
const productListContainer = document.getElementById('product-list');
const productSuggestionsBox = document.getElementById('product-suggestions');

const orderStatusCheckboxes = document.querySelectorAll('input[name="order_status"]');
const orderStatusGroup = document.getElementById('order-status-group'); // कंटेनर का रेफरेंस (स्टाइलिंग के लिए)

const whatsappReminderPopup = document.getElementById('whatsapp-reminder-popup');
const whatsappMsgPreview = document.getElementById('whatsapp-message-preview');
const whatsappSendLink = document.getElementById('whatsapp-send-link');
const popupCloseBtn = document.getElementById('popup-close-btn');

// --- इनिशियलाइज़ेशन (जब DOM लोड हो जाए) ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("New Order DOM Loaded. Initializing...");

    // DB कनेक्शन की प्रतीक्षा करें
    waitForDbConnection(initializeForm); // DB मिलने पर initializeForm() चलाएं

    // --- इवेंट लिस्नर जोड़ें ---
    if (orderForm) {
        orderForm.addEventListener('submit', handleFormSubmit);
    } else {
        console.error("FATAL: Order form (#newOrderForm) not found!");
    }

    if (addProductBtn) {
        addProductBtn.addEventListener('click', handleAddProduct);
    } else {
        console.error("Add product button (#add-product-btn) not found!");
    }

    if (productListContainer) {
        productListContainer.addEventListener('click', handleDeleteProduct); // डिलीट के लिए डेलिगेशन
    } else {
         console.error("Product list container (#product-list) not found!");
    }

    // --- ऑटो-कम्प्लीट लिस्नर ---
    if (customerNameInput) {
        customerNameInput.addEventListener('input', (e) => handleCustomerInput(e, 'name'));
    }
    if (customerWhatsAppInput) {
        customerWhatsAppInput.addEventListener('input', (e) => handleCustomerInput(e, 'whatsapp'));
    }
    if (productNameInput) {
        productNameInput.addEventListener('input', handleProductInput);
    }

     // --- पॉपअप लिस्नर ---
     if (popupCloseBtn) {
         popupCloseBtn.addEventListener('click', closeWhatsAppPopup);
     }
     if (whatsappReminderPopup) {
         whatsappReminderPopup.addEventListener('click', (event) => { // बैकग्राउंड क्लिक पर बंद करें
             if (event.target === whatsappReminderPopup) {
                 closeWhatsAppPopup();
             }
         });
     }
});

// --- DB कनेक्शन की प्रतीक्षा करने वाला फंक्शन ---
function waitForDbConnection(callback) {
    if (window.db) {
        console.log("DB connection confirmed immediately.");
        callback(); // DB पहले से है, कॉलबैक चलाएं
    } else {
        let attempts = 0;
        const maxAttempts = 20; // लगभग 5 सेकंड तक प्रतीक्षा करें
        const intervalId = setInterval(() => {
            attempts++;
            if (window.db) {
                clearInterval(intervalId);
                console.log("DB connection confirmed after check.");
                callback(); // DB मिला, कॉलबैक चलाएं
            } else if (attempts >= maxAttempts) {
                clearInterval(intervalId);
                console.error("DB connection timeout. Firebase might not be initialized correctly.");
                alert("Database connection failed. Please refresh the page or check console.");
            } else {
                console.log("Waiting for DB connection...");
            }
        }, 250); // हर 250ms पर जांचें
    }
}


// --- फॉर्म को इनिशियलाइज़ करें (एडिट बनाम नया मोड) ---
function initializeForm() {
    const urlParams = new URLSearchParams(window.location.search);
    orderIdToEdit = urlParams.get('editOrderId'); // Firestore डॉक्यूमेंट ID

    if (orderIdToEdit) {
        isEditMode = true;
        console.log("Edit Mode Initializing. Order Firestore ID:", orderIdToEdit);
        if(formHeader) formHeader.textContent = "ऑर्डर संपादित करें"; // हिंदी
        if(saveButtonText) saveButtonText.textContent = "ऑर्डर अपडेट करें"; // हिंदी
        if(hiddenEditOrderIdInput) hiddenEditOrderIdInput.value = orderIdToEdit;
        if(manualOrderIdInput) manualOrderIdInput.readOnly = true; // एडिट मोड में ID बदलने न दें

        loadOrderForEdit(orderIdToEdit); // मौजूदा डेटा लोड करें
        handleStatusCheckboxes(true); // स्टेटस चेकबॉक्स एनेबल करें

    } else {
        isEditMode = false;
        console.log("Add Mode Initializing.");
        if(formHeader) formHeader.textContent = "नया ऑर्डर"; // हिंदी
        if(saveButtonText) saveButtonText.textContent = "ऑर्डर सेव करें"; // हिंदी
        if(manualOrderIdInput) manualOrderIdInput.readOnly = false;

        // डिफ़ॉल्ट ऑर्डर की तारीख सेट करें
        const orderDateInput = document.getElementById('order_date');
        if (orderDateInput && !orderDateInput.value) {
            orderDateInput.value = new Date().toISOString().split('T')[0];
        }
        handleStatusCheckboxes(false); // नए ऑर्डर के लिए स्टेटस नियंत्रित करें
        renderProductList(); // शुरुआत में खाली प्रोडक्ट लिस्ट दिखाएं
        resetCustomerSelection(); // सुनिश्चित करें कि शुरुआत में कोई ग्राहक चयनित नहीं है
    }
}

// --- एडिट मोड के लिए ऑर्डर डेटा लोड करें ---
async function loadOrderForEdit(docId) {
    console.log(`Firestore से एडिट के लिए ऑर्डर डेटा लोड हो रहा है: ${docId}`);
    try {
        const orderRef = doc(db, "orders", docId);
        const docSnap = await getDoc(orderRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("एडिट के लिए ऑर्डर डेटा मिला:", data);

            // ग्राहक विवरण भरें
            customerNameInput.value = data.customerDetails?.fullName || '';
            customerAddressInput.value = data.customerDetails?.address || '';
            customerWhatsAppInput.value = data.customerDetails?.whatsappNo || '';
            customerContactInput.value = data.customerDetails?.contactNo || ''; // Contact No रखा गया है
            selectedCustomerId = data.customerId || null; // ग्राहक ID स्टोर करें
            if (selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId;


            // ऑर्डर विवरण भरें
            displayOrderIdInput.value = data.orderId || docId; // सिस्टम ID दिखाएं
            manualOrderIdInput.value = data.orderId || ''; // मैन्युअल फील्ड में भी दिखाएं (read-only)
            orderForm.order_date.value = data.orderDate || '';
            orderForm.delivery_date.value = data.deliveryDate || '';
            orderForm.remarks.value = data.remarks || '';

            // Urgent स्थिति सेट करें
            const urgentVal = data.urgent || 'No';
            const urgentRadio = orderForm.querySelector(`input[name="urgent"][value="${urgentVal}"]`);
            if (urgentRadio) urgentRadio.checked = true;

            // ऑर्डर स्टेटस चेकबॉक्स सेट करें
            orderStatusCheckboxes.forEach(cb => cb.checked = false);
            if (data.status) {
                const statusCheckbox = orderForm.querySelector(`input[name="order_status"][value="${data.status}"]`);
                if (statusCheckbox) statusCheckbox.checked = true;
            }

            // प्रोडक्ट लिस्ट भरें
            addedProducts = data.products || []; // ग्लोबल एरे में उत्पाद लोड करें
            renderProductList(); // उत्पादों को UI में दिखाएं

        } else {
            console.error("एडिट के लिए ऑर्डर डॉक्यूमेंट नहीं मिला!");
            alert("त्रुटि: संपादित करने के लिए ऑर्डर नहीं मिला।");
            window.location.href = 'order_history.html'; // वापस भेजें
        }
    } catch (error) {
        console.error("एडिट के लिए ऑर्डर लोड करने में त्रुटि:", error);
        alert("ऑर्डर डेटा लोड करने में त्रुटि: " + error.message);
        window.location.href = 'order_history.html';
    }
}


// --- उत्पाद हैंडलिंग फंक्शन्स ---

// उत्पाद को लिस्ट में जोड़ें
function handleAddProduct() {
    // उत्पाद का नाम ऑटो-कम्प्लीट से चुना जाना चाहिए (या मान्य होना चाहिए)
    // अभी के लिए, हम सीधे इनपुट मान लेते हैं, लेकिन इसे मान्य करना चाहिए
    const name = productNameInput.value.trim();
    const quantity = quantityInput.value.trim();

    if (!name) {
        alert("कृपया उत्पाद चुनें या नाम दर्ज करें।"); // हिंदी संदेश
        productNameInput.focus();
        return;
    }
    // --- यहाँ आप चाहें तो जांच सकते हैं कि 'name' आपकी products लिस्ट में है या नहीं ---
    // जैसे: if (!isValidProduct(name)) { alert('यह उत्पाद मान्य नहीं है।'); return; }

     if (!quantity || isNaN(quantity) || Number(quantity) <= 0) {
        alert("कृपया मान्य मात्रा दर्ज करें।"); // हिंदी संदेश
        quantityInput.focus();
        return;
    }

    // ग्लोबल एरे में जोड़ें
    addedProducts.push({ name: name, quantity: Number(quantity) });
    console.log("उत्पाद जोड़ा गया:", addedProducts);

    // UI लिस्ट अपडेट करें
    renderProductList();

    // अगले उत्पाद के लिए इनपुट फ़ील्ड्स खाली करें
    productNameInput.value = '';
    quantityInput.value = '';
    productNameInput.focus();
     // उत्पाद सुझाव साफ़ करें
    if (productSuggestionsBox) productSuggestionsBox.innerHTML = '';
}

// जोड़े गए उत्पादों की सूची को UI में दिखाएं
function renderProductList() {
    if (!productListContainer) return;
    productListContainer.innerHTML = ''; // वर्तमान सूची साफ़ करें

    if (addedProducts.length === 0) {
        productListContainer.innerHTML = '<p class="empty-list-message">अभी तक कोई उत्पाद नहीं जोड़ा गया है।</p>'; // हिंदी संदेश
        return;
    }

    addedProducts.forEach((product, index) => {
        const listItem = document.createElement('div');
        listItem.classList.add('product-list-item');
        listItem.innerHTML = `
            <span>${index + 1}. ${product.name} - मात्रा: ${product.quantity}</span>
            <button type="button" class="delete-product-btn" data-index="${index}" title="उत्पाद हटाएं"> <i class="fas fa-trash-alt"></i>
            </button>
        `;
        productListContainer.appendChild(listItem);
    });
}

// उत्पाद सूची से उत्पाद हटाएं
function handleDeleteProduct(event) {
    const deleteButton = event.target.closest('.delete-product-btn');
    if (deleteButton) {
        const indexToDelete = parseInt(deleteButton.dataset.index, 10);
        if (!isNaN(indexToDelete) && indexToDelete >= 0 && indexToDelete < addedProducts.length) {
            // पुष्टि पूछें (वैकल्पिक)
            // if (!confirm(`क्या आप उत्पाद "${addedProducts[indexToDelete].name}" को हटाना चाहते हैं?`)) {
            //     return;
            // }
            addedProducts.splice(indexToDelete, 1); // एरे से हटाएं
            console.log("उत्पाद हटाया गया:", addedProducts);
            renderProductList(); // UI लिस्ट अपडेट करें
        }
    }
}

// --- स्टेटस चेकबॉक्स हैंडलिंग ---
function handleStatusCheckboxes(isEditing) {
    const defaultStatus = "Order Received";
    let defaultCheckbox = null;

    orderStatusCheckboxes.forEach(checkbox => {
        if (checkbox.value === defaultStatus) {
            defaultCheckbox = checkbox;
        }
        // अगर एडिट मोड नहीं है तो डिसेबल करें
        checkbox.disabled = !isEditing;
        // CSS क्लास जोड़ें/हटाएं ताकि डिसेबल दिखें
         checkbox.closest('label').classList.toggle('disabled', !isEditing);
    });

    // नया ऑर्डर है तो 'Order Received' को चेक करें और एनेबल (या लॉक) रखें
    if (!isEditing && defaultCheckbox) {
        defaultCheckbox.checked = true;
        // आप चाहें तो इसे भी डिसेबल कर सकते हैं अगर यूजर इसे बदल न पाए
        // defaultCheckbox.disabled = true;
        // defaultCheckbox.closest('label').classList.add('disabled');
    }

     // यह सुनिश्चित करने के लिए कि एक समय में एक ही स्टेटस चुना जाए
     orderStatusCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                orderStatusCheckboxes.forEach(otherCb => {
                    if (otherCb !== checkbox) {
                        otherCb.checked = false;
                    }
                });
            }
            // यह जांचें कि कम से कम एक चेक हो (वैकल्पिक)
            const isAnyChecked = Array.from(orderStatusCheckboxes).some(cb => cb.checked);
            if (!isAnyChecked && defaultCheckbox) {
                 // अगर सभी अनचेक हो गए हैं, तो डिफ़ॉल्ट को फिर से चेक करें?
                 // defaultCheckbox.checked = true;
            }
        });
    });
}


// --- ऑटो-कम्प्लीट फंक्शन्स (प्लेसहोल्डर/ढांचा) ---

// कस्टमर इनपुट हैंडलर
let customerSearchTimeout;
function handleCustomerInput(event, type) {
    const searchTerm = event.target.value.trim();
    const suggestionBox = type === 'name' ? customerSuggestionsNameBox : customerSuggestionsWhatsAppBox;
    if (!suggestionBox) return;

    // पुराने सुझाव साफ़ करें
    suggestionBox.innerHTML = '';
    // अगर इनपुट बदला है, तो चयनित ग्राहक ID रीसेट करें
    resetCustomerSelection();


    if (searchTerm.length < 3) { // कम से कम 3 अक्षर पर खोजें
        clearTimeout(customerSearchTimeout); // पुराना टाइमआउट रद्द करें
        return;
    }

    // डिबाउंसिंग: टाइपिंग रुकने के कुछ देर बाद ही खोजें
    clearTimeout(customerSearchTimeout);
    customerSearchTimeout = setTimeout(() => {
        console.log(`Searching customers (${type}): ${searchTerm}`);
        fetchCustomerSuggestions(searchTerm, type, suggestionBox);
    }, 400); // 400ms प्रतीक्षा करें
}

// Firestore से कस्टमर सुझाव प्राप्त करें (असली क्वेरी की आवश्यकता)
async function fetchCustomerSuggestions(term, type, box) {
    box.innerHTML = '<ul><li>खोज रहा है...</li></ul>'; // हिंदी लोडिंग संदेश

    // Firestore क्वेरी (उदाहरण, इंडेक्स आवश्यक)
    const fieldToQuery = type === 'name' ? 'fullName' : 'whatsappNo';
    // Firestore 'starts with' क्वेरी थोड़ी जटिल होती है, अक्सर >= और <= का उपयोग किया जाता है
    const queryLower = term;
    const queryUpper = term + '\uf8ff'; // यह करैक्टर रेंज का अंत दर्शाता है

    try {
        if(!db || !collection || !query || !where || !orderBy || !getDocs) {
             throw new Error("Firestore functions not available.");
        }
        const customersRef = collection(db, "customers");
        const q = query(
            customersRef,
            where(fieldToQuery, ">=", queryLower),
            where(fieldToQuery, "<=", queryUpper),
            limit(5) // केवल 5 सुझाव दिखाएं
        );

        const querySnapshot = await getDocs(q);
        const suggestions = [];
        querySnapshot.forEach((doc) => {
            suggestions.push({ id: doc.id, ...doc.data() });
        });

        renderCustomerSuggestions(suggestions, term, box);

    } catch (error) {
        console.error(`Error fetching customer suggestions (${type}):`, error);
        box.innerHTML = '<ul><li style="color:red;">सुझाव लोड करने में त्रुटि</li></ul>'; // हिंदी एरर
    }
}

// कस्टमर सुझावों को दिखाएं
function renderCustomerSuggestions(suggestions, term, box) {
    if (suggestions.length === 0) {
        box.innerHTML = '<ul><li>कोई परिणाम नहीं मिला</li></ul>'; // हिंदी संदेश
        return;
    }

    const ul = document.createElement('ul');
    suggestions.forEach(cust => {
        const li = document.createElement('li');
        // मैचिंग हिस्से को बोल्ड करें (उदाहरण)
        const displayName = `${cust.fullName} (${cust.whatsappNo})`;
        li.innerHTML = displayName.replace(new RegExp(`(${term})`, 'gi'), '<strong>$1</strong>');
        li.dataset.customer = JSON.stringify(cust); // पूरा डेटा स्टोर करें
        li.addEventListener('click', () => {
            fillCustomerData(cust); // क्लिक पर डेटा भरें
            box.innerHTML = ''; // सुझाव छिपाएं
        });
        ul.appendChild(li);
    });
    box.innerHTML = ''; // पुराना कंटेंट हटाएं
    box.appendChild(ul);
}

// चयनित कस्टमर का डेटा फॉर्म में भरें
function fillCustomerData(customer) {
    console.log("Filling form with selected customer data:", customer);
    if (!customer) {
        resetCustomerSelection();
        return;
    }
    customerNameInput.value = customer.fullName || '';
    customerWhatsAppInput.value = customer.whatsappNo || '';
    customerAddressInput.value = customer.billingAddress || customer.address || ''; // दोनों फ़ील्ड नाम जांचें
    customerContactInput.value = customer.contactNo || ''; // Contact No रखा गया है

    selectedCustomerId = customer.id; // ग्राहक की Firestore ID स्टोर करें
    if(selectedCustomerIdInput) selectedCustomerIdInput.value = selectedCustomerId;

    // सुझाव बॉक्स साफ़ करें
    if (customerSuggestionsNameBox) customerSuggestionsNameBox.innerHTML = '';
    if (customerSuggestionsWhatsAppBox) customerSuggestionsWhatsAppBox.innerHTML = '';

     // पता और संपर्क फ़ील्ड्स को केवल पढ़ने योग्य (readonly) बनाएं ताकि यूजर इन्हें बदले नहीं
    customerAddressInput.readOnly = true;
    customerContactInput.readOnly = true;
}

// चयनित ग्राहक को रीसेट करें
function resetCustomerSelection() {
     selectedCustomerId = null;
     if(selectedCustomerIdInput) selectedCustomerIdInput.value = '';
     // पता और संपर्क फ़ील्ड्स को फिर से लिखने योग्य बनाएं
     customerAddressInput.readOnly = false;
     customerContactInput.readOnly = false;
     // आप चाहें तो इन फ़ील्ड्स को खाली भी कर सकते हैं
     // customerAddressInput.value = '';
     // customerContactInput.value = '';
}

// उत्पाद इनपुट हैंडलर
let productSearchTimeout;
function handleProductInput(event) {
    const searchTerm = event.target.value.trim();
    if (!productSuggestionsBox) return;

    productSuggestionsBox.innerHTML = ''; // पुराने सुझाव हटाएं

    if (searchTerm.length < 2) {
        clearTimeout(productSearchTimeout);
        return;
    }

    clearTimeout(productSearchTimeout);
    productSearchTimeout = setTimeout(() => {
        console.log("Searching products:", searchTerm);
        fetchProductSuggestions(searchTerm, productSuggestionsBox);
    }, 400);
}

// Firestore से उत्पाद सुझाव प्राप्त करें (असली क्वेरी की आवश्यकता)
async function fetchProductSuggestions(term, box) {
    box.innerHTML = '<ul><li>खोज रहा है...</li></ul>';

    // Firestore क्वेरी ('products' कलेक्शन, 'name' फ़ील्ड पर)
    const queryLower = term;
    const queryUpper = term + '\uf8ff';
    try {
         if(!db || !collection || !query || !where || !orderBy || !getDocs || !limit) {
             throw new Error("Firestore functions not available.");
        }
        const productsRef = collection(db, "products"); // मानें कि कलेक्शन का नाम 'products' है
        const q = query(
            productsRef,
            where("name", ">=", queryLower),
            where("name", "<=", queryUpper),
            limit(7) // 7 सुझाव दिखाएं
        );
        const querySnapshot = await getDocs(q);
        const suggestions = [];
        querySnapshot.forEach((doc) => {
            suggestions.push({ id: doc.id, ...doc.data() });
        });
        renderProductSuggestions(suggestions, term, box);
    } catch (error) {
        console.error("Error fetching product suggestions:", error);
        box.innerHTML = '<ul><li style="color:red;">उत्पाद सुझाव लोड करने में त्रुटि</li></ul>'; // हिंदी एरर
    }
}

// उत्पाद सुझावों को दिखाएं
function renderProductSuggestions(suggestions, term, box) {
    if (suggestions.length === 0) {
        box.innerHTML = '<ul><li>कोई उत्पाद नहीं मिला</li></ul>'; // हिंदी संदेश
        return;
    }
    const ul = document.createElement('ul');
    suggestions.forEach(prod => {
        const li = document.createElement('li');
        // मैचिंग हिस्से को बोल्ड करें
        li.innerHTML = prod.name.replace(new RegExp(`(${term})`, 'gi'), '<strong>$1</strong>');
        li.dataset.name = prod.name; // नाम स्टोर करें
        li.addEventListener('click', () => {
            productNameInput.value = prod.name; // क्लिक पर नाम भरें
            box.innerHTML = ''; // सुझाव छिपाएं
            // उत्पाद नाम फ़ील्ड को केवल पढ़ने योग्य बना दें ताकि यूजर इसे बदले नहीं (वैकल्पिक)
            // productNameInput.readOnly = true;
            quantityInput.focus(); // मात्रा फ़ील्ड पर फोकस करें
        });
        ul.appendChild(li);
    });
    box.innerHTML = '';
    box.appendChild(ul);
}

// --- फॉर्म सबमिट हैंडलर ---
async function handleFormSubmit(event) {
    event.preventDefault();
    console.log("Form सबमिशन प्रक्रिया शुरू...");

    // जांचें कि क्या DB फंक्शन उपलब्ध हैं
    if (!db || !collection || !addDoc || !doc || !updateDoc || !getDoc || !getDocs || !query || !where) {
        alert("डेटाबेस फंक्शन उपलब्ध नहीं हैं। सेव नहीं किया जा सकता।");
        console.error("Form सबमिट विफल: DB फंक्शन गायब हैं।");
        return;
    }
    if (!saveButton) return;

    // सेव बटन को डिसेबल करें और लोडिंग दिखाएं
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> सेव हो रहा है...'; // हिंदी टेक्स्ट

    try {
        // 1. फॉर्म डेटा प्राप्त करें
        const formData = new FormData(orderForm);
        const customerData = {
            fullName: formData.get('full_name')?.trim() || '',
            address: formData.get('address')?.trim() || '',
            whatsappNo: formData.get('whatsapp_no')?.trim() || '',
            contactNo: formData.get('contact_no')?.trim() || '' // Contact No शामिल
        };
        const orderDetails = {
            manualOrderId: formData.get('manual_order_id')?.trim() || '',
            orderDate: formData.get('order_date') || '',
            deliveryDate: formData.get('delivery_date') || '',
            urgent: formData.get('urgent') || 'No',
            remarks: formData.get('remarks')?.trim() || ''
        };
        const statusCheckbox = orderForm.querySelector('input[name="order_status"]:checked');
        // यदि एडिट मोड है और कोई स्टेटस नहीं चुना है, तो एरर दें; यदि नया है, तो 'Order Received' डिफ़ॉल्ट करें
        const selectedStatus = statusCheckbox ? statusCheckbox.value : (isEditMode ? null : 'Order Received');

        // 2. सत्यापन (Validation)
        if (!customerData.fullName) throw new Error("पूरा नाम आवश्यक है।");
        if (!customerData.whatsappNo) throw new Error("व्हाट्सएप नंबर आवश्यक है।");
        if (!selectedCustomerId && isEditMode) throw new Error("ग्राहक डेटा लोड नहीं हुआ या चयनित नहीं है। कृपया ग्राहक फिर से चुनें।"); // एडिट मोड में कस्टमर ID होना चाहिए
        if (!selectedCustomerId && !isEditMode) throw new Error("कृपया मौजूदा ग्राहक सूची से चुनें। नया ग्राहक यहाँ से नहीं जोड़ा जा सकता।"); // Add मोड में भी चयन आवश्यक
        if (addedProducts.length === 0) throw new Error("कम से कम एक उत्पाद जोड़ना आवश्यक है।");
        if (!orderDetails.orderDate) throw new Error("ऑर्डर की तारीख आवश्यक है।");
        if (!selectedStatus) throw new Error("कृपया ऑर्डर स्टेटस चुनें।"); // अब दोनों मोड में ज़रूरी (क्योंकि नया मोड डिफ़ॉल्ट है)


        // 3. कस्टमर ID प्राप्त करें (पहले से selectedCustomerId में स्टोर होना चाहिए)
        const customerIdToUse = selectedCustomerId;
        if (!customerIdToUse) {
            // यह स्थिति नहीं आनी चाहिए अगर ऊपर का सत्यापन काम कर रहा है
            throw new Error("ग्राहक ID नहीं मिला। कृपया ग्राहक चुनें।");
        }
        // कस्टमर डॉक्यूमेंट को अपडेट करने की आवश्यकता नहीं है क्योंकि हमने उसे चुनते समय किया होगा (या अलग से मैनेज करें)


        // 4. ऑर्डर डेटा पेलोड तैयार करें
        let orderIdToUse;
        if (isEditMode) {
            orderIdToUse = displayOrderIdInput.value; // मौजूदा सिस्टम ID
        } else {
            orderIdToUse = orderDetails.manualOrderId || Date.now().toString(); // मैन्युअल या ऑटो-जनरेटेड
        }

        const orderDataPayload = {
            orderId: orderIdToUse,
            customerId: customerIdToUse, // सहेजा हुआ कस्टमर ID
            customerDetails: { // आसान प्रदर्शन के लिए ग्राहक विवरण स्टोर करें
                fullName: customerData.fullName,
                address: customerData.address,
                whatsappNo: customerData.whatsappNo,
                contactNo: customerData.contactNo
            },
            orderDate: orderDetails.orderDate,
            deliveryDate: orderDetails.deliveryDate,
            urgent: orderDetails.urgent,
            remarks: orderDetails.remarks,
            status: selectedStatus,
            products: addedProducts, // जोड़े गए उत्पादों की सूची
            updatedAt: new Date() // अपडेट का समय
        };

        // 5. Firestore में सेव/अपडेट करें
        let orderDocRef;
        if (isEditMode) {
            // ऑर्डर अपडेट करें
            orderDocRef = doc(db, "orders", orderIdToEdit); // Firestore डॉक्यूमेंट ID का उपयोग करें
            await updateDoc(orderRef, orderDataPayload);
            console.log("ऑर्डर सफलतापूर्वक अपडेट हुआ:", orderIdToEdit);
            alert('ऑर्डर सफलतापूर्वक अपडेट हुआ!'); // हिंदी संदेश

        } else {
            // नया ऑर्डर जोड़ें
            orderDataPayload.createdAt = new Date(); // बनाने का समय जोड़ें
            orderDocRef = await addDoc(collection(db, "orders"), orderDataPayload);
            console.log("नया ऑर्डर सफलतापूर्वक सेव हुआ, ID:", orderDocRef.id);
            alert('नया ऑर्डर सफलतापूर्वक सेव हुआ!'); // हिंदी संदेश
            // अपडेट display_order_id ताकि यूजर को पता चले
            displayOrderIdInput.value = orderIdToUse;
        }

        // 6. (प्लेसहोल्डर) डेली रिपोर्ट में सेव करें
        await saveToDailyReport(orderDataPayload);

        // 7. व्हाट्सएप रिमाइंडर पॉपअप दिखाएं
        showWhatsAppReminder(customerData, orderIdToUse, orderDetails.deliveryDate);

        // 8. यदि नया ऑर्डर था, तो फॉर्म रीसेट करें (वैकल्पिक)
        if (!isEditMode) {
            // orderForm.reset(); // पूरा फॉर्म रीसेट करें
            // या सिर्फ कुछ फ़ील्ड्स रीसेट करें:
            resetCustomerSelection(); // ग्राहक चयन रीसेट करें
            customerNameInput.value = '';
            customerWhatsAppInput.value = '';
            manualOrderIdInput.value = '';
            displayOrderIdInput.value = '';
            orderDetails.deliveryDate.value = ''; // तारीखें चाहें तो रीसेट करें
            orderDetails.remarks.value = '';
            addedProducts = []; // उत्पाद सूची खाली करें
            renderProductList(); // खाली सूची दिखाएं
            handleStatusCheckboxes(false); // स्टेटस डिफ़ॉल्ट पर सेट करें
             const urgentNoRadio = orderForm.querySelector('input[name="urgent"][value="No"]');
             if (urgentNoRadio) urgentNoRadio.checked = true; // Urgent डिफ़ॉल्ट करें
        }

    } catch (error) {
        console.error("ऑर्डर सेव/अपडेट करने में त्रुटि:", error);
        alert("त्रुटि: " + error.message); // स्पष्ट एरर संदेश दिखाएं
    } finally {
        // सेव बटन को फिर से एनेबल करें और टेक्स्ट रीसेट करें
        saveButton.disabled = false;
        const buttonText = isEditMode ? "ऑर्डर अपडेट करें" : "ऑर्डर सेव करें"; // हिंदी
         saveButton.innerHTML = `<i class="fas fa-save"></i> <span>${buttonText}</span>`;
    }
}

// --- पोस्ट-सेव फंक्शन्स (प्लेसहोल्डर) ---

// (प्लेसहोल्डर) डेली रिपोर्ट में सेव करें
async function saveToDailyReport(orderData) {
    console.log("Placeholder: Saving order to daily_reports collection...", orderData);
    try {
         if(!db || !collection || !addDoc) throw new Error("Firestore functions missing");
         // मान लें कि कलेक्शन का नाम 'daily_reports' है
         // आप चाहें तो इसमें सिर्फ ज़रूरी फील्ड्स ही सेव कर सकते हैं
         // await addDoc(collection(db, "daily_reports"), orderData);
         console.log("Placeholder: Successfully saved to daily_reports.");
    } catch (error) {
        console.error("Placeholder: Error saving to daily_reports:", error);
        // शायद यूजर को बताने की ज़रूरत नहीं है अगर यह बैकग्राउंड प्रक्रिया है
    }
}

// व्हाट्सएप रिमाइंडर पॉपअप दिखाएं
function showWhatsAppReminder(customer, orderId, deliveryDate) {
    if (!whatsappReminderPopup || !whatsappMsgPreview || !whatsappSendLink) {
        console.error("WhatsApp popup elements not found.");
        return;
    }

    const customerName = customer.fullName || 'Customer';
    const customerNumber = customer.whatsappNo.replace(/[^0-9]/g, ''); // सिर्फ नंबर रखें
    if (!customerNumber) {
        console.warn("Cannot show WhatsApp reminder, customer number is missing.");
        return;
    }

    // संदेश बनाएं (आप इसे बदल सकते हैं)
    let message = `नमस्ते ${customerName},\n`;
    message += `आपका ऑर्डर (ID: ${orderId}) हमें सफलतापूर्वक प्राप्त हुआ है।\n`;
    if (deliveryDate) {
        message += `अनुमानित डिलीवरी की तारीख ${deliveryDate} है।\n`;
    }
    message += `धन्यवाद!`; // आप अपनी दुकान का नाम जोड़ सकते हैं

    // पॉपअप में प्रीव्यू दिखाएं
    whatsappMsgPreview.innerText = message;

    // व्हाट्सएप लिंक बनाएं (wa.me)
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customerNumber}?text=${encodedMessage}`;
    whatsappSendLink.href = whatsappUrl;

    // पॉपअप दिखाएं
    whatsappReminderPopup.classList.add('active');
    console.log("WhatsApp reminder popup shown.");
}

// व्हाट्सएप पॉपअप बंद करें
function closeWhatsAppPopup() {
     if (whatsappReminderPopup) {
        whatsappReminderPopup.classList.remove('active');
     }
}