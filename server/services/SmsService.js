'use strict';

const config = require('../config/env');
const { logger } = require('../utils/logger');

let twilioClient = null;

function isConfigured() {
  return Boolean(config.twilio.accountSid && config.twilio.authToken);
}

function getClient() {
  if (!isConfigured()) return null;
  if (!twilioClient) {
    const twilio = require('twilio');
    twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
  }
  return twilioClient;
}

/**
 * Normalizes a phone number to E.164-ish shape for Twilio. Assumes Indian
 * numbers (+91) when no country code is present, since that's this
 * project's primary market — adjust if you operate elsewhere.
 */
function normalizePhone(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

class SmsService {
  static isEnabled() {
    return isConfigured();
  }

  /**
   * Sends a plain-text WhatsApp message. Media attachments (like the invoice
   * PDF) require a publicly reachable URL for Twilio to fetch from, which
   * this project doesn't have — so the message is a text summary with the
   * key details instead of an attached PDF.
   */
  static async sendInvoiceWhatsApp(phone, invoice, companyName) {
    const client = getClient();
    if (!client) {
      logger.info('[SMS] Twilio not configured — skipping WhatsApp send (dev no-op).');
      return { skipped: true };
    }
    if (!config.twilio.whatsappFrom) {
      throw new Error('TWILIO_WHATSAPP_FROM is not set in .env.');
    }

    const to = `whatsapp:${normalizePhone(phone)}`;
    const body = SmsService._invoiceMessage(invoice, companyName);

    return client.messages.create({ from: config.twilio.whatsappFrom, to, body });
  }

  static async sendInvoiceSms(phone, invoice, companyName) {
    const client = getClient();
    if (!client) {
      logger.info('[SMS] Twilio not configured — skipping SMS send (dev no-op).');
      return { skipped: true };
    }
    if (!config.twilio.smsFrom) {
      throw new Error('TWILIO_SMS_FROM is not set in .env.');
    }

    const to = normalizePhone(phone);
    const body = SmsService._invoiceMessage(invoice, companyName);

    return client.messages.create({ from: config.twilio.smsFrom, to, body });
  }

  static async sendLowStockAlertSms(phone, product) {
    const client = getClient();
    if (!client) return { skipped: true };
    if (!config.twilio.smsFrom) throw new Error('TWILIO_SMS_FROM is not set in .env.');

    return client.messages.create({
      from: config.twilio.smsFrom,
      to: normalizePhone(phone),
      body: `Low stock alert: ${product.name} is down to ${product.stock} ${product.unit || 'units'} (threshold: ${product.low_stock_threshold}).`,
    });
  }

  static _invoiceMessage(invoice, companyName) {
    return (
      `Invoice #${invoice.invoice_no} from ${companyName || 'us'}\n` +
      `Amount Due: ${invoice.currency_code || 'INR'} ${invoice.amount_due}\n` +
      `Due Date: ${invoice.due_date || 'N/A'}\n` +
      `Thank you for your business!`
    );
  }
}

module.exports = SmsService;
