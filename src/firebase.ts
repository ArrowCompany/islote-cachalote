import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
const firebaseConfig = {
  apiKey: "AIzaSyCxNmw8j5oJQBfJ-n-tUDnno4Z1xW9dO5s",
  authDomain: "islote-cachalote.firebaseapp.com",
  databaseURL: "https://islote-cachalote-default-rtdb.firebaseio.com",
  projectId: "islote-cachalote",
  storageBucket: "islote-cachalote.firebasestorage.app",
  messagingSenderId: "922493250907",
  appId: "1:922493250907:web:82015eba723dda9081be7e",
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
