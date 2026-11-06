'use strict';
const path = require('node:path');
const fs = require('node:fs');
let DatabaseSync;
try { ({ DatabaseSync } = require('node:sqlite')); } catch (e) {
  throw new Error(`This shop needs Node.js 22.13 or newer (built-in SQLite). This server runs Node ${process.version}. In cPanel → Setup Node.js App, choose Node.js 22 or newer.`);
}
const { randomRef, randomToken } = require('./util');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'shop.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,              -- wigs | bundles | closures
  availability TEXT NOT NULL DEFAULT 'ready', -- ready | enquire
  short TEXT DEFAULT '',
  description TEXT DEFAULT '',
  texture TEXT DEFAULT '',
  colour TEXT DEFAULT '',
  length TEXT DEFAULT '',
  lace TEXT DEFAULT '',
  density TEXT DEFAULT '',
  includes TEXT DEFAULT '',
  care TEXT DEFAULT '',
  option_names TEXT DEFAULT '[]',      -- e.g. ["Length"]
  images TEXT DEFAULT '[]',            -- ["/uploads/abc.jpg", ...]
  video TEXT DEFAULT '',
  featured INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  is_sample INTEGER DEFAULT 0,
  sort INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS variants (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  options TEXT DEFAULT '{}',           -- {"Length":"20\\""}
  price_cents INTEGER NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  sku TEXT DEFAULT '',
  sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  ref TEXT UNIQUE NOT NULL,
  token TEXT NOT NULL,
  status TEXT NOT NULL,                -- awaiting_payment | paid | dispatched | delivered | cancelled | expired
  payment_method TEXT NOT NULL,        -- eft | card
  name TEXT, phone TEXT, email TEXT,
  address1 TEXT, address2 TEXT, suburb TEXT, city TEXT, province TEXT, postal_code TEXT,
  notes TEXT DEFAULT '',
  subtotal_cents INTEGER, delivery_cents INTEGER, total_cents INTEGER,
  payment_deadline TEXT,
  paid_at TEXT, dispatched_at TEXT, delivered_at TEXT, cancelled_at TEXT,
  courier TEXT DEFAULT '', tracking_number TEXT DEFAULT '', tracking_url TEXT DEFAULT '',
  stock_held INTEGER DEFAULT 1,
  admin_note TEXT DEFAULT '',
  source TEXT DEFAULT '',
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER, variant_id INTEGER,
  product_name TEXT, variant_label TEXT, kind_label TEXT,
  unit_cents INTEGER, qty INTEGER
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL, text TEXT NOT NULL, rating INTEGER DEFAULT 5,
  product_id INTEGER, source TEXT DEFAULT '', visible INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`);

if (!db.prepare('PRAGMA table_info(products)').all().some((c) => c.name === 'lead_time')) {
  db.exec("ALTER TABLE products ADD COLUMN lead_time TEXT DEFAULT ''");
}

for (const [col, def] of [['delivery_method', "TEXT DEFAULT ''"], ['delivery_type', "TEXT DEFAULT 'address'"], ['delivery_time', "TEXT DEFAULT ''"], ['paxi_point', "TEXT DEFAULT ''"]]) {
  if (!db.prepare('PRAGMA table_info(orders)').all().some((c) => c.name === col)) db.exec(`ALTER TABLE orders ADD COLUMN ${col} ${def}`);
}

/* ---------------- Settings ---------------- */
/* Delivery options. A fee of '' means "not offered yet" (hidden from clients).
   type 'address' asks for a street address; 'paxi' asks for a PEP store (PAXI point). */
const DEFAULT_DELIVERY_METHODS = [
  { id: 'courier', name: 'Courier to your door', fee: '12000', time: '2–4 business days', type: 'address' },
  { id: 'paxi', name: 'PEP PAXI (collect at a PEP store)', fee: '6000', time: '', type: 'paxi' },
  { id: 'local', name: 'Local delivery (Johannesburg)', fee: '', time: '', type: 'address' },
];
const DEFAULT_SETTINGS = {
  shop_name: 'Nolle’ Luxury Hair',
  slogan: 'YOUR HAIR. YOUR CROWN.',
  intro: 'Nolle’ Luxury Hair offers premium wigs, bundle sets and closures, carefully selected for softness, fullness and natural movement. Every order is checked and packed by hand, and we deliver nationwide across South Africa.',
  whatsapp: '27616029381',
  email: 'info@graceandcompanies.co.za',
  phone_display: '+27 61 602 9381',
  location: 'Melrose / Sandton, Johannesburg',
  instagram: 'https://www.instagram.com/noelleluxury',
  tiktok: 'https://www.tiktok.com/@n.luxury.hair',
  hero_image: '',
  delivery_methods: JSON.stringify(DEFAULT_DELIVERY_METHODS),
  free_delivery_over_cents: '0',
  prep_time: '1–2 business days',
  courier_name: 'Courier',
  preorder_time: 'Confirmed when you order',
  payment_hours: '24',
  bank_name: '', bank_account_name: '', bank_account_number: '', bank_branch_code: '', bank_account_type: '',
  policies_confirmed: '0',
  care_default: `- Detangle gently from the ends upwards with a wide-tooth comb.
- Wash with a sulphate-free shampoo and conditioner every 7–10 wears.
- Let the hair air-dry; use heat protectant before any styling tools.
- Sleep with a satin bonnet or on a satin pillowcase.
- Store wigs on a wig stand or in the satin bag provided.`,
  policy_delivery: `## Delivery across South Africa
We deliver nationwide. Choose the option that suits you at checkout; the fee is shown before you pay.

{delivery_options}

## How long it takes
- Preparing your order: {prep_time} after payment is confirmed.
- Delivery: the time shown for your delivery option, after dispatch (main centres are usually quicker; outlying areas may take longer).

## Tracking
Once your order is dispatched we will send you the courier name and tracking number. You can also check your order at any time on our Track Order page.

## Pre-orders
Full payment is required to confirm a pre-order. Pre-order lead times are shown on each product (for example 7–10 working days for our Premium Virgin collection), plus delivery time. Wig making requires additional preparation time; your completion date will be confirmed when you order.

## PEP PAXI
Choose PEP PAXI to have your parcel sent to the PEP store (PAXI point) of your choice. You collect it there once you receive the PAXI SMS.

## Collection
Delivery only – we do not offer collection.`,
  policy_returns: `## Returns and refunds (DRAFT – to be confirmed)
For hygiene reasons hair that has been worn, cut, coloured, washed, or had the lace cut cannot be returned.

- If your order arrives damaged or is not what you ordered, contact us within 48 hours of delivery with photos.
- Unused hair in its original packaging, with the lace uncut, may be returned within 7 days of delivery. The return courier fee is for the client's account unless the item is faulty.
- Approved refunds are paid by EFT within 7 business days of receiving the returned item.

Your rights under the Consumer Protection Act are not affected.`,
  policy_privacy: `## Your privacy (DRAFT – to be confirmed)
We collect your name, phone number, email address and delivery address only to process and deliver your order and to contact you about it.

- We share your delivery details with our courier so they can deliver your order.
- Card payments are handled securely by our payment provider; we never see or store your card number.
- We do not sell your information or send marketing messages without your consent.
- You may ask us to see, correct or delete your information at any time, in line with the Protection of Personal Information Act (POPIA).`,
  policy_haircare: `## Caring for your hair
Good care keeps your hair soft and full for longer.

{care_default}

## Wigs
- Avoid heavy oils and products on the lace.
- Remove your wig before swimming in chlorine or salt water.

## Bundles, closures and frontals
- Do not rub the wefts or lace while washing; let water flow downwards.
- Avoid pulling at the weft when styling.`,
};

const getSettingStmt = db.prepare('SELECT key, value FROM settings');
const setSettingStmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
const hadMethods = !!db.prepare("SELECT 1 FROM settings WHERE key = 'delivery_methods'").get();
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(k, v);
}
/* Databases from before delivery options: keep the old single fee and time as the courier option. */
if (!hadMethods) {
  const old = (k) => (db.prepare('SELECT value FROM settings WHERE key = ?').get(k) || {}).value;
  if (old('delivery_fee_cents') != null) {
    setSettingStmt.run('delivery_methods', JSON.stringify(DEFAULT_DELIVERY_METHODS.map((m) => (m.id === 'courier'
      ? { ...m, fee: String(old('delivery_fee_cents')), time: old('courier_time') || m.time } : m))));
  }
}

/* Upgrade databases created before the real contact details were known:
   replace a value only if it is still the old placeholder. */
const OLD_PLACEHOLDERS = { whatsapp: '27000000000', email: 'hello@example.co.za', phone_display: '', location: 'South Africa', instagram: '', tiktok: '' };
for (const [k, old] of Object.entries(OLD_PLACEHOLDERS)) {
  db.prepare('UPDATE settings SET value = ? WHERE key = ? AND value = ?').run(DEFAULT_SETTINGS[k], k, old);
}
function getSettings() {
  const s = { ...DEFAULT_SETTINGS };
  for (const r of getSettingStmt.all()) s[r.key] = r.value;
  return s;
}
function setSetting(k, v) { setSettingStmt.run(k, String(v ?? '')); }

/* ---------------- Products ---------------- */
const CATEGORIES = {
  wigs: { label: 'Wigs', kind: 'Complete wig', kindLong: 'You are buying a complete, ready-to-wear wig.' },
  bundles: { label: 'Bundle Sets', kind: 'Set of 3 bundles', kindLong: 'You are buying a set of THREE bundles. The price shown is for all three. Closure/frontal not included.' },
  closures: { label: 'Closures & Frontals', kind: 'Closure / frontal only', kindLong: 'You are buying the closure or frontal on its own. Bundles are not included.' },
};

function hydrateProduct(p) {
  if (!p) return null;
  p.option_names = safeJSON(p.option_names, []);
  p.images = safeJSON(p.images, []);
  p.variants = db.prepare('SELECT * FROM variants WHERE product_id = ? ORDER BY sort, id').all(p.id)
    .map((v) => ({ ...v, options: safeJSON(v.options, {}) }));
  const prices = p.variants.map((v) => v.price_cents);
  p.min_price = prices.length ? Math.min(...prices) : 0;
  p.max_price = prices.length ? Math.max(...prices) : 0;
  p.total_stock = p.variants.reduce((a, v) => a + Math.max(0, v.stock), 0);
  p.sold_out = p.availability === 'ready' && p.total_stock <= 0;
  p.cat = kindFor(p.category, p.name);
  return p;
}
/* Closures and frontals share a category but are labelled separately. */
function kindFor(category, name) {
  const c = CATEGORIES[category] || { label: category, kind: '', kindLong: '' };
  if (category !== 'closures') return c;
  const frontal = /frontal/i.test(name || '');
  const w = frontal ? 'frontal' : 'closure';
  return { ...c, kind: frontal ? 'Frontal only' : 'Closure only', kindLong: `You are buying the ${w} on its own. Bundles are not included.` };
}
function usedCategories() {
  const used = new Set(db.prepare('SELECT DISTINCT category FROM products WHERE active = 1').all().map((r) => r.category));
  return Object.keys(CATEGORIES).filter((k) => used.has(k));
}
function safeJSON(s, d) { try { return JSON.parse(s); } catch { return d; } }

function listProducts({ activeOnly = true } = {}) {
  const rows = db.prepare(`SELECT * FROM products ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY sort, id DESC`).all();
  return rows.map(hydrateProduct);
}
const getProductBySlug = (slug) => hydrateProduct(db.prepare('SELECT * FROM products WHERE slug = ?').get(slug));
const getProduct = (id) => hydrateProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id));

function variantLabel(product, variant) {
  const parts = (product.option_names || []).map((n) => variant.options[n]).filter(Boolean);
  return parts.join(' · ');
}

/* ---------------- Orders & stock ---------------- */
function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

class ShopError extends Error {}

/* Takes stock for every item of an order. Must be called inside tx(). */
function takeStock(items) {
  for (const it of items) {
    const v = db.prepare('SELECT v.stock, p.availability, p.name FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?').get(it.variant_id);
    if (!v) throw new ShopError('A product in the order no longer exists.');
    if (v.stock < it.qty) throw new ShopError(`Sorry, “${it.product_name}${it.variant_label ? ' – ' + it.variant_label : ''}” only has ${Math.max(0, v.stock)} left.`);
  }
  for (const it of items) db.prepare('UPDATE variants SET stock = stock - ? WHERE id = ?').run(it.qty, it.variant_id);
}
function returnStock(orderId) {
  const items = db.prepare('SELECT variant_id, qty FROM order_items WHERE order_id = ?').all(orderId);
  for (const it of items) db.prepare('UPDATE variants SET stock = stock + ? WHERE id = ?').run(it.qty, it.variant_id);
  db.prepare('UPDATE orders SET stock_held = 0 WHERE id = ?').run(orderId);
}

/* Delivery options clients can choose (only those with a fee, unless all = true). */
function deliveryMethods(settings, { all = false } = {}) {
  let list = safeJSON(settings.delivery_methods, null);
  if (!Array.isArray(list)) list = DEFAULT_DELIVERY_METHODS;
  return list.map((m) => {
    const fee = m.fee === '' || m.fee == null ? NaN : parseInt(m.fee, 10);
    return {
      id: String(m.id || ''), name: String(m.name || ''), type: m.type === 'paxi' ? 'paxi' : 'address',
      time: String(m.time || ''), fee: Number.isFinite(fee) && fee >= 0 ? fee : null,
    };
  }).filter((m) => m.id && m.name && (all || m.fee != null));
}
function deliveryFor(subtotal, settings, methodId) {
  const method = deliveryMethods(settings).find((m) => m.id === methodId) || null;
  if (!method) return { method: null, fee: 0 };
  const freeOver = parseInt(settings.free_delivery_over_cents, 10) || 0;
  return { method, fee: freeOver > 0 && subtotal >= freeOver ? 0 : method.fee };
}

/* Resolve cart lines [{variant_id, qty}] against the database. */
function priceCart(lines) {
  const items = [];
  for (const line of lines || []) {
    const vid = parseInt(line.variant_id ?? line.v, 10);
    const qty = Math.max(1, Math.min(20, parseInt(line.qty ?? line.q, 10) || 1));
    const row = db.prepare('SELECT v.*, p.name, p.slug, p.category, p.availability, p.active, p.images, p.option_names FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?').get(vid);
    if (!row) continue;
    const product = { option_names: safeJSON(row.option_names, []) };
    const variant = { options: safeJSON(row.options, {}) };
    items.push({
      variant_id: row.id, product_id: row.product_id, slug: row.slug,
      product_name: row.name, variant_label: variantLabel(product, variant),
      kind_label: kindFor(row.category, row.name).kind,
      category: row.category,
      unit_cents: row.price_cents, qty, stock: row.stock,
      purchasable: row.active === 1 && row.availability === 'ready',
      image: safeJSON(row.images, [])[0] || '',
    });
  }
  const subtotal = items.reduce((a, i) => a + i.unit_cents * i.qty, 0);
  return { items, subtotal };
}

function createOrder(input, settings) {
  return tx(() => {
    const { items, subtotal } = priceCart(input.lines);
    if (!items.length) throw new ShopError('Your cart is empty.');
    const bad = items.find((i) => !i.purchasable);
    if (bad) throw new ShopError(`“${bad.product_name}” is not available to buy online. Please enquire on WhatsApp.`);
    const d = deliveryFor(subtotal, settings, input.delivery_method_id);
    if (!d.method) throw new ShopError('Please choose a delivery option.');
    const delivery = d.fee;
    takeStock(items);
    const hours = parseInt(settings.payment_hours, 10) || 24;
    const deadline = new Date(Date.now() + hours * 3600e3).toISOString();
    let ref;
    do { ref = randomRef(); } while (db.prepare('SELECT 1 FROM orders WHERE ref = ?').get(ref));
    const r = db.prepare(`INSERT INTO orders (ref, token, status, payment_method, name, phone, email, address1, address2, suburb, city, province, postal_code, notes, subtotal_cents, delivery_cents, total_cents, payment_deadline, source, delivery_method, delivery_type, delivery_time, paxi_point)
      VALUES (?, ?, 'awaiting_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      ref, randomToken(), input.payment_method, input.name, input.phone, input.email,
      input.address1, input.address2, input.suburb, input.city, input.province, input.postal_code,
      input.notes || '', subtotal, delivery, subtotal + delivery, deadline, input.source || '',
      d.method.name, d.method.type, d.method.time, input.paxi_point || '');
    const orderId = Number(r.lastInsertRowid);
    const ins = db.prepare('INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_label, kind_label, unit_cents, qty) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const i of items) ins.run(orderId, i.product_id, i.variant_id, i.product_name, i.variant_label, i.kind_label, i.unit_cents, i.qty);
    return getOrder(orderId);
  });
}

function getOrder(id) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (o) o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  return o || null;
}
function getOrderByRef(ref) {
  const o = db.prepare('SELECT id FROM orders WHERE ref = ?').get(String(ref || '').toUpperCase().trim());
  return o ? getOrder(o.id) : null;
}

/* Status changes. Each returns the updated order. */
function markPaid(id) {
  return tx(() => {
    const o = getOrder(id);
    if (!o) throw new ShopError('Order not found.');
    if (['paid', 'dispatched', 'delivered'].includes(o.status)) return o;
    if (!o.stock_held) { // stock was released when it expired/cancelled: take it again
      takeStock(o.items);
      db.prepare('UPDATE orders SET stock_held = 1 WHERE id = ?').run(id);
    }
    db.prepare("UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return getOrder(id);
  });
}
function markDispatched(id, { courier, tracking_number, tracking_url }) {
  db.prepare("UPDATE orders SET status = 'dispatched', dispatched_at = ?, courier = ?, tracking_number = ?, tracking_url = ? WHERE id = ?")
    .run(new Date().toISOString(), courier || '', tracking_number || '', tracking_url || '', id);
  return getOrder(id);
}
function markDelivered(id) {
  db.prepare("UPDATE orders SET status = 'delivered', delivered_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  return getOrder(id);
}
function cancelOrder(id, status = 'cancelled') {
  return tx(() => {
    const o = getOrder(id);
    if (!o) throw new ShopError('Order not found.');
    if (o.stock_held) returnStock(id);
    db.prepare('UPDATE orders SET status = ?, cancelled_at = ? WHERE id = ?').run(status, new Date().toISOString(), id);
    return getOrder(id);
  });
}
function extendDeadline(id, hours) {
  const o = getOrder(id);
  const base = Math.max(Date.now(), new Date(o.payment_deadline).getTime());
  db.prepare('UPDATE orders SET payment_deadline = ? WHERE id = ?').run(new Date(base + hours * 3600e3).toISOString(), id);
  return getOrder(id);
}

/* Unpaid orders past their deadline release their stock so others can buy it. */
function expireUnpaid() {
  const now = new Date().toISOString();
  const due = db.prepare("SELECT id FROM orders WHERE status = 'awaiting_payment' AND payment_deadline < ?").all(now);
  for (const { id } of due) cancelOrder(id, 'expired');
  return due.length;
}

/* ---------------- Seed sample products (first run only) ---------------- */
function insertProducts(list, isSample) {
  list.forEach((s, i) => {
    const r = db.prepare(`INSERT INTO products (slug, name, category, availability, short, description, texture, colour, lace, density, includes, lead_time, option_names, images, featured, is_sample, sort)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      s.slug, s.name, s.category, s.availability, s.short || '', s.description || '', s.texture || '', s.colour || '', s.lace || '', s.density || '',
      s.includes || '', s.lead_time || '', JSON.stringify(s.option_names), JSON.stringify(s.images), s.featured ? 1 : 0, isSample ? 1 : 0, i);
    s.variants.forEach((v, j) => {
      const [opts, price, stock] = Array.isArray(v) ? v : [v.options, v.price, v.stock || 0];
      db.prepare('INSERT INTO variants (product_id, options, price_cents, stock, sort) VALUES (?, ?, ?, ?, ?)')
        .run(Number(r.lastInsertRowid), JSON.stringify(opts), price, stock, j);
    });
  });
}

const OLD_SAMPLE_SLUGS = ['body-wave-13x4-frontal-wig', 'straight-bundle-set', 'deep-wave-5x5-hd-closure'];
const TEST_FIXTURES = process.env.SEED_FIXTURES === 'test';

function seed() {
  const { CATALOGUE } = require('./catalogue');
  if (!TEST_FIXTURES) {
    // Remove the original placeholder products, if this database still has them.
    db.prepare(`DELETE FROM products WHERE is_sample = 1 AND slug IN (${OLD_SAMPLE_SLUGS.map(() => '?').join(',')})`).run(...OLD_SAMPLE_SLUGS);
    const have = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
    if (have === 0 && process.env.NO_SAMPLE_PRODUCTS !== '1') insertProducts(CATALOGUE, false);
    return;
  }
  if (db.prepare('SELECT COUNT(*) AS n FROM products').get().n > 0) return;
  /* Test fixtures: ready-to-ship stock so the automated phone test can buy. */
  const samples = [
    {
      slug: 'body-wave-13x4-frontal-wig', name: 'Body Wave 13x4 HD Frontal Wig', category: 'wigs', availability: 'ready', featured: 1,
      short: 'Soft, bouncy body wave on a 13x4 HD lace frontal. Pre-plucked and ready to wear.',
      description: 'A glamorous everyday body wave with natural movement and a soft, melt-in HD lace frontal. Pre-plucked hairline with baby hair, adjustable strap and combs for a secure fit.',
      texture: 'Body wave', colour: 'Natural black (1B)', lace: '13x4 HD lace frontal', density: '180%',
      includes: 'Complete wig, adjustable strap, 4 combs, satin storage bag', option_names: ['Length'],
      images: ['/static/img/brand/wavy-black-portrait.jpg', '/static/img/brand/duo-curly-and-wavy.jpg', '/static/img/brand/backs-curly-and-wavy.jpg'],
      variants: [[{ Length: '18"' }, 320000, 2], [{ Length: '20"' }, 360000, 1], [{ Length: '24"' }, 430000, 0]],
    },
    {
      slug: 'straight-bundle-set', name: 'Silky Straight Bundle Set', category: 'bundles', availability: 'ready', featured: 1,
      short: 'Three silky straight bundles. Price is for the full set of 3.',
      description: 'Silky, full-bodied straight bundles that blend beautifully with relaxed or pressed leave-out. Sold as a set of three bundles.',
      texture: 'Silky straight', colour: 'Natural black (1B)', lace: '', density: '',
      includes: '3 bundles (approx. 100 g each)', option_names: ['Lengths'],
      images: ['/static/img/brand/straight-black-styling.jpg', '/static/img/brand/straight-black-portrait.jpg', '/static/img/brand/backs-five-textures.jpg'],
      variants: [[{ Lengths: '16" / 18" / 20"' }, 210000, 2], [{ Lengths: '20" / 22" / 24"' }, 290000, 1]],
    },
    {
      slug: 'deep-wave-5x5-hd-closure', name: 'Deep Wave 5x5 HD Lace Closure', category: 'closures', availability: 'enquire', featured: 0,
      short: 'A 5x5 HD lace closure in deep wave. Sold on its own.',
      description: 'Pre-plucked 5x5 HD lace closure for a natural parting. Pairs with our deep wave bundles.',
      texture: 'Deep wave', colour: 'Natural black (1B)', lace: '5x5 HD lace closure', density: '150%',
      includes: '1 closure only (bundles not included)', option_names: ['Length'],
      images: ['/static/img/brand/backs-curly-and-wavy.jpg', '/static/img/brand/duo-curly-and-wavy.jpg'],
      variants: [[{ Length: '16"' }, 130000, 0], [{ Length: '18"' }, 145000, 0]],
    },
  ];
  insertProducts(samples, true);
}
seed();


module.exports = {
  db, DATA_DIR, CATEGORIES, ShopError, tx, safeJSON,
  getSettings, setSetting, DEFAULT_SETTINGS,
  listProducts, usedCategories, kindFor, getProduct, getProductBySlug, hydrateProduct, variantLabel,
  priceCart, deliveryFor, deliveryMethods, createOrder, getOrder, getOrderByRef,
  markPaid, markDispatched, markDelivered, cancelOrder, extendDeadline, expireUnpaid,
};
