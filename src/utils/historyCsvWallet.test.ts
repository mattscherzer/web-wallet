import { describe, expect, it } from 'vitest';
import { buildHistoryCsv } from './historyCsv';

describe('CSV wallet name', () => {
  it('puts the wallet name on the first line, above the column header', () => {
    const lines = buildHistoryCsv([], 'Spring Convention 2027').split('\n');
    expect(lines[0]).toBe('Wallet,"Spring Convention 2027"');
    expect(lines[1]).toBe('Date,In,Out,What,Balance,Prudent Reserve');
  });

  it('quotes a wallet name that contains quotes or commas', () => {
    expect(buildHistoryCsv([], 'Anna, "B" group').split('\n')[0]).toBe('Wallet,"Anna, ""B"" group"');
  });

  it('leaves the file unchanged when no wallet name is given', () => {
    expect(buildHistoryCsv([])).toBe('Date,In,Out,What,Balance,Prudent Reserve');
  });
});
