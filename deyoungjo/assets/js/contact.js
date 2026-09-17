// =====================================================================
// DE YOUNG JO MOTORS: contact form
// Writes to Firestore collection "enquiries". Admin replies to these
// from the admin dashboard (Enquiries tab), which emails the customer
// back directly via EmailJS — see /admin.js for that half.
// =====================================================================
import { db } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contactForm");
  if (!form) return;
  const status = document.getElementById("contactStatus");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Sending…";
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await addDoc(collection(db, "enquiries"), {
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        subject: data.subject || "General enquiry",
        message: data.message || "",
        status: "new",
        replied: false,
        reply: "",
        createdAt: serverTimestamp()
      });
      status.textContent = "Message sent. We usually reply within a few hours, and you can also reach us instantly on WhatsApp below.";
      status.className = "form-status show ok";
      form.reset();
    } catch (err) {
      console.error(err);
      status.textContent = "Something went wrong sending your message. Please try WhatsApp instead.";
      status.className = "form-status show err";
    } finally {
      btn.disabled = false; btn.textContent = "Send message";
    }
  });
});
