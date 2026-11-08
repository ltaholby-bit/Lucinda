'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const store = require('./lib/db');
const views = require('./lib/views');
const admin = require('./lib/admin-views');
const payfast = require('./lib/payfast');
const { sendMail, mailConfigured } = require('./lib/mail');
const { money, toCents, slugify, parseCookies, readBody, fmtDate, esc, randomToken } = require('./lib/util');

const PORT = parseInt(process.env.PORT || '3000', 10);
const PUBLIC = path.join(__dirname, 'public');
const UPLOADS = path.join(store.DATA_DIR, 'uploads');
const PROD = process.env.NODE_ENV === 'production';

/* ---------- Admin password & session secret ---------- */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (PROD ? '' : 'change-me');
if (!ADMIN_PASSWORD) console.warn('WARNING: ADMIN_PASSWORD is not set – admin login is disabled.');
let SECRET = process.env.SESSION_SECRET || store.getSettings()._session_secret;
if (!SECRET) { SECRET = randomToken(32); store.setSetting('_session_secret', SECRET); }

const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('hex');
function makeSession() { const exp = String(Date.now() + 12 * 3600e3); return `${exp}.${sign('admin:' + exp)}`; }
function isAdmin(req) {
  const c = parseCookies(req).nl_admin || '';
  const [exp, mac] = c.split('.');
  if (!exp || !mac || Number(exp) < Date.now()) return false;
  const good = sign('admin:' + exp);
  return mac.length === good.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good));
}
const loginAttempts = new Map();

/* ---------- Helpers ---------- */
function baseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http');
  return `${String(proto).split(',')[0]}://${req.headers['x-forwarded-host'] || req.headers.host}`;
}
const isHttps = (req) => baseUrl(req).startsWith('https');

function send(res, status, body, type = 'text/html; charset=utf-8', headers = {}) {
  res.writeHead(status, {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    ...headers,
  });
  res.end(String(body));
}
const page = (res, body, status = 200) => send(res, status, body, 'text/html; charset=utf-8', { 'Cache-Control': 'no-store' });
const json = (res, obj, status = 200) => send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8', { 'Cache-Control': 'no-store' });
const redirect = (res, to, status = 303) => { res.writeHead(status, { Location: to }); res.end(); };

async function formBody(req) {
  return Object.fromEntries(new URLSearchParams((await readBody(req, 2e6)).toString('utf8')));
}

/* Flash messages via short-lived cookie */
function setFlash(res, msg, type = 'ok') {
  res.setHeader('Set-Cookie', `nl_flash=${encodeURIComponent(JSON.stringify({ msg, type }))}; Path=/admin; Max-Age=30; HttpOnly; SameSite=Strict`);
}
function takeFlash(req, res) {
  const v = parseCookies(req).nl_flash;
  if (!v) return null;
  res.setHeader('Set-Cookie', 'nl_flash=; Path=/admin; Max-Age=0');
  try { return JSON.parse(v); } catch { return null; }
}

const MIME = {
  '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.ico': 'image/x-icon',
};
function serveFile(req, res, root, rel, maxAge) {
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root + path.sep)) return send(res, 404, 'Not found', 'text/plain');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found', 'text/plain');
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const headers = { 'Content-Type': type, 'Cache-Control': `public, max-age=${maxAge}`, 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range) { // videos on iPhone need range requests
      const start = range[1] ? parseInt(range[1], 10) : 0;
      const end = range[2] ? Math.min(parseInt(range[2], 10), st.size - 1) : st.size - 1;
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...headers, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------- Emails ---------- */
function addressText(o) {
  return o.delivery_type === 'paxi'
    ? `PEP PAXI point: ${o.paxi_point}, ${o.city}, ${o.province}`
    : [o.address1, o.address2, o.suburb, o.city, `${o.province} ${o.postal_code}`].filter(Boolean).join(', ');
}
function orderEmail(o, s, base, kind) {
  const link = `${base}/order/${o.ref}?t=${o.token}`;
  const items = o.items.map((i) => `• ${i.product_name}${i.variant_label ? ' (' + i.variant_label + ')' : ''} – ${i.kind_label} × ${i.qty}: ${money(i.unit_cents * i.qty)}`).join('\n');
  const totals = `Subtotal: ${money(o.subtotal_cents)}\nDelivery${o.delivery_method ? ' (' + o.delivery_method + ')' : ''}: ${money(o.delivery_cents)}\nTotal: ${money(o.total_cents)}\nDelivering to: ${addressText(o)}`;
  const bank = s.bank_account_number
    ? `Bank: ${s.bank_name}\nAccount name: ${s.bank_account_name}\nAccount number: ${s.bank_account_number}\nBranch code: ${s.bank_branch_code}\nReference: ${o.ref}`
    : `We will send our bank details on WhatsApp. Reference: ${o.ref}`;
  const first = String(o.name).split(' ')[0];
  const dtime = o.delivery_time || 'the usual transit time for your delivery option';
  const T = {
    placed: [`Order ${o.ref} received – awaiting payment`,
      `Hi ${first},\n\nThank you for your order with ${s.shop_name}!\n\nOrder reference: ${o.ref}\nPayment status: Awaiting payment\n\n${items}\n\n${totals}\n\n` +
      (o.payment_method === 'eft' ? `Please pay by EFT before ${fmtDate(o.payment_deadline)}:\n${bank}\n\nUnpaid orders are cancelled after this time.\n\n` : '') +
      `Once payment is confirmed we prepare your order within ${s.prep_time}; delivery then takes ${dtime}.\n\nView your order: ${link}\n\n${s.shop_name}\n${s.slogan}`],
    paid: [`Payment received – order ${o.ref}`,
      `Hi ${first},\n\nWe have received your payment for order ${o.ref}. Thank you!\n\n${items}\n\n${totals}\n\nExpected dispatch: within ${s.prep_time}. Delivery then takes ${dtime}. We will send you tracking once it is dispatched.\n\nView your order: ${link}\n\n${s.shop_name}`],
    dispatched: [`Your order ${o.ref} has been dispatched`,
      `Hi ${first},\n\nGood news – your order ${o.ref} is on its way!\n\nCourier: ${o.courier}\nTracking number: ${o.tracking_number}\n${o.tracking_url ? 'Track it: ' + o.tracking_url + '\n' : ''}\nDelivery usually takes ${dtime}.\n\nView your order: ${link}\n\n${s.shop_name}`],
  }[kind];
  return { subject: T[0], text: T[1] };
}
function notify(o, kind, req) {
  const s = store.getSettings();
  const base = baseUrl(req);
  const m = orderEmail(o, s, base, kind);
  sendMail({ to: o.email, subject: m.subject, text: m.text, replyTo: s.email });
  if (kind === 'placed' || kind === 'paid') {
    sendMail({ to: process.env.SHOP_NOTIFY_EMAIL || s.email, subject: `[Shop] ${kind === 'placed' ? 'New order' : 'Paid'} ${o.ref} – ${money(o.total_cents)}`, text: `${o.name} · ${o.phone} · ${o.email}\n${addressText(o)}\n\n${m.text}\n\nAdmin: ${base}/admin/orders/${o.id}` });
  }
}

/* ---------- Validation ---------- */
function validateCheckout(b, s) {
  const out = {};
  for (const k of ['name', 'phone', 'email', 'address1', 'address2', 'suburb', 'city', 'province', 'postal_code', 'paxi_point', 'notes', 'source']) {
    out[k] = String(b[k] ?? '').trim().slice(0, k === 'notes' ? 500 : 150);
  }
  const method = store.deliveryMethods(s).find((m) => m.id === b.delivery_method);
  if (!method) return { error: 'Please choose a delivery option.' };
  const paxi = method.type === 'paxi';
  const req = ['name', 'phone', 'email', 'city', 'province', ...(paxi ? ['paxi_point'] : ['address1', 'suburb', 'postal_code'])];
  for (const k of req) if (!out[k]) return { error: paxi && k === 'paxi_point' ? 'Please enter the PEP store (PAXI point) to send your parcel to.' : 'Please fill in all required fields.' };
  if (paxi) { out.address1 = ''; out.address2 = ''; out.suburb = ''; out.postal_code = ''; } else out.paxi_point = '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) return { error: 'Please enter a valid email address.' };
  const digits = out.phone.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 13) return { error: 'Please enter a valid phone number.' };
  if (!paxi && !/^\d{4}$/.test(out.postal_code)) return { error: 'Please enter a 4-digit postal code.' };
  if (!views.PROVINCES.includes(out.province)) return { error: 'Please choose your province.' };
  out.delivery_method_id = method.id;
  out.payment_method = b.payment_method === 'card' && payfast.enabled() ? 'card' : 'eft';
  out.lines = Array.isArray(b.lines) ? b.lines.slice(0, 30) : [];
  return { data: out };
}

/* ---------- Image/video upload (raw body) ---------- */
function sniff(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return '.webp';
  if (buf.slice(4, 8).toString() === 'ftyp') return buf.slice(8, 10).toString() === 'qt' ? '.mov' : '.mp4';
  if (buf.slice(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return '.webm';
  return null;
}

/* ---------- Routes ---------- */
const settings = () => store.getSettings();

async function handlePublic(req, res, url) {
  const s = settings();
  const base = baseUrl(req);
  const p = url.pathname;

  if (p === '/' && req.method === 'GET') {
    const products = store.listProducts();
    const pickFour = (list) => list.filter((x) => x.featured).concat(list.filter((x) => !x.featured)).slice(0, 4);
    const ready = pickFour(products.filter((x) => x.availability === 'ready' && !x.sold_out));
    const pre = pickFour(products.filter((x) => x.availability !== 'ready'));
    const reviews = store.db.prepare('SELECT * FROM reviews WHERE visible = 1 ORDER BY id DESC LIMIT 6').all();
    return page(res, views.home(s, { ready, pre, reviews, base }));
  }
  if (p === '/shop') return page(res, views.shop(s, { products: store.listProducts(), cat: url.searchParams.get('cat'), base }));

  let m;
  if ((m = /^\/p\/([a-z0-9-]+)\/?$/.exec(p))) { // short social link
    return redirect(res, `/product/${m[1]}${url.search}`, 302);
  }
  if ((m = /^\/product\/([a-z0-9-]+)\/?$/.exec(p))) {
    const prod = store.getProductBySlug(m[1]);
    if (!prod || !prod.active) return page(res, views.notFound(s), 404);
    const v = parseInt(url.searchParams.get('v'), 10);
    return page(res, views.product(s, { p: prod, base, preselect: prod.variants.some((x) => x.id === v) ? v : null }));
  }
  if (p === '/cart') return page(res, views.cart(s, { base }));
  if (p === '/checkout') return page(res, views.checkout(s, { base, cardEnabled: payfast.enabled() }));

  if (p === '/api/cart' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req, 1e5)).toString() || '{}');
    const { items, subtotal } = store.priceCart(body.lines);
    const methods = store.deliveryMethods(s).map((m) => ({ id: m.id, name: m.name, type: m.type, fee: store.deliveryFor(subtotal, s, m.id).fee }));
    return json(res, { items, subtotal, methods });
  }
  if (p === '/api/orders' && req.method === 'POST') {
    store.expireUnpaid();
    let body;
    try { body = JSON.parse((await readBody(req, 1e5)).toString()); } catch { return json(res, { error: 'Invalid request.' }, 400); }
    const v = validateCheckout(body, s);
    if (v.error) return json(res, { error: v.error }, 400);
    try {
      const o = store.createOrder(v.data, s);
      notify(o, 'placed', req);
      const next = o.payment_method === 'card' ? `/payfast/pay/${o.ref}?t=${o.token}` : `/order/${o.ref}?t=${o.token}&new=1`;
      return json(res, { ref: o.ref, redirect: next });
    } catch (e) {
      if (e instanceof store.ShopError) return json(res, { error: e.message }, 409);
      throw e;
    }
  }
  if ((m = /^\/order\/(NLH-[A-Z0-9]+)$/.exec(p))) {
    store.expireUnpaid();
    const o = store.getOrderByRef(m[1]);
    const t = url.searchParams.get('t') || '';
    if (!o || o.token.length !== t.length || !crypto.timingSafeEqual(Buffer.from(o.token), Buffer.from(t))) return page(res, views.notFound(s), 404);
    return page(res, views.orderPage(s, { o, base, cardEnabled: payfast.enabled(), justPlaced: url.searchParams.has('new'), paidReturn: url.searchParams.has('paid') }));
  }
  if (p === '/track') {
    if (req.method === 'POST') {
      const b = await formBody(req);
      const o = store.getOrderByRef(b.ref);
      const last9 = (x) => String(x || '').replace(/\D/g, '').slice(-9);
      if (o && last9(o.phone) && last9(o.phone) === last9(b.phone)) return redirect(res, `/order/${o.ref}?t=${o.token}`);
      return page(res, views.track(s, { error: 'We couldn’t find an order with that reference and phone number.' }), 404);
    }
    return page(res, views.track(s, {}));
  }

  /* PayFast */
  if ((m = /^\/payfast\/pay\/(NLH-[A-Z0-9]+)$/.exec(p))) {
    const o = store.getOrderByRef(m[1]);
    if (!o || o.token !== url.searchParams.get('t') || !payfast.enabled() || o.status !== 'awaiting_payment') return redirect(res, o ? `/order/${o.ref}?t=${o.token}` : '/');
    const f = payfast.checkoutForm(o, base);
    return page(res, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Redirecting to PayFast…</title><body style="font-family:sans-serif;text-align:center;padding:3rem;background:#fbf0ee">
<p>Taking you to PayFast to pay ${esc(money(o.total_cents))}…</p><form id="f" method="post" action="${esc(f.action)}">${f.fields.map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('')}<button>Continue to PayFast</button></form><script>document.getElementById('f').submit()</script>`);
  }
  if (p === '/payfast/notify' && req.method === 'POST') {
    const rawBody = (await readBody(req, 1e5)).toString('utf8');
    const ref = new URLSearchParams(rawBody).get('m_payment_id');
    const o = store.getOrderByRef(ref);
    send(res, 200, 'OK', 'text/plain');
    if (!o) return;
    const r = await payfast.verifyNotification(rawBody, o.total_cents);
    if (r.ok && r.complete) {
      try { const paid = store.markPaid(o.id); notify(paid, 'paid', req); } catch (e) { console.error('[payfast] could not mark paid', o.ref, e.message); }
    } else console.warn('[payfast] ITN not accepted', o.ref, { sig: r.sigOk, amount: r.amountOk, server: r.serverOk, status: r.data.payment_status });
    return;
  }

  /* Info pages */
  const info = {
    '/hair-care': ['Hair care', 'Keep it beautiful', 'policy_haircare', null],
    '/delivery': ['Delivery', 'Nationwide', 'policy_delivery', 'policy_delivery_confirmed'],
    '/returns': ['Returns & refunds', 'Policies', 'policy_returns', 'policy_returns_confirmed'],
    '/privacy': ['Privacy', 'Policies', 'policy_privacy', 'policy_privacy_confirmed'],
  }[p];
  if (info) return page(res, views.infoPage(s, { title: info[0], eyebrow: info[1], text: s[info[2]], base, path: p, confirmKey: info[3] }));
  if (p === '/contact') return page(res, views.contact(s, { base }));

  if (p === '/robots.txt') return send(res, 200, `User-agent: *\nDisallow: /admin\nDisallow: /order/\nDisallow: /cart\nDisallow: /checkout\nSitemap: ${base}/sitemap.xml\n`, 'text/plain');
  if (p === '/sitemap.xml') {
    const urls = ['/', '/shop', '/hair-care', '/delivery', '/returns', '/privacy', '/contact', ...store.listProducts().map((x) => '/product/' + x.slug)];
    return send(res, 200, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${esc(base + u)}</loc></url>`).join('')}</urlset>`, 'application/xml');
  }
  if (p === '/healthz') return send(res, 200, 'ok', 'text/plain');
  return page(res, views.notFound(s), 404);
}

async function handleAdmin(req, res, url) {
  const p = url.pathname;
  const s = settings();
  const base = baseUrl(req);

  // Basic CSRF protection: admin POSTs must come from this site.
  if (req.method === 'POST') {
    const origin = req.headers.origin || req.headers.referer || '';
    if (origin && !origin.startsWith(base) && !origin.startsWith(`http://${req.headers.host}`) && !origin.startsWith(`https://${req.headers.host}`)) return send(res, 403, 'Forbidden', 'text/plain');
  }

  if (p === '/admin/login') {
    if (req.method === 'POST') {
      const ip = req.socket.remoteAddress;
      const a = loginAttempts.get(ip) || { n: 0, t: Date.now() };
      if (Date.now() - a.t > 15 * 60e3) { a.n = 0; a.t = Date.now(); }
      if (a.n >= 10) return page(res, admin.login(s, { error: 'Too many attempts. Try again in 15 minutes.' }), 429);
      const b = await formBody(req);
      const given = crypto.createHash('sha256').update(String(b.password || '')).digest();
      const want = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
      if (ADMIN_PASSWORD && crypto.timingSafeEqual(given, want)) {
        loginAttempts.delete(ip);
        res.setHeader('Set-Cookie', `nl_admin=${makeSession()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${isHttps(req) ? '; Secure' : ''}`);
        return redirect(res, '/admin');
      }
      a.n += 1; loginAttempts.set(ip, a);
      return page(res, admin.login(s, { error: ADMIN_PASSWORD ? 'Incorrect password.' : 'Admin password has not been set on the server.' }), 401);
    }
    return page(res, admin.login(s, {}));
  }
  if (!isAdmin(req)) return redirect(res, '/admin/login');
  if (p === '/admin/logout' && req.method === 'POST') {
    res.setHeader('Set-Cookie', 'nl_admin=; Path=/; Max-Age=0');
    return redirect(res, '/admin/login');
  }

  store.expireUnpaid();
  const flash = takeFlash(req, res);
  const back = (to, msg, type) => { if (msg) setFlash(res, msg, type); return redirect(res, to); };
  let m;

  if (p === '/admin') {
    const counts = Object.fromEntries(store.db.prepare('SELECT status, COUNT(*) n FROM orders GROUP BY status').all().map((r) => [r.status, r.n]));
    const recent = store.db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 8').all();
    const lowStock = [];
    for (const prod of store.listProducts({ activeOnly: false })) {
      if (prod.availability !== 'ready') continue;
      for (const v of prod.variants) if (v.stock <= 1) lowStock.push({ name: prod.name, label: store.variantLabel(prod, v), stock: v.stock });
    }
    const samples = store.db.prepare('SELECT COUNT(*) n FROM products WHERE is_sample = 1').get().n;
    const warnings = [];
    if (!/^27\d{9}$/.test(s.whatsapp) || s.whatsapp === '27000000000') warnings.push('Your WhatsApp number is not set. <a href="/admin/settings">Add it in Settings</a>.');
    if (!s.bank_account_number) warnings.push('Bank details are not shown on the site, so clients are asked to get them from you on WhatsApp after ordering. (Optional: add them in <a href="/admin/settings">Settings</a> to show them automatically.)');
    const allMethods = store.deliveryMethods(s, { all: true });
    if (!allMethods.some((m) => m.fee != null)) warnings.push('No delivery option has a fee yet, so online checkout cannot be used. <a href="/admin/settings">Add delivery fees in Settings</a>.');
    const notOffered = allMethods.filter((m) => m.fee == null);
    if (notOffered.length) warnings.push(`Not shown to clients until you add a fee: ${notOffered.map((m) => esc(m.name)).join(', ')}. <a href="/admin/settings">Add fees in Settings</a>.`);
    const drafts = [['policy_delivery_confirmed', 'delivery'], ['policy_returns_confirmed', 'returns'], ['policy_privacy_confirmed', 'privacy']].filter(([k]) => s[k] !== '1' && s.policies_confirmed !== '1').map(([, n]) => n);
    if (drafts.length) warnings.push(`Still marked as drafts on the site: ${drafts.join(', ')} policy. <a href="/admin/settings">Review and confirm them in Settings</a>.`);
    if (s.email_public !== '1') warnings.push('No email address is shown on the site yet. Create a Nolle’ email in cPanel (e.g. info@nolleluxuryhair.co.za), send yourself a test, then enter it in <a href="/admin/settings">Settings</a> and tick “Show on website”.');
    if (!mailConfigured()) warnings.push('Order emails are not switched on yet (see Help / README). Clients still see their confirmation page.');
    return page(res, admin.dashboard(s, { counts, recent, lowStock, samples, base, warnings }));
  }

  /* Orders */
  if (p === '/admin/orders') {
    const status = url.searchParams.get('status') || '';
    const q = (url.searchParams.get('q') || '').trim();
    let sql = 'SELECT * FROM orders WHERE 1=1'; const args = [];
    if (status) { sql += ' AND status = ?'; args.push(status); }
    if (q) { sql += ' AND (ref LIKE ? OR name LIKE ? OR phone LIKE ? OR email LIKE ?)'; args.push(...Array(4).fill(`%${q}%`)); }
    const list = store.db.prepare(sql + ' ORDER BY id DESC LIMIT 300').all(...args);
    return page(res, admin.orders(s, { list, status, q }));
  }
  if ((m = /^\/admin\/orders\/(\d+)$/.exec(p))) {
    const o = store.getOrder(+m[1]);
    if (!o) return back('/admin/orders', 'Order not found.', 'err');
    return page(res, admin.order(s, { o, flash, base }));
  }
  if ((m = /^\/admin\/orders\/(\d+)\/(paid|extend|dispatch|delivered|cancel|note)$/.exec(p)) && req.method === 'POST') {
    const id = +m[1]; const to = `/admin/orders/${id}`;
    const b = await formBody(req);
    try {
      if (m[2] === 'paid') { const o = store.markPaid(id); notify(o, 'paid', req); return back(to, `${o.ref} marked as paid.`); }
      if (m[2] === 'extend') { store.extendDeadline(id, 24); return back(to, 'Payment deadline extended by 24 hours.'); }
      if (m[2] === 'dispatch') {
        if (!b.tracking_number) return back(to, 'Please enter a tracking number.', 'err');
        const o = store.markDispatched(id, b); notify(o, 'dispatched', req); return back(to, `${o.ref} marked as dispatched.`);
      }
      if (m[2] === 'delivered') { store.markDelivered(id); return back(to, 'Marked as delivered.'); }
      if (m[2] === 'cancel') { store.cancelOrder(id); return back(to, 'Order cancelled and stock returned.'); }
      if (m[2] === 'note') { store.db.prepare('UPDATE orders SET admin_note = ? WHERE id = ?').run(String(b.admin_note || '').slice(0, 2000), id); return back(to, 'Note saved.'); }
    } catch (e) {
      if (e instanceof store.ShopError) return back(to, e.message, 'err');
      throw e;
    }
  }

  /* Products */
  if (p === '/admin/products') return page(res, admin.products(s, { list: store.listProducts({ activeOnly: false }), base }));
  if ((m = /^\/admin\/products\/(new|\d+)$/.exec(p))) {
    const isNew = m[1] === 'new';
    let prod = isNew ? { category: 'wigs', availability: 'ready', option_names: ['Length'], images: [], variants: [], active: 1 } : store.getProduct(+m[1]);
    if (!prod) return back('/admin/products', 'Product not found.', 'err');
    if (req.method === 'POST') {
      const b = await formBody(req);
      const r = saveProduct(isNew ? null : prod.id, b);
      if (r.error) return page(res, admin.productForm(s, { p: { ...prod, ...r.draft }, flash: { msg: r.error, type: 'err' }, base }), 400);
      return back(`/admin/products/${r.id}`, 'Product saved.');
    }
    return page(res, admin.productForm(s, { p: prod, flash, base }));
  }
  if ((m = /^\/admin\/products\/(\d+)\/delete$/.exec(p)) && req.method === 'POST') {
    store.db.prepare('DELETE FROM products WHERE id = ?').run(+m[1]);
    return back('/admin/products', 'Product deleted.');
  }
  if (p === '/admin/stock') {
    if (req.method === 'POST') {
      const b = await formBody(req);
      store.tx(() => {
        for (const [k, v] of Object.entries(b)) {
          let mm;
          if ((mm = /^stock_(\d+)$/.exec(k))) { const n = parseInt(v, 10); if (Number.isFinite(n) && n >= 0) store.db.prepare('UPDATE variants SET stock = ? WHERE id = ?').run(n, +mm[1]); }
          if ((mm = /^price_(\d+)$/.exec(k))) { const c = toCents(v); if (c) store.db.prepare('UPDATE variants SET price_cents = ? WHERE id = ?').run(c, +mm[1]); }
        }
      });
      return back('/admin/stock', 'Stock and prices saved.');
    }
    const rows = [];
    for (const prod of store.listProducts({ activeOnly: false })) for (const v of prod.variants) rows.push({ ...v, product_id: prod.id, name: prod.name, category: prod.category, availability: prod.availability, label: store.variantLabel(prod, v) });
    return page(res, admin.stock(s, { rows, flash }));
  }

  /* Uploads */
  if (p === '/admin/upload' && req.method === 'POST') {
    let buf;
    try { buf = await readBody(req, 31e6); } catch { return json(res, { error: 'File too large (max 30 MB).' }, 413); }
    const ext = sniff(buf);
    if (!ext) return json(res, { error: 'Unsupported file. Use JPG, PNG, WebP or MP4.' }, 400);
    if (['.jpg', '.png', '.webp'].includes(ext) && buf.length > 8.5e6) return json(res, { error: 'Photo too large (max 8 MB).' }, 413);
    const name = randomToken(10) + ext;
    fs.writeFileSync(path.join(UPLOADS, name), buf);
    return json(res, { url: '/uploads/' + name, kind: ['.mp4', '.mov', '.webm'].includes(ext) ? 'video' : 'image' });
  }

  /* Reviews */
  if (p === '/admin/reviews') {
    if (req.method === 'POST') {
      const b = await formBody(req);
      if (!b.name || !b.text) return back('/admin/reviews', 'Name and review text are required.', 'err');
      store.db.prepare('INSERT INTO reviews (name, text, rating, source, product_id) VALUES (?, ?, ?, ?, ?)')
        .run(b.name.slice(0, 60), b.text.slice(0, 800), Math.min(5, Math.max(1, parseInt(b.rating, 10) || 5)), (b.source || '').slice(0, 40), parseInt(b.product_id, 10) || null);
      return back('/admin/reviews', 'Review added.');
    }
    return page(res, admin.reviews(s, { list: store.db.prepare('SELECT * FROM reviews ORDER BY id DESC').all(), products: store.listProducts({ activeOnly: false }), flash }));
  }
  if ((m = /^\/admin\/reviews\/(\d+)\/delete$/.exec(p)) && req.method === 'POST') {
    store.db.prepare('DELETE FROM reviews WHERE id = ?').run(+m[1]);
    return back('/admin/reviews', 'Review deleted.');
  }

  /* Settings */
  if (p === '/admin/settings') {
    if (req.method === 'POST') {
      const b = await formBody(req);
      const keys = ['whatsapp', 'email', 'phone_display', 'location', 'instagram', 'tiktok', 'slogan', 'intro', 'hero_image', 'prep_time', 'preorder_time', 'courier_name', 'payment_hours',
        'bank_name', 'bank_account_name', 'bank_account_number', 'bank_branch_code', 'bank_account_type', 'care_default', 'policy_haircare', 'policy_delivery', 'policy_returns', 'policy_privacy'];
      for (const k of keys) if (k in b) store.setSetting(k, String(b[k]).trim());
      store.setSetting('whatsapp', String(b.whatsapp || '').replace(/\D/g, '').replace(/^0/, '27'));
      if ('dm_count' in b) {
        const methods = [];
        for (let i = 0; i < Math.min(20, parseInt(b.dm_count, 10) || 0); i++) {
          const name = String(b[`dm_name_${i}`] || '').trim().slice(0, 60);
          if (!name) continue;
          const feeRaw = String(b[`dm_fee_${i}`] || '').trim();
          const cents = feeRaw === '' ? null : toCents(feeRaw);
          let id = String(b[`dm_id_${i}`] || '').trim() || slugify(name);
          while (methods.some((m) => m.id === id)) id += '-2';
          methods.push({ id, name, fee: cents == null ? '' : String(cents), time: String(b[`dm_time_${i}`] || '').trim().slice(0, 60), type: b[`dm_type_${i}`] === 'paxi' ? 'paxi' : 'address' });
        }
        store.setSetting('delivery_methods', JSON.stringify(methods));
      }
      store.setSetting('free_delivery_over_cents', toCents(b.free_delivery_over) ?? 0);
      store.setSetting('payment_hours', Math.max(1, parseInt(b.payment_hours, 10) || 24));
      for (const k of ['policy_delivery_confirmed', 'policy_returns_confirmed', 'policy_privacy_confirmed', 'email_public']) store.setSetting(k, b[k] === '1' ? '1' : '0');
      store.setSetting('policies_confirmed', '0'); // replaced by the per-policy settings above
      return back('/admin/settings', 'Settings saved.');
    }
    return page(res, admin.settings(s, { flash, cardEnabled: payfast.enabled(), mailOn: mailConfigured(), methods: store.deliveryMethods(s, { all: true }) }));
  }
  if (p === '/admin/help') return page(res, admin.help(s, { base }));
  return send(res, 404, 'Not found', 'text/plain');
}

function saveProduct(id, b) {
  const draft = {
    name: String(b.name || '').trim(), category: store.CATEGORIES[b.category] ? b.category : 'wigs',
    availability: b.availability === 'enquire' ? 'enquire' : 'ready',
    short: b.short || '', description: b.description || '', texture: b.texture || '', colour: b.colour || '', length: b.length || '',
    lace: b.lace || '', density: b.density || '', includes: b.includes || '', care: b.care || '', video: b.video || '',
    lead_time: String(b.lead_time || '').slice(0, 80),
    extra_prices: String(b.extra_prices || '').slice(0, 6000),
    option_names: String(b.option_names || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 3),
    images: store.safeJSON(b.images, []).filter((x) => typeof x === 'string' && /^\/(uploads|static)\//.test(x)).slice(0, 12),
    active: b.active === '1' ? 1 : 0, featured: b.featured === '1' ? 1 : 0, sort: parseInt(b.sort, 10) || 0,
    slug: slugify(b.slug || b.name),
  };
  if (!/^\/uploads\//.test(draft.video)) draft.video = '';
  const rawVariants = store.safeJSON(b.variants, []);
  const variants = [];
  for (const v of rawVariants) {
    const price = toCents(v.price);
    if (price == null || price <= 0) return { error: 'Every option row needs a price.', draft };
    const options = {};
    for (const n of draft.option_names) {
      const val = String((v.options || {})[n] || '').trim();
      if (!val) return { error: `Every option row needs a value for “${n}”.`, draft };
      options[n] = val;
    }
    variants.push({ id: parseInt(v.id, 10) || null, options, price, stock: Math.max(0, parseInt(v.stock, 10) || 0), sku: String(v.sku || '').slice(0, 40) });
  }
  draft.variants = variants.map((v) => ({ ...v, price_cents: v.price }));
  if (!draft.name) return { error: 'Please enter a product name.', draft };
  if (!variants.length) return { error: 'Please add at least one option row with a price.', draft };
  const clash = store.db.prepare('SELECT id FROM products WHERE slug = ? AND id IS NOT ?').get(draft.slug, id);
  if (clash) draft.slug = `${draft.slug}-${Date.now().toString(36).slice(-4)}`;

  return store.tx(() => {
    const cols = ['slug', 'name', 'category', 'availability', 'short', 'description', 'texture', 'colour', 'length', 'lace', 'density', 'includes', 'care', 'video', 'lead_time', 'extra_prices', 'active', 'featured', 'sort'];
    const vals = cols.map((c) => draft[c]);
    if (id) {
      store.db.prepare(`UPDATE products SET ${cols.map((c) => c + ' = ?').join(', ')}, option_names = ?, images = ?, is_sample = 0 WHERE id = ?`)
        .run(...vals, JSON.stringify(draft.option_names), JSON.stringify(draft.images), id);
    } else {
      id = Number(store.db.prepare(`INSERT INTO products (${cols.join(', ')}, option_names, images) VALUES (${cols.map(() => '?').join(', ')}, ?, ?)`)
        .run(...vals, JSON.stringify(draft.option_names), JSON.stringify(draft.images)).lastInsertRowid);
    }
    const keep = [];
    variants.forEach((v, i) => {
      const existing = v.id && store.db.prepare('SELECT id FROM variants WHERE id = ? AND product_id = ?').get(v.id, id);
      if (existing) {
        store.db.prepare('UPDATE variants SET options = ?, price_cents = ?, stock = ?, sku = ?, sort = ? WHERE id = ?').run(JSON.stringify(v.options), v.price, v.stock, v.sku, i, v.id);
        keep.push(v.id);
      } else {
        keep.push(Number(store.db.prepare('INSERT INTO variants (product_id, options, price_cents, stock, sku, sort) VALUES (?, ?, ?, ?, ?, ?)').run(id, JSON.stringify(v.options), v.price, v.stock, v.sku, i).lastInsertRowid));
      }
    });
    store.db.prepare(`DELETE FROM variants WHERE product_id = ? AND id NOT IN (${keep.map(() => '?').join(',')})`).run(id, ...keep);
    return { id };
  });
}

/* ---------- Server ---------- */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local');
    if (url.pathname.startsWith('/static/')) return serveFile(req, res, PUBLIC, url.pathname.slice(8), PROD ? 86400 : 0);
    if (url.pathname.startsWith('/uploads/')) return serveFile(req, res, UPLOADS, url.pathname.slice(9), 31536000);
    if (url.pathname === '/favicon.ico') return serveFile(req, res, PUBLIC, 'img/favicon.svg', 86400);
    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) return await handleAdmin(req, res, url);
    return await handlePublic(req, res, url);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, e.status || 500, e.status === 413 ? 'Too large' : 'Something went wrong. Please try again or contact us on WhatsApp.', 'text/plain; charset=utf-8');
  }
});

setInterval(() => { try { const n = store.expireUnpaid(); if (n) console.log(`Expired ${n} unpaid order(s); stock released.`); } catch (e) { console.error(e); } }, 5 * 60e3).unref();

/* Always listen: cPanel's Node.js (Passenger) loads this file through its own
   launcher, so a "run directly" check would stop it from ever starting. */
server.listen(PORT, () => console.log(`Nolle’ Luxury Hair running on port ${PORT}  (admin: /admin)`));
module.exports = server;
