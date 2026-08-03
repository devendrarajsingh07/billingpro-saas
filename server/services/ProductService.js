'use strict';

const db = require('../config/database');
const ProductRepository = require('../repositories/ProductRepository');
const { NotFoundError, ConflictError } = require('../utils/ApiError');

const productRepo = new ProductRepository(db);

class ProductService {
  static getProducts(companyId, queryOptions) {
    const { search, page, limit, sort, order, is_active, category_id, low_stock } = queryOptions;

    const filters = {};
    if (is_active !== undefined) {
      filters.is_active = is_active === 'true' ? 1 : 0;
    }
    if (category_id !== undefined) {
      filters.category_id = Number(category_id);
    }

    if (low_stock === 'true') {
      const products = productRepo.findLowStock(companyId);
      return { products, total: products.length };
    }

    const products = productRepo.findAll({
      companyId,
      search,
      searchFields: ['name', 'sku', 'barcode', 'description'],
      page,
      limit,
      sort,
      order,
      filters,
    });

    const total = productRepo.count({
      companyId,
      search,
      searchFields: ['name', 'sku', 'barcode', 'description'],
      filters,
    });

    return { products, total };
  }

  static getProductById(id, companyId) {
    const product = productRepo.findById(id, companyId);
    if (!product) {
      throw new NotFoundError('Product not found.');
    }
    return product;
  }

  static createProduct(companyId, data, userId = null) {
    // Check SKU unique
    if (data.sku) {
      const exists = productRepo.exists({ company_id: companyId, sku: data.sku, is_deleted: 0 });
      if (exists) {
        throw new ConflictError('A product with this SKU already exists.');
      }
    }

    return productRepo.create({
      ...data,
      company_id: companyId,
      created_by: userId,
      updated_by: userId,
      is_deleted: 0,
      is_active: 1,
    });
  }

  static updateProduct(id, companyId, data, userId = null) {
    const product = this.getProductById(id, companyId);

    if (data.sku && data.sku.toLowerCase() !== product.sku?.toLowerCase()) {
      const exists = productRepo.exists({ company_id: companyId, sku: data.sku, is_deleted: 0 });
      if (exists) {
        throw new ConflictError('A product with this SKU already exists.');
      }
    }

    return productRepo.update(id, companyId, {
      ...data,
      updated_by: userId,
    });
  }

  static deleteProduct(id, companyId) {
    this.getProductById(id, companyId);
    return productRepo.softDelete(id, companyId);
  }

  static adjustStock(id, companyId, { quantity, type, reference, notes }, userId = null) {
    this.getProductById(id, companyId);
    return productRepo.adjustStock(id, companyId, quantity, type, reference, notes, userId);
  }
}

module.exports = ProductService;
