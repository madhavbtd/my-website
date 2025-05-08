// /admin/js/agent_management.js

// Firebase फ़ंक्शंस को firebase-init.js से इम्पोर्ट करें
import { db, auth } from './firebase-init.js';
import {
    collection, onSnapshot, query, orderBy, doc, addDoc,
    updateDoc, getDoc, getDocs, serverTimestamp, where, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
const agentCanAddCustomersInput = document.getElementById('agentCanAddCustomers');
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


// --- Global State ---
let availableCategories = [];
let currentAgents = [];
let unsubscribeAgents = null;
let searchDebounceTimer; // Declare searchDebounceTimer here

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
function getStatusClass(status) {
    return status === 'active' ? 'status-active' : 'status-inactive';
}

// Function to handle user type change
function handleUserTypeChange() {
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
    agentForm.reset();
    editAgentIdInput.value = '';

    const checkboxes = categoryPermissionsDiv.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);

    if (mode === 'add') {
        agentModalTitle.textContent = 'Add New Agent';
        saveAgentBtnText.textContent = 'Save Agent';
        agentPasswordInput.required = true;
        agentPasswordGroup.style.display = '';
        if (passwordRequiredSpan) passwordRequiredSpan.style.display = 'inline';
        agentStatusSelect.value = 'active';
        agentCanAddCustomersInput.checked = false;

        userTypeAgentRadio.checked = true; // Default to Agent
        handleUserTypeChange();

    } else if (mode === 'edit' && agentData) {
        agentModalTitle.textContent = `Edit Agent: ${agentData.name || ''}`;
        saveAgentBtnText.textContent = 'Update Agent';
        editAgentIdInput.value = agentData.id;
        agentNameInput.value = agentData.name || '';
        agentEmailInput.value = agentData.email || '';
        agentContactInput.value = agentData.contact || '';
        agentStatusSelect.value = agentData.status || 'inactive';
        agentCanAddCustomersInput.checked = agentData.canAddCustomers || false;

        agentPasswordInput.required = false;
        agentPasswordGroup.style.display = '';
        if (passwordRequiredSpan) passwordRequiredSpan.style.display = 'none';
        agentPasswordInput.value = '';
        agentPasswordInput.placeholder = 'Leave blank to keep current password';

        // Populate user type
        if (agentData.userType === 'agent') {
            userTypeAgentRadio.checked = true;
        } else if (agentData.userType === 'wholesale') {
            userTypeWholesaleRadio.checked = true;
        }
        handleUserTypeChange(); // Show/hide permissions based on user type

        // Populate permissions
        if (agentData.permissions && Array.isArray(agentData.permissions)) {
            agentData.permissions.forEach(permission => {
                const checkbox = document.querySelector(`input[value="${permission}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        }


        // Check allowed categories
        if (agentData.allowedCategories && Array.isArray(agentData.allowedCategories)) {
            agentData.allowedCategories.forEach(categoryName => {
                // Sanitize category name for use in querySelector
                const sanitizedCategoryName = categoryName.replace(/[^a-zA-Z0-9-_]/g, '\\$&');
                try {
                    const checkbox = categoryPermissionsDiv.querySelector(`input[value="${sanitizedCategoryName}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    } else {
                        console.warn(`Category checkbox not found for saved category: ${categoryName} (Selector: input[value="${sanitizedCategoryName}"])`);
                    }
                } catch (e) {
                    console.error(`Invalid selector for category checkbox: input[value="${sanitizedCategoryName}"]`, e);
                }
            });
        }
    } else {
        console.error("Invalid mode or missing agentData for edit.");
        return;
    }

    agentModal.classList.add('active');
}

function closeAgentModal() {
    if (agentModal) agentModal.classList.remove('active');
}

// --- Category Handling ---
async function fetchCategories() {
    if (!db || !collection || !getDocs) {
        console.error("Firestore functions not available for fetching categories.");
        return [];
    }
    console.log("Fetching categories from onlineProducts...");
    try {
        const productsRef = collection(db, "onlineProducts");
        const q = query(productsRef, where("isEnabled", "==", true));
        const snapshot = await getDocs(q);
        const categories = new Set();
        snapshot.docs.forEach(doc => {
            const category = doc.data()?.category;
            if (category) {
                categories.add(category.trim());
            }
        });
        availableCategories = Array.from(categories).sort();
        console.log("Available categories fetched:", availableCategories);
        populateCategoryCheckboxes();
    } catch (error) {
        console.error("Error fetching categories:", error);
        if (categoryPermissionsDiv) categoryPermissionsDiv.innerHTML = '<p style="color: red;">Error loading categories.</p>';
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
        const checkboxId = `category-${category.replace(/\s+/g, '-')}`;
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
    if (!agentTableBody) return;
    const row = agentTableBody.insertRow();
    row.setAttribute('data-id', agentId);

    const name = escapeHtml(agentData.name || 'N/A');
    const email = escapeHtml(agentData.email || 'N/A');
    const contact = escapeHtml(agentData.contact || '-');
    const status = escapeHtml(agentData.status || 'inactive');
    const statusClass = getStatusClass(agentData.status);
    // const allowedCategoriesText = Array.isArray(agentData.allowedCategories) && agentData.allowedCategories.length > 0
    //     ? agentData.allowedCategories.map(escapeHtml).join(', ')
    //     : 'None';
    const canAddCustomersText = agentData.canAddCustomers ? '<i class="fas fa-check-circle"></i> Yes' : '<i class="fas fa-times-circle"></i> No';

    const userTypeText = escapeHtml(agentData.userType || 'N/A');
    // const permissionsText = Array.isArray(agentData.permissions) && agentData.permissions.length > 0
    //     ? agentData.permissions.map(escapeHtml).join(', ')
    //     : 'None';

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

    // Attach event listener specifically to the edit button of this row
    const editBtn = row.querySelector('button[data-action="edit"]');
    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openAgentModal('edit', { id: agentId, ...agentData });
        });
    }
}

// Load agents with real-time updates
function loadAgents() {
    if (!db || !collection || !onSnapshot || !query || !orderBy || !agentTableBody || !loadingAgentMessage || !noAgentsMessage) {
        console.error("Required Firestore functions or DOM elements missing for loadAgents.");
        if (agentTableBody) agentTableBody.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center;">Error loading agents.</td></tr>';
        if (loadingAgentMessage) loadingAgentMessage.style.display = 'none';
        if (noAgentsMessage) noAgentsMessage.style.display = 'table-row';
        return;
    }
    console.log("Setting up agent listener...");
    loadingAgentMessage.style.display = 'table-row';
    noAgentsMessage.style.display = 'none';

    const rows = agentTableBody.querySelectorAll('tr:not(#loadingAgentMessage)');
    rows.forEach(row => row.remove());

    if (unsubscribeAgents) unsubscribeAgents(); // Stop previous listener

    const agentsRef = collection(db, "agents");
    const sortValue = sortSelect ? sortSelect.value : 'createdAt_desc';
    let firestoreSortField = 'createdAt';
    let firestoreSortDirection = 'desc';
    if (sortValue === 'name_asc') {
        firestoreSortField = 'name_lowercase';
        firestoreSortDirection = 'asc';
    }
    else if (sortValue === 'name_desc') {
        firestoreSortField = 'name_lowercase';
        firestoreSortDirection = 'desc';
    }

    console.log(`Applying Firestore sort: ${firestoreSortField} ${firestoreSortDirection}`);
    const q = query(agentsRef, orderBy(firestoreSortField, firestoreSortDirection));

    unsubscribeAgents = onSnapshot(q, (snapshot) => {
        console.log(`Agent Snapshot: Received ${snapshot.docs.length} agents.`);
        loadingAgentMessage.style.display = 'none';

        currentAgents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        applyAgentFilters(); // Apply client-side search and render

    }, (error) => {
        console.error("Error fetching agents:", error);
        loadingAgentMessage.style.display = 'none';
        agentTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error loading agents: ${error.message}</td></tr>`;
        noAgentsMessage.style.display = 'none';
    });
}

// Filter and Render Agents (Client-side Search)
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

    const currentRows = agentTableBody.querySelectorAll('tr:not(#loadingAgentMessage)');
    currentRows.forEach(row => row.remove());

    if (filteredAgents.length === 0) {
        noAgentsMessage.style.display = 'table-row';
    } else {
        noAgentsMessage.style.display = 'none';
        filteredAgents.forEach(agent => {
            displayAgentRow(agent.id, agent);
        });
    }
}

// --- Save Agent Function ---
async function handleSaveAgent(event) {
    event.preventDefault();
    if (!db || !doc || !addDoc || !updateDoc || !collection || !serverTimestamp || !auth) {
        showModalError("Error: Database functions missing.");
        return;
    }
    if (!saveAgentBtn) return;

    saveAgentBtn.disabled = true;
    const originalButtonText = saveAgentBtnText.textContent;
    saveAgentBtnText.textContent = (editAgentIdInput.value ? 'Updating...' : 'Saving...');
    clearModalError();

    try {
        const agentId = editAgentIdInput.value;
        const isEditing = !!agentId;
        const name = agentNameInput.value.trim();
        const email = agentEmailInput.value.trim().toLowerCase();
        const contact = agentContactInput.value.trim() || null;
        const password = agentPasswordInput.value;
        const status = agentStatusSelect.value;
        const canAddCustomers = agentCanAddCustomersInput.checked;

        const selectedCategories = [];
        const categoryCheckboxes = categoryPermissionsDiv.querySelectorAll('input[type="checkbox"]:checked');
        categoryCheckboxes.forEach(cb => selectedCategories.push(cb.value));

        const userType = document.querySelector('input[name="userType"]:checked').value;
        let permissions = [];

        if (userType === 'agent') {
            const checkedPermissions = document.querySelectorAll('#agentPermissions input[type="checkbox"]:checked');
            checkedPermissions.forEach(cb => permissions.push(cb.value));
        } else if (userType === 'wholesale') {
            const checkedPermissions = document.querySelectorAll('#wholesalePermissions input[type="checkbox"]:checked');
            checkedPermissions.forEach(cb => permissions.push(cb.value));
        }


        // --- Validation ---
        if (!name || !email || !status) throw new Error("Agent Name, Email, and Status are required.");
        if (!isEditing && (!password || password.length < 6)) throw new Error("Password is required for new agents (min 6 characters).");
        if (selectedCategories.length === 0) throw new Error("Please select at least one allowed product category.");
        if (!/\S+@\S+\.\S+/.test(email)) throw new Error("Please enter a valid email address.");
        // --------------------

        const agentData = {
            name: name,
            name_lowercase: name.toLowerCase(),
            email: email,
            contact: contact,
            status: status,
            canAddCustomers: canAddCustomers,
            allowedCategories: selectedCategories,
            userType: userType,
            permissions: permissions,
            updatedAt: serverTimestamp(),
        };

        if (isEditing) {
            console.log(`Updating agent: ${agentId}`);
            const agentRef = doc(db, "agents", agentId);
            await updateDoc(agentRef, agentData);
            alert(`Agent "${name}" updated successfully!`);

        } else {
            console.log(`Adding new agent: ${email}`);
            agentData.createdAt = serverTimestamp();

            const qEmail = query(collection(db, "agents"), where("email", "==", email), limit(1));
            const emailSnap = await getDocs(qEmail);
            if (!emailSnap.empty) {
                throw new Error(`An agent with email ${email} already exists in the database.`);
            }

            const docRef = await addDoc(collection(db, "agents"), agentData);
            console.log("New agent added to Firestore with ID:", docRef.id);
            alert(`Agent "${name}" added successfully! \n\nIMPORTANT: You must manually create a corresponding login user in Firebase Authentication for email: ${email} with the password you set.`);
        }
        closeAgentModal();
    } catch (error) {
        console.error("Error saving agent:", error);
        showModalError(`Failed to save agent: ${error.message}`);
    } finally {
        if (saveAgentBtn) {
            saveAgentBtn.disabled = false;
            saveAgentBtnText.textContent = originalButtonText;
        }
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Admin Agent Management JS Initializing...");

    // Attach Static Listeners
    addNewAgentBtn?.addEventListener('click', () => openAgentModal('add'));
    closeAgentModalBtn?.addEventListener('click', closeAgentModal);
    cancelAgentBtn?.addEventListener('click', closeAgentModal);
    agentForm?.addEventListener('submit', handleSaveAgent);
    agentModal?.addEventListener('click', (e) => { if (e.target === agentModal) closeAgentModal(); });

    // Select/Deselect All Categories
    selectAllCategoriesBtn?.addEventListener('click', () => {
        categoryPermissionsDiv?.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    });
    deselectAllCategoriesBtn?.addEventListener('click', () => {
        categoryPermissionsDiv?.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    });

    // Filter/Sort Listeners
    filterSearchInput?.addEventListener('input', () => { clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(applyAgentFilters, 300); });
    sortSelect?.addEventListener('change', loadAgents); // Firestore query handles sorting
    clearFiltersBtn?.addEventListener('click', () => {
        if (filterSearchInput) filterSearchInput.value = '';
        if (sortSelect) sortSelect.value = 'createdAt_desc';
        loadAgents(); // Reload with default sort and no search
    });

    // Initial Data Load
    fetchCategories().then(() => {
        loadAgents();
    }).catch(err => {
        console.error("Failed initial category load, attempting to load agents anyway...");
        loadAgents();
    });

    console.log("Admin Agent Management JS Initialized.");

    handleUserTypeChange(); // Initialize display on page load - **moved here**

});