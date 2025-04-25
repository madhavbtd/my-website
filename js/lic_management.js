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
    clientDetailModal = document.getElementById('clientDetailView'); // <<<<------ सुनिश्चित करें यह ID सही है
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


    // <<< नया कोड: URL पैरामीटर की जांच करें >>>
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const clientIdToOpen = urlParams.get('openClientDetail');
        if (clientIdToOpen && typeof showClientDetail === 'function') {
            console.log(`URL parameter found: openClientDetail=${clientIdToOpen}. Attempting to show details.`);
            // थोड़ी देर प्रतीक्षा करें ताकि पेज पूरी तरह से लोड हो जाए और डेटा उपलब्ध हो
            // Firestore listener (listenForPolicies) डेटा लोड करेगा, फिर हम modal खोल सकते हैं
            // एक फ्लैग सेट करें ताकि listener इसे खोल सके, या सीधे खोलें और डेटा बाद में लोड होगा
            setTimeout(() => {
                // showClientDetail को क्लाइंट ID के साथ कॉल करें
                // नाम अस्थायी रूप से 'Loading...' दिखाएगा, showClientDetail इसे बाद में अपडेट करेगा
                 console.log(`Calling showClientDetail for ID: ${clientIdToOpen}`);
                 showClientDetail(clientIdToOpen, 'Loading Name...');
            }, 700); // थोड़ा और समय दें ताकि DOM और प्रारंभिक डेटा तैयार हो सके
        } else if (clientIdToOpen) {
             console.error(`URL parameter 'openClientDetail' found, but showClientDetail function is not defined or available.`);
        }
    } catch(e) {
        console.error("Error processing URL parameters for auto-open:", e);
    }
    // <<< नया कोड समाप्त >>>

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
    listenForPolicies(); // यह क्लाइंट डिटेल को ऑटो-ओपन करने से पहले डेटा लोड करना शुरू कर देगा
    listenForTasks();

    console.log("Initialization complete.");
}


// --- बाकी lic_management.js का कोड ---
// ... (अन्य सभी फ़ंक्शन पहले जैसे ही रहेंगे) ...

// --- Firestore Listener (Policies) ---
// ... (पहले जैसा) ...
// --- Firestore Listener (Tasks) ---
// ... (पहले जैसा) ...
// --- फ़िल्टर, सॉर्ट और रेंडर (Policies) ---
// ... (पहले जैसा) ...
// --- टेबल रेंडरिंग (Policies) - Updated for Dynamic Next Due Date ---
// ... (पहले जैसा) ...
// --- Modal खोलना/बंद करना (Policy Add/Edit) ---
// ... (पहले जैसा) ...
// --- पॉलिसी सेव/अपडेट करना - Updated for Auto Calculation on Add ---
// ... (पहले जैसा) ...
// --- पॉलिसी डिलीट करना ---
// ... (पहले जैसा) ...
// --- प्रीमियम भुगतान मार्क करना ---
// ... (पहले जैसा) ...
// --- रिमाइंडर फंक्शन (Policies) ---
// ... (पहले जैसा) ...
// --- Task Management Functions ---
// ... (पहले जैसे) ...
// --- Phase 2 Functions (Client Detail) ---
// ... (पहले जैसे) ...
// --- हेल्पर फंक्शन्स ---
// ... (पहले जैसे) ...
// --- फिल्टर/सॉर्ट हैंडलर्स ---
// ... (पहले जैसे) ...
// --- एंड ऑफ़ फाइल ---