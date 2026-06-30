'use client';

import { type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';
import { expiryStatus } from '@/lib/workers';
import type { VehicleCategory } from '@/lib/vehicles';
import { texts } from '@/lib/texts';

const t = texts.vehicles;

/** Kategorie-Badge (PKW / Transporter / LKW / Anhänger). */
export function CategoryBadge({
  category,
}: {
  category: VehicleCategory | null;
}): ReactNode {
  if (!category) return <span className="text-muted-foreground">–</span>;
  return <Badge variant="outline">{t.category[category]}</Badge>;
}

/** Status-Badge: zugewiesen an … (sky) oder verfügbar (emerald). */
export function VehicleStatusBadge({
  workerName,
}: {
  workerName: string | null;
}): ReactNode {
  if (workerName) {
    return (
      <Badge className="border-transparent bg-sky-500 text-white hover:bg-sky-500">
        {t.status.assignedTo(workerName)}
      </Badge>
    );
  }
  return (
    <Badge className="border-transparent bg-emerald-500 text-white hover:bg-emerald-500">
      {t.status.available}
    </Badge>
  );
}

/**
 * Ablaufdatum (TÜV/Versicherung) mit Farb-Markierung:
 * gelb (<30 Tage), rot (abgelaufen).
 */
export function VehicleExpiryDate({
  value,
}: {
  value: string | null | undefined;
}): ReactNode {
  if (!value) return <span className="text-muted-foreground">–</span>;
  const status = expiryStatus(value);
  const cls =
    status === 'expired'
      ? 'text-red-600 dark:text-red-400 font-medium'
      : status === 'soon'
        ? 'text-amber-600 dark:text-amber-400 font-medium'
        : '';
  return (
    <span className={`inline-flex items-center gap-1 ${cls}`}>
      {(status === 'expired' || status === 'soon') && (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      )}
      {formatDate(value)}
      {status === 'expired' && (
        <span className="text-xs">({t.expiry.expired})</span>
      )}
      {status === 'soon' && <span className="text-xs">({t.expiry.soon})</span>}
    </span>
  );
}
