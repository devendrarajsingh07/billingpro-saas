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

async function createCustomer(overrides = {}) {
  return request(app)
    .post('/api/v1/customers')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Direct Customer Test', email: `direct-${Date.now()}@example.com`, ...overrides });
}

describe('Customers CRUD', () => {
  test('creates, lists, gets, updates, and deletes a customer', async () => {
    const created = await createCustomer();
    expect(created.status).toBe(201);

    const list = await request(app)
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);

    const get = await request(app)
      .get(`/api/v1/customers/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(200);

    const update = await request(app)
      .put(`/api/v1/customers/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed Customer' });
    expect(update.status).toBe(200);

    const del = await request(app)
      .delete(`/api/v1/customers/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
  });

  test('returns 404 for a nonexistent customer', async () => {
    const res = await request(app)
      .get('/api/v1/customers/999999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('Customer statement & purchase history', () => {
  test('returns a statement for a customer with invoices', async () => {
    const customer = await createCustomer();
    await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: customer.body.data.id,
        date: new Date().toISOString().split('T')[0],
        items: [{ description: 'Statement test item', qty: 1, unit_price: 500 }],
      });

    const res = await request(app)
      .get(`/api/v1/customers/${customer.body.data.id}/statement`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body.slice(0, 5).toString()).toBe('%PDF-');
  });

  test('returns 404 for a statement on a nonexistent customer', async () => {
    const res = await request(app)
      .get('/api/v1/customers/999999/statement')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('returns purchase history for a customer', async () => {
    const customer = await createCustomer();
    const res = await request(app)
      .get(`/api/v1/customers/${customer.body.data.id}/purchase-history`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
