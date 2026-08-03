'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Shared rate limiter options factory.
 */
function createLimiter(windowMs, max, message) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,  // Return rate limit info in RateLimit-* headers
    legacyHeaders:   false,  // Disable X-RateLimit-* headers
    message: {
      success:    false,
      message,
      code:       'RATE_LIMIT_EXCEEDED',
    },
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json(options.message);
    },
    skip: (req) => process.env.NODE_ENV === 'test', // Bypass in test mode
  });
}

/**
 * General API limiter — 300 requests per 15 minutes.
 * Applied to all routes. Raised from 100 to avoid throttling legitimate
 * users who open multiple data-heavy pages (dashboard, invoices, inventory).
 */
const generalLimiter = createLimiter(
  15 * 60 * 1000,
  300,
  'Too many requests. Please slow down and try again after 15 minutes.'
);

/**
 * Strict auth limiter — 5 requests per 15 minutes.
 * Applied to /login, /register, /forgot-password.
 */
const authLimiter = createLimiter(
  15 * 60 * 1000,
  5,
  'Too many authentication attempts. Please wait 15 minutes before trying again.'
);

/**
 * API limiter — 200 requests per 15 minutes.
 * For high-volume authenticated API endpoints.
 */
const apiLimiter = createLimiter(
  15 * 60 * 1000,
  200,
  'API rate limit exceeded. Please reduce request frequency.'
);

/**
 * Password reset limiter — 3 requests per hour.
 */
const passwordResetLimiter = createLimiter(
  60 * 60 * 1000,
  3,
  'Too many password reset attempts. Please wait 1 hour.'
);

module.exports = {
  generalLimiter,
  authLimiter,
  apiLimiter,
  passwordResetLimiter,
};
