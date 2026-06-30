'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { ChevronLeft, ChevronRight, Loader2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { documentsApi, type Document } from '@/lib/documents';
import { texts } from '@/lib/texts';

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

/**
 * Vollbild-Lightbox für Bild-Dokumente.
 * Backdrop-Klick / Esc schließen, Pfeiltasten + Buttons navigieren,
 * Mausrad (Desktop) und Pinch (Mobile) zoomen.
 */
export function DocumentLightbox({
  open,
  documents,
  startIndex,
  onClose,
}: {
  open: boolean;
  documents: Document[];
  startIndex: number;
  onClose: () => void;
}): ReactNode {
  const t = texts.documents;
  const [index, setIndex] = useState(startIndex);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);

  const current = documents[index];

  useEffect(() => {
    if (open) {
      setIndex(startIndex);
      setZoom(1);
    }
  }, [open, startIndex]);

  // Authentifiziertes Bild als Object-URL laden (img kann keinen Token senden).
  useEffect(() => {
    if (!open || !current) return;
    let revoked = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setZoom(1);
    documentsApi
      .fileObjectUrl(current.id)
      .then((u) => {
        if (revoked) {
          URL.revokeObjectURL(u);
          return;
        }
        objectUrl = u;
        setUrl(u);
      })
      .catch(() => setUrl(null))
      .finally(() => setLoading(false));
    return (): void => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, current]);

  const go = useCallback(
    (dir: -1 | 1): void => {
      setIndex((i) => {
        const next = i + dir;
        if (next < 0 || next >= documents.length) return i;
        return next;
      });
    },
    [documents.length],
  );

  // Tastatur: Esc schließt, Pfeile navigieren.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return (): void => window.removeEventListener('keydown', onKey);
  }, [open, onClose, go]);

  if (!open || !current) return null;

  const clampZoom = (z: number): number =>
    Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setZoom((z) => clampZoom(z - e.deltaY * 0.002));
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = Array.from(pointers.current.values());
    if (pts.length === 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (!pinchStart.current) {
        pinchStart.current = { dist, zoom };
      } else {
        setZoom(clampZoom((pinchStart.current.zoom * dist) / pinchStart.current.dist));
      }
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Kopfzeile */}
      <div
        className="absolute left-0 right-0 top-0 flex items-center justify-between gap-2 p-4 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="truncate text-sm">
          {current.title || current.originalFilename}
          <span className="ml-2 text-white/60">
            {index + 1} / {documents.length}
          </span>
        </span>
        <div className="flex items-center gap-1">
          <IconButton
            label={t.zoomOut}
            onClick={() => setZoom((z) => clampZoom(z - 0.5))}
          >
            <ZoomOut className="h-5 w-5" />
          </IconButton>
          <IconButton
            label={t.zoomIn}
            onClick={() => setZoom((z) => clampZoom(z + 0.5))}
          >
            <ZoomIn className="h-5 w-5" />
          </IconButton>
          <IconButton label={t.close} onClick={onClose}>
            <X className="h-5 w-5" />
          </IconButton>
        </div>
      </div>

      {/* Navigation links */}
      {index > 0 && (
        <button
          type="button"
          aria-label={t.prev}
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
          className="absolute left-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Bild */}
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden touch-none"
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {loading || !url ? (
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={current.originalFilename}
            draggable={false}
            className="max-h-[85vh] max-w-[90vw] select-none object-contain transition-transform"
            style={{ transform: `scale(${zoom})` }}
          />
        )}
      </div>

      {/* Navigation rechts */}
      {index < documents.length - 1 && (
        <button
          type="button"
          aria-label={t.next}
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
          className="absolute right-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}): ReactNode {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/20"
    >
      {children}
    </button>
  );
}
