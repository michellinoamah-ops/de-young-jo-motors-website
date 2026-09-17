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
  query, orderBy, serverTimestamp, onSnapshot
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

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  $("#toastMount").appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function fmtDate(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
  } catch { return ""; }
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

function openModal(html) {
  const overlay = document.createElement("div");
  overlay.className = "admin-modal-overlay";
  overlay.innerHTML = `<div class="admin-modal">${html}</div>`;
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
  initBlog();
  initEnquiries();
  initAffiliates();
  initPopups();
  initSettings();
});

$("#logoutBtn").addEventListener("click", adminLogout);

function initSidebar() {
  const buttons = $$("#adminNav button");
  const sections = $$(".admin-section");
  const titleMap = {
    overview: "Overview", cars: "Cars & Rentals", blog: "Blog",
    enquiries: "Enquiries", affiliates: "Affiliate Applications",
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
        <div class="image-input-list" id="carImagePreview">${(car.images||[]).map(u=>`<img src="${u}">`).join("")}</div>
        <input type="file" name="images" multiple accept="image/*">
        <p class="form-note">Upload one or more photos. Uploading new ones adds to existing photos.</p>
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

function initCars() {
  $("#btnAddCar").addEventListener("click", () => openCarModal());
  onSnapshot(query(collection(db, "cars"), orderBy("createdAt", "desc")), snap => {
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
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
      </tr>`).join("") : `<tr><td colspan="7" class="empty-state">No vehicles yet. Add your first one.</td></tr>`;

    $$('[data-feat]').forEach(cb => cb.addEventListener("change", () =>
      updateDoc(doc(db, "cars", cb.dataset.feat), { featured: cb.checked })));
    $$('[data-edit-car]').forEach(b => b.addEventListener("click", () => {
      const car = rows.find(r => r.id === b.dataset.editCar);
      openCarModal(car);
    }));
    $$('[data-del-car]').forEach(b => b.addEventListener("click", async () => {
      if (!confirm("Delete this vehicle listing? This can't be undone.")) return;
      await deleteDoc(doc(db, "cars", b.dataset.delCar));
      toast("Vehicle deleted.");
    }));
  });
}

function openCarModal(car) {
  const overlay = openModal(carFormHTML(car || {}));
  $(".admin-modal-close", overlay).addEventListener("click", () => closeModal(overlay));
  const form = $("#carForm", overlay);
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
      if (files.length) {
        const uploaded = await uploadFiles(files, `cars/${id}`);
        payload.images = [...(car && car.images || []), ...uploaded];
      } else if (car) {
        payload.images = car.images || [];
      }
      await setDoc(doc(db, "cars", id), payload, { merge: true });
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
   BLOG
===================================================================== */
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
        <label>Cover image</label>
        <div class="image-input-list">${post.coverImage?`<img src="${post.coverImage}">`:""}</div>
        <input type="file" name="cover" accept="image/*">
      </div>
      <div class="form-field"><label>Excerpt (short summary)</label><textarea name="excerpt" style="min-height:70px;">${post.excerpt||''}</textarea></div>
      <div class="form-field"><label>Content (basic HTML allowed, e.g. &lt;p&gt;, &lt;h3&gt;, &lt;ul&gt;)</label><textarea name="content" style="min-height:220px;">${post.content||''}</textarea></div>
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
    $("#postsTableBody").innerHTML = rows.length ? rows.map(p => `
      <tr>
        <td><img class="thumb" src="${p.coverImage||''}" onerror="this.style.opacity=0"></td>
        <td>${p.title}</td>
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
  const overlay = openModal(postFormHTML(post || {}));
  $(".admin-modal-close", overlay).addEventListener("click", () => closeModal(overlay));
  const form = $("#postForm", overlay);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
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
      };
      let id = post && post.id;
      if (!id) {
        payload.createdAt = serverTimestamp();
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
   ENQUIRIES  (reply goes out via the admin's own email app — always
   works — or via EmailJS one-click send if configured in Settings)
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
