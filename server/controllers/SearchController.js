'use strict';

const db = require('../config/database');
const ApiResponse = require('../utils/ApiResponse');

/**
 * @swagger
 * /api/v1/search:
 *   get:
 *     tags: [Search]
 *     summary: Global cross-entity search
 *     description: |
 *       Searches across customers, invoices, products, suppliers, purchase orders,
 *       and payments in a single request. Returns up to 5 results per entity type.
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string, minLength: 2 }
 *         description: Search term (minimum 2 characters)
 *     responses:
 *       200:
 *         description: Search results grouped by entity type
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         customers:      { type: array, items: { type: object } }
 *                         invoices:       { type: array, items: { type: object } }
 *                         products:       { type: array, items: { type: object } }
 *                         suppliers:      { type: array, items: { type: object } }
 *                         purchaseOrders: { type: array, items: { type: object } }
 *                         payments:       { type: array, items: { type: object } }
 */
const search = (req, res, next) => {
  try {
    const { q = '' } = req.query;
    const companyId = req.companyId;
    const term = `%${q.trim()}%`;

    if (q.trim().length < 2) {
      return res.json(ApiResponse.success({
        customers: [], invoices: [], products: [],
        suppliers: [], purchaseOrders: [], payments: [],
      }));
    }

    // ── Customers ──────────────────────────────────────────────
    const customers = db.prepare(`
      SELECT id, name, email, phone, 'customer' AS type
      FROM customers
      WHERE company_id = ? AND is_deleted = 0
        AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)
      LIMIT 5
    `).all(companyId, term, term, term);

    // ── Invoices ───────────────────────────────────────────────
    const invoices = db.prepare(`
      SELECT i.id, i.invoice_no, i.status, i.grand_total,
             i.date, c.name AS customer_name, 'invoice' AS type
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.company_id = ? AND i.is_deleted = 0
        AND (i.invoice_no LIKE ? OR c.name LIKE ?)
      LIMIT 5
    `).all(companyId, term, term);

    // ── Products ───────────────────────────────────────────────
    const products = db.prepare(`
      SELECT p.id, p.name, p.sku, p.selling_price AS price, p.stock,
             cat.name AS category, 'product' AS type
      FROM products p
      LEFT JOIN categories cat ON p.category_id = cat.id
      WHERE p.company_id = ? AND p.is_deleted = 0
        AND (p.name LIKE ? OR p.sku LIKE ? OR cat.name LIKE ?)
      LIMIT 5
    `).all(companyId, term, term, term);

    // ── Suppliers ──────────────────────────────────────────────
    const suppliers = db.prepare(`
      SELECT id, name, email, phone, gstin, 'supplier' AS type
      FROM suppliers
      WHERE company_id = ? AND is_deleted = 0
        AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR gstin LIKE ?)
      LIMIT 5
    `).all(companyId, term, term, term, term);

    // ── Purchase Orders ────────────────────────────────────────
    const purchaseOrders = db.prepare(`
      SELECT po.id, po.po_no, po.status, po.total,
             s.name AS supplier_name, 'purchase_order' AS type
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.company_id = ? AND po.is_deleted = 0
        AND (po.po_no LIKE ? OR s.name LIKE ?)
      LIMIT 5
    `).all(companyId, term, term);

    // ── Payments ───────────────────────────────────────────────
    // (payments has no is_deleted column — it's never soft-deleted)
    const payments = db.prepare(`
      SELECT p.id, p.amount, p.method, p.reference_no, p.paid_at,
             i.invoice_no, c.name AS customer_name, 'payment' AS type
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE p.company_id = ?
        AND (p.reference_no LIKE ? OR i.invoice_no LIKE ? OR c.name LIKE ?)
      LIMIT 5
    `).all(companyId, term, term, term);

    return res.json(ApiResponse.success({
      customers,
      invoices,
      products,
      suppliers,
      purchaseOrders,
      payments,
    }));
  } catch (err) {
    next(err);
  }
};

module.exports = { search };
