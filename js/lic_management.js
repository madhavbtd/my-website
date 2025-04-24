// js/lic_management.js
// Updated for Phase 1 & Phase 2 Features

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
    addNewPolicyBtn = document.getElementById('addNewPolicyBtn');
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

    // --- इवेंट लिस्टनर्स जोड़ें ---
    if (addNewPolicyBtn) addNewPolicyBtn.addEventListener('click', () => openPolicyModal()); // Add mode
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
    if (addTaskBtn) addTaskBtn.addEventListener('click', handleAddTask);
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

    // --- Phase 2: Load initial dashboard data (after policies might be loaded) ---
    // We call loadDashboardData within the policy listener now to ensure data is available.
}

// --- Firestore Listener (Policies) ---
function listenForPolicies() {
    if (!db) { console.error("DB not initialized"); return; }
    if (unsubscribePolicies) unsubscribePolicies();

    const policiesRef = collection(db, "licCustomers");
    const q = query(policiesRef); // No initial sort needed here

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
     // console.log("Applying LIC filters and rendering..."); // Logged too often, make less verbose

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


// --- Modal खोलना/बंद करना (Policy Add/Edit) --- (No changes)
function openPolicyModal(policyId = null, data = {}) { /* ... जस का तस ... */ }
function closePolicyModal() { /* ... जस का तस ... */ }

// --- पॉलिसी सेव/अपडेट करना --- (No changes)
async function handleSavePolicy(event) { /* ... जस का तस ... */ }

// --- पॉलिसी डिलीट करना --- (No changes)
async function handleDeletePolicy(policyId, policyNumber) { /* ... जस का तस ... */ }

// --- प्रीमियम भुगतान मार्क करना (Phase 1) --- (No changes)
async function handleMarkPaid(policyId, policyData) { /* ... जस का तस ... */ }

// --- रिमाइंडर फंक्शन --- (No changes)
async function displayReminders() { /* ... जस का तस ... */ }
function handleReminderCheckboxChange(event) { /* ... जस का तस ... */ }

// --- Task Management Functions (Phase 1 Fix) --- (No changes)
function renderTaskList(taskDocs) { /* ... जस का तस ... */ }
async function handleAddTask() { /* ... जस का तस ... */ }
async function handleTaskCheckboxChange(event) { /* ... जस का तस ... */ }
async function handleTaskActions(event) { /* ... जस का तस ... */ }


// --- ****** START: Phase 2 Functions ****** ---

// --- Load Dashboard Data ---
function loadDashboardData() {
    if (!dbTotalPoliciesEl || !allPoliciesCache) return; // Ensure elements & cache exist

    const totalPolicies = allPoliciesCache.length;
    const activePolicies = allPoliciesCache.filter(p => p.policyStatus === 'Active').length;
    const lapsedPolicies = allPoliciesCache.filter(p => p.policyStatus === 'Lapsed').length;

    // Upcoming Premiums (Next 30 days, Active/Lapsed)
    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    const upcomingPremiumPolicies = allPoliciesCache.filter(p => {
        const nextDate = p.nextInstallmentDate?.toDate();
        return nextDate && nextDate >= now && nextDate <= thirtyDaysFromNow && ['Active', 'Lapsed'].includes(p.policyStatus);
    });
    const totalUpcomingPremium = upcomingPremiumPolicies.reduce((sum, p) => sum + (Number(p.premiumAmount) || 0), 0);

    // Upcoming Maturities (Next 90 days)
    const ninetyDaysFromNow = new Date(now);
    ninetyDaysFromNow.setDate(now.getDate() + 90);
    const upcomingMaturityPolicies = allPoliciesCache.filter(p => {
         const maturityDate = p.maturityDate?.toDate();
         return maturityDate && maturityDate >= now && maturityDate <= ninetyDaysFromNow && p.policyStatus !== 'Matured'; // Don't count already matured
     }).length;


    // Update Dashboard UI
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

    // Store the identifier for adding logs later
    currentOpenClientId = policyId; // Use policyId as identifier for logs for now

    // 1. Clear previous data & Show loading states
    clientDetailNameEl.textContent = customerName || 'Client Details';
    clientDetailMobileEl.textContent = 'Loading...';
    clientDetailDobEl.textContent = 'Loading...';
    clientDetailFatherNameEl.textContent = 'Loading...';
    clientDetailAddressEl.textContent = 'Loading...';
    clientPoliciesListEl.innerHTML = '<p>Loading policies...</p>';
    communicationLogListEl.innerHTML = '<p>Loading communication logs...</p>';
    newLogNoteEl.value = ''; // Clear log input

    // Reset tabs to default (e.g., Policies active)
    openDetailTab(null, 'clientPolicies');

    // Show the modal
    clientDetailModal.classList.add('active');

    // 2. Fetch data for the primary policy (to get client details)
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
            // Use the potentially more accurate name from the document
            clientDetailNameEl.textContent = clientData.customerName || customerName;
        } else {
            console.error("Primary policy not found for details:", policyId);
            clientDetailMobileEl.textContent = 'Not Found';
            // Handle other fields similarly
        }
    } catch (error) {
        console.error("Error fetching primary policy details:", error);
        clientDetailMobileEl.textContent = 'Error';
         // Handle other fields similarly
    }

    // 3. Find and display all policies for this customer
    // IMPORTANT: Matching by name is unreliable. Ideally, add a unique customerId field to policies.
    // Using name matching for now:
    const customerPolicies = allPoliciesCache.filter(p => p.customerName === (clientData?.customerName || customerName));
    renderClientPolicies(customerPolicies);

    // 4. Fetch and display communication logs
    // Assume logs are in a 'logs' collection and linked by policyId
    await loadCommunicationLogs(policyId);

}

// --- Render Policies in Client Detail View ---
function renderClientPolicies(policies) {
    if (!clientPoliciesListEl) return;
    clientPoliciesListEl.innerHTML = ''; // Clear previous

    if (!policies || policies.length === 0) {
        clientPoliciesListEl.innerHTML = '<p>No policies found for this customer.</p>';
        return;
    }

    // Create a simple list or a mini-table
    const ul = document.createElement('ul');
    ul.style.listStyle = 'none';
    ul.style.paddingLeft = '0';

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
        // Optional: Add edit/pay buttons here too?
        ul.appendChild(li);
    });
    clientPoliciesListEl.appendChild(ul);
}


// --- Load Communication Logs for Client/Policy ---
async function loadCommunicationLogs(identifier) { // Use policyId or customerId
    if (!communicationLogListEl || !db) return;
    communicationLogListEl.innerHTML = '<p>Loading logs...</p>';

    try {
        // Query logs collection - **ADJUST THIS QUERY BASED ON YOUR LOGS STRUCTURE**
        // Example: Assuming 'logs' collection with 'policyId' field matching the client identifier
        const logQuery = query(collection(db, "logs"), where("policyId", "==", identifier), orderBy("timestamp", "desc"));
        const logSnapshot = await getDocs(logQuery);

        if (logSnapshot.empty) {
            communicationLogListEl.innerHTML = '<p>No communication logs found.</p>';
        } else {
            communicationLogListEl.innerHTML = ''; // Clear loading
            logSnapshot.forEach(docSnap => {
                const log = docSnap.data();
                const p = document.createElement('p');
                const timestamp = log.timestamp?.toDate ? formatDate(log.timestamp.toDate()) : 'N/A';
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
        // Save to 'logs' collection - **ADJUST STRUCTURE AS NEEDED**
        await addDoc(collection(db, "logs"), {
            policyId: currentOpenClientId, // Link log to the currently viewed policy/client context
            note: note,
            timestamp: serverTimestamp()
        });
        newLogNoteEl.value = ''; // Clear input
        // Reload logs for the current client
        await loadCommunicationLogs(currentOpenClientId);
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
        currentOpenClientId = null; // Clear context when closing
    }
}

// --- Handle Tab Switching in Client Detail View ---
window.openDetailTab = function(evt, tabName) { // Make it global for HTML onclick
    let i, tabcontent, tablinks;
    const detailView = document.getElementById('clientDetailView');
    if (!detailView) return;

    // Get all elements with class="tab-content" inside the detail view and hide them
    tabcontent = detailView.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
        tabcontent[i].classList.remove("active");
    }

    // Get all elements with class="tab-button" inside the detail view and remove the class "active"
    tablinks = detailView.getElementsByClassName("tab-button");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("active");
    }

    // Show the current tab, and add an "active" class to the button that opened the tab
    const currentTab = document.getElementById(tabName);
    if (currentTab) {
        currentTab.style.display = "block";
        currentTab.classList.add("active");
    }
    // If called by button click, add active class to the button
    if (evt && evt.currentTarget) {
         evt.currentTarget.classList.add("active");
    } else {
        // If called programmatically (e.g., on open), find the corresponding button
        const defaultButton = Array.from(tablinks).find(btn => btn.getAttribute('onclick').includes(tabName));
        if (defaultButton) defaultButton.classList.add("active");
    }
}

// --- ****** END: Phase 2 Functions ****** ---


// --- हेल्पर फंक्शन्स ---
function formatDate(date) { /* ... जस का तस ... */ }
function calculateNextDueDate(startDate, mode) { /* ... जस का तस ... */ }

// --- फिल्टर/सॉर्ट हैंडलर्स ---
function handleLicFilterChange() { /* ... जस का तस ... */ }
function handleLicSortChange() { /* ... जस का तस ... */ }
function clearLicFilters() { /* ... जस का तस ... */ }

// --- एंड ऑफ़ फाइल ---