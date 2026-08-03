'use strict';

const BaseRepository = require('./BaseRepository');

/**
 * RoleRepository — roles are system-wide (company_id IS NULL, seeded once at
 * migration time) rather than per-company, so this repository is read-only:
 * companies pick from the shared set of roles, they don't define their own.
 */
class RoleRepository extends BaseRepository {
  constructor(db) {
    super(db, 'roles');
  }

  findAllRoles() {
    return this.db.prepare(`
      SELECT id, name, slug, description
      FROM roles
      ORDER BY id ASC
    `).all();
  }

  findBySlug(slug) {
    return this.db.prepare(`SELECT * FROM roles WHERE slug = ? LIMIT 1`).get(slug);
  }

  /**
   * Permission names granted to a role — used to show what a role can do
   * before assigning it to a user.
   */
  getPermissionsForRole(roleId) {
    return this.db.prepare(`
      SELECT p.name, p.resource, p.action
      FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = ?
      ORDER BY p.resource ASC, p.action ASC
    `).all(roleId);
  }
}

module.exports = RoleRepository;
