/**
 * Formats a number to currency style.
 */
export function formatCurrency(amount, currencyCode = 'INR') {
  const amountNum = Number(amount) || 0;
  
  const locales = {
    INR: 'en-IN',
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
  };

  const locale = locales[currencyCode] || 'en-IN';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
  }).format(amountNum);
}

/**
 * Formats ISO date to readable string.
 */
export function formatDate(dateString, pattern = 'DD/MM/YYYY') {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;

  const pad = (n) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();

  if (pattern === 'YYYY-MM-DD') {
    return `${year}-${month}-${day}`;
  }
  return `${day}/${month}/${year}`;
}
