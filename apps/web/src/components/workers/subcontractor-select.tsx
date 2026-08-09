'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/customers/customer-form';
import { useToast } from '@/components/ui/use-toast';
import {
  subcontractorsApi,
  type SubcontractorListItem,
} from '@/lib/workers';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

const NEW_SUB = '__new_sub__';

/**
 * Dropdown zur Subunternehmen-Auswahl inkl. Inline-Dialog
 * „Neues Subunternehmen“ (Name Pflicht).
 */
export function SubcontractorSelect({
  value,
  onChange,
  required,
  disabled,
  error,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.subcontractors;
  const [subs, setSubs] = useState<SubcontractorListItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const load = useCallback(() => {
    subcontractorsApi
      .list({ active: true, limit: 100 })
      .then((r) => setSubs(r.data))
      .catch(() => setSubs([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = (): void => {
    setName('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setDialogOpen(true);
  };

  const create = (): void => {
    if (!name.trim()) return;
    setSaving(true);
    subcontractorsApi
      .create({
        name: name.trim(),
        contactPerson: contactPerson.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      })
      .then((created) => {
        toast({ description: t.toast.created });
        setDialogOpen(false);
        load();
        onChange(created.id);
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      )
      .finally(() => setSaving(false));
  };

  return (
    <>
      <div className={className}>
        <Select
          value={value || undefined}
          disabled={disabled}
          onValueChange={(v) => {
            if (v === NEW_SUB) {
              openCreate();
              return;
            }
            onChange(v);
          }}
        >
          <SelectTrigger
            className={`min-h-[44px] ${error ? 'border-destructive' : ''}`}
          >
            <SelectValue placeholder={required ? '–' : '–'} />
          </SelectTrigger>
          <SelectContent>
            {subs.map((sub) => (
              <SelectItem key={sub.id} value={sub.id}>
                {sub.name}
              </SelectItem>
            ))}
            <SelectItem value={NEW_SUB}>
              <span className="flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" />
                {t.newSubcontractor}
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        {error && (
          <p className="mt-1 text-xs text-destructive">{error}</p>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.createTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label={t.fields.name} required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-h-[44px]"
                autoFocus
              />
            </Field>
            <Field label={t.fields.contactPerson}>
              <Input
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={t.fields.email}>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={t.fields.phone}>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
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
              onClick={create}
              disabled={saving || !name.trim()}
              className="min-h-[44px]"
            >
              {saving ? t.actions.saving : t.actions.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
