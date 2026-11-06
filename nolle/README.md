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
| `/cart` → `/checkout` | Guest checkout: name, phone, email, delivery address. Delivery fee and total are shown **before** paying |
| `/order/<ref>` | Confirmation page: what was bought, payment status, payment deadline, bank details and reference, expected dispatch time vs courier time, then tracking once dispatched |
| `/track` | Clients find their order with reference + phone number |
| `/hair-care`, `/delivery`, `/returns`, `/privacy`, `/contact` | Information pages, editable in admin. Marked “draft” until you confirm them. Only your city/area is shown, never your home address |

### Ordering flow

Choose product → select options → add to cart → enter delivery details → see delivery cost and total → place order → see the confirmation page (and get an email once email is set up) → pay → you mark it paid → dispatched with tracking.

- **Stock goes down as soon as an order is placed**, so two people can't buy the last unit.
- **EFT orders stay “Awaiting payment”** until you confirm the money is in your account. Each order gets a unique reference like `NLH-7KQ2XA` and a payment deadline (24 hours by default).
- If an order isn't paid by the deadline it **expires automatically and its stock is released**. You can give a client 24 more hours from the order page. If money arrives after the order expired, you can still mark it paid, and the stock is taken again if it's still available.
- **Pre-order items** show “Enquire on WhatsApp” instead of “Add to cart”. Paid pre-orders can be added later.
- **Collection** is not offered yet (as requested). It can be added once you confirm the arrangements.

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
- Delivery fee, free-delivery threshold, preparation time and courier time
- Bank details and the payment window in hours
- Hair-care text and all policy pages

**Reviews.** Add only real reviews from real clients.

---

## Going live

Any host that runs Node.js with a **persistent disk** works. Examples are Render (the `render.yaml` at the repo root deploys this folder), Railway, Fly.io, or a small VPS. Static hosts such as Netlify-static or plain cPanel HTML hosting **cannot** run this shop, because it needs a server for stock, orders and admin.

Environment variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `ADMIN_PASSWORD` | **yes** | Your admin password |
| `NODE_ENV` | yes | `production` |
| `BASE_URL` | yes | e.g. `https://nolleluxuryhair.co.za`, used in emails, PayFast and social previews |
| `DATA_DIR` | recommended | Path on the persistent disk, e.g. `/var/data` |
| `SESSION_SECRET` | optional | Long random string. One is generated automatically if not set |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | for emails | Order confirmation / paid / dispatched emails. Without these, emails are skipped and the confirmation page still works |
| `SHOP_NOTIFY_EMAIL` | optional | Where *you* get new-order emails. Defaults to the shop email in Settings |
| `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE` | for card payments | Turns on “Card or Instant EFT (PayFast)” at checkout. Orders are marked paid automatically when PayFast confirms |
| `PAYFAST_SANDBOX` | testing | `1` to use the PayFast sandbox |
| `NO_SAMPLE_PRODUCTS` | optional | `1` = start with an empty shop instead of the 3 sample products |

### Before launch checklist

- [ ] Replace the 3 **sample products** (marked “Sample listing”) with your real stock, photos and prices, or delete them
- [ ] Settings: WhatsApp number, email, area, Instagram/TikTok links
- [ ] Settings: bank details and the delivery fee
- [ ] Upload the homepage photo
- [ ] Review and confirm the delivery, returns and privacy policies, then tick “confirmed”
- [ ] Set up email (SMTP) and, if wanted, PayFast. Run one PayFast sandbox payment
- [ ] Place one real test order on your phone, mark it paid and dispatched, and check the messages arrive

### Automated phone test

`npm run test:phone` runs a complete order on an emulated iPhone 13 using a temporary database. It checks:
- homepage, shop and product pages
- price changes, sold-out blocking and the WhatsApp text
- cart and delivery fee, guest checkout, and the confirmation page
- stock going down, Track Order
- admin: bank details, mark paid, dispatch with tracking, stock/price edits, adding a product with a photo
- unpaid-order expiry

Screenshots are saved to `test/screenshots/`. Playwright must be installed (`npm i -D playwright`).
