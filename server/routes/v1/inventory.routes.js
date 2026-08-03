'use strict';

const express = require('express');
const router = express.Router();
const InventoryController = require('../../controllers/InventoryController');
const { validateStockAdjustment } = require('../../validators/inventory.validator');
const authenticate = require('../../middleware/authenticate').authenticate;
const authorize = require('../../middleware/authorize').authorize;

router.use(authenticate);

// Inventory movements are a view over product stock history, so they're
// gated behind the same 'products.*' permissions rather than a new resource.
/**
 * @swagger
 * /api/v1/inventory:
 *   get:
 *     tags: [Inventory]
 *     summary: List stock movement history (adjustments, sales, purchase receipts)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: product_id
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Paginated movement history, content: { application/json: { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } }
 */
router.get('/', authorize('products.read'), InventoryController.getMovements);

/**
 * @swagger
 * /api/v1/inventory/low-stock:
 *   get:
 *     tags: [Inventory]
 *     summary: List products at or below their low-stock threshold
 *     responses:
 *       200: { description: Low-stock products, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.get('/low-stock', authorize('products.read'), InventoryController.getLowStock);

/**
 * @swagger
 * /api/v1/inventory/forecast:
 *   get:
 *     tags: [Inventory]
 *     summary: Predictive stockout forecast based on recent sales velocity
 *     responses:
 *       200:
 *         description: Per-product days-until-stockout estimates
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.get('/forecast', authorize('products.read'), InventoryController.getForecast);

/**
 * @swagger
 * /api/v1/inventory/adjustments:
 *   post:
 *     tags: [Inventory]
 *     summary: Create a manual stock adjustment
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [product_id, quantity, reason]
 *             properties:
 *               product_id: { type: integer, example: 12 }
 *               quantity:   { type: integer, example: -3, description: 'Positive to add stock, negative to remove' }
 *               reason:     { type: string, example: 'Stock count correction' }
 *     responses:
 *       201: { description: Adjustment recorded, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.post('/adjustments', authorize('products.update'), validateStockAdjustment, InventoryController.createAdjustment);

module.exports = router;
