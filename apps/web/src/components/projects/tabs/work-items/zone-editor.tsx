/**
 * Komponente: components/projects/tabs/work-items/zone-editor.tsx (Office-Web).
 * Domänen-UI – ausführliche Handler-JSDocs nur bei nicht-trivialer Logik.
 */

'use client';

import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FIELD_TARGET_LABELS,
  WORK_CARD_FIELD_TARGETS,
  type WorkCardFieldTarget,
  type WorkCardFieldZone,
} from '@/lib/work-card-templates';

const ZONE_COLORS: Record<WorkCardFieldTarget, string> = {
  itemKey: 'rgba(37, 99, 235, 0.35)',
  workScopeDe: 'rgba(22, 163, 74, 0.35)',
  workScopeSk: 'rgba(5, 150, 105, 0.35)',
  title: 'rgba(217, 119, 6, 0.35)',
  floor: 'rgba(147, 51, 234, 0.35)',
  room: 'rgba(219, 39, 119, 0.35)',
};

const ZONE_BORDER: Record<WorkCardFieldTarget, string> = {
  itemKey: '#2563eb',
  workScopeDe: '#16a34a',
  workScopeSk: '#059669',
  title: '#d97706',
  floor: '#9333ea',
  room: '#db2777',
};

export interface ZoneAssignment {
  target: WorkCardFieldTarget;
  zone: WorkCardFieldZone;
}

interface DragState {
  startX: number;
  startY: number;
  curX: number;
  curY: number;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function normalizeRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): WorkCardFieldZone | null {
  const left = clamp01(Math.min(x0, x1));
  const top = clamp01(Math.min(y0, y1));
  const right = clamp01(Math.max(x0, x1));
  const bottom = clamp01(Math.max(y0, y1));
  const w = right - left;
  const h = bottom - top;
  if (w < 0.01 || h < 0.01) return null;
  return { x: left, y: top, w, h };
}

/**
 * Zone-Editor: Rechtecke auf der Beispielseite ziehen und Feldern zuordnen.
 * Zonen sind normiert 0–1 relativ zum angezeigten Bild.
 */
export function ZoneEditor({
  imageSrc,
  zones,
  onChange,
  labels,
}: {
  imageSrc: string;
  zones: ZoneAssignment[];
  onChange: (zones: ZoneAssignment[]) => void;
  labels: {
    drawHint: string;
    activeField: string;
    clearZone: string;
    zonesList: string;
  };
}): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTarget, setActiveTarget] =
    useState<WorkCardFieldTarget>('itemKey');
  const [drag, setDrag] = useState<DragState | null>(null);

  const toNorm = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toNorm(e.clientX, e.clientY);
    setDrag({ startX: p.x, startY: p.y, curX: p.x, curY: p.y });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!drag) return;
    const p = toNorm(e.clientX, e.clientY);
    setDrag({ ...drag, curX: p.x, curY: p.y });
  };

  const finishDrag = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!drag) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const zone = normalizeRect(drag.startX, drag.startY, drag.curX, drag.curY);
    setDrag(null);
    if (!zone) return;
    onChange([
      ...zones.filter((z) => z.target !== activeTarget),
      { target: activeTarget, zone },
    ]);
  };

  const removeZone = (target: WorkCardFieldTarget): void => {
    onChange(zones.filter((z) => z.target !== target));
  };

  const draft =
    drag &&
    normalizeRect(drag.startX, drag.startY, drag.curX, drag.curY);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-0.5 block text-[10px] text-muted-foreground">
            {labels.activeField}
          </label>
          <Select
            value={activeTarget}
            onValueChange={(v) => setActiveTarget(v as WorkCardFieldTarget)}
          >
            <SelectTrigger className="h-9 min-w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORK_CARD_FIELD_TARGETS.map((ft) => (
                <SelectItem key={ft} value={ft}>
                  {FIELD_TARGET_LABELS[ft]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">{labels.drawHint}</p>
      </div>

      <div
        ref={containerRef}
        className="relative max-h-[70vh] w-full cursor-crosshair select-none overflow-auto rounded-md border bg-muted/30"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={() => setDrag(null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt="Beispielseite"
          className="pointer-events-none block h-auto w-full"
          draggable={false}
        />
        {zones.map((z) => (
          <div
            key={z.target}
            className="pointer-events-none absolute border-2"
            style={{
              left: `${z.zone.x * 100}%`,
              top: `${z.zone.y * 100}%`,
              width: `${z.zone.w * 100}%`,
              height: `${z.zone.h * 100}%`,
              backgroundColor: ZONE_COLORS[z.target],
              borderColor: ZONE_BORDER[z.target],
            }}
          >
            <span
              className="absolute left-0 top-0 max-w-full truncate px-1 text-[10px] font-medium text-white"
              style={{ backgroundColor: ZONE_BORDER[z.target] }}
            >
              {FIELD_TARGET_LABELS[z.target]}
            </span>
          </div>
        ))}
        {draft && (
          <div
            className="pointer-events-none absolute border-2 border-dashed"
            style={{
              left: `${draft.x * 100}%`,
              top: `${draft.y * 100}%`,
              width: `${draft.w * 100}%`,
              height: `${draft.h * 100}%`,
              backgroundColor: ZONE_COLORS[activeTarget],
              borderColor: ZONE_BORDER[activeTarget],
            }}
          />
        )}
      </div>

      {zones.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium">{labels.zonesList}</p>
          <ul className="space-y-1">
            {zones.map((z) => (
              <li
                key={z.target}
                className="flex items-center justify-between rounded border px-2 py-1 text-xs"
              >
                <span>
                  <span
                    className="mr-2 inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: ZONE_BORDER[z.target] }}
                  />
                  {FIELD_TARGET_LABELS[z.target]}
                  <span className="ml-2 font-mono text-muted-foreground">
                    {z.zone.x.toFixed(2)},{z.zone.y.toFixed(2)}{' '}
                    {z.zone.w.toFixed(2)}×{z.zone.h.toFixed(2)}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => removeZone(z.target)}
                  title={labels.clearZone}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
