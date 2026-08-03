'use strict';

const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/errorHandler');

const validateInviteUser = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters.'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('A valid email address is required.'),

  body('role_id')
    .notEmpty().withMessage('A role is required.')
    .isInt().withMessage('Role ID must be an integer.'),

  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  handleValidationErrors,
];

const validateUpdateUser = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters.'),

  body('role_id')
    .optional()
    .isInt().withMessage('Role ID must be an integer.'),

  body('is_active')
    .optional()
    .isBoolean().withMessage('is_active must be true or false.').toBoolean(),

  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  handleValidationErrors,
];

module.exports = { validateInviteUser, validateUpdateUser };
