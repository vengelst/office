'use client';

import { useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, FileSpreadsheet, Play, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import { formatFileSize } from '@/lib/format';
import { texts } from '@/lib/texts';
import { workItemsApi, type WorkItemImportSummary } from '@/lib/work-items';

const ACCEPT = '.xlsx,.xlsm,.csv,.txt';

/** Eine Kennzahl der Import-Zusammenfassung. */
function Metric({ label, value }: { label: string; value: number }): ReactNode {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/**
 * Excel-/CSV-Import der Items und Materialzeilen: Dateien wählen, Vorschau
 * prüfen (schreibt nichts) und Import ausführen.
 */
export function ImportSection({
  projectId,
  onImported,
}: {
  projectId: string;
  onImported: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.projects.workItems;

  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<'preview' | 'import' | null>(null);
  const [summary, setSummary] = useState<WorkItemImportSummary | null>(null);

  const fail = (err: unknown): void => {
    toast({
      variant: 'destructive',
      description:
        err instanceof ApiError ? err.message : texts.projects.toast.error,
    });
  };

  const clear = (): void => {
    setFiles([]);
    setSummary(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  const run = (mode: 'preview' | 'import'): void => {
    if (files.length === 0) return;
    setBusy(mode);
    const req =
      mode === 'preview'
        ? workItemsApi.previewImport(projectId, files)
        : workItemsApi.runImport(projectId, files);
    req
      .then((result) => {
        setSummary(result);
        toast({
          description:
            mode === 'preview' ? t.toast.previewDone : t.toast.importDone,
        });
        if (mode === 'import') onImported();
      })
      .catch(fail)
      .finally(() => setBusy(null));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <FileSpreadsheet className="h-4 w-4" />
          {t.import.title}
        </h3>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t.import.subtitle}
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-500">
          {t.import.fallbackHint}
        </p>
        <p className="text-xs text-muted-foreground">{t.import.templateHint}</p>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          setFiles(Array.from(e.target.files ?? []));
          setSummary(null);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          className="min-h-[44px]"
          onClick={() => fileInput.current?.click()}
        >
          <FileSpreadsheet className="h-4 w-4" />
          {t.import.chooseFiles}
        </Button>
        <Button
          variant="outline"
          className="min-h-[44px]"
          disabled={files.length === 0 || busy !== null}
          onClick={() => run('preview')}
        >
          <Search className="h-4 w-4" />
          {busy === 'preview' ? t.import.previewing : t.import.preview}
        </Button>
        <Button
          className="min-h-[44px]"
          disabled={files.length === 0 || busy !== null}
          onClick={() => run('import')}
        >
          <Play className="h-4 w-4" />
          {busy === 'import' ? t.import.running : t.import.run}
        </Button>
        {files.length > 0 && (
          <Button variant="ghost" className="min-h-[44px]" onClick={clear}>
            <X className="h-4 w-4" />
            {t.import.clear}
          </Button>
        )}
      </div>

      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.import.noFiles}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {files.map((file) => (
            <li key={file.name} className="font-mono text-xs">
              {file.name} · {formatFileSize(file.size)}
            </li>
          ))}
        </ul>
      )}

      {summary && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">
                {summary.dryRun ? t.import.resultPreview : t.import.resultDone}
              </p>
              {summary.sources.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t.import.sources}: {summary.sources.join(', ')}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
              <Metric label={t.import.itemsCreated} value={summary.itemsCreated} />
              <Metric label={t.import.itemsUpdated} value={summary.itemsUpdated} />
              <Metric label={t.import.blocksCreated} value={summary.blocksCreated} />
              <Metric
                label={t.import.materialLines}
                value={summary.materialLinesImported}
              />
              <Metric
                label={t.import.materialsReplaced}
                value={summary.itemsWithMaterialsReplaced}
              />
              <Metric label={t.import.orphanRows} value={summary.orphanMaterialRows} />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium">{t.import.warnings}</p>
              {summary.warnings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t.import.noWarnings}
                </p>
              ) : (
                <ul className="space-y-1">
                  {summary.warnings.map((warning, index) => (
                    <li
                      key={`${index}-${warning}`}
                      className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-500"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
