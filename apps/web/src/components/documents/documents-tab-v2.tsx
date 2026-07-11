'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';
import {
  Camera,
  Download,
  FolderPlus,
  History,
  LayoutGrid,
  List,
  MoreVertical,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { EmptyState } from '@/components/customers/empty-state';
import { useToast } from '@/components/ui/use-toast';
import { UploadDialog } from '@/components/documents/upload-dialog';
import { DocumentLightbox } from '@/components/documents/document-lightbox';
import {
  DocumentThumb,
  ExpiryBadge,
  VersionBadge,
} from '@/components/documents/document-visuals';
import {
  documentFoldersApi,
  documentsApi,
  isImage,
  isPdf,
  type Document,
  type DocumentDetail,
  type DocumentFolder,
} from '@/lib/documents';
import { downloadDocument } from '@/lib/upload';
import { ApiError } from '@/lib/api-client';
import { formatDate, formatFileSize } from '@/lib/format';
import { texts } from '@/lib/texts';

const ALL = '__all__';

/**
 * Universelle Dokumenten-Verwaltung für eine Entität (Kunde/Projekt/…).
 * Ordner-Tabs, Grid/Listen-Ansicht, Upload (Drag&Drop + Kamera), Vorschau,
 * Versionen, Ablaufwarnungen und Suche.
 */
export function DocumentsTabV2({
  entityType,
  entityId,
  excludeTypes,
}: {
  entityType: string;
  entityId: string;
  excludeTypes?: string[];
}): ReactNode {
  const { toast } = useToast();
  const t = texts.documents;

  const [docs, setDocs] = useState<Document[]>([]);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState<string>(ALL);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[] | undefined>(undefined);
  const [dragActive, setDragActive] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [versionsDoc, setVersionsDoc] = useState<DocumentDetail | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');

  const cameraInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replacingId = useRef<string | null>(null);

  // Suche entprellen.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    documentsApi
      .list({
        entityType,
        entityId,
        folderId: folder !== ALL ? folder : undefined,
        search: debounced || undefined,
      })
      .then((result) => {
        if (excludeTypes?.length) {
          setDocs(result.filter((d) => !excludeTypes.includes(d.documentType)));
        } else {
          setDocs(result);
        }
      })
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [entityType, entityId, folder, debounced, excludeTypes]);

  useEffect(() => {
    load();
  }, [load]);

  // Ordner + Kontexttypen einmalig je Entität laden.
  useEffect(() => {
    documentFoldersApi
      .list(entityType, entityId)
      .then(setFolders)
      .catch(() => setFolders([]));
    documentsApi
      .typesForContext(entityType)
      .then(setTypes)
      .catch(() => setTypes([]));
  }, [entityType, entityId]);

  const imageDocs = useMemo(() => docs.filter((d) => isImage(d.mimeType)), [docs]);

  const openUpload = (files?: File[]): void => {
    setUploadFiles(files);
    setUploadOpen(true);
  };

  const onItemClick = (doc: Document): void => {
    if (isImage(doc.mimeType)) {
      const idx = imageDocs.findIndex((d) => d.id === doc.id);
      setLightbox(idx >= 0 ? idx : 0);
    } else if (isPdf(doc.mimeType)) {
      // PDF authentifiziert laden und im neuen Tab anzeigen.
      documentsApi
        .fileObjectUrl(doc.id)
        .then((u) => window.open(u, '_blank', 'noopener'))
        .catch(() => toast({ variant: 'destructive', description: t.toast.error }));
    } else {
      downloadDocument(doc.id);
    }
  };

  const openVersions = (id: string): void => {
    documentsApi
      .get(id)
      .then(setVersionsDoc)
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }));
  };

  const triggerReplace = (id: string): void => {
    replacingId.current = id;
    replaceInput.current?.click();
  };

  const doReplace = (file: File): void => {
    const id = replacingId.current;
    if (!id) return;
    documentsApi
      .replace(id, file, { uploadSource: 'web' })
      .then(() => {
        toast({ description: t.toast.replaced });
        load();
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      )
      .finally(() => (replacingId.current = null));
  };

  const confirmDelete = (): void => {
    if (!deleteId) return;
    documentsApi
      .remove(deleteId)
      .then(() => {
        toast({ description: t.toast.deleted });
        load();
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }))
      .finally(() => setDeleteId(null));
  };

  const createFolder = (): void => {
    if (!folderName.trim()) return;
    documentFoldersApi
      .create({ entityType, entityId, name: folderName.trim() })
      .then((f) => {
        toast({ description: t.toast.folderCreated });
        setFolders((prev) => [...prev, f]);
        setNewFolderOpen(false);
        setFolderName('');
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      );
  };

  const deleteFolder = (id: string): void => {
    documentFoldersApi
      .remove(id)
      .then(() => {
        toast({ description: t.toast.folderDeleted });
        setFolders((prev) => prev.filter((f) => f.id !== id));
        if (folder === id) setFolder(ALL);
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      );
  };

  const onDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files?.length) openUpload(Array.from(files));
  };

  const typeLabel = (type: string): string => t.documentTypes[type] ?? type;

  return (
    <div
      className="relative space-y-4"
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragActive(false);
      }}
      onDrop={onDrop}
    >
      {/* Drag-Overlay über die gesamte Fläche */}
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10">
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <Upload className="h-5 w-5" />
            {t.dropZoneActive}
          </p>
        </div>
      )}

      {/* Ordner-Tabs */}
      <div className="flex flex-wrap items-center gap-1">
        <FolderTab
          active={folder === ALL}
          label={t.allFolder}
          onClick={() => setFolder(ALL)}
        />
        {folders.map((f) => (
          <FolderTab
            key={f.id}
            active={folder === f.id}
            label={f.name}
            onClick={() => setFolder(f.id)}
            onDelete={() => deleteFolder(f.id)}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="min-h-[44px]"
          onClick={() => setNewFolderOpen(true)}
        >
          <FolderPlus className="h-4 w-4" />
          {t.newFolder}
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="min-h-[44px] pl-9"
            placeholder={t.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          <Button
            variant={view === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-10 w-10"
            title={t.gridView}
            onClick={() => setView('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={view === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-10 w-10"
            title={t.listView}
            onClick={() => setView('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          className="min-h-[44px]"
          onClick={() => cameraInput.current?.click()}
        >
          <Camera className="h-4 w-4" />
          {t.takePhoto}
        </Button>
        <Button className="min-h-[44px]" onClick={() => openUpload()}>
          <Upload className="h-4 w-4" />
          {t.upload}
        </Button>
      </div>

      {/* Inhalt */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <EmptyState message={t.empty} />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {docs.map((doc) => (
            <GridCard
              key={doc.id}
              doc={doc}
              typeLabel={typeLabel(doc.documentType)}
              onOpen={() => onItemClick(doc)}
              onDownload={() => downloadDocument(doc.id)}
              onReplace={() => triggerReplace(doc.id)}
              onVersions={() => openVersions(doc.id)}
              onDelete={() => setDeleteId(doc.id)}
            />
          ))}
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {docs.map((doc) => (
            <ListRow
              key={doc.id}
              doc={doc}
              typeLabel={typeLabel(doc.documentType)}
              onOpen={() => onItemClick(doc)}
              onDownload={() => downloadDocument(doc.id)}
              onReplace={() => triggerReplace(doc.id)}
              onVersions={() => openVersions(doc.id)}
              onDelete={() => setDeleteId(doc.id)}
            />
          ))}
        </div>
      )}

      {/* Versteckte Inputs */}
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) openUpload([f]);
        }}
      />
      <input
        ref={replaceInput}
        type="file"
        accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) doReplace(f);
        }}
      />

      {/* Upload-Dialog */}
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        entityType={entityType}
        entityId={entityId}
        types={types}
        folders={folders}
        defaultFolderId={folder !== ALL ? folder : undefined}
        initialFiles={uploadFiles}
        onUploaded={load}
      />

      {/* Lightbox */}
      {lightbox !== null && (
        <DocumentLightbox
          open
          documents={imageDocs}
          startIndex={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* Versions-Dialog */}
      <VersionsDialog
        detail={versionsDoc}
        onClose={() => setVersionsDoc(null)}
      />

      {/* Neuer Ordner */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.newFolderTitle}</DialogTitle>
          </DialogHeader>
          <Input
            className="min-h-[44px]"
            placeholder={t.newFolderName}
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createFolder()}
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="min-h-[44px]"
              onClick={() => setNewFolderOpen(false)}
            >
              {t.cancel}
            </Button>
            <Button className="min-h-[44px]" onClick={createFolder}>
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Löschen bestätigen */}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title={t.deleteTitle}
        description={t.deleteConfirm}
        confirmLabel={t.delete}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

/**
 * Dropdown-Aktionsmenü für Dokumente (Download, Ersetzen, Versionen, Löschen).
 * Wird sowohl in der Grid- als auch in der Listenansicht verwendet.
 */
function ActionsMenu({
  onDownload,
  onReplace,
  onVersions,
  onDelete,
  showVersions,
}: {
  onDownload: () => void;
  onReplace: () => void;
  onVersions: () => void;
  onDelete: () => void;
  showVersions: boolean;
}): ReactNode {
  const t = texts.documents;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={onDownload}>
          <Download className="mr-2 h-4 w-4" />
          {t.download}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onReplace}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t.replace}
        </DropdownMenuItem>
        {showVersions && (
          <DropdownMenuItem onClick={onVersions}>
            <History className="mr-2 h-4 w-4" />
            {t.versions}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="text-destructive" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          {t.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Dokument als Kachel in der Grid-Ansicht mit Thumbnail, Badges und Aktionsmenü. */
function GridCard({
  doc,
  typeLabel,
  onOpen,
  onDownload,
  onReplace,
  onVersions,
  onDelete,
}: {
  doc: Document;
  typeLabel: string;
  onOpen: () => void;
  onDownload: () => void;
  onReplace: () => void;
  onVersions: () => void;
  onDelete: () => void;
}): ReactNode {
  return (
    <Card className="group relative overflow-hidden">
      <button
        type="button"
        onClick={onOpen}
        className="block aspect-square w-full overflow-hidden"
      >
        <DocumentThumb doc={doc} className="h-full w-full" />
      </button>
      <CardContent className="space-y-1.5 p-2">
        <div className="flex items-start justify-between gap-1">
          <p className="min-w-0 flex-1 truncate text-xs font-medium" title={doc.originalFilename}>
            {doc.title || doc.originalFilename}
          </p>
          <ActionsMenu
            onDownload={onDownload}
            onReplace={onReplace}
            onVersions={onVersions}
            onDelete={onDelete}
            showVersions={doc.version > 1}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {typeLabel}
          </Badge>
          <VersionBadge version={doc.version} />
          <ExpiryBadge expiryDate={doc.expiryDate} />
        </div>
      </CardContent>
    </Card>
  );
}

/** Dokument als Zeile in der Listenansicht mit Thumbnail, Metadaten und Aktionsmenü. */
function ListRow({
  doc,
  typeLabel,
  onOpen,
  onDownload,
  onReplace,
  onVersions,
  onDelete,
}: {
  doc: Document;
  typeLabel: string;
  onOpen: () => void;
  onDownload: () => void;
  onReplace: () => void;
  onVersions: () => void;
  onDelete: () => void;
}): ReactNode {
  return (
    <div className="flex items-center gap-3 p-2">
      <button
        type="button"
        onClick={onOpen}
        className="h-12 w-12 shrink-0 overflow-hidden rounded-md border"
      >
        <DocumentThumb doc={doc} className="h-full w-full" />
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-sm font-medium">
          {doc.title || doc.originalFilename}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {typeLabel} · {formatFileSize(doc.fileSize)} · {formatDate(doc.createdAt)}
        </p>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <VersionBadge version={doc.version} />
        <ExpiryBadge expiryDate={doc.expiryDate} />
        <ActionsMenu
          onDownload={onDownload}
          onReplace={onReplace}
          onVersions={onVersions}
          onDelete={onDelete}
          showVersions={doc.version > 1}
        />
      </div>
    </div>
  );
}

/** Ordner-Tab mit optionalem Löschen-Knopf. */
function FolderTab({
  active,
  label,
  onClick,
  onDelete,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  onDelete?: () => void;
}): ReactNode {
  return (
    <div
      className={`flex min-h-[44px] items-center gap-1 rounded-md px-3 text-sm transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
      }`}
    >
      <button type="button" onClick={onClick} className="py-2">
        {label}
      </button>
      {onDelete && (
        <button
          type="button"
          title={texts.documents.deleteFolder}
          onClick={onDelete}
          className={`rounded p-0.5 ${active ? 'hover:bg-primary-foreground/20' : 'hover:bg-background'}`}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/** Dialog mit der Versions-Historie eines Dokuments. */
function VersionsDialog({
  detail,
  onClose,
}: {
  detail: DocumentDetail | null;
  onClose: () => void;
}): ReactNode {
  const t = texts.documents;
  return (
    <Dialog open={detail !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.versionHistory}</DialogTitle>
        </DialogHeader>
        {detail && (
          <div className="space-y-2">
            <VersionRow doc={detail} current />
            {detail.previousVersions.map((v) => (
              <VersionRow key={v.id} doc={v} current={false} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Einzelne Version in der Versions-Historie mit Download-Button. */
function VersionRow({
  doc,
  current,
}: {
  doc: Document;
  current: boolean;
}): ReactNode {
  const t = texts.documents;
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border p-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {t.versionBadge}
          {doc.version}
          {current && (
            <Badge variant="secondary" className="ml-2 text-[10px]">
              aktuell
            </Badge>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {formatDate(doc.createdAt)} · {formatFileSize(doc.fileSize)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        title={t.download}
        onClick={() => downloadDocument(doc.id)}
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}
