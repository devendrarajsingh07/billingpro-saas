'use strict';

const express = require('express');
const router = express.Router();
const AuthController = require('../../controllers/AuthController');
const { authLimiter } = require('../../middleware/rateLimiter');
const { authenticate } = require('../../middleware/authenticate');
const {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
  validateRefreshToken,
} = require('../../validators/auth.validator');

// ── Standard Auth ─────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new company and owner account
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Registration successful — access + refresh tokens returned
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       allOf:
 *                         - $ref: '#/components/schemas/AuthTokens'
 *                         - type: object
 *                           properties:
 *                             user:    { $ref: '#/components/schemas/UserProfile' }
 *                             company: { type: object }
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/register', authLimiter, validateRegister, AuthController.register);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       allOf:
 *                         - $ref: '#/components/schemas/AuthTokens'
 *                         - type: object
 *                           properties:
 *                             user:    { $ref: '#/components/schemas/UserProfile' }
 *                             company: { type: object }
 *                             requiresTwoFactor: { type: boolean }
 *       401:
 *         description: Invalid credentials or account locked
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/login', authLimiter, validateLogin, AuthController.login);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Log out and invalidate refresh token
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.post('/logout', authenticate, AuthController.logout);

/**
 * @swagger
 * /api/v1/auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate refresh token and get new access token
 *     description: |
 *       Sends the current refresh token (in the request body) and receives a new
 *       access token + refresh token pair. The old refresh token is immediately
 *       invalidated (token rotation).
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string, example: 'eyJhbGci...' }
 *     responses:
 *       200:
 *         description: New token pair issued
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AuthTokens' }
 *       401:
 *         description: Refresh token expired or invalid
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/refresh-token', validateRefreshToken, AuthController.refreshToken);

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset email
 *     description: |
 *       Sends a password reset link to the given email. Always returns 200 regardless
 *       of whether the email is registered (anti-enumeration protection).
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email, example: 'admin@company.com' }
 *     responses:
 *       200:
 *         description: Reset link sent (if email exists)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.post('/forgot-password', authLimiter, validateForgotPassword, AuthController.forgotPassword);

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using a token from email
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:    { type: string, description: 'Token from reset email link' }
 *               password: { type: string, format: password, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       400:
 *         description: Token expired or invalid
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/reset-password', validateResetPassword, AuthController.resetPassword);

/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: Verify email address using token from verification email
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string, description: 'Token from verification email link' }
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       400:
 *         description: Token expired or already used
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/verify-email', AuthController.verifyEmail);

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   put:
 *     tags: [Auth]
 *     summary: Change password (requires current password)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string, format: password }
 *               newPassword:     { type: string, format: password, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password changed. All sessions on other devices are terminated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.put('/change-password', authenticate, validateChangePassword, AuthController.changePassword);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the authenticated user's profile
 *     responses:
 *       200:
 *         description: User profile and company info
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user:    { $ref: '#/components/schemas/UserProfile' }
 *                         company: { type: object }
 */
router.get('/me', authenticate, AuthController.me);

/**
 * @swagger
 * /api/v1/auth/profile:
 *   put:
 *     tags: [Auth]
 *     summary: Update authenticated user's profile (name, phone)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:  { type: string, example: 'Jane Doe' }
 *               phone: { type: string, example: '+91 98765 43210' }
 *     responses:
 *       200:
 *         description: Profile updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.put('/profile', authenticate, AuthController.updateProfile);

// ── Social OAuth ──────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/auth/google:
 *   post:
 *     tags: [Auth]
 *     summary: Sign in with Google
 *     description: Authenticates using a Google ID token from client-side Google Sign-In.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken: { type: string, description: 'Google ID token from GAPI/GSI' }
 *     responses:
 *       200:
 *         description: Authenticated successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       404:
 *         description: No account found for this Google email — register first
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/google', authLimiter, AuthController.googleLogin);

/**
 * @swagger
 * /api/v1/auth/github:
 *   post:
 *     tags: [Auth]
 *     summary: Sign in with GitHub (OAuth code exchange)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, description: 'OAuth authorization code from GitHub callback' }
 *     responses:
 *       200:
 *         description: Authenticated successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.post('/github', authLimiter, AuthController.githubLogin);

/**
 * @swagger
 * /api/v1/auth/microsoft:
 *   post:
 *     tags: [Auth]
 *     summary: Sign in with Microsoft
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken: { type: string, description: 'Microsoft ID token from MSAL.js' }
 *     responses:
 *       200:
 *         description: Authenticated successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.post('/microsoft', authLimiter, AuthController.microsoftLogin);

// ── Two-Factor Authentication (TOTP) ──────────────────────────

/**
 * @swagger
 * /api/v1/auth/2fa/enroll:
 *   post:
 *     tags: [Auth]
 *     summary: Start TOTP 2FA enrollment (get QR code)
 *     responses:
 *       200:
 *         description: TOTP secret and QR code URL returned
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         otpauthUrl: { type: string }
 *                         qrCodeDataUrl: { type: string }
 */
router.post('/2fa/enroll', authenticate, AuthController.totpEnroll);

/**
 * @swagger
 * /api/v1/auth/2fa/enroll/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Confirm TOTP enrollment with a code from authenticator app
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string, example: '123456', description: '6-digit TOTP code' }
 *     responses:
 *       200:
 *         description: 2FA enabled successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.post('/2fa/enroll/verify', authenticate, AuthController.totpEnrollVerify);

/**
 * @swagger
 * /api/v1/auth/2fa/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Complete login with a TOTP code (second factor)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tempToken, totpToken]
 *             properties:
 *               tempToken:  { type: string, description: 'Temporary token from login response' }
 *               totpToken:  { type: string, example: '123456' }
 *     responses:
 *       200:
 *         description: 2FA verified — full access tokens returned
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.post('/2fa/verify', authLimiter, AuthController.totpVerify);

/**
 * @swagger
 * /api/v1/auth/2fa:
 *   delete:
 *     tags: [Auth]
 *     summary: Disable TOTP 2FA for the authenticated user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string, format: password, description: 'Current account password for confirmation' }
 *     responses:
 *       200:
 *         description: 2FA disabled
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.delete('/2fa', authenticate, AuthController.totpDisable);

module.exports = router;
