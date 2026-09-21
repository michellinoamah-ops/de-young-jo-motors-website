// =====================================================================
// DE YOUNG JO MOTORS: car reviews & star ratings
// Firestore collection: "carReviews"
// Fields: carId, name, rating (1-5 integer), message,
//         status ("pending"|"approved"|"rejected"), createdAt
// Reviews are public to submit, but only "approved" ones ever display.
// the admin moderates everything from Admin → Reviews & Comments.
// =====================================================================
import { db } from "./firebase-config.js";
import {
  collection, query, where, getDocs, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

function fmtDate(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
  } catch { return ""; }
}

function starsHTML(rating) {
  const r = Math.round(Number(rating) || 0);
  return "&#9733;".repeat(r) + "&#9734;".repeat(5 - r);
}

/** Loads approved reviews for a car, renders the list + the average-rating summary. */
export async function loadCarReviews(carId, listId, summaryId) {
  const listEl = document.getElementById(listId);
  const summaryEl = document.getElementById(summaryId);
  if (!listEl) return;
  try {
    const q = query(collection(db, "carReviews"), where("carId", "==", carId), where("status", "==", "approved"));
    const snap = await getDocs(q);
    let reviews = [];
    snap.forEach(d => reviews.push({ id: d.id, ...d.data() }));
    reviews.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

    if (summaryEl) {
      if (reviews.length) {
        const avg = reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviews.length;
        summaryEl.innerHTML = `
          <div class="avg">${avg.toFixed(1)}</div>
          <div>
            <div class="stars-display">${starsHTML(avg)}</div>
            <div class="count">${reviews.length} review${reviews.length === 1 ? "" : "s"}</div>
          </div>`;
      } else {
        summaryEl.innerHTML = `<p class="muted">No reviews yet for this vehicle. Be the first to leave one.</p>`;
      }
    }

    listEl.innerHTML = reviews.length
      ? reviews.map(r => `
        <div class="review-item">
          <div class="stars-display">${starsHTML(r.rating)}</div>
          <span class="who">${r.name || "Anonymous"}</span><span class="when">${fmtDate(r.createdAt)}</span>
          <p style="margin:8px 0 0;">${r.message || ""}</p>
        </div>`).join("")
      : "";
  } catch (e) {
    console.error(e);
    if (summaryEl) summaryEl.innerHTML = `<p class="muted">Couldn't load reviews right now.</p>`;
  }
}

/** Wires up the star-picker + submit handler for the review form. */
export function wireReviewForm(carId, formId, statusId) {
  const form = document.getElementById(formId);
  if (!form) return;
  const status = document.getElementById(statusId);
  const stars = form.querySelectorAll("[data-star]");
  const ratingInput = form.querySelector('input[name="rating"]');

  function setRating(n) {
    ratingInput.value = n;
    stars.forEach(s => s.classList.toggle("active", Number(s.dataset.star) <= n));
  }
  stars.forEach(s => s.addEventListener("click", () => setRating(Number(s.dataset.star))));
  setRating(5); // default to 5 stars; the picker makes it obvious how to change it

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Sending…";
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await addDoc(collection(db, "carReviews"), {
        carId,
        name: data.name || "Anonymous",
        rating: Number(data.rating) || 5,
        message: data.message || "",
        status: "pending",
        createdAt: serverTimestamp(),
      });
      status.textContent = "Your review or message has been sent for approval.";
      status.className = "form-status show ok";
      form.reset();
      setRating(5);
    } catch (err) {
      console.error(err);
      status.textContent = "Something went wrong sending your review. Please try again.";
      status.className = "form-status show err";
    } finally {
      btn.disabled = false; btn.textContent = "Submit review";
    }
  });
}
