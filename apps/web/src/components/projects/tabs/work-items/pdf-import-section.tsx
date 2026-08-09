'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, FileText, Play, ScanSearch, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import { formatFileSize } from '@/lib/format';
import { texts } from '@/lib/texts';
import {
  MAX_PDF_IMPORT_BYTES,
  PDF_IMPORT_OCR_CHUNK_SIZE,
  workItemsApi,
  type PdfCommitResponse,
  type PdfPreviewItem,
  type PdfPreviewResponse,
} from '@/lib/work-items';
import {
  workCardTemplatesApi,
  type WorkCardTemplate,
} from '@/lib/work-card-templates';

const PREVIEW_TIMEOUT_MS = 120_000;
/** Timeout pro OCR-Chunk (nicht für das gesamte PDF). */
const OCR_CHUNK_TIMEOUT_MS = 180_000;
const NONE = 'none';

/**
 * PDF-Primärimport: Mehrseiten-PDF → 1 Seite = 1 Arbeitsauftrag (Item).
 *
 * Flow:
 * 1. PDF + Block → schnelle Vorschau (ohne OCR) → Kennungen editieren → Import
 * 2. Optional: Template wählen → „OCR vorausfüllen“ in Chunks mit Fortschritt
 */
export function PdfImportSection({
  projectId,
  onImported,
}: {
  projectId: string;
  onImported: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.projects.workItems.pdfImport;

  const fileInput = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [blockKey, setBlockKey] = useState('');
  const [blockName, setBlockName] = useState('');
  const [prefix, setPrefix] = useState('Seite-');
  const [busy, setBusy] = useState<'preview' | 'ocr' | 'commit' | null>(null);
  const [preview, setPreview] = useState<PdfPreviewResponse | null>(null);
  const [editItems, setEditItems] = useState<PdfPreviewItem[]>([]);
  const [commitResult, setCommitResult] = useState<PdfCommitResponse | null>(null);
  const [templates, setTemplates] = useState<WorkCardTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string>(NONE);
  const [ocrProgress, setOcrProgress] = useState<{
    done: number;
    total: number;
    failed: number;
  } | null>(null);

  useEffect(() => {
    workCardTemplatesApi.list().then(setTemplates).catch(() => {});
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const resolvedTemplateId =
    templateId && templateId !== NONE ? templateId : undefined;

  const fail = (err: unknown): void => {
    if (err instanceof DOMException && err.name === 'AbortError') {
      toast({
        variant: 'destructive',
        description: t.toastAborted,
      });
      return;
    }
    toast({
      variant: 'destructive',
      description:
        err instanceof ApiError ? err.message : texts.projects.toast.error,
    });
  };

  const assertFileSize = (f: File): boolean => {
    if (f.size > MAX_PDF_IMPORT_BYTES) {
      toast({
        variant: 'destructive',
        description: t.fileTooLarge((f.size / 1024 / 1024).toFixed(1)),
      });
      return false;
    }
    return true;
  };

  const clear = (): void => {
    abortRef.current?.abort();
    abortRef.current = null;
    setFile(null);
    setBlockKey('');
    setBlockName('');
    setPrefix('Seite-');
    setPreview(null);
    setEditItems([]);
    setCommitResult(null);
    setTemplateId(NONE);
    setBusy(null);
    setOcrProgress(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  const previewOptions = (
    extract: boolean,
    range?: { startPage: number; endPage: number },
  ) => ({
    blockKey: blockKey.trim(),
    blockName: blockName.trim() || undefined,
    itemKeyPrefix: prefix || undefined,
    templateId: resolvedTemplateId,
    extract,
    startPage: range?.startPage,
    endPage: range?.endPage,
  });

  /** Schnelle Vorschau ohne OCR – Import ist danach sofort möglich. */
  const runPreview = (): void => {
    if (!file || !blockKey.trim()) return;
    if (!assertFileSize(file)) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy('preview');
    setOcrProgress(null);

    const timeoutId = setTimeout(() => ac.abort(), PREVIEW_TIMEOUT_MS);

    workItemsApi
      .previewPdfImport(projectId, file, previewOptions(false), {
        signal: ac.signal,
      })
      .then((result) => {
        setPreview(result);
        setEditItems(result.items.map((i) => ({ ...i })));
        setCommitResult(null);
        toast({ description: t.toastPreviewDone });
      })
      .catch(fail)
      .finally(() => {
        clearTimeout(timeoutId);
        if (abortRef.current === ac) abortRef.current = null;
        setBusy(null);
      });
  };

  /**
   * OCR mit gewähltem Template – chunkweise (Option A), Fortschritt Seite X von N.
   * Einzelseiten-Fehler (Server) brechen den Rest nicht ab.
   */
  const runOcrFill = async (): Promise<void> => {
    if (!file || !blockKey.trim() || !resolvedTemplateId) return;
    if (!assertFileSize(file)) return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy('ocr');
    setCommitResult(null);

    try {
      // Seitezahl aus bestehender Vorschau oder schnellem Preview ohne OCR
      let pageCount = preview?.pageCount ?? 0;
      let baseItems = editItems;

      if (pageCount === 0 || baseItems.length === 0) {
        const base = await workItemsApi.previewPdfImport(
          projectId,
          file,
          previewOptions(false),
          { signal: ac.signal },
        );
        pageCount = base.pageCount;
        baseItems = base.items.map((i) => ({ ...i }));
        setPreview(base);
        setEditItems(baseItems);
      }

      const total = pageCount;
      const chunk = PDF_IMPORT_OCR_CHUNK_SIZE;
      const merged = new Map<number, PdfPreviewItem>();
      for (const item of baseItems) {
        merged.set(item.pdfPage, { ...item });
      }

      const allWarnings: string[] = [];
      let failedPages = 0;
      let processed = 0;

      setOcrProgress({ done: 0, total, failed: 0 });

      for (let start = 1; start <= total; start += chunk) {
        if (ac.signal.aborted) throw new DOMException('Aborted', 'AbortError');

        const end = Math.min(start + chunk - 1, total);
        const chunkTimeout = setTimeout(() => ac.abort(), OCR_CHUNK_TIMEOUT_MS);

        try {
          const result = await workItemsApi.previewPdfImport(
            projectId,
            file,
            previewOptions(true, { startPage: start, endPage: end }),
            { signal: ac.signal },
          );

          for (const item of result.items) {
            merged.set(item.pdfPage, { ...item });
            if (item.ocrWarnings?.some((w) => w.startsWith('OCR-Fehler'))) {
              failedPages++;
            }
          }
          allWarnings.push(...result.warnings);
          processed = end;
          setOcrProgress({ done: processed, total, failed: failedPages });

          const nextItems = Array.from(merged.values()).sort(
            (a, b) => a.pdfPage - b.pdfPage,
          );
          setEditItems(nextItems);
          setPreview({
            pageCount: total,
            blockKey: blockKey.trim(),
            items: nextItems,
            warnings: [...new Set(allWarnings)],
            rangeStart: 1,
            rangeEnd: processed,
          });
        } finally {
          clearTimeout(chunkTimeout);
        }
      }

      if (failedPages > 0) {
        toast({ description: t.toastOcrPartial });
      } else {
        toast({ description: t.toastOcrDone });
      }
    } catch (err) {
      fail(err);
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      setBusy(null);
    }
  };

  const runCommit = (): void => {
    if (!file || editItems.length === 0) return;
    if (!assertFileSize(file)) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy('commit');

    const timeoutId = setTimeout(() => ac.abort(), PREVIEW_TIMEOUT_MS);

    workItemsApi
      .runPdfImport(
        projectId,
        file,
        {
          blockKey: blockKey.trim(),
          blockName: blockName.trim() || undefined,
          items: editItems.map((i) => ({
            pdfPage: i.pdfPage,
            itemKey: i.itemKey,
            title: i.title || undefined,
            workScopeDe: i.workScopeDe || undefined,
            workScopeSk: i.workScopeSk || undefined,
            floor: i.floor || undefined,
            room: i.room || undefined,
          })),
        },
        { signal: ac.signal },
      )
      .then((result) => {
        setCommitResult(result);
        toast({ description: t.toastCommitDone });
        onImported();
      })
      .catch(fail)
      .finally(() => {
        clearTimeout(timeoutId);
        if (abortRef.current === ac) abortRef.current = null;
        setBusy(null);
      });
  };

  const updateItem = (
    index: number,
    field: keyof PdfPreviewItem,
    value: string,
  ): void => {
    setEditItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const hasOcrData = editItems.some(
    (i) => i.floor || i.room || (i.ocrWarnings && i.ocrWarnings.length > 0),
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <FileText className="h-4 w-4" />
          {t.title}
        </h3>
        <p className="max-w-2xl text-sm text-muted-foreground">{t.subtitle}</p>
        <p className="text-xs text-muted-foreground">{t.hint}</p>
        <p className="text-xs text-muted-foreground">{t.flowHint}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium">{t.blockKey}</label>
          <Input
            value={blockKey}
            onChange={(e) => setBlockKey(e.target.value)}
            placeholder={t.blockKeyPlaceholder}
            className="min-h-[44px]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{t.blockName}</label>
          <Input
            value={blockName}
            onChange={(e) => setBlockName(e.target.value)}
            placeholder={t.blockNamePlaceholder}
            className="min-h-[44px]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{t.prefix}</label>
          <Input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder={t.prefixPlaceholder}
            className="min-h-[44px]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{t.template}</label>
          <Select value={templateId || NONE} onValueChange={setTemplateId}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder={t.templateNone} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t.templateNone}</SelectItem>
              {templates.map((tpl) => (
                <SelectItem key={tpl.id} value={tpl.id}>
                  {tpl.name}
                  {tpl.customer ? ` (${tpl.customer.companyName})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{t.templateHint}</p>
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f && f.size > MAX_PDF_IMPORT_BYTES) {
            toast({
              variant: 'destructive',
              description: t.fileTooLarge((f.size / 1024 / 1024).toFixed(1)),
            });
            if (fileInput.current) fileInput.current.value = '';
            return;
          }
          setFile(f);
          setPreview(null);
          setEditItems([]);
          setCommitResult(null);
          setOcrProgress(null);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          className="min-h-[44px]"
          onClick={() => fileInput.current?.click()}
          disabled={busy !== null}
        >
          <FileText className="h-4 w-4" />
          {t.chooseFile}
        </Button>
        <Button
          variant="outline"
          className="min-h-[44px]"
          disabled={!file || !blockKey.trim() || busy !== null}
          onClick={runPreview}
        >
          <Search className="h-4 w-4" />
          {busy === 'preview' ? t.previewing : t.preview}
        </Button>
        <Button
          variant="outline"
          className="min-h-[44px]"
          disabled={
            !file ||
            !blockKey.trim() ||
            !resolvedTemplateId ||
            busy !== null
          }
          onClick={() => void runOcrFill()}
          title={t.ocrButtonHint}
        >
          <ScanSearch className="h-4 w-4" />
          {busy === 'ocr'
            ? ocrProgress
              ? t.ocrProgress(ocrProgress.done, ocrProgress.total)
              : t.ocrLoading
            : t.ocrFill}
        </Button>
        <Button
          className="min-h-[44px]"
          disabled={editItems.length === 0 || busy !== null}
          onClick={runCommit}
        >
          <Play className="h-4 w-4" />
          {busy === 'commit' ? t.committing : t.commit}
        </Button>
        {(file || preview) && (
          <Button
            variant="ghost"
            className="min-h-[44px]"
            onClick={clear}
            disabled={busy !== null}
          >
            <X className="h-4 w-4" />
            {t.clear}
          </Button>
        )}
      </div>

      {busy === 'ocr' && ocrProgress && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t.ocrProgress(ocrProgress.done, ocrProgress.total)}</span>
            {ocrProgress.failed > 0 && (
              <span className="text-orange-600 dark:text-orange-400">
                {t.ocrProgressFailed(ocrProgress.failed)}
              </span>
            )}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${Math.round((ocrProgress.done / Math.max(ocrProgress.total, 1)) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {!file ? (
        <p className="text-sm text-muted-foreground">{t.noFile}</p>
      ) : (
        <p className="font-mono text-xs">
          {file.name} · {formatFileSize(file.size)}
        </p>
      )}

      {editItems.length > 0 && !commitResult && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-medium">{t.resultPreview}</p>
              {preview && (
                <span className="text-xs text-muted-foreground">
                  {t.pageCount}: {preview.pageCount} · {editItems.length}{' '}
                  {t.itemsReady}
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2 text-xs font-medium">{t.colPage}</th>
                    <th className="p-2 text-xs font-medium">{t.colKey}</th>
                    <th className="p-2 text-xs font-medium">{t.colTitle}</th>
                    <th className="p-2 text-xs font-medium">{t.colWorkScope}</th>
                    {hasOcrData && (
                      <>
                        <th className="p-2 text-xs font-medium">{t.colFloor}</th>
                        <th className="p-2 text-xs font-medium">{t.colRoom}</th>
                      </>
                    )}
                    <th className="p-2 text-xs font-medium">{t.colWarnings}</th>
                  </tr>
                </thead>
                <tbody>
                  {editItems.map((item, idx) => (
                    <tr key={item.pdfPage} className="border-b last:border-0">
                      <td className="p-2 tabular-nums">{item.pdfPage}</td>
                      <td className="p-2">
                        <Input
                          value={item.itemKey}
                          onChange={(e) =>
                            updateItem(idx, 'itemKey', e.target.value)
                          }
                          className="h-8 min-w-[120px] font-mono text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={item.title}
                          onChange={(e) =>
                            updateItem(idx, 'title', e.target.value)
                          }
                          className="h-8 min-w-[150px] text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={item.workScopeDe ?? ''}
                          onChange={(e) =>
                            updateItem(idx, 'workScopeDe', e.target.value)
                          }
                          className="h-8 min-w-[200px] text-xs"
                        />
                      </td>
                      {hasOcrData && (
                        <>
                          <td className="p-2">
                            <Input
                              value={item.floor ?? ''}
                              onChange={(e) =>
                                updateItem(idx, 'floor', e.target.value)
                              }
                              className="h-8 min-w-[80px] text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={item.room ?? ''}
                              onChange={(e) =>
                                updateItem(idx, 'room', e.target.value)
                              }
                              className="h-8 min-w-[100px] text-xs"
                            />
                          </td>
                        </>
                      )}
                      <td className="p-2">
                        {item.conflicts.length > 0 && (
                          <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-500">
                            <AlertTriangle className="h-3 w-3" />
                            {item.conflicts[0]}
                          </span>
                        )}
                        {item.ocrWarnings && item.ocrWarnings.length > 0 && (
                          <span className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                            <AlertTriangle className="h-3 w-3" />
                            {item.ocrWarnings[0]}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview && preview.warnings.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">{t.warnings}</p>
                <ul className="space-y-1">
                  {preview.warnings.map((w, i) => (
                    <li
                      key={`${i}-${w}`}
                      className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-500"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {commitResult && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="font-medium">{t.resultDone}</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{t.itemsCreated}</p>
                <p className="text-lg font-semibold tabular-nums">
                  {commitResult.itemsCreated}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{t.itemsUpdated}</p>
                <p className="text-lg font-semibold tabular-nums">
                  {commitResult.itemsUpdated}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
