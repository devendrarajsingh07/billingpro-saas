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

describe('GET /api/v1/company/me', () => {
  test('returns the company profile', async () => {
    const res = await request(app)
      .get('/api/v1/company/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(companyId);
  });
});

describe('PUT /api/v1/company/me', () => {
  test('updates legitimate settings fields', async () => {
    const res = await request(app)
      .put('/api/v1/company/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed Company Ltd', currency_code: 'USD', invoice_prefix: 'BILL' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed Company Ltd');
    expect(res.body.data.currency_code).toBe('USD');
    expect(res.body.data.invoice_prefix).toBe('BILL');
  });

  test('SECURITY: cannot self-upgrade the subscription plan via the settings endpoint', async () => {
    // Confirm baseline plan before the attempted exploit.
    const before = db.prepare('SELECT plan FROM companies WHERE id = ?').get(companyId).plan;
    expect(before).not.toBe('enterprise');

    const res = await request(app)
      .put('/api/v1/company/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Still A Normal Update', plan: 'enterprise', plan_expires_at: '2099-01-01' });

    // The request itself should succeed (other fields are valid)...
    expect(res.status).toBe(200);
    // ...but the plan must be completely untouched by it.
    expect(res.body.data.plan).toBe(before);

    const after = db.prepare('SELECT plan FROM companies WHERE id = ?').get(companyId).plan;
    expect(after).toBe(before);
  });

  test('ignores unknown/non-column fields silently rather than erroring', async () => {
    const res = await request(app)
      .put('/api/v1/company/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fine Name', totally_made_up_field: 'should be ignored' });
    expect(res.status).toBe(200);
  });
});
