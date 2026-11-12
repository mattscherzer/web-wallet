import { describe, expect, it } from 'vitest';
import { PIN_LENGTH, isPin } from './pin';

describe('isPin', () => {
  it('accepts exactly six digits, leading zero included', () => {
    expect(PIN_LENGTH).toBe(6);
    expect(isPin('012345')).toBe(true);
  });

  it('refuses the wrong length or non-digits', () => {
    expect(isPin('12345')).toBe(false);
    expect(isPin('1234567')).toBe(false);
    expect(isPin('12345a')).toBe(false);
  });
});
