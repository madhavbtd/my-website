// js/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword // createUserWithEmailAndPassword को इम्पोर्ट करें
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// **** आपकी Firebase कॉन्फ़िगरेशन ****
const firebaseConfig = {
    apiKey: "AIzaSyBQj5rQmE77kKKGYixP8y3Hcimz8tiAqzQ",
    authDomain: "madhav-multyprint.firebaseapp.com",
    projectId: "madhav-multyprint",
    storageBucket: "madhav-multyprint.appspot.com",
    messagingSenderId: "104988349637",
    appId: "1:104988349637:web:faf045b77c6786a4e70cac"
};

let app;
// पुन: इनिशियलाइज़ेशन रोकें
if (!window.firebaseAppInitialized) {
    try {
        app = initializeApp(firebaseConfig);
        window.firebaseAppInitialized = true;
        window.firebaseApp = app; // वैकल्पिक ग्लोबल संदर्भ
        console.log("Firebase एडमिन पैनल के लिए firebase-init.js द्वारा इनिशियलाइज़ किया गया");
    } catch (e) {
        console.error("Firebase एडमिन इनिशियलाइज़ेशन विफल (firebase-init.js):", e);
        throw new Error("Firebase initialization failed: " + e.message);
    }
} else {
    app = window.firebaseApp;
    console.log("Firebase पहले से इनिशियलाइज़्ड है (firebase-init.js)");
}

let auth, db;
try {
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("firebase-init.js: एडमिन के लिए Auth और DB इंस्टेंस प्राप्त किए गए।");
} catch (e) {
    console.error("Auth/Firestore इंस्टेंस प्राप्त करने में विफल (firebase-init.js):", e);
    throw new Error("Failed to get Auth/Firestore instances: " + e.message);
}

// इनिशियलाइज़ किए गए इंस्टेंस और आवश्यक फ़ंक्शंस एक्सपोर्ट करें
export {
    app,
    auth,
    db,
    doc,
    getDoc,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword // createUserWithEmailAndPassword को एक्सपोर्ट करें
};

// अन्य Firestore या Auth फ़ंक्शंस जिन्हें आपकी अन्य एडमिन JS फाइलें
// सीधे SDK से इम्पोर्ट करने के बजाय यहाँ से इम्पोर्ट कर सकती हैं (यदि आप चाहें)
// उदाहरण के लिए: collection, query, getDocs, onSnapshot, updateDoc, deleteDoc, Timestamp, serverTimestamp आदि।
// यदि वे पहले से ही सीधे SDK से इम्पोर्ट कर रहे हैं, तो उन्हें यहाँ एक्सपोर्ट करने की आवश्यकता नहीं है।

console.log("firebase-init.js मॉड्यूल लोड हुआ और एडमिन के लिए एक्सपोर्ट तैयार हैं।");