/* ==========================================================================
   Grace & Co — site configuration.
   Edit this file to point the site at real contact details and services.
   ========================================================================== */
window.GRACE_CONFIG = {
  /* WhatsApp business number in international format, digits only. */
  whatsappNumber: "27000000000",

  /* Shown and linked in the header, footer and contact page. */
  phone: "+27 (0)00 000 0000",
  email: "hello@graceandco.co.za",

  /* Where enquiries are sent.
     Leave empty to fall back to opening the visitor's email client — note
     that the fallback CANNOT attach uploaded images.
     Set this to a form backend that accepts multipart/form-data
     (Formspree, Basin, Netlify Forms, your own endpoint) to enable real
     submissions including image uploads. */
  formEndpoint: "",

  /* Analytics — leave empty to load nothing at all.
     Both are only loaded after the visitor accepts the cookie notice. */
  ga4Id: "",         /* e.g. "G-XXXXXXXXXX" */
  metaPixelId: "",   /* e.g. "123456789012345" */

  /* Upload limits. */
  maxFiles: 3,
  maxFileBytes: 5 * 1024 * 1024
};
