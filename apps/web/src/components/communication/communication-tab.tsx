'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ClipboardList,
  Mail,
  MessageSquare,
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
import { DictationButton } from '@/components/ui/dictation-button';
import { useToast } from '@/components/ui/use-toast';
import {
  communicationApi,
  type CommunicationEntry,
  type CommunicationListResponse,
} from '@/lib/communication';
import { texts } from '@/lib/texts';

const COMMUNICATION_TYPES = [
  'PHONE_CALL',
  'EMAIL',
  'MEETING',
  'NOTE',
  'INSTRUCTION',
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
};

const TYPE_COLORS: Record<CommunicationTypeKey, string> = {
  PHONE_CALL: 'bg-blue-100 text-blue-800',
  EMAIL: 'bg-green-100 text-green-800',
  MEETING: 'bg-purple-100 text-purple-800',
  NOTE: 'bg-yellow-100 text-yellow-800',
  INSTRUCTION: 'bg-orange-100 text-orange-800',
};

interface ContactInfo {
  id: string;
  firstName: string;
  lastName: string;
}

interface CommunicationTabProps {
  entityType: 'CUSTOMER' | 'SUBCONTRACTOR' | 'WORKER';
  entityId: string;
  contacts?: ContactInfo[];
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

const emptyForm: FormData = {
  type: 'NOTE',
  direction: 'OUTGOING',
  contactId: '',
  subject: '',
  content: '',
  occurredAt: nowLocalISO(),
  duration: '',
};

export function CommunicationTab({
  entityType,
  entityId,
  contacts,
}: CommunicationTabProps): React.ReactNode {
  const t = texts.communication;
  const { toast } = useToast();

  const [entries, setEntries] = useState<CommunicationEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterContact, setFilterContact] = useState<string>('ALL');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CommunicationEntry | null>(
    null,
  );
  const [form, setForm] = useState<FormData>(emptyForm);
  const [interimText, setInterimText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const limit = 20;
  const totalPages = Math.ceil(total / limit) || 1;

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

  const openCreate = (): void => {
    setEditingEntry(null);
    setForm({ ...emptyForm, occurredAt: nowLocalISO() });
    setInterimText('');
    setDialogOpen(true);
  };

  const openEdit = (entry: CommunicationEntry): void => {
    setEditingEntry(entry);
    const dt = new Date(entry.occurredAt);
    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
    setForm({
      type: entry.type,
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
        type: form.type as CommunicationEntry['type'],
        direction: form.direction as CommunicationEntry['direction'],
        content: form.content,
        occurredAt: new Date(form.occurredAt).toISOString(),
        ...(form.contactId ? { contactId: form.contactId } : {}),
        ...(form.subject ? { subject: form.subject } : {}),
        ...(form.duration ? { duration: parseInt(form.duration, 10) } : {}),
      };
      if (editingEntry) {
        await communicationApi.update(editingEntry.id, payload);
        toast({ description: t.toast.updated });
      } else {
        await communicationApi.create(payload);
        toast({ description: t.toast.created });
      }
      setDialogOpen(false);
      load();
    } catch {
      toast({ variant: 'destructive', description: 'Fehler beim Speichern' });
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
      toast({ variant: 'destructive', description: 'Fehler beim Löschen' });
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
    if (!contactId || !contacts) return null;
    const c = contacts.find((x) => x.id === contactId);
    return c ? `${c.firstName} ${c.lastName}` : null;
  };

  const showDirection = form.type === 'PHONE_CALL' || form.type === 'EMAIL';
  const showDuration = form.type === 'PHONE_CALL';

  return (
    <div className="space-y-4">
      {/* Header: Filter + New Button */}
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

          {contacts && contacts.length > 0 && (
            <Select value={filterContact} onValueChange={setFilterContact}>
              <SelectTrigger className="h-10 w-56">
                <SelectValue placeholder={t.filter.byContact} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t.filter.all}</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Button className="min-h-[44px]" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          {t.newEntry}
        </Button>
      </div>

      {/* List */}
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
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => openEdit(entry)}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div className="mt-0.5 shrink-0">
                  {TYPE_ICONS[entry.type]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={TYPE_COLORS[entry.type]}
                    >
                      {t.type[entry.type]}
                    </Badge>
                    {(entry.type === 'PHONE_CALL' ||
                      entry.type === 'EMAIL') && (
                      <Badge variant="outline">
                        {t.direction[entry.direction]}
                      </Badge>
                    )}
                    {getContactName(entry.contactId) && (
                      <span className="text-xs text-muted-foreground">
                        {getContactName(entry.contactId)}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(entry.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? t.editEntry : t.newEntry}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Type */}
            <div className="space-y-1.5">
              <Label>{t.fields.type}</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, type: v as CommunicationTypeKey }))
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
            </div>

            {/* Direction (only for PHONE_CALL / EMAIL) */}
            {showDirection && (
              <div className="space-y-1.5">
                <Label>{t.fields.direction}</Label>
                <Select
                  value={form.direction}
                  onValueChange={(v) =>
                    setForm((prev) => ({ ...prev, direction: v as DirectionKey }))
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

            {/* Contact (only if contacts provided) */}
            {contacts && contacts.length > 0 && (
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
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Subject */}
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

            {/* Content + Dictation */}
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

            {/* Date/Time */}
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

            {/* Duration (only for PHONE_CALL) */}
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

      {/* Delete Confirm */}
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
    </div>
  );
}
