'use strict';

const ReportService = require('../services/ReportService');
const ApiResponse = require('../utils/ApiResponse');

class ReportController {
  static async getDashboard(req, res, next) {
    try {
      const summary = ReportService.getDashboardSummary(req.companyId);
      res.json(ApiResponse.success(summary, 'Dashboard analytics fetched successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async getProfitLoss(req, res, next) {
    try {
      const { from_date, to_date } = req.query;
      if (!from_date || !to_date) {
        return res.status(400).json({ success: false, message: 'Both from_date and to_date are required parameters.' });
      }

      const report = ReportService.getProfitLoss(req.companyId, from_date, to_date);
      res.json(ApiResponse.success(report, 'Profit and Loss report generated successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async getTaxReport(req, res, next) {
    try {
      const { from_date, to_date } = req.query;
      if (!from_date || !to_date) {
        return res.status(400).json({ success: false, message: 'Both from_date and to_date are required parameters.' });
      }

      const report = ReportService.getTaxReport(req.companyId, from_date, to_date);
      res.json(ApiResponse.success(report, 'Tax report generated successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async getSupplierSpend(req, res, next) {
    try {
      const { from_date, to_date } = req.query;
      if (!from_date || !to_date) {
        return res.status(400).json({ success: false, message: 'Both from_date and to_date are required parameters.' });
      }

      const report = ReportService.getSupplierSpend(req.companyId, from_date, to_date);
      res.json(ApiResponse.success(report, 'Supplier spend report generated successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async getInventoryValuation(req, res, next) {
    try {
      const report = ReportService.getInventoryValuation(req.companyId);
      res.json(ApiResponse.success(report, 'Inventory valuation report generated successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async getPOAging(req, res, next) {
    try {
      const report = ReportService.getPOAging(req.companyId);
      res.json(ApiResponse.success(report, 'Purchase order aging report generated successfully.'));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ReportController;
