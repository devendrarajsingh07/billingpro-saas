'use strict';

const express = require('express');
const router = express.Router();
const NotificationController = require('../../controllers/NotificationController');
const authenticate = require('../../middleware/authenticate').authenticate;

router.use(authenticate);

/**
 * @swagger
 * /api/v1/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List in-app notifications for the current user
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200: { description: Paginated notifications, content: { application/json: { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } }
 */
router.get('/', NotificationController.getNotifications);

/**
 * @swagger
 * /api/v1/notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Get the count of unread notifications
 *     responses:
 *       200: { description: Unread count, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.get('/unread-count', NotificationController.getUnreadCount);

/**
 * @swagger
 * /api/v1/notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark a single notification as read
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Marked as read, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.patch('/:id/read', NotificationController.markRead);

/**
 * @swagger
 * /api/v1/notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read
 *     responses:
 *       200: { description: All marked as read, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.patch('/read-all', NotificationController.markAllRead);

module.exports = router;
