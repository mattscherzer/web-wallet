import { describe, expect, it } from 'vitest';
import { csvText } from './csvCells';

describe('csvText', () => {
  it.each(['=1+1', '+1', '-1', '@x', '\tx', '\rx'])('prefixes %j', (text) => {
    expect(csvText(text)).toBe(`"'${text}"`);
  });

  it('leaves ordinary text alone and doubles quotes', () => {
    expect(csvText('Rent')).toBe('"Rent"');
    expect(csvText('say "hi"')).toBe('"say ""hi"""');
  });
});
