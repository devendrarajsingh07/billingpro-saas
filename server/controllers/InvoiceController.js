'use strict';

const InvoiceService = require('../services/InvoiceService');
const PDFService = require('../services/PDFService');
const ApiResponse = require('../utils/ApiResponse');

class InvoiceController {
  static async getInvoices(req, res, next) {
    try {
      const { search, page = 1, limit = 10, sort = 'created_at', order = 'desc', status, customer_id, from_date, to_date } = req.query;
      const { invoices, total } = InvoiceService.getInvoices(req.companyId, {
        search,
        page: Number(page),
        limit: Number(limit),
        sort,
        order,
        status,
        customer_id,
        from_date,
        to_date,
      });

      res.json(ApiResponse.paginated(invoices, total, page, limit));
    } catch (err) {
      next(err);
    }
  }

  static async getInvoiceById(req, res, next) {
    try {
      const invoice = InvoiceService.getInvoiceById(Number(req.params.id), req.companyId);
      res.json(ApiResponse.success(invoice, 'Invoice details fetched successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async createInvoice(req, res, next) {
    try {
      const invoice = InvoiceService.createInvoice(req.companyId, req.body, req.userId);
      res.status(201).json(ApiResponse.success(invoice, 'Invoice created successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async updateInvoiceStatus(req, res, next) {
    try {
      const { status } = req.body;
      const invoice = InvoiceService.updateInvoiceStatus(Number(req.params.id), req.companyId, status, req.userId);
      res.json(ApiResponse.success(invoice, `Invoice status updated to ${status} successfully.`));
    } catch (err) {
      next(err);
    }
  }

  static async deleteInvoice(req, res, next) {
    try {
      InvoiceService.deleteInvoice(Number(req.params.id), req.companyId);
      res.json(ApiResponse.success(null, 'Invoice deleted successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async duplicateInvoice(req, res, next) {
    try {
      const invoice = await InvoiceService.duplicateInvoice(Number(req.params.id), req.companyId, req.userId);
      res.status(201).json(ApiResponse.success(invoice, 'Invoice duplicated as a new draft.'));
    } catch (err) {
      next(err);
    }
  }

  static async sendInvoice(req, res, next) {
    try {
      const channel = req.body?.channel || 'email';
      const { invoice, emailSkipped } = await InvoiceService.sendInvoiceEmail(Number(req.params.id), req.companyId, req.userId, channel);
      const channelLabel = channel === 'whatsapp' ? 'WhatsApp' : channel === 'sms' ? 'SMS' : 'email';
      const message = emailSkipped
        ? `Invoice was not marked as sent because ${channelLabel} delivery is not configured.`
        : `Invoice sent to the customer via ${channelLabel} successfully.`;
      res.json(ApiResponse.success(invoice, message));
    } catch (err) {
      next(err);
    }
  }

  static async downloadPDF(req, res, next) {
    try {
      const invoice = InvoiceService.getInvoiceById(Number(req.params.id), req.companyId);
      
      // Load company profile details to pass to pdf generator
      const db = require('../config/database');
      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.companyId);
      
      const enrichedInvoice = {
        ...invoice,
        company_name: company.name,
        company_address: company.address,
        company_city: company.city,
        company_state: company.state,
        company_postal: company.postal_code,
        company_email: company.email,
        company_gstin: company.gst_number,
      };

      const pdfBuffer = await PDFService.generateInvoicePDF(enrichedInvoice);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Invoice-${invoice.invoice_no}.pdf`);
      res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = InvoiceController;
