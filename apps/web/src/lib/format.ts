/**
 * Formatierungs-Helfer (Datum, Zahl, Adresse, IBAN, Maps-Links) für die UI.
 */

/**
 * Google-Maps-Routing-Link aus Koordinaten oder vorhandener URL.
 *
 * @param latitude - Geografische Breite
 * @param longitude - Geografische Länge
 * @param fallbackUrl - Vorhandene Maps-URL als Fallback
 * @param address - Freitext-Adresse als Fallback-Ziel
 * @returns Maps-Routen-URL oder null
 */
export function buildMapsUrl(
  latitude?: number | null,
  longitude?: number | null,
  fallbackUrl?: string | null,
  address?: string,
): string | null {
  if (latitude != null && longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  }
  if (fallbackUrl) {
    return fallbackUrl;
  }
  if (address && address.trim()) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      address,
    )}`;
  }
  return null;
}

/**
 * IBAN teilmaskiert für Übersichten: DE89 •••• •••• 3000.
 *
 * @param iban - Parameter `iban` (string)
 * @returns string
 */
export function maskIban(iban: string): string {
  const clean = iban.replace(/\s+/g, '');
  if (clean.length <= 8) {
    return clean;
  }
  const start = clean.slice(0, 4);
  const end = clean.slice(-4);
  return `${start} •••• •••• ${end}`;
}

/**
 * IBAN in 4er-Gruppen für die vollständige Anzeige.
 *
 * @param iban - Parameter `iban` (string)
 * @returns string
 */
export function formatIban(iban: string): string {
  return iban
    .replace(/\s+/g, '')
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

/**
 * Dateigröße menschenlesbar.
 *
 * @param bytes - Parameter `bytes` (number)
 * @returns string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Datum (YYYY-MM-DD oder ISO) → deutsche Kurzform.
 *
 * @param value - Parameter `value` (string | null)
 * @returns Formatierter String
 */
export function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * ISO-Zeitstempel → deutsche Kurzform mit Uhrzeit ("07.08.2026, 14:32").
 *
 * @param value - Parameter `value` (string | null)
 * @returns string
 */
export function formatDateTime(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Setzt eine vollständige Adresszeile zusammen.
 */
export function joinAddress(parts: {
  addressLine1?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
}): string {
  const line2 = [parts.postalCode, parts.city].filter(Boolean).join(' ');
  return [parts.addressLine1, line2, parts.country].filter(Boolean).join(', ');
}
