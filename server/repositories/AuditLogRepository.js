'use strict';

const BaseRepository = require('./BaseRepository');

/**
 * AuditLogRepository — handles inserting and fetching system audit trails.
 */
class AuditLogRepository extends BaseRepository {
  constructor(db) {
    super(db, 'audit_logs');
  }

  /**
   * Log a system action.
   */
  log(companyId, userId, action, entityType, entityId, beforeData = null, afterData = null, ip = '', userAgent = '') {
    return this.create({
      company_id: companyId,
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      before_data: beforeData ? JSON.stringify(beforeData) : null,
      after_data: afterData ? JSON.stringify(afterData) : null,
      ip_address: ip,
      user_agent: userAgent,
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Fetch paginated audit trail for a company.
   */
  getCompanyLogs(companyId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const logs = this.db.prepare(`
      SELECT a.*, u.name AS user_name, u.email AS user_email
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE a.company_id = ?
      ORDER BY a.id DESC
      LIMIT ? OFFSET ?
    `).all(companyId, limit, offset);

    const total = this.db.prepare(`
      SELECT COUNT(*) as count FROM audit_logs WHERE company_id = ?
    `).get(companyId).count;

    return { logs, total };
  }
}

module.exports = AuditLogRepository;
