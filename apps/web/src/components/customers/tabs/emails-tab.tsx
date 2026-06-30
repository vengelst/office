'use client';

import { useState, type ReactNode } from 'react';
import { Pencil, Plus, Star, Trash2 } from 'lucide-react';
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
import { customersApi, type CustomerEmail } from '@/lib/customers';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

const EMAIL_TYPES = [
  'GENERAL',
  'BILLING',
  'SERVICE',
  'SUPPORT',
  'PROJECT',
  'OTHER',
] as const;

export function EmailsTab({
  customerId,
  emails,
  onChange,
}: {
  customerId: string;
  emails: CustomerEmail[];
  onChange: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.customers;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerEmail | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState('');
  const [emailType, setEmailType] = useState('GENERAL');
  const [label, setLabel] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  const openCreate = (): void => {
    setEditing(null);
    setEmail('');
    setEmailType('GENERAL');
    setLabel('');
    setIsPrimary(false);
    setDialogOpen(true);
  };

  const openEdit = (e: CustomerEmail): void => {
    setEditing(e);
    setEmail(e.email);
    setEmailType(e.emailType);
    setLabel(e.label ?? '');
    setIsPrimary(e.isPrimary);
    setDialogOpen(true);
  };

  const save = (): void => {
    const payload = { email, emailType, label: label || undefined, isPrimary };
    setSaving(true);
    const req = editing
      ? customersApi.updateEmail(customerId, editing.id, payload)
      : customersApi.createEmail(customerId, payload);
    req
      .then(() => {
        toast({ description: t.toast.updated });
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
    customersApi
      .removeEmail(customerId, deleteId)
      .then(() => {
        toast({ description: t.toast.itemDeleted });
        onChange();
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }))
      .finally(() => setDeleteId(null));
  };

  const typeLabel = (type: string): string =>
    t.emailTypes[type as keyof typeof t.emailTypes] ?? type;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="min-h-[44px]">
          <Plus className="h-4 w-4" />
          {t.actions.addEmail}
        </Button>
      </div>

      {emails.length === 0 ? (
        <EmptyState message={t.empties.emails} actionLabel={t.empties.addNow} onAction={openCreate} />
      ) : (
        <div className="space-y-2">
          {emails.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{typeLabel(e.emailType)}</Badge>
                    {e.isPrimary && (
                      <Badge className="gap-1">
                        <Star className="h-3 w-3" />
                        {t.fields.isPrimary}
                      </Badge>
                    )}
                    {e.label && (
                      <span className="text-xs text-muted-foreground">
                        {e.label}
                      </span>
                    )}
                  </div>
                  <MailLink email={e.email} />
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11"
                    onClick={() => openEdit(e)}
                    aria-label={t.actions.edit}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 text-destructive"
                    onClick={() => setDeleteId(e.id)}
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
              {editing ? t.actions.edit : t.actions.addEmail}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label={t.fields.email} required>
              <Input
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <Field label={t.fields.emailType}>
              <Select value={emailType} onValueChange={setEmailType}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {typeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t.fields.label}>
              <Input
                value={label}
                onChange={(ev) => setLabel(ev.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <label className="flex min-h-[44px] items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(ev) => setIsPrimary(ev.target.checked)}
                className="h-4 w-4"
              />
              {t.fields.isPrimary}
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="min-h-[44px]"
            >
              {t.actions.cancel}
            </Button>
            <Button onClick={save} disabled={saving || !email} className="min-h-[44px]">
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
