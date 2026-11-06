'use strict';
const { html, raw, money, fmtDate, waLink, esc } = require('./util');
const { CATEGORIES } = require('./db');
const { STATUS } = require('./views');

function alayout(s, { title, body, flash, nav = true }) {
  return html`<!doctype html>
<html lang="en-ZA"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title} · Admin · ${s.shop_name}</title>
<link rel="icon" href="/static/img/favicon.svg" type="image/svg+xml">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/static/css/style.css?v=1">
<link rel="stylesheet" href="/static/css/admin.css?v=1">
</head><body class="admin">
${nav ? html`<header class="a-head">
  <a class="logo" href="/admin"><span class="logo-name">Nolle’</span><span class="logo-sub">Admin</span></a>
  <nav>
    <a href="/admin">Dashboard</a><a href="/admin/orders">Orders</a><a href="/admin/products">Products</a>
    <a href="/admin/stock">Stock &amp; prices</a><a href="/admin/reviews">Reviews</a><a href="/admin/settings">Settings</a><a href="/admin/help">Help</a>
    <a href="/" target="_blank">View shop ↗</a>
    <form method="post" action="/admin/logout"><button class="linkish">Log out</button></form>
  </nav>
</header>` : ''}
<main class="a-main">
${flash ? html`<p class="flash ${flash.type || ''}">${flash.msg}</p>` : ''}
${body}
</main>
<script src="/static/js/admin.js?v=1" defer></script>
</body></html>`;
}

function login(s, { error }) {
  return alayout(s, {
    title: 'Log in', nav: false, body: html`<form class="a-card a-login" method="post" action="/admin/login">
  <div class="logo center"><span class="logo-name">Nolle’</span><span class="logo-sub">Shop admin</span></div>
  ${error ? html`<p class="flash err">${error}</p>` : ''}
  <label>Password<input type="password" name="password" autocomplete="current-password" required autofocus></label>
  <button class="btn btn-gold btn-block">Log in</button>
</form>`,
  });
}

const statusPill = (st) => html`<span class="pill pill-${st}">${(STATUS[st] || {}).label || st}</span>`;

function dashboard(s, { counts, recent, lowStock, samples, base, warnings }) {
  return alayout(s, {
    title: 'Dashboard', body: html`
<h1>Dashboard</h1>
${warnings.map((w) => html`<p class="flash warn">${raw(w)}</p>`)}
${samples ? html`<p class="flash warn">You still have <strong>${samples}</strong> sample product(s). Edit them with your real hair, photos, prices and stock, or delete them before launch. <a href="/admin/products">Go to products →</a></p>` : ''}
<div class="tiles">
  <a class="tile" href="/admin/orders?status=awaiting_payment"><strong>${counts.awaiting_payment || 0}</strong><span>Awaiting payment</span></a>
  <a class="tile" href="/admin/orders?status=paid"><strong>${counts.paid || 0}</strong><span>Paid – to dispatch</span></a>
  <a class="tile" href="/admin/orders?status=dispatched"><strong>${counts.dispatched || 0}</strong><span>Dispatched</span></a>
  <a class="tile" href="/admin/stock"><strong>${lowStock.length}</strong><span>Low / sold-out options</span></a>
</div>
<section class="a-card">
  <h2>Recent orders</h2>
  ${ordersTable(recent)}
  <p><a href="/admin/orders">All orders →</a></p>
</section>
${lowStock.length ? html`<section class="a-card"><h2>Low or sold-out stock (ready-to-ship items)</h2>
  <table class="tbl"><thead><tr><th>Product</th><th>Option</th><th>Stock</th></tr></thead><tbody>
  ${lowStock.map((r) => html`<tr><td>${r.name}</td><td>${r.label || '–'}</td><td><strong>${r.stock}</strong></td></tr>`)}
  </tbody></table><p><a href="/admin/stock">Update stock →</a></p></section>` : ''}
<section class="a-card"><h2>Quick links</h2>
<p><a class="btn btn-gold" href="/admin/products/new">+ Add a product</a> <a class="btn btn-outline" href="/admin/stock">Update stock &amp; prices</a> <a class="btn btn-outline" href="/admin/help">How to use the admin</a></p>
<p class="muted">Shop address: <code>${base}</code></p></section>`,
  });
}

function ordersTable(orders) {
  if (!orders.length) return html`<p class="muted">No orders yet.</p>`;
  return html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ref</th><th>Date</th><th>Client</th><th>Total</th><th>Pay</th><th>Status</th></tr></thead><tbody>
  ${orders.map((o) => html`<tr>
    <td><a href="/admin/orders/${o.id}"><strong>${o.ref}</strong></a></td>
    <td>${fmtDate(o.created_at)}</td>
    <td>${o.name}<br><span class="muted small">${o.city}</span></td>
    <td>${money(o.total_cents)}</td>
    <td>${o.payment_method === 'eft' ? 'EFT' : 'Card'}</td>
    <td>${statusPill(o.status)}</td>
  </tr>`)}
  </tbody></table></div>`;
}

function orders(s, { list, status, q }) {
  const tabs = [['', 'All'], ['awaiting_payment', 'Awaiting payment'], ['paid', 'Paid – to dispatch'], ['dispatched', 'Dispatched'], ['delivered', 'Delivered'], ['expired', 'Expired'], ['cancelled', 'Cancelled']];
  return alayout(s, {
    title: 'Orders', body: html`
<h1>Orders</h1>
<nav class="chips">${tabs.map(([k, l]) => html`<a class="chip ${status === k ? 'on' : ''}" href="/admin/orders${k ? '?status=' + k : ''}">${l}</a>`)}</nav>
<form class="a-search" method="get"><input type="hidden" name="status" value="${status}"><input name="q" value="${q}" placeholder="Search ref, name, phone or email"><button class="btn btn-outline">Search</button></form>
<section class="a-card">${ordersTable(list)}</section>`,
  });
}

function order(s, { o, flash, base }) {
  const link = `${base}/order/${o.ref}?t=${o.token}`;
  const msgPaid = `Hi ${o.name.split(' ')[0]}, thank you! We have received your payment for order ${o.ref}. We’ll prepare your hair within ${s.prep_time} and send tracking once it’s dispatched. ${link}`;
  const msgDisp = `Hi ${o.name.split(' ')[0]}, your Nolle’ order ${o.ref} has been dispatched with ${o.courier || 'the courier'}. Tracking number: ${o.tracking_number}${o.tracking_url ? ' – ' + o.tracking_url : ''}. ${o.delivery_time ? ' Delivery usually takes ' + o.delivery_time + '.' : ''}`;
  const msgRemind = `Hi ${o.name.split(' ')[0]}, this is Nolle’ Luxury Hair. Your order ${o.ref} (${money(o.total_cents)}) is awaiting payment. Please pay by ${fmtDate(o.payment_deadline)} using reference ${o.ref}. ${link}`;
  const intl = o.phone.replace(/\D/g, '').replace(/^0/, '27');
  return alayout(s, {
    title: 'Order ' + o.ref, flash, body: html`
<p><a href="/admin/orders">← All orders</a></p>
<h1>Order ${o.ref} ${statusPill(o.status)}</h1>
<div class="a-cols">
  <section class="a-card">
    <h2>Items</h2>
    <table class="tbl"><tbody>
    ${o.items.map((i) => html`<tr><td><strong>${i.product_name}</strong><br><span class="muted small">${[i.kind_label, i.variant_label].filter(Boolean).join(' · ')}</span></td><td>× ${i.qty}</td><td>${money(i.unit_cents * i.qty)}</td></tr>`)}
    <tr><td colspan="2">Subtotal</td><td>${money(o.subtotal_cents)}</td></tr>
    <tr><td colspan="2">Delivery</td><td>${money(o.delivery_cents)}</td></tr>
    <tr><td colspan="2"><strong>Total</strong></td><td><strong>${money(o.total_cents)}</strong></td></tr>
    </tbody></table>
    <h2>Client</h2>
    <p>${o.name}<br><a href="tel:${o.phone}">${o.phone}</a> · <a href="mailto:${o.email}">${o.email}</a></p>
    <p><strong>Delivery:</strong> ${o.delivery_method || 'Courier'} (${money(o.delivery_cents)})</p>
    ${o.delivery_type === 'paxi' ? html`<p>PEP PAXI point: <strong>${o.paxi_point}</strong><br>${o.city}, ${o.province}</p>`
      : html`<p>${o.address1}${o.address2 ? ', ' + o.address2 : ''}<br>${o.suburb}, ${o.city}<br>${o.province}, ${o.postal_code}</p>`}
    ${o.notes ? html`<p><strong>Notes:</strong> ${o.notes}</p>` : ''}
    <p class="muted small">Placed ${fmtDate(o.created_at)} · Payment: ${o.payment_method === 'eft' ? 'EFT' : 'Card (PayFast)'}${o.source ? ' · Came from: ' + o.source : ''}</p>
    <p class="muted small">Client’s order page: <a href="${link}" target="_blank">${link}</a></p>
  </section>

  <section class="a-card">
    <h2>Payment</h2>
    ${o.status === 'awaiting_payment' ? html`<p>Awaiting <strong>${money(o.total_cents)}</strong> with reference <strong>${o.ref}</strong>.<br>Deadline: ${fmtDate(o.payment_deadline)}</p>
      <p class="muted small">Only mark as paid once the money shows in your bank account.</p>` : ''}
    ${o.paid_at ? html`<p>Paid ${fmtDate(o.paid_at)}</p>` : ''}
    ${['awaiting_payment', 'expired', 'cancelled'].includes(o.status) ? html`<form method="post" action="/admin/orders/${o.id}/paid" data-confirm="Mark ${o.ref} as PAID? Only do this once the money is in your account."><button class="btn btn-gold">Mark as paid</button></form>` : ''}
    ${o.status === 'awaiting_payment' ? html`<form method="post" action="/admin/orders/${o.id}/extend"><button class="btn btn-outline">Give 24 more hours to pay</button></form>
      <p><a class="btn btn-outline" href="${waLink(intl, msgRemind)}" target="_blank">WhatsApp payment reminder</a></p>` : ''}

    <h2>Dispatch</h2>
    ${o.status === 'paid' || o.status === 'dispatched' ? html`<form method="post" action="/admin/orders/${o.id}/dispatch" class="a-form">
      <label>Courier<input name="courier" value="${o.courier || (o.delivery_type === 'paxi' ? 'PEP PAXI' : s.courier_name)}"></label>
      <label>Tracking number<input name="tracking_number" value="${o.tracking_number}" required></label>
      <label>Tracking link (optional)<input name="tracking_url" type="url" value="${o.tracking_url}" placeholder="https://"></label>
      <button class="btn btn-gold">${o.status === 'dispatched' ? 'Update tracking' : 'Mark as dispatched'}</button>
    </form>` : html`<p class="muted">Available once the order is paid.</p>`}
    ${o.status === 'dispatched' ? html`<p><a class="btn btn-outline" href="${waLink(intl, msgDisp)}" target="_blank">WhatsApp tracking to client</a></p>
      <form method="post" action="/admin/orders/${o.id}/delivered"><button class="btn btn-outline">Mark as delivered</button></form>` : ''}
    ${o.status === 'paid' ? html`<p><a class="btn btn-outline" href="${waLink(intl, msgPaid)}" target="_blank">WhatsApp “payment received” to client</a></p>` : ''}

    ${['awaiting_payment', 'paid'].includes(o.status) ? html`<h2>Cancel</h2>
    <form method="post" action="/admin/orders/${o.id}/cancel" data-confirm="Cancel ${o.ref}? The stock will be put back.${o.status === 'paid' ? ' Remember to refund the client.' : ''}"><button class="btn btn-danger">Cancel order &amp; return stock</button></form>` : ''}

    <h2>Private note</h2>
    <form method="post" action="/admin/orders/${o.id}/note" class="a-form"><textarea name="admin_note" rows="3">${o.admin_note}</textarea><button class="btn btn-outline">Save note</button></form>
  </section>
</div>`,
  });
}

function products(s, { list, base }) {
  return alayout(s, {
    title: 'Products', body: html`
<h1>Products <a class="btn btn-gold" href="/admin/products/new">+ Add product</a></h1>
<section class="a-card"><div class="tbl-wrap"><table class="tbl">
<thead><tr><th></th><th>Product</th><th>Type</th><th>Price</th><th>Stock</th><th>Shop</th><th>Link for TikTok / Instagram</th></tr></thead><tbody>
${list.map((p) => html`<tr>
  <td><img class="a-thumb" src="${p.images[0] || '/static/img/photo-coming-soon.svg'}" alt=""></td>
  <td><a href="/admin/products/${p.id}"><strong>${p.name}</strong></a>${p.is_sample ? html` <span class="pill pill-expired">sample</span>` : ''}</td>
  <td>${p.cat.label}<br><span class="muted small">${p.availability === 'ready' ? 'Ready to ship' : 'Pre-order / enquire'}</span></td>
  <td>${money(p.min_price)}${p.max_price !== p.min_price ? ' – ' + money(p.max_price) : ''}</td>
  <td>${p.availability === 'ready' ? p.total_stock : '–'}</td>
  <td>${p.active ? 'Visible' : html`<span class="muted">Hidden</span>`}</td>
  <td><button type="button" class="btn btn-outline btn-sm" data-copy-text="${base}/p/${p.slug}">Copy link</button></td>
</tr>`)}
</tbody></table></div></section>`,
  });
}

function productForm(s, { p, flash, base }) {
  const isNew = !p.id;
  const variants = (p.variants || []).map((v) => ({ id: v.id, options: v.options, price: (v.price_cents / 100).toFixed(2).replace(/\.00$/, ''), stock: v.stock, sku: v.sku }));
  const f = (name, label, help = '', attrs = '') => html`<label>${label}${help ? html`<small>${help}</small>` : ''}<input name="${name}" value="${p[name] || ''}" ${raw(attrs)}></label>`;
  return alayout(s, {
    title: isNew ? 'Add product' : p.name, flash, body: html`
<p><a href="/admin/products">← Products</a></p>
<h1>${isNew ? 'Add a product' : 'Edit: ' + p.name}</h1>
${!isNew ? html`<p class="a-links">Shop page: <a href="/product/${p.slug}" target="_blank">${base}/product/${p.slug}</a> · Short link for social media: <code>${base}/p/${p.slug}</code> <button type="button" class="btn btn-outline btn-sm" data-copy-text="${base}/p/${p.slug}">Copy</button></p>` : ''}
<form method="post" action="/admin/products/${isNew ? 'new' : p.id}" class="a-form a-card" data-product-form>
  <h2>Basics</h2>
  ${f('name', 'Product name', 'e.g. “Body Wave 13x4 HD Frontal Wig”', 'required maxlength="120"')}
  <div class="two">
    <label>Category<small>What the client is buying</small><select name="category">${Object.entries(CATEGORIES).map(([k, c]) => html`<option value="${k}" ${p.category === k ? raw('selected') : ''}>${c.label} – ${c.kind}</option>`)}</select></label>
    <label>Availability<small>Pre-order items show “Enquire on WhatsApp”, not “Add to cart”</small><select name="availability">
      <option value="ready" ${p.availability !== 'enquire' ? raw('selected') : ''}>Ready to ship (in stock)</option>
      <option value="enquire" ${p.availability === 'enquire' ? raw('selected') : ''}>Pre-order – enquire on WhatsApp</option></select></label>
  </div>
  <label>Short summary<small>One or two lines shown near the price</small><textarea name="short" rows="2" maxlength="300">${p.short}</textarea></label>
  <label>Full description<textarea name="description" rows="4">${p.description}</textarea></label>

  <h2>Hair details</h2>
  <div class="two">${f('texture', 'Texture', 'e.g. Body wave')}${f('colour', 'Colour', 'e.g. Natural black (1B)')}</div>
  <div class="two">${f('lace', 'Lace size / type', 'e.g. 13x4 HD lace frontal (wigs & closures)')}${f('density', 'Density', 'e.g. 180% (wigs)')}</div>
  <div class="two">${f('length', 'Length', 'Only if length is NOT an option below')}${f('includes', 'What’s included', 'e.g. 3 bundles, approx. 100 g each')}</div>
  ${f('lead_time', 'Pre-order lead time', 'Shown on pre-order products, e.g. “7–10 working days, plus delivery”. Empty = the default from Settings')}
  <label>Hair-care notes<small>Leave empty to use the standard care text from Settings</small><textarea name="care" rows="3">${p.care}</textarea></label>

  <h2>Options, prices &amp; stock</h2>
  <p class="muted small">Each row is one option the client can choose (e.g. a length), with its own price and stock. Prices in rands. For bundle sets, the price is for all 3 bundles.</p>
  <label>Option names<small>Comma-separated, e.g. “Length” or “Length, Density”. Leave empty if there is only one version.</small><input name="option_names" value="${(p.option_names || []).join(', ')}" data-option-names></label>
  <div data-variants-editor></div>
  <button type="button" class="btn btn-outline btn-sm" data-add-variant>+ Add option row</button>
  <input type="hidden" name="variants" data-variants-json value="${JSON.stringify(variants)}">

  <h2>Photos &amp; video</h2>
  <p class="muted small">First photo is the main one. Use clear, well-lit photos of the actual hair (JPG/PNG/WebP, up to 8 MB). Video: MP4, up to 30 MB, 10–30 seconds.</p>
  <div class="a-images" data-images-list></div>
  <input type="hidden" name="images" value="${JSON.stringify(p.images || [])}" data-images-json>
  <label class="btn btn-outline btn-sm file-btn">+ Upload photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple data-upload-images hidden></label>
  <div class="a-video">
    <input type="hidden" name="video" value="${p.video}" data-video-input>
    <div data-video-preview></div>
    <label class="btn btn-outline btn-sm file-btn">+ Upload video<input type="file" accept="video/mp4,video/quicktime,video/webm" data-upload-video hidden></label>
  </div>
  <p class="upload-status" data-upload-status></p>

  <h2>Display</h2>
  <label class="check"><input type="checkbox" name="active" value="1" ${p.active !== 0 ? raw('checked') : ''}> Show in shop</label>
  <label class="check"><input type="checkbox" name="featured" value="1" ${p.featured ? raw('checked') : ''}> Feature on homepage</label>
  ${f('slug', 'Web address (slug)', 'Used in the link: /product/<slug>. Leave empty to create from the name.', 'pattern="[a-z0-9-]*"')}
  ${f('sort', 'Sort order', 'Lower numbers show first', 'type="number"')}
  <div class="a-actions"><button class="btn btn-gold">Save product</button></div>
</form>
${!isNew ? html`<form method="post" action="/admin/products/${p.id}/delete" data-confirm="Delete ${p.name}? Past orders keep their details." class="a-del"><button class="btn btn-danger">Delete product</button></form>` : ''}`,
  });
}

function stock(s, { rows, flash }) {
  return alayout(s, {
    title: 'Stock & prices', flash, body: html`
<h1>Stock &amp; prices</h1>
<p class="muted">Change any number and press Save. Stock goes down automatically when an order is placed, and comes back if an unpaid order expires or is cancelled.</p>
<form method="post" action="/admin/stock" class="a-card">
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Product</th><th>Option</th><th>Price (R)</th><th>In stock</th></tr></thead><tbody>
${rows.map((r) => html`<tr class="${r.availability === 'ready' && r.stock <= 0 ? 'row-out' : ''}">
  <td><a href="/admin/products/${r.product_id}">${r.name}</a><br><span class="muted small">${r.availability === 'ready' ? 'Ready to ship' : 'Pre-order'}${r.category === 'bundles' ? ' · price for 3 bundles' : ''}</span></td>
  <td>${r.label || '–'}</td>
  <td><input class="num" name="price_${r.id}" value="${(r.price_cents / 100).toFixed(2).replace(/\.00$/, '')}" inputmode="decimal"></td>
  <td><input class="num" name="stock_${r.id}" value="${r.stock}" type="number" min="0"></td>
</tr>`)}
</tbody></table></div>
<div class="a-actions"><button class="btn btn-gold">Save stock &amp; prices</button></div>
</form>`,
  });
}

function reviews(s, { list, products, flash }) {
  return alayout(s, {
    title: 'Reviews', flash, body: html`
<h1>Reviews</h1>
<p class="flash warn">Only add <strong>real</strong> reviews from real clients (e.g. copied from WhatsApp, Instagram or TikTok comments, with their permission). The reviews section on the homepage only appears once you add one.</p>
<form method="post" action="/admin/reviews" class="a-form a-card">
  <div class="two"><label>Client name (first name + initial)<input name="name" required maxlength="60"></label>
  <label>Rating<select name="rating">${[5, 4, 3, 2, 1].map((n) => html`<option>${n}</option>`)}</select></label></div>
  <label>Review text<textarea name="text" rows="3" required maxlength="800"></textarea></label>
  <div class="two"><label>Where it came from<input name="source" placeholder="e.g. Instagram, WhatsApp"></label>
  <label>Product (optional)<select name="product_id"><option value="">–</option>${products.map((p) => html`<option value="${p.id}">${p.name}</option>`)}</select></label></div>
  <button class="btn btn-gold">Add review</button>
</form>
<section class="a-card">${list.length ? html`<table class="tbl"><tbody>${list.map((r) => html`<tr><td>${'★'.repeat(r.rating)}</td><td>${r.text}<br><span class="muted small">– ${r.name} ${r.source ? '(' + r.source + ')' : ''}</span></td><td><form method="post" action="/admin/reviews/${r.id}/delete" data-confirm="Delete this review?"><button class="btn btn-danger btn-sm">Delete</button></form></td></tr>`)}</tbody></table>` : html`<p class="muted">No reviews yet.</p>`}</section>`,
  });
}

function settings(s, { flash, cardEnabled, mailOn, methods = [] }) {
  const t = (k, label, help = '', type = 'text') => html`<label>${label}${help ? html`<small>${help}</small>` : ''}<input type="${type}" name="${k}" value="${s[k]}"></label>`;
  const ta = (k, label, help = '', rows = 8) => html`<label>${label}${help ? html`<small>${help}</small>` : ''}<textarea name="${k}" rows="${rows}">${s[k]}</textarea></label>`;
  const rands = (k) => ((parseInt(s[k], 10) || 0) / 100).toFixed(2).replace(/\.00$/, '');
  return alayout(s, {
    title: 'Settings', flash, body: html`
<h1>Settings</h1>
<form method="post" action="/admin/settings" class="a-form" data-settings-form>
<section class="a-card"><h2>Contact &amp; social</h2>
  ${t('whatsapp', 'WhatsApp number', 'International format, e.g. 27821234567 (no + or spaces)')}
  ${t('email', 'Email shown to clients and used for order notifications', '', 'email')}
  ${t('phone_display', 'Phone number shown on site (optional)')}
  ${t('location', 'Area shown publicly', 'City or province only, e.g. “Johannesburg”. Never your home address.')}
  ${t('instagram', 'Instagram link', 'https://instagram.com/…', 'url')}
  ${t('tiktok', 'TikTok link', 'https://www.tiktok.com/@…', 'url')}
</section>
<section class="a-card"><h2>Homepage</h2>
  ${t('slogan', 'Slogan')}
  ${ta('intro', 'Short introduction', '', 4)}
  <input type="hidden" name="hero_image" value="${s.hero_image}" data-hero-input>
  <div data-hero-preview>${s.hero_image ? html`<img class="a-hero" src="${s.hero_image}" alt="">` : html`<p class="muted small">Using the placeholder image. Upload a real photo of your hair.</p>`}</div>
  <label class="btn btn-outline btn-sm file-btn">Upload homepage photo<input type="file" accept="image/jpeg,image/png,image/webp" data-upload-hero hidden></label>
  <p class="upload-status" data-upload-status></p>
</section>
<section class="a-card"><h2>Delivery options</h2>
  <p class="muted small">Clients choose one of these at checkout and see its fee before they pay. They also appear on pre-order product pages, so WhatsApp enquiries include the delivery and total. <strong>Leave the fee empty to hide an option</strong> (e.g. until you have confirmed its price). Clear the name to remove an option; use the empty row to add one.</p>
  <div class="tbl-wrap"><table class="tbl dm-tbl"><thead><tr><th>Option name</th><th>Fee (R)</th><th>Delivery time after dispatch</th><th>Client gives</th></tr></thead><tbody>
  ${[...methods, { id: '', name: '', fee: null, time: '', type: 'address' }].map((m, i) => html`<tr>
    <td><input type="hidden" name="dm_id_${i}" value="${m.id}"><input name="dm_name_${i}" value="${m.name}" placeholder="Add an option"></td>
    <td><input class="num" name="dm_fee_${i}" value="${m.fee == null ? '' : (m.fee / 100).toFixed(2).replace(/\.00$/, '')}" inputmode="decimal" placeholder="not offered"></td>
    <td><input name="dm_time_${i}" value="${m.time}" placeholder="e.g. 2–4 business days"></td>
    <td><select name="dm_type_${i}"><option value="address" ${m.type !== 'paxi' ? raw('selected') : ''}>Street address</option><option value="paxi" ${m.type === 'paxi' ? raw('selected') : ''}>PEP store (PAXI point)</option></select></td>
  </tr>`)}
  </tbody></table></div>
  <input type="hidden" name="dm_count" value="${methods.length + 1}">
  <div class="two"><label>Free delivery over (R)<small>0 = never free</small><input name="free_delivery_over" value="${rands('free_delivery_over_cents')}" inputmode="decimal"></label>
  ${t('prep_time', 'Time to prepare a ready-to-ship order', 'Your time, after payment. e.g. 1–2 business days')}</div>
  ${t('preorder_time', 'Default pre-order lead time', 'Used when a pre-order product has no lead time of its own')}
  ${t('courier_name', 'Usual courier', 'Pre-filled when you dispatch a courier order, e.g. The Courier Guy')}
</section>
<section class="a-card"><h2>EFT payment</h2>
  ${t('payment_hours', 'Hours a client has to pay', 'Unpaid orders are cancelled after this and stock is released', 'number')}
  <div class="two">${t('bank_name', 'Bank')}${t('bank_account_name', 'Account holder')}</div>
  <div class="two">${t('bank_account_number', 'Account number')}${t('bank_branch_code', 'Branch code')}</div>
  ${t('bank_account_type', 'Account type', 'e.g. Cheque / Business')}
  <p class="muted small">Card payments (PayFast): <strong>${cardEnabled ? 'switched on' : 'not set up'}</strong>. Order emails: <strong>${mailOn ? 'switched on' : 'not set up'}</strong>. These are set up on the server; see Help.</p>
</section>
<section class="a-card"><h2>Policies &amp; hair care</h2>
  <p class="muted small">Blank line = new paragraph. Start a line with “## ” for a heading and “- ” for a bullet. {prep_time}, {delivery_options} (your delivery options and fees) and {care_default} are filled in automatically.</p>
  ${ta('care_default', 'Standard hair-care text (used on product pages)', '', 6)}
  ${ta('policy_haircare', 'Hair care page')}
  ${ta('policy_delivery', 'Delivery page')}
  ${ta('policy_returns', 'Returns & refunds page')}
  ${ta('policy_privacy', 'Privacy page')}
  <label class="check"><input type="checkbox" name="policies_confirmed" value="1" ${s.policies_confirmed === '1' ? raw('checked') : ''}> I have confirmed these policies (removes the “draft” notice)</label>
</section>
<div class="a-actions sticky"><button class="btn btn-gold">Save settings</button></div>
</form>`,
  });
}

function help(s, { base }) {
  return alayout(s, {
    title: 'Help', body: html`
<h1>How to run your shop</h1>
<section class="a-card prose">
<h2>Add a product</h2>
<ol><li>Go to <a href="/admin/products/new">Products → Add product</a>.</li>
<li>Choose the <strong>category</strong>. It tells clients exactly what they’re buying: <em>Complete wig</em>, <em>Set of 3 bundles</em>, or <em>Closure / frontal only</em>.</li>
<li>Choose <strong>Ready to ship</strong> if you have it now, or <strong>Pre-order</strong> if not (clients will see “Enquire on WhatsApp”).</li>
<li>Fill in texture, colour, lace and density.</li>
<li>Under <strong>Options, prices &amp; stock</strong> type the option name (usually “Length”), then add one row per length with its price and how many you have.</li>
<li>Upload photos (and a short video if you have one), then <strong>Save</strong>.</li></ol>
<h2>Change prices or update stock</h2>
<p>Use <a href="/admin/stock">Stock &amp; prices</a>: change the numbers and press Save. Stock drops automatically when someone orders, so nobody can buy hair that has sold out. If an EFT order isn’t paid by its deadline, it expires and the stock comes back.</p>
<h2>Orders and payments</h2>
<ol><li>New orders appear under <a href="/admin/orders?status=awaiting_payment">Awaiting payment</a>.</li>
<li>When the money <strong>shows in your bank account</strong> (check the reference, e.g. NLH-7KQ2XA), open the order and press <strong>Mark as paid</strong>. The client is emailed (if email is set up), and you can WhatsApp them with one tap.</li>
<li>Card payments through PayFast are marked paid automatically.</li></ol>
<h2>Dispatch and tracking</h2>
<p>Open a paid order, enter the courier and tracking number (and tracking link), then press <strong>Mark as dispatched</strong>. The client’s order page updates straight away; use the WhatsApp button to send them the tracking.</p>
<h2>Links for TikTok and Instagram</h2>
<p>Every product has a short link, e.g. <code>${base}/p/body-wave-13x4-frontal-wig</code>. Copy it from the <a href="/admin/products">Products</a> list and put it in your bio link, story link sticker or comments. It opens the exact product with its price and an Add to cart button.</p>
<p>To open a specific length, use the link on the product’s edit page with <code>?v=</code> plus the option number. To see which platform an order came from, add <code>?src=tiktok</code> or <code>?src=instagram</code> to the link; it shows on the order as “Came from”.</p>
<h2>Reviews</h2><p>Add only real client reviews under <a href="/admin/reviews">Reviews</a>.</p>
</section>`,
  });
}

module.exports = { login, dashboard, orders, order, products, productForm, stock, reviews, settings, help, esc };
