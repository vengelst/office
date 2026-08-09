'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { KeyRound, Plus, Trash2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { ApiError, apiClient } from '@/lib/api-client';
import { texts } from '@/lib/texts';
import {
  workItemsApi,
  type CustomerPlAssignment,
  type CustomerPlUser,
} from '@/lib/work-items';

/**
 * Kunden-Projektleiter (Rolle CUSTOMER_PL) eines Projekts zuordnen und
 * wieder entfernen. Entfernen setzt die Zuordnung inaktiv (Historie bleibt).
 */
export function CustomerPlsSection({
  projectId,
  assignments,
  onChange,
}: {
  projectId: string;
  assignments: CustomerPlAssignment[];
  onChange: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.projects.workItems;
  const a = texts.projects.actions;

  const [candidates, setCandidates] = useState<CustomerPlUser[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<CustomerPlAssignment | null>(null);
  const [pinTarget, setPinTarget] = useState<CustomerPlAssignment | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  useEffect(() => {
    workItemsApi
      .listCustomerPlCandidates(projectId)
      .then(setCandidates)
      .catch(() => setCandidates([]));
  }, [projectId]);

  const fail = (err: unknown): void => {
    toast({
      variant: 'destructive',
      description:
        err instanceof ApiError ? err.message : texts.projects.toast.error,
    });
  };

  /** Bereits aktiv zugeordnete Benutzer nicht erneut anbieten. */
  const activeIds = new Set(
    assignments.filter((x) => x.active).map((x) => x.userId),
  );
  const selectable = candidates.filter((c) => !activeIds.has(c.id));

  const openAdd = (): void => {
    setUserId('');
    setDialogOpen(true);
  };

  const save = (): void => {
    if (!userId) return;
    setSaving(true);
    workItemsApi
      .addCustomerPl(projectId, userId)
      .then(() => {
        toast({ description: t.toast.customerPlAdded });
        setDialogOpen(false);
        onChange();
      })
      .catch(fail)
      .finally(() => setSaving(false));
  };

  const savePin = (): void => {
    if (!pinTarget || !/^\d{6}$/.test(pinValue)) return;
    setPinSaving(true);
    apiClient
      .put<{ success: true }>(`/users/${pinTarget.userId}/pin`, { pin: pinValue })
      .then(() => {
        toast({ description: t.customerPls.pinSet });
        setPinTarget(null);
        setPinValue('');
      })
      .catch(fail)
      .finally(() => setPinSaving(false));
  };

  const confirmRemove = (): void => {
    if (!removing) return;
    workItemsApi
      .removeCustomerPl(projectId, removing.userId)
      .then(() => {
        toast({ description: t.toast.customerPlRemoved });
        onChange();
      })
      .catch(fail)
      .finally(() => setRemoving(null));
  };

  const StateBadge = ({ item }: { item: CustomerPlAssignment }): ReactNode =>
    item.active ? (
      <Badge className="border-transparent bg-green-600 text-white hover:bg-green-600">
        {t.customerPls.active}
      </Badge>
    ) : (
      <Badge variant="secondary">{t.customerPls.inactive}</Badge>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <UserCheck className="h-4 w-4" />
            {t.customerPls.title}
          </h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t.customerPls.subtitle}
          </p>
        </div>
        <Button onClick={openAdd} className="min-h-[44px]">
          <Plus className="h-4 w-4" />
          {t.customerPls.add}
        </Button>
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          message={t.customerPls.empty}
          actionLabel={texts.projects.empties.addNow}
          onAction={openAdd}
        />
      ) : (
        <>
          {/* Desktop: Tabelle */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.customerPls.user}</TableHead>
                  <TableHead>{t.customerPls.email}</TableHead>
                  <TableHead>{t.customerPls.state}</TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.user.displayName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.user.email}
                    </TableCell>
                    <TableCell>
                      <StateBadge item={item} />
                    </TableCell>
                    <TableCell>
                      {item.active && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11"
                            onClick={() => {
                              setPinValue('');
                              setPinTarget(item);
                            }}
                            aria-label={t.customerPls.setPin}
                            title={t.customerPls.setPin}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 text-destructive"
                            onClick={() => setRemoving(item)}
                            aria-label={a.delete}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: Cards */}
          <div className="space-y-3 md:hidden">
            {assignments.map((item) => (
              <Card key={item.id}>
                <CardContent className="flex items-start justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{item.user.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.user.email}
                    </p>
                    <StateBadge item={item} />
                  </div>
                  {item.active && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11"
                        onClick={() => {
                          setPinValue('');
                          setPinTarget(item);
                        }}
                        aria-label={t.customerPls.setPin}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 text-destructive"
                        onClick={() => setRemoving(item)}
                        aria-label={a.delete}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.customerPls.add}</DialogTitle>
          </DialogHeader>
          {selectable.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t.customerPls.noCandidates}
            </p>
          ) : (
            <Field label={t.customerPls.user} required>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder={t.customerPls.choose} />
                </SelectTrigger>
                <SelectContent>
                  {selectable.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.displayName} · {user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="min-h-[44px]"
            >
              {a.cancel}
            </Button>
            <Button
              onClick={save}
              disabled={saving || !userId}
              className="min-h-[44px]"
            >
              {saving ? a.saving : a.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pinTarget !== null}
        onOpenChange={(o) => !o && setPinTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.customerPls.pinDialogTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t.customerPls.pinDialogHint}
          </p>
          {pinTarget && (
            <p className="text-sm font-medium">
              {pinTarget.user.displayName} · {pinTarget.user.email}
            </p>
          )}
          <Field label={t.customerPls.pinLabel} required>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
              placeholder={t.customerPls.pinPlaceholder}
              className="min-h-[44px] text-center text-2xl tracking-[0.5em]"
            />
          </Field>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPinTarget(null)}
              className="min-h-[44px]"
            >
              {a.cancel}
            </Button>
            <Button
              onClick={savePin}
              disabled={pinSaving || !/^\d{6}$/.test(pinValue)}
              className="min-h-[44px]"
            >
              {pinSaving ? a.saving : t.customerPls.setPin}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t.customerPls.removeTitle}
        description={t.customerPls.removeConfirm}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
