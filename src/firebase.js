import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  inMemoryPersistence, // 👈 ensures user is signed out on every refresh/start
} from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // 👈 Firestore
import { getStorage } from "firebase/storage"; // 👈 Firebase Storage

const firebaseConfig = {
  apiKey: "AIzaSyDIl7YA_y8ECKyY9QFbM5rjcw6Q74WABbg",
  authDomain: "tailwind-login-register.firebaseapp.com",
  projectId: "tailwind-login-register",
  storageBucket: "tailwind-login-register.firebasestorage.app",
  messagingSenderId: "587592497119",
  appId: "1:587592497119:web:255ee663c7bda18e02f66a",
  measurementId: "G-JLJRDGZQV0",
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ Auth setup
const auth = getAuth(app);
setPersistence(auth, inMemoryPersistence)
  .then(() => {
    console.log("✅ In-memory persistence set — always starts logged out.");
  })
  .catch((error) => {
    console.error("❌ Error setting persistence:", error);
  });

// ✅ Firestore setup
const db = getFirestore(app);

// ✅ Storage setup
const storage = getStorage(app);

// ✅ Export everything
export { app, auth, db, storage };
