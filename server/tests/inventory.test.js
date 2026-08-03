'use strict';

const request = require('supertest');
const { getApp, getDb, seedCompany, getToken } = require('./setup');

let app, db, token;

beforeAll(async () => {
  app = getApp();
  db = getDb();
  await seedCompany(app);
  token = await getToken(app);
});

async function createProduct(overrides = {}) {
  const res = await request(app)
    .post('/api/v1/products')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Inventory Test Product',
      sku: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      selling_price: 50,
      purchase_price: 30,
      stock: 20,
      low_stock_threshold: 5,
      ...overrides,
    });
  return res.body.data;
}

describe('GET /api/v1/inventory/low-stock', () => {
  test('flags a product at or below its threshold', async () => {
    await createProduct({ stock: 3, low_stock_threshold: 5 });

    const res = await request(app)
      .get('/api/v1/inventory/low-stock')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.data.map((p) => p.id);
    expect(res.body.data.some((p) => p.stock <= p.low_stock_threshold)).toBe(true);
  });

  test('does not flag a product with healthy stock', async () => {
    const healthy = await createProduct({ stock: 500, low_stock_threshold: 5 });

    const res = await request(app)
      .get('/api/v1/inventory/low-stock')
      .set('Authorization', `Bearer ${token}`);

    const ids = res.body.data.map((p) => p.id);
    expect(ids).not.toContain(healthy.id);
  });
});

describe('GET /api/v1/inventory/forecast', () => {
  test('projects a stockout for a product with recent high sales velocity and low stock', async () => {
    const product = await createProduct({ stock: 10, low_stock_threshold: 2 });

    // Simulate consistent daily sales via stock-out adjustments, backdated
    // across the lookback window so velocity math has data to work with.
    for (let i = 0; i < 5; i++) {
      const daysAgo = i + 1;
      const ts = new Date(Date.now() - daysAgo * 86400000).toISOString();
      db.prepare(`
        INSERT INTO inventory (company_id, product_id, type, quantity, reference, created_at)
        VALUES ((SELECT company_id FROM products WHERE id = ?), ?, 'out', 5, 'TEST-SALE', ?)
      `).run(product.id, product.id, ts);
    }

    const res = await request(app)
      .get('/api/v1/inventory/forecast')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const entry = res.body.data.forecast.find((f) => f.id === product.id);
    expect(entry).toBeDefined();
    expect(entry.days_until_stockout).toBeLessThanOrEqual(14);
    expect(entry.daily_velocity).toBeGreaterThan(0);
  });

  test('does not project a stockout for a product with no recent sales', async () => {
    const product = await createProduct({ stock: 5, low_stock_threshold: 2 });

    const res = await request(app)
      .get('/api/v1/inventory/forecast')
      .set('Authorization', `Bearer ${token}`);

    const entry = res.body.data.forecast.find((f) => f.id === product.id);
    expect(entry).toBeUndefined();
  });
});

describe('GET /api/v1/inventory', () => {
  test('lists inventory movements, optionally filtered by product', async () => {
    const product = await createProduct({ stock: 10 });
    await request(app)
      .post(`/api/v1/products/${product.id}/adjust-stock`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 2, type: 'in', reference: 'TEST' });

    const res = await request(app)
      .get('/api/v1/inventory')
      .set('Authorization', `Bearer ${token}`)
      .query({ product_id: product.id });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});
