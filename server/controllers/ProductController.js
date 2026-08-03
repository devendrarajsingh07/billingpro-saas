'use strict';

const ProductService = require('../services/ProductService');
const ApiResponse = require('../utils/ApiResponse');

class ProductController {
  static async getProducts(req, res, next) {
    try {
      const { search, page = 1, limit = 10, sort = 'name', order = 'asc', is_active, category_id, low_stock } = req.query;
      const { products, total } = ProductService.getProducts(req.companyId, {
        search,
        page: Number(page),
        limit: Number(limit),
        sort,
        order,
        is_active,
        category_id,
        low_stock,
      });

      res.json(ApiResponse.paginated(products, total, page, limit));
    } catch (err) {
      next(err);
    }
  }

  static async getProductById(req, res, next) {
    try {
      const product = ProductService.getProductById(Number(req.params.id), req.companyId);
      res.json(ApiResponse.success(product, 'Product details fetched successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async createProduct(req, res, next) {
    try {
      const product = ProductService.createProduct(req.companyId, req.body, req.userId);
      res.status(201).json(ApiResponse.success(product, 'Product created successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async updateProduct(req, res, next) {
    try {
      const product = ProductService.updateProduct(Number(req.params.id), req.companyId, req.body, req.userId);
      res.json(ApiResponse.success(product, 'Product updated successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async deleteProduct(req, res, next) {
    try {
      ProductService.deleteProduct(Number(req.params.id), req.companyId);
      res.json(ApiResponse.success(null, 'Product deleted successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async adjustStock(req, res, next) {
    try {
      const adjusted = ProductService.adjustStock(Number(req.params.id), req.companyId, req.body, req.userId);
      res.json(ApiResponse.success(adjusted, 'Stock adjusted successfully.'));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ProductController;
