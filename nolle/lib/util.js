'use strict';
const crypto = require('node:crypto');

/* ---------- Safe HTML templating ----------
   html`...` escapes every interpolated value unless it is wrapped in raw()
   or is itself the result of html`...`. Arrays are joined. */
class Raw {
  constructor(s) { this.s = String(s); }
  toString() { return this.s; }
}
const raw = (s) => new Raw(s);

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function renderVal(v) {
  if (v == null || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(renderVal).join('');
  return esc(v);
}
function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += renderVal(v) + strings[i + 1]; });
  return new Raw(out);
}

/* ---------- Money (stored as integer cents) ---------- */
const NBSP = ' ';
function money(cents) {
  cents = Math.round(Number(cents) || 0);
  const whole = Math.floor(cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const c = cents % 100;
  return 'R' + whole + (c ? '.' + String(c).padStart(2, '0') : '');
}
/* "1 850", "1850.50", "R1,850" -> cents */
function toCents(input) {
  const s = String(input ?? '').replace(/[^\d.,]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/* ---------- Misc ---------- */
function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/["'’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'product';
}
function randomRef() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
  let s = '';
  const bytes = crypto.randomBytes(6);
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return 'NLH-' + s;
}
const randomToken = (n = 16) => crypto.randomBytes(n).toString('hex');

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Payload too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/* Format a timestamp for South African customers. */
function fmtDate(iso, withTime = true) {
  if (!iso) return '';
  const d = new Date(iso);
  const opts = { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'long', year: 'numeric' };
  if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit', hour12: false });
  return new Intl.DateTimeFormat('en-ZA', opts).format(d);
}

function waLink(number, text) {
  const n = String(number || '').replace(/\D/g, '');
  return `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}

/* Tiny text-to-HTML for policy pages edited in the admin:
   blank line = new paragraph, "## " = heading, "- " = bullet. */
function richText(text) {
  const blocks = String(text || '').replace(/\r/g, '').split(/\n{2,}/);
  return raw(blocks.map((b) => {
    b = b.trim();
    if (!b) return '';
    if (b.startsWith('## ')) return `<h2>${esc(b.slice(3))}</h2>`;
    const lines = b.split('\n');
    if (lines.every((l) => l.trim().startsWith('- '))) {
      return '<ul>' + lines.map((l) => `<li>${esc(l.trim().slice(2))}</li>`).join('') + '</ul>';
    }
    return `<p>${lines.map(esc).join('<br>')}</p>`;
  }).join('\n'));
}

module.exports = {
  Raw, raw, esc, html, money, toCents, slugify, randomRef, randomToken,
  parseCookies, readBody, fmtDate, waLink, richText,
};
