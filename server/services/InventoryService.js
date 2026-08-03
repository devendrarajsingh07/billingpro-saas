'use strict';

const db = require('../config/database');
const InventoryRepository = require('../repositories/InventoryRepository');
const ProductRepository = require('../repositories/ProductRepository');
const { NotFoundError, ValidationError } = require('../utils/ApiError');

const inventoryRepo = new InventoryRepository(db);
const productRepo = new ProductRepository(db);

class InventoryService {
  static getMovements(companyId, queryOptions) {
    const { page, limit, product_id, type } = queryOptions;
    return inventoryRepo.findMovements({
      companyId,
      page,
      limit,
      productId: product_id,
      type,
    });
  }

  static getLowStockProducts(companyId) {
    return productRepo.findLowStock(companyId);
  }

  /**
   * Forecasts which products are on track to run out soon, based on recent
   * sales velocity — not just current stock vs. a fixed threshold. A product
   * selling fast can run out well before it crosses low_stock_threshold, and
   * this catches that case using a simple trailing-average projection
   * (no external AI/ML service required).
   *
   * @param {number} companyId
   * @param {number} lookbackDays - how many days of history to average over
   * @param {number} horizonDays - flag products projected to run out within this many days
   */
  static getStockoutForecast(companyId, lookbackDays = 30, horizonDays = 14) {
    const since = new Date();
    since.setDate(since.getDate() - lookbackDays);
    const sinceStr = since.toISOString();

    const products = db.prepare(`
      SELECT id, name, sku, stock, unit, low_stock_threshold
      FROM products
      WHERE company_id = ? AND is_deleted = 0 AND is_service = 0
    `).all(companyId);

    const velocityStmt = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) AS total_out
      FROM inventory
      WHERE company_id = ? AND product_id = ? AND type = 'out' AND created_at >= ?
    `);

    const forecast = [];
    for (const product of products) {
      const { total_out } = velocityStmt.get(companyId, product.id, sinceStr);
      const dailyVelocity = total_out / lookbackDays;

      if (dailyVelocity <= 0) continue; // no recent sales — nothing to project

      const daysUntilStockout = product.stock / dailyVelocity;
      if (daysUntilStockout <= horizonDays) {
        forecast.push({
          ...product,
          daily_velocity: Math.round(dailyVelocity * 100) / 100,
          days_until_stockout: Math.max(0, Math.round(daysUntilStockout * 10) / 10),
          projected_stockout_date: new Date(Date.now() + daysUntilStockout * 86400000).toISOString().split('T')[0],
        });
      }
    }

    forecast.sort((a, b) => a.days_until_stockout - b.days_until_stockout);

    return { forecast, lookbackDays, horizonDays };
  }

  static createAdjustment(companyId, data, userId = null) {
    const { product_id, type, quantity, reference, notes } = data;

    const product = productRepo.findById(Number(product_id), companyId);
    if (!product) {
      throw new NotFoundError('Product not found.');
    }
    if (product.is_service) {
      throw new ValidationError('Cannot adjust stock for a service item — services are not tracked as inventory.');
    }

    return productRepo.adjustStock(
      Number(product_id),
      companyId,
      quantity,
      type,
      reference || 'Manual Adjustment',
      notes || '',
      userId
    );
  }
}

module.exports = InventoryService;
