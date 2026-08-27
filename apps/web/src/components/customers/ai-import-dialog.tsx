/**
 * Dialog: KI-Import für Interessenten/Kontakte (Preview → editierbar → Commit).
 */

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, Sparkles, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import {
  aiImportApi,
  aiSettingsApi,
  type AiImportPreview,
  type ImportMode,
} from '@/lib/ai-import';
import { texts } from '@/lib/texts';

const ACCEPT = '.pdf,.xlsx,.xlsm,.xls,.csv,.txt,.md';

export function AiImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): ReactNode {
  const t = texts.customers.aiImport;
  const { toast } = useToast();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [hint, setHint] = useState('');
  const [enrichBranches, setEnrichBranches] = useState(true);
  const [busy, setBusy] = useState<'preview' | 'commit' | null>(null);
  const [preview, setPreview] = useState<AiImportPreview | null>(null);
  const [mode, setMode] = useState<ImportMode>('ONE_CUSTOMER_MANY_CONTACTS');
  const [attachToCustomerId, setAttachToCustomerId] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    aiSettingsApi
      .get()
      .then((cfg) => setAiReady(cfg.enabled && cfg.apiKeyConfigured))
      .catch(() => setAiReady(false));
  }, [open]);

  const reset = (): void => {
    setFile(null);
    setHint('');
    setEnrichBranches(true);
    setBusy(null);
    setPreview(null);
    setMode('ONE_CUSTOMER_MANY_CONTACTS');
    setAttachToCustomerId('');
    if (fileInput.current) fileInput.current.value = '';
  };

  const handleClose = (next: boolean): void => {
    if (!next) reset();
    onOpenChange(next);
  };

  const runPreview = async (): Promise<void> => {
    if (!file) return;
    setBusy('preview');
    try {
      const result = await aiImportApi.preview({
        file,
        hint,
        enrichBranches,
      });
      setPreview(result);
      setMode(result.suggestedMode);
      setAttachToCustomerId('');
      toast({ description: t.toast.previewDone });
    } catch (err) {
      toast({
        variant: 'destructive',
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setBusy(null);
    }
  };

  const runCommit = async (): Promise<void> => {
    if (!preview) return;
    setBusy('commit');
    try {
      const result = await aiImportApi.commit({
        previewId: preview.previewId,
        mode,
        suggestedMode: preview.suggestedMode,
        attachToCustomerId: attachToCustomerId || undefined,
        sourceFilename: preview.sourceFilename,
        customerDraft: preview.customerDraft,
        branches: preview.branches,
        contacts: preview.contacts,
        companyEmails: preview.companyEmails,
        warnings: preview.warnings,
      });
      toast({
        description: `${t.toast.commitDone} ${result.customerNumber} · ${result.createdContacts} Kontakte, ${result.createdBranches} NL`,
      });
      handleClose(false);
      router.push(`/customers/${result.customerId}`);
    } catch (err) {
      toast({
        variant: 'destructive',
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setBusy(null);
    }
  };

  const updateBranch = (
    key: string,
    patch: Partial<AiImportPreview['branches'][0]>,
  ): void => {
    setPreview((p) =>
      p
        ? {
            ...p,
            branches: p.branches.map((b) =>
              b.key === key ? { ...b, ...patch } : b,
            ),
          }
        : p,
    );
  };

  const updateContact = (
    index: number,
    patch: Partial<AiImportPreview['contacts'][0]>,
  ): void => {
    setPreview((p) => {
      if (!p) return p;
      const contacts = [...p.contacts];
      contacts[index] = { ...contacts[index], ...patch };
      return { ...p, contacts };
    });
  };

  const updateCompany = (
    patch: Partial<NonNullable<AiImportPreview['customerDraft']>>,
  ): void => {
    setPreview((p) =>
      p
        ? {
            ...p,
            customerDraft: {
              companyName: p.customerDraft?.companyName || '',
              ...p.customerDraft,
              ...patch,
            },
          }
        : p,
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {t.title}
          </DialogTitle>
        </DialogHeader>

        {aiReady === false && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:bg-amber-950/30">
            <p>{t.disabled}</p>
            <Button asChild variant="outline" className="mt-3 min-h-[44px]">
              <Link href="/settings/ai">{t.openSettings}</Link>
            </Button>
          </div>
        )}

        {aiReady && !preview && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>

            <div className="space-y-1.5">
              <Label>{t.hint}</Label>
              <Input
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder={t.hintPlaceholder}
                className="min-h-[44px]"
              />
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={enrichBranches}
                onChange={(e) => setEnrichBranches(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="font-medium">{t.enrichBranches}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t.enrichHint}
                </span>
              </span>
            </label>

            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => fileInput.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {t.chooseFile}
              </Button>
              {file && (
                <span className="text-sm text-muted-foreground">
                  {file.name} ({Math.round(file.size / 1024)} KB)
                </span>
              )}
            </div>
          </div>
        )}

        {aiReady && preview && (
          <div className="space-y-6">
            {preview.warnings.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
                <p className="mb-1 flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  {t.warnings}
                </p>
                <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                  {preview.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t.mode}</Label>
                <Select
                  value={mode}
                  onValueChange={(v) => setMode(v as ImportMode)}
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONE_CUSTOMER_MANY_CONTACTS">
                      {t.modeOneCustomer}
                    </SelectItem>
                    <SelectItem value="ONE_ROW_ONE_CUSTOMER">
                      {t.modeOneRow}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {preview.existingCustomerMatches &&
                preview.existingCustomerMatches.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>{t.attachExisting}</Label>
                    <Select
                      value={attachToCustomerId || '__new__'}
                      onValueChange={(v) =>
                        setAttachToCustomerId(v === '__new__' ? '' : v)
                      }
                    >
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__new__">{t.createNew}</SelectItem>
                        {preview.existingCustomerMatches.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.customerNumber} · {c.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
            </div>

            {mode === 'ONE_CUSTOMER_MANY_CONTACTS' && (
              <div className="space-y-3 rounded-md border p-4">
                <h3 className="text-sm font-medium">{t.company}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>{texts.customers.fields.companyName}</Label>
                    <Input
                      className="min-h-[40px]"
                      value={preview.customerDraft?.companyName || ''}
                      onChange={(e) =>
                        updateCompany({ companyName: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{texts.customers.fields.website}</Label>
                    <Input
                      className="min-h-[40px]"
                      value={preview.customerDraft?.website || ''}
                      onChange={(e) =>
                        updateCompany({ website: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{texts.customers.fields.industry}</Label>
                    <Input
                      className="min-h-[40px]"
                      value={preview.customerDraft?.industry || ''}
                      onChange={(e) =>
                        updateCompany({ industry: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{texts.customers.fields.rating}</Label>
                    <Input
                      className="min-h-[40px]"
                      value={preview.customerDraft?.rating || ''}
                      onChange={(e) =>
                        updateCompany({ rating: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-sm font-medium">
                {t.branches} ({preview.branches.filter((b) => b.include).length}/
                {preview.branches.length})
              </h3>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">{t.columns.include}</TableHead>
                      <TableHead>{t.columns.name}</TableHead>
                      <TableHead>{t.columns.address}</TableHead>
                      <TableHead>{t.columns.postalCode}</TableHead>
                      <TableHead>{t.columns.city}</TableHead>
                      <TableHead>{t.columns.phone}</TableHead>
                      <TableHead>{t.columns.status}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.branches.map((b) => (
                      <TableRow key={b.key}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={b.include}
                            onChange={(e) =>
                              updateBranch(b.key, {
                                include: e.target.checked,
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="min-h-[36px] min-w-[140px]"
                            value={b.name}
                            onChange={(e) =>
                              updateBranch(b.key, { name: e.target.value })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="min-h-[36px] min-w-[140px]"
                            value={b.addressLine1 || ''}
                            onChange={(e) =>
                              updateBranch(b.key, {
                                addressLine1: e.target.value,
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="min-h-[36px] w-20"
                            value={b.postalCode || ''}
                            onChange={(e) =>
                              updateBranch(b.key, {
                                postalCode: e.target.value,
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="min-h-[36px] w-28"
                            value={b.city || ''}
                            onChange={(e) =>
                              updateBranch(b.key, { city: e.target.value })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="min-h-[36px] w-32"
                            value={b.phone || ''}
                            onChange={(e) =>
                              updateBranch(b.key, { phone: e.target.value })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {t.enrichment[b.enrichmentStatus]}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">
                {t.contacts} ({preview.contacts.filter((c) => c.include).length}/
                {preview.contacts.length})
              </h3>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">{t.columns.include}</TableHead>
                      <TableHead>{t.columns.firstName}</TableHead>
                      <TableHead>{t.columns.lastName}</TableHead>
                      <TableHead>{t.columns.role}</TableHead>
                      <TableHead>{t.columns.email}</TableHead>
                      <TableHead>{t.columns.branch}</TableHead>
                      <TableHead>{t.columns.priority}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.contacts.map((c, i) => (
                      <TableRow key={`${c.email || ''}-${i}`}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={c.include}
                            onChange={(e) =>
                              updateContact(i, { include: e.target.checked })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="min-h-[36px] w-28"
                            value={c.firstName}
                            onChange={(e) =>
                              updateContact(i, { firstName: e.target.value })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="min-h-[36px] w-28"
                            value={c.lastName}
                            onChange={(e) =>
                              updateContact(i, { lastName: e.target.value })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="min-h-[36px] min-w-[120px]"
                            value={c.role || ''}
                            onChange={(e) =>
                              updateContact(i, { role: e.target.value })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="min-h-[36px] min-w-[160px]"
                            value={c.email || ''}
                            onChange={(e) =>
                              updateContact(i, { email: e.target.value })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={c.branchKey || '__none__'}
                            onValueChange={(v) =>
                              updateContact(i, {
                                branchKey: v === '__none__' ? undefined : v,
                              })
                            }
                          >
                            <SelectTrigger className="min-h-[36px] min-w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">—</SelectItem>
                              {preview.branches.map((b) => (
                                <SelectItem key={b.key} value={b.key}>
                                  {b.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            className="min-h-[36px] w-12"
                            value={c.priority || ''}
                            onChange={(e) =>
                              updateContact(i, {
                                priority: e.target.value as 'A' | 'B' | 'C',
                              })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {(preview.companyEmails?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">{t.companyEmails}</h3>
                <ul className="space-y-1 text-sm">
                  {preview.companyEmails!.map((e, i) => (
                    <li key={`${e.email}-${i}`} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={e.include}
                        onChange={(ev) =>
                          setPreview((p) => {
                            if (!p?.companyEmails) return p;
                            const companyEmails = [...p.companyEmails];
                            companyEmails[i] = {
                              ...companyEmails[i],
                              include: ev.target.checked,
                            };
                            return { ...p, companyEmails };
                          })
                        }
                      />
                      <span>
                        {e.email}
                        {e.label ? ` (${e.label})` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            className="min-h-[44px]"
            onClick={() => handleClose(false)}
            disabled={busy !== null}
          >
            {texts.customers.actions.cancel}
          </Button>
          {aiReady && !preview && (
            <Button
              className="min-h-[44px]"
              disabled={!file || busy !== null}
              onClick={runPreview}
            >
              {busy === 'preview' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.analyzing}
                </>
              ) : (
                t.title
              )}
            </Button>
          )}
          {aiReady && preview && (
            <>
              <Button
                variant="outline"
                className="min-h-[44px]"
                disabled={busy !== null}
                onClick={() => setPreview(null)}
              >
                Zurück
              </Button>
              <Button
                className="min-h-[44px]"
                disabled={busy !== null}
                onClick={runCommit}
              >
                {busy === 'commit' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.committing}
                  </>
                ) : (
                  t.commit
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
