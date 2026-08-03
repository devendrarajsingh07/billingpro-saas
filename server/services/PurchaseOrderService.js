'use strict';

const db = require('../config/database');
const PurchaseOrderRepository = require('../repositories/PurchaseOrderRepository');
const CompanyRepository = require('../repositories/CompanyRepository');
const { NotFoundError, ValidationError } = require('../utils/ApiError');
const eventBus = require('../events/eventBus');

const poRepo = new PurchaseOrderRepository(db);
const companyRepo = new CompanyRepository(db);

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const VALID_TRANSITIONS = {
  draft: ['sent', 'cancelled'],
  sent: ['received', 'cancelled'],
  received: ['cancelled'],
  cancelled: [],
};

class PurchaseOrderService {
  static getPurchaseOrders(companyId, queryOptions) {
    const { search, page, limit, sort, order, status, supplier_id } = queryOptions;

    const filters = {};
    if (status) filters.status = status;
    if (supplier_id) filters.supplier_id = Number(supplier_id);

    const purchaseOrders = poRepo.findAll({
      companyId,
      search,
      searchFields: ['po_no', 'notes'],
      page,
      limit,
      sort,
      order,
      filters,
    });

    const total = poRepo.count({
      companyId,
      search,
      searchFields: ['po_no', 'notes'],
      filters,
    });

    const getSupplier = db.prepare('SELECT name FROM suppliers WHERE id = ?');
    for (const po of purchaseOrders) {
      const supplier = po.supplier_id ? getSupplier.get(po.supplier_id) : null;
      po.supplier_name = supplier ? supplier.name : 'Unknown Supplier';
    }

    return { purchaseOrders, total };
  }

  static getPurchaseOrderById(id, companyId) {
    const po = poRepo.findByIdWithDetails(id, companyId);
    if (!po) {
      throw new NotFoundError('Purchase order not found.');
    }
    return po;
  }

  static createPurchaseOrder(companyId, data, userId = null) {
    const { items, ...poFields } = data;

    if (!items || items.length === 0) {
      throw new ValidationError('Purchase order must contain at least one line item.');
    }

    const company = companyRepo.findById(companyId);
    if (!company) throw new NotFoundError('Company not found.');

    if (poFields.supplier_id) {
      const supplier = db.prepare('SELECT id FROM suppliers WHERE id = ? AND company_id = ? AND is_deleted = 0')
        .get(poFields.supplier_id, companyId);
      if (!supplier) {
        throw new ValidationError('Selected supplier does not exist in this company.');
      }
    }

    const getProduct = db.prepare('SELECT id FROM products WHERE id = ? AND company_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)');
    for (const item of items) {
      if (item.product_id) {
        const product = getProduct.get(item.product_id, companyId);
        if (!product) {
          throw new ValidationError(`Product with ID ${item.product_id} does not exist in this company.`);
        }
      }
    }

    // Recompute totals server-side from the line items — never trust
    // client-supplied subtotal/tax_amount/total (same lesson as invoices).
    let subtotal = 0;
    let taxAmount = 0;

    const computedItems = items.map((item) => {
      const qty = Number(item.qty) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const taxRate = Number(item.tax_rate) || 0;
      const lineBase = qty * unitPrice;
      const lineTax = lineBase * (taxRate / 100);

      subtotal += lineBase;
      taxAmount += lineTax;

      return {
        ...item,
        qty,
        unit_price: unitPrice,
        tax_rate: taxRate,
        tax_amount: round2(lineTax),
        total: round2(lineBase + lineTax),
      };
    });

    const total = round2(subtotal + taxAmount);

    const poId = poRepo.createPOWithItems(
      {
        ...poFields,
        company_id: companyId,
        status: 'draft',
        subtotal: round2(subtotal),
        tax_amount: round2(taxAmount),
        total,
      },
      computedItems,
      userId
    );

    const createdPO = poRepo.findByIdWithDetails(poId, companyId);
    eventBus.emit('purchase_order.created', { purchaseOrder: createdPO, user_id: userId });

    return createdPO;
  }

  static updatePurchaseOrderStatus(id, companyId, status, userId = null) {
    const po = this.getPurchaseOrderById(id, companyId);

    const allowedNext = VALID_TRANSITIONS[po.status] || [];
    if (po.status !== status && !allowedNext.includes(status)) {
      throw new ValidationError(`Cannot change purchase order status from '${po.status}' to '${status}'.`);
    }

    const updated = poRepo.updatePOStatus(id, companyId, status, userId);
    eventBus.emit('purchase_order.status_changed', { purchaseOrder: updated, user_id: userId });

    return updated;
  }

  static deletePurchaseOrder(id, companyId) {
    const po = this.getPurchaseOrderById(id, companyId);

    if (['sent', 'received'].includes(po.status)) {
      throw new ValidationError('Cannot delete a sent or received purchase order. Cancel it first to preserve its audit trail and reverse stock when needed.');
    }

    return poRepo.softDelete(id, companyId);
  }
}

module.exports = PurchaseOrderService;
