// js/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// **** Your Firebase Configuration ****
// !!! सुनिश्चित करें कि यह कॉन्फ़िगरेशन सही है !!!
const firebaseConfig = {
  apiKey: "AIzaSyBQj5rQmE77kKKGYixP8y3Hcimz8tiAqzQ", // आपके कोड से
  authDomain: "madhav-multyprint.firebaseapp.com",   // आपके कोड से
  projectId: "madhav-multyprint",                // आपके कोड से
  storageBucket: "madhav-multyprint.appspot.com",   // आपके कोड से
  messagingSenderId: "104988349637",             // आपके कोड से
  appId: "1:104988349637:web:faf045b77c6786a4e70cac" // आपके कोड से
};

let app;
// Prevent re-initialization
if (!window.firebaseAppInitialized) {
    try {
        app = initializeApp(firebaseConfig);
        window.firebaseAppInitialized = true;
        window.firebaseApp = app; // Optional global ref
        console.log("Firebase initialized by firebase-init.js");
    } catch (e) {
        console.error("Firebase initialization failed in firebase-init.js:", e);
        // ऐप को लोड होने से रोकने के लिए त्रुटि फेंकें
        throw new Error("Firebase initialization failed: " + e.message);
    }
} else {
    app = window.firebaseApp;
    console.log("Firebase already initialized (firebase-init.js)");
}

let auth, db;
try {
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("firebase-init.js: Auth and DB instances obtained.");
} catch (e) {
     console.error("Failed to get Auth/Firestore instance in firebase-init.js:", e);
     // ऐप को लोड होने से रोकने के लिए त्रुटि फेंकें
     throw new Error("Failed to get Auth/Firestore instances: " + e.message);
}

// Export the initialized instances
export { app, auth, db };

// Firestore functions को सीधे SDK मॉड्यूल से री-एक्सपोर्ट करें
export {
    collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot,
    query, orderBy, where, Timestamp, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log("firebase-init.js module loaded and exports ready.");