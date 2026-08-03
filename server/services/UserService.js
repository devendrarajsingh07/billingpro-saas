'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const db = require('../config/database');
const UserRepository = require('../repositories/UserRepository');
const RoleRepository = require('../repositories/RoleRepository');
const CompanyRepository = require('../repositories/CompanyRepository');
const MailerService = require('./MailerService');
const { NotFoundError, ValidationError, ConflictError, ForbiddenError } = require('../utils/ApiError');

const userRepo = new UserRepository(db);
const roleRepo = new RoleRepository(db);
const companyRepo = new CompanyRepository(db);

function generateTempPassword() {
  // 12 random bytes -> 16-char base64url string, safe to email in plaintext
  return crypto.randomBytes(12).toString('base64url');
}

class UserService {
  static listUsers(companyId) {
    return db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.avatar, u.is_active,
             u.is_email_verified, u.last_login_at, u.created_at,
             r.id AS role_id, r.name AS role_name, r.slug AS role_slug
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.company_id = ? AND u.is_deleted = 0
      ORDER BY u.created_at ASC
    `).all(companyId);
  }

  static listRoles() {
    return roleRepo.findAllRoles();
  }

  /**
   * Invite a new user into the company with a system-generated temporary
   * password, emailed to them. This is the only way to add a user besides
   * the original registration flow (which only ever creates an owner).
   */
  static async inviteUser(companyId, data, invitedByUserId) {
    const { name, email, role_id, phone } = data;
    const normalizedEmail = email.toLowerCase().trim();

    if (userRepo.findByEmail(normalizedEmail)) {
      throw new ConflictError('A user with this email already exists.');
    }

    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(role_id);
    if (!role) {
      throw new ValidationError('Selected role does not exist.');
    }
    if (role.slug === 'owner') {
      throw new ValidationError('The Owner role is assigned automatically at signup and cannot be granted to invited users.');
    }

    const company = companyRepo.findById(companyId);
    const tempPassword = generateTempPassword();
    const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = bcrypt.hashSync(tempPassword, rounds);
    const now = new Date().toISOString();

    const user = userRepo.create({
      company_id: companyId,
      role_id,
      name: name.trim(),
      email: normalizedEmail,
      password_hash: passwordHash,
      phone: phone || null,
      is_active: 1,
      is_email_verified: 0,
      created_by: invitedByUserId,
      created_at: now,
      updated_at: now,
    });

    const mailResult = await MailerService.sendUserInviteEmail(
      normalizedEmail, name.trim(), company?.name || 'your workspace', tempPassword
    );

    const { password_hash, refresh_token, ...safeUser } = user;
    return { user: safeUser, emailSkipped: Boolean(mailResult?.skipped) };
  }

  static updateUser(companyId, userId, data, actingUserId) {
    const target = userRepo.findById(userId, companyId);
    if (!target) {
      throw new NotFoundError('User not found.');
    }

    const updates = {};

    if (data.role_id !== undefined) {
      const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(data.role_id);
      if (!role) throw new ValidationError('Selected role does not exist.');
      if (role.slug === 'owner') {
        throw new ValidationError("The Owner role cannot be assigned through this screen.");
      }
      // Prevent removing the only owner from the account entirely
      const targetRole = db.prepare('SELECT slug FROM roles WHERE id = ?').get(target.role_id);
      if (targetRole?.slug === 'owner') {
        throw new ForbiddenError("The company Owner's role cannot be changed.");
      }
      updates.role_id = data.role_id;
    }

    if (data.is_active !== undefined) {
      if (Number(userId) === Number(actingUserId) && !data.is_active) {
        throw new ValidationError('You cannot deactivate your own account.');
      }
      updates.is_active = data.is_active ? 1 : 0;
    }

    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.phone !== undefined) updates.phone = data.phone;

    return userRepo.update(userId, companyId, updates);
  }

  static removeUser(companyId, userId, actingUserId) {
    const target = userRepo.findById(userId, companyId);
    if (!target) {
      throw new NotFoundError('User not found.');
    }
    if (Number(userId) === Number(actingUserId)) {
      throw new ValidationError('You cannot remove your own account.');
    }

    const targetRole = db.prepare('SELECT slug FROM roles WHERE id = ?').get(target.role_id);
    if (targetRole?.slug === 'owner') {
      throw new ForbiddenError('The company Owner cannot be removed.');
    }

    return userRepo.softDelete(userId, companyId);
  }
}

module.exports = UserService;
