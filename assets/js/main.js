/* Grace & Co — site behaviour. No dependencies. */
(function () {
  "use strict";

  var CFG = window.GRACE_CONFIG || {};
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------------------------------------------------------- year */
  var year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  /* ------------------------------------------------- contact links */
  var waHref = "https://wa.me/" + String(CFG.whatsappNumber || "").replace(/\D/g, "");
  $$("[data-wa]").forEach(function (a) { a.href = waHref; });
  $$("[data-email]").forEach(function (a) {
    a.href = "mailto:" + CFG.email;
    if (!a.dataset.keepText) a.textContent = CFG.email;
  });
  $$("[data-phone]").forEach(function (a) {
    a.href = "tel:" + String(CFG.phone || "").replace(/[^\d+]/g, "");
    if (!a.dataset.keepText) a.textContent = CFG.phone;
  });

  /* ------------------------------------------------------------ nav */
  var nav = $(".nav"), toggle = $(".nav__toggle");
  if (nav && toggle) {
    toggle.addEventListener("click", function () {
      var open = nav.getAttribute("data-open") === "true";
      nav.setAttribute("data-open", String(!open));
      toggle.setAttribute("aria-expanded", String(!open));
    });
  }

  /* --------------------------------------------------------- reveal */
  var reveals = $$(".reveal");
  if (!("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------ cookies + analytics */

  function store(key, value) {
    try { if (arguments.length > 1) { localStorage.setItem(key, value); return value; } return localStorage.getItem(key); }
    catch (e) { return null; }
  }

  function loadAnalytics() {
    if (CFG.ga4Id) {
      var s = document.createElement("script");
      s.async = true;
      s.src = "https://www.googletagmanager.com/gtag/js?id=" + CFG.ga4Id;
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", CFG.ga4Id);
    }
    if (CFG.metaPixelId) {
      /* eslint-disable */
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
      (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
      window.fbq("init", CFG.metaPixelId);
      window.fbq("track", "PageView");
    }
  }

  var consent = store("gc-consent");
  var cookieBox = $("#cookie-notice");
  if (consent === "accept") {
    loadAnalytics();
  } else if (consent !== "decline" && cookieBox && (CFG.ga4Id || CFG.metaPixelId)) {
    cookieBox.hidden = false;
  }
  if (cookieBox) {
    $$("[data-cookie]", cookieBox).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var choice = btn.getAttribute("data-cookie");
        store("gc-consent", choice);
        cookieBox.hidden = true;
        if (choice === "accept") loadAnalytics();
      });
    });
  }

  /* Fires a conversion event for a completed enquiry. */
  function trackEnquiry(type) {
    if (window.gtag) window.gtag("event", "enquiry_submitted", { enquiry_type: type });
    if (window.fbq) window.fbq("track", "Lead", { content_category: type });
  }

  /* --------------------------------------------------- homepage routing */

  var planForm = $("#plan-form");
  if (planForm) {
    planForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var need = $('input[name="need"]:checked', planForm);
      var occasion = $('input[name="occasion"]:checked', planForm);
      var status = $("#plan-status");

      if (!need) {
        if (status) { status.textContent = "Please choose how Grace & Co can help."; status.hidden = false; status.classList.add("form-status--error"); }
        var firstNeed = $('input[name="need"]', planForm);
        if (firstNeed) firstNeed.focus();
        return;
      }

      var q = occasion ? "?occasion=" + encodeURIComponent(occasion.value) : "";
      var routes = {
        "I need a cake":          "cakes.html" + q + "#enquiry",
        "I need decor":           "decor.html" + q + "#enquiry",
        "I need cake and decor":  "enquiry.html" + (q ? q + "&" : "?") + "need=both",
        "Show me your work":      "work.html",
        "Please contact me":      "contact.html#contact-me"
      };
      window.location.href = routes[need.value] || "enquiry.html";
    });
  }

  /* ------------------------------------------- conditional enquiry blocks */

  function setSectionEnabled(section, on) {
    section.hidden = !on;
    $$("input, select, textarea, button", section).forEach(function (el) { el.disabled = !on; });
  }

  var conditionals = $$("[data-conditional]");
  if (conditionals.length) {
    var needMap = { "A cake": ["cake"], "Decor": ["decor"], "Cake and decor": ["cake", "decor"] };

    var applyNeed = function (value) {
      var show = needMap[value] || [];
      conditionals.forEach(function (sec) {
        setSectionEnabled(sec, show.indexOf(sec.getAttribute("data-conditional")) !== -1);
      });
    };

    conditionals.forEach(function (sec) { setSectionEnabled(sec, false); });

    $$('input[name="need"]').forEach(function (input) {
      input.addEventListener("change", function () { applyNeed(input.value); });
    });

    /* Preselect from the homepage journey (?need=both, ?occasion=Birthday). */
    var params = new URLSearchParams(window.location.search);
    var preNeed = { both: "Cake and decor", cake: "A cake", decor: "Decor" }[params.get("need")];
    if (preNeed) {
      $$('input[name="need"]').forEach(function (i) { if (i.value === preNeed) i.checked = true; });
      applyNeed(preNeed);
    }
    var preOcc = params.get("occasion");
    if (preOcc) $$('input[name="occasion"]').forEach(function (i) { if (i.value === preOcc) i.checked = true; });
  }

  /* Preselect occasion on the cake/decor pages too. */
  (function () {
    if (conditionals.length) return;
    var occ = new URLSearchParams(window.location.search).get("occasion");
    if (occ) $$('input[name="occasion"]').forEach(function (i) { if (i.value === occ) i.checked = true; });
  })();

  /* -------------------------------------------------------- file uploads */

  var uploadState = new WeakMap();

  $$("[data-upload]").forEach(function (box) {
    var input = $('input[type="file"]', box);
    var list  = $("[data-upload-list]", box);
    var max   = parseInt(box.getAttribute("data-max"), 10) || CFG.maxFiles || 3;
    if (!input || !list) return;

    uploadState.set(input, []);

    var render = function () {
      var files = uploadState.get(input);
      list.innerHTML = "";
      files.forEach(function (file, i) {
        var wrap = document.createElement("div");
        wrap.className = "upload__thumb";

        var img = document.createElement("img");
        img.alt = file.name;
        img.src = URL.createObjectURL(file);
        img.onload = function () { URL.revokeObjectURL(img.src); };

        var del = document.createElement("button");
        del.type = "button";
        del.setAttribute("aria-label", "Remove " + file.name);
        del.textContent = "×";
        del.addEventListener("click", function () {
          var next = uploadState.get(input).slice();
          next.splice(i, 1);
          uploadState.set(input, next);
          syncInput();
          render();
        });

        var name = document.createElement("p");
        name.className = "upload__name";
        name.textContent = file.name;

        wrap.appendChild(img); wrap.appendChild(del); wrap.appendChild(name);
        list.appendChild(wrap);
      });
    };

    /* Keep the real input in sync so a normal form POST carries the files. */
    var syncInput = function () {
      var dt = new DataTransfer();
      uploadState.get(input).forEach(function (f) { dt.items.add(f); });
      input.files = dt.files;
    };

    input.addEventListener("change", function () {
      var current = uploadState.get(input).slice();
      var rejected = [];

      Array.prototype.forEach.call(input.files, function (file) {
        if (current.length >= max) { rejected.push(file.name + " (limit " + max + ")"); return; }
        if (!/^image\//.test(file.type)) { rejected.push(file.name + " (not an image)"); return; }
        if (file.size > (CFG.maxFileBytes || 5242880)) { rejected.push(file.name + " (over 5 MB)"); return; }
        if (current.some(function (f) { return f.name === file.name && f.size === file.size; })) return;
        current.push(file);
      });

      uploadState.set(input, current);
      syncInput();
      render();

      var note = $(".upload__rejected", box);
      if (rejected.length) {
        if (!note) {
          note = document.createElement("p");
          note.className = "upload__rejected form__note";
          box.appendChild(note);
        }
        note.textContent = "Not added: " + rejected.join(", ") + ".";
      } else if (note) {
        note.remove();
      }
    });
  });

  /* -------------------------------------------------------- enquiry forms */

  function labelText(field, form) {
    var lbl = form.querySelector('label[for="' + field.id + '"]');
    if (lbl) return lbl.textContent.replace(/\s*\*\s*$/, "").trim();
    var fs = field.closest("fieldset");
    var lg = fs && fs.querySelector("legend");
    return lg ? lg.textContent.replace(/\s*\*\s*$/, "").trim() : (field.name || "this field");
  }

  /* For a radio group the useful name is the question (the legend), not the
     text of the first option card. */
  function groupLabel(field, form) {
    var fs = field.closest("fieldset");
    var lg = fs && fs.querySelector("legend");
    if (lg) return lg.textContent.replace(/\s*\*\s*$/, "").trim();
    return (field.name || "this field").replace(/_/g, " ");
  }

  function validate(form) {
    var missing = [], focus = null, seenGroups = {};

    $$("input, select, textarea", form).forEach(function (field) {
      if (field.disabled || !field.required) return;

      if (field.type === "radio") {
        if (seenGroups[field.name]) return;
        seenGroups[field.name] = true;
        if (!form.querySelector('input[name="' + field.name + '"]:checked')) {
          missing.push(groupLabel(field, form).toLowerCase());
          if (!focus) focus = field;
        }
        return;
      }

      if (!field.value.trim() || !field.checkValidity()) {
        missing.push(labelText(field, form).toLowerCase());
        if (!focus) focus = field;
      }
    });

    return { missing: missing, focus: focus };
  }

  function describe(form) {
    var data = new FormData(form);
    var seen = {}, lines = [];
    data.forEach(function (value, key) {
      if (value instanceof File) return;
      if (!String(value).trim()) return;
      (seen[key] = seen[key] || []).push(value);
    });
    Object.keys(seen).forEach(function (key) {
      var pretty = key.replace(/_/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      lines.push(pretty + ": " + seen[key].join(", "));
    });
    return lines.join("\n");
  }

  $$("form[data-enquiry]").forEach(function (form) {
    form.noValidate = true;
    var type = form.getAttribute("data-enquiry");
    var status = $(".form-status", form);
    var submit = form.querySelector('button[type="submit"]');

    var say = function (msg, isError) {
      if (!status) return;
      status.textContent = msg;
      status.hidden = false;
      status.classList.toggle("form-status--error", !!isError);
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var result = validate(form);
      if (result.missing.length) {
        say("Please complete: " + result.missing.join(", ") + ".", true);
        if (result.focus) result.focus.focus();
        return;
      }

      var files = 0;
      $$('input[type="file"]', form).forEach(function (i) { if (!i.disabled) files += i.files.length; });

      /* With a backend configured, post everything including the images. */
      if (CFG.formEndpoint) {
        submit.disabled = true;
        say("Sending your enquiry…");
        var body = new FormData(form);
        body.append("enquiry_type", type);

        fetch(CFG.formEndpoint, { method: "POST", body: body, headers: { Accept: "application/json" } })
          .then(function (res) {
            if (!res.ok) throw new Error("Request failed with status " + res.status);
            trackEnquiry(type);
            window.location.href = "thank-you.html?type=" + encodeURIComponent(type);
          })
          .catch(function (err) {
            submit.disabled = false;
            say("Sorry, that did not send (" + err.message + "). Please try again, or message us on WhatsApp.", true);
          });
        return;
      }

      /* No backend: hand the details to the visitor's email client. */
      var subject = "Grace & Co enquiry — " + type + " — " + (form.querySelector("#name") || {}).value;
      var bodyText = "GRACE & CO ENQUIRY (" + type + ")\n\n" + describe(form);
      if (files) bodyText += "\n\n[" + files + " inspiration image(s) selected — please attach them to this email.]";

      window.location.href = "mailto:" + CFG.email +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(bodyText);

      trackEnquiry(type);
      say(files
        ? "Opening your email app. Please attach your " + files + " inspiration image(s) before sending — they cannot be attached automatically."
        : "Opening your email app with your enquiry filled in. If nothing happens, email us at " + CFG.email + ".");
    });
  });

  /* ------------------------------------------------------ work gallery */

  var gallery = $("#work-gallery");
  if (gallery) {
    var items = $$("figure", gallery);
    var empty = $("#work-empty");

    $$(".filter").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var want = btn.getAttribute("data-filter");
        $$(".filter").forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });

        var shown = 0;
        items.forEach(function (fig) {
          var tags = (fig.getAttribute("data-tags") || "").split(/\s+/);
          var show = want === "all" || tags.indexOf(want) !== -1;
          fig.hidden = !show;
          if (show) shown++;
        });
        if (empty) empty.hidden = shown !== 0;
      });
    });
  }

  /* -------------------------------------------------------- thank you */

  var detail = $("#thanks-detail");
  if (detail) {
    var t = new URLSearchParams(window.location.search).get("type");
    var msg = {
      cake: "We have your cake enquiry and will come back with a design suggestion and a price.",
      decor: "We have your decor enquiry and will come back with a styling direction and a price.",
      both: "We have your cake and decor enquiry and will quote both together.",
      contact: "We have your details and will call or WhatsApp you at the time you chose."
    }[t];
    if (msg) { detail.textContent = msg; detail.hidden = false; }
  }
})();
