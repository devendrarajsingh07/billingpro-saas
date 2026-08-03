'use strict';

const BaseRepository = require('./BaseRepository');

/**
 * InventoryRepository — read access to the `inventory` movement log.
 *
 * Rows are written by ProductRepository.adjustStock (manual adjustments),
 * InvoiceRepository (stock sold/returned), and PurchaseOrderRepository
 * (stock received/reversed). This repository only reads that log — it does
 * not write to it directly, so all movements stay attributable to the
 * operation that actually caused them.
 */
class InventoryRepository extends BaseRepository {
  constructor(db) {
    super(db, 'inventory');
  }

  /**
   * Paginated movement log, newest first, joined with product name/sku.
   */
  findMovements({ companyId, page = 1, limit = 20, productId = null, type = null }) {
    const conditions = ['inv.company_id = ?'];
    const params = [companyId];

    if (productId) {
      conditions.push('inv.product_id = ?');
      params.push(Number(productId));
    }
    if (type) {
      conditions.push('inv.type = ?');
      params.push(type);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const offset = (Number(page) - 1) * Number(limit);

    const movements = this.db.prepare(`
      SELECT inv.*, p.name AS product_name, p.sku AS product_sku, p.unit AS product_unit
      FROM inventory inv
      LEFT JOIN products p ON p.id = inv.product_id
      ${where}
      ORDER BY inv.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), offset);

    const { total } = this.db.prepare(`
      SELECT COUNT(*) AS total FROM inventory inv ${where}
    `).get(...params);

    return { movements, total };
  }
}

module.exports = InventoryRepository;
