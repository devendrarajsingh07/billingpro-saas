'use strict';

const express = require('express');
const router = express.Router();
const CustomerController = require('../../controllers/CustomerController');
const { validateCustomer } = require('../../validators/customer.validator');
const authenticate = require('../../middleware/authenticate').authenticate;
const authorize = require('../../middleware/authorize').authorize;
const { enforcePlanLimit } = require('../../middleware/planLimit');

router.use(authenticate);

/**
 * @swagger
 * /api/v1/customers:
 *   get:
 *     tags: [Customers]
 *     summary: List customers for the current company
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
 *         description: Paginated list of customers
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { $ref: '#/components/schemas/Customer' } }
 */
router.get('/', authorize('customers.read'), CustomerController.getCustomers);

/**
 * @swagger
 * /api/v1/customers/{id}:
 *   get:
 *     tags: [Customers]
 *     summary: Get a single customer by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Customer found
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Customer' } }
 *       404:
 *         description: Customer not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id', authorize('customers.read'), CustomerController.getCustomerById);

/**
 * @swagger
 * /api/v1/customers/{id}/statement:
 *   get:
 *     tags: [Customers]
 *     summary: Get a customer's running account statement (invoices + payments)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Customer statement
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.get('/:id/statement', authorize('customers.read'), CustomerController.getCustomerStatement);

/**
 * @swagger
 * /api/v1/customers/{id}/purchase-history:
 *   get:
 *     tags: [Customers]
 *     summary: Get a customer's past invoices/purchases
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Purchase history
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PaginatedResponse' }
 */
router.get('/:id/purchase-history', authorize('customers.read'), CustomerController.getCustomerPurchaseHistory);

/**
 * @swagger
 * /api/v1/customers:
 *   post:
 *     tags: [Customers]
 *     summary: Create a new customer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:         { type: string, example: 'Acme Corp' }
 *               email:        { type: string, example: 'billing@acme.com' }
 *               phone:        { type: string, example: '+91 98765 43210' }
 *               gstin:        { type: string, example: '22AAAAA0000A1Z5' }
 *               address:      { type: string, example: '123 Main St, Mumbai' }
 *               credit_limit: { type: number, example: 50000 }
 *     responses:
 *       201:
 *         description: Customer created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Customer' } }
 *       422:
 *         description: Plan limit reached for customers
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/', authorize('customers.create'), enforcePlanLimit('customers'), validateCustomer, CustomerController.createCustomer);

/**
 * @swagger
 * /api/v1/customers/{id}:
 *   put:
 *     tags: [Customers]
 *     summary: Update a customer
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
 *               name:         { type: string }
 *               email:        { type: string }
 *               phone:        { type: string }
 *               gstin:        { type: string }
 *               address:      { type: string }
 *               credit_limit: { type: number }
 *     responses:
 *       200:
 *         description: Customer updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.put('/:id', authorize('customers.update'), validateCustomer, CustomerController.updateCustomer);

/**
 * @swagger
 * /api/v1/customers/{id}:
 *   delete:
 *     tags: [Customers]
 *     summary: Delete a customer
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Customer deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       409:
 *         description: Customer has existing invoices and cannot be deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete('/:id', authorize('customers.delete'), CustomerController.deleteCustomer);

module.exports = router;
