// =====================================================================
// DE YOUNG JO MOTORS: blog rendering (editorial listing, not cards)
// Firestore collection: "blogPosts"
// Fields: title, slug, category, coverImage, excerpt, content (html),
//         published (bool), createdAt
// Comments live in a separate collection: "blogComments"
// Fields: postId (the post's slug), name, message, status
//         ("pending"|"approved"|"rejected"), createdAt
// =====================================================================
import { db, waLink } from "./firebase-config.js";
import {
  collection, query, where, orderBy, limit as fbLimit, getDocs, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const PLACEHOLDER = "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=900&auto=format&fit=crop";

function fmtDate(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" });
  } catch { return ""; }
}

function readingTime(html) {
  const text = (html || "").replace(/<[^>]*>/g, " ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function featuredHTML(p) {
  return `
    <article class="blog-featured">
      <a href="blog-post.html?slug=${encodeURIComponent(p.slug)}">
        <img src="${p.coverImage || PLACEHOLDER}" alt="${p.title}" loading="lazy">
      </a>
      <div>
        <div class="post-meta">${p.category || "News"}<span class="sep">&middot;</span>${fmtDate(p.createdAt)}<span class="sep">&middot;</span>${readingTime(p.content)} min read</div>
        <h2><a href="blog-post.html?slug=${encodeURIComponent(p.slug)}">${p.title}</a></h2>
        <p class="excerpt muted">${p.excerpt || ""}</p>
        <a class="btn btn-ink" href="blog-post.html?slug=${encodeURIComponent(p.slug)}">Read article</a>
      </div>
    </article>`;
}

function rowHTML(p) {
  return `
    <article class="blog-row">
      <a href="blog-post.html?slug=${encodeURIComponent(p.slug)}">
        <img src="${p.coverImage || PLACEHOLDER}" alt="${p.title}" loading="lazy">
      </a>
      <div>
        <div class="post-meta">${p.category || "News"}<span class="sep">&middot;</span>${fmtDate(p.createdAt)}<span class="sep">&middot;</span>${readingTime(p.content)} min read</div>
        <h3><a href="blog-post.html?slug=${encodeURIComponent(p.slug)}">${p.title}</a></h3>
        <p class="muted">${p.excerpt || ""}</p>
        <a class="read-more" href="blog-post.html?slug=${encodeURIComponent(p.slug)}">Read article &rarr;</a>
      </div>
    </article>`;
}

/** Renders the blog listing as one large featured post + a plain list underneath. */
export async function loadPosts(containerId, take) {
  const el = document.getElementById(containerId);
  if (!el) return [];
  el.innerHTML = `<p class="muted">Loading articles&hellip;</p>`;
  try {
    let q = query(collection(db, "blogPosts"), where("published", "==", true), orderBy("createdAt", "desc"));
    if (take) q = query(q, fbLimit(take));
    const snap = await getDocs(q);
    const posts = [];
    snap.forEach(d => posts.push({ id: d.id, ...d.data() }));
    if (!posts.length) {
      el.innerHTML = `<p class="muted">New articles are on the way. Check back soon.</p>`;
      return [];
    }
    // Compact mode (e.g. homepage/related posts): plain rows, no big featured block.
    if (el.dataset.compact === "true" || take) {
      el.innerHTML = `<div class="blog-list">${posts.map(rowHTML).join("")}</div>`;
      return posts;
    }
    const [first, ...rest] = posts;
    el.innerHTML = featuredHTML(first) + (rest.length ? `<div class="blog-list">${rest.map(rowHTML).join("")}</div>` : "");
    return posts;
  } catch (e) {
    console.error(e);
    el.innerHTML = `<p class="muted">Couldn't load articles right now.</p>`;
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

/* ---------------- Comments ---------------- */

export async function loadComments(slug, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  try {
    const q = query(collection(db, "blogComments"), where("postId", "==", slug), where("status", "==", "approved"));
    const snap = await getDocs(q);
    let comments = [];
    snap.forEach(d => comments.push({ id: d.id, ...d.data() }));
    comments.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    el.innerHTML = comments.length
      ? comments.map(c => `
        <div class="comment-item">
          <span class="who">${c.name || "Anonymous"}</span><span class="when">${fmtDate(c.createdAt)}</span>
          <p style="margin:8px 0 0;">${c.message || ""}</p>
        </div>`).join("")
      : `<p class="muted">No comments yet. Be the first to share your thoughts.</p>`;
  } catch (e) {
    console.error(e);
    el.innerHTML = `<p class="muted">Couldn't load comments right now.</p>`;
  }
}

export function wireCommentForm(formId, statusId, slug, listId) {
  const form = document.getElementById(formId);
  if (!form) return;
  const status = document.getElementById(statusId);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Sending…";
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await addDoc(collection(db, "blogComments"), {
        postId: slug,
        name: data.name || "Anonymous",
        message: data.message || "",
        status: "pending",
        createdAt: serverTimestamp(),
      });
      status.textContent = "Your review or message has been sent for approval.";
      status.className = "form-status show ok";
      form.reset();
    } catch (err) {
      console.error(err);
      status.textContent = "Something went wrong sending your comment. Please try again.";
      status.className = "form-status show err";
    } finally {
      btn.disabled = false; btn.textContent = "Post comment";
    }
  });
}

export { fmtDate, readingTime };
