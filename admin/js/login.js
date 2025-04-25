// js/login.js (English Version)

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
        // Changed message to English
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
            // Changed button text to English
            loginButton.textContent = 'Logging in...';
        }

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        // Basic validation
        if (!username || !password) {
             // Changed message to English
            errorMessageElement.textContent = 'Please enter both username and password.';
            if(loginButton) {
                loginButton.disabled = false; // Re-enable button
                 // Changed button text to English
                loginButton.textContent = 'Login';
            }
            return; // Stop processing
        }

        // Create the 'fake' email from username for Firebase Auth
        // Ensure you use the same pattern when creating users in the console
        const fakeEmail = username + '@yourapp.auth';
        console.log('Attempting login with:', fakeEmail);

        try {
            // Sign in using Firebase Authentication
            const userCredential = await signInWithEmailAndPassword(auth, fakeEmail, password);
            console.log('Login successful:', userCredential.user.uid);

            // Redirect to the main dashboard or index page on successful login
            // Change 'index.html' to your actual main page if different
            window.location.href = 'index.html';

        } catch (error) {
            console.error('Login failed:', error.code, error.message);
            // Display user-friendly error messages in English
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                errorMessageElement.textContent = 'Invalid username or password.';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessageElement.textContent = 'Network error. Please check your connection.';
            } else {
                errorMessageElement.textContent = 'Login failed. Please try again. (' + error.code + ')';
            }
            if(loginButton) {
                loginButton.disabled = false; // Re-enable login button
                 // Changed button text to English
                loginButton.textContent = 'Login';
            }
        }
    });
} else {
    console.error("Login form element (#loginForm) not found!");
    if(errorMessageElement) {
        // Changed message to English
        errorMessageElement.textContent = "Login form did not load.";
    }
}