// /agent/js/agent_profile.js

// Firebase कॉन्फिग और जरूरी फंक्शन्स इम्पोर्ट करें
import { db, auth } from './agent_firebase_config.js';
import { doc, getDoc, updateDoc, serverTimestamp } from './agent_firebase_config.js';
import { onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential, updatePassword as firebaseUpdatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// DOM Elements (मान लें कि ये IDs आपके HTML में मौजूद हैं)
const agentWelcomeMessageEl = document.getElementById('agentWelcomeMessage');
const agentLogoutBtnEl = document.getElementById('agentLogoutBtn');
const profileFormEl = document.getElementById('agentProfileForm');
const profileAgentNameInputEl = document.getElementById('profileAgentName');
const profileAgentEmailInputEl = document.getElementById('profileAgentEmail'); // ईमेल केवल दिखाया जाता है, बदला नहीं जाता
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
let agentDocRef = null; // Firestore में एजेंट डॉक्यूमेंट का रेफरेंस

// संदेश दिखाने के लिए हेल्पर फ़ंक्शन
function showMessage(element, message, isError = false) {
    if (!element) return; // यदि एलिमेंट मौजूद नहीं है तो बाहर निकलें
    element.textContent = message;
    element.className = 'form-message'; // बेस क्लास रीसेट करें
    element.classList.add(isError ? 'error' : 'success');
    element.style.display = message ? 'block' : 'none';
}

// प्रोफाइल डेटा लोड करने का फ़ंक्शन
async function loadProfileData() {
    if (!currentUser) {
        console.error("प्रोफ़ाइल लोड करने के लिए वर्तमान उपयोगकर्ता उपलब्ध नहीं है।");
        showMessage(profileMessageEl, "प्रोफ़ाइल लोड करने में असमर्थ। पुनः लॉग इन करें।", true);
        return;
    }
    // ईमेल को Auth से दिखाएं (इसे संपादित करने योग्य नहीं बनाना चाहिए)
    if (profileAgentEmailInputEl) {
        profileAgentEmailInputEl.value = currentUser.email;
        profileAgentEmailInputEl.readOnly = true; // इसे केवल पढ़ने के लिए सेट करें
        profileAgentEmailInputEl.style.backgroundColor = '#e9ecef'; // थोड़ा ग्रे बैकग्राउंड
    }

    // Firestore से अन्य विवरण लोड करें
    agentDocRef = doc(db, "agents", currentUser.uid);
    try {
        const agentSnap = await getDoc(agentDocRef);
        if (agentSnap.exists()) {
            const agentData = agentSnap.data();
            if (profileAgentNameInputEl) profileAgentNameInputEl.value = agentData.name || '';
            if (profileAgentContactInputEl) profileAgentContactInputEl.value = agentData.contact || '';
            console.log("एजेंट प्रोफ़ाइल डेटा Firestore से लोड किया गया:", agentData);
        } else {
            console.warn("Firestore में एजेंट दस्तावेज़ नहीं मिला:", currentUser.uid);
            showMessage(profileMessageEl, "प्रोफ़ाइल डेटा नहीं मिला। कृपया एडमिन से संपर्क करें।", true);
            // प्रोफ़ाइल फ़ॉर्म को अक्षम करें यदि डेटा नहीं मिला
            if (profileFormEl) profileFormEl.style.opacity = '0.5';
            if (updateProfileBtnEl) updateProfileBtnEl.disabled = true;
        }
    } catch (error) {
        console.error("Firestore से एजेंट प्रोफ़ाइल डेटा लोड करने में त्रुटि:", error);
        showMessage(profileMessageEl, "प्रोफ़ाइल लोड करने में त्रुटि: " + error.message, true);
    }
}

// प्रोफाइल फॉर्म सबमिट हैंडलर
async function handleProfileUpdate(event) {
    event.preventDefault();
    if (!agentDocRef || !currentUser) {
        showMessage(profileMessageEl, "प्रोफ़ाइल अपडेट करने में असमर्थ। उपयोगकर्ता या डेटा संदर्भ गायब है।", true);
        return;
    }

    const newName = profileAgentNameInputEl.value.trim();
    const newContact = profileAgentContactInputEl.value.trim();

    if (!newName) {
        showMessage(profileMessageEl, "पूरा नाम आवश्यक है।", true);
        profileAgentNameInputEl.focus();
        return;
    }

    const originalBtnHTML = updateProfileBtnEl.innerHTML;
    updateProfileBtnEl.disabled = true;
    updateProfileBtnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> अपडेट हो रहा है...';
    showMessage(profileMessageEl, ""); // पिछला संदेश हटाएं

    try {
        const dataToUpdate = {
            name: newName,
            name_lowercase: newName.toLowerCase(),
            contact: newContact, // यदि खाली है तो खाली स्ट्रिंग सहेजी जाएगी
            updatedAt: serverTimestamp()
        };
        // सुरक्षा नियम यह सुनिश्चित करेंगे कि एजेंट केवल इन फ़ील्ड्स को ही अपडेट कर सके
        await updateDoc(agentDocRef, dataToUpdate);
        showMessage(profileMessageEl, "प्रोफ़ाइल सफलतापूर्वक अपडेट किया गया!");
        console.log("प्रोफ़ाइल अपडेट किया गया:", dataToUpdate);
        // Welcome संदेश भी अपडेट करें (यदि मौजूद है)
        if(agentWelcomeMessageEl) agentWelcomeMessageEl.textContent = `Welcome, ${newName || currentUser.email}`;
    } catch (error) {
        console.error("Firestore में प्रोफ़ाइल अपडेट करने में त्रुटि:", error);
        showMessage(profileMessageEl, "प्रोफ़ाइल अपडेट करने में त्रुटि: " + error.message, true);
    } finally {
        updateProfileBtnEl.disabled = false;
        updateProfileBtnEl.innerHTML = originalBtnHTML;
    }
}

// पासवर्ड बदलें फॉर्म सबमिट हैंडलर
async function handlePasswordChange(event) {
    event.preventDefault();
    const currentPassword = currentPasswordInputEl.value;
    const newPassword = newPasswordInputEl.value;
    const confirmNewPassword = confirmNewPasswordInputEl.value;

    // Basic Validation
    if (!currentPassword || !newPassword || !confirmNewPassword) {
         showMessage(passwordChangeMessageEl, "सभी पासवर्ड फ़ील्ड आवश्यक हैं।", true);
         return;
    }
    if (newPassword !== confirmNewPassword) {
        showMessage(passwordChangeMessageEl, "नया पासवर्ड मेल नहीं खाता।", true);
        confirmNewPasswordInputEl.focus();
        return;
    }
    if (newPassword.length < 6) {
        showMessage(passwordChangeMessageEl, "नया पासवर्ड कम से कम 6 अक्षर का होना चाहिए।", true);
        newPasswordInputEl.focus();
        return;
    }

    // Disable button and show loader
    const originalBtnHTML = changePasswordBtnEl.innerHTML;
    changePasswordBtnEl.disabled = true;
    changePasswordBtnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> बदल रहा है...';
    showMessage(passwordChangeMessageEl, ""); // Clear previous message

    try {
        const user = auth.currentUser;
        if (!user) throw new Error("कोई उपयोगकर्ता वर्तमान में साइन इन नहीं है।");

        // Re-authenticate user
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        console.log("उपयोगकर्ता सफलतापूर्वक पुनः प्रमाणित हुआ।");

        // Change password
        await firebaseUpdatePassword(user, newPassword);
        console.log("पासवर्ड सफलतापूर्वक बदल दिया गया।");

        showMessage(passwordChangeMessageEl, "पासवर्ड सफलतापूर्वक बदल दिया गया!");
        passwordChangeFormEl.reset(); // फॉर्म रीसेट करें
    } catch (error) {
        console.error("पासवर्ड बदलने में त्रुटि:", error);
        let msg = "पासवर्ड बदलने में त्रुटि।";
        if (error.code === 'auth/wrong-password') {
            msg = "वर्तमान पासवर्ड गलत है। कृपया पुनः प्रयास करें।";
            currentPasswordInputEl.focus();
        } else if (error.code === 'auth/too-many-requests') {
            msg = "बहुत अधिक प्रयास। कृपया बाद में पुनः प्रयास करें।";
        } else if (error.code === 'auth/weak-password') {
             msg = "नया पासवर्ड कमजोर है। कृपया मजबूत पासवर्ड चुनें।";
             newPasswordInputEl.focus();
        } else {
            msg = `त्रुटि: ${error.message}`;
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
             if (confirm("क्या आप वाकई लॉग आउट करना चाहते हैं?")) {
                auth.signOut().then(() => {
                    window.location.href = 'agent_login.html';
                }).catch(error => {
                    console.error("Logout error:", error);
                    alert("लॉगआउट विफल रहा।");
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
            loadProfileData(); // प्रोफाइल डेटा लोड करें
        } else {
            // कोई उपयोगकर्ता लॉग इन नहीं है, लॉगिन पेज पर भेजें
            console.log("Agent not logged in on profile page. Redirecting...");
            window.location.replace('agent_login.html');
        }
    });

    console.log("Agent Profile JS Initialized.");
}); // End DOMContentLoaded