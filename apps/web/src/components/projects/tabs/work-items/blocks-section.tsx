/**
 * Komponente: components/projects/tabs/work-items/blocks-section.tsx (Office-Web).
 * Domänen-UI – ausführliche Handler-JSDocs nur bei nicht-trivialer Logik.
 */

'use client';

import { useRef, useState, type ReactNode } from 'react';
import { ExternalLink, FileText, Pencil, Plus, Trash2, Upload, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/customers/customer-form';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { EmptyState } from '@/components/customers/empty-state';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import { documentsApi } from '@/lib/documents';
import { texts } from '@/lib/texts';
import { workItemsApi, type ProjectBlock } from '@/lib/work-items';

/** Dokumenttyp der Block-PDFs (im PROJECT-Kontext erlaubt). */
const BLOCK_PDF_TYPE = 'DRAWING';

/**
 * Blöcke eines item-basierten Projekts: anlegen, umbenennen, löschen und das
 * Block-PDF hochladen (Dokumentenmodul) bzw. verknüpfen/lösen.
 */
export function BlocksSection({
  projectId,
  blocks,
  onChange,
}: {
  projectId: string;
  blocks: ProjectBlock[];
  onChange: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.projects.workItems;
  const a = texts.projects.actions;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectBlock | null>(null);
  const [blockKey, setBlockKey] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ProjectBlock | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  /** Block-ID, für die der versteckte Datei-Dialog gerade geöffnet wurde. */
  const uploadTarget = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const fail = (err: unknown): void => {
    toast({
      variant: 'destructive',
      description:
        err instanceof ApiError ? err.message : texts.projects.toast.error,
    });
  };

  const openCreate = (): void => {
    setEditing(null);
    setBlockKey('');
    setName('');
    setDialogOpen(true);
  };

  const openEdit = (block: ProjectBlock): void => {
    setEditing(block);
    setBlockKey(block.blockKey);
    setName(block.name ?? '');
    setDialogOpen(true);
  };

  const save = (): void => {
    setSaving(true);
    const payload = { blockKey: blockKey.trim(), name: name.trim() || undefined };
    const req = editing
      ? workItemsApi.updateBlock(projectId, editing.id, payload)
      : workItemsApi.createBlock(projectId, payload);
    req
      .then(() => {
        toast({
          description: editing ? t.toast.blockUpdated : t.toast.blockCreated,
        });
        setDialogOpen(false);
        onChange();
      })
      .catch(fail)
      .finally(() => setSaving(false));
  };

  const confirmDelete = (): void => {
    if (!deleting) return;
    workItemsApi
      .removeBlock(projectId, deleting.id)
      .then(() => {
        toast({ description: t.toast.blockDeleted });
        onChange();
      })
      .catch(fail)
      .finally(() => setDeleting(null));
  };

  /** Öffnet den Datei-Dialog für einen bestimmten Block. */
  const pickPdf = (block: ProjectBlock): void => {
    uploadTarget.current = block.id;
    fileInput.current?.click();
  };

  /**
   * Lädt das PDF als Projekt-Dokument hoch und verknüpft es anschließend
   * über `pdfDocumentId` mit dem Block.
   */
  const handleFile = (file: File | undefined): void => {
    const blockId = uploadTarget.current;
    uploadTarget.current = null;
    if (fileInput.current) fileInput.current.value = '';
    if (!file || !blockId) return;

    setUploadingId(blockId);
    documentsApi
      .upload(file, {
        documentType: BLOCK_PDF_TYPE,
        entityType: 'PROJECT',
        entityId: projectId,
        title: file.name,
      })
      .then((doc) =>
        workItemsApi.updateBlock(projectId, blockId, { pdfDocumentId: doc.id }),
      )
      .then(() => {
        toast({ description: t.toast.pdfLinked });
        onChange();
      })
      .catch(fail)
      .finally(() => setUploadingId(null));
  };

  const openPdf = (documentId: string): void => {
    documentsApi
      .fileObjectUrl(documentId)
      .then((url) => window.open(url, '_blank', 'noopener'))
      .catch(fail);
  };

  const unlinkPdf = (block: ProjectBlock): void => {
    workItemsApi
      .updateBlock(projectId, block.id, { pdfDocumentId: null })
      .then(() => {
        toast({ description: t.toast.pdfUnlinked });
        onChange();
      })
      .catch(fail);
  };

  const PdfState = ({ block }: { block: ProjectBlock }): ReactNode =>
    block.pdfDocumentId ? (
      <Badge className="border-transparent bg-green-600 text-white hover:bg-green-600">
        {t.blocks.pdfPresent}
      </Badge>
    ) : (
      <Badge variant="secondary">{t.blocks.pdfMissing}</Badge>
    );

  const RowActions = ({ block }: { block: ProjectBlock }): ReactNode => (
    <div className="flex flex-wrap justify-end gap-1">
      {block.pdfDocumentId && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            onClick={() => openPdf(block.pdfDocumentId as string)}
          >
            <ExternalLink className="h-4 w-4" />
            {t.blocks.openPdf}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            onClick={() => unlinkPdf(block)}
            aria-label={t.blocks.unlinkPdf}
          >
            <Unlink className="h-4 w-4" />
          </Button>
        </>
      )}
      <Button
        variant="outline"
        size="sm"
        className="min-h-[44px]"
        disabled={uploadingId === block.id}
        onClick={() => pickPdf(block)}
      >
        <Upload className="h-4 w-4" />
        {block.pdfDocumentId ? t.blocks.replacePdf : t.blocks.uploadPdf}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11"
        onClick={() => openEdit(block)}
        aria-label={a.edit}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11 text-destructive"
        onClick={() => setDeleting(block)}
        aria-label={a.delete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <FileText className="h-4 w-4" />
            {t.blocks.title}
          </h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t.blocks.subtitle}
          </p>
        </div>
        <Button onClick={openCreate} className="min-h-[44px]">
          <Plus className="h-4 w-4" />
          {t.blocks.add}
        </Button>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {blocks.length === 0 ? (
        <EmptyState
          message={t.blocks.empty}
          actionLabel={texts.projects.empties.addNow}
          onAction={openCreate}
        />
      ) : (
        <>
          {/* Desktop: Tabelle */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.blocks.blockKey}</TableHead>
                  <TableHead>{t.blocks.name}</TableHead>
                  <TableHead>{t.blocks.itemCount}</TableHead>
                  <TableHead>{t.blocks.pdf}</TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocks.map((block) => (
                  <TableRow key={block.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {block.blockKey}
                    </TableCell>
                    <TableCell>{block.name ?? '–'}</TableCell>
                    <TableCell>{block._count.workItems}</TableCell>
                    <TableCell>
                      <PdfState block={block} />
                    </TableCell>
                    <TableCell>
                      <RowActions block={block} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: Cards */}
          <div className="space-y-3 md:hidden">
            {blocks.map((block) => (
              <Card key={block.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono font-medium">{block.blockKey}</p>
                      <p className="text-xs text-muted-foreground">
                        {block.name ?? '–'} · {block._count.workItems}{' '}
                        {t.blocks.itemCount}
                      </p>
                    </div>
                    <PdfState block={block} />
                  </div>
                  <RowActions block={block} />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Anlegen / Bearbeiten */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t.blocks.edit : t.blocks.add}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label={t.blocks.blockKey} required>
              <Input
                value={blockKey}
                onChange={(e) => setBlockKey(e.target.value)}
                placeholder="Block-1"
                className="min-h-[44px]"
              />
              <p className="text-xs text-muted-foreground">
                {t.blocks.blockKeyHint}
              </p>
            </Field>
            <Field label={t.blocks.name}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="min-h-[44px]"
            >
              {a.cancel}
            </Button>
            <Button
              onClick={save}
              disabled={saving || !blockKey.trim()}
              className="min-h-[44px]"
            >
              {saving ? a.saving : a.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t.blocks.deleteTitle}
        description={t.blocks.deleteConfirm}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
