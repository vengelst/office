'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { documentsApi, isImage, type Document } from '@/lib/documents';
import { formatDate } from '@/lib/format';
import { texts } from '@/lib/texts';

/** Tage bis zum Ablauf (negativ = bereits abgelaufen) oder null. */
export function daysUntil(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const d = new Date(expiryDate);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/**
 * Authentifiziertes Thumbnail (oder Datei-Icon).
 * Lädt Thumbnail bzw. Original als Object-URL, da `<img>` keinen Token sendet.
 */
export function DocumentThumb({
  doc,
  className = 'h-full w-full',
}: {
  doc: Document;
  className?: string;
}): ReactNode {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const image = isImage(doc.mimeType);

  useEffect(() => {
    if (!image) return;
    let revoked = false;
    let objectUrl: string | null = null;
    const loader = doc.thumbnailKey
      ? documentsApi.thumbnailObjectUrl(doc.id)
      : documentsApi.fileObjectUrl(doc.id);
    loader
      .then((u) => {
        if (revoked) {
          URL.revokeObjectURL(u);
          return;
        }
        objectUrl = u;
        setUrl(u);
      })
      .catch(() => setFailed(true));
    return (): void => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.id, doc.thumbnailKey, image]);

  if (!image || failed) {
    const ext = doc.originalFilename.split('.').pop()?.toUpperCase() ?? '';
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 bg-muted text-muted-foreground ${className}`}
      >
        <FileText className="h-8 w-8" />
        {ext && <span className="text-[10px] font-medium">{ext}</span>}
      </div>
    );
  }

  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className}`}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={doc.title || doc.originalFilename}
      className={`object-cover ${className}`}
    />
  );
}

/** Versions-Badge (V2, V3 …) – nur ab Version 2. */
export function VersionBadge({ version }: { version: number }): ReactNode {
  if (version < 2) return null;
  const t = texts.documents;
  return (
    <Badge variant="secondary" className="shrink-0">
      {t.versionBadge}
      {version}
    </Badge>
  );
}

/** Ablauf-Badge: rot wenn abgelaufen, gelb wenn ≤30 Tage. */
export function ExpiryBadge({
  expiryDate,
}: {
  expiryDate: string | null;
}): ReactNode {
  const days = daysUntil(expiryDate);
  if (days === null) return null;
  const t = texts.documents;
  if (days < 0) {
    return (
      <Badge variant="destructive" className="shrink-0">
        {t.expired}
      </Badge>
    );
  }
  if (days <= 30) {
    return (
      <Badge
        variant="outline"
        className="shrink-0 border-amber-500 bg-amber-50 text-amber-700"
      >
        {t.expiringSoon} · {formatDate(expiryDate)}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="shrink-0">
      {t.expiresOn} {formatDate(expiryDate)}
    </Badge>
  );
}
