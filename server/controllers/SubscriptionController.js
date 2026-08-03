'use strict';

const SubscriptionService = require('../services/SubscriptionService');
const ApiResponse = require('../utils/ApiResponse');

class SubscriptionController {
  static async getOverview(req, res, next) {
    try {
      const overview = SubscriptionService.getSubscriptionOverview(req.companyId);
      res.json(ApiResponse.success(overview, 'Subscription overview fetched successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async changePlan(req, res, next) {
    try {
      const { plan } = req.body;
      const subscription = SubscriptionService.changePlan(req.companyId, plan);
      res.json(ApiResponse.success(subscription, `Plan changed to ${plan} successfully.`));
    } catch (err) {
      next(err);
    }
  }

  static async cancel(req, res, next) {
    try {
      const subscription = SubscriptionService.cancelSubscription(req.companyId);
      res.json(ApiResponse.success(subscription, 'Subscription cancelled — moved to the Free plan.'));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = SubscriptionController;
