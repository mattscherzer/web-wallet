const MINUS = '−';
const FALLBACK_LOCALE = 'en';

/** The device language, resolved at call time so it also works without a browser. */
function deviceLocale(): string {
  return (typeof navigator !== 'undefined' && navigator?.language) || FALLBACK_LOCALE;
}

function formatAbsolute(amount: number, locale: string): string {
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };
  try {
    return new Intl.NumberFormat(locale, options).format(amount);
  } catch {
    return new Intl.NumberFormat(FALLBACK_LOCALE, options).format(amount);
  }
}

/** Round to cents so a sign is never shown on a figure that displays as 0.00. */
function toCents(amount: number): number {
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

/**
 * Format a number as EUR in the device language: €1,210.30 (en), 1.210,30 € (de).
 * Negative amounts carry a true minus; positive amounts carry no sign.
 */
export function formatCurrency(amount: number, locale: string = deviceLocale()): string {
  const cents = toCents(amount);
  const formatted = formatAbsolute(Math.abs(cents) / 100, locale);
  return cents < 0 ? `${MINUS}${formatted}` : formatted;
}

/**
 * Format a transaction amount. The sign comes from the type, not the amount:
 * +€100.00 (inflow), −€100.00 (outflow), €100.00 (transfer).
 */
export function formatSignedCurrency(
  amount: number,
  type: 'inflow' | 'outflow' | 'transfer',
  locale: string = deviceLocale(),
): string {
  const cents = Math.abs(toCents(amount));
  const formatted = formatAbsolute(cents / 100, locale);
  if (type === 'transfer' || cents === 0) return formatted;
  return type === 'inflow' ? `+${formatted}` : `${MINUS}${formatted}`;
}
