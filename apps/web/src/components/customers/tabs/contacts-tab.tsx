'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CreditCard,
  Gift,
  Linkedin,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
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
import { MailLink, PhoneLink } from '@/components/customers/contact-links';
import { EmptyState } from '@/components/customers/empty-state';
import { useToast } from '@/components/ui/use-toast';
import {
  customersApi,
  type CustomerBranch,
  type CustomerContact,
} from '@/lib/customers';
import { ApiError } from '@/lib/api-client';
import { uploadDocument } from '@/lib/upload';
import { formatDate } from '@/lib/format';
import { texts } from '@/lib/texts';

const NONE = '__none__';
const ALL = '__all__';
const CONTACT_METHODS = ['EMAIL', 'PHONE', 'MOBILE'] as const;

/** Externe Steuerung (z.B. Klick aus dem Niederlassungs-Detail). */
export type ContactsExternalAction =
  | { kind: 'edit'; contact: CustomerContact }
  | { kind: 'create'; branchId: string | null };

type FormState = {
  title: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string;
  branchId: string;
  email: string;
  phoneMobile: string;
  phoneLandline: string;
  birthday: string;
  linkedInUrl: string;
  preferredContactMethod: string;
  isAccountingContact: boolean;
  isProjectContact: boolean;
  isSignatory: boolean;
};

const EMPTY: FormState = {
  title: '',
  firstName: '',
  lastName: '',
  role: '',
  department: '',
  branchId: NONE,
  email: '',
  phoneMobile: '',
  phoneLandline: '',
  birthday: '',
  linkedInUrl: '',
  preferredContactMethod: '',
  isAccountingContact: false,
  isProjectContact: false,
  isSignatory: false,
};

export function ContactsTab({
  customerId,
  contacts,
  branches,
  onChange,
  externalAction,
  onExternalActionDone,
}: {
  customerId: string;
  contacts: CustomerContact[];
  branches: CustomerBranch[];
  onChange: () => void;
  externalAction?: ContactsExternalAction | null;
  onExternalActionDone?: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.customers;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerContact | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>(ALL);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]): void =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const branchName = (id: string | null): string => {
    if (!id) return t.headquarters;
    return branches.find((b) => b.id === id)?.name ?? t.headquarters;
  };

  // Filter nach Niederlassung (ALL = alle, NONE = Hauptsitz, sonst branchId)
  const visibleContacts =
    filter === ALL
      ? contacts
      : contacts.filter((c) => (c.branchId ?? NONE) === filter);
  const grouped = filter === ALL;

  // Gruppierung nach Niederlassung / Hauptsitz (nur im "Alle"-Modus relevant)
  const groups = new Map<string, CustomerContact[]>();
  for (const c of visibleContacts) {
    const key = c.branchId ?? NONE;
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }

  const openCreate = (branchId: string = NONE): void => {
    setEditing(null);
    setForm({ ...EMPTY, branchId });
    setDialogOpen(true);
  };

  const openEdit = (c: CustomerContact): void => {
    setEditing(c);
    setForm({
      title: c.title ?? '',
      firstName: c.firstName,
      lastName: c.lastName,
      role: c.role ?? '',
      department: c.department ?? '',
      branchId: c.branchId ?? NONE,
      email: c.email ?? '',
      phoneMobile: c.phoneMobile ?? '',
      phoneLandline: c.phoneLandline ?? '',
      birthday: c.birthday ? c.birthday.slice(0, 10) : '',
      linkedInUrl: c.linkedInUrl ?? '',
      preferredContactMethod: c.preferredContactMethod ?? '',
      isAccountingContact: c.isAccountingContact,
      isProjectContact: c.isProjectContact,
      isSignatory: c.isSignatory,
    });
    setDialogOpen(true);
  };

  // Externe Aktionen aus dem Niederlassungs-Detail (Kontakt öffnen / anlegen).
  useEffect(() => {
    if (!externalAction) return;
    if (externalAction.kind === 'edit') {
      openEdit(externalAction.contact);
    } else {
      openCreate(externalAction.branchId ?? NONE);
    }
    onExternalActionDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalAction]);

  const save = (): void => {
    const payload = {
      title: form.title || undefined,
      firstName: form.firstName,
      lastName: form.lastName,
      role: form.role || undefined,
      department: form.department || undefined,
      branchId: form.branchId === NONE ? undefined : form.branchId,
      email: form.email || undefined,
      phoneMobile: form.phoneMobile || undefined,
      phoneLandline: form.phoneLandline || undefined,
      birthday: form.birthday || undefined,
      linkedInUrl: form.linkedInUrl || undefined,
      preferredContactMethod: form.preferredContactMethod || undefined,
      isAccountingContact: form.isAccountingContact,
      isProjectContact: form.isProjectContact,
      isSignatory: form.isSignatory,
    };
    setSaving(true);
    const req = editing
      ? customersApi.updateContact(customerId, editing.id, payload)
      : customersApi.createContact(customerId, payload);
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
      .removeContact(customerId, deleteId)
      .then(() => {
        toast({ description: t.toast.itemDeleted });
        onChange();
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }))
      .finally(() => setDeleteId(null));
  };

  const triggerUpload = (contactId: string): void => {
    setUploadFor(contactId);
    fileInput.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uploadFor) return;
    uploadDocument({
      file,
      documentType: 'BUSINESS_CARD',
      entityType: 'CONTACT',
      entityId: uploadFor,
    })
      .then(() => toast({ description: t.toast.uploaded }))
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      )
      .finally(() => setUploadFor(null));
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInput}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={onFileSelected}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="min-h-[44px] w-full max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t.allBranches}</SelectItem>
            <SelectItem value={NONE}>{t.headquarters}</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => openCreate()} className="min-h-[44px]">
          <Plus className="h-4 w-4" />
          {t.actions.addContact}
        </Button>
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          message={t.empties.contacts}
          actionLabel={t.empties.addNow}
          onAction={() => openCreate()}
        />
      ) : visibleContacts.length === 0 ? (
        <EmptyState message={t.empties.contacts} />
      ) : (
        <div className="space-y-6">
          {Array.from(groups.entries()).map(([key, list]) => (
            <div key={key} className="space-y-3">
              {grouped && (
                <h4 className="text-sm font-semibold text-muted-foreground">
                  {branchName(key === NONE ? null : key)}
                </h4>
              )}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {list.map((c) => (
                  <Card key={c.id}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {[c.title, c.firstName, c.lastName]
                              .filter(Boolean)
                              .join(' ')}
                          </p>
                          {(c.role || c.department) && (
                            <p className="text-sm text-muted-foreground">
                              {[c.role, c.department]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
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
                      </div>

                      <div className="flex flex-col gap-1 text-sm">
                        {c.email && <MailLink email={c.email} />}
                        {c.phoneMobile && (
                          <PhoneLink phone={c.phoneMobile} mobile />
                        )}
                        {c.phoneLandline && <PhoneLink phone={c.phoneLandline} />}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {c.birthday && (
                          <span className="inline-flex items-center gap-1">
                            <Gift className="h-3 w-3" />
                            {formatDate(c.birthday)}
                          </span>
                        )}
                        {c.linkedInUrl && (
                          <a
                            href={c.linkedInUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[44px] items-center gap-1 text-primary hover:underline"
                          >
                            <Linkedin className="h-3 w-3" />
                            LinkedIn
                          </a>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {c.isAccountingContact && (
                          <Badge variant="outline">
                            {t.fields.isAccountingContact}
                          </Badge>
                        )}
                        {c.isProjectContact && (
                          <Badge variant="outline">
                            {t.fields.isProjectContact}
                          </Badge>
                        )}
                        {c.isSignatory && (
                          <Badge variant="outline">
                            {t.fields.isSignatory}
                          </Badge>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px]"
                        disabled={uploadFor === c.id}
                        onClick={() => triggerUpload(c.id)}
                      >
                        <CreditCard className="h-4 w-4" />
                        {t.actions.uploadBusinessCard}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
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
              <Field label={t.fields.title}>
                <Input
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={t.fields.firstName} required>
                <Input
                  value={form.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={t.fields.lastName} required>
                <Input
                  value={form.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={t.fields.role}>
                <Input
                  value={form.role}
                  onChange={(e) => set('role', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={t.fields.department}>
                <Input
                  value={form.department}
                  onChange={(e) => set('department', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
            </div>
            <Field label={t.fields.branch}>
              <Select
                value={form.branchId}
                onValueChange={(v) => set('branchId', v)}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t.headquarters}</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label={t.fields.email}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={t.fields.phoneMobile}>
                <Input
                  value={form.phoneMobile}
                  onChange={(e) => set('phoneMobile', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={t.fields.phoneLandline}>
                <Input
                  value={form.phoneLandline}
                  onChange={(e) => set('phoneLandline', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label={t.fields.birthday}>
                <Input
                  type="date"
                  value={form.birthday}
                  onChange={(e) => set('birthday', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={t.fields.linkedInUrl}>
                <Input
                  value={form.linkedInUrl}
                  onChange={(e) => set('linkedInUrl', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={t.fields.preferredContactMethod}>
                <Select
                  value={form.preferredContactMethod || NONE}
                  onValueChange={(v) =>
                    set('preferredContactMethod', v === NONE ? '' : v)
                  }
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue placeholder="–" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>–</SelectItem>
                    {CONTACT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {t.contactMethods[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="flex flex-col gap-2">
              <Checkbox
                label={t.fields.isAccountingContact}
                checked={form.isAccountingContact}
                onChange={(v) => set('isAccountingContact', v)}
              />
              <Checkbox
                label={t.fields.isProjectContact}
                checked={form.isProjectContact}
                onChange={(v) => set('isProjectContact', v)}
              />
              <Checkbox
                label={t.fields.isSignatory}
                checked={form.isSignatory}
                onChange={(v) => set('isSignatory', v)}
              />
            </div>
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
              disabled={saving || !form.firstName || !form.lastName}
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

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}): ReactNode {
  return (
    <label className="flex min-h-[44px] items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      {label}
    </label>
  );
}
