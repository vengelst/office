'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { texts } from '@/lib/texts';
import { formatDateTime } from '@/lib/format';
import { kioskPlApi } from '@/lib/kiosk-pl-api';
import {
  workItemLocationLabel,
  workItemWorkerLabel,
} from '@/lib/work-item-display';
import {
  WORK_ITEM_STATUSES,
  WORK_ITEM_STATUS_LABELS,
  type CustomerPlBoardResponse,
  type WorkItemStatus,
} from '@/lib/work-items';
import { KioskPlItemDetail } from './pl-item-detail';

/**
 * Touch-Item-Board für den Kunden-PL-Kiosk.
 * Filter (Status-Chips + Suche), Liste, Detail als Vollbild-Overlay.
 */
export function KioskPlItemBoard({
  projectId,
  onActivity,
}: {
  projectId: string;
  /** Idle-Timer zurücksetzen (Touch / Tippen). */
  onActivity: () => void;
}): ReactNode {
  const t = texts.kiosk.pl.items;
  const tBoard = texts.customerPl.board;

  const [data, setData] = useState<CustomerPlBoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<WorkItemStatus | ''>('');
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flash, setFlash] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    kioskPlApi
      .workItems(projectId, {
        status: status || undefined,
        q: search || undefined,
      })
      .then((res) => {
        setData(res);
        setFailed(false);
      })
      .catch(() => {
        setData(null);
        setFailed(true);
      })
      .finally(() => setLoading(false));
  }, [projectId, status, search]);

  useEffect(() => {
    load();
  }, [load]);

  const items = data?.items ?? [];
  const counts = data?.statusCounts ?? null;
  const filtered = Boolean(status || search);

  const openItem = (id: string) => {
    onActivity();
    setSelectedId(id);
  };

  const handleChanged = (message: string) => {
    setFlash(message);
    setSelectedId(null);
    load();
    onActivity();
    window.setTimeout(() => setFlash(''), 3500);
  };

  return (
    <div className="flex flex-1 flex-col" onClick={onActivity} onTouchStart={onActivity}>
      {flash && (
        <div className="mb-3 rounded-xl bg-green-700/40 px-4 py-3 text-center text-lg font-medium text-green-200">
          {flash}
        </div>
      )}

      {/* Status-Chips */}
      {counts && (
        <div className="mb-3 flex flex-wrap gap-2">
          {WORK_ITEM_STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                onActivity();
                setStatus(status === st ? '' : st);
              }}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-95 ${
                status === st
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
              style={{ minHeight: '44px' }}
            >
              {WORK_ITEM_STATUS_LABELS[st]}: {counts[st] ?? 0}
            </button>
          ))}
        </div>
      )}

      {/* Suche */}
      <div className="mb-4 flex gap-2">
        <input
          type="search"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onActivity();
              setSearch(searchDraft.trim());
            }
          }}
          placeholder={tBoard.search}
          className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-lg text-white placeholder:text-gray-500"
          style={{ minHeight: '44px' }}
        />
        <button
          type="button"
          onClick={() => {
            onActivity();
            setSearch(searchDraft.trim());
          }}
          className="rounded-xl bg-gray-800 px-5 py-3 text-gray-200 transition hover:bg-gray-700"
          style={{ minHeight: '44px' }}
          aria-label={tBoard.search}
        >
          {t.searchAction}
        </button>
        <button
          type="button"
          onClick={() => {
            onActivity();
            load();
          }}
          disabled={loading}
          className="rounded-xl bg-gray-800 px-5 py-3 text-gray-200 transition hover:bg-gray-700 disabled:opacity-50"
          style={{ minHeight: '44px' }}
        >
          {tBoard.reload}
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-400">{texts.common.loading}</p>
      ) : failed ? (
        <div className="space-y-3 text-center">
          <p className="text-red-400">{t.loadError}</p>
          <button
            type="button"
            onClick={() => {
              onActivity();
              load();
            }}
            className="rounded-xl bg-gray-800 px-6 py-3 text-gray-200"
            style={{ minHeight: '44px' }}
          >
            {tBoard.reload}
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-gray-500">
          {filtered ? tBoard.empty : tBoard.emptyUnfiltered}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openItem(item.id)}
              className="w-full rounded-xl bg-gray-900/80 p-4 text-left transition hover:bg-gray-800 active:scale-[0.98]"
              style={{ minHeight: '72px' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-lg font-semibold">{item.itemKey}</p>
                  <p className="truncate text-base text-gray-300">
                    {item.title ?? '–'}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {workItemLocationLabel(item)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {tBoard.columns.workers}: {workItemWorkerLabel(item)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <StatusChip status={item.status} />
                  <p className="mt-2 text-xs text-gray-500">
                    {formatDateTime(item.updatedAt)}
                  </p>
                </div>
              </div>
            </button>
          ))}
          {data && data.total > items.length && (
            <p className="text-center text-xs text-gray-500">
              {tBoard.truncated
                .replace('{take}', String(items.length))
                .replace('{total}', String(data.total))}
            </p>
          )}
        </div>
      )}

      {selectedId && (
        <KioskPlItemDetail
          itemId={selectedId}
          onClose={() => {
            onActivity();
            setSelectedId(null);
          }}
          onChanged={handleChanged}
          onActivity={onActivity}
        />
      )}
    </div>
  );
}

function StatusChip({ status }: { status: WorkItemStatus }): ReactNode {
  const styles: Record<WorkItemStatus, string> = {
    OPEN: 'bg-gray-600 text-gray-100',
    IN_PROGRESS: 'bg-blue-600 text-white',
    REVIEW: 'bg-amber-500 text-black',
    REWORK: 'bg-red-600 text-white',
    APPROVED: 'bg-green-600 text-white',
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {WORK_ITEM_STATUS_LABELS[status]}
    </span>
  );
}
