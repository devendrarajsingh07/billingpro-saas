'use strict';

const db = require('../config/database');
const NotificationRepository = require('../repositories/NotificationRepository');

const notificationRepo = new NotificationRepository(db);

class NotificationService {
  static getNotifications(userId, companyId, queryOptions) {
    const { page, limit, unread_only } = queryOptions;
    const { notifications, total } = notificationRepo.findForUser(userId, companyId, {
      page,
      limit,
      unreadOnly: unread_only === 'true',
    });

    // Parse the stored JSON `data` blob back into an object for the client
    const parsed = notifications.map((n) => ({
      ...n,
      data: n.data ? JSON.parse(n.data) : null,
    }));

    return { notifications: parsed, total };
  }

  static getUnreadCount(userId, companyId) {
    return notificationRepo.countUnread(userId, companyId);
  }

  static markRead(id, userId, companyId) {
    return notificationRepo.markRead(Number(id), userId, companyId);
  }

  static markAllRead(userId, companyId) {
    return notificationRepo.markAllRead(userId, companyId);
  }
}

module.exports = NotificationService;
