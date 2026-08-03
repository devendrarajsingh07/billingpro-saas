'use strict';

/**
 * Reports & Dashboard Integration Tests
 *
 * Tests that all report endpoints return properly structured data
 * and that the dashboard summary includes all required fields.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET         = 'test-jwt-secret-key-at-least-32-chars!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-at-least-32-chars!';
process.env.JWT_EXPIRES_IN     = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.BCRYPT_ROUNDS      = '4';

const request = require('supertest');
const { getDb } = require('./setup');
getDb(); // initialize in-memory DB

let app;
let token;

const TEST_USER = {
  name:         'Reports Test User',
  email:        'reportstest@example.com',
  password:     'ReportPass123!',
  company_name: 'Reports Test Corp',
};

beforeAll(async () => {
  const srv = require('../server');
  app = srv.app;

  // Register and login
  const regRes = await request(app).post('/api/v1/auth/register').send(TEST_USER);
  if (regRes.status !== 201 && regRes.status !== 409) {
    throw new Error(`Setup failed: ${JSON.stringify(regRes.body)}`);
  }

  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email:    TEST_USER.email,
    password: TEST_USER.password,
  });
  token = loginRes.body.data?.accessToken;
  if (!token) throw new Error('Could not get auth token for reports tests');
});

// ── Dashboard ──────────────────────────────────────────────────────

describe('GET /api/v1/reports/dashboard', () => {
  test('returns summary with all required KPI fields', async () => {
    const res = await request(app)
      .get('/api/v1/reports/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const d = res.body.data;
    // Core KPIs (nested under `kpis`, matching what the dashboard UI reads)
    expect(d).toHaveProperty('kpis');
    expect(d.kpis).toHaveProperty('totalRevenue');
    expect(d.kpis).toHaveProperty('monthlyRevenue');
    expect(d.kpis).toHaveProperty('totalOutstanding');
    expect(d.kpis).toHaveProperty('pendingInvoices');
    expect(d.kpis).toHaveProperty('products');
  });

  test('requires authentication', async () => {
    const res = await request(app).get('/api/v1/reports/dashboard');
    expect(res.status).toBe(401);
  });
});

// ── Profit & Loss ──────────────────────────────────────────────────

describe('GET /api/v1/reports/profit-loss', () => {
  test('returns P&L structure with income, expenses, netProfit', async () => {
    const res = await request(app)
      .get('/api/v1/reports/profit-loss')
      .query({ from_date: '2026-01-01', to_date: '2026-12-31' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const d = res.body.data;
    expect(d).toHaveProperty('income');
    expect(d).toHaveProperty('expenses');
    expect(d).toHaveProperty('netProfit');
    expect(typeof d.income).toBe('number');
    expect(typeof d.netProfit).toBe('number');
  });

  test('netProfit equals income minus expenses', async () => {
    const res = await request(app)
      .get('/api/v1/reports/profit-loss')
      .query({ from_date: '2026-01-01', to_date: '2026-12-31' })
      .set('Authorization', `Bearer ${token}`);

    const { income, expenses, netProfit } = res.body.data;
    expect(Math.abs(netProfit - (income - expenses))).toBeLessThan(0.01);
  });
});

// ── Tax Report ─────────────────────────────────────────────────────

describe('GET /api/v1/reports/tax', () => {
  test('returns tax report with taxes breakdown array', async () => {
    const res = await request(app)
      .get('/api/v1/reports/tax')
      .query({ from_date: '2026-01-01', to_date: '2026-12-31' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('taxes');
    expect(Array.isArray(res.body.data.taxes)).toBe(true);
  });
});

// ── Inventory Valuation ────────────────────────────────────────────

describe('GET /api/v1/reports/inventory-valuation', () => {
  test('returns valuation with cost, retail, potentialProfit', async () => {
    const res = await request(app)
      .get('/api/v1/reports/inventory-valuation')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const d = res.body.data;
    expect(d).toHaveProperty('totalCostValue');
    expect(d).toHaveProperty('totalRetailValue');
    expect(d).toHaveProperty('potentialProfit');
    expect(d).toHaveProperty('products');
    expect(Array.isArray(d.products)).toBe(true);
  });
});

// ── Supplier Spend ─────────────────────────────────────────────────

describe('GET /api/v1/reports/supplier-spend', () => {
  test('returns supplier spend with suppliers array and total', async () => {
    const res = await request(app)
      .get('/api/v1/reports/supplier-spend')
      .query({ from_date: '2026-01-01', to_date: '2026-12-31' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const d = res.body.data;
    expect(d).toHaveProperty('suppliers');
    expect(d).toHaveProperty('totalSpend');
    expect(Array.isArray(d.suppliers)).toBe(true);
  });
});

// ── PO Aging ───────────────────────────────────────────────────────

describe('GET /api/v1/reports/po-aging', () => {
  test('returns PO aging buckets', async () => {
    const res = await request(app)
      .get('/api/v1/reports/po-aging')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const d = res.body.data;
    // Should have aging buckets
    expect(d).toHaveProperty('buckets');
  });
});
