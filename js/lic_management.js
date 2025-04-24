// js/lic_management.js

// --- सुनिश्चित करें कि ग्लोबल Firebase फंक्शन्स उपलब्ध हैं ---
const {
    db, collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp,
    query, where, orderBy, limit, Timestamp, runTransaction
} = window;

// --- DOM एलिमेंट वेरिएबल्स ---
let licPolicyTableBody, reminderList, policyModal, policyForm, policyModalTitle, editPolicyId,
    addNewPolicyBtn, closePolicyModalBtn, cancelPolicyBtn, savePolicyBtn,
    licSearchInput, sortLicSelect, clearLicFiltersBtn, policyStatus, nachStatus,
    // Add more element variables as needed (e.g., for Task Management)
    newTaskInput, newTaskDueDate, addTaskBtn, taskList;


// --- ग्लोबल स्टेट ---
let currentLicSortField = 'createdAt';
let currentLicSortDirection = 'desc';
let unsubscribePolicies = null; // Firestore listener को बंद करने के लिए
let allPoliciesCache = []; // सभी पॉलिसियों का कैश
let searchDebounceTimerLic;


// --- पेज इनिशियलाइज़ेशन ---
function initializeLicPage() {
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
    policyStatus = document.getElementById('policyStatus'); // Status dropdown in modal
    nachStatus = document.getElementById('nachStatus');   // NACH dropdown in modal

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
    if (licSearchInput) licSearchInput.addEventListener('input', handleLicSearchInput);
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
        taskList.addEventListener('click', handleTaskDeleteClick); // For deleting tasks
    }


    // Firestore से डेटा सुनना शुरू करें
    listenForPolicies();
    // रिमाइंडर लोड करें
    displayReminders();
    // टास्क लोड करें (अगर टास्क फीचर इस्तेमाल कर रहे हैं)
    // loadTasks();
}

// --- Firestore Listener ---
function listenForPolicies() {
    if (unsubscribePolicies) unsubscribePolicies(); // पुराना listener बंद करें
    if (!db) { console.error("DB not initialized"); return; }

    const policiesRef = collection(db, "licCustomers"); // आपके कलेक्शन का नाम
    // Listener के लिए सरल क्वेरी, सॉर्टिंग/फिल्टरिंग क्लाइंट-साइड में होगी
    const q = query(policiesRef, orderBy(currentLicSortField, currentLicSortDirection)); // Initial sort

    unsubscribePolicies = db.onSnapshot(q, (snapshot) => { // Use db.onSnapshot or appropriate v9+ syntax
        allPoliciesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        applyLicFiltersAndRender(); // डेटा आने पर टेबल रेंडर करें
    }, (error) => {
        console.error("Error listening to policies:", error);
        if(licPolicyTableBody) licPolicyTableBody.innerHTML = `<tr><td colspan="9">Error loading data.</td></tr>`;
    });
}

// --- फ़िल्टर, सॉर्ट और रेंडर ---
function applyLicFiltersAndRender() {
     if (!allPoliciesCache) return;
     console.log("Applying LIC filters and rendering...");
     const searchTerm = licSearchInput.value.trim().toLowerCase();

     // 1. फ़िल्टर करें
     let filteredPolicies = allPoliciesCache.filter(policy => {
         // सर्च लॉजिक (नाम, पॉलिसी नंबर, मोबाइल पर सर्च करें)
         const nameMatch = (policy.customerName || '').toLowerCase().includes(searchTerm);
         const policyNoMatch = (policy.policyNumber || '').toLowerCase().includes(searchTerm);
         const mobileMatch = (policy.mobileNo || '').toLowerCase().includes(searchTerm);
         // आप और फ़िल्टर यहाँ जोड़ सकते हैं (जैसे स्टेटस फ़िल्टर)
         return nameMatch || policyNoMatch || mobileMatch;
     });

     // 2. सॉर्ट करें (वर्तमान सॉर्ट चयन के आधार पर)
     filteredPolicies.sort((a, b) => {
          let valA = a[currentLicSortField];
          let valB = b[currentLicSortField];
          // Timestamps और Numbers के लिए सही सॉर्टिंग हैंडल करें
           if (valA && typeof valA.toDate === 'function') valA = valA.toDate();
           if (valB && typeof valB.toDate === 'function') valB = valB.toDate();
           if (currentLicSortField === 'premiumAmount' || currentLicSortField === 'sumAssured') {
               valA = Number(valA) || 0; valB = Number(valB) || 0;
           }
           if (currentLicSortField === 'customerName') {
                valA = (valA || '').toLowerCase(); valB = (valB || '').toLowerCase();
           }
          // तुलना
          let comparison = 0;
          if (valA > valB) comparison = 1;
          else if (valA < valB) comparison = -1;
          return currentLicSortDirection === 'desc' ? (comparison * -1) : comparison;
     });


     // 3. टेबल रेंडर करें
     renderPolicyTable(filteredPolicies);
}

// --- टेबल रेंडरिंग ---
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
        row.insertCell().textContent = policy.premiumAmount ? `₹ ${policy.premiumAmount.toFixed(2)}` : '-';
        row.insertCell().textContent = policy.modeOfPayment || '-';
        row.insertCell().textContent = policy.nextInstallmentDate?.toDate ? formatDate(policy.nextInstallmentDate.toDate()) : '-';
        row.insertCell().innerHTML = `<span class="status-badge status-${(policy.policyStatus || 'unknown').toLowerCase()}">${policy.policyStatus || 'Unknown'}</span>`; // स्टेटस के लिए बैज

        // एक्शन बटन सेल
        const actionCell = row.insertCell();
        actionCell.classList.add('action-buttons'); // स्टाइल के लिए क्लास

        // Edit बटन
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.title = "Edit Policy";
        editBtn.classList.add('button', 'edit-button'); // अपनी थीम क्लास का उपयोग करें
        editBtn.onclick = (e) => { e.stopPropagation(); openPolicyModal(policy.id, policy); };
        actionCell.appendChild(editBtn);

        // Delete बटन
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.title = "Delete Policy";
        deleteBtn.classList.add('button', 'delete-button'); // अपनी थीम क्लास का उपयोग करें
        deleteBtn.onclick = (e) => { e.stopPropagation(); handleDeletePolicy(policy.id, policy.policyNumber); };
        actionCell.appendChild(deleteBtn);

         // (Optional) Detail View Link/Button
         // const detailBtn = document.createElement('button'); // या 'a' टैग
         // detailBtn.innerHTML = '<i class="fas fa-eye"></i>';
         // detailBtn.title = "View Details";
         // detailBtn.classList.add('button', 'info-button');
         // detailBtn.onclick = (e) => { e.stopPropagation(); window.location.href=`lic_policy_detail.html?id=${policy.id}`; }; // एक अलग डिटेल पेज पर भेजें
         // actionCell.appendChild(detailBtn);
    });
}

// --- Modal खोलना/बंद करना ---
function openPolicyModal(policyId = null, data = {}) {
    if (!policyModal || !policyForm) return;
    policyForm.reset(); // फॉर्म खाली करें
    editPolicyId.value = policyId || ''; // ID सेट करें (या खाली रखें)

    if (policyId) {
        // --- एडिट मोड ---
        policyModalTitle.textContent = "Edit Policy Details";
        // फॉर्म में मौजूदा डेटा भरें
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
        // --- ऐड मोड ---
        policyModalTitle.textContent = "Add New Policy";
        // यहाँ आप डिफ़ॉल्ट वैल्यू सेट कर सकते हैं, जैसे स्टेटस 'Active'
         if(policyStatus) policyStatus.value = 'Active';
         if(nachStatus) nachStatus.value = 'No';
         // अगली किस्त की तारीख को खाली छोड़ दें ताकि handleSavePolicy में कैलकुलेट हो सके
         document.getElementById('nextInstallmentDate').value = '';

    }
    policyModal.classList.add('active');
}

function closePolicyModal() {
    if (policyModal) policyModal.classList.remove('active');
}

// --- पॉलिसी सेव/अपडेट करना ---
async function handleSavePolicy(event) {
    event.preventDefault();
    if (!db) { alert("Database not ready."); return; }

    const policyId = editPolicyId.value; // Get ID from hidden input
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
        issuanceDate: document.getElementById('issuanceDate').value ? Timestamp.fromDate(new Date(document.getElementById('issuanceDate').value + 'T00:00:00Z')) : null, // Ensure Timestamp
        modeOfPayment: document.getElementById('modeOfPayment').value,
        premiumAmount: parseFloat(document.getElementById('premiumAmount').value) || 0,
        // nextInstallmentDate को नीचे हैंडल करेंगे
        maturityDate: document.getElementById('maturityDate').value ? Timestamp.fromDate(new Date(document.getElementById('maturityDate').value)) : null,
        policyStatus: policyStatus ? policyStatus.value : 'Active',
        nachStatus: nachStatus ? nachStatus.value : 'No',
        updatedAt: serverTimestamp()
    };

    // --- वैलिडेशन ---
    if (!formData.customerName || !formData.mobileNo || !formData.policyNumber || !formData.issuanceDate || !formData.modeOfPayment || formData.premiumAmount <= 0) {
        alert("Please fill all required (*) fields with valid data.");
        return;
    }

     // --- अगली किस्त की तारीख की गणना ---
     let nextDateInput = document.getElementById('nextInstallmentDate').value;
     if (nextDateInput) {
          // अगर यूजर ने तारीख डाली है, तो उसे इस्तेमाल करें
          formData.nextInstallmentDate = Timestamp.fromDate(new Date(nextDateInput + 'T00:00:00Z'));
     } else if (!isEditing && formData.issuanceDate && formData.modeOfPayment) {
          // अगर नया रिकॉर्ड है और यूजर ने तारीख नहीं डाली, तो कैलकुलेट करें
          const calculatedNextDate = calculateNextDueDate(formData.issuanceDate.toDate(), formData.modeOfPayment);
          if (calculatedNextDate) {
               formData.nextInstallmentDate = Timestamp.fromDate(calculatedNextDate);
          } else {
               alert("Could not calculate next installment date based on mode of payment.");
               return; // रोकें अगर गणना संभव नहीं है
          }
     } else if (isEditing && !nextDateInput) {
          // अगर एडिट कर रहे हैं और तारीख हटा दी गई है, तो एरर दें या मौजूदा रखें
          alert("Please provide the next installment date when editing.");
          return;
          // या formData.nextInstallmentDate = मौजूदा डेटा से लें (अगर ज़रूरत हो)
     }


    // --- सेव/अपडेट लॉजिक ---
    savePolicyBtn.disabled = true;
    savePolicyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        if (isEditing) {
            // अपडेट
            const policyRef = doc(db, "licCustomers", policyId);
            // createdAt फ़ील्ड को अपडेट न करें
            delete formData.createdAt; // Avoid overwriting createdAt
            await updateDoc(policyRef, formData);
            alert("Policy updated successfully!");
        } else {
            // ऐड
            formData.createdAt = serverTimestamp(); // केवल नए रिकॉर्ड के लिए createdAt जोड़ें
            await addDoc(collection(db, "licCustomers"), formData);
            alert("New policy added successfully!");
        }
        closePolicyModal();
        // टेबल और रिमाइंडर ऑटो-रिफ्रेश होंगे listener के कारण, या आप मैन्युअली कॉल कर सकते हैं
        displayReminders(); // रिमाइंडर तुरंत अपडेट करें

    } catch (error) {
        console.error("Error saving policy:", error);
        alert("Error saving policy: " + error.message);
    } finally {
        savePolicyBtn.disabled = false;
        savePolicyBtn.innerHTML = '<i class="fas fa-save"></i> Save Policy'; // Restore button text
    }
}

// --- पॉलिसी डिलीट करना ---
async function handleDeletePolicy(policyId, policyNumber) {
    if (!db) { alert("Database not ready."); return; }
    if (confirm(`Are you sure you want to delete policy number "${policyNumber || policyId}"? This cannot be undone.`)) {
        try {
            await deleteDoc(doc(db, "licCustomers", policyId));
            alert(`Policy ${policyNumber || policyId} deleted successfully.`);
            // Listener टेबल को ऑटो-अपडेट कर देगा
             displayReminders(); // रिमाइंडर लिस्ट भी अपडेट करें
        } catch (error) {
            console.error("Error deleting policy:", error);
            alert("Error deleting policy: " + error.message);
        }
    }
}

// --- रिमाइंडर फंक्शन ---
async function displayReminders() {
    if (!db || !reminderList) return;
    reminderList.innerHTML = '<li class="loading-reminder">Loading reminders...</li>'; // लोडिंग दिखाएं

    try {
        const today = new Date();
        const reminderDays = 15; // कितने दिन पहले रिमाइंडर चाहिए
        const reminderEndDate = new Date(today);
        reminderEndDate.setDate(today.getDate() + reminderDays);

        const todayTimestamp = Timestamp.fromDate(today);
        const endTimestamp = Timestamp.fromDate(reminderEndDate);

        const reminderQuery = query(collection(db, "licCustomers"),
                                 where("nextInstallmentDate", ">=", todayTimestamp),
                                 where("nextInstallmentDate", "<=", endTimestamp),
                                 orderBy("nextInstallmentDate")); // तारीख के अनुसार सॉर्ट करें

        const querySnapshot = await getDocs(reminderQuery);
        reminderList.innerHTML = ''; // लिस्ट खाली करें

        if (querySnapshot.empty) {
            reminderList.innerHTML = '<li>No upcoming installments in the next ' + reminderDays + ' days.</li>';
            return;
        }

        querySnapshot.forEach(docSnap => {
            const policy = { id: docSnap.id, ...docSnap.data() };
            const li = document.createElement('li');
            li.setAttribute('data-doc-id', policy.id); // Store ID for checkbox handler

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'reminder-checkbox';
             // आप चाहें तो इसे डिफ़ॉल्ट रूप से अनचेक रख सकते हैं

            const span = document.createElement('span');
            span.innerHTML = `Policy: <strong>${policy.policyNumber || 'N/A'}</strong> - Name: <strong>${policy.customerName || 'N/A'}</strong> - Amount: <strong>₹ ${policy.premiumAmount?.toFixed(2) || 'N/A'}</strong> - Due: <strong>${formatDate(policy.nextInstallmentDate?.toDate())}</strong>`;

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
    if (event.target.classList.contains('reminder-checkbox')) {
        const checkbox = event.target;
        const listItem = checkbox.closest('li');
        const docId = listItem?.dataset.docId;

        if (checkbox.checked && listItem) {
            // विकल्प A: सिर्फ छिपाएं
            listItem.classList.add('hidden-reminder'); // CSS में .hidden-reminder { display: none; } डालें
            console.log(`Reminder for ${docId} hidden temporarily.`);

            // विकल्प B (अधिक जटिल): Firestore में अपडेट करें कि यह हैंडल हो गया है
            // const policyRef = doc(db, "licCustomers", docId);
            // try {
            //    await updateDoc(policyRef, { reminderHandledUntil: Timestamp.now() });
            //    console.log(`Marked reminder ${docId} as handled.`);
            //    listItem.classList.add('hidden-reminder'); // छिपाएं
            // } catch (error) {
            //     console.error("Error marking reminder as handled:", error);
            //     checkbox.checked = false; // विफल होने पर अनचेक करें
            // }

        } else if (!checkbox.checked && listItem) {
             // अगर अनचेक किया जाता है, तो दोबारा दिखाएं (अगर छिपाया गया था)
             listItem.classList.remove('hidden-reminder');
        }
    }
}


// --- टास्क मैनेजमेंट फंक्शन्स (Skeleton) ---
async function handleAddTask() {
    const description = newTaskInput.value.trim();
    const dueDate = newTaskDueDate.value;
    if (!description) { alert("Please enter task description."); return; }

    const taskData = {
        description: description,
        dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate)) : null,
        completed: false,
        createdAt: serverTimestamp()
        // आप चाहें तो इसे किसी कस्टमर से लिंक कर सकते हैं (e.g., customerId: currentCustomerId)
    };

    try {
        // Firestore में 'tasks' कलेक्शन में सेव करें (या कस्टमर के सब-कलेक्शन में)
        // await addDoc(collection(db, "tasks"), taskData);
        alert("Task added (Implement Firestore save!)");
        newTaskInput.value = '';
        newTaskDueDate.value = '';
        // loadTasks(); // टास्क लिस्ट रिफ्रेश करें
    } catch (error) {
        console.error("Error adding task:", error);
        alert("Failed to add task.");
    }
}

function handleTaskCheckboxChange(event) {
     if (event.target.classList.contains('task-checkbox')) {
          const checkbox = event.target;
          const listItem = checkbox.closest('li');
          const taskId = listItem?.dataset.taskId;
          const isCompleted = checkbox.checked;

          if (taskId) {
               console.log(`Task ${taskId} status changed to: ${isCompleted}`);
               // Firestore में 'tasks' कलेक्शन में completed स्टेटस अपडेट करें
               // const taskRef = doc(db, "tasks", taskId);
               // try {
               //     await updateDoc(taskRef, { completed: isCompleted });
               //     listItem.querySelector('span').style.textDecoration = isCompleted ? 'line-through' : 'none';
               //     listItem.querySelector('span').style.color = isCompleted ? '#6c757d' : 'inherit';
               // } catch (error) { console.error("Error updating task status:", error); checkbox.checked = !isCompleted; } // Revert on error
          }
     }
}

function handleTaskDeleteClick(event) {
    if (event.target.closest('.delete-task-btn')) {
         const listItem = event.target.closest('li');
         const taskId = listItem?.dataset.taskId;
         if (taskId && confirm("Delete this task?")) {
              console.log("Deleting task:", taskId);
              // Firestore से टास्क डिलीट करें
              // try {
              //      await deleteDoc(doc(db, "tasks", taskId));
              //      listItem.remove();
              // } catch (error) { console.error("Error deleting task:", error); alert("Failed to delete task.");}
         }
    }
}

// function loadTasks() {
//     // Firestore से 'tasks' कलेक्शन से टास्क लाएं और #taskList में दिखाएं
//     taskList.innerHTML = '<li class="loading-tasks">Implement task loading...</li>';
// }


// --- हेल्पर फंक्शन्स ---
function formatDate(date) {
    if (!date || !(date instanceof Date)) return '-';
    // सरल भारतीय फॉर्मेट dd-mm-yyyy
    let day = String(date.getDate()).padStart(2, '0');
    let month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    let year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

function calculateNextDueDate(startDate, mode) {
    if (!(startDate instanceof Date) || !mode) return null;
    let nextDate = new Date(startDate);
    try {
        switch (mode.toLowerCase()) {
            case 'yearly':
                nextDate.setFullYear(nextDate.getFullYear() + 1);
                break;
            case 'half-yearly':
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
                return null; // अज्ञात मोड के लिए गणना न करें
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
        applyLicFiltersAndRender();
    }, 350);
}

function handleLicSortChange() {
    if (!sortLicSelect) return;
    const [field, direction] = sortLicSelect.value.split('_');
    currentLicSortField = field;
    currentLicSortDirection = direction;
    applyLicFiltersAndRender();
}

function clearLicFilters() {
    if(licSearchInput) licSearchInput.value = '';
    if(sortLicSelect) sortLicSelect.value = 'createdAt_desc'; // डिफ़ॉल्ट सॉर्ट पर रीसेट करें
    currentLicSortField = 'createdAt';
    currentLicSortDirection = 'desc';
    // आप चाहें तो अन्य फ़िल्टर (जैसे स्टेटस) भी यहाँ रीसेट कर सकते हैं
    applyLicFiltersAndRender();
}


// --- सुनिश्चित करें कि पेज लोड होने पर इनिशियलाइज़ेशन हो ---
// DOMContentLoaded इवेंट लिस्नर आपके HTML के Firebase सेटअप ब्लॉक में initializeLicPage को कॉल करेगा।