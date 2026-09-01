/**
 * Projekt-Tab „Projektpläne“: versionierte DRAWING-Dokumente.
 * Pflege in Office; Kiosk sieht nur isLatest.
 */

'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Download,
  History,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { UploadDialog } from '@/components/documents/upload-dialog';
import { EmptyState } from '@/components/customers/empty-state';
import {
  documentsApi,
  isImage,
  isPdf,
  type Document,
  type DocumentDetail,
} from '@/lib/documents';
import { downloadDocument } from '@/lib/upload';
import { ApiError } from '@/lib/api-client';
import { formatDate, formatFileSize } from '@/lib/format';
import { texts } from '@/lib/texts';

/**
 * Aktuelle Projektpläne auflisten, hochladen, ersetzen und Historie einsehen.
 */
export function ProjectPlansTab({
  projectId,
}: {
  projectId: string;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.projects.plans;

  const [plans, setPlans] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [historyDoc, setHistoryDoc] = useState<DocumentDetail | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replacingId = useRef<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    documentsApi
      .list({
        entityType: 'PROJECT',
        entityId: projectId,
        documentType: 'DRAWING',
        limit: 100,
      })
      .then((res) => setPlans(res.data))
      .catch((err) =>
        toast({
          variant: 'destructive',
          description:
            err instanceof ApiError ? err.message : texts.projects.toast.error,
        }),
      )
      .finally(() => setLoading(false));
  }, [projectId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openPlan = (doc: Document): void => {
    if (isImage(doc.mimeType) || isPdf(doc.mimeType)) {
      void documentsApi.fileObjectUrl(doc.id).then((url) => {
        window.open(url, '_blank', 'noopener,noreferrer');
      });
      return;
    }
    downloadDocument(doc.id);
  };

  const startReplace = (id: string): void => {
    replacingId.current = id;
    replaceInput.current?.click();
  };

  const onReplaceFile = (file: File | undefined): void => {
    const id = replacingId.current;
    replacingId.current = null;
    if (!id || !file) return;
    documentsApi
      .replace(id, file, { uploadSource: 'web' })
      .then(() => {
        toast({ description: t.toastReplaced });
        load();
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description:
            err instanceof ApiError ? err.message : texts.projects.toast.error,
        }),
      );
  };

  const openHistory = (id: string): void => {
    documentsApi
      .get(id)
      .then(setHistoryDoc)
      .catch((err) =>
        toast({
          variant: 'destructive',
          description:
            err instanceof ApiError ? err.message : texts.projects.toast.error,
        }),
      );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t.title}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{t.hint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="min-h-[44px]"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" />
            {t.reload}
          </Button>
          <Button className="min-h-[44px]" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" />
            {t.upload}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          message={t.empty}
          actionLabel={t.upload}
          onAction={() => setUploadOpen(true)}
        />
      ) : (
        <ul className="divide-y rounded-lg border">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap"
            >
              <button
                type="button"
                onClick={() => openPlan(plan)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">
                    {plan.title || plan.originalFilename}
                  </span>
                  <Badge className="shrink-0">{t.badgeCurrent}</Badge>
                  <Badge variant="secondary" className="shrink-0">
                    {t.badgeRev.replace('{n}', String(plan.version))}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {plan.originalFilename} · {formatFileSize(plan.fileSize)} ·{' '}
                  {formatDate(plan.createdAt)}
                </p>
              </button>
              <div className="flex flex-wrap gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                  onClick={() => openPlan(plan)}
                >
                  <Download className="h-4 w-4" />
                  {t.open}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                  onClick={() => startReplace(plan.id)}
                >
                  <RefreshCw className="h-4 w-4" />
                  {t.newVersion}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px]"
                  onClick={() => openHistory(plan.id)}
                >
                  <History className="h-4 w-4" />
                  {t.history}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={replaceInput}
        type="file"
        accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          onReplaceFile(f);
        }}
      />

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        entityType="PROJECT"
        entityId={projectId}
        types={['DRAWING']}
        folders={[]}
        onUploaded={() => {
          toast({ description: t.toastUploaded });
          load();
        }}
      />

      <Dialog
        open={historyDoc !== null}
        onOpenChange={(open) => !open && setHistoryDoc(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.historyTitle}</DialogTitle>
          </DialogHeader>
          {historyDoc && (
            <div className="space-y-2">
              <HistoryRow
                doc={historyDoc}
                current
                currentLabel={t.badgeCurrent}
                revLabel={t.badgeRev}
                openLabel={t.open}
                onOpen={openPlan}
              />
              {historyDoc.previousVersions.map((v) => (
                <HistoryRow
                  key={v.id}
                  doc={v}
                  current={false}
                  currentLabel={t.badgeCurrent}
                  revLabel={t.badgeRev}
                  openLabel={t.open}
                  onOpen={openPlan}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HistoryRow({
  doc,
  current,
  currentLabel,
  revLabel,
  openLabel,
  onOpen,
}: {
  doc: Document;
  current: boolean;
  currentLabel: string;
  revLabel: string;
  openLabel: string;
  onOpen: (doc: Document) => void;
}): ReactNode {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border p-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {revLabel.replace('{n}', String(doc.version))}
          {current && (
            <Badge className="ml-2 text-[10px]">{currentLabel}</Badge>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {formatDate(doc.createdAt)} · {formatFileSize(doc.fileSize)} ·{' '}
          {doc.originalFilename}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="min-h-[44px] shrink-0"
        onClick={() => onOpen(doc)}
      >
        <Download className="h-4 w-4" />
        {openLabel}
      </Button>
    </div>
  );
}
