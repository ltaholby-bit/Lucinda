# Grace & Co — Cakes & Decor

Static website for Grace & Co, built to the *Grace & Co Website Design &
Development Brief*. Plain HTML, CSS and JavaScript — no build step, no
dependencies, no framework.

```
python3 -m http.server 8000     # then open http://localhost:8000
```

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Home — hero, the two-step guided journey, service cards, how it works, selected work |
| `cakes.html` | Cake portfolio, size &amp; serving guide, simple cake enquiry |
| `decor.html` | Decor portfolio, what we offer, simple decor enquiry |
| `enquiry.html` | "Plan My Celebration" — combined enquiry with conditional cake/decor sections |
| `work.html` | Filterable gallery: all / cakes / cupcakes / decor / full celebrations |
| `ordering.html` | Price guide, deposit &amp; payment, cancellation, collection, delivery, allergens |
| `about.html` | Story and values |
| `contact.html` | Contact details, "Please contact me" form, FAQs |
| `thank-you.html` | Post-submission confirmation (conversion tracking fires here) |
| `privacy.html` | Privacy notice |

## The guided journey

The homepage asks two questions and routes accordingly:

1. **What are you celebrating?** — Birthday, Baby shower, Wedding, Graduation,
   Anniversary, Kids' party, Corporate event, Other.
2. **How can Grace & Co help?**

| Choice | Goes to |
| --- | --- |
| I need a cake | `cakes.html#enquiry` |
| I need decor | `decor.html#enquiry` |
| I need cake and decor | `enquiry.html?need=both` |
| Show me your work | `work.html` |
| Please contact me | `contact.html#contact-me` |

The chosen occasion is carried through as `?occasion=` and pre-selected on the
destination page.

## Conditional form logic

On `enquiry.html`, "What do you need?" controls which blocks appear:

| Selection | Cake questions | Decor questions |
| --- | --- | --- |
| A cake | shown | hidden |
| Decor | hidden | shown |
| Cake and decor | shown | shown |

Hidden blocks are also **disabled**, so their fields are excluded from
validation and from the submitted data — a hidden required field can never
block a submission.

## Required fields

Exactly these are required, and each is marked with a red asterisk. Markers and
enforcement are kept in sync — a browser test asserts the two lists match, so a
field can never *say* required without *being* required:

| Form | Required |
| --- | --- |
| Cake enquiry (`cakes.html`) | Full name, WhatsApp number, Required date |
| Decor enquiry (`decor.html`) | Full name, WhatsApp number, Event date |
| Combined (`enquiry.html`) | Full name, WhatsApp number, What do you need?, and the date for each section shown |
| Please contact me (`contact.html`) | Full name, WhatsApp number |

Everything else is optional, including cake size — every choice list has an
"I'm not sure" option, so a customer is never blocked. Fields inside a hidden
conditional block are disabled and never validated.

## Cake sizes and approximate servings

Shown under each cake label on the enquiry forms, and repeated as a reference
block on `cakes.html#sizes`:

| Cake | Approximate servings |
| --- | --- |
| 4-inch Bento Cake | 2–4 people |
| 6-inch Cake | 8–12 people |
| 8-inch Cake | 15–20 people |
| 10-inch Cake | 25–35 people |
| Two-tier Cake | 35–50 people |
| Three-tier Cake | 60–100+ people |
| I’m not sure | We’ll recommend the best size. |

These are generated from the `CAKE_SIZES` list — to change them, edit the
`.options--sizes` blocks in `cakes.html` and `enquiry.html`.

---

## Configuration

Everything site-specific lives in **`assets/js/config.js`**:

```js
window.GRACE_CONFIG = {
  whatsappNumber: "27000000000",   // international format, digits only
  phone: "+27 (0)00 000 0000",
  email: "hello@graceandco.co.za",
  formEndpoint: "",                // see below
  ga4Id: "",                       // "G-XXXXXXXXXX"
  metaPixelId: "",                 // "123456789012345"
  maxFiles: 3,
  maxFileBytes: 5 * 1024 * 1024
};
```

The WhatsApp button, footer links and contact page all read from here — there
are no hard-coded contact details in the HTML.

### Form submissions — action required

The site is static, so it has no server of its own.

- **`formEndpoint` empty (current state):** forms validate, then open the
  visitor's email client with the answers filled in. **Uploaded images cannot
  be attached this way** — the visitor is told to attach them manually.
- **`formEndpoint` set:** forms POST `multipart/form-data` to that URL,
  including the uploaded images, then redirect to `thank-you.html`. Any backend
  that accepts multipart form posts works (Formspree, Basin, Netlify Forms, or
  your own).

**Set `formEndpoint` before going live** — image upload is a brief requirement
and only works with a backend. Until it is set, each upload box displays a
visible warning telling the customer their pictures are not being delivered
automatically, so nobody is misled into thinking their images arrived.

### Analytics and consent

GA4 and the Meta Pixel load **only** after the visitor accepts the cookie
notice, and only if the corresponding ID is set. With both IDs empty, no
notice appears and no tracking scripts load at all.

A `enquiry_submitted` GA4 event and a Meta `Lead` event fire on each completed
enquiry, tagged with the type (`cake`, `decor`, `both`, `contact`).

For separate campaign links, point ads at:
`enquiry.html?need=cake`, `enquiry.html?need=decor`, `enquiry.html?need=both`.

---

## Brand assets

### Palette

Taken from the supplied palette board. All colours derive from these five
values at the top of `assets/css/styles.css`:

| Name | Hex | Used for |
| --- | --- | --- |
| Linen | `#F5F1EA` | Page background |
| Khaki | `#D7C9B8` | Alternating sections, borders, inputs |
| Camel | `#B2967D` | Rules, eyebrows, decorative accents |
| Cocoa | `#7D5A44` | Buttons, links, selected states |
| Espresso | `#4A342A` | Headings, dark bands, footer |

### Logo

Extracted from the supplied PDF to transparent PNGs:

| File | Where |
| --- | --- |
| `logo-mark.png` | Header, favicon, thank-you page |
| `logo-lockup.png` | Full lockup, gold — for light backgrounds |
| `logo-lockup-light.png` | Full lockup, linen — used in the dark footer |
| `logo-mark-light.png` | Mark in linen — for dark backgrounds |

### Photography — still placeholders

Every `.svg` in `assets/img/` is a generated placeholder panel in the brand
palette, sized to the aspect ratio the layout expects. **These need replacing
with real photographs.** Keep the filename (or update the `src`); `.svg` can
be swapped for `.jpg`/`.webp`.

| File | Used on | Aspect |
| --- | --- | --- |
| `hero.svg` | Home hero | 16:10 full-bleed |
| `service-cakes.svg`, `service-decor.svg` | Home service cards | 4:3 |
| `about.svg`, `studio.svg` | Home, About | 4:5 |
| `cake-1…6.svg` | Cakes portfolio | 3:4 |
| `decor-1…6.svg` | Decor portfolio | 3:4 |
| `work-1…8.svg` | Our Work, home strip | 1:1 |
| `contact-banner.svg` | Contact | 4:5 |

The images from the reference site could not be retrieved — that host is
blocked by the build environment's network policy — so they are not included.

## Search engines and sharing

- **`robots.txt`** allows everything except `thank-you.html` and points to the sitemap.
- **`sitemap.xml`** lists all nine public pages. Regenerate `lastmod` when content changes.
- **`<link rel="canonical">`** on every page, plus `og:url`, `og:image` and
  `twitter:card`. The homepage's canonical is the bare origin, not `/index.html`.
- **Per-page share images**: cakes → a cake, decor → decor, Our Work → gallery,
  About → the studio. No page falls back to a single generic image.

### One hostname

`SITE_URL` in the build script and the canonical tags both use the **non-www**
address. `_redirects` (Netlify/Cloudflare Pages) and `.htaccess` (Apache) send
`www` and `http` traffic there with a 301.

**Change `SITE_URL` (in the generator), `robots.txt`, `sitemap.xml`,
`_redirects` and `.htaccess` together if the real domain differs from
`graceandco.co.za`** — they must all agree or Google will keep seeing two sites.

Google Search Console has to be done by hand: verify the non-www property,
submit `sitemap.xml`, and set the other host as a redirect rather than a
separate property.

## Before going live

- [ ] Replace placeholder photography with real images
- [ ] Set `whatsappNumber`, `phone` and `email` in `config.js`
- [ ] Set `formEndpoint` so enquiries and image uploads are actually delivered
- [ ] Add `ga4Id` and `metaPixelId`
- [ ] Review `privacy.html` against POPIA
- [ ] **Fill in every `R___` price in `ordering.html`** — all are placeholders
- [ ] Confirm the deposit %, cancellation and delivery terms in `ordering.html`
- [ ] Confirm the collection wording: "Melrose, Sandton — collection by appointment only"
- [ ] Add real testimonials (the invented ones were removed; markup is commented in `index.html`)
- [ ] Point `SITE_URL`, `robots.txt`, `sitemap.xml`, `_redirects` and `.htaccess` at the real domain
- [ ] Verify the non-www property in Google Search Console and submit the sitemap
- [ ] Send a real test enquiry from a phone once `formEndpoint` is live, and confirm the images arrive
- [ ] Add spam protection (the form backend's honeypot or captcha)
