# Nolle’ Luxury Hair — online shop

**YOUR HAIR. YOUR CROWN.**

A simple, working shop for wigs, bundle sets and closures/frontals. Clients can buy straight from a TikTok or Instagram link, check out as a guest, and pay by EFT (or card via PayFast once it's set up). You manage everything from your own admin area.

- Plain Node.js (22.13+) with a built-in SQLite database, and no build step.
- The only package is `nodemailer`, for order emails.
- All data (products, orders, uploaded photos) lives in the `data/` folder. **Back it up.**

```bash
cd nolle
npm install
ADMIN_PASSWORD='choose-a-strong-password' npm start
# shop:  http://localhost:3000
# admin: http://localhost:3000/admin
```

---

## What's on the site

| Page | What it does |
| --- | --- |
| `/` Homepage | Slogan, **Shop Available Hair** button, ready-to-ship products with prices, WhatsApp button, short intro, nationwide-delivery note, “How it works”, real reviews (only shown once you add some) |
| `/shop` | **Ready to Ship** and **Pre-order** in separate sections. Category filters show only categories that have products. Bundle prices say *“for a set of 3 bundles”* |
| `/product/<name>` | Photos and video, price in rands that changes with the option chosen, live stock, texture/length/colour/lace/density/what's included, hair care. A box says plainly whether it's a **complete wig**, a **set of 3 bundles** or a **closure/frontal only**. A WhatsApp button pre-fills the product name, chosen option, price and link |
| `/p/<name>` | Short link for TikTok/Instagram. Opens the exact product |
| `/cart` → `/checkout` | Guest checkout: name, phone, email, then a delivery option (courier, PEP PAXI, local delivery…) with its own fee. Courier/local asks for a street address; PEP PAXI asks for the PEP store. Delivery fee and total are shown **before** paying |
| `/order/<ref>` | Confirmation page: what was bought, payment status, payment deadline, bank details and reference, expected dispatch time vs delivery time for the chosen option, then tracking once dispatched. If bank details aren't on the site, a button asks for them on WhatsApp |
| `/track` | Clients find their order with reference + phone number |
| `/hair-care`, `/delivery`, `/returns`, `/privacy`, `/contact` | Information pages, editable in admin. Marked “draft” until you confirm them. Only your city/area is shown, never your home address |

### Ordering flow

Choose product → select options → add to cart → enter delivery details → see delivery cost and total → place order → see the confirmation page (and get an email once email is set up) → pay → you mark it paid → dispatched with tracking.

- **Stock goes down as soon as an order is placed**, so two people can't buy the last unit.
- **EFT orders stay “Awaiting payment”** until you confirm the money is in your account. Each order gets a unique reference like `NLH-7KQ2XA` and a payment deadline (24 hours by default).
- If an order isn't paid by the deadline it **expires automatically and its stock is released**. You can give a client 24 more hours from the order page. If money arrives after the order expired, you can still mark it paid, and the stock is taken again if it's still available.
- **Pre-order items** show **“Confirm My Pre-Order on WhatsApp”** instead of “Add to cart”, with the line “We’ll confirm availability, your final total and your estimated dispatch date before you pay.” Beside the button: *Before dispatch* (the range’s lead time) and *After dispatch* (the chosen delivery option; PEP PAXI is collected at the client’s chosen PEP point).
- **While everything is pre-order**, the homepage says so: the main button is **Shop Pre-Orders**, “How it works” explains the WhatsApp steps (choose hair and delivery → send on WhatsApp → we confirm availability, total and dispatch estimate → pay to confirm), and the “Ready to Ship” section only appears once a product is ready to ship with stock.
- **Delivery only, no collection.** Delivery options (courier, PEP PAXI, local delivery) each have their own fee and are set in *Settings*. An option with no fee is hidden from clients.
- **WhatsApp orders:** pre-order product pages let the client choose a delivery option too, so the WhatsApp message includes the product, options, price, delivery and total with delivery.

### The catalogue

The shop starts with 16 products from the three price lists (`lib/catalogue.js`). All are **Pre-order**, with **7–10 working days before dispatch** (after payment):

| Range | Products | Options |
| --- | --- | --- |
| Raw Indian Hair | Straight & Wavy bundles, Curly bundles, HD closure (5x5/6x6), HD frontal (13x4/13x6) | Texture, size, length. Curly closures/frontals +R87 |
| Premium Virgin | Straight bundles, Curly bundles, 4x4 closure, 13x4 frontal, 5x5 & HD closures | Texture/size, length. Lead time 7–10 working days |
| SDD Indian | Bundles (straight, bouncy curl, Caribbean curl +R43/bundle), HD closure, HD frontal | Texture/size, length |
| **Best seller: 3 bundles + 13x4 frontal** | One product: choose Raw Indian, Premium Virgin or SDD Indian, texture and length | One total = 3 × bundle + frontal (curly Raw frontal +R87) |
| **Sets: 3 bundles + matching closure** | Raw Indian + 5x5 HD closure; Premium Virgin + 4x4 closure; SDD Indian + 5x5 HD closure | Texture, length (bundles and closure the same length). One total = 3 × bundle + closure; the breakdown is in a collapsed section |

- Bundles are priced as a **set of 3 bundles of the same length**. Where a price list gives a per-bundle price, the set price is 3 × that price. Single-bundle prices are in a collapsed “Single-bundle prices” section on each bundle page (editable in the admin as “Extra prices”), and clients are invited to ask on WhatsApp for mixed lengths.
- **Wig making** is offered on all sets: clients choose “Yes – make it into a wig”. Set the fee and time in Settings → Wig-making service; with no fee the WhatsApp message asks for a quote. Tick “Offer the wig-making service” on any other product to offer it there too.
- Combinations that are not on a price list (e.g. 13x4 HD frontal in 24") are greyed out.
- When you have hair in hand, open the product in the admin, change it to **Ready to ship** and enter the stock. It then moves to “Ready to Ship” with an Add to cart button.

---

## Your admin (`/admin`)

Log in with the `ADMIN_PASSWORD` set on the server. The admin also has a **Help** page that explains these steps.

**Add a product.** Go to *Products → + Add product*.
1. Choose the **category** (it sets the “what you're buying” label) and **Ready to ship** or **Pre-order**.
2. Fill in texture, colour, lace, density and what's included.
3. Under *Options, prices & stock*, leave the option name as “Length” and add one row per length with its **price** and **stock**. For bundle sets the price is for all 3 bundles.
4. Upload photos (the first one is the main photo) and an optional short video, then save.

**Change prices or update stock.** Use *Stock & prices*: one screen with every option. Edit the numbers and press Save.

**View orders and payment status.** Use *Orders*. Tabs filter by status (Awaiting payment, Paid – to dispatch, Dispatched, and so on), and you can search by reference, name, phone or email.
- Open an order and press **Mark as paid** only once the money reflects in your account.
- One-tap WhatsApp messages are ready for: payment reminder, payment received, and tracking sent.

**Mark as dispatched.** On a paid order, enter the courier, tracking number and (optionally) tracking link, then press **Mark as dispatched**. The client's order page updates straight away.

**Social links.** On *Products*, press **Copy link** next to a product and paste it into your TikTok/Instagram bio, story link sticker or comments.
- Add `?src=tiktok` or `?src=instagram` to see on each order where the client came from.
- Add `?v=<option id>` to open a specific length.

**Settings** covers:
- WhatsApp number, email, Instagram/TikTok links and the area shown publicly
- Homepage photo, slogan and intro
- Delivery options: name, fee, delivery time and whether the client gives a street address or a PEP store (PAXI point); free-delivery threshold; preparation and pre-order lead times
- Bank details and the payment window in hours
- Hair-care text and all policy pages

**Reviews.** Add only real reviews from real clients.

---

## Going live

**On your cPanel hosting (nolleluxuryhair.co.za):** follow [DEPLOY-CPANEL.md](DEPLOY-CPANEL.md) step by step.


Any host that runs Node.js with a **persistent disk** works. Examples are Render (the `render.yaml` at the repo root deploys this folder), Railway, Fly.io, or a small VPS. Static hosts such as Netlify-static or plain cPanel HTML hosting **cannot** run this shop, because it needs a server for stock, orders and admin.

Environment variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `ADMIN_PASSWORD` | **yes** | Your admin password |
| `NODE_ENV` | yes | `production` |
| `BASE_URL` | yes | `https://nolleluxuryhair.co.za`, used in emails, PayFast, links and social previews |
| `DATA_DIR` | recommended | Path on the persistent disk, e.g. `/var/data` |
| `SESSION_SECRET` | optional | Long random string. One is generated automatically if not set |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | for emails | Order confirmation / paid / dispatched emails. Without these, emails are skipped and the confirmation page still works |
| `SHOP_NOTIFY_EMAIL` | optional | Where *you* get new-order emails. Defaults to the shop email in Settings |
| `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE` | for card payments | Turns on “Card or Instant EFT (PayFast)” at checkout. Orders are marked paid automatically when PayFast confirms |
| `PAYFAST_SANDBOX` | testing | `1` to use the PayFast sandbox |
| `NO_SAMPLE_PRODUCTS` | optional | `1` = start with an empty shop instead of loading the price-list catalogue |

### Before launch checklist

- [ ] Check the 12 catalogue products and prices (loaded from the Raw Indian, Premium Virgin and SDD Indian price lists)
- [ ] Switch any hair you physically have to **Ready to ship** and enter its stock, so clients can buy it online
- [ ] Add close-up photos of each product (lace, wefts, hair on a stand) if you have them
- [ ] Settings: WhatsApp number, email, area, Instagram/TikTok links
- [ ] Settings: confirm the courier fee (R120) and enter the PEP PAXI fee (and local delivery fee, if offered)
- [ ] Bank details: either add them in Settings, or leave them out and send them to clients on WhatsApp (the order page has a “Get bank details on WhatsApp” button)
- [ ] Upload the homepage photo
- [ ] Review and confirm the delivery, returns and privacy policies, then tick “confirmed”
- [ ] Set up email (SMTP) and, if wanted, PayFast. Run one PayFast sandbox payment
- [ ] Place one real test order on your phone, mark it paid and dispatched, and check the messages arrive

### Automated phone test

`npm run test:catalogue` checks the real catalogue on a phone: prices (set of 3 = 3 × per-bundle), the +R87 curly and +R43 Caribbean-curl surcharges, combinations that are not on the price lists (greyed out), lead times and the WhatsApp message.

`npm run test:phone` runs a complete order on an emulated iPhone 13 using a temporary database and test stock (`SEED_FIXTURES=test`). It checks:
- homepage, shop and product pages
- price changes, sold-out blocking and the WhatsApp text
- cart and delivery fee, courier vs PEP PAXI at checkout, guest checkout, and the confirmation page
- stock going down, Track Order
- admin: bank details, mark paid, dispatch with tracking, stock/price edits, adding a product with a photo
- unpaid-order expiry

Screenshots are saved to `test/screenshots/`. Playwright must be installed (`npm i -D playwright`).
