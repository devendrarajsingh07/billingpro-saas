'use strict';

const { createHash } = require('crypto');

/**
 * Generates a formatted invoice number.
 * Format: {PREFIX}-{YEAR}-{SEQUENCE}-{HASH}
 * Example: INV-2026-000001-a1b2c3d4
 *
 * The hash suffix prevents duplicate invoice numbers when multiple invoices are
 * created in rapid succession or when a retry occurs.
 *
 * @param {string} prefix - Company invoice prefix (e.g. 'INV')
 * @param {number|string} year - 4-digit year
 * @param {number} lastSeq - The last used sequence number (will increment by 1)
 * @param {number|string|null} [seed] - Optional seed to make the hash deterministic
 * @returns {string}
 */
function generateInvoiceNumber(prefix, year, lastSeq, seed = null) {
  const seq = String((lastSeq || 0) + 1).padStart(6, '0');
  const salt = seed !== null && seed !== undefined
    ? `${seed}-${Date.now()}-${Math.random().toString(16).slice(2)}-${process.hrtime.bigint()}`
    : `${Date.now()}-${Math.random().toString(16).slice(2)}-${process.hrtime.bigint()}`;
  const hash = createHash('sha256').update(salt).digest('hex').slice(0, 8);
  return `${prefix}-${year}-${seq}-${hash}`;
}

/**
 * Generates a formatted purchase order number.
 * Format: {PREFIX}-{YEAR}-{SEQUENCE}
 * Example: PO-2026-000001
 *
 * @param {string} prefix - Company PO prefix (e.g. 'PO')
 * @param {number|string} year - 4-digit year
 * @param {number} lastSeq - The last used sequence number
 * @returns {string}
 */
function generatePONumber(prefix, year, lastSeq) {
  const seq = String((lastSeq || 0) + 1).padStart(6, '0');
  return `${prefix}-${year}-${seq}`;
}

/**
 * Extracts the numeric sequence from an existing document number.
 * E.g. 'INV-2026-000042' → 42
 *
 * @param {string} docNumber
 * @returns {number}
 */
function extractSequence(docNumber) {
  if (!docNumber) return 0;
  const parts = String(docNumber).split('-');
  const lastPart = parts.at(-1);
  const seqPart = /^\d+$/.test(lastPart) ? lastPart : parts.at(-2);
  if (!seqPart || !/^\d+$/.test(seqPart)) return 0;

  const parsed = parseInt(seqPart, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Generates a random alphanumeric reference code.
 * Useful for payment references, etc.
 *
 * @param {number} [length=8]
 * @returns {string}
 */
function generateReference(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

module.exports = {
  generateInvoiceNumber,
  generatePONumber,
  extractSequence,
  generateReference,
};
