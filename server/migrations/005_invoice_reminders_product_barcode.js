'use strict';

const db = require('../config/database');
const { logger } = require('../utils/logger');

/**
 * Migration 005: Add last_reminder_sent column to invoices
 * and barcode + image columns to products.
 */
function runMigration005() {
  const invoiceCols  = db.pragma('table_info(invoices)').map(c => c.name);
  const productCols  = db.pragma('table_info(products)').map(c => c.name);

  // invoices: track when overdue reminder was last sent
  if (!invoiceCols.includes('last_reminder_sent')) {
    db.prepare('ALTER TABLE invoices ADD COLUMN last_reminder_sent DATETIME').run();
    logger.info('[Migration 005] Added column: invoices.last_reminder_sent');
  }

  // products: barcode and image support
  if (!productCols.includes('barcode')) {
    db.prepare('ALTER TABLE products ADD COLUMN barcode TEXT').run();
    logger.info('[Migration 005] Added column: products.barcode');
  }
  if (!productCols.includes('image')) {
    db.prepare('ALTER TABLE products ADD COLUMN image TEXT').run();
    logger.info('[Migration 005] Added column: products.image');
  }
}

module.exports = runMigration005;
