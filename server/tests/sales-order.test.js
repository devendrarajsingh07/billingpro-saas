'use strict';

const request = require('supertest');
const { getApp, getDb, seedCompany, getToken } = require('./setup');

let app, db, token, customerId;

beforeAll(async () => {
  app = getApp();
  db = getDb();
  await seedCompany(app);
  token = await getToken(app);

  const custRes = await request(app)
    .post('/api/v1/customers')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'SO Test Customer', email: 'so-customer@example.com' });
  customerId = custRes.body.data.id;
});

async function createSO(overrides = {}) {
  const res = await request(app)
    .post('/api/v1/sales-orders')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customer_id: customerId,
      date: new Date().toISOString().split('T')[0],
      items: [{ name: 'Consulting package', qty: 2, unit_price: 5000, tax_rate: 18 }],
      ...overrides,
    });
  return res;
}

describe('Sales Orders', () => {
  test('creates a sales order in draft status with computed totals', async () => {
    const res = await createSO();
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
    // subtotal = 2 * 5000 = 10000, tax = 18% = 1800, grand_total = 11800
    expect(res.body.data.subtotal).toBe(10000);
    expect(res.body.data.grand_total).toBe(11800);
  });

  test('rejects a sales order with no items', async () => {
    const res = await createSO({ items: [] });
    expect(res.status).toBe(400);
  });

  test('lists sales orders', async () => {
    await createSO();
    const res = await request(app)
      .get('/api/v1/sales-orders')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('gets a sales order by id', async () => {
    const created = await createSO();
    const res = await request(app)
      .get(`/api/v1/sales-orders/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('updates status to a valid value', async () => {
    const created = await createSO();
    const res = await request(app)
      .patch(`/api/v1/sales-orders/${created.body.data.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'confirmed' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('confirmed');
  });

  test('rejects an invalid status value', async () => {
    const created = await createSO();
    const res = await request(app)
      .patch(`/api/v1/sales-orders/${created.body.data.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'not_a_real_status' });
    expect(res.status).toBe(400);
  });

  test('deletes a sales order', async () => {
    const created = await createSO();
    const res = await request(app)
      .delete(`/api/v1/sales-orders/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/sales-orders/:id/convert-to-invoice', () => {
  test('converts a sales order into a draft invoice with matching totals', async () => {
    const created = await createSO();
    const res = await request(app)
      .post(`/api/v1/sales-orders/${created.body.data.id}/convert-to-invoice`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.data.grand_total).toBe(11800);

    const updatedSO = db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(created.body.data.id);
    expect(updatedSO.status).toBe('completed');
    expect(updatedSO.invoice_id).toBe(res.body.data.id);
  });

  test('returns 409 when converting the same sales order twice', async () => {
    const created = await createSO();
    await request(app)
      .post(`/api/v1/sales-orders/${created.body.data.id}/convert-to-invoice`)
      .set('Authorization', `Bearer ${token}`);

    const second = await request(app)
      .post(`/api/v1/sales-orders/${created.body.data.id}/convert-to-invoice`)
      .set('Authorization', `Bearer ${token}`);

    expect(second.status).toBe(409);
  });

  test('returns 404 for a nonexistent sales order', async () => {
    const res = await request(app)
      .post('/api/v1/sales-orders/999999/convert-to-invoice')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
