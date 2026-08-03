'use strict';

const db = require('../config/database');
const { logger } = require('../utils/logger');

/**
 * Migration 003: Add TOTP 2FA columns to users table.
 * SQLite does not support ADD COLUMN IF NOT EXISTS, so we check first.
 */
function runMigration003() {
  const columns = db.pragma('table_info(users)').map(c => c.name);

  if (!columns.includes('totp_secret')) {
    db.prepare('ALTER TABLE users ADD COLUMN totp_secret TEXT').run();
    logger.info('[Migration 003] Added column: users.totp_secret');
  }

  if (!columns.includes('totp_enabled')) {
    db.prepare('ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0').run();
    logger.info('[Migration 003] Added column: users.totp_enabled');
  }
}

module.exports = runMigration003;
