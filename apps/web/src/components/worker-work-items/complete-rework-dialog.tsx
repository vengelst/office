'use client';

/**
 * Foto-Dialog für Fertig- und Nacharbeitsmeldung (SPEZ 4.1 / 6).
 *
 * Gegenstück zum Modal in `apps/mobile/app/(app)/work-items/[id].tsx`:
 *  - Fertig: mindestens `MIN_COMPLETION_PHOTOS` Fotos (die API weist weniger ab)
 *  - Nacharbeit: Fotos optional, Kommentar optional
 *
 * Kamera und Galerie sind zwei `<input type="file">`: „Kamera“ mit
 * `capture="environment"` (öffnet auf iOS/Android direkt die Kamera),
 * „Galerie“ ohne `capture` und mit `multiple`.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Camera, Images, X } from 'lucide-react';
import { both, T } from '@/lib/i18n-work-items';
import { MIN_COMPLETION_PHOTOS } from '@/lib/worker-work-items';

/** Art der offenen Rückmeldung. */
export type ReportMode = 'complete' | 'rework';

/** Ausgewähltes Foto samt Vorschau-URL (wird beim Entfernen freigegeben). */
interface PickedPhoto {
  file: File;
  url: string;
}

export interface CompleteReworkDialogProps {
  mode: ReportMode;
  /** Läuft der Upload gerade? Sperrt Abbrechen/Senden. */
  sending: boolean;
  onCancel: () => void;
  onSubmit: (photos: File[], comment: string) => void;
  /** Kiosk: jede Nutzeraktion verlängert den Auto-Logout. */
  onActivity?: () => void;
}

export function CompleteReworkDialog({
  mode,
  sending,
  onCancel,
  onSubmit,
  onActivity,
}: CompleteReworkDialogProps): ReactNode {
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [comment, setComment] = useState('');
  const [hint, setHint] = useState('');
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  // Vorschau-URLs beim Schließen freigeben.
  const photosRef = useRef<PickedPhoto[]>([]);
  photosRef.current = photos;
  useEffect(
    () => () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    },
    [],
  );

  const addFiles = (list: FileList | null): void => {
    onActivity?.();
    if (!list || list.length === 0) return;
    const picked = Array.from(list)
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    if (picked.length === 0) return;
    setPhotos((prev) => [...prev, ...picked]);
    setHint('');
  };

  const removePhoto = (index: number): void => {
    onActivity?.();
    setPhotos((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const enoughPhotos =
    mode !== 'complete' || photos.length >= MIN_COMPLETION_PHOTOS;

  const handleSubmit = (): void => {
    onActivity?.();
    if (!enoughPhotos) {
      setHint(both(T.minPhotosMissing));
      return;
    }
    onSubmit(
      photos.map((p) => p.file),
      comment,
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-gray-900 p-5 pb-8 text-gray-100">
        <h2 className="text-xl font-bold">
          {mode === 'complete' ? both(T.complete) : both(T.rework)}
        </h2>
        <p className="mt-1 text-[13px] text-gray-400">
          {mode === 'complete'
            ? `${T.minPhotos.de} · ${T.minPhotos.sk}`
            : `${T.photos.de} / ${T.photos.sk} (optional)`}
        </p>

        {/* Vorschau der gewählten Fotos */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {photos.length === 0 ? (
            <div className="flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-[10px] border border-dashed border-gray-800">
              <Images className="h-6 w-6 text-gray-600" />
            </div>
          ) : (
            photos.map((photo, idx) => (
              <div key={photo.url} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt=""
                  className="h-[84px] w-[84px] rounded-[10px] bg-gray-800 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  aria-label={both(T.cancel)}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Kamera / Galerie */}
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={galleryInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={() => cameraInput.current?.click()}
            className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-gray-800 text-[15px] font-medium text-gray-50 transition active:scale-[0.98]"
          >
            <Camera className="h-5 w-5" />
            {both(T.camera)}
          </button>
          <button
            type="button"
            onClick={() => galleryInput.current?.click()}
            className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-gray-800 text-[15px] font-medium text-gray-50 transition active:scale-[0.98]"
          >
            <Images className="h-5 w-5" />
            {both(T.gallery)}
          </button>
        </div>

        <p className="mt-3 text-[13px] text-gray-400">
          {both(T.photos)}: {photos.length}
          {mode === 'complete' ? ` / ${MIN_COMPLETION_PHOTOS}+` : ''}
        </p>

        <textarea
          value={comment}
          onChange={(e) => {
            onActivity?.();
            setComment(e.target.value);
          }}
          placeholder={both(T.commentOptional)}
          rows={2}
          className="mt-3 min-h-[60px] w-full rounded-xl bg-gray-800 px-4 py-3 text-[15px] text-gray-50 outline-none placeholder:text-gray-500"
        />

        {hint && <p className="mt-2 text-sm text-yellow-400">{hint}</p>}

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={sending}
            className="min-h-[52px] flex-1 rounded-xl bg-gray-800 text-[15px] font-medium text-gray-400 disabled:opacity-50"
          >
            {both(T.cancel)}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending || !enoughPhotos}
            className="min-h-[52px] flex-1 rounded-xl bg-blue-600 text-[15px] font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {sending ? both(T.loading) : both(T.send)}
          </button>
        </div>
      </div>
    </div>
  );
}
