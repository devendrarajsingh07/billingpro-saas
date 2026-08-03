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
    .send({ name: 'Invoice Test Customer', email: 'invoice-customer@example.com' });
  customerId = custRes.body.data.id;
});

async function createInvoice(overrides = {}) {
  return request(app)
    .post('/api/v1/invoices')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customer_id: customerId,
      date: new Date().toISOString().split('T')[0],
      items: [{ description: 'Test line item', qty: 2, unit_price: 500, tax_rate: 18 }],
      ...overrides,
    });
}

describe('Invoices CRUD', () => {
  test('creates an invoice with computed totals', async () => {
    const res = await createInvoice();
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
    // subtotal = 2*500 = 1000, tax 18% = 180, grand_total = 1180
    expect(res.body.data.subtotal).toBe(1000);
    expect(res.body.data.grand_total).toBe(1180);
    expect(res.body.data.amount_due).toBe(1180);
  });

  test('rejects an invoice with no items', async () => {
    const res = await createInvoice({ items: [] });
    expect(res.status).toBe(400);
  });

  test('rejects an invoice for a nonexistent customer', async () => {
    const res = await createInvoice({ customer_id: 999999 });
    expect([400, 404]).toContain(res.status);
  });

  test('lists invoices', async () => {
    await createInvoice();
    const res = await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('gets an invoice by id with line items', async () => {
    const created = await createInvoice();
    const res = await request(app)
      .get(`/api/v1/invoices/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items.length).toBe(1);
  });

  test('returns 404 for a nonexistent invoice', async () => {
    const res = await request(app)
      .get('/api/v1/invoices/999999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/invoices/:id/status', () => {
  test('transitions draft -> sent', async () => {
    const created = await createInvoice();
    const res = await request(app)
      .patch(`/api/v1/invoices/${created.body.data.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'sent' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('sent');
  });

  test('rejects an invalid status value with 400, not a raw 500', async () => {
    const created = await createInvoice();
    const res = await request(app)
      .patch(`/api/v1/invoices/${created.body.data.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'not_a_real_status' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('deducts stock only when paid and restores it on cancellation', async () => {
    const productRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Invoice Stock Test', sku: `INV-STOCK-${Date.now()}`, selling_price: 100, purchase_price: 50, stock: 20 });
    const productId = productRes.body.data.id;

    const created = await createInvoice({
      items: [{ product_id: productId, description: 'Stock-linked item', qty: 3, unit_price: 100 }],
    });

    // Sending creates a receivable but does not yet sell inventory.
    await request(app)
      .patch(`/api/v1/invoices/${created.body.data.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'sent' });

    const afterSent = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId).stock;
    expect(afterSent).toBe(20);

    await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ invoice_id: created.body.data.id, amount: 300, method: 'cash' });

    const afterPayment = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId).stock;
    expect(afterPayment).toBe(17);

    // Cancel a paid invoice — should restore the previously deducted stock.
    await request(app)
      .patch(`/api/v1/invoices/${created.body.data.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' });

    const afterCancel = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId).stock;
    expect(afterCancel).toBe(20);
  });
});

describe('POST /api/v1/invoices/:id/duplicate', () => {
  test('duplicates an invoice as a new draft with matching totals', async () => {
    const created = await createInvoice();
    const res = await request(app)
      .post(`/api/v1/invoices/${created.body.data.id}/duplicate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.data.id).not.toBe(created.body.data.id);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.grand_total).toBe(created.body.data.grand_total);
  });
});

describe('GET /api/v1/invoices/:id/pdf', () => {
  test('downloads a PDF with the correct content type', async () => {
    const created = await createInvoice();
    const res = await request(app)
      .get(`/api/v1/invoices/${created.body.data.id}/pdf`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    // A real PDF file starts with the %PDF- magic bytes.
    expect(res.body.slice(0, 5).toString()).toBe('%PDF-');
  });
});

describe('DELETE /api/v1/invoices/:id', () => {
  test('deletes a draft invoice', async () => {
    const created = await createInvoice();
    const res = await request(app)
      .delete(`/api/v1/invoices/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
