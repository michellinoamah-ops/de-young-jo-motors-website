// =====================================================================
// DE YOUNG JO MOTORS: affiliate application
// Writes to Firestore collection "affiliateApplications". This captures
// interest right on the site; the full onboarding form (Google Form)
// link is managed from Admin → Settings and shown after submission.
// =====================================================================
import { db } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("affiliateForm");
  if (!form) return;
  const status = document.getElementById("affiliateStatus");
  const linkBox = document.getElementById("affiliateFormLink");

  // Pull the live Google Form link from Settings, if the admin has saved one.
  try {
    const s = await getDoc(doc(db, "settings", "general"));
    if (s.exists() && s.data().affiliateFormUrl && linkBox) {
      linkBox.href = s.data().affiliateFormUrl;
      linkBox.classList.remove("hidden");
    }
  } catch (e) { /* settings not created yet — fine */ }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Submitting…";
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await addDoc(collection(db, "affiliateApplications"), {
        fullName: data.fullName || "",
        email: data.email || "",
        phone: data.phone || "",
        city: data.city || "",
        platform: data.platform || "",
        audience: data.audience || "",
        message: data.message || "",
        status: "pending",
        createdAt: serverTimestamp()
      });
      status.textContent = "Application received! Our partnerships team will reach out on WhatsApp or email shortly.";
      status.className = "form-status show ok";
      form.reset();
      if (linkBox) linkBox.classList.remove("hidden");
    } catch (err) {
      console.error(err);
      status.textContent = "Something went wrong submitting your application. Please try again or message us on WhatsApp.";
      status.className = "form-status show err";
    } finally {
      btn.disabled = false; btn.textContent = "Submit application";
    }
  });
});
