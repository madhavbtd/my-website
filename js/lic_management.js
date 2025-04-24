// js/lic_management.js
// Updated with implementations, Next Due Date logic, and dynamic display

// --- सुनिश्चित करें कि ग्लोबल Firebase फंक्शन्स उपलब्ध हैं ---
const {
    db, collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp,
    query, where, orderBy, limit, Timestamp, runTransaction, onSnapshot,
    arrayUnion
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
    editTaskNewCommentEl,
    editTaskCommentsHistoryEl,
    closeEditTaskModalBtn, cancelEditTaskBtn, saveTaskChangesBtn,
    // Upcoming Tasks Reminder Element
    upcomingTaskListEl;


// --- ग्लोबल स्टेट ---
let currentLicSortField = 'createdAt';
let currentLicSortDirection = 'desc';
let unsubscribePolicies = null; // Firestore policy listener
let unsubscribeTasks = null; // Firestore task listener
let allPoliciesCache = []; // सभी पॉलिसियों का कैश
let searchDebounceTimerLic;
let currentOpenClientId = null;


// --- पेज इनिशियलाइज़ेशन ---
window.initializeLicPage = function() {
    console.log("Initializing LIC Management Page...");

    // --- DOM एलिमेंट्स प्राप्त करें ---
    licPolicyTableBody = document.getElementById('licPolicyTableBody');
    reminderList = document.getElementById('reminderList');
    policyModal = document.getElementById('policyModal');
    policyForm = document.getElementById('policyForm');
    policyModalTitle = document.getElementById('policyModalTitleText');
    editPolicyId = document.getElementById('editPolicyId');
    addNewPolicyBtn = document.getElementById('addNewPolicyBtn');
    closePolicyModalBtn = document.getElementById('closePolicyModal');
    cancelPolicyBtn = document.getElementById('cancelPolicyBtn');
    savePolicyBtn = document.getElementById('savePolicyBtn'); // Button exists but action is via form submit
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
    clientDetailContentEl = document.getElementById('clientDetailContent');
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
    upcomingTaskListEl = document.getElementById('upcomingTaskList');

    // --- डीबगिंग लॉग्स ---
    console.log('Debugging - Add New Policy Button Element:', addNewPolicyBtn);
    console.log('Debugging - Add Task Button Element:', addTaskBtn);

    // --- इवेंट लिस्टनर्स ---
    if (addNewPolicyBtn) {
         console.log('Debugging - Attaching listener to Add New Policy button');
         addNewPolicyBtn.addEventListener('click', () => openPolicyModal());
    } else { console.error('ERROR: Add New Policy button not found!'); }

    if (policyForm) {
        policyForm.addEventListener('submit', handleSavePolicy);
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
         addTaskBtn.addEventListener('click', handleAddTask);
    } else { console.error('ERROR: Add Task button not found!'); }

    if (taskList) {
        taskList.addEventListener('change', handleTaskCheckboxChange);
        taskList.addEventListener('click', handleTaskActions);
    }

    if (editTaskForm) {
        editTaskForm.addEventListener('submit', handleUpdateTask);
        console.log('Debugging - Attaching listener to Edit Task Form submit');
    } else { console.error('ERROR: Edit Task Form not found!'); }

    if (closeEditTaskModalBtn) closeEditTaskModalBtn.addEventListener('click', closeEditTaskModal);
    if (cancelEditTaskBtn) cancelEditTaskBtn.addEventListener('click', closeEditTaskModal);
    if (editTaskModal) editTaskModal.addEventListener('click', (e) => { if (e.target === editTaskModal) closeEditTaskModal(); });

    if (closeClientDetailBtn) closeClientDetailBtn.addEventListener('click', closeClientDetail);
    if (closeClientDetailBtnBottom) closeClientDetailBtnBottom.addEventListener('click', closeClientDetail);
    if (clientDetailModal) clientDetailModal.addEventListener('click', (e) => { if (e.target === clientDetailModal) closeClientDetail(); });
    if (addLogBtn) addLogBtn.addEventListener('click', addCommunicationNote);

    // --- Firestore Listeners ---
    listenForPolicies();
    listenForTasks();

    console.log("Initialization complete.");
}

// --- Firestore Listener (Policies) ---
function listenForPolicies() {
    if (!db) { console.error("DB not initialized"); return; }
    if (unsubscribePolicies) unsubscribePolicies();
    const policiesRef = collection(db, "licCustomers");

    const sortValue = sortLicSelect ? sortLicSelect.value : 'createdAt_desc';
    const [field, direction] = sortValue.split('_');
    currentLicSortField = field || 'createdAt';
    currentLicSortDirection = direction || 'desc';

    const q = query(policiesRef, orderBy(currentLicSortField, currentLicSortDirection));
    console.log(`Starting policy listener with sort: ${currentLicSortField} ${currentLicSortDirection}`);

    unsubscribePolicies = onSnapshot(q, (snapshot) => {
        console.log(`Received ${snapshot.docs.length} policies.`);
        allPoliciesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        applyLicFiltersAndRender();
        displayReminders();
        loadDashboardData();
    }, (error) => {
        console.error("Error listening to policies:", error);
        if(licPolicyTableBody) licPolicyTableBody.innerHTML = `<tr><td colspan="9">Error loading policy data: ${error.message}. Check console and Firestore rules.</td></tr>`;
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
    if (unsubscribeTasks) unsubscribeTasks();
    const tasksRef = collection(db, "tasks");
    const q = query(tasksRef, orderBy("createdAt", "desc"));

    console.log("Starting task listener...");
    unsubscribeTasks = onSnapshot(q, (snapshot) => {
        const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`Received ${tasks.length} tasks.`);
        renderTaskList(tasks);
        displayUpcomingTasks(tasks);
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
     renderPolicyTable(filteredPolicies); // Render with client-side filtering
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
        nameLink.href = "#";
        nameLink.textContent = policy.customerName || 'N/A';
        nameLink.title = `View details for ${policy.customerName || 'this client'}`;
        nameLink.style.cursor = 'pointer';
        nameLink.onclick = (e) => {
            e.preventDefault();
            showClientDetail(policy.id, policy.customerName);
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

             // If the stored date is in the past, calculate future dates
             // Add a safety limit to prevent infinite loops in case of bad data/logic
             let safetyCounter = 0;
             const maxIterations = 120; // Max 10 years of monthly payments, adjust if needed
             while (displayDate < today && safetyCounter < maxIterations) {
                 const calculated = calculateNextDueDate(displayDate, policy.modeOfPayment);
                 if (!calculated) { // Break if calculation fails (e.g., unknown mode)
                      displayDate = null;
                      console.warn(`Could not calculate next due date for policy ${policy.policyNumber} from ${formatDate(displayDate)} with mode ${policy.modeOfPayment}`);
                      break;
                  }
                  displayDate = calculated;
                  displayDate.setHours(0,0,0,0); // Normalize calculated date
                  safetyCounter++;
             }

              if (safetyCounter >= maxIterations) {
                  console.error(`Exceeded max iterations calculating next due date for policy ${policy.policyNumber}. Check data or calculation logic.`);
                  displayDueDateStr = 'Calc Limit';
              } else if (displayDate) {
                  displayDueDateStr = formatDate(displayDate);
              } else {
                  displayDueDateStr = 'Calc Error'; // Indicate calculation problem
              }
        } else if (storedNextDueDate) {
            // If date exists but mode is missing, just show stored date
            displayDueDateStr = formatDate(storedNextDueDate);
        }
        row.insertCell().textContent = displayDueDateStr;
        // ----------------------------------------------------

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
        editBtn.onclick = (e) => { e.stopPropagation(); openPolicyModal(policy.id, policy); };
        actionCell.appendChild(editBtn);

        // Pay Button (Mark Paid)
        const payBtn = document.createElement('button');
        payBtn.innerHTML = '<i class="fas fa-check-circle"></i>';
        payBtn.title = "Mark Premium Paid & Update Due Date";
        payBtn.classList.add('button', 'pay-button');
         // Disable if status is not Active/Lapsed, or if the calculated display date indicates an error or is missing
         const isPayable = ['Active', 'Lapsed'].includes(policy.policyStatus) && displayDueDateStr !== '-' && !displayDueDateStr.startsWith('Calc');
         payBtn.disabled = !isPayable;
        payBtn.onclick = (e) => { e.stopPropagation(); handleMarkPaid(policy.id, policy); };
        actionCell.appendChild(payBtn);

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.title = "Delete Policy";
        deleteBtn.classList.add('button', 'delete-button');
        deleteBtn.onclick = (e) => { e.stopPropagation(); handleDeletePolicy(policy.id, policy.policyNumber); };
        actionCell.appendChild(deleteBtn);
    });
}


// --- Modal खोलना/बंद करना (Policy Add/Edit) ---
function openPolicyModal(policyId = null, data = {}) {
    if (!policyModal || !policyForm || !policyModalTitle || !editPolicyId) {
        console.error("Cannot open policy modal: Required elements not found.");
        return;
    }
    policyForm.reset();
    editPolicyId.value = policyId || '';

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
        // Populate the hidden nextInstallmentDate field for reference, though it's not directly edited
        document.getElementById('nextInstallmentDate').value = data.nextInstallmentDate?.toDate ? data.nextInstallmentDate.toDate().toISOString().split('T')[0] : '';
        document.getElementById('maturityDate').value = data.maturityDate?.toDate ? data.maturityDate.toDate().toISOString().split('T')[0] : '';
        if(policyStatusModal) policyStatusModal.value = data.policyStatus || 'Active';
        if(nachStatusModal) nachStatusModal.value = data.nachStatus || '';
    } else {
        // --- ADD MODE ---
        policyModalTitle.textContent = "Add New Policy";
        if(policyStatusModal) policyStatusModal.value = 'Active';
        if(nachStatusModal) nachStatusModal.value = 'No';
        document.getElementById('dob').value = '';
        document.getElementById('issuanceDate').value = '';
        document.getElementById('nextInstallmentDate').value = ''; // Keep hidden field blank in add mode
        document.getElementById('maturityDate').value = '';
    }
    policyModal.classList.add('active');
}

function closePolicyModal() {
    if (policyModal) policyModal.classList.remove('active');
}

// --- पॉलिसी सेव/अपडेट करना - Updated for Auto Calculation on Add ---
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
    // NEXT INSTALLMENT DATE IS NO LONGER READ FROM FORM FOR 'ADD'

    // --- Basic Validation ---
    if (!customerName || !policyNumber || !mobileNo || !issuanceDateStr || !modeOfPayment || !premiumAmountStr) {
        alert("Please fill in all required fields (*).");
        return;
    }
    // Basic mobile number format check (10 digits)
    if (!/^\d{10}$/.test(mobileNo)) {
        alert("Please enter a valid 10-digit mobile number.");
        return;
    }

    const premiumAmount = parseFloat(premiumAmountStr);
    if (isNaN(premiumAmount) || premiumAmount <= 0) {
        alert("Please enter a valid positive premium amount.");
        return;
    }

    const issuanceDate = Timestamp.fromDate(new Date(issuanceDateStr + 'T00:00:00Z')); // Store as Timestamp

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
        // nextInstallmentDate will be set below
        maturityDate: document.getElementById('maturityDate').value ? Timestamp.fromDate(new Date(document.getElementById('maturityDate').value + 'T00:00:00Z')) : null,
        policyStatus: policyStatusModal.value || 'Active',
        nachStatus: nachStatusModal.value || 'No',
        updatedAt: serverTimestamp() // Always set updatedAt
    };

    // --- Calculate Next Installment Date ONLY for NEW policies ---
    if (!isEditing) {
        policyData.createdAt = serverTimestamp();
        try {
            const firstDueDate = calculateNextDueDate(issuanceDate.toDate(), modeOfPayment);
            if (firstDueDate) {
                policyData.nextInstallmentDate = Timestamp.fromDate(firstDueDate);
                console.log(`Calculated first due date: ${formatDate(firstDueDate)}`);
            } else {
                policyData.nextInstallmentDate = null; // Set to null if calculation fails
                console.warn("Could not calculate the first due date.");
                // Decide if you want to prevent saving or allow saving without a date
                // Option 1: Prevent saving
                // alert("Error: Could not automatically calculate the first due date based on Issuance Date and Mode. Cannot save policy.");
                // return; // Stop execution
                // Option 2: Allow saving with null date (as implemented now)
                 alert("Warning: Could not automatically calculate the first due date based on Issuance Date and Mode. Saving with no due date.");
            }
        } catch (e) {
            console.error("Error calculating first due date:", e);
            policyData.nextInstallmentDate = null;
            alert("Error calculating the first due date. Please check Mode of Payment.");
        }
    } else {
         // For editing, preserve the existing nextInstallmentDate from cache/data
         const existingPolicyData = allPoliciesCache.find(p => p.id === policyId);
         // Only update if it exists in existing data, otherwise keep it potentially null/undefined in update object
         if (existingPolicyData && existingPolicyData.nextInstallmentDate) {
             policyData.nextInstallmentDate = existingPolicyData.nextInstallmentDate;
         }
         // NOTE: If modeOfPayment or issuanceDate is changed during EDIT,
         // you might want to add logic here to ask the user if they want to recalculate
         // the nextInstallmentDate based on the *new* issuance/mode.
         // For now, it only preserves the date that was loaded into the form.
    }


    console.log("Saving policy data:", policyData);

    // --- Disable save button ---
    const saveButton = document.getElementById('savePolicyBtn');
    if(saveButton) { saveButton.disabled = true; saveButton.textContent = 'Saving...'; }

    // --- Save to Firestore ---
    try {
        if (isEditing) {
            const policyRef = doc(db, "licCustomers", policyId);
            await updateDoc(policyRef, policyData);
            console.log("Policy updated successfully:", policyId);
            alert("Policy details updated successfully!");
        } else {
            // Add new document
             if (!policyData.nextInstallmentDate && modeOfPayment) { // Added check for mode as well
                 // Optional: Confirm before saving without a date if calculation failed but mode exists
                 // if (!confirm("Warning: Could not calculate next due date. Save anyway?")) {
                 //     throw new Error("Save cancelled by user.");
                 // }
                 console.warn("Saving policy without a calculated next installment date.");
             }
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
            // Listener updates the table
        } catch (error) {
            console.error("Error deleting policy:", error);
            alert(`Failed to delete policy: ${error.message}`);
        }
    }
}

// --- प्रीमियम भुगतान मार्क करना ---
async function handleMarkPaid(policyId, policyData) {
    // Use the originally stored nextInstallmentDate from policyData for calculation
    if (!db || !policyId || !policyData.nextInstallmentDate || !policyData.modeOfPayment) {
        alert("Cannot mark as paid: Missing required policy data (ID, Stored Next Due Date, Mode).");
        return;
    }

    const currentStoredDueDate = policyData.nextInstallmentDate.toDate();
    const mode = policyData.modeOfPayment;

    try {
        // Calculate the next due date based on the *stored* due date
        const nextCalculatedDueDate = calculateNextDueDate(currentStoredDueDate, mode);
        if (!nextCalculatedDueDate) {
            alert("Could not calculate the next due date based on the mode.");
            return;
        }

        const nextDueDateStr = formatDate(nextCalculatedDueDate);
        if (!confirm(`Mark premium paid for policy ${policyData.policyNumber}?\n\nCurrent Stored Due: ${formatDate(currentStoredDueDate)}\nNext Due Date will be updated in database to: ${nextDueDateStr}`)) {
            return;
        }

        const policyRef = doc(db, "licCustomers", policyId);
        await updateDoc(policyRef, {
            nextInstallmentDate: Timestamp.fromDate(nextCalculatedDueDate), // Update stored date
            policyStatus: 'Active', // Ensure status is Active after payment
            updatedAt: serverTimestamp()
        });

        console.log(`Policy ${policyId} marked paid. Stored next due date updated to ${nextDueDateStr}.`);
        alert(`Policy ${policyData.policyNumber} marked as paid.\nNext due date in database updated to ${nextDueDateStr}.`);
        // Listener will update the table, which will then display the new date dynamically

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
         if (storedNextDueDate && policy.modeOfPayment && ['Active', 'Lapsed'].includes(policy.policyStatus)) {
              let displayDate = new Date(storedNextDueDate);
              displayDate.setHours(0,0,0,0);
              let safetyCounter = 0;
              const maxIterations = 120;
              while (displayDate < today && safetyCounter < maxIterations) {
                  const calculated = calculateNextDueDate(displayDate, policy.modeOfPayment);
                   if (!calculated) { displayDate = null; break; }
                   displayDate = calculated;
                   displayDate.setHours(0,0,0,0);
                   safetyCounter++;
              }

               // If a valid future date was found/calculated and it's within 15 days
               if (displayDate && displayDate >= today && displayDate <= fifteenDaysLater) {
                    // Add the policy and its calculated display date to the list
                    upcomingPolicies.push({ ...policy, displayDueDate: displayDate });
               }
         }
    });

    // Sort by the calculated display due date
    upcomingPolicies.sort((a, b) => a.displayDueDate - b.displayDueDate);

    reminderList.innerHTML = '';

    if (upcomingPolicies.length === 0) {
        reminderList.innerHTML = '<li>No upcoming installments in the next 15 days.</li>';
        return;
    }

    upcomingPolicies.forEach(policy => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${policy.customerName || 'N/A'} (${policy.policyNumber || 'N/A'}) - Due: <strong>${formatDate(policy.displayDueDate)}</strong> (₹ ${Number(policy.premiumAmount || 0).toLocaleString('en-IN')})</span>
        `;
        li.title = `Plan: ${policy.plan || '-'}, Mode: ${policy.modeOfPayment || '-'}`;
        reminderList.appendChild(li);
    });
}


// --- Task Management Functions ---
// (These functions remain the same as the previous correct version)

// Render Task List
function renderTaskList(tasks) {
     if (!taskList) return;
     taskList.innerHTML = '';
     if (!tasks || tasks.length === 0) {
         taskList.innerHTML = '<li>No follow-up tasks found.</li>';
         return;
     }
     tasks.forEach(task => {
         const li = document.createElement('li');
         li.setAttribute('data-task-id', task.id);
         li.classList.toggle('completed-task', task.completed);
         const contentDiv = document.createElement('div');
         contentDiv.style.flexGrow = '1';
         const customerSpan = document.createElement('span');
         customerSpan.style.fontWeight = 'bold';
         customerSpan.textContent = task.customerName ? `${task.customerName}: ` : '';
         const descSpan = document.createElement('span');
         descSpan.textContent = task.description || 'No description';
         const dateSpan = document.createElement('span');
         dateSpan.style.fontSize = '0.85em'; dateSpan.style.color = '#555'; dateSpan.style.marginLeft = '10px';
         dateSpan.textContent = task.dueDate?.toDate ? ` (Due: ${formatDate(task.dueDate.toDate())})` : '';
         contentDiv.appendChild(customerSpan); contentDiv.appendChild(descSpan); contentDiv.appendChild(dateSpan);
         const commentSpan = document.createElement('p');
         commentSpan.style.fontSize = '0.85em'; commentSpan.style.color = '#666'; commentSpan.style.marginTop = '4px'; commentSpan.style.whiteSpace = 'pre-wrap';
         if (task.comments && Array.isArray(task.comments) && task.comments.length > 0) {
             task.comments.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
             const latestComment = task.comments[0];
             const commentDate = latestComment.timestamp?.toDate ? formatDateTime(latestComment.timestamp.toDate()) : '';
             commentSpan.textContent = `Latest Comment ${commentDate ? `(${commentDate})` : ''}: ${latestComment.text || ''}`;
         } else { commentSpan.style.display = 'none'; }
         contentDiv.appendChild(commentSpan);
         const actionsDiv = document.createElement('div');
         actionsDiv.classList.add('task-actions-container'); actionsDiv.style.marginLeft = 'auto'; actionsDiv.style.display = 'flex'; actionsDiv.style.gap = '8px'; actionsDiv.style.flexShrink = '0'; actionsDiv.style.alignItems = 'center';
         const checkbox = document.createElement('input');
         checkbox.type = 'checkbox'; checkbox.className = 'task-checkbox'; checkbox.checked = task.completed; checkbox.title = task.completed ? 'Mark as Pending' : 'Mark as Completed'; checkbox.setAttribute('data-task-id', task.id);
         const editBtn = document.createElement('button');
         editBtn.innerHTML = '<i class="fas fa-edit"></i>'; editBtn.className = 'button edit-button edit-task-btn'; editBtn.title = 'Edit Task';
         editBtn.onclick = (e) => { e.stopPropagation(); openEditTaskModal(task.id, task); };
         const deleteBtn = document.createElement('button');
         deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>'; deleteBtn.className = 'button delete-task-btn'; deleteBtn.title = 'Delete Task'; deleteBtn.setAttribute('data-task-id', task.id);
         actionsDiv.appendChild(checkbox); actionsDiv.appendChild(editBtn); actionsDiv.appendChild(deleteBtn);
         li.appendChild(contentDiv); li.appendChild(actionsDiv); taskList.appendChild(li);
     });
 }

// Add New Follow-up Task
async function handleAddTask() {
    if (!db || !newTaskInput) return;
    const description = newTaskInput.value.trim();
    const customerName = newTaskCustomerNameEl.value.trim();
    const dueDateStr = newTaskDueDate.value;
    const initialComment = newTaskCommentsEl.value.trim();
    if (!description) { alert("Please enter the task description."); newTaskInput.focus(); return; }
    const taskData = {
        customerName: customerName || null, description: description,
        dueDate: dueDateStr ? Timestamp.fromDate(new Date(dueDateStr + 'T00:00:00Z')) : null,
        completed: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), comments: []
    };
    if (initialComment) { taskData.comments.push({ text: initialComment, timestamp: serverTimestamp() }); }
    console.log("Adding task:", taskData);
    addTaskBtn.disabled = true; addTaskBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    try {
        const tasksRef = collection(db, "tasks");
        await addDoc(tasksRef, taskData);
        alert("Follow-up task added successfully!");
        newTaskInput.value = ''; newTaskCustomerNameEl.value = ''; newTaskDueDate.value = ''; newTaskCommentsEl.value = '';
    } catch (error) { console.error("Error adding task:", error); alert(`Failed to add task: ${error.message}`);
    } finally { addTaskBtn.disabled = false; addTaskBtn.innerHTML = '<i class="fas fa-plus"></i> Add Follow-up'; }
}

// Handle Task Checkbox Change
async function handleTaskCheckboxChange(event) {
    if (event.target.classList.contains('task-checkbox')) {
        const checkbox = event.target; const taskId = checkbox.getAttribute('data-task-id'); const isCompleted = checkbox.checked;
        if (!db || !taskId) return; console.log(`Task ${taskId} completion changed to: ${isCompleted}`);
        const taskRef = doc(db, "tasks", taskId); checkbox.disabled = true;
        try { await updateDoc(taskRef, { completed: isCompleted, updatedAt: serverTimestamp() }); console.log(`Task ${taskId} status updated.`); checkbox.closest('li').classList.toggle('completed-task', isCompleted);
        } catch (error) { console.error("Error updating task status:", error); alert(`Failed to update task status: ${error.message}`); checkbox.checked = !isCompleted;
        } finally { checkbox.disabled = false; }
    }
}

// Handle Task Actions (Delete Only)
async function handleTaskActions(event) {
    if (event.target.closest('.delete-task-btn')) {
        const deleteButton = event.target.closest('.delete-task-btn'); const taskId = deleteButton.getAttribute('data-task-id');
        if (!db || !taskId) return;
        if (confirm("Are you sure you want to delete this task?")) {
             deleteButton.disabled = true; deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            try { const taskRef = doc(db, "tasks", taskId); await deleteDoc(taskRef); console.log(`Task ${taskId} deleted successfully.`); alert("Task deleted.");
            } catch (error) { console.error("Error deleting task:", error); alert(`Failed to delete task: ${error.message}`); deleteButton.disabled = false; deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>'; }
        }
    }
}

// Open Edit Task Modal
function openEditTaskModal(taskId, taskData) {
    if (!editTaskModal || !editTaskForm || !editTaskIdEl || !editTaskCustomerNameEl || !editTaskDescriptionEl || !editTaskDueDateEl || !editTaskStatusEl || !editTaskCommentsHistoryEl || !editTaskNewCommentEl) { console.error("Cannot open edit task modal: Required elements not found."); return; }
    console.log("Opening edit modal for task:", taskId, taskData);
    editTaskIdEl.value = taskId; editTaskCustomerNameEl.value = taskData.customerName || ''; editTaskDescriptionEl.value = taskData.description || '';
    editTaskDueDateEl.value = taskData.dueDate?.toDate ? taskData.dueDate.toDate().toISOString().split('T')[0] : '';
    editTaskStatusEl.value = taskData.completed ? 'completed' : 'pending'; editTaskNewCommentEl.value = '';
    editTaskCommentsHistoryEl.innerHTML = '';
    if (taskData.comments && Array.isArray(taskData.comments) && taskData.comments.length > 0) {
         editTaskCommentsHistoryEl.innerHTML = '<h4>Comment History:</h4>';
         const sortedComments = [...taskData.comments].sort((a, b) => (a.timestamp?.toDate() || 0) - (b.timestamp?.toDate() || 0));
         sortedComments.forEach(comment => {
            const p = document.createElement('p'); const commentDate = comment.timestamp?.toDate ? formatDateTime(comment.timestamp.toDate()) : 'Earlier';
            p.innerHTML = `<span class="log-meta">(${commentDate}):</span> ${comment.text || ''}`; editTaskCommentsHistoryEl.appendChild(p); });
    } else { editTaskCommentsHistoryEl.innerHTML = '<p><i>No comment history available.</i></p>'; }
    editTaskModal.classList.add('active');
}

// Close Edit Task Modal
function closeEditTaskModal() { if (editTaskModal) { editTaskModal.classList.remove('active'); } }

// Handle Update Task Form Submission
async function handleUpdateTask(event) {
    event.preventDefault();
    if (!db || !editTaskIdEl || !editTaskDescriptionEl || !editTaskStatusEl) { console.error("Cannot update task: DB or required form elements missing."); return; }
    const taskId = editTaskIdEl.value; if (!taskId) { alert("Error: Task ID missing."); return; }
    const description = editTaskDescriptionEl.value.trim(); if (!description) { alert("Please enter task description."); editTaskDescriptionEl.focus(); return; }
    const updatedData = {
        customerName: editTaskCustomerNameEl.value.trim() || null, description: description,
        dueDate: editTaskDueDateEl.value ? Timestamp.fromDate(new Date(editTaskDueDateEl.value + 'T00:00:00Z')) : null,
        completed: editTaskStatusEl.value === 'completed', updatedAt: serverTimestamp()
    };
    const newCommentText = editTaskNewCommentEl?.value.trim();
    const saveButton = document.getElementById('saveTaskChangesBtn'); if(saveButton) { saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }
    try {
        const taskRef = doc(db, "tasks", taskId);
        if (newCommentText && typeof window.arrayUnion === 'function') {
            const newCommentObject = { text: newCommentText, timestamp: serverTimestamp() };
             updatedData.comments = window.arrayUnion(newCommentObject);
             await updateDoc(taskRef, updatedData); console.log("Task updated with new comment using arrayUnion.");
        } else { await updateDoc(taskRef, updatedData); console.log("Task updated (no new comment or arrayUnion unavailable)."); }
        alert("Task updated successfully!"); closeEditTaskModal();
    } catch (error) { console.error("Error updating task:", error); alert(`Failed to update task: ${error.message}`);
    } finally { if(saveButton) { saveButton.disabled = false; saveButton.innerHTML = '<i class="fas fa-save"></i> Save Changes'; } }
}

// Display Upcoming Tasks Reminder
function displayUpcomingTasks(tasks) {
    if (!upcomingTaskListEl) return;
    upcomingTaskListEl.innerHTML = '<li class="loading-reminder">Loading upcoming tasks...</li>';
    if (!tasks) { console.warn("Upcoming tasks display called without tasks data."); upcomingTaskListEl.innerHTML = '<li>Could not load task data.</li>'; return; }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sevenDaysLater = new Date(today); sevenDaysLater.setDate(today.getDate() + 7);
    const upcomingDueTasks = tasks.filter(task => {
        if (task.completed || !task.dueDate?.toDate) return false;
        const dueDate = task.dueDate.toDate(); dueDate.setHours(0, 0, 0, 0);
        return dueDate >= today && dueDate <= sevenDaysLater;
    });
    upcomingDueTasks.sort((a, b) => (a.dueDate?.toDate() || 0) - (b.dueDate?.toDate() || 0));
    upcomingTaskListEl.innerHTML = '';
    if (upcomingDueTasks.length === 0) { upcomingTaskListEl.innerHTML = '<li>No follow-ups due in the next 7 days.</li>'; return; }
    upcomingDueTasks.forEach(task => {
        const li = document.createElement('li');
        li.innerHTML = `<a>${task.customerName ? task.customerName + ': ' : ''}${task.description} - Due: <strong>${formatDate(task.dueDate.toDate())}</strong></a>`;
         li.style.cursor = 'pointer'; li.onclick = () => openEditTaskModal(task.id, task); li.title = 'Click to view/edit task';
        upcomingTaskListEl.appendChild(li);
    });
}


// --- Phase 2 Functions (Client Detail) ---

// Load Dashboard Data
function loadDashboardData() {
    if (!allPoliciesCache || !dbTotalPoliciesEl || !dbActivePoliciesEl || !dbLapsedPoliciesEl || !dbUpcomingPremiumEl || !dbUpcomingMaturityEl) { console.warn("Dashboard elements or policy cache not ready."); return; }
    const totalPolicies = allPoliciesCache.length;
    const activePolicies = allPoliciesCache.filter(p => p.policyStatus === 'Active').length;
    const lapsedPolicies = allPoliciesCache.filter(p => p.policyStatus === 'Lapsed').length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const thirtyDaysLater = new Date(today); thirtyDaysLater.setDate(today.getDate() + 30);
    let upcomingPremiumTotal = 0;
    allPoliciesCache.forEach(p => {
        if (p.nextInstallmentDate?.toDate && ['Active', 'Lapsed'].includes(p.policyStatus)) {
             // Use the same dynamic date calculation as the table for upcoming premium check
              let displayDate = new Date(p.nextInstallmentDate.toDate());
              displayDate.setHours(0,0,0,0);
              let safetyCounter = 0;
              const maxIterations = 120;
              while (displayDate < today && safetyCounter < maxIterations) {
                  const calculated = calculateNextDueDate(displayDate, p.modeOfPayment);
                   if (!calculated || !p.modeOfPayment) { displayDate = null; break; }
                   displayDate = calculated;
                   displayDate.setHours(0,0,0,0);
                   safetyCounter++;
              }
              // Check if the *calculated* upcoming date falls within the next 30 days
              if (displayDate && displayDate >= today && displayDate <= thirtyDaysLater) {
                   upcomingPremiumTotal += Number(p.premiumAmount || 0);
              }
        }
    });
    const ninetyDaysLater = new Date(today); ninetyDaysLater.setDate(today.getDate() + 90);
    const upcomingMaturitiesCount = allPoliciesCache.filter(p => {
         if (p.maturityDate?.toDate) { // Check all policies for maturity, regardless of status? Or filter?
             const maturityDate = p.maturityDate.toDate(); maturityDate.setHours(0, 0, 0, 0);
             return maturityDate >= today && maturityDate <= ninetyDaysLater;
         } return false; }).length;
    dbTotalPoliciesEl.textContent = totalPolicies;
    dbActivePoliciesEl.textContent = activePolicies;
    dbLapsedPoliciesEl.textContent = lapsedPolicies;
    dbUpcomingPremiumEl.textContent = `₹ ${upcomingPremiumTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    dbUpcomingMaturityEl.textContent = upcomingMaturitiesCount;
    console.log("Dashboard data loaded.");
}

// Show Client Detail Modal
async function showClientDetail(policyId, customerName) {
    if (!clientDetailModal || !db || !policyId) { console.error("Cannot show client detail: Modal or DB or Policy ID missing."); return; }
    console.log(`Showing details for policy ID: ${policyId}, Customer: ${customerName}`);
    currentOpenClientId = policyId;
    clientDetailNameEl.textContent = `Details for ${customerName || 'Client'}`;
    clientDetailMobileEl.textContent = 'Loading...'; clientDetailDobEl.textContent = 'Loading...'; clientDetailFatherNameEl.textContent = 'Loading...'; clientDetailAddressEl.textContent = 'Loading...';
    clientPoliciesListEl.innerHTML = '<p>Loading policies...</p>'; communicationLogListEl.innerHTML = '<p>Loading communication logs...</p>'; newLogNoteEl.value = '';
    openDetailTab(null, 'clientPolicies', true);
    clientDetailModal.classList.add('active');
    try {
        const policyRef = doc(db, "licCustomers", policyId); const policySnap = await getDoc(policyRef);
        if (policySnap.exists()) {
            const policyData = policySnap.data();
            clientDetailNameEl.textContent = `Details for ${policyData.customerName || 'Client'}`; clientDetailMobileEl.textContent = policyData.mobileNo || '-'; clientDetailDobEl.textContent = policyData.dob?.toDate ? formatDate(policyData.dob.toDate()) : '-'; clientDetailFatherNameEl.textContent = policyData.fatherName || '-'; clientDetailAddressEl.textContent = policyData.address || '-';
            const identifierField = 'mobileNo'; // Use mobile number to find related policies/logs
            const identifierValue = policyData.mobileNo;
             if (identifierValue) {
                const policiesQuery = query(collection(db, "licCustomers"), where(identifierField, "==", identifierValue));
                const customerPoliciesSnap = await getDocs(policiesQuery); const customerPolicies = customerPoliciesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                renderClientPolicies(customerPolicies); loadCommunicationLogs(identifierValue);
             } else { console.warn("Cannot fetch related policies/logs: Identifier field (mobileNo) is empty."); clientPoliciesListEl.innerHTML = '<p>Could not load related policies (missing identifier).</p>'; communicationLogListEl.innerHTML = '<p>Could not load logs (missing identifier).</p>'; }
        } else { console.error(`Policy with ID ${policyId} not found.`); alert("Error: Could not find policy details."); closeClientDetail(); }
    } catch (error) { console.error("Error fetching client details:", error); alert(`Error loading client details: ${error.message}`); clientDetailMobileEl.textContent = 'Error'; clientPoliciesListEl.innerHTML = '<p>Error loading policies.</p>'; communicationLogListEl.innerHTML = '<p>Error loading logs.</p>'; }
}

// Render Client Policies in Detail View
function renderClientPolicies(policies) {
    if (!clientPoliciesListEl) return; clientPoliciesListEl.innerHTML = '';
    if (!policies || policies.length === 0) { clientPoliciesListEl.innerHTML = '<p>No policies found for this client.</p>'; return; }
    const ul = document.createElement('ul'); policies.sort((a, b) => (a.policyNumber || '').localeCompare(b.policyNumber || ''));
    policies.forEach(policy => {
        const li = document.createElement('li'); const statusText = policy.policyStatus || 'Unknown';
        // Use dynamic date display here too
         let displayDueDateStr = '-';
         const storedNextDueDate = policy.nextInstallmentDate?.toDate();
         if (storedNextDueDate && policy.modeOfPayment) {
             let displayDate = new Date(storedNextDueDate); displayDate.setHours(0,0,0,0);
             const today = new Date(); today.setHours(0,0,0,0);
             let safetyCounter = 0; const maxIterations = 120;
              while (displayDate < today && safetyCounter < maxIterations) {
                   const calculated = calculateNextDueDate(displayDate, policy.modeOfPayment);
                   if (!calculated) { displayDate = null; break; }
                   displayDate = calculated; displayDate.setHours(0,0,0,0);
                   safetyCounter++;
              }
             if (displayDate) displayDueDateStr = formatDate(displayDate); else displayDueDateStr = 'Calc Error';
         } else if (storedNextDueDate) { displayDueDateStr = formatDate(storedNextDueDate); }

        li.innerHTML = `<strong>Policy No:</strong> ${policy.policyNumber || '-'} | <strong>Plan:</strong> ${policy.plan || '-'} | <strong>Premium:</strong> ₹ ${Number(policy.premiumAmount || 0).toLocaleString('en-IN')} (${policy.modeOfPayment || '-'}) | <strong>Next Due:</strong> ${displayDueDateStr} | <span class="status-badge status-${statusText.toLowerCase()}">${statusText}</span>`;
        ul.appendChild(li); });
    clientPoliciesListEl.appendChild(ul);
}

// Load Communication Logs
async function loadCommunicationLogs(identifier) {
    if (!communicationLogListEl || !db || !identifier) return; communicationLogListEl.innerHTML = '<p>Loading logs...</p>';
    try { const logsRef = collection(db, "communicationLogs"); const q = query(logsRef, where("clientIdentifier", "==", identifier), orderBy("timestamp", "desc"));
        const logSnapshot = await getDocs(q); const logs = logSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); communicationLogListEl.innerHTML = '';
        if (logs.length === 0) { communicationLogListEl.innerHTML = '<p>No communication logs found.</p>'; return; }
        logs.forEach(log => { const p = document.createElement('p'); const logDate = log.timestamp?.toDate ? formatDateTime(log.timestamp.toDate()) : 'Earlier';
            p.innerHTML = `<span class="log-meta">(${logDate}):</span> ${log.note || ''}`; communicationLogListEl.appendChild(p); });
         console.log(`Loaded ${logs.length} communication logs for identifier: ${identifier}`);
    } catch (error) { console.error(`Error loading communication logs for ${identifier}:`, error); communicationLogListEl.innerHTML = `<p>Error loading logs: ${error.message}</p>`; }
}

// Add Communication Note
async function addCommunicationNote() {
    if (!db || !newLogNoteEl || !currentOpenClientId) { alert("Cannot add note: Required data or context missing."); return; }
    const noteText = newLogNoteEl.value.trim(); if (!noteText) { alert("Please enter a note to add."); newLogNoteEl.focus(); return; }
    const policyData = allPoliciesCache.find(p => p.id === currentOpenClientId); const clientIdentifier = policyData?.mobileNo;
    if (!clientIdentifier) { alert("Could not determine the client identifier (e.g., mobile number) to save the log. Cannot add note."); return; }
    const logData = { clientIdentifier: clientIdentifier, note: noteText, timestamp: serverTimestamp(), policyContextId: currentOpenClientId };
    addLogBtn.disabled = true; addLogBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    try { const logsRef = collection(db, "communicationLogs"); await addDoc(logsRef, logData); console.log("Communication log added successfully."); newLogNoteEl.value = ''; loadCommunicationLogs(clientIdentifier);
    } catch (error) { console.error("Error adding communication log:", error); alert(`Failed to add communication log: ${error.message}`);
    } finally { addLogBtn.disabled = false; addLogBtn.innerHTML = '<i class="fas fa-plus"></i> Add Note'; }
}

// Close Client Detail Modal
function closeClientDetail() { if (clientDetailModal) { clientDetailModal.classList.remove('active'); currentOpenClientId = null; console.log("Client detail modal closed."); } }

// Open Client Detail Tab
window.openDetailTab = function(evt, tabName, isInitialCall = false) {
    if (evt && !isInitialCall) evt.preventDefault();
    const tabcontent = clientDetailModal.getElementsByClassName("tab-content");
    for (let i = 0; i < tabcontent.length; i++) { tabcontent[i].style.display = "none"; tabcontent[i].classList.remove("active"); }
    const tablinks = clientDetailModal.getElementsByClassName("tab-button");
    for (let i = 0; i < tablinks.length; i++) { tablinks[i].classList.remove("active"); }
    const currentTab = document.getElementById(tabName); if(currentTab) { currentTab.style.display = "block"; currentTab.classList.add("active"); }
     if (evt && evt.currentTarget) { evt.currentTarget.classList.add("active");
     } else if (isInitialCall) { const activeButton = Array.from(tablinks).find(btn => btn.getAttribute('onclick').includes(`'${tabName}'`)); if (activeButton) activeButton.classList.add("active"); }
}


// --- हेल्पर फंक्शन्स ---

// Format Date as DD-MM-YYYY
function formatDate(date) {
    if (!date || !(date instanceof Date)) return '-';
    try {
        let day = date.getDate().toString().padStart(2, '0');
        let month = (date.getMonth() + 1).toString().padStart(2, '0');
        let year = date.getFullYear();
        // Basic check for invalid date components resulting from bad input
        if (isNaN(day) || isNaN(month) || isNaN(year) || year < 1900 || year > 2100) return 'Invalid Date';
        return `${day}-${month}-${year}`;
    } catch (e) {
        console.error("Error formatting date:", date, e);
        return 'Date Error';
    }
}

// Format Date and Time as DD-MM-YYYY HH:MM AM/PM
function formatDateTime(date) {
    if (!date || !(date instanceof Date)) return '-';
     try {
         let day = date.getDate().toString().padStart(2, '0');
         let month = (date.getMonth() + 1).toString().padStart(2, '0');
         let year = date.getFullYear();
         if (isNaN(day) || isNaN(month) || isNaN(year) || year < 1900 || year > 2100) return 'Invalid DateTime';
         let hours = date.getHours();
         let minutes = date.getMinutes().toString().padStart(2, '0');
         let ampm = hours >= 12 ? 'PM' : 'AM';
         hours = hours % 12; hours = hours ? hours : 12;
         let hoursStr = hours.toString().padStart(2, '0');
         return `${day}-${month}-${year} ${hoursStr}:${minutes} ${ampm}`;
     } catch (e) {
         console.error("Error formatting datetime:", date, e);
         return 'DateTime Error';
     }
}

// Calculate next due date based on start date and mode
function calculateNextDueDate(startDate, mode) {
     if (!startDate || !(startDate instanceof Date) || !mode) {
         console.error("calculateNextDueDate: Invalid input", startDate, mode);
         return null;
     }
     try {
        // Create a new Date object based on the start date's components in UTC to avoid timezone shifts messing up the day
        let nextDate = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()));

         switch (mode) {
             case 'Yearly':
                 nextDate.setUTCFullYear(nextDate.getUTCFullYear() + 1);
                 break;
             case 'Half-Yearly':
                 nextDate.setUTCMonth(nextDate.getUTCMonth() + 6);
                 break;
             case 'Quarterly':
                 nextDate.setUTCMonth(nextDate.getUTCMonth() + 3);
                 break;
             case 'Monthly':
                 nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
                 break;
             default:
                 console.error(`calculateNextDueDate: Unknown mode "${mode}"`);
                 return null;
         }
          // Return as a Date object (it will be interpreted in local time by default when used, but the date components are correct from UTC)
         return nextDate;
     } catch (e) {
         console.error("Error calculating next due date:", startDate, mode, e);
         return null;
     }
}


// --- फिल्टर/सॉर्ट हैंडलर्स ---
function handleLicFilterChange() {
    clearTimeout(searchDebounceTimerLic);
    searchDebounceTimerLic = setTimeout(() => { applyLicFiltersAndRender(); }, 300);
}
function handleLicSortChange() { console.log("Sort changed:", sortLicSelect.value); listenForPolicies(); }
function clearLicFilters() {
    if (licSearchInput) licSearchInput.value = ''; if (licStatusFilter) licStatusFilter.value = ''; if (licPlanFilter) licPlanFilter.value = ''; if (licModeFilter) licModeFilter.value = ''; if (licNachFilter) licNachFilter.value = '';
    applyLicFiltersAndRender(); console.log("Filters cleared.");
}

// --- एंड ऑफ़ फाइल ---