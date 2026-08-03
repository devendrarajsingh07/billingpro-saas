const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'billingly.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Auto-create all tables on startup ────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT    NOT NULL,
    email            TEXT    NOT NULL UNIQUE,
    password         TEXT    NOT NULL,
    role             TEXT    NOT NULL DEFAULT 'admin',
    company_name     TEXT,
    gst_number       TEXT,
    invoice_prefix   TEXT    DEFAULT 'INV-',
    logo             TEXT,
    phone            TEXT,
    address          TEXT,
    created_at       TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS customers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    name       TEXT    NOT NULL,
    email      TEXT,
    phone      TEXT,
    address    TEXT,
    gst_number TEXT,
    created_at TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    name        TEXT    NOT NULL,
    price       REAL    NOT NULL DEFAULT 0,
    gst         REAL    DEFAULT 0,
    stock       INTEGER DEFAULT 0,
    category    TEXT,
    unit        TEXT    DEFAULT 'pcs',
    description TEXT,
    created_at  TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    invoice_no   TEXT    NOT NULL UNIQUE,
    customer_id  INTEGER NOT NULL,
    date         TEXT    NOT NULL,
    due_date     TEXT,
    subtotal     REAL    DEFAULT 0,
    gst_amount   REAL    DEFAULT 0,
    discount     REAL    DEFAULT 0,
    grand_total  REAL    DEFAULT 0,
    status       TEXT    DEFAULT 'draft',
    notes        TEXT,
    created_at   TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id  INTEGER NOT NULL,
    product_id  INTEGER,
    description TEXT    NOT NULL,
    qty         INTEGER DEFAULT 1,
    price       REAL    NOT NULL DEFAULT 0,
    gst         REAL    DEFAULT 0,
    total       REAL    DEFAULT 0,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)  ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)  ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS payments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    amount     REAL    NOT NULL,
    method     TEXT    DEFAULT 'cash',
    date       TEXT    NOT NULL,
    note       TEXT,
    created_at TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
  );
`);

// ── Lightweight migrations ───────────────────────────────────────────────────
// CREATE TABLE IF NOT EXISTS above only applies to brand-new databases.
// For a database created before these columns existed, add them here.
const addColumnIfMissing = (table, column, definition) => {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!existing.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`   ↳ migrated: added ${table}.${column}`);
  }
};

addColumnIfMissing('users', 'phone', 'TEXT');
addColumnIfMissing('users', 'address', 'TEXT');
addColumnIfMissing('products', 'unit', "TEXT DEFAULT 'pcs'");
addColumnIfMissing('products', 'description', 'TEXT');

console.log('✅ SQLite database ready →', DB_PATH);

module.exports = db;
