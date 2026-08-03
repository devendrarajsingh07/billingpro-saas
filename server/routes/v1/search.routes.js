'use strict';

const express = require('express');
const router = express.Router();
const { search } = require('../../controllers/SearchController');
const { authenticate } = require('../../middleware/authenticate');

router.use(authenticate);

/**
 * @swagger
 * /api/v1/search:
 *   get:
 *     tags: [Search]
 *     summary: Global search across customers, products, invoices, and suppliers
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         example: acme
 *     responses:
 *       200:
 *         description: Grouped search results
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.get('/', search);

module.exports = router;
