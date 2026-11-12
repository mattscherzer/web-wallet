/**
 * True if spending `amount` would leave `balance` below zero (compared in whole cents).
 * An unknown (`null`) balance never warns, so we don't cry wolf while balances load or if the fetch failed.
 */
export function wouldOverdraw(balance: number | null, amount: number): boolean {
  if (balance === null || !Number.isFinite(amount) || amount <= 0) return false;
  return Math.round((balance - amount) * 100) < 0;
}
