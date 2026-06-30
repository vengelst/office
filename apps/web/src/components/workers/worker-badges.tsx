'use client';

import { type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';
import {
  expiryStatus,
  type WorkerAvailability,
  type WorkerType,
  type LanguageProficiency,
} from '@/lib/workers';
import { texts } from '@/lib/texts';

const t = texts.workers;

/** Typ-Badge (Angestellt / Subunternehmen). */
export function WorkerTypeBadge({ type }: { type: WorkerType }): ReactNode {
  return (
    <Badge variant={type === 'EMPLOYED' ? 'secondary' : 'outline'}>
      {t.type[type]}
    </Badge>
  );
}

/** Farbcodierte Verfügbarkeits-Badge. */
export function AvailabilityBadge({
  availability,
}: {
  availability: WorkerAvailability;
}): ReactNode {
  const styles: Record<WorkerAvailability, string> = {
    AVAILABLE: 'border-transparent bg-emerald-500 text-white hover:bg-emerald-500',
    ON_PROJECT: 'border-transparent bg-sky-500 text-white hover:bg-sky-500',
    SICK: 'border-transparent bg-red-500 text-white hover:bg-red-500',
    VACATION: 'border-transparent bg-amber-500 text-black hover:bg-amber-500',
    UNAVAILABLE: 'border-transparent bg-muted text-muted-foreground',
  };
  return (
    <Badge className={styles[availability]}>{t.availability[availability]}</Badge>
  );
}

/** Sprach-Niveau-Badge (A1–C2 / Muttersprache). */
export function ProficiencyBadge({
  proficiency,
}: {
  proficiency: LanguageProficiency;
}): ReactNode {
  return (
    <Badge variant={proficiency === 'NATIVE' ? 'secondary' : 'outline'}>
      {t.proficiency[proficiency]}
    </Badge>
  );
}

/**
 * Ablaufdatum mit Farb-Markierung: gelb (<30 Tage), rot (abgelaufen).
 * Zeigt das Datum und ein Warnsymbol an.
 */
export function ExpiryDate({
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
