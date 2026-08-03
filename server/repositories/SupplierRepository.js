'use strict';

const BaseRepository = require('./BaseRepository');

/**
 * SupplierRepository — data access for the `suppliers` table.
 */
class SupplierRepository extends BaseRepository {
  constructor(db) {
    super(db, 'suppliers');
  }

  /**
   * Search suppliers by name/email/phone/gstin.
   */
  searchSuppliers(companyId, queryStr, limit = 10) {
    const term = `%${queryStr}%`;
    return this.db.prepare(`
      SELECT * FROM suppliers
      WHERE company_id = ?
        AND is_deleted = 0
        AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR gstin LIKE ?)
      ORDER BY name ASC
      LIMIT ?
    `).all(companyId, term, term, term, term, limit);
  }
}

module.exports = SupplierRepository;
