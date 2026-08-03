'use strict';

const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/errorHandler');

const validateInvoice = [
  body('customer_id')
    .notEmpty().withMessage('Customer is required.')
    .isInt().withMessage('Customer ID must be an integer.'),

  body('date')
    .notEmpty().withMessage('Invoice date is required.')
    .isISO8601().withMessage('Invoice date must be a valid ISO8601 date string.'),

  body('due_date')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('Due date must be a valid ISO8601 date string.'),

  body('is_recurring')
    .optional()
    .isBoolean().withMessage('is_recurring must be true or false.').toBoolean(),

  body('recurring_interval')
    .custom((val, { req }) => {
      const isRecurring = req.body.is_recurring === true || req.body.is_recurring === 'true' || req.body.is_recurring === 1;
      if (isRecurring && !['weekly', 'monthly', 'quarterly', 'yearly'].includes(val)) {
        throw new Error("Recurring interval is required and must be one of 'weekly', 'monthly', 'quarterly', or 'yearly' when is_recurring is enabled.");
      }
      return true;
    }),

  body('items')
    .isArray({ min: 1 }).withMessage('Invoice must contain at least one item.'),

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

const validateInvoiceStatus = [
  body('status')
    .notEmpty().withMessage('Status is required.')
    .isIn(['draft', 'pending', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'cancelled'])
    .withMessage('Invalid invoice status.'),

  handleValidationErrors,
];

module.exports = { validateInvoice, validateInvoiceStatus };
