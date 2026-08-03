'use strict';

const cron = require('node-cron');
const { logger } = require('../utils/logger');
const RecurringInvoiceService = require('../services/RecurringInvoiceService');
const db = require('../config/database');

/**
 * Registers all scheduled background jobs. Call once at server startup.
 */
function registerCronJobs() {
  // ── Job 1: Recurring invoice generation ──────────────────────
  // Runs daily at 01:00 server time.
  cron.schedule('0 1 * * *', () => {
    logger.info('[Cron] Running recurring invoice generation...');
    try {
      const result = RecurringInvoiceService.generateDueRecurringInvoices();
      logger.info(`[Cron] Recurring invoices — generated: ${result.generated}, failed: ${result.skipped}`);
    } catch (err) {
      logger.error(`[Cron] Recurring invoice generation crashed: ${err.message}`);
    }
  });

  // ── Job 2: Overdue invoice reminder emails ────────────────────
  // Runs daily at 08:00 server time.
  // Sends a payment reminder for invoices that passed their due_date and
  // are still unpaid (status: sent / partial / viewed / pending).
  cron.schedule('0 8 * * *', async () => {
    logger.info('[Cron] Running overdue invoice reminder emails...');
    try {
      const today = new Date().toISOString().split('T')[0];

      // Find overdue invoices that have a customer email and haven't been reminded today
      const overdueInvoices = db.prepare(`
        SELECT
          i.id, i.invoice_no, i.grand_total, i.amount_due, i.due_date,
          c.name  AS customer_name,
          c.email AS customer_email,
          comp.name AS company_name
        FROM invoices i
        JOIN customers c   ON c.id = i.customer_id
        JOIN companies comp ON comp.id = i.company_id
        WHERE i.is_deleted = 0
          AND i.status IN ('sent', 'partial', 'viewed', 'pending')
          AND i.due_date < ?
          AND c.email IS NOT NULL
          AND c.email != ''
          AND (i.last_reminder_sent IS NULL OR i.last_reminder_sent < ?)
      `).all(today, today);

      if (overdueInvoices.length === 0) {
        logger.info('[Cron] No overdue invoices to remind.');
        return;
      }

      let sent = 0, failed = 0;
      const MailerService = require('../services/MailerService');
      const updateStmt = db.prepare(
        `UPDATE invoices SET last_reminder_sent = datetime('now') WHERE id = ?`
      );

      for (const invoice of overdueInvoices) {
        try {
          const result = await MailerService.sendOverdueReminder(invoice);
          if (!result?.skipped) {
            updateStmt.run(invoice.id);
            sent++;
          }
        } catch (err) {
          logger.warn(`[Cron] Failed to send reminder for invoice ${invoice.invoice_no}: ${err.message}`);
          failed++;
        }
      }

      logger.info(`[Cron] Overdue reminders — sent: ${sent}, failed: ${failed}`);
    } catch (err) {
      logger.error(`[Cron] Overdue reminder job crashed: ${err.message}`);
    }
  });

  logger.info('[Cron] Scheduled jobs registered:');
  logger.info('[Cron]   - Recurring invoices: daily @ 01:00');
  logger.info('[Cron]   - Overdue reminders:  daily @ 08:00');
}

module.exports = { registerCronJobs };
