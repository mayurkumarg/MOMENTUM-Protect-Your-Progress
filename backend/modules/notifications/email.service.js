// Thin transport around Gmail SMTP (via Nodemailer) — the ONLY place that
// knows how to actually send an email. Swapping providers later (or adding
// a second channel like SMS) means touching this module, not every caller.
//
// Uses a regular Gmail account + an "App Password" (not the account
// password — generate one at https://myaccount.google.com/apppasswords,
// requires 2-Step Verification enabled). Unlike Mailtrap's free demo
// domain, this delivers to any recipient with no domain verification step,
// at the cost of Gmail's own sending limits (~500/day on a normal account).

const nodemailer = require('nodemailer');

const getUser = () => process.env.GMAIL_USER || '';
const getAppPassword = () => process.env.GMAIL_APP_PASSWORD || '';
const getFromName = () => process.env.MAIL_FROM_NAME || 'Momentum';

const isConfigured = () => Boolean(getUser() && getAppPassword());

// Built lazily rather than at require time, so a missing/invalid config
// doesn't crash module load — isConfigured() gates every caller first.
let transporter = null;
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: getUser(), pass: getAppPassword() },
    });
  }
  return transporter;
};

const sendEmail = async ({ to, subject, html, text }) => {
  if (!isConfigured()) {
    throw new Error('Email is not configured (GMAIL_USER/GMAIL_APP_PASSWORD unset).');
  }

  await getTransporter().sendMail({
    from: `"${getFromName()}" <${getUser()}>`,
    to,
    subject,
    html,
    text,
  });
};

module.exports = {
  isConfigured,
  sendEmail,
};
