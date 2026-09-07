/**
 * Seite: Globale Kommunikationsübersicht (`/communication`).
 */

'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CalendarPlus,
  CheckSquare,
  ClipboardList,
  ExternalLink,
  Mail,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Phone,
  StickyNote,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  communicationApi,
  communicationEntityHref,
  communicationPrefillTitle,
  type CommunicationAuthor,
  type CommunicationEntry,
  type CommunicationListResponse,
} from '@/lib/communication';
import { calendarEventsApi } from '@/lib/calendar-events';
import { todosApi } from '@/lib/todos';
import { texts } from '@/lib/texts';

const t = texts.communication;

const COMMUNICATION_TYPES = [
  'PHONE_CALL',
  'EMAIL',
  'MEETING',
  'NOTE',
  'INSTRUCTION',
  'WHATSAPP',
] as const;

const ENTITY_TYPES = ['CUSTOMER', 'SUBCONTRACTOR', 'WORKER'] as const;

const TYPE_ICONS: Record<(typeof COMMUNICATION_TYPES)[number], React.ReactNode> = {
  PHONE_CALL: <Phone className="h-4 w-4" />,
  EMAIL: <Mail className="h-4 w-4" />,
  MEETING: <Users className="h-4 w-4" />,
  NOTE: <StickyNote className="h-4 w-4" />,
  INSTRUCTION: <ClipboardList className="h-4 w-4" />,
  WHATSAPP: <MessageCircle className="h-4 w-4" />,
};

const TYPE_COLORS: Record<(typeof COMMUNICATION_TYPES)[number], string> = {
  PHONE_CALL: 'bg-blue-100 text-blue-800',
  EMAIL: 'bg-green-100 text-green-800',
  MEETING: 'bg-purple-100 text-purple-800',
  NOTE: 'bg-yellow-100 text-yellow-800',
  INSTRUCTION: 'bg-orange-100 text-orange-800',
  WHATSAPP: 'bg-emerald-100 text-emerald-800',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function nowLocalISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function plusOneHourLocalISO(fromLocal: string): string {
  const d = new Date(fromLocal);
  d.setHours(d.getHours() + 1);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function CommunicationOverviewPage(): React.ReactNode {
  return (
    <Suspense
      fallback={
        <div className="space-y-3 p-2">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
        </div>
      }
    >
      <CommunicationOverviewInner />
    </Suspense>
  );
}

function CommunicationOverviewInner(): React.ReactNode {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [entries, setEntries] = useState<CommunicationEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [authors, setAuthors] = useState<CommunicationAuthor[]>([]);

  const [filterType, setFilterType] = useState(
    searchParams.get('type') || 'ALL',
  );
  const [filterEntityType, setFilterEntityType] = useState(
    searchParams.get('entityType') || 'ALL',
  );
  const [filterEntityId, setFilterEntityId] = useState(
    searchParams.get('entityId') || '',
  );
  const [filterContactId, setFilterContactId] = useState(
    searchParams.get('contactId') || '',
  );
  const [filterAuthor, setFilterAuthor] = useState(
    searchParams.get('createdBy') || 'ALL',
  );
  const [filterFrom, setFilterFrom] = useState(searchParams.get('from') || '');
  const [filterTo, setFilterTo] = useState(searchParams.get('to') || '');

  const [todoEntry, setTodoEntry] = useState<CommunicationEntry | null>(null);
  const [todoTitle, setTodoTitle] = useState('');
  const [todoDescription, setTodoDescription] = useState('');
  const [todoSaving, setTodoSaving] = useState(false);

  const [eventEntry, setEventEntry] = useState<CommunicationEntry | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventStartsAt, setEventStartsAt] = useState(nowLocalISO());
  const [eventEndsAt, setEventEndsAt] = useState(
    plusOneHourLocalISO(nowLocalISO()),
  );
  const [eventSaving, setEventSaving] = useState(false);

  const limit = 25;
  const totalPages = Math.ceil(total / limit) || 1;

  useEffect(() => {
    communicationApi.listAuthors().then(setAuthors).catch(() => setAuthors([]));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    communicationApi
      .list({
        type: filterType !== 'ALL' ? filterType : undefined,
        entityType: filterEntityType !== 'ALL' ? filterEntityType : undefined,
        entityId: filterEntityId || undefined,
        contactId: filterContactId || undefined,
        createdBy: filterAuthor !== 'ALL' ? filterAuthor : undefined,
        from: filterFrom ? new Date(filterFrom).toISOString() : undefined,
        to: filterTo ? new Date(filterTo).toISOString() : undefined,
        page,
        limit,
      })
      .then((res: CommunicationListResponse) => {
        setEntries(res.data);
        setTotal(res.total);
      })
      .catch(() => {
        setEntries([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [
    filterType,
    filterEntityType,
    filterEntityId,
    filterContactId,
    filterAuthor,
    filterFrom,
    filterTo,
    page,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [
    filterType,
    filterEntityType,
    filterEntityId,
    filterContactId,
    filterAuthor,
    filterFrom,
    filterTo,
  ]);

  const openTodo = (entry: CommunicationEntry): void => {
    setTodoEntry(entry);
    setTodoTitle(communicationPrefillTitle(entry));
    setTodoDescription(entry.content);
  };

  const openEvent = (entry: CommunicationEntry): void => {
    const start = nowLocalISO();
    setEventEntry(entry);
    setEventTitle(communicationPrefillTitle(entry));
    setEventDescription(entry.content);
    setEventStartsAt(start);
    setEventEndsAt(plusOneHourLocalISO(start));
  };

  const saveTodo = async (): Promise<void> => {
    if (!todoEntry || !todoTitle.trim()) return;
    setTodoSaving(true);
    try {
      await todosApi.create({
        title: todoTitle.trim(),
        description: todoDescription.trim() || undefined,
        linkedEntityType: todoEntry.entityType,
        linkedEntityId: todoEntry.entityId,
        linkedEntityName: todoEntry.entityName ?? undefined,
        communicationEntryId: todoEntry.id,
      });
      toast({ description: t.toast.todoCreated });
      setTodoEntry(null);
      router.push('/todos');
    } catch {
      toast({ variant: 'destructive', description: t.toast.error });
    } finally {
      setTodoSaving(false);
    }
  };

  const saveEvent = async (): Promise<void> => {
    if (!eventEntry || !eventTitle.trim()) return;
    setEventSaving(true);
    try {
      await calendarEventsApi.create({
        title: eventTitle.trim(),
        description: eventDescription.trim() || undefined,
        startsAt: new Date(eventStartsAt).toISOString(),
        endsAt: new Date(eventEndsAt).toISOString(),
        customerId:
          eventEntry.entityType === 'CUSTOMER' ? eventEntry.entityId : undefined,
        communicationEntryId: eventEntry.id,
        syncToGoogle: true,
      });
      toast({ description: t.toast.eventCreated });
      setEventEntry(null);
      router.push('/calendar');
    } catch {
      toast({ variant: 'destructive', description: t.toast.error });
    } finally {
      setEventSaving(false);
    }
  };

  const hasActiveFilters = useMemo(
    () =>
      filterType !== 'ALL' ||
      filterEntityType !== 'ALL' ||
      Boolean(filterEntityId) ||
      Boolean(filterContactId) ||
      filterAuthor !== 'ALL' ||
      Boolean(filterFrom) ||
      Boolean(filterTo),
    [
      filterType,
      filterEntityType,
      filterEntityId,
      filterContactId,
      filterAuthor,
      filterFrom,
      filterTo,
    ],
  );

  return (
    <div className="space-y-4">
      <PageHeader title={t.title} description={t.subtitle} />

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t.fields.type}</Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-10 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t.filter.all}</SelectItem>
              {COMMUNICATION_TYPES.map((ct) => (
                <SelectItem key={ct} value={ct}>
                  {t.type[ct]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            {t.filter.byEntityType}
          </Label>
          <Select value={filterEntityType} onValueChange={setFilterEntityType}>
            <SelectTrigger className="h-10 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t.filter.all}</SelectItem>
              {ENTITY_TYPES.map((et) => (
                <SelectItem key={et} value={et}>
                  {t.entityType[et]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t.fields.entity}</Label>
          <Input
            className="h-10 w-48"
            placeholder="Entity-ID"
            value={filterEntityId}
            onChange={(e) => setFilterEntityId(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t.fields.contact}</Label>
          <Input
            className="h-10 w-48"
            placeholder="Kontakt-ID"
            value={filterContactId}
            onChange={(e) => setFilterContactId(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t.fields.author}</Label>
          <Select value={filterAuthor} onValueChange={setFilterAuthor}>
            <SelectTrigger className="h-10 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t.filter.all}</SelectItem>
              {authors.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t.fields.from}</Label>
          <Input
            type="datetime-local"
            className="h-10 w-48"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t.fields.to}</Label>
          <Input
            type="datetime-local"
            className="h-10 w-48"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
          />
        </div>

        {hasActiveFilters && (
          <Button
            variant="outline"
            className="h-10"
            onClick={() => {
              setFilterType('ALL');
              setFilterEntityType('ALL');
              setFilterEntityId('');
              setFilterContactId('');
              setFilterAuthor('ALL');
              setFilterFrom('');
              setFilterTo('');
            }}
          >
            Filter zurücksetzen
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">
              {hasActiveFilters ? t.emptyFiltered : t.empty}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className="mt-0.5 shrink-0">{TYPE_ICONS[entry.type]}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={TYPE_COLORS[entry.type]}
                    >
                      {t.type[entry.type]}
                    </Badge>
                    {(entry.type === 'PHONE_CALL' ||
                      entry.type === 'EMAIL' ||
                      entry.type === 'WHATSAPP') && (
                      <Badge variant="outline">
                        {t.direction[entry.direction]}
                      </Badge>
                    )}
                    <Badge variant="outline">
                      {t.entityType[entry.entityType]}
                    </Badge>
                    {entry.entityName && (
                      <Link
                        href={communicationEntityHref(entry)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {entry.entityName}
                      </Link>
                    )}
                    {entry.contactName && (
                      <span className="text-xs text-muted-foreground">
                        {entry.contactName}
                      </span>
                    )}
                  </div>
                  {entry.subject && (
                    <p className="mt-1 text-sm font-medium">{entry.subject}</p>
                  )}
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {entry.content}
                  </p>
                  {entry.createdByName && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entry.createdByName}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p className="text-xs text-muted-foreground">
                    {formatDate(entry.occurredAt)}
                  </p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        aria-label={t.actions.more}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openTodo(entry)}>
                        <CheckSquare className="mr-2 h-4 w-4" />
                        {t.actions.createTodo}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEvent(entry)}>
                        <CalendarPlus className="mr-2 h-4 w-4" />
                        {t.actions.createEvent}
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={communicationEntityHref(entry)}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          {t.actions.openEntity}
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ←
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages} ({total})
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </Button>
        </div>
      )}

      <Dialog
        open={todoEntry !== null}
        onOpenChange={(open) => {
          if (!open) setTodoEntry(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.todoDialog.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Titel</Label>
              <Input
                className="min-h-[44px]"
                value={todoTitle}
                onChange={(e) => setTodoTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Beschreibung</Label>
              <Textarea
                className="min-h-[100px]"
                value={todoDescription}
                onChange={(e) => setTodoDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTodoEntry(null)}>
              Abbrechen
            </Button>
            <Button
              disabled={!todoTitle.trim() || todoSaving}
              onClick={saveTodo}
            >
              {todoSaving ? '…' : t.todoDialog.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={eventEntry !== null}
        onOpenChange={(open) => {
          if (!open) setEventEntry(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.eventDialog.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Titel</Label>
              <Input
                className="min-h-[44px]"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Beschreibung</Label>
              <Textarea
                className="min-h-[100px]"
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Beginn</Label>
                <Input
                  type="datetime-local"
                  className="min-h-[44px]"
                  value={eventStartsAt}
                  onChange={(e) => {
                    setEventStartsAt(e.target.value);
                    setEventEndsAt(plusOneHourLocalISO(e.target.value));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ende</Label>
                <Input
                  type="datetime-local"
                  className="min-h-[44px]"
                  value={eventEndsAt}
                  onChange={(e) => setEventEndsAt(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventEntry(null)}>
              Abbrechen
            </Button>
            <Button
              disabled={!eventTitle.trim() || eventSaving}
              onClick={saveEvent}
            >
              {eventSaving ? '…' : t.eventDialog.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
