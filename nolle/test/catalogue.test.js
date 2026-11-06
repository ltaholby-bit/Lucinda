/* Checks the real Nolle' catalogue (from the price lists) on a phone.
   Run:  npm run test:catalogue */
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
const R = (n) => 'R' + n.toLocaleString('en-ZA').replace(/[,\s]/g, ' ');

(async () => {
  const srv = spawn(process.execPath, ['--no-warnings', 'server.js'], {
    cwd: path.join(__dirname, '..'), env: { ...process.env, PORT, DATA_DIR: DATA, ADMIN_PASSWORD: 'x', NODE_ENV: 'test' }, stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE + '/healthz'); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    console.log('Catalogue test (iPhone 13)');

    await page.goto(BASE + '/');
    assert.match(await page.locator('.section-head h2').first().innerText(), /Available to Pre-order/);
    assert.equal(await page.locator('.grid .card').count(), 4);
    const nav = await page.locator('#site-nav').innerText();
    assert.match(nav, /Bundle Sets/i); assert.match(nav, /Closures & Frontals/i); assert.doesNotMatch(nav, /Wigs/i);
    log('Homepage shows 4 pre-order products; menu only lists categories that have products (no Wigs)');

    await page.goto(BASE + '/shop');
    assert.equal(await page.locator('#pre-order .card').count(), 12);
    assert.match(await page.locator('#ready').innerText(), /Ready-to-ship stock will be listed here/);
    assert.equal(await page.locator('.chip').count(), 3); // All, Bundle Sets, Closures & Frontals
    for (const t of await page.locator('#pre-order .card').allInnerTexts()) {
      if (/Set of 3 bundles/i.test(t)) assert.match(t, /for a set of 3 bundles/);
    }
    log('Shop: 12 pre-order products; every bundle price says “for a set of 3 bundles”');

    // Raw Indian straight & wavy: set of 3 = 3 x per-bundle price
    await page.goto(BASE + '/product/raw-indian-straight-wavy-bundles');
    assert.equal(await page.locator('[data-add]').count(), 0);
    await page.getByRole('button', { name: '20"', exact: true }).click();
    assert.equal(await page.locator('[data-price]').innerText(), R(2779 * 3));
    await page.getByRole('button', { name: 'Wavy', exact: true }).click();
    const wa = decodeURIComponent(await page.locator('[data-wa-enquire]').getAttribute('href'));
    assert.match(wa, /Raw Indian Hair Bundles – Straight & Wavy/); assert.match(wa, /Wavy · 20"/); assert.match(wa, /for 3 bundles/);
    assert.match(await page.locator('.ship-box').innerText(), /Pre-order lead time/i);
    log(`Raw 20" set of 3 = ${R(2779 * 3)}; WhatsApp message has product, texture, length and “for 3 bundles”`);

    // Raw HD frontal: 13x4 has no 24"; curly adds R87
    await page.goto(BASE + '/product/raw-indian-hd-frontal');
    assert.match(await page.locator('.kind-box').innerText(), /Frontal only/);
    await page.getByRole('button', { name: '13x4 HD frontal', exact: true }).click();
    assert.ok(await page.getByRole('button', { name: '24"', exact: true }).evaluate((b) => b.classList.contains('na')));
    await page.getByRole('button', { name: '20"', exact: true }).click();
    assert.equal(await page.locator('[data-price]').innerText(), R(3712));
    await page.getByRole('button', { name: 'Curly', exact: true }).click();
    assert.equal(await page.locator('[data-price]').innerText(), R(3712 + 87));
    await page.getByRole('button', { name: '13x6 HD frontal', exact: true }).click();
    await page.getByRole('button', { name: '24"', exact: true }).click();
    assert.equal(await page.locator('[data-price]').innerText(), R(6947 + 87));
    log('Frontal: 13x4 24" greyed out (not on price list); curly +R87; 13x6 curly 24" = ' + R(7034));

    // Virgin 7-10 working days, SDD Caribbean +R43 per bundle
    await page.goto(BASE + '/product/virgin-curly-bundles');
    assert.match(await page.locator('.ship-box').innerText(), /7–10 working days/);
    await page.goto(BASE + '/product/sdd-indian-bundles');
    await page.getByRole('button', { name: 'Caribbean curl', exact: true }).click();
    await page.getByRole('button', { name: '28"', exact: true }).click();
    assert.equal(await page.locator('[data-price]').innerText(), R((3647 + 43) * 3));
    log('Virgin lead time 7–10 working days; SDD Caribbean curl 28" set = ' + R((3647 + 43) * 3));

    for (const u of ['/', '/shop', '/product/raw-indian-hd-frontal', '/delivery']) {
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
    process.exitCode = 1;
  } finally {
    await browser.close(); srv.kill(); fs.rmSync(DATA, { recursive: true, force: true });
  }
})();
