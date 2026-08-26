'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TOKEN_STORAGE_KEY } from '@/lib/api-client';
import { texts } from '@/lib/texts';
import { API_BASE_URL } from './constants';

/** Authentifiziertes Bild mit Lightbox-Unterstützung. */
export function EquipmentImage({
  equipmentId,
  hasImage,
  onUpload,
  onLightbox,
}: {
  equipmentId: string;
  hasImage: boolean;
  onUpload: (file: File) => void;
  onLightbox: (src: string) => void;
}): React.ReactNode {
  const t = texts.equipment;
  const fileRef = useRef<HTMLInputElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasImage) {
      setBlobUrl(null);
      return;
    }
    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(TOKEN_STORAGE_KEY)
        : null;

    let objectUrl: string | undefined;
    fetch(`${API_BASE_URL}/equipment/${equipmentId}/image`, {
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
  }, [equipmentId, hasImage]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      {blobUrl ? (
        <img
          src={blobUrl}
          alt="Gerätebild"
          className="h-40 w-40 cursor-pointer rounded-lg border object-cover transition-opacity hover:opacity-90"
          onClick={() => onLightbox(blobUrl)}
        />
      ) : (
        <div className="flex h-40 w-40 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
          {t.fields.image}
        </div>
      )}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
        <Button
          variant="outline"
          className="min-h-[44px]"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          {hasImage ? t.actions.changeImage : t.actions.uploadImage}
        </Button>
      </div>
    </div>
  );
}
