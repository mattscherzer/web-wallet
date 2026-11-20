export const PIN_LENGTH = 6;

export const isPin = (value: string): boolean => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(value);

export const isPinComplete = (value: string): boolean => value.length === PIN_LENGTH;

export const appendPinDigit = (value: string, digit: string): string =>
  value.length < PIN_LENGTH ? value + digit : value;

export const dropPinDigit = (value: string): string => value.slice(0, -1);
