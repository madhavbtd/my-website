// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// !! अपनी वास्तविक कॉन्फ़िगरेशन यहाँ डालें !!
const firebaseConfig = {
  apiKey: "AIzaSyB...", // आपकी apiKey
  authDomain: "madhav-multyprint.firebaseapp.com", // आपकी authDomain
  projectId: "madhav-multyprint", // आपकी projectId
  storageBucket: "madhav-multyprint.appspot.com", // आपकी storageBucket
  messagingSenderId: "10498...", // आपकी messagingSenderId
  appId: "1:10498...:web:...", // आपकी appId
};

let app;
let db, storage, functions, auth;

try {
    if (!window.firebaseAppInitialized) {
        app = initializeApp(firebaseConfig);
        window.firebaseAppInitialized = true;
        window.firebaseApp = app;
        console.log("Firebase initialized successfully for Customer Website.");
    } else {
        app = window.firebaseApp;
        console.log("Firebase already initialized for Customer Website.");
    }
    db = getFirestore(app);
    storage = getStorage(app);
    functions = getFunctions(app, 'asia-south1'); // अपना क्षेत्र चुनें
    auth = getAuth(app);
} catch (error) {
    console.error("Firebase initialization error:", error);
    alert("वेबसाइट लोड करने में त्रुटि हुई।");
}

export { db, storage, functions, auth, app };