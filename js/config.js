import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAht0AfK6HtuVM0G-BsUp4go0nqag4hsV8",
    authDomain: "bg-exchange-44936.firebaseapp.com",
    projectId: "bg-exchange-44936",
    storageBucket: "bg-exchange-44936.firebasestorage.app",
    messagingSenderId: "621654422222",
    appId: "1:621654422222:web:a0604854dc015e9c91969f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
