// js/lic_management.js

// --- सुनिश्चित करें कि ग्लोबल Firebase फंक्शन्स उपलब्ध हैं ---
const {
    db, collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp,
    query, where, orderBy, limit, Timestamp, runTransaction, onSnapshot // onSnapshot इस्तेमाल होगा
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
    newTaskInput, newTaskDueDate, addTaskBtn, taskList;


// --- ग्लोबल स्टेट ---
let currentLicSortField = 'createdAt';
let currentLicSortDirection = 'desc';
let unsubscribePolicies = null; // Firestore policy listener को बंद करने के लिए
let unsubscribeTasks = null; // Firestore task listener को बंद करने के लिए
let allPoliciesCache = []; // सभी पॉलिसियों का कैश
let searchDebounceTimerLic;


// --- पेज इनिशियलाइज़ेशन ---
window.initializeLicPage = function() { // Make it globally accessible
    console.log("Initializing LIC Management Page...");

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
    sortLicSelect = document.getElementById('sort-lic');
    clearLicFiltersBtn = document.getElementById('clearLicFiltersBtn');
    // Modal dropdowns
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
    addTaskBtn = document.getElementById('addTaskBtn');
    taskList = document.getElementById('taskList');


    // इवेंट लिस्टनर्स जोड़ें
    if (addNewPolicyBtn) addNewPolicyBtn.addEventListener('click', () => openPolicyModal()); // Add mode
    if (closePolicyModalBtn) closePolicyModalBtn.addEventListener('click', closePolicyModal);
    if (cancelPolicyBtn) cancelPolicyBtn.addEventListener('click', closePolicyModal);
    if (policyModal) policyModal.addEventListener('click', (e) => { if (e.target === policyModal) closePolicyModal(); });
    if (policyForm) policyForm.addEventListener('submit', handleSavePolicy);

    // Filter listeners
    if (licSearchInput) licSearchInput.addEventListener('input', handleLicFilterChange); // Use common handler
    if (licStatusFilter) licStatusFilter.addEventListener('change', handleLicFilterChange);
    if (licPlanFilter) licPlanFilter.addEventListener('input', handleLicFilterChange); // Use input for text filter
    if (licModeFilter) licModeFilter.addEventListener('change', handleLicFilterChange);
    if (licNachFilter) licNachFilter.addEventListener('change', handleLicFilterChange);

    if (sortLicSelect) sortLicSelect.addEventListener('change', handleLicSortChange);
    if (clearLicFiltersBtn) clearLicFiltersBtn.addEventListener('click', clearLicFilters);

    // Reminder Checkbox Listener (Event Delegation)
    if (reminderList) {
        reminderList.addEventListener('change', handleReminderCheckboxChange);
    }

    // Task Management Listeners
    if (addTaskBtn) addTaskBtn.addEventListener('click', handleAddTask);
    if (taskList) {
        taskList.addEventListener('change', handleTaskCheckboxChange); // For marking complete
        taskList.addEventListener('click', handleTaskActions); // For deleting tasks (using delegation)
    }

    // --- Firestore से डेटा सुनना शुरू करें ---
    listenForPolicies(); // Policies Load
    listenForTasks();   // Tasks Load (Phase 1 Fix)
    displayReminders(); // Reminders Load
}

// --- Firestore Listener (Policies) ---
function listenForPolicies() {
    if (!db) { console.error("DB not initialized"); return; }
    if (unsubscribePolicies) unsubscribePolicies(); // पुराना listener बंद करें

    const policiesRef = collection(db, "licCustomers"); // आपके कलेक्शन का नाम
    // Listener के लिए सरल क्वेरी, सॉर्टिंग/फिल्टरिंग क्लाइंट-साइड में होगी
    const q = query(policiesRef); // Remove initial sort from listener, apply in render

    console.log("Starting policy listener...");
    unsubscribePolicies = onSnapshot(q, (snapshot) => { // Use onSnapshot for real-time updates
        console.log(`Received ${snapshot.docs.length} policies.`);
        allPoliciesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        applyLicFiltersAndRender(); // डेटा आने पर टेबल रेंडर करें
        displayReminders(); // Update reminders whenever policies change
    }, (error) => {
        console.error("Error listening to policies:", error);
        if(licPolicyTableBody) licPolicyTableBody.innerHTML = `<tr><td colspan="9">Error loading policy data. Check console.</td></tr>`;
    });
}

// --- Firestore Listener (Tasks) --- Phase 1 Fix
function listenForTasks() {
    if (!db) { console.error("DB not initialized for tasks"); return; }
    if (unsubscribeTasks) unsubscribeTasks(); // पुराना listener बंद करें

    const tasksRef = collection(db, "tasks"); // Assume 'tasks' collection
    const q = query(tasksRef, orderBy("createdAt", "desc")); // Sort by creation time

    console.log("Starting task listener...");
    unsubscribeTasks = onSnapshot(q, (snapshot) => {
        console.log(`Received ${snapshot.docs.length} tasks.`);
        renderTaskList(snapshot.docs); // Render tasks directly
    }, (error) => {
        console.error("Error listening to tasks:", error);
        if(taskList) taskList.innerHTML = `<li class="error-tasks">Error loading tasks.</li>`;
    });
}


// --- फ़िल्टर, सॉर्ट और रेंडर (Policies) --- Updated for Phase 1 Filters
function applyLicFiltersAndRender() {
     if (!allPoliciesCache || !licPolicyTableBody) return;
     console.log("Applying LIC filters and rendering...");

     // Get filter values
     const searchTerm = licSearchInput ? licSearchInput.value.trim().toLowerCase() : '';
     const statusFilter = licStatusFilter ? licStatusFilter.value : '';
     const planFilter = licPlanFilter ? licPlanFilter.value.trim().toLowerCase() : '';
     const modeFilter = licModeFilter ? licModeFilter.value : '';
     const nachFilter = licNachFilter ? licNachFilter.value : '';

     // 1. फ़िल्टर करें
     let filteredPolicies = allPoliciesCache.filter(policy => {
         // Search Logic
         const nameMatch = (policy.customerName || '').toLowerCase().includes(searchTerm);
         const policyNoMatch = (policy.policyNumber || '').toLowerCase().includes(searchTerm);
         const mobileMatch = (policy.mobileNo || '').toLowerCase().includes(searchTerm);
         const searchMatch = searchTerm === '' || nameMatch || policyNoMatch || mobileMatch;

         // Status Filter Logic
         const statusMatch = statusFilter === '' || (policy.policyStatus || '').toLowerCase() === statusFilter.toLowerCase();

         // Plan Filter Logic (Case-insensitive contains)
         const planMatch = planFilter === '' || (policy.plan || '').toLowerCase().includes(planFilter);

         // Mode Filter Logic
         const modeMatch = modeFilter === '' || (policy.modeOfPayment || '') === modeFilter;

         // NACH Filter Logic
         const nachMatch = nachFilter === '' || (policy.nachStatus || '') === nachFilter;

         return searchMatch && statusMatch && planMatch && modeMatch && nachMatch;
     });

     // 2. सॉर्ट करें (वर्तमान सॉर्ट चयन के आधार पर)
     filteredPolicies.sort((a, b) => {
          let valA = a[currentLicSortField];
          let valB = b[currentLicSortField];

           // Handle Timestamps
           if (valA && typeof valA.toDate === 'function') valA = valA.toDate();
           if (valB && typeof valB.toDate === 'function') valB = valB.toDate();

           // Handle specific field types for comparison
           if (currentLicSortField === 'premiumAmount' || currentLicSortField === 'sumAssured') {
               valA = Number(valA) || 0;
               valB = Number(valB) || 0;
           } else if (currentLicSortField === 'customerName' || currentLicSortField === 'policyNumber') {
                valA = (valA || '').toLowerCase();
                valB = (valB || '').toLowerCase();
           } else if (valA instanceof Date && valB instanceof Date) {
               // Date comparison handled directly
           } else {
               // Default to string comparison
               valA = String(valA || '').toLowerCase();
               valB = String(valB || '').toLowerCase();
           }

          // Comparison logic
          let comparison = 0;
          if (valA > valB) comparison = 1;
          else if (valA < valB) comparison = -1;

          return currentLicSortDirection === 'desc' ? (comparison * -1) : comparison;
     });


     // 3. टेबल रेंडर करें
     renderPolicyTable(filteredPolicies);
}

// --- टेबल रेंडरिंग (Policies) --- Updated with Pay Button (Phase 1)
function renderPolicyTable(policies) {
    if (!licPolicyTableBody) return;
    licPolicyTableBody.innerHTML = ''; // टेबल खाली करें

    if (policies.length === 0) {
        licPolicyTableBody.innerHTML = `<tr><td colspan="9" style="text-align: center;">No policies found matching criteria.</td></tr>`;
        return;
    }

    policies.forEach(policy => {
        const row = licPolicyTableBody.insertRow();
        row.setAttribute('data-id', policy.id); // Firestore ID स्टोर करें

        // टेबल सेल्स में डेटा भरें
        row.insertCell().textContent = policy.policyNumber || '-';
        row.insertCell().textContent = policy.customerName || 'N/A';
        row.insertCell().textContent = policy.mobileNo || '-';
        row.insertCell().textContent = policy.plan || '-';
        row.insertCell().textContent = policy.premiumAmount ? `₹ ${Number(policy.premiumAmount).toFixed(2)}` : '-'; // Ensure number formatting
        row.insertCell().textContent = policy.modeOfPayment || '-';
        row.insertCell().textContent = policy.nextInstallmentDate?.toDate ? formatDate(policy.nextInstallmentDate.toDate()) : '-';
        row.insertCell().innerHTML = `<span class="status-badge status-${(policy.policyStatus || 'unknown').toLowerCase()}">${policy.policyStatus || 'Unknown'}</span>`; // स्टेटस के लिए बैज

        // --- एक्शन बटन सेल - Updated ---
        const actionCell = row.insertCell();
        actionCell.classList.add('action-buttons');

        // Edit बटन
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.title = "Edit Policy";
        editBtn.classList.add('button', 'edit-button');
        editBtn.onclick = (e) => { e.stopPropagation(); openPolicyModal(policy.id, policy); };
        actionCell.appendChild(editBtn);

        // --- Mark Paid बटन (Phase 1) ---
        const payBtn = document.createElement('button');
        payBtn.innerHTML = '<i class="fas fa-check-circle"></i>'; // Checkmark icon
        payBtn.title = "Mark Premium Paid & Update Due Date";
        payBtn.classList.add('button', 'pay-button'); // Add class for styling
        // Disable if policy is not Active or Lapsed, or no next date/mode
        payBtn.disabled = !['Active', 'Lapsed'].includes(policy.policyStatus) || !policy.nextInstallmentDate || !policy.modeOfPayment;
        payBtn.onclick = (e) => { e.stopPropagation(); handleMarkPaid(policy.id, policy); };
        actionCell.appendChild(payBtn);
        // --- End Mark Paid Button ---

        // Delete बटन
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.title = "Delete Policy";
        deleteBtn.classList.add('button', 'delete-button');
        deleteBtn.onclick = (e) => { e.stopPropagation(); handleDeletePolicy(policy.id, policy.policyNumber); };
        actionCell.appendChild(deleteBtn);

    });
}


// --- Modal खोलना/बंद करना --- (No major changes needed here)
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

// --- पॉलिसी सेव/अपडेट करना --- (No major changes needed here)
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
        // nextInstallmentDate handled below
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
          // New policy, but no date entered AND couldn't calculate (e.g., missing issuance date)
          alert("Please enter the first installment date or ensure issuance date and mode are set.");
          return;
     }
     // If editing and date is cleared, it remains null/undefined in formData, Firestore field might be deleted or ignored depending on updateDoc behavior / Firestore rules.
     // It's often better to require it during edit:
      else if (isEditing && !nextDateInput) {
           alert("Please provide the next installment date when editing.");
           return; // Or fetch existing value if needed
      }


    // --- सेव/अपडेट लॉजिक ---
    savePolicyBtn.disabled = true;
    savePolicyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        if (isEditing) {
            const policyRef = doc(db, "licCustomers", policyId);
            // Ensure createdAt is not overwritten if it exists
            delete formData.createdAt;
            await updateDoc(policyRef, formData);
            alert("Policy updated successfully!");
        } else {
            formData.createdAt = serverTimestamp(); // Add createdAt only for new docs
            await addDoc(collection(db, "licCustomers"), formData);
            alert("New policy added successfully!");
        }
        closePolicyModal();
        // Listener will refresh table and reminders automatically.

    } catch (error) {
        console.error("Error saving policy:", error);
        alert("Error saving policy: " + error.message);
    } finally {
        savePolicyBtn.disabled = false;
        savePolicyBtn.innerHTML = '<i class="fas fa-save"></i> Save Policy';
    }
}

// --- पॉलिसी डिलीट करना --- (No changes needed here)
async function handleDeletePolicy(policyId, policyNumber) {
    if (!db) { alert("Database not ready."); return; }
    if (confirm(`Are you sure you want to delete policy number "${policyNumber || policyId}"? This cannot be undone.`)) {
        try {
            await deleteDoc(doc(db, "licCustomers", policyId));
            alert(`Policy ${policyNumber || policyId} deleted successfully.`);
            // Listener will update table and reminders.
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

    // Calculate the *next* due date based on the *current* one
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
                lastPaymentDate: serverTimestamp(), // Optionally track last payment
                policyStatus: 'Active' // Optionally reactivate if it was Lapsed
            });
            alert(`Payment marked for policy ${policyNumber}. Next due date updated to ${formattedNewDate}.`);
            // Listener will refresh the table. You might want to manually trigger reminder refresh too.
            displayReminders();
        } catch (error) {
            console.error("Error marking payment:", error);
            alert("Error updating policy after marking payment: " + error.message);
        }
    }
}


// --- रिमाइंडर फंक्शन --- (No major changes needed here, but fetch might be slightly optimized)
async function displayReminders() {
    if (!db || !reminderList) return;
    reminderList.innerHTML = '<li class="loading-reminder">Loading reminders...</li>';

    try {
        const today = new Date(); today.setHours(0, 0, 0, 0); // Start of today
        const reminderDays = 15;
        const reminderEndDate = new Date(today);
        reminderEndDate.setDate(today.getDate() + reminderDays);

        const todayTimestamp = Timestamp.fromDate(today);
        const endTimestamp = Timestamp.fromDate(reminderEndDate);

        // Query Firestore directly for reminders
        const reminderQuery = query(collection(db, "licCustomers"),
                                 where("nextInstallmentDate", ">=", todayTimestamp),
                                 where("nextInstallmentDate", "<=", endTimestamp),
                                 where("policyStatus", "in", ["Active", "Lapsed"]), // Only show for active/lapsed
                                 orderBy("nextInstallmentDate"));

        const querySnapshot = await getDocs(reminderQuery);
        reminderList.innerHTML = ''; // Clear list

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

// --- रिमाइंडर चेकबॉक्स हैंडलर --- (No changes needed)
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
     taskList.innerHTML = ''; // Clear current list

     if (taskDocs.length === 0) {
         taskList.innerHTML = '<li>No tasks found.</li>';
         return;
     }

     taskDocs.forEach(doc => {
         const task = { id: doc.id, ...doc.data() };
         const li = document.createElement('li');
         li.setAttribute('data-task-id', task.id);
         li.classList.toggle('completed-task', task.completed); // Add class if completed

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
         deleteBtn.className = 'button delete-task-btn'; // Use button classes
         deleteBtn.title = 'Delete Task';
         // No onclick here, handled by delegation in handleTaskActions

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
        dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate + 'T00:00:00Z')) : null, // Ensure timestamp
        completed: false,
        createdAt: serverTimestamp()
    };

    addTaskBtn.disabled = true;
    addTaskBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

    try {
        // Firestore में 'tasks' कलेक्शन में सेव करें
        await addDoc(collection(db, "tasks"), taskData); // *** UNCOMMENTED ***
        // alert("Task added successfully!"); // Optional: Listener will update UI
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
                    // Update completed status in Firestore
                    await updateDoc(taskRef, { completed: isCompleted }); // *** UNCOMMENTED ***
                    // Listener will update the UI style
                    console.log(`Task ${taskId} status updated to: ${isCompleted}`);
               } catch (error) {
                    console.error("Error updating task status:", error);
                    alert("Failed to update task status.");
                    checkbox.checked = !isCompleted; // Revert on error
               }
          }
     }
}

// Handle Task Actions (Deletion using Event Delegation)
async function handleTaskActions(event) {
    // Check if the click was on a delete button or its icon
    const deleteButton = event.target.closest('.delete-task-btn');
    if (deleteButton) {
         const listItem = deleteButton.closest('li');
         const taskId = listItem?.dataset.taskId;

         if (taskId && db && confirm("Are you sure you want to delete this task?")) {
             const taskRef = doc(db, "tasks", taskId);
             try {
                  // Delete task from Firestore
                  await deleteDoc(taskRef); // *** UNCOMMENTED ***
                  // Listener will remove it from the UI.
                  console.log("Task deleted:", taskId);
             } catch (error) {
                  console.error("Error deleting task:", error);
                  alert("Failed to delete task.");
             }
         }
    }
}


// --- हेल्पर फंक्शन्स ---
function formatDate(date) {
    if (!date || !(date instanceof Date) || isNaN(date)) return '-'; // Added NaN check
    try {
        let day = String(date.getDate()).padStart(2, '0');
        let month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
        let year = date.getFullYear();
        return `${day}-${month}-${year}`;
    } catch (e) {
        console.error("Error formatting date:", date, e);
        return 'Invalid Date';
    }
}

// Calculate Next Due Date based on a GIVEN start date and mode
function calculateNextDueDate(startDate, mode) {
    if (!(startDate instanceof Date) || isNaN(startDate) || !mode) return null; // Added NaN check
    let nextDate = new Date(startDate);
    try {
        switch (mode.toLowerCase()) {
            case 'yearly':
                nextDate.setFullYear(nextDate.getFullYear() + 1);
                break;
            case 'half-yearly':
            case 'half yearly': // Handle variations
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
        // Check if the calculated date is valid
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
    // Debounce filtering to avoid excessive calls on input/change
    clearTimeout(searchDebounceTimerLic);
    searchDebounceTimerLic = setTimeout(() => {
        applyLicFiltersAndRender();
    }, 350); // Adjust delay as needed
}

function handleLicSortChange() {
    if (!sortLicSelect) return;
    const [field, direction] = sortLicSelect.value.split('_');
    currentLicSortField = field;
    currentLicSortDirection = direction;
    // Apply immediately on sort change
    applyLicFiltersAndRender();
}

function clearLicFilters() {
    if(licSearchInput) licSearchInput.value = '';
    if(licStatusFilter) licStatusFilter.value = ''; // Reset Status
    if(licPlanFilter) licPlanFilter.value = '';   // Reset Plan
    if(licModeFilter) licModeFilter.value = '';   // Reset Mode
    if(licNachFilter) licNachFilter.value = '';   // Reset NACH
    if(sortLicSelect) sortLicSelect.value = 'createdAt_desc'; // Reset Sort

    // Reset global sort state
    currentLicSortField = 'createdAt';
    currentLicSortDirection = 'desc';

    // Apply filters immediately
    applyLicFiltersAndRender();
}

// --- एंड ऑफ़ फाइल ---