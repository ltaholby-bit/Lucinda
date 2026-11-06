/* End-to-end test of a complete order on a phone (iPhone emulation).
   Starts its own server on a fresh, temporary database.
   Run:  npm run test:phone      (screenshots -> test/screenshots/) */
'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium, devices } = require('playwright');

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'nolle-test-'));
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

let step = 0;
const log = (m) => console.log(`  ✓ ${m}`);
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${String(++step).padStart(2, '0')}-${name}.png`), fullPage: true });

(async () => {
  const srv = spawn(process.execPath, ['--no-warnings', 'server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT, DATA_DIR: DATA, ADMIN_PASSWORD: 'test-pass', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let srvLog = '';
  srv.stdout.on('data', (d) => { srvLog += d; });
  srv.stderr.on('data', (d) => { srvLog += d; });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE + '/healthz'); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|status of 401/.test(m.text())) errors.push(m.text()); });

  try {
    console.log('Phone order test (iPhone 13)');

    // 1. Homepage
    await page.goto(BASE + '/');
    assert.match(await page.locator('h1.slogan').innerText(), /YOUR HAIR\.\s*YOUR CROWN\./);
    assert.ok(await page.getByRole('link', { name: 'Shop Available Hair' }).isVisible());
    assert.match(await page.content(), /deliver nationwide/i);
    assert.ok(await page.locator('[data-wa-float]').isVisible());
    await shot(page, 'home');
    for (const u of ['/', '/shop', '/product/body-wave-13x4-frontal-wig', '/contact', '/delivery']) {
      await page.goto(BASE + u);
      const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      assert.ok(sw <= cw, `${u} scrolls sideways on a phone (${sw}px > ${cw}px)`);
    }
    await page.goto(BASE + '/');
    log('No sideways scrolling on phone pages');
    log('Homepage: slogan, Shop button, WhatsApp button, nationwide note');

    // 2. Shop: ready vs pre-order separated; bundle price note
    await page.getByRole('link', { name: 'Shop Available Hair' }).click();
    await page.waitForURL(/\/shop/);
    assert.ok(await page.locator('#ready').isVisible());
    assert.ok(await page.locator('#pre-order').isVisible());
    assert.match(await page.locator('#ready').innerText(), /for a set of 3 bundles/);
    assert.match(await page.locator('#pre-order').innerText(), /Deep Wave/);
    await shot(page, 'shop');
    log('Shop: Ready to Ship and Pre-order shown separately; bundle price says set of 3');

    // 3. TikTok link straight to product
    await page.goto(BASE + '/p/body-wave-13x4-frontal-wig?src=tiktok');
    await page.waitForURL(/\/product\/body-wave-13x4-frontal-wig/);
    assert.match(await page.locator('.kind-box').innerText(), /complete, ready-to-wear wig/);
    await page.getByRole('button', { name: '20"' }).click();
    assert.equal(await page.locator('[data-price]').innerText(), 'R3 600');
    assert.match(await page.locator('[data-stock]').innerText(), /only 1 left/);
    await page.getByRole('button', { name: '18"' }).click();
    assert.equal(await page.locator('[data-price]').innerText(), 'R3 200');
    await page.getByRole('button', { name: '24"' }).click();
    assert.match(await page.locator('[data-stock]').innerText(), /Sold out/);
    assert.ok(await page.locator('[data-add]').isDisabled());
    await page.getByRole('button', { name: '20"' }).click();
    const wa = decodeURIComponent(await page.locator('[data-wa-enquire]').getAttribute('href'));
    assert.match(wa, /Body Wave 13x4 HD Frontal Wig/); assert.match(wa, /20"/); assert.match(wa, /R3 600/);
    await shot(page, 'product-20in');
    log('Product link from TikTok opens exact product; price changes with length; sold-out option blocked; WhatsApp text includes product + option');

    await page.locator('[data-add]').click();
    assert.ok(await page.locator('[data-added]').isVisible());
    assert.equal(await page.locator('[data-cart-count]').innerText(), '1');
    log('Added to cart');

    // Add bundles too
    await page.goto(BASE + '/product/straight-bundle-set');
    assert.match(await page.locator('.price.big').innerText(), /for a set of 3 bundles/);
    await page.getByRole('button', { name: '16" / 18" / 20"' }).click();
    await page.locator('[data-add]').click();

    // Pre-order product: no Add to cart, WhatsApp enquiry instead
    await page.goto(BASE + '/product/deep-wave-5x5-hd-closure');
    assert.equal(await page.locator('[data-add]').count(), 0);
    assert.match(await page.locator('[data-wa-enquire]').innerText(), /Enquire on WhatsApp/i);
    log('Pre-order product shows “Enquire on WhatsApp” instead of Add to cart');

    // 4. Cart shows delivery and total before payment
    await page.goto(BASE + '/cart');
    await page.locator('.cart-line').nth(1).waitFor();
    assert.equal(await page.locator('[data-subtotal]').innerText(), 'R5 700');
    assert.equal(await page.locator('[data-delivery]').innerText(), 'R120');
    assert.equal(await page.locator('[data-total]').innerText(), 'R5 820');
    await shot(page, 'cart');
    log('Cart: subtotal R5 700 + delivery R120 = R5 820');

    // 5. Guest checkout
    await page.getByRole('link', { name: 'Checkout' }).click();
    await page.waitForURL(/\/checkout/);
    await page.locator('[data-co-items] .line').first().waitFor();
    assert.equal(await page.locator('[data-co-summary] [data-total]').innerText(), 'R5 820');
    await page.locator('[data-place-order]').click(); // empty form -> validation
    assert.ok(await page.locator('[data-form-error]').isVisible());
    await page.fill('[name=name]', 'Thandi Mokoena');
    await page.fill('[name=phone]', '082 555 1234');
    await page.fill('[name=email]', 'thandi@example.com');
    await page.fill('[name=address1]', '12 Rose Street');
    await page.fill('[name=suburb]', 'Parkhurst');
    await page.fill('[name=city]', 'Johannesburg');
    await page.selectOption('[name=province]', 'Gauteng');
    await page.fill('[name=postal_code]', '2193');
    await page.check('[name=agree]');
    await shot(page, 'checkout');
    await page.locator('[data-place-order]').click();
    await page.waitForURL(/\/order\/NLH-/);
    const orderUrl = page.url();
    const ref = /NLH-[A-Z0-9]+/.exec(orderUrl)[0];
    assert.equal(await page.locator('[data-status]').innerText(), 'Awaiting payment');
    assert.match(await page.locator('.deadline').innerText(), /Please pay by/);
    assert.match(await page.locator('.order').innerText(), /Within 1–2 business days after payment/);
    assert.match(await page.locator('.order').innerText(), /2–4 business days after dispatch/);
    assert.equal(await page.locator('[data-cart-count]').isHidden(), true);
    await shot(page, 'order-awaiting-payment');
    log(`Order ${ref} placed as guest: “Awaiting payment”, deadline, prep time vs courier time shown`);

    // 6. Stock reduced: 20" is now sold out, cannot be bought again
    await page.goto(BASE + '/product/body-wave-13x4-frontal-wig?v=2');
    assert.match(await page.locator('[data-stock]').innerText(), /Sold out/);
    const again = await fetch(BASE + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'X Y', phone: '0825551111', email: 'x@y.co', address1: 'a', suburb: 'b', city: 'c', province: 'Gauteng', postal_code: '2000', lines: [{ v: 2, q: 1 }] }) });
    assert.equal(again.status, 409);
    log('Stock reduced on order; sold-out item cannot be ordered again (409)');

    // 7. Track order with ref + phone
    await page.goto(BASE + '/track');
    await page.fill('[name=ref]', ref.toLowerCase());
    await page.fill('[name=phone]', '+27825551234');
    await page.getByRole('button', { name: 'Find my order' }).click();
    await page.waitForURL(/\/order\/NLH-/);
    log('Track Order finds the order by reference + phone');

    // 8. Admin (desktop-sized context for the owner is not required; use the phone)
    await page.goto(BASE + '/admin');
    await page.fill('[name=password]', 'wrong');
    await page.getByRole('button', { name: 'Log in' }).click();
    assert.match(await page.content(), /Incorrect password/);
    await page.fill('[name=password]', 'test-pass');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL(BASE + '/admin');
    await shot(page, 'admin-dashboard');

    // Settings: bank details + WhatsApp
    await page.goto(BASE + '/admin/settings');
    await page.fill('[name=whatsapp]', '082 123 4567');
    await page.fill('[name=bank_name]', 'FNB');
    await page.fill('[name=bank_account_name]', 'Nolle Luxury Hair');
    await page.fill('[name=bank_account_number]', '62000000000');
    await page.fill('[name=bank_branch_code]', '250655');
    await page.fill('[name=delivery_fee]', '150');
    await page.getByRole('button', { name: 'Save settings' }).click();
    assert.match(await page.locator('.flash').innerText(), /Settings saved/);
    await page.goto(orderUrl.replace('&new=1', ''));
    assert.match(await page.locator('.bank').innerText(), /62000000000/);
    assert.match(await page.locator('.bank').innerText(), new RegExp(ref));
    assert.match(await page.locator('.order').innerText(), /R120/, 'existing order keeps the delivery fee it was placed with');
    assert.equal(await page.locator('body').getAttribute('data-wa'), '27821234567');
    await shot(page, 'order-eft-details');
    log('Admin settings: bank details appear on the order page; WhatsApp number normalised to 27…');

    // Mark paid
    await page.goto(BASE + '/admin/orders?status=awaiting_payment');
    await page.getByRole('link', { name: ref }).click();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Mark as paid' }).click();
    assert.match(await page.locator('.flash').innerText(), /marked as paid/);
    // Dispatch
    await page.fill('[name=tracking_number]', 'TCG123456789');
    await page.fill('[name=tracking_url]', 'https://www.thecourierguy.co.za/tracking?ref=TCG123456789');
    await page.getByRole('button', { name: 'Mark as dispatched' }).click();
    assert.match(await page.locator('.flash').innerText(), /dispatched/);
    await shot(page, 'admin-order-dispatched');
    await page.goto(orderUrl.replace('&new=1', ''));
    assert.equal(await page.locator('[data-status]').innerText(), 'Dispatched');
    assert.match(await page.locator('.tracking').innerText(), /TCG123456789/);
    await shot(page, 'order-dispatched-tracking');
    log('Admin marks paid → dispatched with tracking; client order page shows status + tracking');

    // 9. Admin: stock & price update
    await page.goto(BASE + '/admin/stock');
    await page.fill('[name=stock_2]', '3');
    await page.fill('[name=price_1]', '3 350');
    await page.getByRole('button', { name: 'Save stock & prices' }).click();
    await page.goto(BASE + '/product/body-wave-13x4-frontal-wig?v=1');
    assert.equal(await page.locator('[data-price]').innerText(), 'R3 350');
    await page.goto(BASE + '/product/body-wave-13x4-frontal-wig?v=2');
    assert.match(await page.locator('[data-stock]').innerText(), /In stock/);
    log('Admin stock & price changes show on the product page');

    // 10. Admin: add a new product with a photo
    await page.goto(BASE + '/admin/products/new');
    await page.fill('[name=name]', 'Kinky Curly 4x4 Closure Wig');
    await page.selectOption('[name=category]', 'wigs');
    await page.fill('[name=texture]', 'Kinky curly');
    await page.fill('[name=lace]', '4x4 lace closure');
    await page.fill('[name=density]', '200%');
    await page.fill('[data-variants-editor] input[data-name=Length]', '16"');
    await page.fill('[data-variants-editor] input[data-k=price]', '2 800');
    await page.fill('[data-variants-editor] input[data-k=stock]', '2');
    const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000' + '1f15c4890000000d49444154789c6360f8cfc0f01f0005000201a5e0b6a00000000049454e44ae426082', 'hex');
    await page.setInputFiles('[data-upload-images]', { name: 'wig.png', mimeType: 'image/png', buffer: png });
    await page.locator('[data-images-list] figure').waitFor();
    await page.getByRole('button', { name: 'Save product' }).click();
    assert.match(await page.locator('.flash').innerText(), /Product saved/);
    await page.goto(BASE + '/p/kinky-curly-4x4-closure-wig');
    assert.equal(await page.locator('[data-price]').innerText(), 'R2 800');
    assert.match(await page.locator('[data-main-img]').getAttribute('src'), /^\/uploads\//);
    log('Admin adds a product with photo; it is live at its social link');

    // 11. Unpaid EFT order expires after deadline and stock is released
    const r = await fetch(BASE + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Lerato K', phone: '0821112222', email: 'l@k.co', address1: '1 A St', suburb: 'B', city: 'Durban', province: 'KwaZulu-Natal', postal_code: '4001', lines: [{ v: 5, q: 1 }] }) });
    const placed = await r.json();
    assert.ok(placed.ref);
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(DATA, 'shop.db'));
    assert.equal(db.prepare('SELECT stock FROM variants WHERE id = 5').get().stock, 0);
    db.prepare("UPDATE orders SET payment_deadline = '2000-01-01T00:00:00Z' WHERE ref = ?").run(placed.ref);
    await page.goto(BASE + '/admin/orders');
    assert.equal(db.prepare('SELECT status FROM orders WHERE ref = ?').get(placed.ref).status, 'expired');
    assert.equal(db.prepare('SELECT stock FROM variants WHERE id = 5').get().stock, 1);
    db.close();
    log('Unpaid order past its deadline expires and its stock is released');

    assert.deepEqual(errors, [], 'no JavaScript errors');
    log('No JavaScript errors');
    console.log(`\nAll checks passed. Screenshots: ${SHOTS}`);
  } catch (e) {
    console.error('\nFAILED:', e.message);
    await shot(page, 'failure').catch(() => {});
    console.error(srvLog.slice(-2000));
    process.exitCode = 1;
  } finally {
    await browser.close();
    srv.kill();
    fs.rmSync(DATA, { recursive: true, force: true });
  }
})();
