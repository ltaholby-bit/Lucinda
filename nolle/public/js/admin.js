/* Nolle’ admin helpers: variant editor, uploads, confirmations, copy links. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  $$('form[data-confirm]').forEach(function (f) {
    f.addEventListener('submit', function (e) { if (!confirm(f.getAttribute('data-confirm'))) e.preventDefault(); });
  });
  $$('[data-copy-text]').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-copy-text');
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () {
        var o = b.textContent; b.textContent = 'Copied!'; setTimeout(function () { b.textContent = o; }, 1300);
      }, function () { prompt('Copy this link:', t); });
    });
  });

  function upload(file, statusEl) {
    statusEl.textContent = 'Uploading ' + file.name + '…';
    return fetch('/admin/upload', { method: 'POST', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j.error) throw new Error(j.error); statusEl.textContent = ''; return j.url; })
      .catch(function (e) { statusEl.textContent = file.name + ': ' + e.message; throw e; });
  }

  /* ---------- product form ---------- */
  var form = $('[data-product-form]');
  if (form) {
    var namesIn = $('[data-option-names]'), editor = $('[data-variants-editor]'), jsonIn = $('[data-variants-json]');
    var rows = JSON.parse(jsonIn.value || '[]');
    if (!rows.length) rows.push({ options: {}, price: '', stock: 1 });
    var names = function () { return namesIn.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean); };

    var drawRows = function () {
      var n = names();
      editor.innerHTML = '<div class="tbl-wrap"><table class="tbl var-tbl"><thead><tr>' +
        n.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') +
        '<th>Price (R)</th><th>In stock</th><th>Code (optional)</th><th></th></tr></thead><tbody>' +
        rows.map(function (r, i) {
          return '<tr data-i="' + i + '">' +
            n.map(function (x) { return '<td><input data-k="opt" data-name="' + esc(x) + '" value="' + esc((r.options || {})[x] || '') + '" placeholder="e.g. 20&quot;" required></td>'; }).join('') +
            '<td><input data-k="price" class="num" value="' + esc(r.price) + '" inputmode="decimal" required placeholder="3200"></td>' +
            '<td><input data-k="stock" class="num" type="number" min="0" value="' + esc(r.stock) + '"></td>' +
            '<td><input data-k="sku" value="' + esc(r.sku || '') + '"></td>' +
            '<td><button type="button" class="btn btn-danger btn-sm" data-del="' + i + '"' + (rows.length < 2 ? ' disabled' : '') + '>Remove</button></td></tr>';
        }).join('') + '</tbody></table></div>';
    };
    var sync = function () {
      $$('tr[data-i]', editor).forEach(function (tr) {
        var r = rows[+tr.getAttribute('data-i')];
        r.options = r.options || {};
        $$('input', tr).forEach(function (inp) {
          var k = inp.getAttribute('data-k');
          if (k === 'opt') r.options[inp.getAttribute('data-name')] = inp.value; else r[k] = inp.value;
        });
      });
      jsonIn.value = JSON.stringify(rows);
    };
    editor.addEventListener('input', sync);
    editor.addEventListener('click', function (e) {
      var d = e.target.getAttribute('data-del');
      if (d != null) { sync(); rows.splice(+d, 1); drawRows(); sync(); }
    });
    $('[data-add-variant]').addEventListener('click', function () { sync(); rows.push({ options: {}, price: '', stock: 1 }); drawRows(); });
    namesIn.addEventListener('change', function () { sync(); drawRows(); sync(); });
    drawRows(); sync();
    form.addEventListener('submit', sync);

    /* images */
    var imgIn = $('[data-images-json]'), list = $('[data-images-list]'), status = $('[data-upload-status]');
    var imgs = JSON.parse(imgIn.value || '[]');
    var drawImgs = function () {
      imgIn.value = JSON.stringify(imgs);
      list.innerHTML = imgs.map(function (u, i) {
        return '<figure><img src="' + esc(u) + '" alt="">' + (i === 0 ? '<span class="main-tag">Main</span>' : '') +
          '<figcaption>' + (i > 0 ? '<button type="button" data-left="' + i + '">◀</button>' : '') +
          '<button type="button" data-rmimg="' + i + '">Remove</button>' +
          (i < imgs.length - 1 ? '<button type="button" data-right="' + i + '">▶</button>' : '') + '</figcaption></figure>';
      }).join('') || '<p class="muted small">No photos yet.</p>';
    };
    list.addEventListener('click', function (e) {
      var t = e.target, i;
      if ((i = t.getAttribute('data-rmimg')) != null) imgs.splice(+i, 1);
      else if ((i = t.getAttribute('data-left')) != null) { i = +i; imgs.splice(i - 1, 0, imgs.splice(i, 1)[0]); }
      else if ((i = t.getAttribute('data-right')) != null) { i = +i; imgs.splice(i + 1, 0, imgs.splice(i, 1)[0]); }
      else return;
      drawImgs();
    });
    $('[data-upload-images]').addEventListener('change', function (e) {
      var files = Array.prototype.slice.call(e.target.files);
      files.reduce(function (p, f) {
        return p.then(function () { return upload(f, status).then(function (u) { imgs.push(u); drawImgs(); }, function () {}); });
      }, Promise.resolve());
      e.target.value = '';
    });
    drawImgs();

    /* video */
    var vIn = $('[data-video-input]'), vPrev = $('[data-video-preview]');
    var drawVideo = function () {
      vPrev.innerHTML = vIn.value ? '<video src="' + esc(vIn.value) + '" controls muted playsinline></video><button type="button" class="btn btn-danger btn-sm" data-rmvid>Remove video</button>' : '<p class="muted small">No video.</p>';
    };
    vPrev.addEventListener('click', function (e) { if (e.target.hasAttribute('data-rmvid')) { vIn.value = ''; drawVideo(); } });
    $('[data-upload-video]').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      upload(f, status).then(function (u) { vIn.value = u; drawVideo(); }, function () {});
      e.target.value = '';
    });
    drawVideo();
  }

  /* ---------- settings: hero photo ---------- */
  var heroUp = $('[data-upload-hero]');
  if (heroUp) heroUp.addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f) return;
    upload(f, $('[data-upload-status]')).then(function (u) {
      $('[data-hero-input]').value = u;
      $('[data-hero-preview]').innerHTML = '<img class="a-hero" src="' + esc(u) + '" alt=""><p class="muted small">Press “Save settings” to use this photo.</p>';
    }, function () {});
  });
})();
