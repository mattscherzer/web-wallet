const MINUS = '−';
const FALLBACK_LOCALE = 'en';

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

function toCents(amount: number): number {
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function formatCurrency(amount: number, locale: string = deviceLocale()): string {
  const cents = toCents(amount);
  const formatted = formatAbsolute(Math.abs(cents) / 100, locale);
  return cents < 0 ? `${MINUS}${formatted}` : formatted;
}

/** The sign comes from the type, not the amount: +€100.00 (inflow), −€100.00 (outflow), €100.00 (transfer). */
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
