'use strict';

const BaseRepository = require('./BaseRepository');

/**
 * ProductRepository — data access for the `products` table.
 */
class ProductRepository extends BaseRepository {
  constructor(db) {
    super(db, 'products');
  }

  /**
   * Find product by SKU or barcode.
   */
  findBySkuOrBarcode(companyId, code) {
    return this.db.prepare(`
      SELECT * FROM products
      WHERE company_id = ?
        AND is_deleted = 0
        AND (sku = ? OR barcode = ?)
      LIMIT 1
    `).get(companyId, code, code);
  }

  /**
   * Get products with stock lower than low_stock_threshold.
   */
  findLowStock(companyId) {
    return this.db.prepare(`
      SELECT * FROM products
      WHERE company_id = ?
        AND is_deleted = 0
        AND is_service = 0
        AND stock <= low_stock_threshold
      ORDER BY stock ASC
    `).all(companyId);
  }

  /**
   * Perform stock adjustments in a transaction-safe way.
   * Records a log in the `inventory` table and increments/decrements `products` stock.
   *
   * type = 'in'         -> qty must be positive; stock increases by qty. Logged quantity
   *                        is the positive magnitude (matches convention used by
   *                        InvoiceRepository / PurchaseOrderRepository).
   * type = 'out'        -> qty must be positive; stock decreases by qty (floored at 0).
   *                        Logged quantity is the positive magnitude; direction comes
   *                        from `type`, same convention as above.
   * type = 'adjustment' -> qty is a signed delta (can be negative) applied directly,
   *                        e.g. for physical recount corrections. Logged as-is.
   */
  adjustStock(productId, companyId, qty, type, reference = '', notes = '', userId = null) {
    const now = new Date().toISOString();
    const numericQty = Number(qty) || 0;

    return this.db.transaction(() => {
      let delta;         // signed amount actually applied to stock
      let loggedQuantity; // value stored in inventory.quantity

      if (type === 'in') {
        delta = Math.abs(numericQty);
        loggedQuantity = delta;
      } else if (type === 'out') {
        delta = -Math.abs(numericQty);
        loggedQuantity = Math.abs(numericQty);
      } else {
        // 'adjustment' — treat qty as an already-signed delta
        delta = numericQty;
        loggedQuantity = numericQty;
      }

      // 1. Insert inventory log
      this.db.prepare(`
        INSERT INTO inventory (company_id, product_id, type, quantity, reference, notes, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(companyId, productId, type, loggedQuantity, reference, notes, userId, now);

      // 2. Adjust product stock, never letting it go negative
      this.db.prepare(`
        UPDATE products
        SET stock = MAX(0, stock + ?), updated_at = ?
        WHERE id = ? AND company_id = ?
      `).run(delta, now, productId, companyId);

      return this.findById(productId, companyId);
    })();
  }
}

module.exports = ProductRepository;
