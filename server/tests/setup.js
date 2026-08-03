'use strict';

/**
 * Test setup — creates an in-memory SQLite database, runs all migrations,
 * seeds a minimal dataset (owner company + user), and provides a helper to
 * get a valid auth token for use in supertest requests.
 *
 * Usage:
 *   const { getApp, getToken, seedCompany } = require('./setup');
 */

process.env.NODE_ENV = 'test';
process.env.PORT               = process.env.PORT || '5000';
process.env.JWT_SECRET         = 'test-jwt-secret-key-at-least-32-chars!!';
process.env.JWT_ACCESS_EXPIRE  = '15m';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-at-least-32-chars!';
process.env.JWT_REFRESH_EXPIRE = '7d';
process.env.BCRYPT_ROUNDS      = '4'; // fast for tests
process.env.DB_PATH            = ':memory:';

const Database = require('better-sqlite3');
const path     = require('path');

// Shared in-memory DB instance used across all tests
let _db = null;

function getDb() {
  if (!_db) {
    _db = new Database(':memory:');
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');

    // Run all migrations against the in-memory DB
    const dbConfig = require('../config/database');
    // Override the module-cached db with our in-memory one for testing
    // (we monkey-patch require cache so all services use this db)
    require.cache[require.resolve('../config/database')].exports = _db;

    // Run migrations
    const runMigrations   = require('../migrations/001_initial_schema');
    const runMigration003 = require('../migrations/003_totp_2fa');
    const runMigration004 = require('../migrations/004_sales_orders');
    const runMigration005 = require('../migrations/005_invoice_reminders_product_barcode');
    const runMigration006 = require('../migrations/006_supplier_payments');

    runMigrations();
    runMigration003();
    runMigration004();
    runMigration005();
    runMigration006();
  }
  return _db;
}

/**
 * Returns an authenticated supertest token for the test owner user.
 */
async function getToken(app) {
  const request = require('supertest');
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'owner@test.com', password: 'TestPass123!' });

  if (!res.body?.data?.accessToken) {
    throw new Error(`Failed to get test token: ${JSON.stringify(res.body)}`);
  }
  return res.body.data.accessToken;
}

/**
 * Seeds a fresh company + owner user for integration tests.
 * Call once before all tests in a suite.
 */
async function seedCompany(app) {
  const request = require('supertest');
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name:         'Test Owner',
      email:        'owner@test.com',
      password:     'TestPass123!',
      company_name: 'Test Company Ltd',
    });

  if (!res.body?.data?.accessToken && res.status !== 409) {
    throw new Error(`Failed to seed company: ${JSON.stringify(res.body)}`);
  }
}

/**
 * Returns the Express app instance (without starting the server).
 */
function getApp() {
  // Initialize the in-memory DB before importing app
  getDb();
  const { app } = require('../server');
  return app;
}

module.exports = { getApp, getToken, seedCompany, getDb };
