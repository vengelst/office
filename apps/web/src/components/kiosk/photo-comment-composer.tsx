'use client';

/**
 * Foto-Vorschau mit optionalem Tipp: Kommentar-Position im Bild festlegen.
 * Ohne Position → Server brennt Text als Banner unten ein.
 */

import { useEffect, useMemo, useState } from 'react';

export interface PhotoCommentPlacement {
  comment: string;
  /** Relativ 0–1; null = Banner unten */
  xNorm: number | null;
  yNorm: number | null;
  burnIntoImage: boolean;
}

interface PhotoCommentComposerProps {
  file: File;
  comment: string;
  onCommentChange: (value: string) => void;
  title: string;
  hint: string;
  placeButton: string;
  placeHint: string;
  placeDone: string;
  clearPlace: string;
  saveLabel: string;
  skipLabel: string;
  cancelLabel: string;
  uploading?: boolean;
  dark?: boolean;
  onSave: (placement: PhotoCommentPlacement) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export function PhotoCommentComposer({
  file,
  comment,
  onCommentChange,
  title,
  hint,
  placeButton,
  placeHint,
  placeDone,
  clearPlace,
  saveLabel,
  skipLabel,
  cancelLabel,
  uploading,
  dark,
  onSave,
  onSkip,
  onCancel,
}: PhotoCommentComposerProps): React.ReactNode {
  const [placing, setPlacing] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleImageClick = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
  ) => {
    if (!placing) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const clientX =
      'touches' in e ? e.touches[0]?.clientX : (e as React.MouseEvent).clientX;
    const clientY =
      'touches' in e ? e.touches[0]?.clientY : (e as React.MouseEvent).clientY;
    if (clientX == null || clientY == null) return;
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    setPos({ x, y });
    setPlacing(false);
  };

  const panel = dark
    ? 'bg-gray-900 text-gray-100'
    : 'bg-card text-foreground border';
  const inputCls = dark
    ? 'border-gray-700 bg-gray-800 text-white'
    : 'border bg-background';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div
        className={`w-full max-w-lg space-y-4 rounded-2xl p-5 shadow-xl ${panel}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold">{title}</h3>
        <p className={`text-sm ${dark ? 'text-gray-400' : 'text-muted-foreground'}`}>
          {hint}
        </p>

        <div
          className={`relative overflow-hidden rounded-xl ${
            placing ? 'ring-2 ring-amber-400 cursor-crosshair' : ''
          }`}
          onClick={handleImageClick}
          onTouchEnd={(e) => {
            if (!placing) return;
            e.preventDefault();
            handleImageClick(e);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt=""
            className="max-h-[50vh] w-full object-contain bg-black"
            draggable={false}
          />
          {pos && comment.trim() && (
            <div
              className="pointer-events-none absolute max-w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-black/75 px-3 py-2 text-sm font-semibold text-white shadow"
              style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
            >
              {comment.trim()}
            </div>
          )}
          {!pos && comment.trim() && !placing && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/70 px-3 py-2 text-sm font-semibold text-white">
              {comment.trim()}
            </div>
          )}
        </div>

        {placing && (
          <p className="text-center text-sm text-amber-400">{placeHint}</p>
        )}

        <input
          type="text"
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          className={`w-full rounded-xl border px-4 py-3 text-lg ${inputCls}`}
          style={{ minHeight: '48px' }}
          autoFocus
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!comment.trim() || uploading}
            onClick={() => setPlacing(true)}
            className={`rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50 ${
              placing
                ? 'bg-amber-600 text-white'
                : dark
                  ? 'bg-gray-700 text-gray-100'
                  : 'bg-secondary text-secondary-foreground'
            }`}
            style={{ minHeight: '44px' }}
          >
            {placing ? placeDone : placeButton}
          </button>
          {pos && (
            <button
              type="button"
              disabled={uploading}
              onClick={() => setPos(null)}
              className={`rounded-xl px-4 py-3 text-sm ${
                dark ? 'text-gray-400' : 'text-muted-foreground'
              }`}
            >
              {clearPlace}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={uploading || !comment.trim()}
            onClick={() =>
              onSave({
                comment: comment.trim(),
                xNorm: pos?.x ?? null,
                yNorm: pos?.y ?? null,
                burnIntoImage: true,
              })
            }
            className="rounded-xl bg-blue-600 px-4 py-3 text-lg font-semibold text-white disabled:opacity-60"
            style={{ minHeight: '48px' }}
          >
            {saveLabel}
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={onSkip}
            className={`rounded-xl px-4 py-3 text-base ${
              dark ? 'bg-gray-800 text-gray-300' : 'bg-muted'
            }`}
            style={{ minHeight: '44px' }}
          >
            {skipLabel}
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={onCancel}
            className={`rounded-xl px-4 py-2 text-sm ${
              dark ? 'text-gray-500' : 'text-muted-foreground'
            }`}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
