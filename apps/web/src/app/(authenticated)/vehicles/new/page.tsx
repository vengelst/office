'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { VehicleForm } from '@/components/vehicles/vehicle-form';
import { useToast } from '@/components/ui/use-toast';
import { vehiclesApi } from '@/lib/vehicles';
import { subcontractorsApi } from '@/lib/workers';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

export default function NewVehiclePage(): React.ReactNode {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [subcontractors, setSubcontractors] = useState<
    { id: string; name: string }[]
  >([]);
  const t = texts.vehicles;

  useEffect(() => {
    subcontractorsApi
      .list({ limit: 100 })
      .then((r) => setSubcontractors(r.data.map((s) => ({ id: s.id, name: s.name }))))
      .catch(() => setSubcontractors([]));
  }, []);

  const handleSubmit = (payload: Record<string, unknown>): void => {
    setSubmitting(true);
    vehiclesApi
      .create(payload)
      .then((created) => {
        toast({ description: t.toast.created });
        router.push(`/vehicles/${created.id}`);
      })
      .catch((err) => {
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        });
        setSubmitting(false);
      });
  };

  return (
    <div className="max-w-3xl">
      <Link
        href="/vehicles"
        className="mb-3 inline-flex min-h-[44px] items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {t.backToList}
      </Link>
      <PageHeader title={t.createTitle} description={t.createSubtitle} />
      <Card>
        <CardContent className="pt-6">
          <VehicleForm
            subcontractors={subcontractors}
            submitting={submitting}
            onSubmit={handleSubmit}
            onCancel={() => router.push('/vehicles')}
          />
        </CardContent>
      </Card>
    </div>
  );
}
