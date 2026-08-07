'use client';

import type { ReactNode } from 'react';
import { STATUS_COLORS, statusLabel } from '@/lib/i18n-work-items';
import type { WorkItemStatus } from '@/lib/worker-work-items';

/**
 * Status-Badge eines Arbeitsitems (DE + SK, Farben wie in der APK).
 * Die Farbwerte kommen aus `STATUS_COLORS` und werden inline gesetzt –
 * damit bleiben Mobile und Web ohne Tailwind-Mapping identisch.
 */
export function StatusBadge({
  status,
}: {
  status: WorkItemStatus;
}): ReactNode {
  const colors = STATUS_COLORS[status];
  return (
    <span
      className="rounded-md px-2 py-1 text-[11px] font-semibold leading-tight"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {statusLabel(status)}
    </span>
  );
}
