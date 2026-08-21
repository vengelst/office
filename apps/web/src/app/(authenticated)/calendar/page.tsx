/**
 * Seite: Termine (Office-Web) – CRUD für CalendarEvent, Sync-Hinweis.
 * Unabhängig von /projects/calendar (Projekt-Timeline).
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { PageHeader } from '@/components/layout/page-header';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/components/ui/use-toast';
import { texts } from '@/lib/texts';
import {
  calendarEventsApi,
  type CalendarEvent,
  type CreateCalendarEventInput,
} from '@/lib/calendar-events';
import { projectsApi, type ProjectListItem } from '@/lib/projects';

const t = texts.calendar;

function startOfMonthIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfNextMonthIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 2, 0);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
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

function formatRange(event: CalendarEvent): string {
  const opts: Intl.DateTimeFormatOptions = event.allDay
    ? { day: '2-digit', month: '2-digit', year: 'numeric' }
    : {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      };
  const start = new Date(event.startAt).toLocaleString('de-DE', opts);
  const end = new Date(event.endAt).toLocaleString('de-DE', opts);
  return `${start} – ${end}`;
}

type FormState = {
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  projectId: string;
  syncToGoogle: boolean;
};

function emptyForm(): FormState {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return {
    title: '',
    description: '',
    location: '',
    startAt: toLocalInputValue(start.toISOString(), false),
    endAt: toLocalInputValue(end.toISOString(), false),
    allDay: false,
    projectId: '',
    syncToGoogle: true,
  };
}

function eventToForm(event: CalendarEvent): FormState {
  return {
    title: event.title,
    description: event.description ?? '',
    location: event.location ?? '',
    startAt: toLocalInputValue(event.startAt, event.allDay),
    endAt: toLocalInputValue(event.endAt, event.allDay),
    allDay: event.allDay,
    projectId: event.projectId ?? '',
    syncToGoogle: event.syncToGoogle,
  };
}

export default function CalendarPage(): React.ReactNode {
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(startOfMonthIso().slice(0, 10));
  const [to, setTo] = useState(endOfNextMonthIso().slice(0, 10));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await calendarEventsApi.list({
        from: new Date(`${from}T00:00:00`).toISOString(),
        to: new Date(`${to}T23:59:59`).toISOString(),
        limit: 100,
      });
      setEvents(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    projectsApi
      .list({ limit: 100, sortBy: 'projectNumber', sortDir: 'desc' })
      .then((res) => setProjects(res.data))
      .catch(() => undefined);
  }, []);

  const openCreate = (): void => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (event: CalendarEvent): void => {
    setEditing(event);
    setForm(eventToForm(event));
    setDialogOpen(true);
  };

  const handleSave = async (): Promise<void> => {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload: CreateCalendarEventInput = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      location: form.location.trim() || undefined,
      startAt: fromLocalInputValue(form.startAt, form.allDay),
      endAt: fromLocalInputValue(form.endAt, form.allDay),
      allDay: form.allDay,
      projectId: form.projectId || undefined,
      syncToGoogle: form.syncToGoogle,
    };
    try {
      if (editing) {
        await calendarEventsApi.update(editing.id, {
          ...payload,
          projectId: form.projectId || '',
        });
        toast({ title: t.toast.updated });
      } else {
        await calendarEventsApi.create(payload);
        toast({ title: t.toast.created });
      }
      setDialogOpen(false);
      loadEvents();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event: CalendarEvent): Promise<void> => {
    if (!confirm(t.deleteConfirm)) return;
    try {
      await calendarEventsApi.remove(event.id);
      toast({ title: t.toast.deleted });
      loadEvents();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: err instanceof ApiError ? err.message : t.toast.error,
      });
    }
  };

  const projectOptions = useMemo(
    () =>
      projects.map((p) => ({
        id: p.id,
        label: `${p.projectNumber} – ${p.title}`,
      })),
    [projects],
  );

  return (
    <div className="space-y-4">
      <PageHeader title={t.title} description={t.subtitle}>
        <Button className="min-h-[44px]" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t.new}
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1">
            <Label htmlFor="from">{t.filter.from}</Label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="min-h-[44px] w-auto"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to">{t.filter.to}</Label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="min-h-[44px] w-auto"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <CalendarDays className="h-10 w-10" />
          <p>{t.empty}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <Card
              key={event.id}
              className="cursor-pointer transition-colors hover:border-primary/50"
              onClick={() => openEdit(event)}
            >
              <CardContent className="flex items-start justify-between gap-3 py-4">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{event.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatRange(event)}
                  </p>
                  {event.location ? (
                    <p className="text-sm text-muted-foreground">
                      {event.location}
                    </p>
                  ) : null}
                  {event.project ? (
                    <p className="text-xs text-muted-foreground">
                      {event.project.projectNumber} – {event.project.title}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {event.googleEventId ? (
                      <Badge variant="secondary">{t.synced}</Badge>
                    ) : (
                      <Badge variant="outline">{t.notSynced}</Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-[44px] min-w-[44px] shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(event);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t.edit : t.new}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="title">{t.fields.title}</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">{t.fields.description}</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="location">{t.fields.location}</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) =>
                  setForm((f) => ({ ...f, location: e.target.value }))
                }
                className="min-h-[44px]"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={(e) => {
                  const allDay = e.target.checked;
                  setForm((f) => ({
                    ...f,
                    allDay,
                    startAt: allDay
                      ? f.startAt.slice(0, 10)
                      : `${f.startAt.slice(0, 10)}T09:00`,
                    endAt: allDay
                      ? f.endAt.slice(0, 10)
                      : `${f.endAt.slice(0, 10)}T10:00`,
                  }));
                }}
                className="h-4 w-4"
              />
              {t.fields.allDay}
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="startAt">{t.fields.startAt}</Label>
                <Input
                  id="startAt"
                  type={form.allDay ? 'date' : 'datetime-local'}
                  value={form.startAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startAt: e.target.value }))
                  }
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="endAt">{t.fields.endAt}</Label>
                <Input
                  id="endAt"
                  type={form.allDay ? 'date' : 'datetime-local'}
                  value={form.endAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endAt: e.target.value }))
                  }
                  className="min-h-[44px]"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t.fields.project}</Label>
              <Select
                value={form.projectId || '__none__'}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    projectId: v === '__none__' ? '' : v,
                  }))
                }
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder={t.fields.noProject} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t.fields.noProject}</SelectItem>
                  {projectOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.syncToGoogle}
                onChange={(e) =>
                  setForm((f) => ({ ...f, syncToGoogle: e.target.checked }))
                }
                className="h-4 w-4"
              />
              {t.fields.syncToGoogle}
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                className="min-h-[44px]"
                onClick={() => setDialogOpen(false)}
              >
                {t.cancel}
              </Button>
              <Button
                className="min-h-[44px]"
                disabled={saving || !form.title.trim()}
                onClick={handleSave}
              >
                {t.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
