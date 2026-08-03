'use strict';

const db = require('../config/database');
const InvoiceRepository = require('../repositories/InvoiceRepository');
const CompanyRepository = require('../repositories/CompanyRepository');
const { NotFoundError, ValidationError } = require('../utils/ApiError');
const eventBus = require('../events/eventBus');

const invoiceRepo = new InvoiceRepository(db);
const companyRepo = new CompanyRepository(db);

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

class InvoiceService {
  static getInvoices(companyId, queryOptions) {
    const { search, page, limit, sort, order, status, customer_id, from_date, to_date } = queryOptions;

    const filters = {};
    if (status) filters.status = status;
    if (customer_id) filters.customer_id = Number(customer_id);

    // Date range is handled manually if present, otherwise BaseRepository findAll does exact matches.
    // For advanced reports with date ranges, let's write custom filter if needed, or query raw.
    // Since we want this to be enterprise-grade, let's make sure it handles date ranges:
    let invoices, total;
    if (from_date || to_date) {
      let query = `SELECT * FROM invoices WHERE company_id = ? AND is_deleted = 0`;
      const params = [companyId];

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }
      if (customer_id) {
        query += ' AND customer_id = ?';
        params.push(customer_id);
      }
      if (from_date) {
        query += ' AND date >= ?';
        params.push(from_date);
      }
      if (to_date) {
        query += ' AND date <= ?';
        params.push(to_date);
      }

      const countRow = db.prepare(`SELECT COUNT(*) as total FROM (${query})`).get(...params);
      total = countRow ? countRow.total : 0;

      const ALLOWED_SORT = new Set(['created_at', 'date', 'due_date', 'grand_total', 'invoice_no', 'status', 'amount_due']);
      const safeSort = ALLOWED_SORT.has(sort) ? sort : 'created_at';
      const safeOrd = order === 'asc' ? 'ASC' : 'DESC';
      const offset = (Number(page) - 1) * Number(limit);
      query += ` ORDER BY ${safeSort} ${safeOrd} LIMIT ? OFFSET ?`;

      invoices = db.prepare(query).all(...params, Number(limit), offset);
    } else {
      invoices = invoiceRepo.findAll({
        companyId,
        search,
        searchFields: ['invoice_no', 'notes'],
        page,
        limit,
        sort,
        order,
        filters,
      });

      total = invoiceRepo.count({
        companyId,
        search,
        searchFields: ['invoice_no', 'notes'],
        filters,
      });
    }

    // Enrich invoices with customer details via a single batch query (avoids N+1)
    if (invoices.length > 0) {
      const customerIds = [...new Set(invoices.map(inv => inv.customer_id).filter(Boolean))];
      const placeholders = customerIds.map(() => '?').join(',');
      const customers = db.prepare(
        `SELECT id, name, phone FROM customers WHERE id IN (${placeholders})`
      ).all(...customerIds);
      const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));
      for (const inv of invoices) {
        const cust = customerMap[inv.customer_id];
        inv.customer_name = cust ? cust.name : 'Unknown Customer';
        inv.customer_phone = cust ? cust.phone : null;
      }
    }

    return { invoices, total };
  }

  static getInvoiceById(id, companyId) {
    const invoice = invoiceRepo.findByIdWithDetails(id, companyId);
    if (!invoice) {
      throw new NotFoundError('Invoice not found.');
    }
    return invoice;
  }

  static createInvoice(companyId, data, userId = null) {
    const { items, ...invoiceFields } = data;

    if (!items || items.length === 0) {
      throw new ValidationError('Invoice must contain at least one line item.');
    }

    // Get company prefix & settings
    const company = companyRepo.findById(companyId);
    if (!company) throw new NotFoundError('Company not found.');

    // Verify customer belongs to this company
    const customer = db.prepare('SELECT id FROM customers WHERE id = ? AND company_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)').get(invoiceFields.customer_id, companyId);
    if (!customer) {
      throw new ValidationError('Selected customer does not exist in this company.');
    }

    // Verify all products belong to this company
    const getProduct = db.prepare('SELECT id FROM products WHERE id = ? AND company_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)');
    for (const item of items) {
      if (item.product_id) {
        const product = getProduct.get(item.product_id, companyId);
        if (!product) {
          throw new ValidationError(`Product with ID ${item.product_id} does not exist in this company.`);
        }
      }
    }

    // ── Recompute all money fields server-side. ────────────────────────
    // Never trust client-supplied subtotal/tax_amount/grand_total: a client
    // (buggy or malicious) could otherwise set an arbitrary grand_total that
    // doesn't match the actual line items.
    let subtotal = 0;
    const preparedItems = items.map((item) => {
      const qty = Number(item.qty) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const taxRate = Number(item.tax_rate) || 0;
      const lineBase = qty * unitPrice;
      const itemDiscount = Math.min(Math.max(0, Number(item.discount) || 0), lineBase);
      const lineNet = lineBase - itemDiscount;

      subtotal += lineNet;

      return {
        ...item,
        // invoice_items.description is NOT NULL, but not every caller
        // supplies one — sales-order line items, for instance, are keyed
        // by `name` with an optional `description`. Fall back rather than
        // let the insert crash with a constraint violation.
        description: item.description || item.name || '',
        qty,
        unit_price: unitPrice,
        discount: round2(itemDiscount),
        tax_rate: taxRate,
        lineNet,
      };
    });

    const discountType = invoiceFields.discount_type === 'percentage' ? 'percentage' : 'amount';
    const discountValue = Number(invoiceFields.discount_value) || 0;
    const requestedDiscount = discountType === 'percentage'
      ? subtotal * (discountValue / 100)
      : discountValue;
    const discountAmount = Math.min(Math.max(0, requestedDiscount), subtotal);

    // Allocate the invoice-level discount over line items before calculating
    // tax, so mixed tax rates remain accurate and the line totals add up.
    let taxAmount = 0;
    const computedItems = preparedItems.map(({ lineNet, ...item }) => {
      const allocatedDiscount = subtotal > 0 ? discountAmount * (lineNet / subtotal) : 0;
      const taxableAmount = Math.max(0, lineNet - allocatedDiscount);
      const lineTax = taxableAmount * (item.tax_rate / 100);
      taxAmount += lineTax;
      return {
        ...item,
        tax_amount: round2(lineTax),
        total: round2(taxableAmount + lineTax),
      };
    });

    const shippingCharges = Number(invoiceFields.shipping_charges) || 0;
    const adjustment = Number(invoiceFields.adjustment) || 0;
    const grandTotal = Math.max(0, subtotal - discountAmount + taxAmount + shippingCharges + adjustment);

    const invoiceId = invoiceRepo.createInvoiceWithItems(
      {
        ...invoiceFields,
        company_id: companyId,
        subtotal: round2(subtotal),
        discount_type: discountType,
        discount_value: discountValue,
        discount_amount: round2(discountAmount),
        tax_amount: round2(taxAmount),
        shipping_charges: shippingCharges,
        adjustment,
        grand_total: round2(grandTotal),
        amount_due: round2(grandTotal),
        amount_paid: 0,
      },
      computedItems,
      userId
    );

    const createdInvoice = invoiceRepo.findByIdWithDetails(invoiceId, companyId);
    
    // Emit event
    eventBus.emit('invoice.created', { invoice: createdInvoice, user_id: userId });

    return createdInvoice;
  }

  static updateInvoiceStatus(id, companyId, status, userId = null) {
    const updated = invoiceRepo.updateInvoiceStatus(id, companyId, status, userId);
    if (!updated) {
      throw new NotFoundError('Invoice not found.');
    }

    // Emit event if paid
    if (status === 'paid') {
      eventBus.emit('invoice.paid', { invoice: updated, user_id: userId });
    }

    return updated;
  }

  static deleteInvoice(id, companyId) {
    this.getInvoiceById(id, companyId);
    return invoiceRepo.softDelete(id, companyId);
  }

  /**
   * Clone an invoice as a new draft. Copies all line items; resets
   * payment fields, generates a fresh invoice number, and sets today as date.
   */
  static duplicateInvoice(id, companyId, userId = null) {
    const source = this.getInvoiceById(id, companyId);

    const sourceItems = db.prepare(
      `SELECT * FROM invoice_items WHERE invoice_id = ?`
    ).all(source.id);

    // Route cloned data through createInvoice so totals, tax and item data are
    // recalculated exactly as they are for a newly submitted invoice.
    return this.createInvoice(companyId, {
      customer_id:      source.customer_id,
      date:             new Date().toISOString().split('T')[0],
      due_date:         null,
      status:           'draft',
      currency_code:    source.currency_code,
      exchange_rate:    source.exchange_rate,
      discount_type:    source.discount_type,
      discount_value:   source.discount_value,
      shipping_charges: source.shipping_charges,
      adjustment:       source.adjustment,
      notes:            source.notes,
      terms_conditions: source.terms_conditions,
      template:         source.template,
      items: sourceItems.map((item) => ({
        product_id:   item.product_id,
        description:  item.description,
        qty:          item.qty,
        unit_price:   item.unit_price,
        discount:     item.discount,
        tax_rate:     item.tax_rate,
      })),
    }, userId);
  }

  /**
   * Delivers an invoice to the customer over the requested channel and marks
   * it sent. Email attaches the actual PDF; WhatsApp/SMS send a text summary
   * (see SmsService for why — Twilio needs a public media URL for
   * attachments, which this project doesn't have).
   */
  static async sendInvoiceEmail(id, companyId, userId = null, channel = 'email') {
    const invoice = this.getInvoiceById(id, companyId);
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);

    let mailResult = { skipped: false };

    if (channel === 'whatsapp' || channel === 'sms') {
      if (!invoice.customer_phone) {
        throw new ValidationError('This customer has no phone number on file — add one before sending.');
      }
      const SmsService = require('./SmsService');
      mailResult = channel === 'whatsapp'
        ? await SmsService.sendInvoiceWhatsApp(invoice.customer_phone, invoice, company?.name)
        : await SmsService.sendInvoiceSms(invoice.customer_phone, invoice, company?.name);
    } else {
      if (!invoice.customer_email) {
        throw new ValidationError('This customer has no email address on file — add one before sending.');
      }

      const PDFService = require('./PDFService');
      const MailerService = require('./MailerService');

      const enrichedInvoice = {
        ...invoice,
        company_name: company.name,
        company_address: company.address,
        company_city: company.city,
        company_state: company.state,
        company_postal: company.postal_code,
        company_email: company.email,
        company_gstin: company.gst_number,
        company_upi_id: company.upi_id || null,  // used for payment QR code
      };

      const pdfBuffer = await PDFService.generateInvoicePDF(enrichedInvoice);
      mailResult = await MailerService.sendInvoiceEmail(invoice, pdfBuffer);
    }

    if (mailResult?.skipped) {
      return { invoice, emailSkipped: true };
    }

    let updated = invoice;
    if (invoice.status === 'draft' || invoice.status === 'pending') {
      updated = invoiceRepo.updateInvoiceStatus(id, companyId, 'sent', userId);
    } else {
      invoiceRepo.update(id, companyId, { sent_at: new Date().toISOString() });
      updated = this.getInvoiceById(id, companyId);
    }

    return { invoice: updated, emailSkipped: Boolean(mailResult?.skipped) };
  }
}

module.exports = InvoiceService;
