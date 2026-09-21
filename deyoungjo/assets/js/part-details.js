import { loadPartDetails, loadParts, formatNaira } from "./parts.js";
import { waLink } from "./firebase-config.js";
import { wireCartButtons } from "./cart.js";

const params = new URLSearchParams(window.location.search);
const id = params.get("id");
const root = document.getElementById("partDetailsRoot");
const notFound = document.getElementById("partNotFound");

async function init() {
  if (!id) { showNotFound(); return; }
  let part;
  try {
    part = await loadPartDetails(id);
  } catch (e) {
    console.error(e);
    showNotFound();
    return;
  }
  if (!part) { showNotFound(); return; }
  render(part);
}

function showNotFound() {
  if (root) root.classList.add("hidden");
  if (notFound) notFound.classList.remove("hidden");
}

function render(part) {
  const name = part.name || "Spare part";
  document.title = `${name} | De Young Jo Motors`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", `${name} available at De Young Jo Motors. ${(part.description || "").slice(0, 120)}`);

  document.getElementById("crumbPart").textContent = name;
  document.getElementById("partTitle").textContent = name;
  document.getElementById("partCategoryTag").textContent = part.category || "Spare Part";
  document.getElementById("partPriceTag").textContent = formatNaira(part.price);

  const images = (part.images && part.images.length) ? part.images : ["https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=1200&auto=format&fit=crop"];
  setupGallery(images, name);

  const specs = [
    ["Category", part.category], ["Condition", part.condition],
    ["Compatible with", part.compatibility],
  ].filter(([, v]) => v);
  document.getElementById("partSpecsList").innerHTML = specs.map(([k, v]) =>
    `<div class="spec-row"><span>${k}</span><strong>${v}</strong></div>`).join("");

  document.getElementById("partDescription").textContent = part.description || "Full details available on request. Message us on WhatsApp for more information about this part.";

  const waMsg = `Hi, I'm interested in the ${name} listed on your website for ${formatNaira(part.price)}. Is it still available?`;
  const waBtn = document.getElementById("partWaBtn");
  waBtn.href = waLink(waMsg);
  waBtn.target = "_blank";

  const cartBtn = document.getElementById("partCartBtn");
  cartBtn.setAttribute("data-cart-add", part.id);
  cartBtn.setAttribute("data-cart-name", name);
  cartBtn.setAttribute("data-cart-price", formatNaira(part.price));
  cartBtn.setAttribute("data-cart-image", images[0]);
  wireCartButtons(document);

  if (part.status && part.status !== "available") {
    document.getElementById("partStatusBanner").textContent = `This part is currently marked as ${part.status}. Message us, we may have a replacement or similar part available.`;
    document.getElementById("partStatusBanner").classList.remove("hidden");
  }

  loadParts("relatedPartsGrid", { category: part.category, take: 3 });
}

function setupGallery(images, altBase) {
  const mainImg = document.getElementById("galleryMain");
  const wrap = document.getElementById("galleryWrap");
  const prevBtn = document.getElementById("galleryPrev");
  const nextBtn = document.getElementById("galleryNext");
  const dotsEl = document.getElementById("galleryDots");
  const countEl = document.getElementById("galleryCount");
  let index = 0;
  let timer = null;

  function render() {
    mainImg.src = images[index];
    mainImg.alt = `${altBase} photo ${index + 1} of ${images.length}`;
    if (dotsEl.children.length) {
      [...dotsEl.children].forEach((d, i) => d.classList.toggle("active", i === index));
    }
    if (countEl) countEl.textContent = images.length > 1 ? `${index + 1} / ${images.length}` : "";
  }
  function goTo(i) { index = (i + images.length) % images.length; render(); }
  function next() { goTo(index + 1); }
  function prev() { goTo(index - 1); }
  function restartAutoplay() {
    clearInterval(timer);
    if (images.length > 1) timer = setInterval(next, 4500);
  }

  if (images.length > 1) {
    dotsEl.innerHTML = images.map((_, i) => `<button type="button" aria-label="Go to photo ${i+1}"></button>`).join("");
    [...dotsEl.children].forEach((d, i) => d.addEventListener("click", () => { goTo(i); restartAutoplay(); }));
    nextBtn.addEventListener("click", () => { next(); restartAutoplay(); });
    prevBtn.addEventListener("click", () => { prev(); restartAutoplay(); });
    wrap.addEventListener("mouseenter", () => clearInterval(timer));
    wrap.addEventListener("mouseleave", restartAutoplay);
    restartAutoplay();
  } else {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
  }
  render();
}

init();
