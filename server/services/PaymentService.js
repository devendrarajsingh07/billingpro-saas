'use strict';

const db = require('../config/database');
const PaymentRepository = require('../repositories/PaymentRepository');
const { NotFoundError } = require('../utils/ApiError');
const eventBus = require('../events/eventBus');

const paymentRepo = new PaymentRepository(db);

class PaymentService {
  static getPayments(companyId, queryOptions) {
    const { search, page, limit, sort, order, invoice_id } = queryOptions;

    const filters = {};
    if (invoice_id) filters.invoice_id = Number(invoice_id);

    const payments = paymentRepo.findAll({
      companyId,
      search,
      searchFields: ['reference_no', 'notes', 'method'],
      page,
      limit,
      sort,
      order,
      filters,
    });

    const total = paymentRepo.count({
      companyId,
      search,
      searchFields: ['reference_no', 'notes', 'method'],
      filters,
    });

    // Enrich in one query instead of querying once per payment.
    const invoiceIds = [...new Set(payments.map((payment) => payment.invoice_id).filter(Boolean))];
    if (invoiceIds.length > 0) {
      const placeholders = invoiceIds.map(() => '?').join(', ');
      const invoices = db.prepare(`
        SELECT id, invoice_no FROM invoices
        WHERE company_id = ? AND id IN (${placeholders})
      `).all(companyId, ...invoiceIds);
      const invoiceNumbers = new Map(invoices.map((invoice) => [invoice.id, invoice.invoice_no]));
      for (const payment of payments) {
        payment.invoice_no = invoiceNumbers.get(payment.invoice_id) || 'Unknown';
      }
    }

    return { payments, total };
  }

  static getPaymentById(id, companyId) {
    const payment = paymentRepo.findById(id, companyId);
    if (!payment) {
      throw new NotFoundError('Payment not found.');
    }
    return payment;
  }

  static createPayment(companyId, data, userId = null) {
    const { date, paid_at, amount, ...rest } = data;

    const payment = paymentRepo.recordPayment(
      {
        ...rest,
        amount: Number(amount),
        // The payments table column is `paid_at`; the client form field is `date`.
        // Accept whichever was supplied, defaulting to now.
        paid_at: paid_at || date || new Date().toISOString(),
        company_id: companyId,
      },
      userId
    );

    eventBus.emit('payment.recorded', { payment, user_id: userId });

    return payment;
  }
}

module.exports = PaymentService;
