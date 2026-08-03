'use strict';

/**
 * Feature limits per subscription plan. `null` means unlimited.
 * Used by the plan-limit middleware to gate resource creation.
 */
const PLAN_LIMITS = {
  free: {
    users: 2,
    products: 50,
    customers: 100,
    suppliers: 10,
    invoicesPerMonth: 20,
  },
  pro: {
    users: 10,
    products: 2000,
    customers: 2000,
    suppliers: 200,
    invoicesPerMonth: 500,
  },
  enterprise: {
    users: null,
    products: null,
    customers: null,
    suppliers: null,
    invoicesPerMonth: null,
  },
};

const PLAN_ORDER = ['free', 'pro', 'enterprise'];

function getPlanLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

module.exports = { PLAN_LIMITS, PLAN_ORDER, getPlanLimits };
