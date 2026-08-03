'use strict';

const express = require('express');
const router = express.Router();
const { getActivity } = require('../../controllers/ActivityController');
const { authenticate } = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');

router.use(authenticate);

/**
 * @swagger
 * /api/v1/activity:
 *   get:
 *     tags: [Activity]
 *     summary: List recent audit-log activity for the company (who did what, when)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: user_id
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Paginated activity log, content: { application/json: { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } }
 */
router.get('/', authorize('reports.read'), getActivity);

module.exports = router;
