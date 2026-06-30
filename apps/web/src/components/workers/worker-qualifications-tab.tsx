'use client';

import { useState, type ReactNode } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Field } from '@/components/customers/customer-form';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { EmptyState } from '@/components/customers/empty-state';
import {
  ProficiencyBadge,
  ExpiryDate,
} from '@/components/workers/worker-badges';
import { useToast } from '@/components/ui/use-toast';
import {
  workersApi,
  type LanguageProficiency,
  type WorkerCertification,
  type WorkerDetail,
  type WorkerLanguage,
} from '@/lib/workers';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

const LANGUAGE_OPTIONS: ComboboxOption[] = [
  'Deutsch',
  'Englisch',
  'Französisch',
  'Kroatisch',
  'Serbisch',
  'Bosnisch',
  'Polnisch',
  'Rumänisch',
  'Ungarisch',
  'Türkisch',
  'Slowenisch',
].map((v) => ({ value: v, label: v }));

const CERT_OPTIONS: ComboboxOption[] = [
  'Elektrofachkraft',
  'SCC Dok. 017',
  'SCC Dok. 018',
  'Ersthelfer',
  'Höhenarbeiter (PSAgA)',
  'Schweißerprüfung',
  'Staplerschein',
  'Brandschutzhelfer',
  'DGUV V3',
  'VOB-Kenntnisse',
].map((v) => ({ value: v, label: v }));

const PROFICIENCIES: LanguageProficiency[] = [
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
  'NATIVE',
];

export function WorkerQualificationsTab({
  worker,
  onChange,
}: {
  worker: WorkerDetail;
  onChange: () => void;
}): ReactNode {
  return (
    <div className="space-y-8">
      <LanguagesSection
        workerId={worker.id}
        languages={worker.languages}
        onChange={onChange}
      />
      <CertificationsSection
        workerId={worker.id}
        certifications={worker.certifications}
        onChange={onChange}
      />
    </div>
  );
}

// ── Sprachen ────────────────────────────────────────────────────

function LanguagesSection({
  workerId,
  languages,
  onChange,
}: {
  workerId: string;
  languages: WorkerLanguage[];
  onChange: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.workers;
  const f = t.fields;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkerLanguage | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [language, setLanguage] = useState('');
  const [proficiency, setProficiency] = useState<LanguageProficiency>('B1');

  const openCreate = (): void => {
    setEditing(null);
    setLanguage('');
    setProficiency('B1');
    setDialogOpen(true);
  };

  const openEdit = (l: WorkerLanguage): void => {
    setEditing(l);
    setLanguage(l.language);
    setProficiency(l.proficiency);
    setDialogOpen(true);
  };

  const save = (): void => {
    if (!language.trim()) return;
    setSaving(true);
    const req = editing
      ? workersApi.updateLanguage(workerId, editing.id, { proficiency })
      : workersApi.createLanguage(workerId, { language, proficiency });
    req
      .then(() => {
        toast({ description: t.toast.languageAdded });
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
    workersApi
      .removeLanguage(workerId, deleteId)
      .then(() => {
        toast({ description: t.toast.itemDeleted });
        onChange();
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }))
      .finally(() => setDeleteId(null));
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {t.sections.languages}
        </h3>
        <Button size="sm" onClick={openCreate} className="min-h-[44px]">
          <Plus className="h-4 w-4" />
          {t.actions.addLanguage}
        </Button>
      </div>

      {languages.length === 0 ? (
        <EmptyState message={t.empties.languages} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {languages.map((l) => (
            <Card key={l.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <span className="font-medium">{l.language}</span>
                <ProficiencyBadge proficiency={l.proficiency} />
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => openEdit(l)}
                    aria-label={t.actions.edit}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive"
                    onClick={() => setDeleteId(l.id)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t.actions.edit : t.actions.addLanguage}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label={f.language} required>
              <Combobox
                value={language}
                onChange={setLanguage}
                options={LANGUAGE_OPTIONS}
                placeholder="z.B. Deutsch"
                disabled={!!editing}
              />
            </Field>
            <Field label={f.proficiency}>
              <Select
                value={proficiency}
                onValueChange={(v) => setProficiency(v as LanguageProficiency)}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROFICIENCIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {texts.workers.proficiency[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              disabled={saving || !language.trim()}
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
        onConfirm={confirmDelete}
      />
    </section>
  );
}

// ── Zertifikate ─────────────────────────────────────────────────

type CertForm = {
  name: string;
  issuedBy: string;
  issuedDate: string;
  expiryDate: string;
  notes: string;
};

const EMPTY_CERT: CertForm = {
  name: '',
  issuedBy: '',
  issuedDate: '',
  expiryDate: '',
  notes: '',
};

function CertificationsSection({
  workerId,
  certifications,
  onChange,
}: {
  workerId: string;
  certifications: WorkerCertification[];
  onChange: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.workers;
  const f = t.fields;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkerCertification | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CertForm>(EMPTY_CERT);

  const set = (k: keyof CertForm, v: string): void =>
    setForm((p) => ({ ...p, [k]: v }));

  const openCreate = (): void => {
    setEditing(null);
    setForm(EMPTY_CERT);
    setDialogOpen(true);
  };

  const openEdit = (c: WorkerCertification): void => {
    setEditing(c);
    setForm({
      name: c.name,
      issuedBy: c.issuedBy ?? '',
      issuedDate: c.issuedDate ? c.issuedDate.slice(0, 10) : '',
      expiryDate: c.expiryDate ? c.expiryDate.slice(0, 10) : '',
      notes: c.notes ?? '',
    });
    setDialogOpen(true);
  };

  const save = (): void => {
    if (!form.name.trim()) return;
    const opt = (v: string): string | undefined => (v.trim() ? v : undefined);
    const payload = {
      name: form.name,
      issuedBy: opt(form.issuedBy),
      issuedDate: opt(form.issuedDate),
      expiryDate: opt(form.expiryDate),
      notes: opt(form.notes),
    };
    setSaving(true);
    const req = editing
      ? workersApi.updateCertification(workerId, editing.id, payload)
      : workersApi.createCertification(workerId, payload);
    req
      .then(() => {
        toast({ description: t.toast.certificationSaved });
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
    workersApi
      .removeCertification(workerId, deleteId)
      .then(() => {
        toast({ description: t.toast.itemDeleted });
        onChange();
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }))
      .finally(() => setDeleteId(null));
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {t.sections.certifications}
        </h3>
        <Button size="sm" onClick={openCreate} className="min-h-[44px]">
          <Plus className="h-4 w-4" />
          {t.actions.addCertification}
        </Button>
      </div>

      {certifications.length === 0 ? (
        <EmptyState message={t.empties.certifications} />
      ) : (
        <div className="space-y-3">
          {certifications.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.issuedBy && <>{c.issuedBy} · </>}
                    {f.expiryDate}: <ExpiryDate value={c.expiryDate} />
                  </p>
                  {c.notes && <p className="text-sm">{c.notes}</p>}
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
              {editing ? t.actions.edit : t.actions.addCertification}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label={f.certName} required>
              <Combobox
                value={form.name}
                onChange={(v) => set('name', v)}
                options={CERT_OPTIONS}
                placeholder="z.B. Elektrofachkraft"
              />
            </Field>
            <Field label={f.issuedBy}>
              <Input
                value={form.issuedBy}
                onChange={(e) => set('issuedBy', e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={f.issuedDate}>
                <Input
                  type="date"
                  value={form.issuedDate}
                  onChange={(e) => set('issuedDate', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={f.expiryDate}>
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => set('expiryDate', e.target.value)}
                  className="min-h-[44px]"
                />
                {form.expiryDate && (
                  <p className="text-xs">
                    <ExpiryDate value={form.expiryDate} />
                  </p>
                )}
              </Field>
            </div>
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
              disabled={saving || !form.name.trim()}
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
        onConfirm={confirmDelete}
      />
    </section>
  );
}
