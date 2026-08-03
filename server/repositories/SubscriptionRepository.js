'use strict';

const BaseRepository = require('./BaseRepository');

class SubscriptionRepository extends BaseRepository {
  constructor(db) {
    super(db, 'subscriptions');
  }

  findByCompany(companyId) {
    return this.db.prepare(`SELECT * FROM subscriptions WHERE company_id = ?`).get(companyId);
  }

  /**
   * Change plan — updates both the subscriptions row and the denormalized
   * companies.plan column that the rest of the app reads for gating.
   */
  changePlan(companyId, plan) {
    const now = new Date().toISOString();

    return this.db.transaction(() => {
      this.db.prepare(`
        UPDATE subscriptions
        SET plan = ?, status = 'active', cancelled_at = NULL, updated_at = ?
        WHERE company_id = ?
      `).run(plan, now, companyId);

      this.db.prepare(`
        UPDATE companies SET plan = ?, updated_at = ? WHERE id = ?
      `).run(plan, now, companyId);

      return this.findByCompany(companyId);
    })();
  }

  cancel(companyId) {
    const now = new Date().toISOString();

    return this.db.transaction(() => {
      this.db.prepare(`
        UPDATE subscriptions
        SET status = 'cancelled', cancelled_at = ?, updated_at = ?
        WHERE company_id = ?
      `).run(now, now, companyId);

      // Cancelling drops the company back to the free plan rather than
      // leaving them on a paid plan with a 'cancelled' subscription status.
      this.db.prepare(`
        UPDATE companies SET plan = 'free', updated_at = ? WHERE id = ?
      `).run(now, companyId);

      return this.findByCompany(companyId);
    })();
  }

  /**
   * Current usage counts against plan limits — used to show "3 / 10 users"
   * style meters and to block creation once a limit is hit.
   */
  getUsage(companyId) {
    const count = (sql) => this.db.prepare(sql).get(companyId).total;

    return {
      users: count(`SELECT COUNT(*) AS total FROM users WHERE company_id = ? AND is_deleted = 0`),
      products: count(`SELECT COUNT(*) AS total FROM products WHERE company_id = ? AND is_deleted = 0`),
      customers: count(`SELECT COUNT(*) AS total FROM customers WHERE company_id = ? AND is_deleted = 0`),
      suppliers: count(`SELECT COUNT(*) AS total FROM suppliers WHERE company_id = ? AND is_deleted = 0`),
      invoicesPerMonth: this.db.prepare(`
        SELECT COUNT(*) AS total FROM invoices
        WHERE company_id = ? AND is_deleted = 0
          AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
      `).get(companyId).total,
    };
  }
}

module.exports = SubscriptionRepository;
