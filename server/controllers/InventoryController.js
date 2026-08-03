'use strict';

const InventoryService = require('../services/InventoryService');
const ApiResponse = require('../utils/ApiResponse');

class InventoryController {
  static async getMovements(req, res, next) {
    try {
      const { page = 1, limit = 20, product_id, type } = req.query;
      const { movements, total } = InventoryService.getMovements(req.companyId, {
        page: Number(page),
        limit: Number(limit),
        product_id,
        type,
      });

      res.json(ApiResponse.paginated(movements, total, page, limit));
    } catch (err) {
      next(err);
    }
  }

  static async getLowStock(req, res, next) {
    try {
      const products = InventoryService.getLowStockProducts(req.companyId);
      res.json(ApiResponse.success(products, 'Low stock products fetched successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async getForecast(req, res, next) {
    try {
      const { lookback_days = 30, horizon_days = 14 } = req.query;
      const result = InventoryService.getStockoutForecast(req.companyId, Number(lookback_days), Number(horizon_days));
      res.json(ApiResponse.success(result, 'Stockout forecast generated successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async createAdjustment(req, res, next) {
    try {
      const product = InventoryService.createAdjustment(req.companyId, req.body, req.userId);
      res.status(201).json(ApiResponse.success(product, 'Stock adjustment recorded successfully.'));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = InventoryController;
