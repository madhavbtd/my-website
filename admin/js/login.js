// js/login.js

// Firebase फ़ंक्शंस को firebase-init.js से इम्पोर्ट करें
import { auth, signInWithEmailAndPassword, db, doc, getDoc } from './firebase-init.js';

// HTML Elements
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const errorMessageElement = document.getElementById('errorMessage');
const loginButton = document.getElementById('loginButton');

if (!auth || !signInWithEmailAndPassword || !db || !doc || !getDoc) {
    console.error("Firebase Auth या Firestore functions लोड नहीं हुए। firebase-init.js की जाँच करें।");
    if (errorMessageElement) {
        errorMessageElement.textContent = "लॉगिन सिस्टम लोड नहीं हुआ। कृपया पेज रिफ्रेश करें।";
    }
    if (loginButton) loginButton.disabled = true;
} else if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMessageElement.textContent = '';
        if (loginButton) {
            loginButton.disabled = true;
            loginButton.textContent = 'लॉगिन हो रहा है...';
        }

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            errorMessageElement.textContent = 'कृपया उपयोगकर्ता नाम और पासवर्ड दोनों दर्ज करें।';
            if (loginButton) {
                loginButton.disabled = false;
                loginButton.textContent = 'Login';
            }
            return;
        }

        const fakeEmail = username + '@yourapp.auth';
        console.log('इस ईमेल से लॉगिन का प्रयास किया जा रहा है:', fakeEmail);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, fakeEmail, password);
            const user = userCredential.user;
            console.log('Firebase Auth लॉगिन सफल:', user.uid);

            // Firestore से एडमिन रोल और स्थिति जांचें
            const agentDocRef = doc(db, "agents", user.uid);
            const agentDocSnap = await getDoc(agentDocRef);

            if (agentDocSnap.exists()) {
                const agentData = agentDocSnap.data();
                if (agentData.role === 'admin' && agentData.status === 'active') {
                    console.log('एडमिन उपयोगकर्ता सत्यापित:', agentData);
                    // सत्र में यूज़र की जानकारी संग्रहीत करें
                    sessionStorage.setItem('adminEmail', agentData.email);
                    sessionStorage.setItem('adminRole', agentData.role);
                    // एडमिन डैशबोर्ड पर रीडायरेक्ट करें
                    window.location.href = 'index.html';
                } else {
                    console.error('लॉगिन विफल: उपयोगकर्ता एक सक्रिय एडमिन नहीं है।', agentData);
                    errorMessageElement.textContent = 'पहुँच अस्वीकृत। आप एक सक्रिय एडमिन नहीं हैं।';
                    await auth.signOut();
                    if (loginButton) {
                        loginButton.disabled = false;
                        loginButton.textContent = 'Login';
                    }
                }
            } else {
                console.error('लॉगिन विफल: Firestore में एडमिन रोल दस्तावेज़ नहीं मिला।');
                errorMessageElement.textContent = 'एडमिन प्रोफ़ाइल नहीं मिली।';
                await auth.signOut();
                if (loginButton) {
                    loginButton.disabled = false;
                    loginButton.textContent = 'Login';
                }
            }
        } catch (error) {
            console.error('लॉगिन विफल:', error.code, error.message);
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                errorMessageElement.textContent = 'अमान्य उपयोगकर्ता नाम या पासवर्ड।';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessageElement.textContent = 'नेटवर्क त्रुटि। कृपया अपना कनेक्शन जांचें।';
            } else {
                errorMessageElement.textContent = 'लॉगिन विफल। कृपया पुनः प्रयास करें। (' + error.code + ')';
            }
            if (loginButton) {
                loginButton.disabled = false;
                loginButton.textContent = 'Login';
            }
        }
    });
} else {
    console.error("लॉगिन फॉर्म एलिमेंट (#loginForm) नहीं मिला!");
    if (errorMessageElement) {
        errorMessageElement.textContent = "लॉगिन फॉर्म लोड नहीं हुआ।";
    }
}

// पृष्ठ लोड होने पर सत्र से यूज़र की जानकारी प्राप्त करें और प्रदर्शित करें
function checkAdminSession() {
    const userEmail = sessionStorage.getItem('adminEmail');
    const userRole = sessionStorage.getItem('adminRole');
    if (userRole !== 'admin' || !userEmail) {
        // यूज़र एडमिन नहीं है या सत्र में जानकारी नहीं है, लॉगिन पेज पर रीडायरेक्ट करें
        window.location.href = 'login.html';
    } else {
        // यूज़र एडमिन है, एडमिन पेज पर यूज़र जानकारी प्रदर्शित करें (उदाहरण के लिए, वेलकम मैसेज)
        document.getElementById('welcomeMessage').textContent = `Welcome ${userEmail} (${userRole})`;
    }
}

// यदि आप एडमिन पेज पर हैं, तो सत्र की जाँच करें और यूज़र जानकारी प्रदर्शित करें
if (window.location.pathname.includes('index.html')) {
    checkAdminSession();
}

console.log("login.js (सत्र प्रबंधन और भूमिका जाँच के साथ) लोड हुआ।");