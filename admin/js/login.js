// js/login.js

// Firebase फ़ंक्शंस को firebase-init.js से इम्पोर्ट करें
// (सुनिश्चित करें कि firebase-init.js db, doc, getDoc भी एक्सपोर्ट करता है)
import { auth, signInWithEmailAndPassword, db, doc, getDoc } from './firebase-init.js';
// यदि firebase-init.js में Firestore फ़ंक्शंस पहले से एक्सपोर्टेड नहीं हैं, तो उन्हें यहाँ सीधे SDK से इम्पोर्ट करें:
// import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// और db को इनिशियलाइज़ करें: const db = getFirestore(window.firebaseApp); // यदि app ग्लोबल है

// HTML Elements
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const errorMessageElement = document.getElementById('errorMessage');
const loginButton = document.getElementById('loginButton');

if (!auth || !signInWithEmailAndPassword || !db || !doc || !getDoc) { // db, doc, getDoc की जाँच करें
    console.error("Firebase Auth या Firestore functions लोड नहीं हुए। firebase-init.js की जाँच करें।");
    if (errorMessageElement) {
        errorMessageElement.textContent = "लॉगिन सिस्टम लोड नहीं हुआ। कृपया पेज रिफ्रेश करें।";
    }
    if(loginButton) loginButton.disabled = true;
} else if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMessageElement.textContent = '';
        if(loginButton) {
            loginButton.disabled = true;
            loginButton.textContent = 'लॉगिन हो रहा है...';
        }

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            errorMessageElement.textContent = 'कृपया उपयोगकर्ता नाम और पासवर्ड दोनों दर्ज करें।';
            if(loginButton) {
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
            const agentDocRef = doc(db, "agents", user.uid); // 'agents' कलेक्शन का उपयोग करें
            const agentDocSnap = await getDoc(agentDocRef);

            if (agentDocSnap.exists()) {
                const agentData = agentDocSnap.data();
                if (agentData.role === 'admin' && agentData.status === 'active') {
                    console.log('एडमिन उपयोगकर्ता सत्यापित:', agentData);
                    // एडमिन डैशबोर्ड पर रीडायरेक्ट करें
                    window.location.href = 'index.html'; // या आपका एडमिन डैशबोर्ड पेज
                } else {
                    console.error('लॉगिन विफल: उपयोगकर्ता एक सक्रिय एडमिन नहीं है।', agentData);
                    errorMessageElement.textContent = 'पहुँच अस्वीकृत। आप एक सक्रिय एडमिन नहीं हैं।';
                    await auth.signOut(); // सुरक्षा के लिए साइन आउट करें
                    if(loginButton) {
                        loginButton.disabled = false;
                        loginButton.textContent = 'Login';
                    }
                }
            } else {
                console.error('लॉगिन विफल: Firestore में एडमिन रोल दस्तावेज़ नहीं मिला।');
                errorMessageElement.textContent = 'एडमिन प्रोफ़ाइल नहीं मिली।';
                await auth.signOut();
                if(loginButton) {
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
            if(loginButton) {
                loginButton.disabled = false;
                loginButton.textContent = 'Login';
            }
        }
    });
} else {
    console.error("लॉगिन फॉर्म एलिमेंट (#loginForm) नहीं मिला!");
    if(errorMessageElement) {
        errorMessageElement.textContent = "लॉगिन फॉर्म लोड नहीं हुआ।";
    }
}
console.log("login.js (भूमिका जाँच के साथ) लोड हुआ।");