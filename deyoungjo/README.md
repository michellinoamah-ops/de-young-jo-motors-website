# De Young Jo Motors: Website + Admin Panel

A complete car sales & rental website built as plain HTML/CSS/JS (no build
step) backed by Firebase (Firestore + Storage + Auth). Includes a hidden,
full-featured admin dashboard.

## What's inside

```
index.html                Homepage
cars-for-sale.html        Cars for sale, filterable listing (new + used)
used-cars.html            Used cars only, certified pre-owned listing
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
title, slug, category, coverImage, excerpt, content (HTML string)
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
