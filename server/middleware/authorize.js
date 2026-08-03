'use strict';

const db = require('../config/database');
const { ForbiddenError } = require('../utils/ApiError');

/**
 * Permission-based authorization middleware factory.
 *
 * Usage:
 *   router.get('/customers', authenticate, authorize('customers.read'), handler)
 *
 * @param {string} permission - Required permission name (e.g. 'invoices.create')
 * @returns {Function} Express middleware
 */
function authorize(permission) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Authentication required before authorization.');
      }

      const { role_slug, role_id } = req.user;

      // Owner and admin roles bypass all permission checks
      if (role_slug === 'owner' || role_slug === 'admin') {
        return next();
      }

      if (!role_id) {
        throw new ForbiddenError(
          `Access denied. Your account has no role assigned.`
        );
      }

      // Look up whether the role has the specific permission
      const record = db.prepare(`
        SELECT rp.role_id
        FROM role_permissions rp
        INNER JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = ? AND p.name = ?
        LIMIT 1
      `).get(role_id, permission);

      if (!record) {
        throw new ForbiddenError(
          `Access denied. Permission required: '${permission}'.`
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Multi-permission authorization — user must have ALL listed permissions.
 *
 * @param {...string} permissions
 * @returns {Function} Express middleware
 */
function authorizeAll(...permissions) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Authentication required before authorization.');
      }

      const { role_slug, role_id } = req.user;

      if (role_slug === 'owner' || role_slug === 'admin') {
        return next();
      }

      if (!role_id) {
        throw new ForbiddenError('Account has no role assigned.');
      }

      for (const permission of permissions) {
        const record = db.prepare(`
          SELECT rp.role_id
          FROM role_permissions rp
          INNER JOIN permissions p ON p.id = rp.permission_id
          WHERE rp.role_id = ? AND p.name = ?
          LIMIT 1
        `).get(role_id, permission);

        if (!record) {
          throw new ForbiddenError(
            `Access denied. Missing required permission: '${permission}'.`
          );
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Multi-permission authorization — user must have AT LEAST ONE of the listed permissions.
 *
 * @param {...string} permissions
 * @returns {Function} Express middleware
 */
function authorizeAny(...permissions) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Authentication required before authorization.');
      }

      const { role_slug, role_id } = req.user;

      if (role_slug === 'owner' || role_slug === 'admin') {
        return next();
      }

      if (!role_id) {
        throw new ForbiddenError('Account has no role assigned.');
      }

      const placeholders = permissions.map(() => '?').join(', ');
      const record = db.prepare(`
        SELECT rp.role_id
        FROM role_permissions rp
        INNER JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = ? AND p.name IN (${placeholders})
        LIMIT 1
      `).get(role_id, ...permissions);

      if (!record) {
        throw new ForbiddenError(
          `Access denied. Required one of: ${permissions.join(', ')}.`
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { authorize, authorizeAll, authorizeAny };
