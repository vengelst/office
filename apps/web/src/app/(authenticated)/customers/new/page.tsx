'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { CustomerForm } from '@/components/customers/customer-form';
import type { PendingContact } from '@/components/customers/research-preview-dialog';
import { useToast } from '@/components/ui/use-toast';
import { customersApi } from '@/lib/customers';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

export default function NewCustomerPage(): React.ReactNode {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const pendingContactsRef = useRef<PendingContact[]>([]);
  const t = texts.customers;

  const handlePendingContacts = (contacts: PendingContact[]): void => {
    pendingContactsRef.current = contacts;
  };

  const handleSubmit = (payload: Record<string, unknown>): void => {
    setSubmitting(true);
    customersApi
      .create(payload)
      .then(async (created) => {
        toast({ description: t.toast.created });

        if (pendingContactsRef.current.length > 0) {
          for (const contact of pendingContactsRef.current) {
            try {
              const contactPayload: Record<string, unknown> = {
                firstName: contact.firstName || '',
                lastName: contact.lastName || '',
              };
              if (contact.role) contactPayload.role = contact.role;
              if (contact.department) contactPayload.department = contact.department;
              if (contact.email) contactPayload.email = contact.email;
              if (contact.phoneMobile) contactPayload.phoneMobile = contact.phoneMobile;
              if (contact.phoneLandline) contactPayload.phoneLandline = contact.phoneLandline;
              if (contact.linkedInUrl) contactPayload.linkedInUrl = contact.linkedInUrl;
              contactPayload.syncToGoogle = contact.syncToGoogle;

              await customersApi.createContact(created.id, contactPayload);
            } catch (err) {
              const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
              toast({
                variant: 'destructive',
                description: `Kontakt "${name}" konnte nicht angelegt werden.`,
              });
            }
          }
          pendingContactsRef.current = [];
        }

        router.push(`/customers/${created.id}`);
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
        href="/customers"
        className="mb-3 inline-flex min-h-[44px] items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {t.backToList}
      </Link>
      <PageHeader title={t.createTitle} description={t.createSubtitle} />
      <Card>
        <CardContent className="pt-6">
          <CustomerForm
            submitting={submitting}
            onSubmit={handleSubmit}
            onCancel={() => router.push('/customers')}
            onPendingContacts={handlePendingContacts}
          />
        </CardContent>
      </Card>
    </div>
  );
}
