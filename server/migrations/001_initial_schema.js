'use strict';

const path = require('path');
const fs = require('fs');
const db = require('../config/database');

// ============================================================
// Seed Data
// ============================================================

const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee',       symbol: '₹',  exchange_rate: 1.0,     is_default: 1 },
  { code: 'USD', name: 'US Dollar',           symbol: '$',  exchange_rate: 0.012,   is_default: 0 },
  { code: 'EUR', name: 'Euro',                symbol: '€',  exchange_rate: 0.011,   is_default: 0 },
  { code: 'GBP', name: 'British Pound',       symbol: '£',  exchange_rate: 0.0095,  is_default: 0 },
  { code: 'AED', name: 'UAE Dirham',          symbol: 'د.إ',exchange_rate: 0.044,   is_default: 0 },
  { code: 'SGD', name: 'Singapore Dollar',    symbol: 'S$', exchange_rate: 0.016,   is_default: 0 },
  { code: 'AUD', name: 'Australian Dollar',   symbol: 'A$', exchange_rate: 0.018,   is_default: 0 },
];

const SYSTEM_ROLES = [
  { slug: 'owner',      name: 'Owner',      description: 'Full access to everything', is_system_role: 1 },
  { slug: 'admin',      name: 'Admin',      description: 'Administrative access',     is_system_role: 1 },
  { slug: 'manager',    name: 'Manager',    description: 'Manage daily operations',   is_system_role: 1 },
  { slug: 'accountant', name: 'Accountant', description: 'Accounting and finance',    is_system_role: 1 },
  { slug: 'sales',      name: 'Sales',      description: 'Sales operations',          is_system_role: 1 },
  { slug: 'employee',   name: 'Employee',   description: 'Basic employee access',     is_system_role: 1 },
  { slug: 'viewer',     name: 'Viewer',     description: 'Read-only access',          is_system_role: 1 },
];

const PERMISSIONS = [
  // Customers
  { name: 'customers.create', resource: 'customers', action: 'create', description: 'Create customers' },
  { name: 'customers.read',   resource: 'customers', action: 'read',   description: 'View customers' },
  { name: 'customers.update', resource: 'customers', action: 'update', description: 'Update customers' },
  { name: 'customers.delete', resource: 'customers', action: 'delete', description: 'Delete customers' },
  // Products
  { name: 'products.create',  resource: 'products',  action: 'create', description: 'Create products' },
  { name: 'products.read',    resource: 'products',  action: 'read',   description: 'View products' },
  { name: 'products.update',  resource: 'products',  action: 'update', description: 'Update products' },
  { name: 'products.delete',  resource: 'products',  action: 'delete', description: 'Delete products' },
  // Invoices
  { name: 'invoices.create',  resource: 'invoices',  action: 'create', description: 'Create invoices' },
  { name: 'invoices.read',    resource: 'invoices',  action: 'read',   description: 'View invoices' },
  { name: 'invoices.update',  resource: 'invoices',  action: 'update', description: 'Update invoices' },
  { name: 'invoices.delete',  resource: 'invoices',  action: 'delete', description: 'Delete invoices' },
  { name: 'invoices.send',    resource: 'invoices',  action: 'send',   description: 'Send invoices to customers' },
  // Payments
  { name: 'payments.create',  resource: 'payments',  action: 'create', description: 'Record payments' },
  { name: 'payments.read',    resource: 'payments',  action: 'read',   description: 'View payments' },
  { name: 'payments.update',  resource: 'payments',  action: 'update', description: 'Update payments' },
  { name: 'payments.delete',  resource: 'payments',  action: 'delete', description: 'Delete payments' },
  // Expenses
  { name: 'expenses.create',  resource: 'expenses',  action: 'create', description: 'Create expenses' },
  { name: 'expenses.read',    resource: 'expenses',  action: 'read',   description: 'View expenses' },
  { name: 'expenses.update',  resource: 'expenses',  action: 'update', description: 'Update expenses' },
  { name: 'expenses.delete',  resource: 'expenses',  action: 'delete', description: 'Delete expenses' },
  // Reports
  { name: 'reports.read',     resource: 'reports',   action: 'read',   description: 'View reports' },
  // Settings
  { name: 'settings.update',  resource: 'settings',  action: 'update', description: 'Update settings' },
  // Users
  { name: 'users.create',     resource: 'users',     action: 'create', description: 'Invite/create users' },
  { name: 'users.read',       resource: 'users',     action: 'read',   description: 'View users' },
  { name: 'users.update',     resource: 'users',     action: 'update', description: 'Update users' },
  { name: 'users.delete',     resource: 'users',     action: 'delete', description: 'Delete users' },
  // Purchase Orders
  { name: 'purchase_orders.create', resource: 'purchase_orders', action: 'create', description: 'Create purchase orders' },
  { name: 'purchase_orders.read',   resource: 'purchase_orders', action: 'read',   description: 'View purchase orders' },
  { name: 'purchase_orders.update', resource: 'purchase_orders', action: 'update', description: 'Update purchase orders' },
  { name: 'purchase_orders.delete', resource: 'purchase_orders', action: 'delete', description: 'Delete purchase orders' },
  // Suppliers
  { name: 'suppliers.create', resource: 'suppliers', action: 'create', description: 'Create suppliers' },
  { name: 'suppliers.read',   resource: 'suppliers', action: 'read',   description: 'View suppliers' },
  { name: 'suppliers.update', resource: 'suppliers', action: 'update', description: 'Update suppliers' },
  { name: 'suppliers.delete', resource: 'suppliers', action: 'delete', description: 'Delete suppliers' },
];

// Role → permission mapping (which permissions each system role gets)
const ROLE_PERMISSION_MAP = {
  owner:      '*',  // all permissions
  admin:      '*',  // all permissions
  manager:    [
    'customers.*', 'products.*', 'invoices.*', 'payments.*',
    'expenses.*', 'reports.read', 'suppliers.*', 'purchase_orders.*',
  ],
  accountant: [
    'customers.read', 'invoices.*', 'payments.*', 'expenses.*',
    'reports.read', 'purchase_orders.read',
  ],
  sales:      [
    'customers.*', 'products.read', 'invoices.create', 'invoices.read',
    'invoices.update', 'invoices.send', 'payments.read',
  ],
  employee:   [
    'customers.read', 'products.read', 'invoices.read', 'payments.read',
    'suppliers.read', 'purchase_orders.read',
  ],
  viewer:     [
    'customers.read', 'products.read', 'invoices.read', 'payments.read',
    'expenses.read', 'reports.read', 'suppliers.read', 'purchase_orders.read',
  ],
};

// ============================================================
// Helpers
// ============================================================

function hasRun(migrationName) {
  try {
    const row = db.prepare('SELECT id FROM migrations WHERE name = ?').get(migrationName);
    return !!row;
  } catch {
    return false;
  }
}

function markRun(migrationName) {
  db.prepare('INSERT OR IGNORE INTO migrations (name) VALUES (?)').run(migrationName);
}

function expandPattern(pattern, allPermissionNames) {
  if (pattern === '*') return allPermissionNames;
  if (pattern.endsWith('.*')) {
    const resource = pattern.slice(0, -2);
    return allPermissionNames.filter((p) => p.startsWith(resource + '.'));
  }
  return [pattern];
}

// ============================================================
// Migration Steps
// ============================================================

function runSchema() {
  console.log('[Migration] Running 001_initial_schema ...');
  const schemaPath = path.resolve(__dirname, '../database/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');

  // Strip single-line (-- ...) and block (/* ... */) comments first
  const cleanSql = sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // Split on semicolons and execute each statement individually
  const statements = cleanSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const runStatements = db.transaction(() => {
    for (const stmt of statements) {
      try {
        db.prepare(stmt).run();
      } catch (err) {
        // Skip PRAGMA errors (they use exec-style)
        if (stmt.toUpperCase().startsWith('PRAGMA')) {
          try { db.exec(stmt + ';'); } catch { /* ignore */ }
        } else {
          console.error('[Migration Error] Statement failed:', stmt);
          throw err;
        }
      }
    }
  });

  runStatements();
  console.log('[Migration] Schema created/verified.');
}

function seedCurrencies() {
  console.log('[Migration] Seeding currencies ...');
  const insert = db.prepare(`
    INSERT OR IGNORE INTO currencies (code, name, symbol, exchange_rate, is_default)
    VALUES (@code, @name, @symbol, @exchange_rate, @is_default)
  `);
  const insertMany = db.transaction((currencies) => {
    for (const c of currencies) insert.run(c);
  });
  insertMany(CURRENCIES);
  console.log(`[Migration] Seeded ${CURRENCIES.length} currencies.`);
}

function seedRoles() {
  console.log('[Migration] Seeding system roles ...');
  const insert = db.prepare(`
    INSERT OR IGNORE INTO roles (company_id, name, slug, description, is_system_role)
    VALUES (NULL, @name, @slug, @description, @is_system_role)
  `);
  const insertMany = db.transaction((roles) => {
    for (const r of roles) insert.run(r);
  });
  insertMany(SYSTEM_ROLES);
  console.log(`[Migration] Seeded ${SYSTEM_ROLES.length} system roles.`);
}

function seedPermissions() {
  console.log('[Migration] Seeding permissions ...');
  const insert = db.prepare(`
    INSERT OR IGNORE INTO permissions (name, resource, action, description)
    VALUES (@name, @resource, @action, @description)
  `);
  const insertMany = db.transaction((perms) => {
    for (const p of perms) insert.run(p);
  });
  insertMany(PERMISSIONS);
  console.log(`[Migration] Seeded ${PERMISSIONS.length} permissions.`);
}

function seedRolePermissions() {
  console.log('[Migration] Seeding role permissions ...');

  const allPermissionNames = PERMISSIONS.map((p) => p.name);

  const insertRP = db.prepare(`
    INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
    VALUES (?, ?)
  `);

  const getRole = db.prepare('SELECT id FROM roles WHERE slug = ? AND company_id IS NULL');
  const getPerm = db.prepare('SELECT id FROM permissions WHERE name = ?');

  const run = db.transaction(() => {
    for (const [roleSlug, patterns] of Object.entries(ROLE_PERMISSION_MAP)) {
      const role = getRole.get(roleSlug);
      if (!role) continue;

      let permNames;
      if (patterns === '*') {
        permNames = allPermissionNames;
      } else {
        permNames = patterns.flatMap((p) => expandPattern(p, allPermissionNames));
      }

      for (const permName of [...new Set(permNames)]) {
        const perm = getPerm.get(permName);
        if (perm) insertRP.run(role.id, perm.id);
      }
    }
  });

  run();
  console.log('[Migration] Role permissions seeded.');
}

// ============================================================
// Main Runner
// ============================================================

function runMigrations() {
  console.log('[Migration] Starting migration runner ...');

  // Step 1: Run schema (always idempotent via CREATE IF NOT EXISTS)
  runSchema();

  // Step 2: Seed data (guarded by migration tracker)
  if (!hasRun('seed_currencies')) {
    seedCurrencies();
    markRun('seed_currencies');
  } else {
    console.log('[Migration] Currencies already seeded, skipping.');
  }

  if (!hasRun('seed_roles')) {
    seedRoles();
    markRun('seed_roles');
  } else {
    console.log('[Migration] System roles already seeded, skipping.');
  }

  if (!hasRun('seed_permissions')) {
    seedPermissions();
    markRun('seed_permissions');
  } else {
    console.log('[Migration] Permissions already seeded, skipping.');
  }

  if (!hasRun('seed_role_permissions')) {
    seedRolePermissions();
    markRun('seed_role_permissions');
  } else {
    console.log('[Migration] Role permissions already seeded, skipping.');
  }

  markRun('001_initial_schema');
  console.log('[Migration] All migrations completed successfully.');
}

module.exports = runMigrations;
