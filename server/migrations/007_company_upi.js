'use strict';

const db = require('../config/database');

/**
 * Migration 007 — add upi_id column to companies.
 *
 * Each company can store their own UPI Virtual Payment Address (VPA) so that
 * invoice PDF QR codes point to the correct payee, rather than a hardcoded
 * developer address.
 */
function runMigration007() {
  const hasMigrated = (() => {
    try {
      return !!db.prepare("SELECT id FROM migrations WHERE name = '007_company_upi'").get();
    } catch { return false; }
  })();

  if (hasMigrated) {
    console.log('[Migration] 007_company_upi already applied, skipping.');
    return;
  }

  console.log('[Migration] Running 007_company_upi ...');

  // SQLite does not support IF NOT EXISTS on ALTER TABLE — check pragmatically.
  const columns = db.pragma('table_info(companies)');
  const hasUpiId = columns.some((c) => c.name === 'upi_id');

  if (!hasUpiId) {
    db.prepare('ALTER TABLE companies ADD COLUMN upi_id TEXT').run();
    console.log('[Migration] Added companies.upi_id column.');
  } else {
    console.log('[Migration] companies.upi_id already exists.');
  }

  db.prepare("INSERT OR IGNORE INTO migrations (name) VALUES ('007_company_upi')").run();
  console.log('[Migration] 007_company_upi completed.');
}

module.exports = runMigration007;
