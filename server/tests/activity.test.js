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

describe('GET /api/v1/activity', () => {
  test('records a login event and lists it', async () => {
    // Trigger another real login so there's a fresh, known audit entry.
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@test.com', password: 'TestPass123!' });
    expect(loginRes.status).toBe(200);

    const res = await request(app)
      .get('/api/v1/activity')
      .set('Authorization', `Bearer ${token}`)
      .query({ type: 'user' });

    expect(res.status).toBe(200);
    expect(res.body.data.some((a) => a.action === 'login')).toBe(true);
  });

  test('paginates results', async () => {
    const res = await request(app)
      .get('/api/v1/activity')
      .set('Authorization', `Bearer ${token}`)
      .query({ page: 1, limit: 5 });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
    expect(res.body.meta).toHaveProperty('total');
  });
});
