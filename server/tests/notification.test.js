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
    .send({ name: 'Notification Test Customer', email: 'notif-customer@example.com' });
  customerId = custRes.body.data.id;
});

/** Triggers a real payment.recorded event, which notifies company admins (the owner/test user included). */
async function triggerPaymentNotification() {
  const invoiceRes = await request(app)
    .post('/api/v1/invoices')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customer_id: customerId,
      date: new Date().toISOString().split('T')[0],
      items: [{ description: 'Notification trigger item', qty: 1, unit_price: 100 }],
    });

  await request(app)
    .post('/api/v1/payments')
    .set('Authorization', `Bearer ${token}`)
    .send({ invoice_id: invoiceRes.body.data.id, amount: 100, method: 'cash' });
}

describe('Notifications', () => {
  test('unread count increases after a triggering event', async () => {
    const before = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);

    await triggerPaymentNotification();

    const after = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);

    expect(after.body.data.count).toBeGreaterThan(before.body.data.count);
  });

  test('lists notifications with parsed data payload', async () => {
    await triggerPaymentNotification();

    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    const paymentNotif = res.body.data.find((n) => n.type === 'payment_recorded');
    expect(paymentNotif).toBeDefined();
    expect(typeof paymentNotif.data).toBe('object');
    expect(paymentNotif.data).toHaveProperty('invoice_id');
  });

  test('marks a single notification as read', async () => {
    await triggerPaymentNotification();
    const list = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`);
    const target = list.body.data.find((n) => !n.is_read) || list.body.data[0];

    const res = await request(app)
      .patch(`/api/v1/notifications/${target.id}/read`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const row = db.prepare('SELECT is_read FROM notifications WHERE id = ?').get(target.id);
    expect(row.is_read).toBe(1);
  });

  test('marks all notifications as read, dropping unread count to 0', async () => {
    await triggerPaymentNotification();
    await triggerPaymentNotification();

    const markAllRes = await request(app)
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${token}`);
    expect(markAllRes.status).toBe(200);

    const countRes = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);
    expect(countRes.body.data.count).toBe(0);
  });
});
