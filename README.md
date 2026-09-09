# Lucinda — Cake Boutique

A static website for a cake studio. Plain HTML, CSS and JavaScript — no build
step, no dependencies. Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Home — hero, story, signature cakes, how it works, gallery |
| `cakes.html` | Full collection, size &amp; serving guide (`#sizes`), gallery (`#gallery`) |
| `order.html` | Order form with the cake size / serving picker |
| `about.html` | Studio story |
| `contact.html` | Contact details and FAQs |

## Cake sizes and approximate servings

Used on the order form and repeated in the size guide on `cakes.html`:

| Cake | Approximate servings |
| --- | --- |
| 4-inch Bento Cake | 2–4 people |
| 6-inch Cake | 8–12 people |
| 8-inch Cake | 15–20 people |
| 10-inch Cake | 25–35 people |
| Two-tier Cake | 35–50 people |
| Three-tier Cake | 60–100+ people |
| I’m not sure | We’ll recommend the best size. |

To change the list, edit the `.sizes` block in **both** `order.html` and
`cakes.html`.

---

## Placeholders to replace

Three things in this repository are stand-ins, because the source material was
not available when the site was built. Each is isolated so it can be swapped
without touching layout or markup.

### 1. Colour palette

Every colour is derived from a seven-value block at the top of
`assets/css/styles.css`. Nothing else in the stylesheet hard-codes a colour,
so replacing these values re-skins the whole site:

```css
:root {
  --c-cream:  #FBF6F0;  /* page background */
  --c-shell:  #F1E6DC;  /* alternating section background */
  --c-blush:  #E3C8BE;  /* soft accent, borders */
  --c-rose:   #B4796B;  /* primary accent — buttons, links */
  --c-gold:   #A98B5D;  /* secondary accent — rules, eyebrows */
  --c-ink:    #2B2622;  /* headings and primary text */
  --c-muted:  #776C64;  /* body copy */
}
```

The current values are placeholders and should be replaced with the brand
colours from the reference screenshot.

### 2. Logo

`assets/img/logo.svg` is a placeholder monogram. Replace that one file —
keeping the filename — and the header, footer and favicon on every page pick it
up automatically.

### 3. Photography

Every file in `assets/img/` other than `logo.svg` is a generated placeholder
panel, sized to the aspect ratio the layout expects. Replace each with a real
photograph of the same name. `.svg` can be swapped for `.jpg`/`.webp` as long as
the `src` in the markup is updated to match.

| File | Used on | Aspect |
| --- | --- | --- |
| `hero.svg` | Home hero | 16:10, full-bleed |
| `about.svg` | Home + About | 4:5 |
| `workshop.svg` | About | 4:5 |
| `signature-1…3.svg` | Home signature cards | 3:4 |
| `cake-bento`, `cake-celebration`, `cake-wedding`, `cake-cupcakes`, `cake-seasonal`, `cake-bespoke` | Cakes grid | 3:4 |
| `gallery-1…6.svg` | Gallery strips | 1:1 |
| `order-banner.svg` | Contact | 4:5 |

---

## Order form

The site is static, so `assets/js/main.js` validates the form and then hands the
details to the visitor's mail client via `mailto:`. Set the destination address
in `STUDIO_EMAIL` at the top of that block.

To move to a real backend instead, give the `<form>` an `action` and `method`
and delete the submit handler.

## Contact details

Placeholder email (`hello@lucinda.example`), phone and opening hours appear in
the footer of every page and on `contact.html`.
