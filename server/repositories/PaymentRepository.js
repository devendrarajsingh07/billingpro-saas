'use strict';

const BaseRepository = require('./BaseRepository');
const { NotFoundError, ValidationError, ConflictError } = require('../utils/ApiError');

/**
 * PaymentRepository — data access for the `payments` table.
 */
class PaymentRepository extends BaseRepository {
  constructor(db) {
    super(db, 'payments');
  }

  /**
   * Record a payment and update the parent invoice + customer outstanding in an ACID transaction.
   */
  recordPayment(paymentData, userId = null) {
    const now = new Date().toISOString();

    return this.db.transaction(() => {
      // 1. Load + verify the invoice FIRST — inserting the payment row before
      // this check would instead fail on the table's FK constraint, which
      // surfaces as an opaque 500 rather than a clean 404.
      const invoice = this.db.prepare(`
        SELECT id, grand_total, amount_paid, amount_due, status, customer_id
        FROM invoices
        WHERE id = ? AND company_id = ? AND is_deleted = 0
      `).get(paymentData.invoice_id, paymentData.company_id);

      if (!invoice) {
        throw new NotFoundError(`Invoice with ID ${paymentData.invoice_id} not found.`);
      }

      const amount = Math.round(Number(paymentData.amount) * 100) / 100;
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new ValidationError('Payment amount must be greater than zero.');
      }
      if (amount > Number(invoice.amount_due) + 0.005) {
        throw new ValidationError('Payment amount cannot exceed the invoice outstanding balance.');
      }

      if (paymentData.reference_no) {
        const duplicate = this.db.prepare(`
          SELECT id FROM payments
          WHERE company_id = ? AND reference_no = ?
          LIMIT 1
        `).get(paymentData.company_id, paymentData.reference_no);
        if (duplicate) {
          throw new ConflictError('A payment with this reference number has already been recorded.');
        }
      }

      // 2. Insert payment record
      const payment = this.create({
        ...paymentData,
        amount,
        created_by: userId,
        status: 'completed',
        created_at: now,
        updated_at: now,
      });

      // Calculate new totals
      const newPaid = Math.round((Number(invoice.amount_paid) + amount) * 100) / 100;
      const newDue = Math.max(0, Math.round((Number(invoice.grand_total) - newPaid) * 100) / 100);
      let newStatus = 'partial';
      let paidAt = null;

      if (newDue === 0) {
        newStatus = 'paid';
        paidAt = now;
      }

      // Payments bypass InvoiceRepository.updateInvoiceStatus, so complete
      // the stock movement here when this payment settles the invoice.
      if (newStatus === 'paid' && invoice.status !== 'paid') {
        const items = this.db.prepare(`
          SELECT product_id, qty FROM invoice_items WHERE invoice_id = ? AND product_id IS NOT NULL
        `).all(invoice.id);
        for (const item of items) {
          const product = this.db.prepare(`
            SELECT is_service FROM products WHERE id = ? AND company_id = ?
          `).get(item.product_id, paymentData.company_id);
          if (product && !product.is_service) {
            this.db.prepare(`
              UPDATE products SET stock = stock - ?, updated_at = ?
              WHERE id = ? AND company_id = ?
            `).run(item.qty, now, item.product_id, paymentData.company_id);
            this.db.prepare(`
              INSERT INTO inventory (company_id, product_id, type, quantity, reference, notes, created_by, created_at)
              VALUES (?, ?, 'out', ?, ?, 'Sold via Invoice Payment', ?, ?)
            `).run(paymentData.company_id, item.product_id, item.qty, `INV-${invoice.id}`, userId, now);
          }
        }
      }

      // Update invoice
      this.db.prepare(`
        UPDATE invoices
        SET amount_paid = ?, amount_due = ?, status = ?, paid_at = ?, updated_at = ?, updated_by = ?
        WHERE id = ?
      `).run(newPaid, newDue, newStatus, paidAt, now, userId, invoice.id);

      // 3. Update customer outstanding balance
      this.db.prepare(`
        UPDATE customers
        SET total_paid = total_paid + ?,
            outstanding = MAX(0, outstanding - ?)
        WHERE id = ?
      `).run(amount, amount, invoice.customer_id);

      return payment;
    })();
  }
}

module.exports = PaymentRepository;
