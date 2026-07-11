'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Phone,
  Mail,
  Users,
  StickyNote,
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
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
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { DictationButton } from '@/components/ui/dictation-button';
import { useToast } from '@/components/ui/use-toast';
import {
  communicationApi,
  type CommunicationEntry,
  type CommunicationEntityType,
  type CommunicationType,
  type CommunicationDirection,
  type CreateCommunicationData,
} from '@/lib/communication';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

const TYPES: CommunicationType[] = [
  'PHONE_CALL',
  'EMAIL',
  'MEETING',
  'NOTE',
  'INSTRUCTION',
];
const DIRECTIONS: CommunicationDirection[] = ['INCOMING', 'OUTGOING'];

const TYPE_ICONS: Record<CommunicationType, React.ElementType> = {
  PHONE_CALL: Phone,
  EMAIL: Mail,
  MEETING: Users,
  NOTE: StickyNote,
  INSTRUCTION: ClipboardList,
};

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
}

interface CommunicationTabProps {
  entityType: CommunicationEntityType;
  entityId: string;
  contacts?: Contact[];
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CommunicationTab({
  entityType,
  entityId,
  contacts,
}: CommunicationTabProps): React.ReactNode {
  const { toast } = useToast();
  const t = texts.communication;

  const [entries, setEntries] = useState<CommunicationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterContact, setFilterContact] = useState<string>('ALL');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CommunicationEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommunicationEntry | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  const [formType, setFormType] = useState<CommunicationType>('PHONE_CALL');
  const [formDirection, setFormDirection] =
    useState<CommunicationDirection>('OUTGOING');
  const [formContactId, setFormContactId] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formOccurredAt, setFormOccurredAt] = useState('');
  const [formDuration, setFormDuration] = useState('');

  const load = useCallback(() => {
    communicationApi
      .list({ entityType, entityId })
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = (): void => {
    setFormType('PHONE_CALL');
    setFormDirection('OUTGOING');
    setFormContactId('');
    setFormSubject('');
    setFormContent('');
    setFormOccurredAt('');
    setFormDuration('');
  };

  const openCreate = (): void => {
    setEditing(null);
    resetForm();
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setFormOccurredAt(now.toISOString().slice(0, 16));
    setDialogOpen(true);
  };

  const openEdit = (entry: CommunicationEntry): void => {
    setEditing(entry);
    setFormType(entry.type);
    setFormDirection(entry.direction);
    setFormContactId(entry.contactId ?? '');
    setFormSubject(entry.subject ?? '');
    setFormContent(entry.content);
    const d = new Date(entry.occurredAt);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setFormOccurredAt(d.toISOString().slice(0, 16));
    setFormDuration(entry.duration?.toString() ?? '');
    setDialogOpen(true);
  };

  const handleSubmit = async (): Promise<void> => {
    if (!formContent.trim()) return;
    setSubmitting(true);
    try {
      if (editing) {
        await communicationApi.update(editing.id, {
          type: formType,
          direction: formDirection,
          contactId: formContactId || undefined,
          subject: formSubject || undefined,
          content: formContent,
          occurredAt: formOccurredAt
            ? new Date(formOccurredAt).toISOString()
            : undefined,
          duration: formDuration ? parseInt(formDuration, 10) : undefined,
        });
        toast({ description: t.toast.updated });
      } else {
        const data: CreateCommunicationData = {
          entityType,
          entityId,
          type: formType,
          direction: formDirection,
          content: formContent,
        };
        if (formContactId) data.contactId = formContactId;
        if (formSubject) data.subject = formSubject;
        if (formOccurredAt)
          data.occurredAt = new Date(formOccurredAt).toISOString();
        if (formDuration) data.duration = parseInt(formDuration, 10);
        await communicationApi.create(data);
        toast({ description: t.toast.created });
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      toast({
        variant: 'destructive',
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      await communicationApi.remove(deleteTarget.id);
      toast({ description: t.toast.deleted });
      setDeleteTarget(null);
      load();
    } catch {
      toast({ variant: 'destructive', description: t.toast.error });
    }
  };

  const filtered = entries.filter((e) => {
    if (filterType !== 'ALL' && e.type !== filterType) return false;
    if (filterContact !== 'ALL' && e.contactId !== filterContact) return false;
    return true;
  });

  const contactName = (id: string | null): string | null => {
    if (!id || !contacts) return null;
    const c = contacts.find((x) => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : null;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">{texts.common.loading}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-10 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t.filters.allTypes}</SelectItem>
                {TYPES.map((tp) => (
                  <SelectItem key={tp} value={tp}>
                    {t.type[tp]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {contacts && contacts.length > 0 && (
              <Select value={filterContact} onValueChange={setFilterContact}>
                <SelectTrigger className="h-10 w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t.filters.allContacts}</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex-1" />

            <Button onClick={openCreate} className="min-h-[44px]">
              <Plus className="mr-1.5 h-4 w-4" />
              {t.newEntry}
            </Button>
          </div>

          {/* Liste */}
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t.empty}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((entry) => {
                const Icon = TYPE_ICONS[entry.type] ?? StickyNote;
                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{t.type[entry.type]}</Badge>
                        <Badge variant="outline">
                          {t.direction[entry.direction]}
                        </Badge>
                        {contactName(entry.contactId) && (
                          <span className="text-xs text-muted-foreground">
                            {contactName(entry.contactId)}
                          </span>
                        )}
                      </div>
                      {entry.subject && (
                        <p className="text-sm font-medium">{entry.subject}</p>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {entry.content}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatDateTime(entry.occurredAt)}</span>
                        {entry.duration != null && (
                          <span>{entry.duration} min</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(entry)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteTarget(entry)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? t.editEntry : t.newEntry}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t.fields.type}</Label>
                <Select
                  value={formType}
                  onValueChange={(v) => setFormType(v as CommunicationType)}
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((tp) => (
                      <SelectItem key={tp} value={tp}>
                        {t.type[tp]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t.fields.direction}</Label>
                <Select
                  value={formDirection}
                  onValueChange={(v) =>
                    setFormDirection(v as CommunicationDirection)
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
            </div>

            {contacts && contacts.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t.fields.contactId}</Label>
                <Select value={formContactId} onValueChange={setFormContactId}>
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue placeholder="–" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">–</SelectItem>
                    {contacts.map((c) => (
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
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                className="min-h-[44px]"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>{t.fields.content}</Label>
                <DictationButton
                  onTranscript={(text) =>
                    setFormContent((prev) =>
                      prev ? `${prev} ${text}` : text,
                    )
                  }
                />
              </div>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={5}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t.fields.occurredAt}</Label>
                <Input
                  type="datetime-local"
                  value={formOccurredAt}
                  onChange={(e) => setFormOccurredAt(e.target.value)}
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t.fields.duration}</Label>
                <Input
                  type="number"
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                  className="min-h-[44px]"
                  min={0}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="min-h-[44px]"
              >
                {texts.customers.actions.cancel}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !formContent.trim()}
                className="min-h-[44px]"
              >
                {submitting
                  ? texts.customers.actions.saving
                  : texts.customers.actions.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t.deleteTitle}
        description={t.deleteConfirm}
        onConfirm={handleDelete}
      />
    </>
  );
}
