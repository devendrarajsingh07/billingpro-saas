'use strict';

const BaseRepository = require('./BaseRepository');

/**
 * CompanyRepository — data access for the `companies` table.
 * Extends BaseRepository with company-specific operations.
 */
class CompanyRepository extends BaseRepository {
  constructor(db) {
    super(db, 'companies');
  }

  // ──────────────────────────────────────────────
  // FINDERS
  // ──────────────────────────────────────────────

  /**
   * Find an active company by its email.
   *
   * @param {string} email
   * @returns {object|undefined}
   */
  findByEmail(email) {
    return this.db.prepare(`
      SELECT * FROM companies
      WHERE email = ? AND is_deleted = 0
      LIMIT 1
    `).get(email.toLowerCase().trim());
  }

  /**
   * Get a company with its active subscription info.
   *
   * @param {number} companyId
   * @returns {object|undefined}
   */
  findWithSubscription(companyId) {
    return this.db.prepare(`
      SELECT
        c.*,
        s.plan      AS sub_plan,
        s.status    AS sub_status,
        s.expires_at AS sub_expires_at
      FROM companies c
      LEFT JOIN subscriptions s ON s.company_id = c.id
      WHERE c.id = ? AND c.is_deleted = 0
      LIMIT 1
    `).get(companyId);
  }

  // ──────────────────────────────────────────────
  // INVOICE SEQUENCE
  // ──────────────────────────────────────────────

  /**
   * Get the last invoice number issued by this company for a given year.
   * Parses the numeric suffix from invoice_no e.g. 'INV-2026-000042' → 42
   *
   * @param {number} companyId
   * @param {number|string} year - 4-digit year to scope the sequence
   * @returns {number} Last sequence number (0 if none exists)
   */
  getLastInvoiceSeq(companyId, year) {
    const prefix = `%-${year}-%`;

    const row = this.db.prepare(`
      SELECT invoice_no
      FROM invoices
      WHERE company_id = ?
        AND invoice_no LIKE ?
        AND is_deleted = 0
      ORDER BY id DESC
      LIMIT 1
    `).get(companyId, prefix);

    if (!row) return 0;

    const parts = row.invoice_no.split('-');
    return parseInt(parts[parts.length - 1], 10) || 0;
  }

  /**
   * Get the next available invoice sequence number (atomic-safe in SQLite).
   * Returns the next number to use (last + 1).
   *
   * @param {number} companyId
   * @param {number|string} year
   * @returns {number}
   */
  getNextInvoiceSeq(companyId, year) {
    return this.getLastInvoiceSeq(companyId, year) + 1;
  }

  /**
   * Get the last PO number issued by this company for a given year.
   *
   * @param {number} companyId
   * @param {number|string} year
   * @returns {number}
   */
  getLastPOSeq(companyId, year) {
    const prefix = `%-${year}-%`;

    const row = this.db.prepare(`
      SELECT po_no
      FROM purchase_orders
      WHERE company_id = ?
        AND po_no LIKE ?
        AND is_deleted = 0
      ORDER BY id DESC
      LIMIT 1
    `).get(companyId, prefix);

    if (!row) return 0;

    const parts = row.po_no.split('-');
    return parseInt(parts[parts.length - 1], 10) || 0;
  }

  // ──────────────────────────────────────────────
  // SETTINGS
  // ──────────────────────────────────────────────

  /**
   * Get a company setting value by key.
   *
   * @param {number} companyId
   * @param {string} key
   * @returns {string|null}
   */
  getSetting(companyId, key) {
    const row = this.db.prepare(`
      SELECT value, type FROM settings WHERE company_id = ? AND key = ?
    `).get(companyId, key);

    if (!row) return null;

    switch (row.type) {
      case 'boolean': return row.value === 'true';
      case 'number':  return Number(row.value);
      case 'json':    try { return JSON.parse(row.value); } catch { return row.value; }
      default:        return row.value;
    }
  }

  /**
   * Upsert a company setting.
   *
   * @param {number} companyId
   * @param {string} key
   * @param {*} value
   * @param {string} [type='string']
   */
  setSetting(companyId, key, value, type = 'string') {
    const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const now      = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO settings (company_id, key, value, type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(company_id, key) DO UPDATE SET value = ?, type = ?, updated_at = ?
    `).run(companyId, key, strValue, type, now, now, strValue, type, now);
  }

  // ──────────────────────────────────────────────
  // STATS
  // ──────────────────────────────────────────────

  /**
   * Get aggregated billing stats for a company (dashboard summary).
   *
   * @param {number} companyId
   * @returns {object}
   */
  getDashboardStats(companyId) {
    const invoiceStats = this.db.prepare(`
      SELECT
        COUNT(*) AS total_invoices,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) AS overdue_count,
        SUM(grand_total) AS total_invoiced,
        SUM(amount_paid) AS total_collected,
        SUM(amount_due)  AS total_outstanding
      FROM invoices
      WHERE company_id = ? AND is_deleted = 0
    `).get(companyId);

    const customerCount = this.db.prepare(`
      SELECT COUNT(*) AS total FROM customers
      WHERE company_id = ? AND is_deleted = 0
    `).get(companyId);

    const productCount = this.db.prepare(`
      SELECT COUNT(*) AS total FROM products
      WHERE company_id = ? AND is_deleted = 0
    `).get(companyId);

    return {
      invoices:    invoiceStats,
      customers:   customerCount.total,
      products:    productCount.total,
    };
  }
}

module.exports = CompanyRepository;
