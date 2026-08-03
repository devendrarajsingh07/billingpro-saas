'use strict';

const express = require('express');
const router = express.Router();
const ProductController = require('../../controllers/ProductController');
const { validateProduct } = require('../../validators/product.validator');
const authenticate = require('../../middleware/authenticate').authenticate;
const authorize = require('../../middleware/authorize').authorize;
const { enforcePlanLimit } = require('../../middleware/planLimit');

router.use(authenticate);

/**
 * @swagger
 * /api/v1/products:
 *   get:
 *     tags: [Products]
 *     summary: List products for the current company
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated list of products
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { $ref: '#/components/schemas/Product' } }
 */
router.get('/', authorize('products.read'), ProductController.getProducts);

/**
 * @swagger
 * /api/v1/products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get a single product by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Product found
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Product' } }
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id', authorize('products.read'), ProductController.getProductById);

/**
 * @swagger
 * /api/v1/products:
 *   post:
 *     tags: [Products]
 *     summary: Create a new product
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, selling_price]
 *             properties:
 *               name:                 { type: string, example: 'Laptop Pro 16"' }
 *               sku:                  { type: string, example: 'LAPTOP-PRO-16' }
 *               barcode:              { type: string, example: '1234567890123' }
 *               selling_price:        { type: number, example: 85000 }
 *               purchase_price:       { type: number, example: 60000 }
 *               stock:                { type: integer, example: 25 }
 *               low_stock_threshold:  { type: integer, example: 5 }
 *               category:             { type: string, example: 'Electronics' }
 *     responses:
 *       201:
 *         description: Product created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Product' } }
 *       422:
 *         description: Plan limit reached for products
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/', authorize('products.create'), enforcePlanLimit('products'), validateProduct, ProductController.createProduct);

/**
 * @swagger
 * /api/v1/products/{id}:
 *   put:
 *     tags: [Products]
 *     summary: Update a product
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
 *               name:                 { type: string }
 *               sku:                  { type: string }
 *               selling_price:        { type: number }
 *               purchase_price:       { type: number }
 *               low_stock_threshold:  { type: integer }
 *               category:             { type: string }
 *     responses:
 *       200:
 *         description: Product updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.put('/:id', authorize('products.update'), validateProduct, ProductController.updateProduct);

/**
 * @swagger
 * /api/v1/products/{id}:
 *   delete:
 *     tags: [Products]
 *     summary: Delete a product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Product deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.delete('/:id', authorize('products.delete'), ProductController.deleteProduct);

/**
 * @swagger
 * /api/v1/products/{id}/adjust-stock:
 *   post:
 *     tags: [Products]
 *     summary: Manually adjust a product's stock level (creates an inventory movement record)
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
 *             required: [quantity, type]
 *             properties:
 *               quantity:  { type: integer, example: 5, description: 'in/out: positive count moved. adjustment: signed delta applied directly.' }
 *               type:      { type: string, enum: [in, out, adjustment], example: 'in' }
 *               reference: { type: string, example: 'RESTOCK-001' }
 *               notes:     { type: string, example: 'Damaged in transit' }
 *     responses:
 *       200:
 *         description: Stock adjusted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.post('/:id/adjust-stock', authorize('products.update'), ProductController.adjustStock);

module.exports = router;
