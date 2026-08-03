'use strict';

const db = require('../config/database');
const InvoiceService = require('./InvoiceService');
const { logger } = require('../utils/logger');

const VALID_INTERVALS = ['weekly', 'monthly', 'quarterly', 'yearly'];

/**
 * Add one recurrence interval to a YYYY-MM-DD date string.
 */
function addInterval(dateStr, interval) {
  const d = new Date(dateStr);
  switch (interval) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      d.setMonth(d.getMonth() + 1); // fall back to monthly for unknown/legacy values
  }
  return d.toISOString().split('T')[0];
}

function daysBetween(fromStr, toStr) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((new Date(toStr) - new Date(fromStr)) / MS_PER_DAY);
}

class RecurringInvoiceService {
  /**
   * Scans every company for recurring invoice templates that are due and
   * clones them into new draft invoices. Safe to call repeatedly (e.g. daily
   * via cron) — each clone becomes a non-recurring child of the template, so
   * templates are only ever the original invoice with parent_invoice_id NULL.
   *
   * @returns {{ generated: number, skipped: number, errors: Array }}
   */
  static generateDueRecurringInvoices() {
    const today = new Date().toISOString().split('T')[0];
    const templates = db.prepare(`
      SELECT * FROM invoices
      WHERE is_recurring = 1
        AND parent_invoice_id IS NULL
        AND is_deleted = 0
        AND status != 'cancelled'
        AND recurring_interval IN ('weekly', 'monthly', 'quarterly', 'yearly')
    `).all();

    let generated = 0;
    let skipped = 0;
    const errors = [];

    for (const template of templates) {
      try {
        generated += this._processTemplate(template, today);
      } catch (err) {
        skipped += 1;
        errors.push({ invoiceId: template.id, message: err.message });
        logger.error(`[Recurring Invoices] Failed processing template #${template.id}: ${err.message}`);
      }
    }

    if (generated > 0 || errors.length > 0) {
      logger.info(`[Recurring Invoices] Run complete — generated: ${generated}, failed: ${errors.length}`);
    }

    return { generated, skipped, errors };
  }

  /**
   * Processes a single recurring template, generating as many overdue clones
   * as needed to catch up to today (capped to avoid runaway loops if the
   * scheduler was down for a very long time).
   */
  static _processTemplate(template, today) {
    const MAX_CATCHUP_RUNS = 24;
    let generatedCount = 0;

    // Find the most recent invoice in this template's chain (itself or a
    // previously generated clone), to know when the next one is due.
    const latestChild = db.prepare(`
      SELECT date FROM invoices
      WHERE parent_invoice_id = ? AND is_deleted = 0
      ORDER BY date DESC
      LIMIT 1
    `).get(template.id);

    let lastDate = latestChild ? latestChild.date : template.date;
    const dueDateOffsetDays = template.due_date ? daysBetween(template.date, template.due_date) : 15;

    for (let i = 0; i < MAX_CATCHUP_RUNS; i++) {
      const nextDate = addInterval(lastDate, template.recurring_interval);
      if (nextDate > today) break;

      const items = db.prepare(`
        SELECT product_id, description, qty, unit_price, discount, tax_rate
        FROM invoice_items WHERE invoice_id = ?
        ORDER BY sort_order ASC, id ASC
      `).all(template.id);

      if (items.length === 0) {
        throw new Error('Template invoice has no line items to clone.');
      }

      const dueDate = new Date(nextDate);
      dueDate.setDate(dueDate.getDate() + dueDateOffsetDays);

      const invoiceData = {
        customer_id: template.customer_id,
        date: nextDate,
        due_date: dueDate.toISOString().split('T')[0],
        currency_code: template.currency_code,
        exchange_rate: template.exchange_rate,
        discount_type: template.discount_type,
        discount_value: template.discount_value,
        shipping_charges: template.shipping_charges,
        adjustment: template.adjustment,
        notes: template.notes,
        terms_conditions: template.terms_conditions,
        template: template.template,
        parent_invoice_id: template.id,
        is_recurring: 0,
        status: 'pending',
        items,
      };

      InvoiceService.createInvoice(template.company_id, invoiceData, template.created_by);
      generatedCount += 1;
      lastDate = nextDate;
    }

    return generatedCount;
  }
}

module.exports = RecurringInvoiceService;
module.exports.VALID_INTERVALS = VALID_INTERVALS;
