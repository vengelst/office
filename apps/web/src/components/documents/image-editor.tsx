'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { Crop, RotateCcw, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { texts } from '@/lib/texts';

/** Max. Kantenlänge der Editor-Vorschau (Display-Pixel). */
const PREVIEW_MAX = 480;
/** Größe der Crop-Anfasspunkte in Pixel. */
const HANDLE = 16;
/** Minimale Crop-Größe in Display-Pixeln. */
const MIN_CROP = 40;

type Rotation = 0 | 90 | 180 | 270;
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | null;

/**
 * Leichtgewichtiger Bild-Editor (reine Canvas API + CSS-Filter-Vorschau).
 * Erlaubt Drehen, Zuschneiden, Helligkeit/Kontrast – ohne externe Bibliothek.
 * Liefert beim Übernehmen einen neuen File-Blob zurück.
 */
export function ImageEditor({
  file,
  open,
  onOpenChange,
  onApply,
}: {
  file: File | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (edited: File) => void;
}): ReactNode {
  const t = texts.documents;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [rotation, setRotation] = useState<Rotation>(0);
  const [brightness, setBrightness] = useState(0); // -50 … +50
  const [contrast, setContrast] = useState(0); // -50 … +50
  const [display, setDisplay] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<Rect | null>(null);
  const [cropping, setCropping] = useState(false);
  const drag = useRef<{ mode: DragMode; startX: number; startY: number; rect: Rect } | null>(
    null,
  );

  const filterStr = `brightness(${1 + brightness / 100}) contrast(${1 + contrast / 100})`;

  /** Zeichnet das (rotierte, gefilterte) Bild in die Vorschau-Canvas. */
  const renderPreview = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const swap = rotation === 90 || rotation === 270;
    const rotW = swap ? img.naturalHeight : img.naturalWidth;
    const rotH = swap ? img.naturalWidth : img.naturalHeight;
    const scale = Math.min(1, PREVIEW_MAX / Math.max(rotW, rotH));
    const cw = Math.round(rotW * scale);
    const ch = Math.round(rotH * scale);
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.filter = filterStr;
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    setDisplay((prev) =>
      prev.w === cw && prev.h === ch ? prev : { w: cw, h: ch },
    );
  }, [rotation, filterStr]);

  // Bild laden, wenn Datei/Dialog wechselt.
  useEffect(() => {
    if (!open || !file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = (): void => {
      imgRef.current = img;
      setRotation(0);
      setBrightness(0);
      setContrast(0);
      setCrop(null);
      setCropping(false);
      renderPreview();
    };
    img.src = url;
    return (): void => URL.revokeObjectURL(url);
    // renderPreview absichtlich nicht in den Deps – wird unten getriggert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file]);

  // Neu zeichnen bei Anpassung von Rotation/Helligkeit/Kontrast.
  useEffect(() => {
    if (open && imgRef.current) renderPreview();
  }, [open, renderPreview]);

  // Crop bei Verlassen der Display-Maße zurücksetzen (z. B. nach Drehung).
  useEffect(() => {
    if (cropping && display.w > 0 && !crop) {
      const m = Math.round(Math.min(display.w, display.h) * 0.1);
      setCrop({
        x: m,
        y: m,
        w: display.w - 2 * m,
        h: display.h - 2 * m,
      });
    }
  }, [cropping, display, crop]);

  const rotate = (dir: -1 | 1): void => {
    setRotation((r) => (((r + dir * 90 + 360) % 360) as Rotation));
    setCrop(null); // Crop nach Drehung verwerfen (Koordinaten ungültig)
  };

  const reset = (): void => {
    setRotation(0);
    setBrightness(0);
    setContrast(0);
    setCrop(null);
    setCropping(false);
  };

  // ── Crop-Drag (Pointer Events: Maus + Touch) ──────────────────
  const onPointerDown = (
    e: ReactPointerEvent<HTMLElement>,
    mode: DragMode,
  ): void => {
    if (!crop) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, startX: e.clientX, startY: e.clientY, rect: { ...crop } };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    if (!d || !d.mode) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    let { x, y, w, h } = d.rect;
    if (d.mode === 'move') {
      x = Math.max(0, Math.min(display.w - w, x + dx));
      y = Math.max(0, Math.min(display.h - h, y + dy));
    } else {
      if (d.mode === 'nw' || d.mode === 'sw') {
        const nx = Math.max(0, Math.min(x + w - MIN_CROP, x + dx));
        w += x - nx;
        x = nx;
      }
      if (d.mode === 'ne' || d.mode === 'se') {
        w = Math.max(MIN_CROP, Math.min(display.w - x, w + dx));
      }
      if (d.mode === 'nw' || d.mode === 'ne') {
        const ny = Math.max(0, Math.min(y + h - MIN_CROP, y + dy));
        h += y - ny;
        y = ny;
      }
      if (d.mode === 'sw' || d.mode === 'se') {
        h = Math.max(MIN_CROP, Math.min(display.h - y, h + dy));
      }
    }
    setCrop({ x, y, w, h });
  };

  const onPointerUp = (): void => {
    drag.current = null;
  };

  /** Rendert in voller Auflösung und gibt einen neuen File-Blob zurück. */
  const apply = (): void => {
    const img = imgRef.current;
    if (!img || !file) return;
    const swap = rotation === 90 || rotation === 270;
    const fullW = swap ? img.naturalHeight : img.naturalWidth;
    const fullH = swap ? img.naturalWidth : img.naturalHeight;

    const full = document.createElement('canvas');
    full.width = fullW;
    full.height = fullH;
    const ctx = full.getContext('2d');
    if (!ctx) return;
    ctx.filter = filterStr;
    ctx.translate(fullW / 2, fullH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(
      img,
      -img.naturalWidth / 2,
      -img.naturalHeight / 2,
      img.naturalWidth,
      img.naturalHeight,
    );

    // Crop in volle Auflösung umrechnen.
    let out = full;
    if (crop && display.w > 0) {
      const sx = fullW / display.w;
      const sy = fullH / display.h;
      const cx = Math.round(crop.x * sx);
      const cy = Math.round(crop.y * sy);
      const cw = Math.round(crop.w * sx);
      const ch = Math.round(crop.h * sy);
      const cropped = document.createElement('canvas');
      cropped.width = cw;
      cropped.height = ch;
      const cctx = cropped.getContext('2d');
      if (cctx) {
        cctx.drawImage(full, cx, cy, cw, ch, 0, 0, cw, ch);
        out = cropped;
      }
    }

    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    out.toBlob(
      (blob) => {
        if (!blob) return;
        const edited = new File([blob], file.name, { type });
        onApply(edited);
        onOpenChange(false);
      },
      type,
      0.92,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.editorTitle}</DialogTitle>
        </DialogHeader>

        {/* Vorschau-Bereich */}
        <div className="flex justify-center">
          <div
            className="relative touch-none select-none"
            style={{ width: display.w || undefined, height: display.h || undefined }}
          >
            <canvas ref={canvasRef} className="block rounded-md" />

            {cropping && crop && (
              <div
                ref={overlayRef}
                className="absolute inset-0"
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              >
                {/* Abdunkelung außerhalb des Crops über box-shadow */}
                <div
                  className="absolute cursor-move border-2 border-primary"
                  style={{
                    left: crop.x,
                    top: crop.y,
                    width: crop.w,
                    height: crop.h,
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                  }}
                  onPointerDown={(e) => onPointerDown(e, 'move')}
                >
                  {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                    <span
                      key={corner}
                      onPointerDown={(e) => onPointerDown(e, corner)}
                      className="absolute rounded-sm border border-primary bg-background"
                      style={{
                        width: HANDLE,
                        height: HANDLE,
                        left: corner.includes('w') ? -HANDLE / 2 : undefined,
                        right: corner.includes('e') ? -HANDLE / 2 : undefined,
                        top: corner.includes('n') ? -HANDLE / 2 : undefined,
                        bottom: corner.includes('s') ? -HANDLE / 2 : undefined,
                        cursor: `${corner}-resize`,
                        touchAction: 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Werkzeugleiste */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={() => rotate(-1)}
            >
              <RotateCcw className="h-4 w-4" />
              {t.rotateLeft}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={() => rotate(1)}
            >
              <RotateCw className="h-4 w-4" />
              {t.rotateRight}
            </Button>
            <Button
              type="button"
              variant={cropping ? 'default' : 'outline'}
              className="min-h-[44px]"
              onClick={() => {
                setCropping((c) => !c);
                if (cropping) setCrop(null);
              }}
            >
              <Crop className="h-4 w-4" />
              {t.crop}
            </Button>
          </div>

          <Slider
            label={`${t.brightness} (${brightness > 0 ? '+' : ''}${brightness}%)`}
            value={brightness}
            onChange={setBrightness}
          />
          <Slider
            label={`${t.contrast} (${contrast > 0 ? '+' : ''}${contrast}%)`}
            value={contrast}
            onChange={setContrast}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            className="min-h-[44px]"
            onClick={reset}
          >
            {t.reset}
          </Button>
          <Button type="button" className="min-h-[44px]" onClick={apply}>
            {t.apply}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Bereichsregler -50 … +50 mit Beschriftung. */
function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}): ReactNode {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="range"
        min={-50}
        max={50}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-primary"
      />
    </label>
  );
}
