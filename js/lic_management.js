// js/lic_management.js
// CORRECTED: Removed duplicate helper function declarations

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
    upcomingTaskListEl,
    // --- TEMPORARY CSV IMPORT ELEMENTS ---
    csvFileInput, importCsvBtn, importStatusEl;


// --- ग्लोबल स्टेट ---
let currentLicSortField = 'createdAt';
let currentLicSortDirection = 'desc';
let unsubscribePolicies = null; // Firestore policy listener
let unsubscribeTasks = null; // Firestore task listener
let allPoliciesCache = []; // सभी पॉलिसियों का कैश
let searchDebounceTimerLic;
let currentOpenClientId = null;


// --- पेज इनिशियलाइज़ेशन ---
window.initializeLicPage = function() { // Make it globally accessible
    console.log("Initializing LIC Management Page...");

    // --- DOM एलिमेंट्स प्राप्त करें ---
    // ... (सभी getElementById कॉल वैसे ही रहेंगे जैसे पिछले सही संस्करण में थे) ...
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
    csvFileInput = document.getElementById('csvFileInput');
    importCsvBtn = document.getElementById('importCsvBtn');
    importStatusEl = document.getElementById('importStatus');


    // --- डीबगिंग लॉग्स ---
    console.log('Debugging - Add New Policy Button Element:', addNewPolicyBtn);
    console.log('Debugging - Add Task Button Element:', addTaskBtn);
    console.log('Debugging - CSV Import Button Element:', importCsvBtn);

    // --- इवेंट लिस्टनर्स ---
    // ... (सभी Event Listeners वैसे ही रहेंगे जैसे पिछले सही संस्करण में थे, CSV बटन वाला भी शामिल है) ...
    if (addNewPolicyBtn) { console.log('Debugging - Attaching listener to Add New Policy button'); addNewPolicyBtn.addEventListener('click', () => openPolicyModal()); } else { console.error('ERROR: Add New Policy button not found!'); }
    if (policyForm) { policyForm.addEventListener('submit', handleSavePolicy); console.log('Debugging - Attaching listener to Policy Form submit'); } else { console.error('ERROR: Policy Form not found!'); }
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
    if (addTaskBtn) { console.log('Debugging - Attaching listener to Add Task button'); addTaskBtn.addEventListener('click', handleAddTask); } else { console.error('ERROR: Add Task button not found!'); }
    if (taskList) { taskList.addEventListener('change', handleTaskCheckboxChange); taskList.addEventListener('click', handleTaskActions); }
    if (editTaskForm) { editTaskForm.addEventListener('submit', handleUpdateTask); console.log('Debugging - Attaching listener to Edit Task Form submit'); } else { console.error('ERROR: Edit Task Form not found!'); }
    if (closeEditTaskModalBtn) closeEditTaskModalBtn.addEventListener('click', closeEditTaskModal);
    if (cancelEditTaskBtn) cancelEditTaskBtn.addEventListener('click', closeEditTaskModal);
    if (editTaskModal) editTaskModal.addEventListener('click', (e) => { if (e.target === editTaskModal) closeEditTaskModal(); });
    if (closeClientDetailBtn) closeClientDetailBtn.addEventListener('click', closeClientDetail);
    if (closeClientDetailBtnBottom) closeClientDetailBtnBottom.addEventListener('click', closeClientDetail);
    if (clientDetailModal) clientDetailModal.addEventListener('click', (e) => { if (e.target === clientDetailModal) closeClientDetail(); });
    if (addLogBtn) addLogBtn.addEventListener('click', addCommunicationNote);
    if (importCsvBtn && csvFileInput) { console.log('Debugging - Attaching listener to Import CSV button'); importCsvBtn.addEventListener('click', handleCsvImport); } else { console.error('ERROR: CSV Import Button or File Input not found!'); }


    // --- Firestore Listeners ---
    listenForPolicies();
    listenForTasks();

    console.log("Initialization complete.");
}

// --- Firestore Listener (Policies) ---
// ... (No change from previous correct version) ...
function listenForPolicies() { if (!db) { console.error("DB not initialized"); return; } if (unsubscribePolicies) unsubscribePolicies(); const policiesRef = collection(db, "licCustomers"); const sortValue = sortLicSelect ? sortLicSelect.value : 'createdAt_desc'; const [field, direction] = sortValue.split('_'); currentLicSortField = field || 'createdAt'; currentLicSortDirection = direction || 'desc'; const q = query(policiesRef, orderBy(currentLicSortField, currentLicSortDirection)); console.log(`Starting policy listener with sort: ${currentLicSortField} ${currentLicSortDirection}`); unsubscribePolicies = onSnapshot(q, (snapshot) => { console.log(`Received ${snapshot.docs.length} policies.`); allPoliciesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); applyLicFiltersAndRender(); displayReminders(); loadDashboardData(); }, (error) => { console.error("Error listening to policies:", error); if(licPolicyTableBody) licPolicyTableBody.innerHTML = `<tr><td colspan="9">Error loading policy data: ${error.message}. Check console and Firestore rules.</td></tr>`; if(dbTotalPoliciesEl) dbTotalPoliciesEl.textContent = 'Error'; if (dbActivePoliciesEl) dbActivePoliciesEl.textContent = 'Error'; if (dbLapsedPoliciesEl) dbLapsedPoliciesEl.textContent = 'Error'; if (dbUpcomingPremiumEl) dbUpcomingPremiumEl.textContent = 'Error'; if (dbUpcomingMaturityEl) dbUpcomingMaturityEl.textContent = 'Error'; }); }

// --- Firestore Listener (Tasks) ---
// ... (No change from previous correct version) ...
function listenForTasks() { if (!db) { console.error("DB not initialized for tasks"); return; } if (unsubscribeTasks) unsubscribeTasks(); const tasksRef = collection(db, "tasks"); const q = query(tasksRef, orderBy("createdAt", "desc")); console.log("Starting task listener..."); unsubscribeTasks = onSnapshot(q, (snapshot) => { const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); console.log(`Received ${tasks.length} tasks.`); renderTaskList(tasks); displayUpcomingTasks(tasks); }, (error) => { console.error("Error listening to tasks:", error); if(taskList) taskList.innerHTML = `<li class="error-tasks">Error loading tasks: ${error.message}. Check console and Firestore rules.</li>`; if(upcomingTaskListEl) upcomingTaskListEl.innerHTML = `<li class="error-tasks">Error loading upcoming tasks.</li>`; }); }

// --- फ़िल्टर, सॉर्ट और रेंडर (Policies) ---
// ... (No change from previous correct version) ...
function applyLicFiltersAndRender() { if (!allPoliciesCache || !licPolicyTableBody) { console.warn("applyLicFiltersAndRender: Cache or table body not ready."); return; } const searchTerm = licSearchInput ? licSearchInput.value.trim().toLowerCase() : ''; const statusFilterValue = licStatusFilter ? licStatusFilter.value : ''; const planFilterValue = licPlanFilter ? licPlanFilter.value.trim().toLowerCase() : ''; const modeFilter = licModeFilter ? licModeFilter.value : ''; const nachFilter = licNachFilter ? licNachFilter.value : ''; console.log(`Filtering with Status: "${statusFilterValue}", Plan: "${planFilterValue}", Mode: "${modeFilter}", NACH: "${nachFilter}", Search: "${searchTerm}"`); let filteredPolicies = allPoliciesCache.filter(policy => { const searchMatch = searchTerm === '' || (policy.customerName || '').toLowerCase().includes(searchTerm) || (policy.policyNumber || '').toLowerCase().includes(searchTerm) || (policy.mobileNo || '').toLowerCase().includes(searchTerm); const statusMatch = statusFilterValue === '' || (policy.policyStatus || '').toLowerCase() === statusFilterValue.toLowerCase(); const planMatch = planFilterValue === '' || (policy.plan || '').toLowerCase().includes(planFilterValue); const modeMatch = modeFilter === '' || (policy.modeOfPayment || '') === modeFilter; const nachMatch = nachFilter === '' || (policy.nachStatus || '') === nachFilter; return searchMatch && statusMatch && planMatch && modeMatch && nachMatch; }); console.log(`Policies before filtering: ${allPoliciesCache.length}, After filtering: ${filteredPolicies.length}`); renderPolicyTable(filteredPolicies); }

// --- टेबल रेंडरिंग (Policies) - Updated for Dynamic Next Due Date ---
// ... (No change from previous correct version) ...
function renderPolicyTable(policies) { if (!licPolicyTableBody) return; licPolicyTableBody.innerHTML = ''; if (policies.length === 0) { licPolicyTableBody.innerHTML = `<tr><td colspan="9" style="text-align: center;">No policies found matching criteria.</td></tr>`; return; } const today = new Date(); today.setHours(0, 0, 0, 0); policies.forEach(policy => { const row = licPolicyTableBody.insertRow(); row.setAttribute('data-id', policy.id); row.insertCell().textContent = policy.policyNumber || '-'; const nameCell = row.insertCell(); const nameLink = document.createElement('a'); nameLink.href = "#"; nameLink.textContent = policy.customerName || 'N/A'; nameLink.title = `View details for ${policy.customerName || 'this client'}`; nameLink.style.cursor = 'pointer'; nameLink.onclick = (e) => { e.preventDefault(); showClientDetail(policy.id, policy.customerName); }; nameCell.appendChild(nameLink); row.insertCell().textContent = policy.mobileNo || '-'; row.insertCell().textContent = policy.plan || '-'; row.insertCell().textContent = policy.premiumAmount ? `₹ ${Number(policy.premiumAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'; row.insertCell().textContent = policy.modeOfPayment || '-'; let displayDueDateStr = '-'; const storedNextDueDate = policy.nextInstallmentDate?.toDate(); if (storedNextDueDate && policy.modeOfPayment) { let displayDate = new Date(storedNextDueDate); displayDate.setHours(0,0,0,0); let safetyCounter = 0; const maxIterations = 120; while (displayDate < today && safetyCounter < maxIterations) { const calculated = calculateNextDueDate(displayDate, policy.modeOfPayment); if (!calculated) { displayDate = null; break; } displayDate = calculated; displayDate.setHours(0,0,0,0); safetyCounter++; } if (safetyCounter >= maxIterations) { displayDueDateStr = 'Calc Limit'; } else if (displayDate) { displayDueDateStr = formatDate(displayDate); } else { displayDueDateStr = 'Calc Error'; } } else if (storedNextDueDate) { displayDueDateStr = formatDate(storedNextDueDate); } row.insertCell().textContent = displayDueDateStr; const statusCell = row.insertCell(); const statusBadge = document.createElement('span'); const statusText = policy.policyStatus || 'Unknown'; statusBadge.className = `status-badge status-${statusText.toLowerCase()}`; statusBadge.textContent = statusText; statusCell.appendChild(statusBadge); const actionCell = row.insertCell(); actionCell.classList.add('action-buttons'); const editBtn = document.createElement('button'); editBtn.innerHTML = '<i class="fas fa-edit"></i>'; editBtn.title = "Edit Policy"; editBtn.classList.add('button', 'edit-button'); editBtn.onclick = (e) => { e.stopPropagation(); openPolicyModal(policy.id, policy); }; actionCell.appendChild(editBtn); const payBtn = document.createElement('button'); payBtn.innerHTML = '<i class="fas fa-check-circle"></i>'; payBtn.title = "Mark Premium Paid & Update Due Date"; payBtn.classList.add('button', 'pay-button'); const isPayable = ['Active', 'Lapsed'].includes(policy.policyStatus) && displayDueDateStr !== '-' && !displayDueDateStr.startsWith('Calc'); payBtn.disabled = !isPayable; payBtn.onclick = (e) => { e.stopPropagation(); handleMarkPaid(policy.id, policy); }; actionCell.appendChild(payBtn); const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>'; deleteBtn.title = "Delete Policy"; deleteBtn.classList.add('button', 'delete-button'); deleteBtn.onclick = (e) => { e.stopPropagation(); handleDeletePolicy(policy.id, policy.policyNumber); }; actionCell.appendChild(deleteBtn); }); }

// --- Modal खोलना/बंद करना (Policy Add/Edit) ---
// ... (No change from previous correct version) ...
function openPolicyModal(policyId = null, data = {}) { if (!policyModal || !policyForm || !policyModalTitle || !editPolicyId) { console.error("Cannot open policy modal: Required elements not found."); return; } policyForm.reset(); editPolicyId.value = policyId || ''; if (policyId && data) { policyModalTitle.textContent = "Edit Policy Details"; document.getElementById('customerName').value = data.customerName || ''; document.getElementById('fatherName').value = data.fatherName || ''; document.getElementById('mobileNo').value = data.mobileNo || ''; document.getElementById('dob').value = data.dob?.toDate ? data.dob.toDate().toISOString().split('T')[0] : ''; document.getElementById('address').value = data.address || ''; document.getElementById('policyNumber').value = data.policyNumber || ''; document.getElementById('plan').value = data.plan || ''; document.getElementById('sumAssured').value = data.sumAssured || ''; document.getElementById('policyTerm').value = data.policyTerm || ''; document.getElementById('issuanceDate').value = data.issuanceDate?.toDate ? data.issuanceDate.toDate().toISOString().split('T')[0] : ''; document.getElementById('modeOfPayment').value = data.modeOfPayment || ''; document.getElementById('premiumAmount').value = data.premiumAmount || ''; document.getElementById('nextInstallmentDate').value = data.nextInstallmentDate?.toDate ? data.nextInstallmentDate.toDate().toISOString().split('T')[0] : ''; document.getElementById('maturityDate').value = data.maturityDate?.toDate ? data.maturityDate.toDate().toISOString().split('T')[0] : ''; if(policyStatusModal) policyStatusModal.value = data.policyStatus || 'Active'; if(nachStatusModal) nachStatusModal.value = data.nachStatus || ''; } else { policyModalTitle.textContent = "Add New Policy"; if(policyStatusModal) policyStatusModal.value = 'Active'; if(nachStatusModal) nachStatusModal.value = 'No'; document.getElementById('dob').value = ''; document.getElementById('issuanceDate').value = ''; document.getElementById('nextInstallmentDate').value = ''; document.getElementById('maturityDate').value = ''; } policyModal.classList.add('active'); }
function closePolicyModal() { if (policyModal) policyModal.classList.remove('active'); }

// --- पॉलिसी सेव/अपडेट करना - Updated for Auto Calculation on Add ---
// ... (No change from previous correct version) ...
async function handleSavePolicy(event) { event.preventDefault(); if (!db) { console.error("DB not initialized"); return; } const policyId = editPolicyId.value; const isEditing = !!policyId; const customerName = document.getElementById('customerName').value.trim(); const policyNumber = document.getElementById('policyNumber').value.trim(); const mobileNo = document.getElementById('mobileNo').value.trim(); const issuanceDateStr = document.getElementById('issuanceDate').value; const modeOfPayment = document.getElementById('modeOfPayment').value; const premiumAmountStr = document.getElementById('premiumAmount').value; if (!customerName || !policyNumber || !mobileNo || !issuanceDateStr || !modeOfPayment || !premiumAmountStr) { alert("Please fill in all required fields (*)."); return; } if (!/^\d{10}$/.test(mobileNo)) { alert("Please enter a valid 10-digit mobile number."); return; } const premiumAmount = parseFloat(premiumAmountStr); if (isNaN(premiumAmount) || premiumAmount <= 0) { alert("Please enter a valid positive premium amount."); return; } const issuanceDate = Timestamp.fromDate(new Date(issuanceDateStr + 'T00:00:00Z')); const policyData = { customerName: customerName, fatherName: document.getElementById('fatherName').value.trim() || null, mobileNo: mobileNo, dob: document.getElementById('dob').value ? Timestamp.fromDate(new Date(document.getElementById('dob').value + 'T00:00:00Z')) : null, address: document.getElementById('address').value.trim() || null, policyNumber: policyNumber, plan: document.getElementById('plan').value.trim() || null, sumAssured: parseFloat(document.getElementById('sumAssured').value) || 0, policyTerm: document.getElementById('policyTerm').value.trim() || null, issuanceDate: issuanceDate, modeOfPayment: modeOfPayment, premiumAmount: premiumAmount, maturityDate: document.getElementById('maturityDate').value ? Timestamp.fromDate(new Date(document.getElementById('maturityDate').value + 'T00:00:00Z')) : null, policyStatus: policyStatusModal.value || 'Active', nachStatus: nachStatusModal.value || 'No', updatedAt: serverTimestamp() }; if (!isEditing) { policyData.createdAt = serverTimestamp(); try { const firstDueDate = calculateNextDueDate(issuanceDate.toDate(), modeOfPayment); if (firstDueDate) { policyData.nextInstallmentDate = Timestamp.fromDate(firstDueDate); console.log(`Calculated first due date: ${formatDate(firstDueDate)}`); } else { policyData.nextInstallmentDate = null; console.warn("Could not calculate the first due date."); alert("Warning: Could not automatically calculate the first due date based on Issuance Date and Mode."); } } catch (e) { console.error("Error calculating first due date:", e); policyData.nextInstallmentDate = null; alert("Error calculating the first due date. Please check Mode of Payment."); } } else { const existingPolicyData = allPoliciesCache.find(p => p.id === policyId); if (existingPolicyData && existingPolicyData.nextInstallmentDate) { policyData.nextInstallmentDate = existingPolicyData.nextInstallmentDate; } } console.log("Saving policy data:", policyData); const saveButton = document.getElementById('savePolicyBtn'); if(saveButton) { saveButton.disabled = true; saveButton.textContent = 'Saving...'; } try { if (isEditing) { const policyRef = doc(db, "licCustomers", policyId); await updateDoc(policyRef, policyData); console.log("Policy updated successfully:", policyId); alert("Policy details updated successfully!"); } else { if (!policyData.nextInstallmentDate && modeOfPayment) { console.warn("Saving policy without a calculated next installment date."); } const policiesRef = collection(db, "licCustomers"); const docRef = await addDoc(policiesRef, policyData); console.log("Policy added successfully with ID:", docRef.id); alert("New policy added successfully!"); } closePolicyModal(); } catch (error) { console.error("Error saving policy:", error); alert(`Failed to save policy: ${error.message}\nCheck console for details.`); } finally { if(saveButton) { saveButton.disabled = false; saveButton.innerHTML = '<i class="fas fa-save"></i> Save Policy'; } } }

// --- पॉलिसी डिलीट करना ---
// ... (No change from previous correct version) ...
async function handleDeletePolicy(policyId, policyNumber) { if (!db || !policyId) return; if (confirm(`Are you sure you want to delete policy number "${policyNumber || 'this policy'}"?\nThis action cannot be undone.`)) { try { const policyRef = doc(db, "licCustomers", policyId); await deleteDoc(policyRef); console.log("Policy deleted successfully:", policyId); alert("Policy deleted successfully."); } catch (error) { console.error("Error deleting policy:", error); alert(`Failed to delete policy: ${error.message}`); } } }

// --- प्रीमियम भुगतान मार्क करना ---
// ... (No change from previous correct version) ...
async function handleMarkPaid(policyId, policyData) { if (!db || !policyId || !policyData.nextInstallmentDate || !policyData.modeOfPayment) { alert("Cannot mark as paid: Missing required policy data (ID, Stored Next Due Date, Mode)."); return; } const currentStoredDueDate = policyData.nextInstallmentDate.toDate(); const mode = policyData.modeOfPayment; try { const nextCalculatedDueDate = calculateNextDueDate(currentStoredDueDate, mode); if (!nextCalculatedDueDate) { alert("Could not calculate the next due date based on the mode."); return; } const nextDueDateStr = formatDate(nextCalculatedDueDate); if (!confirm(`Mark premium paid for policy ${policyData.policyNumber}?\n\nCurrent Stored Due: ${formatDate(currentStoredDueDate)}\nNext Due Date will be updated in database to: ${nextDueDateStr}`)) { return; } const policyRef = doc(db, "licCustomers", policyId); await updateDoc(policyRef, { nextInstallmentDate: Timestamp.fromDate(nextCalculatedDueDate), policyStatus: 'Active', updatedAt: serverTimestamp() }); console.log(`Policy ${policyId} marked paid. Stored next due date updated to ${nextDueDateStr}.`); alert(`Policy ${policyData.policyNumber} marked as paid.\nNext due date in database updated to ${nextDueDateStr}.`); } catch (error) { console.error("Error marking policy as paid:", error); alert(`Failed to mark policy as paid: ${error.message}`); } }

// --- रिमाइंडर फंक्शन (Policies) ---
// ... (No change from previous correct version) ...
function displayReminders() { if (!reminderList || !allPoliciesCache) return; reminderList.innerHTML = '<li class="loading-reminder">Loading reminders...</li>'; const today = new Date(); today.setHours(0, 0, 0, 0); const fifteenDaysLater = new Date(today); fifteenDaysLater.setDate(today.getDate() + 15); const upcomingPolicies = []; allPoliciesCache.forEach(policy => { const storedNextDueDate = policy.nextInstallmentDate?.toDate(); if (storedNextDueDate && policy.modeOfPayment && ['Active', 'Lapsed'].includes(policy.policyStatus)) { let displayDate = new Date(storedNextDueDate); displayDate.setHours(0,0,0,0); let safetyCounter = 0; const maxIterations = 120; while (displayDate < today && safetyCounter < maxIterations) { const calculated = calculateNextDueDate(displayDate, policy.modeOfPayment); if (!calculated) { displayDate = null; break; } displayDate = calculated; displayDate.setHours(0,0,0,0); safetyCounter++; } if (displayDate && displayDate >= today && displayDate <= fifteenDaysLater) { upcomingPolicies.push({ ...policy, displayDueDate: displayDate }); } } }); upcomingPolicies.sort((a, b) => a.displayDueDate - b.displayDueDate); reminderList.innerHTML = ''; if (upcomingPolicies.length === 0) { reminderList.innerHTML = '<li>No upcoming installments in the next 15 days.</li>'; return; } upcomingPolicies.forEach(policy => { const li = document.createElement('li'); li.innerHTML = `<span>${policy.customerName || 'N/A'} (${policy.policyNumber || 'N/A'}) - Due: <strong>${formatDate(policy.displayDueDate)}</strong> (₹ ${Number(policy.premiumAmount || 0).toLocaleString('en-IN')})</span>`; li.title = `Plan: ${policy.plan || '-'}, Mode: ${policy.modeOfPayment || '-'}`; reminderList.appendChild(li); }); }

// --- Task Management Functions ---
// ... (No change from previous correct version) ...
function renderTaskList(tasks) { if (!taskList) return; taskList.innerHTML = ''; if (!tasks || tasks.length === 0) { taskList.innerHTML = '<li>No follow-up tasks found.</li>'; return; } tasks.forEach(task => { const li = document.createElement('li'); li.setAttribute('data-task-id', task.id); li.classList.toggle('completed-task', task.completed); const contentDiv = document.createElement('div'); contentDiv.style.flexGrow = '1'; const customerSpan = document.createElement('span'); customerSpan.style.fontWeight = 'bold'; customerSpan.textContent = task.customerName ? `${task.customerName}: ` : ''; const descSpan = document.createElement('span'); descSpan.textContent = task.description || 'No description'; const dateSpan = document.createElement('span'); dateSpan.style.fontSize = '0.85em'; dateSpan.style.color = '#555'; dateSpan.style.marginLeft = '10px'; dateSpan.textContent = task.dueDate?.toDate ? ` (Due: ${formatDate(task.dueDate.toDate())})` : ''; contentDiv.appendChild(customerSpan); contentDiv.appendChild(descSpan); contentDiv.appendChild(dateSpan); const commentSpan = document.createElement('p'); commentSpan.style.fontSize = '0.85em'; commentSpan.style.color = '#666'; commentSpan.style.marginTop = '4px'; commentSpan.style.whiteSpace = 'pre-wrap'; if (task.comments && Array.isArray(task.comments) && task.comments.length > 0) { task.comments.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0)); const latestComment = task.comments[0]; const commentDate = latestComment.timestamp?.toDate ? formatDateTime(latestComment.timestamp.toDate()) : ''; commentSpan.textContent = `Latest Comment ${commentDate ? `(${commentDate})` : ''}: ${latestComment.text || ''}`; } else { commentSpan.style.display = 'none'; } contentDiv.appendChild(commentSpan); const actionsDiv = document.createElement('div'); actionsDiv.classList.add('task-actions-container'); actionsDiv.style.marginLeft = 'auto'; actionsDiv.style.display = 'flex'; actionsDiv.style.gap = '8px'; actionsDiv.style.flexShrink = '0'; actionsDiv.style.alignItems = 'center'; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'task-checkbox'; checkbox.checked = task.completed; checkbox.title = task.completed ? 'Mark as Pending' : 'Mark as Completed'; checkbox.setAttribute('data-task-id', task.id); const editBtn = document.createElement('button'); editBtn.innerHTML = '<i class="fas fa-edit"></i>'; editBtn.className = 'button edit-button edit-task-btn'; editBtn.title = 'Edit Task'; editBtn.onclick = (e) => { e.stopPropagation(); openEditTaskModal(task.id, task); }; const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>'; deleteBtn.className = 'button delete-task-btn'; deleteBtn.title = 'Delete Task'; deleteBtn.setAttribute('data-task-id', task.id); actionsDiv.appendChild(checkbox); actionsDiv.appendChild(editBtn); actionsDiv.appendChild(deleteBtn); li.appendChild(contentDiv); li.appendChild(actionsDiv); taskList.appendChild(li); }); }
async function handleAddTask() { if (!db || !newTaskInput) return; const description = newTaskInput.value.trim(); const customerName = newTaskCustomerNameEl.value.trim(); const dueDateStr = newTaskDueDate.value; const initialComment = newTaskCommentsEl.value.trim(); if (!description) { alert("Please enter the task description."); newTaskInput.focus(); return; } const taskData = { customerName: customerName || null, description: description, dueDate: dueDateStr ? Timestamp.fromDate(new Date(dueDateStr + 'T00:00:00Z')) : null, completed: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), comments: [] }; if (initialComment) { taskData.comments.push({ text: initialComment, timestamp: serverTimestamp() }); } console.log("Adding task:", taskData); addTaskBtn.disabled = true; addTaskBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...'; try { const tasksRef = collection(db, "tasks"); await addDoc(tasksRef, taskData); alert("Follow-up task added successfully!"); newTaskInput.value = ''; newTaskCustomerNameEl.value = ''; newTaskDueDate.value = ''; newTaskCommentsEl.value = ''; } catch (error) { console.error("Error adding task:", error); alert(`Failed to add task: ${error.message}`); } finally { addTaskBtn.disabled = false; addTaskBtn.innerHTML = '<i class="fas fa-plus"></i> Add Follow-up'; } }
async function handleTaskCheckboxChange(event) { if (event.target.classList.contains('task-checkbox')) { const checkbox = event.target; const taskId = checkbox.getAttribute('data-task-id'); const isCompleted = checkbox.checked; if (!db || !taskId) return; console.log(`Task ${taskId} completion changed to: ${isCompleted}`); const taskRef = doc(db, "tasks", taskId); checkbox.disabled = true; try { await updateDoc(taskRef, { completed: isCompleted, updatedAt: serverTimestamp() }); console.log(`Task ${taskId} status updated.`); checkbox.closest('li').classList.toggle('completed-task', isCompleted); } catch (error) { console.error("Error updating task status:", error); alert(`Failed to update task status: ${error.message}`); checkbox.checked = !isCompleted; } finally { checkbox.disabled = false; } } }
async function handleTaskActions(event) { if (event.target.closest('.delete-task-btn')) { const deleteButton = event.target.closest('.delete-task-btn'); const taskId = deleteButton.getAttribute('data-task-id'); if (!db || !taskId) return; if (confirm("Are you sure you want to delete this task?")) { deleteButton.disabled = true; deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; try { const taskRef = doc(db, "tasks", taskId); await deleteDoc(taskRef); console.log(`Task ${taskId} deleted successfully.`); alert("Task deleted."); } catch (error) { console.error("Error deleting task:", error); alert(`Failed to delete task: ${error.message}`); deleteButton.disabled = false; deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>'; } } } }
function openEditTaskModal(taskId, taskData) { if (!editTaskModal || !editTaskForm || !editTaskIdEl || !editTaskCustomerNameEl || !editTaskDescriptionEl || !editTaskDueDateEl || !editTaskStatusEl || !editTaskCommentsHistoryEl || !editTaskNewCommentEl) { console.error("Cannot open edit task modal: Required elements not found."); return; } console.log("Opening edit modal for task:", taskId, taskData); editTaskIdEl.value = taskId; editTaskCustomerNameEl.value = taskData.customerName || ''; editTaskDescriptionEl.value = taskData.description || ''; editTaskDueDateEl.value = taskData.dueDate?.toDate ? taskData.dueDate.toDate().toISOString().split('T')[0] : ''; editTaskStatusEl.value = taskData.completed ? 'completed' : 'pending'; editTaskNewCommentEl.value = ''; editTaskCommentsHistoryEl.innerHTML = ''; if (taskData.comments && Array.isArray(taskData.comments) && taskData.comments.length > 0) { editTaskCommentsHistoryEl.innerHTML = '<h4>Comment History:</h4>'; const sortedComments = [...taskData.comments].sort((a, b) => (a.timestamp?.toDate() || 0) - (b.timestamp?.toDate() || 0)); sortedComments.forEach(comment => { const p = document.createElement('p'); const commentDate = comment.timestamp?.toDate ? formatDateTime(comment.timestamp.toDate()) : 'Earlier'; p.innerHTML = `<span class="log-meta">(${commentDate}):</span> ${comment.text || ''}`; editTaskCommentsHistoryEl.appendChild(p); }); } else { editTaskCommentsHistoryEl.innerHTML = '<p><i>No comment history available.</i></p>'; } editTaskModal.classList.add('active'); }
function closeEditTaskModal() { if (editTaskModal) { editTaskModal.classList.remove('active'); } }
async function handleUpdateTask(event) { event.preventDefault(); if (!db || !editTaskIdEl || !editTaskDescriptionEl || !editTaskStatusEl) { console.error("Cannot update task: DB or required form elements missing."); return; } const taskId = editTaskIdEl.value; if (!taskId) { alert("Error: Task ID missing."); return; } const description = editTaskDescriptionEl.value.trim(); if (!description) { alert("Please enter task description."); editTaskDescriptionEl.focus(); return; } const updatedData = { customerName: editTaskCustomerNameEl.value.trim() || null, description: description, dueDate: editTaskDueDateEl.value ? Timestamp.fromDate(new Date(editTaskDueDateEl.value + 'T00:00:00Z')) : null, completed: editTaskStatusEl.value === 'completed', updatedAt: serverTimestamp() }; const newCommentText = editTaskNewCommentEl?.value.trim(); const saveButton = document.getElementById('saveTaskChangesBtn'); if(saveButton) { saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; } try { const taskRef = doc(db, "tasks", taskId); if (newCommentText && typeof window.arrayUnion === 'function') { const newCommentObject = { text: newCommentText, timestamp: serverTimestamp() }; updatedData.comments = window.arrayUnion(newCommentObject); await updateDoc(taskRef, updatedData); console.log("Task updated with new comment using arrayUnion."); } else { await updateDoc(taskRef, updatedData); console.log("Task updated (no new comment or arrayUnion unavailable)."); } alert("Task updated successfully!"); closeEditTaskModal(); } catch (error) { console.error("Error updating task:", error); alert(`Failed to update task: ${error.message}`); } finally { if(saveButton) { saveButton.disabled = false; saveButton.innerHTML = '<i class="fas fa-save"></i> Save Changes'; } } }
function displayUpcomingTasks(tasks) { if (!upcomingTaskListEl) return; upcomingTaskListEl.innerHTML = '<li class="loading-reminder">Loading upcoming tasks...</li>'; if (!tasks) { console.warn("Upcoming tasks display called without tasks data."); upcomingTaskListEl.innerHTML = '<li>Could not load task data.</li>'; return; } const today = new Date(); today.setHours(0, 0, 0, 0); const sevenDaysLater = new Date(today); sevenDaysLater.setDate(today.getDate() + 7); const upcomingDueTasks = tasks.filter(task => { if (task.completed || !task.dueDate?.toDate) return false; const dueDate = task.dueDate.toDate(); dueDate.setHours(0, 0, 0, 0); return dueDate >= today && dueDate <= sevenDaysLater; }); upcomingDueTasks.sort((a, b) => (a.dueDate?.toDate() || 0) - (b.dueDate?.toDate() || 0)); upcomingTaskListEl.innerHTML = ''; if (upcomingDueTasks.length === 0) { upcomingTaskListEl.innerHTML = '<li>No follow-ups due in the next 7 days.</li>'; return; } upcomingDueTasks.forEach(task => { const li = document.createElement('li'); li.innerHTML = `<a>${task.customerName ? task.customerName + ': ' : ''}${task.description} - Due: <strong>${formatDate(task.dueDate.toDate())}</strong></a>`; li.style.cursor = 'pointer'; li.onclick = () => openEditTaskModal(task.id, task); li.title = 'Click to view/edit task'; upcomingTaskListEl.appendChild(li); }); }

// --- Phase 2 Functions (Client Detail) ---
// ... (No change from previous correct version) ...
function loadDashboardData() { if (!allPoliciesCache || !dbTotalPoliciesEl || !dbActivePoliciesEl || !dbLapsedPoliciesEl || !dbUpcomingPremiumEl || !dbUpcomingMaturityEl) { console.warn("Dashboard elements or policy cache not ready."); return; } const totalPolicies = allPoliciesCache.length; const activePolicies = allPoliciesCache.filter(p => p.policyStatus === 'Active').length; const lapsedPolicies = allPoliciesCache.filter(p => p.policyStatus === 'Lapsed').length; const today = new Date(); today.setHours(0, 0, 0, 0); const thirtyDaysLater = new Date(today); thirtyDaysLater.setDate(today.getDate() + 30); let upcomingPremiumTotal = 0; allPoliciesCache.forEach(p => { if (p.nextInstallmentDate?.toDate && ['Active', 'Lapsed'].includes(p.policyStatus)) { let displayDate = new Date(p.nextInstallmentDate.toDate()); displayDate.setHours(0,0,0,0); let safetyCounter = 0; const maxIterations = 120; while (displayDate < today && safetyCounter < maxIterations) { const calculated = calculateNextDueDate(displayDate, p.modeOfPayment); if (!calculated || !p.modeOfPayment) { displayDate = null; break; } displayDate = calculated; displayDate.setHours(0,0,0,0); safetyCounter++; } if (displayDate && displayDate >= today && displayDate <= thirtyDaysLater) { upcomingPremiumTotal += Number(p.premiumAmount || 0); } } }); const ninetyDaysLater = new Date(today); ninetyDaysLater.setDate(today.getDate() + 90); const upcomingMaturitiesCount = allPoliciesCache.filter(p => { if (p.maturityDate?.toDate) { const maturityDate = p.maturityDate.toDate(); maturityDate.setHours(0, 0, 0, 0); return maturityDate >= today && maturityDate <= ninetyDaysLater; } return false; }).length; dbTotalPoliciesEl.textContent = totalPolicies; dbActivePoliciesEl.textContent = activePolicies; dbLapsedPoliciesEl.textContent = lapsedPolicies; dbUpcomingPremiumEl.textContent = `₹ ${upcomingPremiumTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; dbUpcomingMaturityEl.textContent = upcomingMaturitiesCount; console.log("Dashboard data loaded."); }
async function showClientDetail(policyId, customerName) { if (!clientDetailModal || !db || !policyId) { console.error("Cannot show client detail: Modal or DB or Policy ID missing."); return; } console.log(`Showing details for policy ID: ${policyId}, Customer: ${customerName}`); currentOpenClientId = policyId; clientDetailNameEl.textContent = `Details for ${customerName || 'Client'}`; clientDetailMobileEl.textContent = 'Loading...'; clientDetailDobEl.textContent = 'Loading...'; clientDetailFatherNameEl.textContent = 'Loading...'; clientDetailAddressEl.textContent = 'Loading...'; clientPoliciesListEl.innerHTML = '<p>Loading policies...</p>'; communicationLogListEl.innerHTML = '<p>Loading communication logs...</p>'; newLogNoteEl.value = ''; openDetailTab(null, 'clientPolicies', true); clientDetailModal.classList.add('active'); try { const policyRef = doc(db, "licCustomers", policyId); const policySnap = await getDoc(policyRef); if (policySnap.exists()) { const policyData = policySnap.data(); clientDetailNameEl.textContent = `Details for ${policyData.customerName || 'Client'}`; clientDetailMobileEl.textContent = policyData.mobileNo || '-'; clientDetailDobEl.textContent = policyData.dob?.toDate ? formatDate(policyData.dob.toDate()) : '-'; clientDetailFatherNameEl.textContent = policyData.fatherName || '-'; clientDetailAddressEl.textContent = policyData.address || '-'; const identifierField = 'mobileNo'; const identifierValue = policyData.mobileNo; if (identifierValue) { const policiesQuery = query(collection(db, "licCustomers"), where(identifierField, "==", identifierValue)); const customerPoliciesSnap = await getDocs(policiesQuery); const customerPolicies = customerPoliciesSnap.docs.map(d => ({ id: d.id, ...d.data() })); renderClientPolicies(customerPolicies); loadCommunicationLogs(identifierValue); } else { console.warn("Cannot fetch related policies/logs: Identifier field (mobileNo) is empty."); clientPoliciesListEl.innerHTML = '<p>Could not load related policies (missing identifier).</p>'; communicationLogListEl.innerHTML = '<p>Could not load logs (missing identifier).</p>'; } } else { console.error(`Policy with ID ${policyId} not found.`); alert("Error: Could not find policy details."); closeClientDetail(); } } catch (error) { console.error("Error fetching client details:", error); alert(`Error loading client details: ${error.message}`); clientDetailMobileEl.textContent = 'Error'; clientPoliciesListEl.innerHTML = '<p>Error loading policies.</p>'; communicationLogListEl.innerHTML = '<p>Error loading logs.</p>'; } }
function renderClientPolicies(policies) { if (!clientPoliciesListEl) return; clientPoliciesListEl.innerHTML = ''; if (!policies || policies.length === 0) { clientPoliciesListEl.innerHTML = '<p>No policies found for this client.</p>'; return; } const ul = document.createElement('ul'); policies.sort((a, b) => (a.policyNumber || '').localeCompare(b.policyNumber || '')); policies.forEach(policy => { const li = document.createElement('li'); const statusText = policy.policyStatus || 'Unknown'; let displayDueDateStr = '-'; const storedNextDueDate = policy.nextInstallmentDate?.toDate(); if (storedNextDueDate && policy.modeOfPayment) { let displayDate = new Date(storedNextDueDate); displayDate.setHours(0,0,0,0); const today = new Date(); today.setHours(0,0,0,0); let safetyCounter = 0; const maxIterations = 120; while (displayDate < today && safetyCounter < maxIterations) { const calculated = calculateNextDueDate(displayDate, policy.modeOfPayment); if (!calculated) { displayDate = null; break; } displayDate = calculated; displayDate.setHours(0,0,0,0); safetyCounter++; } if (displayDate) displayDueDateStr = formatDate(displayDate); else displayDueDateStr = 'Calc Error'; } else if (storedNextDueDate) { displayDueDateStr = formatDate(storedNextDueDate); } li.innerHTML = `<strong>Policy No:</strong> ${policy.policyNumber || '-'} | <strong>Plan:</strong> ${policy.plan || '-'} | <strong>Premium:</strong> ₹ ${Number(policy.premiumAmount || 0).toLocaleString('en-IN')} (${policy.modeOfPayment || '-'}) | <strong>Next Due:</strong> ${displayDueDateStr} | <span class="status-badge status-${statusText.toLowerCase()}">${statusText}</span>`; ul.appendChild(li); }); clientPoliciesListEl.appendChild(ul); }
async function loadCommunicationLogs(identifier) { if (!communicationLogListEl || !db || !identifier) return; communicationLogListEl.innerHTML = '<p>Loading logs...</p>'; try { const logsRef = collection(db, "communicationLogs"); const q = query(logsRef, where("clientIdentifier", "==", identifier), orderBy("timestamp", "desc")); const logSnapshot = await getDocs(q); const logs = logSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); communicationLogListEl.innerHTML = ''; if (logs.length === 0) { communicationLogListEl.innerHTML = '<p>No communication logs found.</p>'; return; } logs.forEach(log => { const p = document.createElement('p'); const logDate = log.timestamp?.toDate ? formatDateTime(log.timestamp.toDate()) : 'Earlier'; p.innerHTML = `<span class="log-meta">(${logDate}):</span> ${log.note || ''}`; communicationLogListEl.appendChild(p); }); console.log(`Loaded ${logs.length} communication logs for identifier: ${identifier}`); } catch (error) { console.error(`Error loading communication logs for ${identifier}:`, error); communicationLogListEl.innerHTML = `<p>Error loading logs: ${error.message}</p>`; } }
async function addCommunicationNote() { if (!db || !newLogNoteEl || !currentOpenClientId) { alert("Cannot add note: Required data or context missing."); return; } const noteText = newLogNoteEl.value.trim(); if (!noteText) { alert("Please enter a note to add."); newLogNoteEl.focus(); return; } const policyData = allPoliciesCache.find(p => p.id === currentOpenClientId); const clientIdentifier = policyData?.mobileNo; if (!clientIdentifier) { alert("Could not determine the client identifier (e.g., mobile number) to save the log. Cannot add note."); return; } const logData = { clientIdentifier: clientIdentifier, note: noteText, timestamp: serverTimestamp(), policyContextId: currentOpenClientId }; addLogBtn.disabled = true; addLogBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...'; try { const logsRef = collection(db, "communicationLogs"); await addDoc(logsRef, logData); console.log("Communication log added successfully."); newLogNoteEl.value = ''; loadCommunicationLogs(clientIdentifier); } catch (error) { console.error("Error adding communication log:", error); alert(`Failed to add communication log: ${error.message}`); } finally { addLogBtn.disabled = false; addLogBtn.innerHTML = '<i class="fas fa-plus"></i> Add Note'; } }
function closeClientDetail() { if (clientDetailModal) { clientDetailModal.classList.remove('active'); currentOpenClientId = null; console.log("Client detail modal closed."); } }
window.openDetailTab = function(evt, tabName, isInitialCall = false) { if (evt && !isInitialCall) evt.preventDefault(); const tabcontent = clientDetailModal.getElementsByClassName("tab-content"); for (let i = 0; i < tabcontent.length; i++) { tabcontent[i].style.display = "none"; tabcontent[i].classList.remove("active"); } const tablinks = clientDetailModal.getElementsByClassName("tab-button"); for (let i = 0; i < tablinks.length; i++) { tablinks[i].classList.remove("active"); } const currentTab = document.getElementById(tabName); if(currentTab) { currentTab.style.display = "block"; currentTab.classList.add("active"); } if (evt && evt.currentTarget) { evt.currentTarget.classList.add("active"); } else if (isInitialCall) { const activeButton = Array.from(tablinks).find(btn => btn.getAttribute('onclick').includes(`'${tabName}'`)); if (activeButton) activeButton.classList.add("active"); } }

// --- ****** NEW TEMPORARY CSV IMPORT FUNCTION START ****** ---

// Helper function to parse date strings (DD-MM-YYYY or YYYY-MM-DD) into Date objects
// Returns null if date is invalid
function parseDateString(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    let parts;
    let day, month, year;

    // Try YYYY-MM-DD first
    parts = dateStr.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (parts) {
        year = parseInt(parts[1], 10);
        month = parseInt(parts[2], 10);
        day = parseInt(parts[3], 10);
    } else {
        // Try DD-MM-YYYY
        parts = dateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
        if (parts) {
            day = parseInt(parts[1], 10);
            month = parseInt(parts[2], 10);
            year = parseInt(parts[3], 10);
        } else {
            return null; // Invalid format
        }
    }

    // Basic validation
    if (isNaN(day) || isNaN(month) || isNaN(year) || month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
        console.warn(`Invalid date components found: Day=${day}, Month=${month}, Year=${year} in string: ${dateStr}`);
        return null;
    }

    // Create date object using UTC to avoid timezone shifts affecting the date itself
    // Month is 0-based for Date constructor
    const dateObj = new Date(Date.UTC(year, month - 1, day));

    // Final check if the created date is valid and matches input components
    if (isNaN(dateObj.getTime()) || dateObj.getUTCFullYear() !== year || dateObj.getUTCMonth() !== month - 1 || dateObj.getUTCDate() !== day) {
        console.warn(`Date object validation failed for: ${dateStr}`);
        return null;
    }
    return dateObj;
}


// Main function to handle CSV import
async function handleCsvImport() {
    if (!csvFileInput || !csvFileInput.files || csvFileInput.files.length === 0) {
        alert("Please select a cleaned CSV file first.");
        return;
    }
    if (!db || !collection || !addDoc || !Timestamp || !serverTimestamp || !calculateNextDueDate) {
         alert("Error: Firebase or helper functions are not correctly initialized.");
         return;
    }

    const file = csvFileInput.files[0];
    const reader = new FileReader();

    // Disable button during import
    if (importCsvBtn) importCsvBtn.disabled = true;
    if (importStatusEl) importStatusEl.textContent = "Reading file...";

    reader.onload = async (event) => {
        const csvContent = event.target.result;
        if (importStatusEl) importStatusEl.textContent = "Processing CSV data... (This may take a while)";
        console.log("CSV Content Read.");

        // --- Define expected headers and their mapping to Firestore fields ---
        // !! IMPORTANT: This MUST exactly match the header row of YOUR cleaned CSV file !!
        const expectedHeaders = [
            "customerName", "fatherName", "address", "dob", "mobileNo",
            "policyNumber", "plan", "sumAssured", "policyTerm", "issuanceDate",
            "modeOfPayment", "maturityDate", "premiumAmount", "nachStatus",
            "policyStatus"
            // nextInstallmentDate is calculated
        ];

        // Split content into lines, handle potential Windows line endings (\r\n)
        const lines = csvContent.split(/\r?\n/);
        if (lines.length < 2) {
            alert("CSV file is empty or has no data rows.");
            if (importCsvBtn) importCsvBtn.disabled = false;
            if (importStatusEl) importStatusEl.textContent = "Error: No data found.";
            return;
        }

        // Simple CSV header parsing (assumes comma delimiter, no commas within fields for now)
        // Trim headers and handle potential quotes if necessary in a real parser
        const headerLine = lines[0].trim();
        const actualHeaders = headerLine.split(',').map(h => h.trim().toLowerCase()); // Use lower case for robust matching
        console.log("Actual Headers Found:", actualHeaders);

        // Validate headers and create map
        let headerMap = {};
        let missingHeaders = [];
        try {
            expectedHeaders.forEach(expectedHeader => {
                const index = actualHeaders.indexOf(expectedHeader.toLowerCase());
                if (index === -1) {
                   missingHeaders.push(expectedHeader);
                }
                headerMap[expectedHeader] = index; // Store index for each field (-1 if missing)
            });

            if (missingHeaders.length > 0) {
                 throw new Error(`Missing expected header column(s): ${missingHeaders.join(', ')}`);
            }
            console.log("Header Map (Field: Index):", headerMap);

        } catch(e) {
             alert(`CSV Header Error: ${e.message}\nPlease ensure your CSV has the correct headers (case-insensitive):\n${expectedHeaders.join(', ')}`);
             if (importCsvBtn) importCsvBtn.disabled = false;
             if (importStatusEl) importStatusEl.textContent = "Error: Invalid CSV headers.";
             return;
        }


        // --- Process data rows ---
        const dataLines = lines.slice(1); // Skip header row
        let successCount = 0;
        let errorCount = 0;
        const totalRows = dataLines.filter(line => line.trim() !== '').length; // Count non-empty lines
        let currentRowNum = 0;

        if (importStatusEl) importStatusEl.textContent = `Starting import of ${totalRows} rows...`;


        for (let i = 0; i < dataLines.length; i++) {
            const line = dataLines[i].trim();
            if (!line) continue; // Skip empty lines
            currentRowNum++;

            // More robust CSV parsing needed for values containing commas
            // This simple split will fail if fields have commas.
            // For now, assuming no commas within fields based on provided samples.
            const values = line.split(',');

            if (values.length < expectedHeaders.length) {
                 console.warn(`Skipping row ${currentRowNum}: Incorrect number of columns (${values.length} found, ${expectedHeaders.length} expected). Line: ${line}`);
                 errorCount++;
                 continue; // Skip row if column count doesn't match headers
             }

            if (importStatusEl) importStatusEl.textContent = `Importing row ${currentRowNum} of ${totalRows}...`;
            console.log(`Processing row ${currentRowNum}: ${line}`);


            try {
                // Create data object for Firestore
                const policyData = {};

                // Map values using headerMap - trim() values
                expectedHeaders.forEach(field => {
                     const index = headerMap[field];
                     policyData[field] = values[index] ? values[index].trim() : ""; // Use empty string for blank cells
                 });

                // --- Data Type Conversion & Cleaning ---
                // Dates (Convert DD-MM-YYYY or YYYY-MM-DD strings to Timestamp)
                const dobDate = parseDateString(policyData.dob);
                policyData.dob = dobDate ? Timestamp.fromDate(dobDate) : null;

                const issuanceDateObj = parseDateString(policyData.issuanceDate);
                policyData.issuanceDate = issuanceDateObj ? Timestamp.fromDate(issuanceDateObj) : null;

                const maturityDateObj = parseDateString(policyData.maturityDate);
                policyData.maturityDate = maturityDateObj ? Timestamp.fromDate(maturityDateObj) : null;

                 // Log if date parsing failed
                 if (policyData.dob === null && values[headerMap['dob']]?.trim()) console.warn(`Row ${currentRowNum}: Failed to parse DOB: ${values[headerMap['dob']]}`);
                 if (policyData.issuanceDate === null && values[headerMap['issuanceDate']]?.trim()) console.warn(`Row ${currentRowNum}: Failed to parse Issuance Date: ${values[headerMap['issuanceDate']]}`);
                 if (policyData.maturityDate === null && values[headerMap['maturityDate']]?.trim()) console.warn(`Row ${currentRowNum}: Failed to parse Maturity Date: ${values[headerMap['maturityDate']]}`);


                // Numbers (Remove commas, parse)
                policyData.sumAssured = policyData.sumAssured ? parseFloat(String(policyData.sumAssured).replace(/,/g, '')) : 0;
                policyData.premiumAmount = policyData.premiumAmount ? parseFloat(String(policyData.premiumAmount).replace(/,/g, '')) : 0;
                if (isNaN(policyData.sumAssured)) { console.warn(`Row ${currentRowNum}: Invalid Sum Assured value "${values[headerMap['sumAssured']]}". Setting to 0.`); policyData.sumAssured = 0; }
                if (isNaN(policyData.premiumAmount)) { console.warn(`Row ${currentRowNum}: Invalid Premium Amount value "${values[headerMap['premiumAmount']]}". Setting to 0.`); policyData.premiumAmount = 0; }

                // Mobile number validation (basic)
                 if (policyData.mobileNo && !/^\d{10}$/.test(policyData.mobileNo)) {
                    console.warn(`Row ${currentRowNum}: Invalid mobile number format "${policyData.mobileNo}". Storing as is or consider setting to null.`);
                    // policyData.mobileNo = null; // Optionally clear invalid numbers
                 } else if (!policyData.mobileNo) {
                    policyData.mobileNo = null; // Store null if blank
                 }

                 // Strings - Ensure they are strings, handle null for blanks if desired
                 policyData.customerName = policyData.customerName || null;
                 policyData.fatherName = policyData.fatherName || null;
                 policyData.address = policyData.address || null;
                 policyData.policyNumber = policyData.policyNumber || null;
                 policyData.plan = policyData.plan || null;
                 policyData.policyTerm = policyData.policyTerm || null;
                 policyData.modeOfPayment = policyData.modeOfPayment || null;
                 policyData.nachStatus = policyData.nachStatus || 'No'; // Default No if blank
                 policyData.policyStatus = policyData.policyStatus || 'Active'; // Default Active if blank


                // Calculate first nextInstallmentDate
                policyData.nextInstallmentDate = null; // Initialize
                if (issuanceDateObj && policyData.modeOfPayment) {
                    try {
                         const firstDueDate = calculateNextDueDate(issuanceDateObj, policyData.modeOfPayment);
                         if (firstDueDate) {
                             policyData.nextInstallmentDate = Timestamp.fromDate(firstDueDate);
                         } else {
                              console.warn(`Row ${currentRowNum}: Could not calculate next due date for mode ${policyData.modeOfPayment}`);
                         }
                     } catch (calcError) {
                         console.error(`Row ${currentRowNum}: Error calculating next due date`, calcError);
                     }
                 } else if (!issuanceDateObj) {
                      console.warn(`Row ${currentRowNum}: Cannot calculate next due date because Issuance Date is invalid or missing.`);
                 } else if (!policyData.modeOfPayment) {
                      console.warn(`Row ${currentRowNum}: Cannot calculate next due date because Mode of Payment is missing.`);
                 }

                // Add timestamps
                policyData.createdAt = serverTimestamp();
                policyData.updatedAt = serverTimestamp();

                // --- Add to Firestore ---
                // console.log(`Adding row ${currentRowNum} data:`, JSON.stringify(policyData, null, 2)); // Detailed log before add
                await addDoc(collection(db, "licCustomers"), policyData);
                successCount++;

                // Optional: Add a small delay to avoid potential rate limits/UI freeze
                await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay

            } catch (error) {
                console.error(`Error processing row ${currentRowNum}: ${line}`, error);
                errorCount++;
                if (importStatusEl) importStatusEl.textContent = `Error on row ${currentRowNum}. Check console. Continuing...`;
                 // Optional: Stop import on first error?
                 // alert(`Error on row ${currentRowNum}. Import stopped. Check console.`);
                 // if (importCsvBtn) importCsvBtn.disabled = false;
                 // return;
            }
        } // End for loop

        // --- Import complete ---
        const message = `Import finished. Successfully added: ${successCount}, Errors: ${errorCount} (Check console for details).`;
        alert(message);
        if (importStatusEl) importStatusEl.textContent = message;
        console.log(message);
        if (csvFileInput) csvFileInput.value = ''; // Clear file input

    }; // End reader.onload

    reader.onerror = (event) => {
        alert("Error reading the file.");
        console.error("File reading error:", event);
        if (importStatusEl) importStatusEl.textContent = "Error reading file.";
    };

    reader.readAsText(file); // Start reading the file

    // Re-enable button AFTER starting file read might be too soon if file is large
    // It's better to re-enable it in the finally block of the processing or after onload finishes
     if (importCsvBtn) importCsvBtn.disabled = false; // Re-enable (consider moving to end of onload)

}
// --- ****** NEW TEMPORARY CSV IMPORT FUNCTION END ****** ---


// --- हेल्पर फंक्शन्स ---
// (Ensure only ONE definition of these helpers exists in the file)

// Format Date as DD-MM-YYYY
function formatDate(date) { /* ... Correct implementation ... */ if (!date || !(date instanceof Date)) return '-'; try { let day = date.getDate().toString().padStart(2, '0'); let month = (date.getMonth() + 1).toString().padStart(2, '0'); let year = date.getFullYear(); if (isNaN(day) || isNaN(month) || isNaN(year) || year < 1900 || year > 2100) return 'Invalid Date'; return `${day}-${month}-${year}`; } catch (e) { console.error("Error formatting date:", date, e); return 'Date Error'; } }
// Format Date and Time as DD-MM-YYYY HH:MM AM/PM
function formatDateTime(date) { /* ... Correct implementation ... */ if (!date || !(date instanceof Date)) return '-'; try { let day = date.getDate().toString().padStart(2, '0'); let month = (date.getMonth() + 1).toString().padStart(2, '0'); let year = date.getFullYear(); if (isNaN(day) || isNaN(month) || isNaN(year) || year < 1900 || year > 2100) return 'Invalid DateTime'; let hours = date.getHours(); let minutes = date.getMinutes().toString().padStart(2, '0'); let ampm = hours >= 12 ? 'PM' : 'AM'; hours = hours % 12; hours = hours ? hours : 12; let hoursStr = hours.toString().padStart(2, '0'); return `${day}-${month}-${year} ${hoursStr}:${minutes} ${ampm}`; } catch (e) { console.error("Error formatting datetime:", date, e); return 'DateTime Error'; } }
// Calculate next due date based on start date and mode
function calculateNextDueDate(startDate, mode) { /* ... Correct implementation ... */ if (!startDate || !(startDate instanceof Date) || !mode) { console.error("calculateNextDueDate: Invalid input", startDate, mode); return null; } try { let nextDate = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())); switch (mode) { case 'Yearly': nextDate.setUTCFullYear(nextDate.getUTCFullYear() + 1); break; case 'Half-Yearly': nextDate.setUTCMonth(nextDate.getUTCMonth() + 6); break; case 'Quarterly': nextDate.setUTCMonth(nextDate.getUTCMonth() + 3); break; case 'Monthly': nextDate.setUTCMonth(nextDate.getUTCMonth() + 1); break; default: console.error(`calculateNextDueDate: Unknown mode "${mode}"`); return null; } return nextDate; } catch (e) { console.error("Error calculating next due date:", startDate, mode, e); return null; } }


// --- फिल्टर/सॉर्ट हैंडलर्स ---
// ... (No change from previous correct version) ...
function handleLicFilterChange() { clearTimeout(searchDebounceTimerLic); searchDebounceTimerLic = setTimeout(() => { applyLicFiltersAndRender(); }, 300); }
function handleLicSortChange() { console.log("Sort changed:", sortLicSelect.value); listenForPolicies(); }
function clearLicFilters() { if (licSearchInput) licSearchInput.value = ''; if (licStatusFilter) licStatusFilter.value = ''; if (licPlanFilter) licPlanFilter.value = ''; if (licModeFilter) licModeFilter.value = ''; if (licNachFilter) licNachFilter.value = ''; applyLicFiltersAndRender(); console.log("Filters cleared."); }

// --- एंड ऑफ़ फाइल ---