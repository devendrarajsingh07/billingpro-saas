'use strict';

const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/errorHandler');

const validatePayment = [
  body('invoice_id')
    .notEmpty().withMessage('Invoice is required.')
    .isInt().withMessage('Invoice ID must be an integer.'),

  body('amount')
    .notEmpty().withMessage('Payment amount is required.')
    .isNumeric().withMessage('Payment amount must be a number.')
    .custom((val) => val > 0).withMessage('Payment amount must be greater than zero.'),

  body('method')
    .optional()
    .isIn(['cash', 'bank', 'upi', 'stripe', 'razorpay', 'paypal', 'cheque', 'other'])
    .withMessage('Invalid payment method.'),

  // Client sends the payment date as `date`; the payments table column is
  // `paid_at`. Accept either name here — PaymentService maps it before persisting.
  body('date')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('Payment date must be a valid date.'),

  body('paid_at')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('Payment date must be a valid date.'),

  handleValidationErrors,
];

module.exports = { validatePayment };
