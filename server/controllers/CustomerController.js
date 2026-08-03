'use strict';

const CustomerService = require('../services/CustomerService');
const ApiResponse = require('../utils/ApiResponse');
const { NotFoundError } = require('../utils/ApiError');

class CustomerController {
  static async getCustomers(req, res, next) {
    try {
      const { search, page = 1, limit = 10, sort = 'name', order = 'asc', is_active } = req.query;
      const { customers, total } = CustomerService.getCustomers(req.companyId, {
        search,
        page: Number(page),
        limit: Number(limit),
        sort,
        order,
        is_active,
      });

      res.json(ApiResponse.paginated(customers, total, page, limit));
    } catch (err) {
      next(err);
    }
  }

  static async getCustomerById(req, res, next) {
    try {
      const customer = CustomerService.getCustomerById(Number(req.params.id), req.companyId);
      res.json(ApiResponse.success(customer, 'Customer details fetched successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async createCustomer(req, res, next) {
    try {
      const customer = CustomerService.createCustomer(req.companyId, req.body, req.userId);
      res.status(201).json(ApiResponse.success(customer, 'Customer created successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async updateCustomer(req, res, next) {
    try {
      const customer = CustomerService.updateCustomer(Number(req.params.id), req.companyId, req.body, req.userId);
      res.json(ApiResponse.success(customer, 'Customer updated successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async deleteCustomer(req, res, next) {
    try {
      CustomerService.deleteCustomer(Number(req.params.id), req.companyId);
      res.json(ApiResponse.success(null, 'Customer deleted successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async getCustomerStatement(req, res, next) {
    try {
      const customerId = Number(req.params.id);
      const db = require('../config/database');
      const PDFService = require('../services/PDFService');

      // Fetch customer
      const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND company_id = ?').get(customerId, req.companyId);
      if (!customer) throw new NotFoundError('Customer not found.');

      // Fetch company
      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.companyId);

      // Fetch all invoices for customer (non-deleted)
      const invoices = db.prepare('SELECT * FROM invoices WHERE customer_id = ? AND company_id = ? AND is_deleted = 0').all(customerId, req.companyId);

      // Fetch all payments for customer (via invoices)
      const payments = db.prepare(`
        SELECT p.*
        FROM payments p
        JOIN invoices i ON i.id = p.invoice_id
        WHERE i.customer_id = ? AND i.company_id = ? AND i.is_deleted = 0
      `).all(customerId, req.companyId);

      const pdfBuffer = await PDFService.generateStatementPDF(customer, invoices, payments, company);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=statement-${customer.name.replace(/\s+/g, '_')}.pdf`);
      res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }

  static async getCustomerPurchaseHistory(req, res, next) {
    try {
      const customerId = Number(req.params.id);
      const db = require('../config/database');

      // Summarize total amount invoiced, paid, and outstanding items
      const summary = db.prepare(`
        SELECT
          COUNT(id) AS total_invoices,
          SUM(grand_total) AS total_billed,
          SUM(amount_paid) AS total_paid,
          SUM(amount_due) AS total_due
        FROM invoices
        WHERE customer_id = ? AND company_id = ? AND is_deleted = 0
      `).get(customerId, req.companyId);

      const items = db.prepare(`
        SELECT i.id, i.invoice_no, i.date, i.due_date, i.grand_total, i.amount_paid, i.amount_due, i.status
        FROM invoices i
        WHERE i.customer_id = ? AND i.company_id = ? AND i.is_deleted = 0
        ORDER BY i.date DESC
      `).all(customerId, req.companyId);

      res.json(ApiResponse.success({
        summary: {
          total_invoices: summary.total_invoices || 0,
          total_billed: summary.total_billed || 0,
          total_paid: summary.total_paid || 0,
          total_due: summary.total_due || 0,
        },
        items
      }, 'Customer purchase history fetched successfully.'));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CustomerController;
