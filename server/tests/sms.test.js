'use strict';

require('./setup');

process.env.TWILIO_ACCOUNT_SID = 'ACfaketestsid1234567890';
process.env.TWILIO_AUTH_TOKEN = 'fake_test_auth_token';
process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886';
process.env.TWILIO_SMS_FROM = '+15005550006';

const mockCreate = jest.fn().mockResolvedValue({ sid: 'SMfake123', status: 'queued' });

// SmsService lazily requires('twilio') inside getClient(), and calls the
// module as a function (twilio(sid, token)) rather than `new twilio(...)`.
jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

const SmsService = require('../services/SmsService');

describe('SmsService.isEnabled', () => {
  test('reports enabled when Twilio credentials are present', () => {
    expect(SmsService.isEnabled()).toBe(true);
  });
});

describe('SmsService.sendInvoiceWhatsApp', () => {
  test('sends via WhatsApp with a normalized 10-digit Indian number defaulting to +91', async () => {
    const invoice = { invoice_no: 'INV-001', currency_code: 'INR', amount_due: 1180, due_date: '2026-08-01' };
    await SmsService.sendInvoiceWhatsApp('9876543210', invoice, 'Test Co');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'whatsapp:+14155238886',
        to: 'whatsapp:+919876543210',
        body: expect.stringContaining('INV-001'),
      })
    );
  });

  test('preserves an already-international number as-is', async () => {
    const invoice = { invoice_no: 'INV-002', amount_due: 500 };
    await SmsService.sendInvoiceWhatsApp('+447911123456', invoice, 'Test Co');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'whatsapp:+447911123456' })
    );
  });
});

describe('SmsService.sendInvoiceSms', () => {
  test('sends a plain SMS with the invoice summary', async () => {
    const invoice = { invoice_no: 'INV-003', currency_code: 'INR', amount_due: 2000, due_date: '2026-08-15' };
    await SmsService.sendInvoiceSms('9123456780', invoice, 'Test Co');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '+15005550006',
        to: '+919123456780',
        body: expect.stringContaining('2000'),
      })
    );
  });
});

describe('SmsService.sendLowStockAlertSms', () => {
  test('sends a low-stock alert with product details in the body', async () => {
    const product = { name: 'Widget', stock: 3, unit: 'pcs', low_stock_threshold: 5 };
    await SmsService.sendLowStockAlertSms('9988776655', product);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('Widget'),
      })
    );
  });
});
