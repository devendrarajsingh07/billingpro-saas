'use strict';

const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/errorHandler');

const validateStockAdjustment = [
  body('product_id')
    .notEmpty().withMessage('Product is required.')
    .isInt().withMessage('Product ID must be an integer.'),

  body('type')
    .notEmpty().withMessage('Adjustment type is required.')
    .isIn(['in', 'out', 'adjustment']).withMessage("Type must be one of 'in', 'out', or 'adjustment'."),

  body('quantity')
    .notEmpty().withMessage('Quantity is required.')
    .isNumeric().withMessage('Quantity must be a number.')
    .custom((val, { req }) => {
      // 'in' / 'out' represent a positive movement magnitude; 'adjustment' is a
      // signed delta and may legitimately be negative (a downward correction).
      if (req.body.type !== 'adjustment' && Number(val) <= 0) {
        throw new Error("Quantity must be greater than zero for 'in' and 'out' adjustments.");
      }
      if (req.body.type === 'adjustment' && Number(val) === 0) {
        throw new Error('Adjustment quantity cannot be zero.');
      }
      return true;
    }),

  body('reference')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  body('notes')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  handleValidationErrors,
];

module.exports = { validateStockAdjustment };
