'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from 'react';
import { Camera, Pencil, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useToast } from '@/components/ui/use-toast';
import { ImageEditor } from '@/components/documents/image-editor';
import {
  documentsApi,
  isImage,
  type DocumentFolder,
  type UploadMeta,
} from '@/lib/documents';
import { ApiError } from '@/lib/api-client';
import { formatFileSize } from '@/lib/format';
import { texts } from '@/lib/texts';

const NO_FOLDER = '__none__';
let seq = 0;
const nextId = (): string => `pending-${Date.now()}-${seq++}`;

interface PendingItem {
  id: string;
  file: File;
  documentType: string;
  title: string;
  tags: string;
  expiry: string;
  folderId: string;
  preview: string | null;
  progress: number;
  status: 'idle' | 'uploading' | 'done' | 'error';
}

/**
 * Upload-Dialog mit Drag&Drop, Kamera, Multi-Select und Bildbearbeitung.
 * Lädt jede Datei einzeln hoch (eigene Metadaten + Fortschritt pro Datei).
 */
export function UploadDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  types,
  folders,
  defaultFolderId,
  initialFiles,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: string;
  types: string[];
  folders: DocumentFolder[];
  defaultFolderId?: string;
  initialFiles?: File[];
  onUploaded: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.documents;
  const [items, setItems] = useState<PendingItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<PendingItem | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const defaultType = types[0] ?? 'OTHER';

  const makeItem = useCallback(
    (file: File): PendingItem => ({
      id: nextId(),
      file,
      documentType: defaultType,
      title: '',
      tags: '',
      expiry: '',
      folderId: defaultFolderId ?? NO_FOLDER,
      preview: isImage(file.type) ? URL.createObjectURL(file) : null,
      progress: 0,
      status: 'idle',
    }),
    [defaultType, defaultFolderId],
  );

  const addFiles = useCallback(
    (files: FileList | File[]): void => {
      const arr = Array.from(files);
      if (arr.length === 0) return;
      setItems((prev) => [...prev, ...arr.map(makeItem)]);
    },
    [makeItem],
  );

  // Vom Parent durchgereichte Dateien (Drag&Drop auf die Tab-Fläche) übernehmen.
  useEffect(() => {
    if (open && initialFiles && initialFiles.length > 0) {
      addFiles(initialFiles);
    }
    // Nur beim Öffnen auswerten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Object-URLs der Vorschauen beim Schließen freigeben.
  useEffect(() => {
    if (!open) {
      setItems((prev) => {
        prev.forEach((i) => i.preview && URL.revokeObjectURL(i.preview));
        return [];
      });
      setUploading(false);
    }
  }, [open]);

  const patch = (id: string, p: Partial<PendingItem>): void =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));

  const removeItem = (id: string): void =>
    setItems((prev) => {
      const found = prev.find((i) => i.id === id);
      if (found?.preview) URL.revokeObjectURL(found.preview);
      return prev.filter((i) => i.id !== id);
    });

  const applyEdited = (edited: File): void => {
    if (!editing) return;
    if (editing.preview) URL.revokeObjectURL(editing.preview);
    patch(editing.id, {
      file: edited,
      preview: isImage(edited.type) ? URL.createObjectURL(edited) : null,
    });
    setEditing(null);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const startUpload = async (): Promise<void> => {
    if (items.length === 0) return;
    setUploading(true);
    let failed = 0;
    for (const item of items) {
      if (item.status === 'done') continue;
      patch(item.id, { status: 'uploading', progress: 0 });
      const meta: UploadMeta = {
        documentType: item.documentType,
        title: item.title || undefined,
        tags: item.tags || undefined,
        expiryDate: item.expiry ? new Date(item.expiry).toISOString() : undefined,
        entityType,
        entityId,
        folderId: item.folderId !== NO_FOLDER ? item.folderId : undefined,
        uploadSource: 'web',
      };
      try {
        await documentsApi.upload(item.file, meta, (p) =>
          patch(item.id, { progress: p }),
        );
        patch(item.id, { status: 'done', progress: 100 });
      } catch (err) {
        failed += 1;
        patch(item.id, { status: 'error' });
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        });
      }
    }
    setUploading(false);
    if (failed === 0) {
      toast({ description: t.toast.uploaded });
      onUploaded();
      onOpenChange(false);
    } else {
      onUploaded();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !uploading && onOpenChange(o)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.uploadTitle}</DialogTitle>
          </DialogHeader>

          {/* Drop-Zone + Buttons */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragActive ? 'border-primary bg-primary/5' : 'border-input'
            }`}
          >
            <Upload className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {dragActive ? t.dropZoneActive : t.dropZone}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => fileInput.current?.click()}
              >
                {t.selectFiles}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => cameraInput.current?.click()}
              >
                <Camera className="h-4 w-4" />
                {t.takePhoto}
              </Button>
            </div>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          {/* Datei-Liste */}
          {items.length > 0 && (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row"
                >
                  {/* Vorschau / Icon */}
                  <div className="flex shrink-0 items-start gap-2">
                    {item.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.preview}
                        alt={item.file.name}
                        className="h-20 w-20 rounded-md border object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
                        {item.file.name.split('.').pop()?.toUpperCase() ?? 'FILE'}
                      </div>
                    )}
                  </div>

                  {/* Metadaten */}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {item.file.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatFileSize(item.file.size)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Select
                        value={item.documentType}
                        onValueChange={(v) => patch(item.id, { documentType: v })}
                      >
                        <SelectTrigger className="min-h-[44px]">
                          <SelectValue placeholder={t.fileType} />
                        </SelectTrigger>
                        <SelectContent>
                          {types.map((type) => (
                            <SelectItem key={type} value={type}>
                              {t.documentTypes[type] ?? type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        className="min-h-[44px]"
                        placeholder={t.fileTitle}
                        value={item.title}
                        onChange={(e) => patch(item.id, { title: e.target.value })}
                      />
                      <Input
                        className="min-h-[44px]"
                        placeholder={t.fileTags}
                        value={item.tags}
                        onChange={(e) => patch(item.id, { tags: e.target.value })}
                      />
                      <Input
                        className="min-h-[44px]"
                        type="date"
                        title={t.fileExpiry}
                        value={item.expiry}
                        onChange={(e) => patch(item.id, { expiry: e.target.value })}
                      />
                      {folders.length > 0 && (
                        <Select
                          value={item.folderId}
                          onValueChange={(v) => patch(item.id, { folderId: v })}
                        >
                          <SelectTrigger className="min-h-[44px]">
                            <SelectValue placeholder={t.folder} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_FOLDER}>{t.noFolder}</SelectItem>
                            {folders.map((f) => (
                              <SelectItem key={f.id} value={f.id}>
                                {f.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Fortschritt */}
                    {item.status === 'uploading' && (
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                    {item.status === 'done' && (
                      <p className="text-xs text-green-600">{t.uploadDone}</p>
                    )}
                    {item.status === 'error' && (
                      <p className="text-xs text-destructive">{t.toast.error}</p>
                    )}
                  </div>

                  {/* Aktionen */}
                  <div className="flex shrink-0 flex-row gap-1 sm:flex-col">
                    {isImage(item.file.type) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11"
                        title={t.edit}
                        disabled={uploading}
                        onClick={() => setEditing(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 text-destructive"
                      title={t.removeFile}
                      disabled={uploading}
                      onClick={() => removeItem(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              disabled={uploading}
              onClick={() => onOpenChange(false)}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              className="min-h-[44px]"
              disabled={uploading || items.length === 0}
              onClick={() => void startUpload()}
            >
              {uploading ? t.uploading : t.startUpload}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageEditor
        file={editing?.file ?? null}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        onApply={applyEdited}
      />
    </>
  );
}
