/** Staff PINs are exactly this many digits, kept as text so a leading zero survives. */
export const PIN_LENGTH = 6;

export const isPin = (value: string): boolean => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(value);
