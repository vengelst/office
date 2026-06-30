'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Camera, User } from 'lucide-react';
import { ApiError, TOKEN_STORAGE_KEY } from '@/lib/api-client';
import type { ApiErrorResponse } from '@office/types';
import { cn } from '@/lib/utils';
import { texts } from '@/lib/texts';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

/** Lädt ein Profilbild per FormData zum Workers-Endpoint hoch. */
export async function uploadWorkerPhoto(
  workerId: string,
  file: File,
): Promise<void> {
  const form = new FormData();
  form.append('file', file);
  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(TOKEN_STORAGE_KEY)
      : null;
  const res = await fetch(`${API_BASE_URL}/workers/${workerId}/photo`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!res.ok) {
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const payload = (isJson ? await res.json() : null) as
      | ApiErrorResponse
      | null;
    const message = payload
      ? Array.isArray(payload.message)
        ? payload.message.join(', ')
        : payload.message
      : `Upload fehlgeschlagen (${res.status})`;
    throw new ApiError(message, res.status, payload ?? undefined);
  }
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

const SIZES = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-24 w-24 text-2xl',
} as const;

/**
 * Runder Profilbild-Avatar. Lädt das Bild mit Auth-Header (per fetch → Blob).
 * Fällt auf Initialen zurück, wenn kein Bild vorhanden ist.
 * Mit `editable` erscheint ein Upload-Button (Overlay).
 */
export function WorkerAvatar({
  workerId,
  hasPhoto,
  name,
  size = 'md',
  editable = false,
  onUploaded,
  onError,
}: {
  workerId: string;
  hasPhoto: boolean;
  name: string;
  size?: keyof typeof SIZES;
  editable?: boolean;
  onUploaded?: () => void;
  onError?: (message: string) => void;
}): ReactNode {
  const [src, setSrc] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hasPhoto) {
      setSrc(null);
      return;
    }
    let url: string | null = null;
    let cancelled = false;
    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(TOKEN_STORAGE_KEY)
        : null;
    void fetch(`${API_BASE_URL}/workers/${workerId}/photo`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((res) => (res.ok ? res.blob() : Promise.reject()))
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => setSrc(null));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [workerId, hasPhoto, version]);

  const handleFile = (file: File): void => {
    setUploading(true);
    uploadWorkerPhoto(workerId, file)
      .then(() => {
        setVersion((v) => v + 1);
        onUploaded?.();
      })
      .catch((err) =>
        onError?.(err instanceof ApiError ? err.message : 'Upload fehlgeschlagen'),
      )
      .finally(() => setUploading(false));
  };

  return (
    <div className={cn('relative shrink-0', SIZES[size])}>
      <div
        className={cn(
          'flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-muted-foreground',
        )}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : name.trim() ? (
          <span>{initials(name)}</span>
        ) : (
          <User className="h-1/2 w-1/2" />
        )}
      </div>

      {editable && (
        <>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) handleFile(f);
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
            className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
            aria-label={texts.workers.actions.changePhoto}
          >
            <Camera className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}
