// js/login.js (Final - Uses passed auth, includes persistence)

// Import functions needed specifically within this file's scope
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Define the main initialization function
function initializeLoginForm(auth) { // Receive auth object from login.html
    console.log("DEBUG: initializeLoginForm function started in login.js.");

    // --- Get HTML Elements ---
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMessageElement = document.getElementById('errorMessage');
    const loginButton = document.getElementById('loginButton');

    // --- Check if elements exist ---
    if (!loginForm || !usernameInput || !passwordInput || !errorMessageElement || !loginButton) {
        console.error("Login form elements missing in login.js! Cannot attach listener.");
        if(errorMessageElement) errorMessageElement.textContent = "Login form load error (Code:J1).";
        return; // Stop if elements aren't found
    }

    // --- Check if auth object was passed ---
    if (!auth) {
        console.error("Auth object not received in initializeLoginForm!");
        errorMessageElement.textContent = "Login system error (Code:J2).";
        loginButton.disabled = true;
        return;
    }
     // --- Check if needed functions exist ---
     // (signInWithEmailAndPassword etc. are imported directly now, so no need for window check)

    console.log("login.js: Attaching form submit listener.");
    // --- Add event listener for form submission ---
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default page reload
        errorMessageElement.textContent = ''; // Clear previous error
        loginButton.disabled = true; // Disable button
        loginButton.textContent = 'Logging in...';

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        // Basic input validation
        if (!username || !password) {
            errorMessageElement.textContent = 'Please enter username and password.';
            loginButton.disabled = false; loginButton.textContent = 'Login';
            return;
        }

        // Create 'fake' email (use your consistent pattern)
        const fakeEmail = username + '@yourapp.auth';
        console.log('Attempting login with:', fakeEmail);

        try {
            // ***** 1. Ensure Persistence is set (might be redundant if set in html, but safe) *****
            // Note: Calling setPersistence multiple times is safe.
            console.log("login.js: Ensuring persistence is set before sign-in...");
            await setPersistence(auth, browserLocalPersistence); // Use the passed 'auth'
            console.log("login.js: Persistence set/confirmed.");

            // ***** 2. Sign in *****
            console.log("login.js: Attempting signInWithEmailAndPassword...");
            const userCredential = await signInWithEmailAndPassword(auth, fakeEmail, password); // Use the passed 'auth'
            console.log('Login successful:', userCredential.user.uid);

            // ***** 3. Redirect Logic (using URL parameter) *****
            console.log("Checking for redirect URL...");
            const urlParams = new URLSearchParams(window.location.search);
            const redirectUrl = urlParams.get('redirectUrl');

            if (redirectUrl) {
                const decodedUrl = decodeURIComponent(redirectUrl);
                console.log(`Redirecting back to: ${decodedUrl}`);
                window.location.replace(decodedUrl); // Use replace
            } else {
                console.log("Redirecting to default: index.html");
                 // !!!!! index.html का सही पाथ यहाँ डालें !!!!!
                window.location.replace('index.html'); // Use replace
            }
            // ***** Redirect Logic End *****

        } catch (error) {
            // Handle Errors (from persistence or sign-in)
            console.error('Login Process Error:', error); // Log the whole error
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                errorMessageElement.textContent = 'Invalid username or password.';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessageElement.textContent = 'Network error. Check connection.';
            } else if (error.code === 'auth/operation-not-allowed') {
                 errorMessageElement.textContent = 'Login method disabled in Firebase.';
            } else {
                // Display a generic message but log the specific code
                errorMessageElement.textContent = 'Login failed. Please try again.';
                 console.error(`Login failed with code: ${error.code}, message: ${error.message}`);
            }
            // Re-enable button only after error
             if(loginButton) {
                 loginButton.disabled = false;
                 loginButton.textContent = 'Login';
             }
        }
    }); // End submit listener

    console.log("login.js: Initialization complete, listener attached.");

} // End initializeLoginForm function

// --- Make the initialization function available globally ---
// login.html will call this function after Firebase is ready
window.initializeLoginForm = initializeLoginForm;

console.log("login.js script parsed. Defined initializeLoginForm. Waiting for call.");