'use strict';

/**
 * BaseRepository — generic data-access layer for SQLite via better-sqlite3.
 *
 * All methods are synchronous (better-sqlite3 is a synchronous driver).
 * Subclasses extend this and pass the table name + db instance.
 *
 * Soft-delete convention: tables may have `is_deleted` (0/1) and `deleted_at` columns.
 */
class BaseRepository {
  /**
   * @param {import('better-sqlite3').Database} db - better-sqlite3 db instance
   * @param {string} tableName - The SQL table to operate on
   */
  constructor(db, tableName) {
    this.db        = db;
    this.tableName = tableName;
  }

  // ──────────────────────────────────────────────
  // SCHEMA INTROSPECTION
  // ──────────────────────────────────────────────

  /**
   * Returns the set of real column names for this table (cached per table).
   * Used to whitelist inbound data before building INSERT/UPDATE statements,
   * so unexpected fields (typos, stray client fields, schema drift) are
   * silently ignored instead of crashing the query.
   *
   * @returns {Set<string>}
   */
  getColumns() {
    if (!BaseRepository._columnCache) {
      BaseRepository._columnCache = new Map();
    }
    if (!BaseRepository._columnCache.has(this.tableName)) {
      const rows = this.db.prepare(`PRAGMA table_info(${this.tableName})`).all();
      BaseRepository._columnCache.set(this.tableName, new Set(rows.map((r) => r.name)));
    }
    return BaseRepository._columnCache.get(this.tableName);
  }

  /**
   * @param {string} col
   * @returns {boolean}
   */
  hasColumn(col) {
    return this.getColumns().has(col);
  }

  /**
   * Filter a data object down to only keys that are real columns on this table.
   * @param {object} data
   * @returns {object}
   */
  whitelistColumns(data) {
    const cols = this.getColumns();
    const out = {};
    for (const [key, val] of Object.entries(data)) {
      if (cols.has(key)) out[key] = val;
    }
    return out;
  }

  /**
   * Normalize values before binding them to SQLite, since better-sqlite3 only
   * accepts a small set of primitive types.
   *
   * @param {*} value
   * @returns {number|string|bigint|Buffer|null}
   */
  sanitizeValue(value) {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'bigint' || typeof value === 'string' || Buffer.isBuffer(value)) {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
      try {
        return JSON.stringify(value);
      } catch (error) {
        return String(value);
      }
    }

    return value;
  }

  /**
   * Soft-delete SQL fragment, or empty string if this table has no is_deleted column.
   * @param {boolean} [withAnd=true] - prefix with ' AND ' if true, else no prefix
   */
  _softDeleteClause(withAnd = true) {
    if (!this.hasColumn('is_deleted')) return '';
    return `${withAnd ? ' AND ' : ''}(is_deleted = 0 OR is_deleted IS NULL)`;
  }

  // ──────────────────────────────────────────────
  // READ
  // ──────────────────────────────────────────────

  /**
   * Find a record by primary key, scoped to a company, excluding soft-deleted.
   *
   * @param {number} id
   * @param {number|null} companyId - Pass null to skip company scoping
   * @returns {object|undefined}
   */
  findById(id, companyId = null) {
    let query = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    const params = [id];

    if (companyId !== null) {
      query += ' AND company_id = ?';
      params.push(companyId);
    }

    query += this._softDeleteClause();

    return this.db.prepare(query).get(...params);
  }

  /**
   * Find all records with optional pagination, search, sort, and filters.
   *
   * @param {object} options
   * @param {number} options.companyId
   * @param {string} [options.search] - Search term
   * @param {string[]} [options.searchFields] - Columns to search on (LIKE)
   * @param {number} [options.page=1]
   * @param {number} [options.limit=10]
   * @param {string} [options.sort='created_at']
   * @param {string} [options.order='desc']
   * @param {object} [options.filters] - { column: value } exact matches
   * @param {boolean} [options.withDeleted=false] - Include soft-deleted rows
   * @returns {object[]}
   */
  findAll({
    companyId,
    search       = null,
    searchFields = [],
    page         = 1,
    limit        = 10,
    sort         = 'created_at',
    order        = 'desc',
    filters      = {},
    withDeleted  = false,
  } = {}) {
    const conditions = [];
    const params     = [];

    // Tenant scope
    if (companyId !== undefined && companyId !== null) {
      conditions.push('company_id = ?');
      params.push(companyId);
    }

    // Soft delete filter
    if (!withDeleted && this.hasColumn('is_deleted')) {
      conditions.push('(is_deleted = 0 OR is_deleted IS NULL)');
    }

    // Search across multiple fields
    if (search && searchFields.length > 0) {
      const likeClauses = searchFields.map((f) => `${f} LIKE ?`);
      conditions.push(`(${likeClauses.join(' OR ')})`);
      searchFields.forEach(() => params.push(`%${search}%`));
    }

    // Exact-match filters
    for (const [col, val] of Object.entries(filters)) {
      if (val !== undefined && val !== null) {
        conditions.push(`${col} = ?`);
        params.push(val);
      }
    }

    const where    = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const safeSort = /^[a-zA-Z0-9_.]+$/.test(sort) ? sort : 'created_at';
    const safeOrd  = order === 'asc' ? 'ASC' : 'DESC';
    const offset   = (Number(page) - 1) * Number(limit);

    const query = `
      SELECT * FROM ${this.tableName}
      ${where}
      ORDER BY ${safeSort} ${safeOrd}
      LIMIT ? OFFSET ?
    `;

    return this.db.prepare(query).all(...params, Number(limit), offset);
  }

  // ──────────────────────────────────────────────
  // COUNT (for pagination totals)
  // ──────────────────────────────────────────────

  /**
   * Count records matching the same criteria as findAll.
   *
   * @param {object} options - Same as findAll
   * @returns {number}
   */
  count({
    companyId,
    search       = null,
    searchFields = [],
    filters      = {},
    withDeleted  = false,
  } = {}) {
    const conditions = [];
    const params     = [];

    if (companyId !== undefined && companyId !== null) {
      conditions.push('company_id = ?');
      params.push(companyId);
    }

    if (!withDeleted && this.hasColumn('is_deleted')) {
      conditions.push('(is_deleted = 0 OR is_deleted IS NULL)');
    }

    if (search && searchFields.length > 0) {
      const likeClauses = searchFields.map((f) => `${f} LIKE ?`);
      conditions.push(`(${likeClauses.join(' OR ')})`);
      searchFields.forEach(() => params.push(`%${search}%`));
    }

    for (const [col, val] of Object.entries(filters)) {
      if (val !== undefined && val !== null) {
        conditions.push(`${col} = ?`);
        params.push(val);
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const row   = this.db
      .prepare(`SELECT COUNT(*) as total FROM ${this.tableName} ${where}`)
      .get(...params);

    return row ? row.total : 0;
  }

  // ──────────────────────────────────────────────
  // FIND BY FIELD
  // ──────────────────────────────────────────────

  /**
   * Find a single record by an arbitrary field value.
   *
   * @param {string} field - Column name
   * @param {*} value - Value to match
   * @param {number|null} companyId
   * @returns {object|undefined}
   */
  findByField(field, value, companyId = null) {
    let query  = `SELECT * FROM ${this.tableName} WHERE ${field} = ?`;
    const params = [value];

    if (companyId !== null) {
      query += ' AND company_id = ?';
      params.push(companyId);
    }

    query += this._softDeleteClause();
    query += ' LIMIT 1';

    return this.db.prepare(query).get(...params);
  }

  /**
   * Find multiple records by an arbitrary field value.
   *
   * @param {string} field
   * @param {*} value
   * @param {number|null} companyId
   * @returns {object[]}
   */
  findManyByField(field, value, companyId = null) {
    let query  = `SELECT * FROM ${this.tableName} WHERE ${field} = ?`;
    const params = [value];

    if (companyId !== null) {
      query += ' AND company_id = ?';
      params.push(companyId);
    }

    query += this._softDeleteClause();

    return this.db.prepare(query).all(...params);
  }

  // ──────────────────────────────────────────────
  // EXISTS
  // ──────────────────────────────────────────────

  /**
   * Check whether a record matching the given conditions exists.
   *
   * @param {object} conditions - { column: value } key-value pairs
   * @returns {boolean}
   */
  exists(conditions) {
    const cols   = Object.keys(conditions);
    const vals   = Object.values(conditions);
    const clause = cols.map((c) => `${c} = ?`).join(' AND ');

    const row = this.db
      .prepare(`SELECT 1 FROM ${this.tableName} WHERE ${clause} LIMIT 1`)
      .get(...vals);

    return !!row;
  }

  // ──────────────────────────────────────────────
  // CREATE
  // ──────────────────────────────────────────────

  /**
   * Insert a new record and return the created row.
   *
   * @param {object} data - Column → value map
   * @returns {object} The newly inserted row
   */
  create(data) {
    const cleanData = this.whitelistColumns(data);
    const restricted = ['id', 'is_deleted', 'deleted_at'];
    for (const key of restricted) {
      delete cleanData[key];
    }

    const cols        = Object.keys(cleanData);
    const placeholders = cols.map(() => '?').join(', ');
    const vals        = Object.values(cleanData).map((value) => this.sanitizeValue(value));

    const result = this.db
      .prepare(
        `INSERT INTO ${this.tableName} (${cols.join(', ')}) VALUES (${placeholders})`
      )
      .run(...vals);

    return this.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
      .get(result.lastInsertRowid);
  }

  // ──────────────────────────────────────────────
  // UPDATE
  // ──────────────────────────────────────────────

  /**
   * Update a record by id, scoped to companyId, and touch updated_at.
   *
   * @param {number} id
   * @param {number|null} companyId
   * @param {object} data - Columns to update
   * @returns {object|undefined} Updated record
   */
  update(id, companyId, data) {
    const cleanData = this.whitelistColumns(data);
    const restricted = ['id', 'company_id', 'created_by', 'created_at', 'is_deleted', 'deleted_at'];
    for (const key of restricted) {
      delete cleanData[key];
    }

    const payload = { ...cleanData };
    if (this.hasColumn('updated_at')) {
      payload.updated_at = new Date().toISOString();
    }

    const cols   = Object.keys(payload).map((c) => `${c} = ?`).join(', ');
    const vals   = Object.values(payload).map((value) => this.sanitizeValue(value));
    const params = [...vals, id];

    let query = `UPDATE ${this.tableName} SET ${cols} WHERE id = ?`;

    if (companyId !== null) {
      query += ' AND company_id = ?';
      params.push(companyId);
    }

    this.db.prepare(query).run(...params);

    return this.findById(id, companyId);
  }

  // ──────────────────────────────────────────────
  // SOFT DELETE
  // ──────────────────────────────────────────────

  /**
   * Soft-delete a record (sets is_deleted = 1, deleted_at = now).
   *
   * @param {number} id
   * @param {number|null} companyId
   * @returns {{ changes: number }}
   */
  softDelete(id, companyId = null) {
    if (!this.hasColumn('is_deleted')) {
      // This table has no soft-delete columns — fall back to a hard delete
      // rather than silently no-op'ing or crashing on an unknown column.
      return this.hardDelete(id, companyId);
    }

    const setClauses = ['is_deleted = 1'];
    const params = [];
    const now = new Date().toISOString();

    // Not every is_deleted table also has a deleted_at timestamp column
    // (e.g. categories, suppliers, purchase_orders) — include it only
    // when it actually exists, same as the updated_at check below.
    if (this.hasColumn('deleted_at')) {
      setClauses.push('deleted_at = ?');
      params.push(now);
    }
    if (this.hasColumn('updated_at')) {
      setClauses.push('updated_at = ?');
      params.push(now);
    }

    let query = `UPDATE ${this.tableName} SET ${setClauses.join(', ')} WHERE id = ?`;
    params.push(id);

    if (companyId !== null) {
      query += ' AND company_id = ?';
      params.push(companyId);
    }

    const result = this.db.prepare(query).run(...params);
    return { changes: result.changes };
  }

  // ──────────────────────────────────────────────
  // HARD DELETE
  // ──────────────────────────────────────────────

  /**
   * Permanently delete a record from the database.
   *
   * @param {number} id
   * @param {number|null} companyId
   * @returns {{ changes: number }}
   */
  hardDelete(id, companyId = null) {
    let query  = `DELETE FROM ${this.tableName} WHERE id = ?`;
    const params = [id];

    if (companyId !== null) {
      query += ' AND company_id = ?';
      params.push(companyId);
    }

    const result = this.db.prepare(query).run(...params);
    return { changes: result.changes };
  }

  // ──────────────────────────────────────────────
  // RAW QUERY HELPERS
  // ──────────────────────────────────────────────

  /**
   * Execute a raw SELECT and return all rows.
   * @param {string} sql
   * @param {Array} params
   * @returns {object[]}
   */
  rawQuery(sql, params = []) {
    return this.db.prepare(sql).all(...params);
  }

  /**
   * Execute a raw SELECT and return first row.
   * @param {string} sql
   * @param {Array} params
   * @returns {object|undefined}
   */
  rawGet(sql, params = []) {
    return this.db.prepare(sql).get(...params);
  }

  /**
   * Execute a raw INSERT/UPDATE/DELETE.
   * @param {string} sql
   * @param {Array} params
   * @returns {import('better-sqlite3').RunResult}
   */
  rawRun(sql, params = []) {
    return this.db.prepare(sql).run(...params);
  }
}

module.exports = BaseRepository;
