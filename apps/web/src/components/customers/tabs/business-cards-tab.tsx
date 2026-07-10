'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Camera, CreditCard, Download, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { EmptyState } from '@/components/customers/empty-state';
import { useToast } from '@/components/ui/use-toast';
import {
  documentsApi,
  type Document,
} from '@/lib/documents';
import { uploadDocument, downloadDocument } from '@/lib/upload';
import { ApiError, TOKEN_STORAGE_KEY } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { texts } from '@/lib/texts';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

export function BusinessCardsTab({
  entityId,
  entityType = 'CUSTOMER',
  contacts,
}: {
  entityId: string;
  entityType?: string;
  contacts: { id: string; firstName: string; lastName: string }[];
}): ReactNode {
  const { toast } = useToast();
  const t = texts.customers;
  const [cards, setCards] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);

    const promises = [
      documentsApi.list({
        entityType,
        entityId,
        documentType: 'BUSINESS_CARD',
      }),
      ...contacts.map((c) =>
        documentsApi.list({
          entityType: 'CONTACT',
          entityId: c.id,
          documentType: 'BUSINESS_CARD',
        }),
      ),
    ];

    Promise.all(promises)
      .then((results) => {
        const all = results.flat();
        const unique = Array.from(
          new Map(all.map((d) => [d.id, d])).values(),
        );
        unique.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setCards(unique);
      })
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, [entityType, entityId, contacts]);

  useEffect(() => {
    load();
  }, [load]);

  const contactName = (doc: Document): string | null => {
    const contactLink = doc.links.find((l) => l.entityType === 'CONTACT');
    if (!contactLink) return null;
    const c = contacts.find((ct) => ct.id === contactLink.entityId);
    return c ? `${c.firstName} ${c.lastName}` : null;
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    uploadDocument({
      file,
      documentType: 'BUSINESS_CARD',
      title: 'Visitenkarte',
      entityType,
      entityId,
    })
      .then(() => {
        toast({ description: t.toast.uploaded });
        load();
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      );
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
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileSelected}
      />

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {cards.length} {cards.length === 1 ? 'Visitenkarte' : 'Visitenkarten'}
        </p>
        <Button
          className="min-h-[44px]"
          onClick={() => fileInput.current?.click()}
        >
          <Camera className="h-4 w-4" />
          Visitenkarte hinzufügen
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-lg" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          message="Noch keine Visitenkarten vorhanden"
          actionLabel={t.actions.scanBusinessCard}
          onAction={() => fileInput.current?.click()}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((doc) => (
            <Card key={doc.id} className="overflow-hidden">
              <AuthCardImage
                docId={doc.id}
                alt={doc.title || doc.originalFilename}
                onClick={(blobUrl) => setLightboxSrc(blobUrl)}
              />
              <CardContent className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {doc.title || doc.originalFilename}
                    </p>
                    {contactName(doc) && (
                      <p className="truncate text-xs text-muted-foreground">
                        <CreditCard className="mr-1 inline h-3 w-3" />
                        {contactName(doc)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDate(doc.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => downloadDocument(doc.id)}
                      title="Herunterladen"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive"
                      onClick={() => setDeleteId(doc.id)}
                      title="Löschen"
                    >
                      <Trash2 className="h-4 w-4" />
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
        title={t.actions.delete}
        description={t.deleteConfirm}
        onConfirm={confirmDelete}
      />

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 text-white hover:bg-white/20"
            onClick={() => setLightboxSrc(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={lightboxSrc}
            alt="Visitenkarte"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function AuthCardImage({
  docId,
  alt,
  onClick,
}: {
  docId: string;
  alt: string;
  onClick: (blobUrl: string) => void;
}): ReactNode {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(TOKEN_STORAGE_KEY)
        : null;

    let objectUrl: string | undefined;
    fetch(`${API_BASE_URL}/documents/${docId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((res) => {
        if (!res.ok) throw new Error('load failed');
        return res.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => setBlobUrl(null));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [docId]);

  if (!blobUrl) {
    return <Skeleton className="aspect-[16/10] w-full" />;
  }

  return (
    <button
      type="button"
      onClick={() => onClick(blobUrl)}
      className="block w-full overflow-hidden"
    >
      <img
        src={blobUrl}
        alt={alt}
        className="aspect-[16/10] w-full object-contain bg-muted/30 transition-opacity hover:opacity-90"
      />
    </button>
  );
}
