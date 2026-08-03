'use strict';

const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const ApiResponse = require('../../utils/ApiResponse');
const { authenticate } = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const { generateInvoiceNumber, extractSequence } = require('../../utils/numberGenerator');

router.use(authenticate);

/**
 * @swagger
 * /api/v1/sales-orders:
 *   get:
 *     tags: [Sales Orders]
 *     summary: List sales orders
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, confirmed, processing, completed, cancelled] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200: { description: Paginated list, content: { application/json: { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } }
 */
router.get('/', authorize('invoices.read'), (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    let query = `SELECT so.*, c.name AS customer_name 
      FROM sales_orders so
      LEFT JOIN customers c ON c.id = so.customer_id AND c.company_id = so.company_id
      WHERE so.company_id = ? AND so.is_deleted = 0`;
    const params = [req.companyId];

    if (status) { query += ' AND so.status = ?'; params.push(status); }
    if (search) { query += ' AND (so.so_no LIKE ? OR c.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    const total = db.prepare(`SELECT COUNT(*) AS total FROM (${query})`).get(...params).total;
    query += ` ORDER BY so.created_at DESC LIMIT ? OFFSET ?`;
    const orders = db.prepare(query).all(...params, Number(limit), offset);

    res.json(ApiResponse.paginated(orders, total, page, limit));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/sales-orders:
 *   post:
 *     tags: [Sales Orders]
 *     summary: Create a new sales order
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               customer_id:   { type: integer, example: 7 }
 *               date:          { type: string, format: date }
 *               expected_date: { type: string, format: date }
 *               notes:         { type: string }
 *               terms:         { type: string }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     product_id: { type: integer }
 *                     name:       { type: string, example: 'Laptop Pro 16"' }
 *                     qty:        { type: integer, example: 2 }
 *                     unit_price: { type: number, example: 85000 }
 *                     tax_rate:   { type: number, example: 18 }
 *     responses:
 *       201: { description: Sales order created, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 *       400: { description: Missing items, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/', authorize('invoices.create'), (req, res, next) => {
  try {
    const { customer_id, items = [], notes, terms, date, expected_date } = req.body;
    if (!items.length) return res.status(400).json(ApiResponse.error('Sales order must have at least one item.'));

    if (customer_id) {
      const customer = db.prepare(`
        SELECT id FROM customers
        WHERE id = ? AND company_id = ? AND is_deleted = 0
      `).get(Number(customer_id), req.companyId);
      if (!customer) return res.status(400).json(ApiResponse.error('Selected customer does not exist in this company.'));
    }

    const getProduct = db.prepare(`
      SELECT id FROM products
      WHERE id = ? AND company_id = ? AND is_deleted = 0
    `);
    for (const item of items) {
      if (item.product_id && !getProduct.get(Number(item.product_id), req.companyId)) {
        return res.status(400).json(ApiResponse.error(`Product with ID ${item.product_id} does not exist in this company.`));
      }
      if (!Number.isFinite(Number(item.qty)) || Number(item.qty) <= 0 ||
          !Number.isFinite(Number(item.unit_price)) || Number(item.unit_price) < 0 ||
          !Number.isFinite(Number(item.tax_rate)) || Number(item.tax_rate) < 0) {
        return res.status(400).json(ApiResponse.error('Line item quantity must be positive; price and tax rate cannot be negative.'));
      }
    }

    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.companyId);
    const lastSO = db.prepare(`SELECT so_no FROM sales_orders WHERE company_id = ? ORDER BY id DESC LIMIT 1`).get(req.companyId);
    const soNo = generateInvoiceNumber(company.po_prefix || 'SO', new Date().getFullYear(), extractSequence(lastSO?.so_no));

    let subtotal = 0, taxAmount = 0;
    const computedItems = items.map(item => {
      const qty = Number(item.qty) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const taxRate = Number(item.tax_rate) || 0;
      const lineBase = qty * unitPrice;
      const lineTax = lineBase * (taxRate / 100);
      subtotal += lineBase;
      taxAmount += lineTax;
      return { ...item, qty, unit_price: unitPrice, tax_rate: taxRate, line_total: lineBase + lineTax };
    });
    const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;

    const result = db.transaction(() => {
      const now = new Date().toISOString();
      const so = db.prepare(`
        INSERT INTO sales_orders (company_id, customer_id, so_no, date, expected_date, subtotal, tax_amount, grand_total, notes, terms, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
      `).run(req.companyId, customer_id, soNo, date || now.split('T')[0], expected_date || null,
             Math.round(subtotal * 100) / 100, Math.round(taxAmount * 100) / 100, grandTotal, notes || null, terms || null, now, now);

      const soId = so.lastInsertRowid;
      const insertItem = db.prepare(`
        INSERT INTO sales_order_items (sales_order_id, product_id, name, description, qty, unit_price, tax_rate, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of computedItems) {
        insertItem.run(soId, item.product_id || null, item.name, item.description || null, item.qty, item.unit_price, item.tax_rate, item.line_total);
      }
      return soId;
    })();

    const created = db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(result);
    res.status(201).json(ApiResponse.success(created, 'Sales order created successfully.'));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/sales-orders/{id}:
 *   get:
 *     tags: [Sales Orders]
 *     summary: Get a single sales order with its line items
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Sales order found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 *       404: { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/:id', authorize('invoices.read'), (req, res, next) => {
  try {
    const so = db.prepare(`SELECT so.*, c.name AS customer_name, c.email AS customer_email 
      FROM sales_orders so LEFT JOIN customers c ON c.id = so.customer_id AND c.company_id = so.company_id
      WHERE so.id = ? AND so.company_id = ? AND so.is_deleted = 0`).get(Number(req.params.id), req.companyId);
    if (!so) return res.status(404).json(ApiResponse.error('Sales order not found.'));
    const items = db.prepare('SELECT * FROM sales_order_items WHERE sales_order_id = ?').all(so.id);
    res.json(ApiResponse.success({ ...so, items }, 'Sales order fetched.'));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/sales-orders/{id}/status:
 *   patch:
 *     tags: [Sales Orders]
 *     summary: Update a sales order's status
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [draft, confirmed, processing, completed, cancelled] }
 *     responses:
 *       200: { description: Status updated, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 *       400: { description: Invalid status, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.patch('/:id/status', authorize('invoices.update'), (req, res, next) => {
  try {
    const { status } = req.body;
    const VALID = ['draft', 'confirmed', 'processing', 'completed', 'cancelled'];
    if (!VALID.includes(status)) return res.status(400).json(ApiResponse.error(`Invalid status. Must be one of: ${VALID.join(', ')}`));
    db.prepare(`UPDATE sales_orders SET status = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ?`)
      .run(status, Number(req.params.id), req.companyId);
    const updated = db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(Number(req.params.id));
    res.json(ApiResponse.success(updated, `Sales order ${status}.`));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/sales-orders/{id}/convert-to-invoice:
 *   post:
 *     tags: [Sales Orders]
 *     summary: Convert a sales order into a draft invoice (one-time — cannot convert twice)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       201: { description: Invoice created from sales order, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 *       404: { description: Sales order not found, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       409: { description: Already converted, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/:id/convert-to-invoice', authorize('invoices.create'), (req, res, next) => {
  try {
    const soId = Number(req.params.id);
    const so = db.prepare('SELECT * FROM sales_orders WHERE id = ? AND company_id = ? AND is_deleted = 0').get(soId, req.companyId);
    if (!so) return res.status(404).json(ApiResponse.error('Sales order not found.'));
    if (so.invoice_id) return res.status(409).json(ApiResponse.error('This sales order has already been converted to an invoice.'));

    const soItems = db.prepare('SELECT * FROM sales_order_items WHERE sales_order_id = ?').all(soId);
    const InvoiceService = require('../../services/InvoiceService');

    const invoice = InvoiceService.createInvoice(req.companyId, {
      customer_id: so.customer_id,
      date: new Date().toISOString().split('T')[0],
      due_date: null,
      notes: so.notes,
      terms: so.terms,
      subtotal: so.subtotal,
      tax_amount: so.tax_amount,
      grand_total: so.grand_total,
      amount_due: so.grand_total,
      items: soItems.map(i => ({
        product_id: i.product_id,
        name: i.name,
        description: i.description,
        qty: i.qty,
        unit_price: i.unit_price,
        tax_rate: i.tax_rate,
      })),
    }, req.userId);

    db.prepare(`UPDATE sales_orders SET invoice_id = ?, status = 'completed', updated_at = datetime('now') WHERE id = ?`)
      .run(invoice.id, soId);

    res.status(201).json(ApiResponse.success(invoice, 'Sales order converted to invoice successfully.'));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/sales-orders/{id}:
 *   delete:
 *     tags: [Sales Orders]
 *     summary: Soft-delete a sales order
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Sales order deleted, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.delete('/:id', authorize('invoices.delete'), (req, res, next) => {
  try {
    db.prepare(`UPDATE sales_orders SET is_deleted = 1, updated_at = datetime('now') WHERE id = ? AND company_id = ?`)
      .run(Number(req.params.id), req.companyId);
    res.json(ApiResponse.success(null, 'Sales order deleted.'));
  } catch (err) { next(err); }
});

module.exports = router;
