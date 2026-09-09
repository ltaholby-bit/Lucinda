/* Lucinda — site behaviour. No dependencies. */
(function () {
  "use strict";

  /* ---- Footer year -------------------------------------------------- */
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  /* ---- Mobile navigation -------------------------------------------- */
  var nav = document.querySelector(".nav");
  var toggle = document.querySelector(".nav__toggle");

  if (nav && toggle) {
    toggle.addEventListener("click", function () {
      var open = nav.getAttribute("data-open") === "true";
      nav.setAttribute("data-open", String(!open));
      toggle.setAttribute("aria-expanded", String(!open));
    });
  }

  /* ---- Reveal on scroll --------------------------------------------- */
  var reveals = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {
    Array.prototype.forEach.call(reveals, function (el) {
      el.classList.add("is-visible");
    });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });

    Array.prototype.forEach.call(reveals, function (el) { observer.observe(el); });
  }

  /* ---- Order form ----------------------------------------------------
     Static site, so there is no server to post to. On submit we validate,
     then hand the details to the visitor's mail client. To move to a real
     backend, give the <form> an action/method and delete this block.
     -------------------------------------------------------------------- */

  var STUDIO_EMAIL = "hello@lucinda.example";

  var form = document.getElementById("order-form");
  if (!form) return;

  var status = document.getElementById("form-status");

  function say(message) {
    if (!status) return;
    status.textContent = message;
    status.hidden = false;
  }

  // Don't accept a date in the past.
  var dateField = form.querySelector("#date");
  if (dateField) {
    var today = new Date();
    var pad = function (n) { return String(n).padStart(2, "0"); };
    dateField.min = today.getFullYear() + "-" + pad(today.getMonth() + 1) + "-" + pad(today.getDate());
  }

  function labelFor(field) {
    var label = form.querySelector('label[for="' + field.id + '"]');
    var text = label ? label.textContent : field.name;
    return text.replace(/\s*\*\s*$/, "").trim();
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    // Required fields, plus the size radio group.
    var missing = [];

    ["#name", "#email", "#date"].forEach(function (sel) {
      var field = form.querySelector(sel);
      if (field && !field.value.trim()) missing.push(labelFor(field));
    });

    var email = form.querySelector("#email");
    if (email && email.value.trim() && !email.checkValidity()) {
      missing.push("a valid email address");
    }

    var size = form.querySelector('input[name="cake-size"]:checked');
    if (!size) missing.push("a cake size");

    if (missing.length) {
      say("Please add " + missing.join(", ") + " before sending.");

      // Focus whatever is missing first, in document order.
      var focusTarget = null;
      ["#name", "#email", "#date"].some(function (sel) {
        var field = form.querySelector(sel);
        if (field && (!field.value.trim() || !field.checkValidity())) {
          focusTarget = field;
          return true;
        }
        return false;
      });
      if (!focusTarget && !size) {
        focusTarget = form.querySelector('input[name="cake-size"]');
      }
      if (focusTarget) focusTarget.focus();
      return;
    }

    // Build a readable enquiry.
    var data = new FormData(form);
    var dietary = data.getAll("dietary");

    var lines = [
      "CAKE ORDER ENQUIRY",
      "",
      "Name: " + (data.get("name") || ""),
      "Email: " + (data.get("email") || ""),
      "Phone: " + (data.get("phone") || "—"),
      "",
      "Cake size: " + (data.get("cake-size") || ""),
      "Occasion: " + (data.get("occasion") || "—"),
      "Guest count: " + (data.get("guests") || "—"),
      "Sponge: " + (data.get("flavour") || "—"),
      "Filling: " + (data.get("filling") || "—"),
      "Dietary: " + (dietary.length ? dietary.join(", ") : "—"),
      "",
      "Date needed: " + (data.get("date") || ""),
      "Collection: " + (data.get("collection") || "—"),
      "Budget: " + (data.get("budget") || "—"),
      "",
      "Design notes:",
      (data.get("brief") || "—")
    ];

    var subject = "Cake order — " + (data.get("name") || "") + " — " + (data.get("date") || "");
    var href = "mailto:" + STUDIO_EMAIL +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(lines.join("\n"));

    window.location.href = href;
    say("Opening your email app with the order details filled in. If nothing happens, email us at " + STUDIO_EMAIL + ".");
  });
})();
