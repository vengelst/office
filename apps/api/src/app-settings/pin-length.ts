/**
 * Zentrale PIN-Länge (4–8 Ziffern), Default 6.
 */

export const PIN_LENGTH_KEY = 'pin_length';
export const DEFAULT_PIN_LENGTH = 6;
export const MIN_PIN_LENGTH = 4;
export const MAX_PIN_LENGTH = 8;

/** Parst und begrenzt die PIN-Länge; ungültig → Default. */
export function parsePinLength(raw: string | null | undefined): number {
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (
    Number.isFinite(n) &&
    n >= MIN_PIN_LENGTH &&
    n <= MAX_PIN_LENGTH
  ) {
    return n;
  }
  return DEFAULT_PIN_LENGTH;
}

/** Prüft, ob `pin` genau `length` Ziffern hat. */
export function isValidPinForLength(pin: string, length: number): boolean {
  if (!/^\d+$/.test(pin)) return false;
  return pin.length === length;
}

export function pinLengthErrorMessage(length: number): string {
  return `PIN muss genau ${length} Ziffern sein.`;
}
