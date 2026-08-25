'use client';

/**
 * Hover-Vorschau für Aufgaben-Titel: zeigt Beschreibung und Kerndaten
 * nur beim Überfahren der Titel-Spalte (nicht der ganzen Zeile).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Todo } from '@/lib/todos';
import { texts } from '@/lib/texts';

const t = texts.todos;

interface TodoTitleHoverProps {
  todo: Todo;
  /** Zusatzinfos unter der Beschreibung (Priorität, Fälligkeit, …). */
  meta?: ReactNode;
  children: ReactNode;
}

export function TodoTitleHover({
  todo,
  meta,
  children,
}: TodoTitleHoverProps): ReactNode {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const show = () => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 320;
      const estimateH = 180;
      let left = rect.left;
      let top = rect.bottom + 6;
      if (left + width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - width - 8);
      }
      if (top + estimateH > window.innerHeight - 8) {
        top = Math.max(8, rect.top - estimateH - 6);
      }
      setPos({ top, left });
      setOpen(true);
    }, 220);
  };

  const hide = () => {
    clearTimer();
    setOpen(false);
  };

  const description =
    todo.description?.trim() || t.hover.noDescription;

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex max-w-full items-center gap-2"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {mounted &&
        open &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[80] w-80 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
            style={{ top: pos.top, left: pos.left }}
          >
            <p className="text-sm font-semibold leading-snug">{todo.title}</p>
            <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
            {meta ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-[11px] text-muted-foreground">
                {meta}
              </div>
            ) : null}
          </div>,
          document.body,
        )}
    </>
  );
}
