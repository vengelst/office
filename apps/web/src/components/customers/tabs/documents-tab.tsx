'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Download, FileText, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import { documentsApi, type DocumentItem } from '@/lib/customers';
import { downloadDocument, uploadDocument } from '@/lib/upload';
import { ApiError, TOKEN_STORAGE_KEY } from '@/lib/api-client';
import { formatDate, formatFileSize } from '@/lib/format';
import { texts } from '@/lib/texts';

const DOC_TYPES = [
  'BUSINESS_CARD',
  'CONTRACT',
  'LOGO',
  'CERTIFICATE',
  'NOTE_DOCUMENT',
  'OTHER',
] as const;
const ALL = '__all__';
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

export function DocumentsTab({
  entityId,
  entityType = 'CUSTOMER',
}: {
  entityId: string;
  entityType?: string;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.customers;
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>(ALL);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>('OTHER');
  const [dragActive, setDragActive] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    documentsApi
      .listByEntity(entityType, entityId)
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load]);

  const typeLabel = (type: string): string =>
    t.documentTypes[type as keyof typeof t.documentTypes] ?? type;

  const filtered =
    filter === ALL ? docs : docs.filter((d) => d.documentType === filter);

  const pickFile = (file: File): void => {
    setPendingFile(file);
    setDocType('OTHER');
    setUploadOpen(true);
  };

  const doUpload = (): void => {
    if (!pendingFile) return;
    setUploading(true);
    uploadDocument({
      file: pendingFile,
      documentType: docType,
      entityType,
      entityId,
    })
      .then(() => {
        toast({ description: t.toast.uploaded });
        setUploadOpen(false);
        setPendingFile(null);
        load();
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      )
      .finally(() => setUploading(false));
  };

  const confirmDelete = (): void => {
    if (!deleteId) return;
    documentsApi
      .remove(deleteId)
      .then(() => {
        toast({ description: t.toast.itemDeleted });
        load();
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }))
      .finally(() => setDeleteId(null));
  };

  return (
    <div className="space-y-4">
      {/* Upload-Bereich (Drag&Drop + Picker) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const f = e.dataTransfer.files?.[0];
          if (f) pickFile(f);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragActive ? 'border-primary bg-primary/5' : 'border-input'
        }`}
      >
        <Upload className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {t.actions.uploadDocument}
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) pickFile(f);
          }}
        />
        <Button
          variant="outline"
          className="min-h-[44px]"
          onClick={() => fileInput.current?.click()}
        >
          {t.actions.uploadDocument}
        </Button>
      </div>

      {/* Typ-Filter */}
      <div className="flex items-center gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="min-h-[44px] w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle</SelectItem>
            {DOC_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {typeLabel(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState message={t.empties.documents} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <Card key={d.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-3">
                  {d.mimeType.startsWith('image/') ? (
                    <AuthThumbnail id={d.id} alt={d.originalFilename} />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-muted">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {d.title || d.originalFilename}
                    </p>
                    <Badge variant="secondary" className="mt-1">
                      {typeLabel(d.documentType)}
                    </Badge>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatFileSize(d.fileSize)} · {formatDate(d.createdAt)}
                  {d.uploadedBy && <> · {d.uploadedBy.displayName}</>}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] flex-1"
                    onClick={() => downloadDocument(d.id)}
                  >
                    <Download className="h-4 w-4" />
                    {t.actions.download}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 text-destructive"
                    onClick={() => setDeleteId(d.id)}
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

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.actions.uploadDocument}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {pendingFile && (
              <p className="truncate text-sm text-muted-foreground">
                {pendingFile.name} ({formatFileSize(pendingFile.size)})
              </p>
            )}
            <Field label={t.fields.emailType}>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {typeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadOpen(false)}
              className="min-h-[44px]"
            >
              {t.actions.cancel}
            </Button>
            <Button
              onClick={doUpload}
              disabled={uploading || !pendingFile}
              className="min-h-[44px]"
            >
              {uploading ? t.actions.saving : t.actions.uploadDocument}
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

/** Lädt ein Bild mit Auth-Header und zeigt es als Thumbnail. */
function AuthThumbnail({ id, alt }: { id: string; alt: string }): ReactNode {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(TOKEN_STORAGE_KEY)
        : null;
    void fetch(`${API_BASE_URL}/documents/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((res) => (res.ok ? res.blob() : Promise.reject()))
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);

  if (!src) {
    return <Skeleton className="h-12 w-12 shrink-0 rounded" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      className="h-12 w-12 shrink-0 rounded object-cover"
    />
  );
}
