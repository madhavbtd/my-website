// js/lic_management.js

// --- सुनिश्चित करें कि ग्लोबल Firebase फंक्शन्स उपलब्ध हैं ---
const {
    db, collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp,
    query, where, orderBy, limit, Timestamp, onSnapshot // Use onSnapshot here
} = window;

// --- DOM एलिमेंट वेरिएबल्स ---
let licPolicyTableBody, reminderList, policyModal, policyForm, policyModalTitle, editPolicyId,
    addNewPolicyBtn, closePolicyModalBtn, cancelPolicyBtn, savePolicyBtn,
    licSearchInput, licStatusFilter, sortLicSelect, clearLicFiltersBtn, policyStatus, nachStatus,
    newTaskInput, newTaskDueDate, addTaskBtn, taskList;

// --- ग्लोबल स्टेट ---
let currentLicSortField = 'createdAt';
let currentLicSortDirection = 'desc';
let unsubscribePolicies = null; // Firestore listener for policies
let unsubscribeTasks = null; // Firestore listener for tasks
let allPoliciesCache = []; // Cache for policies
let searchDebounceTimerLic;
let currentUserId = null; // Store logged-in user's ID

// --- पेज इनिशियलाइज़ेशन ---
function initializeLicPage(user) {
    console.log("Initializing LIC Management Page...");
    if (!user) {
        console.error("User object not passed to initializeLicPage!");
        return;
    }
    currentUserId = user.uid; // Store the user ID

    // DOM एलिमेंट्स प्राप्त करें
    licPolicyTableBody = document.getElementById('licPolicyTableBody');
    reminderList = document.getElementById('reminderList');
    policyModal = document.getElementById('policyModal');
    policyForm = document.getElementById('policyForm');
    policyModalTitle = document.getElementById('policyModalTitle');
    editPolicyId = document.getElementById('editPolicyId');
    addNewPolicyBtn = document.getElementById('addNewPolicyBtn');
    closePolicyModalBtn = document.getElementById('closePolicyModal');
    cancelPolicyBtn = document.getElementById('cancelPolicyBtn');
    savePolicyBtn = document.getElementById('savePolicyBtn');
    licSearchInput = document.getElementById('licSearchInput');
    licStatusFilter = document.getElementById('licStatusFilter'); // Get Status Filter element
    sortLicSelect = document.getElementById('sort-lic');
    clearLicFiltersBtn = document.getElementById('clearLicFiltersBtn');
    policyStatus = document.getElementById('policyStatus'); // Status dropdown in modal
    nachStatus = document.getElementById('nachStatus');   // NACH dropdown in modal

    // Task Management Elements
    newTaskInput = document.getElementById('newTaskInput');
    newTaskDueDate = document.getElementById('newTaskDueDate');
    addTaskBtn = document.getElementById('addTaskBtn');
    taskList = document.getElementById('taskList');

    // इवेंट लिस्टनर्स जोड़ें
    if (addNewPolicyBtn) addNewPolicyBtn.addEventListener('click', () => openPolicyModal());
    if (closePolicyModalBtn) closePolicyModalBtn.addEventListener('click', closePolicyModal);
    if (cancelPolicyBtn) cancelPolicyBtn.addEventListener('click', closePolicyModal);
    if (policyModal) policyModal.addEventListener('click', (e) => { if (e.target === policyModal) closePolicyModal(); });
    if (policyForm) policyForm.addEventListener('submit', handleSavePolicy);
    if (licSearchInput) licSearchInput.addEventListener('input', handleLicSearchInput);
    if (licStatusFilter) licStatusFilter.addEventListener('change', applyLicFiltersAndRender); // Listener for Status Filter
    if (sortLicSelect) sortLicSelect.addEventListener('change', handleLicSortChange);
    if (clearLicFiltersBtn) clearLicFiltersBtn.addEventListener('click', clearLicFilters);

    // Reminder Checkbox Listener
    if (reminderList) reminderList.addEventListener('change', handleReminderCheckboxChange);

    // Task Management Listeners
    if (addTaskBtn) addTaskBtn.addEventListener('click', handleAddTask);
    if (taskList) {
        taskList.addEventListener('change', handleTaskCheckboxChange);
        taskList.addEventListener('click', handleTaskDeleteClick);
    }

    // Firestore से डेटा सुनना शुरू करें
    listenForPolicies();
    listenForTasks(); // Start listening for tasks
    displayReminders(); // Load initial reminders
}

// --- Firestore Listeners ---
function listenForPolicies() {
    if (unsubscribePolicies) unsubscribePolicies();
    if (!db || !currentUserId) { console.error("DB or UserID not initialized for policies"); return; }

    const policiesRef = collection(db, "licCustomers");
    // Query policies only for the current logged-in user
    const q = query(policiesRef, where("agentId", "==", currentUserId)); // Add filter for agentId

    unsubscribePolicies = onSnapshot(q, (snapshot) => {
        allPoliciesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        applyLicFiltersAndRender(); // Render table when data changes
    }, (error) => {
        console.error("Error listening to policies:", error);
        if(licPolicyTableBody) licPolicyTableBody.innerHTML = `<tr><td colspan="10">Error loading policy data. ${error.message}</td></tr>`; // Updated colspan
    });
}

function listenForTasks() {
    if (unsubscribeTasks) unsubscribeTasks();
    if (!db || !currentUserId) { console.error("DB or UserID not initialized for tasks"); return; }

    const tasksRef = collection(db, "tasks");
    // Query tasks only for the current logged-in user, order by creation date
    const q = query(tasksRef, where("agentId", "==", currentUserId), orderBy("createdAt", "desc"));

    unsubscribeTasks = onSnapshot(q, (snapshot) => {
        const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTaskList(tasks); // Render task list when data changes
    }, (error) => {
        console.error("Error listening to tasks:", error);
        if(taskList) taskList.innerHTML = `<li class="loading-tasks">Error loading tasks. ${error.message}</li>`;
    });
}


// --- फ़िल्टर, सॉर्ट और रेंडर (पॉलिसी) ---
function applyLicFiltersAndRender() {
     if (!allPoliciesCache) return;
     console.log("Applying LIC filters and rendering...");
     const searchTerm = licSearchInput.value.trim().toLowerCase();
     const selectedStatus = licStatusFilter.value; // Get selected status

     // 1. फ़िल्टर करें
     let filteredPolicies = allPoliciesCache.filter(policy => {
         // Status Filter
         const statusMatch = !selectedStatus || (policy.policyStatus && policy.policyStatus === selectedStatus); // Check if status matches or if no status is selected

         // Search Filter (only if status matches or no status selected)
         if (statusMatch) {
             const nameMatch = (policy.customerName || '').toLowerCase().includes(searchTerm);
             const policyNoMatch = (policy.policyNumber || '').toLowerCase().includes(searchTerm);
             const mobileMatch = (policy.mobileNo || '').toLowerCase().includes(searchTerm);
             return nameMatch || policyNoMatch || mobileMatch;
         }
         return false; // Exclude if status doesn't match
     });

     // 2. सॉर्ट करें (जैसे पहले था)
     filteredPolicies.sort((a, b) => {
          let valA = a[currentLicSortField];
          let valB = b[currentLicSortField];
           if (valA && typeof valA.toDate === 'function') valA = valA.toDate();
           if (valB && typeof valB.toDate === 'function') valB = valB.toDate();
           if (currentLicSortField === 'premiumAmount' || currentLicSortField === 'sumAssured') {
               valA = Number(valA) || 0; valB = Number(valB) || 0;
           }
           if (currentLicSortField === 'customerName') {
                valA = (valA || '').toLowerCase(); valB = (valB || '').toLowerCase();
           }
          let comparison = 0;
          if (valA > valB) comparison = 1;
          else if (valA < valB) comparison = -1;
          return currentLicSortDirection === 'desc' ? (comparison * -1) : comparison;
     });

     // 3. टेबल रेंडर करें
     renderPolicyTable(filteredPolicies);
}

// --- टेबल रेंडरिंग (पॉलिसी) ---
function renderPolicyTable(policies) {
    if (!licPolicyTableBody) return;
    licPolicyTableBody.innerHTML = '';
    if (policies.length === 0) {
        licPolicyTableBody.innerHTML = `<tr><td colspan="10" style="text-align: center;">No policies found matching criteria.</td></tr>`; // Updated colspan
        return;
    }
    policies.forEach(policy => {
        const row = licPolicyTableBody.insertRow();
        row.setAttribute('data-id', policy.id);

        row.insertCell().textContent = policy.policyNumber || '-';
        row.insertCell().textContent = policy.customerName || 'N/A';
        row.insertCell().textContent = policy.mobileNo || '-';
        row.insertCell().textContent = policy.plan || '-';
        row.insertCell().textContent = policy.premiumAmount ? `₹ ${policy.premiumAmount.toFixed(2)}` : '-';
        row.insertCell().textContent = policy.modeOfPayment || '-';
        row.insertCell().textContent = policy.nextInstallmentDate?.toDate ? formatDate(policy.nextInstallmentDate.toDate()) : '-';
        row.insertCell().innerHTML = `<span class="status-badge status-${(policy.policyStatus || 'unknown').toLowerCase()}">${policy.policyStatus || 'Unknown'}</span>`;
        row.insertCell().textContent = policy.nachStatus || '-'; // Display NACH Status

        // एक्शन बटन सेल
        const actionCell = row.insertCell();
        actionCell.classList.add('action-buttons');

        // Edit बटन
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.title = "Edit Policy";
        editBtn.classList.add('button', 'edit-button');
        editBtn.onclick = (e) => { e.stopPropagation(); openPolicyModal(policy.id, policy); };
        actionCell.appendChild(editBtn);

        // Delete बटन
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.title = "Delete Policy";
        deleteBtn.classList.add('button', 'delete-button');
        deleteBtn.onclick = (e) => { e.stopPropagation(); handleDeletePolicy(policy.id, policy.policyNumber); };
        actionCell.appendChild(deleteBtn);
    });
}

// --- Modal खोलना/बंद करना ---
function openPolicyModal(policyId = null, data = {}) {
    // यह फंक्शन लगभग पहले जैसा ही है, बस सुनिश्चित करें कि फॉर्म रीसेट हो रहा है
    if (!policyModal || !policyForm) return;
    policyForm.reset();
    editPolicyId.value = policyId || '';

    if (policyId) {
        policyModalTitle.innerHTML = '<i class="fas fa-edit"></i> Edit Policy Details'; // Icon added
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
        if(policyStatus) policyStatus.value = data.policyStatus || 'Active';
        if(nachStatus) nachStatus.value = data.nachStatus || 'No';
    } else {
        policyModalTitle.innerHTML = '<i class="fas fa-file-contract"></i> Add New Policy'; // Icon added
         if(policyStatus) policyStatus.value = 'Active';
         if(nachStatus) nachStatus.value = 'No';
         document.getElementById('nextInstallmentDate').value = ''; // Clear for potential auto-calculation
    }
    policyModal.classList.add('active');
}

function closePolicyModal() {
    if (policyModal) policyModal.classList.remove('active');
}

// --- पॉलिसी सेव/अपडेट करना ---
async function handleSavePolicy(event) {
    event.preventDefault();
    if (!db || !currentUserId) { alert("Database not ready or user not logged in."); return; }

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
        policyStatus: policyStatus ? policyStatus.value : 'Active',
        nachStatus: nachStatus ? nachStatus.value : 'No',
        updatedAt: serverTimestamp(),
        agentId: currentUserId // Store the agent's ID with the policy
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
               alert("Could not calculate next installment date. Please enter it manually.");
               return;
          }
     } else if (!formData.nextInstallmentDate) { // If still no next date (e.g., editing and cleared)
         alert("Next Installment Date is required.");
         return;
     }

    savePolicyBtn.disabled = true;
    savePolicyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        if (isEditing) {
            const policyRef = doc(db, "licCustomers", policyId);
            delete formData.createdAt; // Don't overwrite createdAt on update
            await updateDoc(policyRef, formData);
            alert("Policy updated successfully!");
        } else {
            formData.createdAt = serverTimestamp();
            await addDoc(collection(db, "licCustomers"), formData);
            alert("New policy added successfully!");
        }
        closePolicyModal();
        displayReminders(); // Update reminders

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
             displayReminders(); // Update reminders
        } catch (error) {
            console.error("Error deleting policy:", error);
            alert("Error deleting policy: " + error.message);
        }
    }
}

// --- रिमाइंडर फंक्शन ---
async function displayReminders() {
    if (!db || !reminderList || !currentUserId) return;
    reminderList.innerHTML = '<li class="loading-reminder">Loading reminders...</li>';

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today
        const reminderDays = 15;
        const reminderEndDate = new Date(today);
        reminderEndDate.setDate(today.getDate() + reminderDays);

        const todayTimestamp = Timestamp.fromDate(today);
        const endTimestamp = Timestamp.fromDate(reminderEndDate);

        const reminderQuery = query(collection(db, "licCustomers"),
                                 where("agentId", "==", currentUserId), // Only show reminders for current agent
                                 where("policyStatus", "in", ["Active", "Lapsed"]), // Only active/lapsed policies
                                 where("nextInstallmentDate", ">=", todayTimestamp),
                                 where("nextInstallmentDate", "<=", endTimestamp),
                                 orderBy("nextInstallmentDate"));

        const querySnapshot = await getDocs(reminderQuery); // Use getDocs for one-time fetch
        reminderList.innerHTML = '';

        if (querySnapshot.empty) {
            reminderList.innerHTML = '<li>No upcoming installments in the next ' + reminderDays + ' days.</li>';
            return;
        }

        querySnapshot.forEach(docSnap => {
            const policy = { id: docSnap.id, ...docSnap.data() };
            const li = document.createElement('li');
            li.setAttribute('data-doc-id', policy.id);

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'reminder-checkbox';
            // Consider adding a feature to save checkbox state if needed

            const span = document.createElement('span');
            span.innerHTML = `Policy: <strong>${policy.policyNumber || 'N/A'}</strong> - ${policy.customerName || 'N/A'} (₹ ${policy.premiumAmount?.toFixed(2) || 'N/A'}) Due: <strong>${formatDate(policy.nextInstallmentDate?.toDate())}</strong>`;

            li.appendChild(checkbox);
            li.appendChild(span);
            reminderList.appendChild(li);
        });

    } catch (error) {
        console.error("Error fetching reminders:", error);
        reminderList.innerHTML = '<li>Error loading reminders.</li>';
    }
}

// --- रिमाइंडर चेकबॉक्स हैंडलर ---
function handleReminderCheckboxChange(event) {
    // Same as before - currently just hides visually
    if (event.target.classList.contains('reminder-checkbox')) {
        const checkbox = event.target;
        const listItem = checkbox.closest('li');
        if (checkbox.checked && listItem) {
            listItem.classList.add('hidden-reminder');
        } else if (listItem) {
             listItem.classList.remove('hidden-reminder');
        }
    }
}

// --- टास्क मैनेजमेंट फंक्शन्स (Implemented) ---
async function handleAddTask() {
    const description = newTaskInput.value.trim();
    const dueDate = newTaskDueDate.value;
    if (!description || !currentUserId) {
        alert("Please enter task description.");
        return;
    }

    const taskData = {
        description: description,
        dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate)) : null,
        completed: false,
        createdAt: serverTimestamp(),
        agentId: currentUserId // Associate task with the logged-in agent
    };

    addTaskBtn.disabled = true;
    addTaskBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

    try {
        await addDoc(collection(db, "tasks"), taskData);
        console.log("Task added successfully");
        newTaskInput.value = '';
        newTaskDueDate.value = '';
        // Listener will automatically refresh the list
    } catch (error) {
        console.error("Error adding task:", error);
        alert("Failed to add task: " + error.message);
    } finally {
        addTaskBtn.disabled = false;
        addTaskBtn.innerHTML = '<i class="fas fa-plus"></i> Add Task';
    }
}

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
                   // Style updates are handled by renderTaskList via listener
               } catch (error) {
                   console.error("Error updating task status:", error);
                   alert("Failed to update task status.");
                   checkbox.checked = !isCompleted; // Revert on error
                }
          }
     }
}

async function handleTaskDeleteClick(event) {
    const deleteButton = event.target.closest('.delete-task-btn');
    if (deleteButton) {
         const listItem = deleteButton.closest('li');
         const taskId = listItem?.dataset.taskId;
         if (taskId && db && confirm("Are you sure you want to delete this task?")) {
              console.log("Deleting task:", taskId);
              try {
                   await deleteDoc(doc(db, "tasks", taskId));
                   console.log("Task deleted successfully");
                   // Listener will automatically remove it from UI
              } catch (error) {
                  console.error("Error deleting task:", error);
                  alert("Failed to delete task.");
              }
         }
    }
}

function renderTaskList(tasks) {
    if (!taskList) return;
    taskList.innerHTML = ''; // Clear existing list
    if (tasks.length === 0) {
        taskList.innerHTML = '<li class="loading-tasks">No tasks found.</li>';
        return;
    }

    tasks.forEach(task => {
        const li = document.createElement('li');
        li.setAttribute('data-task-id', task.id);
        li.classList.toggle('completed-task', task.completed); // Add class if completed

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox';
        checkbox.checked = task.completed;

        const span = document.createElement('span');
        let taskText = task.description;
        if (task.dueDate?.toDate) {
            taskText += ` (Due: ${formatDate(task.dueDate.toDate())})`;
        }
        span.textContent = taskText;
        span.style.textDecoration = task.completed ? 'line-through' : 'none'; // Apply visual style
        span.style.color = task.completed ? '#6c757d' : 'inherit';

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

// --- हेल्पर फंक्शन्स ---
function formatDate(date) {
    if (!date || !(date instanceof Date)) return '-';
    try {
        let day = String(date.getDate()).padStart(2, '0');
        let month = String(date.getMonth() + 1).padStart(2, '0');
        let year = date.getFullYear();
        return `${day}-${month}-${year}`;
    } catch (e) {
        console.error("Error formatting date:", date, e);
        return '-';
    }
}

function calculateNextDueDate(startDate, mode) {
    // यह फंक्शन पहले जैसा ही है
    if (!(startDate instanceof Date) || !mode) return null;
    let nextDate = new Date(startDate);
    try {
        switch (mode.toLowerCase()) {
            case 'yearly': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
            case 'half-yearly': nextDate.setMonth(nextDate.getMonth() + 6); break;
            case 'quarterly': nextDate.setMonth(nextDate.getMonth() + 3); break;
            case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
            default: console.warn("Unknown payment mode:", mode); return null;
        }
        return nextDate;
    } catch (e) { console.error("Error calculating next due date:", e); return null; }
}

// --- फिल्टर/सॉर्ट हैंडलर्स ---
function handleLicSearchInput() {
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
    applyLicFiltersAndRender(); // Re-apply filters and sorting
}

function clearLicFilters() {
    if(licSearchInput) licSearchInput.value = '';
    if(licStatusFilter) licStatusFilter.value = ''; // Reset status filter
    if(sortLicSelect) sortLicSelect.value = 'createdAt_desc';
    currentLicSortField = 'createdAt';
    currentLicSortDirection = 'desc';
    applyLicFiltersAndRender(); // Re-apply default filters/sort
}

// --- सुनिश्चित करें कि पेज लोड होने पर इनिशियलाइज़ेशन हो ---
// Initialization is called via the onAuthStateChanged listener in the HTML head.