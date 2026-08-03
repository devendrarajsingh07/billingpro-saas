'use strict';

const BaseRepository = require('./BaseRepository');

/**
 * UserRepository — data access for the `users` table.
 * Extends BaseRepository with user-specific operations.
 */
class UserRepository extends BaseRepository {
  constructor(db) {
    super(db, 'users');
  }

  // ──────────────────────────────────────────────
  // AUTH-SPECIFIC FINDERS
  // ──────────────────────────────────────────────

  /**
   * Find a user by email, including the password_hash.
   * Used during login.
   *
   * @param {string} email
   * @returns {object|undefined}
   */
  findByEmail(email) {
    return this.db.prepare(`
      SELECT
        u.*,
        r.slug AS role_slug,
        r.name AS role_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.email = ? AND u.is_deleted = 0
      LIMIT 1
    `).get(email.toLowerCase().trim());
  }

  /**
   * Find a user by OAuth provider + provider user ID.
   *
   * @param {string} provider - e.g. 'google', 'github'
   * @param {string} oauthId - Provider's user ID
   * @returns {object|undefined}
   */
  findByOAuth(provider, oauthId) {
    return this.db.prepare(`
      SELECT u.*, r.slug AS role_slug
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.oauth_provider = ? AND u.oauth_id = ? AND u.is_deleted = 0
      LIMIT 1
    `).get(provider, oauthId);
  }

  /**
   * Find a user by their email verification token.
   *
   * @param {string} token
   * @returns {object|undefined}
   */
  findByEmailVerifyToken(token) {
    return this.db.prepare(`
      SELECT * FROM users
      WHERE email_verify_token = ? AND is_deleted = 0
      LIMIT 1
    `).get(token);
  }

  /**
   * Find a user by their password reset token hash.
   *
   * @param {string} tokenHash - SHA-256 hash of the raw token
   * @returns {object|undefined}
   */
  findByResetToken(tokenHash) {
    return this.db.prepare(`
      SELECT * FROM users
      WHERE password_reset_token = ?
        AND password_reset_expires > ?
        AND is_deleted = 0
      LIMIT 1
    `).get(tokenHash, new Date().toISOString());
  }

  // ──────────────────────────────────────────────
  // TOKEN MANAGEMENT
  // ──────────────────────────────────────────────

  /**
   * Persist a refresh token for a user (token rotation).
   *
   * @param {number} userId
   * @param {string} token - The raw refresh JWT
   * @param {Date} expires - Expiry date
   */
  updateRefreshToken(userId, token, expires) {
    this.db.prepare(`
      UPDATE users
      SET refresh_token = ?, refresh_token_expires = ?, updated_at = ?
      WHERE id = ?
    `).run(token, expires.toISOString(), new Date().toISOString(), userId);
  }

  /**
   * Clear the stored refresh token (logout).
   *
   * @param {number} userId
   */
  clearRefreshToken(userId) {
    this.db.prepare(`
      UPDATE users
      SET refresh_token = NULL, refresh_token_expires = NULL, updated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), userId);
  }

  // ──────────────────────────────────────────────
  // PASSWORD MANAGEMENT
  // ──────────────────────────────────────────────

  /**
   * Update a user's password hash. Clears reset token fields.
   *
   * @param {number} userId
   * @param {string} hash - bcrypt hash
   */
  updatePassword(userId, hash) {
    this.db.prepare(`
      UPDATE users
      SET password_hash = ?,
          password_reset_token = NULL,
          password_reset_expires = NULL,
          refresh_token = NULL,
          refresh_token_expires = NULL,
          updated_at = ?
      WHERE id = ?
    `).run(hash, new Date().toISOString(), userId);
  }

  /**
   * Set the password reset token and expiry.
   *
   * @param {number} userId
   * @param {string} tokenHash - SHA-256 hash of the raw token
   * @param {Date} expires
   */
  setPasswordResetToken(userId, tokenHash, expires) {
    this.db.prepare(`
      UPDATE users
      SET password_reset_token = ?, password_reset_expires = ?, updated_at = ?
      WHERE id = ?
    `).run(tokenHash, expires.toISOString(), new Date().toISOString(), userId);
  }

  // ──────────────────────────────────────────────
  // ACCOUNT LOCK / LOGIN ATTEMPTS
  // ──────────────────────────────────────────────

  /**
   * Increment the failed_login_attempts counter.
   *
   * @param {number} userId
   * @returns {object} Updated user row
   */
  incrementFailedAttempts(userId) {
    this.db.prepare(`
      UPDATE users
      SET failed_login_attempts = failed_login_attempts + 1, updated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), userId);

    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  }

  /**
   * Reset the failed_login_attempts counter and clear any lock.
   *
   * @param {number} userId
   */
  resetFailedAttempts(userId) {
    this.db.prepare(`
      UPDATE users
      SET failed_login_attempts = 0, locked_until = NULL, updated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), userId);
  }

  /**
   * Lock a user account until a given datetime.
   *
   * @param {number} userId
   * @param {Date} until - When the lock expires
   */
  lockAccount(userId, until) {
    this.db.prepare(`
      UPDATE users
      SET locked_until = ?, updated_at = ?
      WHERE id = ?
    `).run(until.toISOString(), new Date().toISOString(), userId);
  }

  // ──────────────────────────────────────────────
  // LOGIN TRACKING
  // ──────────────────────────────────────────────

  /**
   * Record last login time and IP address.
   *
   * @param {number} userId
   * @param {string} ip
   */
  updateLastLogin(userId, ip) {
    this.db.prepare(`
      UPDATE users
      SET last_login_at = ?, last_login_ip = ?, updated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), ip, new Date().toISOString(), userId);
  }

  // ──────────────────────────────────────────────
  // EMAIL VERIFICATION
  // ──────────────────────────────────────────────

  /**
   * Set an email verification token and expiry.
   *
   * @param {number} userId
   * @param {string} token
   * @param {Date} expires
   */
  setEmailVerifyToken(userId, token, expires) {
    this.db.prepare(`
      UPDATE users
      SET email_verify_token = ?, email_verify_expires = ?, updated_at = ?
      WHERE id = ?
    `).run(token, expires.toISOString(), new Date().toISOString(), userId);
  }

  /**
   * Mark a user's email as verified.
   *
   * @param {number} userId
   */
  verifyEmail(userId) {
    this.db.prepare(`
      UPDATE users
      SET is_email_verified = 1,
          email_verify_token = NULL,
          email_verify_expires = NULL,
          updated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), userId);
  }

  // ──────────────────────────────────────────────
  // PROFILE
  // ──────────────────────────────────────────────

  /**
   * Update a user's public profile fields.
   *
   * @param {number} userId
   * @param {object} data - { name, phone, avatar }
   * @returns {object} Updated user row (no password_hash)
   */
  updateProfile(userId, data) {
    const allowed  = ['name', 'phone', 'avatar'];
    const updates  = {};
    for (const key of allowed) {
      if (data[key] !== undefined) updates[key] = data[key];
    }
    updates.updated_at = new Date().toISOString();

    const cols   = Object.keys(updates).map((c) => `${c} = ?`).join(', ');
    const params = [...Object.values(updates), userId];

    this.db.prepare(`UPDATE users SET ${cols} WHERE id = ?`).run(...params);

    return this.db.prepare(`
      SELECT id, company_id, role_id, name, email, avatar, phone,
             is_email_verified, is_active, created_at, updated_at
      FROM users WHERE id = ?
    `).get(userId);
  }

  /**
   * Get a user's public profile (no sensitive fields).
   *
   * @param {number} userId
   * @returns {object|undefined}
   */
  getPublicProfile(userId) {
    return this.db.prepare(`
      SELECT
        u.id, u.company_id, u.role_id, u.name, u.email,
        u.avatar, u.phone, u.is_email_verified, u.is_active,
        u.last_login_at, u.created_at, u.updated_at,
        r.slug AS role_slug, r.name AS role_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = ? AND u.is_deleted = 0
    `).get(userId);
  }
}

module.exports = UserRepository;
