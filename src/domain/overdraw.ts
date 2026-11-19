/** An unknown (`null`) balance never warns, so nothing shows while balances load or after a failed fetch. */
export function wouldOverdraw(balance: number | null, amount: number): boolean {
  if (balance === null || !Number.isFinite(amount) || amount <= 0) return false;
  return Math.round((balance - amount) * 100) < 0;
}
