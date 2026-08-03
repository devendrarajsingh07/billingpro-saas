'use strict';

const nodemailer = require('nodemailer');
const xss = require('xss');
const config = require('../config/env');
const { logger } = require('../utils/logger');

let transporter = null;

/**
 * Escapes untrusted, user-entered text (names, notes, invoice numbers, etc.)
 * before it's interpolated into HTML email templates. Prevents a customer
 * or product name containing markup from breaking the email layout or
 * being used as an injection vector.
 */
function esc(value) {
  if (value === null || value === undefined) return '';
  return xss(String(value), { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script'] });
}

function isConfigured() {
  return Boolean(
    config.smtp.host &&
    config.smtp.user &&
    !config.smtp.user.includes('your_email') // ignore the placeholder value shipped in .env.example
  );
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return transporter;
}

class MailerService {
  /**
   * Generic send. Resolves with { skipped: true } instead of throwing when
   * SMTP isn't configured, so callers can treat email as best-effort.
   */
  static async sendMail({ to, subject, html, attachments = [] }) {
    if (!to) {
      logger.warn(`[Mailer] Skipping "${subject}" — no recipient email on file.`);
      return { skipped: true, reason: 'no_recipient' };
    }

    if (!isConfigured()) {
      logger.warn(`[Mailer] SMTP not configured — skipping email to ${to} ("${subject}").`);
      return { skipped: true, reason: 'smtp_not_configured' };
    }

    const info = await getTransporter().sendMail({
      from: `"${config.app.name}" <${config.smtp.from}>`,
      to,
      subject,
      html,
      attachments,
    });

    logger.info(`[Mailer] Sent "${subject}" to ${to} (messageId: ${info.messageId})`);
    return info;
  }

  static async sendInvoiceEmail(invoice, pdfBuffer) {
    const html = `
      <p>Dear ${esc(invoice.customer_name) || 'Customer'},</p>
      <p>Please find attached invoice <strong>${esc(invoice.invoice_no)}</strong> for
      <strong>${esc(invoice.grand_total)}</strong>, due on ${esc(invoice.due_date) || 'receipt'}.</p>
      <p>Thank you for your business.</p>
    `;
    return this.sendMail({
      to: invoice.customer_email,
      subject: `Invoice ${invoice.invoice_no}`,
      html,
      attachments: pdfBuffer
        ? [{ filename: `Invoice-${invoice.invoice_no}.pdf`, content: pdfBuffer }]
        : [],
    });
  }

  static async sendPaymentReceiptEmail(payment, invoice) {
    const html = `
      <p>Dear ${esc(invoice.customer_name) || 'Customer'},</p>
      <p>We've recorded a payment of <strong>${esc(payment.amount)}</strong> against invoice
      <strong>${esc(invoice.invoice_no)}</strong>.</p>
      <p>Remaining balance: <strong>${esc(invoice.amount_due)}</strong>.</p>
    `;
    return this.sendMail({
      to: invoice.customer_email,
      subject: `Payment Receipt — Invoice ${invoice.invoice_no}`,
      html,
    });
  }

  static async sendLowStockAlertEmail(to, product) {
    const html = `
      <p><strong>${esc(product.name)}</strong> is running low: ${esc(product.stock)} ${esc(product.unit) || 'units'}
      remaining (threshold: ${esc(product.low_stock_threshold)}).</p>
    `;
    return this.sendMail({ to, subject: `Low stock alert: ${product.name}`, html });
  }

  static async sendUserInviteEmail(to, name, companyName, tempPassword) {
    const html = `
      <p>Hi ${esc(name)},</p>
      <p>You've been invited to join <strong>${esc(companyName)}</strong> on ${esc(config.app.name)}.</p>
      <p>Your temporary password is: <strong>${esc(tempPassword)}</strong></p>
      <p>Please log in and change your password as soon as possible.</p>
    `;
    return this.sendMail({ to, subject: `You've been invited to ${companyName}`, html });
  }

  /**
   * Sends an overdue payment reminder to a customer.
   * @param {{ invoice_no, grand_total, amount_due, due_date, customer_name, customer_email, company_name }} invoice
   */
  static async sendOverdueReminder(invoice) {
    const daysOverdue = Math.floor(
      (Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    const html = `
      <p>Dear ${esc(invoice.customer_name) || 'Customer'},</p>
      <p>This is a friendly reminder that invoice <strong>${esc(invoice.invoice_no)}</strong> from
      <strong>${esc(invoice.company_name)}</strong> is <strong>${daysOverdue} day(s) overdue</strong>.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 16px 4px 0;color:#666">Invoice No</td><td><strong>${esc(invoice.invoice_no)}</strong></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#666">Total Amount</td><td><strong>${esc(invoice.grand_total)}</strong></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#666">Amount Due</td><td><strong>${esc(invoice.amount_due)}</strong></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#666">Due Date</td><td><strong>${esc(invoice.due_date)}</strong></td></tr>
      </table>
      <p>Please make your payment at your earliest convenience to avoid any service interruptions.</p>
      <p>If you have already made this payment, please disregard this reminder.</p>
      <p>Thank you,<br>${esc(invoice.company_name)}</p>
    `;
    return this.sendMail({
      to: invoice.customer_email,
      subject: `Payment Reminder: Invoice ${invoice.invoice_no} is ${daysOverdue} day(s) overdue`,
      html,
    });
  }

  /**
   * Sends a welcome email after a new user registers.
   */
  static async sendWelcomeEmail(to, name, companyName) {
    const html = `
      <p>Hi ${esc(name)},</p>
      <p>Welcome to <strong>${esc(config.app.name)}</strong>! Your workspace <strong>${esc(companyName)}</strong> is ready.</p>
      <p>Get started by adding your first customer and creating an invoice.</p>
      <p>Happy billing! 🚀</p>
    `;
    return this.sendMail({ to, subject: `Welcome to ${config.app.name}`, html });
  }

  /**
   * Sends a password reset link email.
   * @param {string} to           - Recipient email address
   * @param {string} name         - Recipient display name
   * @param {string} resetUrl     - Full reset URL including token
   */
  static async sendPasswordResetEmail(to, name, resetUrl) {
    const appName = config.app.name;
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
          <tr><td align="center">
            <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
              <!-- Header -->
              <tr><td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:32px;text-align:center">
                <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px">${appName}</h1>
                <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px">Password Reset Request</p>
              </td></tr>
              <!-- Body -->
              <tr><td style="padding:40px 40px 32px">
                <p style="margin:0 0 16px;color:#374151;font-size:16px">Hi <strong>${esc(name)}</strong>,</p>
                <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">
                  We received a request to reset your password for your <strong>${appName}</strong> account.
                  Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.
                </p>
                <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px">
                  <tr><td style="border-radius:10px;background:linear-gradient(135deg,#4f46e5,#7c3aed)">
                    <a href="${resetUrl}" style="display:block;padding:14px 32px;color:#fff;text-decoration:none;font-weight:600;font-size:15px">
                      Reset My Password →
                    </a>
                  </td></tr>
                </table>
                <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;text-align:center">
                  Or copy and paste this link:
                </p>
                <p style="margin:0 0 24px;color:#4f46e5;font-size:12px;word-break:break-all;text-align:center;background:#f5f3ff;padding:12px;border-radius:8px">
                  ${resetUrl}
                </p>
                <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5">
                  If you didn't request a password reset, you can safely ignore this email.
                  Your password will remain unchanged.
                </p>
              </td></tr>
              <!-- Footer -->
              <tr><td style="padding:24px 40px;background:#f8fafc;border-top:1px solid #e5e7eb;text-align:center">
                <p style="margin:0;color:#9ca3af;font-size:12px">
                  This is an automated message from <strong>${appName}</strong>. Please do not reply to this email.
                </p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;
    return this.sendMail({ to, subject: `Reset your ${appName} password`, html });
  }

  /**
   * Sends an email address verification email.
   * @param {string} to           - Recipient email address
   * @param {string} name         - Recipient display name
   * @param {string} verifyUrl    - Full verification URL including token
   */
  static async sendEmailVerificationEmail(to, name, verifyUrl) {
    const appName = config.app.name;
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
          <tr><td align="center">
            <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
              <!-- Header -->
              <tr><td style="background:linear-gradient(135deg,#059669 0%,#0891b2 100%);padding:32px;text-align:center">
                <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px">${appName}</h1>
                <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px">Verify your email address</p>
              </td></tr>
              <!-- Body -->
              <tr><td style="padding:40px 40px 32px">
                <p style="margin:0 0 16px;color:#374151;font-size:16px">Welcome, <strong>${esc(name)}</strong>! 🎉</p>
                <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">
                  Thank you for registering with <strong>${appName}</strong>. To activate your account and start billing,
                  please verify your email address. This link expires in <strong>24 hours</strong>.
                </p>
                <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px">
                  <tr><td style="border-radius:10px;background:linear-gradient(135deg,#059669,#0891b2)">
                    <a href="${verifyUrl}" style="display:block;padding:14px 32px;color:#fff;text-decoration:none;font-weight:600;font-size:15px">
                      Verify Email Address →
                    </a>
                  </td></tr>
                </table>
                <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;text-align:center">
                  Or copy and paste this link:
                </p>
                <p style="margin:0 0 24px;color:#059669;font-size:12px;word-break:break-all;text-align:center;background:#ecfdf5;padding:12px;border-radius:8px">
                  ${verifyUrl}
                </p>
                <p style="margin:0;color:#9ca3af;font-size:13px">
                  If you didn't create an account with ${appName}, please ignore this email.
                </p>
              </td></tr>
              <!-- Footer -->
              <tr><td style="padding:24px 40px;background:#f8fafc;border-top:1px solid #e5e7eb;text-align:center">
                <p style="margin:0;color:#9ca3af;font-size:12px">
                  This is an automated message from <strong>${appName}</strong>. Please do not reply to this email.
                </p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;
    return this.sendMail({ to, subject: `Verify your email for ${appName}`, html });
  }
}

module.exports = MailerService;
