// js/login.js (Final Version with OTP Verification + Debug Log)

// Get Firebase functions from global scope (initialized in login.html)
const auth = window.auth;
const functions = window.functions; // Functions instance
const signInWithEmailAndPassword = window.signInWithEmailAndPassword;
const signInWithCustomToken = window.signInWithCustomToken; // Custom token sign-in
const httpsCallable = window.httpsCallable; // Callable function helper

// --- HTML Elements ---
// Login Section
const loginSection = document.getElementById('loginSection');
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const passwordGroup = document.getElementById('passwordGroup');
const loginButton = document.getElementById('loginButton');
const errorMessageElement = document.getElementById('errorMessage');

// OTP Section
const otpSection = document.getElementById('otpSection');
const otpForm = document.getElementById('otpForm');
const otpInput = document.getElementById('otp');
const verifyOtpButton = document.getElementById('verifyOtpButton');
const otpStatusMessage = document.getElementById('otpStatusMessage');
const otpErrorMessageElement = document.getElementById('otpErrorMessage');

// --- Callable Function References ---
let requestOtp;
let verifyOtp; // verifyOtp के लिए रेफरेंस
// Temporary storage for userId between steps
let currentUserId = null;

if (functions && httpsCallable) {
    try {
        requestOtp = httpsCallable(functions, 'requestOtp');
        verifyOtp = httpsCallable(functions, 'verifyOtp'); // verifyOtp फंक्शन का संदर्भ
        console.log("References to Firebase Functions obtained.");
    } catch (e) {
        console.error("Could not get httpsCallable function reference:", e);
        if(errorMessageElement) errorMessageElement.textContent = "Error setting up function calls.";
        if(loginButton) loginButton.disabled = true;
        if(verifyOtpButton) verifyOtpButton.disabled = true;
    }
} else {
     console.error("Firebase Functions/httpsCallable not available.");
     if(errorMessageElement) errorMessageElement.textContent = "Function call system did not load.";
     if(loginButton) loginButton.disabled = true;
     if(verifyOtpButton) verifyOtpButton.disabled = true;
}


// --- Event Listeners ---

// 1. Login Form Submission (Request OTP)
if (loginForm && auth && signInWithEmailAndPassword && requestOtp) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMessageElement.textContent = '';
        otpStatusMessage.textContent = '';
        otpErrorMessageElement.textContent = '';
        currentUserId = null; // पिछला userId हटाएं

        loginButton.disabled = true;
        loginButton.textContent = 'Checking...';

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            errorMessageElement.textContent = 'Please enter both username and password.';
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
            return;
        }

        const fakeEmail = username + '@yourapp.auth';
        console.log('Attempting password check with:', fakeEmail);

        try {
            // Step 1: Verify password first
            const userCredential = await signInWithEmailAndPassword(auth, fakeEmail, password);
            currentUserId = userCredential.user.uid; // <<< userId को स्टोर करें
            console.log('Password correct for user:', currentUserId); // <<< यह लॉग पहले से था

            // --- DEBUG: चेक करें कि userId फंक्शन में भेजने से पहले क्या है ---
            console.log('Data being sent to requestOtp:', { userId: currentUserId });
            // --- DEBUG लाइन यहाँ खत्म ---

            errorMessageElement.textContent = 'Password correct. Requesting OTP...'; // स्टेटस अपडेट
            console.log('Calling requestOtp Firebase function...');

            // Step 2: Call requestOtp function
            const result = await requestOtp({ userId: currentUserId }); // स्टोर्ड userId भेजें

            console.log('requestOtp function result:', result.data);

            if (result.data.status === 'success') {
                // OTP सफलतापूर्वक भेजा गया
                console.log('OTP Request successful.');
                otpStatusMessage.textContent = result.data.message || 'OTP sent to your registered email.';
                errorMessageElement.textContent = ''; // मुख्य एरर हटाएं
                // UI बदलें: लॉगिन सेक्शन छिपाएं, OTP सेक्शन दिखाएं
                if(loginSection) loginSection.style.display = 'none';
                if(otpSection) otpSection.style.display = 'block';
                otpInput.focus(); // OTP इनपुट पर फोकस करें
                // लॉगिन बटन को रीसेट करें (भले ही छिपा हो)
                loginButton.disabled = false;
                loginButton.textContent = 'Login';

            } else {
                // फंक्शन ने सफलता नहीं लौटाई (शायद कोई एरर हुआ?)
                console.error('OTP Request function returned non-success:', result.data);
                errorMessageElement.textContent = result.data.message || 'Failed to send OTP. Please try again.';
                loginButton.disabled = false;
                loginButton.textContent = 'Login';
                currentUserId = null; // userId हटाएं अगर OTP फेल हुआ
            }

        } catch (error) {
            // Handle errors from BOTH signIn and requestOtp calls
            console.error('Error during login or OTP request:', error);
             currentUserId = null; // एरर पर userId हटाएं
             if (error.code && (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential')) {
                errorMessageElement.textContent = 'Invalid username or password.';
            } else if (error.code && error.code.startsWith('functions/')) {
                 // Handle Cloud Function errors (जैसे 'यूजर ID आवश्यक है।')
                 errorMessageElement.textContent = 'Error requesting OTP: ' + (error.message || 'Please try again.');
            }
             else if (error.code === 'auth/network-request-failed') {
                errorMessageElement.textContent = 'Network error. Please check your connection.';
            } else {
                errorMessageElement.textContent = 'Login failed. Please try again.';
            }
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
        }
    });
} else {
    console.error("Could not initialize login form listener. Required elements or Firebase functions might be missing.");
     if(errorMessageElement) errorMessageElement.textContent = "Login form failed to initialize.";
}

// 2. OTP Form Submission (Verify OTP and Login)
if (otpForm && auth && signInWithCustomToken && verifyOtp) {
    otpForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        otpErrorMessageElement.textContent = '';
        otpStatusMessage.textContent = ''; // पिछला स्टेटस हटाएं

        verifyOtpButton.disabled = true;
        verifyOtpButton.textContent = 'Verifying...';

        const otpValue = otpInput.value.trim();

        // userId चेक करें (पहले स्टेप से मिलना चाहिए)
        if (!currentUserId) {
             otpErrorMessageElement.textContent = 'User session error. Please log in again.';
             // यूजर को वापस लॉगिन स्क्रीन पर भेजें
             if(loginSection) loginSection.style.display = 'block';
             if(otpSection) otpSection.style.display = 'none';
             verifyOtpButton.disabled = false;
             verifyOtpButton.textContent = 'Verify OTP';
             return;
        }

        if (!otpValue || !/^\d{6}$/.test(otpValue)) { // 6 अंकों का OTP जांचें
             otpErrorMessageElement.textContent = 'Please enter a valid 6-digit OTP.';
             verifyOtpButton.disabled = false;
             verifyOtpButton.textContent = 'Verify OTP';
             return;
        }

        console.log(`Attempting to verify OTP: ${otpValue} for userId: ${currentUserId}`);

        try {
            // Step 3: Call the verifyOtp function
            const result = await verifyOtp({ userId: currentUserId, otp: otpValue });

            console.log('verifyOtp function result:', result.data);

            if (result.data.status === 'success' && result.data.token) {
                // Step 4: OTP सही है, कस्टम टोकन मिला, अब साइन इन करें
                console.log('OTP verified. Signing in with custom token...');
                otpStatusMessage.textContent = 'OTP verified. Logging in...';
                const customToken = result.data.token;

                const userCredential = await signInWithCustomToken(auth, customToken);
                console.log('Final login successful with OTP:', userCredential.user.uid);
                currentUserId = null; // सेशन पूरा, userId हटाएं

                // लॉगिन सफल, अब रीडायरेक्ट करें
                window.location.href = 'index.html'; // या आपके डैशबोर्ड पेज पर

            } else {
                // फंक्शन ने सफलता नहीं लौटाई या टोकन नहीं मिला
                console.error('OTP Verification function returned non-success or missing token:', result.data);
                otpErrorMessageElement.textContent = result.data.message || 'OTP verification failed.';
                verifyOtpButton.disabled = false;
                verifyOtpButton.textContent = 'Verify OTP';
            }
        } catch (error) {
            // Handle errors from verifyOtp call or signInWithCustomToken
            console.error('Error during OTP verification or final sign-in:', error);
             if (error.code && error.code.startsWith('functions/')) {
                 otpErrorMessageElement.textContent = 'Verification Error: ' + (error.message || 'Please try again.');
             } else if (error.code && error.code.startsWith('auth/')) {
                 otpErrorMessageElement.textContent = 'Final login error. Please try again.';
             }
             else {
                 otpErrorMessageElement.textContent = 'Verification failed. Please try again.';
             }
             verifyOtpButton.disabled = false;
             verifyOtpButton.textContent = 'Verify OTP';
        }
    });
} else {
    console.error("Could not initialize OTP form listener.");
    if(otpErrorMessageElement) otpErrorMessageElement.textContent = "OTP form failed to initialize.";
}

console.log("login.js loaded (final version with debug).");