'use strict';

const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const db                = require('../config/database');
const UserRepository    = require('../repositories/UserRepository');
const CompanyRepository = require('../repositories/CompanyRepository');
const { AuthError, ConflictError, NotFoundError, ValidationError } = require('../utils/ApiError');
const eventBus          = require('../events/eventBus');

// ── Singleton repository instances ────────────────────────────
const userRepo    = new UserRepository(db);
const companyRepo = new CompanyRepository(db);

// ── Helpers ───────────────────────────────────────────────────

/**
 * Sign an access token (short-lived).
 * @param {object} payload
 * @returns {string}
 */
function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m',
  });
}

/**
 * Sign a refresh token (long-lived).
 * @param {object} payload
 * @returns {string}
 */
function signRefreshToken(payload) {
  return jwt.sign({ ...payload, jti: uuidv4() }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
  });
}

/**
 * Calculate when the refresh token expires as a Date object.
 * @returns {Date}
 */
function refreshTokenExpiry() {
  const value = String(process.env.JWT_REFRESH_EXPIRE || '7d').trim();
  const match = value.match(/^(\d+)\s*([smhdw])?$/i);
  if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const amount = Number(match[1]);
  const unit = (match[2] || 'd').toLowerCase();
  const millisecondsByUnit = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };
  return new Date(Date.now() + amount * millisecondsByUnit[unit]);
}

/**
 * Build the token pair returned in auth responses.
 * @param {object} user
 * @returns {{ accessToken: string, refreshToken: string }}
 */
function generateTokenPair(user) {
  const payload = {
    userId:    user.id,
    companyId: user.company_id,
    roleId:    user.role_id,
    email:     user.email,
  };

  const accessToken  = signAccessToken(payload);
  const refreshToken = signRefreshToken({ userId: user.id });

  return { accessToken, refreshToken };
}

/**
 * Hash a token for safe DB storage (password_reset_token, etc.).
 * @param {string} token
 * @returns {string} SHA-256 hex digest
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Strip sensitive fields before returning user to client.
 * @param {object} user
 * @returns {object}
 */
function sanitizeUser(user) {
  const {
    password_hash,
    refresh_token,
    refresh_token_expires,
    email_verify_token,
    email_verify_expires,
    password_reset_token,
    password_reset_expires,
    totp_secret,
    ...safe
  } = user;
  return safe;
}

function createTwoFactorChallenge(user) {
  return jwt.sign(
    { purpose: 'two_factor_login', userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );
}

function completeLogin(user, ip, twoFactorVerified = false) {
  if (user.totp_enabled && !twoFactorVerified) {
    return { requiresTwoFactor: true, tempToken: createTwoFactorChallenge(user) };
  }

  userRepo.resetFailedAttempts(user.id);
  userRepo.updateLastLogin(user.id, ip);
  const { accessToken, refreshToken } = generateTokenPair(user);
  userRepo.updateRefreshToken(user.id, hashToken(refreshToken), refreshTokenExpiry());

  const company = companyRepo.findById(user.company_id);
  eventBus.emit('user.loggedIn', { user: sanitizeUser(user), ip });
  return { user: sanitizeUser(user), company, accessToken, refreshToken };
}

// ── AuthService ───────────────────────────────────────────────

class AuthService {
  /**
   * Register a new company + owner user.
   *
   * @param {object} data
   * @param {string} data.name         - User's full name
   * @param {string} data.email        - User's email
   * @param {string} data.password     - Plain-text password
   * @param {string} data.company_name - Company name
   * @param {string} [data.phone]
   * @returns {{ user: object, company: object, accessToken: string, refreshToken: string }}
   */
  static register(data) {
    const { name, email, password, company_name, phone } = data;
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check for existing user
    const existingUser = userRepo.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictError('An account with this email already exists.');
    }

    // 2. Check for existing company email
    const existingCompany = companyRepo.findByEmail(normalizedEmail);
    if (existingCompany) {
      throw new ConflictError('A company with this email already exists.');
    }

    // 3. Find the owner system role
    const ownerRole = db.prepare(
      "SELECT id FROM roles WHERE slug = 'owner' AND company_id IS NULL LIMIT 1"
    ).get();

    if (!ownerRole) {
      throw new Error('System roles not seeded. Please run migrations first.');
    }

    // 4. Create company and user in a single transaction
    const result = db.transaction(() => {
      const now = new Date().toISOString();

      // Create company
      const companyResult = db.prepare(`
        INSERT INTO companies (name, email, currency_code, created_at, updated_at)
        VALUES (?, ?, 'INR', ?, ?)
      `).run(company_name.trim(), normalizedEmail, now, now);

      const companyId = companyResult.lastInsertRowid;

      // Hash password
      const rounds        = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const password_hash = bcrypt.hashSync(password, rounds);

      // Generate email verification token
      const verifyToken   = uuidv4();
      const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create user
      const userResult = db.prepare(`
        INSERT INTO users (
          company_id, role_id, name, email, password_hash,
          phone, email_verify_token, email_verify_expires,
          is_email_verified, is_active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)
      `).run(
        companyId, ownerRole.id, name.trim(), normalizedEmail, password_hash,
        phone || null, verifyToken, verifyExpires.toISOString(), now, now
      );

      const userId = userResult.lastInsertRowid;

      // Create default subscription (free plan)
      db.prepare(`
        INSERT INTO subscriptions (company_id, plan, status, started_at)
        VALUES (?, 'free', 'active', ?)
      `).run(companyId, now);

      return { userId, companyId, verifyToken };
    })();

    // 5. Load the full user + company
    const user    = userRepo.getPublicProfile(result.userId);
    const company = companyRepo.findById(result.companyId);

    // 6. Generate tokens
    const userForTokens   = { ...user, company_id: result.companyId };
    const { accessToken, refreshToken } = generateTokenPair(userForTokens);
    const rtExpires       = refreshTokenExpiry();
    userRepo.updateRefreshToken(result.userId, hashToken(refreshToken), rtExpires);

    // 7. Emit event (async, fire-and-forget)
    eventBus.emit('user.registered', {
      user: sanitizeUser(user),
      company,
      verifyToken: result.verifyToken,
    });

    return {
      user:    sanitizeUser(user),
      company,
      accessToken,
      refreshToken,
    };
  }

  // ─────────────────────────────────────────────────────────────

  /**
   * Authenticate a user by email + password.
   *
   * @param {string} email
   * @param {string} password
   * @param {string} ip - Request IP address
   * @returns {{ user: object, company: object, accessToken: string, refreshToken: string }}
   */
  static login(email, password, ip = '') {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Find user (includes password_hash)
    const user = userRepo.findByEmail(normalizedEmail);
    if (!user) {
      throw new AuthError('Invalid email or password.');
    }

    // 2. Check if account is active
    if (!user.is_active) {
      throw new AuthError('Account is deactivated. Please contact support.');
    }

    // 3. Check account lock
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remaining = Math.ceil(
        (new Date(user.locked_until) - new Date()) / 60000
      );
      throw new AuthError(
        `Account is temporarily locked due to too many failed attempts. ` +
        `Try again in ${remaining} minute(s).`
      );
    }

    // 4. Verify password
    if (!user.password_hash) {
      throw new AuthError(
        'This account uses social login. Please sign in with your OAuth provider.'
      );
    }

    const passwordMatch = bcrypt.compareSync(password, user.password_hash);

    if (!passwordMatch) {
      // Increment failed attempts
      const updated = userRepo.incrementFailedAttempts(user.id);
      const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;

      if (updated.failed_login_attempts >= maxAttempts) {
        const lockoutMinutes = parseInt(process.env.LOCKOUT_DURATION) || 15;
        const lockUntil      = new Date(Date.now() + lockoutMinutes * 60 * 1000);
        userRepo.lockAccount(user.id, lockUntil);

        throw new AuthError(
          `Too many failed attempts. Account locked for ${lockoutMinutes} minutes.`
        );
      }

      const remaining = maxAttempts - updated.failed_login_attempts;
      throw new AuthError(
        `Invalid email or password. ${remaining} attempt(s) remaining.`
      );
    }

    return completeLogin(user, ip);
  }

  /**
   * Log in (or link) a user via Google Sign-In. Only works for an email
   * that already has an account — SSO here is an alternate login method for
   * existing users, not a way to auto-provision a brand-new company, since
   * that requires the same deliberate setup (currency, GST details, etc.)
   * as normal registration.
   */
  static async loginWithGoogle(idToken, ip = '') {
    const config = require('../config/env');
    if (!config.oauth.google.clientId) {
      throw new ValidationError('Google Sign-In is not configured for this workspace.');
    }

    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(config.oauth.google.clientId);

    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: config.oauth.google.clientId });
      payload = ticket.getPayload();
    } catch (err) {
      throw new AuthError('Google sign-in verification failed. Please try again.');
    }

    const normalizedEmail = payload.email.toLowerCase().trim();
    const user = userRepo.findByEmail(normalizedEmail);

    if (!user) {
      throw new NotFoundError(
        'No account found for this Google email. Please register a workspace first, then Google Sign-In will work for future logins.'
      );
    }
    if (!user.is_active) {
      throw new AuthError('Account is deactivated. Please contact support.');
    }

    // Link the Google identity on first SSO login so future logins are faster
    if (!user.oauth_provider) {
      db.prepare(`UPDATE users SET oauth_provider = 'google', oauth_id = ? WHERE id = ?`).run(payload.sub, user.id);
    }

    return completeLogin(user, ip);
  }

  // ─────────────────────────────────────────────────────────────

  /**
   * Rotate tokens using a valid refresh token.
   *
   * @param {string} token - Current refresh token
   * @returns {{ accessToken: string, refreshToken: string }}
   */
  static refreshToken(token) {
    // Verify signature
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AuthError('Refresh token has expired. Please log in again.');
      }
      throw new AuthError('Invalid refresh token.');
    }

    // Load user and check stored token matches
    const user = db.prepare(`
      SELECT * FROM users WHERE id = ? AND is_deleted = 0
    `).get(payload.userId);

    const hashed = hashToken(token);
    if (!user || user.refresh_token !== hashed) {
      throw new AuthError('Refresh token is invalid or has been revoked.');
    }

    if (user.refresh_token_expires && new Date(user.refresh_token_expires) < new Date()) {
      throw new AuthError('Refresh token has expired. Please log in again.');
    }

    if (!user.is_active) {
      throw new AuthError('Account is deactivated.');
    }

    // Rotate: issue new token pair
    const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(user);
    const rtExpires = refreshTokenExpiry();
    userRepo.updateRefreshToken(user.id, hashToken(newRefreshToken), rtExpires);

    return { accessToken, refreshToken: newRefreshToken };
  }

  // ─────────────────────────────────────────────────────────────

  /**
   * Invalidate the user's refresh token (logout).
   *
   * @param {number} userId
   */
  static logout(userId) {
    userRepo.clearRefreshToken(userId);
  }

  // ─────────────────────────────────────────────────────────────

  /**
   * Initiate a password reset flow.
   * Always returns a generic message (security: don't reveal if email exists).
   *
   * @param {string} email
   * @returns {{ message: string }}
   */
  static forgotPassword(email) {
    const normalizedEmail = email.toLowerCase().trim();
    const user            = userRepo.findByEmail(normalizedEmail);

    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'If that email exists, a password reset link has been sent.' };
    }

    const rawToken  = uuidv4();
    const tokenHash = hashToken(rawToken);
    const expires   = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    userRepo.setPasswordResetToken(user.id, tokenHash, expires);

    // Emit event — email handler sends the actual email
    eventBus.emit('user.passwordResetRequested', {
      user: sanitizeUser(user),
      token:  rawToken, // raw token goes in email link
    });

    return { message: 'If that email exists, a password reset link has been sent.' };
  }

  // ─────────────────────────────────────────────────────────────

  /**
   * Complete the password reset using the token from email.
   *
   * @param {string} token - Raw token from the reset link
   * @param {string} newPassword - New plain-text password
   */
  static resetPassword(token, newPassword) {
    const tokenHash = hashToken(token);
    const user      = userRepo.findByResetToken(tokenHash);

    if (!user) {
      throw new AuthError('Password reset link is invalid or has expired.');
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hash   = bcrypt.hashSync(newPassword, rounds);

    userRepo.updatePassword(user.id, hash);

    eventBus.emit('user.passwordReset', {
      user: sanitizeUser(user),
    });
  }

  // ─────────────────────────────────────────────────────────────

  /**
   * Change password for an authenticated user.
   *
   * @param {number} userId
   * @param {string} currentPassword
   * @param {string} newPassword
   */
  static changePassword(userId, currentPassword, newPassword) {
    // Load with password_hash
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_deleted = 0').get(userId);

    if (!user) {
      throw new NotFoundError('User not found.');
    }

    if (!user.password_hash) {
      throw new ValidationError(
        'Cannot change password for OAuth accounts. Use your identity provider.'
      );
    }

    const match = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!match) {
      throw new AuthError('Current password is incorrect.');
    }

    if (currentPassword === newPassword) {
      throw new ValidationError('New password must be different from the current password.');
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hash   = bcrypt.hashSync(newPassword, rounds);

    // Update password AND clear all refresh tokens (force re-login everywhere)
    userRepo.updatePassword(userId, hash);
    userRepo.clearRefreshToken(userId);
  }

  // ─────────────────────────────────────────────────────────────

  /**
   * Verify a user's email using the token sent to their address.
   *
   * @param {string} token - Raw verification token
   */
  static verifyEmail(token) {
    const user = userRepo.findByEmailVerifyToken(token);

    if (!user) {
      throw new AuthError('Email verification link is invalid or has expired.');
    }

    if (user.email_verify_expires && new Date(user.email_verify_expires) < new Date()) {
      throw new AuthError('Email verification link has expired. Please request a new one.');
    }

    userRepo.verifyEmail(user.id);
  }

  // ─────────────────────────────────────────────────────────────

  /**
   * Log in via GitHub OAuth (authorization code exchange).
   * GitHub flow: client gets `code` from GitHub redirect → passes it here.
   *
   * @param {string} code  - GitHub auth code from the redirect
   * @param {string} ip
   */
  static async loginWithGitHub(code, ip = '') {
    const config = require('../config/env');
    if (!config.oauth.github.clientId || !config.oauth.github.clientSecret) {
      throw new ValidationError('GitHub Sign-In is not configured for this workspace.');
    }

    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     config.oauth.github.clientId,
        client_secret: config.oauth.github.clientSecret,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new AuthError('GitHub sign-in failed: could not exchange code for token.');
    }

    // Fetch GitHub user profile
    const profileRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'BillingPro' },
    });
    const profile = await profileRes.json();

    // GitHub may not expose primary email — fetch it explicitly
    let email = profile.email;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'BillingPro' },
      });
      const emails = await emailsRes.json();
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary ? primary.email : null;
    }

    if (!email) {
      throw new AuthError('Your GitHub account does not have a verified email address. Please add one.');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = userRepo.findByEmail(normalizedEmail);

    if (!user) {
      throw new NotFoundError(
        'No account found for this GitHub email. Please register a workspace first.'
      );
    }
    if (!user.is_active) {
      throw new AuthError('Account is deactivated. Please contact support.');
    }

    // Link GitHub identity on first SSO login
    if (!user.oauth_provider) {
      db.prepare(`UPDATE users SET oauth_provider = 'github', oauth_id = ? WHERE id = ?`)
        .run(String(profile.id), user.id);
    }

    return completeLogin(user, ip);
  }

  // ─────────────────────────────────────────────────────────────

  /**
   * Log in via Microsoft (Azure AD) using an ID token obtained client-side
   * via MSAL.js (same pattern as Google — client verifies, sends id_token).
   *
   * @param {string} idToken  - Microsoft ID token from MSAL
   * @param {string} ip
   */
  static async loginWithMicrosoft(idToken, ip = '') {
    const msClientId = process.env.MICROSOFT_CLIENT_ID;
    if (!msClientId) {
      throw new ValidationError('Microsoft Sign-In is not configured for this workspace.');
    }

    // ── Verify the Microsoft ID token properly against the JWKS endpoint ──
    // Microsoft ID tokens are RS256-signed. We fetch the public keys from the
    // well-known JWKS URI and use jsonwebtoken to fully verify the signature,
    // audience, and issuer — unlike jwt.decode() which provides zero security.
    let payload;
    try {
      // Step 1: Get the key ID and tenant ID from the unverified header/body.
      // We only use these to (a) look up the right JWKS key and (b) build the
      // correct per-tenant issuer URL — NOT to trust any claims yet.
      const parts = idToken.split('.');
      if (parts.length !== 3) throw new Error('Malformed JWT');

      const header      = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      const unverBody   = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      const kid         = header.kid;
      const tid         = unverBody.tid; // tenant ID — used to build issuer URL only

      // Step 2: Fetch Microsoft's public JWKS (module-scoped cache, 1-hour TTL)
      if (!loginWithMicrosoft._jwksCache || Date.now() > loginWithMicrosoft._jwksCacheExpiry) {
        const jwksRes = await fetch('https://login.microsoftonline.com/common/discovery/v2.0/keys');
        if (!jwksRes.ok) throw new Error('Failed to fetch Microsoft JWKS');
        loginWithMicrosoft._jwksCache       = await jwksRes.json();
        loginWithMicrosoft._jwksCacheExpiry = Date.now() + 60 * 60 * 1000; // 1 hour
      }
      const jwks = loginWithMicrosoft._jwksCache;

      // Step 3: Find the matching public key
      const jwk = jwks.keys?.find(k => k.kid === kid);
      if (!jwk) throw new Error(`No matching JWKS key for kid: ${kid}`);

      // Step 4: Convert JWK → PEM
      const publicKey = require('crypto').createPublicKey({ key: jwk, format: 'jwk' });
      const pemKey    = publicKey.export({ type: 'spki', format: 'pem' });

      // Step 5: Full verification — signature, audience, issuer.
      // tid is now known (decoded above), so the issuer URLs are correct.
      const expectedIssuers = tid
        ? [
            `https://login.microsoftonline.com/${tid}/v2.0`,
            `https://sts.windows.net/${tid}/`,
          ]
        : undefined; // omit for personal accounts — fallback path handles them

      payload = jwt.verify(idToken, pemKey, {
        algorithms:       ['RS256'],
        audience:         msClientId,
        ...(expectedIssuers ? { issuer: expectedIssuers } : {}),
        ignoreExpiration: false,
      });
    } catch (verifyErr) {
      // Fallback: personal/consumer Microsoft accounts use a different issuer
      // format. Retry without strict issuer enforcement, but still verify the
      // signature and audience so the token cannot be forged.
      try {
        const parts  = idToken.split('.');
        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
        const jwk    = loginWithMicrosoft._jwksCache?.keys?.find(k => k.kid === header.kid);
        if (jwk) {
          const publicKey = require('crypto').createPublicKey({ key: jwk, format: 'jwk' });
          const pemKey    = publicKey.export({ type: 'spki', format: 'pem' });
          payload = jwt.verify(idToken, pemKey, { algorithms: ['RS256'], audience: msClientId });
        }
      } catch (_) { /* fall through */ }

      if (!payload) {
        throw new AuthError('Microsoft sign-in verification failed. Please try again.');
      }
    }

    if (!payload?.email && !payload?.preferred_username) {
      throw new AuthError('Microsoft sign-in failed: email claim missing from token.');
    }

    const normalizedEmail = (payload.email || payload.preferred_username).toLowerCase().trim();
    const user = userRepo.findByEmail(normalizedEmail);

    if (!user) {
      throw new NotFoundError(
        'No account found for this Microsoft email. Please register a workspace first.'
      );
    }
    if (!user.is_active) {
      throw new AuthError('Account is deactivated. Please contact support.');
    }

    // Link Microsoft identity on first SSO login
    if (!user.oauth_provider) {
      db.prepare(`UPDATE users SET oauth_provider = 'microsoft', oauth_id = ? WHERE id = ?`)
        .run(payload.oid || payload.sub, user.id);
    }

    return completeLogin(user, ip);
  }


  // ─────────────────────────────────────────────────────────────
  // TOTP Two-Factor Authentication
  // ─────────────────────────────────────────────────────────────

  /**
   * Generate a TOTP secret and return the otpauth:// URL for QR code display.
   * Does NOT enable 2FA until the user verifies with enrollTotpVerify().
   *
   * @param {number} userId
   * @returns {{ otpauthUrl: string, secret: string }}
   */
  static enrollTotp(userId) {
    let speakeasy;
    try { speakeasy = require('speakeasy'); }
    catch { throw new ValidationError('2FA module not installed. Run: npm install speakeasy'); }

    const user = db.prepare('SELECT id, email FROM users WHERE id = ? AND is_deleted = 0').get(userId);
    if (!user) throw new NotFoundError('User not found.');

    const config = require('../config/env');
    const secret = speakeasy.generateSecret({
      name: `${config.app.name} (${user.email})`,
      length: 20,
    });

    // Store pending secret (not yet enabled)
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?')
      .run(secret.base32, userId);

    return { otpauthUrl: secret.otpauth_url, secret: secret.base32 };
  }

  /**
   * Verify the TOTP code entered by the user during enrollment.
   * On success, marks 2FA as enabled.
   *
   * @param {number} userId
   * @param {string} code  - 6-digit TOTP code
   */
  static enrollTotpVerify(userId, code) {
    let speakeasy;
    try { speakeasy = require('speakeasy'); }
    catch { throw new ValidationError('2FA module not installed. Run: npm install speakeasy'); }

    const user = db.prepare('SELECT id, totp_secret FROM users WHERE id = ? AND is_deleted = 0').get(userId);
    if (!user || !user.totp_secret) {
      throw new ValidationError('2FA enrollment not started. Call /auth/2fa/enroll first.');
    }

    const valid = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: code,
      window: 1, // allow ±30s drift
    });

    if (!valid) throw new AuthError('Invalid authenticator code. Please try again.');

    db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(userId);
    userRepo.clearRefreshToken(userId);
    return { message: '2FA enabled successfully.' };
  }

  /**
   * Verify a TOTP code during login (second factor).
   *
   * @param {string} tempToken
   * @param {string} code
   * @returns {{ valid: boolean }}
   */
  static verifyTotp(tempToken, code, ip = '') {
    let speakeasy;
    try { speakeasy = require('speakeasy'); }
    catch { throw new ValidationError('2FA module not installed.'); }

    let challenge;
    try {
      challenge = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (_) {
      throw new AuthError('Two-factor login challenge is invalid or has expired.');
    }
    if (challenge.purpose !== 'two_factor_login' || !challenge.userId) {
      throw new AuthError('Two-factor login challenge is invalid.');
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_deleted = 0').get(challenge.userId);

    if (!user) throw new NotFoundError('User not found.');
    if (!user.totp_enabled || !user.totp_secret) {
      throw new ValidationError('2FA is not enabled for this account.');
    }

    const valid = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!valid) throw new AuthError('Invalid or expired authenticator code.');
    return completeLogin(user, ip, true);
  }

  /**
   * Disable 2FA for the user (requires current password confirmation).
   *
   * @param {number} userId
   * @param {string} password
   */
  static disableTotp(userId, password) {
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_deleted = 0').get(userId);
    if (!user) throw new NotFoundError('User not found.');

    if (!user.password_hash) {
      throw new ValidationError('Cannot verify identity for OAuth-only accounts.');
    }

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) throw new AuthError('Incorrect password.');

    db.prepare('UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?').run(userId);
    return { message: '2FA disabled successfully.' };
  }
}

module.exports = AuthService;
