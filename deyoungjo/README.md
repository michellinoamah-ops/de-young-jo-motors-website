# De Young Jo Motors: Website + Admin Panel

A complete car sales & rental website built as plain HTML/CSS/JS (no build
step) backed by Firebase (Firestore + Storage + Auth). Includes a hidden,
full-featured admin dashboard.

## What's inside

```
index.html                Homepage
cars-for-sale.html        Cars for sale, filterable listing (new + used)
used-cars.html            Used cars only, certified pre-owned listing
spare-parts.html          Spare parts listing, filterable by category/condition
spare-part-details.html   Single spare part page (?id=<partId>)
car-rental.html           Car rental, filterable listing
car-details.html          Single vehicle page (?id=<carId>)
about.html                About us
blog.html                 Blog listing
blog-post.html            Single article (?slug=<slug>)
contact.html              Contact form → Firestore "enquiries"
affiliate.html            Affiliate application form
admin-login.html          Staff sign-in
admin-dashboard.html      Full admin panel (see below)
404.html                  Not found page
PREVIEW.html              Static, no-Firebase-needed visual preview
robots.txt, sitemap.xml   Basic SEO plumbing
assets/css/style.css      Public site design system
assets/css/admin.css      Admin panel styling
assets/img/gallery/       Background/hero photography used across the site
assets/js/*.js            All site + admin logic (ES modules)
assets/js/cart.js         "Add to cart" shortlist (localStorage, no payment)
assets/js/reviews.js      Car star-rating reviews (submit + display)
assets/js/parts.js        Spare parts listing/details rendering
assets/js/part-details.js Spare part details page logic
firebase/firestore.rules
firebase/storage.rules
firebase/firestore.indexes.json
firebase.json             Firebase Hosting + rules config
```

## 1. See it instantly (no setup)

Open `PREVIEW.html` **from inside this extracted folder** (so it sits
next to the `assets` directory). Double-click it or drag it into a
browser tab. It's a static page with sample cars, a sample popup, a
working shortlist cart and WhatsApp buttons, so you can see the exact
look and feel before connecting anything. It uses the real images,
styles and even the real shortlist-cart script from `assets/`, so don't
move it out of the folder on its own or those will 404.

The real site (`index.html` and the rest) needs Firebase connected and at
least some sample data before it looks "full." Steps are below.

## 2. Firebase project setup

Your config is already wired into `assets/js/firebase-config.js`:

```
projectId: "deyoungjo-website"
```

In the [Firebase console](https://console.firebase.google.com) for that
project:

1. **Authentication** → Sign-in method → enable **Email/Password**.
2. **Firestore Database** → Create database (production mode, any region
   close to Nigeria, e.g. `europe-west1` or `us-central1`).
3. **Storage** → Get started (production mode).
4. Deploy the rules in this folder (see step 4), or paste them by hand
   into the console's Rules tab for Firestore and Storage.

## 3. Create your first admin account

The admin panel only trusts a signed-in user if their **uid** has a
matching document in the `admins` collection. Create the first one by
hand (later ones can be added from the dashboard itself):

1. Firebase console → Authentication → Users → **Add user** → enter your
   email + a password.
2. Copy the new user's **UID**.
3. Firestore Database → Start collection → collection ID `admins` →
   document ID = **that UID** → add any field, e.g. `email: "you@x.com"`.
4. Open `admin-login.html` on your site and sign in with that email and
   password.

From then on, use **Settings → Admin users** inside the dashboard to add
teammates without touching the console again.

## 4. Deploy the security rules & indexes

Install the Firebase CLI once (`npm install -g firebase-tools`), then from
this project's root folder:

```bash
firebase login
firebase use deyoungjo-website
firebase deploy --only firestore:rules,firestore:indexes,storage
```

This uploads `firebase/firestore.rules`, `firebase/storage.rules` and the
composite indexes in `firebase/firestore.indexes.json`. Until these are
deployed, reads/writes will be rejected by Firebase's default "locked"
rules, so do this before testing the live site.

If a filtered car search ever throws an "index required" error in the
browser console, click the link Firebase prints there. It creates the
missing index in one click (the common combinations are already predefined
in `firestore.indexes.json`, but new filter combinations you invent later
may need one more).

## 5. Add your first vehicles, blog posts, etc.

Sign in at `admin-login.html`, then from the dashboard:

- **Cars & Rentals** → *Add vehicle* → fill in the details, mark it
  "For sale" or "For rental", upload photos, toggle **Feature on
  homepage** for anything you want in the homepage's featured rows.
- **Blog** → *New post* → title, category, cover image, and content
  (basic HTML tags like `<p>`, `<h3>`, `<ul><li>` are allowed and render
  on the article page).
- **Popups & Offers** → *New popup* → upload an image, write the message,
  set **"Show this many times per visitor"** (e.g. `3`) and toggle it
  active. It will start appearing on the public site automatically. Turn
  it off any time without deleting it, or delete it outright.
- **Settings** → set your public contact email, phone display text,
  showroom address, and paste your **affiliate Google Form link** once
  you have it, and it will appear as a button on the Affiliate page after
  someone applies.

## 6. Hosting the site

Firebase Hosting is the easiest path since everything's already
configured in `firebase.json`:

```bash
firebase deploy --only hosting
```

Or upload this whole folder to any static host (Netlify, Vercel, cPanel,
etc.). It's plain HTML/CSS/JS, nothing to build. Just keep the `assets`
folder alongside the HTML files.

Before going live, update the canonical domain used throughout
`build_pages.py`-generated `<link rel="canonical">` / Open Graph tags and
in `robots.txt` / `sitemap.xml` (currently `www.deyoungjomotors.com`) to
your real domain.

## 7. The hidden admin entrance

There's no visible "Admin" link on the public site. To reach it:

**Click the small dot next to the copyright line in the footer, 5 times
within 3 seconds.** It's the `·` right after "All rights reserved." It's
intentionally subtle. You can also just bookmark `admin-login.html`
directly, which works the same way.

## 8. WhatsApp buttons

Every WhatsApp button/link across the site carries its own pre-filled
message via `data-wa-message="..."`, for example:

| Location | Message sent |
|---|---|
| Floating button (every page) | "Hi De Young Jo Motors, I'm on your website and I'd like some help." |
| Nav bar "WhatsApp" button | Same as above |
| Homepage hero / final CTA | Context-specific opener |
| Each car card | "Hi, I'm interested in the **[Year Brand Model]** listed on your website for **[Price]**. Is it still available?" |
| Each rental card | "Hi, I'd like to rent the **[Year Brand Model]**. Please tell me availability, price per day, and requirements." |
| Car details page | Same as its card, generated from live data |
| Contact page | "Hi De Young Jo Motors, I have an enquiry:" |
| Affiliate page | "Hi, I want to know more about becoming an affiliate with De Young Jo Motors." |
| Blog share button | "I found this article on De Young Jo Motors worth reading: '[Title]'. [link]" |

The number is set once in `assets/js/firebase-config.js`
(`WHATSAPP_NUMBER = "2348062729739"`). Change it there if it ever
changes, and every button across the site updates.

## 9. Replying to contact-page enquiries by email

Messages submitted on `contact.html` land in the **Enquiries** tab of the
dashboard. Click one to expand a reply box with two options:

- **"Open in email app"**: always works, zero setup. It opens your
  default email program with the customer's address, a "Re:" subject and
  your typed reply already filled in; you just hit send.
- **"Send via EmailJS"**: a true one-click send from inside the
  dashboard, no email app needed. Requires a free EmailJS account:
  1. Sign up at [emailjs.com](https://www.emailjs.com/).
  2. Add an **Email Service** (e.g. connect your Gmail).
  3. Create an **Email Template** with variables `{{to_email}}`,
     `{{to_name}}`, `{{subject}}`, `{{reply_message}}`.
  4. Copy the Service ID, Template ID and Public Key into
     **Admin → Settings → Email reply setup**.

Either way, the enquiry is marked "Replied" in the dashboard once sent.

## 10. Affiliate program

`affiliate.html` collects an initial application straight into Firestore
(`affiliateApplications`), visible under **Affiliate Applications** in the
dashboard with a status you can set to pending / approved / rejected.
Once you have your full Google Form (for banking details, agreements,
etc.), paste its link into **Settings → Affiliate onboarding form URL**;
it will appear as a button on the affiliate page.

## 11. SEO notes

- Every public page has a unique title, meta description, canonical URL,
  Open Graph and Twitter card tags.
- The homepage carries `AutoDealer` structured data (schema.org JSON-LD)
  so Google can understand the business type, phone number and services.
- `robots.txt` and `sitemap.xml` are included; update the sitemap's
  domain once you have a real one, and resubmit it in Google Search
  Console after launch.
- Individual car and blog pages are rendered client-side from Firestore
  (`car-details.html?id=...`, `blog-post.html?slug=...`), so they aren't
  in the static sitemap. For most car-dealer sites this is fine because
  people mostly search generic terms ("used Toyota Camry Lagos") and land
  on the listing pages, which are indexable. If you later want every
  individual car/article indexed by name, the next step is moving to a
  framework with server-side rendering (Next.js, Astro, etc.) or adding a
  small Cloud Function that regenerates `sitemap.xml` nightly from
  Firestore. Ask your developer to wire this in when you're ready to
  scale that part.

## 11b. What changed in this revision (based on Autobell/Cars45/Europcar research)

A pass through Autobell Global, Cars45 and Europcar's Lagos rental page
turned up a few conversion patterns worth borrowing, now built in:

- **Sitewide offers banner**: a slim strip above the nav (like Europcar's
  "up to 20% off"). It's powered by the *same* popups collection as the
  modal offers: tick **"Also show as a slim top banner"** on any popup in
  **Admin → Popups**, and it appears sitewide until dismissed for that
  visitor's session, with no separate thing to manage.
- **Homepage quick-search widget**: a booking-style box (Buy/Rent toggle
  + body type + transmission + budget) overlapping the hero, matching
  the search-first pattern every rental site uses. It hands off to the
  Cars for Sale / Car Rental pages with filters pre-applied.
- **"How buying works" + comparison block** on Cars for Sale (mirroring
  Cars45's clear step-by-step + "why us vs the old way" framing).
- **Rental requirements box + FAQ accordion** on Car Rental (documents
  needed, deposit, payment methods, the details Europcar puts front and
  centre) plus FAQs on Contact and Affiliate.
- **Contrast pass**: card surfaces now sit visibly above the page
  background (subtle shadow + a lighter paper tone) instead of blending
  into it, and body text darkened slightly for easier reading.

## 11c. Buy a Car / Used Cars, gallery photos, shortlist cart, WhatsApp nudge

- **Used Cars is now its own page** (`used-cars.html`), separate from
  `cars-for-sale.html`. Both read the same `cars` collection with
  `type: "sale"`. The Used Cars page simply filters out anything with
  `condition: "New"` on the client side, so you manage inventory in one
  place (Admin → Cars & Rentals) and it sorts itself onto the right page
  based on the **Condition** field you set per vehicle. The two pages
  cross-link to each other, and the homepage's quick-search widget now
  has three tabs, **Buy new / Buy used / Rent**, that route to the
  right page with filters pre-applied.
- **Background photography**: the six images you supplied are in
  `assets/img/gallery/` and used as real hero/section backgrounds (not
  base64. Plain `<img>` and CSS `background-image` references are used, so
  they stay easy to swap out later): the blue Porsche on the homepage
  hero, the Land Cruiser on the homepage rental promo and the About
  page, the yellow Audi behind the Cars for Sale page header, the
  stanced white Toyota behind the Used Cars page header, and the BMW
  night shot behind the Car Rental page header.
- **Fonts & colour**: headlines now use **Fraunces** (an elegant serif)
  for a more mature, premium feel, while **Bricolage Grotesque** stays
  for structural UI (buttons, labels, nav) and **Inter** for body text.
  The cream background is deeper and warmer now (`#EBDFC4` instead of a
  pale off-white) so it reads as a deliberate colour rather than a
  default background, with card surfaces sitting visibly above it via a
  soft shadow.
- **"Add to cart" shortlist**: every car card has a small cart icon
  (top-right of the photo). Tapping it saves that car to a shortlist
  stored in the visitor's browser. No payment, no checkout, since cars
  aren't sold online. A floating cart button (bottom-left, mirroring the
  WhatsApp button on the bottom-right) shows how many cars are
  shortlisted; opening it lists them with a single **"Enquire about
  these on WhatsApp"** button that sends one message listing every
  shortlisted car instead of messaging about each one separately.
- **WhatsApp button** now pulses with an outward "ping" ring (not just a
  glow) so it reads as an actionable, tappable element rather than
  static decoration.

## 11d. Physical address & business registration (trust signals)

Real addresses build trust that a phone number alone can't, so both
locations from your signage are now on the site, not just in a settings
field:

- **Footer** (every page): a "Visit us" column with both addresses, and
  the business registration number (RC 7015497) in the footer's bottom
  line.
- **Contact page**: a dedicated "Visit us in person" section with a card
  per office (Head Office and Branch Office), each with a "Get
  directions" link that opens Google Maps already searching for that
  exact address, plus a verified-registration badge. The embedded map
  now points at the Head Office address instead of a generic search.
- **About page**: the same two office cards and registration badge,
  under a "Visit our offices" section.
- **Homepage structured data**: the JSON-LD now carries the real Head
  Office address, the Branch Office as a `department`, and the RC number
  as an `identifier`, so Google can associate the business with a real
  place rather than just a country.

If either address or the RC number ever changes, search for `OFFICES =`
near the top of the site's page-building logic (or, since you'll likely
be handed a finished folder rather than the generator script, do a
find-and-replace for the old address text across `contact.html`,
`about.html` and the shared footer block repeated in every page).

## 11e. Blog redesign, comments, car reviews, rich text editor, notifications

A big update covering six things you asked for together:

- **Blog: modern editorial layout, not cards.** The blog listing now
  shows one large featured post up top (image one side, title and
  excerpt the other) with the rest as a plain scrolling list of rows,
  the way a magazine or newsletter reads rather than a grid of boxes.
  Article pages use larger, more readable typography with an estimated
  reading time next to the date.
- **Rich text editor in Admin → Blog.** The "New post" / "Edit post"
  form now has a real toolbar (Bold, Italic, Underline, headings, text
  colour, highlight colour, alignment, lists, blockquote, links,
  images) instead of a plain text box. It's powered by an open-source
  editor called Quill, loaded from a CDN, no account or extra setup
  needed. What you format is exactly what visitors see on the article
  page.
- **Comments on every blog post.** Visitors can leave a name + comment
  at the bottom of any article. Nothing appears publicly until you
  approve it from **Admin → Reviews & Comments**.
- **Star-rated reviews on every car's page.** Each vehicle's details
  page now has a 1–5 star picker plus a message field, an average
  rating shown at the top, and the same approval flow as comments.
  Whatever the person submits, they immediately see: **"Your review or
  message has been sent for approval."**
- **One moderation queue for both.** Admin → Reviews & Comments lists
  blog comments and car reviews together, newest pending items first.
  Each has **Approve** (goes live immediately), **Reject** (hidden from
  the site but kept on record), and **Delete** (gone for good).
- **Desktop notifications for admin.** The bell button at the top of
  the dashboard turns pop-up notifications on or off. When on, and
  while the dashboard is open in a browser tab, including a
  minimised or background one, you'll get an alert the moment someone
  submits a new enquiry, affiliate application, blog comment, or car
  review. An in-dashboard toast also shows either way, so you won't
  miss anything even before granting the browser permission.

  **Being upfront about the limits of this:** this notifies you while
  the dashboard tab is open somewhere on your device. It cannot wake up
  a fully closed browser or a phone that's locked and not running
  Chrome, because that requires a server-side push service (Firebase
  Cloud Messaging via Cloud Functions), which isn't set up here since
  it needs Firebase's paid Blaze plan. If you outgrow this later, the
  upgrade path is: add a `firebase-messaging-sw.js` service worker,
  request an FCM token per admin device, and write a small Cloud
  Function that triggers on new documents in `enquiries`,
  `blogComments`, `carReviews` and `affiliateApplications` to send that
  push. That's a separate project on top of this one, not something to
  attempt without a developer.

Two new Firestore collections came with this (rules and indexes for
both are already in `firebase/`):

**blogComments**
```
postId (the blog post's slug), name, message
status: "pending" | "approved" | "rejected"
createdAt: timestamp
```

**carReviews**
```
carId, name, rating (1-5), message
status: "pending" | "approved" | "rejected"
createdAt: timestamp
```

## 11f. Spare Parts, and a broader business description

Two more additions layered on top of everything above:

- **Spare Parts is now a full second product line**, not just a mention.
  It has its own listing page (`spare-parts.html`) with filters for
  category, condition and a "search by vehicle" compatibility box, its
  own details page (`spare-part-details.html`) with the same photo
  slideshow and shortlist-cart button the car details page has, and its
  own section in Admin (**Admin → Spare Parts**) with the same
  cover-photo/reorder/remove controls as vehicle photos. It's a
  separate Firestore collection (`spareParts`, documented below), with
  its own security rules and indexes already included. The homepage,
  main navigation, and footer all link to it, and the About page's new
  "What we do" section lists it alongside the rest of the business.
- **The site's description of the business is broader now**, matching
  the fuller scope you described (motor vehicle dealer, spare parts and
  accessories, sourcing and procurement, import and export, dealership
  and agency work, maintenance, servicing, diagnostics and repair).
  This shows up in a few places: the homepage title, meta description
  and hero copy; a new "What we do" section on the About page listing
  all eight service lines; and the homepage's structured data (the
  JSON-LD Google reads), which now lists `AutoDealer`, `AutoPartsStore`
  and `AutoRepair` as business types and includes every service as a
  separate offer, rather than just "cars for sale" and "car rental."

**spareParts**
```
name, category, compatibility, condition ("New"|"Used"|"Refurbished")
price, description, images[]
status: "available" | "out of stock" | "hidden"
featured: boolean
createdAt: timestamp
```

## 11g. Scaling to hundreds of listings, the blog fix, and a crop tool

- **Pagination ("Load more").** Cars for Sale, Used Cars, Car Rental and
  Spare Parts no longer load every matching listing at once, they load
  24 at a time with a **Load more** button beneath the grid. This is
  what makes it practical to list hundreds of vehicles: without it,
  browsing with no filters applied would fetch and render everything in
  the catalogue on every visit, which gets slow and burns through
  Firestore's free daily read quota fast once you're past a hundred or
  so listings. A "Used only" or "max price" filter is applied after
  fetching each batch (Firestore can't combine those with the other
  filters directly), so if a batch of 24 turns up nothing after
  filtering, it automatically fetches the next batch rather than
  showing a false "no results."
- **Admin tables got a search box** (Cars & Rentals, Spare Parts) for
  the same reason: scrolling through hundreds of rows to find one car
  stops being practical fast. Type a brand, model, year, part name or
  category and the table filters instantly; a small note under each
  table shows how many listings matched out of the total.
- **The blog now has a black background**, article pages and the
  listing page both, so long articles read the way a dark, premium
  automotive brand should, rather than switching to a bright page
  partway through the site. If you'd already written posts before this
  update, they'll display correctly now too, nothing needs
  re-typing, unless you specifically picked a dark text colour by hand
  in the editor, more on that below.
- **The admin's article editor now matches that black background.**
  This was the real fix behind "text not showing well": the editor
  used to be a white box, so default (unstyled) text looked fine while
  writing, then turned invisible once published on a black page. The
  editor is dark now, so what you see while writing is what actually
  publishes. If you use the text colour tool, the editor will warn you
  in a note that a dark colour will disappear on the black page, pick
  a light one instead.
- **A crop tool now appears on every photo upload in the dashboard**:
  car photos, spare part photos, popup images, blog cover images, and
  any image inserted inside a blog post's body. Pick a photo and a
  "Crop photo" step appears with Free, Square, 4:3 and 16:9 options
  before it's used, "Skip cropping" uses the original as-is. Images
  inserted into an article body are uploaded to Firebase Storage after
  cropping (not embedded directly in the post), keeping each blog
  post's saved data small.

## 11h. Blog alignment fix, and importing Word documents

- **The real cause of misaligned blog text**: centring or right-aligning
  a paragraph in the editor saved it using a CSS class
  (`ql-align-center`) that only means anything if Quill's own
  stylesheet is loaded to interpret it, and the public blog page never
  loads it. So alignment looked right in the editor and silently
  reverted to plain left-aligned text once published. Alignment now
  saves as real inline CSS instead, so it matches on both sides. This
  fixes it for new edits going forward; if a post written before this
  update used centring or right-alignment, open it, reapply alignment
  to the affected paragraph(s), and save again.
- **Import a Word document (.docx)** straight into a blog post: Admin →
  Blog → Add/Edit post has an "Import from a Word document" field above
  the editor. Headings, bold/italic, bullet and numbered lists, tables
  and embedded images all carry over, images are uploaded to Storage
  during the import rather than saved as base64, keeping the post
  small. It replaces whatever's currently in the editor, so review and
  adjust after importing, then publish as usual. PDFs and the older
  `.doc` format aren't supported, Word can save any document as `.docx`
  first if needed.

## 11i. Large documents, tables, and the blog going back to white

- **The real cause of large imports failing**: every blog post's full
  HTML used to live directly inside its Firestore document, and
  Firestore caps a single document at 1 MiB. A long import, especially
  one with a lot of formatting or several tables, could push right past
  that, and the save would fail outright, which is what "breaks and
  can't show" was. The full article body now lives in Firebase Storage
  instead (one small HTML file per post), with only a link to it kept
  in Firestore. There's no practical size ceiling on that, so a large
  document now saves and displays the same way a short one does. Posts
  saved before this update keep working exactly as they were, nothing
  needed to migrate.
- **Tables now survive both import and manual insertion.** The previous
  gap: Quill has no built-in idea of what a `<table>` is, so one coming
  in from a Word import (or pasted in directly) was quietly discarded
  the moment the editor reconciled the page. Tables are now registered
  as a format Quill preserves as a single unit, so they come through
  from `.docx` imports intact, and there's also a **Table** button on
  the toolbar (next to the image button) for building one from scratch,
  it asks for a row and column count and drops in a plain table you can
  click straight into and start typing.
- **The blog is white again**, both the admin's article editor and the
  published listing and article pages, matching what you asked for.
  Text colour, links, table borders and everything else in that area
  were all switched back to sit correctly on a light background rather
  than the black one from the last update.

## 12. Data model reference (Firestore)

**cars**
```
type: "sale" | "rental"
category, brand, model, year, color
price (sale), rentalPricePerDay (rental)
transmission, fuelType, mileage, condition, location
description, features: string[]
images: string[]  (Storage URLs)
status: "available" | "sold" | "rented" | "unavailable"
featured: boolean
createdAt: timestamp
```

**blogPosts**
```
title, slug, category, coverImage, excerpt
contentUrl: string (the article's full HTML, stored in Firebase Storage;
            older posts may instead have an inline "content" HTML string)
readingTimeMinutes: number
published: boolean
createdAt: timestamp
```

**enquiries**
```
name, email, phone, subject, message
status: "new" | "read" | "replied"
replied: boolean, reply: string
createdAt: timestamp
```

**affiliateApplications**
```
fullName, email, phone, city, platform, audience, message
status: "pending" | "approved" | "rejected"
createdAt: timestamp
```

**popups**
```
title, text, imageUrl, ctaText, ctaLink
maxShows: number   // times shown per visitor's browser
active: boolean
createdAt: timestamp
```

**settings/general** (single document)
```
siteEmail, sitePhone, siteAddress, affiliateFormUrl
emailjsServiceId, emailjsTemplateId, emailjsPublicKey
```

**admins/{uid}**: one doc per admin, document ID = their Firebase Auth
UID. Presence of the document is what makes someone an admin.

## 13. Things to personalize before launch

- Replace the sample testimonials, stats and stock photography with real
  content (search `Sample content` / `placeholder` in the HTML files).
- Update the Google Maps embed on `contact.html` with your real address.
- Add your logo favicon sizes if you want a sharper icon (currently uses
  the PNG logo directly).
- Swap the domain in canonical/OG tags, `robots.txt`, `sitemap.xml`.

Enjoy the new site!