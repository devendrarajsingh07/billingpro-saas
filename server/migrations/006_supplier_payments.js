'use strict';

const db = require('../config/database');
const { logger } = require('../utils/logger');

/**
 * Migration 006: Create supplier_payments table.
 */
function runMigration006() {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);

  if (!tables.includes('supplier_payments')) {
    db.prepare(`
      CREATE TABLE supplier_payments (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id          INTEGER NOT NULL,
        supplier_id         INTEGER NOT NULL,
        purchase_order_id   INTEGER,
        amount              REAL NOT NULL,
        method              TEXT DEFAULT 'cash' CHECK(method IN ('cash','bank','upi','cheque','other')),
        reference_no        TEXT,
        notes               TEXT,
        paid_at             DATE NOT NULL,
        created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by          INTEGER,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id)
      )
    `).run();
    logger.info('[Migration 006] Created table: supplier_payments');
  }
}

module.exports = runMigration006;
