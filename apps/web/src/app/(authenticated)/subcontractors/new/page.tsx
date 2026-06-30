'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { SubcontractorForm } from '@/components/workers/subcontractor-form';
import { useToast } from '@/components/ui/use-toast';
import { subcontractorsApi } from '@/lib/workers';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

export default function NewSubcontractorPage(): React.ReactNode {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const t = texts.subcontractors;

  const handleSubmit = (payload: Record<string, unknown>): void => {
    setSubmitting(true);
    subcontractorsApi
      .create(payload)
      .then((created) => {
        toast({ description: t.toast.created });
        router.push(`/subcontractors/${created.id}`);
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
        href="/subcontractors"
        className="mb-3 inline-flex min-h-[44px] items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {t.backToList}
      </Link>
      <PageHeader title={t.createTitle} description={t.createSubtitle} />
      <Card>
        <CardContent className="pt-6">
          <SubcontractorForm
            submitting={submitting}
            onSubmit={handleSubmit}
            onCancel={() => router.push('/subcontractors')}
          />
        </CardContent>
      </Card>
    </div>
  );
}
