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
        console.error("User object not passed to initializeLicPage! Cannot initialize.");
        // Optionally display an error message to the user on the page
        // document.body.innerHTML = "<h1>Error: User information missing. Please login again.</h1>";
        return;
    }
    currentUserId = user.uid; // Store the user ID
    console.log("Current User ID:", currentUserId);

    // DOM एलिमेंट्स प्राप्त करें (Ensure elements exist)
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

     // Check if all essential elements were found
     if (!licPolicyTableBody || !reminderList || !policyModal || !policyForm || !taskList) {
         console.error("One or more essential DOM elements not found! Check HTML IDs.");
         alert("Application Error: Page structure is incorrect. Please contact support.");
         return; // Stop initialization if critical elements are missing
     }


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
    displayReminders(); // Load initial reminders (can be combined with listener if preferred)
    console.log("LIC Management Page Initialized Successfully.");
}

// --- Firestore Listeners ---
function listenForPolicies() {
    if (unsubscribePolicies) unsubscribePolicies(); // Stop previous listener
    if (!db || !currentUserId) {
        console.error("DB or UserID not available for policies listener.");
        if(licPolicyTableBody) licPolicyTableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: red;">Error: Cannot load policies (DB/User Issue).</td></tr>`;
        return;
    }

    console.log(`Setting up policies listener for agentId: ${currentUserId}`);
    const policiesRef = collection(db, "licCustomers");
    // Query policies only for the current logged-in user
    const q = query(policiesRef, where("agentId", "==", currentUserId)); // Filter by agentId

    unsubscribePolicies = onSnapshot(q, (snapshot) => {
        console.log(`Policies snapshot received: ${snapshot.docs.length} docs.`);
        allPoliciesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        applyLicFiltersAndRender(); // Render table when data changes
    }, (error) => {
        console.error("Error listening to policies:", error);
        // Provide more specific error feedback based on error code if possible
        let errorMsg = `Error loading policy data.`;
        if (error.code === 'permission-denied') {
             errorMsg = "Error: You don't have permission to view policies. Please check Firestore rules.";
        } else if (error.code === 'unauthenticated') {
             errorMsg = "Error: Authentication issue. Please login again.";
        } else if (error.code === 'unavailable') {
             errorMsg = "Error: Database is temporarily unavailable. Please try again later.";
        } else {
             errorMsg += ` (${error.code || error.message})`;
        }
        if(licPolicyTableBody) licPolicyTableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: red;">${errorMsg}</td></tr>`; // Updated colspan
    });
}

function listenForTasks() {
    if (unsubscribeTasks) unsubscribeTasks(); // Stop previous listener
    if (!db || !currentUserId) {
         console.error("DB or UserID not available for tasks listener.");
         if(taskList) taskList.innerHTML = `<li class="loading-tasks" style="color: red;">Error: Cannot load tasks (DB/User Issue).</li>`;
         return;
     }

    console.log(`Setting up tasks listener for agentId: ${currentUserId}`);
    const tasksRef = collection(db, "tasks");
    // Query tasks only for the current logged-in user, order by creation date
    const q = query(tasksRef, where("agentId", "==", currentUserId), orderBy("createdAt", "desc"));

    unsubscribeTasks = onSnapshot(q, (snapshot) => {
        console.log(`Tasks snapshot received: ${snapshot.docs.length} docs.`);
        const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTaskList(tasks); // Render task list when data changes
    }, (error) => {
        console.error("Error listening to tasks:", error);
        let errorMsg = `Error loading tasks.`;
         if (error.code === 'permission-denied') {
             errorMsg = "Error: You don't have permission to view tasks. Please check Firestore rules.";
         } else {
              errorMsg += ` (${error.code || error.message})`;
         }
        if(taskList) taskList.innerHTML = `<li class="loading-tasks" style="color: red;">${errorMsg}</li>`;
    });
}


// --- फ़िल्टर, सॉर्ट और रेंडर (पॉलिसी) ---
function applyLicFiltersAndRender() {
     if (!allPoliciesCache) {
          console.warn("Policy cache is not ready for filtering/rendering.");
          return;
      }
     console.log("Applying LIC filters and rendering...");
     const searchTerm = licSearchInput ? licSearchInput.value.trim().toLowerCase() : '';
     const selectedStatus = licStatusFilter ? licStatusFilter.value : ''; // Get selected status

     // 1. फ़िल्टर करें
     let filteredPolicies = allPoliciesCache.filter(policy => {
          if (!policy) return false; // Skip invalid entries

         // Status Filter
         const statusMatch = !selectedStatus || (policy.policyStatus && policy.policyStatus === selectedStatus);

         // Search Filter (only if status matches or no status selected)
         if (statusMatch) {
             // Apply search only if status filter passes (or is not set)
             if (!searchTerm) return true; // No search term, include if status matched

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
           // Handle Timestamps correctly
           if (valA && typeof valA.toDate === 'function') valA = valA.toDate();
           if (valB && typeof valB.toDate === 'function') valB = valB.toDate();
           // Handle specific field types for sorting
           if (currentLicSortField === 'premiumAmount' || currentLicSortField === 'sumAssured') {
               valA = Number(valA) || 0; valB = Number(valB) || 0;
           } else if (typeof valA === 'string') {
                valA = valA.toLowerCase();
           }
            if (typeof valB === 'string') {
                valB = valB.toLowerCase();
           }
          // Comparison logic
          let comparison = 0;
          if (valA > valB) { comparison = 1; }
          else if (valA < valB) { comparison = -1; }

          return currentLicSortDirection === 'desc' ? (comparison * -1) : comparison;
     });

     // 3. टेबल रेंडर करें
     renderPolicyTable(filteredPolicies);
}

// --- टेबल रेंडरिंग (पॉलिसी) ---
function renderPolicyTable(policies) {
    if (!licPolicyTableBody) {
        console.error("Cannot render policy table: table body element not found.");
        return;
    }
    licPolicyTableBody.innerHTML = ''; // Clear previous content
    if (!policies || policies.length === 0) {
        licPolicyTableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 20px;">No policies found matching criteria.</td></tr>`; // Updated colspan
        return;
    }
    policies.forEach(policy => {
        if (!policy || !policy.id) {
             console.warn("Skipping invalid policy data:", policy);
             return; // Skip rendering if policy data is invalid
        }
        const row = licPolicyTableBody.insertRow();
        row.setAttribute('data-id', policy.id); // Store Firestore ID for actions
        row.style.cursor = 'pointer'; // Indicate row is clickable

        row.insertCell().textContent = policy.policyNumber || '-';
        row.insertCell().textContent = policy.customerName || 'N/A';
        row.insertCell().textContent = policy.mobileNo || '-';
        row.insertCell().textContent = policy.plan || '-';
        row.insertCell().textContent = policy.premiumAmount ? `₹ ${policy.premiumAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
        row.insertCell().textContent = policy.modeOfPayment || '-';
        row.insertCell().textContent = policy.nextInstallmentDate?.toDate ? formatDate(policy.nextInstallmentDate.toDate()) : '-';
        // Status Badge
        const statusCell = row.insertCell();
        const statusBadge = document.createElement('span');
        statusBadge.className = `status-badge status-${(policy.policyStatus || 'unknown').toLowerCase()}`;
        statusBadge.textContent = policy.policyStatus || 'Unknown';
        statusCell.appendChild(statusBadge);
        // NACH Status
        row.insertCell().textContent = policy.nachStatus || '-';

        // एक्शन बटन सेल
        const actionCell = row.insertCell();
        actionCell.classList.add('action-buttons');
        actionCell.style.whiteSpace = 'nowrap'; // Prevent buttons wrapping

        // Edit बटन
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.title = "Edit Policy";
        editBtn.classList.add('button', 'edit-button');
        editBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent row click when button is clicked
            openPolicyModal(policy.id, policy);
        };
        actionCell.appendChild(editBtn);

        // Delete बटन
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.title = "Delete Policy";
        deleteBtn.classList.add('button', 'delete-button');
        deleteBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent row click
            handleDeletePolicy(policy.id, policy.policyNumber);
        };
        actionCell.appendChild(deleteBtn);

        // Add row click listener to open edit modal as well
        row.addEventListener('click', () => openPolicyModal(policy.id, policy));
    });
}

// --- Modal खोलना/बंद करना ---
function openPolicyModal(policyId = null, data = {}) {
    if (!policyModal || !policyForm) {
         console.error("Cannot open policy modal: Modal or form element not found.");
         return;
    }
    policyForm.reset(); // Clear previous form data
    editPolicyId.value = policyId || ''; // Set ID for editing or clear for adding

    if (policyId && data) {
        // --- एडिट मोड ---
        if(policyModalTitle) policyModalTitle.innerHTML = '<i class="fas fa-edit"></i> Edit Policy Details';
        // Populate form (use helper function or inline)
        populatePolicyForm(data);
    } else {
        // --- ऐड मोड ---
       if(policyModalTitle) policyModalTitle.innerHTML = '<i class="fas fa-file-contract"></i> Add New Policy';
        // Set defaults if needed
         if(policyStatus) policyStatus.value = 'Active';
         if(nachStatus) nachStatus.value = 'No';
         // Clear date fields that might be auto-calculated or required
         const nextInstallmentDateInput = document.getElementById('nextInstallmentDate');
         if (nextInstallmentDateInput) nextInstallmentDateInput.value = '';
    }
    policyModal.classList.add('active'); // Show the modal
}

function populatePolicyForm(data) {
    // Helper to fill form fields during edit
    if (!data) return;
    const customerNameInput = document.getElementById('customerName');
    const fatherNameInput = document.getElementById('fatherName');
    const mobileNoInput = document.getElementById('mobileNo');
    const dobInput = document.getElementById('dob');
    const addressInput = document.getElementById('address');
    const policyNumberInput = document.getElementById('policyNumber');
    const planInput = document.getElementById('plan');
    const sumAssuredInput = document.getElementById('sumAssured');
    const policyTermInput = document.getElementById('policyTerm');
    const issuanceDateInput = document.getElementById('issuanceDate');
    const modeOfPaymentInput = document.getElementById('modeOfPayment');
    const premiumAmountInput = document.getElementById('premiumAmount');
    const nextInstallmentDateInput = document.getElementById('nextInstallmentDate');
    const maturityDateInput = document.getElementById('maturityDate');
    const policyStatusSelect = document.getElementById('policyStatus');
    const nachStatusSelect = document.getElementById('nachStatus');

    if (customerNameInput) customerNameInput.value = data.customerName || '';
    if (fatherNameInput) fatherNameInput.value = data.fatherName || '';
    if (mobileNoInput) mobileNoInput.value = data.mobileNo || '';
    if (dobInput) dobInput.value = data.dob?.toDate ? data.dob.toDate().toISOString().split('T')[0] : '';
    if (addressInput) addressInput.value = data.address || '';
    if (policyNumberInput) policyNumberInput.value = data.policyNumber || '';
    if (planInput) planInput.value = data.plan || '';
    if (sumAssuredInput) sumAssuredInput.value = data.sumAssured || '';
    if (policyTermInput) policyTermInput.value = data.policyTerm || '';
    if (issuanceDateInput) issuanceDateInput.value = data.issuanceDate?.toDate ? data.issuanceDate.toDate().toISOString().split('T')[0] : '';
    if (modeOfPaymentInput) modeOfPaymentInput.value = data.modeOfPayment || '';
    if (premiumAmountInput) premiumAmountInput.value = data.premiumAmount || '';
    if (nextInstallmentDateInput) nextInstallmentDateInput.value = data.nextInstallmentDate?.toDate ? data.nextInstallmentDate.toDate().toISOString().split('T')[0] : '';
    if (maturityDateInput) maturityDateInput.value = data.maturityDate?.toDate ? data.maturityDate.toDate().toISOString().split('T')[0] : '';
    if (policyStatusSelect) policyStatusSelect.value = data.policyStatus || 'Active';
    if (nachStatusSelect) nachStatusSelect.value = data.nachStatus || 'No';
}


function closePolicyModal() {
    if (policyModal) policyModal.classList.remove('active');
}

// --- पॉलिसी सेव/अपडेट करना ---
async function handleSavePolicy(event) {
    event.preventDefault(); // Prevent default form submission
    if (!db || !currentUserId) {
         alert("Error: Database connection or user authentication is missing. Cannot save.");
         return;
    }

    const policyId = editPolicyId.value; // Get ID from hidden input
    const isEditing = !!policyId;
    console.log(isEditing ? `Attempting to update policy: ${policyId}` : "Attempting to add new policy");

    // --- Get form data (Use helper or inline) ---
    const formData = getPolicyFormData();
    if (!formData) return; // Exit if validation failed within getPolicyFormData

    // Add agentId and timestamps
    formData.agentId = currentUserId;
    formData.updatedAt = serverTimestamp();

    // --- Disable button, show spinner ---
    if(savePolicyBtn) {
         savePolicyBtn.disabled = true;
         savePolicyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    // --- Save/Update Logic ---
    try {
        if (isEditing) {
            // अपडेट
            const policyRef = doc(db, "licCustomers", policyId);
            // Ensure createdAt is not overwritten on update
            delete formData.createdAt;
            await updateDoc(policyRef, formData);
            console.log("Policy updated successfully:", policyId);
            alert("Policy updated successfully!"); // Use alerts or a toast notification system
        } else {
            // ऐड
            formData.createdAt = serverTimestamp(); // Add createdAt only for new documents
            const docRef = await addDoc(collection(db, "licCustomers"), formData);
            console.log("New policy added successfully with ID:", docRef.id);
            alert("New policy added successfully!");
        }
        closePolicyModal();
        displayReminders(); // Refresh reminders list (optional, listener might handle it)

    } catch (error) {
        console.error("Error saving policy:", error);
        alert(`Error saving policy: ${error.message}`);
    } finally {
        // --- Restore button state ---
       if(savePolicyBtn) {
            savePolicyBtn.disabled = false;
            // Restore original text based on mode
            savePolicyBtn.innerHTML = `<i class="fas fa-save"></i> ${isEditing ? 'Update Policy' : 'Save Policy'}`;
       }
    }
}

function getPolicyFormData() {
    // Helper to get and validate form data
     const formData = {
        customerName: document.getElementById('customerName')?.value.trim(),
        fatherName: document.getElementById('fatherName')?.value.trim(),
        mobileNo: document.getElementById('mobileNo')?.value.trim(),
        dob: document.getElementById('dob')?.value ? Timestamp.fromDate(new Date(document.getElementById('dob').value)) : null,
        address: document.getElementById('address')?.value.trim(),
        policyNumber: document.getElementById('policyNumber')?.value.trim(),
        plan: document.getElementById('plan')?.value.trim(),
        sumAssured: Number(document.getElementById('sumAssured')?.value) || null, // Use null if invalid/empty
        policyTerm: document.getElementById('policyTerm')?.value.trim(),
        issuanceDate: document.getElementById('issuanceDate')?.value ? Timestamp.fromDate(new Date(document.getElementById('issuanceDate').value + 'T00:00:00Z')) : null,
        modeOfPayment: document.getElementById('modeOfPayment')?.value,
        premiumAmount: parseFloat(document.getElementById('premiumAmount')?.value) || null,
        maturityDate: document.getElementById('maturityDate')?.value ? Timestamp.fromDate(new Date(document.getElementById('maturityDate').value)) : null,
        policyStatus: document.getElementById('policyStatus')?.value || 'Active',
        nachStatus: document.getElementById('nachStatus')?.value || 'No',
    };

     // Basic Validation
     if (!formData.customerName || !formData.mobileNo || !formData.policyNumber || !formData.issuanceDate || !formData.modeOfPayment || !formData.premiumAmount) {
        alert("Please fill all required (*) fields: Customer Name, Mobile No, Policy Number, Issuance Date, Mode of Payment, Premium Amount.");
        return null; // Indicate validation failure
    }
     if (formData.mobileNo && !/^\d{10}$/.test(formData.mobileNo)) {
         alert("Please enter a valid 10-digit Mobile Number.");
         return null;
     }
     // Premium Amount must be positive
      if (formData.premiumAmount <= 0) {
         alert("Premium Amount must be a positive number.");
         return null;
     }


     // --- Handle Next Installment Date ---
     const isEditing = !!document.getElementById('editPolicyId')?.value;
     let nextDateInput = document.getElementById('nextInstallmentDate')?.value;

     if (nextDateInput) {
          // If user provided a date, use it (convert to Timestamp)
          formData.nextInstallmentDate = Timestamp.fromDate(new Date(nextDateInput + 'T00:00:00Z'));
     } else if (!isEditing && formData.issuanceDate && formData.modeOfPayment) {
          // If adding new AND user didn't provide date, try calculating
          const calculatedNextDate = calculateNextDueDate(formData.issuanceDate.toDate(), formData.modeOfPayment);
          if (calculatedNextDate) {
               formData.nextInstallmentDate = Timestamp.fromDate(calculatedNextDate);
               console.log("Calculated next due date:", calculatedNextDate);
          } else {
               alert("Could not calculate next installment date automatically based on mode. Please enter it manually.");
               return null; // Stop saving if calculation failed and it's required
          }
     } else if (!nextDateInput) {
           // If date is still missing (e.g., editing and cleared, or calculation failed) - it's required
           alert("Next Installment Date is required. Please enter or calculate it.");
           return null;
     }

     return formData; // Return valid data
}


// --- पॉलिसी डिलीट करना ---
async function handleDeletePolicy(policyId, policyNumber) {
    if (!db) { alert("Database not ready. Cannot delete."); return; }
    if (!policyId) { alert("Error: Policy ID missing. Cannot delete."); return; }

    // Use a more robust confirmation, maybe a modal in future
    if (confirm(`Are you sure you want to delete policy "${policyNumber || policyId}"? This action cannot be undone.`)) {
        console.log(`Attempting to delete policy: ${policyId}`);
        try {
            const policyRef = doc(db, "licCustomers", policyId);
            await deleteDoc(policyRef);
            console.log(`Policy ${policyId} deleted successfully.`);
            alert(`Policy ${policyNumber || policyId} deleted successfully.`);
            // Listener should automatically update the table.
            // Optionally refresh reminders immediately if needed.
             displayReminders();
        } catch (error) {
            console.error("Error deleting policy:", error);
            alert(`Error deleting policy: ${error.message}`);
        }
    }
}

// --- रिमाइंडर फंक्शन ---
async function displayReminders() {
    // Fetch reminders for the next X days
    if (!db || !reminderList || !currentUserId) {
         console.warn("Cannot display reminders: DB, list element, or UserID missing.");
         if(reminderList) reminderList.innerHTML = '<li>Cannot load reminders (DB/User Issue).</li>';
         return;
     }
    reminderList.innerHTML = '<li class="loading-reminder">Loading reminders...</li>';

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today
        const reminderDays = 15; // Days ahead to check
        const reminderEndDate = new Date(today);
        reminderEndDate.setDate(today.getDate() + reminderDays);

        const todayTimestamp = Timestamp.fromDate(today);
        const endTimestamp = Timestamp.fromDate(reminderEndDate);

        console.log(`Fetching reminders between ${todayTimestamp.toDate()} and ${endTimestamp.toDate()} for agent ${currentUserId}`);

        const reminderQuery = query(collection(db, "licCustomers"),
                                 where("agentId", "==", currentUserId), // Filter by agent
                                 where("policyStatus", "in", ["Active", "Lapsed"]), // Show for Active/Lapsed
                                 where("nextInstallmentDate", ">=", todayTimestamp),
                                 where("nextInstallmentDate", "<=", endTimestamp),
                                 orderBy("nextInstallmentDate")); // Order by due date

        // Use getDocs for a one-time fetch for the reminder list
        const querySnapshot = await getDocs(reminderQuery);
        reminderList.innerHTML = ''; // Clear loading/previous list

        if (querySnapshot.empty) {
            console.log("No upcoming installments found.");
            reminderList.innerHTML = '<li>No upcoming installments in the next ' + reminderDays + ' days.</li>';
            return;
        }

        console.log(`Found ${querySnapshot.size} upcoming installments.`);
        querySnapshot.forEach(docSnap => {
            const policy = { id: docSnap.id, ...docSnap.data() };
            const li = document.createElement('li');
            li.setAttribute('data-doc-id', policy.id); // Store ID

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'reminder-checkbox';
            // Add functionality here if checkbox should do something (like update policy)
            // For now, it just toggles visibility via CSS/JS

            const span = document.createElement('span');
             span.innerHTML = `Policy: <strong>${policy.policyNumber || 'N/A'}</strong> - ${policy.customerName || 'N/A'} (₹ ${policy.premiumAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}) Due: <strong>${formatDate(policy.nextInstallmentDate?.toDate())}</strong>`;


            li.appendChild(checkbox);
            li.appendChild(span);
            reminderList.appendChild(li);
        });

    } catch (error) {
        console.error("Error fetching reminders:", error);
        reminderList.innerHTML = '<li style="color: red;">Error loading reminders. Please try again.</li>';
    }
}

// --- रिमाइंडर चेकबॉक्स हैंडलर ---
function handleReminderCheckboxChange(event) {
    // This function currently just hides the item visually
    // TODO: Implement logic if checking should update the policy (e.g., mark as paid, update next date)
    if (event.target.classList.contains('reminder-checkbox')) {
        const checkbox = event.target;
        const listItem = checkbox.closest('li'); // Get the parent <li>
        if (checkbox.checked && listItem) {
            listItem.classList.add('hidden-reminder'); // Add class to hide (CSS handles display:none)
            console.log(`Reminder visually hidden for policy ID: ${listItem.dataset.docId}`);
        } else if (listItem) {
             listItem.classList.remove('hidden-reminder'); // Remove class to show again
             console.log(`Reminder visually shown again for policy ID: ${listItem.dataset.docId}`);
        }
    }
}


// --- टास्क मैनेजमेंट फंक्शन्स (Implemented) ---
async function handleAddTask() {
    if (!db || !currentUserId) { alert("Database/User issue. Cannot add task."); return; }
    const description = newTaskInput ? newTaskInput.value.trim() : '';
    const dueDate = newTaskDueDate ? newTaskDueDate.value : '';
    if (!description) {
        alert("Please enter task description.");
        return;
    }

    const taskData = {
        description: description,
        dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate + 'T00:00:00Z')) : null, // Ensure correct timestamp
        completed: false,
        createdAt: serverTimestamp(),
        agentId: currentUserId // Associate task with the logged-in agent
    };

    if(addTaskBtn) {
        addTaskBtn.disabled = true;
        addTaskBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    }

    try {
        const docRef = await addDoc(collection(db, "tasks"), taskData);
        console.log("Task added successfully with ID:", docRef.id);
        if(newTaskInput) newTaskInput.value = ''; // Clear input fields
        if(newTaskDueDate) newTaskDueDate.value = '';
        // Listener will automatically refresh the list
    } catch (error) {
        console.error("Error adding task:", error);
        alert("Failed to add task: " + error.message);
    } finally {
       if(addTaskBtn) {
            addTaskBtn.disabled = false;
            addTaskBtn.innerHTML = '<i class="fas fa-plus"></i> Add Task';
       }
    }
}

async function handleTaskCheckboxChange(event) {
     if (event.target.classList.contains('task-checkbox')) {
          const checkbox = event.target;
          const listItem = checkbox.closest('li');
          const taskId = listItem?.dataset.taskId;
          const isCompleted = checkbox.checked;

          if (taskId && db) {
               console.log(`Updating task ${taskId} completed status to: ${isCompleted}`);
               const taskRef = doc(db, "tasks", taskId);
               try {
                   // Optimistically update UI slightly? Or rely purely on listener.
                   // listItem.classList.toggle('completed-task', isCompleted); // Example optimistic UI update
                   await updateDoc(taskRef, { completed: isCompleted });
                   console.log(`Task ${taskId} status updated successfully in Firestore.`);
                   // Listener will handle final UI update to ensure consistency
               } catch (error) {
                   console.error("Error updating task status:", error);
                   alert("Failed to update task status.");
                   checkbox.checked = !isCompleted; // Revert checkbox on error
                   // Revert optimistic UI update if implemented:
                   // listItem.classList.toggle('completed-task', !isCompleted);
                }
          }
     }
}

async function handleTaskDeleteClick(event) {
    const deleteButton = event.target.closest('.delete-task-btn'); // Use closest to get button even if icon is clicked
    if (deleteButton) {
         const listItem = deleteButton.closest('li');
         const taskId = listItem?.dataset.taskId;

         if (taskId && db && confirm("Are you sure you want to delete this task?")) {
              console.log("Deleting task:", taskId);
              // Optionally disable button/show spinner here
              try {
                   await deleteDoc(doc(db, "tasks", taskId));
                   console.log("Task deleted successfully from Firestore");
                   // Listener will automatically remove it from UI.
                   // No need for listItem.remove() if listener is working.
              } catch (error) {
                   console.error("Error deleting task:", error);
                   alert("Failed to delete task.");
                   // Re-enable button/hide spinner if implemented
              }
         }
    }
}

function renderTaskList(tasks) {
    if (!taskList) {
         console.error("Cannot render task list: list element not found.");
         return;
     }
    taskList.innerHTML = ''; // Clear existing list
    if (!tasks || tasks.length === 0) {
        taskList.innerHTML = '<li class="loading-tasks">No tasks found.</li>';
        return;
    }

    tasks.forEach(task => {
         if (!task || !task.id) {
             console.warn("Skipping invalid task data:", task);
             return; // Skip rendering if task data is invalid
        }
        const li = document.createElement('li');
        li.setAttribute('data-task-id', task.id);
        li.classList.toggle('completed-task', task.completed); // Apply class if completed

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox';
        checkbox.checked = task.completed;

        const span = document.createElement('span');
        let taskText = task.description || '[No Description]';
        if (task.dueDate?.toDate) {
            // Format due date
            taskText += ` (Due: ${formatDate(task.dueDate.toDate())})`;
        }
        span.textContent = taskText;
        // Style is handled by the 'completed-task' class in CSS

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.className = 'button delete-task-btn'; // Use general button class + specific
        deleteBtn.title = 'Delete Task';
        deleteBtn.setAttribute('aria-label', 'Delete Task'); // Accessibility

        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(deleteBtn);
        taskList.appendChild(li);
    });
}


// --- हेल्पर फंक्शन्स ---
function formatDate(date) {
    // Simple DD-MM-YYYY format
    if (!date || !(date instanceof Date) || isNaN(date)) return '-'; // Check for invalid date
    try {
        let day = String(date.getDate()).padStart(2, '0');
        let month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
        let year = date.getFullYear();
        // Basic check for sensible year
        if (year < 1900 || year > 2100) return '-';
        return `${day}-${month}-${year}`;
    } catch (e) {
        console.error("Error formatting date:", date, e);
        return '-'; // Return placeholder on error
    }
}

function calculateNextDueDate(startDate, mode) {
    // Calculates next date based on mode
    if (!(startDate instanceof Date) || isNaN(startDate) || !mode) return null;
    let nextDate = new Date(startDate.getTime()); // Clone the date to avoid modifying original
    try {
        switch (mode.toLowerCase()) {
            case 'yearly': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
            case 'half-yearly': nextDate.setMonth(nextDate.getMonth() + 6); break;
            case 'quarterly': nextDate.setMonth(nextDate.getMonth() + 3); break;
            case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
            default:
                console.warn("Unknown payment mode for date calculation:", mode);
                return null;
        }
        // Check if the calculated date is valid
        if (isNaN(nextDate)) {
             console.error("Calculated next due date is invalid for:", startDate, mode);
             return null;
        }
        return nextDate;
    } catch (e) {
        console.error("Error calculating next due date:", e);
        return null;
    }
}

// --- फिल्टर/सॉर्ट हैंडलर्स ---
function handleLicSearchInput() {
    clearTimeout(searchDebounceTimerLic);
    searchDebounceTimerLic = setTimeout(() => {
        applyLicFiltersAndRender(); // Call the main filter/render function
    }, 350); // Debounce time
}

function handleLicSortChange() {
    if (!sortLicSelect) return;
    const [field, direction] = sortLicSelect.value.split('_');
     if (field && direction) {
        currentLicSortField = field;
        currentLicSortDirection = direction;
        console.log(`Sorting changed to: ${currentLicSortField} ${currentLicSortDirection}`);
        applyLicFiltersAndRender(); // Re-apply filters and sorting
    }
}

function clearLicFilters() {
    console.log("Clearing filters...");
    if(licSearchInput) licSearchInput.value = '';
    if(licStatusFilter) licStatusFilter.value = ''; // Reset status dropdown
    if(sortLicSelect) sortLicSelect.value = 'createdAt_desc'; // Reset sort dropdown to default

    // Reset internal state variables
    currentLicSortField = 'createdAt';
    currentLicSortDirection = 'desc';

    applyLicFiltersAndRender(); // Re-apply default filters/sort
}

// --- Make initialization function globally accessible if needed ---
// window.initializeLicPage = initializeLicPage;

console.log("lic_management.js script loaded and parsed.");

// --- End of lic_management.js ---