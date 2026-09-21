// =====================================================================
// DE YOUNG JO MOTORS: admin dashboard
// One file, one job each: guard the page, wire the sidebar, then a
// clearly separated block per section (Cars, Blog, Enquiries,
// Affiliates, Popups, Settings). All data lives in Firestore; images
// go to Firebase Storage.
// =====================================================================
import { app, db, storage, auth } from "./firebase-config.js";
import { requireAdmin, adminLogout } from "./admin-auth.js";
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, orderBy, limit, serverTimestamp, onSnapshot, Timestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

/* ------------------------------------------------------------ helpers */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Cheap in-memory lookups so the Reviews & Comments panel can show "2019
// Toyota Camry" or a post's title instead of a raw Firestore ID. Filled in
// by initCars()/initBlog()'s own listeners, which are already running.
const carsMap = {};
const postsMap = {};

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  $("#toastMount").appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/* =====================================================================
   CROP TOOL
   A shared crop step for every image upload in the dashboard (car
   photos, spare part photos, popup images, blog cover images, and
   images inserted inside a blog post). Built on Cropper.js. Cropping is
   optional per image, "Skip cropping" uses the original file untouched.
===================================================================== */
function cropImageFile(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const overlay = document.createElement("div");
    overlay.className = "crop-modal-overlay";
    overlay.innerHTML = `
      <div class="crop-modal">
        <h3>Crop photo</h3>
        <div class="crop-modal-image-wrap"><img id="cropTargetImg" src="${url}"></div>
        <div class="crop-modal-ratios">
          <button type="button" data-ratio="free" class="active">Free</button>
          <button type="button" data-ratio="1">Square 1:1</button>
          <button type="button" data-ratio="1.3333">Standard 4:3</button>
          <button type="button" data-ratio="1.7778">Wide 16:9</button>
        </div>
        <div class="crop-modal-actions">
          <button type="button" class="btn btn-outline" id="cropSkipBtn">Skip cropping</button>
          <button type="button" class="btn btn-gold" id="cropConfirmBtn">Crop &amp; use</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const imgEl = overlay.querySelector("#cropTargetImg");
    const cropper = new Cropper(imgEl, { viewMode: 1, autoCropArea: 1, aspectRatio: NaN, background: false });

    overlay.querySelectorAll("[data-ratio]").forEach(btn => btn.addEventListener("click", () => {
      overlay.querySelectorAll("[data-ratio]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      cropper.setAspectRatio(btn.dataset.ratio === "free" ? NaN : Number(btn.dataset.ratio));
    }));

    function cleanup() {
      cropper.destroy();
      overlay.remove();
      URL.revokeObjectURL(url);
    }

    overlay.querySelector("#cropSkipBtn").addEventListener("click", () => {
      cleanup();
      resolve(file);
    });
    overlay.querySelector("#cropConfirmBtn").addEventListener("click", () => {
      cropper.getCroppedCanvas({ maxWidth: 2200, maxHeight: 2200 }).toBlob((blob) => {
        cleanup();
        resolve(blob ? new File([blob], file.name, { type: blob.type || file.type }) : file);
      }, file.type && file.type !== "image/gif" ? file.type : "image/jpeg", 0.9);
    });
  });
}

async function cropImageFiles(fileList) {
  const out = [];
  for (const file of Array.from(fileList)) out.push(await cropImageFile(file));
  return out;
}

/** Wires a file input so every image picked through it is offered for
 *  cropping immediately, before anything else happens with it. Uses the
 *  DataTransfer trick to replace the input's own FileList, so whatever
 *  code reads `input.files` later (on form submit) sees the cropped
 *  version and needs no other changes. */
function wireCropOnSelect(inputEl) {
  if (!inputEl || inputEl.dataset.cropWired) return;
  inputEl.dataset.cropWired = "1";
  inputEl.addEventListener("change", async () => {
    if (!inputEl.files || !inputEl.files.length) return;
    const cropped = await cropImageFiles(inputEl.files);
    const dt = new DataTransfer();
    cropped.forEach(f => dt.items.add(f));
    inputEl.files = dt.files;
  });
}

function fmtDate(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
  } catch { return ""; }
}

// For pre-filling <input type="date"> with an existing Firestore Timestamp,
// or today's date when there isn't one yet.
function toDateInputValue(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : new Date());
    return d.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// Turns the value of an <input type="date"> ("YYYY-MM-DD") into a Firestore
// Timestamp at local midnight, so backdated posts sort correctly.
function dateInputToTimestamp(value) {
  const d = value ? new Date(value + "T00:00:00") : new Date();
  return Timestamp.fromDate(d);
}

function slugify(s) {
  return (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function uploadFiles(files, pathPrefix) {
  const urls = [];
  for (const file of files) {
    const r = ref(storage, `${pathPrefix}/${Date.now()}-${file.name}`);
    await uploadBytes(r, file);
    urls.push(await getDownloadURL(r));
  }
  return urls;
}

function openModal(html, wide = false) {
  const overlay = document.createElement("div");
  overlay.className = "admin-modal-overlay";
  overlay.innerHTML = `<div class="admin-modal${wide ? " admin-modal-wide" : ""}">${html}</div>`;
  $("#modalMount").appendChild(overlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  return overlay;
}
function closeModal(overlay) { overlay.remove(); }

/* ------------------------------------------------------------ auth guard + shell */
requireAdmin((user) => {
  $("#whoAmI").textContent = user.email;
  initSidebar();
  initOverview();
  initCars();
  initParts();
  initBlog();
  initEnquiries();
  initReviewsComments();
  initAffiliates();
  initPopups();
  initSettings();
  initNotifications();
});

$("#logoutBtn").addEventListener("click", adminLogout);

function initSidebar() {
  const buttons = $$("#adminNav button");
  const sections = $$(".admin-section");
  const titleMap = {
    overview: "Overview", cars: "Cars & Rentals", parts: "Spare Parts", blog: "Blog",
    enquiries: "Enquiries", reviews: "Reviews & Comments", affiliates: "Affiliate Applications",
    popups: "Popups & Offers", settings: "Settings"
  };
  function show(name) {
    buttons.forEach(b => b.classList.toggle("active", b.dataset.section === name));
    sections.forEach(s => s.classList.toggle("hidden", s.id !== `sec-${name}`));
    $("#sectionTitle").textContent = titleMap[name] || name;
    $("#adminSidebar").classList.remove("open");
  }
  buttons.forEach(b => b.addEventListener("click", () => show(b.dataset.section)));
  $("#adminBurger").addEventListener("click", () => $("#adminSidebar").classList.toggle("open"));

  // Quick-action buttons on Overview can jump + open a modal
  $$("[data-jump]").forEach(btn => {
    btn.addEventListener("click", () => {
      show(btn.dataset.jump);
      const openId = btn.dataset.open;
      if (openId === "addCar") $("#btnAddCar").click();
      if (openId === "addPart") $("#btnAddPart").click();
      if (openId === "addPost") $("#btnAddPost").click();
      if (openId === "addPopup") $("#btnAddPopup").click();
    });
  });
}

/* =====================================================================
   OVERVIEW
===================================================================== */
function initOverview() {
  getDocs(collection(db, "cars")).then(snap => {
    let sale = 0, rental = 0;
    snap.forEach(d => d.data().type === "rental" ? rental++ : sale++);
    $("#statCars").textContent = sale;
    $("#statRentals").textContent = rental;
  });
  getDocs(collection(db, "spareParts")).then(snap => $("#statParts").textContent = snap.size);
  onSnapshot(query(collection(db, "enquiries"), orderBy("createdAt", "desc")), snap => {
    let unread = 0; const rows = [];
    snap.forEach(d => { const e = d.data(); if (e.status === "new") unread++; rows.push({ id: d.id, ...e }); });
    $("#statEnquiries").textContent = unread;
    const top = rows.slice(0, 5);
    $("#overviewEnquiries").innerHTML = top.length ? top.map(e => `
      <div class="enquiry-item ${e.status === 'new' ? 'unread' : ''}">
        <h4>${e.name || "Unknown"}: ${e.subject || "General enquiry"}</h4>
        <p class="muted" style="margin:0;">${(e.message||"").slice(0,90)}${(e.message||"").length>90?"…":""}</p>
      </div>`).join("") : `<p class="empty-state">No enquiries yet.</p>`;
  });
  getDocs(collection(db, "affiliateApplications")).then(snap => $("#statAffiliates").textContent = snap.size);
}

/* =====================================================================
   CARS
===================================================================== */
function carFormHTML(car = {}) {
  const isEdit = !!car.id;
  const features = (car.features || []).join(", ");
  return `
    <button class="admin-modal-close">&times;</button>
    <h3>${isEdit ? "Edit vehicle" : "Add vehicle"}</h3>
    <form id="carForm">
      <div class="form-row">
        <div class="form-field"><label>Listing type</label>
          <select name="type">
            <option value="sale" ${car.type!=="rental"?"selected":""}>For sale</option>
            <option value="rental" ${car.type==="rental"?"selected":""}>For rental</option>
          </select>
        </div>
        <div class="form-field"><label>Body type</label>
          <select name="category">
            ${["Sedan","SUV","Truck","Van","Coupe","Luxury"].map(c=>`<option ${car.category===c?"selected":""}>${c}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-field"><label>Brand</label><input name="brand" value="${car.brand||''}" required></div>
        <div class="form-field"><label>Model</label><input name="model" value="${car.model||''}" required></div>
      </div>
      <div class="form-row">
        <div class="form-field"><label>Year</label><input name="year" type="number" value="${car.year||''}" required></div>
        <div class="form-field"><label>Colour</label><input name="color" value="${car.color||''}"></div>
      </div>
      <div class="form-row">
        <div class="form-field"><label>Price (₦, for sale)</label><input name="price" type="number" value="${car.price||''}"></div>
        <div class="form-field"><label>Rental rate / day (₦)</label><input name="rentalPricePerDay" type="number" value="${car.rentalPricePerDay||''}"></div>
      </div>
      <div class="form-row">
        <div class="form-field"><label>Transmission</label>
          <select name="transmission"><option ${car.transmission==="Automatic"?"selected":""}>Automatic</option><option ${car.transmission==="Manual"?"selected":""}>Manual</option></select>
        </div>
        <div class="form-field"><label>Fuel type</label>
          <select name="fuelType">${["Petrol","Diesel","Hybrid","Electric"].map(f=>`<option ${car.fuelType===f?"selected":""}>${f}</option>`).join("")}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-field"><label>Mileage (km)</label><input name="mileage" type="number" value="${car.mileage||''}"></div>
        <div class="form-field"><label>Condition</label>
          <select name="condition">${["New","Foreign Used","Nigerian Used"].map(c=>`<option ${car.condition===c?"selected":""}>${c}</option>`).join("")}</select>
        </div>
      </div>
      <div class="form-field"><label>Location</label><input name="location" value="${car.location||''}" placeholder="e.g. Lagos"></div>
      <div class="form-field"><label>Description</label><textarea name="description">${car.description||''}</textarea></div>
      <div class="form-field"><label>Features (comma separated)</label><input name="features" value="${features}" placeholder="Air conditioning, Reverse camera, Alloy wheels"></div>
      <div class="form-field">
        <label>Photos</label>
        <div class="image-input-list" id="carImagePreview"></div>
        <input type="file" name="images" multiple accept="image/*">
        <p class="form-note">The first photo (marked "Cover") is the one shown on listing pages. Click the star on any photo to make it the cover, or the &times; to remove it. New uploads are added to the end, then you can promote one to cover.</p>
      </div>
      <div class="form-row">
        <div class="form-field"><label>Status</label>
          <select name="status">${["available","sold","rented","unavailable"].map(s=>`<option ${car.status===s?"selected":""}>${s}</option>`).join("")}</select>
        </div>
        <div class="form-field" style="display:flex;align-items:center;gap:10px;margin-top:26px;">
          <label class="switch"><input type="checkbox" name="featured" ${car.featured?"checked":""}><span class="slider"></span></label>
          <label style="margin:0;">Feature on homepage</label>
        </div>
      </div>
      <button type="submit" class="btn btn-gold btn-block">${isEdit ? "Save changes" : "Add vehicle"}</button>
      <div id="carFormStatus" class="form-status"></div>
    </form>`;
}

let allCarsRows = [];
function renderCarsTable() {
  const q = ($("#carsSearchInput")?.value || "").trim().toLowerCase();
  const rows = q
    ? allCarsRows.filter(c => `${c.year||''} ${c.brand||''} ${c.model||''}`.toLowerCase().includes(q))
    : allCarsRows;
  $("#carsTableBody").innerHTML = rows.length ? rows.map(c => `
      <tr>
        <td><img class="thumb" src="${(c.images&&c.images[0])||''}" onerror="this.style.opacity=0"></td>
        <td>${c.year||''} ${c.brand||''} ${c.model||''}</td>
        <td><span class="pill ${c.type==='rental'?'pill-gold':'pill-gray'}">${c.type}</span></td>
        <td>${c.type==='rental' ? '₦'+Number(c.rentalPricePerDay||0).toLocaleString()+'/day' : '₦'+Number(c.price||0).toLocaleString()}</td>
        <td><span class="pill ${c.status==='available'?'pill-green':'pill-red'}">${c.status||'available'}</span></td>
        <td><label class="switch"><input type="checkbox" data-feat="${c.id}" ${c.featured?'checked':''}><span class="slider"></span></label></td>
        <td class="row-actions">
          <button class="btn btn-sm btn-outline" data-edit-car="${c.id}">Edit</button>
          <button class="btn btn-sm btn-danger" data-del-car="${c.id}">Delete</button>
        </td>
      </tr>`).join("") : `<tr><td colspan="7" class="empty-state">${q ? "No vehicles match that search." : "No vehicles yet. Add your first one."}</td></tr>`;

  $("#carsCountNote").textContent = allCarsRows.length
    ? (q ? `Showing ${rows.length} of ${allCarsRows.length} vehicles.` : `${allCarsRows.length} vehicle${allCarsRows.length===1?"":"s"} total.`)
    : "";

  $$('[data-feat]').forEach(cb => cb.addEventListener("change", () =>
    updateDoc(doc(db, "cars", cb.dataset.feat), { featured: cb.checked })));
  $$('[data-edit-car]').forEach(b => b.addEventListener("click", () => {
    const car = allCarsRows.find(r => r.id === b.dataset.editCar);
    openCarModal(car);
  }));
  $$('[data-del-car]').forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Delete this vehicle listing? This can't be undone.")) return;
    await deleteDoc(doc(db, "cars", b.dataset.delCar));
    toast("Vehicle deleted.");
  }));
}

function initCars() {
  $("#btnAddCar").addEventListener("click", () => openCarModal());
  $("#carsSearchInput").addEventListener("input", renderCarsTable);
  onSnapshot(query(collection(db, "cars"), orderBy("createdAt", "desc")), snap => {
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    rows.forEach(c => carsMap[c.id] = `${c.year||''} ${c.brand||''} ${c.model||''}`.trim());
    allCarsRows = rows;
    renderCarsTable();
  });
}

function openCarModal(car) {
  const overlay = openModal(carFormHTML(car || {}));
  $(".admin-modal-close", overlay).addEventListener("click", () => closeModal(overlay));
  const form = $("#carForm", overlay);
  wireCropOnSelect(form.querySelector('input[name=images]'));

  // Mutable working copy of the saved photo URLs, so the admin can reorder
  // (promote one to "cover") or remove one before saving, independent of
  // whatever new files they're about to upload.
  let currentImages = [...(car && car.images || [])];
  const pendingDeletes = [];
  const previewEl = $("#carImagePreview", overlay);

  function renderImagePreview() {
    previewEl.innerHTML = currentImages.map((url, i) => `
      <div class="img-thumb${i === 0 ? " is-cover" : ""}" data-idx="${i}">
        <img src="${url}">
        <div class="thumb-actions">
          <button type="button" class="btn-star" data-cover="${i}" title="Make cover photo">&#9733;</button>
          <button type="button" class="btn-remove" data-remove-img="${i}" title="Remove photo">&times;</button>
        </div>
        ${i === 0 ? '<div class="cover-badge">COVER</div>' : ""}
      </div>`).join("") || `<p class="muted" style="font-size:.85rem;">No photos yet, upload at least one below.</p>`;

    $$("[data-cover]", previewEl).forEach(b => b.addEventListener("click", () => {
      const i = Number(b.dataset.cover);
      const [chosen] = currentImages.splice(i, 1);
      currentImages.unshift(chosen);
      renderImagePreview();
    }));
    $$("[data-remove-img]", previewEl).forEach(b => b.addEventListener("click", () => {
      const i = Number(b.dataset.removeImg);
      const [removed] = currentImages.splice(i, 1);
      if (removed) pendingDeletes.push(removed);
      renderImagePreview();
    }));
  }
  renderImagePreview();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("#carFormStatus", overlay);
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      const fd = new FormData(form);
      const payload = {
        type: fd.get("type"), category: fd.get("category"),
        brand: fd.get("brand"), model: fd.get("model"),
        year: Number(fd.get("year")) || null, color: fd.get("color"),
        price: fd.get("price") ? Number(fd.get("price")) : null,
        rentalPricePerDay: fd.get("rentalPricePerDay") ? Number(fd.get("rentalPricePerDay")) : null,
        transmission: fd.get("transmission"), fuelType: fd.get("fuelType"),
        mileage: fd.get("mileage") ? Number(fd.get("mileage")) : null,
        condition: fd.get("condition"), location: fd.get("location"),
        description: fd.get("description"),
        features: fd.get("features") ? fd.get("features").split(",").map(s=>s.trim()).filter(Boolean) : [],
        status: fd.get("status"), featured: fd.get("featured") === "on",
      };
      const files = form.querySelector('input[name=images]').files;
      let id = car && car.id;
      if (!id) {
        payload.createdAt = serverTimestamp();
        payload.images = [];
        const docRef = await addDoc(collection(db, "cars"), payload);
        id = docRef.id;
      }
      let uploaded = [];
      if (files.length) uploaded = await uploadFiles(files, `cars/${id}`);
      // Whatever's left in currentImages (after any removes/reordering) comes
      // first, in that order, with freshly uploaded photos appended after.
      payload.images = [...currentImages, ...uploaded];
      await setDoc(doc(db, "cars", id), payload, { merge: true });

      // Best-effort cleanup of removed photos in Storage; a failure here
      // (e.g. already gone) shouldn't block the save that already succeeded.
      for (const url of pendingDeletes) {
        try { await deleteObject(ref(storage, url)); } catch (e) { console.warn("Couldn't delete old photo:", e.message); }
      }

      toast(car ? "Vehicle updated." : "Vehicle added.");
      closeModal(overlay);
    } catch (err) {
      console.error(err);
      status.textContent = "Couldn't save this vehicle: " + err.message;
      status.className = "form-status show err";
      btn.disabled = false; btn.textContent = car ? "Save changes" : "Add vehicle";
    }
  });
}

/* =====================================================================
   SPARE PARTS
===================================================================== */
function partFormHTML(part = {}) {
  const isEdit = !!part.id;
  return `
    <button class="admin-modal-close">&times;</button>
    <h3>${isEdit ? "Edit spare part" : "Add spare part"}</h3>
    <form id="partForm">
      <div class="form-field"><label>Part name</label><input name="name" value="${part.name||''}" placeholder="e.g. Brake Pads, Front Set" required></div>
      <div class="form-row">
        <div class="form-field"><label>Category</label>
          <select name="category">
            ${["Engine Parts","Brakes","Suspension & Steering","Electrical","Body & Exterior","Interior & Trim","Tyres","Battery","Lubricants & Fluids","Filters","Transmission","Cooling System","Other"].map(c=>`<option ${part.category===c?"selected":""}>${c}</option>`).join("")}
          </select>
        </div>
        <div class="form-field"><label>Condition</label>
          <select name="condition">${["New","Used","Refurbished"].map(c=>`<option ${part.condition===c?"selected":""}>${c}</option>`).join("")}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-field"><label>Price (₦)</label><input name="price" type="number" value="${part.price||''}" required></div>
        <div class="form-field"><label>Compatible with</label><input name="compatibility" value="${part.compatibility||''}" placeholder="e.g. Toyota Camry 2010-2018, or Universal"></div>
      </div>
      <div class="form-field"><label>Description</label><textarea name="description">${part.description||''}</textarea></div>
      <div class="form-field">
        <label>Photos</label>
        <div class="image-input-list" id="partImagePreview"></div>
        <input type="file" name="images" multiple accept="image/*">
        <p class="form-note">The first photo (marked "Cover") is the one shown on listing pages. Click the star on any photo to make it the cover, or the &times; to remove it.</p>
      </div>
      <div class="form-row">
        <div class="form-field"><label>Status</label>
          <select name="status">${["available","out of stock","hidden"].map(s=>`<option ${part.status===s?"selected":""}>${s}</option>`).join("")}</select>
        </div>
        <div class="form-field" style="display:flex;align-items:center;gap:10px;margin-top:26px;">
          <label class="switch"><input type="checkbox" name="featured" ${part.featured?"checked":""}><span class="slider"></span></label>
          <label style="margin:0;">Feature on homepage</label>
        </div>
      </div>
      <button type="submit" class="btn btn-gold btn-block">${isEdit ? "Save changes" : "Add spare part"}</button>
      <div id="partFormStatus" class="form-status"></div>
    </form>`;
}

let allPartsRows = [];
function renderPartsTable() {
  const q = ($("#partsSearchInput")?.value || "").trim().toLowerCase();
  const rows = q
    ? allPartsRows.filter(p => `${p.name||''} ${p.category||''}`.toLowerCase().includes(q))
    : allPartsRows;
  $("#partsTableBody").innerHTML = rows.length ? rows.map(p => `
      <tr>
        <td><img class="thumb" src="${(p.images&&p.images[0])||''}" onerror="this.style.opacity=0"></td>
        <td>${p.name||''}</td>
        <td><span class="pill pill-gray">${p.category||''}</span></td>
        <td>₦${Number(p.price||0).toLocaleString()}</td>
        <td><span class="pill ${p.status==='available'?'pill-green':'pill-red'}">${p.status||'available'}</span></td>
        <td><label class="switch"><input type="checkbox" data-feat-part="${p.id}" ${p.featured?'checked':''}><span class="slider"></span></label></td>
        <td class="row-actions">
          <button class="btn btn-sm btn-outline" data-edit-part="${p.id}">Edit</button>
          <button class="btn btn-sm btn-danger" data-del-part="${p.id}">Delete</button>
        </td>
      </tr>`).join("") : `<tr><td colspan="7" class="empty-state">${q ? "No parts match that search." : "No spare parts yet, add your first one."}</td></tr>`;

  $("#partsCountNote").textContent = allPartsRows.length
    ? (q ? `Showing ${rows.length} of ${allPartsRows.length} parts.` : `${allPartsRows.length} part${allPartsRows.length===1?"":"s"} total.`)
    : "";

  $$('[data-feat-part]').forEach(cb => cb.addEventListener("change", () =>
    updateDoc(doc(db, "spareParts", cb.dataset.featPart), { featured: cb.checked })));
  $$('[data-edit-part]').forEach(b => b.addEventListener("click", () => {
    const part = allPartsRows.find(r => r.id === b.dataset.editPart);
    openPartModal(part);
  }));
  $$('[data-del-part]').forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Delete this spare part listing? This can't be undone.")) return;
    await deleteDoc(doc(db, "spareParts", b.dataset.delPart));
    toast("Spare part deleted.");
  }));
}

function initParts() {
  $("#btnAddPart").addEventListener("click", () => openPartModal());
  $("#partsSearchInput").addEventListener("input", renderPartsTable);
  onSnapshot(query(collection(db, "spareParts"), orderBy("createdAt", "desc")), snap => {
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    allPartsRows = rows;
    renderPartsTable();
  });
}

function openPartModal(part) {
  const overlay = openModal(partFormHTML(part || {}));
  $(".admin-modal-close", overlay).addEventListener("click", () => closeModal(overlay));
  const form = $("#partForm", overlay);
  wireCropOnSelect(form.querySelector('input[name=images]'));

  let currentImages = [...(part && part.images || [])];
  const pendingDeletes = [];
  const previewEl = $("#partImagePreview", overlay);

  function renderImagePreview() {
    previewEl.innerHTML = currentImages.map((url, i) => `
      <div class="img-thumb${i === 0 ? " is-cover" : ""}" data-idx="${i}">
        <img src="${url}">
        <div class="thumb-actions">
          <button type="button" class="btn-star" data-cover="${i}" title="Make cover photo">&#9733;</button>
          <button type="button" class="btn-remove" data-remove-img="${i}" title="Remove photo">&times;</button>
        </div>
        ${i === 0 ? '<div class="cover-badge">COVER</div>' : ""}
      </div>`).join("") || `<p class="muted" style="font-size:.85rem;">No photos yet, upload at least one below.</p>`;

    $$("[data-cover]", previewEl).forEach(b => b.addEventListener("click", () => {
      const i = Number(b.dataset.cover);
      const [chosen] = currentImages.splice(i, 1);
      currentImages.unshift(chosen);
      renderImagePreview();
    }));
    $$("[data-remove-img]", previewEl).forEach(b => b.addEventListener("click", () => {
      const i = Number(b.dataset.removeImg);
      const [removed] = currentImages.splice(i, 1);
      if (removed) pendingDeletes.push(removed);
      renderImagePreview();
    }));
  }
  renderImagePreview();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("#partFormStatus", overlay);
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      const fd = new FormData(form);
      const payload = {
        name: fd.get("name"), category: fd.get("category"), condition: fd.get("condition"),
        price: fd.get("price") ? Number(fd.get("price")) : null,
        compatibility: fd.get("compatibility"), description: fd.get("description"),
        status: fd.get("status"), featured: fd.get("featured") === "on",
      };
      const files = form.querySelector('input[name=images]').files;
      let id = part && part.id;
      if (!id) {
        payload.createdAt = serverTimestamp();
        payload.images = [];
        const docRef = await addDoc(collection(db, "spareParts"), payload);
        id = docRef.id;
      }
      let uploaded = [];
      if (files.length) uploaded = await uploadFiles(files, `spareParts/${id}`);
      payload.images = [...currentImages, ...uploaded];
      await setDoc(doc(db, "spareParts", id), payload, { merge: true });

      for (const url of pendingDeletes) {
        try { await deleteObject(ref(storage, url)); } catch (e) { console.warn("Couldn't delete old photo:", e.message); }
      }

      toast(part ? "Spare part updated." : "Spare part added.");
      closeModal(overlay);
    } catch (err) {
      console.error(err);
      status.textContent = "Couldn't save this spare part: " + err.message;
      status.className = "form-status show err";
      btn.disabled = false; btn.textContent = part ? "Save changes" : "Add spare part";
    }
  });
}

/* =====================================================================
   BLOG
===================================================================== */
let quillExtrasRegistered = false;
function registerQuillExtras() {
  if (quillExtrasRegistered || typeof Quill === "undefined") return;
  quillExtrasRegistered = true;

  // Use the STYLE-based attributors (not Quill's default class-based ones)
  // so font/size are saved as real inline CSS in the article's HTML. That
  // matters because the public blog page renders this HTML directly and
  // never loads Quill's own stylesheet, so a class like "ql-font-serif"
  // would do nothing there, while inline "font-family: Fraunces" always works.
  const FontStyle = Quill.import("attributors/style/font");
  FontStyle.whitelist = ["Inter", "Fraunces", "Bricolage Grotesque", "Georgia", "Arial", "Courier New"];
  Quill.register(FontStyle, true);

  const SizeStyle = Quill.import("attributors/style/size");
  SizeStyle.whitelist = ["14px", "16px", "18px", "20px", "24px", "32px"];
  Quill.register(SizeStyle, true);

  // Same reasoning for alignment: Quill's default aligner writes a class
  // ("ql-align-center") that only turns into actual centring if Quill's
  // stylesheet is loaded to interpret it. The public blog page doesn't
  // load it, so centred/right-aligned/justified text was silently
  // reverting to plain left-aligned once published. The style-based
  // version writes text-align directly as inline CSS instead.
  const AlignStyle = Quill.import("attributors/style/align");
  Quill.register(AlignStyle, true);

  if (window.ImageResize) {
    Quill.register("modules/imageResize", window.ImageResize.default || window.ImageResize);
  }
}

function postFormHTML(post = {}) {
  const isEdit = !!post.id;
  return `
    <button class="admin-modal-close">&times;</button>
    <h3>${isEdit ? "Edit post" : "New blog post"}</h3>
    <form id="postForm">
      <div class="form-field"><label>Title</label><input name="title" value="${post.title||''}" required></div>
      <div class="form-row">
        <div class="form-field"><label>Slug (used in the URL)</label><input name="slug" value="${post.slug||''}" placeholder="auto-generated-from-title"></div>
        <div class="form-field"><label>Category</label><input name="category" value="${post.category||'Buying Guide'}"></div>
      </div>
      <div class="form-field">
        <label>Publish date</label>
        <input type="date" name="publishDate" value="${toDateInputValue(post.createdAt)}">
        <p class="form-note">Sets the date shown on the article and used to order the blog. Set this to a past date to backdate a post.</p>
      </div>
      <div class="form-field">
        <label>Cover image</label>
        <div class="image-input-list">${post.coverImage?`<img src="${post.coverImage}">`:""}</div>
        <input type="file" name="cover" accept="image/*">
      </div>
      <div class="form-field"><label>Excerpt (short summary)</label><textarea name="excerpt" style="min-height:70px;">${post.excerpt||''}</textarea></div>
      <div class="form-field">
        <label>Import from a Word document (optional)</label>
        <input type="file" id="postImportDocx" accept=".docx">
        <p class="form-note" id="importDocxStatus">Upload a .docx file to bring in its headings, bold/italic text, lists and images as the article content below, replacing whatever is currently in the editor. Review and adjust after importing, then publish as usual. PDF and .doc (older Word format) aren't supported, save as .docx first.</p>
      </div>
      <div class="form-field">
        <label>Content</label>
        <div id="postQuillToolbar">
          <span class="ql-formats">
            <select class="ql-header"><option value="2"></option><option value="3"></option><option selected></option></select>
          </span>
          <span class="ql-formats">
            <select class="ql-font">
              <option value="Inter" selected></option>
              <option value="Fraunces"></option>
              <option value="Bricolage Grotesque"></option>
              <option value="Georgia"></option>
              <option value="Arial"></option>
              <option value="Courier New"></option>
            </select>
            <select class="ql-size">
              <option value="14px"></option>
              <option value="16px" selected></option>
              <option value="18px"></option>
              <option value="20px"></option>
              <option value="24px"></option>
              <option value="32px"></option>
            </select>
          </span>
          <span class="ql-formats">
            <button class="ql-bold"></button><button class="ql-italic"></button><button class="ql-underline"></button>
          </span>
          <span class="ql-formats">
            <select class="ql-color"></select><select class="ql-background"></select>
          </span>
          <span class="ql-formats">
            <select class="ql-align"></select>
          </span>
          <span class="ql-formats">
            <button class="ql-list" value="ordered"></button><button class="ql-list" value="bullet"></button><button class="ql-blockquote"></button>
          </span>
          <span class="ql-formats">
            <button class="ql-link"></button><button class="ql-image"></button><button class="ql-clean"></button>
          </span>
        </div>
        <div id="postQuillEditor"></div>
        <textarea name="content" id="postContentHidden" style="display:none;">${post.content||''}</textarea>
        <p class="form-note">Click an image after inserting it to drag-resize it from its corners, and use its small floating toolbar to place it left, right, or centre with text wrapping around it.</p>
        <p class="form-note">The published article page has a black background, and this editor matches it. If you use the text colour tool, pick a light colour, a dark one will disappear against the black page even though it may look fine here if you mix up foreground and background.</p>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
        <label class="switch"><input type="checkbox" name="published" ${post.published!==false?"checked":""}><span class="slider"></span></label>
        <label style="margin:0;">Published (visible on the site)</label>
      </div>
      <button type="submit" class="btn btn-gold btn-block">${isEdit ? "Save changes" : "Publish post"}</button>
      <div id="postFormStatus" class="form-status"></div>
    </form>`;
}

function initBlog() {
  $("#btnAddPost").addEventListener("click", () => openPostModal());
  onSnapshot(query(collection(db, "blogPosts"), orderBy("createdAt", "desc")), snap => {
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    rows.forEach(p => postsMap[p.slug] = p.title);
    $("#postsTableBody").innerHTML = rows.length ? rows.map(p => `
      <tr>
        <td><img class="thumb" src="${p.coverImage||''}" onerror="this.style.opacity=0"></td>
        <td>${p.title}<br><span class="muted" style="font-size:.78rem;">${fmtDate(p.createdAt)}</span></td>
        <td>${p.category||''}</td>
        <td><label class="switch"><input type="checkbox" data-pub="${p.id}" ${p.published!==false?'checked':''}><span class="slider"></span></label></td>
        <td>${fmtDate(p.createdAt)}</td>
        <td class="row-actions">
          <button class="btn btn-sm btn-outline" data-edit-post="${p.id}">Edit</button>
          <button class="btn btn-sm btn-danger" data-del-post="${p.id}">Delete</button>
        </td>
      </tr>`).join("") : `<tr><td colspan="6" class="empty-state">No posts yet. Write your first one.</td></tr>`;

    $$('[data-pub]').forEach(cb => cb.addEventListener("change", () =>
      updateDoc(doc(db, "blogPosts", cb.dataset.pub), { published: cb.checked })));
    $$('[data-edit-post]').forEach(b => b.addEventListener("click", () => {
      openPostModal(rows.find(r => r.id === b.dataset.editPost));
    }));
    $$('[data-del-post]').forEach(b => b.addEventListener("click", async () => {
      if (!confirm("Delete this post?")) return;
      await deleteDoc(doc(db, "blogPosts", b.dataset.delPost));
      toast("Post deleted.");
    }));
  });
}

function openPostModal(post) {
  const overlay = openModal(postFormHTML(post || {}), true);
  $(".admin-modal-close", overlay).addEventListener("click", () => closeModal(overlay));
  const form = $("#postForm", overlay);
  wireCropOnSelect(form.querySelector('input[name=cover]'));

  registerQuillExtras();

  // Quill rich-text editor: bold, headings, font, size, colour, alignment,
  // lists, links, and a resizable/repositionable image tool.
  // The hidden textarea keeps the current HTML in sync so FormData can read it.
  const hiddenContent = $("#postContentHidden", overlay);
  const quill = new Quill(overlay.querySelector("#postQuillEditor"), {
    theme: "snow",
    modules: {
      toolbar: overlay.querySelector("#postQuillToolbar"),
      imageResize: window.ImageResize ? { modules: ["Resize", "DisplaySize", "Toolbar"] } : undefined,
    },
    placeholder: "Write the article here…",
  });
  quill.root.innerHTML = hiddenContent.value || "";

  // Images inserted INTO the article body: crop first, then upload to
  // Storage and insert the resulting URL. Uploading rather than embedding
  // as base64 matters here: Firestore documents cap out at 1 MiB, and a
  // few embedded photos would blow past that easily.
  quill.getModule("toolbar").addHandler("image", () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      const cropped = await cropImageFile(file);
      const range = quill.getSelection(true) || { index: quill.getLength() };
      quill.insertText(range.index, "Uploading image…", { italic: true });
      try {
        const path = `blogContent/${Date.now()}-${cropped.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, cropped);
        const url = await getDownloadURL(storageRef);
        quill.deleteText(range.index, "Uploading image…".length);
        quill.insertEmbed(range.index, "image", url, "user");
        quill.setSelection(range.index + 1);
      } catch (err) {
        quill.deleteText(range.index, "Uploading image…".length);
        toast("Image upload failed: " + err.message);
      }
    });
    fileInput.click();
  });

  // Import a .docx file: converts it to HTML (headings, bold/italic,
  // lists, tables and embedded images all carry over) and drops that
  // straight into the editor in place of whatever's there. Embedded
  // images are uploaded to Storage during the conversion, same as
  // images inserted by hand, rather than saved as base64.
  const importInput = $("#postImportDocx", overlay);
  const importStatus = $("#importDocxStatus", overlay);
  importInput.addEventListener("change", async () => {
    const file = importInput.files[0];
    if (!file) return;
    if (typeof mammoth === "undefined") {
      importStatus.textContent = "Document import isn't available right now, please try again shortly.";
      return;
    }
    importStatus.textContent = "Converting document…";
    try {
      const arrayBuffer = await file.arrayBuffer();
      let imgCounter = 0;
      const result = await mammoth.convertToHtml({ arrayBuffer }, {
        convertImage: mammoth.images.imgElement((image) =>
          image.read("base64").then(async (base64) => {
            const byteChars = atob(base64);
            const byteNumbers = new Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
            const blob = new Blob([new Uint8Array(byteNumbers)], { type: image.contentType || "image/png" });
            imgCounter++;
            const ext = (image.contentType || "image/png").split("/")[1] || "png";
            const storageRef = ref(storage, `blogContent/${Date.now()}-docx-${imgCounter}.${ext}`);
            await uploadBytes(storageRef, blob);
            const url = await getDownloadURL(storageRef);
            return { src: url };
          })
        ),
      });
      quill.root.innerHTML = result.value;
      hiddenContent.value = quill.root.innerHTML;

      // Nice-to-have: suggest an excerpt from the first bit of imported
      // text, only if the admin hasn't already written one.
      const excerptField = form.querySelector('textarea[name=excerpt]');
      if (excerptField && !excerptField.value.trim()) {
        const plain = quill.getText().trim().replace(/\s+/g, " ");
        if (plain) excerptField.value = plain.slice(0, 160) + (plain.length > 160 ? "…" : "");
      }

      const warnings = result.messages && result.messages.length
        ? ` (${result.messages.length} minor formatting note${result.messages.length === 1 ? "" : "s"}, styling that doesn't map to the blog may have been simplified.)`
        : "";
      importStatus.textContent = `Document imported into the editor below. Review it, then publish when ready.${warnings}`;
      toast("Document imported.");
    } catch (err) {
      console.error(err);
      importStatus.textContent = "Couldn't import that document: " + err.message;
    } finally {
      importInput.value = "";
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hiddenContent.value = quill.root.innerHTML;
    const status = $("#postFormStatus", overlay);
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      const fd = new FormData(form);
      const title = fd.get("title");
      const payload = {
        title, slug: slugify(fd.get("slug") || title),
        category: fd.get("category"), excerpt: fd.get("excerpt"),
        content: fd.get("content"), published: fd.get("published") === "on",
        createdAt: dateInputToTimestamp(fd.get("publishDate")),
      };
      let id = post && post.id;
      if (!id) {
        const docRef = await addDoc(collection(db, "blogPosts"), payload);
        id = docRef.id;
      }
      const file = form.querySelector('input[name=cover]').files[0];
      if (file) {
        const [url] = await uploadFiles([file], `blog/${id}`);
        payload.coverImage = url;
      } else if (post) {
        payload.coverImage = post.coverImage || "";
      }
      await setDoc(doc(db, "blogPosts", id), payload, { merge: true });
      toast(post ? "Post updated." : "Post published.");
      closeModal(overlay);
    } catch (err) {
      console.error(err);
      status.textContent = "Couldn't save this post: " + err.message;
      status.className = "form-status show err";
      btn.disabled = false; btn.textContent = post ? "Save changes" : "Publish post";
    }
  });
}

/* =====================================================================
   REVIEWS & COMMENTS  (blog comments + car reviews, same moderation flow:
   Approve makes it public, Reject hides it but keeps the record, Delete
   removes it for good)
===================================================================== */
function statusPill(status) {
  if (status === "approved") return `<span class="pill pill-green">Approved</span>`;
  if (status === "rejected") return `<span class="pill pill-red">Rejected</span>`;
  return `<span class="pill pill-gold">Pending</span>`;
}

function sortModeration(items) {
  const rank = { pending: 0, approved: 1, rejected: 2 };
  return items.sort((a, b) => {
    const r = (rank[a.status] ?? 0) - (rank[b.status] ?? 0);
    if (r !== 0) return r;
    return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
  });
}

function moderationActions(collectionName, id) {
  return `
    <div class="row-actions">
      <button class="btn btn-sm btn-gold" data-approve="${collectionName}:${id}">Approve</button>
      <button class="btn btn-sm btn-outline" data-reject="${collectionName}:${id}">Reject</button>
      <button class="btn btn-sm btn-danger" data-delmod="${collectionName}:${id}">Delete</button>
    </div>`;
}

function wireModerationButtons(root) {
  root.querySelectorAll("[data-approve]").forEach(b => b.addEventListener("click", async () => {
    const [col, id] = b.dataset.approve.split(":");
    await updateDoc(doc(db, col, id), { status: "approved" });
    toast("Approved and now visible on the site.");
  }));
  root.querySelectorAll("[data-reject]").forEach(b => b.addEventListener("click", async () => {
    const [col, id] = b.dataset.reject.split(":");
    await updateDoc(doc(db, col, id), { status: "rejected" });
    toast("Rejected. It's hidden from the site but kept on record.");
  }));
  root.querySelectorAll("[data-delmod]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Delete this permanently?")) return;
    const [col, id] = b.dataset.delmod.split(":");
    await deleteDoc(doc(db, col, id));
    toast("Deleted.");
  }));
}

function initReviewsComments() {
  const commentsEl = $("#commentsModList");
  const reviewsEl = $("#reviewsModList");

  onSnapshot(query(collection(db, "blogComments"), orderBy("createdAt", "desc")), snap => {
    let items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    items = sortModeration(items);
    commentsEl.innerHTML = items.length ? items.map(c => `
      <div class="enquiry-item ${c.status === 'pending' ? 'unread' : ''}">
        <h4>${c.name || "Anonymous"} ${statusPill(c.status)}</h4>
        <p class="muted" style="margin:0 0 6px;">On &ldquo;${postsMap[c.postId] || c.postId}&rdquo; &middot; ${fmtDate(c.createdAt)}</p>
        <p style="margin:0 0 10px;">${c.message || ""}</p>
        ${moderationActions("blogComments", c.id)}
      </div>`).join("") : `<p class="empty-state">No blog comments yet.</p>`;
    wireModerationButtons(commentsEl);
    updatePendingStat();
  });

  onSnapshot(query(collection(db, "carReviews"), orderBy("createdAt", "desc")), snap => {
    let items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    items = sortModeration(items);
    reviewsEl.innerHTML = items.length ? items.map(r => `
      <div class="enquiry-item ${r.status === 'pending' ? 'unread' : ''}">
        <h4>${r.name || "Anonymous"} ${statusPill(r.status)}</h4>
        <p class="stars-display" style="margin:0 0 4px;">${"&#9733;".repeat(Number(r.rating)||0)}${"&#9734;".repeat(5-(Number(r.rating)||0))}</p>
        <p class="muted" style="margin:0 0 6px;">On ${carsMap[r.carId] || r.carId} &middot; ${fmtDate(r.createdAt)}</p>
        <p style="margin:0 0 10px;">${r.message || ""}</p>
        ${moderationActions("carReviews", r.id)}
      </div>`).join("") : `<p class="empty-state">No car reviews yet.</p>`;
    wireModerationButtons(reviewsEl);
    updatePendingStat();
  });
}

let pendingCommentsCount = 0, pendingReviewsCount = 0;
function updatePendingStat() {
  pendingCommentsCount = $$(".enquiry-item.unread", $("#commentsModList")).length;
  pendingReviewsCount = $$(".enquiry-item.unread", $("#reviewsModList")).length;
  const el = $("#statPendingReviews");
  if (el) el.textContent = pendingCommentsCount + pendingReviewsCount;
}

/* =====================================================================
   ENQUIRIES  (reply goes out via the admin's own email app, always
   works, or via EmailJS one-click send if configured in Settings)
===================================================================== */
function initEnquiries() {
  onSnapshot(query(collection(db, "enquiries"), orderBy("createdAt", "desc")), snap => {
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    $("#enquiriesList").innerHTML = rows.length ? rows.map(e => `
      <div class="enquiry-item ${e.status === 'new' ? 'unread' : ''}" data-enq="${e.id}">
        <h4>${e.name || "Unknown"} &mdash; ${e.subject || "General enquiry"} ${e.replied ? '<span class="pill pill-green">Replied</span>' : '<span class="pill pill-gold">New</span>'}</h4>
        <p class="muted" style="margin:0 0 6px;">${e.email || ""} ${e.phone ? "· " + e.phone : ""} · ${fmtDate(e.createdAt)}</p>
        <p style="margin:0;">${e.message || ""}</p>
        <div class="thread-box hidden" data-thread="${e.id}">
          ${e.reply ? `<p><strong>Your reply:</strong> ${e.reply}</p>` : ""}
          <div class="form-field"><label>Write a reply</label><textarea data-reply-text="${e.id}" placeholder="Type your reply here...">${e.reply||''}</textarea></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-ink btn-sm" data-reply-email="${e.id}">Open in email app</button>
            <button class="btn btn-gold btn-sm" data-reply-emailjs="${e.id}">Send via EmailJS</button>
            <button class="btn btn-outline btn-sm" data-mark-replied="${e.id}">Mark as replied</button>
          </div>
        </div>
      </div>`).join("") : `<p class="empty-state">No enquiries yet.</p>`;

    $$('[data-enq]').forEach(item => item.addEventListener("click", (ev) => {
      if (ev.target.closest("textarea") || ev.target.closest("button")) return;
      const thread = $(`[data-thread="${item.dataset.enq}"]`, item);
      thread.classList.toggle("hidden");
      if (!thread.classList.contains("hidden") && item.classList.contains("unread")) {
        updateDoc(doc(db, "enquiries", item.dataset.enq), { status: "read" });
      }
    }));

    $$('[data-reply-email]').forEach(b => b.addEventListener("click", () => {
      const id = b.dataset.replyEmail;
      const e = rows.find(r => r.id === id);
      const text = $(`[data-reply-text="${id}"]`).value || "";
      const subject = encodeURIComponent("Re: " + (e.subject || "Your enquiry to De Young Jo Motors"));
      const body = encodeURIComponent(text || `Hi ${e.name || ""},\n\n`);
      window.location.href = `mailto:${e.email}?subject=${subject}&body=${body}`;
    }));

    $$('[data-mark-replied]').forEach(b => b.addEventListener("click", async () => {
      const id = b.dataset.markReplied;
      const text = $(`[data-reply-text="${id}"]`).value || "";
      await updateDoc(doc(db, "enquiries", id), { replied: true, reply: text, status: "replied" });
      toast("Marked as replied.");
    }));

    $$('[data-reply-emailjs]').forEach(b => b.addEventListener("click", async () => {
      const id = b.dataset.replyEmailjs;
      const e = rows.find(r => r.id === id);
      const text = $(`[data-reply-text="${id}"]`).value || "";
      if (!text.trim()) return toast("Write a reply first.");
      try {
        const settingsSnap = await getDoc(doc(db, "settings", "general"));
        const s = settingsSnap.exists() ? settingsSnap.data() : {};
        if (!s.emailjsServiceId || !s.emailjsTemplateId || !s.emailjsPublicKey) {
          return toast("Set up EmailJS in Settings first, or use 'Open in email app'.");
        }
        await loadEmailJs();
        emailjs.init(s.emailjsPublicKey);
        await emailjs.send(s.emailjsServiceId, s.emailjsTemplateId, {
          to_email: e.email, to_name: e.name, reply_message: text, subject: e.subject || "Your enquiry"
        });
        await updateDoc(doc(db, "enquiries", id), { replied: true, reply: text, status: "replied" });
        toast("Reply sent via EmailJS.");
      } catch (err) {
        console.error(err);
        toast("EmailJS send failed. Try 'Open in email app' instead.");
      }
    }));
  });
}

let emailjsLoaded = false;
function loadEmailJs() {
  if (emailjsLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
    s.onload = () => { emailjsLoaded = true; resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* =====================================================================
   AFFILIATE APPLICATIONS
===================================================================== */
function initAffiliates() {
  onSnapshot(query(collection(db, "affiliateApplications"), orderBy("createdAt", "desc")), snap => {
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    $("#affiliatesTableBody").innerHTML = rows.length ? rows.map(a => `
      <tr>
        <td>${a.fullName||''}<br><span class="muted" style="font-size:.78rem;">${a.city||''}</span></td>
        <td>${a.email||''}<br><span class="muted" style="font-size:.78rem;">${a.phone||''}</span></td>
        <td>${a.platform||''}</td>
        <td>${a.audience||''}</td>
        <td>
          <select data-affstatus="${a.id}">
            ${["pending","approved","rejected"].map(s=>`<option value="${s}" ${a.status===s?"selected":""}>${s}</option>`).join("")}
          </select>
        </td>
        <td>${fmtDate(a.createdAt)}</td>
      </tr>`).join("") : `<tr><td colspan="6" class="empty-state">No applications yet.</td></tr>`;

    $$('[data-affstatus]').forEach(sel => sel.addEventListener("change", () =>
      updateDoc(doc(db, "affiliateApplications", sel.dataset.affstatus), { status: sel.value })));
  });
}

/* =====================================================================
   POPUPS
===================================================================== */
function popupFormHTML(p = {}) {
  const isEdit = !!p.id;
  return `
    <button class="admin-modal-close">&times;</button>
    <h3>${isEdit ? "Edit popup" : "New popup"}</h3>
    <form id="popupForm">
      <div class="form-field"><label>Headline</label><input name="title" value="${p.title||''}" required></div>
      <div class="form-field"><label>Message</label><textarea name="text">${p.text||''}</textarea></div>
      <div class="form-field">
        <label>Image (optional)</label>
        <div class="image-input-list">${p.imageUrl?`<img src="${p.imageUrl}">`:""}</div>
        <input type="file" name="image" accept="image/*">
      </div>
      <div class="form-row">
        <div class="form-field"><label>Button text (optional)</label><input name="ctaText" value="${p.ctaText||''}" placeholder="e.g. See offer"></div>
        <div class="form-field"><label>Button link</label><input name="ctaLink" value="${p.ctaLink||''}" placeholder="cars-for-sale.html"></div>
      </div>
      <div class="form-field"><label>Show this many times per visitor (popup)</label><input name="maxShows" type="number" min="1" value="${p.maxShows||3}"></div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <label class="switch"><input type="checkbox" name="active" ${p.active!==false?"checked":""}><span class="slider"></span></label>
        <label style="margin:0;">Active on the site</label>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
        <label class="switch"><input type="checkbox" name="showAsBanner" ${p.showAsBanner?"checked":""}><span class="slider"></span></label>
        <label style="margin:0;">Also show as a slim top banner (sitewide offers strip, unlimited views)</label>
      </div>
      <button type="submit" class="btn btn-gold btn-block">${isEdit ? "Save changes" : "Create popup"}</button>
      <div id="popupFormStatus" class="form-status"></div>
    </form>`;
}

function initPopups() {
  $("#btnAddPopup").addEventListener("click", () => openPopupModal());
  onSnapshot(collection(db, "popups"), snap => {
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    $("#popupsTableBody").innerHTML = rows.length ? rows.map(p => `
      <tr>
        <td><img class="thumb" src="${p.imageUrl||''}" onerror="this.style.opacity=0"></td>
        <td>${p.title}</td>
        <td>${p.maxShows||3}</td>
        <td>${p.showAsBanner ? '<span class="pill pill-gold">Banner</span>' : '<span class="pill pill-gray">Modal only</span>'}</td>
        <td><label class="switch"><input type="checkbox" data-popact="${p.id}" ${p.active!==false?'checked':''}><span class="slider"></span></label></td>
        <td class="row-actions">
          <button class="btn btn-sm btn-outline" data-edit-popup="${p.id}">Edit</button>
          <button class="btn btn-sm btn-danger" data-del-popup="${p.id}">Delete</button>
        </td>
      </tr>`).join("") : `<tr><td colspan="6" class="empty-state">No popups yet. Create an offer to show visitors.</td></tr>`;

    $$('[data-popact]').forEach(cb => cb.addEventListener("change", () =>
      updateDoc(doc(db, "popups", cb.dataset.popact), { active: cb.checked })));
    $$('[data-edit-popup]').forEach(b => b.addEventListener("click", () =>
      openPopupModal(rows.find(r => r.id === b.dataset.editPopup))));
    $$('[data-del-popup]').forEach(b => b.addEventListener("click", async () => {
      if (!confirm("Delete this popup?")) return;
      await deleteDoc(doc(db, "popups", b.dataset.delPopup));
      toast("Popup deleted.");
    }));
  });
}

function openPopupModal(p) {
  const overlay = openModal(popupFormHTML(p || {}));
  $(".admin-modal-close", overlay).addEventListener("click", () => closeModal(overlay));
  const form = $("#popupForm", overlay);
  wireCropOnSelect(form.querySelector('input[name=image]'));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("#popupFormStatus", overlay);
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      const fd = new FormData(form);
      const payload = {
        title: fd.get("title"), text: fd.get("text"),
        ctaText: fd.get("ctaText"), ctaLink: fd.get("ctaLink"),
        maxShows: Number(fd.get("maxShows")) || 3,
        active: fd.get("active") === "on",
        showAsBanner: fd.get("showAsBanner") === "on",
      };
      let id = p && p.id;
      if (!id) {
        payload.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(db, "popups"), payload);
        id = docRef.id;
      }
      const file = form.querySelector('input[name=image]').files[0];
      if (file) {
        const [url] = await uploadFiles([file], `popups/${id}`);
        payload.imageUrl = url;
      } else if (p) {
        payload.imageUrl = p.imageUrl || "";
      }
      await setDoc(doc(db, "popups", id), payload, { merge: true });
      toast(p ? "Popup updated." : "Popup created.");
      closeModal(overlay);
    } catch (err) {
      console.error(err);
      status.textContent = "Couldn't save this popup: " + err.message;
      status.className = "form-status show err";
      btn.disabled = false; btn.textContent = p ? "Save changes" : "Create popup";
    }
  });
}

/* =====================================================================
   SETTINGS
===================================================================== */
/* =====================================================================
   DESKTOP NOTIFICATIONS  (bell button in the topbar)
   Works while this dashboard is open in a browser tab, even a background
   one. True "notify even with the browser fully closed" push needs a
   server component (Firebase Cloud Functions), which isn't set up here.
   See the README for that optional upgrade path.
===================================================================== */
const NOTIFY_KEY = "dyj_admin_notify";

function notifyUser(title, body) {
  toast(`${title}: ${body}`);
  if (localStorage.getItem(NOTIFY_KEY) === "1" && typeof Notification !== "undefined" && Notification.permission === "granted") {
    try { new Notification(title, { body, icon: "assets/img/logo.png" }); } catch (e) { console.warn(e); }
  }
}

function setNotifyUI(on) {
  $("#notifyLabel").textContent = on ? "Notifications: On" : "Notifications: Off";
  $("#notifyIcon").textContent = on ? "\u{1F514}" : "\u{1F515}";
  $("#notifyToggleBtn").classList.toggle("added", on);
}

async function initNotifications() {
  const on = localStorage.getItem(NOTIFY_KEY) === "1" && typeof Notification !== "undefined" && Notification.permission === "granted";
  setNotifyUI(on);

  $("#notifyToggleBtn").addEventListener("click", async () => {
    const currentlyOn = localStorage.getItem(NOTIFY_KEY) === "1";
    if (currentlyOn) {
      localStorage.setItem(NOTIFY_KEY, "0");
      setNotifyUI(false);
      toast("Desktop notifications turned off.");
      return;
    }
    if (typeof Notification === "undefined") {
      toast("This browser doesn't support desktop notifications.");
      return;
    }
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission === "granted") {
      localStorage.setItem(NOTIFY_KEY, "1");
      setNotifyUI(true);
      toast("Desktop notifications turned on.");
    } else {
      toast("Notifications are blocked in this browser's settings. Allow them for this site to turn this on.");
    }
  });

  // Watch each collection for genuinely new documents. The first snapshot
  // of each listener is the existing backlog, not a "new" event, so it's
  // skipped deliberately.
  function watchNew(collectionName, extraClause, describe) {
    const clauses = [orderBy("createdAt", "desc"), limit(20)];
    const q = extraClause
      ? query(collection(db, collectionName), extraClause, ...clauses)
      : query(collection(db, collectionName), ...clauses);
    let first = true;
    onSnapshot(q, snap => {
      if (first) { first = false; return; }
      snap.docChanges().forEach(change => {
        if (change.type === "added") notifyUser("De Young Jo Motors admin", describe(change.doc.data()));
      });
    });
  }

  watchNew("enquiries", null, d => `New enquiry from ${d.name || "a visitor"}.`);
  watchNew("affiliateApplications", null, d => `New affiliate application from ${d.fullName || "someone"}.`);
  watchNew("blogComments", where("status", "==", "pending"), d => `New blog comment awaiting approval from ${d.name || "someone"}.`);
  watchNew("carReviews", where("status", "==", "pending"), d => `New car review awaiting approval from ${d.name || "someone"}.`);
}

async function initSettings() {
  const settingsForm = $("#settingsForm");
  const emailjsForm = $("#emailjsForm");
  try {
    const snap = await getDoc(doc(db, "settings", "general"));
    const s = snap.exists() ? snap.data() : {};
    for (const [k, v] of Object.entries(s)) {
      const el1 = settingsForm.elements[k]; if (el1) el1.value = v;
      const el2 = emailjsForm.elements[k]; if (el2) el2.value = v;
    }
  } catch (e) { console.warn(e); }

  settingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(settingsForm);
    const payload = Object.fromEntries(fd.entries());
    await setDoc(doc(db, "settings", "general"), payload, { merge: true });
    $("#settingsStatus").textContent = "Settings saved.";
    $("#settingsStatus").className = "form-status show ok";
  });

  emailjsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(emailjsForm);
    const payload = Object.fromEntries(fd.entries());
    await setDoc(doc(db, "settings", "general"), payload, { merge: true });
    $("#emailjsStatus").textContent = "EmailJS settings saved.";
    $("#emailjsStatus").className = "form-status show ok";
  });

  // ---- Add another admin without logging the current admin out ----
  // Trick: spin up a second, temporary Firebase App instance so the
  // createUserWithEmailAndPassword call doesn't touch this session's auth.
  $("#addAdminForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("#addAdminStatus");
    const fd = new FormData(e.target);
    const email = fd.get("newAdminEmail"), password = fd.get("newAdminPassword");
    try {
      const secondaryApp = initializeApp(app.options, "SecondaryAdminCreation-" + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await setDoc(doc(db, "admins", cred.user.uid), { email, createdAt: serverTimestamp() });
      await secondaryAuth.signOut();
      status.textContent = `Admin account created for ${email}.`;
      status.className = "form-status show ok";
      e.target.reset();
    } catch (err) {
      console.error(err);
      status.textContent = "Couldn't create that admin: " + err.message;
      status.className = "form-status show err";
    }
  });
}