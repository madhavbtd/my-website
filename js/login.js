// js/login.js (Final Update: Redirect Logic + Persistence Attempt)

// Ensure Firebase functions are available from login.html's script block
// Added setPersistence and browserLocalPersistence
const { auth, signInWithEmailAndPassword, setPersistence, browserLocalPersistence } = window;

// HTML Elements
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const errorMessageElement = document.getElementById('errorMessage');
const loginButton = document.getElementById('loginButton');

// Check if Firebase Auth objects loaded correctly
if (!auth || !signInWithEmailAndPassword || !setPersistence || !browserLocalPersistence) {
    console.error("Firebase Auth or Persistence functions are not available. Check login.html.");
    if (errorMessageElement) errorMessageElement.textContent = "Login system error (Code:L1). Refresh.";
    if (loginButton) loginButton.disabled = true;

} else if (loginForm) {
    // Add event listener for form submission
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMessageElement.textContent = '';
        if(loginButton) { loginButton.disabled = true; loginButton.textContent = 'Logging in...'; }

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
            console.log("login.js: Setting persistence to local...");
            await setPersistence(auth, browserLocalPersistence);
            console.log("login.js: Persistence set. Signing in...");

            // ***** 2. Sign in *****
            const userCredential = await signInWithEmailAndPassword(auth, fakeEmail, password);
            console.log('Login successful:', userCredential.user.uid);

            // ***** 3. Redirect Logic *****
            console.log("Checking for redirect URL...");
            const urlParams = new URLSearchParams(window.location.search);
            const redirectUrl = urlParams.get('redirectUrl');

            if (redirectUrl) {
                const decodedUrl = decodeURIComponent(redirectUrl);
                console.log(`Redirecting back to: ${decodedUrl}`);
                window.location.replace(decodedUrl);
            } else {
                console.log("Redirecting to default: index.html");
                 // !!!!! index.html का सही पाथ यहाँ डालें !!!!!
                window.location.replace('index.html');
            }
            // ***** Redirect Logic End *****

        } catch (error) { // Catch errors from setPersistence OR signIn...
            console.error('Login or Persistence setting failed:', error.code, error.message);
             if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                errorMessageElement.textContent = 'Invalid username or password.';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessageElement.textContent = 'Network error. Check connection.';
            } else if (error.code === 'auth/operation-not-allowed'){
                 errorMessageElement.textContent = 'Login method disabled.';
            } else { errorMessageElement.textContent = 'Login failed. ('+error.message+')'; }
            // Re-enable button
             if(loginButton) { loginButton.disabled = false; loginButton.textContent = 'Login'; }
        }
    }); // End submit listener
} else {
    console.error("Login form (#loginForm) not found!");
    if(errorMessageElement) errorMessageElement.textContent = "Login form load error (Code:L2).";
}

console.log("login.js loaded.");