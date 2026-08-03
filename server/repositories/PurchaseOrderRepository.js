'use strict';

const BaseRepository = require('./BaseRepository');

/**
 * PurchaseOrderRepository — data access for `purchase_orders` and `purchase_order_items`.
 *
 * Mirrors InvoiceRepository's shape, but stock moves the opposite direction:
 * receiving a PO increases product stock (goods coming in), while
 * cancelling a received PO reverses that increase.
 */
class PurchaseOrderRepository extends BaseRepository {
  constructor(db) {
    super(db, 'purchase_orders');
  }

  findByIdWithDetails(id, companyId) {
    const po = this.db.prepare(`
      SELECT po.*, s.name AS supplier_name, s.email AS supplier_email, s.phone AS supplier_phone
      FROM purchase_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.id = ? AND po.company_id = ? AND po.is_deleted = 0
    `).get(id, companyId);

    if (!po) return undefined;

    po.items = this.db.prepare(`
      SELECT poi.*, p.name AS product_name, p.sku AS product_sku
      FROM purchase_order_items poi
      LEFT JOIN products p ON p.id = poi.product_id
      WHERE poi.purchase_order_id = ?
      ORDER BY poi.sort_order ASC, poi.id ASC
    `).all(id);

    return po;
  }

  /**
   * Create a purchase order with items in an ACID transaction.
   * Does NOT touch stock — stock only moves when the PO is marked 'received'.
   */
  createPOWithItems(poData, items, userId = null) {
    const transactionFn = this.db.transaction(() => {
      const companyId = poData.company_id;
      const year = new Date(poData.date || new Date()).getFullYear();

      const company = this.db.prepare('SELECT po_prefix FROM companies WHERE id = ?').get(companyId);
      const prefix = company ? (company.po_prefix || 'PO') : 'PO';

      const likePrefix = `${prefix}-${year}-%`;
      const row = this.db.prepare(`
        SELECT po_no
        FROM purchase_orders
        WHERE company_id = ? AND po_no LIKE ? AND is_deleted = 0
        ORDER BY id DESC
        LIMIT 1
      `).get(companyId, likePrefix);

      let lastSeq = 0;
      if (row) {
        const parts = row.po_no.split('-');
        lastSeq = parseInt(parts[parts.length - 1], 10) || 0;
      }

      const nextSeq = lastSeq + 1;
      const seqStr = String(nextSeq).padStart(6, '0');
      const poNo = `${prefix}-${year}-${seqStr}`;

      const po = this.create({
        ...poData,
        po_no: poNo,
        created_by: userId,
      });

      const insertItem = this.db.prepare(`
        INSERT INTO purchase_order_items (purchase_order_id, product_id, description, qty, unit_price, tax_rate, tax_amount, total, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let idx = 0;
      for (const item of items) {
        insertItem.run(
          po.id,
          item.product_id || null,
          item.description,
          item.qty,
          item.unit_price,
          item.tax_rate || 0,
          item.tax_amount || 0,
          item.total,
          idx++
        );
      }

      return po.id;
    });

    return transactionFn();
  }

  /**
   * Update a PO's status. Only the 'received' transition affects stock —
   * receiving goods increases product stock; reversing out of 'received'
   * (e.g. to 'cancelled') decreases it back.
   */
  updatePOStatus(id, companyId, newStatus, userId = null) {
    const now = new Date().toISOString();

    return this.db.transaction(() => {
      const oldPO = this.findByIdWithDetails(id, companyId);
      if (!oldPO) return null;

      if (oldPO.status === newStatus) return oldPO;

      const wasReceived = oldPO.status === 'received';
      const isReceived = newStatus === 'received';

      if (!wasReceived && isReceived) {
        // Receiving: increase stock for tracked (non-service) products
        for (const item of oldPO.items) {
          if (item.product_id) {
            const product = this.db.prepare('SELECT is_service FROM products WHERE id = ?').get(item.product_id);
            if (product && !product.is_service) {
              this.db.prepare(`UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ? AND company_id = ?`)
                .run(item.qty, now, item.product_id, companyId);
              this.db.prepare(`
                INSERT INTO inventory (company_id, product_id, type, quantity, reference, notes, created_by, created_at)
                VALUES (?, ?, 'in', ?, ?, 'Received via Purchase Order', ?, ?)
              `).run(companyId, item.product_id, item.qty, `PO-${oldPO.po_no}`, userId, now);
            }
            this.db.prepare(`UPDATE purchase_order_items SET received_qty = ? WHERE id = ?`)
              .run(item.qty, item.id);
          }
        }
      } else if (wasReceived && !isReceived) {
        // Reversing a receipt (e.g. cancelling after receiving): decrease stock back
        for (const item of oldPO.items) {
          if (item.product_id) {
            const product = this.db.prepare('SELECT is_service FROM products WHERE id = ?').get(item.product_id);
            if (product && !product.is_service) {
              this.db.prepare(`UPDATE products SET stock = MAX(0, stock - ?), updated_at = ? WHERE id = ? AND company_id = ?`)
                .run(item.qty, now, item.product_id, companyId);
              this.db.prepare(`
                INSERT INTO inventory (company_id, product_id, type, quantity, reference, notes, created_by, created_at)
                VALUES (?, ?, 'out', ?, ?, 'Reversed Purchase Order Receipt', ?, ?)
              `).run(companyId, item.product_id, item.qty, `PO-${oldPO.po_no}`, userId, now);
            }
            this.db.prepare(`UPDATE purchase_order_items SET received_qty = 0 WHERE id = ?`)
              .run(item.id);
          }
        }
      }

      return this.update(id, companyId, { status: newStatus });
    })();
  }
}

module.exports = PurchaseOrderRepository;
