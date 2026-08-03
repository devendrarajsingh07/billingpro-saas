'use strict';

const BaseRepository = require('./BaseRepository');
const { generateInvoiceNumber } = require('../utils/numberGenerator');

/**
 * InvoiceRepository — data access for the `invoices` and `invoice_items` tables.
 */
class InvoiceRepository extends BaseRepository {
  constructor(db) {
    super(db, 'invoices');
  }

  /**
   * Fetch an invoice by ID, with all nested line items and customer details.
   */
  findByIdWithDetails(id, companyId) {
    const invoice = this.db.prepare(`
      SELECT i.*,
             c.name AS customer_name,
             c.email AS customer_email,
             c.phone AS customer_phone,
             c.gstin AS customer_gstin,
             c.pan AS customer_pan,
             c.billing_address AS customer_billing_address,
             c.shipping_address AS customer_shipping_address
      FROM invoices i
      JOIN customers c ON c.id = i.customer_id
      WHERE i.id = ? AND i.company_id = ? AND i.is_deleted = 0
    `).get(id, companyId);

    if (!invoice) return undefined;

    // Load line items
    invoice.items = this.db.prepare(`
      SELECT ii.*, p.name AS product_name, p.sku AS product_sku, p.hsn_code AS product_hsn
      FROM invoice_items ii
      LEFT JOIN products p ON p.id = ii.product_id
      WHERE ii.invoice_id = ?
      ORDER BY ii.sort_order ASC, ii.id ASC
    `).all(id);

    return invoice;
  }

  /**
   * Create an invoice with items in an ACID transaction.
   * Updates customer balances and products stock (if products are physical/tracked).
   */
  createInvoiceWithItems(invoiceData, items, userId = null) {
    const now = new Date().toISOString();

    const transactionFn = this.db.transaction(() => {
      // 1. Generate a unique invoice number inside the transaction.
      const companyId = invoiceData.company_id;
      const year = new Date(invoiceData.date || now).getFullYear();

      const company = this.db.prepare('SELECT invoice_prefix FROM companies WHERE id = ?').get(companyId);
      const prefix = company ? (company.invoice_prefix || 'INV') : 'INV';

      const likePrefix = `${prefix}-${year}-%`;
      const row = this.db.prepare(`
        SELECT invoice_no
        FROM invoices
        WHERE company_id = ? AND invoice_no LIKE ? AND is_deleted = 0
        ORDER BY id DESC
        LIMIT 1
      `).get(companyId, likePrefix);

      let lastSeq = 0;
      if (row) {
        lastSeq = parseInt(row.invoice_no.split('-')[2], 10) || 0;
      }

      const seed = `${companyId}-${invoiceData.customer_id || 0}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const invoiceNo = generateInvoiceNumber(prefix, year, lastSeq, seed);

      // 2. Create main invoice record
      const invoice = this.create({
        ...invoiceData,
        invoice_no: invoiceNo,
        created_by: userId,
        updated_by: userId,
      });

      // 3. Insert line items & adjust stock if physical product
      const insertItem = this.db.prepare(`
        INSERT INTO invoice_items (invoice_id, product_id, description, qty, unit_price, discount, tax_rate, tax_amount, total, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let idx = 0;
      for (const item of items) {
        insertItem.run(
          invoice.id,
          item.product_id || null,
          item.description,
          item.qty,
          item.unit_price,
          item.discount || 0,
          item.tax_rate || 0,
          item.tax_amount || 0,
          item.total,
          idx++
        );

        // Inventory leaves stock only when an invoice is paid. Sending an
        // invoice represents an offer/receivable, not a completed sale.
        if (item.product_id && invoice.status === 'paid') {
          const product = this.db.prepare('SELECT is_service, stock FROM products WHERE id = ?').get(item.product_id);
          if (product && !product.is_service) {
            // Deduct stock
            this.db.prepare(`
              UPDATE products
              SET stock = stock - ?, updated_at = ?
              WHERE id = ? AND company_id = ?
            `).run(item.qty, now, item.product_id, invoice.company_id);

            // Log inventory movement
            this.db.prepare(`
              INSERT INTO inventory (company_id, product_id, type, quantity, reference, notes, created_by, created_at)
              VALUES (?, ?, 'out', ?, ?, ?, ?, ?)
            `).run(invoice.company_id, item.product_id, item.qty, `INV-${invoice.invoice_no}`, 'Sold via Invoice', userId, now);
          }
        }
      }

      // 4. Sync customer outstanding
      const syncCustomer = this.db.prepare(`
        UPDATE customers
        SET total_invoiced = total_invoiced + ?,
            outstanding = outstanding + ?
        WHERE id = ? AND company_id = ?
      `);
      if (invoice.status !== 'draft') {
        syncCustomer.run(invoice.grand_total, invoice.amount_due, invoice.customer_id, invoice.company_id);
      }

      return invoice.id;
    });

    return transactionFn.immediate();
  }

  /**
   * Update an invoice's status and perform required stock/customer balance syncs.
   */
  updateInvoiceStatus(id, companyId, newStatus, userId = null) {
    const now = new Date().toISOString();

    return this.db.transaction(() => {
      const oldInvoice = this.findByIdWithDetails(id, companyId);
      if (!oldInvoice) return null;

      if (oldInvoice.status === newStatus) return oldInvoice;

      // Handle stock and customer balance adjustments based on transitions:
      // Active invoices affect receivables; only paid invoices affect stock.

      const isOldActive = !['draft', 'cancelled'].includes(oldInvoice.status);
      const isNewActive = !['draft', 'cancelled'].includes(newStatus);

      // Adjust customer balance
      if (isOldActive && !isNewActive) {
        // Decrease customer totals
        this.db.prepare(`
          UPDATE customers
          SET total_invoiced = MAX(0, total_invoiced - ?),
              outstanding = MAX(0, outstanding - ?)
          WHERE id = ? AND company_id = ?
        `).run(oldInvoice.grand_total, oldInvoice.amount_due, oldInvoice.customer_id, companyId);
      } else if (!isOldActive && isNewActive) {
        // Increase customer totals
        this.db.prepare(`
          UPDATE customers
          SET total_invoiced = total_invoiced + ?,
              outstanding = outstanding + ?
          WHERE id = ? AND company_id = ?
        `).run(oldInvoice.grand_total, oldInvoice.amount_due, oldInvoice.customer_id, companyId);
      } else if (isOldActive && isNewActive) {
        // Just adjust outstanding difference if any (though status changes sent->paid don't change grand_total, amount_due changes are handled in payments)
      }

      // Adjust stock levels only when crossing the paid boundary.
      const wasPaid = oldInvoice.status === 'paid';
      const isPaid = newStatus === 'paid';
      if (wasPaid && !isPaid) {
        // Reverse a previously completed sale.
        for (const item of oldInvoice.items) {
          if (item.product_id) {
            const product = this.db.prepare('SELECT is_service FROM products WHERE id = ?').get(item.product_id);
            if (product && !product.is_service) {
              this.db.prepare(`UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?`).run(item.qty, now, item.product_id);
              this.db.prepare(`
                INSERT INTO inventory (company_id, product_id, type, quantity, reference, notes, created_by, created_at)
                VALUES (?, ?, 'in', ?, ?, 'Returned on Invoice Cancellation', ?, ?)
              `).run(companyId, item.product_id, item.qty, `INV-${oldInvoice.invoice_no}`, userId, now);
            }
          }
        }
      } else if (!wasPaid && isPaid) {
        // Complete a sale.
        for (const item of oldInvoice.items) {
          if (item.product_id) {
            const product = this.db.prepare('SELECT is_service FROM products WHERE id = ?').get(item.product_id);
            if (product && !product.is_service) {
              this.db.prepare(`UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?`).run(item.qty, now, item.product_id);
              this.db.prepare(`
                INSERT INTO inventory (company_id, product_id, type, quantity, reference, notes, created_by, created_at)
                VALUES (?, ?, 'out', ?, ?, 'Sold via Invoice', ?, ?)
              `).run(companyId, item.product_id, item.qty, `INV-${oldInvoice.invoice_no}`, userId, now);
            }
          }
        }
      }

      // Update invoice fields
      const updateData = { status: newStatus, updated_by: userId };
      if (newStatus === 'paid') {
        const newlySettled = Math.max(0, Number(oldInvoice.amount_due));
        if (newlySettled > 0) {
          this.db.prepare(`
            UPDATE customers
            SET total_paid = total_paid + ?,
                outstanding = MAX(0, outstanding - ?)
            WHERE id = ? AND company_id = ?
          `).run(newlySettled, newlySettled, oldInvoice.customer_id, companyId);
        }
        updateData.paid_at = now;
        updateData.amount_paid = oldInvoice.grand_total;
        updateData.amount_due = 0;
      } else if (newStatus === 'cancelled') {
        updateData.amount_due = 0; // cancelled invoices have no outstanding balance
      }

      return this.update(id, companyId, updateData);
    })();
  }
}

module.exports = InvoiceRepository;
