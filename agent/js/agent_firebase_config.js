// /agent/js/agent_firebase_config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"; // signInWithEmailAndPassword, onAuthStateChanged यहाँ इम्पोर्ट करें
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"; // doc और getDoc यहाँ इम्पोर्ट करें

// --- आपकी वास्तविक Firebase कॉन्फ़िगरेशन ---
const firebaseConfig = {
  apiKey: "AIzaSyBQj5rQmE77kKKGYixP8y3Hcimz8tiAqzQ",
  authDomain: "madhav-multyprint.firebaseapp.com",
  projectId: "madhav-multyprint",
  storageBucket: "madhav-multyprint.appspot.com", // या .firebasestorage.app वाला
  messagingSenderId: "104988349637",
  appId: "1:104988349637:web:faf045b77c6786a4e70cac"
};
// ---------------------------------------------

let app;
let auth;
let db;

try {
    if (!window.firebaseAgentAppInitialized) {
        app = initializeApp(firebaseConfig, "agentPortalApp"); // यूनिक नाम महत्वपूर्ण है
        window.firebaseAgentAppInitialized = true;
        window.firebaseAgentApp = app;
        console.log("Firebase एजेंट पोर्टल के लिए agent_firebase_config.js द्वारा इनिशियलाइज़ किया गया।");
    } else {
        app = window.firebaseAgentApp;
        console.log("Firebase एजेंट पोर्टल के लिए पहले से इनिशियलाइज़्ड है।");
    }
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("एजेंट पोर्टल: Auth और DB इंस्टेंस प्राप्त किए गए।");

} catch (e) {
    console.error("Firebase एजेंट इनिशियलाइज़ेशन त्रुटि:", e);
    alert("एजेंट पोर्टल के लिए फायरबेस कॉन्फ़िगरेशन में त्रुटि है।");
    throw new Error("Firebase Agent Init Failed: " + e.message);
}

// इनिशियलाइज़ किए गए इंस्टेंस और आवश्यक फ़ंक्शंस एक्सपोर्ट करें
export {
    app,
    auth,
    db,
    // Firestore फ़ंक्शंस जिन्हें agent_login.js और अन्य एजेंट पेज उपयोग करेंगे
    doc,
    getDoc,
    // Auth फ़ंक्शंस जिन्हें agent_login.js और अन्य एजेंट पेज उपयोग करेंगे
    signInWithEmailAndPassword,
    onAuthStateChanged
};

// अन्य Firestore फंक्शन्स यहाँ एक्सपोर्ट किए जा सकते हैं यदि अन्य एजेंट फाइलें उन्हें यहाँ से इम्पोर्ट करना चाहें।
// यदि वे सीधे SDK से इम्पोर्ट कर रहे हैं, तो यहाँ दोबारा एक्सपोर्ट करने की आवश्यकता नहीं है।
// उदाहरण के लिए:
export {
    collection, addDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query,
    orderBy, where, Timestamp, serverTimestamp, limit, runTransaction, arrayUnion, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


console.log("agent_firebase_config.js लोड हुआ और एजेंट के लिए एक्सपोर्ट तैयार हैं।");