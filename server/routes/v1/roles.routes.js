'use strict';

const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const ApiResponse = require('../../utils/ApiResponse');
const { authenticate } = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');

router.use(authenticate);

/**
 * @swagger
 * /api/v1/roles:
 *   get:
 *     tags: [Roles]
 *     summary: List all roles for this company (system roles + company-custom roles)
 *     responses:
 *       200: { description: List of roles, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.get('/', authorize('settings.read'), (req, res, next) => {
  try {
    const roles = db.prepare(`
      SELECT r.id, r.name, r.slug, r.description, r.is_system_role
      FROM roles r
      WHERE r.company_id IS NULL OR r.company_id = ?
      ORDER BY r.id ASC
    `).all(req.companyId);
    res.json(ApiResponse.success(roles, 'Roles fetched successfully.'));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/roles/permissions:
 *   get:
 *     tags: [Roles]
 *     summary: List all available permissions in the system
 *     responses:
 *       200: { description: List of permissions, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.get('/permissions', authorize('settings.read'), (req, res, next) => {
  try {
    const permissions = db.prepare(`
      SELECT id, name, resource, action, description FROM permissions ORDER BY resource, action
    `).all();
    res.json(ApiResponse.success(permissions, 'Permissions fetched successfully.'));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/roles/{id}/permissions:
 *   get:
 *     tags: [Roles]
 *     summary: Get all permissions assigned to a specific role
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Role's permissions, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.get('/:id/permissions', authorize('settings.read'), (req, res, next) => {
  try {
    const roleId = Number(req.params.id);
    const role = db.prepare(`
      SELECT id FROM roles
      WHERE id = ? AND (company_id IS NULL OR company_id = ?)
    `).get(roleId, req.companyId);
    if (!role) return res.status(404).json(ApiResponse.error('Role not found.'));

    const permissions = db.prepare(`
      SELECT p.id, p.name, p.resource, p.action, p.description
      FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      WHERE rp.role_id = ?
      ORDER BY p.resource, p.action
    `).all(roleId);
    res.json(ApiResponse.success(permissions, 'Role permissions fetched successfully.'));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/v1/roles/{id}/permissions:
 *   put:
 *     tags: [Roles]
 *     summary: Replace all permissions for a role (owner role cannot be modified)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               permission_ids: { type: array, items: { type: integer }, example: [1, 2, 3] }
 *     responses:
 *       200: { description: Permissions updated, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 *       403: { description: Cannot modify the owner role, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Role not found, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.put('/:id/permissions', authorize('settings.update'), (req, res, next) => {
  try {
    const roleId = Number(req.params.id);
    const { permission_ids = [] } = req.body;

    // System roles are shared by every tenant and must never be changed here.
    const role = db.prepare(`
      SELECT slug, is_system_role, company_id FROM roles
      WHERE id = ?
    `).get(roleId);
    if (!role) return res.status(404).json(ApiResponse.error('Role not found.'));
    if (role.is_system_role || role.company_id === null) {
      return res.status(403).json(ApiResponse.error('System role permissions cannot be modified.'));
    }
    if (Number(role.company_id) !== Number(req.companyId)) {
      return res.status(404).json(ApiResponse.error('Role not found.'));
    }
    if (!Array.isArray(permission_ids)) {
      return res.status(400).json(ApiResponse.error('permission_ids must be an array.'));
    }

    db.transaction(() => {
      db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId);
      const insert = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
      for (const pid of permission_ids) {
        insert.run(roleId, Number(pid));
      }
    })();

    const updated = db.prepare(`
      SELECT p.id, p.name, p.resource, p.action
      FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      WHERE rp.role_id = ?
    `).all(roleId);

    res.json(ApiResponse.success(updated, 'Role permissions updated successfully.'));
  } catch (err) { next(err); }
});

module.exports = router;
