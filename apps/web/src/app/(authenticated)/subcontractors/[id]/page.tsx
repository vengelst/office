'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkerAvatar } from '@/components/workers/worker-avatar';
import { AvailabilityBadge } from '@/components/workers/worker-badges';
import { SubcontractorForm } from '@/components/workers/subcontractor-form';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { EmptyState } from '@/components/customers/empty-state';
import { LocationMap } from '@/components/ui/location-map';
import { useToast } from '@/components/ui/use-toast';
import {
  subcontractorsApi,
  workerFullName,
  type SubcontractorDetail,
} from '@/lib/workers';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

export default function SubcontractorDetailPage(): React.ReactNode {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { toast } = useToast();
  const t = texts.subcontractors;

  const [sub, setSub] = useState<SubcontractorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(() => {
    subcontractorsApi
      .get(id)
      .then((s) => {
        setSub(s);
        setNotFound(false);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = (payload: Record<string, unknown>): void => {
    setSaving(true);
    subcontractorsApi
      .update(id, payload)
      .then(() => {
        toast({ description: t.toast.updated });
        load();
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      )
      .finally(() => setSaving(false));
  };

  const handleDelete = (): void => {
    subcontractorsApi
      .remove(id)
      .then(() => {
        toast({ description: t.toast.deleted });
        router.push('/subcontractors');
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound || !sub) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">{t.noResults}</p>
          <Button asChild variant="link" className="mt-2">
            <Link href="/subcontractors">{t.backToList}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/subcontractors" className="hover:text-foreground">
          {t.title}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">{sub.name}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{sub.name}</h1>
        <Button
          variant="outline"
          className="min-h-[44px] text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          {t.actions.delete}
        </Button>
      </div>

      {sub.latitude != null && sub.longitude != null && (
        <LocationMap
          lat={sub.latitude}
          lng={sub.longitude}
          label={[sub.addressLine1, sub.postalCode, sub.city]
            .filter(Boolean)
            .join(', ')}
          entityType="subcontractor"
        />
      )}

      <Card>
        <CardContent className="pt-6">
          <SubcontractorForm
            subcontractor={sub}
            submitting={saving}
            onSubmit={handleSave}
          />
        </CardContent>
      </Card>

      {/* Zugehörige Monteure */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {t.sections.workers}
        </h3>
        {sub.workers.length === 0 ? (
          <EmptyState message={t.empties.workers} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sub.workers.map((w) => (
              <Link key={w.id} href={`/workers/${w.id}`} className="block">
                <Card className="active:bg-muted/50">
                  <CardContent className="flex items-center gap-3 p-4">
                    <WorkerAvatar
                      workerId={w.id}
                      hasPhoto={!!w.photoPath}
                      name={workerFullName(w)}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {workerFullName(w)}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {w.workerNumber}
                      </p>
                      <div className="mt-1">
                        <AvailabilityBadge availability={w.availability} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t.deleteTitle}
        description={t.deleteConfirm}
        onConfirm={handleDelete}
      />
    </div>
  );
}
