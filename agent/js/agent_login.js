// /agent/js/agent_login.js

// Firebase कॉन्फिग से auth और signInWithEmailAndPassword इम्पोर्ट करें
import { auth, signInWithEmailAndPassword } from './agent_firebase_config.js';

const loginForm = document.getElementById('agentLoginForm');
const emailInput = document.getElementById('agent-email');
const passwordInput = document.getElementById('agent-password');
const loginButton = document.getElementById('agentLoginBtn');
const loginButtonText = loginButton?.querySelector('.button-text');
const loginButtonLoader = loginButton?.querySelector('.button-loader');
const errorMessageElement = document.getElementById('loginErrorMessage');

// सुनिश्चित करें कि सभी ज़रूरी एलिमेंट्स मौजूद हैं
if (!loginForm || !emailInput || !passwordInput || !loginButton || !loginButtonText || !loginButtonLoader || !errorMessageElement) {
    console.error("Login form elements not found! Check HTML IDs.");
    alert("Login form structure error.");
} else {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // डिफ़ॉल्ट सबमिशन रोकें

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // बेसिक वैलिडेशन
        if (!email || !password) {
            displayLoginError("Please enter both email and password.");
            return;
        }

        // बटन को डिसेबल करें और लोडर दिखाएं
        setLoading(true);
        clearLoginError();

        try {
            console.log("Attempting login for:", email);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            // लॉगिन सफल!
            const user = userCredential.user;
            console.log("Login successful:", user.uid);

            // अगले पेज पर रीडायरेक्ट करें (अभी dashboard.html बनेगा)
            window.location.href = 'dashboard.html'; // अगले स्टेप में यह पेज बनाएंगे

        } catch (error) {
            console.error("Login failed:", error);
            // यूजर को समझने योग्य एरर मैसेज दिखाएं
            let message = "Login failed. Please check your credentials.";
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                message = "Invalid email or password.";
            } else if (error.code === 'auth/invalid-email') {
                message = "Please enter a valid email address.";
            } else if (error.code === 'auth/too-many-requests') {
                message = "Too many login attempts. Please try again later.";
            }
            displayLoginError(message);
            setLoading(false); // एरर होने पर लोडिंग रोकें
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

console.log("agent_login.js loaded and listeners attached.");