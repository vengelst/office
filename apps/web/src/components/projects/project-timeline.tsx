'use client';

import { useMemo, type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/customers/empty-state';
import { ProjectStatusBadge } from '@/components/projects/status-badge';
import { PriorityBadge } from '@/components/projects/priority-badge';
import { formatDate } from '@/lib/format';
import type { ProjectStatus, ProjectTimelineItem } from '@/lib/projects';
import { texts } from '@/lib/texts';

const DAY = 86_400_000;

const BAR_COLORS: Record<ProjectStatus, string> = {
  DRAFT: 'bg-muted-foreground/40',
  PLANNED: 'bg-blue-600',
  ACTIVE: 'bg-green-600',
  PAUSED: 'bg-amber-500',
  COMPLETED: 'bg-slate-600',
  CANCELED: 'bg-red-600',
};

const toTime = (v: string): number => new Date(v).getTime();

/** Geplanter (Fallback: tatsächlicher) Start/Ende eines Projekts. */
function span(p: ProjectTimelineItem): { start: number; end: number } | null {
  const startSrc = p.plannedStartDate ?? p.actualStartDate;
  if (!startSrc) return null;
  const start = toTime(startSrc);
  const endSrc = p.plannedEndDate ?? p.actualEndDate ?? startSrc;
  const end = Math.max(toTime(endSrc), start + DAY);
  return { start, end };
}

export function ProjectTimeline({
  items,
  from,
  to,
  onSelect,
}: {
  items: ProjectTimelineItem[];
  from: string;
  to: string;
  onSelect: (id: string) => void;
}): ReactNode {
  const t = texts.projects;
  const rangeStart = toTime(from);
  const rangeEnd = Math.max(toTime(to), rangeStart + DAY);
  const total = rangeEnd - rangeStart;

  // Monatsmarkierungen innerhalb des Zeitraums
  const months = useMemo(() => {
    const out: { label: string; leftPct: number }[] = [];
    const d = new Date(rangeStart);
    d.setDate(1);
    while (d.getTime() <= rangeEnd) {
      const left = ((d.getTime() - rangeStart) / total) * 100;
      if (left >= 0 && left <= 100) {
        out.push({
          label: d.toLocaleDateString('de-DE', {
            month: 'short',
            year: '2-digit',
          }),
          leftPct: left,
        });
      }
      d.setMonth(d.getMonth() + 1);
    }
    return out;
  }, [rangeStart, rangeEnd, total]);

  const withSpan = useMemo(
    () =>
      items
        .map((p) => ({ p, s: span(p) }))
        .filter((x): x is { p: ProjectTimelineItem; s: NonNullable<ReturnType<typeof span>> } => x.s !== null),
    [items],
  );

  // Mobile: nach Startmonat gruppierte Cards
  const byMonth = useMemo(() => {
    const map = new Map<string, { label: string; items: ProjectTimelineItem[] }>();
    for (const { p } of withSpan) {
      const src = p.plannedStartDate ?? p.actualStartDate!;
      const d = new Date(src);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      if (!map.has(key)) map.set(key, { label, items: [] });
      map.get(key)!.items.push(p);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [withSpan]);

  if (items.length === 0) {
    return <EmptyState message={t.calendar.noEvents} />;
  }

  return (
    <>
      {/* Desktop: horizontale Balken (Gantt) */}
      <Card className="hidden overflow-hidden md:block">
        <CardContent className="p-0">
          {/* Monatsleiste */}
          <div className="relative h-8 border-b bg-muted/30">
            {months.map((m, i) => (
              <span
                key={i}
                className="absolute top-1/2 -translate-y-1/2 border-l pl-1 text-xs text-muted-foreground"
                style={{ left: `${m.leftPct}%` }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div className="divide-y">
            {withSpan.map(({ p, s }) => {
              const left = Math.max(0, ((s.start - rangeStart) / total) * 100);
              const right = Math.min(100, ((s.end - rangeStart) / total) * 100);
              const width = Math.max(1.5, right - left);
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-[10rem_1fr] items-center gap-2 px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => onSelect(p.id)}
                    className="truncate text-left text-sm font-medium hover:underline"
                    title={p.title}
                  >
                    {p.title}
                  </button>
                  <div className="relative h-7">
                    <button
                      type="button"
                      onClick={() => onSelect(p.id)}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      className={`absolute top-0 flex h-7 items-center overflow-hidden rounded px-2 text-xs text-white ${BAR_COLORS[p.status]}`}
                      title={`${p.title} · ${formatDate(p.plannedStartDate)} – ${formatDate(p.plannedEndDate)}`}
                    >
                      <span className="truncate">{p.projectNumber}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Mobile: Monats-Cards */}
      <div className="space-y-6 md:hidden">
        {byMonth.map((group) => (
          <div key={group.label} className="space-y-3">
            <h3 className="text-sm font-semibold capitalize text-muted-foreground">
              {group.label}
            </h3>
            {group.items.map((p) => (
              <Card
                key={p.id}
                className="active:bg-muted/50"
                role="button"
                tabIndex={0}
                onClick={() => onSelect(p.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(p.id);
                  }
                }}
              >
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.title}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {p.projectNumber} · {p.customer.companyName}
                      </p>
                    </div>
                    <ProjectStatusBadge status={p.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <PriorityBadge priority={p.priority} />
                    <span>
                      {formatDate(p.plannedStartDate) || '–'} –{' '}
                      {formatDate(p.plannedEndDate) || '…'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
