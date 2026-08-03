'use strict';

const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/errorHandler');

const validateSupplier = [
  body('name')
    .trim()
    .notEmpty().withMessage('Supplier name is required.')
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters.'),

  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isEmail().withMessage('Please provide a valid email address.'),

  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  body('gstin')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  handleValidationErrors,
];

module.exports = { validateSupplier };
