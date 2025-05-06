// /agent/js/agent_profile.js
import { db, auth } from './agent_firebase_config.js';
import { doc, getDoc, updateDoc, serverTimestamp } from './agent_firebase_config.js'; // serverTimestamp जोड़ा गया
import { onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential, updatePassword as firebaseUpdatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// DOM Elements for general page
const agentWelcomeMessageEl = document.getElementById('agentWelcomeMessage'); // आपके हेडर से
const agentLogoutBtnEl = document.getElementById('agentLogoutBtn'); // आपके हेडर से

// DOM Elements for profile form
const profileFormEl = document.getElementById('agentProfileForm');
const profileAgentNameInputEl = document.getElementById('profileAgentName');
const profileAgentEmailInputEl = document.getElementById('profileAgentEmail');
const profileAgentContactInputEl = document.getElementById('profileAgentContact');
const updateProfileBtnEl = document.getElementById('updateProfileBtn');
const profileMessageEl = document.getElementById('profileMessage');

// DOM Elements for password change form
const passwordChangeFormEl = document.getElementById('agentPasswordChangeForm');
const currentPasswordInputEl = document.getElementById('currentPassword');
const newPasswordInputEl = document.getElementById('newPassword');
const confirmNewPasswordInputEl = document.getElementById('confirmNewPassword');
const changePasswordBtnEl = document.getElementById('changePasswordBtn');
const passwordChangeMessageEl = document.getElementById('passwordChangeMessage');

let currentUser = null;
let agentDocRef = null; // Firestore में एजेंट डॉक्यूमेंट का रेफरेंस

function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.className = 'form-message'; // बेस क्लास रीसेट करें
    if (isError) {
        element.classList.add('error');
    } else {
        element.classList.add('success');
    }
    element.style.display = 'block';
}

// वर्तमान एजेंट का प्रोफाइल डेटा लोड करें
async function loadProfileData() {
    if (!currentUser) {
        console.error("Current user not available for loading profile.");
        return;
    }
    profileAgentEmailInputEl.value = currentUser.email; // ईमेल फायरबेस Auth से आता है

    // एजेंट की अन्य जानकारी (नाम, संपर्क) Firestore के 'agents' कलेक्शन से लाएं
    agentDocRef = doc(db, "agents", currentUser.uid); // currentUser.uid ही एजेंट की doc ID है
    try {
        const agentSnap = await getDoc(agentDocRef);
        if (agentSnap.exists()) {
            const agentData = agentSnap.data();
            profileAgentNameInputEl.value = agentData.name || '';
            profileAgentContactInputEl.value = agentData.contact || '';
        } else {
            console.warn("Agent document not found in Firestore for UID:", currentUser.uid);
            showMessage(profileMessageEl, "Profile data not found. Please contact admin.", true);
        }
    } catch (error) {
        console.error("Error loading agent profile data from Firestore:", error);
        showMessage(profileMessageEl, "Error loading profile: " + error.message, true);
    }
}

// प्रोफाइल जानकारी अपडेट करने का इवेंट लिस्नर
if (profileFormEl) {
    profileFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!agentDocRef || !currentUser) {
            showMessage(profileMessageEl, "Cannot update profile. User or data reference missing.", true);
            return;
        }

        const newName = profileAgentNameInputEl.value.trim();
        const newContact = profileAgentContactInputEl.value.trim();

        if (!newName) {
            showMessage(profileMessageEl, "Full Name is required.", true);
            return;
        }

        // बटन को डिसेबल करें और लोडिंग दिखाएं
        const originalBtnText = updateProfileBtnEl.innerHTML;
        updateProfileBtnEl.disabled = true;
        updateProfileBtnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
        showMessage(profileMessageEl, ""); // पिछला संदेश हटाएं

        try {
            await updateDoc(agentDocRef, {
                name: newName,
                name_lowercase: newName.toLowerCase(), // सर्चिंग के लिए
                contact: newContact,
                updatedAt: serverTimestamp() // अपडेट का समय
            });
            showMessage(profileMessageEl, "Profile updated successfully!");
        } catch (error) {
            console.error("Error updating profile in Firestore:", error);
            showMessage(profileMessageEl, "Error updating profile: " + error.message, true);
        } finally {
            updateProfileBtnEl.disabled = false;
            updateProfileBtnEl.innerHTML = originalBtnText;
        }
    });
}

// पासवर्ड बदलने का इवेंट लिस्नर
if (passwordChangeFormEl) {
    passwordChangeFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = currentPasswordInputEl.value;
        const newPassword = newPasswordInputEl.value;
        const confirmNewPassword = confirmNewPasswordInputEl.value;

        if (!currentPassword || !newPassword || !confirmNewPassword) {
             showMessage(passwordChangeMessageEl, "All password fields are required.", true);
             return;
        }
        if (newPassword !== confirmNewPassword) {
            showMessage(passwordChangeMessageEl, "New passwords do not match.", true);
            return;
        }
        if (newPassword.length < 6) {
            showMessage(passwordChangeMessageEl, "New password must be at least 6 characters long.", true);
            return;
        }

        // बटन को डिसेबल करें और लोडिंग दिखाएं
        const originalBtnText = changePasswordBtnEl.innerHTML;
        changePasswordBtnEl.disabled = true;
        changePasswordBtnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Changing...';
        showMessage(passwordChangeMessageEl, ""); // पिछला संदेश हटाएं

        try {
            const user = auth.currentUser;
            if (!user) throw new Error("No user is currently signed in.");

            // उपयोगकर्ता को पुनः प्रमाणित करें
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);

            // पुनः प्रमाणीकरण सफल, अब पासवर्ड बदलें
            await firebaseUpdatePassword(user, newPassword);

            showMessage(passwordChangeMessageEl, "Password changed successfully!");
            passwordChangeFormEl.reset(); // फॉर्म रीसेट करें
        } catch (error) {
            console.error("Error changing password:", error);
            let msg = "Error changing password.";
            if (error.code === 'auth/wrong-password') {
                msg = "Incorrect current password. Please try again.";
            } else if (error.code === 'auth/too-many-requests') {
                msg = "Too many attempts. Please try again later.";
            } else {
                msg = `Error: ${error.message}`;
            }
            showMessage(passwordChangeMessageEl, msg, true);
        } finally {
            changePasswordBtnEl.disabled = false;
            changePasswordBtnEl.innerHTML = originalBtnText;
        }
    });
}

// पेज लोड होने पर और Auth स्टेट बदलने पर
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            if (agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = `Welcome, ${user.email || 'Agent'}`;
            loadProfileData(); // प्रोफाइल डेटा लोड करें
        } else {
            // कोई उपयोगकर्ता लॉग इन नहीं है, लॉगिन पेज पर भेजें
            window.location.href = 'agent_login.html';
        }
    });

    // लॉगआउट बटन का लिस्नर
    if (agentLogoutBtnEl) {
        agentLogoutBtnEl.addEventListener('click', () => {
            auth.signOut().then(() => {
                window.location.href = 'agent_login.html';
            }).catch(error => {
                console.error("Logout error:", error);
                alert("Logout failed. Please try again.");
            });
        });
    }
});