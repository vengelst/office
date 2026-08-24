'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { CreditCard, Download, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { EmptyState } from '@/components/customers/empty-state';
import { useToast } from '@/components/ui/use-toast';
import { documentsApi, type Document } from '@/lib/documents';
import { downloadDocument } from '@/lib/upload';
import { TOKEN_STORAGE_KEY } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { texts } from '@/lib/texts';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

/**
 * Visitenkarten eines Kunden – nur Karten, die einem Ansprechpartner
 * zugeordnet sind (keine doppelte Ablage am Kunden-Stamm).
 */
export function BusinessCardsTab({
  contacts,
  onScanClick,
}: {
  contacts: { id: string; firstName: string; lastName: string }[];
  /** Wechselt zum Kontakte-Tab und öffnet den Scan (optional). */
  onScanClick?: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.customers;
  const [cards, setCards] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    if (contacts.length === 0) {
      setCards([]);
      setLoading(false);
      return;
    }

    Promise.all(
      contacts.map((c) =>
        documentsApi.list({
          entityType: 'CONTACT',
          entityId: c.id,
          documentType: 'BUSINESS_CARD',
          limit: 100,
        }),
      ),
    )
      .then((results) => {
        const all = results.flatMap((r) => r.data);
        const unique = Array.from(new Map(all.map((d) => [d.id, d])).values());
        unique.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setCards(unique);
      })
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, [contacts]);

  useEffect(() => {
    load();
  }, [load]);

  const contactName = (doc: Document): string | null => {
    const contactLink = doc.links.find((l) => l.entityType === 'CONTACT');
    if (!contactLink) return null;
    const c = contacts.find((ct) => ct.id === contactLink.entityId);
    return c ? `${c.firstName} ${c.lastName}` : null;
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
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {cards.length} {cards.length === 1 ? 'Visitenkarte' : 'Visitenkarten'}
          <span className="ml-1 text-xs">
            (nur Ansprechpartner)
          </span>
        </p>
        {onScanClick && (
          <Button className="min-h-[44px]" onClick={onScanClick}>
            <CreditCard className="h-4 w-4" />
            {t.actions.scanBusinessCard}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          message="Noch keine Visitenkarten an Ansprechpartnern"
          actionLabel={t.actions.scanBusinessCard}
          onAction={onScanClick}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((doc) => (
            <Card key={doc.id} className="overflow-hidden">
              <AuthCardImage
                docId={doc.id}
                alt={doc.title || doc.originalFilename}
                onClick={(blobUrl) => setLightboxSrc(blobUrl)}
              />
              <CardContent className="space-y-1 p-2">
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    {contactName(doc) && (
                      <p className="truncate text-xs font-medium">
                        <CreditCard className="mr-1 inline h-3 w-3" />
                        {contactName(doc)}
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
                      title="Herunterladen"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteId(doc.id)}
                      title="Löschen"
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
    return <Skeleton className="aspect-[3/2] w-full" />;
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
        className="aspect-[3/2] w-full object-cover"
      />
    </button>
  );
}
