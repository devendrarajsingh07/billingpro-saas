'use strict';

const AuthService    = require('../services/AuthService');
const ApiResponse    = require('../utils/ApiResponse');
const UserRepository = require('../repositories/UserRepository');
const db             = require('../config/database');

const userRepo = new UserRepository(db);

/**
 * AuthController — thin HTTP layer.
 * Each method delegates to AuthService and wraps the result in ApiResponse.
 */
class AuthController {
  // ── Standard Auth ─────────────────────────────────────────────

  /** POST /api/v1/auth/register */
  static async register(req, res, next) {
    try {
      const result = AuthService.register(req.body);
      res.status(201).json(
        ApiResponse.created(result, 'Account created successfully. Please verify your email.')
      );
    } catch (err) { next(err); }
  }

  /** POST /api/v1/auth/login */
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const ip     = req.ip || req.connection.remoteAddress;
      const result = AuthService.login(email, password, ip);
      res.json(ApiResponse.success(result, 'Login successful.'));
    } catch (err) { next(err); }
  }

  /** POST /api/v1/auth/logout */
  static async logout(req, res, next) {
    try {
      AuthService.logout(req.userId);
      res.json(ApiResponse.noContent('Logged out successfully.'));
    } catch (err) { next(err); }
  }

  /** POST /api/v1/auth/refresh-token */
  static async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const tokens = AuthService.refreshToken(refreshToken);
      res.json(ApiResponse.success(tokens, 'Token refreshed successfully.'));
    } catch (err) { next(err); }
  }

  /** POST /api/v1/auth/forgot-password */
  static async forgotPassword(req, res, next) {
    try {
      const result = AuthService.forgotPassword(req.body.email);
      res.json(ApiResponse.success(result, result.message));
    } catch (err) { next(err); }
  }

  /** POST /api/v1/auth/reset-password */
  static async resetPassword(req, res, next) {
    try {
      const { token, password } = req.body;
      AuthService.resetPassword(token, password);
      res.json(ApiResponse.success(null, 'Password reset successfully. Please log in.'));
    } catch (err) { next(err); }
  }

  /** POST /api/v1/auth/verify-email */
  static async verifyEmail(req, res, next) {
    try {
      AuthService.verifyEmail(req.body.token);
      res.json(ApiResponse.success(null, 'Email verified successfully.'));
    } catch (err) { next(err); }
  }

  /** PUT /api/v1/auth/change-password */
  static async changePassword(req, res, next) {
    try {
      const { current_password, new_password } = req.body;
      AuthService.changePassword(req.userId, current_password, new_password);
      res.json(ApiResponse.success(null, 'Password changed. Please log in again.'));
    } catch (err) { next(err); }
  }

  /** GET /api/v1/auth/me */
  static async me(req, res, next) {
    try {
      const user = userRepo.getPublicProfile(req.userId);
      res.json(ApiResponse.success(user, 'Profile fetched successfully.'));
    } catch (err) { next(err); }
  }

  /** PUT /api/v1/auth/profile */
  static async updateProfile(req, res, next) {
    try {
      const allowed = ['name', 'phone', 'avatar'];
      const data = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) data[key] = req.body[key];
      }
      if (Object.keys(data).length > 0) {
        const setClauses = Object.keys(data).map(k => `${k} = ?`).join(', ');
        db.prepare(`UPDATE users SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`)
          .run(...Object.values(data), req.userId);
      }
      const updated = userRepo.getPublicProfile(req.userId);
      res.json(ApiResponse.success(updated, 'Profile updated successfully.'));
    } catch (err) { next(err); }
  }

  // ── Social OAuth ──────────────────────────────────────────────

  /** POST /api/v1/auth/google */
  static async googleLogin(req, res, next) {
    try {
      const { id_token } = req.body;
      const ip = req.ip || req.connection.remoteAddress;
      const result = await AuthService.loginWithGoogle(id_token, ip);
      res.json(ApiResponse.success(result, 'Google login successful.'));
    } catch (err) { next(err); }
  }

  /** POST /api/v1/auth/github */
  static async githubLogin(req, res, next) {
    try {
      const { code } = req.body;
      const ip = req.ip || req.connection.remoteAddress;
      const result = await AuthService.loginWithGitHub(code, ip);
      res.json(ApiResponse.success(result, 'GitHub login successful.'));
    } catch (err) { next(err); }
  }

  /** POST /api/v1/auth/microsoft */
  static async microsoftLogin(req, res, next) {
    try {
      const { id_token } = req.body;
      const ip = req.ip || req.connection.remoteAddress;
      const result = await AuthService.loginWithMicrosoft(id_token, ip);
      res.json(ApiResponse.success(result, 'Microsoft login successful.'));
    } catch (err) { next(err); }
  }

  // ── TOTP Two-Factor Authentication ────────────────────────────

  /** POST /api/v1/auth/2fa/enroll — generate QR secret */
  static async totpEnroll(req, res, next) {
    try {
      const result = AuthService.enrollTotp(req.userId);
      res.json(ApiResponse.success(result, 'Scan the QR code with your authenticator app, then verify.'));
    } catch (err) { next(err); }
  }

  /** POST /api/v1/auth/2fa/enroll/verify — confirm enrollment */
  static async totpEnrollVerify(req, res, next) {
    try {
      const { code } = req.body;
      const result = AuthService.enrollTotpVerify(req.userId, code);
      res.json(ApiResponse.success(result, result.message));
    } catch (err) { next(err); }
  }

  /** POST /api/v1/auth/2fa/verify — verify code at login (second factor) */
  static async totpVerify(req, res, next) {
    try {
      const { tempToken, totpToken } = req.body;
      const ip = req.ip || req.connection.remoteAddress;
      const result = AuthService.verifyTotp(tempToken, totpToken, ip);
      res.json(ApiResponse.success(result, 'Login successful.'));
    } catch (err) { next(err); }
  }

  /** DELETE /api/v1/auth/2fa — disable 2FA (requires password) */
  static async totpDisable(req, res, next) {
    try {
      const { password } = req.body;
      const result = AuthService.disableTotp(req.userId, password);
      res.json(ApiResponse.success(result, result.message));
    } catch (err) { next(err); }
  }
}

module.exports = AuthController;
