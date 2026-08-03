'use strict';

const db = require('../config/database');
const SubscriptionRepository = require('../repositories/SubscriptionRepository');
const { PLAN_LIMITS, PLAN_ORDER, getPlanLimits } = require('../config/plans');
const { NotFoundError, ValidationError, PaymentRequiredError } = require('../utils/ApiError');

const subscriptionRepo = new SubscriptionRepository(db);

class SubscriptionService {
  /**
   * Current plan, its limits, and live usage counts — powers the
   * "3 / 10 users" style meters on the client's Plan & Billing screen.
   */
  static getSubscriptionOverview(companyId) {
    let subscription = subscriptionRepo.findByCompany(companyId);

    // Every company should have a subscriptions row (created at signup), but
    // heal gracefully if one is somehow missing rather than 500ing the page.
    if (!subscription) {
      const company = db.prepare('SELECT plan FROM companies WHERE id = ?').get(companyId);
      subscription = subscriptionRepo.create({
        company_id: companyId,
        plan: company?.plan || 'free',
        status: 'active',
      });
    }

    const limits = getPlanLimits(subscription.plan);
    const usage = subscriptionRepo.getUsage(companyId);

    return {
      subscription,
      limits,
      usage,
      plans: Object.entries(PLAN_LIMITS).map(([key, val]) => ({ key, ...val })),
    };
  }

  static changePlan(companyId, newPlan) {
    if (!PLAN_ORDER.includes(newPlan)) {
      throw new ValidationError(`Plan must be one of: ${PLAN_ORDER.join(', ')}.`);
    }

    // Downgrading below current usage is blocked — otherwise a company could
    // end up over its own new limit with no way to fix it via the UI.
    const usage = subscriptionRepo.getUsage(companyId);
    const newLimits = getPlanLimits(newPlan);

    for (const [resource, count] of Object.entries(usage)) {
      const limit = newLimits[resource];
      if (limit !== null && limit !== undefined && count > limit) {
        throw new ValidationError(
          `Cannot switch to the ${newPlan} plan — you currently have ${count} ${resource}, which exceeds its limit of ${limit}. Reduce usage first or choose a higher plan.`
        );
      }
    }

    return subscriptionRepo.changePlan(companyId, newPlan);
  }

  static cancelSubscription(companyId) {
    return subscriptionRepo.cancel(companyId);
  }

  /**
   * Throws PaymentRequiredError if creating one more of `resource` would
   * exceed the company's current plan limit. No-op (allows) for unlimited
   * plans or resources without a configured limit.
   */
  static enforceLimit(companyId, resource) {
    const company = db.prepare('SELECT plan FROM companies WHERE id = ?').get(companyId);
    if (!company) throw new NotFoundError('Company not found.');

    const limits = getPlanLimits(company.plan);
    const limit = limits[resource];
    if (limit === null || limit === undefined) return; // unlimited or unrestricted resource

    const usage = subscriptionRepo.getUsage(companyId);
    const current = usage[resource] ?? 0;

    if (current >= limit) {
      throw new PaymentRequiredError(
        `You've reached your ${limits.label || company.plan} plan limit of ${limit} for ${resource.replace(/([A-Z])/g, ' $1').toLowerCase()}. Upgrade your plan to add more.`
      );
    }
  }
}

module.exports = SubscriptionService;
