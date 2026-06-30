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
import { Field } from '@/components/customers/customer-form';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { EmptyState } from '@/components/customers/empty-state';
import { useToast } from '@/components/ui/use-toast';
import { customersApi, type CustomerBankAccount } from '@/lib/customers';
import { ApiError } from '@/lib/api-client';
import { maskIban } from '@/lib/format';
import { texts } from '@/lib/texts';

const MAX = 2;

export function BankAccountsTab({
  customerId,
  bankAccounts,
  onChange,
}: {
  customerId: string;
  bankAccounts: CustomerBankAccount[];
  onChange: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.customers;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerBankAccount | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState('');

  const reachedMax = bankAccounts.length >= MAX;

  const openCreate = (): void => {
    setEditing(null);
    setBankName('');
    setIban('');
    setBic('');
    setAccountHolder('');
    setIsPrimary(false);
    setNotes('');
    setDialogOpen(true);
  };

  const openEdit = (b: CustomerBankAccount): void => {
    setEditing(b);
    setBankName(b.bankName);
    setIban(b.iban);
    setBic(b.bic ?? '');
    setAccountHolder(b.accountHolder ?? '');
    setIsPrimary(b.isPrimary);
    setNotes(b.notes ?? '');
    setDialogOpen(true);
  };

  const save = (): void => {
    const payload = {
      bankName,
      iban: iban.replace(/\s+/g, ''),
      bic: bic || undefined,
      accountHolder: accountHolder || undefined,
      isPrimary,
      notes: notes || undefined,
    };
    setSaving(true);
    const req = editing
      ? customersApi.updateBankAccount(customerId, editing.id, payload)
      : customersApi.createBankAccount(customerId, payload);
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
      .removeBankAccount(customerId, deleteId)
      .then(() => {
        toast({ description: t.toast.itemDeleted });
        onChange();
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }))
      .finally(() => setDeleteId(null));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-3">
        {reachedMax && (
          <span className="text-xs text-muted-foreground">
            {t.maxBankReached}
          </span>
        )}
        <Button
          onClick={openCreate}
          disabled={reachedMax}
          className="min-h-[44px]"
        >
          <Plus className="h-4 w-4" />
          {t.actions.addBankAccount}
        </Button>
      </div>

      {bankAccounts.length === 0 ? (
        <EmptyState
          message={t.empties.bankAccounts}
          actionLabel={t.empties.addNow}
          onAction={openCreate}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {bankAccounts.map((b) => (
            <Card key={b.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{b.bankName}</span>
                    {b.isPrimary && (
                      <Badge className="gap-1">
                        <Star className="h-3 w-3" />
                        {t.fields.isPrimary}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      onClick={() => openEdit(b)}
                      aria-label={t.actions.edit}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 text-destructive"
                      onClick={() => setDeleteId(b.id)}
                      aria-label={t.actions.delete}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="font-mono text-sm">{maskIban(b.iban)}</p>
                {b.bic && (
                  <p className="text-sm text-muted-foreground">
                    {t.fields.bic}: {b.bic}
                  </p>
                )}
                {b.accountHolder && (
                  <p className="text-sm text-muted-foreground">
                    {t.fields.accountHolder}: {b.accountHolder}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t.actions.edit : t.actions.addBankAccount}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label={t.fields.bankName} required>
              <Input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <Field label={t.fields.iban} required>
              <Input
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                className="min-h-[44px] font-mono"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={t.fields.bic}>
                <Input
                  value={bic}
                  onChange={(e) => setBic(e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={t.fields.accountHolder}>
                <Input
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
            </div>
            <Field label={t.fields.notes}>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <label className="flex min-h-[44px] items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
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
            <Button
              onClick={save}
              disabled={saving || !bankName || iban.length < 15}
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
