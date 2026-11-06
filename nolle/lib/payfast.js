'use strict';
/* PayFast (South African card / Instant EFT gateway).
   Enabled only when PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY are set.
   PAYFAST_SANDBOX=1 uses the sandbox for testing. */
const crypto = require('node:crypto');

const cfg = () => ({
  merchant_id: process.env.PAYFAST_MERCHANT_ID || '',
  merchant_key: process.env.PAYFAST_MERCHANT_KEY || '',
  passphrase: process.env.PAYFAST_PASSPHRASE || '',
  host: process.env.PAYFAST_SANDBOX === '1' ? 'sandbox.payfast.co.za' : 'www.payfast.co.za',
});
const enabled = () => !!(cfg().merchant_id && cfg().merchant_key);

const enc = (v) => encodeURIComponent(String(v).trim()).replace(/%20/g, '+');

function signature(pairs, passphrase) {
  let s = pairs.filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}=${enc(v)}`).join('&');
  if (passphrase) s += `&passphrase=${enc(passphrase)}`;
  return crypto.createHash('md5').update(s).digest('hex');
}

/* Returns { action, fields } for an auto-submitting form. */
function checkoutForm(order, baseUrl) {
  const c = cfg();
  const [first, ...rest] = String(order.name || '').trim().split(/\s+/);
  const pairs = [
    ['merchant_id', c.merchant_id], ['merchant_key', c.merchant_key],
    ['return_url', `${baseUrl}/order/${order.ref}?t=${order.token}&paid=1`],
    ['cancel_url', `${baseUrl}/order/${order.ref}?t=${order.token}`],
    ['notify_url', `${baseUrl}/payfast/notify`],
    ['name_first', first || ''], ['name_last', rest.join(' ')],
    ['email_address', order.email || ''],
    ['m_payment_id', order.ref],
    ['amount', (order.total_cents / 100).toFixed(2)],
    ['item_name', `Nolle Luxury Hair order ${order.ref}`],
  ].filter(([, v]) => v !== '');
  pairs.push(['signature', signature(pairs, c.passphrase)]);
  return { action: `https://${c.host}/eng/process`, fields: pairs };
}

/* Validate an ITN (payment notification). rawBody is the urlencoded POST body. */
async function verifyNotification(rawBody, expectedCents) {
  const c = cfg();
  const pairs = [];
  for (const part of rawBody.split('&')) {
    const i = part.indexOf('=');
    const k = decodeURIComponent(part.slice(0, i));
    const v = decodeURIComponent(part.slice(i + 1).replace(/\+/g, ' '));
    pairs.push([k, v]);
  }
  const data = Object.fromEntries(pairs);
  const withoutSig = pairs.filter(([k]) => k !== 'signature');
  // PayFast signs every posted field (including empty ones) in the order posted.
  let s = withoutSig.map(([k, v]) => `${k}=${enc(v)}`).join('&');
  if (c.passphrase) s += `&passphrase=${enc(c.passphrase)}`;
  const sigOk = crypto.createHash('md5').update(s).digest('hex') === data.signature;
  const amountOk = Math.abs(Math.round(parseFloat(data.amount_gross) * 100) - expectedCents) <= 1;
  let serverOk = false;
  try {
    const paramString = rawBody.split('&').filter((p) => !p.startsWith('signature=')).join('&');
    const r = await fetch(`https://${c.host}/eng/query/validate`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: paramString,
    });
    serverOk = (await r.text()).trim() === 'VALID';
  } catch (e) { console.error('[payfast] validate failed', e.message); }
  return { ok: sigOk && amountOk && serverOk && data.merchant_id === c.merchant_id, complete: data.payment_status === 'COMPLETE', data, sigOk, amountOk, serverOk };
}

module.exports = { enabled, checkoutForm, verifyNotification, signature };
