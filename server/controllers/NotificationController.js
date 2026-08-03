'use strict';

const NotificationService = require('../services/NotificationService');
const ApiResponse = require('../utils/ApiResponse');

class NotificationController {
  static async getNotifications(req, res, next) {
    try {
      const { page = 1, limit = 20, unread_only } = req.query;
      const { notifications, total } = NotificationService.getNotifications(req.userId, req.companyId, {
        page: Number(page),
        limit: Number(limit),
        unread_only,
      });
      res.json(ApiResponse.paginated(notifications, total, page, limit));
    } catch (err) {
      next(err);
    }
  }

  static async getUnreadCount(req, res, next) {
    try {
      const count = NotificationService.getUnreadCount(req.userId, req.companyId);
      res.json(ApiResponse.success({ count }, 'Unread count fetched successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async markRead(req, res, next) {
    try {
      const notification = NotificationService.markRead(req.params.id, req.userId, req.companyId);
      res.json(ApiResponse.success(notification, 'Notification marked as read.'));
    } catch (err) {
      next(err);
    }
  }

  static async markAllRead(req, res, next) {
    try {
      NotificationService.markAllRead(req.userId, req.companyId);
      res.json(ApiResponse.success(null, 'All notifications marked as read.'));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = NotificationController;
