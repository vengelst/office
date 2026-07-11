'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Field } from '@/components/customers/customer-form';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { EmptyState } from '@/components/customers/empty-state';
import { SubmissionSearchDialog } from '@/components/customers/submission-search-dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  submissionsApi,
  type Submission,
  type SubmissionStatus,
  type SubmissionPriority,
} from '@/lib/submissions';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

const STATUSES: SubmissionStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'SUBMITTED',
  'WON',
  'LOST',
  'CANCELLED',
];

const PRIORITIES: SubmissionPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const STATUS_COLOR: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  IN_PROGRESS:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  SUBMITTED:
    'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  WON: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  LOST: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

type FormState = {
  title: string;
  description: string;
  reference: string;
  source: string;
  status: SubmissionStatus;
  priority: SubmissionPriority;
  deadline: string;
  startDate: string;
  endDate: string;
  value: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  requirements: string;
  notes: string;
};

const EMPTY: FormState = {
  title: '',
  description: '',
  reference: '',
  source: '',
  status: 'OPEN',
  priority: 'MEDIUM',
  deadline: '',
  startDate: '',
  endDate: '',
  value: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  requirements: '',
  notes: '',
};

/**
 * Tab-Komponente zur Verwaltung von Ausschreibungen eines Kunden.
 * Bietet CRUD-Operationen, Inline-Status-Änderung und Auto-Recherche.
 */
export function SubmissionsTab({
  customerId,
  onChange,
}: {
  customerId: string;
  onChange: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.customers.submissions;

  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Submission | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [searchOpen, setSearchOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    submissionsApi
      .list({ customerId })
      .then(setItems)
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }))
      .finally(() => setLoading(false));
  }, [customerId, toast, t.toast.error]);

  useEffect(() => {
    load();
  }, [load]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]): void =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const openCreate = (): void => {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (s: Submission): void => {
    setEditing(s);
    setForm({
      title: s.title,
      description: s.description ?? '',
      reference: s.reference ?? '',
      source: s.source ?? '',
      status: s.status,
      priority: s.priority,
      deadline: s.deadline ? s.deadline.slice(0, 10) : '',
      startDate: s.startDate ? s.startDate.slice(0, 10) : '',
      endDate: s.endDate ? s.endDate.slice(0, 10) : '',
      value: s.value ?? '',
      contactName: s.contactName ?? '',
      contactEmail: s.contactEmail ?? '',
      contactPhone: s.contactPhone ?? '',
      requirements: s.requirements ?? '',
      notes: s.notes ?? '',
    });
    setDialogOpen(true);
  };

  const save = (): void => {
    const payload = {
      title: form.title,
      description: form.description || undefined,
      reference: form.reference || undefined,
      source: form.source || undefined,
      status: form.status,
      priority: form.priority,
      deadline: form.deadline || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      value: form.value ? Number(form.value) : undefined,
      contactName: form.contactName || undefined,
      contactEmail: form.contactEmail || undefined,
      contactPhone: form.contactPhone || undefined,
      requirements: form.requirements || undefined,
      notes: form.notes || undefined,
    };

    setSaving(true);
    const req = editing
      ? submissionsApi.update(editing.id, payload)
      : submissionsApi.create({ ...payload, customerId });
    req
      .then(() => {
        toast({ description: editing ? t.toast.updated : t.toast.created });
        setDialogOpen(false);
        load();
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

  const handleStatusChange = (id: string, status: SubmissionStatus): void => {
    submissionsApi
      .update(id, { status })
      .then(() => {
        toast({ description: t.toast.updated });
        load();
      })
      .catch(() =>
        toast({ variant: 'destructive', description: t.toast.error }),
      );
  };

  const confirmDelete = (): void => {
    if (!deleteId) return;
    submissionsApi
      .remove(deleteId)
      .then(() => {
        toast({ description: t.toast.deleted });
        load();
        onChange();
      })
      .catch(() =>
        toast({ variant: 'destructive', description: t.toast.error }),
      )
      .finally(() => setDeleteId(null));
  };

  const formatValue = (v: string | null): string => {
    if (!v) return '–';
    const n = Number(v);
    if (Number.isNaN(n)) return v;
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(n);
  };

  const formatDate = (d: string | null): string => {
    if (!d) return '–';
    return new Date(d).toLocaleDateString('de-DE');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{t.title}</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setSearchOpen(true)}
            className="min-h-[44px]"
          >
            <Search className="h-4 w-4" />
            {t.searchButton}
          </Button>
          <Button onClick={openCreate} className="min-h-[44px]">
            <Plus className="h-4 w-4" />
            {t.newSubmission}
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          message={t.empty}
          actionLabel={t.addNow}
          onAction={openCreate}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columns.title}</TableHead>
                  <TableHead>{t.columns.reference}</TableHead>
                  <TableHead>{t.columns.status}</TableHead>
                  <TableHead>{t.columns.priority}</TableHead>
                  <TableHead>{t.columns.deadline}</TableHead>
                  <TableHead className="text-right">
                    {t.columns.value}
                  </TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => openEdit(s)}
                  >
                    <TableCell className="font-medium">{s.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.reference ?? '–'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={s.status}
                        onValueChange={(v) =>
                          handleStatusChange(s.id, v as SubmissionStatus)
                        }
                      >
                        <SelectTrigger className="h-8 w-auto border-0 p-0">
                          <Badge
                            className={`${STATUS_COLOR[s.status] ?? ''} text-xs`}
                          >
                            {t.status[s.status] ?? s.status}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((st) => (
                            <SelectItem key={st} value={st}>
                              {t.status[st]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${PRIORITY_COLOR[s.priority] ?? ''} text-xs`}
                      >
                        {t.priority[s.priority] ?? s.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(s.deadline)}</TableCell>
                    <TableCell className="text-right">
                      {formatValue(s.value)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => openEdit(s)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive"
                          onClick={() => setDeleteId(s.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? t.fields.title : t.newSubmission}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Basisdaten */}
            <h4 className="text-sm font-semibold text-muted-foreground">
              {t.sections.base}
            </h4>
            <Field label={t.fields.title} required>
              <Input
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <Field label={t.fields.description}>
              <Textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={3}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={t.fields.reference}>
                <Input
                  value={form.reference}
                  onChange={(e) => set('reference', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={t.fields.source}>
                <Input
                  value={form.source}
                  onChange={(e) => set('source', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label={t.fields.status}>
                <Select
                  value={form.status}
                  onValueChange={(v) => set('status', v as SubmissionStatus)}
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((st) => (
                      <SelectItem key={st} value={st}>
                        {t.status[st]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t.fields.priority}>
                <Select
                  value={form.priority}
                  onValueChange={(v) =>
                    set('priority', v as SubmissionPriority)
                  }
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {t.priority[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t.fields.value}>
                <Input
                  type="number"
                  value={form.value}
                  onChange={(e) => set('value', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
            </div>

            {/* Termine */}
            <h4 className="text-sm font-semibold text-muted-foreground">
              {t.sections.dates}
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label={t.fields.deadline}>
                <Input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => set('deadline', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={t.fields.startDate}>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set('startDate', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={t.fields.endDate}>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => set('endDate', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
            </div>

            {/* Ansprechpartner */}
            <h4 className="text-sm font-semibold text-muted-foreground">
              {t.sections.contact}
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label={t.fields.contactName}>
                <Input
                  value={form.contactName}
                  onChange={(e) => set('contactName', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={t.fields.contactEmail}>
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => set('contactEmail', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={t.fields.contactPhone}>
                <Input
                  value={form.contactPhone}
                  onChange={(e) => set('contactPhone', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
            </div>

            {/* Details */}
            <h4 className="text-sm font-semibold text-muted-foreground">
              {t.sections.details}
            </h4>
            <Field label={t.fields.requirements}>
              <Textarea
                value={form.requirements}
                onChange={(e) => set('requirements', e.target.value)}
                rows={3}
              />
            </Field>
            <Field label={t.fields.notes}>
              <Textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={2}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="min-h-[44px]"
            >
              {texts.customers.actions.cancel}
            </Button>
            <Button
              onClick={save}
              disabled={saving || !form.title}
              className="min-h-[44px]"
            >
              {saving
                ? texts.customers.actions.saving
                : texts.customers.actions.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title={texts.customers.actions.delete}
        description={texts.customers.deleteConfirm}
        onConfirm={confirmDelete}
      />

      <SubmissionSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        customerId={customerId}
        onImported={() => {
          load();
          onChange();
        }}
      />
    </div>
  );
}
