import { formatCurrency } from '../../utils/formatCurrency';

const MINUS = '−';

export const euros = (cents: number) => formatCurrency(cents / 100);

export const signedEuros = (cents: number) => {
  if (cents === 0) return euros(0);
  return `${cents > 0 ? '+' : MINUS}${euros(Math.abs(cents))}`;
};
