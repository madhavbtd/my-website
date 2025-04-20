// js/login.js (Updated with Redirect Logic + Persistence Attempt)

// Ensure Firebase functions are available from login.html's script block
const { auth, signInWithEmailAndPassword, setPersistence, browserLocalPersistence } = window; // Added Persistence

// HTML Elements
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const errorMessageElement = document.getElementById('errorMessage');
const loginButton = document.getElementById('loginButton');

// Check if Firebase Auth objects loaded correctly
if (!auth || !signInWithEmailAndPassword || !setPersistence || !browserLocalPersistence) { // Check for new functions too
    console.error("Firebase Auth or Persistence functions are not available. Check initialization in login.html.");
    if (errorMessageElement) errorMessageElement.textContent = "Login system error. Refresh page.";
    if (loginButton) loginButton.disabled = true;

} else if (loginForm) {
    // Add event listener for form submission
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMessageElement.textContent = '';
        if(loginButton) {
            loginButton.disabled = true;
            loginButton.textContent = 'Logging in...';
        }

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            errorMessageElement.textContent = 'Please enter username and password.';
            if(loginButton) { loginButton.disabled = false; loginButton.textContent = 'Login'; }
            return;
        }

        const fakeEmail = username + '@yourapp.auth'; // Use your pattern
        console.log('Attempting login with:', fakeEmail);

        try {
            // ***** 1. Set Persistence BEFORE Signing In *****
            console.log("login.js: Attempting to set persistence before sign-in...");
            await setPersistence(auth, browserLocalPersistence);
            console.log("login.js: Persistence set to local.");

            // ***** 2. Sign in *****
            const userCredential = await signInWithEmailAndPassword(auth, fakeEmail, password);
            console.log('Login successful:', userCredential.user.uid);

            // ***** 3. Redirect Logic *****
            console.log("Login successful! Checking for redirect URL...");
            const urlParams = new URLSearchParams(window.location.search);
            const redirectUrl = urlParams.get('redirectUrl');

            if (redirectUrl) {
                const decodedUrl = decodeURIComponent(redirectUrl);
                console.log(`Redirecting back to original page: ${decodedUrl}`);
                window.location.replace(decodedUrl); // Use replace
            } else {
                console.log("Redirecting to default dashboard: index.html");
                 // --- index.html का सही पाथ यहाँ डालें ---
                window.location.replace('index.html'); // Use replace
            }
            // ***** Redirect Logic End *****

        } catch (error) {
            console.error('Login failed:', error.code, error.message);
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                errorMessageElement.textContent = 'Invalid username or password.';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessageElement.textContent = 'Network error. Check connection.';
            } else if (error.code === 'auth/operation-not-allowed') {
                 errorMessageElement.textContent = 'Login method not enabled in Firebase.';
            } else {
                errorMessageElement.textContent = 'Login failed. (' + error.code + ')';
            }
            // Re-enable button ONLY after error handling is complete
             if(loginButton) {
                 loginButton.disabled = false;
                 loginButton.textContent = 'Login';
             }
        }
    }); // End form submit listener
} else { // Handle case where login form itself is missing
    console.error("Login form element (#loginForm) not found!");
    if(errorMessageElement) errorMessageElement.textContent = "Login form did not load.";
}

console.log("login.js loaded.");