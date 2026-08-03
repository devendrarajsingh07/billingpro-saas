'use strict';

const SubscriptionService = require('../services/SubscriptionService');

/**
 * Middleware factory — blocks a create action once the company has hit its
 * plan's limit for that resource. Place after `authenticate` (needs
 * req.companyId) and before the create handler.
 *
 * @param {string} resource - One of the keys in config/plans.js PLAN_LIMITS
 *                             (e.g. 'customers', 'products', 'invoicesPerMonth')
 */
function enforcePlanLimit(resource) {
  return (req, res, next) => {
    try {
      SubscriptionService.enforceLimit(req.companyId, resource);
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { enforcePlanLimit };
