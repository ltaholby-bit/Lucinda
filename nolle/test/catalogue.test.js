/* Checks the real Nolle' catalogue (from the price lists) on a phone, as a client sees it
   while everything is pre-order. Run:  npm run test:catalogue */
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
  const waText = async () => decodeURIComponent(await page.locator('[data-wa-enquire]').getAttribute('href'));
  try {
    console.log('Catalogue test (iPhone 13)');

    // 1. Homepage is clearly pre-order
    await page.goto(BASE + '/');
    assert.ok(await page.getByRole('link', { name: 'Shop Pre-Orders' }).isVisible());
    const home = await page.locator('main').innerText();
    for (const gone of [/ready to ship/i, /real stock/i, /checkout as a guest/i, /guest checkout/i]) assert.doesNotMatch(home, gone);
    assert.equal(await page.locator('main #ready').count(), 0);
    assert.match(await page.locator('#pre-order h2').innerText(), /Available to Pre-order/);
    assert.equal(await page.locator('#pre-order .card').count(), 4);
    assert.match(await page.locator('#pre-order .card').first().innerText(), /3 Bundles \+ 13x4 Frontal Set/);
    assert.deepEqual((await page.locator('.steps strong').allInnerTexts()),
      ['Choose your hair and delivery', 'Send your selection on WhatsApp', 'We confirm the details', 'Pay to confirm']);
    assert.match(await page.locator('.steps').innerText(), /Availability, your final total and your estimated dispatch date/);
    const nav = await page.locator('#site-nav').innerText();
    assert.match(nav, /Complete Sets/i); assert.match(nav, /Bundles/i); assert.match(nav, /Closures & Frontals/i); assert.doesNotMatch(nav, /Wigs/i);
    log('Homepage: “Shop Pre-Orders”, no “ready to ship / real stock / guest checkout”, WhatsApp pre-order steps');

    // 4. Contact details
    const footer = await page.locator('.site-footer').innerText();
    assert.doesNotMatch(footer, /graceandcompanies/i);
    assert.match(footer, /WhatsApp: \+27 61 602 9381/);
    await page.goto(BASE + '/contact');
    assert.doesNotMatch(await page.locator('main').innerText(), /graceandcompanies/i);
    assert.match(await page.locator('main').innerText(), /\+27 61 602 9381/);
    log('No Grace&Co email shown until a Nolle’ email is set; WhatsApp number shown in footer and on Contact');

    // Shop: pre-order only
    await page.goto(BASE + '/shop');
    assert.match(await page.locator('h1').innerText(), /Shop Pre-Orders/);
    assert.equal(await page.locator('#ready').count(), 0);
    assert.equal(await page.locator('#pre-order .card').count(), 16);
    assert.equal(await page.locator('.chip').count(), 4); // All, Sets, Bundle Sets, Closures & Frontals
    for (const t of await page.locator('#pre-order .card').allInnerTexts()) {
      if (/^Set of 3 bundles/im.test(t)) assert.match(t, /for a set of 3 bundles/);
      if (/^3 bundles \+ (closure|frontal)/im.test(t)) { assert.match(t, /for 3 bundles \+ (closure|frontal)/); assert.match(t, /Wig making available/); }
    }
    log('Shop: 16 pre-order products, no empty “Ready to Ship” section; bundle and set prices labelled');

    // Product page: button, reassurance, timing beside the button, single-bundle prices collapsed
    await page.goto(BASE + '/product/raw-indian-straight-wavy-bundles');
    assert.equal(await page.locator('[data-add]').count(), 0);
    assert.match(await page.locator('[data-wa-enquire]').innerText(), /Confirm my pre-order on WhatsApp/i);
    assert.equal(await page.locator('.reassure').innerText(), 'We’ll confirm availability, your final total and your estimated dispatch date before you pay.');
    assert.match(await page.locator('.timing').innerText(), /Before dispatch\s+7–10 working days after payment/);
    assert.match(await page.locator('.timing').innerText(), /After dispatch\s+Courier to your door – 2–4 business days/);
    assert.doesNotMatch(await page.locator('details.acc[open]').first().innerText(), /per bundle/);
    assert.equal(await page.locator('details.extra').getAttribute('open'), null);
    assert.match(await page.locator('details.extra summary').innerText(), /Single-bundle prices/);
    await page.getByRole('button', { name: '20"', exact: true }).click();
    assert.equal(await page.locator('[data-price]').innerText(), R(2779 * 3));
    await page.getByRole('button', { name: 'Wavy', exact: true }).click();
    let wa = await waText();
    assert.match(wa, /I’d like to pre-order: Raw Indian Hair Bundles – Straight & Wavy/); assert.match(wa, /Wavy · 20"/); assert.match(wa, /for 3 bundles/);
    assert.match(wa, /Delivery: Courier to your door \(R120\)/); assert.ok(wa.includes('Total with delivery: ' + R(8457)));
    await page.locator('[data-delivery=paxi]').click();
    assert.match(await page.locator('[data-after-dispatch]').innerText(), /PEP PAXI – collected at your chosen PEP point/);
    wa = await waText();
    assert.match(wa, /Delivery: PEP PAXI \(collect at a PEP store\) \(R60\)/); assert.ok(wa.includes('Total with delivery: ' + R(8397)));
    log(`Product: “Confirm My Pre-Order on WhatsApp” + reassurance line; before/after dispatch shown; PAXI = collected at chosen PEP point; ${R(8337)} + R60 in message`);

    // 2. Range lead time beside the button (Virgin 7–10 working days)
    await page.goto(BASE + '/product/virgin-curly-bundles');
    assert.match(await page.locator('.timing').innerText(), /Before dispatch\s+7–10 working days after payment/);
    log('Premium Virgin: “Before dispatch: 7–10 working days after payment” beside the button');

    // 3. 3 bundles + matching closure, one total
    await page.goto(BASE + '/product/raw-indian-bundles-closure-set');
    assert.match(await page.locator('.kind-box').innerText(), /3 bundles \+ closure/);
    await page.getByRole('button', { name: 'Curly', exact: true }).click();
    await page.getByRole('button', { name: '18"', exact: true }).click();
    assert.equal(await page.locator('[data-price]').innerText(), R(2996 * 3 + 2692 + 87));
    assert.match(await page.locator('details.extra summary').innerText(), /Price breakdown/);
    await page.goto(BASE + '/product/virgin-bundles-closure-set');
    await page.getByRole('button', { name: 'Straight', exact: true }).click();
    await page.getByRole('button', { name: '16"', exact: true }).click();
    assert.equal(await page.locator('[data-price]').innerText(), R(1375 * 3 + 850));
    wa = await waText();
    assert.match(wa, /Premium Virgin 3 Bundles \+ 4x4 Closure \(3 bundles \+ closure\) – Straight · 16"/);
    log(`Sets: Raw curly 18" = ${R(2996 * 3 + 2779)}, Virgin straight 16" = ${R(1375 * 3 + 850)} – one total, breakdown collapsed`);

    // Best seller: 3 bundles + 13x4 frontal, with the wig-making add-on (no fee set = quoted on WhatsApp)
    await page.goto(BASE + '/product/bundles-13x4-frontal-set');
    assert.match(await page.locator('.kind-box').innerText(), /3 bundles \+ frontal/);
    await page.getByRole('button', { name: 'Premium Virgin', exact: true }).click();
    await page.getByRole('button', { name: 'Curly', exact: true }).click();
    await page.getByRole('button', { name: '20"', exact: true }).click();
    assert.equal(await page.locator('[data-price]').innerText(), R(2300 * 3 + 2000));
    assert.ok(await page.getByRole('button', { name: 'Wavy', exact: true }).evaluate((b) => b.classList.contains('na')));
    await page.locator('[data-wig="1"]').click();
    assert.equal(await page.locator('[data-price]').innerText(), R(2300 * 3 + 2000));
    assert.match(await page.locator('[data-before-dispatch]').innerText(), /7–10 working days after payment, plus wig making \(completion date confirmed on WhatsApp\)/);
    wa = await waText();
    assert.match(wa, /3 Bundles \+ 13x4 Frontal Set \(3 bundles \+ frontal\) – Premium Virgin · Curly · 20"/);
    assert.match(wa, /Wig making: yes – please quote the wig-making fee/); assert.match(wa, /before wig making/);
    await page.goto(BASE + '/product/sdd-indian-bundles');
    assert.match(await page.locator('.timing').innerText(), /Before dispatch\s+7–10 working days after payment/);
    assert.equal(await page.locator('[data-wig]').count(), 0);
    log(`13x4 frontal set: Premium Virgin curly 20" = ${R(8900)}; wig making adds “please quote” and “plus wig making” to timing; SDD 7–10 working days`);

    // Other price rules still hold
    await page.goto(BASE + '/product/raw-indian-hd-frontal');
    await page.getByRole('button', { name: '13x4 HD frontal', exact: true }).click();
    assert.ok(await page.getByRole('button', { name: '24"', exact: true }).evaluate((b) => b.classList.contains('na')));
    await page.goto(BASE + '/product/sdd-indian-bundles');
    await page.getByRole('button', { name: 'Caribbean curl', exact: true }).click();
    await page.getByRole('button', { name: '28"', exact: true }).click();
    assert.equal(await page.locator('[data-price]').innerText(), R((3647 + 43) * 3));
    log('Frontal 13x4 24" greyed out; SDD Caribbean curl +R43 per bundle');

    // 2. Delivery page: before/after dispatch, PAXI, draft notice until confirmed
    await page.goto(BASE + '/delivery');
    let prose = await page.locator('.prose').innerText();
    assert.match(prose, /Courier to your door: R120 – 2–4 business days after dispatch/);
    assert.match(prose, /PEP PAXI \(collect at a PEP store\): R60 – Collected at your chosen PEP point/);
    assert.match(prose, /Before dispatch:/); assert.match(prose, /After dispatch:/);
    assert.match(prose, /draft/i);
    await page.goto(BASE + '/admin/login');
    await page.fill('[name=password]', 'x');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL(BASE + '/admin');
    await page.goto(BASE + '/admin/settings');
    await page.check('[name=policy_delivery_confirmed]');
    await page.getByRole('button', { name: 'Save settings' }).click();
    await page.goto(BASE + '/admin/settings');
    await page.fill('[name=wig_fee]', '1500');
    await page.getByRole('button', { name: 'Save settings' }).click();
    await page.goto(BASE + '/product/bundles-13x4-frontal-set');
    await page.getByRole('button', { name: 'Premium Virgin', exact: true }).click();
    await page.getByRole('button', { name: 'Curly', exact: true }).click();
    await page.getByRole('button', { name: '20"', exact: true }).click();
    await page.locator('[data-wig="1"]').click();
    assert.equal(await page.locator('[data-price]').innerText(), R(8900 + 1500));
    wa = await waText();
    assert.ok(wa.includes('Wig making: yes (+' + R(1500) + ')')); assert.ok(wa.includes('Total with delivery: ' + R(8900 + 1500 + 120)));
    log(`With a wig-making fee of R1 500 set in admin: price ${R(10400)}, total with courier ${R(10520)}`);
    await page.goto(BASE + '/delivery');
    assert.equal(await page.locator('.draft-note').count(), 0);
    await page.goto(BASE + '/returns');
    assert.equal(await page.locator('.draft-note').count(), 1);
    log('Delivery page shows before/after dispatch and PAXI collection; its draft notice goes once confirmed (returns stays draft)');

    for (const u of ['/', '/shop', '/product/raw-indian-bundles-closure-set', '/product/raw-indian-hd-frontal', '/delivery', '/contact']) {
      await page.goto(BASE + u);
      const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      assert.ok(sw <= cw, `${u} scrolls sideways`);
    }
    log('No sideways scrolling');
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
