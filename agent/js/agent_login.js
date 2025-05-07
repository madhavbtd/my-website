// /agent/js/agent_login.js

// Import auth, signInWithEmailAndPassword, and db, doc, getDoc from Firebase config
import { auth, signInWithEmailAndPassword, db, doc, getDoc } from './agent_firebase_config.js';
// If Firestore functions (db, doc, getDoc) are not exported in agent_firebase_config.js,
// import them directly from the SDK here:
// import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// and initialize db: const db = getFirestore(app); // app from agent_firebase_config.js

const loginForm = document.getElementById('agentLoginForm');
const emailInput = document.getElementById('agent-email');
const passwordInput = document.getElementById('agent-password');
const loginButton = document.getElementById('agentLoginBtn');
const loginButtonText = loginButton?.querySelector('.button-text');
const loginButtonLoader = loginButton?.querySelector('.button-loader');
const errorMessageElement = document.getElementById('loginErrorMessage');

// Ensure all necessary elements and Firestore functions are found
if (!loginForm || !emailInput || !passwordInput || !loginButton || !loginButtonText || !loginButtonLoader || !errorMessageElement || !db || !doc || !getDoc ) {
    console.error("Login form elements or Firestore functions not found! Check HTML IDs and agent_firebase_config.js.");
    alert("Error in login form structure.");
} else {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent default submission

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Basic validation
        if (!email || !password) {
            displayLoginError("Please enter both email and password."); // Translated
            return;
        }

        // Disable button and show loader
        setLoading(true);
        clearLoginError();

        try {
            console.log("Attempting login for:", email);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log("Firebase Auth login successful:", user.uid);

            // Check agent role and status from Firestore
            const agentDocRef = doc(db, "agents", user.uid); // db should come from agent_firebase_config.js
            const agentDocSnap = await getDoc(agentDocRef);

            if (agentDocSnap.exists()) {
                const agentData = agentDocSnap.data();
                if (agentData.role === 'agent' && agentData.status === 'active') {
                    console.log('Agent user verified:', agentData);
                    setLoading(false); // Re-enable button before redirect
                    // Redirect to agent dashboard
                    window.location.href = 'dashboard.html'; // Or your agent dashboard page
                } else {
                    console.error('Login failed: User is not an active agent.', agentData);
                    displayLoginError('Access denied. You are not an active agent or your account is disabled.'); // Translated
                    await auth.signOut();
                    setLoading(false);
                }
            } else {
                console.error('Login failed: Agent role document not found in Firestore.');
                displayLoginError('Agent profile not found.'); // Translated
                await auth.signOut();
                setLoading(false);
            }
        } catch (error) {
            console.error("Login failed:", error);
            // Show user-friendly error messages
            let message = "Login failed. Please check your credentials."; // Translated
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                message = "Invalid email or password."; // Translated
            } else if (error.code === 'auth/invalid-email') {
                message = "Please enter a valid email address."; // Translated
            } else if (error.code === 'auth/too-many-requests') {
                message = "Too many login attempts. Please try again later."; // Translated
            }
            displayLoginError(message);
            setLoading(false); // Stop loading on error
        }
    });
}

function displayLoginError(message) {
    if (errorMessageElement) {
        errorMessageElement.textContent = message;
        errorMessageElement.style.display = 'block';
    }
}

function clearLoginError() {
    if (errorMessageElement) {
        errorMessageElement.textContent = '';
        errorMessageElement.style.display = 'none';
    }
}

function setLoading(isLoading) {
    if (!loginButton || !loginButtonText || !loginButtonLoader) return;
    if (isLoading) {
        loginButton.disabled = true;
        loginButtonText.style.display = 'none';
        loginButtonLoader.style.display = 'inline-flex'; // Show loader
    } else {
        loginButton.disabled = false;
        loginButtonText.style.display = 'inline'; // Show text
        loginButtonLoader.style.display = 'none'; // Hide loader
    }
}

console.log("agent_login.js (with role check and setLoading fix) loaded and listeners attached."); // Translated comment