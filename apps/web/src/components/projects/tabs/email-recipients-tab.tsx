'use client';

import { useState, type ReactNode } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { Field } from '@/components/customers/customer-form';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { MailLink } from '@/components/customers/contact-links';
import { EmptyState } from '@/components/customers/empty-state';
import { useToast } from '@/components/ui/use-toast';
import {
  projectsApi,
  type ProjectEmailRecipient,
} from '@/lib/projects';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

const RECIPIENT_TYPES = ['ACCOUNTING', 'PROJECT_LEAD', 'CC'] as const;
const RECIPIENT_LABELS: Record<string, string> = {
  ACCOUNTING: 'Buchhaltung',
  PROJECT_LEAD: 'Projektleitung',
  CC: 'CC',
};
const typeLabel = (type: string): string => RECIPIENT_LABELS[type] ?? type;

type FormState = { email: string; name: string; recipientType: string };
const EMPTY: FormState = { email: '', name: '', recipientType: 'CC' };

export function EmailRecipientsTab({
  projectId,
  recipients,
  onChange,
}: {
  projectId: string;
  recipients: ProjectEmailRecipient[];
  onChange: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.projects;
  const f = t.fields;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectEmailRecipient | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const set = (k: keyof FormState, v: string): void =>
    setForm((p) => ({ ...p, [k]: v }));

  const openCreate = (): void => {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (r: ProjectEmailRecipient): void => {
    setEditing(r);
    setForm({
      email: r.email,
      name: r.name ?? '',
      recipientType: r.recipientType,
    });
    setDialogOpen(true);
  };

  const save = (): void => {
    const payload = {
      email: form.email,
      name: form.name || undefined,
      recipientType: form.recipientType,
    };
    setSaving(true);
    const req = editing
      ? projectsApi.updateEmailRecipient(projectId, editing.id, payload)
      : projectsApi.createEmailRecipient(projectId, payload);
    req
      .then(() => {
        toast({ description: editing ? t.toast.updated : t.toast.recipientAdded });
        setDialogOpen(false);
        onChange();
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      )
      .finally(() => setSaving(false));
  };

  const confirmDelete = (): void => {
    if (!deleteId) return;
    projectsApi
      .removeEmailRecipient(projectId, deleteId)
      .then(() => {
        toast({ description: t.toast.itemDeleted });
        onChange();
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }))
      .finally(() => setDeleteId(null));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="min-h-[44px]">
          <Plus className="h-4 w-4" />
          {t.actions.addRecipient}
        </Button>
      </div>

      {recipients.length === 0 ? (
        <EmptyState message={t.empties.recipients} actionLabel={t.empties.addNow} onAction={openCreate} />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {recipients.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {r.name && <span className="font-medium">{r.name}</span>}
                    <Badge variant="secondary">{typeLabel(r.recipientType)}</Badge>
                  </div>
                  <MailLink email={r.email} />
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11"
                    onClick={() => openEdit(r)}
                    aria-label={t.actions.edit}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 text-destructive"
                    onClick={() => setDeleteId(r.id)}
                    aria-label={t.actions.delete}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t.actions.edit : t.actions.addRecipient}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label={f.recipientEmail} required>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <Field label={f.recipientName}>
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <Field label={f.recipientType}>
              <Select
                value={form.recipientType}
                onValueChange={(v) => set('recipientType', v)}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECIPIENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {typeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="min-h-[44px]"
            >
              {t.actions.cancel}
            </Button>
            <Button onClick={save} disabled={saving || !form.email} className="min-h-[44px]">
              {saving ? t.actions.saving : t.actions.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title={t.actions.delete}
        description={t.deleteConfirm}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
