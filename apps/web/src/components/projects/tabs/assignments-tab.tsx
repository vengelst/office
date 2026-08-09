'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field } from '@/components/customers/customer-form';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { EmptyState } from '@/components/customers/empty-state';
import { useToast } from '@/components/ui/use-toast';
import {
  projectsApi,
  type ProjectAssignment,
  type ProjectWorkerOption,
} from '@/lib/projects';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { texts } from '@/lib/texts';

type FormState = {
  workerId: string;
  roleName: string;
  startDate: string;
  endDate: string;
  isLead: boolean;
  notes: string;
};

const EMPTY: FormState = {
  workerId: '',
  roleName: '',
  startDate: '',
  endDate: '',
  isLead: false,
  notes: '',
};

const workerName = (w: { firstName: string; lastName: string }): string =>
  [w.firstName, w.lastName].filter(Boolean).join(' ');

export function AssignmentsTab({
  projectId,
  assignments,
  onChange,
  plannedStartDate,
  plannedEndDate,
}: {
  projectId: string;
  assignments: ProjectAssignment[];
  onChange: () => void;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.projects;
  const f = t.fields;
  const [workers, setWorkers] = useState<ProjectWorkerOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectAssignment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const dateOnly = (iso?: string | null): string =>
    iso ? iso.slice(0, 10) : '';

  const localToday = (): string => {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
  };

  // Alle Monteure laden inkl. Frei/Belegt-Metadaten (nie leere Liste bei Bestand).
  useEffect(() => {
    if (!dialogOpen) return;
    const params: { from?: string; to?: string } = {};
    if (form.startDate) params.from = form.startDate;
    if (form.endDate) params.to = form.endDate;
    projectsApi
      .listWorkers(params)
      .then((list) => {
        if (
          editing &&
          !list.some((w) => w.id === editing.workerId) &&
          editing.worker
        ) {
          setWorkers([
            {
              id: editing.worker.id,
              workerNumber: editing.worker.workerNumber,
              firstName: editing.worker.firstName,
              lastName: editing.worker.lastName,
              available: true,
            },
            ...list,
          ]);
        } else {
          setWorkers(list);
        }
      })
      .catch(() => setWorkers([]));
  }, [dialogOpen, form.startDate, form.endDate, editing]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]): void =>
    setForm((p) => ({ ...p, [k]: v }));

  const openCreate = (): void => {
    setEditing(null);
    setForm({
      ...EMPTY,
      startDate: dateOnly(plannedStartDate) || localToday(),
      endDate: dateOnly(plannedEndDate),
    });
    setDialogOpen(true);
  };

  const openEdit = (asg: ProjectAssignment): void => {
    setEditing(asg);
    setForm({
      workerId: asg.workerId,
      roleName: asg.roleName ?? '',
      startDate: asg.startDate ? asg.startDate.slice(0, 10) : '',
      endDate: asg.endDate ? asg.endDate.slice(0, 10) : '',
      isLead: asg.isLead,
      notes: asg.notes ?? '',
    });
    setDialogOpen(true);
  };

  const save = (): void => {
    const payload = {
      workerId: form.workerId,
      roleName: form.roleName || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      isLead: form.isLead,
      notes: form.notes || undefined,
    };
    setSaving(true);
    const req = editing
      ? projectsApi.updateAssignment(projectId, editing.id, payload)
      : projectsApi.createAssignment(projectId, payload);
    req
      .then(() => {
        toast({
          description: editing ? t.toast.updated : t.toast.assignmentAdded,
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
    projectsApi
      .removeAssignment(projectId, deleteId)
      .then(() => {
        toast({ description: t.toast.assignmentEnded });
        onChange();
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }))
      .finally(() => setDeleteId(null));
  };

  const period = (asg: ProjectAssignment): string =>
    [formatDate(asg.startDate), asg.endDate ? formatDate(asg.endDate) : '…']
      .filter(Boolean)
      .join(' – ');

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="min-h-[44px]">
          <Plus className="h-4 w-4" />
          {t.actions.addAssignment}
        </Button>
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          message={t.empties.assignments}
          actionLabel={t.empties.addNow}
          onAction={openCreate}
        />
      ) : (
        <>
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{f.worker}</TableHead>
                  <TableHead>{f.roleName}</TableHead>
                  <TableHead>
                    {f.startDate} – {f.endDate}
                  </TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((asg) => (
                  <TableRow key={asg.id}>
                    <TableCell className="font-medium">
                      <span className="flex flex-wrap items-center gap-2">
                        {workerName(asg.worker)}
                        {asg.isLead && (
                          <Badge variant="secondary">{f.isLead}</Badge>
                        )}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {asg.worker.workerNumber}
                      </span>
                    </TableCell>
                    <TableCell>{asg.roleName ?? '–'}</TableCell>
                    <TableCell>{period(asg)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11"
                          onClick={() => openEdit(asg)}
                          aria-label={t.actions.edit}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 text-destructive"
                          onClick={() => setDeleteId(asg.id)}
                          aria-label={t.actions.delete}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-3 md:hidden">
            {assignments.map((asg) => (
              <Card key={asg.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {workerName(asg.worker)}
                        {asg.isLead && (
                          <Badge variant="secondary">{f.isLead}</Badge>
                        )}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {asg.worker.workerNumber}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11"
                        onClick={() => openEdit(asg)}
                        aria-label={t.actions.edit}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 text-destructive"
                        onClick={() => setDeleteId(asg.id)}
                        aria-label={t.actions.delete}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {asg.roleName && <p className="text-sm">{asg.roleName}</p>}
                  <p className="text-sm text-muted-foreground">{period(asg)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? t.actions.edit : t.actions.addAssignment}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={f.startDate}>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set('startDate', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={f.endDate}>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => set('endDate', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
            </div>
            <Field label={f.worker} required>
              <Select
                value={form.workerId}
                onValueChange={(v) => set('workerId', v)}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="–" />
                </SelectTrigger>
                <SelectContent>
                  {workers.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      {t.empties.noFreeWorkers}
                    </SelectItem>
                  ) : (
                    workers.map((w) => {
                      const free = w.available !== false;
                      const label = free
                        ? `${workerName(w)} (${w.workerNumber})`
                        : `${workerName(w)} (${w.workerNumber}) – belegt${
                            w.blockingProjectTitle
                              ? `: ${w.blockingProjectTitle}`
                              : ''
                          }`;
                      return (
                        <SelectItem
                          key={w.id}
                          value={w.id}
                          disabled={!free && !editing}
                        >
                          {label}
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.hints.workerAvailability}
              </p>
            </Field>
            <Field label={f.roleName}>
              <Input
                value={form.roleName}
                onChange={(e) => set('roleName', e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <label className="flex min-h-[44px] items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isLead}
                onChange={(e) => set('isLead', e.target.checked)}
                className="h-4 w-4"
              />
              {f.isLead}
            </label>
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
            <Button
              onClick={save}
              disabled={saving || !form.workerId}
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
