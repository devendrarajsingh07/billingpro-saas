'use strict';

const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/errorHandler');

const validateProduct = [
  body('name')
    .trim()
    .notEmpty().withMessage('Product name is required.')
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters.'),

  body('sku')
    .trim()
    .notEmpty().withMessage('SKU is required.'),

  body('selling_price')
    .notEmpty().withMessage('Selling price is required.')
    .isNumeric().withMessage('Selling price must be a number.')
    .custom((val) => val >= 0).withMessage('Selling price cannot be negative.'),

  body('purchase_price')
    .optional()
    .isNumeric().withMessage('Purchase price must be a number.')
    .custom((val) => val >= 0).withMessage('Purchase price cannot be negative.'),

  body('stock')
    .optional()
    .isInt().withMessage('Stock must be an integer.'),

  handleValidationErrors,
];

module.exports = { validateProduct };
