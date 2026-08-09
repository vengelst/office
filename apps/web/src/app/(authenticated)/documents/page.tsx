/**
 * Seite: app/(authenticated)/documents/page.tsx (Office-Web).
 * Domänen-UI – ausführliche Handler-JSDocs nur bei nicht-trivialer Logik.
 */

'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ExternalLink, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DocumentThumb,
  ExpiryBadge,
  VersionBadge,
} from '@/components/documents/document-visuals';
import { DocumentLightbox } from '@/components/documents/document-lightbox';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { BulkActionBar } from '@/components/ui/bulk-action-bar';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { useToast } from '@/components/ui/use-toast';
import {
  documentsApi,
  isImage,
  isPdf,
  type Document,
  type DocumentLink,
} from '@/lib/documents';
import { downloadDocument } from '@/lib/upload';
import { ApiError } from '@/lib/api-client';
import { formatDate, formatFileSize } from '@/lib/format';
import { texts } from '@/lib/texts';

const ALL = '__all__';

/** Detail-Pfad einer verknüpften Entität (sofern es eine eigene Seite gibt). */
function entityHref(link: DocumentLink): string | null {
  switch (link.entityType) {
    case 'CUSTOMER':
    case 'BRANCH':
    case 'CONTACT':
      return link.entityType === 'CUSTOMER'
        ? `/customers/${link.entityId}`
        : null;
    case 'PROJECT':
      return `/projects/${link.entityId}`;
    case 'WORKER':
      return `/workers/${link.entityId}`;
    case 'VEHICLE':
      return `/vehicles/${link.entityId}`;
    default:
      return null;
  }
}

export default function DocumentsPage(): ReactNode {
  const t = texts.documents;
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [docType, setDocType] = useState<string>(ALL);
  const [entityType, setEntityType] = useState<string>(ALL);
  const [onlyExpiring, setOnlyExpiring] = useState(false);
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    const req = onlyExpiring
      ? documentsApi.expiring()
      : documentsApi.list({
          search: debounced || undefined,
          documentType: docType !== ALL ? docType : undefined,
          entityType: entityType !== ALL ? entityType : undefined,
          limit: 100,
        });
    req
      .then((result) => setDocs(Array.isArray(result) ? result : result.data))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [onlyExpiring, debounced, docType, entityType]);

  useEffect(() => {
    load();
  }, [load]);

  // Bei "nur ablaufende" wird serverseitig nicht gefiltert → clientseitig anwenden.
  const filtered = useMemo(() => {
    if (!onlyExpiring) return docs;
    const q = debounced.toLowerCase();
    return docs.filter((d) => {
      if (docType !== ALL && d.documentType !== docType) return false;
      if (entityType !== ALL && !d.links.some((l) => l.entityType === entityType))
        return false;
      if (q) {
        const hay = `${d.title ?? ''} ${d.originalFilename} ${d.tags ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [docs, onlyExpiring, debounced, docType, entityType]);

  const bulk = useBulkSelection(filtered.map((d) => d.id));
  const handleBulkDelete = async (): Promise<void> => {
    try {
      const res = await documentsApi.bulkRemove(bulk.selectedIds);
      toast({ description: `${res.deleted} gelöscht${res.failed ? `, ${res.failed} fehlgeschlagen` : ''}.` });
      bulk.clear();
      load();
    } catch (err) {
      toast({ variant: 'destructive', description: err instanceof ApiError ? err.message : t.toast.error });
    }
  };

  const imageDocs = useMemo(
    () => filtered.filter((d) => isImage(d.mimeType)),
    [filtered],
  );

  const onOpen = (doc: Document): void => {
    if (isImage(doc.mimeType)) {
      const idx = imageDocs.findIndex((d) => d.id === doc.id);
      setLightbox(idx >= 0 ? idx : 0);
    } else if (isPdf(doc.mimeType)) {
      documentsApi
        .fileObjectUrl(doc.id)
        .then((u) => window.open(u, '_blank', 'noopener'))
        .catch(() => downloadDocument(doc.id));
    } else {
      downloadDocument(doc.id);
    }
  };

  const confirmDelete = (): void => {
    if (!deleteId) return;
    documentsApi
      .remove(deleteId)
      .then(() => {
        toast({ description: t.toast.deleted });
        setDeleteId(null);
        load();
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      );
  };

  const docTypeKeys = Object.keys(t.documentTypes);
  const entityKeys = Object.keys(t.entityTypes);

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle} />

      {/* Filterleiste */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="min-h-[44px] pl-9"
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={docType} onValueChange={setDocType}>
          <SelectTrigger className="min-h-[44px] w-48">
            <SelectValue placeholder={t.allTypes} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t.allTypes}</SelectItem>
            {docTypeKeys.map((key) => (
              <SelectItem key={key} value={key}>
                {t.documentTypes[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger className="min-h-[44px] w-44">
            <SelectValue placeholder={t.allEntities} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t.allEntities}</SelectItem>
            {entityKeys.map((key) => (
              <SelectItem key={key} value={key}>
                {t.entityTypes[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={onlyExpiring ? 'default' : 'outline'}
          className="min-h-[44px]"
          onClick={() => setOnlyExpiring((v) => !v)}
        >
          {t.onlyExpiring}
        </Button>
      </div>

      <BulkActionBar count={bulk.count} onDelete={() => setBulkOpen(true)} deleteLabel={t.delete} />

      {/* Ergebnisliste */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t.noResults}
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground">
            {filtered.length} {t.results}
          </p>
          <div className="divide-y rounded-lg border">
            {filtered.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 p-3">
                <input
                  type="checkbox"
                  checked={bulk.isSelected(doc.id)}
                  onChange={() => bulk.toggle(doc.id)}
                  className="h-4 w-4 shrink-0"
                  aria-label={`Auswählen ${doc.title || doc.originalFilename}`}
                />
                <button
                  type="button"
                  onClick={() => onOpen(doc)}
                  className="h-14 w-14 shrink-0 overflow-hidden rounded-md border"
                >
                  <DocumentThumb doc={doc} className="h-full w-full" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpen(doc)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-medium">
                    {doc.title || doc.originalFilename}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Badge variant="outline" className="text-[10px]">
                      {t.documentTypes[doc.documentType] ?? doc.documentType}
                    </Badge>
                    <VersionBadge version={doc.version} />
                    <ExpiryBadge expiryDate={doc.expiryDate} />
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(doc.fileSize)} · {t.uploadedAt}{' '}
                      {formatDate(doc.createdAt)}
                    </span>
                  </div>
                </button>
                {/* Verknüpfte Entitäten */}
                <div className="hidden shrink-0 flex-wrap items-center justify-end gap-1 sm:flex">
                  {doc.links.map((link) => {
                    const href = entityHref(link);
                    const label = t.entityTypes[link.entityType] ?? link.entityType;
                    return href ? (
                      <Button
                        key={link.id}
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-8"
                      >
                        <Link href={href}>
                          {label}
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    ) : (
                      <Badge key={link.id} variant="secondary" className="text-[10px]">
                        {label}
                      </Badge>
                    );
                  })}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0 text-destructive"
                  aria-label={t.delete}
                  onClick={() => setDeleteId(doc.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      {lightbox !== null && (
        <DocumentLightbox
          open
          documents={imageDocs}
          startIndex={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}

      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={`${bulk.count} Dokumente löschen?`}
        description={t.deleteConfirm}
        onConfirm={handleBulkDelete}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title={t.deleteTitle}
        description={t.deleteConfirm}
        confirmLabel={t.delete}
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
