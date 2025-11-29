import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBmU4M1ovbEEwC4i1_TXYPnjOlD3zwjNKw",
  authDomain: "e-commerce-b0c01.firebaseapp.com",
  projectId: "e-commerce-b0c01",
  storageBucket: "e-commerce-b0c01.firebasestorage.app",
  messagingSenderId: "222622446120",
  appId: "1:222622446120:web:0f575a7978d06d8ff0fb1d",
  measurementId: "G-ZD39N9N42K",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
