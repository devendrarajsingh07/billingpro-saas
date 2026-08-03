'use strict';

const db = require('../config/database');
const CustomerRepository = require('../repositories/CustomerRepository');
const { NotFoundError, ConflictError } = require('../utils/ApiError');

const customerRepo = new CustomerRepository(db);

class CustomerService {
  static getCustomers(companyId, queryOptions) {
    const { search, page, limit, sort, order, is_active } = queryOptions;

    const filters = {};
    if (is_active !== undefined) {
      filters.is_active = is_active === 'true' ? 1 : 0;
    }

    const customers = customerRepo.findAll({
      companyId,
      search,
      searchFields: ['name', 'email', 'phone', 'gstin'],
      page,
      limit,
      sort,
      order,
      filters,
    });

    const total = customerRepo.count({
      companyId,
      search,
      searchFields: ['name', 'email', 'phone', 'gstin'],
      filters,
    });

    return { customers, total };
  }

  static getCustomerById(id, companyId) {
    const customer = customerRepo.findById(id, companyId);
    if (!customer) {
      throw new NotFoundError('Customer not found.');
    }
    return customer;
  }

  static createCustomer(companyId, data, userId = null) {
    // Check if email already exists in same company
    if (data.email) {
      const exists = customerRepo.exists({ company_id: companyId, email: data.email, is_deleted: 0 });
      if (exists) {
        throw new ConflictError('A customer with this email address already exists.');
      }
    }

    return customerRepo.create({
      ...data,
      company_id: companyId,
      created_by: userId,
      updated_by: userId,
      is_deleted: 0,
      is_active: 1,
    });
  }

  static updateCustomer(id, companyId, data, userId = null) {
    const customer = this.getCustomerById(id, companyId);

    if (data.email && data.email.toLowerCase() !== customer.email?.toLowerCase()) {
      const exists = customerRepo.exists({ company_id: companyId, email: data.email, is_deleted: 0 });
      if (exists) {
        throw new ConflictError('A customer with this email address already exists.');
      }
    }

    return customerRepo.update(id, companyId, {
      ...data,
      updated_by: userId,
    });
  }

  static deleteCustomer(id, companyId) {
    this.getCustomerById(id, companyId);
    return customerRepo.softDelete(id, companyId);
  }
}

module.exports = CustomerService;
