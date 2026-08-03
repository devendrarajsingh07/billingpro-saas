'use strict';

const request = require('supertest');
const { getApp, getDb, seedCompany } = require('./setup');

let app, db;

beforeAll(async () => {
  app = getApp();
  db = getDb();
  await seedCompany(app);
});

describe('Account lockout after repeated failed logins', () => {
  test('locks the account after 5 failed attempts and blocks even a correct password afterward', async () => {
    // 4 failed attempts — should each just report remaining attempts.
    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'owner@test.com', password: 'WrongPassword!' });
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/attempt\(s\) remaining/i);
    }

    // 5th failed attempt should trigger the lockout.
    const lockingAttempt = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@test.com', password: 'WrongPassword!' });
    expect(lockingAttempt.status).toBe(401);
    expect(lockingAttempt.body.message).toMatch(/locked/i);

    // Even the CORRECT password should now be rejected while locked.
    const correctButLocked = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@test.com', password: 'TestPass123!' });
    expect(correctButLocked.status).toBe(401);
    expect(correctButLocked.body.message).toMatch(/temporarily locked/i);

    // Confirm the lock is actually persisted in the DB, not just in-memory.
    const user = db.prepare('SELECT locked_until FROM users WHERE email = ?').get('owner@test.com');
    expect(user.locked_until).not.toBeNull();
    expect(new Date(user.locked_until).getTime()).toBeGreaterThan(Date.now());
  });
});
