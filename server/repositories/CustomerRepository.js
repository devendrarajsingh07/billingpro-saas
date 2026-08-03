'use strict';

const BaseRepository = require('./BaseRepository');

/**
 * CustomerRepository — data access for the `customers` table.
 */
class CustomerRepository extends BaseRepository {
  constructor(db) {
    super(db, 'customers');
  }

  /**
   * Search and filter customers.
   */
  searchCustomers(companyId, queryStr, limit = 10) {
    const term = `%${queryStr}%`;
    return this.db.prepare(`
      SELECT * FROM customers
      WHERE company_id = ?
        AND is_deleted = 0
        AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR gstin LIKE ?)
      ORDER BY name ASC
      LIMIT ?
    `).all(companyId, term, term, term, term, limit);
  }

  /**
   * Update total paid/invoiced stats after invoice/payment changes.
   */
  updateOutstandingBalance(customerId, companyId) {
    // Get sums from invoices
    const stats = this.db.prepare(`
      SELECT
        SUM(grand_total) AS total_invoiced,
        SUM(amount_paid) AS total_paid,
        SUM(amount_due) AS outstanding
      FROM invoices
      WHERE customer_id = ? AND company_id = ? AND is_deleted = 0
    `).get(customerId, companyId);

    const invoiced = stats.total_invoiced || 0;
    const paid = stats.total_paid || 0;
    const outstanding = stats.outstanding || 0;

    this.db.prepare(`
      UPDATE customers
      SET total_invoiced = ?, total_paid = ?, outstanding = ?, updated_at = ?
      WHERE id = ? AND company_id = ?
    `).run(invoiced, paid, outstanding, new Date().toISOString(), customerId, companyId);
  }
}

module.exports = CustomerRepository;
