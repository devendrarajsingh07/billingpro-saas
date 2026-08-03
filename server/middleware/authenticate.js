'use strict';

const crypto = require('crypto');
const jwt  = require('jsonwebtoken');
const db   = require('../config/database');
const { AuthError } = require('../utils/ApiError');

/**
 * Extracts the Bearer token from the Authorization header.
 * @param {object} req
 * @returns {string|null}
 */
function extractBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

/**
 * Primary authentication middleware.
 *
 * - Verifies the JWT access token from Authorization: Bearer <token>
 * - Loads the user from DB and attaches req.user, req.companyId
 * - Throws AuthError on failure
 */
async function authenticate(req, res, next) {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      throw new AuthError('No authentication token provided.');
    }

    // Verify signature + expiry
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AuthError('Access token has expired. Please refresh your session.');
      }
      throw new AuthError('Invalid authentication token.');
    }

    // Load user from DB
    const user = db.prepare(`
      SELECT
        u.id, u.company_id, u.role_id, u.name, u.email,
        u.avatar, u.phone, u.is_email_verified, u.is_active,
        u.is_deleted, u.locked_until, u.failed_login_attempts,
        r.slug AS role_slug
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = ? AND u.is_deleted = 0
    `).get(payload.userId || payload.id);

    if (!user) {
      throw new AuthError('User account not found or has been removed.');
    }

    if (!user.is_active) {
      throw new AuthError('Your account has been deactivated. Please contact support.');
    }

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remaining = Math.ceil(
        (new Date(user.locked_until) - new Date()) / 60000
      );
      throw new AuthError(
        `Account is temporarily locked. Try again in ${remaining} minute(s).`
      );
    }

    // Attach to request
    req.user      = user;
    req.companyId = user.company_id;
    req.userId    = user.id;

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional authentication — does not throw if no token present.
 * Useful for public endpoints that have enhanced features for logged-in users.
 */
async function optionalAuthenticate(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) return next();
  return authenticate(req, res, next);
}

/**
 * Authenticates using the refresh token (from request body).
 * Used exclusively on the /refresh-token endpoint.
 */
async function authenticateRefreshToken(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AuthError('Refresh token is required.');
    }

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AuthError('Refresh token has expired. Please log in again.');
      }
      throw new AuthError('Invalid refresh token.');
    }

    // Load user and verify stored refresh token
    const user = db.prepare(`
      SELECT id, company_id, role_id, name, email, is_active, is_deleted,
             refresh_token, refresh_token_expires
      FROM users
      WHERE id = ? AND is_deleted = 0
    `).get(payload.userId || payload.id);

    if (!user) {
      throw new AuthError('User not found.');
    }

    if (!user.is_active) {
      throw new AuthError('Account is deactivated.');
    }

    const hashed = crypto.createHash('sha256').update(refreshToken).digest('hex');
    if (!user.refresh_token || user.refresh_token !== hashed) {
      throw new AuthError('Refresh token is invalid or has been revoked.');
    }

    if (user.refresh_token_expires && new Date(user.refresh_token_expires) < new Date()) {
      throw new AuthError('Refresh token has expired. Please log in again.');
    }

    req.user      = user;
    req.companyId = user.company_id;
    req.userId    = user.id;

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate, optionalAuthenticate, authenticateRefreshToken };
