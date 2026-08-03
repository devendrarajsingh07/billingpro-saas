'use strict';

const { AuthError } = require('../utils/ApiError');

/**
 * Tenant scope middleware.
 *
 * Ensures every authenticated request is scoped to the user's company.
 * Must be placed AFTER the authenticate middleware.
 *
 * - Attaches req.companyId from req.user.company_id
 * - Validates company_id is present
 *
 * Usage:
 *   router.use(authenticate, tenantScope);
 */
function tenantScope(req, res, next) {
  try {
    if (!req.user || !req.user.company_id) {
      throw new AuthError(
        'Unable to determine tenant scope. Please log in again.'
      );
    }

    // Normalize: always a number
    req.companyId = Number(req.user.company_id);

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = tenantScope;
