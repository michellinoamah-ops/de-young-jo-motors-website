import { loadCarDetails, loadCars, formatNaira } from "./cars.js";
import { waLink } from "./firebase-config.js";
import { wireCartButtons } from "./cart.js";

const params = new URLSearchParams(window.location.search);
const id = params.get("id");
const root = document.getElementById("carDetailsRoot");
const notFound = document.getElementById("carNotFound");

async function init() {
  if (!id) { showNotFound(); return; }
  let car;
  try {
    car = await loadCarDetails(id);
  } catch (e) {
    console.error(e);
    showNotFound();
    return;
  }
  if (!car) { showNotFound(); return; }
  render(car);
}

function showNotFound() {
  if (root) root.classList.add("hidden");
  if (notFound) notFound.classList.remove("hidden");
}

function render(car) {
  const isRental = car.type === "rental";
  const name = `${car.year || ""} ${car.brand || ""} ${car.model || car.title || ""}`.trim();
  document.title = `${name} | De Young Jo Motors`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", `${name}, ${isRental ? "available for rent" : "for sale"} at De Young Jo Motors. ${(car.description || "").slice(0, 120)}`);

  document.getElementById("crumbCar").textContent = name;
  document.getElementById("carTitle").textContent = name;
  document.getElementById("carTypeTag").textContent = isRental ? "For Rent" : "For Sale";
  document.getElementById("carPriceTag").innerHTML = isRental
    ? `${formatNaira(car.rentalPricePerDay)} <span style="font-size:.55em;font-weight:500;">/ day</span>`
    : formatNaira(car.price);

  const images = (car.images && car.images.length) ? car.images : ["https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1200&auto=format&fit=crop"];
  const mainImg = document.getElementById("galleryMain");
  mainImg.src = images[0];
  mainImg.alt = name;
  document.getElementById("galleryThumbs").innerHTML = images.map((src, i) =>
    `<img src="${src}" alt="${name} photo ${i+1}" class="gallery-thumb" data-src="${src}" style="width:76px;height:56px;object-fit:cover;cursor:pointer;border:2px solid ${i===0?'var(--gold)':'transparent'};">`
  ).join("");
  document.getElementById("galleryThumbs").addEventListener("click", (e) => {
    const t = e.target.closest(".gallery-thumb");
    if (!t) return;
    mainImg.src = t.getAttribute("data-src");
    document.querySelectorAll(".gallery-thumb").forEach(el => el.style.borderColor = "transparent");
    t.style.borderColor = "var(--gold)";
  });

  const specs = [
    ["Brand", car.brand], ["Model", car.model], ["Year", car.year],
    ["Transmission", car.transmission], ["Fuel type", car.fuelType],
    ["Mileage", car.mileage ? `${Number(car.mileage).toLocaleString()} km` : null],
    ["Condition", car.condition], ["Colour", car.color], ["Location", car.location],
    ["Body type", car.category],
  ].filter(([,v]) => v);
  document.getElementById("carSpecsList").innerHTML = specs.map(([k,v]) =>
    `<div class="spec-row"><span>${k}</span><strong>${v}</strong></div>`).join("");

  document.getElementById("carDescription").textContent = car.description || "Full details available on request. Message us on WhatsApp for the complete history and inspection report.";

  const features = car.features || [];
  document.getElementById("carFeatures").innerHTML = features.length
    ? features.map(f => `<li>&#10003; ${f}</li>`).join("")
    : `<li class="muted">Feature list available on request.</li>`;

  const waMsg = isRental
    ? `Hi, I'd like to rent the ${name}. Please let me know availability, price per day, and requirements.`
    : `Hi, I'm interested in the ${name} listed on your website for ${formatNaira(car.price)}. Is it still available?`;
  const waBtn = document.getElementById("carWaBtn");
  waBtn.href = waLink(waMsg);
  waBtn.target = "_blank";

  const cartBtn = document.getElementById("carCartBtn");
  cartBtn.setAttribute("data-cart-add", car.id);
  cartBtn.setAttribute("data-cart-name", name);
  cartBtn.setAttribute("data-cart-price", isRental ? `${formatNaira(car.rentalPricePerDay)}/day` : formatNaira(car.price));
  cartBtn.setAttribute("data-cart-image", images[0]);
  wireCartButtons(document);

  if (car.status && car.status !== "available") {
    document.getElementById("carStatusBanner").textContent = `This vehicle is currently marked as ${car.status}. Message us and we will help you find similar options.`;
    document.getElementById("carStatusBanner").classList.remove("hidden");
  }

  // Related vehicles of the same type
  loadCars("relatedCarsGrid", { type: car.type, take: 3 });
}

init();
