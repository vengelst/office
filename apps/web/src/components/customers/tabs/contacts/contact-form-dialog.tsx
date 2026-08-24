/**
 * Dialog zum Anlegen/Bearbeiten eines Kundenkontakts.
 */

'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import type { CustomerBranch } from '@/lib/customers';
import { texts } from '@/lib/texts';
import { Checkbox } from './contacts-helpers';
import { ContactSalutationSelect } from './contact-salutation-select';
import {
  CONTACT_METHODS,
  NONE,
  type FormState,
} from './contacts-types';

export function ContactFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  setFormField,
  branches,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: FormState;
  setFormField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  branches: CustomerBranch[];
  saving: boolean;
  onSave: () => void;
}): React.ReactNode {
  const t = texts.customers;
  const set = setFormField;

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? t.actions.edit : t.actions.addContact}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label={t.fields.title}>
                <ContactSalutationSelect
                  value={form.title}
                  onChange={(v) => set('title', v)}
                  noneLabel={t.fields.titleNone}
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
              <div className="flex flex-col">
                <Checkbox
                  label={t.research.syncGoogle}
                  checked={form.syncToGoogle}
                  onChange={(v) => set('syncToGoogle', v)}
                />
                <span className="ml-6 text-xs text-muted-foreground">
                  {t.research.syncGoogleHint}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="min-h-[44px]"
            >
              {t.actions.cancel}
            </Button>
            <Button
              onClick={onSave}
              disabled={saving || !form.firstName || !form.lastName}
              className="min-h-[44px]"
            >
              {saving ? t.actions.saving : t.actions.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
