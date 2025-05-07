// /agent/js/agent_login.js

// Firebase कॉन्फिग से auth, signInWithEmailAndPassword, और db, doc, getDoc इम्पोर्ट करें
import { auth, signInWithEmailAndPassword, db, doc, getDoc } from './agent_firebase_config.js';
// यदि agent_firebase_config.js में Firestore फ़ंक्शंस (db, doc, getDoc) एक्सपोर्टेड नहीं हैं,
// तो उन्हें यहाँ सीधे SDK से इम्पोर्ट करें:
// import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// और db को इनिशियलाइज़ करें: const db = getFirestore(app); // app agent_firebase_config.js से

const loginForm = document.getElementById('agentLoginForm');
const emailInput = document.getElementById('agent-email');
const passwordInput = document.getElementById('agent-password');
const loginButton = document.getElementById('agentLoginBtn');
const loginButtonText = loginButton?.querySelector('.button-text');
const loginButtonLoader = loginButton?.querySelector('.button-loader');
const errorMessageElement = document.getElementById('loginErrorMessage');

if (!loginForm || !emailInput || !passwordInput || !loginButton || !loginButtonText || !loginButtonLoader || !errorMessageElement || !db || !doc || !getDoc ) {
    console.error("लॉगिन फॉर्म एलिमेंट्स या Firestore फ़ंक्शंस नहीं मिले! HTML IDs और agent_firebase_config.js की जाँच करें।");
    alert("लॉगिन फॉर्म संरचना में त्रुटि।");
} else {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            displayLoginError("कृपया ईमेल और पासवर्ड दोनों दर्ज करें।");
            return;
        }

        setLoading(true);
        clearLoginError();

        try {
            console.log("इसके लिए लॉगिन का प्रयास किया जा रहा है:", email);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log("Firebase Auth लॉगिन सफल:", user.uid);

            // Firestore से एजेंट रोल और स्थिति जांचें
            const agentDocRef = doc(db, "agents", user.uid);
            const agentDocSnap = await getDoc(agentDocRef);

            if (agentDocSnap.exists()) {
                const agentData = agentDocSnap.data();
                if (agentData.role === 'agent' && agentData.status === 'active') {
                    console.log('एजेंट उपयोगकर्ता सत्यापित:', agentData);
                    // एजेंट डैशबोर्ड पर रीडायरेक्ट करें
                    window.location.href = 'dashboard.html'; // या आपका एजेंट डैशबोर्ड पेज
                } else {
                    console.error('लॉगिन विफल: उपयोगकर्ता एक सक्रिय एजेंट नहीं है।', agentData);
                    displayLoginError('पहुँच अस्वीकृत। आप एक सक्रिय एजेंट नहीं हैं या आपका खाता अक्षम है।');
                    await auth.signOut();
                    setLoading(false);
                }
            } else {
                console.error('लॉगिन विफल: Firestore में एजेंट रोल दस्तावेज़ नहीं मिला।');
                displayLoginError('एजेंट प्रोफ़ाइल नहीं मिली।');
                await auth.signOut();
                setLoading(false);
            }
        } catch (error) {
            console.error("लॉगिन विफल:", error);
            let message = "लॉगिन विफल। कृपया अपनी साख जांचें।";
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                message = "अमान्य ईमेल या पासवर्ड।";
            } else if (error.code === 'auth/invalid-email') {
                message = "कृपया एक मान्य ईमेल पता दर्ज करें।";
            } else if (error.code === 'auth/too-many-requests') {
                message = "बहुत अधिक लॉगिन प्रयास। कृपया बाद में पुनः प्रयास करें।";
            }
            displayLoginError(message);
            setLoading(false);
        }
    });
}

function displayLoginError(message) { /* ... (आपका मौजूदा फ़ंक्शन) ... */ }
function clearLoginError() { /* ... (आपका मौजूदा फ़ंक्शन) ... */ }
function setLoading(isLoading) { /* ... (आपका मौजूदा फ़ंक्शन) ... */ }

console.log("agent_login.js (भूमिका जाँच के साथ) लोड हुआ और लिस्नर संलग्न हैं।");