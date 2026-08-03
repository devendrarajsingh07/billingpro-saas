'use strict';

const crypto = require('crypto');
const config = require('../config/env');
const { logger } = require('../utils/logger');

let razorpayInstance = null;

function isConfigured() {
  return Boolean(config.razorpay.keyId && config.razorpay.keySecret);
}

function getClient() {
  if (!isConfigured()) return null;
  if (!razorpayInstance) {
    const Razorpay = require('razorpay');
    razorpayInstance = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  }
  return razorpayInstance;
}

class RazorpayService {
  static isEnabled() {
    return isConfigured();
  }

  /**
   * Creates a Razorpay order for the given amount (in the invoice's own
   * currency's smallest unit, e.g. paise for INR). Returns the order plus
   * the publishable key_id the client needs to open Razorpay Checkout.
   */
  static async createOrder({ amount, currency = 'INR', receipt, notes = {} }) {
    const client = getClient();
    if (!client) {
      throw new Error('Razorpay is not configured — add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your .env file.');
    }

    // Razorpay expects amount in the smallest currency unit (e.g. paise, cents)
    const amountInSubunits = Math.round(Number(amount) * 100);

    const order = await client.orders.create({
      amount: amountInSubunits,
      currency,
      receipt,
      notes,
    });

    return { order, keyId: config.razorpay.keyId };
  }

  /**
   * Verifies the signature Razorpay Checkout returns to the client after a
   * successful payment. This is the standard HMAC-SHA256 scheme documented
   * by Razorpay: signature = HMAC(order_id + "|" + payment_id, key_secret).
   */
  static verifyPaymentSignature({ orderId, paymentId, signature }) {
    if (!isConfigured()) return false;

    const expected = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false; // length mismatch etc. — treat as invalid rather than crashing
    }
  }

  /**
   * Fetch the authoritative Razorpay order and payment after local signature
   * verification. Client-provided IDs alone are not sufficient to determine
   * which invoice a payment belongs to.
   */
  static async getOrderAndPayment(orderId, paymentId) {
    const client = getClient();
    if (!client) {
      throw new Error('Razorpay is not configured.');
    }

    const [order, payment] = await Promise.all([
      client.orders.fetch(orderId),
      client.payments.fetch(paymentId),
    ]);
    return { order, payment };
  }

  /**
   * Verifies an incoming webhook's signature against the raw request body.
   *
   * NOTE: for byte-exact verification, this should be called with the raw
   * (un-parsed) request body string. This project applies a global JSON
   * body parser before routes, so the webhook route re-stringifies
   * req.body as a best-effort approximation — sufficient for development,
   * but for production hardening switch that route to `express.raw()` and
   * pass the untouched buffer here instead.
   */
  static verifyWebhookSignature(rawBody, signature) {
    if (!config.razorpay.webhookSecret) return false;

    const expected = crypto
      .createHmac('sha256', config.razorpay.webhookSecret)
      .update(rawBody)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ''));
    } catch {
      return false;
    }
  }
}

module.exports = RazorpayService;
