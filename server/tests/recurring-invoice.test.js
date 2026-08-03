'use strict';

/**
 * Recurring Invoice Tests
 *
 * Covers RecurringInvoiceService.generateDueRecurringInvoices(): due-date
 * math, cloning of line items, parent/child linkage, and idempotency
 * (re-running the same day must not create duplicates).
 *
 * Uses supertest + the same in-memory SQLite DB as the other suites.
 */

const request = require('supertest');
const { getApp, getDb, seedCompany, getToken } = require('./setup');

let app;
let db;
let token;
let companyId;
let customerId;
let RecurringInvoiceService;

beforeAll(async () => {
  app = getApp();
  db = getDb();
  await seedCompany(app);
  token = await getToken(app);

  const owner = db.prepare('SELECT id, company_id FROM users WHERE email = ?').get('owner@test.com');
  companyId = owner.company_id;

  const custRes = await request(app)
    .post('/api/v1/customers')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Recurring Test Customer', email: 'recurring-customer@example.com' });
  customerId = custRes.body.data.id;

  RecurringInvoiceService = require('../services/RecurringInvoiceService');
});

/**
 * Directly creates a recurring "template" invoice dated `daysAgo` days in
 * the past, via the real InvoiceService (so items/totals are computed the
 * same way a normal invoice would be).
 */
async function createTemplate({ interval, daysAgo }) {
  const InvoiceService = require('../services/InvoiceService');
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const dateStr = date.toISOString().split('T')[0];

  const dueDate = new Date(date);
  dueDate.setDate(dueDate.getDate() + 15);

  return InvoiceService.createInvoice(companyId, {
    customer_id: customerId,
    date: dateStr,
    due_date: dueDate.toISOString().split('T')[0],
    is_recurring: 1,
    recurring_interval: interval,
    status: 'sent',
    items: [
      { description: 'Monthly hosting plan', qty: 1, unit_price: 500, discount: 0, tax_rate: 0 },
    ],
  });
}

describe('RecurringInvoiceService.generateDueRecurringInvoices', () => {
  test('generates a clone once a monthly template is past due', async () => {
    const template = await createTemplate({ interval: 'monthly', daysAgo: 35 });

    const result = RecurringInvoiceService.generateDueRecurringInvoices();

    expect(result.generated).toBeGreaterThanOrEqual(1);

    const children = db.prepare(
      'SELECT * FROM invoices WHERE parent_invoice_id = ?'
    ).all(template.id);

    expect(children.length).toBeGreaterThanOrEqual(1);
    // Child should not itself be recurring — only the template is.
    expect(children[0].is_recurring).toBe(0);
  });

  test('clones the template line items onto the generated invoice', async () => {
    const template = await createTemplate({ interval: 'monthly', daysAgo: 32 });
    RecurringInvoiceService.generateDueRecurringInvoices();

    const child = db.prepare(
      'SELECT id FROM invoices WHERE parent_invoice_id = ? ORDER BY id DESC LIMIT 1'
    ).get(template.id);
    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(child.id);

    expect(items.length).toBe(1);
    expect(items[0].description).toBe('Monthly hosting plan');
    expect(items[0].qty).toBe(1);
  });

  test('is idempotent — a second run the same day does not duplicate', async () => {
    const template = await createTemplate({ interval: 'weekly', daysAgo: 10 });

    const first = RecurringInvoiceService.generateDueRecurringInvoices();
    const before = db.prepare(
      'SELECT COUNT(*) AS n FROM invoices WHERE parent_invoice_id = ?'
    ).get(template.id).n;

    const second = RecurringInvoiceService.generateDueRecurringInvoices();
    const after = db.prepare(
      'SELECT COUNT(*) AS n FROM invoices WHERE parent_invoice_id = ?'
    ).get(template.id).n;

    expect(after).toBe(before);
    expect(second.generated).toBeLessThanOrEqual(first.generated);
  });

  test('does not generate for a template that is not yet due', async () => {
    await createTemplate({ interval: 'yearly', daysAgo: 1 });

    // A yearly template created yesterday has no due clone for ~364 days.
    const before = db.prepare('SELECT COUNT(*) AS n FROM invoices').get().n;
    RecurringInvoiceService.generateDueRecurringInvoices();
    const after = db.prepare('SELECT COUNT(*) AS n FROM invoices').get().n;

    expect(after).toBe(before);
  });

  test('skips cancelled recurring templates', async () => {
    const template = await createTemplate({ interval: 'monthly', daysAgo: 40 });
    db.prepare(`UPDATE invoices SET status = 'cancelled' WHERE id = ?`).run(template.id);

    RecurringInvoiceService.generateDueRecurringInvoices();

    const children = db.prepare(
      'SELECT COUNT(*) AS n FROM invoices WHERE parent_invoice_id = ?'
    ).get(template.id).n;
    expect(children).toBe(0);
  });

  test('catches up multiple missed periods for a weekly template', async () => {
    // ~5 weeks overdue on a weekly cadence should produce multiple clones.
    const template = await createTemplate({ interval: 'weekly', daysAgo: 40 });

    RecurringInvoiceService.generateDueRecurringInvoices();

    const children = db.prepare(
      'SELECT COUNT(*) AS n FROM invoices WHERE parent_invoice_id = ?'
    ).get(template.id).n;
    expect(children).toBeGreaterThanOrEqual(4);
  });
});
