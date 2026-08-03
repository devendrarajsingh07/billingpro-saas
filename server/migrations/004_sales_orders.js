'use strict';

const db = require('../config/database');
const { logger } = require('../utils/logger');

/**
 * Migration 004: Sales Orders + Sales Order Items tables.
 */
function runMigration004() {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);

  if (!tables.includes('sales_orders')) {
    db.prepare(`
      CREATE TABLE sales_orders (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id    INTEGER NOT NULL,
        customer_id   INTEGER,
        invoice_id    INTEGER,
        so_no         TEXT NOT NULL,
        date          TEXT,
        expected_date TEXT,
        subtotal      REAL DEFAULT 0,
        tax_amount    REAL DEFAULT 0,
        grand_total   REAL DEFAULT 0,
        notes         TEXT,
        terms         TEXT,
        status        TEXT DEFAULT 'draft' CHECK(status IN ('draft','confirmed','processing','completed','cancelled')),
        is_deleted    INTEGER DEFAULT 0,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id)  REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (invoice_id)  REFERENCES invoices(id)
      )
    `).run();
    logger.info('[Migration 004] Created table: sales_orders');
  }

  if (!tables.includes('sales_order_items')) {
    db.prepare(`
      CREATE TABLE sales_order_items (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        sales_order_id  INTEGER NOT NULL,
        product_id      INTEGER,
        name            TEXT NOT NULL,
        description     TEXT,
        qty             REAL DEFAULT 1,
        unit_price      REAL DEFAULT 0,
        tax_rate        REAL DEFAULT 0,
        line_total      REAL DEFAULT 0,
        FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id)     REFERENCES products(id)
      )
    `).run();
    logger.info('[Migration 004] Created table: sales_order_items');
  }
}

module.exports = runMigration004;
