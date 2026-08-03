'use strict';

const eventBus = require('../eventBus');
const db = require('../../config/database');
const { logger } = require('../../utils/logger');
const { notifyCompanyAdmins, checkAndNotifyLowStock } = require('../../utils/notifier');
const MailerService = require('../../services/MailerService');

function registerNotificationEvents() {
  // A new invoice was created — sold line items may have pushed a product
  // below its low-stock threshold, so check each one.
  eventBus.on('invoice.created', ({ invoice }) => {
    try {
      for (const item of invoice.items || []) {
        if (item.product_id) {
          checkAndNotifyLowStock(invoice.company_id, item.product_id);
        }
      }
    } catch (err) {
      logger.error(`[Event Error] invoice.created notification check failed: ${err.message}`);
    }
  });

  // Invoice marked as paid
  eventBus.on('invoice.paid', ({ invoice }) => {
    try {
      notifyCompanyAdmins(
        invoice.company_id,
        'invoice_paid',
        `Invoice ${invoice.invoice_no} paid`,
        `${invoice.customer_name} paid ${invoice.grand_total}.`,
        { invoice_id: invoice.id }
      );
    } catch (err) {
      logger.error(`[Event Error] invoice.paid notification failed: ${err.message}`);
    }
  });

  // Payment recorded — notify admins and email the customer a receipt (best-effort)
  eventBus.on('payment.recorded', ({ payment }) => {
    try {
      const invoice = db.prepare(`
        SELECT i.*, c.name AS customer_name, c.email AS customer_email
        FROM invoices i
        JOIN customers c ON c.id = i.customer_id
        WHERE i.id = ?
      `).get(payment.invoice_id);

      if (!invoice) return;

      notifyCompanyAdmins(
        invoice.company_id,
        'payment_recorded',
        `Payment recorded on ${invoice.invoice_no}`,
        `A payment of ${payment.amount} was recorded.`,
        { invoice_id: invoice.id, payment_id: payment.id }
      );

      MailerService.sendPaymentReceiptEmail(payment, invoice).catch((err) => {
        logger.error(`[Mailer] Payment receipt email failed: ${err.message}`);
      });
    } catch (err) {
      logger.error(`[Event Error] payment.recorded notification failed: ${err.message}`);
    }
  });

  // Purchase order received — stock changed, let admins know
  eventBus.on('purchase_order.status_changed', ({ purchaseOrder }) => {
    try {
      if (purchaseOrder.status === 'received') {
        notifyCompanyAdmins(
          purchaseOrder.company_id,
          'po_received',
          `PO #${purchaseOrder.po_no} received`,
          `Stock has been updated from purchase order #${purchaseOrder.po_no}.`,
          { purchase_order_id: purchaseOrder.id }
        );
      }
    } catch (err) {
      logger.error(`[Event Error] purchase_order.status_changed notification failed: ${err.message}`);
    }
  });
}

module.exports = registerNotificationEvents;
