/**
 * Seite: Kalender / Termine (Office-Web).
 * Neue Route `/calendar` – unabhängig von der Projekt-Timeline `/projects/calendar`.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import {
  calendarEventsApi,
  type CalendarEvent,
  type CalendarEventInput,
} from '@/lib/calendar-events';
import { customersApi } from '@/lib/customers';
import { projectsApi } from '@/lib/projects';
import { texts } from '@/lib/texts';

const t = texts.calendar;
const NONE = '__none__';

type ViewMode = 'month' | 'week' | 'list';

interface OptionItem {
  id: string;
  label: string;
}

interface EventFormState {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  projectId: string;
  customerId: string;
  syncToGoogle: boolean;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const result = new Date(d);
  result.setDate(d.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfWeek(d: Date): Date {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function toLocalInputValue(iso: string, allDay: boolean): string {
  const d = new Date(iso);
  if (allDay) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

function fromLocalInputValue(value: string, allDay: boolean): string {
  if (allDay) {
    return new Date(`${value}T00:00:00`).toISOString();
  }
  return new Date(value).toISOString();
}

function defaultForm(anchor?: Date): EventFormState {
  const base = anchor ? new Date(anchor) : new Date();
  base.setMinutes(0, 0, 0);
  const end = new Date(base);
  end.setHours(base.getHours() + 1);
  return {
    title: '',
    description: '',
    startsAt: toLocalInputValue(base.toISOString(), false),
    endsAt: toLocalInputValue(end.toISOString(), false),
    allDay: false,
    projectId: NONE,
    customerId: NONE,
    syncToGoogle: true,
  };
}

function formFromEvent(event: CalendarEvent): EventFormState {
  return {
    title: event.title,
    description: event.description ?? '',
    startsAt: toLocalInputValue(event.startsAt, event.allDay),
    endsAt: toLocalInputValue(event.endsAt, event.allDay),
    allDay: event.allDay,
    projectId: event.projectId ?? NONE,
    customerId: event.customerId ?? NONE,
    syncToGoogle: event.syncToGoogle,
  };
}

function formatRangeLabel(from: Date, to: Date, mode: ViewMode): string {
  if (mode === 'month') {
    return from.toLocaleDateString('de-DE', {
      month: 'long',
      year: 'numeric',
    });
  }
  const opts: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  };
  return `${from.toLocaleDateString('de-DE', opts)} – ${to.toLocaleDateString('de-DE', opts)}`;
}

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) {
    return new Date(event.startsAt).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
  return `${new Date(event.startsAt).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })} – ${new Date(event.endsAt).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildMonthCells(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const gridStart = startOfWeek(first);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function buildWeekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export default function CalendarPage(): React.ReactNode {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<OptionItem[]>([]);
  const [customers, setCustomers] = useState<OptionItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<EventFormState>(() => defaultForm());

  const range = useMemo(() => {
    if (viewMode === 'week') {
      return { from: startOfWeek(anchor), to: endOfWeek(anchor) };
    }
    if (viewMode === 'list') {
      const from = startOfMonth(anchor);
      const to = endOfMonth(anchor);
      return { from, to };
    }
    // month: include adjacent week days
    const cells = buildMonthCells(anchor);
    return { from: cells[0], to: cells[cells.length - 1] };
  }, [anchor, viewMode]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await calendarEventsApi.list({
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      });
      setEvents(data);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    projectsApi
      .list({ limit: 100, sortBy: 'projectNumber', sortDir: 'desc' })
      .then((res) =>
        setProjects(
          res.data.map((p) => ({
            id: p.id,
            label: `${p.projectNumber} – ${p.title}`,
          })),
        ),
      )
      .catch(() => undefined);
    customersApi
      .list({ limit: 100, sortBy: 'companyName', sortDir: 'asc' })
      .then((res) =>
        setCustomers(
          res.data.map((c) => ({
            id: c.id,
            label: `${c.customerNumber} – ${c.companyName}`,
          })),
        ),
      )
      .catch(() => undefined);
  }, []);

  const shiftAnchor = (dir: -1 | 1): void => {
    const next = new Date(anchor);
    if (viewMode === 'week') {
      next.setDate(next.getDate() + dir * 7);
    } else {
      next.setMonth(next.getMonth() + dir);
    }
    setAnchor(next);
  };

  const openCreate = (day?: Date): void => {
    setEditing(null);
    setForm(defaultForm(day));
    setDialogOpen(true);
  };

  const openEdit = (event: CalendarEvent): void => {
    setEditing(event);
    setForm(formFromEvent(event));
    setDialogOpen(true);
  };

  const handleSave = async (): Promise<void> => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const body: CalendarEventInput = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        startsAt: fromLocalInputValue(form.startsAt, form.allDay),
        endsAt: fromLocalInputValue(
          form.allDay && form.endsAt.length === 10
            ? form.endsAt
            : form.endsAt,
          form.allDay,
        ),
        allDay: form.allDay,
        projectId: form.projectId === NONE ? null : form.projectId,
        customerId: form.customerId === NONE ? null : form.customerId,
        syncToGoogle: form.syncToGoogle,
      };
      if (form.allDay) {
        // Ende ganztägig: Tagesende lokal
        body.endsAt = new Date(`${form.endsAt}T23:59:59`).toISOString();
        body.startsAt = new Date(`${form.startsAt}T00:00:00`).toISOString();
      }
      if (editing) {
        await calendarEventsApi.update(editing.id, body);
        toast({ description: t.toast.updated });
      } else {
        await calendarEventsApi.create(body);
        toast({ description: t.toast.created });
      }
      setDialogOpen(false);
      loadEvents();
    } catch (err) {
      toast({
        variant: 'destructive',
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!editing) return;
    if (!confirm(t.deleteConfirm)) return;
    setSaving(true);
    try {
      await calendarEventsApi.remove(editing.id);
      toast({ description: t.toast.deleted });
      setDialogOpen(false);
      loadEvents();
    } catch (err) {
      toast({
        variant: 'destructive',
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setSaving(false);
    }
  };

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = new Date(event.startsAt).toDateString();
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const monthCells = useMemo(() => buildMonthCells(anchor), [anchor]);
  const weekDays = useMemo(() => buildWeekDays(anchor), [anchor]);
  const today = new Date();

  return (
    <div className="space-y-4">
      <PageHeader title={t.title} description={t.subtitle}>
        <Button className="min-h-[44px]" onClick={() => openCreate()}>
          <Plus className="mr-2 h-4 w-4" />
          {t.newEvent}
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          onClick={() => shiftAnchor(-1)}
          aria-label={t.prev}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          className="min-h-[44px]"
          onClick={() => setAnchor(new Date())}
        >
          {t.today}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          onClick={() => shiftAnchor(1)}
          aria-label={t.next}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <p className="min-w-[12rem] text-sm font-medium capitalize">
          {formatRangeLabel(range.from, range.to, viewMode)}
        </p>
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as ViewMode)}
          className="ml-auto"
        >
          <TabsList>
            <TabsTrigger value="month">{t.month}</TabsTrigger>
            <TabsTrigger value="week">{t.week}</TabsTrigger>
            <TabsTrigger value="list">{t.list}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : viewMode === 'list' ? (
        <Card>
          <CardContent className="divide-y p-0">
            {events.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">{t.empty}</p>
            ) : (
              events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                  onClick={() => openEdit(event)}
                >
                  <div>
                    <p className="font-medium text-sm">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatEventTime(event)}
                      {event.customer?.companyName
                        ? ` · ${event.customer.companyName}`
                        : ''}
                      {event.project?.projectNumber
                        ? ` · ${event.project.projectNumber}`
                        : ''}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {event.googleEventId ? t.synced : t.notSynced}
                  </span>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'week' ? (
        <div className="grid gap-2 md:grid-cols-7">
          {weekDays.map((day) => {
            const dayEvents = eventsByDay.get(day.toDateString()) ?? [];
            return (
              <Card key={day.toISOString()} className="min-h-[10rem]">
                <CardContent className="space-y-2 p-3">
                  <button
                    type="button"
                    className={`text-sm font-medium ${
                      sameDay(day, today) ? 'text-primary' : ''
                    }`}
                    onClick={() => openCreate(day)}
                  >
                    {day.toLocaleDateString('de-DE', {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </button>
                  {dayEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className="block w-full truncate rounded bg-primary/10 px-2 py-1 text-left text-xs hover:bg-primary/20"
                      onClick={() => openEdit(event)}
                    >
                      {event.title}
                    </button>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((label) => (
            <div
              key={label}
              className="px-1 py-2 text-center text-xs font-medium text-muted-foreground"
            >
              {label}
            </div>
          ))}
          {monthCells.map((day) => {
            const inMonth = day.getMonth() === anchor.getMonth();
            const dayEvents = eventsByDay.get(day.toDateString()) ?? [];
            return (
              <button
                key={day.toISOString()}
                type="button"
                className={`min-h-[5.5rem] rounded-md border p-1 text-left align-top ${
                  inMonth ? 'bg-background' : 'bg-muted/30 text-muted-foreground'
                } ${sameDay(day, today) ? 'border-primary' : 'border-border'}`}
                onClick={() => openCreate(day)}
              >
                <span
                  className={`text-xs font-medium ${
                    sameDay(day, today) ? 'text-primary' : ''
                  }`}
                >
                  {day.getDate()}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      role="link"
                      tabIndex={0}
                      className="block truncate rounded bg-primary/10 px-1 text-[10px] leading-4 hover:bg-primary/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(event);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          openEdit(event);
                        }
                      }}
                    >
                      {event.title}
                    </span>
                  ))}
                  {dayEvents.length > 3 ? (
                    <span className="text-[10px] text-muted-foreground">
                      +{dayEvents.length - 3}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? t.editEvent : t.newEvent}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cal-title">{t.fields.title}</Label>
              <Input
                id="cal-title"
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={(e) => {
                  const allDay = e.target.checked;
                  setForm((prev) => ({
                    ...prev,
                    allDay,
                    startsAt: allDay
                      ? prev.startsAt.slice(0, 10)
                      : `${prev.startsAt.slice(0, 10)}T09:00`,
                    endsAt: allDay
                      ? prev.endsAt.slice(0, 10)
                      : `${prev.endsAt.slice(0, 10)}T10:00`,
                  }));
                }}
                className="h-4 w-4"
              />
              {t.fields.allDay}
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cal-start">{t.fields.startsAt}</Label>
                <Input
                  id="cal-start"
                  type={form.allDay ? 'date' : 'datetime-local'}
                  value={form.startsAt}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, startsAt: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cal-end">{t.fields.endsAt}</Label>
                <Input
                  id="cal-end"
                  type={form.allDay ? 'date' : 'datetime-local'}
                  value={form.endsAt}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, endsAt: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cal-desc">{t.fields.description}</Label>
              <Textarea
                id="cal-desc"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.fields.project}</Label>
                <Select
                  value={form.projectId}
                  onValueChange={(v) =>
                    setForm((prev) => ({ ...prev, projectId: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.fields.none} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t.fields.none}</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.fields.customer}</Label>
                <Select
                  value={form.customerId}
                  onValueChange={(v) =>
                    setForm((prev) => ({ ...prev, customerId: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.fields.none} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t.fields.none}</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.syncToGoogle}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    syncToGoogle: e.target.checked,
                  }))
                }
                className="h-4 w-4"
              />
              {t.fields.syncToGoogle}
            </label>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                className="min-h-[44px]"
                disabled={saving || !form.title.trim()}
                onClick={handleSave}
              >
                {saving ? t.saving : t.save}
              </Button>
              <Button
                variant="outline"
                className="min-h-[44px]"
                onClick={() => setDialogOpen(false)}
              >
                {t.cancel}
              </Button>
              {editing ? (
                <Button
                  variant="destructive"
                  className="min-h-[44px] ml-auto"
                  disabled={saving}
                  onClick={handleDelete}
                >
                  {t.delete}
                </Button>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
