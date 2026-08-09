/**
 * Hilfskomponenten für den Kontakte-Tab (AuthImage, Checkbox).
 */

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { TOKEN_STORAGE_KEY } from '@/lib/api-client';

/**
 * Bild-Komponente mit authentifiziertem Laden über Bearer-Token.
 * Erzeugt eine Object-URL aus dem API-Response und gibt sie beim Unmount frei.
 *
 * @param src - URL zum geschützten Bild-Endpunkt
 * @param alt - Alt-Text für das Bild
 * @param onClick - Callback mit der Blob-URL (z.B. für Lightbox)
 */
export function AuthImage({
  src,
  alt,
  className,
  onClick,
}: {
  src: string;
  alt: string;
  className?: string;
  onClick?: (blobUrl: string) => void;
}): ReactNode {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(TOKEN_STORAGE_KEY)
        : null;

    let objectUrl: string | undefined;
    fetch(src, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((res) => {
        if (!res.ok) throw new Error('load failed');
        return res.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => setBlobUrl(null));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!blobUrl) return null;

  return (
    <img
      src={blobUrl}
      alt={alt}
      className={className}
      onClick={() => onClick?.(blobUrl)}
    />
  );
}

/** Einfache Checkbox-Komponente mit Label und Touch-freundlicher Mindesthöhe. */
export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}): ReactNode {
  return (
    <label className="flex min-h-[44px] items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      {label}
    </label>
  );
}
