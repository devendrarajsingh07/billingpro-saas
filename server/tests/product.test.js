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
      name: 'Test Widget',
      sku: `WIDGET-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      selling_price: 100,
      purchase_price: 60,
      stock: 20,
      ...overrides,
    });
  return res;
}

describe('Products CRUD', () => {
  test('creates a product', async () => {
    const res = await createProduct();
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Test Widget');
    expect(res.body.data.stock).toBe(20);
  });

  test('rejects a product with no name', async () => {
    const res = await createProduct({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('lists products', async () => {
    await createProduct();
    const res = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('gets a product by id', async () => {
    const created = await createProduct();
    const res = await request(app)
      .get(`/api/v1/products/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(created.body.data.id);
  });

  test('returns 404 for a nonexistent product', async () => {
    const res = await request(app)
      .get('/api/v1/products/999999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('updates a product', async () => {
    const created = await createProduct();
    const res = await request(app)
      .put(`/api/v1/products/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Widget', sku: created.body.data.sku, selling_price: 150 });
    expect(res.status).toBe(200);
  });

  test('deletes a product', async () => {
    const created = await createProduct();
    const res = await request(app)
      .delete(`/api/v1/products/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/products/:id/adjust-stock', () => {
  test('type=in increases stock and logs an inventory movement', async () => {
    const created = await createProduct({ stock: 10 });
    const productId = created.body.data.id;

    const res = await request(app)
      .post(`/api/v1/products/${productId}/adjust-stock`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 5, type: 'in', reference: 'TEST-IN', notes: 'Restock' });

    expect(res.status).toBe(200);

    const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId);
    expect(product.stock).toBe(15);

    const movement = db.prepare(
      `SELECT * FROM inventory WHERE product_id = ? ORDER BY id DESC LIMIT 1`
    ).get(productId);
    expect(movement.type).toBe('in');
    expect(movement.quantity).toBe(5);
  });

  test('type=out decreases stock', async () => {
    const created = await createProduct({ stock: 10 });
    const productId = created.body.data.id;

    const res = await request(app)
      .post(`/api/v1/products/${productId}/adjust-stock`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 4, type: 'out', reference: 'TEST-OUT' });

    expect(res.status).toBe(200);
    const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId);
    expect(product.stock).toBe(6);
  });

  test('type=adjustment applies a signed delta directly', async () => {
    const created = await createProduct({ stock: 10 });
    const productId = created.body.data.id;

    const res = await request(app)
      .post(`/api/v1/products/${productId}/adjust-stock`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: -3, type: 'adjustment', notes: 'Stock count correction' });

    expect(res.status).toBe(200);
    const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId);
    expect(product.stock).toBe(7);
  });
});
