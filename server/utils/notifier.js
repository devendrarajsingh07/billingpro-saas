'use strict';

const db = require('../config/database');
const MailerService = require('../services/MailerService');
const SmsService = require('../services/SmsService');
const { logger } = require('./logger');

function createNotification(companyId, userId, type, title, body = null, data = null) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO notifications (company_id, user_id, type, title, body, data, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(companyId, userId, type, title, body, data ? JSON.stringify(data) : null, now);
}

/**
 * Notify every active owner/admin in a company — used for events that matter
 * to the business as a whole rather than to one specific user.
 */
function notifyCompanyAdmins(companyId, type, title, body = null, data = null) {
  const admins = db.prepare(`
    SELECT u.id, u.email, u.phone
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.company_id = ? AND u.is_deleted = 0 AND u.is_active = 1
      AND r.slug IN ('owner', 'admin')
  `).all(companyId);

  for (const admin of admins) {
    createNotification(companyId, admin.id, type, title, body, data);
  }

  return admins;
}

/**
 * Checks a product's current stock against its threshold and, if low,
 * notifies company admins in-app and by email. Safe to call after any
 * stock-affecting operation.
 */
function checkAndNotifyLowStock(companyId, productId) {
  const product = db.prepare(`
    SELECT * FROM products WHERE id = ? AND company_id = ? AND is_deleted = 0
  `).get(productId, companyId);

  if (!product || product.is_service) return;

  if (product.stock <= product.low_stock_threshold) {
    const admins = notifyCompanyAdmins(
      companyId,
      'low_stock',
      `Low stock: ${product.name}`,
      `${product.name} is down to ${product.stock} ${product.unit || 'units'} (threshold: ${product.low_stock_threshold}).`,
      { product_id: product.id }
    );

    for (const admin of admins) {
      if (admin.email) {
        MailerService.sendLowStockAlertEmail(admin.email, product).catch((err) => {
          logger.error(`[Mailer] Low stock alert email failed: ${err.message}`);
        });
      }
      if (admin.phone) {
        SmsService.sendLowStockAlertSms(admin.phone, product).catch((err) => {
          logger.error(`[SMS] Low stock alert SMS failed: ${err.message}`);
        });
      }
    }
  }
}

module.exports = { createNotification, notifyCompanyAdmins, checkAndNotifyLowStock };
