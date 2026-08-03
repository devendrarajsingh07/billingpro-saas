'use strict';

const request = require('supertest');
const { getApp, getDb, seedCompany, getToken } = require('./setup');

let app, db, token, companyId;

beforeAll(async () => {
  app = getApp();
  db = getDb();
  await seedCompany(app);
  token = await getToken(app);

  const owner = db.prepare('SELECT company_id FROM users WHERE email = ?').get('owner@test.com');
  companyId = owner.company_id;
});

describe('GET /api/v1/subscriptions/me', () => {
  test('returns the current plan and usage overview', async () => {
    const res = await request(app)
      .get('/api/v1/subscriptions/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Plan limit enforcement (free plan, suppliers limit = 10)', () => {
  test('blocks supplier creation with 402 once the free-plan limit is reached', async () => {
    // Ensure we're on the free plan for this check.
    db.prepare(`UPDATE companies SET plan = 'free' WHERE id = ?`).run(companyId);

    // Fill up to the limit (10). Some suppliers may already exist from
    // other tests sharing this in-memory DB/company, so count first.
    const currentCount = db.prepare(
      `SELECT COUNT(*) AS n FROM suppliers WHERE company_id = ? AND is_deleted = 0`
    ).get(companyId).n;

    for (let i = currentCount; i < 10; i++) {
      const res = await request(app)
        .post('/api/v1/suppliers')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Filler Supplier ${i}` });
      expect(res.status).toBe(201);
    }

    // The 11th should be blocked.
    const blocked = await request(app)
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'One Too Many Supplier' });

    expect(blocked.status).toBe(402);
    expect(blocked.body.success).toBe(false);
    expect(blocked.body.code).toBe('PLAN_LIMIT_REACHED');
  });

  test('upgrading to pro raises the limit and creation succeeds again', async () => {
    db.prepare(`UPDATE companies SET plan = 'pro' WHERE id = ?`).run(companyId);

    const res = await request(app)
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Post-Upgrade Supplier' });

    expect(res.status).toBe(201);
  });
});
