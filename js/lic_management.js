// js/lic_management.js
// Updated for Phase 1 & Phase 2 Features + Debugging Logs

// --- सुनिश्चित करें कि ग्लोबल Firebase फंक्शन्स उपलब्ध हैं ---
const {
    db, collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp,
    query, where, orderBy, limit, Timestamp, runTransaction, onSnapshot
} = window;

// --- DOM एलिमेंट वेरिएबल्स ---
let licPolicyTableBody, reminderList, policyModal, policyForm, policyModalTitle, editPolicyId,
    addNewPolicyBtn, closePolicyModalBtn, cancelPolicyBtn, savePolicyBtn,
    licSearchInput, sortLicSelect, clearLicFiltersBtn,
    // Modal के अंदर के status/nach elements
    policyStatusModal, nachStatusModal,
    // Filter bar elements
    licStatusFilter, licPlanFilter, licModeFilter, licNachFilter,
    // Task Management Elements
    newTaskInput, newTaskDueDate, addTaskBtn, taskList,
    // --- Phase 2 Elements ---
    // Dashboard elements
    dbTotalPoliciesEl, dbActivePoliciesEl, dbLapsedPoliciesEl, dbUpcomingPremiumEl, dbUpcomingMaturityEl,
    // Client Detail View elements
    clientDetailModal, closeClientDetailBtn, closeClientDetailBtnBottom,
    clientDetailNameEl, clientDetailContentEl,
    clientDetailMobileEl, clientDetailDobEl, clientDetailFatherNameEl, clientDetailAddressEl,
    clientPoliciesListEl, communicationLogListEl,
    newLogNoteEl, addLogBtn;


// --- ग्लोबल स्टेट ---
let currentLicSortField = 'createdAt';
let currentLicSortDirection = 'desc';
let unsubscribePolicies = null; // Firestore policy listener
let unsubscribeTasks = null; // Firestore task listener
let allPoliciesCache = []; // सभी पॉलिसियों का कैश
let searchDebounceTimerLic;
let currentOpenClientId = null; // Track which client detail is open (use policyId or customerName/ID)


// --- पेज इनिशियलाइज़ेशन ---
window.initializeLicPage = function() { // Make it globally accessible
    console.log("Initializing LIC Management Page...");

    // --- DOM एलिमेंट्स प्राप्त करें ---
    licPolicyTableBody = document.getElementById('licPolicyTableBody');
    reminderList = document.getElementById('reminderList');
    policyModal = document.getElementById('policyModal'); // Add/Edit Policy Modal
    policyForm = document.getElementById('policyForm');
    policyModalTitle = document.getElementById('policyModalTitle');
    editPolicyId = document.getElementById('editPolicyId');
    addNewPolicyBtn = document.getElementById('addNewPolicyBtn'); // <<<<< यह
    closePolicyModalBtn = document.getElementById('closePolicyModal'); // Policy Modal Close
    cancelPolicyBtn = document.getElementById('cancelPolicyBtn'); // Policy Modal Cancel
    savePolicyBtn = document.getElementById('savePolicyBtn');
    licSearchInput = document.getElementById('licSearchInput');
    sortLicSelect = document.getElementById('sort-lic');
    clearLicFiltersBtn = document.getElementById('clearLicFiltersBtn');
    // Modal dropdowns (Policy Add/Edit)
    policyStatusModal = document.getElementById('policyStatus');
    nachStatusModal = document.getElementById('nachStatus');
    // Filter bar dropdowns/inputs
    licStatusFilter = document.getElementById('licStatusFilter');
    licPlanFilter = document.getElementById('licPlanFilter');
    licModeFilter = document.getElementById('licModeFilter');
    licNachFilter = document.getElementById('licNachFilter');
    // Task Management Elements
    newTaskInput = document.getElementById('newTaskInput');
    newTaskDueDate = document.getElementById('newTaskDueDate');
    addTaskBtn = document.getElementById('addTaskBtn');           // <<<<< यह
    taskList = document.getElementById('taskList');

    // --- Phase 2: Get Dashboard Elements ---
    dbTotalPoliciesEl = document.getElementById('dbTotalPolicies');
    dbActivePoliciesEl = document.getElementById('dbActivePolicies');
    dbLapsedPoliciesEl = document.getElementById('dbLapsedPolicies');
    dbUpcomingPremiumEl = document.getElementById('dbUpcomingPremium');
    dbUpcomingMaturityEl = document.getElementById('dbUpcomingMaturity');

    // --- Phase 2: Get Client Detail View Elements ---
    clientDetailModal = document.getElementById('clientDetailView');
    closeClientDetailBtn = document.getElementById('closeClientDetail'); // Top X button
    closeClientDetailBtnBottom = document.getElementById('closeClientDetailBtnBottom'); // Bottom close button
    clientDetailNameEl = document.getElementById('clientDetailName');
    clientDetailContentEl = document.getElementById('clientDetailContent');
    clientDetailMobileEl = document.getElementById('clientDetailMobile');
    clientDetailDobEl = document.getElementById('clientDetailDob');
    clientDetailFatherNameEl = document.getElementById('clientDetailFatherName');
    clientDetailAddressEl = document.getElementById('clientDetailAddress');
    clientPoliciesListEl = document.getElementById('clientPoliciesList');
    communicationLogListEl = document.getElementById('communicationLogList');
    newLogNoteEl = document.getElementById('newLogNote');
    addLogBtn = document.getElementById('addLogBtn');


    // --- START: डीबगिंग लॉग्स यहाँ जोड़ें ---
    console.log('Debugging - Add New Policy Button Element:', addNewPolicyBtn);
    console.log('Debugging - Add Task Button Element:', addTaskBtn);
    // --- END: डीबगिंग लॉग्स ---


    // --- इवेंट लिस्टनर्स जोड़ें ---
    // Policy Modal Buttons
    if (addNewPolicyBtn) {
         console.log('Debugging - Attaching listener to Add New Policy button'); // डीबगिंग लॉग
         addNewPolicyBtn.addEventListener('click', () => openPolicyModal());
    } else {
         console.error('ERROR: Could not find Add New Policy button element!'); // एरर लॉग
    }
    if (closePolicyModalBtn) closePolicyModalBtn.addEventListener('click', closePolicyModal);
    if (cancelPolicyBtn) cancelPolicyBtn.addEventListener('click', closePolicyModal);
    if (policyModal) policyModal.addEventListener('click', (e) => { if (e.target === policyModal) closePolicyModal(); }); // Close policy modal on overlay click
    if (policyForm) policyForm.addEventListener('submit', handleSavePolicy);

    // Filter listeners
    if (licSearchInput) licSearchInput.addEventListener('input', handleLicFilterChange);
    if (licStatusFilter) licStatusFilter.addEventListener('change', handleLicFilterChange);
    if (licPlanFilter) licPlanFilter.addEventListener('input', handleLicFilterChange);
    if (licModeFilter) licModeFilter.addEventListener('change', handleLicFilterChange);
    if (licNachFilter) licNachFilter.addEventListener('change', handleLicFilterChange);
    if (sortLicSelect) sortLicSelect.addEventListener('change', handleLicSortChange);
    if (clearLicFiltersBtn) clearLicFiltersBtn.addEventListener('click', clearLicFilters);

    // Reminder Checkbox Listener (Event Delegation)
    if (reminderList) reminderList.addEventListener('change', handleReminderCheckboxChange);

    // Task Management Listeners
    if (addTaskBtn) {
         console.log('Debugging - Attaching listener to Add Task button'); // डीबगिंग लॉग
         addTaskBtn.addEventListener('click', handleAddTask);
    } else {
         console.error('ERROR: Could not find Add Task button element!'); // एरर लॉग
    }
    if (taskList) {
        taskList.addEventListener('change', handleTaskCheckboxChange);
        taskList.addEventListener('click', handleTaskActions);
    }

    // --- Phase 2: Client Detail Listeners ---
    if (closeClientDetailBtn) closeClientDetailBtn.addEventListener('click', closeClientDetail);
    if (closeClientDetailBtnBottom) closeClientDetailBtnBottom.addEventListener('click', closeClientDetail);
    if (clientDetailModal) clientDetailModal.addEventListener('click', (e) => { if (e.target === clientDetailModal) closeClientDetail(); }); // Close on overlay click
    if (addLogBtn) addLogBtn.addEventListener('click', addCommunicationNote);

    // --- Firestore से डेटा सुनना शुरू करें ---
    listenForPolicies(); // Policies Load
    listenForTasks();   // Tasks Load
    displayReminders(); // Reminders Load

    // --- Phase 2: Load initial dashboard data (called within policy listener) ---
}

// --- Firestore Listener (Policies) ---
function listenForPolicies() {
    if (!db) { console.error("DB not initialized"); return; }
    if (unsubscribePolicies) unsubscribePolicies();

    const policiesRef = collection(db, "licCustomers");
    const q = query(policiesRef);

    console.log("Starting policy listener...");
    unsubscribePolicies = onSnapshot(q, (snapshot) => {
        console.log(`Received ${snapshot.docs.length} policies.`);
        allPoliciesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        applyLicFiltersAndRender(); // Render Table
        displayReminders();         // Update Reminders
        loadDashboardData();        // Update Dashboard (Phase 2)
    }, (error) => {
        console.error("Error listening to policies:", error);
        if(licPolicyTableBody) licPolicyTableBody.innerHTML = `<tr><td colspan="9">Error loading policy data. Check console.</td></tr>`;
        // Clear dashboard on error too
        if(dbTotalPoliciesEl) dbTotalPoliciesEl.textContent = 'Error';
        if(dbActivePoliciesEl) dbActivePoliciesEl.textContent = 'Error';
        // ... clear other dashboard elements
    });
}

// --- Firestore Listener (Tasks) --- Phase 1 Fix
function listenForTasks() {
    if (!db) { console.error("DB not initialized for tasks"); return; }
    if (unsubscribeTasks) unsubscribeTasks();

    const tasksRef = collection(db, "tasks"); // Assume 'tasks' collection
    const q = query(tasksRef, orderBy("createdAt", "desc"));

    console.log("Starting task listener...");
    unsubscribeTasks = onSnapshot(q, (snapshot) => {
        console.log(`Received ${snapshot.docs.length} tasks.`);
        renderTaskList(snapshot.docs);
    }, (error) => {
        console.error("Error listening to tasks:", error);
        if(taskList) taskList.innerHTML = `<li class="error-tasks">Error loading tasks.</li>`;
    });
}


// --- फ़िल्टर, सॉर्ट और रेंडर (Policies) --- Updated for Phase 1 Filters
function applyLicFiltersAndRender() {
     if (!allPoliciesCache || !licPolicyTableBody) return;

     const searchTerm = licSearchInput ? licSearchInput.value.trim().toLowerCase() : '';
     const statusFilter = licStatusFilter ? licStatusFilter.value : '';
     const planFilter = licPlanFilter ? licPlanFilter.value.trim().toLowerCase() : '';
     const modeFilter = licModeFilter ? licModeFilter.value : '';
     const nachFilter = licNachFilter ? licNachFilter.value : '';

     // 1. फ़िल्टर करें
     let filteredPolicies = allPoliciesCache.filter(policy => {
         const searchMatch = searchTerm === '' ||
             (policy.customerName || '').toLowerCase().includes(searchTerm) ||
             (policy.policyNumber || '').toLowerCase().includes(searchTerm) ||
             (policy.mobileNo || '').toLowerCase().includes(searchTerm);
         const statusMatch = statusFilter === '' || (policy.policyStatus || '').toLowerCase() === statusFilter.toLowerCase();
         const planMatch = planFilter === '' || (policy.plan || '').toLowerCase().includes(planFilter);
         const modeMatch = modeFilter === '' || (policy.modeOfPayment || '') === modeFilter;
         const nachMatch = nachFilter === '' || (policy.nachStatus || '') === nachFilter;

         return searchMatch && statusMatch && planMatch && modeMatch && nachMatch;
     });

     // 2. सॉर्ट करें
     filteredPolicies.sort((a, b) => {
          let valA = a[currentLicSortField];
          let valB = b[currentLicSortField];

           if (valA && typeof valA.toDate === 'function') valA = valA.toDate();
           if (valB && typeof valB.toDate === 'function') valB = valB.toDate();

           if (currentLicSortField === 'premiumAmount' || currentLicSortField === 'sumAssured') {
               valA = Number(valA) || 0; valB = Number(valB) || 0;
           } else if (currentLicSortField === 'customerName' || currentLicSortField === 'policyNumber') {
                valA = (valA || '').toLowerCase(); valB = (valB || '').toLowerCase();
           } else if (valA instanceof Date && valB instanceof Date) {
               // Direct comparison works
           } else {
               valA = String(valA || '').toLowerCase(); valB = String(valB || '').toLowerCase();
           }

          let comparison = 0;
          if (valA > valB) comparison = 1;
          else if (valA < valB) comparison = -1;
          return currentLicSortDirection === 'desc' ? (comparison * -1) : comparison;
     });

     // 3. टेबल रेंडर करें
     renderPolicyTable(filteredPolicies);
}

// --- टेबल रेंडरिंग (Policies) --- Updated with Clickable Name (Phase 2)
function renderPolicyTable(policies) {
    if (!licPolicyTableBody) return;
    licPolicyTableBody.innerHTML = '';

    if (policies.length === 0) {
        licPolicyTableBody.innerHTML = `<tr><td colspan="9" style="text-align: center;">No policies found matching criteria.</td></tr>`;
        return;
    }

    policies.forEach(policy => {
        const row = licPolicyTableBody.insertRow();
        row.setAttribute('data-id', policy.id);

        // Basic details
        row.insertCell().textContent = policy.policyNumber || '-';

        // --- Customer Name Cell (Clickable for Phase 2) ---
        const nameCell = row.insertCell();
        const nameLink = document.createElement('a');
        nameLink.href = "#"; // Prevent page jump
        nameLink.textContent = policy.customerName || 'N/A';
        nameLink.title = `View details for ${policy.customerName || 'this client'}`;
        nameLink.style.cursor = 'pointer';
        nameLink.style.textDecoration = 'underline';
        nameLink.style.color = '#0056b3';
        // Store data needed by showClientDetail directly on the link
        nameLink.onclick = (e) => {
            e.preventDefault(); // Prevent default link behavior
            // Pass policy ID and name. Could pass full policy object if needed.
            // Using policy.id as the unique identifier for logs/details is better.
            showClientDetail(policy.id, policy.customerName);
        };
        nameCell.appendChild(nameLink);
        // --- End Customer Name Cell ---

        row.insertCell().textContent = policy.mobileNo || '-';
        row.insertCell().textContent = policy.plan || '-';
        row.insertCell().textContent = policy.premiumAmount ? `₹ ${Number(policy.premiumAmount).toFixed(2)}` : '-';
        row.insertCell().textContent = policy.modeOfPayment || '-';
        row.insertCell().textContent = policy.nextInstallmentDate?.toDate ? formatDate(policy.nextInstallmentDate.toDate()) : '-';
        row.insertCell().innerHTML = `<span class="status-badge status-${(policy.policyStatus || 'unknown').toLowerCase()}">${policy.policyStatus || 'Unknown'}</span>`;

        // Action Buttons Cell
        const actionCell = row.insertCell();
        actionCell.classList.add('action-buttons');

        // Edit Button
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<i class="fas fa-edit"></i>'; editBtn.title = "Edit Policy";
        editBtn.classList.add('button', 'edit-button');
        editBtn.onclick = (e) => { e.stopPropagation(); openPolicyModal(policy.id, policy); };
        actionCell.appendChild(editBtn);

        // Mark Paid Button (Phase 1)
        const payBtn = document.createElement('button');
        payBtn.innerHTML = '<i class="fas fa-check-circle"></i>'; payBtn.title = "Mark Premium Paid & Update Due Date";
        payBtn.classList.add('button', 'pay-button');
        payBtn.disabled = !['Active', 'Lapsed'].includes(policy.policyStatus) || !policy.nextInstallmentDate || !policy.modeOfPayment;
        payBtn.onclick = (e) => { e.stopPropagation(); handleMarkPaid(policy.id, policy); };
        actionCell.appendChild(payBtn);

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>'; deleteBtn.title = "Delete Policy";
        deleteBtn.classList.add('button', 'delete-button');
        deleteBtn.onclick = (e) => { e.stopPropagation(); handleDeletePolicy(policy.id, policy.policyNumber); };
        actionCell.appendChild(deleteBtn);
    });
}


// --- Modal खोलना/बंद करना (Policy Add/Edit) ---
function openPolicyModal(policyId = null, data = {}) {
    if (!policyModal || !policyForm) return;
    policyForm.reset(); // फॉर्म खाली करें
    editPolicyId.value = policyId || ''; // ID सेट करें (या खाली रखें)

    if (policyId) {
        // --- एडिट मोड ---
        policyModalTitle.textContent = "Edit Policy Details";
        document.getElementById('customerName').value = data.customerName || '';
        document.getElementById('fatherName').value = data.fatherName || '';
        document.getElementById('mobileNo').value = data.mobileNo || '';
        document.getElementById('dob').value = data.dob?.toDate ? data.dob.toDate().toISOString().split('T')[0] : '';
        document.getElementById('address').value = data.address || '';
        document.getElementById('policyNumber').value = data.policyNumber || '';
        document.getElementById('plan').value = data.plan || '';
        document.getElementById('sumAssured').value = data.sumAssured || '';
        document.getElementById('policyTerm').value = data.policyTerm || '';
        document.getElementById('issuanceDate').value = data.issuanceDate?.toDate ? data.issuanceDate.toDate().toISOString().split('T')[0] : '';
        document.getElementById('modeOfPayment').value = data.modeOfPayment || '';
        document.getElementById('premiumAmount').value = data.premiumAmount || '';
        document.getElementById('nextInstallmentDate').value = data.nextInstallmentDate?.toDate ? data.nextInstallmentDate.toDate().toISOString().split('T')[0] : '';
        document.getElementById('maturityDate').value = data.maturityDate?.toDate ? data.maturityDate.toDate().toISOString().split('T')[0] : '';
        if(policyStatusModal) policyStatusModal.value = data.policyStatus || 'Active'; // Use modal specific var
        if(nachStatusModal) nachStatusModal.value = data.nachStatus || 'No';       // Use modal specific var
    } else {
        // --- ऐड मोड ---
        policyModalTitle.textContent = "Add New Policy";
         if(policyStatusModal) policyStatusModal.value = 'Active'; // Use modal specific var
         if(nachStatusModal) nachStatusModal.value = 'No';       // Use modal specific var
         document.getElementById('nextInstallmentDate').value = ''; // Clear next date for calculation
    }
    policyModal.classList.add('active');
}

function closePolicyModal() {
    if (policyModal) policyModal.classList.remove('active');
}

// --- पॉलिसी सेव/अपडेट करना ---
async function handleSavePolicy(event) {
    event.preventDefault();
    if (!db) { alert("Database not ready."); return; }

    const policyId = editPolicyId.value;
    const isEditing = !!policyId;

    // --- फॉर्म से डेटा प्राप्त करें ---
    const formData = {
        customerName: document.getElementById('customerName').value.trim(),
        fatherName: document.getElementById('fatherName').value.trim(),
        mobileNo: document.getElementById('mobileNo').value.trim(),
        dob: document.getElementById('dob').value ? Timestamp.fromDate(new Date(document.getElementById('dob').value)) : null,
        address: document.getElementById('address').value.trim(),
        policyNumber: document.getElementById('policyNumber').value.trim(),
        plan: document.getElementById('plan').value.trim(),
        sumAssured: Number(document.getElementById('sumAssured').value) || 0,
        policyTerm: document.getElementById('policyTerm').value.trim(),
        issuanceDate: document.getElementById('issuanceDate').value ? Timestamp.fromDate(new Date(document.getElementById('issuanceDate').value + 'T00:00:00Z')) : null,
        modeOfPayment: document.getElementById('modeOfPayment').value,
        premiumAmount: parseFloat(document.getElementById('premiumAmount').value) || 0,
        maturityDate: document.getElementById('maturityDate').value ? Timestamp.fromDate(new Date(document.getElementById('maturityDate').value)) : null,
        policyStatus: policyStatusModal ? policyStatusModal.value : 'Active', // Use modal specific var
        nachStatus: nachStatusModal ? nachStatusModal.value : 'No',         // Use modal specific var
        updatedAt: serverTimestamp() // Always update timestamp
    };

    // --- वैलिडेशन ---
    if (!formData.customerName || !formData.mobileNo || !formData.policyNumber || !formData.issuanceDate || !formData.modeOfPayment || formData.premiumAmount <= 0) {
        alert("Please fill all required (*) fields with valid data.");
        return;
    }

     // --- अगली किस्त की तारीख की गणना / हैंडलिंग ---
     let nextDateInput = document.getElementById('nextInstallmentDate').value;
     if (nextDateInput) {
          formData.nextInstallmentDate = Timestamp.fromDate(new Date(nextDateInput + 'T00:00:00Z'));
     } else if (!isEditing && formData.issuanceDate && formData.modeOfPayment) {
          const calculatedNextDate = calculateNextDueDate(formData.issuanceDate.toDate(), formData.modeOfPayment);
          if (calculatedNextDate) {
               formData.nextInstallmentDate = Timestamp.fromDate(calculatedNextDate);
          } else {
               alert("Could not calculate next installment date based on mode. Please enter manually.");
               return;
          }
     } else if (!isEditing) {
          alert("Please enter the first installment date or ensure issuance date and mode are set.");
          return;
     }
      else if (isEditing && !nextDateInput) {
           alert("Please provide the next installment date when editing.");
           return;
      }

    // --- सेव/अपडेट लॉजिक ---
    savePolicyBtn.disabled = true;
    savePolicyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        if (isEditing) {
            const policyRef = doc(db, "licCustomers", policyId);
            delete formData.createdAt;
            await updateDoc(policyRef, formData);
            alert("Policy updated successfully!");
        } else {
            formData.createdAt = serverTimestamp(); // Add createdAt only for new docs
            await addDoc(collection(db, "licCustomers"), formData);
            alert("New policy added successfully!");
        }
        closePolicyModal();
    } catch (error) {
        console.error("Error saving policy:", error);
        alert("Error saving policy: " + error.message);
    } finally {
        savePolicyBtn.disabled = false;
        savePolicyBtn.innerHTML = '<i class="fas fa-save"></i> Save Policy';
    }
}

// --- पॉलिसी डिलीट करना ---
async function handleDeletePolicy(policyId, policyNumber) {
    if (!db) { alert("Database not ready."); return; }
    if (confirm(`Are you sure you want to delete policy number "${policyNumber || policyId}"? This cannot be undone.`)) {
        try {
            await deleteDoc(doc(db, "licCustomers", policyId));
            alert(`Policy ${policyNumber || policyId} deleted successfully.`);
        } catch (error) {
            console.error("Error deleting policy:", error);
            alert("Error deleting policy: " + error.message);
        }
    }
}

// --- प्रीमियम भुगतान मार्क करना (Phase 1) ---
async function handleMarkPaid(policyId, policyData) {
    if (!db) { alert("Database not ready."); return; }
    if (!policyData || !policyData.nextInstallmentDate || !policyData.modeOfPayment) {
        alert("Cannot calculate next due date. Missing current due date or payment mode.");
        return;
    }

    const currentDueDate = policyData.nextInstallmentDate.toDate();
    const paymentMode = policyData.modeOfPayment;
    const policyNumber = policyData.policyNumber || policyId;

    const newNextDueDate = calculateNextDueDate(currentDueDate, paymentMode);

    if (!newNextDueDate) {
        alert(`Could not calculate the next due date for policy ${policyNumber}. Check payment mode.`);
        return;
    }

    const formattedCurrentDate = formatDate(currentDueDate);
    const formattedNewDate = formatDate(newNextDueDate);

    if (confirm(`Mark premium due on ${formattedCurrentDate} as paid for policy ${policyNumber}?\n The next due date will be set to ${formattedNewDate}.`)) {
        const policyRef = doc(db, "licCustomers", policyId);
        try {
            await updateDoc(policyRef, {
                nextInstallmentDate: Timestamp.fromDate(newNextDueDate),
                lastPaymentDate: serverTimestamp(),
                policyStatus: 'Active'
            });
            alert(`Payment marked for policy ${policyNumber}. Next due date updated to ${formattedNewDate}.`);
            displayReminders();
        } catch (error) {
            console.error("Error marking payment:", error);
            alert("Error updating policy after marking payment: " + error.message);
        }
    }
}

// --- रिमाइंडर फंक्शन ---
async function displayReminders() {
    if (!db || !reminderList) return;
    reminderList.innerHTML = '<li class="loading-reminder">Loading reminders...</li>';

    try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const reminderDays = 15;
        const reminderEndDate = new Date(today);
        reminderEndDate.setDate(today.getDate() + reminderDays);

        const todayTimestamp = Timestamp.fromDate(today);
        const endTimestamp = Timestamp.fromDate(reminderEndDate);

        const reminderQuery = query(collection(db, "licCustomers"),
                                 where("nextInstallmentDate", ">=", todayTimestamp),
                                 where("nextInstallmentDate", "<=", endTimestamp),
                                 where("policyStatus", "in", ["Active", "Lapsed"]),
                                 orderBy("nextInstallmentDate"));

        const querySnapshot = await getDocs(reminderQuery);
        reminderList.innerHTML = '';

        if (querySnapshot.empty) {
            reminderList.innerHTML = `<li>No upcoming installments in the next ${reminderDays} days for Active/Lapsed policies.</li>`;
            return;
        }

        querySnapshot.forEach(docSnap => {
            const policy = { id: docSnap.id, ...docSnap.data() };
            const li = document.createElement('li');
            li.setAttribute('data-doc-id', policy.id);

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'reminder-checkbox';
            checkbox.title = 'Check to hide this reminder temporarily';

            const span = document.createElement('span');
            span.innerHTML = `Policy: <strong>${policy.policyNumber || 'N/A'}</strong> - ${policy.customerName || 'N/A'} - ₹ ${Number(policy.premiumAmount || 0).toFixed(2)} - Due: <strong>${formatDate(policy.nextInstallmentDate?.toDate())}</strong>`;

            li.appendChild(checkbox);
            li.appendChild(span);
            reminderList.appendChild(li);
        });

    } catch (error) {
        console.error("Error fetching reminders:", error);
        reminderList.innerHTML = '<li>Error loading reminders. Check console.</li>';
    }
}

// --- रिमाइंडर चेकबॉक्स हैंडलर ---
function handleReminderCheckboxChange(event) {
    if (event.target.classList.contains('reminder-checkbox')) {
        const checkbox = event.target;
        const listItem = checkbox.closest('li');
        if (!listItem) return;

        if (checkbox.checked) {
            listItem.classList.add('hidden-reminder');
        } else {
            listItem.classList.remove('hidden-reminder');
        }
    }
}


// --- *** Task Management Functions (Phase 1 Fix) *** ---

// Render Task List
function renderTaskList(taskDocs) {
     if (!taskList) return;
     taskList.innerHTML = '';

     if (taskDocs.length === 0) {
         taskList.innerHTML = '<li>No tasks found.</li>';
         return;
     }

     taskDocs.forEach(doc => {
         const task = { id: doc.id, ...doc.data() };
         const li = document.createElement('li');
         li.setAttribute('data-task-id', task.id);
         li.classList.toggle('completed-task', task.completed);

         const checkbox = document.createElement('input');
         checkbox.type = 'checkbox';
         checkbox.className = 'task-checkbox';
         checkbox.checked = task.completed;
         checkbox.title = task.completed ? 'Mark as Incomplete' : 'Mark as Complete';

         const span = document.createElement('span');
         span.textContent = task.description || 'No description';
         if (task.dueDate?.toDate) {
             span.textContent += ` (Due: ${formatDate(task.dueDate.toDate())})`;
         }

         const deleteBtn = document.createElement('button');
         deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
         deleteBtn.className = 'button delete-task-btn';
         deleteBtn.title = 'Delete Task';

         li.appendChild(checkbox);
         li.appendChild(span);
         li.appendChild(deleteBtn);
         taskList.appendChild(li);
     });
 }


// Add New Task
async function handleAddTask() {
    if (!db || !newTaskInput || !newTaskDueDate) return;
    const description = newTaskInput.value.trim();
    const dueDate = newTaskDueDate.value;
    if (!description) { alert("Please enter task description."); return; }

    const taskData = {
        description: description,
        dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate + 'T00:00:00Z')) : null,
        completed: false,
        createdAt: serverTimestamp()
    };

    addTaskBtn.disabled = true;
    addTaskBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

    try {
        await addDoc(collection(db, "tasks"), taskData);
        newTaskInput.value = '';
        newTaskDueDate.value = '';
    } catch (error) {
        console.error("Error adding task:", error);
        alert("Failed to add task: " + error.message);
    } finally {
        addTaskBtn.disabled = false;
        addTaskBtn.innerHTML = '<i class="fas fa-plus"></i> Add Task';
    }
}

// Handle Task Checkbox Change (Mark Complete/Incomplete)
async function handleTaskCheckboxChange(event) {
     if (event.target.classList.contains('task-checkbox')) {
          const checkbox = event.target;
          const listItem = checkbox.closest('li');
          const taskId = listItem?.dataset.taskId;
          const isCompleted = checkbox.checked;

          if (taskId && db) {
               const taskRef = doc(db, "tasks", taskId);
               try {
                    await updateDoc(taskRef, { completed: isCompleted });
                    console.log(`Task ${taskId} status updated to: ${isCompleted}`);
               } catch (error) {
                    console.error("Error updating task status:", error);
                    alert("Failed to update task status.");
                    checkbox.checked = !isCompleted;
               }
          }
     }
}

// Handle Task Actions (Deletion using Event Delegation)
async function handleTaskActions(event) {
    const deleteButton = event.target.closest('.delete-task-btn');
    if (deleteButton) {
         const listItem = deleteButton.closest('li');
         const taskId = listItem?.dataset.taskId;

         if (taskId && db && confirm("Are you sure you want to delete this task?")) {
             const taskRef = doc(db, "tasks", taskId);
             try {
                  await deleteDoc(taskRef);
                  console.log("Task deleted:", taskId);
             } catch (error) {
                  console.error("Error deleting task:", error);
                  alert("Failed to delete task.");
             }
         }
    }
}


// --- ****** START: Phase 2 Functions ****** ---

// --- Load Dashboard Data ---
function loadDashboardData() {
    if (!dbTotalPoliciesEl || !allPoliciesCache) return; // Ensure elements & cache exist

    const totalPolicies = allPoliciesCache.length;
    const activePolicies = allPoliciesCache.filter(p => p.policyStatus === 'Active').length;
    const lapsedPolicies = allPoliciesCache.filter(p => p.policyStatus === 'Lapsed').length;

    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    const upcomingPremiumPolicies = allPoliciesCache.filter(p => {
        const nextDate = p.nextInstallmentDate?.toDate();
        return nextDate && nextDate >= now && nextDate <= thirtyDaysFromNow && ['Active', 'Lapsed'].includes(p.policyStatus);
    });
    const totalUpcomingPremium = upcomingPremiumPolicies.reduce((sum, p) => sum + (Number(p.premiumAmount) || 0), 0);

    const ninetyDaysFromNow = new Date(now);
    ninetyDaysFromNow.setDate(now.getDate() + 90);
    const upcomingMaturityPolicies = allPoliciesCache.filter(p => {
         const maturityDate = p.maturityDate?.toDate();
         return maturityDate && maturityDate >= now && maturityDate <= ninetyDaysFromNow && p.policyStatus !== 'Matured';
     }).length;

    dbTotalPoliciesEl.textContent = totalPolicies;
    dbActivePoliciesEl.textContent = activePolicies;
    dbLapsedPoliciesEl.textContent = lapsedPolicies;
    dbUpcomingPremiumEl.textContent = `₹ ${totalUpcomingPremium.toFixed(2)}`;
    dbUpcomingMaturityEl.textContent = upcomingMaturityPolicies;

    console.log("Dashboard data updated.");
}

// --- Show Client Detail View ---
async function showClientDetail(policyId, customerName) {
    if (!clientDetailModal || !db) return;
    console.log(`Showing details for policyId: ${policyId}, customer: ${customerName}`);

    currentOpenClientId = policyId;

    clientDetailNameEl.textContent = customerName || 'Client Details';
    clientDetailMobileEl.textContent = 'Loading...';
    clientDetailDobEl.textContent = 'Loading...';
    clientDetailFatherNameEl.textContent = 'Loading...';
    clientDetailAddressEl.textContent = 'Loading...';
    clientPoliciesListEl.innerHTML = '<p>Loading policies...</p>';
    communicationLogListEl.innerHTML = '<p>Loading communication logs...</p>';
    newLogNoteEl.value = '';

    openDetailTab(null, 'clientPolicies');
    clientDetailModal.classList.add('active');

    // Fetch primary policy details
    let clientData = null;
    try {
        const policyRef = doc(db, "licCustomers", policyId);
        const policySnap = await getDoc(policyRef);
        if (policySnap.exists()) {
            clientData = policySnap.data();
            clientDetailMobileEl.textContent = clientData.mobileNo || '-';
            clientDetailDobEl.textContent = clientData.dob?.toDate ? formatDate(clientData.dob.toDate()) : '-';
            clientDetailFatherNameEl.textContent = clientData.fatherName || '-';
            clientDetailAddressEl.textContent = clientData.address || '-';
            clientDetailNameEl.textContent = clientData.customerName || customerName; // Use name from doc if available
        } else {
            console.error("Primary policy not found for details:", policyId);
            clientDetailMobileEl.textContent = 'Not Found';
        }
    } catch (error) {
        console.error("Error fetching primary policy details:", error);
        clientDetailMobileEl.textContent = 'Error';
    }

    // Find and display all policies for this customer (using name matching - less reliable)
    // Consider adding a customerId field for better matching in the future
    const customerPolicies = allPoliciesCache.filter(p => p.customerName === (clientData?.customerName || customerName));
    renderClientPolicies(customerPolicies);

    // Fetch and display communication logs
    await loadCommunicationLogs(policyId);
}

// --- Render Policies in Client Detail View ---
function renderClientPolicies(policies) {
    if (!clientPoliciesListEl) return;
    clientPoliciesListEl.innerHTML = '';

    if (!policies || policies.length === 0) {
        clientPoliciesListEl.innerHTML = '<p>No policies found for this customer.</p>';
        return;
    }

    const ul = document.createElement('ul');
    ul.style.listStyle = 'none'; ul.style.paddingLeft = '0';

    policies.forEach(p => {
        const li = document.createElement('li');
        li.style.borderBottom = '1px solid #eee';
        li.style.padding = '8px 0';
        li.innerHTML = `
            <strong>Policy:</strong> ${p.policyNumber || 'N/A'} |
            <strong>Plan:</strong> ${p.plan || '-'} |
            <strong>Premium:</strong> ₹ ${Number(p.premiumAmount || 0).toFixed(2)} |
            <strong>Next Due:</strong> ${p.nextInstallmentDate?.toDate ? formatDate(p.nextInstallmentDate.toDate()) : '-'} |
            <strong>Status:</strong> <span class="status-badge status-${(p.policyStatus || 'unknown').toLowerCase()}">${p.policyStatus || 'Unknown'}</span>
        `;
        ul.appendChild(li);
    });
    clientPoliciesListEl.appendChild(ul);
}


// --- Load Communication Logs for Client/Policy ---
async function loadCommunicationLogs(identifier) {
    if (!communicationLogListEl || !db) return;
    communicationLogListEl.innerHTML = '<p>Loading logs...</p>';

    try {
        // **ADJUST QUERY based on your logs structure**
        const logQuery = query(collection(db, "logs"), where("policyId", "==", identifier), orderBy("timestamp", "desc"));
        const logSnapshot = await getDocs(logQuery);

        if (logSnapshot.empty) {
            communicationLogListEl.innerHTML = '<p>No communication logs found.</p>';
        } else {
            communicationLogListEl.innerHTML = '';
            logSnapshot.forEach(docSnap => {
                const log = docSnap.data();
                const p = document.createElement('p');
                const timestamp = log.timestamp?.toDate ? formatDateTime(log.timestamp.toDate()) : 'N/A'; // Use formatDateTime for time
                p.innerHTML = `<span class="log-meta">Logged on: ${timestamp}</span>${log.note || ''}`;
                communicationLogListEl.appendChild(p);
            });
        }
    } catch (error) {
        console.error("Error loading communication logs:", error);
        communicationLogListEl.innerHTML = '<p>Error loading logs.</p>';
    }
}


// --- Add Communication Note ---
async function addCommunicationNote() {
    if (!newLogNoteEl || !db || !currentOpenClientId) {
        alert("Cannot add note. Client context missing or DB not ready.");
        return;
    }
    const note = newLogNoteEl.value.trim();
    if (!note) {
        alert("Please enter a note.");
        return;
    }

    addLogBtn.disabled = true;
    addLogBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

    try {
        // **ADJUST STRUCTURE AS NEEDED**
        await addDoc(collection(db, "logs"), {
            policyId: currentOpenClientId,
            note: note,
            timestamp: serverTimestamp()
        });
        newLogNoteEl.value = '';
        await loadCommunicationLogs(currentOpenClientId); // Reload logs
    } catch (error) {
        console.error("Error adding communication note:", error);
        alert("Failed to add note: " + error.message);
    } finally {
        addLogBtn.disabled = false;
        addLogBtn.innerHTML = '<i class="fas fa-plus"></i> Add Note';
    }
}


// --- Close Client Detail View ---
function closeClientDetail() {
    if (clientDetailModal) {
        clientDetailModal.classList.remove('active');
        currentOpenClientId = null;
    }
}

// --- Handle Tab Switching in Client Detail View ---
window.openDetailTab = function(evt, tabName) { // Make it global for HTML onclick
    let i, tabcontent, tablinks;
    const detailView = document.getElementById('clientDetailView');
    if (!detailView) return;

    tabcontent = detailView.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
        tabcontent[i].classList.remove("active");
    }

    tablinks = detailView.getElementsByClassName("tab-button");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("active");
    }

    const currentTab = document.getElementById(tabName);
    if (currentTab) {
        currentTab.style.display = "block";
        currentTab.classList.add("active");
    }

    if (evt && evt.currentTarget) {
         evt.currentTarget.classList.add("active");
    } else {
        const defaultButton = Array.from(tablinks).find(btn => btn.getAttribute('onclick')?.includes(`'${tabName}'`)); // Safer check
        if (defaultButton) defaultButton.classList.add("active");
    }
}

// --- ****** END: Phase 2 Functions ****** ---


// --- हेल्पर फंक्शन्स ---
function formatDate(date) {
    if (!date || !(date instanceof Date) || isNaN(date)) return '-';
    try {
        let day = String(date.getDate()).padStart(2, '0');
        let month = String(date.getMonth() + 1).padStart(2, '0');
        let year = date.getFullYear();
        return `${day}-${month}-${year}`;
    } catch (e) {
        console.error("Error formatting date:", date, e);
        return 'Invalid Date';
    }
}

// Helper function to format date and time (for logs)
function formatDateTime(date) {
    if (!date || !(date instanceof Date) || isNaN(date)) return '-';
     try {
        let day = String(date.getDate()).padStart(2, '0');
        let month = String(date.getMonth() + 1).padStart(2, '0');
        let year = date.getFullYear();
        let hours = String(date.getHours()).padStart(2, '0');
        let minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}-${month}-${year} ${hours}:${minutes}`;
    } catch (e) {
        console.error("Error formatting date/time:", date, e);
        return 'Invalid Date';
    }
}


// Calculate Next Due Date based on a GIVEN start date and mode
function calculateNextDueDate(startDate, mode) {
    if (!(startDate instanceof Date) || isNaN(startDate) || !mode) return null;
    let nextDate = new Date(startDate);
    try {
        switch (mode.toLowerCase()) {
            case 'yearly':
                nextDate.setFullYear(nextDate.getFullYear() + 1);
                break;
            case 'half-yearly':
            case 'half yearly':
                nextDate.setMonth(nextDate.getMonth() + 6);
                break;
            case 'quarterly':
                nextDate.setMonth(nextDate.getMonth() + 3);
                break;
            case 'monthly':
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
            default:
                console.warn("Unknown payment mode for date calculation:", mode);
                return null;
        }
        if (isNaN(nextDate)) {
             console.error("Calculated date is invalid:", startDate, mode);
             return null;
        }
        return nextDate;
    } catch (e) {
         console.error("Error calculating next due date:", e);
         return null;
    }
}

// --- फिल्टर/सॉर्ट हैंडलर्स --- Updated Debounce Logic
function handleLicFilterChange() {
    clearTimeout(searchDebounceTimerLic);
    searchDebounceTimerLic = setTimeout(() => {
        applyLicFiltersAndRender();
    }, 350);
}

function handleLicSortChange() {
    if (!sortLicSelect) return;
    const [field, direction] = sortLicSelect.value.split('_');
    currentLicSortField = field;
    currentLicSortDirection = direction;
    applyLicFiltersAndRender();
}

function clearLicFilters() {
    if(licSearchInput) licSearchInput.value = '';
    if(licStatusFilter) licStatusFilter.value = '';
    if(licPlanFilter) licPlanFilter.value = '';
    if(licModeFilter) licModeFilter.value = '';
    if(licNachFilter) licNachFilter.value = '';
    if(sortLicSelect) sortLicSelect.value = 'createdAt_desc';

    currentLicSortField = 'createdAt';
    currentLicSortDirection = 'desc';
    applyLicFiltersAndRender();
}

// --- एंड ऑफ़ फाइल ---