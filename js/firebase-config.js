// js/firebase-config.js
// Apni Firebase project settings se yeh values replace karein
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
// Agar Authentication istemal karenge toh yeh bhi add karein
// import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// const auth = getAuth(app); // Agar Authentication use karein toh

// Export karein taki doosri files mein use kar sakein
export { db /*, auth */ };

// Essential Firestore functions ko bhi export kar sakte hain for convenience
// Ya har file mein separately import karein
export {
    collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
    query, where, orderBy, limit, serverTimestamp, Timestamp,
    writeBatch, runTransaction, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

console.log("Firebase Initialized");