/* Nolle’ Luxury Hair — storefront script (no dependencies) */
(function () {
  'use strict';
  var KEY = 'nolle_cart';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var WA = document.body.getAttribute('data-wa');

  function money(c) {
    c = Math.round(c || 0);
    var whole = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    var cents = c % 100;
    return 'R' + whole + (cents ? '.' + String(cents).padStart(2, '0') : '');
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function waLink(text) { return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text); }

  /* ---------- cart storage ---------- */
  function getCart() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function setCart(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} updateCount(); }
  function updateCount() {
    var n = getCart().reduce(function (a, l) { return a + l.q; }, 0);
    $$('[data-cart-count]').forEach(function (el) { el.textContent = n; el.hidden = !n; });
  }
  updateCount();

  /* Remember where the client came from (e.g. ?src=tiktok on a promo link) */
  try {
    var src = new URLSearchParams(location.search).get('src') || new URLSearchParams(location.search).get('utm_source');
    if (src) sessionStorage.setItem('nolle_src', src.slice(0, 40));
  } catch (e) {}

  /* ---------- mobile nav ---------- */
  var toggle = $('.nav-toggle');
  if (toggle) toggle.addEventListener('click', function () {
    var open = document.body.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', open);
  });

  /* ---------- tap to copy (bank details, reference) ---------- */
  $$('[data-copy]').forEach(function (el) {
    el.title = 'Tap to copy';
    el.addEventListener('click', function () {
      if (navigator.clipboard) navigator.clipboard.writeText(el.textContent.trim()).then(function () {
        var t = el.textContent; el.textContent = 'Copied!'; setTimeout(function () { el.textContent = t; }, 1200);
      });
    });
  });

  /* ---------- product page ---------- */
  var pdEl = $('#product-data');
  if (pdEl) (function () {
    var P = JSON.parse(pdEl.textContent);
    var sel = {};
    var dSel = P.delivery && P.delivery.length ? P.delivery[0].id : null;
    var form = $('[data-buy-form]');
    var priceEl = $('[data-price]'), stockEl = $('[data-stock]'), addBtn = $('[data-add]'), qtyEl = $('[data-qty]');
    var waBtn = $('[data-wa-enquire]'), addedEl = $('[data-added]'), lenEl = $('[data-detail-length]');

    function current() {
      if (!P.optionNames.length) return P.variants[0];
      if (P.optionNames.some(function (n) { return !sel[n]; })) return null;
      return P.variants.find(function (v) { return P.optionNames.every(function (n) { return v.options[n] === sel[n]; }); }) || null;
    }
    function label(v) { return P.optionNames.map(function (n) { return v.options[n]; }).filter(Boolean).join(' · '); }

    function render() {
      var v = current();
      $$('[data-opt]').forEach(function (fs) {
        var name = fs.getAttribute('data-opt');
        $('[data-opt-value]', fs).textContent = sel[name] || 'please choose';
        $$('.opt-btn', fs).forEach(function (b) {
          var val = b.getAttribute('data-value');
          b.classList.toggle('on', sel[name] === val);
          b.setAttribute('aria-pressed', sel[name] === val);
          // Grey out values that don't exist with the other choices made (e.g. 13x4 in 24")
          var exists = P.variants.some(function (x) {
            return x.options[name] === val && P.optionNames.every(function (n) { return n === name || !sel[n] || x.options[n] === sel[n]; });
          });
          b.classList.toggle('na', !exists);
          b.title = exists ? '' : 'Not available with your other choices';
          if (!P.enquire && P.optionNames.length === 1) {
            var vv = P.variants.find(function (x) { return x.options[name] === val; });
            b.classList.toggle('out', !!vv && vv.stock <= 0);
          }
        });
      });
      if (lenEl) {
        var ln = P.optionNames.find(function (n) { return /length/i.test(n); });
        lenEl.textContent = (ln && sel[ln]) || 'Select an option above';
      }
      var waText = 'Hi Nolle’ Luxury Hair, ' + (P.enquire ? 'I’d like to pre-order: ' : 'I’m interested in: ') + P.name + ' (' + P.kind + ')';
      if (v) {
        priceEl.textContent = money(v.price);
        var lbl = label(v);
        if (lbl) waText += ' – ' + lbl;
        waText += ', ' + money(v.price) + (P.category === 'bundles' ? ' for 3 bundles' : '');
        if (P.enquire) {
          stockEl.className = 'stock pre';
          stockEl.textContent = 'Pre-order – we confirm availability before you pay.';
        } else if (v.stock <= 0) {
          stockEl.className = 'stock out';
          stockEl.textContent = 'Sold out – enquire on WhatsApp and we’ll let you know when it’s back.';
        } else {
          stockEl.className = 'stock ' + (v.stock <= 2 ? 'low' : 'ok');
          stockEl.textContent = v.stock <= 2 ? 'In stock – only ' + v.stock + ' left' : 'In stock – ready to ship';
        }
        if (addBtn) {
          addBtn.disabled = P.enquire || v.stock <= 0;
          addBtn.textContent = v.stock <= 0 ? 'Sold out' : 'Add to cart – ' + money(v.price);
          qtyEl.max = Math.max(1, v.stock);
          if (+qtyEl.value > v.stock) qtyEl.value = Math.max(1, v.stock);
        }
      } else {
        stockEl.className = 'stock';
        var missing = P.optionNames.filter(function (n) { return !sel[n]; });
        stockEl.textContent = missing.length
          ? 'Please choose your ' + missing.join(' and ').toLowerCase() + '.'
          : 'This combination is not available - please choose another option, or ask us on WhatsApp.';
        if (addBtn) { addBtn.disabled = true; addBtn.textContent = 'Choose an option'; }
      }
      // Delivery choice for WhatsApp orders: shows the total and adds it to the message
      var dm = (P.delivery || []).find(function (d) { return d.id === dSel; });
      $$('[data-delivery]').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-delivery') === dSel);
        b.setAttribute('aria-pressed', b.getAttribute('data-delivery') === dSel);
      });
      var dv = $('[data-delivery-value]'); if (dv) dv.textContent = dm ? dm.name : 'please choose';
      var ad = $('[data-after-dispatch]'); if (ad && dm && P.enquire) ad.textContent = dm.after;
      var wt = $('[data-wa-total]');
      if (v && dm) {
        var dfee = P.freeOver && v.price >= P.freeOver ? 0 : dm.fee;
        var dtxt = dfee ? money(dfee) : 'free';
        if (wt) wt.textContent = 'Total with delivery: ' + money(v.price + dfee) + ' (' + money(v.price) + ' + ' + dtxt + ' delivery)';
        waText += '. Delivery: ' + dm.name + ' (' + dtxt + '). Total with delivery: ' + money(v.price + dfee);
      } else if (wt) wt.textContent = '';
      waText += '. ' + P.url + (v ? '?v=' + v.id : '');
      if (waBtn) waBtn.href = waLink(waText);
    }

    $$('[data-opt] .opt-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var name = b.closest('[data-opt]').getAttribute('data-opt');
        sel[name] = b.getAttribute('data-value');
        // If this choice makes the combination impossible, keep it and move the other options to a valid match
        if (!current()) {
          var fit = P.variants.find(function (x) {
            return x.options[name] === sel[name] && P.optionNames.every(function (n) { return n === name || x.options[n] === sel[n] || !P.variants.some(function (y) { return y.options[name] === sel[name] && y.options[n] === sel[n]; }); });
          }) || P.variants.find(function (x) { return x.options[name] === sel[name]; });
          if (fit) P.optionNames.forEach(function (n) { sel[n] = fit.options[n]; });
        }
        if (addedEl) addedEl.hidden = true;
        render();
      });
    });

    // Preselect: ?v= link from social media, or first in-stock option, or only option
    var pre = P.variants.find(function (v) { return v.id === P.preselect; })
      || (P.enquire ? P.variants[0] : P.variants.find(function (v) { return v.stock > 0; }))
      || P.variants[0];
    if (pre) P.optionNames.forEach(function (n) { sel[n] = pre.options[n]; });
    render();

    $$('[data-delivery]').forEach(function (b) {
      b.addEventListener('click', function () { dSel = b.getAttribute('data-delivery'); render(); });
    });

    // thumbnails
    $$('[data-thumb]').forEach(function (t) {
      t.addEventListener('click', function () {
        $('[data-main-img]').src = t.getAttribute('data-thumb');
        $$('[data-thumb]').forEach(function (x) { x.classList.toggle('on', x === t); });
      });
    });

    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = current();
      if (!v || P.enquire || v.stock <= 0) return;
      var q = Math.max(1, Math.min(v.stock, parseInt(qtyEl.value, 10) || 1));
      var cart = getCart();
      var line = cart.find(function (l) { return l.v === v.id; });
      if (line) line.q = Math.min(v.stock, line.q + q); else cart.push({ v: v.id, q: q });
      setCart(cart);
      addedEl.hidden = false;
      addedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  })();

  /* ---------- pricing via server (always authoritative) ---------- */
  function fetchCart() {
    return fetch('/api/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lines: getCart() }) })
      .then(function (r) { return r.json(); });
  }
  function fillTotals(root, subtotal, fee, from) {
    var pre = from ? 'from ' : '';
    $('[data-subtotal]', root).textContent = money(subtotal);
    $('[data-delivery]', root).textContent = fee == null ? 'Confirmed on WhatsApp' : (fee ? pre + money(fee) : 'Free');
    $('[data-total]', root).textContent = pre + money(subtotal + (fee || 0));
  }
  function lineMeta(i) { return [i.kind_label, i.variant_label].filter(Boolean).join(' · '); }

  /* ---------- cart page ---------- */
  var cartPage = $('[data-cart-page]');
  if (cartPage) {
    var listEl = $('[data-cart-items]'), sumEl = $('[data-cart-summary]');
    var draw = function () {
      fetchCart().then(function (data) {
        // drop lines that no longer exist; clamp quantities to stock
        var cart = getCart().filter(function (l) { return data.items.some(function (i) { return i.variant_id === l.v; }); });
        setCart(cart);
        if (!data.items.length) {
          listEl.innerHTML = '<div class="empty"><p>Your cart is empty.</p><a class="btn btn-gold" href="/shop">Shop available hair</a></div>';
          sumEl.hidden = true; return;
        }
        var blocked = false;
        listEl.innerHTML = data.items.map(function (i) {
          var warn = '';
          if (!i.purchasable) { warn = 'No longer available online – please remove it.'; blocked = true; }
          else if (i.stock <= 0) { warn = 'Sold out – please remove it.'; blocked = true; }
          else if (i.qty > i.stock) { warn = 'Only ' + i.stock + ' left – please reduce the quantity.'; blocked = true; }
          return '<div class="cart-line">' +
            '<img src="' + esc(i.image || '/static/img/photo-coming-soon.svg') + '" alt="">' +
            '<div><h3><a href="/product/' + esc(i.slug) + '">' + esc(i.product_name) + '</a></h3>' +
            '<p class="meta">' + esc(lineMeta(i)) + '<br>' + money(i.unit_cents) + (i.category === 'bundles' ? ' for a set of 3 bundles' : ' each') + '</p>' +
            '<div class="ctrl"><button type="button" data-dec="' + i.variant_id + '" aria-label="Fewer">−</button><span>' + i.qty + '</span>' +
            '<button type="button" data-inc="' + i.variant_id + '" aria-label="More"' + (i.qty >= i.stock ? ' disabled' : '') + '>+</button>' +
            '<button type="button" class="rm" data-rm="' + i.variant_id + '">Remove</button></div>' +
            (warn ? '<p class="warn">' + warn + '</p>' : '') + '</div>' +
            '<div class="lt">' + money(i.unit_cents * i.qty) + '</div></div>';
        }).join('');
        sumEl.hidden = false;
        var fees = (data.methods || []).map(function (m) { return m.fee; });
        var minFee = fees.length ? Math.min.apply(null, fees) : null;
        fillTotals(sumEl, data.subtotal, minFee, fees.length > 1 && minFee !== Math.max.apply(null, fees));
        var co = $('a[href="/checkout"]', sumEl);
        co.classList.toggle('disabled', blocked);
        co.setAttribute('aria-disabled', blocked);
        co.onclick = function (e) { if (blocked) { e.preventDefault(); alert('Please fix the items marked in red first.'); } };
      });
    };
    listEl.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var cart = getCart(), id;
      if ((id = b.getAttribute('data-inc'))) cart.forEach(function (l) { if (l.v == id) l.q++; });
      if ((id = b.getAttribute('data-dec'))) cart.forEach(function (l) { if (l.v == id) l.q = Math.max(1, l.q - 1); });
      if ((id = b.getAttribute('data-rm'))) cart = cart.filter(function (l) { return l.v != id; });
      setCart(cart); draw();
    });
    draw();
  }

  /* ---------- checkout page ---------- */
  var coPage = $('[data-checkout-page]');
  if (coPage) {
    var coForm = $('[data-checkout-form]'), errEl = $('[data-form-error]'), btn = $('[data-place-order]');
    var coItems = $('[data-co-items]');
    if (!getCart().length) { location.href = '/cart'; return; }
    var cartData = null, methodFee = {};
    var applyMethod = function () {
      var r = coForm.querySelector('input[name=delivery_method]:checked');
      var type = r ? r.getAttribute('data-type') : 'address';
      $$('[data-addr]', coForm).forEach(function (block) {
        var on = block.getAttribute('data-addr') === type;
        block.hidden = !on;
        $$('input, select, textarea', block).forEach(function (f) { f.disabled = !on; });
      });
      var tEl = $('[data-delivery-time]'); if (tEl && r) tEl.textContent = r.getAttribute('data-time');
      var lEl = $('[data-co-summary] [data-delivery-label]'); if (lEl) lEl.textContent = r ? 'Delivery – ' + r.getAttribute('data-name') : 'Delivery';
      if (!cartData) return;
      var fee = r && methodFee[r.value] != null ? methodFee[r.value] : null;
      fillTotals($('[data-co-summary]'), cartData.subtotal, fee, false);
      btn.textContent = 'Place order – ' + money(cartData.subtotal + (fee || 0));
    };
    coForm.addEventListener('change', function (e) { if (e.target.name === 'delivery_method') applyMethod(); });
    applyMethod();
    fetchCart().then(function (data) {
      cartData = data;
      (data.methods || []).forEach(function (m) { methodFee[m.id] = m.fee; });
      coItems.innerHTML = data.items.map(function (i) {
        return '<div class="line"><div><strong>' + esc(i.product_name) + '</strong><span class="muted small">' + esc(lineMeta(i)) + ' × ' + i.qty + '</span></div><span>' + money(i.unit_cents * i.qty) + '</span></div>';
      }).join('');
      applyMethod();
    });
    // restore half-filled details
    try {
      var saved = JSON.parse(localStorage.getItem('nolle_details') || '{}');
      Object.keys(saved).forEach(function (k) { var f = coForm.elements[k]; if (f && f.type !== 'checkbox' && f.type !== 'radio' && !f.value) f.value = saved[k]; });
    } catch (e) {}
    coForm.addEventListener('input', function () {
      var d = {}; ['name', 'phone', 'email', 'address1', 'address2', 'suburb', 'city', 'province', 'postal_code', 'paxi_point'].forEach(function (k) { d[k] = coForm.elements[k].value; });
      try { localStorage.setItem('nolle_details', JSON.stringify(d)); } catch (e) {}
    });
    coForm.addEventListener('submit', function (e) {
      e.preventDefault();
      errEl.hidden = true;
      var firstBad = null;
      $$('input, select, textarea', coForm).forEach(function (f) {
        var bad = !f.checkValidity();
        f.classList.toggle('invalid', bad && f.type !== 'checkbox');
        if (bad && !firstBad) firstBad = f;
      });
      if (firstBad) {
        errEl.textContent = firstBad.name === 'agree' ? 'Please tick the box to agree to the policies.' : 'Please check the highlighted fields.';
        errEl.hidden = false; firstBad.focus(); return;
      }
      var fd = new FormData(coForm), body = {};
      fd.forEach(function (v, k) { body[k] = v; });
      body.lines = getCart();
      try { body.source = sessionStorage.getItem('nolle_src') || ''; } catch (e2) {}
      btn.disabled = true; var txt = btn.textContent; btn.textContent = 'Placing your order…';
      fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.j.error || 'Something went wrong.');
          setCart([]);
          location.href = res.j.redirect;
        })
        .catch(function (err) {
          errEl.textContent = err.message + ' If this keeps happening, please WhatsApp us.';
          errEl.hidden = false; btn.disabled = false; btn.textContent = txt;
        });
    });
  }
})();
