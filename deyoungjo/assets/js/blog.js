// =====================================================================
// DE YOUNG JO MOTORS: blog rendering
// Firestore collection: "blogPosts"
// Fields: title, slug, category, coverImage, excerpt, content (html),
//         published (bool), createdAt
// =====================================================================
import { db } from "./firebase-config.js";
import {
  collection, query, where, orderBy, limit as fbLimit, getDocs
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const PLACEHOLDER = "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=900&auto=format&fit=crop";

function fmtDate(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" });
  } catch { return ""; }
}

export function postCardHTML(p) {
  return `
    <article class="car-card">
      <div class="car-card-media">
        <span class="car-tag">${p.category || "News"}</span>
        <img src="${p.coverImage || PLACEHOLDER}" alt="${p.title}" loading="lazy">
      </div>
      <div class="car-card-body">
        <h3><a href="blog-post.html?slug=${encodeURIComponent(p.slug)}">${p.title}</a></h3>
        <p style="margin:0;">${p.excerpt || ""}</p>
        <div class="car-card-foot">
          <a class="btn btn-outline btn-sm" href="blog-post.html?slug=${encodeURIComponent(p.slug)}">Read article</a>
        </div>
        <div class="muted" style="font-size:.78rem;">${fmtDate(p.createdAt)}</div>
      </div>
    </article>`;
}

export async function loadPosts(containerId, take) {
  const el = document.getElementById(containerId);
  if (!el) return [];
  el.innerHTML = `<p class="muted tac" style="grid-column:1/-1;">Loading articles…</p>`;
  try {
    let q = query(collection(db, "blogPosts"), where("published", "==", true), orderBy("createdAt", "desc"));
    if (take) q = query(q, fbLimit(take));
    const snap = await getDocs(q);
    const posts = [];
    snap.forEach(d => posts.push({ id: d.id, ...d.data() }));
    if (!posts.length) {
      el.innerHTML = `<p class="muted tac" style="grid-column:1/-1;">New articles are on the way. Check back soon.</p>`;
      return [];
    }
    el.innerHTML = posts.map(postCardHTML).join("");
    return posts;
  } catch (e) {
    console.error(e);
    el.innerHTML = `<p class="muted tac" style="grid-column:1/-1;">Couldn't load articles right now.</p>`;
    return [];
  }
}

export async function loadPostBySlug(slug) {
  const q = query(collection(db, "blogPosts"), where("slug", "==", slug), where("published", "==", true), fbLimit(1));
  const snap = await getDocs(q);
  let post = null;
  snap.forEach(d => post = { id: d.id, ...d.data() });
  return post;
}

export { fmtDate };
