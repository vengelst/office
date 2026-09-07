/**
 * Komponente: communication / communication-tab (Office-Web).
 * Domänen-UI – ausführliche Handler-JSDocs nur bei nicht-trivialer Logik.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarPlus,
  CheckSquare,
  ClipboardList,
  Mail,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Plus,
  StickyNote,
  Trash2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DictationButton } from '@/components/ui/dictation-button';
import { useToast } from '@/components/ui/use-toast';
import {
  communicationApi,
  communicationPrefillTitle,
  type CommunicationEntry,
  type CommunicationListResponse,
  type CommunicationType,
} from '@/lib/communication';
import { calendarEventsApi } from '@/lib/calendar-events';
import { todosApi } from '@/lib/todos';
import { texts } from '@/lib/texts';

const COMMUNICATION_TYPES = [
  'PHONE_CALL',
  'EMAIL',
  'MEETING',
  'NOTE',
  'INSTRUCTION',
  'WHATSAPP',
] as const;

type CommunicationTypeKey = (typeof COMMUNICATION_TYPES)[number];

const DIRECTIONS = ['INCOMING', 'OUTGOING'] as const;
type DirectionKey = (typeof DIRECTIONS)[number];

const TYPE_ICONS: Record<CommunicationTypeKey, React.ReactNode> = {
  PHONE_CALL: <Phone className="h-4 w-4" />,
  EMAIL: <Mail className="h-4 w-4" />,
  MEETING: <Users className="h-4 w-4" />,
  NOTE: <StickyNote className="h-4 w-4" />,
  INSTRUCTION: <ClipboardList className="h-4 w-4" />,
  WHATSAPP: <MessageCircle className="h-4 w-4" />,
};

const TYPE_COLORS: Record<CommunicationTypeKey, string> = {
  PHONE_CALL: 'bg-blue-100 text-blue-800',
  EMAIL: 'bg-green-100 text-green-800',
  MEETING: 'bg-purple-100 text-purple-800',
  NOTE: 'bg-yellow-100 text-yellow-800',
  INSTRUCTION: 'bg-orange-100 text-orange-800',
  WHATSAPP: 'bg-emerald-100 text-emerald-800',
};

interface ContactInfo {
  id: string;
  firstName: string;
  lastName: string;
}

interface CommunicationTabProps {
  entityType: 'CUSTOMER' | 'SUBCONTRACTOR' | 'WORKER';
  entityId: string;
  entityName?: string;
  contacts?: ContactInfo[];
  /** Vorauswahl Kontakt (z. B. von Kontaktzeile „Telefonate“) */
  initialContactId?: string;
  /** Vorauswahl Typ-Filter */
  initialType?: string;
}

interface FormData {
  type: CommunicationTypeKey;
  direction: DirectionKey;
  contactId: string;
  subject: string;
  content: string;
  occurredAt: string;
  duration: string;
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

const emptyForm: FormData = {
  type: 'NOTE',
  direction: 'OUTGOING',
  contactId: '',
  subject: '',
  content: '',
  occurredAt: nowLocalISO(),
  duration: '',
};

/**
 * UI-Komponente `CommunicationTab`.
 */
export function CommunicationTab({
  entityType,
  entityId,
  entityName,
  contacts,
  initialContactId,
  initialType,
}: CommunicationTabProps): React.ReactNode {
  const t = texts.communication;
  const { toast } = useToast();
  const router = useRouter();

  const [entries, setEntries] = useState<CommunicationEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>(
    initialType || 'ALL',
  );
  const [filterContact, setFilterContact] = useState<string>(
    initialContactId || 'ALL',
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CommunicationEntry | null>(
    null,
  );
  const [form, setForm] = useState<FormData>(emptyForm);
  const [interimText, setInterimText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  const limit = 20;
  const totalPages = Math.ceil(total / limit) || 1;

  useEffect(() => {
    if (initialContactId) setFilterContact(initialContactId);
    if (initialType) setFilterType(initialType);
  }, [initialContactId, initialType]);

  const load = useCallback(() => {
    setLoading(true);
    communicationApi
      .list({
        entityType,
        entityId,
        type: filterType !== 'ALL' ? filterType : undefined,
        contactId: filterContact !== 'ALL' ? filterContact : undefined,
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
  }, [entityType, entityId, filterType, filterContact, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filterType, filterContact]);

  const openCreate = (preset?: Partial<FormData>): void => {
    setEditingEntry(null);
    setForm({
      ...emptyForm,
      occurredAt: nowLocalISO(),
      contactId:
        filterContact !== 'ALL' ? filterContact : emptyForm.contactId,
      ...preset,
    });
    setInterimText('');
    setDialogOpen(true);
  };

  const openQuickCall = (): void => {
    openCreate({
      type: 'PHONE_CALL',
      direction: 'OUTGOING',
      contactId:
        filterContact !== 'ALL'
          ? filterContact
          : contacts?.length === 1
            ? contacts[0].id
            : '',
    });
  };

  const openEdit = (entry: CommunicationEntry): void => {
    setEditingEntry(entry);
    const dt = new Date(entry.occurredAt);
    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
    setForm({
      type: entry.type as CommunicationTypeKey,
      direction: entry.direction,
      contactId: entry.contactId ?? '',
      subject: entry.subject ?? '',
      content: entry.content,
      occurredAt: dt.toISOString().slice(0, 16),
      duration: entry.duration != null ? String(entry.duration) : '',
    });
    setInterimText('');
    setDialogOpen(true);
  };

  const handleSubmit = async (): Promise<void> => {
    if (!form.content.trim()) return;
    setSubmitting(true);
    try {
      const payload: Parameters<typeof communicationApi.create>[0] = {
        entityType,
        entityId,
        type: form.type as CommunicationType,
        direction: form.direction,
        content: form.content,
        occurredAt: new Date(form.occurredAt).toISOString(),
        ...(form.contactId ? { contactId: form.contactId } : {}),
        ...(form.subject ? { subject: form.subject } : {}),
        ...(form.duration ? { duration: parseInt(form.duration, 10) } : {}),
      };
      if (editingEntry) {
        await communicationApi.update(editingEntry.id, {
          ...payload,
          contactId: form.contactId || null,
        });
        toast({ description: t.toast.updated });
      } else {
        await communicationApi.create(payload);
        toast({ description: t.toast.created });
      }
      setDialogOpen(false);
      load();
    } catch {
      toast({ variant: 'destructive', description: t.toast.error });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteId) return;
    try {
      await communicationApi.remove(deleteId);
      toast({ description: t.toast.deleted });
      setDeleteId(null);
      load();
    } catch {
      toast({ variant: 'destructive', description: t.toast.error });
    }
  };

  const handleTranscript = (text: string): void => {
    setForm((prev) => ({
      ...prev,
      content: prev.content ? `${prev.content} ${text}` : text,
    }));
    setInterimText('');
  };

  const handleInterim = (text: string): void => {
    setInterimText(text);
  };

  const formatDate = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getContactName = (contactId: string | null): string | null => {
    if (!contactId) return null;
    if (contacts) {
      const c = contacts.find((x) => x.id === contactId);
      if (c) return `${c.firstName} ${c.lastName}`;
    }
    return null;
  };

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
        linkedEntityType: entityType,
        linkedEntityId: entityId,
        linkedEntityName:
          entityName || todoEntry.entityName || undefined,
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
        customerId: entityType === 'CUSTOMER' ? entityId : undefined,
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

  const showDirection =
    form.type === 'PHONE_CALL' ||
    form.type === 'EMAIL' ||
    form.type === 'WHATSAPP';
  const showDuration = form.type === 'PHONE_CALL';
  const showContact =
    Boolean(contacts && contacts.length > 0) && entityType !== 'WORKER';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-10 w-48">
              <SelectValue placeholder={t.filter.byType} />
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

          {showContact && (
            <Select value={filterContact} onValueChange={setFilterContact}>
              <SelectTrigger className="h-10 w-56">
                <SelectValue placeholder={t.filter.byContact} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t.filter.all}</SelectItem>
                {contacts!.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {entityType !== 'WORKER' && (
            <Button
              variant="outline"
              className="min-h-[44px]"
              onClick={openQuickCall}
            >
              <Phone className="mr-1 h-4 w-4" />
              {t.quickCall}
            </Button>
          )}
          <Button className="min-h-[44px]" onClick={() => openCreate()}>
            <Plus className="mr-1 h-4 w-4" />
            {t.newEntry}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">{t.empty}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <Card
              key={entry.id}
              className="transition-colors hover:bg-muted/50"
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div
                  className="mt-0.5 shrink-0 cursor-pointer"
                  onClick={() => openEdit(entry)}
                >
                  {TYPE_ICONS[entry.type as CommunicationTypeKey]}
                </div>
                <div
                  className="min-w-0 flex-1 cursor-pointer"
                  onClick={() => openEdit(entry)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={TYPE_COLORS[entry.type as CommunicationTypeKey]}
                    >
                      {t.type[entry.type as CommunicationTypeKey]}
                    </Badge>
                    {(entry.type === 'PHONE_CALL' ||
                      entry.type === 'EMAIL' ||
                      entry.type === 'WHATSAPP') && (
                      <Badge variant="outline">
                        {t.direction[entry.direction]}
                      </Badge>
                    )}
                    {(entry.contactName || getContactName(entry.contactId)) && (
                      <span className="text-xs text-muted-foreground">
                        {entry.contactName || getContactName(entry.contactId)}
                      </span>
                    )}
                  </div>
                  {entry.subject && (
                    <p className="mt-1 text-sm font-medium">{entry.subject}</p>
                  )}
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {entry.content}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-muted-foreground">
                    {formatDate(entry.occurredAt)}
                  </p>
                  {entry.type === 'PHONE_CALL' && entry.duration != null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entry.duration} min
                    </p>
                  )}
                  <div className="mt-1 flex justify-end gap-1">
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
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(entry.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
            {page} / {totalPages}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? t.editEntry : t.newEntry}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t.fields.type}</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    type: v as CommunicationTypeKey,
                  }))
                }
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMUNICATION_TYPES.map((ct) => (
                    <SelectItem key={ct} value={ct}>
                      {t.type[ct]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.type === 'WHATSAPP' && (
                <p className="text-xs text-muted-foreground">{t.whatsappHint}</p>
              )}
            </div>

            {showDirection && (
              <div className="space-y-1.5">
                <Label>{t.fields.direction}</Label>
                <Select
                  value={form.direction}
                  onValueChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      direction: v as DirectionKey,
                    }))
                  }
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIRECTIONS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {t.direction[d]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showContact && (
              <div className="space-y-1.5">
                <Label>{t.fields.contact}</Label>
                <Select
                  value={form.contactId || 'NONE'}
                  onValueChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      contactId: v === 'NONE' ? '' : v,
                    }))
                  }
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">–</SelectItem>
                    {contacts!.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{t.fields.subject}</Label>
              <Input
                className="min-h-[44px]"
                value={form.subject}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, subject: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>{t.fields.content}</Label>
                <DictationButton
                  onTranscript={handleTranscript}
                  onInterim={handleInterim}
                />
              </div>
              <Textarea
                className="min-h-[120px]"
                value={form.content}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, content: e.target.value }))
                }
              />
              {interimText && (
                <p className="text-sm italic text-muted-foreground">
                  {interimText}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t.fields.occurredAt}</Label>
              <Input
                type="datetime-local"
                className="min-h-[44px]"
                value={form.occurredAt}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, occurredAt: e.target.value }))
                }
              />
            </div>

            {showDuration && (
              <div className="space-y-1.5">
                <Label>{t.fields.duration}</Label>
                <Input
                  type="number"
                  min={0}
                  className="min-h-[44px]"
                  value={form.duration}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, duration: e.target.value }))
                  }
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="min-h-[44px]"
              onClick={() => setDialogOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              className="min-h-[44px]"
              disabled={!form.content.trim() || submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Wird gespeichert…' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Löschen</AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
