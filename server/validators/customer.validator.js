'use strict';

const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/errorHandler');

const validateCustomer = [
  body('name')
    .trim()
    .notEmpty().withMessage('Customer name is required.')
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters.'),

  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isEmail().withMessage('Please provide a valid email address.'),

  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  body('credit_limit')
    .optional()
    .isNumeric().withMessage('Credit limit must be a number.'),

  body('payment_terms')
    .optional()
    .isIn(['net30', 'net60', 'net90', 'immediate'])
    .withMessage('Invalid payment terms.'),

  handleValidationErrors,
];

module.exports = { validateCustomer };
