/**
 * Komponente: components/projects/tabs/work-items/items-section.tsx (Office-Web).
 * Domänen-UI – ausführliche Handler-JSDocs nur bei nicht-trivialer Logik.
 */

'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { LayoutList, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/customers/empty-state';
import { WorkItemStatusBadge } from '@/components/projects/work-item-status-badge';
import { texts } from '@/lib/texts';
import {
  WORK_ITEM_STATUSES,
  WORK_ITEM_STATUS_LABELS,
  type ProjectBlock,
  type WorkItemListEntry,
  type WorkItemListResponse,
  type WorkItemStatus,
} from '@/lib/work-items';

/** Sentinel-Wert der Select-Filter für "keine Einschränkung". */
const ALL = '__all__';

/** "5 · A · Lift Lobby" aus Geschoss/Bereich/Raum. */
function locationLabel(item: WorkItemListEntry): string {
  return [item.floor, item.area, item.room].filter(Boolean).join(' · ') || '–';
}

/** Namen der aktiven Monteure eines Items. */
function workerLabel(item: WorkItemListEntry): string {
  if (item.assignments.length === 0) return '–';
  return item.assignments
    .map((a) => `${a.worker.lastName}, ${a.worker.firstName}`)
    .join('; ');
}

/**
 * Item-Liste mit Status-Zählern, Filtern (Status, Block, Suche) und Klick
 * auf ein Item für das Detail-Drawer.
 */
export function ItemsSection({
  data,
  blocks,
  loading,
  status,
  blockKey,
  search,
  onStatusChange,
  onBlockChange,
  onSearchChange,
  onReload,
  onSelect,
}: {
  data: WorkItemListResponse | null;
  blocks: ProjectBlock[];
  loading: boolean;
  status: WorkItemStatus | '';
  blockKey: string;
  search: string;
  onStatusChange: (value: WorkItemStatus | '') => void;
  onBlockChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onReload: () => void;
  onSelect: (itemId: string) => void;
}): ReactNode {
  const t = texts.projects.workItems;
  const [searchDraft, setSearchDraft] = useState(search);

  const items = data?.items ?? [];
  const filtered = status || blockKey || search;

  /** Status-Zähler über das gesamte Projekt (unabhängig vom Filter). */
  const counts = useMemo(
    () => data?.statusCounts ?? null,
    [data?.statusCounts],
  );

  const submitSearch = (): void => onSearchChange(searchDraft.trim());

  const Row = ({ item }: { item: WorkItemListEntry }): ReactNode => (
    <TableRow
      className="cursor-pointer"
      onClick={() => onSelect(item.id)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect(item.id);
      }}
    >
      <TableCell className="font-mono text-sm font-medium">
        {item.itemKey}
      </TableCell>
      <TableCell className="text-sm">{item.title ?? '–'}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {locationLabel(item)}
      </TableCell>
      <TableCell className="font-mono text-xs">
        {item.block?.blockKey ?? '–'}
      </TableCell>
      <TableCell>
        <WorkItemStatusBadge status={item.status} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {workerLabel(item)}
      </TableCell>
      <TableCell className="text-sm tabular-nums">
        {item._count.materials}
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <LayoutList className="h-4 w-4" />
          {t.list.title}
          {data && (
            <span className="text-sm font-normal text-muted-foreground">
              {data.total} {t.list.countLabel}
            </span>
          )}
        </h3>
        <Button
          variant="outline"
          className="min-h-[44px]"
          onClick={onReload}
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4" />
          {t.list.reload}
        </Button>
      </div>

      {/* Status-Zähler des Projekts – zugleich Schnellfilter */}
      {counts && (
        <div className="flex flex-wrap gap-2">
          {WORK_ITEM_STATUSES.map((st) => (
            <Button
              key={st}
              type="button"
              variant={status === st ? 'default' : 'secondary'}
              className="min-h-[44px]"
              onClick={() => onStatusChange(status === st ? '' : st)}
            >
              {WORK_ITEM_STATUS_LABELS[st]}: {counts[st] ?? 0}
            </Button>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto]">
        <div className="flex gap-2">
          <Input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
            placeholder={t.list.search}
            className="min-h-[44px]"
          />
          <Button
            variant="outline"
            className="min-h-[44px]"
            onClick={submitSearch}
            aria-label={t.list.search}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <Select
          value={status || ALL}
          onValueChange={(v) => onStatusChange(v === ALL ? '' : (v as WorkItemStatus))}
        >
          <SelectTrigger className="min-h-[44px] md:w-48">
            <SelectValue placeholder={t.list.filterStatus} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t.list.all}</SelectItem>
            {WORK_ITEM_STATUSES.map((st) => (
              <SelectItem key={st} value={st}>
                {WORK_ITEM_STATUS_LABELS[st]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={blockKey || ALL}
          onValueChange={(v) => onBlockChange(v === ALL ? '' : v)}
        >
          <SelectTrigger className="min-h-[44px] md:w-48">
            <SelectValue placeholder={t.list.filterBlock} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t.list.all}</SelectItem>
            {blocks.map((block) => (
              <SelectItem key={block.id} value={block.blockKey}>
                {block.blockKey}
                {block.name ? ` · ${block.name}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <EmptyState
          message={filtered ? t.list.empty : t.list.emptyUnfiltered}
        />
      ) : (
        <>
          {/* Desktop: Tabelle */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.list.itemKey}</TableHead>
                  <TableHead>{t.list.itemTitle}</TableHead>
                  <TableHead>{t.list.location}</TableHead>
                  <TableHead>{t.list.block}</TableHead>
                  <TableHead>{t.list.status}</TableHead>
                  <TableHead>{t.list.assigned}</TableHead>
                  <TableHead>{t.list.materials}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <Row key={item.id} item={item} />
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: Cards */}
          <div className="space-y-3 md:hidden">
            {items.map((item) => (
              <Card
                key={item.id}
                className="cursor-pointer"
                onClick={() => onSelect(item.id)}
              >
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono font-medium">{item.itemKey}</p>
                      <p className="truncate text-sm">{item.title ?? '–'}</p>
                    </div>
                    <WorkItemStatusBadge status={item.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {locationLabel(item)}
                    {item.block && <> · {item.block.blockKey}</>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.list.assigned}: {workerLabel(item)} · {t.list.materials}:{' '}
                    {item._count.materials}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {data && data.total > items.length && (
            <p className="text-xs text-muted-foreground">
              {t.list.truncated
                .replace('{take}', String(items.length))
                .replace('{total}', String(data.total))}
            </p>
          )}
        </>
      )}
    </div>
  );
}
