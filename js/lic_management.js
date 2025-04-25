// js/lic_management.js
// Updated with implementations, Next Due Date logic, and dynamic display

// --- सुनिश्चित करें कि ग्लोबल Firebase फंक्शन्स उपलब्ध हैं ---
// (If using modules, replace window with import/export)
const {
    db, collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp,
    query, where, orderBy, limit, Timestamp, runTransaction, onSnapshot,
    arrayUnion
} = window; // Assuming firebase functions are globally available via window

// --- DOM एलिमेंट वेरिएबल्स ---
let licPolicyTableBody, reminderList, policyModal, policyForm, policyModalTitle, editPolicyId,
    addNewPolicyBtn, closePolicyModalBtn, cancelPolicyBtn, savePolicyBtn,
    licSearchInput, sortLicSelect, clearLicFiltersBtn,
    policyStatusModal, nachStatusModal,
    licStatusFilter, licPlanFilter, licModeFilter, licNachFilter,
    newTaskCustomerNameEl, newTaskInput, newTaskDueDate, newTaskCommentsEl, addTaskBtn, taskList,
    dbTotalPoliciesEl, dbActivePoliciesEl, dbLapsedPoliciesEl, dbUpcomingPremiumEl, dbUpcomingMaturityEl,
    clientDetailModal, closeClientDetailBtn, closeClientDetailBtnBottom,
    clientDetailNameEl, clientDetailContentEl,
    clientDetailMobileEl, clientDetailDobEl, clientDetailFatherNameEl, clientDetailAddressEl,
    clientPoliciesListEl, communicationLogListEl,
    newLogNoteEl, addLogBtn,
    editTaskModal, editTaskForm, editTaskIdEl,
    editTaskCustomerNameEl, editTaskDescriptionEl, editTaskDueDateEl, editTaskCommentsEl, editTaskStatusEl,
    editTaskNewCommentEl,
    editTaskCommentsHistoryEl,
    closeEditTaskModalBtn, cancelEditTaskBtn, saveTaskChangesBtn,
    upcomingTaskListEl;


// --- ग्लोबल स्टेट ---
let currentLicSortField = 'createdAt';
let currentLicSortDirection = 'desc';
let unsubscribePolicies = null; // Firestore policy listener
let unsubscribeTasks = null; // Firestore task listener
let allPoliciesCache = []; // सभी पॉलिसियों का कैश
let searchDebounceTimerLic;
let currentOpenClientId = null; // ID of the client whose detail view is open


// --- पेज इनिशियलाइज़ेशन ---
window.initializeLicPage = function() {
    console.log("Initializing LIC Management Page...");

    // --- DOM एलिमेंट्स प्राप्त करें ---
    // (Ensure all these elements exist in your lic_management.html)
    licPolicyTableBody = document.getElementById('licPolicyTableBody');
    reminderList = document.getElementById('reminderList');
    policyModal = document.getElementById('policyModal');
    policyForm = document.getElementById('policyForm');
    policyModalTitle = document.getElementById('policyModalTitleText');
    editPolicyId = document.getElementById('editPolicyId');
    addNewPolicyBtn = document.getElementById('addNewPolicyBtn');
    closePolicyModalBtn = document.getElementById('closePolicyModal');
    cancelPolicyBtn = document.getElementById('cancelPolicyBtn');
    savePolicyBtn = document.getElementById('savePolicyBtn');
    licSearchInput = document.getElementById('licSearchInput');
    sortLicSelect = document.getElementById('sort-lic');
    clearLicFiltersBtn = document.getElementById('clearLicFiltersBtn');
    policyStatusModal = document.getElementById('policyStatus');
    nachStatusModal = document.getElementById('nachStatus');
    licStatusFilter = document.getElementById('licStatusFilter');
    licPlanFilter = document.getElementById('licPlanFilter');
    licModeFilter = document.getElementById('licModeFilter');
    licNachFilter = document.getElementById('licNachFilter');
    newTaskCustomerNameEl = document.getElementById('newTaskCustomerName');
    newTaskInput = document.getElementById('newTaskInput');
    newTaskDueDate = document.getElementById('newTaskDueDate');
    newTaskCommentsEl = document.getElementById('newTaskComments');
    addTaskBtn = document.getElementById('addTaskBtn');
    taskList = document.getElementById('taskList');
    dbTotalPoliciesEl = document.getElementById('dbTotalPolicies');
    dbActivePoliciesEl = document.getElementById('dbActivePolicies');
    dbLapsedPoliciesEl = document.getElementById('dbLapsedPolicies');
    dbUpcomingPremiumEl = document.getElementById('dbUpcomingPremium');
    dbUpcomingMaturityEl = document.getElementById('dbUpcomingMaturity');
    clientDetailModal = document.getElementById('clientDetailView');
    closeClientDetailBtn = document.getElementById('closeClientDetail');
    closeClientDetailBtnBottom = document.getElementById('closeClientDetailBtnBottom');
    clientDetailNameEl = document.getElementById('clientDetailName');
    clientDetailContentEl = document.getElementById('clientDetailContent'); // Parent for tabs
    clientDetailMobileEl = document.getElementById('clientDetailMobile');
    clientDetailDobEl = document.getElementById('clientDetailDob');
    clientDetailFatherNameEl = document.getElementById('clientDetailFatherName');
    clientDetailAddressEl = document.getElementById('clientDetailAddress');
    clientPoliciesListEl = document.getElementById('clientPoliciesList');
    communicationLogListEl = document.getElementById('communicationLogList');
    newLogNoteEl = document.getElementById('newLogNote');
    addLogBtn = document.getElementById('addLogBtn');
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
    saveTaskChangesBtn = document.getElementById('saveTaskChangesBtn'); // Ensure this ID exists
    upcomingTaskListEl = document.getElementById('upcomingTaskList');


    // --- URL पैरामीटर की जांच (Dashboard से लिंक के लिए) ---
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const clientIdToOpen = urlParams.get('openClientDetail');
        // Check if showClientDetail function exists before trying to call it
        if (clientIdToOpen && typeof showClientDetail === 'function') {
            console.log(`URL parameter found: openClientDetail=${clientIdToOpen}. Attempting to show details.`);
            // Delay slightly to allow Firestore listener to potentially fetch data first
            setTimeout(() => {
                console.log(`Calling showClientDetail for ID: ${clientIdToOpen} after delay.`);
                showClientDetail(clientIdToOpen, 'Loading Name...'); // Name will be updated inside showClientDetail
            }, 700); // Adjust delay if needed
        } else if (clientIdToOpen) {
             console.error(`URL parameter 'openClientDetail' found, but showClientDetail function is not defined or available globally.`);
             alert("Could not automatically open client details. The required function 'showClientDetail' might be missing or inaccessible.");
        }
    } catch(e) {
        console.error("Error processing URL parameters for auto-open:", e);
    }
    // --- URL पैरामीटर जांच समाप्त ---


    // --- डीबगिंग लॉग्स ---
    console.log('Debugging - Add New Policy Button Element:', addNewPolicyBtn);
    console.log('Debugging - Add Task Button Element:', addTaskBtn);

    // --- इवेंट लिस्टनर्स ---
    // Ensure all functions referenced here (like handleSavePolicy) are defined below or globally accessible
    if (addNewPolicyBtn) {
         console.log('Debugging - Attaching listener to Add New Policy button');
         addNewPolicyBtn.addEventListener('click', () => openPolicyModal());
    } else { console.error('ERROR: Add New Policy button not found!'); }

    if (policyForm) {
        policyForm.addEventListener('submit', handleSavePolicy); // <<<<------ Requires handleSavePolicy to be defined
        console.log('Debugging - Attaching listener to Policy Form submit');
    } else { console.error('ERROR: Policy Form not found!'); }

    if (closePolicyModalBtn) closePolicyModalBtn.addEventListener('click', closePolicyModal);
    if (cancelPolicyBtn) cancelPolicyBtn.addEventListener('click', closePolicyModal);
    if (policyModal) policyModal.addEventListener('click', (e) => { if (e.target === policyModal) closePolicyModal(); });

    if (licSearchInput) licSearchInput.addEventListener('input', handleLicFilterChange);
    if (licStatusFilter) licStatusFilter.addEventListener('change', handleLicFilterChange);
    if (licPlanFilter) licPlanFilter.addEventListener('input', handleLicFilterChange);
    if (licModeFilter) licModeFilter.addEventListener('change', handleLicFilterChange);
    if (licNachFilter) licNachFilter.addEventListener('change', handleLicFilterChange);
    if (sortLicSelect) sortLicSelect.addEventListener('change', handleLicSortChange);
    if (clearLicFiltersBtn) clearLicFiltersBtn.addEventListener('click', clearLicFilters);

    if (addTaskBtn) {
         console.log('Debugging - Attaching listener to Add Task button');
         addTaskBtn.addEventListener('click', handleAddTask); // Requires handleAddTask
    } else { console.error('ERROR: Add Task button not found!'); }

    if (taskList) {
        taskList.addEventListener('change', handleTaskCheckboxChange); // Requires handleTaskCheckboxChange
        taskList.addEventListener('click', handleTaskActions); // Requires handleTaskActions
    }

    if (editTaskForm) {
        editTaskForm.addEventListener('submit', handleUpdateTask); // Requires handleUpdateTask
        console.log('Debugging - Attaching listener to Edit Task Form submit');
    } else { console.error('ERROR: Edit Task Form not found!'); }

    if (closeEditTaskModalBtn) closeEditTaskModalBtn.addEventListener('click', closeEditTaskModal); // Requires closeEditTaskModal
    if (cancelEditTaskBtn) cancelEditTaskBtn.addEventListener('click', closeEditTaskModal); // Requires closeEditTaskModal
    if (editTaskModal) editTaskModal.addEventListener('click', (e) => { if (e.target === editTaskModal) closeEditTaskModal(); });

    if (closeClientDetailBtn) closeClientDetailBtn.addEventListener('click', closeClientDetail); // Requires closeClientDetail
    if (closeClientDetailBtnBottom) closeClientDetailBtnBottom.addEventListener('click', closeClientDetail); // Requires closeClientDetail
    if (clientDetailModal) clientDetailModal.addEventListener('click', (e) => { if (e.target === clientDetailModal) closeClientDetail(); });
    if (addLogBtn) addLogBtn.addEventListener('click', addCommunicationNote); // Requires addCommunicationNote

    // --- Firestore Listeners ---
    listenForPolicies(); // Requires listenForPolicies
    listenForTasks(); // Requires listenForTasks

    console.log("Initialization complete.");
}


// --- Firestore Listener (Policies) ---
function listenForPolicies() {
    if (!db) { console.error("DB not initialized"); return; }
    if (unsubscribePolicies) unsubscribePolicies(); // Stop previous listener
    const policiesRef = collection(db, "licCustomers");

    // Get sort order from select dropdown, default if not found
    const sortValue = sortLicSelect ? sortLicSelect.value : 'createdAt_desc';
    const [field, direction] = sortValue.split('_');
    currentLicSortField = field || 'createdAt';
    currentLicSortDirection = direction || 'desc';

    const q = query(policiesRef, orderBy(currentLicSortField, currentLicSortDirection));
    console.log(`Starting policy listener with sort: ${currentLicSortField} ${currentLicSortDirection}`);

    unsubscribePolicies = onSnapshot(q, (snapshot) => {
        console.log(`Received ${snapshot.docs.length} policies.`);
        // Store data in cache
        allPoliciesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Apply filters and render table
        applyLicFiltersAndRender(); // Requires applyLicFiltersAndRender
        // Update reminders display
        displayReminders(); // Requires displayReminders
        // Update dashboard stats
        loadDashboardData(); // Requires loadDashboardData
    }, (error) => {
        console.error("Error listening to policies:", error);
        if(licPolicyTableBody) licPolicyTableBody.innerHTML = `<tr><td colspan="9">Error loading policy data: ${error.message}. Check console and Firestore rules.</td></tr>`;
        // Clear dashboard stats on error
        if(dbTotalPoliciesEl) dbTotalPoliciesEl.textContent = 'Error';
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
    const q = query(tasksRef, orderBy("createdAt", "desc")); // Order by creation date descending

    console.log("Starting task listener...");
    unsubscribeTasks = onSnapshot(q, (snapshot) => {
        const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`Received ${tasks.length} tasks.`);
        renderTaskList(tasks); // Requires renderTaskList
        displayUpcomingTasks(tasks); // Requires displayUpcomingTasks
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
     // Get filter values from DOM elements
     const searchTerm = licSearchInput ? licSearchInput.value.trim().toLowerCase() : '';
     const statusFilterValue = licStatusFilter ? licStatusFilter.value : '';
     const planFilterValue = licPlanFilter ? licPlanFilter.value.trim().toLowerCase() : '';
     const modeFilter = licModeFilter ? licModeFilter.value : '';
     const nachFilter = licNachFilter ? licNachFilter.value : '';

     console.log(`Filtering with Status: "${statusFilterValue}", Plan: "${planFilterValue}", Mode: "${modeFilter}", NACH: "${nachFilter}", Search: "${searchTerm}"`);

     // Filter the cached policies
     let filteredPolicies = allPoliciesCache.filter(policy => {
         const searchMatch = searchTerm === '' ||
            (policy.customerName || '').toLowerCase().includes(searchTerm) ||
            (policy.policyNumber || '').toLowerCase().includes(searchTerm) ||
            (policy.mobileNo || '').toLowerCase().includes(searchTerm); // Include mobile number search
         const statusMatch = statusFilterValue === '' || (policy.policyStatus || '').toLowerCase() === statusFilterValue.toLowerCase();
         const planMatch = planFilterValue === '' || (policy.plan || '').toLowerCase().includes(planFilterValue);
         const modeMatch = modeFilter === '' || (policy.modeOfPayment || '') === modeFilter;
         const nachMatch = nachFilter === '' || (policy.nachStatus || '') === nachFilter;
         return searchMatch && statusMatch && planMatch && modeMatch && nachMatch;
     });
     console.log(`Policies before filtering: ${allPoliciesCache.length}, After filtering: ${filteredPolicies.length}`);
     renderPolicyTable(filteredPolicies); // Requires renderPolicyTable
}

// --- टेबल रेंडरिंग (Policies) - Updated for Dynamic Next Due Date ---
function renderPolicyTable(policies) {
    if (!licPolicyTableBody) return;
    licPolicyTableBody.innerHTML = ''; // Clear previous table content

    if (policies.length === 0) {
        licPolicyTableBody.innerHTML = `<tr><td colspan="9" style="text-align: center;">No policies found matching criteria.</td></tr>`;
        return;
    }

    const today = new Date(); // Get today's date once for comparison
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    policies.forEach(policy => {
        const row = licPolicyTableBody.insertRow();
        row.setAttribute('data-id', policy.id);

        row.insertCell().textContent = policy.policyNumber || '-';

        // Customer Name as Link
        const nameCell = row.insertCell();
        const nameLink = document.createElement('a');
        nameLink.href = "#"; // Prevent default navigation
        nameLink.textContent = policy.customerName || 'N/A';
        nameLink.title = `View details for ${policy.customerName || 'this client'}`;
        nameLink.style.cursor = 'pointer';
        nameLink.onclick = (e) => {
            e.preventDefault();
            // Check if showClientDetail function exists before calling
            if (typeof showClientDetail === 'function') {
                showClientDetail(policy.id, policy.customerName); // Requires showClientDetail
            } else {
                console.error("showClientDetail function is not defined.");
                alert("Cannot show client details. Function missing.");
            }
        };
        nameCell.appendChild(nameLink);

        row.insertCell().textContent = policy.mobileNo || '-';
        row.insertCell().textContent = policy.plan || '-';
        row.insertCell().textContent = policy.premiumAmount ? `₹ ${Number(policy.premiumAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
        row.insertCell().textContent = policy.modeOfPayment || '-';

        // --- Calculate and Display Dynamic Next Due Date ---
        let displayDueDateStr = '-';
        const storedNextDueDate = policy.nextInstallmentDate?.toDate(); // Get stored date as Date object
        if (storedNextDueDate && policy.modeOfPayment) {
             let displayDate = new Date(storedNextDueDate); // Clone the date
             displayDate.setHours(0,0,0,0); // Normalize stored date

             let safetyCounter = 0;
             const maxIterations = 120; // Safety limit
             // If the stored date is in the past, calculate future dates until it's today or in the future
             while (displayDate < today && safetyCounter < maxIterations) {
                 const calculated = calculateNextDueDate(displayDate, policy.modeOfPayment); // Requires calculateNextDueDate
                 if (!calculated) { displayDate = null; break; } // Break if calculation fails
                  displayDate = calculated;
                  displayDate.setHours(0,0,0,0); // Normalize calculated date
                  safetyCounter++;
             }

              if (safetyCounter >= maxIterations) { displayDueDateStr = 'Calc Limit'; }
              else if (displayDate) { displayDueDateStr = formatDate(displayDate); } // Requires formatDate
              else { displayDueDateStr = 'Calc Error'; }
        } else if (storedNextDueDate) {
            // If date exists but mode is missing, just show stored date
            displayDueDateStr = formatDate(storedNextDueDate); // Requires formatDate
        }
        row.insertCell().textContent = displayDueDateStr;
        // ----------------------------------------------------

        // Status Badge
        const statusCell = row.insertCell();
        const statusBadge = document.createElement('span');
        const statusText = policy.policyStatus || 'Unknown';
        statusBadge.className = `status-badge status-${statusText.toLowerCase().replace(/\s+/g, '-')}`;
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
        editBtn.onclick = (e) => { e.stopPropagation(); openPolicyModal(policy.id, policy); }; // Requires openPolicyModal
        actionCell.appendChild(editBtn);

        // Pay Button (Mark Paid)
        const payBtn = document.createElement('button');
        payBtn.innerHTML = '<i class="fas fa-check-circle"></i>';
        payBtn.title = "Mark Premium Paid & Update Due Date";
        payBtn.classList.add('button', 'pay-button');
         const isPayable = ['Active', 'Lapsed'].includes(policy.policyStatus) && displayDueDateStr !== '-' && !displayDueDateStr.startsWith('Calc');
         payBtn.disabled = !isPayable;
        payBtn.onclick = (e) => { e.stopPropagation(); handleMarkPaid(policy.id, policy); }; // Requires handleMarkPaid
        actionCell.appendChild(payBtn);

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.title = "Delete Policy";
        deleteBtn.classList.add('button', 'delete-button');
        deleteBtn.onclick = (e) => { e.stopPropagation(); handleDeletePolicy(policy.id, policy.policyNumber); }; // Requires handleDeletePolicy
        actionCell.appendChild(deleteBtn);
    });
}


// --- Modal खोलना/बंद करना (Policy Add/Edit) ---
function openPolicyModal(policyId = null, data = {}) {
    if (!policyModal || !policyForm || !policyModalTitle || !editPolicyId) {
        console.error("Cannot open policy modal: Required elements not found.");
        return;
    }
    policyForm.reset(); // Clear form fields
    editPolicyId.value = policyId || ''; // Set hidden ID field

    if (policyId && data && Object.keys(data).length > 0) {
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
        // Populate the hidden nextInstallmentDate field for reference, though it's not directly edited by user
        document.getElementById('nextInstallmentDate').value = data.nextInstallmentDate?.toDate ? data.nextInstallmentDate.toDate().toISOString().split('T')[0] : '';
        document.getElementById('maturityDate').value = data.maturityDate?.toDate ? data.maturityDate.toDate().toISOString().split('T')[0] : '';
        if(policyStatusModal) policyStatusModal.value = data.policyStatus || 'Active';
        if(nachStatusModal) nachStatusModal.value = data.nachStatus || '';
    } else {
        // --- ADD MODE ---
        policyModalTitle.textContent = "Add New Policy";
        if(policyStatusModal) policyStatusModal.value = 'Active'; // Default status
        if(nachStatusModal) nachStatusModal.value = 'No'; // Default NACH
        // Ensure date fields are explicitly cleared
        document.getElementById('dob').value = '';
        document.getElementById('issuanceDate').value = '';
        document.getElementById('nextInstallmentDate').value = ''; // Keep hidden field blank in add mode
        document.getElementById('maturityDate').value = '';
    }
    policyModal.classList.add('active'); // Show the modal
}

function closePolicyModal() {
    if (policyModal) policyModal.classList.remove('active');
}

// --- पॉलिसी सेव/अपडेट करना - Updated for Auto Calculation on Add ---
async function handleSavePolicy(event) {
    event.preventDefault(); // Prevent default form submission behaviour
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

    // --- Basic Validation ---
    if (!customerName || !policyNumber || !mobileNo || !issuanceDateStr || !modeOfPayment || !premiumAmountStr) {
        alert("Please fill in all required fields (*).");
        return;
    }
    if (!/^\d{10}$/.test(mobileNo)) { // Validate mobile number format
        alert("Please enter a valid 10-digit mobile number.");
        return;
    }
    const premiumAmount = parseFloat(premiumAmountStr);
    if (isNaN(premiumAmount) || premiumAmount <= 0) {
        alert("Please enter a valid positive premium amount.");
        return;
    }

    // Convert dates to Firestore Timestamps (store as UTC start of day)
    const issuanceDate = Timestamp.fromDate(new Date(issuanceDateStr + 'T00:00:00Z'));
    const dobTimestamp = document.getElementById('dob').value ? Timestamp.fromDate(new Date(document.getElementById('dob').value + 'T00:00:00Z')) : null;
    const maturityDateTimestamp = document.getElementById('maturityDate').value ? Timestamp.fromDate(new Date(document.getElementById('maturityDate').value + 'T00:00:00Z')) : null;


    // --- Prepare data object for Firestore ---
    const policyData = {
        customerName: customerName,
        fatherName: document.getElementById('fatherName').value.trim() || null,
        mobileNo: mobileNo,
        dob: dobTimestamp,
        address: document.getElementById('address').value.trim() || null,
        policyNumber: policyNumber,
        plan: document.getElementById('plan').value.trim() || null,
        sumAssured: parseFloat(document.getElementById('sumAssured').value) || 0,
        policyTerm: document.getElementById('policyTerm').value.trim() || null,
        issuanceDate: issuanceDate,
        modeOfPayment: modeOfPayment,
        premiumAmount: premiumAmount,
        maturityDate: maturityDateTimestamp,
        policyStatus: policyStatusModal.value || 'Active',
        nachStatus: nachStatusModal.value || 'No',
        updatedAt: serverTimestamp(), // Always set updatedAt timestamp
        // Conditional fields based on add/edit
        ...(isEditing ? {} : { createdAt: serverTimestamp() }) // Add createdAt only for new policies
    };

     // Add lowercase name for searching if not editing or if name changed
     if (!isEditing || (isEditing && data.customerName !== customerName)) {
          policyData.customerNameLower = customerName.toLowerCase();
     }


    // --- Calculate Next Installment Date ONLY for NEW policies ---
    if (!isEditing) {
        try {
            const firstDueDate = calculateNextDueDate(issuanceDate.toDate(), modeOfPayment); // Requires calculateNextDueDate
            if (firstDueDate) {
                policyData.nextInstallmentDate = Timestamp.fromDate(firstDueDate);
                console.log(`Calculated first due date: ${formatDate(firstDueDate)}`); // Requires formatDate
            } else {
                policyData.nextInstallmentDate = null;
                console.warn("Could not calculate the first due date.");
                alert("Warning: Could not automatically calculate the first due date based on Issuance Date and Mode. Saving with no due date.");
            }
        } catch (e) {
            console.error("Error calculating first due date:", e);
            policyData.nextInstallmentDate = null;
            alert("Error calculating the first due date. Please check Mode of Payment.");
        }
    } else {
         // For editing, preserve the existing nextInstallmentDate unless mode/issuance changed significantly
         // (Simple approach: just preserve it for now)
         const existingPolicyData = allPoliciesCache.find(p => p.id === policyId);
         if (existingPolicyData && existingPolicyData.nextInstallmentDate) {
             policyData.nextInstallmentDate = existingPolicyData.nextInstallmentDate;
         } else {
             // If it didn't exist before, don't add it now during edit unless calculated
             policyData.nextInstallmentDate = null;
         }
    }


    console.log("Saving policy data:", policyData);

    // --- Disable save button ---
    const saveButtonElement = document.getElementById('savePolicyBtn'); // Use a different name from variable
    if(saveButtonElement) { saveButtonElement.disabled = true; saveButtonElement.textContent = 'Saving...'; }

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
        if(saveButtonElement) { saveButtonElement.disabled = false; saveButtonElement.textContent = 'Save Policy'; } // Restore text
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
            // Firestore listener will automatically update the table
        } catch (error) {
            console.error("Error deleting policy:", error);
            alert(`Failed to delete policy: ${error.message}`);
        }
    }
}

// --- प्रीमियम भुगतान मार्क करना ---
async function handleMarkPaid(policyId, policyData) {
    if (!db || !policyId || !policyData.nextInstallmentDate || !policyData.modeOfPayment) {
        alert("Cannot mark as paid: Missing required policy data (ID, Stored Next Due Date, Mode).");
        return;
    }

    const currentStoredDueDate = policyData.nextInstallmentDate.toDate();
    const mode = policyData.modeOfPayment;

    try {
        // Calculate the next due date based on the *stored* due date
        const nextCalculatedDueDate = calculateNextDueDate(currentStoredDueDate, mode); // Requires calculateNextDueDate
        if (!nextCalculatedDueDate) {
            alert("Could not calculate the next due date based on the mode.");
            return;
        }

        const nextDueDateStr = formatDate(nextCalculatedDueDate); // Requires formatDate
        if (!confirm(`Mark premium paid for policy ${policyData.policyNumber}?\n\nCurrent Stored Due: ${formatDate(currentStoredDueDate)}\nNext Due Date will be updated in database to: ${nextDueDateStr}`)) {
            return; // User cancelled
        }

        const policyRef = doc(db, "licCustomers", policyId);
        await updateDoc(policyRef, {
            nextInstallmentDate: Timestamp.fromDate(nextCalculatedDueDate), // Update stored date
            policyStatus: 'Active', // Ensure status is Active after payment
            updatedAt: serverTimestamp()
        });

        console.log(`Policy ${policyId} marked paid. Stored next due date updated to ${nextDueDateStr}.`);
        alert(`Policy ${policyData.policyNumber} marked as paid.\nNext due date in database updated to ${nextDueDateStr}.`);
        // Firestore listener will update the table display automatically

    } catch (error) {
        console.error("Error marking policy as paid:", error);
        alert(`Failed to mark policy as paid: ${error.message}`);
    }
}


// --- रिमाइंडर फंक्शन (Policies) ---
function displayReminders() {
    if (!reminderList || !allPoliciesCache) return;
    reminderList.innerHTML = '<li class="loading-reminder">Loading reminders...</li>';

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const fifteenDaysLater = new Date(today); fifteenDaysLater.setDate(today.getDate() + 15);

    const upcomingPolicies = [];
    allPoliciesCache.forEach(policy => {
         // Use the same dynamic date calculation as the table
         const storedNextDueDate = policy.nextInstallmentDate?.toDate();
         // Only consider Active or Lapsed policies for reminders
         if (storedNextDueDate && policy.modeOfPayment && ['Active', 'Lapsed'].includes(policy.policyStatus)) {
              let displayDate = new Date(storedNextDueDate);
              displayDate.setHours(0,0,0,0);
              let safetyCounter = 0;
              const maxIterations = 120;
              // Calculate the actual upcoming due date
              while (displayDate < today && safetyCounter < maxIterations) {
                  const calculated = calculateNextDueDate(displayDate, policy.modeOfPayment); // Requires calculateNextDueDate
                   if (!calculated) { displayDate = null; break; }
                   displayDate = calculated;
                   displayDate.setHours(0,0,0,0);
                   safetyCounter++;
              }

               // If a valid future date was found/calculated and it's within 15 days
               if (displayDate && displayDate >= today && displayDate <= fifteenDaysLater) {
                    upcomingPolicies.push({ ...policy, displayDueDate: displayDate }); // Store calculated date
               }
         }
    });

    // Sort by the calculated display due date
    upcomingPolicies.sort((a, b) => a.displayDueDate - b.displayDueDate);

    reminderList.innerHTML = ''; // Clear loading message

    if (upcomingPolicies.length === 0) {
        reminderList.innerHTML = '<li>No upcoming installments in the next 15 days.</li>';
        return;
    }

    upcomingPolicies.forEach(policy => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${policy.customerName || 'N/A'} (${policy.policyNumber || 'N/A'}) - Due: <strong>${formatDate(policy.displayDueDate)}</strong> (₹ ${Number(policy.premiumAmount || 0).toLocaleString('en-IN')})</span>
        `; // Requires formatDate
        li.title = `Plan: ${policy.plan || '-'}, Mode: ${policy.modeOfPayment || '-'}`;
        // Add click functionality if needed, e.g., to open client detail
        li.style.cursor = 'pointer';
        li.onclick = () => {
             if (typeof showClientDetail === 'function') {
                 showClientDetail(policy.id, policy.customerName); // Requires showClientDetail
             } else {
                 console.error("showClientDetail function not found for reminder click.");
             }
        };
        reminderList.appendChild(li);
    });
}


// --- Task Management Functions ---

// Render Task List
function renderTaskList(tasks) {
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

         const contentDiv = document.createElement('div');
         contentDiv.style.flexGrow = '1'; // Allow text content to take space

         const customerSpan = document.createElement('span');
         customerSpan.style.fontWeight = 'bold';
         customerSpan.textContent = task.customerName ? `${task.customerName}: ` : '';

         const descSpan = document.createElement('span');
         descSpan.textContent = task.description || 'No description';

         const dateSpan = document.createElement('span');
         dateSpan.style.fontSize = '0.85em'; dateSpan.style.color = '#555'; dateSpan.style.marginLeft = '10px';
         dateSpan.textContent = task.dueDate?.toDate ? ` (Due: ${formatDate(task.dueDate.toDate())})` : ''; // Requires formatDate

         contentDiv.appendChild(customerSpan);
         contentDiv.appendChild(descSpan);
         contentDiv.appendChild(dateSpan);

         // Display latest comment (if any)
         const commentSpan = document.createElement('p');
         commentSpan.style.fontSize = '0.85em'; commentSpan.style.color = '#666'; commentSpan.style.marginTop = '4px'; commentSpan.style.whiteSpace = 'pre-wrap'; // Preserve line breaks
         if (task.comments && Array.isArray(task.comments) && task.comments.length > 0) {
             // Sort comments by timestamp descending to get the latest
             task.comments.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
             const latestComment = task.comments[0];
             const commentDate = latestComment.timestamp?.toDate ? formatDateTime(latestComment.timestamp.toDate()) : ''; // Requires formatDateTime
             commentSpan.textContent = `Latest Comment ${commentDate ? `(${commentDate})` : ''}: ${latestComment.text || ''}`;
         } else {
             commentSpan.style.display = 'none'; // Hide if no comments
         }
         contentDiv.appendChild(commentSpan);

         // Action buttons container
         const actionsDiv = document.createElement('div');
         actionsDiv.classList.add('task-actions-container'); // For potential styling
         actionsDiv.style.marginLeft = 'auto'; // Push actions to the right
         actionsDiv.style.display = 'flex';
         actionsDiv.style.gap = '8px';
         actionsDiv.style.flexShrink = '0'; // Prevent actions from shrinking
         actionsDiv.style.alignItems = 'center';

         const checkbox = document.createElement('input');
         checkbox.type = 'checkbox';
         checkbox.className = 'task-checkbox';
         checkbox.checked = task.completed;
         checkbox.title = task.completed ? 'Mark as Pending' : 'Mark as Completed';
         checkbox.setAttribute('data-task-id', task.id); // ID for event handler

         const editBtn = document.createElement('button');
         editBtn.innerHTML = '<i class="fas fa-edit"></i>';
         editBtn.className = 'button edit-button edit-task-btn'; // Add specific class
         editBtn.title = 'Edit Task';
         editBtn.onclick = (e) => {
             e.stopPropagation(); // Prevent li click if needed
             openEditTaskModal(task.id, task); // Requires openEditTaskModal
         };

         const deleteBtn = document.createElement('button');
         deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
         deleteBtn.className = 'button delete-task-btn'; // Add specific class
         deleteBtn.title = 'Delete Task';
         deleteBtn.setAttribute('data-task-id', task.id); // ID for event handler

         actionsDiv.appendChild(checkbox);
         actionsDiv.appendChild(editBtn);
         actionsDiv.appendChild(deleteBtn);

         li.appendChild(contentDiv); // Add content first
         li.appendChild(actionsDiv); // Then add actions
         taskList.appendChild(li);
     });
 }

// Add New Follow-up Task
async function handleAddTask() {
    if (!db || !newTaskInput || !addTaskBtn) return; // Check for button too
    const description = newTaskInput.value.trim();
    const customerName = newTaskCustomerNameEl ? newTaskCustomerNameEl.value.trim() : null; // Handle missing element gracefully
    const dueDateStr = newTaskDueDate ? newTaskDueDate.value : null;
    const initialComment = newTaskCommentsEl ? newTaskCommentsEl.value.trim() : null;

    if (!description) { alert("Please enter the task description."); newTaskInput.focus(); return; }

    const taskData = {
        customerName: customerName || null, // Store null if empty or element missing
        description: description,
        dueDate: dueDateStr ? Timestamp.fromDate(new Date(dueDateStr + 'T00:00:00Z')) : null, // Store as UTC start of day
        completed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        comments: [] // Initialize comments array
    };

    // Add initial comment if provided
    if (initialComment) {
        taskData.comments.push({ text: initialComment, timestamp: serverTimestamp() });
    }

    console.log("Adding task:", taskData);
    // Disable button and show loading state
    addTaskBtn.disabled = true;
    addTaskBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

    try {
        const tasksRef = collection(db, "tasks");
        await addDoc(tasksRef, taskData);
        alert("Follow-up task added successfully!");
        // Clear form fields if they exist
        if(newTaskInput) newTaskInput.value = '';
        if(newTaskCustomerNameEl) newTaskCustomerNameEl.value = '';
        if(newTaskDueDate) newTaskDueDate.value = '';
        if(newTaskCommentsEl) newTaskCommentsEl.value = '';
    } catch (error) {
        console.error("Error adding task:", error);
        alert(`Failed to add task: ${error.message}`);
    } finally {
        // Re-enable button and restore text
        addTaskBtn.disabled = false;
        addTaskBtn.innerHTML = '<i class="fas fa-plus"></i> Add Follow-up';
    }
}

// Handle Task Checkbox Change
async function handleTaskCheckboxChange(event) {
    // Check if the event target is the checkbox we are interested in
    if (event.target.classList.contains('task-checkbox')) {
        const checkbox = event.target;
        const taskId = checkbox.getAttribute('data-task-id');
        const isCompleted = checkbox.checked;
        if (!db || !taskId) return;

        console.log(`Task ${taskId} completion changed to: ${isCompleted}`);
        const taskRef = doc(db, "tasks", taskId);
        checkbox.disabled = true; // Disable checkbox during update

        try {
            await updateDoc(taskRef, { completed: isCompleted, updatedAt: serverTimestamp() });
            console.log(`Task ${taskId} status updated.`);
            // Toggle visual style on the parent li element
            checkbox.closest('li')?.classList.toggle('completed-task', isCompleted);
        } catch (error) {
            console.error("Error updating task status:", error);
            alert(`Failed to update task status: ${error.message}`);
            // Revert checkbox state on error
            checkbox.checked = !isCompleted;
        } finally {
            checkbox.disabled = false; // Re-enable checkbox
        }
    }
}

// Handle Task Actions (Delete Button Click)
async function handleTaskActions(event) {
    // Use event delegation to find the delete button
    const deleteButton = event.target.closest('.delete-task-btn');
    if (deleteButton) {
        const taskId = deleteButton.getAttribute('data-task-id');
        if (!db || !taskId) return;

        if (confirm("Are you sure you want to delete this task?")) {
             deleteButton.disabled = true; // Disable button
             deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; // Show loading state

            try {
                const taskRef = doc(db, "tasks", taskId);
                await deleteDoc(taskRef);
                console.log(`Task ${taskId} deleted successfully.`);
                alert("Task deleted.");
                // Listener will automatically remove the item from the list
            } catch (error) {
                console.error("Error deleting task:", error);
                alert(`Failed to delete task: ${error.message}`);
                 // Restore button on error
                 deleteButton.disabled = false;
                 deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
            }
        }
    }
}

// Open Edit Task Modal
function openEditTaskModal(taskId, taskData) {
    // Ensure all required modal elements exist
    if (!editTaskModal || !editTaskForm || !editTaskIdEl || !editTaskCustomerNameEl || !editTaskDescriptionEl || !editTaskDueDateEl || !editTaskStatusEl || !editTaskCommentsHistoryEl || !editTaskNewCommentEl) {
        console.error("Cannot open edit task modal: Required elements not found.");
        alert("Error: Cannot open task editor.");
        return;
    }
    console.log("Opening edit modal for task:", taskId, taskData);

    // Populate form fields
    editTaskIdEl.value = taskId;
    editTaskCustomerNameEl.value = taskData.customerName || '';
    editTaskDescriptionEl.value = taskData.description || '';
    editTaskDueDateEl.value = taskData.dueDate?.toDate ? taskData.dueDate.toDate().toISOString().split('T')[0] : '';
    editTaskStatusEl.value = taskData.completed ? 'completed' : 'pending'; // Set dropdown value
    editTaskNewCommentEl.value = ''; // Clear new comment field

    // Populate comment history
    editTaskCommentsHistoryEl.innerHTML = ''; // Clear previous history
    if (taskData.comments && Array.isArray(taskData.comments) && taskData.comments.length > 0) {
         editTaskCommentsHistoryEl.innerHTML = '<h4 style="margin-bottom: 5px;">Comment History:</h4>';
         // Sort comments oldest first for history display
         const sortedComments = [...taskData.comments].sort((a, b) => (a.timestamp?.toDate() || 0) - (b.timestamp?.toDate() || 0));
         sortedComments.forEach(comment => {
            const p = document.createElement('p');
            p.style.cssText = 'margin: 2px 0; font-size: 0.9em; border-bottom: 1px dotted #eee; padding-bottom: 2px;';
            const commentDate = comment.timestamp?.toDate ? formatDateTime(comment.timestamp.toDate()) : 'Earlier'; // Requires formatDateTime
            // Display timestamp and text
            p.innerHTML = `<span class="log-meta" style="color:#777;">(${commentDate}):</span> ${comment.text || ''}`;
            editTaskCommentsHistoryEl.appendChild(p);
        });
    } else {
        editTaskCommentsHistoryEl.innerHTML = '<p><i>No comment history available.</i></p>';
    }

    // Show the modal
    editTaskModal.classList.add('active');
}


// Close Edit Task Modal
function closeEditTaskModal() {
    if (editTaskModal) {
        editTaskModal.classList.remove('active');
    }
}

// Handle Update Task Form Submission
async function handleUpdateTask(event) {
    event.preventDefault(); // Prevent default form submission
    // Ensure required elements and DB functions are available
    if (!db || !editTaskIdEl || !editTaskDescriptionEl || !editTaskStatusEl || !saveTaskChangesBtn || !updateDoc || !doc || !Timestamp || !arrayUnion) {
        console.error("Cannot update task: DB functions or required form elements missing.");
        alert("Error: Cannot save task changes.");
        return;
    }

    const taskId = editTaskIdEl.value;
    if (!taskId) { alert("Error: Task ID missing."); return; }

    const description = editTaskDescriptionEl.value.trim();
    if (!description) { alert("Please enter task description."); editTaskDescriptionEl.focus(); return; }

    // Prepare updated data object
    const updatedData = {
        customerName: editTaskCustomerNameEl.value.trim() || null,
        description: description,
        dueDate: editTaskDueDateEl.value ? Timestamp.fromDate(new Date(editTaskDueDateEl.value + 'T00:00:00Z')) : null,
        completed: editTaskStatusEl.value === 'completed',
        updatedAt: serverTimestamp() // Always update the timestamp
    };

    // Check for new comment
    const newCommentText = editTaskNewCommentEl?.value.trim();

    // Disable save button and show loading state
    saveTaskChangesBtn.disabled = true;
    saveTaskChangesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const taskRef = doc(db, "tasks", taskId);

        // If there's a new comment, add it using arrayUnion
        if (newCommentText) {
            const newCommentObject = { text: newCommentText, timestamp: serverTimestamp() };
            // Add the comments field with arrayUnion only if adding a comment
            updatedData.comments = arrayUnion(newCommentObject);
             console.log("Updating task with new comment using arrayUnion:", updatedData);
             await updateDoc(taskRef, updatedData);
        } else {
            // Otherwise, just update the other fields
             console.log("Updating task (no new comment):", updatedData);
             await updateDoc(taskRef, updatedData);
        }

        alert("Task updated successfully!");
        closeEditTaskModal(); // Close modal on success
    } catch (error) {
        console.error("Error updating task:", error);
        alert(`Failed to update task: ${error.message}`);
    } finally {
        // Re-enable save button and restore text
        saveTaskChangesBtn.disabled = false;
        saveTaskChangesBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }
}


// Display Upcoming Tasks Reminder
function displayUpcomingTasks(tasks) {
    if (!upcomingTaskListEl) return;
    upcomingTaskListEl.innerHTML = '<li class="loading-reminder">Loading upcoming tasks...</li>';
    if (!tasks) { console.warn("Upcoming tasks display called without tasks data."); upcomingTaskListEl.innerHTML = '<li>Could not load task data.</li>'; return; }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sevenDaysLater = new Date(today); sevenDaysLater.setDate(today.getDate() + 7);

    // Filter for tasks that are not completed and have a due date within the next 7 days
    const upcomingDueTasks = tasks.filter(task => {
        if (task.completed || !task.dueDate?.toDate) return false;
        const dueDate = task.dueDate.toDate(); dueDate.setHours(0, 0, 0, 0); // Normalize due date
        return dueDate >= today && dueDate <= sevenDaysLater;
    });

    // Sort upcoming tasks by due date ascending
    upcomingDueTasks.sort((a, b) => (a.dueDate?.toDate() || 0) - (b.dueDate?.toDate() || 0));

    upcomingTaskListEl.innerHTML = ''; // Clear loading message

    if (upcomingDueTasks.length === 0) {
        upcomingTaskListEl.innerHTML = '<li>No follow-ups due in the next 7 days.</li>';
        return;
    }

    upcomingDueTasks.forEach(task => {
        const li = document.createElement('li');
        // Make list item clickable to open edit modal
        li.innerHTML = `<a href="#">${task.customerName ? task.customerName + ': ' : ''}${task.description} - Due: <strong>${formatDate(task.dueDate.toDate())}</strong></a>`; // Requires formatDate
         li.style.cursor = 'pointer';
         li.onclick = (e) => {
             e.preventDefault(); // Prevent default link behavior
             openEditTaskModal(task.id, task); // Requires openEditTaskModal
         };
         li.title = 'Click to view/edit task';
        upcomingTaskListEl.appendChild(li);
    });
}


// --- Phase 2 Functions (Client Detail) ---

// Load Dashboard Data
function loadDashboardData() {
    // Ensure dashboard elements and policy cache are available
    if (!allPoliciesCache || !dbTotalPoliciesEl || !dbActivePoliciesEl || !dbLapsedPoliciesEl || !dbUpcomingPremiumEl || !dbUpcomingMaturityEl) {
        console.warn("Dashboard elements or policy cache not ready for data load.");
        return;
    }
    const totalPolicies = allPoliciesCache.length;
    const activePolicies = allPoliciesCache.filter(p => p.policyStatus === 'Active').length;
    const lapsedPolicies = allPoliciesCache.filter(p => p.policyStatus === 'Lapsed').length;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const thirtyDaysLater = new Date(today); thirtyDaysLater.setDate(today.getDate() + 30);
    let upcomingPremiumTotal = 0;

    // Calculate upcoming premiums based on *dynamic* due date
    allPoliciesCache.forEach(p => {
        // Only consider active/lapsed policies with a due date and mode
        if (p.nextInstallmentDate?.toDate && p.modeOfPayment && ['Active', 'Lapsed'].includes(p.policyStatus)) {
             let displayDate = new Date(p.nextInstallmentDate.toDate());
             displayDate.setHours(0,0,0,0);
             let safetyCounter = 0; const maxIterations = 120;
             // Calculate the *actual* next due date
             while (displayDate < today && safetyCounter < maxIterations) {
                 const calculated = calculateNextDueDate(displayDate, p.modeOfPayment); // Requires calculateNextDueDate
                 if (!calculated) { displayDate = null; break; }
                 displayDate = calculated;
                 displayDate.setHours(0,0,0,0);
                 safetyCounter++;
             }
             // Check if the calculated upcoming date falls within the next 30 days
             if (displayDate && displayDate >= today && displayDate <= thirtyDaysLater) {
                  upcomingPremiumTotal += Number(p.premiumAmount || 0);
             }
        }
    });

    // Calculate upcoming maturities (within 90 days)
    const ninetyDaysLater = new Date(today); ninetyDaysLater.setDate(today.getDate() + 90);
    const upcomingMaturitiesCount = allPoliciesCache.filter(p => {
         // Check if maturity date exists and is within the next 90 days
         if (p.maturityDate?.toDate) {
             const maturityDate = p.maturityDate.toDate(); maturityDate.setHours(0, 0, 0, 0); // Normalize
             return maturityDate >= today && maturityDate <= ninetyDaysLater;
         }
         return false;
    }).length;

    // Update dashboard DOM elements
    dbTotalPoliciesEl.textContent = totalPolicies;
    dbActivePoliciesEl.textContent = activePolicies;
    dbLapsedPoliciesEl.textContent = lapsedPolicies;
    dbUpcomingPremiumEl.textContent = `₹ ${upcomingPremiumTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    dbUpcomingMaturityEl.textContent = upcomingMaturitiesCount;
    console.log("Dashboard data loaded.");
}

// Show Client Detail Modal (Needs to be globally accessible if called from dashboard.js)
// Consider prefixing with `window.` if not using modules and calling from another file
window.showClientDetail = async function (policyId, customerName) { // Make globally accessible
    // Ensure modal elements and DB functions are available
    if (!clientDetailModal || !db || !policyId || !clientDetailNameEl || !clientDetailMobileEl || !clientDetailDobEl || !clientDetailFatherNameEl || !clientDetailAddressEl || !clientPoliciesListEl || !communicationLogListEl || !newLogNoteEl) {
        console.error("Cannot show client detail: Modal elements, DB, or Policy ID missing.");
        alert("Error: Could not open client details view.");
        return;
    }
    console.log(`Showing details for policy ID: ${policyId}, Customer: ${customerName || 'Loading...'}`);
    currentOpenClientId = policyId; // Store the ID of the client being viewed

    // Reset modal content to loading state
    clientDetailNameEl.textContent = `Details for ${customerName || 'Loading...'}`; // Show provided name or loading
    clientDetailMobileEl.textContent = 'Loading...';
    clientDetailDobEl.textContent = 'Loading...';
    clientDetailFatherNameEl.textContent = 'Loading...';
    clientDetailAddressEl.textContent = 'Loading...';
    clientPoliciesListEl.innerHTML = '<p>Loading policies...</p>';
    communicationLogListEl.innerHTML = '<p>Loading communication logs...</p>';
    newLogNoteEl.value = ''; // Clear note input

    // Activate the first tab (e.g., Policies)
    openDetailTab(null, 'clientPolicies', true); // Requires openDetailTab

    // Display the modal
    clientDetailModal.classList.add('active');

    // Fetch details from Firestore
    try {
        const policyRef = doc(db, "licCustomers", policyId);
        const policySnap = await getDoc(policyRef);

        if (policySnap.exists()) {
            const policyData = policySnap.data();
            // Update modal header and basic details
            clientDetailNameEl.textContent = `Details for ${policyData.customerName || 'Client'}`; // Update name once loaded
            clientDetailMobileEl.textContent = policyData.mobileNo || '-';
            clientDetailDobEl.textContent = policyData.dob?.toDate ? formatDate(policyData.dob.toDate()) : '-'; // Requires formatDate
            clientDetailFatherNameEl.textContent = policyData.fatherName || '-';
            clientDetailAddressEl.textContent = policyData.address || '-';

            // Use a reliable identifier (e.g., mobile number) to find related policies/logs
            const identifierField = 'mobileNo'; // Or another unique field if mobile is not reliable
            const identifierValue = policyData.mobileNo;

             if (identifierValue) {
                // Fetch all policies associated with this identifier
                const policiesQuery = query(collection(db, "licCustomers"), where(identifierField, "==", identifierValue));
                const customerPoliciesSnap = await getDocs(policiesQuery);
                const customerPolicies = customerPoliciesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                renderClientPolicies(customerPolicies); // Requires renderClientPolicies

                // Load communication logs associated with this identifier
                loadCommunicationLogs(identifierValue); // Requires loadCommunicationLogs
             } else {
                console.warn("Cannot fetch related policies/logs: Identifier field (e.g., mobileNo) is empty for this client.");
                clientPoliciesListEl.innerHTML = '<p>Could not load related policies (missing identifier).</p>';
                communicationLogListEl.innerHTML = '<p>Could not load logs (missing identifier).</p>';
             }
        } else {
            console.error(`Policy with ID ${policyId} not found.`);
            alert("Error: Could not find policy details.");
            closeClientDetail(); // Close modal if policy not found
        }
    } catch (error) {
        console.error("Error fetching client details:", error);
        alert(`Error loading client details: ${error.message}`);
        // Show error state in modal
        clientDetailNameEl.textContent = 'Error Loading Details';
        clientDetailMobileEl.textContent = 'Error';
        clientPoliciesListEl.innerHTML = '<p>Error loading policies.</p>';
        communicationLogListEl.innerHTML = '<p>Error loading logs.</p>';
    }
}

// Render Client Policies in Detail View
function renderClientPolicies(policies) {
    if (!clientPoliciesListEl) return;
    clientPoliciesListEl.innerHTML = ''; // Clear previous content

    if (!policies || policies.length === 0) {
        clientPoliciesListEl.innerHTML = '<p>No policies found for this client.</p>';
        return;
    }
    const ul = document.createElement('ul');
    ul.style.listStyle = 'none'; // Remove default list styling
    ul.style.padding = '0';
    // Sort policies (e.g., by policy number)
    policies.sort((a, b) => (a.policyNumber || '').localeCompare(b.policyNumber || ''));

    policies.forEach(policy => {
        const li = document.createElement('li');
        li.style.cssText = 'padding: 5px 0; border-bottom: 1px dotted #eee;';
        const statusText = policy.policyStatus || 'Unknown';

        // Use dynamic date display for consistency
         let displayDueDateStr = '-';
         const storedNextDueDate = policy.nextInstallmentDate?.toDate();
         if (storedNextDueDate && policy.modeOfPayment) {
             let displayDate = new Date(storedNextDueDate); displayDate.setHours(0,0,0,0);
             const today = new Date(); today.setHours(0,0,0,0);
             let safetyCounter = 0; const maxIterations = 120;
              while (displayDate < today && safetyCounter < maxIterations) {
                   const calculated = calculateNextDueDate(displayDate, policy.modeOfPayment); // Requires calculateNextDueDate
                   if (!calculated) { displayDate = null; break; }
                   displayDate = calculated; displayDate.setHours(0,0,0,0);
                   safetyCounter++;
              }
             if (displayDate) displayDueDateStr = formatDate(displayDate); else displayDueDateStr = 'Calc Error'; // Requires formatDate
         } else if (storedNextDueDate) { displayDueDateStr = formatDate(storedNextDueDate); }

        // Display key policy information
        li.innerHTML = `
            <strong>Policy No:</strong> ${policy.policyNumber || '-'} |
            <strong>Plan:</strong> ${policy.plan || '-'} |
            <strong>Premium:</strong> ₹ ${Number(policy.premiumAmount || 0).toLocaleString('en-IN')} (${policy.modeOfPayment || '-'}) |
            <strong>Next Due:</strong> ${displayDueDateStr} |
            <span class="status-badge status-${statusText.toLowerCase().replace(/\s+/g, '-')}">${statusText}</span>`;
        ul.appendChild(li);
    });
    if (ul.lastChild) ul.lastChild.style.borderBottom = 'none'; // Remove border from last item
    clientPoliciesListEl.appendChild(ul);
}

// Load Communication Logs
async function loadCommunicationLogs(identifier) {
    if (!communicationLogListEl || !db || !identifier) {
        if(communicationLogListEl) communicationLogListEl.innerHTML = '<p>Cannot load logs: Missing identifier.</p>';
        return;
    }
    communicationLogListEl.innerHTML = '<p>Loading logs...</p>';
    try {
        const logsRef = collection(db, "communicationLogs");
        // Query logs matching the identifier, order by timestamp descending
        const q = query(logsRef, where("clientIdentifier", "==", identifier), orderBy("timestamp", "desc"));
        const logSnapshot = await getDocs(q);
        const logs = logSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        communicationLogListEl.innerHTML = ''; // Clear loading message

        if (logs.length === 0) {
            communicationLogListEl.innerHTML = '<p>No communication logs found.</p>';
        } else {
            logs.forEach(log => {
                const p = document.createElement('p');
                p.style.cssText = 'margin: 2px 0; font-size: 0.95em; border-bottom: 1px dotted #f0f0f0; padding-bottom: 3px;';
                const logDate = log.timestamp?.toDate ? formatDateTime(log.timestamp.toDate()) : 'Earlier'; // Requires formatDateTime
                // Display timestamp and the note content
                p.innerHTML = `<span class="log-meta" style="color:#666; font-size: 0.9em;">(${logDate}):</span> ${log.note || ''}`;
                communicationLogListEl.appendChild(p);
            });
            if(communicationLogListEl.lastChild) communicationLogListEl.lastChild.style.borderBottom = 'none';
        }
         console.log(`Loaded ${logs.length} communication logs for identifier: ${identifier}`);
    } catch (error) {
        console.error(`Error loading communication logs for ${identifier}:`, error);
        communicationLogListEl.innerHTML = `<p>Error loading logs: ${error.message}</p>`;
    }
}


// Add Communication Note
async function addCommunicationNote() {
    // Ensure DB, input element, button, and current client context are available
    if (!db || !newLogNoteEl || !addLogBtn || !currentOpenClientId || !Timestamp || !addDoc || !collection) {
        alert("Cannot add note: Required functions or context missing.");
        return;
    }
    const noteText = newLogNoteEl.value.trim();
    if (!noteText) {
        alert("Please enter a note to add.");
        newLogNoteEl.focus();
        return;
    }

    // Find the policy data in cache to get the identifier (e.g., mobileNo)
    const policyData = allPoliciesCache.find(p => p.id === currentOpenClientId);
    const clientIdentifier = policyData?.mobileNo; // Use mobile number as the link

    if (!clientIdentifier) {
        alert("Could not determine the client identifier (e.g., mobile number) to save the log. Cannot add note.");
        return;
    }

    // Prepare log data
    const logData = {
        clientIdentifier: clientIdentifier, // Link log to client via mobile number
        note: noteText,
        timestamp: serverTimestamp(), // Use server time
        policyContextId: currentOpenClientId // Optionally store the specific policy ID that triggered this log
    };

    // Disable button and show loading state
    addLogBtn.disabled = true;
    addLogBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

    try {
        const logsRef = collection(db, "communicationLogs");
        await addDoc(logsRef, logData); // Add the log document
        console.log("Communication log added successfully.");
        newLogNoteEl.value = ''; // Clear the input field
        loadCommunicationLogs(clientIdentifier); // Reload logs to show the new one
    } catch (error) {
        console.error("Error adding communication log:", error);
        alert(`Failed to add communication log: ${error.message}`);
    } finally {
        // Re-enable button and restore text
        addLogBtn.disabled = false;
        addLogBtn.innerHTML = '<i class="fas fa-plus"></i> Add Note';
    }
}


// Close Client Detail Modal
function closeClientDetail() {
    if (clientDetailModal) {
        clientDetailModal.classList.remove('active');
        currentOpenClientId = null; // Reset the currently open client ID
        console.log("Client detail modal closed.");
    }
}

// Open Client Detail Tab (Make globally accessible if needed)
window.openDetailTab = function(evt, tabName, isInitialCall = false) {
    if (!clientDetailModal) return; // Ensure modal exists

    if (evt && !isInitialCall) {
        evt.preventDefault(); // Prevent default link behavior if called from event
    }

    // Get all tab content elements within the modal and hide them
    const tabcontent = clientDetailModal.querySelectorAll(".tab-content");
    tabcontent.forEach(tab => {
        tab.style.display = "none";
        tab.classList.remove("active");
    });

    // Get all tab buttons within the modal and remove the active class
    const tablinks = clientDetailModal.querySelectorAll(".tab-button");
    tablinks.forEach(link => {
        link.classList.remove("active");
    });

    // Show the selected tab content
    const currentTab = document.getElementById(tabName);
    if (currentTab) {
        currentTab.style.display = "block";
        currentTab.classList.add("active");
    }

    // Add the active class to the clicked button or the initial button
     if (evt && evt.currentTarget) {
         evt.currentTarget.classList.add("active");
     } else if (isInitialCall) {
         // Find the button that corresponds to the initial tabName
         const activeButton = Array.from(tablinks).find(btn => btn.getAttribute('onclick')?.includes(`'${tabName}'`));
         if (activeButton) activeButton.classList.add("active");
     }
}


// --- हेल्पर फंक्शन्स ---

// Format Date as DD-MM-YYYY
function formatDate(date) {
    if (!date || !(date instanceof Date) || isNaN(date)) return '-'; // Added NaN check
    try {
        // Use Intl formatter for better localization and robustness
        return new Intl.DateTimeFormat('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(date);
    } catch (e) {
        console.error("Error formatting date:", date, e);
        return 'Date Error';
    }
}

// Format Date and Time as DD-MM-YYYY HH:MM AM/PM
function formatDateTime(date) {
    if (!date || !(date instanceof Date) || isNaN(date)) return '-'; // Added NaN check
     try {
         // Use Intl formatter
         return new Intl.DateTimeFormat('en-IN', {
             day: '2-digit',
             month: '2-digit',
             year: 'numeric',
             hour: '2-digit',
             minute: '2-digit',
             hour12: true
         }).format(date).replace(',', ''); // Remove potential comma separator
     } catch (e) {
         console.error("Error formatting datetime:", date, e);
         return 'DateTime Error';
     }
}


// Calculate next due date based on start date and mode
function calculateNextDueDate(startDate, mode) {
     if (!startDate || !(startDate instanceof Date) || isNaN(startDate) || !mode) {
         console.warn("calculateNextDueDate: Invalid input provided.", { startDate, mode });
         return null;
     }
     try {
        // Important: Work with UTC components to avoid timezone shifts affecting calculations
        let year = startDate.getUTCFullYear();
        let month = startDate.getUTCMonth(); // 0-indexed
        let day = startDate.getUTCDate();

         switch (mode) {
             case 'Yearly':       month += 12; break;
             case 'Half-Yearly':  month += 6;  break;
             case 'Quarterly':    month += 3;  break;
             case 'Monthly':      month += 1;  break;
             default:
                 console.error(`calculateNextDueDate: Unknown mode "${mode}"`);
                 return null; // Unknown mode
         }

         // Create the new date object using UTC components
         // Note: The Date constructor handles month overflow correctly (e.g., month 12 becomes Jan of next year)
         let nextDate = new Date(Date.UTC(year, month, day));

         // Sanity check: Ensure the calculated date is valid
         if (isNaN(nextDate.getTime())) {
             console.error("Calculated next due date is invalid.", { year, month, day });
             return null;
         }

         return nextDate;
     } catch (e) {
         console.error("Error calculating next due date:", { startDate, mode, error: e });
         return null;
     }
}


// --- फिल्टर/सॉर्ट हैंडलर्स ---
function handleLicFilterChange() {
    clearTimeout(searchDebounceTimerLic); // Debounce input
    searchDebounceTimerLic = setTimeout(() => {
        applyLicFiltersAndRender(); // Requires applyLicFiltersAndRender
    }, 300);
}
function handleLicSortChange() {
    console.log("Sort changed:", sortLicSelect ? sortLicSelect.value : 'N/A');
    listenForPolicies(); // Re-fetch data with new sort order
}
function clearLicFilters() {
    // Reset all filter input fields
    if (licSearchInput) licSearchInput.value = '';
    if (licStatusFilter) licStatusFilter.value = '';
    if (licPlanFilter) licPlanFilter.value = '';
    if (licModeFilter) licModeFilter.value = '';
    if (licNachFilter) licNachFilter.value = '';
    // Re-apply filters (which will now be empty) and render
    applyLicFiltersAndRender(); // Requires applyLicFiltersAndRender
    console.log("Filters cleared.");
}

// --- एंड ऑफ़ फाइल ---
console.log("lic_management.js script loaded and potentially initialized.");