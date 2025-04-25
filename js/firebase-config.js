// js/firebase-config.js

// Firebase SDK से आवश्यक कार्यों को इम्पोर्ट करें
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"; // यदि ग्राहक प्रमाणीकरण आवश्यक हो

// आपकी वेब ऐप की Firebase कॉन्फ़िगरेशन
// !! अपनी वास्तविक कॉन्फ़िगरेशन यहाँ डालें (firebase-init.js से कॉपी करें) !!
const firebaseConfig = {
  apiKey: "AIzaSyB...", // आपकी apiKey
  authDomain: "madhav-multyprint.firebaseapp.com", // आपकी authDomain
  projectId: "madhav-multyprint", // आपकी projectId
  storageBucket: "madhav-multyprint.appspot.com", // आपकी storageBucket
  messagingSenderId: "10498...", // आपकी messagingSenderId
  appId: "1:10498...:web:...", // आपकी appId
};

// Firebase को इनिशियलाइज़ करें
let app;
let db, storage, functions, auth; // Export के लिए वेरिएबल घोषित करें

try {
    // केवल एक बार इनिशियलाइज़ करें
    if (!window.firebaseAppInitialized) {
        app = initializeApp(firebaseConfig);
        window.firebaseAppInitialized = true; // ग्लोबल फ़्लैग सेट करें
        window.firebaseApp = app; // ऐप इंस्टेंस को ग्लोबली स्टोर करें (वैकल्पिक)
        console.log("Firebase initialized successfully for Customer Website.");
    } else {
        app = window.firebaseApp; // मौजूदा इंस्टेंस का उपयोग करें
        console.log("Firebase already initialized for Customer Website.");
    }

    // सेवाओं को प्राप्त करें और Export के लिए असाइन करें
    db = getFirestore(app);
    storage = getStorage(app);
    functions = getFunctions(app, 'asia-south1'); // अपना क्षेत्र चुनें (वैकल्पिक)
    auth = getAuth(app); // Auth प्राप्त करें

} catch (error) {
    console.error("Firebase initialization error:", error);
    // उपयोगकर्ता को बताने के लिए एरर दिखाएं
    alert("वेबसाइट लोड करने में त्रुटि हुई। कृपया बाद में पुनः प्रयास करें।");
}

// उपयोग के लिए सेवाओं को Export करें
export { db, storage, functions, auth, app };