'use strict';

const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/errorHandler');

const validatePurchaseOrder = [
  body('supplier_id')
    .optional({ nullable: true })
    .isInt().withMessage('Supplier ID must be an integer.'),

  body('date')
    .notEmpty().withMessage('Purchase order date is required.')
    .isISO8601().withMessage('Purchase order date must be a valid ISO8601 date string.'),

  body('expected_date')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('Expected date must be a valid ISO8601 date string.'),

  body('items')
    .isArray({ min: 1 }).withMessage('Purchase order must contain at least one item.'),

  body('items.*.description')
    .trim()
    .notEmpty().withMessage('Item description is required.'),

  body('items.*.qty')
    .notEmpty().withMessage('Item quantity is required.')
    .isNumeric().withMessage('Item quantity must be a number.')
    .custom((val) => val > 0).withMessage('Item quantity must be greater than zero.'),

  body('items.*.unit_price')
    .notEmpty().withMessage('Item unit price is required.')
    .isNumeric().withMessage('Item unit price must be a number.')
    .custom((val) => val >= 0).withMessage('Item unit price cannot be negative.'),

  handleValidationErrors,
];

const validatePOStatus = [
  body('status')
    .notEmpty().withMessage('Status is required.')
    .isIn(['draft', 'sent', 'received', 'cancelled']).withMessage('Invalid purchase order status.'),

  handleValidationErrors,
];

module.exports = { validatePurchaseOrder, validatePOStatus };
