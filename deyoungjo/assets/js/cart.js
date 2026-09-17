// =====================================================================
// DE YOUNG JO MOTORS: enquiry cart ("add to cart" shortlist)
// Cars aren't sold online, so this isn't a checkout — it's a shortlist:
// tap the cart icon on any car to save it, then send every saved car in
// one WhatsApp message instead of messaging about each one separately.
// Stored per-browser in localStorage; nothing here touches Firestore.
// =====================================================================
import { waLink, WHATSAPP_NUMBER } from "./firebase-config.js";

const CART_KEY = "dyj_enquiry_cart";

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
  catch { return []; }
}
function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  updateBadge();
}
function isInCart(id) {
  return getCart().some(c => c.id === id);
}
function addToCart(item) {
  const items = getCart();
  if (items.some(c => c.id === item.id)) return;
  items.push(item);
  saveCart(items);
}
function removeFromCart(id) {
  saveCart(getCart().filter(c => c.id !== id));
}

/* ---------------- Floating badge ---------------- */
function ensureBadge() {
  if (document.getElementById("cartFloatBtn")) return;
  const btn = document.createElement("button");
  btn.id = "cartFloatBtn";
  btn.className = "cart-float";
  btn.setAttribute("aria-label", "View your shortlisted cars");
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
    </svg>
    <span class="badge-count hidden" id="cartBadgeCount">0</span>`;
  document.body.appendChild(btn);
  btn.addEventListener("click", openDrawer);
  updateBadge();
}

function updateBadge() {
  const el = document.getElementById("cartBadgeCount");
  if (!el) return;
  const n = getCart().length;
  el.textContent = n;
  el.classList.toggle("hidden", n === 0);
}

/* ---------------- Drawer ---------------- */
function openDrawer() {
  const items = getCart();
  const overlay = document.createElement("div");
  overlay.className = "cart-drawer-overlay";
  overlay.innerHTML = `
    <div class="cart-drawer">
      <h3>Your shortlist <button class="cart-drawer-close" aria-label="Close">&times;</button></h3>
      <p class="muted" style="margin-top:-8px;">Cars you've tapped the cart icon on. Send them all in one message when you're ready.</p>
      <div id="cartLines">
        ${items.length ? items.map(c => `
          <div class="cart-line" data-line="${c.id}">
            <img src="${c.image || ''}" alt="${c.name}">
            <div class="info"><h4>${c.name}</h4><span>${c.price}</span></div>
            <button class="remove" data-remove="${c.id}" aria-label="Remove">&times;</button>
          </div>`).join("") : `<div class="cart-empty">Nothing shortlisted yet. Tap the cart icon on any car.</div>`}
      </div>
      ${items.length ? `<a href="#" id="cartWaSend" class="btn btn-wa btn-block" style="margin-top:18px;">Enquire about these on WhatsApp</a>
      <button class="btn btn-outline btn-block" id="cartClearAll" style="margin-top:10px;">Clear shortlist</button>` : ""}
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector(".cart-drawer-close").addEventListener("click", () => overlay.remove());

  overlay.querySelectorAll("[data-remove]").forEach(btn => btn.addEventListener("click", () => {
    removeFromCart(btn.dataset.remove);
    document.querySelectorAll(`[data-cart-add="${btn.dataset.remove}"]`).forEach(b => b.classList.remove("added"));
    overlay.remove();
    openDrawer();
  }));

  const clearBtn = overlay.querySelector("#cartClearAll");
  if (clearBtn) clearBtn.addEventListener("click", () => {
    saveCart([]);
    document.querySelectorAll("[data-cart-add].added").forEach(b => b.classList.remove("added"));
    overlay.remove();
    openDrawer();
  });

  const waBtn = overlay.querySelector("#cartWaSend");
  if (waBtn) {
    const lines = items.map(c => `• ${c.name} (${c.price})`).join("\n");
    const msg = `Hi De Young Jo Motors, I'm interested in these vehicles:\n${lines}\n\nCan you confirm availability?`;
    waBtn.href = waLink(msg);
    waBtn.target = "_blank"; waBtn.rel = "noopener";
  }
}

/* ---------------- Wiring "add to cart" buttons on rendered cards ---------------- */
export function wireCartButtons(root = document) {
  root.querySelectorAll("[data-cart-add]").forEach(btn => {
    const id = btn.dataset.cartAdd;
    const already = isInCart(id);
    btn.classList.toggle("added", already);
    if (btn.dataset.labelAdd) btn.textContent = already ? (btn.dataset.labelAdded || "Added to shortlist") : btn.dataset.labelAdd;
    btn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      if (isInCart(id)) {
        removeFromCart(id);
        btn.classList.remove("added");
        if (btn.dataset.labelAdd) btn.textContent = btn.dataset.labelAdd;
      } else {
        addToCart({
          id,
          name: btn.dataset.cartName || "Vehicle",
          price: btn.dataset.cartPrice || "",
          image: btn.dataset.cartImage || "",
        });
        btn.classList.add("added");
        if (btn.dataset.labelAdd) btn.textContent = btn.dataset.labelAdded || "Added to shortlist";
      }
    });
  });
}

export function initCartUI() {
  ensureBadge();
}

document.addEventListener("DOMContentLoaded", initCartUI);
