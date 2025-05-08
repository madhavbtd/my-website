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

function getStatusClass(status) {
    return status === 'active' ? 'status-active' : 'status-inactive';
}

// Function to handle user type change
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
    agentForm.reset();
    if (editAgentIdInput) editAgentIdInput.value = '';

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

        if (userTypeAgentRadio) userTypeAgentRadio.checked = true; // Default to Agent
        handleUserTypeChange();

    } else if (mode === 'edit' && agentData) {
        if (agentModalTitle) agentModalTitle.textContent = `Edit Agent: ${agentData.name || ''}`;
        if (saveAgentBtnText) saveAgentBtnText.textContent = 'Update Agent';
        if (editAgentIdInput) editAgentIdInput.value = agentData.id;
        if (agentNameInput) agentNameInput.value = agentData.name || '';
        if (agentEmailInput) agentEmailInput.value = agentData.email || '';
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

        // Populate user type
        if (agentData.userType === 'agent' && userTypeAgentRadio) {
            userTypeAgentRadio.checked = true;
        } else if (agentData.userType === 'wholesale' && userTypeWholesaleRadio) {
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

        // Set 'Add Customers' checkbox
        if (canAddCustomersCheckbox) { // Check if element exists
            canAddCustomersCheckbox.checked = agentData.canAddCustomers || false;
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
                        console.warn(`Category checkbox not found for saved category: <span class="math-inline">\{categoryName\} \(Selector\: input\[value\="</span>{sanitizedCategoryName}"])`);
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

    if (agentModal) agentModal.classList.add('active');
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
        if (categoryPermissionsDiv) categoryPermissionsDiv.appendChild(label);
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
    const canAddCustomersText = agentData.permissions?.includes('canAddCustomers') ? '<i class="fas fa-check-circle"></i> Yes' : '<i class="fas fa-times-circle"></i> No';

    const userTypeText = escapeHtml(agentData.userType || 'N/A');
    // const permissionsText = Array.isArray(agentData.permissions) && agentData.permissions.length > 0
    //     ? agentData.permissions.map(escapeHtml).join(', ')
    //     : 'None';

    row.innerHTML = `
        <td><span class="math-inline">\{name\}</td\>
<td\></span>{email}</td>
        <td><span class="math-inline">\{contact\}</td\>
<td\></span>{userTypeText}</td>
        <td style="text-align:center;"><span class="status-badge <span class="math-inline">\{statusClass\}"\></span>{status}</span></td>
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
    if (!db || !collection || !onSnapshot || !query || !orderBy || !agentTableBody || !loadingAgentMessage || !no