'use strict';

const express = require('express');
const router = express.Router();
const SupplierController = require('../../controllers/SupplierController');
const { validateSupplier } = require('../../validators/supplier.validator');
const authenticate = require('../../middleware/authenticate').authenticate;
const authorize = require('../../middleware/authorize').authorize;
const { enforcePlanLimit } = require('../../middleware/planLimit');

router.use(authenticate);

/**
 * @swagger
 * /api/v1/suppliers:
 *   get:
 *     tags: [Suppliers]
 *     summary: List suppliers
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Paginated list of suppliers, content: { application/json: { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } }
 */
router.get('/', authorize('suppliers.read'), SupplierController.getSuppliers);

/**
 * @swagger
 * /api/v1/suppliers/{id}:
 *   get:
 *     tags: [Suppliers]
 *     summary: Get a single supplier by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Supplier found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 *       404: { description: Supplier not found, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/:id', authorize('suppliers.read'), SupplierController.getSupplierById);

/**
 * @swagger
 * /api/v1/suppliers/{id}/payments:
 *   get:
 *     tags: [Suppliers]
 *     summary: List payments made to a supplier
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Payment list, content: { application/json: { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } }
 *   post:
 *     tags: [Suppliers]
 *     summary: Record a payment made to a supplier
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
 *             required: [amount, paid_at]
 *             properties:
 *               amount:         { type: number, example: 15000 }
 *               paid_at:        { type: string, format: date, example: '2026-07-20' }
 *               method:         { type: string, enum: [cash, bank, upi, cheque, other], example: 'bank' }
 *               reference_no:   { type: string, example: 'UTR123456789' }
 *               purchase_order_id: { type: integer, example: 4 }
 *     responses:
 *       201: { description: Payment recorded, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.get('/:id/payments', authorize('suppliers.read'), SupplierController.getSupplierPayments);
router.post('/:id/payments', authorize('suppliers.update'), SupplierController.createSupplierPayment);

/**
 * @swagger
 * /api/v1/suppliers/{id}/purchase-history:
 *   get:
 *     tags: [Suppliers]
 *     summary: Get a supplier's past purchase orders
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Purchase history, content: { application/json: { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } }
 */
router.get('/:id/purchase-history', authorize('suppliers.read'), SupplierController.getSupplierPurchaseHistory);

/**
 * @swagger
 * /api/v1/suppliers:
 *   post:
 *     tags: [Suppliers]
 *     summary: Create a new supplier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:    { type: string, example: 'Global Parts Ltd' }
 *               email:   { type: string, example: 'sales@globalparts.com' }
 *               phone:   { type: string, example: '+91 98765 43210' }
 *               gstin:   { type: string, example: '22AAAAA0000A1Z5' }
 *               address: { type: string, example: '456 Industrial Rd, Pune' }
 *     responses:
 *       201: { description: Supplier created, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 *       422: { description: Plan limit reached for suppliers, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/', authorize('suppliers.create'), enforcePlanLimit('suppliers'), validateSupplier, SupplierController.createSupplier);

/**
 * @swagger
 * /api/v1/suppliers/{id}:
 *   put:
 *     tags: [Suppliers]
 *     summary: Update a supplier
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
 *             properties:
 *               name:    { type: string }
 *               email:   { type: string }
 *               phone:   { type: string }
 *               address: { type: string }
 *     responses:
 *       200: { description: Supplier updated, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 *   delete:
 *     tags: [Suppliers]
 *     summary: Delete a supplier
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Supplier deleted, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.put('/:id', authorize('suppliers.update'), validateSupplier, SupplierController.updateSupplier);
router.delete('/:id', authorize('suppliers.delete'), SupplierController.deleteSupplier);

module.exports = router;
