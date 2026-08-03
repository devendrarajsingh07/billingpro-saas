'use strict';

const express = require('express');
const router = express.Router();
const InvoiceController = require('../../controllers/InvoiceController');
const { validateInvoice, validateInvoiceStatus } = require('../../validators/invoice.validator');
const authenticate = require('../../middleware/authenticate').authenticate;
const authorize = require('../../middleware/authorize').authorize;
const { enforcePlanLimit } = require('../../middleware/planLimit');

router.use(authenticate);

/**
 * @swagger
 * /api/v1/invoices:
 *   get:
 *     tags: [Invoices]
 *     summary: List all invoices (paginated)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, sent, paid, partial, overdue, cancelled] }
 *       - in: query
 *         name: customer_id
 *         schema: { type: integer }
 *       - in: query
 *         name: from_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: search
 *         schema: { type: string, description: 'Search by invoice number or customer name' }
 *     responses:
 *       200:
 *         description: Paginated list of invoices
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PaginatedResponse' }
 */
router.get('/', authorize('invoices.read'), InvoiceController.getInvoices);

/**
 * @swagger
 * /api/v1/invoices/{id}:
 *   get:
 *     tags: [Invoices]
 *     summary: Get a single invoice with all line items
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Invoice with line items, payments, and customer info
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Invoice' }
 *       404:
 *         description: Invoice not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id', authorize('invoices.read'), InvoiceController.getInvoiceById);

/**
 * @swagger
 * /api/v1/invoices:
 *   post:
 *     tags: [Invoices]
 *     summary: Create a new invoice
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customer_id, issue_date, due_date, items]
 *             properties:
 *               customer_id:   { type: integer, example: 1 }
 *               issue_date:    { type: string, format: date, example: '2026-07-01' }
 *               due_date:      { type: string, format: date, example: '2026-07-31' }
 *               currency_code: { type: string, example: 'INR' }
 *               notes:         { type: string }
 *               terms:         { type: string }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [product_id, quantity, unit_price]
 *                   properties:
 *                     product_id: { type: integer }
 *                     quantity:   { type: number }
 *                     unit_price: { type: number }
 *                     discount:   { type: number, default: 0 }
 *                     tax_rate:   { type: number, default: 0 }
 *     responses:
 *       201:
 *         description: Invoice created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Invoice' }
 */
router.post('/', authorize('invoices.create'), enforcePlanLimit('invoicesPerMonth'), validateInvoice, InvoiceController.createInvoice);

/**
 * @swagger
 * /api/v1/invoices/{id}/duplicate:
 *   post:
 *     tags: [Invoices]
 *     summary: Duplicate an invoice (creates a new draft copy)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       201:
 *         description: Duplicated invoice created as draft
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.post('/:id/duplicate', authorize('invoices.create'), InvoiceController.duplicateInvoice);

/**
 * @swagger
 * /api/v1/invoices/{id}/status:
 *   patch:
 *     tags: [Invoices]
 *     summary: Update invoice status
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
 *               status: { type: string, enum: [draft, sent, paid, partial, overdue, cancelled] }
 *     responses:
 *       200:
 *         description: Status updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.patch('/:id/status', authorize('invoices.update'), validateInvoiceStatus, InvoiceController.updateInvoiceStatus);

/**
 * @swagger
 * /api/v1/invoices/{id}/send:
 *   post:
 *     tags: [Invoices]
 *     summary: Send invoice via email to the customer
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Invoice emailed (or skipped if SMTP not configured)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.post('/:id/send', authorize('invoices.send'), InvoiceController.sendInvoice);

/**
 * @swagger
 * /api/v1/invoices/{id}:
 *   delete:
 *     tags: [Invoices]
 *     summary: Delete (soft-delete) an invoice
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Invoice deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.delete('/:id', authorize('invoices.delete'), InvoiceController.deleteInvoice);

/**
 * @swagger
 * /api/v1/invoices/{id}/pdf:
 *   get:
 *     tags: [Invoices]
 *     summary: Download invoice as PDF
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: PDF file stream
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/:id/pdf', authorize('invoices.read'), InvoiceController.downloadPDF);

module.exports = router;
