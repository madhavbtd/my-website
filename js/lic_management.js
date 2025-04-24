// js/lic_management.js
// Updated for Phase 1 & Phase 2 Features + Task Followup + Modal Refinements + Debugging Logs

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
    newTaskCommentsEl = document.getElementById('newTaskComments'); // <<< यह अब 'Add Task' फॉर्म में कमेंट्स के लिए है
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

    // Edit Task Modal Elements (Updated)
    editTaskModal = document.getElementById('editTaskModal');
    editTaskForm = document.getElementById('editTaskForm');
    editTaskIdEl = document.getElementById('editTaskId');
    editTaskCustomerNameEl = document.getElementById('editTaskCustomerName');
    editTaskDescriptionEl = document.getElementById('editTaskDescription');
    editTaskDueDateEl = document.getElementById('editTaskDueDate');
    // editTaskCommentsEl is removed/replaced by History and New Comment fields
    editTaskCommentsHistoryEl = document.getElementById('editTaskCommentsHistory'); // <<< हिस्ट्री दिखाने के लिए
    editTaskNewCommentEl = document.getElementById('editTaskNewComment');       // <<< नया कमेंट जोड़ने के लिए
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
    if (policyModal) policyModal.addEventListener('click', (e) => { if (e.target === policyModal) closePolicyModal(); });
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
    if (editTaskForm) editTaskForm.addEventListener('submit', handleUpdateTask); // <<< Edit Task सेव करने के लिए

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
        loadDashboardData();        // Update Dashboard
    }, (error) => {
        console.error("Error listening to policies:", error);
        if(licPolicyTableBody) licPolicyTableBody.innerHTML = `<tr><td colspan="9">Error loading policy data. Check console.</td></tr>`;
        if(dbTotalPoliciesEl) dbTotalPoliciesEl.textContent = 'Error';
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

     const statusFilterValue = licStatusFilter ? licStatusFilter.value : ''; // <<< Debugging के लिए वैल्यू पहले ले ली
     const planFilterValue = licPlanFilter ? licPlanFilter.value.trim().toLowerCase() : ''; // <<< Debugging के लिए वैल्यू पहले ले ली
     console.log(`Filtering with Status: "${statusFilterValue}", Plan: "${planFilterValue}"`); // <<< Debugging लॉग

     const searchTerm = licSearchInput ? licSearchInput.value.trim().toLowerCase() : '';
     const modeFilter = licModeFilter ? licModeFilter.value : '';
     const nachFilter = licNachFilter ? licNachFilter.value : '';

     let filteredPolicies = allPoliciesCache.filter(policy => {
         const searchMatch = searchTerm === '' || (policy.customerName || '').toLowerCase().includes(searchTerm) || (policy.policyNumber || '').toLowerCase().includes(searchTerm) || (policy.mobileNo || '').toLowerCase().includes(searchTerm);
         const policyStatusLower = (policy.policyStatus || '').toLowerCase();
         const statusMatch = statusFilterValue === '' || policyStatusLower === statusFilterValue.toLowerCase();
         if (statusFilterValue !== '') { console.log(` Policy ID: ${policy.id}, Policy Status: "${policyStatusLower}", Filter Status: "${statusFilterValue.toLowerCase()}", Match: ${statusMatch}`); } // <<< Debugging लॉग
         const planMatch = planFilterValue === '' || (policy.plan || '').toLowerCase().includes(planFilterValue);
         const modeMatch = modeFilter === '' || (policy.modeOfPayment || '') === modeFilter;
         const nachMatch = nachFilter === '' || (policy.nachStatus || '') === nachFilter;
         return searchMatch && statusMatch && planMatch && modeMatch && nachMatch;
     });

     console.log(`Policies before filtering: ${allPoliciesCache.length}, After filtering: ${filteredPolicies.length}`); // <<< Debugging लॉग

     filteredPolicies.sort((a, b) => {
          let valA = a[currentLicSortField]; let valB = b[currentLicSortField];
           if (valA && typeof valA.toDate === 'function') valA = valA.toDate();
           if (valB && typeof valB.toDate === 'function') valB = valB.toDate();
           if (currentLicSortField === 'premiumAmount' || currentLicSortField === 'sumAssured') { valA = Number(valA) || 0; valB = Number(valB) || 0; }
           else if (currentLicSortField === 'customerName' || currentLicSortField === 'policyNumber') { valA = (valA || '').toLowerCase(); valB = (valB || '').toLowerCase(); }
           else if (valA instanceof Date && valB instanceof Date) { } else { valA = String(valA || '').toLowerCase(); valB = String(valB || '').toLowerCase(); }
          let comparison = 0; if (valA > valB) comparison = 1; else if (valA < valB) comparison = -1;
          return currentLicSortDirection === 'desc' ? (comparison * -1) : comparison;
     });

     renderPolicyTable(filteredPolicies);
}

// --- टेबल रेंडरिंग (Policies) ---
function renderPolicyTable(policies) {
    if (!licPolicyTableBody) return;
    licPolicyTableBody.innerHTML = '';
    if (policies.length === 0) { licPolicyTableBody.innerHTML = `<tr><td colspan="9" style="text-align: center;">No policies found matching criteria.</td></tr>`; return; }
    policies.forEach(policy => {
        const row = licPolicyTableBody.insertRow(); row.setAttribute('data-id', policy.id);
        row.insertCell().textContent = policy.policyNumber || '-';
        const nameCell = row.insertCell(); const nameLink = document.createElement('a'); nameLink.href = "#"; nameLink.textContent = policy.customerName || 'N/A'; nameLink.title = `View details for ${policy.customerName || 'this client'}`; nameLink.style.cursor = 'pointer'; nameLink.style.textDecoration = 'underline'; nameLink.style.color = '#0056b3'; nameLink.onclick = (e) => { e.preventDefault(); showClientDetail(policy.id, policy.customerName); }; nameCell.appendChild(nameLink);
        row.insertCell().textContent = policy.mobileNo || '-'; row.insertCell().textContent = policy.plan || '-'; row.insertCell().textContent = policy.premiumAmount ? `₹ ${Number(policy.premiumAmount).toFixed(2)}` : '-'; row.insertCell().textContent = policy.modeOfPayment || '-'; row.insertCell().textContent = policy.nextInstallmentDate?.toDate ? formatDate(policy.nextInstallmentDate.toDate()) : '-'; row.insertCell().innerHTML = `<span class="status-badge status-${(policy.policyStatus || 'unknown').toLowerCase()}">${policy.policyStatus || 'Unknown'}</span>`;
        const actionCell = row.insertCell(); actionCell.classList.add('action-buttons');
        const editBtn = document.createElement('button'); editBtn.innerHTML = '<i class="fas fa-edit"></i>'; editBtn.title = "Edit Policy"; editBtn.classList.add('button', 'edit-button'); editBtn.onclick = (e) => { e.stopPropagation(); openPolicyModal(policy.id, policy); }; actionCell.appendChild(editBtn);
        const payBtn = document.createElement('button'); payBtn.innerHTML = '<i class="fas fa-check-circle"></i>'; payBtn.title = "Mark Premium Paid & Update Due Date"; payBtn.classList.add('button', 'pay-button'); payBtn.disabled = !['Active', 'Lapsed'].includes(policy.policyStatus) || !policy.nextInstallmentDate || !policy.modeOfPayment; payBtn.onclick = (e) => { e.stopPropagation(); handleMarkPaid(policy.id, policy); }; actionCell.appendChild(payBtn);
        const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>'; deleteBtn.title = "Delete Policy"; deleteBtn.classList.add('button', 'delete-button'); deleteBtn.onclick = (e) => { e.stopPropagation(); handleDeletePolicy(policy.id, policy.policyNumber); }; actionCell.appendChild(deleteBtn);
    });
}


// --- Modal खोलना/बंद करना (Policy Add/Edit) ---
function openPolicyModal(policyId = null, data = {}) {
    if (!policyModal || !policyForm || !policyModalTitle) return;
    policyForm.reset();
    editPolicyId.value = policyId || '';
    if (policyId) { policyModalTitle.textContent = "Edit Policy Details"; /* ... बाकी फ़ील्ड भरना ... */ }
    else { policyModalTitle.textContent = "Add New Policy"; /* ... बाकी फ़ील्ड भरना ... */ }
    // --- Populate form data (Same as before) ---
     if (policyId) {
        document.getElementById('customerName').value = data.customerName || '';
        document.getElementById('fatherName').value = data.fatherName || '';
        // ... rest of fields ...
        if(policyStatusModal) policyStatusModal.value = data.policyStatus || 'Active';
        if(nachStatusModal) nachStatusModal.value = data.nachStatus || ''; // Default to empty for dropdown
    } else {
         if(policyStatusModal) policyStatusModal.value = 'Active';
         if(nachStatusModal) nachStatusModal.value = ''; // Default to empty for dropdown
         document.getElementById('nextInstallmentDate').value = '';
    }
    // --- End Populate form data ---
    policyModal.classList.add('active');
}
function closePolicyModal() { if (policyModal) policyModal.classList.remove('active'); }

// --- पॉलिसी सेव/अपडेट करना ---
async function handleSavePolicy(event) { /* ... जस का तस ... */ }

// --- पॉलिसी डिलीट करना ---
async function handleDeletePolicy(policyId, policyNumber) { /* ... जस का तस ... */ }

// --- प्रीमियम भुगतान मार्क करना (Phase 1) ---
async function handleMarkPaid(policyId, policyData) { /* ... जस का तस ... */ }

// --- रिमाइंडर फंक्शन (Policies) ---
async function displayReminders() { /* ... जस का तस ... */ }

// --- रिमाइंडर चेकबॉक्स हैंडलर ---
function handleReminderCheckboxChange(event) { /* ... जस का तस ... */ }


// --- *** Task Management Functions (Follow-up Style) *** ---

// Render Task List (Updated for History Display)
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
         contentDiv.appendChild(customerSpan); contentDiv.appendChild(descSpan); contentDiv.appendChild(dateSpan);
         // Display Latest Comment
         const commentSpan = document.createElement('p'); commentSpan.style.fontSize = '0.85em'; commentSpan.style.color = '#666'; commentSpan.style.marginTop = '4px'; commentSpan.style.whiteSpace = 'pre-wrap';
         if (task.comments && Array.isArray(task.comments) && task.comments.length > 0) {
             const latestComment = task.comments[task.comments.length - 1];
             const commentDate = latestComment.timestamp?.toDate ? formatDateTime(latestComment.timestamp.toDate()) : '';
             commentSpan.textContent = `Latest Comment (${commentDate}): ${latestComment.text}`;
         } else if (task.comments && typeof task.comments === 'string') { commentSpan.textContent = `Comment: ${task.comments}`; }
         contentDiv.appendChild(commentSpan);
         // Actions Div
         const actionsDiv = document.createElement('div'); actionsDiv.style.marginLeft = 'auto'; actionsDiv.style.display = 'flex'; actionsDiv.style.gap = '5px'; actionsDiv.style.flexShrink = '0'; actionsDiv.style.alignItems = 'center';
         const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'task-checkbox'; checkbox.checked = task.completed; checkbox.title = task.completed ? 'Mark as Pending' : 'Mark as Completed'; checkbox.style.marginTop = '0px'; // Reset margin if needed
         const editBtn = document.createElement('button'); editBtn.innerHTML = '<i class="fas fa-edit"></i>'; editBtn.className = 'button edit-button edit-task-btn'; editBtn.title = 'Edit Task'; editBtn.onclick = (e) => { e.stopPropagation(); openEditTaskModal(task.id, task); };
         const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>'; deleteBtn.className = 'button delete-task-btn'; deleteBtn.title = 'Delete Task';
         actionsDiv.appendChild(checkbox); actionsDiv.appendChild(editBtn); actionsDiv.appendChild(deleteBtn);
         li.appendChild(contentDiv); li.appendChild(actionsDiv); taskList.appendChild(li);
     });
 }

// Add New Follow-up Task
async function handleAddTask() { /* ... जस का तस, पहले जैसा ... */ }

// Handle Task Checkbox Change
async function handleTaskCheckboxChange(event) { /* ... जस का तस, पहले जैसा ... */ }

// Handle Task Actions (Delete Only)
async function handleTaskActions(event) { /* ... जस का तस, पहले जैसा ... */ }

// Open Edit Task Modal (Updated for History)
function openEditTaskModal(taskId, taskData) {
    if (!editTaskModal || !editTaskForm) return; console.log("Opening edit modal for task:", taskId, taskData);
    editTaskIdEl.value = taskId;
    editTaskCustomerNameEl.value = taskData.customerName || '';
    editTaskDescriptionEl.value = taskData.description || '';
    editTaskDueDateEl.value = taskData.dueDate?.toDate ? taskData.dueDate.toDate().toISOString().split('T')[0] : '';
    editTaskStatusEl.value = taskData.completed ? 'completed' : 'pending';
    if(editTaskNewCommentEl) editTaskNewCommentEl.value = ''; // Clear new comment field

    // Display Comment History
    if(editTaskCommentsHistoryEl) {
        editTaskCommentsHistoryEl.innerHTML = ''; // Clear previous history
        if (taskData.comments && Array.isArray(taskData.comments) && taskData.comments.length > 0) {
             editTaskCommentsHistoryEl.innerHTML = '<h4>Comment History:</h4>';
             // Sort comments by timestamp if available, oldest first
             taskData.comments.sort((a, b) => (a.timestamp?.toDate() || 0) - (b.timestamp?.toDate() || 0));
             taskData.comments.forEach(comment => {
                const p = document.createElement('p');
                const commentDate = comment.timestamp?.toDate ? formatDateTime(comment.timestamp.toDate()) : 'Earlier';
                p.innerHTML = `<span class="log-meta">(${commentDate}):</span> ${comment.text || ''}`;
                editTaskCommentsHistoryEl.appendChild(p);
             });
        } else { editTaskCommentsHistoryEl.innerHTML = '<p>No comment history available.</p>'; }
    } else { console.error("History Div not found"); }

    editTaskModal.classList.add('active');
}

// Close Edit Task Modal
function closeEditTaskModal() { if (editTaskModal) { editTaskModal.classList.remove('active'); } }

// Handle Update Task Form Submission (Updated for History)
async function handleUpdateTask(event) {
    event.preventDefault(); if (!db || !editTaskIdEl) return;
    const taskId = editTaskIdEl.value; if (!taskId) { alert("Error: Task ID missing."); return; }
    const updatedData = {
        customerName: editTaskCustomerNameEl.value.trim(), description: editTaskDescriptionEl.value.trim(),
        dueDate: editTaskDueDateEl.value ? Timestamp.fromDate(new Date(editTaskDueDateEl.value + 'T00:00:00Z')) : null,
        completed: editTaskStatusEl.value === 'completed', updatedAt: serverTimestamp()
    };
    if (!updatedData.description) { alert("Please enter task description."); return; }
    const newCommentText = editTaskNewCommentEl?.value.trim(); // Get new comment
    const saveButton = document.getElementById('saveTaskChangesBtn');
    if(saveButton) { saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }
    try {
        const taskRef = doc(db, "tasks", taskId);
        // 1. Update basic fields first
        await updateDoc(taskRef, updatedData);
        // 2. If there's a new comment, add it to the 'comments' array
        if (newCommentText && typeof window.arrayUnion === 'function') {
            const newCommentObject = { text: newCommentText, timestamp: serverTimestamp() };
            await updateDoc(taskRef, { comments: window.arrayUnion(newCommentObject) });
            console.log("New comment added using arrayUnion.");
        } else if (newCommentText) {
            // Fallback or error if arrayUnion not available
            console.error("arrayUnion function not available. Cannot add comment atomically.");
            alert("Error: Could not save comment.");
        }
        alert("Task updated successfully!"); closeEditTaskModal();
    } catch (error) { console.error("Error updating task:", error); alert("Failed to update task: " + error.message);
    } finally { if(saveButton) { saveButton.disabled = false; saveButton.innerHTML = '<i class="fas fa-save"></i> Save Changes'; } }
}

// Display Upcoming Tasks Reminder
async function displayUpcomingTasks() { /* ... जस का तस, पहले जैसा ... */ }


// --- Phase 2 Functions (Client Detail) ---
function loadDashboardData() { /* ... जस का तस, पहले जैसा ... */ }
async function showClientDetail(policyId, customerName) { /* ... जस का तस, पहले जैसा ... */ }
function renderClientPolicies(policies) { /* ... जस का तस, पहले जैसा ... */ }
async function loadCommunicationLogs(identifier) { /* ... जस का तस, पहले जैसा ... */ }
async function addCommunicationNote() { /* ... जस का तस, पहले जैसा ... */ }
function closeClientDetail() { /* ... जस का तस, पहले जैसा ... */ }
window.openDetailTab = function(evt, tabName) { /* ... जस का तस, पहले जैसा ... */ }


// --- हेल्पर फंक्शन्स ---
function formatDate(date) { /* ... जस का तस, पहले जैसा ... */ }
function formatDateTime(date) { /* ... जस का तस, पहले जैसा ... */ }
function calculateNextDueDate(startDate, mode) { /* ... जस का तस, पहले जैसा ... */ }

// --- फिल्टर/सॉर्ट हैंडलर्स ---
function handleLicFilterChange() { /* ... जस का तस, पहले जैसा ... */ }
function handleLicSortChange() { /* ... जस का तस, पहले जैसा ... */ }
function clearLicFilters() { /* ... जस का तस, पहले जैसा ... */ }

// --- एंड ऑफ़ फाइल ---