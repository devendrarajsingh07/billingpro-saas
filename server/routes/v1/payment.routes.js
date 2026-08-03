'use strict';

const express = require('express');
const router = express.Router();
const PaymentController = require('../../controllers/PaymentController');
const authenticate = require('../../middleware/authenticate').authenticate;
const authorize = require('../../middleware/authorize').authorize;
const { validatePayment } = require('../../validators/payment.validator');

router.use(authenticate);

/**
 * @swagger
 * /api/v1/payments:
 *   get:
 *     tags: [Payments]
 *     summary: List payments received against invoices
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: invoice_id
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Paginated list, content: { application/json: { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } }
 *   post:
 *     tags: [Payments]
 *     summary: Record a payment against an invoice
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [invoice_id, amount]
 *             properties:
 *               invoice_id:   { type: integer, example: 42 }
 *               amount:       { type: number, example: 5000 }
 *               method:       { type: string, example: 'bank_transfer' }
 *               payment_date: { type: string, format: date, example: '2026-07-20' }
 *               reference:    { type: string, example: 'UTR123456789' }
 *     responses:
 *       201: { description: Payment recorded — a receipt email is sent, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.get('/', authorize('payments.read'), PaymentController.getPayments);

/**
 * @swagger
 * /api/v1/payments/{id}:
 *   get:
 *     tags: [Payments]
 *     summary: Get a single payment by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Payment found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 *       404: { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/:id', authorize('payments.read'), PaymentController.getPaymentById);
router.post('/', authorize('payments.create'), validatePayment, PaymentController.createPayment);

module.exports = router;
