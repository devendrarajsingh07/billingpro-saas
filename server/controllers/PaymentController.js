'use strict';

const PaymentService = require('../services/PaymentService');
const ApiResponse = require('../utils/ApiResponse');

class PaymentController {
  static async getPayments(req, res, next) {
    try {
      const { search, page = 1, limit = 10, sort = 'paid_at', order = 'desc', invoice_id } = req.query;
      const { payments, total } = PaymentService.getPayments(req.companyId, {
        search,
        page: Number(page),
        limit: Number(limit),
        sort,
        order,
        invoice_id,
      });

      res.json(ApiResponse.paginated(payments, total, page, limit));
    } catch (err) {
      next(err);
    }
  }

  static async getPaymentById(req, res, next) {
    try {
      const payment = PaymentService.getPaymentById(Number(req.params.id), req.companyId);
      res.json(ApiResponse.success(payment, 'Payment record fetched successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async createPayment(req, res, next) {
    try {
      const payment = PaymentService.createPayment(req.companyId, req.body, req.userId);
      res.status(201).json(ApiResponse.success(payment, 'Payment recorded successfully.'));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = PaymentController;
