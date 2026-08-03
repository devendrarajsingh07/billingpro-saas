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
    .send({ name: 'Zenith Search Corp', email: 'zenith@example.com' });
  customerId = custRes.body.data.id;
});

describe('GET /api/v1/search', () => {
  test('finds a matching customer by name', async () => {
    const res = await request(app)
      .get('/api/v1/search')
      .set('Authorization', `Bearer ${token}`)
      .query({ q: 'Zenith' });

    expect(res.status).toBe(200);
    expect(res.body.data.customers.some((c) => c.id === customerId)).toBe(true);
  });

  test('finds a matching invoice without crashing (regression: invoices query referenced a nonexistent column)', async () => {
    const invRes = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: customerId,
        date: '2026-07-20',
        items: [{ description: 'Search test item', qty: 1, unit_price: 100 }],
      });

    const res = await request(app)
      .get('/api/v1/search')
      .set('Authorization', `Bearer ${token}`)
      .query({ q: invRes.body.data.invoice_no });

    expect(res.status).toBe(200);
    expect(res.body.data.invoices.some((i) => i.id === invRes.body.data.id)).toBe(true);
    // Confirms the date field actually made it through under the right key.
    expect(res.body.data.invoices[0].date).toBeTruthy();
  });

  test('finds a matching payment without crashing (regression: payments query referenced a nonexistent is_deleted column)', async () => {
    const invRes = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: customerId,
        date: '2026-07-21',
        items: [{ description: 'Payment search item', qty: 1, unit_price: 250 }],
      });
    await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ invoice_id: invRes.body.data.id, amount: 250, method: 'cash', reference_no: 'SEARCHREF001' });

    const res = await request(app)
      .get('/api/v1/search')
      .set('Authorization', `Bearer ${token}`)
      .query({ q: 'SEARCHREF001' });

    expect(res.status).toBe(200);
    expect(res.body.data.payments.length).toBeGreaterThan(0);
  });

  test('returns empty result groups for an empty query', async () => {
    const res = await request(app)
      .get('/api/v1/search')
      .set('Authorization', `Bearer ${token}`)
      .query({ q: '' });

    expect(res.status).toBe(200);
    expect(res.body.data.customers).toEqual([]);
  });
});
