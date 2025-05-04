// js/supplier_account_detail.js
// संस्करण: प्रमाणीकरण लॉगिंग और बेहतर त्रुटि प्रबंधन शामिल है

// --- Firebase फ़ंक्शन सीधे आयात करें ---
import { db, auth } from './firebase-init.js'; // <<< auth को यहां आयात करना सुनिश्चित करें
import {
    doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp,
    addDoc, serverTimestamp, updateDoc, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"; // <<< Auth स्थिति परिवर्तन सुनने के लिए

// --- ग्लोबल वेरिएबल्स ---
let currentSupplierId = null;
let currentSupplierData = null; // सप्लायर का पूरा डेटा स्टोर करने के लिए
let purchaseOrdersData = []; // लोड किए गए POs को स्टोर करने के लिए

// --- DOM रेफरेंसेस ---
// (IDs आपकी supplier_account_detail.html फ़ाइल से मेल खानी चाहिए)
const supplierNameHeader = document.getElementById('supplierNameHeader');
const supplierNameBreadcrumb = document.getElementById('supplierNameBreadcrumb'); // अगर ब्रेडक्रम्ब है
const addPaymentMadeBtn = document.getElementById('addPaymentMadeBtn');
const editSupplierDetailsBtn = document.getElementById('editSupplierDetailsBtn'); // संपादन मोड खोलने के लिए बटन

// Supplier Details Display Elements
const detailSupplierId = document.getElementById('detailSupplierId');
const detailSupplierName = document.getElementById('detailSupplierName');
const detailSupplierCompany = document.getElementById('detailSupplierCompany');
const detailSupplierWhatsapp = document.getElementById('detailSupplierWhatsapp');
const detailSupplierEmail = document.getElementById('detailSupplierEmail');
const detailSupplierGst = document.getElementById('detailSupplierGst');
const detailSupplierAddress = document.getElementById('detailSupplierAddress'); // <<< Address ID जोड़ा गया
const detailAddedOn = document.getElementById('detailAddedOn'); // <<< Added On ID जोड़ा गया

// Account Summary Display Elements
const totalPoValueDisplay = document.getElementById('totalPoValue');
const totalPaymentsMadeDisplay = document.getElementById('totalPaymentsMade');
const outstandingBalanceDisplay = document.getElementById('outstandingBalance');

// Payment Modal Elements
const paymentMadeModal = document.getElementById('paymentMadeModal');
const paymentMadeForm = document.getElementById('paymentMadeForm');
const paymentDateInput = document.getElementById('paymentDate');
const paymentAmountInput = document.getElementById('paymentAmount');
const paymentMethodInput = document.getElementById('paymentMethod');
const paymentNotesInput = document.getElementById('paymentNotes');
const poLinkDropdown = document.getElementById('poLink'); // PO लिंक ड्रॉपडाउन
const closePaymentModalBtn = document.getElementById('closePaymentModalBtn');
const paymentErrorDiv = document.getElementById('paymentError'); // पेमेंट फॉर्म में एरर के लिए

// Transaction History Elements
const supplierPaymentList = document.getElementById('supplierPaymentList'); // पेमेंट लिस्ट tbody
const supplierPaymentListError = document.getElementById('supplierPaymentListError'); // पेमेंट लिस्ट एरर मैसेज

// Edit Supplier Modal Elements
const editSupplierModal = document.getElementById('editSupplierModal');
const editSupplierForm = document.getElementById('editSupplierForm');
const editSupplierNameInput = document.getElementById('editSupplierNameInput');
const editSupplierCompanyInput = document.getElementById('editSupplierCompanyInput');
const editSupplierContactInput = document.getElementById('editSupplierContactInput');
const editSupplierEmailInput = document.getElementById('editSupplierEmailInput');
const editSupplierGstInput = document.getElementById('editSupplierGstInput');
const editSupplierAddressInput = document.getElementById('editSupplierAddressInput');
const editingSupplierIdInput = document.getElementById('editingSupplierId'); // हिडन इनपुट ID के लिए
const updateSupplierBtn = document.getElementById('updateSupplierBtn');
const cancelEditSupplierBtn = document.getElementById('cancelEditSupplierBtn');
const editSupplierErrorDiv = document.getElementById('editSupplierError'); // संपादन फॉर्म में एरर के लिए

// Loading Indicator
const loadingIndicator = document.getElementById('loadingIndicator'); // <<< लोडिंग इंडिकेटर

// --- Helper Functions ---
function displayError(message, elementId = 'generalError') {
    console.error("Displaying Error:", message);
    const errorElement = document.getElementById(elementId) || document.getElementById('supplierPaymentListError'); // Fallback
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    } else {
        alert(`Error: ${message}`); // Fallback alert
    }
    // Hide specific list errors if a general error occurs
    if (elementId === 'generalError' && supplierPaymentListError) {
         supplierPaymentListError.style.display = 'none';
    }
}

function clearError(elementId = 'generalError') {
    const errorElement = document.getElementById(elementId) || document.getElementById('supplierPaymentListError');
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
    if (supplierPaymentListError) supplierPaymentListError.style.display = 'none'; // Clear payment list error too
    if (paymentErrorDiv) paymentErrorDiv.style.display = 'none';
    if (editSupplierErrorDiv) editSupplierErrorDiv.style.display = 'none';
}

function getSupplierIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    try {
        // Firestore Timestamp को JavaScript Date ऑब्जेक्ट में बदलें
        const date = timestamp.toDate();
        const options = { year: 'numeric', month: 'short', day: 'numeric' }; // , hour: '2-digit', minute: '2-digit' };
        return date.toLocaleDateString('en-IN', options);
    } catch (e) {
        console.error("Error formatting date:", timestamp, e);
        // अगर यह पहले से ही Date ऑब्जेक्ट या स्ट्रिंग है
        try {
            const date = new Date(timestamp);
             const options = { year: 'numeric', month: 'short', day: 'numeric' };
             return date.toLocaleDateString('en-IN', options);
        } catch (e2) {
             return 'Invalid Date';
        }
    }
}

function formatCurrency(amount) {
    if (typeof amount !== 'number') {
        amount = parseFloat(amount);
    }
    if (isNaN(amount)) {
        return '₹ N/A';
    }
    return `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// --- Core Data Loading Function ---
async function loadSupplierAccountData(dbInstance) {
    // <<< --- प्रमाणीकरण स्थिति जांच --- >>>
    console.log("loadSupplierAccountData: Checking Auth Status...");
    try {
        // सुनो कि क्या auth तैयार है
        await new Promise((resolve, reject) => {
             const unsubscribe = onAuthStateChanged(auth, (user) => {
                 unsubscribe(); // Listener हटा दें
                 resolve(user);
             }, (error) => {
                 reject(error);
             });
             // टाइमआउट जोड़ें अगर auth कभी रेडी नहीं होता है
             setTimeout(() => reject(new Error("Auth state check timed out")), 5000);
        });

        console.log("Current Auth User (after check):", auth.currentUser); // <<< यह लाइन महत्वपूर्ण है
        if (!auth.currentUser) {
            console.error("USER NOT LOGGED IN according to auth.currentUser!");
            displayError("User not authenticated. Please log in to view details.");
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            return; // आगे न बढ़ें
        } else {
             console.log("User authenticated with UID:", auth.currentUser.uid);
        }
    } catch (authError) {
        console.error("Error checking auth status:", authError);
        displayError(`Authentication check failed: ${authError.message}`);
         if (loadingIndicator) loadingIndicator.style.display = 'none';
        return; // आगे न बढ़ें
    }
    // <<< --- प्रमाणीकरण स्थिति जांच समाप्त --- >>>

    if (!currentSupplierId) {
         console.error("Supplier ID is missing when loadSupplierAccountData is called.");
         displayError("Supplier ID missing.");
         if (loadingIndicator) loadingIndicator.style.display = 'none';
         return;
    }
    if (!dbInstance) {
         console.error("Firestore dbInstance is not available!");
         displayError("Database connection failed.");
          if (loadingIndicator) loadingIndicator.style.display = 'none';
         return;
    }

    console.log(`Loading account data for ID: ${currentSupplierId}`);
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    clearError(); // पिछली एरर साफ करें

    let supplierData = null;
    let payments = [];
    let purchaseOrders = [];
    let paymentSum = 0;
    let poSum = 0;

    try {
        // 1. सप्लायर डिटेल्स लोड करें
        console.log(`Attempting to load details for supplier ID: ${currentSupplierId}`);
        const supplierRef = doc(dbInstance, "suppliers", currentSupplierId);
        const supplierSnap = await getDoc(supplierRef);

        if (supplierSnap.exists()) {
            supplierData = { id: supplierSnap.id, ...supplierSnap.data() };
            currentSupplierData = supplierData; // ग्लोबल वेरिएबल में सेव करें
            console.log("Supplier Data found:", supplierData);
            populateSupplierDetails(supplierData);
        } else {
            console.error("Supplier not found with ID:", currentSupplierId);
            displayError("Supplier not found.");
             if (loadingIndicator) loadingIndicator.style.display = 'none';
            return; // सप्लायर नहीं मिला तो आगे नहीं बढ़ सकते
        }

        // 2. सप्लायर पेमेंट्स लोड करें (जहां एरर आ रहा था)
        console.log("Attempting to load supplier payments...");
        const paymentsQuery = query(
            collection(dbInstance, "supplier_payments"), // सही कलेक्शन नाम
            where("supplierId", "==", currentSupplierId), // सुनिश्चित करें 'supplierId' फ़ील्ड मौजूद है
            orderBy("paymentDate", "desc")             // सुनिश्चित करें 'paymentDate' फ़ील्ड मौजूद है
        );
        // क्वेरी करने से ठीक पहले प्रमाणीकरण की फिर से जाँच करें (डीबगिंग के लिए)
        console.log("Auth status just before payment query:", auth.currentUser ? auth.currentUser.uid : 'null');

        const paymentsSnapshot = await getDocs(paymentsQuery); // <<-- यहीं पर एरर आता है
        console.log(`Successfully queried supplier payments. Found ${paymentsSnapshot.docs.length} payments.`);

        payments = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        paymentSum = payments.reduce((sum, payment) => sum + (parseFloat(payment.paymentAmount) || 0), 0);
        populatePaymentHistory(payments);

        // 3. सप्लायर Purchase Orders (POs) लोड करें
        console.log("Attempting to load supplier POs...");
        const poQuery = query(
            collection(dbInstance, "purchaseOrders"), // सही कलेक्शन नाम 'purchaseOrders'
            where("supplierId", "==", currentSupplierId) // सुनिश्चित करें 'supplierId' फ़ील्ड मौजूद है
            // orderBy("orderDate", "desc") // यदि आवश्यक हो तो सॉर्ट करें
        );
        const poSnapshot = await getDocs(poQuery);
        console.log(`Successfully queried purchase orders. Found ${poSnapshot.docs.length} POs.`);
        purchaseOrders = poSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        purchaseOrdersData = purchaseOrders; // ड्रॉपडाउन के लिए सेव करें
        poSum = purchaseOrders.reduce((sum, po) => sum + (parseFloat(po.totalAmount) || 0), 0);
        // POs को यहां टेबल में नहीं दिखा रहे हैं, केवल सारांश के लिए उपयोग कर रहे हैं

        // 4. खाता सारांश अपडेट करें
        console.log("Calculating Summary - POs:", { count: purchaseOrders.length, totalAmount: poSum });
        console.log("Calculating Summary - Payments:", { count: payments.length, totalPaid: paymentSum });
        updateAccountSummary(poSum, paymentSum, supplierData.pendingAmount); // सप्लायर के डेटा से पेंडिंग अमाउंट लें (अगर है)

        // 5. PO ड्रॉपडाउन पॉप्युलेट करें (पेमेंट मोड के लिए)
        populatePoDropdown(purchaseOrders);


    } catch (error) {
        console.error("Error in loadSupplierAccountData:", error);
        if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes("permission"))) {
             console.error("PERMISSION DENIED - Check Firestore rules AND authentication status!");
             displayError("Failed to load data due to permissions. Ensure you are logged in and rules are correct.");
             // विशेष रूप से पेमेंट लिस्ट के लिए एरर दिखाएं
             if (supplierPaymentListError) {
                supplierPaymentListError.textContent = "Failed to load transaction history due to permissions.";
                supplierPaymentListError.style.display = 'block';
             }
        } else if (error.message && error.message.toLowerCase().includes("index")) {
             console.error("MISSING INDEX - Firestore likely requires an index for this query. Check the console error details for a link to create it.");
             displayError("Database query error: Missing index. Please contact support.");
        } else if (error.message && error.message.toLowerCase().includes("auth state check timed out")) {
             displayError("Authentication check failed. Please try refreshing the page or logging in again.");
        }
         else {
            displayError(`Error loading supplier data: ${error.message}`);
        }
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        console.log("loadSupplierAccountData finished.");
    }
}


// --- UI Population Functions ---
function populateSupplierDetails(data) {
    if (!data) return;
    console.log("Populating supplier details for:", data.name);
    if (supplierNameHeader) supplierNameHeader.textContent = data.name || 'Supplier Account';
    if (supplierNameBreadcrumb) supplierNameBreadcrumb.textContent = data.name || 'Details'; // अगर ब्रेडक्रम्ब है

    if (detailSupplierId) detailSupplierId.textContent = data.id || 'N/A';
    if (detailSupplierName) detailSupplierName.textContent = data.name || 'N/A';
    if (detailSupplierCompany) detailSupplierCompany.textContent = data.company || 'N/A';
    if (detailSupplierWhatsapp) detailSupplierWhatsapp.textContent = data.contact || 'N/A'; // Assume contact is WhatsApp
    if (detailSupplierEmail) detailSupplierEmail.textContent = data.email || 'N/A';
    if (detailSupplierGst) detailSupplierGst.textContent = data.gstNo || 'N/A';
    if (detailSupplierAddress) detailSupplierAddress.textContent = data.address || 'N/A';
    if (detailAddedOn) detailAddedOn.textContent = data.addedOn ? formatDate(data.addedOn) : 'N/A';
}

function populatePaymentHistory(payments) {
    if (!supplierPaymentList) return;
    supplierPaymentList.innerHTML = ''; // पुरानी लिस्ट साफ करें
    if (payments.length === 0) {
        supplierPaymentList.innerHTML = '<tr><td colspan="5">No payments recorded yet.</td></tr>';
        if (supplierPaymentListError) supplierPaymentListError.style.display = 'none'; // कोई एरर नहीं है अगर लिस्ट खाली है
        return;
    }

    if (supplierPaymentListError) supplierPaymentListError.style.display = 'none'; // अगर पेमेंट्स हैं तो एरर छिपाएं

    payments.forEach(payment => {
        const row = supplierPaymentList.insertRow();
        row.insertCell(0).textContent = payment.id || 'N/A'; // या एक बेहतर पेमेंट ID दिखाएं
        row.insertCell(1).textContent = formatDate(payment.paymentDate);
        row.insertCell(2).textContent = formatCurrency(payment.paymentAmount);
        row.insertCell(3).textContent = payment.paymentMethod || 'N/A';
        // PO लिंक को संभालें
        const poCell = row.insertCell(4);
        if (payment.linkedPoId && payment.linkedPoNumber) {
            // लिंक बनाएं अगर ID और नंबर दोनों मौजूद हैं
             poCell.innerHTML = `<a href="purchase_order_detail.html?id=${payment.linkedPoId}" title="View PO Details">${payment.linkedPoNumber}</a>`;
             // आप चाहें तो यहां poCell.textContent = payment.linkedPoNumber; भी रख सकते हैं अगर लिंक नहीं बनाना
        } else if (payment.linkedPoNumber) {
            poCell.textContent = payment.linkedPoNumber; // केवल नंबर दिखाएं अगर ID नहीं है
        }
         else {
             poCell.textContent = 'N/A';
        }
        // row.insertCell(5).textContent = payment.notes || '-'; // नोट्स अगर दिखाना चाहें
    });
}

function updateAccountSummary(poTotal, paymentTotal, pendingFromSupplierDoc = null) {
    if (totalPoValueDisplay) totalPoValueDisplay.textContent = formatCurrency(poTotal);
    if (totalPaymentsMadeDisplay) totalPaymentsMadeDisplay.textContent = formatCurrency(paymentTotal);

    // बकाया राशि की गणना: PO Total - Payment Total
    // या सप्लायर डॉक्यूमेंट से सीधे पेंडिंग अमाउंट लें अगर वह अधिक विश्वसनीय है
    let outstanding = 0;
    if (pendingFromSupplierDoc !== null && !isNaN(parseFloat(pendingFromSupplierDoc))) {
        outstanding = parseFloat(pendingFromSupplierDoc);
        console.log("Using pending amount from supplier document:", outstanding);
    } else {
         outstanding = poTotal - paymentTotal;
         console.log("Calculated pending amount (PO Total - Payment Total):", outstanding);
    }

    if (outstandingBalanceDisplay) outstandingBalanceDisplay.textContent = formatCurrency(outstanding);
}

function populatePoDropdown(pos) {
    if (!poLinkDropdown) return;
    poLinkDropdown.innerHTML = '<option value="">None (Direct Payment)</option>'; // डिफ़ॉल्ट ऑप्शन

    // केवल 'Pending' या 'Partially Paid' POs दिखाएं
    const relevantPOs = pos.filter(po =>
        po.status === 'Pending' || po.status === 'Partially Paid'
    );

    if (relevantPOs.length === 0) {
         poLinkDropdown.innerHTML += '<option value="" disabled>No pending POs found</option>';
         return;
    }

    relevantPOs.forEach(po => {
        const option = document.createElement('option');
        option.value = po.id; // PO ID को वैल्यू बनाएं
        // ऑप्शन टेक्स्ट में PO नंबर और बकाया राशि दिखाएं
        const amountDue = (parseFloat(po.totalAmount) || 0) - (parseFloat(po.amountPaid) || 0);
        option.textContent = `${po.poNumber || po.id} (Due: ${formatCurrency(amountDue)})`;
        // अतिरिक्त डेटा स्टोर करें यदि आवश्यक हो (जैसे PO नंबर)
        option.dataset.poNumber = po.poNumber || '';
        option.dataset.totalAmount = po.totalAmount || 0;
        option.dataset.amountPaid = po.amountPaid || 0;
        poLinkDropdown.appendChild(option);
    });
}


// --- Event Handlers ---
function openPaymentModal() {
    if (!paymentMadeModal) return;
    clearError('paymentError'); // पुराना एरर साफ करें
    paymentMadeForm.reset(); // फॉर्म रीसेट करें
    // ड्रॉपडाउन को नवीनतम POs से री-पॉप्युलेट करें (अगर आवश्यक हो)
    populatePoDropdown(purchaseOrdersData);
     // आज की तारीख सेट करें
    try {
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        if (paymentDateInput) paymentDateInput.value = `${year}-${month}-${day}`;
    } catch(e) { console.error("Error setting default payment date", e); }

    paymentMadeModal.style.display = 'block';
}

function closePaymentModal() {
    if (paymentMadeModal) paymentMadeModal.style.display = 'none';
}

async function handleSavePayment(event) {
    event.preventDefault();
    if (!currentSupplierId) {
        displayError("Supplier ID not set.", 'paymentError');
        return;
    }
    clearError('paymentError');

    const paymentData = {
        supplierId: currentSupplierId,
        supplierName: currentSupplierData?.name || 'N/A', // सप्लायर का नाम जोड़ें
        paymentAmount: parseFloat(paymentAmountInput.value),
        paymentDate: Timestamp.fromDate(new Date(paymentDateInput.value + "T00:00:00")), // टाइमज़ोन समस्या से बचने के लिए
        paymentMethod: paymentMethodInput.value,
        notes: paymentNotesInput.value || '',
        linkedPoId: poLinkDropdown.value || null, // लिंक किए गए PO की ID
        linkedPoNumber: poLinkDropdown.selectedOptions[0]?.dataset?.poNumber || null, // लिंक किए गए PO का नंबर
        createdAt: serverTimestamp() // रिकॉर्ड बनाने का समय
    };

    if (isNaN(paymentData.paymentAmount) || paymentData.paymentAmount <= 0) {
        displayError("Please enter a valid positive payment amount.", 'paymentError');
        return;
    }
    if (!paymentData.paymentDate || isNaN(paymentData.paymentDate.toDate())) {
        displayError("Please select a valid payment date.", 'paymentError');
        return;
    }
     if (!paymentData.paymentMethod) {
        displayError("Please select a payment method.", 'paymentError');
        return;
    }

    console.log("Saving Payment:", paymentData);
    const saveButton = paymentMadeForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    try {
        await runTransaction(db, async (transaction) => {
            // 1. नया पेमेंट डॉक्यूमेंट बनाएं
            const paymentRef = doc(collection(db, "supplier_payments")); // नया रेफेरेंस बनाएं
            transaction.set(paymentRef, paymentData); // ट्रांजेक्शन में सेट करें

            // 2. अगर PO लिंक किया गया है, तो PO को अपडेट करें
            if (paymentData.linkedPoId) {
                const poRef = doc(db, "purchaseOrders", paymentData.linkedPoId);
                const poDoc = await transaction.get(poRef); // ट्रांजेक्शन में पढ़ें

                if (!poDoc.exists()) {
                    throw new Error(`Linked Purchase Order with ID ${paymentData.linkedPoId} not found.`);
                }

                const poData = poDoc.data();
                const currentPaid = parseFloat(poData.amountPaid) || 0;
                const totalAmount = parseFloat(poData.totalAmount) || 0;
                const newPaidAmount = currentPaid + paymentData.paymentAmount;

                let newStatus = poData.status;
                if (newPaidAmount >= totalAmount) {
                    newStatus = 'Paid';
                } else if (newPaidAmount > 0) {
                    newStatus = 'Partially Paid';
                }

                console.log(`Updating PO ${paymentData.linkedPoId}: New Paid Amount: ${newPaidAmount}, New Status: ${newStatus}`);
                transaction.update(poRef, {
                    amountPaid: newPaidAmount,
                    status: newStatus,
                    lastPaymentDate: paymentData.paymentDate // अंतिम पेमेंट की तारीख अपडेट करें
                });
            }

            // 3. सप्लायर के पेंडिंग अमाउंट को अपडेट करें (वैकल्पिक लेकिन अनुशंसित)
            const supplierRef = doc(db, "suppliers", currentSupplierId);
            const supplierDoc = await transaction.get(supplierRef); // ट्रांजेक्शन में पढ़ें
            if (supplierDoc.exists()) {
                const currentPending = parseFloat(supplierDoc.data().pendingAmount) || 0;
                // मान लें कि पेंडिंग अमाउंट से पेमेंट घटाना है
                // नोट: यह गणना जटिल हो सकती है अगर PO वैल्यू शामिल नहीं है
                // बेहतर होगा अगर आप केवल PO टोटल और पेमेंट टोटल से गणना करें
                // फिलहाल, हम केवल दिखाने के लिए इसे अपडेट नहीं कर रहे हैं, आप इसे अपनी लॉजिक के अनुसार जोड़ सकते हैं
                // const newPendingAmount = currentPending - paymentData.paymentAmount;
                // transaction.update(supplierRef, { pendingAmount: newPendingAmount });
                console.log("Supplier pending amount update skipped in this transaction example.");
            }
        });

        console.log("Payment saved successfully and PO updated (if linked).");
        closePaymentModal();
        // डेटा को रीफ्रेश करें ताकि अपडेटेड पेमेंट और सारांश दिखे
        await loadSupplierAccountData(db);

    } catch (error) {
        console.error("Error saving payment:", error);
        displayError(`Failed to save payment: ${error.message}`, 'paymentError');
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Payment';
    }
}


// --- EDIT SUPPLIER MODAL LOGIC ---
function openEditSupplierModal() {
    if (!editSupplierModal || !currentSupplierData) {
         console.error("Edit modal or supplier data not available.");
         return;
    }
    clearError('editSupplierError'); // पिछला एरर साफ करें

    // मौजूदा डेटा से फॉर्म भरें
    editSupplierNameInput.value = currentSupplierData.name || '';
    editSupplierCompanyInput.value = currentSupplierData.company || '';
    editSupplierContactInput.value = currentSupplierData.contact || '';
    editSupplierEmailInput.value = currentSupplierData.email || '';
    editSupplierGstInput.value = currentSupplierData.gstNo || '';
    editSupplierAddressInput.value = currentSupplierData.address || '';
    editingSupplierIdInput.value = currentSupplierId; // हिडन इनपुट में ID सेट करें

    editSupplierModal.style.display = 'block';
}

function closeEditSupplierModal() {
    if (editSupplierModal) editSupplierModal.style.display = 'none';
}

async function handleUpdateSupplier(event) {
    event.preventDefault();
    clearError('editSupplierError');
    const supplierIdToUpdate = editingSupplierIdInput.value;

    if (!supplierIdToUpdate) {
        displayError("Supplier ID missing. Cannot update.", 'editSupplierError');
        return;
    }

    const updatedData = {
        name: editSupplierNameInput.value.trim(),
        company: editSupplierCompanyInput.value.trim(),
        contact: editSupplierContactInput.value.trim(),
        email: editSupplierEmailInput.value.trim(),
        gstNo: editSupplierGstInput.value.trim(),
        address: editSupplierAddressInput.value.trim(),
        // आप चाहें तो lastUpdated फ़ील्ड भी जोड़ सकते हैं:
        // lastUpdated: serverTimestamp()
    };

    if (!updatedData.name) {
         displayError("Supplier name is required.", 'editSupplierError');
        return;
    }

    console.log("Updating supplier:", supplierIdToUpdate, "with data:", updatedData);
    updateSupplierBtn.disabled = true;
    updateSupplierBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

    try {
        const supplierRef = doc(db, "suppliers", supplierIdToUpdate);
        await updateDoc(supplierRef, updatedData);

        console.log("Supplier updated successfully!");
        closeEditSupplierModal();
        // पेज पर डेटा रीफ्रेश करें
        await loadSupplierAccountData(db);

    } catch (error) {
        console.error("Error updating supplier:", error);
        displayError(`Failed to update supplier: ${error.message}`, 'editSupplierError');
    } finally {
        updateSupplierBtn.disabled = false;
        updateSupplierBtn.innerHTML = '<i class="fas fa-save"></i> Update Supplier';
    }
}
// --- EDIT SUPPLIER MODAL LOGIC END ---


// --- Event Listeners Setup ---
function setupEventListeners() {
    // Payment Modal Buttons
    if (addPaymentMadeBtn) addPaymentMadeBtn.addEventListener('click', openPaymentModal);
    if (closePaymentModalBtn) closePaymentModalBtn.addEventListener('click', closePaymentModal);
    if (paymentMadeModal) paymentMadeModal.addEventListener('click', (event) => { if (event.target === paymentMadeModal) closePaymentModal(); }); // पृष्ठभूमि क्लिक
    if (paymentMadeForm) paymentMadeForm.addEventListener('submit', handleSavePayment);

    // Edit Supplier Modal Buttons
    if (editSupplierDetailsBtn) editSupplierDetailsBtn.addEventListener('click', openEditSupplierModal);
    if (cancelEditSupplierBtn) cancelEditSupplierBtn.addEventListener('click', closeEditSupplierModal);
    if (editSupplierModal) editSupplierModal.addEventListener('click', (event) => { if (event.target === editSupplierModal) closeEditSupplierModal(); }); // पृष्ठभूमि क्लिक
    if (editSupplierForm) editSupplierForm.addEventListener('submit', handleUpdateSupplier);

    console.log("Supplier detail event listeners setup.");
}


// --- Global Initialization Function ---
window.initializeSupplierDetailPage = async () => {
    console.log("Initializing Supplier Detail Page (Global Function)...");
    currentSupplierId = getSupplierIdFromUrl();
    if (!currentSupplierId) {
         console.error("Supplier ID missing from URL.");
         displayError("Supplier ID missing. Cannot load details.");
         return;
    }
    console.log("Supplier ID from URL:", currentSupplierId);

    // सुनिश्चित करें कि db परिभाषित है और फिर डेटा लोड करें
    if (typeof db !== 'undefined' && db) {
        await loadSupplierAccountData(db); // डेटा लोड करें (जिसमें प्रमाणीकरण जांच शामिल है)
    } else {
        console.error("Firestore db instance is not available during initialization!");
        displayError("Database connection failed. Please refresh.");
        return; // आगे न बढ़ें अगर db नहीं है
    }

    // इवेंट लिस्टनर्स केवल डेटा लोड होने के बाद सेट करें (या जरूरत के अनुसार पहले)
    setupEventListeners();

    // आज की तारीख पेमेंट मोड में सेट करें (अगर इनपुट मौजूद है)
    if (paymentDateInput) {
         try {
             const today = new Date();
             const y = today.getFullYear();
             const m = (today.getMonth() + 1).toString().padStart(2, '0');
             const d = today.getDate().toString().padStart(2, '0');
             paymentDateInput.value = `${y}-${m}-${d}`;
         } catch (e) {
             console.warn("Could not set default payment date", e);
         }
     }

    console.log("Supplier Detail Page Initialized via global function.");
    window.supplierDetailPageInitialized = true; // फ्लैग सेट करें कि इनिशियलाइज़ेशन हो गया है
};

// --- Auto-initialize ---
// सुनिश्चित करें कि पेज लोड होने पर इनिशियलाइज़ेशन फंक्शन कॉल हो
// DOMContentLoaded का उपयोग करना सुरक्षित है
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.supplierDetailPageInitialized) { // दोबारा इनिशियलाइज़ेशन से बचें
             window.initializeSupplierDetailPage();
        }
    });
} else {
     // DOM पहले से ही लोड हो चुका है
     if (!window.supplierDetailPageInitialized) { // दोबारा इनिशियलाइज़ेशन से बचें
        window.initializeSupplierDetailPage();
    }
}
// --- End Auto-initialize ---

console.log("supplier_account_detail.js loaded and running (Auth Logging Added).");