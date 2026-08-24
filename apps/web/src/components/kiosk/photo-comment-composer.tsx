'use client';

/**
 * Foto-Vorschau mit Tipp-Position für Kommentar im Bild (Mobil: Pointer-Events).
 * Ohne Position → Server brennt Text als Banner unten ein.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

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

/** Koordinaten relativ zum sichtbaren Bildinhalt (object-contain). */
function normFromClientPoint(
  img: HTMLImageElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const rect = img.getBoundingClientRect();
  const nw = img.naturalWidth || rect.width;
  const nh = img.naturalHeight || rect.height;
  if (nw <= 0 || nh <= 0 || rect.width <= 0 || rect.height <= 0) return null;

  const scale = Math.min(rect.width / nw, rect.height / nh);
  const dispW = nw * scale;
  const dispH = nh * scale;
  const offsetX = (rect.width - dispW) / 2;
  const offsetY = (rect.height - dispH) / 2;

  const x = (clientX - rect.left - offsetX) / dispW;
  const y = (clientY - rect.top - offsetY) / dispH;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
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
  const imgRef = useRef<HTMLImageElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const applyPoint = (clientX: number, clientY: number) => {
    const img = imgRef.current;
    if (!img) return;
    const next = normFromClientPoint(img, clientX, clientY);
    if (!next) return;
    setPos(next);
    setPlacing(false);
  };

  const startPlacing = () => {
    if (!comment.trim() || uploading) return;
    inputRef.current?.blur();
    setPlacing(true);
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
          className={`relative overflow-hidden rounded-xl select-none ${
            placing ? 'ring-2 ring-amber-400' : ''
          }`}
          style={{ touchAction: placing ? 'none' : 'auto' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={previewUrl}
            alt=""
            className="max-h-[45vh] w-full object-contain bg-black pointer-events-none"
            draggable={false}
          />

          {/* Trefferfläche über dem Bild – Pointer für Maus + Finger */}
          <div
            className={`absolute inset-0 ${
              placing ? 'z-10 cursor-crosshair' : 'pointer-events-none'
            }`}
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => {
              if (!placing) return;
              e.preventDefault();
              e.stopPropagation();
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // ignore
              }
              applyPoint(e.clientX, e.clientY);
            }}
          />

          {pos && comment.trim() && imgRef.current && (
            <PlacementLabel
              img={imgRef.current}
              pos={pos}
              text={comment.trim()}
            />
          )}
          {!pos && comment.trim() && !placing && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] bg-black/70 px-3 py-2 text-sm font-semibold text-white">
              {comment.trim()}
            </div>
          )}
        </div>

        {placing && (
          <p className="text-center text-sm font-medium text-amber-400">
            {placeHint}
          </p>
        )}

        <input
          ref={inputRef}
          type="text"
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          className={`w-full rounded-xl border px-4 py-3 text-lg ${inputCls}`}
          style={{ minHeight: '48px' }}
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!comment.trim() || uploading}
            onClick={startPlacing}
            className={`rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50 ${
              placing
                ? 'bg-amber-600 text-white'
                : dark
                  ? 'bg-gray-700 text-gray-100'
                  : 'bg-secondary text-secondary-foreground'
            }`}
            style={{ minHeight: '48px' }}
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
              style={{ minHeight: '48px' }}
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

/** Label über dem sichtbaren Bildbereich (nicht über Letterbox). */
function PlacementLabel({
  img,
  pos,
  text,
}: {
  img: HTMLImageElement;
  pos: { x: number; y: number };
  text: string;
}): React.ReactNode {
  const rect = img.getBoundingClientRect();
  const nw = img.naturalWidth || 1;
  const nh = img.naturalHeight || 1;
  const scale = Math.min(rect.width / nw, rect.height / nh);
  const dispW = nw * scale;
  const dispH = nh * scale;
  const offsetX = (rect.width - dispW) / 2;
  const offsetY = (rect.height - dispH) / 2;
  const leftPct = ((offsetX + pos.x * dispW) / rect.width) * 100;
  const topPct = ((offsetY + pos.y * dispH) / rect.height) * 100;

  return (
    <div
      className="pointer-events-none absolute z-[5] max-w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-black/75 px-3 py-2 text-sm font-semibold text-white shadow"
      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
    >
      {text}
    </div>
  );
}
