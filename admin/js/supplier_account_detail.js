// js/supplier_account_detail.js - v1 (Step 3: Load & Display Supplier Account Data)

// --- Global Variables ---
let currentSupplierId = null;
let currentSupplierData = null;

// --- DOM References ---
// Header/Breadcrumb
const supplierNameHeader = document.getElementById('supplierNameHeader');
const supplierNameBreadcrumb = document.getElementById('supplierNameBreadcrumb');

// Action Buttons
const addPaymentMadeBtn = document.getElementById('addPaymentMadeBtn');
const editSupplierDetailsBtn = document.getElementById('editSupplierDetailsBtn'); // Placeholder for edit functionality

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

// Add Payment Modal
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
// (Copied from supplier_management.js - ensure consistency or use utils.js)
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') { try { unsafe = String(unsafe ?? ''); } catch (e) { unsafe = ''; } } return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function formatCurrency(amount) { const num = Number(amount); if (isNaN(num)) return 'N/A'; return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatDate(timestamp) { if (!timestamp || typeof timestamp.toDate !== 'function') return '-'; try { return timestamp.toDate().toLocaleDateString('en-GB'); } catch (e) { console.error("Error formatting date:", e); return '-'; } }

// --- Show/Hide Loading/Error ---
function setLoadingState(tableBody, loadingRow, errorDiv, isLoading, message = 'Loading...') {
    if (isLoading) {
        if (tableBody) tableBody.innerHTML = ''; // Clear previous data
        if (loadingRow) {
             loadingRow.style.display = 'table-row';
             loadingRow.querySelector('td').innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${escapeHtml(message)}`;
        }
        if(errorDiv) errorDiv.style.display = 'none';
    } else {
        if (loadingRow) loadingRow.style.display = 'none';
    }
}
function setSummaryLoadingState(isLoading){
     const loadingText = '<span class="loading-state">Calculating...</span>';
     if(summaryTotalPoValue) summaryTotalPoValue.innerHTML = isLoading ? loadingText : '₹ 0.00';
     if(summaryTotalPaid) summaryTotalPaid.innerHTML = isLoading ? loadingText : '₹ 0.00';
     if(summaryBalance) {
        summaryBalance.innerHTML = isLoading ? loadingText : '₹ 0.00';
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
        document.getElementById('detailMainContent').innerHTML = "<p class='error-message'>Error: Supplier ID not found in URL. Please go back to the supplier list and select a supplier.</p>";
        return;
    }

    console.log("Supplier ID:", currentSupplierId);

    // Setup basic event listeners (modal open/close, etc.)
    setupDetailEventListeners();

    // Load all data for this supplier
    await loadSupplierAccountData();
}
window.initializeSupplierDetailPage = initializeSupplierDetailPage; // Make it accessible globally


// --- Data Loading ---
async function loadSupplierAccountData() {
    if (!currentSupplierId || !window.db) {
        console.error("Missing Supplier ID or DB connection for loading data.");
        return;
    }

    // Set initial loading states
    setLoadingState(supplierPoTableBody, supplierPoLoading, supplierPoListError, true, 'Loading POs...');
    setLoadingState(supplierPaymentsTableBody, supplierPaymentLoading, supplierPaymentListError, true, 'Loading payments...');
    setSummaryLoadingState(true);


    try {
        // 1. Fetch Supplier Details
        const supplierRef = window.doc(window.db, "suppliers", currentSupplierId);
        const supplierSnap = await window.getDoc(supplierRef);

        if (!supplierSnap.exists()) {
            throw new Error("Supplier not found.");
        }
        currentSupplierData = { id: supplierSnap.id, ...supplierSnap.data() };
        displaySupplierDetails(currentSupplierData);

        // 2. Fetch POs and Payments concurrently
        const [poResult, paymentResult] = await Promise.allSettled([
            loadSupplierPOs(),
            loadSupplierPayments()
        ]);

        let poTotal = 0;
        if (poResult.status === 'fulfilled') {
            poTotal = poResult.value; // Function returns the total PO value
        } else {
            console.error("Failed to load POs:", poResult.reason);
            showError(supplierPoListError, `Error loading POs: ${poResult.reason.message}`);
        }

        let paidTotal = 0;
        if (paymentResult.status === 'fulfilled') {
            paidTotal = paymentResult.value; // Function returns the total paid amount
        } else {
            console.error("Failed to load payments:", paymentResult.reason);
            showError(supplierPaymentListError, `Error loading payments: ${paymentResult.reason.message}`);
        }

        // 3. Calculate and Display Balance
        calculateAndDisplayBalance(poTotal, paidTotal);
        setSummaryLoadingState(false); // Hide loading state for summary


    } catch (error) {
        console.error("Error loading supplier account data:", error);
        document.getElementById('detailMainContent').innerHTML = `<p class='error-message'>Error loading supplier data: ${error.message}</p>`;
        setSummaryLoadingState(false); // Hide loading state even on error
    }
}

function displaySupplierDetails(supplierData) {
    const name = escapeHtml(supplierData.name || 'N/A');
    if(supplierNameHeader) supplierNameHeader.textContent = name;
    if(supplierNameBreadcrumb) supplierNameBreadcrumb.textContent = name;
    document.title = `Account - ${name}`; // Update page title

    if(detailSupplierId) detailSupplierId.textContent = escapeHtml(supplierData.id);
    if(detailSupplierName) detailSupplierName.textContent = name;
    if(detailSupplierCompany) detailSupplierCompany.textContent = escapeHtml(supplierData.companyName || '-');
    if(detailSupplierWhatsapp) detailSupplierWhatsapp.textContent = escapeHtml(supplierData.whatsappNo || '-');
    if(detailSupplierEmail) detailSupplierEmail.textContent = escapeHtml(supplierData.email || '-');
    if(detailSupplierGst) detailSupplierGst.textContent = escapeHtml(supplierData.gstNo || '-');
    if(detailSupplierAddress) detailSupplierAddress.textContent = escapeHtml(supplierData.address || '-');

    // Update payment modal title as well
     if(paymentModalSupplierName) paymentModalSupplierName.textContent = name;
}

async function loadSupplierPOs() {
    let totalValue = 0;
    setLoadingState(supplierPoTableBody, supplierPoLoading, supplierPoListError, true, 'Loading POs...');

    try {
        const q = window.query(
            window.collection(window.db, "purchaseOrders"),
            where("supplierId", "==", currentSupplierId),
            orderBy("createdAt", "desc") // Show newest POs first
        );
        const querySnapshot = await window.getDocs(q);

        setLoadingState(supplierPoTableBody, supplierPoLoading, supplierPoListError, false); // Stop loading indicator

        if (querySnapshot.empty) {
            supplierPoTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No purchase orders found for this supplier.</td></tr>';
        } else {
            querySnapshot.forEach(docSnap => {
                const po = docSnap.data();
                const poId = docSnap.id;
                totalValue += Number(po.totalAmount || 0); // Sum up total amount for balance

                const tr = supplierPoTableBody.insertRow();
                tr.setAttribute('data-id', poId);

                // Add Payment Status based on PO data (Placeholder)
                let paymentStatusText = po.paymentStatus || 'Pending';
                let paymentStatusClass = paymentStatusText.toLowerCase().replace(/\s+/g, '-');

                tr.innerHTML = `
                    <td>${escapeHtml(po.poNumber || 'N/A')}</td>
                    <td>${formatDate(po.orderDate || po.createdAt)}</td>
                    <td style="text-align: right;">${formatCurrency(po.totalAmount || 0)}</td>
                    <td><span class="status-badge status-${(po.status || 'unknown').toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(po.status || 'Unknown')}</span></td>
                    <td><span class="payment-badge payment-${paymentStatusClass}">${escapeHtml(paymentStatusText)}</span></td>
                 `;
                // Add action buttons if needed later
            });
        }
        console.log(`Loaded ${querySnapshot.size} POs for supplier ${currentSupplierId}`);
        return totalValue; // Return total value for balance calculation

    } catch (error) {
        console.error("Error loading supplier POs:", error);
        setLoadingState(supplierPoTableBody, supplierPoLoading, supplierPoListError, false);
        showError(supplierPoListError, `Error loading POs: ${error.message}`);
        return 0; // Return 0 on error
    }
}

async function loadSupplierPayments() {
    let totalPaid = 0;
    setLoadingState(supplierPaymentsTableBody, supplierPaymentLoading, supplierPaymentListError, true, 'Loading payments...');

    try {
        // Query the NEW supplier_payments collection
        const q = window.query(
            window.collection(window.db, "supplier_payments"), // Use the new collection name
            where("supplierId", "==", currentSupplierId),
            orderBy("paymentDate", "desc") // Show most recent payments first
        );
        const querySnapshot = await window.getDocs(q);

        setLoadingState(supplierPaymentsTableBody, supplierPaymentLoading, supplierPaymentListError, false); // Stop loading

        if (querySnapshot.empty) {
            supplierPaymentsTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No payments recorded for this supplier yet.</td></tr>';
        } else {
            querySnapshot.forEach(docSnap => {
                const payment = docSnap.data();
                const paymentId = docSnap.id;
                totalPaid += Number(payment.paymentAmount || 0); // Sum up paid amount

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
        return totalPaid; // Return total paid for balance calculation

    } catch (error) {
        console.error("Error loading supplier payments:", error);
         // Check for index missing error specifically
        if (error.code === 'failed-precondition') {
             const errorMsg = `Error: Firestore index missing for 'supplier_payments' collection. Please create an index on 'supplierId' (ascending) and 'paymentDate' (descending) in your Firestore console.`;
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
    const balance = poTotal - paidTotal;

    if(summaryTotalPoValue) summaryTotalPoValue.textContent = formatCurrency(poTotal);
    if(summaryTotalPaid) summaryTotalPaid.textContent = formatCurrency(paidTotal);

    if (summaryBalance) {
        summaryBalance.classList.remove('loading-state', 'balance-due', 'balance-credit', 'balance-info'); // Clear classes
        const tolerance = 0.01; // Tolerance for floating point comparison

        if (balance > tolerance) { // Supplier needs to be paid (Due)
            summaryBalance.textContent = formatCurrency(balance) + " Dr"; // Amount we Owe
            summaryBalance.classList.add('balance-due'); // Show in red
        } else if (balance < -tolerance) { // We overpaid or have credit
            summaryBalance.textContent = formatCurrency(Math.abs(balance)) + " Cr"; // Amount in Credit
            summaryBalance.classList.add('balance-credit'); // Show in green
        } else { // Zero balance
            summaryBalance.textContent = formatCurrency(0);
            summaryBalance.classList.add('balance-info'); // Neutral color
        }
    }
}


// --- Event Listeners ---
function setupDetailEventListeners() {
    // Add Payment Modal Open Button
    if (addPaymentMadeBtn) {
        addPaymentMadeBtn.addEventListener('click', openAddPaymentModal);
    }

    // Add Payment Modal Close/Cancel Buttons
    if (closePaymentModalBtn) {
        closePaymentModalBtn.addEventListener('click', closeAddPaymentModal);
    }
    if (cancelPaymentBtn) {
        cancelPaymentBtn.addEventListener('click', closeAddPaymentModal);
    }
    if (addPaymentModal) { // Close if clicking outside the content
        addPaymentModal.addEventListener('click', (event) => {
            if (event.target === addPaymentModal) {
                closeAddPaymentModal();
            }
        });
    }

    // Add Payment Form Submit (Placeholder for Step 4)
    if (addPaymentForm) {
        addPaymentForm.addEventListener('submit', handleSavePayment); // Function defined below
    }

    // Edit Supplier Button (Placeholder - needs implementation)
     if (editSupplierDetailsBtn) {
        editSupplierDetailsBtn.addEventListener('click', () => {
            if (currentSupplierData) {
                // Option 1: Redirect back to supplier_management with an edit flag/modal open
                // window.location.href = `supplier_management.html#edit=${currentSupplierId}`; // Needs handling on that page
                // Option 2: Reuse the supplier modal from supplier_management.js (Requires importing/making it global or duplicating)
                alert("Edit Supplier functionality needs to be implemented (e.g., reusing the modal).");
                // Example if modal function was globally available/imported:
                // openSupplierModal('edit', currentSupplierData, currentSupplierId);
            } else {
                alert("Supplier data not loaded yet.");
            }
        });
    }
}

// --- Add Payment Modal Functions ---
function openAddPaymentModal() {
    if (!addPaymentModal || !currentSupplierData) {
        alert("Cannot open payment modal. Supplier data missing or modal element not found.");
        return;
    }
    console.log("Opening Add Payment modal.");
    addPaymentForm.reset(); // Clear the form
    if(paymentFormError) paymentFormError.style.display = 'none';
    if(paymentModalSupplierName) paymentModalSupplierName.textContent = currentSupplierData.name || '';
    if(paymentDateInput) { try { paymentDateInput.valueAsDate = new Date(); } catch(e){} } // Default to today
    if(savePaymentBtn) {
        savePaymentBtn.disabled = false;
        savePaymentBtn.innerHTML = '<i class="fas fa-save"></i> Save Payment';
    }
    addPaymentModal.classList.add('active');
    paymentAmountInput.focus();
}

function closeAddPaymentModal() {
    if (addPaymentModal) {
        addPaymentModal.classList.remove('active');
    }
}

// --- Save Payment Function (STEP 4 - Placeholder Logic) ---
async function handleSavePayment(event) {
    event.preventDefault();
     if (!currentSupplierId || !window.db || !window.collection || !window.addDoc || !window.Timestamp || !window.serverTimestamp) {
         showPaymentFormError("Error: Database functions missing or Supplier ID invalid.");
         return;
     }

    const amount = parseFloat(paymentAmountInput.value);
    const date = paymentDateInput.value;
    const method = paymentMethodSelect.value;
    const notes = paymentNotesInput.value.trim();

    if (isNaN(amount) || amount <= 0) {
        showPaymentFormError("Please enter a valid positive payment amount.");
        paymentAmountInput.focus();
        return;
    }
    if (!date) {
        showPaymentFormError("Please select a payment date.");
        paymentDateInput.focus();
        return;
    }

    if(savePaymentBtn) {
        savePaymentBtn.disabled = true;
        savePaymentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }
    showPaymentFormError(''); // Clear previous errors

    try {
        const paymentDateTimestamp = Timestamp.fromDate(new Date(date + 'T00:00:00')); // Store date only
        const paymentData = {
            supplierId: currentSupplierId,
            supplierName: currentSupplierData?.name || null, // Store name for easier display later
            paymentAmount: amount,
            paymentDate: paymentDateTimestamp,
            paymentMethod: method,
            notes: notes || null,
            createdAt: serverTimestamp() // Record when the payment was logged
        };

        // Add to the 'supplier_payments' collection
        const docRef = await window.addDoc(window.collection(window.db, "supplier_payments"), paymentData);
        console.log("Payment recorded successfully with ID:", docRef.id);
        alert("Payment recorded successfully!");

        closeAddPaymentModal();

        // Refresh payments list and summary after saving
        const paidTotal = await loadSupplierPayments(); // Reload payments
        const currentPoTotalText = summaryTotalPoValue?.textContent || '₹ 0';
        const currentPoTotal = parseFloat(currentPoTotalText.replace(/[^0-9.-]+/g,"")) || 0;
        calculateAndDisplayBalance(currentPoTotal, paidTotal); // Recalculate balance

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