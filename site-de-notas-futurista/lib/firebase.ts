import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyAQS75d3hx5mDQwixNRjyRPLOSVWpyDpvk",
  authDomain: "contabilidade-ebed6.firebaseapp.com",
  projectId: "contabilidade-ebed6",
  storageBucket: "contabilidade-ebed6.firebasestorage.app",
  messagingSenderId: "92104290412",
  appId: "1:92104290412:web:e99492aeb27bd9f1902849",
  measurementId: "G-Q1CL360G25",
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export { app }
