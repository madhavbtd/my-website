// js/login.js (Original English Version - Without OTP)

// Get Firebase functions from global scope (initialized in login.html)
const auth = window.auth;
const signInWithEmailAndPassword = window.signInWithEmailAndPassword;

// HTML Elements
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const errorMessageElement = document.getElementById('errorMessage');
const loginButton = document.getElementById('loginButton');

// Check if Firebase Auth objects loaded correctly
if (!auth || !signInWithEmailAndPassword) {
    console.error("Firebase Auth is not available. Check initialization in login.html.");
    if (errorMessageElement) {
        errorMessageElement.textContent = "Login system did not load. Please refresh the page.";
    }
    if(loginButton) loginButton.disabled = true;
} else if (loginForm) {
    // Add event listener for form submission
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission
        errorMessageElement.textContent = ''; // Clear previous error
        if(loginButton) {
            loginButton.disabled = true; // Disable login button
            loginButton.textContent = 'Logging in...';
        }

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        // Basic validation
        if (!username || !password) {
            errorMessageElement.textContent = 'Please enter both username and password.';
            if(loginButton) {
                loginButton.disabled = false; // Re-enable button
                loginButton.textContent = 'Login';
            }
            return; // Stop processing
        }

        // Create the 'fake' email from username for Firebase Auth
        const fakeEmail = username + '@yourapp.auth';
        console.log('Attempting login with:', fakeEmail);

        try {
            // Sign in using Firebase Authentication (DIRECT LOGIN)
            const userCredential = await signInWithEmailAndPassword(auth, fakeEmail, password);
            console.log('Login successful:', userCredential.user.uid);

            // Redirect to the main dashboard or index page on successful login
            window.location.href = 'index.html';

        } catch (error) {
            console.error('Login failed:', error.code, error.message);
            // Display user-friendly error messages
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                errorMessageElement.textContent = 'Invalid username or password.';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessageElement.textContent = 'Network error. Please check your connection.';
            } else {
                errorMessageElement.textContent = 'Login failed. Please try again. (' + error.code + ')';
            }
            if(loginButton) {
                loginButton.disabled = false; // Re-enable login button
                loginButton.textContent = 'Login';
            }
        }
    });
} else {
    console.error("Login form element (#loginForm) not found!");
    if(errorMessageElement) {
        errorMessageElement.textContent = "Login form did not load.";
    }
}
console.log("Original login.js loaded.");