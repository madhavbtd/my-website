// js/supplier_account_detail.js - v1 (Step 3: Load & Display Supplier Account Data)

// --- Global Variables ---
let currentSupplierId = null;
let currentSupplierData = null;

// --- DOM References ---
// Ensure these IDs match your supplier_account_detail.html file
// Header/Breadcrumb
const supplierNameHeader = document.getElementById('supplierNameHeader');
const supplierNameBreadcrumb = document.getElementById('supplierNameBreadcrumb');

// Action Buttons
const addPaymentMadeBtn = document.getElementById('addPaymentMadeBtn');
const editSupplierDetailsBtn = document.getElementById('editSupplierDetailsBtn');

// Supplier Info Box
const detailSupplierId = document.getElementById('detailSupplierId');
const detailSupplierName = document.getElementById('detailSupplierName');
const detailSupplierCompany = document.getElementById('detailSupplierCompany');
const detailSupplierWhatsapp = document.getElementById('detailSupplierWhatsapp');
const detailSupplierEmail = document.getElementById('detailSupplierEmail');
const detailSupplierGst = document.getElementById('detailSupplierGst');
const detailSupplierAddress = document.getElementById('detailSupplierAddress');

// Account Summary Box
const summaryTotalPoValue = document.getElementById('summaryTotalPoValue');
const summaryTotalPaid = document.getElementById('summaryTotalPaid');
const summaryBalance = document.getElementById('summaryBalance');

// PO List
const supplierPoTableBody = document.getElementById('supplierPoTableBody');
const supplierPoLoading = document.getElementById('supplierPoLoading');
const supplierPoListError = document.getElementById('supplierPoListError');

// Payments List
const supplierPaymentsTableBody = document.getElementById('supplierPaymentsTableBody');
const supplierPaymentLoading = document.getElementById('supplierPaymentLoading');
const supplierPaymentListError = document.getElementById('supplierPaymentListError');

// Add Payment Modal Elements (Get references now for Step 4)
const addPaymentModal = document.getElementById('addPaymentModal');
const closePaymentModalBtn = document.getElementById('closePaymentModal');
const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
const addPaymentForm = document.getElementById('addPaymentForm');
const paymentModalSupplierName = document.getElementById('paymentModalSupplierName');
const paymentAmountInput = document.getElementById('paymentAmount');
const paymentDateInput = document.getElementById('paymentDate');
const paymentMethodSelect = document.getElementById('paymentMethod');
const paymentNotesInput = document.getElementById('paymentNotes');
const savePaymentBtn = document.getElementById('savePaymentBtn');
const paymentFormError = document.getElementById('paymentFormError');

// --- Utility Functions ---
// (These should ideally be in a shared utils.js file, but including here for now)
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { try { unsafe = String(unsafe ?? ''); } catch (e) { unsafe = ''; } } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function formatCurrency(amount) { const num = Number(amount); if (isNaN(num)) return 'N/A'; return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatDate(timestamp) { if (!timestamp || typeof timestamp.toDate !== 'function') return '-'; try { return timestamp.toDate().toLocaleDateString('en-GB'); } catch (e) { console.error("Error formatting date:", e); return '-'; } }

// --- Show/Hide Loading/Error ---
function setLoadingState(tableBody, loadingRow, errorDiv, isLoading, message = 'Loading...') {
    if (!tableBody || !loadingRow || !errorDiv) return;
    if (isLoading) {
        tableBody.innerHTML = ''; // Clear previous data
        loadingRow.style.display = 'table-row';
        const loadingCell = loadingRow.querySelector('td');
        if (loadingCell) {
             loadingCell.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${escapeHtml(message)}`;
        }
        errorDiv.style.display = 'none';
    } else {
        loadingRow.style.display = 'none';
    }
}
function setSummaryLoadingState(isLoading){
     const loadingText = '<span class="loading-state">Calculating...</span>';
     if(summaryTotalPoValue) summaryTotalPoValue.innerHTML = isLoading ? loadingText : formatCurrency(0);
     if(summaryTotalPaid) summaryTotalPaid.innerHTML = isLoading ? loadingText : formatCurrency(0);
     if(summaryBalance) {
        summaryBalance.innerHTML = isLoading ? loadingText : formatCurrency(0);
        summaryBalance.className = 'balance-info loading-state'; // Reset class
     }
}
function showError(errorDiv, message) {
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = message ? 'block' : 'none';
    }
}


// --- Main Initialization Function ---
async function initializeSupplierDetailPage(user) {
    console.log("Initializing Supplier Detail Page...");
    const urlParams = new URLSearchParams(window.location.search);
    currentSupplierId = urlParams.get('id');

    if (!currentSupplierId) {
        console.error("Supplier ID missing from URL.");
        document.getElementById('detailMainContent').innerHTML = "<p class='error-message' style='padding:20px;'>Error: Supplier ID not found in URL. Please go back to the supplier list and select a supplier.</p>";
        return;
    }

    console.log("Supplier ID:", currentSupplierId);
    // Setup basic event listeners
    setupDetailEventListeners();
    // Load all data for this supplier
    await loadSupplierAccountData();
}
// Make it accessible globally for the HTML script block
window.initializeSupplierDetailPage = initializeSupplierDetailPage;


// --- Data Loading ---
async function loadSupplierAccountData() {
    if (!currentSupplierId || !window.db || !window.doc || !window.getDoc) {
        console.error("Missing Supplier ID or DB functions for loading data.");
        showError(supplierPoListError, "Initialization error."); // Show error in a visible place
        showError(supplierPaymentListError, "Initialization error.");
        setSummaryLoadingState(false);
        return;
    }

    // Set initial loading states
    setLoadingState(supplierPoTableBody, supplierPoLoading, supplierPoListError, true, 'Loading POs...');
    setLoadingState(supplierPaymentsTableBody, supplierPaymentLoading, supplierPaymentListError, true, 'Loading payments...');
    setSummaryLoadingState(true);
    // Clear supplier detail fields initially
     displaySupplierDetails({}); // Pass empty object to clear fields

    try {
        // 1. Fetch Supplier Details
        console.log(`Workspaceing details for supplier ID: ${currentSupplierId}`);
        const supplierRef = window.doc(window.db, "suppliers", currentSupplierId);
        const supplierSnap = await window.getDoc(supplierRef);

        if (!supplierSnap.exists()) {
            throw new Error(`Supplier with ID ${currentSupplierId} not found.`);
        }
        currentSupplierData = { id: supplierSnap.id, ...supplierSnap.data() };
        console.log("Supplier Data:", currentSupplierData);
        displaySupplierDetails(currentSupplierData); // Display supplier details

        // 2. Fetch POs and Payments concurrently
        console.log("Fetching POs and Payments concurrently...");
        const [poResult, paymentResult] = await Promise.allSettled([
            loadSupplierPOs(),
            loadSupplierPayments()
        ]);

        let poTotal = 0;
        if (poResult.status === 'fulfilled') {
            poTotal = poResult.value; // Function returns the total PO value
            console.log("PO Total Value:", poTotal);
        } else {
            console.error("Failed to load POs:", poResult.reason);
            showError(supplierPoListError, `Error loading POs: ${poResult.reason.message || 'Unknown error'}`);
        }

        let paidTotal = 0;
        if (paymentResult.status === 'fulfilled') {
            paidTotal = paymentResult.value; // Function returns the total paid amount
            console.log("Total Payments Made:", paidTotal);
        } else {
            console.error("Failed to load payments:", paymentResult.reason);
             // Handle specific index error for payments
             if (paymentResult.reason.code === 'failed-precondition') {
                 const errorMsg = `Error: Firestore index missing for 'supplier_payments'. Please create index on 'supplierId' (asc) and 'paymentDate' (desc).`;
                 console.error(errorMsg);
                 showError(supplierPaymentListError, errorMsg);
             } else {
                 showError(supplierPaymentListError, `Error loading payments: ${paymentResult.reason.message || 'Unknown error'}`);
             }
        }

        // 3. Calculate and Display Balance
        calculateAndDisplayBalance(poTotal, paidTotal);
        setSummaryLoadingState(false); // Hide loading state for summary


    } catch (error) {
        console.error("Error loading supplier account data:", error);
        const mainContentArea = document.getElementById('detailMainContent');
        if(mainContentArea){
            mainContentArea.innerHTML = `<p class='error-message' style='padding:20px;'>Error loading supplier data: ${escapeHtml(error.message)}</p>`;
        }
        setSummaryLoadingState(false); // Hide loading state even on error
    }
}

function displaySupplierDetails(supplierData) {
    const name = escapeHtml(supplierData.name || 'N/A');
    if(supplierNameHeader) supplierNameHeader.textContent = name;
    if(supplierNameBreadcrumb) supplierNameBreadcrumb.textContent = name;
    document.title = `Account - ${name}`;

    // Clear previous loading state by setting text content
    if(detailSupplierId) detailSupplierId.textContent = escapeHtml(supplierData.id || 'N/A');
    if(detailSupplierName) detailSupplierName.textContent = name;
    if(detailSupplierCompany) detailSupplierCompany.textContent = escapeHtml(supplierData.companyName || '-');
    if(detailSupplierWhatsapp) detailSupplierWhatsapp.textContent = escapeHtml(supplierData.whatsappNo || '-');
    if(detailSupplierEmail) detailSupplierEmail.textContent = escapeHtml(supplierData.email || '-');
    if(detailSupplierGst) detailSupplierGst.textContent = escapeHtml(supplierData.gstNo || '-');
    if(detailSupplierAddress) detailSupplierAddress.textContent = escapeHtml(supplierData.address || '-');

    // Update payment modal title
     if(paymentModalSupplierName) paymentModalSupplierName.textContent = name;
}

async function loadSupplierPOs() {
    // Check necessary functions/variables
    if (!currentSupplierId || !window.db || !window.collection || !window.query || !window.where || !window.orderBy || !window.getDocs || !supplierPoTableBody || !supplierPoLoading || !supplierPoListError) {
        console.error("loadSupplierPOs: Prerequisites missing.");
        showError(supplierPoListError, "Could not load POs: Initialization error.");
        return 0;
    }

    let totalValue = 0;
    setLoadingState(supplierPoTableBody, supplierPoLoading, supplierPoListError, true, 'Loading POs...');

    try {
        const q = window.query(
            window.collection(window.db, "purchaseOrders"),
            where("supplierId", "==", currentSupplierId),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await window.getDocs(q);

        setLoadingState(supplierPoTableBody, supplierPoLoading, supplierPoListError, false); // Stop loading

        if (querySnapshot.empty) {
            supplierPoTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 15px;">No purchase orders found for this supplier.</td></tr>';
        } else {
            querySnapshot.forEach(docSnap => {
                const po = docSnap.data();
                const poId = docSnap.id;
                // *** Balance Calculation Logic: Include PO value in total ***
                // Decision: Sum all POs for now. Refine later to only sum 'Received' if needed.
                totalValue += Number(po.totalAmount || 0);

                const tr = supplierPoTableBody.insertRow();
                tr.setAttribute('data-id', poId);

                let paymentStatusText = po.paymentStatus || 'Pending'; // Placeholder for payment status
                let paymentStatusClass = paymentStatusText.toLowerCase().replace(/\s+/g, '-');
                let statusText = po.status || 'Unknown';
                let statusClass = statusText.toLowerCase().replace(/\s+/g, '-');

                tr.innerHTML = `
                    <td>${escapeHtml(po.poNumber || 'N/A')}</td>
                    <td>${formatDate(po.orderDate || po.createdAt)}</td>
                    <td style="text-align: right;">${formatCurrency(po.totalAmount || 0)}</td>
                    <td><span class="status-badge status-${statusClass}">${escapeHtml(statusText)}</span></td>
                    <td><span class="payment-badge payment-${paymentStatusClass}">${escapeHtml(paymentStatusText)}</span></td>
                 `;
                // Add action buttons for PO row if needed
            });
        }
        console.log(`Loaded ${querySnapshot.size} POs for supplier ${currentSupplierId}`);
        return totalValue; // Return total PO value

    } catch (error) {
        console.error("Error loading supplier POs:", error);
        setLoadingState(supplierPoTableBody, supplierPoLoading, supplierPoListError, false);
        showError(supplierPoListError, `Error loading POs: ${error.message}`);
        return 0; // Return 0 on error
    }
}

async function loadSupplierPayments() {
     // Check necessary functions/variables
     if (!currentSupplierId || !window.db || !window.collection || !window.query || !window.where || !window.orderBy || !window.getDocs || !supplierPaymentsTableBody || !supplierPaymentLoading || !supplierPaymentListError) {
        console.error("loadSupplierPayments: Prerequisites missing.");
        showError(supplierPaymentListError, "Could not load payments: Initialization error.");
        return 0;
    }

    let totalPaid = 0;
    setLoadingState(supplierPaymentsTableBody, supplierPaymentLoading, supplierPaymentListError, true, 'Loading payments...');

    try {
        const q = window.query(
            window.collection(window.db, "supplier_payments"), // Query the new collection
            where("supplierId", "==", currentSupplierId),
            orderBy("paymentDate", "desc")
        );
        const querySnapshot = await window.getDocs(q);

        setLoadingState(supplierPaymentsTableBody, supplierPaymentLoading, supplierPaymentListError, false); // Stop loading

        if (querySnapshot.empty) {
            supplierPaymentsTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 15px;">No payments recorded yet.</td></tr>';
        } else {
            querySnapshot.forEach(docSnap => {
                const payment = docSnap.data();
                const paymentId = docSnap.id;
                totalPaid += Number(payment.paymentAmount || 0); // Sum payment amount

                const tr = supplierPaymentsTableBody.insertRow();
                tr.setAttribute('data-id', paymentId);

                tr.innerHTML = `
                    <td>${formatDate(payment.paymentDate)}</td>
                    <td style="text-align: right;">${formatCurrency(payment.paymentAmount || 0)}</td>
                    <td>${escapeHtml(payment.paymentMethod || '-')}</td>
                    <td>${escapeHtml(payment.notes || '-')}</td>
                 `;
                // Add action buttons (e.g., delete payment) if needed later
            });
        }
        console.log(`Loaded ${querySnapshot.size} payments for supplier ${currentSupplierId}`);
        return totalPaid; // Return total paid amount

    } catch (error) {
        console.error("Error loading supplier payments:", error);
        if (error.code === 'failed-precondition') {
             const errorMsg = `Error: Firestore index missing for 'supplier_payments'. Create index on 'supplierId' (asc) and 'paymentDate' (desc).`;
             console.error(errorMsg);
             showError(supplierPaymentListError, errorMsg);
        } else {
            showError(supplierPaymentListError, `Error loading payments: ${error.message}`);
        }
        setLoadingState(supplierPaymentsTableBody, supplierPaymentLoading, supplierPaymentListError, false);
        return 0; // Return 0 on error
    }
}

function calculateAndDisplayBalance(poTotal, paidTotal) {
    const balance = poTotal - paidTotal; // Positive means we owe supplier

    if(summaryTotalPoValue) summaryTotalPoValue.textContent = formatCurrency(poTotal);
    if(summaryTotalPaid) summaryTotalPaid.textContent = formatCurrency(paidTotal);

    if (summaryBalance) {
        summaryBalance.classList.remove('loading-state', 'balance-due', 'balance-credit', 'balance-info');
        const tolerance = 0.01;

        if (balance > tolerance) { // We Owe (Debit balance from our perspective, but Credit for supplier)
            summaryBalance.textContent = formatCurrency(balance) + " Payable"; // Text indicating amount to pay
            summaryBalance.classList.add('balance-due'); // Show in Red (we need to pay)
        } else if (balance < -tolerance) { // Supplier Owes Us / Advance Paid
            summaryBalance.textContent = formatCurrency(Math.abs(balance)) + " Advance"; // Text indicating advance
            summaryBalance.classList.add('balance-credit'); // Show in Green (we have credit)
        } else { // Zero balance
            summaryBalance.textContent = formatCurrency(0);
            summaryBalance.classList.add('balance-info'); // Neutral color
        }
    }
     console.log(`Balance Calculated: PO Total=${poTotal}, Paid Total=${paidTotal}, Balance=${balance}`);
}


// --- Event Listeners ---
function setupDetailEventListeners() {
    // Add Payment Modal Open Button
    if (addPaymentMadeBtn) {
        addPaymentMadeBtn.addEventListener('click', openAddPaymentModal);
    }

    // Add Payment Modal Close/Cancel Buttons
    if (closePaymentModalBtn) closePaymentModalBtn.addEventListener('click', closeAddPaymentModal);
    if (cancelPaymentBtn) cancelPaymentBtn.addEventListener('click', closeAddPaymentModal);
    if (addPaymentModal) {
        addPaymentModal.addEventListener('click', (event) => {
            if (event.target === addPaymentModal) closeAddPaymentModal();
        });
    }

    // Add Payment Form Submit (Logic will be added in Step 4)
    if (addPaymentForm) {
        addPaymentForm.addEventListener('submit', handleSavePayment); // Defined below (basic implementation for now)
    }

    // Edit Supplier Button (Placeholder)
     if (editSupplierDetailsBtn) {
        editSupplierDetailsBtn.addEventListener('click', () => {
            if (currentSupplierData) {
                 alert("Edit Supplier functionality needs to connect to the supplier edit modal. This could involve making the modal function global or redirecting.");
                // Example redirection (if supplier_management handles #edit=ID):
                // window.location.href = `supplier_management.html#edit=${currentSupplierId}`;
            }
        });
    }
    console.log("Detail Page Event Listeners Setup.");
}

// --- Add Payment Modal Functions ---
function openAddPaymentModal() {
    if (!addPaymentModal || !currentSupplierData) {
        alert("Cannot open payment modal."); return;
    }
    addPaymentForm.reset();
    if(paymentFormError) paymentFormError.style.display = 'none';
    if(paymentModalSupplierName) paymentModalSupplierName.textContent = currentSupplierData.name || '';
    if(paymentDateInput) { try { paymentDateInput.valueAsDate = new Date(); } catch(e){} }
    if(savePaymentBtn) { savePaymentBtn.disabled = false; savePaymentBtn.innerHTML = '<i class="fas fa-save"></i> Save Payment'; }
    addPaymentModal.classList.add('active');
    paymentAmountInput.focus();
}

function closeAddPaymentModal() {
    if (addPaymentModal) { addPaymentModal.classList.remove('active'); }
}

// --- Save Payment Function (STEP 4 - Basic Implementation) ---
async function handleSavePayment(event) {
    event.preventDefault();
    // Use globally defined functions via window object
    if (!currentSupplierId || !window.db || !window.collection || !window.addDoc || !window.Timestamp || !window.serverTimestamp) {
         showPaymentFormError("Error: DB functions missing or Supplier ID invalid.");
         return;
    }

    const amount = parseFloat(paymentAmountInput.value);
    const date = paymentDateInput.value;
    const method = paymentMethodSelect.value;
    const notes = paymentNotesInput.value.trim();

    // Basic Validation
    if (isNaN(amount) || amount <= 0) { showPaymentFormError("Please enter a valid positive payment amount."); paymentAmountInput.focus(); return; }
    if (!date) { showPaymentFormError("Please select a payment date."); paymentDateInput.focus(); return; }

    if(savePaymentBtn) { savePaymentBtn.disabled = true; savePaymentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }
    showPaymentFormError('');

    try {
        const paymentDateTimestamp = window.Timestamp.fromDate(new Date(date + 'T00:00:00')); // Use window.Timestamp
        const paymentData = {
            supplierId: currentSupplierId,
            supplierName: currentSupplierData?.name || null,
            paymentAmount: amount,
            paymentDate: paymentDateTimestamp,
            paymentMethod: method,
            notes: notes || null,
            createdAt: window.serverTimestamp() // Use window.serverTimestamp
        };

        // Add to the 'supplier_payments' collection
        const docRef = await window.addDoc(window.collection(window.db, "supplier_payments"), paymentData);
        console.log("Payment recorded successfully with ID:", docRef.id);
        alert("Payment recorded successfully!");

        closeAddPaymentModal();

        // Refresh payments list and summary only after successful save
        await loadSupplierAccountData(); // Reload all account data to update summary and lists

    } catch (error) {
        console.error("Error saving payment:", error);
        showPaymentFormError(`Error saving payment: ${error.message}`);
    } finally {
         if(savePaymentBtn) {
            savePaymentBtn.disabled = false;
            savePaymentBtn.innerHTML = '<i class="fas fa-save"></i> Save Payment';
        }
    }
}

function showPaymentFormError(message) {
    if (paymentFormError) {
        paymentFormError.textContent = message;
        paymentFormError.style.display = message ? 'block' : 'none';
    } else {
        if(message) alert(message); // Fallback
    }
}


console.log("supplier_account_detail.js v1 loaded.");