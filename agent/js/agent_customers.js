// /agent/js/agent_customers.js
import { db, auth } from './agent_firebase_config.js';
import {
    collection, query, where, orderBy, getDocs, addDoc,
    doc, getDoc, updateDoc, deleteDoc, serverTimestamp
} from './agent_firebase_config.js'; // Or directly from Firebase SDK
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// DOM Elements
const agentWelcomeMessageEl = document.getElementById('agentWelcomeMessage');
const agentLogoutBtnEl = document.getElementById('agentLogoutBtn');
const addNewCustomerBtnEl = document.getElementById('addNewCustomerBtn');
const customerSearchInputEl = document.getElementById('customerSearchInput');
const customersTableBodyEl = document.getElementById('agentCustomersTableBody');
const loadingCustomersMessageRowEl = document.getElementById('loadingCustomersMessage'); // The <tr> element
const noCustomersMessageRowEl = document.getElementById('noCustomersMessageRow');   // The <tr> element containing the message <p>
const noCustomersMessageParagraphEl = document.getElementById('noCustomersMessage'); // The <p> element itself

// Modal DOM Elements
const customerModalEl = document.getElementById('customerModal');
const customerModalTitleEl = document.getElementById('customerModalTitle');
const closeCustomerModalBtnEl = document.getElementById('closeCustomerModalBtn');
const customerFormEl = document.getElementById('customerForm');
const editCustomerIdInputEl = document.getElementById('editCustomerId'); // Hidden input
const customerFullNameInputEl = document.getElementById('customerFullName');
const customerWhatsAppNoInputEl = document.getElementById('customerWhatsAppNo');
const customerContactNoInputEl = document.getElementById('customerContactNo');
const customerAddressInputEl = document.getElementById('customerAddress');
const saveCustomerBtnEl = document.getElementById('saveCustomerBtn');
const cancelCustomerFormBtnEl = document.getElementById('cancelCustomerFormBtn');
const customerFormMessageEl = document.getElementById('customerFormMessage');

let currentUser = null;
// Store agent permissions here
let agentPermissions = {
    canAddCustomers: false, // Default
    canEditOwnCustomers: true, // Assuming agents can always edit their own
    canDeleteOwnCustomers: false, // Usually false for agents
    role: null,
    status: 'inactive',
    email: null // To store agent's email
};
let allAgentCustomersCache = []; // Cache customers added by this agent (based on security rules)

// --- Helper Functions ---
function escapeHtml(unsafe) { if (typeof unsafe !== 'string') unsafe = String(unsafe || ''); return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");}
function formatDate(timestamp) { if (!timestamp || !timestamp.toDate) return 'N/A'; return timestamp.toDate().toLocaleDateString('en-GB'); }

function showFormMessage(message, isError = false) {
    if (!customerFormMessageEl) return;
    customerFormMessageEl.textContent = message;
    customerFormMessageEl.className = 'form-message'; // Reset class
    customerFormMessageEl.classList.add(isError ? 'error' : 'success');
    customerFormMessageEl.style.display = 'block';
}

// --- Authentication and Permission Loading ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        if (agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = `Welcome, ${user.email || 'Agent'}`;

        try {
            const agentDocRef = doc(db, "agents", currentUser.uid);
            const agentDocSnap = await getDoc(agentDocRef);

            if (agentDocSnap.exists() && agentDocSnap.data().role === 'agent' && agentDocSnap.data().status === 'active') {
                agentPermissions = agentDocSnap.data();
                agentPermissions.email = user.email; // Add email from Auth if needed
                // Explicitly set permissions based on fetched data
                agentPermissions.canAddCustomers = agentPermissions.canAddCustomers ?? false; // Ensure boolean
                agentPermissions.canEditOwnCustomers = agentPermissions.canEditOwnCustomers ?? true; // Default to true
                agentPermissions.canDeleteOwnCustomers = agentPermissions.canDeleteOwnCustomers ?? false; // Default to false
                console.log("Agent authenticated and permissions loaded:", agentPermissions);
                loadCustomers(); // Load customers after permissions are set
            } else {
                console.error("Agent document not found or role/status invalid. Logging out.");
                if (agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = "Invalid Agent Account.";
                if (addNewCustomerBtnEl) addNewCustomerBtnEl.style.display = 'none';
                if (customersTableBodyEl) customersTableBodyEl.innerHTML = `<tr><td colspan="6"><p class="form-message error">You are not authorized to view customer data.</p></td></tr>`; // English message
                if (loadingCustomersMessageRowEl) loadingCustomersMessageRowEl.style.display = 'none';
                // auth.signOut(); // Optional: force logout
                // window.location.href = 'agent_login.html';
            }
        } catch (error) {
            console.error("Error loading agent permissions:", error);
            if (agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = "Error loading profile.";
            if (customersTableBodyEl) customersTableBodyEl.innerHTML = `<tr><td colspan="6"><p class="form-message error">Error loading permissions. (${error.message})</p></td></tr>`; // English message
            if (loadingCustomersMessageRowEl) loadingCustomersMessageRowEl.style.display = 'none';
            // auth.signOut();
            // window.location.href = 'agent_login.html';
        }
    } else {
        console.log("Agent not logged in on customers page. Redirecting...");
        window.location.replace('agent_login.html');
    }
});

// --- Customer Modal ---
function openCustomerModal(mode = 'add', customerData = null) {
    if (!customerFormEl || !customerModalEl || !customerModalTitleEl || !saveCustomerBtnEl || !editCustomerIdInputEl || !customerFullNameInputEl || !customerWhatsAppNoInputEl || !customerContactNoInputEl || !customerAddressInputEl) {
        console.error("Customer Modal or its elements not found!");
        alert("Error opening form."); // English alert
        return;
    }
    customerFormEl.reset();
    editCustomerIdInputEl.value = '';
    showFormMessage("", false); // Clear previous messages

    if (mode === 'add') {
        if (!agentPermissions.canAddCustomers) {
            alert("You do not have permission to add new customers."); // English alert
            return; // Do not open modal
        }
        customerModalTitleEl.innerHTML = '<i class="fas fa-user-plus"></i> Add New Customer'; // English title
        saveCustomerBtnEl.innerHTML = '<i class="fas fa-save"></i> Save Customer'; // English text
    } else if (mode === 'edit' && customerData) {
         if (!agentPermissions.canEditOwnCustomers) { // Check edit permission
             alert("You do not have permission to edit customers."); // English alert
             return;
         }
        customerModalTitleEl.innerHTML = '<i class="fas fa-user-edit"></i> Edit Customer'; // English title
        saveCustomerBtnEl.innerHTML = '<i class="fas fa-save"></i> Update Customer'; // English text
        editCustomerIdInputEl.value = customerData.id || '';
        customerFullNameInputEl.value = customerData.fullName || '';
        customerWhatsAppNoInputEl.value = customerData.whatsappNo || '';
        customerContactNoInputEl.value = customerData.contactNo || '';
        customerAddressInputEl.value = customerData.address || customerData.billingAddress || ''; // Use address or billingAddress
    } else {
        console.error("Invalid mode or missing customer data for edit.");
        return;
    }
    customerModalEl.classList.add('active');
    customerModalEl.style.display = 'flex'; // Make it visible
    customerFullNameInputEl.focus(); // Focus on first field
}

function closeCustomerModal() {
    if (customerModalEl) {
        customerModalEl.classList.remove('active');
        customerModalEl.style.display = 'none'; // Hide it
    }
}

// --- Load and Display Customer Data ---
async function loadCustomers() {
    if (!currentUser || !customersTableBodyEl || !loadingCustomersMessageRowEl || !noCustomersMessageRowEl) {
        console.warn("loadCustomers: Required elements or user not found.");
        if (customersTableBodyEl && loadingCustomersMessageRowEl) {
             loadingCustomersMessageRowEl.style.display = 'none';
             customersTableBodyEl.innerHTML = `<tr><td colspan="6"><p class="form-message error">Login required to load customers.</p></td></tr>`; // English message
        }
        return;
    }

    loadingCustomersMessageRowEl.style.display = 'table-row';
    noCustomersMessageRowEl.style.display = 'none';
    // Clear previous data rows
    const rowsToRemove = customersTableBodyEl.querySelectorAll('tr:not(#loadingCustomersMessage):not(#noCustomersMessageRow)');
    rowsToRemove.forEach(row => row.remove());

    try {
        // Security rules should enforce that agents only see their own customers
        // if the query includes `where("addedByAgentId", "==", request.auth.uid)`.
        const customersQuery = query(
            collection(db, "customers"),
            where("addedByAgentId", "==", currentUser.uid), // Fetch only customers added by this agent
            orderBy("fullNameLower")
        );

        const snapshot = await getDocs(customersQuery);
        allAgentCustomersCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log(`${allAgentCustomersCache.length} customers loaded for agent ${currentUser.uid}.`);
        displayCustomers(); // Display initially fetched data

    } catch (error) {
        console.error("Error loading customers:", error);
        loadingCustomersMessageRowEl.style.display = 'none';
        customersTableBodyEl.innerHTML = `<tr><td colspan="6"><p class="form-message error">Error loading customers. (${error.message})</p></td></tr>`; // English message
    }
}

function displayCustomers(searchTerm = (customerSearchInputEl ? customerSearchInputEl.value.trim() : '')) {
    if (!customersTableBodyEl || !loadingCustomersMessageRowEl || !noCustomersMessageRowEl) return;

    loadingCustomersMessageRowEl.style.display = 'none';
    const rowsToRemove = customersTableBodyEl.querySelectorAll('tr:not(#loadingCustomersMessage):not(#noCustomersMessageRow)');
    rowsToRemove.forEach(row => row.remove());

    const term = searchTerm.toLowerCase();
    const filteredCustomers = allAgentCustomersCache.filter(cust => {
        return (!term || // Show all if no search term
                cust.fullName?.toLowerCase().includes(term) ||
                cust.whatsappNo?.includes(term) ||
                (cust.contactNo && cust.contactNo.includes(term)) );
    });

    if (filteredCustomers.length === 0) {
        noCustomersMessageRowEl.style.display = 'table-row';
        // Ensure the message is set correctly within the paragraph
        if(noCustomersMessageParagraphEl) noCustomersMessageParagraphEl.textContent = "No customers found matching your search."; // English message
    } else {
        noCustomersMessageRowEl.style.display = 'none';
        filteredCustomers.forEach(cust => {
            const row = customersTableBodyEl.insertRow();
            row.insertCell().textContent = escapeHtml(cust.fullName || 'N/A');
            row.insertCell().textContent = escapeHtml(cust.whatsappNo || 'N/A');
            row.insertCell().textContent = escapeHtml(cust.contactNo || 'N/A');
            row.insertCell().textContent = escapeHtml(cust.address || cust.billingAddress || 'N/A');
            row.insertCell().textContent = formatDate(cust.createdAt); // Format timestamp

            const actionsCell = row.insertCell();
            actionsCell.classList.add('actions-cell');

            // Show Edit button if permitted
            if (agentPermissions.canEditOwnCustomers) { // Check permission
                const editBtn = document.createElement('button');
                editBtn.classList.add('button', 'edit-btn', 'small-button', 'info-button'); // Use standard button classes
                editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit'; // English text
                editBtn.title = "Edit Customer"; // English title
                editBtn.onclick = () => openCustomerModal('edit', cust);
                actionsCell.appendChild(editBtn);
            }

            // Show Delete button ONLY if permitted (usually false)
            if (agentPermissions.canDeleteOwnCustomers) {
                const deleteBtn = document.createElement('button');
                deleteBtn.classList.add('button', 'delete-btn', 'small-button', 'danger-button'); // Use standard button classes
                deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete'; // English text
                deleteBtn.title = "Delete Customer"; // English title
                deleteBtn.onclick = () => handleDeleteCustomer(cust.id, cust.fullName);
                actionsCell.appendChild(deleteBtn);
            }
        });
    }
}


// --- Customer Form Submit Handler ---
async function handleSaveCustomer(e) {
    e.preventDefault();
    if (!currentUser) {
        showFormMessage("You must be logged in to perform this action.", true); // English message
        return;
    }

    const customerIdToEdit = editCustomerIdInputEl.value;
    const isEditing = !!customerIdToEdit;

    // Permission check
    if (!isEditing && (!agentPermissions || !agentPermissions.canAddCustomers)) {
        showFormMessage("You do not have permission to add new customers.", true); // English message
        return;
    }
    if (isEditing && (!agentPermissions || !agentPermissions.canEditOwnCustomers)) {
        showFormMessage("You do not have permission to edit customers.", true); // English message
        return;
    }


    const fullName = customerFullNameInputEl.value.trim();
    const whatsappNo = customerWhatsAppNoInputEl.value.trim();
    const contactNo = customerContactNoInputEl.value.trim() || null; // Store null if empty
    const address = customerAddressInputEl.value.trim() || null; // Store null if empty

    // Validation
    if (!fullName || !whatsappNo) {
        showFormMessage("Full Name and WhatsApp Number are required.", true); // English message
        return;
    }
    // Simple WhatsApp validation (adapt as needed)
    if (!/^\+?[1-9]\d{7,14}$/.test(whatsappNo.replace(/\s+/g, ''))) {
         showFormMessage("Please enter a valid WhatsApp number (e.g., +919876543210).", true); // English message
         return;
    }

    // UI feedback
    const originalBtnHTML = saveCustomerBtnEl.innerHTML;
    saveCustomerBtnEl.disabled = true;
    saveCustomerBtnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; // English message
    showFormMessage(""); // Clear previous message

    const customerDataPayload = {
        fullName: fullName,
        fullNameLower: fullName.toLowerCase(), // For case-insensitive search/sort
        whatsappNo: whatsappNo,
        contactNo: contactNo,
        address: address,
        billingAddress: address, // Assuming same as address for simplicity
        updatedAt: serverTimestamp(),
        // status: 'active' // Set status if adding, or handle in rules/triggers
    };

    try {
        if (isEditing) {
            const custDocRef = doc(db, "customers", customerIdToEdit);
            // Fields that should NOT be updated by agent on edit
            delete customerDataPayload.addedByAgentId;
            delete customerDataPayload.agentEmail;
            delete customerDataPayload.createdAt;
            delete customerDataPayload.status; // Agents usually shouldn't change status

            await updateDoc(custDocRef, customerDataPayload);
            showFormMessage("Customer updated successfully!", false); // English success message
        } else { // Adding new customer
            customerDataPayload.createdAt = serverTimestamp();
            customerDataPayload.addedByAgentId = currentUser.uid; // Set the agent ID
            customerDataPayload.agentEmail = agentPermissions.email || currentUser.email; // Store agent email
            customerDataPayload.status = 'active'; // Default status for new customers

            const docRef = await addDoc(collection(db, "customers"), customerDataPayload);
            console.log("New customer saved with ID:", docRef.id);
            showFormMessage("Customer added successfully!", false); // English success message
        }

        customerFormEl.reset(); // Reset form on success
        setTimeout(() => {
            closeCustomerModal();
            loadCustomers(); // Refresh the customer list with latest data
        }, 1500); // Close modal after short delay

    } catch (error) {
        console.error("Error saving customer:", error);
        showFormMessage(`Error saving customer: ${error.message}`, true); // English error message
    } finally {
        saveCustomerBtnEl.disabled = false;
        saveCustomerBtnEl.innerHTML = originalBtnHTML; // Restore button text
    }
}

// --- Delete Customer Handler (Optional) ---
async function handleDeleteCustomer(customerId, customerName) {
     if (!agentPermissions.canDeleteOwnCustomers) {
          alert("You do not have permission to delete customers."); // English alert
          return;
     }
     if (confirm(`Are you sure you want to delete customer: ${customerName}? This action cannot be undone.`)) { // English confirmation
          console.log(`Attempting to delete customer: ${customerId}`);
          try {
               await deleteDoc(doc(db, "customers", customerId));
               alert("Customer deleted successfully."); // English alert
               loadCustomers(); // Refresh list
          } catch (error) {
               console.error("Error deleting customer:", error);
               alert(`Error deleting customer: ${error.message}`); // English alert
          }
     }
}


// --- Initial Event Listener Setup ---
document.addEventListener('DOMContentLoaded', () => {
    // onAuthStateChanged is already above and will call loadCustomers after permission check.

    if (addNewCustomerBtnEl) addNewCustomerBtnEl.onclick = () => openCustomerModal('add');
    if (closeCustomerModalBtnEl) closeCustomerModalBtnEl.onclick = closeCustomerModal;
    if (cancelCustomerFormBtnEl) cancelCustomerFormBtnEl.onclick = closeCustomerModal;
    // Close modal on overlay click
    if (customerModalEl) {
        customerModalEl.addEventListener('click', (event) => {
            if (event.target === customerModalEl) closeCustomerModal();
        });
    }
    // Form submit listener
    if (customerFormEl) {
        customerFormEl.addEventListener('submit', handleSaveCustomer);
    }

    // Search input listener with debounce
    let searchDebounceTimer;
    if (customerSearchInputEl) {
        customerSearchInputEl.addEventListener('input', (e) => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                displayCustomers(); // Filter only the cached list, don't re-query Firestore on every keystroke
            }, 300); // 300ms debounce
        });
    }

    // Logout button listener
    if (agentLogoutBtnEl && auth) {
        agentLogoutBtnEl.addEventListener('click', () => {
            if(confirm("Are you sure you want to logout?")) { // English confirmation
                auth.signOut().then(() => {
                    window.location.href = 'agent_login.html';
                }).catch(error => {
                     console.error("Logout error:", error);
                     alert("Logout failed."); // English alert
                });
            }
        });
    }
    console.log("Agent Customers JS DOMContentLoaded listeners attached.");
});