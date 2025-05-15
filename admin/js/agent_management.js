// /admin/js/agent_management.js

import { db } from './firebase-init.js';
import {
    collection, onSnapshot, query, orderBy, doc,
    updateDoc, getDoc, getDocs, serverTimestamp, where, limit, setDoc,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Firebase Authentication के लिए नया इम्पोर्ट ---
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
// --- ---

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
const authUidInput = document.getElementById('authUidInput'); // Authentication User ID

// New error message elements
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
    if (userTypeAgentRadio && userTypeAgentRadio.checked) {
        if (agentPermissionsDiv) agentPermissionsDiv.style.display = 'block';
        if (wholesalePermissionsDiv) wholesalePermissionsDiv.style.display = 'none';
    } else if (userTypeWholesaleRadio && userTypeWholesaleRadio.checked) {
        if (agentPermissionsDiv) agentPermissionsDiv.style.display = 'none';
        if (wholesalePermissionsDiv) wholesalePermissionsDiv.style.display = 'block';
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
        if (agentPasswordInput) agentPasswordInput.placeholder = 'Required (min 6 characters)';
        if (agentEmailInput) agentEmailInput.placeholder = 'Enter login email';


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
             agentEmailInput.readOnly = true; // ईमेल को एडिट मोड में readonly, क्योंकि Auth User इससे लिंक है
             agentEmailInput.placeholder = '';
        }
        if (agentContactInput) agentContactInput.value = agentData.contact || '';
        if (agentStatusSelect) agentStatusSelect.value = agentData.status || 'inactive';
        if (canAddCustomersCheckbox) canAddCustomersCheckbox.checked = agentData.canAddCustomers || false;

        if (agentPasswordInput) {
            agentPasswordInput.required = false;
            if (agentPasswordGroup) agentPasswordGroup.style.display = ''; // सुनिश्चित करें कि यह दिख रहा है
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
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        }

        if (agentData.allowedCategories && Array.isArray(agentData.allowedCategories)) {
            agentData.allowedCategories.forEach(categoryName => {
                try {
                    const checkbox = categoryPermissionsDiv.querySelector(`input[value="${escapeHtml(categoryName)}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
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
        checkbox.value = category; // Raw category value
        checkbox.name = 'allowedCategories';
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${escapeHtml(category)}`));
        categoryPermissionsDiv.appendChild(label);
    });
}

// --- Agent Data Handling ---
function displayAgentRow(agentId, agentData) {
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
    if (!agentTableBody) return;
    const searchTerm = filterSearchInput ? filterSearchInput.value.trim().toLowerCase() : '';

    const filteredAgents = currentAgents.filter(agent => {
        if (!searchTerm) return true;
        const nameMatch = agent.name?.toLowerCase().includes(searchTerm);
        const emailMatch = agent.email?.toLowerCase().includes(searchTerm);
        const contactMatch = agent.contact?.toLowerCase().includes(searchTerm);
        return nameMatch || emailMatch || contactMatch;
    });

    const currentTableRows = agentTableBody.querySelectorAll('tr:not(#loadingAgentMessage):not(#noAgentsMessage)');
    currentTableRows.forEach(row => row.remove());

    if (filteredAgents.length === 0) {
        if (noAgentsMessage) noAgentsMessage.style.display = 'table-row';
    } else {
        if (noAgentsMessage) noAgentsMessage.style.display = 'none';
        filteredAgents.forEach(agent => {
            displayAgentRow(agent.id, agent);
        });
    }
}

// --- Save Agent Function ---
async function handleSaveAgent(event) {
    event.preventDefault();
    if (!db || !doc || !setDoc || !updateDoc || !collection || !serverTimestamp || !getAuth || !createUserWithEmailAndPassword) {
        showModalError("Error: Database or Authentication functions missing.");
        return;
    }
    if (!saveAgentBtn) return;

    saveAgentBtn.disabled = true;
    const originalButtonText = saveAgentBtnText.textContent;
    if (saveAgentBtnText) saveAgentBtnText.textContent = (editAgentIdInput?.value ? 'Updating...' : 'Saving...');
    clearModalError();
    clearFieldErrors();

    const auth = getAuth();

    try {
        const agentId = editAgentIdInput?.value;
        const isEditing = !!agentId;

        const name = agentNameInput?.value.trim();
        const email = agentEmailInput?.value.trim().toLowerCase();
        const contact = agentContactInput?.value.trim() || null;
        const password = agentPasswordInput?.value;
        const status = agentStatusSelect?.value;
        const canAddCustomers = canAddCustomersCheckbox ? canAddCustomersCheckbox.checked : false;

        const selectedCategories = [];
        if (categoryPermissionsDiv) {
            const categoryCheckboxes = categoryPermissionsDiv.querySelectorAll('input[type="checkbox"]:checked');
            categoryCheckboxes.forEach(cb => selectedCategories.push(cb.value));
        }

        const userType = document.querySelector('input[name="userType"]:checked')?.value;
        let permissions = [];

        if (userType === 'agent') {
            const checkedPermissions = document.querySelectorAll('#agentPermissions input[type="checkbox"]:checked');
            checkedPermissions.forEach(cb => permissions.push(cb.value));
        } else if (userType === 'wholesale') {
            const checkedPermissions = document.querySelectorAll('#wholesalePermissions input[type="checkbox"]:checked');
            checkedPermissions.forEach(cb => permissions.push(cb.value));
        }

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

        if (!isEditing && agentPasswordInput.required && (!password || password.length < 6)) {
            showFieldError('password', 'Password is required for new agents (min 6 characters).');
            isValid = false;
        }

        if (!isValid) {
            saveAgentBtn.disabled = false;
            if (saveAgentBtnText) saveAgentBtnText.textContent = originalButtonText;
            return;
        }

        let currentAuthUid = null;

        if (isEditing) {
            currentAuthUid = authUidInput?.value.trim();
            if (!currentAuthUid) {
                showModalError("Authentication User ID is missing for editing. Cannot update.");
                saveAgentBtn.disabled = false;
                if (saveAgentBtnText) saveAgentBtnText.textContent = originalButtonText;
                return;
            }
        } else {
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                currentAuthUid = userCredential.user.uid;
                console.log("Firebase Auth user created successfully:", currentAuthUid);
            } catch (authError) {
                console.error("Error creating Firebase Auth user:", authError);
                if (authError.code === 'auth/email-already-in-use') {
                    showFieldError('email', 'This email is already registered for authentication.');
                    showModalError("This email is already in use. Please use a different email.");
                } else if (authError.code === 'auth/weak-password') {
                    showFieldError('password', 'The password is too weak.');
                    showModalError("The password is too weak. Please use a stronger password (at least 6 characters).");
                } else {
                     showFieldError('email', `Auth error: ${authError.code}`); // सामान्य ईमेल फ़ील्ड में त्रुटि दिखाएं
                    showModalError("Error creating authentication user: " + authError.message);
                }
                saveAgentBtn.disabled = false;
                if (saveAgentBtnText) saveAgentBtnText.textContent = originalButtonText;
                return;
            }
        }

        const agentData = {
            authUid: currentAuthUid,
            name: name,
            name_lowercase: name.toLowerCase(),
            email: email,
            contact: contact,
            status: status,
            userType: userType,
            permissions: permissions,
            allowedCategories: selectedCategories,
            canAddCustomers: canAddCustomers
        };

        if (isEditing) {
            await updateDoc(doc(db, "agents", agentId), {
                ...agentData,
                updatedAt: serverTimestamp()
            });
            showModalError("Agent updated successfully!");
        } else {
            await addDoc(collection(db, "agents"), {
                ...agentData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            showModalError("Agent added successfully (Auth & Firestore)!");
        }

        agentForm.reset();
        setTimeout(closeAgentModal, 1500);
        // loadAgents(); // यह सुनिश्चित करें कि यह कॉल हो रहा है
    } catch (error) {
        console.error("Error saving agent data to Firestore:", error);
        showModalError("Error saving agent data: " + error.message);
    } finally {
        saveAgentBtn.disabled = false;
        if (saveAgentBtnText) saveAgentBtnText.textContent = originalButtonText;
        if (!isEditing && !editAgentIdInput?.value) { // यदि नया एजेंट सफलतापूर्वक जोड़ा गया है, तो सूची पुनः लोड करें
            loadAgents();
        } else if (isEditing) { // यदि संपादन सफल रहा
            loadAgents();
        }
    }
}

// --- Event Listeners ---
if (addNewAgentBtn) addNewAgentBtn.addEventListener('click', () => openAgentModal('add'));
if (closeAgentModalBtn) closeAgentModalBtn.addEventListener('click', closeAgentModal);
if (cancelAgentBtn) cancelAgentBtn.addEventListener('click', closeAgentModal);
// if (saveAgentBtn) saveAgentBtn.addEventListener('click', handleSaveAgent); // इसे हटा दें क्योंकि फॉर्म सबमिट इसे हैंडल करेगा
if (agentForm) agentForm.addEventListener('submit', handleSaveAgent); // फॉर्म सबमिशन पर handleSaveAgent को कॉल करें

if (userTypeAgentRadio) userTypeAgentRadio.addEventListener('change', handleUserTypeChange);
if (userTypeWholesaleRadio) userTypeWholesaleRadio.addEventListener('change', handleUserTypeChange);

if (selectAllCategoriesBtn) selectAllCategoriesBtn.addEventListener('click', () => {
    if (categoryPermissionsDiv) {
        const checkboxes = categoryPermissionsDiv.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => { if (cb) cb.checked = true; });
    }
});
if (deselectAllCategoriesBtn) deselectAllCategoriesBtn.addEventListener('click', () => {
    if (categoryPermissionsDiv) {
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
    if (sortSelect) sortSelect.value = 'createdAt_desc'; // डिफ़ॉल्ट सॉर्ट पर रीसेट करें
    loadAgents();
});

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    fetchCategories();
    loadAgents();
    handleUserTypeChange(); // प्रारंभिक स्थिति के लिए कॉल करें
});