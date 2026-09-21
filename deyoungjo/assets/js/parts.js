// =====================================================================
// DE YOUNG JO MOTORS: spare parts listing & details
// Firestore collection: "spareParts"
// Fields: name, category, compatibility, condition, price, description,
//         images[], status ("available"|"out of stock"|"hidden"),
//         featured, createdAt
// =====================================================================
import { db, waLink } from "./firebase-config.js";
import {
  collection, query, where, orderBy, limit as fbLimit, getDocs, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { wireCartButtons } from "./cart.js";

export function formatNaira(n) {
  if (n === undefined || n === null || n === "") return "Price on request";
  return "₦" + Number(n).toLocaleString("en-NG");
}

const PLACEHOLDER = "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=800&auto=format&fit=crop";

export function partCardHTML(part) {
  const img = (part.images && part.images[0]) || PLACEHOLDER;
  const price = formatNaira(part.price);
  const waMsg = `Hi, I'm interested in the ${part.name} listed on your website for ${price}. Is it still available?`;
  const outOfStock = part.status && part.status !== "available";
  return `
    <article class="car-card">
      <div class="car-card-media">
        <span class="car-tag">${part.category || "Spare Part"}</span>
        <button class="cart-toggle" data-cart-add="${part.id}" data-cart-name="${(part.name||'').replace(/"/g,'&quot;')}" data-cart-price="${price.replace(/"/g,'&quot;')}" data-cart-image="${img}" aria-label="Add to shortlist" title="Add to shortlist">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
        </button>
        <img src="${img}" alt="${part.name || 'Spare part'}" loading="lazy">
        <span class="car-price-tag">${price}</span>
      </div>
      <div class="car-card-body">
        <h3>${part.name || "Spare part"}</h3>
        <div class="car-specs">
          ${part.condition ? `<span class="spec-chip">${part.condition}</span>` : ""}
          ${part.compatibility ? `<span class="spec-chip">${part.compatibility}</span>` : ""}
        </div>
        <div class="car-card-foot">
          <a class="btn btn-ink btn-sm" href="spare-part-details.html?id=${part.id}">View details</a>
          <a class="btn btn-wa btn-sm" data-wa-message="${waMsg.replace(/"/g,'&quot;')}" href="#">WhatsApp</a>
        </div>
        ${outOfStock ? `<div style="font-size:.78rem;color:var(--danger);font-weight:700;">${part.status.toUpperCase()}</div>` : ""}
      </div>
    </article>`;
}

function skeletonCards(n = 6) {
  return Array.from({ length: n }).map(() => `
    <article class="car-card">
      <div class="car-card-media skel"></div>
      <div class="car-card-body">
        <div class="skel" style="height:18px;width:70%;margin-bottom:10px;"></div>
        <div class="skel" style="height:14px;width:50%;"></div>
      </div>
    </article>`).join("");
}

function wireWhatsAppInline(root) {
  root.querySelectorAll("[data-wa-message]").forEach(a => {
    if (!a.href || a.href.endsWith("#")) {
      a.href = waLink(a.getAttribute("data-wa-message"));
      a.target = "_blank"; a.rel = "noopener";
    }
  });
}

/** Loads a list of spare parts into a container, optionally filtered. */
export async function loadParts(containerId, { category, condition, compatibility, maxPrice, featuredOnly, take } = {}) {
  const el = document.getElementById(containerId);
  if (!el) return [];
  el.innerHTML = skeletonCards(take || 6);
  try {
    const clauses = [where("status", "!=", "hidden")];
    if (category) clauses.push(where("category", "==", category));
    if (condition) clauses.push(where("condition", "==", condition));
    if (featuredOnly) clauses.push(where("featured", "==", true));
    let q = query(collection(db, "spareParts"), ...clauses, orderBy("createdAt", "desc"));
    if (take) q = query(q, fbLimit(take));

    const fallbackToLatest = () => loadParts(containerId, { category, condition, compatibility, maxPrice, take });

    let snap;
    try {
      snap = await getDocs(q);
    } catch (queryError) {
      if (featuredOnly) {
        console.warn('"featured" spare-parts query failed (likely a missing Firestore index), falling back to latest parts:', queryError);
        return fallbackToLatest();
      }
      throw queryError;
    }

    let parts = [];
    snap.forEach(d => parts.push({ id: d.id, ...d.data() }));
    if (maxPrice) parts = parts.filter(p => (p.price || 0) <= Number(maxPrice));
    if (compatibility) {
      const needle = compatibility.trim().toLowerCase();
      parts = parts.filter(p => (p.compatibility || "").toLowerCase().includes(needle) || (p.compatibility || "").toLowerCase().includes("universal"));
    }

    if (featuredOnly && !parts.length) return fallbackToLatest();

    if (!parts.length) {
      el.innerHTML = `<div class="tac" style="grid-column:1/-1;padding:40px 0;">
        <p>No parts match right now. New stock is added weekly, so message us on WhatsApp and we'll help you find what you need.</p>
        <a class="btn btn-wa" data-wa-message="Hi, I'm looking for a specific spare part and didn't see it listed on your site. Can you help?" href="#">Ask us on WhatsApp</a>
      </div>`;
      wireWhatsAppInline(el);
      return [];
    }
    el.innerHTML = parts.map(partCardHTML).join("");
    wireWhatsAppInline(el);
    wireCartButtons(el);
    return parts;
  } catch (e) {
    console.error(e);
    el.innerHTML = `<p class="tac" style="grid-column:1/-1;">Couldn't load parts right now. Please refresh, or reach us directly on WhatsApp.</p>`;
    return [];
  }
}

export async function loadPartDetails(id) {
  const ref = doc(db, "spareParts", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
