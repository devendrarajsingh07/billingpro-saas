'use strict';

const PurchaseOrderService = require('../services/PurchaseOrderService');
const ApiResponse = require('../utils/ApiResponse');

class PurchaseOrderController {
  static async getPurchaseOrders(req, res, next) {
    try {
      const { search, page = 1, limit = 10, sort = 'created_at', order = 'desc', status, supplier_id } = req.query;
      const { purchaseOrders, total } = PurchaseOrderService.getPurchaseOrders(req.companyId, {
        search,
        page: Number(page),
        limit: Number(limit),
        sort,
        order,
        status,
        supplier_id,
      });

      res.json(ApiResponse.paginated(purchaseOrders, total, page, limit));
    } catch (err) {
      next(err);
    }
  }

  static async getPurchaseOrderById(req, res, next) {
    try {
      const po = PurchaseOrderService.getPurchaseOrderById(Number(req.params.id), req.companyId);
      res.json(ApiResponse.success(po, 'Purchase order details fetched successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async createPurchaseOrder(req, res, next) {
    try {
      const po = PurchaseOrderService.createPurchaseOrder(req.companyId, req.body, req.userId);
      res.status(201).json(ApiResponse.success(po, 'Purchase order created successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async updateStatus(req, res, next) {
    try {
      const { status } = req.body;
      const po = PurchaseOrderService.updatePurchaseOrderStatus(Number(req.params.id), req.companyId, status, req.userId);
      res.json(ApiResponse.success(po, `Purchase order status updated to ${status} successfully.`));
    } catch (err) {
      next(err);
    }
  }

  static async deletePurchaseOrder(req, res, next) {
    try {
      PurchaseOrderService.deletePurchaseOrder(Number(req.params.id), req.companyId);
      res.json(ApiResponse.success(null, 'Purchase order deleted successfully.'));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = PurchaseOrderController;
