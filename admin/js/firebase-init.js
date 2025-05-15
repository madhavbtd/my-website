// js/firebase-init.js
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

// **** आपकी Firebase कॉन्फ़िगरेशन ****
const firebaseConfig = {
  apiKey: "AIzaSyBQj5rQmE77kKKGYixP8y3Hcimz8tiAqzQ", // यह आपकी सही API कुंजी होनी चाहिए
  authDomain: "madhav-multyprint.firebaseapp.com",
  projectId: "madhav-multyprint",
  storageBucket: "madhav-multyprint.appspot.com",
  messagingSenderId: "104988349637",
  appId: "1:104988349637:web:faf045b77c6786a4e70cac"
};

let app;
// सुनिश्चित करें कि ऐप केवल एक बार इनिशियलाइज़ हो
if (!getApps().length) {
    try {
        app = initializeApp(firebaseConfig);
        console.log("Firebase (firebase-init.js) initialized for the project.");
    } catch (e) {
        console.error("Firebase initialization failed (firebase-init.js):", e);
    }
} else {
    app = getApp();
    console.log("Firebase was already initialized (firebase-init.js).");
}

let auth, db, functions;

try {
    auth = getAuth(app);
    db = getFirestore(app);
    // Cloud Function के डिप्लॉयमेंट रीजन से मिलाएं (जैसे "us-central1" या "asia-south1")
    functions = getFunctions(app, "us-central1");
    console.log("firebase-init.js: Auth, DB, and Functions instances obtained.");

    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Firebase Auth State (firebase-init.js): User is signed in:", user.uid, user.email);
        } else {
            console.log("Firebase Auth State (firebase-init.js): User is signed out.");
        }
    });

} catch (e) {
     console.error("Failed to get Auth/DB/Functions instances (firebase-init.js):", e);
}

// इनिशियलाइज़ किए गए इंस्टेंस और आवश्यक फ़ंक्शंस एक्सपोर्ट करें
export {
    app,
    auth,
    db,
    functions, // Cloud Functions के लिए
    // Firestore फ़ंक्शंस जिनकी login.js या अन्य फाइलों को आवश्यकता हो सकती है
    doc,
    getDoc,
    // Auth फ़ंक्शन जिनकी login.js या अन्य फाइलों को आवश्यकता हो सकती है
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword
};

console.log("firebase-init.js module loaded and exports are ready.");