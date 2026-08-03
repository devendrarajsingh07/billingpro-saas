'use strict';

const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/errorHandler');

// ──────────────────────────────────────────────────────────────
// Reusable field validators
// ──────────────────────────────────────────────────────────────

const emailField = body('email')
  .trim()
  .notEmpty().withMessage('Email is required.')
  .isEmail().withMessage('Please provide a valid email address.')
  .normalizeEmail({ gmail_remove_dots: false });

const strongPassword = (fieldName = 'password') =>
  body(fieldName)
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one number.')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must contain at least one special character.');

// ──────────────────────────────────────────────────────────────
// Validation chains
// ──────────────────────────────────────────────────────────────

/**
 * Register: name, email, strong password, company_name
 */
const validateRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('Full name is required.')
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters.')
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters.'),

  emailField,

  strongPassword('password'),

  body('company_name')
    .trim()
    .notEmpty().withMessage('Company name is required.')
    .isLength({ min: 2 }).withMessage('Company name must be at least 2 characters.')
    .isLength({ max: 150 }).withMessage('Company name cannot exceed 150 characters.'),

  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Please provide a valid phone number.'),

  handleValidationErrors,
];

/**
 * Login: email, password (just non-empty)
 */
const validateLogin = [
  emailField,

  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 1 }).withMessage('Password cannot be empty.'),

  handleValidationErrors,
];

/**
 * Forgot password: email only
 */
const validateForgotPassword = [
  emailField,
  handleValidationErrors,
];

/**
 * Reset password: token (uuid), strong new password
 */
const validateResetPassword = [
  body('token')
    .trim()
    .notEmpty().withMessage('Reset token is required.')
    .isUUID().withMessage('Reset token format is invalid.'),

  strongPassword('password'),

  handleValidationErrors,
];

/**
 * Change password: current + new strong password
 */
const validateChangePassword = [
  body('current_password')
    .notEmpty().withMessage('Current password is required.'),

  strongPassword('new_password'),

  body('new_password')
    .custom((value, { req }) => {
      if (value === req.body.current_password) {
        throw new Error('New password must be different from the current password.');
      }
      return true;
    }),

  handleValidationErrors,
];

/**
 * Verify email: token (uuid)
 */
const validateVerifyEmail = [
  body('token')
    .trim()
    .notEmpty().withMessage('Verification token is required.')
    .isUUID().withMessage('Verification token format is invalid.'),

  handleValidationErrors,
];

/**
 * Update profile: name, phone (all optional)
 */
const validateUpdateProfile = [
  body('name')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters.')
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters.'),

  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Please provide a valid phone number.'),

  handleValidationErrors,
];

/**
 * Refresh token: refreshToken string
 */
const validateRefreshToken = [
  body('refreshToken')
    .trim()
    .notEmpty().withMessage('Refresh token is required.'),

  handleValidationErrors,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
  validateVerifyEmail,
  validateUpdateProfile,
  validateRefreshToken,
};
