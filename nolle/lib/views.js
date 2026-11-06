'use strict';
const { html, raw, esc, money, fmtDate, waLink, richText } = require('./util');
const { CATEGORIES, usedCategories, deliveryMethods } = require('./db');

const feeText = (c) => (c ? money(c) : 'Free');
const timeText = (m) => (m.time ? `${m.time} after dispatch` : 'Transit time depends on the service chosen');
function deliveryOptionsText(s) {
  const list = deliveryMethods(s);
  if (!list.length) return 'Delivery fees are confirmed with you on WhatsApp.';
  const free = parseInt(s.free_delivery_over_cents, 10) || 0;
  return list.map((m) => `- ${m.name}: ${feeText(m.fee)} – ${timeText(m)}`).join('\n')
    + (free > 0 ? `\n- Free delivery on orders over ${money(free)}` : '');
}

const STATUS = {
  awaiting_payment: { label: 'Awaiting payment', tone: 'warn' },
  paid: { label: 'Paid – being prepared', tone: 'ok' },
  dispatched: { label: 'Dispatched', tone: 'ok' },
  delivered: { label: 'Delivered', tone: 'ok' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
  expired: { label: 'Expired – not paid in time', tone: 'muted' },
};

const ICON = {
  wa: raw('<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.5-.3Z"/></svg>'),
  bag: raw('<svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M5 8h14l-1 12H6L5 8Zm4 0V6a3 3 0 0 1 6 0v2"/></svg>'),
  truck: raw('<svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M3 6h11v9H3zM14 9h4l3 3v3h-7M7 18a1.5 1.5 0 1 0 0-.1M17 18a1.5 1.5 0 1 0 0-.1"/></svg>'),
  ig: raw('<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17.5" cy="6.5" r="1.1" fill="currentColor"/></svg>'),
  tt: raw('<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path fill="currentColor" d="M16.6 3c.4 2 1.7 3.4 3.9 3.6v3a7 7 0 0 1-3.9-1.2v6.3A5.7 5.7 0 1 1 11 9v3.1a2.7 2.7 0 1 0 2.6 2.7V3h3Z"/></svg>'),
};

const PLACEHOLDER = '/static/img/photo-coming-soon.svg';
const LOOKBOOK = [
  ['brown-straight-portrait', 'Long silky straight hair in rich brown', 'tall'],
  ['backs-five-textures', 'Five Nolle’ textures from behind: brown straight, body wave, straight, deep curly and bone straight', 'wide'],
  ['wavy-black-portrait', 'Shoulder-length black body wave', 'tall'],
  ['duo-curly-and-wavy', 'Deep curly and body wave hair side by side', 'wide'],
  ['straight-black-portrait', 'Long black straight hair with face-framing layers', 'tall'],
  ['group-styling-tools', 'Nolle’ models styling their hair with a brush and dryer', 'wide'],
  ['straight-black-styling', 'Long black straight hair being styled', 'tall'],
  ['trio-profiles', 'Three profiles showing long straight black and brown hair', 'wide'],
];
const img0 = (p) => (p.images && p.images[0]) || PLACEHOLDER;

function priceLabel(p) {
  const from = p.min_price !== p.max_price ? 'From ' : '';
  return from + money(p.min_price);
}
function bundleNote(p) {
  return p.category === 'bundles' ? html`<span class="price-note">for a set of 3 bundles</span>` : '';
}

/* ------------------------------ Layout ------------------------------ */
function layout(s, { title, description, body, canonical, image, bodyClass = '', noindex = false, jsonld }) {
  const full = title ? `${title} | ${s.shop_name}` : `${s.shop_name} – ${s.slogan}`;
  const desc = description || s.intro;
  const year = new Date().getFullYear();
  return html`<!doctype html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${full}</title>
<meta name="description" content="${desc}">
${noindex ? raw('<meta name="robots" content="noindex">') : ''}
${canonical ? html`<link rel="canonical" href="${canonical}">` : ''}
<meta property="og:site_name" content="${s.shop_name}">
<meta property="og:title" content="${full}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
${canonical ? html`<meta property="og:url" content="${canonical}">` : ''}
${image ? html`<meta property="og:image" content="${image}"><meta name="twitter:card" content="summary_large_image">` : ''}
<meta name="theme-color" content="#fbf0ee">
<link rel="icon" href="/static/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/static/css/style.css?v=1">
${jsonld ? raw(`<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>`) : ''}
</head>
<body class="${bodyClass}" data-wa="${String(s.whatsapp).replace(/\D/g, '')}">
<a class="skip" href="#main">Skip to content</a>
<div class="announce">${ICON.truck}<span>Nationwide delivery across South Africa</span><span class="dot">·</span><a href="${waLink(s.whatsapp, 'Hi Nolle’ Luxury Hair, I need help choosing hair.')}" target="_blank" rel="noopener">Need help choosing? WhatsApp us</a></div>
<header class="site-header">
  <div class="wrap header-inner">
    <button class="nav-toggle" aria-label="Menu" aria-expanded="false" aria-controls="site-nav"><span></span><span></span><span></span></button>
    <a class="logo" href="/" aria-label="${s.shop_name} home"><span class="logo-name">Nolle’</span><span class="logo-sub">Luxury Hair</span></a>
    <nav id="site-nav" class="site-nav" aria-label="Main">
      <a href="/shop">Shop</a>
      ${usedCategories().map((k) => html`<a href="/shop?cat=${k}">${CATEGORIES[k].label}</a>`)}
      <a href="/hair-care">Hair Care</a>
      <a href="/delivery">Delivery</a>
      <a href="/track">Track Order</a>
      <a href="/contact">Contact</a>
    </nav>
    <a class="cart-link" href="/cart" aria-label="Cart">${ICON.bag}<span class="cart-count" data-cart-count hidden>0</span></a>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <a class="logo logo-footer" href="/"><span class="logo-name">Nolle’</span><span class="logo-sub">Luxury Hair</span></a>
      <p class="slogan-sm">${s.slogan}</p>
      <p class="muted">Based in ${s.location}. Delivering nationwide.</p>
      <div class="socials">
        ${s.instagram ? html`<a href="${s.instagram}" target="_blank" rel="noopener" aria-label="Instagram">${ICON.ig}</a>` : ''}
        ${s.tiktok ? html`<a href="${s.tiktok}" target="_blank" rel="noopener" aria-label="TikTok">${ICON.tt}</a>` : ''}
        <a href="${waLink(s.whatsapp)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ICON.wa}</a>
      </div>
    </div>
    <div>
      <h4>Shop</h4>
      <a href="/shop">All available hair</a>
      ${usedCategories().map((k) => html`<a href="/shop?cat=${k}">${CATEGORIES[k].label}</a>`)}
      <a href="/track">Track my order</a>
    </div>
    <div>
      <h4>Information</h4>
      <a href="/hair-care">Hair care</a>
      <a href="/delivery">Delivery</a>
      <a href="/returns">Returns &amp; refunds</a>
      <a href="/privacy">Privacy</a>
      <a href="/contact">Contact us</a>
    </div>
    <div>
      <h4>Contact</h4>
      <a href="${waLink(s.whatsapp, 'Hi Nolle’ Luxury Hair')}" target="_blank" rel="noopener">WhatsApp</a>
      <a href="mailto:${s.email}">${s.email}</a>
      ${s.phone_display ? html`<a href="tel:${s.phone_display.replace(/[^\d+]/g, '')}">${s.phone_display}</a>` : ''}
    </div>
  </div>
  <div class="wrap footer-base">© ${year} ${s.shop_name}. All rights reserved.</div>
</footer>
<a class="wa-float" href="${waLink(s.whatsapp, 'Hi Nolle’ Luxury Hair, I would like some assistance please.')}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp" data-wa-float>${ICON.wa}<span>Chat with us</span></a>
<script src="/static/js/shop.js?v=1" defer></script>
</body>
</html>`;
}

/* ------------------------------ Pieces ------------------------------ */
function productCard(p) {
  const badge = p.availability === 'enquire'
    ? html`<span class="badge badge-pre">Pre-order · Enquire</span>`
    : p.sold_out ? html`<span class="badge badge-out">Sold out</span>` : html`<span class="badge badge-ready">Ready to ship</span>`;
  return html`<article class="card">
  <a href="/product/${p.slug}" class="card-link">
    <div class="card-img"><img src="${img0(p)}" alt="${p.name}" loading="lazy" width="600" height="750">${badge}</div>
    <div class="card-body">
      <p class="kind">${p.cat.kind}</p>
      <h3>${p.name}</h3>
      ${p.is_sample ? html`<p class="sample-flag">Sample listing</p>` : ''}
      <p class="price">${priceLabel(p)} ${bundleNote(p)}</p>
    </div>
  </a>
</article>`;
}

function steps() {
  return html`<ol class="steps">
  <li><span>1</span><strong>Choose your hair</strong><em>Pick your length and options.</em></li>
  <li><span>2</span><strong>Checkout as a guest</strong><em>Add your delivery details – no account needed.</em></li>
  <li><span>3</span><strong>Pay securely</strong><em>EFT with your unique order reference.</em></li>
  <li><span>4</span><strong>We dispatch</strong><em>You get a confirmation, then tracking once it ships.</em></li>
</ol>`;
}

function draftNotice(s) {
  return s.policies_confirmed === '1' ? '' : html`<p class="draft-note">This policy is a draft and is still being confirmed.</p>`;
}

function fillPolicy(text, s) {
  const vars = { ...s, delivery_options: deliveryOptionsText(s), courier_time: (deliveryMethods(s)[0] || {}).time || 'a few business days' };
  return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
}

/* ------------------------------ Pages ------------------------------ */
function home(s, { featured, reviews, base, mode = 'ready' }) {
  const hero = s.hero_image || '/static/img/brand/group-holding-box.jpg';
  const body = html`
<section class="hero">
  <div class="hero-media"><img src="${hero}" alt="Five women wearing Nolle’ Luxury Hair, holding the Nolle’ gift box" width="1600" height="1067" fetchpriority="high"></div>
  <div class="hero-copy">
    <p class="eyebrow">Nolle’ Luxury Hair</p>
    <h1 class="slogan">${s.slogan.split('. ').map((part, i, a) => html`<span>${part}${i < a.length - 1 ? '.' : ''}</span>`)}</h1>
    <p class="lead">Luxury wigs, bundles and closures – ready to ship, delivered nationwide.</p>
    <div class="cta-row">
      <a class="btn btn-gold" href="/shop">Shop Available Hair</a>
      <a class="btn btn-outline" href="${waLink(s.whatsapp, 'Hi Nolle’ Luxury Hair, I need help choosing hair.')}" target="_blank" rel="noopener">${ICON.wa} WhatsApp for assistance</a>
    </div>
    <p class="hero-note">${ICON.truck} We deliver nationwide across South Africa</p>
  </div>
</section>

<section class="section wrap">
  <div class="section-head">
    <p class="eyebrow">${mode === 'ready' ? 'Available now' : 'Order now'}</p>
    <h2>${mode === 'ready' ? 'Ready to Ship' : 'Available to Pre-order'}</h2>
    ${mode === 'ready' ? '' : html`<p class="muted">Prices in rands. Bundle prices are for a set of 3 bundles. Enquire on WhatsApp to confirm your order and lead time.</p>`}
    <a class="link-gold" href="/shop">View all available hair →</a>
  </div>
  ${featured.length ? html`<div class="grid">${featured.map(productCard)}</div>`
    : html`<p class="empty">New stock is on its way. <a href="${waLink(s.whatsapp, 'Hi, what hair do you have available?')}">Ask us on WhatsApp</a> what’s available.</p>`}
</section>

<section class="intro-band">
  <div class="wrap intro">
    <div class="crown" aria-hidden="true">♛</div>
    <h2>Welcome to Nolle’</h2>
    <p>${s.intro}</p>
    <div class="trust">
      <div><strong>Nationwide delivery</strong><span>Courier to your door, anywhere in SA</span></div>
      <div><strong>Guest checkout</strong><span>No account needed</span></div>
      <div><strong>Real stock</strong><span>What you see is what we have</span></div>
    </div>
  </div>
</section>

<section class="section wrap">
  <div class="section-head center"><p class="eyebrow">Real hair, real women</p><h2>The Nolle’ Look</h2><p class="muted">Bone straight, body wave, deep curly and rich brown – every texture photographed on our own models.</p></div>
  <div class="lookbook">
    ${LOOKBOOK.map(([src, alt, cls]) => html`<figure class="${cls || ''}"><img src="/static/img/brand/${src}.jpg" alt="${alt}" loading="lazy"></figure>`)}
  </div>
  ${s.instagram || s.tiktok ? html`<p class="center follow">See more on ${s.instagram ? html`<a href="${s.instagram}" target="_blank" rel="noopener">Instagram</a>` : ''}${s.instagram && s.tiktok ? ' and ' : ''}${s.tiktok ? html`<a href="${s.tiktok}" target="_blank" rel="noopener">TikTok</a>` : ''}</p>` : ''}
</section>

<section class="section wrap">
  <div class="section-head center"><p class="eyebrow">Simple ordering</p><h2>How it works</h2></div>
  ${steps()}
</section>

${reviews.length ? html`<section class="section wrap">
  <div class="section-head center"><p class="eyebrow">From our clients</p><h2>Reviews</h2></div>
  <div class="reviews">${reviews.map((r) => html`<figure class="review"><div class="stars" aria-label="${r.rating} out of 5">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div><blockquote>${r.text}</blockquote><figcaption>– ${r.name}${r.source ? html` <span class="muted">(${r.source})</span>` : ''}</figcaption></figure>`)}</div>
</section>` : ''}

<section class="help-band photo">
  <div class="wrap help">
    <h2>Not sure which hair to choose?</h2>
    <p>Tell us the look you want, your budget and when you need it – we’ll help you choose the right texture, length and lace.</p>
    <a class="btn btn-gold" href="${waLink(s.whatsapp, 'Hi Nolle’ Luxury Hair, please help me choose hair. The look I want is: ')}" target="_blank" rel="noopener">${ICON.wa} Get help on WhatsApp</a>
  </div>
</section>`;
  return layout(s, {
    body, canonical: base + '/', image: base + hero, bodyClass: 'home',
    jsonld: { '@context': 'https://schema.org', '@type': 'Store', name: s.shop_name, slogan: s.slogan, url: base, areaServed: 'ZA' },
  });
}

function shop(s, { products, cat, base }) {
  const usedCats = Object.keys(CATEGORIES).filter((k) => products.some((p) => p.category === k));
  const shown = cat && usedCats.includes(cat) ? products.filter((p) => p.category === cat) : products;
  const ready = shown.filter((p) => p.availability === 'ready');
  const pre = shown.filter((p) => p.availability !== 'ready');
  const title = cat && CATEGORIES[cat] && usedCats.includes(cat) ? CATEGORIES[cat].label : 'Shop Available Hair';
  const body = html`
<section class="page-head">
  <p class="eyebrow">Shop</p>
  <h1>${title}</h1>
  <p>Prices in rands, including the hair only. Delivery is added at checkout. <strong>Bundle prices are for a set of 3 bundles.</strong></p>
</section>
<div class="wrap">
  ${usedCats.length > 1 ? html`<nav class="chips" aria-label="Categories">
    <a class="chip ${!cat || !usedCats.includes(cat) ? 'on' : ''}" href="/shop">All</a>
    ${usedCats.map((k) => html`<a class="chip ${cat === k ? 'on' : ''}" href="/shop?cat=${k}">${CATEGORIES[k].label}</a>`)}
  </nav>` : ''}

  <section class="section" id="ready">
    <div class="section-head"><h2>Ready to Ship</h2><p class="muted">In stock now. Dispatched within ${s.prep_time} of payment.</p></div>
    ${ready.length ? html`<div class="grid">${ready.map(productCard)}</div>` : html`<p class="empty">Ready-to-ship stock will be listed here as it arrives. ${pre.length ? 'Right now our hair is available to pre-order below.' : ''}</p>`}
  </section>

  ${pre.length ? html`<section class="section" id="pre-order">
    <div class="section-head"><h2>Pre-order</h2><p class="muted">Enquire on WhatsApp to confirm availability and lead time. Full payment confirms a pre-order. Prices subject to confirmation.</p></div>
    <div class="grid">${pre.map(productCard)}</div>
  </section>` : ''}
</div>`;
  return layout(s, { title, body, canonical: base + '/shop' + (cat ? '?cat=' + cat : '') });
}

function product(s, { p, base, preselect }) {
  const enquire = p.availability !== 'ready';
  const images = p.images.length ? p.images : [PLACEHOLDER];
  const data = {
    id: p.id, name: p.name, slug: p.slug, category: p.category, kind: p.cat.kind, enquire,
    optionNames: p.option_names, url: `${base}/product/${p.slug}`,
    variants: p.variants.map((v) => ({ id: v.id, options: v.options, price: v.price_cents, stock: Math.max(0, v.stock) })),
    preselect: preselect || null, image: images[0],
    delivery: deliveryMethods(s).map((m) => ({ id: m.id, name: m.name, fee: m.fee })),
    freeOver: parseInt(s.free_delivery_over_cents, 10) || 0,
  };
  const details = [
    ['What you’re buying', p.cat.kind],
    ['Texture', p.texture],
    ['Length', p.option_names.some((n) => /length/i.test(n)) ? raw('<span data-detail-length>Select an option</span>') : p.length],
    ['Colour', p.colour],
    ['Lace', p.lace],
    ['Density', p.density],
    ['Included', p.includes],
  ].filter(([, v]) => v);
  const care = p.care || s.care_default;
  const waText = `Hi Nolle’ Luxury Hair, I’m interested in: ${p.name}. ${base}/product/${p.slug}`;
  const body = html`
<nav class="crumbs wrap" aria-label="Breadcrumb"><a href="/shop">Shop</a> / <a href="/shop?cat=${p.category}">${p.cat.label}</a> / <span>${p.name}</span></nav>
<section class="wrap product">
  <div class="gallery">
    <div class="gallery-main"><img src="${images[0]}" alt="${p.name}" data-main-img width="900" height="1100"></div>
    ${images.length > 1 || p.video ? html`<div class="thumbs">
      ${images.map((src, i) => html`<button type="button" class="thumb ${i === 0 ? 'on' : ''}" data-thumb="${src}"><img src="${src}" alt="${p.name} photo ${i + 1}" loading="lazy"></button>`)}
    </div>` : ''}
    ${p.video ? html`<video class="product-video" src="${p.video}" controls playsinline preload="metadata" muted></video>` : ''}
  </div>

  <div class="buy">
    ${enquire ? html`<span class="badge badge-pre inline">Pre-order · Enquire on WhatsApp</span>` : html`<span class="badge badge-ready inline">Ready to ship</span>`}
    <h1>${p.name}</h1>
    ${p.is_sample ? html`<p class="sample-flag">Sample listing – details will be replaced with real stock</p>` : ''}
    <p class="price big"><span data-price>${priceLabel(p)}</span> ${bundleNote(p)}</p>
    <div class="kind-box"><strong>${p.cat.kind}.</strong> ${p.cat.kindLong}</div>
    ${enquire ? html`<p class="pre-note">Pre-order price, subject to confirmation. Full payment confirms your order.</p>` : ''}
    ${p.short ? html`<p class="short">${p.short}</p>` : ''}

    <form class="buy-form" data-buy-form>
      ${p.option_names.map((name) => {
        const values = [...new Set(p.variants.map((v) => v.options[name]).filter(Boolean))];
        return html`<fieldset class="opt" data-opt="${name}">
          <legend>${name}: <span data-opt-value></span></legend>
          <div class="opt-values">${values.map((val) => html`<button type="button" class="opt-btn" data-value="${val}">${val}</button>`)}</div>
        </fieldset>`;
      })}
      <p class="stock" data-stock aria-live="polite"></p>
      ${enquire && deliveryMethods(s).length ? html`<fieldset class="opt" data-delivery-opt>
        <legend>Delivery: <span data-delivery-value></span></legend>
        <div class="opt-values">${deliveryMethods(s).map((m) => html`<button type="button" class="opt-btn" data-delivery="${m.id}">${m.name} · ${feeText(m.fee)}</button>`)}</div>
      </fieldset>
      <p class="wa-total" data-wa-total aria-live="polite"></p>` : ''}
      ${enquire ? '' : html`<div class="qty-row">
        <label class="qty"><span>Qty</span><input type="number" name="qty" min="1" max="1" value="1" inputmode="numeric" data-qty></label>
        <button class="btn btn-gold btn-block" type="submit" data-add>Add to cart</button>
      </div>`}
      <a class="btn ${enquire ? 'btn-gold' : 'btn-outline'} btn-block" data-wa-enquire href="${waLink(s.whatsapp, waText)}" target="_blank" rel="noopener">${ICON.wa} ${enquire ? 'Enquire on WhatsApp' : 'Ask about this on WhatsApp'}</a>
      <p class="added" data-added hidden>Added to your cart. <a href="/cart">View cart &amp; checkout →</a></p>
    </form>

    <div class="ship-box">
      <div><strong>${enquire ? 'Pre-order lead time' : 'Order preparation'}</strong><span>${enquire ? (p.lead_time || s.preorder_time) : s.prep_time + ' after payment'}</span></div>
      ${deliveryMethods(s).length ? deliveryMethods(s).map((m) => html`<div><strong>${m.name}</strong><span>${feeText(m.fee)} · ${timeText(m)}</span></div>`)
        : html`<div><strong>Delivery</strong><span>Fee confirmed on WhatsApp</span></div>`}
      ${parseInt(s.free_delivery_over_cents, 10) > 0 ? html`<div><strong>Free delivery</strong><span>on orders over ${money(s.free_delivery_over_cents)}</span></div>` : ''}
    </div>

    <dl class="details">${details.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>

    ${p.description ? html`<details class="acc" open><summary>Description</summary><div>${richText(p.description)}</div></details>` : ''}
    <details class="acc"><summary>Hair care</summary><div>${richText(care)}<p><a href="/hair-care">Full hair-care guide →</a></p></div></details>
    <details class="acc"><summary>Delivery &amp; returns</summary><div><p>Delivery only (no collection)${deliveryMethods(s).length ? ': ' + deliveryMethods(s).map((m) => `${m.name} ${feeText(m.fee)}`).join(' · ') : ''}. ${enquire ? `Pre-order lead time: ${p.lead_time || s.preorder_time}, then delivery.` : `We prepare your order within ${s.prep_time} of payment, then it is delivered.`} <a href="/delivery">Delivery info</a> · <a href="/returns">Returns</a></p></div></details>
  </div>
</section>
<section class="help-band slim"><div class="wrap help"><h2>Need help choosing?</h2><a class="btn btn-outline" href="${waLink(s.whatsapp, `Hi, I need help choosing. I’m looking at ${p.name}.`)}" target="_blank" rel="noopener">${ICON.wa} Chat to us on WhatsApp</a></div></section>
<script type="application/json" id="product-data">${raw(JSON.stringify(data).replace(/</g, '\\u003c'))}</script>`;
  const image = images[0].startsWith('http') ? images[0] : base + images[0];
  return layout(s, {
    title: p.name,
    description: `${p.cat.kind} – ${priceLabel(p)}${p.category === 'bundles' ? ' for a set of 3 bundles' : ''}. ${p.short || ''}`.trim(),
    body, canonical: `${base}/product/${p.slug}`, image, bodyClass: 'product-page',
    jsonld: {
      '@context': 'https://schema.org', '@type': 'Product', name: p.name, image: [image], description: p.short || p.description,
      offers: p.variants.map((v) => ({ '@type': 'Offer', priceCurrency: 'ZAR', price: (v.price_cents / 100).toFixed(2), availability: enquire ? 'https://schema.org/PreOrder' : v.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: `${base}/product/${p.slug}?v=${v.id}` })),
    },
  });
}

function cart(s, { base }) {
  const body = html`
<section class="page-head"><p class="eyebrow">Your cart</p><h1>Cart</h1></section>
<div class="wrap cart-wrap" data-cart-page>
  <div class="cart-items" data-cart-items><p class="muted">Loading…</p></div>
  <aside class="summary" data-cart-summary hidden>
    <h2>Summary</h2>
    <div class="sum-row"><span>Subtotal</span><span data-subtotal></span></div>
    <div class="sum-row"><span data-delivery-label>Delivery</span><span data-delivery></span></div>
    <div class="sum-row total"><span>Total</span><span data-total></span></div>
    <p class="muted small">Choose your delivery at checkout: ${deliveryMethods(s).map((m) => `${m.name} (${feeText(m.fee)})`).join(' · ') || 'confirmed on WhatsApp'}.</p>
    <a class="btn btn-gold btn-block" href="/checkout">Checkout</a>
    <a class="link-gold" href="/shop">← Continue shopping</a>
  </aside>
</div>`;
  return layout(s, { title: 'Cart', body, canonical: base + '/cart', noindex: true });
}

const PROVINCES = ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'];

function checkout(s, { base, cardEnabled }) {
  const body = html`
<section class="page-head"><p class="eyebrow">Secure checkout</p><h1>Checkout</h1><p>No account needed. Your order is only confirmed once payment is received.</p></section>
<div class="wrap checkout" data-checkout-page>
  <form class="co-form" data-checkout-form novalidate>
    <h2>1. Your details</h2>
    <label>Full name<input name="name" autocomplete="name" required maxlength="100"></label>
    <div class="two">
      <label>Phone (WhatsApp)<input name="phone" type="tel" autocomplete="tel" inputmode="tel" required placeholder="e.g. 082 123 4567" maxlength="20"></label>
      <label>Email<input name="email" type="email" autocomplete="email" required maxlength="120"></label>
    </div>
    <h2>2. Delivery</h2>
    ${deliveryMethods(s).length ? html`<div class="pay-opts">
      ${deliveryMethods(s).map((m, i) => html`<label class="pay-opt"><input type="radio" name="delivery_method" value="${m.id}" data-type="${m.type}" data-name="${m.name}" data-time="${timeText(m)}" ${i === 0 ? raw('checked') : ''} required><span><strong>${m.name} – ${feeText(m.fee)}</strong><em>${m.type === 'paxi' ? 'Collect from the PEP store of your choice. ' : 'Delivered to your address. '}${timeText(m)}.</em></span></label>`)}
    </div>` : html`<p class="warn-box">Online delivery is not set up yet – please <a href="${waLink(s.whatsapp, 'Hi, I would like to place an order.')}">order on WhatsApp</a>.</p>`}
    <div class="addr" data-addr="address">
      <label>Street address<input name="address1" autocomplete="address-line1" required maxlength="150"></label>
      <label>Complex / unit / building <span class="opt-l">(optional)</span><input name="address2" autocomplete="address-line2" maxlength="150"></label>
      <div class="two">
        <label>Suburb<input name="suburb" autocomplete="address-level3" required maxlength="80"></label>
        <label>Postal code<input name="postal_code" autocomplete="postal-code" inputmode="numeric" required pattern="\\d{4}" maxlength="4"></label>
      </div>
    </div>
    <div class="addr" data-addr="paxi" hidden>
      <label>PEP store (PAXI point)<input name="paxi_point" required maxlength="120" placeholder="e.g. PEP Rosebank Mall"></label>
      <p class="muted small">We send your parcel to this PEP store. You collect it there once you receive the PAXI SMS.</p>
    </div>
    <div class="two">
      <label>City / town<input name="city" autocomplete="address-level2" required maxlength="80"></label>
      <label>Province<select name="province" required><option value="">Choose…</option>${PROVINCES.map((p) => html`<option>${p}</option>`)}</select></label>
    </div>
    <label>Delivery notes <span class="opt-l">(optional)</span><textarea name="notes" rows="2" maxlength="500" placeholder="e.g. gate code, best time to deliver"></textarea></label>

    <h2>3. Payment</h2>
    <div class="pay-opts">
      <label class="pay-opt"><input type="radio" name="payment_method" value="eft" checked><span><strong>EFT / bank transfer</strong><em>We’ll show our bank details and your unique order reference. Pay within ${s.payment_hours} hours.</em></span></label>
      ${cardEnabled ? html`<label class="pay-opt"><input type="radio" name="payment_method" value="card"><span><strong>Card or Instant EFT (PayFast)</strong><em>Pay securely now. Order confirmed instantly.</em></span></label>` : ''}
    </div>
    <label class="check"><input type="checkbox" name="agree" required> I have read the <a href="/delivery" target="_blank">delivery</a> and <a href="/returns" target="_blank">returns</a> policies and agree to the <a href="/privacy" target="_blank">privacy notice</a>.</label>
    <p class="form-error" data-form-error role="alert" hidden></p>
    <button class="btn btn-gold btn-block" type="submit" data-place-order>Place order</button>
  </form>
  <aside class="summary" data-co-summary>
    <h2>Your order</h2>
    <div data-co-items><p class="muted">Loading…</p></div>
    <div class="sum-row"><span>Subtotal</span><span data-subtotal></span></div>
    <div class="sum-row"><span data-delivery-label>Delivery</span><span data-delivery></span></div>
    <div class="sum-row total"><span>Total to pay</span><span data-total></span></div>
    <div class="ship-box small">
      <div><strong>Preparing your order</strong><span>${s.prep_time} after payment</span></div>
      <div><strong>Delivery time</strong><span data-delivery-time>Depends on the option you choose</span></div>
    </div>
  </aside>
</div>`;
  return layout(s, { title: 'Checkout', body, canonical: base + '/checkout', noindex: true });
}

function bankBlock(s, o) {
  const has = s.bank_account_number;
  return html`<div class="bank">
  <h3>Pay by EFT</h3>
  ${has ? html`<dl>
    <div><dt>Bank</dt><dd>${s.bank_name}</dd></div>
    <div><dt>Account name</dt><dd>${s.bank_account_name}</dd></div>
    <div><dt>Account number</dt><dd><span data-copy>${s.bank_account_number}</span></dd></div>
    <div><dt>Branch code</dt><dd>${s.bank_branch_code}</dd></div>
    ${s.bank_account_type ? html`<div><dt>Account type</dt><dd>${s.bank_account_type}</dd></div>` : ''}
    <div><dt>Amount</dt><dd><strong>${money(o.total_cents)}</strong></dd></div>
    <div><dt>Reference</dt><dd><strong class="ref"><span data-copy>${o.ref}</span></strong></dd></div>
  </dl>` : html`<p class="warn-box">Tap the button below and we’ll send you our bank details on WhatsApp. Please use <strong>${o.ref}</strong> as your payment reference.</p>
  <p><a class="btn btn-gold" href="${waLink(s.whatsapp, `Hi Nolle’ Luxury Hair, I have placed order ${o.ref} for ${money(o.total_cents)}. Please send me your banking details.`)}" target="_blank" rel="noopener">${ICON.wa} Get bank details on WhatsApp</a></p>`}
  <p class="deadline">Please pay by <strong>${fmtDate(o.payment_deadline)}</strong>. Unpaid orders are cancelled automatically after this time and the stock is released.</p>
  <p class="muted small">Your order stays “Awaiting payment” until the money reflects in our account (instant EFTs usually reflect within a few hours; other banks can take 1–2 business days).</p>
  <a class="btn btn-outline" href="${waLink(s.whatsapp, `Hi, I have paid for order ${o.ref} (${money(o.total_cents)}). Here is my proof of payment:`)}" target="_blank" rel="noopener">${ICON.wa} Send proof of payment</a>
</div>`;
}

function orderPage(s, { o, base, cardEnabled, justPlaced, paidReturn }) {
  const st = STATUS[o.status] || { label: o.status, tone: 'muted' };
  const timeline = [
    ['Order placed', o.created_at, true],
    ['Payment confirmed', o.paid_at, !!o.paid_at],
    ['Dispatched', o.dispatched_at, !!o.dispatched_at],
    ['Delivered', o.delivered_at, !!o.delivered_at],
  ];
  const body = html`
<section class="page-head">
  <p class="eyebrow">${justPlaced ? 'Thank you!' : 'Your order'}</p>
  <h1>${justPlaced ? 'Order received' : 'Order ' + o.ref}</h1>
  <p>Order reference <strong class="ref">${o.ref}</strong> · placed ${fmtDate(o.created_at)}</p>
</section>
<div class="wrap order">
  <div class="order-main">
    <div class="status status-${st.tone}"><span>Payment &amp; order status</span><strong data-status="${o.status}">${st.label}</strong></div>
    ${paidReturn && o.status === 'awaiting_payment' ? html`<p class="info-box">Thank you – we’re waiting for PayFast to confirm your payment. Refresh this page in a minute.</p>` : ''}
    ${o.status === 'awaiting_payment' && o.payment_method === 'eft' ? bankBlock(s, o) : ''}
    ${o.status === 'awaiting_payment' && o.payment_method === 'card' && cardEnabled ? html`<div class="bank"><h3>Complete your card payment</h3><p class="deadline">Please pay by <strong>${fmtDate(o.payment_deadline)}</strong>.</p><a class="btn btn-gold" href="/payfast/pay/${o.ref}?t=${o.token}">Pay ${money(o.total_cents)} securely</a></div>` : ''}

    <ol class="timeline">${timeline.map(([label, at, done]) => html`<li class="${done ? 'done' : ''}"><strong>${label}</strong>${at ? html`<span>${fmtDate(at)}</span>` : ''}</li>`)}</ol>

    <div class="ship-box">
      <div><strong>Expected dispatch</strong><span>${o.dispatched_at ? 'Dispatched ' + fmtDate(o.dispatched_at, false) : `Within ${s.prep_time} after payment is confirmed`}</span></div>
      <div><strong>${o.delivery_method || 'Delivery'}</strong><span>${o.delivery_time ? o.delivery_time + ' after dispatch' : 'Transit time depends on the service chosen'}</span></div>
    </div>
    ${o.tracking_number ? html`<div class="tracking"><h3>Tracking</h3><p>${o.courier || 'Courier'}: <strong>${o.tracking_number}</strong></p>${o.tracking_url ? html`<a class="btn btn-gold" href="${o.tracking_url}" target="_blank" rel="noopener">Track your parcel</a>` : ''}</div>`
      : html`<p class="muted small">Tracking details will appear here and be sent to you once your order is dispatched.</p>`}
    <p class="muted small">Save this page – you can return to it any time, or use <a href="/track">Track Order</a> with your reference and phone number.</p>
  </div>
  <aside class="summary">
    <h2>What you bought</h2>
    ${o.items.map((i) => html`<div class="line"><div><strong>${i.product_name}</strong><span class="muted small">${[i.kind_label, i.variant_label].filter(Boolean).join(' · ')} × ${i.qty}</span></div><span>${money(i.unit_cents * i.qty)}</span></div>`)}
    <div class="sum-row"><span>Subtotal</span><span>${money(o.subtotal_cents)}</span></div>
    <div class="sum-row"><span>Delivery${o.delivery_method ? ` – ${o.delivery_method}` : ''}</span><span>${o.delivery_cents ? money(o.delivery_cents) : 'Free'}</span></div>
    <div class="sum-row total"><span>Total</span><span>${money(o.total_cents)}</span></div>
    <h3>Delivering to</h3>
    <p class="small">${o.name}<br>${o.delivery_type === 'paxi' ? html`PEP PAXI point: ${o.paxi_point}<br>${o.city}, ${o.province}` : html`${o.address1}${o.address2 ? html`, ${o.address2}` : ''}<br>${o.suburb}, ${o.city}<br>${o.province}, ${o.postal_code}`}<br>${o.phone} · ${o.email}</p>
    <a class="btn btn-outline btn-block" href="${waLink(s.whatsapp, `Hi, I have a question about my order ${o.ref}.`)}" target="_blank" rel="noopener">${ICON.wa} Questions? WhatsApp us</a>
  </aside>
</div>
${justPlaced ? raw('<script>try{localStorage.removeItem("nolle_cart")}catch(e){}</script>') : ''}`;
  return layout(s, { title: 'Order ' + o.ref, body, noindex: true });
}

function track(s, { error }) {
  const body = html`
<section class="page-head"><p class="eyebrow">Orders</p><h1>Track your order</h1><p>Enter your order reference and the phone number you ordered with.</p></section>
<div class="wrap narrow">
  <form class="co-form" method="post" action="/track">
    ${error ? html`<p class="form-error">${error}</p>` : ''}
    <label>Order reference<input name="ref" required placeholder="NLH-XXXXXX" autocapitalize="characters"></label>
    <label>Phone number<input name="phone" type="tel" required></label>
    <button class="btn btn-gold btn-block">Find my order</button>
  </form>
</div>`;
  return layout(s, { title: 'Track your order', body, noindex: true });
}

function infoPage(s, { title, eyebrow, text, base, path, draft }) {
  const body = html`
<section class="page-head"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></section>
<div class="wrap narrow prose">
  ${draft ? draftNotice(s) : ''}
  ${richText(fillPolicy(text, s))}
</div>`;
  return layout(s, { title, body, canonical: base + path });
}

function contact(s, { base }) {
  const body = html`
<section class="page-head"><p class="eyebrow">We’re here to help</p><h1>Contact us</h1><p>The quickest way to reach us is WhatsApp – for orders, help choosing hair, or questions about your delivery.</p></section>
<div class="wrap contact-grid">
  <a class="contact-card" href="${waLink(s.whatsapp, 'Hi Nolle’ Luxury Hair, I would like some assistance please.')}" target="_blank" rel="noopener">${ICON.wa}<strong>WhatsApp</strong><span>Chat to us</span></a>
  <a class="contact-card" href="mailto:${s.email}"><span class="ic">✉</span><strong>Email</strong><span>${s.email}</span></a>
  ${s.instagram ? html`<a class="contact-card" href="${s.instagram}" target="_blank" rel="noopener">${ICON.ig}<strong>Instagram</strong><span>Follow us</span></a>` : ''}
  ${s.tiktok ? html`<a class="contact-card" href="${s.tiktok}" target="_blank" rel="noopener">${ICON.tt}<strong>TikTok</strong><span>Watch our hair</span></a>` : ''}
</div>
<div class="wrap narrow prose center">
  <p>Based in ${s.location}. We are an online shop and deliver nationwide by courier.</p>
  <p><a href="/track">Track an order</a> · <a href="/delivery">Delivery</a> · <a href="/returns">Returns</a></p>
</div>`;
  return layout(s, { title: 'Contact', body, canonical: base + '/contact' });
}

function notFound(s) {
  return layout(s, { title: 'Page not found', noindex: true, body: html`<section class="page-head"><h1>Page not found</h1><p>This page or product is no longer available.</p><p><a class="btn btn-gold" href="/shop">Shop available hair</a></p></section>` });
}

module.exports = { layout, home, shop, product, cart, checkout, orderPage, track, infoPage, contact, notFound, STATUS, ICON, fillPolicy, PROVINCES };
