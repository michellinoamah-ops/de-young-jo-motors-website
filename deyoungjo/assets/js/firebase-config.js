// =====================================================================
// DE YOUNG JO MOTORS: Firebase bootstrap
// Uses the Firebase Modular SDK (v10) loaded straight from Google's CDN
// so the whole site works with zero build step. Every other JS file in
// /assets/js imports { app, auth, db, storage } from this one file.
// =====================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getStorage
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

// Your web app's Firebase configuration (as supplied)
const firebaseConfig = {
  apiKey: "AIzaSyDrXctaEpKwZIzukHiMYbkOA3pTXKt2_O8",
  authDomain: "deyoungjo-website.firebaseapp.com",
  projectId: "deyoungjo-website",
  storageBucket: "deyoungjo-website.firebasestorage.app",
  messagingSenderId: "508348155180",
  appId: "1:508348155180:web:f5e7668ee2b2a5e8ad5889"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// -------- Site-wide constants --------
export const WHATSAPP_NUMBER = "2348062729739"; // no + and no leading zero drop, international format
export const SITE_NAME = "De Young Jo Motors";
export const SITE_EMAIL = "info@deyoungjomotors.com"; // update in Admin → Settings
export const AFFILIATE_FORM_URL = "#"; // paste the Google Form link in Admin → Settings, or replace here

export function waLink(message){
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
