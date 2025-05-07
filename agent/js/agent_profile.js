// /agent/js/agent_profile.js

// Import Firebase config and necessary functions
import { db, auth } from './agent_firebase_config.js';
import { doc, getDoc, updateDoc, serverTimestamp } from './agent_firebase_config.js';
import { onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential, updatePassword as firebaseUpdatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// DOM Elements (Assume these IDs exist in your HTML)
const agentWelcomeMessageEl = document.getElementById('agentWelcomeMessage');
const agentLogoutBtnEl = document.getElementById('agentLogoutBtn');
const profileFormEl = document.getElementById('agentProfileForm');
const profileAgentNameInputEl = document.getElementById('profileAgentName');
const profileAgentEmailInputEl = document.getElementById('profileAgentEmail'); // Email is shown, not changed
const profileAgentContactInputEl = document.getElementById('profileAgentContact');
const updateProfileBtnEl = document.getElementById('updateProfileBtn');
const profileMessageEl = document.getElementById('profileMessage');
const passwordChangeFormEl = document.getElementById('agentPasswordChangeForm');
const currentPasswordInputEl = document.getElementById('currentPassword');
const newPasswordInputEl = document.getElementById('newPassword');
const confirmNewPasswordInputEl = document.getElementById('confirmNewPassword');
const changePasswordBtnEl = document.getElementById('changePasswordBtn');
const passwordChangeMessageEl = document.getElementById('passwordChangeMessage');

let currentUser = null;
let agentDocRef = null; // Reference to the agent document in Firestore

// Helper function to display messages
function showMessage(element, message, isError = false) {
    if (!element) return; // Exit if element doesn't exist
    element.textContent = message;
    element.className = 'form-message'; // Reset base class
    element.classList.add(isError ? 'error' : 'success');
    element.style.display = message ? 'block' : 'none';
}

// Function to load profile data
async function loadProfileData() {
    if (!currentUser) {
        console.error("Current user not available for loading profile.");
        showMessage(profileMessageEl, "Unable to load profile. Please log in again.", true); // English message
        return;
    }
    // Show email from Auth (should not be editable here)
    if (profileAgentEmailInputEl) {
        profileAgentEmailInputEl.value = currentUser.email;
        profileAgentEmailInputEl.readOnly = true; // Set to read-only
        profileAgentEmailInputEl.style.backgroundColor = '#e9ecef'; // Slightly grey background
    }

    // Load other details from Firestore
    agentDocRef = doc(db, "agents", currentUser.uid);
    try {
        const agentSnap = await getDoc(agentDocRef);
        if (agentSnap.exists()) {
            const agentData = agentSnap.data();
            if (profileAgentNameInputEl) profileAgentNameInputEl.value = agentData.name || '';
            if (profileAgentContactInputEl) profileAgentContactInputEl.value = agentData.contact || '';
            console.log("Agent profile data loaded from Firestore:", agentData);
        } else {
            console.warn("Agent document not found in Firestore:", currentUser.uid);
            showMessage(profileMessageEl, "Profile data not found. Please contact admin.", true); // English message
            // Disable profile form if data not found
            if (profileFormEl) profileFormEl.style.opacity = '0.5';
            if (updateProfileBtnEl) updateProfileBtnEl.disabled = true;
        }
    } catch (error) {
        console.error("Error loading agent profile data from Firestore:", error);
        showMessage(profileMessageEl, "Error loading profile: " + error.message, true); // English message
    }
}

// Profile form submit handler
async function handleProfileUpdate(event) {
    event.preventDefault();
    if (!agentDocRef || !currentUser) {
        showMessage(profileMessageEl, "Unable to update profile. User or data reference missing.", true); // English message
        return;
    }

    const newName = profileAgentNameInputEl.value.trim();
    const newContact = profileAgentContactInputEl.value.trim();

    if (!newName) {
        showMessage(profileMessageEl, "Full name is required.", true); // English message
        profileAgentNameInputEl.focus();
        return;
    }

    const originalBtnHTML = updateProfileBtnEl.innerHTML;
    updateProfileBtnEl.disabled = true;
    updateProfileBtnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; // English message
    showMessage(profileMessageEl, ""); // Clear previous message

    try {
        const dataToUpdate = {
            name: newName,
            name_lowercase: newName.toLowerCase(), // For case-insensitive search/sort
            contact: newContact, // Will save empty string if blank
            updatedAt: serverTimestamp()
        };
        // Security rules should ensure agent can only update these fields
        await updateDoc(agentDocRef, dataToUpdate);
        showMessage(profileMessageEl, "Profile updated successfully!"); // English message
        console.log("Profile updated:", dataToUpdate);
        // Also update the Welcome message if present
        if(agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = `Welcome, ${newName || currentUser.email}`;
    } catch (error) {
        console.error("Error updating profile in Firestore:", error);
        showMessage(profileMessageEl, "Error updating profile: " + error.message, true); // English message
    } finally {
        updateProfileBtnEl.disabled = false;
        updateProfileBtnEl.innerHTML = originalBtnHTML;
    }
}

// Change password form submit handler
async function handlePasswordChange(event) {
    event.preventDefault();
    const currentPassword = currentPasswordInputEl.value;
    const newPassword = newPasswordInputEl.value;
    const confirmNewPassword = confirmNewPasswordInputEl.value;

    // Basic Validation
    if (!currentPassword || !newPassword || !confirmNewPassword) {
         showMessage(passwordChangeMessageEl, "All password fields are required.", true); // English message
         return;
    }
    if (newPassword !== confirmNewPassword) {
        showMessage(passwordChangeMessageEl, "New passwords do not match.", true); // English message
        confirmNewPasswordInputEl.focus();
        return;
    }
    if (newPassword.length < 6) {
        showMessage(passwordChangeMessageEl, "New password must be at least 6 characters long.", true); // English message
        newPasswordInputEl.focus();
        return;
    }

    // Disable button and show loader
    const originalBtnHTML = changePasswordBtnEl.innerHTML;
    changePasswordBtnEl.disabled = true;
    changePasswordBtnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Changing...'; // English message
    showMessage(passwordChangeMessageEl, ""); // Clear previous message

    try {
        const user = auth.currentUser;
        if (!user) throw new Error("No user is currently signed in.");

        // Re-authenticate user
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        console.log("User re-authenticated successfully.");

        // Change password
        await firebaseUpdatePassword(user, newPassword);
        console.log("Password changed successfully.");

        showMessage(passwordChangeMessageEl, "Password changed successfully!"); // English message
        passwordChangeFormEl.reset(); // Reset form
    } catch (error) {
        console.error("Error changing password:", error);
        let msg = "Error changing password."; // English message
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            msg = "Current password is incorrect. Please try again."; // English message
            currentPasswordInputEl.focus();
        } else if (error.code === 'auth/too-many-requests') {
            msg = "Too many attempts. Please try again later."; // English message
        } else if (error.code === 'auth/weak-password') {
             msg = "The new password is too weak. Please choose a stronger password."; // English message
             newPasswordInputEl.focus();
        } else {
            msg = `Error: ${error.message}`;
        }
        showMessage(passwordChangeMessageEl, msg, true);
    } finally {
        changePasswordBtnEl.disabled = false;
        changePasswordBtnEl.innerHTML = originalBtnHTML;
    }
}


// --- Initialization Logic ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Agent Profile JS Initializing...");

    // Attach Form Event Listeners
    if (profileFormEl) {
        profileFormEl.addEventListener('submit', handleProfileUpdate);
    } else { console.error("Profile form not found!"); }

    if (passwordChangeFormEl) {
        passwordChangeFormEl.addEventListener('submit', handlePasswordChange);
    } else { console.error("Password change form not found!"); }

    // Attach Logout Listener
    if (agentLogoutBtnEl) {
        agentLogoutBtnEl.addEventListener('click', () => {
             if (confirm("Are you sure you want to logout?")) { // English message
                auth.signOut().then(() => {
                    window.location.href = 'agent_login.html';
                }).catch(error => {
                    console.error("Logout error:", error);
                    alert("Logout failed."); // English message
                });
            }
        });
    }

    // Auth State Change Listener (Handles loading data on page load/refresh)
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            console.log("Agent authenticated:", currentUser.uid);
            if (agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = `Welcome, ${user.email || 'Agent'}`;
            loadProfileData(); // Load profile data
        } else {
            // No user logged in, redirect to login
            console.log("Agent not logged in on profile page. Redirecting...");
            window.location.replace('agent_login.html');
        }
    });

    console.log("Agent Profile JS Initialized."); // English comment
}); // End DOMContentLoaded