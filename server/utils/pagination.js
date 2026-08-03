'use strict';

/**
 * Parses pagination parameters from request query string.
 *
 * @param {object} query - req.query
 * @param {number} [defaultLimit=10] - Default page size
 * @param {number} [maxLimit=100] - Maximum allowed page size
 * @returns {{ page: number, limit: number, offset: number }}
 */
function getPagination(query, defaultLimit = 10, maxLimit = 100) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (!page || page < 1 || isNaN(page)) page = 1;
  if (!limit || limit < 1 || isNaN(limit)) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Builds a safe SQL ORDER BY clause from sort/order query params.
 *
 * @param {string} sort - Field name to sort by
 * @param {string} order - 'asc' or 'desc'
 * @param {string[]} allowedFields - Whitelist of sortable column names
 * @param {string} [defaultSort='created_at'] - Fallback field
 * @param {string} [defaultOrder='desc'] - Fallback direction
 * @returns {string} e.g. "ORDER BY created_at DESC"
 */
function buildSortClause(
  sort,
  order,
  allowedFields,
  defaultSort = 'created_at',
  defaultOrder = 'desc'
) {
  const safeSort = allowedFields.includes(sort) ? sort : defaultSort;
  const safeOrder = ['asc', 'desc'].includes((order || '').toLowerCase())
    ? order.toLowerCase()
    : defaultOrder;

  return `ORDER BY ${safeSort} ${safeOrder.toUpperCase()}`;
}

/**
 * Builds a WHERE clause fragment for LIKE-based search across multiple fields.
 * Returns parameterized SQL and params array.
 *
 * @param {string} searchTerm - The user's search input
 * @param {string[]} fields - Columns to search across (LIKE)
 * @returns {{ clause: string, params: string[] }}
 */
function buildSearchClause(searchTerm, fields) {
  if (!searchTerm || !fields.length) {
    return { clause: '', params: [] };
  }

  const term = `%${searchTerm}%`;
  const conditions = fields.map((f) => `${f} LIKE ?`).join(' OR ');
  const params = fields.map(() => term);

  return { clause: `(${conditions})`, params };
}

/**
 * Builds a pagination summary object for response meta.
 *
 * @param {number} total
 * @param {number} page
 * @param {number} limit
 * @returns {object}
 */
function buildPaginationMeta(total, page, limit) {
  const totalPages = Math.ceil(total / limit) || 0;
  return {
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages,
    hasNext: Number(page) < totalPages,
    hasPrev: Number(page) > 1,
  };
}

module.exports = {
  getPagination,
  buildSortClause,
  buildSearchClause,
  buildPaginationMeta,
};
