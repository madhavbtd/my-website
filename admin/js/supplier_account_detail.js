// js/supplier_account_detail.js
// संस्करण: स्टेज 1 - पेमेंट मोडाल UI अपडेट, नई CSS लिंक, चेकबॉक्स तैयारी

// --- Firebase फ़ंक्शन आयात करें ---
import { db, auth } from './firebase-init.js';
import {
    doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp,
    addDoc, serverTimestamp, updateDoc, runTransaction, onSnapshot // <<< onSnapshot जोड़ा गया
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- ग्लोबल वेरिएबल्स ---
let currentSupplierId = null;
let currentSupplierData = null;
let purchaseOrdersData = []; // सभी POs का डेटा स्टोर करने के लिए
let pendingPOsData = []; // सिर्फ़ पेंडिंग (Sent/Partially Paid) POs का डेटा
let paymentsData = []; // भुगतान डेटा स्टोर करने के लिए
let poListener = null; // POs के लिए लिस्नर
let paymentListener = null; // भुगतानों के लिए लिस्नर

// --- DOM एलिमेंट रेफरेंस ---
// (मुख्य पेज एलिमेंट्स)
const supplierNameBreadcrumb = document.getElementById('supplierNameBreadcrumb');
const supplierNameHeader = document.getElementById('supplierNameHeader');
const detailSupplierId = document.getElementById('detailSupplierId');
const detailSupplierName = document.getElementById('detailSupplierName');
const detailSupplierCompany = document.getElementById('detailSupplierCompany');
const detailSupplierWhatsapp = document.getElementById('detailSupplierWhatsapp');
const detailSupplierEmail = document.getElementById('detailSupplierEmail');
const detailSupplierGst = document.getElementById('detailSupplierGst');
const detailSupplierAddress = document.getElementById('detailSupplierAddress');
const detailAddedOn = document.getElementById('detailAddedOn');
const summaryTotalPoValue = document.getElementById('summaryTotalPoValue');
const summaryTotalPaid = document.getElementById('summaryTotalPaid');
const summaryBalance = document.getElementById('summaryBalance');
const supplierPoTableBody = document.getElementById('supplierPoTableBody');
const supplierPoLoading = document.getElementById('supplierPoLoading');
const noSupplierPoMessage = document.getElementById('noSupplierPoMessage');
const transactionsTableBody = document.getElementById('transactionsTableBody');
const transactionsLoading = document.getElementById('transactionsLoading');
const noTransactionsMessage = document.getElementById('noTransactionsMessage');
const loadingIndicator = document.getElementById('loadingIndicator');
const generalErrorDisplay = document.getElementById('generalErrorDisplay');
const supplierPoListError = document.getElementById('supplierPoListError');
const supplierPaymentListError = document.getElementById('supplierPaymentListError');

// (बटन्स)
const addPaymentMadeBtn = document.getElementById('addPaymentMadeBtn');
const editSupplierDetailsBtn = document.getElementById('editSupplierDetailsBtn');

// (पेमेंट मोडाल एलिमेंट्स)
const paymentMadeModal = document.getElementById('paymentMadeModal');
const closePaymentMadeModalBtn = document.getElementById('closePaymentMadeModalBtn');
const paymentSupplierName = document.getElementById('paymentSupplierName');
const paymentMadeForm = document.getElementById('paymentMadeForm');
const paymentMadeError = document.getElementById('paymentMadeError');
const paymentAmountInput = document.getElementById('paymentAmount');
const paymentDateInput = document.getElementById('paymentDate');
const poCheckboxContainer = document.getElementById('poCheckboxContainer'); // <<< नया एलिमेंट
const selectedPoSummary = document.getElementById('selectedPoSummary');   // <<< नया एलिमेंट
const suggestedPosContainer = document.getElementById('suggestedPosContainer'); // <<< नया एलिमेंट
const paymentMethodSelect = document.getElementById('paymentMethod');
const paymentNotesInput = document.getElementById('paymentNotes');
const savePaymentBtn = document.getElementById('savePaymentBtn');
const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');

// (एडिट सप्लायर मोडाल एलिमेंट्स)
const editSupplierModal = document.getElementById('editSupplierModal');
const closeEditSupplierBtn = document.getElementById('closeEditSupplierBtn');
const editSupplierForm = document.getElementById('editSupplierForm');
const editSupplierError = document.getElementById('editSupplierError');
const editSupplierNameInput = document.getElementById('editSupplierNameInput');
const editSupplierCompanyInput = document.getElementById('editSupplierCompanyInput');
const editSupplierWhatsappInput = document.getElementById('editSupplierWhatsappInput');
const editSupplierContactInput = document.getElementById('editSupplierContactInput'); // Assuming it exists if needed
const editSupplierEmailInput = document.getElementById('editSupplierEmailInput');
const editSupplierGstInput = document.getElementById('editSupplierGstInput');
const editSupplierAddressInput = document.getElementById('editSupplierAddressInput');
const editingSupplierIdInput = document.getElementById('editingSupplierId');
const updateSupplierBtn = document.getElementById('updateSupplierBtn');
const cancelEditSupplierBtn = document.getElementById('cancelEditSupplierBtn');

// --- Helper Functions ---
function displayError(message, elementId = 'generalErrorDisplay') {
    console.error("Displaying Error:", message);
    try {
        // Try specific error elements first, then fall back
        let errorElement = document.getElementById(elementId);
        // Stage 1: Ensure modal error elements are checked
        if (!errorElement && elementId === 'paymentMadeError') errorElement = document.getElementById('paymentMadeError');
        if (!errorElement && elementId === 'editSupplierError') errorElement = document.getElementById('editSupplierError');
        if (!errorElement) errorElement = document.getElementById('supplierPaymentListError');
        if (!errorElement) errorElement = document.getElementById('supplierPoListError');
        if (!errorElement) errorElement = document.getElementById('generalErrorDisplay'); // Fallback

        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        } else {
            console.error(`Error element with ID '${elementId}' or fallback not found.`);
            alert(`Error: ${message}`); // Fallback alert
        }
    } catch (e) {
        console.error("Exception in displayError:", e);
        alert(`Error displaying error message: ${message}`);
    }
}

function clearError(elementId = 'generalErrorDisplay') {
     try {
        let errorElement = document.getElementById(elementId);
         if (!errorElement && elementId === 'paymentMadeError') errorElement = document.getElementById('paymentMadeError');
         if (!errorElement && elementId === 'editSupplierError') errorElement = document.getElementById('editSupplierError');
         if (!errorElement) errorElement = document.getElementById('supplierPaymentListError');
         if (!errorElement) errorElement = document.getElementById('supplierPoListError');
         if (!errorElement) errorElement = document.getElementById('generalErrorDisplay');

        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
     } catch(e){
        console.error("Exception in clearError:", e);
     }
}

function formatDate(timestamp) {
    if (!timestamp) return '-';
    // Firestore Timestamp से JavaScript Date ऑब्जेक्ट में बदलें
    const date = timestamp.toDate();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // महीने 0-आधारित होते हैं
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

function formatCurrency(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return '₹ 0.00'; // या '-' या कोई अन्य प्लेसहोल्डर
    }
    // भारतीय करेंसी फॉर्मेट (INR)
    return amount.toLocaleString('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// --- लोडिंग स्टेट हैंडलिंग ---
function showLoading(isLoading) {
    if (loadingIndicator) {
        loadingIndicator.style.display = isLoading ? 'block' : 'none';
    }
}

// --- मोडाल हैंडलिंग फंक्शन्स (स्टेज 1 अपडेट) ---

// Helper to close any modal
function closeModal(modalElement) {
    if (modalElement) {
        modalElement.classList.remove('active');
        // Use setTimeout to allow animation before setting display to none
        setTimeout(() => {
             if (!modalElement.classList.contains('active')) { // Double check if opened again quickly
                 modalElement.style.display = 'none';
             }
        }, 300); // Adjust timing based on CSS transition if any
    }
}

// Helper to open any modal
function openModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'flex';
         // Force reflow before adding class to ensure transition happens
        void modalElement.offsetWidth;
        modalElement.classList.add('active');
    }
}

// नया: पेमेंट मोडाल खोलना (स्टेज 1 अपडेट)
function openPaymentModal() {
    if (!currentSupplierData) {
        displayError("Supplier data not loaded yet. Cannot open payment modal.");
        return;
    }
    clearError('paymentMadeError'); // पिछला एरर साफ करें
    paymentMadeForm.reset(); // फॉर्म रीसेट करें
    // डायनामिक एरिया साफ करें
    poCheckboxContainer.innerHTML = '<p class="loading-state">Loading POs...</p>'; // प्लेसहोल्डर दिखाएं
    selectedPoSummary.innerHTML = '<p>No POs selected.</p>'; // प्लेसहोल्डर रीसेट करें
    suggestedPosContainer.innerHTML = '<p>Enter an amount to see suggestions.</p>'; // प्लेसहोल्डर रीसेट करें
    suggestedPosContainer.style.display = 'none'; // छिपाएं

    paymentSupplierName.textContent = currentSupplierData.name || 'Supplier'; // सप्लायर का नाम सेट करें
    paymentDateInput.valueAsDate = new Date(); // आज की तारीख सेट करें

    // पेंडिंग POs को पॉप्युलेट करने के लिए फंक्शन कॉल करें (स्टेज 1: बस तैयारी)
    preparePoCheckboxes();

    openModal(paymentMadeModal); // मोडाल दिखाएं
    console.log("Payment Modal Opened");
}

// नया: पेमेंट मोडाल बंद करना (स्टेज 1 अपडेट)
function closePaymentModal() {
    closeModal(paymentMadeModal);
    console.log("Payment Modal Closed");
     // Optionally clear fields again, although reset in open should handle it
     paymentMadeForm.reset();
     poCheckboxContainer.innerHTML = ''; // Clean up dynamic content
     selectedPoSummary.innerHTML = '';
     suggestedPosContainer.innerHTML = '';
     clearError('paymentMadeError');
}

// नया: PO चेकबॉक्स एरिया तैयार करना (स्टेज 1)
function preparePoCheckboxes() {
    // स्टेज 1 में, यह फ़ंक्शन केवल यह सुनिश्चित करता है कि कंटेनर तैयार है।
    // वास्तविक PO लोडिंग और चेकबॉक्स निर्माण स्टेज 2 में `populatePoCheckboxes` में होगा।
    // अभी के लिए, हम केवल जांच सकते हैं कि क्या पहले से लोड किए गए डेटा में पेंडिंग PO हैं।
    pendingPOsData = purchaseOrdersData.filter(po => po.status === 'Sent' || po.status === 'Partially Paid');

    if (pendingPOsData.length > 0) {
        poCheckboxContainer.innerHTML = '<p class="loading-state">Loading PO options...</p>';
        // स्टेज 2 में यहाँ से वास्तविक पॉप्युलेशन कॉल होगा।
         console.log("Pending POs found, ready for Stage 2 population.");
    } else if (purchaseOrdersData.length > 0) {
         poCheckboxContainer.innerHTML = '<p class="no-pos-message">No pending POs available to link.</p>';
    } else {
        // If purchaseOrdersData itself is empty or not loaded yet
         poCheckboxContainer.innerHTML = '<p class="loading-state">Loading PO data...</p>';
    }
}

// स्टब: एडिट सप्लायर मोडाल खोलना
function openEditSupplierModal() {
    if (!currentSupplierData) {
        displayError("Supplier data not loaded yet. Cannot open edit modal.");
        return;
    }
     clearError('editSupplierError');
     editSupplierForm.reset();

     console.warn("openEditSupplierModal not fully implemented - Populating fields is needed.");
     // Populate fields from currentSupplierData (to be added in later stage)
     editSupplierNameInput.value = currentSupplierData.name || '';
     editSupplierCompanyInput.value = currentSupplierData.company || '';
     editSupplierWhatsappInput.value = currentSupplierData.whatsappNumber || '';
     // editSupplierContactInput.value = currentSupplierData.contactNumber || ''; // Add if needed
     editSupplierEmailInput.value = currentSupplierData.email || '';
     editSupplierGstInput.value = currentSupplierData.gstNumber || '';
     editSupplierAddressInput.value = currentSupplierData.address || '';
     editingSupplierIdInput.value = currentSupplierId;

     openModal(editSupplierModal);
}

// स्टब: एडिट सप्लायर मोडाल बंद करना
function closeEditSupplierModal() {
    closeModal(editSupplierModal);
     console.log("Edit Supplier Modal Closed");
     clearError('editSupplierError');
}


// --- डेटा लोडिंग और डिस्प्ले ---

// सप्लायर डिटेल्स डिस्प्ले करना
function displaySupplierDetails(supplierData) {
    currentSupplierData = supplierData; // ग्लोबल वेरिएबल अपडेट करें

    // Update breadcrumb and header
    const name = supplierData.name || 'N/A';
    if (supplierNameBreadcrumb) supplierNameBreadcrumb.textContent = name;
    if (supplierNameHeader) supplierNameHeader.textContent = name;

    // Update info box
    if (detailSupplierId) detailSupplierId.textContent = currentSupplierId || '-';
    if (detailSupplierName) detailSupplierName.textContent = name;
    if (detailSupplierCompany) detailSupplierCompany.textContent = supplierData.company || '-';
    if (detailSupplierWhatsapp) detailSupplierWhatsapp.textContent = supplierData.whatsappNumber || '-';
    if (detailSupplierEmail) detailSupplierEmail.textContent = supplierData.email || '-';
    if (detailSupplierGst) detailSupplierGst.textContent = supplierData.gstNumber || '-';
    if (detailSupplierAddress) detailSupplierAddress.textContent = supplierData.address || '-';
    if (detailAddedOn) detailAddedOn.textContent = supplierData.addedOn ? formatDate(supplierData.addedOn) : '-';

    // Update Payment Modal Supplier Name span if modal exists
    if (paymentSupplierName) {
        paymentSupplierName.textContent = name;
    }
}

// PO स्थिति के लिए बैज क्लास प्राप्त करना
function getStatusBadgeClass(status) {
    switch (status?.toLowerCase()) {
        case 'new': return 'status-new';
        case 'sent': return 'status-sent';
        case 'partially paid': return 'status-partially-paid';
        case 'paid': return 'status-paid';
        case 'pending': return 'status-pending'; // हो सकता है उपयोग में न हो, पर सुरक्षित है
        default: return 'status-unknown';
    }
}
// भुगतान स्थिति के लिए बैज क्लास प्राप्त करना
function getPaymentStatusBadgeClass(paymentStatus) {
     switch (paymentStatus?.toLowerCase()) {
        case 'partially paid': return 'payment-status-partially-paid';
        case 'paid': return 'payment-status-paid';
        case 'pending': return 'payment-status-pending'; // PO के लिए स्थिति
        default: return 'status-unknown';
    }
}

// PO टेबल डिस्प्ले करना
function displayPurchaseOrders(pos) {
    if (!supplierPoTableBody) return;
    supplierPoTableBody.innerHTML = ''; // टेबल साफ करें
    purchaseOrdersData = pos; // ग्लोबल डेटा अपडेट करें

    if (pos.length === 0) {
        noSupplierPoMessage.style.display = 'table-row';
        supplierPoLoading.style.display = 'none';
        return;
    }

    noSupplierPoMessage.style.display = 'none';
    supplierPoLoading.style.display = 'none';

    let totalPoValue = 0;

    pos.forEach(po => {
        totalPoValue += po.totalAmount || 0;

        const row = supplierPoTableBody.insertRow();
        row.dataset.poId = po.id; // PO आईडी स्टोर करें

        row.insertCell().textContent = po.poNumber || 'N/A';
        row.insertCell().textContent = po.orderDate ? formatDate(po.orderDate) : '-';
        row.insertCell().textContent = formatCurrency(po.totalAmount);
        row.cells[2].classList.add('amount-po'); // राशि के लिए क्लास

        // Status Badge
        const statusCell = row.insertCell();
        const statusBadge = document.createElement('span');
        statusBadge.textContent = po.status || 'Unknown';
        statusBadge.className = `status-badge ${getStatusBadgeClass(po.status)}`;
        statusCell.appendChild(statusBadge);

        // Payment Status Badge
        const paymentStatusCell = row.insertCell();
        const paymentStatusBadge = document.createElement('span');
        paymentStatusBadge.textContent = po.paymentStatus || 'N/A'; // Default to N/A
         paymentStatusBadge.className = `status-badge ${getPaymentStatusBadgeClass(po.paymentStatus)}`;
        paymentStatusCell.appendChild(paymentStatusBadge);

        // Actions Cell (अभी के लिए खाली या व्यू बटन)
        const actionsCell = row.insertCell();
         // आप भविष्य में यहाँ PO देखने या संपादित करने के लिए बटन जोड़ सकते हैं
         actionsCell.innerHTML = `<button class="button small-button info-button" onclick="viewPoDetails('${po.id}')" title="View Details"><i class="fas fa-eye"></i></button>`;
    });

    // कुल PO मान अपडेट करें
    if (summaryTotalPoValue) {
        summaryTotalPoValue.textContent = formatCurrency(totalPoValue);
        summaryTotalPoValue.classList.remove('loading-state');
    }

    updateAccountSummary(); // भुगतान लोड होने के बाद समरी अपडेट करें
}

// भुगतान टेबल डिस्प्ले करना
function displayPayments(payments) {
     if (!transactionsTableBody) return;
    transactionsTableBody.innerHTML = ''; // टेबल साफ करें
    paymentsData = payments; // ग्लोबल डेटा अपडेट करें

    if (payments.length === 0) {
        noTransactionsMessage.style.display = 'table-row';
        transactionsLoading.style.display = 'none';
        return;
    }

    noTransactionsMessage.style.display = 'none';
    transactionsLoading.style.display = 'none';

    let totalPaid = 0;

    payments.forEach(payment => {
        totalPaid += payment.amount || 0;
        const row = transactionsTableBody.insertRow();
        row.dataset.paymentId = payment.id; // पेमेंट आईडी स्टोर करें

        row.insertCell().textContent = payment.paymentDate ? formatDate(payment.paymentDate) : '-';
        row.insertCell().textContent = payment.notes || '-';
        row.insertCell().textContent = payment.paymentMethod || 'N/A';

        // लिंक्ड POs दिखाएं
        const linkedPoCell = row.insertCell();
        if (payment.linkedPoIds && payment.linkedPoIds.length > 0) {
             // PO नंबर प्राप्त करने का प्रयास करें (यदि PO डेटा लोड हो गया है)
             const poNumbers = payment.linkedPoIds.map(poId => {
                 const po = purchaseOrdersData.find(p => p.id === poId);
                 return po ? `#${po.poNumber}` : poId.substring(0, 6) + '...'; // फॉलबैक आईडी
             }).join(', ');
             linkedPoCell.textContent = poNumbers;
        } else {
             linkedPoCell.textContent = 'Direct Payment';
        }

        row.insertCell().textContent = formatCurrency(payment.amount);
        row.cells[4].classList.add('amount-paid');

        // Actions Cell (जैसे पेमेंट हटाना - बाद के स्टेज में)
        const actionsCell = row.insertCell();
        actionsCell.innerHTML = `<button class="button small-button danger-button" onclick="deletePayment('${payment.id}')" title="Delete Payment"><i class="fas fa-trash"></i></button>`; // प्लेसहोल्डर
    });

    // कुल भुगतान अपडेट करें
    if (summaryTotalPaid) {
        summaryTotalPaid.textContent = formatCurrency(totalPaid);
        summaryTotalPaid.classList.remove('loading-state');
    }

    updateAccountSummary(); // समरी अपडेट करें
}

// अकाउंट समरी अपडेट करना
function updateAccountSummary() {
     if (!summaryTotalPoValue || !summaryTotalPaid || !summaryBalance) return;
     if(summaryTotalPoValue.classList.contains('loading-state') || summaryTotalPaid.classList.contains('loading-state')) {
         // अगर कोई डेटा अभी लोड हो रहा है, तो प्रतीक्षा करें
         if (summaryBalance) {
             summaryBalance.textContent = 'Calculating...';
             summaryBalance.className = 'balance-info loading-state';
         }
         return;
     }

     // स्ट्रिंग से नंबर निकालें (उदाहरण: "₹ 1,000.00" से 1000.00)
     const totalPO = parseFloat(summaryTotalPoValue.textContent.replace(/[^0-9.-]+/g, "")) || 0;
     const totalPaid = parseFloat(summaryTotalPaid.textContent.replace(/[^0-9.-]+/g, "")) || 0;
     const balance = totalPO - totalPaid;

     if (summaryBalance) {
        summaryBalance.textContent = formatCurrency(balance);
        summaryBalance.classList.remove('loading-state');
         if (balance > 0) {
             summaryBalance.className = 'balance-info balance-due'; // बकाया
         } else if (balance < 0) {
             summaryBalance.className = 'balance-info balance-credit'; // क्रेडिट
         } else {
             summaryBalance.className = 'balance-info balance-zero'; // शून्य
         }
     }
}


// --- Firestore Data Fetching with Realtime Updates ---

// सप्लायर की मुख्य जानकारी लोड करना
async function loadSupplierBaseData(supplierId) {
    const supplierRef = doc(db, "suppliers", supplierId);
    try {
        const docSnap = await getDoc(supplierRef);
        if (docSnap.exists()) {
            displaySupplierDetails({ id: docSnap.id, ...docSnap.data() });
        } else {
            displayError("Supplier not found.");
            showLoading(false);
        }
    } catch (error) {
        console.error("Error loading supplier details:", error);
        displayError("Failed to load supplier details. Please check console.");
        showLoading(false);
    }
}

// सप्लायर के POs लोड करना (Realtime)
function loadPurchaseOrders(supplierId) {
    if (poListener) poListener(); // पिछला लिस्नर हटाएं
    clearError('supplierPoListError');
    supplierPoLoading.style.display = 'table-row';
    noSupplierPoMessage.style.display = 'none';
    summaryTotalPoValue.textContent = 'Calculating...';
    summaryTotalPoValue.classList.add('loading-state');
    summaryBalance.textContent = 'Calculating...';
    summaryBalance.classList.add('loading-state');

    const posQuery = query(
        collection(db, "purchase_orders"),
        where("supplierId", "==", supplierId),
        orderBy("orderDate", "desc")
    );

    poListener = onSnapshot(posQuery, (querySnapshot) => {
        const pos = [];
        querySnapshot.forEach((doc) => {
            pos.push({ id: doc.id, ...doc.data() });
        });
        displayPurchaseOrders(pos);
        supplierPoLoading.style.display = 'none';
        clearError('supplierPoListError'); // एरर साफ करें अगर सब ठीक है
    }, (error) => {
        console.error("Error fetching purchase orders in real-time: ", error);
        displayError("Failed to load purchase orders.", 'supplierPoListError');
        supplierPoLoading.style.display = 'none';
        noSupplierPoMessage.style.display = 'none'; // Don't show "no POs" on error
         summaryTotalPoValue.textContent = 'Error';
         summaryTotalPoValue.classList.remove('loading-state');
         updateAccountSummary(); // Try updating summary even on error
    });
}

// सप्लायर के भुगतान लोड करना (Realtime)
function loadPayments(supplierId) {
     if (paymentListener) paymentListener(); // पिछला लिस्नर हटाएं
    clearError('supplierPaymentListError');
    transactionsLoading.style.display = 'table-row';
    noTransactionsMessage.style.display = 'none';
     summaryTotalPaid.textContent = 'Calculating...';
     summaryTotalPaid.classList.add('loading-state');
     summaryBalance.textContent = 'Calculating...';
     summaryBalance.classList.add('loading-state');

    const paymentsQuery = query(
        collection(db, "payments_made"),
        where("supplierId", "==", supplierId),
        orderBy("paymentDate", "desc")
    );

     paymentListener = onSnapshot(paymentsQuery, (querySnapshot) => {
        const payments = [];
        querySnapshot.forEach((doc) => {
            payments.push({ id: doc.id, ...doc.data() });
        });
        displayPayments(payments);
        transactionsLoading.style.display = 'none';
        clearError('supplierPaymentListError'); // एरर साफ करें अगर सब ठीक है
    }, (error) => {
        console.error("Error fetching payments in real-time: ", error);
        displayError("Failed to load payments.", 'supplierPaymentListError');
        transactionsLoading.style.display = 'none';
         noTransactionsMessage.style.display = 'none'; // Don't show "no payments" on error
         summaryTotalPaid.textContent = 'Error';
         summaryTotalPaid.classList.remove('loading-state');
         updateAccountSummary(); // Try updating summary even on error
    });
}

// मुख्य डेटा लोडिंग फंक्शन
async function loadSupplierAccountData() {
    const urlParams = new URLSearchParams(window.location.search);
    currentSupplierId = urlParams.get('id');

    if (!currentSupplierId) {
        displayError("No supplier ID provided in URL.");
        showLoading(false);
        // Optionally redirect back to supplier list
        // window.location.href = 'supplier_management.html';
        return;
    }

    showLoading(true);
    clearError(); // पेज लोड पर सभी एरर साफ करें

    try {
        await loadSupplierBaseData(currentSupplierId);
        // Start listening for realtime updates
        loadPurchaseOrders(currentSupplierId);
        loadPayments(currentSupplierId);
    } catch (error) {
        console.error("Error in initial data load sequence:", error);
        displayError("An error occurred while loading initial supplier data.");
    } finally {
        // Loading indicator might be turned off by individual loaders,
        // but ensure it's off if base data loaded but listeners failed.
        // Let the individual listeners manage their specific loading states.
        showLoading(false); // Hide general loading indicator
    }
}


// --- एक्शन हैंडलर्स (स्टब्स - बाद के स्टेजेस में इम्प्लीमेंट होंगे) ---

// स्टब: पेमेंट सेव करना
async function handleSavePayment(event) {
    event.preventDefault();
    console.warn("handleSavePayment not fully implemented.");
    displayError("Saving payment function is not yet active.", "paymentMadeError");
    // स्टेज 4 में लॉजिक यहाँ जोड़ा जाएगा
}

// स्टब: सप्लायर एडिट सबमिट करना
async function handleEditSupplierSubmit(event) {
    event.preventDefault();
    console.warn("handleEditSupplierSubmit not fully implemented.");
    displayError("Updating supplier details function is not yet active.", "editSupplierError");
    // स्टेज 5 में लॉजिक यहाँ जोड़ा जाएगा
}

// स्टब: PO विवरण देखना (प्लेसहोल्डर)
window.viewPoDetails = function(poId) {
    console.log("Attempting to view PO details for:", poId);
    alert(`Viewing details for PO ${poId} needs implementation (perhaps navigate to a PO detail page or open a modal).`);
    // आप यहाँ एक नए पेज पर नेविगेट कर सकते हैं या एक विवरण मोडाल खोल सकते हैं
    // window.location.href = `po_details.html?id=${poId}`;
}

// स्टब: पेमेंट डिलीट करना (प्लेसहोल्डर)
window.deletePayment = async function(paymentId) {
     console.warn(`Deletion requested for payment ${paymentId} - Not Implemented`);
     if(confirm(`Are you sure you want to delete payment ${paymentId}? This action cannot be undone and related PO balances will NOT be automatically updated in this version.`)) {
         alert(`Deletion for payment ${paymentId} is not yet implemented.`);
         // Firestore से डिलीट करने का कोड यहाँ जोड़ा जाएगा
         // try {
         //    await deleteDoc(doc(db, "payments_made", paymentId));
         //    console.log("Payment deleted (stub)");
         //    // UI अपडेट करने के लिए रियलटाइम लिस्नर पर निर्भर रहें
         // } catch (error) {
         //    console.error("Error deleting payment (stub):", error);
         //    displayError("Failed to delete payment.");
         // }
     }
}


// --- इवेंट लिस्नर्स सेटअप ---
function setupEventListeners() {
    // पेमेंट मोडाल बटन्स
    if (addPaymentMadeBtn) addPaymentMadeBtn.addEventListener('click', openPaymentModal);
    if (closePaymentMadeModalBtn) closePaymentMadeModalBtn.addEventListener('click', closePaymentModal);
    if (cancelPaymentBtn) cancelPaymentBtn.addEventListener('click', closePaymentModal); // कैंसल बटन भी मोडाल बंद करे
    if (paymentMadeForm) paymentMadeForm.addEventListener('submit', handleSavePayment); // अभी स्टब को कॉल करेगा

    // एडिट सप्लायर मोडाल बटन्स
    if (editSupplierDetailsBtn) editSupplierDetailsBtn.addEventListener('click', openEditSupplierModal); // अभी स्टब को कॉल करेगा
    if (closeEditSupplierBtn) closeEditSupplierBtn.addEventListener('click', closeEditSupplierModal);
    if (cancelEditSupplierBtn) cancelEditSupplierBtn.addEventListener('click', closeEditSupplierModal); // कैंसल बटन भी मोडाल बंद करे
    if (editSupplierForm) editSupplierForm.addEventListener('submit', handleEditSupplierSubmit); // अभी स्टब को कॉल करेगा

     // Close modal if clicking outside the content
     if (paymentMadeModal) {
         paymentMadeModal.addEventListener('click', (event) => {
            // Check if the click is directly on the modal background
            if (event.target === paymentMadeModal) {
                closePaymentModal();
            }
        });
     }
     if (editSupplierModal) {
         editSupplierModal.addEventListener('click', (event) => {
            if (event.target === editSupplierModal) {
                closeEditSupplierModal();
            }
         });
     }

    console.log("Supplier Detail Event Listeners Setup.");
}

// --- इनिशियलाइज़ेशन ---
// Make initialization function global and ensure it runs after DOM is ready
window.initializeSupplierDetailPage = async function() {
     // Prevent multiple initializations
     if (window.supplierDetailPageInitialized) {
         console.log("Supplier Detail Page already initialized.");
         return;
     }
     console.log("Running initializeSupplierDetailPage...");

     // Basic check for Firestore availability
     if (!db) { console.error("Firestore (db) instance not available!"); displayError("Database connection failed."); return; }

     setupEventListeners(); // इवेंट लिस्नर पहले सेटअप करें
     await loadSupplierAccountData(); // फिर डेटा लोड करें

     console.log("Supplier Detail Page Initialized via global function.");
     window.supplierDetailPageInitialized = true;
};

// Trigger initialization when called from HTML's auth check
console.log("supplier_account_detail.js loaded (v_stage1). Waiting for auth check to call initializeSupplierDetailPage.");

// --- स्टब्स/प्लेसहोल्डर्स (यह सुनिश्चित करने के लिए कि फंक्शन्स परिभाषित हैं, भले ही वे अभी पूरी तरह से लागू न हों) ---
// handleSavePayment, handleEditSupplierSubmit, viewPoDetails, deletePayment पहले से परिभाषित हैं।
// openPaymentModal, closePaymentModal, openEditSupplierModal, closeEditSupplierModal भी अपडेट/परिभाषित हैं।