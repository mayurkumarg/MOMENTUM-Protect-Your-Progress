const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const isProduction = process.env.NODE_ENV === 'production';

const required = [
  'MONGO_URI',
  'JWT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'GITHUB_REDIRECT_URI',
];

const MIN_SECRET_LENGTH = 32;

// In production, a weak/missing secret refuses to boot. In development it's
// only a warning, so the existing local .env keeps working unmodified.
const enforce = (condition, message) => {
  if (!condition) return;
  if (isProduction) throw new Error(message);
  console.warn(`[env] ${message}`);
};

const validateEnv = () => {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  enforce(
    process.env.JWT_SECRET.length < MIN_SECRET_LENGTH,
    `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters (this one is ${process.env.JWT_SECRET.length}).`
  );

  if (!process.env.GITHUB_TOKEN_ENCRYPTION_KEY) {
    enforce(
      true,
      'GITHUB_TOKEN_ENCRYPTION_KEY is not set — GitHub tokens will be encrypted with a key derived from JWT_SECRET instead of a dedicated key. Set GITHUB_TOKEN_ENCRYPTION_KEY before deploying.'
    );
  } else {
    enforce(
      process.env.GITHUB_TOKEN_ENCRYPTION_KEY.length < MIN_SECRET_LENGTH,
      `GITHUB_TOKEN_ENCRYPTION_KEY must be at least ${MIN_SECRET_LENGTH} characters.`
    );
  }

  if (!process.env.JWT_REFRESH_SECRET) {
    console.warn('[env] JWT_REFRESH_SECRET is not set — falling back to JWT_SECRET for refresh tokens.');
  } else if (process.env.JWT_REFRESH_SECRET === process.env.JWT_SECRET) {
    console.warn('[env] JWT_REFRESH_SECRET is identical to JWT_SECRET — consider using a distinct value.');
  }

  if (!process.env.GROQ_API_KEY) {
    console.warn('[env] GROQ_API_KEY is not set — the AI Assistant will stay disabled until it is configured.');
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('[env] GMAIL_USER/GMAIL_APP_PASSWORD are not set — email reminders will stay disabled until both are configured.');
  }
};

module.exports = {
  validateEnv,
  isProduction,
};
