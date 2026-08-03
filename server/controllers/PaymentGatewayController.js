'use strict';

const RazorpayService = require('../services/RazorpayService');
const PaymentService = require('../services/PaymentService');
const InvoiceService = require('../services/InvoiceService');
const ApiResponse = require('../utils/ApiResponse');
const { ValidationError } = require('../utils/ApiError');
const { logger } = require('../utils/logger');

class PaymentGatewayController {
  static async createRazorpayOrder(req, res, next) {
    try {
      if (!RazorpayService.isEnabled()) {
        throw new ValidationError('Online payments are not configured for this workspace yet. Add Razorpay credentials to enable them.');
      }

      const invoice = InvoiceService.getInvoiceById(Number(req.body.invoice_id), req.companyId);
      if (invoice.amount_due <= 0) {
        throw new ValidationError('This invoice has no outstanding balance to pay.');
      }

      const { order, keyId } = await RazorpayService.createOrder({
        amount: invoice.amount_due,
        currency: invoice.currency_code || 'INR',
        receipt: `invoice_${invoice.id}_${Date.now()}`,
        notes: { invoice_id: String(invoice.id), invoice_no: invoice.invoice_no, company_id: String(req.companyId) },
      });

      res.json(ApiResponse.success({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: keyId,
        invoice_id: invoice.id,
        invoice_no: invoice.invoice_no,
      }, 'Razorpay order created successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async verifyRazorpayPayment(req, res, next) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, invoice_id } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !invoice_id) {
        throw new ValidationError('Missing required payment verification fields.');
      }

      const isValid = RazorpayService.verifyPaymentSignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      });

      if (!isValid) {
        throw new ValidationError('Payment signature verification failed — this payment could not be confirmed as authentic.');
      }

      const invoice = InvoiceService.getInvoiceById(Number(invoice_id), req.companyId);
      const { order, payment: razorpayPayment } = await RazorpayService.getOrderAndPayment(
        razorpay_order_id,
        razorpay_payment_id
      );
      const expectedAmount = Math.round(Number(invoice.amount_due) * 100);
      if (order.id !== razorpay_order_id || razorpayPayment.order_id !== razorpay_order_id ||
          razorpayPayment.id !== razorpay_payment_id || razorpayPayment.status !== 'captured' ||
          Number(order.amount) !== expectedAmount || Number(razorpayPayment.amount) !== expectedAmount ||
          order.currency !== (invoice.currency_code || 'INR') ||
          String(order.notes?.invoice_id) !== String(invoice.id) ||
          String(order.notes?.company_id) !== String(req.companyId)) {
        throw new ValidationError('Razorpay payment does not match this invoice.');
      }

      const payment = PaymentService.createPayment(req.companyId, {
        invoice_id: invoice.id,
        amount: razorpayPayment.amount / 100,
        method: 'razorpay',
        reference_no: razorpay_payment_id,
        notes: `Razorpay order: ${razorpay_order_id}`,
        status: 'completed',
        paid_at: new Date().toISOString(),
      }, req.userId);

      res.status(201).json(ApiResponse.success(payment, 'Payment verified and recorded successfully.'));
    } catch (err) {
      next(err);
    }
  }

  /**
   * Server-to-server webhook — lets Razorpay notify us of payment events
   * even if the customer closes the browser before the client-side verify
   * call completes. Handles idempotency by skipping already-paid invoices.
   */
  static async handleRazorpayWebhook(req, res, next) {
    try {
      const signature = req.headers['x-razorpay-signature'];
      const rawBody = req.rawBody || JSON.stringify(req.body);

      if (!RazorpayService.verifyWebhookSignature(rawBody, signature)) {
        logger.error('[Razorpay Webhook] Signature verification failed — ignoring event.');
        return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
      }

      const event = req.body.event;
      logger.info(`[Razorpay Webhook] Received event: ${event}`);

      // ── payment.captured ──────────────────────────────────────
      // Triggered when a payment is successfully captured.
      // Use this as a fallback in case the client-side verify flow
      // was interrupted (e.g. browser closed mid-payment).
      if (event === 'payment.captured') {
        const payment = req.body.payload?.payment?.entity;
        if (payment) {
          const orderId   = payment.order_id;
          const paymentId = payment.id;
          // notes.invoice_id is set in createRazorpayOrder
          const invoiceId = payment.notes?.invoice_id
            ? Number(payment.notes.invoice_id)
            : null;
          const companyId = payment.notes?.company_id
            ? Number(payment.notes.company_id)
            : null;

          if (invoiceId && companyId) {
            try {
              const invoice = InvoiceService.getInvoiceById(invoiceId, companyId);

              // Idempotency guard — skip if already paid
              if (invoice.amount_due <= 0) {
                logger.info(`[Razorpay Webhook] Invoice #${invoiceId} already fully paid — skipping duplicate recording.`);
              } else {
                PaymentService.createPayment(companyId, {
                  invoice_id:   invoice.id,
                  amount:       payment.amount / 100, // Razorpay sends paise
                  method:       'razorpay',
                  reference_no: paymentId,
                  notes:        `Razorpay order: ${orderId} (webhook)`,
                  status:       'completed',
                  paid_at:      new Date().toISOString(),
                }, null); // no user_id — system action via webhook
                logger.info(`[Razorpay Webhook] Payment ${paymentId} recorded for invoice #${invoiceId} (₹${payment.amount / 100})`);
              }
            } catch (err) {
              // Log but don't fail the webhook — Razorpay will retry on 5xx
              logger.error(`[Razorpay Webhook] Failed to record payment for invoice #${invoiceId}: ${err.message}`);
            }
          } else {
            logger.warn(`[Razorpay Webhook] payment.captured missing invoice_id or company_id in notes — cannot auto-record.`);
          }
        }
      }

      // Always acknowledge receipt quickly so Razorpay doesn't retry
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}


module.exports = PaymentGatewayController;
