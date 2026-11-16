/* Checks the real Nolle' catalogue on a phone, as a client sees it while everything is
   pre-order and ordering happens on WhatsApp. Run:  npm run test:catalogue */
'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium, devices } = require('playwright');

const PORT = 3998;
const BASE = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'nolle-cat-'));
const log = (m) => console.log(`  ✓ ${m}`);
const NB = ' ';
const R = (n) => 'R' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NB);

(async () => {
  const srv = spawn(process.execPath, ['--no-warnings', 'server.js'], {
    cwd: path.join(__dirname, '..'), env: { ...process.env, PORT, DATA_DIR: DATA, ADMIN_PASSWORD: 'x', NODE_ENV: 'test' }, stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE + '/healthz'); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const waText = async (sel = '[data-wa-enquire]') => decodeURIComponent(await page.locator(sel).getAttribute('href'));
  const chip = (t) => page.locator(`[data-texture-filter] [data-texture="${t}"]`);
  try {
    console.log('Catalogue test (iPhone 13)');

    /* 1. Homepage: pre-order is clear, and the quote journey is spelled out */
    await page.goto(BASE + '/');
    assert.ok(await page.getByRole('link', { name: 'Shop Pre-Orders' }).isVisible());
    assert.match(await page.locator('.hero-copy .lead').innerText(), /Luxury bundles, closures and frontals, complete sets and custom-made wigs\./);
    assert.match(await page.locator('.hero-copy').innerText(), /Pre-order on WhatsApp\./);
    assert.ok(await page.locator('.cta-row').getByRole('link', { name: /Get help on WhatsApp/i }).isVisible());
    assert.match(await page.locator('.hero-note').innerText(), /Nationwide delivery across South Africa/);
    const home = await page.locator('main').innerText();
    for (const gone of [/ready to ship/i, /real stock/i, /guest checkout/i, /Order now/i]) assert.doesNotMatch(home, gone);
    assert.match(await page.locator('#pre-order').innerText(), /Choose your set and request a quote on WhatsApp\. We’ll confirm availability, your total including delivery and your estimated dispatch date before you pay\./);
    log('Homepage: “Shop Pre-Orders”, new hero wording, quote intro, no ready-to-ship claims');

    /* 2. How to order */
    assert.deepEqual(await page.locator('.steps strong').allInnerTexts(),
      ['Choose your hair', 'Request a quote', 'Review your quote', 'Pay to confirm']);
    const steps = await page.locator('.steps').innerText();
    assert.match(steps, /Select your preferred texture, length and delivery option/);
    assert.match(steps, /Tap “Request a quote” and send your selection on WhatsApp/);
    assert.match(steps, /We confirm availability, your total including delivery and your estimated dispatch date before you pay/);
    assert.match(steps, /Full payment confirms your order\. We’ll send your tracking details once your order has been dispatched/);
    assert.equal(await page.locator('.section-head h2').filter({ hasText: 'How to order' }).count(), 1);
    log('How to order: the four quote steps, in your wording');

    /* 3. Welcome + trust boxes */
    const intro = await page.locator('.intro-band').innerText();
    assert.match(intro, /Explore our Raw Indian, Premium Virgin and SDD Indian hair collections\. Shop bundles, closures, frontals and complete sets\. We check and pack every order by hand\./);
    assert.match(intro, /Courier to your door or collection at a PEP PAXI point\./);
    assert.match(intro, /We confirm availability, your final total and estimated dispatch date on WhatsApp\./);
    assert.match(intro, /3 bundles \+ a matching closure or frontal, all for one price\./);
    log('Welcome to Nolle’ and the three boxes match the mock-up');

    /* 4. Cards: quote button, no repeated labels, prices only where confirmed */
    const card = page.locator('#pre-order .card').first();
    assert.match(await card.innerText(), /Request a quote/i);
    const cq = decodeURIComponent(await card.locator('[data-quote]').getAttribute('href'));
    assert.match(cq, /wa\.me\/27616029381/);
    assert.match(cq, /quote for: 3 Bundles \+ 13x4 Frontal Set/);
    assert.doesNotMatch(await card.innerText(), /for 3 bundles \+ frontal/i); // repeats the product name
    assert.match(await card.innerText(), /Wig making available/);
    log('Product cards: “Request a quote” opens WhatsApp with the product name; repeated labels gone');

    /* 5. Footer */
    const footer = await page.locator('.site-footer').innerText();
    assert.match(footer, /Online store based in Johannesburg\. Delivery across South Africa\./);
    assert.match(footer, /Browse all hair/);
    assert.doesNotMatch(footer, /All available hair/);
    assert.doesNotMatch(footer, /graceandcompanies/i);
    assert.equal(await page.locator('.site-footer .logo-sub').evaluate((e) => e.getClientRects().length), 1, 'LUXURY HAIR on one line');
    const contactCol = page.locator('.site-footer .footer-grid > div').last();
    assert.match(await contactCol.innerText(), /Track my order/);
    assert.equal(await contactCol.getByText('Contact us').count(), 1);
    const tel = page.locator('.site-footer a[href^="tel:"]');
    assert.equal(await tel.innerText(), '+27 61 602 9381');
    assert.equal(await tel.evaluate((e) => e.getClientRects().length), 1, 'phone number on one line');
    log('Footer: Johannesburg line, Browse all hair, tappable number on one line, Track my order under Contact');

    /* 6. Shop by category, with texture buttons above the bundle photos */
    await page.goto(BASE + '/shop');
    assert.deepEqual(await page.locator('.cat-title').allInnerTexts(), ['Complete Sets', 'Bundle Sets', 'Closures & Frontals', 'Wigs']);
    await page.goto(BASE + '/shop?cat=bundles');
    assert.deepEqual(await page.locator('[data-texture-filter] .chip').allInnerTexts(),
      ['All textures', 'Straight', 'Wavy', 'Body Wave', 'Bouncy Curls', 'Curly']);
    const names = await page.locator('.card h3').allInnerTexts();
    for (const n of ['Straight – 3-Bundle Set', 'Wavy – 3-Bundle Set', 'Body Wave – 3-Bundle Set', 'Bouncy Curls – 3-Bundle Set',
      'Caribbean Curls – 3-Bundle Set', 'Cambodian Curls – 3-Bundle Set', 'Virgin Curls – 3-Bundle Set', 'Indian Royal Curls – 3-Bundle Set']) {
      assert.ok(names.includes(n), `missing ${n}`);
    }
    await chip('Curly').click();
    assert.deepEqual(await page.locator('.card:visible h3').allInnerTexts(),
      ['Caribbean Curls – 3-Bundle Set', 'Cambodian Curls – 3-Bundle Set', 'Virgin Curls – 3-Bundle Set', 'Indian Royal Curls – 3-Bundle Set', 'Raw Indian Curly – 3-Bundle Set']);
    await chip('Body Wave').click();
    assert.deepEqual(await page.locator('.card:visible h3').allInnerTexts(), ['Body Wave – 3-Bundle Set']);
    await chip('').click();
    assert.equal(await page.locator('.card:visible').count(), 9);
    log('Shop: textures above the bundle photos (Straight, Wavy, Body Wave, Bouncy Curls, Curly) and they filter the list');

    /* 7. Prices from the price list; pending where not confirmed */
    await page.goto(BASE + '/product/caribbean-curls-3-bundle-set');
    await page.getByRole('button', { name: '28"', exact: true }).click();
    assert.equal(await page.locator('[data-price]').innerText(), R((3647 + 43) * 3));
    await page.goto(BASE + '/product/virgin-curls-3-bundle-set');
    await page.getByRole('button', { name: '20"', exact: true }).click();
    assert.equal(await page.locator('[data-price]').innerText(), R(2300 * 3));
    for (const slug of ['cambodian-curls-3-bundle-set', 'indian-royal-curls-3-bundle-set', 'body-wave-3-bundle-set']) {
      await page.goto(BASE + '/product/' + slug);
      assert.equal(await page.locator('[data-price]').innerText(), 'Price on request');
      assert.equal(await page.locator('details.extra').count(), 0);
      assert.match(await page.locator('[data-wa-enquire]').innerText(), /Request a quote/i);
    }
    log(`Caribbean 28" = ${R((3647 + 43) * 3)}, Virgin Curls 20" = ${R(6900)}; Cambodian, Indian Royal and Body Wave show “Price on request”`);

    /* 8. Straight set: three collections in one listing, single-bundle prices collapsed */
    await page.goto(BASE + '/product/straight-3-bundle-set');
    await page.getByRole('button', { name: 'SDD Indian', exact: true }).click();
    await page.getByRole('button', { name: '20"', exact: true }).click();
    assert.equal(await page.locator('[data-price]').innerText(), R(2171 * 3));
    assert.match(await page.locator('details.extra summary').innerText(), /Single-bundle prices/);
    assert.equal(await page.locator('details.extra').getAttribute('open'), null);
    assert.match(await waText(), /quote for: Straight – 3-Bundle Set/);
    assert.match(await waText(), /SDD Indian · 20"/);
    log(`Straight set: SDD Indian 20" = ${R(6513)}; single-bundle prices stay collapsed`);

    /* 9. Wigs: named per texture or cut, priced separately, quote only */
    await page.goto(BASE + '/shop?cat=wigs');
    const wigs = await page.locator('.card h3').allInnerTexts();
    for (const n of ['Caribbean Curls Wig', 'Cambodian Curls Wig', 'Virgin Curls Wig', 'Indian Royal Curls Wig', 'Pixie Wig', 'Short Bob Wig']) {
      assert.ok(wigs.includes(n), `missing ${n}`);
    }
    await page.goto(BASE + '/product/caribbean-curls-wig');
    assert.equal(await page.locator('[data-price]').innerText(), 'Price on request');
    assert.match(await page.locator('.kind-box').innerText(), /complete wig/i);
    assert.match(await page.locator('main').innerText(), /wig price is quoted separately from the 3-bundle set price/i);
    assert.equal(await page.locator('video').count(), 1);
    log('Wigs: six listings, each “Price on request”, wig price kept separate from the 3-bundle price');

    /* 10. Closure and frontal photos show the lace and parting */
    for (const [slug, label, img] of [['raw-indian-hd-closure', /Closure only/i, 'closure-single'], ['raw-indian-hd-frontal', /Frontal only/i, 'frontal-on-hanger']]) {
      await page.goto(BASE + '/product/' + slug);
      assert.match(await page.locator('.kind-box').innerText(), label);
      assert.match(await page.locator('[data-main-img]').getAttribute('src'), new RegExp(`/static/img/product/${img}\\.jpg`));
      assert.ok((await page.locator('.thumbs .thumb').count()) >= 2, 'has a second photo');
    }
    log('Closure and frontal cards use the real lace photos and keep their “Closure only” / “Frontal only” labels');

    /* 11. Links that changed still work */
    for (const [from, to] of [['virgin-curly-bundles', '/product/virgin-curls-3-bundle-set'], ['raw-indian-straight-wavy-bundles', '/product/straight-3-bundle-set']]) {
      const r = await fetch(`${BASE}/product/${from}`, { redirect: 'manual' });
      assert.equal(r.status, 301);
      assert.equal(new URL(r.headers.get('location'), BASE).pathname, to);
    }
    log('Old product links redirect to the new texture listings');

    /* 12. Phone layout */
    for (const u of ['/', '/shop', '/shop?cat=bundles', '/product/straight-3-bundle-set', '/product/caribbean-curls-wig', '/contact']) {
      await page.goto(BASE + u);
      const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      assert.ok(sw <= cw, `${u} scrolls sideways`);
      const left = await page.locator('h1').first().evaluate((e) => e.getBoundingClientRect().left);
      assert.ok(left >= 16, `${u} heading sits against the edge (${left}px)`);
    }
    await page.goto(BASE + '/');
    await page.locator('.site-footer').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    assert.ok(await page.locator('.wa-float').evaluate((e) => e.classList.contains('tucked')), 'float tucks away at the footer');
    log('No sideways scrolling, headings clear of the edge, WhatsApp button stays clear of the footer links');

    assert.deepEqual(errors, []);
    log('No JavaScript errors');
    console.log('\nAll catalogue checks passed.');
  } catch (e) {
    console.error('\nFAILED:', e.message);
    await page.screenshot({ path: path.join(os.tmpdir(), 'nolle-catalogue-failure.png'), fullPage: true }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close(); srv.kill(); fs.rmSync(DATA, { recursive: true, force: true });
  }
})();
