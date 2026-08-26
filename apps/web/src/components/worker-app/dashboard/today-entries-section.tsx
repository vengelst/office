import { formatTime, type TodayEntry } from '@/lib/timesheets';
import { cn } from '@/lib/utils';

interface TodayEntriesSectionProps {
  entries: TodayEntry[];
  labels: {
    todayTitle: string;
    todayEmpty: string;
    clockIn: string;
    clockOut: string;
    startBreak: string;
    endBreak: string;
  };
}

function entryTypeLabel(
  entryType: TodayEntry['entryType'],
  labels: TodayEntriesSectionProps['labels'],
): string {
  switch (entryType) {
    case 'CLOCK_IN':
      return labels.clockIn;
    case 'CLOCK_OUT':
      return labels.clockOut;
    case 'BREAK_START':
      return labels.startBreak;
    case 'BREAK_END':
      return labels.endBreak;
    default:
      return entryType;
  }
}

function entryTypeClassName(entryType: TodayEntry['entryType']): string {
  switch (entryType) {
    case 'CLOCK_IN':
      return 'bg-emerald-100 text-emerald-700';
    case 'CLOCK_OUT':
      return 'bg-red-100 text-red-700';
    case 'BREAK_START':
    case 'BREAK_END':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export function TodayEntriesSection({
  entries,
  labels,
}: TodayEntriesSectionProps) {
  return (
    <section>
      <p className="mb-2 text-sm font-semibold">{labels.todayTitle}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.todayEmpty}</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <span
                className={cn(
                  'rounded px-2 py-0.5 text-xs font-medium',
                  entryTypeClassName(e.entryType),
                )}
              >
                {entryTypeLabel(e.entryType, labels)}
              </span>
              <span className="font-mono">
                {formatTime(e.occurredAtClient)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
