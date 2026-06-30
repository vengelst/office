'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

export interface SignatureCanvasHandle {
  /** Leert die Zeichenfläche. */
  clear: () => void;
  /** true, wenn noch nichts gezeichnet wurde. */
  isEmpty: () => boolean;
  /** Aktuelle Zeichnung als PNG-Data-URL (oder null, wenn leer). */
  toDataURL: () => string | null;
}

interface SignatureCanvasProps {
  className?: string;
  height?: number;
}

/**
 * Touch-/Stift-/Maus-fähiges Unterschriftenfeld (HTML5 Canvas + Pointer Events).
 * Liefert die Zeichnung über die imperative Ref als Base64-PNG.
 */
export const SignatureCanvas = forwardRef<
  SignatureCanvasHandle,
  SignatureCanvasProps
>(function SignatureCanvas({ className, height = 200 }, ref): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  /** Skaliert den Canvas auf Containerbreite × devicePixelRatio. */
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }, [height]);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  const pointPos = (
    e: React.PointerEvent<HTMLCanvasElement>,
  ): { x: number; y: number } => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pointPos(e);
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !last.current) return;
    const pos = pointPos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    last.current = pos;
    dirty.current = true;
  };

  const handleUp = (): void => {
    drawing.current = false;
    last.current = null;
  };

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        dirty.current = false;
      },
      isEmpty: () => !dirty.current,
      toDataURL: () => {
        if (!dirty.current || !canvasRef.current) return null;
        return canvasRef.current.toDataURL('image/png');
      },
    }),
    [],
  );

  return (
    <canvas
      ref={canvasRef}
      style={{ height, touchAction: 'none' }}
      className={cn(
        'w-full cursor-crosshair rounded-md border border-input bg-white',
        className,
      )}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerLeave={handleUp}
    />
  );
});
