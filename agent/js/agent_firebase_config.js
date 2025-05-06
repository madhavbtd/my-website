// /agent/js/agent_firebase_config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- आपकी वास्तविक Firebase कॉन्फ़िगरेशन ---
const firebaseConfig = {
  apiKey: "AIzaSyBQj5rQmE77kKKGYixP8y3Hcimz8tiAqzQ", // आपकी Web API Key
  authDomain: "madhav-multyprint.firebaseapp.com",    // आपका Auth Domain
  projectId: "madhav-multyprint",                   // आपका Project ID
  storageBucket: "madhav-multyprint.appspot.com",   // आपका Storage Bucket
  messagingSenderId: "104988349637",                // आपका Sender ID
  appId: "1:104988349637:web:faf045b77c6786a4e70cac" // आपका App ID
};
// ---------------------------------------------

let app;
let auth;
let db;

try {
    if (!window.firebaseAgentAppInitialized) {
        // ऐप को एक यूनिक नाम दें ताकि यह एडमिन ऐप से अलग रहे
        app = initializeApp(firebaseConfig, "agentPortalApp"); 
        window.firebaseAgentAppInitialized = true;
        window.firebaseAgentApp = app;
        console.log("Firebase Initialized for Agent Portal.");
    } else {
        app = window.firebaseAgentApp;
        console.log("Firebase already initialized for Agent Portal.");
    }
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Agent Portal: Auth and DB instances obtained.");

} catch (e) {
    console.error("Firebase Agent initialization error:", e);
    alert("एजेंट पोर्टल के लिए फायरबेस कॉन्फ़िगरेशन में त्रुटि है।");
    throw new Error("Firebase Agent Init Failed: " + e.message);
}

// इनिशियलाइज़ किए गए इंस्टेंस एक्सपोर्ट करें
export { app, auth, db };

// अन्य आवश्यक फायरबेस फंक्शन्स को भी एक्सपोर्ट करें (जैसे लॉगिन के लिए)
export { 
    signInWithEmailAndPassword, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// अन्य Firestore फंक्शन्स एक्सपोर्ट करें (यदि agent_login.js या अन्य फाइलों में सीधे कॉन्फिग से इम्पोर्ट करने की आवश्यकता हो)
export { 
    collection, doc, addDoc, getDoc, getDocs, 
    updateDoc, deleteDoc, onSnapshot, query, 
    orderBy, where, Timestamp, serverTimestamp, 
    limit, runTransaction, arrayUnion, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log("agent_firebase_config.js loaded and exports ready.");