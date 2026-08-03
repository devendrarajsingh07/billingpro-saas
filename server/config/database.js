'use strict';

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.resolve(__dirname, '../database/billing.db');

let db;

function getDb() {
  if (db) return db;

  db = new Database(DB_PATH, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : null,
  });

  // Performance & integrity pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000'); // 64MB cache
  db.pragma('temp_store = MEMORY');
  db.pragma('mmap_size = 268435456'); // 256MB memory-mapped I/O

  console.log(`[Database] Connected to SQLite at: ${DB_PATH}`);
  console.log(`[Database] WAL mode enabled, foreign keys ON`);

  return db;
}

module.exports = getDb();
