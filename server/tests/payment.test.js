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
    .send({ name: 'Payment Test Customer', email: 'payment-customer@example.com' });
  customerId = custRes.body.data.id;
});

async function createInvoice(grandTotalHint = 1000) {
  const res = await request(app)
    .post('/api/v1/invoices')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customer_id: customerId,
      date: new Date().toISOString().split('T')[0],
      items: [
        { description: 'Consulting hours', qty: 1, unit_price: grandTotalHint, discount: 0, tax_rate: 0 },
      ],
    });
  return res.body.data;
}

describe('POST /api/v1/payments', () => {
  test('a partial payment marks the invoice as partial with remaining amount_due', async () => {
    const invoice = await createInvoice(1000);

    const res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ invoice_id: invoice.id, amount: 400, method: 'cash' });

    expect(res.status).toBe(201);

    const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice.id);
    expect(updated.status).toBe('partial');
    expect(updated.amount_paid).toBe(400);
    expect(updated.amount_due).toBe(600);
  });

  test('paying the remaining balance marks the invoice as paid', async () => {
    const invoice = await createInvoice(1000);

    await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ invoice_id: invoice.id, amount: 400, method: 'cash' });

    const res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ invoice_id: invoice.id, amount: 600, method: 'cash' });

    expect(res.status).toBe(201);

    const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice.id);
    expect(updated.status).toBe('paid');
    expect(updated.amount_due).toBe(0);
    expect(updated.paid_at).not.toBeNull();
  });

  test('returns 404 (not 500) for a payment against a nonexistent invoice', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ invoice_id: 999999, amount: 100, method: 'cash' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('lists payments for the company', async () => {
    const invoice = await createInvoice(500);
    await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ invoice_id: invoice.id, amount: 500, method: 'card' });

    const res = await request(app)
      .get('/api/v1/payments')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('gets a single payment by id', async () => {
    const invoice = await createInvoice(300);
    const created = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ invoice_id: invoice.id, amount: 300, method: 'upi' });

    const res = await request(app)
      .get(`/api/v1/payments/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe(300);
  });
});
