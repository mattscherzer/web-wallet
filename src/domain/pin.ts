export const PIN_LENGTH = 6;

export const isPin = (value: string): boolean => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(value);
