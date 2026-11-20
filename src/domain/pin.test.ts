import { describe, expect, it } from 'vitest';
import { PIN_LENGTH, appendPinDigit, dropPinDigit, isPin, isPinComplete } from './pin';

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

describe('isPinComplete', () => {
  it('is true only at the full PIN length', () => {
    expect(isPinComplete('12345')).toBe(false);
    expect(isPinComplete('123456')).toBe(true);
  });
});

describe('appendPinDigit', () => {
  it('adds a digit and stops growing at the PIN length', () => {
    expect(appendPinDigit('12', '3')).toBe('123');
    expect(appendPinDigit('123456', '7')).toBe('123456');
  });
});

describe('dropPinDigit', () => {
  it('removes the last digit and leaves an empty PIN empty', () => {
    expect(dropPinDigit('123')).toBe('12');
    expect(dropPinDigit('')).toBe('');
  });
});
