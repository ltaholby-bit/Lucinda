'use strict';
/* Sends email if SMTP is configured (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
   MAIL_FROM). Without SMTP the message is printed to the server log instead, so
   ordering never fails because email is not set up yet. */
let transport = null;
if (process.env.SMTP_HOST) {
  const nodemailer = require('nodemailer');
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

async function sendMail({ to, subject, text, html, replyTo }) {
  if (!to) return;
  if (!transport) {
    console.log(`[mail:not-configured] To: ${to} | ${subject}`);
    return;
  }
  try {
    await transport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text, html, replyTo });
  } catch (e) {
    console.error('[mail:error]', e.message);
  }
}
module.exports = { sendMail, mailConfigured: () => !!transport };
