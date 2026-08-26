'use client';

/**
 * Baustellenfotos-Galerie (SITE_PHOTO) für Monteur- oder Projekt-Kontext.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Camera, Download, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { useToast } from '@/components/ui/use-toast';
import { documentsApi, type Document } from '@/lib/documents';
import { downloadDocument } from '@/lib/upload';
import { formatDate } from '@/lib/format';
import { texts } from '@/lib/texts';

const ALL = '__all__';

export interface SitePhotoProjectOption {
  id: string;
  label: string;
}

export function SitePhotosGallery({
  entityType,
  entityId,
  projectOptions,
  emptyHint,
}: {
  entityType: 'WORKER' | 'PROJECT';
  entityId: string;
  /** Nur bei Monteur: Baustellen-Filter (Zuweisungen). */
  projectOptions?: SitePhotoProjectOption[];
  emptyHint?: string;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.sitePhotos;
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState(ALL);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    documentsApi
      .list({
        entityType,
        entityId,
        documentType: 'SITE_PHOTO',
        limit: 200,
      })
      .then((res) => {
        const sorted = [...res.data].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setDocs(sorted);
      })
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Zuweisungen + Baustellen aus vorhandenen Fotos (Labels bevorzugt aus Zuweisungen). */
  const effectiveProjectOptions = useMemo((): SitePhotoProjectOption[] => {
    const map = new Map<string, string>();
    for (const p of projectOptions ?? []) {
      map.set(p.id, p.label);
    }
    for (const d of docs) {
      for (const l of d.links) {
        if (l.entityType === 'PROJECT' && !map.has(l.entityId)) {
          map.set(l.entityId, t.unknownProject);
        }
      }
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'de'));
  }, [projectOptions, docs, t.unknownProject]);

  const filtered = useMemo(() => {
    if (entityType !== 'WORKER' || projectFilter === ALL) return docs;
    return docs.filter((d) =>
      d.links.some(
        (l) => l.entityType === 'PROJECT' && l.entityId === projectFilter,
      ),
    );
  }, [docs, entityType, projectFilter]);

  const projectLabel = (doc: Document): string | null => {
    const link = doc.links.find((l) => l.entityType === 'PROJECT');
    if (!link) return null;
    const opt = effectiveProjectOptions.find((p) => p.id === link.entityId);
    return opt?.label ?? null;
  };

  const confirmDelete = (): void => {
    if (!deleteId) return;
    documentsApi
      .remove(deleteId)
      .then(() => {
        toast({ description: t.toast.deleted });
        load();
      })
      .catch(() =>
        toast({ variant: 'destructive', description: t.toast.error }),
      )
      .finally(() => setDeleteId(null));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{t.title}</p>
          <p className="text-xs text-muted-foreground">
            {filtered.length}{' '}
            {filtered.length === 1 ? t.countOne : t.countMany}
          </p>
        </div>
        {entityType === 'WORKER' && effectiveProjectOptions.length > 0 && (
          <div className="w-full max-w-xs space-y-1">
            <label className="text-xs text-muted-foreground">
              {t.filterProject}
            </label>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder={t.filterProject} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t.allProjects}</SelectItem>
                {effectiveProjectOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Camera className="h-8 w-8 opacity-40" />
            <p className="text-sm">{emptyHint ?? t.empty}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((doc) => (
            <Card key={doc.id} className="overflow-hidden">
              <AuthPhotoThumb
                docId={doc.id}
                alt={doc.title || t.typeLabel}
                onClick={() => {
                  documentsApi
                    .fileObjectUrl(doc.id)
                    .then((url) => setLightboxSrc(url))
                    .catch(() =>
                      toast({
                        variant: 'destructive',
                        description: t.toast.error,
                      }),
                    );
                }}
              />
              <CardContent className="space-y-1 p-2">
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">
                      {t.typeLabel}
                    </p>
                    {entityType === 'WORKER' && projectLabel(doc) && (
                      <p className="truncate text-[10px] text-muted-foreground">
                        {projectLabel(doc)}
                      </p>
                    )}
                    {doc.description?.trim() && (
                      <p className="truncate text-[10px] text-muted-foreground">
                        {doc.description.trim()}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(doc.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => downloadDocument(doc.id)}
                      title={t.download}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteId(doc.id)}
                      title={t.delete}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title={t.delete}
        description={t.deleteConfirm}
        onConfirm={confirmDelete}
      />

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => {
            URL.revokeObjectURL(lightboxSrc);
            setLightboxSrc(null);
          }}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 text-white hover:bg-white/20"
            onClick={() => {
              URL.revokeObjectURL(lightboxSrc);
              setLightboxSrc(null);
            }}
          >
            <X className="h-6 w-6" />
          </Button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt={t.typeLabel}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function AuthPhotoThumb({
  docId,
  alt,
  onClick,
}: {
  docId: string;
  alt: string;
  onClick: () => void;
}): ReactNode {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | undefined;
    let cancelled = false;
    documentsApi
      .thumbnailObjectUrl(docId)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setBlobUrl(url);
      })
      .catch(() =>
        documentsApi.fileObjectUrl(docId).then((url) => {
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          objectUrl = url;
          setBlobUrl(url);
        }),
      )
      .catch(() => {
        if (!cancelled) setBlobUrl(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [docId]);

  if (!blobUrl) {
    return <Skeleton className="aspect-square w-full" />;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full overflow-hidden bg-muted"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={blobUrl}
        alt={alt}
        className="aspect-square w-full object-contain"
      />
    </button>
  );
}
