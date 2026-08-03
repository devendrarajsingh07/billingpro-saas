'use strict';

const SupplierService = require('../services/SupplierService');
const ApiResponse = require('../utils/ApiResponse');
const { ValidationError } = require('../utils/ApiError');

class SupplierController {
  static async getSuppliers(req, res, next) {
    try {
      const { search, page = 1, limit = 10, sort = 'name', order = 'asc', is_active } = req.query;
      const { suppliers, total } = SupplierService.getSuppliers(req.companyId, {
        search,
        page: Number(page),
        limit: Number(limit),
        sort,
        order,
        is_active,
      });

      res.json(ApiResponse.paginated(suppliers, total, page, limit));
    } catch (err) {
      next(err);
    }
  }

  static async getSupplierById(req, res, next) {
    try {
      const supplier = SupplierService.getSupplierById(Number(req.params.id), req.companyId);
      res.json(ApiResponse.success(supplier, 'Supplier details fetched successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async createSupplier(req, res, next) {
    try {
      const supplier = SupplierService.createSupplier(req.companyId, req.body, req.userId);
      res.status(201).json(ApiResponse.success(supplier, 'Supplier created successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async updateSupplier(req, res, next) {
    try {
      const supplier = SupplierService.updateSupplier(Number(req.params.id), req.companyId, req.body, req.userId);
      res.json(ApiResponse.success(supplier, 'Supplier updated successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async deleteSupplier(req, res, next) {
    try {
      SupplierService.deleteSupplier(Number(req.params.id), req.companyId);
      res.json(ApiResponse.success(null, 'Supplier deleted successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async getSupplierPayments(req, res, next) {
    try {
      const supplierId = Number(req.params.id);
      const db = require('../config/database');

      const payments = db.prepare(`
        SELECT sp.*, po.po_no
        FROM supplier_payments sp
        LEFT JOIN purchase_orders po ON po.id = sp.purchase_order_id
        WHERE sp.supplier_id = ? AND sp.company_id = ?
        ORDER BY sp.paid_at DESC
      `).all(supplierId, req.companyId);

      res.json(ApiResponse.success(payments, 'Supplier payments fetched successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async createSupplierPayment(req, res, next) {
    try {
      const supplierId = Number(req.params.id);
      const { purchase_order_id, amount, method, reference_no, notes, paid_at } = req.body;
      const db = require('../config/database');

      if (!amount || amount <= 0) {
        throw new ValidationError('Amount must be greater than 0.');
      }
      if (!paid_at) {
        throw new ValidationError('Payment date (paid_at) is required.');
      }

      const result = db.prepare(`
        INSERT INTO supplier_payments (company_id, supplier_id, purchase_order_id, amount, method, reference_no, notes, paid_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(req.companyId, supplierId, purchase_order_id || null, amount, method || 'cash', reference_no || null, notes || null, paid_at, req.userId);

      const created = db.prepare('SELECT * FROM supplier_payments WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json(ApiResponse.success(created, 'Supplier payment recorded successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async getSupplierPurchaseHistory(req, res, next) {
    try {
      const supplierId = Number(req.params.id);
      const db = require('../config/database');

      const summary = db.prepare(`
        SELECT
          COUNT(id) AS total_orders,
          SUM(total) AS total_amount,
          SUM(CASE WHEN status='received' THEN total ELSE 0 END) AS total_received
        FROM purchase_orders
        WHERE supplier_id = ? AND company_id = ? AND is_deleted = 0
      `).get(supplierId, req.companyId);

      const items = db.prepare(`
        SELECT id, po_no, date, expected_date, total, status
        FROM purchase_orders
        WHERE supplier_id = ? AND company_id = ? AND is_deleted = 0
        ORDER BY date DESC
      `).all(supplierId, req.companyId);

      res.json(ApiResponse.success({
        summary: {
          total_orders: summary.total_orders || 0,
          total_amount: summary.total_amount || 0,
          total_received: summary.total_received || 0,
        },
        items
      }, 'Supplier purchase history fetched successfully.'));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = SupplierController;
