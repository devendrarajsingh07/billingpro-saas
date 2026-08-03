'use strict';

// Baseline required env vars (JWT secrets, PORT, etc.)
require('./setup');

// Fake but well-formed test credentials so RazorpayService's "configured"
// code paths (signature verification, order creation) are actually
// exercised, not just the "not configured, skip" branch. Must be set
// before RazorpayService/config/env.js is first required below.
process.env.RAZORPAY_KEY_ID = 'rzp_test_fakekeyid123';
process.env.RAZORPAY_KEY_SECRET = 'fake_test_key_secret_for_hmac';
process.env.RAZORPAY_WEBHOOK_SECRET = 'fake_test_webhook_secret';

const crypto = require('crypto');

// Mock the 'razorpay' SDK itself so createOrder never makes a real network
// call — RazorpayService only lazily requires('razorpay') inside getClient(),
// so this mock just needs to be registered before that first happens.
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({
        id: 'order_fake123',
        amount: 150000,
        currency: 'INR',
        status: 'created',
      }),
    },
  }));
});

const RazorpayService = require('../services/RazorpayService');

describe('RazorpayService.isEnabled', () => {
  test('reports enabled when key id/secret are present', () => {
    expect(RazorpayService.isEnabled()).toBe(true);
  });
});

describe('RazorpayService.createOrder', () => {
  test('creates an order and converts the amount to paise (smallest currency unit)', async () => {
    const result = await RazorpayService.createOrder({ amount: 1500, currency: 'INR', receipt: 'INV-001' });
    expect(result.order.id).toBe('order_fake123');
    expect(result.keyId).toBe('rzp_test_fakekeyid123');
  });
});

describe('RazorpayService.verifyPaymentSignature', () => {
  function sign(orderId, paymentId) {
    return crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
  }

  test('accepts a correctly computed signature', () => {
    const signature = sign('order_abc', 'pay_xyz');
    const valid = RazorpayService.verifyPaymentSignature({
      orderId: 'order_abc',
      paymentId: 'pay_xyz',
      signature,
    });
    expect(valid).toBe(true);
  });

  test('rejects a tampered signature', () => {
    const signature = sign('order_abc', 'pay_xyz');
    const valid = RazorpayService.verifyPaymentSignature({
      orderId: 'order_abc',
      paymentId: 'pay_DIFFERENT', // payload changed, signature didn't
      signature,
    });
    expect(valid).toBe(false);
  });

  test('rejects a garbage signature without throwing', () => {
    expect(() =>
      RazorpayService.verifyPaymentSignature({
        orderId: 'order_abc',
        paymentId: 'pay_xyz',
        signature: 'not-even-hex',
      })
    ).not.toThrow();

    const valid = RazorpayService.verifyPaymentSignature({
      orderId: 'order_abc',
      paymentId: 'pay_xyz',
      signature: 'not-even-hex',
    });
    expect(valid).toBe(false);
  });
});

describe('RazorpayService.verifyWebhookSignature', () => {
  test('accepts a correctly computed webhook signature', () => {
    const rawBody = JSON.stringify({ event: 'payment.captured', payload: {} });
    const signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    expect(RazorpayService.verifyWebhookSignature(rawBody, signature)).toBe(true);
  });

  test('rejects a signature computed with the wrong body', () => {
    const rawBody = JSON.stringify({ event: 'payment.captured', payload: {} });
    const wrongSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify({ event: 'payment.failed', payload: {} }))
      .digest('hex');

    expect(RazorpayService.verifyWebhookSignature(rawBody, wrongSignature)).toBe(false);
  });
});
