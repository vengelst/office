'use client';

/**
 * Arbeitsitems-Liste des Monteurs im Browser (SPEZ-arbeitsitems.md Abschnitt 6).
 *
 * Nachbau von `apps/mobile/app/(app)/work-items/index.tsx`: aktuelles Item
 * (laufende Session), eigene Items, offener Pool, Suche über die Kennung.
 * Ändert nichts an der Stempel-Logik – der Stempel-Status wird nur gelesen,
 * um den Hinweis „Erst einstempeln“ zeigen zu können.
 *
 * Eine Implementierung für beide Einstiege: `/worker-app/work-items` und den
 * Kiosk-Terminal-Screen.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, PlayCircle, RotateCw, Search, TriangleAlert, X } from 'lucide-react';
import { both, T } from '@/lib/i18n-work-items';
import { formatTime, workerApi, type ClockStatus } from '@/lib/timesheets';
import {
  apiMessage,
  formatLocation,
  workerWorkItemsApi,
  type MyWorkItemsResponse,
  type WorkItemListEntry,
} from '@/lib/worker-work-items';
import { StatusBadge } from './status-badge';

export interface WorkItemsListProps {
  /** ID des angemeldeten Monteurs (für den Stempel-Status). */
  workerId: string;
  /** Optional auf ein Projekt eingeschränkt (Kiosk: festes Projekt). */
  projectId?: string;
  /** Öffnet das Detail eines Items. */
  onSelect: (itemId: string) => void;
  /** Zurück zum Dashboard / Kiosk-Aktionsscreen. */
  onBack: () => void;
  /** Kiosk: jede Nutzeraktion verlängert den Auto-Logout. */
  onActivity?: () => void;
}

export function WorkItemsList({
  workerId,
  projectId,
  onSelect,
  onBack,
  onActivity,
}: WorkItemsListProps): ReactNode {
  const [data, setData] = useState<MyWorkItemsResponse | null>(null);
  const [clock, setClock] = useState<ClockStatus | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [items, status] = await Promise.all([
        workerWorkItemsApi.mine(projectId),
        workerApi.status(workerId),
      ]);
      setData(items);
      setClock(status);
      setError('');
    } catch (err) {
      setError(apiMessage(err, both(T.loadFailed)));
    }
  }, [projectId, workerId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      await load();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const handleRefresh = async (): Promise<void> => {
    onActivity?.();
    setReloading(true);
    await load();
    setReloading(false);
  };

  const { mine, open } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const match = (item: WorkItemListEntry): boolean =>
      needle.length === 0 ||
      item.itemKey.toLowerCase().includes(needle) ||
      (item.title ?? '').toLowerCase().includes(needle) ||
      (item.room ?? '').toLowerCase().includes(needle);
    return {
      mine: (data?.mine ?? []).filter(match),
      open: (data?.open ?? []).filter(match),
    };
  }, [data, query]);

  // Die API liefert die laufende Session projektübergreifend – in der
  // Projektliste nur zeigen, wenn sie zu diesem Projekt gehört.
  const session = data?.currentSession ?? null;
  const currentSession =
    session && (!projectId || session.workItem.projectId === projectId)
      ? session
      : null;
  const clockedIn = clock?.clockedIn ?? false;

  const handleSelect = (id: string): void => {
    onActivity?.();
    onSelect(id);
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-gray-100">
      {/* Kopf */}
      <header className="flex items-center gap-2 px-3 pb-3 pt-2">
        <button
          type="button"
          onClick={() => {
            onActivity?.();
            onBack();
          }}
          aria-label={both(T.back)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-gray-50 transition hover:bg-gray-800"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold leading-tight">{T.workItems.de}</h1>
          <p className="text-[13px] text-gray-500">{T.workItems.sk}</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={reloading}
          aria-label={both(T.refresh)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-800 disabled:opacity-50"
        >
          <RotateCw className={`h-5 w-5 ${reloading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="flex-1 px-5 pb-8">
        {loading ? (
          <p className="py-10 text-center text-sm text-gray-500">
            {both(T.loading)}
          </p>
        ) : (
          <>
            {error && (
              <p className="mb-4 rounded-xl bg-red-500/10 p-4 text-sm text-red-300">
                {error}
              </p>
            )}

            {!clockedIn && (
              <div className="mb-4 flex gap-2.5 rounded-xl border border-yellow-500/30 bg-yellow-500/[0.08] p-3.5">
                <TriangleAlert className="h-5 w-5 shrink-0 text-yellow-400" />
                <div className="flex-1">
                  <p className="text-[15px] font-semibold text-yellow-400">
                    {both(T.clockInFirst)}
                  </p>
                  <p className="text-[13px] text-gray-300">
                    {T.clockInFirstHint.de}
                  </p>
                  <p className="text-[13px] italic text-gray-400">
                    {T.clockInFirstHint.sk}
                  </p>
                </div>
              </div>
            )}

            {currentSession && (
              <button
                type="button"
                onClick={() => handleSelect(currentSession.workItem.id)}
                className="mb-4 w-full rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.08] p-4 text-left transition active:scale-[0.99]"
              >
                <span className="mb-1.5 flex items-center gap-1.5">
                  <PlayCircle className="h-[18px] w-[18px] text-emerald-400" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">
                    {both(T.currentItem)}
                  </span>
                </span>
                <span className="block font-mono text-xl font-bold text-gray-50">
                  {currentSession.workItem.itemKey}
                </span>
                {currentSession.workItem.title && (
                  <span className="mt-0.5 block text-sm text-gray-300">
                    {currentSession.workItem.title}
                  </span>
                )}
                <span className="mt-1.5 block text-xs text-gray-400">
                  {both(T.timeRunning)} · {formatTime(currentSession.startedAt)}
                </span>
              </button>
            )}

            {/* Suche über die Kennung */}
            <div className="mb-5 flex min-h-[52px] items-center gap-2 rounded-xl bg-gray-900 px-3.5">
              <Search className="h-[18px] w-[18px] shrink-0 text-gray-500" />
              <input
                value={query}
                onChange={(e) => {
                  onActivity?.();
                  setQuery(e.target.value);
                }}
                placeholder={both(T.searchKey)}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent py-3 text-base text-gray-50 outline-none placeholder:text-gray-500"
              />
              {query.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label={both(T.cancel)}
                  className="text-gray-500"
                >
                  <X className="h-[18px] w-[18px]" />
                </button>
              )}
            </div>

            <Section
              title={T.myItems.de}
              subtitle={T.myItems.sk}
              items={mine}
              emptyText={both(T.noItems)}
              currentItemId={currentSession?.workItem.id ?? null}
              onSelect={handleSelect}
            />

            <Section
              title={T.openPool.de}
              subtitle={T.openPool.sk}
              items={open}
              emptyText={both(T.noOpenItems)}
              currentItemId={null}
              onSelect={handleSelect}
            />
          </>
        )}
      </div>
    </div>
  );
}

/** Eine Listensektion („Meine“ / „Offen“). */
function Section({
  title,
  subtitle,
  items,
  emptyText,
  currentItemId,
  onSelect,
}: {
  title: string;
  subtitle: string;
  items: WorkItemListEntry[];
  emptyText: string;
  currentItemId: string | null;
  onSelect: (id: string) => void;
}): ReactNode {
  return (
    <section className="mb-6">
      <div className="mb-2.5 flex items-baseline gap-2">
        <h2 className="text-base font-bold text-gray-50">{title}</h2>
        <span className="flex-1 text-[13px] text-gray-500">{subtitle}</span>
        <span className="text-[13px] font-semibold text-gray-500">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl bg-gray-900 p-5 text-center text-sm text-gray-500">
          {emptyText}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <ItemRow
                item={item}
                isCurrent={item.id === currentItemId}
                onSelect={onSelect}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Eine Item-Zeile mit Kennung, Ort und Status-Badge. */
function ItemRow({
  item,
  isCurrent,
  onSelect,
}: {
  item: WorkItemListEntry;
  isCurrent: boolean;
  onSelect: (id: string) => void;
}): ReactNode {
  const location = formatLocation(item);
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={`flex min-h-[64px] w-full items-center gap-3 rounded-xl bg-gray-900 p-3.5 text-left transition active:scale-[0.99] ${
        isCurrent ? 'border border-emerald-500/40' : ''
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {isCurrent && <PlayCircle className="h-4 w-4 text-emerald-400" />}
          <span className="font-mono text-base font-bold text-gray-50">
            {item.itemKey}
          </span>
        </span>
        {item.title && (
          <span className="mt-0.5 block truncate text-sm text-gray-300">
            {item.title}
          </span>
        )}
        {location.length > 0 && (
          <span className="mt-0.5 block truncate text-xs text-gray-500">
            {location}
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <StatusBadge status={item.status} />
      </span>
      <ChevronRight className="h-[18px] w-[18px] shrink-0 text-gray-600" />
    </button>
  );
}
