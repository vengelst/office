'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Plus, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { WorkerAvatar } from '@/components/workers/worker-avatar';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { workerFullName } from '@/lib/workers';
import {
  vehiclesApi,
  type VehicleDetail,
  type VehicleWorker,
} from '@/lib/vehicles';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { texts } from '@/lib/texts';

export function VehicleAssignmentsTab({
  vehicle,
  workers,
  onChange,
}: {
  vehicle: VehicleDetail;
  workers: VehicleWorker[];
  onChange: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.vehicles;
  const f = t.fields;
  const a = t.assignment;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [unassignOpen, setUnassignOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workerId, setWorkerId] = useState('');
  const [notes, setNotes] = useState('');

  const current = vehicle.currentAssignment;

  const openAssign = (): void => {
    setWorkerId('');
    setNotes('');
    setDialogOpen(true);
  };

  const save = (): void => {
    if (!workerId) return;
    setSaving(true);
    vehiclesApi
      .assign(vehicle.id, { workerId, notes: notes.trim() || undefined })
      .then(() => {
        toast({ description: t.toast.assigned });
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

  const unassign = (): void => {
    vehiclesApi
      .unassign(vehicle.id)
      .then(() => {
        toast({ description: t.toast.unassigned });
        onChange();
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      )
      .finally(() => setUnassignOpen(false));
  };

  const period = (asg: { assignedFrom: string; assignedTo: string | null }): string =>
    [formatDate(asg.assignedFrom), asg.assignedTo ? formatDate(asg.assignedTo) : '…']
      .filter(Boolean)
      .join(' – ');

  return (
    <div className="space-y-8">
      {/* Aktuelle Zuweisung */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {t.sections.currentAssignment}
        </h3>
        {current ? (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <Link
                href={`/workers/${current.worker.id}`}
                className="flex min-w-0 items-center gap-3"
              >
                <WorkerAvatar
                  workerId={current.worker.id}
                  hasPhoto={!!current.worker.photoPath}
                  name={workerFullName(current.worker)}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {workerFullName(current.worker)}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {current.worker.workerNumber}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {a.since} {formatDate(current.assignedFrom)}
                    {current.notes ? ` · ${current.notes}` : ''}
                  </p>
                </div>
              </Link>
              <Button
                variant="outline"
                className="min-h-[44px] text-destructive"
                onClick={() => setUnassignOpen(true)}
              >
                <UserMinus className="h-4 w-4" />
                {a.unassignAction}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-6">
              <p className="text-sm text-muted-foreground">{a.notAssigned}</p>
              <Button onClick={openAssign} className="min-h-[44px]">
                <Plus className="h-4 w-4" />
                {a.assignAction}
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Historie */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {t.sections.history}
        </h3>
        {vehicle.history.length === 0 ? (
          <EmptyState message={a.noHistory} />
        ) : (
          <>
            {/* Desktop */}
            <Card className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{f.worker}</TableHead>
                    <TableHead>{f.period}</TableHead>
                    <TableHead>{f.notes}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicle.history.map((asg) => (
                    <TableRow key={asg.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/workers/${asg.worker.id}`}
                          className="hover:underline"
                        >
                          {workerFullName(asg.worker)}
                        </Link>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {asg.worker.workerNumber}
                        </span>
                      </TableCell>
                      <TableCell>{period(asg)}</TableCell>
                      <TableCell>{asg.notes ?? '–'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Mobile */}
            <div className="space-y-3 md:hidden">
              {vehicle.history.map((asg) => (
                <Card key={asg.id}>
                  <CardContent className="space-y-1 p-4">
                    <Link
                      href={`/workers/${asg.worker.id}`}
                      className="font-medium hover:underline"
                    >
                      {workerFullName(asg.worker)}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">
                      {asg.worker.workerNumber}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {period(asg)}
                    </p>
                    {asg.notes && <p className="text-sm">{asg.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Zuweisungs-Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{a.assignTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label={f.worker} required>
              <Select value={workerId} onValueChange={setWorkerId}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder={a.selectWorker} />
                </SelectTrigger>
                <SelectContent>
                  {workers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {workerFullName(w)} ({w.workerNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={f.notes}>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
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
              disabled={saving || !workerId}
              className="min-h-[44px]"
            >
              {saving ? t.actions.saving : t.actions.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={unassignOpen}
        onOpenChange={setUnassignOpen}
        title={a.unassignTitle}
        description={a.unassignConfirm}
        confirmLabel={a.unassignAction}
        onConfirm={unassign}
      />
    </div>
  );
}
