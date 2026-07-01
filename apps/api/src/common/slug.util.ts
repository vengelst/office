const CHAR_MAP: Record<string, string> = {
  ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss',
  Ä: 'Ae', Ö: 'Oe', Ü: 'Ue',
  č: 'c', ć: 'c', ž: 'z', š: 's', ś: 's',
  ń: 'n', ł: 'l', ą: 'a', ę: 'e',
  Č: 'C', Ć: 'C', Ž: 'Z', Š: 'S', Ś: 'S',
  Ń: 'N', Ł: 'L', Ą: 'A', Ę: 'E',
  đ: 'd', Đ: 'D',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  á: 'a', à: 'a', â: 'a',
  í: 'i', ì: 'i', î: 'i',
  ó: 'o', ò: 'o', ô: 'o',
  ú: 'u', ù: 'u', û: 'u',
  ñ: 'n', ý: 'y',
};

function transliterate(input: string): string {
  return input
    .split('')
    .map((ch) => CHAR_MAP[ch] ?? ch)
    .join('');
}

/**
 * Erzeugt einen URL-/Pfad-sicheren Slug (lowercase, Bindestriche).
 * Ideal für Ordnernamen in MinIO und Google Drive.
 */
export function slugify(input: string): string {
  return transliterate(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Erzeugt einen lesbaren Dateinamen-Slug (Groß-/Kleinschreibung bleibt erhalten).
 * Sonderzeichen werden durch Bindestriche ersetzt.
 */
export function fileSlug(input: string): string {
  return transliterate(input)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Entfernt die Trennzeichen aus einer Nummer (z.B. "K-0001" → "K0001").
 */
export function compactNumber(input: string): string {
  return input.replace(/-/g, '');
}

/** Erzeugt aus Date ein Datumsstring im Format YYYY-MM-DD. */
export function dateSlug(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Erzeugt einen Zeitstempel-String im Format HHmm. */
export function timeSlug(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}${m}`;
}
