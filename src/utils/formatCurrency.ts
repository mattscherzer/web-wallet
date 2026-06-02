/**
 * Format a number as EUR currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format with sign prefix: +€100.00 or -€100.00
 */
export function formatSignedCurrency(amount: number, type: 'inflow' | 'outflow'): string {
  const formatted = formatCurrency(amount);
  return type === 'inflow' ? `+${formatted}` : `-${formatted}`;
}
