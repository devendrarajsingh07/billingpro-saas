'use strict';

const express = require('express');
const router = express.Router();
const SubscriptionController = require('../../controllers/SubscriptionController');
const authenticate = require('../../middleware/authenticate').authenticate;
const authorize = require('../../middleware/authorize').authorize;

router.use(authenticate);

/**
 * @swagger
 * /api/v1/subscriptions/me:
 *   get:
 *     tags: [Subscription]
 *     summary: Get the current company's subscription/plan overview and usage against plan limits
 *     responses:
 *       200: { description: Subscription overview, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.get('/me', SubscriptionController.getOverview);

/**
 * @swagger
 * /api/v1/subscriptions/change-plan:
 *   post:
 *     tags: [Subscription]
 *     summary: Change the company's subscription plan
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plan]
 *             properties:
 *               plan: { type: string, example: 'pro' }
 *     responses:
 *       200: { description: Plan changed, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.post('/change-plan', authorize('settings.update'), SubscriptionController.changePlan);

/**
 * @swagger
 * /api/v1/subscriptions/cancel:
 *   post:
 *     tags: [Subscription]
 *     summary: Cancel the company's subscription (downgrades to the free tier at period end)
 *     responses:
 *       200: { description: Subscription cancelled, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.post('/cancel', authorize('settings.update'), SubscriptionController.cancel);

module.exports = router;
