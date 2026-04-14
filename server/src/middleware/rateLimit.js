const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const env = require('../config/env');

function attachRateLimitIdentity(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload?.sub) {
      req.rateLimitUserId = payload.sub;
    }
  } catch {
    req.rateLimitUserId = null;
  }

  next();
}

function buildKey(req) {
  return req.rateLimitUserId
    ? `user:${req.rateLimitUserId}`
    : `ip:${req.ip}`;
}

function createLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: buildKey,
    handler(req, res) {
      res.status(429).json({
        success: false,
        message,
      });
    },
  });
}

const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: 'Too many authentication attempts. Please try again in a few minutes.',
});

const standardApiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 900,
  message: 'Too many requests. Slow down for a moment and try again shortly.',
});

const uploadLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: 'Upload limit reached for now. Please try again shortly.',
});

const aiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 45,
  message: 'AI request limit reached. Please try again shortly.',
});

const adminLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 450,
  message: 'Admin request limit reached. Please pause briefly and try again.',
});

module.exports = {
  attachRateLimitIdentity,
  authLimiter,
  standardApiLimiter,
  uploadLimiter,
  aiLimiter,
  adminLimiter,
};
