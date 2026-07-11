// Thin transport around Mailtrap's Sending API — the ONLY place that knows
// how to actually send an email. Swapping providers later (or adding a
// second channel like SMS) means touching this module, not every caller.
// Uses axios, already a dependency (same HTTP client groq.service.js and
// github.service.js use).

const axios = require('axios');

const MAILTRAP_SEND_URL = 'https://send.api.mailtrap.io/api/send';
const REQUEST_TIMEOUT_MS = 15000;

const getApiToken = () => process.env.MAILTRAP_API_TOKEN || '';
const getFromEmail = () => process.env.MAIL_FROM_EMAIL || 'noreply@momentum-sync.com';
const getFromName = () => process.env.MAIL_FROM_NAME || 'Momentum';

const isConfigured = () => Boolean(getApiToken());

const sendEmail = async ({ to, subject, html, text, category }) => {
  const apiToken = getApiToken();
  if (!apiToken) {
    throw new Error('Email is not configured (MAILTRAP_API_TOKEN unset).');
  }

  await axios.post(
    MAILTRAP_SEND_URL,
    {
      from: { email: getFromEmail(), name: getFromName() },
      to: [{ email: to }],
      subject,
      html,
      text,
      category: category || 'reminder',
    },
    {
      headers: {
        // Mailtrap's own custom header, not the more common Authorization: Bearer.
        'Api-Token': apiToken,
        'Content-Type': 'application/json',
      },
      timeout: REQUEST_TIMEOUT_MS,
    }
  );
};

module.exports = {
  isConfigured,
  sendEmail,
};
