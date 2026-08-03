'use strict';

const request = require('supertest');
const { getApp, getDb, seedCompany, getToken } = require('./setup');

let app, db, token, supplierId, productId;

beforeAll(async () => {
  app = getApp();
  db = getDb();
  await seedCompany(app);
  token = await getToken(app);

  const supplierRes = await request(app)
    .post('/api/v1/suppliers')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'PO Test Supplier' });
  supplierId = supplierRes.body.data.id;

  const productRes = await request(app)
    .post('/api/v1/products')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'PO Test Product',
      sku: `PO-PROD-${Date.now()}`,
      selling_price: 200,
      purchase_price: 100,
      stock: 5,
    });
  productId = productRes.body.data.id;
});

async function createPO(overrides = {}) {
  const res = await request(app)
    .post('/api/v1/purchase-orders')
    .set('Authorization', `Bearer ${token}`)
    .send({
      supplier_id: supplierId,
      date: new Date().toISOString().split('T')[0],
      items: [{ product_id: productId, description: 'PO Test Product', qty: 10, unit_price: 100 }],
      ...overrides,
    });
  return res;
}

describe('Purchase Orders', () => {
  test('creates a purchase order in draft status', async () => {
    const res = await createPO();
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
  });

  test('rejects a purchase order with no items', async () => {
    const res = await createPO({ items: [] });
    expect(res.status).toBe(400);
  });

  test('lists purchase orders', async () => {
    await createPO();
    const res = await request(app)
      .get('/api/v1/purchase-orders')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('gets a purchase order by id', async () => {
    const created = await createPO();
    const res = await request(app)
      .get(`/api/v1/purchase-orders/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('valid transition draft -> sent -> received succeeds and increases stock', async () => {
    const before = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId).stock;
    const created = await createPO({
      items: [{ product_id: productId, description: 'PO Test Product', qty: 10, unit_price: 100 }],
    });
    const poId = created.body.data.id;

    const sentRes = await request(app)
      .patch(`/api/v1/purchase-orders/${poId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'sent' });
    expect(sentRes.status).toBe(200);

    const receivedRes = await request(app)
      .patch(`/api/v1/purchase-orders/${poId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'received' });
    expect(receivedRes.status).toBe(200);

    const after = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId).stock;
    expect(after).toBe(before + 10);
  });

  test('rejects an invalid transition (draft -> received directly)', async () => {
    const created = await createPO();
    const res = await request(app)
      .patch(`/api/v1/purchase-orders/${created.body.data.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'received' });
    expect(res.status).toBe(400);
  });

  test('cancelling a received PO reverses the stock increase', async () => {
    const before = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId).stock;
    const created = await createPO({
      items: [{ product_id: productId, description: 'PO Test Product', qty: 4, unit_price: 100 }],
    });
    const poId = created.body.data.id;

    await request(app)
      .patch(`/api/v1/purchase-orders/${poId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'sent' });
    await request(app)
      .patch(`/api/v1/purchase-orders/${poId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'received' });

    const afterReceive = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId).stock;
    expect(afterReceive).toBe(before + 4);

    const cancelRes = await request(app)
      .patch(`/api/v1/purchase-orders/${poId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' });
    expect(cancelRes.status).toBe(200);

    const afterCancel = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId).stock;
    expect(afterCancel).toBe(before);
  });

  test('deletes a purchase order', async () => {
    const created = await createPO();
    const res = await request(app)
      .delete(`/api/v1/purchase-orders/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
