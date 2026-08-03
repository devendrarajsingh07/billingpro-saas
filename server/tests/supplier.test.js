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

async function createSupplier(overrides = {}) {
  const res = await request(app)
    .post('/api/v1/suppliers')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Supplier Co', email: `supplier-${Date.now()}@example.com`, ...overrides });
  return res;
}

describe('Suppliers CRUD', () => {
  test('creates a supplier', async () => {
    const res = await createSupplier();
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Test Supplier Co');
  });

  test('rejects a supplier with no name', async () => {
    const res = await createSupplier({ name: '' });
    expect(res.status).toBe(400);
  });

  test('lists suppliers', async () => {
    await createSupplier();
    const res = await request(app)
      .get('/api/v1/suppliers')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('gets a supplier by id', async () => {
    const created = await createSupplier();
    const res = await request(app)
      .get(`/api/v1/suppliers/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('updates a supplier', async () => {
    const created = await createSupplier();
    const res = await request(app)
      .put(`/api/v1/suppliers/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed Supplier Co' });
    expect(res.status).toBe(200);
  });

  test('deletes a supplier', async () => {
    const created = await createSupplier();
    const res = await request(app)
      .delete(`/api/v1/suppliers/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('Supplier payments', () => {
  test('records a payment to a supplier', async () => {
    const supplier = await createSupplier();
    const res = await request(app)
      .post(`/api/v1/suppliers/${supplier.body.data.id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 5000, method: 'bank', reference_no: 'UTR001', paid_at: '2026-07-20' });

    expect(res.status).toBe(201);
  });

  test('rejects a payment with no amount', async () => {
    const supplier = await createSupplier();
    const res = await request(app)
      .post(`/api/v1/suppliers/${supplier.body.data.id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ method: 'cash', paid_at: '2026-07-20' });

    expect(res.status).toBe(400);
  });

  test('rejects a payment with no paid_at date', async () => {
    const supplier = await createSupplier();
    const res = await request(app)
      .post(`/api/v1/suppliers/${supplier.body.data.id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 1000, method: 'cash' });

    expect(res.status).toBe(400);
  });

  test('lists payments made to a supplier', async () => {
    const supplier = await createSupplier();
    await request(app)
      .post(`/api/v1/suppliers/${supplier.body.data.id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 2500, method: 'cash', paid_at: '2026-07-21' });

    const res = await request(app)
      .get(`/api/v1/suppliers/${supplier.body.data.id}/payments`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});
