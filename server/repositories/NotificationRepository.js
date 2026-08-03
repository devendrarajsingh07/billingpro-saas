'use strict';

const BaseRepository = require('./BaseRepository');

class NotificationRepository extends BaseRepository {
  constructor(db) {
    super(db, 'notifications');
  }

  findForUser(userId, companyId, { page = 1, limit = 20, unreadOnly = false } = {}) {
    const conditions = ['company_id = ?', 'user_id = ?'];
    const params = [companyId, userId];
    if (unreadOnly) conditions.push('is_read = 0');

    const where = `WHERE ${conditions.join(' AND ')}`;
    const offset = (Number(page) - 1) * Number(limit);

    const notifications = this.db.prepare(`
      SELECT * FROM notifications
      ${where}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), offset);

    const { total } = this.db.prepare(`
      SELECT COUNT(*) AS total FROM notifications ${where}
    `).get(...params);

    return { notifications, total };
  }

  countUnread(userId, companyId) {
    const { total } = this.db.prepare(`
      SELECT COUNT(*) AS total FROM notifications
      WHERE company_id = ? AND user_id = ? AND is_read = 0
    `).get(companyId, userId);
    return total;
  }

  markRead(id, userId, companyId) {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE notifications
      SET is_read = 1, read_at = ?
      WHERE id = ? AND user_id = ? AND company_id = ?
    `).run(now, id, userId, companyId);
    return this.db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
  }

  markAllRead(userId, companyId) {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE notifications
      SET is_read = 1, read_at = ?
      WHERE user_id = ? AND company_id = ? AND is_read = 0
    `).run(now, userId, companyId);
    return { changes: result.changes };
  }
}

module.exports = NotificationRepository;
