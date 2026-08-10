'use client';

import type { ReactNode } from 'react';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  useWorkItemText,
} from '@/lib/i18n-work-items';
import type { WorkItemStatus } from '@/lib/worker-work-items';

/**
 * Status-Badge eines Arbeitsitems.
 * Im Kiosk: eine Sprache; in /worker-app: DE / SK.
 */
export function StatusBadge({
  status,
}: {
  status: WorkItemStatus;
}): ReactNode {
  const tx = useWorkItemText();
  const colors = STATUS_COLORS[status];
  return (
    <span
      className="rounded-md px-2 py-1 text-[11px] font-semibold leading-tight"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {tx(STATUS_LABELS[status])}
    </span>
  );
}
