'use strict';

const eventBus = require('../eventBus');
const { logger } = require('../../utils/logger');
const db = require('../../config/database');
const MailerService = require('../../services/MailerService');

// Derive client base URL from environment (fallback to localhost for dev)
const CLIENT_BASE_URL = process.env.CLIENT_URL || 'http://localhost:5174';

function registerAuthEvents() {
  // ─────────────────────────────────────────────────────────────
  // User Registered — audit log + verification email
  // ─────────────────────────────────────────────────────────────
  eventBus.on('user.registered', ({ user, company, verifyToken }) => {
    try {
      logger.info(`[Event] User registered: ${user.email} for company ${company.name}`);

      // Create audit log
      db.prepare(`
        INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, after_data)
        VALUES (?, ?, 'register', 'user', ?, ?)
      `).run(
        company.id,
        user.id,
        user.id,
        JSON.stringify({ email: user.email, name: user.name })
      );

      // Send email verification (best-effort; SMTP may not be configured)
      if (verifyToken) {
        const verifyUrl = `${CLIENT_BASE_URL}/verify-email?token=${verifyToken}`;
        if (process.env.NODE_ENV === 'development') {
          logger.info(`[Dev Link] Verify Email: ${verifyUrl}`);
        }
        MailerService.sendEmailVerificationEmail(user.email, user.name, verifyUrl)
          .then(result => {
            if (result?.skipped) {
              logger.warn(`[Event] Verification email skipped for ${user.email}: ${result.reason}`);
            }
          })
          .catch(err => logger.error(`[Event Error] Failed to send verification email: ${err.message}`));
      }

      // Send welcome email (best-effort)
      MailerService.sendWelcomeEmail(user.email, user.name, company.name)
        .catch(err => logger.error(`[Event Error] Failed to send welcome email: ${err.message}`));

    } catch (err) {
      logger.error(`[Event Error] Failed during user.registered handler: ${err.message}`);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // User Logged In — audit log
  // ─────────────────────────────────────────────────────────────
  eventBus.on('user.loggedIn', ({ user, ip }) => {
    try {
      logger.info(`[Event] User logged in: ${user.email} from IP ${ip}`);

      db.prepare(`
        INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address)
        VALUES (?, ?, 'login', 'user', ?, ?)
      `).run(
        user.company_id,
        user.id,
        user.id,
        ip
      );
    } catch (err) {
      logger.error(`[Event Error] Failed during user.loggedIn handler: ${err.message}`);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // Password Reset Requested — send reset email
  // ─────────────────────────────────────────────────────────────
  eventBus.on('user.passwordResetRequested', ({ user, token }) => {
    try {
      logger.info(`[Event] Password reset requested for: ${user.email}`);

      const resetUrl = `${CLIENT_BASE_URL}/reset-password?token=${token}`;

      if (process.env.NODE_ENV === 'development') {
        logger.info(`[Dev Link] Reset Password: ${resetUrl}`);
      }

      MailerService.sendPasswordResetEmail(user.email, user.name, resetUrl)
        .then(result => {
          if (result?.skipped) {
            logger.warn(`[Event] Password reset email skipped for ${user.email}: ${result.reason}`);
          } else {
            logger.info(`[Event] Password reset email sent to ${user.email}`);
          }
        })
        .catch(err => logger.error(`[Event Error] Failed to send password reset email: ${err.message}`));

    } catch (err) {
      logger.error(`[Event Error] Failed during user.passwordResetRequested: ${err.message}`);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // Password Reset Completed — audit log
  // ─────────────────────────────────────────────────────────────
  eventBus.on('user.passwordReset', ({ user }) => {
    try {
      logger.info(`[Event] Password reset successfully for user: ${user.email}`);

      db.prepare(`
        INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id)
        VALUES (?, ?, 'reset_password', 'user', ?)
      `).run(
        user.company_id,
        user.id,
        user.id
      );
    } catch (err) {
      logger.error(`[Event Error] Failed during user.passwordReset handler: ${err.message}`);
    }
  });
}

module.exports = registerAuthEvents;
