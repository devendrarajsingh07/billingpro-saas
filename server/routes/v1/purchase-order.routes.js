'use strict';

const express = require('express');
const router = express.Router();
const PurchaseOrderController = require('../../controllers/PurchaseOrderController');
const { validatePurchaseOrder, validatePOStatus } = require('../../validators/purchase-order.validator');
const authenticate = require('../../middleware/authenticate').authenticate;
const authorize = require('../../middleware/authorize').authorize;

router.use(authenticate);

/**
 * @swagger
 * /api/v1/purchase-orders:
 *   get:
 *     tags: [Purchase Orders]
 *     summary: List purchase orders
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, sent, received, cancelled] }
 *     responses:
 *       200: { description: Paginated list, content: { application/json: { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } }
 */
router.get('/', authorize('purchase_orders.read'), PurchaseOrderController.getPurchaseOrders);

/**
 * @swagger
 * /api/v1/purchase-orders/{id}:
 *   get:
 *     tags: [Purchase Orders]
 *     summary: Get a single purchase order by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Purchase order found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 *       404: { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *   delete:
 *     tags: [Purchase Orders]
 *     summary: Delete a purchase order
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Deleted, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.get('/:id', authorize('purchase_orders.read'), PurchaseOrderController.getPurchaseOrderById);

/**
 * @swagger
 * /api/v1/purchase-orders:
 *   post:
 *     tags: [Purchase Orders]
 *     summary: Create a new purchase order
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [supplier_id, items]
 *             properties:
 *               supplier_id: { type: integer, example: 3 }
 *               expected_date: { type: string, format: date, example: '2026-08-10' }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     product_id: { type: integer, example: 12 }
 *                     quantity:   { type: integer, example: 50 }
 *                     unit_cost:  { type: number, example: 600 }
 *     responses:
 *       201: { description: Purchase order created, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.post('/', authorize('purchase_orders.create'), validatePurchaseOrder, PurchaseOrderController.createPurchaseOrder);

/**
 * @swagger
 * /api/v1/purchase-orders/{id}/status:
 *   patch:
 *     tags: [Purchase Orders]
 *     summary: Update a purchase order's status (e.g. mark as received, which updates stock)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [draft, sent, received, cancelled] }
 *     responses:
 *       200: { description: Status updated, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.patch('/:id/status', authorize('purchase_orders.update'), validatePOStatus, PurchaseOrderController.updateStatus);
router.delete('/:id', authorize('purchase_orders.delete'), PurchaseOrderController.deletePurchaseOrder);

module.exports = router;
