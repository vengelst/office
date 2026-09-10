/**
 * Zuverlässiges Anhängen lokaler Bilder an FormData unter Expo/Android.
 * Das klassische `{ uri, name, type }`-Objekt liefert oft leere Uploads –
 * deshalb bevorzugen wir die Expo-`File`-Klasse (echtes Blob).
 */

import { File } from 'expo-file-system';

export type LocalImageRef = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

function normalizeMime(mimeType?: string | null): string {
  if (mimeType && /^image\//i.test(mimeType)) return mimeType;
  return 'image/jpeg';
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('heic') || mimeType.includes('heif')) return 'heic';
  return 'jpg';
}

function guessFileName(
  uri: string,
  mimeType: string,
  preferred?: string | null,
  fallback = 'photo',
): string {
  const fromPreferred = preferred?.split(/[/\\]/).pop()?.trim();
  if (fromPreferred && /\.[a-z0-9]+$/i.test(fromPreferred)) {
    return fromPreferred;
  }
  const fromUri = uri.split('?')[0]?.split('/').pop()?.trim();
  if (fromUri && /\.(jpe?g|png|webp|heic|heif)$/i.test(fromUri)) {
    return fromUri;
  }
  return `${fallback}.${extensionFor(mimeType)}`;
}

/**
 * Hängt eine lokale Bilddatei als Multipart-Feld an.
 * Garantiert Dateiname + image/* MIME – wichtig für Nest/Multer.
 */
export function appendLocalImage(
  form: FormData,
  field: string,
  image: LocalImageRef,
  fallbackName = 'photo',
): void {
  const mimeType = normalizeMime(image.mimeType);
  const name = guessFileName(image.uri, mimeType, image.fileName, fallbackName);

  try {
    const file = new File(image.uri);
    form.append(field, file as unknown as Blob, name);
    return;
  } catch {
    // Fallback für ältere Runtime / ungültige URI
  }

  form.append(field, {
    uri: image.uri,
    name,
    type: mimeType,
  } as unknown as Blob);
}
