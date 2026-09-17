// =====================================================================
// DE YOUNG JO MOTORS: admin authentication
// Anyone can have a Firebase Auth account, but only a uid that has a
// matching document in the "admins" collection is treated as staff.
// This file also guards admin-dashboard.html (imported there too).
// =====================================================================
import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

export async function isAdmin(user) {
  if (!user) return false;
  try {
    const snap = await getDoc(doc(db, "admins", user.uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function requireAdmin(onReady) {
  onAuthStateChanged(auth, async (user) => {
    const ok = await isAdmin(user);
    if (!ok) {
      window.location.href = "admin-login.html";
      return;
    }
    onReady(user);
  });
}

export async function adminLogout() {
  await signOut(auth);
  window.location.href = "admin-login.html";
}

// ---- Wire the login form (only present on admin-login.html) ----
const form = document.getElementById("loginForm");
if (form) {
  // If already signed in as an admin, skip straight to the dashboard.
  onAuthStateChanged(auth, async (user) => {
    if (user && await isAdmin(user)) window.location.href = "admin-dashboard.html";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("loginBtn");
    const err = document.getElementById("loginError");
    err.className = "form-status";
    btn.disabled = true; btn.textContent = "Signing in…";
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const ok = await isAdmin(cred.user);
      if (!ok) {
        await signOut(auth);
        throw new Error("This account is not registered as an admin. Add its UID to the 'admins' collection in Firestore.");
      }
      window.location.href = "admin-dashboard.html";
    } catch (e2) {
      err.textContent = e2.message.includes("admins collection")
        ? e2.message
        : "Sign-in failed. Check your email and password and try again.";
      err.className = "form-status show err";
    } finally {
      btn.disabled = false; btn.textContent = "Sign in";
    }
  });
}
