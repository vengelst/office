/**
 * Komponente: projects / tabs / work-items / templates-section (Office-Web).
 * Domänen-UI – ausführliche Handler-JSDocs nur bei nicht-trivialer Logik.
 */

'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';
import {
  workCardTemplatesApi,
  WORK_CARD_FIELD_TARGETS,
  FIELD_TARGET_LABELS,
  type CalibrateResponse,
  type WorkCardFieldMapping,
  type WorkCardFieldTarget,
  type WorkCardTemplate,
} from '@/lib/work-card-templates';
import {
  ZoneEditor,
  type ZoneAssignment,
} from './zone-editor';

const t = texts.projects.workItems.templates;

interface FieldRow extends WorkCardFieldMapping {
  _key: number;
}

let rowCounter = 0;

function emptyFieldRow(): FieldRow {
  return {
    _key: ++rowCounter,
    target: 'itemKey',
    labelHints: [],
    regex: undefined,
    captureLines: undefined,
    zone: undefined,
  };
}

/**
 * UI-Komponente `TemplatesSection`.
 */
export function TemplatesSection(): ReactNode {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<WorkCardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkCardTemplate | null>(null);

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [fields, setFields] = useState<FieldRow[]>([emptyFieldRow()]);
  const [saving, setSaving] = useState(false);

  // Calibrate state
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const calibrateFileRef = useRef<HTMLInputElement>(null);
  const [calibrateFile, setCalibrateFile] = useState<File | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrateResult, setCalibrateResult] = useState<CalibrateResponse | null>(null);
  const [drawnZones, setDrawnZones] = useState<ZoneAssignment[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    workCardTemplatesApi
      .list()
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const fail = (err: unknown) => {
    toast({
      variant: 'destructive',
      description: err instanceof ApiError ? err.message : 'Aktion fehlgeschlagen.',
    });
  };

  const openCreate = () => {
    setEditing(null);
    setName('');
    setNotes('');
    setFields([emptyFieldRow()]);
    setDialogOpen(true);
  };

  const openEdit = (tpl: WorkCardTemplate) => {
    setEditing(tpl);
    setName(tpl.name);
    setNotes(tpl.notes ?? '');
    setFields(
      tpl.fields.length > 0
        ? tpl.fields.map((f) => ({ ...f, labelHints: f.labelHints ?? [], _key: ++rowCounter }))
        : [emptyFieldRow()],
    );
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        fields: fields.map(({ _key, zone, ...rest }) => ({
          target: rest.target,
          labelHints: rest.labelHints?.length ? rest.labelHints : [],
          ...(rest.regex ? { regex: rest.regex } : {}),
          ...(rest.captureLines ? { captureLines: rest.captureLines } : {}),
          ...(zone ? { zone } : {}),
        })),
        notes: notes.trim() || undefined,
      };

      if (editing) {
        await workCardTemplatesApi.update(editing.id, payload);
        toast({ description: t.toastUpdated });
      } else {
        await workCardTemplatesApi.create(payload);
        toast({ description: t.toastCreated });
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.deleteConfirm)) return;
    try {
      await workCardTemplatesApi.remove(id);
      toast({ description: t.toastDeleted });
      load();
    } catch (err) {
      fail(err);
    }
  };

  const addField = () => setFields((prev) => [...prev, emptyFieldRow()]);

  const removeField = (key: number) =>
    setFields((prev) => prev.filter((f) => f._key !== key));

  const updateField = (key: number, patch: Partial<FieldRow>) =>
    setFields((prev) =>
      prev.map((f) => (f._key === key ? { ...f, ...patch } : f)),
    );

  const runCalibrate = async () => {
    if (!calibrateFile) return;
    setCalibrating(true);
    try {
      const res = await workCardTemplatesApi.calibrate(calibrateFile);
      setCalibrateResult(res);
      // Bestehende Zonen aus aktuellen Feldern vorbefüllen (falls Edit)
      const fromFields: ZoneAssignment[] = fields
        .filter((f) => f.zone)
        .map((f) => ({ target: f.target, zone: f.zone! }));
      setDrawnZones(fromFields);
    } catch (err) {
      fail(err);
    } finally {
      setCalibrating(false);
    }
  };

  const applySuggestions = () => {
    if (!calibrateResult) return;

    const byTarget = new Map<WorkCardFieldTarget, FieldRow>();

    for (const s of calibrateResult.suggestedFields) {
      const target = s.target as WorkCardFieldTarget;
      byTarget.set(target, {
        _key: ++rowCounter,
        target,
        labelHints: s.labelHints,
        regex: s.regex,
        captureLines: undefined,
        zone: undefined,
      });
    }

    // Bestehende Felder behalten, wenn kein Vorschlag – und Zonen mergen
    for (const f of fields) {
      if (!byTarget.has(f.target)) {
        byTarget.set(f.target, { ...f, _key: ++rowCounter });
      }
    }

    for (const z of drawnZones) {
      const existing = byTarget.get(z.target);
      if (existing) {
        byTarget.set(z.target, { ...existing, zone: z.zone });
      } else {
        byTarget.set(z.target, {
          _key: ++rowCounter,
          target: z.target,
          labelHints: [],
          zone: z.zone,
        });
      }
    }

    const newFields = Array.from(byTarget.values());
    if (newFields.length > 0) {
      setFields(newFields);
    }
    setCalibrateOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <FileText className="h-4 w-4" />
            {t.title}
          </h3>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button variant="outline" className="min-h-[44px]" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t.newTemplate}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Laden …</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <div className="space-y-2">
          {templates.map((tpl) => (
            <Card key={tpl.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{tpl.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {tpl.fields.length} Felder
                    {tpl.fields.some((f) => f.zone) ? ' · mit Zonen' : ''}
                    {tpl.customer ? ` · ${tpl.customer.companyName}` : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(tpl)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(tpl.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Anlegen/Bearbeiten-Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t.edit : t.newTemplate}</DialogTitle>
            <DialogDescription>{t.subtitle}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium">{t.name}</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.namePlaceholder}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium">{t.notes}</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.notesPlaceholder}
                rows={2}
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCalibrateOpen(true);
                setCalibrateFile(null);
                setCalibrateResult(null);
                setDrawnZones([]);
              }}
            >
              <Search className="h-4 w-4" />
              {t.calibrate}
            </Button>

            <div>
              <label className="mb-1 block text-xs font-medium">{t.fields}</label>
              <div className="space-y-2">
                {fields.map((row) => (
                  <div
                    key={row._key}
                    className="grid grid-cols-[1fr_1fr_1fr_60px_70px_32px] items-start gap-2 rounded-md border p-2"
                  >
                    <div>
                      <label className="mb-0.5 block text-[10px] text-muted-foreground">
                        {t.target}
                      </label>
                      <Select
                        value={row.target}
                        onValueChange={(v) =>
                          updateField(row._key, {
                            target: v as WorkCardFieldTarget,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WORK_CARD_FIELD_TARGETS.map((ft) => (
                            <SelectItem key={ft} value={ft}>
                              {FIELD_TARGET_LABELS[ft]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] text-muted-foreground">
                        {t.labelHints}
                      </label>
                      <Input
                        value={row.labelHints.join(', ')}
                        onChange={(e) =>
                          updateField(row._key, {
                            labelHints: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder={t.labelHintsPlaceholder}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] text-muted-foreground">
                        {t.regex}
                      </label>
                      <Input
                        value={row.regex ?? ''}
                        onChange={(e) =>
                          updateField(row._key, {
                            regex: e.target.value || undefined,
                          })
                        }
                        placeholder={t.regexPlaceholder}
                        className="h-8 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] text-muted-foreground">
                        {t.captureLines}
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={row.captureLines ?? ''}
                        onChange={(e) =>
                          updateField(row._key, {
                            captureLines: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] text-muted-foreground">
                        {t.zone}
                      </label>
                      {row.zone ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-full px-1 text-[10px]"
                          onClick={() =>
                            updateField(row._key, { zone: undefined })
                          }
                          title={t.zoneClearField}
                        >
                          {t.zoneSet}
                        </Button>
                      ) : (
                        <span className="flex h-8 items-center text-[10px] text-muted-foreground">
                          —
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-4 h-8 w-8 p-0"
                      onClick={() => removeField(row._key)}
                      disabled={fields.length <= 1}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={addField}
              >
                <Plus className="h-3 w-3" />
                {t.addField}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              {t.cancel}
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? t.saving : t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kalibrieren-Dialog inkl. Zone-Editor */}
      <Dialog open={calibrateOpen} onOpenChange={setCalibrateOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.calibrateTitle}</DialogTitle>
            <DialogDescription>{t.calibrateSubtitle}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <input
              ref={calibrateFileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                setCalibrateFile(e.target.files?.[0] ?? null);
                setCalibrateResult(null);
                setDrawnZones([]);
              }}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => calibrateFileRef.current?.click()}
              >
                <FileText className="h-4 w-4" />
                {t.calibrateChooseFile}
              </Button>
              <Button
                disabled={!calibrateFile || calibrating}
                onClick={runCalibrate}
              >
                <Search className="h-4 w-4" />
                {calibrating ? t.calibrateRunning : t.calibrateRun}
              </Button>
            </div>
            {calibrateFile && (
              <p className="font-mono text-xs">{calibrateFile.name}</p>
            )}

            {calibrateResult && (
              <>
                {calibrateResult.pageImageDataUrl && (
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      {t.zoneEditorTitle}
                    </label>
                    <ZoneEditor
                      imageSrc={calibrateResult.pageImageDataUrl}
                      zones={drawnZones}
                      onChange={setDrawnZones}
                      labels={{
                        drawHint: t.zoneDrawHint,
                        activeField: t.zoneActiveField,
                        clearZone: t.zoneRemove,
                        zonesList: t.zonesList,
                      }}
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium">
                    {t.calibrateOcrText}
                  </label>
                  <pre className="max-h-40 overflow-auto rounded-md border bg-muted p-3 text-xs">
                    {calibrateResult.text || '(leer)'}
                  </pre>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium">
                    {t.calibrateSuggestions}
                  </label>
                  {calibrateResult.suggestedFields.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t.calibrateNoSuggestions}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {calibrateResult.suggestedFields.map((s, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 rounded-md border p-2 text-xs"
                        >
                          <span className="font-medium">
                            {FIELD_TARGET_LABELS[s.target as WorkCardFieldTarget] ??
                              s.target}
                          </span>
                          <span className="text-muted-foreground">
                            Labels: {s.labelHints.join(', ')}
                          </span>
                          {s.regex && (
                            <span className="font-mono text-muted-foreground">
                              /{s.regex}/
                            </span>
                          )}
                          {s.sampleValue && (
                            <span className="rounded bg-green-100 px-1.5 dark:bg-green-900">
                              {s.sampleValue}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {(calibrateResult.suggestedFields.length > 0 ||
                  drawnZones.length > 0) && (
                  <Button onClick={applySuggestions}>
                    {t.calibrateApply}
                  </Button>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
