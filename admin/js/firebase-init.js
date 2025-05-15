// js/firebase-init.js
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js"; // Functions SDK इम्पोर्ट करें

// **** आपकी Firebase कॉन्फ़िगरेशन ****
const firebaseConfig = {
  apiKey: "AIzaSyBQj5rQmE77kKKGYixP8y3Hcimz8tiAqzQ", // सुनिश्चित करें कि यह सही API कुंजी है
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
        console.log("Firebase एडमिन पैनल के लिए firebase-init.js द्वारा इनिशियलाइज़ किया गया");
    } catch (e) {
        console.error("Firebase एडमिन इनिशियलाइज़ेशन विफल (firebase-init.js):", e);
        // उत्पादन में त्रुटि को अधिक उपयोगकर्ता-अनुकूल तरीके से संभालें
    }
} else {
    app = getApp(); // मौजूदा ऐप इंस्टेंस प्राप्त करें
    console.log("Firebase पहले से इनिशियलाइज़्ड है (firebase-init.js)");
}

let auth, db, functions;

try {
    auth = getAuth(app);
    db = getFirestore(app);
    // functions इंस्टेंस को भी यहीं इनिशियलाइज़ करें
    // सुनिश्चित करें कि आप Cloud Function के डिप्लॉयमेंट रीजन से मिलाते हैं
    // यदि Cloud Function us-central1 में है और आप यहाँ asia-south1 निर्दिष्ट करते हैं, तो समस्या हो सकती है।
    // यदि आपने Cloud Function को us-central1 में डिप्लॉय किया है, तो यहाँ भी us-central1 का उपयोग करें या कोई रीजन न दें।
    functions = getFunctions(app, "us-central1"); // या "asia-south1" यदि फंक्शन वहाँ डिप्लॉय हुआ है
    console.log("firebase-init.js: एडमिन के लिए Auth, DB, और Functions इंस्टेंस प्राप्त किए गए।");

    // प्रमाणीकरण स्थिति में बदलाव को सुनें (डीबगिंग और UI अपडेट के लिए उपयोगी)
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Firebase Auth State: User is signed in:", user.uid, user.email);
            // यहाँ आप UI को अपडेट कर सकते हैं या एडमिन को डैशबोर्ड पर भेज सकते हैं
        } else {
            console.log("Firebase Auth State: User is signed out.");
            // यहाँ आप उपयोगकर्ता को लॉग इन पेज पर भेज सकते हैं
            // window.location.href = '/admin/login.html'; // उदाहरण
        }
    });

} catch (e) {
     console.error("Auth/DB/Functions इंस्टेंस प्राप्त करने में विफल (firebase-init.js):", e);
     // उत्पादन में त्रुटि को अधिक उपयोगकर्ता-अनुकूल तरीके से संभालें
}

// इनिशियलाइज़ किए गए इंस्टेंस और आवश्यक फ़ंक्शंस एक्सपोर्ट करें
// createUserWithEmailAndPassword और signInWithEmailAndPassword को यहाँ से एक्सपोर्ट करने की आवश्यकता नहीं है
// यदि वे केवल login.js में इस्तेमाल हो रहे हैं, जहाँ उन्हें सीधे SDK से इम्पोर्ट किया जा सकता है।
// मुख्य इंस्टेंस को एक्सपोर्ट करना बेहतर है।
export {
    app,
    auth,
    db,
    functions // functions इंस्टेंस एक्सपोर्ट करें
    // doc, getDoc को सीधे agent_management.js में SDK से इम्पोर्ट किया जा सकता है
};

console.log("firebase-init.js मॉड्यूल लोड हुआ और एडमिन के लिए एक्सपोर्ट तैयार हैं।");