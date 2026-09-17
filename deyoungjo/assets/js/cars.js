// =====================================================================
// DE YOUNG JO MOTORS: car listing & details rendering
// Firestore collection: "cars"
// Fields: title, brand, model, year, price, rentalPricePerDay, type
//         ("sale"|"rental"), category, transmission, fuelType, mileage,
//         condition, color, location, description, features[],
//         images[], status, featured, createdAt
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

const PLACEHOLDER = "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=800&auto=format&fit=crop";

export function carCardHTML(car) {
  const img = (car.images && car.images[0]) || PLACEHOLDER;
  const isRental = car.type === "rental";
  const name = `${car.year || ""} ${car.brand || ""} ${car.model || car.title || ""}`.trim();
  const price = isRental
    ? `${formatNaira(car.rentalPricePerDay)}<span style="font-size:.7em;color:var(--steel)">/day</span>`
    : formatNaira(car.price);
  const priceText = isRental ? `${formatNaira(car.rentalPricePerDay)}/day` : formatNaira(car.price);
  const waMsg = isRental
    ? `Hi, I'd like to rent the ${car.year || ""} ${car.brand || ""} ${car.model || car.title}. Please tell me availability, rate per day, and requirements.`
    : `Hi, I'm interested in the ${car.year || ""} ${car.brand || ""} ${car.model || car.title} listed on your website for ${formatNaira(car.price)}. Is it still available?`;
  const soldOut = car.status && car.status !== "available";
  return `
    <article class="car-card">
      <div class="car-card-media">
        <span class="car-tag">${isRental ? "For Rent" : "For Sale"}</span>
        <button class="cart-toggle" data-cart-add="${car.id}" data-cart-name="${name.replace(/"/g,'&quot;')}" data-cart-price="${priceText.replace(/"/g,'&quot;')}" data-cart-image="${img}" aria-label="Add to shortlist" title="Add to shortlist">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
        </button>
        <img src="${img}" alt="${car.title || (car.brand+' '+car.model)}" loading="lazy">
        <span class="car-price-tag">${price}</span>
      </div>
      <div class="car-card-body">
        <h3>${car.year ? car.year + " " : ""}${car.brand || ""} ${car.model || car.title || ""}</h3>
        <div class="car-specs">
          ${car.transmission ? `<span class="spec-chip">${car.transmission}</span>` : ""}
          ${car.fuelType ? `<span class="spec-chip">${car.fuelType}</span>` : ""}
          ${car.mileage ? `<span class="spec-chip">${Number(car.mileage).toLocaleString()} km</span>` : ""}
          ${car.condition ? `<span class="spec-chip">${car.condition}</span>` : ""}
        </div>
        <div class="car-card-foot">
          <a class="btn btn-ink btn-sm" href="car-details.html?id=${car.id}">View details</a>
          <a class="btn btn-wa btn-sm" data-wa-message="${waMsg.replace(/"/g,'&quot;')}" href="#">WhatsApp</a>
        </div>
        ${soldOut ? `<div style="font-size:.78rem;color:var(--danger);font-weight:700;">${car.status.toUpperCase()}</div>` : ""}
      </div>
    </article>`;
}

export function skeletonCards(n = 6) {
  return Array.from({ length: n }).map(() => `
    <article class="car-card">
      <div class="car-card-media skel"></div>
      <div class="car-card-body">
        <div class="skel" style="height:18px;width:70%;margin-bottom:10px;"></div>
        <div class="skel" style="height:14px;width:50%;"></div>
      </div>
    </article>`).join("");
}

/** Load a list of cars into a container, optionally filtered. */
export async function loadCars(containerId, opts = {}) {
  const { type, category, transmission, fuelType, condition, usedOnly, maxPrice, featuredOnly, take } = opts;
  const el = document.getElementById(containerId);
  if (!el) return [];
  el.innerHTML = skeletonCards(take || 6);
  try {
    const clauses = [where("status", "!=", "hidden")];
    if (type) clauses.push(where("type", "==", type));
    if (category) clauses.push(where("category", "==", category));
    if (transmission) clauses.push(where("transmission", "==", transmission));
    if (fuelType) clauses.push(where("fuelType", "==", fuelType));
    if (condition) clauses.push(where("condition", "==", condition));
    if (featuredOnly) clauses.push(where("featured", "==", true));
    let q = query(collection(db, "cars"), ...clauses, orderBy("createdAt", "desc"));
    if (take) q = query(q, fbLimit(take));

    // If the "featured" query needs relaxing (see the two spots below), every
    // other filter the caller asked for (condition, category, etc.) must be
    // kept, or a "new cars" row can silently start showing used cars once it
    // falls back. Only the featured constraint itself is dropped.
    const fallbackToLatest = () => loadCars(containerId, { ...opts, featuredOnly: false });

    let snap;
    try {
      snap = await getDocs(q);
    } catch (queryError) {
      // A missing Firestore composite index throws here, not below. The
      // homepage's "featured" rows are the most common case: rather than
      // show a broken/blank section, fall back to the plain latest-cars
      // query for that type (which almost always already has its index
      // in place), and log the real error so it's still fixable.
      if (featuredOnly) {
        console.warn(`"featured" query failed (likely a missing Firestore index), falling back to latest cars:`, queryError);
        return fallbackToLatest();
      }
      throw queryError;
    }

    let cars = [];
    snap.forEach(d => cars.push({ id: d.id, ...d.data() }));
    if (maxPrice) cars = cars.filter(c => (c.type === "rental" ? c.rentalPricePerDay : c.price) <= Number(maxPrice));
    // "Used Cars" page: anything not explicitly marked "New" counts as used.
    // Done client-side so it needs no extra composite index.
    if (usedOnly) cars = cars.filter(c => (c.condition || "") !== "New");

    // Fresh sites have no "featured" cars yet, or the query above returned
    // none. Fall back to latest cars matching every other filter (type,
    // condition, etc.) rather than showing an empty homepage section.
    if (featuredOnly && !cars.length) {
      return fallbackToLatest();
    }

    if (!cars.length) {
      el.innerHTML = `<div class="tac" style="grid-column:1/-1;padding:40px 0;">
        <p>No vehicles match right now. New stock is added weekly, so message us on WhatsApp and we'll help you find the right one.</p>
        <a class="btn btn-wa" data-wa-message="Hi, I'm looking for a specific car and didn't see it listed on your site yet. Can you help?" href="#">Ask us on WhatsApp</a>
      </div>`;
      wireWhatsAppInline(el);
      return [];
    }
    el.innerHTML = cars.map(carCardHTML).join("");
    wireWhatsAppInline(el);
    wireCartButtons(el);
    return cars;
  } catch (e) {
    console.error(e);
    el.innerHTML = `<p class="tac" style="grid-column:1/-1;">Couldn't load vehicles right now. Please refresh, or reach us directly on WhatsApp.</p>`;
    return [];
  }
}

function wireWhatsAppInline(root) {
  root.querySelectorAll("[data-wa-message]").forEach(a => {
    if (!a.href || a.href.endsWith("#")) {
      a.href = waLink(a.getAttribute("data-wa-message"));
      a.target = "_blank"; a.rel = "noopener";
    }
  });
}

/** Load a single car by id for the details page. */
export async function loadCarDetails(id) {
  const ref = doc(db, "cars", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}