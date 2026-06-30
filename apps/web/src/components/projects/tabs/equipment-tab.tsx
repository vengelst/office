'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { PackageCheck, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { projectsApi, type ProjectEquipment } from '@/lib/projects';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { texts } from '@/lib/texts';

const todayISO = (): string => new Date().toISOString().slice(0, 10);

type FormState = {
  name: string;
  description: string;
  quantity: string;
  serialNumber: string;
  issuedAt: string;
  issuedTo: string;
  condition: string;
  notes: string;
};

const EMPTY: FormState = {
  name: '',
  description: '',
  quantity: '1',
  serialNumber: '',
  issuedAt: todayISO(),
  issuedTo: '',
  condition: '',
  notes: '',
};

function StatusBadge({ item }: { item: ProjectEquipment }): ReactNode {
  const t = texts.projects;
  return item.returnedAt ? (
    <Badge variant="secondary">{t.returnedEquipment}</Badge>
  ) : (
    <Badge className="border-transparent bg-amber-500 text-black hover:bg-amber-500">
      {t.issuedEquipment}
    </Badge>
  );
}

export function EquipmentTab({
  projectId,
  equipment,
  onChange,
}: {
  projectId: string;
  equipment: ProjectEquipment[];
  onChange: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.projects;
  const f = t.fields;
  const [openOnly, setOpenOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectEquipment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  // Rückgabe
  const [returning, setReturning] = useState<ProjectEquipment | null>(null);
  const [returnDate, setReturnDate] = useState(todayISO());
  const [returnCondition, setReturnCondition] = useState('');

  const set = (k: keyof FormState, v: string): void =>
    setForm((p) => ({ ...p, [k]: v }));

  const filtered = useMemo(
    () => (openOnly ? equipment.filter((e) => !e.returnedAt) : equipment),
    [equipment, openOnly],
  );

  const openCreate = (): void => {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (e: ProjectEquipment): void => {
    setEditing(e);
    setForm({
      name: e.name,
      description: e.description ?? '',
      quantity: String(e.quantity),
      serialNumber: e.serialNumber ?? '',
      issuedAt: e.issuedAt ? e.issuedAt.slice(0, 10) : todayISO(),
      issuedTo: e.issuedTo ?? '',
      condition: e.condition ?? '',
      notes: e.notes ?? '',
    });
    setDialogOpen(true);
  };

  const save = (): void => {
    const qty = Number(form.quantity);
    const payload = {
      name: form.name,
      description: form.description || undefined,
      quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
      serialNumber: form.serialNumber || undefined,
      issuedAt: form.issuedAt || undefined,
      issuedTo: form.issuedTo || undefined,
      condition: form.condition || undefined,
      notes: form.notes || undefined,
    };
    setSaving(true);
    const req = editing
      ? projectsApi.updateEquipment(projectId, editing.id, payload)
      : projectsApi.createEquipment(projectId, payload);
    req
      .then(() => {
        toast({ description: editing ? t.toast.updated : t.toast.equipmentAdded });
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

  const openReturn = (e: ProjectEquipment): void => {
    setReturning(e);
    setReturnDate(todayISO());
    setReturnCondition('');
  };

  const confirmReturn = (): void => {
    if (!returning) return;
    setSaving(true);
    projectsApi
      .updateEquipment(projectId, returning.id, {
        returnedAt: returnDate || todayISO(),
        returnCondition: returnCondition || undefined,
      })
      .then(() => {
        toast({ description: t.toast.equipmentReturned });
        setReturning(null);
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
      .removeEquipment(projectId, deleteId)
      .then(() => {
        toast({ description: t.toast.itemDeleted });
        onChange();
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }))
      .finally(() => setDeleteId(null));
  };

  const RowActions = ({ e }: { e: ProjectEquipment }): ReactNode => (
    <div className="flex justify-end gap-1">
      {!e.returnedAt && (
        <Button
          variant="outline"
          size="sm"
          className="min-h-[44px]"
          onClick={() => openReturn(e)}
        >
          <PackageCheck className="h-4 w-4" />
          {t.actions.returnEquipment}
        </Button>
      )}
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
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex min-h-[44px] items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
            className="h-4 w-4"
          />
          {t.issuedEquipment}
        </label>
        <Button onClick={openCreate} className="min-h-[44px]">
          <Plus className="h-4 w-4" />
          {t.actions.addEquipment}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message={t.empties.equipment} actionLabel={t.empties.addNow} onAction={openCreate} />
      ) : (
        <>
          {/* Desktop: Tabelle */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{f.equipmentName}</TableHead>
                  <TableHead>{f.quantity}</TableHead>
                  <TableHead>{f.serialNumber}</TableHead>
                  <TableHead>{f.issuedAt}</TableHead>
                  <TableHead>{f.returnedAt}</TableHead>
                  <TableHead>{f.status}</TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell>{e.quantity}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {e.serialNumber ?? '–'}
                    </TableCell>
                    <TableCell>{formatDate(e.issuedAt) || '–'}</TableCell>
                    <TableCell>
                      {e.returnedAt ? formatDate(e.returnedAt) : '–'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge item={e} />
                    </TableCell>
                    <TableCell>
                      <RowActions e={e} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: Cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((e) => (
              <Card key={e.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{e.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.quantity}: {e.quantity}
                        {e.serialNumber && <> · {e.serialNumber}</>}
                      </p>
                    </div>
                    <StatusBadge item={e} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {f.issuedAt}: {formatDate(e.issuedAt) || '–'}
                    {e.returnedAt && <> · {f.returnedAt}: {formatDate(e.returnedAt)}</>}
                  </p>
                  <RowActions e={e} />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Anlegen / Bearbeiten */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? t.actions.edit : t.actions.addEquipment}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label={f.equipmentName} required>
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <Field label={f.equipmentDescription}>
              <Input
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={f.quantity}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => set('quantity', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={f.serialNumber}>
                <Input
                  value={form.serialNumber}
                  onChange={(e) => set('serialNumber', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={f.issuedAt}>
                <Input
                  type="date"
                  value={form.issuedAt}
                  onChange={(e) => set('issuedAt', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={f.issuedTo}>
                <Input
                  value={form.issuedTo}
                  onChange={(e) => set('issuedTo', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
            </div>
            <Field label={f.condition}>
              <Input
                value={form.condition}
                onChange={(e) => set('condition', e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <Field label={f.notes}>
              <Input
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                className="min-h-[44px]"
              />
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
            <Button onClick={save} disabled={saving || !form.name} className="min-h-[44px]">
              {saving ? t.actions.saving : t.actions.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rückgabe */}
      <Dialog open={returning !== null} onOpenChange={(o) => !o && setReturning(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.actions.returnEquipment}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {returning && (
              <p className="text-sm text-muted-foreground">{returning.name}</p>
            )}
            <Field label={f.returnedAt}>
              <Input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <Field label={f.returnCondition}>
              <Input
                value={returnCondition}
                onChange={(e) => setReturnCondition(e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReturning(null)}
              className="min-h-[44px]"
            >
              {t.actions.cancel}
            </Button>
            <Button onClick={confirmReturn} disabled={saving} className="min-h-[44px]">
              {saving ? t.actions.saving : t.actions.returnEquipment}
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
