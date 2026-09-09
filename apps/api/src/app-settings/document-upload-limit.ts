/**
 * Konfigurierbares Upload-Limit für Pläne/Dokumente (MB).
 * Max 64 MB, damit nginx client_max_body_size 64m auf office.vivahome.de greift.
 */

export const DOCUMENT_UPLOAD_MAX_MB_KEY = 'document_upload_max_mb';

/** Default: 50 MB (früherer Hardcode). */
export const DEFAULT_DOCUMENT_UPLOAD_MAX_MB = 50;
export const MIN_DOCUMENT_UPLOAD_MAX_MB = 5;
/** Nginx erlaubt 64m – darüber würden Uploads am Proxy scheitern. */
export const MAX_DOCUMENT_UPLOAD_MAX_MB = 64;

/** Parst und begrenzt die Upload-Größe in MB; ungültig → Default 50. */
export function parseDocumentUploadMaxMb(
  raw: string | null | undefined,
): number {
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (
    Number.isFinite(n) &&
    n >= MIN_DOCUMENT_UPLOAD_MAX_MB &&
    n <= MAX_DOCUMENT_UPLOAD_MAX_MB
  ) {
    return n;
  }
  return DEFAULT_DOCUMENT_UPLOAD_MAX_MB;
}

/** MB → Bytes. */
export function documentUploadMaxBytes(maxMb: number): number {
  return maxMb * 1024 * 1024;
}

/** Deutsche Fehlermeldung bei Größenüberschreitung. */
export function documentUploadTooLargeMessage(
  maxMb: number,
  actualBytes?: number,
): string {
  if (actualBytes != null && Number.isFinite(actualBytes)) {
    const actualMb = (actualBytes / 1024 / 1024).toFixed(1);
    return `Datei überschreitet ${maxMb} MB (${actualMb} MB)`;
  }
  return `Datei überschreitet ${maxMb} MB`;
}
