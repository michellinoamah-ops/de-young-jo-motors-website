// =====================================================================
// DE YOUNG JO MOTORS: shared site behaviour
// Loaded as a module on every public page.
// =====================================================================
import { db, waLink } from "./firebase-config.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import "./cart.js"; // registers the floating shortlist badge on every page that loads main.js

/* ---------------- Mobile nav ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  const burger = document.querySelector(".nav-burger");
  const mobile = document.querySelector(".nav-mobile");
  if (burger && mobile) {
    burger.addEventListener("click", () => mobile.classList.toggle("open"));
  }
});

/* ---------------- WhatsApp buttons ----------------
   Any element with [data-wa-message] becomes a live wa.me link.
   Falls back to a generic enquiry message if none is set.
------------------------------------------------------ */
function wireWhatsAppButtons() {
  document.querySelectorAll("[data-wa-message]").forEach(el => {
    const msg = el.getAttribute("data-wa-message") ||
      "Hi De Young Jo Motors, I found your website and I'd like some help.";
    el.setAttribute("href", waLink(msg));
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener");
  });
}
document.addEventListener("DOMContentLoaded", wireWhatsAppButtons);

/* ---------------- Floating WhatsApp button ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  if (document.querySelector(".wa-float")) return; // page opted out
  const a = document.createElement("a");
  a.className = "wa-float";
  a.setAttribute("aria-label", "Chat with us on WhatsApp");
  a.innerHTML = `<svg width="30" height="30" viewBox="0 0 32 32" fill="currentColor"><path d="M16.02 3C9.4 3 4 8.4 4 15.02c0 2.35.65 4.55 1.78 6.44L4 29l7.72-1.72a11.9 11.9 0 0 0 4.3.8h.01c6.62 0 12.02-5.4 12.02-12.02C28.05 8.4 22.65 3 16.02 3zm0 21.86c-1.44 0-2.83-.36-4.05-1.03l-.29-.16-4.58 1.02 1.05-4.46-.19-.3a9.75 9.75 0 0 1-1.53-5.24C6.43 9.42 10.83 5 16.02 5c5.19 0 9.4 4.42 9.4 9.86 0 5.44-4.21 9.99-9.4 9.99zm5.4-7.4c-.29-.15-1.74-.86-2-.95-.27-.1-.47-.15-.66.15-.2.29-.76.95-.93 1.15-.17.2-.34.22-.63.07-.29-.15-1.23-.46-2.35-1.47-.87-.78-1.45-1.75-1.63-2.04-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.2-.29.29-.49.1-.2.05-.37-.02-.51-.07-.15-.66-1.6-.9-2.19-.24-.58-.48-.5-.66-.5-.17 0-.37-.02-.56-.02-.2 0-.51.07-.78.37-.27.29-1.02 1-1.02 2.44s1.05 2.83 1.2 3.03c.15.2 2.07 3.17 5.02 4.44.7.3 1.25.48 1.68.62.7.22 1.34.19 1.85.12.56-.08 1.74-.71 1.98-1.4.25-.68.25-1.27.17-1.4-.07-.12-.27-.2-.56-.34z"/></svg>`;
  document.body.appendChild(a);
  wireWhatsAppButtons(); // include the float button too
  const genericMsg = document.body.getAttribute("data-wa-default") ||
    "Hi De Young Jo Motors, I'm on your website and I'd like some help.";
  if (!a.getAttribute("data-wa-message")) {
    a.setAttribute("data-wa-message", genericMsg);
    a.setAttribute("href", waLink(genericMsg));
    a.target = "_blank"; a.rel = "noopener";
  }
});

/* ---------------- Hidden admin gate ----------------
   Tap the small gold dot beside the footer copyright line
   5 times within 3 seconds to open the admin login page.
------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const gate = document.getElementById("adminGate");
  if (!gate) return;
  let taps = 0, timer = null;
  gate.addEventListener("click", () => {
    taps++;
    clearTimeout(timer);
    timer = setTimeout(() => { taps = 0; }, 3000);
    if (taps >= 5) {
      taps = 0;
      window.location.href = "admin-login.html";
    }
  });
});

/* ---------------- Popup engine ----------------
   Reads active popups from Firestore ("popups" collection).
   Each popup carries maxShows = how many times ONE visitor's
   browser should ever see it. Tracked in localStorage.
--------------------------------------------------- */
async function runPopupEngine() {
  const mount = document.getElementById("dyjPopupMount");
  if (!mount) return;
  try {
    const q = query(collection(db, "popups"), where("active", "==", true));
    const snap = await getDocs(q);
    const candidates = [];
    snap.forEach(d => candidates.push({ id: d.id, ...d.data() }));
    if (!candidates.length) return;

    for (const p of candidates) {
      const key = `dyj_popup_${p.id}_count`;
      const shown = parseInt(localStorage.getItem(key) || "0", 10);
      const cap = typeof p.maxShows === "number" ? p.maxShows : 3;
      if (shown < cap) {
        localStorage.setItem(key, String(shown + 1));
        setTimeout(() => showPopup(p, mount), 1200);
        break; // one popup per page load
      }
    }
  } catch (e) {
    console.warn("Popup engine skipped:", e.message);
  }
}

function showPopup(p, mount) {
  const overlay = document.createElement("div");
  overlay.className = "dyj-popup-overlay";
  overlay.innerHTML = `
    <div class="dyj-popup">
      <button class="dyj-popup-close" aria-label="Close">&times;</button>
      ${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.title || ''}">` : ""}
      <div class="dyj-popup-body">
        <h3>${p.title || "Special offer"}</h3>
        <p>${p.text || ""}</p>
        ${p.ctaText ? `<a class="btn btn-gold" href="${p.ctaLink || '#'}" target="${(p.ctaLink||'').startsWith('http')?'_blank':'_self'}">${p.ctaText}</a>` : ""}
      </div>
    </div>`;
  mount.appendChild(overlay);
  overlay.querySelector(".dyj-popup-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
}

document.addEventListener("DOMContentLoaded", runPopupEngine);

/* ---------------- Announcement bar (offers strip) ----------------
   Reuses the "popups" collection: any popup with active=true AND
   showAsBanner=true is shown as a slim top strip (not a modal), with
   no per-visitor cap — it just persists until dismissed for the
   session. Lets one admin action ("create a popup, tick the banner
   box") power both the modal offer AND the sitewide offers strip.
------------------------------------------------------------------ */
async function runBannerEngine() {
  const mount = document.getElementById("dyjAnnounceMount");
  if (!mount) return;
  if (sessionStorage.getItem("dyj_banner_dismissed") === "1") return;
  try {
    const q = query(collection(db, "popups"), where("active", "==", true), where("showAsBanner", "==", true));
    const snap = await getDocs(q);
    if (snap.empty) return;
    let p; snap.forEach(d => { if (!p) p = { id: d.id, ...d.data() }; });
    mount.innerHTML = `
      <div class="announce-bar">
        <span>${p.title || "Special offer"}${p.text ? ": " + p.text : ""}</span>
        ${p.ctaText ? `<a class="btn btn-ink" href="${p.ctaLink || '#'}">${p.ctaText}</a>` : ""}
        <button class="announce-bar-close" aria-label="Dismiss">&times;</button>
      </div>`;
    mount.querySelector(".announce-bar-close").addEventListener("click", () => {
      mount.innerHTML = "";
      sessionStorage.setItem("dyj_banner_dismissed", "1");
    });
  } catch (e) {
    console.warn("Banner engine skipped:", e.message);
  }
}
document.addEventListener("DOMContentLoaded", runBannerEngine);

/* ---------------- FAQ accordions ----------------
   Any .faq-item containing a .faq-q button + .faq-a panel toggles open.
--------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".faq-q").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".faq-item");
      const wasOpen = item.classList.contains("open");
      item.parentElement.querySelectorAll(".faq-item.open").forEach(i => i !== item && i.classList.remove("open"));
      item.classList.toggle("open", !wasOpen);
    });
  });
});
