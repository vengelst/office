/**
 * Timeline-Drawer für Stempeluhr-Zeitraum: Einträge anzeigen/korrigieren.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import {
  formatTime,
  timeEntriesApi,
  type TimeTimelineEntry,
  type TimeTimelineResponse,
} from '@/lib/timesheets';
import { texts } from '@/lib/texts';
import { cn } from '@/lib/utils';

const MANUAL_TYPES = [
  'CLOCK_IN',
  'CLOCK_OUT',
  'BREAK_START',
  'BREAK_END',
  'MANUAL_ADJUSTMENT',
] as const;

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number): string => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

function entryTypeLabel(type: string): string {
  const map = texts.timeClock.period.timeline.entryTypes as Record<
    string,
    string
  >;
  return map[type] ?? type;
}

export interface PeriodTimelineDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId: string | null;
  workerName: string;
  date: string;
  dayOptions?: string[];
  onDateChange?: (date: string) => void;
  projectOptions: { id: string; label: string }[];
  onChanged?: () => void;
}

export function PeriodTimelineDrawer({
  open,
  onOpenChange,
  workerId,
  workerName,
  date,
  dayOptions,
  onDateChange,
  projectOptions,
  onChanged,
}: PeriodTimelineDrawerProps): React.ReactNode {
  const t = texts.timeClock.period.timeline;
  const { toast } = useToast();
  const [data, setData] = useState<TimeTimelineResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState<TimeTimelineEntry | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualType, setManualType] =
    useState<(typeof MANUAL_TYPES)[number]>('CLOCK_IN');
  const [manualTime, setManualTime] = useState('');
  const [manualComment, setManualComment] = useState('');
  const [manualProjectId, setManualProjectId] = useState('');
  const [manualBusy, setManualBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<TimeTimelineEntry | null>(
    null,
  );
  const [deleteComment, setDeleteComment] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(() => {
    if (!workerId || !date) {
      setData(null);
      return;
    }
    setLoading(true);
    timeEntriesApi
      .timeline(workerId, date)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [workerId, date]);

  useEffect(() => {
    if (open && workerId) load();
  }, [open, workerId, load]);

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setManualOpen(false);
      setDeleteTarget(null);
    }
  }, [open]);

  const locked = data?.locked ?? false;

  const startEdit = (entry: TimeTimelineEntry): void => {
    setEditing(entry);
    setEditTime(toLocalInput(entry.occurredAtClient));
    setEditComment(entry.comment ?? '');
  };

  const saveEdit = async (): Promise<void> => {
    if (!editing) return;
    if (!editComment.trim()) {
      toast({ description: t.commentRequired });
      return;
    }
    setEditBusy(true);
    try {
      await timeEntriesApi.updateEntry(editing.id, {
        occurredAtClient: fromLocalInput(editTime),
        comment: editComment.trim(),
      });
      toast({ description: t.toastSaved });
      setEditing(null);
      load();
      onChanged?.();
    } catch (err) {
      toast({
        description: err instanceof ApiError ? err.message : t.toastError,
      });
    } finally {
      setEditBusy(false);
    }
  };

  const openManual = (): void => {
    setManualType('CLOCK_IN');
    setManualTime(`${date}T12:00`);
    setManualComment('');
    setManualProjectId(projectOptions[0]?.id ?? '');
    setManualOpen(true);
  };

  const saveManual = async (): Promise<void> => {
    if (!workerId) return;
    if (!manualComment.trim()) {
      toast({ description: t.commentRequired });
      return;
    }
    if (!manualProjectId) return;
    setManualBusy(true);
    try {
      await timeEntriesApi.createManual({
        workerId,
        projectId: manualProjectId,
        entryType: manualType,
        occurredAtClient: fromLocalInput(manualTime),
        comment: manualComment.trim(),
      });
      toast({ description: t.toastCreated });
      setManualOpen(false);
      load();
      onChanged?.();
    } catch (err) {
      toast({
        description: err instanceof ApiError ? err.message : t.toastError,
      });
    } finally {
      setManualBusy(false);
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    if (!deleteComment.trim()) {
      toast({ description: t.commentRequired });
      return;
    }
    setDeleteBusy(true);
    try {
      await timeEntriesApi.deleteEntry(deleteTarget.id, deleteComment.trim());
      toast({ description: t.toastDeleted });
      setDeleteTarget(null);
      setDeleteComment('');
      load();
      onChanged?.();
    } catch (err) {
      toast({
        description: err instanceof ApiError ? err.message : t.toastError,
      });
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
          <SheetHeader className="mb-4 text-left">
            <SheetTitle>{t.title}</SheetTitle>
            <SheetDescription>
              {workerName}
              {date ? ` · ${new Date(`${date}T12:00:00`).toLocaleDateString('de-DE')}` : ''}
            </SheetDescription>
          </SheetHeader>

          {dayOptions && dayOptions.length > 0 && onDateChange && (
            <div className="mb-4 space-y-1.5">
              <Label>{t.selectDay}</Label>
              <Select value={date} onValueChange={onDateChange}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dayOptions.map((d) => (
                    <SelectItem key={d} value={d}>
                      {new Date(`${d}T12:00:00`).toLocaleDateString('de-DE', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {locked && (
            <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t.locked}
            </p>
          )}

          {!locked && (
            <div className="mb-4">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={openManual}
                disabled={!projectOptions.length}
              >
                <Plus className="h-4 w-4" />
                {t.addManual}
              </Button>
            </div>
          )}

          {loading || data === null ? (
            <p className="text-sm text-muted-foreground">
              {texts.common.loading}
            </p>
          ) : data.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.empty}</p>
          ) : (
            <ul className="space-y-2">
              {data.entries.map((e) => (
                <li
                  key={e.id}
                  className="rounded-lg border bg-card p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'rounded px-2 py-0.5 text-xs font-medium',
                            e.entryType === 'CLOCK_IN' &&
                              'bg-emerald-100 text-emerald-800',
                            e.entryType === 'CLOCK_OUT' &&
                              'bg-red-100 text-red-800',
                            (e.entryType === 'BREAK_START' ||
                              e.entryType === 'BREAK_END') &&
                              'bg-amber-100 text-amber-900',
                            e.entryType === 'MANUAL_ADJUSTMENT' &&
                              'bg-slate-100 text-slate-800',
                          )}
                        >
                          {entryTypeLabel(e.entryType)}
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatTime(e.occurredAtClient)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-muted-foreground">
                        {e.project.projectNumber} · {e.project.title}
                      </p>
                      {e.comment && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {e.comment}
                        </p>
                      )}
                    </div>
                    {!locked && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => startEdit(e)}
                          aria-label={t.edit}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive"
                          onClick={() => {
                            setDeleteTarget(e);
                            setDeleteComment('');
                          }}
                          aria-label={t.delete}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {data && data.segments.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium">{t.segments}</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {data.segments.map((s) => (
                  <li key={s.id}>
                    {s.activityType.name} · {formatTime(s.startedAt)}
                    {s.endedAt ? ` – ${formatTime(s.endedAt)}` : ' …'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.edit}</DialogTitle>
            <DialogDescription>
              {editing ? entryTypeLabel(editing.entryType) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t.time}</Label>
              <Input
                type="datetime-local"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.comment}</Label>
              <Textarea
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(null)}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              disabled={editBusy}
              onClick={() => void saveEdit()}
            >
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.manualTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t.manualType}</Label>
              <Select
                value={manualType}
                onValueChange={(v) =>
                  setManualType(v as (typeof MANUAL_TYPES)[number])
                }
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {entryTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t.manualProject}</Label>
              <Select
                value={manualProjectId}
                onValueChange={setManualProjectId}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projectOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t.manualTime}</Label>
              <Input
                type="datetime-local"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.manualComment}</Label>
              <Textarea
                value={manualComment}
                onChange={(e) => setManualComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setManualOpen(false)}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              disabled={manualBusy}
              onClick={() => void saveManual()}
            >
              {t.manualSave}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) {
            setDeleteTarget(null);
            setDeleteComment('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteConfirmHint}</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={deleteComment}
            onChange={(e) => setDeleteComment(e.target.value)}
            rows={3}
            placeholder={t.comment}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteBusy}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {t.deleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
