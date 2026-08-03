'use strict';

const express = require('express');
const router = express.Router();
const ReportController = require('../../controllers/ReportController');
const authenticate = require('../../middleware/authenticate').authenticate;
const authorize = require('../../middleware/authorize').authorize;

router.use(authenticate);

/**
 * @swagger
 * /api/v1/reports/dashboard:
 *   get:
 *     tags: [Reports]
 *     summary: Dashboard KPIs (revenue, outstanding, pending invoices, low stock, etc.)
 *     responses:
 *       200: { description: KPI summary, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.get('/dashboard', authorize('reports.read'), ReportController.getDashboard);

/**
 * @swagger
 * /api/v1/reports/profit-loss:
 *   get:
 *     tags: [Reports]
 *     summary: Profit & loss statement for a date range
 *     parameters:
 *       - in: query
 *         name: from_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to_date
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: P&L report, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.get('/profit-loss', authorize('reports.read'), ReportController.getProfitLoss);

/**
 * @swagger
 * /api/v1/reports/tax:
 *   get:
 *     tags: [Reports]
 *     summary: Tax collected breakdown for a date range
 *     parameters:
 *       - in: query
 *         name: from_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to_date
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: Tax report with a `taxes` breakdown array, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.get('/tax', authorize('reports.read'), ReportController.getTaxReport);

/**
 * @swagger
 * /api/v1/reports/supplier-spend:
 *   get:
 *     tags: [Reports]
 *     summary: Spend breakdown by supplier
 *     responses:
 *       200: { description: Supplier spend report, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.get('/supplier-spend', authorize('reports.read'), ReportController.getSupplierSpend);

/**
 * @swagger
 * /api/v1/reports/inventory-valuation:
 *   get:
 *     tags: [Reports]
 *     summary: Current inventory value (stock quantity × cost) across all products
 *     responses:
 *       200: { description: Inventory valuation report, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.get('/inventory-valuation', authorize('reports.read'), ReportController.getInventoryValuation);

/**
 * @swagger
 * /api/v1/reports/po-aging:
 *   get:
 *     tags: [Reports]
 *     summary: Purchase order aging report (how long POs have been outstanding)
 *     responses:
 *       200: { description: PO aging report, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.get('/po-aging', authorize('reports.read'), ReportController.getPOAging);

module.exports = router;
