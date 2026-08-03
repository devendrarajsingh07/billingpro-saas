const { generateInvoiceNumber, extractSequence } = require('../utils/numberGenerator');

describe('invoice number generation', () => {
  test('creates a unique hash-based invoice number', () => {
    const first = generateInvoiceNumber('INV', 2026, 0, 101);
    const second = generateInvoiceNumber('INV', 2026, 0, 101);

    expect(first).toContain('INV-2026-');
    expect(first).toMatch(/INV-2026-\d{6}-[a-z0-9]{8}$/i);
    expect(second).toMatch(/INV-2026-\d{6}-[a-z0-9]{8}$/i);
    expect(first).not.toBe(second);
  });

  test('extracts the numeric sequence from legacy and hash-based invoice numbers', () => {
    expect(extractSequence('INV-2026-000001')).toBe(1);
    expect(extractSequence('INV-2026-000042-abc12345')).toBe(42);
  });
});
