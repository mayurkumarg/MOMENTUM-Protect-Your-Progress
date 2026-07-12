const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

// For per-user limiters, fall back to the client IP when there's no
// authenticated user. The IP must go through ipKeyGenerator so IPv6 addresses
// are normalized to a subnet (a raw req.ip lets IPv6 clients trivially rotate
// addresses to bypass the limit — express-rate-limit warns loudly otherwise).
const userOrIpKey = (req) => req.user?.userId || ipKeyGenerator(req.ip);

// All limiters respond with the same { success, message } envelope the rest
// of the API uses, so a 429 looks like any other API error to the client.
const makeLimiter = ({ windowMs, max, message, keyGenerator }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (req, res) => {
      res.status(429).json({ success: false, message });
    },
  });

const loginLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again in a few minutes.',
});

const registerLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 8,
  message: 'Too many accounts created from this location. Please try again later.',
});

const refreshLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many session refresh attempts. Please try again shortly.',
});

const oauthStartLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many GitHub sign-in attempts. Please try again shortly.',
});

// Authenticated routes — keyed per-user rather than per-IP so one abusive
// account can't drown out others behind the same NAT/proxy.
const assistantLimiter = makeLimiter({
  windowMs: 10 * 60 * 1000,
  max: 15,
  message: 'You are sending messages too quickly. Please slow down.',
  keyGenerator: userOrIpKey,
});

const githubWriteLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many GitHub repository actions. Please try again shortly.',
  keyGenerator: userOrIpKey,
});

const updateEmailLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many email change attempts. Please try again later.',
  keyGenerator: userOrIpKey,
});

module.exports = {
  loginLimiter,
  registerLimiter,
  refreshLimiter,
  oauthStartLimiter,
  assistantLimiter,
  githubWriteLimiter,
  updateEmailLimiter,
};
