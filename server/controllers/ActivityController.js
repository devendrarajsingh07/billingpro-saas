'use strict';

const db = require('../config/database');
const ApiResponse = require('../utils/ApiResponse');

const getActivity = (req, res, next) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const companyId = req.companyId;

    let query = `
      SELECT a.*, u.name AS user_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.company_id = ?
    `;
    const params = [companyId];

    if (type) {
      query += ` AND a.entity_type = ?`;
      params.push(type);
    }

    query += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), offset);

    const rows = db.prepare(query).all(...params);

    const countQuery = type
      ? 'SELECT COUNT(*) as total FROM audit_logs WHERE company_id = ? AND entity_type = ?'
      : 'SELECT COUNT(*) as total FROM audit_logs WHERE company_id = ?';
    
    const countParam = type ? [companyId, type] : [companyId];
    const countRow = db.prepare(countQuery).get(...countParam);

    return res.json(ApiResponse.paginated(
      rows.map(r => ({
        ...r,
        before_data: r.before_data ? JSON.parse(r.before_data) : null,
        after_data: r.after_data ? JSON.parse(r.after_data) : null,
      })),
      countRow.total,
      page,
      limit
    ));
  } catch (err) {
    next(err);
  }
};

module.exports = { getActivity };
