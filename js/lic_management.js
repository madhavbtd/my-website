// js/lic_management.js
// Updated for Phase 1 & Phase 2 Features + Task Followup + Debugging Logs

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
    // Task Management Elements (Updated)
    newTaskCustomerNameEl, newTaskInput, newTaskDueDate, newTaskCommentsEl, addTaskBtn, taskList,
    // --- Phase 2 Elements ---
    // Dashboard elements
    dbTotalPoliciesEl, dbActivePoliciesEl, dbLapsedPoliciesEl, dbUpcomingPremiumEl, dbUpcomingMaturityEl,
    // Client Detail View elements
    clientDetailModal, closeClientDetailBtn, closeClientDetailBtnBottom,
    clientDetailNameEl, clientDetailContentEl,
    clientDetailMobileEl, clientDetailDobEl, clientDetailFatherNameEl, clientDetailAddressEl,
    clientPoliciesListEl, communicationLogListEl,
    newLogNoteEl, addLogBtn,
    // Edit Task Modal Elements
    editTaskModal, editTaskForm, editTaskIdEl,
    editTaskCustomerNameEl, editTaskDescriptionEl, editTaskDueDateEl, editTaskCommentsEl, editTaskStatusEl,
    closeEditTaskModalBtn, cancelEditTaskBtn, saveTaskChangesBtn, // saveTaskChangesBtn used via form submit
    // Upcoming Tasks Reminder Element
    upcomingTaskListEl;


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
    policyModalTitle = document.getElementById('policyModalTitleText'); // <<< Use the span ID if you added one
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
    // Task Management Elements (Updated)
    newTaskCustomerNameEl = document.getElementById('newTaskCustomerName');
    newTaskInput = document.getElementById('newTaskInput'); // Description
    newTaskDueDate = document.getElementById('newTaskDueDate');
    newTaskCommentsEl = document.getElementById('newTaskComments');
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

    // Edit Task Modal Elements
    editTaskModal = document.getElementById('editTaskModal');
    editTaskForm = document.getElementById('editTaskForm');
    editTaskIdEl = document.getElementById('editTaskId');
    editTaskCustomerNameEl = document.getElementById('editTaskCustomerName');
    editTaskDescriptionEl = document.getElementById('editTaskDescription');
    editTaskDueDateEl = document.getElementById('editTaskDueDate');
    editTaskCommentsEl = document.getElementById('editTaskComments');
    editTaskStatusEl = document.getElementById('editTaskStatus');
    closeEditTaskModalBtn = document.getElementById('closeEditTaskModal');
    cancelEditTaskBtn = document.getElementById('cancelEditTaskBtn');
    // saveTaskChangesBtn listener form submit पर लगेगा

    // Upcoming Tasks Reminder Element
    upcomingTaskListEl = document.getElementById('upcomingTaskList');


    // --- START: डीबगिंग लॉग्स ---
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

    // Task Management Listeners (Updated)
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

    // Edit Task Modal Listeners
    if (closeEditTaskModalBtn) closeEditTaskModalBtn.addEventListener('click', closeEditTaskModal);
    if (cancelEditTaskBtn) cancelEditTaskBtn.addEventListener('click', closeEditTaskModal);
    if (editTaskModal) editTaskModal.addEventListener('click', (e) => { if (e.target === editTaskModal) closeEditTaskModal(); });
    if (editTaskForm) editTaskForm.addEventListener('submit', handleUpdateTask);

    // --- Phase 2: Client Detail Listeners ---
    if (closeClientDetailBtn) closeClientDetailBtn.addEventListener('click', closeClientDetail);
    if (closeClientDetailBtnBottom) closeClientDetailBtnBottom.addEventListener('click', closeClientDetail);
    if (clientDetailModal) clientDetailModal.addEventListener('click', (e) => { if (e.target === clientDetailModal) closeClientDetail(); });
    if (addLogBtn) addLogBtn.addEventListener('click', addCommunicationNote);

    // --- Firestore से डेटा सुनना शुरू करें ---
    listenForPolicies(); // Policies Load
    listenForTasks();   // Tasks Load
    displayReminders(); // Policy Reminders Load
    displayUpcomingTasks(); // Task Reminders Load

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
        displayReminders();         // Update Policy Reminders
        loadDashboardData();        // Update Dashboard (Phase 2)
    }, (error) => {
        console.error("Error listening to policies:", error);
        if(licPolicyTableBody) licPolicyTableBody.innerHTML = `<tr><td colspan="9">Error loading policy data. Check console.</td></tr>`;
        if(dbTotalPoliciesEl) dbTotalPoliciesEl.textContent = 'Error';
        if(dbActivePoliciesEl) dbActivePoliciesEl.textContent = 'Error';
    });
}

// --- Firestore Listener (Tasks) ---
function listenForTasks() {
    if (!db) { console.error("DB not initialized for tasks"); return; }
    if (unsubscribeTasks) unsubscribeTasks();

    const tasksRef = collection(db, "tasks"); // Assume 'tasks' collection
    const q = query(tasksRef, orderBy("createdAt", "desc")); // Sort by creation time

    console.log("Starting task listener...");
    unsubscribeTasks = onSnapshot(q, (snapshot) => {
        console.log(`Received ${snapshot.docs.length} tasks.`);
        renderTaskList(snapshot.docs); // Render tasks directly
        displayUpcomingTasks(); // Update task reminders when tasks change
    }, (error) => {
        console.error("Error listening to tasks:", error);
        if(taskList) taskList.innerHTML = `<li class="error-tasks">Error loading tasks.</li>`;
    });
}


// --- फ़िल्टर, सॉर्ट और रेंडर (Policies) ---
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
           } else if (valA instanceof Date && valB instanceof Date) { } else {
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

// --- टेबल रेंडरिंग (Policies) ---
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

        row.insertCell().textContent = policy.policyNumber || '-';

        const nameCell = row.insertCell();
        const nameLink = document.createElement('a');
        nameLink.href = "#";
        nameLink.textContent = policy.customerName || 'N/A';
        nameLink.title = `View details for ${policy.customerName || 'this client'}`;
        nameLink.style.cursor = 'pointer'; nameLink.style.textDecoration = 'underline'; nameLink.style.color = '#0056b3';
        nameLink.onclick = (e) => {
            e.preventDefault();
            showClientDetail(policy.id, policy.customerName);
        };
        nameCell.appendChild(nameLink);

        row.insertCell().textContent = policy.mobileNo || '-';
        row.insertCell().textContent = policy.plan || '-';
        row.insertCell().textContent = policy.premiumAmount ? `₹ ${Number(policy.premiumAmount).toFixed(2)}` : '-';
        row.insertCell().textContent = policy.modeOfPayment || '-';
        row.insertCell().textContent = policy.nextInstallmentDate?.toDate ? formatDate(policy.nextInstallmentDate.toDate()) : '-';
        row.insertCell().innerHTML = `<span class="status-badge status-${(policy.policyStatus || 'unknown').toLowerCase()}">${policy.policyStatus || 'Unknown'}</span>`;

        const actionCell = row.insertCell();
        actionCell.classList.add('action-buttons');

        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<i class="fas fa-edit"></i>'; editBtn.title = "Edit Policy";
        editBtn.classList.add('button', 'edit-button');
        editBtn.onclick = (e) => { e.stopPropagation(); openPolicyModal(policy.id, policy); };
        actionCell.appendChild(editBtn);

        const payBtn = document.createElement('button');
        payBtn.innerHTML = '<i class="fas fa-check-circle"></i>'; payBtn.title = "Mark Premium Paid & Update Due Date";
        payBtn.classList.add('button', 'pay-button');
        payBtn.disabled = !['Active', 'Lapsed'].includes(policy.policyStatus) || !policy.nextInstallmentDate || !policy.modeOfPayment;
        payBtn.onclick = (e) => { e.stopPropagation(); handleMarkPaid(policy.id, policy); };
        actionCell.appendChild(payBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>'; deleteBtn.title = "Delete Policy";
        deleteBtn.classList.add('button', 'delete-button');
        deleteBtn.onclick = (e) => { e.stopPropagation(); handleDeletePolicy(policy.id, policy.policyNumber); };
        actionCell.appendChild(deleteBtn);
    });
}


// --- Modal खोलना/बंद करना (Policy Add/Edit) ---
function openPolicyModal(policyId = null, data = {}) {
    if (!policyModal || !policyForm || !policyModalTitle) return; // Added title check
    policyForm.reset();
    editPolicyId.value = policyId || '';

    if (policyId) {
        policyModalTitle.textContent = "Edit Policy Details"; // <<< Update title text
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
        if(policyStatusModal) policyStatusModal.value = data.policyStatus || 'Active';
        if(nachStatusModal) nachStatusModal.value = data.nachStatus || 'No';
    } else {
        policyModalTitle.textContent = "Add New Policy"; // <<< Update title text
         if(policyStatusModal) policyStatusModal.value = 'Active';
         if(nachStatusModal) nachStatusModal.value = 'No';
         document.getElementById('nextInstallmentDate').value = '';
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
        policyStatus: policyStatusModal ? policyStatusModal.value : 'Active',
        nachStatus: nachStatusModal ? nachStatusModal.value : 'No',
        updatedAt: serverTimestamp()
    };

    if (!formData.customerName || !formData.mobileNo || !formData.policyNumber || !formData.issuanceDate || !formData.modeOfPayment || formData.premiumAmount <= 0) {
        alert("Please fill all required (*) fields with valid data.");
        return;
    }

     let nextDateInput = document.getElementById('nextInstallmentDate').value;
     if (nextDateInput) {
          formData.nextInstallmentDate = Timestamp.fromDate(new Date(nextDateInput + 'T00:00:00Z'));
     } else if (!isEditing && formData.issuanceDate && formData.modeOfPayment) {
          const calculatedNextDate = calculateNextDueDate(formData.issuanceDate.toDate(), formData.modeOfPayment);
          if (calculatedNextDate) {
               formData.nextInstallmentDate = Timestamp.fromDate(calculatedNextDate);
          } else {
               alert("Could not calculate next installment date. Please enter manually."); return;
          }
     } else if (!isEditing) {
          alert("Please enter the first installment date or ensure issuance date and mode are set."); return;
     } else if (isEditing && !nextDateInput) {
           alert("Please provide the next installment date when editing."); return;
      }

    savePolicyBtn.disabled = true;
    savePolicyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        if (isEditing) {
            const policyRef = doc(db, "licCustomers", policyId);
            delete formData.createdAt;
            await updateDoc(policyRef, formData);
            alert("Policy updated successfully!");
        } else {
            formData.createdAt = serverTimestamp();
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
        alert("Cannot calculate next due date. Missing current due date or payment mode."); return;
    }

    const currentDueDate = policyData.nextInstallmentDate.toDate();
    const paymentMode = policyData.modeOfPayment;
    const policyNumber = policyData.policyNumber || policyId;

    const newNextDueDate = calculateNextDueDate(currentDueDate, paymentMode);

    if (!newNextDueDate) {
        alert(`Could not calculate the next due date for policy ${policyNumber}. Check payment mode.`); return;
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
            // Reminders will update via listener
        } catch (error) {
            console.error("Error marking payment:", error);
            alert("Error updating policy after marking payment: " + error.message);
        }
    }
}

// --- रिमाइंडर फंक्शन (Policies) ---
async function displayReminders() {
    if (!db || !reminderList) return;
    reminderList.innerHTML = '<li class="loading-reminder">Loading reminders...</li>';
    try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const reminderDays = 15;
        const reminderEndDate = new Date(today); reminderEndDate.setDate(today.getDate() + reminderDays);
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
            reminderList.innerHTML = `<li>No upcoming installments in the next ${reminderDays} days for Active/Lapsed policies.</li>`; return;
        }
        querySnapshot.forEach(docSnap => {
            const policy = { id: docSnap.id, ...docSnap.data() };
            const li = document.createElement('li'); li.setAttribute('data-doc-id', policy.id);
            const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'reminder-checkbox'; checkbox.title = 'Check to hide this reminder temporarily';
            const span = document.createElement('span');
            span.innerHTML = `Policy: <strong>${policy.policyNumber || 'N/A'}</strong> - ${policy.customerName || 'N/A'} - ₹ ${Number(policy.premiumAmount || 0).toFixed(2)} - Due: <strong>${formatDate(policy.nextInstallmentDate?.toDate())}</strong>`;
            li.appendChild(checkbox); li.appendChild(span); reminderList.appendChild(li);
        });
    } catch (error) {
        console.error("Error fetching reminders:", error);
        if (error.code === 'failed-precondition') {
             reminderList.innerHTML = '<li>Error: Firestore index required for policy reminders. Check console for link to create it.</li>';
        } else {
            reminderList.innerHTML = '<li>Error loading reminders. Check console.</li>';
        }
    }
}

// --- रिमाइंडर चेकबॉक्स हैंडलर ---
function handleReminderCheckboxChange(event) {
    if (event.target.classList.contains('reminder-checkbox')) {
        const checkbox = event.target; const listItem = checkbox.closest('li'); if (!listItem) return;
        listItem.classList.toggle('hidden-reminder', checkbox.checked);
    }
}


// --- *** Task Management Functions (Follow-up Style) *** ---

// Render Task List
function renderTaskList(taskDocs) {
     if (!taskList) return;
     taskList.innerHTML = '';
     if (taskDocs.length === 0) { taskList.innerHTML = '<li>No follow-up tasks found.</li>'; return; }
     taskDocs.forEach(doc => {
         const task = { id: doc.id, ...doc.data() };
         const li = document.createElement('li'); li.setAttribute('data-task-id', task.id); li.classList.toggle('completed-task', task.completed);
         const contentDiv = document.createElement('div'); contentDiv.style.flexGrow = '1';
         const customerSpan = document.createElement('span'); customerSpan.style.fontWeight = 'bold'; customerSpan.textContent = task.customerName ? `${task.customerName}: ` : '';
         const descSpan = document.createElement('span'); descSpan.textContent = task.description || 'No description';
         const dateSpan = document.createElement('span'); dateSpan.style.fontSize = '0.85em'; dateSpan.style.color = '#555'; dateSpan.style.marginLeft = '10px'; dateSpan.textContent = task.dueDate?.toDate ? ` (Due: ${formatDate(task.dueDate.toDate())})` : '';
         const commentSpan = document.createElement('p'); commentSpan.style.fontSize = '0.85em'; commentSpan.style.color = '#666'; commentSpan.style.marginTop = '4px'; commentSpan.style.whiteSpace = 'pre-wrap'; commentSpan.textContent = task.comments ? `Comment: ${task.comments}` : '';
         contentDiv.appendChild(customerSpan); contentDiv.appendChild(descSpan); contentDiv.appendChild(dateSpan); contentDiv.appendChild(commentSpan);
         const actionsDiv = document.createElement('div'); actionsDiv.style.marginLeft = 'auto'; actionsDiv.style.display = 'flex'; actionsDiv.style.gap = '5px'; actionsDiv.style.flexShrink = '0';
         const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'task-checkbox'; checkbox.checked = task.completed; checkbox.title = task.completed ? 'Mark as Pending' : 'Mark as Completed'; checkbox.style.marginTop = '4px'; // Align checkbox
         const editBtn = document.createElement('button'); editBtn.innerHTML = '<i class="fas fa-edit"></i>'; editBtn.className = 'button edit-button edit-task-btn'; editBtn.title = 'Edit Task';
         editBtn.onclick = (e) => { e.stopPropagation(); openEditTaskModal(task.id, task); };
         const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>'; deleteBtn.className = 'button delete-task-btn'; deleteBtn.title = 'Delete Task';
         actionsDiv.appendChild(checkbox); actionsDiv.appendChild(editBtn); actionsDiv.appendChild(deleteBtn);
         li.appendChild(contentDiv); li.appendChild(actionsDiv); taskList.appendChild(li);
     });
 }

// Add New Follow-up Task
async function handleAddTask() {
    if (!db || !newTaskInput || !newTaskDueDate || !newTaskCustomerNameEl || !newTaskCommentsEl) return;
    const customerName = newTaskCustomerNameEl.value.trim();
    const description = newTaskInput.value.trim();
    const dueDate = newTaskDueDate.value;
    const comments = newTaskCommentsEl.value.trim();
    if (!description) { alert("Please enter task description."); return; }
    const taskData = { customerName, description, dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate + 'T00:00:00Z')) : null, comments, completed: false, createdAt: serverTimestamp() };
    addTaskBtn.disabled = true; addTaskBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    try {
        await addDoc(collection(db, "tasks"), taskData);
        newTaskCustomerNameEl.value = ''; newTaskInput.value = ''; newTaskDueDate.value = ''; newTaskCommentsEl.value = '';
    } catch (error) { console.error("Error adding task:", error); alert("Failed to add task: " + error.message);
    } finally { addTaskBtn.disabled = false; addTaskBtn.innerHTML = '<i class="fas fa-plus"></i> Add Follow-up'; }
}

// Handle Task Checkbox Change
async function handleTaskCheckboxChange(event) {
     if (event.target.classList.contains('task-checkbox')) {
          const checkbox = event.target; const listItem = checkbox.closest('li'); const taskId = listItem?.dataset.taskId; const isCompleted = checkbox.checked;
          if (taskId && db) {
               const taskRef = doc(db, "tasks", taskId);
               try { await updateDoc(taskRef, { completed: isCompleted }); console.log(`Task ${taskId} status updated to: ${isCompleted}`);
               } catch (error) { console.error("Error updating task status:", error); alert("Failed to update task status."); checkbox.checked = !isCompleted; }
          }
     }
}

// Handle Task Actions (Delete)
async function handleTaskActions(event) {
    const deleteButton = event.target.closest('.delete-task-btn');
    if (deleteButton) {
         const listItem = deleteButton.closest('li'); const taskId = listItem?.dataset.taskId;
         if (taskId && db && confirm("Are you sure you want to delete this task?")) {
             const taskRef = doc(db, "tasks", taskId);
             try { await deleteDoc(taskRef); console.log("Task deleted:", taskId);
             } catch (error) { console.error("Error deleting task:", error); alert("Failed to delete task."); }
         }
    }
}

// Open Edit Task Modal
function openEditTaskModal(taskId, taskData) {
    if (!editTaskModal || !editTaskForm) return; console.log("Opening edit modal for task:", taskId, taskData);
    editTaskIdEl.value = taskId;
    editTaskCustomerNameEl.value = taskData.customerName || '';
    editTaskDescriptionEl.value = taskData.description || '';
    editTaskDueDateEl.value = taskData.dueDate?.toDate ? taskData.dueDate.toDate().toISOString().split('T')[0] : '';
    editTaskCommentsEl.value = taskData.comments || '';
    editTaskStatusEl.value = taskData.completed ? 'completed' : 'pending';
    editTaskModal.classList.add('active');
}

// Close Edit Task Modal
function closeEditTaskModal() { if (editTaskModal) { editTaskModal.classList.remove('active'); } }

// Handle Update Task Form Submission
async function handleUpdateTask(event) {
    event.preventDefault(); if (!db || !editTaskIdEl) return;
    const taskId = editTaskIdEl.value; if (!taskId) { alert("Error: Task ID missing."); return; }
    const updatedData = {
        customerName: editTaskCustomerNameEl.value.trim(), description: editTaskDescriptionEl.value.trim(),
        dueDate: editTaskDueDateEl.value ? Timestamp.fromDate(new Date(editTaskDueDateEl.value + 'T00:00:00Z')) : null,
        comments: editTaskCommentsEl.value.trim(), completed: editTaskStatusEl.value === 'completed', updatedAt: serverTimestamp()
    };
    if (!updatedData.description) { alert("Please enter task description."); return; }
    const saveButton = document.getElementById('saveTaskChangesBtn');
    if(saveButton) { saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }
    try {
        const taskRef = doc(db, "tasks", taskId); await updateDoc(taskRef, updatedData);
        alert("Task updated successfully!"); closeEditTaskModal();
    } catch (error) { console.error("Error updating task:", error); alert("Failed to update task: " + error.message);
    } finally { if(saveButton) { saveButton.disabled = false; saveButton.innerHTML = '<i class="fas fa-save"></i> Save Changes'; } }
}

// Display Upcoming Tasks Reminder
async function displayUpcomingTasks() {
    if (!db || !upcomingTaskListEl) return;
    upcomingTaskListEl.innerHTML = '<li class="loading-reminder">Loading upcoming tasks...</li>';
    try {
        const today = new Date(); today.setHours(0, 0, 0, 0); const reminderDays = 7;
        const reminderEndDate = new Date(today); reminderEndDate.setDate(today.getDate() + reminderDays);
        const todayTimestamp = Timestamp.fromDate(today); const endTimestamp = Timestamp.fromDate(reminderEndDate);
        const taskReminderQuery = query(collection(db, "tasks"), where("completed", "==", false), where("dueDate", ">=", todayTimestamp), where("dueDate", "<=", endTimestamp), orderBy("dueDate"));
        const querySnapshot = await getDocs(taskReminderQuery);
        upcomingTaskListEl.innerHTML = '';
        if (querySnapshot.empty) { upcomingTaskListEl.innerHTML = `<li>No follow-ups due in the next ${reminderDays} days.</li>`; return; }
        querySnapshot.forEach(docSnap => {
            const task = { id: docSnap.id, ...docSnap.data() }; const li = document.createElement('li');
            li.innerHTML = `<strong>${task.customerName ? task.customerName + ':' : ''}</strong> ${task.description || 'N/A'} - Due: <strong>${formatDate(task.dueDate?.toDate())}</strong>`;
             li.style.cursor = 'pointer'; li.onclick = () => openEditTaskModal(task.id, task);
            upcomingTaskListEl.appendChild(li);
        });
    } catch (error) {
        console.error("Error fetching upcoming tasks:", error);
        if (error.code === 'failed-precondition') {
             upcomingTaskListEl.innerHTML = '<li>Error: Firestore index required for upcoming tasks. Check console.</li>';
        } else { upcomingTaskListEl.innerHTML = '<li>Error loading upcoming tasks.</li>'; }
    }
}

// --- Phase 2 Functions (Client Detail) ---

// Load Dashboard Data
function loadDashboardData() { /* ... जस का तस ... */ }
// Show Client Detail View
async function showClientDetail(policyId, customerName) { /* ... जस का तस ... */ }
// Render Policies in Client Detail View
function renderClientPolicies(policies) { /* ... जस का तस ... */ }
// Load Communication Logs
async function loadCommunicationLogs(identifier) { /* ... जस का तस ... */ }
// Add Communication Note
async function addCommunicationNote() { /* ... जस का तस ... */ }
// Close Client Detail View
function closeClientDetail() { /* ... जस का तस ... */ }
// Handle Tab Switching in Client Detail View
window.openDetailTab = function(evt, tabName) { /* ... जस का तस ... */ }


// --- हेल्पर फंक्शन्स ---
function formatDate(date) { /* ... जस का तस ... */ }
function formatDateTime(date) { // <<< यह नया है
    if (!date || !(date instanceof Date) || isNaN(date)) return '-';
     try {
        let day = String(date.getDate()).padStart(2, '0'); let month = String(date.getMonth() + 1).padStart(2, '0'); let year = date.getFullYear();
        let hours = String(date.getHours()).padStart(2, '0'); let minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}-${month}-${year} ${hours}:${minutes}`;
    } catch (e) { console.error("Error formatting date/time:", date, e); return 'Invalid Date'; }
}
function calculateNextDueDate(startDate, mode) { /* ... जस का तस ... */ }

// --- फिल्टर/सॉर्ट हैंडलर्स ---
function handleLicFilterChange() { /* ... जस का तस ... */ }
function handleLicSortChange() { /* ... जस का तस ... */ }
function clearLicFilters() { /* ... जस का तस ... */ }

// --- एंड ऑफ़ फाइल ---