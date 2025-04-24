// js/lic_management.js
// Updated with implementations for missing functions

// --- सुनिश्चित करें कि ग्लोबल Firebase फंक्शन्स उपलब्ध हैं ---
const {
    db, collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp,
    query, where, orderBy, limit, Timestamp, runTransaction, onSnapshot,
    arrayUnion // <<<< Task History के लिए जोड़ा गया
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
    editTaskNewCommentEl, // <<< नया कमेंट जोड़ने के लिए
    editTaskCommentsHistoryEl, // <<< कमेंट हिस्ट्री दिखाने के लिए
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
    policyModalTitle = document.getElementById('policyModalTitleText'); // Use the span ID
    editPolicyId = document.getElementById('editPolicyId');
    addNewPolicyBtn = document.getElementById('addNewPolicyBtn');
    closePolicyModalBtn = document.getElementById('closePolicyModal'); // Policy Modal Close
    cancelPolicyBtn = document.getElementById('cancelPolicyBtn'); // Policy Modal Cancel
    savePolicyBtn = document.getElementById('savePolicyBtn'); // <<<< यह बटन सबमिट के लिए है, सीधे क्लिक लिस्नर नहीं
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
    addTaskBtn = document.getElementById('addTaskBtn');
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

    // Edit Task Modal Elements (Updated)
    editTaskModal = document.getElementById('editTaskModal');
    editTaskForm = document.getElementById('editTaskForm');
    editTaskIdEl = document.getElementById('editTaskId');
    editTaskCustomerNameEl = document.getElementById('editTaskCustomerName');
    editTaskDescriptionEl = document.getElementById('editTaskDescription');
    editTaskDueDateEl = document.getElementById('editTaskDueDate');
    editTaskCommentsHistoryEl = document.getElementById('editTaskCommentsHistory');
    editTaskNewCommentEl = document.getElementById('editTaskNewComment');
    editTaskStatusEl = document.getElementById('editTaskStatus');
    closeEditTaskModalBtn = document.getElementById('closeEditTaskModal');
    cancelEditTaskBtn = document.getElementById('cancelEditTaskBtn');
    // saveTaskChangesBtn listener form submit पर लगेगा (नीचे देखें)

    // Upcoming Tasks Reminder Element
    upcomingTaskListEl = document.getElementById('upcomingTaskList');

    // --- START: डीबगिंग लॉग्स ---
    console.log('Debugging - Add New Policy Button Element:', addNewPolicyBtn);
    console.log('Debugging - Add Task Button Element:', addTaskBtn);
    // --- END: डीबगिंग लॉग्स ---

    // --- इवेंट लिस्टनर्स जोड़ें ---
    // Policy Modal Buttons & Form
    if (addNewPolicyBtn) {
         console.log('Debugging - Attaching listener to Add New Policy button'); // डीबगिंग लॉग
         addNewPolicyBtn.addEventListener('click', () => openPolicyModal());
    } else {
         console.error('ERROR: Could not find Add New Policy button element!'); // एरर लॉग
    }
    if (closePolicyModalBtn) closePolicyModalBtn.addEventListener('click', closePolicyModal);
    if (cancelPolicyBtn) cancelPolicyBtn.addEventListener('click', closePolicyModal);
    if (policyModal) policyModal.addEventListener('click', (e) => { if (e.target === policyModal) closePolicyModal(); });
    if (policyForm) {
        policyForm.addEventListener('submit', handleSavePolicy); // <<< फॉर्म सबमिट पर handleSavePolicy कॉल करें
        console.log('Debugging - Attaching listener to Policy Form submit');
    } else {
         console.error('ERROR: Could not find Policy Form element!');
    }

    // Filter listeners
    if (licSearchInput) licSearchInput.addEventListener('input', handleLicFilterChange);
    if (licStatusFilter) licStatusFilter.addEventListener('change', handleLicFilterChange);
    if (licPlanFilter) licPlanFilter.addEventListener('input', handleLicFilterChange);
    if (licModeFilter) licModeFilter.addEventListener('change', handleLicFilterChange);
    if (licNachFilter) licNachFilter.addEventListener('change', handleLicFilterChange);
    if (sortLicSelect) sortLicSelect.addEventListener('change', handleLicSortChange);
    if (clearLicFiltersBtn) clearLicFiltersBtn.addEventListener('click', clearLicFilters);

    // Reminder Checkbox Listener (Event Delegation) - This seems less relevant now
    // if (reminderList) reminderList.addEventListener('change', handleReminderCheckboxChange);

    // Task Management Listeners (Updated)
    if (addTaskBtn) {
         console.log('Debugging - Attaching listener to Add Task button'); // डीबगिंग लॉग
         addTaskBtn.addEventListener('click', handleAddTask); // <<< सीधे बटन क्लिक पर handleAddTask कॉल करें
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
    if (editTaskForm) {
        editTaskForm.addEventListener('submit', handleUpdateTask); // <<< Edit Task सेव करने के लिए
        console.log('Debugging - Attaching listener to Edit Task Form submit');
    } else {
        console.error('ERROR: Could not find Edit Task Form element!');
    }


    // --- Phase 2: Client Detail Listeners ---
    if (closeClientDetailBtn) closeClientDetailBtn.addEventListener('click', closeClientDetail);
    if (closeClientDetailBtnBottom) closeClientDetailBtnBottom.addEventListener('click', closeClientDetail);
    if (clientDetailModal) clientDetailModal.addEventListener('click', (e) => { if (e.target === clientDetailModal) closeClientDetail(); });
    if (addLogBtn) addLogBtn.addEventListener('click', addCommunicationNote);

    // --- Firestore से डेटा सुनना शुरू करें ---
    listenForPolicies(); // Policies Load
    listenForTasks();   // Tasks Load
    // displayReminders() और displayUpcomingTasks() संबंधित श्रोताओं के अंदर कॉल होंगे

    console.log("Initialization complete.");
}

// --- Firestore Listener (Policies) ---
function listenForPolicies() {
    if (!db) { console.error("DB not initialized"); return; }
    if (unsubscribePolicies) unsubscribePolicies(); // Stop previous listener if any
    const policiesRef = collection(db, "licCustomers");

    // Apply initial sorting from dropdown
    const sortValue = sortLicSelect ? sortLicSelect.value : 'createdAt_desc';
    const [field, direction] = sortValue.split('_');
    currentLicSortField = field || 'createdAt';
    currentLicSortDirection = direction || 'desc';

    // Build the query (only sorting for now, filtering happens client-side)
    const q = query(policiesRef, orderBy(currentLicSortField, currentLicSortDirection));

    console.log(`Starting policy listener with sort: ${currentLicSortField} ${currentLicSortDirection}`);

    unsubscribePolicies = onSnapshot(q, (snapshot) => {
        console.log(`Received ${snapshot.docs.length} policies.`);
        allPoliciesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        applyLicFiltersAndRender(); // Render Table with client-side filtering & server-side sorting
        displayReminders();         // Update Policy Reminders
        loadDashboardData();        // Update Dashboard
    }, (error) => {
        console.error("Error listening to policies:", error);
        if(licPolicyTableBody) licPolicyTableBody.innerHTML = `<tr><td colspan="9">Error loading policy data: ${error.message}. Check console and Firestore rules.</td></tr>`;
        if(dbTotalPoliciesEl) dbTotalPoliciesEl.textContent = 'Error';
        // Clear other dashboard elements on error too
        if (dbActivePoliciesEl) dbActivePoliciesEl.textContent = 'Error';
        if (dbLapsedPoliciesEl) dbLapsedPoliciesEl.textContent = 'Error';
        if (dbUpcomingPremiumEl) dbUpcomingPremiumEl.textContent = 'Error';
        if (dbUpcomingMaturityEl) dbUpcomingMaturityEl.textContent = 'Error';
    });
}

// --- Firestore Listener (Tasks) ---
function listenForTasks() {
    if (!db) { console.error("DB not initialized for tasks"); return; }
    if (unsubscribeTasks) unsubscribeTasks(); // Stop previous listener
    const tasksRef = collection(db, "tasks");
    const q = query(tasksRef, orderBy("createdAt", "desc")); // Always sort tasks by creation date desc

    console.log("Starting task listener...");
    unsubscribeTasks = onSnapshot(q, (snapshot) => {
        const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`Received ${tasks.length} tasks.`);
        renderTaskList(tasks); // Render tasks directly
        displayUpcomingTasks(tasks); // Update task reminders using fetched tasks
    }, (error) => {
        console.error("Error listening to tasks:", error);
        if(taskList) taskList.innerHTML = `<li class="error-tasks">Error loading tasks: ${error.message}. Check console and Firestore rules.</li>`;
        if(upcomingTaskListEl) upcomingTaskListEl.innerHTML = `<li class="error-tasks">Error loading upcoming tasks.</li>`;
    });
}


// --- फ़िल्टर, सॉर्ट और रेंडर (Policies) ---
function applyLicFiltersAndRender() {
     if (!allPoliciesCache || !licPolicyTableBody) {
         console.warn("applyLicFiltersAndRender: Cache or table body not ready.");
         return;
     }

     const searchTerm = licSearchInput ? licSearchInput.value.trim().toLowerCase() : '';
     const statusFilterValue = licStatusFilter ? licStatusFilter.value : '';
     const planFilterValue = licPlanFilter ? licPlanFilter.value.trim().toLowerCase() : '';
     const modeFilter = licModeFilter ? licModeFilter.value : '';
     const nachFilter = licNachFilter ? licNachFilter.value : '';

     console.log(`Filtering with Status: "${statusFilterValue}", Plan: "${planFilterValue}", Mode: "${modeFilter}", NACH: "${nachFilter}", Search: "${searchTerm}"`);

     let filteredPolicies = allPoliciesCache.filter(policy => {
         const searchMatch = searchTerm === '' ||
            (policy.customerName || '').toLowerCase().includes(searchTerm) ||
            (policy.policyNumber || '').toLowerCase().includes(searchTerm) ||
            (policy.mobileNo || '').toLowerCase().includes(searchTerm);

         const statusMatch = statusFilterValue === '' || (policy.policyStatus || '').toLowerCase() === statusFilterValue.toLowerCase();
         const planMatch = planFilterValue === '' || (policy.plan || '').toLowerCase().includes(planFilterValue);
         const modeMatch = modeFilter === '' || (policy.modeOfPayment || '') === modeFilter;
         const nachMatch = nachFilter === '' || (policy.nachStatus || '') === nachFilter;

         return searchMatch && statusMatch && planMatch && modeMatch && nachMatch;
     });

     console.log(`Policies before filtering: ${allPoliciesCache.length}, After filtering: ${filteredPolicies.length}`);

     // Sorting is now handled by the Firestore query in listenForPolicies
     // We just render the client-side filtered results
     renderPolicyTable(filteredPolicies);
}

// --- टेबल रेंडरिंग (Policies) ---
function renderPolicyTable(policies) {
    if (!licPolicyTableBody) return;
    licPolicyTableBody.innerHTML = ''; // Clear previous table content

    if (policies.length === 0) {
        licPolicyTableBody.innerHTML = `<tr><td colspan="9" style="text-align: center;">No policies found matching criteria.</td></tr>`;
        return;
    }

    policies.forEach(policy => {
        const row = licPolicyTableBody.insertRow();
        row.setAttribute('data-id', policy.id);

        row.insertCell().textContent = policy.policyNumber || '-';

        // Customer Name as Link
        const nameCell = row.insertCell();
        const nameLink = document.createElement('a');
        nameLink.href = "#";
        nameLink.textContent = policy.customerName || 'N/A';
        nameLink.title = `View details for ${policy.customerName || 'this client'}`;
        nameLink.style.cursor = 'pointer';
        nameLink.style.textDecoration = 'underline';
        nameLink.style.color = '#0056b3';
        // Use a closure to capture the correct policyId and customerName for the event listener
        nameLink.onclick = (e) => {
            e.preventDefault();
            showClientDetail(policy.id, policy.customerName); // Pass ID and name
        };
        nameCell.appendChild(nameLink);

        row.insertCell().textContent = policy.mobileNo || '-';
        row.insertCell().textContent = policy.plan || '-';
        row.insertCell().textContent = policy.premiumAmount ? `₹ ${Number(policy.premiumAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'; // Format currency
        row.insertCell().textContent = policy.modeOfPayment || '-';
        row.insertCell().textContent = policy.nextInstallmentDate?.toDate ? formatDate(policy.nextInstallmentDate.toDate()) : '-';

        // Status Badge
        const statusCell = row.insertCell();
        const statusBadge = document.createElement('span');
        const statusText = policy.policyStatus || 'Unknown';
        statusBadge.className = `status-badge status-${statusText.toLowerCase()}`;
        statusBadge.textContent = statusText;
        statusCell.appendChild(statusBadge);

        // Action Buttons
        const actionCell = row.insertCell();
        actionCell.classList.add('action-buttons');

        // Edit Button
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.title = "Edit Policy";
        editBtn.classList.add('button', 'edit-button');
        // Pass the full policy object to openPolicyModal for editing
        editBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent triggering row click if any
            openPolicyModal(policy.id, policy);
        };
        actionCell.appendChild(editBtn);

        // Pay Button (Mark Paid)
        const payBtn = document.createElement('button');
        payBtn.innerHTML = '<i class="fas fa-check-circle"></i>';
        payBtn.title = "Mark Premium Paid & Update Due Date";
        payBtn.classList.add('button', 'pay-button');
        // Enable only if Active/Lapsed, has next date and mode
        payBtn.disabled = !['Active', 'Lapsed'].includes(policy.policyStatus) || !policy.nextInstallmentDate || !policy.modeOfPayment;
        payBtn.onclick = (e) => {
            e.stopPropagation();
            handleMarkPaid(policy.id, policy);
        };
        actionCell.appendChild(payBtn);

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.title = "Delete Policy";
        deleteBtn.classList.add('button', 'delete-button');
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            handleDeletePolicy(policy.id, policy.policyNumber);
        };
        actionCell.appendChild(deleteBtn);
    });
}


// --- Modal खोलना/बंद करना (Policy Add/Edit) ---
function openPolicyModal(policyId = null, data = {}) {
    if (!policyModal || !policyForm || !policyModalTitle || !editPolicyId) {
        console.error("Cannot open policy modal: Required elements not found.");
        return;
    }
    policyForm.reset(); // Clear the form first
    editPolicyId.value = policyId || ''; // Set the hidden ID field

    if (policyId && data) {
        // --- EDIT MODE: Populate form data ---
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
        // Dropdowns
        if(policyStatusModal) policyStatusModal.value = data.policyStatus || 'Active';
        if(nachStatusModal) nachStatusModal.value = data.nachStatus || '';
    } else {
        // --- ADD MODE ---
        policyModalTitle.textContent = "Add New Policy";
        // Set defaults for dropdowns in add mode
        if(policyStatusModal) policyStatusModal.value = 'Active';
        if(nachStatusModal) nachStatusModal.value = 'No'; // Default NACH to No maybe?
        // Clear date fields explicitly if needed
        document.getElementById('dob').value = '';
        document.getElementById('issuanceDate').value = '';
        document.getElementById('nextInstallmentDate').value = '';
        document.getElementById('maturityDate').value = '';
    }

    // --- Show the modal ---
    policyModal.classList.add('active');
}

function closePolicyModal() {
    if (policyModal) policyModal.classList.remove('active');
}

// --- पॉलिसी सेव/अपडेट करना ---
async function handleSavePolicy(event) {
    event.preventDefault(); // Prevent default form submission
    if (!db) { console.error("DB not initialized"); return; }

    const policyId = editPolicyId.value; // Get ID from hidden field
    const isEditing = !!policyId;

    // --- Gather data from form ---
    const customerName = document.getElementById('customerName').value.trim();
    const policyNumber = document.getElementById('policyNumber').value.trim();
    const mobileNo = document.getElementById('mobileNo').value.trim();
    const issuanceDateStr = document.getElementById('issuanceDate').value;
    const modeOfPayment = document.getElementById('modeOfPayment').value;
    const premiumAmountStr = document.getElementById('premiumAmount').value;
    let nextInstallmentDateStr = document.getElementById('nextInstallmentDate').value; // Allow manual entry or calculation

    // --- Basic Validation ---
    if (!customerName || !policyNumber || !mobileNo || !issuanceDateStr || !modeOfPayment || !premiumAmountStr) {
        alert("Please fill in all required fields (*).");
        return;
    }

    const premiumAmount = parseFloat(premiumAmountStr);
    if (isNaN(premiumAmount) || premiumAmount <= 0) {
        alert("Please enter a valid positive premium amount.");
        return;
    }

    const issuanceDate = Timestamp.fromDate(new Date(issuanceDateStr + 'T00:00:00Z')); // Store as Timestamp

    // Calculate next installment date if not provided in ADD mode
    if (!isEditing && !nextInstallmentDateStr && issuanceDate && modeOfPayment) {
        try {
             const calculatedDate = calculateNextDueDate(issuanceDate.toDate(), modeOfPayment);
             if (calculatedDate) {
                  nextInstallmentDateStr = calculatedDate.toISOString().split('T')[0];
                   console.log(`Calculated next due date: ${nextInstallmentDateStr}`);
             } else {
                  console.warn("Could not calculate next due date automatically.");
                  // Optionally force user to enter it:
                  // alert("Could not calculate next due date automatically. Please enter it manually."); return;
             }
        } catch (e) {
             console.error("Error calculating next due date:", e);
             alert("Error calculating next due date. Please enter it manually.");
             return;
        }
    }

    // --- Prepare data object for Firestore ---
    const policyData = {
        customerName: customerName,
        fatherName: document.getElementById('fatherName').value.trim() || null,
        mobileNo: mobileNo,
        dob: document.getElementById('dob').value ? Timestamp.fromDate(new Date(document.getElementById('dob').value + 'T00:00:00Z')) : null,
        address: document.getElementById('address').value.trim() || null,
        policyNumber: policyNumber,
        plan: document.getElementById('plan').value.trim() || null,
        sumAssured: parseFloat(document.getElementById('sumAssured').value) || 0,
        policyTerm: document.getElementById('policyTerm').value.trim() || null,
        issuanceDate: issuanceDate,
        modeOfPayment: modeOfPayment,
        premiumAmount: premiumAmount,
        nextInstallmentDate: nextInstallmentDateStr ? Timestamp.fromDate(new Date(nextInstallmentDateStr + 'T00:00:00Z')) : null,
        maturityDate: document.getElementById('maturityDate').value ? Timestamp.fromDate(new Date(document.getElementById('maturityDate').value + 'T00:00:00Z')) : null,
        policyStatus: policyStatusModal.value || 'Active',
        nachStatus: nachStatusModal.value || 'No',
        // Add/update timestamps
        updatedAt: serverTimestamp() // Always set updatedAt
    };

    // Add createdAt only if it's a new policy
    if (!isEditing) {
        policyData.createdAt = serverTimestamp();
    }

    console.log("Saving policy data:", policyData);

    // --- Disable save button ---
    const saveButton = document.getElementById('savePolicyBtn'); // Get button inside handler
    if(saveButton) { saveButton.disabled = true; saveButton.textContent = 'Saving...'; }

    // --- Save to Firestore ---
    try {
        if (isEditing) {
            // Update existing document
            const policyRef = doc(db, "licCustomers", policyId);
            await updateDoc(policyRef, policyData);
            console.log("Policy updated successfully:", policyId);
            alert("Policy details updated successfully!");
        } else {
            // Add new document
            const policiesRef = collection(db, "licCustomers");
            const docRef = await addDoc(policiesRef, policyData);
            console.log("Policy added successfully with ID:", docRef.id);
            alert("New policy added successfully!");
        }
        closePolicyModal(); // Close modal on success
    } catch (error) {
        console.error("Error saving policy:", error);
        alert(`Failed to save policy: ${error.message}\nCheck console for details.`);
    } finally {
        // --- Re-enable save button ---
        if(saveButton) { saveButton.disabled = false; saveButton.innerHTML = '<i class="fas fa-save"></i> Save Policy'; }
    }
}


// --- पॉलिसी डिलीट करना ---
async function handleDeletePolicy(policyId, policyNumber) {
    if (!db || !policyId) return;
    if (confirm(`Are you sure you want to delete policy number "${policyNumber || 'this policy'}"?\nThis action cannot be undone.`)) {
        try {
            const policyRef = doc(db, "licCustomers", policyId);
            await deleteDoc(policyRef);
            console.log("Policy deleted successfully:", policyId);
            alert("Policy deleted successfully.");
            // The listener will automatically update the table
        } catch (error) {
            console.error("Error deleting policy:", error);
            alert(`Failed to delete policy: ${error.message}`);
        }
    }
}

// --- प्रीमियम भुगतान मार्क करना ---
async function handleMarkPaid(policyId, policyData) {
    if (!db || !policyId || !policyData.nextInstallmentDate || !policyData.modeOfPayment) {
        alert("Cannot mark as paid: Missing required policy data (ID, Next Due Date, Mode).");
        return;
    }

    const currentDueDate = policyData.nextInstallmentDate.toDate();
    const mode = policyData.modeOfPayment;

    try {
        const nextDueDate = calculateNextDueDate(currentDueDate, mode);
        if (!nextDueDate) {
            alert("Could not calculate the next due date based on the mode.");
            return;
        }

        const nextDueDateStr = formatDate(nextDueDate);
        if (!confirm(`Mark premium paid for policy ${policyData.policyNumber}?\n\nCurrent Due: ${formatDate(currentDueDate)}\nNext Due Date will be set to: ${nextDueDateStr}`)) {
            return;
        }

        const policyRef = doc(db, "licCustomers", policyId);
        await updateDoc(policyRef, {
            nextInstallmentDate: Timestamp.fromDate(nextDueDate),
            policyStatus: 'Active', // Ensure status is Active after payment
            updatedAt: serverTimestamp()
        });

        console.log(`Policy ${policyId} marked paid. Next due date set to ${nextDueDateStr}.`);
        alert(`Policy ${policyData.policyNumber} marked as paid.\nNext due date updated to ${nextDueDateStr}.`);
        // Listener will update the table

    } catch (error) {
        console.error("Error marking policy as paid:", error);
        alert(`Failed to mark policy as paid: ${error.message}`);
    }
}


// --- रिमाइंडर फंक्शन (Policies) ---
function displayReminders() {
    if (!reminderList || !allPoliciesCache) return;
    reminderList.innerHTML = '<li class="loading-reminder">Loading reminders...</li>'; // Show loading initially

    const today = new Date(); today.setHours(0, 0, 0, 0); // Start of today
    const fifteenDaysLater = new Date(today);
    fifteenDaysLater.setDate(today.getDate() + 15); // End of the 15th day

    const upcomingPolicies = allPoliciesCache.filter(policy => {
        if (!policy.nextInstallmentDate || !policy.nextInstallmentDate.toDate) return false;
        const dueDate = policy.nextInstallmentDate.toDate(); dueDate.setHours(0, 0, 0, 0);
        // Include policies due today up to 15 days from now
        return dueDate >= today && dueDate <= fifteenDaysLater && ['Active', 'Lapsed'].includes(policy.policyStatus);
    });

    // Sort by due date ascending
    upcomingPolicies.sort((a, b) => a.nextInstallmentDate.toDate() - b.nextInstallmentDate.toDate());

    reminderList.innerHTML = ''; // Clear loading/previous reminders

    if (upcomingPolicies.length === 0) {
        reminderList.innerHTML = '<li>No upcoming installments in the next 15 days.</li>';
        return;
    }

    upcomingPolicies.forEach(policy => {
        const li = document.createElement('li');
        // Removed checkbox as its function was unclear
        li.innerHTML = `
            <span>${policy.customerName || 'N/A'} (${policy.policyNumber || 'N/A'}) - Due: <strong>${formatDate(policy.nextInstallmentDate.toDate())}</strong> (₹ ${Number(policy.premiumAmount || 0).toLocaleString('en-IN')})</span>
        `;
        li.title = `Plan: ${policy.plan || '-'}, Mode: ${policy.modeOfPayment || '-'}`;
        reminderList.appendChild(li);
    });
}


// --- *** Task Management Functions (Follow-up Style) *** ---

// Render Task List (Updated for History Display)
function renderTaskList(tasks) { // Accepts tasks array directly
     if (!taskList) return;
     taskList.innerHTML = ''; // Clear previous list

     if (!tasks || tasks.length === 0) {
         taskList.innerHTML = '<li>No follow-up tasks found.</li>';
         return;
     }

     tasks.forEach(task => {
         const li = document.createElement('li');
         li.setAttribute('data-task-id', task.id);
         li.classList.toggle('completed-task', task.completed); // Add class if completed

         // Content Div (Customer, Description, Due Date, Last Comment)
         const contentDiv = document.createElement('div');
         contentDiv.style.flexGrow = '1';

         const customerSpan = document.createElement('span');
         customerSpan.style.fontWeight = 'bold';
         customerSpan.textContent = task.customerName ? `${task.customerName}: ` : '';

         const descSpan = document.createElement('span');
         descSpan.textContent = task.description || 'No description';

         const dateSpan = document.createElement('span');
         dateSpan.style.fontSize = '0.85em';
         dateSpan.style.color = '#555';
         dateSpan.style.marginLeft = '10px';
         dateSpan.textContent = task.dueDate?.toDate ? ` (Due: ${formatDate(task.dueDate.toDate())})` : '';

         contentDiv.appendChild(customerSpan);
         contentDiv.appendChild(descSpan);
         contentDiv.appendChild(dateSpan);

         // Display Latest Comment (if any)
         const commentSpan = document.createElement('p');
         commentSpan.style.fontSize = '0.85em';
         commentSpan.style.color = '#666';
         commentSpan.style.marginTop = '4px';
         commentSpan.style.whiteSpace = 'pre-wrap'; // Preserve line breaks in comments
         if (task.comments && Array.isArray(task.comments) && task.comments.length > 0) {
             // Sort comments to find the latest (descending by timestamp)
             task.comments.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
             const latestComment = task.comments[0]; // Get the most recent one
             const commentDate = latestComment.timestamp?.toDate ? formatDateTime(latestComment.timestamp.toDate()) : '';
             commentSpan.textContent = `Latest Comment ${commentDate ? `(${commentDate})` : ''}: ${latestComment.text || ''}`;
         } else if (task.comments && typeof task.comments === 'string' && task.comments.trim() !== '') {
             // Handle legacy string comments if necessary
             commentSpan.textContent = `Comment: ${task.comments}`;
         } else {
             commentSpan.textContent = ''; // No comments or empty array
             commentSpan.style.display = 'none'; // Hide if no comment
         }
         contentDiv.appendChild(commentSpan);

         // Actions Div (Checkbox, Edit, Delete)
         const actionsDiv = document.createElement('div');
         actionsDiv.classList.add('task-actions-container'); // Add a class for styling if needed
         actionsDiv.style.marginLeft = 'auto'; // Push actions to the right
         actionsDiv.style.display = 'flex';
         actionsDiv.style.gap = '8px'; // Space between buttons
         actionsDiv.style.flexShrink = '0'; // Prevent shrinking
         actionsDiv.style.alignItems = 'center'; // Align items vertically

         // Checkbox
         const checkbox = document.createElement('input');
         checkbox.type = 'checkbox';
         checkbox.className = 'task-checkbox';
         checkbox.checked = task.completed;
         checkbox.title = task.completed ? 'Mark as Pending' : 'Mark as Completed';
         checkbox.setAttribute('data-task-id', task.id); // Add id for event handler

         // Edit Button
         const editBtn = document.createElement('button');
         editBtn.innerHTML = '<i class="fas fa-edit"></i>';
         editBtn.className = 'button edit-button edit-task-btn'; // Use existing styles
         editBtn.title = 'Edit Task';
         editBtn.onclick = (e) => {
             e.stopPropagation(); // Prevent other clicks
             openEditTaskModal(task.id, task); // Pass ID and full task data
         };

         // Delete Button
         const deleteBtn = document.createElement('button');
         deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
         deleteBtn.className = 'button delete-task-btn'; // Use existing styles
         deleteBtn.title = 'Delete Task';
         deleteBtn.setAttribute('data-task-id', task.id); // Add id for event handler

         actionsDiv.appendChild(checkbox);
         actionsDiv.appendChild(editBtn);
         actionsDiv.appendChild(deleteBtn);

         li.appendChild(contentDiv);
         li.appendChild(actionsDiv);
         taskList.appendChild(li);
     });
 }


// Add New Follow-up Task
async function handleAddTask() {
    if (!db || !newTaskInput) return;

    const description = newTaskInput.value.trim();
    const customerName = newTaskCustomerNameEl.value.trim();
    const dueDateStr = newTaskDueDate.value;
    const initialComment = newTaskCommentsEl.value.trim();

    if (!description) {
        alert("Please enter the task description.");
        newTaskInput.focus();
        return;
    }

    const taskData = {
        customerName: customerName || null, // Store null if empty
        description: description,
        dueDate: dueDateStr ? Timestamp.fromDate(new Date(dueDateStr + 'T00:00:00Z')) : null,
        completed: false, // New tasks are pending
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        comments: [] // Initialize comments as an empty array
    };

    // Add the initial comment if provided
    if (initialComment) {
        taskData.comments.push({
            text: initialComment,
            timestamp: serverTimestamp() // Use server timestamp for consistency
        });
    }

    console.log("Adding task:", taskData);
    addTaskBtn.disabled = true;
    addTaskBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

    try {
        const tasksRef = collection(db, "tasks");
        await addDoc(tasksRef, taskData);
        alert("Follow-up task added successfully!");

        // Clear the form
        newTaskInput.value = '';
        newTaskCustomerNameEl.value = '';
        newTaskDueDate.value = '';
        newTaskCommentsEl.value = '';

    } catch (error) {
        console.error("Error adding task:", error);
        alert(`Failed to add task: ${error.message}`);
    } finally {
        addTaskBtn.disabled = false;
        addTaskBtn.innerHTML = '<i class="fas fa-plus"></i> Add Follow-up';
    }
}


// Handle Task Checkbox Change (using event delegation on taskList)
async function handleTaskCheckboxChange(event) {
    if (event.target.classList.contains('task-checkbox')) {
        const checkbox = event.target;
        const taskId = checkbox.getAttribute('data-task-id');
        const isCompleted = checkbox.checked;

        if (!db || !taskId) return;

        console.log(`Task ${taskId} completion changed to: ${isCompleted}`);
        const taskRef = doc(db, "tasks", taskId);
        checkbox.disabled = true; // Disable temporarily

        try {
            await updateDoc(taskRef, {
                completed: isCompleted,
                updatedAt: serverTimestamp()
            });
            console.log(`Task ${taskId} status updated.`);
            // Optionally update the visual style immediately
             checkbox.closest('li').classList.toggle('completed-task', isCompleted);
        } catch (error) {
            console.error("Error updating task status:", error);
            alert(`Failed to update task status: ${error.message}`);
            // Revert checkbox state on error
            checkbox.checked = !isCompleted;
        } finally {
             checkbox.disabled = false;
        }
    }
}

// Handle Task Actions (Delete Only, using event delegation)
async function handleTaskActions(event) {
    if (event.target.closest('.delete-task-btn')) {
        const deleteButton = event.target.closest('.delete-task-btn');
        const taskId = deleteButton.getAttribute('data-task-id');

        if (!db || !taskId) return;

        if (confirm("Are you sure you want to delete this task?")) {
             deleteButton.disabled = true; // Disable temporarily
             deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            try {
                const taskRef = doc(db, "tasks", taskId);
                await deleteDoc(taskRef);
                console.log(`Task ${taskId} deleted successfully.`);
                alert("Task deleted.");
                // Listener will update the list automatically
            } catch (error) {
                console.error("Error deleting task:", error);
                alert(`Failed to delete task: ${error.message}`);
                 deleteButton.disabled = false; // Re-enable on error
                 deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
            }
        }
    }
    // Note: Edit button click is handled directly on the button itself in renderTaskList
}


// Open Edit Task Modal (Updated for History)
function openEditTaskModal(taskId, taskData) {
    if (!editTaskModal || !editTaskForm || !editTaskIdEl || !editTaskCustomerNameEl || !editTaskDescriptionEl || !editTaskDueDateEl || !editTaskStatusEl || !editTaskCommentsHistoryEl || !editTaskNewCommentEl) {
        console.error("Cannot open edit task modal: Required elements not found.");
        return;
    }
    console.log("Opening edit modal for task:", taskId, taskData);

    // Populate basic fields
    editTaskIdEl.value = taskId;
    editTaskCustomerNameEl.value = taskData.customerName || '';
    editTaskDescriptionEl.value = taskData.description || '';
    editTaskDueDateEl.value = taskData.dueDate?.toDate ? taskData.dueDate.toDate().toISOString().split('T')[0] : '';
    editTaskStatusEl.value = taskData.completed ? 'completed' : 'pending';
    editTaskNewCommentEl.value = ''; // Clear new comment field

    // Display Comment History
    editTaskCommentsHistoryEl.innerHTML = ''; // Clear previous history
    if (taskData.comments && Array.isArray(taskData.comments) && taskData.comments.length > 0) {
         editTaskCommentsHistoryEl.innerHTML = '<h4>Comment History:</h4>';
         // Sort comments by timestamp if available, oldest first
         const sortedComments = [...taskData.comments].sort((a, b) => (a.timestamp?.toDate() || 0) - (b.timestamp?.toDate() || 0));

         sortedComments.forEach(comment => {
            const p = document.createElement('p');
            const commentDate = comment.timestamp?.toDate ? formatDateTime(comment.timestamp.toDate()) : 'Earlier';
            // Use innerHTML to allow formatting like bold or spans if needed later
            p.innerHTML = `<span class="log-meta">(${commentDate}):</span> ${comment.text || ''}`;
            editTaskCommentsHistoryEl.appendChild(p);
         });
    } else {
        // Provide feedback if no history
        editTaskCommentsHistoryEl.innerHTML = '<p><i>No comment history available.</i></p>';
    }

    editTaskModal.classList.add('active');
}

// Close Edit Task Modal
function closeEditTaskModal() {
    if (editTaskModal) {
        editTaskModal.classList.remove('active');
    }
}

// Handle Update Task Form Submission (Updated for History)
async function handleUpdateTask(event) {
    event.preventDefault();
    if (!db || !editTaskIdEl || !editTaskDescriptionEl || !editTaskStatusEl) {
        console.error("Cannot update task: DB or required form elements missing.");
        return;
    }

    const taskId = editTaskIdEl.value;
    if (!taskId) {
        alert("Error: Task ID missing.");
        return;
    }

    const description = editTaskDescriptionEl.value.trim();
    if (!description) {
        alert("Please enter task description.");
        editTaskDescriptionEl.focus();
        return;
    }

    const updatedData = {
        customerName: editTaskCustomerNameEl.value.trim() || null,
        description: description,
        dueDate: editTaskDueDateEl.value ? Timestamp.fromDate(new Date(editTaskDueDateEl.value + 'T00:00:00Z')) : null,
        completed: editTaskStatusEl.value === 'completed',
        updatedAt: serverTimestamp()
    };

    const newCommentText = editTaskNewCommentEl?.value.trim();

    const saveButton = document.getElementById('saveTaskChangesBtn');
    if(saveButton) { saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }

    try {
        const taskRef = doc(db, "tasks", taskId);

        // Use a transaction or batched write if adding comment, otherwise simple update
        if (newCommentText && typeof window.arrayUnion === 'function') {
            // Add new comment using arrayUnion
            const newCommentObject = {
                 text: newCommentText,
                 timestamp: serverTimestamp() // Server timestamp for the comment
            };
             // Add the comment field update along with other data
             updatedData.comments = window.arrayUnion(newCommentObject);
             await updateDoc(taskRef, updatedData);
             console.log("Task updated with new comment using arrayUnion.");
        } else {
             // Update basic fields only (or if arrayUnion failed)
             await updateDoc(taskRef, updatedData);
             console.log("Task updated (no new comment or arrayUnion unavailable).");
        }

        alert("Task updated successfully!");
        closeEditTaskModal();

    } catch (error) {
        console.error("Error updating task:", error);
        alert(`Failed to update task: ${error.message}`);
    } finally {
        if(saveButton) { saveButton.disabled = false; saveButton.innerHTML = '<i class="fas fa-save"></i> Save Changes'; }
    }
}


// Display Upcoming Tasks Reminder
function displayUpcomingTasks(tasks) { // Accepts tasks array
    if (!upcomingTaskListEl) return;
    upcomingTaskListEl.innerHTML = '<li class="loading-reminder">Loading upcoming tasks...</li>'; // Show loading

    if (!tasks) {
         console.warn("Upcoming tasks display called without tasks data.");
          upcomingTaskListEl.innerHTML = '<li>Could not load task data.</li>';
          return;
    }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 7);

    const upcomingDueTasks = tasks.filter(task => {
        if (task.completed || !task.dueDate?.toDate) return false; // Ignore completed or dateless tasks
        const dueDate = task.dueDate.toDate(); dueDate.setHours(0, 0, 0, 0);
        return dueDate >= today && dueDate <= sevenDaysLater;
    });

    // Sort by due date ascending
    upcomingDueTasks.sort((a, b) => (a.dueDate?.toDate() || 0) - (b.dueDate?.toDate() || 0));

    upcomingTaskListEl.innerHTML = ''; // Clear loading/previous

    if (upcomingDueTasks.length === 0) {
        upcomingTaskListEl.innerHTML = '<li>No follow-ups due in the next 7 days.</li>';
        return;
    }

    upcomingDueTasks.forEach(task => {
        const li = document.createElement('li');
        // Make the reminder clickable to open the edit modal
        li.innerHTML = `
            <a>${task.customerName ? task.customerName + ': ' : ''}${task.description} - Due: <strong>${formatDate(task.dueDate.toDate())}</strong></a>
        `;
         li.style.cursor = 'pointer';
         li.onclick = () => openEditTaskModal(task.id, task);
         li.title = 'Click to view/edit task';
        upcomingTaskListEl.appendChild(li);
    });
}


// --- Phase 2 Functions (Client Detail) ---

// Load Dashboard Data (Called from policy listener)
function loadDashboardData() {
    if (!allPoliciesCache || !dbTotalPoliciesEl || !dbActivePoliciesEl || !dbLapsedPoliciesEl || !dbUpcomingPremiumEl || !dbUpcomingMaturityEl) {
        console.warn("Dashboard elements or policy cache not ready.");
        return;
    }

    const totalPolicies = allPoliciesCache.length;
    const activePolicies = allPoliciesCache.filter(p => p.policyStatus === 'Active').length;
    const lapsedPolicies = allPoliciesCache.filter(p => p.policyStatus === 'Lapsed').length;

    // Calculate upcoming premiums (next 30 days)
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const thirtyDaysLater = new Date(today); thirtyDaysLater.setDate(today.getDate() + 30);
    let upcomingPremiumTotal = 0;
    allPoliciesCache.forEach(p => {
        if (p.nextInstallmentDate?.toDate && ['Active', 'Lapsed'].includes(p.policyStatus)) {
            const dueDate = p.nextInstallmentDate.toDate(); dueDate.setHours(0, 0, 0, 0);
            if (dueDate >= today && dueDate <= thirtyDaysLater) {
                upcomingPremiumTotal += Number(p.premiumAmount || 0);
            }
        }
    });

    // Calculate upcoming maturities (next 90 days)
    const ninetyDaysLater = new Date(today); ninetyDaysLater.setDate(today.getDate() + 90);
    const upcomingMaturitiesCount = allPoliciesCache.filter(p => {
         if (p.maturityDate?.toDate && ['Active', 'Lapsed'].includes(p.policyStatus)) { // Consider only active/lapsed for maturity? Or all?
             const maturityDate = p.maturityDate.toDate(); maturityDate.setHours(0, 0, 0, 0);
             return maturityDate >= today && maturityDate <= ninetyDaysLater;
         }
         return false;
     }).length;


    // Update Dashboard UI
    dbTotalPoliciesEl.textContent = totalPolicies;
    dbActivePoliciesEl.textContent = activePolicies;
    dbLapsedPoliciesEl.textContent = lapsedPolicies;
    dbUpcomingPremiumEl.textContent = `₹ ${upcomingPremiumTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    dbUpcomingMaturityEl.textContent = upcomingMaturitiesCount;

    console.log("Dashboard data loaded.");
}


// Show Client Detail Modal
async function showClientDetail(policyId, customerName) {
    if (!clientDetailModal || !db || !policyId) {
         console.error("Cannot show client detail: Modal or DB or Policy ID missing.");
         return;
     }

    console.log(`Showing details for policy ID: ${policyId}, Customer: ${customerName}`);
    currentOpenClientId = policyId; // Track which client detail is open (using policyId as identifier)

    // Set loading states
    clientDetailNameEl.textContent = `Details for ${customerName || 'Client'}`;
    clientDetailMobileEl.textContent = 'Loading...';
    clientDetailDobEl.textContent = 'Loading...';
    clientDetailFatherNameEl.textContent = 'Loading...';
    clientDetailAddressEl.textContent = 'Loading...';
    clientPoliciesListEl.innerHTML = '<p>Loading policies...</p>';
    communicationLogListEl.innerHTML = '<p>Loading communication logs...</p>';
    newLogNoteEl.value = ''; // Clear previous note input

    // Activate the first tab by default
    openDetailTab(null, 'clientPolicies', true); // Pass true to prevent event issues

    clientDetailModal.classList.add('active'); // Show the modal

    // --- Fetch data ---
    try {
        // 1. Fetch the specific policy clicked (might contain more details)
        const policyRef = doc(db, "licCustomers", policyId);
        const policySnap = await getDoc(policyRef);

        if (policySnap.exists()) {
            const policyData = policySnap.data();
            clientDetailNameEl.textContent = `Details for ${policyData.customerName || 'Client'}`; // Update name if needed
            clientDetailMobileEl.textContent = policyData.mobileNo || '-';
            clientDetailDobEl.textContent = policyData.dob?.toDate ? formatDate(policyData.dob.toDate()) : '-';
            clientDetailFatherNameEl.textContent = policyData.fatherName || '-';
            clientDetailAddressEl.textContent = policyData.address || '-';

             // 2. Fetch ALL policies for this customer based on a common identifier (e.g., mobile number or customer name)
             // IMPORTANT: Choose a reliable identifier. Mobile number might be better if names can have variations.
             // Using mobile number here as an example. Adjust if needed.
             const identifierField = 'mobileNo'; // Or 'customerName'
             const identifierValue = policyData.mobileNo; // Or policyData.customerName

             if (identifierValue) {
                const policiesQuery = query(collection(db, "licCustomers"), where(identifierField, "==", identifierValue));
                const customerPoliciesSnap = await getDocs(policiesQuery);
                const customerPolicies = customerPoliciesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                renderClientPolicies(customerPolicies); // Render the list of policies

                // 3. Load communication logs using the same identifier
                loadCommunicationLogs(identifierValue);
             } else {
                  console.warn("Cannot fetch related policies/logs: Identifier field (e.g., mobileNo) is empty for the selected policy.");
                  clientPoliciesListEl.innerHTML = '<p>Could not load related policies (missing identifier).</p>';
                  communicationLogListEl.innerHTML = '<p>Could not load communication logs (missing identifier).</p>';
             }

        } else {
            console.error(`Policy with ID ${policyId} not found.`);
            alert("Error: Could not find policy details.");
            closeClientDetail(); // Close modal if policy not found
        }
    } catch (error) {
        console.error("Error fetching client details:", error);
        alert(`Error loading client details: ${error.message}`);
        // Show error states in the modal
        clientDetailMobileEl.textContent = 'Error';
        // ... set other fields to 'Error' ...
        clientPoliciesListEl.innerHTML = '<p>Error loading policies.</p>';
        communicationLogListEl.innerHTML = '<p>Error loading communication logs.</p>';
    }
}


// Render the list of policies for the client in the detail view
function renderClientPolicies(policies) {
    if (!clientPoliciesListEl) return;
    clientPoliciesListEl.innerHTML = ''; // Clear previous list

    if (!policies || policies.length === 0) {
        clientPoliciesListEl.innerHTML = '<p>No policies found for this client.</p>';
        return;
    }

    const ul = document.createElement('ul');
    policies.sort((a, b) => (a.policyNumber || '').localeCompare(b.policyNumber || '')); // Sort by policy number

    policies.forEach(policy => {
        const li = document.createElement('li');
        const statusText = policy.policyStatus || 'Unknown';
        li.innerHTML = `
            <strong>Policy No:</strong> ${policy.policyNumber || '-'} |
            <strong>Plan:</strong> ${policy.plan || '-'} |
            <strong>Premium:</strong> ₹ ${Number(policy.premiumAmount || 0).toLocaleString('en-IN')} (${policy.modeOfPayment || '-'}) |
            <strong>Next Due:</strong> ${policy.nextInstallmentDate?.toDate ? formatDate(policy.nextInstallmentDate.toDate()) : '-'} |
            <span class="status-badge status-${statusText.toLowerCase()}">${statusText}</span>
        `;
        ul.appendChild(li);
    });
    clientPoliciesListEl.appendChild(ul);
}


// Load communication logs for a specific client identifier
async function loadCommunicationLogs(identifier) {
    if (!communicationLogListEl || !db || !identifier) return;
    communicationLogListEl.innerHTML = '<p>Loading logs...</p>'; // Show loading

    try {
        // Assuming logs are stored in a subcollection named 'communicationLogs' within the customer document
        // OR in a top-level collection 'communicationLogs' filtered by an identifier.
        // --- OPTION 1: Subcollection (Requires knowing the *document ID* of the customer) ---
        // This is harder if we only have mobile number. Would need to find the customer doc ID first.

        // --- OPTION 2: Top-level Collection (Simpler if using mobile/name as identifier) ---
        // Let's assume a top-level 'communicationLogs' collection
        const logsRef = collection(db, "communicationLogs");
        // Filter by the identifier (e.g., mobileNo or customerName)
        // Ensure you have an index created in Firestore for 'clientIdentifier' and 'timestamp'
        const q = query(logsRef, where("clientIdentifier", "==", identifier), orderBy("timestamp", "desc"));

        const logSnapshot = await getDocs(q);
        const logs = logSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        communicationLogListEl.innerHTML = ''; // Clear loading

        if (logs.length === 0) {
            communicationLogListEl.innerHTML = '<p>No communication logs found.</p>';
            return;
        }

        logs.forEach(log => {
            const p = document.createElement('p');
            const logDate = log.timestamp?.toDate ? formatDateTime(log.timestamp.toDate()) : 'Earlier';
            p.innerHTML = `<span class="log-meta">(${logDate}):</span> ${log.note || ''}`;
            communicationLogListEl.appendChild(p);
        });
         console.log(`Loaded ${logs.length} communication logs for identifier: ${identifier}`);

    } catch (error) {
        console.error(`Error loading communication logs for ${identifier}:`, error);
        communicationLogListEl.innerHTML = `<p>Error loading logs: ${error.message}</p>`;
    }
}


// Add a new communication note
async function addCommunicationNote() {
    if (!db || !newLogNoteEl || !currentOpenClientId) {
         alert("Cannot add note: Required data or context missing.");
         return;
     }

    const noteText = newLogNoteEl.value.trim();
    if (!noteText) {
        alert("Please enter a note to add.");
        newLogNoteEl.focus();
        return;
    }

    // We need the client identifier (e.g., mobile number) associated with currentOpenClientId (which is policyId)
    // Let's find it from the cache or refetch policy details
    const policyData = allPoliciesCache.find(p => p.id === currentOpenClientId);
    const clientIdentifier = policyData?.mobileNo; // Using mobile as identifier - CHANGE IF NEEDED

    if (!clientIdentifier) {
         alert("Could not determine the client identifier (e.g., mobile number) to save the log. Cannot add note.");
         return;
     }


    const logData = {
        clientIdentifier: clientIdentifier, // Store the identifier (e.g., mobile number)
        note: noteText,
        timestamp: serverTimestamp(),
        policyContextId: currentOpenClientId // Optional: Store which policy view triggered the log
    };

    addLogBtn.disabled = true;
    addLogBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

    try {
        // Assuming a top-level 'communicationLogs' collection
        const logsRef = collection(db, "communicationLogs");
        await addDoc(logsRef, logData);

        console.log("Communication log added successfully.");
        newLogNoteEl.value = ''; // Clear input
        // Reload logs for the current identifier to show the new one
        loadCommunicationLogs(clientIdentifier);

    } catch (error) {
        console.error("Error adding communication log:", error);
        alert(`Failed to add communication log: ${error.message}`);
    } finally {
        addLogBtn.disabled = false;
        addLogBtn.innerHTML = '<i class="fas fa-plus"></i> Add Note';
    }
}


// Close Client Detail Modal
function closeClientDetail() {
    if (clientDetailModal) {
        clientDetailModal.classList.remove('active');
        currentOpenClientId = null; // Reset tracker
        console.log("Client detail modal closed.");
    }
}


// Function to switch tabs in the Client Detail modal
window.openDetailTab = function(evt, tabName, isInitialCall = false) {
    // Prevent error if called without event on initial load
    if (evt && !isInitialCall) evt.preventDefault();

    // Get all elements with class="tab-content" and hide them
    const tabcontent = clientDetailModal.getElementsByClassName("tab-content");
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
        tabcontent[i].classList.remove("active");
    }

    // Get all elements with class="tab-button" and remove the class "active"
    const tablinks = clientDetailModal.getElementsByClassName("tab-button");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("active");
    }

    // Show the current tab, and add an "active" class to the button that opened the tab
    const currentTab = document.getElementById(tabName);
    if(currentTab) {
        currentTab.style.display = "block";
        currentTab.classList.add("active");
    }

    // Add active class to the button if called via event
     if (evt && evt.currentTarget) {
          evt.currentTarget.classList.add("active");
     } else if (isInitialCall) {
          // Find the button corresponding to the tabName and make it active
          const activeButton = Array.from(tablinks).find(btn => btn.getAttribute('onclick').includes(`'${tabName}'`));
          if (activeButton) activeButton.classList.add("active");
     }
}


// --- हेल्पर फंक्शन्स ---

// Format Date as DD-MM-YYYY
function formatDate(date) {
    if (!date || !(date instanceof Date)) return '-';
    let day = date.getDate().toString().padStart(2, '0');
    let month = (date.getMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed
    let year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

// Format Date and Time as DD-MM-YYYY HH:MM AM/PM
function formatDateTime(date) {
    if (!date || !(date instanceof Date)) return '-';
    let day = date.getDate().toString().padStart(2, '0');
    let month = (date.getMonth() + 1).toString().padStart(2, '0');
    let year = date.getFullYear();
    let hours = date.getHours();
    let minutes = date.getMinutes().toString().padStart(2, '0');
    let ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    let hoursStr = hours.toString().padStart(2, '0');
    return `${day}-${month}-${year} ${hoursStr}:${minutes} ${ampm}`;
}


// Calculate next due date based on start date and mode
function calculateNextDueDate(startDate, mode) {
     if (!startDate || !(startDate instanceof Date) || !mode) {
         console.error("calculateNextDueDate: Invalid input", startDate, mode);
         return null; // Or throw an error
     }
     let nextDate = new Date(startDate);
     // Set time to 00:00:00 to avoid timezone issues affecting date calculations
     nextDate.setHours(0, 0, 0, 0);

     switch (mode) {
         case 'Yearly':
             nextDate.setFullYear(nextDate.getFullYear() + 1);
             break;
         case 'Half-Yearly':
             nextDate.setMonth(nextDate.getMonth() + 6);
             break;
         case 'Quarterly':
             nextDate.setMonth(nextDate.getMonth() + 3);
             break;
         case 'Monthly':
             nextDate.setMonth(nextDate.getMonth() + 1);
             break;
         default:
             console.error(`calculateNextDueDate: Unknown mode "${mode}"`);
             return null; // Or throw error for unknown mode
     }
     return nextDate;
}


// --- फिल्टर/सॉर्ट हैंडलर्स ---

// Debounced filter handler
function handleLicFilterChange() {
    clearTimeout(searchDebounceTimerLic);
    searchDebounceTimerLic = setTimeout(() => {
        applyLicFiltersAndRender();
    }, 300); // Wait 300ms after user stops typing/changing
}

// Sort handler - Refetches data from Firestore with new sorting
function handleLicSortChange() {
    console.log("Sort changed:", sortLicSelect.value);
    // Re-initialize the policy listener with the new sort order
    listenForPolicies();
}

// Clear all filters and re-render
function clearLicFilters() {
    if (licSearchInput) licSearchInput.value = '';
    if (licStatusFilter) licStatusFilter.value = '';
    if (licPlanFilter) licPlanFilter.value = '';
    if (licModeFilter) licModeFilter.value = '';
    if (licNachFilter) licNachFilter.value = '';
    // Optionally reset sort to default and re-listen
    // if (sortLicSelect) sortLicSelect.value = 'createdAt_desc';
    // listenForPolicies();
    // Or just re-apply client-side filters if sorting isn't reset
    applyLicFiltersAndRender();
    console.log("Filters cleared.");
}

// --- एंड ऑफ़ फाइल ---