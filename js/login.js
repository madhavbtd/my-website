// js/login.js (Updated with Redirect Logic)

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
            loginButton.disabled = true;
            loginButton.textContent = 'Logging in...';
        }

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            errorMessageElement.textContent = 'Please enter both username and password.';
            if(loginButton) {
                loginButton.disabled = false;
                loginButton.textContent = 'Login';
            }
            return;
        }

        // Create the 'fake' email from username
        const fakeEmail = username + '@yourapp.auth'; // --- सुनिश्चित करें कि यह वही पैटर्न है जो यूजर बनाते समय इस्तेमाल किया था ---
        console.log('Attempting login with:', fakeEmail);

        try {
            // Sign in using Firebase Authentication
            const userCredential = await signInWithEmailAndPassword(auth, fakeEmail, password);
            console.log('Login successful:', userCredential.user.uid);

            // ########## <<<<< UPDATED REDIRECT LOGIC START >>>>> ##########
            console.log("Login successful! Checking for redirect URL...");

            // Get redirectUrl parameter from the current URL
            const urlParams = new URLSearchParams(window.location.search);
            const redirectUrl = urlParams.get('redirectUrl');

            if (redirectUrl) {
                // If redirectUrl exists, decode it and redirect there
                const decodedUrl = decodeURIComponent(redirectUrl);
                console.log(`Redirecting back to original page: ${decodedUrl}`);
                window.location.replace(decodedUrl); // Use replace to avoid login page in history
            } else {
                // If no redirectUrl, go to default index.html
                console.log("Redirecting to default dashboard: index.html");
                 // --- index.html का सही पाथ यहाँ डालें ---
                window.location.replace('index.html'); // Use replace
            }
            // ########## <<<<< UPDATED REDIRECT LOGIC END >>>>> ##########

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

console.log("login.js loaded and listeners attached (if form found).");