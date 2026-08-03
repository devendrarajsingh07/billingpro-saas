'use strict';

const db = require('../config/database');
const SupplierRepository = require('../repositories/SupplierRepository');
const { NotFoundError, ConflictError, ValidationError } = require('../utils/ApiError');

const supplierRepo = new SupplierRepository(db);

class SupplierService {
  static getSuppliers(companyId, queryOptions) {
    const { search, page, limit, sort, order, is_active } = queryOptions;

    const filters = {};
    if (is_active !== undefined) {
      filters.is_active = is_active === 'true' ? 1 : 0;
    }

    const suppliers = supplierRepo.findAll({
      companyId,
      search,
      searchFields: ['name', 'email', 'phone', 'gstin'],
      page,
      limit,
      sort,
      order,
      filters,
    });

    const total = supplierRepo.count({
      companyId,
      search,
      searchFields: ['name', 'email', 'phone', 'gstin'],
      filters,
    });

    return { suppliers, total };
  }

  static getSupplierById(id, companyId) {
    const supplier = supplierRepo.findById(id, companyId);
    if (!supplier) {
      throw new NotFoundError('Supplier not found.');
    }
    return supplier;
  }

  static createSupplier(companyId, data, userId = null) {
    if (data.email) {
      const exists = supplierRepo.exists({ company_id: companyId, email: data.email, is_deleted: 0 });
      if (exists) {
        throw new ConflictError('A supplier with this email address already exists.');
      }
    }

    return supplierRepo.create({
      ...data,
      company_id: companyId,
      is_deleted: 0,
      is_active: 1,
    });
  }

  static updateSupplier(id, companyId, data, userId = null) {
    const supplier = this.getSupplierById(id, companyId);

    if (data.email && data.email.toLowerCase() !== supplier.email?.toLowerCase()) {
      const exists = supplierRepo.exists({ company_id: companyId, email: data.email, is_deleted: 0 });
      if (exists) {
        throw new ConflictError('A supplier with this email address already exists.');
      }
    }

    return supplierRepo.update(id, companyId, data);
  }

  static deleteSupplier(id, companyId) {
    this.getSupplierById(id, companyId);

    // Guard: don't allow deleting a supplier that still has purchase orders,
    // mirroring how the rest of the app protects referential integrity.
    const poCount = db.prepare(`
      SELECT COUNT(*) as count FROM purchase_orders
      WHERE supplier_id = ? AND company_id = ? AND is_deleted = 0
    `).get(id, companyId).count;

    if (poCount > 0) {
      throw new ValidationError('Cannot delete a supplier with existing purchase orders. Deactivate it instead.');
    }

    return supplierRepo.softDelete(id, companyId);
  }
}

module.exports = SupplierService;
