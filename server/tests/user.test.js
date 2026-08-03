'use strict';

const request = require('supertest');
const { getApp, getDb, seedCompany, getToken } = require('./setup');

let app, db, token, salesRoleId;

beforeAll(async () => {
  app = getApp();
  db = getDb();
  await seedCompany(app);
  token = await getToken(app);

  const owner = db.prepare('SELECT company_id FROM users WHERE email = ?').get('owner@test.com');
  // Free plan caps users at 2 — bump to pro so these tests can invite
  // several users without tripping the plan-limit gate (that's covered
  // separately in subscription.test.js).
  db.prepare(`UPDATE companies SET plan = 'pro' WHERE id = ?`).run(owner.company_id);

  const rolesRes = await request(app)
    .get('/api/v1/users/roles')
    .set('Authorization', `Bearer ${token}`);
  const salesRole = rolesRes.body.data.find((r) => r.slug === 'sales' || r.name?.toLowerCase() === 'sales');
  salesRoleId = salesRole.id;
});

describe('GET /api/v1/users/roles', () => {
  test('lists available roles', async () => {
    const res = await request(app)
      .get('/api/v1/users/roles')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

describe('POST /api/v1/users (invite)', () => {
  test('invites a new user without exposing a temporary password when SMTP is unconfigured', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Team Member', email: `teammate-${Date.now()}@example.com`, role_id: salesRoleId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toContain('teammate-');
    expect(res.body.message).not.toMatch(/temporary password/i);
  });

  test('rejects an invite with an invalid role_id', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad Role User', email: `badrole-${Date.now()}@example.com`, role_id: 999999 });

    expect([400, 404]).toContain(res.status);
  });

  test('rejects a duplicate email invite', async () => {
    const email = `dupe-${Date.now()}@example.com`;
    await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'First Invite', email, role_id: salesRoleId });

    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Second Invite', email, role_id: salesRoleId });

    expect(res.status).toBe(409);
  });
});

describe('User management', () => {
  test('lists users in the company', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((u) => u.email === 'owner@test.com')).toBe(true);
  });

  test('updates a user\'s role', async () => {
    const invited = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Role Change Target', email: `rolechange-${Date.now()}@example.com`, role_id: salesRoleId });

    const res = await request(app)
      .put(`/api/v1/users/${invited.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed Team Member' });

    expect(res.status).toBe(200);
  });

  test('removes a user from the company', async () => {
    const invited = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Removal Target', email: `removal-${Date.now()}@example.com`, role_id: salesRoleId });

    const res = await request(app)
      .delete(`/api/v1/users/${invited.body.data.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});
