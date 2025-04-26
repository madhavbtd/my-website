// js/firebase-config.js
// Updated with actual project settings and matching v10.12.2 imports

// Import functions from the v10 SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore, collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
    query, where, orderBy, limit, serverTimestamp, Timestamp,
    writeBatch, runTransaction, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// If you need Auth on the frontend later:
// import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Actual Firebase Configuration Details ---
const firebaseConfig = {
  apiKey: "AIzaSyBQj5rQmE77kKKGYixP8y3Hcimz8tiAqzQ", // From screenshot / manage-online-products.html
  authDomain: "madhav-multyprint.firebaseapp.com",    // From manage-online-products.html
  projectId: "madhav-multyprint",                   // From screenshot / manage-online-products.html
  storageBucket: "madhav-multyprint.firebasestorage.app", // Corrected value
  messagingSenderId: "104988349637",                // From manage-online-products.html
  appId: "1:104988349637:web:faf045b77c6786a4e70cac" // From manage-online-products.html
};
// ---------------------------------------------

// Initialize Firebase
let app;
try {
    // Prevent re-initialization if already done (e.g., in another script)
    if (!window.firebaseAppInitializedFrontend) {
        app = initializeApp(firebaseConfig);
        window.firebaseAppInitializedFrontend = true;
        window.firebaseAppFrontend = app; // Optional: store globally if needed
        console.log("Firebase Initialized for Frontend.");
    } else {
        app = window.firebaseAppFrontend;
        console.log("Firebase already initialized for Frontend.");
    }
} catch (e) {
    console.error("Firebase frontend initialization error:", e);
    // Display error to user or handle appropriately
    alert("Could not initialize Firebase. Please check the console.");
}


// Initialize services only if app initialization was successful
const db = app ? getFirestore(app) : null;
// const auth = app ? getAuth(app) : null; // Uncomment if you need auth

// Export the initialized db instance (and auth if needed)
export { db /*, auth */ };

// --- Important ---
// Re-exporting all Firestore functions might not be necessary if
// other scripts import them directly from the SDK like this file now does.
// However, keeping it for now as products.js might rely on it.
// If products.js directly imports from firebase/firestore, you can remove this export block.
export {
    collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
    query, where, orderBy, limit, serverTimestamp, Timestamp,
    writeBatch, runTransaction, arrayUnion, arrayRemove
}; // Make sure these are correctly imported above from the v10 SDK