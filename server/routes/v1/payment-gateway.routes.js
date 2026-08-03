'use strict';

const express = require('express');
const router = express.Router();
const PaymentGatewayController = require('../../controllers/PaymentGatewayController');
const authenticate = require('../../middleware/authenticate').authenticate;
const authorize = require('../../middleware/authorize').authorize;

// Webhook is called by Razorpay's servers directly — no user session exists,
// so it's intentionally outside the `authenticate` gate below and instead
// verified via its own HMAC signature check in the controller.
/**
 * @swagger
 * /api/v1/payment-gateway/razorpay/webhook:
 *   post:
 *     tags: [Payment Gateway]
 *     summary: Razorpay webhook receiver (called by Razorpay's servers, not the client app)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200: { description: Webhook processed }
 *       400: { description: Invalid HMAC signature, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/razorpay/webhook', PaymentGatewayController.handleRazorpayWebhook);

router.use(authenticate);

/**
 * @swagger
 * /api/v1/payment-gateway/razorpay/create-order:
 *   post:
 *     tags: [Payment Gateway]
 *     summary: Create a Razorpay order for an invoice payment
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [invoice_id]
 *             properties:
 *               invoice_id: { type: integer, example: 42 }
 *     responses:
 *       200:
 *         description: Razorpay order created — pass this to the Razorpay Checkout widget
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.post('/razorpay/create-order', authorize('payments.create'), PaymentGatewayController.createRazorpayOrder);

/**
 * @swagger
 * /api/v1/payment-gateway/razorpay/verify:
 *   post:
 *     tags: [Payment Gateway]
 *     summary: Verify a completed Razorpay checkout and record the payment
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razorpay_order_id, razorpay_payment_id, razorpay_signature]
 *             properties:
 *               razorpay_order_id:   { type: string }
 *               razorpay_payment_id: { type: string }
 *               razorpay_signature:  { type: string }
 *     responses:
 *       200: { description: Payment verified and recorded, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 *       400: { description: Signature verification failed, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/razorpay/verify', authorize('payments.create'), PaymentGatewayController.verifyRazorpayPayment);

module.exports = router;
