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
import { Field } from '@/components/customers/customer-form';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { MailLink, PhoneLink } from '@/components/customers/contact-links';
import { EmptyState } from '@/components/customers/empty-state';
import { useToast } from '@/components/ui/use-toast';
import {
  subcontractorsApi,
  type SubcontractorContact,
} from '@/lib/workers';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

type FormState = {
  title: string;
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  phoneMobile: string;
  phoneLandline: string;
  notes: string;
  isPrimary: boolean;
};

const EMPTY: FormState = {
  title: '',
  firstName: '',
  lastName: '',
  role: '',
  email: '',
  phoneMobile: '',
  phoneLandline: '',
  notes: '',
  isPrimary: false,
};

const contactName = (c: { firstName: string; lastName: string }): string =>
  [c.firstName, c.lastName].filter(Boolean).join(' ');

export function SubcontractorContactsTab({
  subcontractorId,
  contacts,
  onChange,
}: {
  subcontractorId: string;
  contacts: SubcontractorContact[];
  onChange: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.subcontractors;
  const f = t.fields;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SubcontractorContact | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]): void =>
    setForm((p) => ({ ...p, [k]: v }));

  const openCreate = (): void => {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (c: SubcontractorContact): void => {
    setEditing(c);
    setForm({
      title: c.title ?? '',
      firstName: c.firstName,
      lastName: c.lastName,
      role: c.role ?? '',
      email: c.email ?? '',
      phoneMobile: c.phoneMobile ?? '',
      phoneLandline: c.phoneLandline ?? '',
      notes: c.notes ?? '',
      isPrimary: c.isPrimary,
    });
    setDialogOpen(true);
  };

  const save = (): void => {
    if (!form.firstName.trim() || !form.lastName.trim()) return;
    const payload = {
      title: form.title.trim() || undefined,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      role: form.role.trim() || undefined,
      email: form.email.trim() || undefined,
      phoneMobile: form.phoneMobile.trim() || undefined,
      phoneLandline: form.phoneLandline.trim() || undefined,
      notes: form.notes.trim() || undefined,
      isPrimary: form.isPrimary,
    };
    setSaving(true);
    const req = editing
      ? subcontractorsApi.updateContact(subcontractorId, editing.id, payload)
      : subcontractorsApi.createContact(subcontractorId, payload);
    req
      .then(() => {
        toast({
          description: editing
            ? t.toast.contactUpdated
            : t.toast.contactCreated,
        });
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
    subcontractorsApi
      .removeContact(subcontractorId, deleteId)
      .then(() => {
        toast({ description: t.toast.contactDeleted });
        onChange();
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }))
      .finally(() => setDeleteId(null));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {t.sections.contacts}
        </h3>
        <Button onClick={openCreate} className="min-h-[44px]">
          <Plus className="h-4 w-4" />
          {t.actions.addContact}
        </Button>
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          message={t.empties.contacts}
          actionLabel={t.empties.addNow}
          onAction={openCreate}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {contacts.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{contactName(c)}</span>
                    {c.isPrimary && (
                      <Badge variant="secondary">{f.contactIsPrimary}</Badge>
                    )}
                  </div>
                  {c.role && (
                    <p className="text-sm text-muted-foreground">{c.role}</p>
                  )}
                  {c.email && <MailLink email={c.email} />}
                  {c.phoneMobile && <PhoneLink phone={c.phoneMobile} />}
                  {c.phoneLandline && <PhoneLink phone={c.phoneLandline} />}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11"
                    onClick={() => openEdit(c)}
                    aria-label={t.actions.edit}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 text-destructive"
                    onClick={() => setDeleteId(c.id)}
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
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? t.actions.edit : t.actions.addContact}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label={f.contactTitle}>
                <Input
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={f.contactFirstName} required>
                <Input
                  value={form.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={f.contactLastName} required>
                <Input
                  value={form.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
            </div>
            <Field label={f.contactRole}>
              <Input
                value={form.role}
                onChange={(e) => set('role', e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <Field label={f.contactEmail}>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={f.contactPhoneMobile}>
                <Input
                  value={form.phoneMobile}
                  onChange={(e) => set('phoneMobile', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={f.contactPhoneLandline}>
                <Input
                  value={form.phoneLandline}
                  onChange={(e) => set('phoneLandline', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
            </div>
            <Field label={f.contactNotes}>
              <Input
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <label className="flex min-h-[44px] items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isPrimary}
                onChange={(e) => set('isPrimary', e.target.checked)}
                className="h-4 w-4"
              />
              {f.contactIsPrimary}
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
            <Button
              onClick={save}
              disabled={
                saving || !form.firstName.trim() || !form.lastName.trim()
              }
              className="min-h-[44px]"
            >
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
