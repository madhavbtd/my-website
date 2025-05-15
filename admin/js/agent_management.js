// /admin/js/agent_management.js

// firebase-init.js से db, auth, और functions इम्पोर्ट करें
import { db, auth, functions } from './firebase-init.js';

// Firestore SDK से बाकी आवश्यक फंक्शन्स
import {
    collection, onSnapshot, query, orderBy, doc,
    updateDoc, getDoc, getDocs, serverTimestamp, where, limit, setDoc, addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Functions SDK से httpsCallable इम्पोर्ट करें
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

// --- DOM Elements ---
const addNewAgentBtn = document.getElementById('addNewAgentBtn');
const agentTableBody = document.getElementById('agentTableBody');
const loadingAgentMessage = document.getElementById('loadingAgentMessage');
const noAgentsMessage = document.getElementById('noAgentsMessage');
const agentModal = document.getElementById('agentModal');
const agentModalTitle = document.getElementById('agentModalTitle');
const closeAgentModalBtn = document.getElementById('closeAgentModal');
const cancelAgentBtn = document.getElementById('cancelAgentBtn');
const saveAgentBtn = document.getElementById('saveAgentBtn');
const saveAgentBtnText = document.getElementById('saveAgentBtnText');
const agentForm = document.getElementById('agentForm');
const editAgentIdInput = document.getElementById('editAgentId');
const agentNameInput = document.getElementById('agentName');
const agentEmailInput = document.getElementById('agentEmail');
const agentContactInput = document.getElementById('agentContact');
const agentPasswordInput = document.getElementById('agentPassword');
const agentPasswordGroup = document.getElementById('agentPasswordGroup');
const passwordRequiredSpan = document.getElementById('passwordRequiredSpan');
const agentStatusSelect = document.getElementById('agentStatus');
const categoryPermissionsDiv = document.getElementById('categoryPermissionsCheckboxes');
const selectAllCategoriesBtn = document.getElementById('selectAllCategoriesBtn');
const deselectAllCategoriesBtn = document.getElementById('deselectAllCategoriesBtn');
const agentModalError = document.getElementById('agentModalError');
const filterSearchInput = document.getElementById('agentSearch');
const sortSelect = document.getElementById('sort-agents');
const clearFiltersBtn = document.getElementById('clearAgentFiltersBtn');

const userTypeAgentRadio = document.getElementById('userTypeAgent');
const userTypeWholesaleRadio = document.getElementById('userTypeWholesale');
const agentPermissionsDiv = document.getElementById('agentPermissions');
const wholesalePermissionsDiv = document.getElementById('wholesalePermissions');
const canAddCustomersCheckbox = document.getElementById('canAddCustomersCheckbox');
const authUidInput = document.getElementById('authUidInput');

const nameError = document.getElementById('nameError');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');

// --- Global State ---
let availableCategories = [];
let currentAgents = [];
let unsubscribeAgents = null;
let searchDebounceTimer;

// --- Helper Functions ---
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') unsafe = String(unsafe || '');
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function showModalError(message) {
    if (agentModalError) {
        agentModalError.textContent = message;
        agentModalError.style.display = message ? 'block' : 'none';
    }
}

function clearModalError() {
    showModalError('');
}

function clearFieldErrors() {
    if (nameError) nameError.textContent = '';
    if (emailError) emailError.textContent = '';
    if (passwordError) passwordError.textContent = '';
}

function showFieldError(fieldId, message) {
    const errorElement = document.getElementById(fieldId + 'Error');
    if (errorElement) {
        errorElement.textContent = message;
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function getStatusClass(status) {
    return status === 'active' ? 'status-active' : 'status-inactive';
}

function handleUserTypeChange() {
    if (!userTypeAgentRadio || !userTypeWholesaleRadio || !agentPermissionsDiv || !wholesalePermissionsDiv) return;
    if (userTypeAgentRadio.checked) {
        agentPermissionsDiv.style.display = 'block';
        wholesalePermissionsDiv.style.display = 'none';
    } else if (userTypeWholesaleRadio.checked) {
        agentPermissionsDiv.style.display = 'none';
        wholesalePermissionsDiv.style.display = 'block';
    }
}

// --- Modal Handling ---
function openAgentModal(mode = 'add', agentData = null) {
    if (!agentModal || !agentForm) return;

    clearModalError();
    clearFieldErrors();
    agentForm.reset();

    const authUidFieldGroup = authUidInput ? authUidInput.closest('.form-group') : null;

    if (editAgentIdInput) editAgentIdInput.value = '';
    if (authUidInput) {
        authUidInput.value = '';
        authUidInput.readOnly = false;
    }
    if (agentEmailInput) {
        agentEmailInput.readOnly = false;
        agentEmailInput.placeholder = 'Enter login email';
    }
    if(agentPasswordInput) {
        agentPasswordInput.placeholder = 'Required (min 6 characters)';
    }


    if (categoryPermissionsDiv) {
        const checkboxes = categoryPermissionsDiv.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => { if (cb) cb.checked = false; });
    }

    if (mode === 'add') {
        if (agentModalTitle) agentModalTitle.textContent = 'Add New Agent';
        if (saveAgentBtnText) saveAgentBtnText.textContent = 'Save Agent';
        if (agentPasswordInput) agentPasswordInput.required = true;
        if (agentPasswordGroup) agentPasswordGroup.style.display = '';
        if (passwordRequiredSpan) passwordRequiredSpan.style.display = 'inline';
        if (agentStatusSelect) agentStatusSelect.value = 'active';
        if (canAddCustomersCheckbox) canAddCustomersCheckbox.checked = false;

        if (userTypeAgentRadio) userTypeAgentRadio.checked = true;
        handleUserTypeChange();

        if (authUidFieldGroup) authUidFieldGroup.style.display = 'none';

    } else if (mode === 'edit' && agentData) {
        if (agentModalTitle) agentModalTitle.textContent = `Edit Agent: ${escapeHtml(agentData.name || '')}`;
        if (saveAgentBtnText) saveAgentBtnText.textContent = 'Update Agent';
        if (editAgentIdInput) editAgentIdInput.value = agentData.id;

        if (authUidInput) {
            authUidInput.value = agentData.authUid || '';
            authUidInput.readOnly = true;
        }
        if (authUidFieldGroup) authUidFieldGroup.style.display = '';

        if (agentNameInput) agentNameInput.value = agentData.name || '';
        if (agentEmailInput) {
             agentEmailInput.value = agentData.email || '';
             agentEmailInput.readOnly = true;
             agentEmailInput.placeholder = '';
        }
        if (agentContactInput) agentContactInput.value = agentData.contact || '';
        if (agentStatusSelect) agentStatusSelect.value = agentData.status || 'inactive';
        if (canAddCustomersCheckbox) canAddCustomersCheckbox.checked = agentData.canAddCustomers || false;

        if (agentPasswordInput) {
            agentPasswordInput.required = false;
            if (agentPasswordGroup) agentPasswordGroup.style.display = '';
            if (passwordRequiredSpan) passwordRequiredSpan.style.display = 'none';
            agentPasswordInput.value = '';
            agentPasswordInput.placeholder = 'Leave blank to keep current password';
        }

        if (agentData.userType === 'agent' && userTypeAgentRadio) {
            userTypeAgentRadio.checked = true;
        } else if (agentData.userType === 'wholesale' && userTypeWholesaleRadio) {
            userTypeWholesaleRadio.checked = true;
        }
        handleUserTypeChange();

        if (agentData.permissions && Array.isArray(agentData.permissions)) {
            agentData.permissions.forEach(permission => {
                const checkbox = document.querySelector(`#agentPermissions input[value="${permission}"], #wholesalePermissions input[value="${permission}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }

        if (agentData.allowedCategories && Array.isArray(agentData.allowedCategories)) {
            agentData.allowedCategories.forEach(categoryName => {
                try {
                    const checkbox = categoryPermissionsDiv.querySelector(`input[value="${escapeHtml(categoryName)}"]`);
                    if (checkbox) checkbox.checked = true;
                } catch (e) {
                    console.error(`Error finding checkbox for category: ${categoryName}`, e);
                }
            });
        }
    } else if (mode === 'edit' && !agentData) {
        console.error("Invalid mode or missing agentData for edit.");
        showModalError("Could not load agent data for editing.");
        return;
    }

    if (agentModal) agentModal.classList.add('active');
}

function closeAgentModal() {
    if (agentModal) agentModal.classList.remove('active');
}

// --- Category Handling ---
async function fetchCategories() {
    // ... (आपका मौजूदा fetchCategories कोड वैसा ही रहेगा) ...
    if (!db || !collection || !getDocs) {
        console.error("Firestore functions not available for fetching categories.");
        if (categoryPermissionsDiv) categoryPermissionsDiv.innerHTML = '<p style="color: red;">Error loading categories (DB functions missing).</p>';
        return;
    }
    try {
        const productsRef = collection(db, "onlineProducts");
        const q = query(productsRef, where("isEnabled", "==", true));
        const snapshot = await getDocs(q);
        const categories = new Set();
        snapshot.docs.forEach(doc => {
            const category = doc.data()?.category;
            if (category) {
                categories.add(String(category).trim());
            }
        });
        availableCategories = Array.from(categories).sort();
        populateCategoryCheckboxes();
    } catch (error) {
        console.error("Error fetching categories:", error);
        if (categoryPermissionsDiv) categoryPermissionsDiv.innerHTML = `<p style="color: red;">Error loading categories: ${error.message}</p>`;
    }
}

function populateCategoryCheckboxes() {
    // ... (आपका मौजूदा populateCategoryCheckboxes कोड वैसा ही रहेगा) ...
    if (!categoryPermissionsDiv) return;
    categoryPermissionsDiv.innerHTML = '';
    if (availableCategories.length === 0) {
        categoryPermissionsDiv.innerHTML = '<p>No categories found or failed to load.</p>';
        return;
    }
    availableCategories.forEach(category => {
        const checkboxId = `category-${escapeHtml(category).replace(/\s+/g, '-')}`;
        const label = document.createElement('label');
        label.htmlFor = checkboxId;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = checkboxId;
        checkbox.value = category;
        checkbox.name = 'allowedCategories';
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${escapeHtml(category)}`));
        categoryPermissionsDiv.appendChild(label);
    });
}

// --- Agent Data Handling ---
function displayAgentRow(agentId, agentData) {
    // ... (आपका मौजूदा displayAgentRow कोड वैसा ही रहेगा) ...
    if (!agentTableBody) return;
    const row = agentTableBody.insertRow();
    row.setAttribute('data-id', agentId);

    const name = escapeHtml(agentData.name || 'N/A');
    const email = escapeHtml(agentData.email || 'N/A');
    const contact = escapeHtml(agentData.contact || '-');
    const status = escapeHtml(agentData.status || 'inactive');
    const statusClass = getStatusClass(agentData.status);
    const canAddCustomersText = agentData.canAddCustomers ? '<i class="fas fa-check-circle" style="color: var(--success-color);"></i> Yes' : '<i class="fas fa-times-circle" style="color: var(--danger-color);"></i> No';
    const userTypeText = escapeHtml(agentData.userType || 'N/A');

    row.innerHTML = `
        <td>${name}</td>
        <td>${email}</td>
        <td>${contact}</td>
        <td>${userTypeText}</td>
        <td style="text-align:center;"><span class="status-badge ${statusClass}">${status}</span></td>
        <td style="text-align:center;">${canAddCustomersText}</td>
        <td style="text-align:center;">
            <div class="action-buttons-container">
                <button class="button action-button edit-button" data-action="edit" title="Edit Agent & Permissions">
                    <i class="fas fa-edit"></i> Edit
                </button>
            </div>
        </td>
    `;

    const editBtn = row.querySelector('button[data-action="edit"]');
    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openAgentModal('edit', { id: agentId, ...agentData });
        });
    }
}

function loadAgents() {
    // ... (आपका मौजूदा loadAgents कोड वैसा ही रहेगा) ...
    if (!db || !collection || !onSnapshot || !query || !orderBy || !agentTableBody || !loadingAgentMessage || !noAgentsMessage) {
        console.error("Required Firestore functions or DOM elements missing for loadAgents.");
        if (agentTableBody) agentTableBody.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center;">Error loading agents (dependencies missing).</td></tr>';
        if (loadingAgentMessage) loadingAgentMessage.style.display = 'none';
        if (noAgentsMessage) noAgentsMessage.style.display = 'table-row';
        return;
    }

    if (loadingAgentMessage) loadingAgentMessage.style.display = 'table-row';
    if (noAgentsMessage) noAgentsMessage.style.display = 'none';

    const rows = agentTableBody.querySelectorAll('tr:not(#loadingAgentMessage)');
    rows.forEach(row => row.remove());

    if (unsubscribeAgents) unsubscribeAgents();

    const agentsRef = collection(db, "agents");
    const sortValue = sortSelect ? sortSelect.value : 'createdAt_desc';
    let firestoreSortField = 'createdAt';
    let firestoreSortDirection = 'desc';

    if (sortValue === 'name_asc') {
        firestoreSortField = 'name_lowercase';
        firestoreSortDirection = 'asc';
    } else if (sortValue === 'name_desc') {
        firestoreSortField = 'name_lowercase';
        firestoreSortDirection = 'desc';
    }

    const q = query(agentsRef, orderBy(firestoreSortField, firestoreSortDirection));

    unsubscribeAgents = onSnapshot(q, (snapshot) => {
        if (loadingAgentMessage) loadingAgentMessage.style.display = 'none';
        currentAgents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        applyAgentFilters();
    }, (error) => {
        console.error("Error fetching agents:", error);
        if (loadingAgentMessage) loadingAgentMessage.style.display = 'none';
        if (agentTableBody) agentTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error loading agents: ${error.message}</td></tr>`;
        if (noAgentsMessage) noAgentsMessage.style.display = 'none';
    });
}

function applyAgentFilters() {
    // ... (आपका मौजूदा applyAgentFilters कोड वैसा ही रहेगा) ...
    if (!agentTableBody || !noAgentsMessage) return;
    const searchTerm = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';

    const filteredAgents = currentAgents.filter(agent => {
        if (!searchTerm) return true;
        const nameMatch = agent.name?.toLowerCase().includes(searchTerm);
        const emailMatch = agent.email?.toLowerCase().includes(searchTerm);
        const contactMatch = agent.contact?.toLowerCase().includes(searchTerm);
        return nameMatch || emailMatch || contactMatch;
    });

    const currentTableRows = agentTableBody.querySelectorAll('tr:not(#loadingAgentMessage)');
    currentTableRows.forEach(row => row.remove());

    if (filteredAgents.length === 0) {
        noAgentsMessage.style.display = 'table-row';
    } else {
        noAgentsMessage.style.display = 'none';
        filteredAgents.forEach(agent => {
            displayAgentRow(agent.id, agent);
        });
    }
}

// --- Save Agent Function (Cloud Function का उपयोग करके) ---
async function handleSaveAgent(event) {
    event.preventDefault();
    if (!saveAgentBtn) return;

    const agentId = editAgentIdInput?.value;
    const isEditing = !!agentId;

    saveAgentBtn.disabled = true;
    const originalButtonText = saveAgentBtnText.textContent;
    if (saveAgentBtnText) saveAgentBtnText.textContent = (isEditing ? 'Updating...' : 'Saving...');
    clearModalError();
    clearFieldErrors();

    const name = agentNameInput?.value.trim();
    const email = agentEmailInput?.value.trim().toLowerCase();
    const password = agentPasswordInput?.value;
    const contact = agentContactInput?.value.trim() || null;
    const status = agentStatusSelect?.value;
    const userType = document.querySelector('input[name="userType"]:checked')?.value;
    const canAddCustomers = canAddCustomersCheckbox ? canAddCustomersCheckbox.checked : false;

    const selectedCategories = [];
    if (categoryPermissionsDiv) {
        const categoryCheckboxes = categoryPermissionsDiv.querySelectorAll('input[type="checkbox"]:checked');
        categoryCheckboxes.forEach(cb => selectedCategories.push(cb.value));
    }

    let permissions = [];
    if (userType === 'agent') {
        const checkedPermissions = document.querySelectorAll('#agentPermissions input[type="checkbox"]:checked');
        checkedPermissions.forEach(cb => permissions.push(cb.value));
    } else if (userType === 'wholesale') {
        const checkedPermissions = document.querySelectorAll('#wholesalePermissions input[type="checkbox"]:checked');
        checkedPermissions.forEach(cb => permissions.push(cb.value));
    }

    // --- क्लाइंट-साइड वैलिडेशन ---
    let isValid = true;
    if (!name) {
        showFieldError('name', 'Agent Name is required.');
        isValid = false;
    }
    if (!email) {
        showFieldError('email', 'Login Email is required.');
        isValid = false;
    } else if (!isValidEmail(email)) {
        showFieldError('email', 'Invalid email format.');
        isValid = false;
    }
    if (!isEditing && (!password || password.length < 6)) {
        showFieldError('password', 'Password is required for new agents (min 6 characters).');
        isValid = false;
    }
    if (!userType) {
        showModalError('Please select a User Type.');
        isValid = false;
    }

    if (!isValid) {
        saveAgentBtn.disabled = false;
        if (saveAgentBtnText) saveAgentBtnText.textContent = (isEditing ? 'Update Agent' : 'Save Agent');
        return;
    }

    if (isEditing) {
        // --- मौजूदा एजेंट को अपडेट करने का लॉजिक ---
        try {
            if (!db || !doc || !updateDoc || !serverTimestamp) {
                 showModalError("Error: Firestore functions for update missing.");
                 throw new Error("Firestore functions for update missing.");
            }
            const agentDataToUpdate = {
                name: name,
                name_lowercase: name.toLowerCase(),
                contact: contact,
                status: status,
                userType: userType,
                permissions: permissions,
                allowedCategories: selectedCategories,
                canAddCustomers: canAddCustomers,
                updatedAt: serverTimestamp()
            };

            await updateDoc(doc(db, "agents", agentId), agentDataToUpdate);
            showModalError("Agent updated successfully!");
            agentForm.reset();
            setTimeout(closeAgentModal, 1500);
            loadAgents();
        } catch (error) {
            console.error("Error updating agent in Firestore:", error);
            showModalError("Error updating agent: " + error.message);
        } finally {
            saveAgentBtn.disabled = false;
            if (saveAgentBtnText) saveAgentBtnText.textContent = 'Update Agent';
        }
    } else {
        // --- नया एजेंट बनाने के लिए Cloud Function कॉल करें ---
        const createAgentUserCallable = httpsCallable(functions, 'createAgentUser');

        const agentPayload = {
            email: email,
            password: password,
            name: name,
            contact: contact,
            status: status,
            userType: userType,
            permissions: permissions,
            allowedCategories: selectedCategories,
            canAddCustomers: canAddCustomers
        };

        try {
            if (!auth.currentUser) {
                showModalError("Admin is not authenticated. Please login again.");
                saveAgentBtn.disabled = false;
                if (saveAgentBtnText) saveAgentBtnText.textContent = 'Save Agent';
                console.warn("Admin not authenticated before calling Cloud Function.");
                return;
            }

            try {
                console.log("Forcing token refresh for admin:", auth.currentUser.uid);
                await auth.currentUser.getIdToken(true);
                console.log("Token refreshed successfully before calling function.");
            } catch (tokenError) {
                console.error("Error forcing token refresh:", tokenError);
                showModalError("Authentication token refresh failed. Please try again or re-login.");
                saveAgentBtn.disabled = false;
                if (saveAgentBtnText) saveAgentBtnText.textContent = 'Save Agent';
                return;
            }

            console.log("Calling createAgentUser Cloud Function with payload by admin:", auth.currentUser.uid, agentPayload);
            const result = await createAgentUserCallable(agentPayload);

            console.log("Cloud function 'createAgentUser' result:", result);
            if (result.data.success) {
                showModalError(result.data.message || "Agent created successfully!");
                agentForm.reset();
                setTimeout(closeAgentModal, 1500);
                loadAgents();
            } else {
                showModalError(result.data.message || "Failed to create agent (server validation).");
            }
        } catch (error) {
            console.error("Error calling 'createAgentUser' Cloud Function:", error);
            showModalError(`Error: ${error.message || "Could not connect to agent creation service."}`);
        } finally {
            saveAgentBtn.disabled = false;
            if (saveAgentBtnText) saveAgentBtnText.textContent = 'Save Agent';
        }
    }
}

// --- Event Listeners ---
if (addNewAgentBtn) addNewAgentBtn.addEventListener('click', () => openAgentModal('add'));
if (closeAgentModalBtn) closeAgentModalBtn.addEventListener('click', closeAgentModal);
if (cancelAgentBtn) cancelAgentBtn.addEventListener('click', closeAgentModal);
if (agentForm) agentForm.addEventListener('submit', handleSaveAgent);

if (userTypeAgentRadio) userTypeAgentRadio.addEventListener('change', handleUserTypeChange);
if (userTypeWholesaleRadio) userTypeWholesaleRadio.addEventListener('change', handleUserTypeChange);

if (selectAllCategoriesBtn) selectAllCategoriesBtn.addEventListener('click', () => {
    if(categoryPermissionsDiv) {
        const checkboxes = categoryPermissionsDiv.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => { if (cb) cb.checked = true; });
    }
});
if (deselectAllCategoriesBtn) deselectAllCategoriesBtn.addEventListener('click', () => {
    if(categoryPermissionsDiv) {
        const checkboxes = categoryPermissionsDiv.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => { if (cb) cb.checked = false; });
    }
});
if (filterSearchInput) filterSearchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(applyAgentFilters, 300);
});
if (sortSelect) sortSelect.addEventListener('change', loadAgents);
if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', () => {
    if (filterSearchInput) filterSearchInput.value = '';
    if (sortSelect) sortSelect.value = 'createdAt_desc';
    loadAgents();
});

// --- Initialization and Simple Auth Test ---
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof fetchCategories === "function") fetchCategories();
    if (typeof loadAgents === "function") loadAgents();
    if (typeof handleUserTypeChange === "function") handleUserTypeChange();

    // ---- सरलतम टेस्ट फंक्शन कॉल ----
    if (auth && functions) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 सेकंड प्रतीक्षा करें

        if (auth.currentUser) {
            console.log("Attempting to call simpleAuthTest as user:", auth.currentUser.email);
            const simpleTestCallable = httpsCallable(functions, 'simpleAuthTest'); // 'simpleAuthTest' फंक्शन आपके Cloud Functions में होना चाहिए
            try {
                // ID टोकन को यहाँ भी रिफ्रेश करने का प्रयास करें
                await auth.currentUser.getIdToken(true);
                console.log("Token refreshed for simpleAuthTest call.");

                const result = await simpleTestCallable({ testPayload: "Hello from client" });
                console.log("SUCCESS from simpleAuthTest:", result.data);
                // alert("Simple Auth Test SUCCESSFUL: " + JSON.stringify(result.data)); // अलर्ट को अस्थायी रूप से हटा दें
            } catch (error) {
                console.error("ERROR from simpleAuthTest:", error);
                // alert("Simple Auth Test FAILED: " + error.message); // अलर्ट को अस्थायी रूप से हटा दें
            }
        } else {
            console.warn("simpleAuthTest: No authenticated user found when DOMContentLoaded fired and delay passed.");
            // alert("Simple Auth Test SKIPPED: No authenticated user. Please log in."); // अलर्ट को अस्थायी रूप से हटा दें
        }
    } else {
        console.error("simpleAuthTest: Firebase auth or functions service not initialized.");
        // alert("Simple Auth Test SKIPPED: Firebase services not ready."); // अलर्ट को अस्थायी रूप से हटा दें
    }
    // ---- टेस्ट समाप्त ----
});