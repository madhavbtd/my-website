// js/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// **** Your Firebase Configuration ****
const firebaseConfig = {
  apiKey: "AIzaSyBQj5rQmE77kKKGYixP8y3Hcimz8tiAqzQ",
  authDomain: "madhav-multyprint.firebaseapp.com",
  projectId: "madhav-multyprint",
  storageBucket: "madhav-multyprint.appspot.com",
  messagingSenderId: "104988349637",
  appId: "1:104988349637:web:faf045b77c6786a4e70cac"
};

let app;
if (!window.firebaseAppInitialized) {
    try {
        app = initializeApp(firebaseConfig);
        window.firebaseAppInitialized = true;
        window.firebaseApp = app;
        console.log("Firebase initialized by firebase-init.js");
    } catch (e) {
        console.error("Firebase initialization failed in firebase-init.js:", e);
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
     throw new Error("Failed to get Auth/Firestore instances: " + e.message);
}

export { app, auth, db };

// Firestore functions को सीधे SDK मॉड्यूल से री-एक्सपोर्ट करें
export {
    collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot,
    query, orderBy, where, Timestamp, serverTimestamp,
    runTransaction // <<<--- यह जोड़ा गया है
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log("firebase-init.js module loaded and exports ready.");